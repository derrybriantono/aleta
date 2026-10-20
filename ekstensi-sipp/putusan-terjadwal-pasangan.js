"use strict";

/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL - MEMASANGKAN BERKAS KE PERKARA (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Berkas putusan yang diseret banyak sekaligus dipasangkan ke perkara menurut
 * NOMOR PERKARA di nama berkas dan di isi berkas (isi dibaca server saat berkas
 * diunggah). Murni - tanpa DOM, tanpa jaringan, tanpa penyimpanan - supaya dapat
 * diuji langsung (module.exports) dan dipakai putusan-terjadwal.js (global
 * aletaPutusanTerjadwalPasangan).
 *
 * ATURAN (tidak ada tebakan; yang meragukan DITANDAI, bukan dipasang):
 *   - nomor dari NAMA dibaca persis seperti nomorDariNamaBerkas di konten.js
 *     (empat bentuk nama nyata; dua nomor berbeda dalam satu nama = kosong);
 *   - nomor dari ISI (RTF/DOCX/PDF) datang dari server; bila nama dan isi
 *     menyebut nomor BERBEDA -> "konflik", tidak dipasang;
 *   - nomor yang tidak ada di daftar perkara terpilih -> "tidak-cocok" (dapat
 *     ditambahkan sebagai perkara, atau dipasang manual);
 *   - dua berkas untuk satu perkara -> keduanya "ganda", tidak ada yang dipilihkan;
 *   - berita acara, PHS/PMH/PPP/PJS, relaas, sampul, akta, petitum, dokumen
 *     mediasi, dan berkas kunci Word ditandai "bukan-naskah" dari namanya;
 *     berkas anonimisasi ditandai "anonim" (anonimisasi dibuat sendiri dari putusan);
 *   - pilihan manual petugas menang atas semua tebakan otomatis, tetapi satu
 *     perkara tetap hanya satu berkas.
 *
 * SATU ATURAN, DUA SALINAN: pembaca nomor nama dan penanda bukan-naskah di sini
 * adalah salinan dari konten.js (nomorDariNamaBerkas, tandaBukanNaskahPutusan,
 * namaBerkasAnonim); uji ekstensi-putusan-terjadwal-pasangan-21okt mengadu
 * keduanya atas nama-nama nyata.
 */
(function (akar) {
  const POLA_PERKARA = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/g;

  /** Nomor dalam bentuk yang dapat dibandingkan: tanpa spasi/titik, tanpa nol di depan, huruf kecil. */
  function baku(nomor) {
    return String(nomor == null ? "" : nomor)
      .replace(/[\s.]+/g, "")
      .replace(/^0+(?=\d)/, "")
      .toLowerCase();
  }

  function jenisBaku(jenis) {
    return String(jenis)
      .split(/[._]/)
      .filter(Boolean)
      .map((b) => (b.length === 1 ? b.toUpperCase() : b[0].toUpperCase() + b.slice(1).toLowerCase()))
      .join(".");
  }

  /** Nomor perkara dari nama berkas; "" bila tidak ada atau lebih dari satu yang berbeda. */
  function nomorDariNama(nama) {
    const teks = String(nama || "");
    if (/^~\$/.test(teks)) return "";
    const temu = new Set();
    for (const m of teks.matchAll(/(?:^|[^\d])(\d{1,5})_(Pdt(?:\.[A-Za-z]{1,3}){1,2})_(\d{4})_(PA\.[A-Za-z]{2,5})(?![A-Za-z])/g)) {
      temu.add(`${m[1]}/${m[2]}/${m[3]}/${m[4]}`);
    }
    for (const m of teks.matchAll(/(?:^|[^A-Za-z])(PA\.[A-Za-z]{2,5})_(\d{4})_(Pdt(?:\.[A-Za-z]{1,3}){1,2})_(\d{1,5})(?!\d)/g)) {
      temu.add(`${m[4]}/${m[3]}/${m[2]}/${m[1]}`);
    }
    for (const m of teks.matchAll(/(?:^|[^\d])(\d{1,5})_Pdt_([A-Z][a-z]{0,2}(?:_[A-Z])?)_(\d{4})_PA_([A-Za-z]{2,5})(?![A-Za-z])/g)) {
      temu.add(`${m[1]}/Pdt.${jenisBaku(m[2])}/${m[3]}/PA.${m[4]}`);
    }
    for (const m of teks.matchAll(/putusan_(\d{1,5})_pdt((?:\.[a-z]{1,3}){1,2})_(\d{4})_pa\.([a-z]{2,5})_\d{8}/gi)) {
      temu.add(`${m[1]}/${jenisBaku(`pdt${m[2]}`)}/${m[3]}/PA.${jenisBaku(m[4])}`);
    }
    POLA_PERKARA.lastIndex = 0;
    let cocok;
    while ((cocok = POLA_PERKARA.exec(teks)) !== null) temu.add(cocok[1]);
    return temu.size === 1 ? [...temu][0] : "";
  }

  /** Nama yang menandai berkas BUKAN naskah putusan, atau "". */
  function tandaBukanNaskah(nama) {
    const teks = String(nama || "");
    if (/^~\$/.test(teks)) return "berkas kunci sementara Word (~$), bukan naskah";
    if (/(?:^|[^A-Za-z0-9])(?:BAS|berita[\s_.-]*acara)(?=[^A-Za-z0-9]|$)/i.test(teks)) return "berita acara sidang (BAS)";
    if (/(?:^|[^A-Za-z0-9])(?:PHS|PMH|PPP|PJS)(?=[^A-Za-z0-9]|$)/i.test(teks) || /penunjukan|penetapan[\s_.-]*(?:hari|majelis)/i.test(teks)) {
      return "penetapan hari sidang, majelis, atau penunjukan (PHS/PMH/PPP/PJS)";
    }
    if (/rela{1,2}s(?![a-z])|panggilan|pemberitahuan/i.test(teks)) return "relaas";
    if (/sampul/i.test(teks)) return "sampul berkas";
    if (/akta/i.test(teks)) return "akta";
    if (/petitum/i.test(teks)) return "petitum";
    if (/laporan[\s_.-]*mediasi|kesepakatan[\s_.-]*(?:mediasi|perdamaian)|pernyataan[\s_.-]*(?:para[\s_.-]*)?(?:pihak|mediasi)/i.test(teks)) {
      return "dokumen mediasi";
    }
    const edoc = /(?:^|[^A-Za-z])PA\.[A-Za-z]{2,5}_\d{4}_Pdt(?:\.[A-Za-z]{1,3}){1,2}_\d{1,5}_([A-Za-z][A-Za-z_]*)/.exec(teks);
    if (edoc && !/^putusan/i.test(edoc[1])) return `e-Doc SIPP berjenis "${edoc[1].replace(/_+$/, "")}", bukan putusan`;
    return "";
  }

  /** Nama yang menandai berkas anonimisasi. */
  function namaAnonim(nama) {
    return /anonim|(?:^|[^a-z])anom(?:[^a-z]|$)/i.test(String(nama || ""));
  }

  const BENTUK_NAMA = /\.(rtf|docx|doc|pdf)$/i;

  /**
   * Memasangkan.
   *
   * @param {{berkas: Array<{kunci:string, nama:string, nomorIsi?:string}>,
   *          perkara: Array<{kunci:string, nomor:string}>,
   *          manual?: Record<string, string>}} m
   *   manual: kunci berkas -> kunci perkara ("" = sengaja tidak dipasang)
   * @returns {Array<{kunci:string, status:string, perkaraKunci:string, nomorNama:string, nomorIsi:string, sumber:string, sebab:string}>}
   */
  function pasangkan(m) {
    const perkara = Array.isArray(m && m.perkara) ? m.perkara : [];
    const manual = (m && m.manual) || {};
    const peta = new Map();
    for (const p of perkara) peta.set(baku(p.nomor), p);
    const idPerkara = new Set(perkara.map((p) => p.kunci));

    const hasil = (Array.isArray(m && m.berkas) ? m.berkas : []).map((b) => {
      const nama = String(b.nama || "");
      const nomorNama = nomorDariNama(nama);
      const nomorIsi = String(b.nomorIsi || "");
      const dasar = { kunci: b.kunci, status: "", perkaraKunci: "", nomorNama, nomorIsi, sumber: "", sebab: "" };
      if (!BENTUK_NAMA.test(nama) && !b.bentuk) return { ...dasar, status: "bukan-naskah", sebab: "bentuk berkas tidak dikenal (hanya RTF, DOCX, DOC, PDF)" };
      const bukan = tandaBukanNaskah(nama);
      if (bukan) return { ...dasar, status: "bukan-naskah", sebab: bukan };
      if (namaAnonim(nama)) {
        return { ...dasar, status: "anonim", sebab: "anonimisasi dibuat sendiri dari putusan, jadi berkas ini tidak dipakai" };
      }
      if (Object.prototype.hasOwnProperty.call(manual, b.kunci)) {
        const k = manual[b.kunci];
        if (k && idPerkara.has(k)) return { ...dasar, status: "cocok", perkaraKunci: k, sumber: "manual", sebab: "dipasang petugas" };
        return { ...dasar, status: "tanpa-nomor", sebab: "belum dipasang" };
      }
      const a = nomorNama ? peta.get(baku(nomorNama)) : undefined;
      const i = nomorIsi ? peta.get(baku(nomorIsi)) : undefined;
      if (nomorNama && nomorIsi && baku(nomorNama) !== baku(nomorIsi)) {
        return { ...dasar, status: "konflik", sebab: `nama menyebut ${nomorNama}, isi menyebut ${nomorIsi} - tidak dipasang; periksa berkasnya` };
      }
      if (a || i) {
        const p = a || i;
        return { ...dasar, status: "cocok", perkaraKunci: p.kunci, sumber: a && i ? "nama+isi" : a ? "nama" : "isi", sebab: "" };
      }
      if (nomorNama || nomorIsi) {
        return { ...dasar, status: "tidak-cocok", sebab: `menyebut ${nomorNama || nomorIsi}, yang tidak ada di daftar perkara terpilih` };
      }
      return { ...dasar, status: "tanpa-nomor", sebab: "nomor perkara tidak terbaca dari nama maupun isi" };
    });

    // Satu perkara, satu berkas: dua yang menunjuk perkara sama = keduanya ganda, kecuali satu dipasang manual.
    const per = new Map();
    for (const h of hasil) if (h.status === "cocok") per.set(h.perkaraKunci, [...(per.get(h.perkaraKunci) || []), h]);
    for (const [, daftar] of per) {
      if (daftar.length < 2) continue;
      const manualSatu = daftar.filter((x) => x.sumber === "manual");
      for (const h of daftar) {
        if (manualSatu.length === 1 && h === manualSatu[0]) continue;
        h.status = "ganda";
        h.sebab = `ada ${daftar.length} berkas untuk satu perkara - pilih satu`;
        h.perkaraKunci = "";
      }
    }
    return hasil;
  }

  /** Ringkasan satu baris untuk petugas. */
  function ringkas(hasil) {
    const hitung = {};
    for (const h of hasil) hitung[h.status] = (hitung[h.status] || 0) + 1;
    return hitung;
  }

  const api = { baku, nomorDariNama, tandaBukanNaskah, namaAnonim, pasangkan, ringkas };
  akar.aletaPutusanTerjadwalPasangan = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
