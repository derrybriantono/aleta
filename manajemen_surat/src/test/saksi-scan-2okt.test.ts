// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN 2 OKT 2026 - AGEN C: ISI DATA SAKSI DARI FOTO KTP + TEMA GELAP SIPP
 * ============================================================================
 *
 *   A. urai-ktp.ts       teks KTP/blangko tiruan (bising OCR) -> usulan medan;
 *                        NIK diperiksa, tidak ada tebakan dari baris tanpa label
 *   B. ocr.ts            mesin OCR tidak ada -> jujur "belum dapat membaca
 *                        gambar"; gambar hanya lewat stdin (tanpa berkas)
 *   C. rute portal       POST saksi-scan (kewenangan, bukan gambar, bufer foto
 *                        DITIMPA NOL sesudah permintaan) dan GET wilayah
 *   D. bot               sippWilayahService (SELECT berparameter, tingkat dari
 *                        bentuk kode, nilai bersandi = yang didekode SIPP) dan
 *                        rute /sipp/wilayah di balik requireInternalToken
 *   E. saksiscan.js      fungsi murni (pencocokan wilayah, rencana isi) dan
 *                        jsdom: panel-alat.js + saksiscan.js + jembatan.js
 *                        SUNGGUHAN - gerbang peran/UI Baru, isi blangko tanpa
 *                        Simpan, tanpa penanda ALETA, tanpa menyimpan foto
 *   F. manifest/susun    urutan skrip konten SIPP, BERKAS, penjaga TDZ
 *   G. panel.css         blok C2: tema gelap tingkap SIPP (butir 18)
 *
 * Pembukti gigitan memakai SALINAN berkas lewat variabel lingkungan:
 *   ALETA_UJI_SAKSISCAN (saksiscan.js), ALETA_UJI_PANEL_CSS (panel.css).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/shared/errors";

const keadaan = vi.hoisted(() => ({
  izinkan: true,
  kapabilitas: [] as string[],
  panggilanWilayah: [] as Array<Record<string, unknown>>,
  jawabanWilayah: null as null | { ok: true; data: Record<string, unknown> } | { ok: false; error: string; status?: number; kode?: string },
  ocrDipanggil: 0,
  mesinAda: true,
  bufferOcr: null as Buffer | null,
  salinanOcr: "",
  jawabanOcr: null as null | { ok: true; teks: string; mesin: string } | { ok: false; alasan: string; pesan: string },
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
// 18 Okt 2026 (matriks hak akses): rute ini kini juga memeriksa golongan aktor; yang diuji di sini bukan haknya.
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => ({ id: "usr_uji", name: "Uji", roleId: "super-admin", positionId: "", additionalRoleIds: [], isActive: true }),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async (_db: unknown, _aktor: unknown, kapabilitas: string) => {
    keadaan.kapabilitas.push(kapabilitas);
    if (!keadaan.izinkan) throw new ApiError(403, "Peran Anda tidak diberi akses panel.");
    return { id: "usr_uji" };
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { handleRouteError } = await import("@/server/shared/http");
  return { handleAdminRouteError: (galat: unknown) => handleRouteError(galat) };
});
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayWilayahSipp: async (pilihan: Record<string, unknown>) => {
    keadaan.panggilanWilayah.push(pilihan);
    return keadaan.jawabanWilayah ?? { ok: false, error: "tidak ada jawaban tiruan" };
  },
}));
vi.mock("@/app/api/aleta-ecourt/saksi-scan/ocr", () => ({
  PESAN_OCR_BELUM_ADA: "ALETA belum dapat membaca gambar: mesin OCR belum terpasang di server.",
  mesinOcrAda: async () => keadaan.mesinAda,
  bacaGambar: async (b: Buffer) => {
    keadaan.ocrDipanggil += 1;
    keadaan.bufferOcr = b;
    keadaan.salinanOcr = b.toString("base64");
    return keadaan.jawabanOcr ?? { ok: false, alasan: "ocr_belum_tersedia", pesan: "ALETA belum dapat membaca gambar: mesin OCR belum terpasang di server." };
  },
}));

import { POST as POST_SCAN } from "@/app/api/aleta-ecourt/saksi-scan/route";
import { periksaNik, uraiTeksIdentitas } from "@/app/api/aleta-ecourt/saksi-scan/urai-ktp";
import { GET as GET_WILAYAH } from "@/app/api/aleta-ecourt/wilayah/route";

const AKAR = path.resolve(__dirname, "../../..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_JEMBATAN = baca("jembatan.js");
const SUMBER_SAKSI = process.env.ALETA_UJI_SAKSISCAN
  ? readFileSync(process.env.ALETA_UJI_SAKSISCAN, "utf8").replace(/\r\n/g, "\n")
  : baca("saksiscan.js");
const SUMBER_CSS = process.env.ALETA_UJI_PANEL_CSS ? readFileSync(process.env.ALETA_UJI_PANEL_CSS, "utf8") : baca("panel.css");

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 5000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(15);
  }
}

beforeEach(() => {
  // Rute memanggil bacaKtpDariBerkas; praproses (proses anak) dimatikan di
  // sini supaya bufer yang diterima OCR tiruan adalah bufer permintaan itu
  // sendiri. Praproses diuji di saksi-scan-5okt.test.ts.
  process.env.ALETA_OCR_PRAPROSES = "0";
  keadaan.mesinAda = true;
  keadaan.izinkan = true;
  keadaan.kapabilitas = [];
  keadaan.panggilanWilayah = [];
  keadaan.jawabanWilayah = null;
  keadaan.ocrDipanggil = 0;
  keadaan.bufferOcr = null;
  keadaan.salinanOcr = "";
  keadaan.jawabanOcr = null;
});

// ============================================================================
// A. URAI TEKS KTP
// ============================================================================
const KTP_BISING = [
  "PROVINSI SULAWESI TENGAH",
  "KABUPATEN DONGGALA",
  "NIK : 72O3O94505900001",
  "Nama : SITI AMINAH BINTI LA ODE",
  "Tempat/Tgl Lahir : DONGGALA, 05-05-1990",
  "Jenis Kelamin : PEREMPUAN Gol. Darah : O",
  "Alamat : JL. TRANS SULAWESI",
  "DUSUN II",
  "RT/RW : 001/002",
  "Kel/Desa : LABUAN SALUMBONE",
  "Kecamatan : LABUAN",
  "Agama : ISLAM",
  "Status Perkawinan : CERAI HIDUP",
  "Pekerjaan : MENGURUS RUMAH TANGGA",
  "Kewarganegaraan : WNI",
  "Berlaku Hingga : SEUMUR HIDUP",
  "DONGGALA",
  "12-08-2015",
].join("\n");

describe("A. urai teks KTP / blangko", () => {
  it("KTP berbising OCR: medan terisi, NIK dibetulkan (O->0), alamat bersambung, kepala KABUPATEN tetap berawalan", () => {
    const h = uraiTeksIdentitas(KTP_BISING, 2026);
    expect(h.medan).toMatchObject({
      nik: "7203094505900001",
      nama: "Siti Aminah binti La Ode",
      tempatLahir: "Donggala",
      tanggalLahir: "05/05/1990",
      jenisKelamin: "P",
      golonganDarah: "O",
      alamat: "Jl. Trans Sulawesi Dusun II",
      rt: "001",
      rw: "002",
      kelurahan: "LABUAN SALUMBONE",
      kecamatan: "LABUAN",
      kabupaten: "KABUPATEN DONGGALA",
      provinsi: "SULAWESI TENGAH",
      agama: "Islam",
      statusKawin: "Cerai Hidup",
      pekerjaan: "Mengurus Rumah Tangga",
    });
    expect(h.nik).toMatchObject({ sah: true, kodeKecamatan: "72.03.09", tanggalLahir: "05/05/1990", jenisKelamin: "P" });
    expect(h.catatan).toEqual([]);
  });

  it("blangko identitas: 'Alamat Email' bukan alamat, bulan bernama, Kabupaten/Kota, telepon", () => {
    const h = uraiTeksIdentitas(
      [
        "Nama Lengkap : Ahmad Fauzi",
        "Tempat Lahir : Palu",
        "Tanggal Lahir : 7 Agustus 1985",
        "Jenis Kelamin : Laki-laki",
        "Alamat Email : fauzi@contoh.id",
        "Alamat : Jl. Sisingamangaraja No. 5",
        "Kelurahan : Besusu Barat",
        "Kecamatan : Palu Timur",
        "Kabupaten/Kota : Kota Palu",
        "Provinsi : Sulawesi Tengah",
        "No. HP : 0812-3456-7890",
        "Pekerjaan : PEGAWAI NEGERI SIPIL",
      ].join("\n"),
      2026
    );
    expect(h.medan).toMatchObject({
      nama: "Ahmad Fauzi",
      tempatLahir: "Palu",
      tanggalLahir: "07/08/1985",
      jenisKelamin: "L",
      alamat: "Jl. Sisingamangaraja No. 5",
      kelurahan: "Besusu Barat",
      kecamatan: "Palu Timur",
      kabupaten: "Kota Palu",
      provinsi: "Sulawesi Tengah",
      telepon: "081234567890",
      pekerjaan: "Pegawai Negeri Sipil",
      nik: "",
    });
    expect(h.nik).toBeNull();
  });

  it("NIK menyiratkan lain dari yang terbaca: dicatat untuk diperiksa, bukan ditimpa diam-diam", () => {
    const h = uraiTeksIdentitas("NIK : 7203090505900001\nJenis Kelamin : PEREMPUAN\nTempat/Tgl Lahir : PALU, 06-05-1990", 2026);
    expect(h.medan.jenisKelamin).toBe("P");
    expect(h.medan.tanggalLahir).toBe("06/05/1990");
    expect(h.catatan.join(" ")).toMatch(/Tanggal lahir terbaca 06\/05\/1990, tetapi NIK menyiratkan 05\/05\/1990/);
    expect(h.catatan.join(" ")).toMatch(/Jenis kelamin terbaca tidak sama/);
  });

  it("medan kosong diisi dari NIK HANYA bila NIK sah - dengan catatan; NIK mustahil tidak dipakai", () => {
    const sah = uraiTeksIdentitas("NIK : 7203094505900001\nNama : X", 2026);
    expect(sah.medan.tanggalLahir).toBe("05/05/1990");
    expect(sah.medan.jenisKelamin).toBe("P");
    expect(sah.catatan.join(" ")).toMatch(/diambil dari NIK/);

    const mustahil = uraiTeksIdentitas("NIK : 7203094513900001\nNama : X", 2026); // bulan 13
    expect(mustahil.nik?.sah).toBe(false);
    expect(mustahil.medan.tanggalLahir).toBe("");
    expect(mustahil.medan.jenisKelamin).toBe("");
    expect(mustahil.catatan.join(" ")).toMatch(/tidak mungkin/);
    expect(periksaNik("12345").sah).toBe(false);
  });

  it("tanpa label: tidak ada tebakan", () => {
    const h = uraiTeksIdentitas("SITI AMINAH\nDONGGALA 05-05-1990\nPEREMPUAN", 2026);
    expect(h.terbaca).toEqual([]);
    expect(Object.values(h.medan).filter(Boolean)).toEqual([]);
  });
});

// ============================================================================
// B. MESIN OCR - JUJUR BILA TIDAK ADA
// ============================================================================
describe("B. ocr.ts", () => {
  type Anak = {
    stdout: { on: (e: string, f: (x: Buffer) => void) => void };
    stderr: { on: (e: string, f: (x: Buffer) => void) => void };
    stdin: { on: () => void; end: (x?: Buffer) => void };
    on: (e: string, f: (...x: unknown[]) => void) => void;
    kill: () => void;
  };
  function spawnPalsu(perilaku: (argumen: string[], masukan: Buffer | undefined) => { kode?: number; keluar?: string; galat?: string; enoent?: boolean }) {
    const panggilan: Array<{ bin: string; argumen: string[]; masukan?: Buffer }> = [];
    const spawn = (bin: string, argumen: string[]) => {
      const pendengar: Record<string, Array<(...x: unknown[]) => void>> = {};
      const keluar: Array<(x: Buffer) => void> = [];
      const galat: Array<(x: Buffer) => void> = [];
      const catat = { bin, argumen, masukan: undefined as Buffer | undefined };
      panggilan.push(catat);
      const anak: Anak = {
        stdout: { on: (_e, f) => keluar.push(f) },
        stderr: { on: (_e, f) => galat.push(f) },
        stdin: {
          on: () => undefined,
          end: (x?: Buffer) => {
            catat.masukan = x ? Buffer.from(x) : undefined;
            setTimeout(() => {
              const p = perilaku(argumen, x);
              if (p.enoent) {
                for (const f of pendengar.error || []) f(Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }));
                for (const f of pendengar.close || []) f(-2);
                return;
              }
              if (p.keluar) for (const f of keluar) f(Buffer.from(p.keluar));
              if (p.galat) for (const f of galat) f(Buffer.from(p.galat));
              for (const f of pendengar.close || []) f(p.kode ?? 0);
            }, 0);
          },
        },
        on: (e, f) => {
          (pendengar[e] ||= []).push(f);
        },
        kill: () => undefined,
      };
      return anak;
    };
    return { spawn, panggilan };
  }

  it("biner tesseract tidak ada: 'belum dapat membaca gambar', tanpa tebakan", async () => {
    const ocr = await vi.importActual<typeof import("@/app/api/aleta-ecourt/saksi-scan/ocr")>("@/app/api/aleta-ecourt/saksi-scan/ocr");
    ocr.lupakanMesinOcr();
    const s = spawnPalsu(() => ({ enoent: true }));
    const h = await ocr.bacaGambar(Buffer.from([0xff, 0xd8, 0xff]), s.spawn as never);
    expect(h).toEqual({ ok: false, alasan: "ocr_belum_tersedia", pesan: ocr.PESAN_OCR_BELUM_ADA });
    expect(ocr.PESAN_OCR_BELUM_ADA).toMatch(/belum dapat membaca gambar/);
  });

  it("biner ada: gambar dialirkan lewat stdin (tanpa jalur berkas), bahasa ind lalu eng bila data bahasa tidak ada", async () => {
    const ocr = await vi.importActual<typeof import("@/app/api/aleta-ecourt/saksi-scan/ocr")>("@/app/api/aleta-ecourt/saksi-scan/ocr");
    ocr.lupakanMesinOcr();
    const s = spawnPalsu((argumen) => {
      if (argumen[0] === "--version") return { kode: 0, keluar: "tesseract 5" };
      if (argumen.includes("ind")) return { kode: 1, galat: "Failed loading language 'ind'" };
      return { kode: 0, keluar: "NIK : 7203094505900001" };
    });
    const gambar = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
    const h = await ocr.bacaGambar(gambar, s.spawn as never);
    expect(h).toEqual({ ok: true, teks: "NIK : 7203094505900001", mesin: "tesseract (eng)" });
    const baca = s.panggilan.filter((p) => p.argumen[0] === "stdin");
    expect(baca.map((p) => p.argumen.slice(0, 2))).toEqual([["stdin", "stdout"], ["stdin", "stdout"]]);
    for (const p of baca) expect(p.masukan?.equals(gambar)).toBe(true);
    ocr.lupakanMesinOcr();
  });
});

// ============================================================================
// C. RUTE PORTAL
// ============================================================================
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
function mintaScan(badan: unknown) {
  return new NextRequest("http://127.0.0.1/aleta/api/aleta-ecourt/saksi-scan", {
    method: "POST",
    body: typeof badan === "string" ? badan : JSON.stringify(badan),
    headers: { "content-type": "application/json" },
  });
}

describe("C1. POST /api/aleta-ecourt/saksi-scan", () => {
  it("kewenangan 'panel' ditolak -> 403, OCR tidak disentuh", async () => {
    keadaan.izinkan = false;
    const r = await POST_SCAN(mintaScan({ gambar: `data:image/jpeg;base64,${JPEG.toString("base64")}` }));
    expect(r.status).toBe(403);
    expect(keadaan.kapabilitas).toEqual(["panel"]);
    expect(keadaan.ocrDipanggil).toBe(0);
  });

  it("gambar tanpa mesin OCR: jawaban jujur ocr_belum_tersedia, tanpa satu lintasan OCR pun (5 Okt: diperiksa sebelum praproses)", async () => {
    keadaan.mesinAda = false;
    const r = await POST_SCAN(mintaScan({ gambar: `data:image/jpeg;base64,${JPEG.toString("base64")}` }));
    const j = await r.json();
    expect(j.data).toMatchObject({ available: true, ok: false, alasan: "ocr_belum_tersedia" });
    expect(j.data.pesan).toMatch(/belum dapat membaca gambar/);
    expect(keadaan.ocrDipanggil).toBe(0);
  });

  it("mesin ada tetapi OCR gagal: jawaban jujur; bufer foto DITIMPA NOL sesudah permintaan", async () => {
    const r = await POST_SCAN(mintaScan({ gambar: `data:image/jpeg;base64,${JPEG.toString("base64")}` }));
    const j = await r.json();
    expect(j.data).toMatchObject({ available: true, ok: false, alasan: "ocr_belum_tersedia" });
    expect(keadaan.ocrDipanggil).toBe(1);
    expect(keadaan.salinanOcr).toBe(JPEG.toString("base64"));
    // Bufer yang sama yang diterima OCR kini nol seluruhnya.
    expect(keadaan.bufferOcr!.every((b) => b === 0)).toBe(true);
  });

  it("OCR berhasil: usulan medan + teks hasil baca dipulangkan", async () => {
    keadaan.jawabanOcr = { ok: true, teks: KTP_BISING, mesin: "tesseract (ind)" };
    const r = await POST_SCAN(mintaScan({ gambar: JPEG.toString("base64") }));
    const j = await r.json();
    expect(j.data).toMatchObject({ ok: true, sumber: "ocr", mesin: "tesseract (ind)" });
    expect(j.data.medan.nik).toBe("7203094505900001");
    expect(j.data.teks).toContain("NIK");
  });

  it("bukan gambar -> 400 tanpa OCR; teks diurai tanpa OCR; tanpa isi -> 400", async () => {
    const bukan = await POST_SCAN(mintaScan({ gambar: Buffer.from("%PDF-1.4 bukan gambar").toString("base64") }));
    expect(bukan.status).toBe(400);
    expect(keadaan.ocrDipanggil).toBe(0);

    const teks = await (await POST_SCAN(mintaScan({ teks: KTP_BISING }))).json();
    expect(teks.data).toMatchObject({ ok: true, sumber: "teks" });
    expect(teks.data.medan.nama).toBe("Siti Aminah binti La Ode");
    expect(teks.data.teks).toBeUndefined();
    expect(keadaan.ocrDipanggil).toBe(0);

    expect((await POST_SCAN(mintaScan({}))).status).toBe(400);
    const tak = await (await POST_SCAN(mintaScan({ teks: "tidak ada label sama sekali" }))).json();
    expect(tak.data).toMatchObject({ ok: false, alasan: "tidak_terbaca" });
  });
});

describe("C2. GET /api/aleta-ecourt/wilayah", () => {
  const minta = (q: string) => new NextRequest(`http://127.0.0.1/aleta/api/aleta-ecourt/wilayah${q}`);

  it("kode/induk tidak berbentuk kode wilayah: ditolak TANPA menyentuh bot", async () => {
    for (const q of ["?induk=72;DROP", "?kode=7203", "?induk=72.3", "?kode=x"]) {
      const j = await (await GET_WILAYAH(minta(q))).json();
      expect(j.data.ok, q).toBe(false);
    }
    expect(keadaan.panggilanWilayah).toEqual([]);
  });

  it("induk dan kode diteruskan apa adanya; 403 tanpa bot", async () => {
    keadaan.jawabanWilayah = { ok: true, data: { ok: true, tingkat: "kecamatan", data: [{ kode: "72.03.08", nama: "Banawa", nilaiSipp: "X" }] } };
    const j = await (await GET_WILAYAH(minta("?induk=72.03"))).json();
    expect(j.data).toMatchObject({ available: true, ok: true, tingkat: "kecamatan" });
    await GET_WILAYAH(minta("?kode=72.03.08"));
    await GET_WILAYAH(minta(""));
    expect(keadaan.panggilanWilayah).toEqual([{ induk: "72.03" }, { kode: "72.03.08" }, { induk: "" }]);
    keadaan.izinkan = false;
    expect((await GET_WILAYAH(minta("?induk=72"))).status).toBe(403);
    expect(keadaan.panggilanWilayah.length).toBe(3);
  });
});

// ============================================================================
// D. BOT - sippWilayahService DAN RUTENYA
// ============================================================================
const AKAR_BOT = path.join(AKAR, "aleta_bot");
const muatBot = createRequire(path.join(AKAR_BOT, "package.json"));
const KUNCI_UJI = "ujia1eta2026x";

type Kueri = { sql: string; nilai: unknown[] };
let kueriBot: Kueri[] = [];
const WILAYAH_DB: Record<string, Array<{ kode: string; nama: string; induk: string }>> = {
  ref_provinsi_new: [{ kode: "72", nama: "Sulawesi Tengah", induk: "" }],
  ref_kabupaten_new: [
    { kode: "72.03", nama: "Kabupaten Donggala", induk: "72" },
    { kode: "72.71", nama: "Kota Palu", induk: "72" },
  ],
  ref_kecamatan_new: [{ kode: "72.03.09", nama: "Labuan", induk: "72.03" }],
  ref_kelurahan_new: [{ kode: "72.03.09.2001", nama: "Labuan Salumbone", induk: "72.03.09" }],
};

function layananBot() {
  for (const k of Object.keys(muatBot.cache)) if (k.startsWith(AKAR_BOT) && !k.includes("node_modules")) delete muatBot.cache[k];
  const dbPalsu = {
    query(sql: string, nilai: unknown, cb?: (e: unknown, r: unknown) => void) {
      const selesai = (typeof nilai === "function" ? nilai : cb) as (e: unknown, r: unknown) => void;
      const daftar = Array.isArray(nilai) ? nilai : [];
      kueriBot.push({ sql: String(sql), nilai: daftar });
      const tabel = /FROM\s+(ref_\w+)/.exec(String(sql))?.[1] || "";
      const semua = WILAYAH_DB[tabel] || [];
      const hasil = /WHERE\s+\w+_kode\s*=\s*\?\s*LIMIT 1/.test(sql) && !/WHERE\s+(provinsi|kabupaten|kecamatan)_kode\s*=\s*\?\s*ORDER/.test(sql)
        ? semua.filter((w) => w.kode === daftar[0])
        : daftar.length
          ? semua.filter((w) => w.induk === daftar[0])
          : semua;
      setTimeout(() => selesai(null, hasil.map((w) => ({ kode: w.kode, nama: w.nama }))), 0);
    },
  };
  const berkas = muatBot.resolve("./db_config");
  muatBot.cache[berkas] = { id: berkas, filename: berkas, loaded: true, exports: dbPalsu } as unknown as NodeJS.Module;
  return {
    wilayah: muatBot("./services/sippWilayahService.js"),
    tautan: muatBot("./services/sippTautanService.js"),
  };
}

describe("D. bot: sippWilayahService", () => {
  const envAsli = { ...process.env };
  beforeEach(() => {
    kueriBot = [];
    process.env.ALETA_SIPP_ENCRYPTION_KEY = KUNCI_UJI;
  });
  afterEach(() => {
    process.env = { ...envAsli };
  });

  const dekode = (L: ReturnType<typeof layananBot>, nilai: string) =>
    L.tautan._uji.decodeCi(Buffer.from(nilai, "base64").toString("latin1"), L.tautan._uji.bahanDariKunci(Buffer.from(KUNCI_UJI, "latin1")));

  it("tingkat dari bentuk kode induk; SELECT berparameter; nilaiSipp didekode SIPP menjadi kodenya", async () => {
    const L = layananBot();
    const kab = await L.wilayah.daftarWilayah({ induk: "72" });
    expect(kab).toMatchObject({ ok: true, tingkat: "kabupaten", induk: "72", sandi: { ok: true } });
    expect(kab.data.map((d: { kode: string }) => d.kode)).toEqual(["72.03", "72.71"]);
    for (const d of kab.data) expect(dekode(L, d.nilaiSipp)).toBe(d.kode);
    expect(kueriBot[0].sql).toMatch(/^\s*SELECT[\s\S]+FROM ref_kabupaten_new[\s\S]+WHERE provinsi_kode = \?/);
    expect(kueriBot[0].nilai).toEqual(["72"]);

    const prov = await L.wilayah.daftarWilayah({});
    expect(prov.tingkat).toBe("provinsi");
    const kel = await L.wilayah.daftarWilayah({ induk: "72.03.09" });
    expect(kel.tingkat).toBe("kelurahan");
    for (const q of kueriBot) expect(q.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP)\b/i);
  });

  it("induk tidak sah / desa sebagai induk: ditolak tanpa kueri", async () => {
    const L = layananBot();
    for (const induk of ["72;DROP TABLE x", "7203", "72.03.09.2001"]) {
      const h = await L.wilayah.daftarWilayah({ induk });
      expect(h.ok, induk).toBe(false);
    }
    expect(kueriBot).toEqual([]);
  });

  it("kunci SIPP tidak ada: daftar tetap terbaca, nilaiSipp null semuanya, sandi.ok false", async () => {
    delete process.env.ALETA_SIPP_ENCRYPTION_KEY;
    process.env.ALETA_SIPP_CONFIG_PATH = path.join(AKAR, "tidak-ada", "config.php");
    process.env.ALETA_BOT_SIPP_DOCUMENT_ROOTS = path.join(AKAR, "tidak-ada");
    const L = layananBot();
    const h = await L.wilayah.daftarWilayah({ induk: "72" });
    expect(h.ok).toBe(true);
    expect(h.sandi.ok).toBe(false);
    expect(h.data.length).toBe(2);
    expect(h.data.every((d: { nilaiSipp: unknown }) => d.nilaiSipp === null)).toBe(true);
    expect(JSON.stringify(h)).not.toContain(KUNCI_UJI);
  });

  it("jalur menurut kode: provinsi > kabupaten > kecamatan", async () => {
    const L = layananBot();
    const h = await L.wilayah.jalurWilayah({ kode: "72.03.09" });
    expect(h).toMatchObject({ ok: true, lengkap: true });
    expect(h.data.map((d: { tingkat: string; nama: string }) => `${d.tingkat}:${d.nama}`)).toEqual([
      "provinsi:Sulawesi Tengah",
      "kabupaten:Kabupaten Donggala",
      "kecamatan:Labuan",
    ]);
  });

  it("rute /sipp/wilayah terdaftar di balik requireInternalToken dan memakai jawabRute", async () => {
    const isi = readFileSync(path.join(AKAR_BOT, "routes", "internalGatewayRoutes.js"), "utf8");
    const awal = isi.indexOf('router.get("/sipp/wilayah"');
    const akhir = isi.indexOf("\n});\n", awal);
    expect(awal).toBeGreaterThan(0);
    const PENJAGA = () => undefined;
    const rute: Record<string, { penjaga: unknown; penangan: (q: unknown, r: unknown) => Promise<void> }> = {};
    const L = layananBot();
    vm.runInContext(
      isi.slice(awal, akhir + 4),
      vm.createContext({
        require: (x: string) => (x === "../services/sippWilayahService" ? L.wilayah : null),
        requireInternalToken: PENJAGA,
        router: { get: (j: string, p: unknown, f: (q: unknown, r: unknown) => Promise<void>) => (rute[j] = { penjaga: p, penangan: f }) },
      })
    );
    expect(rute["/sipp/wilayah"].penjaga).toBe(PENJAGA);
    let status = 0;
    let body: Record<string, unknown> = {};
    const res = { status: (s: number) => ((status = s), res), json: (x: Record<string, unknown>) => ((body = x), res) };
    await rute["/sipp/wilayah"].penangan({ query: { induk: "72.03" } }, res);
    expect(status).toBe(200);
    expect(body.tingkat).toBe("kecamatan");
    await rute["/sipp/wilayah"].penangan({ query: { induk: "bukan kode" } }, res);
    expect(status).toBe(400);
  });
});

// ============================================================================
// E. saksiscan.js
// ============================================================================
type Murni = {
  saksiscanCocokkan: (n: string, d: Array<{ kode: string; nama: string }>) => { tepat: { kode: string } | null; calon: Array<{ wilayah: { kode: string } }> };
  saksiscanRencana: (t: Record<string, unknown>, b: Record<string, unknown>) => { langkah: Array<{ penunjuk: string; jenis: string; nilai: string; opsi?: { tulisan: string; nilai: string } }>; wilayahDiisi: boolean };
  saksiscanNilaiStatusKawin: (s: string, jk: string) => string;
  saksiscanPekerjaan: (p: string) => { pilih: string; teks: string };
  saksiscanSusunAlamat: (m: Record<string, unknown>, w: Record<string, unknown>) => string;
};

function murni(): Murni {
  const k: Record<string, unknown> = { console, globalThis: {} };
  vm.createContext(k);
  // Tanpa document: pemasangan diri berhenti sendiri (document.body tidak ada).
  vm.runInContext(`var document = {}; ${SUMBER_SAKSI}\n;this.__m = { saksiscanCocokkan, saksiscanRencana, saksiscanNilaiStatusKawin, saksiscanPekerjaan, saksiscanSusunAlamat };`, k);
  return k.__m as Murni;
}

const PROV = [{ kode: "72", nama: "Sulawesi Tengah", nilaiSipp: "NS72" }];
const KAB = [
  { kode: "72.03", nama: "Kabupaten Donggala", nilaiSipp: "NS7203" },
  { kode: "72.71", nama: "Kota Palu", nilaiSipp: "NS7271" },
  { kode: "72.09", nama: "Kabupaten Palu", nilaiSipp: "NS7209" },
];
const KEC = [
  { kode: "72.03.08", nama: "Banawa", nilaiSipp: "NS720308" },
  { kode: "72.03.09", nama: "Labuan", nilaiSipp: "NS720309" },
];
const KEL = [
  { kode: "72.03.09.2001", nama: "Labuan Salumbone", nilaiSipp: "NS1" },
  { kode: "72.03.09.2002", nama: "Labuan", nilaiSipp: "NS2" },
];

describe("E1. saksiscan.js - fungsi murni", () => {
  const m = murni();

  it("cocok TEPAT saja yang dipilih; Kab. vs Kota dibedakan; salah baca hanya ditawarkan", () => {
    expect(m.saksiscanCocokkan("KABUPATEN DONGGALA", KAB).tepat?.kode).toBe("72.03");
    expect(m.saksiscanCocokkan("KOTA PALU", KAB).tepat?.kode).toBe("72.71");
    const ganda = m.saksiscanCocokkan("PALU", KAB);
    expect(ganda.tepat).toBeNull();
    expect(ganda.calon.map((c) => c.wilayah.kode).sort()).toEqual(["72.09", "72.71"]);
    const salah = m.saksiscanCocokkan("LABUAN SALUMBON", KEL);
    expect(salah.tepat).toBeNull();
    expect(salah.calon[0].wilayah.kode).toBe("72.03.09.2001");
    expect(m.saksiscanCocokkan("ZZZZZ QQQ", KEL)).toEqual({ tepat: null, yakin: null, calon: [] });
  });

  const tinjauLengkap = () => ({
    nama: "Siti Aminah",
    nik: "7203094505900001",
    tempatLahir: "Donggala",
    tanggalLahir: "05/05/1990",
    jenisKelamin: "P",
    agama: "Kristen",
    statusKawin: "Cerai Hidup",
    pekerjaan: "Petani/Pekebun",
    golonganDarah: "O",
    alamatLengkap: "Jl. Trans Sulawesi, Desa Labuan Salumbone",
    wilayah: { provinsi: PROV[0], kabupaten: KAB[0], kecamatan: KEC[1], kelurahan: KEL[0] },
  });
  const borang = { pilihanAgama: [{ nilai: "", tulisan: "Pilih Agama" }, { nilai: "1", tulisan: "Islam" }, { nilai: "2", tulisan: "Protestan" }], apakahTni: true };

  it("rencana: wilayah induk -> anak dengan pilihan {nama SIPP, nilai bersandi}; Keterangan & Simpan tidak pernah disentuh; tanpa 'ALETA'", () => {
    const r = m.saksiscanRencana(tinjauLengkap(), borang);
    expect(r.wilayahDiisi).toBe(true);
    const wilayah = r.langkah.filter((l) => l.opsi);
    expect(wilayah.map((l) => [l.penunjuk, l.nilai, l.opsi!.tulisan])).toEqual([
      ["#prop", "NS72", "Sulawesi Tengah"],
      ["#kab", "NS7203", "Kabupaten Donggala"],
      ["#kec", "NS720309", "Labuan"],
      ["#kel", "NS1", "Labuan Salumbone"],
    ]);
    const peta = Object.fromEntries(r.langkah.map((l) => [l.penunjuk, l.nilai]));
    expect(peta).toMatchObject({
      "#pihak_jenis_identitas": "4",
      "#pihak_no_identitas": "7203094505900001",
      "#pihak_jenis_kelamin": "2",
      "#pihak_agama": "2",
      "#apakahtni": "2",
      "#pihak_pekerjaan": "Petani/Pekebun",
      "#pihak_status_kawin": "4",
      "#pihak_gol_darah": "O",
    });
    const semua = JSON.stringify(r);
    expect(semua).not.toMatch(/aleta/i);
    expect(r.langkah.some((l) => /keterangan|simpan|submit|btn/i.test(l.penunjuk))).toBe(false);
  });

  // Perbaikan 5 Okt (butir 7): bukan lagi semua-atau-tidak - diisi BERURUTAN
  // induk ke anak sejauh rantainya utuh; tingkat pertama yang putus/kosong/
  // tanpa sandi menghentikan rantai (anak tanpa induk benar tidak pernah diisi).
  it("wilayah diisi berurutan SEJAUH rantai utuh: berhenti di tingkat yang putus, kosong, atau tanpa sandi", () => {
    const wil = (r: ReturnType<Murni["saksiscanRencana"]>) => r.langkah.filter((l) => l.opsi).map((l) => l.penunjuk);
    const putus = tinjauLengkap();
    putus.wilayah.kecamatan = { kode: "72.71.01", nama: "Palu Barat", nilaiSipp: "X" };
    expect(wil(m.saksiscanRencana(putus, borang))).toEqual(["#prop", "#kab"]);
    const kurang = tinjauLengkap();
    (kurang.wilayah as Record<string, unknown>).kelurahan = null;
    const rk = m.saksiscanRencana(kurang, borang);
    expect(rk.wilayahDiisi).toBe(false);
    expect(wil(rk)).toEqual(["#prop", "#kab", "#kec"]);
    expect((rk as unknown as { wilayahTerisi: number }).wilayahTerisi).toBe(3);
    const tanpaKab = tinjauLengkap();
    (tanpaKab.wilayah as Record<string, unknown>).kabupaten = null;
    expect(wil(m.saksiscanRencana(tanpaKab, borang))).toEqual(["#prop"]);
    const tanpaSandi = tinjauLengkap();
    tanpaSandi.wilayah.provinsi = { ...PROV[0], nilaiSipp: null as unknown as string };
    expect(wil(m.saksiscanRencana(tanpaSandi, borang))).toEqual([]);
  });

  it("status kawin, pekerjaan, dan susunan alamat dari nama SIPP", () => {
    expect(m.saksiscanNilaiStatusKawin("Cerai Mati", "L")).toBe("3");
    expect(m.saksiscanNilaiStatusKawin("Cerai Hidup", "")).toBe("");
    expect(m.saksiscanNilaiStatusKawin("Belum Kawin", "P")).toBe("2");
    expect(m.saksiscanPekerjaan("PEGAWAI NEGERI SIPIL")).toEqual({ pilih: "3", teks: "" });
    expect(m.saksiscanPekerjaan("Pensiunan PNS")).toEqual({ pilih: "2", teks: "Pensiunan PNS" });
    expect(
      m.saksiscanSusunAlamat(
        { alamat: "Jl. Trans Sulawesi", rt: "001", rw: "002" },
        { provinsi: PROV[0], kabupaten: KAB[0], kecamatan: KEC[1], kelurahan: KEL[0] }
      )
    ).toBe("Jl. Trans Sulawesi, RT 001/RW 002, Desa Labuan Salumbone, Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah");
  });
});

// ---------------------------------------------------------------------------
// E2. jsdom: panel-alat.js + saksiscan.js (skrip konten) + jembatan.js (halaman)
// ---------------------------------------------------------------------------
const ASAL = "http://192.168.10.10";
const BLANGKO = `
<div id="konten">detil perkara</div>
<div id="popup_pihak" class="popup" style="display:block">
  <div class="detil" style="padding: 2px;background-color: white;">
    <form id="frm_ref_pihak" method="post" action="/SIPP/pihak_list/validateInput">
      <table id="tableDetilPerkara" class="pihak_list"><tbody>
        <tr><td>Nama</td><td><input type="text" id="pihak_fullname" name="pihak_fullname" class="standard-input"></td></tr>
        <tr><td>Tempat Lahir</td><td><input type="text" id="pihak_tempat_lahir" name="pihak_tempat_lahir"></td></tr>
        <tr><td>Tanggal Lahir</td><td><input id="pihak_tgl_lahir" name="pihak_tgl_lahir" class="datepicker" value="02/10/2026"></td></tr>
        <tr><td>Jenis Identitas</td><td><select id="pihak_jenis_identitas" name="pihak_jenis_identitas"><option value="">Pilih Identitas</option><option value="4">KTP</option></select></td></tr>
        <tr><td>No Identitas</td><td><input type="text" id="pihak_no_identitas" name="pihak_no_identitas"></td></tr>
        <tr><td>No Telepon</td><td><input type="text" id="pihak_no_tlp" name="pihak_no_tlp"></td></tr>
        <tr><td>Alamat</td><td><textarea id="pihak_alamat" name="pihak_alamat"></textarea></td></tr>
        <tr class="wni"><td>Provinsi</td><td><select name="prop" id="prop"><option value="">- Cari/Pilih Propinsi -</option></select></td></tr>
        <tr class="wni"><td>Kabupaten/Kota</td><td><select name="kab" id="kab"><option value="">- Cari/Pilih Kabupaten/Kota -</option></select></td></tr>
        <tr class="wni"><td>Kecamatan</td><td><select name="kec" id="kec"><option value="">- Cari/Pilih Kecamatan -</option></select></td></tr>
        <tr class="wni"><td>Kelurahan/Desa</td><td><select name="kel" id="kel"><option value="">- Cari/Pilih Kelurahan/Desa -</option></select></td></tr>
        <tr><td>Jenis Kelamin</td><td><select id="pihak_jenis_kelamin" name="pihak_jenis_kelamin"><option value="">Pilih</option><option value="1">Laki Laki</option><option value="2">Perempuan</option></select></td></tr>
        <tr><td>Agama</td><td><select id="pihak_agama" name="pihak_agama"><option value="">Pilih Agama</option><option value="1">Islam</option><option value="2">Protestan</option></select></td></tr>
        <tr><td>Pekerjaan</td><td><select id="apakahtni" name="apakahtni"><option value="">Pilih Pekerjaan</option><option value="3">Pegawai Negeri Sipil</option><option value="2">Lain-Lain</option></select></td></tr>
        <tr id="input_pihak_pekerjaan"><td></td><td><input type="text" id="pihak_pekerjaan" name="pihak_pekerjaan"></td></tr>
        <tr><td>Status Kawin</td><td><select id="pihak_status_kawin" name="pihak_status_kawin"><option value="">Pilih</option><option value="1">Kawin</option><option value="2">Belum Kawin</option><option value="3">Duda</option><option value="4">Janda</option></select></td></tr>
        <tr><td>Golongan Darah</td><td><select id="pihak_gol_darah" name="pihak_gol_darah"><option value="">Pilih</option><option value="A">A</option><option value="O">O</option></select></td></tr>
        <tr><td>Keterangan</td><td><textarea id="pihak_keterangan" name="pihak_keterangan"></textarea></td></tr>
        <tr><td colspan="2"><input type="button" id="back_pihak" value="Kembali" class="btn"><input type="submit" id="simpan_btn" value="Simpan" class="btn"></td></tr>
      </tbody></table>
    </form>
  </div>
</div>`;

const MEDAN_SCAN = {
  nama: "Siti Aminah",
  nik: "7203094505900001",
  tempatLahir: "Donggala",
  tanggalLahir: "05/05/1990",
  jenisKelamin: "P",
  golonganDarah: "O",
  agama: "Islam",
  statusKawin: "Kawin",
  pekerjaan: "Mengurus Rumah Tangga",
  kewarganegaraan: "WNI",
  alamat: "Jl. Trans Sulawesi",
  rt: "001",
  rw: "002",
  kelurahan: "LABUAN SALUMBON",
  kecamatan: "LABUAN",
  kabupaten: "KABUPATEN DONGGALA",
  provinsi: "SULAWESI TENGAH",
  telepon: "",
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type PilihanHalaman = { peran?: string; mode?: string; izinkanNyata?: boolean; tersembunyi?: boolean; jawabScan?: Record<string, unknown> };

function bukaSipp(p: PilihanHalaman = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${BLANGKO}</body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: p.mode ?? "ui", ujiIzinkanNyata: p.izinkanNyata ?? true };
  const tulisanStorage: string[] = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.178.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: () => undefined },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = JSON.parse(JSON.stringify(simpanan[k]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(isi)) {
            tulisanStorage.push(`${k}=${JSON.stringify(v)}`);
            simpanan[k] = v;
          }
        },
        remove: async () => undefined,
      },
      session: {
        get: async () => ({}),
        set: async (isi: Record<string, unknown>) => {
          tulisanStorage.push(`session:${JSON.stringify(isi)}`);
        },
      },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Array<{ url: string; cara: string; badan: string }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    minta.push({ url, cara: String((opsi && opsi.method) || "GET").toUpperCase(), badan: String((opsi && opsi.body) || "") });
    if (url.includes("/ekstensi/siapa")) return Response.json({ ok: true, data: { nama: "Penguji", peran: p.peran ?? "Operator" } });
    if (url.includes("/aleta-ecourt/wilayah")) {
      const q = new URL(url, ASAL).searchParams;
      const induk = q.get("induk") || "";
      const peta: Record<string, unknown[]> = { "": PROV, "72": KAB, "72.03": KEC, "72.03.09": KEL };
      if (q.get("kode")) return Response.json({ ok: true, data: { ok: true, lengkap: true, sandi: { ok: true }, data: [{ tingkat: "provinsi", ...PROV[0] }, { tingkat: "kabupaten", ...KAB[0] }, { tingkat: "kecamatan", ...KEC[1] }] } });
      return Response.json({ ok: true, data: { ok: true, sandi: { ok: true }, data: peta[induk] || [] } });
    }
    if (url.includes("/aleta-ecourt/saksi-scan")) {
      return Response.json({ ok: true, data: p.jawabScan ?? { available: true, ok: true, sumber: "teks", medan: MEDAN_SCAN, nik: { sah: true, kodeKecamatan: "72.03.09" }, catatan: [], terbaca: ["nama"] } });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  // jsdom: postMessage tanpa source - disalurkan seperti peramban (source = window).
  w.postMessage = (data: unknown) => setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data, source: w })), 0);
  // Gambar tidak dimuat di jsdom - gagal muat seketika, dipakai apa adanya.
  w.Image = class {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    set src(_x: string) {
      setTimeout(() => this.onerror && this.onerror(), 0);
    }
  };
  if (p.tersembunyi) (w.document.getElementById("popup_pihak") as HTMLElement).style.display = "none";
  let simpanDitekan = 0;
  let dikirim = 0;
  w.document.getElementById("simpan_btn").addEventListener("click", () => (simpanDitekan += 1));
  w.document.getElementById("frm_ref_pihak").addEventListener("submit", (e: Event) => {
    dikirim += 1;
    e.preventDefault();
  });
  w.eval(SUMBER_JEMBATAN);
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_SAKSI}\n;\nwindow.__uji = { mode: () => alatUjiMode() };`);
  return { dom, w, minta, simpanan, tulisanStorage, simpan: () => simpanDitekan, kirim: () => dikirim, doc: w.document as Document };
}
type Halaman = ReturnType<typeof bukaSipp>;
const pemicu = (h: Halaman) => h.doc.querySelector(".aleta-c2-saksi-pemicu") as HTMLButtonElement | null;
const pemicuTampak = (h: Halaman) => Boolean(pemicu(h) && !pemicu(h)!.hidden);
const kartu = (h: Halaman) => h.doc.querySelector(".aleta-c2-saksi") as HTMLElement;
const nilai = (h: Halaman, s: string) => (h.doc.querySelector(s) as HTMLInputElement).value;

async function bacaDanTinjau(h: Halaman) {
  await sampai(() => pemicuTampak(h), "pemicu tampak");
  pemicu(h)!.click();
  const k = kartu(h);
  (k.querySelector(".aleta-c2-saksi-teks") as HTMLTextAreaElement).value = "NIK : 7203094505900001";
  (k.querySelector(".aleta-c2-saksi-baca") as HTMLButtonElement).click();
  await sampai(() => !(k.querySelector(".aleta-c2-saksi-tinjau") as HTMLElement).hidden, "kartu tinjau");
  await sampai(() => (k.querySelector("[data-saksi-ket='kelurahan']") as HTMLElement).textContent, "desa dimuat");
  return k;
}

describe("E2. saksiscan.js di halaman SIPP (jsdom)", () => {
  it("gerbang peran: hakim, panitera/PP, juru sita TIDAK; operator dan admin YA", async () => {
    for (const peran of ["Hakim", "Ketua", "Panitera Pengganti", "Jurusita Pengganti"]) {
      const h = bukaSipp({ peran });
      await sampai(() => h.minta.some((m) => m.url.includes("/ekstensi/siapa")), `siapa ${peran}`);
      await tunggu(80);
      expect(pemicuTampak(h), peran).toBe(false);
    }
    for (const peran of ["Operator", "Petugas PTSP", "Super Admin"]) {
      const h = bukaSipp({ peran });
      await sampai(() => pemicuTampak(h), `pemicu ${peran}`);
    }
  });

  it("gerbang tampilan: Lama dan Baru tidak memasang apa pun; blangko tertutup = tanpa pemicu sampai dibuka", async () => {
    for (const mode of ["lama", "baru"]) {
      const h = bukaSipp({ mode });
      await sampai(() => h.w.__uji.mode() === mode, `mode ${mode}`);
      await tunggu(600);
      expect(pemicu(h), mode).toBeNull();
      expect(h.minta.some((m) => m.url.includes("/ekstensi/siapa")), mode).toBe(false);
    }
    const h = bukaSipp({ tersembunyi: true });
    await sampai(() => h.w.__uji.mode() === "ui", "mode ui");
    await tunggu(600);
    expect(pemicuTampak(h)).toBe(false);
    (h.doc.getElementById("popup_pihak") as HTMLElement).style.display = "block";
    await sampai(() => pemicuTampak(h), "pemicu sesudah blangko dibuka");
  });

  // Perbaikan 5 Okt (butir 6): salah baca OCR satu huruf ("LABUAN SALUMBON")
  // yang unggul jelas atas calon lain kini DIPILIH - ditandai "periksa".
  it("tinjau: yang cocok tepat terpilih; salah baca satu huruf yang unggul jelas dipilih dan ditandai periksa", async () => {
    const h = bukaSipp();
    const k = await bacaDanTinjau(h);
    const sel = (t: string) => k.querySelector(`select[data-saksi-wilayah='${t}']`) as HTMLSelectElement;
    expect([sel("provinsi").value, sel("kabupaten").value, sel("kecamatan").value]).toEqual(["72", "72.03", "72.03.09"]);
    expect(sel("kelurahan").value).toBe("72.03.09.2001");
    const mirip = sel("kelurahan").querySelector("optgroup[label='Paling mirip dengan hasil baca'] option") as HTMLOptionElement;
    expect(mirip.value).toBe("72.03.09.2001");
    expect(k.querySelector("[data-saksi-ket='kelurahan']")!.textContent).toMatch(/paling mirip, periksa/);
    expect(k.querySelector("[data-saksi-ket='kecamatan']")!.textContent).toMatch(/cocok tepat/);
    // Belum dicentang: tombol isi mati.
    expect((k.querySelector(".aleta-c2-saksi-isi") as HTMLButtonElement).disabled).toBe(true);
  });

  it("isi ke blangko: medan terisi lewat jembatan, Simpan TIDAK ditekan, tanpa penanda ALETA, foto/isian tidak disimpan", async () => {
    const h = bukaSipp();
    const k = await bacaDanTinjau(h);
    const kel = k.querySelector("select[data-saksi-wilayah='kelurahan']") as HTMLSelectElement;
    kel.value = "72.03.09.2001";
    kel.dispatchEvent(new h.w.Event("change"));
    await tunggu(30);
    const centang = k.querySelector(".aleta-c2-saksi-sudah") as HTMLInputElement;
    centang.checked = true;
    centang.dispatchEvent(new h.w.Event("change"));
    (k.querySelector(".aleta-c2-saksi-isi") as HTMLButtonElement).click();
    await sampai(() => /BELUM TERSIMPAN/.test(k.querySelector(".aleta-c2-saksi-status")!.textContent || ""), "selesai isi");

    expect({
      nama: nilai(h, "#pihak_fullname"),
      tl: nilai(h, "#pihak_tempat_lahir"),
      tgl: nilai(h, "#pihak_tgl_lahir"),
      ji: nilai(h, "#pihak_jenis_identitas"),
      nik: nilai(h, "#pihak_no_identitas"),
      prop: nilai(h, "#prop"),
      kab: nilai(h, "#kab"),
      kec: nilai(h, "#kec"),
      kel: nilai(h, "#kel"),
      jk: nilai(h, "#pihak_jenis_kelamin"),
      agama: nilai(h, "#pihak_agama"),
      tni: nilai(h, "#apakahtni"),
      pek: nilai(h, "#pihak_pekerjaan"),
      sk: nilai(h, "#pihak_status_kawin"),
      gd: nilai(h, "#pihak_gol_darah"),
      ket: nilai(h, "#pihak_keterangan"),
    }).toEqual({
      nama: "Siti Aminah",
      tl: "Donggala",
      tgl: "05/05/1990",
      ji: "4",
      nik: "7203094505900001",
      prop: "NS72",
      kab: "NS7203",
      kec: "NS720309",
      kel: "NS1",
      jk: "2",
      agama: "1",
      tni: "2",
      pek: "Mengurus Rumah Tangga",
      sk: "1",
      gd: "O",
      ket: "",
    });
    expect(nilai(h, "#pihak_alamat")).toBe(
      "Jl. Trans Sulawesi, RT 001/RW 002, Desa Labuan Salumbone, Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah"
    );
    // Pilihan wilayah berbentuk persis buatan SIPP: placeholder + satu {nama SIPP, nilai bersandi}.
    const prop = h.doc.getElementById("prop") as HTMLSelectElement;
    expect(Array.from(prop.options).map((o) => [o.value, o.textContent])).toEqual([["", "- Cari/Pilih Propinsi -"], ["NS72", "Sulawesi Tengah"]]);

    // Simpan tidak ditekan, blangko tidak dikirim.
    expect(h.simpan()).toBe(0);
    expect(h.kirim()).toBe(0);
    // Butir 14: tidak ada penanda ALETA di blangko SIPP (atribut, kelas, nilai).
    const borang = h.doc.getElementById("frm_ref_pihak") as HTMLFormElement;
    expect(borang.outerHTML).not.toMatch(/aleta/i);
    for (const el of Array.from(borang.querySelectorAll("input, textarea, select"))) {
      expect(String((el as HTMLInputElement).value), (el as HTMLElement).id).not.toMatch(/aleta/i);
    }
    // Kartu & pemicu di luar blangko.
    expect(borang.contains(k)).toBe(false);
    // Tidak ada data orang di chrome.storage maupun localStorage.
    expect(h.tulisanStorage.join("\n")).not.toMatch(/7203094505900001|Siti Aminah|saksi/i);
    expect(JSON.stringify({ ...h.w.localStorage })).not.toMatch(/7203094505900001|Siti/);
    // Satu-satunya non-GET: pembacaan ke saksi-scan.
    expect(h.minta.filter((m) => m.cara !== "GET").map((m) => new URL(m.url, ASAL).pathname)).toEqual(["/aleta/api/aleta-ecourt/saksi-scan"]);
  });

  it("medan yang disembunyikan SIPP (non-WNI: baris wilayah) tidak diisi", async () => {
    const h = bukaSipp();
    for (const tr of Array.from(h.doc.querySelectorAll("tr.wni"))) (tr as HTMLElement).style.display = "none";
    const k = await bacaDanTinjau(h);
    const kel = k.querySelector("select[data-saksi-wilayah='kelurahan']") as HTMLSelectElement;
    kel.value = "72.03.09.2001";
    kel.dispatchEvent(new h.w.Event("change"));
    await tunggu(30);
    const centang = k.querySelector(".aleta-c2-saksi-sudah") as HTMLInputElement;
    centang.checked = true;
    centang.dispatchEvent(new h.w.Event("change"));
    (k.querySelector(".aleta-c2-saksi-isi") as HTMLButtonElement).click();
    await sampai(() => /BELUM TERSIMPAN/.test(k.querySelector(".aleta-c2-saksi-status")!.textContent || ""), "selesai isi");
    expect(nilai(h, "#pihak_fullname")).toBe("Siti Aminah");
    expect([nilai(h, "#prop"), nilai(h, "#kab"), nilai(h, "#kec"), nilai(h, "#kel")]).toEqual(["", "", "", ""]);
  });

  it("tanpa centang 'sudah saya periksa': tidak ada yang diisikan", async () => {
    const h = bukaSipp();
    const k = await bacaDanTinjau(h);
    const tombol = k.querySelector(".aleta-c2-saksi-isi") as HTMLButtonElement;
    tombol.disabled = false; // dipaksa - fungsinya sendiri tetap menolak
    tombol.click();
    await tunggu(300);
    expect(nilai(h, "#pihak_fullname")).toBe("");
    expect(nilai(h, "#prop")).toBe("");
  });

  it("gambar: dikirim sekali, jawaban 'belum dapat membaca gambar' ditampilkan jujur, berkas dilepas; tutup = isian terhapus", async () => {
    const h = bukaSipp({ jawabScan: { available: true, ok: false, alasan: "ocr_belum_tersedia", pesan: "ALETA belum dapat membaca gambar: mesin OCR belum terpasang di server." } });
    await sampai(() => pemicuTampak(h), "pemicu");
    pemicu(h)!.click();
    const k = kartu(h);
    const masukan = k.querySelector(".aleta-c2-saksi-berkas") as HTMLInputElement;
    const berkas = new h.w.File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "ktp.jpg", { type: "image/jpeg" });
    Object.defineProperty(masukan, "files", { value: [berkas], configurable: true });
    (k.querySelector(".aleta-c2-saksi-baca") as HTMLButtonElement).click();
    await sampai(() => /belum dapat membaca gambar/.test(k.querySelector(".aleta-c2-saksi-status")!.textContent || ""), "pesan jujur");
    const kirim = h.minta.filter((m) => m.cara === "POST");
    expect(kirim.length).toBe(1);
    expect(JSON.parse(kirim[0].badan).gambar).toMatch(/^data:image\/jpeg;base64,/);
    expect((k.querySelector(".aleta-c2-saksi-tinjau") as HTMLElement).hidden).toBe(true);
    expect(h.tulisanStorage.join("\n")).not.toMatch(/base64|image\//);
    (k.querySelector(".aleta-c2-saksi-teks") as HTMLTextAreaElement).value = "Nama : X";
    (k.querySelector(".aleta-c2-saksi-tutup") as HTMLButtonElement).click();
    expect(k.hidden).toBe(true);
    expect((k.querySelector(".aleta-c2-saksi-teks") as HTMLTextAreaElement).value).toBe("");
  });

  it("mode coba (Super Admin mencoba UI Baru tanpa izin tindakan nyata): baca KTP BOLEH, POST lain tetap ditahan", async () => {
    // saksi-scan hanya menghitung usulan dan tidak menyimpan apa pun, jadi masuk
    // ALETA_COBA_BOLEH (panel-alat.js) seperti konversi-naskah. Yang ditahan mode coba
    // adalah tulisan sungguhan - tidak ada POST selain saksi-scan yang lolos.
    const h = bukaSipp({ izinkanNyata: false });
    await sampai(() => pemicuTampak(h), "pemicu");
    pemicu(h)!.click();
    const k = kartu(h);
    (k.querySelector(".aleta-c2-saksi-teks") as HTMLTextAreaElement).value = "NIK : 7203094505900001";
    (k.querySelector(".aleta-c2-saksi-baca") as HTMLButtonElement).click();
    await sampai(() => h.minta.some((m) => m.cara === "POST" && /\/saksi-scan(?:[?#]|$)/.test(m.url)), "baca KTP terkirim");
    expect(h.minta.filter((m) => m.cara === "POST" && !/\/saksi-scan(?:[?#]|$)/.test(m.url))).toEqual([]);
    expect(k.querySelector(".aleta-c2-saksi-status")!.textContent || "").not.toMatch(/Mode coba/);
  });
});

// ============================================================================
// F. MANIFEST DAN PENYUSUN
// ============================================================================
describe("F. manifest, susun-ekstensi, penjaga TDZ", () => {
  it("saksiscan.js hanya di SIPP: sesudah basmassal.js, sebelum konten.js; tidak di ABT/portal", () => {
    const m = JSON.parse(baca("manifest.json")) as { content_scripts: Array<{ js?: string[] }> };
    const sipp = m.content_scripts.find((x) => (x.js || []).includes("konten.js"))!.js!;
    expect(sipp.indexOf("saksiscan.js")).toBeGreaterThan(sipp.indexOf("basmassal.js"));
    expect(sipp.indexOf("saksiscan.js")).toBeLessThan(sipp.indexOf("konten.js"));
    expect(sipp.indexOf("saksiscan.js")).toBeGreaterThan(sipp.indexOf("panel-alat.js"));
    for (const utama of ["abt.js", "aleta.js"]) {
      expect(m.content_scripts.find((x) => (x.js || []).includes(utama))!.js!, utama).not.toContain("saksiscan.js");
    }
  });

  it("susun-ekstensi menanam saksiscan.js dan penjaga TDZ menyisirnya", () => {
    expect(readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8")).toContain('"saksiscan.js",');
    expect(readFileSync(path.resolve(process.cwd(), "src/test/ekstensi-tdz-tingkat-atas.test.ts"), "utf8")).toContain('"saksiscan.js",');
  });
});

// ============================================================================
// G. panel.css BLOK C2 - TEMA GELAP TINGKAP SIPP (BUTIR 18)
// ============================================================================
describe("G. panel.css: tema gelap blangko tingkap SIPP", () => {
  const awal = SUMBER_CSS.indexOf("/* === C2 - PERBAIKAN 2 OKT === */");
  const akhir = SUMBER_CSS.indexOf("/* === AKHIR C2 === */");
  const blok = SUMBER_CSS.slice(awal, akhir);
  const aturan = (pemilih: RegExp) =>
    Array.from(blok.matchAll(/([^{}]+)\{([^}]*)\}/g))
      .filter((m) => pemilih.test(m[1]))
      .map((m) => ({ pemilih: m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim(), isi: m[2] }));

  it("blok C2 ada, bertanda, di ujung berkas", () => {
    expect(awal).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(awal);
  });

  it("isian .popup/.detil (termasuk .datepicker dan .standard-input) memakai palet gelap, hanya di SIPP bertema gelap", () => {
    const isian = aturan(/input\.datepicker/);
    expect(isian.length).toBe(1);
    expect(isian[0].pemilih).toMatch(/^html:not\(\[data-aleta-halaman="abt"\]\)\[data-aleta-tema-sipp="gelap"\] :is\(\.popup, #popup-detil, \.detil\)/);
    expect(isian[0].pemilih).toMatch(/input\.standard-input/);
    expect(isian[0].pemilih).toMatch(/textarea/);
    expect(isian[0].isi).toMatch(/background-color:\s*var\(--s-permukaan-2\)\s*!important/);
    expect(isian[0].isi).toMatch(/color:\s*var\(--s-tulisan\)\s*!important/);
  });

  it("kotak panah pilihan dan panah select2 tidak lagi toska menyala; tanda wajib kembali merah palet", () => {
    const panah = aturan(/custom-dropdown--emerald, \.custom-dropdown--red\)::before/);
    expect(panah[0].isi).toMatch(/var\(--s-hijau\)/);
    expect(aturan(/select2-selection__arrow\s*$/)[0].isi).toMatch(/var\(--s-hijau\)/);
    expect(aturan(/font\[color="red" i\]/)[0].isi).toMatch(/var\(--s-merah\)/);
  });

  it("aturan tema gelap C2 tidak menyentuh panel ALETA, dan kartu saksi berpalet --s-* saat gelap", () => {
    for (const a of aturan(/data-aleta-tema-sipp="gelap"\] :is\(\.popup|custom-dropdown|select2/)) {
      expect(a.pemilih, a.pemilih).not.toMatch(/aleta-panel|#aleta-/);
    }
    expect(aturan(/html\[data-aleta-tema-sipp="gelap"\] :is\(\.aleta-c2-saksi, \.aleta-c2-saksi-pemicu\)/)[0].isi).toMatch(/--c2-latar:\s*var\(--s-permukaan-2\)/);
  });
});
