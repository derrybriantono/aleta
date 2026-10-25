import { randomUUID } from "node:crypto";

import { FITUR_SAKSI_KE_BAS_SIPP } from "@/lib/fitur-satker";
import { type AletaDatabase } from "@/server/db/client";
import { fiturMenyala } from "@/server/modules/satker/fitur";

/**
 * ============================================================================
 * JEJAK KIRIM KETERANGAN SAKSI KE BAS SIPP (25 Okt 2026, rantai C butir C6 = U10)
 * ============================================================================
 *
 * Mencatat tiap percobaan (pratinjau / kirim / gagal / dobel) tombol "Kirim keterangan saksi ke BAS SIPP". Penulisan ke SIPP sendiri
 * dikerjakan rute unggah BAS yang sudah ada (bas/unggah-sipp -> bot); berkas ini hanya CATATAN: hanya sidik dan hitungan, isi BAS
 * tidak disimpan, dan nama aplikasi dibuang dari catatan.
 *
 * Saklar Fitur Satker "saksi-ke-bas-sipp" bawaan MATI: mati = tidak menulis apa pun (server menolak walau ekstensi memaksa).
 */

export const RETENSI_HARI = 730;
export const BATAS_CATATAN = 600;

export const TAHAP_SAH = ["pratinjau", "kirim"] as const;
export const HASIL_SAH = ["siap", "halangan", "berhasil", "gagal", "dobel", "dilewati", "dibatalkan"] as const;

const teks = (x: unknown, maks = 200) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, maks);
const angka = (x: unknown, maks = 1_000_000) => {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, maks) : 0;
};

export async function saksiKeBasAktif(db: AletaDatabase): Promise<boolean> {
  try {
    return await fiturMenyala(db, FITUR_SAKSI_KE_BAS_SIPP);
  } catch {
    return false;
  }
}

export type MasukanKirimBas = {
  perkaraId: string;
  nomorPerkara: string;
  sidangId: string;
  urutanSidang: number;
  tahap: (typeof TAHAP_SAH)[number];
  hasil: (typeof HASIL_SAH)[number];
  jumlahSaksi: number;
  jumlahJawaban: number;
  jumlahHilang: number;
  ukuran: number;
  sidik: string;
  catatan: string;
};

/** Menyaring masukan mentah dari ekstensi; null bila bukan catatan yang sah. Murni. */
export function bersihkanMasukanKirimBas(mentah: unknown): MasukanKirimBas | null {
  if (!mentah || typeof mentah !== "object") return null;
  const m = mentah as Record<string, unknown>;
  const perkaraId = teks(m.perkaraId, 20);
  const nomorPerkara = teks(m.nomorPerkara, 80);
  if (!/^\d{1,12}$/.test(perkaraId) || !nomorPerkara) return null;
  const tahap = TAHAP_SAH.find((t) => t === m.tahap);
  const hasil = HASIL_SAH.find((h) => h === m.hasil);
  if (!tahap || !hasil) return null;
  const sidik = teks(m.sidik, 64).toLowerCase();
  const catatan = teks(m.catatan, BATAS_CATATAN).replace(/aleta/gi, "");
  return {
    perkaraId,
    nomorPerkara,
    sidangId: /^\d{1,12}$/.test(teks(m.sidangId, 20)) ? teks(m.sidangId, 20) : "",
    urutanSidang: angka(m.urutanSidang, 99),
    tahap,
    hasil,
    jumlahSaksi: angka(m.jumlahSaksi, 20),
    jumlahJawaban: angka(m.jumlahJawaban, 5000),
    jumlahHilang: angka(m.jumlahHilang, 5000),
    ukuran: angka(m.ukuran, 100_000_000),
    sidik: /^[0-9a-f]{0,64}$/.test(sidik) ? sidik : "",
    catatan,
  };
}

export type AktorKirimBas = { id: string; nama?: string | null };

/** Mencatat satu percobaan. Saklar mati -> {aktif:false}, tidak menulis. */
export async function catatKirimBas(db: AletaDatabase, aktor: AktorKirimBas, mentah: unknown): Promise<{ aktif: boolean; dicatat: boolean; id: string }> {
  if (!(await saksiKeBasAktif(db))) return { aktif: false, dicatat: false, id: "" };
  const m = bersihkanMasukanKirimBas(mentah);
  if (!m) return { aktif: true, dicatat: false, id: "" };
  const id = randomUUID();
  const kini = new Date().toISOString();
  await db.run(
    `INSERT INTO aleta_saksi_kirim_bas
       (id, perkara_id, nomor_perkara, sidang_id, urutan_sidang, tahap, hasil, jumlah_saksi, jumlah_jawaban, jumlah_hilang, ukuran, sidik, catatan,
        pengguna_id, pengguna_nama, pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, m.perkaraId, m.nomorPerkara, m.sidangId, m.urutanSidang, m.tahap, m.hasil, m.jumlahSaksi, m.jumlahJawaban, m.jumlahHilang, m.ukuran, m.sidik, m.catatan, aktor.id, teks(aktor.nama, 120), kini]
  );
  void bersihkanKirimBasLawas(db).catch(() => undefined);
  return { aktif: true, dicatat: true, id };
}

export async function bacaKirimBasPerkara(db: AletaDatabase, perkaraId: string, batas = 50) {
  if (!/^\d{1,12}$/.test(teks(perkaraId, 20))) return [];
  return db.queryAll<Record<string, unknown>>(
    `SELECT id, perkara_id, nomor_perkara, sidang_id, urutan_sidang, tahap, hasil, jumlah_saksi, jumlah_jawaban, jumlah_hilang, ukuran, sidik, catatan, pengguna_nama, pada
       FROM aleta_saksi_kirim_bas WHERE perkara_id = ? ORDER BY pada DESC LIMIT ?`,
    [teks(perkaraId, 20), Math.min(Math.max(1, Math.trunc(batas) || 50), 200)]
  );
}

let bersihTerakhir = 0;
/** Menghapus catatan lebih tua dari retensi (paling sering sekali per 6 jam bila dipanggil dari catatKirimBas). */
export async function bersihkanKirimBasLawas(db: AletaDatabase, sekarang: Date = new Date()) {
  if (bersihTerakhir && sekarang.getTime() - bersihTerakhir < 6 * 3_600_000) return 0;
  bersihTerakhir = sekarang.getTime();
  const batas = new Date(sekarang.getTime() - RETENSI_HARI * 86_400_000).toISOString();
  const b = await db.queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS n FROM aleta_saksi_kirim_bas WHERE pada < ?`, [batas]);
  await db.run(`DELETE FROM aleta_saksi_kirim_bas WHERE pada < ?`, [batas]);
  return Number(b?.n) || 0;
}

/** Untuk uji. */
export function lupakanBersihTerakhir() {
  bersihTerakhir = 0;
}
