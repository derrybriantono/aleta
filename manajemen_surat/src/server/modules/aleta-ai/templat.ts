import { randomUUID } from "node:crypto";

import type { FormatBerkas } from "@/lib/aleta-ai/tugas";
import type { AletaDatabase } from "@/server/db/client";
import type { TemplatBerkas } from "@/server/modules/aleta-ai/berkas-keluaran";
import { bacaDaftarZip } from "@/server/modules/aleta-ai/zip-baca";

/**
 * ALETA Ai tahap 3 - TEMPLAT PROYEK V4.5 (tabel aleta_ai_proyek_berkas, 0087).
 *
 * Templat TIDAK ada di repo. Saat Super Admin mengunggah ZIP proyek, templat
 * HTML di dalamnya (ALETA_13_Template_Panduan_Sidang.html, ALETA_18_..., yang
 * membaca satu objek data global window.SIDANG/KOMPARASI/...) disimpan isinya
 * (base64) per versi proyek; tugas memilih templat dari versi proyek AKTIF
 * menurut NAMA BERKAS. DOCX/RTF/PDF dicetak skrip V4.5 di sandbox, jadi skrip
 * .py TIDAK disimpan di sini (dipasang terpisah, lihat sandbox.ts).
 */

const JENIS_TEMPLAT: Record<string, FormatBerkas> = { html: "html", htm: "html" };
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

/** Templat HTML proyek aktif yang namanya cocok `pola` (mis. /ALETA_13_.*\.html$/). null = susunan bawaan. */
export async function pilihTemplat(db: AletaDatabase, proyekId: string, pola: RegExp): Promise<TemplatBerkas | null> {
  const baris = await db.queryAll<{ nama: string; isi: string }>(`SELECT nama, isi FROM aleta_ai_proyek_berkas WHERE proyek_id = ? AND jenis = 'html' ORDER BY nama`, [proyekId]);
  const b = baris.find((x) => pola.test(x.nama));
  return b ? { nama: b.nama, bita: Buffer.from(b.isi, "base64") } : null;
}
