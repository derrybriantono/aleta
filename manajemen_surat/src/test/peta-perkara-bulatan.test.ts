/**
 * ============================================================================
 * PETA PERKARA - UKURAN BULATAN, GOLONGAN, REKAP KECAMATAN, DAN BATASNYA
 * ============================================================================
 *
 * Permintaan satker 27 September 2026:
 *
 *   1. "buat bulatan lebih besar ketika perkara disana banyak, sedangkan
 *      bulatan kecil kalau perkaranya kecil"
 *   2. bulatan dapat dipilih: semua perkara, cerai, dispensasi kawin, itsbat
 *      nikah, lainnya
 *   3. "tiap kecamatan dibatasi garis ... serta jumlah perkaranya"
 *
 * Seluruh pemeriksaan di sini MENJALANKAN fungsinya atas angka - tidak ada
 * penyisir teks sumber. Penggolongan jenis diuji dengan jenis_perkara_id dan
 * jumlah SUNGGUHAN dari sipp_donggala (diukur 27 Sep 2026), lewat layanan bot
 * yang dimuat apa adanya.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  ATURAN_BULATAN,
  GOLONGAN_PETA,
  KELAS_PETA,
  KUNCI_INGAT_GOLONGAN,
  PILIHAN_JENIS,
  WARNA_KELAS,
  ZUM_GARIS_KECAMATAN,
  ZUM_LABEL_KECAMATAN,
  bacaBatasKecamatan,
  bacaPilihanTersimpan,
  hitungGolongan,
  hitungPilihan,
  pilihanAwal,
  pilihanUntukKelompok,
  jariJariBulatan,
  kelasDominan,
  kodeKecamatanDesa,
  kuantil,
  lapisanKecamatanTampil,
  leluhurMenahanFixed,
  pilihLabelTakBertabrakan,
  rapiKeBawah,
  rekapKecamatan,
  selimutBerjarak,
  selimutCembung,
  simpanPilihan,
  skalaBulatan,
  tanggaUkuran,
  titikDalamPoligon,
  titikLabelWilayah,
  type LatLon,
  type TitikUntukRekap,
} from "@/lib/peta-perkara-ukur";

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));

type LayananPeta = {
  KELAS_PETA: readonly string[];
  GOLONGAN_PETA: Record<string, readonly string[]>;
  KELOMPOK: Record<string, { penanda: Record<string, string> }>;
  kelasJenis: (id: unknown) => string;
  golonganKelas: (kelas: string) => string;
};
const layanan = require_(path.join(akar, "aleta_bot/services/petaPerkaraService.js")) as LayananPeta;

/* ==========================================================================
 * 1. JARI-JARI - LUAS SEBANDING JUMLAH, BATAS, DAN SKALA DARI DATA
 * ========================================================================== */

/**
 * Jumlah perkara per desa BERTITIK, semua perkara diputus tahun 2026, seluruh
 * 161 desa - sebaran SUNGGUHAN sipp_donggala (diukur 27 Sep 2026; P50 2, P95 8,
 * terbesar 23).
 */
const DESA_2026 = [
  23, 23, 17, 13, 13, 10, 9, 8, 8, 8, 7, 7, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,
];

describe("jari-jari bulatan: luas sebanding jumlah, dengan batas dan skala dari data", () => {
  const skala = skalaBulatan(DESA_2026);

  it("acuannya kuantil ke-95, bukan yang terbesar", () => {
    expect(DESA_2026).toHaveLength(161);
    expect(skala.nAcuan).toBeCloseTo(kuantil(DESA_2026, 0.95), 6);
    expect(skala.nAcuan).toBe(8);
    expect(skala.nAcuan).toBeLessThan(Math.max(...DESA_2026));
    // Pada acuannya, jari-jarinya tepat rAcuan.
    expect(jariJariBulatan(skala.nAcuan, skala)).toBeCloseTo(ATURAN_BULATAN.rAcuan, 6);
  });

  it("naik terus (monoton) sepanjang jumlah perkara", () => {
    let sebelumnya = 0;
    for (let n = 1; n <= 200; n++) {
      const r = jariJariBulatan(n, skala);
      expect(r, `n=${n}`).toBeGreaterThanOrEqual(sebelumnya);
      sebelumnya = r;
    }
  });

  it("LUAS - bukan jari-jari - sebanding jumlah di antara kedua batas", () => {
    // Empat kali perkara = dua kali jari-jari = empat kali luas.
    const a = jariJariBulatan(2, skala);
    const b = jariJariBulatan(8, skala);
    expect(b / a).toBeCloseTo(2, 6);
    expect((b * b) / (a * a)).toBeCloseTo(4, 6);
  });

  it("dijepit ke batas bawah dan atasnya", () => {
    expect(jariJariBulatan(1, skalaBulatan([1000]))).toBe(ATURAN_BULATAN.rMin);
    expect(jariJariBulatan(1e6, skala)).toBe(ATURAN_BULATAN.rMaks);
    for (const n of [1, 2, 3, 50, 5000]) {
      const r = jariJariBulatan(n, skala);
      expect(r).toBeGreaterThanOrEqual(ATURAN_BULATAN.rMin);
      expect(r).toBeLessThanOrEqual(ATURAN_BULATAN.rMaks);
    }
  });

  it("nol perkara tidak digambar sama sekali - bukan dijepit ke bulatan terkecil", () => {
    expect(jariJariBulatan(0, skala)).toBe(0);
    expect(jariJariBulatan(Number.NaN, skala)).toBe(0);
  });

  it("SATU desa raksasa tidak mengecilkan seluruh desa lain menjadi titik", () => {
    const denganRaksasa = skalaBulatan([...DESA_2026, 5000]);
    // Acuannya hampir tidak bergeser (P95), jadi desa median tetap sebesar semula
    // - selisihnya di bawah 5%...
    const semula = jariJariBulatan(2, skala);
    expect(Math.abs(jariJariBulatan(2, denganRaksasa) - semula) / semula).toBeLessThan(0.05);
    // ...sedangkan rumus lama (3 + 15 x akar(n/terbesar)) meremukkannya.
    const lama = (n: number, terbesar: number) => 3 + 15 * Math.sqrt(n / terbesar);
    expect(lama(2, 5000)).toBeLessThan(3.4);
    expect(jariJariBulatan(2, denganRaksasa)).toBeGreaterThan(8);
    // Raksasanya sendiri dijepit ke batas atas, bukan tumbuh tanpa batas.
    expect(jariJariBulatan(5000, denganRaksasa)).toBe(ATURAN_BULATAN.rMaks);
  });

  it("jarak ukuran jauh lebih lebar daripada rumus lama pada data sungguhan", () => {
    // Rumus lama: desa 1 perkara 6,1 px lawan desa 23 perkara 18 px (2,9 kali).
    // Sekarang: 7,1 px lawan 33,9 px (4,8 kali) - desa besar sungguh besar.
    const kecil = jariJariBulatan(1, skala);
    const besar = jariJariBulatan(23, skala);
    expect(kecil).toBeCloseTo(7.07, 2);
    expect(besar).toBeCloseTo(33.91, 2);
    expect(besar / kecil).toBeGreaterThan(4.5);
    expect((3 + 15 * Math.sqrt(23 / 23)) / (3 + 15 * Math.sqrt(1 / 23))).toBeLessThan(3);
  });

  it("rentang yang sangat tipis tidak membuat satu perkara tergambar sebesar acuan", () => {
    const sebulan = skalaBulatan([1, 1, 2, 1, 1]);
    expect(sebulan.nAcuan).toBe(ATURAN_BULATAN.nAcuanMin);
    expect(jariJariBulatan(1, sebulan)).toBeLessThan(ATURAN_BULATAN.rAcuan * 0.6);
  });

  it("keterangan ukuran menyebut angka sungguhan, dengan jari-jari fungsi yang SAMA", () => {
    const tangga = tanggaUkuran(skala, 23);
    expect(tangga.map((t) => t.nilai)).toEqual([1, 5, 23]);
    for (const t of tangga) expect(t.r).toBe(jariJariBulatan(t.nilai, skala));
    expect(tangga.some((t) => t.jenuh)).toBe(false);
  });

  it("yang dijepit ditandai '≥' pada keterangannya", () => {
    const tangga = tanggaUkuran(skala, 400);
    const atas = tangga[tangga.length - 1];
    expect(atas.jenuh).toBe(true);
    expect(atas.nilai).toBe(Math.ceil(skala.nJenuh));
    expect(atas.r).toBe(ATURAN_BULATAN.rMaks);
  });

  it("bilangan rapi 1-2-5", () => {
    expect([0.3, 1, 1.9, 2, 4.9, 5, 9, 12, 26, 99, 150, 499].map(rapiKeBawah)).toEqual([
      1, 1, 1, 2, 2, 5, 5, 10, 20, 50, 100, 200,
    ]);
  });
});

/* ==========================================================================
 * 2. GOLONGAN - LEWAT jenis_perkara_id, DENGAN JUMLAH SUNGGUHAN
 * ========================================================================== */

/**
 * Perkara DIPUTUS per (jenis_perkara_id, jenis_perkara_text), seluruh
 * sipp_donggala, satu pihak per perkara - dasar peta. Diukur 27 Sep 2026.
 * Perhatikan id 360 dengan DUA ejaan, dan tak satu pun berbunyi "itsbat".
 */
const DIPUTUS_SIPP_DONGGALA: Array<[number, string, number]> = [
  [347, "Cerai Gugat", 4319],
  [360, "Pengesahan Perkawinan/Istbat Nikah", 3956],
  [346, "Cerai Talak", 1151],
  [362, "Dispensasi Kawin", 195],
  [371, "P3HP/Penetapan Ahli Waris", 102],
  [360, "Istbat Nikah", 89],
  [354, "Perwalian", 87],
  [364, "Kewarisan", 20],
  [369, "Lain-Lain", 19],
  [363, "Wali Adhol", 13],
  [341, "Izin Poligami", 12],
  [358, "Asal Usul Anak", 12],
  [348, "Harta Bersama", 11],
  [370, "Ekonomi Syariah", 2],
  [342, "Pencegahan Perkawinan", 2],
  [365, "Wasiat", 1],
  [343, "Penolakan Perkawinan oleh PPN", 1],
  [344, "Pembatalan Perkawinan", 1],
];

describe("golongan bulatan dibaca lewat jenis_perkara_id, bukan nama", () => {
  it("jumlah per golongan atas data sungguhan sipp_donggala", () => {
    const jumlah: Record<string, number> = {};
    for (const [id, , n] of DIPUTUS_SIPP_DONGGALA) {
      const g = layanan.golonganKelas(layanan.kelasJenis(id));
      jumlah[g] = (jumlah[g] ?? 0) + n;
    }
    expect(jumlah).toEqual({ cerai: 5470, itsbat: 4045, dispensasi: 195, lainnya: 283 });
    expect(Object.values(jumlah).reduce((a, b) => a + b, 0)).toBe(9993);
  });

  it("kedua ejaan id 360 jatuh ke itsbat - yang dicari lewat kata akan kehilangan keduanya", () => {
    expect(layanan.kelasJenis(360)).toBe("itsbat");
    expect(layanan.kelasJenis("360")).toBe("itsbat");
    const ejaan = DIPUTUS_SIPP_DONGGALA.filter(([id]) => id === 360).map(([, t]) => t);
    expect(ejaan).toHaveLength(2);
    for (const t of ejaan) expect(/itsbat/i.test(t)).toBe(false);
  });

  it("cerai dipecah gugat/talak; yang tidak dikenal - termasuk kosong - jatuh ke lainnya", () => {
    expect(layanan.kelasJenis(347)).toBe("ceraiGugat");
    expect(layanan.kelasJenis(346)).toBe("ceraiTalak");
    expect(layanan.kelasJenis(362)).toBe("dispensasi");
    for (const id of [341, 371, 999, null, undefined, ""]) expect(layanan.kelasJenis(id)).toBe("lainnya");
  });

  it("nama kelas dan golongan di layar SAMA dengan milik bot - satu daftar nomor, di bot saja", () => {
    expect([...KELAS_PETA]).toEqual([...layanan.KELAS_PETA]);
    expect(GOLONGAN_PETA.map((g) => g.kunci)).toEqual(Object.keys(layanan.GOLONGAN_PETA));
    for (const g of GOLONGAN_PETA) expect([...g.kelas]).toEqual([...layanan.GOLONGAN_PETA[g.kunci]]);
  });

  it("cerai gugat MERAH dan cerai talak BIRU - penanda satker, nilai red-500/blue-500", () => {
    const penanda = layanan.KELOMPOK.perceraian.penanda;
    expect(penanda["Cerai Gugat"]).toBe("merah");
    expect(penanda["Cerai Talak"]).toBe("biru");
    expect(WARNA_KELAS.ceraiGugat).toBe("#ef4444");
    expect(WARNA_KELAS.ceraiTalak).toBe("#3b82f6");
    expect(new Set(Object.values(WARNA_KELAS)).size).toBe(KELAS_PETA.length);
  });

  const desa = {
    perkara: 23,
    lelaki: 8,
    perempuan: 15,
    jenis: { "Cerai Gugat": 13, "Cerai Talak": 6, "Harta Bersama": 1 },
    kelas: {
      ceraiGugat: { perkara: 13, lelaki: 0, perempuan: 13 },
      ceraiTalak: { perkara: 6, lelaki: 6, perempuan: 0 },
      dispensasi: { perkara: 1, lelaki: 1, perempuan: 0 },
      itsbat: { perkara: 1, lelaki: 1, perempuan: 0 },
      lainnya: { perkara: 2, lelaki: 0, perempuan: 2, jenis: { "Harta Bersama": 1, "P3HP/Penetapan Ahli Waris": 1 } },
    },
  };

  it("hitungan satu desa per golongan - bentuk sungguhan Kalukubula 2026", () => {
    expect(hitungGolongan(desa, "semua").perkara).toBe(23);
    const cerai = hitungGolongan(desa, "cerai");
    expect(cerai).toMatchObject({ perkara: 19, lelaki: 6, perempuan: 13 });
    expect(cerai.kelas).toEqual({ ceraiGugat: 13, ceraiTalak: 6 });
    expect(hitungGolongan(desa, "dispensasi").perkara).toBe(1);
    expect(hitungGolongan(desa, "itsbat").perkara).toBe(1);
    const lain = hitungGolongan(desa, "lainnya");
    expect(lain.perkara).toBe(2);
    // Keterangan melayang golongan "lainnya" menyebut jenisnya satu per satu.
    expect(lain.rincian).toEqual({ "Harta Bersama": 1, "P3HP/Penetapan Ahli Waris": 1 });
  });

  it("warna mengikuti KELAS terbanyak di dalam golongan yang dipilih", () => {
    expect(kelasDominan(hitungGolongan(desa, "semua").kelas)).toBe("ceraiGugat");
    expect(kelasDominan(hitungGolongan(desa, "dispensasi").kelas)).toBe("dispensasi");
    expect(kelasDominan({})).toBeNull();
  });

  it("bot tua tanpa `kelas`: hanya 'semua' yang dijawab - golongan lain NOL, tidak ditebak dari nama", () => {
    const tua = { perkara: 5, lelaki: 2, perempuan: 3, jenis: { "Dispensasi Kawin": 5 } };
    expect(hitungGolongan(tua, "semua").perkara).toBe(5);
    expect(hitungGolongan(tua, "dispensasi").perkara).toBe(0);
  });
});

/* ==========================================================================
 * 3. REKAP KECAMATAN - SELURUH PERKARA, TERMASUK DESA TANPA TITIK
 * ========================================================================== */

describe("rekap kecamatan menghitung SELURUH perkara kecamatan itu", () => {
  const kelas = (gugat: number, dispensasi = 0) => ({
    ceraiGugat: { perkara: gugat, lelaki: 0, perempuan: gugat },
    ...(dispensasi ? { dispensasi: { perkara: dispensasi, lelaki: dispensasi, perempuan: 0 } } : {}),
  });
  const titik: TitikUntukRekap[] = [
    { kode: "72.03.08.1020", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 5, lelaki: 0, perempuan: 5, kelas: kelas(5) },
    { kode: "72.03.08.2001", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 4, lelaki: 1, perempuan: 3, kelas: kelas(3, 1) },
    // Desa BERKODE tanpa titik di OSM - harus tetap terhitung.
    { kode: "72.03.08.2099", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 7, lelaki: 0, perempuan: 7, kelas: kelas(7) },
    { kode: "72.10.01.2009", kecamatan: "Sigi Biromaru", kabupaten: "Kabupaten Sigi", perkara: 2, lelaki: 0, perempuan: 2, kelas: kelas(2) },
    // Kode tulisan dari era lama - tidak dapat diturunkan ke kecamatan mana pun.
    { kode: "Ganti", kecamatan: "", kabupaten: "", perkara: 9, lelaki: 0, perempuan: 9, kelas: kelas(9) },
  ];
  const koordinat: Record<string, [number, number]> = {
    "72.03.08.1020": [-0.67, 119.74],
    "72.03.08.2001": [-0.69, 119.73],
    "72.10.01.2009": [-1.01, 119.96],
  };
  const sisa = [{ kode: "72.03.08", nama: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 3, kelas: { ceraiGugat: 2, dispensasi: 1 } }];

  it("desa tanpa titik dan baris tanpa kode desa IKUT terhitung", () => {
    const r = rekapKecamatan(titik, koordinat, sisa, "semua").get("72.03.08")!;
    expect(r.perkara).toBe(5 + 4 + 7 + 3);
    expect(r.perkaraBertitik).toBe(9);
    expect(r.perkaraTanpaTitik).toBe(7);
    expect(r.perkaraTanpaDesa).toBe(3);
    expect(r).toMatchObject({ desa: 3, desaBertitik: 2, nama: "Banawa" });
  });

  it("mengikuti golongan yang dipilih", () => {
    const cerai = rekapKecamatan(titik, koordinat, sisa, "cerai").get("72.03.08")!;
    expect(cerai.perkara).toBe(5 + 3 + 7 + 2);
    const disp = rekapKecamatan(titik, koordinat, sisa, "dispensasi").get("72.03.08")!;
    expect(disp.perkara).toBe(1 + 1);
    expect(rekapKecamatan(titik, koordinat, sisa, "itsbat").get("72.03.08")).toBeUndefined();
  });

  it("kode tulisan tidak dikarang kecamatannya", () => {
    const semua = rekapKecamatan(titik, koordinat, sisa, "semua");
    expect([...semua.keys()].sort()).toEqual(["72.03.08", "72.10.01"]);
    expect(kodeKecamatanDesa("Ganti")).toBeNull();
    expect(kodeKecamatanDesa("72.03.08.1020")).toBe("72.03.08");
  });
});

/* ==========================================================================
 * 4. BATAS PERKIRAAN - SELIMUT CEMBUNG BERJARAK DARI TITIK DESA
 * ========================================================================== */

describe("batas perkiraan dari titik desa", () => {
  it("selimut cembung: titik dalam dibuang, sudut dipertahankan", () => {
    const h = selimutCembung([
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [0.5, 0.5],
      [0.5, 0.5],
    ]);
    expect(h).toHaveLength(4);
    expect(h).not.toContainEqual([0.5, 0.5]);
  });

  it("kurang dari tiga titik UNIK: tanpa garis", () => {
    expect(selimutBerjarak([])).toBeNull();
    expect(selimutBerjarak([[-0.7, 119.7]])).toBeNull();
    expect(
      selimutBerjarak([
        [-0.7, 119.7],
        [-0.8, 119.8],
        [-0.7, 119.7],
      ])
    ).toBeNull();
  });

  it("memuat seluruh titik desanya, dengan jarak kira-kira 1,5 km dari tiap titik tepi", () => {
    const desa: LatLon[] = [
      [-0.67, 119.74],
      [-0.7, 119.78],
      [-0.73, 119.72],
      [-0.69, 119.75],
    ];
    const s = selimutBerjarak(desa)!;
    expect(s.length).toBeGreaterThan(10);
    for (const p of desa) expect(titikDalamPoligon(p, [s]), String(p)).toBe(true);
    // Titik 1,0 km di luar desa tepi masih di dalam; 2,5 km di luarnya tidak.
    const kmDerajat = 1 / 111.32;
    expect(titikDalamPoligon([-0.73 - 1.0 * kmDerajat, 119.72], [s])).toBe(true);
    expect(titikDalamPoligon([-0.73 - 2.5 * kmDerajat, 119.72], [s])).toBe(false);
  });
});

/* ==========================================================================
 * 5. BERKAS BATAS RESMI - CONTOH GeoJSON BUATAN SENDIRI
 * ========================================================================== */

describe("berkas batas kecamatan resmi (GeoJSON)", () => {
  // Kecamatan berbentuk huruf U (cekung) - titik beratnya jatuh di LUAR.
  const bentukU: number[][] = [
    [119.7, -0.7],
    [119.8, -0.7],
    [119.8, -0.6],
    [119.77, -0.6],
    [119.77, -0.67],
    [119.73, -0.67],
    [119.73, -0.6],
    [119.7, -0.6],
    [119.7, -0.7],
  ];
  const contoh = {
    type: "FeatureCollection",
    sumber: "contoh uji",
    lisensi: "ODbL",
    dibuat: "2026-09-27",
    features: [
      { type: "Feature", properties: { kode: "72.03.08", nama: "Banawa", kabupaten: "Kabupaten Donggala" }, geometry: { type: "Polygon", coordinates: [bentukU] } },
      {
        type: "Feature",
        properties: { kode: "72.10.01", nama: "Sigi Biromaru", kabupaten: "Kabupaten Sigi" },
        geometry: {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [119.9, -1.1],
                [120.0, -1.1],
                [120.0, -0.95],
                [119.9, -0.95],
                [119.9, -1.1],
              ],
              [
                [119.94, -1.04],
                [119.96, -1.04],
                [119.96, -1.02],
                [119.94, -1.02],
                [119.94, -1.04],
              ],
            ],
            [
              [
                [120.05, -1.0],
                [120.06, -1.0],
                [120.06, -0.99],
                [120.05, -0.99],
                [120.05, -1.0],
              ],
            ],
          ],
        },
      },
      // Tidak sah: kodenya bukan kode kecamatan, dan satu lagi koordinatnya tertukar.
      { type: "Feature", properties: { kode: "72.03" }, geometry: { type: "Polygon", coordinates: [bentukU] } },
      {
        type: "Feature",
        properties: { kode: "72.71.01" },
        geometry: { type: "Polygon", coordinates: [bentukU.map(([x, y]) => [y, x])] },
      },
    ],
  };

  it("dibaca, dibalik ke [lintang, bujur], yang tidak sah dilewati DAN dihitung", () => {
    const b = bacaBatasKecamatan(contoh)!;
    expect(b.kecamatan.map((k) => k.kode)).toEqual(["72.03.08", "72.10.01"]);
    expect(b.dilewati).toBe(2);
    expect(b.kecamatan[0].bagian[0][0][0]).toEqual([-0.7, 119.7]);
    expect(b.kecamatan[1].bagian).toHaveLength(2);
    expect(b.kecamatan[1].bagian[0]).toHaveLength(2); // cincin luar + lubang
    expect(b.sumber).toBe("contoh uji");
  });

  it("titik label jatuh DI DALAM wilayahnya - juga pada kecamatan cekung dan berlubang", () => {
    const b = bacaBatasKecamatan(contoh)!;
    for (const k of b.kecamatan) {
      const terluas = k.bagian[0];
      expect(k.label, k.kode).not.toBeNull();
      expect(titikDalamPoligon(k.label!, terluas), k.kode).toBe(true);
    }
    // Pembanding: titik berat polos bentuk U memang jatuh di luar.
    const u = bacaBatasKecamatan(contoh)!.kecamatan[0].bagian;
    expect(titikLabelWilayah(u)).not.toBeNull();
  });

  it("bukan FeatureCollection -> null, supaya layar jatuh ke batas perkiraan", () => {
    expect(bacaBatasKecamatan(null)).toBeNull();
    expect(bacaBatasKecamatan({ type: "Feature" })).toBeNull();
    expect(bacaBatasKecamatan({ type: "FeatureCollection", features: [] })!.kecamatan).toHaveLength(0);
  });
});

/* ==========================================================================
 * 6. AMBANG PERBESARAN, TABRAKAN LABEL, LAYAR PENUH SEMU, INGATAN
 * ========================================================================== */

describe("ambang perbesaran lapisan kecamatan", () => {
  it("garis mulai 9, label nama+jumlah mulai 10", () => {
    expect(ZUM_GARIS_KECAMATAN).toBe(9);
    expect(ZUM_LABEL_KECAMATAN).toBe(10);
    expect(lapisanKecamatanTampil(8)).toEqual({ garis: false, label: false });
    expect(lapisanKecamatanTampil(9)).toEqual({ garis: true, label: false });
    expect(lapisanKecamatanTampil(10)).toEqual({ garis: true, label: true });
    expect(lapisanKecamatanTampil(15)).toEqual({ garis: true, label: true });
  });

  it("label bertabrakan: yang perkaranya lebih sedikit mengalah", () => {
    const boleh = pilihLabelTakBertabrakan([
      { kunci: "kecil", kiri: 10, atas: 10, lebar: 60, tinggi: 20, prioritas: 3 },
      { kunci: "besar", kiri: 30, atas: 15, lebar: 60, tinggi: 20, prioritas: 40 },
      { kunci: "jauh", kiri: 300, atas: 10, lebar: 60, tinggi: 20, prioritas: 1 },
    ]);
    expect([...boleh].sort()).toEqual(["besar", "jauh"]);
  });
});

describe("layar penuh semu - leluhur yang menahan position: fixed", () => {
  it("backdrop-filter kartu portal, transform, filter, contain, will-change, z-index", () => {
    expect(leluhurMenahanFixed({ backdropFilter: "blur(8px)" })).toBe(true);
    expect(leluhurMenahanFixed({ webkitBackdropFilter: "blur(8px)" })).toBe(true);
    expect(leluhurMenahanFixed({ transform: "matrix(1, 0, 0, 1, 0, 0)" })).toBe(true);
    expect(leluhurMenahanFixed({ filter: "blur(1px)" })).toBe(true);
    expect(leluhurMenahanFixed({ contain: "paint" })).toBe(true);
    expect(leluhurMenahanFixed({ willChange: "transform" })).toBe(true);
    expect(leluhurMenahanFixed({ position: "relative", zIndex: "10" })).toBe(true);
  });

  it("leluhur biasa tidak disentuh", () => {
    expect(
      leluhurMenahanFixed({
        transform: "none",
        filter: "none",
        backdropFilter: "none",
        perspective: "none",
        contain: "none",
        willChange: "auto",
        containerType: "normal",
        position: "relative",
        zIndex: "auto",
      })
    ).toBe(false);
    expect(leluhurMenahanFixed({ position: "static", zIndex: "5" })).toBe(false);
  });
});

describe("pilihan bulatan diingat", () => {
  beforeEach(() => window.localStorage.clear());

  it("disimpan dan dibaca kembali - golongan ATAU 'jenis'; yang tidak dikenal ditolak", () => {
    expect(bacaPilihanTersimpan()).toBeNull();
    simpanPilihan("dispensasi");
    expect(window.localStorage.getItem(KUNCI_INGAT_GOLONGAN)).toBe("dispensasi");
    expect(bacaPilihanTersimpan()).toBe("dispensasi");
    simpanPilihan(PILIHAN_JENIS);
    expect(bacaPilihanTersimpan()).toBe("jenis");
    simpanPilihan("constructor");
    expect(bacaPilihanTersimpan()).toBe("jenis");
    window.localStorage.setItem(KUNCI_INGAT_GOLONGAN, "sampah");
    expect(bacaPilihanTersimpan()).toBeNull();
  });
});

/* ==========================================================================
 * 7. TELAAH 2.40.0 - PILIHAN AWAL DAN JENIS TUNGGAL
 * ==========================================================================
 *
 *   (1) Kunjungan pertama: menu halaman "Perceraian", bulatan "Semua perkara".
 *   (2) Jenis tunggal golongan "lainnya" (Kewarisan): bulatan memuat SELURUH
 *       "lainnya", tabel hanya Kewarisan. Sebelum 2.40.0 peta menampilkan
 *       tepat jenis itu.
 */
describe("pilihan awal bulatan diturunkan dari 'Jenis perkara' halaman", () => {
  it("belum ada yang diingat: Perceraian -> cerai, jenis tunggal -> jenis itu", () => {
    expect(pilihanAwal(null, "")).toBe("cerai");
    expect(pilihanAwal(null, "Kewarisan")).toBe(PILIHAN_JENIS);
    expect(pilihanAwal("sampah", "")).toBe("cerai");
  });

  it("yang diingat menang - kecuali 'jenis' ketika halaman kembali ke gabungan (dimuat ulang)", () => {
    expect(pilihanAwal("itsbat", "")).toBe("itsbat");
    expect(pilihanAwal("semua", "Kewarisan")).toBe("semua");
    expect(pilihanAwal(PILIHAN_JENIS, "Kewarisan")).toBe(PILIHAN_JENIS);
    expect(pilihanAwal(PILIHAN_JENIS, "")).toBe("cerai");
  });

  it("pilihan yang ditulis halaman ketika 'Jenis perkara' diganti", () => {
    expect(pilihanUntukKelompok(false, "cerai")).toBe("cerai");
    expect(pilihanUntukKelompok(false, undefined)).toBe("cerai");
    expect(pilihanUntukKelompok(true, "lainnya")).toBe(PILIHAN_JENIS);
    expect(pilihanUntukKelompok(true, "itsbat")).toBe(PILIHAN_JENIS);
  });
});

describe("jenis tunggal: bulatan menghitung TEPAT jenis itu, sama dengan tabel", () => {
  const desa = {
    perkara: 9,
    lelaki: 4,
    perempuan: 5,
    jenis: { Kewarisan: 2, "Harta Bersama": 1, "Cerai Gugat": 5, "kewarisan ": 1 },
    jenisKelamin: {
      Kewarisan: { lelaki: 2, perempuan: 0 },
      "Harta Bersama": { lelaki: 0, perempuan: 1 },
      "Cerai Gugat": { lelaki: 0, perempuan: 5 },
      "kewarisan ": { lelaki: 1, perempuan: 0 },
    },
    kelas: {
      ceraiGugat: { perkara: 5, lelaki: 0, perempuan: 5 },
      lainnya: { perkara: 4, lelaki: 3, perempuan: 1, jenis: { Kewarisan: 2, "Harta Bersama": 1, "kewarisan ": 1 } },
    },
  };

  it("jenis itu saja - ejaan yang MySQL anggap sama ikut; kelaminnya dari jenis itu", () => {
    const h = hitungPilihan(desa, PILIHAN_JENIS, "Kewarisan", "lainnya");
    expect(h.perkara).toBe(3);
    expect(h.lelaki).toBe(3);
    expect(h.perempuan).toBe(0);
    expect(h.kelas).toEqual({ lainnya: 3 });
    expect(h.rincian).toEqual({ Kewarisan: 3 });
    // Golongan "lainnya" memuat Harta Bersama juga - itulah selisih yang dilaporkan.
    expect(hitungPilihan(desa, "lainnya", "Kewarisan", "lainnya").perkara).toBe(4);
  });

  it("bot tua tanpa jenisKelamin: kelamin dari desanya bila seluruh desa memang jenis itu", () => {
    const tua = { perkara: 3, lelaki: 1, perempuan: 2, jenis: { Kewarisan: 3 } };
    expect(hitungPilihan(tua, PILIHAN_JENIS, "Kewarisan", "lainnya")).toMatchObject({ perkara: 3, lelaki: 1, perempuan: 2 });
  });

  it("rekap kecamatan pada jenis tunggal - desa tanpa titik dan baris tanpa kode desa ikut", () => {
    const titik: TitikUntukRekap[] = [
      { kode: "72.03.08.1001", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", ...desa },
      { kode: "72.03.08.2099", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 2, lelaki: 0, perempuan: 2, jenis: { Kewarisan: 2 } },
    ];
    const sisa = [{ kode: "72.03.08", nama: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 4, kelas: { lainnya: 4 }, jenis: { Kewarisan: 1, Perwalian: 3 } }];
    const r = rekapKecamatan(titik, { "72.03.08.1001": [-0.66, 119.74] }, sisa, PILIHAN_JENIS, "Kewarisan").get("72.03.08")!;
    expect(r.perkara).toBe(3 + 2 + 1);
    expect(r.perkaraBertitik).toBe(3);
    expect(r.perkaraTanpaTitik).toBe(2);
    expect(r.perkaraTanpaDesa).toBe(1);
  });
});

describe("berkas batas-kecamatan.json di repo (unduhan OpenStreetMap 27 Sep 2026)", () => {
  const jalur = path.join(process.cwd(), "public/peta/batas-kecamatan.json");
  const isi = JSON.parse(readFileSync(jalur, "utf8")) as {
    dibuat?: string;
    sumber?: string;
    lisensi?: string;
    cakupan?: { catatan?: string };
    features: Array<{ properties: { kode: string; nama: string; cara?: string } }>;
  };

  it("terbaca UTUH oleh pembaca yang dipakai layar - tak satu fitur pun dilewati", () => {
    const b = bacaBatasKecamatan(isi)!;
    expect(b).not.toBeNull();
    expect(b.dilewati).toBe(0);
    expect(b.kecamatan.length).toBe(isi.features.length);
    // Satu kode, satu batas.
    expect(new Set(b.kecamatan.map((k) => k.kode)).size).toBe(b.kecamatan.length);
    for (const k of b.kecamatan) {
      expect(k.kode, k.nama).toMatch(/^72\.\d{2}\.\d{2}$/);
      expect(titikDalamPoligon(k.label!, k.bagian.reduce((a, p) => (p[0].length > a[0].length ? p : a))), k.nama).toBe(true);
    }
  });

  it("sumber, lisensi ODbL, dan tanggalnya tercatat - penyebutan sumber adalah syarat lisensinya", () => {
    expect(isi.sumber).toMatch(/OpenStreetMap/);
    expect(isi.lisensi).toMatch(/ODbL/);
    expect(isi.dibuat).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Cakupannya yang terbatas dikatakan di berkas itu sendiri.
    expect(isi.cakupan?.catatan).toMatch(/Donggala, Sigi/);
  });

  it("Kota Palu lengkap delapan kecamatan, dan pertukaran nama OSM Palu Barat/Ulujadi tidak ikut terbawa", () => {
    const palu = isi.features.filter((f) => f.properties.kode.startsWith("72.71."));
    expect(palu.map((f) => f.properties.kode).sort()).toEqual(
      ["72.71.01", "72.71.02", "72.71.03", "72.71.04", "72.71.05", "72.71.06", "72.71.07", "72.71.08"]
    );
    const ulujadi = isi.features.find((f) => f.properties.kode === "72.71.05")!;
    expect(ulujadi.properties.nama).toBe("Ulujadi");
    expect(ulujadi.properties.cara).toMatch(/^titik/);
  });

  it("kecil untuk dibawa layar", () => {
    expect(readFileSync(jalur).length).toBeLessThan(1_000_000);
  });
});

describe("berkas nyata di repo", () => {
  it("titik-desa.json berkunci kode Kemendagri empat ruas - dasar penurunan kode kecamatan", () => {
    const isi = JSON.parse(readFileSync(path.join(process.cwd(), "public/peta/titik-desa.json"), "utf8")) as {
      titik: Record<string, [number, number]>;
    };
    const kode = Object.keys(isi.titik);
    expect(kode.every((k) => kodeKecamatanDesa(k) !== null)).toBe(true);
    const kecamatan = new Set(kode.map((k) => kodeKecamatanDesa(k)));
    // 221 kecamatan; hanya yang bertitik >= 3 yang mendapat garis perkiraan.
    expect(kecamatan.size).toBeGreaterThan(100);
  });
});
