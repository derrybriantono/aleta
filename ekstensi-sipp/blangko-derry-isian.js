"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - TAHAP F (PERLU DIISI) DAN G (PRATINJAU, CETAK)
 * ============================================================================
 *
 * Skrip konten ABT, berkas TERSENDIRI yang menempel pada kerangka tahap C-D
 * (blangko-derry.js) lewat api globalThis.aletaBlangkoDerry: wadah
 * "pilih-blangko", "perlu-diisi", "pratinjau", "cetak", peristiwa
 * "aleta-bd-perkara", dan daftarkanAlat(). Memakai klien ABT abt-klien.js
 * (abtKlienBuat) untuk SEMUA jalan ke ABT - rute yang sama dengan jendela
 * sembul ABT sendiri.
 *
 * Yang ditegakkan di sini (peta A-PETA-ABT.md, 16 Okt 2026):
 *   - hak membuka blangko diperiksa lewat POST main/cari (dialihkan = boleh;
 *     200 = ditolak beserta sebabnya) SEBELUM isian dibaca atau ditulis;
 *   - main/view TIDAK pernah dipanggil; preview (RTF) hanya ketika petugas
 *     membuka pratinjau atau menekan Cetak, dengan penanda memuat;
 *   - isian teks/tanggal berkunci (no_var, perkara_id) - BUKAN per sidang:
 *     BAS beruntun saling menimpa, dan layar mengatakannya;
 *   - keterangan saksi per sidang (d = urutan sidang); sidang diperiksa ada
 *     sebelum menulis (klien), pembacaan sidang tidak diulang-ulang;
 *   - huruf di luar cp1252 (kolom ABT latin1) ditolak sebelum ditulis;
 *   - peran: hakim menulis putusan, panitera pengganti BAS, juru sita relaas;
 *     Super Admin/Admin semuanya - rute ABT sendiri tidak memeriksanya;
 *   - GET main/tanyajawab_template?hapus= tidak pernah dipanggil.
 *
 * Bahan "Perlu diisi" datang dari portal (/aleta-ecourt/blangko-derry):
 * penanda RTF blangko x katalog variabel ABT, nilai tersimpan per perkara.
 * Menyimpan selalu lewat ABT (edit_data, tanyajawab_perkara_edit).
 */
(function blangkoDerryIsianModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaBlangkoDerryIsian) return;

  // ──────────────────────────────────────────────────────────────────────────
  // Konstanta
  // ──────────────────────────────────────────────────────────────────────────
  const API_BLANGKO = "/aleta/api/aleta-ecourt/blangko-derry";
  /** F3.1: riwayat skors satu sidang + usulan kalimat BAS (hanya baca). */
  const API_SKORS_SIDANG = "/aleta/api/aleta-ecourt/sidang/skors";
  const API_PDF = "/aleta/api/aleta-bot/abt/pdf";
  /** 28 Okt: putusan yang disunting sendiri (DOCX/DOC) diubah ke RTF lewat rute yang sama dengan unggah putusan otomatis; hanya MENGHITUNG. */
  const API_KONVERSI_NASKAH = "/aleta/api/aleta-ecourt/putusan/konversi-naskah";
  const BATAS_UNGGAH_PUTUSAN = 20 * 1024 * 1024; // sama dengan batas rute konversi-naskah
  /** 22 Okt malam: Tes putusan - naskah dihitung di ALETA (data perkara acuan + ketikan petugas). Hanya MENGHITUNG, tidak menyimpan apa pun. */
  const API_TES_NASKAH = "/aleta/api/aleta-ecourt/blangko-derry/tes-naskah";
  const API_USULAN = "/aleta/api/aleta-bot/abt/usulan";
  const API_TTD = "/aleta/api/aleta-ecourt/tanda-tangan";
  const API_UKURAN_TTD = "/aleta/api/aleta-ecourt/ukuran-ttd-cap"; // 20 Okt: ukuran TTD & cap satu set (kartu portal)
  const API_UNGGAH_SIPP = "/aleta/api/aleta-ecourt/putusan/unggah-sipp";
  const API_KTP_PIHAK = "/aleta/api/aleta-ecourt/ktp-pihak";
  /** Akar portal (basePath) yang sama dengan alamat rute di atas: "/aleta". */
  const AKAR_PORTAL = API_BLANGKO.replace(/\/api\/.*$/, "");
  const K_BERKAS = "blangkoDerryBerkas";
  const K_TTD = "blangkoDerryTtd";
  const K_CETAK = "blangkoDerryCetak";
  const UMUR_BERKAS_MS = 24 * 60 * 60 * 1000;
  const BATAS_LAMA_MS = 150000;
  const NAMA_JENIS = { put: "Putusan", bas: "Berita acara sidang", rel: "Relaas", ptsp: "PTSP" };
  const PERAN_JENIS = { hakim: "put", pp: "bas", js: "rel" };
  const JENIS_PERAN = { put: "hakim", bas: "pp", rel: "js", ptsp: "ptsp" };
  const NAMA_PERAN = { hakim: "Hakim", pp: "Panitera Pengganti", js: "Juru sita", ptsp: "petugas yang berhak atas folder PTSP di ABT" };
  /** Kelompok BAS yang paling sering dipakai (abt-bas-alur-sidang/hasil/alur-frekuensi, perkara 2024-2026). */
  const FREK_ALUR = { "02": 2494, "01": 404, "03": 389, "08": 205 };
  const PIL_METERAI = ["bermeterai cukup dan dinazegelen", "bermeterai cukup tetapi tidak dinazegelen", "tidak bermeterai dan tidak dinazegelen", "tanpa kalimat meterai"];
  // Nilai 0-2 tetap (baris tersimpan memakai nomor ini); 3-4 tambahan 16 Okt dari putusan PA Donggala.
  const PIL_COCOK = ["telah dicocokkan dengan aslinya dan ternyata sesuai", "tidak dapat dicocokkan dengan aslinya", "dicocokkan dari fotokopinya", "dicocokkan dengan kopian sebelumnya dan ternyata sesuai", "tanpa kalimat pencocokan"];
  const BUKTI_CEPAT = [
    ["Fotokopi Kartu Keluarga", "Dinas Kependudukan dan Pencatatan Sipil"],
    ["Surat Keterangan Domisili", "Kepala Desa"],
    ["Surat Keterangan Ghaib", "Kepala Desa"],
  ];
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const CP1252_TAMBAHAN = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu kecil
  // ──────────────────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cari = (s, akar) => (akar || document).querySelector(s);
  const cariSemua = (s, akar) => Array.from((akar || document).querySelectorAll(s));
  const jamSekarang = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const tglIndo = (iso) => {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : String(iso || "");
  };
  /** "15 Oktober 2026", "15/10/2026", "2026-10-15" -> ISO; "" bila tidak terbaca. */
  function keIso(teks) {
    const t = String(teks || "").trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
    if (m) {
      const b = BULAN.findIndex((x) => x.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)));
      if (b >= 0) return `${m[3]}-${String(b + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    return "";
  }
  const nomorPendek = (n) => String(n || "").replace(/\/PA\.[A-Za-z]+$/, "");
  const potong = (t, n) => (String(t || "").length > n ? `${String(t).slice(0, n - 1)}…` : String(t || ""));
  const gelar = /\b(drs|dra|dr|h|hj|s\.?h\.?i?|m\.?h|m\.?a|s\.?ag|s\.?sy|s\.?e|s\.?t|ir|lc|m\.?si|m\.?kn|s\.?pd\.?i|bin|binti)\b\.?/gi;
  const namaInti = (n) =>
    String(n || "")
      .replace(/\s*\(Ketua\)/gi, "")
      .toLowerCase()
      .replace(gelar, " ")
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const namaSama = (a, b) => {
    const x = namaInti(a);
    const y = namaInti(b);
    return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
  };
  /** Nama majelis "A (Ketua), B, C" -> [A, B, C] (gelar berkoma menempel pada nama sebelumnya). */
  function pecahNama(teks) {
    const GEL = new Set(["drs", "dra", "dr", "h", "hj", "sh", "shi", "si", "mh", "ma", "mag", "ag", "se", "st", "ir", "lc", "msi", "mkn", "spdi", "sag", "ssy", "bin", "binti"]);
    const hasil = [];
    for (const p of String(teks || "").split(",")) {
      const isi = p.trim();
      if (!isi) continue;
      const kata = isi.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((k) => k.length > 2 && !GEL.has(k));
      if (kata.length === 0 && hasil.length) hasil[hasil.length - 1] += `, ${isi}`;
      else hasil.push(isi);
    }
    return hasil.map((n) => n.replace(/\s*\(Ketua\)\s*/i, "").trim());
  }
  /** Huruf yang tidak dapat disimpan kolom latin1 (cp1252) ABT. */
  function hurufDiLuarAbt(teks) {
    const luar = [];
    for (const ch of String(teks || "")) {
      const kode = ch.codePointAt(0);
      if (kode <= 0xff || CP1252_TAMBAHAN.includes(ch)) continue;
      if (!luar.includes(ch)) luar.push(ch);
    }
    return luar;
  }
  /**
   * Bentuk aman untuk ABT (kolom latin1/cp1252, naskah dicetak per byte): tanda baca "cantik" cp1252 – — … “ ” ‘ „ ‚ •
   * (byte 0x80-0x9F) tercetak rusak (mis. "â€“"), jadi diganti ke ASCII sebelum disimpan. ’ SENGAJA dibiarkan:
   * ABT sendiri mengembalikannya ke ' saat mencetak (lihat abtKlienNetralkanPetik). Mengembalikan { teks, diganti }.
   */
  const GANTI_ABT = { "–": "-", "—": "-", "…": "...", "“": '"', "”": '"', "„": '"', "‘": "'", "‚": "'", "•": "-" };
  function normalAbt(teks) {
    const diganti = [];
    const t = String(teks == null ? "" : teks).replace(/[–—…“”„‘‚•]/g, (m) => {
      if (!diganti.includes(m)) diganti.push(m);
      return GANTI_ABT[m];
    });
    return { teks: t, diganti };
  }
  /**
   * Byte -> teks BINER (satu kode per byte, ISO-8859-1 sungguhan). TextDecoder("latin1") TIDAK dipakai: menurut standar
   * peramban label itu windows-1252, jadi byte 0x80-0x9F menjadi “ ” – … (kode > 0xFF) dan bufDariLatin1 (& 0xFF)
   * merusaknya sebelum RTF dikirim ke pengubah PDF. Untuk membaca RTF sebagai teks tampilan: rtfTeks.
   */
  const latin1 = (buf) => {
    if (typeof buf === "string") return buf;
    const u = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return s;
  };
  const rtfTeks = (buf) => (typeof buf === "string" ? buf : new TextDecoder("windows-1252").decode(new Uint8Array(buf)));
  const bufDariLatin1 = (s) => {
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) u[i] = s.charCodeAt(i) & 0xff;
    return u.buffer;
  };
  function base64DariBuffer(buffer) {
    const byte = new Uint8Array(buffer);
    let biner = "";
    for (let i = 0; i < byte.length; i += 0x8000) biner += String.fromCharCode.apply(null, byte.subarray(i, i + 0x8000));
    return btoa(biner);
  }
  const blobKeData = (blob) =>
    new Promise((selesai, gagal) => {
      const r = new FileReader();
      r.onload = () => selesai(String(r.result));
      r.onerror = () => gagal(new Error("berkas tidak terbaca"));
      r.readAsDataURL(blob);
    });

  async function bacaPenyimpanan(kunci) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return {};
      return (await chrome.storage.local.get(kunci)) || {};
    } catch {
      return {};
    }
  }
  function tulisPenyimpanan(isi) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return Promise.resolve(false);
      return Promise.resolve(chrome.storage.local.set(isi)).then(() => true, () => false);
    } catch {
      return Promise.resolve(false);
    }
  }
  /** Pesan ke pekerja latar; tanpa jawaban dalam 20 detik dianggap tidak dijawab (jatuh ke cara biasa). */
  function kirimLatar(pesan) {
    return new Promise((selesai) => {
      const jam = setTimeout(() => selesai(null), 20000);
      try {
        chrome.runtime.sendMessage({ sumber: "aleta-panel", ...pesan }, (h) => {
          void chrome.runtime.lastError;
          clearTimeout(jam);
          selesai(h || null);
        });
      } catch {
        clearTimeout(jam);
        selesai(null);
      }
    });
  }

  /** Permintaan ke portal ALETA (JSON). alatAmbil (panel-alat.js) bila ada - memakai batas waktu & pesan baku. */
  async function ambilPortal(alamat, opsi, yang) {
    // Tes putusan: ke portal hanya membaca, ditambah tiga permintaan yang cuma MENGHITUNG (usulan jawaban saksi, pengubah PDF, naskah tes) - tidak menyimpan apa pun.
    if (tes() && String((opsi && opsi.method) || "GET").toUpperCase() !== "GET" && alamat !== API_USULAN && alamat !== API_PDF && alamat !== API_TES_NASKAH) throw new Error(PESAN_TES);
    const o = { credentials: "include", cache: "no-store", ...(opsi || {}) };
    const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, o, yang) : await fetch(alamat, o);
    const luar = await r.json().catch(() => null);
    if (!r.ok || !luar || luar.ok === false) {
      const sebab = (luar && (luar.alasan || luar.sebab || (luar.error && luar.error.message))) || `${yang} gagal (kode ${r.status}).`;
      const e = new Error(String(sebab));
      e.status = r.status;
      throw e;
    }
    return luar.data !== undefined ? luar.data : luar;
  }

  /** Nama baku unduhan: "<nomor, / jadi _> - <nama blangko>.<ekstensi>" (sama dengan alatNamaUnduhanBlangko). */
  function namaUnduhan(nomorPerkara, berkas, akhiran) {
    const n0 = namaUnduhanDasar(nomorPerkara, berkas, akhiran);
    // Tes putusan: tiap unduhan berakhiran -TES supaya tak tertukar dengan dokumen sungguhan.
    return tes() && n0 ? n0.replace(/(\.[A-Za-z0-9]+)?$/, "-TES$1") : n0;
  }
  function namaUnduhanDasar(nomorPerkara, berkas, akhiran) {
    if (typeof alatNamaUnduhanBlangko === "function") {
      const n = alatNamaUnduhanBlangko(nomorPerkara, berkas, akhiran);
      if (n) return n;
    }
    const bersih = (s) => String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim();
    const nomor = bersih(nomorPerkara);
    const batang = bersih(String(berkas || "").replace(/\.(rtf|docx?|pdf)$/i, "")).replace(/[. ]+$/, "");
    const dasar = [nomor, batang].filter(Boolean).join(" - ");
    return dasar ? `${dasar}.${String(akhiran || "rtf").replace(/^\./, "")}` : "";
  }

  /**
   * SEMUA unduhan panel Blangko Derry (RTF, PDF, PDF SALINAN, PDF anonim, cetak massal, berkas perkara) diterbitkan pekerja latar lewat
   * chrome.downloads dengan data: URL (asal chrome-extension://, tepercaya). TIDAK ADA lagi cadangan <a download> blob dari halaman http
   * ABT/SIPP: Chrome menahannya sebagai "Insecure download blocked". Pekerja latar yang belum menjawab dicoba sekali lagi; sesudah itu
   * pulang { ok: false, pesan } supaya petugas mengulang, bukan mendapat unduhan yang diblokir.
   */
  async function unduh(blob, nama) {
    let sebab = "pekerja latar tidak menjawab";
    for (let coba = 0; coba < 2; coba += 1) {
      try {
        const alamat = await blobKeData(blob);
        const jawab = await kirimLatar({ jenis: "unduh", nama, alamat });
        if (jawab && jawab.ok) return { ok: true, lewat: "ekstensi" };
        if (jawab) return { ok: false, pesan: `unduhan lewat ekstensi gagal: ${jawab.pesan || "ditolak peramban"}` };
      } catch (e) {
        sebab = String((e && e.message) || e);
      }
      if (coba === 0) await new Promise((selesai) => setTimeout(selesai, 600));
    }
    return { ok: false, pesan: `unduhan lewat ekstensi gagal: ${sebab}` };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan
  // ──────────────────────────────────────────────────────────────────────────
  const S = {
    api: null,
    terpasang: false,
    pk: null, // detail peristiwa aleta-bd-perkara: { nomorPerkara, perkaraId, jenisPerkara, sidang[], sidangKe, sidangDipilih, perkara }
    menu: null, // { kelompok: [{nama, a, jenis, berkas:[{berkas,a,b}]|null}], saat }
    memuatMenu: false,
    galatMenu: "",
    indeks: null, // folder Derry di server (portal)
    modal: null, // { jenis, kelompok, cari }
    blangko: null, // { berkas, kelompok, a, b, jenis, folder }
    hak: new Map(), // "berkas|kelompok|perkaraId" -> jawaban diizinkan (penolakan tidak disimpan)
    susunan: null,
    memuatSusunan: false,
    galatSusunan: "",
    nilai: {}, // kode -> { status, teks }
    isi: {}, // kode -> teks yang terlihat di layar (tersimpan atau diketik)
    diketik: new Set(), // kode yang benar-benar diketik petugas sejak terakhir disimpan (blur hanya menyimpan ini)
    tesIsian: {}, // Tes putusan: kode -> ketikan yang "seolah tersimpan" (HANYA di memori halaman; dikirim ke pratinjau, tidak pernah disimpan)
    ganti: {}, // kode -> huruf yang diganti ALETA ke bentuk aman ABT (normalAbt)
    tersimpan: {}, // kode -> "tersimpan" | "menyimpan" | "gagal: ..."
    saran: {}, // kode -> teks saran (bayangan)
    ketBuka: new Set(), // kode yang kutipan sumbernya terbuka
    ketRiwayat: {}, // kode -> { memuat, daftar } riwayat perubahan dari panel
    ketRiwayatBuka: new Set(),
    sematan: [], // kode yang disematkan (kunci abtVariabelSematan, sama dengan panel ABT)
    info: {}, // kode -> bahan lencana/kutipan/pilihan dari mesin bersama (isi-sipp-bersama.js rencanakan)
    bunyi: {}, // kode -> [{ keadaan, nilai }] pilihan bunyi (mis. 5227) - dipilih petugas
    bahanSaksi: null, // posita + keterangan dua saksi yang dibaca dari ABT untuk sumber saksi
    tautan: null, // 19 Okt: tautan dari Jadwal Sidang portal (peristiwa aleta-bd-tautan): jenis, agenda, keterangan, amar, saksi
    sorotan: null, // 19 Okt: kartu isian yang ditunjuk tautan Draf H-7 { kode, sampai, jam }: tersorot ±2 dtk walau digambar ulang
    dariSipp: new Set(), // kode yang diisi sendiri dari SIPP sejak blangko dibuka (status "terisi dari SIPP")
    janjiBukti: null, // janji pembacaan bukti (siapkanBukti) - isi otomatis menunggunya
    saranSipp: {}, // kode -> { nilai, keyakinan, asal }: bacaan SIPP/e-Court yang belum pasti (saran samar, tidak ditulis sendiri)
    isiSipp: { jalan: false, ulang: false, kunci: "", hasil: null }, // 19 Okt: isi otomatis dari SIPP
    el7: null, // ELITIGASI-7139: keputusan 1/2 yang diisi otomatis ke #7139# perkara ini
    el7Saran: null, // 19 Okt (isian 2): saran 1/2 bila belum cukup pasti untuk ditulis
    menuSaran: null,
    bukti: { P: null, T: null },
    buktiEl: { P: null, T: null }, // 27 Okt: butir alat bukti elektronik per pihak { butir[], nomori }; tersembunyi sampai dipilih
    buktiElBuka: {}, // pihak -> bagian alat bukti elektronik sedang dibuka
    buktiOto: {}, // G2: pihak ("P"/"T") -> { status: "ditulis"|"salin", pesan, teks }: keadaan penulisan otomatis daftar bukti dari e-Court
    tj: {}, // kunci -> { kode, rows:[{no,tanya,jawab}], templates:[], dimuat, berubah, sidang }
    tjBuka: null,
    tjSisi: true,
    tjRiw: { u: [], r: [] },
    konfirmPulih: null, // C1: { kode, idx, sampai } - konfirmasi dua langkah mengembalikan catatan server
    tjMenu: false, // 19 Okt (tahap 2): menu "Lainnya" tanya jawab saksi terbuka
    tjLipat: false, // 19 Okt (tahap 2): lipatan "Lihat keterangan saksi" (putusan / peran hakim, hanya baca) terbuka
    tjTujuan: null, // 19 Okt (tahap 2): { kunci, i, aksi: "tukar"|"salin" } - memilih saksi tujuan bila saksinya lebih dari dua
    // Jawaban saksi otomatis & pilihan pengetahuan saksi (blangko-derry-saksi.js): pil = kunci saksi -> {modus, sumber, alasan[]}.
    // alasanPosita: alasan yang terbaca dari posita perkara ini (centang "sebagian"); lainBuka: kunci saksi -> "Alasan lain" terbuka.
    sk: { pil: {}, perkara: "", alasan: null, alasanPosita: { perkara: "", keadaan: "", sesuai: null }, lainBuka: {}, status: {}, tertahan: {}, konfirmasi: {}, sig: {}, rantai: Promise.resolve(), tinjau: null },
    tambahanBuka: false, // 20 Okt: bagian "Isian tambahan (bila ada)" terbuka
    semua: null, // "Lihat semua isi data"
    semuaBuka: false,
    prat: { terbuka: false, memuat: false, rtf: null, html: "", galat: "", suntingPenuh: false, kotor: true, penanda: [] },
    versiIsian: 0, // naik tiap isian/tanya jawab tersimpan atau berganti sidang: naskah yang disusun pada versi lama tidak dipakai (cetak cepat)
    fmt: { rtf: true, pdf: false, salinan: false, anon: false, edoc: false },
    // 28 Okt: putusan yang disunting sendiri oleh hakim - { untuk: nomor perkara, nama, bentukAsal, rtf: ArrayBuffer (RTF), catatan: [] }.
    // Bila ada, Cetak memakainya (bukan naskah ABT); seluruh pilihan cetak berlaku atasnya. Tidak disimpan ke mana pun.
    unggahan: null,
    unggahSibuk: false,
    ttdPilih: new Set(),
    ttdManual: false, // pengguna sudah mengubah centang tanda tangan pada blangko ini -> tidak dicentang otomatis lagi
    ttdSumber: null, // { aleta: [{id,nama}]|null, sendiri: {nama,png}|null }
    peringat: false,
    sibuk: false,
    tampilTakBerlaku: false, // "tampilkan juga" isian yang keadaannya tidak berlaku
    jabatan: {}, // 21 Okt: "perkaraId|pemicu" -> true = hakim menetapkan tuntutan itu karena jabatan (ex officio)
    lanjutanBuka: false, // bagian "Isian di dalam bagian otomatis" terbuka
    tuntutanBuka: false, // bagian "Tuntutan yang tidak diminta" terbuka
    tandaKosong: new Set(), // kode isian yang ditandai kuning saat Cetak menemukan isian kosong
    log: [],
    cetakTercatat: {}, // "nomor|jenis" -> jam
  };
  const wadah = {};
  let klien = null;
  let rekomendasiLuar = null; // fungsi dari agen Tahap E: ({perkara, sidang, sidangKe, jenis, peran}) -> [{berkas, kelompok?, alasan}]

  const api = () => S.api;
  const toast = (t) => {
    const a = api();
    if (a && typeof a.toast === "function") a.toast(t);
  };
  /**
   * 22 Okt 2026 - TES PUTUSAN (hanya Super Admin; kerangka blangko-derry.js yang memutuskan). Perkara yang dipilih menjadi ACUAN data,
   * blangko apa pun boleh dibuka, dan TIDAK ADA yang ditulis ke ABT, SIPP, atau e-Court: isian/usulan otomatis, simpan tangan, tanya jawab,
   * perapian posita, sunting pratinjau, unggah e-Doc, anonimisasi lewat ABT, cetak massal, dan catatan cetak semuanya mati. Yang tersisa
   * hanya membaca, pratinjau, dan mengunduh (nama berakhiran -TES). Pengaman berlapis: bolehTulis() mati, jalur tulis kembali lebih dulu,
   * dan klien ABT menolak setiap permintaan tulis (lihat klienAbt).
   * KETIKAN petugas di kotak isian tetap boleh (22 Okt malam): dicatat HANYA di memori halaman (S.tesIsian) lalu dikirim sebagai badan
   * permintaan POST tes-naskah, tempat ALETA menyusun naskah dari data perkara acuan dan menimpakan ketikan seolah tersimpan di ABT
   * (lihat cetakTes / catatKetikanTes). Pratinjau tes TIDAK memanggil abt/preview; satu-satunya POST yang lolos hanya MENGHITUNG.
   */
  const tes = () => {
    const a = api();
    return Boolean(a && typeof a.tesPutusan === "function" && a.tesPutusan());
  };
  const PESAN_TES = "Mode Tes putusan: perkara ini hanya acuan, tidak ada yang disimpan ke ABT, SIPP, atau e-Court.";
  /** Kalimat sebab "tidak boleh menulis" yang benar: karena Tes putusan, atau karena peran akun. */
  const sebabTakTulis = (bawaan) => (tes() ? PESAN_TES : bawaan);
  /** Pita penanda Tes putusan di pratinjau, cetak, dan jendela pilih blangko. */
  const infoNaskahTes = () => {
    const t = S.prat && S.prat.tes;
    if (!t) return "";
    return ` Naskah dihitung dari data perkara acuan${t.ketikan ? ` dan ${t.ketikan} isian yang Anda ketik` : ""}; ${t.kosong ? `${t.kosong} bagian belum punya data dan ditandai "..." berlatar kuning` : "semua bagian punya data"}.${t.galat ? " Sebagian data tidak terbaca; periksa sambungan ke SIPP." : ""}`;
  };
  const pitaTes = () => (tes() ? `<div class="bd-pitates kecil" role="status"><b>TES PUTUSAN</b> · perkara acuan <b>${esc(nomorPerkara() || "-")}</b> · hanya contoh; tidak disimpan ke ABT, SIPP, atau e-Court. Unduhan berakhiran -TES.${esc(infoNaskahTes())}</div>` : "");
  const cfg = () => {
    const a = api();
    return a && typeof a.setelan === "function" ? a.setelan() : { saran: true, ingat: true, isiOto: true };
  };
  const adm = () => {
    const a = api();
    return Boolean(a && typeof a.adm === "function" && a.adm());
  };
  /** Peran dokumen akun ini (dari kerangka): hakim/pp/js; admin = semuanya (atau akun yang dilihat). */
  const peranAkun = () => {
    const a = api();
    const p = a && typeof a.peranDokumen === "function" ? a.peranDokumen() : [];
    return Array.isArray(p) ? p : [];
  };
  /**
   * 22 Okt 2026: Super Admin/Admin yang belum memilih "Lihat sebagai" (Semua akun) belum punya peran: saran blangko di langkah 2 tidak
   * ditampilkan (peran menentukan jenis dokumennya). Saran tetap muncul di jendela Pilih blangko, mengikuti tab yang aktif.
   */
  const semuaAkun = () => {
    if (!adm()) return false;
    const a = api();
    const kd = a && typeof a.keadaan === "function" ? a.keadaan() : null;
    return !(kd && kd.sebagai && kd.sebagai.peran);
  };
  /**
   * Jenis dokumen yang boleh dibuka & ditulis (16 Okt malam): dari kerangka - Super Admin/Admin tanpa
   * "Lihat sebagai" semuanya; akun yang ditiru dan akun biasa hanya jenis perannya + saklar Pengaturan SIPP & ABT.
   */
  const jenisPeran = () => {
    const a = api();
    if (a && typeof a.jenisDokumen === "function") return a.jenisDokumen();
    return adm() ? ["put", "bas", "rel"] : peranAkun().map((p) => PERAN_JENIS[p]).filter(Boolean);
  };
  // 99 PTSP (17 Okt): bukan dokumen satu peran - tabnya ada bila menu ABT memuat folder PTSP yang boleh dibuka
  // akun ini (hak menu ABT, lihat kelompokBoleh di blangko-derry.js).
  const jenisBoleh = () => {
    const dasar = jenisPeran();
    const adaPtsp = Boolean(S.menu && S.menu.kelompok && S.menu.kelompok.some((k) => k.jenis === "ptsp" && kelompokBoleh(k)));
    return adaPtsp && !dasar.includes("ptsp") ? [...dasar, "ptsp"] : dasar;
  };
  /** Kelompok menu Derry { nama, jenis } boleh tampil/dibuka/ditulis untuk akun (atau akun yang ditiru) ini? */
  const kelompokBoleh = (k) => {
    const a = api();
    if (a && typeof a.kelompokBoleh === "function") return a.kelompokBoleh(k);
    return Boolean(k) && (k.jenis === "ptsp" || jenisPeran().includes(k.jenis));
  };
  /** Boleh MENULIS untuk blangko ini? Hanya bila kelompoknya boleh untuk akun (atau akun yang ditiru) ini. */
  const bolehTulis = () => !tes() && Boolean(S.blangko) && kelompokBoleh({ nama: S.blangko.kelompok, jenis: S.blangko.jenis, ikrar: adalahBlangkoIkrar(S.blangko.jenis, S.blangko.berkas) });

  function asalAbtDerry() {
    if (typeof asalAbt === "function") return asalAbt();
    const cocok = String(location.pathname || "").match(/^(.*?\/abt)\//);
    return cocok ? `${location.origin}${cocok[1]}` : `${location.origin}/aps_badilag/abt`;
  }
  /**
   * Tes putusan: hanya BACA yang lewat ke ABT. GET selalu; POST hanya pencarian nomor perkara (get_nomor_perkara*) dan pengisian
   * blangko tanya jawab TANPA menyimpan (load_template). Selain itu - simpan isian, simpan tanya jawab, simpan templat, validasi BAS,
   * anonimisasi (menulis berkas sementara di ABT), main/cari - ditolak di sini, apa pun yang memanggilnya.
   */
  function permintaanAbtAman(alamat, opsi) {
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    if (cara === "GET" || cara === "HEAD") return true;
    const jalur = String(alamat || "").split("?")[0];
    if (/\/get_nomor_perkara(?:_putus)?$/.test(jalur)) return true;
    if (/\/tanyajawab_perkara_edit$/.test(jalur) && !/[?&]aksi=simpan\b/.test(String(alamat)) && /(?:^|&)load_template=/.test(String((opsi && opsi.body) || ""))) return true;
    return false;
  }
  function klienAbt() {
    if (klien) return klien;
    if (typeof abtKlienBuat !== "function") throw new Error("abt-klien.js belum termuat.");
    klien = abtKlienBuat({
      ambil: (u, i) => {
        if (tes() && !permintaanAbtAman(u, i)) return Promise.reject(new Error(PESAN_TES));
        return fetch(u, i);
      },
      asal: asalAbtDerry(),
      jeda: typeof a2JedaTulis === "function" ? a2JedaTulis : undefined,
    });
    return klien;
  }
  const perkaraId = () => (S.pk && S.pk.perkaraId ? String(S.pk.perkaraId) : "");
  const nomorPerkara = () => (S.pk && S.pk.nomorPerkara) || "";

  // ───────────────────────────────────────────────────────
  // Sampul Berkas Perkara & Daftar Isi Berkas (26 Okt 2026): layar kerja khusus bila saklar "berkas-perkara-khusus" menyala
  // ───────────────────────────────────────────────────────
  const BK = () => globalThis.AletaBerkasKhusus || null;
  /** "sampul" | "daftar-isi" bila berkas itu layar khusus DAN saklarnya menyala (mati/gagal bertanya/Tes putusan = blangko biasa). */
  async function berkasKhususSiap(berkas) {
    const bk = BK();
    if (!bk || tes()) return "";
    const jenis = bk.jenisLayar(berkas);
    if (!jenis) return "";
    const sf = globalThis.AletaSaklarFitur;
    try {
      return sf && (await sf.aktif(bk.KODE_SAKLAR)) === true ? jenis : "";
    } catch {
      return "";
    }
  }
  function hostBerkas() {
    return {
      ambilPortal,
      unduh,
      pdfDari,
      namaUnduhan,
      rtfKeHtml: (rtf) => rtfKeHtml(rtf, null),
      toast,
      bacaPenyimpanan,
      tulisPenyimpanan,
      sebagaiPeran: () => {
        const a = api();
        const kd = a && typeof a.keadaan === "function" ? a.keadaan() : null;
        return !tes() && adm() && kd && kd.sebagai && kd.sebagai.nama && kd.sebagai.peran ? String(kd.sebagai.peran) : "";
      },
    };
  }
  /** Urutan sidang ABT (d): urutan SIPP bila ada, bila tidak nomor urut daftar. */
  const sidangUrutan = () => {
    if (!S.pk) return "";
    // Cetak massal relaas: urutan sidang yang DIPANGGIL ditetapkan dokumennya (pemberitahuan putusan = 0 = tanpa d), bukan indeks daftar.
    if (S.pk.urutanPaksa !== undefined) return Number(S.pk.urutanPaksa) > 0 ? String(Number(S.pk.urutanPaksa)) : "";
    const s = S.pk.sidangDipilih;
    if (s && Number(s.urutan) > 0) return String(s.urutan);
    return String((Number(S.pk.sidangKe) || 0) + 1);
  };
  /** Katalog jenis perkara untuk tanya jawab saksi (blangko-derry-katalog.js); null bila belum termuat. */
  const KT = () => (typeof globalThis !== "undefined" && globalThis.AletaBdKatalog) || null;
  const sebutan = () => {
    // 20 Okt: sebutan menurut NOMOR alur/jenis perkara (satu sumber dengan portal), bukan menurut kata.
    if (KT() && S.pk) {
      const sb = KT().sebutanPihak(ktPerkaraObj());
      return { P: sb.P, T: sb.T };
    }
    const j = String((S.pk && S.pk.jenisPerkara) || "").toLowerCase();
    const permohonan = /pdt\.p/i.test(nomorPerkara()) || /cerai talak|permohonan|itsbat|dispensasi|perwalian|asal usul|ahli waris|poligami|pengangkatan/.test(j);
    return permohonan ? { P: "Pemohon", T: "Termohon" } : { P: "Penggugat", T: "Tergugat" };
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Menu Derry di ABT: kelompok + berkas + token a/b
  // ──────────────────────────────────────────────────────────────────────────
  function jenisKelompok(nama) {
    const n = String(nama || "").trim();
    if (/^relaas/i.test(n)) return "rel";
    if (/ptsp/i.test(n)) return "ptsp";
    if (/^bas\b|^alur\s*\d|\bbas\b/i.test(n)) return "bas";
    return "put";
  }
  const alurDari = (nama) => {
    const m = String(nama || "").match(/alur\s*(\d\d)/i);
    return m ? m[1] : "";
  };
  function urutKelompok(a, b) {
    const fa = FREK_ALUR[alurDari(a.nama)] || 0;
    const fb = FREK_ALUR[alurDari(b.nama)] || 0;
    if (fa !== fb) return fb - fa;
    return a.urut - b.urut;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Kelompok maya "Ikrar Talak" (19 Okt 2026)
  // ──────────────────────────────────────────────────────────────────────────
  // Blangko ikrar talak ada tetapi tersebar di tiga folder: berita acara sidang ikrar (menu "Cerai Talak - BAS"), penetapan ikrar dan
  // penetapan putusan gugur (menu "Cerai Talak - Putusan"), serta relaas/amplop panggilan ikrar (menu Relaas). Kelompok maya ini hanya
  // MENYAJIKAN ulang butir-butir itu dalam satu daftar: tidak ada berkas ABT yang dipindah, digandakan, atau dibuat. Butir dikenali dari
  // namanya, diambil dari kelompok aslinya (nama kelompok asli tetap dipakai membuka, memeriksa hak, dan mencetak).
  const NAMA_IKRAR = "Ikrar Talak";
  const POLA_IKRAR = Object.freeze({
    put: /^\s*\[[^\]]+\]\s*\[ikrar(?:\s+gugur)?\]/i,
    bas: /\bBAS\s+Ikrar\s+Talak\b/i,
    rel: /ikrar\s+talak/i,
  });
  const URUT_JENIS_IKRAR = Object.freeze({ bas: 0, put: 1, rel: 2 });
  const NAMA_JENIS_IKRAR = Object.freeze({ bas: "Berita acara sidang", put: "Penetapan", rel: "Relaas" });
  /** Blangko ini termasuk ikrar talak? (jenis = jenis kelompok aslinya: put | bas | rel) */
  const adalahBlangkoIkrar = (jenis, berkas) => Boolean(POLA_IKRAR[jenis] && POLA_IKRAR[jenis].test(String(berkas || "")));
  const menuCeraiTalak = (k) => /cerai\s*talak|\bCT\b/i.test(`${namaMenuTampil(k.nama)} ${k.nama}`);
  /** Kelompok yang layak dibaca untuk mencari butir ikrar: menu cerai talak, menu ikrar, alur 10, dan semua menu relaas. */
  const penghuniIkrar = (k) => Boolean(k) && k.jenis !== "ptsp" && (k.jenis === "rel" || menuCeraiTalak(k) || /ikrar|alur\s*10/i.test(`${namaMenuTampil(k.nama)} ${k.nama}`));
  /** "P Hadir & T Tidak Hadir" -> "Pemohon hadir dan Termohon tidak hadir" (kalimat biasa, tanpa kode). */
  function kalimatKehadiranIkrar(sisa) {
    let t = String(sisa || "").replace(/\.rtf$/i, "").trim();
    const tunda = t.match(/,?\s*Tunda\s+Tenggang\s+Waktu\s+(\d+)\s*Bulan/i);
    t = t.replace(/,?\s*Tunda\s+Tenggang\s+Waktu\s+\d+\s*Bulan/i, "");
    const beban = /,?\s*Ada\s+Beban/i.test(t);
    t = t.replace(/,?\s*Ada\s+Beban/i, "");
    t = t
      .replace(/\bP\b/g, "Pemohon")
      .replace(/\bT\b/g, "Termohon")
      .replace(/\s*&\s*/g, " dan ")
      .replace(/\bTidak Hadir\b/gi, "tidak hadir")
      .replace(/\bHadir\b/g, "hadir")
      .replace(/\s+/g, " ")
      .trim();
    return `${t}${beban ? ", ada beban yang harus dipenuhi" : ""}${tunda ? `; sidang ditunda, tenggang waktu ${tunda[1]} bulan` : ""}`;
  }
  /**
   * Uraian satu blangko ikrar dalam kalimat biasa: { jenis (nama jenis), kalimat, kode, urut }. Murni (diuji).
   * jenis = jenis kelompok aslinya (put | bas | rel).
   */
  function uraikanIkrar(jenis, berkas) {
    const nama = String(berkas || "").replace(/\.rtf$/i, "").trim();
    let kalimat = "";
    if (jenis === "bas") {
      kalimat = `Berita acara sidang ikrar talak: ${kalimatKehadiranIkrar(nama.replace(/^.*?Ikrar\s+Talak\s*-\s*/i, ""))}`;
    } else if (jenis === "put") {
      kalimat = /gugur/i.test(nama)
        ? "Penetapan putusan gugur: Pemohon tidak mengikrarkan talak dalam 6 bulan"
        : `Penetapan sidang ikrar talak: ${kalimatKehadiranIkrar(nama.replace(/^.*?Penetapan\s+Ikrar\s+Talak\s*-\s*/i, ""))}`;
    } else {
      const sisa = nama.replace(/^.*?Ikrar\s+Talak/i, "");
      const ec = /e-?court/i.test(sisa);
      const pihak = /\bP\s+dan\s+T\b/i.test(sisa) ? "Pemohon dan Termohon" : /\bP\b/.test(sisa) ? "Pemohon" : /\bT\b/.test(sisa) || ec ? "Termohon" : "";
      const amplop = /amplop/i.test(nama);
      kalimat = `${amplop ? "Amplop panggilan sidang ikrar talak" : "Relaas panggilan sidang ikrar talak"}${pihak ? (amplop ? " untuk " : " kepada ") + pihak : ""}${ec ? " (perkara e-Court)" : ""}`;
    }
    const m = nama.match(/\[(\d+)([a-z]?)\]/i) || nama.match(/\]\s*(\d+(?:\.\d+)*)\.?\s/);
    const angka = m ? parseFloat(m[1]) || 0 : 0;
    const huruf = m && m[2] ? m[2] : "";
    return { jenis: NAMA_JENIS_IKRAR[jenis] || "", kalimat, kode: m ? `${m[1]}${huruf}` : kodeDari(nama), urut: (URUT_JENIS_IKRAR[jenis] === undefined ? 9 : URUT_JENIS_IKRAR[jenis]) * 1000 + angka * 10 + (huruf ? 5 : 0) };
  }
  /**
   * Butir ikrar dari kelompok-kelompok yang SUDAH termuat dan boleh dibuka akun ini (hak folder asal). Murni terhadap masukannya (diuji):
   *   kelompok: [{ nama, jenis, berkas: [{berkas,a,b}]|null, galat?, memuat? }], boleh: (k) => boolean.
   * Hasil: { berkas: [{ berkas, a, b, kelompok, jenis, jenisNama, kalimat, kode, urut }], memuat }.
   * Butir bernama sama di dua kelompok diambil sekali - dari kelompok menu cerai talak lebih dulu.
   */
  function kumpulkanIkrar(kelompok, boleh) {
    const calon = (Array.isArray(kelompok) ? kelompok : []).filter((k) => penghuniIkrar(k) && boleh({ ...k, ikrar: true }));
    calon.sort((x, y) => Number(menuCeraiTalak(y)) - Number(menuCeraiTalak(x)));
    const berkas = [];
    const lihat = new Set();
    let memuat = false;
    for (const k of calon) {
      if (!k.berkas) {
        if (!k.galat) memuat = true;
        continue;
      }
      for (const b of k.berkas) {
        if (!adalahBlangkoIkrar(k.jenis, b.berkas)) continue;
        const kunci = String(b.berkas).replace(/\.rtf$/i, "").trim().toLowerCase();
        if (lihat.has(kunci)) continue;
        lihat.add(kunci);
        const u = uraikanIkrar(k.jenis, b.berkas);
        berkas.push({ ...b, kelompok: k.nama, jenis: k.jenis, jenisNama: u.jenis, kalimat: u.kalimat, kode: u.kode, urut: u.urut });
      }
    }
    berkas.sort((x, y) => x.urut - y.urut || String(x.berkas).localeCompare(String(y.berkas)));
    return { berkas, memuat };
  }
  /** Memuat daftar berkas kelompok-kelompok yang mungkin memuat butir ikrar (tiga sekaligus). */
  async function muatKelompokIkrar() {
    if (!S.menu) return;
    const antre = S.menu.kelompok.filter((k) => penghuniIkrar(k) && kelompokBoleh({ ...k, ikrar: true }) && !k.berkas && !k.memuat);
    for (let i = 0; i < antre.length; i += 3) await Promise.all(antre.slice(i, i + 3).map((k) => muatBerkasKelompok(k)));
  }
  /**
   * Saran blangko sidang ikrar talak bila saran portal belum tiba (cadangan; aturan yang sama dengan rekomendasi-blangko.ts):
   *   hadir = sandi dihadiri_oleh (1 semua, 2 Pemohon saja, 3 Termohon saja, 4 tidak ada, null belum tercatat); teks = agenda + keterangan.
   * Hasil: [{ jenis: "bas"|"put", pola: RegExp nama berkas, utama }]. Pemohon tidak hadir = belum ada penetapan ikrar (BAS tunda 6 bulan);
   * penetapan gugur [91] hanya bila teks sidang menyebut gugur / 6 bulan / tidak mengikrarkan.
   */
  function saranIkrarCadangan(hadir, teks) {
    const hasil = [];
    const gugur = /gugur|6\s*bulan|enam\s+bulan|tidak\s+(?:meng)?ikrar/i.test(String(teks || ""));
    const h = Number(hadir) || null;
    if (gugur) hasil.push({ jenis: "put", pola: /^\[91\]/, utama: true });
    if (h === 3) hasil.push({ jenis: "bas", pola: /^\[3\]\s*BAS\s+Ikrar/i, utama: !gugur });
    else if (h === 4) hasil.push({ jenis: "bas", pola: /^\[4\]\s*BAS\s+Ikrar/i, utama: !gugur });
    else if (h === 1) {
      hasil.push({ jenis: "bas", pola: /^\[2\]\s*BAS\s+Ikrar/i, utama: !gugur }, { jenis: "bas", pola: /^\[2a\]\s*BAS\s+Ikrar/i, utama: false });
      hasil.push({ jenis: "put", pola: /^\[90a\]/, utama: !gugur });
    } else {
      hasil.push({ jenis: "bas", pola: /^\[1\]\s*BAS\s+Ikrar/i, utama: !gugur });
      hasil.push({ jenis: "put", pola: /^\[90\]\s/, utama: !gugur });
    }
    return hasil;
  }

  let janjiMenu = null;
  /** Menu Derry dari ABT; pemanggil yang datang saat pemuatan berjalan menunggu pemuatan yang sama. */
  function muatMenu(paksa) {
    if (janjiMenu) return janjiMenu;
    if (!paksa && S.menu && Date.now() - S.menu.saat < UMUR_BERKAS_MS) return Promise.resolve();
    janjiMenu = muatMenuInti(paksa).finally(() => {
      janjiMenu = null;
    });
    return janjiMenu;
  }
  async function muatMenuInti(paksa) {
    S.memuatMenu = true;
    S.galatMenu = "";
    try {
      if (!paksa && !S.menu) {
        const s = await bacaPenyimpanan(K_BERKAS);
        const lama = s[K_BERKAS];
        if (lama && lama.asal === asalAbtDerry() && Array.isArray(lama.kelompok) && Date.now() - lama.saat < UMUR_BERKAS_MS) {
          S.menu = { kelompok: lama.kelompok, saat: lama.saat };
        }
      }
      const h = await klienAbt().daftarMenu();
      if (!h.ok) throw new Error(h.pesan || "Menu ABT tidak terbaca.");
      const derry = h.menu.find((m) => /^\s*blangko\s+derry\b/i.test(m.nama));
      if (!derry) throw new Error("Grup Blangko Derry tidak ada di menu ABT akun ini.");
      const lamaPeta = new Map((S.menu ? S.menu.kelompok : []).map((k) => [k.nama, k]));
      // 27 Okt: daftar berkas simpanan (24 jam) hanya dipakai bila jumlahnya masih sama dengan "(N Blangko)" di menu ABT;
      // sesudah paket ABT menambah blangko (mis. Sampul di 99 PTSP), daftar dibaca ulang tanpa menunggu sehari.
      const berkasLama = (k) => {
        const lama = lamaPeta.get(k.nama);
        if (!lama || !Array.isArray(lama.berkas)) return null;
        return typeof k.jumlahBerkas === "number" && Number.isFinite(k.jumlahBerkas) && k.jumlahBerkas !== lama.berkas.length ? null : lama.berkas;
      };
      const kelompok = derry.kelompok.map((k, i) => ({
        nama: k.nama,
        a: k.a,
        jenis: jenisKelompok(k.nama),
        jumlah: k.jumlahBerkas,
        urut: i,
        berkas: berkasLama(k),
        // Judul kelompok (dari halaman kelompok) ikut bersama daftar berkasnya; tanpa ini menu yang dibaca ulang kehilangan judulnya.
        judul: berkasLama(k) && lamaPeta.get(k.nama) ? lamaPeta.get(k.nama).judul : undefined,
      }));
      S.menu = { kelompok, saat: Date.now() };
    } catch (e) {
      S.galatMenu = String((e && e.message) || e);
      if (!S.menu) S.menu = { kelompok: [], saat: 0 };
    }
    S.memuatMenu = false;
    renderModal();
    // Saran di langkah 2 bergantung pada menu: dimuat di latar (mis. oleh pengukur isian) = ringkasan ikut diperbarui.
    if (S.pk && !S.blangko) renderRingkasBlangko();
  }
  async function muatBerkasKelompok(k, paksa) {
    if (!k || (k.berkas && !paksa) || k.memuat) return k ? k.berkas : null;
    k.memuat = true;
    try {
      const h = await klienAbt().daftarBerkas(k.a);
      if (!h.ok) throw new Error(h.pesan || "Kelompok tidak terbaca.");
      k.berkas = h.berkas.map((b) => ({ berkas: b.berkas, a: b.a, b: b.b }));
      // 26 Okt 2026: sampul lengkap menjadi pilihan KEDUA (cetak awal bawaan di atas).
      k.berkas.sort((x, y) => Number(/^Sampul Berkas Perkara \(Lengkap\)/i.test(x.berkas)) - Number(/^Sampul Berkas Perkara \(Lengkap\)/i.test(y.berkas)));
      k.judul = namaMenuTampil(h.kelompok || k.nama);
      void tulisPenyimpanan({ [K_BERKAS]: { asal: asalAbtDerry(), saat: Date.now(), kelompok: S.menu.kelompok.map((x) => ({ nama: x.nama, berkas: x.berkas, judul: x.judul || "" })) } });
    } catch (e) {
      k.galat = String((e && e.message) || e);
    }
    k.memuat = false;
    renderModal();
    return k.berkas;
  }
  /** Memuat berkas kelompok yang belum termuat, tiga sekaligus (ABT satu per satu di mesin kecil). */
  async function muatSemuaKelompok(jenis) {
    if (!S.menu) return;
    const antre = S.menu.kelompok.filter((k) => (!jenis || k.jenis === jenis) && kelompokBoleh(k) && !k.berkas && !k.memuat);
    for (let i = 0; i < antre.length; i += 3) await Promise.all(antre.slice(i, i + 3).map((k) => muatBerkasKelompok(k)));
  }
  async function muatIndeks() {
    if (S.indeks) return S.indeks;
    try {
      S.indeks = await ambilPortal(`${API_BLANGKO}?indeks=1`, {}, "Membaca daftar folder blangko");
    } catch (e) {
      S.indeks = { ada: false, folder: [], sebab: String((e && e.message) || e) };
    }
    return S.indeks;
  }
  /** Folder Derry di server yang berkasnya paling cocok dengan kelompok ABT ini. */
  function folderUntuk(k) {
    if (!S.indeks || !S.indeks.ada || !k || !k.berkas) return "";
    const bersih = (s) => String(s || "").replace(/\.(rtf|docx?|odt)$/i, "").trim().toLowerCase();
    const diminta = new Set(k.berkas.map((b) => bersih(b.berkas)));
    let terbaik = null;
    for (const f of S.indeks.folder) {
      const ada = new Set((f.berkas || []).map(bersih));
      let cocok = 0;
      for (const b of diminta) if (ada.has(b)) cocok += 1;
      if (cocok > 0 && (!terbaik || cocok > terbaik.cocok)) terbaik = { nama: f.nama, cocok };
    }
    return terbaik ? terbaik.nama : "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Rekomendasi blangko (titik sambung agen Tahap E) + cadangan sederhana
  // ──────────────────────────────────────────────────────────────────────────
  function rekomendasiCadangan() {
    if (!S.pk || !S.menu) return [];
    const s = S.pk.sidangDipilih || {};
    const t = `${s.ket || ""} ${s.agenda || ""} ${petunjukTautan()}`.toLowerCase();
    const n = (Number(S.pk.sidangKe) || 0) + 1;
    const hasil = [];
    const cariBerkas = (jenis, pola) => {
      for (const k of S.menu.kelompok) {
        if (k.jenis !== jenis || !k.berkas) continue;
        const b = k.berkas.find((x) => pola.test(x.berkas));
        if (b) return { berkas: b.berkas, kelompok: k.nama, jenis };
      }
      return null;
    };
    const putusVerstek = /putus|dikabul|verstek/.test(t) && !/panggil/.test(t);
    // Sidang ikrar talak didahulukan: petunjuk tautan "penetapan" menambahkan kata "putus" yang bukan putusan akhir.
    if (/ikrar/.test(t) && /talak/i.test(String((S.pk && S.pk.jenisPerkara) || ""))) {
      for (const x of saranIkrarCadangan(s.hadir, t)) hasil.push(cariBerkas(x.jenis, x.pola));
    } else if (/tolak/.test(t) && /putus/.test(t)) hasil.push(cariBerkas("put", /^\[01ab\]/), cariBerkas("bas", n <= 2 ? /ALUR 02 \[2\]/ : /ALUR 03 \[3\]/));
    else if (putusVerstek) hasil.push(cariBerkas("put", /^\[01\] \[Kabul Verstek\] Cerai \(Format Lengkap\)\.?r?t?f?$/) || cariBerkas("put", /^\[01\]/), cariBerkas("bas", n === 1 ? /ALUR 01 \[1a\]/ : n === 2 ? /ALUR 02 \[2\]/ : /ALUR 03 \[3\]/), cariBerkas("rel", /Pemberitahuan Putusan T/));
    else if (/gugur/.test(t)) hasil.push(cariBerkas("put", /\[Gugur\] 3\./), cariBerkas("bas", /ALUR 07 \[3\]/));
    else if (/cabut/.test(t)) hasil.push(cariBerkas("put", /\[Cabut\] 1\./), cariBerkas("bas", n === 1 ? /ALUR 08 \[A\]/ : /ALUR 08 \[B\]/));
    else if (/mediasi/.test(t)) hasil.push(cariBerkas("bas", /ALUR 04 \[1\]/), cariBerkas("rel", /Panggilan Sidang T \(Sidang Lanjutan\)/));
    else if (/panggil|tunda|ghaib|alamat/.test(t)) hasil.push(cariBerkas("bas", n === 1 ? /ALUR 02 \[1\]/ : /ALUR 03 \[2\]/), cariBerkas("rel", n === 1 ? /Sidang Pertama T/ : /Sidang T \(Sidang Lanjutan\)/));
    else if (/pembuktian|saksi/.test(t)) hasil.push(cariBerkas("bas", /ALUR 04 \[6\]/));
    else if (/kesimpulan/.test(t)) hasil.push(cariBerkas("bas", /ALUR 04 \[8\]/));
    else if (/pertama/.test(t)) hasil.push(cariBerkas("bas", /ALUR 02 \[1\]/), cariBerkas("rel", /Sidang Pertama T/));
    return hasil.filter(Boolean).map((r) => ({ ...r, alasan: `dari keterangan sidang ke-${n}: "${potong((s.ket || s.agenda || "").trim(), 60)}"` }));
  }
  function rekomendasi() {
    if (!S.pk) return [];
    const ctx = { perkara: S.pk.perkara || null, nomorPerkara: nomorPerkara(), sidang: S.pk.sidang || [], sidangKe: S.pk.sidangKe, sidangDipilih: S.pk.sidangDipilih, peran: peranAkun(), jenis: jenisBoleh(), menu: S.menu ? S.menu.kelompok : [] };
    const a = api();
    const fn = rekomendasiLuar || (a && typeof a.rekomendasi === "function" ? a.rekomendasi : null);
    if (fn) {
      try {
        const h = fn(ctx);
        if (Array.isArray(h) && h.length) {
          return h
            .filter((x) => x && x.berkas)
            .map((x) => sesuaikanSaran({ berkas: String(x.berkas).replace(/\.rtf$/i, ""), kelompok: x.kelompok || "", jenis: x.jenis || jenisKelompok(x.kelompok || ""), alasan: x.alasan || "", saksi: Number(x.saksi) || 0 }));
        }
      } catch {
        /* rekomendasi luar gagal: cadangan di bawah */
      }
    }
    return rekomendasiCadangan().map(sesuaikanSaran);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Saran blangko menurut JENIS dan PERAN (19 Okt 2026)
  // ──────────────────────────────────────────────────────────────────────────
  // Saran hanya ditampilkan bila jenisnya cocok dengan yang sedang dipakai: blangko putusan -> saran putusan/penetapan, BAS -> BAS,
  // relaas -> relaas, PTSP -> PTSP. Tanpa blangko terpilih: jendela pilih blangko yang terbuka, lalu peran akun (hakim putusan dan
  // penetapan, panitera pengganti BAS, juru sita relaas); Super Admin/Admin mengikuti menu yang dibuka, atau putusan bila perkara sudah putus.
  const NAMA_SARAN_JENIS = { put: "putusan atau penetapan", bas: "berita acara sidang", rel: "relaas", ptsp: "PTSP" };
  function jenisSaranAktif() {
    selaraskanPeran();
    if (S.blangko && S.blangko.jenis) return S.blangko.jenis;
    if (S.modal && S.modal.jenis) return S.modal.jenis;
    const boleh = jenisBoleh();
    if (!boleh.length) return "";
    // 20 Okt: Super Admin/Admin yang "Lihat sebagai" SATU peran mengikuti peran itu (hakim -> putusan/penetapan, PP -> BAS); dulu ia jatuh ke
    // cabang admin di bawah dan memilih BAS bagi hakim begitu saklar "Hakim boleh membuka folder BAS" menyala. "Semua akun" tetap cabang admin.
    const peran = peranAkun();
    if (!adm() || peran.length === 1) {
      for (const p of peran) {
        const j = PERAN_JENIS[p];
        if (j && boleh.includes(j)) return j;
      }
      // 20 Okt: akun PTSP saja (tanpa peran hakim/PP/juru sita) mengikuti saran PTSP.
      if (!adm()) return boleh.find((j) => j !== "ptsp") || (boleh.includes("ptsp") ? "ptsp" : "");
    }
    const pk = S.pk && S.pk.perkara;
    if (boleh.includes("put") && pk && pk.sudahPutus) return "put";
    return boleh.includes("bas") ? "bas" : boleh[0];
  }
  /** Saran yang jenisnya cocok dan kelompoknya boleh dipakai akun (atau akun yang ditiru) ini. */
  function rekomendasiJenis(jenis) {
    if (!jenis) return [];
    return rekomendasi().filter((r) => r.jenis === jenis && !(S.menu && S.menu.kelompok.some((x) => x.nama === r.kelompok && !kelompokBoleh(x))));
  }
  /**
   * Alasan saran dalam kalimat biasa: dasar (agenda atau keterangan sidang) dipertahankan, istilah teknis (folder, alur, salinan, kode
   * berkas, katalog) dibuang. Murni (diuji).
   */
  function ramahkanAlasan(alasan) {
    let t = String(alasan || "").replace(/\s+/g, " ").trim();
    let dasar = "";
    const m = t.match(/^dari (agenda|keterangan) sidang(?: ke-\d+)?:\s*"([^"]*)"\s*(?:-\s*)?/i);
    if (m) {
      dasar = `${m[1].toLowerCase()} "${m[2].trim()}"`;
      t = t.slice(m[0].length);
    } else t = t.replace(/^dari keadaan perkara\s*(?:-\s*)?/i, "");
    const sebab = t
      .split(/(?<=[.;]\)?)\s+/)
      .map((x) =>
        x
          .replace(/[,:;]?\s*\bfolder\s+alur\s*\d+[a-z]*/gi, "") // "...: folder alur 01" -> bagian teknisnya dibuang, kalimatnya dipertahankan
          .replace(/\s+([.;)])/g, "$1")
          .replace(/^\((.*[.;])\)$/, "$1") // "(Putus di sidang pertama.)" -> tanpa kurung
          .trim()
      )
      .filter(Boolean)
      .filter((x) => !/folder|\balur\b|disalin|salinan|\.rtf|\[[0-9a-z]+\]|katalog|\bkode\b|\bpeta\b|tingkat/i.test(x))
      .join(" ")
      .replace(/[\s;,-]+$/, "")
      .trim();
    return [dasar, sebab].filter(Boolean).join(" - ");
  }
  /**
   * Varian "(N Saksi)" yang sesuai dengan banyaknya saksi: dua saksi atau kurang memakai blangko dasar; tiga sampai lima saksi memakai
   * varian yang namanya sama dengan N (atau yang terbesar yang masih ada); varian tidak ada -> blangko semula. Murni (diuji).
   * daftar: nama berkas satu kelompok.
   */
  function pilihVarianSaksi(berkas, daftar, jumlah) {
    const n = Number(jumlah) || 0;
    const bersih = (x) => String(x || "").replace(/\.rtf$/i, "").trim();
    const POLA = /\s*-?\s*\((\d)\s*Saksi\)\s*$/i;
    if (n <= 0 || !Array.isArray(daftar) || !daftar.length) return berkas;
    const dasar = bersih(berkas).replace(POLA, "");
    const varian = new Map();
    let ada = "";
    for (const nama of daftar.map(bersih)) {
      const cocok = nama.match(POLA);
      if (cocok && nama.replace(POLA, "") === dasar) varian.set(Number(cocok[1]), nama);
      else if (nama === dasar) ada = nama;
    }
    if (n <= 2) return ada || berkas;
    if (!varian.size) return berkas;
    const batas = Math.min(n, 5);
    const urut = [...varian.keys()].sort((a, b) => a - b);
    const pilih = urut.filter((k) => k <= batas).pop();
    return pilih ? varian.get(pilih) : ada || berkas;
  }
  // ──────────────────────────────────────────────────────────────────────────
  // Tautan dari Jadwal Sidang portal (19 Okt 2026): blangko dipilih sendiri oleh mesin saran
  // ──────────────────────────────────────────────────────────────────────────
  /** Tautan berlaku untuk sidang yang sedang dipilih? (tanggalnya sama, atau tautan tanpa tanggal) */
  function tautanBerlaku() {
    const t = S.tautan;
    if (!t || !S.pk) return null;
    const sd = S.pk.sidangDipilih;
    if (t.tanggalSidang && sd && String(sd.tanggal || "").slice(0, 10) !== t.tanggalSidang) return null;
    return t;
  }
  /** Petunjuk dari tautan untuk saran cadangan: keterangan, agenda, tunda, dan isyarat amar (bukan teks amar mentah). */
  function petunjukTautan() {
    const t = tautanBerlaku();
    if (!t) return "";
    const bagian = [t.keterangan, t.agenda];
    if (t.tunda) bagian.push("tunda");
    if (t.jenis === "putusan" || t.jenis === "penetapan") {
      bagian.push("putus");
      if (/mengabulkan|dikabulkan|kabul/i.test(t.amar)) bagian.push("dikabul");
      if (/menolak|ditolak/i.test(t.amar)) bagian.push("tolak");
      if (/gugur/i.test(t.amar)) bagian.push("gugur");
      if (/cabut|dicabut/i.test(t.amar)) bagian.push("cabut");
      if (t.verstek) bagian.push("verstek");
    }
    return bagian.filter(Boolean).join(" ");
  }
  /** Banyaknya saksi menurut tautan (verstek: hanya saksi Penggugat); 0 bila tidak ada. */
  function saksiTautan() {
    const t = tautanBerlaku();
    if (!t) return 0;
    return t.verstek ? t.jumlahSaksiP : t.jumlahSaksiP + t.jumlahSaksiT;
  }
  const jedaTautan = (ms) => new Promise((r) => setTimeout(r, ms));
  /**
   * Memilih blangko dari tautan: jenis yang diminta (putusan/penetapan = putusan, bas), hak akun diperiksa, saran portal ditunggu
   * (tanpa itu cadangan memakai petunjuk tautan), lalu saran jenis itu yang pertama dipilih (tetap dapat diganti). Tanpa saran yang pasti:
   * jendela pilih blangko terbuka pada jenis itu. Isi otomatis berjalan lewat pilihBlangko -> muatSusunan.
   */
  async function terapkanTautanBlangko() {
    const t = S.tautan;
    if (!t || t.dipakai || !S.pk) return;
    t.dipakai = true;
    const pk = S.pk;
    const a = api();
    try {
      if (a && typeof a.muatHak === "function") await Promise.resolve(a.muatHak()).catch(() => undefined);
      const jenis = { putusan: "put", penetapan: "put", bas: "bas" }[t.jenis] || jenisSaranAktif();
      if (!jenis) return;
      if (!jenisBoleh().includes(jenis)) {
        toast(`Akun Anda tidak berhak membuka blangko ${NAMA_SARAN_JENIS[jenis] || "jenis itu"}; pilih blangko yang sesuai dengan peran Anda.`);
        return;
      }
      await muatMenu();
      if (S.pk !== pk || S.blangko) return;
      rekomendasi(); // memicu pembacaan saran portal untuk sidang ini
      const kunci = kunciSidangSaran({ nomorPerkara: nomorPerkara(), sidangDipilih: pk.sidangDipilih });
      for (let i = 0; kunci && !rekomendasiLuar && i < 40; i += 1) {
        const c = rekPortal.get(kunci.kunci);
        if (c && c.status !== "memuat") break;
        await jedaTautan(150);
        if (S.pk !== pk || S.blangko) return;
      }
      let r = rekomendasiJenis(jenis)[0];
      if (!r) {
        // Saran cadangan (petunjuk tautan) hanya menemukan blangko di kelompok yang daftarnya sudah termuat.
        await muatSemuaKelompok(jenis);
        for (let i = 0; i < 40 && S.menu && S.menu.kelompok.some((x) => x.jenis === jenis && x.memuat); i += 1) await jedaTautan(100);
        if (S.pk !== pk || S.blangko) return;
        r = rekomendasiJenis(jenis)[0];
      }
      const cariKelompok = (x) => S.menu && S.menu.kelompok.find((k) => k.nama === x.kelompok || (k.berkas && k.berkas.some((b) => samaBerkasSaran(b.berkas, x.berkas))));
      let k = r ? cariKelompok(r) : null;
      if (r && k && !k.berkas) {
        await muatBerkasKelompok(k);
        // Pemuatan yang sedang berjalan (dimulai tahap lain) ditunggu sampai selesai.
        for (let i = 0; k.memuat && i < 40; i += 1) await jedaTautan(100);
        r = rekomendasiJenis(jenis)[0] || r; // varian jumlah saksi baru dapat dipilih sesudah daftar kelompok termuat
        k = cariKelompok(r) || k;
      }
      if (S.pk !== pk || S.blangko) return;
      if (r && k && k.berkas) {
        if (!kelompokBoleh(k)) {
          toast(`Akun Anda tidak berhak membuka blangko ${NAMA_SARAN_JENIS[jenis] || "jenis itu"}.`);
          return;
        }
        const asli = k.berkas.find((b) => samaBerkasSaran(b.berkas, r.berkas));
        await pilihBlangko(asli ? asli.berkas : r.berkas, k.nama);
        return;
      }
      bukaModal();
      if (S.modal) {
        S.modal.jenis = jenis;
        renderModal();
      }
      toast(`Belum ada saran blangko ${NAMA_SARAN_JENIS[jenis] || ""} yang pasti untuk sidang ini; silakan pilih dari daftar.`);
    } catch {
      /* tautan hanya kemudahan: petugas memilih blangko sendiri */
    }
  }
  function saatTautan(e) {
    const d = e && e.detail;
    if (!d || typeof d !== "object") return;
    const t = { ...d, dipakai: false };
    S.tautan = t;
    void jalankanTautan(t);
  }
  /** Tautan dari pop-up Draf H-7 membawa draf: pakai draf perkara itu; selain itu pemilihan blangko biasa. Lalu sorot isian yang ditunjuk. */
  async function jalankanTautan(t) {
    try {
      if (t.draf === "h7") await terapkanTautanDraf(t);
      else await terapkanTautanBlangko();
      if (t.isian && S.tautan === t) await sorotIsian(t.isian);
    } catch {
      /* tautan hanya kemudahan */
    }
  }

  // ── Draf H-7 dari tautan (19 Okt 2026) ────────────────────────────────────
  // Pop-up Draf H-7 portal mengirim draf: "h7" (+ varian, isian). Drafnya dibaca dari rute yang sama dengan kartu checklist
  // (konseptor-langkah GET drafH7) lalu dipasang lewat pakaiDrafH7: blangko draf terbuka dan isian agen menjadi SARAN
  // (tidak ada yang tersimpan ke ABT selain isi otomatis yang memang berlaku). Draf tidak ada / tidak berblangko = jalur biasa.
  const API_KONSEPTOR_LANGKAH = "/aleta/api/aleta-ecourt/konseptor-langkah";
  async function bacaDrafTautan(pid) {
    if (!/^\d+$/.test(String(pid || ""))) return null;
    const h = await ambilPortal(`${API_KONSEPTOR_LANGKAH}?perkaraId=${encodeURIComponent(pid)}`, {}, "Membaca draf putusan");
    const d = h && h.drafH7 && h.drafH7[pid];
    return d && typeof d === "object" ? d : null;
  }
  /** Draf utama, atau varian yang diminta tautan (ditolak) bila blangkonya ada. */
  function pilihVarianDraf(d, varian) {
    if (!d) return null;
    if (varian && varian !== "dikabulkan") {
      const v = (Array.isArray(d.varian) ? d.varian : []).find((x) => x && x.status === varian && x.blangko && x.blangko.berkas);
      if (v) return v;
    }
    return d.blangko && d.blangko.berkas ? d : null;
  }
  async function terapkanTautanDraf(t) {
    if (!t || t.dipakai || !S.pk) return;
    t.dipakai = true;
    const pk = S.pk;
    let draf = null;
    try {
      draf = pilihVarianDraf(await bacaDrafTautan(perkaraId()), t.varian);
    } catch {
      draf = null;
    }
    if (S.pk !== pk || S.blangko) return;
    if (!draf) {
      // Belum ada draf (atau tidak terbaca): jalur biasa, blangko putusan sidang ini.
      t.dipakai = false;
      return terapkanTautanBlangko();
    }
    const a = api();
    if (a && typeof a.muatHak === "function") await Promise.resolve(a.muatHak()).catch(() => undefined);
    if (S.pk !== pk || S.blangko) return;
    if (!jenisBoleh().includes("put")) {
      toast("Akun Anda tidak berhak membuka blangko putusan; pilih blangko yang sesuai dengan peran Anda.");
      return;
    }
    await pakaiDrafH7(draf);
  }

  // ── Sorotan isian yang ditunjuk tautan ────────────────────────────────────
  const SOROT_MS = 2000;
  const KELAS_SOROT = "bd-sorot";
  const longgar = (s) => String(s == null ? "" : s).toLowerCase().replace(/\s+/g, "");
  /** Kode isian yang namanya paling cocok (sama persis, lalu saling memuat) di antara kartu yang tampil; "" bila tidak ada. */
  function kodeIsianCocok(nama) {
    const k = longgar(nama);
    if (!k || !S.susunan) return "";
    const kartu = daftarPerlu().filter((b) => b && b.kode && b.jenis !== "tj");
    const sama = kartu.find((b) => longgar(b.nama) === k);
    if (sama) return sama.kode;
    if (k.length < 3) return "";
    const muat = kartu.find((b) => longgar(b.nama).includes(k)) || kartu.find((b) => longgar(b.nama).length >= 3 && k.includes(longgar(b.nama)));
    return muat ? muat.kode : "";
  }
  function pasangSorot(kode, pertama) {
    const f = cari(`.bd-f[data-f="${kode}"]`, wadah.isian);
    if (!f) return false;
    f.classList.add(KELAS_SOROT);
    if (pertama) {
      try {
        if (typeof f.scrollIntoView === "function") f.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* gulir hanya kemudahan */
      }
    }
    const kotak = cari("textarea, input, select", f);
    if (kotak && !kotak.disabled && typeof kotak.focus === "function" && (pertama || !document.activeElement || document.activeElement === document.body)) {
      try {
        kotak.focus({ preventScroll: true });
      } catch {
        /* fokus hanya kemudahan */
      }
    }
    return true;
  }
  /** Gulirkan ke kartu isian bernama itu, fokuskan kotaknya, sorot ±2 detik. Tidak ketemu = diam. Kartu yang digambar ulang tetap tersorot selama jendela itu. */
  async function sorotIsian(nama) {
    // Kartu baru ada sesudah susunan terbaca; tunggu sebentar bila pemilihan blangko masih berjalan.
    for (let i = 0; i < 40 && S.blangko && !S.susunan && !S.galatSusunan; i += 1) await jedaTautan(100);
    const kode = kodeIsianCocok(nama);
    if (!kode || !pasangSorot(kode, true)) return false;
    if (S.sorotan && S.sorotan.jam) clearTimeout(S.sorotan.jam);
    const so = { kode, sampai: Date.now() + SOROT_MS, jam: null };
    so.jam = setTimeout(() => {
      if (S.sorotan === so) S.sorotan = null;
      const f = cari(`.bd-f[data-f="${kode}"]`, wadah.isian);
      if (f) f.classList.remove(KELAS_SOROT);
    }, SOROT_MS);
    S.sorotan = so;
    return true;
  }

  /** Satu saran: alasan diramahkan dan varian saksi dipilih (bila kelompoknya sudah termuat). */
  function sesuaikanSaran(r) {
    let berkas = r.berkas;
    const saksi = Number(r.saksi) || saksiTautan();
    if (r.jenis === "put" && saksi > 0 && S.menu) {
      const k = S.menu.kelompok.find((x) => x.nama === r.kelompok);
      if (k && k.berkas) berkas = pilihVarianSaksi(r.berkas, k.berkas.map((b) => b.berkas), saksi);
    }
    return { ...r, berkas, alasan: ramahkanAlasan(r.alasan) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sambungan rekomendasi Tahap E (portal lib/rekomendasi-blangko.ts) -> titik sambung F-G (16 Okt)
  // ──────────────────────────────────────────────────────────────────────────
  // Jadwal sidang portal (?rekomendasi=1) mengembalikan rekomendasiBlangko per baris: BAS, putusan, relaas menurut keterangan/alasan tunda
  // sidang (agenda bila kosong) + keadaan perkara (status, verstek, kumulasi, mediasi, e-Court). Satu sumber dengan BAS massal dan putusan.
  // Fungsi titik sambung serempak, maka jawabannya disinggahkan per sidang: permintaan pertama dimulai di latar dan mengembalikan [] (cadangan
  // sederhana di atas yang tampil), lalu jendela dan ringkasan digambar ulang begitu jawaban portal tiba.
  const API_SIDANG_PORTAL = "/aleta/api/aleta-ecourt/sidang";
  // 20 Okt: ptsp ikut (saran penetapan PMH/PPP/PJS/PHS dari portal); portal lama tanpa ruas ptsp = tidak ada saran PTSP.
  const JENIS_DARI_PORTAL = { putusan: "put", bas: "bas", relaas: "rel", ptsp: "ptsp" };
  const BATAS_ALTERNATIF_SARAN = 3;
  const ULANG_GAGAL_MS = 60 * 1000;
  const rekPortal = new Map(); // kunci sidang -> { status: "memuat"|"siap"|"galat", hasil, saat }
  // 19 Okt 2026: nama lama ("CG - BAS") dan nama lengkapnya ("Cerai Gugat - BAS") satu kunci; tampilan memakai nama lengkap.
  const rapiNama = (s) => (typeof alatKunciKelompok === "function" ? alatKunciKelompok(s) : String(s || "").replace(/\s+/g, " ").trim().toLowerCase());
  const namaMenuTampil = (s) => (typeof alatNamaMenuLengkap === "function" ? alatNamaMenuLengkap(s) : String(s || ""));

  /** Nama berkas saran sama dengan nama berkas di kelompok? Tanpa .rtf, spasi ganda, dan huruf besar-kecil tidak dibedakan. */
  const samaBerkasSaran = (a, b) => {
    const rapi = (x) => String(x || "").replace(/\.rtf$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
    return Boolean(rapi(a)) && rapi(a) === rapi(b);
  };
  /** Kelompok (nama menu Derry di ABT) untuk satu rekomendasi portal: nama menu, alias, atau nama folder (dengan/tanpa nomor urut). */
  function kelompokUntukSaran(menu, r) {
    const calon = new Set([r.menu, ...(Array.isArray(r.alias) ? r.alias : [])].map(rapiNama).filter(Boolean));
    const folder = String(r.folder || "").split("/").pop();
    if (folder) {
      calon.add(rapiNama(folder));
      calon.add(rapiNama(folder.replace(/^\d+[a-z]{0,2}\s+/i, "")));
    }
    const k = (Array.isArray(menu) ? menu : []).find((x) => x && calon.has(rapiNama(x.nama)));
    return k ? k.nama : "";
  }

  /**
   * HasilRekomendasi portal -> bentuk titik sambung [{ berkas, kelompok, jenis, alasan, utama }] (murni, diuji).
   * Tiap jenis: semua yang `utama` + paling banyak tiga alternatif; jenis yang boleh dipakai akun (opsi.jenis) lebih dulu.
   */
  function saranDariPortal(hasil, menu, opsi) {
    if (!hasil || typeof hasil !== "object") return [];
    const o = opsi || {};
    const sumber = hasil.sumberTeks === "alasan-tunda" ? "keterangan" : hasil.sumberTeks === "agenda" ? "agenda" : "";
    const dasar = sumber && hasil.teksDasar ? `dari ${sumber} sidang${o.urutan ? ` ke-${o.urutan}` : ""}: "${potong(String(hasil.teksDasar).trim(), 60)}"` : "dari keadaan perkara";
    const out = [];
    const lihat = new Set();
    for (const [kunci, kode] of Object.entries(JENIS_DARI_PORTAL)) {
      const daftar = Array.isArray(hasil[kunci]) ? hasil[kunci] : [];
      let alternatif = 0;
      for (const r of daftar) {
        if (!r || !r.berkas) continue;
        if (!r.utama) {
          if (alternatif >= BATAS_ALTERNATIF_SARAN) continue;
          alternatif += 1;
        }
        const berkas = String(r.berkas).replace(/\.rtf$/i, "").trim();
        if (!berkas || lihat.has(`${kode}|${berkas}`)) continue;
        lihat.add(`${kode}|${berkas}`);
        const sebab = String(r.alasan || "").trim().replace(/\.$/, "");
        out.push({ berkas, kelompok: kelompokUntukSaran(menu, r), jenis: kode, alasan: `${dasar}${sebab ? ` - ${sebab}` : ""}${r.perkiraan ? " (perkiraan, periksa kembali)" : ""}`, utama: Boolean(r.utama), ...(Number(hasil.jumlahSaksi) > 0 ? { saksi: Number(hasil.jumlahSaksi) } : {}) });
      }
    }
    const boleh = Array.isArray(o.jenis) ? o.jenis : [];
    if (boleh.length) out.sort((a, b) => (boleh.includes(a.jenis) ? 0 : 1) - (boleh.includes(b.jenis) ? 0 : 1));
    return out;
  }

  const kunciSidangSaran = (ctx) => {
    const s = (ctx && ctx.sidangDipilih) || null;
    const nomor = String((ctx && ctx.nomorPerkara) || "").trim();
    const tanggal = s ? String(s.tanggal || s.tanggalSidang || "").slice(0, 10) : "";
    return nomor && /^\d{4}-\d{2}-\d{2}$/.test(tanggal) ? { kunci: `${nomor}|${tanggal}|${(s && s.sidangId) || ""}`, nomor, tanggal, sidangId: String((s && s.sidangId) || "") } : null;
  };

  /** Baris jadwal sidang perkara ini pada tanggal itu: sidang yang sama (sidangId) lebih dulu, lalu tanggal yang sama. */
  function barisSidangSaran(sidang, k) {
    const milik = (Array.isArray(sidang) ? sidang : []).filter((x) => x && String(x.nomorPerkara || "").trim() === k.nomor);
    return (
      (k.sidangId && milik.find((x) => String(x.sidangId || "") === k.sidangId)) ||
      milik.find((x) => String(x.tanggalSidang || "").slice(0, 10) === k.tanggal) ||
      milik[0] ||
      null
    );
  }

  async function muatSaranPortal(k) {
    rekPortal.set(k.kunci, { status: "memuat", hasil: null, saat: Date.now() });
    try {
      const alamat = `${API_SIDANG_PORTAL}?dari=${k.tanggal}&sampai=${k.tanggal}&cari=${encodeURIComponent(k.nomor)}&batas=20&rekomendasi=1`;
      const d = await ambilPortal(alamat, {}, "Membaca saran blangko");
      const b = barisSidangSaran(d && d.sidang, k);
      rekPortal.set(k.kunci, { status: "siap", hasil: (b && b.rekomendasiBlangko) || null, saat: Date.now() });
    } catch {
      rekPortal.set(k.kunci, { status: "galat", hasil: null, saat: Date.now() });
    }
    const sekarang = S.pk ? kunciSidangSaran({ nomorPerkara: nomorPerkara(), sidangDipilih: S.pk.sidangDipilih }) : null;
    if (!sekarang || sekarang.kunci !== k.kunci) return;
    // Kelompok yang disarankan dimuat lebih dulu supaya tombolnya langsung dapat dipilih, lalu jendela & ringkasan digambar ulang.
    const rek = rekomendasi();
    if (S.menu) for (const r of rek) {
      const kel = S.menu.kelompok.find((x) => x.nama === r.kelompok);
      if (kel && !kel.berkas) await muatBerkasKelompok(kel);
    }
    renderModal();
    renderRingkasBlangko();
  }

  /** Fungsi yang dipasang ke aletaBlangkoDerry.pasangRekomendasi: saran portal untuk sidang yang dipilih, [] selama belum tiba. */
  function rekomendasiPortal(ctx) {
    const k = kunciSidangSaran(ctx);
    if (!k) return [];
    const c = rekPortal.get(k.kunci);
    if (!c || (c.status === "galat" && Date.now() - c.saat > ULANG_GAGAL_MS)) {
      void muatSaranPortal(k);
      return [];
    }
    if (c.status !== "siap") return [];
    const s = ctx.sidangDipilih || {};
    const urutan = Number(s.urutan) > 0 ? Number(s.urutan) : (Number(ctx.sidangKe) || 0) + 1;
    return saranDariPortal(c.hasil, ctx.menu, { jenis: ctx.jenis, urutan });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Jendela pilih blangko (dua kolom)
  // ──────────────────────────────────────────────────────────────────────────
  const kodeDari = (n) => (String(n || "").match(/\[([^\]]+)\]/) || [])[1] || "";
  const namaTampil = (n, jenis) => {
    const t = String(n || "").replace(/\.rtf$/i, "");
    if (jenis === "put") return t.replace(/^\[[^\]]+\] /, "");
    return t.replace(/^BAS ALUR \d\d \[[^\]]+\] /, "").replace(/^BAS KUASA INSIDENTIL - /, "").replace(/^\[JS\] /, "");
  };
  /**
   * Perkiraan "cocok untuk sidang ke-berapa" (19 Okt 2026), HANYA dari tulisan nama blangko Derry (pohon alur BAS):
   * "BAS 1/2/3 ..." atau "Sidang 1/2 ..." = sidang itu, "Sidang/BAS Pertama" = 1, "BAS Lanjutan" = lanjutan,
   * "BAS Terakhir"/"BAS Putus"/"Pembacaan Putusan" = putusan, "Ikrar" = ikrar. Tanpa petunjuk di nama -> null (lencana kosong, tidak menebak).
   * Frasa "Tunda Putusan/Penetapan" tidak dihitung sebagai putusan; pemberitahuan/salinan/akta bukan sidang.
   */
  function perkiraanSidang(nama, jenis) {
    if (jenis === "ptsp") return null;
    const t = String(nama || "")
      .replace(/\.rtf$/i, "")
      .replace(/^BAS ALUR \d\d \[[^\]]+\] /, "")
      .replace(/^\[[^\]]+\]\s*/, "")
      .replace(/\btunda\s+(?:pembacaan\s+|pengucapan\s+|penyampaian\s+)?(?:putusan|penetapan)\b/gi, " ");
    if (/\bikrar\b/i.test(t)) return { teks: "ikrar", tipe: "ikrar" };
    const n = t.match(/\b(?:BAS|Sidang)\s+(\d{1,2})(?![\d.])(?!\s*saksi)/i);
    if (n && Number(n[1]) > 0) return { teks: `sidang ${Number(n[1])}`, tipe: "n", n: Number(n[1]) };
    if (/\b(?:BAS|Sidang)\s+Pertama\b/i.test(t)) return { teks: "sidang 1", tipe: "n", n: 1 };
    if (/\blanjutan\b/i.test(t)) return { teks: "lanjutan", tipe: "lanjut" };
    if (!/pemberitahuan|salinan|\bakta\b|\bamar\b/i.test(t) && /\bterakhir\b|\bBAS\s+Putus\b|\bputusan\b|\bputus\b/i.test(t)) return { teks: "putusan", tipe: "putus" };
    return null;
  }
  /** Sidang yang sedang dipilih di langkah 1: urutan + teks agenda/keterangan (untuk menyorot lencana yang cocok). */
  function sidangAktifUntukLencana() {
    const s = (S.pk && S.pk.sidangDipilih) || {};
    return { urutan: Number(sidangUrutan()) || 0, agenda: `${s.agenda || ""} ${s.ket || ""}` };
  }
  function lencanaSidang(nama, jenis, paksaIkrar) {
    const k = perkiraanSidang(nama, jenis) || (paksaIkrar ? { teks: "ikrar", tipe: "ikrar" } : null);
    if (!k) return `<span class="sd" aria-hidden="true"></span>`;
    const a = sidangAktifUntukLencana();
    const cocok = k.tipe === "n" ? a.urutan === k.n : k.tipe === "lanjut" ? a.urutan >= 2 : k.tipe === "putus" ? /putus|pembacaan|pengucapan/i.test(a.agenda) : /ikrar/i.test(a.agenda);
    return `<span class="sd${cocok ? " cocok" : ""}" title="Perkiraan: ${esc(k.teks)}${cocok ? " (sesuai sidang yang dipilih)" : ""}">${esc(k.teks)}</span>`;
  }
  function bukaModal() {
    if (!S.pk) return toast("Pilih perkara dulu.");
    const jenisAda = jenisBoleh();
    if (!jenisAda.length) return toast("Peran akun Anda tidak punya blangko di tampilan ini.");
    const jenis = S.blangko && jenisAda.includes(S.blangko.jenis) ? S.blangko.jenis : jenisAda[0];
    S.modal = { jenis, kelompok: "", cari: "" };
    renderModal();
    const a = api();
    // Saklar Pengaturan SIPP & ABT dapat menambah jenis (hakim -> BAS, PP -> putusan): gambar ulang sesudah terbaca.
    if (a && typeof a.muatHak === "function") void Promise.resolve(a.muatHak()).then(() => S.modal && renderModal());
    void muatMenu().then(() => {
      if (!S.menu || !S.modal) return;
      renderModal();
      const rek = rekomendasi();
      const k = S.menu.kelompok.filter((x) => x.jenis === S.modal.jenis && kelompokBoleh(x));
      // Kelompok yang disarankan dan yang paling sering dipakai dimuat lebih dulu, lalu sisanya di belakang.
      const dulu = k.filter((x) => rek.some((r) => r.kelompok === x.nama)).concat(k.slice().sort(urutKelompok).slice(0, 2));
      Promise.all([...new Set(dulu)].map((x) => muatBerkasKelompok(x))).then(() => muatSemuaKelompok(S.modal ? S.modal.jenis : jenis)).then(() => muatKelompokIkrar());
    });
    void muatIndeks();
  }
  function tutupModal() {
    S.modal = null;
    const m = cari("#bd-modal", wadah.akar);
    if (m) m.hidden = true;
  }
  /**
   * 22 Okt 2026: kunci kelompok (nama menu Derry) yang cocok dengan JENIS perkara terpilih, untuk jenis dokumen `jenisDok`.
   * Sumbernya SATU: peta blangko putusan panel-alat.js (ALAT_PETA_BAWAAN, kunci jenis dari alatKunciJenis - padanan nama SIPP,
   * bukan tebakan kata). Putusan: menu putusan jenis itu ("Putusan Itsbat Nikah" / "Itsbat - Putusan"); BAS: pasangan menu
   * "<Jenis> - BAS". Relaas dan PTSP bukan per jenis perkara -> kosong. Murni terhadap peta; diuji.
   */
  function kunciKategoriPerkara(jenisDok) {
    const kosong = new Set();
    try {
      if (!S.pk || (jenisDok !== "put" && jenisDok !== "bas")) return kosong;
      if (typeof alatKunciJenis !== "function" || typeof alatKunciKelompok !== "function" || typeof ALAT_PETA_BAWAAN === "undefined") return kosong;
      const j = alatKunciJenis(S.pk.jenisPerkara || "");
      if (!j) return kosong;
      // Menu putusan yang paling sering dipakai baris-baris jenis itu (jenis polos dan per status; baris kumulasi "+" tidak ikut).
      // Baris "<jenis>|<status>" (dua ruas) mewakili jenis itu; baris berkeadaan ("<jenis>|<status>|kontensius") milik varian lain dan hanya
      // dipakai bila perkaranya gugatan (nomor Pdt.G) dan jenis itu punya baris kontensius (mis. Itsbat Nikah Kontensius, menu sendiri).
      const baru = Object.entries(ALAT_PETA_BAWAAN).filter(([kunci, baris]) => (kunci === j || kunci.startsWith(`${j}|`)) && baris && baris.blangko);
      const polos = baru.filter(([kunci]) => kunci.split("|").length <= 2);
      const kontensius = baru.filter(([kunci]) => kunci.split("|")[2] === "kontensius");
      const gugatan = /\/Pdt\.G(?:\.|\/)/i.test(String(S.pk.nomorPerkara || ""));
      const sumber = gugatan && kontensius.length ? kontensius : polos.length ? polos : baru;
      const hitung = new Map();
      for (const [, baris] of sumber) {
        const nama = alatKunciKelompok(baris.blangko);
        const ada = hitung.get(nama) || { n: 0, baris };
        ada.n += 1;
        hitung.set(nama, ada);
      }
      let terbaik = null;
      for (const v of hitung.values()) if (!terbaik || v.n > terbaik.n) terbaik = v;
      if (!terbaik) return kosong;
      const nama = [terbaik.baris.blangko, ...(Array.isArray(terbaik.baris.blangkoLain) ? terbaik.baris.blangkoLain : [])];
      if (jenisDok === "put") return new Set(nama.map(alatKunciKelompok));
      const bas = new Set();
      for (const n of nama) {
        const m = String(n).match(/^(.+?)\s+-\s+putusan$/i) || String(n).match(/^putusan\s+(.+)$/i);
        if (m) bas.add(alatKunciKelompok(`${m[1].trim()} - BAS`));
      }
      return bas;
    } catch {
      return kosong;
    }
  }
  function kelompokModal() {
    if (!S.menu || !S.modal) return [];
    const rek = rekomendasi();
    const semua = S.menu.kelompok.filter((k) => k.jenis === S.modal.jenis && kelompokBoleh(k)).sort(urutKelompok);
    const daftar = [];
    // Saran dari kelompok yang tidak boleh bagi akun (atau akun yang ditiru) ini tidak ditawarkan.
    const rekDiJenis = rek.filter((r) => r.jenis === S.modal.jenis && !S.menu.kelompok.some((x) => x.nama === r.kelompok && !kelompokBoleh(x)));
    if (rekDiJenis.length) {
      const berkas = [];
      for (const r of rekDiJenis) {
        const k = semua.find((x) => x.nama === r.kelompok) || semua.find((x) => x.berkas && x.berkas.some((b) => samaBerkasSaran(b.berkas, r.berkas)));
        const b = k && k.berkas ? k.berkas.find((x) => samaBerkasSaran(x.berkas, r.berkas)) : null;
        if (b) berkas.push({ ...b, kelompok: k.nama, alasan: r.alasan });
        else if (!k || !k.berkas) berkas.push({ berkas: r.berkas, kelompok: r.kelompok, a: "", b: "", alasan: r.alasan, belum: true });
      }
      if (berkas.length) daftar.push({ id: "saran", nama: "Disarankan", sub: `untuk sidang ke-${(Number(S.pk.sidangKe) || 0) + 1}`, saran: true, berkas });
    }
    const ikrar = kumpulkanIkrar(S.menu.kelompok, kelompokBoleh);
    for (const k of semua) {
      const f = FREK_ALUR[alurDari(k.nama)];
      // 20 Okt: kelompok yang memuat blangko disarankan ikut ditandai (nama menebal berwarna), walau kelompok lain berisi lebih banyak blangko.
      const adaSaran = rekDiJenis.some((r) => r.kelompok === k.nama || (k.berkas || []).some((b) => samaBerkasSaran(b.berkas, r.berkas)));
      // 27 Okt: blangko yang disarankan naik ke atas daftar kelompoknya (urutan sisanya tetap).
      const isi = (k.berkas || []).map((b) => ({ ...b, kelompok: k.nama }));
      const disaranDiSini = isi.filter((b) => rekDiJenis.some((r) => samaBerkasSaran(r.berkas, b.berkas)));
      const berkas = disaranDiSini.concat(isi.filter((b) => !disaranDiSini.includes(b)));
      daftar.push({ id: `k:${k.nama}`, nama: k.judul || namaMenuTampil(k.nama), sub: adaSaran ? "ada yang disarankan untuk sidang ini" : f ? `dipakai ${f.toLocaleString("id-ID")} perkara` : k.jumlah ? `${k.jumlah} blangko` : "", adaSaran, berkas, memuat: !k.berkas && !k.galat, galat: k.galat || "" });
    }
    // 22 Okt: kategori yang cocok dengan jenis perkara terpilih (mis. Putusan Itsbat Nikah untuk perkara Istbat Nikah) dipindah ke ATAS,
    // tepat di bawah Disarankan. Kelompok maya Ikrar Talak di bawah ini mengikuti letak menu cerai talak yang baru.
    const kunciCocok = kunciKategoriPerkara(S.modal.jenis);
    if (kunciCocok.size) {
      const i = daftar.findIndex((x) => !x.saran && x.id.startsWith("k:") && kunciCocok.has(alatKunciKelompok(x.id.slice(2))));
      if (i >= 0) {
        const [cocokPerkara] = daftar.splice(i, 1);
        cocokPerkara.cocokPerkara = true;
        cocokPerkara.sub = ["sesuai jenis perkara ini", cocokPerkara.sub].filter(Boolean).join(" · ");
        daftar.splice(daftar.length && daftar[0].saran ? 1 : 0, 0, cocokPerkara);
      }
    }
    // 27 Okt: kelompok bertanda kuning (memuat blangko disarankan) naik tepat di bawah Disarankan dan kategori jenis perkara ini;
    // urutan di antara sesamanya dan kelompok lain tidak berubah (sort stabil).
    const tingkat = (x) => (x.saran ? 0 : x.cocokPerkara ? 1 : x.adaSaran ? 2 : 3);
    daftar.sort((a, b) => tingkat(a) - tingkat(b));
    // Kelompok maya "Ikrar Talak": tepat di bawah menu cerai talak (atau di bawah Disarankan bila tidak ada), berisi butir dari tiga folder.
    if (ikrar.berkas.length || ikrar.memuat) {
      const disaran = ikrar.berkas.filter((b) => rek.some((r) => samaBerkasSaran(r.berkas, b.berkas)));
      const berkas = disaran.concat(ikrar.berkas.filter((b) => !disaran.includes(b)));
      const grup = {
        id: "ikrar",
        nama: NAMA_IKRAR,
        sub: disaran.length ? "ada yang disarankan untuk sidang ini" : "berita acara, penetapan, dan relaas",
        ikrar: true,
        berkas,
        memuat: ikrar.memuat && !berkas.length,
        galat: "",
      };
      let pos = daftar.findIndex((x) => !x.saran && /cerai\s*talak|\bCT\b/i.test(x.nama));
      pos = pos >= 0 ? pos + 1 : daftar.length && daftar[0].saran ? 1 : 0;
      daftar.splice(pos, 0, grup);
    }
    return daftar;
  }
  function tombolBlangko(b, jenis, rek) {
    const nama = b.berkas;
    const aktif = S.blangko && S.blangko.berkas === nama && S.blangko.kelompok === b.kelompok;
    const disaran = rek.some((r) => samaBerkasSaran(r.berkas, nama));
    return (
      `<button type="button" class="bd-bl${aktif ? " aktif" : ""}" data-bl="${esc(nama)}" data-kel="${esc(b.kelompok)}" ${b.belum ? "disabled" : ""}>` +
      `<span class="kd">${esc(kodeDari(jenis === "put" ? nama : nama.replace(/^BAS ALUR \d\d /, "")))}</span>${lencanaSidang(nama, jenis, false)}<span class="nm">${esc(namaTampil(nama, jenis))}</span>` +
      `${disaran ? `<span class="bd-lencana">disarankan</span>` : ""}${aktif ? `<span class="tanda" aria-label="dipakai sekarang">&#10003;</span>` : ""}</button>`
    );
  }
  /**
   * 27 Okt: di tab Disarankan, tiap saran menyebut kelompok blangko asalnya (mis. "Cerai Gugat Kumulasi Hak Asuh Anak - Putusan");
   * kelompok itu dapat diklik untuk membukanya.
   */
  function asalSaran(b, daftar) {
    const k = daftar.find((x) => x.id === `k:${b.kelompok}`) || daftar.find((x) => x.ikrar && x.berkas.some((y) => y.berkas === b.berkas && y.kelompok === b.kelompok));
    const nama = k ? k.nama : namaMenuTampil(b.kelompok || "");
    if (!nama) return "";
    return k
      ? `<button type="button" class="bd-asalsaran" data-kelmodal="${esc(k.id)}" title="Buka kelompok ${esc(nama)}">di ${esc(nama)}</button> `
      : `<span class="bd-asalsaran">di ${esc(nama)}</span> `;
  }
  /** Satu butir kelompok maya Ikrar Talak: kalimat biasa, bukan nama berkas. */
  function tombolIkrar(b, rek) {
    const aktif = S.blangko && S.blangko.berkas === b.berkas && S.blangko.kelompok === b.kelompok;
    const disaran = rek.some((r) => samaBerkasSaran(r.berkas, b.berkas));
    return (
      `<button type="button" class="bd-bl${aktif ? " aktif" : ""}" data-bl="${esc(b.berkas)}" data-kel="${esc(b.kelompok)}" data-ikrar="1">` +
      `<span class="kd">${esc(b.kode)}</span>${lencanaSidang(b.berkas, "", true)}<span class="nm">${esc(b.kalimat)}</span>` +
      `${disaran ? `<span class="bd-lencana">disarankan</span>` : ""}${aktif ? `<span class="tanda" aria-label="dipakai sekarang">&#10003;</span>` : ""}</button>`
    );
  }
  function renderModal() {
    const m = cari("#bd-modal", wadah.akar);
    if (!m) return;
    if (!S.modal) {
      m.hidden = true;
      return;
    }
    m.hidden = false;
    const jenisAda = jenisBoleh();
    if (!jenisAda.includes(S.modal.jenis) && jenisAda.length) S.modal.jenis = jenisAda[0];
    const q = S.modal.cari.trim().toLowerCase();
    const rek = rekomendasi();
    const daftar = kelompokModal();
    if (!daftar.some((k) => k.id === S.modal.kelompok)) S.modal.kelompok = daftar.length ? daftar[0].id : "";
    const cocokBiasa = (b) => !q || b.berkas.toLowerCase().includes(q) || namaTampil(b.berkas, S.modal.jenis).toLowerCase().includes(q);
    // Kelompok maya Ikrar Talak: cocok bila namanya, jenisnya, kalimatnya, atau nama berkasnya memuat kata yang dicari.
    const butirIkrar = (b) => b.kalimat !== undefined && b.jenisNama !== undefined;
    const cocokIkrar = (b) => !q || NAMA_IKRAR.toLowerCase().includes(q) || b.berkas.toLowerCase().includes(q) || b.kalimat.toLowerCase().includes(q) || String(b.jenisNama || "").toLowerCase().includes(q);
    const cocok = (b) => (butirIkrar(b) ? cocokIkrar(b) : cocokBiasa(b));
    const tombol = (b) => (butirIkrar(b) ? tombolIkrar(b, rek) : tombolBlangko(b, S.modal.jenis, rek));
    const kiri = daftar
      .map((k) => {
        const n = k.berkas.filter(cocok).length;
        const aktifKel = k.id === S.modal.kelompok && !q;
        return `<button type="button" class="bd-kel${k.saran ? " saran" : ""}${k.adaSaran ? " adasaran" : ""}${k.ikrar ? " ikrar" : ""}${aktifKel ? " aktif" : ""}${k.cocokPerkara ? " cocokperkara" : ""}${q && n ? " ada" : ""}${q && !n ? " kosong" : ""}" data-kelmodal="${esc(k.id)}"${aktifKel ? ' aria-current="true"' : ""}><span class="kn">${esc(k.nama)}</span><span class="kj">${k.memuat ? "…" : q ? n : k.berkas.length}</span>${k.sub ? `<span class="ks">${esc(k.sub)}</span>` : ""}</button>`;
      })
      .join("");
    let kanan = "";
    if (q) {
      for (const k of daftar) {
        if (k.saran) continue;
        const ns = k.berkas.filter(cocok);
        if (ns.length) kanan += `<h5>${esc(k.nama)}</h5>${ns.map(tombol).join("")}`;
      }
      if (!kanan) kanan = `<p class="bd-catat">${S.menu && S.menu.kelompok.some((k) => k.jenis === S.modal.jenis && !k.berkas) ? "Belum ada yang cocok; kelompok lain masih dimuat…" : "Tidak ada blangko yang cocok."}</p>`;
    } else {
      const k = daftar.find((x) => x.id === S.modal.kelompok);
      if (!k) kanan = `<p class="bd-catat">${S.memuatMenu ? "Membaca menu Blangko Derry dari ABT…" : esc(S.galatMenu || "Tidak ada kelompok untuk jenis ini.")}</p>`;
      else if (k.memuat) kanan = `<p class="bd-catat" role="status">Membaca daftar blangko ${esc(k.nama)} dari ABT…</p>`;
      else if (k.galat) kanan = `<p class="bd-peringatan">${esc(k.galat)} <button type="button" class="bd-btn kecil" data-bd2="ulangkel" data-kel="${esc(k.id.replace(/^k:/, ""))}">Coba lagi</button></p>`;
      else kanan = (k.sub ? `<p class="bd-ksub">${esc(k.nama)} · ${esc(k.sub)}</p>` : "") + (k.saran ? k.berkas.map((b) => `${tombolBlangko(b, S.modal.jenis, rek)}<p class="bd-catat bd-alasanrek">${asalSaran(b, daftar)}${esc(b.alasan || "")}</p>`).join("") : k.berkas.map(tombol).join("") || `<p class="bd-catat">Kelompok ini kosong.</p>`);
    }
    // 22 Okt: innerHTML diganti utuh, jadi gulir daftar kiri dan kanan ikut hilang (memilih kategori di bagian bawah melompatkan daftar ke atas
    // dan kategori terpilih tak terlihat; daftar blangko yang selesai dimuat di latar juga menarik gulir ke atas). Gulir dicatat lalu dipulihkan;
    // daftar kanan hanya kembali ke atas bila isinya memang berganti (kategori, tab, atau kata cari lain).
    const gulirLama = {
      kiriY: 0, kiriX: 0, kananY: 0,
      sidik: "",
    };
    const kiriLama = cari(".bd-mkiri", m);
    const kananLama = cari(".bd-mkanan", m);
    if (kiriLama) {
      gulirLama.kiriY = kiriLama.scrollTop;
      gulirLama.kiriX = kiriLama.scrollLeft;
    }
    if (kananLama) gulirLama.kananY = kananLama.scrollTop;
    gulirLama.sidik = S.modal.sidikGulir || "";
    const sidikBaru = [S.modal.jenis, q ? `cari:${q}` : S.modal.kelompok].join("|");
    S.modal.sidikGulir = sidikBaru;
    // Daftar kiri berganti isi hanya saat tab jenis dokumen berganti: baru itu kembali ke atas.
    if ((S.modal.jenisGulir || S.modal.jenis) !== S.modal.jenis) {
      gulirLama.kiriY = 0;
      gulirLama.kiriX = 0;
    }
    S.modal.jenisGulir = S.modal.jenis;
    m.innerHTML =
      `<div class="bd-mkotak" role="document"><div class="bd-mkepala"><b>Pilih blangko</b>${tes() ? `<span class="bd-chip belum" title="Semua blangko dari semua jenis perkara terbuka; perkara acuan hanya dibaca">Tes putusan</span>` : ""}` +
      `<div class="bd-seg" role="tablist" aria-label="Jenis dokumen">${jenisAda.map((j) => `<button type="button" role="tab" data-jenismodal="${j}" aria-selected="${S.modal.jenis === j}">${esc(NAMA_JENIS[j])}${adm() ? "" : ""}</button>`).join("")}</div>` +
      `<input class="bd-cari" id="bd-caribl" placeholder="cari, mis. 3 saksi" aria-label="Cari blangko" value="${esc(S.modal.cari)}">` +
      `<button type="button" class="bd-btn kecil" data-bd2="tutupmodal">Tutup</button></div>` +
      `<div class="bd-mbadan"><nav class="bd-mkiri" aria-label="Kelompok blangko">${kiri}</nav><div class="bd-mkanan">${kanan}</div></div></div>`;
    const kiriBaru = cari(".bd-mkiri", m);
    const kananBaru = cari(".bd-mkanan", m);
    if (kiriBaru) {
      kiriBaru.scrollTop = gulirLama.kiriY;
      kiriBaru.scrollLeft = gulirLama.kiriX;
    }
    if (kananBaru && gulirLama.sidik === sidikBaru) kananBaru.scrollTop = gulirLama.kananY;
    // Butir terpilih harus tetap kelihatan: bila di luar jendela gulir, digeser seperlunya ("nearest" - tidak menggeser bila sudah tampak).
    for (const [wadahGulir, butir] of [[kiriBaru, kiriBaru && cari(".bd-kel.aktif", kiriBaru)], [kananBaru, kananBaru && cari(".bd-bl.aktif", kananBaru)]]) {
      if (wadahGulir && butir && typeof butir.scrollIntoView === "function") {
        try {
          butir.scrollIntoView({ block: "nearest", inline: "nearest" });
        } catch {
          /* peramban lama: gulir tetap seperti dipulihkan */
        }
      }
    }
    const c = cari("#bd-caribl", m);
    if (c && q !== undefined && document.activeElement !== c && S.modal.fokusCari) {
      c.focus();
      c.setSelectionRange(c.value.length, c.value.length);
    }
  }

  /**
   * Hak buka blangko (POST main/cari). blangko.hak: "periksa" -> "ok" | "ditolak". Selain "ok", naskah tidak boleh
   * diminta dari ABT (pratinjau, cetak) - tanpa penjaga ini kotak galat saja yang tampil, tombol Cetak tetap jalan.
   * Hanya jawaban "diizinkan" yang disimpan; penolakan/galat jaringan diperiksa ulang tiap Coba lagi.
   */
  async function periksaHakBlangko(blangko, kelompokNama) {
    // Tes putusan: saringan hak ABT (jenis perkara, tahapan, alur) sengaja dilewati - naskah diambil lewat abt/preview yang hanya membaca.
    if (tes()) {
      blangko.hak = "ok";
      return;
    }
    const kunci = `${blangko.berkas}|${kelompokNama || blangko.kelompok}|${perkaraId()}`;
    blangko.hak = "periksa";
    let hak = S.hak.get(kunci);
    if (!hak) {
      try {
        hak = await klienAbt().periksaHakBuka({ a: blangko.a, b: blangko.b, perkaraId: perkaraId() });
      } catch (e) {
        hak = { ok: false, diizinkan: false, pesan: String((e && e.message) || e) };
      }
      if (hak && hak.diizinkan) S.hak.set(kunci, hak);
    }
    if (S.blangko !== blangko) return;
    if (!hak || !hak.diizinkan) {
      blangko.hak = "ditolak";
      S.galatSusunan = `ABT tidak mengizinkan blangko ini untuk perkara ${nomorPerkara()}: ${(hak && hak.pesan) || "tanpa sebab"}.`;
      renderIsian();
      renderCetak();
      renderPratinjau();
      return;
    }
    blangko.hak = "ok";
  }
  /** Memilih blangko: hak diperiksa lewat POST main/cari (tanpa main/view). */
  async function pilihBlangko(nama, kelompokNama) {
    const k = S.menu && S.menu.kelompok.find((x) => x.nama === kelompokNama);
    const b = k && k.berkas ? k.berkas.find((x) => x.berkas === nama) : null;
    if (!b) return toast("Blangko itu belum terbaca dari ABT.");
    if (!kelompokBoleh({ ...k, ikrar: adalahBlangkoIkrar(k.jenis, b.berkas) })) return toast(`${NAMA_JENIS[k.jenis] || "Blangko"} di menu ${namaMenuTampil(k.nama)} bukan untuk peran ${adm() ? "akun yang sedang dilihat" : "akun Anda"}.`);
    tutupModal();
    const blangko = { berkas: b.berkas, kelompok: k.nama, judul: k.judul || namaMenuTampil(k.nama), a: b.a, b: b.b, jenis: k.jenis, folder: folderUntuk(k), peranKunci: kunciPeranSekarang() };
    if (BK()) BK().tutup();
    blangko.khusus = await berkasKhususSiap(b.berkas);
    S.blangko = blangko;
    S.susunan = null;
    S.galatSusunan = "";
    S.nilai = {};
    S.isi = {};
    S.diketik.clear();
    otoTulis.clear(); // C1: nilai yang ALETA tulis sendiri milik blangko/perkara sebelumnya tidak terbawa
    jejakTerakhir.clear();
    S.tersimpan = {};
    S.ganti = {};
    S.saran = {};
    S.saranSipp = {};
    S.belajar8503 = null;
    S.isianSidang = null;
    S.info = {};
    S.bunyi = {};
    S.ketBuka = new Set();
    S.ketRiwayat = {};
    S.ketRiwayatBuka = new Set();
    S.dariSipp = new Set();
    S.el7 = null;
    S.el7Saran = null;
    S.bukti = { P: null, T: null };
    S.buktiEl = { P: null, T: null };
    S.buktiElBuka = {};
    S.buktiOto = {};
    S.tj = {};
    S.tjBuka = null;
    S.semua = null;
    S.semuaBuka = false;
    S.prat = { terbuka: false, memuat: false, rtf: null, html: "", galat: "", suntingPenuh: false, kotor: true, penanda: [] };
    S.peringat = false;
    S.ttdPilih = new Set();
    S.ttdManual = false;
    S.tampilTakBerlaku = false;
    S.tandaKosong = new Set();
    renderRingkasBlangko();
    renderIsian();
    renderPratinjau();
    renderCetak();
    void autoCentangTtd();
    await periksaHakBlangko(blangko, kelompokNama);
    if (S.blangko !== blangko || blangko.hak !== "ok") return;
    if (blangko.khusus) {
      renderIsian();
      return;
    }
    await muatSusunan();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Susunan isian (portal) + nilai (bot / ABT) + pemicu
  // ──────────────────────────────────────────────────────────────────────────
  function alamatSusunan(semua, blangko) {
    const bl = blangko || S.blangko;
    const q = new URLSearchParams();
    q.set("folder", bl.folder || "");
    q.set("berkas", bl.berkas);
    q.set("perkaraId", perkaraId());
    q.set("sidangKe", sidangUrutan());
    const sb = sebutan();
    q.set("sebutanP", sb.P);
    q.set("sebutanT", sb.T);
    if (semua) q.set("semua", "1");
    // "Lihat sebagai akun": rute menegakkan hak dokumen peran yang ditiru (server hanya menerimanya dari admin).
    const a = api();
    const kd = a && typeof a.keadaan === "function" ? a.keadaan() : null;
    if (!tes() && adm() && kd && kd.sebagai && kd.sebagai.nama && kd.sebagai.peran) q.set("sebagaiPeran", kd.sebagai.peran);
    return `${API_BLANGKO}?${q.toString()}`;
  }
  const kerjaOto = new Set();
  function lacakOto(janji) {
    kerjaOto.add(janji);
    const lepas = () => kerjaOto.delete(janji);
    Promise.resolve(janji).then(lepas, lepas);
    return janji;
  }
  async function muatSusunan() {
    const blangko = S.blangko;
    if (!blangko || !S.pk) return;
    S.memuatSusunan = true;
    S.galatSusunan = "";
    renderIsian();
    try {
      await muatIndeks();
      if (!blangko.folder) blangko.folder = folderUntuk(S.menu.kelompok.find((x) => x.nama === blangko.kelompok));
      if (!blangko.folder) throw new Error(S.indeks && S.indeks.sebab ? `Folder blangko di server tidak terbaca: ${S.indeks.sebab}` : "Folder blangko ini tidak ditemukan di server ALETA.");
      const d = await ambilPortal(alamatSusunan(false), {}, "Membaca isian blangko");
      if (S.blangko !== blangko) return;
      if (!d || !d.ada) throw new Error((d && d.sebab) || "Isian blangko tidak terbaca.");
      S.susunan = d;
      ktSeragamkanNama(d);
      S.nilai = d.nilai && typeof d.nilai === "object" ? d.nilai : {};
      if (!d.nilaiAda) await nilaiDariAbt(d);
      if (S.blangko !== blangko) return;
      for (const b of d.isian) {
        const v = S.nilai[b.kode];
        // 21 Okt (w25): bawaan ABT berupa DAFTAR pilihan (mis. keputusan 4100-4105) bukan isian: kotak tetap kosong, belum dipilih.
        if (v && v.status === "terisi" && b.jenis !== "tj" && !daftarPilihanMurni(b, v.teks)) S.isi[b.kode] = b.jenis === "tanggal" ? keIso(v.teks) || v.teks : v.teks;
      }
      // Tes putusan: ketikan pada blangko sebelumnya (perkara acuan yang sama) ikut, seolah sudah tersimpan di ABT.
      if (tes()) for (const b of d.isian) if (Object.prototype.hasOwnProperty.call(S.tesIsian, b.kode)) S.isi[b.kode] = S.tesIsian[b.kode];
      S.memuatSusunan = false;
      renderRingkasBlangko();
      renderIsian();
      renderCetak();
      laporKeKerangka();
      void muatSaranAbt(d);
      S.janjiBukti = siapkanBukti();
      void muatSematan();
      // 19 Okt: bawaan itsbat, e-litigasi 7139 dan bacaan SIPP/gugatan/e-Court berjalan sendiri bila saklar "Isi otomatis dari SIPP" menyala.
      // Cetak massal menunggu pekerjaan otomatis ini selesai sebelum berpindah ke perkara berikutnya (kerjaOto).
      void lacakOto(isiOtomatisBlangko(d));
      void lacakOto(isiJawabMenjawabOtomatis(d));
    } catch (e) {
      if (S.blangko !== blangko) return;
      S.memuatSusunan = false;
      S.galatSusunan = String((e && e.message) || e);
      renderIsian();
      renderCetak();
    }
  }
  /** Bot tidak menjawab: nilai isian & pemicu dibaca satu per satu dari jendela sembul ABT (edit_data). */
  async function nilaiDariAbt(d) {
    const kode = [...d.isian.filter((b) => b.jenis !== "tj").map((b) => b.kode), ...d.pemicu.map((p) => p.kode), ...(d.kutipanTuntutan ? [d.kutipanTuntutan] : []), ...(d.kutipanLain ? [d.kutipanLain] : [])];
    const k = klienAbt();
    for (let i = 0; i < kode.length; i += 4) {
      await Promise.all(
        kode.slice(i, i + 4).map(async (c) => {
          try {
            const h = await k.bacaIsian(c, perkaraId(), "", sidangUrutan());
            if (!h.ok) return;
            const teks = h.tipe === "data_tanggal" ? h.nilaiTanggal || h.nilai : h.nilai;
            // Jendela ABT tidak membedakan isian tersimpan dari bawaan terhitung - dianggap terisi bila ada teksnya.
            S.nilai[c] = { status: String(teks || "").trim() ? "terisi" : "kosong", teks: String(teks || ""), dariPopup: true };
          } catch {
            /* satu variabel gagal: tetap kosong */
          }
        })
      );
    }
    // 17 Okt: tanya jawab dibaca juga (seperti jalur utama bot: kode penanda dan penyuntingnya) - tanpa ini saksi yang
    // barisnya sudah ada di ABT terbaca "kosong" dan tampil "Penting" di peringatan cetak. Dibaca lewat penyunting per sidang.
    const tj = d.isian.filter((b) => b.jenis === "tj" && b.tj && b.tj.kodeSunting);
    for (let i = 0; i < tj.length; i += 3) {
      await Promise.all(
        tj.slice(i, i + 3).map(async (b) => {
          try {
            // 27 Okt: variabel "keterangan" (putusan) digambar ABT dari SEMUA sidang, jadi keterangan di sidang pembuktian sebelumnya juga dihitung.
            const { h } = await bacaTjLintas(b.tj.kodeSunting, sidangUrutan(), b.tj.peran === "keterangan");
            if (!h.ok) return;
            const baris = Array.isArray(h.baris) ? h.baris : [];
            const ada = barisTjBerisi(baris);
            const nilai = { status: ada ? "terisi" : "kosong", teks: "", dariPopup: true };
            S.nilai[b.kode] = nilai;
            S.nilai[b.tj.kodeSunting] = nilai;
          } catch {
            /* satu saksi gagal terbaca: tetap kosong */
          }
        })
      );
    }
  }
  /** Saran bayangan: bawaan ABT yang dihitung untuk perkara ini (jendela sembul edit_data) bagi isian kosong. */
  async function muatSaranAbt(d) {
    if (!cfg().saran) return;
    const perlu = d.isian.filter((b) => b.jenis === "teks" && !S.isi[b.kode] && /#\d{4,5}#/.test(b.bawaan || ""));
    const k = klienAbt();
    for (let i = 0; i < perlu.length; i += 3) {
      await Promise.all(
        perlu.slice(i, i + 3).map(async (b) => {
          try {
            const h = await k.bacaIsian(b.kode, perkaraId(), "", sidangUrutan());
            const bawaan = h.ok ? String(h.nilai || "").trim() : "";
            if (bawaan && !S.isi[b.kode]) {
              // 19 Okt (isian 2): bawaan kueri ABT yang bentuknya bukan isiannya (mis. kalimat ghaib untuk Awal perselisihan) dibuang.
              const m = mesinIsi();
              if (m && !m.sahBentuk(b.kode, m.bersihkanNilai(b.kode, bawaan), b.nama)) catatTeknis("bawaan ABT bentuknya tidak sesuai isian, tidak dipakai:", b.kode);
              else S.saran[b.kode] = bawaan;
            }
          } catch {
            /* tanpa saran */
          }
        })
      );
      if (S.susunan === d) renderIsian();
    }
  }
  // ──────────────────────────────────────────────────────────────────────────
  // Blangko PUTUSAN: perapian posita dan kalimat penutup keterangan saksi berjalan SENDIRI (19 Okt 2026, isian 2)
  // ──────────────────────────────────────────────────────────────────────────
  // Dahulu petugas menekan "Rapikan posita & keterangan saksi" (abt.js) dan "Bersihkan kalimat penutup" (editor tanya jawab) tiap putusan.
  //   - posita (5125): butir yang menempel dipisah lewat mintaPositaRapi (abt.js; bot menjaga teks tanpa ruang kosong persis sama, uji kering
  //     lebih dulu). Hanya bila hasilnya memang berbeda; satu kali per perkara per muatan halaman; dicatat di riwayat perubahan (dapat
  //     dikembalikan lewat "Lihat riwayat perubahan" di panel ABT);
  //   - keterangan saksi: di PUTUSAN tampilannya hanya-baca dan kalimat penutup ("Bahwa cukup sekian", dst.) tidak ditampilkan; pada keluaran
  //     CETAK (RTF dan turunannya) paragraf yang seluruhnya kalimat penutup dibuang (bersihkanPenutupSaksiRtf). Tidak ada yang ditulis ke
  //     ABT/SIPP; isi di ABT dan BAS tidak berubah.
  const rapiPositaSudah = new Set();
  async function rapikanPositaOtomatis(d) {
    try {
      if (!S.pk || !S.blangko || S.blangko.jenis !== "put" || !bolehTulis() || typeof mintaPositaRapi !== "function") return;
      const id = perkaraId();
      if (!/^\d+$/.test(String(id)) || rapiPositaSudah.has(id)) return;
      const memuatPosita = (d.penanda || []).includes("5125") || (d.otomatis || []).some((o) => o && o.kode === "5125") || (d.isian || []).some((b) => b.kode === "5125");
      if (!memuatPosita) return;
      rapiPositaSudah.add(id);
      const uji = await mintaPositaRapi(id, true);
      if (!uji || !uji.ok || !uji.berubah || S.susunan !== d) return;
      const hasil = await mintaPositaRapi(id, false);
      if (!hasil || !hasil.ok) {
        catatTeknis("posita tidak dirapikan otomatis:", String((hasil && hasil.pesan) || "ditolak"));
        return;
      }
      S.bahanSaksi = null;
      try {
        if (typeof catatRiwayat === "function") {
          void catatRiwayat({ perkaraId: id, kode: "5125", nama: "Posita lengkap", sebelum: String(hasil.sebelum || uji.sebelum || ""), sesudah: String(uji.sesudah || ""), cara: "dirapikan otomatis di Blangko Derry", pada: new Date().toISOString() });
        }
      } catch {
        /* jejak tidak tersedia: posita tetap rapi */
      }
      toast("Posita dirapikan otomatis (butir yang menempel dipisah). Dapat dikembalikan lewat riwayat perubahan di panel ABT.");
    } catch (e) {
      catatTeknis("rapikan posita otomatis gagal:", String((e && e.message) || e));
    }
  }
  const BAWAAN_ABT_ITSBAT = Object.freeze(["5178", "5105", "1046", "1002", "0007"]);
  /**
   * BAWAAN ABT ITSBAT (18 Okt 2026, keputusan 25): isian popup itsbat nikah yang sumber terbaiknya BAWAAN ABT sendiri
   * (kueri #101xx#: 5178 KUA, 5105 tempat, 1046 wali, 1002 status, 0007 anak - lihat GERBANG_ITSBAT di bot) hanya tersimpan
   * bila petugas membuka kotaknya lalu menyimpan; kotak yang tak dibuka tercetak "...". Di sini bawaan itu DISIMPAN OTOMATIS
   * ke isian yang masih kosong, tanpa petugas membuka popup. Isian manual menang (sudah terisi di ABT atau diketik selagi
   * menunggu -> tidak ditulis); bawaan yang masih memuat penanda "#...#", garis bawah, atau titik-titik tidak disimpan.
   */
  async function simpanBawaanAbtItsbat(d) {
    try {
      if (!S.pk || !bolehTulis() || !/itsbat/i.test(String(S.pk.jenisPerkara || ""))) return;
      const perlu = d.isian.filter((b) => BAWAAN_ABT_ITSBAT.includes(b.kode) && b.jenis === "teks" && !terisi(b));
      if (!perlu.length) return;
      const k = klienAbt();
      for (const b of perlu) {
        try {
          const h = await k.bacaIsian(b.kode, perkaraId(), "", sidangUrutan());
          const nilai = h && h.ok ? String(h.nilai || "").trim() : "";
          if (!nilai || /#\d{4,5}#|(?:^|[\s(.,;:/])_+(?=$|[\s),.;:/])|^\.{2,}$|^…+$/.test(nilai)) continue;
          if (S.susunan !== d || terisi(b)) return;
          konteksJejak.set(b.kode, { usulan: nilai, asal: "bawaan-abt", yakin: "", otomatis: true });
          try {
            await jadwalkanSimpan(b.kode, nilai, true);
          } finally {
            konteksJejak.delete(b.kode);
          }
        } catch {
          /* satu isian gagal: tetap kosong, tanpa mengganggu yang lain */
        }
      }
      if (S.susunan === d) renderIsian();
    } catch {
      /* tanpa penyimpanan otomatis: isian tetap kosong */
    }
  }
  /**
   * ELITIGASI-7139 (17 Okt): #7139# kosong diisi sendiri "1" (e-litigasi penuh: Tergugat/kuasanya ber-email) atau "2"
   * (hybrid: diunggah Panitera Sidang) menurut keputusan abt.js (el7Ambil7139, memakai kontak e-Court KONTAK-EC).
   * Isian manual menang: sudah terisi di ABT, diketik selagi menunggu, atau perkara berganti -> tidak ditulis.
   * Data tak cukup (verstek, belum disidang, bukan e-Court) -> dibiarkan kosong. Yang tersimpan hanya angka.
   */
  async function isiElitigasiOtomatis(d) {
    try {
      if (typeof el7Ambil7139 !== "function" || !S.pk || !bolehTulis()) return;
      if (!d.isian.some((b) => b.kode === "7139")) return;
      const ada = () => String(S.isi["7139"] || "").trim() || (S.nilai["7139"] && S.nilai["7139"].status === "terisi");
      if (ada()) return;
      const keputusan = await el7Ambil7139(nomorPerkara(), null);
      if (!keputusan) {
        // 19 Okt (isian 2): belum cukup pasti untuk ditulis (email Tergugat belum pasti, atau Tergugat belum/tidak hadir) -> SARAN dari
        // data e-Court/SIPP: perkara e-Court + Tergugat ber-email = penuh ("1"); perkara e-Court tanpa email Tergugat = hybrid ("2").
        const m = mesinIsi();
        const kontak = m && typeof el7AmbilKontak === "function" ? await el7AmbilKontak(nomorPerkara()) : null;
        const saran = m && kontak ? m.saranElitigasi(kontak) : null;
        if (saran && S.susunan === d && !ada() && !S.saranSipp["7139"]) {
          S.saranSipp["7139"] = { nilai: saran.nilai, keyakinan: "ragu", asal: "data e-Court dan SIPP" };
          S.el7Saran = saran;
          renderIsian();
        }
        return;
      }
      if (S.susunan !== d || ada()) return;
      S.el7 = keputusan;
      konteksJejak.set("7139", { usulan: String(keputusan.nilai), asal: "e-litigasi", yakin: "", otomatis: true });
      try {
        await jadwalkanSimpan("7139", keputusan.nilai, true);
      } finally {
        konteksJejak.delete("7139");
      }
      renderIsian();
    } catch {
      /* tanpa keputusan: isian tetap kosong */
    }
  }
  // ──────────────────────────────────────────────────────────────────────────
  // ISI OTOMATIS DARI SIPP (19 Okt 2026)
  // ──────────────────────────────────────────────────────────────────────────
  // Fitur "Isi dari SIPP & input ke ABT" (hakim) dan "(BAS)" (panitera) di abt.js hadir di sini untuk SEMUA jenis blangko
  // (putusan, penetapan, BAS, relaas, PTSP), otomatis dan manual, dengan mesin yang sama (isi-sipp-bersama.js: rute bot yang sama,
  // pembobotan yang sama). Aturannya:
  //   - isian kosong yang datanya ada di SIPP/gugatan/e-Court dengan keyakinan pasti atau cukup LANGSUNG TERISI dan tersimpan ke ABT
  //     lewat jalur simpan isian yang sama dengan ketikan petugas (jadwalkanSimpan -> simpanIsian -> klien ABT, penjaga kata ALETA ikut);
  //   - isian yang sudah ada isinya (diketik, tersimpan di ABT, atau dihitung ABT) TIDAK PERNAH ditimpa, sebelum maupun sesudah menunggu;
  //   - bacaan yang ragu atau hanya berupa pilihan menjadi saran samar (Tab), tidak ditulis sendiri;
  //   - huruf alasan perceraian (8503) dan uraian turunan keterangan saksi tidak ditulis sendiri (keputusan hakim);
  //   - saklar "Isi otomatis dari SIPP" (Alat saya, bawaan menyala) mengatur jalan otomatis; tombol "Isi dari SIPP" selalu bekerja.
  const mesinIsi = () => (typeof globalThis !== "undefined" && globalThis.AletaIsiSipp) || null;
  const KODE_KTP_TANGGAL = ["2222", "0364", "0365", "0366"];
  const sedangKosong = (b) => !terisi(b) && !String(S.isi[b.kode] || "").trim() && !S.diketik.has(b.kode);
  /** Catatan teknis hanya ke konsol (tidak tampil di layar petugas). */
  function catatTeknis(...bagian) {
    try {
      if (typeof console !== "undefined" && typeof console.info === "function") console.info("[Blangko Derry]", ...bagian);
    } catch {
      /* konsol tidak tersedia */
    }
  }
  /** Bukti KTP yang masih dapat diisi tanggalnya (baris terstruktur, jenis KTP, tanggal kosong). */
  const adaBuktiKtpKosong = () => ["P", "T"].some((w) => (S.bukti[w] || []).some((r) => typeof r.manual !== "string" && jenisBukti(r.nm) === "ktp" && !r.tgl));
  /** Tulis satu isian dari SIPP lewat jalur simpan yang sama dengan ketikan; gagal = isian dikembalikan seperti semula. */
  async function tulisIsianSipp(b, nilai, asal, yakin, ganti) {
    const sebelum = String(S.isi[b.kode] || "");
    // C1: tombol "Input ke ABT" / "Input semua yang pasti" menandai S.diketik lebih dulu = keputusan petugas (saran diterima);
    // selainnya ALETA menulis sendiri.
    konteksJejak.set(b.kode, { usulan: String(nilai), asal: String(asal || "isi-sipp"), yakin: String(yakin || ""), otomatis: !S.diketik.has(b.kode) });
    let ok = false;
    try {
      ok = await jadwalkanSimpan(b.kode, nilai, true);
    } finally {
      konteksJejak.delete(b.kode);
    }
    if (!ok) {
      // Penolakan (huruf di luar ABT, kata terlarang, ABT menolak): isian tetap seperti semula, bukan seolah-olah terisi.
      if (sebelum) S.isi[b.kode] = sebelum;
      else delete S.isi[b.kode];
      S.tersimpan[b.kode] = "";
      renderStatusIsian(b.kode);
      catatTeknis("isian", b.kode, "tidak tersimpan");
      return false;
    }
    S.dariSipp.add(b.kode);
    try {
      if (typeof catatRiwayat === "function") {
        void catatRiwayat({ perkaraId: perkaraId(), kode: b.kode, nama: b.nama, sebelum, sesudah: String(S.isi[b.kode] || nilai), cara: ganti ? `bawaan kueri ABT yang mentah diganti otomatis di Blangko Derry dari ${asal} (${yakin})` : `diisi otomatis di Blangko Derry dari ${asal} (${yakin})`, pada: new Date().toISOString(), tanpaJejak: true });
      }
    } catch {
      /* jejak tidak tersedia: isiannya tetap tersimpan di ABT */
    }
    return true;
  }
  /** Kode isian yang pernah disunting/diketik petugas menurut riwayat panel (bukan penulisan otomatis). */
  async function kodeBerjejakKetikan() {
    const hasil = new Set();
    try {
      if (typeof bacaRiwayat === "function") {
        for (const x of await bacaRiwayat(perkaraId())) {
          if (x && /diketik|disunting|dipulihkan|dikembalikan/i.test(String(x.cara || ""))) hasil.add(String(x.kode));
        }
      }
    } catch {
      /* riwayat tidak terbaca: hanya ketikan sesi ini yang dikenal */
    }
    return hasil;
  }
  /** Isian berisi bawaan kueri ABT yang jelas mentah dan belum pernah disentuh petugas: boleh diganti hasil mesin yang pasti/cukup. */
  const bolehGantiMentah = (b, jejak) => {
    const m = mesinIsi();
    const v = String(S.isi[b.kode] || "");
    return Boolean(m && v.trim() && !S.diketik.has(b.kode) && !jejak.has(b.kode) && m.jelasMentah(b.kode, v));
  };
  /**
   * Bahan untuk sumber saksi/posita (rute bot yang sama dengan panel ABT): posita (5125) dan keterangan dua saksi (2021/2022, dari
   * penyunting tanya-jawab ABT). Dibaca dari ABT, disinggahkan dua menit per perkara dan sidang.
   */
  async function bacaBahanSaksi(perluSaksi, paksa) {
    const kunci = `${perkaraId()}|${sidangUrutan()}|${perluSaksi ? 1 : 0}`;
    if (!paksa && S.bahanSaksi && S.bahanSaksi.kunci === kunci && Date.now() - S.bahanSaksi.saat < 120000) return S.bahanSaksi;
    const bahan = { kunci, saat: Date.now(), posita: "", teks1: "", teks2: "" };
    const m = mesinIsi();
    try {
      const r = await klienAbt().bacaIsian("5125", perkaraId(), "", sidangUrutan());
      if (r && r.ok) bahan.posita = m.htmlKeTeks(r.nilai).trim();
    } catch {
      /* posita tidak terbaca: sumber saksi tetap jalan tanpa posita */
    }
    if (perluSaksi && typeof teksSaksiMentah === "function") {
      const urutan = [...new Set([sidangUrutan(), ...(S.pk.sidang || []).map((s) => String(s.urutan)).filter((x) => Number(x) > 0), "1", "2", "3", "4", "5", "6"])].slice(0, 10);
      for (const [i, kode] of ["2021", "2022"].entries()) {
        for (const d of urutan) {
          try {
            const h = await klienAbt().bacaTanyaJawab({ kode, perkaraId: perkaraId(), sidang: d, a: S.blangko ? S.blangko.a : "", b: S.blangko ? S.blangko.b : "" });
            if (h && h.ok && Array.isArray(h.baris) && h.baris.some((r) => String((r && r.jawab) || "").trim())) {
              bahan[`teks${i + 1}`] = teksSaksiMentah(h.baris.map((r) => ({ jawaban: r.jawab })));
              break;
            }
          } catch {
            /* sidang itu tidak punya penyunting: coba berikutnya */
          }
        }
      }
    }
    S.bahanSaksi = bahan;
    return bahan;
  }
  /** Permintaan tambahan ke bot (saksi, posita itsbat, posita perkara lain) menurut jenis perkara dan isi blangko. */
  function susunTambahan(kodeAda, bahan, sb) {
    const m = mesinIsi();
    const hasil = [];
    const pk = (S.pk && S.pk.perkara) || {};
    const jenis = String(pk.jenisPerkara || (S.pk && S.pk.jenisPerkara) || "");
    const sd = S.pk && S.pk.sidangDipilih;
    const tanggalSidang = sd && sd.tanggal ? tglIndo(String(sd.tanggal).slice(0, 10)) : "";
    const perluAlasan = m.VAR_ALASAN_CERAI.some((k) => kodeAda.has(k));
    if (perluAlasan && (bahan.teks1.trim() || bahan.teks2.trim() || bahan.posita.trim())) {
      hasil.push({ sumber: "saksi", muatan: { saksi1: bahan.teks1, saksi2: bahan.teks2, tanggalSidang, pelaku: sb.T, lawan: sb.P, posita: bahan.posita } });
    }
    if (bahan.posita.trim() && /itsbat/i.test(jenis)) {
      hasil.push({ sumber: "itsbat", muatan: { posita: bahan.posita, pemohon: sb.P, pelaku: sb.T } });
    } else if (bahan.posita.trim() && !perluAlasan) {
      const idJenis = typeof idJenisPerkaraSipp === "function" ? idJenisPerkaraSipp(jenis) : jenis;
      const idAlur = typeof idAlurPerkaraSipp === "function" ? idAlurPerkaraSipp(nomorPerkara()) : pk.alurPerkaraId || "";
      hasil.push({ sumber: "posita-lain", muatan: { posita: bahan.posita, jenisPerkara: idJenis, alur: idAlur, pemohon: sb.P, pelaku: sb.T, lawan: sb.P } });
    }
    return hasil;
  }
  /**
   * Satu putaran isi dari SIPP untuk blangko yang terbuka. `otomatis: false` = tombol manual (melapor lewat toast).
   * Mengembalikan { ditulis, saran, sudahAda } atau null bila tidak berjalan.
   */
  async function isiDariSipp(opsi) {
    const o = opsi || {};
    const manual = o.otomatis !== true;
    const bacaSaja = o.bacaSaja === true;
    // senyap: ringkasan dilaporkan pemanggil (tombol "Isi otomatis" menggabung tiga langkah dalam satu pesan).
    const senyap = o.senyap === true;
    const lapor = (t) => {
      if (manual && !senyap) toast(t);
      return null;
    };
    const d = S.susunan;
    const mesin = mesinIsi();
    if (!S.pk || !S.blangko || !d) return lapor("Pilih perkara dan blangko dulu.");
    if (!bolehTulis()) return lapor(sebabTakTulis(`Akun ini tidak dapat menulis ${(NAMA_JENIS[S.blangko.jenis] || "blangko ini").toLowerCase()}; ${NAMA_PERAN[JENIS_PERAN[S.blangko.jenis]] || "pejabat perkara"} yang mengisinya.`));
    if (!mesin) return lapor("Pembaca SIPP belum termuat. Muat ulang halaman ABT.");
    if (S.isiSipp.jalan) {
      S.isiSipp.ulang = true;
      return lapor("Isian sedang dibaca dari SIPP; tunggu sebentar.");
    }
    S.isiSipp.jalan = true;
    const pk = S.pk;
    const ringkas = { ditulis: 0, saran: 0, sudahAda: 0 };
    try {
      if (S.janjiBukti) await Promise.resolve(S.janjiBukti).catch(() => undefined);
      if (S.susunan !== d || S.pk !== pk) return null;
      // 21 Okt: isian di dalam bagian otomatis (tidak ada di tabel ABT blangko ini) tetap ikut diisi seperti dulu.
      const perlu = () => daftarIsiOtomatis().filter((b) => (b.jenis === "teks" || b.jenis === "tanggal") && !b.khusus && b.kode);
      const kodeAda = new Set(perlu().map((b) => b.kode));
      const sb = sebutan();
      const bahan = await bacaBahanSaksi(mesin.VAR_ALASAN_CERAI.some((k) => kodeAda.has(k)), manual);
      if (S.susunan !== d || S.pk !== pk) return null;
      const bacaan = await mesin.kumpulkan({ ambil: ambilPortal, nomor: nomorPerkara(), kodeAda, pelaku: sb.T, lawan: sb.P, tambahan: susunTambahan(kodeAda, bahan, sb) });
      if (S.susunan !== d || S.pk !== pk) return null;
      for (const c of bacaan.catatan) catatTeknis("bacaan SIPP:", c);
      const jejak = await kodeBerjejakKetikan();
      const terapkan = async (usulanSumber) => {
        const usulan = mesin.pilihPerKode(usulanSumber, kodeAda);
        const daftar = perlu();
        const rencana = mesin.rencanakan(
          usulan,
          daftar.map((b) => ({ kode: b.kode, nama: b.nama, jenis: b.jenis, opsi: b.opsi, kosong: sedangKosong(b), bolehGanti: bolehGantiMentah(b, jejak), manual: b.manual === true, alasanManual: b.alasanManual || "" })),
          keIso,
          usulanSumber
        );
        for (const [kode, info] of Object.entries(rencana.info)) {
          // Tanda "diisi manual" tidak menimpa bacaan atau alasan yang sudah ada dari putaran sebelumnya (mis. KTP datang belakangan).
          // Juga tidak dipasang bila isian itu sudah punya saran (bawaan ABT dari data perkara, draf H-7, bacaan samar): bukan "tanpa sumber".
          if (info.golongan === "manual" && (S.info[kode] || (S.saran && S.saran[kode]) || (S.saranH7 && S.saranH7[kode]) || (S.saranSipp && S.saranSipp[kode]))) continue;
          S.info[kode] = info;
          if (info.pilihan && info.pilihan.length) S.bunyi[kode] = info.pilihan;
        }
        for (const r of rencana.tulis) {
          if (S.susunan !== d || S.pk !== pk) return;
          const b = daftar.find((x) => x.kode === r.kode);
          if (bacaSaja) {
            // Saklar mati: yang pasti/cukup pun hanya menjadi saran (dan calon tombol Input ke ABT).
            if (b && !r.ganti && sedangKosong(b) && !(S.saranH7 && S.saranH7[r.kode])) {
              if (!S.saranSipp[r.kode]) ringkas.saran += 1;
              S.saranSipp[r.kode] = { nilai: r.nilai, keyakinan: r.keyakinan, asal: r.asal };
            }
            continue;
          }
          // Diisi/disunting petugas selagi menunggu: ketikan menang. Nilai mentah yang diganti harus masih nilai mentah yang sama.
          if (!b || (!sedangKosong(b) && !(r.ganti && bolehGantiMentah(b, jejak)))) {
            ringkas.sudahAda += 1;
            continue;
          }
          if (await tulisIsianSipp(b, r.nilai, r.asal, r.keyakinan, r.ganti)) ringkas.ditulis += 1;
        }
        for (const r of rencana.saran) {
          const b = daftar.find((x) => x.kode === r.kode);
          if (!b || (S.saranH7 && S.saranH7[r.kode])) continue;
          if (!S.saranSipp[r.kode]) ringkas.saran += 1;
          S.saranSipp[r.kode] = { nilai: r.nilai, keyakinan: r.keyakinan, asal: r.asal };
        }
        ringkas.sudahAda += rencana.lewati.filter((x) => x.sebab === "sudah ada isinya").length;
      };
      await terapkan(bacaan.usulan);
      if (S.susunan !== d || S.pk !== pk) return null;
      renderIsian();
      laporKeKerangka();
      // Tanggal KTP dibaca dari berkas KTP e-Court (menunggu pemindaian): sesudah isian lain, tidak menahannya.
      const adaTanggalKtp = KODE_KTP_TANGGAL.some((k) => kodeAda.has(k));
      if (adaTanggalKtp || adaBuktiKtpKosong()) {
        const ktp = await mesin.kumpulkan({ ambil: ambilPortal, nomor: nomorPerkara(), kodeAda: adaTanggalKtp ? kodeAda : new Set(), ktp: true, hanyaKtp: true, batasKtpMs: BATAS_LAMA_MS });
        if (S.susunan !== d || S.pk !== pk) return null;
        for (const c of ktp.catatan) catatTeknis("bacaan SIPP:", c);
        if (adaTanggalKtp) await terapkan(ktp.usulan);
        if (S.susunan !== d || S.pk !== pk) return null;
        ringkas.ditulis += isiTanggalKtpBukti(ktp.pihakKtp);
      }
      if (S.susunan !== d || S.pk !== pk) return null;
      renderIsian();
      laporKeKerangka();
      // Tgl Nikah dari bukti P (akta nikah): hanya SARAN - tanggal akta tidak selalu tanggal nikah.
      ringkas.saran += saranTanggalNikahDariBukti(perlu());
      ringkas.saran += await saranDariIsianPerkara(perlu());
      if (S.susunan !== d || S.pk !== pk) return null;
      ringkas.saran += await saranDariPerkaraSerupa(perlu());
      if (S.susunan !== d || S.pk !== pk) return null;
      await muatBelajarHuruf();
      if (S.susunan !== d || S.pk !== pk) return null;
      await muatIsianSidang();
      if (S.susunan !== d || S.pk !== pk) return null;
      renderIsian();
      S.isiSipp.hasil = { ...ringkas, saat: Date.now() };
      if (manual && !senyap) {
        toast(
          ringkas.ditulis
            ? `${ringkas.ditulis} isian diisi dari SIPP dan tersimpan ke ABT.${ringkas.saran ? ` ${ringkas.saran} lainnya diberi saran samar (tekan Tab untuk memakainya).` : ""}`
            : ringkas.saran
              ? `Tidak ada isian yang pasti; ${ringkas.saran} diberi saran samar (tekan Tab untuk memakainya).`
              : ringkas.sudahAda
                ? "Semua isian yang datanya ada di SIPP sudah terisi."
                : "Belum ada isian kosong yang datanya ditemukan di SIPP."
        );
      }
      return ringkas;
    } catch (e) {
      catatTeknis("isi dari SIPP gagal:", String((e && e.message) || e));
      return lapor(`Isi otomatis belum berhasil: ${String((e && e.message) || e)}`);
    } finally {
      S.isiSipp.jalan = false;
      if (S.isiSipp.ulang) {
        S.isiSipp.ulang = false;
        if (S.susunan === d && cfg().isiOto !== false && !manual) void isiDariSipp({ otomatis: true });
      }
    }
  }
  const tglNikahTampil = (iso) => {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m && BULAN[+m[2] - 1] ? `${m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : "";
  };
  const POLA_BUKTI_AKTA_NIKAH = /akta\s+nikah|buku\s+nikah|kutipan\s+akta\s+(?:perkawinan|nikah)/i;
  /**
   * Tgl Nikah (5197) kosong: tanggal pada bukti P "Kutipan Akta Nikah" dijadikan SARAN (bukan tulisan). Tanggal akta dapat berbeda dari
   * tanggal nikah, jadi tidak pernah ditulis sendiri; sumber yang lebih pasti (data pernikahan SIPP, posita) sudah ditulis lebih dulu
   * oleh mesin dan membuat kotak ini tidak lagi kosong. Mengembalikan 1 bila saran baru dipasang.
   */
  function saranTanggalNikahDariBukti(daftar) {
    const b = (daftar || []).find((x) => x.kode === "5197" && x.jenis === "teks");
    if (!b || !sedangKosong(b) || (S.saranSipp["5197"] && S.saranSipp["5197"].nilai) || (S.saranH7 && S.saranH7["5197"])) return 0;
    for (const r of S.bukti.P || []) {
      let iso = "";
      if (typeof r.manual === "string") {
        const k = POLA_BUKTI_AKTA_NIKAH.test(r.manual) ? r.manual.match(/(?:ter)?tanggal\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i) : null;
        iso = k ? keIso(k[1]) : "";
      } else if (POLA_BUKTI_AKTA_NIKAH.test(String(r.nm || ""))) iso = r.tgl || keIso(r.tglTeks || "");
      const nilai = tglNikahTampil(iso);
      if (nilai) {
        S.saranSipp["5197"] = { nilai, keyakinan: "ragu", asal: "bukti akta nikah" };
        return 1;
      }
    }
    return 0;
  }
  /**
   * Tanggal KTP pada bukti terstruktur: hanya baris KTP yang tanggalnya KOSONG diisi (tidak menimpa). Menyimpan lewat jalur bukti yang sama.
   * Mengembalikan banyaknya tanggal yang diisi.
   */
  function isiTanggalKtpBukti(pihak) {
    let n = 0;
    const daftar = Array.isArray(pihak) ? pihak : [];
    for (const w of ["P", "T"]) {
      const rows = S.bukti[w];
      if (!rows) continue;
      const calon = daftar
        .filter((p) => Number(p.cabang) === (w === "P" ? 1 : 2) && p.tanggalKtp && String(p.yakin || "") !== "ragu")
        .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
      let j = 0;
      let ubah = false;
      for (const r of rows) {
        if (typeof r.manual === "string" || jenisBukti(r.nm) !== "ktp") continue;
        const c = calon[j++];
        if (!c) break;
        const iso = keIso(c.tanggalKtp);
        if (!iso || r.tgl) continue;
        r.tgl = iso;
        delete r.tglTeks;
        n += 1;
        ubah = true;
      }
      if (ubah) simpanBukti(w, true);
    }
    return n;
  }
  /**
   * Orkestrasi isi otomatis begitu susunan blangko terbaca (dan tombol manual): bawaan ABT itsbat dan e-litigasi 7139 (selalu jalan,
   * fitur lama), lalu bacaan SIPP/gugatan/e-Court (hanya bila saklar menyala). `manual: true` = tombol "Isi dari SIPP" (selalu jalan,
   * tidak bergantung saklar, dan melapor).
   * `sidang: true` = ganti sidang (yang berlaku per perkara tidak diulang dari awal).
   */
  async function isiOtomatisBlangko(d, opsi) {
    const o = opsi || {};
    try {
      if (!S.pk || !S.blangko || S.susunan !== d) return null;
      if (!bolehTulis()) {
        if (o.manual) await isiDariSipp({ otomatis: false });
        return null;
      }
      // Fitur lama TETAP jalan walau saklar mati (keputusan pengguna 19 Okt): bawaan ABT itsbat dan e-litigasi 7139.
      if (!o.sidang) {
        await simpanBawaanAbtItsbat(d);
        await isiElitigasiOtomatis(d);
        await rapikanPositaOtomatis(d);
      }
      // Saklar "Isi otomatis dari SIPP" hanya mengatur pengisian BARU dari mesin bersama. Saklar mati: bacaan SIPP tetap dianalisis untuk
      // lencana, sumber, dan tombol Input ke ABT, tetapi TIDAK ada yang ditulis sendiri.
      return await isiDariSipp({ otomatis: !o.manual, bacaSaja: !o.manual && cfg().isiOto === false, senyap: o.senyap === true });
    } catch (e) {
      catatTeknis("isi otomatis gagal:", String((e && e.message) || e));
      return null;
    }
  }
  /**
   * Tombol "Isi otomatis" (menggantikan deret "Isi dari SIPP", "Isi dari gugatan (posita)" dan "Ambil tanggal KTP dari bukti"):
   * satu tekan menjalankan ketiganya berurutan - (1) bacaan SIPP, gugatan, e-Court dan KTP ke isian kosong, (2) saran dari
   * gugatan/posita untuk kotak yang masih kosong, (3) tanggal KTP pada bukti (sudah termasuk langkah 1, tidak menimpa tanggal yang
   * ada). Isian yang sudah ada isinya tidak ditimpa. Tetap berjalan sendiri saat saklar "Isi otomatis dari SIPP" menyala
   * (isiOtomatisBlangko); tombol ini untuk menjalankannya sesuai kemauan petugas.
   */
  async function isiSemuaOtomatis() {
    const d = S.susunan;
    if (!S.pk || !S.blangko || !d) return toast("Pilih perkara dan blangko dulu.");
    const r = await isiOtomatisBlangko(d, { manual: true, senyap: true });
    if (S.susunan !== d) return undefined;
    const dariSaran = bolehTulis() && S.blangko.jenis !== "rel" ? pakaiSemuaSaran({ senyap: true }) : 0;
    renderIsian();
    laporKeKerangka();
    const ditulis = (r ? r.ditulis : 0) + dariSaran;
    const saran = r ? r.saran : 0;
    return toast(
      ditulis
        ? `${ditulis} isian diisi dan tersimpan ke ABT. Periksa sebelum cetak.${saran ? ` ${saran} lainnya hanya saran samar (tekan Tab untuk memakainya).` : ""}`
        : saran
          ? `Tidak ada isian yang pasti; ${saran} diberi saran samar (tekan Tab untuk memakainya).`
          : r && r.sudahAda
            ? "Semua isian yang datanya ada sudah terisi."
            : "Belum ada isian kosong yang datanya ditemukan."
    );
  }
  /**
   * JJ2-TANYAJAWAB (18 Okt 2026, keputusan 74): JAWABAN / REPLIK / DUPLIK TERTULIS dari e-Court ditulis OTOMATIS ke penyunting
   * tanya-jawab ABT (6112 Jawaban Lisan, 6113 Replik Lisan, 6114 Duplik Lisan; 2018-2020 membaca baris yang sama) BILA berkasnya
   * "rapi" (ukuran dihitung bot: tanyaJawabEcourtService - kop, tanda tangan, nomor halaman, karakter rusak, struktur dalil,
   * panjang) dan sidang yang dipilih adalah sidang yang agendanya sesuai. Aturan yang dijaga:
   *   - baris tanya-jawab yang sudah ada TIDAK PERNAH ditimpa atau dihapus: ditulis hanya bila bacaan ABT sukses DAN kosong
   *     (tanya maupun jawab), dan tidak ada ketikan petugas yang belum disimpan di penyunting; bacaan gagal = tidak menulis;
   *   - satu kali per (perkara, variabel, sidang): sesudah ditulis, penanda disimpan di peramban supaya baris yang kemudian
   *     dihapus petugas tidak diisi lagi, dan menjalankannya dua kali tidak menggandakan baris;
   *   - sidang tujuan = sidang PERTAMA yang agendanya memuat peran itu pada/sesudah tanggal unggah berkas (agenda "jawab
   *     menjawab" berlaku untuk ketiganya); tanpa tanggal unggah hanya bila satu-satunya sidang beragenda itu;
   *   - tidak rapi -> tidak ditulis; penyunting menampilkan "Format berkas tidak rapi, silakan salin dan periksa" + tombol Salin;
   *   - saklar "Tanya-jawab jawab-menjawab otomatis" (bawaan NYALA) dapat dimatikan di Widget/popup; huruf di luar latin1 ditolak.
   */
  // Kunci pencarian pasangan tanya jawab ("<peran> lisan <pihak>"), bukan teks tampil; dibangun dari bagian-bagiannya supaya tidak ada literal berkode di sumber.
  const kunciJawabMenjawab = (peran, pihak) => `${peran} lisan ${pihak}`;
  const TJ_JAWAB_MENJAWAB = Object.freeze({
    [kunciJawabMenjawab("jawaban", "0047")]: Object.freeze({ peran: "jawaban", kode: "6112" }),
    [kunciJawabMenjawab("replik", "0046")]: Object.freeze({ peran: "replik", kode: "6113" }),
    [kunciJawabMenjawab("duplik", "0047")]: Object.freeze({ peran: "duplik", kode: "6114" }),
  });
  const API_ISI_GUGATAN_JM = "/aleta/api/aleta-ecourt/isi-gugatan";
  const jmSedangDitulis = new Set();
  /**
   * G2 (25 Okt 2026): penyunting tanya-jawab KESIMPULAN. Kodenya TIDAK ditulis di sini: dicari dari daftar variabel blangko (kunci
   * "kesimpulan lisan <0046|0047>" - kunci yang disusun portal dari nama variabel tanya-jawab ABT). Blangko tanpa variabel itu = tidak ada
   * yang ditulis. Enam variabel tetap (6112-6114) tidak berubah.
   */
  const POLA_KUNCI_KESIMPULAN = /^kesimpulan\b.*\b(0046|0047)\b/;
  function infoTjJm(b) {
    if (!b || b.jenis !== "tj" || !b.tj) return null;
    const tetap = TJ_JAWAB_MENJAWAB[b.tj.kunci];
    if (tetap) return b.tj.kodeSunting === tetap.kode ? tetap : null;
    const m = POLA_KUNCI_KESIMPULAN.exec(String(b.tj.kunci || ""));
    return m && b.tj.kodeSunting ? { peran: "kesimpulan", kode: b.tj.kodeSunting, pihak: m[1] } : null;
  }
  function agendaMemuatPeran(peran, agenda) {
    const t = String(agenda || "").toLowerCase();
    if (!t) return false;
    // G2: kesimpulan punya agendanya sendiri; "jawab menjawab" bukan agenda kesimpulan.
    if (peran === "kesimpulan") return /\bkesimpulan\b/.test(t);
    if (/jawab[\s-]*menjawab/.test(t)) return true;
    if (peran === "jawaban") return /\bjawab(?:an)?\b/.test(t);
    if (peran === "replik") return /\breplik\b/.test(t);
    if (peran === "duplik") return /\bduplik\b/.test(t);
    return false;
  }
  /** Sidang tujuan berkas jawab-menjawab: pertama yang agendanya memuat perannya pada/sesudah tanggal unggah; null bila tidak pasti. */
  function sidangTujuanJm(peran, diunggah, sidang) {
    const cocok = (Array.isArray(sidang) ? sidang : []).filter((s) => s && /^\d{4}-\d{2}-\d{2}/.test(String(s.tanggal || "")) && agendaMemuatPeran(peran, s.agenda));
    if (!cocok.length) return null;
    const unggah = /^\d{4}-\d{2}-\d{2}$/.test(String(diunggah || "")) ? String(diunggah) : "";
    if (!unggah) return cocok.length === 1 ? cocok[0] : null;
    const urut = cocok.slice().sort((x, y) => String(x.tanggal).localeCompare(String(y.tanggal)) || (Number(x.urutan) || 0) - (Number(y.urutan) || 0));
    return urut.find((s) => String(s.tanggal).slice(0, 10) >= unggah) || null;
  }
  function sidangSamaJm(a, b) {
    if (!a || !b) return false;
    if (a.sidangId && b.sidangId) return String(a.sidangId) === String(b.sidangId);
    return String(a.tanggal).slice(0, 10) === String(b.tanggal).slice(0, 10) && Number(a.urutan) === Number(b.urutan);
  }
  function salinTeksJm(teks) {
    try {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(teks).then(() => true, () => false);
    } catch {
      /* jatuh ke cara lama */
    }
    const kotak = document.createElement("textarea");
    kotak.value = teks;
    kotak.setAttribute("readonly", "");
    kotak.style.position = "fixed";
    kotak.style.opacity = "0";
    document.body.appendChild(kotak);
    kotak.select();
    let berhasil = false;
    try {
      berhasil = document.execCommand("copy");
    } catch {
      berhasil = false;
    }
    kotak.remove();
    return Promise.resolve(berhasil);
  }
  async function isiJawabMenjawabOtomatis(d) {
    try {
      S.tjOto = {};
      if (!S.pk || !S.blangko || !bolehTulis() || cfg().tjJawab === false) return;
      // Penyunting harus tepat variabelnya (6112/6113/6114): kode lain tidak ditulis.
      const butir = d.isian.filter((b) => infoTjJm(b));
      if (!butir.length) return;
      const pilih = S.pk.sidangDipilih;
      if (!pilih || !(Number(pilih.urutan) > 0)) return;
      // Hemat bacaan: sidang yang agendanya tidak menyebut jawaban/replik/duplik (atau jawab-menjawab) bukan tujuan berkas mana pun.
      if (!butir.some((b) => agendaMemuatPeran(infoTjJm(b).peran, pilih.agenda))) return;
      const sb = sebutan();
      const q = new URLSearchParams({ nomor: nomorPerkara(), lawan: sb.P, pelaku: sb.T });
      const isi = await ambilPortal(`${API_ISI_GUGATAN_JM}?${q.toString()}`, {}, "Membaca jawab-menjawab dari e-Court");
      if (S.susunan !== d || !S.pk || S.pk.sidangDipilih !== pilih) return;
      const daftarTj = Array.isArray(isi && isi.tanyaJawab) ? isi.tanyaJawab : [];
      const kalimat = Array.isArray(isi && isi.kalimat) ? isi.kalimat : [];
      S.tjOto = S.tjOto || {};
      for (const b of butir) {
        const info = infoTjJm(b);
        const kunci = b.tj.kunci;
        // G2: kesimpulan dicocokkan menurut peran + pihak, dan hanya bila Super Admin mengizinkan (izinOtomatis); 6112-6114 menurut kode.
        const calon = daftarTj.filter((t) => t && (info.peran === "kesimpulan" ? t.peran === "kesimpulan" && t.pihak === info.pihak && t.izinOtomatis === true : t.kode === info.kode));
        if (!calon.length) continue;
        const t = calon.length === 1 ? calon[0] : null;
        const sasaran = sidangTujuanJm(info.peran, t ? t.diunggah : "", S.pk.sidang);
        if (!t || !sasaran || !sidangSamaJm(sasaran, pilih)) {
          // Lebih dari satu berkas untuk peran yang sama: tidak jelas yang dipakai - hanya diberi tahu pada sidang yang agendanya cocok.
          if (!t && agendaMemuatPeran(info.peran, pilih.agenda)) S.tjOto[kunci] = { status: "salin", pesan: "Ada lebih dari satu berkas untuk bagian ini di e-Court - format tidak dapat dipastikan, silakan salin dan periksa.", teks: "" };
          continue;
        }
        const sal = kalimat.find((k) => k && k.kode === `jawab-tertulis-${t.peran}-${t.pihak || "x"}`);
        if (!t.rapi || !Array.isArray(t.baris) || !t.baris.length) {
          S.tjOto[kunci] = { status: "salin", pesan: "Format berkas tidak rapi, silakan salin dan periksa.", teks: sal ? String(sal.teks || "") : "" };
          continue;
        }
        const sidangKe = sidangUrutan();
        const tanda = `bdTjOto:${perkaraId()}:${info.kode}:${sidangKe}`;
        if (jmSedangDitulis.has(tanda)) continue;
        const muatan = t.baris.map((r) => ({ tanya: String((r && r.tanya) || ""), jawab: String((r && r.jawab) || "") }));
        if (hurufDiLuarAbt(muatan.map((r) => `${r.tanya} ${r.jawab}`).join(" ")).length) {
          S.tjOto[kunci] = { status: "salin", pesan: "Format berkas tidak rapi (ada huruf yang tidak dapat disimpan ABT), silakan salin dan periksa.", teks: sal ? String(sal.teks || "") : "" };
          continue;
        }
        const sudah = (await bacaPenyimpanan(tanda))[tanda];
        if (sudah) continue;
        // Ketikan petugas yang belum disimpan di penyunting menang.
        if (S.tj[kunci] && S.tj[kunci].berubah) continue;
        jmSedangDitulis.add(tanda);
        try {
          const k = klienAbt();
          const h = await k.bacaTanyaJawab({ kode: info.kode, perkaraId: perkaraId(), sidang: sidangKe, a: S.blangko.a, b: S.blangko.b });
          if (!h || !h.ok) continue; // bacaan gagal = tidak menulis (menyimpan menghapus dulu seluruh baris sidang itu)
          const ada = (Array.isArray(h.baris) ? h.baris : []).some((r) => String((r && r.tanya) || "").trim() || String((r && r.jawab) || "").trim());
          if (ada) continue; // baris yang sudah ada tidak disentuh
          if (S.susunan !== d || !S.pk || S.pk.sidangDipilih !== pilih || (S.tj[kunci] && S.tj[kunci].berubah)) continue;
          const hasil = await k.simpanTanyaJawab({ kode: info.kode, perkaraId: perkaraId(), sidang: sidangKe, baris: muatan.map((r, i) => ({ no: String(i + 1), tanya: r.tanya, jawab: r.jawab })), a: S.blangko.a, b: S.blangko.b });
          if (!hasil || !hasil.ok) {
            S.tjOto[kunci] = { status: "salin", pesan: "Penulisan otomatis ke ABT tidak berhasil, silakan salin dan periksa.", teks: sal ? String(sal.teks || "") : "" };
            continue;
          }
          void tulisPenyimpanan({ [tanda]: { saat: Date.now(), baris: muatan.length } });
          const jam = jamSekarang();
          S.tjOto[kunci] = { status: "ditulis", pesan: `Ditulis otomatis dari berkas e-Court (${muatan.length} baris) pukul ${jam}. Periksa sebelum dipakai.` };
          S.nilai[b.kode] = { status: "terisi", teks: "" };
          S.nilai[b.tj.kodeSunting] = { status: "terisi", teks: "" };
          tandaiKotor();
          if (S.tj[kunci] && S.tj[kunci].dimuat) await muatTj(kunci, true);
          toast(`${b.tj.sebutan}: ${muatan.length} baris tanya-jawab ditulis otomatis dari berkas e-Court. Periksa dulu.`);
        } finally {
          // Kunci tetap dipasang bila berhasil (penanda penyimpanan menjaga antar-sesi); dilepas bila gagal supaya dapat dicoba lagi.
          if (!S.tjOto[kunci] || S.tjOto[kunci].status !== "ditulis") jmSedangDitulis.delete(tanda);
        }
      }
      renderTj();
    } catch {
      /* tanpa penulisan otomatis: penyunting dan tombol Salin tetap seperti semula */
    }
  }
  // F4.2: saran draf H-7 (agen ALETA) didahulukan - nilainya dari deteksi yang sama dengan panel ABT, tetap hanya SARAN.
  /**
   * Saran untuk isian kosong: draf H-7, lalu hasil mesin SIPP/saksi (didahulukan), lalu bawaan kueri popup ABT. HTML dibuang; bawaan popup
   * yang jelas mentah (potongan posita panjang, bertag) tidak disarankan sama sekali.
   */
  /** Saran + PENGISINYA (draf-h7 / isi-sipp / bawaan-abt) untuk jejak isian (C1); saranUntuk memakai nilainya. */
  const saranDetail = (b, opsi) => {
    const m = mesinIsi();
    const bersih = (v) => (m ? m.bersihkanNilai(b.kode, v) : String(v || ""));
    const h7 = S.saranH7 && S.saranH7[b.kode] ? S.saranH7[b.kode].nilai : "";
    const sipp = S.saranSipp[b.kode] && b.jenis !== "tanggal" ? S.saranSipp[b.kode].nilai : "";
    const popup = S.saran[b.kode] && !(m && m.jelasMentah(b.kode, S.saran[b.kode])) ? S.saran[b.kode] : "";
    // 19 Okt (isian 2): saran harus sesuai MAKNA isiannya - kalimat ghaib di "Awal perselisihan" atau potongan posita di "KUA" tidak
    // pernah ditawarkan; lebih baik kotak kosong daripada saran yang salah.
    const sesuai = (v) => !m || m.sahBentuk(b.kode, v, b.nama);
    const calon = [
      [h7, "draf-h7", ""],
      [sipp, "isi-sipp", S.saranSipp[b.kode] ? String(S.saranSipp[b.kode].keyakinan || "") : ""],
      [popup, "bawaan-abt", ""],
    ]
      .map(([v, asal, yakin]) => ({ nilai: bersih(v).trim(), asal, yakin }))
      .filter((c) => c.nilai && sesuai(c.nilai))
      .map((c) => ({ ...c, nilai: m ? m.rapikanBentuk(b.kode, c.nilai, b.nama) : c.nilai }));
    if (calon.length) return calon[0];
    // Contoh umum per isian ("belum dikaruniai anak", tanggal pengumuman contoh): hanya samar di kotak, TIDAK untuk pengisian massal.
    return { nilai: opsi && opsi.tanpaUmum ? "" : bersih(b.saran || ""), asal: "", yakin: "" };
  };
  const saranUntuk = (b, opsi) => saranDetail(b, opsi).nilai;
  /**
   * Huruf alasan A-H dari isian 8503, dibaca seperti kueri ABT (REPLACE 'DAN', '&', ',', spasi, '+', '/', '.', '-' lalu INSTR
   * per huruf; FASAKH/MURTAD = H) tanpa mengarang: "F dan B" = BF, "Murtad" = H. Bentuk pilihan ALETA "F · uraian"
   * dibaca hurufnya saja. Teks bebas ("huruf F") TIDAK dikenal -> "" (jangan menebak huruf dari kata-katanya).
   * Sama dengan hurufAlasan di portal (lib/set-pertanyaan-saksi.ts).
   */
  function hurufAlasanDari(teks) {
    const v = String(teks == null ? "" : teks).trim();
    const depan = v.match(/^([A-Ha-h]+)\s*·/);
    const u = v.toUpperCase();
    const n = depan ? depan[1].toUpperCase() : /^(FASAKH|MURTAD)$/.test(u) ? "H" : u.replace(/DAN/g, "").replace(/[&,;+/.\s-]/g, "");
    if (!/^[A-H]+$/.test(n)) return "";
    return [...new Set(n.split(""))].sort().join("");
  }
  /**
   * Nilai 8503 yang DITULIS ke ABT: pilihan ALETA "F · uraian" -> "F" (hurufnya saja, bentuk yang dibaca kueri ABT dan
   * popup aslinya); ketikan lain (BF, F dan B, Murtad, teks bebas) tidak diubah. Tampilan pilihan tidak berubah.
   */
  function nilaiSimpan8503(teks) {
    const v = String(teks == null ? "" : teks);
    const depan = v.trim().match(/^([A-Ha-h]+)\s*·/);
    return depan ? depan[1].toUpperCase() : v;
  }
  const alasanHuruf = () => hurufAlasanDari(S.isi["8503"]);
  /** Peringatan di bawah kotak 8503 bila isinya tidak terbaca sebagai huruf alasan (ABT tidak akan mengenalinya). */
  const peringatan8503 = () => {
    const v = String(S.isi["8503"] || "").trim();
    // 21 Okt (temuan pengguna): tanpa alasan tersimpan, pertimbangan alasan perceraian di tabel ABT berbunyi "TIDAK BENAR QUERY NYA".
    if (!v) return "Alasan perceraian belum dipilih. Selama belum disimpan, bagian pertimbangan alasan perceraian di ABT berbunyi \"TIDAK BENAR QUERY NYA\" dan ikut tercetak.";
    return !alasanHuruf() ? `ABT tidak mengenali "${v}" sebagai huruf alasan - tulis hurufnya saja, rapat, mis. F, BF, ABF (atau Murtad untuk H).` : "";
  };
  function perbaruiPeringatan8503() {
    const e = cari('[data-peringatan="8503"]', wadah.isian);
    if (!e) return;
    const t = peringatan8503();
    e.textContent = t;
    e.hidden = !t;
  }
  /**
   * Pemicu menyala? Pemicu alasan C/H mengikuti isi 8503 yang sedang tampil (diketik maupun tersimpan) - nilai pemicu
   * yang dibaca dari ABT sebelumnya basi begitu 8503 berubah, jadi hanya dipakai bila 8503 belum terisi. Pemicu lain
   * dari nilai ABT (teks tidak kosong).
   */
  function pemicuMenyala(kode) {
    const v = S.nilai[kode];
    const dariAbt = Boolean(v && String(v.teks || "").trim());
    if (kode === "11116" || kode === "11117") {
      if (String(S.isi["8503"] || "").trim()) return alasanHuruf().includes(kode === "11116" ? "C" : "H");
    }
    return dariAbt;
  }
  function keteranganPemicu(kode) {
    const p = S.susunan && S.susunan.pemicu.find((x) => x.kode === kode);
    return p ? p.keterangan : "penanda keadaan perkara menyala";
  }
  /** Keterangan keadaan untuk layar (sama dengan KEADAAN_TEKS di susun.ts portal). */
  const KEADAAN_TEKS = {
    kuasaP: "Penggugat/Pemohon memakai kuasa hukum",
    kuasaT: "Tergugat/Termohon memakai kuasa hukum",
    prodeo: "perkara ini prodeo",
    alasanC: "alasan perceraian huruf C dipilih",
    alasanH: "alasan perceraian huruf H dipilih",
    ghaib: "Tergugat/Termohon dipanggil secara ghaib",
    ecourt: "perkara ini terdaftar lewat e-Court",
    insidentil: "ada kuasa insidentil",
  };
  const perkaraSipp = () => (S.pk && S.pk.perkara) || null;
  const terisi = (b) => Boolean(String(S.isi[b.kode] || "").trim()) || Boolean(S.nilai[b.kode] && S.nilai[b.kode].status === "terisi" && String(S.nilai[b.kode].teks || "").trim());
  /**
   * Isian berlaku untuk perkara ini? Aturannya mengikuti cara blangko ABT memakai variabel pemicu:
   *   kuasa P/T, prodeo, alasan C/H -> pemicu ABT (#11111#, #11113#, #11112#, #11116#, #11117#) yang dihitung
   *     mesin variabel ABT dari SIPP (kuasa: perkara_pengacara aktif; prodeo: perkara.prodeo; C/H: huruf 8503);
   *     prodeo juga dari data perkara SIPP di daftar perkara;
   *   ghaib  -> perkara ghaib menurut SIPP (daftar perkara: relaas pengumuman/alamat tidak diketahui);
   *   e-Court -> perkara terdaftar lewat e-Court (tidak diketahui = tetap tampil);
   *   kuasa insidentil -> hanya bila isiannya tertulis langsung di blangko ini atau sudah terisi.
   * Susunan lama tanpa "keadaan" tetap memakai pemicu saja.
   */
  function keadaanBerlakuMurni(b, ctx) {
    const k = b.keadaan || "";
    const p = ctx.perkara || null;
    const terisi = ctx.terisi;
    if (b.pemicu && ctx.menyala(b.pemicu)) return true;
    if (k === "prodeo" && p && p.prodeo === true) return true;
    if (b.pemicu) return false;
    if (!k) return true;
    if (k === "ghaib") return Boolean(p && p.ghaib === true);
    if (k === "ecourt") return !p || p.lewatEcourt !== false;
    if (k === "insidentil") return Boolean(b.langsung) || terisi(b);
    // I7 18 Okt (revisi): isian 9430 (KUA tempat perkawinan) tidak dipakai lagi; keadaan "kuaKosong" dihapus bersama amar kirim salinan ke Pegawai Pencatat Nikah.
    if (k === "kuasaP" || k === "kuasaT" || k === "prodeo" || k === "alasanC" || k === "alasanH") return terisi(b);
    return true;
  }
  const keadaanBerlaku = (b) => keadaanBerlakuMurni(b, { perkara: perkaraSipp(), menyala: pemicuMenyala, terisi, nilai: S.nilai });
  const keteranganKeadaan = (b) => (b.keadaan && KEADAAN_TEKS[b.keadaan]) || (b.pemicu ? keteranganPemicu(b.pemicu).replace(/ \(terbaca dari SIPP\)/, "") : "");
  // 20 Okt: isian OPSIONAL (mis. #9134 petunjuk perbaikan permohonan dari majelis) tidak ikut "Perlu diisi N dari M";
  // tampil di bagian tertutup "Isian tambahan (bila ada)". Penandanya `opsional: true` dari portal; #9134 juga dikenali langsung.
  const TP = () => (typeof globalThis !== "undefined" && globalThis.AletaBdSaksiTampil) || null;
  const isianOpsional = (b) => (TP() ? TP().opsional(b) : false);

  // ──────────────────────────────────────────────────────────────────────────
  // 21 Okt (temuan pengguna): daftar isian = TABEL VARIABEL ABT lama untuk blangko yang sama, dan tuntutan yang tidak diminta
  // posita/petitum tidak tampil.
  //   - Isian yang tertulis LANGSUNG di blangko (baris tabel ABT): aturan lama (keadaan kuasa/ghaib/prodeo/e-Court, opsional).
  //   - Isian yang hanya dibaca bagian otomatis (tidak ada di tabel ABT blangko ini):
  //       * isian tuntutan akibat perceraian (nafkah iddah, mut'ah, madliyah, nafkah anak, hak asuh, harta bersama) tampil di
  //         daftar utama HANYA bila tuntutannya diminta petitum (pemicu ABT 4140-4145), ditetapkan hakim karena jabatan,
  //         keputusan majelisnya sudah dipilih, atau isiannya sudah berisi; selain itu masuk "Tuntutan yang tidak diminta";
  //       * isian lain masuk bagian tertutup "Isian di dalam bagian otomatis" (tetap dapat diisi, ikut isi otomatis).
  // ──────────────────────────────────────────────────────────────────────────
  // 21 Okt (perbaikan w25): nilai yang dibaca dari jendela ABT BUKAN selalu isian petugas - ABT mengembalikan BAWAAN
  // (default_data) bila belum ada yang tersimpan: keputusan 4100-4105 berupa daftar semua pilihan, harta bersama berupa kerangka
  // "2.1 Sebidang tanah ... seluas _ m2", nama anak dihitung dari SIPP. Bawaan itu tidak boleh dianggap "sudah dipilih/terisi".
  const PIL_KEPUTUSAN_BAWAAN = ["dikabulkan seluruhnya", "dikabulkan sebagian", "ditolak", "tidak dapat diterima", "diberikan secara ex officio (tidak dituntut)"];
  const PIL_EX_OFFICIO = "diberikan secara ex officio (tidak dituntut)";
  const normPil = (x) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().toLowerCase();
  const pilihanSahDari = (b) => (b && Array.isArray(b.pilihan) && b.pilihan.length ? b.pilihan : b && /^410[0-5]$/.test(String(b.kode || "")) ? PIL_KEPUTUSAN_BAWAAN : []);
  /** Nilai sama dengan TEPAT SATU pilihan sah (boleh diikuti ":" + alasan, mis. "ditolak: istri nusyuz")? Mengembalikan pilihannya atau "". */
  function pilihanTunggalMurni(teks, pilihan) {
    const t = normPil(teks);
    if (!t) return "";
    for (const pl of pilihan || []) {
      const n = normPil(pl);
      if (n && (t === n || t.startsWith(n + ":"))) return String(pl);
    }
    return "";
  }
  /** Nilai hanya kerangka/bawaan ABT (kosong, daftar pilihan bergabung, bawaan itu sendiri, atau berisi "_" / "..." kerangka)? */
  function kerangkaBawaanMurni(b, teks) {
    const t = String(teks == null ? "" : teks).trim();
    if (!t) return true;
    const n = normPil(t);
    if (b && (n === normPil(b.bawaan) || n === normPil(b.saran))) return true;
    const pil = pilihanSahDari(b);
    if (pil.length > 1 && pil.map(normPil).filter((x) => x && n.includes(x)).length >= 2) return true;
    if (/(^|\s)_+(?=$|[\s.,;:)])/.test(t) || /\.{3}|…/.test(t)) return true;
    return false;
  }
  /** Nilai adalah DAFTAR beberapa pilihan sekaligus (bawaan ABT untuk isian berpilihan), bukan satu pilihan? */
  function daftarPilihanMurni(b, teks) {
    const pil = pilihanSahDari(b);
    const n = normPil(teks);
    return pil.length > 1 && Boolean(n) && pil.map(normPil).filter((x) => x && n.includes(x)).length >= 2;
  }
  /** Keputusan tuntutan (nilai tersimpan, bukan bawaan) = tepat satu pilihan sah? */
  const keputusanDipilihMurni = (b, teks) => Boolean(pilihanTunggalMurni(teks, pilihanSahDari(b)));
  const keputusanExOfficioMurni = (teks) => normPil(teks).startsWith(normPil(PIL_EX_OFFICIO));
  /**
   * Tuntutan isian ini aktif? ctx: { menyala(p), jabatan(p), keputusan(p), terisi(b), terisiTuntutan(b)? }.
   * terisiTuntutan = isian bermakna yang DISIMPAN petugas (bukan bawaan/kerangka/hitungan ABT); tanpa itu dipakai terisi(b).
   */
  function tuntutanAktifMurni(b, ctx) {
    const daftar = Array.isArray(b.tuntutan) ? b.tuntutan : [];
    if (!daftar.length) return true;
    if ((ctx.terisiTuntutan || ctx.terisi)(b)) return true;
    return daftar.some((p) => ctx.menyala(p) || (ctx.jabatan && ctx.jabatan(p)) || (ctx.keputusan && ctx.keputusan(p)));
  }
  /**
   * Golongan tampil satu isian: "utama" (kartu Perlu diisi), "takberlaku" (keadaan tidak berlaku), "tambahan" (opsional
   * berbaris langsung), "tuntutan" (tuntutan tidak diminta), "lanjutan" (hanya dibaca bagian otomatis), "pilihan" (bukan wajib).
   * ctx: { menyala, terisi, perkara, jabatan, keputusan, opsional(b) }.
   */
  function golonganIsianMurni(b, ctx) {
    if (!b.wajib) return "pilihan";
    const opsional = ctx.opsional ? ctx.opsional(b) : false;
    // Bukti yang hanya dibaca bagian otomatis juga tidak ada di tabel ABT blangko ini (21 Okt: paritas penuh).
    const tidakLangsung = b.langsung === false && b.jenis !== "tj";
    // 21 Okt (w25): isian tuntutan yang tertulis LANGSUNG di blangko juga disembunyikan bila tuntutannya tidak diminta
    // (aturan pengguna: tidak diminta = tidak ada pertimbangan/form), asalkan status tuntutannya terbaca (ctx.dikenal).
    const langsungBertuntutan = b.langsung === true && b.jenis !== "tj" && Array.isArray(b.tuntutan) && b.tuntutan.length > 0 && Boolean(ctx.dikenal) && b.tuntutan.some((p) => ctx.dikenal(p));
    if (langsungBertuntutan && !tuntutanAktifMurni(b, ctx)) return "tuntutan";
    if (tidakLangsung && Array.isArray(b.tuntutan) && b.tuntutan.length) {
      if (!tuntutanAktifMurni(b, ctx)) return "tuntutan";
      // Kotak cadangan satu besaran (mis. nafkah iddah cerai talak 6054 pada perkara cerai gugat): bagian tertutup, kecuali sudah berisi.
      if (Array.isArray(b.cadangan) && ctx.jenisCerai && b.cadangan.includes(ctx.jenisCerai) && !ctx.terisi(b)) return "lanjutan";
      return keadaanBerlakuMurni({ ...b, pemicu: "" }, ctx) ? "utama" : "takberlaku";
    }
    if (tidakLangsung) return "lanjutan";
    if (opsional) return b.jenis !== "tj" && !b.khusus ? "tambahan" : "pilihan";
    return keadaanBerlakuMurni(b, ctx) ? "utama" : "takberlaku";
  }
  /** Nilai #3400# / #3450# ("4142|ya|kutipan" per baris; 21 Okt x8: semua kode pemicu, bukan hanya 4140-4145) -> { "4142": { status: "ya"|"tidak"|"ragu", kutipan } }. */
  function uraiKutipanTuntutan(teks) {
    const hasil = {};
    for (const baris of String(teks || "").split(/\r?\n/)) {
      const m = baris.match(/^\s*(\d{4,5})\|(ya|tidak|ragu)\|(.*)$/);
      if (m) hasil[m[1]] = { status: m[2], kutipan: m[3].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim() };
    }
    return hasil;
  }
  const kunciJabatan = (p) => `${perkaraId()}|${p}`;
  const jabatanMenyala = (p) => Boolean(S.jabatan && S.jabatan[kunciJabatan(p)]);
  const tuntutanBlangko = () => (S.susunan && Array.isArray(S.susunan.tuntutan) ? S.susunan.tuntutan : []);
  const nilaiIsianKini = (kode) => (S.isi[kode] !== undefined ? S.isi[kode] : S.nilai[kode] && S.nilai[kode].teks);
  const isianBlangko = (kode) => (S.susunan && Array.isArray(S.susunan.isian) ? S.susunan.isian.find((x) => x.kode === kode) : null) || { kode };
  /** Keputusan majelis tuntutan p (4100-4105) sudah DIPILIH? Hanya bila nilainya tepat satu pilihan sah - daftar pilihan bawaan ABT bukan pilihan. */
  function keputusanTuntutan(p) {
    const t = tuntutanBlangko().find((x) => x.pemicu === p);
    if (!t || !t.keputusan) return false;
    return keputusanDipilihMurni(isianBlangko(t.keputusan), nilaiIsianKini(t.keputusan));
  }
  /** Keputusan tersimpan "diberikan secara ex officio (tidak dituntut)" = ditetapkan karena jabatan. */
  function keputusanKarenaJabatan(p) {
    const t = tuntutanBlangko().find((x) => x.pemicu === p);
    return Boolean(t && t.keputusan && keputusanTuntutan(p) && keputusanExOfficioMurni(nilaiIsianKini(t.keputusan)));
  }
  /** Isian bermakna untuk tampil-tuntutan: keputusan yang dipilih, atau isian yang petugas simpan di sesi ini dan bukan kerangka. Bawaan/hitungan ABT tidak dihitung. */
  function terisiTuntutan(b) {
    const v = nilaiIsianKini(b.kode);
    if (kerangkaBawaanMurni(b, v)) return false;
    const pil = pilihanSahDari(b);
    if (pil.length) return keputusanDipilihMurni(b, v);
    return S.tersimpan[b.kode] === "tersimpan";
  }
  /** "ct" (cerai talak: Pemohon/Termohon menurut nomor alur/jenis) atau "cg" - memilih kotak besaran utama. */
  const jenisCerai = () => (sebutan().P === "Pemohon" ? "ct" : "cg");
  const tuntutanDikenal = (p) => tuntutanBlangko().some((t) => t.pemicu === p) && S.nilai[p] !== undefined;
  const ctxGolongan = () => ({ perkara: perkaraSipp(), menyala: pemicuMenyala, terisi, terisiTuntutan, nilai: S.nilai, jabatan: jabatanMenyala, keputusan: keputusanTuntutan, dikenal: tuntutanDikenal, opsional: isianOpsional, jenisCerai: jenisCerai() });
  const golonganIsian = (b) => golonganIsianMurni(b, ctxGolongan());
  /** Keadaan tiap tuntutan blangko ini: { pemicu, label, status: ya|tidak|ragu, kutipan, jabatan, keputusan, isian }. */
  function keadaanTuntutan() {
    // 21 Okt (x8): kutipan tuntutan lain (#3450#, hak bekas istri, kebendaan, anak, kelalaian) digabung dengan #3400# (akibat cerai).
    const teksKutipan = (k) => (k && S.nilai[k] && S.nilai[k].teks) || "";
    const kodeLain = (S.susunan && S.susunan.kutipanLain) || "";
    const kut = { ...uraiKutipanTuntutan(teksKutipan(kodeLain)), ...uraiKutipanTuntutan(teksKutipan("3400")) };
    return tuntutanBlangko().map((t) => {
      const k = kut[t.pemicu];
      const status = k ? k.status : pemicuMenyala(t.pemicu) ? "ya" : "tidak";
      return { ...t, status: pemicuMenyala(t.pemicu) ? "ya" : status, kutipan: k ? k.kutipan : "", jabatan: jabatanMenyala(t.pemicu) || keputusanKarenaJabatan(t.pemicu), dipilih: keputusanTuntutan(t.pemicu) };
    });
  }
  /** Isian wajib yang keadaannya tidak berlaku untuk perkara ini (disembunyikan; dapat ditampilkan). */
  function daftarTakBerlaku() {
    if (!S.susunan) return [];
    return S.susunan.isian.filter((b) => golonganIsian(b) === "takberlaku");
  }
  /** Isian yang tampil: wajib, keadaannya berlaku (atau petugas memilih "tampilkan juga"). */
  function daftarPerlu() {
    if (!S.susunan) return [];
    return S.susunan.isian.filter((b) => {
      const g = golonganIsian(b);
      return g === "utama" || (g === "takberlaku" && S.tampilTakBerlaku);
    });
  }
  /** Isian tambahan: tidak dihitung "Perlu diisi", tampil di bagian tertutup di bawah kartu wajib. */
  function daftarOpsional() {
    if (!S.susunan) return [];
    return S.susunan.isian.filter((b) => golonganIsian(b) === "tambahan");
  }
  /** Isian yang hanya dibaca bagian otomatis (tidak ada di tabel ABT blangko ini). */
  function daftarLanjutan() {
    if (!S.susunan) return [];
    return S.susunan.isian.filter((b) => golonganIsian(b) === "lanjutan");
  }
  /** Bahan isi otomatis: kartu Perlu diisi + isian di dalam bagian otomatis yang keadaannya berlaku (tetap diisi seperti dulu). */
  function daftarIsiOtomatis() {
    return [...daftarPerlu(), ...daftarLanjutan().filter((b) => keadaanBerlaku(b))];
  }
  function nilaiTerisi(b) {
    if (b.khusus === "bukti") {
      const rows = S.bukti[b.pihak];
      if (!rows) return [0, 0];
      // Tiap bagian bukti boleh kosong (bentuk bukti beragam): yang dihitung hanya nama buktinya.
      const total = rows.length;
      const kosong = rows.reduce((n, r) => n + (String(r.manual || r.nm || "").trim() ? 0 : 1), 0);
      return [total - kosong, total];
    }
    if (b.jenis === "tj") {
      const t = S.tj[b.tj.kunci];
      // Tanya-jawab yang sudah ada di ABT (nilai bot untuk kode penanda/penyunting) terhitung terisi walau belum dibuka di layar.
      const dariAbt = [b.kode, b.tj.kodeSunting].some((k) => k && S.nilai[k] && S.nilai[k].status === "terisi");
      const ada = t && t.rows && t.rows.length ? 1 : dariAbt ? 1 : 0;
      return [ada, 1];
    }
    return [String(S.isi[b.kode] || "").trim() ? 1 : 0, 1];
  }
  function hitung() {
    let a = 0;
    let t = 0;
    for (const b of daftarPerlu()) {
      const [x, y] = nilaiTerisi(b);
      a += x;
      t += y;
    }
    return { a, t };
  }
  /** Isian yang masih kosong: [{ b, nama, tingkat }] - tingkat "penting" atau "tambahan" (dari susunan portal). */
  function kosongRinci() {
    const l = [];
    for (const b of daftarPerlu()) {
      const [x, y] = nilaiTerisi(b);
      if (x < y) l.push({ b, nama: b.khusus === "bukti" ? `nama ${b.nama.toLowerCase()}` : b.jenis === "tj" ? `tanya jawab ${b.tj.sebutan.toLowerCase()}` : b.nama, tingkat: b.tingkat === "tambahan" ? "tambahan" : "penting" });
    }
    return l;
  }
  const kosongDaftar = () => kosongRinci().map((x) => x.nama);
  function laporKeKerangka() {
    const a = api();
    if (tes() || !a || typeof a.laporIsian !== "function" || !S.pk) return;
    jadwalkanSiapNaskah("isian"); // isian lengkap + tenang -> naskah disiapkan di latar (cetak cepat)
    const h = hitung();
    a.laporIsian(nomorPerkara(), { a: h.a, t: h.t, jenis: S.blangko ? S.blangko.jenis : "", dicetak: S.cetakTercatat, blangko: S.blangko ? { berkas: S.blangko.berkas, kelompok: S.blangko.kelompok, judul: S.blangko.judul || "" } : null });
    // F1.6: rincian isian untuk checklist konseptor (konseptor-langkah.js) - hanya diumumkan, tidak ditulis di sini.
    if (S.blangko && S.susunan) {
      const isian = isianKelengkapan();
      document.dispatchEvent(new CustomEvent("aleta-bd-isian", { detail: { perkaraId: String(S.pk.perkaraId || ""), nomorPerkara: nomorPerkara(), jenis: S.blangko.jenis, berkas: S.blangko.berkas, isian } }));
      jadwalkanLaporWajib();
    }
  }
  /** Isian blangko yang terbuka beserta terisi/kosongnya (checklist konseptor dan riwayat kelengkapan). */
  function isianKelengkapan() {
    return daftarPerlu().map((b) => {
      const [x, y] = nilaiTerisi(b);
      return { kode: b.kode, nama: b.nama, jenis: b.jenis, khusus: b.khusus || "", terisi: y > 0 && x >= y };
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Menyimpan satu isian ke ABT (edit_data) - hanya bila peran sesuai
  // ──────────────────────────────────────────────────────────────────────────
  const antreSimpan = new Map();
  // ──────────────────────────────────────────────────────────────────────────
  // JEJAK ISIAN (rantai C, C1 = U2 + U6, 25 Okt 2026). Saklar server "jejak-isian", BAWAAN MATI.
  // Mati: simpanIsian persis seperti sebelumnya (tanpa baca-ulang, tanpa catatan). Menyala: tiap penyimpanan dibaca ulang dari ABT
  // (tidak sama -> ditandai merah), dan usulan vs hasil akhir + nilai SEBELUM (utuh, untuk Urungkan dari PC mana pun) dicatat di server.
  // ──────────────────────────────────────────────────────────────────────────
  const JI = () => (typeof globalThis !== "undefined" && globalThis.AletaJejakIsian) || null;
  /** kode -> { usulan, asal, yakin, otomatis }: konteks yang dipasang pemanggil sesaat sebelum jadwalkanSimpan (dipakai sekali). */
  const konteksJejak = new Map();
  /** kode -> { nilai, asal, yakin }: nilai yang ALETA tulis sendiri sejak blangko dibuka (bahan cara "diubah-otomatis"). */
  const otoTulis = new Map();
  /** kode -> nilai akhir (baku) yang terakhir dicatat di sesi ini: penyimpanan berulang nilai yang sama tidak dicatat dua kali. */
  const jejakTerakhir = new Map();
  let sedangUrungkan = false;
  async function jejakIsianAktif() {
    const j = JI();
    if (!j) return false;
    try {
      return (await j.aktif()) === true;
    } catch {
      return false;
    }
  }
  /** Isian yang hanya hurufnya disimpan ke ABT (lihat simpanIsian) - Tes putusan memperlakukannya sama supaya pratinjau setia. */
  const KODE_HURUF_SAJA_TES = new Set(["8503", "9463", "9475", "9790", "9820", "9865"]);
  /**
   * Tes putusan: ketikan dicatat HANYA di memori halaman (S.tesIsian) lalu dihitung pratinjau seolah sudah tersimpan di ABT. Aturan
   * bentuk aman ABT sama dengan simpan sungguhan (huruf diganti / ditolak), tanpa satu permintaan pun ke ABT, SIPP, atau e-Court.
   */
  function catatKetikanTes(kode, nilai) {
    let t = String(nilai ?? "");
    if (KODE_HURUF_SAJA_TES.has(kode)) t = nilaiSimpan8503(t);
    const norm = normalAbt(t);
    if (norm.diganti.length) {
      t = norm.teks;
      S.ganti[kode] = norm.diganti.join(" ");
    } else delete S.ganti[kode];
    const luar = hurufDiLuarAbt(t);
    if (luar.length) {
      delete S.tesIsian[kode];
      S.tersimpan[kode] = `gagal: huruf ${luar.join(" ")} tidak dapat disimpan ABT - ganti dengan huruf biasa`;
      renderStatusIsian(kode);
      return false;
    }
    S.isi[kode] = t;
    S.tesIsian[kode] = t;
    S.tersimpan[kode] = "dicoba";
    tandaiKotor();
    const el = cari(`#bd-i${kode}`, wadah.isian);
    if (el && el.value !== t && el.tagName !== "SELECT") el.value = t;
    renderStatusIsian(kode);
    renderProgres();
    // Pratinjau yang sedang terbuka diberi penanda "isian berubah - muat ulang" (tidak dimuat ulang sendiri: menyusun naskah makan waktu).
    if (S.prat.terbuka && S.prat.html && !S.prat.memuat) renderPratinjau();
    return true;
  }
  /** Ketikan yang ikut dihitung pratinjau tes: yang sudah dicatat + yang masih di kotak (belum dilepas fokusnya). */
  function ketikanTes() {
    const hasil = { ...S.tesIsian };
    for (const k of S.diketik) {
      if (!/^\d{3,5}$/.test(k)) continue;
      let t = String(S.isi[k] ?? "");
      if (KODE_HURUF_SAJA_TES.has(k)) t = nilaiSimpan8503(t);
      t = normalAbt(t).teks;
      if (!hurufDiLuarAbt(t).length) hasil[k] = t;
    }
    return hasil;
  }
  function jadwalkanSimpan(kode, nilai, segera) {
    if (tes()) {
      catatKetikanTes(kode, nilai);
      return segera ? Promise.resolve(false) : undefined;
    }
    S.isi[kode] = nilai;
    clearTimeout(antreSimpan.get(kode));
    if (segera) return simpanIsian(kode, nilai);
    antreSimpan.set(kode, setTimeout(() => void simpanIsian(kode, nilai), 500));
    return undefined;
  }
  async function simpanIsian(kode, nilai) {
    if (!S.blangko || !S.pk) return false;
    if (tes()) return false;
    if (!bolehTulis()) {
      S.tersimpan[kode] = `gagal: ${NAMA_JENIS[S.blangko.jenis] || "blangko ini"} hanya ditulis ${NAMA_PERAN[JENIS_PERAN[S.blangko.jenis]] || "pejabat perkara"}`;
      renderStatusIsian(kode);
      return false;
    }
    // 17 Okt: pilihan "F · uraian" ke ABT hanya hurufnya - kueri paket abt-alasan-cdeh membaca SELURUH isi 8503
    // (REPLACE ... lalu NOT REGEXP '[^A-H]' + INSTR per huruf), jadi uraian membuatnya "TIDAK BENAR QUERY NYA".
    // F22 17 Okt: 9463 (alasan pencegahan A-H) dan 9475 (pokok tuntutan wasiat A-G) ditulis hurufnya saja - kueri 9464/9476 membaca huruf pertama,
    // dan huruf itu pula yang dibaca popup ABT.
    const sederhana = kode === "8503" || kode === "9463" || kode === "9475" || kode === "9790" || kode === "9820" || kode === "9865" ? nilaiSimpan8503(nilai) : nilai; // I28 18 Okt: + 9790 (pokok tuntutan hibah A-G), 9820 (wakaf A-F), 9865 (kepentingan mafqud A-C)
    if (sederhana !== nilai) {
      nilai = sederhana;
      S.isi[kode] = nilai;
      const el8503 = cari(`#bd-i${kode}`, wadah.isian);
      if (el8503 && el8503.value !== nilai && el8503.tagName !== "SELECT") el8503.value = nilai;
    }
    const norm = normalAbt(nilai);
    if (norm.diganti.length) {
      nilai = norm.teks;
      S.isi[kode] = nilai;
      S.ganti[kode] = norm.diganti.join(" ");
      const el = cari(`#bd-i${kode}`, wadah.isian);
      if (el && el.value !== nilai && el.tagName !== "SELECT") el.value = nilai;
    } else delete S.ganti[kode];
    const luar = hurufDiLuarAbt(nilai);
    if (luar.length) {
      S.tersimpan[kode] = `gagal: huruf ${luar.join(" ")} tidak dapat disimpan ABT - ganti dengan huruf biasa`;
      renderStatusIsian(kode);
      return false;
    }
    S.tersimpan[kode] = "menyimpan";
    renderStatusIsian(kode);
    const konteksJ = konteksJejak.get(kode);
    konteksJejak.delete(kode);
    const jejakAktif = await jejakIsianAktif();
    try {
      const h = await klienAbt().simpanIsian(kode, perkaraId(), nilai, { verifikasi: jejakAktif });
      if (jejakAktif && h && h.tersimpan) catatJejakSimpan(kode, nilai, h, konteksJ);
      if (h && h.ok) {
        cerminSekali(kode, nilai);
        cerminSidang(kode, nilai);
      }
      if (S.isi[kode] !== nilai) return true; // sudah diketik lagi: hasil ini tidak dipakai
      S.tersimpan[kode] = h.ok ? "tersimpan" : jejakAktif && h.tersimpan && h.terverifikasi === false ? BEDA_BACA_ULANG : `gagal: ${h.pesan || "ABT menolak"}`;
      if (h.ok) {
        S.nilai[kode] = { status: String(nilai).trim() ? "terisi" : "kosong", teks: String(nilai) };
        tandaiKotor();
        S.peringat = false;
      } else if (jejakAktif && h.tersimpan && h.terverifikasi === false && h.nilaiBaru != null) {
        // ABT menyimpan, tetapi bacaan ulangnya berbeda: layar mengikuti isi ABT yang sebenarnya, dan statusnya merah.
        S.nilai[kode] = { status: String(h.nilaiBaru).trim() ? "terisi" : "kosong", teks: String(h.nilaiBaru) };
        tandaiKotor();
      }
    } catch (e) {
      S.tersimpan[kode] = `gagal: ${String((e && e.message) || e)}`;
    }
    renderStatusIsian(kode);
    renderProgres();
    if (kode === "8503") renderIsian();
    laporKeKerangka();
    return S.tersimpan[kode] === "tersimpan";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ISIAN SEKALI PER PERKARA (rantai D, D2 = U11, 25 Okt 2026). Saklar server "isian-sekali", BAWAAN MATI (mati: tidak ada yang
  // diingat dan tidak ada saran tambahan). Isian manual yang belum punya sumber otomatis (mis. nomor penetapan prodeo) diingat server
  // per perkara begitu tersimpan ke ABT, dan blangko lain perkara itu menampilkannya sebagai SARAN (Tab / Input ke ABT). Tidak pernah
  // ditulis sendiri ke ABT: isian yang sengaja dikosongkan petugas tidak boleh terisi lagi diam-diam.
  // ──────────────────────────────────────────────────────────────────────────
  /** Mengingat isian yang baru tersimpan ke ABT (hanya kode yang diingat server; tidak pernah melempar). */
  function cerminSekali(kode, nilai) {
    try {
      const j = JI();
      if (!j || typeof j.catatSekali !== "function" || !S.pk || sedangUrungkan || tes()) return;
      void j.catatSekali({ perkaraId: String(perkaraId()), nomorPerkara: nomorPerkara(), kode, nilai });
    } catch {
      /* ingatan tertinggal; isiannya sudah tersimpan di ABT */
    }
  }
  /** Saran dari ingatan server untuk isian yang masih kosong; mengembalikan banyaknya saran baru. */
  async function saranDariIsianPerkara(daftar) {
    try {
      const j = JI();
      if (!j || typeof j.bacaSekali !== "function") return 0;
      const d = S.susunan;
      const pk = S.pk;
      const peta = await j.bacaSekali(perkaraId());
      if (S.susunan !== d || S.pk !== pk || !peta.size) return 0;
      let n = 0;
      for (const b of daftar || []) {
        const ada = peta.get(b.kode);
        if (!ada || (b.jenis !== "teks" && b.jenis !== "tanggal") || !sedangKosong(b)) continue;
        if ((S.saranSipp[b.kode] && S.saranSipp[b.kode].nilai) || (S.saranH7 && S.saranH7[b.kode])) continue;
        S.saranSipp[b.kode] = { nilai: ada.nilai, keyakinan: "ragu", asal: "isian perkara tersimpan" };
        n += 1;
      }
      return n;
    } catch {
      return 0;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DAFTAR WAJIB SEBELUM CETAK + SALIN DARI PERKARA SERUPA (rantai D, D3 = U13, 25 Okt 2026). Saklar server
  // "wajib-sebelum-cetak", BAWAAN MATI (mati: tidak ada laporan, tidak ada pengingat tambahan, tidak ada saran tambahan).
  // Menyala: kelengkapan SEMUA jenis blangko dilaporkan ke server (saat berubah dan saat dicetak); sebelum Cetak, isian yang
  // BIASANYA sudah terisi saat blangko itu dicetak tetapi masih kosong ikut diingatkan; isian kosong bukan-identitas diberi SARAN
  // dari perkara serupa yang sudah putus. Hanya mengingatkan dan menyarankan: dialog "Tetap cetak" tetap ada, dan tidak ada
  // yang ditulis ke ABT sendiri.
  // ──────────────────────────────────────────────────────────────────────────
  const JEDA_LAPOR_WAJIB_MS = 3000;
  let jamLaporWajib = null;
  let tandaLaporWajib = "";
  /** Pola kasar perkara (tanpa nama, tanggal, nomor) untuk mencari perkara serupa. */
  function faktaPolaPerkara() {
    // S.pk = detail peristiwa perkara { nomorPerkara, perkaraId, jenisPerkara, sidang[], perkara }; catatan perkara ada di S.pk.perkara.
    const pk = { ...(S.pk || {}), ...((S.pk && S.pk.perkara) || {}) };
    const fakta = {};
    if (pk.alurPerkaraId) fakta.alur = String(pk.alurPerkaraId);
    fakta.ghaib = Boolean(pk.ghaib);
    fakta.prodeo = Boolean(pk.prodeo);
    if (pk.lewatEcourt === true || pk.lewatEcourt === false) fakta.ecourt = pk.lewatEcourt;
    const p = pk.pihak || {};
    if (Array.isArray(p.penggugat)) fakta.jumlahP = p.penggugat.length;
    if (Array.isArray(p.tergugat)) fakta.jumlahT = p.tergugat.length;
    const sd = Array.isArray(pk.sidang) ? pk.sidang : [];
    fakta.verstek = sd.some((x) => /verstek/i.test(String((x && x.ket) || "")));
    return fakta;
  }
  function rincianLaporWajib(dicetak) {
    if (!S.pk || !S.blangko || !S.susunan) return null;
    const isian = isianKelengkapan().map((i) => ({ kode: i.kode, terisi: i.terisi }));
    if (!isian.length) return null;
    return {
      perkaraId: String(S.pk.perkaraId || ""),
      nomorPerkara: nomorPerkara(),
      berkas: String(S.blangko.berkas || ""),
      jenisBlangko: String(S.blangko.jenis || ""),
      jenisPerkara: String(S.pk.jenisPerkara || ""),
      isian,
      dicetak: dicetak === true,
      fakta: faktaPolaPerkara(),
    };
  }
  /** Melaporkan kelengkapan sesudah jeda singkat dan hanya bila berubah. Tidak pernah melempar. */
  function jadwalkanLaporWajib() {
    try {
      const j = JI();
      if (!j || typeof j.laporWajib !== "function" || tes()) return;
      clearTimeout(jamLaporWajib);
      jamLaporWajib = setTimeout(() => {
        try {
          const d = rincianLaporWajib(false);
          if (!d) return;
          const tanda = `${d.perkaraId}|${d.berkas}|${d.isian.map((i) => `${i.kode}:${i.terisi ? 1 : 0}`).join(",")}`;
          if (tanda === tandaLaporWajib) return;
          tandaLaporWajib = tanda;
          void j.laporWajib(d);
        } catch {
          /* laporan tertinggal; tidak memengaruhi isian */
        }
      }, JEDA_LAPOR_WAJIB_MS);
    } catch {
      /* laporan tertinggal */
    }
  }
  /** Keadaan kelengkapan SAAT blangko dicetak (bahan belajar "isian yang biasanya terisi"). */
  function laporCetakWajib() {
    try {
      const j = JI();
      if (!j || typeof j.laporWajib !== "function" || tes()) return;
      const d = rincianLaporWajib(true);
      if (d) void j.laporWajib(d);
    } catch {
      /* laporan tertinggal */
    }
  }
  /**
   * Menambah ke daftar kosong sebelum cetak: isian yang BIASANYA terisi saat blangko ini dicetak. Isian "tidak wajib" yang di
   * lapangan hampir selalu terisi dinaikkan menjadi "penting". Saklar mati / data belum cukup / gagal = daftar tidak berubah.
   */
  async function tambahWajibBiasanya(kos) {
    try {
      const j = JI();
      if (!j || typeof j.bacaWajib !== "function" || !S.blangko) return kos;
      const w = await j.bacaWajib(S.blangko.berkas);
      if (!w || !w.cukupData || !Array.isArray(w.wajib) || !w.wajib.length) return kos;
      const peta = new Map(w.wajib.map((x) => [String(x.kode), x]));
      const catat = (it) => `biasanya terisi (${it.terisi} dari ${it.dari} cetak)`;
      const hasil = kos.map((x) => {
        const it = peta.get(String(x.b.kode));
        return it ? { ...x, nama: `${x.nama} - ${catat(it)}`, tingkat: "penting" } : x;
      });
      const sudah = new Set(kos.map((x) => String(x.b.kode)));
      for (const b of daftarPerlu()) {
        const it = peta.get(String(b.kode));
        if (!it || sudah.has(String(b.kode))) continue;
        const [x, y] = nilaiTerisi(b);
        if (y > 0 && x >= y) continue;
        hasil.push({ b, nama: `${b.khusus === "bukti" ? `nama ${b.nama.toLowerCase()}` : b.jenis === "tj" ? `tanya jawab ${b.tj.sebutan.toLowerCase()}` : b.nama} - ${catat(it)}`, tingkat: "penting" });
      }
      return hasil;
    } catch {
      return kos;
    }
  }
  /** Saran dari perkara serupa yang sudah putus untuk isian teks yang kosong dan belum bersaran; mengembalikan banyaknya saran baru. */
  async function saranDariPerkaraSerupa(daftar) {
    try {
      const j = JI();
      if (!j || typeof j.usulSerupa !== "function" || tes()) return 0;
      const d = S.susunan;
      const pk = S.pk;
      const calon = (daftar || []).filter(
        (b) => b.jenis === "teks" && sedangKosong(b) && !(S.saranSipp[b.kode] && S.saranSipp[b.kode].nilai) && !(S.saranH7 && S.saranH7[b.kode])
      );
      if (!calon.length || !pk) return 0;
      const usulan = await j.usulSerupa({ perkaraId: perkaraId(), nomorPerkara: nomorPerkara(), jenisPerkara: String(pk.jenisPerkara || ""), fakta: faktaPolaPerkara(), kode: calon.map((b) => b.kode) });
      if (S.susunan !== d || S.pk !== pk || !usulan.length) return 0;
      let n = 0;
      for (const u of usulan) {
        const b = calon.find((x) => x.kode === String(u.kode));
        if (!b || !sedangKosong(b) || (S.saranSipp[b.kode] && S.saranSipp[b.kode].nilai)) continue;
        S.saranSipp[b.kode] = { nilai: String(u.nilai), keyakinan: "ragu", asal: "perkara serupa" };
        n += 1;
      }
      return n;
    } catch {
      return 0;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HURUF ALASAN YANG BELAJAR DARI HAKIM (rantai D, D4 = U14, 25 Okt 2026). Saklar server "huruf-alasan-belajar", BAWAAN MATI
  // (mati: kotak 8503 persis seperti biasa). Menyala: di bawah kotak 8503 tampil PERTIMBANGAN dari kebiasaan hakim ini, anggota
  // majelis lain, dan kecocokan pola (jejak isian), beserta saran dasar hukum per huruf (bertanda [PERLU VERIFIKASI] bila belum
  // terverifikasi). Tetap usulan: tombol "Pakai huruf X" ditekan hakim sendiri; tidak ada yang diisi atau disimpan otomatis.
  // ──────────────────────────────────────────────────────────────────────────
  /** Pertimbangan huruf alasan untuk blangko yang terbuka; true bila ada yang baru tampil. */
  async function muatBelajarHuruf() {
    try {
      const j = JI();
      if (!j || typeof j.belajarHuruf !== "function" || tes() || !S.pk || !S.susunan) return false;
      if (!daftarIsiOtomatis().some((b) => b.kode === "8503")) return false;
      const d = S.susunan;
      const pk = S.pk;
      const saran = (S.saranSipp && S.saranSipp["8503"] && S.saranSipp["8503"].nilai) || "";
      const perkara = pk.perkara || {};
      const majelis = String(pk.majelisNama || perkara.majelisNama || "").trim();
      const hasil = await j.belajarHuruf({ jenisPerkara: String(pk.jenisPerkara || ""), hurufMesin: hurufAlasanDari(saran), majelis: majelis ? [majelis] : [] });
      if (S.susunan !== d || S.pk !== pk) return false;
      S.belajar8503 = hasil || null;
      return Boolean(hasil);
    } catch {
      return false;
    }
  }
  /** Catatan di bawah kotak 8503: pertimbangan (usulan) + dasar hukum. Kosong bila saklar mati atau belum ada yang berarti. */
  function belajarHtml8503() {
    const d = S.belajar8503;
    if (!d || !d.belajar) return "";
    const sekarang = alasanHuruf();
    const kodeAlasan = "8503"; // lewat peubah: teks tampil tidak boleh memuat kode telanjang (ekstensi-isian-tanpa-kode-tampil-18okt)
    const baris = [];
    for (const p of d.belajar.pertimbangan || []) {
      const pakai = p.huruf && p.huruf !== sekarang ? ` <button type="button" class="bd-btn kecil" data-ambil="${kodeAlasan}" data-nilai="${esc(p.huruf)}">Pakai huruf ${esc(p.huruf)}</button>` : "";
      baris.push(`<div class="bd-catat" data-belajar="pertimbangan">${esc(p.kalimat)}${pakai}</div>`);
    }
    for (const h of d.dasarHukum || []) {
      for (const x of h.daftar || []) baris.push(`<div class="bd-catat" data-belajar="dasar">Dasar hukum huruf ${esc(h.huruf)} (saran): ${esc(x.teks)}</div>`);
    }
    if (!baris.length) return "";
    return `<div class="bd-belajar" data-belajar="${kodeAlasan}"><div class="bd-catat"><b>Pertimbangan (usulan, bukan keputusan)</b></div>${baris.join("")}</div>`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ISIAN BAS PER SIDANG (rantai D, D6 = U12, 25 Okt 2026). Saklar server "isian-per-sidang", BAWAAN MATI (mati: BAS persis seperti
  // sebelumnya - isian ketikan satu per perkara dan BAS sidang berikutnya menimpa yang sebelumnya). ABT menyimpan satu nilai per
  // (no_var, perkara); lapisan ini mengingat isian ketikan BAS PER SIDANG di server. Saat BAS sidang tertentu dicetak: nilai ABT
  // sekarang disimpan, nilai sidang itu ditulis ke ABT SEMENTARA, naskah diambil, lalu ABT dipulihkan. Gagal menulis di tengah =
  // yang sudah ditulis dipulihkan dan cetak dibatalkan (tidak pernah mencetak BAS dengan isian sidang lain). Bila peramban tertutup
  // di antaranya, daftar pemulihan di penyimpanan peramban memulihkan ABT saat perkara itu dibuka lagi.
  // ──────────────────────────────────────────────────────────────────────────
  const K_PULIH = "blangkoDerryPulih";
  /** Isian teks/tanggal blangko yang terbuka (bukan tanya-jawab, bukti, atau multi-sidang)? */
  function kodeIsianSidang(kode) {
    const b = daftarIsiOtomatis().find((x) => x.kode === kode);
    return Boolean(b && (b.jenis === "teks" || b.jenis === "tanggal") && !b.khusus);
  }
  /** Isian BAS yang tersimpan untuk sidang yang sedang dipilih: Map kode -> nilai; null bila bukan BAS, saklar mati, atau gagal. */
  async function bacaIsianSidangSekarang() {
    try {
      const j = JI();
      if (!j || typeof j.bacaSidang !== "function" || tes() || !S.pk || !S.blangko || S.blangko.jenis !== "bas") return null;
      const sd = Number(sidangUrutan());
      if (!(sd > 0)) return null;
      return await j.bacaSidang(perkaraId(), sd);
    } catch {
      return null;
    }
  }
  /** Mengingat isian BAS yang baru tersimpan ke ABT untuk sidang ini. Tidak pernah melempar. */
  function cerminSidang(kode, nilai) {
    try {
      const j = JI();
      if (!j || typeof j.catatSidang !== "function" || tes() || sedangUrungkan || !S.pk || !S.blangko || S.blangko.jenis !== "bas") return;
      const sd = Number(sidangUrutan());
      if (!(sd > 0) || !kodeIsianSidang(kode)) return;
      void j.catatSidang({ perkaraId: perkaraId(), nomorPerkara: nomorPerkara(), sidang: sd, kode, nilai });
    } catch {
      /* ingatan tertinggal; isiannya sudah tersimpan di ABT */
    }
  }
  /** Memuat isian sidang yang dipilih (dan memulihkan ABT yang tertinggal dari cetak terputus). true bila ada yang dimuat. */
  async function muatIsianSidang() {
    try {
      await pulihkanTertunda();
      const d = S.susunan;
      const pk = S.pk;
      const peta = await bacaIsianSidangSekarang();
      if (S.susunan !== d || S.pk !== pk) return false;
      S.isianSidang = peta ? { kunci: `${perkaraId()}|${sidangUrutan()}`, peta } : null;
      return Boolean(peta);
    } catch {
      return false;
    }
  }
  /** Catatan di bawah isian yang nilai tersimpan sidang ini berbeda dari isi ABT sekarang. */
  function catatSidangHtml(b) {
    const d = S.isianSidang;
    if (!d || d.kunci !== `${perkaraId()}|${sidangUrutan()}` || !d.peta.has(b.kode)) return "";
    const simpan = d.peta.get(b.kode);
    if (simpan === String(S.isi[b.kode] == null ? "" : S.isi[b.kode])) return "";
    return `<div class="bd-catat bd-sidangcatat" data-sidang-kode="${esc(b.kode)}">Isian sidang ke-${esc(sidangUrutan())} yang tersimpan: <i>${simpan ? esc(potong(simpan, 160)) : "(dikosongkan)"}</i>. Dipakai otomatis saat BAS sidang ini dicetak.${simpan ? ` <button type="button" class="bd-btn kecil" data-ambil="${esc(b.kode)}" data-nilai="${esc(simpan)}">Pakai di layar</button>` : ""}</div>`;
  }
  /** Memulihkan daftar isian ke nilai asal; hanya yang SEKARANG di ABT masih nilai sementara (`nilai`) bila diminta. true bila semua pulih. */
  async function pulihkanDaftar(pid, daftar, hanyaBilaMasihSementara) {
    let gagal = 0;
    for (const r of (daftar || []).slice().reverse()) {
      if (hanyaBilaMasihSementara && String(S.isi[r.kode] == null ? "" : S.isi[r.kode]) !== String(r.nilai == null ? "" : r.nilai)) continue;
      try {
        const h = await klienAbt().simpanIsian(r.kode, pid, r.asal, {});
        if (h && h.ok) S.isi[r.kode] = r.asal;
        else gagal += 1;
      } catch {
        gagal += 1;
      }
    }
    tandaiKotor();
    if (!gagal) await tulisPenyimpanan({ [K_PULIH]: null });
    else toast(`Peringatan: ${gagal} isian ABT belum dapat dipulihkan setelah cetak BAS; dipulihkan otomatis saat perkara ini dibuka lagi.`);
    return gagal === 0;
  }
  /** Daftar pemulihan dari cetak yang terputus (peramban tertutup): dipulihkan begitu perkara itu dibuka lagi. */
  async function pulihkanTertunda() {
    try {
      if (tes() || !S.pk || !bolehTulis()) return false;
      const p = (await bacaPenyimpanan(K_PULIH))[K_PULIH];
      if (!p || !Array.isArray(p.daftar) || !p.daftar.length || String(p.perkaraId) !== perkaraId()) return false;
      const ok = await pulihkanDaftar(p.perkaraId, p.daftar, true);
      if (ok) toast("Isian ABT dipulihkan setelah cetak BAS yang terputus.");
      return ok;
    } catch {
      return false;
    }
  }
  /**
   * Menulis isian BAS sidang ini ke ABT SEMENTARA sebelum naskah diambil. Mengembalikan fungsi pemulih, atau null bila tidak ada yang
   * perlu diterapkan (bukan BAS, saklar mati, tidak ada isian tersimpan, atau semuanya sudah sama). Melempar bila penulisan gagal;
   * yang sudah ditulis dipulihkan lebih dulu sehingga cetak dibatalkan dengan ABT seperti semula.
   */
  async function terapkanIsianSidang() {
    const peta = await bacaIsianSidangSekarang();
    if (!peta || !peta.size || !bolehTulis()) return null;
    const pid = perkaraId();
    const rencana = [];
    for (const [kode, nilai] of peta) {
      if (!kodeIsianSidang(kode)) continue;
      const asal = String(S.isi[kode] == null ? "" : S.isi[kode]);
      if (asal !== nilai) rencana.push({ kode, asal, nilai });
    }
    if (!rencana.length) return null;
    // Daftar pemulihan DISIMPAN LEBIH DULU: peramban yang tertutup di tengah jalan tidak meninggalkan ABT berisi isian sidang lain.
    await tulisPenyimpanan({ [K_PULIH]: { perkaraId: pid, nomor: nomorPerkara(), sidang: sidangUrutan(), daftar: rencana, saat: Date.now() } });
    const terapan = [];
    try {
      for (const r of rencana) {
        const h = await klienAbt().simpanIsian(r.kode, pid, r.nilai, {});
        if (!h || !h.ok) throw new Error(`isian ${r.kode} sidang ke-${sidangUrutan()} tidak dapat dituliskan sementara ke ABT${h && h.pesan ? ` (${h.pesan})` : ""}`);
        terapan.push(r);
        S.isi[r.kode] = r.nilai;
      }
    } catch (e) {
      await pulihkanDaftar(pid, terapan, false);
      throw e;
    }
    tandaiKotor();
    return async () => {
      await pulihkanDaftar(pid, terapan, false);
    };
  }

  const BEDA_BACA_ULANG = "gagal: tersimpan, tetapi bacaan ulang dari ABT berbeda - periksa isinya";
  /**
   * Mencatat satu penyimpanan isian yang BERHASIL ditulis ke ABT: usulan (beserta pengisinya) vs nilai akhir, nilai sebelum yang
   * utuh, dan hasil baca-ulang. Tidak pernah melempar; gagal mencatat tidak menggagalkan penyimpanan. Urungkan dicatat lewat
   * catatRiwayat (urungkanDari) supaya hanya satu baris.
   */
  function catatJejakSimpan(kode, nilai, h, ctx) {
    try {
      const J = JI();
      if (!J || !S.pk || !S.blangko || sedangUrungkan) return;
      const sebelum = h.nilaiLama == null ? "" : String(h.nilaiLama);
      const b = S.susunan && Array.isArray(S.susunan.isian) ? S.susunan.isian.find((x) => x.kode === kode) || null : null;
      const ditulisOto = Boolean(ctx && ctx.otomatis);
      let usulan = "";
      let asal = "";
      let yakin = "";
      let dariOto = false;
      if (ctx) {
        usulan = String(ctx.usulan || "");
        asal = String(ctx.asal || "");
        yakin = String(ctx.yakin || "");
      } else if (otoTulis.has(kode)) {
        const o = otoTulis.get(kode);
        usulan = o.nilai;
        asal = o.asal;
        yakin = o.yakin;
        dariOto = true;
      } else if (b && !(S.nilai[kode] && S.nilai[kode].status === "terisi")) {
        // Saran samar hanya tampil di kotak yang KOSONG menurut portal (ABT menampilkan bawaan hitungannya sendiri bagi variabel yang
        // belum tersimpan, jadi nilai lama dari popup tidak dapat dipakai sebagai tanda kosong); di kotak berisi tidak ada usulan.
        const sr = saranDetail(b, { tanpaUmum: true });
        usulan = sr.nilai;
        asal = sr.asal;
        yakin = sr.yakin;
      }
      const sama = KODE_HURUF_SAJA_TES.has(kode) ? (a, c) => J.samaLonggar(nilaiSimpan8503(a), c) : undefined;
      const cara = J.tentukanCara({ ditulisOtomatis: ditulisOto, usulan, usulanDariOtomatis: dariOto, final: nilai }, sama);
      // Tidak ada yang berubah di ABT (nilai yang sama disimpan ulang) bukan peristiwa - KECUALI saran yang diterima atau tulisan otomatis:
      // menyimpan saran menjadikannya nilai ABT (ABT menampilkan bawaan hitungannya sendiri bagi variabel yang belum tersimpan).
      if (J.samaLonggar(sebelum, nilai) && cara !== "saran-diterima" && cara !== "otomatis") return;
      // Nilai akhir yang sama dengan yang terakhir dicatat untuk isian ini di sesi ini (mis. blur dua kali) tidak dicatat lagi.
      if (jejakTerakhir.get(kode) === J.bakuBanding(nilai)) return;
      jejakTerakhir.set(kode, J.bakuBanding(nilai));
      if (ditulisOto) otoTulis.set(kode, { nilai, asal, yakin });
      else if (dariOto) otoTulis.delete(kode);
      void J.catatIsian({
        perkaraId: String(perkaraId()),
        nomorPerkara: nomorPerkara(),
        jenisPerkara: String(S.pk.jenisPerkara || ""),
        blangko: String(S.blangko.berkas || ""),
        jenisBlangko: String(S.blangko.jenis || ""),
        kode,
        namaVariabel: b ? String(b.nama || "") : "",
        nilaiUsulan: usulan,
        asalUsulan: J.penandaAsal(asal),
        keyakinan: yakin,
        nilaiSebelum: sebelum,
        nilaiFinal: nilai,
        cara,
        terverifikasi: h.terverifikasi === true ? "ya" : h.terverifikasi === false ? "beda" : "tidak-dicek",
        nilaiTerbaca: h.terverifikasi === false && h.nilaiBaru != null ? String(h.nilaiBaru) : "",
        jalur: "blangko-derry",
        pada: new Date().toISOString(),
      });
    } catch {
      /* jejak tertinggal; isian sudah tersimpan di ABT */
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Alat bukti surat: baris terstruktur <-> kalimat ABT (variabel 1214 / 9911)
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * 19 Okt (isian 2): jenis bukti yang diawali nomor ("1. Fotokopi Kartu Tanda Penduduk ...", "2) Fotokopi Kutipan Akta Nikah") dibuang
   * penomoran awalnya - kode P.1/P.2 sudah ditulis otomatis di kalimat, nomor ganda membingungkan.
   */
  const buangNomorAwal = (t) => String(t == null ? "" : t).replace(/^\s*\(?\d{1,2}\s*[.)]\s*(?=\S)/, "").replace(/^\s+/, "");
  const POLA_BUKTI_BERNOMOR = /^\s*\(?\d{1,2}\s*[.)]\s+\S/m;
  const KAL_METERAI = [", bukti surat tersebut telah diberi meterai cukup, di-nazegelen", ", bukti surat tersebut telah diberi meterai cukup, tetapi tidak di-nazegelen", ", bukti surat tersebut tidak bermeterai dan tidak di-nazegelen", ""];
  const buktiBaru = (nm, oleh) => ({ nm: buangNomorAwal(nm), an: "", no: "", tgl: "", oleh: oleh || "", meterai: 0, cocok: 0, manual: null });
  /** Jenis bukti dari namanya: KTP -> kolom NIK, Kartu Keluarga -> Nomor KK, selainnya Nomor surat. */
  function jenisBukti(nm) {
    const n = String(nm || "");
    if (/kartu tanda penduduk|\bktp\b|ktp-el/i.test(n)) return "ktp";
    if (/kartu keluarga|\bkk\b/i.test(n)) return "kk";
    return "";
  }
  // Kode tanda bukti di kalimat: "tanda P.3", "diberi tanda bukti P.3", "bertanda P-3", "kode (P.3)".
  const POLA_KODE_BUKTI = /(\b(?:tanda|bertanda|kode)\s*:?\s*(?:bukti\s+)?\(?)[PT][.-]\s?\d+/gi;
  /**
   * Kalimat satu bukti sesuai pola ABT, kode P.n / T.n otomatis. Semua bagian (atas nama, nomor, tanggal,
   * penerbit, meterai, pencocokan) boleh kosong - bagian kosong tidak ditulis. Bukti "tulis manual" dicetak
   * apa adanya; kode di dalamnya ("tanda P.3") disesuaikan dengan urutannya, dan bila tidak ada kode
   * ekor baku ditambahkan.
   */
  function kalimatBukti(r, pihak, i) {
    const kode = `${pihak}.${i + 1}`;
    if (typeof r.manual === "string" && r.manual.trim()) {
      let t = buangNomorAwal(r.manual).trim().replace(/\s+/g, " ");
      const adaKode = new RegExp(POLA_KODE_BUKTI.source, "i").test(t);
      if (adaKode) t = t.replace(POLA_KODE_BUKTI, `$1${kode}`);
      else t = `${t.replace(/[;.,\s]+$/, "")}, lalu diberi tanda ${kode} serta diberi tanggal dan paraf oleh Ketua Majelis`;
      // Kalimat manual yang sudah ditutup titik/titik koma dibiarkan ("T.3." tidak menjadi "T.3.;"); selainnya ditutup ';'.
      return /[;.]$/.test(t) ? t : `${t.replace(/\s+$/, "")};`;
    }
    const nm = buangNomorAwal(r.nm).trim();
    const an = String(r.an || "").trim();
    const no = String(r.no || "").trim();
    let k = nm;
    if (an) k += `${k ? " " : ""}atas nama ${an}`;
    if (no) k += `${k ? (nm && /\bnomor\b/i.test(nm) && !an ? " " : ", ") : ""}${jenisBukti(nm) === "ktp" ? "NIK" : "Nomor"} ${no}`;
    if (r.tgl) k += ` tanggal ${tglIndo(r.tgl)}`;
    else if (r.tglTeks) k += ` tanggal ${r.tglTeks}`;
    if (String(r.oleh || "").trim()) k += `, yang dikeluarkan oleh ${String(r.oleh).trim()}`;
    const m = Number(r.meterai) || 0;
    const c = Number(r.cocok) || 0;
    const METERAI = KAL_METERAI;
    const COCOK = ["telah dicocokkan dengan aslinya yang ternyata sesuai", "tidak dapat dicocokkan dengan aslinya", "dicocokkan dari fotokopinya", "telah dicocokkan dengan kopian sebelumnya dan ternyata sesuai", ""];
    const tm = METERAI[m] !== undefined ? METERAI[m] : METERAI[0];
    const tc = COCOK[c] !== undefined ? COCOK[c] : COCOK[0];
    k += tm;
    if (tc) k += tm ? `, serta ${tc}` : `, bukti surat tersebut ${tc}`;
    k += `, lalu diberi tanda ${kode} serta diberi tanggal dan paraf oleh Ketua Majelis;`;
    return k.replace(/^, /, "");
  }
  const susunKalimatBukti = (rows, pihak) => rows.map((r, i) => kalimatBukti(r, pihak, i)).join("\n");
  // ── Alat bukti elektronik (27 Okt): butir tambahan di ruas alat bukti surat yang sama; tersembunyi/kosong = teks lama tidak berubah ──
  /** Bentuk bukti elektronik yang lazim; elemen kedua = kata untuk hasil pengambilannya di kalimat pencocokan. */
  const BENTUK_EL = [
    ["Print Out/Hasil Cetak Foto", "cetak foto"],
    ["Tangkapan layar (screenshot)", "tangkapan layar"],
    ["Rekaman suara dalam flashdisk", "rekaman suara"],
    ["Rekaman video dalam flashdisk", "rekaman video"],
    ["Surel (e-mail)", "surel"],
  ];
  const PIL_PERIKSA_EL = [
    "Tidak dapat dicocokkan (pihak tidak dapat menghadirkan alatnya), tanpa digital forensic",
    "Telah dicocokkan dengan aslinya pada alat atau perangkatnya dan ternyata sesuai",
    "Disertai hasil digital forensic",
  ];
  const AWALAN_EL = ["P", "T", "PK", "TK", "PR", "TR"];
  const POLA_BUKTI_EL = /bukti elektronik tersebut/i;
  const butirElBaru = (pihak, awalan) => ({ bentuk: BENTUK_EL[0][0], objek: "", ket: "", pengaju: pihak === "T" ? "T" : "P", awalan: AWALAN_EL.includes(awalan) ? awalan : pihak === "T" ? "T" : "P", no: "", meterai: 0, periksa: 0, rapi: true, manual: null });
  // Keputusan pengguna 27 Okt: awalan bawaan P (Penggugat) / T (Tergugat), BUKAN PK/TK. Hanya bila daftar bukti surat pihak itu
  // sudah memakai tanda konvensi/rekonvensi (PK./TK./PR./TR.), bukti elektronik mengikuti tanda terakhir yang dipakai di sana.
  const POLA_AWALAN_KR = /\b(?:tanda|bertanda|kode)\s*:?\s*(?:bukti\s+)?\(?([PT])([KR])\s?[.-]\s?\d+/gi;
  function awalanBawaanEl(rows, pihak) {
    let a = "";
    for (const r of rows || []) {
      const t = typeof r?.manual === "string" ? r.manual : "";
      for (const m of t.matchAll(POLA_AWALAN_KR)) a = `${m[1]}${m[2]}`.toUpperCase();
    }
    return a || (pihak === "T" ? "T" : "P");
  }
  const hasilEl = (bentuk) => {
    const b = String(bentuk || "");
    const k = BENTUK_EL.find(([n]) => n.toLowerCase() === b.toLowerCase());
    if (k) return k[1];
    if (/video/i.test(b)) return "rekaman video";
    if (/rekaman|suara|audio/i.test(b)) return "rekaman suara";
    if (/tangkapan|screenshot|layar/i.test(b)) return "tangkapan layar";
    if (/surel|e-?mail/i.test(b)) return "surel";
    return "cetak foto";
  };
  /** Butir yang belum diisi apa pun (selain bawaan) tidak ikut ditulis ke ABT. */
  const butirElKosong = (b) => (typeof b.manual === "string" ? !b.manual.trim() : !String(b.objek || "").trim() && !String(b.ket || "").trim());
  /**
   * Satu kalimat bukti elektronik. ctx: { urut (nomor butir), tanda (nomor pada tanda bukti), sb: {P,T}, nomori }.
   * Varian pemeriksaan: 0 tidak dapat dicocokkan + tanpa digital forensic (bunyi contoh pengguna APA ADANYA, termasuk "yang yang" dan
   * "pengambikan", hanya bila "bunyi dirapikan" dimatikan - 28 Okt: dirapikan = bawaan), 1 dicocokkan dengan aslinya, 2 disertai hasil digital forensic.
   */
  function kalimatBuktiEl(b, ctx) {
    const awalan = String(b.awalan || "P").replace(/[^A-Za-z]/g, "") || "P";
    const tanda = `${awalan}.${String(b.no || "").trim() || ctx.tanda}`;
    const awal = ctx.nomori ? `${ctx.urut}. ` : "";
    if (typeof b.manual === "string" && b.manual.trim()) {
      const t = buangNomorAwal(b.manual).trim().replace(/\s+/g, " ");
      return `${awal}${/[;.]$/.test(t) ? t : `${t};`}`;
    }
    const sb = ctx.sb || { P: "Penggugat", T: "Tergugat" };
    const pengaju = b.pengaju === "T" ? sb.T : sb.P;
    const hasil = hasilEl(b.bentuk);
    const bentuk = String(b.bentuk || "").trim();
    const objek = String(b.objek || "").trim();
    const ket = String(b.ket || "").trim();
    let k = `${awal}${bentuk}${objek ? `${bentuk ? " " : ""}${objek}` : ""}${ket ? ` dengan keterangan ${ket}` : ""}`;
    const m = Number(b.meterai) || 0;
    if (KAL_METERAI[m]) k += KAL_METERAI[m];
    const periksa = Number(b.periksa) || 0;
    if (periksa === 1) k += `, bukti elektronik tersebut telah dicocokkan dengan aslinya dengan telekomunikasi atau alat yang digunakan untuk melakukan pengambilan ${hasil} tersebut dan ternyata sesuai`;
    else if (periksa === 2) k += ", bukti elektronik tersebut disertai dengan hasil digital forensic";
    else
      k += b.rapi !== false
        ? `, bukti elektronik tersebut tidak dapat dicocokkan dengan aslinya dengan telekomunikasi atau alat yang digunakan untuk melakukan pengambilan ${hasil} tersebut karena ${pengaju} tidak dapat menghadirkannya, dan bukti tersebut tidak disertai dengan digital forensic`
        : `, bukti elektronik tersebut tidak dapat dicocokkan dengan aslinya dengan telekomunikasi atau alat yang yang digunakan untuk melakukan pengambikan ${hasil} tersebut karena ${pengaju} tidak dapat menghadirkannya, dan bukti tersebut tidak disertai dengan digital forensic`;
    return `${k}, lalu oleh Ketua Majelis diberi tanda ${tanda};`;
  }
  /**
   * Teks ruas alat bukti surat yang dikirim ke ABT: kalimat bukti surat, lalu butir elektronik (bila ada yang terisi). Penomoran butir dan
   * nomor tanda melanjutkan jumlah bukti surat. Tanpa butir terisi hasilnya PERSIS susunKalimatBukti (fitur lama tidak berubah).
   */
  function susunTeksBukti(rows, pihak, el, sb) {
    const surat = susunKalimatBukti(rows || [], pihak);
    const butir = el && Array.isArray(el.butir) ? el.butir.filter((b) => !butirElKosong(b)) : [];
    if (!butir.length) return surat;
    const dasar = (rows || []).length;
    const baris = butir.map((b, i) => kalimatBuktiEl(b, { urut: dasar + i + 1, tanda: dasar + i + 1, sb, nomori: el.nomori !== false }));
    return surat ? `${surat}\n${baris.join("\n")}` : baris.join("\n");
  }
  /** Teks ruas -> { surat, el[] }: baris yang memuat "bukti elektronik tersebut" dipisahkan dari kalimat bukti surat. */
  function pisahBuktiElektronik(teks) {
    const surat = [];
    const el = [];
    for (const b of String(teks || "").replace(/\r\n/g, "\n").split("\n")) (POLA_BUKTI_EL.test(b) ? el : surat).push(b);
    return { surat: surat.join("\n"), el: el.map((x) => x.trim()).filter(Boolean) };
  }
  /** Baris elektronik dari teks tersimpan -> { butir (kalimat bebas), nomori }. */
  function butirElDariTeks(baris, pihak) {
    const butir = baris.map((x) => ({ ...butirElBaru(pihak), manual: buangNomorAwal(x) }));
    return { butir, nomori: baris.length ? baris.every((x) => /^\s*\(?\d{1,2}\s*[.)]/.test(x)) : true };
  }
  /**
   * Kalimat ABT (bawaan maupun tersimpan) -> baris terstruktur. Kalimat yang tidak berpola baku ALETA/ABT
   * ("Bukti tersebut telah diberi meterai ... kemudian diberi tanda pada surat tersebut dengan tanda T.3.")
   * dibuka sebagai "tulis manual" supaya tidak satu kata pun berubah.
   */
  function uraiBukti(teks) {
    const rows = [];
    const potongan = String(teks || "")
      .replace(/\r\n/g, "\n")
      .split(/\n+|(?<=;)\s+(?=Fotokopi|Fotocopy|Asli|Surat|Kutipan|Akta|Buku|Foto|Salinan)/)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const p0 of potongan) {
      const p = buangNomorAwal(p0);
      let s = p.replace(/\s+/g, " ").replace(/;$/, "");
      const r = buktiBaru("", "");
      if (!/bukti surat tersebut|,\s*lalu diberi tanda\s+[PT]\.\s?\d+\s+serta diberi tanggal/i.test(s)) {
        r.nm = (s.match(/^[^,.;]+/) || [s])[0].trim();
        r.manual = p.replace(/\s+/g, " ").trim();
        rows.push(r);
        continue;
      }
      const meterai = !/meterai/i.test(s) ? 3 : /tidak bermeterai/i.test(s) ? 2 : /tidak di-?nazegelen/i.test(s) ? 1 : 0;
      const cocok = /kopian sebelumnya/i.test(s) ? 3 : /tidak dapat dicocokkan/i.test(s) ? 1 : /dari fotokopinya/i.test(s) ? 2 : /dicocokkan/i.test(s) ? 0 : 4;
      s = s.replace(/,?\s*bukti surat tersebut[\s\S]*$/i, "").replace(/,?\s*lalu diberi tanda[\s\S]*$/i, "");
      const oleh = s.match(/,?\s*yang (?:dikeluarkan|diterbitkan) oleh\s+(.+?)$/i);
      if (oleh) {
        r.oleh = oleh[1].trim();
        s = s.slice(0, oleh.index);
      }
      s = s.replace(/[,\s]+$/, "");
      const tgl = s.match(/,?\s*\b(?:ter)?tanggal\s+([0-9]{1,2}[-/ ][A-Za-z0-9]+[-/ ][0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[.…_,\s]+)\s*$/i);
      if (tgl) {
        const tt = tgl[1].replace(/\s+/g, " ").trim();
        r.tgl = keIso(tt);
        if (!r.tgl && /[0-9]/.test(tt)) r.tglTeks = tt;
        s = s.slice(0, tgl.index);
      }
      s = s.replace(/[,\s]+$/, "");
      const nik = s.match(/,?\s*\bNIK\.?\s*:?\s*([0-9][0-9 .]*[0-9])\s*$/i);
      const no = nik || s.match(/,?\s*\bNomor\s*:?\s+(.+?)\s*$/i);
      if (no && !/^Nomor\s*$/i.test(s)) {
        r.no = no[1].trim();
        s = s.slice(0, no.index);
      }
      s = s.replace(/[,\s]+$/, "");
      const an = s.match(/\s+(?:atas nama|a\.\s?n\.)\s+(.+)$/i);
      if (an) {
        r.an = an[1].replace(/[,\s]+$/, "").trim();
        s = s.slice(0, an.index);
      }
      r.nm = s.replace(/[,\s]+$/, "").trim();
      r.meterai = meterai;
      r.cocok = cocok;
      if (r.nm || r.an || r.no) rows.push(r);
    }
    return rows;
  }
  /** "Ambil tanggal KTP dari bukti": tanggal KTP pihak yang terbaca dari berkas KTP e-Court -> kolom tanggal bukti KTP. */
  async function ambilTanggalKtp() {
    if (!S.pk) return toast("Pilih perkara dulu.");
    const adaKtp = ["P", "T"].some((w) => (S.bukti[w] || []).some((r) => typeof r.manual !== "string" && jenisBukti(r.nm) === "ktp"));
    if (!adaKtp) return toast("Belum ada bukti KTP di daftar alat bukti.");
    toast("Membaca tanggal KTP dari berkas e-Court…");
    let d;
    try {
      d = await ambilPortal(`${API_KTP_PIHAK}?nomor=${encodeURIComponent(nomorPerkara())}&tunggu=1`, { batasMs: BATAS_LAMA_MS }, "Membaca tanggal KTP");
    } catch (e) {
      return toast(`Tanggal KTP belum dapat dibaca: ${String((e && e.message) || e)}`);
    }
    const pihak = d && Array.isArray(d.pihak) ? d.pihak : [];
    let n = 0;
    for (const w of ["P", "T"]) {
      const rows = S.bukti[w];
      if (!rows) continue;
      const calon = pihak
        .filter((p) => Number(p.cabang) === (w === "P" ? 1 : 2) && p.tanggalKtp && String(p.yakin || "") !== "ragu")
        .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
      let j = 0;
      let ubah = false;
      for (const r of rows) {
        if (typeof r.manual === "string" || jenisBukti(r.nm) !== "ktp") continue;
        const c = calon[j++];
        if (!c) break;
        const iso = keIso(c.tanggalKtp);
        if (!iso || r.tgl === iso) continue;
        r.tgl = iso;
        delete r.tglTeks;
        n += 1;
        ubah = true;
      }
      if (ubah) simpanBukti(w, true);
    }
    renderIsian();
    toast(n ? `${n} tanggal KTP diisi dari berkas e-Court. Periksa sebelum cetak.` : pihak.length ? "Tanggal KTP pada bukti sudah sama dengan yang terbaca dari berkas e-Court." : "Belum ada tanggal KTP yang terbaca dari berkas e-Court perkara ini.");
  }
  /**
   * G2 (25 Okt 2026): daftar alat bukti dari e-Court yang "rapi" mengisi penyunting bukti HANYA bila isian ABT-nya KOSONG (tidak ada nilai
   * tersimpan, tidak ada bawaan blangko, tidak ada simpanan peramban), saklar Super Admin menyala (buktiOtomatis.aktif), dan bot menilai
   * daftar pihak itu rapi. Sekali per (perkara, pihak): baris yang kemudian dihapus petugas tidak diisi lagi. Tidak rapi -> tetap isian bawaan,
   * dengan keterangan dan tombol Salin. Bacaan atau penyimpanan gagal = tidak menulis.
   */
  async function barisBuktiEcourt(pihak) {
    try {
      if (!S.pk || !bolehTulis()) return null;
      const tanda = `bdBuktiOto:${perkaraId()}:${pihak}`;
      if ((await bacaPenyimpanan(tanda))[tanda]) return null;
      const sb = sebutan();
      const q = new URLSearchParams({ nomor: nomorPerkara(), lawan: sb.P, pelaku: sb.T, bukti: "1" });
      const isi = await ambilPortal(`${API_ISI_GUGATAN_JM}?${q.toString()}`, {}, "Membaca daftar bukti dari e-Court");
      const bo = isi && isi.buktiOtomatis;
      if (!bo || bo.aktif !== true) return null;
      const o = bo[pihak];
      if (!o || !Array.isArray(o.baris)) return null;
      const kalimat = Array.isArray(isi.kalimat) ? isi.kalimat.find((k) => k && k.kode === `bukti-surat-${pihak === "P" ? "0046" : "0047"}`) : null;
      const salin = (pesan) => {
        S.buktiOto[pihak] = { status: "salin", pesan, teks: kalimat ? String(kalimat.teks || "") : "" };
        return null;
      };
      if (o.rapi !== true || !o.baris.length) return o.rapi === false && Array.isArray(o.alasan) && o.alasan.length ? salin("Format daftar bukti di e-Court tidak rapi, silakan salin dan periksa.") : null;
      const nama = o.baris.map((r) => String((r && r.nm) || "").trim());
      if (nama.some((t) => !t) || hurufDiLuarAbt(nama.join(" ")).length) return salin("Format daftar bukti di e-Court tidak rapi (ada huruf yang tidak dapat disimpan ABT), silakan salin dan periksa.");
      void tulisPenyimpanan({ [tanda]: { saat: Date.now(), baris: nama.length } });
      S.buktiOto[pihak] = { status: "ditulis", pesan: `Daftar bukti ditulis otomatis dari berkas e-Court (${nama.length} butir) pukul ${jamSekarang()}. Periksa sebelum dipakai; meterai dan pencocokan diisi majelis.` };
      return nama.map((n) => buktiBaru(n, ""));
    } catch {
      return null;
    }
  }
  async function siapkanBukti() {
    if (!S.susunan) return;
    for (const b of S.susunan.isian.filter((x) => x.khusus === "bukti")) {
      const pihak = b.pihak;
      let dariEcourt = false;
      const s = await bacaPenyimpanan(`bdBukti:${perkaraId()}:${pihak}`);
      const simpanan = s[`bdBukti:${perkaraId()}:${pihak}`];
      let rows = null;
      let el = null;
      let teksAsal = "";
      const v = S.nilai[b.kode];
      const elSimpan = simpanan && simpanan.el && Array.isArray(simpanan.el.butir) ? simpanan.el : null;
      if (simpanan && Array.isArray(simpanan.rows) && v && v.status === "terisi" && susunTeksBukti(simpanan.rows, pihak, elSimpan, sebutan()) === String(v.teks || "").replace(/\r\n/g, "\n")) {
        rows = simpanan.rows;
        el = elSimpan;
      }
      else if (v && v.status === "terisi" && String(v.teks || "").trim()) {
        // Butir bukti elektronik (kalimat "bukti elektronik tersebut ...") dipisahkan dari bukti surat; tanpa simpanan dibuka sebagai kalimat bebas.
        const pisah = pisahBuktiElektronik(v.teks);
        teksAsal = pisah.surat;
        rows = uraiBukti(pisah.surat);
        if (pisah.el.length) el = butirElDariTeks(pisah.el, pihak);
      }
      else {
        // Bawaan blangko dihitung ABT (nama pihak, NIK dari SIPP) - dibaca dari jendela sembulnya.
        try {
          const h = await klienAbt().bacaIsian(b.kode, perkaraId(), "", sidangUrutan());
          if (h.ok && String(h.nilai || "").trim()) {
            teksAsal = String(h.nilai);
            rows = uraiBukti(h.nilai);
          }
        } catch {
          /* tanpa bawaan */
        }
        if (!rows || !rows.length) {
          const baruEcourt = await barisBuktiEcourt(pihak);
          if (baruEcourt && baruEcourt.length) {
            rows = baruEcourt;
            dariEcourt = true;
          }
        }
        if (!rows || !rows.length) {
          const sb = sebutan();
          rows = pihak === "P" ? [buktiBaru(`Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama ${sb.P}`, "Pemerintah Kabupaten"), buktiBaru("Fotokopi Kutipan Akta Nikah", "Kantor Urusan Agama Kecamatan")] : [buktiBaru(`Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama ${sb.T}`, "Pemerintah Kabupaten")];
        }
      }
      // Baris lama (simpanan peramban atau kalimat ABT) yang masih memuat penomoran awal dibersihkan, dan hasilnya disimpan.
      // Kalimat asal (tersimpan di ABT atau bawaannya) yang masih bernomor ikut ditulis ulang tanpa penomoran.
      let berubahNomor = POLA_BUKTI_BERNOMOR.test(teksAsal);
      for (const r of rows) {
        const nmBersih = buangNomorAwal(r.nm);
        if (nmBersih !== String(r.nm || "")) {
          r.nm = nmBersih;
          berubahNomor = true;
        }
        if (typeof r.manual === "string" && buangNomorAwal(r.manual) !== r.manual) {
          r.manual = buangNomorAwal(r.manual);
          berubahNomor = true;
        }
      }
      S.bukti[pihak] = rows;
      S.buktiEl[pihak] = el || { butir: [], nomori: true };
      if ((berubahNomor || dariEcourt) && bolehTulis()) simpanBukti(pihak, false);
    }
    renderIsian();
    laporKeKerangka();
  }
  /** Butir bukti elektronik satu pihak (dibuat bila belum ada). */
  const elPihak = (w) => S.buktiEl[w] || (S.buktiEl[w] = { butir: [], nomori: true });
  function simpanBukti(pihak, segera) {
    const b = S.susunan && S.susunan.isian.find((x) => x.khusus === "bukti" && x.pihak === pihak);
    if (tes() || !b || !S.bukti[pihak]) return;
    void tulisPenyimpanan({ [`bdBukti:${perkaraId()}:${pihak}`]: { rows: S.bukti[pihak], el: elPihak(pihak), saat: Date.now() } });
    jadwalkanSimpan(b.kode, susunTeksBukti(S.bukti[pihak], pihak, elPihak(pihak), sebutan()), segera);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tanya jawab saksi / pihak (abt tanyajawab_perkara_edit) per sidang
  // ──────────────────────────────────────────────────────────────────────────
  const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const kataSet = (t) => new Set(norm(t).replace(/\b(saat ini|sekarang)\b/g, "kini").split(" ").filter((w) => w.length > 2));
  function mirip(a, b) {
    const A = kataSet(a);
    const B = kataSet(b);
    if (!A.size || !B.size) return norm(a) === norm(b);
    let sama = 0;
    A.forEach((w) => {
      if (B.has(w)) sama += 1;
    });
    return sama / (A.size + B.size - sama) >= 0.8;
  }
  const GANTI_KATA = [
    [/\bSaya kenal dengan\b/, "Saya mengenal"], [/\bSaya kenal\b/, "Saya mengenal"], [/\bsering terjadi\b/, "kerap terjadi"], [/\bperselisihan dan pertengkaran\b/, "pertengkaran dan perselisihan"],
    [/\bAwalnya\b/, "Mulanya"], [/\bsejak\b/, "semenjak"], [/\bkarena\b/, "sebab"], [/\bSudah tidak\b/, "Tidak lagi"], [/\bsudah tidak\b/, "tidak lagi"], [/\bmasih\b/, "tetap"],
    [/\bmeninggalkan rumah\b/, "pergi dari rumah"], [/\bsuami sah\b/, "suami yang sah"], [/\btetapi\b/, "namun"], [/\bsekarang\b/, "saat ini"], [/\bkakak kandung\b/, "saudara kandung"],
    [/\btinggal serumah\b/, "hidup serumah"], [/\bnamun tidak berhasil\b/, "tetapi tidak berhasil"], [/\bpisah tempat tinggal\b/, "berpisah rumah"],
  ];
  function gantiKalimat(t) {
    let h = String(t || "");
    let n = 0;
    for (const [re, b] of GANTI_KATA) {
      if (n >= 3) break;
      if (re.test(h)) {
        h = h.replace(re, b);
        n += 1;
      }
    }
    return h;
  }
  // 17 Okt: "tidak sanggup lagi" tidak lagi pola tegas - ia jawaban perkara atas "masih sanggup mendamaikan?".
  const POLA_PENUTUP = [/^(?:bahwa\s+)?(?:saya\s+|saksi\s+)?(?:sudah\s+)?cukup(?:\s+sekian)?[\s;.,!:]*$/i];
  const POLA_PENUTUP_UTUH = /^(?:bahwa\s+)?(?:sudah\s+)?cukup(?:\s+sekian)?\s*[;.]?$/i;
  const POLA_EKOR = /(^|[;.]\s+)(?:bahwa\s+)?(?:sudah\s+)?(?:cukup\s+sekian|sudah\s+cukup)\s*[;.]?\s*$/i;
  /** Pembersih kalimat penutup: memakai milik abt.js (F1.3, bentuk lentur) bila ada; cadangan pola baku. */
  function bersihkanPenutup(teks, tanya) {
    if (typeof bersihkanKeteranganSaksi === "function") return bersihkanKeteranganSaksi(teks, tanya);
    const rapat = String(teks || "").replace(/^[\s\-–•]+/, "").replace(/\s+/g, " ").trim();
    if (rapat && POLA_PENUTUP_UTUH.test(rapat)) return "";
    const baris = String(teks || "").replace(/\r\n/g, "\n").split("\n").filter((x) => {
      const b = x.replace(/^[\s\-–•]+/, "").replace(/\s+/g, " ").trim();
      return b === "" || !POLA_PENUTUP.some((p) => p.test(b));
    });
    let h = baris.map((x) => x.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (POLA_EKOR.test(h)) h = h.replace(POLA_EKOR, (m, a) => (a ? ";" : "")).trim();
    return h;
  }
  const tjItem = (kunci) => (S.susunan ? S.susunan.isian.find((x) => x.jenis === "tj" && x.tj && x.tj.kunci === kunci) : null);
  /** Pasangan berdampingan: dua saksi pihak yang sama dengan nomor berurutan (saksi 1 p & saksi 2 p). */
  function tjPasangan(kunci) {
    const semua = daftarPerlu().filter((x) => x.jenis === "tj").map((x) => x.tj.kunci);
    const m = String(kunci).match(/^saksi (\d+) ([pt])$/);
    if (!m) return null;
    const n = Number(m[1]);
    const dasar = n % 2 === 1 ? n : n - 1;
    const pas = [`saksi ${dasar} ${m[2]}`, `saksi ${dasar + 1} ${m[2]}`];
    return pas.every((k) => semua.includes(k)) ? pas : null;
  }
  async function bukaTj(kunci) {
    const it = tjItem(kunci);
    if (!it) return;
    if (!it.tj.kodeSunting) return toast(`Penyunting tanya jawab untuk ${it.tj.sebutan} tidak ada di katalog ABT.`);
    if (S.tjBuka === kunci) {
      S.tjBuka = null;
      renderTj();
      return;
    }
    S.tjBuka = kunci;
    S.tjRiw = { u: [], r: [] };
    S.sk.tinjau = null;
    S.tjMenu = false;
    S.tjTujuan = null;
    // 19 Okt (tahap 2): putusan / peran hakim hanya MEMBACA - satu saksi, tanpa set pertanyaan dan tanpa jawaban otomatis.
    if (deretTj().hanyaBaca) {
      renderTj();
      await muatTj(kunci);
      renderTj();
      return;
    }
    const pas = S.tjSisi ? tjPasangan(kunci) : null;
    renderTj();
    void muatAlasanPosita(); // berjalan sendiri: daftar alasan menyesuaikan diri begitu posita terbaca
    await Promise.all([...(pas || [kunci]).map((k) => muatTj(k)), muatSetSaksi(), muatPilSaksi(), muatAlasanSaksi()]);
    renderTj();
    void isiOtomatis(pas || [kunci], {});
  }
  /** Baris tanya-jawab yang berisi (pertanyaan atau jawaban tidak kosong). */
  const barisTjBerisi = (baris) => (Array.isArray(baris) ? baris : []).some((r) => String((r && r.tanya) || "").trim() || String((r && r.jawab) || "").trim());
  /**
   * 27 Okt: urutan sidang yang dicoba bila sidang terpilih tidak memuat keterangan saksi - keterangan saksi sering
   * diperiksa di sidang pembuktian SEBELUM sidang putusan (601/Pdt.G/2026: saksi di sidang ke-2, putusan di sidang ke-3).
   * Urutan: sidang sebelumnya (terdekat dulu), lalu sesudahnya. Kosong bila sidang terpilih tidak punya urutan (d kosong =
   * ABT sudah membaca semua sidang).
   */
  function urutanSidangTj(d) {
    const dasar = Number(d) || 0;
    if (!dasar) return [];
    const ada = new Set((S.pk && Array.isArray(S.pk.sidang) ? S.pk.sidang : []).map((s) => Number(s && s.urutan)).filter((n) => n > 0));
    if (!ada.size) for (let n = 1; n < dasar; n += 1) ada.add(n); // daftar sidang SIPP tak terbaca: sidang sebelumnya saja
    ada.delete(dasar);
    const sebelum = [...ada].filter((n) => n < dasar).sort((a, b) => b - a);
    const sesudah = [...ada].filter((n) => n > dasar).sort((a, b) => a - b);
    return [...sebelum, ...sesudah].slice(0, 8).map(String);
  }
  /**
   * Baca keterangan saksi satu penyunting pada sidang `d`; bila `lintas` dan sidang itu kosong, cari sidang lain perkara ini
   * yang memuatnya. Hanya MEMBACA. Pulang { h, sidang } - `sidang` = sidang tempat keterangan sebenarnya tersimpan.
   */
  async function bacaTjLintas(kode, d, lintas) {
    const k = klienAbt();
    const minta = (n) => ({ kode, perkaraId: perkaraId(), sidang: n, a: S.blangko ? S.blangko.a : "", b: S.blangko ? S.blangko.b : "" });
    const h = await k.bacaTanyaJawab(minta(d));
    if (!lintas || !h || !h.ok || barisTjBerisi(h.baris)) return { h, sidang: d };
    for (const n of urutanSidangTj(d)) {
      try {
        const x = await k.bacaTanyaJawab(minta(n));
        if (x && x.ok && barisTjBerisi(x.baris)) return { h: x, sidang: n };
      } catch {
        /* sidang itu tidak terbaca: coba berikutnya */
      }
    }
    return { h, sidang: d };
  }
  /** " (15 Oktober 2026)" untuk sidang urutan n bila tanggalnya diketahui dari SIPP; kosong bila tidak. */
  function tanggalSidangUrutan(n) {
    const s = (S.pk && Array.isArray(S.pk.sidang) ? S.pk.sidang : []).find((x) => String(x && x.urutan) === String(n));
    return s && s.tanggal ? ` (${tglIndo(String(s.tanggal).slice(0, 10))})` : "";
  }
  async function muatTj(kunci, paksa) {
    const it = tjItem(kunci);
    if (!it) return;
    const d = sidangUrutan();
    const ada = S.tj[kunci];
    if (ada && ada.dimuat && ada.sidang === d && !paksa) return;
    S.tj[kunci] = { kode: it.tj.kodeSunting, rows: ada && ada.sidang === d ? ada.rows : [], templates: ada ? ada.templates : [], dimuat: false, memuat: true, berubah: ada && ada.sidang === d ? ada.berubah : false, sidang: d, sidangBaca: d, galat: "" };
    renderTj();
    try {
      // Hanya baca (putusan / peran hakim): keterangan di sidang pembuktian sebelumnya ikut terbaca. Penyunting BAS tetap
      // memuat sidang yang dipilih saja - ia menulis ke sidang itu.
      const lin = await bacaTjLintas(it.tj.kodeSunting, d, deretTj().hanyaBaca);
      const h = lin.h;
      const t = S.tj[kunci];
      if (!t || t.sidang !== d) return;
      t.sidangBaca = lin.sidang;
      if (!h.ok) t.galat = h.pesan || "Tanya jawab tidak terbaca.";
      else {
        if (!t.berubah) t.rows = tandaiDasarBaris(h.baris.map((r) => ({ no: r.no, tanya: r.tanya, jawab: r.jawab })), false);
        t.templates = h.templates;
        t.keterangan = h.keterangan;
        t.galat = ""; // peringatan "belum terbaca" dari percobaan simpan sebelum bacaan selesai tidak boleh tertinggal
        t.dimuat = true;
      }
      t.memuat = false;
    } catch (e) {
      const t = S.tj[kunci];
      if (t) {
        t.galat = String((e && e.message) || e);
        t.memuat = false;
      }
    }
    renderTj();
    laporKeKerangka();
  }
  async function muatTemplatTj(kunci, templat) {
    const t = S.tj[kunci];
    if (!t) return;
    const h = await klienAbt().muatTemplat({ kode: t.kode, perkaraId: perkaraId(), sidang: t.sidang, templat, a: S.blangko.a, b: S.blangko.b });
    if (!h.ok) return toast(`Set pertanyaan tidak termuat: ${h.pesan || "ABT tidak menjawab"}`);
    t.rows = tandaiDasarBaris(h.baris.map((r, i) => ({ no: String(i + 1), tanya: r.tanya, jawab: r.jawab })), true);
    const tp = (t.templates || []).find((x) => x.nilai === templat);
    t.kodeKumpulan = tp && tp.kode && tp.kode !== "#" ? tp.kode : String(templat || "");
    t.berubah = true;
  }
  // Set pertanyaan saksi ALETA (F3.3): panduan per jenis perkara & huruf alasan dari portal
  // (lib/set-pertanyaan-saksi.ts). Dimuat ke layar saja; tersimpan ke ABT hanya lewat "Simpan ke ABT".
  async function muatSetSaksi() {
    if (!S.blangko || !S.pk) return;
    const sb = sebutan();
    const pihakP = S.pk.perkara && S.pk.perkara.pihak && S.pk.perkara.pihak.penggugat;
    const q = new URLSearchParams({ jenis: String(S.pk.jenisPerkara || ""), nomor: nomorPerkara(), folder: S.blangko.folder || S.blangko.kelompok || "", sebutanP: sb.P, sebutanT: sb.T, jumlahP: String(Array.isArray(pihakP) && pihakP.length ? pihakP.length : 1), huruf: alasanHuruf(), perkaraId: perkaraId() });
    const kunci = q.toString();
    if (S.setSaksi && S.setSaksi.kunci === kunci) return;
    S.setSaksi = { kunci, daftar: [], memuat: true };
    let daftar = [];
    try {
      const d = await ambilPortal(`${API_BLANGKO}/set-saksi?${kunci}`, {}, "Membaca set pertanyaan saksi");
      daftar = d && Array.isArray(d.set) ? d.set.filter((x) => x && x.id && Array.isArray(x.baris)) : [];
    } catch {
      /* tanpa panduan ALETA - set ABT tetap tersedia */
    }
    if (S.setSaksi && S.setSaksi.kunci === kunci) S.setSaksi = { kunci, daftar, memuat: false };
  }
  /** Muat set ALETA ke penyunting: set utama mengganti daftar, set tambahan disisipkan sebelum pertanyaan penutup. */
  function pakaiSetSaksi(kunci, id) {
    const t = S.tj[kunci];
    const s = S.setSaksi && S.setSaksi.daftar.find((x) => x.id === id);
    if (!t || !s) return null;
    const baru = s.baris.map((r) => ({ tanya: String(r.tanya || ""), jawab: String(r.jawab || "") }));
    let rows = baru;
    if (s.tambahan) {
      const lama = t.rows.filter((r) => String(r.tanya || "").trim() || String(r.jawab || "").trim());
      const akhir = lama.length && /masih ada (yang|keterangan|hal)/i.test(lama[lama.length - 1].tanya) ? lama.length - 1 : lama.length;
      rows = [...lama.slice(0, akhir), ...baru, ...lama.slice(akhir)];
    }
    // Baris set menjadi dasar jawaban otomatis; baris lama (yang disisipi) tetap membawa tanda aslinya.
    const barisBaru = new Set(baru);
    t.rows = rows.map((r, i) => ({ ...r, ...(barisBaru.has(r) ? { dasar: String(r.jawab || "") } : {}), no: String(i + 1) }));
    t.kodeKumpulan = s.tambahan ? t.kodeKumpulan || "" : `ALETA:${id}`;
    t.berubah = true;
    return s;
  }
  // ──────────────────────────────────────────────────────────────────────────
  // Jawaban saksi otomatis + pilihan pengetahuan saksi (blangko-derry-saksi.js)
  // Sumbernya SAMA dengan "Susun keterangan saksi" di panel ABT: permintaan 'saksi-sdg' ke server.
  // Isian yang sudah diketik petugas tidak pernah ditimpa tanpa konfirmasi di halaman.
  // ──────────────────────────────────────────────────────────────────────────
  const SK = () => (typeof globalThis !== "undefined" && globalThis.AletaBdSaksi) || null;
  const tandaiDasarBaris = (rows, semua) => (SK() ? SK().tandaiDasar(rows, semua) : rows);
  const kunciSaksiSemua = () => daftarPerlu().filter((x) => x.jenis === "tj").map((x) => x.tj.kunci);
  const urutSaksi = (kunci) => Math.max(0, kunciSaksiSemua().indexOf(kunci));
  const grupSaksi = (kunci) => tjPasangan(kunci) || [kunci];
  async function muatPilSaksi() {
    const id = perkaraId();
    if (!id || S.sk.perkara === id) return;
    S.sk.perkara = id;
    S.sk.pil = {};
    const kunci = `bdSaksiPil:${id}`;
    const v = (await bacaPenyimpanan(kunci))[kunci];
    if (v && typeof v === "object" && v.pil && typeof v.pil === "object" && S.sk.perkara === id) S.sk.pil = v.pil;
  }
  function simpanPilSaksi() {
    if (tes() || !perkaraId()) return;
    void tulisPenyimpanan({ [`bdSaksiPil:${perkaraId()}`]: { pil: S.sk.pil, saat: Date.now() } });
  }
  async function muatAlasanSaksi() {
    const m = SK();
    if (!m || S.sk.alasan) return;
    S.sk.alasan = m.alasanBawaan();
    if (typeof muatAlasanSdg === "function") {
      try {
        const d = await muatAlasanSdg();
        if (d && Array.isArray(d.pilihan) && d.pilihan.length) S.sk.alasan = d.pilihan;
      } catch {
        /* pilihan alasan baku sudah terpasang */
      }
    }
  }
  /**
   * Alasan yang terbaca dari POSITA perkara ini (rute 'alasan-posita' bot - sumber yang sama dengan "Susun saksi" di panel
   * ABT). Dipakai centang "Hanya sebagian alasan yang ia ketahui": hanya alasan yang ada di posita tampil langsung, sisanya
   * dilipat di "Alasan lain". Gagal/belum terbaca = semua alasan tampil seperti dahulu.
   */
  async function muatAlasanPosita() {
    const id = perkaraId();
    if (!id || S.sk.alasanPosita.perkara === id) return;
    S.sk.alasanPosita = { perkara: id, keadaan: "memuat", sesuai: null };
    let posita = "";
    try {
      const b = await bacaBahanSaksi(false);
      posita = (b && b.posita) || "";
    } catch {
      /* posita tidak terbaca dari ABT: server membaca posita dari SIPP */
    }
    let hasil = { perkara: id, keadaan: "gagal", sesuai: null };
    try {
      const d = await ambilUsulan({ nomorPerkara: nomorPerkara(), sumber: "alasan-posita", posita });
      const ap = d && d.alasanPosita;
      if (ap && ap.ok && Array.isArray(ap.alasan)) hasil = { perkara: id, keadaan: "siap", sesuai: new Set(ap.alasan.map(String)) };
    } catch {
      /* semua alasan tampil */
    }
    if (S.sk.alasanPosita.perkara !== id) return;
    S.sk.alasanPosita = hasil;
    renderTj();
  }
  /**
   * Isian blangko perkara ini (kode ABT -> {nilai, keyakinan}) untuk pengisi jawaban saksi bersumber: yang sudah terisi/ditemukan
   * kartu isian, ditambah saran SIPP yang belum pasti (keyakinan ragu). Dibatasi jumlah dan panjangnya.
   */
  function kumpulIsianSaksi() {
    const hasil = {};
    let n = 0;
    for (const [kode, v] of Object.entries(S.isi || {})) {
      const nilai = String(v == null ? "" : v).trim();
      if (!nilai || !/^\d{3,5}$/.test(kode) || n >= 250) continue;
      const info = S.info && S.info[kode];
      hasil[kode] = { nilai: nilai.slice(0, 700), keyakinan: (info && info.keyakinan) || "pasti" };
      n += 1;
    }
    for (const [kode, sr] of Object.entries(S.saranSipp || {})) {
      const nilai = String((sr && sr.nilai) || "").trim();
      if (!nilai || hasil[kode] || !/^\d{3,5}$/.test(kode) || n >= 250) continue;
      hasil[kode] = { nilai: nilai.slice(0, 700), keyakinan: (sr && sr.keyakinan) || "ragu" };
      n += 1;
    }
    return hasil;
  }
  if (typeof globalThis !== "undefined") globalThis.AletaBdIsianSaksi = kumpulIsianSaksi;
  const ambilUsulan = (muatan) => ambilPortal(API_USULAN,{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(muatan) }, "Menyusun jawaban saksi");
  const idJenisSipp = () => (typeof idJenisPerkaraSipp === "function" ? idJenisPerkaraSipp((S.pk && S.pk.jenisPerkara) || "") : String((S.pk && S.pk.jenisPerkara) || ""));
  /** alur_perkara_id SIPP: dari data perkara bila ada, selain itu dari nomor perkara (15 gugatan, 16 permohonan, 17 gugatan sederhana). */
  const alurSipp = () => {
    if (S.pk && S.pk.alurPerkaraId) return String(S.pk.alurPerkaraId);
    if (typeof idAlurPerkaraSipp === "function") return idAlurPerkaraSipp(nomorPerkara());
    const n = nomorPerkara();
    return /Pdt\.G\.S\b/i.test(n) ? "17" : /Pdt\.G\b/i.test(n) ? "15" : /Pdt\.P\b/i.test(n) ? "16" : "";
  };
  const tanggalSidangIso = () => {
    const d = S.pk && S.pk.sidangDipilih && S.pk.sidangDipilih.tanggal;
    return /^\d{4}-\d{2}-\d{2}/.test(String(d || "")) ? String(d).slice(0, 10) : "";
  };
  /** Menempelkan keyakinan/sumber usulan ke baris yang baru diisi (modul tampilan); tanpa modul, hasil apa adanya. */
  const tandaiUsulanRes = (rows, res, sj) => (TP() ? TP().tandaiUsulan(rows, res, sj) : res);
  const jawabanSaksiDari = (h, grup, k) => {
    const idx = grup.indexOf(k);
    const sj = Array.isArray(h.saksi) && h.saksi[idx] ? h.saksi[idx].jawaban : idx === 0 ? h.saksi1 : idx === 1 ? h.saksi2 : [];
    const para = Array.isArray(h.paragrafSaksi) ? h.paragrafSaksi[idx] : null;
    return { sj, hubungan: para && para.hubungan };
  };
  /** Hasil server ditampung untuk ditinjau: berapa jawaban berubah, berapa tertahan (sudah diketik), berapa bila yang diketik ikut diganti. */
  function tampungTinjau(tg, grup, h, tandaKirim) {
    const m = SK();
    const tj = S.sk.tinjau;
    if (!m || !tj) return;
    for (const k of tg) {
      S.sk.status[k] = null;
      const t = S.tj[k];
      if (!t || m.tandaTanya(t.rows) !== tandaKirim) {
        S.sk.status[k] = { galat: "Daftar pertanyaan berubah selagi disusun; tekan Isi ulang dari data perkara sekali lagi." };
        continue;
      }
      const { sj, hubungan } = jawabanSaksiDari(h, grup, k);
      const biasa = m.pasangJawaban(t.rows, sj, { hubungan });
      tj.item.push({ k, sj, hubungan, tanda: tandaKirim, ubah: biasa.terisi, tahan: biasa.tertahan.length });
    }
  }
  /** Lanjutkan: memasang hasil yang sudah ditinjau. Jawaban ketikan petugas tetap dijaga kecuali dicentang "termasuk yang sudah diketik". */
  function terapkanTinjau() {
    const tj = S.sk.tinjau;
    const m = SK();
    if (!tj || !m) return;
    const timpa = tj.termasuk === true;
    S.sk.tinjau = null;
    const hasil = [];
    // 20 Okt (S7): hasil tinjauan susunan KATALOG sudah berupa baris jadi; ketikan petugas hanya diganti bila dicentang
    const dariKatalog = tj.item.filter((x) => x.kat);
    if (dariKatalog.length) {
      tjCatat(dariKatalog.map((x) => x.k));
      for (const x of dariKatalog) {
        const t = S.tj[x.k];
        if (!t) continue;
        t.rows = timpa ? x.rowsTimpa : x.rows;
        t.berubah = true;
        S.sk.status[x.k] = { teks: `Jawaban diisi ulang dari data perkara: ${timpa ? x.ubah + x.tahan : x.ubah} berubah${!timpa && x.tahan ? `, ${x.tahan} jawaban ketikan Anda dipertahankan` : ""}. Belum disimpan.` };
      }
      renderTj();
      laporKeKerangka();
      return;
    }
    for (const x of tj.item) {
      const t = S.tj[x.k];
      if (!t || m.tandaTanya(t.rows) !== x.tanda) {
        S.sk.status[x.k] = { galat: "Daftar pertanyaan berubah selagi ditinjau; tekan Isi ulang dari data perkara sekali lagi." };
        continue;
      }
      hasil.push({ k: x.k, t, res: tandaiUsulanRes(t.rows, m.pasangJawaban(t.rows, x.sj, { hubungan: x.hubungan, timpa }), x.sj) });
    }
    if (hasil.some((x) => x.res.terisi)) tjCatat(hasil.map((x) => x.k));
    for (const x of hasil) {
      if (x.res.terisi) {
        x.t.rows = x.res.rows;
        x.t.berubah = true;
      }
      S.sk.tertahan[x.k] = timpa ? [] : x.res.tertahan;
      S.sk.konfirmasi[x.k] = false;
      S.sk.status[x.k] = { teks: m.ringkasan(x.res) };
    }
    renderTj();
    laporKeKerangka();
  }
  /**
   * Menyusun jawaban otomatis untuk saksi `targets`. Hanya baris yang boleh diganti (kosong, contoh set, atau hasil otomatis
   * sebelumnya) yang berubah; sisanya dilaporkan sebagai tertahan. `opsi.lapor` = atas permintaan petugas (pilihan diubah,
   * tombol Isi ulang dari data perkara): hasil selalu dilaporkan. Tanpa itu (pemuatan otomatis) hanya yang benar-benar berubah yang dilaporkan.
   */
  function isiOtomatis(targets, opsi) {
    if (ktAktif()) return ktIsiOtomatis(targets, opsi);
    const m = SK();
    if (!m || !S.blangko || !S.pk) return Promise.resolve();
    const kerja = async () => {
      const o = opsi || {};
      // 20 Okt: "Isi ulang dari data perkara" - hasil server DITINJAU dulu (jumlah berubah/tertahan), baru dipasang atas persetujuan.
      if (o.tinjau) S.sk.tinjau = { kunci: targets.slice(), item: [], termasuk: false, siap: false };
      const sah = targets.filter((k) => S.tj[k] && S.tj[k].dimuat && !S.tj[k].memuat && tjItem(k));
      const kelompok = new Map();
      for (const k of sah) {
        const g = grupSaksi(k);
        const kk = `${g.join("|")}#${m.tandaTanya(S.tj[k].rows)}`;
        if (!kelompok.has(kk)) kelompok.set(kk, { grup: g, tg: [] });
        kelompok.get(kk).tg.push(k);
      }
      for (const { grup, tg } of kelompok.values()) {
        const sumber = S.tj[tg[0]].rows;
        if (!sumber.some((r) => String(r.tanya || "").trim())) continue;
        if (!o.lapor && !tg.some((k) => S.tj[k].rows.some((r) => String(r.jawab || r.dasar || "").trim() && m.dapatDiganti(r)))) continue;
        const templat = m.templatDariBaris(sumber);
        const saksi = grup.map((k) => {
          const n = Number((String(k).match(/^saksi (\d+)/) || [])[1]) || 1;
          const p = m.bakukanPilihan(S.sk.pil[k], urutSaksi(k));
          const pihak = / t$/.test(k) ? "T" : "P";
          return { pihak, ke: Math.min(n, m.BATAS_SAKSI[pihak]), modus: p.modus, sumber: p.sumber, alasan: p.alasan };
        });
        const tanda = JSON.stringify([saksi, templat, tg]);
        const kunciSig = grup.join("|");
        if (!o.lapor && S.sk.sig[kunciSig] === tanda) continue;
        S.sk.sig[kunciSig] = tanda;
        const sb = sebutan();
        const muatan = m.susunMuatan({
          nomorPerkara: nomorPerkara(),
          templat,
          kodeKumpulan: S.tj[tg[0]].kodeKumpulan || "",
          jenisPerkara: idJenisSipp(),
          alur: alurSipp(),
          pelaku: sb.T,
          lawan: sb.P,
          saksi,
          isian: kumpulIsianSaksi(),
        });
        const tgl = tanggalSidangIso();
        if (tgl) muatan.tanggalSidang = tgl;
        const tandaTanyaKirim = m.tandaTanya(sumber);
        for (const k of tg) S.sk.status[k] = { teks: "Menyusun jawaban dari data perkara…" };
        renderTj();
        let h;
        try {
          h = await m.minta(ambilUsulan, muatan);
        } catch (e) {
          for (const k of tg) S.sk.status[k] = o.lapor ? { galat: `Jawaban otomatis belum dapat disusun: ${String((e && e.message) || e)}` } : null;
          renderTj();
          continue;
        }
        if (o.tinjau) {
          tampungTinjau(tg, grup, h, tandaTanyaKirim);
          renderTj();
          continue;
        }
        const hasil = tg.map((k) => {
          const idx = grup.indexOf(k);
          const sj = Array.isArray(h.saksi) && h.saksi[idx] ? h.saksi[idx].jawaban : idx === 0 ? h.saksi1 : idx === 1 ? h.saksi2 : [];
          const para = Array.isArray(h.paragrafSaksi) ? h.paragrafSaksi[idx] : null;
          const t = S.tj[k];
          if (!t || m.tandaTanya(t.rows) !== tandaTanyaKirim) return { k, lewat: true };
          return { k, res: tandaiUsulanRes(t.rows, m.pasangJawaban(t.rows, sj, { hubungan: para && para.hubungan, timpa: o.timpa === true }), sj) };
        });
        if (hasil.some((x) => x.res && x.res.terisi)) tjCatat(grup);
        for (const x of hasil) {
          const t = S.tj[x.k];
          if (x.lewat || !t) {
            S.sk.status[x.k] = o.lapor ? { galat: "Daftar pertanyaan berubah selagi disusun; tekan Isi ulang dari data perkara." } : null;
            continue;
          }
          if (x.res.terisi) {
            t.rows = x.res.rows;
            t.berubah = true;
          }
          S.sk.tertahan[x.k] = o.lapor ? x.res.tertahan : [];
          S.sk.konfirmasi[x.k] = false;
          S.sk.status[x.k] = o.lapor || x.res.terisi ? { teks: m.ringkasan(x.res) } : null;
        }
        renderTj();
      }
      if (o.tinjau && S.sk.tinjau) {
        if (S.sk.tinjau.item.length) S.sk.tinjau.siap = true;
        else S.sk.tinjau = null;
        renderTj();
      }
      laporKeKerangka();
    };
    S.sk.rantai = S.sk.rantai.then(kerja, kerja).catch(() => {});
    return S.sk.rantai;
  }
  /** Menimpa jawaban yang sudah diketik dengan susunan otomatis: dua langkah, konfirmasi di halaman. */
  function timpaOtomatis(kunci) {
    const t = S.tj[kunci];
    const tt = S.sk.tertahan[kunci] || [];
    if (!t || !tt.length) return;
    if (!S.sk.konfirmasi[kunci]) {
      S.sk.konfirmasi[kunci] = true;
      return renderTj();
    }
    tjCatat(grupSaksi(kunci));
    for (const { i, usul } of tt) {
      const r = t.rows[i];
      if (!r) continue;
      if (r.dasar === undefined) r.dasar = r.jawab;
      r.jawab = usul;
      r.otomatis = usul;
    }
    t.berubah = true;
    S.sk.tertahan[kunci] = [];
    S.sk.konfirmasi[kunci] = false;
    S.sk.status[kunci] = { teks: `${tt.length} jawaban yang diketik diganti dengan susunan otomatis. Tekan Urungkan bila tidak jadi.` };
    renderTj();
    laporKeKerangka();
  }
  function ubahPilSaksi(kunci, bidang, el) {
    if (String(bidang).indexOf("kat-") === 0) return ubahKatalog(kunci, bidang, el);
    const m = SK();
    if (!m || !tjItem(kunci)) return;
    const p = m.bakukanPilihan(S.sk.pil[kunci], urutSaksi(kunci));
    if (bidang === "modus") p.modus = el.value;
    else if (bidang === "sumber") p.sumber = el.value;
    else if (bidang === "alasan") {
      const kartu = el.closest ? el.closest("[data-skkartu]") : null;
      p.alasan = Array.from(kartu ? kartu.querySelectorAll('[data-skfld="alasan"]') : []).filter((x) => x.checked).map((x) => x.value);
    }
    S.sk.pil[kunci] = m.bakukanPilihan(p, urutSaksi(kunci));
    S.sk.tinjau = null;
    simpanPilSaksi();
    renderTj();
    if (tjSiap([kunci])) void isiOtomatis([kunci], { lapor: true });
  }
  /** Panel "Pengetahuan saksi" di atas tabel tanya jawab: pilihan sama dengan Susun keterangan saksi di panel ABT. */
  function panelPengetahuan(keys) {
    const pkt = ktPanel(keys);
    if (pkt !== null) return pkt;
    const m = SK();
    if (!m) return "";
    const alasan = S.sk.alasan || m.alasanBawaan();
    const kartu = keys
      .map((k) => {
        const it = tjItem(k);
        if (!it) return "";
        const p = m.bakukanPilihan(S.sk.pil[k], urutSaksi(k));
        const mati = tjSiap([k]) ? "" : " disabled";
        const modus = m.DAFTAR_MODUS.map(([n, nama]) => `<option value="${esc(n)}"${n === p.modus ? " selected" : ""}>${esc(nama)}</option>`).join("");
        const sumber = m.DAFTAR_SUMBER.map(([n, nama]) => `<option value="${esc(n)}"${n === p.sumber ? " selected" : ""}>cerita dari ${esc(nama)}</option>`).join("");
        // 19 Okt (tahap 2): hanya alasan yang ada di posita perkara ini tampil langsung; sisanya di "Alasan lain" (dapat dibuka).
        // Semua kotak tetap ada di halaman (yang terlipat hanya disembunyikan) supaya pilihan tidak hilang saat menyimpan.
        const bagi = m.bagiAlasan(alasan, S.sk.alasanPosita.sesuai, p.alasan);
        const satuCentang = (a) => `<label class="bd-skcentang"><input type="checkbox" data-skkunci="${esc(k)}" data-skfld="alasan" value="${esc(a.kunci)}"${p.alasan.includes(a.kunci) ? " checked" : ""}${mati}> ${esc(a.label)}</label>`;
        const lainBuka = Boolean(S.sk.lainBuka[k]);
        const centang =
          bagi.utama.map(satuCentang).join("") +
          (bagi.lain.length
            ? `<button type="button" class="bd-btn kecil bd-skalasanlain" data-bd2="alasanlain" data-kunci="${esc(k)}" aria-expanded="${lainBuka}" title="Alasan yang tidak disebut di gugatan perkara ini">Alasan lain ${lainBuka ? "▾" : "▸"} (${bagi.lain.length})</button>` +
              `<span class="bd-skalasanisi" data-skalasanlain="${esc(k)}"${lainBuka ? "" : " hidden"}>${bagi.lain.map(satuCentang).join("")}</span>`
            : "");
        const ketPosita = bagi.dariPosita ? `<p class="bd-catat">Yang tampil adalah alasan yang disebut di gugatan perkara ini.</p>` : "";
        const st = S.sk.status[k];
        const tt = S.sk.tertahan[k] || [];
        const konf = S.sk.konfirmasi[k];
        return (
          `<div class="bd-skkartu" data-skkartu="${esc(k)}"><b class="bd-sknama">${esc(it.tj.sebutan)}</b>` +
          `<label class="bd-sklbl">Yang diketahui saksi<select data-skkunci="${esc(k)}" data-skfld="modus"${mati}>${modus}</select></label>` +
          (p.modus === "dari-cerita" ? `<label class="bd-sklbl">Siapa yang bercerita<select data-skkunci="${esc(k)}" data-skfld="sumber"${mati}>${sumber}</select></label>` : "") +
          (p.modus === "sebagian" ? `<fieldset class="bd-skalasan"><legend>Alasan yang ia ketahui</legend>${ketPosita}${centang}</fieldset>` : "") +
          (st && st.teks ? `<p class="bd-catat" role="status">${esc(st.teks)}</p>` : "") +
          (st && st.galat ? `<p class="bd-peringatan">${esc(st.galat)}</p>` : "") +
          (tt.length
            ? `<p class="bd-peringatan" role="status">${tt.length} jawaban yang sudah Anda ketik tidak diubah. ` +
              `<button type="button" class="bd-btn kecil${konf ? " kuning" : ""}" data-bd2="timpaoto" data-kunci="${esc(k)}">${konf ? `Klik sekali lagi untuk mengganti ${tt.length} jawaban` : "Ganti dengan susunan otomatis"}</button>` +
              `${konf ? ` <button type="button" class="bd-btn kecil" data-bd2="batalimpa" data-kunci="${esc(k)}">Batal</button>` : ""}</p>`
            : "") +
          `</div>`
        );
      })
      .join("");
    if (!kartu) return "";
    return `<div class="bd-skpanel" role="group" aria-label="Pengetahuan saksi"><div class="bd-skhead"><span class="bd-lbl">Pengetahuan saksi</span><button type="button" class="bd-btn kecil" data-bd2="isioto" data-kunci="${esc(keys.join("|"))}" ${tjSiap(keys) ? "" : "disabled"} title="Menyusun ulang jawaban dari data perkara. Sebelum dipasang, Anda melihat dulu berapa jawaban yang berubah.">Isi ulang dari data perkara</button></div>${htmlKonfirmasiIsiUlang(keys)}<div class="bd-skgrid">${kartu}</div></div>`;
  }
  /** Konfirmasi di halaman (bukan kotak dialog peramban) sebelum jawaban diisi ulang: jumlah yang berubah dan yang tertahan. */
  function htmlKonfirmasiIsiUlang(keys) {
    const tj = S.sk.tinjau;
    const m = TP();
    if (!tj || !tj.siap || !m || tj.kunci.join("|") !== keys.join("|")) return "";
    const butir = tj.item.map((x) => ({ ubah: x.ubah, tahan: x.tahan }));
    const tahanSemua = butir.reduce((n, x) => n + x.tahan, 0);
    const kal = m.kalimatKonfirmasi(butir, tj.termasuk);
    const tanpaUbah = kal.ubah === 0;
    return (
      `<div class="bd-skkonfirm" role="alertdialog" aria-label="Isi ulang dari data perkara" data-skkonfirm>` +
      `<p><b>Isi ulang jawaban dari data perkara?</b> <span data-skkal>${esc(kal.kalimat)}</span></p>` +
      (tahanSemua
        ? `<label class="bd-skcentang"><input type="checkbox" data-bd2="tinjautimpa"${tj.termasuk ? " checked" : ""}> termasuk yang sudah diketik (${tahanSemua} jawaban)</label>`
        : "") +
      (tanpaUbah ? `<p class="bd-catat">Tidak ada jawaban yang perlu berubah.</p>` : "") +
      `<div class="bd-baris"><button type="button" class="bd-btn kecil utama" data-bd2="isiulangya"${tanpaUbah ? " disabled" : ""}>Lanjutkan</button><button type="button" class="bd-btn kecil" data-bd2="isiulangbatal">Batal</button></div>` +
      `</div>`
    );
  }
  // ──────────────────────────────────────────────────────────────────────────
  // 20 Okt 2026: tanya jawab saksi menurut KATALOG jenis perkara (blangko-derry-katalog.js).
  // Perkara cerai (346/347 dan kumulasi) tetap memakai pilihan lama di atas. Jenis lain memakai katalog yang sama dengan
  // "Susun saksi" di panel ABT: keadaan perkara, peran saksi, tingkat pengetahuan, dan susunan pertanyaan mengikutinya.
  // Baris yang diketik petugas tidak pernah ditimpa; hasil susunan belum tersimpan sampai petugas menekan Simpan ke ABT.
  // ──────────────────────────────────────────────────────────────────────────
  function ktPerkaraObj() {
    const p = (S.pk && S.pk.perkara) || {};
    return {
      jenisPerkara: String((S.pk && S.pk.jenisPerkara) || p.jenisPerkara || ""),
      jenisPerkaraId: String(p.jenisPerkaraId || (S.pk && S.pk.jenisPerkaraId) || ""),
      alurPerkaraId: String((S.pk && S.pk.alurPerkaraId) || p.alurPerkaraId || ""),
      nomorPerkara: nomorPerkara(),
    };
  }
  let ktMemoKenal = { kunci: "", hasil: null };
  // K10 (25 Okt 2026): isi katalog saksi dimuat per jenis perkara (saksi-katalog-muat.js), bukan 9,4 MB di tiap halaman ABT.
  // Hasil kenali() diingat per perkara DAN per versi muat: katalog yang baru terpasang membuat hasilnya dihitung ulang.
  const ktPemuat = () => (typeof globalThis !== "undefined" && globalThis.AletaSaksiKatalogMuat && globalThis.AletaSaksiKatalogMuat.ada() ? globalThis.AletaSaksiKatalogMuat : null);
  const ktSedangMuat = new Set();
  /** Hasil kenali() untuk perkara yang terbuka (diingat per perkara); null bila modul katalog belum termuat. */
  function ktKenal() {
    const K = KT();
    if (!K || !S.pk) return null;
    const o = ktPerkaraObj();
    const pemuat = ktPemuat();
    const kunci = JSON.stringify(o) + (pemuat ? `|${pemuat.versi()}` : "");
    if (pemuat) {
      const kunciPerkara = JSON.stringify(o);
      if (!ktSedangMuat.has(kunciPerkara)) {
        ktSedangMuat.add(kunciPerkara);
        const sebelum = pemuat.versi();
        // id jenis/alur diturunkan modul katalog sendiri (dari id, atau dari nama jenis) - sama dengan yang dipakai kenali()
        const awal = K.kenali(o) || {};
        void pemuat.siapkan({ jenisPerkaraId: awal.jenisId || o.jenisPerkaraId, alurPerkaraId: awal.alurId || o.alurPerkaraId, nama: o.jenisPerkara }).then(() => {
          // Katalog baru terpasang: hitung ulang dan gambar ulang panel yang bergantung padanya.
          if (pemuat.versi() !== sebelum && S.pk && JSON.stringify(ktPerkaraObj()) === kunciPerkara) {
            ktMemoKenal = { kunci: "", hasil: null };
            try {
              if (S.susunan) {
                renderIsian();
                renderTj();
              }
            } catch {
              /* gambar ulang hanya kenyamanan */
            }
          }
        });
      }
    }
    if (ktMemoKenal.kunci !== kunci) ktMemoKenal = { kunci, hasil: K.kenali(o) };
    return ktMemoKenal.hasil;
  }
  /** Mode katalog (atau jenis tanpa katalog) aktif: panel dan penyusunan lama (khusus cerai) tidak dipakai. */
  function ktAktif() {
    const k = ktKenal();
    return Boolean(k && (k.mode === "katalog" || k.mode === "tanpa"));
  }
  /** Nama saksi di judul/tombol mengikuti sebutan menurut nomor alur/jenis ("Saksi 1 Pemohon" pada permohonan). */
  function ktSeragamkanNama(d) {
    const K = KT();
    if (!K || !d || !Array.isArray(d.isian) || !S.pk) return;
    const sb = sebutan();
    for (const b of d.isian) {
      if (b && b.jenis === "tj" && b.tj) {
        const nama = K.namaSaksi(b.tj.kunci, sb);
        if (nama) b.tj.sebutan = nama;
      }
    }
  }
  const ktState = () => {
    if (!S.sk.kt) S.sk.kt = { perkara: "", keadaan: {}, saksi: {}, jarang: false, var: {}, varKunci: "", muat: null };
    return S.sk.kt;
  };
  const ktSaksi = (kunci) => {
    const st = ktState();
    if (!st.saksi[kunci]) st.saksi[kunci] = { jenis: "melihat", sumber: "", keadaan: {} };
    return st.saksi[kunci];
  };
  /** Pilihan petugas (keadaan, pengetahuan tiap saksi) diingat per perkara, seperti pilihan saksi cerai. */
  function ktMuat() {
    const id = perkaraId();
    const st = ktState();
    if (!id) return Promise.resolve();
    if (st.perkara === id && st.muat) return st.muat;
    st.perkara = id;
    st.keadaan = {};
    st.saksi = {};
    st.jarang = false;
    st.muat = (async () => {
      const kunci = `bdSaksiKat:${id}`;
      const v = (await bacaPenyimpanan(kunci))[kunci];
      if (v && typeof v === "object" && st.perkara === id) {
        if (v.keadaan && typeof v.keadaan === "object") st.keadaan = v.keadaan;
        if (v.saksi && typeof v.saksi === "object") st.saksi = v.saksi;
        st.jarang = v.jarang === true;
      }
      renderTj();
    })();
    return st.muat;
  }
  function ktSimpan() {
    if (tes() || !perkaraId()) return;
    const st = ktState();
    void tulisPenyimpanan({ [`bdSaksiKat:${perkaraId()}`]: { keadaan: st.keadaan, saksi: st.saksi, jarang: st.jarang, saat: Date.now() } });
  }
  /** Keadaan perkara: bawaan katalog, lalu yang terbaca dari data perkara, lalu pilihan petugas. */
  function ktKeadaanPerkara(kenal) {
    const K = KT();
    const m = globalThis.AletaSaksiKatalog;
    const st = ktState();
    const pihak = S.pk && S.pk.perkara && S.pk.perkara.pihak && S.pk.perkara.pihak.penggugat;
    const sd = S.pk && S.pk.sidangDipilih;
    const data = K.keadaanDariData(kenal.kat, {
      alurId: kenal.alurId,
      jumlahPemohon: Array.isArray(pihak) ? pihak.length : 0,
      teksBlangko: S.blangko ? `${S.blangko.berkas || ""} ${S.blangko.folder || ""}` : "",
      hadir: sd && sd.hadir !== undefined && sd.hadir !== null && sd.hadir !== "" ? Number(sd.hadir) : null,
    });
    const keadaan = K.lengkapiBawaan(kenal.kat, Object.assign({}, m.keadaanBawaan(kenal.kat, {}), data.keadaan, st.keadaan));
    return { keadaan, dariData: data.dariData.filter((x) => !(x in st.keadaan)) };
  }
  /** Keadaan dan pengetahuan efektif satu saksi (pengetahuan yang tidak lagi ada di katalog untuk keadaan ini kembali ke "melihat"). */
  function ktSaksiEfektif(kunci, kenal, ker) {
    const K = KT();
    const st = ktSaksi(kunci);
    const pihak = K.pihakDariKunci(kunci);
    const keadaan = Object.assign({}, ker.keadaan, st.keadaan, { pihakSaksi: pihak });
    const pilihan = K.pilihanPengetahuan(kenal.kat, keadaan, pihak, K.tingkatDipakai(ktState().jarang));
    const jenis = pilihan.some((x) => x.nilai === st.jenis) ? st.jenis : "melihat";
    return { pihak, keadaan, pilihan, jenis, sumber: st.sumber };
  }
  /** Nilai variabel #nnnn# untuk teks pertanyaan: isian blangko, nilai yang sudah terbaca, lalu dibaca dari ABT (diingat per sidang). */
  async function ktBacaVariabel(kodes) {
    const hasil = {};
    const st = ktState();
    const kunciCache = `${perkaraId()}|${sidangUrutan()}`;
    if (st.varKunci !== kunciCache) {
      st.varKunci = kunciCache;
      st.var = {};
    }
    const m = globalThis.AletaSaksiKatalog;
    for (const kode of (kodes || []).slice(0, 14)) {
      if (kode in st.var) {
        if (st.var[kode]) hasil[kode] = st.var[kode];
        continue;
      }
      let v = String(S.isi[kode] || "").trim();
      if (!v && S.nilai && S.nilai[kode] && S.nilai[kode].status === "terisi") v = String(S.nilai[kode].teks || "").trim();
      if (!v) {
        try {
          const r = await klienAbt().bacaIsian(kode, perkaraId(), "", sidangUrutan());
          if (r && r.ok) v = mesinIsi().htmlKeTeks(r.nilai).trim();
        } catch {
          /* variabel tidak terbaca: penandanya dibiarkan, ABT mengisinya saat mencetak */
        }
      }
      if (v && m && m.tidakTerisi(v)) v = "";
      st.var[kode] = v;
      if (v) hasil[kode] = v;
    }
    return hasil;
  }
  const ktAdaIsi = (rows) => (rows || []).some((r) => String(r.tanya || "").trim() || String(r.jawab || "").trim());
  /**
   * Menyusun tanya jawab saksi dari katalog. `opsi.lapor` = atas permintaan petugas (pilihan diubah, Isi ulang, Muat katalog):
   * daftar yang sudah ada digabung dengan susunan katalog. Tanpa itu (pembukaan otomatis) hanya daftar yang masih kosong
   * sama sekali yang diisi. `opsi.gantiDaftar` = Muat katalog: daftar contoh/titik-titik diganti katalog.
   */
  function ktIsiOtomatis(targets, opsi) {
    const o = opsi || {};
    const kerja = async () => {
      const K = KT();
      const kenal = ktKenal();
      if (!K || !kenal || kenal.mode !== "katalog" || !S.blangko || !S.pk) return;
      await ktMuat();
      const sah = targets.filter((k) => S.tj[k] && S.tj[k].dimuat && !S.tj[k].memuat && tjItem(k));
      const sasaran = o.lapor ? sah : sah.filter((k) => !ktAdaIsi(S.tj[k].rows));
      if (!sasaran.length) return;
      const semua = kunciSaksiSemua().filter((k) => tjItem(k));
      const ker = ktKeadaanPerkara(kenal);
      const efektif = new Map(semua.map((k) => [k, ktSaksiEfektif(k, kenal, ker)]));
      const susun = (variabel) =>
        K.susun({
          kat: kenal.kat,
          sebutan: kenal.sebutan,
          benih: nomorPerkara(),
          keadaan: ker.keadaan,
          jarang: ktState().jarang,
          variabel,
          saksi: semua.map((k) => {
            const e = efektif.get(k);
            return { kunci: k, pihak: e.pihak, jenis: e.jenis, sumber: e.sumber, keadaan: ktSaksi(k).keadaan };
          }),
        });
      for (const k of sasaran) S.sk.status[k] = { teks: "Menyusun pertanyaan dari katalog jenis perkara…" };
      renderTj();
      let hasil;
      let usulan = null;
      try {
        hasil = susun(undefined);
        const nilaiVar = await ktBacaVariabel(hasil.variabelTanya);
        if (Object.keys(nilaiVar).length) hasil = susun((kode) => nilaiVar[kode]);
        const pengisi = typeof globalThis !== "undefined" ? globalThis.AletaBdJawabanKatalog : null;
        if (pengisi && typeof pengisi.usulkan === "function") {
          try {
            usulan = await pengisi.usulkan({ perkara: ktPerkaraObj(), kenal, keadaan: ker.keadaan, saksi: hasil.saksi, variabel: nilaiVar, kodeBelum: (hasil.variabelAbt || []).filter((kd) => !(kd in nilaiVar)) });
            // variabel ABT yang belum terbaca (nama anak, almarhum, ...) dihitung bot dari data perkara: pertanyaan disusun ulang memakainya
            const dariBot = usulan && usulan.variabel;
            if (dariBot && Object.keys(dariBot).length) {
              const gabungVar = Object.assign({}, nilaiVar);
              for (const [kd, v] of Object.entries(dariBot)) if (!gabungVar[kd]) gabungVar[kd] = v.teks;
              hasil = susun((kode) => gabungVar[kode]);
            }
          } catch {
            usulan = null; // pengisi jawaban gagal: jawaban dasar katalog tetap terpasang
          }
        }
      } catch (e) {
        for (const k of sasaran) S.sk.status[k] = { galat: `Pertanyaan belum dapat disusun: ${String((e && e.message) || e)}` };
        renderTj();
        return;
      }
      const dicatat = new Set();
      // 20 Okt (S7): "Isi ulang dari data perkara" pada susunan katalog meminta persetujuan dulu (jumlah berubah / tertahan).
      const tinjau = o.tinjau === true && Boolean(TP());
      if (tinjau) S.sk.tinjau = { kunci: sasaran.slice(), item: [], termasuk: false, siap: false };
      for (const k of sasaran) {
        const t = S.tj[k];
        const sk = hasil.saksi[semua.indexOf(k)];
        if (!t || !sk) {
          S.sk.status[k] = null;
          continue;
        }
        const g = K.gabung(t.rows, sk.baris, { gantiDaftar: o.gantiDaftar === true });
        if (tinjau) {
          const biasa = usulan ? K.terapkanUsulan(g.rows, usulan, k) : { rows: g.rows, tertahan: 0 };
          const timpaSemua = usulan ? K.terapkanUsulan(g.rows, usulan, k, { timpa: true }) : { rows: g.rows };
          const lama = new Set(t.rows.map((r) => `${r.tanya}${r.jawab}`));
          const ubah = biasa.rows.filter((r) => !lama.has(`${r.tanya}${r.jawab}`)).length;
          S.sk.status[k] = null;
          S.sk.tinjau.item.push({ k, kat: true, rows: biasa.rows, rowsTimpa: timpaSemua.rows, ubah, tahan: biasa.tertahan });
          continue;
        }
        if (ktAdaIsi(t.rows) && g.dipertahankan + g.diganti === 0 && o.gantiDaftar !== true && !t.rows.some((r) => r.butir)) {
          S.sk.status[k] = { teks: "Daftar pertanyaan ini bukan susunan katalog. Pilih set pertanyaan katalog di atas lalu tekan Muat bila ingin menyusunnya; jawaban yang sudah Anda ketik tetap dipertahankan." };
          continue;
        }
        const rows = usulan ? K.terapkanUsulan(g.rows, usulan, k).rows : g.rows;
        const sama = JSON.stringify(rows.map((r) => [r.tanya, r.jawab])) === JSON.stringify(t.rows.map((r) => [r.tanya, r.jawab]));
        if (!sama) {
          if (!dicatat.size) tjCatat(grupSaksi(k));
          dicatat.add(k);
          t.rows = rows;
          t.berubah = true;
        } else t.rows = rows;
        const potong = [];
        if (g.dipertahankan) potong.push(`${g.dipertahankan} jawaban ketikan Anda dipertahankan`);
        if (g.baru) potong.push(`${g.baru} pertanyaan baru`);
        if (g.dibuang) potong.push(`${g.dibuang} pertanyaan dibuang karena keadaannya berubah`);
        S.sk.status[k] = { teks: `Disusun dari katalog ${kenal.judul}: ${rows.length} pertanyaan${potong.length ? `; ${potong.join(", ")}` : ""}. Belum disimpan.` };
      }
      if (tinjau && S.sk.tinjau) {
        if (S.sk.tinjau.item.length) S.sk.tinjau.siap = true;
        else S.sk.tinjau = null;
      }
      renderTj();
      laporKeKerangka();
    };
    S.sk.rantai = S.sk.rantai.then(kerja, kerja).catch(() => {});
    return S.sk.rantai;
  }
  /** Saksi yang sedang terbuka di penyunting (pasangan berdampingan atau satu saksi). */
  const ktGrupBuka = () => (S.tjBuka ? (S.tjSisi && tjPasangan(S.tjBuka)) || [S.tjBuka] : []);
  function ubahKatalog(kunci, bidang, el) {
    if (!ktAktif()) return;
    const st = ktState();
    const [aksi, sub] = String(bidang).split(":");
    if (aksi === "kat-keadaan") {
      if (el.type === "checkbox") {
        const kartu = el.closest ? el.closest("[data-skkartu]") : null;
        st.keadaan[sub] = Array.from(kartu ? kartu.querySelectorAll(`[data-skfld="${bidang}"]`) : [el]).filter((x) => x.checked).map((x) => x.value);
      } else st.keadaan[sub] = el.value;
    } else if (aksi === "kat-jarang") st.jarang = Boolean(el.checked);
    else if (!tjItem(kunci)) return;
    else if (aksi === "kat-jenis") ktSaksi(kunci).jenis = el.value;
    else if (aksi === "kat-sumber") ktSaksi(kunci).sumber = el.value;
    else if (aksi === "kat-saksi") ktSaksi(kunci).keadaan[sub] = el.value;
    else return;
    ktSimpan();
    S.sk.tinjau = null;
    renderTj();
    const grup = ktGrupBuka();
    if (grup.length && tjSiap(grup)) void ktIsiOtomatis(grup, { lapor: true });
  }
  /** Panel "Pengetahuan saksi" mode katalog; null bila perkara ini cerai (panel lama dipakai). */
  function ktPanel(keys) {
    const K = KT();
    const kenal = ktKenal();
    if (!K || !kenal || kenal.mode === "cerai") return null;
    if (kenal.mode === "tanpa") return K.panelTanpaHtml(S.pk && S.pk.jenisPerkara);
    if (ktState().perkara !== perkaraId()) void ktMuat();
    const ker = ktKeadaanPerkara(kenal);
    const bidang = K.bidangKeadaan(kenal.kat, ker.keadaan, kenal.sebutan, ker.dariData);
    const kartu = keys
      .filter((k) => tjItem(k))
      .map((k) => {
        const e = ktSaksiEfektif(k, kenal, ker);
        const per = K.bidangKeadaan(kenal.kat, e.keadaan, kenal.sebutan, []).filter((b) => b.perSaksi);
        const st = S.sk.status[k];
        return {
          kunci: k,
          nama: tjItem(k).tj.sebutan,
          jenis: e.jenis,
          pilihan: e.pilihan,
          sumber: e.sumber || K.pilihanSumberCerita()[0].nilai,
          sumberPilihan: K.pilihanSumberCerita(),
          bidangSaksi: per,
          status: st && st.teks,
          galat: st && st.galat,
        };
      });
    if (!kartu.length) return "";
    return K.panelHtml({ judul: kenal.judul, keys, siap: tjSiap(keys), jarang: ktState().jarang, ada: true, bidang, kartu, konfirmasi: htmlKonfirmasiIsiUlang(keys) });
  }
  /** Pilihan "Katalog <jenis perkara>" di daftar Set pertanyaan (terpilih bawaan); kosong untuk cerai dan jenis tanpa katalog. */
  function ktOpsiSet() {
    const k = ktKenal();
    if (!k || k.mode !== "katalog") return "";
    return `<optgroup label="Katalog jenis perkara"><option value="katalog:${esc(k.kunci)}" selected title="Disusun dari keadaan perkara yang dipilih di panel Pengetahuan saksi">${esc(k.judul)} - disarankan</option></optgroup>`;
  }
  // Simpan ke ABT = HAPUS lalu isi ulang seluruh keterangan sidang itu. Sebelum keterangan
  // yang sudah ada di ABT terbaca, menyimpan (atau mengganti daftar) akan menghapusnya tanpa
  // pernah dilihat petugas - jadi penyunting baru boleh diubah/disimpan sesudah bacaan berhasil.
  function tjSiap(kunciDaftar) {
    return kunciDaftar.length > 0 && kunciDaftar.every((k) => S.tj[k] && S.tj[k].dimuat && !S.tj[k].memuat);
  }
  /**
   * C1 (U1): butir keterangan saksi yang BARU tersimpan ke ABT - usulan mesin (r.otomatis, atau kalimat dasar katalog r.dasar) vs teks
   * final di penyunting. Hanya saksi (bukan jawaban/replik/duplik). Tidak pernah melempar dan tidak ditunggu; saklar server mati =
   * tidak ada yang dikirim.
   */
  function catatButirTj(kunci, t, rows) {
    try {
      const J = JI();
      if (!J || typeof J.catatButir !== "function" || !S.pk) return;
      const m = /^saksi\s+(\d+)\s+([pt])\b/i.exec(String(kunci));
      if (!m) return;
      const pada = new Date().toISOString();
      const daftar = rows
        .map((r, i) => {
          const usulan = r.otomatis !== undefined ? String(r.otomatis) : r.dasar !== undefined ? String(r.dasar) : "";
          const kunciJawaban = String(r.kunciJawaban || "");
          const katalog = kunciJawaban ? kunciJawaban.split("/")[0] : "";
          const meta = r.usulan && typeof r.usulan === "object" ? r.usulan : {};
          return {
            perkaraId: String(perkaraId()),
            nomorPerkara: nomorPerkara(),
            sidang: String(t.sidang || ""),
            saksiKe: Number(m[1]),
            pihak: m[2].toUpperCase(),
            jalur: "blangko-derry",
            variabel: String(t.kode || ""),
            katalog,
            jenisPerkara: String(S.pk.jenisPerkara || ""),
            butir: String(r.butir || ""),
            jenisKeterangan: String(r.jenisKat || ""),
            nomorButir: i + 1,
            pertanyaan: String(r.tanya || ""),
            usulan,
            teksFinal: String(r.jawab || ""),
            sumberFakta: String(meta.sumber || ""),
            keyakinan: String(meta.yakin || ""),
            kodePola: katalog && r.butir ? `${katalog}/${r.butir}` : String(meta.kodePola || ""),
            pada,
          };
        })
        .filter((e) => e.usulan.trim() || e.teksFinal.trim());
      if (daftar.length) void J.catatButir(daftar);
    } catch {
      /* jejak tertinggal; keterangan saksi sudah tersimpan di ABT */
    }
  }
  var PESAN_TJ_BELUM_TERBACA = "Keterangan yang sudah ada di ABT belum terbaca - tunggu sampai selesai dibaca, atau tutup lalu buka lagi tanya jawab ini bila pembacaannya gagal. Tidak disimpan supaya keterangan lama tidak terhapus.";
  async function simpanTj(kunciDaftar) {
    if (!bolehTulis()) return toast(sebabTakTulis(`Tanya jawab ${NAMA_JENIS[S.blangko.jenis].toLowerCase()} hanya disimpan ${NAMA_PERAN[JENIS_PERAN[S.blangko.jenis]]}.`));
    for (const kunci of kunciDaftar) {
      const t = S.tj[kunci];
      if (!t) continue;
      if (!t.dimuat || t.memuat) {
        t.galat = PESAN_TJ_BELUM_TERBACA;
        renderTj();
        continue;
      }
      // 19 Okt (tahap 2): satu jawaban satu paragraf - baris baru di tengah kalimat dilebur (SIPP/ABT membuang <br>).
      let rows = t.rows.filter((r) => String(r.tanya || "").trim() || String(r.jawab || "").trim()).map((r) => ({ ...r, jawab: rapikanJawabSaksi(r.jawab) }));
      const gantiTj = [];
      rows = rows.map((r) => {
        const a = normalAbt(r.tanya);
        const j = normalAbt(r.jawab);
        for (const m of [...a.diganti, ...j.diganti]) if (!gantiTj.includes(m)) gantiTj.push(m);
        return a.diganti.length || j.diganti.length ? { ...r, tanya: a.teks, jawab: j.teks } : r;
      });
      if (gantiTj.length) {
        t.rows = t.rows.map((r) => ({ ...r, tanya: normalAbt(r.tanya).teks, jawab: normalAbt(r.jawab).teks }));
        t.ganti = gantiTj.join(" ");
      } else t.ganti = "";
      const luar = hurufDiLuarAbt(rows.map((r) => `${r.tanya} ${r.jawab}`).join(" "));
      if (luar.length) {
        t.galat = `huruf ${luar.join(" ")} tidak dapat disimpan ABT - ganti dengan huruf biasa`;
        renderTj();
        continue;
      }
      if (!rows.length) {
        // 20 Okt: peringatan "daftar kosong" diturunkan dari keadaan daftar SAAT INI (lihat statusDasar) - bukan teks tersimpan yang
        // tertinggal sesudah daftar terisi dan muncul dobel (satu per saksi) padahal daftarnya sudah 19 baris.
        if (TP()) {
          t.kosongSimpan = true;
          t.galat = "";
        } else t.galat = "Daftar kosong tidak disimpan (akan menghapus keterangan saksi di ABT). Hapus di ABT bila memang mau dikosongkan.";
        renderTj();
        continue;
      }
      t.kosongSimpan = false;
      t.menyimpan = `menyimpan ${rows.length} baris ke ABT… (ABT menulis satu per satu, bisa ${Math.max(5, rows.length * 4)} detik)`;
      t.galat = "";
      renderTj();
      try {
        const h = await klienAbt().simpanTanyaJawab({ kode: t.kode, perkaraId: perkaraId(), sidang: t.sidang, baris: rows.map((r, i) => ({ no: String(i + 1), tanya: r.tanya, jawab: r.jawab })), a: S.blangko.a, b: S.blangko.b });
        t.menyimpan = "";
        if (!h.ok) t.galat = h.pesan || "ABT tidak mengatakan tersimpan.";
        else {
          t.berubah = false;
          t.rows = rows.map((r, i) => ({ ...r, no: String(i + 1) }));
          t.tersimpanJam = jamSekarang();
          catatButirTj(kunci, t, t.rows);
          tandaiKotor();
          S.peringat = false;
          const it = tjItem(kunci);
          if (it) S.nilai[it.kode] = { status: "terisi", teks: "" };
        }
      } catch (e) {
        t.menyimpan = "";
        t.galat = String((e && e.message) || e);
      }
      renderTj();
    }
    laporKeKerangka();
  }
  // 19 Okt (tahap 2): riwayat menyimpan kunci saksinya juga, supaya satu langkah yang menyentuh saksi mana pun (tukar jawaban
  // dengan saksi lain) dapat diurungkan dari tampilan berdampingan maupun satu per satu.
  const salinTj = (ps) => JSON.stringify({ k: ps, d: ps.map((k) => (S.tj[k] ? S.tj[k].rows : [])) });
  function tjCatat(ps) {
    S.tjRiw.u.push(salinTj(ps));
    if (S.tjRiw.u.length > 50) S.tjRiw.u.shift();
    S.tjRiw.r = [];
  }
  function tjPulih(teks) {
    const o = JSON.parse(teks);
    o.k.forEach((k, i) => {
      if (S.tj[k]) {
        S.tj[k].rows = o.d[i];
        S.tj[k].berubah = true;
      }
    });
  }
  function tjSama(ps) {
    const A = S.tj[ps[0]].rows;
    const B = S.tj[ps[1]].rows;
    const n = Math.max(A.length, B.length);
    while (A.length < n) A.push({ no: String(A.length + 1), tanya: "", jawab: "" });
    while (B.length < n) B.push({ no: String(B.length + 1), tanya: "", jawab: "" });
    return [A, B, n];
  }
  function tjUbah(ps) {
    ps.forEach((k) => {
      if (S.tj[k]) S.tj[k].berubah = true;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // "Lihat semua isi data"
  // ──────────────────────────────────────────────────────────────────────────
  async function muatSemua() {
    if (!S.blangko || !S.susunan) return;
    S.semua = { memuat: true };
    renderSemua();
    try {
      const d = await ambilPortal(alamatSusunan(true), {}, "Membaca semua isi data");
      S.semua = { memuat: false, nilai: d.nilai || {}, nilaiAda: Boolean(d.nilaiAda), sebab: d.nilaiSebab || "", otomatis: d.otomatis || [], isian: d.isian || [] };
    } catch (e) {
      S.semua = { memuat: false, nilai: {}, nilaiAda: false, sebab: String((e && e.message) || e), otomatis: S.susunan.otomatis, isian: S.susunan.isian };
    }
    renderSemua();
  }
  const namaPihakSemua = () => {
    const p = S.pk && S.pk.perkara && S.pk.perkara.pihak;
    return p ? [...(p.penggugat || []), ...(p.tergugat || [])].map((x) => String(x).trim()).filter((x) => x.length > 3) : [];
  };
  const perluDisamarkan = (teks) => {
    const t = String(teks || "").toLowerCase();
    return namaPihakSemua().some((n) => t.includes(n.toLowerCase()));
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Layar: ringkasan blangko, perlu diisi, tanya jawab, semua isi data
  // ──────────────────────────────────────────────────────────────────────────
  function renderRingkasBlangko() {
    const w = wadah.blangko;
    if (!w) return;
    selaraskanPeran(); // peran berganti sejak blangko dipilih: pilihan lama dibuang sebelum saran dihitung
    const b = S.blangko;
    // 22 Okt: "Semua akun" (Super Admin/Admin tanpa peran terpilih) tanpa saran di langkah 2; saran ada di jendela Pilih blangko per tab.
    const tanpaSaran = semuaAkun();
    const jenisSaran = S.pk && !tanpaSaran ? jenisSaranAktif() : "";
    const rek = jenisSaran ? rekomendasiJenis(jenisSaran) : [];
    const disaran = b && rek.some((r) => samaBerkasSaran(r.berkas, b.berkas));
    const saranPertama = rek[0];
    const urutanSaran = S.pk ? sidangUrutan() : "";
    const peringatanSidang = b && b.jenis === "bas" && S.susunan && S.susunan.isian.some((x) => x.jenis !== "tj" && x.wajib)
      ? ikonInfo("info:persidang")
      : "";
    // Rancangan v12: [kelompok] [nama blangko] [disarankan] dalam satu kotak, lalu satu kalimat saran.
    w.innerHTML =
      `<div class="bd-tk"><div class="bd-ringkas" id="bd-blringkas" tabindex="0" role="button" title="Klik dua kali untuk memilih blangko" style="cursor:pointer">${
        b
          ? `<span class="bd-chip">${esc(b.judul || namaMenuTampil(b.kelompok) || NAMA_JENIS[b.jenis] || b.jenis)}</span><span class="bd-potong" title="${esc(namaTampil(b.berkas, b.jenis))} (klik dua kali untuk mengganti blangko)">${esc(namaTampil(b.berkas, b.jenis))}</span>${disaran ? `<span class="bd-chip sebagian">disarankan</span>` : ""}`
          : `<span class="bd-catat">Belum ada blangko dipilih</span>`
      }</div><button type="button" class="bd-btn kecil${b ? "" : " utama"}" data-bd2="bukamodal">${b ? "Ganti blangko" : "Pilih blangko"}</button>${peringatanSidang}</div>` +
      (S.pk
        ? `<p class="bd-petunjuk" id="bd-saranblangko">${
            saranPertama
              ? b && b.berkas === saranPertama.berkas
                ? `Blangko ini sesuai saran untuk sidang ke-${esc(urutanSaran)}${saranPertama.alasan ? ` (${esc(saranPertama.alasan)})` : ""}.`
                : `Saran untuk sidang ke-${esc(urutanSaran)}: <b>${esc(namaTampil(saranPertama.berkas, saranPertama.jenis))}</b>${saranPertama.alasan ? ` - ${esc(saranPertama.alasan)}` : ""} <button type="button" class="bd-btn kecil" data-bd2="pakairek">Pakai saran ini</button>`
              : jenisSaran
                ? `Belum ada saran blangko ${esc(NAMA_SARAN_JENIS[jenisSaran] || "")} untuk sidang ke-${esc(urutanSaran)}; pilih sendiri lewat Pilih blangko.`
                : "Pilih blangko lewat tombol Pilih blangko."
          }</p>`
        : "");
  }

  /**
   * Tahap H 16 Okt: tautan "Edit variabel ini" ke Pengaturan SIPP & ABT portal - hanya Super Admin/Admin (adm()); petugas lain tidak melihatnya.
   * 16 Okt malam: tautannya pindah ke keterangan ⓘ (kecil, di bawah), tidak lagi di kepala tiap kotak.
   */
  function alamatEditVariabel(kode) {
    return `${location.origin}${AKAR_PORTAL}/admin/pengaturan-sipp-abt?bagian=variabel&noVar=${encodeURIComponent(String(kode || ""))}`;
  }
  function tautanEditVariabel(kode) {
    if (!adm() || !/^\d{3,6}$/.test(String(kode || ""))) return "";
    return `<a class="bd-editvar" href="${esc(alamatEditVariabel(kode))}" target="_blank" rel="noopener" title="Buka pengaturan variabel #${esc(kode)}# di portal ALETA">Edit variabel ini</a>`;
  }
  /**
   * Satu-satunya ikon ⓘ per isian. Keterangan (`ket`, daftar kalimat) TIDAK tampil sebagai teks di kartu: ia ada di title
   * (tip saat kursor/telaah pembaca layar) dan di gelembung yang terbuka saat ikon diklik, bersama sumber isian.
   */
  function ikonSumber(id, nm, ket) {
    const k = (Array.isArray(ket) ? ket : []).filter(Boolean);
    return `<button type="button" class="bd-ikon bd-sumber${k.length ? " ada-ket" : ""}" data-sumber="${esc(id)}" aria-label="Dari mana isian ${esc(nm)} ini?" aria-haspopup="dialog" aria-expanded="false"${k.length ? ` title="${esc(k.join(" "))}"` : ""}>ⓘ</button>`;
  }
  /** Keterangan umum yang bukan milik satu isian (ⓘ memakai gelembung yang sama dengan sumber isian). */
  const INFO_UMUM = {
    get "info:persidang"() {
      // D6: saklar "isian-per-sidang" menyala -> isian ketikan BAS tersimpan per sidang di ALETA (ABT tetap satu nilai per perkara).
      const j = typeof globalThis !== "undefined" ? globalThis.AletaJejakIsian : null;
      if (j && typeof j.aktifSidangSegera === "function" && j.aktifSidangSegera() === true)
        return {
          label: "Keterangan: isian BAS tersimpan per sidang",
          judul: "Isian ketikan BAS berlaku per sidang",
          teks: "Isian ketikan BAS tersimpan per sidang di ALETA. Saat BAS sidang ini dicetak, isian sidang ini dipakai sementara di ABT lalu ABT dipulihkan seperti semula; BAS sidang lain tidak ikut berubah.",
        };
      return {
        label: "Keterangan: isian tersimpan per perkara, bukan per sidang",
        judul: "Isian ini berlaku untuk perkara, bukan per sidang",
        teks: "Isian ketikan tersimpan per perkara, bukan per sidang: BAS sidang lain memakai isian yang sama. Cetak segera sesudah mengisi.",
      };
    },
  };
  function ikonInfo(id) {
    const x = INFO_UMUM[id];
    return x ? `<button type="button" class="bd-ikon bd-sumber ada-ket bd-ingatsidang" data-sumber="${esc(id)}" aria-label="${esc(x.label)}" aria-haspopup="dialog" aria-expanded="false" title="${esc(x.teks)}">ⓘ</button>` : "";
  }
  /**
   * Menyaring keterangan usulan untuk mata petugas: angka ukur internal ("ukur 10 Okt ... 540 dari 578 ... 93,4%") dan
   * pengenal teknis (nama berkas aturan bertitik) dibuang; yang tersisa kalimat sumber data dan apa yang perlu diperiksa.
   * Hanya tampilan: data usulan (S.info) tidak diubah.
   */
  const POLA_UKUR_KURUNG = /\s*\([^()]*(?:\b(?:ter|di)?ukur\b|\b\d+\s+dari\s+\d+\b|\d+(?:[.,]\d+)?\s*%)[^()]*\)/gi;
  function bersihKeterangan(t) {
    const x = String(t || "")
      .replace(POLA_UKUR_KURUNG, "")
      .split(/(?<=[.!?])\s+/)
      .filter((k) => !/\b(?:ter|di)?ukur\s+\d/i.test(k) && !/\b[a-z]+(?:\.[a-z][\w-]*){2,}\b/i.test(k))
      .join(" ");
    return x.replace(/\s+([.,;:])/g, "$1").replace(/\s{2,}/g, " ").trim();
  }
  const KET_BUKTI = [
    "Kode bukti, tanggal dan paraf Ketua Majelis ditulis otomatis. Bagian yang kosong tidak ikut ditulis.",
    "Pada Tulis manual, kalimat dicetak apa adanya. Kodenya diganti otomatis bila urutan bukti berubah; bila tidak ditulis, kode, tanggal dan paraf Ketua Majelis ditambahkan di akhir.",
  ];
  /** Keterangan satu isian untuk ikon ⓘ: catatan usulan (disaring) dan selisih keterangan saksi. */
  function ketItem(b) {
    if (!b) return [];
    if (b.khusus === "bukti") return KET_BUKTI.slice();
    const i = S.info[b.kode];
    if (!i && b.manual && b.alasanManual && !b.khusus && b.jenis !== "tj") return [`Diisi manual: ${b.alasanManual}`];
    if (!i || b.khusus || b.jenis === "tj") return [];
    const out = [];
    const c = bersihKeterangan(i.catatan);
    if (c) out.push(c);
    if (i.bentrok) out.push(`Saksi kedua mengatakan "${i.bentrok}". Selisih ini soal pembuktian, bukan soal pengisian.`);
    return out;
  }
  /** Sumber satu isian - jujur: dari SIPP/ABT, dari gugatan (saran bawaan ABT yang dihitung), diketik, atau tanya jawab. */
  function sumberDaftar(b) {
    const out = [];
    if (b.jenis === "tj") {
      out.push({ t: "saksi", nama: "Tanya jawab di sidang", jelas: "Diketik petugas saat pemeriksaan saksi, atau dimuat dari set pertanyaan ABT lalu disesuaikan. Tersimpan di ABT per sidang." });
      if (S.blangko && S.blangko.jenis === "put") out.push({ t: "posita", nama: "Dipakai di putusan", jelas: "Keterangan saksi yang sama dibaca putusan sebagai fakta persidangan." });
      return out;
    }
    if (b.khusus === "bukti") {
      out.push({ t: "sipp", nama: "Data SIPP", jelas: "Nama pihak dan NIK pada bukti KTP diambil ABT dari SIPP; bagian lain diisi dari bukti yang diajukan." });
      out.push({ t: "tangan", nama: "Diketik petugas", jelas: "Atas nama, nomor, tanggal, penerbit, meterai dan pencocokan boleh dikosongkan - kalimat bukti menyesuaikan. Bentuk bukti yang tidak biasa dapat ditulis manual." });
      return out;
    }
    const alasan = keteranganKeadaan(b);
    if (alasan) out.push({ t: "sipp", nama: "Data perkara", jelas: `Isian ini muncul karena ${alasan}.` });
    const h7 = S.saranH7 && S.saranH7[b.kode];
    if (h7)
      out.push({
        t: "posita",
        nama: h7.golongan === "pasti" ? "Draf H-7 agen ALETA (pasti)" : "Draf H-7 agen ALETA (usulan)",
        jelas: `Disiapkan agen dari ${h7.sumber || "data perkara"}: "${potong(h7.nilai, 160)}". ${h7.golongan === "pasti" ? "Terukur pasti" : "Belum pasti - periksa dulu"}; belum tersimpan ke ABT sampai Anda memakainya (Tab atau Pakai semua saran).`,
      });
    if (S.dariSipp.has(b.kode)) out.push({ t: "sipp", nama: "Diisi dari SIPP", jelas: "Isian ini kosong dan datanya ditemukan di SIPP, gugatan atau berkas e-Court, jadi terisi sendiri dan tersimpan ke ABT. Silakan periksa; ketikan Anda menggantinya." });
    else if (S.saranSipp[b.kode] && b.jenis !== "tanggal") out.push({ t: "sipp", nama: "Bacaan SIPP (belum pasti)", jelas: `Terbaca dari ${S.saranSipp[b.kode].asal || "SIPP"} tetapi belum pasti: "${potong(S.saranSipp[b.kode].nilai, 160)}". Belum tersimpan ke ABT sampai Anda memakainya (Tab).` });
    if (S.saran[b.kode]) out.push({ t: "posita", nama: "Bawaan ABT dari data perkara", jelas: `ABT menghitung saran dari data perkara di SIPP (termasuk gugatan): "${potong(S.saran[b.kode], 160)}". Tekan Tab di kotak kosong untuk memakainya.` });
    else if (b.saran) out.push({ t: "posita", nama: "Saran ALETA", jelas: `Saran umum untuk isian ini: "${potong(b.saran, 160)}". Periksa dengan gugatan sebelum dipakai.` });
    if (b.dipakaiOleh && b.dipakaiOleh.length) out.push({ t: "rumus", nama: "Dipakai juga di bagian lain", jelas: "Nilai ini juga dibaca bagian otomatis lain di naskah (mis. amar, pertimbangan), jadi isilah dengan teliti." });
    if (b.manual && b.alasanManual && !S.dariSipp.has(b.kode) && !S.saranSipp[b.kode]) out.push({ t: "tangan", nama: "Diisi manual", jelas: b.alasanManual });
    out.push({ t: "tangan", nama: "Diketik petugas", jelas: b.jenis === "tanggal" ? "Tanggal diketik petugas, tersimpan di ABT untuk perkara ini." : "Diketik petugas (atau dipilih dari pilihan), tersimpan di ABT untuk perkara ini." });
    return out;
  }
  function itemSumber(id) {
    if (!S.susunan) return null;
    return S.susunan.isian.find((b) => b.kode === id || (b.tj && `tj:${b.tj.kunci}` === id) || (b.khusus === "bukti" && `bukti:${b.pihak}` === id)) || null;
  }

  /** Isian panjang (kalimat/paragraf) memakai textarea; selebihnya satu baris. Menilai isi, bukan nama kotak. */
  function isianPanjang(v, saran) {
    const teks = String(v || "").replace(/\s+$/, "");
    if (teks) return /\n/.test(teks) || teks.length > 90;
    return String(saran || "").length > 90;
  }
  // 19 Okt (isian 2): isian yang kalimatnya PANJANG per sifatnya (rincian alasan cerai, uraian, pertimbangan) selalu selebar penuh dan berkotak
  // textarea yang tumbuh sesuai isi - walau masih kosong - supaya tidak sempit lalu melonjak setelah terisi.
  const KODE_LEBAR = new Set(["5227", "8729", "8433", "7178", "8899", "8901", "8902", "9162", "9163", "9164", "9305", "9309", "9310", "9329", "9330", "9345", "9346", "9352", "9432", "9434", "9501"]);
  const POLA_NAMA_LEBAR = /(rincian|uraian|pertimbangan|penilaian|isi kesepakatan|pokok kesepakatan|amar kesepakatan|alasan pencabutan|alasan permohonan|alasan panggilan)/i;
  const isianLebar = (b) => b.jenis === "teks" && !(b.opsi && b.opsi.length) && (KODE_LEBAR.has(b.kode) || POLA_NAMA_LEBAR.test(String(b.nama || "")));
  /** Tinggi awal textarea (baris): perkiraan lipatan pada ±60 huruf per baris, min 2 maks 8; kemudian tumbuh sesuai isi. */
  function barisIsian(teks) {
    const t = String(teks || "").replace(/\s+$/, "");
    const n = t ? t.split("\n").reduce((a, l) => a + Math.max(1, Math.ceil(l.length / 60)), 0) : 2;
    return Math.max(2, Math.min(8, n));
  }
  /** Menyesuaikan tinggi textarea dengan isinya (tanpa kotak besar yang kosong). */
  function tumbuhkan(el) {
    try {
      if (!el || el.tagName !== "TEXTAREA") return;
      el.style.height = "auto";
      const h = el.scrollHeight;
      if (h > 0) el.style.height = `${h + 2}px`;
    } catch {
      /* tinggi hanya kenyamanan */
    }
  }
  function tumbuhkanSemua(akar) {
    for (const el of cariSemua("textarea.bd-auto, textarea.bd-ed, textarea.bd-bmanual", akar || wadah.isian)) tumbuhkan(el);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Kelengkapan kartu usulan di tiap isian (sama dengan kartu "Isi dari SIPP & input ke ABT" di panel ABT)
  // ──────────────────────────────────────────────────────────────────────────
  // Lencana keyakinan dan asal, kutipan sumber terlipat, bintang sematan (kunci penyimpanan yang sama dengan panel: abtVariabelSematan),
  // riwayat dengan kembalikan, "sekarang" vs "usulan" bila berbeda, catatan, serta Input ke ABT / Input semua yang pasti untuk yang
  // belum otomatis. Bahannya dari mesin bersama (isi-sipp-bersama.js: lencanaUsulan, kutipanUsulan), bukan salinan tampilan.
  const K_SEMATAN = "abtVariabelSematan";
  const samaKet = (a, b) => String(a || "").replace(/\s+/g, " ").trim().toLowerCase() === String(b || "").replace(/\s+/g, " ").trim().toLowerCase();
  async function muatSematan() {
    const s = await bacaPenyimpanan(K_SEMATAN);
    const daftar = Array.isArray(s[K_SEMATAN]) ? s[K_SEMATAN].map(String) : [];
    if (daftar.join(",") !== S.sematan.join(",")) {
      S.sematan = daftar;
      if (S.susunan) renderIsian();
    }
  }
  function riwayatKet(kode) {
    const r = S.ketRiwayat[kode];
    if (!r || r.memuat) return `<div class="bd-ketriw"><p class="bd-catat">Membaca riwayat…</p></div>`;
    if (!r.daftar.length) return `<div class="bd-ketriw"><p class="bd-catat">Belum ada perubahan yang tercatat untuk isian ini.</p></div>`;
    const skrg = String(S.isi[kode] || "");
    return (
      `<div class="bd-ketriw">` +
      r.daftar
        .slice(0, 8)
        .map((x, idx) => {
          const waktu = String(x.pada || "").slice(0, 10) ? `${tglIndo(String(x.pada).slice(0, 10))} ${String(x.pada).slice(11, 16)}` : "";
          // C1: catatan dari server yang isinya DIPOTONG tidak pernah ditawarkan untuk dikembalikan (akan menimpa isian dengan potongan);
          // catatan lengkap dari server (PC lain) dapat dikembalikan dengan konfirmasi dua langkah.
          const dipotong = x.dariPeladen === true && x.dipotong === true && x.utuh !== true;
          const sudahDiurungkan = x.dariServerLengkap === true && x.bisaDiurungkan === false;
          const bisa = bolehTulis() && !samaKet(x.sebelum, skrg) && !dipotong && !sudahDiurungkan;
          const yakinTekan = S.konfirmPulih && S.konfirmPulih.kode === kode && S.konfirmPulih.idx === idx && Date.now() < S.konfirmPulih.sampai;
          const dariServer = x.dariServerLengkap === true ? ` · dicatat di server${x.oleh ? ` oleh ${esc(x.oleh)}` : ""}` : "";
          return `<div class="bd-ketriw-baris"><span class="bd-catat">${esc(waktu)} · ${esc(potong(x.cara || "", 70))}: "${esc(potong(x.sebelum || "(kosong)", 80))}" → "${esc(potong(x.sesudah || "(kosong)", 80))}"${dariServer}</span>${bisa ? ` <button type="button" class="bd-tautankecil" data-bd2="ketpulih" data-ket="${esc(kode)}" data-idx="${idx}">${yakinTekan ? "yakin? kembalikan ↺" : "kembalikan ↺"}</button>` : ""}</div>`;
        })
        .join("") +
      `</div>`
    );
  }
  function kepingKet(b) {
    const i = S.info[b.kode];
    // Isian yang tidak mungkin otomatis (penilaian hakim, pemeriksaan sidang, data tidak ada di SIPP): ditandai "diisi manual"
    // selama belum ada nilai maupun saran; alasannya ada di ikon ⓘ (ketItem).
    if (!i && b.manual && !b.khusus && b.jenis !== "tj" && !String(S.isi[b.kode] || "").trim() && !(S.saranSipp && S.saranSipp[b.kode])) {
      return `<div class="bd-ket"><span class="bd-tandabaris"><span class="bd-tanda abu">diisi manual</span></span></div>`;
    }
    if (!i || b.khusus || b.jenis === "tj") return "";
    const kode = esc(b.kode);
    const tanda = (x) => (x ? `<span class="bd-tanda ${esc(x.kelas)}">${esc(x.teks)}</span>` : "");
    const n = i.sumber.length;
    const buka = S.ketBuka.has(b.kode);
    const semat = S.sematan.includes(b.kode);
    const riw = S.ketRiwayatBuka.has(b.kode);
    let h =
      `<div class="bd-ket"><span class="bd-tandabaris">${tanda(i.lencana.yakin)}${tanda(i.lencana.asal)}${tanda(i.lencana.sepakat)}</span><span class="bd-ketaksi">` +
      (n ? `<button type="button" class="bd-tautankecil" data-bd2="ketsumber" data-ket="${kode}" aria-expanded="${buka}">sumber (${n}) ${buka ? "▾" : "▸"}</button>` : "") +
      `<button type="button" class="bd-ikon" data-bd2="ketsemat" data-ket="${kode}" aria-pressed="${semat}" title="${semat ? "Lepas sematan isian ini" : "Sematkan isian ini (sama dengan bintang di panel ABT)"}">${semat ? "★" : "☆"}</button>` +
      `<button type="button" class="bd-ikon" data-bd2="ketriwayat" data-ket="${kode}" aria-expanded="${riw}" title="Riwayat isian ini - dengan tombol kembalikan">⟲</button></span></div>`;
    // Catatan usulan dan selisih saksi tidak lagi tampil di sini: ada di ikon ⓘ di samping judul isian (lihat ketItem).
    if (buka && n) h += `<ul class="bd-sumberlist">${i.sumber.map((s) => `<li><b>${esc(s.label)}</b> ${esc(s.kalimat)}</li>`).join("")}</ul>`;
    if (riw) h += riwayatKet(b.kode);
    return h;
  }
  /** "sekarang" vs "usulan" bila berbeda (usulan yang belum/tidak ditulis sendiri). */
  function sandingKet(b) {
    const i = S.info[b.kode];
    if (!i || !i.nilai || i.golongan === "pilihan" || b.khusus) return "";
    const skrg = String(S.isi[b.kode] || "").trim();
    if (!skrg || samaKet(skrg, i.nilai)) return "";
    return `<div class="bd-sanding"><div><b>sekarang</b> ${esc(potong(skrg, 180))}</div><div><b>usulan</b> ${esc(potong(i.nilai, 180))}${bolehTulis() ? ` <button type="button" class="bd-tautankecil" data-bd2="ketpakai" data-ket="${esc(b.kode)}">pakai usulan</button>` : ""}</div></div>`;
  }
  /** Gambar ulang satu kartu isian saja (fokus dan gulir terjaga). */
  function segarKartu(kode) {
    const b = S.susunan && S.susunan.isian.find((x) => x.kode === kode);
    const el = wadah.isian && cari(`.bd-f[data-f="${kode}"]`, wadah.isian);
    if (!b || !el || b.khusus) return renderIsian();
    const sementara = document.createElement("div");
    sementara.innerHTML = kotakIsian(b);
    if (sementara.firstElementChild) el.replaceWith(sementara.firstElementChild);
    renderProgres();
    return undefined;
  }
  /** Usulan yang belum otomatis dan kini dapat dimasukkan: pasti+cukup ("Input ke ABT"), pasti saja ("Input semua yang pasti"). */
  function calonInput() {
    const m = mesinIsi();
    const yakin = [];
    const pasti = [];
    if (!m || !S.susunan) return { yakin, pasti };
    for (const b of daftarPerlu()) {
      const i = S.info[b.kode];
      // 28 Okt: alasan cerai 5227 ikut "Input semua yang pasti" bila keterangan kedua saksi sama (keduaSaksiSama5227).
      if (b.kode === "5227" && i && i.keduaSaksi && i.keduaSaksi.sama && i.nilai && i.golongan === "saran" && !b.khusus && sedangKosong(b)) {
        pasti.push(b);
        yakin.push(b);
        continue;
      }
      if ((b.jenis !== "teks" && b.jenis !== "tanggal") || b.khusus || !i || (i.golongan !== "saran" && i.golongan !== "tulis") || !i.nilai || m.HANYA_SARAN.includes(b.kode) || !sedangKosong(b)) continue;
      if (i.keyakinan === "pasti") pasti.push(b);
      if (i.keyakinan === "pasti" || i.keyakinan === "cukup") yakin.push(b);
    }
    return { yakin, pasti };
  }
  async function masukkanCalon(daftar) {
    if (!bolehTulis() || !daftar.length) return;
    let n = 0;
    for (const b of daftar) {
      const i = S.info[b.kode];
      if (!i || !sedangKosong(b)) continue;
      S.diketik.add(b.kode); // tombol ditekan petugas = keputusan petugas
      if (await tulisIsianSipp(b, i.nilai, i.asal, i.keyakinan, false)) n += 1;
    }
    renderIsian();
    laporKeKerangka();
    toast(n ? `${n} isian disimpan ke ABT. Periksa sebelum cetak.` : "Tidak ada isian yang dapat disimpan.");
  }
  async function aksiKet(kode, aksi, idx) {
    if (aksi === "ketsumber") {
      if (S.ketBuka.has(kode)) S.ketBuka.delete(kode);
      else S.ketBuka.add(kode);
      return segarKartu(kode);
    }
    if (aksi === "ketsemat") {
      S.sematan = S.sematan.includes(kode) ? S.sematan.filter((x) => x !== kode) : [...S.sematan, kode].slice(-20);
      void tulisPenyimpanan({ [K_SEMATAN]: S.sematan });
      return segarKartu(kode);
    }
    if (aksi === "ketriwayat") {
      if (S.ketRiwayatBuka.has(kode)) {
        S.ketRiwayatBuka.delete(kode);
        return segarKartu(kode);
      }
      S.ketRiwayatBuka.add(kode);
      S.ketRiwayat[kode] = { memuat: true, daftar: [] };
      segarKartu(kode);
      let daftar = [];
      try {
        if (typeof bacaRiwayat === "function") daftar = (await bacaRiwayat(perkaraId())).filter((x) => x && String(x.kode) === String(kode));
      } catch {
        daftar = [];
      }
      S.ketRiwayat[kode] = { memuat: false, daftar };
      return segarKartu(kode);
    }
    const b = S.susunan && S.susunan.isian.find((x) => x.kode === kode);
    if (!b || !bolehTulis()) return undefined;
    if (aksi === "ketpakai") {
      const i = S.info[kode];
      if (!i || !i.nilai) return undefined;
      S.diketik.add(kode);
      if (await tulisIsianSipp(b, i.nilai, i.asal, i.keyakinan, false)) toast(`${b.nama}: usulan dipakai dan tersimpan ke ABT.`);
      return segarKartu(kode);
    }
    if (aksi === "ketpulih") {
      const x = ((S.ketRiwayat[kode] || {}).daftar || [])[idx];
      if (!x) return undefined;
      // C1: perubahan yang dicatat di SERVER (PC lain) ditimpakan ke ABT hanya sesudah konfirmasi dua langkah.
      if (x.dariServerLengkap === true && !(S.konfirmPulih && S.konfirmPulih.kode === kode && S.konfirmPulih.idx === idx && Date.now() < S.konfirmPulih.sampai)) {
        S.konfirmPulih = { kode, idx, sampai: Date.now() + 10000 };
        toast(`Ini perubahan ${x.oleh || "petugas lain"} yang dicatat di server. Tekan "kembalikan" sekali lagi untuk memastikan.`);
        return segarKartu(kode);
      }
      S.konfirmPulih = null;
      const lama = String(S.isi[kode] || "");
      S.diketik.add(kode);
      sedangUrungkan = true;
      let ok = false;
      try {
        ok = await jadwalkanSimpan(kode, String(x.sebelum || ""), true);
      } finally {
        sedangUrungkan = false;
      }
      if (ok) {
        S.dariSipp.delete(kode);
        otoTulis.delete(kode);
        try {
          if (typeof catatRiwayat === "function") void catatRiwayat({ perkaraId: perkaraId(), kode, nama: b.nama, sebelum: lama, sesudah: String(x.sebelum || ""), cara: "dikembalikan dari riwayat di Blangko Derry", pada: new Date().toISOString(), urungkanDari: x.idJejak || "" });
        } catch {
          /* jejak tidak tersedia */
        }
        S.ketRiwayatBuka.delete(kode);
        delete S.ketRiwayat[kode];
        toast(`${b.nama}: isi sebelumnya dikembalikan.`);
      }
      return segarKartu(kode);
    }
    return undefined;
  }

  /** Nama isian untuk petugas; isian tambahan tertentu (#9134) memakai label yang menjelaskan fungsinya. */
  const namaIsian = (b) => (TP() ? TP().namaTampil(b) : b.nama);
  function kotakIsian(b) {
    const v = S.isi[b.kode] !== undefined ? String(S.isi[b.kode]) : "";
    const sr = cfg().saran ? saranUntuk(b) : "";
    const st = S.tersimpan[b.kode] || "";
    const pil = b.pilihan || [];
    const opsi = Array.isArray(b.opsi) ? b.opsi : [];
    // e-Court adalah keadaan sebagian besar perkara: tanpa lencana "muncul karena" supaya kotak tetap ringkas.
    // 21 Okt: isian tuntutan yang hanya dibaca bagian otomatis menyebut sebab tampilnya (diminta petitum / karena jabatan).
    // 21 Okt (w25): sebabnya harus benar - "karena jabatan" hanya dari saklar hakim atau keputusan "diberikan secara ex officio";
    // keputusan lain yang sudah dipilih (ditolak, dikabulkan, ...) tidak diberi sebab (kartu tampil karena sudah diputus).
    const alasanTuntutan =
      Array.isArray(b.tuntutan) && b.tuntutan.length && (b.langsung === false || b.tuntutan.some((p) => tuntutanDikenal(p)))
        ? b.tuntutan.some((p) => pemicuMenyala(p))
          ? "diminta dalam petitum"
          : b.tuntutan.some((p) => jabatanMenyala(p) || keputusanKarenaJabatan(p))
            ? "ditetapkan karena jabatan"
            : ""
        : "";
    const alasan = alasanTuntutan || ((b.keadaan || b.pemicu) && b.keadaan !== "ecourt" ? keteranganKeadaan(b) : "");
    const muncul = alasan ? `<span class="bd-muncul">muncul karena ${esc(alasan)}</span>` : "";
    const tanda = S.tandaKosong.has(b.kode) && !v.trim() ? ` bd-kosongcetak${b.tingkat === "tambahan" ? " tambahan" : ""}` : "";
    const ro = bolehTulis() || tes() ? "" : "disabled";
    let isian;
    let panjang = false;
    let lebarSelalu = false;
    // 21 Okt (w25): keputusan majelis atas tuntutan = pemilih tunggal; daftar pilihan bawaan ABT tidak pernah tampil sebagai isi kotak.
    const keputusanKotak = !opsi.length && pil.length > 0 && Array.isArray(b.tuntutan) && b.tuntutan.length > 0 && /^410[0-5]$/.test(b.kode);
    if (keputusanKotak) {
      const terpilih = pilihanTunggalMurni(v, pil);
      const alasanKep = terpilih && v.length > terpilih.length ? v.slice(terpilih.length).replace(/^\s*:\s*/, "") : "";
      const butuhAlasan = ["ditolak", "tidak dapat diterima"].includes(normPil(terpilih));
      const asing = v.trim() && !terpilih && !daftarPilihanMurni(b, v);
      isian =
        `<div class="bd-isiwadah"><select id="bd-i${b.kode}" class="bd-opsi" data-k="${b.kode}" data-keputusan="1" ${ro}><option value="" ${terpilih || asing ? "" : "selected"}>pilih keputusan majelis…</option>` +
        pil.map((o) => `<option value="${esc(o)}" ${o === terpilih ? "selected" : ""}>${esc(o)}</option>`).join("") +
        (asing ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : "") +
        `</select></div>` +
        (butuhAlasan ? `<div class="bd-isiwadah"><input type="text" class="bd-alasan" data-alasan="${b.kode}" value="${esc(alasanKep)}" placeholder="alasan (ditulis sesudah titik dua)" autocomplete="off" ${bolehTulis() ? "" : "readonly"}></div>` : "");
    } else if (opsi.length) {
      // Pilihan bernilai (mis. beracara elektronik: ABT menyimpan 1/2) - petugas hanya melihat kalimatnya.
      const ada = opsi.some((o) => o.nilai === v);
      isian =
        `<div class="bd-isiwadah"><select id="bd-i${b.kode}" class="bd-opsi" data-k="${b.kode}" ${ro}><option value="" ${v ? "" : "selected"}>${esc(sr && !ada ? (() => { const o = opsi.find((x) => x.nilai === sr); return o ? `saran: ${o.label}` : sr; })() : "pilih…")}</option>` +
        opsi.map((o) => `<option value="${esc(o.nilai)}" ${o.nilai === v ? "selected" : ""}>${esc(o.label)}</option>`).join("") +
        (v && !ada ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : "") +
        `</select></div>`;
    } else {
      // Nilai ABT bergaris baru (mis. beberapa paragraf): <input type=text> membuang \n dari nilainya,
      // jadi kotaknya textarea supaya tampil & tersimpan utuh.
      // 19 Okt 2026 (tata letak): jenis kotak mengikuti ISINYA. Tanggal, nama, nomor, huruf = satu baris (input, tinggi seragam);
      // textarea hanya untuk kalimat/paragraf, tingginya menyesuaikan isi (bd-auto), bukan kotak besar yang kosong.
      lebarSelalu = isianLebar(b);
      panjang = b.jenis !== "tanggal" && (lebarSelalu || isianPanjang(v, sr));
      const kotak = panjang
        ? `<textarea id="bd-i${b.kode}" class="bd-auto" data-k="${b.kode}" rows="${lebarSelalu ? Math.max(3, barisIsian(v || sr)) : barisIsian(v || sr)}" placeholder="${esc(sr || "ketik di sini")}" autocomplete="off" ${bolehTulis() ? "" : "readonly"}>${esc(v)}</textarea>`
        : `<input id="bd-i${b.kode}" data-k="${b.kode}" type="${b.jenis === "tanggal" ? "date" : "text"}" value="${esc(v)}" placeholder="${esc(sr && b.jenis !== "tanggal" ? sr : b.jenis === "tanggal" ? "" : "ketik di sini")}" autocomplete="off" ${bolehTulis() ? "" : "readonly"}>`;
      isian =
        `<div class="bd-isiwadah">${kotak}` +
        `${pil.length ? `<button type="button" class="bd-ikon" data-menu="${b.kode}" aria-label="Pilihan lain untuk ${esc(b.nama)}" tabindex="-1">▾</button>` : ""}</div>` +
        `${S.menuSaran === b.kode && pil.length ? `<div class="bd-saranmenu" role="listbox">${pil.map((o) => `<button type="button" role="option" data-ambil="${b.kode}" data-nilai="${esc(o)}">${esc(o)}</button>`).join("")}</div>` : ""}`;
    }
    // Pilih bunyi (mis. alasan cerai 5227): varian dari mesin bersama, wajib dipilih petugas - tidak terisi sendiri.
    const bunyi = S.bunyi[b.kode] || [];
    const pilihBunyi = bunyi.length
      ? `<label class="bd-bunyi"><span>pilih bunyi</span><select data-bunyi="${b.kode}" ${ro} aria-label="Pilih bunyi ${esc(b.nama)}"><option value="">— wajib dipilih petugas —</option>${bunyi
          .map((o, i) => `<option value="${i}" ${v.trim() && v.trim() === o.nilai ? "selected" : ""}>${esc(`${o.keadaan}: ${potong(o.nilai, 150)}`)}</option>`)
          .join("")}</select></label>` +
        // 28 Okt: alasan cerai yang keterangan kedua saksinya sama ikut "Input semua yang pasti".
        (b.kode === "5227" && S.info[b.kode] && S.info[b.kode].keduaSaksi
          ? `<span class="bd-catat" title="${esc(S.info[b.kode].keduaSaksi.sama ? "Setiap alasan dari gugatan dikuatkan kedua saksi." : S.info[b.kode].keduaSaksi.sebab || "")}">${S.info[b.kode].keduaSaksi.sama ? "Kedua saksi sama - ikut \"Input semua yang pasti\"." : "Keterangan kedua saksi belum sama untuk semua alasan - pilih bunyi sendiri."}</span>`
          : "")
      : "";
    return (
      `<div class="bd-f${v.trim() ? " beres" : ""}${panjang ? " panjang" : ""}${tanda}" data-f="${b.kode}"><div class="bd-fh"><label for="bd-i${b.kode}" title="${esc(namaIsian(b))}">${esc(namaIsian(b))}</label>${ikonSumber(b.kode, namaIsian(b), ketItem(b))}</div>${muncul}${kepingKet(b)}` +
      isian +
      sandingKet(b) +
      pilihBunyi +
      (b.kode === "7139" && S.el7 && v === S.el7.nilai ? `<span class="bd-catat bd-el7">${esc(S.el7.keterangan)}</span>` : "") +
      (b.kode === "7139" && S.el7Saran && !v.trim() ? `<span class="bd-catat bd-el7">Saran: ${esc(S.el7Saran.keterangan)}</span>` : "") +
      `<span class="bd-status" data-status="${b.kode}">${esc(teksStatus(st, b.kode))}</span>` +
      (b.kode === "8503" ? (() => { const w = peringatan8503(); return `<span class="bd-peringatan" data-peringatan="8503" role="alert" ${w ? "" : "hidden"}>${esc(w)}</span>`; })() : "") +
      (b.kode === "8503" ? belajarHtml8503() : "") +
      catatSidangHtml(b) +
      `</div>`
    );
  }
  const teksStatus = (st, kode) => (st === "tersimpan" ? `✓ ${kode && S.dariSipp.has(kode) ? "terisi dari SIPP, tersimpan di ABT" : "tersimpan di ABT"}${kode && S.ganti[kode] ? ` (huruf ${S.ganti[kode]} diganti ke bentuk aman ABT)` : ""}` : st === "menyimpan" ? "menyimpan…" : st === "dicoba" ? "dipakai di pratinjau, tidak disimpan" : st.startsWith("gagal") ? st : "");
  function renderStatusIsian(kode) {
    const e = cari(`[data-status="${kode}"]`, wadah.isian);
    if (e) {
      e.textContent = teksStatus(S.tersimpan[kode] || "", kode);
      e.classList.toggle("gagal", String(S.tersimpan[kode] || "").startsWith("gagal"));
    }
    const f = cari(`.bd-f[data-f="${kode}"]`, wadah.isian);
    const ada = Boolean(String(S.isi[kode] || "").trim());
    if (f) {
      f.classList.toggle("beres", ada);
      if (ada) f.classList.remove("bd-kosongcetak", "bd-getar", "tambahan");
    }
  }
  const LABEL_NOMOR = { ktp: ["NIK", "16 angka NIK"], kk: ["Nomor KK", "nomor Kartu Keluarga"], "": ["Nomor surat", "boleh kosong"] };
  function kotakBukti(b) {
    const rows = S.bukti[b.pihak];
    const w = b.pihak;
    if (!rows) return `<div class="bd-f lebar" data-f="${b.kode}"><div class="bd-fh"><label>${esc(b.nama)}</label>${ikonSumber(`bukti:${w}`, b.nama, ketItem(b))}</div><p class="bd-catat">Membaca bukti bawaan dari ABT…</p></div>`;
    // G2: keterangan penulisan otomatis daftar bukti dari e-Court (ditulis / tidak rapi -> Salin).
    const oto = S.buktiOto && S.buktiOto[w];
    const keteranganOto = oto
      ? oto.status === "salin"
        ? `<p class="bd-peringatan" role="status">${esc(oto.pesan)}${oto.teks ? ` <button type="button" class="bd-btn kecil" data-bd2="salinjm" data-kunci="bukti:${esc(w)}">Salin</button>` : ""}</p>`
        : `<p class="bd-catat" role="status">${esc(oto.pesan)}</p>`
      : "";
    return (
      `<div class="bd-f lebar" data-f="${b.kode}"><div class="bd-fh"><label>${esc(b.nama)}</label>${ikonSumber(`bukti:${w}`, b.nama, ketItem(b))}<span class="bd-status" data-status="${b.kode}">${esc(teksStatus(S.tersimpan[b.kode] || ""))}</span></div>${keteranganOto}` +
      rows
        .map((r, i) => {
          const kode = `${w}.${i + 1}`;
          const id = `${w}.${i}`;
          const manual = typeof r.manual === "string";
          const [lblNo, phNo] = LABEL_NOMOR[jenisBukti(r.nm)];
          const kepala =
            `<div class="bd-bkepala"><span class="bd-kodeP">${kode}</span><input class="bd-bnama" data-bk="${id}" data-isi="nm" value="${esc(r.nm)}" aria-label="Nama bukti ${kode}" ${manual ? "disabled" : ""}>` +
            `<button type="button" class="bd-btn kecil" data-bkmanual="${id}" aria-pressed="${manual}" title="${manual ? "Kembali menyusun kalimat dari isian" : "Sunting kalimat bukti ini bebas (bentuk bukti beragam)"}">${manual ? "Pakai isian" : "Tulis manual"}</button>` +
            `<button type="button" class="bd-ikon" data-bkhapus="${id}" aria-label="Hapus bukti ${kode}">✕</button></div>`;
          if (manual)
            return (
              `<div class="bd-bukti" data-manual="1">${kepala}<textarea class="bd-bmanual" data-bk="${id}" data-isi="manual" aria-label="Kalimat bukti ${kode}">${esc(r.manual)}</textarea>` +
              `</div>`
            );
          return (
            `<div class="bd-bukti">${kepala}` +
            `<div class="bd-bgrid"><label>Atas nama<input data-bk="${id}" data-isi="an" value="${esc(r.an || "")}" placeholder="boleh kosong"></label><label>${lblNo}<input data-bk="${id}" data-isi="no" value="${esc(r.no)}" placeholder="${esc(phNo)}"></label><label>Tanggal<input type="date" data-bk="${id}" data-isi="tgl" value="${esc(r.tgl)}"></label><label class="dua2">Dikeluarkan oleh<input data-bk="${id}" data-isi="oleh" value="${esc(r.oleh)}" placeholder="boleh kosong"></label></div>` +
            `<div class="bd-bgrid bd-bpilih"><label>Meterai<select data-bk="${id}" data-isi="meterai">${PIL_METERAI.map((o, j) => `<option value="${j}" ${Number(r.meterai) === j ? "selected" : ""}>${o}</option>`).join("")}</select></label><label class="dua2">Dicocokkan dengan aslinya<select data-bk="${id}" data-isi="cocok">${PIL_COCOK.map((o, j) => `<option value="${j}" ${Number(r.cocok) === j ? "selected" : ""}>${o}</option>`).join("")}</select></label></div>` +
            `</div>`
          );
        })
        .join("") +
      `<div class="bd-baris"><span class="bd-lbl">Tambah bukti</span>${BUKTI_CEPAT.map(([n, o]) => `<button type="button" class="bd-chip bd-tombolchip" data-bktambah="${w}" data-nama="${esc(n)}" data-oleh="${esc(o)}">+ ${esc(n)}</button>`).join("")}<button type="button" class="bd-chip bd-tombolchip" data-bktambah="${w}" data-nama="" data-oleh="">+ Bukti lain</button></div>${htmlBuktiEl(w)}</div>`
    );
  }
  // ── Alat bukti elektronik (27 Okt): tersembunyi bawaan, dibuka lewat "+ Alat bukti elektronik"; hasilnya ikut ruas alat bukti surat ──
  /** Nomor urut butir elektronik ke-i: jumlah bukti surat + butir terisi sebelumnya + 1 (butir kosong tidak ditulis, tidak makan nomor). */
  const urutEl = (w, i) => (S.bukti[w] || []).length + elPihak(w).butir.slice(0, i).filter((b) => !butirElKosong(b)).length + 1;
  const kalimatPratinjauEl = (w, i) => {
    const el = elPihak(w);
    const b = el.butir[i];
    const n = urutEl(w, i);
    return kalimatBuktiEl(b, { urut: n, tanda: n, sb: sebutan(), nomori: el.nomori !== false });
  };
  /** Pratinjau kalimat dan kode tanda semua butir satu pihak mengikuti isian terbaru (tanpa menggambar ulang kotak isian). */
  function segarBuktiEl(w) {
    const el = elPihak(w);
    el.butir.forEach((b, i) => {
      const p = cari(`[data-belprat="${w}.${i}"]`, wadah.isian);
      if (p) p.textContent = butirElKosong(b) ? "Isi jenis atau keterangan bukti agar butir ini ikut ditulis." : kalimatPratinjauEl(w, i);
      const k = cari(`[data-beltanda="${w}.${i}"]`, wadah.isian);
      if (k) k.textContent = `${String(b.awalan || "P")}.${String(b.no || "").trim() || urutEl(w, i)}`;
    });
  }
  function htmlBuktiEl(w) {
    const el = elPihak(w);
    const buka = Boolean(S.buktiElBuka[w]);
    if (!el.butir.length && !buka) return `<div class="bd-baris bd-bel"><button type="button" class="bd-chip bd-tombolchip" data-belbuka="${w}" aria-expanded="false" title="Tambahkan bukti elektronik (cetak foto, rekaman, surel, dsb.) ke alat bukti ini">+ Alat bukti elektronik</button></div>`;
    const terisi = el.butir.filter((b) => !butirElKosong(b)).length;
    const kepala = `<div class="bd-baris"><button type="button" class="bd-btn kecil" data-belbuka="${w}" aria-expanded="${buka}">${buka ? "▾" : "▸"} Alat bukti elektronik (${terisi} butir)</button>${buka ? "" : `<span class="bd-catat">ikut ditulis di alat bukti ini · buka untuk menyunting</span>`}</div>`;
    if (!buka) return `<div class="bd-bel">${kepala}</div>`;
    const sb = sebutan();
    const tiap = el.butir
      .map((r, i) => {
        const id = `${w}.${i}`;
        const manual = typeof r.manual === "string";
        const tanda = `${String(r.awalan || "P")}.${String(r.no || "").trim() || urutEl(w, i)}`;
        const kep =
          `<div class="bd-bkepala"><span class="bd-kodeP" data-beltanda="${id}">${esc(tanda)}</span><span class="bd-catat">${manual ? "kalimat bebas" : "bukti elektronik"}</span>` +
          `<button type="button" class="bd-btn kecil" data-belmanual="${id}" aria-pressed="${manual}" title="${manual ? "Kembali menyusun kalimat dari isian" : "Sunting kalimat butir ini bebas"}">${manual ? "Pakai isian" : "Tulis manual"}</button>` +
          `<button type="button" class="bd-ikon" data-belhapus="${id}" aria-label="Hapus butir bukti elektronik ${esc(tanda)}">✕</button></div>`;
        const prat = `<p class="bd-catat bd-belprat" data-belprat="${id}">${esc(butirElKosong(r) ? "Isi jenis atau keterangan bukti agar butir ini ikut ditulis." : kalimatPratinjauEl(w, i))}</p>`;
        if (manual) return `<div class="bd-bukti bd-bukti-el" data-manual="1">${kep}<textarea class="bd-bmanual" data-be="${id}" data-isi="manual" aria-label="Kalimat bukti elektronik ${esc(tanda)}">${esc(r.manual)}</textarea>${prat}</div>`;
        const pil = (daftar, nilai) => daftar.map(([v, t]) => `<option value="${esc(v)}" ${String(nilai) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("");
        return (
          `<div class="bd-bukti bd-bukti-el">${kep}` +
          `<div class="bd-bgrid"><label class="dua2">Bentuk bukti<input data-be="${id}" data-isi="bentuk" list="bd-bentukel-${w}" value="${esc(r.bentuk)}" placeholder="mis. Print Out/Hasil Cetak Foto"></label>` +
          `<label class="dua2">Jenis atau objek<input data-be="${id}" data-isi="objek" value="${esc(r.objek)}" placeholder="mis. Transaksi Mobile Banking Mandiri, percakapan WhatsApp"></label>` +
          `<label class="dua2">Keterangan<input data-be="${id}" data-isi="ket" value="${esc(r.ket)}" placeholder="mis. angsuran, bayar kos (boleh kosong)"></label>` +
          `<label>Diajukan oleh<select data-be="${id}" data-isi="pengaju">${pil([["P", sb.P], ["T", sb.T]], r.pengaju === "T" ? "T" : "P")}</select></label>` +
          `<label>Awalan tanda<select data-be="${id}" data-isi="awalan">${pil(AWALAN_EL.map((a) => [a, a]), r.awalan)}</select></label>` +
          `<label>Nomor tanda<input data-be="${id}" data-isi="no" value="${esc(r.no)}" placeholder="otomatis ${urutEl(w, i)}"></label></div>` +
          `<div class="bd-bgrid bd-bpilih"><label>Meterai<select data-be="${id}" data-isi="meterai">${PIL_METERAI.map((o, j) => `<option value="${j}" ${Number(r.meterai) === j ? "selected" : ""}>${o}</option>`).join("")}</select></label>` +
          `<label class="dua2">Pemeriksaan<select data-be="${id}" data-isi="periksa">${PIL_PERIKSA_EL.map((o, j) => `<option value="${j}" ${Number(r.periksa) === j ? "selected" : ""}>${o}</option>`).join("")}</select></label></div>` +
          `<label class="bd-cek"><input type="checkbox" data-be="${id}" data-isi="rapi" ${r.rapi !== false ? "checked" : ""}> Bunyi dirapikan (perbaiki salah ketik pada kalimat tidak dapat dicocokkan)</label>${prat}</div>`
        );
      })
      .join("");
    return (
      `<div class="bd-bel">${kepala}<datalist id="bd-bentukel-${w}">${BENTUK_EL.map(([n]) => `<option value="${esc(n)}"></option>`).join("")}</datalist>${tiap}` +
      `<div class="bd-baris"><button type="button" class="bd-chip bd-tombolchip" data-beltambah="${w}">+ Butir bukti elektronik</button><label class="bd-cek"><input type="checkbox" data-benomori="${w}" ${el.nomori !== false ? "checked" : ""}> Beri nomor urut di depan butir</label></div></div>`
    );
  }
  /** Bagian tertutup "Isian tambahan (bila ada)" di bawah kartu wajib; terbuka sendiri bila salah satunya sudah berisi. */
  function htmlIsianTambahan() {
    const l = daftarOpsional();
    if (!l.length) return "";
    const adaIsi = l.some((b) => String(S.isi[b.kode] || "").trim());
    const buka = S.tambahanBuka || adaIsi;
    return (
      `<details class="bd-tambahan" id="bd-tambahan"${buka ? " open" : ""}><summary data-bd2="tambahan" aria-expanded="${buka}">Isian tambahan (bila ada)<span class="bd-catat"> · tidak dihitung pada Perlu diisi</span></summary>` +
      `<div class="bd-pgrid">${l.map((b) => kotakIsian(b)).join("")}</div></details>`
    );
  }
  /**
   * 21 Okt: tuntutan akibat perceraian yang TIDAK diminta posita/petitum - isiannya tidak tampil di daftar utama dan bagiannya
   * tidak tercetak di putusan. Hakim dapat menetapkannya karena jabatan (ex officio): isiannya pindah ke daftar utama dan
   * keputusan majelis dipilih di sana. Status dan kutipan petitum dari ABT sendiri (#3400#, pola sama dengan #4140#-#4145#).
   */
  function htmlTuntutanTakDiminta() {
    const semua = keadaanTuntutan();
    if (!semua.length) return "";
    const bolehJabatan = bolehTulis() && S.blangko && S.blangko.jenis === "put";
    const diminta = semua.filter((t) => t.status === "ya");
    const ragu = semua.filter((t) => t.status === "ragu");
    const takDiminta = semua.filter((t) => t.status !== "ya");
    const tersembunyi = S.susunan.isian.filter((b) => golonganIsian(b) === "tuntutan").length;
    const buka = S.tuntutanBuka || ragu.length > 0;
    const baris = semua
      .map((t) => {
        const aktif = t.status === "ya" || t.jabatan || t.dipilih;
        const lencana =
          t.status === "ya"
            ? `<span class="bd-tanda hijau">diminta dalam petitum</span>`
            : t.status === "ragu"
              ? `<span class="bd-tanda kuning">ragu - periksa surat gugatan</span>`
              : t.jabatan
                ? `<span class="bd-tanda biru">ditetapkan karena jabatan</span>`
                : t.dipilih
                  ? `<span class="bd-tanda biru">keputusan sudah dipilih</span>`
                : `<span class="bd-tanda abu">tidak diminta</span>`;
        const kutipan = t.kutipan ? `<div class="bd-catat bd-kutipan">“${esc(potong(t.kutipan, 230))}”</div>` : "";
        let tombol = "";
        if (bolehJabatan && t.status !== "ya") {
          if (t.jabatan && !t.dipilih) tombol = `<button type="button" class="bd-btn kecil" data-bd2="jabatan" data-p="${esc(t.pemicu)}" aria-pressed="true">Batalkan</button>`;
          else if (!t.jabatan && !t.dipilih) tombol = `<button type="button" class="bd-btn kecil" data-bd2="jabatan" data-p="${esc(t.pemicu)}" aria-pressed="false" title="Tampilkan isian ${esc(t.label.toLowerCase())} untuk ditetapkan majelis walau tidak diminta">Tetapkan karena jabatan</button>`;
          else tombol = `<span class="bd-catat">kosongkan keputusan majelis untuk membatalkan</span>`;
        }
        const ket = aktif ? `<span class="bd-catat">isian tampil di atas</span>` : "";
        return `<li class="bd-tuntutan"><b>${esc(t.label)}</b> ${lencana} ${ket} ${tombol}${kutipan}</li>`;
      })
      .join("");
    const ringkas = `${diminta.length ? `${diminta.length} diminta` : "tidak ada yang diminta"}${takDiminta.length ? `, ${takDiminta.length} tidak diminta` : ""}${tersembunyi ? ` · ${tersembunyi} isian tidak perlu diisi` : ""}`;
    return (
      `<details class="bd-tambahan" id="bd-tuntutan"${buka ? " open" : ""}><summary data-bd2="tuntutan" aria-expanded="${buka}">Tuntutan dalam posita dan petitum<span class="bd-catat"> · ${esc(ringkas)}</span></summary>` +
      `<p class="bd-catat">Tuntutan yang tidak diminta tidak tercetak di putusan dan isiannya tidak perlu diisi.${bolehJabatan ? " Hakim dapat menetapkannya karena jabatan." : ""}</p>` +
      `<ul class="bd-tuntutandaftar">${baris}</ul></details>`
    );
  }
  /** 21 Okt: isian yang hanya dibaca bagian otomatis - tidak ada di tabel ABT blangko ini; tertutup, tetap dapat diisi. */
  function htmlIsianLanjutan() {
    const l = daftarLanjutan();
    if (!l.length) return "";
    const terisiN = l.filter((b) => terisi(b)).length;
    return (
      `<details class="bd-tambahan" id="bd-lanjutan"${S.lanjutanBuka ? " open" : ""}><summary data-bd2="lanjutan" aria-expanded="${S.lanjutanBuka}">Isian di dalam bagian otomatis (${l.length})<span class="bd-catat"> · tidak ada di tabel ABT blangko ini${terisiN ? `, ${terisiN} sudah berisi` : ""}</span></summary>` +
      `<div class="bd-pgrid">${l.map((b) => (b.khusus === "bukti" ? kotakBukti(b) : kotakIsian(b))).join("")}</div></details>`
    );
  }
  function renderIsian() {
    const w = wadah.isian;
    if (!w) return;
    if (!S.blangko) {
      w.innerHTML = `<p class="bd-catat">Pilih blangko lebih dulu.</p>`;
      return;
    }
    if (S.galatSusunan) {
      w.innerHTML = `<div class="bd-peringatan" role="alert">${esc(S.galatSusunan)} <button type="button" class="bd-btn kecil" data-bd2="ulangsusunan">Coba lagi</button></div>`;
      return;
    }
    if (S.blangko.khusus) {
      if (S.blangko.hak !== "ok") {
        w.innerHTML = `<p class="bd-catat" role="status">Memeriksa hak buka blangko ini…</p>`;
        return;
      }
      void BK().buka(w, hostBerkas(), { jenis: S.blangko.khusus, bentuk: BK().bentukDari(S.blangko.berkas), perkaraId: perkaraId(), nomor: nomorPerkara() });
      return;
    }
    if (!S.susunan) {
      w.innerHTML = `<p class="bd-catat" role="status">Membaca isian blangko ini…</p>`;
      return;
    }
    const l = daftarPerlu();
    const grid = l.filter((x) => x.jenis !== "tj");
    const tj = l.filter((x) => x.jenis === "tj");
    const takBerlaku = daftarTakBerlaku();
    const pilihan = S.susunan.isian.filter((b) => !b.wajib);
    // 19 Okt: keterangan teknis (isian tak berlaku, penanda di luar katalog, sumber nilai) tidak tampil; hanya ke konsol sekali per blangko.
    if (S.blangko && S.blangko.catatTeknis !== true) {
      S.blangko.catatTeknis = true;
      if (takBerlaku.length) catatTeknis("isian tidak berlaku untuk perkara ini (disembunyikan):", takBerlaku.map((b) => b.kode).join(", "));
      if (S.susunan.takDikenal && S.susunan.takDikenal.length) catatTeknis("penanda blangko tidak ada di katalog ABT:", S.susunan.takDikenal.join(", "));
      if (!S.susunan.nilaiAda && S.susunan.nilaiSebab) catatTeknis("nilai dibaca langsung dari jendela ABT:", S.susunan.nilaiSebab);
    }
    w.innerHTML =
      `<p class="bd-petunjuk">Tulisan samar di kotak adalah saran. Tekan <kbd>Tab</kbd> untuk memakainya, atau <kbd>↓</kbd> untuk pilihan lain. Data lain sudah terisi sendiri.${bolehTulis() ? "" : tes() ? ` <b>Mode Tes putusan: ketikan Anda hanya dipakai di pratinjau dan unduhan -TES, tidak disimpan ke ABT, SIPP, atau e-Court. Bagian yang tidak punya data di perkara acuan tampil kosong.</b>` : ` <b>Akun Anda hanya dapat melihat; ${esc(NAMA_JENIS[S.blangko.jenis].toLowerCase())} ditulis ${esc(NAMA_PERAN[JENIS_PERAN[S.blangko.jenis]] || "pejabat perkara")}.</b>`}</p>` +
      `<div class="bd-bar"><span id="bd-barisi"></span></div><div class="bd-alatkecil" id="bd-alatisi"></div>` +
      `<div class="bd-pgrid" id="bd-perlu">${grid.length ? grid.map((b) => (b.khusus === "bukti" ? kotakBukti(b) : kotakIsian(b))).join("") : tj.length ? "" : `<p class="bd-ok">Blangko ini tidak perlu diisi tangan; semua terisi sendiri dari SIPP dan aturan ABT.</p>`}</div>` +
      htmlIsianTambahan() +
      htmlTuntutanTakDiminta() +
      htmlIsianLanjutan() +
      `<div id="bd-tjtombol" class="bd-baris"></div><div id="bd-tjwadah"></div>` +
      (S.blangko.jenis === "bas" ? `<div id="bd-skorsbas"></div>` : "") +
      `<div class="bd-baris"><button type="button" class="bd-btn kecil" data-bd2="semua" aria-expanded="${S.semuaBuka}">Lihat semua isi data (${S.susunan.otomatis.length + pilihan.length})</button></div>` +
      `<div class="bd-vdaftar" id="bd-vdaftar" ${S.semuaBuka ? "" : "hidden"}></div>`;
    // Rancangan v12: tiga alat ekstensi lama berjajar di atas kotak isian.
    const alat = [];
    // 19 Okt (isian 2): SATU tombol "Isi otomatis" menggantikan deret "Isi dari SIPP", "Isi dari gugatan (posita)" dan "Ambil tanggal KTP
    // dari bukti". Ada di SEMUA jenis blangko (juga relaas dan PTSP) yang boleh ditulis akun ini.
    if (bolehTulis()) alat.push(`<button type="button" class="bd-btn kecil" data-bd2="isisipp" title="Mengisi isian kosong dari SIPP, gugatan, e-Court, bukti dan saran, lalu menyimpannya ke ABT. Isian yang sudah ada isinya tidak ditimpa.">Isi otomatis</button>`);
    if (bolehTulis()) {
      const calon = calonInput();
      if (calon.yakin.length) alat.push(`<button type="button" class="bd-btn kecil" data-bd2="inputyakin" title="Menyimpan ke ABT usulan yang pasti atau cukup yakin untuk isian yang masih kosong">Input ke ABT (${calon.yakin.length})</button>`);
      if (calon.pasti.length) alat.push(`<button type="button" class="bd-btn kecil" data-bd2="inputpasti" title="Menyimpan ke ABT hanya usulan yang pasti untuk isian yang masih kosong">Input semua yang pasti (${calon.pasti.length})</button>`);
    }
    if (S.blangko.jenis !== "rel" && bolehTulis()) {
      // 19 Okt: deret isi diganti satu tombol "Isi otomatis" (di atas); "Set pertanyaan saksi" pindah ke tombol saksi di tanya jawab.
    }
    cari("#bd-alatisi", w).innerHTML = alat.join("");
    renderTj();
    renderProgres();
    tumbuhkanSemua(w);
    if (S.semuaBuka) renderSemua();
    if (S.blangko.jenis === "bas") void muatSkorsBas();
    // Digambar ulang (mis. isi otomatis selesai) di tengah jendela sorotan: kartu yang ditunjuk tautan tetap tersorot.
    if (S.sorotan && Date.now() < S.sorotan.sampai) pasangSorot(S.sorotan.kode, false);
  }

  // F3.1 (17 Okt 2026): skors sidang ini dari Jadwal Sidang ALETA -> usulan
  // kalimat BAS ("Pada pukul 09.40 WITA sidang diskors ..."). Hanya dibaca
  // (GET sidang/skors) dan hanya tampil bila sidang ini memang pernah diskors.
  // Kalimatnya disalin petugas ke bagian BAS yang tepat - tidak ditulis ke ABT
  // sendiri.
  function kunciSkorsBas() {
    const s = S.pk && S.pk.sidangDipilih;
    const tanggal = s ? String(s.tanggal || s.tanggalSidang || "").slice(0, 10) : "";
    const id = perkaraId();
    // Butir 49 (17 Okt): agenda ikut - kalimat BAS hanya untuk skors musyawarah sebelum putusan.
    const agenda = s ? String(s.agenda || s.ket || "").slice(0, 200) : "";
    return /^\d+$/.test(id) && /^\d{4}-\d{2}-\d{2}$/.test(tanggal) ? { kunci: `${id}|${tanggal}`, id, tanggal, agenda } : null;
  }
  async function muatSkorsBas() {
    const k = kunciSkorsBas();
    if (!k) {
      S.skorsBas = null;
      return renderSkorsBas();
    }
    // Dibaca ulang paling cepat tiap menit - skors dapat terjadi saat BAS sedang diketik.
    if (S.skorsBas && S.skorsBas.kunci === k.kunci && (S.skorsBas.memuat || Date.now() - S.skorsBas.saat < 60000)) return renderSkorsBas();
    S.skorsBas = { kunci: k.kunci, riwayat: S.skorsBas && S.skorsBas.kunci === k.kunci ? S.skorsBas.riwayat : [], kalimat: S.skorsBas && S.skorsBas.kunci === k.kunci ? S.skorsBas.kalimat : "", memuat: true, saat: Date.now() };
    let riwayat = [];
    let kalimat = "";
    try {
      const d = await ambilPortal(
        `${API_SKORS_SIDANG}?tanggal=${k.tanggal}&perkaraId=${encodeURIComponent(k.id)}${k.agenda ? `&agenda=${encodeURIComponent(k.agenda)}` : ""}`,
        {},
        "Membaca skors sidang"
      );
      riwayat = d && Array.isArray(d.riwayat) ? d.riwayat.filter((x) => x && x.diskorsPada) : [];
      kalimat = d && typeof d.kalimatBas === "string" ? d.kalimatBas : "";
    } catch {
      /* tanpa riwayat skors - BAS tetap dapat diisi seperti biasa */
    }
    if (!S.skorsBas || S.skorsBas.kunci !== k.kunci) return;
    S.skorsBas = { kunci: k.kunci, riwayat, kalimat, memuat: false, saat: Date.now() };
    renderSkorsBas();
  }
  function renderSkorsBas() {
    const w = cari("#bd-skorsbas", wadah.isian);
    if (!w) return;
    const sb = S.skorsBas;
    if (!sb || !sb.riwayat.length || !sb.kalimat) {
      w.innerHTML = "";
      return;
    }
    w.innerHTML =
      `<div class="bd-skorsbas" data-skors-bas="">` +
      `<span class="bd-lbl">Sidang ini pernah diskors</span>` +
      `<ul class="bd-skorsdaftar">${sb.riwayat.map((r) => `<li>${esc(r.ringkas || r.diskorsPada)}</li>`).join("")}</ul>` +
      `<p class="bd-catat">Usulan kalimat untuk BAS (dari catatan skors Jadwal Sidang ALETA). Salin lalu tempel di bagian jalannya sidang; dapat diubah sebelum dicetak.</p>` +
      `<textarea class="bd-skorsteks" id="bd-skorsteks" rows="4" readonly>${esc(sb.kalimat)}</textarea>` +
      `<div class="bd-baris"><button type="button" class="bd-btn kecil" data-bd2="salinskors">Salin kalimat</button></div>` +
      `</div>`;
  }
  async function salinKalimatSkors() {
    const t = cari("#bd-skorsteks", wadah.isian);
    if (!t) return;
    let berhasil = false;
    try {
      await navigator.clipboard.writeText(t.value);
      berhasil = true;
    } catch {
      // SIPP/ABT satker bukan konteks aman: papan klip modern ditolak - pakai cara lama.
      try {
        t.removeAttribute("readonly");
        t.select();
        berhasil = document.execCommand("copy");
      } catch {
        berhasil = false;
      } finally {
        t.setAttribute("readonly", "");
      }
    }
    toast(berhasil ? "Kalimat skors tersalin. Tempel di BAS." : "Tidak dapat menyalin otomatis - kalimatnya sudah tersorot, tekan Ctrl+C.");
    if (!berhasil) t.select();
  }
  function renderProgres() {
    const p = cari("#bd-progres", wadah.akar);
    const bar = cari("#bd-barisi", wadah.isian);
    if (!S.susunan) {
      if (p) p.textContent = "";
      return;
    }
    const h = hitung();
    if (p) {
      p.textContent = h.t ? (h.a >= h.t ? "Semua terisi. Lanjut cetak." : `${h.a} dari ${h.t} terisi`) : "Tidak ada yang perlu diisi";
      p.classList.toggle("beres", h.a >= h.t);
    }
    if (bar) bar.style.width = `${h.t ? Math.round((h.a / h.t) * 100) : 100}%`;
  }

  /** Pilihan set: panduan ALETA (disarankan dulu) lalu set yang tersimpan di ABT. */
  function pilihanSetSaksi(t) {
    const abt = (t && t.templates ? t.templates : []).map((x) => `<option value="${esc(x.nilai)}">${esc(x.kode === "#" ? `Salin dari ${x.nama}` : `${x.nama} (${x.kode})`)}</option>`).join("");
    const aleta = S.setSaksi && S.setSaksi.daftar.length ? S.setSaksi.daftar : [];
    const opsiKat = ktOpsiSet();
    if (!aleta.length) return opsiKat + abt;
    // 19 Okt 2026: saran TERPILIH otomatis di dropdown; alasannya hanya `title` (bukan paragraf di layar).
    const idUtama = opsiKat ? "" : (aleta.find((x) => x.utama) || {}).id;
    const opsi = aleta.map((x) => `<option value="aleta:${esc(x.id)}" title="${esc([x.untuk, x.utama ? x.sebab : ""].filter(Boolean).join(" - "))}"${idUtama && x.id === idUtama ? " selected" : ""}>${esc(x.judul)}${x.utama ? " - disarankan" : ""}</option>`).join("");
    return `${opsiKat}<optgroup label="Panduan ALETA sesuai jenis perkara">${opsi}</optgroup>${abt ? `<optgroup label="Set yang tersimpan di ABT">${abt}</optgroup>` : ""}`;
  }
  /**
   * 19 Okt 2026: TIDAK ada lagi paragraf penjelasan di bawah tombol (permintaan pengguna).
   * Saran set tetap terpilih otomatis di dropdown "Set pertanyaan"; alasannya hanya `title`.
   */
  function ketSetSaksi() {
    return "";
  }
  /** Alasan saran untuk `title` dropdown (tooltip), bukan teks tampil. */
  function alasanSetSaksi() {
    const utama = S.setSaksi && S.setSaksi.daftar.filter((x) => x.utama);
    if (!utama || !utama.length) return "";
    return `Disarankan: ${utama.map((x) => x.judul).join(" + ")}${utama[0].sebab ? ` (${utama[0].sebab})` : ""}`;
  }
  // ──────────────────────────────────────────────────────────────────────────
  // 19 Okt (tahap 2): tombol tanya jawab saksi menurut jenis blangko & peran
  // ──────────────────────────────────────────────────────────────────────────
  /** Peran hakim tanpa peran panitera pengganti: hanya membaca tanya jawab saksi (berita acara disusun PP). */
  const hakimSaja = () => {
    const p = peranAkun();
    return p.includes("hakim") && !p.includes("pp");
  };
  /**
   * Deret tombol tanya jawab (lihat deretTombol di blangko-derry-saksi.js): hanya penyusun berita acara (PP/admin) pada
   * blangko BAS yang menyunting; putusan/penetapan dan peran hakim hanya membaca, tanpa satu pun tombol tanya jawab.
   */
  function deretTj() {
    const m = SK();
    const berpasangan = Boolean(S.tjBuka && S.tjSisi && tjPasangan(S.tjBuka));
    const o = { jenis: S.blangko ? S.blangko.jenis : "", bolehTulis: bolehTulis(), hakimSaja: hakimSaja(), berpasangan };
    if (m && typeof m.deretTombol === "function") return m.deretTombol(o);
    const baca = !(o.jenis === "bas" && o.bolehTulis && !o.hakimSaja);
    return { hanyaBaca: baca, atas: [], urungUlang: !baca, lainnya: [], bawah: baca ? [] : ["simpan"] };
  }
  /** Saksi lain (selain `kunci`) yang dapat menjadi tujuan tukar/salin jawaban. */
  const tujuanLain = (kunci) => kunciSaksiSemua().filter((x) => x !== kunci && tjItem(x));
  const namaSaksiTj = (kunci) => (tjItem(kunci) ? tjItem(kunci).tj.sebutan : kunci);

  // ──────────────────────────────────────────────────────────────────────────
  // 20 Okt: warna kotak jawaban saksi menurut asalnya + ringkasan "N terisi · N ragu · N perlu dilengkapi"
  // (fungsi murninya di blangko-derry-saksi-tampil.js; di sini hanya HTML dan perilaku halaman).
  // ──────────────────────────────────────────────────────────────────────────
  /** Lencana kecil di bawah kotak jawaban: "ragu ⓘ" (alasannya di ikon) atau "perlu dilengkapi"; yang lain tanpa lencana. */
  function isiCapAsal(r) {
    const m = TP();
    if (!m) return "";
    const a = m.asalBaris(r);
    if (a === "ragu") {
      const alasan = m.alasanRagu(r);
      return `<span class="bd-asallencana ragu">ragu <button type="button" class="bd-ikon bd-asalinfo" data-bd2="infoasal" title="${esc(alasan)}" aria-label="Mengapa ragu: ${esc(alasan)}">ⓘ</button></span>`;
    }
    if (a === "kosong") return `<span class="bd-asallencana kosong">perlu dilengkapi</span>`;
    return "";
  }
  const htmlCapAsal = (r) => (TP() ? `<span class="bd-asalcap" data-asalcap>${isiCapAsal(r)}</span>` : "");
  function htmlRingkasAsal(daftar) {
    const m = TP();
    if (!m) return "";
    const h = m.hitungAsal(daftar);
    if (!h.total) return "";
    const tombolAtauTeks = (n, label, jenis) =>
      n ? `<button type="button" class="bd-asalbtn ${jenis}" data-bd2="lompat" data-jenis="${jenis}" title="Lompat ke kotak ${label} berikutnya">${n} ${label}</button>` : `<span class="bd-asalbag ${jenis}">${n} ${label}</span>`;
    return `<div class="bd-asalringkas" id="bd-asalringkas" role="status" aria-live="polite"><span class="bd-asalbag data">${h.terisi} terisi</span> · ${tombolAtauTeks(h.ragu, "ragu", "ragu")} · ${tombolAtauTeks(h.kosong, "perlu dilengkapi", "kosong")}</div>`;
  }
  /** Daftar baris yang sedang tampil (dua saksi berdampingan, atau satu saksi). */
  function daftarJawabTampil() {
    if (!S.tjBuka) return [];
    const ps = S.tjSisi && !deretTj().hanyaBaca ? tjPasangan(S.tjBuka) : null;
    return (ps || [S.tjBuka]).map((k) => (S.tj[k] && S.tj[k].rows) || []);
  }
  /** Warna, lencana, dan ringkasan diperbarui di tempat saat petugas mengetik (tanpa menggambar ulang, fokus tetap). */
  function segarAsalTampil() {
    const m = TP();
    const wad = cari("#bd-tjwadah", wadah.isian);
    if (!m || !wad || !S.tjBuka) return;
    const ps = S.tjSisi ? tjPasangan(S.tjBuka) : null;
    for (const el of cariSemua("textarea[data-asal]", wad)) {
      let r = null;
      if (el.hasAttribute("data-sba") && ps) {
        const rows = S.tj[ps[Number(el.getAttribute("data-sk"))]];
        r = rows && rows.rows[Number(el.getAttribute("data-sba"))];
      } else if (el.hasAttribute("data-tjb") && S.tj[S.tjBuka]) r = S.tj[S.tjBuka].rows[Number(el.getAttribute("data-tjb"))];
      if (!r) continue;
      const a = m.asalBaris(r);
      for (const j of ["kosong", "ragu", "data", "manual"]) el.classList.toggle(`bd-asal-${j}`, j === a);
      el.setAttribute("data-asal", a);
      const cap = el.nextElementSibling;
      if (cap && cap.hasAttribute("data-asalcap")) cap.innerHTML = isiCapAsal(r);
    }
    const ring = cari("#bd-asalringkas", wad);
    const baru = htmlRingkasAsal(daftarJawabTampil());
    if (ring && baru) ring.outerHTML = baru;
    else if (ring) ring.remove();
  }
  /** Lompat ke kotak jawaban "ragu"/"kosong" BERIKUTNYA (urutan di halaman), lalu beri fokus. */
  function lompatAsal(jenis) {
    const wad = cari("#bd-tjwadah", wadah.isian);
    if (!wad || (jenis !== "ragu" && jenis !== "kosong")) return;
    const semuaKotak = cariSemua("textarea[data-asal]", wad);
    const sasaranAda = semuaKotak.filter((el) => el.getAttribute("data-asal") === jenis);
    if (!sasaranAda.length) return toast(jenis === "ragu" ? "Tidak ada jawaban yang ragu." : "Semua jawaban sudah terisi.");
    const akhir = S.sk.lompat && S.sk.lompat.jenis === jenis ? S.sk.lompat.urut : -1;
    const sasaran = sasaranAda.find((el) => semuaKotak.indexOf(el) > akhir) || sasaranAda[0];
    S.sk.lompat = { jenis, urut: semuaKotak.indexOf(sasaran) };
    if (typeof sasaran.scrollIntoView === "function") sasaran.scrollIntoView({ block: "center" });
    sasaran.focus();
  }

  function renderTj() {
    perbaruiSaksiKosong();
    const tombol = cari("#bd-tjtombol", wadah.isian);
    const wad = cari("#bd-tjwadah", wadah.isian);
    if (!tombol || !wad) return;
    const items = daftarPerlu().filter((x) => x.jenis === "tj");
    const deret = deretTj();
    const ps = !deret.hanyaBaca && S.tjBuka && S.tjSisi ? tjPasangan(S.tjBuka) : null;
    const tombolSaksi = (it) => {
      const k = it.tj.kunci;
      const t = S.tj[k];
      const n = t && t.rows ? t.rows.filter((r) => String(r.jawab || "").trim()).length : 0;
      const terisiAbt = !t && S.nilai[it.kode] && S.nilai[it.kode].status === "terisi";
      const aktif = S.tjBuka === k || (ps && ps.includes(k));
      return `<button type="button" class="bd-btn kecil${aktif ? " kuning" : ""}" data-tj="${esc(k)}" aria-expanded="${aktif}">${n || terisiAbt ? "✓ " : ""}${esc(it.tj.sebutan)}${n ? ` · ${n} baris` : terisiAbt ? " · tersimpan di ABT" : " · belum diisi"}${t && t.berubah ? " · belum disimpan" : ""}</button>`;
    };
    const judulBagian = items.length ? `<span class="bd-lbl">Tanya jawab saksi</span>${ikonSumber(`tj:${items[0].tj.kunci}`, "Tanya jawab saksi")}` : "";
    const sidangTeks = `sidang ke-${sidangUrutan()}${S.pk && S.pk.sidangDipilih ? ` (${tglIndo(S.pk.sidangDipilih.tanggal)})` : ""}`;

    // ── Hanya baca (putusan/penetapan, peran hakim): ringkas, terlipat, tanpa tombol sunting ──
    if (deret.hanyaBaca) {
      tombol.innerHTML = items.length
        ? `${judulBagian}<button type="button" class="bd-btn kecil" data-bd2="lipattj" aria-expanded="${S.tjLipat}">${S.tjLipat ? "▾" : "▸"} Lihat keterangan saksi</button>${S.tjLipat ? items.map(tombolSaksi).join("") : ""}`
        : "";
      const it = S.tjLipat && S.tjBuka ? tjItem(S.tjBuka) : null;
      if (!it) {
        wad.innerHTML = "";
        return;
      }
      const t = S.tj[S.tjBuka];
      const rows = (t && t.rows) || [];
      // 27 Okt: keterangan tersimpan di sidang lain (sidang pembuktian sebelum sidang putusan) - disebut terang.
      const sidangLain = t && t.sidangBaca && String(t.sidangBaca) !== String(sidangUrutan()) && barisTjBerisi(rows) ? String(t.sidangBaca) : "";
      const chipSidang = sidangLain ? `keterangan dari sidang ke-${sidangLain}${tanggalSidangUrutan(sidangLain)}` : sidangTeks;
      wad.innerHTML =
        `<div class="bd-tjwadah bd-tjbaca"><div class="bd-tjalat"><b>${esc(it.tj.sebutan)}</b><span class="bd-chip">${esc(chipSidang)}</span></div>` +
        `<p class="bd-catat">Hanya dibaca. Tanya jawab saksi disusun di berita acara sidang.</p>` +
        (sidangLain ? `<p class="bd-catat" role="status">Keterangan ini tersimpan di ABT pada sidang ke-${esc(sidangLain)}${esc(tanggalSidangUrutan(sidangLain))}, bukan sidang ke-${esc(sidangUrutan())} yang dipilih.${it.tj.peran === "keterangan" ? " Putusan memuat keterangan saksi dari semua sidang." : " Berita acara sidang ini tidak memuatnya."}</p>` : "") +
        (t && t.memuat ? `<p class="bd-catat" role="status">Membaca keterangan ${esc(it.tj.sebutan)} dari ABT…</p>` : "") +
        (t && t.galat ? `<p class="bd-peringatan">${esc(t.galat)}</p>` : "") +
        `<div class="bd-tjtabel"><table><thead><tr><th class="no-u">No</th><th>Pertanyaan</th><th>Jawaban</th></tr></thead><tbody>${
          rows.map((r, i) => ({ r, i, j: bersihkanPenutup(r.jawab, r.tanya) })).filter((x) => x.j !== "" || !String(x.r.jawab || "").trim()).map((x) => `<tr><td class="no-u">${x.i + 1}</td><td>${esc(x.r.tanya)}</td><td>${esc(x.j)}</td></tr>`).join("") ||
          `<tr><td colspan="3" class="bd-catat">${t && t.memuat ? "Membaca dari ABT…" : "Belum ada keterangan saksi di ABT."}</td></tr>`
        }</tbody></table></div></div>`;
      return;
    }

    // ── Penyusun berita acara (PP/admin) pada BAS ──
    tombol.innerHTML = items.length ? `${judulBagian}${items.map(tombolSaksi).join("")}` : "";
    if (!S.tjBuka) {
      wad.innerHTML = "";
      return;
    }
    const it = tjItem(S.tjBuka);
    if (!it) {
      wad.innerHTML = "";
      return;
    }
    const t = S.tj[S.tjBuka];
    const alatAtas = (judul, kunciDaftar) =>
      `<div class="bd-tjalat"><b>${esc(judul)}</b><span class="bd-chip">${esc(sidangTeks)}</span>` +
      (tjPasangan(S.tjBuka) ? `<span class="bd-seg" role="tablist" aria-label="Cara menampilkan saksi"><button type="button" role="tab" data-tjmode="sisi" aria-selected="${S.tjSisi}">Berdampingan</button><button type="button" role="tab" data-tjmode="satu" aria-selected="${!S.tjSisi}">Satu per satu</button></span>` : "") +
      `<label class="bd-lbl" for="bd-muattpl">Set pertanyaan</label><select id="bd-muattpl" title="${esc(alasanSetSaksi())}">${pilihanSetSaksi(t)}</select>` +
      `<button type="button" class="bd-btn kecil" data-bd2="muattpl" data-kunci="${esc(kunciDaftar.join("|"))}" ${tjSiap(kunciDaftar) ? "" : "disabled"}>Muat</button></div>` +
      ketSetSaksi();
    // Urungkan/Ulangi + menu "Lainnya" (fungsi yang jarang dipakai, dengan kalimat yang jelas).
    const alatKedua = () =>
      `<div class="bd-tjalat bd-sbalat" role="toolbar" aria-label="Susun keterangan saksi">` +
      `<button type="button" class="bd-btn kecil" data-sbaksi="urung" ${S.tjRiw.u.length ? "" : "disabled"}>↶ Urungkan</button><button type="button" class="bd-btn kecil" data-sbaksi="ulang" ${S.tjRiw.r.length ? "" : "disabled"}>↷ Ulangi</button>` +
      (deret.lainnya.length
        ? `<span class="bd-lainnya"><button type="button" class="bd-btn kecil" data-bd2="lainnya" aria-haspopup="menu" aria-expanded="${S.tjMenu}">Lainnya ▾</button>` +
          `<span class="bd-lainnyamenu" role="menu" aria-label="Lainnya"${S.tjMenu ? "" : " hidden"}>${deret.lainnya.map((x) => `<button type="button" role="menuitem" class="bd-btn kecil" data-sbaksi="${esc(x.kunci)}" title="${esc(x.title)}">${esc(x.label)}</button>`).join("")}</span></span>`
        : "") +
      `<span class="bd-catat" id="bd-sbstat" role="status"></span></div>`;
    // "Simpan ke ABT" di BAWAH tabel keterangan saksi (sesudah baris terakhir).
    // 20 Okt: "Tambah baris" juga di bawah tabel (sesudah baris terakhir), bukan di bilah atas.
    const kaki = (kunciDaftar) =>
      `<div class="bd-tjalat bd-tjkaki"><button type="button" class="bd-btn kecil" data-bd2="tambahtj" data-kunci="${esc(kunciDaftar.join("|"))}" ${tjSiap(kunciDaftar) ? "" : "disabled"}>+ Tambah baris</button><button type="button" class="bd-btn kecil utama" data-bd2="simpantj" data-kunci="${esc(kunciDaftar.join("|"))}" ${bolehTulis() && tjSiap(kunciDaftar) ? "" : "disabled"}>Simpan ke ABT</button></div>`;
    // JJ2: keterangan penulisan otomatis jawab-menjawab (ditulis / tidak rapi -> Salin).
    const otoTeks = (k) => {
      const o = S.tjOto && S.tjOto[k];
      if (!o) return "";
      if (o.status === "salin") return `<p class="bd-peringatan" role="status">${esc(o.pesan)}${o.teks ? ` <button type="button" class="bd-btn kecil" data-bd2="salinjm" data-kunci="${esc(k)}">Salin</button>` : ""}</p>`;
      return `<p class="bd-catat" role="status">${esc(o.pesan)}</p>`;
    };
    const status = (k) => otoTeks(k) + statusDasar(k);
    const statusDasar = (k) => {
      const x = S.tj[k];
      if (!x) return "";
      if (x.memuat) return `<p class="bd-catat" role="status">Membaca keterangan ${esc(tjItem(k).tj.sebutan)} dari ABT…</p>`;
      if (x.menyimpan) return `<p class="bd-catat" role="status">${esc(x.menyimpan)}</p>`;
      if (x.galat) return `<p class="bd-peringatan">${esc(x.galat)}</p>`;
      // Daftar sudah terisi lagi -> catatan percobaan simpan kosong dihapus, jadi tidak muncul kembali bila daftar dikosongkan belakangan.
      if (x.kosongSimpan && x.rows.some((r) => String(r.tanya || "").trim() || String(r.jawab || "").trim())) x.kosongSimpan = false;
      const kosong = TP() ? TP().peringatanDaftarKosong(tjItem(k) ? tjItem(k).tj.sebutan : "", x.rows, x.kosongSimpan) : "";
      if (kosong) return `<p class="bd-peringatan" data-kosongsimpan="${esc(k)}" role="alert">${esc(kosong)}</p>`;
      if (x.tersimpanJam && !x.berubah) return `<p class="bd-catat">✓ tersimpan di ABT ${esc(x.tersimpanJam)}${x.ganti ? ` (huruf ${esc(x.ganti)} diganti ke bentuk aman ABT)` : ""}</p>`;
      return "";
    };
    // Pilihan saksi tujuan (tukar/salin) bila saksinya lebih dari dua.
    const pilihTujuan = (kunci, i) => {
      const x = S.tjTujuan;
      if (!x || x.kunci !== kunci || x.i !== i) return "";
      const daftar = tujuanLain(kunci);
      return (
        `<span class="bd-tujuan" role="group" aria-label="Pilih saksi tujuan">${x.aksi === "salin" ? "Salin ke" : "Tukar dengan"}: ` +
        daftar.map((d) => `<button type="button" class="bd-chip bd-tombolchip" data-jaksi="${x.aksi}|${esc(kunci)}|${i}|${esc(d)}">${esc(namaSaksiTj(d))}</button>`).join("") +
        `<button type="button" class="bd-chip bd-tombolchip" data-jaksi="batal|${esc(kunci)}|${i}">Batal</button></span>`
      );
    };
    // 20 Okt: warna kotak jawaban menurut asalnya (kosong / ragu / data / manual) - dihitung saat tampil.
    const asalDari = (r) => (TP() ? TP().asalBaris(r) : "manual");
    const kelasAsal = (r) => (TP() ? ` bd-asal bd-asal-${asalDari(r)}` : "");
    const atrAsal = (r) => (TP() ? ` data-asal="${asalDari(r)}"` : "");
    const ringkasAsal = (daftar) => htmlRingkasAsal(daftar);
    const banyakSaksi = kunciSaksiSemua().length;
    const judulTukar = (lain) => (banyakSaksi > 2 ? "Tukar jawaban ini dengan jawaban saksi lain (pilih saksinya)" : `Tukar jawaban ini dengan jawaban ${lain} di baris yang sama (pertanyaan tetap)`);
    if (ps) {
      const A = (S.tj[ps[0]] && S.tj[ps[0]].rows) || [];
      const B = (S.tj[ps[1]] && S.tj[ps[1]].rows) || [];
      const n = Math.max(A.length, B.length);
      const na = tjItem(ps[0]).tj.sebutan;
      const nb = tjItem(ps[1]).tj.sebutan;
      const mini = (i, k, nama, lain, simbolSalin) =>
        `<span class="bd-sbmini"><button type="button" class="bd-ikon" data-sbganti="${i}.${k}" title="Ganti kalimat, artinya sama" aria-label="Ganti kalimat jawaban ${esc(nama)}">⟳</button>` +
        `<button type="button" class="bd-ikon" data-sbsalin="${i}.${k}" title="Salin ke ${esc(lain)}" aria-label="Salin jawaban ke ${esc(lain)}">${simbolSalin}</button>` +
        `<button type="button" class="bd-ikon" data-jaksi="pilihtukar|${esc(ps[k])}|${i}" title="${esc(judulTukar(lain))}" aria-label="Tukar jawaban ${esc(nama)} nomor ${i + 1}">⇄</button>` +
        `<button type="button" class="bd-ikon" data-jaksi="naik|${esc(ps[k])}|${i}" title="Naikkan jawaban ini satu baris (pertanyaan tetap di tempatnya)" aria-label="Naikkan jawaban ${esc(nama)} nomor ${i + 1}" ${i > 0 ? "" : "disabled"}>⇧</button>` +
        `<button type="button" class="bd-ikon" data-jaksi="turun|${esc(ps[k])}|${i}" title="Turunkan jawaban ini satu baris (pertanyaan tetap di tempatnya)" aria-label="Turunkan jawaban ${esc(nama)} nomor ${i + 1}" ${i < n - 1 ? "" : "disabled"}>⇩</button></span>${pilihTujuan(ps[k], i)}`;
      const baris = Array.from({ length: n }, (_, i) => {
        const a = A[i] || { tanya: "", jawab: "" };
        const b = B[i] || { tanya: "", jawab: "" };
        const st = !a.jawab.trim() || !b.jawab.trim() ? ["belum diisi", ""] : norm(a.jawab) === norm(b.jawab) ? ["jawaban sama persis", "sebagian"] : ["kalimat berbeda", "ok"];
        const qBeda = norm(a.tanya) !== norm(b.tanya) && b.tanya.trim();
        return (
          `<div class="bd-sbrow"><div class="bd-sbno"><b>${i + 1}</b><span class="bd-sbgerak"><button type="button" class="bd-ikon" data-sbnaik="${i}" title="Naikkan baris tanya jawab ini (pertanyaan dan kedua jawaban)" aria-label="Naikkan baris ${i + 1}">↑</button><button type="button" class="bd-ikon" data-sbturun="${i}" title="Turunkan baris tanya jawab ini (pertanyaan dan kedua jawaban)" aria-label="Turunkan baris ${i + 1}">↓</button><button type="button" class="bd-ikon" data-sbhapus="${i}" title="Hapus baris ini untuk kedua saksi" aria-label="Hapus baris ${i + 1}">✕</button></span></div>` +
          `<div class="bd-sbq"><textarea class="bd-ed" rows="2" data-sbq="${i}" aria-label="Pertanyaan ${i + 1}">${esc(a.tanya)}</textarea>${qBeda ? `<p class="bd-sbbeda">Pertanyaan ${esc(nb)} berbeda: “${esc(b.tanya)}” <button type="button" class="bd-chip bd-tombolchip" data-sbaksi="qsama:${i}">Samakan</button></p>` : ""}<span class="bd-chip ${st[1]}">${st[0]}</span></div>` +
          `<div class="bd-sba"><span class="bd-sblabel">${esc(na)}</span><textarea class="bd-ed${kelasAsal(a)}" rows="3" data-sba="${i}" data-sk="0"${atrAsal(a)} aria-label="Jawaban ${esc(na)} nomor ${i + 1}">${esc(a.jawab)}</textarea>${htmlCapAsal(a)}${mini(i, 0, na, nb, "→")}</div>` +
          `<div class="bd-sba"><span class="bd-sblabel">${esc(nb)}</span><textarea class="bd-ed${kelasAsal(b)}" rows="3" data-sba="${i}" data-sk="1"${atrAsal(b)} aria-label="Jawaban ${esc(nb)} nomor ${i + 1}">${esc(b.jawab)}</textarea>${htmlCapAsal(b)}${mini(i, 1, nb, na, "←")}</div></div>`
        );
      }).join("");
      wad.innerHTML =
        `<div class="bd-tjwadah bd-sbs">${alatAtas(`${na} dan ${nb}`, ps)}` +
        `${alatKedua()}` +
        `${panelPengetahuan(ps)}${status(ps[0])}${status(ps[1])}${ringkasAsal([A, B])}<div class="bd-sbhead" aria-hidden="true"><span>No</span><span>Pertanyaan</span><span>${esc(na)}</span><span>${esc(nb)}</span></div><div class="bd-sblist">${baris || `<p class="bd-catat" style="padding:10px">Belum ada pertanyaan. Muat set pertanyaan atau tambah baris.</p>`}</div>${kaki(ps)}</div>`;
      tumbuhkanSemua(wad);
      return;
    }
    const rows = (t && t.rows) || [];
    const kk = S.tjBuka;
    const miniSatu = (i) =>
      `<span class="bd-sbmini"><button type="button" class="bd-ikon" data-jaksi="ganti|${esc(kk)}|${i}" title="Ganti kalimat, artinya sama" aria-label="Ganti kalimat jawaban nomor ${i + 1}">⟳</button>` +
      `<button type="button" class="bd-ikon" data-jaksi="pilihsalin|${esc(kk)}|${i}" title="Salin jawaban ini ke saksi lain" aria-label="Salin jawaban nomor ${i + 1} ke saksi lain" ${tujuanLain(kk).length ? "" : "disabled"}>⧉</button>` +
      `<button type="button" class="bd-ikon" data-jaksi="pilihtukar|${esc(kk)}|${i}" title="${esc(judulTukar("saksi lain"))}" aria-label="Tukar jawaban nomor ${i + 1} dengan saksi lain" ${tujuanLain(kk).length ? "" : "disabled"}>⇄</button>` +
      `<button type="button" class="bd-ikon" data-jaksi="naik|${esc(kk)}|${i}" title="Naikkan jawaban ini satu baris (pertanyaan tetap di tempatnya)" aria-label="Naikkan jawaban nomor ${i + 1}" ${i > 0 ? "" : "disabled"}>⇧</button>` +
      `<button type="button" class="bd-ikon" data-jaksi="turun|${esc(kk)}|${i}" title="Turunkan jawaban ini satu baris (pertanyaan tetap di tempatnya)" aria-label="Turunkan jawaban nomor ${i + 1}" ${i < rows.length - 1 ? "" : "disabled"}>⇩</button></span>${pilihTujuan(kk, i)}`;
    wad.innerHTML =
      `<div class="bd-tjwadah">${alatAtas(it.tj.sebutan, [S.tjBuka])}${status(S.tjBuka)}` +
      `${alatKedua()}` +
      `${panelPengetahuan([S.tjBuka])}${ringkasAsal([rows])}<div class="bd-tjtabel"><table><thead><tr><th class="no-u">No</th><th>Pertanyaan</th><th>Jawaban</th><th></th></tr></thead><tbody>${
        rows
          .map(
            (r, i) =>
              `<tr><td class="no-u">${i + 1}</td><td><textarea class="bd-ed" rows="2" data-tjb="${i}" data-sisi="tanya" aria-label="Pertanyaan ${i + 1}">${esc(r.tanya)}</textarea></td><td><textarea class="bd-ed${kelasAsal(r)}" rows="2" data-tjb="${i}" data-sisi="jawab"${atrAsal(r)} aria-label="Jawaban ${i + 1}">${esc(r.jawab)}</textarea>${htmlCapAsal(r)}${miniSatu(i)}</td><td style="white-space:nowrap"><button type="button" class="bd-ikon" data-naik="${i}" title="Naikkan baris tanya jawab ini" aria-label="Naik">↑</button> <button type="button" class="bd-ikon" data-turun="${i}" title="Turunkan baris tanya jawab ini" aria-label="Turun">↓</button> <button type="button" class="bd-ikon" data-hapus="${i}" title="Hapus baris ini" aria-label="Hapus">✕</button></td></tr>`
          )
          .join("") || `<tr><td colspan="4" class="bd-catat">${t && t.memuat ? "Membaca dari ABT…" : "Belum ada pertanyaan. Muat set pertanyaan atau tambah baris."}</td></tr>`
      }</tbody></table></div>${kaki([S.tjBuka])}</div>`;
    tumbuhkanSemua(wad);
  }

  function renderSemua() {
    const d = cari("#bd-vdaftar", wadah.isian);
    if (!d || !S.susunan) return;
    d.hidden = !S.semuaBuka;
    if (!S.semuaBuka) return;
    if (!S.semua) {
      void muatSemua();
      return;
    }
    if (S.semua.memuat) {
      d.innerHTML = `<p class="bd-catat" role="status">Menghitung semua isi data perkara ini di ALETA Bot (puluhan kueri ke SIPP, bisa setengah menit)…</p>`;
      return;
    }
    const nilai = S.semua.nilai || {};
    const baris = (nama, teks, asal, kode, bisaUbah) => {
      const samar = perluDisamarkan(teks);
      const isiNya = String(S.isi[kode] !== undefined ? S.isi[kode] : teks || "");
      return `<div class="bd-vbaris"><span>${esc(nama)}</span>${
        bisaUbah
          ? /\n/.test(isiNya)
            ? `<textarea data-k="${kode}" rows="${Math.min(6, isiNya.split("\n").length + 1)}" placeholder="kosong = dari SIPP" ${bolehTulis() || tes() ? "" : "readonly"} aria-label="${esc(nama)}">${esc(isiNya)}</textarea>`
            : `<input data-k="${kode}" value="${esc(isiNya)}" placeholder="kosong = dari SIPP" ${bolehTulis() || tes() ? "" : "readonly"} aria-label="${esc(nama)}">`
          : `<span class="bd-nilai${samar ? " bd-sembunyi" : ""}" ${samar ? 'tabindex="0" title="Arahkan penunjuk ke sini untuk melihat"' : ""}>${esc(teks || "—")}</span>`
      }<span class="bd-chip">${esc(asal)}</span></div>`;
    };
    const pilihan = S.semua.isian.filter((b) => !b.wajib && b.jenis !== "tj");
    const otomatis = S.semua.otomatis || [];
    const asalJenis = (j) => (j === "data_sipp" ? "dari SIPP" : j === "data_sql" ? "dihitung dari SIPP" : j === "multi_sidang" ? "dari jadwal sidang" : /terbilang|tanggal_hari|tanggal_hijriah/.test(j) ? "rumus" : j === "qrcode" ? "kode QR" : "otomatis");
    const html = [];
    if (pilihan.length) {
      html.push(`<div class="bd-vgrup">Isian pilihan (kosong berarti diambil dari SIPP)</div>`);
      for (const b of pilihan) html.push(baris(b.nama, (nilai[b.kode] && nilai[b.kode].teks) || "", "ketikan, boleh kosong", b.kode, true));
    }
    const takBerlakuSemua = daftarTakBerlaku();
    if (takBerlakuSemua.length) {
      html.push(`<div class="bd-vgrup">Isian yang biasanya tidak berlaku untuk perkara ini (boleh diisi bila perlu)</div>`);
      for (const b of takBerlakuSemua) html.push(baris(b.nama, (nilai[b.kode] && nilai[b.kode].teks) || "", "tidak berlaku", b.kode, true));
    }
    html.push(`<div class="bd-vgrup">Terisi sendiri (${otomatis.length})${S.semua.nilaiAda ? "" : ` · nilai belum terhitung: ${esc(S.semua.sebab || "bot tidak menjawab")}`}</div>`);
    for (const o of otomatis) {
      const v = nilai[o.kode];
      const teks = v ? (v.status === "terisi" ? v.teks : v.status === "galat" ? `galat: ${v.sebab || "tidak terhitung"}` : "(kosong)") : "";
      html.push(baris(o.nama, teks, asalJenis(o.jenis), o.kode, false));
    }
    d.innerHTML = html.join("");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RTF -> HTML (pratinjau di layar; yang dicetak selalu RTF asli ABT)
  // ──────────────────────────────────────────────────────────────────────────
  const CP1252 = { 0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ" };
  const RTF_LEWAT = new Set(["fonttbl", "colortbl", "stylesheet", "info", "pict", "themedata", "colorschememapping", "latentstyles", "datastore", "generator", "xmlnstbl", "rsidtbl", "upr", "mmathpr", "wgrffmtfilter", "listtable", "listoverridetable", "listtext", "fldinst", "header", "footer", "headerl", "headerr", "headerf", "footerl", "footerr", "footerf", "footnote", "annotation", "shpinst", "nonshppict", "objdata", "template", "pgptbl", "sttbrgbwrd", "sttbfnpref", "lchars", "fchars", "panose", "xmlopen", "revtbl", "bkmkstart", "bkmkend", "field"]);
  /**
   * Mengurai RTF menjadi paragraf: [{align, runs:[{t,b,i,u}], sel?:true, baris?:true}].
   * Tabel: \cell menutup sel, \row menutup baris; selain itu paragraf biasa.
   */
  function uraiRtf(sumber) {
    const s = rtfTeks(sumber);
    const par = [];
    let runs = [];
    let align = "";
    let dalamTabel = false;
    let selBaris = [];
    let selPar = []; // paragraf (\par) sel yang sedang disusun; sel baru ditutup oleh \cell
    const tumpuk = [];
    let gaya = { b: false, i: false, u: false, lewati: false, uc: 1 };
    let buang = 0;
    const tulis = (teks) => {
      if (gaya.lewati || !teks) return;
      if (buang > 0) {
        buang -= 1;
        return;
      }
      const akhir = runs[runs.length - 1];
      if (akhir && akhir.b === gaya.b && akhir.i === gaya.i && akhir.u === gaya.u) akhir.t += teks;
      else runs.push({ t: teks, b: gaya.b, i: gaya.i, u: gaya.u });
    };
    // Satu sel dapat berisi banyak paragraf: \par di dalam tabel hanya menambah paragraf sel; \cell menutup sel
    // (paragraf digabung dengan baris baru, paragraf kosong di ujung - mis. "\par\cell" dari Word - dibuang).
    const gabungSel = (lain, akhir) => {
      const semua = [...lain, akhir];
      while (semua.length > 1 && !semua[semua.length - 1].runs.some((r) => r.t.trim())) semua.pop();
      const gabung = [];
      semua.forEach((q, k) => {
        if (k) gabung.push({ t: "\n", b: false, i: false, u: false });
        gabung.push(...q.runs);
      });
      const ber = semua.find((q) => q.runs.some((r) => r.t.trim())) || semua[0];
      return { align: ber.align, runs: gabung, jenis: "sel" };
    };
    const tutupPar = (jenis) => {
      const p = { align: align || "", runs, jenis: jenis || "" };
      if (dalamTabel && jenis !== "sel") selPar.push(p);
      else if (dalamTabel) {
        selBaris.push(gabungSel(selPar, p));
        selPar = [];
      } else par.push(p);
      runs = [];
    };
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === "{") {
        tumpuk.push({ ...gaya });
        buang = 0;
        i += 1;
        continue;
      }
      if (c === "}") {
        gaya = tumpuk.pop() || gaya;
        buang = 0;
        i += 1;
        continue;
      }
      if (c === "\\") {
        const n = s[i + 1];
        if (n === "\\" || n === "{" || n === "}") {
          tulis(n);
          i += 2;
          continue;
        }
        if (n === "'") {
          const kode = parseInt(s.substr(i + 2, 2), 16);
          tulis(Number.isNaN(kode) ? "" : CP1252[kode] || String.fromCharCode(kode));
          i += 4;
          continue;
        }
        if (n === "*") {
          // Destinasi tak dikenal dilewati, KECUALI yang isinya naskah (fldrslt dibaca lewat 'field' di bawah).
          const m2 = /^\\\*\\([a-zA-Z]+)/.exec(s.slice(i, i + 40));
          gaya.lewati = true;
          i += 2;
          void m2;
          continue;
        }
        if (n === "~") {
          tulis(" ");
          i += 2;
          continue;
        }
        if (n === "-" || n === "_") {
          i += 2;
          continue;
        }
        if (n === "\n" || n === "\r") {
          tutupPar();
          i += 2;
          continue;
        }
        const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i + 1, i + 48));
        if (!m) {
          i += 2;
          continue;
        }
        i += 1 + m[0].length;
        const kata = m[1];
        const nilai = m[2] === undefined ? null : Number(m[2]);
        if (kata === "field") {
          // {\field{\*\fldinst ...}{\fldrslt hasil}} : hasilnya naskah.
          continue;
        }
        if (kata === "fldrslt") continue;
        if (RTF_LEWAT.has(kata)) {
          gaya.lewati = true;
          continue;
        }
        if (gaya.lewati) continue;
        if (kata === "par" || kata === "sect") {
          buang = 0;
          tutupPar();
        } else if (kata === "line") tulis("\n");
        else if (kata === "page") {
          tutupPar();
          par.push({ align: "", runs: [], jenis: "halaman" });
        } else if (kata === "tab") tulis("\t");
        else if (kata === "pard") align = "";
        else if (kata === "qc") align = "c";
        else if (kata === "qr") align = "r";
        else if (kata === "qj") align = "j";
        else if (kata === "ql") align = "";
        else if (kata === "b") gaya.b = nilai !== 0;
        else if (kata === "i") gaya.i = nilai !== 0;
        else if (kata === "ul") gaya.u = nilai !== 0;
        else if (kata === "ulnone") gaya.u = false;
        else if (kata === "plain") gaya = { ...gaya, b: false, i: false, u: false };
        else if (kata === "trowd") {
          dalamTabel = true;
          align = "";
        } else if (kata === "cell") {
          dalamTabel = true;
          tutupPar("sel");
        } else if (kata === "row") {
          if (runs.length || selPar.length) tutupPar("sel");
          par.push({ align: "", runs: [], jenis: "baris", sel: selBaris });
          selBaris = [];
          selPar = [];
          dalamTabel = false;
        } else if (kata === "uc") gaya.uc = nilai === null ? 1 : nilai;
        else if (kata === "u") {
          let kode = nilai || 0;
          if (kode < 0) kode += 65536;
          tulis(String.fromCharCode(kode));
          buang = gaya.uc;
        }
        continue;
      }
      if (c === "\r" || c === "\n") {
        i += 1;
        continue;
      }
      tulis(c);
      i += 1;
    }
    if (runs.length) tutupPar();
    return par;
  }
  const runHtml = (r) => {
    let t = esc(r.t).replace(/\n/g, "<br>").replace(/\t/g, '<span class="bd-tab"> </span>');
    if (r.b) t = `<b>${t}</b>`;
    if (r.i) t = `<i>${t}</i>`;
    if (r.u) t = `<u>${t}</u>`;
    return t;
  };
  /** HTML pratinjau; `tandai(teksRun) -> html` menandai nilai isian di dalam run. */
  function rtfKeHtml(sumber, tandai) {
    const par = uraiRtf(sumber);
    const out = [];
    let sedangTabel = false;
    const isiPar = (p) => (p.runs.length ? p.runs.map((r) => (tandai ? tandai(r) : runHtml(r))).join("") : "&nbsp;");
    for (const p of par) {
      if (p.jenis === "baris") {
        if (!sedangTabel) {
          out.push("<table>");
          sedangTabel = true;
        }
        out.push(`<tr>${(p.sel || []).map((c) => `<td class="q${c.align || "l"}">${isiPar(c)}</td>`).join("")}</tr>`);
        continue;
      }
      if (sedangTabel) {
        out.push("</table>");
        sedangTabel = false;
      }
      if (p.jenis === "halaman") {
        out.push(`<hr class="bd-halaman">`);
        continue;
      }
      if (!p.runs.length && out.length && /&nbsp;<\/p>$/.test(out[out.length - 1])) continue; // dua paragraf kosong berturut-turut
      out.push(`<p class="q${p.align || "l"}">${isiPar(p)}</p>`);
    }
    if (sedangTabel) out.push("</table>");
    return out.join("\n");
  }
  /** Teks polos RTF (untuk mencari penanda #NNNN# dan nama penandatangan). */
  const rtfKeTeks = (sumber) =>
    uraiRtf(sumber)
      .map((p) => (p.jenis === "baris" ? (p.sel || []).map((c) => c.runs.map((r) => r.t).join("")).join("\t") : p.runs.map((r) => r.t).join("")))
      .join("\n");
  const cekPenandaRtf = (sumber) => [...new Set([...rtfKeTeks(sumber).matchAll(/#(\d{4,5})#/g)].map((m) => m[1]))];

  // ──────────────────────────────────────────────────────────────────────────
  // Pratinjau terlipat: RTF ABT (preview) -> HTML dengan nilai isian bertanda
  // ──────────────────────────────────────────────────────────────────────────
  function nilaiBertanda() {
    const daftar = [];
    if (!S.susunan) return daftar;
    for (const b of S.susunan.isian) {
      if (b.jenis === "tj" || b.khusus === "bukti") continue;
      const v = String(S.isi[b.kode] || "").trim();
      if (v.length < 2) continue;
      const tampil = b.jenis === "tanggal" ? tglIndo(keIso(v) || v) : v;
      for (const t of String(tampil).split(/\r?\n/)) if (t.trim().length >= 2) daftar.push({ kode: b.kode, teks: t.trim(), nama: b.nama });
    }
    daftar.sort((a, b) => b.teks.length - a.teks.length);
    return daftar;
  }
  function pembuatPenanda() {
    const daftar = nilaiBertanda();
    return (r) => {
      let t = r.t;
      const potongan = [];
      // Nilai isian yang ada di run ini dibungkus; "..." = isian kosong.
      const cariSemuaNilai = () => {
        for (const d of daftar) {
          const idx = t.indexOf(d.teks);
          if (idx >= 0) return { idx, panjang: d.teks.length, kode: d.kode, nama: d.nama };
        }
        const k = t.indexOf("...");
        if (k >= 0) return { idx: k, panjang: 3, kode: "", nama: "isian kosong" };
        const p = t.search(/#\d{4,5}#/);
        if (p >= 0) return { idx: p, panjang: (t.slice(p).match(/#\d{4,5}#/) || [""])[0].length, kode: "", nama: "penanda belum terisi", rusak: true };
        return null;
      };
      let hit;
      let batas = 0;
      while ((hit = cariSemuaNilai()) && batas < 60) {
        batas += 1;
        potongan.push(runHtml({ ...r, t: t.slice(0, hit.idx) }));
        const isi = t.slice(hit.idx, hit.idx + hit.panjang);
        const kelas = hit.rusak ? "bd-v rusak" : hit.kode ? "bd-v anda" : "bd-v kosong";
        potongan.push(`<span class="${kelas}" ${hit.kode ? `data-kode="${hit.kode}"` : ""} data-bagian="${esc(hit.nama)}" tabindex="0" title="${esc(hit.kode ? `${hit.nama} · klik dua kali untuk mengubah` : hit.nama)}">${runHtml({ ...r, t: isi })}</span>`);
        t = t.slice(hit.idx + hit.panjang);
      }
      potongan.push(runHtml({ ...r, t }));
      return potongan.join("");
    };
  }
  /**
   * HEADER PENANDA (19 Okt 2026). Blangko Derry menyimpan di HEADER halaman sebuah tabel kecil berisi variabel ABT
   * (mis. "#0184# #0185# #0156# #0157#") dengan huruf 1 pt, superskrip: dipakai menyusun blangko supaya ABT ikut menghitung variabel itu.
   * Sesudah ABT mengisinya, header memuat teks sangat kecil yang tampak sebagai kotak abu di atas halaman. Pada KELUARAN CETAK
   * (RTF, PDF, PDF salinan, PDF anonim, e-Doc) grup header itu diganti header kosong; berkas .rtf di ABT/server tidak disentuh.
   * Hanya dibuang bila SEMUA teks tampak di grup header berukuran <= 3 pt (\fs6) dan tidak ada kolom (nomor halaman) atau gambar:
   * kop/judul header bermuka normal, nomor halaman, dan footer "Putusan Nomor ..." tidak pernah terkena.
   * Terima ArrayBuffer/Uint8Array atau teks biner; pulang jenis yang sama + jumlah header yang dibersihkan.
   */
  const UKURAN_PENANDA_MAKS = 6; // setengah poin: \fs6 = 3 pt
  function headerPenandaKecil(grup) {
    let fs = 24;
    const tumpuk = [];
    let lewat = 0; // kedalaman grup tujuan {\* ...} yang diabaikan
    let teks = 0;
    let terbesar = 0;
    let terlarang = false;
    let kecilAda = false; // ada pengaturan huruf <= 3 pt
    let adaTabel = false; // header berbentuk tabel (kotak penanda)
    const n = grup.length;
    for (let i = 0; i < n; i += 1) {
      const c = grup[i];
      if (c === "{") {
        tumpuk.push(fs);
        if (lewat) lewat += 1;
        else if (grup[i + 1] === "\\" && grup[i + 2] === "*") lewat = 1;
      } else if (c === "}") {
        if (tumpuk.length) fs = tumpuk.pop();
        if (lewat) lewat -= 1;
      } else if (c === "\\") {
        const d = grup[i + 1];
        if (d === "\\" || d === "{" || d === "}") {
          if (!lewat) {
            teks += 1;
            terbesar = Math.max(terbesar, fs);
          }
          i += 1;
        } else if (d === "'") {
          if (!lewat) {
            teks += 1;
            terbesar = Math.max(terbesar, fs);
          }
          i += 3;
        } else if (/[a-zA-Z]/.test(d || "")) {
          let j = i + 1;
          while (j < n && /[a-zA-Z]/.test(grup[j])) j += 1;
          const kata = grup.slice(i + 1, j);
          let k = j;
          if (grup[k] === "-") k += 1;
          while (k < n && /[0-9]/.test(grup[k])) k += 1;
          const angka = grup.slice(j, k);
          if (grup[k] === " ") k += 1;
          if (!lewat) {
            if (kata === "fs") {
              fs = Number(angka) || fs;
              if (fs <= UKURAN_PENANDA_MAKS) kecilAda = true;
            } else if (kata === "trowd") adaTabel = true;
            else if (kata === "plain") fs = 24;
            else if (kata === "field" || kata === "pict" || kata === "shp" || kata === "shpinst" || kata === "nonshppict" || kata === "do") terlarang = true;
            else if (kata === "u") {
              teks += 1;
              terbesar = Math.max(terbesar, fs);
              if (grup[k] === "\\" && grup[k + 1] === "'") k += 4;
              else k += 1;
            }
          }
          i = k - 1;
        } else if (d === "*") {
          i += 1;
        } else {
          i += 1;
        }
      } else if (!lewat && c !== "\r" && c !== "\n" && c !== " " && c !== "\t") {
        teks += 1;
        terbesar = Math.max(terbesar, fs);
      }
    }
    if (terlarang) return false;
    // Ada teks: semuanya harus sangat kecil. Tanpa teks (variabel kosong): hanya kotak tabel berhuruf kecil yang dibuang.
    return teks > 0 ? terbesar <= UKURAN_PENANDA_MAKS : adaTabel && kecilAda;
  }
  function bersihkanHeaderPenanda(rtf) {
    const asalString = typeof rtf === "string";
    const sumber = latin1(rtf);
    const pola = /\{\\header([lrf]?)(?![a-zA-Z])/g;
    let hasil = "";
    let akhir = 0;
    let jumlah = 0;
    let m;
    while ((m = pola.exec(sumber))) {
      let dalam = 0;
      let j = m.index;
      for (; j < sumber.length; j += 1) {
        const c = sumber[j];
        if (c === "\\") j += 1;
        else if (c === "{") dalam += 1;
        else if (c === "}") {
          dalam -= 1;
          if (dalam === 0) break;
        }
      }
      if (dalam !== 0) break; // grup tidak seimbang: biarkan apa adanya
      const grup = sumber.slice(m.index, j + 1);
      pola.lastIndex = j + 1;
      if (!headerPenandaKecil(grup)) continue;
      hasil += `${sumber.slice(akhir, m.index)}{\\header${m[1]}\\pard\\plain\\fs2\\par}`;
      akhir = j + 1;
      jumlah += 1;
    }
    if (!jumlah) return { rtf, jumlah: 0 };
    const baru = hasil + sumber.slice(akhir);
    return { rtf: asalString ? baru : bufDariLatin1(baru), jumlah };
  }
  /**
   * Membuang PARAGRAF kalimat penutup keterangan saksi ("Bahwa cukup sekian", "sudah cukup", "tidak ada lagi, terima kasih") dari RTF cetak
   * putusan - pola pembersih yang sama dengan editor saksi (bersihkanPenutup -> abt.js). Hanya paragraf yang SELURUHNYA kalimat penutup
   * (satu-satunya teks di paragraf itu); ekor kalimat di tengah/akhir paragraf lain, sel tabel, dan paragraf yang memuat grup/kolom/gambar/
   * bidang TIDAK disentuh. Murni: tanpa tulisan ke ABT/SIPP.
   *
   * 21 Okt (x6): dulu RTF dipotong per \par dan paragraf yang kurung kurawalnya tidak seimbang dilewati. Padahal keterangan saksi dari
   * variabel SQL 9259-9265 / list_keterangan ABT masuk SATU grup {...#9259#} dan tiap butir dipisah \par di DALAM grup itu, sehingga butir
   * PERTAMA (membawa "{" pembuka grup) dan butir TERAKHIR (membawa "}" penutup grup) - tempat "Bahwa sudah cukup;" hampir selalu berada -
   * lolos dari pembersihan. Kini RTF dipecah jadi token (kata kendali, kurung, teks); yang dibuang hanya TOKEN TEKS penutup beserta satu
   * \par pemisahnya, sehingga kurung kurawal dan format paragraf tidak pernah terpotong:
   *   - teks diikuti \par (tanpa kurung di antaranya)  -> teks dan \par sesudahnya dibuang (butir di tengah / butir pertama);
   *   - teks diikuti kurung penutup grup (butir terakhir) -> teks dan \par SEBELUMNYA dibuang, sehingga butir sebelumnya menjadi akhir
   *     paragraf dan tidak tersisa paragraf kosong; bila tidak ada \par sebelumnya hanya teksnya yang dibuang.
   */
  function bersihkanPenutupSaksiRtf(rtf) {
    const asalString = typeof rtf === "string";
    const sumber = latin1(rtf);
    const token = sumber.match(/\\[a-zA-Z]+-?\d* ?|\\'[0-9a-fA-F]{2}|\\[^a-zA-Z]|[{}]|[^\\{}]+/g) || [];
    if (token.join("") !== sumber) return { rtf, jumlah: 0 };
    const terlarang = /^\\(?:cell|nestcell|row|nestrow|trowd|intbl|sect|page|pict|field|fldinst|bkmkstart|shp|object|\*)(?![a-zA-Z])|^\\\*/;
    const adalahPar = (t) => /^\\par(?![a-zA-Z])/.test(t);
    const adalahKendali = (t) => t.charAt(0) === "\\";
    const adalahKurung = (t) => t === "{" || t === "}";
    // penanda butir "-" (disusul \tab) bukan isi: ia ikut dibuang bersama butirnya
    const adalahPenandaButir = (t) => !adalahKendali(t) && !adalahKurung(t) && /^[\s\-\u2013\u2022*]*$/.test(t);
    const adalahTab = (t) => /^\\tab(?![a-zA-Z])/.test(t);
    const adaTeks = (t) => !adalahKendali(t) && !adalahKurung(t) && !adalahPenandaButir(t);
    const hapus = new Set();
    let jumlah = 0;
    for (let i = 0; i < token.length; i += 1) {
      const t = token[i];
      if (!adaTeks(t)) continue;
      const isi = t.trim().replace(/^\(?\d{1,2}\s*[.)]\s*/, "");
      if (!isi || isi.length >= 160 || bersihkanPenutup(isi, "") !== "") continue;
      // paragraf yang memuat teks ini: dari \par sebelumnya (a) sampai \par sesudahnya (b); teks ini harus SATU-SATUNYA teks di dalamnya
      let a = i - 1;
      let ok = true;
      for (; a >= 0 && !adalahPar(token[a]); a -= 1) {
        if (adaTeks(token[a]) || terlarang.test(token[a])) {
          ok = false;
          break;
        }
      }
      let b = i + 1;
      for (; ok && b < token.length && !adalahPar(token[b]); b += 1) {
        if (adaTeks(token[b]) || terlarang.test(token[b])) ok = false;
      }
      if (!ok) continue;
      const antaraSesudah = token.slice(i + 1, b);
      const kurungSesudah = antaraSesudah.some(adalahKurung);
      // penanda butir ("-" dan \tab) yang mendahului teks di paragraf yang sama ikut dibuang
      const penanda = [];
      for (let k = a + 1; k < i; k += 1) if (adalahPenandaButir(token[k]) || adalahTab(token[k])) penanda.push(k);
      if (b < token.length && !kurungSesudah) {
        // butir di tengah / pertama: buang penanda + teks + \par pemisah sesudahnya
        penanda.forEach((k) => hapus.add(k));
        hapus.add(i);
        hapus.add(b);
      } else {
        // butir terakhir (disusul kurung penutup grup / akhir berkas): buang penanda + teks + \par sebelumnya bila antara \par itu dan teks
        // hanya ada penanda butir / \tab / spasi (kata kendali format paragraf tidak boleh tertinggal tanpa \par-nya)
        penanda.forEach((k) => hapus.add(k));
        hapus.add(i);
        const antaraSebelum = a >= 0 ? token.slice(a + 1, i) : null;
        if (a >= 0 && antaraSebelum.every((x) => adalahPenandaButir(x) || adalahTab(x))) hapus.add(a);
      }
      jumlah += 1;
    }
    if (!jumlah) return { rtf, jumlah: 0 };
    const baru = token.filter((_x, i) => !hapus.has(i)).join("");
    return { rtf: asalString ? baru : bufDariLatin1(baru), jumlah };
  }
  /**
   * 21 Okt (x6): BAS - tabel tanya-jawab saksi (variabel tanya_jawab bertanda multi_sidang 'tanyajawab', mis. 5058 / 6120) dicetak ABT per
   * pasangan baris (Abt_model::kolom_kode_A4 / kolom_kode_A4s): baris 1 = pertanyaan (\irow0), baris 2 = "- " + jawaban (\irow1\lastrow),
   * masing-masing berakhir \row. Pasangan yang jawabannya SELURUHNYA kalimat penutup ("Sudah cukup;" atas "Apakah masih ada yang ingin
   * Saudara sampaikan?") dibuang utuh, pertanyaannya ikut. Pasangan lain, tabel lain, dan teks di luar tabel tidak disentuh. Murni.
   */
  function bersihkanPenutupTabelRtf(rtf) {
    const asalString = typeof rtf === "string";
    const sumber = latin1(rtf);
    const token = sumber.match(/\\[a-zA-Z]+-?\d* ?|\\'[0-9a-fA-F]{2}|\\[^a-zA-Z]|[{}]|[^\\{}]+/g) || [];
    if (token.join("") !== sumber) return { rtf, jumlah: 0 };
    const adalah = (t, kata) => new RegExp("^\\\\" + kata + "(?![a-zA-Z0-9])").test(t);
    const potong = [];
    let mulai = 0;
    token.forEach((t, i) => {
      if (adalah(t, "row")) {
        potong.push([mulai, i]);
        mulai = i + 1;
      }
    });
    // teks tiap sel (dipisah \cell) dari satu potongan baris
    const sel = (a, b) => {
      const hasil = [];
      let buf = "";
      for (let i = a; i <= b; i += 1) {
        const t = token[i];
        if (adalah(t, "cell")) {
          hasil.push(buf.replace(/\s+/g, " ").trim());
          buf = "";
        } else if (/^\\'[0-9a-fA-F]{2}$/.test(t)) buf += String.fromCharCode(parseInt(t.slice(2), 16));
        else if (t.charAt(0) !== "\\" && t !== "{" && t !== "}") buf += t;
      }
      return hasil;
    };
    const punya = (a, b, kata) => token.slice(a, b + 1).some((t) => adalah(t, kata));
    const hapus = new Set();
    let jumlah = 0;
    for (let k = 0; k + 1 < potong.length; k += 1) {
      const [a1, b1] = potong[k];
      const [a2, b2] = potong[k + 1];
      if (!punya(a1, b1, "irow0") || !punya(a2, b2, "irow1") || !punya(a2, b2, "lastrow")) continue;
      const tanya = sel(a1, b1)[0] || "";
      const sel2 = sel(a2, b2);
      const jawab = sel2.length ? sel2[sel2.length - 1] : "";
      if (!jawab || jawab.length >= 400 || sel2.length !== 2) continue;
      if (bersihkanPenutup(jawab, tanya) !== "") continue;
      for (let i = a1; i <= b2; i += 1) hapus.add(i);
      jumlah += 1;
      k += 1;
    }
    if (!jumlah) return { rtf, jumlah: 0 };
    const baru = token.filter((_x, i) => !hapus.has(i)).join("");
    return { rtf: asalString ? baru : bufDariLatin1(baru), jumlah };
  }
  /**
   * Tes putusan: naskah dihitung di ALETA (blangko Derry dibaca, penanda diisi dari data perkara acuan seperti abt/preview, lalu
   * ketikan petugas ditimpakan seolah tersimpan). Satu POST yang hanya MENGHITUNG; ABT, SIPP, dan e-Court tidak ditulis.
   * Pulang bentuk yang sama dengan klienAbt().cetak: { ok, rtf: ArrayBuffer, periksa }.
   */
  async function cetakTes() {
    const d = await ambilPortal(
      API_TES_NASKAH,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkaraId: perkaraId(), sidangKe: Number(sidangUrutan()) || 0, folder: S.blangko.folder || "", berkas: S.blangko.berkas, isian: ketikanTes() }),
        batasMs: BATAS_LAMA_MS,
      },
      "Menyusun naskah tes"
    );
    const mentah = atob(String((d && d.rtfBase64) || ""));
    if (mentah.length < 6 || !mentah.startsWith("{\\rtf")) return { ok: false, pesan: "Naskah tes tidak berbentuk RTF." };
    const biner = new Uint8Array(mentah.length);
    for (let i = 0; i < mentah.length; i += 1) biner[i] = mentah.charCodeAt(i);
    S.prat.tes = { terisi: Number(d.jumlahTerisi) || 0, kosong: Array.isArray(d.kosong) ? d.kosong.length : 0, ketikan: Number(d.ketikanDipakai) || 0, galat: String(d.mesinGalat || "") };
    return { ok: true, rtf: biner.buffer, nama: "", ukuran: biner.length, periksa: typeof abtKlienPeriksaRtf === "function" ? abtKlienPeriksaRtf(mentah) : { jumlahTitikTiga: 0 } };
  }
  // ──────────────────────────────────────────────────────────────────────────
  // CETAK CEPAT (27 Okt 2026): naskah dari ABT disusun SEKALI lalu dipakai ulang oleh Pratinjau, Cetak, dan keluaran lain
  // selama isiannya sama (sidik isian) dan umurnya wajar; boleh disiapkan di latar begitu isian lengkap.
  // ──────────────────────────────────────────────────────────────────────────
  const UMUR_NASKAH_MS = 20 * 60 * 1000; // naskah lebih tua dari ini disusun ulang (data SIPP/ABT bisa berubah di luar panel)
  const JEDA_SIAP_MS = 7000; // isian "tenang" selama ini baru naskah disiapkan di latar
  const JEDA_ULANG_SIAP_MS = 45000; // dua penyiapan otomatis berjarak minimal ini (ABT menghitung naskah lama dan berat)
  /** Sidik 53-bit untuk teks (cyrb53); cukup untuk membedakan keadaan isian, bukan untuk keamanan. */
  function sidikTeks(t) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < t.length; i += 1) {
      const c = t.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `${t.length}:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
  }
  /** Sidik keadaan yang menentukan isi naskah: perkara, blangko, sidang, semua isian, tanya jawab, bukti, ketikan Tes putusan. */
  function sidikIsian() {
    const b = S.blangko || {};
    const kepala = [perkaraId(), b.berkas || "", b.a || "", b.b || "", b.jenis || "", sidangUrutan(), tes() ? "tes" : ""].join("\u0001");
    const isi = Object.keys(S.isi || {}).sort().map((k) => `${k}=${String(S.isi[k])}`).join("\u0002");
    const tj = Object.keys(S.tj || {}).sort().map((k) => `${k}=${(S.tj[k] && Array.isArray(S.tj[k].rows) ? S.tj[k].rows : []).map((r) => `${r.no}|${r.tanya}|${r.jawab}`).join("\u0003")}`).join("\u0002");
    const bukti = JSON.stringify(S.bukti || {}) + JSON.stringify(S.buktiEl || {});
    const ketikan = tes() ? JSON.stringify(S.tesIsian || {}) : "";
    return sidikTeks([kepala, isi, tj, bukti, ketikan].join("\u0004"));
  }
  /** Isian/tanya jawab/sidang berubah: naskah yang sudah disusun tidak berlaku lagi. */
  function tandaiKotor() {
    S.versiIsian += 1;
    if (S.prat) S.prat.kotor = true;
    perbaruiKetSiap();
  }
  const naskahSegar = (pr) => Boolean(pr && pr.rtf && !pr.kotor && pr.sidik === sidikIsian() && Date.now() - (pr.saat || 0) < UMUR_NASKAH_MS);
  async function ambilRtf(paksa) {
    if (!S.blangko || !S.pk) throw new Error("Pilih perkara dan blangko dulu.");
    if (S.blangko.hak !== "ok") throw new Error(S.blangko.hak === "periksa" ? "Hak buka blangko ini masih diperiksa ke ABT; tunggu sebentar." : "ABT tidak mengizinkan blangko ini untuk perkara ini.");
    const pr = S.prat;
    if (!paksa && naskahSegar(pr)) return pr.rtf;
    // Penyusunan yang sedang berjalan untuk keadaan isian yang sama (mis. disiapkan di latar) ditunggu bersama, bukan diminta dua kali ke ABT.
    if (!paksa && pr.janji && pr.janji.versi === S.versiIsian && pr.janji.blangko === S.blangko) return pr.janji.proses;
    const versi = S.versiIsian;
    const proses = ambilRtfBaru(pr, versi, sidikIsian(), S.blangko);
    const janji = { versi, blangko: S.blangko, proses };
    pr.janji = janji;
    try {
      return await proses;
    } finally {
      if (pr.janji === janji) pr.janji = null;
    }
  }
  async function ambilRtfBaru(pr, versi, sidik, blangkoAwal) {
    const h = tes() ? await cetakTes() : await klienAbt().cetak({ a: S.blangko.a, b: S.blangko.b, perkaraId: perkaraId(), sidang: sidangUrutan() });
    if (!h.ok) throw new Error(h.pesan || "ABT tidak mengembalikan naskah.");
    // Header penanda kecil buang dari semua keluaran cetak (RTF, PDF, salinan, anonim, e-Doc); berkas di ABT tidak diubah.
    const bersih = bersihkanHeaderPenanda(h.rtf);
    h.rtf = bersih.rtf;
    pr.headerDibuang = bersih.jumlah;
    // Kotak acuan variabel di BADAN naskah (tabel mengambang berhuruf 1 pt): klien ABT sudah membuangnya; jalur Tes putusan tidak
    // lewat klien itu, jadi dibersihkan lagi di sini (idempoten) dan hitungan titik-titik dihitung ulang dari naskah bersih.
    pr.kotakDibuang = h.kotakDibuang || 0;
    if (typeof abtKlienBuangKotakPenanda === "function") {
      const kotak = abtKlienBuangKotakPenanda(h.rtf);
      if (kotak.jumlah) {
        h.rtf = kotak.rtf;
        pr.kotakDibuang += kotak.jumlah;
        if (typeof abtKlienPeriksaRtf === "function") h.periksa = abtKlienPeriksaRtf(latin1(h.rtf));
      }
    }
    // Putusan: paragraf kalimat penutup keterangan saksi dibuang dari keluaran cetak saja (ABT/SIPP dan BAS tidak disentuh).
    pr.penutupDibuang = 0;
    if (S.blangko.jenis === "put") {
      const tutup = bersihkanPenutupSaksiRtf(h.rtf);
      h.rtf = tutup.rtf;
      pr.penutupDibuang = tutup.jumlah;
    } else if (S.blangko.jenis === "bas") {
      // 21 Okt (x6): BAS - pasangan baris tabel tanya-jawab saksi yang jawabannya hanya kalimat penutup tidak ikut tercetak.
      const tutup = bersihkanPenutupTabelRtf(h.rtf);
      h.rtf = tutup.rtf;
      pr.penutupDibuang = tutup.jumlah;
    }
    // Konteks berganti selama ABT menyusun (blangko/perkara lain dipilih): hasil ini bukan milik layar sekarang.
    if (S.prat !== pr || S.blangko !== blangkoAwal) throw new Error("Blangko atau perkara diganti saat naskah disusun; tekan lagi.");
    pr.rtf = h.rtf;
    pr.saat = Date.now();
    pr.sidik = sidik;
    // Isian berubah selama ABT menyusun: naskah ini sudah lama, tetap kotor supaya disusun ulang (dulu ditandai bersih).
    if (S.versiIsian === versi) pr.kotor = false;
    pr.penanda = cekPenandaRtf(h.rtf);
    pr.titikTiga = h.periksa ? h.periksa.jumlahTitikTiga : 0;
    return h.rtf;
  }
  async function muatPratinjau(paksa) {
    const pr = S.prat;
    if (pr.memuat) return;
    pr.memuat = true;
    pr.galat = "";
    renderPratinjau();
    try {
      const rtf = await ambilRtf(paksa);
      if (S.prat === pr) pr.html = rtfKeHtml(rtf, pembuatPenanda());
    } catch (e) {
      if (S.prat === pr) pr.galat = String((e && e.message) || e);
    }
    pr.memuat = false;
    if (S.prat === pr) renderPratinjau();
  }
  function renderPratinjau() {
    const w = wadah.pratinjau;
    if (!w) return;
    if (!S.blangko) {
      w.innerHTML = `<p class="bd-catat">Pratinjau tampil sesudah blangko dipilih.</p>`;
      return;
    }
    if (S.blangko.khusus) {
      w.innerHTML = `<p class="bd-catat">Pratinjau naskah ada di layar kerja pada langkah isian.</p>`;
      return;
    }
    const p = S.prat;
    const sunting = p.suntingPenuh;
    w.innerHTML =
      pitaTes() +
      `<button type="button" class="bd-pratbuka" data-bd2="bukaprat" aria-expanded="${p.terbuka}"><span class="bd-pana">${p.terbuka ? "▾" : "▸"}</span><span class="bd-tj">Pratinjau naskah</span><span class="bd-catat">${p.terbuka ? "klik untuk melipat" : (naskahSegar(p) ? "klik untuk melihat hasil (naskah sudah siap, langsung tampil)" : "klik untuk melihat hasil (ABT menyusun naskahnya; blangko besar bisa 1-5 menit)")}</span>${p.kotor && p.html && p.terbuka ? `<span class="bd-chip sebagian">isian berubah - muat ulang</span>` : ""}</button>` +
      (p.terbuka
        ? `<div class="bd-pisi">` +
          (p.memuat ? `<p class="bd-catat" role="status">${tes() ? "Naskah tes sedang disusun dari data perkara acuan… (menghitung semua bagian otomatis)" : "ABT sedang menyusun naskah perkara ini… (menghitung semua bagian otomatis)"}</p>` : "") +
          (p.galat ? `<p class="bd-peringatan">${esc(p.galat)} <button type="button" class="bd-btn kecil" data-bd2="muatprat">Coba lagi</button></p>` : "") +
          (p.html
            ? `<div class="bd-baris"><p class="bd-petunjukedit">${sunting ? "Ubah kotak yang berwarna, lalu Simpan ke ABT." : "Klik dua kali bagian berwarna (isian Anda) untuk mengubahnya di sini; bagian lain berasal dari SIPP."}</p>` +
              (bolehTulis() ? (sunting ? `<button type="button" class="bd-btn kecil utama" data-bd2="simpansunting">Simpan ke ABT</button><button type="button" class="bd-btn kecil" data-bd2="batalsunting">Batal</button>` : `<button type="button" class="bd-btn kecil" data-bd2="suntingpenuh">Sunting pratinjau</button>`) : "") +
              `<button type="button" class="bd-btn kecil" data-bd2="muatprat">${tes() ? "Muat ulang dengan ketikan terbaru" : "Muat ulang dari ABT"}</button>` +
              (p.penanda.length ? `<span class="bd-chip belum">${p.penanda.length} penanda belum terbaca: ${esc(p.penanda.map((k) => `#${k}#`).join(" "))}</span>` : "") +
              `</div><div class="bd-kertas${sunting ? " edit" : ""}" id="bd-kertas">${p.html}</div>`
            : "") +
          `</div>`
        : "");
    if (sunting) {
      for (const el of cariSemua("#bd-kertas .bd-v[data-kode]", w)) {
        if (el.querySelector("input, textarea")) continue;
        const kode = el.getAttribute("data-kode");
        const inp = kotakSunting(String(S.isi[kode] || ""));
        inp.setAttribute("data-vk", kode);
        inp.setAttribute("aria-label", `Sunting ${el.getAttribute("data-bagian") || kode}`);
        el.textContent = "";
        el.appendChild(inp);
      }
    }
  }
  /** Kotak sunting pratinjau: textarea bila nilainya bergaris baru (<input> membuang \n). */
  function kotakSunting(nilai, tanggal) {
    const ta = !tanggal && /\n/.test(nilai);
    const inp = document.createElement(ta ? "textarea" : "input");
    inp.className = "bd-vinput";
    if (ta) inp.rows = Math.min(8, nilai.split("\n").length + 1);
    else inp.type = tanggal ? "date" : "text";
    inp.value = nilai;
    inp.setAttribute("data-awal", inp.value);
    return inp;
  }
  function suntingSatu(el) {
    if (!bolehTulis()) return toast(sebabTakTulis(`${NAMA_JENIS[S.blangko.jenis]} hanya diubah ${NAMA_PERAN[JENIS_PERAN[S.blangko.jenis]] || "pejabat perkara"}.`));
    if (el.querySelector("input, textarea")) return;
    const kode = el.getAttribute("data-kode");
    const b = S.susunan && S.susunan.isian.find((x) => x.kode === kode);
    const tanggal = Boolean(b && b.jenis === "tanggal");
    const inp = kotakSunting(tanggal ? keIso(S.isi[kode] || el.textContent) : String(S.isi[kode] || el.textContent || ""), tanggal);
    let diketik = false;
    inp.addEventListener("input", () => (diketik = true));
    inp.setAttribute("aria-label", `Sunting ${el.getAttribute("data-bagian") || kode}`);
    const awal = el.innerHTML;
    el.textContent = "";
    el.appendChild(inp);
    inp.focus();
    let selesai = false;
    const akhir = async (simpan, lewatBlur) => {
      if (selesai) return;
      selesai = true;
      const nilai = inp.value;
      if (!simpan || (lewatBlur && !diketik) || nilai === String(S.isi[kode] || "")) {
        el.innerHTML = awal;
        return;
      }
      el.textContent = b && b.jenis === "tanggal" ? tglIndo(nilai) : nilai;
      const ok = await jadwalkanSimpan(kode, nilai, true);
      const i = cari(`#bd-i${kode}`, wadah.isian);
      if (i) i.value = nilai;
      renderStatusIsian(kode);
      if (ok === false) toast(S.tersimpan[kode] || "Belum tersimpan.");
    };
    inp.addEventListener("blur", () => void akhir(true, true));
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !(inp.tagName === "TEXTAREA" && e.shiftKey)) {
        e.preventDefault();
        void akhir(true);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        void akhir(false);
      }
    });
  }
  async function simpanSuntingPenuh() {
    const inputs = cariSemua("#bd-kertas [data-vk]", wadah.pratinjau);
    const ubah = [];
    for (const i of inputs) {
      const kode = i.getAttribute("data-vk");
      // Dibandingkan juga dengan isi kotak saat dibuka: hanya yang diubah petugas ditulis ke ABT.
      if (i.value !== i.getAttribute("data-awal") && i.value !== String(S.isi[kode] || "")) ubah.push([kode, i.value]);
    }
    S.prat.suntingPenuh = false;
    if (!ubah.length) {
      renderPratinjau();
      return toast("Tidak ada yang berubah.");
    }
    let gagal = 0;
    for (const [kode, nilai] of ubah) {
      const ok = await jadwalkanSimpan(kode, nilai, true);
      const inp = cari(`#bd-i${kode}`, wadah.isian);
      if (inp) inp.value = nilai;
      if (ok === false) gagal += 1;
    }
    toast(gagal ? `${ubah.length - gagal} tersimpan, ${gagal} gagal (lihat keterangan di kotak isian).` : `${ubah.length} isian tersimpan ke ABT. Naskah dimuat ulang.`);
    await muatPratinjau(true);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tanda tangan: ALETA (tanda-tangan yang sudah disahkan) atau milik akun ini
  // ──────────────────────────────────────────────────────────────────────────
  function penandatangan() {
    const p = (S.pk && S.pk.perkara) || {};
    const majelis = pecahNama(p.majelisNama || "");
    const j = S.blangko ? S.blangko.jenis : "put";
    const hk = majelis.map((n, i) => ({ id: i === 0 ? "ketua" : `anggota${i}`, jabatan: i === 0 ? (majelis.length > 1 ? "Ketua Majelis" : "Hakim") : `Hakim Anggota ${i}`, nama: n, peran: "hakim" }));
    const pp = { id: "pp", jabatan: "Panitera Pengganti", nama: String(p.paniteraNama || ""), peran: "pp" };
    const js = { id: "js", jabatan: "Juru Sita", nama: String(p.jurusitaNama || ""), peran: "js" };
    const daftar = j === "put" ? [...hk, pp] : j === "bas" ? [hk[0], pp].filter(Boolean) : [js];
    return daftar.filter((x) => x && x.nama);
  }
  async function muatSumberTtd() {
    if (S.ttdSumber) return S.ttdSumber;
    const sumber = { aleta: null, alasanAleta: "", sendiri: null };
    try {
      const r = typeof alatAmbil === "function" ? await alatAmbil(`${API_TTD}?hanyaSah=1`, { credentials: "include", cache: "no-store" }, "Membaca tanda tangan") : await fetch(`${API_TTD}?hanyaSah=1`, { credentials: "include", cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j) {
        // Bot menjawab { ok, baris: [{ id, namaPejabat, disahkan, penggunaId, disahkanPada }] } (rute portal meneruskannya apa adanya).
        const daftar = [j.baris, j.data && j.data.baris, j.tandaTangan, j.daftar, j.data && j.data.tandaTangan, j.data, j.items].find((x) => Array.isArray(x)) || [];
        sumber.aleta = daftar
          .map((x) => ({
            id: x.id,
            nama: String(x.namaPejabat || x.nama || ""),
            sah: x.disahkan === undefined ? x.sah !== false : x.disahkan === true || x.disahkan === 1,
            penggunaId: String(x.penggunaId || ""),
            sejak: String(x.disahkanPada || ""),
          }))
          .filter((x) => x.nama && x.sah);
      } else sumber.alasanAleta = r.status === 403 || r.status === 401 ? "akun Anda tidak berwenang membaca berkas tanda tangan ALETA" : (j && (j.alasan || j.sebab)) || `ALETA menjawab ${r.status}`;
    } catch (e) {
      sumber.alasanAleta = String((e && e.message) || e);
    }
    const s = await bacaPenyimpanan(K_TTD);
    if (s[K_TTD] && s[K_TTD].png) sumber.sendiri = s[K_TTD];
    S.ttdSumber = sumber;
    return sumber;
  }
  // Pencocokan nama penanda tangan ke baris tanda tangan SAH ALETA: sama dengan penetapanEdocService.cocokkanTandaTangan
  // (nama penuh bersih tanda baca dulu; bila tidak ada, nama tanpa gelar yang menunjuk satu orang saja).
  const bakuTtd = (n) => String(n || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const intiTtd = (n) => bakuTtd(String(n || "").split(",")[0].replace(/^\s*(?:(?:prof|dr|drs|dra|ir|h|hj|kh|kgs|tgk)\.?\s+)+/i, ""));
  function cocokkanBarisTtd(nama, daftar, akun) {
    const semua = (daftar || []).filter((b) => b && b.sah !== false && b.nama);
    // Tautan akun didahulukan (baris ditautkan ke akun pemiliknya), baru yang terbaru disahkan.
    const urut = (xs) => xs.slice().sort((a, b) => (b.penggunaId ? 1 : 0) - (a.penggunaId ? 1 : 0) || String(b.sejak || "").localeCompare(String(a.sejak || "")) || Number(b.id) - Number(a.id))[0];
    if (akun && akun.id && namaSama(akun.nama, nama)) {
      const sendiri = semua.filter((b) => b.penggunaId === String(akun.id));
      if (sendiri.length) return urut(sendiri);
    }
    const penuh = semua.filter((b) => bakuTtd(b.nama) && bakuTtd(b.nama) === bakuTtd(nama));
    if (penuh.length) return urut(penuh);
    const inti = intiTtd(nama);
    if (inti.length < 5) return null;
    const sebagian = semua.filter((b) => intiTtd(b.nama) === inti);
    if (!sebagian.length) return null;
    if (new Set(sebagian.map((b) => bakuTtd(b.nama))).size > 1) return null; // dua orang berbeda: tidak ditebak
    return urut(sebagian);
  }
  function gambarTtdUntuk(t) {
    const s = S.ttdSumber || {};
    const akun = api() && typeof api().siapa === "function" ? api().siapa() : null;
    const milikSendiri = akun && namaSama(akun.nama, t.nama);
    if (s.sendiri && (milikSendiri || adm()) && namaSama(s.sendiri.nama || (akun && akun.nama), t.nama)) return { sumber: "ekstensi", png: s.sendiri.png };
    const a = cocokkanBarisTtd(t.nama, s.aleta, akun);
    if (a && (milikSendiri || adm())) return { sumber: "aleta", id: a.id };
    return null;
  }
  /**
   * Penanda tangan yang punya tanda tangan SAH (dan boleh dipasang akun ini) OTOMATIS tercentang di menu "Tambah tanda tangan ke PDF",
   * kecuali pengguna sudah mengubah pilihan sendiri pada blangko ini (S.ttdManual). Yang tidak punya tidak tercentang.
   */
  async function autoCentangTtd() {
    if (S.ttdManual || !S.blangko || !S.pk) return;
    const blangko = S.blangko;
    try {
      await muatSumberTtd();
    } catch {
      return;
    }
    if (S.ttdManual || S.blangko !== blangko) return;
    const akun = api() && typeof api().siapa === "function" ? api().siapa() : null;
    for (const t of penandatangan()) {
      const bol = adm() || Boolean(akun && namaSama(akun.nama, t.nama));
      const g = gambarTtdUntuk(t);
      if (bol && g && g.sumber === "aleta") S.ttdPilih.add(t.id); // hanya yang SAH di ALETA; gambar simpanan ekstensi tetap dicentang tangan
    }
    renderCetak();
  }
  function isiPopTtd() {
    const l = penandatangan();
    const akun = api() && typeof api().siapa === "function" ? api().siapa() : null;
    const s = S.ttdSumber || { aleta: null, sendiri: null };
    return (
      `<b>Tambah tanda tangan ke PDF</b><p class="bd-catat">Tanda tangan dibubuhkan di atas nama penandatangan pada naskah. Anda hanya dapat memasang tanda tangan milik Anda sendiri${adm() ? " (admin: milik semua yang sudah tersimpan)" : ""}.</p>` +
      `<div class="bd-pt">${l
        .map((t) => {
          const g = gambarTtdUntuk(t);
          const milik = akun && namaSama(akun.nama, t.nama);
          const bol = adm() || milik;
          const aktif = Boolean(g) && bol;
          const ket = !bol ? "hanya dapat dipasang oleh yang bersangkutan" : g ? (g.sumber === "aleta" ? "tanda tangan tersimpan di ALETA (sudah disahkan)" : "tanda tangan tersimpan di ekstensi ini") : "belum ada gambar tanda tangan yang disahkan";
          return `<label class="${aktif ? "" : "mati"}"><input type="checkbox" data-ttd="${t.id}" ${S.ttdPilih.has(t.id) ? "checked" : ""} ${aktif ? "" : "disabled"}><span>${esc(t.jabatan)}<small>${esc(t.nama)} · ${esc(ket)}</small></span></label>`;
        })
        .join("")}</div>` +
      (s.aleta === null && s.alasanAleta ? `<p class="bd-catat">Berkas tanda tangan ALETA tidak terbaca: ${esc(s.alasanAleta)}.</p>` : "") +
      (akun && l.some((t) => namaSama(akun.nama, t.nama))
        ? `<div class="bd-baris"><label class="bd-btn kecil">Simpan tanda tangan saya (gambar PNG/JPG)<input type="file" id="bd-ttdfile" accept="image/png,image/jpeg" hidden></label>${s.sendiri ? `<button type="button" class="bd-btn kecil" data-bd2="hapusttd">Hapus tanda tangan saya dari ekstensi</button>` : ""}</div><p class="bd-catat">Gambar disimpan hanya di ekstensi pada komputer ini (bukan di ALETA/SIPP) dan dipakai untuk nama <b>${esc(akun.nama)}</b> saja.</p>`
        : akun
          ? `<p class="bd-catat">Akun ${esc(akun.nama)} bukan penandatangan dokumen ini.</p>`
          : "")
    );
  }
  async function simpanTtdSendiri(berkas) {
    const akun = api() && typeof api().siapa === "function" ? api().siapa() : null;
    if (!akun) return toast("Akun ALETA belum terbaca.");
    const png = await gambarKePng(berkas);
    await tulisPenyimpanan({ [K_TTD]: { nama: akun.nama, png, saat: Date.now() } });
    S.ttdSumber = null;
    await muatSumberTtd();
    toast("Tanda tangan Anda tersimpan di ekstensi ini.");
    renderCetak();
    const pop = cari("#bd-popttd", wadah.akar);
    if (pop && !pop.hidden) pop.innerHTML = isiPopTtd();
  }
  function gambarKePng(berkas) {
    return new Promise((selesai, gagal) => {
      const url = URL.createObjectURL(berkas);
      const img = new Image();
      img.onload = () => {
        try {
          const k = document.createElement("canvas");
          const lebar = Math.min(img.naturalWidth || img.width, 900);
          const skala = lebar / (img.naturalWidth || img.width || 1);
          k.width = lebar;
          k.height = Math.round((img.naturalHeight || img.height) * skala);
          k.getContext("2d").drawImage(img, 0, 0, k.width, k.height);
          selesai(k.toDataURL("image/png"));
        } catch (e) {
          gagal(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => gagal(new Error("gambar tidak terbaca"));
      img.src = url;
    });
  }
  function ukuranPng(bita) {
    const u = new Uint8Array(bita);
    if (u.length < 24 || u[0] !== 0x89 || u[1] !== 0x50) return null;
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  const hexDari = (bita) => Array.from(new Uint8Array(bita), (b) => b.toString(16).padStart(2, "0")).join("");
  // ──────────────────────────────────────────────────────────────────────────
  // TTD MENGAMBANG (20 Okt 2026): bentuk bergambar yang menimpa +-1/3 atas baris nama, ukuran SAMA dengan e-Doc penetapan
  // (penetapanEdocService.UKURAN_TTD_CAP + bubuhkanTtdCap di bot) dan salinan putusan. Nilai bawaan di bawah = cermin
  // UKURAN_TTD_CAP; yang berlaku diambil dari kartu "Ukuran tanda tangan & cap" portal (GET ukuran-ttd-cap).
  // ──────────────────────────────────────────────────────────────────────────
  const TWIP_PER_MM = 1440 / 25.4;
  const UKURAN_TTD_CAP_BAWAAN = Object.freeze({ lebarTtdMm: 64, tinggiTtdMaksMm: 35, ttdTurunMm: 3, lebarCapMm: 36, capGeserKiriMm: 13, capGeserAtasMm: 4, opasitasCap: 0.88 });
  const BATAS_UKURAN_TTD = Object.freeze({
    lebarTtdMm: [10, 90],
    tinggiTtdMaksMm: [8, 60],
    ttdTurunMm: [-30, 30],
    lebarCapMm: [10, 60],
    capGeserKiriMm: [-60, 60],
    capGeserAtasMm: [-60, 60],
    opasitasCap: [0.3, 1],
  });
  /** Ukuran yang berlaku: bawaan <- kiriman portal (disaring ke batas). */
  function ukuranTtdBerlaku(mentah) {
    const u = { ...UKURAN_TTD_CAP_BAWAAN };
    const m = mentah && typeof mentah === "object" ? mentah : {};
    for (const [k, [bawah, atas]] of Object.entries(BATAS_UKURAN_TTD)) {
      const n = Number(m[k]);
      if (m[k] !== undefined && m[k] !== null && m[k] !== "" && Number.isFinite(n)) u[k] = Math.min(atas, Math.max(bawah, n));
    }
    return u;
  }
  async function muatUkuranTtd() {
    let mentah = null;
    try {
      const r = typeof alatAmbil === "function" ? await alatAmbil(API_UKURAN_TTD, { credentials: "include", cache: "no-store" }, "Membaca ukuran tanda tangan") : await fetch(API_UKURAN_TTD, { credentials: "include", cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j) mentah = [j.ukuranBot, j.data && j.data.ukuranBot].find((x) => x && typeof x === "object") || null;
    } catch (_) {
      mentah = null; // portal tidak menjawab: ukuran bawaan, penandatanganan tetap jalan
    }
    return ukuranTtdBerlaku(mentah);
  }
  /** Penanda tangan yang berhak CAP (aturan yang ada): Panitera (salinan) dan Ketua (penetapan Ketua). Hakim, PP, juru sita: TIDAK. */
  const berhakCap = (t) => Boolean(t) && (t.peran === "panitera" || t.peran === "ketua_pa");
  /** Tata paragraf di `posisi` (cermin tataParagraf bot): rata, inden, lebar bidang tulis, baris pertama? */
  function tataParagrafRtf(s, posisi) {
    const terakhirDi = (re, sampai) => {
      const g = new RegExp(re.source, "g");
      const potongan = s.slice(0, sampai);
      let m;
      let hasil = null;
      while ((m = g.exec(potongan))) hasil = m;
      return hasil;
    };
    const pard = s.lastIndexOf("\\pard", posisi);
    const potong = pard >= 0 ? s.slice(pard, posisi) : s.slice(0, posisi);
    const ambil = (re) => {
      const g = new RegExp(re.source, "g");
      let m;
      let hasil = null;
      while ((m = g.exec(potong))) hasil = m;
      return hasil;
    };
    const rata = ambil(/\\q([lrcj])(?![a-z])/);
    const li = ambil(/\\li(-?\d+)(?![a-z\d])/);
    const fi = ambil(/\\fi(-?\d+)(?![a-z\d])/);
    const ri = ambil(/\\ri(-?\d+)(?![a-z\d])/);
    const kertasM = terakhirDi(/\\(?:paperw|pgwsxn)(\d+)/, posisi);
    const kiriM = terakhirDi(/\\(?:margl|marglsxn)(\d+)/, posisi);
    const kananM = terakhirDi(/\\(?:margr|margrsxn)(\d+)/, posisi);
    const kertas = kertasM ? Number(kertasM[1]) : 12240;
    const kiri = kiriM ? Number(kiriM[1]) : 1800;
    const kanan = kananM ? Number(kananM[1]) : 1800;
    const awalPar = Math.max(s.lastIndexOf("\\par", posisi), pard);
    const antara = awalPar >= 0 ? s.slice(awalPar, posisi) : "";
    return {
      rata: rata ? rata[1] : "l",
      li: li ? Number(li[1]) : 0,
      fi: fi ? Number(fi[1]) : 0,
      ri: ri ? Number(ri[1]) : 0,
      lebarBidang: Math.max(2000, kertas - kiri - kanan),
      barisPertama: !/\\line(?![a-z])/.test(antara.replace(/^\\pard?/, "")),
    };
  }
  /** Satu bentuk gambar mengambang tertambat pada paragraf, relatif kolom (cermin bentukGambar bot). */
  function bentukGambarRtf({ hex, w, h, kiri, atas, lebar, tinggi, z, depan, nama }) {
    const k = Math.round(kiri);
    const a = Math.round(atas);
    const l = Math.round(lebar);
    const t = Math.round(tinggi);
    return (
      `{\\shp{\\*\\shpinst\\shpleft${k}\\shptop${a}\\shpright${k + l}\\shpbottom${a + t}` +
      `\\shpfhdr0\\shpbxcolumn\\shpbxignore\\shpbypara\\shpbyignore\\shpwr3\\shpwrk0\\shpfblwtxt${depan ? 0 : 1}\\shpz${z}\\shplid${z}` +
      `{\\sp{\\sn shapeType}{\\sv 75}}{\\sp{\\sn fFlipH}{\\sv 0}}{\\sp{\\sn fFlipV}{\\sv 0}}{\\sp{\\sn fLockAspectRatio}{\\sv 1}}` +
      `{\\sp{\\sn fAllowOverlap}{\\sv 1}}{\\sp{\\sn fBehindDocument}{\\sv ${depan ? 0 : 1}}}{\\sp{\\sn fLayoutInCell}{\\sv 1}}` +
      `{\\sp{\\sn fLine}{\\sv 0}}{\\sp{\\sn fFilled}{\\sv 0}}{\\sp{\\sn wzName}{\\sv ${nama}}}` +
      `{\\sp{\\sn pib}{\\sv {\\pict\\pngblip\\picw${w}\\pich${h}\\picwgoal${l}\\pichgoal${t} ${hex}}}}}}`
    );
  }
  /** Paragraf kosong tepat di atas paragraf nama (di antara label jabatan dan nama). */
  function barisKosongSebelum(rtf, idx) {
    const bagian = rtf.slice(Math.max(0, idx - 3000), idx).split(/\\par(?![a-z])/);
    bagian.pop(); // awal paragraf nama sendiri
    let n = 0;
    for (let i = bagian.length - 1; i >= 0 && n < 8; i -= 1) {
      const teks = bagian[i].replace(/\\'[0-9a-fA-F]{2}/g, "x").replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/[{}\s]/g, "");
      if (teks) break;
      n += 1;
    }
    return n;
  }
  const MM_PER_BARIS_KOSONG = 5; // cermin salinanPutusanService
  /**
   * Menyisipkan tanda tangan (PNG) sebagai bentuk MENGAMBANG yang menimpa +-1/3 atas baris nama penandatangan, ber-cap bila `d.cap`
   * ({ png, ukuran?, hex? }) diberikan: cap berdiameter tetap (lebarCapMm) di sisi kiri tanda tangan, di atasnya. Cap HANYA untuk
   * penanda tangan yang berhak (berhakCap) - pemanggil yang menentukan; hakim/PP/juru sita tidak membawa cap.
   * Pulang { rtf, dipasang:[nama], tidakDitemukan:[nama], geometri:[{nama, ttd, cap}] }.
   *
   * Nama hakim/PP juga tertulis LEBIH DULU di paragraf "Demikian ... oleh <nama> ..." (dan di kepala BAS); blok tanda tangan
   * selalu di ujung naskah. Jadi yang dipakai kemunculan TERAKHIR sebelum kotak "Untuk Salinan" dan sebelum penanda asal
   * tersembunyi {\*\isianasal ...} (paket I3; sebelumnya {\*\aletaasal ...}, keduanya dikenali) - bukan kemunculan pertama, yang memecah paragraf "Demikian".
   * Ruang di atas nama ditambah (paragraf kosong) bila baris kosong blangko kurang dari tinggi tanda tangan, supaya label jabatan tidak tertutup.
   */
  function sisipkanTtdRtf(rtfLatin1, daftar, ukuranMentah) {
    let rtf = String(rtfLatin1);
    const u = ukuranTtdBerlaku(ukuranMentah);
    const mm = (n) => Number(n) * TWIP_PER_MM;
    const dipasang = [];
    const tidakDitemukan = [];
    const geometri = [];
    const cariTerakhir = (teks, kecil) => {
      const sumber = kecil ? rtf.toLowerCase() : rtf;
      const t = kecil ? teks.toLowerCase() : teks;
      // 18 Okt: blangko kini memakai penanda asal "{\*\isianasal" (tanpa nama ALETA); penanda lama "{\*\aletaasal" (blangko terpasang sebelum paket
      // ganti-nama) tetap dikenali. Keduanya hanya DIBACA di sini - tidak ada kode yang menuliskannya ke RTF.
      const pagar = [rtf.lastIndexOf("Untuk Salinan"), rtf.lastIndexOf("{\\*\\isianasal"), rtf.lastIndexOf("{\\*\\aletaasal")].filter((x) => x > 0);
      const batas = pagar.length ? Math.min(...pagar) : rtf.length;
      const i = sumber.lastIndexOf(t, batas);
      return i >= 0 ? i : sumber.lastIndexOf(t);
    };
    let urut = 0;
    for (const d of daftar) {
      const ukuran = d.ukuran || ukuranPng(d.png);
      if (!ukuran) {
        tidakDitemukan.push(d.nama);
        continue;
      }
      const calon = [d.nama, d.nama.toUpperCase(), d.nama.replace(/\s*\(Ketua\)/i, "")].filter(Boolean);
      let idx = -1;
      for (const c of calon) {
        idx = cariTerakhir(c, false);
        if (idx < 0) idx = cariTerakhir(c, true);
        if (idx >= 0) break;
      }
      if (idx < 0) {
        const inti = namaInti(d.nama).split(" ").filter((k) => k.length > 3).slice(0, 2).join(" ");
        if (inti) idx = cariTerakhir(inti, true);
      }
      if (idx < 0) {
        tidakDitemukan.push(d.nama);
        continue;
      }
      // Ukuran tanda tangan: lebar dari pengaturan, tinggi menurut perbandingan gambarnya, dibatasi tinggi maksimum.
      let ttdL = mm(u.lebarTtdMm);
      let ttdT = (ttdL * ukuran.h) / ukuran.w;
      if (ttdT > mm(u.tinggiTtdMaksMm)) {
        ttdL = (ttdL * mm(u.tinggiTtdMaksMm)) / ttdT;
        ttdT = mm(u.tinggiTtdMaksMm);
      }
      // Ruang kosong di atas nama (mm) vs yang dibutuhkan: tinggi tanda tangan - turun.
      const perluMm = ttdT / TWIP_PER_MM - u.ttdTurunMm - barisKosongSebelum(rtf, idx) * MM_PER_BARIS_KOSONG * 1.2;
      const tambah = perluMm > 0 ? Math.min(8, Math.ceil(perluMm / MM_PER_BARIS_KOSONG)) : 0;
      const jeda = tambah ? "\\par ".repeat(tambah) : "";
      if (jeda) rtf = `${rtf.slice(0, idx)}${jeda}${rtf.slice(idx)}`;
      const letak = idx + jeda.length;
      const tata = tataParagrafRtf(rtf, letak);
      const x0 = tata.li + (tata.barisPertama ? tata.fi : 0);
      let ttdKiri;
      if (tata.rata === "c") ttdKiri = tata.li + (tata.lebarBidang - tata.li - tata.ri - ttdL) / 2;
      else if (tata.rata === "r") ttdKiri = tata.lebarBidang - tata.ri - ttdL;
      else ttdKiri = x0;
      ttdKiri = Math.max(0, Math.min(ttdKiri, tata.lebarBidang - tata.ri - ttdL));
      const ttdAtas = -ttdT + mm(u.ttdTurunMm);
      const g = { nama: d.nama, ttd: { kiri: Math.round(ttdKiri), atas: Math.round(ttdAtas), lebar: Math.round(ttdL), tinggi: Math.round(ttdT) }, cap: null, barisTambah: tambah };
      let sisipan = bentukGambarRtf({ hex: d.hex || hexDari(d.png), w: ukuran.w, h: ukuran.h, kiri: ttdKiri, atas: ttdAtas, lebar: ttdL, tinggi: ttdT, z: 2001 + urut * 2, depan: true, nama: "Tanda tangan" });
      const capUkuran = d.cap ? d.cap.ukuran || ukuranPng(d.cap.png) : null;
      if (d.cap && capUkuran) {
        // Diameter cap TETAP: gambar muat ke kotak persegi lebarCapMm x lebarCapMm dengan perbandingan aslinya, dipusatkan.
        const kotak = mm(u.lebarCapMm);
        let capL = kotak;
        let capT = kotak;
        if (capUkuran.w >= capUkuran.h) capT = (kotak * capUkuran.h) / capUkuran.w;
        else capL = (kotak * capUkuran.w) / capUkuran.h;
        let pusatX = ttdKiri + ttdL / 2 - mm(u.capGeserKiriMm);
        const pusatY = ttdAtas + ttdT / 2 - mm(u.capGeserAtasMm);
        pusatX = Math.max(kotak / 2, Math.min(pusatX, tata.lebarBidang - tata.ri - kotak / 2));
        sisipan += bentukGambarRtf({ hex: d.cap.hex || hexDari(d.cap.png), w: capUkuran.w, h: capUkuran.h, kiri: pusatX - capL / 2, atas: pusatY - capT / 2, lebar: capL, tinggi: capT, z: 2002 + urut * 2, depan: true, nama: "Cap" });
        g.cap = { kiri: Math.round(pusatX - capL / 2), atas: Math.round(pusatY - capT / 2), lebar: Math.round(capL), tinggi: Math.round(capT) };
      }
      rtf = `${rtf.slice(0, letak)}${sisipan}${rtf.slice(letak)}`;
      dipasang.push(d.nama);
      geometri.push(g);
      urut += 1;
    }
    return { rtf, dipasang, tidakDitemukan, geometri };
  }
  async function bitaTtd(g) {
    if (g.sumber === "ekstensi") {
      const r = await fetch(g.png);
      return r.arrayBuffer();
    }
    const r = typeof alatAmbil === "function" ? await alatAmbil(`${API_TTD}/${g.id}/gambar`, { credentials: "include", cache: "no-store" }, "Mengambil gambar tanda tangan") : await fetch(`${API_TTD}/${g.id}/gambar`, { credentials: "include", cache: "no-store" });
    if (!r.ok) throw new Error(`gambar tanda tangan tidak terbaca (${r.status})`);
    const blob = await r.blob();
    if (/png/i.test(blob.type)) return blob.arrayBuffer();
    const png = await gambarKePng(blob);
    return (await fetch(png)).arrayBuffer();
  }
  async function rtfDenganTtd(rtf) {
    const pilih = penandatangan().filter((t) => S.ttdPilih.has(t.id));
    if (!pilih.length) return { rtf: latin1(rtf), dipasang: [], tidakDitemukan: [], gagal: [] };
    const daftar = [];
    const gagal = [];
    for (const t of pilih) {
      const g = gambarTtdUntuk(t);
      if (!g) {
        gagal.push(t.nama);
        continue;
      }
      try {
        daftar.push({ nama: t.nama, png: await bitaTtd(g) });
      } catch (e) {
        gagal.push(`${t.nama} (${String((e && e.message) || e)})`);
      }
    }
    const h = sisipkanTtdRtf(latin1(rtf), daftar, await muatUkuranTtd());
    return { ...h, gagal };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cetak: pilihan langsung (tanpa dropdown), pengingat, penanda, hasil
  // ──────────────────────────────────────────────────────────────────────────
  function daftarFmt() {
    const j = S.blangko ? S.blangko.jenis : "";
    const o = [];
    if (S.fmt.rtf) o.push("RTF");
    if (S.fmt.pdf) o.push(`PDF${S.ttdPilih.size ? ` (${S.ttdPilih.size} tanda tangan)` : ""}`);
    if (S.fmt.salinan) o.push("PDF SALINAN");
    if (S.fmt.anon && j === "put") o.push("PDF anonim");
    if (S.fmt.edoc && j === "put" && !tes()) o.push("unggah ke e-Doc SIPP");
    return o;
  }
  /** Baris "Unggah putusan sendiri" di langkah Cetak (tidak tampil pada Tes putusan). */
  function htmlUnggahanPutusan() {
    if (tes()) return "";
    const u = unggahanBerlaku();
    const mati = S.sibuk || S.unggahSibuk ? " disabled" : "";
    const jenisBerkas = ".rtf,.docx,.doc,application/rtf,text/rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (S.unggahSibuk) return `<div class="bd-utas bd-unggah" role="status"><span class="bd-catat">Membaca berkas unggahan…</span></div>`;
    if (!u) {
      return (
        `<div class="bd-utas bd-unggah" role="group" aria-label="Putusan dari berkas sendiri">` +
        `<label class="bd-btn kecil${mati ? " mati" : ""}">Unggah putusan sendiri (RTF/DOCX/DOC)<input type="file" id="bd-unggahputusan" accept="${jenisBerkas}" hidden${mati}></label>` +
        `<span class="bd-catat">Putusan yang sudah Anda sunting sendiri: semua pilihan cetak di atas dibuat dari berkas itu, bukan dari naskah ABT.</span></div>`
      );
    }
    return (
      `<div class="bd-utas bd-unggah aktif" role="group" aria-label="Putusan dari berkas sendiri">` +
      `<span class="bd-sumberunggah">Sumber cetak: berkas unggahan <b>${esc(u.nama)}</b></span>` +
      `<label class="bd-btn kecil${mati ? " mati" : ""}">Ganti berkas<input type="file" id="bd-unggahputusan" accept="${jenisBerkas}" hidden${mati}></label>` +
      `<button type="button" class="bd-btn kecil" data-bd2="hapusunggah"${mati}>Hapus berkas</button>` +
      u.catatan.map((c) => `<span class="bd-catat bd-unggahcatat">${esc(c)}</span>`).join("") +
      `</div>`
    );
  }
  function renderCetak() {
    const w = wadah.cetak;
    if (!w) return;
    if (!S.blangko) {
      w.innerHTML = `<p class="bd-catat">Pilihan cetak tampil sesudah blangko dipilih.</p>`;
      return;
    }
    if (S.blangko.khusus) {
      w.innerHTML = `<p class="bd-catat">Tombol cetak ada di layar kerja pada langkah isian.</p>`;
      return;
    }
    const j = S.blangko.jenis;
    const dok = daftarFmt();
    const sudah = S.cetakTercatat[`${nomorPerkara()}|${j}`];
    const matiTes = (k) => tes() && k === "edoc";
    const pil = (k, label, ket) => `<label class="bd-pilc${k === "edoc" || k === "anon" ? (j === "put" && !matiTes(k) ? "" : " mati") : ""}"><input type="checkbox" data-fmt="${k}" ${S.fmt[k] && !matiTes(k) ? "checked" : ""} ${((k === "edoc" || k === "anon") && j !== "put") || matiTes(k) ? "disabled" : ""}> ${label}${ket ? `<small>${esc(ket)}</small>` : ""}</label>`;
    w.innerHTML =
      pitaTes() +
      `<div class="bd-utas" role="group" aria-label="Pilihan cetak">${pil("rtf", "RTF")}${pil("pdf", "PDF")}${pil("salinan", "PDF SALINAN")}` +
      `<button type="button" class="bd-btn kecil" id="bd-btnttd" data-bd2="popttd" aria-expanded="false" aria-controls="bd-popttd">Tambah tanda tangan${S.ttdPilih.size ? ` (${S.ttdPilih.size})` : ""} ▾</button>` +
      `${pil("anon", "PDF anonim", j === "put" ? "" : "hanya putusan")}${pil("edoc", "Unggah ke e-Doc SIPP", tes() ? "mati pada Tes putusan" : j === "put" ? "" : "hanya putusan; BAS dan relaas diunggah lewat SIPP")}</div>` +
      htmlUnggahanPutusan() +
      `<div id="bd-saksikosong"></div>` +
      `<div class="bd-ingat" id="bd-ingat" hidden role="alert"></div>` +
      `<div class="bd-utas"><button type="button" class="bd-btn utama besar" data-bd2="cetak" ${S.sibuk || S.unggahSibuk ? "disabled" : ""}>${S.sibuk ? "Sedang mencetak…" : "Cetak"}</button><span class="bd-catat" id="bd-statuscetak">${dok.length ? `Akan menerbitkan: ${esc(dok.join(", "))}. ` : "Pilih minimal satu hasil cetak. "}${tes() ? "" : sudah ? `Sudah dicetak ${esc(sudah)}.` : "Belum dicetak."}</span> <span class="bd-catat" id="bd-siapnaskah">${esc(ketSiapNaskah())}</span></div>` +
      `<ul class="bd-logcetak" id="bd-logcetak" ${S.log.length ? "" : "hidden"}>${S.log.slice(-6).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` +
      `<div class="bd-float lebar" id="bd-popttd" hidden role="dialog" aria-label="Tambah tanda tangan"></div>`;
    perbaruiSaksiKosong();
  }
  // ──────────────────────────────────────────────────────────────────────────
  // 30 Okt 2026 (keputusan pengguna 1c): berita acara dan putusan Blangko Derry membaca keterangan saksi HANYA dari tanya
  // jawab saksi (bentuk seragam). Saksi yang tanya jawabnya belum ada tercetak kosong - panel memperingatkan sebelum
  // cetak/pratinjau (menyebut saksinya, dengan tombol ke penyunting tanya jawab yang memuat "Set pertanyaan"), TANPA
  // menahan cetak.
  // ──────────────────────────────────────────────────────────────────────────
  /** Saksi (bukan jawaban/replik lisan) yang tanya jawabnya diketahui KOSONG untuk blangko dan sidang yang terbuka. */
  function saksiTanpaTanyaJawab() {
    if (!S.blangko || !S.susunan || S.blangko.khusus) return [];
    const hasil = [];
    for (const it of daftarPerlu()) {
      if (it.jenis !== "tj" || !it.tj || !/^saksi\b/i.test(String(it.tj.sebutan || ""))) continue;
      const t = S.tj[it.tj.kunci];
      const kodeNilai = [it.kode, it.tj.kodeSunting].filter(Boolean);
      // Sama dengan hitungan "terisi" layar (nilaiTerisi): baris di layar ATAU nilai ABT/bot untuk penanda/penyuntingnya.
      const terisi = Boolean(t && t.dimuat && barisTjBerisi(t.rows)) || kodeNilai.some((k) => S.nilai[k] && S.nilai[k].status === "terisi");
      const diketahui = Boolean(t && t.dimuat && !t.memuat) || kodeNilai.some((k) => S.nilai[k] && S.nilai[k].status === "kosong");
      const kosong = !terisi && diketahui;
      if (kosong && !hasil.some((x) => x.kunci === it.tj.kunci)) hasil.push({ kunci: it.tj.kunci, sebutan: String(it.tj.sebutan) });
    }
    return hasil;
  }
  const daftarSebutan = (l) => (l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} dan ${l[l.length - 1]}`);
  function perbaruiSaksiKosong() {
    const e = wadah.cetak ? cari("#bd-saksikosong", wadah.cetak) : null;
    if (!e) return;
    const l = saksiTanpaTanyaJawab();
    if (!l.length) {
      e.innerHTML = "";
      return;
    }
    const baca = deretTj().hanyaBaca;
    const dok = S.blangko && S.blangko.jenis === "put" ? "Putusan" : "Berita acara";
    e.innerHTML =
      `<div class="bd-peringatan bd-saksikosong" role="status">` +
      `<b>Keterangan saksi belum diisi:</b> ${daftarSebutan(l.map((x) => `<b>${esc(x.sebutan)}</b>`))} belum punya tanya jawab saksi${baca ? "" : ` pada sidang ke-${esc(sidangUrutan())}`}. ` +
      `${dok} tetap dapat dicetak, tetapi keterangan saksi tersebut tercetak kosong.` +
      (baca ? " Tanya jawab saksi diisi panitera pengganti pada berita acara sidang pemeriksaan saksi. " : " ") +
      `<button type="button" class="bd-btn kecil" data-bd2="isisaksi" data-kunci="${esc(l[0].kunci)}">${baca ? "Lihat tanya jawab saksi" : "Isi tanya jawab saksi"}</button></div>`;
  }
  function catatLog(teks) {
    S.log.push(`${jamSekarang()}: ${teks}`);
    const l = cari("#bd-logcetak", wadah.cetak);
    if (l) {
      l.hidden = false;
      l.innerHTML = S.log.slice(-6).map((x) => `<li>${esc(x)}</li>`).join("");
    }
    const st = cari("#bd-statuscetak", wadah.cetak);
    if (st) st.textContent = teks;
  }
  /**
   * Pengingat cetak. Kotak yang masih kosong diberi tanda kuning + getar singkat (bingkai kuning per kotak HANYA
   * di sini), lalu daftar dikelompokkan menurut tingkatnya:
   *   Penting - isian yang tertulis langsung di naskah atau dibaca amar/pertimbangan/duduk perkara, bukti, saksi;
   *   Tidak wajib - isian berbawaan ("kosong = ...", "bila SIPP tidak memuat") atau keterangan tambahan.
   * kos: [{ b, nama, tingkat }] dari kosongRinci(); hs: penanda naskah yang belum terbaca.
   */
  function tampilIngat(kos, hs) {
    const e = cari("#bd-ingat", wadah.cetak);
    if (!e) return;
    const penting = kos.filter((x) => x.tingkat !== "tambahan");
    const tambahan = kos.filter((x) => x.tingkat === "tambahan");
    S.tandaKosong = new Set(kos.filter((x) => x.b.khusus !== "bukti" && x.b.jenis !== "tj").map((x) => x.b.kode));
    for (const x of kos) {
      const f = cari(`.bd-f[data-f="${x.b.kode}"]`, wadah.isian);
      if (!f) continue;
      f.classList.add("bd-kosongcetak");
      f.classList.toggle("tambahan", x.tingkat === "tambahan");
      f.classList.remove("bd-getar");
      void f.offsetWidth; // getar diulang tiap Cetak
      f.classList.add("bd-getar");
    }
    const daftar = (l) => `<ul>${l.map((x) => `<li>${esc(x.nama)}</li>`).join("")}</ul>`;
    e.hidden = false;
    e.innerHTML =
      (penting.length ? `<h4>Penting - sebaiknya diisi sebelum cetak (${penting.length})</h4>${daftar(penting)}` : "") +
      (tambahan.length ? `<h4 class="tidakwajib">Tidak wajib (${tambahan.length})</h4><div class="tidakwajib">${daftar(tambahan)}</div>` : "") +
      (kos.length ? `<p class="bd-catat">Isian yang kosong tercetak titik-titik.</p>` : "") +
      (hs.length ? `<p><b>Ada ${hs.length} bagian naskah yang belum terisi otomatis${adm() ? `: ${esc(hs.join(", "))}` : ""}.</b> Bagian itu akan tercetak apa adanya.</p>` : "") +
      `<div class="bd-baris" style="margin-top:6px">${kos.length ? `<button type="button" class="bd-btn kecil utama" data-bd2="isidulu">Isi dulu</button>` : ""}${hs.length ? `<button type="button" class="bd-btn kecil" data-bd2="lihatbagian">Lihat di pratinjau</button>` : ""}<button type="button" class="bd-btn kecil" data-bd2="tetapcetak">Tetap cetak</button><span class="bd-catat">atau tekan Cetak sekali lagi.</span></div>`;
    e.scrollIntoView && e.scrollIntoView({ block: "center" });
  }
  const namaPenanda = (k) => {
    const d = S.susunan && (S.susunan.isian.find((x) => x.kode === k) || S.susunan.otomatis.find((x) => x.kode === k));
    return d ? `#${k}# ${d.nama}` : `#${k}#`;
  };
  // ──────────────────────────────────────────────────────────────────────────
  // Naskah disiapkan di latar (cetak cepat, 27 Okt 2026)
  // Begitu isian lengkap dan tenang (atau petugas menunjukkan niat mencetak), naskah dari ABT disusun lebih dulu; tombol Cetak lalu
  // memakainya tanpa menunggu ABT lagi. Dibatalkan sendiri bila isian berubah (sidik/versi isian tidak cocok), tidak pernah menulis
  // ke ABT (isian sidang BAS yang harus ditulis sementara tidak disiapkan di latar), dan tidak memunculkan pesan galat.
  // ──────────────────────────────────────────────────────────────────────────
  let jamSiap = null;
  let terakhirSiap = 0;
  let gagalSiapVersi = -1;
  function ketSiapNaskah() {
    if (tes() || !S.blangko || S.blangko.khusus || !S.prat) return "";
    if (unggahanBerlaku()) return "Memakai berkas unggahan - naskah ABT tidak diminta.";
    if (S.prat.janji) return "Naskah sedang disiapkan di latar…";
    if (naskahSegar(S.prat)) return "Naskah sudah siap - Cetak langsung jalan.";
    return "";
  }
  function perbaruiKetSiap() {
    const e = wadah.cetak ? cari("#bd-siapnaskah", wadah.cetak) : null;
    if (e) e.textContent = ketSiapNaskah();
  }
  function bolehSiapNaskah(sebab) {
    if (cfg().siapNaskah === false || tes() || unggahanBerlaku() || S.unggahSibuk) return false;
    const b = S.blangko;
    if (!b || !S.pk || b.khusus || b.hak !== "ok" || !S.susunan || S.memuatSusunan || S.sibuk) return false;
    const pr = S.prat;
    if (pr.memuat || pr.janji || naskahSegar(pr)) return false;
    // Masih ada ketikan/penyimpanan yang berjalan: naskah yang disusun sekarang pasti basi.
    if (S.diketik.size || Object.values(S.tersimpan).some((v) => v === "dicoba")) return false;
    if (sebab === "niat") return Date.now() - terakhirSiap >= 10000;
    if (gagalSiapVersi === S.versiIsian || Date.now() - terakhirSiap < JEDA_ULANG_SIAP_MS) return false;
    return !kosongRinci().some((x) => x.tingkat !== "tambahan");
  }
  /** BAS: isian sidang ini harus ditulis SEMENTARA ke ABT sebelum naskah diambil (terapkanIsianSidang) - itu hanya dikerjakan saat Cetak. */
  async function adaIsianSidangTertunda() {
    try {
      const peta = await bacaIsianSidangSekarang();
      if (!peta || !peta.size || !bolehTulis()) return false;
      for (const [kode, nilai] of peta) {
        if (!kodeIsianSidang(kode)) continue;
        if (String(S.isi[kode] == null ? "" : S.isi[kode]) !== nilai) return true;
      }
    } catch {
      /* dianggap tidak ada */
    }
    return false;
  }
  async function siapkanNaskah(sebab) {
    let versi = -1;
    try {
      if (!bolehSiapNaskah(sebab) || (await adaIsianSidangTertunda()) || !bolehSiapNaskah(sebab)) return;
      terakhirSiap = Date.now();
      versi = S.versiIsian;
      const janji = ambilRtf(false);
      perbaruiKetSiap();
      await janji;
    } catch {
      gagalSiapVersi = versi; // diam: Cetak/Pratinjau akan mencoba sendiri dan menampilkan sebabnya
    }
    perbaruiKetSiap();
    if (versi >= 0 && S.versiIsian !== versi) jadwalkanSiapNaskah("isian"); // isian berubah selama disusun
  }
  function jadwalkanSiapNaskah(sebab) {
    if (jamSiap) clearTimeout(jamSiap);
    jamSiap = setTimeout(
      () => {
        jamSiap = null;
        void siapkanNaskah(sebab);
      },
      sebab === "niat" ? 150 : JEDA_SIAP_MS
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Putusan yang disunting sendiri (28 Okt 2026): berkas RTF / DOCX / DOC diunggah, lalu SEMUA pilihan cetak (RTF, PDF, PDF SALINAN,
  // tambah tanda tangan, PDF anonim, e-Doc SIPP) dibuat dari berkas itu lewat jalur yang sama dengan naskah ABT. DOCX/DOC diubah ke RTF
  // sekali saat diunggah (soffice di server, rute konversi-naskah): penanda SALINAN, "ttd", dan blok "Untuk Salinan" disusun bot pada RTF.
  // ──────────────────────────────────────────────────────────────────────────
  /** Bentuk berkas dikenali dari KEPALA-nya (bukan dari nama): rtf | docx | doc | pdf | "". */
  function kenaliBentukBerkas(u8) {
    if (!u8 || u8.length < 5) return "";
    const awal = String.fromCharCode(u8[0], u8[1], u8[2], u8[3], u8[4]);
    if (awal === "%PDF-") return "pdf";
    if (awal === "{\\rtf") return "rtf";
    if (u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04) return "docx";
    if (u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) return "doc";
    return "";
  }
  /** Berkas unggahan yang masih berlaku untuk perkara yang sedang dibuka (berganti perkara = dilepas). */
  function unggahanBerlaku() {
    const u = S.unggahan;
    if (!u) return null;
    if (u.untuk !== nomorPerkara()) {
      S.unggahan = null;
      return null;
    }
    return u;
  }
  async function terimaUnggahan(berkas) {
    if (!berkas) return;
    if (tes()) return toast(PESAN_TES);
    if (!S.blangko || !S.pk) return toast("Pilih perkara dan blangko dulu.");
    if (S.sibuk || S.unggahSibuk) return;
    if (berkas.size > BATAS_UNGGAH_PUTUSAN) return toast(`Berkas "${berkas.name}" lebih dari ${BATAS_UNGGAH_PUTUSAN / 1024 / 1024} MB; tidak dapat dipakai.`);
    S.unggahSibuk = true;
    renderCetak();
    try {
      const asli = new Uint8Array(await berkas.arrayBuffer());
      const bentuk = kenaliBentukBerkas(asli);
      if (bentuk === "pdf") throw new Error("PDF tidak dapat dipakai sebagai sumber; unggah putusan dalam bentuk RTF, DOCX, atau DOC.");
      if (!bentuk) throw new Error("Isi berkas bukan RTF, DOCX, maupun DOC.");
      const catatan = [];
      let rtf = asli.buffer.slice(asli.byteOffset, asli.byteOffset + asli.byteLength);
      if (bentuk !== "rtf") {
        catatLog(`mengubah berkas ${bentuk.toUpperCase()} ke RTF…`);
        const badan = new FormData();
        badan.append("berkas", new Blob([asli], { type: "application/octet-stream" }), berkas.name);
        badan.append("ke", "rtf");
        const d = await ambilPortal(API_KONVERSI_NASKAH, { method: "POST", body: badan, batasMs: BATAS_LAMA_MS }, "Mengubah berkas ke RTF");
        if (!d || !d.berkasBase64) throw new Error("server tidak mengembalikan hasil ubahan");
        rtf = Uint8Array.from(atob(d.berkasBase64), (c) => c.charCodeAt(0)).buffer;
        if (kenaliBentukBerkas(new Uint8Array(rtf)) !== "rtf") throw new Error("hasil ubahan bukan RTF");
        catatan.push(`Berkas ${bentuk.toUpperCase()} diubah ke RTF di server agar tulisan SALINAN dan ttd dapat dipasang; periksa PDF hasilnya.`);
        for (const p of Array.isArray(d.peringatan) ? d.peringatan : []) catatan.push(String(p));
      }
      S.unggahan = { untuk: nomorPerkara(), nama: berkas.name, bentukAsal: bentuk, rtf, catatan };
      catatLog(`berkas unggahan "${berkas.name}" dipakai sebagai sumber cetak`);
      toast(`Sumber cetak: berkas unggahan "${berkas.name}".`);
    } catch (e) {
      S.unggahan = null;
      toast(`Berkas "${berkas.name}" tidak dapat dipakai: ${String((e && e.message) || e)}`);
    }
    S.unggahSibuk = false;
    renderCetak();
  }
  function lepasUnggahan() {
    S.unggahan = null;
    renderCetak();
    toast("Berkas unggahan dilepas; Cetak kembali memakai naskah dari ABT.");
  }
  /** Cetak dari berkas unggahan: melewati ABT sama sekali (naskah, isian, pengingat isian kosong); deteksi sisa blangko tetap berjalan di lakukanCetak. */
  async function cetakUnggahan() {
    const u = unggahanBerlaku();
    if (!u) return;
    S.sibuk = true;
    renderCetak();
    try {
      catatLog(`memakai berkas unggahan "${u.nama}" (naskah ABT tidak diminta)`);
      await lakukanCetak(u.rtf.slice(0));
    } catch (e) {
      catatLog(`gagal: ${String((e && e.message) || e)}`);
      toast(`Cetak gagal: ${String((e && e.message) || e)}`);
    }
    S.sibuk = false;
    S.peringat = false;
    renderCetak();
    laporKeKerangka();
  }

  async function cetak(paksa) {
    if (!S.blangko || !S.pk || S.sibuk) return;
    if (!daftarFmt().length) return toast("Pilih minimal satu hasil cetak.");
    if (S.blangko.hak === "ditolak") return toast("ABT tidak mengizinkan blangko ini untuk perkara ini; tidak dapat dicetak.");
    if (S.unggahSibuk) return toast("Berkas unggahan sedang dibaca; tunggu sebentar.");
    if (unggahanBerlaku()) {
      if (S.blangko.hak !== "ok") return toast("Hak buka blangko ini masih diperiksa ke ABT; tunggu sebentar.");
      return void cetakUnggahan();
    }
    if (!S.susunan && !S.galatSusunan) return toast("Isian blangko masih dibaca; tunggu sebentar.");
    S.sibuk = true;
    renderCetak();
    try {
      catatLog(naskahSegar(S.prat) ? "naskah sudah siap - dipakai ulang, ABT tidak diminta lagi" : S.prat.janji ? "menunggu naskah yang sedang disiapkan di latar…" : "meminta naskah dari ABT…");
      try {
        // Daftar "biasanya terisi" dihangatkan sambil ABT menyusun naskah (hasilnya disinggahkan jejak-isian.js).
        const j = JI();
        if (cfg().ingat !== false && j && typeof j.bacaWajib === "function") void j.bacaWajib(S.blangko.berkas);
      } catch {
        /* pemanasan saja */
      }
      // D6: BAS sidang tertentu -> isian sidang itu dipakai SEMENTARA di ABT hanya selama naskah diambil dan daftar kosong dihitung.
      const pulih = await terapkanIsianSidang();
      let rtf;
      let kos = [];
      try {
        rtf = await ambilRtf(Boolean(pulih));
        kos = cfg().ingat !== false ? kosongRinci() : [];
        if (cfg().ingat !== false) kos = await tambahWajibBiasanya(kos);
      } finally {
        if (pulih) await pulih();
      }
      const hs = S.prat.penanda.map(namaPenanda);
      // 30 Okt (keputusan 1c): tanya jawab SAKSI yang kosong tidak menahan cetak - sudah diperingatkan di atas tombol Cetak
      // (bd-saksikosong) dan dicatat sesudah cetak.
      const saksiKosong = saksiTanpaTanyaJawab();
      const kunciSaksiKosong = new Set(saksiKosong.map((x) => x.kunci));
      kos = kos.filter((x) => !(x.b && x.b.jenis === "tj" && x.b.tj && kunciSaksiKosong.has(x.b.tj.kunci)));
      // Keputusan 17 Okt (F1.5): hanya isian Penting dan penanda # tersisa yang menahan cetak; isian Tidak wajib
      // yang kosong tidak - cetak langsung jalan dengan catatan kecil. Bila ada yang menahan, daftar Tidak wajib tetap ikut tampil.
      const penting = kos.filter((x) => x.tingkat !== "tambahan");
      if ((penting.length || hs.length) && !S.peringat && !paksa) {
        S.peringat = true;
        S.sibuk = false;
        renderCetak();
        tampilIngat(kos, hs);
        return;
      }
      const tidakWajib = !S.peringat && !paksa ? kos.length - penting.length : 0;
      await lakukanCetak(rtf);
      if (tidakWajib) catatLog(`catatan: ${tidakWajib} isian tidak wajib masih kosong (tercetak titik-titik)`);
      if (saksiKosong.length) catatLog(`catatan: keterangan ${daftarSebutan(saksiKosong.map((x) => x.sebutan))} belum diisi pada tanya jawab saksi (tercetak kosong)`);
    } catch (e) {
      catatLog(`gagal: ${String((e && e.message) || e)}`);
      toast(`Cetak gagal: ${String((e && e.message) || e)}`);
    }
    S.sibuk = false;
    S.peringat = false;
    renderCetak();
    laporKeKerangka();
  }
  // PDF tanpa tanda tangan salinan yang SAMA (isi RTF + daftar tanda tangan yang sama) dipakai ulang beberapa menit: mencetak ulang atau
  // menambah pilihan tidak menjalankan LibreOffice lagi. PDF SALINAN tidak disinggahkan (bergantung tanda tangan Panitera di server).
  const cachePdf = [];
  const UMUR_CACHE_PDF_MS = 10 * 60 * 1000;
  async function pdfDari(rtfLatin1, salinan, ttd) {
    const adaTtd = Array.isArray(ttd) && ttd.length > 0;
    const kunciTtd = adaTtd ? ttd.map((x) => `${x.nama}\u0001${sidikTeks(x.pngBase64)}`).join("\u0002") : "";
    if (!salinan) {
      const ada = cachePdf.find((e) => Date.now() - e.saat < UMUR_CACHE_PDF_MS && e.ttd === kunciTtd && e.rtf === rtfLatin1);
      if (ada) return { blob: new Blob([ada.bita], { type: "application/pdf" }), bita: ada.bita, keterangan: null, ttdPdf: ada.ttdPdf, dariCache: true };
    }
    const buf = bufDariLatin1(rtfLatin1);
    const badan = { rtfBase64: base64DariBuffer(buf), ...(salinan ? { salinan: true } : {}), ...(adaTtd ? { ttd: ttd.map((x) => ({ nama: x.nama, pngBase64: x.pngBase64 })) } : {}) };
    const d = await ambilPortal(API_PDF, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan), batasMs: BATAS_LAMA_MS }, salinan ? "Membuat PDF salinan" : "Membuat PDF");
    if (!d || !d.available) throw new Error((d && d.message) || "pengubah PDF tidak tersedia");
    const biner = Uint8Array.from(atob(d.pdfBase64), (c) => c.charCodeAt(0));
    const hasil = { blob: new Blob([biner], { type: "application/pdf" }), bita: biner, keterangan: d.salinan || null, ttdPdf: d.ttdPdf || null };
    if (!salinan) {
      cachePdf.unshift({ rtf: rtfLatin1, ttd: kunciTtd, bita: biner, ttdPdf: hasil.ttdPdf, saat: Date.now() });
      cachePdf.length = Math.min(cachePdf.length, 3);
    }
    return hasil;
  }
  /** Gambar tanda tangan yang dipilih, siap dikirim ke portal untuk dibubuhkan di PDF (posisi dihitung dari koordinat nama di PDF). */
  async function siapkanTtdPdf() {
    const pilih = penandatangan().filter((t) => S.ttdPilih.has(t.id));
    const gagal = [];
    const daftar = [];
    const hasil = await Promise.all(
      pilih.map(async (t) => {
        const g = gambarTtdUntuk(t);
        if (!g) return { gagal: t.nama };
        try {
          return { nama: t.nama, pngBase64: base64DariBuffer(await bitaTtd(g)) };
        } catch (e) {
          return { gagal: `${t.nama} (${String((e && e.message) || e)})` };
        }
      })
    );
    for (const h of hasil) {
      if (h.gagal) gagal.push(h.gagal);
      else daftar.push(h);
    }
    return { daftar, gagal };
  }
  /**
   * PDF biasa (bukan salinan) dengan tanda tangan yang dipilih: gambar dibubuhkan PORTAL di atas nama pemiliknya, posisinya dihitung dari
   * koordinat baris nama di PDF. Portal lama yang belum mengenalnya (jawaban tanpa ttdPdf) dilayani cara lama: gambar disisipkan di RTF.
   */
  async function pdfBiasaDenganTtd(rtfBuf) {
    const ttd = await siapkanTtdPdf();
    let h = await pdfDari(latin1(rtfBuf), false, ttd.daftar);
    let t = { dipasang: [], tidakDitemukan: [], gagal: ttd.gagal };
    if (ttd.daftar.length) {
      if (h.ttdPdf) t = { dipasang: h.ttdPdf.dipasang || [], tidakDitemukan: h.ttdPdf.tidakDitemukan || [], gagal: ttd.gagal };
      else {
        t = await rtfDenganTtd(rtfBuf);
        h = await pdfDari(t.rtf, false);
      }
    }
    return { h, t };
  }
  function tampilStatus(teks) {
    const st = wadah.cetak ? cari("#bd-statuscetak", wadah.cetak) : null;
    if (st) st.textContent = teks;
  }
  async function lakukanCetak(rtfBuf) {
    const nomor = nomorPerkara();
    const berkas = S.blangko.berkas;
    const j = S.blangko.jenis;
    // Deteksi sisa blangko (17 Okt 2026): naskah diperiksa SEKALI untuk semua keluaran (RTF, PDF,
    // e-Doc). Bila masih ada sisa blangko/perbaikan, petugas diperingatkan - tetap boleh lanjut.
    if (typeof aletaDeteksiSisa === "object" && aletaDeteksiSisa) {
      const jenisNaskah = { put: "putusan", bas: "bas", rel: "relaas" }[j] || "";
      if (jenisNaskah) {
        let tinjau = { lanjut: true };
        try {
          tinjau = await aletaDeteksiSisa.tinjau(rtfBuf, {
            nama: namaUnduhan(nomor, berkas, "rtf"),
            jenis: jenisNaskah,
            aksi: S.fmt.edoc && j === "put" && !tes() ? "unggah" : "unduh",
          });
        } catch {
          tinjau = { lanjut: true }; // galat pemeriksa tidak boleh menahan cetak/unggah
        }
        if (tinjau && tinjau.lanjut === false) {
          catatLog("dibatalkan: petugas membatalkan karena naskah masih memuat sisa blangko");
          toast("Dibatalkan. Perbaiki sisa blangko di naskah, lalu cetak lagi.");
          return;
        }
      }
    }
    // CETAK CEPAT: dari SATU naskah, keluaran yang saling bebas (PDF, PDF SALINAN, anonim) disusun BERSAMAAN; urutan penulisan hasil
    // dan nama berkas sama dengan alur berurutan yang lama. RTF tetap diunduh lebih dulu (tanpa menunggu pengubah PDF).
    const mulaiCetak = Date.now();
    const ukur = { rtf: 0, pdf: 0, salinan: 0, anonim: 0, pdfAnonim: 0, edoc: 0, total: 0 };
    S.ukurCetak = ukur;
    const rtfLatin1 = latin1(rtfBuf);
    if (S.fmt.pdf) await autoCentangTtd(); // tanda tangan sah otomatis ikut bila pengguna belum memilih sendiri
    const pesanRtf = [];
    if (S.fmt.rtf) {
      const nama = namaUnduhan(nomor, berkas, "rtf");
      const u = await unduh(new Blob([rtfBuf], { type: "application/rtf" }), nama);
      pesanRtf.push(u.ok ? `RTF diunduh "${nama}"` : `RTF gagal: ${u.pesan}`);
      ukur.rtf = Date.now() - mulaiCetak;
      tampilStatus(pesanRtf[0]);
    }
    let anonimRtf = null;
    let anonimAleta = null; // 16OKT-F43
    const selesai = (kunci, mulai, pesan) => {
      ukur[kunci] = Date.now() - mulai;
      if (pesan && pesan.length) tampilStatus(pesan[pesan.length - 1]);
      return pesan;
    };
    const tPdf = async () => {
      const mulai = Date.now();
      const pesan = [];
      try {
        catatLog("membuat PDF…");
        const { h, t } = await pdfBiasaDenganTtd(rtfBuf);
        const nama = namaUnduhan(nomor, berkas, "pdf");
        const u = await unduh(h.blob, nama);
        let ket = u.ok ? `PDF diunduh "${nama}"` : `PDF gagal: ${u.pesan}`;
        if (t.dipasang.length) ket += ` · tanda tangan: ${t.dipasang.join(", ")}`;
        if (t.tidakDitemukan.length) ket += ` · nama tidak ditemukan di naskah, tanda tangan tidak dibubuhkan: ${t.tidakDitemukan.join(", ")}`;
        if (t.gagal.length) ket += ` · gambar tidak terbaca: ${t.gagal.join(", ")}`;
        pesan.push(ket);
      } catch (e) {
        pesan.push(`PDF gagal: ${String((e && e.message) || e)}`);
      }
      return selesai("pdf", mulai, pesan);
    };
    const tSalinan = async () => {
      const mulai = Date.now();
      const pesan = [];
      try {
        catatLog("membuat PDF SALINAN…");
        // SALINAN: majelis dan panitera sidang hanya bertulis "ttd" (disusun bot); satu-satunya gambar tanda tangan milik Panitera
        // pengesah di blok "Untuk Salinan". Pilihan "Tambah tanda tangan" tidak berlaku di salinan.
        const { blob, keterangan } = await pdfDari(rtfLatin1, true);
        const nama = namaUnduhan(nomor, `${berkas} - SALINAN`, "pdf");
        // 28 Okt (630/2026): pesan menyebut yang SUNGGUH terjadi - jumlah "ttd" yang tertulis (laporan bot) dan sebab tanda tangan
        // Panitera tidak tertempel - bukan kalimat tetap yang terdengar berhasil walau "ttd" tidak tertulis.
        const nTtd = keterangan ? Number(keterangan.ttdDitambah || 0) + Number(keterangan.ttdSudahAda || 0) : 0;
        const bagianTtd = keterangan ? (nTtd ? `majelis dan panitera sidang: ttd (${nTtd})` : "tulisan ttd TIDAK tertulis - blok tanda tangan majelis tidak dikenali") : "";
        const sebabTanpa = {
          ttd_tidak_ada: "tanda tangannya belum terdaftar/disahkan",
          nama_panitera_tidak_ditemukan_di_pdf: "namanya tidak ditemukan di PDF",
        };
        const ket =
          keterangan && keterangan.gambarTtdPanitera
            ? ` (tanda tangan Panitera ${keterangan.namaPanitera || ""} tertempel; ${bagianTtd})`
            : keterangan && keterangan.namaPanitera
              ? ` (tanpa tanda tangan Panitera ${keterangan.namaPanitera}${keterangan.alasanTanpaGambar ? `: ${sebabTanpa[keterangan.alasanTanpaGambar] || keterangan.alasanTanpaGambar}` : ""}; ${bagianTtd})`
              : keterangan
                ? ` (blok "Untuk Salinan" tidak ditemukan; ${bagianTtd})`
                : "";
        const jawab = await kirimLatar({ jenis: "tampilkan-pdf", nama, alamat: await blobKeData(blob), pesan: "", awas: !(keterangan && keterangan.gambarTtdPanitera) });
        if (jawab && jawab.ok) pesan.push(`PDF SALINAN dibuka di tab baru${ket}`);
        else {
          const u = await unduh(blob, nama);
          pesan.push(u.ok ? `PDF SALINAN diunduh "${nama}"${ket}` : `PDF SALINAN gagal: ${u.pesan}`);
        }
      } catch (e) {
        pesan.push(`PDF SALINAN gagal: ${String((e && e.message) || e)}`);
      }
      return selesai("salinan", mulai, pesan);
    };
    const bolehAnon = (S.fmt.anon || (S.fmt.edoc && !tes())) && j === "put";
    const tAnonim = async () => {
      const mulai = Date.now();
      const pesan = [];
      try {
        /* === 16OKT-F43: penyamar mandiri ALETA dulu (abt.js); anonimisasi ABT hanya cadangan === */
        anonimAleta = typeof alatAnonimMandiri === "function" ? await alatAnonimMandiri(rtfBuf, nomor, catatLog) : null;
        if (anonimAleta && anonimAleta.ok) pesan.push(`anonim oleh ALETA: ${alatRingkasAnonim(anonimAleta)}${anonimAleta.sisa && anonimAleta.sisa.length ? ` - ${anonimAleta.sisa.length} bagian perlu diperiksa` : ""}`);
        else catatLog(`${anonimAleta ? `penyamar ALETA tidak dapat dipakai (${anonimAleta.sebab}); ` : ""}menyamarkan nama pihak (anonimisasi ABT, bisa 1-2 menit)…`);
        const h = anonimAleta && anonimAleta.ok ? anonimAleta : tes() ? { ok: false, pesan: "anonimisasi lewat ABT mati pada Tes putusan (ia menulis berkas sementara di ABT)" } : await klienAbt().anonim({ perkaraId: perkaraId(), nomor, rtf: rtfBuf, namaBerkas: namaUnduhan(nomor, berkas, "rtf") });
        /* === AKHIR 16OKT-F43 === */
        if (!h.ok) pesan.push(`anonimisasi gagal: ${h.pesan || "ABT tidak menjawab"}`);
        else anonimRtf = h.rtf;
      } catch (e) {
        pesan.push(`anonimisasi gagal: ${String((e && e.message) || e)}`);
      }
      return selesai("anonim", mulai, pesan);
    };
    const pAnonim = bolehAnon ? tAnonim() : Promise.resolve([]);
    const tPdfAnonim = async () => {
      await pAnonim;
      if (!anonimRtf) return [];
      const mulai = Date.now();
      const pesan = [];
      try {
        const { blob } = await pdfDari(latin1(anonimRtf), false);
        const nama = namaUnduhan(nomor, `${berkas} - anonim`, "pdf");
        const u = await unduh(blob, nama);
        pesan.push(u.ok ? `PDF anonim diunduh "${nama}"` : `PDF anonim gagal: ${u.pesan}`);
      } catch (e) {
        pesan.push(`PDF anonim gagal: ${String((e && e.message) || e)}`);
      }
      return selesai("pdfAnonim", mulai, pesan);
    };
    const tEdoc = async () => {
      if (!(S.fmt.edoc && j === "put")) return [];
      if (tes()) return ["e-Doc SIPP: tidak diunggah (mode Tes putusan)"];
      await pAnonim;
      const mulai = Date.now();
      /* === 16OKT-F43: pratinjau naskah anonim ALETA sebelum unggah === */
      const pilih = anonimAleta && anonimAleta.ok && anonimRtf && typeof alatPratinjauAnonim === "function" ? await alatPratinjauAnonim(anonimAleta, { nomor }) : "unggah";
      let pesan;
      if (pilih === "batal") pesan = ["e-Doc SIPP: unggah dibatalkan dari pratinjau anonim"];
      else {
        catatLog("mengunggah putusan ke e-Doc SIPP…");
        pesan = [await unggahEdoc(rtfBuf, pilih === "tanpa" ? null : anonimRtf)];
      }
      /* === AKHIR 16OKT-F43 === */
      return selesai("edoc", mulai, pesan);
    };
    const [pPdf, pSalinan, pPdfAnonim, pEdoc] = await Promise.all([S.fmt.pdf ? tPdf() : [], S.fmt.salinan ? tSalinan() : [], tPdfAnonim(), tEdoc()]);
    const pAnon = await pAnonim;
    const hasil = [...pesanRtf, ...pPdf, ...pSalinan, ...pAnon, ...pPdfAnonim, ...pEdoc];
    ukur.total = Date.now() - mulaiCetak;
    if (!tes()) {
      S.cetakTercatat[`${nomor}|${j}`] = jamSekarang();
      void tulisPenyimpanan({ [`${K_CETAK}:${nomor}|${j}`]: jamSekarang() });
      laporCetakWajib();
    }
    for (const h of hasil) catatLog(h);
    toast(hasil.join(" · "));
  }
  async function unggahEdoc(rtfBuf, anonimRtf) {
    if (tes()) return "e-Doc SIPP: tidak diunggah (mode Tes putusan)";
    const akun = api() && typeof api().siapa === "function" ? api().siapa() : null;
    const nomor = nomorPerkara();
    const namaDasar = namaUnduhan(nomor, S.blangko.berkas, "rtf").replace(/\.rtf$/i, "");
    const kirim = async (denganAnonim) => {
      const badan = new FormData();
      badan.append("perkaraId", perkaraId());
      badan.append("nomorPerkara", nomor);
      badan.append("olehUsername", (akun && (akun.usernameSipp || akun.username)) || "");
      badan.append("putusan", new Blob([rtfBuf], { type: "application/rtf" }), `${namaDasar}.rtf`);
      if (denganAnonim) badan.append("anonimisasi", new Blob([anonimRtf], { type: "application/rtf" }), `${namaDasar} - anonim.rtf`);
      const r = typeof alatAmbil === "function" ? await alatAmbil(API_UNGGAH_SIPP, { method: "POST", body: badan, credentials: "include", batasMs: BATAS_LAMA_MS }, "Mengunggah putusan ke SIPP") : await fetch(API_UNGGAH_SIPP, { method: "POST", body: badan, credentials: "include" });
      const luar = await r.json().catch(() => null);
      const jawab = luar && luar.data ? luar.data : luar;
      if (!r.ok) return { ok: false, sebab: (jawab && (jawab.sebab || jawab.pesan)) || (luar && luar.error && luar.error.message) || `ALETA menjawab ${r.status}`, tolak: jawab && jawab.slot ? jawab : null };
      if (!jawab || !jawab.ok) return { ok: false, sebab: (jawab && (jawab.sebab || jawab.pesan || jawab.alasan)) || "ditolak", tolak: null };
      return { ok: true };
    };
    try {
      let h = await kirim(Boolean(anonimRtf));
      if (!h.ok && anonimRtf && h.tolak && h.tolak.slot === "anonimisasi") {
        const sebab = h.sebab;
        h = await kirim(false);
        return h.ok ? `e-Doc SIPP: putusan terunggah; anonimisasi DITOLAK (${sebab}) - samarkan lalu unggah sendiri` : `e-Doc SIPP gagal: ${h.sebab}`;
      }
      return h.ok ? `e-Doc SIPP: ${anonimRtf ? "putusan + anonimisasi" : "putusan"} terunggah` : `e-Doc SIPP gagal: ${h.sebab}`;
    } catch (e) {
      return `e-Doc SIPP gagal: ${String((e && e.message) || e)}`;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sumber ⓘ: tip saat kursor, keterangan saat diklik
  // ──────────────────────────────────────────────────────────────────────────
  function taruhPop(pop, jangkar) {
    pop.hidden = false;
    // Akar tampilan dapat ber-zoom (melawan zoom kecil halaman ABT): koordinat layar dibagi skala itu.
    const a = api();
    const z = a && typeof a.skala === "function" ? Number(a.skala()) || 1 : 1;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight || 600;
    const r = jangkar.getBoundingClientRect();
    pop.style.maxHeight = `${(vh - 16) / z}px`;
    const w = Math.min((pop.offsetWidth || 320) * z, vw - 16);
    const h = Math.min((pop.offsetHeight || 240) * z, vh - 16);
    let left = r.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = r.bottom + 6;
    if (top + h > vh - 8) {
      const atas = r.top - 6 - h;
      top = atas >= 8 ? atas : Math.max(8, vh - 8 - h);
    }
    pop.style.left = `${left / z}px`;
    pop.style.top = `${top / z}px`;
  }
  let popSumberJangkar = null;
  function bukaSumber(btn) {
    const pop = cari("#bd-popsumber", wadah.akar);
    if (!pop) return;
    if (!pop.hidden && popSumberJangkar === btn) return tutupSumber();
    const id = btn.getAttribute("data-sumber");
    const umum = INFO_UMUM[id];
    const it = umum ? null : itemSumber(id);
    const nama = umum ? umum.judul : btn.getAttribute("aria-label").replace(/^Dari mana isian /, "").replace(/ ini\?$/, "");
    const l = umum ? [] : it ? sumberDaftar(it) : [{ t: "tangan", nama: "Diketik petugas", jelas: "Diketik petugas." }];
    const ket = umum ? [umum.teks] : ketItem(it);
    pop.innerHTML =
      `<div class="bd-pkepala"><b>${umum ? "Keterangan" : "Dari mana isian ini?"}</b><button type="button" class="bd-ikon" data-bd2="tutupsumber" aria-label="Tutup keterangan">✕</button></div><p class="bd-sumnama">${esc(nama)}</p>` +
      (ket.length ? `<div class="bd-sumitem bd-sumket"><span class="bd-chip bd-sumchip catatan">Catatan</span>${ket.map((x) => `<p>${esc(x)}</p>`).join("")}</div>` : "") +
      l.map((x) => `<div class="bd-sumitem"><span class="bd-chip bd-sumchip ${x.t}">${esc(x.nama)}</span><p>${esc(x.jelas)}</p></div>`).join("") +
      (umum ? "" : `<p class="bd-catat">Yang Anda ketik sendiri selalu didahulukan dan tersimpan di ABT.</p>`) +
      (it && it.jenis !== "tj" && adm() ? `<p class="bd-sumadmin">Admin: ${tautanEditVariabel(it.kode)}</p>` : "");
    popSumberJangkar = btn;
    cariSemua(".bd-sumber[aria-expanded]", wadah.akar).forEach((b) => b.setAttribute("aria-expanded", "false"));
    btn.setAttribute("aria-expanded", "true");
    const tip = cari("#bd-tip", wadah.akar);
    if (tip) tip.hidden = true; // gelembung yang diklik menggantikan tip kursor
    tutupPopTtd(); // satu gelembung saja yang terbuka
    taruhPop(pop, btn);
  }
  function tutupSumber() {
    const pop = cari("#bd-popsumber", wadah.akar);
    if (pop) pop.hidden = true;
    if (popSumberJangkar) popSumberJangkar.setAttribute("aria-expanded", "false");
    popSumberJangkar = null;
  }
  function tutupPopTtd() {
    const pop = cari("#bd-popttd", wadah.cetak);
    const b = cari("#bd-btnttd", wadah.cetak);
    if (pop) pop.hidden = true;
    if (b) b.setAttribute("aria-expanded", "false");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Peristiwa
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Mengisi kotak yang masih kosong dengan saran yang SESUAI MAKNA isiannya (dari gugatan/posita, SIPP, draf H-7 yang pasti, bawaan ABT).
   * Contoh umum ("belum dikaruniai anak", tanggal pengumuman contoh) tidak ikut. Tidak pernah menimpa. `senyap`: tanpa toast
   * (dipakai tombol "Isi otomatis"). Mengembalikan banyaknya isian yang diisi.
   */
  function pakaiSemuaSaran(opsi) {
    const senyap = Boolean(opsi && opsi.senyap);
    let n = 0;
    for (const b of daftarPerlu()) {
      if (b.jenis !== "teks" || (b.opsi && b.opsi.length) || String(S.isi[b.kode] || "").trim() || S.diketik.has(b.kode)) continue;
      // Tanggal akta nikah pada bukti belum tentu tanggal nikah: hanya saran samar (Tab), tidak ikut pengisian massal.
      if (S.saranSipp[b.kode] && S.saranSipp[b.kode].asal === "bukti akta nikah" && !(S.saranH7 && S.saranH7[b.kode])) continue;
      // F4.2: usulan draf H-7 yang BELUM pasti tidak ikut diisi sekaligus - dipakai satu per satu (Tab) sesudah diperiksa.
      const m = mesinIsi();
      const mentahH7 = S.saranH7 && S.saranH7[b.kode] && S.saranH7[b.kode].golongan !== "pasti" ? S.saran[b.kode] || "" : "";
      const sr = S.saranH7 && S.saranH7[b.kode] && S.saranH7[b.kode].golongan !== "pasti" ? (m && mentahH7 && !m.sahBentuk(b.kode, m.bersihkanNilai(b.kode, mentahH7), b.nama) ? "" : mentahH7) : saranUntuk(b, { tanpaUmum: true });
      if (!sr) continue;
      jadwalkanSimpan(b.kode, sr);
      n += 1;
    }
    if (!senyap) {
      renderIsian();
      toast(n ? `${n} isian diisi dari saran. Periksa sebelum cetak; semuanya tersimpan ke ABT.` : "Tidak ada isian kosong yang punya saran.");
    }
    return n;
  }
  /**
   * F4.2: membuka blangko putusan draf H-7 agen ALETA dan memasang isiannya sebagai SARAN (tidak tersimpan ke ABT).
   * d = { blangko: { folder, berkas, menu, alias }, saran: { kode: { nilai, golongan, sumber } } } dari portal (konseptor-langkah GET).
   */
  async function pakaiDrafH7(d) {
    if (!S.pk) return toast("Pilih perkara dulu.");
    if (!d || !d.blangko || !d.blangko.berkas) return toast("Draf H-7 belum punya blangko putusan.");
    await muatMenu();
    const kelompok = kelompokUntukSaran(S.menu ? S.menu.kelompok : [], d.blangko);
    const k = kelompok && S.menu && S.menu.kelompok.find((x) => x.nama === kelompok);
    if (!k) return toast(`Menu blangko ${d.blangko.menu || d.blangko.folder || ""} tidak ditemukan di ABT.`);
    if (!k.berkas) await muatBerkasKelompok(k);
    await pilihBlangko(String(d.blangko.berkas).replace(/\.rtf$/i, ""), k.nama);
    S.saranH7 = {};
    let n = 0;
    for (const [kode, s] of Object.entries((d && d.saran) || {})) {
      if (!s || !String(s.nilai || "").trim()) continue;
      S.saranH7[kode] = { nilai: String(s.nilai), golongan: s.golongan === "pasti" ? "pasti" : "usulan", sumber: String(s.sumber || "") };
      n += 1;
    }
    renderIsian();
    toast(n ? `Draf H-7 dipasang: ${n} saran dari agen ALETA. Belum ada yang tersimpan ke ABT - periksa lalu pakai.` : "Blangko draf H-7 dibuka; agen belum punya saran isian.");
    return n;
  }
  function saatKlik(e) {
    const t = e.target;
    const c = (s) => t.closest && t.closest(s);
    if (!c("#bd-popsumber,.bd-sumber")) tutupSumber();
    if (!c("#bd-popttd,#bd-btnttd")) tutupPopTtd();
    if (S.tjMenu && !c(".bd-lainnya")) {
      S.tjMenu = false;
      renderTj();
    }
    if (S.menuSaran && !c("[data-menu],.bd-saranmenu")) {
      S.menuSaran = null;
      renderIsian();
    }
    const sumber = c(".bd-sumber");
    if (sumber) {
      e.stopPropagation();
      return bukaSumber(sumber);
    }
    const aksi = c("[data-bd2]");
    const kode = aksi ? aksi.getAttribute("data-bd2") : "";
    if (kode === "bukamodal") return bukaModal();
    if (kode === "tutupmodal") return tutupModal();
    if (kode === "pakairek") {
      const r = rekomendasiJenis(jenisSaranAktif())[0];
      if (!r) return;
      const k = S.menu && S.menu.kelompok.find((x) => x.nama === r.kelompok || (x.berkas && x.berkas.some((b) => samaBerkasSaran(b.berkas, r.berkas))));
      const asli = k && k.berkas ? k.berkas.find((b) => samaBerkasSaran(b.berkas, r.berkas)) : null; // nama berkas sebenarnya di ABT
      if (k && asli) return void pilihBlangko(asli.berkas, k.nama);
      return bukaModal();
    }
    if (kode === "ulangkel") {
      const k = S.menu && S.menu.kelompok.find((x) => x.nama === aksi.getAttribute("data-kel"));
      if (k) {
        k.galat = "";
        void muatBerkasKelompok(k, true);
      }
      return;
    }
    if (kode === "ulangsusunan") {
      const bl = S.blangko;
      if (!bl || bl.hak === "ok") return void muatSusunan();
      // Hak belum "ok" (ditolak/galat): periksa ulang ke ABT dulu, baru isian dibaca.
      S.galatSusunan = "";
      renderIsian();
      return void periksaHakBlangko(bl).then(() => (S.blangko === bl && bl.hak === "ok" ? muatSusunan() : undefined));
    }
    if (kode === "salinskors") return void salinKalimatSkors();
    if (kode === "isisipp") return void isiSemuaOtomatis();
    if (kode === "inputyakin") return void masukkanCalon(calonInput().yakin);
    if (kode === "inputpasti") return void masukkanCalon(calonInput().pasti);
    if (kode && kode.startsWith("ket") && aksi.getAttribute("data-ket")) return void aksiKet(aksi.getAttribute("data-ket"), kode, Number(aksi.getAttribute("data-idx")));
    if (kode === "pakaisaran") return pakaiSemuaSaran();
    if (kode === "ktpbukti") return void ambilTanggalKtp();
    if (kode === "takberlaku") {
      S.tampilTakBerlaku = !S.tampilTakBerlaku;
      renderIsian();
      laporKeKerangka();
      return;
    }
    if (kode === "bukatj") {
      const it = daftarPerlu().find((x) => x.jenis === "tj");
      return it ? void bukaTj(it.tj.kunci) : undefined;
    }
    if (kode === "isisaksi") {
      // Peringatan "keterangan saksi belum diisi": buka tanya jawab saksi pertama yang kosong (penyunting BAS memuat
      // pilihan "Set pertanyaan"; putusan hanya menampilkannya).
      const k = String(aksi.getAttribute("data-kunci") || "");
      if (!tjItem(k)) return;
      if (deretTj().hanyaBaca) S.tjLipat = true;
      if (S.tjBuka !== k) void bukaTj(k);
      else renderTj();
      const w2 = cari("#bd-tjwadah", wadah.isian) || cari("#bd-tjtombol", wadah.isian);
      if (w2 && w2.scrollIntoView) w2.scrollIntoView({ block: "center" });
      return;
    }
    if (kode === "semua") {
      S.semuaBuka = !S.semuaBuka;
      aksi.setAttribute("aria-expanded", String(S.semuaBuka));
      return renderSemua();
    }
    if (kode === "tutupsumber") return tutupSumber();
    if (kode === "tutuptj") {
      S.tjBuka = null;
      return renderTj();
    }
    if (kode === "lainnya") {
      S.tjMenu = !S.tjMenu;
      return renderTj();
    }
    if (kode === "lipattj") {
      S.tjLipat = !S.tjLipat;
      if (!S.tjLipat) S.tjBuka = null;
      else if (!S.tjBuka) {
        const pertama = daftarPerlu().find((x) => x.jenis === "tj");
        if (pertama) return void bukaTj(pertama.tj.kunci);
      }
      return renderTj();
    }
    if (kode === "alasanlain") {
      const k = String(aksi.getAttribute("data-kunci") || "");
      S.sk.lainBuka[k] = !S.sk.lainBuka[k];
      return renderTj();
    }
    if (kode === "isioto") {
      const kunci = String(aksi.getAttribute("data-kunci") || "").split("|").filter(Boolean);
      if (!tjSiap(kunci)) return toast(PESAN_TJ_BELUM_TERBACA);
      // 20 Okt: tiap klik meminta persetujuan dulu (jumlah jawaban yang berubah dan yang tertahan).
      return void isiOtomatis(kunci, TP() ? { lapor: true, tinjau: true } : { lapor: true });
    }
    if (kode === "isiulangya") return terapkanTinjau();
    if (kode === "isiulangbatal") {
      S.sk.tinjau = null;
      return renderTj();
    }
    if (kode === "tinjautimpa") {
      if (S.sk.tinjau) S.sk.tinjau.termasuk = Boolean(aksi.checked);
      return renderTj();
    }
    if (kode === "lompat") return lompatAsal(String(aksi.getAttribute("data-jenis") || ""));
    if (kode === "infoasal") return toast(aksi.getAttribute("title") || "");
    if (kode === "tambahan") {
      const d = aksi.closest("details");
      S.tambahanBuka = d ? !d.open : !S.tambahanBuka;
      return;
    }
    if (kode === "lanjutan" || kode === "tuntutan") {
      const d = aksi.closest("details");
      if (kode === "lanjutan") S.lanjutanBuka = d ? !d.open : !S.lanjutanBuka;
      else S.tuntutanBuka = d ? !d.open : !S.tuntutanBuka;
      return;
    }
    if (kode === "jabatan") {
      // 21 Okt: hanya hakim (penulis putusan) - tuntutan ditetapkan karena jabatan: isiannya pindah ke daftar utama.
      if (!bolehTulis() || !S.blangko || S.blangko.jenis !== "put") return;
      const p = String(aksi.getAttribute("data-p") || "");
      if (!/^414[0-5]$/.test(p)) return;
      const k = kunciJabatan(p);
      S.jabatan[k] = !S.jabatan[k];
      S.tuntutanBuka = true;
      renderIsian();
      renderCetak();
      laporKeKerangka();
      return;
    }
    if (kode === "timpaoto") return timpaOtomatis(String(aksi.getAttribute("data-kunci") || ""));
    if (kode === "batalimpa") {
      S.sk.konfirmasi[String(aksi.getAttribute("data-kunci") || "")] = false;
      return renderTj();
    }
    if (kode === "muattpl") {
      const sel = cari("#bd-muattpl", wadah.isian);
      const kunci = String(aksi.getAttribute("data-kunci") || "").split("|").filter(Boolean);
      if (!sel || !sel.value) return toast("Pilih set pertanyaan dulu.");
      if (!tjSiap(kunci)) return toast(PESAN_TJ_BELUM_TERBACA);
      if (sel.value.startsWith("katalog:")) {
        void ktIsiOtomatis(kunci, { lapor: true, gantiDaftar: true });
        return toast("Pertanyaan disusun dari katalog jenis perkara (belum disimpan). Jawaban yang sudah Anda ketik dipertahankan.");
      }
      tjCatat(kunci);
      if (sel.value.startsWith("aleta:")) {
        const dipakai = kunci.map((k) => pakaiSetSaksi(k, sel.value.slice(6))).filter(Boolean);
        renderTj();
        void isiOtomatis(kunci, {});
        return toast(dipakai.length ? `"${dipakai[0].judul}" dimuat (belum disimpan). Lengkapi titik-titik pada jawaban, lalu tekan Simpan ke ABT.` : "Set pertanyaan tidak ditemukan.");
      }
      return void Promise.all(kunci.map((k) => muatTemplatTj(k, sel.value))).then(() => {
        renderTj();
        void isiOtomatis(kunci, {});
        toast("Set pertanyaan dimuat (belum disimpan - tekan Simpan ke ABT).");
      });
    }
    if (kode === "tambahtj") {
      const kunci = String(aksi.getAttribute("data-kunci") || "").split("|").filter(Boolean);
      if (!tjSiap(kunci)) return toast(PESAN_TJ_BELUM_TERBACA);
      tjCatat(kunci);
      for (const k of kunci) {
        const x = S.tj[k];
        if (x) {
          x.rows.push({ no: String(x.rows.length + 1), tanya: "", jawab: "" });
          x.berubah = true;
        }
      }
      return renderTj();
    }
    if (kode === "salinjm") {
      const kunciSalin = String(aksi.getAttribute("data-kunci") || "");
      const o = kunciSalin.startsWith("bukti:") ? S.buktiOto && S.buktiOto[kunciSalin.slice(6)] : S.tjOto && S.tjOto[kunciSalin];
      if (!o || !o.teks) return toast("Tidak ada teks untuk disalin.");
      return void salinTeksJm(o.teks).then((ok) => toast(ok ? "Teks tersalin - tempel di penyunting lalu periksa." : "Gagal menyalin - pilih teks lalu Ctrl+C."));
    }
    if (kode === "simpantj") return void simpanTj(String(aksi.getAttribute("data-kunci") || "").split("|").filter(Boolean));
    if (kode === "bukaprat") {
      S.prat.terbuka = !S.prat.terbuka;
      renderPratinjau();
      if (S.prat.terbuka && (!S.prat.html || S.prat.kotor)) void muatPratinjau(S.prat.kotor);
      return;
    }
    if (kode === "muatprat") return void muatPratinjau(true);
    if (kode === "suntingpenuh") {
      S.prat.suntingPenuh = true;
      return renderPratinjau();
    }
    if (kode === "batalsunting") {
      S.prat.suntingPenuh = false;
      return renderPratinjau();
    }
    if (kode === "simpansunting") return void simpanSuntingPenuh();
    if (kode === "popttd") {
      const pop = cari("#bd-popttd", wadah.cetak);
      if (!pop) return;
      if (!pop.hidden) return tutupPopTtd();
      pop.innerHTML = `<p class="bd-catat">Membaca tanda tangan…</p>`;
      aksi.setAttribute("aria-expanded", "true");
      taruhPop(pop, aksi);
      return void muatSumberTtd().then(() => {
        if (pop.hidden) return;
        pop.innerHTML = isiPopTtd();
        taruhPop(pop, aksi);
      });
    }
    if (kode === "hapusttd") {
      void tulisPenyimpanan({ [K_TTD]: null }).then(() => {
        S.ttdSumber = null;
        S.ttdPilih.clear();
        renderCetak();
        toast("Tanda tangan Anda dihapus dari ekstensi.");
      });
      return;
    }
    if (kode === "hapusunggah") return lepasUnggahan();
    if (kode === "cetak") return void cetak(false);
    if (kode === "tetapcetak") return void cetak(true);
    if (kode === "isidulu") {
      const e2 = cari("#bd-ingat", wadah.cetak);
      if (e2) e2.hidden = true;
      S.peringat = false;
      // Loncat ke isian PENTING pertama yang kosong (bila tidak ada, isian kosong pertama).
      const kosong =
        cariSemua("#bd-perlu .bd-f.bd-kosongcetak:not(.tambahan) input, #bd-perlu .bd-f.bd-kosongcetak:not(.tambahan) select", wadah.isian)[0] ||
        cariSemua("#bd-perlu .bd-f:not(.beres) input, #bd-perlu .bd-f:not(.beres) select", wadah.isian)[0];
      if (kosong) {
        kosong.focus();
        kosong.scrollIntoView && kosong.scrollIntoView({ block: "center" });
      }
      return;
    }
    if (kode === "lihatbagian") {
      S.prat.terbuka = true;
      renderPratinjau();
      if (!S.prat.html) void muatPratinjau(false);
      else {
        const r = cari("#bd-kertas .bd-v.rusak", wadah.pratinjau);
        if (r && r.scrollIntoView) r.scrollIntoView({ block: "center" });
      }
      return;
    }
    const jenisModal = c("[data-jenismodal]");
    if (jenisModal && S.modal) {
      S.modal.jenis = jenisModal.getAttribute("data-jenismodal");
      S.modal.kelompok = "";
      renderModal();
      void muatSemuaKelompok(S.modal.jenis);
      return;
    }
    const kel = c("[data-kelmodal]");
    if (kel && S.modal) {
      S.modal.kelompok = kel.getAttribute("data-kelmodal");
      S.modal.cari = "";
      renderModal();
      const k = S.menu && S.menu.kelompok.find((x) => `k:${x.nama}` === S.modal.kelompok);
      if (k && !k.berkas) void muatBerkasKelompok(k);
      if (S.modal.kelompok === "ikrar") void muatKelompokIkrar();
      return;
    }
    const bl = c("[data-bl]");
    if (bl) return void pilihBlangko(bl.getAttribute("data-bl"), bl.getAttribute("data-kel"));
    if (c("#bd-modal") && t.id === "bd-modal") return tutupModal();
    const menu = c("[data-menu]");
    if (menu) {
      const k = menu.getAttribute("data-menu");
      S.menuSaran = S.menuSaran === k ? null : k;
      return renderIsian();
    }
    const ambil = c("[data-ambil]");
    if (ambil) {
      const k = ambil.getAttribute("data-ambil");
      S.menuSaran = null;
      jadwalkanSimpan(k, ambil.getAttribute("data-nilai"));
      renderIsian();
      const i = cari(`#bd-i${k}`, wadah.isian);
      if (i) i.focus();
      return;
    }
    const tambahBukti = c("[data-bktambah]");
    if (tambahBukti) {
      const w = tambahBukti.getAttribute("data-bktambah");
      if (!S.bukti[w]) S.bukti[w] = [];
      S.bukti[w].push(buktiBaru(tambahBukti.getAttribute("data-nama"), tambahBukti.getAttribute("data-oleh")));
      simpanBukti(w, false);
      return renderIsian();
    }
    const elBuka = c("[data-belbuka]");
    if (elBuka) {
      const w = elBuka.getAttribute("data-belbuka");
      const el = elPihak(w);
      S.buktiElBuka[w] = !S.buktiElBuka[w];
      // Dibuka pertama kali: satu butir kosong siap diisi (butir kosong tidak ditulis ke ABT).
      if (S.buktiElBuka[w] && !el.butir.length) el.butir.push(butirElBaru(w, awalanBawaanEl(S.bukti[w], w)));
      return renderIsian();
    }
    const elTambah = c("[data-beltambah]");
    if (elTambah) {
      const w = elTambah.getAttribute("data-beltambah");
      elPihak(w).butir.push(butirElBaru(w, awalanBawaanEl(S.bukti[w], w)));
      return renderIsian();
    }
    const elHapus = c("[data-belhapus]");
    if (elHapus) {
      const [w, i] = elHapus.getAttribute("data-belhapus").split(".");
      elPihak(w).butir.splice(Number(i), 1);
      simpanBukti(w, false);
      return renderIsian();
    }
    const elManual = c("[data-belmanual]");
    if (elManual) {
      const [w, i] = elManual.getAttribute("data-belmanual").split(".");
      const r = elPihak(w).butir[Number(i)];
      if (!r) return;
      // Tulis manual: kalimat utuh (tanpa nomor urut) disunting bebas; isian terstruktur tetap tersimpan di butir.
      if (typeof r.manual === "string") r.manual = null;
      else {
        const n = urutEl(w, Number(i));
        r.manual = kalimatBuktiEl({ ...r, manual: null }, { urut: n, tanda: n, sb: sebutan(), nomori: false });
      }
      simpanBukti(w, false);
      return renderIsian();
    }
    const manualBukti = c("[data-bkmanual]");
    if (manualBukti) {
      const [w, i] = manualBukti.getAttribute("data-bkmanual").split(".");
      const r = S.bukti[w] && S.bukti[w][Number(i)];
      if (!r) return;
      // Tulis manual: kalimat utuh disunting bebas, isian terstruktur dikunci (tidak dibuang) dan dapat dipakai lagi.
      if (typeof r.manual === "string") r.manual = null;
      else r.manual = kalimatBukti({ ...r, manual: null }, w, Number(i));
      simpanBukti(w, false);
      renderIsian();
      const el = cari(`[data-bk="${w}.${i}"][data-isi="${typeof r.manual === "string" ? "manual" : "nm"}"]`, wadah.isian);
      if (el) el.focus();
      return;
    }
    const hapusBukti = c("[data-bkhapus]");
    if (hapusBukti) {
      const [w, i] = hapusBukti.getAttribute("data-bkhapus").split(".");
      S.bukti[w].splice(Number(i), 1);
      simpanBukti(w, false);
      return renderIsian();
    }
    const tjBtn = c("[data-tj]");
    if (tjBtn) return void bukaTj(tjBtn.getAttribute("data-tj"));
    const mode = c("[data-tjmode]");
    if (mode) {
      S.tjSisi = mode.getAttribute("data-tjmode") === "sisi";
      const ps = S.tjSisi && S.tjBuka ? tjPasangan(S.tjBuka) : null;
      renderTj();
      if (ps) void Promise.all(ps.map((k) => muatTj(k))).then(() => (renderTj(), isiOtomatis(ps, {})));
      return;
    }
    if (aksiUmumTj(c)) return;
    if (sbKlik(c, t)) return;
    for (const a of ["naik", "turun", "hapus"]) {
      const b = c(`[data-${a}]`);
      if (b && S.tjBuka && S.tj[S.tjBuka]) {
        const r = S.tj[S.tjBuka].rows;
        const i = Number(b.getAttribute(`data-${a}`));
        tjCatat([S.tjBuka]);
        if (a === "naik" && i > 0) [r[i - 1], r[i]] = [r[i], r[i - 1]];
        if (a === "turun" && i < r.length - 1) [r[i + 1], r[i]] = [r[i], r[i + 1]];
        if (a === "hapus") r.splice(i, 1);
        S.tj[S.tjBuka].berubah = true;
        return renderTj();
      }
    }
    const sbaksi1 = c('[data-sbaksi="bersih1"]');
    if (sbaksi1 && S.tjBuka && S.tj[S.tjBuka]) {
      tjCatat([S.tjBuka]);
      let u = 0;
      for (const r of S.tj[S.tjBuka].rows) {
        const h = bersihkanPenutup(r.jawab, r.tanya);
        if (h !== r.jawab) {
          r.jawab = h;
          u += 1;
        }
      }
      if (u) S.tj[S.tjBuka].berubah = true;
      renderTj();
      return toast(u ? `${u} kalimat penutup dibuang.` : "Tidak ada kalimat penutup yang perlu dibuang.");
    }
  }
  /** Merapikan jawaban saksi menjadi satu paragraf (baris baru di tengah kalimat dilebur); dipakai tombol dan Simpan ke ABT. */
  const rapikanJawabSaksi = (x) => {
    const m = SK();
    return m && typeof m.rapikanJawaban === "function" ? m.rapikanJawaban(x) : String(x == null ? "" : x).replace(/\s*[\r\n]+\s*/g, " ").trim();
  };
  /** Kunci saksi yang sedang tampil (berdampingan: kedua saksi; satu per satu: satu saksi). */
  function kunciTampilTj() {
    const ps = S.tjBuka && S.tjSisi ? tjPasangan(S.tjBuka) : null;
    return (ps || (S.tjBuka ? [S.tjBuka] : [])).filter((k) => S.tj[k]);
  }
  /**
   * Aksi satu jawaban (19 Okt, tahap 2): ganti kalimat, naik/turun (jawaban saja, pertanyaan tetap), tukar dengan saksi lain
   * (memilih saksi tujuan bila saksinya lebih dari dua), dan salin ke saksi lain. Semuanya dapat diurungkan.
   */
  async function aksiJawaban(aksi, kunci, i, tujuan) {
    const m = SK();
    const t = S.tj[kunci];
    if (!m || !t) return;
    if (aksi === "batal") {
      S.tjTujuan = null;
      return renderTj();
    }
    if (!tjSiap([kunci])) return toast(PESAN_TJ_BELUM_TERBACA);
    if (aksi === "ganti") {
      if (!t.rows[i]) return;
      tjCatat([kunci]);
      const g = gantiKalimat(t.rows[i].jawab);
      const sama = g === t.rows[i].jawab;
      t.rows[i].jawab = g;
      t.berubah = true;
      renderTj();
      return toast(sama ? "Tidak ada kata yang bisa diganti di jawaban ini." : "Kalimat diganti, artinya sama.");
    }
    if (aksi === "naik" || aksi === "turun") {
      const g = m.geserJawaban(t.rows, i, aksi === "naik" ? -1 : 1);
      if (!g.ok) return toast("Jawaban ini sudah di ujung daftar.");
      tjCatat([kunci]);
      t.rows = g.rows;
      t.berubah = true;
      renderTj();
      return toast(aksi === "naik" ? "Jawaban dinaikkan satu baris; pertanyaan tetap." : "Jawaban diturunkan satu baris; pertanyaan tetap.");
    }
    if (aksi === "pilihtukar" || aksi === "pilihsalin") {
      const daftar = tujuanLain(kunci);
      if (!daftar.length) return toast("Tidak ada saksi lain.");
      if (daftar.length === 1) return aksiJawaban(aksi === "pilihtukar" ? "tukar" : "salin", kunci, i, daftar[0]);
      S.tjTujuan = { kunci, i, aksi: aksi === "pilihtukar" ? "tukar" : "salin" };
      return renderTj();
    }
    if (aksi === "tukar" || aksi === "salin") {
      S.tjTujuan = null;
      if (!tujuan || tujuan === kunci || !tjItem(tujuan)) return;
      if (!S.tj[tujuan] || !S.tj[tujuan].dimuat) await muatTj(tujuan);
      if (!tjSiap([tujuan])) return toast("Keterangan " + namaSaksiTj(tujuan) + " belum terbaca dari ABT.");
      tjCatat([kunci, tujuan]);
      if (aksi === "tukar") {
        const r = m.tukarJawaban(t.rows, S.tj[tujuan].rows, i);
        t.rows = r.a;
        S.tj[tujuan].rows = r.b;
        t.berubah = true;
        S.tj[tujuan].berubah = true;
        renderTj();
        return toast("Jawaban nomor " + (i + 1) + " ditukar antara " + namaSaksiTj(kunci) + " dan " + namaSaksiTj(tujuan) + ".");
      }
      S.tj[tujuan].rows = m.salinJawaban(t.rows, S.tj[tujuan].rows, i).b;
      S.tj[tujuan].berubah = true;
      renderTj();
      return toast("Jawaban nomor " + (i + 1) + " disalin ke " + namaSaksiTj(tujuan) + ".");
    }
  }
  /** Aksi tanya jawab saksi yang sama di tampilan berdampingan maupun satu per satu: Urungkan, Ulangi, Gabungkan baris. */
  function aksiUmumTj(c) {
    const tb = c("[data-sbaksi]");
    const a = tb ? tb.getAttribute("data-sbaksi") : "";
    if (tb && (a === "urung" || a === "ulang" || a === "rapikan")) {
      S.tjMenu = false;
      if (tb.disabled) return true;
      if (a === "rapikan") {
        const kunci = kunciTampilTj();
        if (!kunci.length) return true;
        tjCatat(kunci);
        let u = 0;
        for (const k of kunci) {
          for (const r of S.tj[k].rows || []) {
            const asli = String(r.jawab || "");
            const h = rapikanJawabSaksi(asli);
            if (h !== asli) {
              u += 1;
              r.jawab = h;
            }
          }
          S.tj[k].berubah = true;
        }
        renderTj();
        toast(u ? u + " jawaban digabung menjadi satu paragraf." : "Semua jawaban sudah satu paragraf.");
        return true;
      }
      const dari = a === "urung" ? S.tjRiw.u : S.tjRiw.r;
      const ke = a === "urung" ? S.tjRiw.r : S.tjRiw.u;
      if (!dari.length) return true;
      const isi = dari.pop();
      ke.push(salinTj(JSON.parse(isi).k));
      tjPulih(isi);
      renderTj();
      toast(a === "urung" ? "Dikembalikan ke keadaan sebelumnya." : "Diulangi.");
      return true;
    }
    const j = c("[data-jaksi]");
    if (j) {
      const [aksi, kunci, i, tujuan] = j.getAttribute("data-jaksi").split("|");
      if (j.disabled) return true;
      void aksiJawaban(aksi, kunci, Number(i), tujuan);
      return true;
    }
    return false;
  }
  /** Alat "Susun keterangan saksi" pada tampilan berdampingan. */
  function sbKlik(c, t) {
    const ps = S.tjBuka && S.tjSisi ? tjPasangan(S.tjBuka) : null;
    if (!ps || !S.tj[ps[0]] || !S.tj[ps[1]]) return false;
    const aksi = c("[data-sbaksi]");
    if (aksi) S.tjMenu = false;
    const sesudah = (pesan) => {
      tjUbah(ps);
      renderTj();
      if (pesan) toast(pesan);
    };
    if (aksi) {
      const a = aksi.getAttribute("data-sbaksi");
      if (aksi.disabled) return true;
      if (a === "urut") {
        tjCatat(ps);
        const [A, B] = tjSama(ps);
        const Bb = [];
        const pakai = new Set();
        A.forEach((r) => {
          const j = B.findIndex((x, i) => !pakai.has(i) && mirip(x.tanya, r.tanya));
          if (j >= 0) {
            pakai.add(j);
            Bb.push(B[j]);
          } else Bb.push({ no: "", tanya: "", jawab: "" });
        });
        B.forEach((x, i) => {
          if (!pakai.has(i)) Bb.push(x);
        });
        S.tj[ps[1]].rows = Bb;
        tjSama(ps);
        sesudah("Pertanyaan yang sama dijajarkan; urutan saksi 1 dipakai sebagai acuan.");
        return true;
      }
      if (a === "samakanq") {
        tjCatat(ps);
        const [A, B, n] = tjSama(ps);
        let u = 0;
        for (let i = 0; i < n; i += 1) {
          if (!A[i].tanya.trim() && B[i].tanya.trim()) A[i].tanya = B[i].tanya;
          if (norm(A[i].tanya) !== norm(B[i].tanya)) {
            B[i].tanya = A[i].tanya;
            u += 1;
          }
        }
        sesudah(u ? `${u} pertanyaan saksi 2 disamakan dengan saksi 1.` : "Semua pertanyaan sudah sama.");
        return true;
      }
      if (a.startsWith("qsama:")) {
        const i = Number(a.slice(6));
        tjCatat(ps);
        const [A, B] = tjSama(ps);
        B[i].tanya = A[i].tanya;
        sesudah(`Pertanyaan nomor ${i + 1} disamakan.`);
        return true;
      }
      if (a === "salinsemua") {
        tjCatat(ps);
        const [A, B, n] = tjSama(ps);
        let u = 0;
        let tetap = 0;
        for (let i = 0; i < n; i += 1) {
          const aa = A[i].jawab.trim();
          if (!aa) continue;
          const bb = B[i].jawab.trim();
          if (bb && norm(bb) !== norm(aa)) continue;
          const g = gantiKalimat(A[i].jawab);
          if (g === A[i].jawab) tetap += 1;
          B[i].jawab = g;
          if (!B[i].tanya.trim()) B[i].tanya = A[i].tanya;
          u += 1;
        }
        sesudah(u ? `${u} jawaban disalin ke saksi 2 dengan kalimat diganti${tetap ? ` (${tetap} apa adanya)` : ""}. Jawaban saksi 2 yang sudah beda tidak diubah.` : "Tidak ada jawaban yang perlu disalin.");
        return true;
      }
      if (a === "bersih") {
        tjCatat(ps);
        let u = 0;
        ps.forEach((k) =>
          (S.tj[k].rows || []).forEach((r) => {
            const h = bersihkanPenutup(r.jawab, r.tanya);
            if (h !== r.jawab) {
              r.jawab = h;
              u += 1;
            }
          })
        );
        sesudah(u ? `${u} kalimat penutup dibuang (mis. “Bahwa cukup sekian”, “tidak ada lagi yang ingin disampaikan”).` : "Tidak ada kalimat penutup yang perlu dibuang.");
        return true;
      }
      return true;
    }
    let b;
    if ((b = c("[data-sbnaik]"))) {
      const i = Number(b.getAttribute("data-sbnaik"));
      if (i > 0) {
        tjCatat(ps);
        const [A, B] = tjSama(ps);
        [A[i - 1], A[i]] = [A[i], A[i - 1]];
        [B[i - 1], B[i]] = [B[i], B[i - 1]];
        sesudah();
      }
      return true;
    }
    if ((b = c("[data-sbturun]"))) {
      const i = Number(b.getAttribute("data-sbturun"));
      const [A, B, n] = tjSama(ps);
      if (i < n - 1) {
        tjCatat(ps);
        [A[i + 1], A[i]] = [A[i], A[i + 1]];
        [B[i + 1], B[i]] = [B[i], B[i + 1]];
        sesudah();
      }
      return true;
    }
    if ((b = c("[data-sbhapus]"))) {
      const i = Number(b.getAttribute("data-sbhapus"));
      tjCatat(ps);
      const [A, B] = tjSama(ps);
      A.splice(i, 1);
      B.splice(i, 1);
      sesudah(`Baris ${i + 1} dihapus untuk kedua saksi.`);
      return true;
    }
    if ((b = c("[data-sbganti]"))) {
      const [i, k] = b.getAttribute("data-sbganti").split(".").map(Number);
      tjCatat(ps);
      const [A, B] = tjSama(ps);
      const R = k ? B : A;
      const g = gantiKalimat(R[i].jawab);
      const sama = g === R[i].jawab;
      R[i].jawab = g;
      sesudah(sama ? "Tidak ada kata yang bisa diganti di jawaban ini." : "Kalimat diganti, artinya sama.");
      return true;
    }
    if ((b = c("[data-sbsalin]"))) {
      const [i, k] = b.getAttribute("data-sbsalin").split(".").map(Number);
      tjCatat(ps);
      const [A, B] = tjSama(ps);
      if (k === 0) B[i].jawab = A[i].jawab;
      else A[i].jawab = B[i].jawab;
      sesudah(`Jawaban nomor ${i + 1} disalin.`);
      return true;
    }
    return false;
  }
  function saatKlikDua(e) {
    const t = e.target;
    const c = (s) => t.closest && t.closest(s);
    const v = c("#bd-kertas .bd-v[data-kode]");
    if (v) return suntingSatu(v);
    if (c("#bd-kertas .bd-v.kosong")) {
      toast("Isian kosong: isi lewat kotak di bagian Perlu diisi.");
      const kosong = cariSemua("#bd-perlu .bd-f:not(.beres) input", wadah.isian)[0];
      if (kosong) kosong.focus();
      return;
    }
    if (c("#bd-kertas")) return toast("Bagian ini berasal dari SIPP atau rumus ABT; ubahlah datanya di SIPP.");
    if (c("#bd-blringkas")) return bukaModal();
  }
  function saatMasuk(e) {
    const t = e.target;
    if (t.tagName === "TEXTAREA" && t.matches && t.matches("textarea.bd-auto, textarea.bd-ed, textarea.bd-bmanual")) tumbuhkan(t);
    if (t.id === "bd-caribl" && S.modal) {
      S.modal.cari = t.value;
      S.modal.fokusCari = true;
      renderModal();
      void muatSemuaKelompok(S.modal.jenis);
      return;
    }
    const k = t.getAttribute && t.getAttribute("data-k");
    if (k) {
      // Daftar isian yang tampil diambil SEBELUM nilai baru dicatat; 8503 menentukan isian C/H (pemicu).
      const sebelum = k === "8503" ? daftarPerlu().map((x) => x.kode).join() : "";
      S.isi[k] = t.value;
      S.diketik.add(k);
      S.peringat = false;
      if (k === "8503") {
        const pos = t.selectionStart;
        if (daftarPerlu().map((x) => x.kode).join() !== sebelum) renderIsian();
        else {
          renderProgres();
          perbaruiPeringatan8503();
        }
        const i = cari(`#bd-i${k}`, wadah.isian);
        if (i && i !== document.activeElement) {
          i.focus();
          try {
            i.setSelectionRange(pos, pos);
          } catch {
            /* tipe input tanpa seleksi */
          }
        }
      } else renderProgres();
      const f = cari(`.bd-f[data-f="${k}"]`, wadah.isian);
      if (f) f.classList.toggle("beres", Boolean(t.value.trim()));
      return;
    }
    const be = t.getAttribute && t.getAttribute("data-be");
    if (be && t.tagName !== "SELECT" && t.type !== "checkbox") {
      const [w, i] = be.split(".");
      const r = elPihak(w).butir[Number(i)];
      if (r) {
        r[t.getAttribute("data-isi")] = t.value;
        segarBuktiEl(w);
      }
      return;
    }
    const bk = t.getAttribute && t.getAttribute("data-bk");
    if (bk !== null && bk !== undefined && t.tagName !== "SELECT") {
      const [w, i] = bk.split(".");
      const r = S.bukti[w] && S.bukti[w][Number(i)];
      if (r) {
        r[t.getAttribute("data-isi")] = t.value;
        S.peringat = false;
        renderProgres();
      }
      return;
    }
    if (sbInput(t)) return;
    const tjb = t.getAttribute && t.getAttribute("data-tjb");
    if (tjb !== null && tjb !== undefined && S.tjBuka && S.tj[S.tjBuka]) {
      const r = S.tj[S.tjBuka].rows[Number(tjb)];
      if (r) {
        r[t.getAttribute("data-sisi")] = t.value;
        S.tj[S.tjBuka].berubah = true;
        segarAsalTampil();
      }
    }
  }
  function sbInput(t) {
    const ps = S.tjBuka && S.tjSisi ? tjPasangan(S.tjBuka) : null;
    if (!ps || !S.tj[ps[0]] || !S.tj[ps[1]]) return false;
    const q = t.getAttribute && t.getAttribute("data-sbq");
    if (q !== null && q !== undefined) {
      const i = Number(q);
      const [A, B] = tjSama(ps);
      if (norm(A[i].tanya) === norm(B[i].tanya)) B[i].tanya = t.value;
      A[i].tanya = t.value;
      tjUbah(ps);
      return true;
    }
    const a = t.getAttribute && t.getAttribute("data-sba");
    if (a !== null && a !== undefined) {
      const i = Number(a);
      const [A, B] = tjSama(ps);
      (Number(t.getAttribute("data-sk")) ? B : A)[i].jawab = t.value;
      tjUbah(ps);
      segarAsalTampil();
      return true;
    }
    return false;
  }
  function saatUbah(e) {
    const t = e.target;
    const skKunci = t.getAttribute && t.getAttribute("data-skkunci");
    if (skKunci) return ubahPilSaksi(skKunci, t.getAttribute("data-skfld"), t);
    const bunyiKode = t.getAttribute && t.getAttribute("data-bunyi");
    if (bunyiKode) {
      // Bunyi dipilih petugas: itu tindakan manusia (dihitung ketikan), disimpan lewat jalur simpan yang sama.
      const o = (S.bunyi[bunyiKode] || [])[Number(t.value)];
      if (!o || !bolehTulis()) return;
      S.diketik.add(bunyiKode);
      void jadwalkanSimpan(bunyiKode, o.nilai, true);
      renderIsian();
      return;
    }
    const alasanKode = t.getAttribute && t.getAttribute("data-alasan");
    if (alasanKode) {
      // Alasan keputusan (ditolak / tidak dapat diterima) ditulis sesudah titik dua pada nilai keputusan.
      const pl = pilihanTunggalMurni(S.isi[alasanKode], pilihanSahDari(isianBlangko(alasanKode)));
      if (!pl || !bolehTulis()) return;
      const alasanTeks = String(t.value || "").trim();
      void jadwalkanSimpan(alasanKode, alasanTeks ? `${pl}: ${alasanTeks}` : pl, true);
      return;
    }
    const k = t.getAttribute && t.getAttribute("data-k");
    if (k) {
      if (t.type === "date" || t.tagName === "SELECT" || t.closest("#bd-vdaftar")) {
        jadwalkanSimpan(k, t.value, true);
        if (t.tagName === "SELECT") renderStatusIsian(k);
        // Keputusan tuntutan berubah: kartu lain (tampil/tersembunyi menurut keputusan) dan kotak alasan mengikuti.
        if (t.tagName === "SELECT" && t.getAttribute("data-keputusan")) renderIsian();
      }
      return;
    }
    const noEl = t.getAttribute && t.getAttribute("data-benomori");
    if (noEl) {
      elPihak(noEl).nomori = t.checked;
      simpanBukti(noEl, true);
      segarBuktiEl(noEl);
      return;
    }
    const be = t.getAttribute && t.getAttribute("data-be");
    if (be) {
      const [w, i] = be.split(".");
      const r = elPihak(w).butir[Number(i)];
      if (r) {
        const isi = t.getAttribute("data-isi");
        r[isi] = t.type === "checkbox" ? t.checked : t.tagName === "SELECT" && (isi === "meterai" || isi === "periksa") ? Number(t.value) : t.value;
        simpanBukti(w, true);
        segarBuktiEl(w);
      }
      return;
    }
    const bk = t.getAttribute && t.getAttribute("data-bk");
    if (bk !== null && bk !== undefined) {
      const [w, i] = bk.split(".");
      const r = S.bukti[w] && S.bukti[w][Number(i)];
      if (r) {
        const isi = t.getAttribute("data-isi");
        r[isi] = t.tagName === "SELECT" ? Number(t.value) : t.value;
        simpanBukti(w, true);
      }
      return;
    }
    if (t.getAttribute && t.getAttribute("data-fmt")) {
      // Hanya keterangan yang diperbarui: pengingat yang sedang tampil (Isi dulu / Tetap cetak) tidak boleh hilang.
      S.fmt[t.getAttribute("data-fmt")] = t.checked;
      const dok = daftarFmt();
      const st = cari("#bd-statuscetak", wadah.cetak);
      if (st) st.textContent = dok.length ? `Akan menerbitkan: ${dok.join(", ")}.` : "Pilih minimal satu hasil cetak.";
      if (dok.length) jadwalkanSiapNaskah("niat");
      return;
    }
    if (t.getAttribute && t.getAttribute("data-ttd")) {
      S.ttdManual = true;
      if (t.checked) S.ttdPilih.add(t.getAttribute("data-ttd"));
      else S.ttdPilih.delete(t.getAttribute("data-ttd"));
      const b = cari("#bd-btnttd", wadah.cetak);
      if (b) b.textContent = `Tambah tanda tangan${S.ttdPilih.size ? ` (${S.ttdPilih.size})` : ""} ▾`;
      const st = cari("#bd-statuscetak", wadah.cetak);
      if (st) st.textContent = `Akan menerbitkan: ${daftarFmt().join(", ")}.`;
      return;
    }
    if (t.id === "bd-unggahputusan") {
      const f = t.files && t.files[0];
      t.value = ""; // berkas yang sama boleh dipilih lagi
      return void (f && terimaUnggahan(f));
    }
    if (t.id === "bd-ttdfile" && t.files && t.files[0]) return void simpanTtdSendiri(t.files[0]).catch((x) => toast(`Gambar tidak terbaca: ${String((x && x.message) || x)}`));
  }
  function saatBlur(e) {
    const t = e.target;
    const k = t.getAttribute && t.getAttribute("data-k");
    if (!k || t.type === "date" || t.tagName === "SELECT") return;
    // Fokus yang sekadar lewat (Tab, klik) tidak menulis apa pun ke ABT - hanya yang diketik.
    if (!S.diketik.has(k)) return;
    S.diketik.delete(k);
    const nilai = t.value;
    const lama = S.nilai[k] ? String(S.nilai[k].teks || "") : "";
    if (nilai === lama || (!nilai.trim() && !lama.trim())) return;
    void jadwalkanSimpan(k, nilai, true);
  }
  function saatTombol(e) {
    const t = e.target;
    // Kotak blangko di langkah 2: Enter atau Spasi membuka pemilih blangko (sama dengan klik dua kali).
    if (t && t.id === "bd-blringkas" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      return bukaModal();
    }
    const k = t.getAttribute && t.getAttribute("data-k");
    if (k) {
      const b = S.susunan && S.susunan.isian.find((x) => x.kode === k);
      const sr = b ? saranUntuk(b) : "";
      if (e.key === "Tab" && !e.shiftKey && !t.value && sr && cfg().saran && t.type !== "date") {
        e.preventDefault();
        t.value = sr;
        jadwalkanSimpan(k, sr, true);
        const f = cari(`.bd-f[data-f="${k}"]`, wadah.isian);
        if (f) f.classList.add("beres");
        renderProgres();
        toast(`Saran dipakai: ${b.nama}. Tekan Tab lagi untuk pindah.`);
        return;
      }
      if (e.key === "ArrowDown" && b && b.pilihan && b.pilihan.length) {
        e.preventDefault();
        S.menuSaran = k;
        renderIsian();
        const o = cari(`[data-ambil="${k}"]`, wadah.isian);
        if (o) o.focus();
        return;
      }
    }
    if (e.key === "Escape") {
      if (S.modal) tutupModal();
      tutupSumber();
      tutupPopTtd();
      if (S.menuSaran) {
        S.menuSaran = null;
        renderIsian();
      }
    }
  }
  function saatTunjuk(e) {
    const el = e.target.closest && e.target.closest(".bd-sumber");
    if (!el) return;
    // Tip tema ALETA menggantikan tip bawaan peramban: title disimpan sementara supaya tidak muncul dua tip.
    if (el.hasAttribute("title")) {
      el.setAttribute("data-judul", el.getAttribute("title") || "");
      el.removeAttribute("title");
    }
    if (el.getAttribute("aria-expanded") === "true") return;
    const tip = cari("#bd-tip", wadah.akar);
    const id = el.getAttribute("data-sumber");
    const umum = INFO_UMUM[id];
    const it = umum ? null : itemSumber(id);
    if (!tip || (!it && !umum)) return;
    const ket = umum ? [umum.teks] : ketItem(it);
    tip.innerHTML =
      (ket.length ? `<span class="bd-tipket">${esc(ket.join(" "))}</span>` : "") +
      (it ? `${ket.length ? "<br>" : ""}<b>Sumber isian</b>: ${esc(sumberDaftar(it).map((x) => x.nama.toLowerCase()).join(", "))}` : "") +
      `<br><small>Klik untuk keterangannya</small>`;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const w = Math.min(tip.offsetWidth || 260, vw - 16);
    tip.style.left = `${Math.max(8, Math.min(r.left, vw - w - 8))}px`;
    tip.style.top = `${r.bottom + 6}px`;
  }
  function saatLepas(e) {
    const el = e.target.closest && e.target.closest(".bd-sumber");
    const tip = cari("#bd-tip", wadah.akar);
    if (el && el.hasAttribute("data-judul")) {
      el.setAttribute("title", el.getAttribute("data-judul") || "");
      el.removeAttribute("data-judul");
    }
    if (el && tip) tip.hidden = true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan ke kerangka
  // ──────────────────────────────────────────────────────────────────────────
  function pasangWadah() {
    const a = api();
    if (!a || S.terpasang) return S.terpasang;
    const w = {
      blangko: a.wadah("pilih-blangko"),
      isian: a.wadah("perlu-diisi"),
      pratinjau: a.wadah("pratinjau"),
      cetak: a.wadah("cetak"),
    };
    if (!w.blangko || !w.isian || !w.pratinjau || !w.cetak) return false;
    Object.assign(wadah, w);
    wadah.akar = w.blangko.closest("#aleta-bd-akar") || document.body;
    for (const n of ["pilih-blangko", "perlu-diisi", "pratinjau", "cetak"]) if (typeof a.tahapSiap === "function") a.tahapSiap(n);
    const kepalaIsian = w.isian.closest(".bd-tahap") && w.isian.closest(".bd-tahap").querySelector(".bd-tk");
    if (kepalaIsian && !kepalaIsian.querySelector("#bd-progres")) kepalaIsian.insertAdjacentHTML("beforeend", `<span class="bd-progres" id="bd-progres"></span>`);
    if (!cari("#bd-modal", wadah.akar)) {
      wadah.akar.insertAdjacentHTML("beforeend", `<div class="bd-modal" id="bd-modal" hidden role="dialog" aria-modal="true" aria-label="Pilih blangko"></div><div class="bd-float lebar" id="bd-popsumber" hidden role="dialog" aria-label="Sumber isian"></div>`);
    }
    wadah.akar.addEventListener("click", saatKlik);
    wadah.akar.addEventListener("dblclick", saatKlikDua);
    wadah.akar.addEventListener("input", saatMasuk);
    wadah.akar.addEventListener("change", saatUbah);
    wadah.akar.addEventListener("focusout", saatBlur);
    wadah.akar.addEventListener("keydown", saatTombol);
    wadah.akar.addEventListener("mouseover", saatTunjuk);
    wadah.akar.addEventListener("mouseout", saatLepas);
    wadah.akar.addEventListener("focusin", saatTunjuk);
    wadah.akar.addEventListener("focusout", saatLepas);
    S.terpasang = true;
    renderRingkasBlangko();
    renderIsian();
    renderPratinjau();
    renderCetak();
    return true;
  }
  /**
   * Melepas SEMUA keadaan blangko perkara sebelumnya (blangko terpilih, isian, saran, pratinjau, tautan). Dipakai saat perkara berganti
   * dan saat PERAN yang berlaku berganti (20 Okt 2026): pilihan blangko milik peran lain - BAS panitera pengganti vs putusan hakim -
   * tidak boleh terbawa; saran dihitung ulang menurut peran yang sekarang.
   */
  function lepasBlangkoPerkara() {
    if (BK()) BK().tutup();
    if (S.modal) {
      S.modal = null;
      const m = wadah && wadah.akar ? cari("#bd-modal", wadah.akar) : null;
      if (m) m.hidden = true;
    }
    S.blangko = null;
    S.susunan = null;
    S.galatSusunan = "";
    S.isi = {};
    S.diketik.clear();
    otoTulis.clear();
    jejakTerakhir.clear();
    S.tesIsian = {};
    S.nilai = {};
    S.tersimpan = {};
    S.saran = {};
    S.saranSipp = {};
    S.belajar8503 = null;
    S.isianSidang = null;
    S.info = {};
    S.bunyi = {};
    S.bahanSaksi = null;
    S.dariSipp = new Set();
    S.tautan = null;
    S.isiSipp = { jalan: false, ulang: false, kunci: "", hasil: null };
    S.el7 = null;
    S.el7Saran = null;
    S.saranH7 = {}; // F4.2: saran draf H-7 milik perkara sebelumnya tidak terbawa.
    S.bukti = { P: null, T: null };
    S.buktiEl = { P: null, T: null };
    S.buktiElBuka = {};
    S.buktiOto = {};
    S.tj = {};
    S.tjBuka = null;
    S.semua = null;
    S.semuaBuka = false;
    S.prat = { terbuka: false, memuat: false, rtf: null, html: "", galat: "", suntingPenuh: false, kotor: true, penanda: [] };
    S.peringat = false;
    S.ttdPilih = new Set();
    S.log = [];
    S.tampilTakBerlaku = false;
    S.tandaKosong = new Set();
  }
  const kunciPeranSekarang = () => {
    const a = api();
    return a && typeof a.peranKunci === "function" ? String(a.peranKunci() || "") : "";
  };
  /** Peran berubah sejak blangko dipilih: pilihan dibuang. Benar bila ada yang dibuang. */
  function selaraskanPeran() {
    const b = S.blangko;
    if (!b || !b.peranKunci) return false;
    const sekarang = kunciPeranSekarang();
    if (!sekarang || sekarang === b.peranKunci) return false;
    lepasBlangkoPerkara();
    return true;
  }
  function saatPerkara(e) {
    const d = e && e.detail;
    if (!pasangWadah()) return;
    const sebelum = S.pk;
    S.pk = d || null;
    if (d && !d.perkara && S.api && typeof S.api.perkaraTerpilih === "function") {
      // Kerangka lama tidak menyertakan objek perkara di peristiwa: diambil dari api.
      const t = S.api.perkaraTerpilih();
      if (t && t.perkara && t.perkara.nomorPerkara === d.nomorPerkara) S.pk.perkara = t.perkara;
    }
    // Peran berganti (admin memilih "Lihat sebagai" lain) = keadaan baru walau perkaranya sama.
    const gantiPeran = Boolean(d && sebelum && d.peranKunci && sebelum.peranKunci && d.peranKunci !== sebelum.peranKunci);
    const gantiPerkara = !d || !sebelum || sebelum.perkaraId !== d.perkaraId || gantiPeran;
    const gantiSidang = !gantiPerkara && sebelum && (sebelum.sidangKe !== d.sidangKe);
    if (gantiPerkara) {
      lepasBlangkoPerkara();
      if (d) {
        void bacaPenyimpanan(null).then((s) => {
          for (const [k, v] of Object.entries(s || {})) if (k.startsWith(`${K_CETAK}:${d.nomorPerkara}|`)) S.cetakTercatat[k.slice(K_CETAK.length + 1)] = v;
          renderCetak();
        });
      }
    } else if (gantiSidang) {
      // Isian teks/tanggal berkunci perkara (tetap); keterangan saksi dan naskah ikut sidang.
      S.tj = {};
      S.tjBuka = null;
      S.tjOto = {};
      tandaiKotor();
      // JJ2: sidang lain = tujuan penulisan lain; berkas yang rapi ditulis bila sidang ini agendanya sesuai dan barisnya kosong.
      if (S.susunan) void isiJawabMenjawabOtomatis(S.susunan);
      // 19 Okt: ganti sidang = isian yang datanya berubah per sidang diisi ulang (yang sudah ada isinya tidak ditimpa).
      if (S.susunan && cfg().isiOto !== false) void isiOtomatisBlangko(S.susunan, { sidang: true });
      S.isianSidang = null;
      if (S.blangko && S.blangko.jenis === "bas") {
        const perSidang = Boolean(JI() && typeof JI().aktifSidangSegera === "function" && JI().aktifSidangSegera() === true);
        toast(`Sidang diganti ke ke-${sidangUrutan()}: tanya jawab saksi dan naskah mengikuti sidang ini; ${perSidang ? "isian ketikan BAS mengikuti sidang ini (tersimpan per sidang)." : "isian ketikan tetap milik perkara."}`);
        if (perSidang) void muatIsianSidang().then(() => renderIsian());
      }
    }
    renderRingkasBlangko();
    renderIsian();
    renderPratinjau();
    renderCetak();
    if (d && S.menu === null) void muatMenu();
    if (d && !S.blangko) {
      // Saran blangko butuh daftar berkas kelompok yang disarankan.
      void muatMenu().then(async () => {
        if (!S.menu || S.pk !== d) return;
        const rek = rekomendasi();
        for (const r of rek) {
          const k = S.menu.kelompok.find((x) => x.nama === r.kelompok);
          if (k && !k.berkas) await muatBerkasKelompok(k);
        }
        if (S.pk === d && !S.blangko) renderRingkasBlangko();
      });
    }
  }
  function daftarkanAlat() {
    const a = api();
    if (!a || typeof a.daftarkanAlat !== "function") return;
    a.daftarkanAlat("gugatan", () => (S.susunan ? pakaiSemuaSaran() : toast("Pilih blangko dulu.")));
    a.daftarkanAlat("saksi", () => {
      const it = daftarPerlu().find((x) => x.jenis === "tj");
      if (!it) return toast(S.blangko ? "Blangko ini tidak memakai tanya jawab saksi." : "Pilih blangko dulu.");
      void bukaTj(it.tj.kunci);
    });
    a.daftarkanAlat("ktp", () => (S.susunan ? void ambilTanggalKtp() : toast("Pilih blangko dulu.")));
    a.daftarkanAlat("cek", () => {
      if (!S.susunan) return toast("Pilih blangko dulu.");
      const k = kosongDaftar();
      toast(k.length ? `Belum lengkap: ${k.length} isian kosong (${k.slice(0, 4).join(", ")}${k.length > 4 ? ", …" : ""}).` : "Semua isian terisi. Tekan Cetak untuk memeriksa penanda naskah.");
    });
    a.daftarkanAlat("unggah", () => {
      if (tes()) return toast(PESAN_TES);
      if (!S.blangko) return toast("Pilih blangko dulu.");
      if (S.blangko.jenis !== "put") return toast("Unggah e-Doc dari sini hanya untuk putusan; BAS dan relaas diunggah lewat SIPP.");
      S.fmt.edoc = true;
      renderCetak();
      void cetak(false);
    });
    a.daftarkanAlat("putusanOto", () => {
      if (!S.pk) return toast("Pilih perkara dulu.");
      const r = rekomendasi().find((x) => x.jenis === "put");
      if (!r) return toast("Sidang ini belum putus, jadi putusan belum bisa disusun. Pilih blangko lewat Pilih blangko.");
      const k = S.menu && S.menu.kelompok.find((x) => x.nama === r.kelompok);
      if (!k || !k.berkas) return bukaModal();
      void pilihBlangko(r.berkas, k.nama).then(() => {
        pakaiSemuaSaran();
        S.prat.terbuka = true;
        renderPratinjau();
        void muatPratinjau(true);
      });
    });
  }
  function mulai() {
    const a = globalThis.aletaBlangkoDerry;
    if (!a) return false;
    S.api = a;
    // Sambungan Tahap E: saran blangko dari portal (jadwal sidang ?rekomendasi=1) lewat titik sambung kerangka.
    if (typeof a.pasangRekomendasi === "function") a.pasangRekomendasi(rekomendasiPortal);
    // 28 Okt 2026: pengukur kelengkapan isian di latar untuk lencana di daftar perkara (hanya membaca).
    if (typeof a.pasangPengukur === "function") a.pasangPengukur(ukur.ukurSatu);
    document.addEventListener("aleta-bd-buka-isian", saatBukaIsian);
    document.addEventListener("aleta-bd-perkara", saatPerkara);
    document.addEventListener("aleta-bd-tautan", saatTautan);
    daftarkanAlat();
    const ada = typeof a.perkaraTerpilih === "function" ? a.perkaraTerpilih() : null;
    if (ada && ada.perkara) saatPerkara({ detail: { nomorPerkara: ada.perkara.nomorPerkara, perkaraId: ada.perkara.perkaraId, jenisPerkara: ada.perkara.jenisPerkara, sidang: ada.sidang, sidangKe: ada.sidangKe, sidangDipilih: ada.sidangDipilih, perkara: ada.perkara } });
    else pasangWadah();
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CETAK MASSAL - pengemudi (20 Okt 2026)
  // ──────────────────────────────────────────────────────────────────────────
  // blangko-derry-massal.js memakai mesin satu-perkara ini BERULANG, satu perkara sekali: perkara dibuka seperti dipilih di langkah 1,
  // blangko dipilih lewat pilihBlangko (hak buka diperiksa ke ABT lebih dulu), isian terisi otomatis lewat jalur yang sama dengan ketikan
  // (tidak menimpa yang sudah ada isinya), lalu naskah diambil lewat ambilRtf (header penanda dan penutup putusan dibersihkan) dan
  // PDF dibuat lewat pdfDari/rtfDenganTtd - jalur yang SAMA dengan langkah 5 Cetak. Tidak ada jalur tulis baru: isian ke ABT hanya
  // lewat simpanIsian; tidak ada yang ditulis ke SIPP.
  const massal = (() => {
    const BATAS_SIAP_MS = 150000;
    const tanpaRtf = (s) => String(s || "").replace(/\.rtf$/i, "").trim();
    const biner = (naskah) => (typeof naskah === "string" ? new Uint8Array(bufDariLatin1(naskah)) : new Uint8Array(naskah));
    const tungguMaks = (janji, ms, pesan) => {
      let jam;
      return Promise.race([janji, new Promise((_, tolak) => (jam = setTimeout(() => tolak(new Error(pesan)), ms)))]).finally(() => clearTimeout(jam));
    };
    /** Item daftar massal -> detail perkara seperti peristiwa aleta-bd-perkara (kerangka). Sidang yang dipilih ditambahkan bila belum ada. */
    function pkDariItem(it) {
      const p = it.perkara || {};
      const sid = Array.isArray(p.sidang) ? p.sidang.slice() : [];
      const dipilih = it.sidang || sid[0] || null;
      let idx = dipilih ? sid.findIndex((x) => (dipilih.sidangId && x.sidangId === dipilih.sidangId) || (!dipilih.sidangId && x.tanggal === dipilih.tanggal)) : -1;
      if (idx < 0) {
        idx = sid.length;
        if (dipilih) sid.push(dipilih);
      }
      return {
        nomorPerkara: String(it.nomor || p.nomorPerkara || ""),
        perkaraId: String(it.perkaraId || p.perkaraId || ""),
        jenisPerkara: String(p.jenisPerkara || it.jenisPerkara || ""),
        sidang: sid,
        sidangKe: Math.max(0, idx),
        sidangDipilih: dipilih,
        perkara: p,
        ...(it.urutanPaksa !== undefined && it.urutanPaksa !== null ? { urutanPaksa: Number(it.urutanPaksa) || 0 } : {}),
      };
    }
    /** Ketikan yang belum tersimpan (perkara yang sedang dibuka petugas) dituntaskan sebelum perkara diganti. */
    async function siramSimpan() {
      if (!S.blangko || !S.pk) return;
      for (const kode of Array.from(S.diketik)) {
        try {
          await simpanIsian(kode, S.isi[kode]);
        } catch {
          /* gagal tersimpan: ketikan itu tetap dilaporkan lewat status isian */
        }
        S.diketik.delete(kode);
      }
    }
    async function menu(jenis) {
      await muatMenu();
      await muatIndeks();
      if (jenis) await muatSemuaKelompok(jenis);
      return (S.menu ? S.menu.kelompok : [])
        .filter((k) => (!jenis || k.jenis === jenis) && kelompokBoleh(k))
        .map((k) => ({ nama: k.nama, judul: k.judul || namaMenuTampil(k.nama), jenis: k.jenis, berkas: (k.berkas || []).map((b) => b.berkas) }));
    }
    /** Satu kali baca jadwal sidang sehari (rute portal yang sama dengan saran di langkah 2) mengisi singgahan saran untuk semua perkara. */
    async function muatSaranTanggal(tanggal) {
      try {
        const d = await ambilPortal(`${API_SIDANG_PORTAL}?dari=${tanggal}&sampai=${tanggal}&cari=&batas=400&rekomendasi=1`, {}, "Membaca saran blangko");
        for (const b of (d && d.sidang) || []) {
          const nomor = String((b && b.nomorPerkara) || "").trim();
          if (!nomor) continue;
          rekPortal.set(`${nomor}|${String(b.tanggalSidang || tanggal).slice(0, 10)}|${String(b.sidangId || "")}`, { status: "siap", hasil: b.rekomendasiBlangko || null, saat: Date.now() });
        }
        return true;
      } catch {
        return false;
      }
    }
    /** Saran blangko mesin Derry untuk satu item menurut jenisnya: [{ berkas, kelompok, jenis, alasan }]. */
    function saran(it, jenis) {
      const lama = S.pk;
      S.pk = pkDariItem(it);
      try {
        return rekomendasiJenis(jenis).map((r) => ({ berkas: tanpaRtf(r.berkas), kelompok: r.kelompok, jenis: r.jenis, alasan: r.alasan }));
      } finally {
        S.pk = lama;
      }
    }
    function keadaan() {
      const kos = kosongRinci();
      const penting = kos.filter((x) => x.tingkat !== "tambahan");
      const ragu = Object.keys(S.saranSipp).filter((k) => !String(S.isi[k] || "").trim() && daftarPerlu().some((b) => b.kode === k)).length;
      const gagalSimpan = Object.values(S.tersimpan).filter((v) => String(v).startsWith("gagal")).length;
      const h = S.susunan ? hitung() : { a: 0, t: 0 };
      return { terisi: h.a, total: h.t, kosongPenting: penting.map((x) => x.nama), kosongTambahan: kos.length - penting.length, ragu, gagalSimpan, penandaSisa: S.prat.penanda ? S.prat.penanda.length : 0 };
    }
    /** Membuka perkara + blangko item dan menunggu isiannya siap; isiOto = jalankan "Isi otomatis semua" (tidak menimpa). */
    async function siapkan(it, opsi) {
      const o = opsi || {};
      const jalan = async () => {
        saatPerkara({ detail: pkDariItem(it) });
        if (!S.pk) throw new Error("Perkara tidak dapat dibuka.");
        await muatMenu();
        await muatIndeks();
        const k = S.menu && S.menu.kelompok.find((x) => x.nama === it.kelompok);
        if (!k) throw new Error(`Menu blangko "${it.kelompok}" tidak ada di ABT akun ini.`);
        if (!k.berkas) await muatBerkasKelompok(k);
        const b = k.berkas && k.berkas.find((x) => tanpaRtf(x.berkas) === tanpaRtf(it.berkas));
        if (!b) throw new Error(`Blangko "${tanpaRtf(it.berkas)}" tidak ditemukan di menu ${namaMenuTampil(k.nama)}.`);
        await pilihBlangko(b.berkas, k.nama);
        if (!S.blangko || S.blangko.berkas !== b.berkas) throw new Error("Blangko tidak dapat dibuka untuk akun ini.");
        if (S.blangko.hak !== "ok") throw new Error(S.galatSusunan || "ABT tidak mengizinkan blangko ini untuk perkara ini.");
        if (!S.susunan) throw new Error(S.galatSusunan || "Isian blangko tidak terbaca.");
        // Pekerjaan otomatis yang dimulai pilihBlangko (bawaan itsbat, e-litigasi, bacaan SIPP, jawab menjawab, bukti) dituntaskan dulu.
        for (let putaran = 0; putaran < 6; putaran += 1) {
          await Promise.allSettled([S.janjiBukti, ...Array.from(kerjaOto)]);
          if (!kerjaOto.size && !S.isiSipp.jalan) break;
          if (S.isiSipp.jalan) await new Promise((r) => setTimeout(r, 120));
        }
        // "Isi otomatis semua": hanya bacaan SIPP/e-Court yang pasti atau cukup (isian kosong; tidak menimpa). Saran yang masih ragu TIDAK
        // ditulis massal - perkara itu ditandai "Perlu dicek" supaya petugas memeriksanya sendiri.
        if (o.isiOto) await isiOtomatisBlangko(S.susunan, { manual: true, senyap: true });
        return keadaan();
      };
      return tungguMaks(jalan(), BATAS_SIAP_MS, "Waktu habis saat menyiapkan perkara ini.");
    }
    /**
     * Menyiapkan lalu mengambil naskah satu item. opsi: { pdf, ttd, isiOto }. Pulang { rtf: Uint8Array, pdf: Uint8Array|null,
     * namaRtf, namaPdf, keadaan, ttd:{ dipasang, tidakDitemukan, gagal } }. Melempar bila perkara/blangko/naskah tidak dapat diambil.
     */
    async function cetakSatu(it, opsi) {
      const o = opsi || {};
      const k0 = await siapkan(it, { isiOto: o.isiOto });
      // D6: BAS sidang tertentu -> isian sidang itu dipakai sementara di ABT hanya selama naskah diambil.
      const pulihSidang = await terapkanIsianSidang();
      let rtf;
      try {
        rtf = await tungguMaks(ambilRtf(true), BATAS_LAMA_MS, "Waktu habis saat meminta naskah dari ABT.");
      } finally {
        if (pulihSidang) await pulihSidang();
      }
      const keadaanAkhir = { ...k0, ...keadaan() };
      const nomor = nomorPerkara();
      const berkas = S.blangko.berkas;
      const hasil = { rtf: biner(rtf), pdf: null, namaRtf: namaUnduhan(nomor, berkas, "rtf"), namaPdf: namaUnduhan(nomor, berkas, "pdf"), keadaan: keadaanAkhir, ttd: { dipasang: [], tidakDitemukan: [], gagal: [] } };
      if (o.pdf) {
        if (o.ttd) {
          S.ttdManual = false;
          await autoCentangTtd();
        } else S.ttdPilih = new Set();
        const { h: hp, t } = await pdfBiasaDenganTtd(rtf);
        hasil.pdf = hp.bita;
        hasil.ttd = { dipasang: t.dipasang || [], tidakDitemukan: t.tidakDitemukan || [], gagal: t.gagal || [] };
      }
      if (!tes()) {
        const jam = jamSekarang();
        S.cetakTercatat[`${nomor}|${S.blangko.jenis}`] = jam;
        void tulisPenyimpanan({ [`${K_CETAK}:${nomor}|${S.blangko.jenis}`]: jam });
        laporCetakWajib();
      }
      return hasil;
    }
    /** Keadaan layar petugas sebelum massal, dipulihkan sesudahnya (perkara + blangko yang tadi terbuka). */
    function potret() {
      return { pk: S.pk, blangko: S.blangko ? { berkas: S.blangko.berkas, kelompok: S.blangko.kelompok } : null };
    }
    async function pulihkan(p) {
      if (!p) return;
      try {
        saatPerkara({ detail: p.pk || null });
        if (p.pk && p.blangko) {
          await muatMenu();
          await pilihBlangko(p.blangko.berkas, p.blangko.kelompok);
        }
      } catch {
        /* pemulihan gagal: petugas memilih ulang perkara dari langkah 1 */
      }
    }
    return {
      jenisBoleh: () => jenisBoleh().slice(),
      pkDariItem,
      adm,
      namaPeran: (j) => NAMA_PERAN[JENIS_PERAN[j]] || "",
      namaJenis: (j) => NAMA_JENIS[j] || "",
      peranAkun: () => peranAkun().slice(),
      menu,
      muatSaranTanggal,
      saran,
      siapkan,
      cetakSatu,
      siramSimpan,
      potret,
      pulihkan,
      pdfDari,
      unduh,
      namaUnduhan,
      ambilPortal,
      tanpaRtf,
      namaTampil,
    };
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // UKUR KELENGKAPAN ISIAN DI LATAR (28 Okt 2026)
  // ──────────────────────────────────────────────────────────────────────────
  // Lencana "Kelengkapan isian" di daftar perkara (blangko-derry.js) dulu hanya berisi angka sesudah perkara dibuka di langkah Isian. Kini
  // daftar meminta pengukuran perkara-perkara yang tampil lewat pengukur ini, satu perkara sekali, HANYA MEMBACA:
  //   1. blangko yang diukur = blangko yang pernah dibuka petugas untuk perkara itu (`ingat`), bila tidak ada saran utama portal untuk
  //      sidang acuannya menurut jenis dokumen peran; tanpa keduanya: "tanpa-blangko" (daftar menulis "Blangko belum dipilih");
  //   2. susunan isian + nilai ABT dibaca lewat rute portal yang sama dengan langkah Isian (nilai dibaca bot; bila bot tidak menjawab
  //      perkara ini dilewati, tidak ada penyapuan jendela ABT satu per satu);
  //   3. isian wajib yang terisi dihitung dengan aturan yang SAMA dengan hitung() (golongan "utama": keadaan berlaku, tuntutan
  //      diminta, bawaan/kerangka bukan isian) pada keadaan kosong. Isian otomatis dari SIPP dan daftar bukti baru terhitung sesudah
  //      perkara dibuka (hasilnya ditandai `perkiraan` bila ada bukti).
  // Tidak ada yang ditulis ke ABT, SIPP, atau e-Court. Hasil `ok` -> { a, t, blangko, perkiraan }.
  const ukur = (() => {
    const janjiTanggal = new Map();
    const jeda = (ms) => new Promise((r) => setTimeout(r, ms));
    /** Saran portal untuk sidang acuan perkara itu: satu baca jadwal per tanggal mengisi saran semua perkara hari itu. */
    async function saranUtama(pk, jenis) {
      const k = kunciSidangSaran({ nomorPerkara: pk.nomorPerkara, sidangDipilih: pk.sidangDipilih });
      if (!k) return { saran: null };
      let c = rekPortal.get(k.kunci);
      if (!c || c.status === "galat") {
        if (!janjiTanggal.has(k.tanggal)) janjiTanggal.set(k.tanggal, massal.muatSaranTanggal(k.tanggal).finally(() => janjiTanggal.delete(k.tanggal)));
        await janjiTanggal.get(k.tanggal);
        c = rekPortal.get(k.kunci);
        if (!c || c.status !== "siap") {
          // Sidang itu tidak ada di jadwal harian (mis. lewat batas baris): baca satu perkara itu saja.
          await muatSaranPortal(k);
          c = rekPortal.get(k.kunci);
        }
      }
      for (let i = 0; c && c.status === "memuat" && i < 100; i += 1) {
        await jeda(150);
        c = rekPortal.get(k.kunci);
      }
      if (!c || c.status !== "siap") return { galat: true };
      const s = pk.sidangDipilih || {};
      const urutan = Number(s.urutan) > 0 ? Number(s.urutan) : (Number(pk.sidangKe) || 0) + 1;
      const saran = saranDariPortal(c.hasil, S.menu.kelompok, { jenis: [jenis], urutan }).filter((r) => r.jenis === jenis && r.kelompok);
      const utama = saran.find((r) => r.utama);
      return { saran: utama || null };
    }
    /** Menghitung kartu "Perlu diisi" susunan d pada perkara pk dengan keadaan layar kosong (pemanggil langsung, tanpa jeda di antaranya). */
    function hitungKosongLayar(d, pk) {
      const simpan = { pk: S.pk, susunan: S.susunan, nilai: S.nilai, isi: S.isi, bukti: S.bukti, tj: S.tj, tersimpan: S.tersimpan, tampil: S.tampilTakBerlaku };
      try {
        S.pk = pk;
        S.susunan = d;
        S.nilai = d.nilai && typeof d.nilai === "object" ? d.nilai : {};
        S.isi = {};
        S.bukti = { P: null, T: null };
        S.tj = {};
        S.tersimpan = {};
        S.tampilTakBerlaku = false;
        for (const b of d.isian) {
          const v = S.nilai[b.kode];
          if (v && v.status === "terisi" && b.jenis !== "tj" && !daftarPilihanMurni(b, v.teks)) S.isi[b.kode] = b.jenis === "tanggal" ? keIso(v.teks) || v.teks : v.teks;
        }
        const h = hitung();
        return { a: h.a, t: h.t, perkiraan: daftarPerlu().some((b) => b.khusus === "bukti") };
      } finally {
        S.pk = simpan.pk;
        S.susunan = simpan.susunan;
        S.nilai = simpan.nilai;
        S.isi = simpan.isi;
        S.bukti = simpan.bukti;
        S.tj = simpan.tj;
        S.tersimpan = simpan.tersimpan;
        S.tampilTakBerlaku = simpan.tampil;
      }
    }
    async function ukurSatu(job) {
      if (tes()) return { status: "lewati" };
      const p = job && job.p;
      const jenis = job && job.jenis;
      if (!p || !p.perkaraId || !jenis) return { status: "galat" };
      await muatMenu();
      await muatIndeks();
      if (!S.menu || !S.menu.kelompok.length) return { status: "galat" };
      const pk = massal.pkDariItem({ nomor: p.nomorPerkara, perkaraId: p.perkaraId, perkara: p, sidang: job.s });
      // 1. Blangko yang diukur.
      let berkas = "";
      let kelompok = null;
      const ingat = job.ingat;
      if (ingat && ingat.berkas) {
        const k = S.menu.kelompok.find((x) => x.nama === ingat.kelompok);
        if (k && k.jenis === jenis && kelompokBoleh(k)) {
          berkas = ingat.berkas;
          kelompok = k;
        }
      }
      if (!kelompok) {
        const { saran, galat } = await saranUtama(pk, jenis);
        if (galat) return { status: "galat" };
        const k = saran && S.menu.kelompok.find((x) => x.nama === saran.kelompok);
        if (!saran || !k || !kelompokBoleh(k)) return { status: "tanpa-blangko" };
        berkas = saran.berkas;
        kelompok = k;
      }
      if (!kelompok.berkas) await muatBerkasKelompok(kelompok);
      // Pemuatan kelompok yang sama dari pengukuran lain (atau tahap lain) ditunggu sampai selesai.
      for (let i = 0; i < 100 && !kelompok.berkas && kelompok.memuat; i += 1) await jeda(100);
      const asli = kelompok.berkas && kelompok.berkas.find((b) => samaBerkasSaran(b.berkas, berkas));
      if (!asli) return { status: "tanpa-blangko" };
      const folder = folderUntuk(kelompok);
      if (!folder) return { status: "galat" };
      const blangko = { berkas: asli.berkas, kelompok: kelompok.nama, judul: kelompok.judul || namaMenuTampil(kelompok.nama), folder, jenis: kelompok.jenis };
      // 2. Susunan isian + nilai ABT (alamat dibuat dengan perkara ini; S.pk dipulihkan sebelum ada jeda).
      const lama = S.pk;
      let alamat;
      try {
        S.pk = pk;
        alamat = alamatSusunan(false, blangko);
      } finally {
        S.pk = lama;
      }
      const d = await ambilPortal(alamat, {}, "Mengukur isian blangko");
      if (!d || !d.ada || !Array.isArray(d.isian)) return { status: "galat" };
      if (!d.nilaiAda) return { status: "galat" };
      // 3. Hitung.
      const h = hitungKosongLayar(d, pk);
      return { status: "ok", a: h.a, t: h.t, perkiraan: h.perkiraan, blangko: { berkas: asli.berkas, kelompok: kelompok.nama, judul: blangko.judul } };
    }
    return { ukurSatu, hitungKosongLayar };
  })();

  /** Isian wajib kosong pertama digulir ke tengah layar dan disorot; false bila tidak ada kartu kosong (semua terisi / belum tampil). */
  function gulirKeKosongPertama() {
    if (!wadah.isian) return false;
    const f = cari("#bd-perlu .bd-f:not(.beres):not(.tambahan)", wadah.isian) || cari("#bd-perlu .bd-f:not(.beres)", wadah.isian);
    if (!f) return false;
    const kode = f.getAttribute("data-f");
    if (kode && pasangSorot(kode, true)) return true;
    if (typeof f.scrollIntoView === "function") f.scrollIntoView({ block: "center" });
    return true;
  }
  /**
   * Lencana kelengkapan diklik di daftar (peristiwa "aleta-bd-buka-isian" sesudah perkara dibuka): bila belum ada blangko terpilih,
   * blangko yang diukur dibuka; sesudah isiannya termuat, gulir ke isian wajib kosong pertama.
   */
  async function saatBukaIsian(e) {
    const d = e && e.detail;
    if (!d || !S.pk || S.pk.nomorPerkara !== d.nomorPerkara) return;
    const pk = S.pk;
    try {
      if (!S.blangko && d.blangko && d.blangko.berkas && !tes()) {
        await muatMenu();
        const k = S.menu && S.menu.kelompok.find((x) => x.nama === d.blangko.kelompok);
        if (k && kelompokBoleh(k)) {
          if (!k.berkas) await muatBerkasKelompok(k);
          for (let i = 0; i < 100 && !k.berkas && k.memuat; i += 1) await jedaTautan(100);
          const asli = k.berkas && k.berkas.find((b) => samaBerkasSaran(b.berkas, d.blangko.berkas));
          if (S.pk === pk && !S.blangko && asli) await pilihBlangko(asli.berkas, k.nama);
        }
      }
      for (let i = 0; i < 120 && S.pk === pk && S.blangko && (S.memuatSusunan || !S.susunan) && !S.galatSusunan; i += 1) await jedaTautan(100);
      // Isi otomatis dari SIPP menggambar ulang kartu: ditunggu dulu (paling lama 8 detik) supaya yang disorot benar-benar masih kosong.
      if (S.pk === pk && S.susunan && kerjaOto.size) await Promise.race([Promise.allSettled(Array.from(kerjaOto)), jedaTautan(8000)]);
      if (S.pk === pk && S.susunan && !S.memuatSusunan) {
        await jedaTautan(30);
        gulirKeKosongPertama();
      }
    } catch {
      /* membuka isian hanya kemudahan: perkara sudah terbuka, petugas memilih blangko sendiri */
    }
  }

  const apiIsian = {
    versi: "tahap-F-G",
    mulai,
    pasangRekomendasi(fn) {
      rekomendasiLuar = typeof fn === "function" ? fn : null;
      // Penyedia saran yang datang belakangan: ringkasan di langkah 2 ikut diperbarui.
      if (S.pk && !S.blangko && wadah.blangko) renderRingkasBlangko();
    },
    rekomendasi,
    /** Fungsi yang dipasang ke aletaBlangkoDerry.pasangRekomendasi (saran portal Tahap E). */
    rekomendasiPortal,
    pilihBlangko,
    /** Pengukur kelengkapan isian di latar (28 Okt 2026): ukurSatu({ p, s, jenis, ingat }). */
    ukur,
    gulirKeKosongPertama,
    /** Cetak massal (20 Okt): pengemudi satu-per-satu yang dipakai blangko-derry-massal.js. */
    massal,
    /** F4.2: buka blangko draf H-7 + pasang saran agen (tanpa menyimpan ke ABT). */
    pakaiDrafH7,
    bukaModal,
    cetak,
    /** F4.4 Putusan Advance (putusan-advance.js): RTF naskah blangko terpilih, sama dengan pratinjau/cetak; baca saja. */
    naskahRtf: (paksa) => ambilRtf(paksa),
    /** Cetak cepat: menyiapkan naskah di latar sekarang (sebab "isian" = hanya bila isian lengkap dan tenang, "niat" = petugas hendak mencetak). */
    siapkanNaskah: (sebab) => siapkanNaskah(sebab === "niat" ? "niat" : "isian"),
    /** Memuat daftar berkas satu kelompok Derry (untuk alat luar/uji); pulang [{berkas,a,b}] atau null. */
    async muatKelompok(nama) {
      await muatMenu();
      const k = S.menu && S.menu.kelompok.find((x) => x.nama === nama);
      return k ? muatBerkasKelompok(k) : null;
    },
    keadaan: () => ({
      terpasang: S.terpasang,
      pk: S.pk ? { nomorPerkara: S.pk.nomorPerkara, perkaraId: S.pk.perkaraId, sidangKe: S.pk.sidangKe } : null,
      blangko: S.blangko ? { ...S.blangko } : null,
      modal: S.modal ? { ...S.modal } : null,
      susunan: S.susunan,
      isi: { ...S.isi },
      tersimpan: { ...S.tersimpan },
      saran: { ...S.saran },
      saranSipp: { ...S.saranSipp },
      dariSipp: Array.from(S.dariSipp),
      isiSipp: { jalan: S.isiSipp.jalan, hasil: S.isiSipp.hasil ? { ...S.isiSipp.hasil } : null },
      saranH7: { ...(S.saranH7 || {}) },
      nilai: { ...S.nilai },
      bukti: { P: S.bukti.P ? S.bukti.P.map((r) => ({ ...r })) : null, T: S.bukti.T ? S.bukti.T.map((r) => ({ ...r })) : null },
      buktiEl: JSON.parse(JSON.stringify(S.buktiEl || {})),
      buktiElBuka: { ...(S.buktiElBuka || {}) },
      tj: Object.fromEntries(Object.entries(S.tj).map(([k, v]) => [k, { kode: v.kode, rows: v.rows.map((r) => ({ ...r })), berubah: v.berubah, sidang: v.sidang, galat: v.galat || "" }])),
      tjBuka: S.tjBuka,
      prat: { terbuka: S.prat.terbuka, memuat: S.prat.memuat, adaRtf: Boolean(S.prat.rtf), penanda: S.prat.penanda.slice(), kotor: S.prat.kotor, galat: S.prat.galat, siap: naskahSegar(S.prat), sedangDisiapkan: Boolean(S.prat.janji), versiIsian: S.versiIsian },
      ukurCetak: S.ukurCetak ? { ...S.ukurCetak } : null,
      fmt: { ...S.fmt },
      unggahan: unggahanBerlaku() ? { nama: S.unggahan.nama, bentukAsal: S.unggahan.bentukAsal, untuk: S.unggahan.untuk, byte: S.unggahan.rtf.byteLength } : null,
      ttdPilih: Array.from(S.ttdPilih),
      peringat: S.peringat,
      log: S.log.slice(),
      hitung: S.susunan ? hitung() : null,
      perlu: daftarPerlu().map((b) => b.kode),
      takBerlaku: daftarTakBerlaku().map((b) => b.kode),
      lanjutan: daftarLanjutan().map((b) => b.kode),
      tuntutanTersembunyi: S.susunan ? S.susunan.isian.filter((b) => golonganIsian(b) === "tuntutan").map((b) => b.kode) : [],
      tuntutan: S.susunan ? keadaanTuntutan().map((t) => ({ pemicu: t.pemicu, status: t.status, jabatan: t.jabatan, dipilih: t.dipilih })) : [],
      tandaKosong: Array.from(S.tandaKosong),
    }),
    murni: { sidikTeks, awalanBawaanEl, permintaanAbtAman, pilihanTunggalMurni, kerangkaBawaanMurni, daftarPilihanMurni, keputusanDipilihMurni, keputusanExOfficioMurni, bersihkanHeaderPenanda, bersihkanPenutupSaksiRtf, bersihkanPenutupTabelRtf, perkiraanSidang, keadaanBerlakuMurni, golonganIsianMurni, tuntutanAktifMurni, uraiKutipanTuntutan, rtfKeHtml, rtfKeTeks, uraiRtf, cekPenandaRtf, susunKalimatBukti, susunTeksBukti, kalimatBuktiEl, pisahBuktiElektronik, butirElDariTeks, uraiBukti, kalimatBukti, jenisBukti, sisipkanTtdRtf, ukuranTtdBerlaku, berhakCap, UKURAN_TTD_CAP_BAWAAN, ukuranPng, bersihkanPenutup, gantiKalimat, mirip, keIso, namaUnduhan, hurufDiLuarAbt, normalAbt, hurufAlasanDari, nilaiSimpan8503, jenisKelompok, namaTampil, adalahBlangkoIkrar, uraikanIkrar, kumpulkanIkrar, saranIkrarCadangan, saranDariPortal, kelompokUntukSaran, barisSidangSaran, alamatEditVariabel, ramahkanAlasan, pilihVarianSaksi },
  };
  globalThis.aletaBlangkoDerryIsian = apiIsian;
  if (!mulai()) {
    // blangko-derry.js belum terpasang (urutan muat lain): coba lagi sebentar.
    let coba = 0;
    const ulang = setInterval(() => {
      coba += 1;
      if (mulai() || coba > 40) clearInterval(ulang);
    }, 250);
  }
})();
