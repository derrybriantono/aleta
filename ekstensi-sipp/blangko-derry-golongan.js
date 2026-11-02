"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - PEMISAH DAFTAR BLANGKO (butir 9, 2 Nov 2026)
 * ============================================================================
 *
 * Di jendela "Pilih blangko", satu kelompok berisi puluhan blangko yang bercampur (putusan kabul, verstek, tolak, NO, gugur; BAS dari
 * mediasi sampai putusan; relaas panggilan sampai pemberitahuan). Rancangan yang disetujui Derry (artefak "Rancangan panel Blangko
 * Derry", pilihan A + B): daftar kanan tetap SATU gulungan, diberi SUBJUDUL pemisah menurut fungsi blangko, dan satu baris chip
 * LOMPAT di atasnya (klik = gulir ke subjudulnya; tidak menyaring, jadi tidak ada blangko yang tersembunyi).
 *
 * Golongan dibaca dari tanda yang SUDAH ADA di nama blangko ([Kabul Verstek], [Tolak], [NO], "Pembuktian P", "Panggilan Ikrar", ...);
 * blangko di ABT tidak diubah. Yang tidak cocok masuk "Lainnya" - tidak ada yang hilang. Urutan di dalam golongan = urutan asal.
 *
 * Fungsi murni (tanpa DOM, tanpa chrome) - diuji langsung. Dipakai blangko-derry-isian.js (renderModal).
 */
(function () {
  if (typeof globalThis === "undefined" || globalThis.AletaBdGolongan) return;

  /** [kunci, judul, uji(nama)] - diuji BERURUTAN (yang lebih khusus lebih dulu); urutan TAMPIL di URUT_TAMPIL. */
  const ATURAN = {
    put: [
      ["penetapan", "Penetapan hari sidang & penunjukan", (n) => /\b(?:PMH|PPP|PHS|PJS)\b/.test(n)],
      ["sela", "Putusan sela", (n) => /\bsela\b/i.test(n)],
      ["gugur", "Gugur / dicoret / dicabut", (n) => /\[\s*(?:gugur|coret|dicoret|cabut|dicabut)\b|\bgugur\b|\bdicoret\b|\bdicabut\b|\bpencabutan\b/i.test(n)],
      ["no", "Tidak dapat diterima (NO)", (n) => /\[\s*NO\b|\bNO\s*\]|\(NO\)|tidak dapat diterima|niet ontvankelijk/.test(n) || /tidak dapat diterima|niet ontvankelijk/i.test(n)],
      ["tolak", "Ditolak", (n) => /\[\s*tolak|\bditolak\b|\btolak\b/i.test(n)],
      ["verstek", "Dikabulkan verstek", (n) => /\[\s*kabul[^\]]*verstek|\bkabul\w*\s+verstek/i.test(n)],
      ["kabul", "Dikabulkan", (n) => /\[\s*kabul|\bdikabulkan\b|\bkabul\b/i.test(n)],
    ],
    bas: [
      ["ikrar", "Ikrar talak", (n) => /\bikrar\b/i.test(n)],
      ["putusan", "Musyawarah & putusan", (n) => /\bputusan\b|\bmusyawarah\b/i.test(n)],
      ["gugatan", "Pembacaan gugatan", (n) => /pembacaan\s+(?:surat\s+)?(?:gugatan|permohonan)|pokok\s+perkara/i.test(n)],
      ["mediasi", "Mediasi", (n) => /\bmediasi\b/i.test(n)],
      ["kesimpulan", "Kesimpulan", (n) => /\bkesimpulan\b/i.test(n)],
      ["jawab", "Jawaban · replik · duplik", (n) => /\bjawab|\breplik\b|\bduplik\b|\brekonvensi\b/i.test(n)],
      ["buktiP", "Pembuktian Penggugat / Pemohon", (n) => /pembuktian\s+(?:P\b|penggugat|pemohon)/i.test(n)],
      ["buktiT", "Pembuktian Tergugat / Termohon", (n) => /pembuktian\s+(?:T\b|tergugat|termohon)/i.test(n)],
      ["bukti", "Pembuktian", (n) => /\bpembuktian\b|\bsaksi\b|\bbukti\b/i.test(n)],
    ],
    rel: [
      ["ikrar", "Panggilan ikrar talak", (n) => /\bikrar\b/i.test(n)],
      ["banding", "Banding / kasasi / PK", (n) => /\bbanding\b|\bkasasi\b|\bPK\b|peninjauan\s+kembali|\bmemori\b|kontra\s*memori/i.test(n)],
      ["pip", "Pemberitahuan isi putusan", (n) => /\bpemberitahuan\b|\bPIP\b|isi\s+putusan|\bputusan\b|\bpenetapan\b/i.test(n)],
      ["ghaib", "Panggilan ghaib / lewat media", (n) => /\bg[h]?aib\b|\bmedia\b|\bradio\b|\bsurat\s+kabar\b|\bkoran\b/i.test(n)],
      ["panggilan", "Panggilan sidang", (n) => /\bpanggilan\b|\brelaas\b|\bmemanggil\b/i.test(n)],
    ],
  };
  ATURAN.sela = ATURAN.put;

  const URUT_TAMPIL = {
    put: ["kabul", "verstek", "tolak", "no", "gugur", "sela", "penetapan", "lain"],
    bas: ["mediasi", "gugatan", "jawab", "buktiP", "buktiT", "bukti", "kesimpulan", "putusan", "ikrar", "lain"],
    rel: ["panggilan", "ghaib", "pip", "ikrar", "banding", "lain"],
  };
  URUT_TAMPIL.sela = URUT_TAMPIL.put;

  const LAIN = { kunci: "lain", judul: "Lainnya" };

  /** Golongan satu nama blangko untuk jenis dokumen itu: { kunci, judul } (jenis tanpa aturan -> null). */
  function golongan(nama, jenis) {
    const aturan = ATURAN[jenis];
    if (!aturan) return null;
    const n = String(nama || "");
    for (const [kunci, judul, uji] of aturan) if (uji(n)) return { kunci, judul };
    return { ...LAIN };
  }

  /**
   * Butir dikelompokkan menurut golongan, dalam urutan tampil; urutan butir di dalam golongan = urutan asal.
   * `namaDari(butir)` -> teks yang diuji (nama berkas, judul tampil, kalimat). Hasil: [{ kunci, judul, butir: [...] }].
   * Bila jenis tanpa aturan, atau semua butir jatuh di SATU golongan, hasilnya satu golongan tanpa judul ({ kunci: "", judul: "" })
   * supaya daftar pendek/seragam tidak diberi pemisah yang tidak berguna.
   */
  function kelompokkan(butir, jenis, namaDari) {
    const daftar = Array.isArray(butir) ? butir : [];
    const ambil = typeof namaDari === "function" ? namaDari : (b) => (b && (b.berkas || b.nama)) || "";
    if (!ATURAN[jenis]) return daftar.length ? [{ kunci: "", judul: "", butir: daftar.slice() }] : [];
    const peta = new Map();
    for (const b of daftar) {
      const g = golongan(ambil(b), jenis);
      if (!peta.has(g.kunci)) peta.set(g.kunci, { kunci: g.kunci, judul: g.judul, butir: [] });
      peta.get(g.kunci).butir.push(b);
    }
    if (peta.size <= 1) return daftar.length ? [{ kunci: "", judul: "", butir: daftar.slice() }] : [];
    const urut = URUT_TAMPIL[jenis] || [];
    return [...peta.values()].sort((a, b) => urut.indexOf(a.kunci) - urut.indexOf(b.kunci));
  }

  /** id elemen subjudul yang aman (huruf kecil, angka, tanda hubung) - dipakai tombol lompat. */
  const idGolongan = (awalan, kunci) => `${String(awalan || "g").replace(/[^a-z0-9-]/gi, "-")}-${String(kunci || "").replace(/[^a-z0-9-]/gi, "-")}`;

  globalThis.AletaBdGolongan = { golongan, kelompokkan, idGolongan, ATURAN, URUT_TAMPIL };
})();
