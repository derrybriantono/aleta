"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY - TETAP DI TEMPAT SAAT HALAMAN DIMUAT ULANG (30 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: sesudah muat ulang (F5), tampilan Blangko ABT by Derry Briantono tetap terbuka (bukan ABT lama), pada perkara,
 * sidang, dan blangko yang sama, dengan "Lihat sebagai" yang sama, kira-kira di posisi gulir yang sama - tanpa klik tambahan.
 *
 * Berkas ini hanya MENYIMPAN dan MEMBACA keadaan itu di sessionStorage tab halaman ABT (per tab, hilang bersama tab; bukan variabel
 * pekerja latar yang dilupakan peramban). Yang disimpan hanya penunjuk (nomor perkara, nama blangko, tanggal sidang, peran yang dilihat,
 * gulir) dan, bila ada, isian yang BELUM sempat tersimpan ke ABT sebagai draf. Tidak ada yang ditulis ke ABT, SIPP, atau server.
 *
 * Aturan:
 *   - per akun: keadaan membawa identitas akun (akun ALETA + pengguna ABT); akun yang berbeda tidak memulihkan keadaan akun lain
 *     (dan keadaan lama itu dibuang);
 *   - kedaluwarsa 12 jam;
 *   - pilihan eksplisit "Tampilan ABT lama" (kunci sesi milik blangko-derry.js) dan tautan #bd= dari Jadwal Sidang selalu menang:
 *     pemanggil yang memutuskan, berkas ini hanya menyediakan data;
 *   - penyimpanan sesi ditolak (jendela pribadi/pratinjau): semua fungsi diam, tampilan berperilaku seperti sebelum fitur ini.
 */
(function blangkoDerryPulihModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaBdPulih) return;

  const KUNCI = "aleta-bd-keadaan";
  const VERSI = 1;
  const MASA_MS = 12 * 60 * 60 * 1000;
  const BATAS_DRAF = 60;
  const BATAS_NILAI_DRAF = 20000;

  const teks = (x, maks) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, maks || 200);

  function simpanan() {
    try {
      return globalThis.sessionStorage || null;
    } catch {
      return null;
    }
  }

  /** Identitas pemilik keadaan: akun ALETA + pengguna ABT yang sedang masuk. "" bila akun ALETA belum dikenal. */
  function identitas(siapa, penggunaAbt) {
    const id = siapa && (siapa.id || siapa.username || siapa.nama);
    if (!id) return "";
    return `${teks(id, 80)}|${teks(penggunaAbt, 80)}`.toLowerCase();
  }

  function baca() {
    const s = simpanan();
    if (!s) return null;
    try {
      const j = JSON.parse(s.getItem(KUNCI) || "null");
      return j && typeof j === "object" && !Array.isArray(j) && j.v === VERSI ? j : null;
    } catch {
      return null;
    }
  }

  function tulis(obj) {
    const s = simpanan();
    if (!s) return false;
    try {
      s.setItem(KUNCI, JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }

  function hapus() {
    const s = simpanan();
    if (!s) return;
    try {
      s.removeItem(KUNCI);
    } catch {
      /* diabaikan */
    }
  }

  /** Keadaan yang berlaku untuk akun ini sekarang, atau null (kosong, akun lain, kedaluwarsa). Keadaan yang tidak berlaku dibuang. */
  function ambil(idAkun, sekarang) {
    const k = baca();
    if (!k) return null;
    const kini = Number.isFinite(sekarang) ? sekarang : Date.now();
    if (!idAkun || k.identitas !== idAkun || !(kini - Number(k.saat) < MASA_MS) || Number(k.saat) > kini + 60000) {
      hapus();
      return null;
    }
    return k;
  }

  /** Menggabung sebagian keadaan ke yang tersimpan (akun lain ditimpa bersih). Pemanggil menjaga agar tidak menulis saat pemulihan berjalan. */
  function catat(idAkun, tambahan, sekarang) {
    if (!idAkun) return false;
    let k = baca();
    if (k && k.identitas !== idAkun) k = null;
    const baru = { ...(k || {}), ...(tambahan || {}), v: VERSI, identitas: idAkun, saat: Number.isFinite(sekarang) ? sekarang : Date.now() };
    return tulis(baru);
  }

  /** Ketikan isian yang belum tersimpan: { nomor, berkas, isian: { kode: nilai } }. Konteks lain (perkara/blangko berganti) mengosongkannya. */
  function catatDraf(idAkun, konteks, kode, nilai) {
    if (!idAkun || !konteks || !konteks.nomor || !konteks.berkas || !/^\d{3,5}$/.test(String(kode))) return false;
    const k = baca();
    let draf = k && k.identitas === idAkun ? k.draf : null;
    if (!draf || draf.nomor !== konteks.nomor || draf.berkas !== konteks.berkas) draf = { nomor: konteks.nomor, berkas: konteks.berkas, isian: {} };
    const isian = { ...(draf.isian || {}) };
    isian[String(kode)] = String(nilai == null ? "" : nilai).slice(0, BATAS_NILAI_DRAF);
    const kunciIsian = Object.keys(isian);
    if (kunciIsian.length > BATAS_DRAF) delete isian[kunciIsian[0]];
    return catat(idAkun, { draf: { nomor: draf.nomor, berkas: draf.berkas, isian } });
  }

  /** Ketikan itu sudah tersimpan ke ABT: tidak lagi draf. */
  function hapusDraf(idAkun, konteks, kode) {
    const k = baca();
    if (!k || k.identitas !== idAkun || !k.draf || !konteks || k.draf.nomor !== konteks.nomor || k.draf.berkas !== konteks.berkas) return false;
    const isian = { ...(k.draf.isian || {}) };
    if (!(String(kode) in isian)) return false;
    delete isian[String(kode)];
    return catat(idAkun, { draf: Object.keys(isian).length ? { nomor: k.draf.nomor, berkas: k.draf.berkas, isian } : null });
  }

  /** Draf untuk perkara + blangko ini: { kode: nilai } (kosong bila tidak ada). */
  function drafUntuk(keadaan, nomor, berkas) {
    const d = keadaan && keadaan.draf;
    if (!d || d.nomor !== nomor || d.berkas !== berkas || !d.isian || typeof d.isian !== "object") return {};
    const hasil = {};
    for (const [kode, nilai] of Object.entries(d.isian)) if (/^\d{3,5}$/.test(kode) && typeof nilai === "string") hasil[kode] = nilai;
    return hasil;
  }

  globalThis.aletaBdPulih = Object.freeze({ KUNCI, VERSI, MASA_MS, identitas, ambil, catat, hapus, catatDraf, hapusDraf, drafUntuk, _baca: baca });
})();
