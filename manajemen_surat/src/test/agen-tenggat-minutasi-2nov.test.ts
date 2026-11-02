// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hariLibur } from "@/lib/hari-libur";
import {
  AMBANG_MAKS_HARI,
  ATURAN_N2,
  ATURAN_T,
  PETA_SEMUA_ATURAN,
  SEMUA_ATURAN,
  nilaiTenggat,
  terapkanAmbang,
  type FaktaTenggat,
} from "@/lib/penjaga-tenggat";
import {
  ATURAN_PENGINGAT_BAWAAN,
  ambangHariSah,
  bersihkanSetelanTenggat,
  butirUntukPenerima,
  pemilikButir,
} from "@/lib/tenggat-terjadwal";
import type { PortalWhatsappSendResult } from "@/server/modules/whatsapp/portal-whatsapp-sender";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { bacaSetelanTenggat, jalankanTenggat, simpanSetelanTenggat, type AkunPenerima, type SumberTenggat } from "@/server/modules/penjaga-tenggat/layanan";

/**
 * ============================================================================
 * PENJAGA TENGGAT T (2 Nov 2026) - minutasi, PK, kasir
 * ============================================================================
 * Perilaku nyata: mesin aturan murni, pembaca fakta bot dengan kueri TIRUAN (SIPP, ABT, pengingat Kasir), setelan Super Admin
 * dan kabar sekali per tahap atas pg-mem. Nama dan nomor perkara rekaan. Kalender 2026: 26 Okt Senin, 1 Nov Minggu, 14 Nov Sabtu.
 */

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.env.ALETA_UJI_AKAR_BOT || path.resolve(process.cwd(), "../aleta_bot"));

function fakta(ubah: Partial<FaktaTenggat> = {}): FaktaTenggat {
  return { perkaraId: "9001", nomorPerkara: "101/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalAcuan: "2026-10-20", statusPutusanId: null, ...ubah };
}

const nilai = (f: Record<string, FaktaTenggat[]>, hari: string, opsi: { hitungMundur?: boolean; libur?: boolean; ambang?: Record<string, number> } = {}) =>
  nilaiTenggat(f, hari, { aturan: SEMUA_ATURAN, hitungMundur: opsi.hitungMundur, libur: opsi.libur ? (iso) => hariLibur(iso) : undefined, ambang: opsi.ambang });

describe("aturan T - daftar, dasar, dan penanggung jawab", () => {
  it("enam aturan baru terdaftar di SEMUA_ATURAN tanpa mengubah ATURAN_N2; tutup ganda: tidak ada yang masuk pengingat WhatsApp bawaan", () => {
    expect(ATURAN_T.map((a) => a.kode)).toEqual([
      "minutasi-belum",
      "pk-180-hari",
      "kasir-sisa-panjar",
      "kasir-belum-dijurnal",
      "kasir-panjar-kurang",
      "kasir-pnbp-belum-setor",
    ]);
    expect(ATURAN_N2).toHaveLength(4);
    for (const a of ATURAN_T) {
      expect(PETA_SEMUA_ATURAN.get(a.kode)).toBe(a);
      expect(ATURAN_PENGINGAT_BAWAAN).not.toContain(a.kode);
    }
    expect(new Set(SEMUA_ATURAN.map((a) => a.kode)).size).toBe(SEMUA_ATURAN.length);
  });

  it("dasar: minutasi = Buku II 2013 hlm. 43 (14 hari); PK = Pasal 69 UU 14/1985 (180 hari) dengan titik mulai a/b dijelaskan sebagai keputusan sementara; kasir = keputusan sementara", () => {
    expect(PETA_SEMUA_ATURAN.get("minutasi-belum")?.dasar).toContain("Buku II");
    expect(PETA_SEMUA_ATURAN.get("minutasi-belum")?.dasar).toContain("14 hari");
    const pk = PETA_SEMUA_ATURAN.get("pk-180-hari")!;
    expect(pk.dasar).toContain("Pasal 69");
    expect(pk.batasHari).toBe(180);
    expect(pk.dasar).toContain("keputusan sementara 2 Nov 2026");
    expect(pk.bisaDiatur).toBeFalsy(); // masa hak menurut undang-undang tidak bisa diatur
    for (const k of ["kasir-sisa-panjar", "kasir-belum-dijurnal", "kasir-panjar-kurang", "kasir-pnbp-belum-setor"]) {
      expect(PETA_SEMUA_ATURAN.get(k)?.dasar).toContain("keputusan sementara 2 Nov 2026");
      expect(PETA_SEMUA_ATURAN.get(k)?.ruas).toEqual(["kasir"]);
    }
  });

  it("kasir hanya membunyikan kasir; minutasi memanggil majelis dan PP tetapi bukan jurusita; PK hanya panitera", () => {
    const f = {
      "kasir-sisa-panjar": [fakta({ perkaraId: "1", tanggalAcuan: "2026-10-01", kasir: "Rina Kasir, A.Md.", panitera: "Citra Lestari, S.H.", majelis: "Budi Santoso, S.H.", jurusita: "Joko Widodo" })],
      "minutasi-belum": [fakta({ perkaraId: "2", tanggalAcuan: "2026-10-05", kasir: "", panitera: "Citra Lestari, S.H.", majelis: "Budi Santoso, S.H.", jurusita: "Joko Widodo" })],
    };
    const butir = nilai(f, "2026-10-26").butir;
    expect(butir.map((b) => b.aturan).sort()).toEqual(["kasir-sisa-panjar", "minutasi-belum"]);
    const izin = ["kasir-sisa-panjar", "minutasi-belum"];
    const milik = (nama: string) => butirUntukPenerima(butir, nama, izin).map((b) => b.aturan).sort();
    expect(milik("Rina Kasir")).toEqual(["kasir-sisa-panjar"]);
    expect(milik("Budi Santoso")).toEqual(["minutasi-belum"]); // hakim: minutasi saja, bukan kasir
    expect(milik("Citra Lestari")).toEqual(["minutasi-belum"]); // PP: minutasi, bukan kasir
    expect(milik("Joko Widodo")).toEqual([]);
    expect(pemilikButir(butir[0]!, "")).toBe(false);
  });
});

describe("aturan T - hitungan", () => {
  it("minutasi: 14 hari sejak putusan, menjelang 3 hari terakhir, lewat sesudahnya; hari libur TIDAK menggeser (kewajiban petugas)", () => {
    const f = { "minutasi-belum": [fakta({ tanggalAcuan: "2026-10-16" })] }; // batas Jumat 30 Okt
    expect(nilai(f, "2026-10-26").butir).toHaveLength(0); // sisa 4
    const m = nilai(f, "2026-10-27").butir[0]!; // sisa 3
    expect([m.tingkat, m.selisihHari, m.tanggalBatas]).toEqual(["menjelang", -3, "2026-10-30"]);
    expect(nilai(f, "2026-10-30").butir[0]?.tingkat).toBe("menjelang"); // hari terakhir
    expect(nilai(f, "2026-10-31", { libur: true }).butir[0]?.tingkat).toBe("lewat"); // Sabtu: tidak ditunda ke Senin
    expect(nilai(f, "2026-10-31", { libur: true }).butir[0]?.tanggalBatas).toBe("2026-10-30");
  });

  it("PK: 180 hari sejak pemberitahuan; 30 hari terakhir MENJELANG; berakhir = CATATAN (hak, bukan kelalaian); libur menggeser", () => {
    const f = { "pk-180-hari": [fakta({ tanggalAcuan: "2026-05-01", pasti: true, dasarMulai: "pemberitahuan" })] }; // batas 28 Okt 2026 (Rabu)
    expect(nilai(f, "2026-09-20").butir).toHaveLength(0);
    expect(nilai(f, "2026-09-20", { hitungMundur: true }).butir[0]?.tingkat).toBe("berjalan");
    const m = nilai(f, "2026-10-20").butir[0]!;
    expect([m.tingkat, m.tanggalBatas, m.selisihHari]).toEqual(["menjelang", "2026-10-28", -8]);
    expect(nilai(f, "2026-10-29").butir[0]?.tingkat).toBe("catatan");
    expect(nilai(f, "2026-12-30").butir).toHaveLength(0); // lewat jendela 30 hari
    // batas Sabtu 14 Nov bergeser ke Senin 16 Nov
    const sabtu = { "pk-180-hari": [fakta({ tanggalAcuan: "2026-05-18", pasti: true })] }; // 18 Mei + 180 = 14 Nov
    expect(nilai(sabtu, "2026-11-15", { libur: true }).butir[0]?.tanggalBatas).toBe("2026-11-16");
    expect(nilai(sabtu, "2026-11-15", { libur: true }).butir[0]?.tingkat).toBe("menjelang");
  });

  it("PK tanpa tanggal pemberitahuan: hanya catatan 'hitungan belum berjalan', tanpa tanggal batas", () => {
    const b = nilai({ "pk-180-hari": [fakta({ tanggalAcuan: "2026-10-10", menunggu: true })] }, "2026-10-26").butir[0]!;
    expect([b.tingkat, b.menunggu, b.tanggalBatas]).toEqual(["catatan", true, ""]);
  });

  it("kasir: sisa panjar 14 hari, redaksi 3 hari, saldo minus 7 hari, PNBP lewat sehari sesudah tenggat hari kerja", () => {
    const hari = "2026-10-26";
    const a = (kode: string, acuan: string) => nilai({ [kode]: [fakta({ tanggalAcuan: acuan, kasir: "Rina Kasir" })] }, hari).butir[0];
    expect(a("kasir-sisa-panjar", "2026-10-12")?.tingkat).toBe("menjelang"); // batas 26 Okt, hari ini
    expect(a("kasir-sisa-panjar", "2026-10-11")?.tingkat).toBe("lewat");
    expect(a("kasir-sisa-panjar", "2026-10-20")).toBeUndefined();
    expect(a("kasir-belum-dijurnal", "2026-10-22")?.tingkat).toBe("lewat");
    expect(a("kasir-belum-dijurnal", "2026-10-24")?.tingkat).toBe("menjelang");
    expect(a("kasir-panjar-kurang", "2026-10-18")?.tingkat).toBe("lewat");
    expect(a("kasir-pnbp-belum-setor", "2026-10-26")?.tingkat).toBe("menjelang"); // jatuh tempo hari ini
    expect(a("kasir-pnbp-belum-setor", "2026-10-23")?.tingkat).toBe("lewat");
    expect(a("kasir-pnbp-belum-setor", "2026-10-23")?.kasir).toBe("Rina Kasir");
  });
});

describe("setelan Super Admin - batas hari aturan kebiasaan", () => {
  it("ambang hanya berlaku pada aturan bisaDiatur dan bilangan 0-60; PK, aturan lama, dan nilai ngawur ditolak", () => {
    expect(
      ambangHariSah({ "kasir-sisa-panjar": 7, "minutasi-belum": "10", "pk-180-hari": 30, "akta-cerai-gugat": 3, "kasir-panjar-kurang": 61, "kasir-belum-dijurnal": -1, "kasir-pnbp-belum-setor": 1.5, bukan: 2 })
    ).toEqual({ "kasir-sisa-panjar": 7, "minutasi-belum": 10 });
    expect(ambangHariSah({ "kasir-sisa-panjar": null, "minutasi-belum": "" })).toEqual({});
    expect(ambangHariSah("x")).toEqual({});
    expect(ambangHariSah([1, 2])).toEqual({});
    expect(AMBANG_MAKS_HARI).toBe(60);
    expect(bersihkanSetelanTenggat({}).ambangHari).toEqual({});
  });

  it("terapkanAmbang tidak mengubah aturan aslinya; aturan yang tidak bisaDiatur tetap", () => {
    const asli = PETA_SEMUA_ATURAN.get("kasir-sisa-panjar")!.batasHari;
    const baru = terapkanAmbang(SEMUA_ATURAN, { "kasir-sisa-panjar": 7, "pk-180-hari": 30 });
    expect(baru.find((a) => a.kode === "kasir-sisa-panjar")?.batasHari).toBe(7);
    expect(baru.find((a) => a.kode === "pk-180-hari")?.batasHari).toBe(180);
    expect(PETA_SEMUA_ATURAN.get("kasir-sisa-panjar")!.batasHari).toBe(asli);
  });

  it("mesin memakai ambang: sisa panjar 7 hari menjadikan putusan 8 hari lalu LEWAT (bawaan 14 hari: belum)", () => {
    const f = { "kasir-sisa-panjar": [fakta({ tanggalAcuan: "2026-10-18", kasir: "Rina Kasir" })] };
    expect(nilai(f, "2026-10-26").butir).toHaveLength(0);
    expect(nilai(f, "2026-10-26", { ambang: { "kasir-sisa-panjar": 7 } }).butir[0]?.tingkat).toBe("lewat");
    expect(nilai(f, "2026-10-26", { ambang: { "kasir-sisa-panjar": 7 } }).butir[0]?.tanggalBatas).toBe("2026-10-25");
  });
});

describe("pembaca fakta bot T - minutasi, PK, kasir", () => {
  const penjaga = require_(path.join(AKAR_BOT, "services/penjagaTenggatService.js"));
  const HARI = "2026-10-28";

  type Peta = Array<[string, Record<string, unknown>[]]>;
  const pasang = (peta: Peta, tambahan: { abt?: (sql: string, nilai: unknown[]) => Promise<unknown[]>; kasir?: (hariIni: string) => Promise<unknown> } = {}) => {
    const sql: string[] = [];
    const pulih = penjaga.pasangSumber({
      jalankan: async (kueri: string) => {
        sql.push(kueri);
        const cocok = peta.find(([potongan]) => kueri.includes(potongan));
        return cocok ? cocok[1] : [];
      },
      kolomAda: async () => true,
      abt: tambahan.abt ?? (async () => []),
      kasir: tambahan.kasir ?? (async () => ({ ok: true, butir: [] })),
    });
    return { sql, pulih };
  };

  const putus = (id: number, tanggal: string) => ({
    perkaraId: id,
    nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 7,
    jenisPerkaraId: 345,
    tanggalAcuan: tanggal,
    statusPutusanId: 62,
  });

  it("minutasi: putusan 45 hari tanpa validasi di register ABT menjadi fakta; yang tervalidasi keluar; satu butir per perkara", async () => {
    const abt = vi.fn(async (_sql: string, nilai: unknown[]) => (nilai[0] as number[]).includes(2) ? [{ perkaraId: 2 }] : []);
    const { pulih, sql } = pasang([["FROM perkara_putusan pu", [putus(1, "2026-10-10"), putus(2, "2026-10-12"), putus(1, "2026-10-14"), putus(3, "2026-10-20")]]], { abt });
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      expect((h.fakta["minutasi-belum"] as FaktaTenggat[]).map((x) => [x.perkaraId, x.tanggalAcuan])).toEqual([
        ["1", "2026-10-14"], // putusan terbaru yang menentukan
        ["3", "2026-10-20"],
      ]);
      // KINERJA: satu pembacaan SIPP untuk jendela, satu pembacaan ABT untuk seluruh kelompok
      expect(sql.filter((s) => s.includes("FROM perkara_putusan pu") && s.includes("LIMIT 800"))).toHaveLength(1);
      expect(abt).toHaveBeenCalledTimes(1);
      expect(String(abt.mock.calls[0]?.[0])).toContain("register_minutasi");
      expect(String(abt.mock.calls[0]?.[0])).toContain("divalidasi_oleh");
      // tanggal acuan 14 Okt + 14 = 28 Okt: hari ini jatuh tempo; 20 Okt belum
      const butir = nilai(h.fakta, HARI).butir.filter((b: { aturan: string }) => b.aturan === "minutasi-belum");
      expect(butir.map((b: { perkaraId: string; tingkat: string }) => [b.perkaraId, b.tingkat])).toEqual([["1", "menjelang"]]);
    } finally {
      pulih();
    }
  });

  it("minutasi: ABT tidak terbaca = aturan GAGAL sendiri dan disebut (bukan 'tidak ada temuan'); aturan lain tetap terbaca", async () => {
    const { pulih } = pasang([["FROM perkara_putusan pu", [putus(1, "2026-10-10")]]], {
      abt: async () => {
        throw new Error("ECONNREFUSED abt");
      },
    });
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      expect(h.fakta["minutasi-belum"]).toEqual([]);
      expect(h.gagal["minutasi-belum"]).toContain("ECONNREFUSED");
      expect(Object.keys(h.gagal)).not.toContain("kasir-sisa-panjar");
    } finally {
      pulih();
    }
  });

  it("PK jalur kasasi: titik mulai = pemberitahuan TERAKHIR; belum diberitahu = menunggu; di luar 210 hari keluar; kueri menyingkirkan yang sudah PK", async () => {
    const { pulih, sql } = pasang([
      [
        "k.putusan_kasasi IS NOT NULL",
        [
          { perkaraId: 11, nomorPerkara: "11/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", putusan: "2026-09-01", pbt0: "2026-09-10", pbt1: "2026-09-12", pbt2: null },
          { perkaraId: 12, nomorPerkara: "12/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", putusan: "2026-10-01", pbt0: null, pbt1: null, pbt2: null },
          { perkaraId: 13, nomorPerkara: "13/Pdt.G/2025/PA.Dgl", jenisPerkara: "Cerai Gugat", putusan: "2025-12-01", pbt0: "2025-12-05", pbt1: null, pbt2: null },
        ],
      ],
    ]);
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      const pk = h.fakta["pk-180-hari"] as FaktaTenggat[];
      expect(pk.map((x) => [x.perkaraId, x.tanggalAcuan, Boolean(x.menunggu)])).toEqual([
        ["11", "2026-09-12", false],
        ["12", "2026-10-01", true],
      ]);
      const kueriKasasi = sql.find((s) => s.includes("k.putusan_kasasi IS NOT NULL")) ?? "";
      expect(kueriKasasi).toContain("perkara_pk pk");
      expect(kueriKasasi).toContain("permohonan_pk IS NOT NULL");
    } finally {
      pulih();
    }
  });

  it("PK jalur banding: BHT sesudah putusan banding, tanpa kasasi; titik mulai = yang lebih akhir antara BHT dan pemberitahuan", async () => {
    const { pulih, sql } = pasang([
      [
        "pu.tanggal_bht >= bd.putusan_banding",
        [
          { perkaraId: 21, nomorPerkara: "21/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", putusan: "2026-08-01", tanggalBht: "2026-08-20", pbt0: "2026-08-25", pbt1: null, pbt2: null },
          { perkaraId: 22, nomorPerkara: "22/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", putusan: "2026-08-01", tanggalBht: "2026-08-20", pbt0: "2026-08-10", pbt1: null, pbt2: null },
        ],
      ],
    ]);
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      expect((h.fakta["pk-180-hari"] as FaktaTenggat[]).map((x) => [x.perkaraId, x.tanggalAcuan])).toEqual([
        ["21", "2026-08-25"],
        ["22", "2026-08-20"],
      ]);
      const kueri = sql.find((s) => s.includes("pu.tanggal_bht >= bd.putusan_banding")) ?? "";
      expect(kueri).toContain("pu.tanggal_bht >= bd.putusan_banding");
      expect(kueri).toContain("kk.permohonan_kasasi IS NOT NULL");
      expect(kueri).toContain("perkara_pk pk");
    } finally {
      pulih();
    }
  });

  it("kasir: SATU pembacaan pengingat Kasir untuk empat aturan; jenis dipetakan; PNBP memakai id sintetis; kasir dari grup Kasir SIPP", async () => {
    const kasir = vi.fn(async (hariIni: string) => ({
      ok: true,
      hariIni,
      butir: [
        { jenis: "sisa-panjar", perkaraId: 31, nomorPerkara: "31/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tenggat: "2026-10-06", keterangan: "Saldo panjar Rp225.500 belum dikembalikan (putus 2026-10-06)." },
        { jenis: "belum-dijurnal", perkaraId: 32, nomorPerkara: "32/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tenggat: "2026-10-20", keterangan: "belum" },
        { jenis: "panjar-kurang", perkaraId: 33, nomorPerkara: "33/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tenggat: "2026-10-15", keterangan: "minus" },
        { jenis: "pnbp-belum-setor", perkaraId: 0, nomorPerkara: "", tanggal: "2026-10-20", tenggat: "2026-10-21", keterangan: "PNBP 2026-10-20: Rp160.000" },
        { jenis: "pnbp-belum-setor", perkaraId: 0, nomorPerkara: "", tanggal: "2026-10-21", tenggat: "", keterangan: "tanpa tenggat" },
      ],
    }));
    const { pulih } = pasang(
      [
        ["FROM sys_users su", [{ userid: 5, username: "rina", fullname: "Rina Kasir, A.Md.", block: "0", kedaluwarsa: null }]],
        ["FROM perkara_hakim_pn", [{ perkaraId: 31, nama: "Budi Santoso, S.H." }]],
      ],
      { kasir }
    );
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      expect(kasir).toHaveBeenCalledTimes(1);
      expect(kasir).toHaveBeenCalledWith(HARI);
      expect((h.fakta["kasir-sisa-panjar"] as FaktaTenggat[])[0]).toMatchObject({ perkaraId: "31", tanggalAcuan: "2026-10-06", kasir: "Rina Kasir, A.Md.", majelis: "Budi Santoso, S.H." });
      expect((h.fakta["kasir-belum-dijurnal"] as FaktaTenggat[])[0]).toMatchObject({ perkaraId: "32", tanggalAcuan: "2026-10-20" });
      expect((h.fakta["kasir-panjar-kurang"] as FaktaTenggat[])[0]).toMatchObject({ perkaraId: "33", tanggalAcuan: "2026-10-15" });
      const pnbp = h.fakta["kasir-pnbp-belum-setor"] as FaktaTenggat[];
      expect(pnbp).toHaveLength(1);
      expect(pnbp[0]).toMatchObject({ perkaraId: "pnbp:2026-10-20", nomorPerkara: "PNBP 20-10-2026", jenisPerkara: "Setoran PNBP", tanggalAcuan: "2026-10-21", kasir: "Rina Kasir, A.Md." });
    } finally {
      pulih();
    }
  });

  it("kasir: pengingat Kasir tidak terbaca = empat aturan gagal sendiri; id sintetis tidak ikut dicari ke tabel petugas perkara", async () => {
    const dicari: string[] = [];
    const pulih = penjaga.pasangSumber({
      jalankan: async (kueri: string, nilai: unknown[] = []) => {
        if (kueri.includes("FROM perkara_hakim_pn")) dicari.push(...(nilai as string[]));
        return [];
      },
      kolomAda: async () => true,
      abt: async () => [],
      kasir: async () => ({ ok: false }),
    });
    try {
      const h = await penjaga.bacaFakta(HARI, { baru: true });
      for (const k of ["kasir-sisa-panjar", "kasir-belum-dijurnal", "kasir-panjar-kurang", "kasir-pnbp-belum-setor"]) expect(h.gagal[k]).toContain("pengingat_kasir_tidak_terbaca");
    } finally {
      pulih();
    }
    const pulih2 = penjaga.pasangSumber({
      jalankan: async (kueri: string, nilai: unknown[] = []) => {
        if (kueri.includes("FROM perkara_hakim_pn")) dicari.push(...(nilai as string[]));
        return [];
      },
      kolomAda: async () => true,
      abt: async () => [],
      kasir: async () => ({ ok: true, butir: [{ jenis: "pnbp-belum-setor", perkaraId: 0, tanggal: "2026-10-20", tenggat: "2026-10-21", keterangan: "x" }] }),
    });
    try {
      await penjaga.bacaFakta(HARI, { baru: true });
      expect(dicari.filter((x) => String(x).startsWith("pnbp"))).toEqual([]);
    } finally {
      pulih2();
    }
  });

  it("jalur lama (tanpa 'baru') tidak membaca aturan T dan tidak menyentuh ABT atau Kasir", async () => {
    const abt = vi.fn(async () => []);
    const kasir = vi.fn(async () => ({ ok: true, butir: [] }));
    const { pulih } = pasang([], { abt, kasir });
    try {
      const h = await penjaga.bacaFakta(HARI);
      for (const a of ATURAN_T) expect(Object.keys(h.fakta)).not.toContain(a.kode);
      expect(abt).not.toHaveBeenCalled();
      expect(kasir).not.toHaveBeenCalled();
    } finally {
      pulih();
    }
  });
});

describe("kabar sekali per tahap, hanya ke yang bertanggung jawab, dan setelan tersimpan", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  }, 180000);
  afterAll(async () => {
    await db?.close();
  });

  const AKUN: AkunPenerima[] = [
    { id: "u-rina", nama: "Rina Kasir", nomorWa: "081234567801" },
    { id: "u-citra", nama: "Citra Lestari", nomorWa: "081234567802" },
    { id: "u-budi", nama: "Budi Santoso", nomorWa: "081234567803" },
  ];
  const pagi = (tanggal: string) => new Date(`${tanggal}T00:00:00Z`);

  function sumberUji(f: Record<string, FaktaTenggat[]>) {
    const fungsi = {
      fakta: vi.fn(async (acuan: string) => ({ ok: true, acuan, fakta: f, gagal: {}, galat: "" })),
      penerima: vi.fn(async () => AKUN),
      kirim: vi.fn(async (_m: unknown): Promise<PortalWhatsappSendResult> => ({ ok: true, status: "enqueued", queueId: 1, message: "Antre." })),
    };
    return { sumber: fungsi as unknown as SumberTenggat, fungsi };
  }
  const penerimaPesan = (fungsi: ReturnType<typeof sumberUji>["fungsi"]) =>
    fungsi.kirim.mock.calls.map((c) => (c[0] as { recipientName: string; message: string }).recipientName).sort();

  beforeEach(async () => {
    await db.run("DELETE FROM aleta_tenggat_kirim");
    await db.run("DELETE FROM aleta_tenggat_kabar");
    await db.run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = '*sistem*' AND kunci LIKE 'sistem:penjaga-tenggat%'");
    await simpanSetelanTenggat(db, { id: "sa", name: "Super Admin Uji" }, { jadwal: true, pengingatWa: true, aturanPengingat: ["kasir-sisa-panjar", "minutasi-belum"] });
  });

  it("setelan: ambang digabung per aturan, nilai kosong menghapus, yang tidak sah diabaikan", async () => {
    let s = await simpanSetelanTenggat(db, { id: "sa", name: "SA" }, { ambangHari: { "kasir-sisa-panjar": 7 } });
    expect(s.ambangHari).toEqual({ "kasir-sisa-panjar": 7 });
    s = await simpanSetelanTenggat(db, { id: "sa", name: "SA" }, { ambangHari: { "minutasi-belum": 10, "pk-180-hari": 5 } });
    expect(s.ambangHari).toEqual({ "kasir-sisa-panjar": 7, "minutasi-belum": 10 });
    s = await simpanSetelanTenggat(db, { id: "sa", name: "SA" }, { ambangHari: { "kasir-sisa-panjar": null } });
    expect(s.ambangHari).toEqual({ "minutasi-belum": 10 });
    s = await simpanSetelanTenggat(db, { id: "sa", name: "SA" }, { jadwal: true });
    expect(s.ambangHari).toEqual({ "minutasi-belum": 10 }); // ubahan lain tidak menghapus ambang
    expect((await bacaSetelanTenggat(db)).ambangHari).toEqual({ "minutasi-belum": 10 });
  });

  it("sisa panjar: kasir saja; batas 14 hari dari putusan 12 Okt (batas Senin 26 Okt): H-1 Minggu tidak jalan (libur), Senin menjelang SEKALI, tidak berulang", async () => {
    const f = { "kasir-sisa-panjar": [fakta({ perkaraId: "31", tanggalAcuan: "2026-10-12", kasir: "Rina Kasir, A.Md.", panitera: "Citra Lestari, S.H.", majelis: "Budi Santoso, S.H." })] };
    const { sumber, fungsi } = sumberUji(f);
    // 23 Okt (Jumat) sisa 3: H-3
    await jalankanTenggat(db, { pemicu: "jadwal", tanggal: "2026-10-23", sumber, kini: pagi("2026-10-23") });
    expect(penerimaPesan(fungsi)).toEqual(["Rina Kasir"]); // PP dan hakim tidak dibangunkan
    // jalan ulang hari yang sama dan hari berikutnya sampai H-1 (25 Okt Minggu libur, 26 Okt hari-H)
    await jalankanTenggat(db, { pemicu: "tangan", tanggal: "2026-10-23", sumber, kini: pagi("2026-10-23") });
    expect(fungsi.kirim).toHaveBeenCalledTimes(1);
    await jalankanTenggat(db, { pemicu: "jadwal", tanggal: "2026-10-26", sumber, kini: pagi("2026-10-26") });
    expect(fungsi.kirim).toHaveBeenCalledTimes(2); // H-1 (sisa 0 = tahap H-1)
    await jalankanTenggat(db, { pemicu: "jadwal", tanggal: "2026-10-27", sumber, kini: pagi("2026-10-27") });
    expect(fungsi.kirim).toHaveBeenCalledTimes(3); // lewat
    await jalankanTenggat(db, { pemicu: "jadwal", tanggal: "2026-10-28", sumber, kini: pagi("2026-10-28") });
    expect(fungsi.kirim).toHaveBeenCalledTimes(3); // tidak diulang
  });

  it("minutasi: majelis dan PP menerima, kasir tidak; ambang Super Admin diterapkan pada jalan harian", async () => {
    const f = { "minutasi-belum": [fakta({ perkaraId: "41", tanggalAcuan: "2026-10-20", majelis: "Budi Santoso, S.H.", panitera: "Citra Lestari, S.H." })] };
    await simpanSetelanTenggat(db, { id: "sa", name: "SA" }, { ambangHari: { "minutasi-belum": 3 } }); // batas 23 Okt
    const { sumber, fungsi } = sumberUji(f);
    const c = await jalankanTenggat(db, { pemicu: "jadwal", tanggal: "2026-10-26", sumber, kini: pagi("2026-10-26") });
    expect(c.rapor?.butir[0]).toMatchObject({ aturan: "minutasi-belum", tingkat: "lewat", tanggalBatas: "2026-10-23" });
    expect(penerimaPesan(fungsi)).toEqual(["Budi Santoso", "Citra Lestari"]);
  });
});
