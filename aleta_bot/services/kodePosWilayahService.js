"use strict";

/**
 * ============================================================================
 * KODE POS ALAMAT PIHAK - SATU ATURAN UNTUK AMPLOP RELAAS ALETA
 * ============================================================================
 *
 * Diminta pengguna (hakim Derry, 21 Okt 2026): "Tambahkan di amplop relaas di
 * ujung identitas itu kode posnya, setahuku ada kode posnya di tabel di SIPP".
 *
 * SIPP memang punya tabel `kode_pos` (province, district, subdistrict, area,
 * post_code; 82.818 baris se-Indonesia), tetapi alamat pihak TIDAK menyimpan
 * kode pos. Tabel `pihak` menyimpan KODE WILAYAH (kelurahan '72.10.01.2009',
 * kecamatan '72.10.01', kabupaten '72.10'), dan teks alamat bebasnya tidak
 * seragam. Jalannya: kode wilayah -> nama desa/kecamatan/kabupaten/provinsi
 * (ref_kelurahan_new, ref_kecamatan_new, ref_kabupaten_new, ref_provinsi_new)
 * -> kode pos (kode_pos).
 *
 * ============================================================================
 * ATURAN - KODE POS HANYA BILA PASTI; TIDAK PERNAH MENEBAK
 * ============================================================================
 *
 *   1. Cocokkan provinsi + kabupaten/kota + kecamatan + desa (nama dinormalkan:
 *      huruf besar-kecil, spasi, tanda hubung, titik, awalan "Kabupaten"/"Kota"
 *      tidak dibedakan). Hasilnya TEPAT SATU kode pos -> dipakai.
 *   2. Desa cocok tetapi punya lebih dari satu kode pos -> KOSONG (desa-ganda).
 *   3. Desa tidak ada di kode_pos (ejaan lain / desa pemekaran) tetapi
 *      kecamatannya hanya punya SATU kode pos -> dipakai (tingkat "kecamatan").
 *   4. Kecamatan punya beberapa kode pos dan desanya tidak cocok -> KOSONG.
 *      Salah kode pos lebih buruk daripada tanpa kode pos: amplop tercetak
 *      "pasti" padahal salah, sedangkan yang kosong terlihat petugas.
 *
 * Aturan yang SAMA ditulis di SQL variabel ABT 9290/9291 (paket
 * abt-paket/x5-kodepos-amplop-21okt): amplop dicetak ABT dari blangko RTF
 * Derry, bukan oleh bot, sehingga yang tampil di kertas adalah kueri ABT.
 * Berkas ini adalah rujukan terbaca-uji dari aturan itu (uji vitest
 * kodepos-amplop-21okt.test.ts), dipakai juga oleh skrip ukur, dan dapat
 * dipanggil bot untuk keperluan ALETA lain yang membutuhkan kode pos.
 *
 * Hanya MEMBACA SIPP. Tabel referensi dibaca lewat db_config yang sama dengan
 * layanan lain; tembolok 6 jam karena tabel ini praktis statis.
 */

const TEMBOLOK_MS = 6 * 60 * 60 * 1000;
const TEMBOLOK_MAKS = 5000;

/**
 * Nama wilayah -> bentuk banding: huruf kecil, teks dalam kurung dibuang ("Bualemo (Boalemo)" -> "bualemo"),
 * tanpa spasi, tanda hubung, dan titik. SAMA dengan N() di SQL variabel 9290/9291 (paket x5).
 */
function normalNama(nilai) {
  const s = String(nilai === undefined || nilai === null ? "" : nilai);
  return s.split("(")[0].toLowerCase().replace(/[\s\-.]/g, "");
}

/** "Kabupaten Sigi" / "Kota Palu" / "Sigi" -> "sigi". */
function normalKabupaten(nilai) {
  const s = String(nilai === undefined || nilai === null ? "" : nilai).trim();
  return normalNama(s.replace(/^(kabupaten|kota)\s+/i, ""));
}

/**
 * Pilih kode pos dari baris `kode_pos` untuk satu wilayah. Murni (tanpa DB).
 *
 * @param {Array<{province:string,district:string,subdistrict:string,area:string,post_code:string}>} baris
 * @param {{provinsi:string,kabupaten:string,kecamatan:string,kelurahan:string}} wilayah
 * @returns {{kodePos: string|null, tingkat: "desa"|"kecamatan"|null, sebab: string}}
 */
function pilihKodePos(baris, wilayah) {
  const w = wilayah || {};
  const prov = normalNama(w.provinsi);
  const kab = normalKabupaten(w.kabupaten);
  const kec = normalNama(w.kecamatan);
  const kel = normalNama(w.kelurahan);
  if (!prov || !kab || !kec) return { kodePos: null, tingkat: null, sebab: "wilayah-tidak-lengkap" };
  const setKecamatan = (Array.isArray(baris) ? baris : []).filter(
    (b) =>
      normalNama(b.province) === prov && normalKabupaten(b.district) === kab && normalNama(b.subdistrict) === kec
  );
  if (!setKecamatan.length) return { kodePos: null, tingkat: null, sebab: "kecamatan-tidak-ada-di-kode-pos" };
  const kodeUnik = (daftar) => Array.from(new Set(daftar.map((b) => String(b.post_code).trim()).filter(Boolean))).sort();
  if (kel) {
    const desa = kodeUnik(setKecamatan.filter((b) => normalNama(b.area) === kel));
    if (desa.length === 1) return { kodePos: desa[0], tingkat: "desa", sebab: "" };
    if (desa.length > 1) return { kodePos: null, tingkat: null, sebab: "desa-punya-beberapa-kode-pos" };
  }
  const kecamatan = kodeUnik(setKecamatan);
  if (kecamatan.length === 1) return { kodePos: kecamatan[0], tingkat: "kecamatan", sebab: "" };
  return { kodePos: null, tingkat: null, sebab: "desa-tidak-cocok-dan-kecamatan-beberapa-kode-pos" };
}

/**
 * Letak (indeks 0) penanda surel/domisili elektronik pertama di alamat, atau -1.
 * Alamat SIPP sering berakhir "... Provinsi Sulawesi Tengah. Domisili elektronik : x@gmail.com":
 * kode pos disisipkan SEBELUM bagian itu. Surel tanpa kata pengantar: awal kata yang memuat '@'.
 */
function awalSurel(a) {
  const kandidat = [];
  for (const kata of ["domisili elektronik", "elektronik", "email", "e-mail"]) {
    const i = a.toLowerCase().indexOf(kata);
    if (i >= 0) kandidat.push(i);
  }
  const at = a.indexOf("@");
  if (at >= 0) kandidat.push(a.slice(0, at).lastIndexOf(" ") + 1);
  return kandidat.length ? Math.min(...kandidat) : -1;
}

/**
 * Tambahkan "Kode Pos NNNNN" di ujung alamat (sebelum bagian surel bila ada). Alamat yang sudah memuat kode itu
 * (atau tulisan "kode pos") tidak diubah. Tanpa kode pos pasti: alamat apa adanya.
 */
function alamatDenganKodePos(alamat, kodePos) {
  const a = String(alamat === undefined || alamat === null ? "" : alamat).trim();
  const k = String(kodePos === undefined || kodePos === null ? "" : kodePos).trim();
  if (!/^[0-9]{5}$/.test(k)) return a;
  if (/kode\s*pos/i.test(a) || new RegExp(`(^|[^0-9])${k}([^0-9]|$)`).test(a)) return a;
  const trimUjung = (s) => s.replace(/[\s,.]+$/, "");
  const surel = awalSurel(a);
  const kepala = trimUjung(surel > 0 ? a.slice(0, surel) : a);
  if (!kepala) return a;
  const ekor = surel > 0 ? `. ${a.slice(surel).trim()}` : "";
  return `${kepala}, Kode Pos ${k}${ekor}`;
}

const tembolok = new Map();

function kueri(sql, params) {
  // db_config dimuat malas: berkas ini juga diimpor uji tanpa sambungan SIPP.
  const db = require("../db_config");
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, baris) => (galat ? gagal(galat) : selesai(baris || [])));
  });
}

/**
 * Kode pos untuk satu kode kelurahan SIPP (mis. '72.10.01.2009'); `kodeKecamatan`
 * ('72.10.01') dipakai bila kelurahan kosong. Tidak pernah melempar: kegagalan
 * baca dijawab {kodePos:null, sebab:"..."} dan tidak ditembolok.
 */
async function kodePosUntukWilayah({ kodeKelurahan, kodeKecamatan } = {}, opsi = {}) {
  const kel = String(kodeKelurahan || "").trim();
  const kec = String(kodeKecamatan || "").trim();
  const kunci = kel || kec;
  if (!kunci) return { kodePos: null, tingkat: null, sebab: "wilayah-kosong" };
  const sekarang = (opsi.sekarang || Date.now)();
  const ada = tembolok.get(kunci);
  if (ada && sekarang - ada.waktu < TEMBOLOK_MS) return ada.nilai;
  const jalankan = opsi.kueri || kueri;
  let nilai;
  try {
    const wil = (
      await jalankan(
        kel
          ? `SELECT pv.provinsi_nama AS provinsi, kb.kabupaten_nama AS kabupaten, kc.kecamatan_nama AS kecamatan, kl.kelurahan_nama AS kelurahan
               FROM ref_kelurahan_new kl
               JOIN ref_kecamatan_new kc ON kc.kecamatan_kode = kl.kecamatan_kode
               JOIN ref_kabupaten_new kb ON kb.kabupaten_kode = LEFT(kl.kecamatan_kode, 5)
               JOIN ref_provinsi_new pv ON pv.provinsi_kode = LEFT(kl.kecamatan_kode, 2)
              WHERE kl.kelurahan_kode = ? LIMIT 1`
          : `SELECT pv.provinsi_nama AS provinsi, kb.kabupaten_nama AS kabupaten, kc.kecamatan_nama AS kecamatan, '' AS kelurahan
               FROM ref_kecamatan_new kc
               JOIN ref_kabupaten_new kb ON kb.kabupaten_kode = LEFT(kc.kecamatan_kode, 5)
               JOIN ref_provinsi_new pv ON pv.provinsi_kode = LEFT(kc.kecamatan_kode, 2)
              WHERE kc.kecamatan_kode = ? LIMIT 1`,
        [kunci]
      )
    )[0];
    if (!wil) {
      nilai = { kodePos: null, tingkat: null, sebab: "kode-wilayah-tidak-dikenal" };
    } else {
      const awalan = `${String(wil.kecamatan).slice(0, 2)}%`;
      const baris = await jalankan(
        "SELECT province, district, subdistrict, area, post_code FROM kode_pos WHERE subdistrict LIKE ?",
        [awalan]
      );
      nilai = pilihKodePos(baris, wil);
    }
  } catch (galat) {
    return { kodePos: null, tingkat: null, sebab: `baca-gagal: ${String((galat && galat.message) || galat).slice(0, 120)}` };
  }
  if (tembolok.size >= TEMBOLOK_MAKS) tembolok.clear();
  tembolok.set(kunci, { waktu: sekarang, nilai });
  return nilai;
}

function kosongkanTembolok() {
  tembolok.clear();
}

module.exports = {
  normalNama,
  normalKabupaten,
  pilihKodePos,
  alamatDenganKodePos,
  kodePosUntukWilayah,
  kosongkanTembolok,
};
