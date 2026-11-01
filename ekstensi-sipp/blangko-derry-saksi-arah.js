"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - PENGETAHUAN SAKSI MENURUT ARAH PUTUSAN & PIHAK SAKSI (1 Nov 2026)
 * ============================================================================
 *
 * Keputusan pengguna 1 Nov (tinjauan docs/arahan/tinjau-saksi-1nov.md):
 *   61  draf tetap terisi otomatis; butir yang berasal dari gugatan/posita, dari jawaban/duplik, atau klaim pengetahuan
 *       langsung yang disusun otomatis diberi TANDA PERINGATAN di panel (tidak di naskah cetak) - peringatanBaris();
 *   62  saksi Tergugat/Termohon perkara cerai: bawaan keterangan menurut JAWABAN & DUPLIK; pilihan "ikut gugatan" memakai
 *       set saksi Penggugat - DAFTAR_DASAR_T / pilihSetPihak();
 *   63  blangko/status Tolak atau NO: menu pengetahuan "Tahu sesuai gugatan / Tidak tahu / Keterangan sebaliknya", bawaan
 *       "Tidak tahu" - arahPutusan(), DAFTAR_MODUS_ARAH, opsiModus(), modusBawaan().
 *
 * Fungsi murni: tanpa DOM, tanpa jaringan, tanpa menulis ke ABT. Dipakai blangko-derry-isian.js dan blangko-derry-saksi.js.
 */
(function () {
  const teks = (x) => String(x == null ? "" : x);

  /** Menu tiga pilihan untuk arah Tolak/NO (urutan tampil). "sama" = pilihan lama "Tahu seluruh alasan". */
  const DAFTAR_MODUS_ARAH = [
    ["tidak-tahu-apa", "Tidak tahu (tidak mengetahui perselisihan maupun pisahnya)"],
    ["sebaliknya", "Keterangan sebaliknya (dalil gugatan tidak sesuai kenyataan)"],
    ["sama", "Tahu sesuai gugatan"],
  ];
  const MODUS_ARAH = ["tidak-tahu-apa", "sebaliknya"];

  /**
   * Arah putusan yang diketahui dari blangko yang dipilih (nama/folder "[Tolak]", "[Tolak Verstek]", "[NO]") atau dari keterangan
   * sidang/status putusan SIPP ("putus DITOLAK", "TIDAK DAPAT DITERIMA"). "" bila tidak diketahui atau dikabulkan.
   * @param {{blangko?: string, sidang?: Array<{ket?: string, agenda?: string}>, status?: string}} o
   * @returns {"tolak"|"no"|""}
   */
  function arahPutusan(o) {
    const r = o && typeof o === "object" ? o : {};
    const nama = teks(r.blangko);
    if (/\[\s*no\s*\]|\btidak\s+dapat\s+diterima\b/i.test(nama)) return "no";
    if (/\[\s*tolak/i.test(nama)) return "tolak";
    if (/\[\s*(?:kabul|cabut|gugur|coret|damai|sela)/i.test(nama)) return "";
    const status = [teks(r.status), ...(Array.isArray(r.sidang) ? r.sidang : []).map((s) => `${teks(s && s.ket)}`)].join(" | ");
    // "dikabulkan sebagian, selebihnya ditolak" = gugatan pokok terbukti: bukan arah tolak bagi keterangan saksi.
    if (/\bdikabulkan\b/i.test(status)) return "";
    if (/tidak\s+dapat\s+diterima|\bputus\w*\s+no\b|\bniet\s+ontvankelijk\b/i.test(status)) return "no";
    if (/\bditolak\b/i.test(status)) return "tolak";
    return "";
  }

  /**
   * Bawaan pengetahuan satu saksi. Saksi pertama tahu semuanya, berikutnya sebagian (pola lama); arah Tolak/NO -> "tidak tahu"
   * (keputusan 63); saksi Tergugat/Termohon -> "sama" (isinya mengikuti jawaban & duplik, bukan dalil gugatan).
   * @param {number} urut  urutan saksi (0 = pertama)
   * @param {{arah?: string, pihak?: string}} opsi
   */
  function modusBawaan(urut, opsi) {
    const o = opsi || {};
    if (o.pihak === "T") return "sama";
    if (o.arah === "tolak" || o.arah === "no") return "tidak-tahu-apa";
    return Number(urut) === 0 ? "sama" : "sebagian";
  }

  /**
   * Pilihan <select> "Yang diketahui saksi": daftar lama apa adanya; pada arah Tolak/NO menu tiga pilihan di depan
   * (kelompok sendiri) lalu pilihan lain. Pilihan arah yang sudah tersimpan tetap tampil walau arahnya kini tidak terbaca.
   * @param {Array<[string,string]>} daftarLama  DAFTAR_MODUS blangko-derry-saksi.js
   * @returns {Array<{label: string, opsi: Array<[string,string]>}>} label "" = tanpa kelompok
   */
  function opsiModus(daftarLama, arah, terpilih) {
    const lama = Array.isArray(daftarLama) ? daftarLama : [];
    const tolakNo = arah === "tolak" || arah === "no";
    if (!tolakNo) {
      const sisa = MODUS_ARAH.includes(terpilih) ? DAFTAR_MODUS_ARAH.filter(([n]) => n === terpilih) : [];
      return [{ label: "", opsi: [...lama, ...sisa] }];
    }
    return [
      { label: arah === "no" ? "Putusan tidak dapat diterima" : "Putusan ditolak", opsi: DAFTAR_MODUS_ARAH },
      { label: "Pilihan lain", opsi: lama.filter(([n]) => n !== "sama") },
    ];
  }

  /** Dasar keterangan saksi Tergugat/Termohon (keputusan 62). Bawaan "jawaban". */
  function daftarDasarT(P, T) {
    const p = teks(P).trim() || "Penggugat";
    const t = teks(T).trim() || "Tergugat";
    return [
      ["jawaban", `Sesuai jawaban dan duplik ${t}`],
      ["gugatan", `Ikut membenarkan gugatan ${p} (set ${p})`],
    ];
  }
  const dasarSah = (d) => (d === "gugatan" ? "gugatan" : "jawaban");

  /**
   * Set draf untuk satu daftar saksi dari daftar set (rute set-saksi). Saksi Tergugat/Termohon (pihak "T", dasar "jawaban") memakai
   * set ber-pihak "T" bila ada; selain itu set utama Penggugat + tambahan seperti dahulu (set ber-pihak "T" tidak pernah ikut).
   * @returns {{utama: object, tambahan: Array}|null}
   */
  function pilihSetPihak(daftar, pihak, dasar) {
    const sah = (Array.isArray(daftar) ? daftar : []).filter((x) => x && teks(x.id) && Array.isArray(x.baris) && x.baris.length);
    if (pihak === "T" && dasarSah(dasar) === "jawaban") {
      const t = sah.find((x) => x.pihak === "T" && !x.tambahan);
      if (t) return { utama: t, tambahan: [] };
    }
    const bukanT = sah.filter((x) => x.pihak !== "T");
    const utama = bukanT.find((x) => x.utama === true && !x.tambahan) || null;
    if (!utama) return null;
    return { utama, tambahan: bukanT.filter((x) => x.utama === true && x.tambahan === true && x.id !== utama.id) };
  }

  /**
   * Naskah jawaban & duplik untuk saksi Tergugat: isian Blangko Derry (12020 jawaban, 12024 duplik) bila sudah ada, selain itu
   * usulan e-Court (isi-gugatan). Dibatasi panjangnya.
   */
  const KODE_JAWABAN = "12020";
  const KODE_DUPLIK = "12024";
  function naskahT(o) {
    const r = o && typeof o === "object" ? o : {};
    const isi = r.isi && typeof r.isi === "object" ? r.isi : {};
    const usulan = Array.isArray(r.usulan) ? r.usulan : [];
    const ambil = (kode) => {
      const a = teks(isi[kode]).trim();
      if (a) return a;
      const u = usulan.find((x) => x && teks(x.kode) === kode && teks(x.nilai).trim());
      return u ? teks(u.nilai).trim() : "";
    };
    return { jawaban: ambil(KODE_JAWABAN).slice(0, 60000), duplik: ambil(KODE_DUPLIK).slice(0, 60000) };
  }

  /** Teks peringatan untuk lencana di panel (keputusan 61). */
  const TEKS_PERINGATAN = {
    gugatan: { label: "dari gugatan", teks: "Bunyi ini diambil dari gugatan/posita, bukan dari ucapan saksi. Sesuaikan dengan keterangan saksi di persidangan." },
    jawaban: { label: "dari jawaban", teks: "Bunyi ini disusun dari jawaban/duplik pihak, bukan dari ucapan saksi. Sesuaikan dengan keterangan saksi di persidangan." },
    pengetahuan: { label: "pastikan dengan saksi", teks: "Pengetahuan langsung saksi (melihat/mendengar sendiri, bentuk pertengkaran, upaya keluarga) disusun otomatis. Pastikan saksi sungguh menerangkannya." },
  };
  /**
   * Peringatan satu baris: hanya selama jawaban masih persis hasil susunan otomatis (begitu diketik petugas, tanda hilang).
   * @returns {{jenis: string, label: string, teks: string}|null}
   */
  function peringatanBaris(r) {
    const b = r && typeof r === "object" ? r : {};
    const u = b.usulan && typeof b.usulan === "object" ? b.usulan : null;
    if (!u || !TEKS_PERINGATAN[teks(u.peringatan)]) return null;
    if (b.otomatis === undefined || teks(b.otomatis) !== teks(b.jawab) || !teks(b.jawab).trim()) return null;
    const p = TEKS_PERINGATAN[teks(u.peringatan)];
    return { jenis: teks(u.peringatan), label: p.label, teks: p.teks };
  }

  /**
   * Tinjauan bagian E (1 Nov): hanya satu saksi Penggugat/Pemohon (unus testis) - blangko yang menyebutnya ("Unus Testis",
   * "(1 Saksi)"), BAS yang hanya punya satu daftar saksi P, atau satu daftar P berisi sedangkan daftar P lain kosong.
   * @param {{blangko?: string, daftar?: Array<{pihak: string, dimuat?: boolean, rows?: Array}>}} o
   */
  function satuSaksi(o) {
    const r = o && typeof o === "object" ? o : {};
    if (/unus\s+testis|\(\s*1\s+saksi\s*\)/i.test(teks(r.blangko))) return true;
    const p = (Array.isArray(r.daftar) ? r.daftar : []).filter((x) => x && x.pihak === "P");
    if (!p.length) return false;
    if (p.length === 1) return true;
    const berisi = (x) => (Array.isArray(x.rows) ? x.rows : []).some((b) => teks(b && b.jawab).trim());
    const kosong = (x) => x.dimuat && !(Array.isArray(x.rows) ? x.rows : []).some((b) => teks(b && b.tanya).trim() || teks(b && b.jawab).trim());
    return p.filter((x) => x.dimuat && berisi(x)).length === 1 && p.filter(kosong).length === p.length - 1;
  }

  const api = { satuSaksi, DAFTAR_MODUS_ARAH, MODUS_ARAH, arahPutusan, modusBawaan, opsiModus, daftarDasarT, dasarSah, pilihSetPihak, naskahT, peringatanBaris, TEKS_PERINGATAN, KODE_JAWABAN, KODE_DUPLIK };
  globalThis.AletaBdSaksiArah = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
