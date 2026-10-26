"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - PENGISI JAWABAN KATALOG DARI DATA (20 Okt 2026)
 * ============================================================================
 *
 * Titik pasang yang dipanggil blangko-derry-isian.js tiap kali susunan tanya jawab katalog jenis perkara dibuat
 * (lihat blangko-derry-katalog.js, TITIK PASANG pengisi jawaban):
 *
 *   globalThis.AletaBdJawabanKatalog.usulkan({ perkara, kenal, keadaan, saksi, variabel })
 *       -> Promise<{ [kunciJawaban]: {teks, yakin, sumber, ket} }>
 *
 * Jawaban dasar katalog yang masih bertitik-titik ("... yaitu pada tanggal ...") diisi dari tiga sumber BERURUTAN:
 *   1. isian blangko perkara itu (kartu isian: tanggal nikah, KUA, wali, yang menikahkan, mahar, saksi nikah, ...);
 *   2. data SIPP (data pernikahan, itsbat, anak, pihak);
 *   3. posita/permohonan (mesin deteksi bot + pola tambahan).
 * Pengisiannya dikerjakan bot (aleta_bot/services/isiJawabanSaksi*.js, permintaan sumber 'isi-jawaban' ke
 * /abt/usulan) - berkas ini hanya menyusun permintaan dan memetakan hasilnya. Perkara cerai tidak lewat sini
 * (jalur lama 'saksi-sdg' yang diisi pengisi yang sama).
 *
 * Kunci hasil: `kunciJawaban` baris (sama untuk dua saksi bila butir dan tingkat pengetahuannya sama) dan, untuk
 * kalimat yang dibedakan menurut saksi, `kunciJawaban@kunciSaksi` (mis. "itsbat-nikah/q-in-mahar-pb/melihat@saksi 2 p").
 * Isian yang sudah diketik petugas TIDAK pernah ditimpa: itu dijaga pemasang (terapkanUsulan) di blangko-derry-katalog.js.
 *
 * Murni selain satu permintaan jaringan; gagal = {} (jawaban dasar katalog tetap terpasang).
 */
(function () {
  const API_USULAN = "/aleta/api/aleta-bot/abt/usulan";
  const RE_KOSONG = /\.{3,}|…/;
  const teks = (x) => String(x === undefined || x === null ? "" : x);

  /** Tingkat pengetahuan katalog -> modus pengisi. "de-auditu" (dari cerita) memakai bunyi katalognya sendiri. */
  function modusDariJenis(jenis) {
    const j = teks(jenis).toLowerCase();
    if (j === "tidak-tahu" || j === "ragu" || j === "lupa") return j;
    return "melihat";
  }

  /** Muatan permintaan 'isi-jawaban' (murni; diuji langsung). */
  function susunMuatan(o) {
    const r = o && typeof o === "object" ? o : {};
    const p = r.perkara && typeof r.perkara === "object" ? r.perkara : {};
    const seb = (r.kenal && r.kenal.sebutan) || {};
    const saksiIsi = [];
    for (const s of Array.isArray(r.saksi) ? r.saksi : []) {
      const baris = [];
      for (const b of Array.isArray(s.baris) ? s.baris : []) {
        if (!b || !b.kunciJawaban || !RE_KOSONG.test(teks(b.jawab))) continue;
        // `kode` = jawaban dengan penanda ⟦#kode#⟧/⟦{slot}⟧ di tempat yang belum terisi: pengisi mengisinya satu per satu menurut isinya
        const kode = typeof b.jawabKode === "string" && /⟦/.test(b.jawabKode) ? b.jawabKode : "";
        baris.push({ kunci: teks(b.kunciJawaban), tanya: teks(b.tanya), jawab: teks(b.jawab), ...(kode ? { kode } : {}) });
      }
      if (baris.length) saksiIsi.push({ kunci: teks(s.kunci), ke: Number(s.ke) || saksiIsi.length + 1, modus: modusDariJenis(s.jenis), sumberNama: "", baris });
    }
    // isian: kartu blangko (hook panel) lalu nilai variabel ABT yang terbaca untuk pertanyaan
    const isian = {};
    try {
      const dariPanel = typeof globalThis !== "undefined" && typeof globalThis.AletaBdIsianSaksi === "function" ? globalThis.AletaBdIsianSaksi() : null;
      if (dariPanel && typeof dariPanel === "object") Object.assign(isian, dariPanel);
    } catch {
      /* tanpa isian kartu: sumber lain tetap dipakai */
    }
    for (const [kode, v] of Object.entries(r.variabel && typeof r.variabel === "object" ? r.variabel : {})) {
      const nilai = teks(v).trim();
      if (nilai && /^\d{3,5}$/.test(kode) && !isian[kode]) isian[kode] = { nilai: nilai.slice(0, 700), keyakinan: "pasti" };
    }
    return {
      sumber: "isi-jawaban",
      nomorPerkara: teks(p.nomorPerkara),
      jenisPerkara: teks(p.jenisPerkaraId || p.jenisPerkara),
      alur: teks(p.alurPerkaraId),
      kunciKatalog: teks(r.kenal && r.kenal.kunci),
      kodeVariabel: (Array.isArray(r.kodeBelum) ? r.kodeBelum : []).map(teks).filter((x) => /^\d{4}$/.test(x)).slice(0, 60),
      pelaku: teks(seb.T),
      lawan: teks(seb.P),
      isian,
      saksiIsi,
    };
  }

  async function kirim(muatan) {
    const opsi = { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(muatan) };
    const r = typeof alatAmbil === "function" ? await alatAmbil(API_USULAN, opsi, "Mengisi jawaban dari data perkara") : await fetch(API_USULAN, opsi);
    const luar = await r.json().catch(() => null);
    if (!r.ok || !luar || luar.ok === false) return null;
    return luar.data !== undefined ? luar.data : luar;
  }

  /**
   * Variabel ABT (kode -> {teks, yakin, sumber, ket?, label?, saran?}) yang dihitung bot dari data perkara (`__variabel`).
   * T2: `saran` = sebab/alasan yang hanya didalilkan posita (belum dikuatkan saksi) - panel menandainya kuning.
   */
  function petakanVariabel(isi) {
    const variabel = {};
    const asal = isi && typeof isi === "object" && isi["__variabel"] && typeof isi["__variabel"] === "object" ? isi["__variabel"] : {};
    for (const [kode, v] of Object.entries(asal)) {
      const t = v && typeof v === "object" ? teks(v.teks).trim() : "";
      if (!/^\d{4}$/.test(kode) || !t || /aleta/i.test(t)) continue;
      const saran = Array.isArray(v.saran) && v.saran.length;
      variabel[kode] = { teks: t, yakin: v.yakin === "ragu" || saran ? "ragu" : "yakin", sumber: teks(v.sumber) };
      if (v.ket) variabel[kode].ket = teks(v.ket).slice(0, 300);
      if (v.label) variabel[kode].label = teks(v.label).slice(0, 80);
      if (saran) variabel[kode].saran = true;
    }
    return variabel;
  }

  /** Hasil rute -> peta kunci -> {teks, yakin, sumber, ket}; hanya bentuk yang sah dan tanpa nama aplikasi. */
  function petakan(isi) {
    const hasil = {};
    if (!isi || typeof isi !== "object") return hasil;
    // variabel ABT (kode -> nilai) yang dihitung dari data: tidak ikut peta jawaban, dibawa sebagai properti terpisah
    const variabel = petakanVariabel(isi);
    Object.defineProperty(hasil, "variabel", { value: variabel, enumerable: false });
    for (const [kunci, v] of Object.entries(isi)) {
      if (kunci === "__variabel") continue;
      const t = v && typeof v === "object" ? teks(v.teks).trim() : "";
      if (!t || /aleta/i.test(t)) continue;
      const yakin = v.yakin === "yakin" || v.yakin === "ragu" ? v.yakin : "cukup";
      hasil[kunci] = { teks: t, yakin, sumber: teks(v.sumber), ket: teks(v.ket) };
      if (Array.isArray(v.saran) && v.saran.length) Object.assign(hasil[kunci], { yakin: "ragu", saran: true });
    }
    return hasil;
  }

  async function usulkan(o) {
    const muatan = susunMuatan(o);
    if ((!muatan.saksiIsi.length && !muatan.kodeVariabel.length) || !muatan.nomorPerkara) return {};
    try {
      const data = await kirim(muatan);
      if (!data || data.available === false) return {};
      return petakan(data.isiJawaban);
    } catch {
      return {};
    }
  }

  /** Fakta perkara -> peta kunci -> {nilai, yakin, sumber, ket}; hanya teks yang sah dan tanpa nama aplikasi. */
  function petakanFakta(f) {
    const hasil = {};
    if (!f || typeof f !== "object") return hasil;
    for (const [kunci, v] of Object.entries(f)) {
      const nilai = v && typeof v === "object" ? teks(v.nilai).trim() : "";
      if (!nilai || /aleta/i.test(nilai) || !/^[a-zA-Z]{2,30}$/.test(kunci)) continue;
      const yakin = v.yakin === "yakin" || v.yakin === "ragu" ? v.yakin : "cukup";
      hasil[kunci] = { nilai: nilai.slice(0, 400), yakin, sumber: teks(v.sumber).slice(0, 80), ket: teks(v.ket).slice(0, 300) };
    }
    return hasil;
  }

  /**
   * Fakta perkara apa adanya (tanggal dan tempat nikah, anak, awal dan sebab perselisihan, puncak, pisah sejak, alamat, pekerjaan)
   * dari isian blangko > data SIPP > gugatan, lewat permintaan 'isi-jawaban' dengan mintaFakta. Dipakai penyusun saksi katalog di panel
   * ABT; gagal = {} (penyusun memakai isian petugas dan variabel ABT saja).
   *   o = { perkara: {nomorPerkara, jenisPerkaraId, alurPerkaraId}, sebutan: {P, T}, posita, tanggalSidang, variabel: {kode: nilai},
   *         kodeVariabel?: [kode], kunciKatalog? }
   * T2 (semua jenis): `kodeVariabel` = variabel katalog yang KOSONG di ABT; nilainya dihitung bot dari data yang sama dan dibawa
   * sebagai properti tak-terhitung `variabel` ({kode: {teks, yakin, sumber, ket, label, saran}}).
   */
  async function ambilFakta(o) {
    const r = o && typeof o === "object" ? o : {};
    const p = r.perkara && typeof r.perkara === "object" ? r.perkara : {};
    const seb = r.sebutan && typeof r.sebutan === "object" ? r.sebutan : {};
    if (!teks(p.nomorPerkara)) return {};
    const kodeVariabel = (Array.isArray(r.kodeVariabel) ? r.kodeVariabel : []).map(teks).filter((x) => /^\d{4}$/.test(x)).slice(0, 60);
    const isian = {};
    try {
      const dariPanel = typeof globalThis !== "undefined" && typeof globalThis.AletaBdIsianSaksi === "function" ? globalThis.AletaBdIsianSaksi() : null;
      if (dariPanel && typeof dariPanel === "object") Object.assign(isian, dariPanel);
    } catch {
      /* tanpa isian kartu */
    }
    for (const [kode, v] of Object.entries(r.variabel && typeof r.variabel === "object" ? r.variabel : {})) {
      const nilai = teks(v).trim();
      if (nilai && /^\d{3,5}$/.test(kode) && !isian[kode]) isian[kode] = { nilai: nilai.slice(0, 700), keyakinan: "pasti" };
    }
    try {
      const data = await kirim({
        sumber: "isi-jawaban",
        mintaFakta: true,
        nomorPerkara: teks(p.nomorPerkara),
        jenisPerkara: teks(p.jenisPerkaraId || p.jenisPerkara),
        alur: teks(p.alurPerkaraId),
        pelaku: teks(seb.T),
        lawan: teks(seb.P),
        posita: teks(r.posita).slice(0, 60000),
        tanggalSidang: teks(r.tanggalSidang).slice(0, 40),
        isian,
        saksiIsi: [],
        ...(kodeVariabel.length ? { kodeVariabel } : {}),
        ...(teks(r.kunciKatalog) ? { kunciKatalog: teks(r.kunciKatalog).slice(0, 60) } : {}),
        // C5/U9: saran keadaan perkara non-cerai dari posita/petitum (saklar Fitur Satker "fakta-non-cerai"; hanya diminta bila menyala)
        ...(r.keadaanNonCerai === true ? { keadaanNonCerai: true } : {}),
      });
      if (!data || data.available === false) return {};
      const fakta = petakanFakta(data.faktaPerkara);
      Object.defineProperty(fakta, "variabel", { value: kodeVariabel.length ? petakanVariabel(data.isiJawaban) : {}, enumerable: false });
      Object.defineProperty(fakta, "keadaanSaran", {
        value: data.keadaanNonCerai && Array.isArray(data.keadaanNonCerai.saran) ? data.keadaanNonCerai.saran : [],
        enumerable: false,
      });
      return fakta;
    } catch {
      return {};
    }
  }

  const api = { usulkan, susunMuatan, petakan, petakanVariabel, modusDariJenis, ambilFakta, petakanFakta };
  globalThis.AletaBdJawabanKatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
