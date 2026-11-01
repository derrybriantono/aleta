import { randomUUID } from "node:crypto";

import {
  BATAS_INSTRUKSI_KARAKTER,
  BATAS_MEMORI_KARAKTER,
  BATAS_TOTAL_MEMORI_KARAKTER,
  type AksesProyek,
  type BerkasPengetahuan,
  type MemoriProyek,
  type PilihanProyek,
} from "@/lib/aleta-ai/proyek-kelola";
import type { AletaDatabase } from "@/server/db/client";
import { withTransaction } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { ekstrakTeksBerkas, jenisPengetahuanDariNama, rapikanTeks } from "@/server/modules/aleta-ai/ekstrak-teks";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { bacaDaftarZip } from "@/server/modules/aleta-ai/zip-baca";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - PROYEK KELOLAAN SUPER ADMIN (instruksi, pengetahuan, memori)
 * ============================================================================
 *
 * HAK (keputusan 72, ralat): membuat, menyunting, menghapus proyek, berkas, dan memori,
 * serta MEMBACA isinya, hanya Super Admin - dijaga di rute (wajibSuperAdmin) DAN di sini
 * (setiap fungsi tulis/baca-isi menerima `PelakuAi` dan menolak bila bukan Super Admin).
 * Pengguna lain hanya MEMILIH proyek yang diizinkan (daftarPilihan: nama + deskripsi) saat
 * bertanya; isi proyek hanya dibaca server saat menyusun prompt.
 *
 * Proyek bawaan satker (ZIP V4.5, proyek.ts) tidak berubah. Proyek ini MENAMBAH:
 *   sertakan_bawaan = 1 -> Core Prompt + modul V4.5 tetap ikut, proyek menambah instruksi, memori, pengetahuan;
 *   sertakan_bawaan = 0 -> instruksi proyek menggantikan Core Prompt, tanpa modul V4.5.
 */

const teks = (n: unknown) => String(n ?? "").trim();
const sekarangIso = () => new Date().toISOString();

export const BATAS_NAMA_PROYEK = 80;
export const BATAS_DESKRIPSI_PROYEK = 300;
export const BATAS_BERKAS_PER_PROYEK = 300;
export const BATAS_TOTAL_UKURAN_PROYEK = 150 * 1024 * 1024;
export const BATAS_USULAN_MENUNGGU = 30;
export const BATAS_MEMORI_PER_PROYEK = 200;
export const BATAS_ZIP_IMPOR = 40 * 1024 * 1024;

function wajibSuper(pelaku: PelakuAi): void {
  if (!pelaku.superAdmin) throw new ApiError(403, "Hanya Super Admin yang dapat mengelola proyek ALETA Ai.");
}

// ----------------------------------------------------------------------------
// Baris & bentuk
// ----------------------------------------------------------------------------

type BarisProyek = {
  id: string;
  nama: string;
  deskripsi: string;
  instruksi: string;
  sertakan_bawaan: number | string;
  akses: string;
  akses_peran: string;
  akses_pengguna: string;
  memori_aktif: number | string;
  aktif: number | string;
  versi: number | string;
  dibuat_oleh: string;
  dibuat_at: string;
  diubah_at: string;
};

const daftarDariKoma = (s: string): string[] => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const jadiKoma = (a: unknown): string => [...new Set((Array.isArray(a) ? a : []).map((x) => teks(x).replace(/,/g, "")).filter(Boolean))].join(",");
const modeAkses = (s: unknown): AksesProyek => (s === "peran" || s === "pengguna" ? s : "semua");

export type RingkasProyekKelola = {
  id: string;
  nama: string;
  deskripsi: string;
  sertakanBawaan: boolean;
  akses: AksesProyek;
  aksesPeran: string[];
  aksesPengguna: string[];
  memoriAktif: boolean;
  aktif: boolean;
  versi: number;
  jumlahBerkas: number;
  jumlahMemori: number;
  jumlahUsulan: number;
  diubah: string;
};

function ringkasDari(b: BarisProyek, hitung: { berkas: number; memori: number; usulan: number }): RingkasProyekKelola {
  return {
    id: b.id,
    nama: b.nama,
    deskripsi: b.deskripsi,
    sertakanBawaan: Number(b.sertakan_bawaan) === 1,
    akses: modeAkses(b.akses),
    aksesPeran: daftarDariKoma(b.akses_peran),
    aksesPengguna: daftarDariKoma(b.akses_pengguna),
    memoriAktif: Number(b.memori_aktif) === 1,
    aktif: Number(b.aktif) === 1,
    versi: Number(b.versi),
    jumlahBerkas: hitung.berkas,
    jumlahMemori: hitung.memori,
    jumlahUsulan: hitung.usulan,
    diubah: b.diubah_at,
  };
}

async function hitungan(db: AletaDatabase, id: string) {
  const [berkas, memori, usulan] = await Promise.all([
    db.queryOne<{ n: number | string }>(`SELECT COUNT(*) AS n FROM aleta_ai_pengetahuan WHERE proyek_id = ?`, [id]),
    db.queryOne<{ n: number | string }>(`SELECT COUNT(*) AS n FROM aleta_ai_memori_proyek WHERE proyek_id = ? AND status = 'disetujui'`, [id]),
    db.queryOne<{ n: number | string }>(`SELECT COUNT(*) AS n FROM aleta_ai_memori_proyek WHERE proyek_id = ? AND status = 'usulan'`, [id]),
  ]);
  return { berkas: Number(berkas?.n ?? 0), memori: Number(memori?.n ?? 0), usulan: Number(usulan?.n ?? 0) };
}

async function ambilBaris(db: AletaDatabase, id: string): Promise<BarisProyek> {
  const b = await db.queryOne<BarisProyek>(`SELECT * FROM aleta_ai_proyek_kelola WHERE id = ?`, [teks(id)]);
  if (!b) throw new ApiError(404, "Proyek tidak ditemukan.");
  return b;
}

async function catat(db: AletaDatabase, proyekId: string, aksi: string, ringkas: string, oleh: string) {
  await db.run(`INSERT INTO aleta_ai_proyek_catatan (id, proyek_id, aksi, ringkas, oleh, waktu) VALUES (?, ?, ?, ?, ?, ?)`, [`aipc-${randomUUID()}`, proyekId, aksi, ringkas.slice(0, 300), oleh, sekarangIso()]);
}

/** Menandai proyek berubah (membuat cache pemakaian basi) dan menaikkan versi. */
async function sentuh(db: AletaDatabase, proyekId: string) {
  await db.run(`UPDATE aleta_ai_proyek_kelola SET versi = versi + 1, diubah_at = ? WHERE id = ?`, [sekarangIso(), proyekId]);
  cachePakai.delete(proyekId);
}

// ----------------------------------------------------------------------------
// Proyek: daftar, rincian, buat, ubah, hapus (Super Admin)
// ----------------------------------------------------------------------------

export async function daftarProyekKelola(db: AletaDatabase, pelaku: PelakuAi): Promise<RingkasProyekKelola[]> {
  wajibSuper(pelaku);
  const baris = await db.queryAll<BarisProyek>(`SELECT * FROM aleta_ai_proyek_kelola ORDER BY nama`);
  const hasil: RingkasProyekKelola[] = [];
  for (const b of baris) hasil.push(ringkasDari(b, await hitungan(db, b.id)));
  return hasil;
}

export type BerkasRingkas = { id: string; nama: string; jenis: string; ukuran: number; karakter: number; selalu: boolean; diubah: string };
export type MemoriTampil = { id: string; isi: string; status: "disetujui" | "usulan"; sumber: string; dibuat: string; diputuskanOleh: string };

async function daftarBerkas(db: AletaDatabase, proyekId: string): Promise<BerkasRingkas[]> {
  const baris = await db.queryAll<{ id: string; nama: string; jenis: string; ukuran: number | string; karakter: number | string; selalu: number | string; diubah_at: string }>(
    `SELECT id, nama, jenis, ukuran, karakter, selalu, diubah_at FROM aleta_ai_pengetahuan WHERE proyek_id = ? ORDER BY nama`,
    [proyekId]
  );
  return baris.map((b) => ({ id: b.id, nama: b.nama, jenis: b.jenis, ukuran: Number(b.ukuran), karakter: Number(b.karakter), selalu: Number(b.selalu) === 1, diubah: b.diubah_at }));
}

async function daftarMemoriSemua(db: AletaDatabase, proyekId: string): Promise<MemoriTampil[]> {
  const baris = await db.queryAll<{ id: string; isi: string; status: string; sumber: string; dibuat_at: string; diputuskan_oleh: string }>(
    `SELECT id, isi, status, sumber, dibuat_at, diputuskan_oleh FROM aleta_ai_memori_proyek WHERE proyek_id = ? ORDER BY dibuat_at, id`,
    [proyekId]
  );
  return baris.map((b) => ({ id: b.id, isi: b.isi, status: b.status === "usulan" ? "usulan" : "disetujui", sumber: b.sumber, dibuat: b.dibuat_at, diputuskanOleh: b.diputuskan_oleh }));
}

export async function rincianProyekKelola(db: AletaDatabase, pelaku: PelakuAi, id: string) {
  wajibSuper(pelaku);
  const b = await ambilBaris(db, id);
  const riwayat = await db.queryAll<{ aksi: string; ringkas: string; oleh: string; waktu: string }>(
    `SELECT aksi, ringkas, oleh, waktu FROM aleta_ai_proyek_catatan WHERE proyek_id = ? ORDER BY waktu DESC, id DESC LIMIT 60`,
    [b.id]
  );
  return {
    ...ringkasDari(b, await hitungan(db, b.id)),
    instruksi: b.instruksi,
    berkas: await daftarBerkas(db, b.id),
    memori: await daftarMemoriSemua(db, b.id),
    riwayat,
  };
}

export type MasukanProyek = {
  nama?: unknown;
  deskripsi?: unknown;
  instruksi?: unknown;
  sertakanBawaan?: unknown;
  akses?: unknown;
  aksesPeran?: unknown;
  aksesPengguna?: unknown;
  memoriAktif?: unknown;
  aktif?: unknown;
};

function periksaNama(nama: string) {
  if (!nama) throw new ApiError(400, "Nama proyek wajib diisi.");
  if (nama.length > BATAS_NAMA_PROYEK) throw new ApiError(400, `Nama proyek maksimal ${BATAS_NAMA_PROYEK} karakter.`);
}

async function pastikanNamaBebas(db: AletaDatabase, nama: string, kecualiId = "") {
  const ada = await db.queryAll<{ id: string; nama: string }>(`SELECT id, nama FROM aleta_ai_proyek_kelola`);
  if (ada.some((p) => p.id !== kecualiId && p.nama.trim().toLowerCase() === nama.toLowerCase())) throw new ApiError(409, "Sudah ada proyek dengan nama itu.");
}

export async function buatProyekKelola(db: AletaDatabase, pelaku: PelakuAi, m: MasukanProyek): Promise<RingkasProyekKelola> {
  wajibSuper(pelaku);
  const nama = teks(m.nama);
  periksaNama(nama);
  await pastikanNamaBebas(db, nama);
  const instruksi = String(m.instruksi ?? "").trim();
  if (instruksi.length > BATAS_INSTRUKSI_KARAKTER) throw new ApiError(400, `Instruksi maksimal ${BATAS_INSTRUKSI_KARAKTER.toLocaleString("id-ID")} karakter.`);
  const id = `aipk-${randomUUID()}`;
  const sekarang = sekarangIso();
  await db.run(
    `INSERT INTO aleta_ai_proyek_kelola (id, nama, deskripsi, instruksi, sertakan_bawaan, akses, akses_peran, akses_pengguna, memori_aktif, aktif, versi, dibuat_oleh, dibuat_at, diubah_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`,
    [
      id,
      nama,
      teks(m.deskripsi).slice(0, BATAS_DESKRIPSI_PROYEK),
      instruksi,
      m.sertakanBawaan === false ? 0 : 1,
      modeAkses(m.akses),
      jadiKoma(m.aksesPeran),
      jadiKoma(m.aksesPengguna),
      m.memoriAktif === false ? 0 : 1,
      pelaku.id,
      sekarang,
      sekarang,
    ]
  );
  await catat(db, id, "buat", `Proyek dibuat: ${nama}`, pelaku.id);
  await catatJejak(db, { penggunaId: pelaku.id, peranId: pelaku.peranId, aksi: "proyek-kelola.buat", hasil: "ok", ringkas: nama });
  return ringkasDari(await ambilBaris(db, id), { berkas: 0, memori: 0, usulan: 0 });
}

export async function ubahProyekKelola(db: AletaDatabase, pelaku: PelakuAi, id: string, m: MasukanProyek): Promise<RingkasProyekKelola> {
  wajibSuper(pelaku);
  const b = await ambilBaris(db, id);
  const bagian: string[] = [];
  const nilai: Array<string | number> = [];
  const ubah: string[] = [];
  if (m.nama !== undefined) {
    const nama = teks(m.nama);
    periksaNama(nama);
    await pastikanNamaBebas(db, nama, b.id);
    bagian.push("nama = ?");
    nilai.push(nama);
    ubah.push("nama");
  }
  if (m.deskripsi !== undefined) {
    bagian.push("deskripsi = ?");
    nilai.push(teks(m.deskripsi).slice(0, BATAS_DESKRIPSI_PROYEK));
    ubah.push("deskripsi");
  }
  if (m.instruksi !== undefined) {
    const instruksi = String(m.instruksi ?? "").trim();
    if (instruksi.length > BATAS_INSTRUKSI_KARAKTER) throw new ApiError(400, `Instruksi maksimal ${BATAS_INSTRUKSI_KARAKTER.toLocaleString("id-ID")} karakter.`);
    bagian.push("instruksi = ?");
    nilai.push(instruksi);
    ubah.push("instruksi");
  }
  if (m.sertakanBawaan !== undefined) {
    bagian.push("sertakan_bawaan = ?");
    nilai.push(m.sertakanBawaan === false ? 0 : 1);
    ubah.push("proyek bawaan");
  }
  if (m.akses !== undefined || m.aksesPeran !== undefined || m.aksesPengguna !== undefined) {
    bagian.push("akses = ?", "akses_peran = ?", "akses_pengguna = ?");
    nilai.push(m.akses !== undefined ? modeAkses(m.akses) : modeAkses(b.akses), m.aksesPeran !== undefined ? jadiKoma(m.aksesPeran) : b.akses_peran, m.aksesPengguna !== undefined ? jadiKoma(m.aksesPengguna) : b.akses_pengguna);
    ubah.push("hak pakai");
  }
  if (m.memoriAktif !== undefined) {
    bagian.push("memori_aktif = ?");
    nilai.push(m.memoriAktif === false ? 0 : 1);
    ubah.push("usulan memori");
  }
  if (m.aktif !== undefined) {
    bagian.push("aktif = ?");
    nilai.push(m.aktif === false ? 0 : 1);
    ubah.push(m.aktif === false ? "dinonaktifkan" : "diaktifkan");
  }
  if (bagian.length) {
    await db.run(`UPDATE aleta_ai_proyek_kelola SET ${bagian.join(", ")} WHERE id = ?`, [...nilai, b.id]);
    await sentuh(db, b.id);
    await catat(db, b.id, "ubah", `Diubah: ${ubah.join(", ")}`, pelaku.id);
  }
  return ringkasDari(await ambilBaris(db, b.id), await hitungan(db, b.id));
}

export async function hapusProyekKelola(db: AletaDatabase, pelaku: PelakuAi, id: string): Promise<void> {
  wajibSuper(pelaku);
  const b = await ambilBaris(db, id);
  await withTransaction(db, async (tx) => {
    await tx.run(`DELETE FROM aleta_ai_pengetahuan WHERE proyek_id = ?`, [b.id]);
    await tx.run(`DELETE FROM aleta_ai_memori_proyek WHERE proyek_id = ?`, [b.id]);
    await tx.run(`DELETE FROM aleta_ai_proyek_pilihan WHERE proyek_id = ?`, [b.id]);
    await tx.run(`DELETE FROM aleta_ai_proyek_kelola WHERE id = ?`, [b.id]);
  });
  cachePakai.delete(b.id);
  await catat(db, b.id, "hapus", `Proyek dihapus: ${b.nama}`, pelaku.id);
  await catatJejak(db, { penggunaId: pelaku.id, peranId: pelaku.peranId, aksi: "proyek-kelola.hapus", hasil: "ok", ringkas: b.nama });
}

// ----------------------------------------------------------------------------
// Berkas pengetahuan (Super Admin)
// ----------------------------------------------------------------------------

function namaBerkasAman(nama: string): string {
  return teks(nama).replace(/[\\/]+/g, "_").replace(/[\u0000-\u001f]/g, "").slice(0, 160);
}

export type HasilBerkas = { berkas: BerkasRingkas; diganti: boolean; peringatan: string[] };

async function simpanBerkas(
  db: AletaDatabase,
  pelaku: PelakuAi,
  proyekId: string,
  masukan: { nama: string; jenis: string; ukuran: number; teks: string; selalu?: boolean; peringatan?: string[] },
  opsi: { tanpaSentuh?: boolean } = {}
): Promise<HasilBerkas> {
  const nama = namaBerkasAman(masukan.nama);
  if (!nama) throw new ApiError(400, "Nama berkas kosong.");
  const ada = await db.queryAll<{ id: string; nama: string; selalu: number | string }>(`SELECT id, nama, selalu FROM aleta_ai_pengetahuan WHERE proyek_id = ?`, [proyekId]);
  const sama = ada.find((x) => x.nama.toLowerCase() === nama.toLowerCase());
  if (!sama && ada.length >= BATAS_BERKAS_PER_PROYEK) throw new ApiError(400, `Satu proyek maksimal ${BATAS_BERKAS_PER_PROYEK} berkas.`);
  const total = await db.queryOne<{ n: number | string | null }>(`SELECT COALESCE(SUM(ukuran), 0) AS n FROM aleta_ai_pengetahuan WHERE proyek_id = ?`, [proyekId]);
  if (Number(total?.n ?? 0) + masukan.ukuran > BATAS_TOTAL_UKURAN_PROYEK) throw new ApiError(413, "Total ukuran berkas proyek melampaui batas. Hapus berkas yang tidak dipakai.");
  const sekarang = sekarangIso();
  let id: string;
  if (sama) {
    id = sama.id;
    await db.run(`UPDATE aleta_ai_pengetahuan SET jenis = ?, ukuran = ?, karakter = ?, teks = ?, selalu = ?, diubah_at = ? WHERE id = ?`, [masukan.jenis, masukan.ukuran, masukan.teks.length, masukan.teks, masukan.selalu === undefined ? Number(sama.selalu) : masukan.selalu ? 1 : 0, sekarang, id]);
  } else {
    id = `aipp-${randomUUID()}`;
    await db.run(`INSERT INTO aleta_ai_pengetahuan (id, proyek_id, nama, jenis, ukuran, karakter, teks, selalu, dibuat_at, diubah_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, proyekId, nama, masukan.jenis, masukan.ukuran, masukan.teks.length, masukan.teks, masukan.selalu ? 1 : 0, sekarang, sekarang]);
  }
  if (!opsi.tanpaSentuh) {
    await sentuh(db, proyekId);
    await catat(db, proyekId, sama ? "berkas-ganti" : "berkas-tambah", `${nama} (${masukan.teks.length.toLocaleString("id-ID")} karakter)`, pelaku.id);
  }
  const daftar = await daftarBerkas(db, proyekId);
  return { berkas: daftar.find((x) => x.id === id) as BerkasRingkas, diganti: Boolean(sama), peringatan: masukan.peringatan ?? [] };
}

/** Menambah satu berkas (PDF, Word, RTF, Markdown, teks). Nama sama = berkas diganti isinya. */
export async function tambahBerkasPengetahuan(db: AletaDatabase, pelaku: PelakuAi, proyekId: string, masukan: { nama: string; bita: Buffer; selalu?: boolean }): Promise<HasilBerkas> {
  wajibSuper(pelaku);
  const p = await ambilBaris(db, proyekId);
  const hasil = await ekstrakTeksBerkas(masukan.nama, masukan.bita);
  return simpanBerkas(db, pelaku, p.id, { nama: masukan.nama, jenis: hasil.jenis, ukuran: masukan.bita.length, teks: hasil.teks, selalu: masukan.selalu, peringatan: hasil.peringatan });
}

export async function bacaBerkasPengetahuan(db: AletaDatabase, pelaku: PelakuAi, proyekId: string, berkasId: string) {
  wajibSuper(pelaku);
  const b = await db.queryOne<{ id: string; nama: string; jenis: string; ukuran: number | string; teks: string; selalu: number | string; diubah_at: string }>(
    `SELECT id, nama, jenis, ukuran, teks, selalu, diubah_at FROM aleta_ai_pengetahuan WHERE id = ? AND proyek_id = ?`,
    [teks(berkasId), teks(proyekId)]
  );
  if (!b) throw new ApiError(404, "Berkas tidak ditemukan.");
  return { id: b.id, nama: b.nama, jenis: b.jenis, ukuran: Number(b.ukuran), teks: b.teks, selalu: Number(b.selalu) === 1, diubah: b.diubah_at };
}

export async function ubahBerkasPengetahuan(db: AletaDatabase, pelaku: PelakuAi, proyekId: string, berkasId: string, m: { nama?: unknown; teks?: unknown; selalu?: unknown }): Promise<BerkasRingkas> {
  wajibSuper(pelaku);
  const lama = await bacaBerkasPengetahuan(db, pelaku, proyekId, berkasId);
  const bagian: string[] = [];
  const nilai: Array<string | number> = [];
  if (m.nama !== undefined) {
    const nama = namaBerkasAman(String(m.nama));
    if (!nama) throw new ApiError(400, "Nama berkas kosong.");
    const kembar = await db.queryAll<{ id: string; nama: string }>(`SELECT id, nama FROM aleta_ai_pengetahuan WHERE proyek_id = ?`, [proyekId]);
    if (kembar.some((x) => x.id !== lama.id && x.nama.toLowerCase() === nama.toLowerCase())) throw new ApiError(409, "Sudah ada berkas dengan nama itu di proyek ini.");
    bagian.push("nama = ?");
    nilai.push(nama);
  }
  if (m.teks !== undefined) {
    const t = rapikanTeks(String(m.teks));
    if (!t) throw new ApiError(400, "Isi berkas tidak boleh kosong; hapus berkasnya bila tidak dipakai.");
    bagian.push("teks = ?", "ukuran = ?", "karakter = ?");
    nilai.push(t, Buffer.byteLength(t, "utf8"), t.length);
  }
  if (m.selalu !== undefined) {
    bagian.push("selalu = ?");
    nilai.push(m.selalu ? 1 : 0);
  }
  if (bagian.length) {
    bagian.push("diubah_at = ?");
    nilai.push(sekarangIso());
    await db.run(`UPDATE aleta_ai_pengetahuan SET ${bagian.join(", ")} WHERE id = ?`, [...nilai, lama.id]);
    await sentuh(db, proyekId);
    await catat(db, proyekId, "berkas-ubah", lama.nama, pelaku.id);
  }
  return (await daftarBerkas(db, proyekId)).find((x) => x.id === lama.id) as BerkasRingkas;
}

export async function hapusBerkasPengetahuan(db: AletaDatabase, pelaku: PelakuAi, proyekId: string, berkasId: string): Promise<void> {
  wajibSuper(pelaku);
  const lama = await bacaBerkasPengetahuan(db, pelaku, proyekId, berkasId);
  await db.run(`DELETE FROM aleta_ai_pengetahuan WHERE id = ? AND proyek_id = ?`, [lama.id, proyekId]);
  await sentuh(db, proyekId);
  await catat(db, proyekId, "berkas-hapus", lama.nama, pelaku.id);
}

// ----------------------------------------------------------------------------
// Impor ZIP berformat proyek V4.5 (Core Prompt + modul ALETA_NN_*.md + berkas lain)
// ----------------------------------------------------------------------------

export type HasilImpor = { proyek: RingkasProyekKelola; jumlahBerkas: number; dilewati: string[]; peringatan: string[] };

/**
 * ZIP berformat sama dengan proyek V4.5: `*_Core_Prompt.md` menjadi instruksi (dan proyek BERDIRI SENDIRI,
 * tanpa proyek bawaan); modul ALETA_NN_*.md serta berkas lain yang terbaca (md, txt, pdf, docx, rtf) menjadi
 * berkas pengetahuan. Berkas lain (gambar, skrip, HTML) dilewati dan disebut. Dengan `proyekId`, isi ZIP
 * ditambahkan ke proyek yang ada (instruksi tidak ditimpa bila sudah terisi).
 */
export async function imporZipProyek(db: AletaDatabase, pelaku: PelakuAi, masukan: { bita: Buffer; namaBerkas: string; nama?: string; proyekId?: string }): Promise<HasilImpor> {
  wajibSuper(pelaku);
  if (!masukan.bita.length) throw new ApiError(400, "Berkas kosong.");
  if (masukan.bita.length > BATAS_ZIP_IMPOR) throw new ApiError(413, `Ukuran ZIP melampaui ${BATAS_ZIP_IMPOR / 1024 / 1024} MB.`);
  const entri = bacaDaftarZip(masukan.bita).filter((e) => !e.direktori && !e.nama.startsWith("__MACOSX/") && !(e.nama.split("/").pop() ?? "").startsWith("."));
  if (!entri.length) throw new ApiError(400, "ZIP kosong.");
  const pertama = entri[0]?.nama.split("/")[0] ?? "";
  const awalan = entri.every((e) => e.nama.includes("/") && e.nama.split("/")[0] === pertama) ? `${pertama}/` : "";
  const relatif = (n: string) => (awalan && n.startsWith(awalan) ? n.slice(awalan.length) : n);

  let core: { nama: string; isi: string } | null = null;
  const bacaan: Array<{ nama: string; bita: Buffer }> = [];
  const dilewati: string[] = [];
  const peringatan: string[] = [];
  for (const e of entri) {
    const rel = relatif(e.nama);
    const dasar = rel.split("/").pop() ?? rel;
    if (!rel.includes("/") && /core[_ -]?prompt\.md$/i.test(dasar)) {
      const isi = e.baca(3 * 1024 * 1024).toString("utf8").replace(/^﻿/, "");
      if (!core || isi.length > core.isi.length) core = { nama: dasar, isi };
      continue;
    }
    if (!jenisPengetahuanDariNama(dasar)) {
      dilewati.push(rel.slice(0, 120));
      continue;
    }
    try {
      bacaan.push({ nama: rel.replace(/\//g, " - "), bita: e.baca(15 * 1024 * 1024) });
    } catch {
      dilewati.push(`${rel.slice(0, 100)} (terlalu besar atau rusak)`);
    }
  }

  let proyek: RingkasProyekKelola;
  if (masukan.proyekId) {
    const b = await ambilBaris(db, masukan.proyekId);
    if (core && !b.instruksi.trim()) await ubahProyekKelola(db, pelaku, b.id, { instruksi: core.isi });
    else if (core) peringatan.push("Proyek sudah memiliki instruksi; Core Prompt di ZIP tidak menimpanya (disimpan sebagai berkas pengetahuan).");
    if (core && b.instruksi.trim()) bacaan.push({ nama: core.nama, bita: Buffer.from(core.isi, "utf8") });
    proyek = ringkasDari(await ambilBaris(db, b.id), await hitungan(db, b.id));
  } else {
    if (!core) throw new ApiError(400, "ZIP tidak memuat Core Prompt (berkas *_Core_Prompt.md di folder paling atas).");
    const dasarNama = teks(masukan.nama) || masukan.namaBerkas.replace(/\.zip$/i, "").replace(/[_]+/g, " ").trim() || "Proyek impor";
    let nama = dasarNama.slice(0, BATAS_NAMA_PROYEK);
    const ada = await db.queryAll<{ nama: string }>(`SELECT nama FROM aleta_ai_proyek_kelola`);
    for (let n = 2; ada.some((x) => x.nama.toLowerCase() === nama.toLowerCase()); n += 1) nama = `${dasarNama.slice(0, BATAS_NAMA_PROYEK - 6)} (${n})`;
    proyek = await buatProyekKelola(db, pelaku, { nama, deskripsi: `Diimpor dari ${masukan.namaBerkas}`.slice(0, BATAS_DESKRIPSI_PROYEK), instruksi: core.isi, sertakanBawaan: false, akses: "semua" });
  }

  let jumlah = 0;
  for (const b of bacaan) {
    try {
      const hasil = await ekstrakTeksBerkas(b.nama, b.bita);
      await simpanBerkas(db, pelaku, proyek.id, { nama: b.nama, jenis: hasil.jenis, ukuran: b.bita.length, teks: hasil.teks, peringatan: hasil.peringatan }, { tanpaSentuh: true });
      jumlah += 1;
      peringatan.push(...hasil.peringatan.map((x) => `${b.nama}: ${x}`));
    } catch (e) {
      dilewati.push(`${b.nama.slice(0, 100)} (${e instanceof ApiError ? e.message.slice(0, 120) : "tidak terbaca"})`);
    }
  }
  await sentuh(db, proyek.id);
  await catat(db, proyek.id, "impor-zip", `${masukan.namaBerkas.slice(0, 80)}: ${jumlah} berkas, ${dilewati.length} dilewati`, pelaku.id);
  await catatJejak(db, { penggunaId: pelaku.id, peranId: pelaku.peranId, aksi: "proyek-kelola.impor", hasil: "ok", ringkas: `${proyek.nama}: ${jumlah} berkas` });
  if (dilewati.length) peringatan.push(`${dilewati.length} berkas dilewati.`);
  return { proyek: ringkasDari(await ambilBaris(db, proyek.id), await hitungan(db, proyek.id)), jumlahBerkas: jumlah, dilewati, peringatan };
}

// ----------------------------------------------------------------------------
// Memori (baca-ubah-hapus hanya Super Admin; usulan AI masuk dulu sebagai "usulan")
// ----------------------------------------------------------------------------

export async function daftarMemoriProyek(db: AletaDatabase, pelaku: PelakuAi, proyekId: string): Promise<MemoriTampil[]> {
  wajibSuper(pelaku);
  const p = await ambilBaris(db, proyekId);
  return daftarMemoriSemua(db, p.id);
}

function periksaIsiMemori(isi: unknown): string {
  const t = String(isi ?? "").replace(/\s+/g, " ").trim();
  if (t.length < 4) throw new ApiError(400, "Isi memori terlalu pendek.");
  if (t.length > BATAS_MEMORI_KARAKTER) throw new ApiError(400, `Satu memori maksimal ${BATAS_MEMORI_KARAKTER} karakter.`);
  return t;
}

async function pastikanMuatMemori(db: AletaDatabase, proyekId: string, tambahan: number, kecualiId = "") {
  const baris = await db.queryAll<{ id: string; isi: string }>(`SELECT id, isi FROM aleta_ai_memori_proyek WHERE proyek_id = ? AND status = 'disetujui'`, [proyekId]);
  const isi = baris.filter((b) => b.id !== kecualiId);
  if (isi.length >= BATAS_MEMORI_PER_PROYEK) throw new ApiError(400, `Satu proyek maksimal ${BATAS_MEMORI_PER_PROYEK} memori.`);
  if (isi.reduce((n, b) => n + b.isi.length, 0) + tambahan > BATAS_TOTAL_MEMORI_KARAKTER) throw new ApiError(400, "Total memori proyek terlalu besar; rapikan atau hapus memori lama.");
}

export async function tambahMemoriProyek(db: AletaDatabase, pelaku: PelakuAi, proyekId: string, isi: unknown): Promise<MemoriTampil> {
  wajibSuper(pelaku);
  const p = await ambilBaris(db, proyekId);
  const t = periksaIsiMemori(isi);
  await pastikanMuatMemori(db, p.id, t.length);
  const id = `aipm-${randomUUID()}`;
  const sekarang = sekarangIso();
  await db.run(`INSERT INTO aleta_ai_memori_proyek (id, proyek_id, isi, status, sumber, dibuat_at, diputuskan_oleh, diputuskan_at) VALUES (?, ?, ?, 'disetujui', 'super-admin', ?, ?, ?)`, [id, p.id, t, sekarang, pelaku.id, sekarang]);
  await sentuh(db, p.id);
  await catat(db, p.id, "memori-tambah", t.slice(0, 120), pelaku.id);
  return (await daftarMemoriSemua(db, p.id)).find((m) => m.id === id) as MemoriTampil;
}

async function ambilMemori(db: AletaDatabase, proyekId: string, memoriId: string) {
  const m = await db.queryOne<{ id: string; isi: string; status: string }>(`SELECT id, isi, status FROM aleta_ai_memori_proyek WHERE id = ? AND proyek_id = ?`, [teks(memoriId), teks(proyekId)]);
  if (!m) throw new ApiError(404, "Memori tidak ditemukan.");
  return m;
}

export async function ubahMemoriProyek(db: AletaDatabase, pelaku: PelakuAi, proyekId: string, memoriId: string, isi: unknown): Promise<MemoriTampil> {
  wajibSuper(pelaku);
  const m = await ambilMemori(db, proyekId, memoriId);
  const t = periksaIsiMemori(isi);
  if (m.status === "disetujui") await pastikanMuatMemori(db, proyekId, t.length, m.id);
  await db.run(`UPDATE aleta_ai_memori_proyek SET isi = ? WHERE id = ?`, [t, m.id]);
  await sentuh(db, proyekId);
  await catat(db, proyekId, "memori-ubah", t.slice(0, 120), pelaku.id);
  return (await daftarMemoriSemua(db, proyekId)).find((x) => x.id === m.id) as MemoriTampil;
}

/** Usulan dari ALETA Ai: setuju -> menjadi memori yang ikut ke prompt; tolak -> dihapus. */
export async function putuskanUsulanMemori(db: AletaDatabase, pelaku: PelakuAi, proyekId: string, memoriId: string, setuju: boolean): Promise<void> {
  wajibSuper(pelaku);
  const m = await ambilMemori(db, proyekId, memoriId);
  if (m.status !== "usulan") throw new ApiError(409, "Memori ini bukan usulan.");
  if (setuju) {
    await pastikanMuatMemori(db, proyekId, m.isi.length);
    await db.run(`UPDATE aleta_ai_memori_proyek SET status = 'disetujui', diputuskan_oleh = ?, diputuskan_at = ? WHERE id = ?`, [pelaku.id, sekarangIso(), m.id]);
  } else {
    await db.run(`DELETE FROM aleta_ai_memori_proyek WHERE id = ?`, [m.id]);
  }
  await sentuh(db, proyekId);
  await catat(db, proyekId, setuju ? "memori-setuju" : "memori-tolak", m.isi.slice(0, 120), pelaku.id);
}

export async function hapusMemoriProyek(db: AletaDatabase, pelaku: PelakuAi, proyekId: string, memoriId: string): Promise<void> {
  wajibSuper(pelaku);
  const m = await ambilMemori(db, proyekId, memoriId);
  await db.run(`DELETE FROM aleta_ai_memori_proyek WHERE id = ?`, [m.id]);
  await sentuh(db, proyekId);
  await catat(db, proyekId, "memori-hapus", m.isi.slice(0, 120), pelaku.id);
}

/**
 * Dipanggil mesin (bukan pengguna): menyimpan usulan memori dari jawaban ALETA Ai sebagai "usulan".
 * Tidak mengubah apa pun yang ikut ke prompt sampai Super Admin menyetujui. Mengembalikan jumlah usulan baru.
 */
export async function simpanUsulanMemori(db: AletaDatabase, proyekId: string, daftar: readonly string[]): Promise<number> {
  const p = await db.queryOne<BarisProyek>(`SELECT * FROM aleta_ai_proyek_kelola WHERE id = ?`, [teks(proyekId)]);
  if (!p || Number(p.memori_aktif) !== 1 || !daftar.length) return 0;
  const ada = await db.queryAll<{ isi: string; status: string }>(`SELECT isi, status FROM aleta_ai_memori_proyek WHERE proyek_id = ?`, [p.id]);
  const menunggu = ada.filter((x) => x.status === "usulan").length;
  const kunci = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const sudah = new Set(ada.map((x) => kunci(x.isi)));
  let baru = 0;
  for (const d of daftar) {
    const t = String(d).replace(/\s+/g, " ").trim().slice(0, BATAS_MEMORI_KARAKTER);
    if (t.length < 8 || sudah.has(kunci(t)) || menunggu + baru >= BATAS_USULAN_MENUNGGU) continue;
    await db.run(`INSERT INTO aleta_ai_memori_proyek (id, proyek_id, isi, status, sumber, dibuat_at, diputuskan_oleh, diputuskan_at) VALUES (?, ?, ?, 'usulan', 'usulan-ai', ?, '', '')`, [`aipm-${randomUUID()}`, p.id, t, sekarangIso()]);
    sudah.add(kunci(t));
    baru += 1;
  }
  if (baru) await catat(db, p.id, "memori-usulan", `${baru} usulan baru dari ALETA Ai`, "");
  return baru;
}

// ----------------------------------------------------------------------------
// Hak pakai & pilihan (semua pengguna: hanya nama + deskripsi)
// ----------------------------------------------------------------------------

export function bolehPakaiProyek(p: Pick<BarisProyek, "akses" | "akses_peran" | "akses_pengguna" | "aktif">, pelaku: PelakuAi): boolean {
  if (pelaku.superAdmin) return true;
  if (Number(p.aktif) !== 1) return false;
  const mode = modeAkses(p.akses);
  if (mode === "semua") return true;
  if (mode === "pengguna") return daftarDariKoma(p.akses_pengguna).includes(pelaku.id);
  const peran = new Set([pelaku.peranId, ...(pelaku.peranTambahan ?? [])]);
  return daftarDariKoma(p.akses_peran).some((r) => peran.has(r));
}

/** Satu-satunya bacaan proyek untuk pengguna biasa: id, nama, deskripsi. */
export async function daftarPilihanProyek(db: AletaDatabase, pelaku: PelakuAi): Promise<PilihanProyek[]> {
  const baris = await db.queryAll<BarisProyek>(`SELECT * FROM aleta_ai_proyek_kelola ORDER BY nama`);
  return baris.filter((b) => bolehPakaiProyek(b, pelaku)).map((b) => ({ id: b.id, nama: b.nama, deskripsi: b.deskripsi }));
}

export async function bacaPilihanPercakapan(db: AletaDatabase, percakapanId: string): Promise<string> {
  const p = await db.queryOne<{ proyek_id: string }>(`SELECT proyek_id FROM aleta_ai_proyek_pilihan WHERE percakapan_id = ?`, [teks(percakapanId)]);
  return p?.proyek_id ?? "";
}

/** Proyek yang tidak boleh dipakai dijawab "tidak ditemukan": keberadaannya tidak dibocorkan. */
export async function pastikanProyekBolehDipakai(db: AletaDatabase, pelaku: PelakuAi, proyekId: string): Promise<void> {
  const p = await db.queryOne<BarisProyek>(`SELECT * FROM aleta_ai_proyek_kelola WHERE id = ?`, [teks(proyekId)]);
  if (!p || !bolehPakaiProyek(p, pelaku)) throw new ApiError(404, "Proyek tidak ditemukan.");
}

/** Memilih proyek untuk percakapan milik pelaku ("" = proyek bawaan satker). Pemanggil sudah memastikan percakapan miliknya. */
export async function setPilihanPercakapan(db: AletaDatabase, pelaku: PelakuAi, percakapanId: string, proyekId: string): Promise<{ proyekId: string }> {
  const id = teks(proyekId);
  if (!id) {
    await db.run(`DELETE FROM aleta_ai_proyek_pilihan WHERE percakapan_id = ?`, [teks(percakapanId)]);
    return { proyekId: "" };
  }
  await pastikanProyekBolehDipakai(db, pelaku, id);
  await db.run(`DELETE FROM aleta_ai_proyek_pilihan WHERE percakapan_id = ?`, [teks(percakapanId)]);
  await db.run(`INSERT INTO aleta_ai_proyek_pilihan (percakapan_id, proyek_id, dipilih_at) VALUES (?, ?, ?)`, [teks(percakapanId), id, sekarangIso()]);
  return { proyekId: id };
}

// ----------------------------------------------------------------------------
// Pemakaian oleh mesin
// ----------------------------------------------------------------------------

export type ProyekUntukPrompt = {
  id: string;
  nama: string;
  instruksi: string;
  sertakanBawaan: boolean;
  memoriAktif: boolean;
  berkas: BerkasPengetahuan[];
  memori: MemoriProyek[];
  versi: number;
};

const cachePakai = new Map<string, { diubah: string; data: ProyekUntukPrompt }>();

/**
 * Isi proyek untuk menyusun prompt. DIPANGGIL SERVER SAJA (mesin); tidak ada rute yang mengembalikannya ke pengguna.
 * Melempar 404 bila proyek hilang atau tidak (lagi) boleh dipakai pelaku - giliran tidak diam-diam jatuh ke proyek lain.
 */
export async function proyekUntukPrompt(db: AletaDatabase, pelaku: PelakuAi, proyekId: string): Promise<ProyekUntukPrompt> {
  const b = await db.queryOne<BarisProyek>(`SELECT * FROM aleta_ai_proyek_kelola WHERE id = ?`, [teks(proyekId)]);
  if (!b || !bolehPakaiProyek(b, pelaku)) throw new ApiError(404, "Proyek yang dipilih tidak lagi tersedia untuk Anda. Pilih proyek lain atau proyek bawaan.");
  const cache = cachePakai.get(b.id);
  if (cache && cache.diubah === `${b.diubah_at}#${b.versi}`) return cache.data;
  const berkas = await db.queryAll<{ id: string; nama: string; teks: string; selalu: number | string }>(`SELECT id, nama, teks, selalu FROM aleta_ai_pengetahuan WHERE proyek_id = ? ORDER BY nama`, [b.id]);
  const memori = await db.queryAll<{ id: string; isi: string }>(`SELECT id, isi FROM aleta_ai_memori_proyek WHERE proyek_id = ? AND status = 'disetujui' ORDER BY dibuat_at, id`, [b.id]);
  const data: ProyekUntukPrompt = {
    id: b.id,
    nama: b.nama,
    instruksi: b.instruksi,
    sertakanBawaan: Number(b.sertakan_bawaan) === 1,
    memoriAktif: Number(b.memori_aktif) === 1,
    berkas: berkas.map((x) => ({ id: x.id, nama: x.nama, teks: x.teks, selalu: Number(x.selalu) === 1 })),
    memori: memori.map((m) => ({ id: m.id, isi: m.isi })),
    versi: Number(b.versi),
  };
  if (cachePakai.size >= 20) cachePakai.delete(cachePakai.keys().next().value as string);
  cachePakai.set(b.id, { diubah: `${b.diubah_at}#${b.versi}`, data });
  return data;
}

export function kosongkanCacheProyekKelola() {
  cachePakai.clear();
}
