import { type NextRequest } from "next/server";

import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import {
  type BarisDasar,
  type SunganBaris,
  KERTAS,
  hitungDaftarIsi,
  kodeKertasSah,
  nilaiTimpaDaftarIsi,
  rapikanSampulAwal,
  tanggalIndonesia,
  saringNilaiTimpa,
} from "@/lib/berkas-perkara";
import { PENANDA_TABEL_CEKLIST, bersihkanBahanCeklist, kotaDariPengadilan, susunCeklist, tabelCeklistRtf, tempelTabelCeklist, teksRingkasCeklist } from "@/lib/ceklist-berkas";
import { FITUR_BERKAS_PERKARA } from "@/lib/fitur-satker";
import { bersihkanPihak, gabungLampiran, jumlahDariDaftar, pihakBanyak } from "@/lib/lampiran-pihak";
import { barisTurut, bersihkanAlasan, bersihkanAnak, bersihkanObjek, bersihkanSidang, kolomPihakSampul, susunLampiran, type HasilLampiran } from "@/lib/lampiran-sampul";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { pastikanBolehBerkas } from "@/server/modules/berkas-perkara/akses";
import { bacaSatkerAktif } from "@/server/modules/satker/identitas";
import { idPerkaraSah } from "@/server/modules/berkas-perkara/layanan";
import { pastikanFiturMenyala } from "@/server/modules/satker/fitur";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATAS_ISI_MS = 90_000;
const BATAS_BARIS = 400;

type HasilIsi = { ok?: boolean; sebab?: string; berkas?: string; jumlahTerisi?: number; kosong?: Array<{ noVar: string }>; mesinGalat?: string; rtfBase64?: string };

const teks = (x: unknown, maks = 200) => String(x ?? "").slice(0, maks);

/** Saring baris kiriman klien menjadi BarisDasar yang aman. */
function bersihkanBaris(mentah: unknown): BarisDasar[] {
  if (!Array.isArray(mentah)) return [];
  const hasil: BarisDasar[] = [];
  for (const m of mentah.slice(0, BATAS_BARIS)) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const bundel = r.bundel === "B" ? "B" : r.bundel === "A" ? "A" : null;
    const kunci = teks(r.kunci, 60);
    if (!bundel || !/^[a-z0-9_:.\-]{1,60}$/i.test(kunci)) continue;
    const halaman = Math.max(1, Math.min(999, Math.round(Number(r.halaman) || 1)));
    hasil.push({
      bundel,
      grup: teks(r.grup, 80),
      kunci,
      nama: teks(r.nama, 200),
      ket: teks(r.ket, 100),
      tanggal: teks(r.tanggal, 40),
      halaman,
      sumber: r.sumber === "perkiraan" ? "perkiraan" : "pasti",
      dasar: teks(r.dasar, 120),
    });
  }
  return hasil;
}

function bersihkanSunting(mentah: unknown): Record<string, Partial<SunganBaris>> {
  const hasil: Record<string, Partial<SunganBaris>> = {};
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return hasil;
  for (const [kunci, v] of Object.entries(mentah as Record<string, unknown>).slice(0, BATAS_BARIS)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    hasil[kunci] = {
      tampil: r.tampil === false,
      urutan: 0,
      halamanTeks: teks(r.halamanTeks, 12),
      judulManual: teks(r.judulManual, 200),
      tanggalManual: teks(r.tanggalManual, 40),
      tambahan: r.tambahan === true,
    };
    hasil[kunci].tampil = r.tampil !== false;
  }
  return hasil;
}

/**
 * ============================================================================
 * NASKAH RTF SAMPUL / DAFTAR ISI (isian ALETA menang atas isian ABT; tidak ada yang ditulis)
 * ============================================================================
 *
 *   POST { perkaraId, jenis: "sampul" | "daftar-isi", kertas?: "a4" | "f4" | "legal",
 *          nilai?: {kode: teks}                      // sampul: ciri, fokus, pokok perkara, isian tangan (blok paket saja)
 *          baris?: [...], sunting?: {...}, bundelB?: "1"|"lanjut" }   // daftar isi: baris akhir dan sunting; kolom dihitung DI SINI
 *
 * Blangko dibaca bot dari folder Derry (baca saja), semua penanda diisi mesin variabel ABT di bot dari data perkara, lalu nilai di atas
 * menimpa. Hak: sampul = folder PTSP; daftar isi = folder BAS (Panitera Sidang); Super Admin/Admin keduanya.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanFiturMenyala(db, FITUR_BERKAS_PERKARA);
    const badan = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!badan || typeof badan !== "object") throw new ApiError(400, "Badan permintaan harus JSON.");
    const perkaraId = idPerkaraSah(badan.perkaraId);
    const jenis = badan.jenis === "sampul" ? "sampul" : badan.jenis === "daftar-isi" ? "daftar-isi" : badan.jenis === "ceklist" ? "ceklist" : null;
    if (!perkaraId || !jenis) throw new ApiError(400, "Perkara dan jenis (sampul | daftar-isi) harus disebutkan.");
    const kertas = kodeKertasSah(badan.kertas) ? badan.kertas : "a4";
    // Sampul: bentuk "awal" (cetak awal, bawaan) atau "lengkap"; perkara berlawanan memakai tata letak berlawanan, permohonan tata letak permohonan.
    const bentuk = badan.bentuk === "lengkap" ? "lengkap" : "awal";
    const lawan = badan.lawan !== false;
    // Pihak banyak: varian RTF dua kolom nama bernomor romawi; lebih dari muat sampul = Lampiran Daftar Para Pihak (halaman kedua, hanya bila perlu).
    const pihak = bersihkanPihak(badan.pihak);
    const jumlah = jumlahDariDaftar(pihak);
    const banyak = badan.banyak === true || pihakBanyak(jumlah);
    const berkas = await pastikanBolehBerkas(actor, jenis, kertas, teks(badan.sebagaiPeran, 10).toLowerCase(), { bentuk, lawan, banyak: bentuk === "awal" && banyak });

    let nilai: Record<string, string>;
    let ringkas: Record<string, unknown> = {};
    let lamp: HasilLampiran | null = null;
    let ceklistTabel = "";
    let ceklistHasil: ReturnType<typeof susunCeklist> | null = null;
    if (jenis === "ceklist") {
      // Ceklist berkas Meja I: kerangka lewat ABT, tabel dokumen disusun di sini (jenis dan keadaan perkara) lalu ditempel menggantikan paragraf penanda.
      const bahan = bersihkanBahanCeklist(badan.ceklist);
      if (!bahan) throw new ApiError(400, "Data ceklist (jenis dan fakta perkara) harus disertakan.");
      const hasilCek = susunCeklist(bahan);
      ceklistHasil = hasilCek;
      const lebarKertas = { a4: 11906, f4: 12189, legal: 12246 }[kertas];
      ceklistTabel = tabelCeklistRtf(hasilCek.baris, lebarKertas - 1400);
      const satker = await bacaSatkerAktif(db);
      const kota = kotaDariPengadilan(satker.namaPengadilan);
      const sekarang = new Date().toISOString().slice(0, 10);
      const petugas = teks((actor as { name?: string; username?: string } | null)?.name || (actor as { username?: string } | null)?.username, 80);
      nilai = { "5850": PENANDA_TABEL_CEKLIST, "5848": teksRingkasCeklist(hasilCek.ringkas), "5860": hasilCek.penandaJenis, "5855": `${kota ? `${kota}, ` : ""}${tanggalIndonesia(sekarang)}` };
      if (bahan.fakta.ppNama) nilai["5849"] = bahan.fakta.ppNama;
      if (petugas && !/aleta/i.test(petugas)) nilai["5838"] = petugas;
      ringkas = { ceklist: hasilCek.ringkas, jumlahBaris: hasilCek.baris.length };
    } else if (jenis === "sampul") {
      nilai = saringNilaiTimpa(badan.nilai);
      if (bentuk === "awal") {
        // Lampiran HANYA bila perlu (pihak melebihi ruang, objek > 2, anak > 3, riwayat sidang melebihi baris sampul): LAMPIRAN n - JUDUL, halaman berikutnya.
        const lebarKertas = { a4: 11906, f4: 12189, legal: 12246 }[kertas];
        lamp = susunLampiran({
          nomor: teks(badan.nomor, 80),
          lebar: lebarKertas - 1400,
          lawan,
          pihak,
          anak: bersihkanAnak(badan.anak),
          objek: bersihkanObjek(badan.objek),
          riwayat: bersihkanSidang(badan.riwayat),
          alasan: bersihkanAlasan(badan.alasan, teks(badan.jenisPerkara, 10)),
          barisRiwayat: KERTAS[kertas].barisAwal,
          infoKhasBaris: Math.max(0, Math.min(20, Math.trunc(Number(badan.infoKhasBaris)) || 0)),
          sebutan: { 1: teks(badan.sebutanP, 20) || (lawan ? "Penggugat" : "Pemohon"), 2: teks(badan.sebutanT, 20) || (lawan ? "Tergugat" : "Termohon") },
          sebutanPihakI: teks(badan.sebutanP, 20) || (lawan ? "Penggugat" : "Pemohon"),
          sebutanPihakII: teks(badan.sebutanT, 20) || (lawan ? "Tergugat" : "Termohon"),
        });
        if (lamp.barisDepan.length) nilai["5832"] = lamp.barisDepan.join("\n");
        if (lamp.kaki) nilai["5833"] = lamp.kaki;
        // CATATAN: ALASAN hanya bila ada yang terdeteksi/dicentang (baris tidak tampil bila tidak); KETERANGAN otomatis (mis. ghaib) + garis tangan di blangko.
        if (lamp.barisAlasan) nilai["5834"] = lamp.barisAlasan;
        const ket = Array.isArray(badan.keterangan) ? badan.keterangan.map((x) => teks(x, 200)).filter((x) => x && !/aleta/i.test(x)).slice(0, 4) : [];
        if (ket.length) nilai["5835"] = ket.join("\n");
        if (banyak) {
          const nomorPihak = lamp.daftar.find((d) => d.kunci === "pihak")?.nomor ?? 1;
          const s1 = kolomPihakSampul(pihak.filter((x) => x.sisi === 1), lamp.muatPihak, nomorPihak);
          nilai["5890"] = s1.kiri;
          nilai["5891"] = s1.kanan;
          if (lawan) {
            const s2 = kolomPihakSampul(pihak.filter((x) => x.sisi === 2), lamp.muatPihak, nomorPihak);
            nilai["5892"] = s2.kiri;
            nilai["5893"] = s2.kanan;
          }
          const intervensi = pihak.filter((x) => x.sisi === 3);
          if (intervensi.length) nilai["5847"] = barisTurut(intervensi, nomorPihak, "INTERVENSI");
          const turut = barisTurut(pihak.filter((x) => x.sisi === 4), nomorPihak, teks(badan.sebutanT, 20) ? `TURUT ${teks(badan.sebutanT, 20).toUpperCase()}` : "TURUT TERGUGAT");
          if (turut) nilai["5897"] = turut;
        }
      }
    } else {
      const baris = bersihkanBaris(badan.baris);
      const hitung = hitungDaftarIsi(baris, bersihkanSunting(badan.sunting), { bundelB: badan.bundelB === "lanjut" ? "lanjut" : "1" });
      nilai = nilaiTimpaDaftarIsi(hitung.baris);
      ringkas = { dokumen: hitung.total.A.dokumen + hitung.total.B.dokumen, halamanA: hitung.total.A.halaman, halamanB: hitung.total.B.halaman, perkiraan: hitung.total.A.perkiraan + hitung.total.B.perkiraan };
    }

    const hasil = await callAletaBotSippBridge<HasilIsi>(
      "blangko.isi",
      { folder: berkas.folder, berkas: berkas.berkas, perkaraId, sidangKe: 0, nilai, cadangan: {}, tanyaJawabSaksi: {} },
      { timeoutMs: BATAS_ISI_MS }
    );
    const data = hasil.data;
    if (!hasil.ok || !data?.ok || !data.rtfBase64) {
      return Response.json({ ok: false, alasan: data?.sebab ?? hasil.error ?? "Blangko tidak dapat diisi." }, { status: 502 });
    }
    let bita = buangGrupTersembunyiRtf(Buffer.from(data.rtfBase64, "base64"));
    // Sampul cetak awal: kotak centang ASCII dari variabel menjadi karakter kotak; tanda "..." variabel kosong dibuang (kolom tulis tangan).
    if ((jenis === "sampul" && bentuk === "awal") || jenis === "ceklist") bita = new Uint8Array(Buffer.from(rapikanSampulAwal(Buffer.from(bita).toString("latin1")), "latin1"));
    if (jenis === "ceklist") bita = new Uint8Array(Buffer.from(tempelTabelCeklist(Buffer.from(bita).toString("latin1"), ceklistTabel), "latin1"));
    if (lamp && lamp.bagianRtf) bita = new Uint8Array(Buffer.from(gabungLampiran(Buffer.from(bita).toString("latin1"), lamp.bagianRtf), "latin1"));
    const rtf = Buffer.from(bita);
    return ok(
      {
        berkas: data.berkas ?? berkas.berkas,
        folder: berkas.folder,
        kertas,
        bentuk: jenis === "sampul" ? bentuk : undefined,
        pihakBanyak: jenis === "sampul" ? banyak : undefined,
        lampiran: lamp ? lamp.daftar : [],
        ceklist: ceklistHasil ? { baris: ceklistHasil.baris, ringkas: ceklistHasil.ringkas } : undefined,
        muatPihak: lamp ? lamp.muatPihak : undefined,
        rtfBase64: rtf.toString("base64"),
        byte: rtf.length,
        jumlahTerisi: data.jumlahTerisi ?? 0,
        kosong: (data.kosong ?? []).map((k) => k.noVar),
        mesinGalat: data.mesinGalat ?? "",
        nilaiDikirim: Object.keys(nilai).length,
        ...ringkas,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BERKAS_PERKARA_NASKAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "sampul-berkas-naskah",
    });
  }
}
