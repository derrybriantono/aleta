"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - JAWABAN SAKSI OTOMATIS (19 Okt 2026)
 * ============================================================================
 *
 * Tanya jawab saksi di Blangko Derry dahulu hanya memuat contoh jawaban
 * (titik-titik apa adanya) dan tidak punya pilihan pengetahuan saksi. Berkas
 * ini memberi dua hal yang SAMA dengan "Susun keterangan saksi" di panel ABT
 * (abt.js):
 *
 *   1. daftar pilihan pengetahuan saksi (DAFTAR_MODUS), sumber cerita
 *      (DAFTAR_SUMBER), dan centang alasan untuk "sebagian";
 *   2. jawaban yang disusun oleh jalur server yang sama (permintaan
 *      'saksi-sdg' ke /abt/usulan): isian dari data perkara di SIPP dan dari
 *      gugatan. Rumusnya TIDAK disalin ke sini; berkas ini hanya menyusun
 *      muatan, mengirimnya, dan memasang hasilnya ke baris tanya jawab.
 *
 * Aturan memasang hasil (murni - diuji langsung):
 *   - isian yang sudah diketik petugas selalu menang: baris hanya diganti
 *     bila kosong, masih berupa contoh/dasar dari set pertanyaan, atau hasil
 *     susunan otomatis sebelumnya;
 *   - bagian yang datanya tidak ada tetap titik-titik (penanda "[BELUM
 *     TERISI ...]" dari server tidak pernah dimasukkan ke baris);
 *   - jawaban berpilihan (dua kemungkinan) tidak dipilihkan;
 *   - yang sudah diketik dan berbeda dari usulan dilaporkan sebagai
 *     "tertahan"; menimpanya butuh konfirmasi di halaman.
 *
 * Tidak menyentuh DOM dan tidak menulis ke ABT. Penyimpanan tetap lewat
 * "Simpan ke ABT" di blangko-derry-isian.js.
 */
(function () {
  // Cermin DAFTAR_MODUS dan DAFTAR_SUMBER di abt.js (urutan dan tulisan sama);
  // ujinya (blangko-derry-saksi-sinkron-19okt) membandingkan keduanya.
  const DAFTAR_MODUS = [
    ["sama", "Tahu seluruh alasan, melihat sendiri"],
    ["sebagian", "Hanya sebagian alasan yang ia ketahui"],
    ["tidak-tahu", "Tahu berselisih & berpisah, tidak tahu sebabnya"],
    ["tidak-melihat", "Tidak pernah menyaksikan pertengkaran"],
    ["dari-cerita", "Tahu dari cerita salah satu pihak"],
    ["tahu-pisah", "Tidak tahu pertengkarannya, hanya tahu sudah pisah"],
  ];
  const DAFTAR_SUMBER = [
    ["penggugat", "Penggugat/Pemohon"],
    ["tergugat", "Tergugat/Termohon"],
    ["keluarga", "keluarga"],
  ];
  // Cadangan terakhir pilihan alasan (cermin DAFTAR_ALASAN_SDG di abt.js); dipakai hanya bila abt.js tidak termuat.
  const ALASAN_CADANGAN = [
    "perselisihan terus-menerus",
    "kekerasan dalam rumah tangga",
    "tidak memberi nafkah",
    "pihak lain (wanita/pria idaman lain)",
    "cemburu",
    "obat terlarang",
    "judi",
    "mabuk",
    "murtad/pindah agama",
    "temperamental",
    "berkata kasar",
    "bersikap kasar",
    "malas bekerja",
    "tidak memiliki pekerjaan tetap",
    "masalah ekonomi",
    "menikah lagi",
  ];
  const BATAS_SAKSI = { P: 5, T: 4 };

  const RE_TITIK = /\.{3,}|…|_{2,}|#\d{3,5}#/;
  const RE_TANDA_BELUM = /^\s*\[BELUM TERISI/i;
  const RE_ALETA = /aleta/i;
  const norm = (t) =>
    String(t || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const adaTitik = (teks) => RE_TITIK.test(String(teks || ""));
  const tandaBelumTerisi = (teks) => RE_TANDA_BELUM.test(String(teks || ""));

  /** Alasan yang tersedia: milik abt.js bila termuat (DAFTAR_ALASAN_SDG), selain itu cadangan di sini. */
  function alasanBawaan() {
    const daftar = typeof DAFTAR_ALASAN_SDG !== "undefined" && Array.isArray(DAFTAR_ALASAN_SDG) ? DAFTAR_ALASAN_SDG : ALASAN_CADANGAN;
    return daftar.map((a) => ({ kunci: a, label: a }));
  }

  /** Pilihan bawaan: saksi pertama tahu semuanya, yang lain hanya sebagian (sama dengan borang Susun saksi). */
  const modusBawaan = (urut) => (Number(urut) === 0 ? "sama" : "sebagian");

  /** Pilihan satu saksi yang sudah dibersihkan; nilai di luar daftar jatuh ke bawaan. */
  function bakukanPilihan(p, urut) {
    const r = p && typeof p === "object" ? p : {};
    const modus = DAFTAR_MODUS.some(([n]) => n === r.modus) ? r.modus : modusBawaan(urut);
    const sumber = DAFTAR_SUMBER.some(([n]) => n === r.sumber) ? r.sumber : "penggugat";
    const alasan = Array.isArray(r.alasan) ? r.alasan.map(String).filter(Boolean).slice(0, 16) : [];
    return { modus, sumber, alasan };
  }

  function sebutanSumber(kode, pelaku, lawan) {
    if (typeof sebutanSumberSdg === "function") return sebutanSumberSdg(kode, pelaku, lawan);
    if (kode === "keluarga") return "keluarga mereka";
    if (kode === "tergugat") return String(pelaku || "").trim() || "Tergugat";
    return String(lawan || "").trim() || "Penggugat";
  }

  /**
   * Muatan permintaan 'saksi-sdg'. Memakai susunMuatanSdg milik abt.js bila ada (satu-satunya sumber bentuk muatan);
   * cadangan lokal berbentuk sama untuk halaman yang abt.js-nya tidak termuat.
   *
   *   saksi [{pihak 'P'|'T', ke, modus, sumber, alasan[]}] dalam urutan permintaan
   */
  function susunMuatan(o) {
    const r = o && typeof o === "object" ? o : {};
    if (typeof susunMuatanSdg === "function") return susunMuatanSdg(r);
    const saksi = (Array.isArray(r.saksi) ? r.saksi : []).map((s) => ({
      ke: Number(s.ke),
      pihak: s.pihak === "T" ? "T" : "P",
      modus: String(s.modus || "sama"),
      sumber: String(s.sumber || "penggugat"),
      sumberNama: sebutanSumber(String(s.sumber || "penggugat"), r.pelaku, r.lawan),
      alasan: Array.isArray(s.alasan) ? s.alasan.map(String) : [],
    }));
    const polos = (s) => (s ? { modus: s.modus, sumber: s.sumber, sumberNama: s.sumberNama, alasan: s.alasan } : undefined);
    const saksiP = saksi.filter((s) => s.pihak === "P");
    return {
      nomorPerkara: String(r.nomorPerkara || ""),
      sumber: "saksi-sdg",
      templat: Array.isArray(r.templat) ? r.templat : [],
      kodeKumpulan: String(r.kodeKumpulan || ""),
      jenisPerkara: String(r.jenisPerkara || ""),
      alur: String(r.alur || ""),
      alasan: Array.isArray(r.alasan) ? r.alasan : [],
      posita: String(r.posita || ""),
      pelaku: String(r.pelaku || ""),
      lawan: String(r.lawan || ""),
      modus: { saksi1: polos(saksiP[0] || saksi[0]), saksi2: polos(saksiP[1] || saksi[1]) },
      saksi,
    };
  }

  /** Baris boleh diganti susunan otomatis: kosong, masih dasar/contoh set, atau hasil susunan otomatis terakhir. */
  function dapatDiganti(baris) {
    const r = baris || {};
    const j = String(r.jawab || "");
    if (!j.trim()) return true;
    if (r.otomatis !== undefined && j === r.otomatis) return true;
    if (r.dasar !== undefined && j === r.dasar) return true;
    return false;
  }

  /**
   * Menandai dasar baris-baris yang baru dimuat: dari set pertanyaan/templat semua baris (`semua`), dari ABT hanya baris
   * yang masih bertitik-titik (jawaban lengkap yang tersimpan di ABT dianggap milik petugas).
   */
  function tandaiDasar(rows, semua) {
    return (rows || []).map((r) => {
      const baru = { ...r };
      if (semua || adaTitik(baru.jawab)) baru.dasar = String(baru.jawab || "");
      else delete baru.dasar;
      delete baru.otomatis;
      return baru;
    });
  }

  /** Templat yang dikirim: dasar bila ada (bukan hasil susunan terakhir), selain itu jawaban saat ini. */
  function templatDariBaris(rows) {
    return (rows || []).map((r, i) => ({
      no: String(i + 1),
      tanya: String(r.tanya || ""),
      jawab: String(r.dasar !== undefined ? r.dasar : r.jawab || ""),
    }));
  }

  /** Kunci tanda tangan daftar pertanyaan (tanya saja) - dua saksi dengan pertanyaan sama dapat memakai satu permintaan. */
  const tandaTanya = (rows) => (rows || []).map((r) => norm(r.tanya)).join("|");

  /** Isi hubungan saksi dari data SIPP ke "saya adalah ... Penggugat" (hanya bila SIPP mencatatnya). */
  function isiHubungan(jawab, hubungan) {
    const teks = hubungan && hubungan.asal === "sipp" && hubungan.teks ? String(hubungan.teks).trim() : "";
    if (!teks) return jawab;
    const pola = /(\b(?:adalah|sebagai|saya)\s+)(?:\.{3,}|…|_{2,})(\s+(?:Penggugat|Pemohon|Tergugat|Termohon)\b(?:\s+(?:I{1,3}|IV|\d)\b)?)/i;
    return String(jawab).replace(pola, (_, depan) => `${depan}${teks}`);
  }

  /**
   * Memasang jawaban hasil server ke baris satu saksi. Tidak mengubah `rows` (mengembalikan salinan).
   *
   * @param {Array} rows     baris saat ini [{no,tanya,jawab,dasar?,otomatis?}]
   * @param {Array} jawaban  hasil server untuk saksi itu: [{no,tanya,jawab,pilihan?,belumTerisi?}] (indeks = indeks baris)
   * @param {{hubungan?: object, timpa?: boolean}} opsi  timpa: ganti juga baris yang sudah diketik
   * @returns {{rows: Array, terisi: number, tetapTitik: number, tertahan: Array<{i:number,usul:string}>, pilihan: number}}
   */
  function pasangJawaban(rows, jawaban, opsi) {
    const o = opsi || {};
    const keluar = (rows || []).map((r) => ({ ...r }));
    const hasil = { rows: keluar, terisi: 0, tetapTitik: 0, tertahan: [], pilihan: 0 };
    const daftar = Array.isArray(jawaban) ? jawaban : [];
    keluar.forEach((r, i) => {
      const b = daftar[i];
      if (!b || typeof b !== "object") {
        if (adaTitik(r.jawab)) hasil.tetapTitik += 1;
        return;
      }
      if (Array.isArray(b.pilihan) && b.pilihan.length >= 2) {
        hasil.pilihan += 1;
        if (adaTitik(r.jawab)) hasil.tetapTitik += 1;
        return;
      }
      let usul = String(b.jawab || "").trim();
      if (!usul || b.belumTerisi || tandaBelumTerisi(usul)) {
        if (adaTitik(r.jawab)) hasil.tetapTitik += 1;
        return;
      }
      usul = isiHubungan(usul, o.hubungan);
      // Tidak satu kata pun tentang aplikasi ini boleh masuk ke isian yang akan disimpan ke ABT.
      if (RE_ALETA.test(usul)) {
        if (adaTitik(r.jawab)) hasil.tetapTitik += 1;
        return;
      }
      const sekarang = String(r.jawab || "");
      if (norm(usul) === norm(sekarang) && usul.trim() === sekarang.trim()) {
        if (adaTitik(sekarang)) hasil.tetapTitik += 1;
        return;
      }
      if (dapatDiganti(r) || o.timpa === true) {
        if (r.dasar === undefined) r.dasar = sekarang;
        r.jawab = usul;
        r.otomatis = usul;
        hasil.terisi += 1;
        if (adaTitik(usul)) hasil.tetapTitik += 1;
        return;
      }
      hasil.tertahan.push({ i, usul });
      if (adaTitik(sekarang)) hasil.tetapTitik += 1;
    });
    return hasil;
  }

  /** Kalimat ringkasan untuk petugas (tanpa istilah teknis). */
  function ringkasan(h) {
    const bagian = [];
    if (h.terisi) bagian.push(`${h.terisi} jawaban disusun dari data perkara di SIPP dan gugatan`);
    if (h.tetapTitik) bagian.push(`${h.tetapTitik} jawaban tetap titik-titik karena datanya belum ada, lengkapi dari keterangan saksi`);
    if (h.pilihan) bagian.push(`${h.pilihan} jawaban punya dua kemungkinan, pilih sendiri`);
    if (!bagian.length) return "Tidak ada jawaban yang berubah.";
    return `${bagian.join("; ")}.`;
  }

  /**
   * Meminta jawaban ke server (jalur 'saksi-sdg' yang sama dengan Susun saksi).
   * `ambil(muatan)` -> isi usulan (objek berisi available/saksiSdg); dipasok pemanggil supaya berkas ini tak tahu jaringan.
   */
  async function minta(ambil, muatan) {
    const isi = await ambil(muatan);
    if (!isi || isi.available === false) throw new Error((isi && isi.message) || "Server belum menjawab, jawaban saksi belum dapat disusun.");
    const h = isi.saksiSdg;
    if (!h || h.ok === false) throw new Error(h && h.alasan === "templat_kosong" ? "Daftar pertanyaan masih kosong." : "Jawaban saksi belum dapat disusun.");
    return h;
  }

  const api = {
    DAFTAR_MODUS,
    DAFTAR_SUMBER,
    BATAS_SAKSI,
    alasanBawaan,
    modusBawaan,
    bakukanPilihan,
    susunMuatan,
    dapatDiganti,
    tandaiDasar,
    templatDariBaris,
    tandaTanya,
    adaTitik,
    tandaBelumTerisi,
    isiHubungan,
    pasangJawaban,
    ringkasan,
    minta,
  };
  globalThis.AletaBdSaksi = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
