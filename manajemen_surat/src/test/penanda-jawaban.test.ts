/**
 * Penanda eksepsi & rekonvensi dari jawaban/duplik Tergugat (butir 4, 6 Okt 2026).
 *
 * Kalimat "SUNGGUHAN" di bawah dipetik dari jawaban/duplik di arsip e-Court
 * satker (diukur 6 Okt 2026, 23 dokumen) - nama, nomor perkara, dan angka
 * dianonimkan, ejaan dan salah ketiknya dibiarkan (rekonpesi, rekopensi, "a
 * guo" hasil OCR). Penyangkalan disusun menurut bentuk yang lazim dalam
 * jawaban; arsip satker belum memuat satu pun.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { CONTOH_TAMPILAN } from "@/components/portal/contoh-tampilan";
import { PenandaJawabanAgenda } from "@/components/portal/penanda-jawaban-agenda";
import { deteksiEksepsiRekonvensi, teksTerbaca, VERSI_DETEKSI_JAWABAN } from "@/lib/deteksi-eksepsi-rekonvensi";
import { buatDocx } from "@/lib/docx";
import { penandaJawabanBaris, type PenandaJawabanPerkara } from "@/lib/penanda-jawaban";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";
import {
  aturUlangPemicu,
  bacaTeksJawaban,
  gambarDariDocx,
  hasilDariTeks,
  jenisIsi,
  picuPindaiJawaban,
  pindaiPenandaJawaban,
  type DepsPindai,
} from "@/server/modules/aleta-ecourt/penanda-jawaban";
import type { BerkasJawabanAntri, HasilBacaJawaban } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));
const layanan = require_(path.join(akar, "aleta_bot/services/penandaJawabanService.js")) as {
  ringkasPerPerkara: (rows: Array<Record<string, unknown>>) => Record<string, PenandaJawabanPerkara>;
  SQL_KANDIDAT: string;
};
const layar = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");
const jadwalBot = readFileSync(path.join(akar, "aleta_bot/services/sippJadwalSidangService.js"), "utf8");

// ---------------------------------------------------------------------------
// Kalimat sungguhan (dianonimkan)
// ---------------------------------------------------------------------------
const EKSEPSI_JAWABAN = [
  "Perihal : Eksepsi dan Jawaban",
  "Bahwa Tergugat dengan ini bermaksud mengajukan Eksepsi dan Jawaban atas surat gugatan Penggugat dengan uraian sebagai berikut :",
  "A. DALAM EKSEPSI",
  "1. Bahwa dalil pada bagian eksepsi tersebut diatas mutatis mutandis dengan dalil jawaban Tergugat pada bahagian pokok perkara;",
  "Dalam Eksepsi",
  "1. Mengabulkan Eksepsi Tergugat Untuk Seluruhnya;",
].join("\n");

const EKSEPSI_DUPLIK =
  "DALAM EKSEPSI\nBahwa Tergugat secara tegas menolak dalil-dalil Penggugat sebagai tanggapan atas eksepsi Tergugat sebagaimana dalam repliknya serta pada pokoknya berketetapan pada dalil-dalil eksepsinya.";

const REKONVENSI_JAWABAN =
  "JAWABAN DAN GUGATAN REKONVENSI\nDengan ini hendak mengajukan, Jawaban/Gugatan Balik (Rekonvensi) dalam Perkara Perdata Nomor NNN/Pdt.G/2026/PA.Dgl. Yang pada intinya sebagai berikut: --\nDALAM REKONVENSI\nBahwa Termohon selanjutnya disebut sebagai Penggugat Rekonvensi dan Pemohon adalah Tergugat Rekonvensi; ----";

const REKONVENSI_SALAH_EJA =
  "B. DALAM REKONVENSI\nBahwa pada prinsipnya penggugat rekonpesi menolak secara tegas dalil-dalil tergugat Rekonpensi, terkecuali dalil penggugat rekonpensi yang diakui oleh tergugat rekopensi kebenarannya;";

/** Hasil OCR pindaian - "a guo" untuk "a quo". */
const REKONVENSI_OCR =
  "Periha! : Jawaban Termohon dalam Konvensi dan Gugatan Rekonvensi\nperkara a guo Termohon mengajukan hak-hak melalui gugatan balik rekonvensi kerena itu\nPemohon Konvensi selanjutnya disebut Penggugat Rekonvensi dan penggugat Konvensi\nselanjutnya disebut tergugat Rekonvensi\nII. DALAM REKONVENSI";

/** Jawaban sungguhan tanpa eksepsi dan tanpa rekonvensi - menuntut hak, tetapi tidak sebagai gugatan balik. */
const TANPA_KEDUANYA = [
  "Perihal : Jawaban Termohon",
  "Yang bertanda tangan di bawah ini, AAAA binti BBBB sebagai Saya dengan ini mengajukan Jawaban atas permohonan Pemohon sebagai berikut:",
  "Bahwa membenarkan point 1 Permohonan Pemohon",
  "Bahwa tidak membenarkan Point 2 Permohonan Pemohon, yang benar adalh hingga saat ini kami tidak berpisah rumah dan masih tinggal dirumah bersama di Desa CCCC;",
  "Bahwa Saya tidak membenarkan point 6 Permohonan Pemohon, karena hingga saat ini antara saya dan Pemohon tidak penah terjadi mediasi atau di rukunkan oleh keluarga.;",
  "Bahwa Saya tidak keberatan untuk bercerai dengan Pemohon akan tetapi saya menuntut hak-hak saya antara lain: Nafkah Mut'ah sebesar Rp.250.000",
].join("\n");

describe("deteksi atas kalimat sungguhan", () => {
  it("eksepsi jawaban: petitum 'Mengabulkan Eksepsi Tergugat' - KUAT, kalimatnya ikut", () => {
    const h = deteksiEksepsiRekonvensi(EKSEPSI_JAWABAN, "Eksepsi dan Jawaban Tergugat");
    expect(h.eksepsi.keadaan).toBe("ada");
    expect(h.eksepsi.tingkat).toBe("kuat");
    expect(h.eksepsi.kalimat).toMatch(/Eksepsi/);
    expect(h.rekonvensi.keadaan).toBe("");
  });

  it("eksepsi duplik: 'tanggapan atas eksepsi Tergugat' = eksepsi Tergugat sendiri", () => {
    const h = deteksiEksepsiRekonvensi(EKSEPSI_DUPLIK, "Duplik Tergugat");
    expect(h.eksepsi).toMatchObject({ keadaan: "ada", tingkat: "kuat" });
    expect(h.eksepsi.kalimat).toContain("tanggapan atas eksepsi Tergugat");
  });

  it("rekonvensi: 'Gugatan Balik (Rekonvensi)' dan sebutan 'Penggugat Rekonvensi'", () => {
    const h = deteksiEksepsiRekonvensi(REKONVENSI_JAWABAN, "Jawaban dan Gugatan Rekonvensi");
    expect(h.rekonvensi).toMatchObject({ keadaan: "ada", tingkat: "kuat" });
    expect(h.eksepsi.keadaan).toBe("");
  });

  it("rekonvensi bersalah eja (rekonpesi, rekonpensi, rekopensi) tetap dikenali", () => {
    const h = deteksiEksepsiRekonvensi(REKONVENSI_SALAH_EJA, "Duplik Konvensi/ Replik Rekonvensi");
    expect(h.rekonvensi).toMatchObject({ keadaan: "ada", tingkat: "kuat" });
  });

  it("rekonvensi dari teks OCR pindaian", () => {
    expect(deteksiEksepsiRekonvensi(REKONVENSI_OCR).rekonvensi.keadaan).toBe("ada");
  });

  it("jawaban tanpa keduanya: 'mengajukan Jawaban', 'tidak membenarkan', tuntutan mut'ah - BUKAN eksepsi/rekonvensi", () => {
    const h = deteksiEksepsiRekonvensi(TANPA_KEDUANYA, "Jawaban dari Termohon");
    expect(h.eksepsi.keadaan).toBe("");
    expect(h.rekonvensi.keadaan).toBe("");
  });

  it("kata yang dipenggal di ujung baris PDF disambung", () => {
    expect(deteksiEksepsiRekonvensi("selanjutnya disebut Penggugat Rekon-\nvensi;").rekonvensi.keadaan).toBe("ada");
  });
});

describe("menyebut BUKAN mengajukan - penyangkalan", () => {
  it("'tidak mengajukan eksepsi' = tidak", () => {
    const h = deteksiEksepsiRekonvensi("Bahwa Tergugat tidak mengajukan eksepsi dan langsung menanggapi pokok perkara.");
    expect(h.eksepsi).toMatchObject({ keadaan: "tidak", tingkat: "negasi" });
    expect(h.eksepsi.kalimat).toContain("tidak mengajukan eksepsi");
  });

  it("judul bagian 'DALAM EKSEPSI' yang isinya menyangkal = tidak (judul bagian kalah oleh penyangkalan)", () => {
    const h = deteksiEksepsiRekonvensi("DALAM EKSEPSI\nBahwa Tergugat tidak mengajukan eksepsi.\nDALAM POKOK PERKARA\nBahwa Tergugat menolak dalil gugatan.");
    expect(h.eksepsi.keadaan).toBe("tidak");
  });

  it("satu penyangkalan untuk dua: 'tidak mengajukan eksepsi maupun gugatan rekonvensi'", () => {
    const h = deteksiEksepsiRekonvensi("Bahwa Termohon tidak mengajukan eksepsi maupun gugatan rekonvensi dalam perkara a quo.");
    expect(h.eksepsi.keadaan).toBe("tidak");
    expect(h.rekonvensi.keadaan).toBe("tidak");
  });

  it("'tidak akan mengajukan gugatan balik', 'tanpa rekonvensi', 'Dalam Eksepsi : Nihil'", () => {
    expect(deteksiEksepsiRekonvensi("Termohon tidak akan mengajukan gugatan balik.").rekonvensi.keadaan).toBe("tidak");
    expect(deteksiEksepsiRekonvensi("Jawaban ini disampaikan tanpa rekonvensi.").rekonvensi.keadaan).toBe("tidak");
    expect(deteksiEksepsiRekonvensi("Dalam Eksepsi : Nihil\nDalam Pokok Perkara: menolak gugatan.").eksepsi.keadaan).toBe("tidak");
  });

  it("eksepsi milik PENGGUGAT (dalam duplik Tergugat) bukan eksepsi Tergugat", () => {
    const h = deteksiEksepsiRekonvensi("Bahwa Tergugat menanggapi eksepsi Penggugat yang termuat dalam repliknya sebagai berikut.");
    expect(h.eksepsi.keadaan).toBe("");
  });

  it("bukti KUAT mengalahkan penyangkalan, dan penyangkalan SEMPIT ('tidak berdasar sebagaimana dalam eksepsi' bukan penyangkalan)", () => {
    const h = deteksiEksepsiRekonvensi(
      "Bahwa dalil Penggugat tidak berdasar sebagaimana dalam eksepsi Tergugat. Bahwa Tergugat tidak mengajukan eksepsi lain. Mengabulkan eksepsi Tergugat untuk seluruhnya;"
    );
    expect(h.eksepsi).toMatchObject({ keadaan: "ada", tingkat: "kuat" });
  });

  it("judul dokumen saja (teks tidak menyebut) = bukti sedang", () => {
    const h = deteksiEksepsiRekonvensi("Bahwa Termohon menolak dalil Pemohon untuk seluruhnya. ".repeat(10), "Jawaban Konvensi dan Gugatan Rekonvensi");
    expect(h.rekonvensi).toMatchObject({ keadaan: "ada", tingkat: "sedang" });
    expect(h.rekonvensi.kalimat).toContain("judul dokumen");
  });
});

describe("tidak terbaca BUKAN 'tidak ada'", () => {
  it("sisa huruf pindaian tanpa OCR tidak dianggap terbaca", () => {
    expect(teksTerbaca(" \n 1 \n\n 2 ")).toBe(false);
    expect(teksTerbaca(TANPA_KEDUANYA)).toBe(true);
  });

  it("hasil tak terbaca dikirim terbaca=false, keadaan kosong, sebabnya disebut - bukan 'tidak'", () => {
    const h = hasilDariTeks("f1", "Jawaban dari Tergugat", { teks: "", sumber: "", sebab: "pindaian_ocr_belum_tersedia" });
    expect(h).toMatchObject({ terbaca: false, eksepsi: "", rekonvensi: "", sebab: "pindaian_ocr_belum_tersedia", versi: VERSI_DETEKSI_JAWABAN });
  });

  it("judul dokumen TIDAK dipakai bila naskahnya tidak terbaca", () => {
    const h = hasilDariTeks("f1", "Jawaban dan Gugatan Rekonvensi", { teks: "", sumber: "", sebab: "teks_kosong" });
    expect(h.rekonvensi).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Pembaca berkas
// ---------------------------------------------------------------------------
function docxTeks(alinea: string[]): Buffer {
  return buatDocx({ alinea: alinea.map((teks) => ({ teks })) });
}

/** PNG palsu (berkepala PNG) yang cukup besar untuk dianggap halaman pindaian. */
function pngPalsu(n: number): Buffer {
  const b = Buffer.alloc(30_000, n);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  return b;
}

describe("pembaca berkas jawaban", () => {
  it("jenis dari bait awal: berkas 'word' e-Court bernama .pdf tetapi DOCX", () => {
    expect(jenisIsi(docxTeks(["a"]))).toBe("docx");
    expect(jenisIsi(Buffer.from("%PDF-1.7\n..."))).toBe("pdf");
    expect(jenisIsi(Buffer.from("{\\rtf1 ..."))).toBe("rtf");
    expect(jenisIsi(Buffer.from("halo"))).toBeNull();
  });

  it("DOCX berteks dibaca tanpa OCR", async () => {
    let ocr = 0;
    const t = await bacaTeksJawaban(docxTeks(EKSEPSI_JAWABAN.split("\n").concat(TANPA_KEDUANYA.split("\n"))), {
      ocrAda: async () => true,
      ocrGambar: async () => {
        ocr += 1;
        return "";
      },
      halamanPdf: async () => [],
    });
    expect(t.sumber).toBe("teks");
    expect(ocr).toBe(0);
    expect(deteksiEksepsiRekonvensi(t.teks).eksepsi.keadaan).toBe("ada");
  });

  it("DOCX berisi gambar pindaian: gambarnya diurutkan per halaman lalu di-OCR; tanpa mesin OCR = tidak terbaca", async () => {
    const docx = buatDocx({
      blok: [1, 2, 3].map((n) => ({ jenis: "gambar" as const, data: pngPalsu(n), lebar: 10, tinggi: 14 })),
    });
    const gambar = gambarDariDocx(docx);
    expect(gambar.length).toBe(3);
    expect(gambar.map((g) => g[100])).toEqual([1, 2, 3]);

    const dibaca: number[] = [];
    const t = await bacaTeksJawaban(docx, {
      ocrAda: async () => true,
      ocrGambar: async (g) => {
        dibaca.push(g[100]);
        return g[100] === 2 ? REKONVENSI_OCR.repeat(3) : "";
      },
      halamanPdf: async () => [],
    });
    expect(dibaca).toEqual([1, 2, 3]);
    expect(t.sumber).toBe("ocr");

    const tanpa = await bacaTeksJawaban(docx, { ocrAda: async () => false, ocrGambar: async () => "x", halamanPdf: async () => [] });
    expect(tanpa).toMatchObject({ sumber: "", sebab: "pindaian_ocr_belum_tersedia" });
  });
});

describe("pindaiPenandaJawaban: satu putaran", () => {
  const antri = (fileId: string, documentKey: string, format: string, judul = "Jawaban dari Termohon"): BerkasJawabanAntri => ({
    fileId,
    documentKey,
    format,
    ukuran: 1000,
    nomorPerkara: "NNN/Pdt.G/2026/PA.Dgl",
    judul,
    jenis: "Jawaban",
  });

  function deps(berkas: BerkasJawabanAntri[], isi: Record<string, Buffer>, ocrTeks = "") {
    const terkirim: HasilBacaJawaban[][] = [];
    let halamanPdfDipanggil = 0;
    let waktu = 0;
    const d: DepsPindai = {
      antrian: async () => berkas,
      ambil: async (id) => isi[id] ?? null,
      kirim: async (h) => {
        terkirim.push(h);
        return true;
      },
      ocrAda: async () => true,
      ocrGambar: async () => ocrTeks,
      halamanPdf: async () => {
        halamanPdfDipanggil += 1;
        return [pngPalsu(9)];
      },
      sekarang: () => (waktu += 1),
    };
    return { d, terkirim, halamanPdf: () => halamanPdfDipanggil };
  }

  it("dokumen yang DOCX-nya berteks: PDF pindaiannya ikut bernilai sama, OCR tidak dijalankan", async () => {
    // PDF "pindaian": bukan PDF yang dapat diurai -> lapisan teks kosong.
    const { d, terkirim, halamanPdf } = deps([antri("p", "D1", "pdf"), antri("w", "D1", "word")], {
      p: Buffer.from("%PDF-1.4 rusak"),
      w: docxTeks(REKONVENSI_JAWABAN.split("\n")),
    });
    const r = await pindaiPenandaJawaban(["NNN/Pdt.G/2026/PA.Dgl"], d);
    expect(halamanPdf()).toBe(0);
    expect(r.dibaca).toBe(2);
    const w = terkirim[0].find((x) => x.fileId === "w")!;
    expect(w).toMatchObject({ terbaca: true, sumber: "teks", rekonvensi: "ada" });
    // Berkas PDF-nya sendiri tidak terbaca - dicatat jujur, tidak "tidak".
    expect(terkirim[0].find((x) => x.fileId === "p")).toMatchObject({ terbaca: false, rekonvensi: "" });
  });

  it("seluruh berkas pindaian: OCR SEKALI per dokumen, hasilnya berlaku bagi PDF dan DOCX-nya", async () => {
    const { d, terkirim, halamanPdf } = deps(
      [antri("p", "D2", "pdf"), antri("w", "D2", "word")],
      { p: Buffer.from("%PDF-1.4 pindaian"), w: docxTeks(["."]) },
      EKSEPSI_JAWABAN.repeat(2)
    );
    await pindaiPenandaJawaban([], d);
    expect(halamanPdf()).toBe(1);
    expect(terkirim[0].map((x) => [x.fileId, x.sumber, x.eksepsi])).toEqual([
      ["p", "ocr", "ada"],
      ["w", "ocr", "ada"],
    ]);
  });

  it("pemicu: tidak ditunggu, satu putaran per proses, berjeda", () => {
    aturUlangPemicu();
    const { d } = deps([], {});
    let jam = 1_000_000;
    d.sekarang = () => jam;
    expect(picuPindaiJawaban([], d)).toBe(true);
    expect(picuPindaiJawaban([], d)).toBe(false);
    jam += 61_000;
    // Putaran pertama sudah selesai (antrian kosong) sesudah microtask.
    return Promise.resolve().then(async () => {
      await new Promise((r) => setTimeout(r, 0));
      expect(picuPindaiJawaban([], d)).toBe(true);
      aturUlangPemicu();
    });
  });
});

// ---------------------------------------------------------------------------
// Bot: ringkasan per perkara (murni) dan sambungannya ke daftarSidang
// ---------------------------------------------------------------------------
describe("bot: ringkasPerPerkara", () => {
  const baris = (o: Record<string, unknown>) => ({
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    documentKey: "D1",
    judul: "Jawaban dari Tergugat",
    jenis: "Jawaban",
    diunggahPada: "2026-07-12 20:31:00",
    fileIdCache: "f",
    terbaca: 1,
    sumberTeks: "teks",
    eksepsi: "",
    kalimatEksepsi: "",
    rekonvensi: "",
    kalimatRekonvensi: "",
    ...o,
  });

  it("belum dibaca / tidak terbaca saja = null (layar diam), BUKAN 'tidak ada'", () => {
    const p = layanan.ringkasPerPerkara([baris({ fileIdCache: null }), baris({ terbaca: 0 })])["1/Pdt.G/2026/PA.Dgl"];
    expect(p).toMatchObject({ eksepsi: null, rekonvensi: null, belumDibaca: 1, tidakTerbaca: 1, dibaca: 0, dokumen: 1, berkas: 2 });
  });

  it("'ada' dari dokumen mana pun menang; sumbernya dokumen TERAWAL yang mengajukan", () => {
    const peta = layanan.ringkasPerPerkara([
      baris({ documentKey: "D2", judul: "Duplik Tergugat", jenis: "Duplik", diunggahPada: "2026-07-20 09:00:00", eksepsi: "ada", kalimatEksepsi: "duplik" }),
      baris({ eksepsi: "ada", kalimatEksepsi: "Mengabulkan Eksepsi Tergugat", rekonvensi: "tidak", kalimatRekonvensi: "tidak mengajukan rekonvensi" }),
      baris({ eksepsi: "" }),
    ]);
    const p = peta["1/Pdt.G/2026/PA.Dgl"];
    expect(p.eksepsi).toMatchObject({ keadaan: "ada", dokumen: "Jawaban dari Tergugat", jenisDokumen: "Jawaban", diunggah: "2026-07-12", kalimat: "Mengabulkan Eksepsi Tergugat" });
    expect(p.rekonvensi?.keadaan).toBe("tidak");
    expect(p.dokumen).toBe(2);
  });

  it("hanya unggahan Tergugat berjenis Jawaban/Duplik yang dibaca", () => {
    expect(layanan.SQL_KANDIDAT).toContain("d.peran_pengunggah = 'Tergugat'");
    expect(layanan.SQL_KANDIDAT).toContain("'Jawaban', 'Duplik'");
  });

  it("daftarSidang mengirim penandaJawaban per baris dari SATU kueri untuk seluruh daftar, gagal = Terbaca false", () => {
    expect(jadwalBot).toContain("penandaJawabanService.petaBanyakPerkara(rows.map((row) => cleanText(row.nomorPerkara)))");
    expect(jadwalBot).toContain("penandaJawaban: petaJawaban[cleanText(row.nomorPerkara)] || null");
    expect(jadwalBot).toContain('penandaJawabanTerbaca: !gagal.has("penanda-jawaban")');
  });
});

// ---------------------------------------------------------------------------
// Layar
// ---------------------------------------------------------------------------
describe("penanda di kolom Agenda", () => {
  const temuan = (keadaan: "ada" | "tidak" | "", sumber: "teks" | "ocr" = "teks") => ({
    keadaan,
    dokumen: "Eksepsi dan Jawaban Tergugat",
    jenisDokumen: "Jawaban",
    diunggah: "2026-09-15",
    kalimat: "Mengabulkan Eksepsi Tergugat Untuk Seluruhnya;",
    sumber,
  });
  const perkara = (o: Partial<PenandaJawabanPerkara>): PenandaJawabanPerkara => ({
    eksepsi: null,
    rekonvensi: null,
    dokumen: 1,
    berkas: 2,
    dibaca: 2,
    belumDibaca: 0,
    tidakTerbaca: 0,
    ...o,
  });

  beforeEach(() => aturUlangPemicu());

  it("hanya 'ada' yang menyala; 'tidak', '', null, kueri gagal, dan bot lama DIAM", () => {
    const n = "1/Pdt.G/2026/PA.Dgl";
    expect(penandaJawabanBaris({ nomorPerkara: n })).toEqual([]);
    expect(penandaJawabanBaris({ nomorPerkara: n, penandaJawaban: null })).toEqual([]);
    expect(penandaJawabanBaris({ nomorPerkara: n, penandaJawaban: perkara({ eksepsi: temuan("tidak"), rekonvensi: temuan("") }) })).toEqual([]);
    expect(
      penandaJawabanBaris({ nomorPerkara: n, penandaJawaban: perkara({ eksepsi: temuan("ada") }), penandaJawabanTerbaca: false })
    ).toEqual([]);
    const ada = penandaJawabanBaris({
      nomorPerkara: n,
      penandaJawaban: perkara({ eksepsi: temuan("ada"), rekonvensi: temuan("ada", "ocr") }),
      penandaJawabanTerbaca: true,
    });
    expect(ada.map((x) => x.label)).toEqual(["Eksepsi", "Rekonvensi"]); // huruf awal kapital (12 Okt 2026)
    // Warna terbedakan.
    expect(ada[0].kelas).not.toBe(ada[1].kelas);
    // Title: dokumen sumber + kalimat pemicu; OCR disebut.
    expect(ada[0].keterangan).toContain('"Eksepsi dan Jawaban Tergugat"');
    expect(ada[0].keterangan).toContain("Mengabulkan Eksepsi Tergugat Untuk Seluruhnya;");
    expect(ada[1].keterangan).toContain("OCR");
  });

  it("komponen: tombol ber-data-penanda-jawaban, title, ditekan = membuka; kosong = tidak digambar", () => {
    const html = renderToStaticMarkup(
      createElement(PenandaJawabanAgenda, {
        baris: { nomorPerkara: "1", penandaJawaban: perkara({ rekonvensi: temuan("ada") }), penandaJawabanTerbaca: true },
        onBuka: () => undefined,
      })
    );
    expect(html).toContain('data-penanda-jawaban="rekonvensi"');
    expect(html).not.toContain('data-penanda-jawaban="eksepsi"');
    expect(html).toContain("title=");
    expect(html).not.toContain('disabled=""');
    expect(renderToStaticMarkup(createElement(PenandaJawabanAgenda, { baris: { nomorPerkara: "1" } }))).toBe("");
  });

  it("dipasang di kolom Agenda di bawah saklar penanda-jawaban, membuka Status Perkara", () => {
    const i = layar.indexOf('tampil(tampilan, "penanda-jawaban") ? (');
    expect(i).toBeGreaterThan(-1);
    const blok = layar.slice(i, i + 400);
    expect(blok).toContain("<PenandaJawabanAgenda");
    expect(blok).toContain("onBukaStatus(baris.nomorPerkara)");
    // Sesudah penanda mediasi, sebelum umur perkara - di sel Agenda yang sama.
    expect(i).toBeGreaterThan(layar.indexOf("<PenandaMediasiAgenda"));
    expect(i).toBeLessThan(layar.indexOf("<UmurPerkara durasi={baris.durasi}"));
  });

  it("saklar tampilan: kelompok penanda, menyala bawaan, tidak wajib, punya contoh", () => {
    const s = SAKLAR_TAMPILAN.find((x) => x.kunci === "penanda-jawaban");
    expect(s).toMatchObject({ kelompok: "penanda" });
    expect(s?.wajib ?? false).toBe(false);
    expect(tampil(tampilanBawaan(), "penanda-jawaban")).toBe(true);
    expect(CONTOH_TAMPILAN["penanda-jawaban"]).toBeTruthy();
  });
});
