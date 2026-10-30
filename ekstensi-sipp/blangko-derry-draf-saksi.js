"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - DRAF TANYA JAWAB SAKSI OTOMATIS (30 Okt 2026)
 * ============================================================================
 *
 * Sejak 30 Okt semua BAS dan putusan Derry membaca keterangan saksi HANYA dari tanya jawab saksi ABT. Saksi yang
 * daftarnya masih kosong tercetak kosong, dan panel memperingatkannya. Arahan pengguna 30 Okt malam: draf harus
 * LANGSUNG terisi begitu penyunting tanya jawab dibuka - tanpa tombol tambahan.
 *
 * Yang sudah ada sebelumnya:
 *   - perkara bukan cerai (katalog jenis perkara): daftar kosong sudah disusun sendiri saat penyunting dibuka
 *     (ktIsiOtomatis di blangko-derry-isian.js);
 *   - perkara cerai: petugas harus memilih set pertanyaan lalu menekan Muat; sesudah itu jawaban diisi dari data
 *     perkara (jalur 'saksi-sdg' bot). Tanpa dua klik itu daftarnya tetap kosong.
 *
 * Berkas ini hanya fungsi murni (tanpa DOM, tanpa jaringan) untuk langkah yang hilang pada perkara cerai: set yang
 * DISARANKAN (set utama sesuai huruf alasan + set tambahan yang ikut disarankan, mis. verstek/kontradiktoir menurut
 * blangko, kumulasi hak asuh/itsbat) dipasang sendiri pada daftar yang masih kosong, lalu pengisi jawaban yang sama
 * berjalan seperti sesudah Muat.
 *
 * Batas yang dijaga (dipakai blangko-derry-isian.js):
 *   - hanya daftar yang sudah terbaca dari ABT dan BENAR-BENAR kosong (tanpa satu pertanyaan pun), tidak sedang
 *     dimuat/disimpan, tanpa galat baca, dan belum diubah petugas - jawaban yang sudah ada tidak pernah ditimpa;
 *   - penyunting hanya-baca (putusan, peran hakim) dan mode katalog (sudah otomatis sendiri) tidak disentuh;
 *   - tidak ada yang tersimpan ke ABT: draf tetap "belum disimpan" sampai petugas menekan Simpan ke ABT (keterangan
 *     saksi bukan data SIPP, jadi aturan isi SIPP -> ABT otomatis tidak berlaku untuknya);
 *   - jawaban yang tidak berasal dari data perkara tetap kalimat contoh dan DITANDAI (lihat asal "contoh" di
 *     blangko-derry-saksi-tampil.js), isian yang datanya tidak ada tetap "..." (perlu dilengkapi).
 */
(function () {
  const teks = (x) => String(x == null ? "" : x);
  const adaIsi = (rows) => (Array.isArray(rows) ? rows : []).some((r) => teks(r && r.tanya).trim() || teks(r && r.jawab).trim());

  /**
   * Set yang dipasang otomatis dari daftar set ALETA (rute set-saksi): set utama = yang disarankan dan bukan tambahan;
   * tambahan = set tambahan lain yang juga disarankan. null bila tidak ada set utama yang berisi pertanyaan.
   * @param {Array<{id:string, judul?:string, utama?:boolean, tambahan?:boolean, baris?:Array}>} daftar
   */
  function pilihSetDraf(daftar) {
    const sah = (Array.isArray(daftar) ? daftar : []).filter((x) => x && teks(x.id) && Array.isArray(x.baris) && x.baris.length);
    const utama = sah.find((x) => x.utama === true && !x.tambahan) || null;
    if (!utama) return null;
    const tambahan = sah.filter((x) => x.utama === true && x.tambahan === true && x.id !== utama.id);
    return { utama, tambahan };
  }

  /**
   * Daftar satu saksi boleh diberi draf otomatis?
   * @param {{dimuat?:boolean, memuat?:boolean, berubah?:boolean, galat?:string, menyimpan?:string, rows?:Array}|null} t
   * @param {{hanyaBaca?:boolean, katalog?:boolean}} opsi
   */
  function perluDraf(t, opsi) {
    const o = opsi || {};
    if (o.hanyaBaca || o.katalog) return false;
    if (!t || t.dimuat !== true || t.memuat || t.berubah || teks(t.galat).trim() || teks(t.menyimpan).trim()) return false;
    return !adaIsi(t.rows);
  }

  /** Catatan di sebelah tombol Muat (bahasa awam, tanpa istilah teknis). */
  function kalimatStatus(pilih, jumlah, jam) {
    if (!pilih || !pilih.utama) return "";
    const judul = [pilih.utama, ...(pilih.tambahan || [])].map((x) => teks(x.judul || x.id)).join(" + ");
    return `Draf disusun otomatis${jam ? ` pukul ${jam}` : ""} dari set pertanyaan yang disarankan (${judul}): ${Number(jumlah) || 0} pertanyaan. Belum disimpan ke ABT - sesuaikan dengan keterangan saksi, lengkapi yang bertanda, lalu tekan Simpan ke ABT.`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 30 Okt (G2a): pertanyaan "Mengapa yang menikahkan bukan ayah kandungnya / masih ada wali yang lebih berhak?" (katalog itsbat
  // q-in-wali-urutan-*) hanya masuk draf bila wali BUKAN ayah kandung atau belum diketahui. Diketahui dari isian "Status Wali
  // Nikah" ABT, atau dari jawaban "siapa wali nikahnya" yang diisi dari data perkara. Baris yang sudah diketik petugas tetap.
  // ──────────────────────────────────────────────────────────────────────────
  const BUTIR_WALI_LAIN = /^q-in-wali-urutan-/;
  const BUTIR_WALI_SIAPA = /^q-in-wali-(?:pb|lw|pm|km)$/;

  /** Teks status/hubungan wali menyebut ayah kandung (bukan "bukan ayah kandung", "selain ayah", ayah tiri/angkat)? */
  function waliAyahKandung(nilai) {
    const t = teks(nilai).toLowerCase();
    if (!/\bayah\s+kandung\b/.test(t)) return false;
    return !/\b(?:bukan|selain|tanpa)\s+(?:oleh\s+)?ayah\b|\bayah\s+(?:tiri|angkat)\b/.test(t);
  }

  const diketikPetugas = (r) => {
    const j = teks(r && r.jawab).trim();
    if (!j) return false;
    if (r.otomatis !== undefined && teks(r.otomatis) === teks(r.jawab)) return false;
    if (r.dasar !== undefined && teks(r.dasar) === teks(r.jawab)) return false;
    return true;
  };

  /**
   * @param {Array<{butir?: string, jawab?: string, otomatis?: string, dasar?: string}>} rows
   * @param {{statusWali?: string}} opsi  nilai isian "Status Wali Nikah" (kosong bila belum diisi)
   * @returns {{rows: Array, dibuang: number}}
   */
  function saringTanyaWali(rows, opsi) {
    const daftar = Array.isArray(rows) ? rows : [];
    const o = opsi || {};
    const jawabData = daftar.filter((r) => r && BUTIR_WALI_SIAPA.test(teks(r.butir)) && r.otomatis !== undefined && teks(r.otomatis) === teks(r.jawab)).map((r) => teks(r.jawab));
    const dataAyah = jawabData.some(waliAyahKandung);
    // Data perkara menyebut wali kerabat lain / wali hakim sedangkan isian ABT "ayah kandung": sumber berselisih - pertanyaan tetap.
    const dataBukanAyah = jawabData.some((j) => !waliAyahKandung(j) && /\b(?:kakak|adik|paman|saudara|kakek|sepupu|keponakan|hakim|imam|penghulu)\b/i.test(j));
    if (!dataAyah && !(waliAyahKandung(o.statusWali) && !dataBukanAyah)) return { rows: daftar, dibuang: 0 };
    const keluar = daftar.filter((r) => !(r && BUTIR_WALI_LAIN.test(teks(r.butir)) && !diketikPetugas(r)));
    return { rows: keluar, dibuang: daftar.length - keluar.length };
  }

  const api = { pilihSetDraf, perluDraf, kalimatStatus, adaIsi, waliAyahKandung, saringTanyaWali };
  globalThis.AletaBdDrafSaksi = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
