"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - TAMPILAN TANYA JAWAB SAKSI (20 Okt 2026)
 * ============================================================================
 *
 * Fungsi murni untuk tampilan (tanpa DOM, tanpa jaringan, tanpa menulis ke ABT) yang dipakai
 * blangko-derry-isian.js:
 *
 *   1. ASAL JAWABAN (kontrak bersama antar agen) - tiap baris tanya jawab dihitung menjadi
 *        "kosong"  teks jawaban kosong atau masih memuat "..." / "…" (perlu dilengkapi)
 *        "ragu"    terisi dari usulan server yang keyakinannya "ragu" (perlu diperiksa)
 *        "data"    terisi dari usulan server (data perkara) dan belum diubah petugas
 *        "manual"  diketik/diubah petugas, atau jawaban yang sudah tersimpan di ABT
 *      Penentu "data"/"ragu": baris masih sama dengan hasil susunan otomatis (r.otomatis) dan
 *      r.usulan = { yakin: "yakin"|"cukup"|"ragu", sumber: "kalimat singkat" } dari server.
 *   2. hitungan untuk ringkasan di atas tabel ("N terisi · N ragu · N perlu dilengkapi");
 *   3. isian OPSIONAL (mis. #9134 petunjuk perbaikan permohonan) yang dikeluarkan dari
 *      hitungan "Perlu diisi";
 *   4. peringatan "daftar kosong" yang diturunkan dari keadaan daftar SAAT INI (bukan teks
 *      tersimpan), supaya tidak tertinggal dan tidak muncul dobel.
 */
(function () {
  const RE_TITIK = /\.{3,}|…|_{2,}|#\d{3,5}#/;
  const YAKIN = ["yakin", "cukup", "ragu"];
  /** Isian yang tidak wajib walau portal belum menandainya (cadangan bila `opsional` belum dikirim server). */
  const KODE_OPSIONAL = ["9134"];
  const LABEL_OPSIONAL = { 9134: "Petunjuk perbaikan permohonan (bila majelis memberi petunjuk)" };
  const TEKS_ASAL = {
    kosong: "perlu dilengkapi",
    ragu: "ragu - periksa dulu",
    data: "terisi dari data perkara",
    manual: "ketikan petugas",
  };

  const teks = (x) => String(x == null ? "" : x);
  const kosongTeks = (x) => !teks(x).trim();

  /** Jawaban kosong, atau masih memuat titik-titik / garis bawah / penanda #nnnn# yang belum diisi. */
  const jawabanBelumLengkap = (j) => kosongTeks(j) || RE_TITIK.test(teks(j));

  /** Keyakinan dan sumber usulan dari satu jawaban hasil server; bentuk {teks,yakin,sumber} atau {usulan:{...}} diterima. */
  function metaUsulan(b) {
    if (!b || typeof b !== "object") return null;
    const m = b.jawab && typeof b.jawab === "object" ? b.jawab : b.usulan && typeof b.usulan === "object" ? b.usulan : b;
    const yakin = YAKIN.includes(teks(m.yakin)) ? teks(m.yakin) : "";
    const sumber = teks(m.sumber).trim();
    return yakin || sumber ? { yakin, sumber } : null;
  }

  /**
   * Asal satu baris. Baris tanpa pertanyaan dan tanpa jawaban (baris kosong yang baru ditambah) tetap "kosong".
   * @returns {"kosong"|"ragu"|"data"|"manual"}
   */
  function asalBaris(r) {
    const b = r && typeof r === "object" ? r : {};
    if (jawabanBelumLengkap(b.jawab)) return "kosong";
    const masihOtomatis = b.otomatis !== undefined && teks(b.otomatis) === teks(b.jawab);
    if (!masihOtomatis) return "manual";
    return b.usulan && b.usulan.yakin === "ragu" ? "ragu" : "data";
  }

  /** Alasan "ragu" untuk ikon ⓘ: sumber usulan bila ada, selain itu kalimat umum. */
  function alasanRagu(r) {
    const s = r && r.usulan && r.usulan.sumber ? teks(r.usulan.sumber).trim() : "";
    return s || "Jawaban ini disusun dari data yang kurang pasti; periksa dengan keterangan saksi.";
  }

  /** Baris yang dihitung: ada pertanyaan atau jawaban (baris yang sama sekali kosong diabaikan). */
  const dihitung = (r) => r && (!kosongTeks(r.tanya) || !kosongTeks(r.jawab));

  /**
   * Hitungan untuk ringkasan di atas tabel.
   * @param {Array<Array>} daftar  satu atau beberapa daftar baris (dua saksi berdampingan = dua daftar)
   * @returns {{data:number, manual:number, ragu:number, kosong:number, terisi:number, total:number}}
   */
  function hitungAsal(daftar) {
    const h = { data: 0, manual: 0, ragu: 0, kosong: 0, terisi: 0, total: 0 };
    for (const rows of daftar || []) {
      for (const r of rows || []) {
        if (!dihitung(r)) continue;
        h[asalBaris(r)] += 1;
        h.total += 1;
      }
    }
    h.terisi = h.data + h.manual;
    return h;
  }

  /** Kalimat ringkasan polos (dipakai pembaca layar dan uji). */
  const ringkasAsal = (h) => `${h.terisi} terisi · ${h.ragu} ragu · ${h.kosong} perlu dilengkapi`;

  /**
   * Menempelkan keyakinan/sumber usulan ke baris yang BARU diisi susunan otomatis. `sebelum` = baris sebelum dipasang,
   * `res` = hasil pasangJawaban (rows, terisi, ...), `jawaban` = jawaban server untuk saksi itu. Baris yang tidak berubah
   * tidak disentuh. Mengubah dan mengembalikan `res`.
   */
  function tandaiUsulan(sebelum, res, jawaban) {
    if (!res || !Array.isArray(res.rows)) return res;
    res.rows = res.rows.map((r, i) => {
      const lama = sebelum && sebelum[i];
      if (!lama || r.jawab === lama.jawab || r.otomatis === undefined || teks(r.otomatis) !== teks(r.jawab)) return r;
      const meta = metaUsulan(Array.isArray(jawaban) ? jawaban[i] : null);
      const baru = { ...r };
      if (meta) baru.usulan = meta;
      else delete baru.usulan;
      return baru;
    });
    return res;
  }

  /** Isian opsional: ditandai server (`opsional: true`) atau termasuk daftar cadangan. */
  const opsional = (b) => Boolean(b && (b.opsional === true || KODE_OPSIONAL.includes(teks(b.kode))));
  /** Nama untuk pengguna; isian opsional tertentu diberi label yang menjelaskan fungsinya. */
  const namaTampil = (b) => (b && LABEL_OPSIONAL[teks(b.kode)]) || (b ? teks(b.nama) : "");

  /**
   * Peringatan "daftar kosong tidak disimpan" untuk satu saksi. Hanya ada bila petugas sudah mencoba menyimpan
   * (`sudahCoba`) DAN daftar saksi itu memang masih kosong sekarang; begitu daftar terisi, peringatan hilang sendiri.
   */
  function peringatanDaftarKosong(sebutan, rows, sudahCoba) {
    if (!sudahCoba) return "";
    const isi = (rows || []).some((r) => !kosongTeks(r && r.tanya) || !kosongTeks(r && r.jawab));
    if (isi) return "";
    return `${sebutan ? `${sebutan}: ` : ""}Daftar kosong tidak disimpan (akan menghapus keterangan saksi di ABT). Hapus di ABT bila memang mau dikosongkan.`;
  }

  /**
   * Konfirmasi "Isi ulang dari data perkara": jumlah jawaban yang akan berubah dan yang tertahan.
   * @param {Array<{ubah:number, tahan:number}>} butir  satu butir per saksi
   * @param {boolean} termasukDiketik  petugas mencentang "termasuk yang sudah diketik"
   * @returns {{ubah:number, tahan:number, kalimat:string}}
   */
  function kalimatKonfirmasi(butir, termasukDiketik) {
    let ubah = 0;
    let tahan = 0;
    for (const x of butir || []) {
      ubah += Number(x.ubah) || 0;
      tahan += Number(x.tahan) || 0;
    }
    const diubah = termasukDiketik ? ubah + tahan : ubah;
    const tertahan = termasukDiketik ? 0 : tahan;
    const bagian = [`${diubah} jawaban akan berubah`];
    if (tertahan) bagian.push(`${tertahan} jawaban yang sudah Anda ketik tertahan (tidak diubah)`);
    return { ubah: diubah, tahan: tertahan, kalimat: `${bagian.join("; ")}.` };
  }

  const api = {
    asalBaris,
    alasanRagu,
    hitungAsal,
    ringkasAsal,
    tandaiUsulan,
    metaUsulan,
    opsional,
    namaTampil,
    peringatanDaftarKosong,
    kalimatKonfirmasi,
    jawabanBelumLengkap,
    TEKS_ASAL,
    KODE_OPSIONAL,
  };
  globalThis.AletaBdSaksiTampil = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
