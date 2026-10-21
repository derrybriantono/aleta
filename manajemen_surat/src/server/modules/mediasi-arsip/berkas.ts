import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * ============================================================================
 * ARSIP HASIL MEDIASI - PENYIMPANAN BERKAS (21 Okt 2026)
 * ============================================================================
 *
 * SIPP tidak punya tempat unggah dokumen hasil mediasi, jadi berkasnya disimpan di
 * arsip ALETA: <ALETA_UPLOAD_DIR>/mediasi-hasil/<kunci perkara>/<id>.<ekstensi>.
 * ALETA_UPLOAD_DIR di-mount ke luar container (docker-compose.yml:
 * /var/www/html/aleta-data/uploads -> /app/uploads), jadi berkas TIDAK musnah
 * tiap build - berbeda dari folder di dalam lapisan container (lihat memori
 * volume-bot-hanya-yang-dimount). Tanpa ALETA_UPLOAD_DIR (uji/laptop) dipakai
 * ./uploads/mediasi-hasil.
 *
 * Nama dan jalur di cakram TIDAK memakai nama dari petugas: folder perkara =
 * sidik nomor perkara (heksa), berkas = id sistem. Nama aslinya hanya di basis
 * data. Tidak ada jalan keluar folder; pembacaan hanya lewat jalur relatif yang
 * sah bentuknya. Tidak ada yang ditulis ke SIPP dari sini.
 */

export const FOLDER_PENYIMPANAN = "mediasi-hasil";
export const BENTUK_SAH = ["pdf", "rtf", "docx", "doc"] as const;
const POLA_JALUR = /^[a-f0-9]{16}\/[a-z0-9-]{8,80}\.(?:pdf|rtf|docx|doc)$/;

export function akarPenyimpanan(env: Record<string, string | undefined> = process.env): string {
  const akar = String(env.ALETA_UPLOAD_DIR ?? "").trim();
  return akar ? path.join(akar, FOLDER_PENYIMPANAN) : path.join(process.cwd(), "uploads", FOLDER_PENYIMPANAN);
}

export const sha256 = (bita: Uint8Array) => createHash("sha256").update(bita).digest("hex");

/** Nomor perkara dibakukan (tanpa spasi, huruf kecil) supaya "684/Pdt.G/2026/PA.Dgl" dan variannya satu kunci. */
export function bakukanNomor(nomor: string): string {
  return String(nomor ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Kunci folder perkara: 16 heksa dari sidik nomor perkara baku. */
export function kunciPerkara(nomor: string): string {
  return createHash("sha256").update(bakukanNomor(nomor)).digest("hex").slice(0, 16);
}

export function ekstensiBentuk(bentuk: string): string {
  return (BENTUK_SAH as readonly string[]).includes(bentuk) ? bentuk : "pdf";
}

export function jalurSah(jalur: string): boolean {
  return POLA_JALUR.test(String(jalur ?? ""));
}

function mutlak(jalur: string, akar: string): string {
  if (!jalurSah(jalur)) throw new Error("Jalur berkas tidak sah.");
  const hasil = path.resolve(akar, jalur);
  const rel = path.relative(akar, hasil);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Jalur berkas keluar dari folder penyimpanan.");
  return hasil;
}

/** Menulis berkas; pulang jalur relatif (<kunci>/<id>.<ekstensi>). */
export async function simpanBerkas(
  kunci: string,
  id: string,
  bentuk: string,
  bita: Uint8Array,
  akar: string = akarPenyimpanan()
): Promise<string> {
  const jalur = `${kunci}/${id.toLowerCase().replace(/[^a-z0-9-]/g, "")}.${ekstensiBentuk(bentuk)}`;
  const tujuan = mutlak(jalur, akar);
  await mkdir(path.dirname(tujuan), { recursive: true });
  await writeFile(tujuan, bita);
  return jalur;
}

export async function bacaBerkas(jalur: string, akar: string = akarPenyimpanan()): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(mutlak(jalur, akar)));
  } catch {
    return null;
  }
}

export async function hapusBerkas(jalur: string, akar: string = akarPenyimpanan()): Promise<boolean> {
  if (!jalur) return true;
  try {
    await rm(mutlak(jalur, akar), { force: true });
    return true;
  } catch {
    return false;
  }
}
