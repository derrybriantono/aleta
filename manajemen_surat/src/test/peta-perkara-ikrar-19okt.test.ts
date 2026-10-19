/**
 * ============================================================================
 * PETA PERKARA - KELOMPOK "IKRAR TALAK" (permintaan hakim 19 Okt 2026)
 * ============================================================================
 *
 * Yang dijaga di sini, dan yang dapat rusak diam-diam:
 *
 *   1. Penggolongan keadaan ikrar - terutama BATAS: enam bulan dihitung dari
 *      PENETAPAN HARI SIDANG IKRAR (bukan BHT), hari batas itu sendiri masih
 *      sah, dan tenggat dekat = sisa 0 sampai 30 hari. Status 2/3 SIPP
 *      didahulukan daripada tanggal ikrar (SIPP mengisi tanggal pada
 *      penetapan gugur/batal juga).
 *   2. Kelompok "Ikrar talak" ada di menu Peta perkara.
 *   3. Keluarannya terkelompok per wilayah menurut keadaan, dan daftar
 *      "tenggat dekat"/"gugur" urut menurut yang paling mendesak.
 *   4. Lapisan peta "Keadaan ikrar talak" satu aturan dengan halamannya.
 *   5. Nama/warna keadaan di layar sama dengan bot; hak akses sama dengan
 *      Peta perkara.
 *
 * `db.query` dipalsukan pada modul db_config yang SAMA dengan layanan, jadi SQL
 * yang sungguh dikirim ikut diperiksa tanpa menyentuh basis data.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  KEADAAN_IKRAR,
  KUNCI_KELOMPOK_IKRAR,
  KUNCI_LAPISAN_IKRAR,
  kalimatSisaIkrar,
  warnaKeadaanIkrar,
} from "@/lib/peta-perkara-ukur";

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));
const baca = (rel: string) => fs.readFileSync(path.join(akar, rel), "utf8");

type Kueri = { sql: string; params: unknown[] };
type Db = { query: (sql: string, params: unknown[], cb: (e: unknown, h?: unknown) => void) => void };
type Golongan = { keadaan: string; batas: string; sisaHari: number | null; ditetapkanGugur: boolean };
type Perhatian = {
  jumlah: number;
  daftar: Array<{ nomorPerkara: string; tempat: string; batas: string; sisaHari: number | null; ditetapkanGugur: boolean }>;
};

const db = require_(path.join(akar, "aleta_bot/db_config.js")) as Db;
const skema = require_(path.join(akar, "aleta_bot/services/sippSkemaService.js")) as { lupakan: () => void };
const ikrarTalak = require_(path.join(akar, "aleta_bot/services/ikrarTalakService.js")) as {
  batasEnamBulanIkrar: (b: { tanggalPenetapanSidangIkrar: string }) => string;
};
const layanan = require_(path.join(akar, "aleta_bot/services/petaPerkaraService.js")) as {
  KELOMPOK_IKRAR: string;
  KEADAAN_IKRAR: string[];
  LABEL_KEADAAN_IKRAR: Record<string, string>;
  AMBANG_TENGGAT_DEKAT_HARI: number;
  golongkanIkrar: (b: Record<string, unknown>) => Golongan;
  daftarJenis: () => Promise<Array<{ kunci: string; nama: string; perkara: number; ikrar?: boolean; golongan: string }>>;
  hitung: (m: Record<string, unknown>) => Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  lapisanIkrar: (dari: string, sampai: string, hariIni: string) => Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const lapisanPeta = require_(path.join(akar, "aleta_bot/services/lapisanPetaService.js")) as {
  LAPISAN: Record<string, (dari: string, sampai: string) => Promise<Record<string, unknown>>>;
};

const HARI_INI = "2026-10-19";
const g = (b: Record<string, unknown>) => layanan.golongkanIkrar({ hariIni: HARI_INI, ...b });

let tercatat: Kueri[] = [];
let jawaban: (k: Kueri) => unknown[] = () => [];
const asli = db.query;

beforeEach(() => {
  skema.lupakan();
  tercatat = [];
  db.query = (sql, params, cb) => {
    const k = { sql: String(sql), params: params ?? [] };
    tercatat.push(k);
    setImmediate(() => cb(null, jawaban(k)));
  };
});
afterEach(() => {
  db.query = asli;
  skema.lupakan();
});

describe("penggolongan keadaan ikrar - batas enam bulan dari hari sidang ikrar", () => {
  it("hari batas itu sendiri masih sah (tenggat dekat), sehari sesudahnya gugur", () => {
    // PHS 19 April 2026 -> batas 19 Oktober 2026.
    expect(g({ tanggalPhs: "2026-04-19" })).toMatchObject({ keadaan: "dekat", batas: "2026-10-19", sisaHari: 0 });
    // PHS 18 April 2026 -> batas 18 Oktober; kemarin batasnya.
    expect(g({ tanggalPhs: "2026-04-18" })).toMatchObject({ keadaan: "gugur", batas: "2026-10-18", sisaHari: -1 });
  });

  it("tenggat dekat = sisa 30 hari atau kurang; 31 hari masih menunggu", () => {
    expect(layanan.AMBANG_TENGGAT_DEKAT_HARI).toBe(30);
    // batas 2026-11-18 -> sisa 30
    expect(g({ tanggalPhs: "2026-05-18" })).toMatchObject({ keadaan: "dekat", sisaHari: 30 });
    // batas 2026-11-19 -> sisa 31
    expect(g({ tanggalPhs: "2026-05-19" })).toMatchObject({ keadaan: "menunggu", sisaHari: 31 });
  });

  it("dihitung dari hari sidang ikrar, BUKAN dari putusan atau BHT", () => {
    // Bahan lama (tanggalBht/tanggalPutusan) diabaikan dengan sengaja.
    const a = g({ tanggalPhs: "2026-09-01", tanggalBht: "2025-01-01", tanggalPutusan: "2024-12-01" });
    expect(a).toMatchObject({ keadaan: "menunggu", batas: "2027-03-01" });
  });

  it("memakai rumus batas ikrar yang sama dengan fitur ikrar ALETA (akhir bulan terpotong)", () => {
    for (const phs of ["2026-08-31", "2025-08-31", "2026-02-28", "2026-04-19"]) {
      expect(g({ tanggalPhs: phs }).batas).toBe(ikrarTalak.batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: phs }));
    }
    expect(g({ tanggalPhs: "2026-08-31" }).batas).toBe("2027-02-28");
  });

  it("belum ada hari sidang ikrar -> tenggat belum berjalan", () => {
    expect(g({})).toMatchObject({ keadaan: "belumPhs", batas: "", sisaHari: null });
    expect(g({ tanggalPhs: null, statusIkrar: null })).toMatchObject({ keadaan: "belumPhs" });
    // "0000-00-00" SIPP bukan tanggal.
    expect(g({ tanggalPhs: "0000-00-00" }).keadaan).toBe("belumPhs");
    expect(g({ tanggalPhs: new Date("invalid") }).keadaan).toBe("belumPhs");
  });

  it("sudah ikrar menang atas tenggat, termasuk yang ikrarnya terlambat dicatat", () => {
    expect(g({ tanggalPhs: "2025-01-10", tglIkrar: "2025-01-20", statusIkrar: 1 }).keadaan).toBe("sudah");
    expect(g({ tanggalPhs: "2024-01-10", tglIkrar: "2025-01-20" }).keadaan).toBe("sudah");
    expect(g({ statusIkrar: 1 }).keadaan).toBe("sudah");
    expect(g({ tglIkrar: new Date(2026, 9, 1) }).keadaan).toBe("sudah");
  });

  it("status SIPP 2 (gugur) dan 3 (tidak jadi) didahulukan walau tanggal ikrar terisi", () => {
    // SIPP mengisi tgl_ikrar_talak dengan tanggal penetapan gugur/batal itu juga.
    expect(g({ tanggalPhs: "2025-03-01", tglIkrar: "2025-05-01", statusIkrar: 2 })).toMatchObject({
      keadaan: "gugur",
      ditetapkanGugur: true,
    });
    expect(g({ tanggalPhs: "2026-08-01", tglIkrar: "2026-08-20", statusIkrar: 3 }).keadaan).toBe("batal");
    // Gugur karena lewat waktu BELUM ditetapkan gugur.
    expect(g({ tanggalPhs: "2025-03-01" })).toMatchObject({ keadaan: "gugur", ditetapkanGugur: false });
  });

  it("hari ini dibaca menurut zona pengadilan bila tidak diberikan", () => {
    const hasil = layanan.golongkanIkrar({ tanggalPhs: "2000-01-01" });
    expect(hasil.keadaan).toBe("gugur");
    expect(hasil.sisaHari).toBeLessThan(0);
  });
});

describe("kelompok Ikrar talak ada di menu Peta perkara", () => {
  function jawabMenu(jumlahTalak: number, tabelAda = true) {
    jawaban = (k) => {
      if (k.sql.includes("information_schema.COLUMNS")) {
        return tabelAda
          ? [
              { tabel: "perkara_ikrar_talak", kolom: "perkara_id" },
              { tabel: "perkara_ikrar_talak", kolom: "tgl_ikrar_talak" },
            ]
          : [];
      }
      if (k.sql.includes("COUNT(*) AS n") && k.sql.includes("pk.jenis_perkara_id = ?")) return [{ n: jumlahTalak }];
      if (k.sql.includes("GROUP BY p.jenis_perkara_text")) {
        return [
          { jenis: "Cerai Gugat", jenisId: 347, n: 2000 },
          { jenis: "Cerai Talak", jenisId: 346, n: jumlahTalak },
          { jenis: "Kewarisan", jenisId: 357, n: 30 },
        ];
      }
      return [];
    };
  }

  it("muncul di sebelah Perceraian, bergolongan cerai, dan ditandai kelompok ikrar", async () => {
    jawabMenu(1090);
    const menu = await layanan.daftarJenis();
    const kunci = menu.map((m) => m.kunci);
    expect(kunci[0]).toBe("perceraian");
    expect(kunci[1]).toBe(KUNCI_KELOMPOK_IKRAR);
    const ikrar = menu.find((m) => m.kunci === KUNCI_KELOMPOK_IKRAR)!;
    expect(ikrar).toMatchObject({ nama: "Ikrar talak", perkara: 1090, ikrar: true, golongan: "cerai" });
    // Cerai gugat/talak tetap hanya lewat Perceraian; Kewarisan tetap jenis tunggal.
    expect(kunci).not.toContain("Cerai Talak");
    expect(kunci).toContain("Kewarisan");
    // Hitungan menu memakai jenis 346 dan status putusan 62 (dikabulkan).
    const hitungMenu = tercatat.find((k) => k.sql.includes("COUNT(*) AS n") && k.sql.includes("pk.jenis_perkara_id = ?"))!;
    expect(hitungMenu.params).toEqual([346, 62]);
  });

  it("tidak ditawarkan bila tabel ikrar tidak terbaca atau tidak ada perkaranya", async () => {
    jawabMenu(1090, false);
    expect((await layanan.daftarJenis()).map((m) => m.kunci)).not.toContain(KUNCI_KELOMPOK_IKRAR);
    skema.lupakan();
    jawabMenu(0, true);
    expect((await layanan.daftarJenis()).map((m) => m.kunci)).not.toContain(KUNCI_KELOMPOK_IKRAR);
  });

  it("kunci kelompok sama di bot dan di layar", () => {
    expect(layanan.KELOMPOK_IKRAR).toBe(KUNCI_KELOMPOK_IKRAR);
  });
});

/** Satu perkara cerai talak: alamat opsional, kolom ikrar menurut SIPP. */
function perkara(nomor: number, o: Record<string, unknown> = {}) {
  return {
    perkaraId: nomor,
    nomorPerkara: `${nomor}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Talak",
    jenisPerkaraId: 346,
    kelamin: "L",
    kodeProvinsi: "72",
    kodeKabupaten: "72.03",
    kodeKecamatan: "72.03.01",
    kodeKelurahan: "72.03.01.2001",
    namaProvinsi: "Sulawesi Tengah",
    namaKabupaten: "Kabupaten Donggala",
    namaKecamatan: "Banawa",
    namaKelurahan: "Boneoge",
    tglIkrar: null,
    tanggalPhs: null,
    statusIkrar: null,
    ...o,
  };
}

const SATU_PERKARA_PER_KEADAAN = [
  perkara(1, { tglIkrar: "2026-06-01", tanggalPhs: "2026-05-01", statusIkrar: 1 }), // sudah
  perkara(2, { tanggalPhs: "2026-08-01" }), // menunggu (batas 2027-02-01)
  perkara(3, { tanggalPhs: "2026-05-10" }), // dekat (batas 2026-11-10 -> sisa 22)
  perkara(4, { tanggalPhs: "2026-04-10" }), // gugur lewat (batas 2026-10-10)
  perkara(5), // belum ada hari sidang ikrar, tanpa baris ikrar sama sekali
  perkara(6, { tanggalPhs: "2026-07-01", tglIkrar: "2026-07-20", statusIkrar: 3 }), // tidak jadi
];

describe("keluaran Peta perkara kelompok Ikrar talak", () => {
  function jawabHitung(baris: Array<Record<string, unknown>>) {
    jawaban = (k) => {
      if (k.sql.includes("information_schema.COLUMNS")) return [{ tabel: "perkara_ikrar_talak", kolom: "perkara_id" }];
      if (k.sql.includes("perkara_ikrar_talak it")) return baris;
      return [];
    };
  }

  it("membaca cerai talak (346) yang dikabulkan (62) lewat kolom ikrar yang dipakai ALETA", async () => {
    jawabHitung([]);
    const hasil = await layanan.hitung({ kelompok: "ikrar-talak", periode: "total", tingkat: "kabupaten", hariIni: HARI_INI });
    expect(hasil.ok).toBe(true);
    const k = tercatat.find((x) => x.sql.includes("perkara_ikrar_talak it"))!;
    expect(k.sql).toContain("it.tanggal_penetapan_sidang_ikrar");
    expect(k.sql).toContain("it.tgl_ikrar_talak");
    expect(k.sql).toContain("it.status_penetapan_ikrar_talak_id");
    // LEFT JOIN: perkara tanpa baris ikrar tetap terhitung.
    expect(k.sql).toContain("LEFT JOIN perkara_ikrar_talak it");
    expect(k.sql).toContain("tanggal_putusan BETWEEN ? AND ?");
    expect(k.params.slice(-2)).toEqual([346, 62]);
    // Tabel ikrar diperiksa lewat daftar skema (pola tabelAda).
    expect(tercatat.some((x) => x.sql.includes("information_schema.COLUMNS"))).toBe(true);
  });

  it("menghitung jumlah per keadaan dan mengelompokkan wilayah menurut keadaan", async () => {
    const baris = [
      ...SATU_PERKARA_PER_KEADAAN,
      // Kabupaten lain, belum beralamat sampai desa.
      perkara(7, { kodeKabupaten: "72.04", namaKabupaten: "Kabupaten Sigi", tanggalPhs: "2026-09-01" }),
      // Tanpa alamat sama sekali.
      perkara(8, {
        kodeProvinsi: "", kodeKabupaten: "", kodeKecamatan: "", kodeKelurahan: "",
        namaProvinsi: null, namaKabupaten: null, namaKecamatan: null, namaKelurahan: null,
        tglIkrar: "2026-03-01", statusIkrar: 1, tanggalPhs: "2026-02-01",
      }),
    ];
    jawabHitung(baris);
    const hasil = await layanan.hitung({ kelompok: "ikrar-talak", periode: "total", tingkat: "kabupaten", hariIni: HARI_INI });

    expect(hasil.kelompok).toBe("ikrar-talak");
    expect(hasil.perceraian).toBe(false);
    expect(hasil.ikrar.hariIni).toBe(HARI_INI);
    // Belum ikrar berbatas: nomor 3 dekat; nomor 2 dan 7 menunggu.
    const j = hasil.ikrar.jumlah as Record<string, number>;
    expect(j.sudah).toBe(2); // nomor 1 dan 8
    expect(j.gugur).toBe(1); // nomor 4
    expect(j.belumPhs).toBe(1); // nomor 5
    expect(j.batal).toBe(1); // nomor 6
    expect(j.dekat).toBe(1); // nomor 3
    expect(j.menunggu).toBe(2); // nomor 2 dan 7
    expect(Object.values(j).reduce((a, b) => a + b, 0)).toBe(8);

    // Ringkasan: semua perkara dihitung; yang tanpa alamat disebut apa adanya.
    expect(hasil.ringkas.diputus).toBe(8);
    expect(hasil.ringkas.beralamat).toBe(7);
    expect(hasil.ringkas.persenBeralamat).toBe(88);

    // Wilayah (kabupaten) terkelompok; rincian = nama keadaan di layar.
    const donggala = (hasil.wilayah as Array<{ nama: string; perkara: number; jenis: Record<string, number> }>).find(
      (w) => w.nama === "Kabupaten Donggala"
    )!;
    expect(donggala.perkara).toBe(6);
    expect(donggala.jenis["Sudah ikrar"]).toBe(1);
    expect(donggala.jenis["Gugur"]).toBe(1);
    expect(donggala.jenis["Belum ada sidang ikrar"]).toBe(1);
    expect(donggala.jenis["Tidak jadi diikrarkan"]).toBe(1);
    // Tiap nama rincian dikenal layar dan punya penanda warna.
    for (const nama of Object.keys(hasil.jenisMuncul)) {
      expect(warnaKeadaanIkrar(nama), nama).toBeTruthy();
      expect(hasil.penanda[nama], nama).toBeTruthy();
    }
    // Titik peta tetap per desa (cerai talak), 7 berkode desa + 1 tanpa kode.
    expect(hasil.titikTanpaKode).toBe(1);
  });

  it("daftar tenggat dekat urut dari yang paling dekat; gugur yang belum ditetapkan di depan", async () => {
    jawabHitung([
      perkara(11, { tanggalPhs: "2026-05-10" }), // batas 2026-11-10 -> sisa 22
      perkara(10, { tanggalPhs: "2026-05-25" }), // batas 2026-11-25 -> sisa 37: masih menunggu
      perkara(12, { tanggalPhs: "2026-04-25" }), // batas 2026-10-25 -> sisa 6
      perkara(13, { tanggalPhs: "2026-04-19" }), // batas hari ini -> sisa 0
      perkara(21, { tanggalPhs: "2025-01-10", tglIkrar: "2025-09-01", statusIkrar: 2 }), // gugur sudah ditetapkan
      perkara(22, { tanggalPhs: "2026-03-01" }), // gugur lewat: batas 2026-09-01 -> -48
      perkara(23, { tanggalPhs: "2026-04-01" }), // gugur lewat: batas 2026-10-01 -> -18
      perkara(24, { kodeKelurahan: "", namaKelurahan: null, tanggalPhs: "2026-04-10" }), // tanpa desa
    ]);
    const hasil = await layanan.hitung({ kelompok: "ikrar-talak", periode: "total", tingkat: "kabupaten", hariIni: HARI_INI });
    const dekat = hasil.ikrar.dekat as Perhatian;
    const gugur = hasil.ikrar.gugur as Perhatian;

    expect(dekat.daftar.map((p) => [p.nomorPerkara, p.sisaHari])).toEqual([
      ["13/Pdt.G/2026/PA.Dgl", 0],
      ["12/Pdt.G/2026/PA.Dgl", 6],
      ["11/Pdt.G/2026/PA.Dgl", 22],
    ]);
    expect(dekat.daftar[0]).toMatchObject({ batas: "2026-10-19", ditetapkanGugur: false });
    expect(dekat.jumlah).toBe(3);

    expect(gugur.jumlah).toBe(4);
    // Belum ditetapkan gugur lebih dahulu (yang terdekat lewat batas di depan), yang sudah ditetapkan terakhir.
    expect(gugur.daftar.map((p) => p.nomorPerkara)).toEqual([
      "24/Pdt.G/2026/PA.Dgl", // -9
      "23/Pdt.G/2026/PA.Dgl", // -18
      "22/Pdt.G/2026/PA.Dgl", // -48
      "21/Pdt.G/2026/PA.Dgl", // sudah ditetapkan gugur
    ]);
    expect(gugur.daftar[3].ditetapkanGugur).toBe(true);
    // Perkara tanpa desa tetap tercantum dan tempatnya kosong (layar menyebut "alamat belum tercatat").
    expect(gugur.daftar[0].tempat).toBe("Banawa");
  });

  it("daftar dibatasi seratus tetapi jumlahnya utuh", async () => {
    const banyak = Array.from({ length: 130 }, (_, i) => perkara(1000 + i, { tanggalPhs: "2025-01-10" }));
    jawabHitung(banyak);
    const hasil = await layanan.hitung({ kelompok: "ikrar-talak", periode: "total", tingkat: "kabupaten", hariIni: HARI_INI });
    expect(hasil.ikrar.gugur.jumlah).toBe(130);
    expect(hasil.ikrar.gugur.daftar).toHaveLength(100);
  });

  it("penelusuran turun menyaring daftar perhatian dengan induk yang sama dengan tabelnya", async () => {
    jawabHitung([
      perkara(31, { tanggalPhs: "2025-01-10" }),
      perkara(32, { kodeKabupaten: "72.04", namaKabupaten: "Kabupaten Sigi", kodeKecamatan: "72.04.01", tanggalPhs: "2025-01-10" }),
    ]);
    const hasil = await layanan.hitung({
      kelompok: "ikrar-talak", periode: "total", tingkat: "kecamatan", induk: "72.04", hariIni: HARI_INI,
    });
    expect((hasil.ikrar.gugur as Perhatian).daftar.map((p) => p.nomorPerkara)).toEqual(["32/Pdt.G/2026/PA.Dgl"]);
    expect((hasil.wilayah as Array<{ perkara: number }>).reduce((n, w) => n + w.perkara, 0)).toBe(1);
  });

  it("galat membaca SIPP tidak ditelan menjadi peta kosong", async () => {
    db.query = (sql, _params, cb) => {
      if (String(sql).includes("information_schema.COLUMNS")) {
        return setImmediate(() => cb(null, [{ tabel: "perkara_ikrar_talak", kolom: "perkara_id" }]));
      }
      setImmediate(() => cb(new Error("kolom tidak dikenal")));
    };
    const hasil = await layanan.hitung({ kelompok: "ikrar-talak", periode: "total", tingkat: "kabupaten" });
    expect(hasil).toMatchObject({ ok: false, alasan: "gagal_membaca_sipp" });
  });

  it("tabel ikrar tidak terdaftar -> dijawab terus terang, bukan kosong", async () => {
    jawaban = () => [];
    const hasil = await layanan.hitung({ kelompok: "ikrar-talak", periode: "total", tingkat: "kabupaten" });
    expect(hasil).toMatchObject({ ok: false, alasan: "tabel_ikrar_talak_tidak_terbaca" });
  });

  it("kelompok lain tidak terpengaruh: perceraian tetap tanpa blok ikrar", async () => {
    jawaban = () => [];
    const hasil = await layanan.hitung({ kelompok: "perceraian", periode: "total", tingkat: "kabupaten" });
    expect(hasil.ok).toBe(true);
    expect(hasil.ikrar).toBeUndefined();
  });
});

describe("lapisan peta Keadaan ikrar talak", () => {
  it("satu kategori per desa: keadaan yang paling mendesak, dengan rincian di keterangan", async () => {
    jawaban = (k) => {
      if (k.sql.includes("information_schema.COLUMNS")) return [{ tabel: "perkara_ikrar_talak", kolom: "perkara_id" }];
      if (k.sql.includes("perkara_ikrar_talak it")) {
        return [
          perkara(41, { kodeKelurahan: "72.03.01.2001", tglIkrar: "2026-01-01", tanggalPhs: "2025-12-01", statusIkrar: 1 }),
          perkara(42, { kodeKelurahan: "72.03.01.2001", tanggalPhs: "2025-01-10" }), // gugur
          perkara(43, { kodeKelurahan: "72.03.01.2002", tanggalPhs: "2026-08-01" }), // menunggu
          perkara(44, { kodeKelurahan: "72.03.01.2002", tglIkrar: "2026-01-01", statusIkrar: 1 }),
          perkara(45, { kodeKelurahan: "" }), // tanpa desa: tidak tergambar
        ];
      }
      return [];
    };
    const lapis = await layanan.lapisanIkrar("1900-01-01", "2999-12-31", HARI_INI);
    expect(lapis.satuan).toBe("kategori");
    const desa = lapis.desa as Array<{ kode: string; label: string; keterangan: string; cukup: boolean }>;
    expect(desa).toHaveLength(2);
    const a = desa.find((d) => d.kode === "72.03.01.2001")!;
    const b = desa.find((d) => d.kode === "72.03.01.2002")!;
    expect(a.label).toBe("Gugur");
    expect(a.keterangan).toContain("1 sudah ikrar");
    expect(a.keterangan).toContain("1 gugur");
    expect(b.label).toBe("Menunggu ikrar");
    expect(desa.every((d) => d.cukup)).toBe(true);
    // Semua label dikenal layar dan berwarna.
    for (const d of desa) expect(warnaKeadaanIkrar(d.label)).toBeTruthy();
  });

  it("terdaftar pada daftar lapisan TERTUTUP bersama lapisan lain", () => {
    expect(typeof lapisanPeta.LAPISAN.ikrar).toBe("function");
    expect(Object.keys(lapisanPeta.LAPISAN)).toEqual(expect.arrayContaining(["biaya", "faktor", "jurusita", "ikrar"]));
    expect(Object.getPrototypeOf(lapisanPeta.LAPISAN)).toBeNull();
  });
});

describe("layar: nama, warna, legenda, tautan, dan hak akses", () => {
  const halaman = baca("manajemen_surat/src/components/portal/peta-perkara.tsx");
  const petaLayar = baca("manajemen_surat/src/components/portal/peta-titik-perkara.tsx");
  const rutePeta = baca("manajemen_surat/src/app/api/aleta-ecourt/peta-relaas/route.ts");
  const ruteHalaman = baca("manajemen_surat/src/app/api/aleta-ecourt/peta-perkara/route.ts");

  it("nama keadaan di layar sama persis dengan bot, urutan dan jumlahnya pun", () => {
    expect(KEADAAN_IKRAR.map((k) => k.kunci)).toEqual(layanan.KEADAAN_IKRAR);
    for (const k of KEADAAN_IKRAR) expect(k.label).toBe(layanan.LABEL_KEADAAN_IKRAR[k.kunci]);
    // Enam warna berbeda.
    expect(new Set(KEADAAN_IKRAR.map((k) => k.warna)).size).toBe(6);
  });

  it("legenda berupa kalimat biasa tanpa istilah teknis", () => {
    for (const k of KEADAAN_IKRAR) {
      expect(k.kalimat.length, k.kunci).toBeGreaterThan(20);
      expect(k.kalimat, k.kunci).not.toMatch(/\b(PHS|BHT|SIPP|id|status)\b/);
      expect(k.label, k.kunci).not.toMatch(/PHS|BHT|_/);
    }
    expect(KEADAAN_IKRAR.map((k) => k.warna)).toContain(warnaKeadaanIkrar("Gugur"));
    expect(warnaKeadaanIkrar("Faktor ekonomi")).toBeUndefined();
  });

  it("sisa waktu ditulis dengan kalimat biasa", () => {
    expect(kalimatSisaIkrar(12)).toBe("sisa 12 hari");
    expect(kalimatSisaIkrar(0)).toBe("hari terakhir");
    expect(kalimatSisaIkrar(-5)).toBe("lewat 5 hari");
    expect(kalimatSisaIkrar(null)).toBe("batas belum berjalan");
  });

  it("peta punya lapisan Keadaan ikrar talak dengan warna tetap per keadaan", () => {
    expect(petaLayar).toContain(`apa: "ikrar"`);
    expect(petaLayar).toContain("KUNCI_LAPISAN_IKRAR");
    expect(petaLayar).toContain("warnaKeadaanIkrar(d.label");
    expect(petaLayar).toContain("lapisanAwal");
    // Aturan palet kategori yang lama tidak disentuh.
    expect(petaLayar).toMatch(/< WARNA_KATEGORI\.length \? WARNA_KATEGORI\[\w+\] : WARNA_TAK_CUKUP/);
    expect(petaLayar).not.toContain("% WARNA_KATEGORI.length");
    expect(KUNCI_LAPISAN_IKRAR).toBe("ikrar");
  });

  it("halaman membuka lapisan ikrar di peta dan menautkan nomor perkara ke Status Perkara", () => {
    expect(halaman).toContain("lapisanAwal={hasil.ikrar ? KUNCI_LAPISAN_IKRAR : undefined}");
    expect(halaman).toContain("/aleta-ecourt?perkara=${encodeURIComponent(p.nomorPerkara)}");
    expect(halaman).toContain("withBasePath(");
    expect(halaman).toContain("alamat belum tercatat");
    // Bagian alamat belum tercatat tetap disebut (peringatan lama masih berlaku).
    expect(halaman).toContain("yang alamatnya tercatat di SIPP");
  });

  it("hak akses sama dengan Peta perkara (analitik.peta-beban) - juga untuk lapisannya", () => {
    expect(ruteHalaman).toContain('pastikanAksi(db, actorUserId, "analitik.peta-beban")');
    expect(rutePeta).toContain('if (apa === "ikrar") await pastikanAksi(db, actorUserId, "analitik.peta-beban")');
  });

  it("tabel ikrar terdaftar di daftar skema SIPP (tabelAda tidak diam-diam menjawab tidak ada)", () => {
    const skemaSumber = baca("aleta_bot/services/sippSkemaService.js");
    expect(skemaSumber).toContain('"perkara_ikrar_talak"');
    const layananSumber = baca("aleta_bot/services/petaPerkaraService.js");
    expect(layananSumber).toContain('tabelAda("perkara_ikrar_talak")');
  });
});
