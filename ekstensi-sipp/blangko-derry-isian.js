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

  async function unduh(blob, nama) {
    try {
      const alamat = await blobKeData(blob);
      const jawab = await kirimLatar({ jenis: "unduh", nama, alamat });
      if (jawab && jawab.ok) return { ok: true, lewat: "ekstensi" };
    } catch {
      /* jatuh ke tautan biasa */
    }
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nama;
      if (typeof alatTandaiTautanAsli === "function") alatTandaiTautanAsli(a);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 4000);
      return { ok: true, lewat: "halaman" };
    } catch (e) {
      return { ok: false, pesan: String((e && e.message) || e) };
    }
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
    tj: {}, // kunci -> { kode, rows:[{no,tanya,jawab}], templates:[], dimuat, berubah, sidang }
    tjBuka: null,
    tjSisi: true,
    tjRiw: { u: [], r: [] },
    tjMenu: false, // 19 Okt (tahap 2): menu "Lainnya" tanya jawab saksi terbuka
    tjLipat: false, // 19 Okt (tahap 2): lipatan "Lihat keterangan saksi" (putusan / peran hakim, hanya baca) terbuka
    tjTujuan: null, // 19 Okt (tahap 2): { kunci, i, aksi: "tukar"|"salin" } - memilih saksi tujuan bila saksinya lebih dari dua
    // Jawaban saksi otomatis & pilihan pengetahuan saksi (blangko-derry-saksi.js): pil = kunci saksi -> {modus, sumber, alasan[]}.
    // alasanPosita: alasan yang terbaca dari posita perkara ini (centang "sebagian"); lainBuka: kunci saksi -> "Alasan lain" terbuka.
    sk: { pil: {}, perkara: "", alasan: null, alasanPosita: { perkara: "", keadaan: "", sesuai: null }, lainBuka: {}, status: {}, tertahan: {}, konfirmasi: {}, sig: {}, rantai: Promise.resolve() },
    semua: null, // "Lihat semua isi data"
    semuaBuka: false,
    prat: { terbuka: false, memuat: false, rtf: null, html: "", galat: "", suntingPenuh: false, kotor: true, penanda: [] },
    fmt: { rtf: true, pdf: false, salinan: false, anon: false, edoc: false },
    ttdPilih: new Set(),
    ttdManual: false, // pengguna sudah mengubah centang tanda tangan pada blangko ini -> tidak dicentang otomatis lagi
    ttdSumber: null, // { aleta: [{id,nama}]|null, sendiri: {nama,png}|null }
    peringat: false,
    sibuk: false,
    tampilTakBerlaku: false, // "tampilkan juga" isian yang keadaannya tidak berlaku
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
  const bolehTulis = () => Boolean(S.blangko) && kelompokBoleh({ nama: S.blangko.kelompok, jenis: S.blangko.jenis, ikrar: adalahBlangkoIkrar(S.blangko.jenis, S.blangko.berkas) });

  function asalAbtDerry() {
    if (typeof asalAbt === "function") return asalAbt();
    const cocok = String(location.pathname || "").match(/^(.*?\/abt)\//);
    return cocok ? `${location.origin}${cocok[1]}` : `${location.origin}/aps_badilag/abt`;
  }
  function klienAbt() {
    if (klien) return klien;
    if (typeof abtKlienBuat !== "function") throw new Error("abt-klien.js belum termuat.");
    klien = abtKlienBuat({
      ambil: (u, i) => fetch(u, i),
      asal: asalAbtDerry(),
      jeda: typeof a2JedaTulis === "function" ? a2JedaTulis : undefined,
    });
    return klien;
  }
  const perkaraId = () => (S.pk && S.pk.perkaraId ? String(S.pk.perkaraId) : "");
  const nomorPerkara = () => (S.pk && S.pk.nomorPerkara) || "";
  /** Urutan sidang ABT (d): urutan SIPP bila ada, bila tidak nomor urut daftar. */
  const sidangUrutan = () => {
    if (!S.pk) return "";
    // Cetak massal relaas: urutan sidang yang DIPANGGIL ditetapkan dokumennya (pemberitahuan putusan = 0 = tanpa d), bukan indeks daftar.
    if (S.pk.urutanPaksa !== undefined) return Number(S.pk.urutanPaksa) > 0 ? String(Number(S.pk.urutanPaksa)) : "";
    const s = S.pk.sidangDipilih;
    if (s && Number(s.urutan) > 0) return String(s.urutan);
    return String((Number(S.pk.sidangKe) || 0) + 1);
  };
  const sebutan = () => {
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
      const kelompok = derry.kelompok.map((k, i) => ({
        nama: k.nama,
        a: k.a,
        jenis: jenisKelompok(k.nama),
        jumlah: k.jumlahBerkas,
        urut: i,
        berkas: (lamaPeta.get(k.nama) && lamaPeta.get(k.nama).berkas) || null,
      }));
      S.menu = { kelompok, saat: Date.now() };
    } catch (e) {
      S.galatMenu = String((e && e.message) || e);
      if (!S.menu) S.menu = { kelompok: [], saat: 0 };
    }
    S.memuatMenu = false;
    renderModal();
  }
  async function muatBerkasKelompok(k, paksa) {
    if (!k || (k.berkas && !paksa) || k.memuat) return k ? k.berkas : null;
    k.memuat = true;
    try {
      const h = await klienAbt().daftarBerkas(k.a);
      if (!h.ok) throw new Error(h.pesan || "Kelompok tidak terbaca.");
      k.berkas = h.berkas.map((b) => ({ berkas: b.berkas, a: b.a, b: b.b }));
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
      daftar.push({ id: `k:${k.nama}`, nama: k.judul || namaMenuTampil(k.nama), sub: adaSaran ? "ada yang disarankan untuk sidang ini" : f ? `dipakai ${f.toLocaleString("id-ID")} perkara` : k.jumlah ? `${k.jumlah} blangko` : "", adaSaran, berkas: (k.berkas || []).map((b) => ({ ...b, kelompok: k.nama })), memuat: !k.berkas && !k.galat, galat: k.galat || "" });
    }
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
        return `<button type="button" class="bd-kel${k.saran ? " saran" : ""}${k.adaSaran ? " adasaran" : ""}${k.ikrar ? " ikrar" : ""}${k.id === S.modal.kelompok && !q ? " aktif" : ""}${q && n ? " ada" : ""}${q && !n ? " kosong" : ""}" data-kelmodal="${esc(k.id)}"><span class="kn">${esc(k.nama)}</span><span class="kj">${k.memuat ? "…" : q ? n : k.berkas.length}</span>${k.sub ? `<span class="ks">${esc(k.sub)}</span>` : ""}</button>`;
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
      else kanan = (k.sub ? `<p class="bd-ksub">${esc(k.nama)} · ${esc(k.sub)}</p>` : "") + (k.saran ? k.berkas.map((b) => `${tombolBlangko(b, S.modal.jenis, rek)}<p class="bd-catat bd-alasanrek">${esc(b.alasan || "")}</p>`).join("") : k.berkas.map(tombol).join("") || `<p class="bd-catat">Kelompok ini kosong.</p>`);
    }
    m.innerHTML =
      `<div class="bd-mkotak" role="document"><div class="bd-mkepala"><b>Pilih blangko</b>` +
      `<div class="bd-seg" role="tablist" aria-label="Jenis dokumen">${jenisAda.map((j) => `<button type="button" role="tab" data-jenismodal="${j}" aria-selected="${S.modal.jenis === j}">${esc(NAMA_JENIS[j])}${adm() ? "" : ""}</button>`).join("")}</div>` +
      `<input class="bd-cari" id="bd-caribl" placeholder="cari, mis. 3 saksi" aria-label="Cari blangko" value="${esc(S.modal.cari)}">` +
      `<button type="button" class="bd-btn kecil" data-bd2="tutupmodal">Tutup</button></div>` +
      `<div class="bd-mbadan"><nav class="bd-mkiri" aria-label="Kelompok blangko">${kiri}</nav><div class="bd-mkanan">${kanan}</div></div></div>`;
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
    S.blangko = blangko;
    S.susunan = null;
    S.galatSusunan = "";
    S.nilai = {};
    S.isi = {};
    S.diketik.clear();
    S.tersimpan = {};
    S.ganti = {};
    S.saran = {};
    S.saranSipp = {};
    S.info = {};
    S.bunyi = {};
    S.ketBuka = new Set();
    S.ketRiwayat = {};
    S.ketRiwayatBuka = new Set();
    S.dariSipp = new Set();
    S.el7 = null;
    S.el7Saran = null;
    S.bukti = { P: null, T: null };
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
    await muatSusunan();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Susunan isian (portal) + nilai (bot / ABT) + pemicu
  // ──────────────────────────────────────────────────────────────────────────
  function alamatSusunan(semua) {
    const q = new URLSearchParams();
    q.set("folder", S.blangko.folder || "");
    q.set("berkas", S.blangko.berkas);
    q.set("perkaraId", perkaraId());
    q.set("sidangKe", sidangUrutan());
    const sb = sebutan();
    q.set("sebutanP", sb.P);
    q.set("sebutanT", sb.T);
    if (semua) q.set("semua", "1");
    // "Lihat sebagai akun": rute menegakkan hak dokumen peran yang ditiru (server hanya menerimanya dari admin).
    const a = api();
    const kd = a && typeof a.keadaan === "function" ? a.keadaan() : null;
    if (adm() && kd && kd.sebagai && kd.sebagai.nama && kd.sebagai.peran) q.set("sebagaiPeran", kd.sebagai.peran);
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
      S.nilai = d.nilai && typeof d.nilai === "object" ? d.nilai : {};
      if (!d.nilaiAda) await nilaiDariAbt(d);
      if (S.blangko !== blangko) return;
      for (const b of d.isian) {
        const v = S.nilai[b.kode];
        if (v && v.status === "terisi" && b.jenis !== "tj") S.isi[b.kode] = b.jenis === "tanggal" ? keIso(v.teks) || v.teks : v.teks;
      }
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
    const kode = [...d.isian.filter((b) => b.jenis !== "tj").map((b) => b.kode), ...d.pemicu.map((p) => p.kode)];
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
            const h = await k.bacaTanyaJawab({ kode: b.tj.kodeSunting, perkaraId: perkaraId(), sidang: sidangUrutan(), a: S.blangko.a, b: S.blangko.b });
            if (!h.ok) return;
            const baris = Array.isArray(h.baris) ? h.baris : [];
            const ada = baris.some((r) => String((r && r.tanya) || "").trim() || String((r && r.jawab) || "").trim());
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
          await jadwalkanSimpan(b.kode, nilai, true);
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
      await jadwalkanSimpan("7139", keputusan.nilai, true);
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
    const ok = await jadwalkanSimpan(b.kode, nilai, true);
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
        void catatRiwayat({ perkaraId: perkaraId(), kode: b.kode, nama: b.nama, sebelum, sesudah: String(S.isi[b.kode] || nilai), cara: ganti ? `bawaan kueri ABT yang mentah diganti otomatis di Blangko Derry dari ${asal} (${yakin})` : `diisi otomatis di Blangko Derry dari ${asal} (${yakin})`, pada: new Date().toISOString() });
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
    if (!bolehTulis()) return lapor(`Akun ini tidak dapat menulis ${(NAMA_JENIS[S.blangko.jenis] || "blangko ini").toLowerCase()}; ${NAMA_PERAN[JENIS_PERAN[S.blangko.jenis]] || "pejabat perkara"} yang mengisinya.`);
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
      const perlu = () => daftarPerlu().filter((b) => (b.jenis === "teks" || b.jenis === "tanggal") && !b.khusus && b.kode);
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
          daftar.map((b) => ({ kode: b.kode, nama: b.nama, jenis: b.jenis, opsi: b.opsi, kosong: sedangKosong(b), bolehGanti: bolehGantiMentah(b, jejak) })),
          keIso,
          usulanSumber
        );
        for (const [kode, info] of Object.entries(rencana.info)) {
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
  function agendaMemuatPeran(peran, agenda) {
    const t = String(agenda || "").toLowerCase();
    if (!t) return false;
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
      const butir = d.isian.filter((b) => b.jenis === "tj" && b.tj && TJ_JAWAB_MENJAWAB[b.tj.kunci] && b.tj.kodeSunting === TJ_JAWAB_MENJAWAB[b.tj.kunci].kode);
      if (!butir.length) return;
      const pilih = S.pk.sidangDipilih;
      if (!pilih || !(Number(pilih.urutan) > 0)) return;
      // Hemat bacaan: sidang yang agendanya tidak menyebut jawaban/replik/duplik (atau jawab-menjawab) bukan tujuan berkas mana pun.
      if (!butir.some((b) => agendaMemuatPeran(TJ_JAWAB_MENJAWAB[b.tj.kunci].peran, pilih.agenda))) return;
      const sb = sebutan();
      const q = new URLSearchParams({ nomor: nomorPerkara(), lawan: sb.P, pelaku: sb.T });
      const isi = await ambilPortal(`${API_ISI_GUGATAN_JM}?${q.toString()}`, {}, "Membaca jawab-menjawab dari e-Court");
      if (S.susunan !== d || !S.pk || S.pk.sidangDipilih !== pilih) return;
      const daftarTj = Array.isArray(isi && isi.tanyaJawab) ? isi.tanyaJawab : [];
      const kalimat = Array.isArray(isi && isi.kalimat) ? isi.kalimat : [];
      S.tjOto = S.tjOto || {};
      for (const b of butir) {
        const info = TJ_JAWAB_MENJAWAB[b.tj.kunci];
        const kunci = b.tj.kunci;
        const calon = daftarTj.filter((t) => t && t.kode === info.kode);
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
          if (S.prat) S.prat.kotor = true;
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
  const saranUntuk = (b, opsi) => {
    const m = mesinIsi();
    const bersih = (v) => (m ? m.bersihkanNilai(b.kode, v) : String(v || ""));
    const h7 = S.saranH7 && S.saranH7[b.kode] ? S.saranH7[b.kode].nilai : "";
    const sipp = S.saranSipp[b.kode] && b.jenis !== "tanggal" ? S.saranSipp[b.kode].nilai : "";
    const popup = S.saran[b.kode] && !(m && m.jelasMentah(b.kode, S.saran[b.kode])) ? S.saran[b.kode] : "";
    // 19 Okt (isian 2): saran harus sesuai MAKNA isiannya - kalimat ghaib di "Awal perselisihan" atau potongan posita di "KUA" tidak
    // pernah ditawarkan; lebih baik kotak kosong daripada saran yang salah.
    const sesuai = (v) => !m || m.sahBentuk(b.kode, v, b.nama);
    const calon = [h7, sipp, popup]
      .map((v) => bersih(v).trim())
      .filter((v) => v && sesuai(v))
      .map((v) => (m ? m.rapikanBentuk(b.kode, v, b.nama) : v));
    if (calon.length) return calon[0];
    // Contoh umum per isian ("belum dikaruniai anak", tanggal pengumuman contoh): hanya samar di kotak, TIDAK untuk pengisian massal.
    return opsi && opsi.tanpaUmum ? "" : bersih(b.saran || "");
  };
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
    return v && !alasanHuruf() ? `ABT tidak mengenali "${v}" sebagai huruf alasan - tulis hurufnya saja, rapat, mis. F, BF, ABF (atau Murtad untuk H).` : "";
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
  /** Isian wajib yang keadaannya tidak berlaku untuk perkara ini (disembunyikan; dapat ditampilkan). */
  function daftarTakBerlaku() {
    if (!S.susunan) return [];
    return S.susunan.isian.filter((b) => b.wajib && !keadaanBerlaku(b));
  }
  /** Isian yang tampil: wajib, keadaannya berlaku (atau petugas memilih "tampilkan juga"). */
  function daftarPerlu() {
    if (!S.susunan) return [];
    return S.susunan.isian.filter((b) => b.wajib && (S.tampilTakBerlaku || keadaanBerlaku(b)));
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
    if (!a || typeof a.laporIsian !== "function" || !S.pk) return;
    const h = hitung();
    a.laporIsian(nomorPerkara(), { a: h.a, t: h.t, jenis: S.blangko ? S.blangko.jenis : "", dicetak: S.cetakTercatat });
    // F1.6: rincian isian untuk checklist konseptor (konseptor-langkah.js) - hanya diumumkan, tidak ditulis di sini.
    if (S.blangko && S.susunan) {
      const isian = daftarPerlu().map((b) => {
        const [x, y] = nilaiTerisi(b);
        return { kode: b.kode, nama: b.nama, jenis: b.jenis, khusus: b.khusus || "", terisi: y > 0 && x >= y };
      });
      document.dispatchEvent(new CustomEvent("aleta-bd-isian", { detail: { perkaraId: String(S.pk.perkaraId || ""), nomorPerkara: nomorPerkara(), jenis: S.blangko.jenis, berkas: S.blangko.berkas, isian } }));
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Menyimpan satu isian ke ABT (edit_data) - hanya bila peran sesuai
  // ──────────────────────────────────────────────────────────────────────────
  const antreSimpan = new Map();
  function jadwalkanSimpan(kode, nilai, segera) {
    S.isi[kode] = nilai;
    clearTimeout(antreSimpan.get(kode));
    if (segera) return simpanIsian(kode, nilai);
    antreSimpan.set(kode, setTimeout(() => void simpanIsian(kode, nilai), 500));
    return undefined;
  }
  async function simpanIsian(kode, nilai) {
    if (!S.blangko || !S.pk) return false;
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
    try {
      const h = await klienAbt().simpanIsian(kode, perkaraId(), nilai, { verifikasi: false });
      if (S.isi[kode] !== nilai) return true; // sudah diketik lagi: hasil ini tidak dipakai
      S.tersimpan[kode] = h.ok ? "tersimpan" : `gagal: ${h.pesan || "ABT menolak"}`;
      if (h.ok) {
        S.nilai[kode] = { status: String(nilai).trim() ? "terisi" : "kosong", teks: String(nilai) };
        S.prat.kotor = true;
        S.peringat = false;
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
  // Alat bukti surat: baris terstruktur <-> kalimat ABT (variabel 1214 / 9911)
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * 19 Okt (isian 2): jenis bukti yang diawali nomor ("1. Fotokopi Kartu Tanda Penduduk ...", "2) Fotokopi Kutipan Akta Nikah") dibuang
   * penomoran awalnya - kode P.1/P.2 sudah ditulis otomatis di kalimat, nomor ganda membingungkan.
   */
  const buangNomorAwal = (t) => String(t == null ? "" : t).replace(/^\s*\(?\d{1,2}\s*[.)]\s*(?=\S)/, "").replace(/^\s+/, "");
  const POLA_BUKTI_BERNOMOR = /^\s*\(?\d{1,2}\s*[.)]\s+\S/m;
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
    const METERAI = [", bukti surat tersebut telah diberi meterai cukup, di-nazegelen", ", bukti surat tersebut telah diberi meterai cukup, tetapi tidak di-nazegelen", ", bukti surat tersebut tidak bermeterai dan tidak di-nazegelen", ""];
    const COCOK = ["telah dicocokkan dengan aslinya yang ternyata sesuai", "tidak dapat dicocokkan dengan aslinya", "dicocokkan dari fotokopinya", "telah dicocokkan dengan kopian sebelumnya dan ternyata sesuai", ""];
    const tm = METERAI[m] !== undefined ? METERAI[m] : METERAI[0];
    const tc = COCOK[c] !== undefined ? COCOK[c] : COCOK[0];
    k += tm;
    if (tc) k += tm ? `, serta ${tc}` : `, bukti surat tersebut ${tc}`;
    k += `, lalu diberi tanda ${kode} serta diberi tanggal dan paraf oleh Ketua Majelis;`;
    return k.replace(/^, /, "");
  }
  const susunKalimatBukti = (rows, pihak) => rows.map((r, i) => kalimatBukti(r, pihak, i)).join("\n");
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
  async function siapkanBukti() {
    if (!S.susunan) return;
    for (const b of S.susunan.isian.filter((x) => x.khusus === "bukti")) {
      const pihak = b.pihak;
      const s = await bacaPenyimpanan(`bdBukti:${perkaraId()}:${pihak}`);
      const simpanan = s[`bdBukti:${perkaraId()}:${pihak}`];
      let rows = null;
      let teksAsal = "";
      const v = S.nilai[b.kode];
      if (simpanan && Array.isArray(simpanan.rows) && v && v.status === "terisi" && susunKalimatBukti(simpanan.rows, pihak) === String(v.teks || "").replace(/\r\n/g, "\n")) rows = simpanan.rows;
      else if (v && v.status === "terisi" && String(v.teks || "").trim()) {
        teksAsal = String(v.teks);
        rows = uraiBukti(v.teks);
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
      if (berubahNomor && bolehTulis()) simpanBukti(pihak, false);
    }
    renderIsian();
    laporKeKerangka();
  }
  function simpanBukti(pihak, segera) {
    const b = S.susunan && S.susunan.isian.find((x) => x.khusus === "bukti" && x.pihak === pihak);
    if (!b || !S.bukti[pihak]) return;
    void tulisPenyimpanan({ [`bdBukti:${perkaraId()}:${pihak}`]: { rows: S.bukti[pihak], saat: Date.now() } });
    jadwalkanSimpan(b.kode, susunKalimatBukti(S.bukti[pihak], pihak), segera);
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
  async function muatTj(kunci, paksa) {
    const it = tjItem(kunci);
    if (!it) return;
    const d = sidangUrutan();
    const ada = S.tj[kunci];
    if (ada && ada.dimuat && ada.sidang === d && !paksa) return;
    S.tj[kunci] = { kode: it.tj.kodeSunting, rows: ada && ada.sidang === d ? ada.rows : [], templates: ada ? ada.templates : [], dimuat: false, memuat: true, berubah: ada && ada.sidang === d ? ada.berubah : false, sidang: d, galat: "" };
    renderTj();
    try {
      const h = await klienAbt().bacaTanyaJawab({ kode: it.tj.kodeSunting, perkaraId: perkaraId(), sidang: d, a: S.blangko.a, b: S.blangko.b });
      const t = S.tj[kunci];
      if (!t || t.sidang !== d) return;
      if (!h.ok) t.galat = h.pesan || "Tanya jawab tidak terbaca.";
      else {
        if (!t.berubah) t.rows = tandaiDasarBaris(h.baris.map((r) => ({ no: r.no, tanya: r.tanya, jawab: r.jawab })), false);
        t.templates = h.templates;
        t.keterangan = h.keterangan;
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
    if (!perkaraId()) return;
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
  /**
   * Menyusun jawaban otomatis untuk saksi `targets`. Hanya baris yang boleh diganti (kosong, contoh set, atau hasil otomatis
   * sebelumnya) yang berubah; sisanya dilaporkan sebagai tertahan. `opsi.lapor` = atas permintaan petugas (pilihan diubah,
   * tombol susun ulang): hasil selalu dilaporkan. Tanpa itu (pemuatan otomatis) hanya yang benar-benar berubah yang dilaporkan.
   */
  function isiOtomatis(targets, opsi) {
    const m = SK();
    if (!m || !S.blangko || !S.pk) return Promise.resolve();
    const kerja = async () => {
      const o = opsi || {};
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
        const hasil = tg.map((k) => {
          const idx = grup.indexOf(k);
          const sj = Array.isArray(h.saksi) && h.saksi[idx] ? h.saksi[idx].jawaban : idx === 0 ? h.saksi1 : idx === 1 ? h.saksi2 : [];
          const para = Array.isArray(h.paragrafSaksi) ? h.paragrafSaksi[idx] : null;
          const t = S.tj[k];
          if (!t || m.tandaTanya(t.rows) !== tandaTanyaKirim) return { k, lewat: true };
          return { k, res: m.pasangJawaban(t.rows, sj, { hubungan: para && para.hubungan, timpa: o.timpa === true }) };
        });
        if (hasil.some((x) => x.res && x.res.terisi)) tjCatat(grup);
        for (const x of hasil) {
          const t = S.tj[x.k];
          if (x.lewat || !t) {
            S.sk.status[x.k] = o.lapor ? { galat: "Daftar pertanyaan berubah selagi disusun; tekan Susun ulang jawaban." } : null;
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
    simpanPilSaksi();
    renderTj();
    if (tjSiap([kunci])) void isiOtomatis([kunci], { lapor: true });
  }
  /** Panel "Pengetahuan saksi" di atas tabel tanya jawab: pilihan sama dengan Susun keterangan saksi di panel ABT. */
  function panelPengetahuan(keys) {
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
    return `<div class="bd-skpanel" role="group" aria-label="Pengetahuan saksi"><div class="bd-skhead"><span class="bd-lbl">Pengetahuan saksi</span><button type="button" class="bd-btn kecil" data-bd2="isioto" data-kunci="${esc(keys.join("|"))}" ${tjSiap(keys) ? "" : "disabled"}>Susun ulang jawaban</button></div><div class="bd-skgrid">${kartu}</div></div>`;
  }
  // Simpan ke ABT = HAPUS lalu isi ulang seluruh keterangan sidang itu. Sebelum keterangan
  // yang sudah ada di ABT terbaca, menyimpan (atau mengganti daftar) akan menghapusnya tanpa
  // pernah dilihat petugas - jadi penyunting baru boleh diubah/disimpan sesudah bacaan berhasil.
  function tjSiap(kunciDaftar) {
    return kunciDaftar.length > 0 && kunciDaftar.every((k) => S.tj[k] && S.tj[k].dimuat && !S.tj[k].memuat);
  }
  var PESAN_TJ_BELUM_TERBACA = "Keterangan yang sudah ada di ABT belum terbaca - tunggu sampai selesai dibaca, atau tutup lalu buka lagi tanya jawab ini bila pembacaannya gagal. Tidak disimpan supaya keterangan lama tidak terhapus.";
  async function simpanTj(kunciDaftar) {
    if (!bolehTulis()) return toast(`Tanya jawab ${NAMA_JENIS[S.blangko.jenis].toLowerCase()} hanya disimpan ${NAMA_PERAN[JENIS_PERAN[S.blangko.jenis]]}.`);
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
        t.galat = "Daftar kosong tidak disimpan (akan menghapus keterangan saksi di ABT). Hapus di ABT bila memang mau dikosongkan.";
        renderTj();
        continue;
      }
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
          S.prat.kotor = true;
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
    const jenisSaran = S.pk ? jenisSaranAktif() : "";
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
    "info:persidang": {
      label: "Keterangan: isian tersimpan per perkara, bukan per sidang",
      judul: "Isian ini berlaku untuk perkara, bukan per sidang",
      teks: "Isian ketikan tersimpan per perkara, bukan per sidang: BAS sidang lain memakai isian yang sama. Cetak segera sesudah mengisi.",
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
          const bisa = bolehTulis() && !samaKet(x.sebelum, skrg);
          return `<div class="bd-ketriw-baris"><span class="bd-catat">${esc(waktu)} · ${esc(potong(x.cara || "", 70))}: "${esc(potong(x.sebelum || "(kosong)", 80))}" → "${esc(potong(x.sesudah || "(kosong)", 80))}"</span>${bisa ? ` <button type="button" class="bd-tautankecil" data-bd2="ketpulih" data-ket="${esc(kode)}" data-idx="${idx}">kembalikan ↺</button>` : ""}</div>`;
        })
        .join("") +
      `</div>`
    );
  }
  function kepingKet(b) {
    const i = S.info[b.kode];
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
      const lama = String(S.isi[kode] || "");
      S.diketik.add(kode);
      const ok = await jadwalkanSimpan(kode, String(x.sebelum || ""), true);
      if (ok) {
        S.dariSipp.delete(kode);
        try {
          if (typeof catatRiwayat === "function") void catatRiwayat({ perkaraId: perkaraId(), kode, nama: b.nama, sebelum: lama, sesudah: String(x.sebelum || ""), cara: "dikembalikan dari riwayat di Blangko Derry", pada: new Date().toISOString() });
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

  function kotakIsian(b) {
    const v = S.isi[b.kode] !== undefined ? String(S.isi[b.kode]) : "";
    const sr = cfg().saran ? saranUntuk(b) : "";
    const st = S.tersimpan[b.kode] || "";
    const pil = b.pilihan || [];
    const opsi = Array.isArray(b.opsi) ? b.opsi : [];
    // e-Court adalah keadaan sebagian besar perkara: tanpa lencana "muncul karena" supaya kotak tetap ringkas.
    const alasan = (b.keadaan || b.pemicu) && b.keadaan !== "ecourt" ? keteranganKeadaan(b) : "";
    const muncul = alasan ? `<span class="bd-muncul">muncul karena ${esc(alasan)}</span>` : "";
    const tanda = S.tandaKosong.has(b.kode) && !v.trim() ? ` bd-kosongcetak${b.tingkat === "tambahan" ? " tambahan" : ""}` : "";
    const ro = bolehTulis() ? "" : "disabled";
    let isian;
    let panjang = false;
    let lebarSelalu = false;
    if (opsi.length) {
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
          .join("")}</select></label>`
      : "";
    return (
      `<div class="bd-f${v.trim() ? " beres" : ""}${panjang ? " panjang" : ""}${tanda}" data-f="${b.kode}"><div class="bd-fh"><label for="bd-i${b.kode}" title="${esc(b.nama)}">${esc(b.nama)}</label>${ikonSumber(b.kode, b.nama, ketItem(b))}</div>${muncul}${kepingKet(b)}` +
      isian +
      sandingKet(b) +
      pilihBunyi +
      (b.kode === "7139" && S.el7 && v === S.el7.nilai ? `<span class="bd-catat bd-el7">${esc(S.el7.keterangan)}</span>` : "") +
      (b.kode === "7139" && S.el7Saran && !v.trim() ? `<span class="bd-catat bd-el7">Saran: ${esc(S.el7Saran.keterangan)}</span>` : "") +
      `<span class="bd-status" data-status="${b.kode}">${esc(teksStatus(st, b.kode))}</span>` +
      (b.kode === "8503" ? (() => { const w = peringatan8503(); return `<span class="bd-peringatan" data-peringatan="8503" role="alert" ${w ? "" : "hidden"}>${esc(w)}</span>`; })() : "") +
      `</div>`
    );
  }
  const teksStatus = (st, kode) => (st === "tersimpan" ? `✓ ${kode && S.dariSipp.has(kode) ? "terisi dari SIPP, tersimpan di ABT" : "tersimpan di ABT"}${kode && S.ganti[kode] ? ` (huruf ${S.ganti[kode]} diganti ke bentuk aman ABT)` : ""}` : st === "menyimpan" ? "menyimpan…" : st.startsWith("gagal") ? st : "");
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
    return (
      `<div class="bd-f lebar" data-f="${b.kode}"><div class="bd-fh"><label>${esc(b.nama)}</label>${ikonSumber(`bukti:${w}`, b.nama, ketItem(b))}<span class="bd-status" data-status="${b.kode}">${esc(teksStatus(S.tersimpan[b.kode] || ""))}</span></div>` +
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
      `<div class="bd-baris"><span class="bd-lbl">Tambah bukti</span>${BUKTI_CEPAT.map(([n, o]) => `<button type="button" class="bd-chip bd-tombolchip" data-bktambah="${w}" data-nama="${esc(n)}" data-oleh="${esc(o)}">+ ${esc(n)}</button>`).join("")}<button type="button" class="bd-chip bd-tombolchip" data-bktambah="${w}" data-nama="" data-oleh="">+ Bukti lain</button></div></div>`
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
      `<p class="bd-petunjuk">Tulisan samar di kotak adalah saran. Tekan <kbd>Tab</kbd> untuk memakainya, atau <kbd>↓</kbd> untuk pilihan lain. Data lain sudah terisi sendiri.${bolehTulis() ? "" : ` <b>Akun Anda hanya dapat melihat; ${esc(NAMA_JENIS[S.blangko.jenis].toLowerCase())} ditulis ${esc(NAMA_PERAN[JENIS_PERAN[S.blangko.jenis]] || "pejabat perkara")}.</b>`}</p>` +
      `<div class="bd-bar"><span id="bd-barisi"></span></div><div class="bd-alatkecil" id="bd-alatisi"></div>` +
      `<div class="bd-pgrid" id="bd-perlu">${grid.length ? grid.map((b) => (b.khusus === "bukti" ? kotakBukti(b) : kotakIsian(b))).join("") : tj.length ? "" : `<p class="bd-ok">Blangko ini tidak perlu diisi tangan; semua terisi sendiri dari SIPP dan aturan ABT.</p>`}</div>` +
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
    if (!aleta.length) return abt;
    // 19 Okt 2026: saran TERPILIH otomatis di dropdown; alasannya hanya `title` (bukan paragraf di layar).
    const idUtama = (aleta.find((x) => x.utama) || {}).id;
    const opsi = aleta.map((x) => `<option value="aleta:${esc(x.id)}" title="${esc([x.untuk, x.utama ? x.sebab : ""].filter(Boolean).join(" - "))}"${idUtama && x.id === idUtama ? " selected" : ""}>${esc(x.judul)}${x.utama ? " - disarankan" : ""}</option>`).join("");
    return `<optgroup label="Panduan ALETA sesuai jenis perkara">${opsi}</optgroup>${abt ? `<optgroup label="Set yang tersimpan di ABT">${abt}</optgroup>` : ""}`;
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

  function renderTj() {
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
      wad.innerHTML =
        `<div class="bd-tjwadah bd-tjbaca"><div class="bd-tjalat"><b>${esc(it.tj.sebutan)}</b><span class="bd-chip">${esc(sidangTeks)}</span></div>` +
        `<p class="bd-catat">Hanya dibaca. Tanya jawab saksi disusun di berita acara sidang.</p>` +
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
      `<button type="button" class="bd-btn kecil" data-bd2="muattpl" data-kunci="${esc(kunciDaftar.join("|"))}" ${tjSiap(kunciDaftar) ? "" : "disabled"}>Muat</button><button type="button" class="bd-btn kecil" data-bd2="tambahtj" data-kunci="${esc(kunciDaftar.join("|"))}" ${tjSiap(kunciDaftar) ? "" : "disabled"}>Tambah baris</button></div>` +
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
    const kaki = (kunciDaftar) =>
      `<div class="bd-tjalat bd-tjkaki"><button type="button" class="bd-btn kecil utama" data-bd2="simpantj" data-kunci="${esc(kunciDaftar.join("|"))}" ${bolehTulis() && tjSiap(kunciDaftar) ? "" : "disabled"}>Simpan ke ABT</button></div>`;
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
          `<div class="bd-sba"><span class="bd-sblabel">${esc(na)}</span><textarea class="bd-ed" rows="3" data-sba="${i}" data-sk="0" aria-label="Jawaban ${esc(na)} nomor ${i + 1}">${esc(a.jawab)}</textarea>${mini(i, 0, na, nb, "→")}</div>` +
          `<div class="bd-sba"><span class="bd-sblabel">${esc(nb)}</span><textarea class="bd-ed" rows="3" data-sba="${i}" data-sk="1" aria-label="Jawaban ${esc(nb)} nomor ${i + 1}">${esc(b.jawab)}</textarea>${mini(i, 1, nb, na, "←")}</div></div>`
        );
      }).join("");
      wad.innerHTML =
        `<div class="bd-tjwadah bd-sbs">${alatAtas(`${na} dan ${nb}`, ps)}` +
        `${alatKedua()}` +
        `${panelPengetahuan(ps)}${status(ps[0])}${status(ps[1])}<div class="bd-sbhead" aria-hidden="true"><span>No</span><span>Pertanyaan</span><span>${esc(na)}</span><span>${esc(nb)}</span></div><div class="bd-sblist">${baris || `<p class="bd-catat" style="padding:10px">Belum ada pertanyaan. Muat set pertanyaan atau tambah baris.</p>`}</div>${kaki(ps)}</div>`;
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
      `${panelPengetahuan([S.tjBuka])}<div class="bd-tjtabel"><table><thead><tr><th class="no-u">No</th><th>Pertanyaan</th><th>Jawaban</th><th></th></tr></thead><tbody>${
        rows
          .map(
            (r, i) =>
              `<tr><td class="no-u">${i + 1}</td><td><textarea class="bd-ed" rows="2" data-tjb="${i}" data-sisi="tanya" aria-label="Pertanyaan ${i + 1}">${esc(r.tanya)}</textarea></td><td><textarea class="bd-ed" rows="2" data-tjb="${i}" data-sisi="jawab" aria-label="Jawaban ${i + 1}">${esc(r.jawab)}</textarea>${miniSatu(i)}</td><td style="white-space:nowrap"><button type="button" class="bd-ikon" data-naik="${i}" title="Naikkan baris tanya jawab ini" aria-label="Naik">↑</button> <button type="button" class="bd-ikon" data-turun="${i}" title="Turunkan baris tanya jawab ini" aria-label="Turun">↓</button> <button type="button" class="bd-ikon" data-hapus="${i}" title="Hapus baris ini" aria-label="Hapus">✕</button></td></tr>`
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
            ? `<textarea data-k="${kode}" rows="${Math.min(6, isiNya.split("\n").length + 1)}" placeholder="kosong = dari SIPP" ${bolehTulis() ? "" : "readonly"} aria-label="${esc(nama)}">${esc(isiNya)}</textarea>`
            : `<input data-k="${kode}" value="${esc(isiNya)}" placeholder="kosong = dari SIPP" ${bolehTulis() ? "" : "readonly"} aria-label="${esc(nama)}">`
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
   * putusan - pola pembersih yang sama dengan editor saksi (bersihkanPenutup -> abt.js). Hanya paragraf yang SELURUHNYA kalimat penutup;
   * ekor kalimat di tengah/akhir paragraf lain, sel tabel, dan paragraf yang memuat grup/kolom/gambar/bidang TIDAK disentuh (tidak aman
   * dipotong dari RTF). Brace tiap paragraf yang dibuang harus seimbang sehingga RTF tetap sah. Murni: tanpa tulisan ke ABT/SIPP.
   */
  function bersihkanPenutupSaksiRtf(rtf) {
    const asalString = typeof rtf === "string";
    const sumber = latin1(rtf);
    const polaPar = /\\par(?![a-zA-Z])/g;
    const terlarang = /\\(?:cell|row|trowd|intbl|sect|page|pict|field|fldinst|bkmkstart|shp|object)(?![a-zA-Z])|\\\*/;
    let hasil = "";
    let awal = 0; // awal paragraf berjalan
    let akhirSalin = 0;
    let jumlah = 0;
    let m;
    while ((m = polaPar.exec(sumber))) {
      const ujung = m.index + m[0].length;
      const isi = sumber.slice(awal, m.index);
      let ok = isi.length < 400 && !terlarang.test(isi);
      if (ok) {
        let dalam = 0;
        for (let i = 0; i < isi.length && ok; i += 1) {
          const c = isi[i];
          if (c === "\\") i += 1;
          else if (c === "{") dalam += 1;
          else if (c === "}" && --dalam < 0) ok = false;
        }
        if (dalam !== 0) ok = false;
      }
      if (ok) {
        const polos = isi
          .replace(/\\'([0-9a-fA-F]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16)))
          .replace(/\\(?:~|tab)(?![a-zA-Z])/g, " ")
          .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
          .replace(/[{}\\]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/^\(?\d{1,2}\s*[.)]\s*/, "");
        if (polos && polos.length < 160 && bersihkanPenutup(polos, "") === "") {
          hasil += sumber.slice(akhirSalin, awal);
          akhirSalin = ujung;
          jumlah += 1;
        }
      }
      awal = ujung;
    }
    if (!jumlah) return { rtf, jumlah: 0 };
    const baru = hasil + sumber.slice(akhirSalin);
    return { rtf: asalString ? baru : bufDariLatin1(baru), jumlah };
  }
  async function ambilRtf(paksa) {
    if (!S.blangko || !S.pk) throw new Error("Pilih perkara dan blangko dulu.");
    if (S.blangko.hak !== "ok") throw new Error(S.blangko.hak === "periksa" ? "Hak buka blangko ini masih diperiksa ke ABT; tunggu sebentar." : "ABT tidak mengizinkan blangko ini untuk perkara ini.");
    if (S.prat.rtf && !S.prat.kotor && !paksa) return S.prat.rtf;
    const h = await klienAbt().cetak({ a: S.blangko.a, b: S.blangko.b, perkaraId: perkaraId(), sidang: sidangUrutan() });
    if (!h.ok) throw new Error(h.pesan || "ABT tidak mengembalikan naskah.");
    // Header penanda kecil buang dari semua keluaran cetak (RTF, PDF, salinan, anonim, e-Doc); berkas di ABT tidak diubah.
    const bersih = bersihkanHeaderPenanda(h.rtf);
    h.rtf = bersih.rtf;
    S.prat.headerDibuang = bersih.jumlah;
    // Putusan: paragraf kalimat penutup keterangan saksi dibuang dari keluaran cetak saja (ABT/SIPP dan BAS tidak disentuh).
    S.prat.penutupDibuang = 0;
    if (S.blangko.jenis === "put") {
      const tutup = bersihkanPenutupSaksiRtf(h.rtf);
      h.rtf = tutup.rtf;
      S.prat.penutupDibuang = tutup.jumlah;
    }
    S.prat.rtf = h.rtf;
    S.prat.kotor = false;
    S.prat.penanda = cekPenandaRtf(h.rtf);
    S.prat.titikTiga = h.periksa ? h.periksa.jumlahTitikTiga : 0;
    return h.rtf;
  }
  async function muatPratinjau(paksa) {
    if (S.prat.memuat) return;
    S.prat.memuat = true;
    S.prat.galat = "";
    renderPratinjau();
    try {
      const rtf = await ambilRtf(paksa);
      S.prat.html = rtfKeHtml(rtf, pembuatPenanda());
    } catch (e) {
      S.prat.galat = String((e && e.message) || e);
    }
    S.prat.memuat = false;
    renderPratinjau();
  }
  function renderPratinjau() {
    const w = wadah.pratinjau;
    if (!w) return;
    if (!S.blangko) {
      w.innerHTML = `<p class="bd-catat">Pratinjau tampil sesudah blangko dipilih.</p>`;
      return;
    }
    const p = S.prat;
    const sunting = p.suntingPenuh;
    w.innerHTML =
      `<button type="button" class="bd-pratbuka" data-bd2="bukaprat" aria-expanded="${p.terbuka}"><span class="bd-pana">${p.terbuka ? "▾" : "▸"}</span><span class="bd-tj">Pratinjau naskah</span><span class="bd-catat">${p.terbuka ? "klik untuk melipat" : "klik untuk melihat hasil (ABT menyusun naskahnya; blangko besar bisa 1-5 menit)"}</span>${p.kotor && p.html && p.terbuka ? `<span class="bd-chip sebagian">isian berubah - muat ulang</span>` : ""}</button>` +
      (p.terbuka
        ? `<div class="bd-pisi">` +
          (p.memuat ? `<p class="bd-catat" role="status">ABT sedang menyusun naskah perkara ini… (menghitung semua bagian otomatis)</p>` : "") +
          (p.galat ? `<p class="bd-peringatan">${esc(p.galat)} <button type="button" class="bd-btn kecil" data-bd2="muatprat">Coba lagi</button></p>` : "") +
          (p.html
            ? `<div class="bd-baris"><p class="bd-petunjukedit">${sunting ? "Ubah kotak yang berwarna, lalu Simpan ke ABT." : "Klik dua kali bagian berwarna (isian Anda) untuk mengubahnya di sini; bagian lain berasal dari SIPP."}</p>` +
              (bolehTulis() ? (sunting ? `<button type="button" class="bd-btn kecil utama" data-bd2="simpansunting">Simpan ke ABT</button><button type="button" class="bd-btn kecil" data-bd2="batalsunting">Batal</button>` : `<button type="button" class="bd-btn kecil" data-bd2="suntingpenuh">Sunting pratinjau</button>`) : "") +
              `<button type="button" class="bd-btn kecil" data-bd2="muatprat">Muat ulang dari ABT</button>` +
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
    if (!bolehTulis()) return toast(`${NAMA_JENIS[S.blangko.jenis]} hanya diubah ${NAMA_PERAN[JENIS_PERAN[S.blangko.jenis]] || "pejabat perkara"}.`);
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
    if (S.fmt.edoc && j === "put") o.push("unggah ke e-Doc SIPP");
    return o;
  }
  function renderCetak() {
    const w = wadah.cetak;
    if (!w) return;
    if (!S.blangko) {
      w.innerHTML = `<p class="bd-catat">Pilihan cetak tampil sesudah blangko dipilih.</p>`;
      return;
    }
    const j = S.blangko.jenis;
    const dok = daftarFmt();
    const sudah = S.cetakTercatat[`${nomorPerkara()}|${j}`];
    const pil = (k, label, ket) => `<label class="bd-pilc${k === "edoc" || k === "anon" ? (j === "put" ? "" : " mati") : ""}"><input type="checkbox" data-fmt="${k}" ${S.fmt[k] ? "checked" : ""} ${(k === "edoc" || k === "anon") && j !== "put" ? "disabled" : ""}> ${label}${ket ? `<small>${esc(ket)}</small>` : ""}</label>`;
    w.innerHTML =
      `<div class="bd-utas" role="group" aria-label="Pilihan cetak">${pil("rtf", "RTF")}${pil("pdf", "PDF")}${pil("salinan", "PDF SALINAN")}` +
      `<button type="button" class="bd-btn kecil" id="bd-btnttd" data-bd2="popttd" aria-expanded="false" aria-controls="bd-popttd">Tambah tanda tangan${S.ttdPilih.size ? ` (${S.ttdPilih.size})` : ""} ▾</button>` +
      `${pil("anon", "PDF anonim", j === "put" ? "" : "hanya putusan")}${pil("edoc", "Unggah ke e-Doc SIPP", j === "put" ? "" : "hanya putusan; BAS dan relaas diunggah lewat SIPP")}</div>` +
      `<div class="bd-ingat" id="bd-ingat" hidden role="alert"></div>` +
      `<div class="bd-utas"><button type="button" class="bd-btn utama besar" data-bd2="cetak" ${S.sibuk ? "disabled" : ""}>${S.sibuk ? "Sedang mencetak…" : "Cetak"}</button><span class="bd-catat" id="bd-statuscetak">${dok.length ? `Akan menerbitkan: ${esc(dok.join(", "))}. ` : "Pilih minimal satu hasil cetak. "}${sudah ? `Sudah dicetak ${esc(sudah)}.` : "Belum dicetak."}</span></div>` +
      `<ul class="bd-logcetak" id="bd-logcetak" ${S.log.length ? "" : "hidden"}>${S.log.slice(-6).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` +
      `<div class="bd-float lebar" id="bd-popttd" hidden role="dialog" aria-label="Tambah tanda tangan"></div>`;
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
  async function cetak(paksa) {
    if (!S.blangko || !S.pk || S.sibuk) return;
    if (!daftarFmt().length) return toast("Pilih minimal satu hasil cetak.");
    if (S.blangko.hak === "ditolak") return toast("ABT tidak mengizinkan blangko ini untuk perkara ini; tidak dapat dicetak.");
    if (!S.susunan && !S.galatSusunan) return toast("Isian blangko masih dibaca; tunggu sebentar.");
    S.sibuk = true;
    renderCetak();
    try {
      catatLog("meminta naskah dari ABT…");
      const rtf = await ambilRtf(S.prat.kotor);
      const kos = cfg().ingat !== false ? kosongRinci() : [];
      const hs = S.prat.penanda.map(namaPenanda);
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
    } catch (e) {
      catatLog(`gagal: ${String((e && e.message) || e)}`);
      toast(`Cetak gagal: ${String((e && e.message) || e)}`);
    }
    S.sibuk = false;
    S.peringat = false;
    renderCetak();
    laporKeKerangka();
  }
  async function pdfDari(rtfLatin1, salinan) {
    const buf = bufDariLatin1(rtfLatin1);
    const d = await ambilPortal(API_PDF, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rtfBase64: base64DariBuffer(buf), ...(salinan ? { salinan: true } : {}) }), batasMs: BATAS_LAMA_MS }, salinan ? "Membuat PDF salinan" : "Membuat PDF");
    if (!d || !d.available) throw new Error((d && d.message) || "pengubah PDF tidak tersedia");
    const biner = Uint8Array.from(atob(d.pdfBase64), (c) => c.charCodeAt(0));
    return { blob: new Blob([biner], { type: "application/pdf" }), bita: biner, keterangan: d.salinan || null };
  }
  async function lakukanCetak(rtfBuf) {
    const nomor = nomorPerkara();
    const berkas = S.blangko.berkas;
    const j = S.blangko.jenis;
    const hasil = [];
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
            aksi: S.fmt.edoc && j === "put" ? "unggah" : "unduh",
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
    let anonimRtf = null;
    let anonimAleta = null; // 16OKT-F43
    if (S.fmt.pdf || S.fmt.salinan) await autoCentangTtd(); // tanda tangan sah otomatis ikut bila pengguna belum memilih sendiri
    if (S.fmt.rtf) {
      const nama = namaUnduhan(nomor, berkas, "rtf");
      const u = await unduh(new Blob([rtfBuf], { type: "application/rtf" }), nama);
      hasil.push(u.ok ? `RTF diunduh "${nama}"` : `RTF gagal: ${u.pesan}`);
    }
    if (S.fmt.pdf) {
      try {
        catatLog("membuat PDF…");
        const t = await rtfDenganTtd(rtfBuf);
        const { blob } = await pdfDari(t.rtf, false);
        const nama = namaUnduhan(nomor, berkas, "pdf");
        const u = await unduh(blob, nama);
        let ket = u.ok ? `PDF diunduh "${nama}"` : `PDF gagal: ${u.pesan}`;
        if (t.dipasang.length) ket += ` · tanda tangan: ${t.dipasang.join(", ")}`;
        if (t.tidakDitemukan.length) ket += ` · nama tidak ditemukan di naskah, tanda tangan tidak dibubuhkan: ${t.tidakDitemukan.join(", ")}`;
        if (t.gagal.length) ket += ` · gambar tidak terbaca: ${t.gagal.join(", ")}`;
        hasil.push(ket);
      } catch (e) {
        hasil.push(`PDF gagal: ${String((e && e.message) || e)}`);
      }
    }
    if (S.fmt.salinan) {
      try {
        catatLog("membuat PDF SALINAN…");
        const t = await rtfDenganTtd(rtfBuf);
        const { blob, keterangan } = await pdfDari(t.rtf, true);
        const nama = namaUnduhan(nomor, `${berkas} - SALINAN`, "pdf");
        const ket =
          (keterangan && keterangan.gambarTtdPanitera ? ` (tanda tangan Panitera ${keterangan.namaPanitera || ""} tertempel)` : keterangan && keterangan.namaPanitera ? " (tanpa tanda tangan Panitera yang disahkan)" : "") +
          (t.dipasang.length ? ` · tanda tangan: ${t.dipasang.join(", ")}` : "") +
          (t.gagal.length ? ` · gambar tidak terbaca: ${t.gagal.join(", ")}` : "");
        const jawab = await kirimLatar({ jenis: "tampilkan-pdf", nama, alamat: await blobKeData(blob), pesan: "", awas: !(keterangan && keterangan.gambarTtdPanitera) });
        if (jawab && jawab.ok) hasil.push(`PDF SALINAN dibuka di tab baru${ket}`);
        else {
          const u = await unduh(blob, nama);
          hasil.push(u.ok ? `PDF SALINAN diunduh "${nama}"${ket}` : `PDF SALINAN gagal: ${u.pesan}`);
        }
      } catch (e) {
        hasil.push(`PDF SALINAN gagal: ${String((e && e.message) || e)}`);
      }
    }
    if ((S.fmt.anon || S.fmt.edoc) && j === "put") {
      try {
        /* === 16OKT-F43: penyamar mandiri ALETA dulu (abt.js); anonimisasi ABT hanya cadangan === */
        anonimAleta = typeof alatAnonimMandiri === "function" ? await alatAnonimMandiri(rtfBuf, nomor, catatLog) : null;
        if (anonimAleta && anonimAleta.ok) hasil.push(`anonim oleh ALETA: ${alatRingkasAnonim(anonimAleta)}${anonimAleta.sisa && anonimAleta.sisa.length ? ` - ${anonimAleta.sisa.length} bagian perlu diperiksa` : ""}`);
        else catatLog(`${anonimAleta ? `penyamar ALETA tidak dapat dipakai (${anonimAleta.sebab}); ` : ""}menyamarkan nama pihak (anonimisasi ABT, bisa 1-2 menit)…`);
        const h = anonimAleta && anonimAleta.ok ? anonimAleta : await klienAbt().anonim({ perkaraId: perkaraId(), nomor, rtf: rtfBuf, namaBerkas: namaUnduhan(nomor, berkas, "rtf") });
        /* === AKHIR 16OKT-F43 === */
        if (!h.ok) hasil.push(`anonimisasi gagal: ${h.pesan || "ABT tidak menjawab"}`);
        else {
          anonimRtf = h.rtf;
          if (S.fmt.anon) {
            try {
              const { blob } = await pdfDari(latin1(anonimRtf), false);
              const nama = namaUnduhan(nomor, `${berkas} - anonim`, "pdf");
              const u = await unduh(blob, nama);
              hasil.push(u.ok ? `PDF anonim diunduh "${nama}"` : `PDF anonim gagal: ${u.pesan}`);
            } catch (e) {
              hasil.push(`PDF anonim gagal: ${String((e && e.message) || e)}`);
            }
          }
        }
      } catch (e) {
        hasil.push(`anonimisasi gagal: ${String((e && e.message) || e)}`);
      }
    }
    if (S.fmt.edoc && j === "put") {
      /* === 16OKT-F43: pratinjau naskah anonim ALETA sebelum unggah === */
      const pilih = anonimAleta && anonimAleta.ok && anonimRtf && typeof alatPratinjauAnonim === "function" ? await alatPratinjauAnonim(anonimAleta, { nomor }) : "unggah";
      if (pilih === "batal") hasil.push("e-Doc SIPP: unggah dibatalkan dari pratinjau anonim");
      else {
        catatLog("mengunggah putusan ke e-Doc SIPP…");
        hasil.push(await unggahEdoc(rtfBuf, pilih === "tanpa" ? null : anonimRtf));
      }
      /* === AKHIR 16OKT-F43 === */
    }
    S.cetakTercatat[`${nomor}|${j}`] = jamSekarang();
    void tulisPenyimpanan({ [`${K_CETAK}:${nomor}|${j}`]: jamSekarang() });
    for (const h of hasil) catatLog(h);
    toast(hasil.join(" · "));
  }
  async function unggahEdoc(rtfBuf, anonimRtf) {
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
      return void isiOtomatis(kunci, { lapor: true });
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
      const o = S.tjOto && S.tjOto[String(aksi.getAttribute("data-kunci") || "")];
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
    const k = t.getAttribute && t.getAttribute("data-k");
    if (k) {
      if (t.type === "date" || t.tagName === "SELECT" || t.closest("#bd-vdaftar")) {
        jadwalkanSimpan(k, t.value, true);
        if (t.tagName === "SELECT") renderStatusIsian(k);
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
    S.nilai = {};
    S.tersimpan = {};
    S.saran = {};
    S.saranSipp = {};
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
      S.prat.kotor = true;
      // JJ2: sidang lain = tujuan penulisan lain; berkas yang rapi ditulis bila sidang ini agendanya sesuai dan barisnya kosong.
      if (S.susunan) void isiJawabMenjawabOtomatis(S.susunan);
      // 19 Okt: ganti sidang = isian yang datanya berubah per sidang diisi ulang (yang sudah ada isinya tidak ditimpa).
      if (S.susunan && cfg().isiOto !== false) void isiOtomatisBlangko(S.susunan, { sidang: true });
      if (S.blangko && S.blangko.jenis === "bas") toast(`Sidang diganti ke ke-${sidangUrutan()}: tanya jawab saksi dan naskah mengikuti sidang ini; isian ketikan tetap milik perkara.`);
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
      const rtf = await tungguMaks(ambilRtf(true), BATAS_LAMA_MS, "Waktu habis saat meminta naskah dari ABT.");
      const keadaanAkhir = { ...k0, ...keadaan() };
      const nomor = nomorPerkara();
      const berkas = S.blangko.berkas;
      const hasil = { rtf: biner(rtf), pdf: null, namaRtf: namaUnduhan(nomor, berkas, "rtf"), namaPdf: namaUnduhan(nomor, berkas, "pdf"), keadaan: keadaanAkhir, ttd: { dipasang: [], tidakDitemukan: [], gagal: [] } };
      if (o.pdf) {
        if (o.ttd) {
          S.ttdManual = false;
          await autoCentangTtd();
        } else S.ttdPilih = new Set();
        const t = await rtfDenganTtd(rtf);
        const { bita } = await pdfDari(t.rtf, false);
        hasil.pdf = bita;
        hasil.ttd = { dipasang: t.dipasang || [], tidakDitemukan: t.tidakDitemukan || [], gagal: t.gagal || [] };
      }
      const jam = jamSekarang();
      S.cetakTercatat[`${nomor}|${S.blangko.jenis}`] = jam;
      void tulisPenyimpanan({ [`${K_CETAK}:${nomor}|${S.blangko.jenis}`]: jam });
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

  const apiIsian = {
    versi: "tahap-F-G",
    mulai,
    pasangRekomendasi(fn) {
      rekomendasiLuar = typeof fn === "function" ? fn : null;
    },
    rekomendasi,
    /** Fungsi yang dipasang ke aletaBlangkoDerry.pasangRekomendasi (saran portal Tahap E). */
    rekomendasiPortal,
    pilihBlangko,
    /** Cetak massal (20 Okt): pengemudi satu-per-satu yang dipakai blangko-derry-massal.js. */
    massal,
    /** F4.2: buka blangko draf H-7 + pasang saran agen (tanpa menyimpan ke ABT). */
    pakaiDrafH7,
    bukaModal,
    cetak,
    /** F4.4 Putusan Advance (putusan-advance.js): RTF naskah blangko terpilih, sama dengan pratinjau/cetak; baca saja. */
    naskahRtf: (paksa) => ambilRtf(paksa),
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
      tj: Object.fromEntries(Object.entries(S.tj).map(([k, v]) => [k, { kode: v.kode, rows: v.rows.map((r) => ({ ...r })), berubah: v.berubah, sidang: v.sidang, galat: v.galat || "" }])),
      tjBuka: S.tjBuka,
      prat: { terbuka: S.prat.terbuka, memuat: S.prat.memuat, adaRtf: Boolean(S.prat.rtf), penanda: S.prat.penanda.slice(), kotor: S.prat.kotor, galat: S.prat.galat },
      fmt: { ...S.fmt },
      ttdPilih: Array.from(S.ttdPilih),
      peringat: S.peringat,
      log: S.log.slice(),
      hitung: S.susunan ? hitung() : null,
      perlu: daftarPerlu().map((b) => b.kode),
      takBerlaku: daftarTakBerlaku().map((b) => b.kode),
      tandaKosong: Array.from(S.tandaKosong),
    }),
    murni: { bersihkanHeaderPenanda, bersihkanPenutupSaksiRtf, perkiraanSidang, keadaanBerlakuMurni, rtfKeHtml, rtfKeTeks, uraiRtf, cekPenandaRtf, susunKalimatBukti, uraiBukti, kalimatBukti, jenisBukti, sisipkanTtdRtf, ukuranTtdBerlaku, berhakCap, UKURAN_TTD_CAP_BAWAAN, ukuranPng, bersihkanPenutup, gantiKalimat, mirip, keIso, namaUnduhan, hurufDiLuarAbt, normalAbt, hurufAlasanDari, nilaiSimpan8503, jenisKelompok, namaTampil, adalahBlangkoIkrar, uraikanIkrar, kumpulkanIkrar, saranIkrarCadangan, saranDariPortal, kelompokUntukSaran, barisSidangSaran, alamatEditVariabel, ramahkanAlasan, pilihVarianSaksi },
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
