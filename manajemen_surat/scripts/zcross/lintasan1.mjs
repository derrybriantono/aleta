// Z cross otomatis - LINTASAN 1 (T11, prototipe jalur server Linux + LibreOffice headless).
// Berkas Word (RTF/DOCX/DOC) -> PDF lewat soffice, lalu cari halaman dan koordinat ujung kata terakhir paragraf
// "...berikut:" / "...berupa:" dengan pdftotext -bbox-layout. Satuan koordinat = poin PDF (1 cm = 28,3465 pt), titik asal kiri-atas.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const jalan = promisify(execFile);
export const CM = 72 / 2.54;

/** Berkas Word -> PDF. Profil soffice sekali pakai supaya tidak bentrok dengan soffice lain yang sedang berjalan. */
export async function konversi(berkas, ke, folderKeluar, { soffice = "soffice", batas = 180000 } = {}) {
  const profil = await mkdtemp(path.join(tmpdir(), "zcross-profil-"));
  try {
    await jalan(soffice, ["--headless", "--norestore", `-env:UserInstallation=file://${profil}`, "--convert-to", ke, "--outdir", folderKeluar, berkas], {
      timeout: batas,
      env: { ...process.env, HOME: profil },
    });
  } finally {
    await rm(profil, { recursive: true, force: true });
  }
  const dasar = path.basename(berkas).replace(/\.[^.]+$/, "");
  return path.join(folderKeluar, `${dasar}.${ke.split(":")[0]}`);
}

const entitas = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");

/** Keluaran pdftotext -bbox-layout -> halaman[{no, lebar, tinggi, baris[{x1,y1,x2,y2,kata[{t,x1,y1,x2,y2}]}]}]. */
export function uraiBbox(html) {
  const halaman = [];
  let hal = null;
  let baris = null;
  const re = /<page width="([\d.]+)" height="([\d.]+)">|<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">|<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  for (const m of String(html).matchAll(re)) {
    if (m[1]) {
      hal = { no: halaman.length + 1, lebar: Number(m[1]), tinggi: Number(m[2]), baris: [] };
      halaman.push(hal);
    } else if (m[3]) {
      baris = { x1: Number(m[3]), y1: Number(m[4]), x2: Number(m[5]), y2: Number(m[6]), kata: [] };
      hal?.baris.push(baris);
    } else if (baris) {
      baris.kata.push({ t: entitas(m[11]), x1: Number(m[7]), y1: Number(m[8]), x2: Number(m[9]), y2: Number(m[10]) });
    }
  }
  return halaman;
}

export async function bacaPdf(pdf) {
  const folder = await mkdtemp(path.join(tmpdir(), "zcross-bbox-"));
  try {
    const keluar = path.join(folder, "bbox.html");
    await jalan("pdftotext", ["-bbox-layout", pdf, keluar], { timeout: 60000 });
    return uraiBbox(await readFile(keluar, "utf8"));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

export async function jumlahHalamanPdf(pdf) {
  const { stdout } = await jalan("pdfinfo", [pdf], { timeout: 30000 });
  const m = /^Pages:\s+(\d+)/m.exec(stdout);
  return m ? Number(m[1]) : 0;
}

export const POLA_PENANDA_Z = /^SC\s*Z$/i;
export const POLA_UJUNG_DAFTAR = /^(?:berikut|berupa):$/i;

/**
 * Jangkar Z: (1) bila ada baris bertanda "SC Z" (tanda sesudah daftar TERAKHIR), baris tepat sebelumnya; (2) selainnya paragraf TERAKHIR
 * yang kata akhirnya "berikut:" / "berupa:". Mengembalikan null bila tidak ada.
 */
export function cariJangkar(halaman) {
  const urut = [];
  for (const h of halaman) for (const b of h.baris) urut.push({ h, b });
  const teks = (b) => b.kata.map((k) => k.t).join(" ").trim();
  for (let i = urut.length - 1; i > 0; i -= 1) {
    if (POLA_PENANDA_Z.test(teks(urut[i].b)) && urut[i - 1].b.kata.length) return ambil(urut[i - 1], "penanda");
  }
  for (let i = urut.length - 1; i >= 0; i -= 1) {
    const k = urut[i].b.kata;
    if (k.length && POLA_UJUNG_DAFTAR.test(k[k.length - 1].t.toLowerCase())) return ambil(urut[i], "ujung-daftar");
  }
  return null;
}
function ambil({ h, b }, lewat) {
  const kata = b.kata[b.kata.length - 1];
  return { halaman: h.no, lebarHalaman: h.lebar, tinggiHalaman: h.tinggi, baris: b, kata, via: lewat, teksBaris: b.kata.map((k) => k.t).join(" "), halamanPdf: h };
}

/** Berkas PDF di disk -> Uint8Array (dipakai uji). */
export const bacaBerkas = async (p) => new Uint8Array(await readFile(p));
export const tulisBerkas = (p, b) => writeFile(p, b);
