import { KUNCI_CIRI, kodeKertasSah, uraiHalaman, type SunganBaris } from "@/lib/berkas-perkara";
import type { AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * PENYIMPANAN SUNTING SAMPUL DAN DAFTAR ISI BERKAS (di ALETA, bukan di SIPP/ABT)
 * ============================================================================
 *
 * Tabel 0112: aleta_berkas_susunan (baris daftar isi yang disunting), aleta_berkas_sampul (ciri dan isian yang diubah tangan),
 * aleta_berkas_bawaan (halaman bawaan per jenis dokumen). Semuanya per perkara (id perkara SIPP) kecuali bawaan.
 * Yang disimpan hanya angka dan teks pendek; isi dokumen tidak pernah.
 */

const BATAS_BARIS = 400;
const BATAS_TEKS = 300;
const BATAS_ISIAN = 120;
const BATAS_NILAI_ISIAN = 2000;
const KUNCI_SAH = /^[a-z0-9_:.\-]{1,60}$/i;
const LARANGAN_NAMA_APLIKASI = /aleta/i;

export type SuntingTersimpan = {
  susunan: Record<string, SunganBaris & { bundel: "A" | "B"; kunci: string }>;
  tag: Record<string, boolean>;
  isian: Record<string, string>;
};

const teks = (x: unknown, maks = BATAS_TEKS) => String(x ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, maks);

export function idPerkaraSah(x: unknown): string {
  const t = String(x ?? "").trim();
  return /^\d{1,12}$/.test(t) ? t : "";
}

export async function bacaSunting(db: AletaDatabase, perkaraId: string): Promise<SuntingTersimpan> {
  const hasil: SuntingTersimpan = { susunan: {}, tag: {}, isian: {} };
  const baris = await db.queryAll<Record<string, unknown>>(
    "SELECT bundel, kunci, tampil, urutan, halaman_teks, judul_manual, tanggal_manual, tambahan FROM aleta_berkas_susunan WHERE perkara_id = ?",
    [perkaraId]
  );
  for (const b of baris) {
    const bundel = String(b.bundel) === "B" ? "B" : "A";
    const kunci = String(b.kunci);
    hasil.susunan[`${bundel}:${kunci}`] = {
      bundel,
      kunci,
      tampil: Number(b.tampil) !== 0,
      urutan: Number(b.urutan) || 0,
      halamanTeks: String(b.halaman_teks ?? ""),
      judulManual: String(b.judul_manual ?? ""),
      tanggalManual: String(b.tanggal_manual ?? ""),
      tambahan: Number(b.tambahan) === 1,
    };
  }
  const s = await db.queryAll<Record<string, unknown>>("SELECT jenis, kunci, nilai FROM aleta_berkas_sampul WHERE perkara_id = ?", [perkaraId]);
  for (const r of s) {
    if (String(r.jenis) === "tag") hasil.tag[String(r.kunci)] = String(r.nilai) === "1";
    else if (String(r.jenis) === "isian") hasil.isian[String(r.kunci)] = String(r.nilai ?? "");
  }
  return hasil;
}

export type MasukanSusunan = Array<{
  bundel?: unknown;
  kunci?: unknown;
  tampil?: unknown;
  urutan?: unknown;
  halamanTeks?: unknown;
  judulManual?: unknown;
  tanggalManual?: unknown;
  tambahan?: unknown;
}>;

export type HasilSimpan = { ok: true; susunan: number; tag: number; isian: number; ditolak: string[] } | { ok: false; alasan: string };

/**
 * Menyimpan sunting satu perkara (menggantikan seluruh sunting sebelumnya): susunan daftar isi dan/atau ciri-isian sampul.
 * Bagian yang tidak dikirim tidak disentuh. Ketikan halaman tidak sah ditolak (dilaporkan, bukan diam-diam dibuang).
 */
export async function simpanSunting(
  db: AletaDatabase,
  opsi: {
    perkaraId: string;
    nomor?: string;
    aktor: string;
    susunan?: MasukanSusunan | null;
    tag?: Record<string, unknown> | null;
    isian?: Record<string, unknown> | null;
    kini?: Date;
  }
): Promise<HasilSimpan> {
  const perkaraId = idPerkaraSah(opsi.perkaraId);
  if (!perkaraId) return { ok: false, alasan: "Perkara tidak sah." };
  const sekarang = (opsi.kini ?? new Date()).toISOString();
  const aktor = teks(opsi.aktor, 80);
  const ditolak: string[] = [];
  let nSusunan = 0;
  let nTag = 0;
  let nIsian = 0;

  if (Array.isArray(opsi.susunan)) {
    if (opsi.susunan.length > BATAS_BARIS) return { ok: false, alasan: `Terlalu banyak baris (maksimum ${BATAS_BARIS}).` };
    const bersih: Array<{ bundel: "A" | "B"; kunci: string; tampil: number; urutan: number; halaman: string; judul: string; tanggal: string; tambahan: number }> = [];
    const lihat = new Set<string>();
    for (const m of opsi.susunan) {
      const kunci = String(m.kunci ?? "").trim();
      const bundel = String(m.bundel) === "B" ? "B" : String(m.bundel) === "A" ? "A" : "";
      if (!bundel || !KUNCI_SAH.test(kunci)) {
        ditolak.push(`${String(m.bundel)}:${kunci}: kunci tidak sah`);
        continue;
      }
      const id = `${bundel}:${kunci}`;
      if (lihat.has(id)) continue;
      lihat.add(id);
      const halaman = teks(m.halamanTeks, 12).trim();
      if (uraiHalaman(halaman).tipe === "salah") {
        ditolak.push(`${id}: halaman "${halaman}" tidak sah (ketik 3 atau 5-9)`);
        continue;
      }
      const judul = teks(m.judulManual);
      const tanggal = teks(m.tanggalManual, 40);
      if (LARANGAN_NAMA_APLIKASI.test(judul + tanggal)) {
        ditolak.push(`${id}: teks memuat nama aplikasi (tidak boleh masuk ke blangko)`);
        continue;
      }
      bersih.push({
        bundel,
        kunci,
        tampil: m.tampil === false || m.tampil === 0 ? 0 : 1,
        urutan: Math.max(0, Math.min(9999, Math.trunc(Number(m.urutan) || 0))),
        halaman,
        judul,
        tanggal,
        tambahan: m.tambahan === true || m.tambahan === 1 ? 1 : 0,
      });
    }
    await db.run("DELETE FROM aleta_berkas_susunan WHERE perkara_id = ?", [perkaraId]);
    for (const b of bersih) {
      await db.run(
        `INSERT INTO aleta_berkas_susunan (id, perkara_id, nomor_perkara, bundel, kunci, tampil, urutan, halaman_teks, judul_manual, tanggal_manual, tambahan, diubah_oleh, diubah_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`${perkaraId}:${b.bundel}:${b.kunci}`, perkaraId, teks(opsi.nomor, 60), b.bundel, b.kunci, b.tampil, b.urutan, b.halaman, b.judul, b.tanggal, b.tambahan, aktor, sekarang]
      );
      nSusunan += 1;
    }
  }

  if (opsi.tag && typeof opsi.tag === "object") {
    await db.run("DELETE FROM aleta_berkas_sampul WHERE perkara_id = ? AND jenis = 'tag'", [perkaraId]);
    for (const [k, v] of Object.entries(opsi.tag)) {
      if (!KUNCI_CIRI.includes(k)) {
        ditolak.push(`ciri ${k}: tidak dikenal`);
        continue;
      }
      await db.run("INSERT INTO aleta_berkas_sampul (id, perkara_id, jenis, kunci, nilai, diubah_oleh, diubah_at) VALUES (?, ?, 'tag', ?, ?, ?, ?)", [
        `${perkaraId}:tag:${k}`,
        perkaraId,
        k,
        v === true || v === 1 || v === "1" ? "1" : "0",
        aktor,
        sekarang,
      ]);
      nTag += 1;
    }
  }

  if (opsi.isian && typeof opsi.isian === "object") {
    await db.run("DELETE FROM aleta_berkas_sampul WHERE perkara_id = ? AND jenis = 'isian'", [perkaraId]);
    for (const [k, v] of Object.entries(opsi.isian)) {
      if (!KUNCI_SAH.test(k) || nIsian >= BATAS_ISIAN) continue;
      const nilai = teks(v, BATAS_NILAI_ISIAN);
      if (LARANGAN_NAMA_APLIKASI.test(nilai)) {
        ditolak.push(`isian ${k}: teks memuat nama aplikasi (tidak boleh masuk ke blangko)`);
        continue;
      }
      await db.run("INSERT INTO aleta_berkas_sampul (id, perkara_id, jenis, kunci, nilai, diubah_oleh, diubah_at) VALUES (?, ?, 'isian', ?, ?, ?, ?)", [
        `${perkaraId}:isian:${k}`,
        perkaraId,
        k,
        nilai,
        aktor,
        sekarang,
      ]);
      nIsian += 1;
    }
  }
  return { ok: true, susunan: nSusunan, tag: nTag, isian: nIsian, ditolak };
}

export async function bacaBawaan(db: AletaDatabase): Promise<Record<string, number>> {
  const hasil: Record<string, number> = {};
  try {
    const baris = await db.queryAll<{ jenis_dokumen: string; halaman: number }>("SELECT jenis_dokumen, halaman FROM aleta_berkas_bawaan", []);
    for (const b of baris) if (Number(b.halaman) >= 1) hasil[String(b.jenis_dokumen)] = Number(b.halaman);
  } catch {
    /* tabel belum ada / tak terbaca: pakai nilai bawaan tertanam */
  }
  return hasil;
}

export async function simpanBawaan(db: AletaDatabase, nilai: Record<string, { halaman: number; contoh: number }>, kini = new Date()): Promise<number> {
  const sekarang = kini.toISOString();
  let n = 0;
  for (const [jenis, v] of Object.entries(nilai)) {
    if (!/^[a-z0-9-]{1,40}$/.test(jenis)) continue;
    const halaman = Math.max(1, Math.min(200, Math.round(Number(v.halaman) || 0)));
    if (!halaman) continue;
    const ada = await db.queryOne<{ jenis_dokumen: string }>("SELECT jenis_dokumen FROM aleta_berkas_bawaan WHERE jenis_dokumen = ?", [jenis]);
    if (ada) await db.run("UPDATE aleta_berkas_bawaan SET halaman = ?, jumlah_contoh = ?, diperbarui_at = ? WHERE jenis_dokumen = ?", [halaman, Math.max(0, Math.trunc(v.contoh) || 0), sekarang, jenis]);
    else await db.run("INSERT INTO aleta_berkas_bawaan (jenis_dokumen, halaman, jumlah_contoh, diperbarui_at) VALUES (?, ?, ?, ?)", [jenis, halaman, Math.max(0, Math.trunc(v.contoh) || 0), sekarang]);
    n += 1;
  }
  return n;
}

export { kodeKertasSah };
