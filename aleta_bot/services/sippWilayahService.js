"use strict";

/**
 * ============================================================================
 * WILAYAH SIPP BERTINGKAT - PROVINSI > KABUPATEN/KOTA > KECAMATAN > DESA
 * ============================================================================
 *
 * Dipakai fitur "isi data saksi/pihak dari foto KTP" (perbaikan 2 Okt 2026,
 * butir 16, kontrak K5). Blangko SIPP "Tambah Referensi Data Pihak"
 * (views/pihak/pihak_list.php) memilih wilayah lewat empat select2 bertingkat
 * (#prop #kab #kec #kel) yang dimuat addPihak/cariProp..cariKel. Yang
 * tersimpan ke tabel `pihak` adalah KODE wilayah dari empat tabel rujukan:
 *
 *     ref_provinsi_new   provinsi_kode  "72"
 *     ref_kabupaten_new  kabupaten_kode "72.03"          induk provinsi_kode
 *     ref_kecamatan_new  kecamatan_kode "72.03.08"       induk kabupaten_kode
 *     ref_kelurahan_new  kelurahan_kode "72.03.08.1020"  induk kecamatan_kode
 *
 * (diukur atas sipp_donggala 2 Okt 2026: 83.324 desa; desa terbanyak dalam
 * satu kecamatan 108, kecamatan terbanyak dalam satu kabupaten 51, kabupaten
 * terbanyak dalam satu provinsi 38.)
 *
 * TINGKATNYA DIBACA DARI BENTUK KODE INDUK, BUKAN DARI TEBAKAN NAMA
 *
 * Kode Kemendagri bertitik itu sendiri sudah menyebut tingkatnya: induk kosong
 * = daftar provinsi, satu ruas = kabupaten di provinsi itu, dua ruas =
 * kecamatan, tiga ruas = desa. Yang tidak berbentuk itu ditolak - tidak ada
 * yang "dicari kira-kira" di sini. Mencocokkan nama hasil baca KTP dikerjakan
 * di ekstensi, di depan mata petugas, atas daftar yang dipulangkan berkas ini.
 *
 * NILAI PILIHAN BERSANDI - SAMA DENGAN YANG DICETAK SIPP SENDIRI
 *
 * cariProp..cariKel memulangkan id = base64_encode($this->encrypt->encode(
 * kode)), dan pihak_list::validateInput mendekodenya kembali sebelum disimpan.
 * Kode polos di dalam <option> akan didekode menjadi sampah dan tersimpan
 * sebagai wilayah kosong - tanpa satu pesan pun. Karena itu tiap baris
 * membawa `nilaiSipp` dari penyandi yang SAMA dengan tautan perkara
 * (sippTautanService.nilaiPilihanSipp, diuji silang dengan PHP SIPP). Bila
 * kunci SIPP tidak terbaca, `nilaiSipp` null dan `sandi.ok` false: ekstensi
 * lalu menolak mengisi wilayah dan meminta petugas memilihnya sendiri -
 * lebih baik tidak terisi daripada terisi sesuatu yang tidak dapat dibaca
 * SIPP.
 *
 * SIPP HANYA DIBACA: seluruh kueri SELECT, nilai dari luar selalu parameter.
 */

const db = require("../db_config");

const TINGKAT = [
  { nama: "provinsi", tabel: "ref_provinsi_new", kode: "provinsi_kode", namaKolom: "provinsi_nama", induk: null },
  { nama: "kabupaten", tabel: "ref_kabupaten_new", kode: "kabupaten_kode", namaKolom: "kabupaten_nama", induk: "provinsi_kode" },
  { nama: "kecamatan", tabel: "ref_kecamatan_new", kode: "kecamatan_kode", namaKolom: "kecamatan_nama", induk: "kabupaten_kode" },
  { nama: "kelurahan", tabel: "ref_kelurahan_new", kode: "kelurahan_kode", namaKolom: "kelurahan_nama", induk: "kecamatan_kode" },
];

/** "72" | "72.03" | "72.03.08" | "72.03.08.1020" - ruas angka dipisah titik. */
const POLA_KODE = /^\d{2}(?:\.\d{2}(?:\.\d{2}(?:\.\d{4})?)?)?$/;
/** Lebih dari cukup untuk satu induk (terbanyak terukur 108). */
const BATAS_BARIS = 300;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** `kode` ikut dipulangkan: gatewayFetch portal membedakan "ditolak" dari "tak terjangkau" lewat itu. */
function gagal(alasan, message) {
  return { ok: false, alasan, kode: alasan, message };
}

/** Jumlah ruas kode (0 = kosong). */
function ruasKode(kode) {
  const k = String(kode || "").trim();
  return k ? k.split(".").length : 0;
}

/**
 * Penyandi nilai pilihan. Dimuat malas dan boleh tidak ada: tanpa penyandi
 * daftar wilayah tetap berguna untuk ditinjau, hanya tidak dapat diisikan.
 */
function sandikan(kode) {
  try {
    // eslint-disable-next-line global-require
    const tautan = require("./sippTautanService");
    if (typeof tautan.nilaiPilihanSipp !== "function") {
      return { ok: false, alasan: "penyandi_tidak_ada", message: "Penyandi nilai SIPP belum tersedia di ALETA Bot." };
    }
    return tautan.nilaiPilihanSipp(kode);
  } catch (galat) {
    return { ok: false, alasan: "penyandi_gagal", message: String(galat && galat.message ? galat.message : galat).slice(0, 200) };
  }
}

function bersihNama(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Anak satu induk. `induk` kosong = daftar provinsi.
 *
 * Dipulangkan: { ok, tingkat, induk, sandi: {ok, message?}, data: [{kode, nama, nilaiSipp}] }
 */
async function daftarWilayah({ induk } = {}) {
  const kodeInduk = String(induk === undefined || induk === null ? "" : induk).trim();
  if (kodeInduk && !POLA_KODE.test(kodeInduk)) {
    return gagal("induk_tidak_sah", "Kode wilayah induk tidak sah.");
  }
  const ruas = ruasKode(kodeInduk);
  if (ruas >= TINGKAT.length) {
    return gagal("tanpa_anak", "Kelurahan/desa adalah tingkat terakhir - tidak punya anak wilayah.");
  }
  const t = TINGKAT[ruas];

  let baris;
  try {
    baris = t.induk
      ? await runQuery(
          `SELECT ${t.kode} AS kode, ${t.namaKolom} AS nama
             FROM ${t.tabel}
            WHERE ${t.induk} = ?
            ORDER BY ${t.namaKolom}
            LIMIT ${BATAS_BARIS}`,
          [kodeInduk]
        )
      : await runQuery(
          `SELECT ${t.kode} AS kode, ${t.namaKolom} AS nama
             FROM ${t.tabel}
            ORDER BY ${t.namaKolom}
            LIMIT ${BATAS_BARIS}`
        );
  } catch (galat) {
    console.warn(`[sippWilayah] ${t.tabel} tidak terbaca: ${galat.message}`);
    return gagal("sipp_tidak_terbaca", "Data wilayah SIPP tidak dapat dibaca saat ini.");
  }

  let sandi = { ok: true };
  const data = [];
  for (const b of baris) {
    const kode = bersihNama(b.kode);
    const nama = bersihNama(b.nama);
    if (!kode || !nama) continue;
    let nilaiSipp = null;
    if (sandi.ok) {
      const s = sandikan(kode);
      if (s && s.ok) nilaiSipp = s.nilai;
      else sandi = { ok: false, alasan: (s && s.alasan) || "penyandi_gagal", message: (s && s.message) || "" };
    }
    data.push({ kode, nama, nilaiSipp });
  }
  // Satu kegagalan sandi = seluruh daftar tanpa nilai: separuh terisi lebih
  // menyesatkan daripada tidak sama sekali.
  if (!sandi.ok) for (const d of data) d.nilaiSipp = null;

  return { ok: true, tingkat: t.nama, induk: kodeInduk, sandi, data };
}

/**
 * Rantai wilayah sampai satu kode: [{tingkat, kode, nama, nilaiSipp}] dari
 * provinsi ke bawah. Dipakai untuk usulan "menurut NIK" - enam angka pertama
 * NIK adalah kode kecamatan tempat KTP diterbitkan.
 */
async function jalurWilayah({ kode } = {}) {
  const k = String(kode === undefined || kode === null ? "" : kode).trim();
  if (!k || !POLA_KODE.test(k)) return gagal("kode_tidak_sah", "Kode wilayah tidak sah.");
  const ruas = k.split(".");
  const hasil = [];
  let sandi = { ok: true };
  for (let i = 0; i < ruas.length; i += 1) {
    const t = TINGKAT[i];
    const kodeIni = ruas.slice(0, i + 1).join(".");
    let baris;
    try {
      baris = await runQuery(
        `SELECT ${t.kode} AS kode, ${t.namaKolom} AS nama FROM ${t.tabel} WHERE ${t.kode} = ? LIMIT 1`,
        [kodeIni]
      );
    } catch (galat) {
      console.warn(`[sippWilayah] ${t.tabel} tidak terbaca: ${galat.message}`);
      return gagal("sipp_tidak_terbaca", "Data wilayah SIPP tidak dapat dibaca saat ini.");
    }
    if (!baris[0]) {
      return { ok: true, lengkap: false, sandi, data: hasil, berhentiDi: t.nama };
    }
    let nilaiSipp = null;
    if (sandi.ok) {
      const s = sandikan(kodeIni);
      if (s && s.ok) nilaiSipp = s.nilai;
      else sandi = { ok: false, alasan: (s && s.alasan) || "penyandi_gagal", message: (s && s.message) || "" };
    }
    hasil.push({ tingkat: t.nama, kode: bersihNama(baris[0].kode), nama: bersihNama(baris[0].nama), nilaiSipp });
  }
  if (!sandi.ok) for (const d of hasil) d.nilaiSipp = null;
  return { ok: true, lengkap: true, sandi, data: hasil };
}

/**
 * ============================================================================
 * DAFTAR RINGKAS SATU PROVINSI (22 Okt 2026) - untuk "ketik nama desa"
 * ============================================================================
 *
 * Ekstensi mengisi alamat lengkap dari awal nama desa/kelurahan atau kecamatan.
 * Supaya tidak ada permintaan per ketikan, seluruh provinsi diambil SEKALI,
 * dipadatkan, dan disimpan di peramban (30 hari). Bentuknya:
 *
 *   { ok, versi, provinsi:{kode,nama},
 *     kab:  [["72.03","KAB. DONGGALA"], ...],
 *     kec:  [["72.03.11","SINDUE"], ...],
 *     desa: { "72.03.11": [["2001","DALAKA"], ["1001","SINDUE"]], ... } }
 *
 * Kode desa penuh = kunci kecamatan + "." + ruas empat angka. TANPA nilaiSipp:
 * nilai bersandi ratusan karakter per desa akan menggembungkan muatan; ekstensi
 * memintanya untuk SATU desa terpilih lewat ?kode= (jalurWilayah). Hanya SELECT,
 * kode provinsi dibatasi dua angka, dan hasil diingat 12 jam di memori bot
 * (data wilayah praktis tidak berubah).
 */
const RINGKAS_VERSI = 1;
const RINGKAS_UMUR_MS = 12 * 60 * 60 * 1000;
const RINGKAS_BATAS = 30000;
const singgahRingkas = new Map();

async function daftarRingkas({ provinsi } = {}) {
  const kode = String(provinsi === undefined || provinsi === null ? "" : provinsi).trim();
  if (!/^\d{2}$/.test(kode)) return gagal("provinsi_tidak_sah", "Kode provinsi harus dua angka.");
  const ada = singgahRingkas.get(kode);
  if (ada && Date.now() - ada.waktu < RINGKAS_UMUR_MS) return ada.hasil;

  let prov;
  let kab;
  let kec;
  let desa;
  try {
    prov = await runQuery("SELECT provinsi_kode AS kode, provinsi_nama AS nama FROM ref_provinsi_new WHERE provinsi_kode = ? LIMIT 1", [kode]);
    if (!prov[0]) return gagal("provinsi_tidak_ada", "Provinsi tidak ditemukan.");
    const awalan = `${kode}.%`;
    kab = await runQuery(
      `SELECT kabupaten_kode AS kode, kabupaten_nama AS nama FROM ref_kabupaten_new WHERE provinsi_kode = ? ORDER BY kabupaten_kode LIMIT ${RINGKAS_BATAS}`,
      [kode]
    );
    kec = await runQuery(
      `SELECT kecamatan_kode AS kode, kecamatan_nama AS nama FROM ref_kecamatan_new WHERE kecamatan_kode LIKE ? ORDER BY kecamatan_kode LIMIT ${RINGKAS_BATAS}`,
      [awalan]
    );
    desa = await runQuery(
      `SELECT kelurahan_kode AS kode, kelurahan_nama AS nama FROM ref_kelurahan_new WHERE kelurahan_kode LIKE ? ORDER BY kelurahan_kode LIMIT ${RINGKAS_BATAS}`,
      [awalan]
    );
  } catch (galat) {
    console.warn(`[sippWilayah] ringkas ${kode} tidak terbaca: ${galat.message}`);
    return gagal("sipp_tidak_terbaca", "Data wilayah SIPP tidak dapat dibaca saat ini.");
  }

  const pasang = (baris) => baris.map((b) => [bersihNama(b.kode), bersihNama(b.nama)]).filter(([k, n]) => k && n);
  const kelompok = {};
  for (const [kodeDesa, nama] of pasang(desa)) {
    const m = /^(\d{2}\.\d{2}\.\d{2})\.(\d{4})$/.exec(kodeDesa);
    if (!m) continue;
    (kelompok[m[1]] = kelompok[m[1]] || []).push([m[2], nama]);
  }
  const hasil = {
    ok: true,
    versi: RINGKAS_VERSI,
    provinsi: { kode: bersihNama(prov[0].kode), nama: bersihNama(prov[0].nama) },
    kab: pasang(kab),
    kec: pasang(kec),
    desa: kelompok,
  };
  singgahRingkas.set(kode, { waktu: Date.now(), hasil });
  return hasil;
}

/** Pintu rute: ?induk= daftar anak, ?kode= rantai sampai kode itu. */
async function jawabRute(query = {}) {
  const kode = String(query.kode || "").trim();
  if (query.ringkas !== undefined) {
    const ringkas = await daftarRingkas({ provinsi: query.provinsi });
    return { status: ringkas.ok ? 200 : ringkas.alasan === "sipp_tidak_terbaca" ? 500 : 400, body: ringkas };
  }
  const hasil = kode ? await jalurWilayah({ kode }) : await daftarWilayah({ induk: query.induk });
  if (hasil.ok) return { status: 200, body: hasil };
  const status = hasil.alasan === "sipp_tidak_terbaca" ? 500 : 400;
  return { status, body: hasil };
}

module.exports = {
  daftarWilayah,
  daftarRingkas,
  jalurWilayah,
  jawabRute,
  POLA_KODE,
  TINGKAT,
};
