import { randomUUID } from "node:crypto";

import type { FormatBerkas } from "@/lib/aleta-ai/tugas";
import type { AletaDatabase } from "@/server/db/client";
import type { TemplatBerkas } from "@/server/modules/aleta-ai/berkas-keluaran";
import { bacaDaftarZip } from "@/server/modules/aleta-ai/zip-baca";

/**
 * ALETA Ai tahap 3 - TEMPLAT PROYEK V4.5 (tabel aleta_ai_proyek_berkas, 0087).
 *
 * Templat TIDAK ada di repo. Saat Super Admin mengunggah ZIP proyek, berkas
 * HTML/RTF/DOCX/XLSX di dalamnya disimpan isinya (base64) per versi proyek;
 * tugas memilih templat dari versi proyek AKTIF. Skrip .py TIDAK disimpan di
 * sini - skrip dipasang terpisah di sandbox (lihat sandbox.ts).
 */

const JENIS_TEMPLAT: Record<string, FormatBerkas> = { html: "html", htm: "html", rtf: "rtf", docx: "docx", xlsx: "xlsx" };
const BATAS_SATU = 5 * 1024 * 1024;
const BATAS_TOTAL = 30 * 1024 * 1024;
const BATAS_JUMLAH = 200;

export async function simpanTemplatProyek(db: AletaDatabase, proyekId: string, zip: Buffer): Promise<{ jumlah: number; peringatan: string[] }> {
  const entri = bacaDaftarZip(zip).filter((e) => !e.direktori && !e.nama.startsWith("__MACOSX/"));
  const pertama = entri[0]?.nama.split("/")[0] ?? "";
  const awalan = entri.length && entri.every((e) => e.nama.includes("/") && e.nama.split("/")[0] === pertama) ? `${pertama}/` : "";
  const peringatan: string[] = [];
  let total = 0;
  let jumlah = 0;
  const waktu = new Date().toISOString();
  for (const e of entri) {
    const rel = awalan && e.nama.startsWith(awalan) ? e.nama.slice(awalan.length) : e.nama;
    const ext = /\.([a-z0-9]{2,5})$/i.exec(rel)?.[1]?.toLowerCase() ?? "";
    const jenis = JENIS_TEMPLAT[ext];
    if (!jenis) continue;
    if (e.ukuranAsli > BATAS_SATU || total + e.ukuranAsli > BATAS_TOTAL || jumlah >= BATAS_JUMLAH) {
      peringatan.push(`Templat ${rel.slice(0, 120)} tidak disimpan (terlalu besar/terlalu banyak).`);
      continue;
    }
    const isi = e.baca(BATAS_SATU);
    total += isi.length;
    jumlah += 1;
    await db.run(`INSERT INTO aleta_ai_proyek_berkas (id, proyek_id, nama, jenis, ukuran, isi, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      `aipb-${randomUUID()}`,
      proyekId,
      rel.slice(0, 200),
      jenis,
      isi.length,
      isi.toString("base64"),
      waktu,
    ]);
  }
  return { jumlah, peringatan };
}

/**
 * Pilih templat untuk satu berkas: format sama, lalu yang namanya cocok
 * dengan jenis tugas DAN "donggala", lalu cocok jenis tugas, lalu nama
 * "templat/template". null = susunan bawaan.
 */
export async function pilihTemplat(db: AletaDatabase, proyekId: string, format: FormatBerkas, kata: RegExp): Promise<TemplatBerkas | null> {
  const baris = await db.queryAll<{ nama: string; jenis: string; isi: string }>(
    `SELECT nama, jenis, isi FROM aleta_ai_proyek_berkas WHERE proyek_id = ? AND jenis = ? ORDER BY nama`,
    [proyekId, format]
  );
  if (!baris.length) return null;
  const nilai = (n: string) => (kata.test(n) && /donggala/i.test(n) ? 3 : kata.test(n) ? 2 : /templa?te?/i.test(n) ? 1 : 0);
  const terbaik = baris.map((b) => ({ b, n: nilai(b.nama) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
  if (!terbaik) return null;
  return { nama: terbaik.b.nama, jenis: terbaik.b.jenis, bita: Buffer.from(terbaik.b.isi, "base64") };
}
