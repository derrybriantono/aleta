// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bolehKasir, hitungSisaOtomatis, periksaBarisKasir, saldoJurnal, susunTampilan, type UsulanJurnal } from "@/lib/kasir-jurnal";

/**
 * ============================================================================
 * KASIR - JURNAL KEUANGAN PERKARA DARI JADWAL SIDANG (6 Okt 2026)
 * ============================================================================
 *
 *   MESIN USULAN   atas perkara SUNGGUHAN yang dianonimkan - 580/Pdt.G/2026
 *                  (contoh pengguna, dibaca baca-saja dari peladen), pola
 *                  510/2026 (verstek, putusan belum diinput), cerai talak
 *                  dengan ikrar, Pdt.P dua pemohon. Usulan harus SAMA dengan
 *                  yang ditulis kasir: jenis, uraian, pihak, jumlah, urutan,
 *                  sisa panjar yang menghabiskan saldo.
 *   TIDAK GANDA    jurnal yang sudah lengkap -> nol usulan; separuh -> hanya
 *                  sisanya; resi salah ketik tetap menutup panggilannya.
 *   BENTUK SIPP    INSERT perkara_biaya berkolom & berurutan validateInput,
 *                  id MAX+1, urutan 0, sisa 0, keterangan ''; sys_audittrail
 *                  formname 'Add Mediasi' + judul "Tambah Data Biaya" +
 *                  fetch_description; juru sita hanya kategori 4/5/6; jam
 *                  NOW() SESUDAH jeda; tanpa kata ALETA.
 *   KERING         tanpa kering:false tegas - nol tulisan.
 *   PAGAR          tanggal Sabtu, melebihi hari ini, sebelum pendaftaran,
 *                  melebihi panjar, Panjar awal, pihak asing - ditolak.
 */

const AKAR = path.resolve(process.cwd(), "..");
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const kasir =requireBot(path.join(AKAR, "aleta_bot/services/kasirJurnalService.js"));

// ─── Rujukan jenis biaya alur 15 (Pdt.G) - sebagian, dari sipp_donggala ──────
const JENIS_15 = [
  [1, "Panjar Biaya Perkara", 1, 1, 0],
  [14, "Biaya Panggilan Tergugat/Terlawan/Pelawan/Iklan/Radio/Pengumuman", 4, -1, 0],
  [29, "Biaya Pemberitahuan/Penyampaian Putusan/Iklan", 6, -1, 0],
  [61, "Biaya Pendaftaran/PNBP", 11, -1, 30000],
  [151, "Pengembalian Sisa Panjar", 2, -1, 0],
  [152, "Meterai", 8, -1, 10000],
  [155, "Biaya Pemberkasan/ATK", 12, -1, 100000],
  [157, "Redaksi", 13, -1, 10000],
  [224, "Tambahan Panjar Biaya Perkara", 1, 1, 0],
  [236, "PNBP Relaas Panggilan Pertama Kepada Penggugat/Pelawan/Pembantah", 11, -1, 10000],
  [237, "PNBP Relaas Panggilan Pertama Kepada Tergugat/Terlawan/Pelawan", 11, -1, 10000],
  [253, "PNBP Relaas Panggilan Pertama Pemohon", 11, -1, 10000],
  [260, "PNBP Relaas Pemberitahuan Putusan Kepada Penggugat/Pelawan/Pembantah", 11, -1, 10000],
  [389, "PNBP Relaas Pemberitahuan Putusan Kepada Tergugat/Terlawan/Terbantah", 11, -1, 10000],
  [404, "PNBP Surat Permohonan Pencabutan Perkara", 11, -1, 10000],
] as const;

function petaJenis() {
  const hasil: Record<number, unknown> = {};
  for (const [id, nama, kategoriId, jenisTransaksi, jumlahBawaan] of JENIS_15) {
    hasil[id] = { id, nama, kategoriId, kategori: "", jenisTransaksi, jumlahBawaan };
  }
  return hasil;
}

type Jurnal = {
  id: number;
  jenisBiayaId: number;
  kategoriId: number;
  jenisTransaksi: number;
  pihakId: number | null;
  pihakKe: number | null;
  urutan: number;
  tanggal: string;
  uraian: string;
  jumlah: number;
  keterangan: string;
  pembiayaan: number;
};

function baris(id: number, jb: number, tanggal: string, uraian: string, jumlah: number, pihakKe: number | null, pihakId: number | null, urutan = 0): Jurnal {
  const j = JENIS_15.find((x) => x[0] === jb)!;
  return { id, jenisBiayaId: jb, kategoriId: j[2], jenisTransaksi: j[3], pihakId, pihakKe, urutan, tanggal, uraian, jumlah, keterangan: "", pembiayaan: 1 };
}

// ─── 580/Pdt.G/2026/PA.Dgl - dibaca dari peladen 6 Okt 2026, nama diganti ────
const P = 36495; // Penggugat
const T = 36496; // Tergugat
const PENDAFTARAN_580 = [
  baris(100884, 1, "2026-09-15", "Panjar Biaya Perkara", 355000, null, null, 1),
  baris(100885, 61, "2026-09-15", "Biaya Pendaftaran/PNBP", 30000, null, null, 2),
  baris(100886, 155, "2026-09-15", "Biaya Pemberkasan/ATK", 100000, null, null, 3),
];
const KASIR_580 = [
  baris(101200, 236, "2026-09-22", "PNBP Relaas Panggilan Pertama Kepada Penggugat", 10000, 1, P),
  baris(101201, 14, "2026-09-22", "Biaya Panggilan Tergugat/P2609190002831", 29500, 2, T),
  baris(101202, 237, "2026-09-22", "PNBP Relaas Panggilan Pertama Kepada Tergugat", 10000, 2, T),
  baris(101494, 157, "2026-10-01", "Redaksi", 10000, 1, P),
  baris(101495, 152, "2026-10-01", "Meterai", 10000, 1, P),
  baris(101496, 404, "2026-10-01", "PNBP Surat Permohonan Pencabutan Perkara", 10000, 1, P),
  baris(101497, 151, "2026-10-01", "Pengembalian Sisa Panjar", 145500, 1, P),
];

function keadaan580(jurnal: Jurnal[], hariIni = "2026-10-01") {
  return {
    perkara: {
      perkaraId: 10132,
      nomorPerkara: "580/Pdt.G/2026/PA.Dgl",
      alurPerkaraId: 15,
      jenisPerkaraId: 347,
      jenisPerkaraNama: "Cerai Gugat",
      tanggalDaftar: "2026-09-15",
      penetapanHariSidang: "2026-09-16",
    },
    hariIni,
    pembiayaan: 1,
    jurnal: jurnal.map((b) => ({ ...b })),
    pihak: [
      { id: 6301, ke: 1, urutan: 1, pihakId: P, nama: "Penggugat Anonim", kecamatan: "72.71.01", kabupaten: "72.71" },
      { id: 6302, ke: 2, urutan: 1, pihakId: T, nama: "Tergugat Anonim", kecamatan: "72.71.01", kabupaten: "72.71" },
    ],
    jurusita: [{ jurusitaId: 22, nama: "Juru Sita Anonim" }],
    sidang: [{ id: 20147, urutan: 1, tanggal: "2026-10-01", dihadiriOleh: 2, ikrar: false, ditunda: false, hasil: "putus DICABUT", agenda: "Sidang Pertama" }],
    relaas: [
      { id: 14568, sidangId: 20147, pihakId: P, ket: "E", resi: "", tanggalRelaas: "2026-09-18", tanggalJursitPos: "" },
      { id: 14629, sidangId: 20147, pihakId: T, ket: "S", resi: "P2609190002831", tanggalRelaas: "2026-09-23", tanggalJursitPos: "2026-09-19" },
    ],
    putusan: { tanggal: "2026-10-01", statusId: 67, statusNama: "Dicabut", verstek: "T" },
    pemberitahuan: [],
    ikrar: null,
    jenisBiaya: petaJenis(),
    tarif: {
      kecamatan: { "72.71.01": 29500 } as Record<string, number>,
      kabupaten: { "72.71": 29500 } as Record<string, number>,
      rri: 200000,
      lazim: {},
      nomorPemohon: null,
    },
  };
}

type Usulan = UsulanJurnal;
const ringkas = (u: Usulan) => [u.jenisBiayaId, u.pihakKe, u.pihakId, u.uraian, u.jumlah];

describe("mesin usulan Kasir - perkara sungguhan yang dianonimkan", () => {
  it("580/Pdt.G/2026 (contoh pengguna): usulan SAMA dengan yang ditulis kasir, sisa Rp145.500, saldo nol", () => {
    const h = kasir.susunUsulan(keadaan580(PENDAFTARAN_580));
    const dipilih: Usulan[] = h.usulan.filter((u: Usulan) => u.pilih);
    expect(dipilih.map(ringkas)).toEqual(KASIR_580.map((b) => [b.jenisBiayaId, b.pihakKe, b.pihakId, b.uraian, b.jumlah]));
    // Panggilan: hari kerja sesudah surat ke Pos (Sabtu 19 Sep -> Senin 21);
    // hari putusan: tanggal putusan.
    expect(dipilih.map((u) => u.tanggal)).toEqual(["2026-09-21", "2026-09-21", "2026-09-21", "2026-10-01", "2026-10-01", "2026-10-01", "2026-10-01"]);
    // Juru sita hanya pada biaya panggilan (kategori 4), keterangan selalu ''.
    expect(dipilih.map((u) => u.jurusitaId)).toEqual([0, 22, 0, 0, 0, 0, 0]);
    expect(dipilih.every((u) => u.keterangan === "")).toBe(true);
    expect(h.saldoAkhir).toBe(0);
    // Dicabut: tidak ada pemberitahuan putusan walau Tergugat tidak hadir.
    expect(h.usulan.some((u: Usulan) => u.jenisBiayaId === 29 || u.jenisBiayaId === 389)).toBe(false);
  });

  it("tidak mengusulkan yang sudah ada: jurnal lengkap -> nol usulan", () => {
    const h = kasir.susunUsulan(keadaan580([...PENDAFTARAN_580, ...KASIR_580]));
    expect(h.usulan).toEqual([]);
    expect(h.saldo).toBe(0);
  });

  it("separuh jalan (panggilan sudah dicatat) -> hanya hari putusan; resi salah ketik tetap menutup panggilannya", () => {
    const sebagian = KASIR_580.slice(0, 3).map((b) => (b.jenisBiayaId === 14 ? { ...b, uraian: "Biaya Panggilan Tergugat/P26091900028" } : b));
    const h = kasir.susunUsulan(keadaan580([...PENDAFTARAN_580, ...sebagian]));
    expect(h.usulan.filter((u: Usulan) => u.pilih).map((u: Usulan) => u.jenisBiayaId)).toEqual([157, 152, 404, 151]);
    expect(h.usulan.find((u: Usulan) => u.jenisBiayaId === 151).jumlah).toBe(145500);
  });

  it("sebelum putusan: hanya panggilan pertama, tanpa sisa panjar", () => {
    const k = keadaan580(PENDAFTARAN_580, "2026-09-22");
    k.putusan = null as never;
    k.sidang[0].hasil = "";
    k.sidang[0].dihadiriOleh = null as never;
    const h = kasir.susunUsulan(k);
    expect(h.usulan.map((u: Usulan) => u.jenisBiayaId)).toEqual([236, 14, 237]);
  });

  it("pola 510/2026: verstek terbaca dari HASIL SIDANG (putusan belum diinput) -> pemberitahuan /P + PNBP, sisa Rp196.500", () => {
    const k = keadaan580([
      baris(1, 1, "2026-08-13", "Panjar Biaya Perkara", 420000, null, null, 1),
      baris(2, 61, "2026-08-13", "Biaya Pendaftaran/PNBP", 30000, null, null, 2),
      baris(3, 155, "2026-08-13", "Biaya Pemberkasan/ATK", 100000, null, null, 3),
      baris(4, 236, "2026-08-18", "PNBP Relaas Panggilan Pertama Kepada Penggugat", 10000, 1, P),
      baris(5, 14, "2026-08-18", "Biaya Panggilan Tergugat/P2608150003240", 14500, 2, T),
      baris(6, 237, "2026-08-18", "PNBP Relaas Panggilan Pertama Kepada Tergugat", 10000, 2, T),
    ], "2026-09-09");
    k.perkara.tanggalDaftar = "2026-08-13";
    k.tarif.kecamatan = { "72.71.01": 14500 };
    k.putusan = null as never;
    k.sidang = [
      { id: 1, urutan: 1, tanggal: "2026-08-26", dihadiriOleh: 2, ikrar: false, ditunda: true, hasil: "Tergugat tidak hadir", agenda: "Sidang Pertama" },
      { id: 2, urutan: 2, tanggal: "2026-09-09", dihadiriOleh: 2, ikrar: false, ditunda: false, hasil: "putus DIKABULKAN (verstek)", agenda: "Panggil Tergugat" },
    ];
    k.relaas = [
      { id: 1, sidangId: 1, pihakId: P, ket: "E", resi: "", tanggalRelaas: "2026-08-15", tanggalJursitPos: "" },
      { id: 2, sidangId: 1, pihakId: T, ket: "S", resi: "P2608150003240", tanggalRelaas: "2026-08-20", tanggalJursitPos: "2026-08-15" },
      { id: 3, sidangId: 2, pihakId: T, ket: "S", resi: "P2608280003940", tanggalRelaas: "2026-09-01", tanggalJursitPos: "2026-08-28" },
    ];
    const h = kasir.susunUsulan(k);
    const dipilih = h.usulan.filter((u: Usulan) => u.pilih);
    expect(dipilih.map(ringkas)).toEqual([
      [14, 2, T, "Biaya Panggilan Tergugat/P2608280003940", 14500],
      [157, 1, P, "Redaksi", 10000],
      [152, 1, P, "Meterai", 10000],
      [29, 2, T, "Biaya Pemberitahuan/P", 14500],
      [389, 2, T, "PNBP Relaas Pemberitahuan Putusan Kepada Tergugat", 10000],
      [151, 1, P, "Pengembalian Sisa Panjar", 196500],
    ]);
    expect(h.catatan.join(" ")).toMatch(/dibaca dari hasil sidang/);
  });

  it("cerai talak dikabulkan: sisa menunggu ikrar; sesudah ikrar - panggilan ikrar Termohon dan sisa bertanggal ikrar", () => {
    const k = keadaan580(PENDAFTARAN_580, "2026-10-20");
    k.perkara.jenisPerkaraId = 346;
    k.perkara.jenisPerkaraNama = "Cerai Talak";
    k.jurnal.push(...KASIR_580.slice(0, 3).map((b) => ({ ...b, uraian: b.uraian.replace("Penggugat", "Pemohon").replace("Tergugat", "Termohon") })));
    k.putusan = { tanggal: "2026-10-01", statusId: 62, statusNama: "Dikabulkan", verstek: "T" };
    k.sidang[0] = { ...k.sidang[0], dihadiriOleh: 1, hasil: "putus DIKABULKAN" };
    const tanpaIkrar = kasir.susunUsulan(k);
    expect(tanpaIkrar.usulan.some((u: Usulan) => u.jenisBiayaId === 151)).toBe(false);
    expect(tanpaIkrar.catatan.join(" ")).toMatch(/menunggu ikrar/);

    k.sidang.push({ id: 20300, urutan: 2, tanggal: "2026-10-15", dihadiriOleh: 1, ikrar: true, ditunda: false, hasil: "telah ikrar talak", agenda: "SIDANG IKRAR TALAK" });
    k.relaas.push({ id: 15000, sidangId: 20300, pihakId: T, ket: "S", resi: "P2610060001111", tanggalRelaas: "2026-10-08", tanggalJursitPos: "2026-10-06" });
    const h = kasir.susunUsulan(k);
    const dipilih = h.usulan.filter((u: Usulan) => u.pilih);
    expect(dipilih.map((u: Usulan) => [u.jenisBiayaId, u.uraian, u.tanggal])).toEqual([
      [157, "Redaksi", "2026-10-01"],
      [152, "Meterai", "2026-10-01"],
      [14, "Biaya Panggilan Ikrar Talak/P2610060001111", "2026-10-07"],
      [151, "Pengembalian Sisa Panjar", "2026-10-15"],
    ]);
  });

  it("Pdt.P dua pemohon: satu PNBP per pemohon (253), tanpa biaya panggilan; penomoran mengikuti kebiasaan terakhir", () => {
    const k = keadaan580(PENDAFTARAN_580, "2026-09-25");
    k.perkara = { ...k.perkara, nomorPerkara: "212/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16, jenisPerkaraId: 360, jenisPerkaraNama: "Pengesahan Perkawinan/Istbat Nikah" };
    k.pihak = [
      { id: 1, ke: 1, urutan: 1, pihakId: 501, nama: "Pemohon Satu", kecamatan: "", kabupaten: "" },
      { id: 2, ke: 1, urutan: 2, pihakId: 502, nama: "Pemohon Dua", kecamatan: "", kabupaten: "" },
    ];
    k.relaas = [];
    k.putusan = null as never;
    k.sidang[0] = { ...k.sidang[0], hasil: "", dihadiriOleh: null as never };
    const bernomor = kasir.susunUsulan(k).usulan;
    expect(bernomor.map((u: Usulan) => [u.jenisBiayaId, u.pihakId, u.uraian, u.tanggal])).toEqual([
      [253, 501, "PNBP Relaas Panggilan Pertama Pemohon I", "2026-09-17"],
      [253, 502, "PNBP Relaas Panggilan Pertama Pemohon II", "2026-09-17"],
    ]);
    k.tarif.nomorPemohon = false as never;
    expect(kasir.susunUsulan(k).usulan.map((u: Usulan) => u.uraian)).toEqual([
      "PNBP Relaas Panggilan Pertama Pemohon",
      "PNBP Relaas Panggilan Pertama Pemohon",
    ]);
  });

  it("tarif yang tidak diketahui TIDAK diisi nol; RRI memakai tarif RRI", () => {
    const k = keadaan580(PENDAFTARAN_580, "2026-09-22");
    k.putusan = null as never;
    k.sidang[0] = { ...k.sidang[0], hasil: "" };
    k.tarif.kecamatan = {};
    k.tarif.kabupaten = {};
    const tanpaTarif = kasir.susunUsulan(k).usulan.find((u: Usulan) => u.jenisBiayaId === 14);
    expect(tanpaTarif.jumlah).toBeNull();
    k.relaas[1] = { ...k.relaas[1], ket: "R", resi: "" };
    const rri = kasir.susunUsulan(k).usulan.find((u: Usulan) => u.jenisBiayaId === 14);
    expect([rri.uraian, rri.jumlah]).toEqual(["Biaya Panggilan Tergugat/RRI", 200000]);
  });

  it("prodeo: tidak ada usulan", () => {
    const k = keadaan580(PENDAFTARAN_580);
    k.pembiayaan = 2;
    const h = kasir.susunUsulan(k);
    expect(h.usulan).toEqual([]);
    expect(h.catatan.join(" ")).toMatch(/prodeo/);
  });
});

// ─── Penulis SIPP (bot) atas basis data tiruan ───────────────────────────────

type Kueri = { sql: string; params: unknown[] };

function basisDataTiruan(jurnalAwal: Jurnal[], pilihan: { gagalAudit?: boolean; transaksi?: boolean } = {}) {
  const rekaman: Kueri[] = [];
  const urutan: string[] = [];
  const jurnal = jurnalAwal.map((b) => ({ ...b, diinputOleh: "kasir", diinputTanggal: "", namaPihak: "", jurusita: "" }));
  const k = keadaan580([]);
  let maxId = 101199;
  const kueri = async (sql: string, params: unknown[] = []) => {
    rekaman.push({ sql, params });
    const s = sql.replace(/\s+/g, " ").trim();
    // 13 Okt 2026: jam yang DITULIS = jam SIPP (WIB, UTC_TIMESTAMP + 7 jam);
    // NOW() (WITA) hanya untuk pagar tanggal.
    if (/UTC_TIMESTAMP/.test(s)) {
      urutan.push("SIPP");
      return [{ saat: "2026-10-01 13:52:53" }];
    }
    if (/DATE_FORMAT\(NOW\(\)/.test(s)) {
      urutan.push("NOW");
      return [{ saat: "2026-10-01 14:52:53" }];
    }
    if (/FROM sys_users WHERE username = \?/.test(s)) return String(params[0]) === "kasir" ? [{ username: "kasir", fullname: "Petugas Kasir", block: "0" }] : [];
    if (/FROM perkara p LEFT JOIN perkara_penetapan/.test(s)) return Number(params[0]) === 10132 ? [{ ...k.perkara, tahapanId: 15, proses: "Persidangan" }] : [];
    if (/^SELECT pb\.id, pb\.id_pembiayaan/.test(s)) return jurnal.map((b) => ({ ...b }));
    if (/FROM perkara_pihak1 a/.test(s)) return k.pihak.map((p) => ({ ...p }));
    if (/FROM perkara_jurusita/.test(s)) return [{ jurusitaId: 22, nama: "Juru Sita Anonim" }];
    if (/FROM perkara_jadwal_sidang/.test(s)) return [{ id: 20147, urutan: 1, tanggal: "2026-10-01", dihadiriOleh: 2, ikrar: "T", agenda: "Sidang Pertama", ditunda: "T", hasil: "putus DICABUT" }];
    if (/FROM perkara_pelaksanaan_relaas/.test(s)) return k.relaas.map((r) => ({ ...r }));
    if (/FROM perkara_putusan pu/.test(s)) return [{ tanggal: "2026-10-01", statusId: 67, statusNama: "Dicabut", verstek: "T" }];
    if (/FROM perkara_putusan_pemberitahuan_putusan|FROM perkara_ikrar_talak/.test(s)) return [];
    if (/FROM jenis_biaya jb/.test(s)) return Object.values(petaJenis());
    if (/JOIN pihak ph ON ph\.id = pb\.pihak_id/.test(s)) return [{ kecamatan: "72.71.01", kabupaten: "72.71", jumlah: 29500, rri: 0, khusus: 0, n: 40 }];
    if (/p\.alur_perkara_id AS alur/.test(s)) return [];
    if (/REGEXP 'Pemohon/.test(s)) return [{ bernomor: 0, polos: 0 }];
    if (/^SELECT id FROM perkara_biaya WHERE perkara_id = \?/.test(s)) return [];
    if (/COALESCE\(MAX\(id\), 0\) \+ 1 AS maxid FROM perkara_biaya/.test(s)) return [{ maxid: maxId + 1 }];
    if (/^INSERT INTO perkara_biaya /.test(s)) {
      urutan.push("INSERT");
      const kolom = kasir.KOLOM_BIAYA as string[];
      const n = Object.fromEntries(kolom.map((x, i) => [x, params[i]])) as Record<string, unknown>;
      maxId = Number(n.id);
      jurnal.push({
        id: Number(n.id),
        jenisBiayaId: Number(n.jenis_biaya_id),
        kategoriId: Number(n.kategori_id),
        jenisTransaksi: Number(n.jenis_transaksi),
        pihakId: Number(n.pihak_id),
        pihakKe: Number(n.pihak_ke),
        urutan: 0,
        tanggal: String(n.tanggal_transaksi),
        uraian: String(n.uraian),
        jumlah: Number(n.jumlah),
        keterangan: String(n.keterangan),
        pembiayaan: 1,
        diinputOleh: String(n.diinput_oleh),
        diinputTanggal: String(n.diinput_tanggal),
        namaPihak: "",
        jurusita: "",
      });
      return { insertId: 0, affectedRows: 1 };
    }
    if (/^INSERT INTO sys_audittrail/.test(s)) {
      if (pilihan.gagalAudit) throw Object.assign(new Error("ER_LOCK_WAIT_TIMEOUT: Lock wait timeout exceeded"), { code: "ER_LOCK_WAIT_TIMEOUT" });
      return { insertId: 1, affectedRows: 1 };
    }
    if (/perkara_biaya_jurusita/.test(s)) return { affectedRows: 1 };
    throw new Error(`kueri tak terduga: ${s.slice(0, 90)}`);
  };
  // Transaksi tiruan: ROLLBACK memulihkan jurnal seperti sebelum baris itu.
  const transaksi = pilihan.transaksi
    ? async (kerja: (k: typeof kueri) => Promise<unknown>) => {
        const sebelum = jurnal.length;
        try {
          return { hasil: await kerja(kueri), dipulihkan: null };
        } catch (galat) {
          jurnal.length = sebelum;
          (galat as { dipulihkan?: boolean }).dipulihkan = true;
          throw galat;
        }
      }
    : undefined;
  const layanan = kasir.buatLayanan({
    kueri,
    transaksi,
    tabelAda: async () => true,
    jeda: async (jenis: string, opsi: { kering?: boolean }) => {
      urutan.push(`JEDA:${jenis}:${opsi?.kering ? "kering" : "sungguh"}`);
      return 0;
    },
    // Sapaan SIPP berisi NAMA LENGKAP - diterjemahkan seperti akunPetugasMasuk.
    akunPetugasMasuk: async (nama: string) => (nama === "Petugas Kasir" ? { username: "kasir", fullname: "Petugas Kasir" } : null),
  });
  const tulisan = () => rekaman.filter((x) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(x.sql));
  return { layanan, rekaman, tulisan, urutan, jurnal };
}

const BARIS_KIRIM = [
  { tanggal: "2026-09-22", jenisBiayaId: 236, pihakKe: 1, pihakId: P, uraian: "PNBP Relaas Panggilan Pertama Kepada Penggugat", jumlah: 10000, keterangan: "" },
  { tanggal: "2026-09-22", jenisBiayaId: 14, pihakKe: 2, pihakId: T, uraian: "Biaya Panggilan Tergugat/P2609190002831", jumlah: 29500, keterangan: "" },
];

describe("penulis jurnal SIPP (bot)", () => {
  it("bentuk blangko Tambah jurnal SIPP: kolom & urutan validateInput, id MAX+1, audit 'Add Mediasi', juru sita hanya kategori 4/5/6, tanpa kata ALETA", async () => {
    const t = basisDataTiruan(PENDAFTARAN_580);
    const rencana = await t.layanan.susunRencana({ perkaraId: 10132, akunSipp: "kasir", operator: "Penguji", ip: "192.168.9.53", baris: BARIS_KIRIM });
    expect(rencana.ok).toBe(true);
    expect(rencana.ditolak).toEqual([]);
    const [pnbp, panggil] = rencana.langkah;
    expect(pnbp.kelompok.map((x: { tabel: string; aksi: string }) => `${x.aksi} ${x.tabel}`)).toEqual([
      "INSERT perkara_biaya",
      "INSERT sys_audittrail",
      "DELETE perkara_biaya_jurusita",
    ]);
    expect(panggil.kelompok.map((x: { tabel: string; aksi: string }) => `${x.aksi} ${x.tabel}`)).toEqual([
      "INSERT perkara_biaya",
      "INSERT sys_audittrail",
      "DELETE perkara_biaya_jurusita",
      "REPLACE perkara_biaya_jurusita",
    ]);
    expect(pnbp.kelompok[0].sql).toBe(
      "INSERT INTO perkara_biaya (id, id_pembiayaan, perkara_id, general_id, tahapan_id, kategori_id, jenis_biaya_id, pihak_id, pihak_ke, jenis_transaksi, urutan, sisa, tanggal_transaksi, uraian, jumlah, keterangan, diinput_oleh, diinput_tanggal) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    );
    expect(panggil.kelompok[0].params).toEqual(["#ID#", 1, 10132, 0, 10, 4, 14, T, 2, -1, 0, 0, "2026-09-22", "Biaya Panggilan Tergugat/P2609190002831", 29500, "", "kasir", "#SAAT#"]);
    const audit = panggil.kelompok[1].params;
    expect(audit.slice(0, 6)).toEqual(["#SAAT#", "192.168.9.53", "kasir", "perkara_biaya", "Add Mediasi", "INSERT"]);
    expect(audit[6]).toBe("Tambah Data Biaya <br />Tambah table <b>Perkara_Biaya</b> dari halaman <b>Tambah Biaya</b> dengan Primary Key [ID=#ID#]");
    expect(audit[7]).toContain("<tr><td>id</td><td>#ID#</td></tr><tr><td>id_pembiayaan</td><td>1</td></tr>");
    expect(audit[7]).toContain("<tr><td>keterangan</td><td></td></tr><tr><td>diinput_oleh</td><td>kasir</td></tr><tr><td>diinput_tanggal</td><td>#SAAT#</td></tr></table>");
    expect(panggil.kelompok[3].params).toEqual(["#ID#", 22]);
    expect(JSON.stringify(rencana.langkah)).not.toMatch(/aleta/i);
  });

  it("kering bawaan: nol tulisan, nol jeda", async () => {
    const t = basisDataTiruan(PENDAFTARAN_580);
    const rencana = await t.layanan.susunRencana({ perkaraId: 10132, akunSipp: "kasir", operator: "Penguji", baris: BARIS_KIRIM });
    const hasil = await t.layanan.jalankanRencana(rencana);
    expect(hasil.kering).toBe(true);
    expect(hasil.rencana).toHaveLength(2);
    expect(t.tulisan()).toEqual([]);
    expect(t.urutan.filter((x) => x.startsWith("JEDA"))).toEqual([]);
  });

  it("sungguhan: jeda -> NOW() -> MAX+1 -> INSERT per baris; jam audit = diinput_tanggal; tersimpan hanya bila terbaca ulang", async () => {
    const t = basisDataTiruan(PENDAFTARAN_580);
    const rencana = await t.layanan.susunRencana({ perkaraId: 10132, akunSipp: "kasir", operator: "Penguji", ip: "192.168.9.53", baris: BARIS_KIRIM });
    const hasil = await t.layanan.jalankanRencana(rencana, { kering: false });
    expect(hasil.ok).toBe(true);
    expect(hasil.hasil.map((h: { id: number; keadaan: string }) => [h.id, h.keadaan])).toEqual([
      [101200, "tersimpan"],
      [101201, "tersimpan"],
    ]);
    // Jam diambil SESUDAH jeda, tiap baris.
    expect(t.urutan.join(" ")).toMatch(/^NOW .*JEDA:klik:sungguh SIPP INSERT JEDA:(?:simpan|barisKasir):sungguh SIPP INSERT/);
    const audit = t.tulisan().filter((x) => /sys_audittrail/.test(x.sql));
    expect(audit.map((x) => x.params[0])).toEqual(["2026-10-01 13:52:53", "2026-10-01 13:52:53"]);
    expect(String(audit[1].params[6])).toMatch(/\[ID=101201\]$/);
    expect(String(audit[1].params[7])).toContain("<tr><td>id</td><td>101201</td></tr>");
    const biaya = t.tulisan().filter((x) => /INSERT INTO perkara_biaya /.test(x.sql));
    expect(biaya.map((x) => x.params[17])).toEqual(["2026-10-01 13:52:53", "2026-10-01 13:52:53"]);
    expect(t.tulisan().find((x) => /^REPLACE/.test(x.sql))?.params).toEqual([101201, 22]);
  });

  it("pagar validateInput: Sabtu, melebihi hari ini, sebelum pendaftaran, melebihi panjar, Panjar awal, pihak asing - ditolak per baris", async () => {
    const t = basisDataTiruan(PENDAFTARAN_580);
    const dasar = BARIS_KIRIM[0];
    const rencana = await t.layanan.susunRencana({
      perkaraId: 10132,
      akunSipp: "kasir",
      operator: "Penguji",
      baris: [
        { ...dasar, tanggal: "2026-09-26" },
        { ...dasar, tanggal: "2026-10-02" },
        { ...dasar, tanggal: "2026-09-14" },
        { ...dasar, jumlah: 400000 },
        { ...dasar, jenisBiayaId: 1, uraian: "Panjar Biaya Perkara" },
        { ...dasar, pihakId: 999 },
        { ...dasar, uraian: "  " },
        dasar,
      ],
    });
    expect(rencana.ditolak.map((x: { ke: number; pesan: string }) => [x.ke, x.pesan])).toEqual([
      [0, "Tidak Dapat Memilih Tanggal Transaksi Dihari Libur, Sabtu dan Minggu."],
      [1, "Tanggal Transaksi Tidak Boleh Melebihi Hari Ini. Hari ini Tanggal 10/01/2026"],
      [2, "Tanggal transaksi tidak boleh kurang dari tanggal pendaftaran"],
      [3, "Jumlah biaya melebihi sisa panjar, biaya tidak bisa disimpan"],
      [4, "Panjar Biaya Perkara dicatat saat pendaftaran - tidak dari Kasir ALETA."],
      [5, "Pihak yang membayar wajib dipilih."],
      [6, "Uraian wajib diisi."],
    ]);
    expect(rencana.langkah.map((l: { ke: number }) => l.ke)).toEqual([7]);
  });

  it("baris yang sama persis sudah di jurnal -> dilewati; akun SIPP asing -> ditolak", async () => {
    const t = basisDataTiruan([...PENDAFTARAN_580, ...KASIR_580.slice(0, 1)]);
    const rencana = await t.layanan.susunRencana({ perkaraId: 10132, akunSipp: "kasir", operator: "Penguji", baris: BARIS_KIRIM });
    expect(rencana.dilewati.map((x: { ke: number }) => x.ke)).toEqual([0]);
    expect(rencana.langkah.map((l: { ke: number }) => l.ke)).toEqual([1]);
    const asing = await t.layanan.susunRencana({ perkaraId: 10132, akunSipp: "fahri", operator: "Penguji", baris: BARIS_KIRIM });
    expect([asing.ok, asing.alasan]).toEqual([false, "akun_sipp_tidak_ketemu"]);
    const namaLengkap = await t.layanan.susunRencana({ perkaraId: 10132, akunSipp: "Petugas Kasir", operator: "Penguji", baris: BARIS_KIRIM });
    expect(namaLengkap.akunSipp).toEqual({ username: "kasir", namaLengkap: "Petugas Kasir" });
    const tanpa = await t.layanan.susunRencana({ perkaraId: 10132, operator: "Penguji", baris: BARIS_KIRIM });
    expect([tanpa.ok, tanpa.alasan]).toEqual([false, "akun_sipp_tidak_disebut"]);
  });

  it("uji rilis 9 Okt: audit gagal sesudah baris biaya tertulis -> SATU baris jurnal dibatalkan utuh (transaksi), bukan 'sebagian'", async () => {
    const t = basisDataTiruan(PENDAFTARAN_580, { gagalAudit: true, transaksi: true });
    const rencana = await t.layanan.susunRencana({ perkaraId: 10132, akunSipp: "kasir", operator: "Penguji", baris: BARIS_KIRIM.slice(0, 1) });
    const sebelum = t.jurnal.length;
    const hasil = await t.layanan.jalankanRencana(rencana, { kering: false });
    expect(hasil.ok).toBe(false);
    expect(hasil.hasil.map((h: { keadaan: string }) => h.keadaan)).toEqual(["gagal"]);
    expect(String(hasil.hasil[0].pesan)).toMatch(/dibatalkan, tidak ada yang tertinggal/);
    // Tidak ada baris jurnal TANPA audit yang tertinggal.
    expect(t.jurnal.length).toBe(sebelum);
  });

  it("daftar putih tabel kasir hanya tiga, dan tiap tabel yang ditanya ada di daftar skema", () => {
    expect([...kasir.DAFTAR_TABEL_KASIR].sort()).toEqual(["perkara_biaya", "perkara_biaya_jurusita", "sys_audittrail"]);
    const skema = readFileSync(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"), "utf8");
    for (const tabel of ["perkara_biaya", "perkara_biaya_jurusita", "biaya_perkara", "jenis_biaya", "kategori_biaya", "perkara_pelaksanaan_relaas", "perkara_putusan_pemberitahuan_putusan", "perkara_ikrar_talak", "perkara_jurusita"]) {
      expect(skema, tabel).toContain(`"${tabel}"`);
    }
  });
});

// ─── Layar ───────────────────────────────────────────────────────────────────

describe("layar Kasir", () => {
  it("hak: kasir/bendahara/panitera/admin ya; panitera pengganti, hakim, juru sita tidak", () => {
    expect(bolehKasir({ roleId: "staf", positionId: "pos-staf-umum", additionalRoleIds: ["kasir"] })).toBe(true);
    expect(bolehKasir({ roleId: "pelaksana", positionId: "pos-bendahara" })).toBe(true);
    expect(bolehKasir({ roleId: "analis-keuangan", positionId: "pos-analis-keuangan" })).toBe(true);
    expect(bolehKasir({ roleId: "panitera", positionId: "pos-panitera" })).toBe(true);
    expect(bolehKasir({ roleId: "panitera-muda", positionId: "pos-panitera-muda-gugatan" })).toBe(true);
    expect(bolehKasir({ roleId: "admin", positionId: "" })).toBe(true);
    expect(bolehKasir({ roleId: "panitera-pengganti", positionId: "pos-panitera-pengganti" })).toBe(false);
    expect(bolehKasir({ roleId: "hakim", positionId: "pos-hakim" })).toBe(false);
    expect(bolehKasir({ roleId: "jurusita", positionId: "pos-jurusita" })).toBe(false);
    expect(bolehKasir(null)).toBe(false);
  });

  it("hitungSisaOtomatis layar = bot; tabel jurnal menghitung sisa seperti SIPP", () => {
    const usulan = kasir.susunUsulan(keadaan580(PENDAFTARAN_580)).usulan as UsulanJurnal[];
    usulan[0].pilih = false; // PNBP Penggugat tidak jadi - sisa bertambah 10.000
    const a = usulan.map((u) => ({ ...u }));
    const b = usulan.map((u) => ({ ...u }));
    const saldo = saldoJurnal(PENDAFTARAN_580);
    expect(hitungSisaOtomatis(a, saldo)).toBe(kasir.hitungSisaOtomatis(b, saldo));
    expect(a.find((u) => u.sisaOtomatis)?.jumlah).toBe(155500);
    expect(b.find((u) => u.sisaOtomatis)?.jumlah).toBe(155500);
    const tabel = susunTampilan(
      PENDAFTARAN_580.map((x) => ({ ...x, diinputOleh: "kasir", namaPihak: "", jurusita: "" })),
      a,
      keadaan580([]).pihak,
      () => "Juru Sita Anonim"
    );
    expect(tabel.map((x) => x.sisa)).toEqual([355000, 325000, 225000, 195500, 185500, 175500, 165500, 155500, 0]);
    expect(tabel[3].keterangan).toBe("(Juru Sita Anonim)");
    expect(tabel[3].pihak).toBe("Tergugat Anonim(T)");
  });

  it("pagar layar sama bunyinya dengan bot", () => {
    const bahan = { hariIni: "2026-10-01", tanggalDaftar: "2026-09-15" };
    const u = { tanggal: "2026-09-26", jenisBiayaId: 157, uraian: "Redaksi", jumlah: 10000, pihakId: P, pihakKe: 1 };
    expect(periksaBarisKasir(u, bahan)).toBe(kasir.PESAN.libur);
    expect(periksaBarisKasir({ ...u, tanggal: "2026-09-14" }, bahan)).toBe(kasir.PESAN.sebelumDaftar);
    expect(periksaBarisKasir({ ...u, tanggal: "2026-09-30", jumlah: null }, bahan)).toBe(kasir.PESAN.jumlah);
    expect(periksaBarisKasir({ ...u, tanggal: "2026-09-30" }, bahan)).toBe("");
  });

  it("tombol Kasir disisipkan SATU kali, tepat sesudah tombol Daftarkan ke antrian", () => {
    const isi = readFileSync(path.join(AKAR, "manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(isi.match(/<TombolKasirJurnal /g)).toHaveLength(1);
    const antrian = isi.indexOf('"Daftarkan ke antrian"}');
    const tombol = isi.indexOf("<TombolKasirJurnal daftar={sidang} />");
    expect(antrian).toBeGreaterThan(0);
    expect(isi.slice(antrian, tombol)).toMatch(/^"Daftarkan ke antrian"\}\n\s*<\/Button>\n\s*\) : null\}\n\s*\{tampil\(tampilan, "tombol-kasir"\) \? $/);
  });
});
