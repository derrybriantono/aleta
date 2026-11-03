// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KASIR 3 NOV 2026 (23.00): TARIF PANGGILAN/PEMBERITAHUAN PER WILAYAH
 * ============================================================================
 *
 * Keputusan Derry atas analisis BIAYAALAMAT: "Saya sepakat semua, asal buat
 * lebih simpel tampilannya, yang kurang menambah pekerjaan dalam Kasir ALETA."
 *
 *   1. belajar HANYA dari baris sejak tanggal berlaku (bawaan 28 Okt 2024)
 *   2. kunci wilayah = KODE kecamatan SIPP, bukan teks alamat
 *   3. pihak sama -> kecamatan (>=3, >=80%) -> tabel kecamatan -> kabupaten
 *      (>=5, >=80%) -> tabel (Donggala 14.500, Kec. Labuan 29.500, Sigi/Palu/
 *      Sulteng 29.500, Banggai 38.500, RRI 200.000) -> kosong
 *   4. satu tarif untuk semua jenis panggilan/pemberitahuan pihak yang sama
 *   5. "pasti" (pihak sama / kecamatan >=10 & >=90%) vs "periksa"; peringatan
 *      lunak bila nominal berbeda atau tarif lama 14.000/29.000
 *   + tawaran "tarif baru sejak X?" bila >=5 baris terbaru berturut-turut
 *   + Kasir otomatis memakai aturan yang sama (satu sumber: susunUsulan)
 *
 * Data REKAAN (tanpa nama, alamat, atau nomor pihak sungguhan).
 */

const AKAR = path.resolve(process.cwd(), "..");
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const TA = requireBot(path.join(AKAR, "aleta_bot/services/kasirTarifAlamat.js"));
const kasir = requireBot(path.join(AKAR, "aleta_bot/services/kasirJurnalService.js"));
const otomatis = requireBot(path.join(AKAR, "aleta_bot/services/kasirOtomatisService.js"));

type Baris = Record<string, any>;
const P = 701;
const T = 702;
const DONGGALA = "72.03";
const BANAWA = "72.03.08";
const LABUAN = "72.03.09";
const SIGI = "72.10";
const BIROMARU = "72.10.01";

/** n baris jurnal satker rekaan (bentuk kueri tarif: kecamatan, kabupaten, jumlah, tanggal, rri, khusus, n). */
const rek = (kecamatan: string, jumlah: number, n: number, tanggal = "2026-06-01", lain: Baris = {}) => ({
  kecamatan, kabupaten: kecamatan.slice(0, 5), jumlah, tanggal, rri: 0, khusus: 0, n, ...lain,
});
const bahan = (baris: Baris[], pihak: Baris[], setelan: Baris | null = null) =>
  TA.bahanTarif(TA.pelajari(baris, setelan), setelan, pihak, {});
const pihakDi = (kecamatan: string, pihakId = T) => ({ pihakId, kecamatan, kabupaten: kecamatan.slice(0, 5) });

describe("urutan saran tarif", () => {
  const satker = [rek(BANAWA, 14500, 40), rek(LABUAN, 29500, 2), rek(LABUAN, 14500, 1), rek("72.03.10", 14500, 20), rek(BIROMARU, 29500, 30)];

  it("pihak yang sama di perkara itu menang atas wilayah - keyakinan pasti", () => {
    const p = pihakDi(BANAWA);
    const jurnal = [{ pihakId: T, jenisBiayaId: 14, uraian: "Biaya Panggilan Tergugat/P2610010000001", jumlah: 29500, tanggal: "2026-10-01" }];
    const s = TA.saranTarifPihak(p, jurnal, bahan(satker, [p]));
    expect([s.jumlah, s.tarif.tingkat, s.tarif.yakin, s.kira]).toEqual([29500, "pihak", "pasti", false]);
  });

  it("kecamatan >= 3 contoh & >= 80% sama; >= 10 & >= 90% = pasti, selain itu periksa", () => {
    const p = pihakDi(BANAWA);
    const s = TA.saranTarifPihak(p, [], bahan(satker, [p]));
    expect([s.jumlah, s.tarif.tingkat, s.tarif.yakin]).toEqual([14500, "kecamatan", "pasti"]);
    expect(s.tarif.ket).toBe("tarif wilayah 72.03.08 sejak 28 Okt 2024, 40 contoh");
    const sedikit = [rek(BANAWA, 14500, 4)];
    const s2 = TA.saranTarifPihak(p, [], bahan(sedikit, [p]));
    expect([s2.jumlah, s2.tarif.yakin, s2.kira]).toEqual([14500, "periksa", false]);
    // 2 contoh: kecamatan tidak lolos -> tabel kabupaten Donggala (perkiraan)
    const s3 = TA.saranTarifPihak(p, [], bahan([rek(BANAWA, 14500, 2)], [p]));
    expect([s3.jumlah, s3.tarif.tingkat, s3.kira]).toEqual([14500, "tabel", true]);
  });

  it("Kec. Labuan 29.500 walau kabupaten Donggala 14.500 dan contoh Labuan sedikit (tabel kecamatan > kabupaten)", () => {
    const p = pihakDi(LABUAN);
    const b = bahan(satker, [p]);
    expect(b.kabupaten[DONGGALA]).toBe(14500);
    const s = TA.saranTarifPihak(p, [], b);
    expect([s.jumlah, s.tarif.tingkat, s.tarif.wilayah, s.tarif.yakin]).toEqual([29500, "tabel", "Kec. Labuan", "periksa"]);
    // Labuan dengan contoh cukup -> kecamatan yang dipelajari
    const s2 = TA.saranTarifPihak(p, [], bahan([...satker, rek(LABUAN, 29500, 12)], [p]));
    expect([s2.jumlah, s2.tarif.tingkat, s2.tarif.yakin]).toEqual([29500, "kecamatan", "pasti"]);
  });

  it("kecamatan baru tanpa contoh -> kabupaten (>= 5, >= 80%) -> tabel -> provinsi -> kosong", () => {
    const sigiBaru = pihakDi("72.10.15");
    const s = TA.saranTarifPihak(sigiBaru, [], bahan(satker, [sigiBaru]));
    expect([s.jumlah, s.tarif.tingkat, s.tarif.yakin, s.kira]).toEqual([29500, "kabupaten", "periksa", true]);
    const banggai = pihakDi("72.01.06");
    expect(TA.saranTarifPihak(banggai, [], bahan(satker, [banggai])).jumlah).toBe(38500);
    const poso = pihakDi("72.02.01");
    const sp = TA.saranTarifPihak(poso, [], bahan(satker, [poso]));
    expect([sp.jumlah, sp.tarif.wilayah]).toEqual([29500, "Sulawesi Tengah"]);
    const luar = pihakDi("32.73.12");
    const sl = TA.saranTarifPihak(luar, [], bahan(satker, [luar]));
    expect([sl.jumlah, sl.tarif.tingkat]).toEqual([null, "kosong"]);
  });

  it("tabel bawaan sesuai keputusan: Donggala 14.500, Labuan 29.500, Sigi/Palu 29.500, Sulteng 29.500, Banggai 38.500, RRI 200.000", () => {
    expect(TA.TARIF_BAWAAN).toEqual({ "72.03.09": 29500, "72.03": 14500, "72.10": 29500, "72.71": 29500, "72.01": 38500, 72: 29500, rri: 200000 });
    expect(TA.TANGGAL_BERLAKU_BAWAAN).toBe("2024-10-28");
  });
});

describe("tanggal berlaku & kode kecamatan", () => {
  it("baris sebelum tanggal berlaku TIDAK dipelajari (era radius)", () => {
    const p = pihakDi(BANAWA);
    const radius = [rek(BANAWA, 100000, 50, "2024-06-01"), rek(BANAWA, 14500, 3, "2025-02-01")];
    const s = TA.saranTarifPihak(p, [], bahan(radius, [p]));
    expect([s.jumlah, s.tarif.tingkat]).toEqual([14500, "kecamatan"]);
    // tanggal berlaku digeser ke 2025-03-01: tiga baris 2025-02 pun tidak dipakai -> tabel
    const s2 = TA.saranTarifPihak(p, [], bahan(radius, [p], { berlaku: "2025-03-01" }));
    expect([s2.jumlah, s2.tarif.tingkat]).toEqual([14500, "tabel"]);
    // baris pihak sendiri sebelum tanggal berlaku juga tidak dipakai
    const jurnal = [{ pihakId: T, jenisBiayaId: 14, uraian: "Biaya Panggilan Tergugat", jumlah: 150000, tanggal: "2024-09-01" }];
    expect(TA.saranTarifPihak(p, jurnal, bahan(radius, [p])).tarif.tingkat).toBe("kecamatan");
  });

  it("kunci = kode kecamatan SIPP; teks alamat bukan kunci, kabupaten diturunkan dari kode kecamatan", () => {
    expect(TA.kodeKecamatan("72.03.09")).toBe("72.03.09");
    expect(TA.kodeKecamatan("Labuan")).toBe("");
    expect(TA.kodeKecamatan("Jl. Rekaan No. 1 Desa Rekaan")).toBe("");
    expect(TA.kodeKabupaten("", "72.10.01")).toBe("72.10");
    const b = TA.pelajari([{ kecamatan: "Labuan", kabupaten: "Donggala", jumlah: 99000, n: 20, tanggal: "2026-01-01" }], null);
    expect(b.kecamatan).toEqual({});
    expect(b.kabupaten).toEqual({});
    const p = { pihakId: T, kecamatan: "72.10.01", kabupaten: "" };
    expect(TA.saranTarifPihak(p, [], bahan([rek(BIROMARU, 29500, 15)], [p])).jumlah).toBe(29500);
  });

  it("PEMDA, delegasi/tabayun TIDAK dipelajari; RRI dipelajari terpisah", () => {
    const b = TA.pelajari([
      rek(BANAWA, 14500, 3),
      rek(BANAWA, 158000, 9, "2026-06-01", { uraian: "Biaya Panggilan Tergugat/PA.Palu" }),
      rek(BANAWA, 29500, 9, "2026-06-01", { khusus: 1 }),
      rek(BANAWA, 200000, 4, "2026-06-01", { rri: 1, khusus: 1 }),
    ], null);
    expect(b.kecamatan[BANAWA]).toMatchObject({ nilai: 14500, total: 3 });
    expect(b.rri).toMatchObject({ nilai: 200000, total: 4 });
  });

  it("setelan ringkas muat di kolom 300 huruf dan dibaca kembali utuh", () => {
    const s = TA.setelanSah({ berlaku: "2024-10-28", tarif: { "72.10": 31500, "72.07": 43500 }, sejak: { "72.10": "2026-10-01" }, tolak: { "72.03": 15000 } });
    const teks = TA.setelanRingkas(s);
    expect(teks.length).toBeLessThanOrEqual(300);
    expect(TA.setelanSah(JSON.parse(teks))).toMatchObject({ berlaku: "2024-10-28", tarif: { "72.10": 31500, "72.07": 43500 }, sejak: { "72.10": "2026-10-01" }, tolak: { "72.03": 15000 } });
    expect(TA.setelanSah({ berlaku: "kemarin", tarif: { "x'; DROP": 1 } })).toMatchObject({ berlaku: "2024-10-28", tarif: {} });
  });
});

describe("tawaran tarif baru (satu kabar, bukan per baris)", () => {
  const lama = [rek(BIROMARU, 29500, 30, "2026-08-01")];
  it(">= 5 baris terbaru berturut-turut bernilai baru yang sama di satu kabupaten -> tawaran sejak baris pertama", () => {
    const baru = [...lama, rek(BIROMARU, 31500, 2, "2026-10-01"), rek("72.10.02", 31500, 3, "2026-10-08")];
    const t = TA.deteksiTarifBaru(baru, null, { "72.10": "Kabupaten Sigi" });
    expect(t).toEqual([{ kabupaten: SIGI, nama: "Kab. Sigi", nilai: 31500, lama: 29500, sejak: "2026-10-01", contoh: 5 }]);
  });
  it("4 baris belum cukup; baris tarif tabel yang menyela memutus urutan; tarif lama 14.000 tidak ditawarkan", () => {
    expect(TA.deteksiTarifBaru([...lama, rek(BIROMARU, 31500, 4, "2026-10-01")], null)).toEqual([]);
    expect(TA.deteksiTarifBaru([...lama, rek(BIROMARU, 31500, 3, "2026-10-01"), rek(BIROMARU, 29500, 1, "2026-10-05"), rek(BIROMARU, 31500, 2, "2026-10-09")], null)).toEqual([]);
    expect(TA.deteksiTarifBaru([rek(BANAWA, 14000, 8, "2026-10-01")], null)).toEqual([]);
    // Labuan 29.500 di Kab. Donggala BUKAN tarif baru (tabel kecamatan)
    expect(TA.deteksiTarifBaru([rek(BANAWA, 14500, 9, "2026-09-01"), rek(LABUAN, 29500, 7, "2026-10-01")], null)).toEqual([]);
  });
  it("Tidak -> tidak ditawarkan lagi; Ya -> tabel kabupaten = nilai baru dan belajar hanya sejak tanggal itu", () => {
    const baru = [...lama, rek(BIROMARU, 31500, 6, "2026-10-01")];
    const [tw] = TA.deteksiTarifBaru(baru, null);
    expect(TA.deteksiTarifBaru(baru, TA.tolakTarifBaru(null, tw))).toEqual([]);
    const terima = TA.terimaTarifBaru(null, tw);
    expect(terima).toMatchObject({ tarif: { "72.10": 31500 }, sejak: { "72.10": "2026-10-01" } });
    expect(TA.deteksiTarifBaru(baru, terima)).toEqual([]);
    const p = pihakDi(BIROMARU);
    const s = TA.saranTarifPihak(p, [], bahan(baru, [p], terima));
    expect([s.jumlah, s.tarif.tingkat]).toEqual([31500, "kecamatan"]);
    expect(TA.saranTarifPihak(pihakDi("72.10.15"), [], bahan(baru, [pihakDi("72.10.15")], terima)).jumlah).toBe(31500);
  });
});

describe("peringatan lunak (tidak menahan simpan)", () => {
  const labuan = { nilai: 29500, yakin: "periksa", tingkat: "tabel", wilayah: "Kec. Labuan", ket: "" };
  it("nominal berbeda -> satu baris + pakai; sama -> tidak ada; tarif lama -> disebut tarif lama", () => {
    expect(TA.peringatanNominal(14500, labuan)).toEqual({ teks: "Tarif Kec. Labuan biasanya Rp29.500", pakai: 29500 });
    expect(TA.peringatanNominal(29500, labuan)).toBeNull();
    expect(TA.peringatanNominal(29000, labuan)).toEqual({ teks: "Tarif lama - Kec. Labuan Rp29.500", pakai: 29500 });
    expect(TA.peringatanNominal(14000, null)).toEqual({ teks: "Rp14.000 tarif lama (sebelum 28 Okt 2024)", pakai: null });
    expect(TA.peringatanNominal(null, labuan)).toBeNull();
  });

  it("padanan ekstensi (basmassal peringatanTarif) = bot peringatanNominal", () => {
    const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/basmassal.js"), "utf8");
    const m = /const TARIF_LAMA_KASIR = [^\n]+\n\s+function peringatanTarif\([\s\S]+?\n {2}\}\n/.exec(sumber);
    expect(m).not.toBeNull();
    const titik = (n: number) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const fn = new Function("titik", `${m![0]}; return peringatanTarif;`)(titik);
    for (const [n, t] of [[14500, labuan], [29500, labuan], [29000, labuan], [14000, null], [0, labuan], [200000, { ...labuan, tingkat: "rri", nilai: 150000 }]] as const) {
      expect(fn(n, t)).toEqual(TA.peringatanNominal(n, t));
    }
  });
});

// ─── Mesin usulan (susunUsulan) & Kasir otomatis: satu sumber ───────────────

const JENIS: Array<[number, string, number, number, number]> = [
  [1, "Panjar Biaya Perkara", 1, 1, 0],
  [14, "Biaya Panggilan Tergugat/Terlawan/Pelawan/Iklan/Radio/Pengumuman", 4, -1, 0],
  [29, "Biaya Pemberitahuan/Penyampaian Putusan/Iklan", 6, -1, 0],
  [61, "Biaya Pendaftaran/PNBP", 11, -1, 30000],
  [151, "Pengembalian Sisa Panjar", 2, -1, 0],
  [152, "Meterai", 8, -1, 10000],
  [155, "Biaya Pemberkasan/ATK", 12, -1, 100000],
  [157, "Redaksi", 13, -1, 10000],
  [236, "PNBP Relaas Panggilan Pertama Kepada Penggugat/Pelawan/Pembantah", 11, -1, 10000],
  [237, "PNBP Relaas Panggilan Pertama Kepada Tergugat/Terlawan/Pelawan", 11, -1, 10000],
  [381, "Biaya Panggilan Mediasi Tergugat", 4, -1, 0],
  [389, "PNBP Relaas Pemberitahuan Putusan Kepada Tergugat", 11, -1, 10000],
];
const jenisBiaya = Object.fromEntries(JENIS.map(([id, nama, kategoriId, jenisTransaksi, jumlahBawaan]) => [id, { id, nama, kategoriId, kategori: "", jenisTransaksi, jumlahBawaan }]));
const jb = (id: number) => JENIS.find((x) => x[0] === id)!;
const baris = (id: number, j: number, tanggal: string, uraian: string, jumlah: number, pihakKe: number | null, pihakId: number | null, urutan = 0) => ({
  id, jenisBiayaId: j, kategoriId: jb(j)[2], jenisTransaksi: jb(j)[3], pihakId, pihakKe, urutan, tanggal, uraian, jumlah, keterangan: "", pembiayaan: 1,
});

/** Verstek 15 Okt: Tergugat dipanggil Pos sekali (relaas tercatat), tidak pernah hadir. */
function keadaan(kecT: string, opsi: { jurnalT?: Baris[]; tarif?: Baris; ketRelaas?: string } = {}): Baris {
  const pihak = [
    { id: 1, ke: 1, urutan: 1, pihakId: P, nama: "Penggugat Rekaan", kecamatan: BANAWA, kabupaten: DONGGALA },
    { id: 2, ke: 2, urutan: 1, pihakId: T, nama: "Tergugat Rekaan", kecamatan: kecT, kabupaten: kecT.slice(0, 5) },
  ];
  const k: Baris = {
    perkara: { perkaraId: 9101, nomorPerkara: "911/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 347, jenisPerkaraNama: "Cerai Gugat", tanggalDaftar: "2026-09-15", penetapanHariSidang: "2026-09-16" },
    hariIni: "2026-10-15",
    pembiayaan: 1,
    jurnal: [
      baris(1, 1, "2026-09-15", "Panjar Biaya Perkara", 600000, null, null, 1),
      baris(2, 61, "2026-09-15", "Biaya Pendaftaran/PNBP", 30000, null, null, 2),
      baris(3, 155, "2026-09-15", "Biaya Pemberkasan/ATK", 100000, null, null, 3),
      baris(4, 236, "2026-09-22", "PNBP Relaas Panggilan Pertama Kepada Penggugat", 10000, 1, P),
      baris(6, 237, "2026-09-22", "PNBP Relaas Panggilan Pertama Kepada Tergugat", 10000, 2, T),
      ...(opsi.jurnalT || []),
    ],
    pihak,
    jurusita: [{ jurusitaId: 7, nama: "Juru Sita Rekaan" }],
    sidang: [{ id: 11, urutan: 1, tanggal: "2026-10-15", dihadiriOleh: 2, ikrar: false, ditunda: false, hasil: "putus DIKABULKAN (verstek)", agenda: "Sidang Pertama" }],
    relaas: [
      { id: 21, sidangId: 11, pihakId: P, ket: "E", resi: "", tanggalRelaas: "2026-09-18", tanggalJursitPos: "" },
      { id: 22, sidangId: 11, pihakId: T, ket: opsi.ketRelaas || "S", resi: opsi.ketRelaas === "R" ? "" : "P2609190002222", tanggalRelaas: "2026-09-23", tanggalJursitPos: "2026-09-19" },
    ],
    putusan: { tanggal: "2026-10-15", statusId: 62, statusNama: "Dikabulkan", verstek: "Y" },
    pemberitahuan: [],
    ikrar: null,
    jenisBiaya,
  };
  k.tarif = opsi.tarif || { ...bahan([rek(BANAWA, 14500, 40), rek(BIROMARU, 29500, 30)], pihak), lazim: {}, nomorPemohon: null };
  return k;
}
const tarifBaris = (h: Baris, jenis: number) => h.usulan.filter((u: Baris) => u.jenisBiayaId === jenis);

describe("mesin usulan memakai aturan tunggal", () => {
  it("SATU tarif untuk semua jenis: panggilan & pemberitahuan pihak yang sama bernominal sama, usulan membawa tanda tarif", () => {
    const h = kasir.susunUsulan(keadaan(LABUAN));
    const [panggil] = tarifBaris(h, 14);
    const [pbt] = tarifBaris(h, 29);
    expect([panggil.jumlah, pbt.jumlah]).toEqual([29500, 29500]);
    expect(pbt.tarif).toMatchObject({ nilai: 29500, yakin: "periksa", wilayah: "Kec. Labuan", tingkat: "tabel" });
    expect(pbt.yakin).toBe("sedang"); // tabel = perkiraan
    // panggilan mediasi (jb 381) pihak itu menjadi tarif pihak - pemberitahuan mengikutinya (pasti)
    const h2 = kasir.susunUsulan(keadaan(LABUAN, { jurnalT: [baris(5, 381, "2026-09-22", "Biaya Panggilan Mediasi Tergugat/P2609190002222", 34500, 2, T)] }));
    const [pbt2] = tarifBaris(h2, 29);
    expect([pbt2.jumlah, pbt2.tarif.yakin, pbt2.yakin]).toEqual([34500, "pasti", "tinggi"]);
  });

  it("kecamatan pasti -> usulan yakin tinggi; RRI memakai tabel 200.000 bila belum dipelajari", () => {
    const h = kasir.susunUsulan(keadaan(BIROMARU));
    const [pbt] = tarifBaris(h, 29);
    expect([pbt.jumlah, pbt.tarif.yakin, pbt.yakin]).toEqual([29500, "pasti", "tinggi"]);
    const r = kasir.susunUsulan(keadaan(BIROMARU, { ketRelaas: "R" }));
    const [rri] = tarifBaris(r, 14);
    expect([rri.uraian, rri.jumlah, rri.tarif.tingkat]).toEqual(["Biaya Panggilan Tergugat/RRI", 200000, "rri"]);
  });

  it("bentuk tarif lama (tanpa tabel) tetap: tarif tak diketahui = kosong, bukan nol", () => {
    const k = keadaan("32.73.12", { tarif: { kecamatan: {}, kabupaten: {}, rri: 200000, lazim: {}, nomorPemohon: null } });
    const [pbt] = tarifBaris(kasir.susunUsulan(k), 29);
    expect(pbt.jumlah).toBeNull();
  });

  it("Kasir otomatis = mesin yang sama: biaya pemberitahuan pasti ditulis, tabel (periksa) dilewati", () => {
    const butir = ["redaksi", "meterai", "pnbp-pbt", "biaya-pbt", "psp"];
    const pasti = otomatis.rencanaOtomatis(keadaan(BIROMARU), { butir });
    const kirim = pasti.kirim.find((u: Baris) => u.jenisBiayaId === 29);
    expect(kirim.jumlah).toBe(tarifBaris(kasir.susunUsulan(keadaan(BIROMARU)), 29)[0].jumlah);
    const periksa = otomatis.rencanaOtomatis(keadaan(LABUAN), { butir });
    expect(periksa.kirim.find((u: Baris) => u.jenisBiayaId === 29)).toBeUndefined();
    const b = periksa.butir.find((x: Baris) => x.kunci === "biaya-pbt");
    expect(b.baris[0]).toMatchObject({ status: "dilewati", jumlah: 29500 });
  });
});

describe("bacaan bot: kueri sejak tanggal berlaku, setelan baris id 2, tawaran di Kasir Manual", () => {
  it("muatTarif: kueri tarif bertanggal berlaku setelan, nama wilayah dari ref SIPP, tawaran dari baris terbaru", async () => {
    const rekaman: Array<{ sql: string; params: unknown[] }> = [];
    const kueri = async (sql: string, params: unknown[] = []) => {
      rekaman.push({ sql, params });
      const s = sql.replace(/\s+/g, " ");
      if (/JOIN pihak ph ON ph\.id = pb\.pihak_id/.test(s)) return [rek(BIROMARU, 29500, 20, "2026-08-01"), rek(BIROMARU, 31500, 5, "2026-10-20"), rek(BANAWA, 14500, 12, "2026-09-01")];
      if (/FROM ref_kecamatan_new/.test(s)) return [{ kode: BIROMARU, nama: "Sigi Biromaru" }, { kode: LABUAN, nama: "Labuan" }];
      if (/FROM ref_kabupaten_new/.test(s)) return [{ kode: SIGI, nama: "Kabupaten Sigi" }];
      if (/REGEXP 'Pemohon/.test(s)) return [{ bernomor: 0, polos: 0 }];
      return [];
    };
    const layanan = kasir.buatLayanan({ kueri, setelanTarif: async () => ({ b: "2025-01-01" }) });
    const t = await layanan.muatTarif({ hariIni: "2026-11-03", perkara: { alurPerkaraId: 15 }, pihak: [pihakDi(BIROMARU)] });
    const q = rekaman.find((r) => /JOIN pihak ph ON ph\.id = pb\.pihak_id/.test(r.sql))!;
    expect(q.params).toEqual(["2025-01-01"]);
    expect(q.sql).toMatch(/IN \(12,13,14,15,29,307,308,378,379,380,381\)/);
    expect(t.kecamatan[BIROMARU]).toBe(29500);
    expect(t.nama[BIROMARU]).toBe("Sigi Biromaru");
    const s = TA.saranTarifPihak(pihakDi(BIROMARU), [], t);
    expect(s.tarif.ket).toBe("tarif Kec. Sigi Biromaru sejak 1 Jan 2025, 25 contoh");
    const satker = await layanan.tarifSatker("2026-11-03");
    expect(satker.tawaran).toEqual([{ kabupaten: SIGI, nama: "Kab. Sigi", nilai: 31500, lama: 29500, sejak: "2026-10-20", contoh: 5 }]);
    expect(satker.tabel.find((r: Baris) => r.kode === LABUAN)).toMatchObject({ nama: "Kec. Labuan", nilai: 29500, bawaan: true });
  });

  it("setelan tarif disimpan di tabel setelan Kasir yang ada (baris id 2), tanpa menyentuh saklar (id 1)", async () => {
    const tersimpan: Record<number, Baris> = {};
    const kueriAleta = async (sql: string, params: unknown[] = []) => {
      const s = sql.replace(/\s+/g, " ");
      if (/^ ?CREATE TABLE/.test(s)) return [];
      if (/INSERT INTO aleta_bot_kasir_otomatis/.test(s)) {
        expect(s).toMatch(/VALUES \(2, 0, \?, \?, UTC_TIMESTAMP\(\)\)/);
        tersimpan[2] = { butir: params[0], diubahOleh: params[1], diubah: "2026-11-03 23:30:00" };
        return [];
      }
      if (/WHERE id = 2/.test(s)) return tersimpan[2] ? [tersimpan[2]] : [];
      if (/WHERE id = 1/.test(s)) return [];
      return [];
    };
    const l = otomatis.buatLayanan({ kueriAleta, kueri: async () => [], jurnal: {} });
    expect((await l.bacaSetelanTarif()).berlaku).toBe("2024-10-28");
    const h = await l.simpanSetelanTarif({ aksi: "setelan", berlaku: "2024-11-01", tarif: { "72.07": 43500, "72.03": 14500 }, operator: "Admin Rekaan" });
    expect(h.ok).toBe(true);
    expect(h.setelan).toMatchObject({ berlaku: "2024-11-01", tarif: { "72.07": 43500 }, diubahOleh: "Admin Rekaan" });
    expect(String(tersimpan[2].butir).length).toBeLessThanOrEqual(300);
    const t = await l.simpanSetelanTarif({ aksi: "terima", tawaran: { kabupaten: "72.10", nilai: 31500, sejak: "2026-10-20" }, operator: "Kasir Rekaan" });
    expect(t.setelan).toMatchObject({ tarif: { "72.07": 43500, "72.10": 31500 }, sejak: { "72.10": "2026-10-20" } });
    expect((await l.simpanSetelanTarif({ aksi: "setelan", berlaku: "bukan tanggal", operator: "x" })).ok).toBe(false);
    expect((await l.simpanSetelanTarif({ aksi: "terima", tawaran: {} })).ok).toBe(false);
  });
});

describe("tampilan simpel (penjaga sumber)", () => {
  const js = readFileSync(path.join(AKAR, "ekstensi-sipp/basmassal.js"), "utf8");
  const css = readFileSync(path.join(AKAR, "ekstensi-sipp/panel.css"), "utf8");
  it("tanda tarif terpasang di kedua tabel Kasir (Manual & per perkara), tanpa tombol terima saran", () => {
    expect(js.match(/= pasangTandaTarif\(u, /g)?.length).toBe(2);
    expect(js).toMatch(/kotak\.setAttribute\("data-kasir-tarif", t\.yakin === "pasti" \? "pasti" : "periksa"\)/);
    expect(js).not.toMatch(/Terima saran|Pakai saran tarif/);
    expect(js).toMatch(/gambarTawaranTarif\(tarifWadah, isiJawab\.bolehJawabTarif === true/);
    expect(js).toMatch(/subTarif\.d\.hidden = j\.bolehAturTarif !== true/);
  });
  it("aturan CSS baru bertoken, huruf berskala >= 11.5px, tidak di akhir panel.css", () => {
    const i = css.indexOf(".aleta-kasir-tarif-saran {");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(css.length * 0.9);
    const blok = css.slice(css.indexOf("/* 3 Nov 2026 (tarif wilayah)"), css.indexOf(".aleta-kasir-tabel-tarif .aleta-kasir-nominal"));
    expect(blok).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    for (const m of blok.matchAll(/font-size:\s*([^;]+);/g)) expect(m[1]).toMatch(/^calc\((1[2-9]|11\.5)px \* var\(--aleta-skala-huruf, 1\)\)$/);
  });
});
