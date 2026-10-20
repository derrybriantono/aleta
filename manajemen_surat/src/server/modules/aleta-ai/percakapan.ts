import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";
import { decryptCredentialSecret, encryptCredentialSecret } from "@/server/shared/security";

/**
 * ============================================================================
 * ALETA Ai - PERCAKAPAN DAN PESAN
 * ============================================================================
 *
 * ENKRIPSI: isi pesan dan judul percakapan disimpan terenkripsi AES-256-GCM
 * memakai mekanisme kolom yang sudah ada di ALETA (shared/security.ts, kunci
 * dari ALETA_CREDENTIAL_ENCRYPTION_KEY / BETTER_AUTH_SECRET). Mengganti kunci
 * membuat isi lama tidak terbaca (gagal-tertutup: kosong). Rotasi kunci dan
 * kebijakan retensi diatur di tahap 6.
 *
 * KERAHASIAAN: percakapan hanya dapat dibuka PEMILIKNYA. Super Admin pun
 * mendapat "tidak ditemukan" - isi musyawarah tidak boleh bocor lewat jalur
 * administrasi. Super Admin hanya melihat metadata biaya (laporan.ts).
 *
 * DELETE tidak menghapus: percakapan disembunyikan (tersembunyi = 1) dan baris
 * serta mutasi biayanya tetap ada untuk pembukuan.
 */

const teks = (n: unknown) => String(n ?? "").trim();
const sekarangIso = () => new Date().toISOString();

export const JUDUL_BAWAAN = "Percakapan baru";
export const BATAS_JUDUL = 120;

export const sandiIsi = (isi: string): string => encryptCredentialSecret(isi);
export const bukaIsi = (sandi: string): string => decryptCredentialSecret(sandi);

export type RingkasPercakapan = {
  id: string;
  judul: string;
  diperbarui: string;
  perkara?: string;
};

export type PesanTampil = {
  id: string;
  peran: "pengguna" | "ai";
  isi: string;
  mode?: string;
  biayaRp?: number;
  waktu: string;
  status?: string;
};

type BarisPercakapan = {
  id: string;
  pemilik_id: string;
  judul: string;
  perkara_ref: string;
  tersembunyi: number | string;
  proyek_versi: number | string;
  jumlah_pesan: number | string;
  dibuat_at: string;
  diperbarui_at: string;
};

export async function ambilMilik(db: AletaDatabase, pemilikId: string, percakapanId: string): Promise<BarisPercakapan | null> {
  const baris = await db.queryOne<BarisPercakapan>(`SELECT * FROM aleta_ai_obrolan WHERE id = ? AND pemilik_id = ? AND tersembunyi = 0`, [teks(percakapanId), teks(pemilikId)]);
  return baris ?? null;
}

async function wajibMilik(db: AletaDatabase, pemilikId: string, percakapanId: string): Promise<BarisPercakapan> {
  const baris = await ambilMilik(db, pemilikId, percakapanId);
  if (!baris) throw new ApiError(404, "Percakapan tidak ditemukan.");
  return baris;
}

export async function daftarPercakapan(db: AletaDatabase, pemilikId: string): Promise<RingkasPercakapan[]> {
  const baris = await db.queryAll<BarisPercakapan>(`SELECT * FROM aleta_ai_obrolan WHERE pemilik_id = ? AND tersembunyi = 0 ORDER BY diperbarui_at DESC LIMIT 300`, [teks(pemilikId)]);
  return baris.map((b) => ({
    id: b.id,
    judul: bukaIsi(b.judul) || JUDUL_BAWAAN,
    diperbarui: b.diperbarui_at,
    ...(b.perkara_ref ? { perkara: b.perkara_ref } : {}),
  }));
}

export async function buatPercakapan(db: AletaDatabase, pemilikId: string, masukan: { judul?: string; perkara?: string } = {}): Promise<{ id: string }> {
  const id = `aic-${randomUUID()}`;
  const sekarang = sekarangIso();
  const judul = teks(masukan.judul).slice(0, BATAS_JUDUL) || JUDUL_BAWAAN;
  await db.run(
    `INSERT INTO aleta_ai_obrolan (id, pemilik_id, judul, perkara_ref, tersembunyi, proyek_versi, jumlah_pesan, dibuat_at, diperbarui_at)
     VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)`,
    [id, teks(pemilikId), sandiIsi(judul), teks(masukan.perkara).slice(0, 120), sekarang, sekarang]
  );
  return { id };
}

type BarisPesan = {
  id: string;
  peran: string;
  isi: string;
  mode_label: string;
  status: string;
  biaya_rp: number | string;
  gratis: number | string;
  dibuat_at: string;
};

export async function ambilPercakapan(db: AletaDatabase, pemilikId: string, percakapanId: string): Promise<{ id: string; judul: string; pesan: PesanTampil[] }> {
  const p = await wajibMilik(db, pemilikId, percakapanId);
  const baris = await db.queryAll<BarisPesan>(`SELECT id, peran, isi, mode_label, status, biaya_rp, gratis, dibuat_at FROM aleta_ai_obrolan_pesan WHERE percakapan_id = ? ORDER BY dibuat_at, id`, [p.id]);
  const pesan: PesanTampil[] = [];
  for (const b of baris) {
    const isi = bukaIsi(b.isi);
    // Giliran AI yang gagal tanpa teks sedikit pun tidak ditampilkan.
    if (b.peran === "ai" && !isi && b.status !== "berjalan") continue;
    const ai = b.peran === "ai";
    pesan.push({
      id: b.id,
      peran: ai ? "ai" : "pengguna",
      isi,
      ...(ai && b.mode_label ? { mode: b.mode_label } : {}),
      ...(ai ? { biayaRp: Number(b.biaya_rp) } : {}),
      waktu: b.dibuat_at,
      ...(ai ? { status: b.status } : {}),
    });
  }
  return { id: p.id, judul: bukaIsi(p.judul) || JUDUL_BAWAAN, pesan };
}

export async function ubahJudul(db: AletaDatabase, pemilikId: string, percakapanId: string, judul: string): Promise<{ id: string; judul: string }> {
  const p = await wajibMilik(db, pemilikId, percakapanId);
  const bersih = teks(judul).slice(0, BATAS_JUDUL);
  if (!bersih) throw new ApiError(400, "Judul tidak boleh kosong.");
  await db.run(`UPDATE aleta_ai_obrolan SET judul = ?, diperbarui_at = ? WHERE id = ?`, [sandiIsi(bersih), sekarangIso(), p.id]);
  return { id: p.id, judul: bersih };
}

export async function sembunyikanPercakapan(db: AletaDatabase, pemilikId: string, percakapanId: string): Promise<void> {
  const p = await wajibMilik(db, pemilikId, percakapanId);
  await db.run(`UPDATE aleta_ai_obrolan SET tersembunyi = 1, diperbarui_at = ? WHERE id = ?`, [sekarangIso(), p.id]);
}

/** Riwayat teks untuk disusun ke permintaan: hanya giliran yang selesai dan berisi. */
export async function riwayatUntukPermintaan(db: AletaDatabase, percakapanId: string): Promise<Array<{ peran: "pengguna" | "ai"; isi: string }>> {
  const baris = await db.queryAll<BarisPesan>(`SELECT id, peran, isi, mode_label, status, biaya_rp, gratis, dibuat_at FROM aleta_ai_obrolan_pesan WHERE percakapan_id = ? AND status IN ('selesai', 'terpotong', 'ditolak') ORDER BY dibuat_at, id`, [percakapanId]);
  return baris
    .map((b) => ({ peran: (b.peran === "ai" ? "ai" : "pengguna") as "pengguna" | "ai", isi: bukaIsi(b.isi) }))
    .filter((p) => p.isi.trim().length > 0);
}
