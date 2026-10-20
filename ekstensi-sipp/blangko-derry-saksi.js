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
    ["mendengar", "Mendengar sendiri pertengkaran, tidak melihat"],
    ["sebagian", "Hanya sebagian alasan yang ia ketahui"],
    ["tidak-tahu", "Tahu berselisih & berpisah, tidak tahu sebabnya"],
    ["tidak-melihat", "Tidak pernah menyaksikan pertengkaran"],
    ["dari-cerita", "Tahu dari cerita salah satu pihak"],
    ["tahu-pisah", "Tidak tahu pertengkarannya, hanya tahu sudah pisah"],
    ["ragu", "Ragu dan kurang ingat"],
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
    // 20 Okt 2026: isian blangko perkara itu ikut dikirim (kode -> {nilai, keyakinan}) sebagai sumber pertama jawaban.
    const denganIsian = (m) => (r.isian && typeof r.isian === "object" && Object.keys(r.isian).length ? { ...m, isian: r.isian } : m);
    if (typeof susunMuatanSdg === "function") return denganIsian(susunMuatanSdg(r));
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
    return denganIsian({
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
    });
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
      // 19 Okt: satu jawaban satu paragraf - baris baru di tengah kalimat tidak pernah ikut terpasang.
      let usul = rapikanJawaban(b.jawab);
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
        // Kontrak bersama {teks, yakin, sumber} (+ ket untuk ikon i) dari pengisi jawaban bersumber; tampilan menghitung r.asal darinya.
        if (b.usulan && typeof b.usulan === "object" && b.usulan.yakin) r.usulan = { teks: usul, yakin: String(b.usulan.yakin), sumber: String(b.usulan.sumber || ""), ket: String(b.usulan.ket || "") };
        else delete r.usulan;
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

  // ==========================================================================
  // 19 Okt 2026 (tahap 2): satu jawaban satu paragraf, alasan sesuai posita, tombol per peran, tukar/pindah jawaban
  // ==========================================================================

  /**
   * Satu jawaban = SATU paragraf. Baris baru di tengah kalimat (posita yang disalin dari PDF) dilebur menjadi spasi,
   * karena SIPP/ABT membuang <br> sehingga "rumah[baris baru]tangga" tercetak "rumahtangga". Titik-titik isian tidak
   * disentuh; spasi sebelum koma/titik koma dibuang dan koma tanpa spasi dilengkapi. Idempoten. Cermin
   * rapikanKalimatSaksi di abtUsulanService (bot) dan satuParagrafSaksi di abt.js.
   */
  function rapikanJawaban(teks) {
    return String(teks == null ? "" : teks)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s+([,;:])/g, "$1")
      .replace(/([A-Za-z)])(,)(?=[A-Za-z(])/g, "$1$2 ")
      .replace(/,(\s*,)+/g, ",")
      .replace(/,\s*;/g, ";")
      .replace(/;(\s*;)+/g, ";");
  }

  /** Baris dengan jawaban yang memuat baris baru (jumlah), untuk laporan "N jawaban digabung". */
  const adaBarisBaru = (teks) => /[\r\n]/.test(String(teks || ""));

  /** Menyalin satu baris beserta penanda dasar/otomatis; baris di luar batas dilengkapi baris kosong. */
  function lengkapiBaris(rows, n) {
    const keluar = (rows || []).map((r) => ({ ...r }));
    while (keluar.length < n) keluar.push({ no: String(keluar.length + 1), tanya: "", jawab: "" });
    return keluar;
  }
  /** Jawaban + penandanya berpindah bersama (supaya susunan otomatis tidak menimpa jawaban yang sudah dipindah). */
  const BIDANG_JAWAB = ["jawab", "dasar", "otomatis"];
  function tukarBidang(a, b) {
    for (const f of BIDANG_JAWAB) {
      const ada = f in a || f in b;
      if (!ada) continue;
      const x = a[f];
      a[f] = b[f];
      b[f] = x;
      if (a[f] === undefined) delete a[f];
      if (b[f] === undefined) delete b[f];
    }
  }

  /**
   * Menggeser JAWABAN saja (pertanyaan tetap) satu baris ke atas/bawah dalam satu saksi: jawaban baris i bertukar
   * tempat dengan jawaban baris tetangganya. arah = -1 (naik) | 1 (turun).
   * @returns {{rows: Array, ok: boolean}} salinan; ok=false di ujung daftar.
   */
  function geserJawaban(rows, i, arah) {
    const j = i + (arah < 0 ? -1 : 1);
    const keluar = (rows || []).map((r) => ({ ...r }));
    if (i < 0 || i >= keluar.length || j < 0 || j >= keluar.length) return { rows: keluar, ok: false };
    tukarBidang(keluar[i], keluar[j]);
    return { rows: keluar, ok: true };
  }

  /**
   * Menukar jawaban baris i antara dua saksi (pertanyaan tetap di tempatnya). Daftar yang lebih pendek dilengkapi baris
   * kosong. @returns {{a: Array, b: Array}} salinan.
   */
  function tukarJawaban(rowsA, rowsB, i) {
    const n = Math.max((rowsA || []).length, (rowsB || []).length, i + 1);
    const a = lengkapiBaris(rowsA, n);
    const b = lengkapiBaris(rowsB, n);
    tukarBidang(a[i], b[i]);
    return { a, b };
  }

  /**
   * Menyalin jawaban baris i dari saksi `dari` ke saksi `ke`. Pertanyaan tujuan yang kosong diisi pertanyaan asal.
   * @returns {{b: Array}} salinan daftar tujuan.
   */
  function salinJawaban(rowsDari, rowsKe, i) {
    const n = Math.max((rowsDari || []).length, (rowsKe || []).length, i + 1);
    const a = lengkapiBaris(rowsDari, n);
    const b = lengkapiBaris(rowsKe, n);
    b[i].jawab = a[i].jawab;
    delete b[i].dasar;
    delete b[i].otomatis;
    if (!String(b[i].tanya || "").trim()) b[i].tanya = a[i].tanya;
    return { b };
  }

  /**
   * Alasan untuk centang "Hanya sebagian alasan yang ia ketahui": HANYA yang ada di posita perkara itu tampil langsung;
   * sisanya dilipat di "Alasan lain". Yang sudah dicentang petugas selalu tampil langsung. Posita belum terbaca / tidak
   * ada satu pun alasan cocok = semuanya tampil (tidak ada yang disembunyikan tanpa dasar).
   * @param {Array<{kunci:string,label:string}>} alasan  semua pilihan
   * @param {Set<string>|Array<string>|null} sesuai kunci alasan yang terbaca dari posita
   * @param {Array<string>} terpilih kunci yang sudah dicentang
   */
  function bagiAlasan(alasan, sesuai, terpilih) {
    const semua = Array.isArray(alasan) ? alasan : [];
    const set = sesuai instanceof Set ? sesuai : new Set(Array.isArray(sesuai) ? sesuai.map(String) : []);
    const dipilih = new Set((terpilih || []).map(String));
    const adaCocok = semua.some((a) => set.has(String(a.kunci)));
    if (!set.size || !adaCocok) return { utama: semua.slice(), lain: [], dariPosita: false };
    return {
      utama: semua.filter((a) => set.has(String(a.kunci)) || dipilih.has(String(a.kunci))),
      lain: semua.filter((a) => !set.has(String(a.kunci)) && !dipilih.has(String(a.kunci))),
      dariPosita: true,
    };
  }

  /** Isi menu "Lainnya" tanya jawab saksi: label berupa kalimat jelas + penjelasan singkat (title). */
  const MENU_LAINNYA = {
    urut: {
      label: "Sejajarkan pertanyaan yang sama",
      title: "Mengurutkan ulang daftar saksi kedua supaya pertanyaan yang sama berada di baris yang sama dengan saksi pertama. Berguna bila dua saksi memakai set pertanyaan berbeda.",
    },
    samakanq: {
      label: "Samakan bunyi pertanyaan dengan saksi pertama",
      title: "Mengganti bunyi pertanyaan saksi kedua menjadi sama dengan saksi pertama di setiap baris. Jawaban tidak berubah.",
    },
    salinsemua: {
      label: "Isi jawaban saksi kedua dari saksi pertama (kata diganti)",
      title: "Menyalin jawaban saksi pertama ke baris yang kosong atau sama pada saksi kedua, dengan beberapa kata diganti agar tidak persis sama. Jawaban saksi kedua yang sudah berbeda tidak diubah. Periksa hasilnya: keterangan tiap saksi harus tetap sesuai yang ia sampaikan.",
    },
    rapikan: {
      label: "Gabungkan baris yang terputus",
      title: "Menggabungkan baris baru di tengah kalimat menjadi satu paragraf per jawaban, supaya tulisan tidak menempel saat dicetak.",
    },
  };

  /**
   * Deret tombol tanya jawab saksi menurut jenis blangko dan peran.
   *   - Hanya penyusun berita acara (PP/admin) pada blangko BAS yang boleh menyunting;
   *   - putusan/penetapan dan peran hakim: hanya baca (tanpa satu pun tombol tanya jawab);
   *   - "Tambah baris" dan "Simpan ke ABT" di BAWAH tabel; tidak ada "Selesai"; "Bersihkan kalimat penutup" tidak ditampilkan di BAS
   *     (itu bawaan putusan); "Urungkan"/"Ulangi" tetap.
   * @param {{jenis: string, bolehTulis: boolean, hakimSaja?: boolean, berpasangan?: boolean}} o
   */
  function deretTombol(o) {
    const r = o && typeof o === "object" ? o : {};
    const hanyaBaca = !(r.jenis === "bas" && r.bolehTulis === true && r.hakimSaja !== true);
    if (hanyaBaca) return { hanyaBaca: true, atas: [], urungUlang: false, lainnya: [], bawah: [] };
    return {
      hanyaBaca: false,
      atas: ["set", "muat"],
      urungUlang: true,
      lainnya: (r.berpasangan ? ["urut", "samakanq", "salinsemua"] : []).concat(["rapikan"]).map((k) => ({ kunci: k, ...MENU_LAINNYA[k] })),
      bawah: ["tambah", "simpan"], // 20 Okt: "Tambah baris" di bawah tabel, bersama Simpan ke ABT
    };
  }

  const api = {
    rapikanJawaban,
    adaBarisBaru,
    geserJawaban,
    tukarJawaban,
    salinJawaban,
    bagiAlasan,
    deretTombol,
    MENU_LAINNYA,
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
