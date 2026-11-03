// @vitest-environment node
/**
 * ============================================================================
 * NOMOR HALAMAN AWAL BAGIAN DI PDF = SAMA DENGAN WORD (3 Nov 2026)
 * ============================================================================
 *
 * LibreOffice 7.4.7.2 (container aleta-bot, mesin PDF produksi) MENGABAIKAN "\pgnrestart\pgnstartsN" dan "\pgnstartN" dari RTF:
 * bagian pertama dan bagian mulai-ulang selalu bernomor 1. Akibatnya nomor halaman BAS runut (keputusan 71, pasangNomorAwalRtf),
 * lompatan lampiran, dan nomor sesudah Z (keputusan 59) salah di PDF biasa maupun salinan, walau RTF/Word benar.
 *
 * Perbaikan di bot (nomorHalamanSoffice + abtCetakService): sebelum bagian yang harus mulai di N > 1 disisipkan bagian bantu
 * N-1 halaman (LibreOffice menomorinya, bagian asli dilanjutkan), PDF diubah sekali, halaman bantu dibuang (pembaruan
 * bertambah). Tata letak halaman asli sama persis dengan konversi langsung (diukur: geseran 0,000 pt pada 9 naskah).
 *
 * Nomor yang diharapkan = hasil Word laptop (diukur 3 Nov, skrip zcross/word-ubah.ps1) atas RTF yang sama:
 *   BAS ALUR 04 [3] rekaan, runut 1 / 7 / 20, bagian lampiran melompat ke awal+4:  [1,5,6] / [7,11,12] / [20,24,25]
 * (juga diukur, tidak dijadikan fixture: BAS ALUR 04 [1] empat bagian & BAS ALUR 02 [2] ber-Z - seluruhnya sama dengan Word).
 * PDF *-lo74.pdf = keluaran rtfKePdf kode ini di container aleta-bot; sidik.json mengikat PDF itu ke RTF yang diterima
 * LibreOffice. Bila penyusunan halaman bantu sengaja diubah: buat ulang PDF dengan LibreOffice 7.4 lalu perbarui sidik.json.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { muatPdfjs } from "@/server/modules/aleta-ecourt/baca-pdf";
import { pasangNomorAwalRtf, pasangNomorBagian } from "@/server/modules/aleta-ecourt/bas-halaman/naskah";

const AKAR = path.resolve(process.cwd(), "..");
const FIX = path.join(process.cwd(), "src/test/fixtures/nomor-halaman-3nov");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Rencana = { bagian: Array<{ mulai: number | null }>; perlu: boolean; ganjilGenap?: boolean };
const nomor = muat("./services/nomorHalamanSoffice.js") as {
  rencanaNomor: (rtf: string) => Rencana;
  sisipkanHalamanBantu: (rtf: string, r: Rencana) => { rtf: string; blok: number[] } | null;
  buangHalamanBantu: (pdf: Buffer, blok: number[]) => Buffer | null;
};
const cetak = muat("./services/abtCetakService.js") as {
  tanpaTandaAletaMetadata: (b: Buffer) => Buffer;
  normalkanBahasaRtf: (b: Buffer) => Buffer;
  rtfKePdf: (b: Buffer) => Promise<{ ok: boolean; pdf?: Buffer; alasan?: string }>;
};
const rapi = muat("./services/rtfSofficeRapi.js") as { rapikanUntukSoffice: (b: Buffer) => { isi: Buffer } };

const B = "\\";
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const SIDIK = JSON.parse(readFileSync(path.join(FIX, "sidik.json"), "utf8")) as Record<string, { masuk: string; keLibreOffice: string; blok: number[] }> & {
  tigaBagianBantu: string;
  blokTigaBagian: number[];
};
const WORD: Record<number, number[]> = { 1: [1, 5, 6], 7: [7, 11, 12], 20: [20, 24, 25] };

/** BAS ALUR 04 [3] rekaan seperti keluaran portal: runut (pasangNomorAwalRtf) + lompatan bagian lampiran ke awal+4. */
function basRunut(awal: number): Buffer {
  const asal = readFileSync(path.join(process.cwd(), "src/test/fixtures/ttd-salinan-3nov/bas-04-3-masuk.rtf"));
  const r = pasangNomorAwalRtf(new Uint8Array(asal), awal);
  return Buffer.from(pasangNomorBagian(r.bita, "rtf", new Map([[1, awal + 4]])));
}
/** RTF yang diterima LibreOffice di rtfKePdf (rapikan -> bahasa -> tanpa tanda -> halaman bantu). */
function keLibreOffice(rtf: Buffer) {
  const siap = cetak.tanpaTandaAletaMetadata(cetak.normalkanBahasaRtf(rapi.rapikanUntukSoffice(rtf).isi)).toString("latin1");
  return nomor.sisipkanHalamanBantu(siap, nomor.rencanaNomor(siap));
}
/** Nomor halaman tercetak di kaki tiap halaman (angka tunggal di 10% bawah halaman). */
async function nomorKaki(pdf: Uint8Array): Promise<string[]> {
  const pdfjs = await muatPdfjs();
  const dok = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, isEvalSupported: false }).promise;
  const hasil: string[] = [];
  try {
    for (let n = 1; n <= dok.numPages; n += 1) {
      const h = await dok.getPage(n);
      const tinggi = (h.view as number[])[3];
      const isi = await h.getTextContent();
      const kaki = (isi.items as Array<{ str?: string; transform?: number[] }>).filter((x) => x.str && /^\d{1,4}$/.test(x.str.trim()) && (x.transform?.[5] ?? 999) < 0.1 * tinggi);
      hasil.push(kaki.map((x) => x.str!.trim()).join("+") || "-");
    }
  } finally {
    await dok.destroy();
  }
  return hasil;
}
const rtfBagian = (bagian: string[], dokumen = "") =>
  `{${B}rtf1${B}ansi${B}deff0{${B}fonttbl{${B}f0 Arial;}}${B}paperw11906${B}paperh16838${dokumen}` +
  bagian.map((sifat, i) => `${B}sectd${sifat}{${B}footer ${B}pard{${B}field{${B}*${B}fldinst PAGE}{${B}fldrslt 1}}${B}par}${B}pard Isi bagian ${i + 1}.${B}par`).join(`${B}sect`) +
  "}";

// ============================================================================
describe("1. aturan Word dibaca dari RTF (rencanaNomor)", () => {
  it("bagian pertama, mulai ulang, lanjut, nomor dokumen; \\pgnstarts tanpa \\pgnrestart diabaikan (seperti Word)", () => {
    expect(nomor.rencanaNomor(rtfBagian([`${B}pgnrestart${B}pgnstarts7`, `${B}pgncont`, `${B}pgnrestart${B}pgnstarts50`]))).toMatchObject({
      bagian: [{ mulai: 7 }, { mulai: null }, { mulai: 50 }],
      perlu: true,
    });
    expect(nomor.rencanaNomor(rtfBagian([`${B}pgnstarts7`, `${B}pgnstarts50`]))).toMatchObject({ bagian: [{ mulai: 1 }, { mulai: null }], perlu: false });
    expect(nomor.rencanaNomor(rtfBagian(["", `${B}pgnrestart${B}pgnstarts50`], `${B}pgnstart7`))).toMatchObject({ bagian: [{ mulai: 7 }, { mulai: 50 }], perlu: true });
    // mulai 1 di semua bagian = LibreOffice sudah sama -> tidak disentuh
    expect(nomor.rencanaNomor(rtfBagian([`${B}pgnrestart${B}pgnstarts1`, `${B}pgnrestart${B}pgnstarts1`])).perlu).toBe(false);
    // bagian bersambung (tanpa halaman baru) tidak membuka halaman
    expect(nomor.rencanaNomor(rtfBagian([`${B}pgnrestart${B}pgnstarts7`, `${B}sbknone`, `${B}pgnrestart${B}pgnstarts9`])).bagian.map((b) => b.mulai)).toEqual([7, 9]);
    // putusan tanpa nomor awal: tidak pernah lewat halaman bantu
    expect(nomor.rencanaNomor(`{${B}rtf1 ${B}sectd ${B}pard isi${B}par}`).perlu).toBe(false);
  });

  it("tidak dipakai bila halaman bantu dapat mengubah halaman lain: ganjil/genap, cermin, jumlah halaman", () => {
    const dasar = rtfBagian([`${B}pgnrestart${B}pgnstarts7`]);
    expect(nomor.sisipkanHalamanBantu(dasar, nomor.rencanaNomor(dasar))).not.toBeNull();
    for (const ubah of [dasar.replace(`${B}paperh16838`, `${B}paperh16838${B}facingp`), dasar.replace(`${B}pgnstarts7`, `${B}pgnstarts7${B}sbkodd`), dasar.replace("Isi bagian 1.", "Halaman {\\field{\\*\\fldinst NUMPAGES}}")]) {
      expect(nomor.sisipkanHalamanBantu(ubah, nomor.rencanaNomor(ubah))).toBeNull();
    }
  });

  it("BAS ALUR 04 [3] runut 1/7/20: rencana sesuai Word; RTF ke LibreOffice tetap sama dengan sidik fixture PDF", () => {
    for (const awal of [1, 7, 20]) {
      const rtf = basRunut(awal);
      const s = SIDIK[`bas04_3_r${awal}`];
      expect(md5(rtf), `RTF runut ${awal}`).toBe(s.masuk);
      expect(nomor.rencanaNomor(rtf.toString("latin1")).bagian.map((b) => b.mulai)).toEqual([awal, awal + 4]);
      const ke = keLibreOffice(rtf)!;
      expect(ke.blok).toEqual(s.blok);
      expect(md5(Buffer.from(ke.rtf, "latin1")), `RTF ke LibreOffice runut ${awal} berubah - buat ulang bas-04-3-r${awal}-lo74.pdf`).toBe(s.keLibreOffice);
    }
  });
});

describe("2. PDF LibreOffice 7.4: halaman bantu dibuang, nomor sama dengan Word", () => {
  it("PDF mentah berhalaman bantu (tiga bagian: mulai 7, lanjut, mulai ulang 50) -> 3 halaman bernomor 7, 8, 50; pdf-lib dapat memuatnya", async () => {
    const rtf = readFileSync(path.join(FIX, "tiga-bagian.rtf"), "latin1");
    const h = nomor.sisipkanHalamanBantu(rtf, nomor.rencanaNomor(rtf))!;
    expect(md5(Buffer.from(h.rtf, "latin1"))).toBe(SIDIK.tigaBagianBantu);
    expect(h.blok).toEqual([6, 49]);
    const mentah = readFileSync(path.join(FIX, "tiga-bagian-bantu-lo74.pdf"));
    expect((await nomorKaki(new Uint8Array(mentah))).length).toBe(58);
    const bersih = nomor.buangHalamanBantu(mentah, h.blok)!;
    expect(bersih).not.toBeNull();
    expect(await nomorKaki(new Uint8Array(bersih))).toEqual(["7", "8", "50"]);
    expect((await PDFDocument.load(new Uint8Array(bersih))).getPageCount()).toBe(3);
    // isi halaman tidak berubah (pembaruan bertambah: bita lama utuh di depan)
    expect(bersih.subarray(0, mentah.length).equals(mentah)).toBe(true);
    // blok yang tidak cocok dengan halaman bertanda -> null (pemanggil mengubah ulang tanpa halaman bantu)
    expect(nomor.buangHalamanBantu(mentah, [6, 48])).toBeNull();
    expect(nomor.buangHalamanBantu(mentah, [5, 49])).toBeNull();
  });

  it("BAS ALUR 04 [3] runut 1, 7, 20 (rtfKePdf di container aleta-bot): nomor kaki = Word, tiga halaman", async () => {
    for (const awal of [1, 7, 20]) {
      const pdf = new Uint8Array(readFileSync(path.join(FIX, `bas-04-3-r${awal}-lo74.pdf`)));
      expect(await nomorKaki(pdf), `runut ${awal}`).toEqual(WORD[awal].map(String));
    }
  });
});

// ----------------------------------------------------------------------------
// 3. Konversi baru (hanya bila soffice ada: server / sesi awan)
// ----------------------------------------------------------------------------
const adaSoffice = (() => {
  try {
    execFileSync(process.env.ALETA_SOFFICE || "soffice", ["--version"], { stdio: "ignore", timeout: 20000 });
    return true;
  } catch {
    return false;
  }
})();

describe("3. rtfKePdf langsung (bila soffice ada)", () => {
  it.skipIf(!adaSoffice)("BAS runut 1/7/20 dan tiga bagian: nomor kaki = Word; dimatikan (ALETA_NOMOR_HALAMAN_PDF=mati) = cara lama", async () => {
    for (const awal of [1, 7, 20]) {
      const h = await cetak.rtfKePdf(basRunut(awal));
      expect(h.ok, h.alasan).toBe(true);
      expect(await nomorKaki(new Uint8Array(h.pdf!))).toEqual(WORD[awal].map(String));
    }
    const tiga = await cetak.rtfKePdf(readFileSync(path.join(FIX, "tiga-bagian.rtf")));
    expect(await nomorKaki(new Uint8Array(tiga.pdf!))).toEqual(["7", "8", "50"]);
    const lama = process.env.ALETA_NOMOR_HALAMAN_PDF;
    process.env.ALETA_NOMOR_HALAMAN_PDF = "mati";
    try {
      const m = await cetak.rtfKePdf(readFileSync(path.join(FIX, "tiga-bagian.rtf")));
      expect(await nomorKaki(new Uint8Array(m.pdf!))).toEqual(["1", "2", "1"]);
    } finally {
      if (lama === undefined) delete process.env.ALETA_NOMOR_HALAMAN_PDF;
      else process.env.ALETA_NOMOR_HALAMAN_PDF = lama;
    }
  }, 300_000);
});
