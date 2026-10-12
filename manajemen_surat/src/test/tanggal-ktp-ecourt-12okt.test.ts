// @vitest-environment node
/**
 * ============================================================================
 * TANGGAL KTP PIHAK DARI BERKAS KTP e-COURT (12 Okt 2026, butir 14-15)
 * ============================================================================
 *
 * Yang diuji PERILAKUNYA:
 *   A. bot (ktpPihakService.js, fungsi murni): pencocokan KTP ke pihak SIPP (NIK, nama + lahir,
 *      galat OCR satu huruf/angka, kembar = ambigu), kemasukakalan tanggal KTP, keyakinan
 *      ("pasti" tidak pernah keluar sebelum dinyalakan), sebutan peran (Pemohon II ...);
 *   B. portal (ktp-ocr.ts bacaKtpBanyak): PDF sungguhan buatan pdf-lib - SATU KTP PER HALAMAN, lapisan
 *      teks dan pindaian (tesseract tiruan), foto, berkas bukan KTP;
 *   C. portal (ktp-pihak.ts): putaran antrian -> baca -> kirim per berkas, berkas besar/tak terambil/
 *      galat baca, tidak bertumpuk, saklar latar (ALETA_KTP_PIHAK_LATAR=0), pengaturan env;
 *   D. bot SUNGGUHAN atas basis data laptop (dilewati bila MySQL mati): antrian terbaru-dulu, satu isi
 *      pada banyak perkara dibaca SEKALI dan disalin, pencocokan ke pihak SIPP nyata, Pemohon II,
 *      Tergugat, KTP orang lain tak bertuan, baca-ulang berkas gagal, tanggal mustahil = ragu,
 *      perkaraKtp, dan kueri variabel ABT 8870-8872 (isian petugas didahulukan);
 *   E. ekstensi (abt.js): kartu tanggal KTP per pihak - 0364/2222 Pemohon I, 0366 Pemohon II, 0365
 *      Termohon, sumber "e-Court: KTP", keyakinan, jatuh ke rute lama pada server lama.
 *
 * Perilaku ABT (render php56 atas Abt_model sungguhan) diuji oleh paket abt-tanggal-ktp
 * (D:/aleta-dev/kerja/abt-tanggal-ktp/alat/uji_render_laptop.py): 21/21 lulus.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { lupakanMesinOcr } from "@/app/api/aleta-ecourt/saksi-scan/ocr";
import { bacaKtpBanyak, type HasilBacaKtp, type PembantuGambar } from "@/server/modules/aleta-ecourt/ktp-ocr";
import {
  BATAS_BITA_KTP,
  aturUlangKtpPihak,
  hasilDariBacaan,
  mulaiPindaiKtpBerkala,
  pengaturanLatar,
  pindaiKtpPihak,
  putaranKtpPihak,
  type DepsKtp,
} from "@/server/modules/aleta-ecourt/ktp-pihak";
import type { BerkasKtpAntri, HasilBacaKtpPihak } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

type Apa = any;

const AKAR = path.resolve(__dirname, "../../..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const K: Apa = muat(path.join(AKAR, "aleta_bot/services/ktpPihakService.js"));

// ── bahan ────────────────────────────────────────────────────────────────

const KTP_SITI = [
  "PROVINSI SULAWESI TENGAH",
  "KABUPATEN DONGGALA",
  "NIK : 7203094505900001",
  "Nama : SITI AMINAH",
  "Tempat/Tgl Lahir : DONGGALA, 05-05-1990",
  "Jenis kelamin : PEREMPUAN Gol. Darah : O",
  "Alamat : JL. TRANS SULAWESI NO. 10",
  "Kel/Desa : LABUAN SALUMBONE",
  "Kecamatan : LABUAN",
  "Agama : ISLAM",
  "Status Perkawinan : KAWIN",
  "Pekerjaan : MENGURUS RUMAH TANGGA",
  "Kewarganegaraan : WNI",
  "Berlaku Hingga : SEUMUR HIDUP 18-02-2012",
];
const KTP_BUDI = [
  "PROVINSI SULAWESI TENGAH",
  "KABUPATEN DONGGALA",
  "NIK : 7203091203850002",
  "Nama : BUDI SANTOSO",
  "Tempat/Tgl Lahir : DONGGALA, 12-03-1985",
  "Jenis kelamin : LAKI-LAKI Gol. Darah : O",
  "Alamat : JL. KENARI NO. 51",
  "Kel/Desa : TOAYA",
  "Kecamatan : SINDUE",
  "Agama : ISLAM",
  "Status Perkawinan : KAWIN",
  "Pekerjaan : WIRASWASTA",
  "Kewarganegaraan : WNI",
  "Berlaku Hingga : SEUMUR HIDUP 07-09-2014",
];

async function buatPdf(halaman: string[][]): Promise<Buffer> {
  const { PDFDocument, StandardFonts } = createRequire(path.join(process.cwd(), "package.json"))("pdf-lib");
  const dok = await PDFDocument.create();
  const huruf = await dok.embedFont(StandardFonts.Helvetica);
  for (const baris of halaman) {
    const h = dok.addPage([595, 842]);
    baris.forEach((b, i) => h.drawText(b, { x: 40, y: 800 - i * 20, size: 12, font: huruf }));
  }
  return Buffer.from(await dok.save());
}

type Anak = { stdout: { on: (e: string, f: (x: Buffer) => void) => void }; stderr: { on: (e: string, f: (x: Buffer) => void) => void }; stdin: { on: () => void; end: (x?: Buffer) => void }; on: (e: string, f: (...x: unknown[]) => void) => void; kill: () => void };

/** tesseract tiruan: jawaban menurut isi gambar yang diterima. */
function tesseractPalsu(jawab: (gambar: Buffer) => string) {
  const panggilan: Buffer[] = [];
  const spawn = (_bin: string, argumen: string[]) => {
    const dengar: Record<string, Array<(...x: unknown[]) => void>> = {};
    const keluar: Array<(x: Buffer) => void> = [];
    const anak: Anak = {
      stdout: { on: (_e, f) => keluar.push(f) },
      stderr: { on: () => undefined },
      stdin: {
        on: () => undefined,
        end: (x?: Buffer) => {
          setTimeout(() => {
            let teks = "tesseract 5.3";
            if (argumen[0] !== "--version") {
              panggilan.push(Buffer.from(x || Buffer.alloc(0)));
              teks = jawab(x || Buffer.alloc(0));
            }
            for (const f of keluar) f(Buffer.from(teks));
            for (const f of dengar.close || []) f(0);
          }, 0);
        },
      },
      on: (e, f) => {
        (dengar[e] ||= []).push(f);
      },
      kill: () => undefined,
    };
    return anak;
  };
  return { spawn: spawn as never, panggilan };
}

beforeEach(() => lupakanMesinOcr());

// ============================================================================
// A. bot - fungsi murni
// ============================================================================
describe("A. ktpPihakService - tanggal, nama, NIK, pencocokan pihak", () => {
  it("tanggal 'dd/mm/yyyy' <-> ISO; tanggal yang tidak nyata ditolak", () => {
    expect(K.isoDariDmy("18/02/2012")).toBe("2012-02-18");
    expect(K.isoDariDmy("5-3-2015")).toBe("2015-03-05");
    expect(K.isoDariDmy("31/02/2012")).toBe("");
    expect(K.isoDariDmy("32/01/2012")).toBe("");
    expect(K.isoDariDmy("")).toBe("");
    expect(K.isoKeDmy("2012-02-18")).toBe("18/02/2012");
  });

  it("nama baku: tanpa bin/binti, gelar, alias; urutan kata dan galat satu huruf OCR tetap serupa", () => {
    expect(K.namaBaku("BUDI SANTOSO Bin HASAN, S.Pd")).toBe("budi santoso");
    expect(K.namaBaku("Dr. H. Ahmad Fauzi")).toBe("ahmad fauzi");
    expect(K.namaBaku("SITI binti ALI alias SITI AMINAH")).toBe("siti");
    expect(K.namaSerupa("Siti Aminah binti Ali", "SITI AMINAH")).toBe(true);
    expect(K.namaSerupa("AMINAH SITI", "Siti Aminah")).toBe(true);
    expect(K.namaSerupa("SITI AM1NAH", "SITI AMINAH")).toBe(true);
    expect(K.namaSerupa("SITI AMINAH", "SITI RAHMAH")).toBe(false);
    expect(K.namaSerupa("", "SITI")).toBe(false);
  });

  it("selisih NIK dihitung per angka (galat baca OCR); bukan 16 angka = tidak bisa dibandingkan", () => {
    expect(K.bedaNik("7203094505900001", "7203094505900001")).toBe(0);
    expect(K.bedaNik("7203094505900001", "7203094505900011")).toBe(1);
    expect(K.bedaNik("7203094505900001", "72030945059")).toBe(99);
  });

  const PIHAK = [
    { cabang: 1, urutan: 1, pihakId: 11, nama: "Siti Aminah binti Ali", nik: "7203094505900001", tanggalLahirIso: "1990-05-05" },
    { cabang: 2, urutan: 1, pihakId: 12, nama: "Budi Santoso bin Hasan", nik: "", tanggalLahirIso: "1985-03-12" },
  ];

  it("NIK sama persis = kuat; nama + tanggal lahir = kuat; nama + NIK mirip = kuat; nama saja = lemah", () => {
    expect(K.cocokkanKtp({ nik: "7203094505900001", nama: "TIDAK SAMA", tanggalLahirIso: "" }, PIHAK)).toMatchObject({ cocok: "nik", kuat: true, pihak: { cabang: 1 } });
    expect(K.cocokkanKtp({ nik: "", nama: "BUDI SANTOSO", tanggalLahirIso: "1985-03-12" }, PIHAK)).toMatchObject({ cocok: "nama_lahir", kuat: true, pihak: { cabang: 2 } });
    expect(K.cocokkanKtp({ nik: "7203094505900011", nama: "SITI AMINAH", tanggalLahirIso: "" }, PIHAK)).toMatchObject({ cocok: "nama_nik", kuat: true, pihak: { cabang: 1 } });
    expect(K.cocokkanKtp({ nik: "", nama: "BUDI SANTOSO", tanggalLahirIso: "" }, PIHAK)).toMatchObject({ cocok: "nama", kuat: false, pihak: { cabang: 2 } });
    expect(K.cocokkanKtp({ nik: "7299990101010001", nama: "ORANG LAIN", tanggalLahirIso: "1970-01-01" }, PIHAK)).toMatchObject({ pihak: null, ambigu: false });
  });

  it("dua pihak sama kuatnya (nama kembar, tanpa NIK/lahir pembeda) = ambigu: tidak ada yang dipilih", () => {
    const kembar = [
      { cabang: 1, urutan: 1, pihakId: 1, nama: "Andi Saputra", nik: "", tanggalLahirIso: "" },
      { cabang: 2, urutan: 1, pihakId: 2, nama: "ANDI SAPUTRA bin ABU", nik: "", tanggalLahirIso: "" },
    ];
    expect(K.cocokkanKtp({ nik: "", nama: "ANDI SAPUTRA", tanggalLahirIso: "" }, kembar)).toMatchObject({ pihak: null, ambigu: true });
    // NIK membedakan keduanya
    const bernik = [{ ...kembar[0], nik: "7203090101900001" }, { ...kembar[1], nik: "7203090101900002" }];
    expect(K.cocokkanKtp({ nik: "7203090101900002", nama: "ANDI SAPUTRA", tanggalLahirIso: "" }, bernik)).toMatchObject({ cocok: "nik", pihak: { cabang: 2 } });
  });

  it("tanggal KTP masuk akal: sebelum perkara didaftarkan, tidak di masa depan, sesudah umur 14", () => {
    const dasar = { tanggalLahirIso: "1990-05-05", tanggalDaftarIso: "2026-10-09", hariIniIso: "2026-10-12" };
    expect(K.tanggalMasukAkal({ ...dasar, tanggalKtpIso: "2012-02-18" })).toEqual({ ok: true, sebab: "" });
    expect(K.tanggalMasukAkal({ ...dasar, tanggalKtpIso: "2026-10-09" }).ok).toBe(true);
    expect(K.tanggalMasukAkal({ ...dasar, tanggalKtpIso: "2026-10-10" })).toEqual({ ok: false, sebab: "sesudah_perkara_didaftarkan" });
    expect(K.tanggalMasukAkal({ ...dasar, tanggalDaftarIso: "", tanggalKtpIso: "2030-01-01" })).toEqual({ ok: false, sebab: "tanggal_di_masa_depan" });
    expect(K.tanggalMasukAkal({ ...dasar, tanggalKtpIso: "2001-01-01" })).toEqual({ ok: false, sebab: "sebelum_umur_14" });
    expect(K.tanggalMasukAkal({ ...dasar, tanggalKtpIso: "1985-01-01" }).ok).toBe(false);
    expect(K.tanggalMasukAkal({ ...dasar, tanggalKtpIso: "" })).toEqual({ ok: false, sebab: "tanggal_kosong" });
  });

  it("sebutan peran: Pemohon II hanya bila ada lebih dari satu; turut = Turut Tergugat; dari alur/jenis perkara", () => {
    const permohonan = { satu: "Pemohon", dua: "Termohon" };
    expect(K.peranPihak(1, 1, 1, permohonan)).toBe("Pemohon");
    expect(K.peranPihak(1, 2, 2, permohonan)).toBe("Pemohon II");
    expect(K.peranPihak(2, 1, 1, permohonan)).toBe("Termohon");
    expect(K.peranPihak(3, 1, 1, { satu: "Penggugat", dua: "Tergugat" })).toBe("Turut Tergugat");
  });

  it("keyakinan: 'cukup' bila NIK/nama+lahir cocok, NIK sah, tanggal masuk akal; 'pasti' TIDAK keluar sebelum dinyalakan", () => {
    const perkara = { perkaraId: 5, tanggalDaftarIso: "2026-10-09" };
    const pihak = { cabang: 1, urutan: 2, pihakId: 9, nama: "Siti", nik: "7203094505900001", tanggalLahirIso: "1990-05-05" };
    const dasar = {
      cocok: { pihak, cocok: "nik", kuat: true, ambigu: false },
      pihakDiCabang: { 1: 2 },
      sebutan: { satu: "Pemohon", dua: "Termohon" },
      perkara,
      fileId: "f",
      urut: 1,
      documentKey: "d",
      nomorPerkara: "1/Pdt.P/2026/PA.Dgl",
      sumberBaca: "teks-pdf",
      versi: 1,
      hariIniIso: "2026-10-12",
    };
    const ktp = { nik: "7203094505900001", nikSah: true, nama: "SITI AMINAH", tanggalLahir: "05/05/1990", tanggalTerbit: "18/02/2012", kotaTerbit: "Donggala", sumber: "teks-pdf" };
    const b = K.susunBaris({ ...dasar, ktp });
    expect(b).toMatchObject({ yakin: "cukup", cabang: 1, urutan: 2, peran: "Pemohon II", cocok: "nik", tanggalKtpIso: "2012-02-18", status: "terbaca", sebab: "" });
    delete process.env.ALETA_KTP_PIHAK_YAKIN;
    process.env.ALETA_KTP_PIHAK_YAKIN = "pasti";
    expect(K.susunBaris({ ...dasar, ktp }).yakin).toBe("pasti");
    delete process.env.ALETA_KTP_PIHAK_YAKIN;
    // lemah / tanggal mustahil / NIK tak sah / tanpa tanggal / tanpa pihak -> ragu + sebab
    expect(K.susunBaris({ ...dasar, ktp, cocok: { pihak, cocok: "nama", kuat: false, ambigu: false } })).toMatchObject({ yakin: "ragu", sebab: "hanya_nama_cocok" });
    expect(K.susunBaris({ ...dasar, ktp: { ...ktp, tanggalTerbit: "10/10/2026" } })).toMatchObject({ yakin: "ragu", sebab: "sesudah_perkara_didaftarkan" });
    expect(K.susunBaris({ ...dasar, ktp: { ...ktp, nikSah: false }, cocok: { pihak, cocok: "nama_lahir", kuat: true, ambigu: false } })).toMatchObject({ yakin: "ragu", sebab: "nik_tidak_sah" });
    expect(K.susunBaris({ ...dasar, ktp: { ...ktp, tanggalTerbit: "" } })).toMatchObject({ yakin: "ragu", sebab: "tanggal_ktp_tidak_terbaca" });
    expect(K.susunBaris({ ...dasar, ktp, cocok: { pihak: null, cocok: "", kuat: false, ambigu: false } })).toMatchObject({ yakin: "ragu", sebab: "tidak_cocok_pihak", cabang: null, peran: "" });
    expect(K.susunBaris({ ...dasar, ktp, cocok: { pihak: null, cocok: "", kuat: false, ambigu: true } })).toMatchObject({ sebab: "pihak_ambigu" });
  });
});

describe("A2. berkasIntegritasService - foto KTP e-Court (format 'gambar')", () => {
  const I: Apa = muat(path.join(AKAR, "aleta_bot/services/berkasIntegritasService.js"));
  const jpeg = (n = 6000) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]), Buffer.alloc(n, 3)]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(6000, 5)]);

  it("sebelumnya JPEG ditolak penanda PDF (alasan nyata di arsip: penanda_tidak_dikenali ff d8 ff e0); sekarang gambar KTP diterima sebagai 'gambar'", () => {
    const lama = I.periksaIsi(jpeg(), { format: "pdf" });
    expect(lama).toMatchObject({ ok: false });
    expect(lama.alasan).toMatch(/^penanda_tidak_dikenali \(ff d8 ff e0/);
    expect(I.periksaIsi(jpeg(), { format: "gambar" })).toMatchObject({ ok: true, jenis: "JPEG" });
    expect(I.periksaIsi(png, { format: "gambar" })).toMatchObject({ ok: true, jenis: "PNG" });
  });

  it("gambarKtp: hanya untuk dokumen berjudul KTP dan isi gambar utuh; halaman web/PDF/terlalu kecil ditolak", () => {
    expect(I.gambarKtp(jpeg(), "KTP")).toMatchObject({ ok: true, jenis: "JPEG" });
    expect(I.gambarKtp(png, "KTP Penggugat")).toMatchObject({ ok: true, jenis: "PNG" });
    expect(I.gambarKtp(png, "Kartu Tanda Penduduk")).toMatchObject({ ok: true });
    expect(I.gambarKtp(jpeg(), "Dokumen Bukti")).toMatchObject({ ok: false, alasan: "bukan_dokumen_ktp" });
    expect(I.gambarKtp(Buffer.from("<html>login</html>".padEnd(6000, " ")), "KTP").ok).toBe(false);
    expect(I.gambarKtp(Buffer.from("%PDF-1.4".padEnd(6000, " ")), "KTP").ok).toBe(false);
    expect(I.gambarKtp(jpeg(100), "KTP")).toMatchObject({ ok: false });
    expect(I.gambarKtp(Buffer.alloc(0), "KTP")).toMatchObject({ ok: false, alasan: "berkas_kosong" });
  });

  it("pemeriksa arsip: nama .jpg/.png dikenali sebagai gambar; PDF dan Word tidak berubah", () => {
    expect(I.formatDariNama("KTP__ab12.jpg")).toBe("gambar");
    expect(I.formatDariNama("KTP__ab12.PNG")).toBe("gambar");
    expect(I.formatDariNama("x.pdf")).toBe("pdf");
    expect(I.formatDariNama("x.docx")).toBe("word");
    expect(I.formatDariNama("x.txt")).toBe("");
    expect(I.periksaIsi(Buffer.from("%PDF-1.4\n".padEnd(6000, "x") + "\n%%EOF"), { format: "pdf" }).ok).toBe(true);
  });
});

// ============================================================================
// B. portal - pembaca KTP per halaman
// ============================================================================
describe("B. bacaKtpBanyak - satu KTP per halaman", () => {
  it("PDF berlapis teks DUA halaman = dua orang, tiap halaman dibaca sendiri (NIK, tanggal terbit)", async () => {
    const pdf = await buatPdf([KTP_SITI, KTP_BUDI]);
    const t = tesseractPalsu(() => "tidak boleh dipanggil");
    const hasil = await bacaKtpBanyak(pdf, { spawn: t.spawn, tahunKini: 2026 });
    expect(hasil).toHaveLength(2);
    const peta = Object.fromEntries(hasil.map((h) => [h.medan.nik, h]));
    expect(peta["7203094505900001"].medan).toMatchObject({ nama: "Siti Aminah", tanggalTerbit: "18/02/2012" });
    expect(peta["7203091203850002"].medan).toMatchObject({ nama: "Budi Santoso", tanggalTerbit: "07/09/2014" });
    expect(hasil.every((h) => h.ok && h.sumber === "teks-pdf" && h.nik?.sah)).toBe(true);
    expect(t.panggilan).toEqual([]); // tanpa OCR
  });

  it("halaman yang sama dua kali (NIK sama) hanya satu hasil; halaman bukan KTP dilewati", async () => {
    const pdf = await buatPdf([KTP_SITI, KTP_SITI, ["Surat Pernyataan", "Yang bertanda tangan di bawah ini"]]);
    const hasil = await bacaKtpBanyak(pdf, { tahunKini: 2026 });
    expect(hasil).toHaveLength(1);
    expect(hasil[0].medan.nik).toBe("7203094505900001");
  });

  it("PDF pindaian DUA halaman: tiap halaman di-OCR (pembantu menggambar 4 halaman), dua orang", async () => {
    const kosong = await buatPdf([[], []]);
    const diminta: string[] = [];
    const pembantu: PembantuGambar = async (mode) => {
      diminta.push(mode);
      return new Map([
        ["hal1-abu", Buffer.from("H1")],
        ["hal1-biner", Buffer.from("H1B")],
        ["hal2-abu", Buffer.from("H2")],
        ["hal2-biner", Buffer.from("H2B")],
      ]);
    };
    // tesseract mengembalikan teks per halaman (baris dipisah newline)
    const t2 = tesseractPalsu((g) => (g.toString().startsWith("H1") ? KTP_SITI : KTP_BUDI).join("\n"));
    const hasil = await bacaKtpBanyak(kosong, { spawn: t2.spawn, pembantu, tahunKini: 2026 });
    expect(diminta).toEqual(["pdf"]);
    expect(hasil.map((h) => h.medan.nik).sort()).toEqual(["7203091203850002", "7203094505900001"]);
    expect(hasil.every((h) => h.sumber === "ocr-pdf" && h.ok)).toBe(true);
    expect(hasil.find((h) => h.medan.nik === "7203091203850002")?.medan.tanggalTerbit).toBe("07/09/2014");
  });

  it("tanpa mesin OCR: pindaian dijawab jujur 'ocr_belum_tersedia', bukan 'tidak ada KTP'", async () => {
    const kosong = await buatPdf([[]]);
    const spawnMati = (() => {
      throw Object.assign(new Error("spawn tesseract ENOENT"), { code: "ENOENT" });
    }) as never;
    const hasil = await bacaKtpBanyak(kosong, { spawn: spawnMati, tahunKini: 2026 });
    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({ ok: false, alasan: "ocr_belum_tersedia" });
  });

  it("foto (PNG) = satu hasil lewat bacaKtpDariBerkas; berkas bukan gambar/PDF = bukan_berkas_ktp", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJAQoAAP//AwBBDAH8Kc8nXgAAAABJRU5ErkJggg==", "base64");
    const t = tesseractPalsu(() => KTP_SITI.join("\n"));
    const pembantu: PembantuGambar = async () => new Map([["abu", Buffer.from("A")], ["biner", Buffer.from("B")]]);
    const foto = await bacaKtpBanyak(png, { spawn: t.spawn, pembantu, tahunKini: 2026 });
    expect(foto).toHaveLength(1);
    expect(foto[0].medan).toMatchObject({ nik: "7203094505900001", tanggalTerbit: "18/02/2012" });
    const lain = await bacaKtpBanyak(Buffer.from("PK\u0003\u0004 docx"), { tahunKini: 2026 });
    expect(lain[0]).toMatchObject({ ok: false, alasan: "bukan_berkas_ktp" });
  });
});

describe("B2. hasilDariBacaan - bentuk kiriman ke bot", () => {
  const baik = (nik: string, terbit: string): HasilBacaKtp =>
    ({ ok: true, teks: "", medan: { nik, nama: "X", tanggalLahir: "05/05/1990", tanggalTerbit: terbit, kotaTerbit: "Donggala" }, nik: { sah: true }, catatan: [], terbaca: [], sumber: "teks-pdf" }) as unknown as HasilBacaKtp;
  it("dua KTP terbaca = status terbaca dengan dua entri; NIK sah ikut; sumber dibawa", () => {
    const h = hasilDariBacaan("f1", [baik("7203094505900001", "18/02/2012"), baik("7203091203850002", "")], 1);
    expect(h).toMatchObject({ fileId: "f1", status: "terbaca", versi: 1, sumber: "teks-pdf" });
    expect(h.ktp).toHaveLength(2);
    expect(h.ktp[0]).toMatchObject({ nik: "7203094505900001", nikSah: true, tanggalTerbit: "18/02/2012" });
  });
  it("tidak terbaca: sebabnya dibawa (OCR belum ada, bukan KTP, tanpa label) - bukan dikosongkan", () => {
    const gagal = (alasan: string) => ({ ok: false, alasan, medan: {}, sumber: "ocr" }) as unknown as HasilBacaKtp;
    expect(hasilDariBacaan("f", [gagal("ocr_belum_tersedia")], 1)).toMatchObject({ status: "tidak_terbaca", sebab: "ocr_belum_tersedia" });
    expect(hasilDariBacaan("f", [gagal("bukan_berkas_ktp")], 1)).toMatchObject({ status: "bukan_ktp", sebab: "bukan_berkas_ktp" });
    expect(hasilDariBacaan("f", [gagal("tidak_terbaca")], 1)).toMatchObject({ status: "tidak_terbaca", sebab: "tidak_ada_label_ktp" });
    expect(hasilDariBacaan("f", [], 1)).toMatchObject({ status: "tidak_terbaca", sebab: "tidak_terbaca" });
  });
});

// ============================================================================
// C. portal - putaran pembaca latar
// ============================================================================
function depsPalsu(berkas: BerkasKtpAntri[], opsi: Partial<DepsKtp> = {}) {
  const kirim: HasilBacaKtpPihak[] = [];
  const panggilan = { antrian: [] as Array<[string[], number]>, ambil: [] as string[], baca: 0, bacaBatas: [] as Array<number | undefined> };
  let waktu = 0;
  const deps: DepsKtp = {
    antrian: async (nomor, batas) => {
      panggilan.antrian.push([nomor, batas]);
      return { berkas, versi: 1 };
    },
    ambil: async (id) => {
      panggilan.ambil.push(id);
      return Buffer.from("%PDF-1.4 palsu");
    },
    kirim: async (hasil) => {
      kirim.push(...hasil);
      return true;
    },
    baca: async (_data, batasMs) => {
      panggilan.baca += 1;
      panggilan.bacaBatas.push(batasMs);
      return [{ ok: true, teks: "", medan: { nik: "7203094505900001", nama: "SITI", tanggalLahir: "05/05/1990", tanggalTerbit: "18/02/2012", kotaTerbit: "Donggala" }, nik: { sah: true }, catatan: [], terbaca: [], sumber: "teks-pdf" } as unknown as HasilBacaKtp];
    },
    sekarang: () => (waktu += 1),
    ...opsi,
  };
  return { deps, kirim, panggilan };
}
const B = (id: string, ukuran = 1000): BerkasKtpAntri => ({ fileId: id, documentKey: `dk-${id}`, format: "pdf", ukuran, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", judul: "KTP" });

describe("C. pindaiKtpPihak / penyapu latar", () => {
  afterEach(() => {
    aturUlangKtpPihak();
    vi.useRealTimers();
  });

  it("tiap berkas dibaca lalu DIKIRIM SATU PER SATU (kemajuan tidak hilang bila mati di tengah)", async () => {
    const { deps, kirim, panggilan } = depsPalsu([B("a"), B("b"), B("c")]);
    const r = await pindaiKtpPihak(["1/Pdt.G/2026/PA.Dgl"], deps, { batas: 3, batasBacaMs: 12_345 });
    expect(r).toMatchObject({ dibaca: 3, terbaca: 3, terkirim: true, antrianTerjangkau: true });
    expect(panggilan.antrian).toEqual([[["1/Pdt.G/2026/PA.Dgl"], 3]]);
    expect(kirim.map((h) => h.fileId)).toEqual(["a", "b", "c"]);
    expect(kirim[0]).toMatchObject({ status: "terbaca", versi: 1 });
    expect(panggilan.bacaBatas).toEqual([12_345, 12_345, 12_345]); // batas baca per berkas ikut dibawa
  });

  it("berkas terlalu besar / tak terambil / galat baca dicatat dengan SEBAB, bukan dilewati diam-diam", async () => {
    const { deps, kirim } = depsPalsu([B("besar", BATAS_BITA_KTP + 1), B("hilang"), B("rusak")], {
      ambil: async (id) => (id === "hilang" ? null : Buffer.from("x")),
      baca: async () => {
        throw new Error("pdf rusak");
      },
    });
    const r = await pindaiKtpPihak([], deps);
    expect(r.dibaca).toBe(3);
    expect(r.terbaca).toBe(0);
    expect(kirim.map((h) => [h.fileId, h.status, h.sebab])).toEqual([
      ["besar", "tidak_terbaca", "berkas_terlalu_besar"],
      ["hilang", "tidak_terbaca", "berkas_tidak_terambil"],
      ["rusak", "tidak_terbaca", "galat_baca"],
    ]);
  });

  it("bufer berkas ditimpa nol sesudah dibaca (berkas KTP tidak tersisa di memori)", async () => {
    let dipegang: Buffer | null = null;
    const { deps } = depsPalsu([B("a")], {
      ambil: async () => {
        dipegang = Buffer.from("ISI KTP RAHASIA");
        return dipegang;
      },
    });
    await pindaiKtpPihak([], deps);
    expect(dipegang).not.toBeNull();
    expect((dipegang as unknown as Buffer).every((b) => b === 0)).toBe(true);
  });

  it("bot tak terjangkau = antrianTerjangkau false, tak ada yang dikirim; batas waktu menghentikan putaran", async () => {
    const mati = depsPalsu([B("a")], { antrian: async () => null });
    expect(await pindaiKtpPihak([], mati.deps)).toMatchObject({ dibaca: 0, antrianTerjangkau: false });
    expect(mati.kirim).toEqual([]);
    const lambat = depsPalsu([B("a"), B("b"), B("c")]);
    let t = 0;
    lambat.deps.sekarang = () => (t += 100_000);
    const r = await pindaiKtpPihak([], lambat.deps, { batasMs: 150_000 });
    expect(r.dibaca).toBeLessThan(3);
  });

  it("putaran tidak bertumpuk: yang kedua saat yang pertama berjalan dijawab null", async () => {
    let lepas: () => void = () => undefined;
    const tahan = new Promise<void>((ok) => (lepas = ok));
    const { deps } = depsPalsu([B("a")], { baca: async () => (await tahan, []) });
    const pertama = putaranKtpPihak([], deps);
    await new Promise((r) => setTimeout(r, 10));
    expect(await putaranKtpPihak([], deps)).toBeNull();
    lepas();
    expect(await pertama).toMatchObject({ dibaca: 1 });
    expect(await putaranKtpPihak([], deps)).not.toBeNull();
  });

  it("pengaturan env: latar mati dengan ALETA_KTP_PIHAK_LATAR=0; batas 1-10; jeda minimal 30 detik", () => {
    expect(pengaturanLatar({} as never)).toEqual({ aktif: true, batas: 2, jedaMs: 120_000 });
    expect(pengaturanLatar({ ALETA_KTP_PIHAK_LATAR: "0" } as never).aktif).toBe(false);
    expect(pengaturanLatar({ ALETA_KTP_PIHAK_BATAS: "99", ALETA_KTP_PIHAK_JEDA_MS: "1" } as never)).toMatchObject({ batas: 10, jedaMs: 30_000 });
  });

  it("detak berkala: putaran pertama sesudah satu jeda, memakai batas dari env; saklar 0 tidak menyalakan apa pun", async () => {
    vi.useFakeTimers();
    const { deps, panggilan } = depsPalsu([]);
    expect(mulaiPindaiKtpBerkala(deps, { ALETA_KTP_PIHAK_LATAR: "0" } as never)).toBe(false);
    expect(mulaiPindaiKtpBerkala(deps, { ALETA_KTP_PIHAK_BATAS: "2", ALETA_KTP_PIHAK_JEDA_MS: "60000" } as never)).toBe(true);
    expect(mulaiPindaiKtpBerkala(deps, {} as never)).toBe(false); // sudah menyala
    expect(panggilan.antrian).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(panggilan.antrian).toEqual([[[], 2]]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(panggilan.antrian).toHaveLength(2);
  });
});

// ============================================================================
// D. bot SUNGGUHAN atas basis data laptop
// ============================================================================
async function mysqlHidup(): Promise<boolean> {
  return new Promise((ok) => {
    const s = net.connect({ host: "127.0.0.1", port: 3306 });
    const selesai = (v: boolean) => {
      s.destroy();
      ok(v);
    };
    s.setTimeout(800, () => selesai(false));
    s.on("connect", () => selesai(true));
    s.on("error", () => selesai(false));
  });
}
const dbAda = await mysqlHidup();

describe.skipIf(!dbAda)("D. bot sungguhan (basis data laptop: aleta_bot + sipp_donggala)", () => {
  const AWAL = "UJI-KTP12-";
  const ROOT = path.join("D:/Aplikasi/aleta/tmp", `ktp-uji-${process.pid}`);
  let sipp: (sql: string, p?: unknown[]) => Promise<Apa[]>;
  let bot: (sql: string, p?: unknown[]) => Promise<Apa>;
  let ada = false;
  let siap = false;
  // bahan nyata dari SIPP
  let kembar: Apa; // pihak yang sama sebagai Penggugat/Pemohon di dua perkara
  let duaPemohon: Apa; // perkara dengan Pemohon I dan II bernik
  let tergugat: Apa; // perkara dengan Tergugat bernik
  const H = (s: string) => (AWAL + s).padEnd(64, "0").slice(0, 64);

  beforeAll(async () => {
    process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
    process.env.ALETA_BOT_DB_NAME = process.env.ALETA_BOT_DB_NAME || "aleta_bot";
    process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT = ROOT;
    mkdirSync(ROOT, { recursive: true });
    sipp = (sql, p) => new Promise((ok, no) => muat(path.join(AKAR, "aleta_bot/db_config.js")).query(sql, p || [], (e: Error, r: Apa[]) => (e ? no(e) : ok(r))));
    bot = (sql, p) => muat(path.join(AKAR, "aleta_bot/services/botDbService.js")).query(sql, p || []);
    try {
      await K.pastikanSkema();
      siap = true;
      kembar = (
        await sipp(
          `SELECT a.pihak_id, MIN(a.perkara_id) p1, MAX(a.perkara_id) p2 FROM perkara_pihak1 a JOIN pihak x ON x.id = a.pihak_id
            WHERE a.urutan = 1 AND LENGTH(x.nomor_indentitas) = 16 AND x.tanggal_lahir IS NOT NULL GROUP BY a.pihak_id HAVING COUNT(DISTINCT a.perkara_id) >= 2 ORDER BY p2 DESC LIMIT 1`
        )
      )[0];
      duaPemohon = (
        await sipp(
          `SELECT x1.perkara_id FROM perkara_pihak1 x1 JOIN pihak y ON y.id = x1.pihak_id WHERE x1.urutan IN (1, 2) AND LENGTH(y.nomor_indentitas) = 16 AND y.tanggal_lahir IS NOT NULL
            GROUP BY x1.perkara_id HAVING COUNT(*) = 2 ORDER BY x1.perkara_id DESC LIMIT 1`
        )
      )[0];
      tergugat = (
        await sipp(
          `SELECT b.perkara_id FROM perkara_pihak2 b JOIN pihak y ON y.id = b.pihak_id JOIN perkara_pihak1 a ON a.perkara_id = b.perkara_id AND a.urutan = 1
            WHERE b.urutan = 1 AND LENGTH(y.nomor_indentitas) = 16 AND y.tanggal_lahir IS NOT NULL AND y.nomor_indentitas <> (SELECT nomor_indentitas FROM pihak WHERE id = a.pihak_id)
            ORDER BY b.perkara_id DESC LIMIT 1`
        )
      )[0];
      ada = Boolean(kembar && duaPemohon && tergugat);
    } catch {
      ada = false;
    }
  });

  const perkara = async (id: number) =>
    (await sipp("SELECT perkara_id, nomor_perkara, tanggal_pendaftaran FROM perkara WHERE perkara_id = ?", [id]))[0];
  const pihak = async (cabang: number, id: number, urutan: number) =>
    (
      await sipp(
        `SELECT pp.nama, p.nomor_indentitas AS nik, p.tanggal_lahir FROM perkara_pihak${cabang} pp JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ? AND pp.urutan = ?`,
        [id, urutan]
      )
    )[0];
  const isoDari = (d: Date | string) => {
    if (!(d instanceof Date)) return String(d).slice(0, 10);
    return `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const dmyIso = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const dmy = (d: Date | string) => dmyIso(isoDari(d));
  /** Tanggal KTP uji: `hari` hari sebelum tanggal pendaftaran terlama (selalu masuk akal bagi pihak dewasa). */
  const ktpSebelum = (...daftar: Array<Date | string>) => {
    const awal = daftar.map(isoDari).sort()[0];
    const t = new Date(`${awal}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() - 400);
    return t.toISOString().slice(0, 10);
  };

  async function buatBerkas(kode: string, nomor: string, perkaraId: number, hash: string, tulis: boolean | Buffer = false, format = "pdf", ekstensi = ".pdf") {
    const jalur = path.join(ROOT, `${AWAL}${kode}${ekstensi}`);
    if (tulis) writeFileSync(jalur, Buffer.isBuffer(tulis) ? tulis : Buffer.from("%PDF-1.4\n% berkas KTP uji\n"));
    await bot(
      `INSERT INTO aleta_bot_ecourt_documents (id, document_key, nomor_perkara, perkara_id, nomor_register, registrasi_ecourt, judul_dokumen, jenis_dokumen, peran_pengunggah,
         email_pengunggah, status_verifikasi, agenda, batas_unggah_teks, alasan_tidak_diberitahukan, pertama_terlihat, terakhir_terlihat, updated_at, gagal_beruntun, gagal_sebab, tidak_tersedia_sebab)
       VALUES (?, ?, ?, ?, '', '', 'KTP', '', '', '', 'belum', '', '', '', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP(), 0, '', '')`,
      [AWAL + "D" + kode, AWAL + "DK" + kode, nomor, perkaraId]
    );
    await bot(
      `INSERT INTO aleta_bot_ecourt_files (id, document_key, nomor_perkara, format, jalur_berkas, sidik_jari, ukuran_byte, tipe_isi, diunduh_pada, terakhir_diperiksa)
       VALUES (?, ?, ?, ?, ?, ?, 100, 'application/pdf', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [AWAL + "F" + kode, AWAL + "DK" + kode, nomor, format, jalur, hash]
    );
    return AWAL + "F" + kode;
  }

  async function bersihkan() {
    await bot("DELETE FROM aleta_bot_ktp_pihak WHERE file_id LIKE ?", [AWAL + "%"]);
    await bot("DELETE FROM aleta_bot_ecourt_files WHERE id LIKE ?", [AWAL + "%"]);
    await bot("DELETE FROM aleta_bot_ecourt_documents WHERE id LIKE ?", [AWAL + "%"]);
  }

  afterAll(async () => {
    try {
      if (siap) await bersihkan();
    } finally {
      rmSync(ROOT, { recursive: true, force: true });
      for (const f of ["db_config.js", "bot_db_config.js"]) {
        try {
          muat(path.join(AKAR, "aleta_bot", f)).end?.();
        } catch {
          /* kolam sudah tertutup */
        }
      }
    }
  });

  beforeEach(async () => {
    if (siap) await bersihkan();
  });

  it("bahan nyata tersedia di SIPP laptop (Penggugat berulang, dua Pemohon, Tergugat bernik)", () => {
    expect(ada).toBe(true);
  });

  it("antrian: perkara yang diminta lebih dulu; satu isi (sidik jari) pada dua perkara hanya SATU wakil; berkas() mengirim isi berkas KTP saja", async () => {
    if (!ada) return;
    const p1 = await perkara(Number(kembar.p1));
    const p2 = await perkara(Number(kembar.p2));
    const f1 = await buatBerkas("A1", p1.nomor_perkara, p1.perkara_id, H("kembar"), true);
    const f2 = await buatBerkas("A2", p2.nomor_perkara, p2.perkara_id, H("kembar"), true);
    const antrian = await K.antrian({ nomor: [p2.nomor_perkara], batas: 30 });
    const milik = antrian.filter((b: Apa) => String(b.fileId).startsWith(AWAL));
    expect(milik).toHaveLength(1);
    expect(milik[0].fileId).toBe(f2); // perkara yang diminta lebih dulu
    expect(milik[0]).toMatchObject({ judul: "KTP", format: "pdf", nomorPerkara: p2.nomor_perkara });
    const isi = await K.berkas(f1);
    expect(isi.ok).toBe(true);
    expect(isi.isi.toString()).toContain("%PDF");
    expect(await K.berkas("tidak-ada")).toMatchObject({ ok: false });
  });

  it("simpan: hasil satu berkas dicocokkan ke pihak SIPP (NIK) di KEDUA perkara; tanggal KTP, peran, keyakinan 'cukup'; perkaraKtp menjawab per pihak", async () => {
    if (!ada) return;
    const p1 = await perkara(Number(kembar.p1));
    const p2 = await perkara(Number(kembar.p2));
    const f1 = await buatBerkas("B1", p1.nomor_perkara, p1.perkara_id, H("kembarb"));
    const f2 = await buatBerkas("B2", p2.nomor_perkara, p2.perkara_id, H("kembarb"));
    const orang = await pihak(1, p2.perkara_id, 1);
    const tglKtp = ktpSebelum(p1.tanggal_pendaftaran, p2.tanggal_pendaftaran);
    const ktp = { nik: String(orang.nik), nikSah: true, nama: String(orang.nama), tanggalLahir: dmy(orang.tanggal_lahir), tanggalTerbit: dmyIso(tglKtp), kotaTerbit: "Donggala", sumber: "teks-pdf" };
    const r = await K.simpan([{ fileId: f2, status: "terbaca", sebab: "", sumber: "teks-pdf", versi: 1, ktp: [ktp] }]);
    expect(r).toMatchObject({ tersimpan: 1, kembaran: 1 });
    const baris = await bot("SELECT file_id, perkara_id, cabang, urutan, peran, cocok, yakin, tanggal_ktp, status FROM aleta_bot_ktp_pihak WHERE file_id LIKE ? ORDER BY file_id", [AWAL + "%"]);
    expect(baris).toHaveLength(2);
    for (const b of baris) {
      expect(b).toMatchObject({ cabang: 1, urutan: 1, cocok: "nik", yakin: "cukup", status: "terbaca" });
      expect(isoDari(b.tanggal_ktp)).toBe(tglKtp);
    }
    expect(baris.map((b: Apa) => b.file_id)).toEqual([f1, f2]);
    const jawab = await K.perkaraKtp({ nomorPerkara: p1.nomor_perkara });
    expect(jawab).toMatchObject({ ok: true, ada: true });
    expect(jawab.dokumenKtp).toBeGreaterThanOrEqual(1);
    expect(jawab.pihak).toHaveLength(1);
    expect(jawab.pihak[0]).toMatchObject({ cabang: 1, urutan: 1, tanggalKtp: dmyIso(tglKtp), tanggalKtpIso: tglKtp, yakin: "cukup", cocok: "nik" });
    // nama hasil KTP dikembalikan ke panel, NIK TIDAK
    expect(JSON.stringify(jawab)).not.toContain(String(orang.nik));
    // sesudah terbaca, tidak muncul lagi di antrian
    const lagi = await K.antrian({ nomor: [p2.nomor_perkara], batas: 30 });
    expect(lagi.filter((b: Apa) => String(b.fileId).startsWith(AWAL))).toHaveLength(0);
  });

  it("berkas yang sama di perkara ketiga yang BARU terunduh: disalin tanpa OCR (salinKembaran) dan dicocokkan ke pihak perkara itu", async () => {
    if (!ada) return;
    const p1 = await perkara(Number(kembar.p1));
    const p2 = await perkara(Number(kembar.p2));
    const f1 = await buatBerkas("C1", p1.nomor_perkara, p1.perkara_id, H("kembarc"));
    const orang = await pihak(1, p1.perkara_id, 1);
    const tglKtp = ktpSebelum(p1.tanggal_pendaftaran, p2.tanggal_pendaftaran);
    const ktp = { nik: String(orang.nik), nikSah: true, nama: String(orang.nama), tanggalLahir: dmy(orang.tanggal_lahir), tanggalTerbit: dmyIso(tglKtp), kotaTerbit: "Donggala", sumber: "ocr" };
    await K.simpan([{ fileId: f1, status: "terbaca", sebab: "", sumber: "ocr", versi: 1, ktp: [ktp] }]);
    // berkas e-Court baru: perkara lain, isi sama
    const f2 = await buatBerkas("C2", p2.nomor_perkara, p2.perkara_id, H("kembarc"));
    expect(await K.salinKembaran()).toBeGreaterThanOrEqual(1);
    const [b] = await bot("SELECT cabang, urutan, cocok, yakin, tanggal_ktp, sumber_baca FROM aleta_bot_ktp_pihak WHERE file_id = ?", [f2]);
    expect(b).toMatchObject({ cabang: 1, urutan: 1, cocok: "nik", yakin: "cukup", sumber_baca: "ocr" });
    expect(isoDari(b.tanggal_ktp)).toBe(tglKtp);
  });

  it("dua KTP dalam satu berkas = Pemohon I dan Pemohon II (peran 'Pemohon II'); Tergugat dari perkara gugatan", async () => {
    if (!ada) return;
    const p = await perkara(Number(duaPemohon.perkara_id));
    const f = await buatBerkas("D1", p.nomor_perkara, p.perkara_id, H("dua"));
    const a = await pihak(1, p.perkara_id, 1);
    const b = await pihak(1, p.perkara_id, 2);
    const mk = (o: Apa, tgl: string) => ({ nik: String(o.nik), nikSah: true, nama: String(o.nama), tanggalLahir: dmy(o.tanggal_lahir), tanggalTerbit: tgl, kotaTerbit: "Donggala", sumber: "teks-pdf" });
    const t2 = ktpSebelum(p.tanggal_pendaftaran);
    const t1 = ktpSebelum(new Date(new Date(`${t2}T12:00:00Z`).getTime() - 30 * 86400000).toISOString().slice(0, 10));
    await K.simpan([{ fileId: f, status: "terbaca", sebab: "", sumber: "teks-pdf", versi: 1, ktp: [mk(b, dmyIso(t2)), mk(a, dmyIso(t1))] }]);
    const jawab = await K.perkaraKtp({ perkaraId: p.perkara_id });
    const peta = Object.fromEntries(jawab.pihak.map((x: Apa) => [`${x.cabang}.${x.urutan}`, x]));
    expect(peta["1.1"]).toMatchObject({ tanggalKtp: dmyIso(t1), yakin: "cukup" });
    expect(peta["1.2"]).toMatchObject({ tanggalKtp: dmyIso(t2), yakin: "cukup" });
    expect(peta["1.2"].peran).toMatch(/II$/);

    const pt = await perkara(Number(tergugat.perkara_id));
    const ft = await buatBerkas("D2", pt.nomor_perkara, pt.perkara_id, H("tergugat"));
    const t = await pihak(2, pt.perkara_id, 1);
    await K.simpan([{ fileId: ft, status: "terbaca", sebab: "", sumber: "ocr-pdf", versi: 1, ktp: [mk(t, dmyIso(ktpSebelum(pt.tanggal_pendaftaran)))] }]);
    const jt = await K.perkaraKtp({ nomorPerkara: pt.nomor_perkara });
    expect(jt.pihak.find((x: Apa) => x.cabang === 2 && x.urutan === 1)).toMatchObject({ tanggalKtp: dmyIso(ktpSebelum(pt.tanggal_pendaftaran)), yakin: "cukup" });
  });

  it("ALUR PENUH: portal membaca PDF KTP (pdf-lib, lapisan teks) lewat kontrak asli -> bot mencocokkan ke pihak SIPP nyata -> tanggal KTP tersimpan; dua pihak dalam satu PDF", async () => {
    if (!ada) return;
    const p = await perkara(Number(duaPemohon.perkara_id));
    const a = await pihak(1, p.perkara_id, 1);
    const b = await pihak(1, p.perkara_id, 2);
    const tgl1 = ktpSebelum(p.tanggal_pendaftaran);
    const tgl2 = (() => {
      const t = new Date(`${tgl1}T12:00:00Z`);
      t.setUTCDate(t.getUTCDate() - 21);
      return t.toISOString().slice(0, 10);
    })();
    const ktpTeks = (o: Apa, tglIso: string) => [
      "PROVINSI SULAWESI TENGAH",
      "KABUPATEN DONGGALA",
      `NIK : ${String(o.nik)}`,
      `Nama : ${String(o.nama).toUpperCase()}`,
      `Tempat/Tgl Lahir : DONGGALA, ${dmy(o.tanggal_lahir).replace(/\//g, "-")}`,
      "Jenis kelamin : LAKI-LAKI Gol. Darah : O",
      "Alamat : JL. UJI NO. 1",
      "Kel/Desa : LABUAN",
      "Kecamatan : LABUAN",
      "Agama : ISLAM",
      "Status Perkawinan : KAWIN",
      "Pekerjaan : WIRASWASTA",
      "Kewarganegaraan : WNI",
      `Berlaku Hingga : SEUMUR HIDUP ${dmyIso(tglIso).replace(/\//g, "-")}`,
    ];
    const pdf = await buatPdf([ktpTeks(b, tgl2), ktpTeks(a, tgl1)]); // Pemohon II di halaman pertama
    const f = await buatBerkas("K1", p.nomor_perkara, p.perkara_id, H("penuh"), pdf);
    const deps: DepsKtp = {
      antrian: async (nomor, batas) => ({
        berkas: (await K.antrian({ nomor, batas: 30 })).filter((x: Apa) => String(x.fileId).startsWith(AWAL)).slice(0, batas),
        versi: K.VERSI_KTP_PIHAK,
      }),
      ambil: async (id) => {
        const r = await K.berkas(id);
        return r.ok ? r.isi : null;
      },
      kirim: async (hasil) => {
        await K.simpan(hasil);
        return true;
      },
      baca: (data, ms) => bacaKtpBanyak(data, { batasMs: ms }),
      sekarang: () => Date.now(),
    };
    const r = await pindaiKtpPihak([p.nomor_perkara], deps, { batas: 2 });
    expect(r).toMatchObject({ dibaca: 1, terbaca: 1, terkirim: true });
    const jawab = await K.perkaraKtp({ perkaraId: p.perkara_id });
    const peta = Object.fromEntries(jawab.pihak.map((x: Apa) => [`${x.cabang}.${x.urutan}`, x]));
    expect(peta["1.1"]).toMatchObject({ tanggalKtpIso: tgl1, cocok: "nik", sumberBaca: "teks-pdf" });
    expect(peta["1.2"]).toMatchObject({ tanggalKtpIso: tgl2, cocok: "nik", sumberBaca: "teks-pdf" });
    expect(["cukup", "ragu"]).toContain(peta["1.1"].yakin); // 'cukup' bila NIK SIPP berbentuk sah, selain itu ragu - tidak pernah 'pasti'
    expect(peta["1.1"].yakin).not.toBe("pasti");
    // sudah terbaca: putaran berikutnya tidak membacanya lagi
    expect((await K.antrian({ nomor: [p.nomor_perkara], batas: 30 })).some((x: Apa) => x.fileId === f)).toBe(false);
  });

  it("KTP orang yang bukan pihak (saksi/kuasa) disimpan TAK BERTUAN dan tidak pernah dipakai; tanggal mustahil = ragu dan tidak dipakai ABT", async () => {
    if (!ada) return;
    const p = await perkara(Number(kembar.p2));
    const f1 = await buatBerkas("E1", p.nomor_perkara, p.perkara_id, H("asing"));
    await K.simpan([{ fileId: f1, status: "terbaca", sebab: "", sumber: "teks-pdf", versi: 1, ktp: [{ nik: "7299990101010001", nikSah: true, nama: "ORANG ASING TOTALITAS", tanggalLahir: "01/01/1970", tanggalTerbit: "01/01/2015", kotaTerbit: "Palu", sumber: "teks-pdf" }] }]);
    let jawab = await K.perkaraKtp({ perkaraId: p.perkara_id });
    expect(jawab).toMatchObject({ ada: false, takBertuan: 1 });
    const [asing] = await bot("SELECT cabang, yakin, sebab, status FROM aleta_bot_ktp_pihak WHERE file_id = ?", [f1]);
    expect(asing).toMatchObject({ cabang: null, yakin: "ragu", sebab: "tidak_cocok_pihak", status: "terbaca" });

    await bersihkan();
    const f2 = await buatBerkas("E2", p.nomor_perkara, p.perkara_id, H("mustahil"));
    const orang = await pihak(1, p.perkara_id, 1);
    await K.simpan([{ fileId: f2, status: "terbaca", sebab: "", sumber: "teks-pdf", versi: 1, ktp: [{ nik: String(orang.nik), nikSah: true, nama: String(orang.nama), tanggalLahir: dmy(orang.tanggal_lahir), tanggalTerbit: "01/01/2090", kotaTerbit: "", sumber: "teks-pdf" }] }]);
    jawab = await K.perkaraKtp({ perkaraId: p.perkara_id });
    expect(jawab.pihak[0]).toMatchObject({ yakin: "ragu", sebab: "tanggal_di_masa_depan" });
    const dipakaiAbt = await bot("SELECT COUNT(*) AS n FROM aleta_bot_ktp_pihak WHERE file_id = ? AND yakin IN ('pasti','cukup')", [f2]);
    expect(Number(dipakaiAbt[0].n)).toBe(0);
  });

  it("gagal dibaca: dicoba lagi dengan jeda yang makin panjang dan berhenti pada 5 percobaan; OCR belum ada dicoba lagi sehari kemudian tanpa dihitung", async () => {
    if (!ada) return;
    const p = await perkara(Number(kembar.p2));
    const f = await buatBerkas("F1", p.nomor_perkara, p.perkara_id, H("gagal"));
    const hitung = async () => (await K.antrian({ nomor: [p.nomor_perkara], batas: 30 })).filter((b: Apa) => b.fileId === f).length;
    expect(await hitung()).toBe(1); // belum pernah dibaca
    await K.simpan([{ fileId: f, status: "tidak_terbaca", sebab: "galat_baca", sumber: "", versi: 1, ktp: [] }]);
    expect(await hitung()).toBe(0); // baru saja gagal: tunggu
    await bot("UPDATE aleta_bot_ktp_pihak SET dibaca_pada = UTC_TIMESTAMP() - INTERVAL 13 HOUR WHERE file_id = ?", [f]);
    expect(await hitung()).toBe(1); // 12 jam x 1 percobaan sudah lewat
    await K.simpan([{ fileId: f, status: "tidak_terbaca", sebab: "galat_baca", sumber: "", versi: 1, ktp: [] }]);
    await bot("UPDATE aleta_bot_ktp_pihak SET dibaca_pada = UTC_TIMESTAMP() - INTERVAL 13 HOUR WHERE file_id = ?", [f]);
    expect(await hitung()).toBe(0); // percobaan ke-2 butuh 24 jam
    await bot("UPDATE aleta_bot_ktp_pihak SET percobaan = 5, dibaca_pada = UTC_TIMESTAMP() - INTERVAL 400 HOUR WHERE file_id = ?", [f]);
    expect(await hitung()).toBe(0); // sudah 5 kali: berhenti
    // OCR belum terpasang: bukan salah berkas
    await K.simpan([{ fileId: f, status: "tidak_terbaca", sebab: "ocr_belum_tersedia", sumber: "", versi: 1, ktp: [] }]);
    const [baris] = await bot("SELECT percobaan, sebab FROM aleta_bot_ktp_pihak WHERE file_id = ?", [f]);
    expect(baris).toMatchObject({ percobaan: 0, sebab: "ocr_belum_tersedia" });
    expect(await hitung()).toBe(0);
    await bot("UPDATE aleta_bot_ktp_pihak SET dibaca_pada = UTC_TIMESTAMP() - INTERVAL 25 HOUR WHERE file_id = ?", [f]);
    expect(await hitung()).toBe(1);
  });

  it("foto KTP (format 'gambar', .jpg): berkas() mengirim fotonya, masuk antrian; recordFile TIDAK mencerminkannya ke berkas_pdf; ekstensi lain ditolak", async () => {
    if (!ada) return;
    const p = await perkara(Number(kembar.p2));
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(6000, 7)]);
    const f = await buatBerkas("J1", p.nomor_perkara, p.perkara_id, H("foto"), jpeg, "gambar", ".jpg");
    const antrian = await K.antrian({ nomor: [p.nomor_perkara], batas: 30 });
    expect(antrian.some((b: Apa) => b.fileId === f && b.format === "gambar")).toBe(true);
    const isi = await K.berkas(f);
    expect(isi.ok).toBe(true);
    expect(isi.isi.equals(jpeg)).toBe(true);
    // recordFile (jalur jembatan) untuk format gambar: kolom lama berkas_pdf/berkas_word dibiarkan
    const toko = muat(path.join(AKAR, "aleta_bot/services/ecourtStoreService.js"));
    const hasil = await toko.recordFile({ documentKey: AWAL + "DKJ1", nomorPerkara: p.nomor_perkara, format: "gambar", jalurBerkas: path.join(ROOT, "lain.jpg"), sidikJari: H("foto2"), ukuranByte: 6006, tipeIsi: "image/jpeg", sumberUrl: "" });
    expect(hasil.baru).toBe(true);
    const [dok] = await bot("SELECT berkas_pdf, berkas_word FROM aleta_bot_ecourt_documents WHERE document_key = ?", [AWAL + "DKJ1"]);
    expect(dok.berkas_pdf).toBeNull();
    expect(dok.berkas_word).toBeNull();
    await bot("DELETE FROM aleta_bot_ecourt_files WHERE sidik_jari = ?", [H("foto2")]);
    // ekstensi di luar pdf/doc/jpg/png tetap ditolak
    const txt = await buatBerkas("J3", p.nomor_perkara, p.perkara_id, H("tx"), Buffer.from("teks biasa"), "gambar", ".txt");
    expect(await K.berkas(txt)).toMatchObject({ ok: false });
  });

  it("versi aturan lebih baru membaca ulang berkas yang sudah terbaca", async () => {
    if (!ada) return;
    const p = await perkara(Number(kembar.p2));
    const f = await buatBerkas("G1", p.nomor_perkara, p.perkara_id, H("versi"));
    const orang = await pihak(1, p.perkara_id, 1);
    await K.simpan([{ fileId: f, status: "terbaca", sebab: "", sumber: "teks-pdf", versi: 1, ktp: [{ nik: String(orang.nik), nikSah: true, nama: String(orang.nama), tanggalLahir: dmy(orang.tanggal_lahir), tanggalTerbit: dmyIso(ktpSebelum(p.tanggal_pendaftaran)), kotaTerbit: "", sumber: "teks-pdf" }] }]);
    const ada1 = async (v: number) => (await K.antrian({ nomor: [p.nomor_perkara], batas: 30, versi: v })).filter((b: Apa) => b.fileId === f).length;
    expect(await ada1(1)).toBe(0);
    expect(await ada1(2)).toBe(1);
  });

  it("variabel ABT 8870-8872 (paket abt-tanggal-ktp) membaca tabel yang sama; isian petugas didahulukan; DDL paket = DDL bot", async () => {
    if (!ada) return;
    const paket = "D:/aleta-dev/kerja/abt-tanggal-ktp/paket-satker/abt-tanggal-ktp-PASANG.sql";
    if (!existsSync(paket)) return; // paket ada di folder kerja, bukan di repo
    const sql = readFileSync(paket, "latin1");
    expect(sql).toContain(K.DDL_KTP_PIHAK.replace("CREATE TABLE IF NOT EXISTS aleta_bot_ktp_pihak", "CREATE TABLE IF NOT EXISTS aleta_bot.aleta_bot_ktp_pihak"));
    const [v] = await sipp("SELECT sql_query FROM aps_badilag.abt_variabel WHERE no_var = 8870");
    if (!v) return; // paket belum dipasang di laptop ini
    const p = await perkara(Number(kembar.p2));
    const f = await buatBerkas("H1", p.nomor_perkara, p.perkara_id, H("abt"));
    const orang = await pihak(1, p.perkara_id, 1);
    await K.simpan([{ fileId: f, status: "terbaca", sebab: "", sumber: "teks-pdf", versi: 1, ktp: [{ nik: String(orang.nik), nikSah: true, nama: String(orang.nama), tanggalLahir: dmy(orang.tanggal_lahir), tanggalTerbit: dmyIso(ktpSebelum(p.tanggal_pendaftaran)), kotaTerbit: "", sumber: "teks-pdf" }] }]);
    const jalankan = async (no: number) => {
      const [q] = await sipp("SELECT sql_query FROM aps_badilag.abt_variabel WHERE no_var = ?", [no]);
      const baris = await sipp(String(q.sql_query).replace(/#perkara_id#/g, String(p.perkara_id)));
      return baris.length ? String(baris[0].data) : null;
    };
    const isian = await sipp("SELECT data FROM aps_badilag.abt_data_tanggal WHERE no_var IN (364, 2222) AND perkara_id = ? AND data > '1900-01-01'", [p.perkara_id]);
    const hasil = await jalankan(8870);
    if (isian.length) expect(hasil).toBe(String(isian[0].data).slice(0, 10));
    else expect(hasil).toBe(ktpSebelum(p.tanggal_pendaftaran));
    expect(await jalankan(8871)).toBeNull(); // tidak ada Tergugat terbaca di perkara ini
  });
});

// ============================================================================
// E. ekstensi - kartu tanggal KTP per pihak (abt.js)
// ============================================================================
describe("E. panel ABT: kartu tanggal KTP per pihak (blok KTP-PIHAK abt.js)", () => {
  const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");
  const awal = sumber.indexOf("const A3_VAR_TANGGAL_KTP_P");
  const blok = sumber.slice(awal, sumber.indexOf("/**\n * 9 Okt 2026 (KUASA butir 1-4)", awal));

  function pasang(kodeAda: string[], fetchPalsu: (url: string) => Promise<Apa>) {
    const peta = new Map(kodeAda.map((k) => [k, { nilai: "" }]));
    const f = new Function("barisVariabel", "fetch", `${blok}\nreturn { a3UsulanTanggalKtp, A3_VAR_TANGGAL_KTP_P };`);
    return f(() => peta, fetchPalsu);
  }
  const jawab = (isi: Apa, status = 200) => ({ ok: status < 400, status, json: async () => ({ data: isi }) });
  const PIHAK = [
    { cabang: 1, urutan: 1, peran: "Pemohon I", nama: "Siti", tanggalKtp: "18/02/2012", yakin: "cukup", cocok: "nik", kota: "Donggala", sebab: "" },
    { cabang: 1, urutan: 2, peran: "Pemohon II", nama: "Budi", tanggalKtp: "07/09/2014", yakin: "cukup", cocok: "nama_lahir", kota: "", sebab: "" },
    { cabang: 2, urutan: 1, peran: "Termohon", nama: "Andi", tanggalKtp: "01/01/2013", yakin: "ragu", cocok: "nama", kota: "", sebab: "hanya_nama_cocok" },
  ];

  it("variabel yang memicu bacaan kini 2222, 0364, 0365, 0366", () => {
    const p = pasang([], async () => null);
    expect(p.A3_VAR_TANGGAL_KTP_P).toEqual(["2222", "0364", "0365", "0366"]);
  });

  it("tiap variabel mendapat tanggal pihaknya: 0364 & 2222 = Pemohon I, 0366 = Pemohon II, 0365 = Termohon; sumber 'e-Court: KTP'; isian kosong + bacaan cukup = keyakinan cukup & tercentang sendiri (12 Okt D), ragu bila ragu", async () => {
    const diminta: string[] = [];
    const p = pasang(["2222", "0364", "0365", "0366"], async (url) => {
      diminta.push(url);
      return jawab({ ada: true, pihak: PIHAK, catatan: [] });
    });
    const r = await p.a3UsulanTanggalKtp("652/Pdt.G/2026/PA.Dgl");
    expect(diminta).toEqual(["/aleta/api/aleta-ecourt/ktp-pihak?nomor=652%2FPdt.G%2F2026%2FPA.Dgl&tunggu=1"]);
    const peta = Object.fromEntries(r.usulan.map((u: Apa) => [u.kode, u]));
    expect(peta["2222"]).toMatchObject({ nilai: "18/02/2012", keyakinan: "cukup", awal: true });
    expect(peta["0364"]).toMatchObject({ nilai: "18/02/2012", keyakinan: "cukup", awal: true, nama: "Tanggal KTP Pemohon I" });
    expect(peta["0366"]).toMatchObject({ nilai: "07/09/2014", keyakinan: "cukup", awal: true, nama: "Tanggal KTP Pemohon II" });
    expect(peta["0365"]).toMatchObject({ nilai: "01/01/2013", keyakinan: "ragu", awal: false });
    for (const u of r.usulan) expect(u.sumber[0].asal).toBe("ktp-ecourt");
    expect(peta["0364"].sumber[0].keterangan).toContain("e-Court: KTP Pemohon I (Siti)");
    expect(peta["0364"].sumber[0].keterangan).toContain("NIK sama dengan SIPP");
    expect(peta["0365"].sumber[0].keterangan).toContain("hanya nama yang cocok dengan pihak SIPP");
    expect(r.usulan.some((u: Apa) => u.tingkat)).toBe(false); // 'pasti' hanya bila dinyalakan
  });

  it("hanya variabel yang ADA di blangko yang diusulkan; pihak tanpa KTP terbaca tidak diusulkan; catatan menjelaskan", async () => {
    const p = pasang(["0366"], async () => jawab({ ada: true, pihak: [PIHAK[0]], catatan: [] }));
    const r = await p.a3UsulanTanggalKtp("1/Pdt.P/2026/PA.Dgl");
    expect(r.usulan).toEqual([]);
    const p2 = pasang(["0364"], async () => jawab({ ada: false, pihak: [], catatan: ["2 berkas KTP e-Court sedang/akan dibaca ALETA di latar - buka lagi sebentar lagi."] }));
    const r2 = await p2.a3UsulanTanggalKtp("1/Pdt.P/2026/PA.Dgl");
    expect(r2.usulan).toEqual([]);
    expect(r2.catatan).toContain("sedang/akan dibaca");
  });

  it("keyakinan 'pasti' (setelah terukur >= 95%) membawa tingkat 'pasti' agar ikut 'Input semua yang pasti'", async () => {
    const p = pasang(["0364"], async () => jawab({ ada: true, pihak: [{ ...PIHAK[0], yakin: "pasti" }], catatan: [] }));
    const r = await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl");
    expect(r.usulan[0]).toMatchObject({ kode: "0364", keyakinan: "cukup", tingkat: "pasti", awal: true });
  });

  it("server ALETA lama (rute ktp-pihak 404): jatuh ke rute ktp-terbit, HANYA untuk 2222/0364 (Penggugat/Pemohon) - bukan 0365/0366", async () => {
    const diminta: string[] = [];
    const p = pasang(["2222", "0364", "0365", "0366"], async (url) => {
      diminta.push(url);
      if (url.includes("/ktp-pihak")) return jawab({}, 404);
      return jawab({ ada: true, tanggal: "18/02/2012", kota: "Donggala", sumber: { judul: "KTP" } });
    });
    const r = await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl");
    expect(diminta.map((u) => u.split("?")[0])).toEqual(["/aleta/api/aleta-ecourt/ktp-pihak", "/aleta/api/aleta-ecourt/ktp-terbit"]);
    expect(r.usulan.map((u: Apa) => u.kode).sort()).toEqual(["0364", "2222"]);
  });

  it("galat server (500) dilaporkan sebagai galat, bukan dikosongkan", async () => {
    const p = pasang(["0364"], async () => jawab({}, 500));
    await expect(p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).rejects.toThrow(/500/);
  });
});
