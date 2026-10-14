import type { AletaDatabase } from "@/server/db/client";
import { rakitBerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import { petaPenanda } from "@/server/modules/aleta-ecourt/bas-tanya-jawab";
import { penandaDariLembar, pihakLembar, semuaLembar, type Lembar } from "@/server/modules/aleta-ecourt/bas-lembar";
import { penandaDariSidang, sidangKe, susunRangkaian } from "@/lib/rangkaian-sidang";
import { muatKehadiran, penandaDariKehadiran } from "@/server/modules/aleta-ecourt/bas-kehadiran";
import { penandaSaksi } from "@/lib/keterangan-abt";

/**
 * ISIAN ALETA UNTUK NASKAH BAS (Q2, 14 Okt 2026)
 *
 * ============================================================================
 * ABT YANG MENGISI, ALETA YANG MELENGKAPI
 * ============================================================================
 *
 * Seluruh penanda blangko kini diisi mesin variabel ABT di bot
 * (aleta_bot/services/abtMesinVariabel.js) - katalog abt_variabel dibaca saat
 * berjalan, sama seperti tombol CETAK ABT. Isian ALETA dibagi dua:
 *
 *   timpa    menang atas ABT: yang DIKETIK panitera hari ini - jati diri saksi
 *            di lembar BAS dan catatan kehadiran sidang.
 *   cadangan dipakai HANYA bila ABT kosong: bacaan ALETA atas berkas perkara
 *            dan rangkaian sidang. Sebelum ini cadangan ikut menimpa - dan
 *            "#1261#" ("Pengadilan tsb") tercetak nama ruang sidang.
 *
 * Tanya-jawab saksi TIDAK dikirim sebagai teks: baris lembar dikirim mentah
 * (`tanyaJawabSaksi`, berkunci penanda NAMA saksi = referensi variabel ABT)
 * dan bot membentuknya PERSIS seperti ABT - tabel pertanyaan kiri / jawaban
 * kanan (kolom_kode_A4) atau daftar "Bahwa ..." (list_keterangan). Rekaman
 * ABT (abt_keterangan_saksi, hasil "Simpan keterangan ... ke ABT") dibaca bot
 * sendiri untuk saksi yang belum berlembar.
 */

export type BarisTanyaJawab = { pertanyaan: string; jawaban: string };

export type IsianNaskahBas = {
  nomorPerkara: string;
  timpa: Record<string, string>;
  cadangan: Record<string, string>;
  tanyaJawabSaksi: Record<string, BarisTanyaJawab[]>;
  lembar: Lembar[];
};

/** Baris lembar yang terjawab, berurutan, berkunci penanda nama saksinya. */
export function tanyaJawabDariLembar(lembar: Lembar[]): Record<string, BarisTanyaJawab[]> {
  const hasil: Record<string, BarisTanyaJawab[]> = {};
  for (const item of lembar) {
    const penanda = penandaSaksi(pihakLembar(item), item.saksiKe);
    if (!penanda) continue;
    const baris = item.baris
      .filter((b) => String(b.jawaban ?? "").trim())
      .slice()
      .sort((a, b) => a.urutan - b.urutan)
      .map((b) => ({ pertanyaan: String(b.pertanyaan ?? "").trim(), jawaban: String(b.jawaban ?? "").trim() }));
    if (baris.length) hasil[penanda.nama] = baris;
  }
  return hasil;
}

/** Penanda tanya-jawab yang dihasilkan lembar - dibentuk bot, bukan dikirim sebagai teks. */
function penandaTanyaJawabLembar(lembar: Lembar[]): Set<string> {
  const hasil = new Set<string>();
  for (const item of lembar) {
    const penanda = penandaSaksi(pihakLembar(item), item.saksiKe);
    for (const noVar of penanda?.tanyaJawab ?? []) hasil.add(noVar);
  }
  return hasil;
}

type Muatan = {
  isiBerkas: Awaited<ReturnType<typeof rakitBerkasPerkara>>;
  lembar: Lembar[];
  kehadiran: Awaited<ReturnType<typeof muatKehadiran>>;
};

/** `muatan` = berkas, lembar, dan kehadiran yang SUDAH dimuat pemanggil (pratinjau) - tidak dibaca dua kali. */
export async function susunIsianNaskahBas(
  db: AletaDatabase,
  perkaraId: string,
  nomorSidang: number,
  muatan?: Muatan
): Promise<IsianNaskahBas> {
  let dimuat: Muatan;
  if (muatan) dimuat = muatan;
  else {
    const [isiBerkas, lembar, kehadiran] = await Promise.all([
      rakitBerkasPerkara(perkaraId),
      semuaLembar(db, perkaraId),
      muatKehadiran(db, perkaraId, nomorSidang),
    ]);
    dimuat = { isiBerkas, lembar, kehadiran };
  }
  const { isiBerkas, lembar, kehadiran } = dimuat;

  const cadangan: Record<string, string> = {};
  for (const [noVar, item] of petaPenanda(isiBerkas)) cadangan[noVar] = item.nilai;
  const sidang = sidangKe(susunRangkaian(isiBerkas.riwayatSidang.nilai), nomorSidang);
  for (const [noVar, item] of penandaDariSidang(sidang)) cadangan[noVar] = item.nilai;

  const timpa: Record<string, string> = {};
  for (const [noVar, item] of penandaDariKehadiran(kehadiran)) timpa[noVar] = item.nilai;
  const tanyaJawabLembar = penandaTanyaJawabLembar(lembar);
  for (const [noVar, item] of penandaDariLembar(lembar)) {
    if (!tanyaJawabLembar.has(noVar)) timpa[noVar] = item.nilai;
  }

  return {
    nomorPerkara: isiBerkas.nomorPerkara,
    timpa,
    cadangan,
    tanyaJawabSaksi: tanyaJawabDariLembar(lembar),
    lembar,
  };
}
