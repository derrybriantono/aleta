import type { AletaDatabase } from "@/server/db/client";
import { kunciNamaKuasa, nomorPerkaraBaku, pilihRegister, tanggalIso, tanggalTampil, type PilihanRegister, type RegisterKuasa } from "@/lib/register-kuasa";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * REGISTER KUASA HUKUM PER PERKARA (3 Nov 2026, migrasi 0132)
 * ============================================================================
 *
 *   GET  ?nomor=&nama=[&tanggal=]  register kuasa itu di perkara itu (+ pilihan menurut tanggal surat kuasa)
 *   POST {nomorPerkara, namaKuasa, pihakKe, pihakNama, tanggalSuratKuasa, nomorRegister, tanggalRegister}
 *
 * Nomor/tanggal register kuasa khusus tidak punya kolom di SIPP (skema SIPP tidak diubah), jadi disimpan
 * di tabel aleta_register_kuasa. Aturan: src/lib/register-kuasa.ts. Dipakai: borang kuasa SIPP di ekstensi
 * (isi otomatis) dan usulan isian ABT #8539# / #0132# (kalimat kuasa blangko). Tidak ada yang ditulis ke SIPP/ABT.
 */

export type BarisRegisterKuasa = RegisterKuasa & {
  id: string;
  namaKuasa: string;
  pihakKe: number;
  pihakNama: string;
  diubahAt: string;
};

type BarisDb = {
  id: string;
  nama_kuasa: string;
  pihak_ke: number | string;
  pihak_nama: string;
  tanggal_surat_kuasa: string;
  nomor_register: string;
  tanggal_register: string;
  diubah_at: string;
};

const NOMOR_PERKARA = /^\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6}$/;
const rapat = (t: unknown, maks = 200) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, maks);

function dariDb(b: BarisDb): BarisRegisterKuasa {
  return {
    id: b.id,
    namaKuasa: b.nama_kuasa,
    pihakKe: Number(b.pihak_ke) || 1,
    pihakNama: b.pihak_nama,
    tanggalSuratKuasa: b.tanggal_surat_kuasa || "",
    nomorRegister: b.nomor_register || "",
    tanggalRegister: b.tanggal_register || "",
    diubahAt: b.diubah_at,
  };
}

/** Semua register di perkara itu (urut paling lama dicatat -> paling baru); bila `nama` diisi, hanya kuasa itu. */
export async function bacaRegisterKuasa(db: AletaDatabase, nomorPerkara: string, nama?: string): Promise<BarisRegisterKuasa[]> {
  const nomor = nomorPerkaraBaku(nomorPerkara);
  if (!NOMOR_PERKARA.test(nomor)) return [];
  const kunci = nama ? kunciNamaKuasa(nama) : "";
  if (nama && !kunci) return [];
  const baris = kunci
    ? await db.queryAll<BarisDb>(
        "SELECT id, nama_kuasa, pihak_ke, pihak_nama, tanggal_surat_kuasa, nomor_register, tanggal_register, diubah_at FROM aleta_register_kuasa WHERE nomor_perkara = ? AND kunci_nama = ? ORDER BY diubah_at ASC, id ASC",
        [nomor, kunci]
      )
    : await db.queryAll<BarisDb>(
        "SELECT id, nama_kuasa, pihak_ke, pihak_nama, tanggal_surat_kuasa, nomor_register, tanggal_register, diubah_at FROM aleta_register_kuasa WHERE nomor_perkara = ? ORDER BY diubah_at ASC, id ASC",
        [nomor]
      );
  return baris.map(dariDb);
}

export type MasukanRegisterKuasa = {
  nomorPerkara: string;
  namaKuasa: string;
  pihakKe?: number;
  pihakNama?: string;
  tanggalSuratKuasa?: string;
  nomorRegister?: string;
  tanggalRegister?: string;
};

/**
 * Simpan (upsert) satu register: kuncinya (perkara, nama kuasa, tanggal surat kuasa). Nomor DAN tanggal register
 * kosong = tidak ada yang disimpan (tidak membuat baris kosong). Masukan tak sah ditolak 400 dengan pesan awam.
 */
export async function simpanRegisterKuasa(db: AletaDatabase, aktorId: string, masukan: MasukanRegisterKuasa) {
  const nomor = nomorPerkaraBaku(masukan.nomorPerkara);
  if (!NOMOR_PERKARA.test(nomor)) throw new ApiError(400, "Nomor perkara tidak terbaca.");
  const nama = rapat(masukan.namaKuasa, 200);
  const kunci = kunciNamaKuasa(nama);
  if (!kunci) throw new ApiError(400, "Nama kuasa tidak terbaca.");
  const nomorRegister = rapat(masukan.nomorRegister, 100);
  const tglRegisterMentah = rapat(masukan.tanggalRegister, 20);
  const tanggalRegister = tglRegisterMentah ? tanggalIso(tglRegisterMentah) : "";
  if (tglRegisterMentah && !tanggalRegister) throw new ApiError(400, "Tanggal register kuasa tidak sah. Tulis dengan bentuk tgl/bln/tahun.");
  const tglSuratMentah = rapat(masukan.tanggalSuratKuasa, 20);
  const tanggalSurat = tglSuratMentah ? tanggalIso(tglSuratMentah) : "";
  if (!nomorRegister && !tanggalRegister) return { disimpan: false as const, alasan: "kosong" as const };
  const pihakKe = Number(masukan.pihakKe) === 2 ? 2 : 1;
  const id = `${nomor}|${kunci}|${tanggalSurat}`;
  const sekarang = new Date().toISOString();
  await db.run(
    `INSERT INTO aleta_register_kuasa
       (id, nomor_perkara, kunci_nama, nama_kuasa, pihak_ke, pihak_nama, tanggal_surat_kuasa, nomor_register, tanggal_register, dibuat_oleh, dibuat_at, diubah_oleh, diubah_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nama_kuasa = excluded.nama_kuasa,
       pihak_ke = excluded.pihak_ke,
       pihak_nama = CASE WHEN excluded.pihak_nama = '' THEN aleta_register_kuasa.pihak_nama ELSE excluded.pihak_nama END,
       nomor_register = excluded.nomor_register,
       tanggal_register = excluded.tanggal_register,
       diubah_oleh = excluded.diubah_oleh,
       diubah_at = excluded.diubah_at`,
    [id, nomor, kunci, nama, pihakKe, rapat(masukan.pihakNama, 400), tanggalSurat, nomorRegister, tanggalRegister, aktorId, sekarang, aktorId, sekarang]
  );
  return { disimpan: true as const, id };
}

/** Pilihan untuk satu kuasa menurut tanggal surat kuasa di borang (aturan murni src/lib/register-kuasa.ts). */
export function pilihanUntuk(daftar: BarisRegisterKuasa[], tanggalSuratKuasa: string): PilihanRegister {
  return pilihRegister(daftar, tanggalSuratKuasa);
}

export type UsulanRegister = {
  kode: string;
  nama: string;
  nilai: string;
  keyakinan: "pasti" | "cukup" | "ragu" | "kosong";
  bentrok: "";
  sumber: Array<{ asal: "register-kuasa"; kalimat: string }>;
  catatan: string;
  /** Penanda untuk panel ABT: usulan dari register yang dicatat petugas mengalahkan dugaan dari kolom surat kuasa SIPP. */
  utama: true;
};

/**
 * Usulan isian ABT dari register kuasa PENGGUGAT/PEMOHON (pihak_ke 1): #8539# nomor register, #0132# tanggal register.
 * Beberapa register (kuasa ditambahkan pada tanggal berbeda): dipakai yang PERTAMA dicatat dan disebut dalam catatan.
 */
export function usulanRegisterKuasa(daftar: BarisRegisterKuasa[]): UsulanRegister[] {
  const p = daftar.filter((r) => r.pihakKe === 1 && (r.nomorRegister || r.tanggalRegister));
  if (!p.length) return [];
  const utama = p[0];
  const banyak = new Set(p.map((r) => `${r.nomorRegister}|${r.tanggalRegister}`)).size > 1;
  const catatan = banyak
    ? `Kuasa Penggugat punya ${p.length} register (kuasa ditambahkan pada tanggal berbeda): ${p.map((r) => `${r.nomorRegister || "-"} tgl ${tanggalTampil(r.tanggalRegister) || "-"}`).join("; ")}. Dipakai yang pertama - sesuaikan bila perlu.`
    : "";
  const sumber = [{ asal: "register-kuasa" as const, kalimat: `Register kuasa ${utama.namaKuasa}: ${utama.nomorRegister || "-"} tanggal ${tanggalTampil(utama.tanggalRegister) || "-"}` }];
  const hasil: UsulanRegister[] = [];
  if (utama.nomorRegister) {
    hasil.push({ kode: "8539", nama: "No. Register Kuasa Khusus Penggugat", nilai: utama.nomorRegister, keyakinan: banyak ? "cukup" : "pasti", bentrok: "", sumber, catatan, utama: true });
  }
  if (utama.tanggalRegister) {
    hasil.push({ kode: "0132", nama: "Tgl. Register Kuasa Khusus Penggugat", nilai: tanggalTampil(utama.tanggalRegister), keyakinan: banyak ? "cukup" : "pasti", bentrok: "", sumber, catatan, utama: true });
  }
  return hasil;
}
