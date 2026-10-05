/**
 * ============================================================================
 * PROSES ANAK: PRAPROSES GAMBAR KTP DAN MENGGAMBAR HALAMAN PDF
 * ============================================================================
 *
 * Dipanggil src/server/modules/aleta-ecourt/ktp-ocr.ts lewat child_process -
 * BUKAN dimuat di dalam proses portal. Sebabnya diukur 5 Okt 2026: decoder
 * gambar asli @napi-rs/canvas MATI dengan access violation (0xC0000005) atas
 * JPEG yang rusak; di dalam proses Next itu berarti seluruh portal ikut mati
 * karena satu foto KTP yang terpotong. Di proses anak, yang mati hanya anak
 * ini, dan pemanggilnya jatuh ke OCR tanpa praproses.
 *
 *   node scripts/ktp-gambar.mjs gambar   < foto          -> abu, biner
 *   node scripts/ktp-gambar.mjs pdf [n]  < berkas.pdf    -> hal1-abu, hal1-biner, ...
 *
 * Keluaran (stdout) berbingkai: [4 bait panjang label][label utf8]
 * [4 bait panjang data][data PNG], berulang. Tidak ada berkas sementara;
 * tidak ada yang dicatat. Kode keluar: 0 berhasil, 3 tidak dapat dibaca,
 * 4 kanvas tidak tersedia.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DI = path.dirname(fileURLToPath(import.meta.url));
const muat = createRequire(path.join(DI, "..", "package.json"));

function bacaMasukan() {
  return new Promise((selesai, gagal) => {
    const potong = [];
    process.stdin.on("data", (x) => potong.push(x));
    process.stdin.on("end", () => selesai(Buffer.concat(potong)));
    process.stdin.on("error", gagal);
  });
}

const bingkai = [];
function tulis(label, data) {
  const l = Buffer.from(label, "utf8");
  const a = Buffer.alloc(4);
  a.writeUInt32BE(l.length, 0);
  const b = Buffer.alloc(4);
  b.writeUInt32BE(data.length, 0);
  bingkai.push(a, l, b, data);
}

/** Rentang kontras 1%..99% dari histogram. */
function rentang(hist, jumlah) {
  const batas = jumlah * 0.01;
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let i = 0; i < 256; i += 1) {
    acc += hist[i];
    if (acc > batas) {
      lo = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i -= 1) {
    acc += hist[i];
    if (acc > batas) {
      hi = i;
      break;
    }
  }
  return hi - lo < 32 ? [0, 255] : [lo, hi];
}

/**
 * Sumber (gambar atau kanvas) -> { abu, biner } PNG: skala abu-abu berkontras
 * rentang (diperbesar bila kecil, dikecilkan bila raksasa), dan hitam-putih
 * berambang LOKAL (Bradley: piksel 15% lebih gelap dari rerata sekitarnya =
 * tulisan) - latar KTP bermotif dan cahaya foto ponsel jarang rata.
 */
function praproses(k, sumber, w0, h0) {
  if (!w0 || !h0) return null;
  const sisi = Math.max(w0, h0);
  let skala = 1;
  if (sisi < 1600) skala = Math.min(3, 2000 / sisi);
  else if (sisi > 3200) skala = 2600 / sisi;
  const w = Math.max(1, Math.round(w0 * skala));
  const h = Math.max(1, Math.round(h0 * skala));
  const kanvas = k.createCanvas(w, h);
  const ctx = kanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sumber, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const n = w * h;
  const abu = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < n; i += 1, j += 4) {
    const y = Math.round(0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]);
    abu[i] = y;
    hist[y] += 1;
  }
  const [lo, hi] = rentang(hist, n);
  const kali = 255 / (hi - lo);
  for (let i = 0; i < n; i += 1) abu[i] = Math.max(0, Math.min(255, Math.round((abu[i] - lo) * kali)));
  for (let i = 0, j = 0; i < n; i += 1, j += 4) {
    px[j] = abu[i];
    px[j + 1] = abu[i];
    px[j + 2] = abu[i];
    px[j + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  const abuPng = kanvas.toBuffer("image/png");

  const lebar = w + 1;
  const integral = new Float64Array(lebar * (h + 1));
  for (let y = 1; y <= h; y += 1) {
    let baris = 0;
    for (let x = 1; x <= w; x += 1) {
      baris += abu[(y - 1) * w + (x - 1)];
      integral[y * lebar + x] = integral[(y - 1) * lebar + x] + baris;
    }
  }
  const r = Math.max(8, Math.round(Math.max(w, h) / 64));
  for (let y = 0; y < h; y += 1) {
    const y1 = Math.max(0, y - r);
    const y2 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x += 1) {
      const x1 = Math.max(0, x - r);
      const x2 = Math.min(w, x + r + 1);
      const luas = (x2 - x1) * (y2 - y1);
      const jumlah = integral[y2 * lebar + x2] - integral[y1 * lebar + x2] - integral[y2 * lebar + x1] + integral[y1 * lebar + x1];
      const v = abu[y * w + x] * luas < jumlah * 0.85 ? 0 : 255;
      const j = (y * w + x) * 4;
      px[j] = v;
      px[j + 1] = v;
      px[j + 2] = v;
    }
  }
  ctx.putImageData(data, 0, 0);
  const binerPng = kanvas.toBuffer("image/png");
  abu.fill(0);
  px.fill(0);
  return { abu: abuPng, biner: binerPng };
}

/**
 * Halaman PDF -> kanvas (pdfjs-dist + @napi-rs/canvas). Pabrik kanvas sendiri:
 * pabrik bawaan pdfjs untuk Node memanggil process.getBuiltinModule, yang
 * baru ada sejak Node 20.16.
 */
async function gambarPdf(k, data, maks) {
  const g = globalThis;
  for (const nama of ["DOMMatrix", "ImageData", "Path2D"]) if (k[nama]) g[nama] = k[nama];
  const pdfjs = await import(pathToFileURL(muat.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
  class PabrikKanvas {
    constructor() {}
    create(w, h) {
      const canvas = k.createCanvas(Math.max(1, w), Math.max(1, h));
      return { canvas, context: canvas.getContext("2d") };
    }
    reset(cc, w, h) {
      cc.canvas.width = w;
      cc.canvas.height = h;
    }
    destroy(cc) {
      cc.canvas = null;
      cc.context = null;
    }
  }
  const dokumen = await pdfjs.getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
    CanvasFactory: PabrikKanvas,
  }).promise;
  const hasil = [];
  try {
    for (let nomor = 1; nomor <= Math.min(dokumen.numPages, maks); nomor += 1) {
      const hal = await dokumen.getPage(nomor);
      const dasar = hal.getViewport({ scale: 1 });
      // Sisi terpanjang +-2600 px: KTP yang hanya sepertiga halaman A4 tetap
      // cukup besar hurufnya untuk tesseract.
      const skala = Math.max(1, Math.min(5, 2600 / Math.max(dasar.width, dasar.height)));
      const vp = hal.getViewport({ scale: skala });
      const kanvas = k.createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const ctx = kanvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, kanvas.width, kanvas.height);
      await hal.render({ canvasContext: ctx, canvas: kanvas, viewport: vp }).promise;
      hasil.push(kanvas);
      hal.cleanup();
    }
  } finally {
    await dokumen.destroy();
  }
  return hasil;
}

async function utama() {
  const mode = process.argv[2];
  let k;
  try {
    k = muat("@napi-rs/canvas");
  } catch {
    process.exit(4);
  }
  const data = await bacaMasukan();
  if (mode === "gambar") {
    const img = await k.loadImage(data);
    const r = praproses(k, img, img.width, img.height);
    if (!r) process.exit(3);
    tulis("abu", r.abu);
    tulis("biner", r.biner);
  } else if (mode === "pdf") {
    const maks = Math.max(1, Math.min(5, Number(process.argv[3]) || 2));
    const halaman = await gambarPdf(k, data, maks);
    if (!halaman.length) process.exit(3);
    halaman.forEach((kanvas, i) => {
      // Kanvas halaman langsung dipraproses (tanpa PNG perantara).
      const r = praproses(k, kanvas, kanvas.width, kanvas.height);
      tulis(`hal${i + 1}-abu`, r.abu);
      tulis(`hal${i + 1}-biner`, r.biner);
    });
  } else {
    process.exit(2);
  }
  data.fill(0);
  process.stdout.write(Buffer.concat(bingkai), () => process.exit(0));
}

utama().catch(() => process.exit(3));
