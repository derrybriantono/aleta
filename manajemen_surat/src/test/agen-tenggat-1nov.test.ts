// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hariLibur } from "@/lib/hari-libur";
import {
  ATURAN_N2,
  PETA_SEMUA_ATURAN,
  SEMUA_ATURAN,
  nilaiTenggat,
  type FaktaTenggat,
} from "@/lib/penjaga-tenggat";
import {
  ATURAN_PENGINGAT_BAWAAN,
  TAHAP_HARI_BAWAAN,
  bersihkanSetelanTenggat,
  butirUntukPenerima,
  dalamJamKerja,
  jangkaButir,
  kunciKabar,
  pemilikButir,
  saringButirTenggat,
  tahapHariSah,
  tahapKabar,
} from "@/lib/tenggat-terjadwal";
import type { PortalWhatsappSendResult } from "@/server/modules/whatsapp/portal-whatsapp-sender";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_TENGGAT_KABAR } from "@/server/db/schema";
import {
  bacaCatatanTenggat,
  jalankanTenggat,
  simpanSetelanTenggat,
  type AkunPenerima,
  type SumberTenggat,
} from "@/server/modules/penjaga-tenggat/layanan";

/**
 * ============================================================================
 * AGEN PENJAGA TENGGAT N2 (2 Nov 2026) - verzet, BHT, pemberitahuan putusan, relaas, libur, kabar bertahap
 * ============================================================================
 *
 * Perilaku nyata: mesin aturan murni (tiap aturan baru + libur), pembaca fakta bot dengan kueri TIRUAN, dan jalan
 * harian atas pg-mem dengan sumber tiruan (tanpa SIPP, tanpa WhatsApp). Nama dan nomor perkara rekaan.
 * Kalender 2026: 26 Okt Senin, 1 Nov Minggu, 14 Nov Sabtu.
 */

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.env.ALETA_UJI_AKAR_BOT || path.resolve(process.cwd(), "../aleta_bot"));

function fakta(ubah: Partial<FaktaTenggat> = {}): FaktaTenggat {
  return { perkaraId: "9001", nomorPerkara: "101/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalAcuan: "2026-10-20", statusPutusanId: null, ...ubah };
}

const nilai = (f: Record<string, FaktaTenggat[]>, hari: string, opsi: { hitungMundur?: boolean; libur?: boolean } = {}) =>
  nilaiTenggat(f, hari, { aturan: SEMUA_ATURAN, hitungMundur: opsi.hitungMundur, libur: opsi.libur ? (iso) => hariLibur(iso) : undefined });

// ─── 1. Aturan ───────────────────────────────────────────────────────────────

describe("aturan N2 - daftar dan petugas yang bertanggung jawab", () => {
  it("empat aturan baru, semua terdaftar di SEMUA_ATURAN; aturan pengingat bawaan TIDAK berubah (tutup ganda)", () => {
    expect(ATURAN_N2.map((a) => a.kode)).toEqual(["verzet-14-hari", "bht-belum-dicatat", "pemberitahuan-putusan-belum", "relaas-putusan-belum-kembali"]);
    for (const a of ATURAN_N2) expect(PETA_SEMUA_ATURAN.get(a.kode)).toBe(a);
    expect(ATURAN_PENGINGAT_BAWAAN).toHaveLength(7);
    for (const a of ATURAN_N2) expect(ATURAN_PENGINGAT_BAWAAN).not.toContain(a.kode);
  });

  it("verzet memakai Pasal 153 ayat (2) RBg (bukan HIR) dan semua dasar internal ditandai keputusan sementara", () => {
    const verzet = PETA_SEMUA_ATURAN.get("verzet-14-hari");
    expect(verzet?.dasar).toContain("Pasal 153 ayat (2) RBg");
    expect(verzet?.dasar).not.toContain("HIR");
    for (const k of ["bht-belum-dicatat", "pemberitahuan-putusan-belum", "relaas-putusan-belum-kembali"]) {
      expect(PETA_SEMUA_ATURAN.get(k)?.dasar).toContain("keputusan sementara 2 Nov 2026");
    }
  });

  it("relaas dan pemberitahuan putusan hanya ke jurusita dan PP; BHT hanya ke PP; hakim tidak dibangunkan", () => {
    const f = {
      "relaas-putusan-belum-kembali": [fakta({ perkaraId: "1", tanggalAcuan: "2026-10-10", majelis: "Budi Santoso, S.H.", panitera: "Citra Lestari, S.H.", jurusita: "Joko Widodo" })],
      "bht-belum-dicatat": [fakta({ perkaraId: "2", tanggalAcuan: "2026-10-16", majelis: "Budi Santoso, S.H.", panitera: "Citra Lestari, S.H.", jurusita: "Joko Widodo" })],
    };
    const butir = nilai(f, "2026-10-26").butir;
    expect(butir.map((b) => b.aturan).sort()).toEqual(["bht-belum-dicatat", "relaas-putusan-belum-kembali"]);
    const izin = ["relaas-putusan-belum-kembali", "bht-belum-dicatat"];
    const nomor = (nama: string) => butirUntukPenerima(butir, nama, izin).map((b) => b.aturan).sort();
    expect(nomor("Budi Santoso")).toEqual([]); // hakim: tidak
    expect(nomor("Citra Lestari")).toEqual(["bht-belum-dicatat", "relaas-putusan-belum-kembali"]);
    expect(nomor("Joko Widodo")).toEqual(["relaas-putusan-belum-kembali"]); // jurusita: relaas saja, bukan BHT
    expect(pemilikButir(butir[0]!, "Budi Santoso")).toBe(false);
  });

  it("aturan lama tanpa ruas tetap membunyikan SEMUA petugas yang tercantum (perilaku lama)", () => {
    const butir = nilaiTenggat({ "akta-cerai-gugat": [fakta({ tanggalAcuan: "2026-10-05", statusPutusanId: 62, majelis: "Budi Santoso, S.H.", jurusita: "Joko Widodo" })] }, "2026-10-26").butir;
    expect(butir).toHaveLength(1);
    expect(butir[0]!.ruas).toBeUndefined();
    expect(pemilikButir(butir[0]!, "Budi Santoso")).toBe(true);
    expect(pemilikButir(butir[0]!, "Joko Widodo")).toBe(true);
  });
});

describe("aturan N2 - hitungan", () => {
  it("verzet: 14 hari sejak pemberitahuan; 3 hari terakhir MENJELANG; sesudahnya CATATAN (hak, bukan kelalaian), bukan lewat", () => {
    const f = { "verzet-14-hari": [fakta({ tanggalAcuan: "2026-10-20", tanggalBatas: "2026-11-03", pihakKe: 2, pasti: true, dasarMulai: "pemberitahuan" })] };
    expect(nilai(f, "2026-10-28").butir).toHaveLength(0); // sisa 6: sepi
    expect(nilai(f, "2026-10-28", { hitungMundur: true }).butir[0]?.tingkat).toBe("berjalan");
    const dekat = nilai(f, "2026-10-31").butir[0]!;
    expect(dekat.tingkat).toBe("menjelang");
    expect(dekat.selisihHari).toBe(-3);
    expect(dekat.tanggalBatas).toBe("2026-11-03");
    const lewat = nilai(f, "2026-11-05").butir[0]!;
    expect(lewat.tingkat).toBe("catatan");
    expect(nilai(f, "2026-12-20").butir).toHaveLength(0); // lebih dari 30 hari sesudahnya: bukan catatan masa verzet lagi
  });

  it("BHT belum dicatat: batas internal 3 hari sesudah akhir masa; lewat hanya sesudah itu", () => {
    const f = { "bht-belum-dicatat": [fakta({ tanggalAcuan: "2026-10-19" })] }; // Senin 19 Okt akhir masa
    expect(nilai(f, "2026-10-21").butir).toHaveLength(0); // sisa 1: masih dalam ruang
    const hariIni = nilai(f, "2026-10-22").butir;
    expect(hariIni).toHaveLength(0); // tepat batas (22 Okt): belum lewat
    const lewat = nilai(f, "2026-10-26").butir[0]!;
    expect(lewat.tingkat).toBe("lewat");
    expect(lewat.tanggalBatas).toBe("2026-10-22");
    expect(lewat.selisihHari).toBe(4);
  });

  it("pemberitahuan putusan belum tercatat: batas 14 hari sejak putusan, peringatan 4 hari terakhir", () => {
    const f = { "pemberitahuan-putusan-belum": [fakta({ tanggalAcuan: "2026-10-14", pihakKe: 2 })] }; // batas 28 Okt
    expect(nilai(f, "2026-10-23").butir).toHaveLength(0);
    expect(nilai(f, "2026-10-24").butir[0]?.tingkat).toBe("menjelang");
    expect(nilai(f, "2026-10-29").butir[0]?.tingkat).toBe("lewat");
  });

  it("relaas belum kembali: batas 14 hari sejak diserahkan ke pos", () => {
    const f = { "relaas-putusan-belum-kembali": [fakta({ tanggalAcuan: "2026-10-10" })] }; // batas 24 Okt
    expect(nilai(f, "2026-10-20").butir).toHaveLength(0);
    expect(nilai(f, "2026-10-22").butir[0]?.tingkat).toBe("menjelang");
    const lewat = nilai(f, "2026-10-26").butir[0]!;
    expect(lewat.tingkat).toBe("lewat");
    expect(lewat.selisihHari).toBe(2);
  });
});

// ─── 2. Hari libur ───────────────────────────────────────────────────────────

describe("hari libur - batas masa hak bergeser ke hari kerja berikutnya", () => {
  it("kalender dasar: 14 Nov 2026 Sabtu dan 15 Nov Minggu libur, 16 Nov Senin bukan", () => {
    expect(hariLibur("2026-11-14")).toBe(true);
    expect(hariLibur("2026-11-15")).toBe(true);
    expect(hariLibur("2026-11-16")).toBe(false);
  });

  it("verzet yang batasnya Sabtu: pada Sabtu itu belum berakhir; Senin masih hari terakhir; Selasa baru catatan 'berakhir'", () => {
    const f = { "verzet-14-hari": [fakta({ tanggalAcuan: "2026-10-31", tanggalBatas: "2026-11-14", pihakKe: 2, pasti: true, dasarMulai: "pemberitahuan" })] };
    const sabtu = nilai(f, "2026-11-14", { libur: true }).butir[0]!;
    expect(sabtu.tingkat).toBe("menjelang");
    expect(sabtu.tanggalBatas).toBe("2026-11-16");
    expect(sabtu.keterangan).toContain("batas 14-11-2026 jatuh pada hari libur");
    expect(nilai(f, "2026-11-16", { libur: true }).butir[0]?.tingkat).toBe("menjelang"); // Senin: hari terakhir
    expect(nilai(f, "2026-11-17", { libur: true }).butir[0]?.tingkat).toBe("catatan"); // Selasa: berakhir
    // tanpa kalender libur: perilaku lama persis (tidak bergeser)
    expect(nilai(f, "2026-11-16").butir[0]?.tingkat).toBe("catatan");
    expect(nilai(f, "2026-11-16").butir[0]?.tanggalBatas).toBe("2026-11-14");
  });

  it("banding dan kasasi ikut bergeser; mediasi dan ikrar (kewajiban/gugur) TIDAK digeser", () => {
    const banding = nilai({ "banding-14-hari": [fakta({ tanggalAcuan: "2026-10-31", tanggalBatas: "2026-11-14", pihakKe: 1, pasti: true })] }, "2026-11-15", { libur: true }).butir[0]!;
    expect(banding.tanggalBatas).toBe("2026-11-16");
    const kasasi = nilai({ "kasasi-14-hari": [fakta({ tanggalAcuan: "2026-10-31", tanggalBatas: "2026-11-14", pasti: true })] }, "2026-11-15", { libur: true }).butir[0]!;
    expect(kasasi.tanggalBatas).toBe("2026-11-16");
    const mediasi = nilai({ "mediasi-30-hari": [fakta({ tanggalAcuan: "2026-10-15", tanggalBatas: "2026-11-14" })] }, "2026-11-16", { libur: true }).butir[0]!;
    expect(mediasi.tanggalBatas).toBe("2026-11-14");
    expect(mediasi.tingkat).toBe("lewat");
    const ikrar = nilai({ "ikrar-talak": [fakta({ tanggalAcuan: "2026-05-14", tanggalBatas: "2026-11-14", statusPutusanId: 62 })] }, "2026-11-16", { libur: true }).butir[0]!;
    expect(ikrar.tanggalBatas).toBe("2026-11-14");
    expect(ikrar.tingkat).toBe("lewat");
  });

  it("BHT belum dicatat: akhir masa Sabtu 31 Okt bergeser ke Senin 2 Nov, lalu +3 hari = Kamis 5 Nov", () => {
    const f = { "bht-belum-dicatat": [fakta({ tanggalAcuan: "2026-10-31" })] };
    const dengan = nilai(f, "2026-11-06", { libur: true }).butir[0]!;
    expect(dengan.tanggalBatas).toBe("2026-11-05");
    expect(dengan.tingkat).toBe("lewat");
    expect(nilai(f, "2026-11-05", { libur: true }).butir).toHaveLength(0);
    // tanpa kalender: 31 Okt + 3 = 3 Nov
    expect(nilai(f, "2026-11-04").butir[0]?.tanggalBatas).toBe("2026-11-03");
  });

  it("batas yang jatuh pada hari kerja tidak bergeser dan tidak diberi catatan geser", () => {
    const f = { "verzet-14-hari": [fakta({ tanggalAcuan: "2026-10-20", tanggalBatas: "2026-11-03", pihakKe: 2, pasti: true })] };
    const b = nilai(f, "2026-11-02", { libur: true }).butir[0]!;
    expect(b.tanggalBatas).toBe("2026-11-03");
    expect(b.keterangan).not.toContain("hari libur");
  });
});

// ─── 3. Tahap kabar ──────────────────────────────────────────────────────────

describe("tahap kabar - H-3, H-1, lewat, catatan; satu kali per tahap", () => {
  const b = (tingkat: "lewat" | "menjelang" | "berjalan" | "catatan", selisihHari: number) => ({ tingkat, selisihHari });

  it("bawaan H-3 dan H-1: sisa 6/5/4 hari belum dikabarkan; 3 dan 2 = H-3; 1 dan 0 = H-1", () => {
    expect([...TAHAP_HARI_BAWAAN]).toEqual([3, 1]);
    for (const sisa of [6, 5, 4]) expect(tahapKabar(b("menjelang", -sisa))).toBeNull();
    for (const sisa of [3, 2]) expect(tahapKabar(b("menjelang", -sisa))).toBe("H-3");
    for (const sisa of [1, 0]) expect(tahapKabar(b("menjelang", -sisa))).toBe("H-1");
  });

  it("lewat dan catatan satu tahap sendiri; berjalan tidak pernah dikabarkan", () => {
    expect(tahapKabar(b("lewat", 5))).toBe("lewat");
    expect(tahapKabar(b("catatan", 2))).toBe("catatan");
    expect(tahapKabar(b("berjalan", -9))).toBeNull();
  });

  it("tahap dapat diatur: [5, 2, 0] dan nilai tidak sah jatuh ke bawaan", () => {
    expect(tahapKabar(b("menjelang", -4), [5, 2, 0])).toBe("H-5");
    expect(tahapKabar(b("menjelang", -2), [5, 2, 0])).toBe("H-2");
    expect(tahapKabar(b("menjelang", 0), [5, 2, 0])).toBe("H-0");
    expect(tahapHariSah([2, "5", 2, 99, -1, "x", 1.5])).toEqual([5, 2]);
    expect(tahapHariSah(undefined)).toEqual([3, 1]);
    expect(tahapHariSah([])).toEqual([3, 1]);
    expect(bersihkanSetelanTenggat({ tahapHari: [7, 1] }).tahapHari).toEqual([7, 1]);
    expect(bersihkanSetelanTenggat({}).tahapHari).toEqual([3, 1]);
  });

  it("kunci kabar berbeda per penerima, perkara, aturan, pihak, tanggal acuan, dan tahap", () => {
    const dasar = { perkaraId: "1", aturan: "verzet-14-hari", pihak: "Tergugat", tanggalAcuan: "2026-10-20" };
    const kunci = new Set([
      kunciKabar("u1", dasar, "H-3"),
      kunciKabar("u2", dasar, "H-3"),
      kunciKabar("u1", { ...dasar, perkaraId: "2" }, "H-3"),
      kunciKabar("u1", { ...dasar, aturan: "bht-belum-dicatat" }, "H-3"),
      kunciKabar("u1", { ...dasar, pihak: "Penggugat" }, "H-3"),
      kunciKabar("u1", { ...dasar, tanggalAcuan: "2026-10-21" }, "H-3"),
      kunciKabar("u1", dasar, "H-1"),
    ]);
    expect(kunci.size).toBe(7);
  });

  it("jam kerja: hari kerja dari jam pemicu sampai 17.00 WITA; hari libur tidak", () => {
    expect(dalamJamKerja("07:30", "07:30", false)).toBe(true);
    expect(dalamJamKerja("17:00", "07:30", false)).toBe(true);
    expect(dalamJamKerja("17:01", "07:30", false)).toBe(false);
    expect(dalamJamKerja("07:10", "07:30", false)).toBe(false);
    expect(dalamJamKerja("10:00", "07:30", true)).toBe(false);
  });
});

// ─── 4. Layar: hari ini / minggu ini / lewat ─────────────────────────────────

describe("layar Tenggat - jangka hari ini, minggu ini, lewat", () => {
  const hari = "2026-10-26";
  const f = {
    "relaas-putusan-belum-kembali": [
      fakta({ perkaraId: "1", nomorPerkara: "1/Pdt.G/2026", tanggalAcuan: "2026-10-12" }), // batas 26 Okt: hari ini
      fakta({ perkaraId: "2", nomorPerkara: "2/Pdt.G/2026", tanggalAcuan: "2026-10-15" }), // batas 29 Okt: 3 hari
      fakta({ perkaraId: "3", nomorPerkara: "3/Pdt.G/2026", tanggalAcuan: "2026-10-05" }), // batas 19 Okt: lewat
    ],
    "verzet-14-hari": [fakta({ perkaraId: "4", nomorPerkara: "4/Pdt.G/2026", tanggalAcuan: "2026-10-19", tanggalBatas: "2026-11-02", pasti: true })],
  };

  it("tiap butir punya satu jangka; saringan jangka menyaring dengan benar", () => {
    const butir = nilai(f, hari, { hitungMundur: true }).butir;
    const jangka = Object.fromEntries(butir.map((x) => [x.perkaraId, jangkaButir(x)]));
    expect(jangka).toEqual({ "1": "hari-ini", "2": "minggu-ini", "3": "lewat", "4": "minggu-ini" });
    expect(saringButirTenggat(butir, { jangka: "lewat" }).map((x) => x.perkaraId)).toEqual(["3"]);
    expect(saringButirTenggat(butir, { jangka: "hari-ini" }).map((x) => x.perkaraId)).toEqual(["1"]);
    expect(saringButirTenggat(butir, { jangka: "minggu-ini" }).map((x) => x.perkaraId).sort()).toEqual(["2", "4"]);
  });

  it("catatan (hak berakhir, hitungan belum berjalan) tidak masuk lewat/hari ini/minggu ini", () => {
    const butir = nilai({ "verzet-14-hari": [fakta({ perkaraId: "5", tanggalAcuan: "2026-10-01", tanggalBatas: "2026-10-15", pasti: true })] }, hari).butir;
    expect(butir).toHaveLength(1);
    expect(jangkaButir(butir[0]!)).toBe("catatan");
  });
});

// ─── 5. Pembaca fakta bot (kueri tiruan) ─────────────────────────────────────

describe("pembaca fakta bot N2 - verzet, BHT, pemberitahuan putusan, relaas", () => {
  const penjaga = require_(path.join(AKAR_BOT, "services/penjagaTenggatService.js"));
  const HARI = "2026-10-26";

  type Peta = Array<[string, Record<string, unknown>[]]>;
  const pasang = (peta: Peta) => {
    const sql: string[] = [];
    const pulih = penjaga.pasangSumber({
      jalankan: async (kueri: string) => {
        sql.push(kueri);
        const cocok = peta.find(([potongan]) => kueri.includes(potongan));
        return cocok ? cocok[1] : [];
      },
      kolomAda: async () => true,
    });
    return { sql, pulih };
  };

  const putusan = (ubah: Record<string, unknown>) => ({
    perkaraId: 1,
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 7,
    jenisPerkaraId: 345,
    tanggalPutusan: "2026-10-05",
    verstek: "N",
    tanggalBht: null,
    statusPutusanId: 62,
    dihadiriSaatPutus: 1,
    pbtPihak1: null,
    pbtPihak2: null,
    adaPihak2: 1,
    ...ubah,
  });

  it("verzet: hanya putusan verstek yang pihak keduanya sudah diberitahu; batas = pemberitahuan + 14; yang sudah verzet keluar", async () => {
    const { pulih } = pasang([
      ["FROM perkara_verzet", [{ perkaraId: 3 }]],
      [
        "AS pbtPihak2",
        [
          putusan({ perkaraId: 1, verstek: "Y", dihadiriSaatPutus: 2, pbtPihak2: "2026-10-20" }),
          putusan({ perkaraId: 2, nomorPerkara: "2/Pdt.G/2026/PA.Dgl", verstek: "N", pbtPihak2: "2026-10-20" }), // bukan verstek
          putusan({ perkaraId: 3, nomorPerkara: "3/Pdt.G/2026/PA.Dgl", verstek: "Y", pbtPihak2: "2026-10-20" }), // sudah verzet
          putusan({ perkaraId: 4, nomorPerkara: "4/Pdt.G/2026/PA.Dgl", verstek: "Y", pbtPihak2: null }), // belum diberitahu
        ],
      ],
    ]);
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      expect(h.fakta["verzet-14-hari"]).toEqual([
        expect.objectContaining({ perkaraId: "1", tanggalAcuan: "2026-10-20", tanggalBatas: "2026-11-03", pihakKe: 2, dasarMulai: "pemberitahuan", pasti: true }),
      ]);
      const butir = nilaiTenggat(h.fakta, "2026-10-31", { aturan: SEMUA_ATURAN }).butir.filter((x) => x.aturan === "verzet-14-hari");
      expect(butir).toHaveLength(1);
      expect(butir[0]?.tingkat).toBe("menjelang");
    } finally {
      pulih();
    }
  });

  it("BHT belum dicatat: semua masa pasti habis; tidak bila kehadiran tidak pasti, masih berjalan, atau sudah verzet", async () => {
    const { pulih } = pasang([
      ["FROM perkara_verzet", [{ perkaraId: 4 }]],
      [
        "AS pbtPihak2",
        [
          putusan({ perkaraId: 1 }), // hadir semua, putusan 5 Okt: batas 19 Okt -> habis, pasti
          putusan({ perkaraId: 2, nomorPerkara: "2/Pdt.G/2026/PA.Dgl", dihadiriSaatPutus: null }), // sandi kosong: tidak pasti
          putusan({ perkaraId: 3, nomorPerkara: "3/Pdt.G/2026/PA.Dgl", verstek: "Y", dihadiriSaatPutus: 2, pbtPihak2: "2026-10-08" }), // pihak 2 batas 22 Okt
          putusan({ perkaraId: 4, nomorPerkara: "4/Pdt.G/2026/PA.Dgl" }), // sudah verzet
          putusan({ perkaraId: 5, nomorPerkara: "5/Pdt.G/2026/PA.Dgl", tanggalPutusan: "2026-10-20" }), // masih berjalan
          putusan({ perkaraId: 6, nomorPerkara: "6/Pdt.G/2026/PA.Dgl", dihadiriSaatPutus: 3 }), // pihak 1 tidak hadir, belum diberitahu: belum mulai
        ],
      ],
    ]);
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      const bht = h.fakta["bht-belum-dicatat"] as FaktaTenggat[];
      expect(bht.map((x) => [x.perkaraId, x.tanggalAcuan])).toEqual([
        ["1", "2026-10-19"],
        ["3", "2026-10-22"],
      ]);
    } finally {
      pulih();
    }
  });

  it("pemberitahuan putusan belum tercatat: satu fakta per pihak yang menunggu, acuan = tanggal putusan", async () => {
    const { pulih } = pasang([
      ["AS pbtPihak2", [putusan({ perkaraId: 6, nomorPerkara: "6/Pdt.G/2026/PA.Dgl", tanggalPutusan: "2026-10-14", dihadiriSaatPutus: 3 }), putusan({ perkaraId: 7, nomorPerkara: "7/Pdt.G/2026/PA.Dgl" })]],
    ]);
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      expect(h.fakta["pemberitahuan-putusan-belum"]).toEqual([expect.objectContaining({ perkaraId: "6", tanggalAcuan: "2026-10-14", pihakKe: 1 })]);
    } finally {
      pulih();
    }
  });

  it("relaas belum kembali: dari tanggal diserahkan ke pos; baris tanpa tanggal diabaikan", async () => {
    const { pulih } = pasang([
      [
        "b.tanggal_jursit_pos AS tanggalAcuan",
        [
          { perkaraId: 8, nomorPerkara: "8/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", alurPerkaraId: 7, jenisPerkaraId: 346, pihakKe: 2, tanggalAcuan: "2026-10-10" },
          { perkaraId: 9, nomorPerkara: "9/Pdt.G/2026/PA.Dgl", pihakKe: 1, tanggalAcuan: null },
        ],
      ],
    ]);
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      expect(h.fakta["relaas-putusan-belum-kembali"]).toEqual([expect.objectContaining({ perkaraId: "8", tanggalAcuan: "2026-10-10", pihakKe: 2 })]);
    } finally {
      pulih();
    }
  });

  it("KINERJA: putusan 60 hari dibaca SEKALI untuk banding, verzet, BHT, dan pemberitahuan (bukan empat kali)", async () => {
    const { sql, pulih } = pasang([["AS pbtPihak2", [putusan({})]]]);
    try {
      await penjaga.bacaFakta(HARI, { baru: true });
      expect(sql.filter((s) => s.includes("AS pbtPihak2"))).toHaveLength(1);
    } finally {
      pulih();
    }
  });

  it("jalur lama (tanpa 'baru') tidak membaca aturan N2", async () => {
    const { sql, pulih } = pasang([]);
    try {
      const h = await penjaga.bacaFakta(HARI);
      expect(Object.keys(h.fakta)).not.toContain("verzet-14-hari");
      expect(sql.some((s) => s.includes("perkara_verzet") || s.includes("tanggal_jursit_pos"))).toBe(false);
    } finally {
      pulih();
    }
  });
});

// ─── 6. Jalan harian: kabar bertahap, tidak spam ─────────────────────────────

describe("kabar bertahap - satu pesan per perkara per tenggat per tahap", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  }, 180000);
  afterAll(async () => {
    await db?.close();
  });

  const AKUN: AkunPenerima[] = [
    { id: "u-joko", nama: "Joko Widodo", nomorWa: "081234567811" },
    { id: "u-citra", nama: "Citra Lestari", nomorWa: "081234567812" },
    { id: "u-budi", nama: "Budi Santoso", nomorWa: "081234567813" },
  ];

  /** 00:00 UTC = 08.00 WITA pada tanggal itu. */
  const pagi = (tanggal: string) => new Date(`${tanggal}T00:00:00Z`);

  function sumberUji(fakta: Record<string, FaktaTenggat[]>) {
    const fungsi = {
      fakta: vi.fn(async (acuan: string) => ({ ok: true, acuan, fakta, gagal: {}, galat: "" })),
      penerima: vi.fn(async () => AKUN),
      kirim: vi.fn(async (_m: unknown): Promise<PortalWhatsappSendResult> => ({ ok: true, status: "enqueued", queueId: 1, message: "Antre." })),
    };
    return { sumber: fungsi as unknown as SumberTenggat, fungsi };
  }

  const pesan = (fungsi: ReturnType<typeof sumberUji>["fungsi"]) =>
    fungsi.kirim.mock.calls.map((c) => c[0] as { recipientNumber: string; message: string });

  const jalan = (sumber: SumberTenggat, tanggal: string, pemicu: "jadwal" | "tangan" = "jadwal", kini = pagi(tanggal)) =>
    jalankanTenggat(db, { pemicu, tanggal, sumber, kini });

  beforeEach(async () => {
    await db.run("DELETE FROM aleta_tenggat_kirim");
    await db.run("DELETE FROM aleta_tenggat_kabar");
    await db.run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = '*sistem*' AND kunci LIKE 'sistem:penjaga-tenggat%'");
    await simpanSetelanTenggat(db, { id: "sa", name: "Super Admin Uji" }, { jadwal: true, pengingatWa: true, aturanPengingat: ["verzet-14-hari", "relaas-putusan-belum-kembali", "bht-belum-dicatat"] });
  });

  const verzet = (): Record<string, FaktaTenggat[]> => ({
    "verzet-14-hari": [fakta({ perkaraId: "11", nomorPerkara: "11/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-23", tanggalBatas: "2026-11-06", pihakKe: 2, pasti: true, dasarMulai: "pemberitahuan", panitera: "Citra Lestari, S.H.", jurusita: "Joko Widodo", majelis: "Budi Santoso, S.H." })],
  });

  it("masa hak (verzet) batas Jumat 6 Nov: H-3 (Selasa) sekali, H-1 (Kamis) sekali, 'berakhir' (Senin) sekali, selebihnya diam", async () => {
    const { sumber, fungsi } = sumberUji(verzet());
    const hari: Array<[string, number]> = [
      ["2026-11-02", 0], // Senin: sisa 4 -> belum saatnya
      ["2026-11-03", 2], // Selasa: sisa 3 -> H-3 (JS + PP; hakim tidak)
      ["2026-11-04", 2], // Rabu: sisa 2 -> H-3 sudah dikirim -> diam
      ["2026-11-05", 4], // Kamis: sisa 1 -> H-1
      ["2026-11-06", 4], // Jumat: sisa 0 -> H-1 sudah -> diam
      ["2026-11-09", 6], // Senin: masa berakhir -> catatan sekali
      ["2026-11-10", 6], // Selasa: diam
    ];
    for (const [tanggal, kumulatif] of hari) {
      await jalan(sumber, tanggal);
      expect(fungsi.kirim.mock.calls.length, tanggal).toBe(kumulatif);
    }
    const penerima = [...new Set(pesan(fungsi).map((p) => p.recipientNumber))].sort();
    expect(penerima).toEqual(["081234567811", "081234567812"]); // JS dan PP; hakim (Budi) tidak pernah
    const tigaTahap = pesan(fungsi).filter((p) => p.recipientNumber === "081234567811");
    expect(tigaTahap).toHaveLength(3);
    expect(tigaTahap[0]!.message).toContain("tinggal 3 hari");
    expect(tigaTahap[1]!.message).toContain("tinggal 1 hari");
    expect(tigaTahap[2]!.message).toContain("11/Pdt.G/2026/PA.Dgl");
    const rows = await db.queryAll<{ tahap: string }>("SELECT tahap FROM aleta_tenggat_kabar WHERE penerima_id = 'u-joko' ORDER BY tahap");
    expect(rows.map((r) => r.tahap)).toEqual(["H-1", "H-3", "catatan"]);
  });

  it("kewajiban petugas (relaas) batas Selasa 3 Nov: H-1 sekali, lewat sekali, lalu diam", async () => {
    const f = { "relaas-putusan-belum-kembali": [fakta({ perkaraId: "12", nomorPerkara: "12/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-20", jurusita: "Joko Widodo", panitera: "Citra Lestari, S.H." })] };
    const { sumber, fungsi } = sumberUji(f);
    const hasil: Array<[string, number]> = [
      ["2026-10-30", 0], // Jumat: sisa 4 -> belum saatnya
      ["2026-11-02", 2], // Senin: sisa 1 -> H-1 (JS + PP)
      ["2026-11-03", 2], // Selasa: sisa 0 -> H-1 sudah
      ["2026-11-04", 4], // Rabu: lewat 1 hari -> 'lewat' sekali
      ["2026-11-05", 4],
      ["2026-11-06", 4],
    ];
    for (const [tanggal, kumulatif] of hasil) {
      await jalan(sumber, tanggal);
      expect(fungsi.kirim.mock.calls.length, tanggal).toBe(kumulatif);
    }
    expect(pesan(fungsi)[2]!.message).toContain("SUDAH LEWAT TENGGAT");
  });

  it("jalan ulang pada hari yang sama tidak mengirim lagi (manual maupun terjadwal)", async () => {
    const { sumber, fungsi } = sumberUji(verzet());
    await jalan(sumber, "2026-11-03");
    expect(fungsi.kirim).toHaveBeenCalledTimes(2);
    await jalan(sumber, "2026-11-03", "tangan");
    expect(fungsi.kirim).toHaveBeenCalledTimes(2);
  });

  it("gabung harian per petugas: dua perkara untuk orang yang sama = SATU pesan", async () => {
    const f = verzet();
    f["verzet-14-hari"]!.push(fakta({ perkaraId: "13", nomorPerkara: "13/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-23", tanggalBatas: "2026-11-06", pihakKe: 2, pasti: true, jurusita: "Joko Widodo" }));
    const { sumber, fungsi } = sumberUji(f);
    await jalan(sumber, "2026-11-03");
    const joko = pesan(fungsi).filter((p) => p.recipientNumber === "081234567811");
    expect(joko).toHaveLength(1);
    expect(joko[0]!.message).toContain("11/Pdt.G/2026/PA.Dgl");
    expect(joko[0]!.message).toContain("13/Pdt.G/2026/PA.Dgl");
  });

  it("perkara baru muncul di hari berikutnya: hanya perkara baru yang dikabarkan, yang lama tidak diulang", async () => {
    const f = verzet();
    const { sumber, fungsi } = sumberUji(f);
    await jalan(sumber, "2026-11-03"); // H-3 perkara 11
    f["verzet-14-hari"]!.push(fakta({ perkaraId: "14", nomorPerkara: "14/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-23", tanggalBatas: "2026-11-06", pihakKe: 2, pasti: true, jurusita: "Joko Widodo" })); // sisa 2 pada Rabu -> H-3 untuk perkara 14
    await jalan(sumber, "2026-11-04");
    const joko = pesan(fungsi).filter((p) => p.recipientNumber === "081234567811");
    expect(joko).toHaveLength(2);
    expect(joko[1]!.message).toContain("14/Pdt.G/2026/PA.Dgl");
    expect(joko[1]!.message).not.toContain("11/Pdt.G/2026/PA.Dgl");
  });

  it("pesan gagal TIDAK dicatat sebagai dikabarkan: dicoba lagi pada jalan berikutnya", async () => {
    const { sumber, fungsi } = sumberUji(verzet());
    fungsi.kirim.mockResolvedValue({ ok: false, status: "error", message: "Bot WhatsApp tidak siap." });
    await jalan(sumber, "2026-11-03");
    expect(await db.queryAll("SELECT id FROM aleta_tenggat_kabar")).toEqual([]);
    fungsi.kirim.mockResolvedValue({ ok: true, status: "enqueued", queueId: 2, message: "Antre." });
    fungsi.kirim.mockClear();
    await jalankanTenggat(db, { pemicu: "tangan", tanggal: "2026-11-03", sumber, kini: pagi("2026-11-03"), ulangiGagal: true });
    expect(fungsi.kirim).toHaveBeenCalledTimes(2);
    expect((await db.queryAll("SELECT id FROM aleta_tenggat_kabar")).length).toBe(2);
  });

  it("tahap dapat diatur: [5, 2] = H-5 lalu H-2 (aturan yang peringatannya cukup panjang); sisa 4 dan 3 diam", async () => {
    await simpanSetelanTenggat(db, { id: "sa", name: "Super Admin Uji" }, { tahapHari: [5, 2], aturanPengingat: ["akta-cerai-gugat"] });
    // batas 9 Nov (acuan 26 Okt + 14); aturan akta cerai mulai memperingatkan pada sisa 7
    const f = { "akta-cerai-gugat": [fakta({ perkaraId: "21", nomorPerkara: "21/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-26", statusPutusanId: 62, panitera: "Citra Lestari, S.H." })] };
    const { sumber, fungsi } = sumberUji(f);
    const hasil: Array<[string, number]> = [
      ["2026-11-02", 0], // sisa 7
      ["2026-11-04", 1], // sisa 5 -> H-5
      ["2026-11-05", 1], // sisa 4
      ["2026-11-06", 1], // sisa 3
      ["2026-11-09", 2], // sisa 0 -> H-2 (belum pernah) -> kabar terakhir
    ];
    for (const [tanggal, kumulatif] of hasil) {
      await jalan(sumber, tanggal);
      expect(fungsi.kirim.mock.calls.length, tanggal).toBe(kumulatif);
    }
    expect((await db.queryAll<{ tahap: string }>("SELECT tahap FROM aleta_tenggat_kabar ORDER BY tahap")).map((r) => r.tahap)).toEqual(["H-2", "H-5"]);
  });

  it("di luar jam kerja (20.00 WITA) hasil harian tersimpan tetapi tidak ada pesan, dan tidak ada yang dicatat terkirim", async () => {
    const { sumber, fungsi } = sumberUji(verzet());
    await jalan(sumber, "2026-11-03", "tangan", new Date("2026-11-03T12:00:00Z")); // 20.00 WITA
    const c = await bacaCatatanTenggat(db, "2026-11-03");
    expect(c.rapor?.butir).toHaveLength(1);
    expect(c.wa).toBeNull();
    expect(fungsi.kirim).not.toHaveBeenCalled();
    // keesokan paginya (hari kerja, jam kerja) kabar yang tertunda tetap ada: H-3 belum tercatat -> terkirim (sisa 2)
    await jalan(sumber, "2026-11-04");
    expect(fungsi.kirim).toHaveBeenCalledTimes(2);
  });

  it("hari libur (Sabtu): tidak ada pesan walau dijalankan tangan", async () => {
    const f = { "verzet-14-hari": [fakta({ perkaraId: "11", tanggalAcuan: "2026-10-31", tanggalBatas: "2026-11-14", pihakKe: 2, pasti: true, jurusita: "Joko Widodo" })] };
    const { sumber, fungsi } = sumberUji(f);
    await jalan(sumber, "2026-11-14", "tangan");
    expect(fungsi.kirim).not.toHaveBeenCalled();
    // hasil harian memakai batas yang sudah bergeser (Senin 16 Nov)
    const c = await bacaCatatanTenggat(db, "2026-11-14");
    expect(c.rapor?.butir[0]?.tanggalBatas).toBe("2026-11-16");
  });
});

// ─── 7. Migrasi 0127 ─────────────────────────────────────────────────────────

describe("migrasi 0127 - berkas = DDL schema.ts, jurnal idx 111, ikut cadangan, tanpa kunci asing", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0127_aleta_tenggat_kabar.sql");
  const pernyataan = (s: string) =>
    s
      .split("\n")
      .filter((b) => !b.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean);

  it("jurnal: 0127 tepat sekali di idx 111, idx unik, when menaik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    // G2 1 Nov: 0126 (P2) di idx 110, 0127 di idx 111 - urut nomor, idx = urutan, when naik.
    const idx0127 = 111;
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0127_"))).toEqual([expect.objectContaining({ idx: idx0127, tag: "0127_aleta_tenggat_kabar" })]);
    expect(new Set(j.entries.map((e) => e.idx)).size).toBe(j.entries.length);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]!.when).toBeGreaterThan(j.entries[i - 1]!.when);
  });

  it("pernyataan berkas = DDL_ALETA_TENGGAT_KABAR, berjalan di pg-mem, tabelnya ikut cadangan, tanpa kunci asing", () => {
    const isi = readFileSync(SQL, "utf8");
    expect(pernyataan(isi).sort()).toEqual([...DDL_ALETA_TENGGAT_KABAR.tabel, ...DDL_ALETA_TENGGAT_KABAR.indeks].map((s) => pernyataan(s)[0]).sort());
    const kosong = newDb();
    kosong.public.none(isi);
    expect(kosong.public.many("SELECT * FROM aleta_tenggat_kabar")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_tenggat_kabar");
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(isi.replace(/--.*$/gm, ""))).toBe(false);
    expect(/aleta/i.test(isi.replace(/aleta_[a-z_]+/g, "").replace(/--.*$/gm, ""))).toBe(false);
  });
});
