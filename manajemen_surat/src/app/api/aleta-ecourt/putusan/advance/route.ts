import { type NextRequest } from "next/server";

import { bacaRtfDariBita } from "@/lib/baca-rtf";
import { pecahNaskahResmi } from "@/lib/naskah-putusan-resmi";
import { susunRaporAdvance, type ButirPustakaMasuk, type PutusanSerupaMasuk } from "@/lib/putusan-advance";
import { drafKeBita, susunDrafUtuh, type BahanIsian, type IsianKosong } from "@/lib/putusan-advance-draf";
import { hurufAlasan } from "@/lib/set-pertanyaan-saksi";
import { getDatabase } from "@/server/db/client";
import { getGatewaySippPutusanSerupa } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { periksaHakPutusanAdvance } from "@/server/modules/aleta-ecourt/putusan-advance-hak";
import { advanceMenyalaUntuk } from "@/server/modules/aleta-ecourt/putusan-advance-akun";
import { PESAN_ADVANCE_MATI } from "@/lib/putusan-advance-akun";
import { fiturMenyala, pastikanFiturMenyala } from "@/server/modules/satker/fitur";
import { cariButir } from "@/server/modules/aleta-ecourt/pustaka-pertimbangan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { ApiError } from "@/server/shared/errors";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATAS_BASE64 = 28 * 1024 * 1024;
const BATAS_TEKS = 2 * 1024 * 1024;

type Badan = {
  rtfBase64?: unknown;
  teks?: unknown;
  nomorPerkara?: unknown;
  jenisPerkara?: unknown;
  sebutanP?: unknown;
  huruf?: unknown;
  saksi?: unknown;
  /** "draf" = tahap 2: susun draf putusan utuh (rapor tetap dihitung ulang di sini). Kosong = pemeriksa saja. */
  tindakan?: unknown;
  /** Tahap 2: isian blangko yang masih kosong dan isian teks yang terisi (Blangko Derry). */
  isianKosong?: unknown;
  bahan?: unknown;
};

const teksRingkas = (x: unknown, maks: number) => String(x ?? "").slice(0, maks);

function isianKosongDari(x: unknown): IsianKosong[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, 80).map((b) => {
    const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
    return { kode: teksRingkas(o.kode, 12), nama: teksRingkas(o.nama, 160), jenis: teksRingkas(o.jenis, 12), khusus: teksRingkas(o.khusus, 12) };
  });
}

function bahanDari(x: unknown): BahanIsian[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, 80).map((b) => {
    const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
    return { kode: teksRingkas(o.kode, 12), nama: teksRingkas(o.nama, 160), teks: teksRingkas(o.teks, 6000), jenis: teksRingkas(o.jenis, 12), khusus: teksRingkas(o.khusus, 12) };
  });
}

/**
 * ============================================================================
 * PUTUSAN ADVANCE (17 Okt 2026, F4.4)
 * ============================================================================
 *
 *   POST JSON { rtfBase64 | teks, nomorPerkara, jenisPerkara?, sebutanP?,
 *               huruf? (isian #8503#), saksi? (jawaban saksi Blangko Derry) }
 *   -> { ok, rapor }  (lihat RaporAdvance di src/lib/putusan-advance.ts)
 *
 * Membaca draf putusan Blangko Derry (RTF dari ABT) dan menimbangnya: unsur
 * alasan, dasar hukum, konsistensi pertimbangan-amar, dan pembanding putusan
 * BHT hakim yang sama (SIPP lewat bot, baca saja) + pustaka ALETA yang sudah
 * disahkan. TIDAK MENULIS ke mana pun dan tidak memanggil AI: hasilnya hanya
 * rapor di layar; perubahan naskah tetap diketik hakim di Blangko Derry/ABT.
 *
 * TAHAP 2 (17 Okt, "pemeriksa dulu, lalu draf utuh"): bila badan memuat
 * tindakan: "draf" (+ isianKosong, bahan), pemeriksaan yang SAMA dijalankan
 * ulang di sini - hak, saklar akun, dan hitungannya tidak bisa dilewati - lalu
 * rapor disusun menjadi draf putusan utuh (@/lib/putusan-advance-draf):
 *   -> { ok, ringkasRapor, draf: { namaBerkas, rtfBase64, bagian, tanda, sisa, ... } }
 * Tetap TIDAK menulis ke ABT/SIPP/basis data; berkas RTF hanya dikirim ke
 * peramban untuk diunduh.
 *
 * Nama pihak perkara pembanding dipakai di sini untuk menyamarkan contoh
 * alinea dan tidak pernah dikirim ke peramban. Hak: kapabilitas
 * "blangko-abt", lalu (17 Okt) hanya hakim, konseptor perkara ini
 * (sementara ALETA atau tercatat SIPP), dan Super Admin/Admin -
 * lihat putusan-advance-hak.ts.
 */
/** GET -> { menyala, sebab } - ekstensi menyembunyikan alat Putusan Advance bila akun ini mati. */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const menyala = (await advanceMenyalaUntuk(db, aktor)) && (await fiturMenyala(db, "putusan-advance"));
    return ok({ menyala, sebab: menyala ? "" : PESAN_ADVANCE_MATI });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_ADVANCE_STATUS_FAILED",
      feature: "aleta_ecourt",
      entityId: "putusan-advance",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    // 17 Okt: saklar per akun dari Pengaturan SIPP & ABT (bawaan hanya Derry Briantono) -
    // syarat tambahan; hak lama (hakim/konseptor/Admin) tetap diperiksa di bawah.
    if (!(await advanceMenyalaUntuk(db, aktor))) throw new ApiError(403, PESAN_ADVANCE_MATI);
    // Banyak satker: saklar fitur per satker (bawaan menyala; gagal baca = menyala).
    await pastikanFiturMenyala(db, "putusan-advance");

    const body = await readJsonBody<Badan>(request).catch(() => ({}) as Badan);
    const nomorPerkara = String(body.nomorPerkara || "").trim();
    if (!nomorPerkara) return ok({ ok: false, sebab: "Nomor perkara belum disebut." });

    // Pembanding SIPP: gagal-terbuka - rapor tetap jadi, dengan catatan "tidak terbaca". Dibaca lebih dulu
    // karena membawa konseptor SIPP perkara ini untuk pemeriksaan hak.
    let serupa: PutusanSerupaMasuk[] | undefined;
    let jenisSipp = "";
    const hasilSerupa = await getGatewaySippPutusanSerupa(nomorPerkara).catch(() => null);
    const dataSerupa = hasilSerupa && hasilSerupa.ok && hasilSerupa.data.ok ? hasilSerupa.data : null;
    if (dataSerupa) {
      serupa = dataSerupa.kandidat ?? [];
      jenisSipp = dataSerupa.perkara?.jenis ?? "";
    }

    // Hak (17 Okt butir 57): hakim DAN konseptor perkara ini (sementara ALETA / tercatat SIPP) + Super Admin/Admin.
    const hak = await periksaHakPutusanAdvance(db, aktor, {
      perkaraId: dataSerupa?.perkara?.id,
      nomorPerkara,
      konseptorSipp: dataSerupa?.konseptor ?? [],
    });
    if (!hak.boleh) throw new ApiError(403, hak.sebab);

    let naskah = "";
    const rtfBase64 = String(body.rtfBase64 || "");
    if (rtfBase64) {
      if (rtfBase64.length > BATAS_BASE64) return ok({ ok: false, sebab: "Naskah putusan terlalu besar." });
      const bita = new Uint8Array(Buffer.from(rtfBase64, "base64"));
      if (!String.fromCharCode(...bita.subarray(0, 6)).startsWith("{\\rtf")) return ok({ ok: false, sebab: "Naskah bukan RTF." });
      naskah = bacaRtfDariBita(bita);
    } else {
      naskah = String(body.teks || "").slice(0, BATAS_TEKS);
    }
    if (!naskah.trim()) return ok({ ok: false, sebab: "Naskah putusan tidak terkirim." });

    const pecah = pecahNaskahResmi(naskah);
    const nama: Record<string, string> = { dudukPerkara: "duduk perkara", pertimbangan: "pertimbangan hukum", amar: "amar (MENGADILI)" };
    const bagianHilang = (["dudukPerkara", "pertimbangan", "amar"] as const).filter((k) => !pecah.bagian[k]).map((k) => nama[k]);

    // Pustaka ALETA: hanya butir yang SUDAH DISAHKAN (bawaan cariButir), menurut huruf alasan.
    const huruf = hurufAlasan(String(body.huruf || ""));
    const pustaka: ButirPustakaMasuk[] = [];
    for (const h of (huruf || "F").split("")) {
      try {
        for (const b of await cariButir(db, { bagian: "pertimbangan", labelAlasan: h, batas: 40 })) {
          if (!pustaka.some((x) => x.id === b.id)) pustaka.push({ id: b.id, teks: b.teks, labelAlasan: b.labelAlasan, jumlahPemakaian: b.jumlahPemakaian });
        }
      } catch {
        // Pustaka kosong/tabel belum ada di peladen lama: contoh dari putusan serupa tetap tersedia.
      }
    }

    const saksi = Array.isArray(body.saksi) ? body.saksi.map((x) => String(x || "")).filter(Boolean).slice(0, 400) : undefined;
    const rapor = susunRaporAdvance({
      nomorPerkara,
      jenisPerkara: String(body.jenisPerkara || "") || jenisSipp,
      sebutanP: String(body.sebutanP || ""),
      hurufIsian: String(body.huruf || ""),
      dudukPerkara: pecah.bagian.dudukPerkara ?? "",
      pertimbangan: pecah.bagian.pertimbangan ?? "",
      amar: pecah.bagian.amar ?? "",
      keteranganSaksi: saksi,
      serupa,
      pustaka,
      bagianHilang,
    });
    if (String(body.tindakan || "") === "draf") {
      const draf = susunDrafUtuh({
        nomorPerkara,
        naskah,
        rapor,
        pengadilan: String(process.env.ALETA_NAMA_SATKER || ""),
        isianKosong: isianKosongDari(body.isianKosong),
        bahan: bahanDari(body.bahan),
      });
      const { rtf, ...tanpaRtf } = draf;
      return ok({
        ok: true,
        ringkasRapor: rapor.ringkas,
        draf: { ...tanpaRtf, rtfBase64: Buffer.from(drafKeBita(rtf)).toString("base64") },
      });
    }
    return ok({ ok: true, rapor });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_ADVANCE_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-advance",
    });
  }
}
