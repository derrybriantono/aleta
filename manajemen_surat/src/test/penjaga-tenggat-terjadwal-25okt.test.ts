// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ATURAN_BARU,
  ATURAN_TENGGAT,
  PETA_ATURAN,
  PETA_SEMUA_ATURAN,
  SEMUA_ATURAN,
  STATUS_DIKABULKAN,
  TANDA_VERIFIKASI,
  nilaiTenggat,
  susunLaporanHarian,
  type FaktaTenggat,
} from "@/lib/penjaga-tenggat";
import {
  ATURAN_PENGINGAT_BAWAAN,
  SETELAN_TENGGAT_BAWAAN,
  bersihkanSetelanTenggat,
  butirUntukPenerima,
  daftarPetugasTenggat,
  jatuhTempoTenggat,
  pemilikButir,
  pengingatWaAktif,
  saringButirTenggat,
} from "@/lib/tenggat-terjadwal";
import type { PortalWhatsappSendResult } from "@/server/modules/whatsapp/portal-whatsapp-sender";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_TENGGAT_KIRIM } from "@/server/db/schema";
import {
  bacaCatatanTenggat,
  bacaSetelanTenggat,
  detakTenggat,
  jalankanTenggat,
  kirimPengingat,
  lihatSemuaTenggat,
  pemberitahuanTenggat,
  simpanSetelanTenggat,
  type AkunPenerima,
  type SumberTenggat,
} from "@/server/modules/penjaga-tenggat/layanan";

/**
 * ============================================================================
 * PENJAGA TENGGAT TERJADWAL (G1, 25 Okt 2026)
 * ============================================================================
 *
 * Perilaku nyata: mesin aturan murni, pembaca fakta bot dengan kueri TIRUAN, dan penjadwal/pengingat atas
 * pg-mem dengan sumber tiruan (tanpa SIPP, tanpa WhatsApp, tanpa jaringan). Nama dan nomor perkara rekaan.
 * Hari acuan: Senin 26 Okt 2026.
 */

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.env.ALETA_UJI_AKAR_BOT || path.resolve(process.cwd(), "../aleta_bot"));
const HARI = "2026-10-26";

function fakta(ubah: Partial<FaktaTenggat> = {}): FaktaTenggat {
  return { perkaraId: "9001", nomorPerkara: "101/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalAcuan: "2026-10-20", statusPutusanId: null, ...ubah };
}

// ─── 1. Mesin aturan: banding / kasasi / mediasi ─────────────────────────────

describe("aturan baru G1 - banding 14 hari per pihak, kasasi 14 hari, mediasi 30 hari", () => {
  const nilai = (f: Record<string, FaktaTenggat[]>, hitungMundur = false, hari = HARI) => nilaiTenggat(f, hari, { aturan: SEMUA_ATURAN, hitungMundur });

  it("semua aturan baru bertanda [PERLU VERIFIKASI Derry] di dasarnya dan perluVerifikasi benar; aturan lama tidak berubah", () => {
    expect(ATURAN_BARU.map((a) => a.kode)).toEqual(["banding-14-hari", "kasasi-14-hari", "mediasi-30-hari"]);
    for (const a of ATURAN_BARU) {
      expect(a.dasar).toContain(TANDA_VERIFIKASI);
      expect(a.perluVerifikasi).toBe(true);
    }
    for (const a of ATURAN_TENGGAT) expect(a.perluVerifikasi).toBeUndefined();
    expect(ATURAN_TENGGAT.map((a) => a.kode)).toEqual([
      "umur-perkara",
      "ikrar-talak",
      "akta-cerai-gugat",
      "akta-cerai-talak",
      "relaas-sidang-pertama",
      "dirput-gagal",
      "anonimisasi-hilang",
    ]);
    expect(PETA_ATURAN.size).toBe(7);
    expect(PETA_SEMUA_ATURAN.size).toBe(10);
  });

  it("banding memakai RBg (bukan HIR) dan kasasi/mediasi tidak menyebut HIR", () => {
    const dasar = ATURAN_BARU.map((a) => a.dasar).join(" ");
    expect(dasar).toContain("RBg");
    expect(dasar).not.toMatch(/\bHIR\b/);
  });

  it("banding: hadir dihitung dari putusan; sisa 8 hari = BERJALAN (hanya bila hitung mundur diminta), 2 hari = MENJELANG", () => {
    const f = {
      "banding-14-hari": [
        fakta({ nomorPerkara: "A/Pdt.G/2026", tanggalAcuan: "2026-10-20", tanggalBatas: "2026-11-03", pihakKe: 1, dasarMulai: "putusan", pasti: true, alurPerkaraId: 7 }),
        fakta({ nomorPerkara: "B/Pdt.G/2026", tanggalAcuan: "2026-10-14", tanggalBatas: "2026-10-28", pihakKe: 1, dasarMulai: "putusan", pasti: true, alurPerkaraId: 7 }),
      ],
    };
    const tanpaMundur = nilai(f);
    expect(tanpaMundur.butir.map((b) => `${b.nomorPerkara}:${b.tingkat}`)).toEqual(["B/Pdt.G/2026:menjelang"]);
    const denganMundur = nilai(f, true);
    expect(denganMundur.butir.map((b) => `${b.nomorPerkara}:${b.tingkat}:${b.selisihHari}`)).toEqual(["B/Pdt.G/2026:menjelang:-2", "A/Pdt.G/2026:berjalan:-8"]);
    expect(denganMundur.butir[0]?.tanggalBatas).toBe("2026-10-28");
    expect(denganMundur.berjalan).toBe(1);
    // hitung lama tetap tiga kunci: bentuk lama tidak berubah
    expect(Object.keys(denganMundur.hitung).sort()).toEqual(["catatan", "lewat", "menjelang"]);
  });

  it("banding per pihak: sebutan dari sebutan-pihak (alur permohonan = Pemohon/Termohon) dan dasar hitungannya tertulis", () => {
    const r = nilai(
      {
        "banding-14-hari": [
          fakta({ pihakKe: 1, alurPerkaraId: 16, tanggalAcuan: "2026-10-14", tanggalBatas: "2026-10-28", dasarMulai: "putusan", pasti: true }),
          fakta({ pihakKe: 2, alurPerkaraId: 16, tanggalAcuan: "2026-10-15", tanggalBatas: "2026-10-29", dasarMulai: "pemberitahuan", pasti: true }),
        ],
      },
      false
    );
    const k = r.butir.map((b) => b.keterangan);
    expect(k[0]).toContain("Pemohon, dihitung dari putusan 14-10-2026");
    expect(k[1]).toContain("Termohon, dihitung dari pemberitahuan 15-10-2026");
    expect(r.butir.map((b) => b.pihak)).toEqual(["Pemohon", "Termohon"]);
  });

  it("banding: masa berakhir BUKAN lewat tenggat - hanya catatan, hanya bila kehadiran pasti, dan hanya 30 hari", () => {
    const f = (ubah: Partial<FaktaTenggat>) => ({ "banding-14-hari": [fakta({ pihakKe: 1, dasarMulai: "putusan", ...ubah })] });
    // batas 19 Okt: lewat 7 hari, pasti -> catatan
    const pasti = nilai(f({ tanggalAcuan: "2026-10-05", tanggalBatas: "2026-10-19", pasti: true }));
    expect(pasti.butir.map((b) => b.tingkat)).toEqual(["catatan"]);
    expect(pasti.hitung).toEqual({ lewat: 0, menjelang: 0, catatan: 1 });
    // kehadiran tidak pasti: tidak menyatakan berakhir
    expect(nilai(f({ tanggalAcuan: "2026-10-05", tanggalBatas: "2026-10-19", pasti: false })).butir).toEqual([]);
    // lewat 40 hari: bukan lagi catatan masa banding
    expect(nilai(f({ tanggalAcuan: "2026-09-01", tanggalBatas: "2026-09-15", pasti: true })).butir).toEqual([]);
  });

  it("banding: pihak tidak hadir yang belum diberitahu = catatan 'masa belum berjalan', tanpa tanggal batas", () => {
    const r = nilai({ "banding-14-hari": [fakta({ pihakKe: 2, alurPerkaraId: 7, tanggalAcuan: "2026-10-20", menunggu: true, dasarMulai: "pemberitahuan" })] });
    expect(r.butir).toHaveLength(1);
    expect(r.butir[0]).toMatchObject({ tingkat: "catatan", menunggu: true, tanggalBatas: "", pihak: "Tergugat" });
    expect(r.butir[0]?.keterangan).toContain("pemberitahuan putusan belum tercatat");
    // aturan lain tidak mengenal 'menunggu'
    expect(nilai({ "mediasi-30-hari": [fakta({ menunggu: true })] }).butir).toEqual([]);
  });

  it("kasasi: batas 14 hari sejak pemberitahuan putusan banding", () => {
    const r = nilai({ "kasasi-14-hari": [fakta({ tanggalAcuan: "2026-10-14", tanggalBatas: "2026-10-28", dasarMulai: "pemberitahuan", pasti: true })] });
    expect(r.butir[0]).toMatchObject({ aturan: "kasasi-14-hari", tingkat: "menjelang", selisihHari: -2, perluVerifikasi: true });
  });

  it("mediasi: lewat 30 hari = LEWAT (kewajiban petugas), 4 hari lagi = menjelang, 9 hari = berjalan", () => {
    const f = {
      "mediasi-30-hari": [
        fakta({ nomorPerkara: "M1", tanggalAcuan: "2026-09-20", tanggalBatas: "2026-10-20" }),
        fakta({ nomorPerkara: "M2", tanggalAcuan: "2026-09-30", tanggalBatas: "2026-10-30" }),
        fakta({ nomorPerkara: "M3", tanggalAcuan: "2026-10-05", tanggalBatas: "2026-11-04" }),
      ],
    };
    expect(nilai(f).butir.map((b) => `${b.nomorPerkara}:${b.tingkat}`)).toEqual(["M1:lewat", "M2:menjelang"]);
    expect(nilai(f, true).butir.map((b) => `${b.nomorPerkara}:${b.tingkat}`)).toEqual(["M1:lewat", "M2:menjelang", "M3:berjalan"]);
  });

  it("hitung mundur tidak membanjiri: aturan lama (umur perkara dll.) tidak pernah menghasilkan 'berjalan'", () => {
    const r = nilai({ "umur-perkara": [fakta({ tanggalAcuan: "2026-10-01", statusPutusanId: null })] }, true);
    expect(r.butir).toEqual([]);
  });

  it("tanpa opsi aturan, fakta aturan baru DIABAIKAN: perilaku lama persis", () => {
    const campur = {
      "akta-cerai-gugat": [fakta({ tanggalAcuan: "2026-10-01", statusPutusanId: STATUS_DIKABULKAN })],
      "banding-14-hari": [fakta({ tanggalAcuan: "2026-10-14", tanggalBatas: "2026-10-28", pihakKe: 1, pasti: true })],
      "mediasi-30-hari": [fakta({ tanggalAcuan: "2026-09-20", tanggalBatas: "2026-10-20" })],
    };
    const lama = nilaiTenggat(campur, HARI);
    expect(lama.butir.map((b) => b.aturan)).toEqual(["akta-cerai-gugat"]);
    expect(lama.berjalan).toBe(0);
    // dan sama dengan aturan lama dinilai sendiri
    expect(lama.butir).toEqual(nilaiTenggat({ "akta-cerai-gugat": campur["akta-cerai-gugat"] }, HARI, { aturan: ATURAN_TENGGAT }).butir);
  });

  it("ikrar talak: batas 6 bulan KALENDER dari pembaca menang atas 180 hari (hari ke-181 tidak menuduh)", () => {
    const f = (tanggalBatas?: string) => ({
      "ikrar-talak": [fakta({ jenisPerkara: "Cerai Talak", tanggalAcuan: "2026-04-30", statusPutusanId: STATUS_DIKABULKAN, ...(tanggalBatas ? { tanggalBatas } : {}) })],
    });
    // 28 Okt = hari ke-181 sejak PHS 30 Apr
    expect(nilaiTenggat(f(), "2026-10-28", { aturan: SEMUA_ATURAN }).butir[0]?.tingkat).toBe("lewat");
    const tegas = nilaiTenggat(f("2026-10-30"), "2026-10-28", { aturan: SEMUA_ATURAN }).butir[0];
    expect(tegas).toMatchObject({ tingkat: "menjelang", selisihHari: -2, tanggalBatas: "2026-10-30" });
    // sesudah batas tegas: lewat
    expect(nilaiTenggat(f("2026-10-30"), "2026-10-31", { aturan: SEMUA_ATURAN }).butir[0]).toMatchObject({ tingkat: "lewat", selisihHari: 1 });
  });

  it("laporan WhatsApp menyebut batas pada aturan bertanda tampilBatas", () => {
    const r = nilai({ "mediasi-30-hari": [fakta({ nomorPerkara: "M2/Pdt.G/2026", tanggalAcuan: "2026-09-30", tanggalBatas: "2026-10-30" })] });
    const teks = susunLaporanHarian(r, { satker: "PA Uji" });
    expect(teks).toContain("M2/Pdt.G/2026");
    expect(teks).toContain("batas 30-10-2026");
    expect(teks).toContain("tinggal 4 hari");
  });
});

// ─── 2. Setelan, penerima pribadi, saringan layar ────────────────────────────

describe("setelan MATI bawaan dan penerima pribadi yang ketat", () => {
  it("bawaan: jadwal dan pengingat WhatsApp MATI; aturan pengingat = tujuh aturan lama saja", () => {
    expect(SETELAN_TENGGAT_BAWAAN).toMatchObject({ jadwal: false, pengingatWa: false, jam: "07:30" });
    expect(SETELAN_TENGGAT_BAWAAN.aturanPengingat).toEqual([...ATURAN_PENGINGAT_BAWAAN]);
    expect(ATURAN_PENGINGAT_BAWAAN).toHaveLength(7);
    for (const kode of ["banding-14-hari", "kasasi-14-hari", "mediasi-30-hari"]) expect(ATURAN_PENGINGAT_BAWAAN).not.toContain(kode);
    // sampah / nilai tak dikenal jatuh ke MATI
    expect(bersihkanSetelanTenggat({ jadwal: "ya", pengingatWa: 1, jam: "25:99", aturanPengingat: ["nama-ngawur"] })).toMatchObject({ jadwal: false, pengingatWa: false, jam: "07:30", aturanPengingat: [] });
    expect(bersihkanSetelanTenggat(null).jadwal).toBe(false);
  });

  it("pengingat WhatsApp aktif hanya bila KEDUA saklar menyala", () => {
    expect(pengingatWaAktif({ jadwal: true, pengingatWa: false })).toBe(false);
    expect(pengingatWaAktif({ jadwal: false, pengingatWa: true })).toBe(false);
    expect(pengingatWaAktif({ jadwal: true, pengingatWa: true })).toBe(true);
  });

  it("jam pemicu 07.30: sebelum itu belum, sesudahnya ya, sudah jalan = tidak lagi", () => {
    expect(jatuhTempoTenggat("07:30", "07:29", false)).toBe(false);
    expect(jatuhTempoTenggat("07:30", "07:30", false)).toBe(true);
    expect(jatuhTempoTenggat("07:30", "11:00", false)).toBe(true);
    expect(jatuhTempoTenggat("07:30", "11:00", true)).toBe(false);
  });

  it("pemilikButir ketat: nama kosong dan petugas kosong tidak pernah cocok; gelar tidak mengganggu", () => {
    const r = nilaiTenggat(
      { "akta-cerai-gugat": [fakta({ tanggalAcuan: "2026-10-01", statusPutusanId: STATUS_DIKABULKAN, majelis: "Budi Santoso, S.H.", panitera: "Citra Lestari, S.H." })] },
      HARI
    );
    const b = r.butir[0]!;
    expect(pemilikButir(b, "Budi Santoso")).toBe(true);
    expect(pemilikButir(b, "Citra Lestari")).toBe(true);
    expect(pemilikButir(b, "Dewi Anggraini")).toBe(false);
    expect(pemilikButir(b, "")).toBe(false);
    expect(pemilikButir({ ...b, majelis: "", panitera: "", jurusita: "", mediator: "" }, "Budi Santoso")).toBe(false);
  });

  it("butirUntukPenerima: hanya perkaranya sendiri, hanya aturan yang diizinkan, tidak pernah 'berjalan'", () => {
    const semua = nilaiTenggat(
      {
        "akta-cerai-gugat": [
          fakta({ perkaraId: "1", nomorPerkara: "1/Pdt.G/2026", tanggalAcuan: "2026-10-01", statusPutusanId: STATUS_DIKABULKAN, majelis: "Budi Santoso, S.H." }),
          fakta({ perkaraId: "2", nomorPerkara: "2/Pdt.G/2026", tanggalAcuan: "2026-10-01", statusPutusanId: STATUS_DIKABULKAN, majelis: "Dewi Anggraini, S.H." }),
        ],
        "mediasi-30-hari": [
          fakta({ perkaraId: "4", nomorPerkara: "4/Pdt.G/2026", tanggalAcuan: "2026-09-20", tanggalBatas: "2026-10-20", majelis: "Budi Santoso, S.H." }),
          fakta({ perkaraId: "5", nomorPerkara: "5/Pdt.G/2026", tanggalAcuan: "2026-10-10", tanggalBatas: "2026-11-09", majelis: "Budi Santoso, S.H." }),
        ],
      },
      HARI,
      { aturan: SEMUA_ATURAN, hitungMundur: true }
    );
    expect(semua.butir.some((b) => b.tingkat === "berjalan")).toBe(true);
    const bawaan = butirUntukPenerima(semua.butir, "Budi Santoso", ATURAN_PENGINGAT_BAWAAN);
    expect(bawaan.map((b) => b.nomorPerkara)).toEqual(["1/Pdt.G/2026"]);
    const denganMediasi = butirUntukPenerima(semua.butir, "Budi Santoso", [...ATURAN_PENGINGAT_BAWAAN, "mediasi-30-hari"]);
    expect(denganMediasi.map((b) => b.nomorPerkara).sort()).toEqual(["1/Pdt.G/2026", "4/Pdt.G/2026"]);
    expect(butirUntukPenerima(semua.butir, "Orang Tak Dikenal", [...ATURAN_PENGINGAT_BAWAAN, "mediasi-30-hari"])).toEqual([]);
  });

  it("saringan layar per majelis / PP / aturan / tingkat / cari / milik saya", () => {
    const r = nilaiTenggat(
      {
        "akta-cerai-gugat": [
          fakta({ perkaraId: "1", nomorPerkara: "1/Pdt.G/2026", tanggalAcuan: "2026-10-01", statusPutusanId: STATUS_DIKABULKAN, majelis: "Budi Santoso, S.H., Dewi Anggraini, S.H.", panitera: "Citra Lestari, S.H." }),
          fakta({ perkaraId: "2", nomorPerkara: "22/Pdt.G/2026", tanggalAcuan: "2026-10-01", statusPutusanId: STATUS_DIKABULKAN, majelis: "Gilang Ramadhan, S.H.", panitera: "Hana Putri, S.H." }),
        ],
      },
      HARI
    );
    // gelar ikut koma ("Budi Santoso, S.H."): nama dipecah dengan pemecah penyaring "perkara saya", bukan di tiap koma
    expect(daftarPetugasTenggat(r.butir, "panitera")).toEqual(["Citra Lestari, S.H.", "Hana Putri, S.H."]);
    expect(daftarPetugasTenggat(r.butir, "majelis")).toEqual(["Budi Santoso, S.H.", "Dewi Anggraini, S.H.", "Gilang Ramadhan, S.H."]);
    expect(saringButirTenggat(r.butir, { majelis: "Dewi Anggraini, S.H." }).map((b) => b.nomorPerkara)).toEqual(["1/Pdt.G/2026"]);
    expect(saringButirTenggat(r.butir, { panitera: "Hana Putri, S.H." }).map((b) => b.nomorPerkara)).toEqual(["22/Pdt.G/2026"]);
    expect(saringButirTenggat(r.butir, { cari: "22/" }).map((b) => b.nomorPerkara)).toEqual(["22/Pdt.G/2026"]);
    expect(saringButirTenggat(r.butir, { tingkat: "lewat" })).toHaveLength(2);
    expect(saringButirTenggat(r.butir, { tingkat: "catatan" })).toHaveLength(0);
    expect(saringButirTenggat(r.butir, { aturan: "akta-cerai-talak" })).toHaveLength(0);
    expect(saringButirTenggat(r.butir, { milikSaya: "Gilang Ramadhan" }).map((b) => b.nomorPerkara)).toEqual(["22/Pdt.G/2026"]);
  });
});

// ─── 3. Pembaca fakta bot (kueri tiruan) ─────────────────────────────────────

describe("pembaca fakta bot - aturan baru hanya bila diminta, jalur lama tidak berubah", () => {
  const penjaga = require_(path.join(AKAR_BOT, "services/penjagaTenggatService.js"));
  const appeal = require_(path.join(AKAR_BOT, "services/appealDeadlineService.js"));

  type Peta = Array<[string, Record<string, unknown>[]]>;
  const pasang = (peta: Peta, kolom: (tabel: string, kolom: string) => boolean = () => true) => {
    const sql: string[] = [];
    const pulih = penjaga.pasangSumber({
      jalankan: async (kueri: string) => {
        sql.push(kueri);
        const cocok = peta.find(([potongan]) => kueri.includes(potongan));
        return cocok ? cocok[1] : [];
      },
      kolomAda: async (t: string, k: string) => kolom(t, k),
    });
    return { sql, pulih };
  };

  it("tanpa 'baru': tujuh pembaca, tidak ada kueri banding/kasasi/mediasi/petugas, bentuk fakta lama", async () => {
    const { sql, pulih } = pasang([["FROM perkara_putusan pu\n       JOIN perkara p ON p.perkara_id = pu.perkara_id\n       LEFT JOIN perkara_akta_cerai", [{ perkaraId: 7, nomorPerkara: "7/Pdt.G/2026", jenisPerkara: "Cerai Gugat", tanggalAcuan: "2026-10-01", statusPutusanId: 62, keterangan: "BHT" }]]]);
    try {
      const h = await penjaga.bacaFakta(HARI);
      expect(Object.keys(h.fakta).sort()).toEqual(ATURAN_TENGGAT.map((a) => a.kode).sort());
      expect(sql.some((s) => /perkara_banding|perkara_kasasi|perkara_mediasi|perkara_hakim_pn/.test(s))).toBe(false);
      const satu = h.fakta["akta-cerai-gugat"][0];
      expect(Object.keys(satu).sort()).toEqual(["jenisPerkara", "keterangan", "nomorPerkara", "perkaraId", "statusPutusanId", "tanggalAcuan"]);
    } finally {
      pulih();
    }
  });

  it("dengan 'baru': banding per pihak (hadir/diberitahu/menunggu/verstek), kasasi, mediasi, petugas, batas ikrar tegas", async () => {
    const { pulih } = pasang([
      [
        "perkara_putusan_pemberitahuan_putusan",
        [
          // P1: kedua pihak tidak hadir (sandi 4); pihak 1 sudah diberitahu 22 Okt, pihak 2 belum
          { perkaraId: 501, nomorPerkara: "501/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", alurPerkaraId: 7, jenisPerkaraId: 346, tanggalPutusan: "2026-10-20", verstek: "N", tanggalBht: null, dihadiriSaatPutus: 4, pbtPihak1: "2026-10-22", pbtPihak2: null, adaPihak2: 1 },
          // P2: verstek, sandi kehadiran kosong; pihak 2 diberitahu 23 Okt
          { perkaraId: 502, nomorPerkara: "502/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", alurPerkaraId: 7, jenisPerkaraId: 345, tanggalPutusan: "2026-10-19", verstek: "Y", tanggalBht: null, dihadiriSaatPutus: null, pbtPihak1: null, pbtPihak2: "2026-10-23", adaPihak2: 1 },
          // P3: semua hadir, hanya satu pihak
          { perkaraId: 503, nomorPerkara: "503/Pdt.P/2026/PA.Dgl", jenisPerkara: "Dispensasi Kawin", alurPerkaraId: 16, jenisPerkaraId: 360, tanggalPutusan: "2026-10-05", verstek: "N", tanggalBht: null, dihadiriSaatPutus: 1, pbtPihak1: null, pbtPihak2: null, adaPihak2: 0 },
        ],
      ],
      ["FROM perkara_banding bd\n       JOIN perkara p", [{ perkaraId: 601, nomorPerkara: "601/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", alurPerkaraId: 7, jenisPerkaraId: 345, putusanBanding: "2026-10-14", tanggalBht: null, pbt0: "2026-10-16", pbt1: null, pbt2: null }]],
      ["FROM perkara_mediasi m", [{ perkaraId: 701, nomorPerkara: "701/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", alurPerkaraId: 7, jenisPerkaraId: 345, tanggalAcuan: "2026-09-20", mediator: "  Eko   Prasetyo, S.H. " }]],
      ["FROM perkara_ikrar_talak it", [{ perkaraId: 801, nomorPerkara: "801/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", tanggalAcuan: "2026-04-30", statusPutusanId: 62, keterangan: "PHS ikrar 30-04-2026" }]],
      ["perkara_hakim_pn", [{ perkaraId: 501, nama: "Budi Santoso, S.H." }, { perkaraId: 501, nama: "Dewi Anggraini, S.H." }, { perkaraId: 701, nama: "Budi Santoso, S.H." }]],
      ["perkara_panitera_pn", [{ perkaraId: 501, nama: "Citra Lestari, S.H." }]],
      ["perkara_jurusita", [{ perkaraId: 502, nama: "Joko Widodo" }]],
    ]);
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      const banding = h.fakta["banding-14-hari"] as FaktaTenggat[];
      const p1 = banding.filter((f) => f.perkaraId === "501");
      expect(p1).toHaveLength(2);
      expect(p1.find((f) => f.pihakKe === 1)).toMatchObject({ tanggalAcuan: "2026-10-22", tanggalBatas: "2026-11-05", dasarMulai: "pemberitahuan", pasti: true, alurPerkaraId: 7, jenisPerkaraId: 346 });
      expect(p1.find((f) => f.pihakKe === 2)).toMatchObject({ menunggu: true, tanggalAcuan: "2026-10-20" });
      const p2 = banding.filter((f) => f.perkaraId === "502");
      // pihak 1: sandi kehadiran kosong -> dihitung dari putusan tetapi TIDAK pasti; pihak 2 verstek -> dari pemberitahuan, pasti
      expect(p2.find((f) => f.pihakKe === 1)).toMatchObject({ tanggalAcuan: "2026-10-19", tanggalBatas: "2026-11-02", dasarMulai: "putusan", pasti: false });
      expect(p2.find((f) => f.pihakKe === 2)).toMatchObject({ tanggalAcuan: "2026-10-23", dasarMulai: "pemberitahuan", pasti: true });
      const p3 = banding.filter((f) => f.perkaraId === "503");
      expect(p3).toHaveLength(1);
      expect(p3[0]).toMatchObject({ pihakKe: 1, tanggalAcuan: "2026-10-05", tanggalBatas: "2026-10-19", pasti: true });

      expect(h.fakta["kasasi-14-hari"]).toEqual([expect.objectContaining({ perkaraId: "601", tanggalAcuan: "2026-10-16", tanggalBatas: "2026-10-30", pasti: true })]);
      expect(h.fakta["mediasi-30-hari"]).toEqual([expect.objectContaining({ perkaraId: "701", tanggalAcuan: "2026-09-20", tanggalBatas: "2026-10-20", mediator: "Eko Prasetyo, S.H." })]);
      // batas ikrar tegas: 30 Apr + 6 bulan = 30 Okt (bukan 180 hari)
      expect(h.fakta["ikrar-talak"][0].tanggalBatas).toBe("2026-10-30");
      // petugas ditempel pada semua fakta
      expect(p1[0].majelis).toBe("Budi Santoso, S.H., Dewi Anggraini, S.H.");
      expect(p1[0].panitera).toBe("Citra Lestari, S.H.");
      expect(p2[0].jurusita).toBe("Joko Widodo");
      expect(h.fakta["mediasi-30-hari"][0].majelis).toBe("Budi Santoso, S.H.");
      expect(h.gagal).toEqual({});

      // dan mesin aturan portal menilainya tanpa tuduhan: P1 pihak 1 berjalan; menunggu = catatan
      const rapor = nilaiTenggat(h.fakta, HARI, { aturan: SEMUA_ATURAN, hitungMundur: true });
      const b501 = rapor.butir.filter((b) => b.perkaraId === "501");
      expect(b501.map((b) => b.tingkat).sort()).toEqual(["berjalan", "catatan"]);
      // 503: masa berakhir 19 Okt, pasti -> catatan (bukan lewat)
      expect(rapor.butir.find((b) => b.perkaraId === "503")?.tingkat).toBe("catatan");
      // 502 pihak 1 tidak pasti dan sudah lewat batas? batas 2 Nov belum lewat -> berjalan, bukan catatan
      expect(rapor.butir.find((b) => b.perkaraId === "502" && b.pihak.length > 0 && b.keterangan.includes("kehadiran saat putusan tidak tercatat"))?.tingkat).toBe("berjalan");
      // mediasi 701: batas 20 Okt, lewat 6 hari -> lewat
      expect(rapor.butir.find((b) => b.perkaraId === "701")?.tingkat).toBe("lewat");
    } finally {
      pulih();
    }
  });

  it("kolom SIPP yang tidak ada membuat aturannya diam (bukan galat); satu tabel petugas gagal tidak menjatuhkan fakta", async () => {
    const sql: string[] = [];
    const pulih = penjaga.pasangSumber({
      jalankan: async (kueri: string) => {
        sql.push(kueri);
        if (kueri.includes("perkara_panitera_pn")) throw new Error("tabel tidak ada");
        if (kueri.includes("FROM perkara_mediasi m")) return [{ perkaraId: 1, nomorPerkara: "1/Pdt.G/2026", tanggalAcuan: "2026-09-01" }];
        return [];
      },
      kolomAda: async (_t: string, k: string) => k !== "putusan_banding",
    });
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      expect(h.fakta["kasasi-14-hari"]).toEqual([]);
      expect(sql.some((s) => s.includes("bd.putusan_banding"))).toBe(false);
      expect(h.fakta["mediasi-30-hari"]).toHaveLength(1);
      expect(h.gagal["petugas-panitera"]).toContain("tabel tidak ada");
      expect(h.fakta["mediasi-30-hari"][0].panitera).toBe("");
    } finally {
      pulih();
    }
  });

  it("appealDeadlineService: jendela per pihak memakai aturan lama; kasasi 14 hari; angka mediasi sama dengan layanan jadwal", () => {
    const j = appeal.computeAppealWindows({ tanggalPutusan: "2026-10-20", dihadiriOleh: 3, pemberitahuan: { 1: "2026-10-22" }, adaPihak2: true, today: new Date("2026-10-26T12:00:00Z") });
    expect(j.map((x: { pihakKe: number; status: string }) => `${x.pihakKe}:${x.status}`)).toEqual(["1:berjalan", "2:berjalan"]);
    expect(j[0]).toMatchObject({ dasar: "pemberitahuan", tanggalMulai: "2026-10-22", tanggalBatas: "2026-11-05" });
    expect(j[1]).toMatchObject({ dasar: "putusan", tanggalMulai: "2026-10-20", tanggalBatas: "2026-11-03" });
    expect(appeal.computeKasasiDeadline({ tanggalPutusanBanding: "2026-10-14", today: new Date("2026-10-26T12:00:00Z") }).status).toBe("menunggu_beritahu");
    expect(appeal.computeKasasiDeadline({ tanggalPutusanBanding: "2026-10-14", tanggalPemberitahuan: "2026-10-16", today: new Date("2026-10-31T12:00:00Z") })).toMatchObject({ status: "habis", tanggalBatas: "2026-10-30", sisaHari: -1 });
    expect(penjaga.BATAS_MEDIASI_HARI).toBe(30);
    expect(PETA_SEMUA_ATURAN.get("mediasi-30-hari")?.batasHari).toBe(penjaga.BATAS_MEDIASI_HARI);
    expect(PETA_SEMUA_ATURAN.get("banding-14-hari")?.batasHari).toBe(appeal.APPEAL_DAYS);
    expect(PETA_SEMUA_ATURAN.get("kasasi-14-hari")?.batasHari).toBe(appeal.KASASI_DAYS);
    const jadwal = require_(path.join(AKAR_BOT, "services/sippJadwalSidangService.js"));
    expect(jadwal.BATAS_MEDIASI_HARI).toBe(penjaga.BATAS_MEDIASI_HARI);
  });
});

// ─── 4. Penjadwal dan pengingat (pg-mem, sumber tiruan) ──────────────────────

describe("penjadwal harian dan pengingat WhatsApp pribadi", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  }, 180000);
  afterAll(async () => {
    await db?.close();
  });

  // Senin 26 Okt 2026 08:00 WITA = 00:00 UTC; Sabtu 24 Okt; Senin 06:00 WITA = Minggu 22:00 UTC
  const SENIN_0800 = new Date("2026-10-26T00:00:00Z");
  const SENIN_0600 = new Date("2026-10-25T22:00:00Z");
  const SABTU_0800 = new Date("2026-10-24T00:00:00Z");

  const AKUN: AkunPenerima[] = [
    { id: "u-budi", nama: "Budi Santoso", nomorWa: "081234567801" },
    { id: "u-citra", nama: "Citra Lestari", nomorWa: "081234567802" },
    { id: "u-dewi", nama: "Dewi Anggraini", nomorWa: "081234567803" },
    { id: "u-eko", nama: "Eko Prasetyo", nomorWa: "tidak-sah" },
    { id: "u-fajar", nama: "Fajar Nugroho", nomorWa: "081234567805" },
  ];

  function dibuatFakta(): Record<string, FaktaTenggat[]> {
    return {
      "akta-cerai-gugat": [
        fakta({ perkaraId: "1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-05", statusPutusanId: STATUS_DIKABULKAN, majelis: "Budi Santoso, S.H.", panitera: "Citra Lestari, S.H." }),
        fakta({ perkaraId: "9", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-05", statusPutusanId: STATUS_DIKABULKAN, majelis: "Eko Prasetyo, S.H." }),
      ],
      "banding-14-hari": [
        fakta({ perkaraId: "2", nomorPerkara: "2/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-14", tanggalBatas: "2026-10-28", pihakKe: 1, pasti: true, dasarMulai: "putusan", majelis: "Dewi Anggraini, S.H.", panitera: "Citra Lestari, S.H." }),
      ],
      "mediasi-30-hari": [fakta({ perkaraId: "4", nomorPerkara: "4/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-09-20", tanggalBatas: "2026-10-20", majelis: "Budi Santoso, S.H." })],
    };
  }

  function sumberUji(opsi: { gagalBaca?: boolean } = {}) {
    const fungsi = {
      fakta: vi.fn(async (acuan: string) =>
        opsi.gagalBaca
          ? { ok: false, acuan, fakta: {}, gagal: {}, galat: "ALETA Bot tidak menjawab." }
          : { ok: true, acuan, fakta: dibuatFakta(), gagal: {}, galat: "" }
      ),
      penerima: vi.fn(async () => AKUN),
      kirim: vi.fn(async (_m: unknown): Promise<PortalWhatsappSendResult> => ({ ok: true, status: "enqueued", queueId: 77, message: "Antre." })),
    };
    return { sumber: fungsi as unknown as SumberTenggat, fungsi };
  }

  const pesanKe = (fungsi: ReturnType<typeof sumberUji>["fungsi"], nomor: string) => {
    const panggilan = fungsi.kirim.mock.calls.map((c) => c[0] as { recipientNumber: string; message: string; entityId: string });
    return panggilan.filter((p) => p.recipientNumber === nomor);
  };

  async function setel(ubah: { jadwal?: boolean; pengingatWa?: boolean; aturanPengingat?: string[] }) {
    return simpanSetelanTenggat(db, { id: "sa", name: "Super Admin Uji" }, ubah);
  }

  beforeEach(async () => {
    await db.run("DELETE FROM aleta_tenggat_kirim");
    await db.run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = '*sistem*' AND kunci LIKE 'sistem:penjaga-tenggat%'");
  });

  it("SAKLAR MATI (bawaan): detak tidak membaca SIPP, tidak membuat catatan, tidak mengirim apa pun", async () => {
    const s = await bacaSetelanTenggat(db);
    expect(s).toMatchObject({ jadwal: false, pengingatWa: false });
    const { sumber, fungsi } = sumberUji();
    expect(await detakTenggat(db, { kini: SENIN_0800, sumber })).toBeNull();
    expect(fungsi.fakta).not.toHaveBeenCalled();
    expect(fungsi.penerima).not.toHaveBeenCalled();
    expect(fungsi.kirim).not.toHaveBeenCalled();
    expect((await bacaCatatanTenggat(db, "2026-10-26")).jalan).toBeNull();
    expect(await db.queryAll("SELECT * FROM aleta_tenggat_kirim")).toEqual([]);
    // lonceng juga kosong
    expect(await pemberitahuanTenggat(db, { nama: "Budi Santoso", lihatSemua: true, kini: SENIN_0800 })).toEqual([]);
  });

  it("jadwal menyala, pengingat WA mati: hasil harian tersimpan, TIDAK ADA pesan terkirim, tabel kirim kosong", async () => {
    await setel({ jadwal: true });
    const { sumber, fungsi } = sumberUji();
    const c = await detakTenggat(db, { kini: SENIN_0800, sumber });
    expect(c?.jalan?.pemicu).toBe("jadwal");
    expect(c?.rapor?.butir.length).toBeGreaterThan(0);
    expect(fungsi.fakta).toHaveBeenCalledTimes(1);
    expect(fungsi.kirim).not.toHaveBeenCalled();
    expect(fungsi.penerima).not.toHaveBeenCalled();
    expect(await db.queryAll("SELECT * FROM aleta_tenggat_kirim")).toEqual([]);
    // sekali per tanggal: detak berikutnya tidak membaca ulang
    expect(await detakTenggat(db, { kini: new Date("2026-10-26T03:00:00Z"), sumber })).toBeNull();
    expect(fungsi.fakta).toHaveBeenCalledTimes(1);
  });

  it("pengingat WA menyala tetapi jadwal MATI: tidak mengirim, juga lewat 'jalankan sekarang' dan pemanggilan langsung", async () => {
    await setel({ jadwal: false, pengingatWa: true });
    const { sumber, fungsi } = sumberUji();
    const c = await jalankanTenggat(db, { pemicu: "tangan", oleh: "Super Admin Uji", tanggal: "2026-10-26", sumber, kini: SENIN_0800 });
    expect(c.rapor).not.toBeNull(); // pemeriksaan manual tetap menyimpan hasil
    expect(fungsi.kirim).not.toHaveBeenCalled();
    const ringkas = await kirimPengingat(db, c.rapor!, await bacaSetelanTenggat(db), { sumber, kini: SENIN_0800 });
    expect(ringkas).toMatchObject({ dicoba: 0, terkirim: 0 });
    expect(fungsi.kirim).not.toHaveBeenCalled();
    expect(fungsi.penerima).not.toHaveBeenCalled();
  });

  it("tidak jalan pada Sabtu/Minggu dan tidak sebelum 07.30 WITA", async () => {
    await setel({ jadwal: true });
    const { sumber, fungsi } = sumberUji();
    expect(await detakTenggat(db, { kini: SABTU_0800, sumber })).toBeNull();
    expect(await detakTenggat(db, { kini: SENIN_0600, sumber })).toBeNull();
    expect(fungsi.fakta).not.toHaveBeenCalled();
  });

  it("ALETA_PENJAGA_TENGGAT=0 mematikan detak walau saklar menyala", async () => {
    await setel({ jadwal: true });
    const { sumber, fungsi } = sumberUji();
    expect(await detakTenggat(db, { kini: SENIN_0800, sumber, env: { ALETA_PENJAGA_TENGGAT: "0" } })).toBeNull();
    expect(fungsi.fakta).not.toHaveBeenCalled();
  });

  it("KEDUA saklar menyala: satu pesan per orang, hanya perkaranya sendiri, hanya aturan yang diizinkan", async () => {
    await setel({ jadwal: true, pengingatWa: true });
    const { sumber, fungsi } = sumberUji();
    const c = await detakTenggat(db, { kini: SENIN_0800, sumber });
    expect(c?.wa).toMatchObject({ terkirim: 2, gagal: 0 });

    // Budi: perkara 1 (akta cerai, lewat). Mediasi (4) belum diizinkan -> tidak ada.
    const budi = pesanKe(fungsi, "081234567801");
    expect(budi).toHaveLength(1);
    expect(budi[0]?.message).toContain("1/Pdt.G/2026/PA.Dgl");
    expect(budi[0]?.message).not.toContain("4/Pdt.G/2026/PA.Dgl");
    expect(budi[0]?.message).not.toContain("9/Pdt.G/2026/PA.Dgl");
    expect(budi[0]?.message).not.toContain("2/Pdt.G/2026/PA.Dgl");
    expect(budi[0]?.message).toContain("PENGINGAT TENGGAT");
    expect(budi[0]?.message).toContain("Untuk: Budi Santoso");

    // Citra (PP perkara 1): hanya perkara 1; banding (2) belum diizinkan
    const citra = pesanKe(fungsi, "081234567802");
    expect(citra).toHaveLength(1);
    expect(citra[0]?.message).toContain("1/Pdt.G/2026/PA.Dgl");
    expect(citra[0]?.message).not.toContain("2/Pdt.G/2026/PA.Dgl");

    // Dewi hanya punya perkara banding (belum diizinkan) -> tidak menerima apa-apa; Fajar tanpa perkara -> tidak
    expect(pesanKe(fungsi, "081234567803")).toEqual([]);
    expect(pesanKe(fungsi, "081234567805")).toEqual([]);
    // Eko punya perkara 9 tetapi nomornya tidak sah -> dilewati, bukan dikirim
    expect(pesanKe(fungsi, "tidak-sah")).toEqual([]);
    expect(c?.wa?.dilewati).toBe(1);
    expect(c?.wa?.tanpaPerkara).toBe(2);
    const baris = await db.queryAll<{ penerima_id: string; status: string; jumlah_butir: number }>("SELECT penerima_id, status, jumlah_butir FROM aleta_tenggat_kirim ORDER BY penerima_id");
    expect(baris).toEqual([
      { penerima_id: "u-budi", status: "terkirim", jumlah_butir: 1 },
      { penerima_id: "u-citra", status: "terkirim", jumlah_butir: 1 },
      { penerima_id: "u-eko", status: "dilewati", jumlah_butir: 1 },
    ]);
    // antrean memakai kunci per tanggal+penerima (idempotensi di sisi bot juga)
    expect((fungsi.kirim.mock.calls[0]?.[0] as { entityId: string }).entityId).toBe("2026-10-26:u-budi");
  });

  it("tidak pernah mengirim ganda pada hari yang sama: jalan ulang manual, atau dua jalan bersamaan", async () => {
    await setel({ jadwal: true, pengingatWa: true });
    const { sumber, fungsi } = sumberUji();
    await jalankanTenggat(db, { pemicu: "jadwal", tanggal: "2026-10-26", sumber, kini: SENIN_0800 });
    expect(fungsi.kirim).toHaveBeenCalledTimes(2);
    await jalankanTenggat(db, { pemicu: "tangan", tanggal: "2026-10-26", sumber, kini: SENIN_0800 });
    expect(fungsi.kirim).toHaveBeenCalledTimes(2);
    // dua klaim serentak atas rapor yang sama: hanya satu yang menang
    const c = await bacaCatatanTenggat(db, "2026-10-26");
    await db.run("DELETE FROM aleta_tenggat_kirim");
    fungsi.kirim.mockClear();
    const s = await bacaSetelanTenggat(db);
    await Promise.all([kirimPengingat(db, c.rapor!, s, { sumber, kini: SENIN_0800 }), kirimPengingat(db, c.rapor!, s, { sumber, kini: SENIN_0800 })]);
    expect(pesanKe(fungsi, "081234567801")).toHaveLength(1);
    expect(pesanKe(fungsi, "081234567802")).toHaveLength(1);
  });

  it("aturan baru ikut pengingat hanya sesudah Super Admin memasukkannya; yang gagal dapat diulang, yang terkirim tidak", async () => {
    await setel({ jadwal: true, pengingatWa: true });
    const { sumber, fungsi } = sumberUji();
    await jalankanTenggat(db, { pemicu: "jadwal", tanggal: "2026-10-26", sumber, kini: SENIN_0800 });
    expect(fungsi.kirim).toHaveBeenCalledTimes(2);
    await setel({ aturanPengingat: [...ATURAN_PENGINGAT_BAWAAN, "banding-14-hari", "mediasi-30-hari"] });
    // Dewi belum pernah menerima hari ini -> kini menerima perkara banding-nya; Budi/Citra sudah -> tidak lagi
    await jalankanTenggat(db, { pemicu: "tangan", tanggal: "2026-10-26", sumber, kini: SENIN_0800 });
    expect(fungsi.kirim).toHaveBeenCalledTimes(3);
    const dewi = pesanKe(fungsi, "081234567803");
    expect(dewi).toHaveLength(1);
    expect(dewi[0]?.message).toContain("2/Pdt.G/2026/PA.Dgl");
    expect(dewi[0]?.message).toContain("batas 28-10-2026");

    // kegagalan kirim -> status gagal, tidak diulang otomatis; diulang bila diminta eksplisit
    await db.run("DELETE FROM aleta_tenggat_kirim");
    fungsi.kirim.mockReset();
    fungsi.kirim.mockResolvedValue({ ok: false, status: "error", message: "Bot WhatsApp tidak siap." });
    await jalankanTenggat(db, { pemicu: "tangan", tanggal: "2026-10-26", sumber, kini: SENIN_0800 });
    expect((await db.queryAll<{ status: string }>("SELECT status FROM aleta_tenggat_kirim WHERE status = 'gagal'")).length).toBe(3);
    const hitungGagal = fungsi.kirim.mock.calls.length;
    await jalankanTenggat(db, { pemicu: "tangan", tanggal: "2026-10-26", sumber, kini: SENIN_0800 });
    expect(fungsi.kirim.mock.calls.length).toBe(hitungGagal);
    fungsi.kirim.mockResolvedValue({ ok: true, status: "enqueued", queueId: 5, message: "Antre." });
    await jalankanTenggat(db, { pemicu: "tangan", tanggal: "2026-10-26", sumber, kini: SENIN_0800, ulangiGagal: true });
    expect((await db.queryAll<{ status: string }>("SELECT status FROM aleta_tenggat_kirim WHERE status = 'terkirim'")).length).toBe(3);
  });

  it("bot tidak menjawab: BUKAN hari bersih - tidak ada rapor, dicoba lagi pada detak berikutnya, berhenti setelah enam kali", async () => {
    await setel({ jadwal: true, pengingatWa: true });
    const { sumber, fungsi } = sumberUji({ gagalBaca: true });
    for (let i = 1; i <= 6; i += 1) {
      const c = await detakTenggat(db, { kini: SENIN_0800, sumber });
      expect(c?.rapor).toBeNull();
      expect(c?.percobaan).toBe(i);
    }
    expect(fungsi.fakta).toHaveBeenCalledTimes(6);
    expect(await detakTenggat(db, { kini: SENIN_0800, sumber })).toBeNull();
    expect(fungsi.fakta).toHaveBeenCalledTimes(6);
    expect(fungsi.kirim).not.toHaveBeenCalled();
    const c = await bacaCatatanTenggat(db, "2026-10-26");
    expect(c.jalan?.galat).toContain("tidak menjawab");
  });

  it("lonceng: perkara sendiri untuk petugas, ringkasan satker untuk admin; hari bersih tidak membunyikan lonceng", async () => {
    await setel({ jadwal: true });
    const { sumber } = sumberUji();
    await jalankanTenggat(db, { pemicu: "jadwal", tanggal: "2026-10-26", sumber, kini: SENIN_0800 });
    const budi = await pemberitahuanTenggat(db, { nama: "Budi Santoso", lihatSemua: false, kini: SENIN_0800 });
    expect(budi).toHaveLength(1);
    expect(budi[0]).toMatchObject({ penting: true, id: "tenggat:2026-10-26:saya" });
    expect(budi[0]?.judul).toContain("perkara Anda");
    expect(budi[0]?.uraian).toContain("1/Pdt.G/2026/PA.Dgl");
    expect(budi[0]?.uraian).not.toContain("9/Pdt.G/2026/PA.Dgl");
    expect(await pemberitahuanTenggat(db, { nama: "Fajar Nugroho", lihatSemua: false, kini: SENIN_0800 })).toEqual([]);
    const admin = await pemberitahuanTenggat(db, { nama: "Admin", lihatSemua: true, kini: SENIN_0800 });
    expect(admin[0]?.id).toBe("tenggat:2026-10-26:semua");
    // saklar dimatikan lagi -> lonceng hilang
    await setel({ jadwal: false });
    expect(await pemberitahuanTenggat(db, { nama: "Budi Santoso", lihatSemua: false, kini: SENIN_0800 })).toEqual([]);
  });

  it("hanya Super Admin yang menyentuh saklar (rute), dan lihatSemuaTenggat membedakan pimpinan dari hakim", () => {
    const aktor = (roleId: string, positionId = "pos") => ({ id: "x", roleId, positionId, additionalRoleIds: [] }) as never;
    expect(lihatSemuaTenggat(aktor("super-admin"))).toBe(true);
    expect(lihatSemuaTenggat(aktor("admin"))).toBe(true);
    expect(lihatSemuaTenggat(aktor("ketua"))).toBe(true);
    expect(lihatSemuaTenggat(aktor("panitera"))).toBe(true);
    expect(lihatSemuaTenggat(aktor("hakim"))).toBe(false);
    expect(lihatSemuaTenggat(aktor("panitera-pengganti"))).toBe(false);
    expect(lihatSemuaTenggat(null)).toBe(false);
    const rute = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/tenggat/route.ts"), "utf8");
    expect(rute).toContain("bolehMenyuntingAkses(aktor)");
  });
});

// ─── 5. Migrasi 0110 ─────────────────────────────────────────────────────────

describe("migrasi 0110 - berkas = DDL schema.ts, jurnal idx 98, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0110_aleta_tenggat_kirim.sql");
  const pernyataan = (s: string) =>
    s
      .split("\n")
      .filter((b) => !b.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean);

  it("jurnal: 0110 sekali di idx 98, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0110_"))).toEqual([expect.objectContaining({ idx: 98, tag: "0110_aleta_tenggat_kirim" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_ALETA_TENGGAT_KIRIM, berjalan di pg-mem, dan tabelnya ikut cadangan JSON", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_ALETA_TENGGAT_KIRIM.tabel, ...DDL_ALETA_TENGGAT_KIRIM.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(isiSql);
    expect(kosong.public.many("SELECT * FROM aleta_tenggat_kirim")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_tenggat_kirim");
  });
});
