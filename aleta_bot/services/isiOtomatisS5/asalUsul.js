"use strict";

/**
 * ============================================================================
 * ASAL USUL ANAK (jenis_perkara_id 358) - isian "Perlu diisi" blangko Derry AUA
 * ============================================================================
 *
 * Posita asal usul anak PA Donggala memakai satu templat yang SAMA dengan itsbat nikah ("pada saat pernikahan tersebut
 * Pemohon I berstatus Perjaka dalam usia 23 tahun ... wali nikah yang bernama X (Ayah Kandung Pemohon II) ... yang menikahkan
 * Imam Desa ... dihadiri 2 (dua) orang saksi nikah bernama A dan B, dengan mas kawin ..."). Pengurai itsbat
 * (abtUsulanService.dariPositaItsbat) membacanya dengan benar, tetapi panel Blangko Derry hanya memanggil jalur itsbat untuk
 * perkara itsbat; jalur "posita-lain" menyerahkan semua variabel fakta nikah asal usul ke "bawaan ABT" yang tidak pernah
 * tersimpan. Akibatnya 14 fakta nikah selalu kosong pada AUA. Berkas ini memakai pengurai itsbat yang sama dan menaruh
 * keyakinannya menurut ukuran pengurai itu (UKUR_SUMBER.itsbat di abtUsulanLainService.js; AUA sendiri baru 13 perkara).
 *
 *   fakta nikah (5197 5105 5178 1217 1046 8087 0650 0651 1001 1002 1003 7211 7212 0007)   pengurai itsbat atas posita
 *   8603  nama anak yang dimohonkan        perkara_anak_pihak (SIPP); petitum sebagai pembanding
 *   9709  tempat dan tanggal lahir anak    perkara_anak_pihak.tempat_lahir/tanggal_lahir ("di Donggala pada tanggal 21 Februari 2008")
 *   9710  alasan anak belum punya akta     kalimat posita "belum memiliki akta kelahiran karena ..."
 */

const B = require("./bantu");

/**
 * Keyakinan fakta nikah pada AUA. cukup = pengurai itsbat >= 0,9 atas isian petugas (n >= 280 untuk itsbat nikah, ukur 13 Okt
 * 2026) DAN cocok pada posita AUA; ragu = di bawah 0,9. Bacaan di bawah 0,9 tetap ditawarkan sebagai saran.
 */
const KEYAKINAN_FAKTA = Object.freeze({
  "1002": "cukup", // 655/670
  "1003": "cukup", // 654/670
  "1046": "cukup", // 614/631
  "1217": "cukup", // 578/637
  "5105": "cukup", // 627/675
  "5178": "cukup", // 260/269
  "0007": "cukup", // 511/560
  "0650": "cukup", // 509/569 (0,894; templat AUA 'dihadiri 2 (dua) orang saksi nikah bernama A dan B')
  "0651": "cukup", // 476/543 (0,877)
  "5197": "ragu", // 232/296: tanggal nikah (siri) atau tanggal pencatatan - dua tanggal pada posita AUA
  "7211": "ragu", // 183/230
  "7212": "ragu", // 180/231
  "8087": "ragu", // 266/517
  "1001": "ragu", // 285/643
});

const NAMA = Object.freeze({
  "9709": "Tempat dan tanggal lahir anak",
  "9710": "Alasan anak belum punya akta kelahiran",
  "8603": "Nama anak yang dimohonkan",
});

/** Fakta nikah dari pengurai itsbat. `urai(posita)` = dariPositaItsbat(posita, {}).usulan. */
function faktaNikah(posita, urai) {
  const hasil = [];
  let usulan = [];
  try {
    usulan = urai(posita) || [];
  } catch {
    usulan = [];
  }
  for (const u of usulan) {
    if (!u || !String(u.nilai || "").trim() || !KEYAKINAN_FAKTA[u.kode]) continue;
    const yakin = KEYAKINAN_FAKTA[u.kode];
    const asli = Array.isArray(u.sumber) && u.sumber[0] ? u.sumber[0].kalimat : "";
    hasil.push(
      B.butir({
        kode: u.kode,
        nama: u.nama,
        nilai: u.nilai,
        keyakinan: yakin,
        kalimat: asli,
        asal: "posita-gugatan",
        catatan:
          (u.catatan ? `${String(u.catatan).trim()} ` : "") +
          (yakin === "ragu"
            ? "Dibaca dari kalimat pernikahan di posita dengan pengurai yang sama dengan itsbat nikah; ketepatannya di bawah 90% pada itsbat nikah, periksa."
            : "Dibaca dari kalimat pernikahan di posita dengan pengurai yang sama dengan itsbat nikah (ketepatan di atas 90%)."),
        kodePola: `s5-aua-${u.kode}-posita`,
      })
    );
  }
  return hasil;
}

const bersihAnak = (s) => B.rapikanNama(s);

/** 8603 dari perkara_anak_pihak; pembanding nama dari petitum (bacaan modul asal-usul). */
function namaAnak(anak, bacaPetitum) {
  const nama = (anak || []).map((a) => bersihAnak(a.nama)).filter((n) => n.length >= 3);
  if (!nama.length) return [];
  const gabung = nama.join(", ");
  const pet = bacaPetitum ? String(bacaPetitum["8603"] ? bacaPetitum["8603"].nilai : "") : "";
  const sepakat = pet ? nama.every((n) => B.rapat(pet).includes(B.rapat(n.split(/\s+(?:bin|binti)\s+/i)[0]))) : false;
  return [
    B.butir({
      kode: "8603",
      nama: NAMA["8603"],
      nilai: gabung,
      keyakinan: sepakat ? "pasti" : "cukup",
      kalimat: `Anak di SIPP: ${gabung}`,
      catatan: sepakat ? "Nama anak di data anak SIPP sama dengan nama di petitum." : "Dari data anak di SIPP (tidak ditemukan di petitum); periksa ejaan dan jumlah anak.",
      kodePola: "s5-aua-8603-anak",
    }),
  ];
}

/** 9709: "di Donggala pada tanggal 21 Februari 2008" - satu anak; beberapa anak diberi nama masing-masing dan hanya "ragu". */
function tempatTanggalLahir(anak) {
  const ada = (anak || []).filter((a) => B.isoKeIndonesia(a.lahir) && String(a.tempat || "").trim());
  if (!ada.length) return [];
  const satuAnak = (a) => `di ${B.rapikanNama(a.tempat)} pada tanggal ${B.isoKeIndonesia(a.lahir)}`;
  if (ada.length === 1) {
    return [
      B.butir({
        kode: "9709",
        nama: NAMA["9709"],
        nilai: satuAnak(ada[0]),
        keyakinan: "cukup",
        kalimat: `Data anak di SIPP: ${bersihAnak(ada[0].nama)}, ${satuAnak(ada[0])}`,
        catatan: "Dari tempat dan tanggal lahir anak di data anak SIPP; cocokkan dengan keterangan/akta yang ada.",
        kodePola: "s5-aua-9709-anak",
      }),
    ];
  }
  const nilai = ada.map((a) => `${bersihAnak(a.nama)} ${satuAnak(a)}`).join("; ");
  return [
    B.butir({
      kode: "9709",
      nama: NAMA["9709"],
      nilai,
      keyakinan: "ragu",
      kalimat: `Data anak di SIPP: ${nilai}`,
      catatan: "Beberapa anak: nama tiap anak diberi di depan tempat dan tanggal lahirnya; sesuaikan bentuknya dengan kalimat blangko.",
      kodePola: "s5-aua-9709-banyak-anak",
    }),
  ];
}

/** 9710: "belum memiliki akta kelahiran karena/dikarenakan ..." di posita; hanya kalimat yang menyebutnya. */
function alasanBelumAkta(posita) {
  const t = B.polos(posita);
  const m = /\b(?:belum|tidak)\s+(?:memiliki|mempunyai|punya)\s+akta\s+kelahiran[^;.]{0,40}?\b(?:karena|dikarenakan|disebabkan|sebab)\s+([^;]{8,220}?)(?=\s*(?:;|\.\s+[A-Z]|\s\d{1,2}\s*\.\s*Bahwa\b|$))/i.exec(t);
  if (!m) return [];
  const nilai = m[1].replace(/[\s.,]+$/, "").trim();
  if (nilai.length < 8) return [];
  return [
    B.butir({
      kode: "9710",
      nama: NAMA["9710"],
      nilai: /^karena\s/i.test(nilai) ? nilai : nilai,
      keyakinan: "ragu",
      kalimat: m[0],
      asal: "posita-gugatan",
      catatan: "Kalimat alasan anak belum memiliki akta kelahiran dari posita; ringkas menjadi satu kalimat tanpa titik akhir.",
      kodePola: "s5-aua-9710-posita",
    }),
  ];
}

/**
 * @param {{perkara: {posita: string}, anak: object[]}} d
 * @param {{urai?: Function, bacaPetitum?: Function}} opsi urai(posita) -> usulan itsbat; bacaPetitum(posita, petitum) -> peta kode -> {nilai}
 */
function usulanAsalUsul(d, opsi = {}) {
  const posita = String((d.perkara && d.perkara.posita) || "");
  const petitum = String((d.perkara && d.perkara.petitum) || "");
  const hasil = [];
  if (typeof opsi.urai === "function") hasil.push(...faktaNikah(posita, opsi.urai));
  const bacaan = typeof opsi.bacaPetitum === "function" ? opsi.bacaPetitum(posita, petitum) || {} : {};
  hasil.push(...namaAnak(d.anak, bacaan));
  hasil.push(...tempatTanggalLahir(d.anak));
  hasil.push(...alasanBelumAkta(posita));
  return hasil;
}

module.exports = { usulanAsalUsul, faktaNikah, namaAnak, tempatTanggalLahir, alasanBelumAkta, KEYAKINAN_FAKTA };
