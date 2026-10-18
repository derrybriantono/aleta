"use strict";

/**
 * ============================================================================
 * KASIR OTOMATIS - SAKLAR HARI PUTUS (13 Okt 2026, butir 10)
 * ============================================================================
 *
 * Permintaan pengguna: saklar on/off "Kasir otomatis" yang, bila ON, mengisi
 * jurnal perkara yang PUTUS PADA HARI ITU - Redaksi, Meterai, PNBP, PNBP
 * cabut, dan Pengembalian Sisa Panjar - dengan butir yang dapat dipilih
 * kasir, dan daftar perkara putus hari itu beserta keadaan tiap butir.
 *
 * BUKAN MESIN KEDUA. Baris yang ditulis adalah usulan susunUsulan
 * (kasirJurnalService) yang sama dengan Kasir per perkara; berkas ini hanya
 * MENYARING: kejadian "putusan" bertanggal hari ini, butir yang dinyalakan,
 * dan hanya yang pantas ditulis TANPA dilihat manusia:
 *
 *   - dicentang mesin (pilih) DAN yakin "tinggi" - usulan yang ditawarkan
 *     tanpa centang atau yakin sedang/rendah dilewati dengan alasannya
 *     (keputusan pengguna 11 Okt: yang lemah/menambah beban pihak tidak
 *     dicentang bawaan; di sini bahkan tidak ditulis);
 *   - tarif diketahui, jenis biaya tersedia untuk alur perkara, resi tidak
 *     dibutuhkan;
 *   - perkara yang saldonya KURANG (mesin menawarkan Tambahan Panjar) tidak
 *     disentuh sama sekali - uang pihak, urusan kasir;
 *   - Pengembalian Sisa Panjar TERAKHIR, hanya bila sisanya > 0 dan tidak ada
 *     lagi usulan tercentang (kejadian apa pun) yang belum dijurnal - sisa
 *     yang dikembalikan lebih dahulu akan membuat biaya yang tertinggal tidak
 *     berpanjar.
 *
 * Idempoten per perkara x jenis biaya (pemberitahuan: per pihak): mesin
 * usulan tidak mengusulkan jenis yang sudah ada, dan jalankanRencana
 * (opsi.sekaliPerJenis) memeriksa lagi tepat sebelum tiap tulisan. Satu
 * perkara satu kerja sekaligus di bot (kunci di memori) - dua peramban kasir
 * yang menyala bersamaan tidak menulis dua kali.
 *
 * HASIL UKUR (aleta_bot/tools/ukur-kasir-hari-putus.js, sipp_donggala putusan
 * 1 Jul 2025 - 13 Okt 2026, 1.355 perkara berjurnal bukan prodeo; diperiksa
 * pula baca-saja di server Jul-Okt 2026 dan SIPP PA Bungku 2023-2024):
 *
 *   verstek (593)       157 Redaksi 100% > 152 Meterai 100% > 29 Biaya
 *                       Pemberitahuan/<resi> 99% > 389 PNBP PBT Tergugat 98%
 *                       > 151 Sisa 99% (urutan itu 580/593)
 *   dicabut (113)       Redaksi 100%, Meterai 100%, 404 PNBP Surat Permohonan
 *                       Pencabutan Perkara Rp10.000 97% (server Jul-Okt 2026
 *                       32/32, Bungku 88%), Sisa 93% (sisanya saldo sudah 0);
 *                       PBT hanya 11%. Urutan 157>152>404>151 (48) atau
 *                       404>157>152>151 (43).
 *   contradictoir (63)  Redaksi, Meterai 100%, Sisa 89%, PBT 38-40%
 *   permohonan (359)    Redaksi, Meterai 100%, Sisa 55% - 160 sisanya
 *                       saldonya sudah habis (tanpa baris sisa)
 *   cerai talak kabul   Redaksi, Meterai 98%, PBT 74%; Sisa pada hari IKRAR
 *     (121)             96/98, tidak pernah hari putus
 *   digugurkan (57)     Redaksi, Meterai 98%, PNBP PBT Penggugat 39%, Sisa 63%
 *   tidak diterima (36) Redaksi, Meterai 100%, PNBP PBT Penggugat 39%, Sisa 72%
 *   ditolak (10), perdamaian (3): Redaksi, Meterai, Sisa
 *   Sisa panjar SELALU baris terakhir dan menghabiskan saldo (1.143/1.143);
 *   baris hari putus diketik pada hari itu juga 93-100%.
 *
 * UJI BALIK saringan ini (--uji-balik, 1.351 perkara, tiap perkara seolah
 * hari putusnya hari ini): 5.053 baris otomatis, 98,9% sama jenis & jumlah
 * dengan tulisan kasir, meliput 93,9% baris kasir; sisa panjar sama persis
 * 885/914 (12 berbeda jumlah, 17 ditulis kasir pada hari lain). Uji tulis
 * di SIPP lokal dalam transaksi lalu ROLLBACK: 481/Pdt.G/2026 (verstek) dan
 * 221/Pdt.P/2026 (dicabut) persis tulisan kasir, saldo nol, jalan kedua kosong.
 */

const kasir = require("./kasirJurnalService");

const { JB } = kasir;

/** Butir yang dapat dinyalakan kasir. Bawaan seluruh butir menyala; SAKLAR UTAMA bawaannya MATI. */
const BUTIR_OTOMATIS = Object.freeze([
  { kunci: "redaksi", nama: "Redaksi", jenis: [JB.REDAKSI], ukur: "100% perkara putus (1.355 perkara)" },
  { kunci: "meterai", nama: "Meterai", jenis: [JB.METERAI], ukur: "100% perkara putus" },
  { kunci: "pnbp-cabut", nama: "PNBP Surat Permohonan Pencabutan Perkara (dicabut)", jenis: [JB.PNBP_CABUT], ukur: "97% perkara dicabut (110/113); server 32/32" },
  { kunci: "pnbp-pbt", nama: "PNBP Relaas Pemberitahuan Putusan", jenis: [JB.PNBP_PBT_P, JB.PNBP_PBT_T], ukur: "verstek 98%; gugur/tidak diterima 39% (Penggugat)" },
  { kunci: "biaya-pbt", nama: "Biaya Pemberitahuan putusan (Pos)", jenis: [JB.PEMBERITAHUAN], ukur: "verstek 99%; tarif pihak/kecamatan" },
  { kunci: "psp", nama: "Pengembalian Sisa Panjar (terakhir)", jenis: [JB.SISA], ukur: "selalu baris terakhir, saldo habis" },
]);
const KUNCI_BUTIR = new Set(BUTIR_OTOMATIS.map((b) => b.kunci));
const BUTIR_BAWAAN = Object.freeze(BUTIR_OTOMATIS.map((b) => b.kunci));

const TABEL_SETELAN = "aleta_bot_kasir_otomatis";

/**
 * Pemberitahuan putusan (Biaya Pemberitahuan + PNBP PBT) ditulis OTOMATIS
 * hanya pada keadaan yang terukur tepat: uji balik 1.351 perkara (tools/
 * ukur-kasir-hari-putus.js --uji-balik) - verstek 582/589, cerai talak
 * menunggu ikrar 88/91; contradictoir 20/24, tidak dapat diterima 6/12.
 * Keadaan lain: dilewati, kasir memeriksanya di Kasir per perkara.
 */
const KEADAAN_PBT_OTOMATIS = new Set(["verstek", "menunggu-ikrar"]);

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function rupiah(n) {
  const x = Math.round(Number(n) || 0);
  return `${x < 0 ? "-" : ""}Rp${Math.abs(x).toLocaleString("id-ID")}`;
}

/** Larik kunci butir yang sah (urut daftar). Bukan larik = bawaan (semua). */
function butirSah(nilai) {
  if (!Array.isArray(nilai)) return BUTIR_BAWAAN.slice();
  const ada = new Set(nilai.map((x) => bersih(x)));
  return BUTIR_OTOMATIS.map((b) => b.kunci).filter((k) => ada.has(k));
}

function butirJenis(jenisBiayaId) {
  return BUTIR_OTOMATIS.find((b) => b.jenis.includes(Number(jenisBiayaId))) || null;
}

/** Baris kiriman bentuk POST /kasir (susunRencana). */
function barisKirim(u) {
  return {
    tanggal: u.tanggal,
    jenisBiayaId: u.jenisBiayaId,
    pihakKe: u.pihakKe,
    pihakId: u.pihakId,
    uraian: u.uraian,
    jumlah: u.jumlah,
    keterangan: u.keterangan || "",
    jurusitaId: u.jurusitaId || 0,
  };
}

/**
 * ============================================================================
 * RENCANA SATU PERKARA - FUNGSI MURNI atas keadaan (bentuk bacaKeadaan)
 * ============================================================================
 *
 * @param {object} k keadaan perkara
 * @param {{ hari?: string, butir?: string[] }} opsi hari = hari putus yang
 *   dilayani (bawaan k.hariIni); butir = kunci butir yang dinyalakan
 * @returns {{ perkaraId, nomorPerkara, jenisPerkara, keadaan, putusan,
 *   putusHariIni, saldo, alasan, butir: object[], kirim: object[] }}
 *   butir[].baris[] = { status: "sudah"|"akan"|"dilewati", uraian, jumlah,
 *   tanggal, alasan }; butir[].status = ringkasannya ("tidak-berlaku" bila
 *   tidak ada apa pun). kirim = usulan yang AKAN ditulis, urutan mesin (sisa
 *   panjar terakhir), jumlah sisa sudah dihitung.
 */
function rencanaOtomatis(k, opsi = {}) {
  const perkara = (k && k.perkara) || {};
  const hari = kasir.tanggalSah(opsi.hari) || kasir.tanggalSah(k && k.hariIni);
  const aktif = new Set(butirSah(opsi.butir));
  const keadaan = kasir.keadaanPerkara(k || {});
  const sidang = (Array.isArray(k && k.sidang) ? k.sidang : []).slice().sort((a, b) => Number(a.urutan) - Number(b.urutan) || bersih(a.tanggal).localeCompare(bersih(b.tanggal)));
  const putusan =
    k && k.putusan && kasir.tanggalSah(k.putusan.tanggal) ? k.putusan : kasir.putusanDariSidang(sidang.filter((s) => !s.ikrar), hari);
  const jurnal = Array.isArray(k && k.jurnal) ? k.jurnal : [];
  const saldoAwal = jurnal.reduce((s, b) => s + Number(b.jenisTransaksi) * Number(b.jumlah), 0);
  const dasar = {
    perkaraId: Number(perkara.perkaraId) || 0,
    nomorPerkara: bersih(perkara.nomorPerkara),
    jenisPerkara: bersih(perkara.jenisPerkaraNama),
    keadaan,
    putusan: putusan ? { tanggal: putusan.tanggal, statusNama: bersih(putusan.statusNama), dariSidang: Boolean(putusan.dariSidang) } : null,
    putusHariIni: Boolean(putusan && hari && putusan.tanggal === hari),
    saldo: saldoAwal,
    alasan: "",
    butir: [],
    kirim: [],
  };
  if (!dasar.putusHariIni) {
    dasar.alasan = putusan ? `Diputus ${putusan.tanggal}, bukan ${hari}.` : "Belum diputus.";
    return dasar;
  }
  if (Number((k && k.pembiayaan) || 1) !== 1) {
    dasar.alasan = "Perkara prodeo - jurnalnya diisi di SIPP.";
    return dasar;
  }

  const hasil = kasir.susunUsulan(k);
  const usulan = hasil.usulan;
  const kurangPanjar = usulan.some((u) => u.tambahPanjar);
  const statusPutusan = Number(putusan.statusId) || 0;
  const talakKabul = Number(perkara.jenisPerkaraId) === 346 && statusPutusan === 62;
  const cabut = keadaan.kunci === "cabut";

  /** Alasan bila baris non-sisa ini TIDAK pantas ditulis tanpa dilihat; "" = pantas. */
  const alasanTolak = (u, b) => {
    if (!aktif.has(b.kunci)) return "Butir ini dimatikan kasir.";
    if (kurangPanjar) return "Saldo panjar kurang - perlu Tambahan Panjar lebih dulu (dikerjakan kasir sendiri).";
    if (!u.tersedia) return "Jenis biaya ini tidak tersedia untuk alur perkara di SIPP.";
    if (!u.pilih) return `Ditawarkan tanpa centang (yakin ${u.yakin}) - kasir yang memutuskan di Kasir per perkara.`;
    if (u.yakin !== "tinggi") return `Yakin ${u.yakin} - periksa di Kasir per perkara.`;
    if (!(Number(u.jumlah) > 0)) return "Tarif belum diketahui - isi jumlahnya di Kasir per perkara.";
    if (u.perluResi) return "Nomor resi Pos belum ada.";
    if (u.tanggal !== hari) return `Bertanggal ${u.tanggal}, bukan hari putus.`;
    if ((b.kunci === "pnbp-pbt" || b.kunci === "biaya-pbt") && !KEADAAN_PBT_OTOMATIS.has(keadaan.kunci)) {
      return `Pemberitahuan putusan pada keadaan "${keadaan.nama}" tidak selalu ditulis kasir - periksa di Kasir per perkara.`;
    }
    return "";
  };

  const akan = new Set();
  const catat = new Map(); // usulan -> { status, alasan }
  for (const u of usulan) {
    if (u.sisaOtomatis || u.kejadian !== "putusan") continue;
    const b = butirJenis(u.jenisBiayaId);
    if (!b) continue;
    const alasan = alasanTolak(u, b);
    catat.set(u, { status: alasan ? "dilewati" : "akan", alasan });
    if (!alasan) akan.add(u);
  }

  // Saldo yang tidak cukup untuk baris yang akan ditulis (mesin menawarkan
  // Tambahan Panjar hanya bila jenis 224 tersedia untuk alurnya): tidak satu
  // pun ditulis - jurnal SIPP tidak boleh minus karena kasir otomatis.
  const sesudahBiaya = [...akan].reduce((s, u) => s + (Number(u.jenisTransaksi) || -1) * (Number(u.jumlah) || 0), saldoAwal);
  if (sesudahBiaya < 0) {
    for (const u of akan) catat.set(u, { status: "dilewati", alasan: `Saldo panjar kurang ${rupiah(-sesudahBiaya)} - perlu Tambahan Panjar lebih dulu (dikerjakan kasir sendiri).` });
    akan.clear();
  }

  // Sisa panjar: terakhir, sesudah seluruh usulan tercentang lain tercatat.
  const sisa = usulan.find((u) => u.sisaOtomatis);
  if (sisa) {
    let alasan = "";
    // Yang tertunda: usulan tercentang kejadian apa pun, DAN usulan hari putus
    // yang ditawarkan tanpa centang (uji balik: tidak dapat diterima/permohonan
    // - kasir sering menulis PNBP PBT Penggugat yang ditawarkan itu; sisa yang
    // dihitung tanpanya keliru 10 dari 16).
    const tertunda = usulan.filter(
      (u) => !u.sisaOtomatis && !u.tambahPanjar && !akan.has(u) && (u.pilih || u.kejadian === "putusan")
    );
    // Dicabut, pemberitahuan putusan kepada Tergugat tercatat lewat Pos: kasir
    // menulis biaya pemberitahuan 8 dari 10 kali - mesin tidak mengusulkannya
    // pada perkara dicabut, maka sisa panjar ditahan.
    const pbtPosCabut =
      cabut && (Array.isArray(k.pemberitahuan) ? k.pemberitahuan : []).some((x) => Number(x.pihakKe) === 2 && ["S", "P"].includes(bersih(x.ket).toUpperCase()));
    const jumlah = [...akan].reduce((s, u) => s + (Number(u.jenisTransaksi) || -1) * (Number(u.jumlah) || 0), saldoAwal);
    if (!aktif.has("psp")) alasan = "Butir ini dimatikan kasir.";
    else if (kurangPanjar) alasan = "Saldo panjar kurang - perlu Tambahan Panjar lebih dulu.";
    else if (sisa.kejadian !== "putusan") alasan = "Sisa panjar cerai talak dikembalikan pada hari ikrar talak.";
    else if (pbtPosCabut) alasan = "Perkara dicabut, tetapi pemberitahuan putusan kepada Tergugat tercatat lewat Pos - periksa biaya pemberitahuannya dulu.";
    else if (tertunda.length)
      alasan = `Masih ada ${tertunda.length} usulan yang belum dijurnal (${tertunda
        .slice(0, 3)
        .map((u) => u.uraian)
        .join(", ")}${tertunda.length > 3 ? ", ..." : ""}) - sisa panjar menunggu semuanya tercatat.`;
    else if (!(jumlah > 0)) alasan = jumlah < 0 ? `Saldo panjar kurang ${rupiah(-jumlah)}.` : "Saldo panjar habis - tidak ada yang dikembalikan.";
    else if (sisa.tanggal !== hari) alasan = `Bertanggal ${sisa.tanggal}, bukan hari putus.`;
    // Jumlah yang ditampilkan/ditulis = saldo sesudah baris yang AKAN ditulis saja.
    sisa.jumlah = jumlah;
    if (!alasan) akan.add(sisa);
    catat.set(sisa, { status: alasan ? "dilewati" : "akan", alasan });
  }

  // Keadaan per butir: yang sudah di jurnal, yang akan ditulis, yang dilewati.
  for (const b of BUTIR_OTOMATIS) {
    const baris = [];
    for (const j of jurnal) {
      if (!b.jenis.includes(Number(j.jenisBiayaId))) continue;
      baris.push({ status: "sudah", uraian: bersih(j.uraian), jumlah: Number(j.jumlah) || 0, tanggal: kasir.tanggalSah(j.tanggal), alasan: "" });
    }
    for (const [u, c] of catat) {
      if (!b.jenis.includes(Number(u.jenisBiayaId))) continue;
      baris.push({ status: c.status, uraian: u.uraian, jumlah: u.jumlah === null || u.jumlah === undefined ? null : Number(u.jumlah), tanggal: u.tanggal, alasan: c.alasan });
    }
    let status = "tidak-berlaku";
    if (baris.some((x) => x.status === "akan")) status = "akan";
    else if (baris.some((x) => x.status === "dilewati")) status = "dilewati";
    else if (baris.some((x) => x.status === "sudah")) status = "sudah";
    let alasan = "";
    if (status === "tidak-berlaku") {
      if (b.kunci === "pnbp-cabut") alasan = cabut ? "Mesin tidak mengusulkannya." : "Bukan perkara dicabut.";
      else if (b.kunci === "psp") alasan = talakKabul ? "Cerai talak dikabulkan - sisa panjar dikembalikan pada hari ikrar talak." : "Saldo panjar habis - tidak ada sisa.";
      else if (b.kunci === "pnbp-pbt" || b.kunci === "biaya-pbt") alasan = cabut ? "Perkara dicabut - tanpa pemberitahuan putusan." : "Tidak ada pemberitahuan putusan yang berlaku (para pihak hadir / elektronik).";
      else alasan = "Tidak diusulkan.";
    }
    dasar.butir.push({ kunci: b.kunci, nama: b.nama, aktif: aktif.has(b.kunci), status, alasan, baris });
  }
  dasar.kirim = usulan.filter((u) => akan.has(u)).map((u) => ({ ...u }));
  if (!dasar.kirim.length) dasar.alasan = dasar.butir.some((b) => b.status === "dilewati") ? "Ada butir yang dilewati - periksa di Kasir per perkara." : "Jurnal hari putus sudah lengkap.";
  return dasar;
}

/**
 * ============================================================================
 * LAYANAN
 * ============================================================================
 */
function buatLayanan(deps = {}) {
  const jurnal = deps.jurnal || kasir.layanan();
  const jamKerjaService = deps.jamKerja || require("./jamKerjaService");
  const sekarangSatker = deps.sekarang || (() => jamKerjaService.sekarangSatker());
  const antrean = () => deps.antrean || require("./antreanTulisSippService").layanan();
  const antreanAktif = () => (deps.antrean ? true : require("./antreanTulisSippService").aktif());
  const kueri =
    deps.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const kueriAleta =
    deps.kueriAleta ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../bot_db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const sedang = new Set();
  // Isi lama kolom waktu dipindah ke UTC sebelum tulisan pertama (botDbService).
  // Basis data tiruan (uji) tidak dimigrasi kecuali disebut tegas.
  const migrasiUtc = deps.migrasiUtc || (deps.kueriAleta ? async () => {} : () => require("./botDbService").pastikanUtc());
  const sqlSetempat = (kolom) => require("../utils/waktuUtc").sqlSetempat(kolom);

  async function semua(sql, params) {
    const baris = await kueri(sql, params);
    return Array.isArray(baris) ? baris : [];
  }

  async function hariIniBasisData() {
    const b = await semua("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d') AS hari", []);
    const hari = kasir.tanggalSah(b[0] && b[0].hari);
    if (!hari) throw new Error("jam_basis_data_tidak_terbaca");
    return hari;
  }

  // ─── Setelan (basis data ALETA bot - satu baris untuk satker) ─────────────

  let siap = null;
  function pastikanTabel() {
    if (siap) return siap;
    siap = kueriAleta(`
      CREATE TABLE IF NOT EXISTS ${TABEL_SETELAN} (
        id TINYINT UNSIGNED NOT NULL,
        nyala TINYINT(1) NOT NULL DEFAULT 0,
        butir VARCHAR(300) NOT NULL DEFAULT '',
        diubah_oleh VARCHAR(120) NOT NULL DEFAULT '',
        diubah DATETIME NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
      .then(() => migrasiUtc())
      .catch((galat) => {
        siap = null;
        throw galat;
      });
    return siap;
  }

  /** Setelan saklar. Belum pernah disimpan = MATI, seluruh butir terpilih. */
  async function bacaSetelan() {
    await pastikanTabel();
    const baris = await kueriAleta(
      `SELECT nyala, butir, diubah_oleh AS diubahOleh, DATE_FORMAT(${sqlSetempat("diubah")}, '%Y-%m-%d %H:%i:%s') AS diubah FROM ${TABEL_SETELAN} WHERE id = 1 LIMIT 1`,
      []
    );
    const b = Array.isArray(baris) && baris[0];
    if (!b) return { nyala: false, butir: BUTIR_BAWAAN.slice(), diubahOleh: "", diubah: "" };
    let butir;
    try {
      butir = butirSah(JSON.parse(bersih(b.butir) || "null"));
    } catch {
      butir = BUTIR_BAWAAN.slice();
    }
    return { nyala: Number(b.nyala) === 1, butir, diubahOleh: bersih(b.diubahOleh), diubah: bersih(b.diubah) };
  }

  async function simpanSetelan(minta = {}) {
    const operator = bersih(minta.operator).slice(0, 120);
    if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };
    const lama = await bacaSetelan();
    const nyala = typeof minta.nyala === "boolean" ? minta.nyala : lama.nyala;
    const butir = Array.isArray(minta.butir) ? butirSah(minta.butir) : lama.butir;
    await kueriAleta(
      `INSERT INTO ${TABEL_SETELAN} (id, nyala, butir, diubah_oleh, diubah) VALUES (1, ?, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE nyala = VALUES(nyala), butir = VALUES(butir), diubah_oleh = VALUES(diubah_oleh), diubah = UTC_TIMESTAMP()`,
      [nyala ? 1 : 0, JSON.stringify(butir), operator]
    );
    return { ok: true, setelan: await bacaSetelan() };
  }

  // ─── Daftar perkara putus satu hari (hanya SELECT) ─────────────────────────

  async function daftar(tanggal, opsi = {}) {
    const hariIni = await hariIniBasisData();
    const hari = kasir.tanggalSah(tanggal) || hariIni;
    const setelan = opsi.setelan || (await bacaSetelan().catch(() => ({ nyala: false, butir: BUTIR_BAWAAN.slice(), diubahOleh: "", diubah: "", galat: true })));
    const butir = Array.isArray(opsi.butir) ? butirSah(opsi.butir) : setelan.butir;
    const batas = Math.max(1, Math.min(150, Number(opsi.batas) || 120));
    // Putus hari itu: perkara_putusan bertanggal itu, atau sidang hari itu
    // yang tidak ditunda (putusan belum diinput - dibaca dari hasil sidang).
    const calon = await semua(
      `SELECT x.perkara_id AS perkaraId FROM (
         SELECT perkara_id FROM perkara_putusan WHERE tanggal_putusan = ?
         UNION SELECT perkara_id FROM perkara_jadwal_sidang WHERE tanggal_sidang = ? AND (ditunda IS NULL OR ditunda <> 'Y')
       ) x ORDER BY x.perkara_id ASC LIMIT ?`,
      [hari, hari, batas + 1]
    );
    const antre = calon.slice(0, batas);
    const perkara = [];
    const gagal = [];
    let ke = 0;
    const pekerja = async () => {
      while (ke < antre.length) {
        const c = antre[ke];
        ke += 1;
        try {
          const baca = await jurnal.bacaKeadaan(c.perkaraId);
          if (!baca.ok) {
            gagal.push({ perkaraId: Number(c.perkaraId), alasan: baca.alasan });
            continue;
          }
          const r = rencanaOtomatis(baca.keadaan, { hari, butir });
          if (!r.putusHariIni) continue;
          perkara.push({ ...r, kirim: r.kirim.map((u) => ({ jenisBiayaId: u.jenisBiayaId, uraian: u.uraian, jumlah: u.jumlah, tanggal: u.tanggal })) });
        } catch (galat) {
          gagal.push({ perkaraId: Number(c.perkaraId), alasan: String((galat && galat.message) || galat).slice(0, 200) });
        }
      }
    };
    await Promise.all([pekerja(), pekerja(), pekerja(), pekerja()]);
    perkara.sort((a, b) => a.perkaraId - b.perkaraId);
    return {
      ok: true,
      tanggal: hari,
      hariIni,
      setelan,
      butirDaftar: BUTIR_OTOMATIS.map((b) => ({ kunci: b.kunci, nama: b.nama, ukur: b.ukur })),
      perkara,
      gagal,
      terpotong: calon.length > batas,
      ringkas: {
        perkara: perkara.length,
        akanDiisi: perkara.filter((p) => p.kirim.length).length,
        baris: perkara.reduce((s, p) => s + p.kirim.length, 0),
      },
    };
  }

  // ─── Jalankan satu perkara ─────────────────────────────────────────────────

  /**
   * Menulis butir hari putus SATU perkara atas akun SIPP petugas yang masuk.
   * Saklar dibaca DI SINI (bukan dipercaya dari peramban): mati = tidak ada
   * satu pun tulisan. Butir yang ditulis = butir setelan. Hanya hari ini.
   */
  async function jalankanPerkara(minta = {}) {
    const perkaraId = Number(minta.perkaraId);
    if (!Number.isInteger(perkaraId) || perkaraId <= 0) return { ok: false, alasan: "Perkara tidak dikenali." };
    const operator = bersih(minta.operator);
    if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };
    const setelan = await bacaSetelan();
    if (!setelan.nyala) return { ok: false, alasan: "saklar_mati", pesan: "Kasir otomatis sedang MATI - tidak ada yang ditulis." };
    if (sedang.has(perkaraId)) return { ok: false, alasan: "sedang_dikerjakan", pesan: "Perkara ini sedang dikerjakan Kasir otomatis lain - dilewati." };
    sedang.add(perkaraId);
    try {
      const baca = await jurnal.bacaKeadaan(perkaraId);
      if (!baca.ok) return { ok: false, alasan: baca.alasan };
      const k = baca.keadaan;
      const r = (deps.rencanaOtomatis || rencanaOtomatis)(k, { hari: k.hariIni, butir: setelan.butir });
      if (!r.putusHariIni) return { ok: true, kosong: true, rencana: r, pesan: r.alasan || "Bukan perkara putus hari ini." };
      if (!r.kirim.length) return { ok: true, kosong: true, rencana: r, pesan: r.alasan };
      const muatan = { perkaraId, baris: r.kirim.map(barisKirim), akunSipp: minta.akunSipp, operator, ip: minta.ip };
      // ======================================================================
      // DI LUAR JAM KERJA: DIANTREKAN (keputusan 104, 18 Okt 2026)
      // ======================================================================
      // Kasir otomatis tidak sedang diklik siapa pun. Di luar jam kerja / hari
      // libur barisnya (beserta tanggal transaksinya = tanggal peristiwa)
      // disimpan di antrean ALETA dan ditulis pada jam kerja berikutnya. Kunci
      // per perkara per hari putus: picuan 10 menit berikutnya tidak dobel.
      if (minta.kering === false && antreanAktif() && !jamKerjaService.dalamJamKerja(sekarangSatker())) {
        const a = await antrean().antrekan({
          jenis: "kasir-otomatis",
          kunci: `kasir-otomatis:${perkaraId}:${k.hariIni}`,
          muatan,
          keterangan: `Kasir otomatis ${r.kirim.length} baris`,
        });
        return { ok: a.ok === true, diantrekan: true, kering: false, rencana: r, dikerjakanPada: a.dikerjakanPada, pesan: a.kalimat || a.alasan };
      }
      return await tulisMuatan(muatan, { kering: minta.kering !== false, rencanaOtomatis: r });
    } finally {
      sedang.delete(perkaraId);
    }
  }

  /**
   * Menulis baris Kasir otomatis yang sudah disusun - dipanggil langsung atau
   * oleh antrean jam kerja (muatan apa adanya: tanggal transaksi tidak berubah).
   * sekaliPerJenis menjaga agar baris yang sudah tertulis tidak ditulis lagi.
   */
  async function tulisMuatan(muatan, { kering = false, rencanaOtomatis: r = null } = {}) {
    {
      const perkaraId = Number(muatan.perkaraId);
      const rencana = await jurnal.susunRencana({ perkaraId, baris: muatan.baris, akunSipp: muatan.akunSipp, operator: muatan.operator, ip: muatan.ip });
      if (!rencana.ok) return { ...rencana, rencana: r };
      // Satu baris ditolak pagar SIPP = sisa panjar yang dihitung atasnya
      // tidak lagi benar: sisa ditahan.
      if (rencana.ditolak.length) {
        rencana.langkah = rencana.langkah.filter((l) => {
          if (Number(l.nilai.jenisBiayaId) !== JB.SISA) return true;
          rencana.ditolak.push({ ke: l.ke, uraian: l.nilai.uraian, pesan: "sisa panjar ditahan - baris lain ditolak" });
          return false;
        });
      }
      if (!rencana.langkah.length) return { ok: false, kering, rencana: r, ditolak: rencana.ditolak, dilewati: rencana.dilewati, pesan: "Tidak ada baris yang lolos pagar SIPP." };
      const hasil = await jurnal.jalankanRencana(rencana, { kering, sekaliPerJenis: true, periksaSisa: true });
      return {
        ...hasil,
        rencana: r,
        perkara: rencana.perkara,
        akunSipp: rencana.akunSipp,
        ditolak: rencana.ditolak,
        dilewati: rencana.dilewati,
        langkahDatar: jurnal.langkahDatar(rencana),
      };
    }
  }

  return { bacaSetelan, simpanSetelan, daftar, jalankanPerkara, tulisMuatan };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  BUTIR_OTOMATIS,
  BUTIR_BAWAAN,
  KUNCI_BUTIR,
  TABEL_SETELAN,
  butirSah,
  rencanaOtomatis,
  buatLayanan,
  bacaSetelan: () => layananBawaan().bacaSetelan(),
  simpanSetelan: (minta) => layananBawaan().simpanSetelan(minta),
  daftar: (tanggal, opsi) => layananBawaan().daftar(tanggal, opsi),
  jalankanPerkara: (minta) => layananBawaan().jalankanPerkara(minta),
  tulisMuatan: (muatan, opsi) => layananBawaan().tulisMuatan(muatan, opsi),
};
