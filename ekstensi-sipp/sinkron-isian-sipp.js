"use strict";

/**
 * ============================================================================
 * ISIAN ABT DARI SIPP YANG IKUT DIPERBARUI SAAT DATA SIPP BERUBAH (G4 4.2, 30 Okt 2026)
 * ============================================================================
 *
 * Arahan pengguna 30 Okt malam: data SIPP diperbarui OTOMATIS saat perkara dibuka di panel (tanpa tombol baru);
 * isian ABT yang terdampak dan BELUM disunting manusia ikut diperbarui, panel hanya memberi keterangan kecil.
 *
 * Murni (tanpa DOM, tanpa jaringan). "Belum disunting manusia" dibuktikan dari RIWAYAT isian perkara
 * (abt.js catatRiwayat/bacaRiwayat - peramban + server): catatan TERAKHIR untuk kode itu ditulis mesin
 * ("diisi otomatis ...", "usulan dari SIPP (...)" tanpa sunting petugas) DAN nilainya masih persis nilai yang
 * sekarang di ABT. Suntingan di halaman ABT sendiri (tanpa ALETA) membuat nilainya berbeda dari catatan mesin
 * -> tidak ditimpa. Tanpa riwayat = tidak ditimpa (perilaku lama). Hanya usulan yang sumbernya SIPP.
 */
(function sinkronIsianSippModul() {
  if (typeof globalThis === "undefined" || globalThis.AletaSinkronIsian) return;

  /** Cara catatan riwayat yang berarti MESIN yang menulis (Blangko Derry isi otomatis; panel ABT Input usulan SIPP). */
  const CARA_MESIN = /^(?:diisi otomatis|bawaan kueri ABT yang mentah diganti otomatis|usulan dari SIPP\b)/i;
  /** Jejak tangan manusia - menang atas kata pembuka mana pun. */
  const CARA_MANUSIA = /diketik|disunting|dipilih petugas|dikembalikan|dipulihkan|sunting tangan|centangan|diperiksa dan disimpan petugas/i;
  /** Asal usulan yang dihitung "data SIPP" (asalUsulan isi-sipp-bersama.js). */
  const ASAL_SIPP = /^(?:SIPP|data pernikahan di SIPP|data pihak)$/i;

  const teks = (x) => String(x == null ? "" : x);
  /** Bentuk baku pembanding: spasi dilebur, kutip disamakan, huruf kecil (sama dengan jejak-isian.js). */
  function baku(x) {
    return teks(x)
      .replace(/[’‘`"“”]/g, "'")
      .replace(/\r\n/g, "\n")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** Catatan riwayat TERAKHIR per kode: Map kode -> catatan. */
  function terakhirPerKode(riwayat) {
    const peta = new Map();
    for (const x of Array.isArray(riwayat) ? riwayat : []) {
      if (!x || !teks(x.kode)) continue;
      const kode = teks(x.kode);
      const ada = peta.get(kode);
      const t = Date.parse(teks(x.pada)) || 0;
      if (!ada || t >= (Date.parse(teks(ada.pada)) || 0)) peta.set(kode, x);
    }
    return peta;
  }

  /** Isian ini terakhir ditulis mesin dan belum disentuh manusia? */
  function ditulisMesin(catatan, nilaiKini) {
    if (!catatan) return false;
    const cara = teks(catatan.cara);
    if (!CARA_MESIN.test(cara) || CARA_MANUSIA.test(cara)) return false;
    return baku(catatan.sesudah) !== "" && baku(catatan.sesudah) === baku(nilaiKini);
  }

  /**
   * Boleh diperbarui dari SIPP? -> { boleh, sebab }
   *   catatan  : catatan riwayat terakhir kode itu (terakhirPerKode)
   *   nilaiKini: nilai di ABT sekarang
   *   nilaiBaru: usulan SIPP terkini
   *   asal     : asal usulan ("SIPP", "data pernikahan di SIPP", ...)
   */
  function bolehPerbarui({ catatan, nilaiKini, nilaiBaru, asal } = {}) {
    if (!ASAL_SIPP.test(teks(asal).trim())) return { boleh: false, sebab: "bukan data SIPP" };
    if (!baku(nilaiBaru)) return { boleh: false, sebab: "usulan kosong" };
    if (baku(nilaiBaru) === baku(nilaiKini)) return { boleh: false, sebab: "sudah sama" };
    if (!catatan) return { boleh: false, sebab: "tanpa riwayat isian" };
    if (!ditulisMesin(catatan, nilaiKini)) return { boleh: false, sebab: "disunting petugas" };
    return { boleh: true, sebab: "" };
  }

  /** Keterangan kecil untuk panel: "Diperbarui dari SIPP: Kuasa Penggugat, Agenda sidang." + judul (ⓘ) lama -> baru. */
  function keterangan(daftar) {
    const l = (Array.isArray(daftar) ? daftar : []).filter((x) => x && teks(x.nama || x.kode));
    if (!l.length) return null;
    const pendek = (v) => {
      const t = teks(v).replace(/\s+/g, " ").trim();
      return t.length > 80 ? `${t.slice(0, 77)}...` : t || "(kosong)";
    };
    return {
      teks: `Diperbarui dari SIPP (data SIPP berubah, belum disunting petugas): ${l.map((x) => teks(x.nama || x.kode)).join(", ")}.`,
      judul: l.map((x) => `${teks(x.nama || x.kode)}: ${pendek(x.dari)} -> ${pendek(x.ke)}`).join("\n"),
    };
  }

  globalThis.AletaSinkronIsian = { CARA_MESIN, CARA_MANUSIA, ASAL_SIPP, baku, terakhirPerKode, ditulisMesin, bolehPerbarui, keterangan };
})();
