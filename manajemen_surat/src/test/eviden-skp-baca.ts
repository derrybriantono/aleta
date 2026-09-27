import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { JSDOM } from "jsdom";

/**
 * ============================================================================
 * PEMBACA KELUARAN EVIDEN SKP - UNTUK UJI
 * ============================================================================
 *
 * Bukan berkas uji. Membuka hasil penggambar seperti yang akan dilakukan
 * aplikasi lain: ZIP dibaca dari daftar isinya (simpan maupun deflate), XML
 * diurai pengurai XML sungguhan yang ketat ruang nama (jsdom/saxes), dan PDF
 * dibaca pdfjs-dist - pustaka yang juga dipakai peramban - lengkap dengan
 * letak dan lebar tiap potongan teksnya.
 */

/** Seluruh entri ZIP (metode simpan atau deflate), menurut daftar isinya. */
export function bacaZip(arsip: Buffer): Map<string, Buffer> {
  const isi = new Map<string, Buffer>();
  const penutup = arsip.length - 22;
  if (penutup < 0 || arsip.readUInt32LE(penutup) !== 0x06054b50) throw new Error("penutup ZIP tidak ditemukan");
  const jumlah = arsip.readUInt16LE(penutup + 10);
  let letak = arsip.readUInt32LE(penutup + 16);
  for (let i = 0; i < jumlah; i += 1) {
    if (arsip.readUInt32LE(letak) !== 0x02014b50) throw new Error(`daftar isi rusak pada entri ${i}`);
    const penanda = arsip.readUInt16LE(letak + 8);
    const metode = arsip.readUInt16LE(letak + 10);
    const besarMampat = arsip.readUInt32LE(letak + 20);
    const panjangNama = arsip.readUInt16LE(letak + 28);
    const panjangTambahan = arsip.readUInt16LE(letak + 30);
    const panjangKeterangan = arsip.readUInt16LE(letak + 32);
    const letakLokal = arsip.readUInt32LE(letak + 42);
    const namaBita = arsip.subarray(letak + 46, letak + 46 + panjangNama);
    const nama = penanda & 0x0800 ? namaBita.toString("utf8") : namaBita.toString("latin1");
    const namaLokal = arsip.readUInt16LE(letakLokal + 26);
    const tambahanLokal = arsip.readUInt16LE(letakLokal + 28);
    const awal = letakLokal + 30 + namaLokal + tambahanLokal;
    const data = arsip.subarray(awal, awal + besarMampat);
    isi.set(nama, metode === 8 ? inflateRawSync(data) : Buffer.from(data));
    letak += 46 + panjangNama + panjangTambahan + panjangKeterangan;
  }
  return isi;
}

/** Penanda bit 11 (nama UTF-8) tiap entri, menurut daftar isinya. */
export function penandaZip(arsip: Buffer): Map<string, number> {
  const hasil = new Map<string, number>();
  const penutup = arsip.length - 22;
  const jumlah = arsip.readUInt16LE(penutup + 10);
  let letak = arsip.readUInt32LE(penutup + 16);
  for (let i = 0; i < jumlah; i += 1) {
    const penanda = arsip.readUInt16LE(letak + 8);
    const panjangNama = arsip.readUInt16LE(letak + 28);
    const panjangTambahan = arsip.readUInt16LE(letak + 30);
    const panjangKeterangan = arsip.readUInt16LE(letak + 32);
    hasil.set(arsip.subarray(letak + 46, letak + 46 + panjangNama).toString("utf8"), penanda);
    letak += 46 + panjangNama + panjangTambahan + panjangKeterangan;
  }
  return hasil;
}

const jsdom = new JSDOM("");

/** Mengurai XML dengan pengurai ketat; melempar bila tidak sah (termasuk awalan ruang nama yang tak terikat). */
export function uraiXml(xml: string): Document {
  const dok = new jsdom.window.DOMParser().parseFromString(xml, "application/xml");
  const galat = dok.getElementsByTagName("parsererror");
  if (galat.length > 0) throw new Error(`XML tidak sah: ${galat[0].textContent?.slice(0, 300)}`);
  return dok;
}

export type PotonganPdf = { str: string; x: number; y: number; lebar: number };
export type HalamanPdfUji = { lebar: number; tinggi: number; teks: string; potongan: PotonganPdf[] };

function pasangRintisan() {
  const lingkup = globalThis as Record<string, unknown>;
  if (!lingkup.DOMMatrix) {
    lingkup.DOMMatrix = class {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      constructor(nilai?: number[]) {
        if (Array.isArray(nilai) && nilai.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = nilai;
      }
      multiply() {
        return this;
      }
      invertSelf() {
        return this;
      }
      translate() {
        return this;
      }
      scale() {
        return this;
      }
    };
  }
  if (!lingkup.ImageData) lingkup.ImageData = class {};
  if (!lingkup.Path2D) lingkup.Path2D = class {};
}

const FOLDER_HURUF = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts");

/** Data huruf baku pdfjs dibaca langsung - pabrik bawaannya butuh Node 22. */
class PabrikDataHuruf {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    if (kind !== "standardFontDataUrl") throw new Error(`data ${kind} tidak disediakan`);
    return new Uint8Array(readFileSync(path.join(FOLDER_HURUF, filename)));
  }
}

/** Membaca PDF dengan pdfjs-dist: ukuran, teks, dan potongan teks berletak tiap halaman. */
export async function bacaPdfUji(berkas: Buffer): Promise<HalamanPdfUji[]> {
  pasangRintisan();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dok = await pdfjs.getDocument({
    data: new Uint8Array(berkas),
    isEvalSupported: false,
    standardFontDataUrl: `${FOLDER_HURUF.replace(/\\/g, "/")}/`,
    BinaryDataFactory: PabrikDataHuruf,
    useWorkerFetch: false,
    verbosity: 0,
  } as never).promise;
  const halaman: HalamanPdfUji[] = [];
  for (let n = 1; n <= dok.numPages; n += 1) {
    const hal = await dok.getPage(n);
    const [x0, y0, x1, y1] = hal.view;
    const isi = await hal.getTextContent();
    const potongan: PotonganPdf[] = [];
    for (const item of isi.items as Array<{ str?: string; transform?: number[]; width?: number }>) {
      if (!item.str || !item.transform) continue;
      potongan.push({ str: item.str, x: item.transform[4], y: item.transform[5], lebar: item.width ?? 0 });
    }
    halaman.push({ lebar: x1 - x0, tinggi: y1 - y0, teks: potongan.map((p) => p.str).join("\n"), potongan });
  }
  await dok.destroy();
  return halaman;
}
