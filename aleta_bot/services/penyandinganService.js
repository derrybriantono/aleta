"use strict";

/**
 * ============================================================================
 * PENYANDINGAN - APAKAH ANGKA INI PERNAH DIBUKTIKAN DARI LUAR?
 * ============================================================================
 *
 * Sebuah penilaian belum dianggap benar karena programnya berjalan. Ia
 * dianggap benar setelah angkanya disandingkan dengan angka yang dihasilkan
 * SECARA TERPISAH - hitungan tangan atas SIPP, atau laporan yang benar-benar
 * dikirim pengadilan pada bulan itu - dan keduanya sama.
 *
 * Layanan ini membaca catatan penyandingan dan menjawab satu pertanyaan untuk
 * tiap penilaian: sudah pernah dibuktikan dari luar, atau belum?
 *
 * ============================================================================
 * MENGAPA JAWABANNYA HARUS TERBAWA SAMPAI KE LAYAR
 * ============================================================================
 *
 * Angka yang belum pernah dibuktikan dari luar tampil persis sama
 * meyakinkannya dengan angka yang sudah - huruf yang sama, warna yang sama,
 * ubin yang sama. Tidak ada yang dapat membedakannya kecuali diberi tahu.
 *
 * Maka penilaian yang belum disandingkan tetap boleh tampil, tetapi BERTANDA
 * demikian, dan tidak boleh dipakai sebagai bahan pembinaan. Itu bukan
 * kehati-hatian yang berlebihan: rapor yang menyebut nama orang, disusun dari
 * angka yang belum pernah diperiksa dari luar, adalah tuduhan tanpa bukti.
 *
 * ============================================================================
 * DIBACA ULANG, TIDAK DISINGGAHKAN LAMA
 * ============================================================================
 *
 * Catatannya berkas kecil dan jarang berubah, tetapi bila disinggahkan
 * selamanya maka penyandingan yang baru saja dicatat tidak akan terlihat
 * sampai bot dinyalakan ulang - dan orang akan menyangka catatannya tidak
 * tersimpan. Disinggahkan sebentar saja, secukupnya agar pembacaan beruntun
 * tidak membuka berkas berkali-kali.
 */

const fs = require("fs");
const path = require("path");

const JALUR =
  process.env.ALETA_BOT_PENYANDINGAN_PATH ||
  path.resolve(__dirname, "..", "penyandingan", "catatan.json");

const UMUR_SINGGAHAN_MS = 30 * 1000;

let singgahan = null;
let singgahanPada = 0;

function bacaCatatan() {
  const sekarang = Date.now();
  if (singgahan && sekarang - singgahanPada < UMUR_SINGGAHAN_MS) return singgahan;

  let isi = { baris: [] };
  try {
    if (fs.existsSync(JALUR)) {
      const mentah = JSON.parse(fs.readFileSync(JALUR, "utf8"));
      if (mentah && Array.isArray(mentah.baris)) isi = mentah;
    }
  } catch (_) {
    // Catatan yang rusak diperlakukan sebagai catatan kosong: seluruh penilaian
    // berstatus belum disandingkan. Itu jawaban yang jujur - yang berbahaya
    // adalah menganggapnya sudah terbukti karena berkasnya tidak terbaca.
    isi = { baris: [], rusak: true };
  }

  singgahan = isi;
  singgahanPada = sekarang;
  return isi;
}

function lupakanSinggahan() {
  singgahan = null;
  singgahanPada = 0;
}

function angka(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/** Apakah kedua angka pada satu baris memang cocok? */
function barisCocok(baris) {
  const a = angka(baris.angkaAleta);
  const b = angka(baris.angkaLuar);
  if (a === null || b === null) return false;
  return a === b;
}

/**
 * Keadaan penyandingan satu penilaian.
 *
 * Memulangkan tiga kemungkinan, dan ketiganya berbeda arti:
 *
 *   belum      - tidak ada satu pun baris. Angkanya belum pernah dibuktikan.
 *   terbukti   - ada baris yang kedua angkanya sama.
 *   berselisih - ada baris, tetapi angkanya berbeda dan selisihnya sudah
 *                dijelaskan. Ini BUKAN kegagalan; kadang yang keliru justru
 *                angka luarnya, dan itu temuan yang berharga. Tetapi ia harus
 *                terlihat, bukan disamakan dengan "terbukti".
 */
function keadaanPenilaian(kunciPenilaian, periode) {
  const catatan = bacaCatatan();
  const kunci = String(kunciPenilaian || "").trim();
  if (!kunci) return { keadaan: "belum", jumlah: 0, baris: [] };

  const cocokPeriode = periode ? String(periode).trim() : null;
  const baris = catatan.baris.filter((b) => {
    if (String(b.penilaian || "").trim() !== kunci) return false;
    if (cocokPeriode && String(b.periode || "").trim() !== cocokPeriode) return false;
    return true;
  });

  if (!baris.length) return { keadaan: "belum", jumlah: 0, baris: [] };

  const adaYangCocok = baris.some(barisCocok);
  const terbaru = baris
    .slice()
    .sort((x, y) => String(y.disandingkanPada || "").localeCompare(String(x.disandingkanPada || "")))[0];

  return {
    keadaan: adaYangCocok ? "terbukti" : "berselisih",
    jumlah: baris.length,
    terakhirPada: terbaru ? terbaru.disandingkanPada : null,
    olehSiapa: terbaru ? terbaru.olehSiapa : null,
    sumberLuar: terbaru ? terbaru.sumberLuar : null,
    baris,
  };
}

/** Kalimat siap tampil, atau kosong bila memang tidak perlu ditampilkan. */
function penandaTerbaca(kunciPenilaian, periode) {
  const k = keadaanPenilaian(kunciPenilaian, periode);
  if (k.keadaan === "terbukti") {
    return `Angka ini pernah disandingkan dengan ${k.sumberLuar || "sumber di luar ALETA"} pada ${k.terakhirPada} dan hasilnya sama.`;
  }
  if (k.keadaan === "berselisih") {
    return `Angka ini pernah disandingkan pada ${k.terakhirPada} dan HASILNYA BERBEDA. Selisihnya sudah dijelaskan pada catatan penyandingan.`;
  }
  return "Belum disandingkan dengan angka dari luar ALETA. Belum boleh dipakai sebagai bahan pembinaan.";
}

/** Ringkasan untuk laporan: berapa yang sudah, berapa yang belum. */
function ringkasan(daftarKunci) {
  const daftar = Array.isArray(daftarKunci) ? daftarKunci : [];
  const hasil = { seluruhnya: daftar.length, terbukti: 0, berselisih: 0, belum: 0, perKunci: {} };
  daftar.forEach((k) => {
    const keadaan = keadaanPenilaian(k).keadaan;
    hasil.perKunci[k] = keadaan;
    hasil[keadaan] += 1;
  });
  return hasil;
}

module.exports = {
  JALUR,
  bacaCatatan,
  lupakanSinggahan,
  barisCocok,
  keadaanPenilaian,
  penandaTerbaca,
  ringkasan,
};
