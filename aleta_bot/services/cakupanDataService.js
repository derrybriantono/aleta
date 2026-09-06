"use strict";

/**
 * ============================================================================
 * D10 - PENANDA CAKUPAN DATA PADA SETIAP ANGKA
 * ============================================================================
 *
 * Tiga angka berikut tampil sama meyakinkannya, dengan huruf yang sama dan
 * warna yang sama, padahal jauh berbeda dasarnya:
 *
 *   ketaatan tenggang panggilan   dihitung dari 99,8 persen relaas
 *   mutu pertimbangan hukum       dihitung dari 22,3 persen putusan
 *   amar nafkah                   dihitung dari  1,9 persen putusan
 *
 * Tidak ada yang dapat membedakannya kecuali diberi tahu. Menyajikan ketiganya
 * tanpa penanda mengundang yang ketiga dibaca sebagai keadaan seluruh
 * pengadilan - padahal ia menggambarkan 191 dari 9.989 putusan.
 *
 * ============================================================================
 * CAKUPAN BUKAN KETELITIAN
 * ============================================================================
 *
 * Keduanya sering dikira sama dan tidak boleh dicampur:
 *
 *   cakupan  - berapa bagian populasi yang RUASNYA TERISI. Angka dari 22
 *              persen putusan boleh jadi sangat teliti untuk 22 persen itu,
 *              tetapi tidak berkata apa pun tentang 78 persen sisanya.
 *   rentang  - seberapa jauh angkanya dapat meleset karena penyebutnya kecil
 *              (D17). Penyebut besar memberi rentang sempit walau cakupannya
 *              rendah.
 *
 * Sebuah penilaian dapat bercakupan rendah tetapi berpenyebut besar, dan
 * sebaliknya. Keduanya ditampilkan terpisah.
 */

const ambang = require("./ambangPenilaianService");

/** Bagaimana angka cakupan dibaca manusia. */
const TINGKAT = [
  { kunci: "penuh", batasBawah: 99.5, sebutan: "cakupan penuh" },
  { kunci: "memadai", batasBawah: 75, sebutan: "cakupan memadai" },
  { kunci: "sedang", batasBawah: 40, sebutan: "cakupan sedang" },
  { kunci: "rendah", batasBawah: 0, sebutan: "cakupan rendah" },
];

/**
 * Bilangan, atau null bila memang tidak ada.
 *
 * `Number(null)` bernilai NOL, begitu pula `Number("")` dan `Number(false)`.
 * Memakai Number apa adanya membuat cakupan yang TIDAK DIKETAHUI dilaporkan
 * sebagai NOL PERSEN - dan kedua hal itu jauh berbeda artinya: yang pertama
 * berarti "belum diukur", yang kedua berarti "sudah diukur, dan tidak ada
 * satu pun baris yang terisi". Yang kedua adalah temuan berat; yang pertama
 * hanya pekerjaan yang belum dilakukan.
 */
function angka(x) {
  if (x === null || x === undefined || x === "" || typeof x === "boolean") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Menghitung cakupan sebuah penilaian.
 *
 * @param terpakai    berapa baris yang benar-benar dipakai menghitung
 * @param semestinya  berapa baris yang seharusnya ada
 * @param tanggal     tanggal almanak, untuk mengambil ambang yang berlaku
 */
function cakupan(terpakai, semestinya, tanggal) {
  const a = angka(terpakai);
  const b = angka(semestinya);

  if (a === null || b === null || b <= 0 || a < 0) {
    return {
      terpakai: a,
      semestinya: b,
      persen: null,
      tingkat: "tidak diketahui",
      sebutan: "cakupan tidak diketahui",
      rendah: false,
      kalimat:
        "Cakupan datanya tidak diketahui. Angka ini belum dapat dikatakan menggambarkan berapa bagian dari keseluruhan.",
    };
  }

  // Terpakai melebihi semestinya berarti salah satu hitungannya keliru.
  // Memotongnya menjadi seratus persen akan menyembunyikan kekeliruan itu.
  if (a > b) {
    return {
      terpakai: a,
      semestinya: b,
      persen: null,
      tingkat: "janggal",
      sebutan: "cakupan janggal",
      rendah: false,
      kalimat: `Baris yang dipakai (${a.toLocaleString("id-ID")}) melebihi yang seharusnya ada (${b.toLocaleString("id-ID")}). Salah satu hitungannya keliru, dan angka ini belum boleh dipakai.`,
    };
  }

  const persen = +((a / b) * 100).toFixed(1);
  const batasRendah = tanggal ? ambang.ambangBerlaku("cakupanRendah", tanggal).nilai : 40;
  const batas = batasRendah === null ? 40 : batasRendah;
  const tingkat = TINGKAT.find((t) => persen >= t.batasBawah) || TINGKAT[TINGKAT.length - 1];
  const rendah = persen < batas;

  const dasar = `Dihitung dari ${a.toLocaleString("id-ID")} dari ${b.toLocaleString("id-ID")} baris yang seharusnya ada — ${String(persen).replace(".", ",")} persen.`;

  return {
    terpakai: a,
    semestinya: b,
    persen,
    tingkat: tingkat.kunci,
    sebutan: tingkat.sebutan,
    rendah,
    batasRendah: batas,
    kalimat: rendah
      ? `${dasar} Di bawah ${batas} persen: angka ini menggambarkan sebagian kecil saja, dan tidak boleh dibaca sebagai keadaan seluruhnya.`
      : dasar,
  };
}

/**
 * Cakupan yang dihitung dari hasil kerangka penilaian.
 *
 * Penyebut yang dipakai menghitung adalah baris yang RUASNYA TERISI; yang
 * seharusnya ada diserahkan penilaian, sebab hanya ia yang tahu populasi apa
 * yang sedang dibicarakan.
 */
function cakupanSatuan(satuan, semestinya) {
  if (!satuan || !satuan.unit) throw new Error("satuan tidak sah");
  return cakupan(satuan.penyebut, semestinya, satuan.unit.selesai);
}

/**
 * Menyusun kalimat perbandingan untuk beberapa penilaian sekaligus.
 *
 * Dipakai layar ringkasan: bukan untuk menghakimi penilaian yang cakupannya
 * rendah, melainkan supaya yang membaca tahu ketiganya tidak sebanding.
 */
function bandingkanCakupan(daftar) {
  const sah = (Array.isArray(daftar) ? daftar : []).filter((x) => x && x.cakupan && x.cakupan.persen !== null);
  const rendah = sah.filter((x) => x.cakupan.rendah);
  return {
    jumlah: sah.length,
    rendah: rendah.length,
    terendah: sah.length
      ? sah.reduce((a, b) => (a.cakupan.persen <= b.cakupan.persen ? a : b))
      : null,
    kalimat: rendah.length
      ? `${rendah.length} dari ${sah.length} penilaian bercakupan di bawah ambang. Ketiganya tidak sebanding dan tidak boleh dijajarkan tanpa penanda.`
      : `Seluruh ${sah.length} penilaian bercakupan di atas ambang.`,
  };
}

module.exports = { TINGKAT, cakupan, cakupanSatuan, bandingkanCakupan };
