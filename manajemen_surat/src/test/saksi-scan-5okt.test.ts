// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN 5 OKT 2026 - ISI DARI FOTO KTP: PEMBACAAN, OCR, PDF, WILAYAH
 * ============================================================================
 *
 *   A. urai-ktp.ts    teks OCR KTP BERDERAU sungguhan-rupa: "RTIRW : oo7/oog",
 *                     "viw", "KeI/Desa", "| KABUPATEN DONGGALA", "K0TA",
 *                     "Kecamalan", nama "R0SMIATI", tanggal & kota terbit
 *                     ("Berlaku Hingga : SEUMUR HIDUP 18-02-2012")      (6, 8, 9)
 *   B. ktp-ocr.ts     bacaKtpDariBerkas: beberapa lintasan --psm dipilih
 *                     menurut skor, praproses lewat proses anak (JPEG rusak
 *                     tidak mematikan portal), PDF berlapis teks & pindaian (9)
 *   C. saksiscan.js   pencocokan wilayah toleran OCR tanpa salah pilih,
 *                     menyimpulkan tingkat yang tidak terbaca (NIK, tingkat
 *                     bawah), pesan galat bukan "[object Object]"       (6, 9)
 *   D. alamat-pihak   ekor wilayah dobel e-Court & kurung keterangan rumah
 *                     (butir 26, perkara 556/Pdt.G/2026/PA.Dgl)
 *
 * Pembukti gigitan: ALETA_UJI_SAKSISCAN menunjuk salinan saksiscan.js lama.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { uraiRtRw, uraiTeksIdentitas } from "@/app/api/aleta-ecourt/saksi-scan/urai-ktp";
import { rapikanAlamat } from "@/lib/alamat-pihak";
import { petikDataUmum } from "@/server/modules/aleta-ecourt/berkas-gugatan";
import { uraiPihakGugatan } from "@/server/modules/aleta-ecourt/pihak-gugatan";
import {
  bacaKtpDariBerkas,
  jenisBerkasKtp,
  pembantuAnak,
  uraiBingkai,
  type PembantuGambar,
} from "@/server/modules/aleta-ecourt/ktp-ocr";

const AKAR = path.resolve(__dirname, "../../..");
const SUMBER_SAKSI = (process.env.ALETA_UJI_SAKSISCAN
  ? readFileSync(process.env.ALETA_UJI_SAKSISCAN, "utf8")
  : readFileSync(path.join(AKAR, "ekstensi-sipp", "saksiscan.js"), "utf8")
).replace(/\r\n/g, "\n");

// ============================================================================
// A. URAI TEKS KTP BERDERAU
// ============================================================================
/** Bentuk keluaran tesseract --psm 6 atas foto KTP ponsel (miring sedikit, pas foto di kanan). */
const KTP_DERAU = [
  "PROVINSI SULAWESI TENGAH",
  "| KABUPATEN DONGGALA",
  "NIK : 72O3O94505900001",
  "Nama : R0SMIATI BINTI LA ODE ee",
  "Tempat/Tgl Lahir : DONGGALA, 05-05-1990",
  "Jenis kelamin : PEREMPUAN Gol. Darah : O",
  "Alamat : JL. TRANS SULAWES1 NO. 1O",
  "viw RTIRW : oo7/oog",
  "KeI/Desa : LABUAN SALUMBONE",
  "Kecamalan : LABUAN",
  "Agama : ISLAM",
  "Status Perkawinan : KAWIN",
  "Pekerjaan : MENGURUS RUMAH TANGGA",
  "Kewarganegaraan : WNI",
  "Berlaku Hingga : SEUMUR HIDUP 18-02-2012",
].join("\n");

describe("A. urai teks KTP berderau OCR", () => {
  it("RT/RW 'RTIRW : oo7/oog' -> 007/009; alamat tanpa sampah 'viw RTIRW'; kabupaten dari kepala '| KABUPATEN'; Kel/Desa 'KeI/Desa'", () => {
    const h = uraiTeksIdentitas(KTP_DERAU, 2026);
    expect(h.medan).toMatchObject({
      provinsi: "SULAWESI TENGAH",
      kabupaten: "KABUPATEN DONGGALA",
      kelurahan: "LABUAN SALUMBONE",
      kecamatan: "LABUAN",
      rt: "007",
      rw: "009",
      alamat: "Jl. Trans Sulawesi No. 10",
      nik: "7203094505900001",
      nama: "Rosmiati binti La Ode",
      tempatLahir: "Donggala",
      tanggalLahir: "05/05/1990",
    });
    expect(h.medan.alamat).not.toMatch(/viw|rtirw|rt\s*\/?\s*rw/i);
    expect(h.catatan).toEqual([]);
  });

  it("tanggal terbit dari 'Berlaku Hingga : SEUMUR HIDUP 18-02-2012' (bukan tanggal lahir); kota terbit di baris atas tanggal", () => {
    expect(uraiTeksIdentitas(KTP_DERAU, 2026).medan.tanggalTerbit).toBe("18/02/2012");
    const blok = uraiTeksIdentitas(
      ["NIK : 7203094505900001", "Tempat/Tgl Lahir : PALU, 12-08-2015", "Berlaku Hingga : SEUMUR HIDUP", "DONGGALA", "12-08-2015", "03-03-2016"].join("\n"),
      2026
    );
    // Tanggal lahir 12-08-2015 dilewati; yang terakhir di blok kanan bawah dipakai.
    expect(blok.medan.tanggalTerbit).toBe("03/03/2016");
    const kota = uraiTeksIdentitas(["Nama : X", "Berlaku Hingga : SEUMUR HIDUP", "DONGGALA", "12-08-2015"].join("\n"), 2026);
    expect(kota.medan).toMatchObject({ tanggalTerbit: "12/08/2015", kotaTerbit: "Donggala" });
    // Masa berlaku KTP lama (tanpa seumur hidup) bukan tanggal terbit; sebelum 2011 bukan KTP-el.
    expect(uraiTeksIdentitas("Nama : X\nBerlaku Hingga : 05-05-2017", 2026).medan.tanggalTerbit).toBe("");
    expect(uraiTeksIdentitas("Nama : X\nDONGGALA\n05-05-2009", 2026).medan.tanggalTerbit).toBe("");
    // Tanpa label apa pun: tidak ada tebakan (aturan lama tetap).
    expect(uraiTeksIdentitas("DONGGALA\n12-08-2015", 2026).terbaca).toEqual([]);
  });

  it("label berderau: 'Kel Desa', 'Kel/Des', 'RTRW', 'RT1RW', 'KAB DONGGALA', 'K0TA PALU', 'PR0VINSI', baris kepala tergabung", () => {
    const a = uraiTeksIdentitas("KAB DONGGALA\nKel Desa : TOAYA\nKecamatan : SINDUE\nRTRW : 001I002\nAlamat : DUSUN I", 2026).medan;
    expect(a).toMatchObject({ kabupaten: "KABUPATEN DONGGALA", kelurahan: "TOAYA", kecamatan: "SINDUE", rt: "001", rw: "002" });
    const b = uraiTeksIdentitas("PR0VINSI SULAWESI TENGAH\nK0TA PALU\nKel/Des : BESUSU BARAT\nRT1RW : 003 / 004\nKecamatan PALU TIMUR", 2026).medan;
    expect(b).toMatchObject({ provinsi: "SULAWESI TENGAH", kabupaten: "KOTA PALU", kelurahan: "BESUSU BARAT", kecamatan: "PALU TIMUR", rt: "003", rw: "004" });
    const c = uraiTeksIdentitas("PROVINSI SULAWESI TENGAH KABUPATEN DONGGALA\nNama : X", 2026).medan;
    expect(c).toMatchObject({ provinsi: "SULAWESI TENGAH", kabupaten: "KABUPATEN DONGGALA" });
  });

  it("RT/RW: 0/o/O, g->9, 'I' sebagai garis miring, 'viw' sebagai pemisah, tanpa pemisah", () => {
    expect(uraiRtRw("oo7/oog")).toEqual({ rt: "007", rw: "009" });
    expect(uraiRtRw("001I002")).toEqual({ rt: "001", rw: "002" });
    expect(uraiRtRw("001 viw 002")).toEqual({ rt: "001", rw: "002" });
    expect(uraiRtRw("0011002")).toEqual({ rt: "001", rw: "002" });
    expect(uraiRtRw("007 008")).toEqual({ rt: "007", rw: "008" });
    expect(uraiRtRw(": OO3 / 0O4")).toEqual({ rt: "003", rw: "004" });
    expect(uraiRtRw("000/000")).toBeNull();
    expect(uraiRtRw("-")).toBeNull();
  });

  it("nama orang tidak dirusak: koreksi hanya angka/simbol di dalam kata huruf", () => {
    const h = uraiTeksIdentitas("Nama : SlTI NUR'AINI BINTI LA ODE\nAlamat : BTN BLOK A1 NO. 12", 2026).medan;
    expect(h.nama).toBe("Siti Nur'aini binti La Ode");
    expect(h.alamat).toBe("Btn Blok A1 No. 12");
    // Teks blangko berhuruf campuran tidak disentuh.
    expect(uraiTeksIdentitas("Nama Lengkap : Ahmad Fauzi", 2026).medan.nama).toBe("Ahmad Fauzi");
  });
});

// ============================================================================
// B. ktp-ocr.ts - bacaKtpDariBerkas
// ============================================================================
type Anak = { stdout: { on: (e: string, f: (x: Buffer) => void) => void }; stderr: { on: (e: string, f: (x: Buffer) => void) => void }; stdin: { on: () => void; end: (x?: Buffer) => void }; on: (e: string, f: (...x: unknown[]) => void) => void; kill: () => void };

/** tesseract tiruan: jawaban menurut --psm dan gambar yang diterima. */
function tesseractPalsu(jawab: (psm: string, gambar: Buffer) => string) {
  const panggilan: Array<{ psm: string; gambar: Buffer }> = [];
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
              const psm = argumen[argumen.indexOf("--psm") + 1];
              panggilan.push({ psm, gambar: Buffer.from(x || Buffer.alloc(0)) });
              teks = jawab(psm, x || Buffer.alloc(0));
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

const PNG_KECIL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJAQoAAP//AwBBDAH8Kc8nXgAAAABJRU5ErkJggg==",
  "base64"
);

describe("B. bacaKtpDariBerkas (ktp-ocr.ts)", () => {
  it("jenis berkas dari bait awal: JPEG/PNG/PDF; selain itu ditolak", async () => {
    expect(jenisBerkasKtp(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(jenisBerkasKtp(PNG_KECIL)).toBe("png");
    expect(jenisBerkasKtp(Buffer.from("%PDF-1.7\n..."))).toBe("pdf");
    expect(jenisBerkasKtp(Buffer.from("bukan apa-apa"))).toBeNull();
    const h = await bacaKtpDariBerkas(Buffer.from("bukan apa-apa"));
    expect(h).toMatchObject({ ok: false, alasan: "bukan_berkas_ktp" });
  });

  it("praproses dipakai (abu-abu & hitam-putih), --psm 6/6/4/11 berurutan, yang terbaik dipilih dan medan kosong dilengkapi lintasan lain", async () => {
    const abu = Buffer.from("ABU");
    const biner = Buffer.from("BINER");
    const pembantu: PembantuGambar = async (mode) => (mode === "gambar" ? new Map([["abu", abu], ["biner", biner]]) : null);
    const t = tesseractPalsu((psm, g) => {
      if (g.toString() === "BINER") return "NIK : 7203094505900001\nNama : SITI AMINAH\nAlamat : DUSUN I";
      if (psm === "11") return "Kecamatan : LABUAN";
      return "Nama : SITI";
    });
    const h = await bacaKtpDariBerkas(PNG_KECIL, "image/png", { spawn: t.spawn, pembantu, tahunKini: 2026 });
    expect(t.panggilan.map((p) => `${p.psm}:${p.gambar.toString()}`)).toEqual(["6:ABU", "6:BINER", "4:ABU", "11:ABU"]);
    expect(h).toMatchObject({ ok: true, sumber: "ocr" });
    expect(h.medan).toMatchObject({ nama: "Siti Aminah", nik: "7203094505900001", alamat: "Dusun I", kecamatan: "LABUAN" });
    expect(h.catatan.join(" ")).toMatch(/pembacaan kedua/);
    // Bufer praproses DITIMPA NOL sesudah dipakai.
    expect(abu.every((b) => b === 0) && biner.every((b) => b === 0)).toBe(true);
  });

  it("hasil lengkap di lintasan pertama: lintasan lain tidak dijalankan", async () => {
    const t = tesseractPalsu(() => KTP_DERAU);
    const pembantu: PembantuGambar = async () => new Map([["abu", Buffer.from("A")], ["biner", Buffer.from("B")]]);
    const h = await bacaKtpDariBerkas(PNG_KECIL, "", { spawn: t.spawn, pembantu, tahunKini: 2026 });
    expect(t.panggilan.length).toBe(1);
    expect(h.medan.tanggalTerbit).toBe("18/02/2012");
  });

  it("proses anak gagal/mati (JPEG rusak): OCR tetap jalan atas gambar ASLI, portal tidak ikut mati", async () => {
    const t = tesseractPalsu(() => "Nama : SITI");
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
    const h = await bacaKtpDariBerkas(jpeg, "", { spawn: t.spawn, pembantu: async () => null, tahunKini: 2026 });
    expect(h.ok).toBe(true);
    expect(t.panggilan.map((p) => p.psm)).toEqual(["6", "4", "11"]);
    for (const p of t.panggilan) expect(p.gambar.equals(jpeg)).toBe(true);
  });

  it("proses anak SUNGGUHAN: PNG -> abu & biner (PNG); JPEG rusak -> null tanpa menjatuhkan proses uji", async () => {
    const muat = createRequire(path.join(process.cwd(), "package.json"));
    const kanvas = muat("@napi-rs/canvas") as { createCanvas: (w: number, h: number) => { getContext: (k: string) => { fillStyle: string; fillRect: (...a: number[]) => void; font: string; fillText: (t: string, x: number, y: number) => void }; toBuffer: (m: string) => Buffer } };
    const c = kanvas.createCanvas(300, 120);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#cfe3f5";
    ctx.fillRect(0, 0, 300, 120);
    ctx.fillStyle = "#111";
    ctx.font = "20px sans-serif";
    ctx.fillText("NIK : 7203094505900001", 10, 60);
    const hasil = await pembantuAnak("gambar", c.toBuffer("image/png"), 60000);
    expect(hasil && [...hasil.keys()]).toEqual(["abu", "biner"]);
    for (const b of hasil!.values()) expect(jenisBerkasKtp(b)).toBe("png");
    const rusak = await pembantuAnak("gambar", Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]), 60000);
    expect(rusak).toBeNull();
    expect(uraiBingkai(Buffer.alloc(3))).toEqual(new Map());
  });

  it("PDF berlapis teks: teksnya dipakai tanpa OCR; PDF pindaian: halamannya digambar (pembantu 'pdf') lalu OCR", async () => {
    const muat = createRequire(path.join(process.cwd(), "package.json"));
    const { PDFDocument, StandardFonts } = muat("pdf-lib");
    const dok = await PDFDocument.create();
    const hal = dok.addPage([595, 842]);
    const huruf = await dok.embedFont(StandardFonts.Helvetica);
    ["PROVINSI SULAWESI TENGAH", "KABUPATEN DONGGALA", "NIK : 7203094505900001", "Nama : SITI AMINAH", "Alamat : DUSUN II", "Kecamatan : LABUAN", "Agama : ISLAM"].forEach((b, i) =>
      hal.drawText(b, { x: 40, y: 780 - i * 20, size: 12, font: huruf })
    );
    const berteks = Buffer.from(await dok.save());
    const t = tesseractPalsu(() => "Nama : SALAH");
    const a = await bacaKtpDariBerkas(berteks, "application/pdf", { spawn: t.spawn, pembantu: async () => null, tahunKini: 2026 });
    expect(a).toMatchObject({ ok: true, sumber: "teks-pdf" });
    expect(a.medan).toMatchObject({ nama: "Siti Aminah", kabupaten: "KABUPATEN DONGGALA", kecamatan: "LABUAN" });
    expect(t.panggilan).toEqual([]);

    const kosong = await PDFDocument.create();
    kosong.addPage([595, 842]);
    const pindaian = Buffer.from(await kosong.save());
    const diminta: string[] = [];
    const pembantu: PembantuGambar = async (mode) => {
      diminta.push(mode);
      return new Map([["hal1-abu", Buffer.from("H1")], ["hal1-biner", Buffer.from("H1B")]]);
    };
    const t2 = tesseractPalsu(() => KTP_DERAU);
    const b = await bacaKtpDariBerkas(pindaian, "", { spawn: t2.spawn, pembantu, tahunKini: 2026 });
    expect(diminta).toEqual(["pdf"]);
    expect(b).toMatchObject({ ok: true, sumber: "ocr-pdf" });
    expect(b.medan.tanggalTerbit).toBe("18/02/2012");
    expect(t2.panggilan[0].gambar.toString()).toBe("H1");
  });
});

// ============================================================================
// C. saksiscan.js - fungsi murni
// ============================================================================
type Wil = { kode: string; nama: string; nilaiSipp?: string };
type Murni = {
  saksiscanCocokkan: (n: string, d: Wil[]) => { tepat: Wil | null; yakin?: Wil | null; calon: Array<{ wilayah: Wil }> };
  saksiscanSimpulkanWilayah: (
    baca: Record<string, string>,
    nik: string,
    ambil: (p: { induk: string }) => Promise<unknown>
  ) => Promise<{ ok: boolean; pilih: Record<string, { wilayah: Wil | null; cara: string; dari?: string } | null> }>;
  saksiscanTeksPesan: (x: unknown) => string;
};

function murni(): Murni {
  const k: Record<string, unknown> = { console, globalThis: {} };
  vm.createContext(k);
  vm.runInContext(
    `var document = {}; ${SUMBER_SAKSI}\n;this.__m = { saksiscanCocokkan, saksiscanSimpulkanWilayah: typeof saksiscanSimpulkanWilayah === "function" ? saksiscanSimpulkanWilayah : null, saksiscanTeksPesan: typeof saksiscanTeksPesan === "function" ? saksiscanTeksPesan : null };`,
    k
  );
  return k.__m as Murni;
}

const PETA: Record<string, Wil[]> = {
  "": [
    { kode: "72", nama: "SULAWESI TENGAH", nilaiSipp: "S72" },
    { kode: "73", nama: "SULAWESI SELATAN", nilaiSipp: "S73" },
  ],
  "72": [
    { kode: "72.03", nama: "KAB. DONGGALA", nilaiSipp: "S7203" },
    { kode: "72.10", nama: "KAB. SIGI", nilaiSipp: "S7210" },
    { kode: "72.71", nama: "KOTA PALU", nilaiSipp: "S7271" },
  ],
  "73": [{ kode: "73.71", nama: "KOTA MAKASSAR", nilaiSipp: "S7371" }],
  "72.03": [
    { kode: "72.03.08", nama: "BANAWA", nilaiSipp: "S720308" },
    { kode: "72.03.09", nama: "LABUAN", nilaiSipp: "S720309" },
    { kode: "72.03.12", nama: "SINDUE TOBATA", nilaiSipp: "S720312" },
  ],
  "72.10": [{ kode: "72.10.01", nama: "DOLO", nilaiSipp: "S721001" }],
  "72.71": [{ kode: "72.71.01", nama: "PALU BARAT", nilaiSipp: "S727101" }],
  "73.71": [{ kode: "73.71.01", nama: "MARISO", nilaiSipp: "S737101" }],
  "72.03.09": [
    { kode: "72.03.09.2001", nama: "LABUAN SALUMBONE", nilaiSipp: "D1" },
    { kode: "72.03.09.2002", nama: "LABUAN", nilaiSipp: "D2" },
    { kode: "72.03.09.2003", nama: "LABUAN LELEA", nilaiSipp: "D3" },
  ],
  "72.03.12": [{ kode: "72.03.12.2001", nama: "ALINDAU", nilaiSipp: "D4" }],
  "72.03.08": [{ kode: "72.03.08.1001", nama: "BOYA", nilaiSipp: "D5" }],
  "72.10.01": [{ kode: "72.10.01.2001", nama: "KOTARINDAU", nilaiSipp: "D6" }],
  "72.71.01": [{ kode: "72.71.01.1001", nama: "BAIYA", nilaiSipp: "D7" }],
  "73.71.01": [{ kode: "73.71.01.1001", nama: "BONTORANNU", nilaiSipp: "D8" }],
};
function ambilPalsu() {
  const diminta: string[] = [];
  const ambil = async ({ induk }: { induk: string }) => {
    diminta.push(induk);
    return { ok: true, sandi: { ok: true }, data: PETA[induk] || [] };
  };
  return { ambil, diminta };
}
const kodeDari = (h: Awaited<ReturnType<Murni["saksiscanSimpulkanWilayah"]>>) =>
  Object.fromEntries(Object.entries(h.pilih).map(([k, v]) => [k, v && v.wilayah ? `${v.wilayah.kode}:${v.cara}` : null]));

describe("C. saksiscan.js - wilayah toleran OCR dan disimpulkan", () => {
  const m = murni();

  it("salah baca OCR satu-dua huruf/angka dipilih (yakin) bila unggul jelas; dua calon berdekatan = ragu", () => {
    const kel = PETA["72.03.09"];
    expect(m.saksiscanCocokkan("LABUAN SALUMB0NE", kel).tepat?.kode).toBe("72.03.09.2001"); // 0 -> O = sama persis
    expect(m.saksiscanCocokkan("LABUAN SALUMBON", kel).yakin?.kode).toBe("72.03.09.2001");
    expect(m.saksiscanCocokkan("LABUANSALUMBONE", kel).yakin?.kode).toBe("72.03.09.2001");
    // "LABUAN LELE" mirip "LABUAN LELEA" tetapi juga dekat "LABUAN" - tetap aman karena unggul jelas.
    expect(m.saksiscanCocokkan("LABUAN LELE", kel).yakin?.kode).toBe("72.03.09.2003");
    // "LABUAN SALEA" sama jauhnya dari dua desa: RAGU - tidak dipilih, calon ditawarkan.
    const ragu = m.saksiscanCocokkan("LABUAN SALEA", [
      { kode: "a", nama: "LABUAN SALEB" },
      { kode: "b", nama: "LABUAN SALEC" },
    ]);
    expect(ragu.yakin).toBeNull();
    expect(ragu.calon.length).toBe(2);
    expect(m.saksiscanCocokkan("DONGALA", PETA["72"]).yakin?.kode).toBe("72.03");
  });

  it("kabupaten TIDAK terbaca: disimpulkan dari kecamatan yang hanya ada di satu kabupaten", async () => {
    const { ambil } = ambilPalsu();
    const h = await m.saksiscanSimpulkanWilayah({ provinsi: "SULAWESI TENGAH", kabupaten: "", kecamatan: "LABUAN", kelurahan: "LABUAN SALUMBONE" }, "", ambil);
    expect(kodeDari(h)).toEqual({
      provinsi: "72:tepat",
      kabupaten: "72.03:disimpulkan",
      kecamatan: "72.03.09:tepat",
      kelurahan: "72.03.09.2001:tepat",
    });
    expect(h.pilih.kabupaten!.dari).toBe("Kecamatan");
  });

  it("provinsi TIDAK terbaca: disimpulkan dari kabupaten; kecamatan tak terbaca + NIK: dari 6 angka pertama NIK", async () => {
    const { ambil } = ambilPalsu();
    const tanpaNik = await m.saksiscanSimpulkanWilayah({ provinsi: "", kabupaten: "KABUPATEN DONGGALA", kecamatan: "LABUAN", kelurahan: "" }, "", ambil);
    expect(kodeDari(tanpaNik)).toEqual({
      provinsi: "72:disimpulkan",
      kabupaten: "72.03:tepat",
      kecamatan: "72.03.09:tepat",
      kelurahan: null,
    });
    const h = await m.saksiscanSimpulkanWilayah({ provinsi: "", kabupaten: "KABUPATEN DONGGALA", kecamatan: "", kelurahan: "ALINDAU" }, "72.03.12", ambil);
    expect(kodeDari(h)).toEqual({
      provinsi: "72:nik",
      kabupaten: "72.03:tepat",
      kecamatan: "72.03.12:nik",
      kelurahan: "72.03.12.2001:tepat",
    });
  });

  it("NIK TIDAK menimpa nama yang terbaca jelas; nama terbaca tidak dikenal tanpa calon = NIK", async () => {
    const { ambil } = ambilPalsu();
    const jelas = await m.saksiscanSimpulkanWilayah({ provinsi: "SULAWESI TENGAH", kabupaten: "KOTA PALU", kecamatan: "PALU BARAT", kelurahan: "" }, "72.03.09", ambil);
    expect(kodeDari(jelas)).toMatchObject({ kabupaten: "72.71:tepat", kecamatan: "72.71.01:tepat", kelurahan: null });
    const sampah = await m.saksiscanSimpulkanWilayah({ provinsi: "~~~", kabupaten: "", kecamatan: "", kelurahan: "" }, "72.03.09", ambil);
    expect(kodeDari(sampah)).toMatchObject({ provinsi: "72:nik", kabupaten: "72.03:nik", kecamatan: "72.03.09:nik", kelurahan: null });
  });

  it("tanpa NIK dan tanpa tingkat bawah: tidak menebak", async () => {
    const { ambil } = ambilPalsu();
    const h = await m.saksiscanSimpulkanWilayah({ provinsi: "SULAWESI TENGAH", kabupaten: "", kecamatan: "", kelurahan: "" }, "", ambil);
    expect(kodeDari(h)).toEqual({ provinsi: "72:tepat", kabupaten: null, kecamatan: null, kelurahan: null });
  });

  it("pesan galat rute ({message, details}) menjadi kalimat, bukan '[object Object]'", () => {
    expect(m.saksiscanTeksPesan({ message: "Gambar terlalu besar.", details: null })).toBe("Gambar terlalu besar.");
    expect(m.saksiscanTeksPesan("ok")).toBe("ok");
    expect(m.saksiscanTeksPesan({ error: { message: "x" } })).toBe("x");
    expect(m.saksiscanTeksPesan({})).toBe("");
    expect(m.saksiscanTeksPesan(null)).toBe("");
  });
});

// ============================================================================
// D. alamat-pihak.ts - butir 26
// ============================================================================
describe("D. rapikanAlamat: ekor wilayah dobel e-Court dan kurung keterangan rumah (butir 26)", () => {
  it("Penggugat 556/Pdt.G/2026/PA.Dgl: ekor wilayah sesudah surel domisili elektronik dibuang", () => {
    const h = rapikanAlamat(
      "Desa Alindau, RT 006 RW 006, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah. Domisili elektronik : iraazra67@gmail.com, Alindau, Sindue Tobata, Kabupaten Donggala, Sulawesi Tengah"
    );
    expect(h.alamat).toBe(
      "Desa Alindau, RT 006 RW 006, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah. Domisili elektronik : iraazra67@gmail.com"
    );
    expect(h.berubah).toBe(true);
    expect(h.perubahan.join(" ")).toMatch(/dobel/);
  });

  it("Tergugat 556/Pdt.G/2026/PA.Dgl: kurung keterangan rumah dan ekor wilayah dobel dibuang", () => {
    const h = rapikanAlamat(
      "Desa Oti (rumah depan kantor Desa Oti), Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, Oti, Sindue Tobata, Kabupaten Donggala, Sulawesi Tengah"
    );
    expect(h.alamat).toBe("Desa Oti, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(h.perubahan.join(" ")).toMatch(/rumah depan kantor Desa Oti/);
    expect(h.perubahan.join(" ")).toMatch(/dobel/);
    expect(rapikanAlamat("Desa Oti (rumah Bpk. Hasan), Kecamatan Sindue").alamat).toBe("Desa Oti, Kecamatan Sindue");
  });

  it("yang TIDAK boleh berubah: kurung nama tempat, ekor yang memuat nama baru, desa senama kecamatan, alamat rapi", () => {
    expect(rapikanAlamat("Jalan Merpati (Komplek BTN Lasoani), Kelurahan Lasoani, Kecamatan Mantikulore, Kota Palu").alamat).toBe(
      "Jalan Merpati (Komplek BTN Lasoani), Kelurahan Lasoani, Kecamatan Mantikulore, Kota Palu"
    );
    // Ekor memuat "Tompe" yang tidak ada di depan - bisa jadi keterangan sungguhan: dibiarkan.
    expect(
      rapikanAlamat("Desa Oti, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, Tompe, Sindue Tobata").alamat
    ).toBe("Desa Oti, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, Tompe, Sindue Tobata");
    const senama = "Desa Labuan, Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah";
    expect(rapikanAlamat(senama)).toMatchObject({ alamat: senama, berubah: false });
    const domisili = "Desa Watatu, Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah, Domisili elektronik : a@contoh.com";
    expect(rapikanAlamat(domisili)).toMatchObject({ alamat: domisili, berubah: false });
  });
});

// ============================================================================
// E. pihak-gugatan.ts - butir 28
// ============================================================================
const TEKS_GUGATAN = [
  "Donggala, 28 Juli 2026",
  "Perihal : Gugatan Cerai",
  "Kepada Yth. Ketua Pengadilan Agama Donggala",
  "",
  "Yang bertanda tangan di bawah ini:",
  "SITI AMINAH binti LA ODE, NIK 7203094505900001, tempat dan tanggal lahir Donggala, 5 Mei 1990, agama Islam, pendidikan SLTP, pekerjaan Ibu Rumah Tangga, tempat kediaman di Desa Alindau (rumah depan masjid), RT 006 RW 006, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, domisili elektronik iraazra67@gmail.com, nomor telepon 0812-3456-7890, sebagai Penggugat;",
  "melawan",
  "ANDI SAPUTRA bin MUHAMMAD, umur 34 tahun, agama Islam, pendidikan SLTA, pekerjaan Petani, tempat kediaman di Desa Oti, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, Oti, Sindue Tobata, Kabupaten Donggala, Sulawesi Tengah, sebagai Tergugat;",
  "Adapun alasan-alasan gugatan Penggugat adalah sebagai berikut:",
  "1. Bahwa Penggugat dan Tergugat menikah pada tanggal 1 Januari 2015, sebagai Penggugat dan Tergugat hidup rukun.",
].join("\n");

describe("E. identitas para pihak dari kepala gugatan (butir 28)", () => {
  it("bentuk kalimat 'Nama binti X, umur 29 tahun, agama Islam, pendidikan SLTP, pekerjaan ..., tempat kediaman di ..., sebagai Penggugat'", () => {
    const [p] = uraiPihakGugatan(
      "Yang bertanda tangan di bawah ini: NURHAYATI binti AHMAD, umur 29 tahun, agama Islam, pendidikan SLTP, pekerjaan Ibu Rumah Tangga, tempat kediaman di Desa Labuan, Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah, sebagai Penggugat; Adapun alasan gugatan"
    );
    expect(p).toMatchObject({ peran: "Penggugat", sebutan: "Penggugat" });
    expect(p.medan).toMatchObject({
      nama: "NURHAYATI binti AHMAD",
      umur: "29",
      agama: "Islam",
      pendidikan: "SLTP",
      pekerjaan: "Ibu Rumah Tangga",
      jenisKelamin: "P",
      kelurahan: "Labuan",
      kecamatan: "Labuan",
      kabupaten: "Kabupaten Donggala",
      provinsi: "Sulawesi Tengah",
      alamatLengkap: "Desa Labuan, Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah",
    });
    expect(p.kosong).toEqual(expect.arrayContaining(["NIK", "domisili elektronik", "telepon"]));
    expect(p.kosong).not.toContain("tanggal lahir");
  });

  it("dua pihak: NIK diperiksa (pengurai KTP), TTL, surel, telepon, RT/RW; alamat dirapikan (kurung rumah + ekor dobel dibuang); 'sebagai Penggugat' di posita bukan pihak baru", () => {
    const pihak = uraiPihakGugatan(TEKS_GUGATAN);
    expect(pihak.map((p) => p.sebutan)).toEqual(["Penggugat", "Tergugat"]);
    const [pg, tg] = pihak;
    expect(pg.medan).toMatchObject({
      nik: "7203094505900001",
      tempatLahir: "Donggala",
      tanggalLahir: "05/05/1990",
      surel: "iraazra67@gmail.com",
      telepon: "081234567890",
      rt: "006",
      rw: "006",
      kelurahan: "Alindau",
      alamatLengkap: "Desa Alindau, RT 006 RW 006, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah",
    });
    expect(pg.nik).toMatchObject({ sah: true, kodeKecamatan: "72.03.09" });
    expect(tg.medan).toMatchObject({ nama: "ANDI SAPUTRA bin MUHAMMAD", umur: "34", jenisKelamin: "L", pendidikan: "SLTA", kelurahan: "Oti" });
    expect(tg.medan.alamatLengkap).toBe("Desa Oti, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    // Ikut dalam petikan Data Umum yang sudah dipulangkan rute berkas gugatan.
    expect(petikDataUmum(TEKS_GUGATAN).pihak.map((p) => p.medan.nama)).toEqual(["SITI AMINAH binti LA ODE", "ANDI SAPUTRA bin MUHAMMAD"]);
  });

  it("tanpa identitas berlabel: tidak ada pihak yang dikarang", () => {
    expect(uraiPihakGugatan("Bahwa Penggugat telah menikah, sebagai Penggugat menyatakan keberatan.")).toEqual([]);
  });
});
