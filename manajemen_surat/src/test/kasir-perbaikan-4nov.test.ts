// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buatPdfInstrumen } from "@/server/modules/aleta-ecourt/kasir-cetak-pdf";
import { kelompokkanInstrumen, type BarisInstrumen } from "@/lib/kasir-cetak";

/**
 * ============================================================================
 * KASIR 4 NOV 2026: USULAN GANDA, URUTAN PIHAK, INSTRUMEN (data REKAAN)
 * ============================================================================
 *
 * Dibentuk dari temuan data server (hanya bentuknya): dua baris PNBP ditulis atas Pemohon I saja membuat
 * Pemohon II diusulkan lagi. Baris satu-satunya milik pihak lain tetap tidak boleh menutup pihak ini.
 */

const require = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "..");
const kasir = require(path.join(AKAR, "aleta_bot/services/kasirJurnalService.js"));
const cetak = require(path.join(AKAR, "aleta_bot/services/kasirCetakService.js"));

const PNBP_PEMOHON = 253;

function jurnalPnbp(id: number, pihakId: number) {
  return {
    id,
    jenisBiayaId: PNBP_PEMOHON,
    kategoriId: 0,
    jenisTransaksi: -1,
    pihakId,
    pihakKe: 1,
    tanggal: "2026-10-22",
    jumlah: 10000,
    uraian: "PNBP Relaas Panggilan Pertama Pemohon",
  };
}

function keadaanPermohonan(jurnal: ReturnType<typeof jurnalPnbp>[]) {
  return {
    hariIni: "2026-11-04",
    perkara: {
      perkaraId: 1,
      nomorPerkara: "1/Pdt.P/2026/PA.Xyz",
      alurPerkaraId: 16,
      jenisPerkaraId: 362,
      jenisPerkaraNama: "Dispensasi Kawin",
      tanggalDaftar: "2026-10-21",
      tahapanId: 10,
      proses: "",
      penetapanHariSidang: "2026-10-22",
    },
    pembiayaan: 1,
    jurnal: [{ id: 1, jenisBiayaId: 1, kategoriId: 0, jenisTransaksi: 1, pihakId: 0, pihakKe: 0, tanggal: "2026-10-21", jumlah: 190000, uraian: "Panjar Biaya Perkara" }, ...jurnal],
    pihak: [
      { id: 1, ke: 1, urutan: 1, pihakId: 501, nama: "Rekaan Satu" },
      { id: 2, ke: 1, urutan: 2, pihakId: 502, nama: "Rekaan Dua" },
    ],
    jurusita: [{ jurusitaId: 8, nama: "Gita Rekaan" }],
    sidang: [{ id: 70, urutan: 1, tanggal: "2026-10-29", dihadiriOleh: 0, ikrar: false, agenda: "", ditunda: "", hasil: "" }],
    relaas: [],
    putusan: null,
    pbt: [],
    ikrar: null,
    mediasi: [],
    kontak: null,
    jenisBiaya: { [PNBP_PEMOHON]: { id: PNBP_PEMOHON, kategoriId: 0, jenisTransaksi: -1, nama: "PNBP" }, 1: { id: 1, kategoriId: 0, jenisTransaksi: 1, nama: "Panjar" } },
    tarif: { kecamatan: {}, kabupaten: {}, rri: 200000, lazim: {} },
  };
}

const usulanPnbp = (k: unknown) =>
  (kasir.susunUsulan(k).usulan as Array<{ jenisBiayaId: number; pihakId: number; uraian: string }>).filter((u) => u.jenisBiayaId === PNBP_PEMOHON);

describe("1. baris kelebihan menutup pihak sekedudukan", () => {
  it("dua baris atas Pemohon I: Pemohon II tidak diusulkan lagi", () => {
    expect(usulanPnbp(keadaanPermohonan([jurnalPnbp(10, 501), jurnalPnbp(11, 501)]))).toEqual([]);
  });

  it("dua baris atas Pemohon II: Pemohon I tidak diusulkan lagi", () => {
    expect(usulanPnbp(keadaanPermohonan([jurnalPnbp(10, 502), jurnalPnbp(11, 502)]))).toEqual([]);
  });

  it("satu baris atas Pemohon I: Pemohon II TETAP diusulkan dan disebut urutannya", () => {
    const u = usulanPnbp(keadaanPermohonan([jurnalPnbp(10, 501)]));
    expect(u.map((x) => [x.pihakId, x.uraian])).toEqual([[502, "PNBP Relaas Panggilan Pertama Pemohon II"]]);
  });

  it("satu baris atas Pemohon II: Pemohon I TETAP diusulkan", () => {
    const u = usulanPnbp(keadaanPermohonan([jurnalPnbp(10, 502)]));
    expect(u.map((x) => [x.pihakId, x.uraian])).toEqual([[501, "PNBP Relaas Panggilan Pertama Pemohon I"]]);
  });

  it("tanpa baris: keduanya diusulkan bernomor", () => {
    expect(usulanPnbp(keadaanPermohonan([])).map((x) => x.uraian)).toEqual(["PNBP Relaas Panggilan Pertama Pemohon I", "PNBP Relaas Panggilan Pertama Pemohon II"]);
  });
});

describe("2. status pihak Instrumen", () => {
  const pihak = [
    { ke: 2, pihakId: 11 },
    { ke: 2, pihakId: 12 },
    { ke: 1, pihakId: 13 },
    { ke: 4, pihakId: 14 },
  ];
  const baris = { alurPerkaraId: 15, jenisPerkaraId: 347, jenisPerkaraNama: "Cerai Gugat", nomorPerkara: "2/Pdt.G/2026/PA.Xyz" };

  it("menyebut kedudukan dan urutan bila lebih dari satu", () => {
    expect(cetak.statusPihak({ ...baris, pihakId: 12, pihakKe: 2 }, pihak)).toBe("Tergugat II");
    expect(cetak.statusPihak({ ...baris, pihakId: 13, pihakKe: 1 }, pihak)).toBe("Penggugat");
    expect(cetak.statusPihak({ ...baris, pihakId: 14, pihakKe: 4 }, pihak)).toBe("Turut Tergugat");
  });

  it("pihak tidak ditemukan: dari pihak_ke baris; tanpa keduanya kosong", () => {
    expect(cetak.statusPihak({ ...baris, pihakId: 99, pihakKe: 2 }, pihak)).toBe("Tergugat");
    expect(cetak.statusPihak({ ...baris, pihakId: null, pihakKe: null }, [])).toBe("");
  });
});

describe("3. PDF Instrumen", () => {
  const dasar: BarisInstrumen = {
    jurnalId: 1,
    perkaraId: 1,
    nomorPerkara: "1566/Pdt.G/2026/PA.Xyz",
    tanggal: "2026-11-03",
    jenisBiayaId: 14,
    uraian: "Biaya Panggilan Tergugat II",
    jenis: "Panggilan sidang ke-1",
    jumlah: 14500,
    pihak: "Rekaan",
    statusPihak: "Tergugat II",
    alamat: "Jalan Rekaan",
    jurusitaId: 8,
    jurusita: "Gita Rekaan",
    jurusitaDariPerkara: false,
  };

  it("terbentuk dengan status pihak dan nomor panjang; satu halaman", async () => {
    const [kelompok] = kelompokkanInstrumen([dasar, { ...dasar, jurnalId: 2, statusPihak: "" }]);
    const pdf = await buatPdfInstrumen(kelompok, { dari: "2026-11-03", sampai: "2026-11-03" });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });

  it("kolom nomor perkara cukup lebar dan baris tabel memecah status ke baris sendiri", () => {
    const sumber = readFileSync(path.join(process.cwd(), "src/server/modules/aleta-ecourt/kasir-cetak-pdf.ts"), "utf8");
    expect(sumber).toContain('["Nomor perkara", 2.15]');
    expect(sumber).toContain("${b.nomorPerkara}\\n${b.statusPihak}");
    expect(sumber).toContain('split("\\n")');
  });
});

describe("4. tampilan Kasir baru", () => {
  const eks = readFileSync(path.join(AKAR, "ekstensi-sipp/basmassal.js"), "utf8");
  const css = readFileSync(path.join(AKAR, "ekstensi-sipp/panel.css"), "utf8");

  it("ikon J memuat nama jurusita; Pratinjau hanya tersisa di tampilan lama", () => {
    expect(eks).toContain('el("span", "aleta-kasir-jurusita", "J")');
    expect(eks).toContain("j.title = `Jurusita: ${u.jurusitaNama}`");
    expect(eks.match(/tombol\("Pratinjau"/g)).toHaveLength(1);
  });

  it("centang perkara dan centang biaya berbeda bentuk; jarak kartu 24px", () => {
    expect(css).toMatch(/aleta-basmassal-pilih-perkara input\[type="checkbox"\] \{\s*width: 20px;/);
    expect(css).toMatch(/aleta-kasir-kol-pilih input\[type="checkbox"\] \{[^}]*border-radius: 50%;/);
    expect(css).toContain(".aleta-kasir-hari { gap: 24px; }");
  });
});
