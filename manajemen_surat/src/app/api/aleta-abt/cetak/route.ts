import { NextRequest } from "next/server";

import { bandingRingkasPdf } from "@/lib/aleta-abt-naskah";
import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import { idBlangkoSah } from "@/lib/id-blangko-abt";
import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { bandingkanRtf, paragrafPratinjau, susunNaskah, type NaskahJadi } from "@/server/modules/aleta-abt-cetak/naskah";
import { ringkasPdf } from "@/server/modules/aleta-abt-cetak/pdf-ringkas";
import { pdfLewatRuteAbt, salinanDariPdfLewatRute, type JawabanRutePdf } from "@/server/modules/aleta-abt-cetak/rute-pdf";
import { NAMA_KEPALA_TANDA, jagaCetakAletaAbt, type Penjaga } from "@/server/modules/aleta-abt-cetak/tanda";
import { catatBandingManual } from "@/server/modules/aleta-abt-berdampingan/service";
import { daftarBlangko } from "@/server/modules/aleta-abt-penyunting/service";
import { BATAS_KONVERSI, kenaliBentukNaskah, konversiNaskah } from "@/server/modules/aleta-ecourt/konversi-naskah";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * LAYAR CETAK ALETA ABT (5 Nov 2026, Tahap 5) - HANYA SUPER ADMIN, DIJAGA DI SERVER
 * ============================================================================
 *
 * Setiap permintaan (kecuali bagian=hak) melewati jagaCetakAletaAbt: Super Admin DAN (tanda berumur pendek dari ekstensi di PC
 * ATAU hak ALETA ABT di HP menyala). Tanda bukan kunci keamanan; pengaman utamanya akun. Naskah disusun jalur ALETA dari blangko
 * pustaka (tanpa PHP ABT); hanya membaca SIPP/ABT, tidak menulis apa pun. Panel lama tidak memakai rute ini.
 *
 *   GET  ?bagian=hak                      keadaan penjaga untuk akun ini { boleh, lewat, sebab }   (tanpa tanda pun boleh dibaca)
 *   GET  ?bagian=daftar                   blangko pustaka (folder, nama)
 *   GET  ?bagian=perkara&nomor=           cari perkara menurut sebagian nomor (bot: tes.cariPerkara)
 *   POST {tindakan:"pratinjau", berkasId, perkaraId, sidangKe?}   paragraf + isian kosong + waktu
 *   POST {tindakan:"rtf", ...}                                    RTF final (isian kosong menahan)       [audit]
 *   POST {tindakan:"pdf", ...} / {tindakan:"salinan", ...}        PDF / PDF SALINAN lewat LibreOffice (rute abt/pdf)  [audit]
 *        untukPeriksa:true pada rtf = naskah untuk pemeriksa temuan di peramban, belum diunduh (tanpa audit cetak).
 *        rtfDiperbaikiBase64 pada pdf/salinan = naskah yang bagian dicentangnya sudah diperbaiki petugas; penjaga isian kosong tetap berlaku.
 *   POST {tindakan:"banding", ..., rtfAbtBase64[, catat:true, jenisPerkara]}  banding alinea dengan RTF dari ABT; catat:true menyimpan HASIL (angka) di pembanding berdampingan
 *   POST {tindakan:"banding-pdf", pdfAbtBase64, pdfAletaBase64}   banding jumlah halaman dan letak tanda tangan
 *   POST {tindakan:"salinan-berkas", berkasBase64, namaBerkas?}   PDF SALINAN dari berkas RTF/DOCX/DOC/PDF yang diunggah (keputusan 215):
 *        PDF kosong -> rute salinan-dari-pdf; RTF -> rute PDF salinan; DOCX/DOC -> diubah ke RTF (konversi naskah) lalu rute PDF salinan.
 *        Tidak ada logika salinan kedua di sini; berita acara dalam bentuk PDF ditolak oleh rute salinan-dari-pdf dengan pesannya sendiri.
 *
 * Audit tidak memuat isi naskah atau nama pihak: hanya blangko, nomor perkara internal, jenis, jalur penjaga, ukuran, waktu.
 */

const BATAS_BASE64 = 28 * 1024 * 1024;

type Db = Awaited<ReturnType<typeof getDatabase>>;

async function aktor(request: NextRequest, perluPenjaga: boolean) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  const actor = await requireActorUser(db, actorUserId);
  const roleId = String(getEffectiveRoleId(actor) ?? actor.roleId ?? "");
  if (roleId !== "super-admin") throw new ApiError(403, "Layar cetak ALETA ABT hanya untuk Super Admin.");
  const penjaga: Penjaga | null = perluPenjaga ? await jagaCetakAletaAbt(db, actor, request.headers.get(NAMA_KEPALA_TANDA)) : null;
  return { db, actorUserId, actor, penjaga };
}

async function catat(db: Db, actorUserId: string, action: string, entityId: string, payload: Record<string, unknown>) {
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId,
    action,
    entityType: "aleta_abt_cetak",
    entityId,
    payload,
  });
}

function masukanNaskah(badan: Record<string, unknown>) {
  const berkasId = String(badan.berkasId ?? "").trim();
  const perkaraId = String(badan.perkaraId ?? "").trim();
  if (!idBlangkoSah(berkasId)) throw new ApiError(400, "Pilih blangko dari pustaka.");
  if (!/^\d{1,12}$/.test(perkaraId)) throw new ApiError(400, "Pilih perkara.");
  const sidangKe = Math.max(0, Math.min(99, Math.trunc(Number(badan.sidangKe) || 0)));
  return { berkasId, perkaraId, sidangKe };
}

function bitaBase64(nilai: unknown, nama: string): Buffer {
  const s = String(nilai ?? "");
  if (!s) throw new ApiError(400, `${nama} belum dipilih.`);
  if (s.length > BATAS_BASE64) throw new ApiError(413, `${nama} terlalu besar.`);
  return Buffer.from(s, "base64");
}

export async function GET(request: NextRequest) {
  let db: Db | null = null;
  let actorUserId: string | null = null;
  try {
    const bagian = getSearchParam(request, "bagian") ?? "hak";
    if (bagian === "hak") {
      const a = await aktor(request, false);
      db = a.db;
      actorUserId = a.actorUserId;
      try {
        const p = await jagaCetakAletaAbt(a.db, a.actor, request.headers.get(NAMA_KEPALA_TANDA));
        return ok({ boleh: true, lewat: p.lewat, sebab: "" }, { headers: { "Cache-Control": "no-store" } });
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) return ok({ boleh: false, lewat: "", sebab: e.message }, { headers: { "Cache-Control": "no-store" } });
        throw e;
      }
    }
    const a = await aktor(request, true);
    db = a.db;
    actorUserId = a.actorUserId;
    if (bagian === "daftar") return ok(await daftarBlangko(a.db), { headers: { "Cache-Control": "no-store" } });
    if (bagian === "perkara") {
      const nomor = String(getSearchParam(request, "nomor") ?? "").trim().slice(0, 60);
      if (nomor.length < 3) throw new ApiError(400, "Ketik paling sedikit tiga karakter nomor perkara.");
      const hasil = await callAletaBotSippBridge<{ ok?: boolean; sebab?: string; perkara?: unknown[] }>("tes.cariPerkara", { nomorPerkara: nomor, limit: 12 }, { timeoutMs: 20_000 });
      if (!hasil.ok || !hasil.data?.ok) throw new ApiError(502, String(hasil.data?.sebab ?? hasil.error ?? "Pencarian perkara gagal."));
      return ok({ perkara: Array.isArray(hasil.data.perkara) ? hasil.data.perkara : [] }, { headers: { "Cache-Control": "no-store" } });
    }
    throw new ApiError(400, "Bagian tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_CETAK_READ_FAILED", feature: "aleta_abt", entityId: "aleta-abt-cetak" });
  }
}

export async function POST(request: NextRequest) {
  let db: Db | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktor(request, true);
    db = a.db;
    actorUserId = a.actorUserId;
    const lewat = a.penjaga?.lewat ?? "";
    let badan: Record<string, unknown> = {};
    try {
      const isi = (await request.json()) as unknown;
      if (isi && typeof isi === "object" && !Array.isArray(isi)) badan = isi as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    const tindakan = String(badan.tindakan ?? "");
    const tak = { "Cache-Control": "no-store" };

    if (tindakan === "banding-pdf") {
      const abt = await ringkasPdf(new Uint8Array(bitaBase64(badan.pdfAbtBase64, "PDF dari ABT")));
      const aleta = await ringkasPdf(new Uint8Array(bitaBase64(badan.pdfAletaBase64, "PDF ALETA ABT")));
      return ok({ abt, aleta, banding: bandingRingkasPdf(abt, aleta) }, { headers: tak });
    }

    if (tindakan === "salinan-berkas") {
      const bita = bitaBase64(badan.berkasBase64, "Berkas");
      if (bita.length > BATAS_KONVERSI) throw new ApiError(413, "Berkas terlalu besar.");
      const bentuk = kenaliBentukNaskah(new Uint8Array(bita));
      if (!bentuk) throw new ApiError(400, "Isi berkas bukan RTF, DOCX, DOC, maupun PDF, jadi salinan tidak dibuat.");
      const namaBerkas = String(badan.namaBerkas ?? "").slice(0, 200);
      const mulai = Date.now();
      let pdf: JawabanRutePdf;
      if (bentuk === "pdf") {
        pdf = await salinanDariPdfLewatRute(request, bita);
      } else {
        // RTF dipakai apa adanya; DOCX/DOC diubah ke RTF oleh konversi naskah yang sama dengan ekstensi. Grup tersembunyi dibuang seperti RTF unduhan lain.
        const rtf = bentuk === "rtf" ? bita : Buffer.from((await konversiNaskah({ bita: new Uint8Array(bita), namaBerkas, ke: "rtf" })).berkasBase64, "base64");
        pdf = await pdfLewatRuteAbt(request, Buffer.from(buangGrupTersembunyiRtf(new Uint8Array(rtf))), true);
      }
      const waktuMs = Date.now() - mulai;
      await catat(a.db, a.actorUserId, "ALETA_ABT_CETAK_SALINAN_BERKAS", "berkas", { lewat, bentuk, tersedia: pdf.available === true, kode: pdf.kode ?? "", byte: pdf.byte ?? 0, waktuMs });
      if (pdf.available !== true || !pdf.pdfBase64) {
        return Response.json({ ok: false, kode: pdf.kode ?? "", alasan: pdf.message || "PDF SALINAN belum dapat dibuat." }, { status: 422, headers: tak });
      }
      return ok({ pdfBase64: pdf.pdfBase64, byte: pdf.byte ?? 0, bentuk, ...(pdf.salinan ? { salinan: pdf.salinan } : {}), waktuMs }, { headers: tak });
    }

    const m = masukanNaskah(badan);

    if (tindakan === "pratinjau" || tindakan === "banding") {
      const n = await susunNaskah(a.db, { ...m, cetakFinal: false });
      if (!n.ok) return Response.json({ ok: false, alasan: n.alasan }, { status: n.status, headers: tak });
      if (tindakan === "banding") {
        const hasil = bandingkanRtf(n.rtf, bitaBase64(badan.rtfAbtBase64, "RTF dari ABT"));
        await catat(a.db, a.actorUserId, "ALETA_ABT_CETAK_BANDING", m.berkasId, { perkaraId: m.perkaraId, lewat, identik: hasil.alinea.identik, total: hasil.alinea.total });
        // Tahap 7: bila diminta, hasil banding dicatat di pembanding berdampingan (hanya angka, nama blangko, dan jenis beda).
        const tercatat =
          badan.catat === true
            ? await catatBandingManual(a.db, { berkasId: m.berkasId, perkaraId: m.perkaraId, sidangKe: m.sidangKe, jenisPerkara: badan.jenisPerkara, hasil: hasil.alinea, waktuMs: n.waktu.totalMs })
            : null;
        if (tercatat) await catat(a.db, a.actorUserId, "ALETA_ABT_BERDAMPINGAN_CATAT", m.berkasId, { perkaraId: m.perkaraId, hasil: tercatat.hasil, jenisPerkara: tercatat.jenisPerkara });
        return ok({ ...hasil, waktu: n.waktu, ...(tercatat ? { tercatat: { hasil: tercatat.hasil, jenisPerkara: tercatat.jenisPerkara } } : {}) }, { headers: tak });
      }
      const p = paragrafPratinjau(n.rtf);
      return ok(
        {
          nama: n.nama,
          kertas: n.kertas,
          paragraf: p.paragraf,
          jumlahParagraf: p.jumlah,
          terpotong: p.terpotong,
          jumlahTerisi: n.jumlahTerisi,
          kosong: n.kosong,
          perluDilihat: n.perluDilihat,
          catatan: n.catatan,
          lolosCetak: n.lolosCetak,
          mesinGalat: n.mesinGalat,
          ringkasanKeyakinan: n.ringkasanKeyakinan,
          waktu: n.waktu,
        },
        { headers: tak }
      );
    }

    if (tindakan === "rtf" || tindakan === "pdf" || tindakan === "salinan") {
      // Cetak apa pun selalu final: ketikan dan tanya jawab wajib yang kosong menahan, naskah tidak keluar.
      const n = await susunNaskah(a.db, { ...m, cetakFinal: true });
      if (!n.ok) return Response.json({ ok: false, ditahan: n.ditahan === true, kosong: n.kosong ?? [], alasan: n.alasan }, { status: n.status, headers: tak });
      const naskah: NaskahJadi = n;
      if (tindakan === "rtf") {
        if (badan.untukPeriksa !== true) {
          await catat(a.db, a.actorUserId, "ALETA_ABT_CETAK_RTF", m.berkasId, { perkaraId: m.perkaraId, lewat, byte: naskah.rtf.length, waktuMs: naskah.waktu.totalMs });
        }
        return ok({ nama: naskah.nama, rtfBase64: naskah.rtf.toString("base64"), byte: naskah.rtf.length, kertas: naskah.kertas, waktu: naskah.waktu }, { headers: tak });
      }
      const mulaiPdf = Date.now();
      let rtfUntukPdf = naskah.rtf;
      if (typeof badan.rtfDiperbaikiBase64 === "string" && badan.rtfDiperbaikiBase64) {
        if (badan.rtfDiperbaikiBase64.length > BATAS_BASE64) throw new ApiError(413, "Naskah terlalu besar.");
        const diperbaiki = Buffer.from(badan.rtfDiperbaikiBase64, "base64");
        if (diperbaiki.subarray(0, 5).toString("latin1") !== "{\\rtf") throw new ApiError(400, "Naskah yang diperbaiki bukan RTF.");
        rtfUntukPdf = diperbaiki;
      }
      const pdf = await pdfLewatRuteAbt(request, rtfUntukPdf, tindakan === "salinan");
      const pdfMs = Date.now() - mulaiPdf;
      await catat(a.db, a.actorUserId, tindakan === "salinan" ? "ALETA_ABT_CETAK_PDF_SALINAN" : "ALETA_ABT_CETAK_PDF", m.berkasId, {
        perkaraId: m.perkaraId,
        lewat,
        tersedia: pdf.available === true,
        byte: pdf.byte ?? 0,
        waktuNaskahMs: naskah.waktu.totalMs,
        waktuPdfMs: pdfMs,
      });
      if (pdf.available !== true || !pdf.pdfBase64) {
        return Response.json({ ok: false, alasan: pdf.message || "PDF belum dapat dibuat." }, { status: 502, headers: tak });
      }
      return ok(
        { nama: naskah.nama, pdfBase64: pdf.pdfBase64, byte: pdf.byte ?? 0, versiMesin: pdf.versiMesin ?? "", kertas: naskah.kertas, ...(pdf.salinan ? { salinan: pdf.salinan } : {}), waktu: { ...naskah.waktu, pdfMs } },
        { headers: tak }
      );
    }

    throw new ApiError(400, "Tindakan tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_CETAK_FAILED", feature: "aleta_abt", entityId: "aleta-abt-cetak" });
  }
}
