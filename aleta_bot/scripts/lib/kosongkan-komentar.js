"use strict";

/**
 * ============================================================================
 * MENGOSONGKAN KOMENTAR TANPA MERUSAK TALI KATA
 * ============================================================================
 *
 * Beberapa penjaga di folder ini memindai kode sebagai teks. Semuanya punya
 * masalah yang sama: contoh yang ditulis di dalam komentar ikut tertangkap,
 * lalu penjaganya menuduh berkas yang tidak bersalah. Itu sudah terjadi pada
 * penjaga alamat fetch di sisi portal - ia menuduh sebuah berkas memakai
 * bentuk yang salah, padahal bentuk itu memang sengaja ditulis di dalam
 * keterangan sebagai contoh yang TIDAK boleh dipakai.
 *
 * Penjaga yang menuduh berkas benar lebih berbahaya daripada tidak ada
 * penjaga: yang pertama mengajari orang bahwa merahnya boleh diabaikan, dan
 * sesudah itu pelanggaran yang sungguhan pun ikut diabaikan.
 *
 * ============================================================================
 * MENGAPA BUKAN REGEX SAJA
 * ============================================================================
 *
 * Tiga hal membuat regex tidak cukup, dan ketiganya ada di dalam berkas
 * aplikasi ini sendiri:
 *
 *   "http://192.168.10.10:3003"   garis miring ganda di dalam tali kata
 *   /["']/                        regex yang memuat tanda kutip
 *   /a\/\/b/                      regex yang memuat garis miring terlindung
 *
 * Maka sumbernya disusuri satu aksara demi satu aksara sambil mengingat sedang
 * berada di dalam apa. Komentar diganti spasi, bukan dibuang, supaya nomor
 * barisnya tetap menunjuk tempat yang benar.
 */

function kosongkanKomentar(sumber) {
  const keluar = [];
  let i = 0;
  // Aksara bermakna terakhir - dipakai membedakan pembagian dari awal regex:
  // `a / b` pembagian, `= /abc/` regex.
  let taraTerakhir = "";

  const dorong = (a) => {
    keluar.push(a);
    if (!/\s/.test(a)) taraTerakhir = a;
  };
  const kosongkan = (a) => keluar.push(a === "\n" ? "\n" : " ");

  while (i < sumber.length) {
    const a = sumber[i];
    const b = sumber[i + 1];

    if (a === "/" && b === "/") {
      while (i < sumber.length && sumber[i] !== "\n") kosongkan(sumber[i++]);
      continue;
    }
    if (a === "/" && b === "*") {
      kosongkan(sumber[i++]);
      kosongkan(sumber[i++]);
      while (i < sumber.length && !(sumber[i] === "*" && sumber[i + 1] === "/")) kosongkan(sumber[i++]);
      if (i < sumber.length) {
        kosongkan(sumber[i++]);
        kosongkan(sumber[i++]);
      }
      continue;
    }
    if (a === '"' || a === "'") {
      dorong(sumber[i++]);
      while (i < sumber.length) {
        if (sumber[i] === "\\") {
          dorong(sumber[i++]);
          if (i < sumber.length) dorong(sumber[i++]);
          continue;
        }
        if (sumber[i] === a) {
          dorong(sumber[i++]);
          break;
        }
        // Tali kata yang tidak tertutup pada satu baris: berhenti di situ
        // alih-alih menelan sisa berkas.
        if (sumber[i] === "\n") break;
        dorong(sumber[i++]);
      }
      continue;
    }
    if (a === "`") {
      dorong(sumber[i++]);
      while (i < sumber.length) {
        if (sumber[i] === "\\") {
          dorong(sumber[i++]);
          if (i < sumber.length) dorong(sumber[i++]);
          continue;
        }
        if (sumber[i] === "`") {
          dorong(sumber[i++]);
          break;
        }
        dorong(sumber[i++]);
      }
      continue;
    }
    if (a === "/" && !/[A-Za-z0-9_$)\]]/.test(taraTerakhir)) {
      dorong(sumber[i++]);
      let didalamKurung = false;
      while (i < sumber.length) {
        const c = sumber[i];
        if (c === "\\") {
          dorong(sumber[i++]);
          if (i < sumber.length) dorong(sumber[i++]);
          continue;
        }
        if (c === "[") didalamKurung = true;
        else if (c === "]") didalamKurung = false;
        else if (c === "/" && !didalamKurung) {
          dorong(sumber[i++]);
          break;
        } else if (c === "\n") break;
        dorong(sumber[i++]);
      }
      continue;
    }
    dorong(sumber[i++]);
  }

  return keluar.join("");
}

/** Nomor baris tempat sebuah kedudukan aksara berada. */
function nomorBaris(sumber, kedudukan) {
  return sumber.slice(0, kedudukan).split(/\r?\n/).length;
}

module.exports = { kosongkanKomentar, nomorBaris };
