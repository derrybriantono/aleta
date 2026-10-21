"use strict";

/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL - TOMBOL "JADWALKAN PUTUSAN" DAN PANELNYA (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Permintaan hakim: "fitur yang bisa dipilih tiap perkara (ketika masuk halaman perkaranya, bersebelahan dengan
 * Putusan Otomatis) atau tanggal tertentu (ketika di dashboard atau jurnal perkara gugatan/permohonan) untuk
 * upload putusan otomatis dan juga upload e-Doc putusan dan e-Doc anonimisasi. Di situ kita bisa pilih juga jam
 * berapa diupload ke server semuanya (apabila banyak ada rentang waktu yang manusiawi). Berkasnya nanti diunggah
 * ke ALETA dan ALETA yang kerjakan pada waktu yang telah ditentukan (kalau banyak bisa langsung drag sekaligus
 * dan bisa menentukan perkara mana yang terpilih)."
 *
 * Modul ini = SISI LAYAR. Ia hanya MENYUSUN jadwal: memilih perkara, menerima berkas yang diseret (diperiksa
 * dan disimpan di server, bukan ditulis ke SIPP), memasangkannya ke perkara menurut nomor di nama/isi berkas,
 * memperlihatkan pilihan form Putusan Akhir yang akan dipilih (dapat ditetapkan petugas), menghitung jam dengan
 * jeda manusiawi, lalu mengirim jadwalnya ke portal. TIDAK ADA tulisan ke SIPP dari sini.
 *
 * Yang MENJALANKAN jadwal pada waktunya:
 *   - e-Doc putusan dan e-Doc anonimisasi: pelaksana di SERVER portal (laptop tidak perlu menyala);
 *   - isi & simpan Putusan Akhir: ekstensi di peramban penjadwal yang terbuka (putusan-terjadwal-peramban.js),
 *     lewat alur Putusan Otomatis yang sama - formulir SIPP hanya aman diisi dari halamannya sendiri.
 *
 * Tempat:
 * SATU PERKARA dan MASSAL dibedakan (21 Okt 2026):
 *   - halaman perkara SIPP (SATU perkara): tombol tepat di sebelah "Putusan Otomatis" (sebelum Buka di ABT /
 *     Buka di ALETA); panel di bawah deretan tombol hanya untuk perkara itu - satu berkas, satu jam;
 *   - MASSAL, hanya di dua tempat: DASHBOARD SIPP (tombol di samping tulisan "DASHBOARD PERKARA [Statistik
 *     Perkara]") dan DAFTAR PERKARA PERDATA GUGATAN / PERMOHONAN (tombol di samping tombol "Cetak"); panel
 *     terbuka tepat di bawah tempat itu: perkara dipilih menurut tanggal sidang / tanggal putus (dapat disaring),
 *     berkas banyak diseret dan dipasangkan menurut nomor perkara, jam dengan jeda antar perkara.
 *   - SEMUA panel bawaannya TERLIPAT dan warnanya mengikuti tema terang/gelap seperti Penetapan Otomatis.
 *
 * Hak: HANYA Ketua, Wakil Ketua, dan Hakim; Super Admin (golongan admin) tetap boleh semua -
 * alatBolehTombolPutusanSipp (21 Okt 2026); server menegakkannya lagi di tiap rute. Tampilan Lama tidak
 * berubah. Tidak ada kata ALETA yang ditulis ke SIPP: teks di layar ini hanya untuk petugas.
 */
(function putusanTerjadwalModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPutusanTerjadwal) return;

  const KELAS = "aleta-sisip aleta-ptj";
  const ID_PANEL = "aleta-ptj-panel";
  const ID_MASSAL = "aleta-ptj-massal";
  const KUNCI_SETELAN = "putusanTerjadwalSetelan";
  const KUNCI_LIPAT = "lipatanBagian";
  // Kunci baru (21 Okt 2026): bawaan TERLIPAT; true = sengaja dilipat, false = sengaja dibuka petugas.
  const KUNCI_LIPAT_PANEL = "putusanTerjadwal2";
  const API = {
    dasar: "/aleta/api/aleta-ecourt/putusan-terjadwal",
    berkas: "/aleta/api/aleta-ecourt/putusan-terjadwal/berkas",
    pratinjau: "/aleta/api/aleta-ecourt/putusan-terjadwal/pratinjau",
    peramban: "/aleta/api/aleta-ecourt/putusan-terjadwal/peramban",
    ringkasan: "/aleta/api/aleta-ecourt/putusan-terjadwal/ringkasan-form",
    massal: "/aleta/api/aleta-ecourt/unggah-massal?putusan=saya",
    sidang: "/aleta/api/aleta-ecourt/sidang",
  };
  // Judul halaman SIPP: dashboard (section.content-header h1) dan daftar perkara (#pageTitle).
  const POLA_DASHBOARD = /DASHBOARD\s+PERKARA/i;
  const POLA_DAFTAR = /DAFTAR\s+PERKARA\s+(?:PERDATA\s+)?(?:GUGATAN|PERMOHONAN)\b/i;
  const BATAS_BERKAS = 10 * 1024 * 1024;
  const BENTUK = /\.(rtf|docx|doc|pdf)$/i;
  const NAMA_LANGKAH = { isi: "Isi & simpan Putusan Akhir", putusan: "e-Doc putusan", anonim: "e-Doc anonimisasi" };
  const NAMA_STATUS = {
    tidak: "tidak dipilih",
    menunggu: "menunggu",
    jalan: "mengerjakan",
    selesai: "selesai",
    dilewati: "sudah ada",
    tertahan: "tertahan",
    gagal: "gagal",
    batal: "dibatalkan",
  };
  const NADA_STATUS = { menunggu: "tunggu", jalan: "jalan", selesai: "ok", dilewati: "lewat", tertahan: "salah", gagal: "salah", batal: "lewat", tidak: "lewat" };
  const NAMA_BUTIR = { menunggu: "menunggu", jalan: "sedang dikerjakan", selesai: "selesai", sebagian: "selesai sebagian", gagal: "perlu perhatian", dibatalkan: "dibatalkan" };

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const fungsi = (nama) => (typeof globalThis[nama] === "function" ? globalThis[nama] : null);
  const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
  const p2 = (n) => String(n).padStart(2, "0");
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  function tombol(teks, kelas, judul) {
    const b = el("button", kelas, teks);
    b.type = "button";
    if (judul) b.title = judul;
    return b;
  }
  function masukan(tipe, nilai, atribut) {
    const i = document.createElement("input");
    i.type = tipe;
    if (nilai != null) i.value = nilai;
    for (const [k, v] of Object.entries(atribut || {})) i.setAttribute(k, v);
    return i;
  }
  function berlabel(teks, kontrol, kelas) {
    const l = el("label", kelas || "");
    l.append(teks ? `${teks} ` : "", kontrol);
    return l;
  }
  const pasangan = () => globalThis.aletaPutusanTerjadwalPasangan;

  /** Tanggal+jam WITA "YYYY-MM-DD HH:mm:ss" dari saat tertentu. */
  function witaDari(ms) {
    const b = {};
    for (const x of new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms))) {
      b[x.type] = x.value;
    }
    return `${b.year}-${b.month}-${b.day} ${b.hour}:${b.minute}:${b.second}`;
  }
  function tambahHari(tanggal, n) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
    return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  }
  function hariKerjaBerikut(tanggal) {
    let t = tanggal;
    for (let i = 0; i < 10; i += 1) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
      const h = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
      if (h !== 0 && h !== 6) return t;
      t = tambahHari(t, 1);
    }
    return tanggal;
  }
  const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  function sebutTanggal(tanggal) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
    if (!m) return tanggal;
    const h = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
    return `${NAMA_HARI[h]}, ${+m[3]}-${m[2]}-${m[1]}`;
  }
  function sebutWita(iso) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return "";
    const w = witaDari(ms);
    return `${sebutTanggal(w.slice(0, 10))} ${w.slice(11, 16)}`;
  }

  /** Satu permintaan ke portal. Pulang { ok, status, data, pesan, rincian }; TIDAK PERNAH melempar. */
  async function ambilJson(alamat, opsi, sebut) {
    const ambil = fungsi("alatAmbil");
    let r;
    try {
      r = ambil ? await ambil(alamat, opsi, sebut) : await fetch(alamat, opsi);
    } catch (galat) {
      return { ok: false, status: 0, data: null, pesan: sebaris((galat && galat.message) || galat) || `${sebut} gagal.`, rincian: null };
    }
    let luar = null;
    try {
      luar = await r.json();
    } catch {
      luar = null;
    }
    const data = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
    const galatPortal = luar && luar.error ? (typeof luar.error === "object" ? luar.error.message : luar.error) : "";
    const rincian = luar && luar.error && typeof luar.error === "object" ? luar.error.details || null : null;
    const pesan = sebaris((data && typeof data === "object" && (data.sebab || data.alasan || data.pesan)) || galatPortal || (luar && luar.alasan) || "");
    return { ok: Boolean(r.ok) && !(data && typeof data === "object" && data.ok === false), status: r.status, data, pesan, rincian };
  }

  function modeLama() {
    try {
      return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") === "lama";
    } catch {
      return false;
    }
  }
  async function bacaPenyimpanan(kunci) {
    try {
      return (await chrome.storage.local.get(kunci)) || {};
    } catch {
      return {};
    }
  }
  async function tulisPenyimpanan(isi) {
    try {
      await chrome.storage.local.set(isi);
    } catch {
      /* kenyamanan saja */
    }
  }

  /** Ketua, Wakil Ketua, Hakim, dan Super Admin (golongan admin); peran yang belum terbaca = tidak tampil. */
  function berhak() {
    try {
      if (typeof penggunaTerakhir === "undefined" || !penggunaTerakhir) return false;
      if (typeof alatBolehUnggahPutusan !== "function" || alatBolehUnggahPutusan(penggunaTerakhir) !== true) return false;
      if (typeof alatBolehTombolPutusanSipp === "function" && alatBolehTombolPutusanSipp(penggunaTerakhir) !== true) return false;
      return typeof boleh === "function" ? boleh("data-umum") === true : true;
    } catch {
      return false;
    }
  }

  function barisTombol(doc) {
    const kembali = (doc || document).querySelector("#submenus td#backlist");
    return kembali && kembali.parentElement ? kembali.parentElement : null;
  }
  function nomorHalaman(doc) {
    const l1 = globalThis.aletaSippIdeL1;
    try {
      const n = l1 && l1.murni && typeof l1.murni.nomorHalamanDetil === "function" ? l1.murni.nomorHalamanDetil(doc || document) : "";
      if (n) return n;
    } catch {
      /* jatuh ke konten.js */
    }
    try {
      return typeof cariNomorPerkara === "function" ? String(cariNomorPerkara() || "") : "";
    } catch {
      return "";
    }
  }
  function namaSippMasuk() {
    try {
      return typeof namaPenggunaSipp === "function" ? String(namaPenggunaSipp() || "") : "";
    } catch {
      return "";
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan
  // ──────────────────────────────────────────────────────────────────────────
  const SETELAN_BAWAAN = { jedaMin: 2, jedaMaks: 7, jamDari: "", jamSampai: "", malamBoleh: false, lintasHari: false };
  let S = null; // keadaan panel yang sedang hidup

  function keadaanBaru(mode, nomor, tempat) {
    const sekarang = witaDari(Date.now());
    const tanggalSekarang = sekarang.slice(0, 10);
    const lewatSore = sekarang.slice(11, 13) >= "15";
    const tanggal = hariKerjaBerikut(lewatSore ? tambahHari(tanggalSekarang, 1) : tanggalSekarang);
    let jam = "08:00";
    if (tanggal === tanggalSekarang) {
      const mnt = Number(sekarang.slice(11, 13)) * 60 + Number(sekarang.slice(14, 16)) + 15;
      const bulat = Math.ceil(mnt / 5) * 5;
      if (bulat > 8 * 60) jam = `${p2(Math.floor(bulat / 60))}:${p2(bulat % 60)}`;
    }
    return {
      mode,
      nomor,
      // "perkara" (satu perkara) | "dashboard" | "daftar" (massal); mode "daftar" memuat kedua tempat massal.
      tempat: tempat || (mode === "perkara" ? "perkara" : "daftar"),
      saring: "",
      terbuka: false, // bawaan TERLIPAT
      tab: "baru",
      tanggalCari: hariIniUntukCari(),
      sumberTanggal: "sidang",
      kandidat: [], // { kunci, perkaraId, nomor, jenis, ket, sudahPutus, adaPutusan, adaAnonim, dari }
      terpilih: new Set(),
      baris: new Map(), // kunci -> { langkah:{isi,putusan,anonim: true|false|null}, pilihan:{statusPutusan,verstek} }
      berkas: [], // { kunci, file, nama, ukuran, status, id, bentuk, nomorIsi, peringatan[], tolak }
      manual: {}, // kunciBerkas -> kunciPerkara|""
      ringkasanForm: {}, // berkasId -> { ada, sebab, status, verstek }
      ringkasanDiminta: {},
      statusDicoba: false,
      statusTersedia: [],
      jadwal: { tanggal, jam, batas: "", ...SETELAN_BAWAAN },
      pratinjau: null, // { benih, ok, butir:[{iso,wita}], peringatan[], sebab, kunci }
      sibuk: false,
      memuat: false,
      konfirm: false,
      pesan: null, // { jenis: 'galat'|'sukses'|'awas', teks }
      akunSipp: "",
      pilihAkun: [],
      antrean: null,
      antreanMemuat: false,
      akar: null,
      dibuatBawaan: false,
    };
  }
  function hariIniUntukCari() {
    return witaDari(Date.now()).slice(0, 10);
  }

  async function muatSetelan() {
    const s = await bacaPenyimpanan([KUNCI_SETELAN]);
    const x = s && s[KUNCI_SETELAN] && typeof s[KUNCI_SETELAN] === "object" ? s[KUNCI_SETELAN] : {};
    if (!S) return;
    const j = S.jadwal;
    if (Number(x.jedaMin) >= 1 && Number(x.jedaMin) <= 60) j.jedaMin = Number(x.jedaMin);
    if (Number(x.jedaMaks) >= 1 && Number(x.jedaMaks) <= 60) j.jedaMaks = Number(x.jedaMaks);
    if (typeof x.jamDari === "string") j.jamDari = x.jamDari;
    if (typeof x.jamSampai === "string") j.jamSampai = x.jamSampai;
    j.lintasHari = x.lintasHari === true;
    j.malamBoleh = x.malamBoleh === true;
    gambarJam();
  }
  function simpanSetelan() {
    if (!S) return;
    const { jedaMin, jedaMaks, jamDari, jamSampai, lintasHari, malamBoleh } = S.jadwal;
    void tulisPenyimpanan({ [KUNCI_SETELAN]: { jedaMin, jedaMaks, jamDari, jamSampai, lintasHari, malamBoleh } });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Perkara: halaman perkara, tanggal, dan baris di halaman
  // ──────────────────────────────────────────────────────────────────────────
  const baku = (n) => (pasangan() ? pasangan().baku(n) : String(n || "").toLowerCase());

  function tambahKandidat(k) {
    const kunci = baku(k.nomor);
    if (!kunci) return null;
    let ada = S.kandidat.find((x) => x.kunci === kunci);
    if (ada) {
      // Keterangan yang lebih lengkap menggantikan; perkaraId yang sudah dikenal dipertahankan.
      ada = Object.assign(ada, { ...k, kunci, perkaraId: k.perkaraId || ada.perkaraId });
      return ada;
    }
    const baru = { kunci, perkaraId: "", jenis: "", ket: "", sudahPutus: false, adaPutusan: false, adaAnonim: false, dari: "", ...k };
    baru.kunci = kunci;
    S.kandidat.push(baru);
    return baru;
  }
  function pilih(kunci, ya) {
    if (ya) {
      S.terpilih.add(kunci);
      if (!S.baris.has(kunci)) {
        const k = S.kandidat.find((x) => x.kunci === kunci);
        S.baris.set(kunci, { langkah: { isi: k && k.sudahPutus ? false : null, putusan: null, anonim: null }, pilihan: { statusPutusan: "", verstek: "" } });
      }
    } else S.terpilih.delete(kunci);
  }

  async function perkaraIdUntuk(nomor) {
    const cari = fungsi("a30PerkaraIdUntukAbt");
    if (!cari) return "";
    try {
      const id = String((await cari(nomor)) || "");
      return /^\d+$/.test(id) ? id : "";
    } catch {
      return "";
    }
  }

  async function muatKandidatTanggal() {
    if (S.memuat) return;
    const tgl = S.tanggalCari;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
      S.pesan = { jenis: "galat", teks: "Tanggal belum sah." };
      gambarPesan();
      return;
    }
    S.memuat = true;
    S.pesan = { jenis: "awas", teks: `Membaca perkara untuk ${sebutTanggal(tgl)}…` };
    gambarPesan();
    gambarKandidat();
    const tambah = [];
    const galat = [];
    try {
      // 1. Sidang pada tanggal itu (Jadwal Sidang): yang bertanggal sidang itu, sudah diputus atau belum.
      if (S.sumberTanggal === "sidang") {
        const sidang = fungsi("alatSidangPadaTanggal");
        if (sidang) {
          try {
            for (const s of await sidang(tgl)) {
              tambah.push({
                nomor: s.nomor,
                perkaraId: /^\d+$/.test(String(s.perkaraId || "")) ? String(s.perkaraId) : "",
                jenis: s.jenis,
                ket: `sidang ${s.jam || ""} · ${s.agenda || "tanpa agenda"}${s.sudahPutus ? " · sudah diputus di SIPP" : ""}`.replace(/\s+/g, " "),
                sudahPutus: Boolean(s.sudahPutus),
                putusAgenda: /utus/i.test(String(s.agenda || "")),
                majelis: sebaris(s.majelis || ""),
                dari: "sidang",
              });
            }
          } catch (g) {
            galat.push(sebaris((g && g.message) || g));
          }
        }
      }
      // 2. Putusan SAYA yang e-Doc-nya menunggu (sudah diputus) dan sidang putusan yang belum diisi (tertahan).
      const m = await ambilJson(API.massal, { credentials: "include", cache: "no-store" }, "Membaca perkara putusan");
      if (m.ok && m.data) {
        for (const x of Array.isArray(m.data.putusan) ? m.data.putusan : []) {
          if (S.sumberTanggal === "putus" ? x.tanggalPutusan === tgl : false) {
            tambah.push({
              nomor: x.nomorPerkara,
              perkaraId: String(x.perkaraId || ""),
              jenis: x.jenisPerkara,
              ket: `diputus ${x.tanggalPutusan}${x.statusPutusan ? ` · ${x.statusPutusan}` : ""} · e-Doc menunggu`,
              sudahPutus: true,
              adaPutusan: Boolean(x.adaPutusan),
              adaAnonim: Boolean(x.adaAnonim),
              dari: "putus",
            });
          }
        }
        for (const x of Array.isArray(m.data.tertahan) ? m.data.tertahan : []) {
          if (S.sumberTanggal === "sidang" && x.tanggalSidang === tgl) {
            tambah.push({
              nomor: x.nomorPerkara,
              perkaraId: String(x.perkaraId || ""),
              jenis: "",
              ket: `sidang putusan ${x.tanggalSidang} · Putusan Akhir belum diisi di SIPP`,
              sudahPutus: false,
              dari: "tertahan",
            });
          }
        }
      } else if (!m.ok && S.sumberTanggal === "putus") {
        galat.push(m.pesan || "Daftar putusan belum dapat dibaca.");
      }
    } finally {
      S.memuat = false;
    }
    for (const k of tambah) tambahKandidat(k);
    // Bawaan: sidang beragenda putusan yang belum diputus, dan putusan yang e-Doc-nya menunggu, langsung tercentang.
    for (const k of tambah) {
      const c = S.kandidat.find((x) => x.kunci === baku(k.nomor));
      if (!c) continue;
      const bawaan = k.dari === "putus" || k.dari === "tertahan" || (k.dari === "sidang" && !k.sudahPutus && k.putusAgenda);
      if (bawaan) pilih(c.kunci, true);
    }
    S.pesan = galat.length
      ? { jenis: "awas", teks: `Sebagian belum terbaca: ${galat.join("; ")}` }
      : tambah.length
        ? { jenis: "sukses", teks: `${tambah.length} perkara untuk ${sebutTanggal(tgl)}. Yang tercentang sudah dipilihkan; ubah sesuai kebutuhan.` }
        : { jenis: "awas", teks: `Tidak ada perkara untuk ${sebutTanggal(tgl)} menurut ${S.sumberTanggal === "putus" ? "tanggal putus" : "tanggal sidang"}.` };
    gambarSemua();
    segarkanPasangan();
  }

  function tambahDariHalaman() {
    const baris = fungsi("barisPerkaraDiHalaman");
    let n = 0;
    if (baris) {
      try {
        for (const b of baris()) {
          const k = tambahKandidat({ nomor: b.nomor, ket: "di halaman ini", dari: "halaman" });
          if (k) {
            pilih(k.kunci, true);
            n += 1;
          }
        }
      } catch {
        /* halaman tanpa daftar */
      }
    }
    S.pesan = n ? { jenis: "sukses", teks: `${n} perkara di halaman ini ditambahkan.` } : { jenis: "awas", teks: "Tidak ada baris perkara yang terbaca di halaman ini." };
    gambarSemua();
    segarkanPasangan();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Berkas: diseret, diperiksa, diunggah ke server
  // ──────────────────────────────────────────────────────────────────────────
  let urutBerkas = 0;
  function tambahBerkas(daftar) {
    const baru = [];
    // SATU perkara: hanya satu berkas; berkas baru menggantikan yang lama (yang lama dibuang dari server).
    let masuk = Array.from(daftar || []);
    if (S.mode === "perkara" && masuk.length) {
      masuk = masuk.slice(0, 1);
      for (const lama of [...S.berkas]) void buangBerkas(lama.kunci);
    }
    for (const file of masuk) {
      const nama = String((file && file.name) || "");
      const e = { kunci: `b${(urutBerkas += 1)}`, file, nama, ukuran: file.size || 0, status: "antre", id: "", bentuk: "", nomorIsi: "", peringatan: [], tolak: "" };
      const bukanNaskah = pasangan() ? pasangan().tandaBukanNaskah(nama) : "";
      if (!BENTUK.test(nama)) {
        e.status = "ditolak";
        e.tolak = "bukan RTF, DOCX, DOC, atau PDF";
      } else if (bukanNaskah) {
        e.status = "ditolak";
        e.tolak = `bukan naskah putusan: ${bukanNaskah}`;
      } else if (pasangan() && pasangan().namaAnonim(nama)) {
        e.status = "ditolak";
        e.tolak = "anonimisasi dibuat otomatis dari putusan, jadi berkas ini tidak dipakai";
      } else if (e.ukuran > BATAS_BERKAS) {
        e.status = "ditolak";
        e.tolak = "lebih dari 10 MB";
      } else if (e.ukuran === 0) {
        e.status = "ditolak";
        e.tolak = "berkas kosong";
      } else if (S.berkas.some((x) => x.nama === nama && x.ukuran === e.ukuran && x.status !== "ditolak")) {
        e.status = "ditolak";
        e.tolak = "sudah ada dalam daftar";
      }
      S.berkas.push(e);
      baru.push(e);
    }
    gambarBerkas();
    void unggahAntrean();
    return baru;
  }

  let sedangUnggah = false;
  async function unggahAntrean() {
    if (sedangUnggah) return;
    sedangUnggah = true;
    try {
      for (;;) {
        const e = S && S.berkas.find((x) => x.status === "antre");
        if (!e) break;
        e.status = "periksa";
        gambarBerkas();
        await unggahSatu(e);
        gambarBerkas();
        segarkanPasangan();
      }
    } finally {
      sedangUnggah = false;
    }
  }

  async function unggahSatu(e) {
    const deteksi = globalThis.aletaDeteksiSisa;
    if (deteksi && typeof deteksi.tinjau === "function") {
      let lanjut = true;
      try {
        const h = await deteksi.tinjau(e.file, { nama: e.nama, jenis: "putusan", aksi: "unggah", massal: true });
        lanjut = !h || h.lanjut !== false;
      } catch {
        lanjut = true;
      }
      if (!lanjut) {
        e.status = "ditolak";
        e.tolak = "dibatalkan karena masih ada sisa blangko";
        return;
      }
    }
    e.status = "unggah";
    gambarBerkas();
    const badan = new FormData();
    badan.append("berkas", e.file, e.nama);
    const r = await ambilJson(API.berkas, { method: "POST", credentials: "include", body: badan, batasMs: 120000 }, "Mengunggah berkas putusan");
    const d = r.data && typeof r.data === "object" ? r.data : {};
    if (!r.ok || !d.berkas) {
      e.status = "ditolak";
      e.tolak = d.sebab || r.pesan || "ditolak server";
      return;
    }
    e.status = "ok";
    e.id = d.berkas.id;
    e.bentuk = d.berkas.bentuk;
    e.nomorIsi = d.berkas.nomorIsi || "";
    e.peringatan = Array.isArray(d.berkas.peringatan) ? d.berkas.peringatan : [];
    // SATU perkara: berkas ini pasti milik perkara yang dibuka - dipasang tanpa menunggu nomor di nama/isi.
    if (S.mode === "perkara" && S.kandidat[0]) S.manual[e.kunci] = S.kandidat[0].kunci;
  }

  async function buangBerkas(kunci) {
    const i = S.berkas.findIndex((x) => x.kunci === kunci);
    if (i < 0) return;
    const e = S.berkas[i];
    S.berkas.splice(i, 1);
    delete S.manual[kunci];
    gambarBerkas();
    segarkanPasangan();
    if (e.id) await ambilJson(`${API.berkas}?id=${encodeURIComponent(e.id)}`, { method: "DELETE", credentials: "include" }, "Membuang berkas");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan berkas -> perkara, ringkasan form, pratinjau jam
  // ──────────────────────────────────────────────────────────────────────────
  function hasilPasangan() {
    const p = pasangan();
    if (!p) return [];
    const perkara = S.kandidat.filter((k) => S.terpilih.has(k.kunci)).map((k) => ({ kunci: k.kunci, nomor: k.nomor }));
    return p.pasangkan({
      berkas: S.berkas.filter((b) => b.status === "ok").map((b) => ({ kunci: b.kunci, nama: b.nama, nomorIsi: b.nomorIsi, bentuk: b.bentuk })),
      perkara,
      manual: S.manual,
    });
  }
  function berkasUntuk(kunciPerkara) {
    const h = hasilPasangan().find((x) => x.status === "cocok" && x.perkaraKunci === kunciPerkara);
    return h ? S.berkas.find((b) => b.kunci === h.kunci && b.status === "ok") || null : null;
  }

  let pewaktuPasangan = null;
  function segarkanPasangan() {
    gambarBerkas();
    gambarBaris();
    gambarKaki();
    clearTimeout(pewaktuPasangan);
    pewaktuPasangan = setTimeout(() => {
      void muatRingkasanForm();
      void muatPratinjau();
    }, 350);
  }

  async function muatRingkasanForm() {
    if (!S) return;
    const perlu = [];
    for (const k of S.kandidat) {
      if (!S.terpilih.has(k.kunci)) continue;
      const b = berkasUntuk(k.kunci);
      if (b && !S.ringkasanForm[b.id] && !(b.id in S.ringkasanDiminta)) {
        perlu.push({ berkasId: b.id, jenisPerkara: k.jenis || "" });
        S.ringkasanDiminta[b.id] = true;
      }
    }
    if (!perlu.length && (S.statusTersedia.length || S.statusDicoba)) return;
    S.statusDicoba = true;
    const r = await ambilJson(API.ringkasan, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ berkas: perlu }) }, "Membaca pilihan form");
    if (!S) return;
    if (r.ok && r.data) {
      if (Array.isArray(r.data.statusTersedia) && r.data.statusTersedia.length) S.statusTersedia = r.data.statusTersedia;
      Object.assign(S.ringkasanForm, r.data.ringkasan || {});
      gambarBaris();
    }
  }

  function barisTermasuk() {
    return S.kandidat.filter((k) => S.terpilih.has(k.kunci)).filter((k) => langkahEfektif(k).ada);
  }
  function langkahEfektif(k) {
    const b = S.baris.get(k.kunci) || { langkah: {}, pilihan: {} };
    const berkas = berkasUntuk(k.kunci);
    const isi = b.langkah.isi == null ? !k.sudahPutus : b.langkah.isi === true;
    const putusan = berkas ? (b.langkah.putusan == null ? !k.adaPutusan : b.langkah.putusan === true) : false;
    const anonim = berkas ? (b.langkah.anonim == null ? !k.adaAnonim : b.langkah.anonim === true) : false;
    return { isi, putusan, anonim, berkas, ada: isi || putusan || anonim };
  }

  function bodyJam() {
    const j = S.jadwal;
    return {
      mulai: `${j.tanggal} ${j.jam}`,
      ...(j.batas && !j.lintasHari ? { batasAkhir: `${j.tanggal} ${j.batas}` } : {}),
      jedaMin: Math.round(Number(j.jedaMin) * 60),
      jedaMaks: Math.round(Number(j.jedaMaks) * 60),
      ...(j.jamDari ? { jamDari: j.jamDari } : {}),
      ...(j.jamSampai ? { jamSampai: j.jamSampai } : {}),
      malamBoleh: j.malamBoleh === true,
      lintasHari: j.lintasHari === true,
    };
  }

  let nomorPratinjau = 0;
  let acakUlang = false;
  async function muatPratinjau() {
    if (!S) return;
    const jumlah = barisTermasuk().length;
    if (jumlah === 0 || !S.jadwal.tanggal || !S.jadwal.jam) {
      S.pratinjau = null;
      gambarBaris();
      gambarJam();
      gambarKaki();
      return;
    }
    const sidik = JSON.stringify([jumlah, bodyJam()]);
    if (S.pratinjau && S.pratinjau.sidik === sidik && !acakUlang) return;
    const urut = (nomorPratinjau += 1);
    const benih = acakUlang || !S.pratinjau ? undefined : S.pratinjau.benih;
    acakUlang = false;
    const r = await ambilJson(
      API.pratinjau,
      { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jumlah, ...bodyJam(), ...(benih ? { benih } : {}) }) },
      "Menghitung jam"
    );
    if (!S || urut !== nomorPratinjau) return;
    const d = r.data && typeof r.data === "object" ? r.data : {};
    S.pratinjau = r.status
      ? { sidik, benih: d.benih, ok: d.ok === true, butir: Array.isArray(d.butir) ? d.butir : [], peringatan: Array.isArray(d.peringatan) ? d.peringatan : [], sebab: d.sebab || r.pesan || "", tidakMuat: d.tidakMuat || 0 }
      : { sidik, benih: 0, ok: false, butir: [], peringatan: [], sebab: r.pesan || "Jam belum dapat dihitung.", tidakMuat: jumlah };
    gambarBaris();
    gambarJam();
    gambarKaki();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gambar
  // ──────────────────────────────────────────────────────────────────────────
  function buatKerangka() {
    const mode = S.mode;
    const akar = el("section", `${KELAS} aleta-ptj-panel aleta-ptj-${mode === "perkara" ? "tunggal" : "massal-panel"}`);
    akar.id = ID_PANEL;
    akar.setAttribute("role", "region");
    akar.setAttribute("aria-label", "Jadwalkan Putusan");
    akar.setAttribute("data-ptj", "panel");

    const kepala = el("div", "aleta-ptj-kepala");
    const h = el("h2", "aleta-ptj-judul");
    h.append(mode === "perkara" ? "Jadwalkan Putusan" : "Jadwalkan Putusan Massal");
    if (S.nomor) h.append(" · ", el("span", "aleta-ptj-mono", S.nomor));
    kepala.append(
      h,
      el(
        "div",
        "aleta-ptj-catatan",
        mode === "perkara"
          ? "Berkas diunggah ke server dan dikerjakan pada jam yang dipilih. " +
              "e-Doc diunggah server (laptop tidak perlu menyala); mengisi & menyimpan Putusan Akhir dikerjakan lewat SIPP yang terbuka di peramban ini."
          : "Pilih banyak perkara, seret banyak berkas (dipasangkan otomatis menurut nomor perkara), lalu tentukan jam. Berkas diunggah ke server dan dikerjakan pada jam yang dipilih, dengan jeda antar perkara yang wajar. " +
              "e-Doc diunggah server (laptop tidak perlu menyala); mengisi & menyimpan Putusan Akhir dikerjakan lewat SIPP yang terbuka di peramban ini."
      )
    );
    const tab = el("div", "aleta-ptj-tab");
    tab.setAttribute("role", "tablist");
    const tBaru = tombol("Jadwal baru", "", "");
    tBaru.setAttribute("role", "tab");
    tBaru.setAttribute("data-ptj", "tab-baru");
    tBaru.addEventListener("click", () => {
      S.tab = "baru";
      gambarTab();
    });
    const tAntrean = tombol("Antrean terjadwal", "", "");
    tAntrean.setAttribute("role", "tab");
    tAntrean.setAttribute("data-ptj", "tab-antrean");
    tAntrean.addEventListener("click", () => {
      S.tab = "antrean";
      gambarTab();
      void muatAntrean();
    });
    tab.append(tBaru, tAntrean);

    const pesan = el("div", "aleta-ptj-pesan");
    pesan.setAttribute("aria-live", "polite");
    pesan.setAttribute("data-ptj", "pesan");

    const badanBaru = el("div", "aleta-ptj-badan");
    badanBaru.setAttribute("data-ptj", "badan-baru");
    const rPerkara = el("div", "aleta-ptj-bagian");
    rPerkara.setAttribute("data-ptj", "bagian-perkara");
    const rBerkas = el("div", "aleta-ptj-bagian");
    rBerkas.setAttribute("data-ptj", "bagian-berkas");
    const rBaris = el("div", "aleta-ptj-bagian");
    rBaris.setAttribute("data-ptj", "bagian-baris");
    const rJam = el("div", "aleta-ptj-bagian");
    rJam.setAttribute("data-ptj", "bagian-jam");
    const rKonfirm = el("div", "aleta-ptj-konfirm-wadah");
    badanBaru.append(rPerkara, rBerkas, rBaris, rJam, rKonfirm);

    const badanAntrean = el("div", "aleta-ptj-badan");
    badanAntrean.setAttribute("data-ptj", "badan-antrean");

    const kaki = el("div", "aleta-ptj-kaki");
    kaki.setAttribute("data-ptj", "kaki");

    akar.append(kepala, tab, pesan, badanBaru, badanAntrean, kaki);
    S.akar = akar;
    S.r = { tab, tBaru, tAntrean, pesan, badanBaru, badanAntrean, perkara: rPerkara, berkas: rBerkas, baris: rBaris, jam: rJam, konfirm: rKonfirm, kaki };
    bangunJam();
    return akar;
  }

  function gambarSemua() {
    if (!S || !S.akar) return;
    gambarTab();
    gambarPesan();
    gambarKandidat();
    gambarBerkas();
    gambarBaris();
    gambarJam();
    gambarKonfirm();
    gambarKaki();
  }

  function gambarTab() {
    if (!S || !S.r) return;
    const { tBaru, tAntrean, badanBaru, badanAntrean, kaki } = S.r;
    tBaru.setAttribute("aria-selected", S.tab === "baru" ? "true" : "false");
    tAntrean.setAttribute("aria-selected", S.tab === "antrean" ? "true" : "false");
    badanBaru.hidden = S.tab !== "baru";
    badanAntrean.hidden = S.tab !== "antrean";
    kaki.hidden = S.tab !== "baru";
    const n = S.antrean && S.antrean.ringkasan ? Number(S.antrean.ringkasan.belumDilihat || 0) + Number(S.antrean.ringkasan.menunggu || 0) : 0;
    tAntrean.textContent = n ? `Antrean terjadwal (${n})` : "Antrean terjadwal";
  }

  function gambarPesan() {
    if (!S || !S.r) return;
    const p = S.r.pesan;
    p.textContent = "";
    if (S.pesan && S.pesan.teks) {
      const kelas = S.pesan.jenis === "galat" ? "aleta-ptj-galat" : S.pesan.jenis === "sukses" ? "aleta-ptj-sukses" : "aleta-ptj-awas";
      const k = el("div", kelas, S.pesan.teks);
      k.style.margin = "8px 16px 0";
      p.appendChild(k);
    }
  }

  /** Kandidat yang lolos saringan teks (nomor, jenis, keterangan, majelis). */
  function kandidatTersaring() {
    const kata = String((S && S.saring) || "").toLowerCase().trim();
    if (!kata) return S.kandidat;
    return S.kandidat.filter((k) => [k.nomor, k.jenis, k.ket, k.majelis].some((x) => String(x || "").toLowerCase().includes(kata)));
  }

  // 1. Perkara
  function gambarKandidat() {
    if (!S || !S.r) return;
    const wadah = S.r.perkara;
    wadah.textContent = "";
    const judul = el("h3");
    judul.append(el("span", "aleta-ptj-no", "1"), S.mode === "daftar" ? "Pilih perkara" : "Perkara");
    wadah.appendChild(judul);

    if (S.mode === "daftar") {
      wadah.appendChild(
        el(
          "div",
          "aleta-ptj-bantu",
          S.tempat === "dashboard"
            ? "Pilih menurut tanggal sidang atau tanggal putus, lalu centang perkara yang akan dijadwalkan."
            : "Pilih menurut tanggal, atau tambahkan baris perkara yang sedang tampil di halaman ini."
        )
      );
      const baris = el("div", "aleta-ptj-baris-aksi");
      const tgl = masukan("date", S.tanggalCari);
      tgl.setAttribute("data-ptj", "tanggal-cari");
      tgl.setAttribute("aria-label", "Tanggal");
      tgl.addEventListener("change", () => {
        S.tanggalCari = tgl.value;
      });
      const sumber = document.createElement("select");
      sumber.setAttribute("data-ptj", "sumber-tanggal");
      sumber.setAttribute("aria-label", "Menurut");
      for (const [nilai, teks] of [["sidang", "Menurut tanggal sidang"], ["putus", "Menurut tanggal putus"]]) {
        const o = document.createElement("option");
        o.value = nilai;
        o.textContent = teks;
        sumber.appendChild(o);
      }
      sumber.value = S.sumberTanggal;
      sumber.addEventListener("change", () => {
        S.sumberTanggal = sumber.value;
      });
      const muat = tombol("Tampilkan perkara", "aleta-ptj-tombol-kecil");
      muat.setAttribute("data-ptj", "muat-tanggal");
      muat.disabled = S.memuat;
      muat.addEventListener("click", () => void muatKandidatTanggal());
      const hari = tombol("Hari ini", "aleta-ptj-sekunder");
      hari.addEventListener("click", () => {
        S.tanggalCari = hariIniUntukCari();
        tgl.value = S.tanggalCari;
      });
      baris.append(tgl, sumber, hari, muat);
      if (S.tempat === "daftar") {
        const dariHalaman = tombol("Tambahkan perkara di halaman ini", "aleta-ptj-sekunder");
        dariHalaman.setAttribute("data-ptj", "dari-halaman");
        dariHalaman.addEventListener("click", tambahDariHalaman);
        baris.appendChild(dariHalaman);
      }
      wadah.appendChild(baris);
      // Saring daftar yang sudah terbaca: nomor, jenis, keterangan (tanggal putus / sidang), atau majelis.
      const sar = masukan("search", S.saring, { placeholder: "Saring: nomor, jenis, tanggal putus, majelis", "aria-label": "Saring perkara" });
      sar.setAttribute("data-ptj", "saring");
      sar.addEventListener("input", () => {
        S.saring = sar.value;
        gambarKandidat();
        const f = document.querySelector("#aleta-ptj-panel [data-ptj='saring']");
        if (f && f.focus) {
          f.focus();
          try {
            f.setSelectionRange(S.saring.length, S.saring.length);
          } catch {
            /* tipe search tanpa seleksi */
          }
        }
      });
      const barisSaring = el("div", "aleta-ptj-baris-aksi");
      barisSaring.appendChild(sar);
      wadah.appendChild(barisSaring);
    } else {
      wadah.appendChild(el("div", "aleta-ptj-bantu", "Hanya untuk perkara yang sedang dibuka ini."));
    }

    const daftar = el("div", "aleta-ptj-kandidat");
    daftar.setAttribute("data-ptj", "kandidat");
    if (!S.kandidat.length) {
      daftar.appendChild(el("div", "aleta-ptj-ket", S.mode === "daftar" ? "Belum ada perkara. Pilih tanggal lalu tekan Tampilkan perkara." : "Perkara halaman ini belum terbaca."));
    }
    const tampil = kandidatTersaring();
    if (S.mode === "daftar" && S.kandidat.length && !tampil.length) {
      daftar.appendChild(el("div", "aleta-ptj-ket", "Tidak ada perkara yang cocok dengan saringan."));
    }
    for (const k of tampil) {
      const lab = el("label");
      const cek = masukan("checkbox");
      cek.checked = S.terpilih.has(k.kunci);
      cek.setAttribute("data-ptj-kandidat", k.kunci);
      cek.addEventListener("change", () => {
        pilih(k.kunci, cek.checked);
        segarkanPasangan();
      });
      const isi = el("span");
      isi.append(el("span", "aleta-ptj-nomor", k.nomor), k.jenis ? ` · ${k.jenis}` : "");
      lab.append(cek, isi, el("span", "aleta-ptj-ket", k.ket || ""));
      daftar.appendChild(lab);
    }
    wadah.appendChild(daftar);
    if (S.kandidat.length > 1) {
      const aksi = el("div", "aleta-ptj-baris-aksi");
      const semua = tombol(S.saring ? "Centang yang tampil" : "Centang semua", "aleta-ptj-sekunder");
      semua.addEventListener("click", () => {
        for (const k of kandidatTersaring()) pilih(k.kunci, true);
        gambarKandidat();
        segarkanPasangan();
      });
      const kosong = tombol("Kosongkan", "aleta-ptj-sekunder");
      kosong.addEventListener("click", () => {
        S.terpilih.clear();
        gambarKandidat();
        segarkanPasangan();
      });
      aksi.append(semua, kosong, el("span", "aleta-ptj-ket", `${S.terpilih.size} dari ${S.kandidat.length} dipilih${S.saring ? ` · ${tampil.length} tampil` : ""}`));
      wadah.appendChild(aksi);
    }
  }

  // 2. Berkas
  function gambarBerkas() {
    if (!S || !S.r) return;
    const wadah = S.r.berkas;
    wadah.textContent = "";
    const judul = el("h3");
    const tunggal = S.mode === "perkara";
    judul.append(el("span", "aleta-ptj-no", "2"), tunggal ? "Berkas putusan perkara ini" : "Berkas putusan (seret banyak sekaligus)");
    wadah.appendChild(judul);

    const zona = el("div", "aleta-ptj-zona");
    zona.setAttribute("data-ptj", "zona");
    zona.append(
      el("strong", "", tunggal ? "Seret berkas putusan ke sini, atau pilih" : "Seret berkas putusan ke sini"),
      el(
        "span",
        "aleta-ptj-bantu",
        tunggal
          ? "RTF, DOCX, DOC, atau PDF · paling besar 10 MB · satu berkas untuk perkara ini"
          : "RTF, DOCX, DOC, atau PDF · paling banyak 10 MB per berkas · dipasangkan otomatis menurut nomor perkara di nama dan isi berkas"
      )
    );
    const pilihBerkas = masukan("file", null, { ...(tunggal ? {} : { multiple: "multiple" }), accept: ".rtf,.docx,.doc,.pdf", "aria-label": "Pilih berkas putusan" });
    pilihBerkas.setAttribute("data-ptj", "pilih-berkas");
    pilihBerkas.addEventListener("change", () => {
      tambahBerkas(pilihBerkas.files);
      pilihBerkas.value = "";
    });
    zona.appendChild(pilihBerkas);
    const sorot = (ya) => zona.setAttribute("data-sorot", ya ? "1" : "0");
    zona.addEventListener("dragenter", (e) => {
      e.preventDefault();
      sorot(true);
    });
    zona.addEventListener("dragover", (e) => {
      e.preventDefault();
      sorot(true);
    });
    zona.addEventListener("dragleave", () => sorot(false));
    zona.addEventListener("drop", (e) => {
      e.preventDefault();
      sorot(false);
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) tambahBerkas(dt.files);
    });
    wadah.appendChild(zona);

    if (!S.berkas.length) return;
    const hasil = hasilPasangan();
    const daftar = el("div", "aleta-ptj-berkas-daftar");
    daftar.setAttribute("data-ptj", "berkas-daftar");
    const terpilih = S.kandidat.filter((k) => S.terpilih.has(k.kunci));
    for (const e of S.berkas) {
      const h = hasil.find((x) => x.kunci === e.kunci);
      const status = e.status === "ok" ? (h ? h.status : "tanpa-nomor") : e.status === "ditolak" ? "ditolak" : "periksa";
      const baris = el("div", "aleta-ptj-berkas");
      baris.setAttribute("data-status", status);
      baris.setAttribute("data-ptj-berkas", e.nama);
      const kiri = el("div");
      kiri.append(el("div", "aleta-ptj-nama", e.nama), el("div", "aleta-ptj-ket", `${e.bentuk ? e.bentuk.toUpperCase() + " · " : ""}${Math.max(1, Math.round(e.ukuran / 1024))} KB${e.nomorIsi ? ` · isi menyebut ${e.nomorIsi}` : ""}`));
      const tengah = el("div");
      if (e.status === "antre" || e.status === "periksa" || e.status === "unggah") {
        tengah.appendChild(el("span", "aleta-ptj-chip aleta-ptj-c-jalan", e.status === "antre" ? "menunggu giliran unggah" : e.status === "periksa" ? "memeriksa…" : "mengunggah…"));
      } else if (e.status === "ditolak") {
        tengah.appendChild(el("span", "aleta-ptj-chip aleta-ptj-c-salah", `ditolak · ${e.tolak}`));
      } else if (h && h.status === "cocok") {
        const k = S.kandidat.find((x) => x.kunci === h.perkaraKunci);
        tengah.appendChild(el("span", "aleta-ptj-chip aleta-ptj-c-ok", `cocok · ${k ? k.nomor : ""} (${h.sumber})`));
      } else {
        const nada = h && (h.status === "konflik" || h.status === "ganda") ? "salah" : "tunggu";
        tengah.appendChild(el("span", `aleta-ptj-chip aleta-ptj-c-${nada}`, h ? ({ konflik: "nama dan isi berbeda", ganda: "ganda", "tidak-cocok": "tidak cocok", "tanpa-nomor": "tanpa nomor", "bukan-naskah": "bukan naskah putusan", anonim: "anonimisasi (tidak dipakai)" }[h.status] || h.status) : "belum dipasang"));
        if (h && h.sebab) tengah.appendChild(el("div", "aleta-ptj-ket", h.sebab));
      }
      for (const p of e.peringatan || []) tengah.appendChild(el("div", "aleta-ptj-ket", p));
      const kanan = el("div", "aleta-ptj-aksi-baris");
      if (e.status === "ok" && h && h.status !== "bukan-naskah" && h.status !== "anonim") {
        // Pasang manual ke perkara terpilih.
        const sel = document.createElement("select");
        sel.setAttribute("aria-label", `Pasangkan ${e.nama} ke perkara`);
        sel.setAttribute("data-ptj-pasang", e.kunci);
        const kosong = document.createElement("option");
        kosong.value = "";
        kosong.textContent = h.status === "cocok" ? "Ganti perkara…" : "Pasangkan ke…";
        sel.appendChild(kosong);
        for (const k of terpilih) {
          const o = document.createElement("option");
          o.value = k.kunci;
          o.textContent = k.nomor;
          sel.appendChild(o);
        }
        sel.addEventListener("change", () => {
          if (sel.value) {
            S.manual[e.kunci] = sel.value;
            segarkanPasangan();
          }
        });
        kanan.appendChild(sel);
        // Perkara yang disebut berkas tetapi belum terpilih: tawarkan menambahkannya.
        const nomorSebut = (h.status === "tidak-cocok" && (h.nomorNama || h.nomorIsi)) || "";
        if (nomorSebut) {
          const tambah = tombol("Tambahkan perkara ini", "aleta-ptj-sekunder");
          tambah.setAttribute("data-ptj-tambah-perkara", e.kunci);
          tambah.addEventListener("click", async () => {
            tambah.disabled = true;
            const id = await perkaraIdUntuk(nomorSebut);
            const k = tambahKandidat({ nomor: nomorSebut, perkaraId: id, ket: "dari nomor di berkas", dari: "berkas" });
            if (k) pilih(k.kunci, true);
            if (!id) S.pesan = { jenis: "awas", teks: `Nomor induk ${nomorSebut} belum terbaca dari SIPP; akan dicoba lagi saat menjadwalkan.` };
            gambarSemua();
            segarkanPasangan();
          });
          kanan.appendChild(tambah);
        }
      }
      const buang = tombol("Buang", "aleta-ptj-sekunder");
      buang.setAttribute("aria-label", `Buang ${e.nama}`);
      buang.addEventListener("click", () => void buangBerkas(e.kunci));
      kanan.appendChild(buang);
      baris.append(kiri, tengah, kanan);
      daftar.appendChild(baris);
    }
    wadah.appendChild(daftar);
    const ring = pasangan() ? pasangan().ringkas(hasil) : {};
    const bagian = [];
    if (ring.cocok) bagian.push(`${ring.cocok} cocok`);
    if (ring.konflik) bagian.push(`${ring.konflik} nama/isi berbeda`);
    if (ring.ganda) bagian.push(`${ring.ganda} ganda`);
    if (ring["tidak-cocok"]) bagian.push(`${ring["tidak-cocok"]} tidak cocok`);
    if (ring["tanpa-nomor"]) bagian.push(`${ring["tanpa-nomor"]} tanpa nomor`);
    if (ring["bukan-naskah"]) bagian.push(`${ring["bukan-naskah"]} bukan naskah putusan`);
    wadah.appendChild(el("div", "aleta-ptj-ket", `${S.berkas.length} berkas · ${bagian.join(" · ") || "belum dipasangkan"}`));
  }

  // 3. Langkah dan pilihan per perkara
  function gambarBaris() {
    if (!S || !S.r) return;
    const wadah = S.r.baris;
    wadah.textContent = "";
    const judul = el("h3");
    judul.append(el("span", "aleta-ptj-no", "3"), S.mode === "perkara" ? "Langkah dan pilihan form" : "Langkah, pilihan form, dan jam tiap perkara");
    wadah.appendChild(judul);
    const terpilih = S.kandidat.filter((k) => S.terpilih.has(k.kunci));
    if (!terpilih.length) {
      wadah.appendChild(el("div", "aleta-ptj-ket", "Belum ada perkara yang dipilih."));
      return;
    }
    wadah.appendChild(
      el(
        "div",
        "aleta-ptj-bantu",
        "Pilihan form dibenarkan otomatis dari amar naskah, dengan aturan yang sama dengan Putusan Otomatis. Yang Anda tetapkan di sini dipasang lebih dulu; ALETA hanya mengubahnya bila naskah menyebut sebaliknya dengan tegas, dan praperiksa tetap menahan Simpan bila bertentangan dengan fakta SIPP."
      )
    );
    const tabel = el("table", "aleta-ptj-tabel");
    tabel.setAttribute("data-ptj", "tabel-baris");
    const kep = el("thead");
    const trk = el("tr");
    for (const t of ["", "Perkara & berkas", "Langkah", "Pilihan form Putusan Akhir", "Jam"]) trk.appendChild(el("th", "", t));
    kep.appendChild(trk);
    tabel.appendChild(kep);
    const tb = el("tbody");
    let urutJam = 0;
    for (const k of terpilih) {
      const ef = langkahEfektif(k);
      const b = S.baris.get(k.kunci);
      const tr = el("tr");
      tr.setAttribute("data-ptj-baris", k.kunci);
      // Centang perkara
      const td0 = el("td");
      const cek = masukan("checkbox");
      cek.checked = true;
      cek.setAttribute("aria-label", `Jadwalkan ${k.nomor}`);
      cek.addEventListener("change", () => {
        pilih(k.kunci, cek.checked);
        gambarKandidat();
        segarkanPasangan();
      });
      td0.appendChild(cek);
      // Perkara & berkas
      const td1 = el("td");
      td1.append(el("div", "aleta-ptj-nomor", k.nomor), el("div", "aleta-ptj-ket", k.jenis || k.ket || ""));
      td1.appendChild(
        el("div", "aleta-ptj-ket", ef.berkas ? `Berkas: ${ef.berkas.nama}` : "Tanpa berkas: e-Doc tidak dapat dipilih; mengisi Putusan Akhir memakai draf ALETA terbaru perkara ini.")
      );
      // Langkah
      const td2 = el("td");
      const langkah = el("div", "aleta-ptj-langkah");
      for (const [kunci, nama] of Object.entries(NAMA_LANGKAH)) {
        const c = masukan("checkbox");
        c.checked = ef[kunci];
        const mati = (kunci === "isi" && k.sudahPutus && !ef.isi) || (kunci !== "isi" && !ef.berkas);
        c.disabled = mati;
        c.setAttribute("data-ptj-langkah", `${k.kunci}:${kunci}`);
        c.addEventListener("change", () => {
          b.langkah[kunci] = c.checked;
          segarkanPasangan();
        });
        langkah.appendChild(berlabel("", (() => { const s = el("span"); s.append(c, ` ${nama}`); return s; })()));
      }
      td2.appendChild(langkah);
      if (k.sudahPutus) td2.appendChild(el("div", "aleta-ptj-ket", "Putusan Akhir sudah terisi di SIPP: tidak ditimpa."));
      // Pilihan form
      const td3 = el("td");
      if (ef.isi) {
        const rf = ef.berkas ? S.ringkasanForm[ef.berkas.id] : null;
        const ring = el("div", "aleta-ptj-form-ringkas");
        ring.setAttribute("data-ptj", "ringkas-form");
        if (rf && rf.ada) {
          const st = rf.status && rf.status.label ? `${rf.status.label}${rf.status.keyakinan === "pasti" ? "" : ` (${rf.status.keyakinan})`}` : "tidak ditebak";
          const vs = rf.verstek && rf.verstek.label ? rf.verstek.label : "tidak ditebak";
          const bx = el("span");
          bx.append("Diperkirakan: status ", el("b", "", st), " · verstek ", el("b", "", vs));
          ring.appendChild(bx);
        } else {
          ring.textContent = rf ? rf.sebab : ef.berkas ? "Membaca amar naskah…" : "Dipilih saat dijalankan, dari draf ALETA.";
        }
        td3.appendChild(ring);
        const st = document.createElement("select");
        st.setAttribute("aria-label", `Status putusan ${k.nomor}`);
        st.setAttribute("data-ptj-status", k.kunci);
        const o0 = document.createElement("option");
        o0.value = "";
        o0.textContent = "Status: dipilih otomatis";
        st.appendChild(o0);
        for (const nama of S.statusTersedia) {
          const o = document.createElement("option");
          o.value = nama;
          o.textContent = nama;
          st.appendChild(o);
        }
        st.value = b.pilihan.statusPutusan;
        st.addEventListener("change", () => {
          b.pilihan.statusPutusan = st.value;
        });
        const vs = document.createElement("select");
        vs.setAttribute("aria-label", `Verstek ${k.nomor}`);
        vs.setAttribute("data-ptj-verstek", k.kunci);
        for (const [nilai, teks] of [["", "Verstek: otomatis"], ["Y", "Verstek: ya"], ["T", "Verstek: tidak"]]) {
          const o = document.createElement("option");
          o.value = nilai;
          o.textContent = teks;
          vs.appendChild(o);
        }
        vs.value = b.pilihan.verstek;
        vs.addEventListener("change", () => {
          b.pilihan.verstek = vs.value;
        });
        const baris2 = el("div", "aleta-ptj-baris-aksi");
        baris2.append(st, vs);
        td3.appendChild(baris2);
      } else {
        td3.appendChild(el("span", "aleta-ptj-ket", "—"));
      }
      // Jam
      const td4 = el("td", "aleta-ptj-jam");
      td4.setAttribute("data-ptj", "jam-baris");
      if (ef.ada) {
        const pr = S.pratinjau && S.pratinjau.butir[urutJam];
        urutJam += 1;
        td4.textContent = pr ? `${pr.wita.slice(11, 16)}${pr.wita.slice(0, 10) !== S.jadwal.tanggal ? ` (${sebutTanggal(pr.wita.slice(0, 10))})` : ""}` : S.pratinjau && !S.pratinjau.ok ? "tidak muat" : "…";
      } else {
        td4.textContent = "tidak dijadwalkan";
      }
      tr.append(td0, td1, td2, td3, td4);
      tb.appendChild(tr);
    }
    tabel.appendChild(tb);
    wadah.appendChild(tabel);
  }

  // 4. Jam: kontrol dibangun SEKALI (agar fokus tak hilang), isi pratinjau digambar ulang
  function bangunJam() {
    const wadah = S.r.jam;
    wadah.textContent = "";
    const judul = el("h3");
    judul.append(el("span", "aleta-ptj-no", "4"), "Jam dikerjakan");
    wadah.appendChild(judul);
    const tunggalJam = S.mode === "perkara";
    wadah.appendChild(
      el(
        "div",
        "aleta-ptj-bantu",
        tunggalJam
          ? "Jam yang dipilih adalah jam WITA. Tidak dikerjakan di luar jam kerja satker (Senin-Kamis 07.30-16.00, Jumat 07.30-16.30, istirahat siang dan hari libur dilewati)."
          : "Jam yang dipilih adalah jam WITA. Perkara pertama dikerjakan pada jam mulai, perkara berikutnya menyusul dengan jeda acak. Tidak ada yang dikerjakan di luar jam kerja satker (Senin-Kamis 07.30-16.00, Jumat 07.30-16.30, istirahat siang dilewati, hari libur dilewati) kecuali Anda mengizinkannya."
      )
    );
    const j = S.jadwal;
    const grid = el("div", "aleta-ptj-jam-grid");
    const buatBidang = (judulBidang, kontrol) => {
      const d = el("div");
      d.append(el("label", "", judulBidang), kontrol);
      return d;
    };
    const tanggal = masukan("date", j.tanggal);
    tanggal.setAttribute("data-ptj", "jadwal-tanggal");
    tanggal.setAttribute("aria-label", "Tanggal mulai");
    const jam = masukan("time", j.jam);
    jam.setAttribute("data-ptj", "jadwal-jam");
    jam.setAttribute("aria-label", "Jam mulai");
    const batas = masukan("time", j.batas);
    batas.setAttribute("data-ptj", "jadwal-batas");
    batas.setAttribute("aria-label", "Batas akhir");
    const jedaMin = masukan("number", j.jedaMin, { min: "1", max: "60", step: "1" });
    jedaMin.setAttribute("data-ptj", "jadwal-jeda-min");
    jedaMin.setAttribute("aria-label", "Jeda terpendek (menit)");
    const jedaMaks = masukan("number", j.jedaMaks, { min: "1", max: "60", step: "1" });
    jedaMaks.setAttribute("data-ptj", "jadwal-jeda-maks");
    jedaMaks.setAttribute("aria-label", "Jeda terpanjang (menit)");
    const dari = masukan("time", j.jamDari);
    dari.setAttribute("data-ptj", "jadwal-dari");
    dari.setAttribute("aria-label", "Jam kerja dari");
    const sampai = masukan("time", j.jamSampai);
    sampai.setAttribute("data-ptj", "jadwal-sampai");
    sampai.setAttribute("aria-label", "Jam kerja sampai");
    const ubah = () => {
      j.tanggal = tanggal.value;
      j.jam = jam.value;
      j.batas = batas.value;
      j.jedaMin = Number(jedaMin.value) || 2;
      j.jedaMaks = Number(jedaMaks.value) || 7;
      if (j.jedaMaks < j.jedaMin) j.jedaMaks = j.jedaMin;
      j.jamDari = dari.value;
      j.jamSampai = sampai.value;
      simpanSetelan();
      S.konfirm = false;
      gambarKonfirm();
      segarkanPasangan();
    };
    for (const k of [tanggal, jam, batas, jedaMin, jedaMaks, dari, sampai]) k.addEventListener("change", ubah);
    if (tunggalJam) {
      // Satu perkara: hanya tanggal dan jam; jeda, batas akhir, dan jam kerja tidak berlaku.
      grid.append(buatBidang("Tanggal", tanggal), buatBidang("Jam", jam));
    } else {
      grid.append(
        buatBidang("Tanggal mulai", tanggal),
        buatBidang("Jam mulai", jam),
        buatBidang("Batas akhir (opsional)", batas),
        buatBidang("Jeda terpendek (menit)", jedaMin),
        buatBidang("Jeda terpanjang (menit)", jedaMaks),
        buatBidang("Jam kerja dari (opsional)", dari),
        buatBidang("Jam kerja sampai (opsional)", sampai)
      );
    }
    wadah.appendChild(grid);
    const pilihan = el("div", "aleta-ptj-baris-aksi");
    const lintas = masukan("checkbox");
    lintas.checked = j.lintasHari;
    lintas.setAttribute("data-ptj", "jadwal-lintas");
    lintas.addEventListener("change", () => {
      j.lintasHari = lintas.checked;
      batas.disabled = lintas.checked;
      simpanSetelan();
      S.konfirm = false;
      segarkanPasangan();
    });
    batas.disabled = j.lintasHari;
    const malam = masukan("checkbox");
    malam.checked = j.malamBoleh;
    malam.setAttribute("data-ptj", "jadwal-malam");
    malam.addEventListener("change", () => {
      j.malamBoleh = malam.checked;
      simpanSetelan();
      S.konfirm = false;
      segarkanPasangan();
    });
    pilihan.append(
      berlabel("", (() => { const s = el("span"); s.append(lintas, " Bila tidak muat, lanjutkan ke hari kerja berikutnya (batas akhir diabaikan)"); return s; })()),
      berlabel("", (() => { const s = el("span"); s.append(malam, " Izinkan di luar jam kerja (malam, Sabtu/Minggu, libur) - tidak disarankan"); return s; })())
    );
    const acak = tombol("Acak ulang jam", "aleta-ptj-sekunder", "Menghitung ulang jeda acak antar perkara");
    acak.setAttribute("data-ptj", "acak-ulang");
    acak.addEventListener("click", () => {
      acakUlang = true;
      void muatPratinjau();
    });
    if (!tunggalJam) {
      wadah.appendChild(pilihan);
      wadah.appendChild(acak);
    }
    const pr = el("div", "aleta-ptj-pratinjau");
    pr.setAttribute("data-ptj", "pratinjau");
    pr.setAttribute("aria-live", "polite");
    wadah.appendChild(pr);
    S.r.pratinjauKotak = pr;
    gambarJam();
  }

  function gambarJam() {
    if (!S || !S.r || !S.r.pratinjauKotak) return;
    const pr = S.r.pratinjauKotak;
    pr.textContent = "";
    const jumlah = barisTermasuk().length;
    if (jumlah === 0) {
      pr.textContent = "Pratinjau jam muncul setelah ada perkara dengan langkah yang dipilih.";
      return;
    }
    const p = S.pratinjau;
    if (!p) {
      pr.textContent = "Menghitung jam…";
      return;
    }
    if (p.butir.length) {
      const pertama = p.butir[0].wita;
      const terakhir = p.butir[p.butir.length - 1].wita;
      const hari = new Set(p.butir.map((b) => b.wita.slice(0, 10)));
      pr.textContent = `${p.butir.length} perkara · mulai ${sebutTanggal(pertama.slice(0, 10))} ${pertama.slice(11, 16)} WITA · selesai ${hari.size > 1 ? sebutTanggal(terakhir.slice(0, 10)) + " " : ""}${terakhir.slice(11, 16)} WITA · jeda ${S.jadwal.jedaMin}-${S.jadwal.jedaMaks} menit`;
    }
    for (const w of p.peringatan || []) pr.appendChild(el("div", "aleta-ptj-awas", w));
    if (!p.ok && p.sebab && !(p.peringatan || []).includes(p.sebab)) pr.appendChild(el("div", "aleta-ptj-galat", p.sebab));
  }

  // Konfirmasi dan kaki
  function ringkasanRencana() {
    const baris = barisTermasuk();
    let isi = 0;
    let putusan = 0;
    let anonim = 0;
    for (const k of baris) {
      const ef = langkahEfektif(k);
      if (ef.isi) isi += 1;
      if (ef.putusan) putusan += 1;
      if (ef.anonim) anonim += 1;
    }
    return { perkara: baris.length, isi, putusan, anonim };
  }

  function siapMenjadwalkan() {
    if (!S || S.sibuk) return false;
    const r = ringkasanRencana();
    if (!r.perkara) return false;
    if (S.berkas.some((b) => b.status === "antre" || b.status === "periksa" || b.status === "unggah")) return false;
    return Boolean(S.pratinjau && S.pratinjau.ok && S.pratinjau.butir.length === r.perkara);
  }

  function gambarKaki() {
    if (!S || !S.r) return;
    const kaki = S.r.kaki;
    kaki.textContent = "";
    const r = ringkasanRencana();
    const ring = el("div", "aleta-ptj-ringkas");
    ring.setAttribute("aria-live", "polite");
    ring.textContent = S.sibuk
      ? "Menjadwalkan…"
      : r.perkara === 0
        ? "Belum ada yang dijadwalkan."
        : `${r.perkara} perkara · ${r.isi} isi Putusan Akhir · ${r.putusan} e-Doc putusan · ${r.anonim} e-Doc anonimisasi`;
    const aksi = el("div", "aleta-ptj-baris-aksi");
    const utama = tombol(r.perkara ? `Jadwalkan ${r.perkara} perkara` : "Jadwalkan", "aleta-ptj-utama");
    utama.setAttribute("data-ptj", "utama");
    utama.disabled = !siapMenjadwalkan();
    utama.addEventListener("click", () => {
      S.konfirm = true;
      gambarKonfirm();
      const ya = S.r.konfirm.querySelector("[data-ptj='ya']");
      if (ya && ya.focus) ya.focus();
    });
    aksi.appendChild(utama);
    kaki.append(ring, aksi);
    gambarKonfirm();
  }

  function gambarKonfirm() {
    if (!S || !S.r) return;
    const wadah = S.r.konfirm;
    wadah.textContent = "";
    if (!S.konfirm || S.sibuk || !siapMenjadwalkan()) return;
    const r = ringkasanRencana();
    const p = S.pratinjau;
    const kotak = el("div", "aleta-ptj-konfirm");
    kotak.setAttribute("role", "alertdialog");
    kotak.setAttribute("aria-label", "Konfirmasi jadwal");
    const mulai = p.butir[0].wita;
    const akhir = p.butir[p.butir.length - 1].wita;
    kotak.appendChild(el("p", "", `Jadwalkan ${r.perkara} perkara: mulai ${sebutTanggal(mulai.slice(0, 10))} ${mulai.slice(11, 16)} WITA, selesai ${akhir.slice(11, 16)} WITA.`));
    const rincian = [];
    if (r.isi) rincian.push(`${r.isi} Putusan Akhir akan diisi dan DISIMPAN lewat SIPP yang terbuka di peramban ini (akun ${namaSippMasuk() || "yang sedang masuk"}) - buka SIPP di peramban ini pada jamnya`);
    if (r.putusan || r.anonim) rincian.push(`${r.putusan} e-Doc putusan dan ${r.anonim} e-Doc anonimisasi diunggah oleh server (tidak perlu laptop menyala)`);
    kotak.appendChild(el("p", "aleta-ptj-ket", `${rincian.join("; ")}.`));
    kotak.appendChild(el("p", "aleta-ptj-ket", "Dicatat atas akun SIPP Anda. Yang sudah terisi/terunggah di SIPP tidak diganti; yang ditahan pemeriksaan (praperiksa, data pribadi yang tersisa) berhenti dan dilaporkan di Antrean terjadwal. Dapat dibatalkan atau ditunda sebelum dikerjakan."));
    if (S.pilihAkun.length) {
      const sel = document.createElement("select");
      sel.setAttribute("data-ptj", "pilih-akun");
      sel.setAttribute("aria-label", "Akun SIPP yang dipakai");
      for (const a of S.pilihAkun) {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = a;
        sel.appendChild(o);
      }
      sel.value = S.akunSipp || S.pilihAkun[0];
      S.akunSipp = sel.value;
      sel.addEventListener("change", () => {
        S.akunSipp = sel.value;
      });
      kotak.appendChild(berlabel("Akun SIPP yang dipakai:", sel));
    }
    const aksi = el("div", "aleta-ptj-konfirm-aksi");
    const ya = tombol("Ya, jadwalkan", "aleta-ptj-ya");
    ya.setAttribute("data-ptj", "ya");
    ya.addEventListener("click", () => void kirimJadwal());
    const batal = tombol("Batal", "aleta-ptj-batal");
    batal.setAttribute("data-ptj", "batal");
    batal.addEventListener("click", () => {
      S.konfirm = false;
      gambarKonfirm();
    });
    aksi.append(ya, batal);
    kotak.appendChild(aksi);
    wadah.appendChild(kotak);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mengirim jadwal
  // ──────────────────────────────────────────────────────────────────────────
  async function kirimJadwal() {
    if (!S || S.sibuk || !siapMenjadwalkan()) return;
    S.sibuk = true;
    S.konfirm = false;
    S.pesan = null;
    gambarPesan();
    gambarKaki();
    try {
      const butir = [];
      for (const k of barisTermasuk()) {
        let id = k.perkaraId;
        if (!/^\d+$/.test(id || "")) {
          id = await perkaraIdUntuk(k.nomor);
          k.perkaraId = id;
        }
        if (!/^\d+$/.test(id || "")) throw new Error(`Nomor induk ${k.nomor} belum terbaca dari SIPP, jadi tidak dapat dijadwalkan. Buka perkaranya sekali, lalu coba lagi.`);
        const ef = langkahEfektif(k);
        const b = S.baris.get(k.kunci) || { pilihan: {} };
        butir.push({
          perkaraId: id,
          nomorPerkara: k.nomor,
          jenisPerkara: k.jenis || "",
          ...(ef.berkas ? { berkasId: ef.berkas.id } : {}),
          langkah: { isi: ef.isi, putusan: ef.putusan, anonim: ef.anonim },
          pilihan: ef.isi ? { statusPutusan: b.pilihan.statusPutusan || "", verstek: b.pilihan.verstek || "" } : {},
        });
      }
      const badan = {
        ...bodyJam(),
        benih: S.pratinjau.benih,
        sumber: S.mode === "daftar" ? "tanggal" : "perkara",
        tanggalAcuan: S.mode === "daftar" ? S.tanggalCari : "",
        namaSipp: namaSippMasuk(),
        ...(S.akunSipp ? { akunSipp: S.akunSipp } : {}),
        butir,
      };
      const r = await ambilJson(API.dasar, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan), batasMs: 60000 }, "Menjadwalkan putusan");
      const d = r.data && typeof r.data === "object" ? r.data : {};
      if (!r.ok) {
        if (r.rincian && r.rincian.kode === "akun_sipp_ganda" && Array.isArray(r.rincian.milik) && r.rincian.milik.length) {
          S.pilihAkun = r.rincian.milik;
          S.akunSipp = S.pilihAkun[0];
          S.konfirm = true;
          S.pesan = { jenis: "awas", teks: `${r.pesan} Pilih akun di bawah, lalu jadwalkan lagi.` };
        } else {
          S.pesan = { jenis: "galat", teks: r.pesan || "Jadwal tidak dapat dibuat." };
        }
        return;
      }
      const pertama = Array.isArray(d.butir) && d.butir[0] ? d.butir[0].waktuWita : "";
      const terakhir = Array.isArray(d.butir) && d.butir.length ? d.butir[d.butir.length - 1].waktuWita : "";
      S.pesan = {
        jenis: "sukses",
        teks: `${d.butir ? d.butir.length : 0} perkara dijadwalkan (${pertama} sampai ${terakhir} WITA) atas akun SIPP ${d.akunSipp || ""}. Pantau di Antrean terjadwal.`,
      };
      // Keadaan dibersihkan: jadwal berikutnya mulai dari nol; berkas sudah terpasang di server.
      S.berkas = [];
      S.manual = {};
      S.terpilih.clear();
      S.kandidat = [];
      S.baris.clear();
      S.ringkasanForm = {};
      S.pratinjau = null;
      S.pilihAkun = [];
      if (S.mode === "perkara") awalPerkara();
      S.tab = "antrean";
      await muatAntrean();
      void tanyaPeramban();
    } catch (galat) {
      S.pesan = { jenis: "galat", teks: sebaris((galat && galat.message) || galat) };
    } finally {
      if (S) {
        S.sibuk = false;
        gambarSemua();
      }
    }
  }
  function tanyaPeramban() {
    const p = globalThis.aletaPutusanTerjadwalPeramban;
    if (p && typeof p.periksaSekarang === "function") return p.periksaSekarang();
    return undefined;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Antrean terjadwal
  // ──────────────────────────────────────────────────────────────────────────
  async function muatAntrean() {
    if (!S || S.antreanMemuat) return;
    S.antreanMemuat = true;
    const r = await ambilJson(`${API.dasar}?batas=15`, { credentials: "include", cache: "no-store" }, "Membaca antrean");
    if (!S) return;
    S.antreanMemuat = false;
    if (r.ok && r.data) S.antrean = r.data;
    else S.antrean = { jadwal: [], ringkasan: {}, galat: r.pesan || "Antrean belum terbaca." };
    gambarAntrean();
    gambarTab();
    perbaruiLencana(S.antrean.ringkasan);
  }

  async function aksiButir(aksi, id, tambahan) {
    const r = await ambilJson(API.dasar, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi, id, ...(tambahan || {}) }) }, "Mengubah jadwal");
    if (S) {
      S.pesan = r.ok ? { jenis: "sukses", teks: (r.data && r.data.ringkas) || "Selesai." } : { jenis: "galat", teks: r.pesan || "Gagal." };
      gambarPesan();
    }
    await muatAntrean();
  }

  function gambarAntrean() {
    if (!S || !S.r) return;
    const wadah = S.r.badanAntrean;
    wadah.textContent = "";
    const a = S.antrean;
    const aksiAtas = el("div", "aleta-ptj-baris-aksi");
    const segar = tombol("Segarkan", "aleta-ptj-sekunder");
    segar.setAttribute("data-ptj", "segarkan");
    segar.addEventListener("click", () => void muatAntrean());
    aksiAtas.appendChild(segar);
    const periksa = tombol("Periksa jatuh tempo sekarang", "aleta-ptj-sekunder", "Menanyakan ke server apakah ada Putusan Akhir yang sudah waktunya diisi di peramban ini");
    periksa.setAttribute("data-ptj", "periksa-sekarang");
    periksa.addEventListener("click", () => {
      void Promise.resolve(tanyaPeramban()).then(() => muatAntrean());
    });
    aksiAtas.appendChild(periksa);
    const modulPeramban = globalThis.aletaPutusanTerjadwalPeramban;
    if (modulPeramban && typeof modulPeramban.bacaSetelan === "function") {
      const cek = masukan("checkbox");
      cek.checked = true;
      cek.setAttribute("data-ptj", "buka-otomatis");
      void modulPeramban.bacaSetelan().then((st) => {
        cek.checked = st.bukaOtomatis !== false;
      });
      cek.addEventListener("change", () => void modulPeramban.simpanSetelan({ bukaOtomatis: cek.checked }));
      aksiAtas.appendChild(berlabel("", (() => { const x = el("span"); x.append(cek, " Buka halaman perkara sendiri saat jatuh tempo (hanya bila saya sedang tidak mengetik)"); return x; })()));
    }
    if (a && a.ringkasan) {
      const r = a.ringkasan;
      aksiAtas.appendChild(el("span", "aleta-ptj-ket", `${r.menunggu || 0} menunggu · ${r.jalan || 0} berjalan · ${r.selesai || 0} selesai · ${r.sebagian || 0} sebagian · ${r.gagal || 0} perlu perhatian · ${r.dibatalkan || 0} dibatalkan`));
    }
    if (a && a.pengaturan && a.pengaturan.pelaksanaNyala === false) {
      wadah.appendChild(el("div", "aleta-ptj-galat", "Pelaksana server sedang DIMATIKAN oleh admin: e-Doc terjadwal tidak dikerjakan sampai dinyalakan lagi."));
    }
    wadah.appendChild(aksiAtas);
    if (a && a.galat) wadah.appendChild(el("div", "aleta-ptj-galat", a.galat));
    if (a && a.ringkasan && a.ringkasan.menungguPeramban > 0) {
      wadah.appendChild(
        el("div", "aleta-ptj-awas", `${a.ringkasan.menungguPeramban} perkara menunggu pengisian Putusan Akhir di SIPP yang terbuka di peramban ini (akun SIPP penjadwal). Buka halaman SIPP mana pun dengan akun itu; ekstensi mengerjakannya sendiri.`)
      );
    }
    if (!a || !a.jadwal || !a.jadwal.length) {
      wadah.appendChild(el("div", "aleta-ptj-ket", a ? "Belum ada jadwal." : "Membaca antrean…"));
      return;
    }
    for (const j of a.jadwal) {
      const kotak = el("div", "aleta-ptj-jadwal");
      kotak.setAttribute("data-ptj-jadwal", j.id);
      const kepala = el("div", "aleta-ptj-jadwal-kepala");
      kepala.append(
        el("span", "", `Dijadwalkan ${sebutWita(j.dibuatPada)} oleh ${j.dibuatNama} · akun SIPP ${j.akunSipp} · jeda ${Math.round(j.jedaMin / 60)}-${Math.round(j.jedaMaks / 60)} menit`),
        el("span", "aleta-ptj-chip aleta-ptj-c-lewat", j.status === "aktif" ? "aktif" : j.status === "selesai" ? "selesai" : "dibatalkan")
      );
      kotak.appendChild(kepala);
      const tabel = el("table", "aleta-ptj-tabel");
      const tb = el("tbody");
      for (const b of j.butir) {
        const tr = el("tr");
        tr.setAttribute("data-ptj-butir", b.id);
        const td1 = el("td");
        td1.append(el("div", "aleta-ptj-nomor", b.nomorPerkara), el("div", "aleta-ptj-ket", `${b.waktuSebut || b.waktuWita} WITA`));
        const td2 = el("td");
        const langkah = el("div", "aleta-ptj-langkah");
        for (const k of ["isi", "putusan", "anonim"]) {
          if (!b.langkah[k]) continue;
          const st = b.statusLangkah[k];
          const chip = el("span", `aleta-ptj-chip aleta-ptj-c-${NADA_STATUS[st] || "lewat"}`, `${NAMA_LANGKAH[k]}: ${NAMA_STATUS[st] || st}`);
          chip.setAttribute("data-ptj-status", `${k}:${st}`);
          if (b.catatan[k]) chip.title = b.catatan[k];
          langkah.appendChild(chip);
        }
        td2.appendChild(langkah);
        const catat = ["isi", "putusan", "anonim"].map((k) => b.catatan[k]).filter(Boolean);
        if (catat.length && ["sebagian", "gagal", "selesai", "menunggu"].includes(b.status)) td2.appendChild(el("div", "aleta-ptj-ket", catat.join(" · ")));
        if (b.menungguPeramban) td2.appendChild(el("div", "aleta-ptj-ket", "Menunggu SIPP terbuka di peramban ini."));
        const td3 = el("td");
        td3.appendChild(el("span", `aleta-ptj-chip aleta-ptj-c-${b.status === "selesai" ? "ok" : b.status === "gagal" || b.status === "sebagian" ? "salah" : b.status === "jalan" ? "jalan" : b.status === "dibatalkan" ? "lewat" : "tunggu"}`, NAMA_BUTIR[b.status] || b.status));
        const td4 = el("td");
        const aksi = el("div", "aleta-ptj-aksi-baris");
        if (b.dapatBatal) {
          const batal = tombol("Batalkan", "aleta-ptj-sekunder");
          batal.setAttribute("data-ptj-aksi", `batal:${b.id}`);
          batal.addEventListener("click", () => void aksiButir("batal", b.id));
          aksi.appendChild(batal);
        }
        if (b.status === "menunggu") {
          const tunda = tombol("Tunda 1 jam", "aleta-ptj-sekunder");
          tunda.setAttribute("data-ptj-aksi", `tunda:${b.id}`);
          tunda.addEventListener("click", () => void aksiButir("tunda", b.id, { menit: 60 }));
          aksi.appendChild(tunda);
        }
        const butuhPeramban = (b.status === "sebagian" || b.status === "gagal") && b.berkasAda && ["putusan", "anonim"].some((k) => b.langkah[k] && ["gagal", "tertahan"].includes(b.statusLangkah[k])) && !["menunggu", "jalan", "gagal", "tertahan"].includes(b.statusLangkah.isi);
        if (butuhPeramban) {
          const selesai = tombol("Selesaikan di peramban ini", "aleta-ptj-sekunder", "Mengunggah e-Doc yang tertahan dari peramban ini: penyamar lalu cadangan anonimisasi ABT, dan Anda yang memutuskan bila masih ada data pribadi tersisa");
          selesai.setAttribute("data-ptj-aksi", `peramban:${b.id}`);
          selesai.addEventListener("click", () => void selesaikanDiPeramban(b, selesai));
          aksi.appendChild(selesai);
        }
        if (b.dapatUlang) {
          const ulang = tombol("Ulangi", "aleta-ptj-sekunder");
          ulang.setAttribute("data-ptj-aksi", `ulang:${b.id}`);
          ulang.addEventListener("click", () => void aksiButir("ulang", b.id));
          aksi.appendChild(ulang);
        }
        if (!b.dilihat) {
          const lihat = tombol("Tandai dilihat", "aleta-ptj-sekunder");
          lihat.setAttribute("data-ptj-aksi", `lihat:${b.id}`);
          lihat.addEventListener("click", () => void aksiButir("lihat", b.id));
          aksi.appendChild(lihat);
        }
        td4.appendChild(aksi);
        tr.append(td1, td2, td3, td4);
        tb.appendChild(tr);
      }
      tabel.appendChild(tb);
      kotak.appendChild(tabel);
      if (j.butir.some((b) => b.status === "menunggu")) {
        const bawah = el("div", "aleta-ptj-baris-aksi");
        bawah.style.padding = "8px 12px";
        const batalSemua = tombol("Batalkan seluruh jadwal ini", "aleta-ptj-sekunder");
        batalSemua.setAttribute("data-ptj-aksi", `batal-jadwal:${j.id}`);
        batalSemua.addEventListener("click", () => void aksiButir("batal-jadwal", j.id));
        bawah.appendChild(batalSemua);
        kotak.appendChild(bawah);
      }
      wadah.appendChild(kotak);
    }
  }

  /**
   * e-Doc yang tertahan di server (anonimisasi masih memuat data pribadi, penyamar tak bekerja) diselesaikan di
   * peramban ini dengan alur unggah e-Doc yang SAMA dengan Putusan Otomatis (putusan-edoc-sekaligus.js): penyamar,
   * lalu cadangan anonimisasi ABT dengan sesi ABT petugas, dan petugas yang memutuskan "Tetap unggah". Server
   * hanya mencatat hasilnya, dan menyatakan selesai bila SIPP sendiri sudah memuat e-Doc-nya.
   */
  async function selesaikanDiPeramban(b, tombolKlik) {
    const mod = globalThis.aletaPutusanEdoc;
    if (!mod || typeof mod.jalankan !== "function") {
      S.pesan = { jenis: "galat", teks: "Pengunggah e-Doc belum termuat di halaman ini." };
      gambarPesan();
      return;
    }
    tombolKlik.disabled = true;
    const wadah = el("div", "aleta-ptj-awas");
    wadah.setAttribute("data-ptj", "peramban-kerja");
    tombolKlik.parentNode.appendChild(wadah);
    const kabar = el("div", "aleta-ptj-ket", "Mengambil berkas dari server…");
    wadah.appendChild(kabar);
    let kunci = null;
    try {
      const r = await ambilJson(API.peramban, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "berkas", id: b.id }) }, "Mengambil berkas putusan");
      const d = r.data && typeof r.data === "object" ? r.data : {};
      if (!r.ok || !d.base64) throw new Error(d.sebab || r.pesan || "Berkas tidak dapat diambil.");
      const bita = Uint8Array.from(atob(d.base64), (c) => c.charCodeAt(0));
      const berkas = new File([bita], d.nama || "putusan", { type: "application/octet-stream" });
      // Kunci perkara yang sama dengan penetapan/putusan: pekerjaan lain atas perkara ini tidak berjalan bersamaan.
      if (typeof mod.ambilKunci === "function") {
        kunci = await mod.ambilKunci(b.nomorPerkara, b.perkaraId);
        if (kunci && kunci.ok === false) throw new Error(kunci.pesan || "Perkara ini sedang dikerjakan pekerjaan lain.");
      }
      const perlu = (k) => b.langkah[k] && ["gagal", "tertahan"].includes(b.statusLangkah[k]);
      const hasil = await mod.jalankan({
        nomorPerkara: b.nomorPerkara,
        perkaraId: b.perkaraId,
        putusan: berkas,
        denganPutusan: perlu("putusan"),
        denganAnonim: perlu("anonim"),
        kabar,
        wadah,
      });
      const langkah = (hasil.langkah || []).map((l) => ({
        langkah: l.kunci === "putusan" ? "putusan" : "anonim",
        hasil: l.nada === "ok" ? "selesai" : l.nada === "lewat" ? "lewat" : /tertahan|data pribadi/i.test(l.teks || "") ? "tertahan" : "gagal",
        catatan: l.teks || "",
      }));
      const lapor = await ambilJson(API.peramban, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "edoc-selesai", id: b.id, langkah }) }, "Mencatat hasil e-Doc");
      S.pesan = lapor.ok
        ? { jenis: "sukses", teks: `${b.nomorPerkara}: ${(lapor.data.rincian || []).map((x) => `${NAMA_LANGKAH[x.langkah]} ${NAMA_STATUS[x.status] || x.status}`).join("; ") || "selesai"}.` }
        : { jenis: "galat", teks: lapor.pesan || "Hasil tidak dapat dicatat di server." };
    } catch (galat) {
      S.pesan = { jenis: "galat", teks: sebaris((galat && galat.message) || galat) };
    } finally {
      if (kunci && typeof kunci.lepas === "function") await kunci.lepas().catch(() => undefined);
      wadah.remove();
      tombolKlik.disabled = false;
      gambarPesan();
      await muatAntrean();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lencana: hasil yang belum dilihat dan yang menunggu peramban
  // ──────────────────────────────────────────────────────────────────────────
  let lencanaTerakhir = 0;
  function perbaruiLencana(ringkasan) {
    const n = ringkasan ? Number(ringkasan.belumDilihat || 0) + Number(ringkasan.menungguPeramban || 0) : 0;
    lencanaTerakhir = n;
    for (const e of Array.from(document.querySelectorAll(".aleta-ptj-lencana"))) {
      e.textContent = String(n);
      e.hidden = n === 0;
    }
  }
  let pewaktuLencana = null;
  async function bacaLencana() {
    if (!berhak() || modeLama()) return;
    const r = await ambilJson(`${API.dasar}?batas=15&aktif=1`, { credentials: "include", cache: "no-store" }, "Membaca antrean");
    if (r.ok && r.data && r.data.ringkasan) perbaruiLencana(r.data.ringkasan);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan di halaman
  // ──────────────────────────────────────────────────────────────────────────
  let nyala = true;
  function aktifSekarang() {
    return nyala && !modeLama();
  }

  /**
   * Tempat tombol: "perkara" (detil perkara, satu perkara), "dashboard" atau "daftar" (massal), atau "".
   * Dashboard dikenali dari judul "DASHBOARD PERKARA [Statistik Perkara]" (section.content-header h1);
   * daftar perkara dari #pageTitle "DAFTAR PERKARA PERDATA GUGATAN / PERMOHONAN" bertombol Cetak
   * (#cetak_perkara_list). Halaman lain (jurnal, banding, eksekusi, dst.) tidak diberi tombol.
   */
  /** Judul dashboard: "DASHBOARD PERKARA [Statistik Perkara]" (h1) atau, di dashboard lama, "STATISTIK PERKARA DAN REMINDER" (h2). */
  function judulDashboard(d) {
    const h1 = d.querySelector("section.content-header h1, .content-header h1");
    if (h1 && POLA_DASHBOARD.test(String(h1.textContent || ""))) return h1;
    for (const h2 of Array.from(d.querySelectorAll("h2"))) {
      if (/STATISTIK\s+PERKARA\s+DAN\s+REMINDER/i.test(String(h2.textContent || ""))) return h2;
    }
    return null;
  }
  function tempatHalaman(doc) {
    const d = doc || document;
    const tr = barisTombol(d);
    if (tr && nomorHalaman(d)) return "perkara";
    if (/\/aps_badilag\//i.test(String(location.pathname || ""))) return "";
    if (judulDashboard(d)) return "dashboard";
    const judul = d.getElementById("pageTitle");
    if (judul && POLA_DAFTAR.test(String(judul.textContent || "")) && d.getElementById("cetak_perkara_list")) return "daftar";
    return "";
  }
  /** "perkara" atau "daftar" (massal); "" bila bukan tempat tombol. */
  function modeHalaman(doc) {
    const t = tempatHalaman(doc);
    return t === "perkara" ? "perkara" : t ? "daftar" : "";
  }
  function awalPerkara() {
    if (!S || S.mode !== "perkara") return;
    const k = tambahKandidat({ nomor: S.nomor, ket: "perkara yang sedang dibuka", dari: "perkara" });
    if (k) {
      pilih(k.kunci, true);
      gambarSemua();
      segarkanPasangan();
      void perkaraIdUntuk(S.nomor).then(async (id) => {
        if (k) k.perkaraId = id;
        // Putusan yang sudah terisi tidak ditimpa: langkah isi dimatikan bila SIPP sudah memuatnya.
        const baca = fungsi("b6KeadaanPutusanTerisi");
        if (baca) {
          try {
            const keadaan = await baca(S.nomor);
            if (keadaan && keadaan.terisi) {
              k.sudahPutus = true;
              const b = S.baris.get(k.kunci);
              if (b) b.langkah.isi = false;
              gambarSemua();
              segarkanPasangan();
            }
          } catch {
            /* diperiksa lagi saat dijalankan */
          }
        }
      });
    }
  }

  function pasangTombol(tr) {
    let td = tr.querySelector(":scope > .aleta-ptj-sel");
    if (!td) {
      td = el("td", `${KELAS} aleta-ptj-sel`);
      const b = tombol("", "btn btn-sm aleta-ptj-tombol");
      b.id = "aleta-ptj-tombol";
      b.setAttribute("data-ptj", "tombol");
      b.setAttribute("aria-controls", ID_PANEL);
      b.append(el("span", "aleta-ptj-ikon", "⏱"), " Jadwalkan Putusan ");
      const lencana = el("span", "aleta-ptj-lencana", String(lencanaTerakhir));
      lencana.hidden = lencanaTerakhir === 0;
      b.appendChild(lencana);
      b.addEventListener("click", () => {
        if (!S) return;
        S.terbuka = !S.terbuka;
        const lipat = !S.terbuka;
        void bacaPenyimpanan([KUNCI_LIPAT]).then((s) => {
          const lip = s && s[KUNCI_LIPAT] && typeof s[KUNCI_LIPAT] === "object" ? s[KUNCI_LIPAT] : {};
          void tulisPenyimpanan({ [KUNCI_LIPAT]: { ...lip, [KUNCI_LIPAT_PANEL]: lipat } });
        });
        pasangPanel(tr);
      });
      td.appendChild(b);
    }
    // Urutan tetap (Penetapan, Putusan, Jadwalkan, Buka di ABT/ALETA) dijaga SATU pengurut bersama (panel-alat.js).
    if (td.parentElement !== tr) {
      const l1 = tr.querySelector(":scope > .aleta-l1-submenu");
      tr.insertBefore(td, l1 || null);
    }
    if (typeof alatUrutkanTombolSipp === "function") alatUrutkanTombolSipp(tr);
    const b = td.querySelector("button");
    if (b) b.setAttribute("aria-expanded", S && S.terbuka ? "true" : "false");
    return td;
  }

  function pasangPanel(tr) {
    const tabel = tr.closest("table#submenus") || (tr.closest("table") && tr.closest("table").closest("table#submenus")) || tr.closest("table");
    const ada = document.getElementById(ID_PANEL);
    if (!S.akar || !ada) {
      const akar = buatKerangka();
      if (ada) ada.remove();
      // Di bawah panel Putusan Otomatis bila ada, lalu Penetapan Otomatis, kalau tidak langsung di bawah deretan tombol.
      const jangkarPanel = document.getElementById("aleta-pusipp-panel") || document.getElementById("aleta-pensipp-panel") || tabel;
      if (jangkarPanel && jangkarPanel.parentNode) jangkarPanel.parentNode.insertBefore(akar, jangkarPanel.nextSibling);
      else document.body.appendChild(akar);
      gambarSemua();
      awalPerkara();
      void muatSetelan();
      void muatRingkasanForm();
    }
    S.akar.hidden = !S.terbuka;
    const tb = tr.querySelector(".aleta-ptj-tombol");
    if (tb) tb.setAttribute("aria-expanded", S.terbuka ? "true" : "false");
  }

  /**
   * MASSAL: tombol di dashboard (di samping judul "DASHBOARD PERKARA [Statistik Perkara]") dan di daftar
   * perkara (di samping tombol "Cetak"); panelnya terbuka tepat di bawah tempat itu, bukan melayang.
   */
  function jangkarMassal(tempat) {
    if (tempat === "dashboard") {
      const h1 = judulDashboard(document);
      return h1 ? { tombol: h1, tombolDi: "dalam", panelSesudah: h1.closest("section") || h1 } : null;
    }
    const cetak = document.getElementById("cetak_perkara_list");
    if (!cetak) return null;
    const halaman = document.getElementById("pages");
    return { tombol: cetak, tombolDi: "sesudah", panelSebelum: halaman && halaman.parentNode ? halaman : null, panelSesudah: cetak.closest("#left") || cetak };
  }

  function pasangTombolMassal(tempat) {
    const j = jangkarMassal(tempat);
    if (!j) return null;
    let wadah = document.getElementById(ID_MASSAL);
    if (!wadah) {
      wadah = el("span", `${KELAS} aleta-ptj-massal`);
      wadah.id = ID_MASSAL;
      const b = tombol("", "btn btn-sm aleta-ptj-tombol");
      b.id = "aleta-ptj-tombol";
      b.setAttribute("data-ptj", "tombol");
      b.setAttribute("aria-controls", ID_PANEL);
      b.append(el("span", "aleta-ptj-ikon", "⏱"), " Jadwalkan Putusan Massal ");
      const lencana = el("span", "aleta-ptj-lencana", String(lencanaTerakhir));
      lencana.hidden = lencanaTerakhir === 0;
      b.appendChild(lencana);
      b.addEventListener("click", () => {
        if (!S) return;
        S.terbuka = !S.terbuka;
        pasangPanelMassal(tempat);
      });
      wadah.appendChild(b);
    }
    // Letak: dashboard = di dalam judul (di samping tulisan); daftar = tepat sesudah tombol Cetak.
    if (j.tombolDi === "dalam") {
      if (wadah.parentNode !== j.tombol) j.tombol.appendChild(wadah);
    } else if (wadah.previousElementSibling !== j.tombol || wadah.parentNode !== j.tombol.parentNode) {
      j.tombol.parentNode.insertBefore(wadah, j.tombol.nextSibling);
    }
    const b = wadah.querySelector("button");
    if (b) b.setAttribute("aria-expanded", S && S.terbuka ? "true" : "false");
    return wadah;
  }

  function pasangPanelMassal(tempat) {
    const j = jangkarMassal(tempat);
    if (!j) return;
    const ada = document.getElementById(ID_PANEL);
    if (!S.akar || !ada) {
      const akar = buatKerangka();
      if (ada) ada.remove();
      if (j.panelSebelum) j.panelSebelum.parentNode.insertBefore(akar, j.panelSebelum);
      else if (j.panelSesudah && j.panelSesudah.parentNode) j.panelSesudah.parentNode.insertBefore(akar, j.panelSesudah.nextSibling);
      else document.body.appendChild(akar);
      gambarSemua();
      void muatSetelan();
      if (tempat === "daftar") tambahDariHalamanDiam();
    }
    S.akar.hidden = !S.terbuka;
    const b = document.querySelector("#aleta-ptj-massal button");
    if (b) b.setAttribute("aria-expanded", S.terbuka ? "true" : "false");
  }
  /** Baris di halaman daftar ditawarkan (belum dicentang) supaya cepat dipilih. */
  function tambahDariHalamanDiam() {
    const baris = fungsi("barisPerkaraDiHalaman");
    if (!baris) return;
    try {
      for (const b of baris()) tambahKandidat({ nomor: b.nomor, ket: "di halaman ini", dari: "halaman" });
    } catch {
      /* halaman tanpa daftar */
    }
    gambarKandidat();
  }

  function bersihkan(doc) {
    const d = doc || document;
    for (const e of Array.from(d.querySelectorAll(".aleta-ptj"))) e.remove();
    S = null;
  }

  /** Satu putaran pemasangan. Pulang ringkasan (dipakai uji). */
  function pasang(doc) {
    const d = doc || document;
    if (!aktifSekarang() || !berhak()) {
      if (d.querySelector(".aleta-ptj") && !(S && S.sibuk)) bersihkan(d);
      return { tombol: false, panel: false, mode: "" };
    }
    const tempat = tempatHalaman(d);
    const mode = tempat === "perkara" ? "perkara" : tempat ? "daftar" : "";
    if (!mode) {
      if (d.querySelector(".aleta-ptj") && !(S && S.sibuk)) bersihkan(d);
      return { tombol: false, panel: false, mode: "", tempat: "" };
    }
    const nomor = mode === "perkara" ? nomorHalaman(d) : "";
    if (!S || S.mode !== mode || S.nomor !== nomor || S.tempat !== tempat) {
      if (d.querySelector(".aleta-ptj")) bersihkan(d);
      S = keadaanBaru(mode, nomor, tempat);
      // Bawaan TERLIPAT di semua tempat (21 Okt 2026); hanya yang sengaja dibuka petugas (false) yang terbuka lagi.
      void bacaPenyimpanan([KUNCI_LIPAT]).then((simpan) => {
        if (!S || S.mode !== "perkara" || S.nomor !== nomor) return;
        const lip = simpan && simpan[KUNCI_LIPAT] && typeof simpan[KUNCI_LIPAT] === "object" ? simpan[KUNCI_LIPAT] : {};
        if (lip[KUNCI_LIPAT_PANEL] === false && !S.lipatDibaca) {
          S.terbuka = true;
          const tr = barisTombol(document);
          if (tr) pasangPanel(tr);
        }
        S.lipatDibaca = true;
      });
    }
    if (mode === "perkara") {
      const tr = barisTombol(d);
      if (!tr) return { tombol: false, panel: false, mode, tempat };
      pasangTombol(tr);
      pasangPanel(tr);
    } else {
      if (!pasangTombolMassal(tempat)) return { tombol: false, panel: false, mode, tempat };
      if (S.terbuka || S.akar) pasangPanelMassal(tempat);
    }
    return { tombol: true, panel: Boolean(S.akar && !S.akar.hidden), mode, tempat };
  }

  let detak = null;
  function mulaiDetak() {
    if (detak) return;
    detak = setInterval(() => {
      try {
        pasang(document);
      } catch {
        /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
      }
    }, 1500);
    pewaktuLencana = setInterval(() => void bacaLencana(), 60000);
    setTimeout(() => void bacaLencana(), 4000);
    // Antrean yang terbuka disegarkan tiap 30 detik agar status terbaru tampak tanpa menekan apa pun.
    setInterval(() => {
      if (S && S.akar && !S.akar.hidden && S.tab === "antrean") void muatAntrean();
    }, 30000);
  }

  async function mulai() {
    try {
      const s = await bacaPenyimpanan(["aktif"]);
      nyala = s.aktif !== false;
      try {
        chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah || !ubah.aktif) return;
          nyala = ubah.aktif.newValue !== false;
        });
      } catch {
        /* di luar konteks ekstensi */
      }
      if (/\/aps_badilag\//i.test(String(location.pathname || ""))) return;
      if (!document.body) return;
      document.addEventListener("aleta-uji-berubah", () => pasang(document));
      pasang(document);
      mulaiDetak();
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
  }

  globalThis.aletaPutusanTerjadwal = {
    versi: "b3-21okt-2",
    pasang,
    bersihkan,
    keadaan: () => S,
    tambahBerkas,
    muatKandidatTanggal,
    muatAntrean,
    muatPratinjau,
    hasilPasangan,
    kirimJadwal,
    murni: { berhak, barisTombol, nomorHalaman, modeHalaman, tempatHalaman, witaDari, hariKerjaBerikut, sebutTanggal },
  };
  void mulai();
})();
