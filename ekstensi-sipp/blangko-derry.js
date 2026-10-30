"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - TAMPILAN DI HALAMAN ABT (TAHAP C DAN D)
 * ============================================================================
 *
 * Skrip konten ABT, berkas TERSENDIRI supaya tidak bertabrakan dengan abt.js.
 * Dimuat sesudah panel-alat.js (memakai alatAmbil, alatGolonganMenuSemua bila
 * ada - tanpa keduanya tetap jalan dengan fetch biasa) dan seluruh isinya
 * dibungkus satu fungsi: tidak satu pun nama puncak yang dapat menabrak berkas
 * lain. Yang keluar hanya globalThis.aletaBlangkoDerry.
 *
 * Rancangannya: D:/aleta-dev/kerja/ide-meja-blangko/blangko-abt-581-v12.html.
 *
 * ----------------------------------------------------------------------------
 * TAHAP C - KERANGKA
 * ----------------------------------------------------------------------------
 *   - ABT tampil biasa. Klik grup "Blangko Derry (Daftar s.d. Produk)" di bilah
 *     kiri -> tampilan berganti ke "Blangko ABT by Derry Briantono". Klik grup
 *     itu TIDAK ditahan: ABT tetap membuka/menutup grupnya sendiri di bawah.
 *   - Kartu tawaran di pojok kanan bawah ABT biasa: Aktifkan / Nanti saja /
 *     Jangan tawarkan lagi.
 *   - Saklar (bawaan, tawaran, saran Tab, pengingat isian kosong) memakai
 *     chrome.storage.local yang sama dengan popup ("Widget ALETA" di tampilan
 *     ini hanya jendela kedua untuk saklar yang sama). Tema memakai kunci
 *     temaPanel - satu tema untuk popup, panel SIPP, panel ABT, dan tampilan ini.
 *   - Panel ALETA lama disembunyikan selama tampilan ini aktif (kelas
 *     aleta-bd-aktif di <html>, aturannya di blangko-derry.css) dan muncul lagi
 *     di ABT lama maupun grup lain.
 *   - "Alat saya" per peran. Super Admin ALETA dan Admin ABT melihat semuanya
 *     dan dapat "Lihat sebagai akun".
 *
 * ----------------------------------------------------------------------------
 * TAHAP D - DAFTAR PERKARA
 * ----------------------------------------------------------------------------
 *   Sumber: GET /aleta/api/aleta-ecourt/perkara-saya (rute BACA SAJA, lihat
 *   perkara-saya/route.ts). Skor prioritas, empat tampilan, enam urutan, nama
 *   pihak hanya saat kursor, daftar mengecil sesudah perkara dipilih, klik dua
 *   kali nomor perkara = ganti perkara.
 *
 * ----------------------------------------------------------------------------
 * TAHAP E-G - MENEMPEL LEWAT api
 * ----------------------------------------------------------------------------
 *   Wadah berlabel (api.wadah("pilih-blangko" | "perlu-diisi" | "pratinjau" |
 *   "cetak")) diisi blangko-derry-isian.js (tahap F-G), yang memanggil
 *   api.tahapSiap(nama) supaya tanda "menyusul" hilang. Perkara yang dipilih
 *   diumumkan lewat peristiwa "aleta-bd-perkara" di document dan
 *   api.perkaraTerpilih(); alat di menu "Alat saya" didaftarkan lewat
 *   api.daftarkanAlat(id, fn). Rekomendasi blangko (tahap E) dipasang lewat
 *   api.pasangRekomendasi(fn) dan dibaca lewat api.rekomendasi(ctx);
 *   kelengkapan isian per perkara dilaporkan balik lewat api.laporIsian().
 *
 * Tidak ada yang ditulis ke ABT, SIPP, maupun ALETA oleh berkas ini: seluruh
 * permintaan jaringannya GET.
 */
(function blangkoDerryModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaBlangkoDerry) return;

  // ──────────────────────────────────────────────────────────────────────────
  // Konstanta
  // ──────────────────────────────────────────────────────────────────────────
  const API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
  const API_PERKARA = "/aleta/api/aleta-ecourt/perkara-saya";
  const API_SIDANG = "/aleta/api/aleta-ecourt/sidang";
  /** Hak folder Blangko Derry + saklar Pengaturan SIPP & ABT (baca saja, 16 Okt malam). */
  const API_HAK = "/aleta/api/aleta-ecourt/blangko-derry?hak=1";
  /** 22 Okt malam: Tes putusan - cari perkara acuan MANA PUN di SIPP menurut nomor (baca saja; Super Admin). */
  const API_TES_CARI = "/aleta/api/aleta-ecourt/blangko-derry/tes-cari";
  const UMUR_HAK_MS = 5 * 60 * 1000;
  const K = {
    bawaan: "blangkoDerryBawaan",
    tawar: "blangkoDerryTawar",
    saran: "blangkoDerrySaran",
    ingat: "blangkoDerryIngat",
    // JJ2 (18 Okt): tanya-jawab jawab-menjawab otomatis dari berkas e-Court (bawaan NYALA).
    tjJawab: "blangkoDerryTjJawab",
    // 19 Okt: isi otomatis dari SIPP (bawaan NYALA), diingat per pengguna seperti saklar lain.
    isiOto: "blangkoDerryIsiOto",
    // 27 Okt: naskah cetak disiapkan di latar begitu isian lengkap (bawaan NYALA), diingat per pengguna.
    siapNaskah: "blangkoDerrySiapNaskah",
    // 22 Okt: "Tes putusan" (hanya Super Admin): blangko apa pun dicoba pada perkara acuan, tanpa menulis apa pun. Bawaan mati, diingat per pengguna.
    tesPutusan: "blangkoDerryTesPutusan",
    // 20 Okt: pratinjau BAS & relaas di SIPP sebelum diunduh (bawaan NYALA), saklarnya di Alat saya.
    pratinjau: "pratinjauBasRelaas",
    // F1.5 (17 Okt): gembok panel ALETA di ABT biasa (sama dengan popup & tombol gembok panel).
    gembok: "gembokKepalaAbt",
    tema: "temaPanel",
    daftar: "blangkoDerryDaftar",
    ukuran: "blangkoDerryUkuran",
    aktif: "aktif",
  };
  const SESI_LAMA = "aleta-bd-lama";
  const SESI_NANTI = "aleta-bd-nanti";
  const ID_AKAR = "aleta-bd-akar";
  const ID_TAWAR = "aleta-bd-tawar";
  const KELAS_AKTIF = "aleta-bd-aktif";
  const NAMA_PERAN = { hakim: "Hakim", pp: "Panitera Pengganti", js: "Juru sita", kasir: "Kasir", ptsp: "PTSP", admin: "Super Admin / Admin" };
  /**
   * 28 Okt 2026: pilihan "Lihat sebagai" PTSP yang SELALU ada, juga sebelum satu pun akun PTSP dibuat. Ia membawa nama tetap ini
   * (bukan nama orang) ke server, yang memperlakukan "peranSebagai=ptsp + nama" sebagai tampilan PTSP: daftar satker, baca saja.
   * Akun PTSP sungguhan tampil di bawahnya seperti kelompok lain.
   */
  const NAMA_PTSP_SEMUA = "Semua petugas PTSP";
  /**
   * 28 Okt 2026 - UKUR KELENGKAPAN ISIAN DI LATAR. Perkara di daftar yang sedang tampil diukur satu per satu (serentak 2, ada jeda, hanya
   * membaca) lewat pengukur yang dipasang langkah Isian; hasilnya diingat per perkara dengan waktu ukurnya (juga di sessionStorage tab ini,
   * karena ABT berpindah halaman) dan dianggap segar `umurMs`. Yang gagal/belum punya blangko dicoba lagi paling cepat setelah `ulangMs`.
   * Pengukuran baru mulai `mulaiMs` sesudah daftar tampil dan berhenti selama petugas membuka satu perkara (layar kerja didahulukan).
   */
  const UKUR = { serentak: 2, batas: 60, umurMs: 10 * 60 * 1000, ulangMs: 2 * 60 * 1000, jedaMs: 150, mulaiMs: 400, batasWaktuMs: 60 * 1000, puncak: 0 };
  const KUNCI_SESI_UKUR = "aleta-bd-ukur";
  const UMUR_SESI_UKUR_MS = 6 * 60 * 60 * 1000;
  const namaTampilSebagai = (nama) => (nama === NAMA_PTSP_SEMUA ? "PTSP (semua petugas PTSP)" : nama);
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const TTL_DAFTAR_MS = 45 * 1000;

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu kecil
  // ──────────────────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cari = (s, akar) => (akar || document).querySelector(s);
  const cariSemua = (s, akar) => Array.from((akar || document).querySelectorAll(s));
  const tglS = (s) => {
    const [y, m, d] = String(s || "").split("-");
    return y && m && d ? `${+d} ${BULAN[+m - 1].slice(0, 3)} ${y}` : "-";
  };
  const selisih = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
  const tambah = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  /**
   * 21 Okt (w25): tanggal dari isian rentang -> "YYYY-MM-DD", "" bila kosong/bukan tanggal. Menerima nilai input type=date
   * (YYYY-MM-DD) dan ketikan dd/mm/yyyy atau dd-mm-yyyy.
   */
  function isoTanggalRentang(v) {
    const t = String(v == null ? "" : v).trim();
    let y;
    let m;
    let d;
    let a = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (a) [, y, m, d] = a;
    else if ((a = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [, d, m, y] = a;
    else return "";
    const p = (n) => String(n).padStart(2, "0");
    const iso = `${y}-${p(m)}-${p(d)}`;
    const dt = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso ? "" : iso;
  }
  /** Rentang dari dua isian: satu tanggal = satu hari, terbalik ditukar, keduanya kosong = null. */
  function rentangDari(dari, sampai) {
    let a = isoTanggalRentang(dari);
    let b = isoTanggalRentang(sampai);
    if (!a && !b) return null;
    if (!a) a = b;
    if (!b) b = a;
    if (a > b) [a, b] = [b, a];
    return { dari: a, sampai: b };
  }
  const hariDari = (t) => HARI[new Date(`${t}T00:00:00Z`).getUTCDay()];
  const tanggalLokal = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const nomorPendek = (n) => String(n || "").replace(/\/PA\.[A-Za-z]+$/, "");
  const nomorAngka = (n) => parseInt(n, 10) || 0;
  const potong = (t, n) => {
    t = String(t == null ? "" : t);
    return t.length > n ? `<span class="bd-pot" title="${esc(t)}">${esc(t.slice(0, n - 1))}…</span>` : esc(t);
  };
  const namaBersih = (n) => String(n || "-").replace(/\s*\(Ketua\)/, "");
  /** Gelar memakai koma juga: potongan yang seluruh katanya gelar menempel pada nama sebelumnya (sama dengan perkara-sendiri.ts di portal). */
  const GELAR = new Set(["drs", "dra", "dr", "h", "hj", "sh", "shi", "si", "mh", "ma", "mag", "ag", "se", "st", "ir", "lc", "msi", "mkn", "spdi", "sag", "bin", "binti"]);
  function pecahNama(teks) {
    const hasil = [];
    for (const potongan of String(teks || "").split(",")) {
      const isi = potongan.trim();
      if (!isi) continue;
      const kata = isi.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((k) => k.length > 2 && !GELAR.has(k));
      if (kata.length === 0 && hasil.length > 0) {
        hasil[hasil.length - 1] += `, ${isi}`;
        continue;
      }
      hasil.push(isi);
    }
    return hasil;
  }
  const pertama = (teks) => pecahNama(teks)[0] || "";

  function sesi(kunci, nilai) {
    try {
      if (nilai === undefined) return window.sessionStorage.getItem(kunci);
      if (nilai === null) window.sessionStorage.removeItem(kunci);
      else window.sessionStorage.setItem(kunci, nilai);
    } catch {
      /* penyimpanan sesi ditolak: pilihan hanya berlaku sampai halaman dimuat ulang */
    }
    return null;
  }

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
      return Promise.resolve(chrome.storage.local.set(isi)).then(
        () => true,
        () => false
      );
    } catch {
      return Promise.resolve(false);
    }
  }

  async function ambil(alamat, yang) {
    const opsi = { credentials: "include", cache: "no-store" };
    const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, opsi, yang) : await fetch(alamat, opsi);
    const luar = await r.json().catch(() => null);
    if (!r.ok || !luar || luar.ok === false) {
      const sebab =
        (luar && (luar.alasan || (luar.error && luar.error.message))) ||
        (typeof alatPesanGagal === "function" ? alatPesanGagal(null, r.status, yang) : `${yang} gagal (kode ${r.status}).`);
      throw new Error(String(sebab));
    }
    return luar.data ? luar.data : luar;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Peran
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Golongan menu (panel-alat.js) -> peran di tampilan ini.
   *   hakim, ketua            -> hakim (putusan)
   *   pp, panitera, panmud,
   *   panitera-utama, analis  -> pp (BAS)
   *   jurusita                -> js (relaas)
   * Golongan lain (mediator, sekretariat, lain-tetap) tidak punya perkara sendiri.
   */
  function peranDariGolongan(golongan) {
    const hasil = new Set();
    for (const g of golongan || []) {
      const x = String(g || "").toLowerCase();
      if (x === "admin") hasil.add("admin");
      else if (x === "hakim" || x === "ketua") hasil.add("hakim");
      else if (["pp", "panitera", "panmud", "panitera-utama", "analis"].includes(x)) hasil.add("pp");
      else if (x === "jurusita") hasil.add("js");
      else if (x === "kasir") hasil.add("kasir");
      else if (x === "ptsp") hasil.add("ptsp");
    }
    return hasil;
  }

  // ── SATU ORANG SATU ENTRI di "Lihat sebagai" (20 Okt 2026) ────────────────
  // Nama petugas di jadwal SIPP disalin per perkara dan ejaannya berbeda ("Derry Briantono" / "Derry Briantono, S.H."). Server sudah
  // menyatukannya (src/lib/orang-unik.ts); salinan di bawah menjaga tampilan tetap satu entri bila server memberi daftar lama, dan
  // mengenali pilihan tersimpan yang ejaannya berbeda dari daftar baru. Aturannya sama: gelar dan pecahan gelar dibuang, kunci diadu sama persis.
  const GELAR_ORANG = new Set(["drs", "dra", "dr", "h", "hj", "sh", "shi", "si", "mh", "ma", "mag", "ag", "se", "st", "ir", "lc", "msi", "mkn", "spdi", "sag", "sh i", "bin", "binti"]);
  const GELAR_ORANG_TAMBAHAN = new Set(["kom", "spd", "mpd", "mkom", "sip", "mhum", "mkes", "skm", "apt", "ners"]);
  function kunciOrang(nama) {
    const mentah = String(nama == null ? "" : nama);
    const potong = mentah
      .split(",")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((k) => k.length > 2 && !GELAR_ORANG.has(k) && !GELAR_ORANG_TAMBAHAN.has(k));
    if (potong.length) return Array.from(new Set(potong)).sort().join(" ");
    return mentah.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  const rapikanNamaOrang = (n) => String(n == null ? "" : n).replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").replace(/\s+\./g, ".").trim();
  const hurufGelarOrang = (n) => String(n).split(",").slice(1).join(",").replace(/[^A-Za-z]/g, "").length;
  const cacatNamaOrang = (n) => (/[A-Za-z]\.\s+[A-Z]\.[A-Z]/.test(n) ? 1 : 0) + (/,\S/.test(n) ? 1 : 0) + (/\s{2,}/.test(n) ? 1 : 0);
  /** Ejaan yang ditampilkan: gelar terlengkap, lalu tulisan paling rapi, lalu paling panjang. */
  function namaTerbaikOrang(varian) {
    const calon = Array.from(new Set(varian.map((v) => String(v == null ? "" : v).trim()).filter(Boolean)));
    if (!calon.length) return "";
    calon.sort((a, b) => hurufGelarOrang(b) - hurufGelarOrang(a) || cacatNamaOrang(a) - cacatNamaOrang(b) || b.length - a.length || a.localeCompare(b, "id"));
    return rapikanNamaOrang(calon[0]);
  }
  /** Daftar nama mentah -> satu nama (terlengkap) per orang, terurut. */
  function satukanOrang(daftar) {
    const peta = new Map();
    for (const n of Array.isArray(daftar) ? daftar : []) {
      const mentah = String(n == null ? "" : n).trim();
      const k = mentah ? kunciOrang(mentah) : "";
      if (!k) continue;
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k).push(mentah);
    }
    // Urutan kemunculan dipertahankan: server sudah mengurutkan menurut nama.
    return Array.from(peta.values()).map(namaTerbaikOrang);
  }

  // ── HAK PUTUSAN/BAS PER PERAN (16 Okt 2026 malam) ─────────────────────────
  // Keluhan pengguna: "role hakim masih bisa akses BAS dan begitupun sebaliknya".
  // Sebabnya di sini: Super Admin/Admin yang memilih "Lihat sebagai akun" tetap
  // mendapat ketiga jenis dokumen dan boleh menulis (adm() menang atas akun yang
  // ditiru). Kini satu aturan untuk semua: Super Admin/Admin TANPA "Lihat
  // sebagai" = semuanya; selain itu jenis dokumen peran (hakim putusan, PP BAS,
  // juru sita relaas) DITAMBAH jenis yang dibuka saklar Pengaturan SIPP & ABT
  // ("Hakim boleh membuka folder BAS", "Panitera Pengganti boleh membuka folder
  // putusan") - keadaannya dibaca dari hak menu ABT lewat portal, gagal = mati.
  // Akun yang ditiru juga dibatasi per FOLDER seperti ABT (menu_cek: grup ATAU
  // grup "selalu boleh"; kosong = semua pengguna).
  const PERAN_JENIS_DOK = { hakim: "put", pp: "bas", js: "rel", ptsp: "ptsp" };
  const SAKLAR_JENIS_DOK = { hakim: ["bas", "hakimBas"], pp: ["put", "ppPutusan"] };
  /** Grup SIPP yang ditiru per peran tampilan: hakim = Hakim + Ketua/Wakil, PP, Juru Sita. */
  const GRUP_ABT_PERAN = { hakim: ["20", "10"], pp: ["500"], js: ["600"] };
  const pecahGrup = (s) => String(s == null ? "" : s).split("|").map((x) => x.trim()).filter(Boolean);
  // 19 Okt 2026: nama menu Derry ditulis lengkap ("CG - BAS" -> "Cerai Gugat - BAS"); nama lama dan baru dianggap SAMA
  // (kunci dari alatKunciKelompok di panel-alat.js bila ada; tanpa itu - uji tersendiri - hanya dirapikan).
  const kunciNamaMenu = (s) => (typeof alatKunciKelompok === "function" ? alatKunciKelompok(s) : String(s || "").replace(/\s+/g, " ").trim().toLowerCase());
  const samaNamaMenu = (a, b) => kunciNamaMenu(a) === kunciNamaMenu(b);

  /** Folder ABT terbuka untuk salah satu grup? Cermin Abt_model::menu_cek (CONCAT dengan NULL = semua). */
  function folderTerbukaUntuk(f, grup) {
    if (!f) return false;
    if (f.user_grup_id == null || f.user_top_id == null || f.user_grup_id === "" || f.user_top_id === "") return true;
    const ada = [...pecahGrup(f.user_grup_id), ...pecahGrup(f.user_top_id)];
    return (grup || []).some((g) => ada.includes(String(g)));
  }

  /**
   * Jenis dokumen yang boleh dibuka/ditulis. o = { admin, sebagaiPeran, peran: ["hakim"|"pp"|"js"],
   * hak: { saklar: { hakimBas, ppPutusan }, folder } | null }.
   */
  function jenisDokumenBoleh(o) {
    if (o.admin && !o.sebagaiPeran) return ["put", "bas", "rel"];
    const peran = o.admin ? [o.sebagaiPeran] : (o.peran || []).filter((x) => PERAN_JENIS_DOK[x]);
    const saklar = (o.hak && o.hak.saklar) || {};
    const boleh = new Set();
    for (const p of peran) {
      if (PERAN_JENIS_DOK[p]) boleh.add(PERAN_JENIS_DOK[p]);
      const s = SAKLAR_JENIS_DOK[p];
      if (s && saklar[s[1]] === true) boleh.add(s[0]);
    }
    return ["put", "bas", "rel", "ptsp"].filter((j) => boleh.has(j));
  }

  /**
   * Grup SIPP per peran tampilan untuk folder di luar putusan/BAS/relaas (99 PTSP, 17 Okt): PP = PP +
   * Panitera + Panmud; PTSP = meja & panmud gugatan/permohonan/jinayat/perkara. Hakim/juru sita tetap
   * GRUP_ABT_PERAN (Ketua/Wakil 10 ikut hakim).
   */
  const GRUP_ABT_PERAN_LAIN = {
    pp: ["500", "30", "410", "430"],
    ptsp: ["1000", "1001", "1002", "1003", "1010", "1011", "1012", "1013", "1020", "1022", "1023", "1030", "1031", "1032", "1033", "1034"],
  };

  /**
   * 19 Okt 2026 - blangko IKRAR TALAK (BAS sidang ikrar, penetapan ikrar/gugur, relaas panggilan ikrar) tersebar di tiga folder.
   * Hak folder asalnya (menu ABT ikrar: hakim 20, PP 500, juru sita 600) lebih luas daripada jenis dokumen satu peran:
   * hakim = penetapan + BAS, PP = BAS, juru sita = relaas. Berlaku HANYA bila pemanggil menandai k.ikrar === true.
   */
  const IKRAR_JENIS_PERAN = { hakim: ["put", "bas"], pp: ["bas"], js: ["rel"] };
  function ikrarJenisBoleh(o) {
    if (o.admin && !o.sebagaiPeran) return ["put", "bas", "rel"];
    const peran = o.admin ? [o.sebagaiPeran] : o.peran || [];
    const boleh = new Set();
    for (const p of peran) for (const j of IKRAR_JENIS_PERAN[p] || []) boleh.add(j);
    return ["put", "bas", "rel"].filter((j) => boleh.has(j));
  }

  /** Kelompok (menu) Blangko Derry boleh tampil/dibuka? k = { nama (nama_alias ABT), jenis, ikrar? }. */
  function kelompokBoleh(k, o) {
    if (!k) return false;
    if (o.admin && !o.sebagaiPeran) return true;
    const folder = o.hak && Array.isArray(o.hak.folder) ? o.hak.folder : null;
    const f = folder && folder.find((x) => samaNamaMenu(x.namaAlias, k.nama) || samaNamaMenu(x.nama, k.nama));
    // Folder PTSP (99 PTSP, 17 Okt 2026) bukan dokumen satu peran: haknya PERSIS hak menu ABT
    // (abt_menu 991: grup 30|500|430|1000|1010|1020|1032|1001|1011, top 1|10|30). Akun biasa: menunya
    // sudah disaring ABT sendiri. Akun yang ditiru: dicocokkan seperti menu_cek.
    if (k.jenis === "ptsp") {
      if (!o.admin) return true;
      const grup = [...(GRUP_ABT_PERAN[o.sebagaiPeran] || []), ...(GRUP_ABT_PERAN_LAIN[o.sebagaiPeran] || [])];
      return f ? folderTerbukaUntuk(f, grup) : o.sebagaiPeran === "pp" || o.sebagaiPeran === "ptsp";
    }
    if (!jenisDokumenBoleh(o).includes(k.jenis) && !(k.ikrar === true && ikrarJenisBoleh(o).includes(k.jenis))) return false;
    // Akun biasa: menunya sudah disaring ABT menurut grup akun ABT-nya sendiri.
    if (!o.admin) return true;
    return f ? folderTerbukaUntuk(f, GRUP_ABT_PERAN[o.sebagaiPeran] || []) : true;
  }

  /** Admin ABT dikenali dari kepala halaman ABT ("Administrator" / "Super Administrator"). */
  function adminAbtDiHalaman() {
    const kepala = cari("#header .h_right") || cari(".h_right") || cari("#header");
    return Boolean(kepala && /\badministrator\b/i.test(String(kepala.textContent || "")));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Skor prioritas, urutan - MURNI (diuji langsung)
  // ──────────────────────────────────────────────────────────────────────────
  /** Sidang acuan: hari ini; bila tidak ada, yang terakhir sampai hari ini; bila tidak ada, yang terdekat. */
  function indeksAcuan(sidang, hariIni) {
    if (!sidang || !sidang.length) return -1;
    const h = sidang.findIndex((s) => s.tanggal === hariIni);
    if (h >= 0) return h;
    let lewat = -1;
    sidang.forEach((s, i) => {
      if (s.tanggal && s.tanggal < hariIni) lewat = i;
    });
    return lewat >= 0 ? lewat : 0;
  }

  const LABEL_DOK = { put: "putusan", bas: "BAS", rel: "relaas" };

  /**
   * Keadaan satu perkara untuk daftar. Yang diukur hanya yang SUDAH terbaca dari
   * SIPP: putusan terunggah (hakim), BAS sidang terunggah (PP), tanggal putusan
   * dan minutasi. Kelengkapan isian dan status cetak baru ada pada tahap F-G;
   * sampai itu, isian "belum diukur" dan tidak ikut skor. Relaas juru sita tidak
   * terbaca di jadwal: ia "belum terukur" dan tidak pernah dianggap selesai.
   */
  function ringkasan(p, ctx) {
    const hariIni = ctx.hariIni;
    // sebagai kosong (PTSP: hasil cari nomor) = tanpa dokumen peran; bot lama tanpa ruas = semua peran.
    const peran = (Array.isArray(p.sebagai) ? p.sebagai : ["hakim", "pp", "js"]).filter((x) => x === "hakim" || x === "pp" || x === "js");
    const i = indeksAcuan(p.sidang, hariIni);
    const s = p.sidang[i] || { tanggal: "", agenda: "", ket: "", adaBas: null };
    const belumTiba = Boolean(s.tanggal) && s.tanggal > hariIni;
    const dj = [];
    if (peran.includes("hakim") && p.sudahPutus) dj.push("put");
    if (peran.includes("pp") && s.tanggal && s.tanggal <= hariIni) dj.push("bas");
    if (peran.includes("js") && (p.sudahPutus || belumTiba)) dj.push("rel");
    const ada = { put: p.adaBerkasPutusan, bas: s.adaBas, rel: null };
    // Tahap F-G melaporkan isian dan cetakan per perkara (ctx.lapor); tanpa itu isian "belum diukur".
    const lap = ctx.lapor && ctx.lapor.get ? ctx.lapor.get(p.nomorPerkara) : null;
    if (lap && lap.dicetak) for (const j of dj) if (lap.dicetak[`${p.nomorPerkara}|${j}`] && ada[j] !== true) ada[j] = "dicetak";
    const belum = dj.filter((j) => ada[j] === false);
    const minutasi = Boolean(p.tanggalMinutasi);
    const selesai = minutasi || (dj.length > 0 && dj.every((j) => ada[j] === true));
    const tanpaKerja = dj.length === 0;
    const alasan = [];
    let skor = 0;
    if (s.tanggal === hariIni) {
      skor += 30;
      alasan.push("Sidang hari ini");
    }
    if (p.sudahPutus && belum.length) {
      const nama = belum.map((j) => LABEL_DOK[j]).join("/");
      if (p.tanggalPutusan === hariIni) {
        skor += 40;
        alasan.push(`Putus hari ini, belum ada ${nama} di SIPP`);
      } else {
        skor += 30;
        alasan.push(`Putus ${tglS(p.tanggalPutusan)}, belum ada ${nama} di SIPP`);
      }
    }
    const sisaMinutasi = p.tanggalPutusan && !minutasi ? selisih(hariIni, tambah(p.tanggalPutusan, 14)) : null;
    if (sisaMinutasi !== null && !selesai) {
      if (sisaMinutasi <= 3) {
        skor += 25;
        alasan.push(`Batas minutasi ${Math.max(sisaMinutasi, 0)} hari lagi`);
      } else if (sisaMinutasi <= 7) {
        skor += 15;
        alasan.push(`Batas minutasi ${sisaMinutasi} hari lagi`);
      } else if (sisaMinutasi <= 14) skor += 5;
    }
    if (!belumTiba && belum.length) {
      skor += 15;
      alasan.push("Belum diunggah ke SIPP");
    }
    if (belumTiba) {
      skor -= 10;
      alasan.push("Sidang belum tiba");
    }
    if (selesai) {
      skor -= 100;
      alasan.length = 0;
      alasan.push(minutasi ? "Sudah minutasi" : "Selesai");
    }
    const tingkat = selesai ? "selesai" : skor >= 60 ? "tinggi" : skor >= 25 ? "sedang" : "rendah";
    const dicetak = dj.length > 0 && dj.every((j) => ada[j] === "dicetak" || ada[j] === true);
    const dokTxt = tanpaKerja
      ? "Belum ada yang perlu dibuat"
      : selesai
        ? minutasi
          ? "Sudah minutasi"
          : "Sudah ada di SIPP"
        : dicetak
          ? "Sudah dicetak"
          : belum.length
            ? belumTiba
              ? "Belum waktunya"
              : "Belum diunggah ke SIPP"
            : "Belum terukur";
    const persen = lap && typeof lap.t === "number" ? (lap.t ? Math.min(1, lap.a / lap.t) : 1) : null;
    const uk = ctx.ukur && ctx.ukur.get ? ctx.ukur.get(p.nomorPerkara) : null;
    const isi = teksIsian(lap, uk, tanpaKerja && !ctx.ptsp);
    return {
      n: p.nomorPerkara,
      p,
      i,
      s,
      dj,
      belumTiba,
      selesai,
      tanpaKerja,
      skor,
      alasan,
      tingkat,
      dokTxt,
      dokKelas: selesai || dicetak ? "ok" : "",
      persen,
      isiTxt: isi.txt,
      isiKet: isi.ket,
      isiKelas: isi.kelas,
      sisaMinutasi,
      konsep: konsepDari(p),
    };
  }
  /** Umur ukuran dalam kalimat biasa ("baru saja", "5 menit lalu", "2 jam lalu"); kosong bila waktunya tidak diketahui. */
  function umurUkur(saat, sekarang) {
    const t = Number(saat);
    if (!t) return "";
    const mnt = Math.max(0, Math.round(((sekarang === undefined ? Date.now() : sekarang) - t) / 60000));
    if (mnt < 1) return "baru saja";
    if (mnt < 60) return `${mnt} menit lalu`;
    const jam = Math.round(mnt / 60);
    return jam < 24 ? `${jam} jam lalu` : `${Math.round(jam / 24)} hari lalu`;
  }
  const namaBlangkoUkur = (b) => String((b && (b.berkas || b.judul)) || "").replace(/\.rtf$/i, "").trim();
  /**
   * Lencana "kelengkapan isian" satu perkara: teks, keterangan (tooltip) dan kelas warna. Murni.
   *   lap = hasil ukur ({ a, t, saat, blangko, sumber, perkiraan }) dari langkah Isian ("dibuka") atau pengukur latar ("latar");
   *   uk  = keadaan pengukur latar tanpa angka ({ status: memuat | tanpa-blangko | galat | tanpa-dokumen });
   *   tanpaKerja = perkara belum punya dokumen untuk peran ini.
   * Angka yang dihitung: isian WAJIB blangko yang sudah terisi (isian tambahan tidak ikut).
   */
  function teksIsian(lap, uk, tanpaKerja, sekarang) {
    if (lap && typeof lap.t === "number") {
      const nama = namaBlangkoUkur(lap.blangko);
      const umur = umurUkur(lap.saat, sekarang);
      const lengkap = lap.t === 0 || lap.a >= lap.t;
      const ket =
        (lap.t === 0 ? "Blangko ini tidak punya isian wajib untuk perkara ini." : `Isian wajib blangko yang sudah terisi: ${lap.a} dari ${lap.t}.`) +
        (nama ? ` Blangko: ${nama}.` : "") +
        (umur ? ` Diukur ${umur}.` : "") +
        (lap.sumber === "latar" ? " Dihitung dari isian yang sudah tersimpan di ABT; isian otomatis dari SIPP menyusul saat perkara dibuka." : "") +
        (lap.perkiraan ? " Daftar bukti baru dihitung setelah perkara dibuka." : "") +
        (lengkap ? " Klik untuk membuka perkara ini di langkah Isian." : " Klik untuk membuka isian yang masih kosong.");
      return { txt: lap.t === 0 ? "Tidak perlu diisi" : lap.a >= lap.t ? "Isian lengkap" : `Terisi ${lap.a} dari ${lap.t}`, ket, kelas: lengkap ? "ok" : lap.a ? "sebagian" : "belum" };
    }
    const st = uk && uk.status;
    if (st === "memuat") return { txt: "Mengukur isian…", ket: "Sedang mengukur isian wajib blangko perkara ini di latar.", kelas: "" };
    if (st === "tanpa-blangko") return { txt: "Blangko belum dipilih", ket: "Perkara ini belum punya blangko yang dipilih, jadi isian wajibnya belum bisa dihitung. Klik untuk membuka perkara lalu pilih blangko.", kelas: "" };
    if (st === "galat") return { txt: "Isian belum terbaca", ket: "Isian perkara ini belum bisa dibaca dari ABT sekarang; akan dicoba lagi. Klik untuk membuka perkara.", kelas: "" };
    if (st === "tanpa-dokumen" || tanpaKerja) return { txt: "Belum ada yang perlu diisi", ket: "Perkara ini belum punya dokumen yang perlu diisi untuk peran Anda saat ini.", kelas: "" };
    return { txt: "Isian belum diukur", ket: "Isian wajib blangko diukur otomatis di latar begitu daftar tampil. Klik untuk membuka perkara ini.", kelas: "" };
  }

  /**
   * 26 Okt 2026: "konsep sementara" = perkara yang di Jadwal Sidang ALETA diberi "tunjuk konseptor" (satu-satunya sumber: portal
   * menyertakannya pada tiap perkara sebagai `konsepSementara`). Hanya yang `milikAkun` (cocok dengan akun yang sedang dilihat;
   * "Semua akun" = semua tunjukan) yang dihitung. Bentuk lain/hilang = bukan konsep sementara. Murni.
   */
  function konsepDari(p) {
    const k = p && p.konsepSementara;
    if (!k || typeof k !== "object" || k.milikAkun !== true) return null;
    const nama = String(k.nama || "").trim();
    return nama ? { nama, oleh: String(k.ditetapkanOleh || "").trim() } : null;
  }

  const TEKS_TINGKAT = { tinggi: "Perlu segera", sedang: "Menyusul", rendah: "Tidak mendesak", selesai: "Selesai" };
  const KUNCI_URUT = {
    prioritas: (r) => r.skor,
    tanggal: (r) => r.s.tanggal,
    nomor: (r) => nomorAngka(r.n),
    jenis: (r) => `${r.p.jenisPerkara} ${String(nomorAngka(r.n)).padStart(5, "0")}`,
    isian: (r) => (r.persen == null ? 1 : r.persen),
    cetak: (r) => (r.selesai ? 1 : 0),
    minutasi: (r) => (r.sisaMinutasi == null ? 9999 : r.sisaMinutasi),
  };
  const ARAH_ALAMI = { prioritas: -1, tanggal: 1, nomor: 1, jenis: 1, isian: 1, cetak: 1, minutasi: 1 };
  const NAMA_URUT = {
    prioritas: "paling perlu dikerjakan",
    tanggal: "tanggal sidang",
    nomor: "nomor perkara",
    jenis: "jenis perkara",
    isian: "kelengkapan isian",
    cetak: "status dokumen di SIPP",
    minutasi: "batas minutasi",
  };

  function urutkan(daftar, urut, arah, depan) {
    const kunci = KUNCI_URUT[urut] || KUNCI_URUT.prioritas;
    return daftar.slice().sort((x, y) => {
      // 26 Okt 2026: konsep sementara selalu paling atas; urutan pilihan pengguna berlaku di dalam masing-masing kelompok.
      if (Boolean(x.konsep) !== Boolean(y.konsep)) return x.konsep ? -1 : 1;
      if (depan && x.selesai !== y.selesai) return x.selesai ? 1 : -1;
      const a = kunci(x);
      const b = kunci(y);
      const c = a < b ? -1 : a > b ? 1 : 0;
      return c * arah || nomorAngka(x.n) - nomorAngka(y.n);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan
  // ──────────────────────────────────────────────────────────────────────────
  const S = {
    cfg: { bawaan: false, tawar: true, saran: true, ingat: true, tjJawab: true, isiOto: true, siapNaskah: true, pratinjau: true, tesPutusan: false },
    /** 19 Okt: tautan dari Jadwal Sidang portal (ABT dibuka dengan #bd=...): perkara, sidang, jenis, petunjuk. Null bila tidak ada/rusak. */
    tautan: null,
    tema: "gelap",
    siapa: null,
    siapaGalat: "",
    peranSet: new Set(),
    adminAbt: false,
    /** { saklar: { hakimBas, ppPutusan }, folder: [...] } dari portal; null = belum/gagal (saklar dianggap mati). */
    hak: null,
    hakSaat: 0,
    aktif: false,
    sebagai: { peran: "", nama: "" },
    mode: "hari",
    /** 28 Okt 2026: daftar PTSP hanya perkara baru (sidang pertama) - bila dimatikan, semua perkara yang bersidang pada tanggal itu. */
    ptspPertama: true,
    dari: "",
    sampai: "",
    /** 22 Okt 2026: satu tanggal tertentu (mode "tanggal") - berbeda dari rentang DARI-SAMPAI. */
    tgl: "",
    lihat: "kartu",
    urut: "prioritas",
    arah: -1,
    depan: true,
    /** 22 Okt 2026: sembunyikan perkara berprioritas "Selesai" di daftar. Bawaan tercentang; pilihan diingat per pengguna. */
    sembunyiSelesai: true,
    /** 26 Okt 2026: tampilkan perkara konsep sementara (di atas daftar). Bawaan NYALA; mati = disembunyikan. Diingat per pengguna. */
    tampilKonsep: true,
    ket: { jenis: true, sidang: true, pihak: true, isian: false, cetak: true, alasan: false, majelis: false, petugas: false },
    cariNomor: "",
    /** Jenis pencarian di kotak cari (19 Okt 2026): "semua" = saringan kata kunci otomatis. */
    cariJenis: "semua",
    /** 22 Okt malam: Tes putusan - hasil cari nomor perkara di SIPP (di luar jadwal) dan perkara acuan yang dipilih darinya. Hanya di memori halaman. */
    tesCari: { kata: "", memuat: false, galat: "", hasil: null },
    tesAcuan: null,
    data: null,
    memuat: false,
    galat: "",
    pk: null,
    sidIdx: 0,
    riwayat: new Map(),
    putusanSipp: new Map(), // 30 Okt: nomor perkara -> { amarVerstek, tanggalPutusan, alurPerkaraId } dari rincian SIPP (catatan temuan cetak)
    alatDaftar: new Map(),
    lapor: new Map(),
    /** Keadaan pengukur latar tanpa angka (nomor -> { status, saat, jenis, kunci }); angkanya ada di `lapor`. */
    ukur: new Map(),
    ukurAntre: [],
    ukurDalam: new Set(),
    ukurJalan: 0,
    ukurPewaktu: null,
    pengukur: null,
    rekomendasi: null,
    floatBuka: null,
    nyala: false,
    ukuran: "biasa",
    skala: 1,
  };
  const singgah = new Map();
  let akar = null;
  let tawar = null;
  let pengamat = null;
  let nomorMuat = 0;

  const adm = () => S.peranSet.has("admin") || S.adminAbt;
  const hariIni = () => (S.data && S.data.hariIni) || tanggalLokal();

  /**
   * Kunci PERAN yang sedang berlaku (20 Okt 2026): pilihan blangko dikunci padanya. Admin = peran yang dilihat ("semua" bila tidak
   * menyempit); akun biasa = peran dokumennya. Berubah = pilihan blangko lama (mis. BAS milik PP) tidak boleh terbawa ke peran lain.
   */
  function peranKunci() {
    // 22 Okt: mode Tes putusan = keadaan lain (semua blangko terbuka); memasang/melepasnya membuang blangko yang sedang terbuka.
    if (tesAktif()) return "adm:tes";
    return adm() ? `adm:${S.sebagai.peran || "semua"}` : `akun:${["hakim", "pp", "js", "ptsp"].filter((x) => S.peranSet.has(x)).join(",")}`;
  }
  /** Peran yang menentukan dokumen/daftar saat ini. */
  function peranDokumen() {
    if (adm()) return S.sebagai.peran ? (S.sebagai.peran === "ptsp" ? [] : [S.sebagai.peran]) : ["hakim", "pp", "js"];
    return ["hakim", "pp", "js"].filter((x) => S.peranSet.has(x));
  }
  function peranAlat() {
    if (adm()) return S.sebagai.peran ? [S.sebagai.peran] : ["hakim", "pp", "js", "kasir", "ptsp"];
    return ["hakim", "pp", "js", "kasir", "ptsp"].filter((x) => S.peranSet.has(x));
  }
  const berhakDaftar = () => adm() || ["hakim", "pp", "js", "ptsp"].some((x) => S.peranSet.has(x));
  /** 28 Okt 2026: Super Admin/Admin yang memilih "Lihat sebagai" akun PTSP melihat persis yang dilihat PTSP. */
  const sebagaiPtsp = () => adm() && S.sebagai.peran === "ptsp" && Boolean(S.sebagai.nama);
  /** PTSP (bukan admin): tak punya perkara sendiri; mencari nomor perkara satker, baca saja (folder 99 PTSP). */
  const ptspCari = () => sebagaiPtsp() || (!adm() && S.peranSet.has("ptsp"));
  /**
   * Daftar PTSP per tanggal (hari ini / tanggal tertentu / rentang): hanya PTSP murni (atau admin yang melihat sebagai PTSP).
   * Akun yang juga hakim/PP/juru sita tetap memakai daftar perkaranya sendiri; mencari nomor satker berlaku untuk keduanya.
   */
  const ptspDaftar = () => sebagaiPtsp() || (!adm() && S.peranSet.has("ptsp") && !["hakim", "pp", "js"].some((x) => S.peranSet.has(x)));
  const nomorCariPtsp = () => (ptspCari() ? S.cariNomor.trim() : "");
  /** Bahan aturan hak dokumen untuk keadaan sekarang (akun + "Lihat sebagai" + saklar). */
  const bahanHak = () => ({ admin: adm(), sebagaiPeran: adm() ? S.sebagai.peran : "", peran: ["hakim", "pp", "js", "ptsp"].filter((x) => S.peranSet.has(x)), hak: S.hak });
  const jenisDokumen = () => (tesAktif() ? ["put", "bas", "rel"] : jenisDokumenBoleh(bahanHak()));
  /**
   * 22 Okt 2026 - TES PUTUSAN. Super Admin saja (peran akun di portal, bukan nama orang). Saat tercentang, perkara yang dipilih menjadi ACUAN
   * data dan blangko dari jenis perkara/tahapan/folder mana pun boleh dibuka; sebagai gantinya TIDAK ADA yang ditulis ke ABT, SIPP, atau
   * e-Court (blangko-derry-isian.js mematikan semua jalur tulisnya lewat api.tesPutusan()).
   */
  function superAdmin() {
    const s = S.siapa;
    if (!s) return false;
    if (String(s.roleId || "").toLowerCase() === "super-admin") return true;
    return typeof alatKelasPeran === "function" ? alatKelasPeran(s.peran) === "aleta-peran-super" : /super/i.test(String(s.peran || ""));
  }
  function tesAktif() {
    return S.cfg.tesPutusan === true && superAdmin();
  }
  /** Hak folder & saklar dari portal (paling lama 5 menit); gagal = null, saklar dianggap mati. */
  let janjiHak = null;
  function muatHak(paksa) {
    if (!paksa && S.hak && Date.now() - S.hakSaat < UMUR_HAK_MS) return Promise.resolve(S.hak);
    if (janjiHak) return janjiHak;
    janjiHak = ambil(API_HAK, "Membaca hak blangko")
      .then((d) => {
        S.hak = d && d.ada ? { saklar: d.saklar || {}, folder: Array.isArray(d.folder) ? d.folder : [] } : null;
      })
      .catch(() => {
        S.hak = null;
      })
      .then(() => {
        S.hakSaat = Date.now();
        janjiHak = null;
        return S.hak;
      });
    return janjiHak;
  }

  function hitungPeran() {
    const s = S.siapa;
    let golongan = [];
    if (s) {
      if (typeof alatGolonganMenuSemua === "function") {
        try {
          golongan = alatGolonganMenuSemua({
            peran: s.peran,
            roleId: s.roleId,
            bolehKasir: s.bolehKasir,
            peranTambahan: s.peranTambahan,
            golonganMenu: s.golonganMenu,
          });
        } catch {
          golongan = [];
        }
      }
      if (!golongan.length && s.golonganMenu) golongan = s.golonganMenu;
    }
    S.peranSet = peranDariGolongan(golongan);
    S.adminAbt = adminAbtDiHalaman();
  }

  function namaPeranAkun() {
    if (!S.siapa) return "";
    return S.siapa.peran ? String(S.siapa.peran) : "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sidebar ABT
  // ──────────────────────────────────────────────────────────────────────────
  function tombolDerry() {
    return cariSemua("#navbar .accordion").find((b) => /^\s*blangko\s+derry\b/i.test(String(b.textContent || ""))) || null;
  }
  function panelDerry() {
    const t = tombolDerry();
    const p = t && t.nextElementSibling;
    return p && p.classList && p.classList.contains("panel") ? p : null;
  }
  function menuDerry() {
    const p = panelDerry();
    return p
      ? cariSemua("a", p).map((a) => ({ teks: String(a.textContent || "").replace(/\s+/g, " ").trim(), judul: a.getAttribute("title") || "", href: a.href || "", aktif: a.classList.contains("active") }))
      : [];
  }
  function derryAktifDiHalaman() {
    return menuDerry().some((m) => m.aktif);
  }
  function grupLainAktif() {
    const derry = panelDerry();
    return cariSemua("#navbar .panel a.active").some((a) => !derry || !derry.contains(a));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Setelan dan tema
  // ──────────────────────────────────────────────────────────────────────────
  function terapkanSetelan(s) {
    S.cfg = {
      bawaan: s[K.bawaan] === true,
      tawar: s[K.tawar] !== false,
      saran: s[K.saran] !== false,
      ingat: s[K.ingat] !== false,
      tjJawab: s[K.tjJawab] !== false,
      isiOto: s[K.isiOto] !== false,
      siapNaskah: s[K.siapNaskah] !== false,
      pratinjau: s[K.pratinjau] !== false,
      gembok: s[K.gembok] === true,
      // 22 Okt malam (pengguna): Tes putusan SELALU mati setiap panel dibuka; hanya bertahan selama halaman ini.
      tesPutusan: S.cfg.tesPutusan === true,
    };
    S.tema = temaDariPusat(s[K.tema]);
    S.ukuran = Object.prototype.hasOwnProperty.call(UKURAN, s[K.ukuran]) ? s[K.ukuran] : "biasa";
  }
  async function muatSetelan() {
    pulihSesiUkur();
    const s = await bacaPenyimpanan([K.bawaan, K.tawar, K.saran, K.ingat, K.tjJawab, K.isiOto, K.siapNaskah, K.pratinjau, K.gembok, K.tesPutusan, K.tema, K.daftar, K.aktif, K.ukuran]);
    terapkanSetelan(s);
    const d = s[K.daftar];
    if (d && typeof d === "object") {
      if (["kartu", "ringkas", "tabel", "tanggal"].includes(d.lihat)) S.lihat = d.lihat;
      if (KUNCI_URUT[d.urut]) S.urut = d.urut;
      if (d.arah === 1 || d.arah === -1) S.arah = d.arah;
      if (typeof d.depan === "boolean") S.depan = d.depan;
      if (typeof d.sembunyi === "boolean") S.sembunyiSelesai = d.sembunyi;
      if (typeof d.konsep === "boolean") S.tampilKonsep = d.konsep;
      // 21 Okt (w25): mode daftar TIDAK dipulihkan - panel selalu dibuka di "Sidang hari ini". "Pilih tanggal" yang terpulihkan tanpa
      // tanggal membuat galat "Tanggal harus berbentuk YYYY-MM-DD", dan "Semua perkara saya" memuat jauh lebih banyak daripada perlu.
      if (d.ket && typeof d.ket === "object") for (const k of Object.keys(S.ket)) if (typeof d.ket[k] === "boolean") S.ket[k] = d.ket[k];
    }
    return s[K.aktif] !== false;
  }
  function simpanPref() {
    void tulisPenyimpanan({ [K.daftar]: { lihat: S.lihat, urut: S.urut, arah: S.arah, depan: S.depan, sembunyi: S.sembunyiSelesai, konsep: S.tampilKonsep, mode: S.mode, ket: { ...S.ket } } });
  }
  function terapkanTema() {
    for (const e of [akar, tawar]) if (e && e.getAttribute("data-tema") !== S.tema) e.setAttribute("data-tema", S.tema);
  }
  // Tema (terang | gelap | ikuti sistem) dipegang SATU pusat (tema-pusat.js);
  // tampilan ini hanya mengikuti hasil uraiannya. Cermin temaPanel dibaca
  // hanya bila pusat tidak ada, dan tidak pernah ditulis dari sini lagi.
  function pusatTema() {
    return globalThis.AletaTemaPusat || null;
  }
  function temaDariPusat(cadangan) {
    const p = pusatTema();
    if (p) return p.keadaan().resolusi === "terang" ? "terang" : "gelap";
    return cadangan === "terang" ? "terang" : "gelap";
  }
  function pilihanTemaKini() {
    const p = pusatTema();
    return p ? p.keadaan().pilihan : S.tema;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Identitas
  // ──────────────────────────────────────────────────────────────────────────
  async function muatSiapa() {
    if (S.siapa) return S.siapa;
    try {
      S.siapa = await ambil(API_SIAPA, "Membaca akun ALETA");
      S.siapaGalat = "";
    } catch (e) {
      S.siapa = null;
      S.siapaGalat = String((e && e.message) || e);
    }
    hitungPeran();
    // Saklar Pengaturan SIPP & ABT hanya mengubah hak hakim/PP; admin butuh hak folder untuk "Lihat sebagai".
    if (S.siapa && (adm() || S.peranSet.has("hakim") || S.peranSet.has("pp"))) void muatHak();
    return S.siapa;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Kartu tawaran
  // ──────────────────────────────────────────────────────────────────────────
  function perluTawar() {
    if (S.aktif || !S.cfg.tawar || sesi(SESI_NANTI) === "1") return false;
    if (!tombolDerry() || !S.siapa) return false;
    return berhakDaftar();
  }
  function segarkanTawar() {
    const perlu = perluTawar();
    if (!perlu) {
      if (tawar) {
        tawar.remove();
        tawar = null;
      }
      return;
    }
    if (tawar) return;
    tawar = document.createElement("div");
    tawar.id = ID_TAWAR;
    tawar.setAttribute("role", "dialog");
    tawar.setAttribute("aria-label", "Tawaran Blangko ABT by Derry Briantono");
    tawar.innerHTML =
      `<b>Coba Blangko ABT by Derry Briantono</b>` +
      `<p>Perkara, isian, tanya jawab saksi dan cetak dalam satu halaman.</p>` +
      `<div class="bd-baris"><button type="button" class="bd-btn utama" data-bd="tawar-aktif">Aktifkan</button>` +
      `<button type="button" class="bd-btn" data-bd="tawar-nanti">Nanti saja</button></div>` +
      `<button type="button" class="bd-tautan" data-bd="tawar-jangan">Jangan tawarkan lagi</button>`;
    tawar.setAttribute("data-tema", S.tema);
    document.body.appendChild(tawar);
    terapkanSkala();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Buka / tutup tampilan
  // ──────────────────────────────────────────────────────────────────────────
  function buka() {
    if (S.aktif) return;
    S.aktif = true;
    sesi(SESI_LAMA, null);
    document.documentElement.classList.add(KELAS_AKTIF);
    bangunAkar();
    segarkanTawar();
    renderSemua();
    if (!S.data && !S.memuat) void muatDaftar();
  }
  function tutup() {
    if (!S.aktif) return;
    S.aktif = false;
    sesi(SESI_LAMA, "1");
    tutupFloat();
    sembunyiTip();
    document.documentElement.classList.remove(KELAS_AKTIF);
    if (akar) akar.hidden = true;
    segarkanTawar();
  }

  function bangunAkar() {
    if (akar) {
      akar.hidden = false;
      return;
    }
    akar = document.createElement("div");
    akar.id = ID_AKAR;
    akar.setAttribute("data-tema", S.tema);
    akar.setAttribute("role", "region");
    akar.setAttribute("aria-label", "Blangko ABT by Derry Briantono");
    // Rancangan v12: satu "layar" selebar 1280px berbingkai, bilah atas hijau di dalamnya (judul + nama akun +
    // Alat saya + Tampilan ABT lama). "Lihat sebagai akun" untuk admin dibuat kecil di bilah atas, tidak di badan.
    akar.innerHTML =
      `<div class="bd-layar">` +
      `<div class="bd-atas"><div class="bd-atasnama"><b>Blangko ABT by Derry Briantono</b> <small id="bd-siapa"></small>` +
      `<span class="bd-lihatwrap" id="bd-lihatwrap" hidden><label for="bd-lihat">Lihat sebagai</label><select id="bd-lihat" aria-label="Lihat sebagai akun"></select>${ikonKeterangan("lihat-sebagai")}</span>` +
      `<label class="bd-lihatwrap bd-teswrap" id="bd-teswrap" hidden title="Coba blangko apa pun pada perkara acuan yang dipilih. Tidak ada yang ditulis ke ABT, SIPP, atau e-Court."><input type="checkbox" id="bd-tes" aria-label="Tes putusan"> Tes putusan</label><span class="bd-lihatwrap" id="bd-tesket" hidden>${ikonKeterangan("tes-putusan")}</span></div>` +
      `<div class="bd-baris"><button type="button" class="bd-btn kecil" id="bd-alat-btn" data-bd="alat" aria-expanded="false" aria-controls="bd-alat">Alat saya ▾</button>${ikonKeterangan("alat-saya")}` +
      `<button type="button" class="bd-btn kecil" id="bd-widget-btn" data-bd="widget" aria-expanded="false" aria-controls="bd-widget" title="Pengaturan ALETA untuk tampilan ini">Widget ALETA ▾</button>` +
      `<button type="button" class="bd-btn kecil" data-bd="keabt" title="Kembali ke ABT biasa. Buka lagi lewat grup Blangko Derry di bilah kiri ABT.">Tampilan ABT lama</button>${ikonKeterangan("abt-lama")}</div></div>` +
      `<div class="bd-pitates" id="bd-pitates" role="status" hidden></div>` +
      `<div class="bd-isi">` +
      `<section class="bd-tahap" id="bd-t1"><div class="bd-tk"><span class="bd-tno">1</span><span class="bd-tj">Perkara</span>${ikonKeterangan("langkah-1")}` +
      `<div class="bd-ringkas" id="bd-pkringkas" hidden></div><button type="button" class="bd-btn kecil" id="bd-ganti" data-bd="ganti" hidden>Ganti perkara</button>` +
      `<button type="button" class="bd-btn kecil bd-massalbtn" id="bd-massal" data-bd="massal" title="Mencetak banyak perkara sekaligus menurut peran Anda" hidden>Cetak massal</button></div>` +
      `<div id="bd-pkpilih"></div></section>` +
      `<div id="bd-setelah" class="bd-kolom" hidden>` +
      `<section class="bd-tahap bd-sebaris menyusul" id="bd-w-pilih-blangko" data-tahap="E"><div class="bd-tk"><span class="bd-tno">2</span><span class="bd-tj">Blangko</span>${ikonKeterangan("langkah-2")}<span class="bd-chip">menyusul · tahap E</span></div>` +
      `<div class="bd-wadahkosong" data-wadah="pilih-blangko"><b>Pilih blangko</b> akan tampil di sini: jendela dua kolom dengan saran dari keterangan sidang dan peta perkara.<div class="bd-menuderry" id="bd-menuderry"></div></div></section>` +
      `<section class="bd-tahap bd-utama3 menyusul" id="bd-w-perlu-diisi" data-tahap="F"><div class="bd-tk"><span class="bd-tno">3</span><span class="bd-tj">Perlu diisi</span>${ikonKeterangan("langkah-3")}<span class="bd-chip">menyusul · tahap F</span></div>` +
      `<div class="bd-wadahkosong" data-wadah="perlu-diisi"><b>Isian yang perlu diisi tangan</b>, saran samar (Tab), dan tanya jawab saksi akan tampil di sini.</div></section>` +
      `<section class="bd-tahap menyusul" id="bd-w-pratinjau" data-tahap="G"><div class="bd-tk"><span class="bd-tno">4</span><span class="bd-tj">Pratinjau</span>${ikonKeterangan("langkah-4")}<span class="bd-chip">menyusul · tahap G</span></div>` +
      `<div class="bd-wadahkosong" data-wadah="pratinjau"><b>Pratinjau</b> naskah yang dapat disunting langsung akan tampil di sini.</div></section>` +
      `<section class="bd-tahap menyusul" id="bd-w-cetak" data-tahap="G"><div class="bd-tk"><span class="bd-tno">5</span><span class="bd-tj">Cetak</span>${ikonKeterangan("langkah-5")}<span class="bd-chip">menyusul · tahap G</span></div>` +
      `<div class="bd-wadahkosong" data-wadah="cetak"><b>Cetak</b> (RTF, PDF, PDF salinan, unggah e-Doc) akan tampil di sini.</div></section>` +
      `</div></div></div>` +
      `<div class="bd-float" id="bd-widget" hidden role="dialog" aria-label="Pengaturan ALETA"></div>` +
      `<div class="bd-float alat" id="bd-alat" hidden role="menu" aria-label="Alat saya"></div>` +
      `<div class="bd-tip" id="bd-tip" hidden role="tooltip"></div>` +
      `<div class="bd-toast" id="bd-toast" hidden role="status"></div>`;
    document.body.appendChild(akar);
    // 20 Okt: tinggi kepala panel (yang menempel) dipakai CSS sebagai ruang lompat, supaya kotak yang difokuskan tidak tertutup.
    try {
      const atas = akar.querySelector(".bd-atas");
      if (atas && typeof ResizeObserver === "function") new ResizeObserver(() => akar.style.setProperty("--bd-tinggi-atas", `${atas.offsetHeight}px`)).observe(atas);
    } catch {
      /* tanpa pengamat ukuran: nilai bawaan di CSS dipakai */
    }
    pasangHuruf();
    terapkanSkala();
    akar.addEventListener("click", saatKlik);
    akar.addEventListener("dblclick", saatKlikDua);
    akar.addEventListener("change", saatUbah);
    akar.addEventListener("input", saatMasuk);
    akar.addEventListener("mouseover", saatTunjuk);
    akar.addEventListener("mouseout", saatLepas);
    akar.addEventListener("focusin", saatTunjuk);
    akar.addEventListener("focusout", saatLepas);
    akar.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target && e.target.id === "bd-tescari") {
        e.preventDefault();
        void cariTes();
        return;
      }
      if (e.key === "Escape") {
        if (tutupKeterangan()) return;
        tutupFloat();
        sembunyiTip();
      }
    });
    window.addEventListener("resize", () => {
      terapkanSkala();
      susunUlangFloat();
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Huruf dan ukuran: sama dengan rancangan v12 walau halaman ABT diperkecil
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Huruf rancangan (IBM Plex Sans/Mono) dari Google Fonts - ABT tidak memasang Content-Security-Policy, jadi
   * lembar gaya luar boleh dimuat. Tanpa jaringan keluar, tumpukan cadangan (Segoe UI) yang dipakai.
   */
  function pasangHuruf() {
    if (document.getElementById("aleta-bd-huruf")) return;
    try {
      const l = document.createElement("link");
      l.id = "aleta-bd-huruf";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;700&display=swap";
      (document.head || document.documentElement).appendChild(l);
    } catch {
      /* huruf cadangan */
    }
  }
  const LEVEL_ZOOM = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const SKALA_LAYAR = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3];
  /**
   * Perkiraan zoom halaman Chrome (Ctrl -/+) - MURNI. Petugas biasa memperkecil ABT (mis. 67%) supaya tabelnya
   * muat; tampilan ini lalu ikut mengecil sampai hurufnya ±9px. outerWidth (piksel jendela) / innerWidth (piksel
   * CSS) memberi zoom kasar - panel samping Chrome membuatnya meleset - jadi dipadankan dengan devicePixelRatio
   * (= skala layar Windows x zoom) ke tingkat zoom Chrome yang ada. Hanya zoom PERKECIL yang dilawan; zoom
   * perbesar adalah pilihan petugas dan dibiarkan.
   */
  function perkiraanZoom(luar, dalam, dpr) {
    if (!(luar > 0) || !(dalam > 0)) return 1;
    const kasar = luar / dalam;
    const r = Number(dpr) > 0 ? Number(dpr) : 1;
    let terbaik = 1;
    let skor = Infinity;
    for (const z of LEVEL_ZOOM) {
      const s = r / z;
      const jarak = Math.min(...SKALA_LAYAR.map((x) => Math.abs(s - x) / x));
      const nilai = jarak + (Math.abs(z - kasar) / kasar) * 0.5;
      if (nilai < skor) {
        skor = nilai;
        terbaik = z;
      }
    }
    return Math.min(1, terbaik);
  }
  const UKURAN = { kecil: 0.9, biasa: 1, besar: 1.12, lebihbesar: 1.25 };
  function skalaSekarang() {
    let z = 1;
    try {
      z = perkiraanZoom(window.outerWidth, window.innerWidth, window.devicePixelRatio);
    } catch {
      z = 1;
    }
    const k = UKURAN[S.ukuran] || 1;
    return Math.round((k / z) * 1000) / 1000;
  }
  function terapkanSkala() {
    const z = skalaSekarang();
    for (const e of [akar, tawar]) {
      if (!e) continue;
      e.style.zoom = z === 1 ? "" : String(z);
      e.style.setProperty("--bd-z", String(z));
    }
    S.skala = z;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Layar
  // ──────────────────────────────────────────────────────────────────────────
  function toast(teks) {
    const e = cari("#bd-toast", akar);
    if (!e) return;
    e.textContent = teks;
    e.hidden = false;
    clearTimeout(toast.h);
    toast.h = setTimeout(() => {
      e.hidden = true;
    }, 5200);
  }

  // ── Keterangan fitur (29 Okt 2026, audit "runut cara kerja") ─────────────
  // Ikon (i) kecil di samping fitur yang tidak jelas dari labelnya. Arahkan tetikus = keterangan singkat (title); klik dua kali =
  // pop-up penjelasan lengkap (pola a5227BukaKeterangan di abt-panel-blangko.js); klik sekali = keterangan singkat di kabar bawah;
  // Enter/Spasi (papan ketik) = pop-up. Isi semua keterangan di SATU daftar ini; blangko-derry-isian.js memakainya lewat
  // api.ikonKeterangan(id). Hanya tampilan: tidak ada yang dibaca atau ditulis ke ABT/SIPP.
  const KETERANGAN = {
    "lihat-sebagai": {
      judul: "Lihat sebagai akun",
      singkat: "Menampilkan panel seperti yang dilihat akun yang dipilih: daftar perkara, blangko, dan hak menulisnya.",
      isi: [
        "Hanya untuk Super Admin dan Admin.",
        "Semua akun: semua perkara dan semua jenis dokumen (putusan, BAS, relaas). Saran blangko langkah 2 ada di jendela Pilih blangko per tab.",
        "Satu akun hakim, panitera pengganti, juru sita, atau PTSP: daftar perkara, folder blangko yang boleh dibuka, saran, dan hak menulis mengikuti akun itu.",
        "Perkara yang sedang dibuka dilepas setiap kali pilihan diganti, supaya blangko peran lama tidak terbawa.",
      ],
    },
    "tes-putusan": {
      judul: "Tes putusan",
      singkat: "Mencoba blangko apa pun pada perkara acuan. Tidak ada yang ditulis ke ABT, SIPP, atau e-Court.",
      isi: [
        "Hanya untuk Super Admin, dan hanya selama halaman ini terbuka (tidak diingat).",
        "Saringan jenis perkara dan peran dilepas: blangko dari folder mana pun dapat dicoba. Perkara acuan boleh dicari menurut nomor, juga yang tidak ada di jadwal.",
        "Isian tidak disimpan, tidak diunggah, dan tidak dicatat. Alat yang menulis (unggah, cetak massal, konseptor, kasir) dimatikan. Nama unduhan berakhiran -TES.",
      ],
    },
    "alat-saya": {
      judul: "Alat saya",
      singkat: "Alat tambahan menurut peran Anda. Super Admin dan Admin melihat semua peran.",
      isi: [
        "Dua saklar di atas (Isi otomatis dari SIPP, Pratinjau dokumen sebelum unduh) sama dengan saklar di Widget ALETA dan popup ekstensi.",
        "Alat bekerja pada perkara dan blangko yang sedang dibuka; bila belum ada, alat meminta Anda memilihnya dulu.",
        "BAS massal dan Relaas massal membuka Cetak massal (tombol di langkah 1) untuk jenis itu.",
        "Alat bertanda \"di SIPP\" belum ada di tampilan ini; pakai panel ALETA di halaman SIPP.",
      ],
    },
    "abt-lama": {
      judul: "Tampilan ABT lama",
      singkat: "Kembali ke tampilan ABT biasa. Buka lagi lewat grup Blangko Derry di bilah kiri ABT.",
      isi: [
        "Tampilan ini ditutup dan ABT tampil seperti biasa, lengkap dengan panel ALETA lama.",
        "Untuk kembali, klik grup \"Blangko Derry (Daftar s.d. Produk)\" di bilah kiri ABT. Perkara, blangko, dan isian yang sudah tersimpan tidak hilang.",
        "Bila saklar \"Blangko ABT by Derry Briantono sebagai tampilan bawaan\" di Widget ALETA menyala, tampilan ini langsung terbuka saat ABT dibuka.",
      ],
    },
    "langkah-1": {
      judul: "Langkah 1 - Perkara",
      singkat: "Pilih perkara yang akan dikerjakan. Langkah 2 sampai 5 muncul sesudah perkara dipilih.",
      isi: [
        "Urutan kerja: 1 Perkara -> 2 Blangko -> 3 Perlu diisi -> 4 Pratinjau -> 5 Cetak. Kerjakan dari atas ke bawah.",
        "Daftar: Sidang hari ini, Tanggal tertentu (satu hari), Rentang tanggal (dari-sampai; cukup satu tanggal untuk satu hari), atau Semua perkara saya (sidang sejak 90 hari lalu sampai 45 hari ke depan).",
        "Kotak cari menyaring daftar yang sudah tampil. Beberapa kata dipisah spasi: semuanya harus cocok. \"Cari berdasarkan\" mempersempit ke satu bidang.",
        "Lencana prioritas: Perlu segera, Menyusul, Tidak mendesak, Selesai. Arahkan tetikus ke lencana untuk melihat alasannya.",
        "Lencana isian (Terisi a dari t, Isian lengkap): diukur otomatis; klik lencana untuk langsung membuka isian yang masih kosong.",
        "Lencana dokumen: Belum diunggah ke SIPP, Sudah dicetak, Sudah ada di SIPP, Belum waktunya (sidang belum tiba), Sudah minutasi.",
        "Klik perkara untuk memilihnya. Klik dua kali nomor perkara (atau tombol Ganti perkara) untuk kembali ke daftar. Pilihan Sidang menentukan sidang yang dipakai blangko.",
        "Cetak massal: banyak perkara sekaligus menurut peran - Hakim putusan, Panitera Pengganti BAS, Juru sita relaas, PTSP penetapan awal.",
      ],
    },
    "tampilan-daftar": {
      judul: "Tampilan dan urutan daftar",
      singkat: "Kartu, Daftar ringkas, Tabel detail, atau Per tanggal sidang. Pilihan diingat per pengguna.",
      isi: [
        "Kartu: satu kotak per perkara; isinya diatur saklar \"Tampilkan keterangan\" (hanya pada tampilan Kartu).",
        "Daftar ringkas: satu baris per perkara. Tabel detail: kolom dapat diklik untuk mengurutkan. Per tanggal sidang: dikelompokkan per hari, yang terdekat di atas.",
        "Urutkan + Urutan naik/turun menentukan susunan. \"Yang belum selesai di depan\" menaruh perkara selesai di belakang apa pun urutannya.",
        "\"Sembunyikan yang selesai\" dan \"Tampilkan konsep sementara\": jumlah yang disembunyikan selalu disebut di bawah daftar.",
      ],
    },
    "langkah-2": {
      judul: "Langkah 2 - Blangko",
      singkat: "Pilih blangko untuk perkara dan sidang ini. Saran dihitung dari keterangan dan agenda sidang.",
      isi: [
        "Pilih blangko (atau Ganti blangko) membuka jendela dua kolom: kiri kelompok (Disarankan, lalu kelompok yang cocok dengan jenis perkara), kanan berkas blangko.",
        "Tab di jendela itu mengikuti peran: hakim Putusan, panitera pengganti Berita acara sidang, juru sita Relaas. Super Admin dan Admin melihat semuanya.",
        "Saran berasal dari keterangan sidang (mis. \"putus DIKABULKAN (verstek)\"), agenda sidang, dan keadaan perkara. Pakai saran ini memilih saran pertama.",
        "Klik dua kali kotak nama blangko juga membuka jendela pilih blangko.",
      ],
    },
    "langkah-3": {
      judul: "Langkah 3 - Perlu diisi",
      singkat: "Isian yang masih harus diisi. Tiap isian langsung tersimpan ke ABT untuk perkara ini.",
      isi: [
        "Isian tersimpan di ABT per perkara: putusan dan BAS perkara yang sama memakai isian yang sama (mis. alat bukti, alasan perceraian). Keterangan saksi diketik di tanya jawab BAS dan dibaca oleh putusan.",
        "Tulisan samar di kotak adalah saran: tekan Tab untuk memakainya, atau tanda ↓ untuk pilihan lain.",
        "Ikon (i) di samping isian: dari mana datanya. Lencana \"ragu\" berarti usulan perlu diperiksa.",
        "Isi otomatis mengisi isian kosong dari SIPP, gugatan, e-Court, bukti, dan saran. Isian yang sudah ada isinya tidak ditimpa.",
        "Isian di dalam bagian otomatis: isian yang tidak tertulis langsung di blangko tetapi dibaca kalimat otomatis (mis. amar).",
        "Lihat semua isi data menampilkan seluruh nilai blangko ini; nama pihak disamarkan.",
      ],
    },
    "langkah-4": {
      judul: "Langkah 4 - Pratinjau",
      singkat: "Naskah hasil isian. Dimuat saat dibuka; blangko besar bisa 1-5 menit.",
      isi: [
        "Klik baris Pratinjau naskah untuk membuka. ABT menyusun naskahnya dari isian yang sudah tersimpan.",
        "Bagian berwarna adalah isian Anda: klik dua kali untuk mengubahnya langsung di pratinjau (tersimpan ke ABT). Bagian lain berasal dari SIPP.",
        "Sunting pratinjau untuk menyunting lebih bebas; Muat ulang dari ABT sesudah mengubah isian di tempat lain.",
        "Penanda yang belum terbaca (#kode#) disebut di atas naskah: periksa sebelum mencetak.",
      ],
    },
    "langkah-5": {
      judul: "Langkah 5 - Cetak",
      singkat: "Centang hasil yang diinginkan, lalu tekan Cetak. Berkas bernama nomor perkara diikuti nama blangko.",
      isi: [
        "RTF: naskah yang dapat disunting di Word. PDF: siap cetak, dapat diberi tanda tangan. PDF SALINAN: bertulisan SALINAN di kiri atas halaman pertama, majelis dan panitera bertulis \"ttd\", ditandatangani Panitera pengesah.",
        "Tambah tanda tangan: gambar tanda tangan yang sudah disahkan dibubuhkan di atas nama penandatangan, hanya pada PDF (bukan RTF atau PDF SALINAN).",
        "PDF anonim dan Unggah ke e-Doc SIPP hanya untuk putusan. e-Doc mengunggah putusan beserta versi anonimnya ke SIPP.",
        "Unggah putusan (atau BAS/relaas) sendiri: bila Anda menyunting naskah di Word, unggah berkasnya (RTF/DOCX/DOC); semua pilihan cetak dibuat dari berkas itu, bukan dari naskah ABT.",
        "Sebelum mencetak, isian yang masih kosong dan penanda yang tersisa diingatkan: Isi dulu, atau Tetap cetak.",
      ],
    },
    "fmt-pdf": {
      judul: "PDF",
      singkat: "PDF siap cetak dari naskah yang sama dengan RTF; tanda tangan pilihan Anda dibubuhkan di sini.",
      isi: ["PDF disusun dari naskah ABT (atau berkas unggahan sendiri). Tanda tangan dari \"Tambah tanda tangan\" hanya dibubuhkan pada PDF ini."],
    },
    "fmt-salinan": {
      judul: "PDF SALINAN",
      singkat: "Salinan resmi: tulisan SALINAN di kiri atas, majelis dan panitera bertulis \"ttd\", tanda tangan Panitera pengesah.",
      isi: [
        "Tulisan SALINAN di kiri atas halaman pertama putusan; penetapan tanpa salinan.",
        "Majelis dan panitera sidang hanya bertulis \"ttd\". Satu-satunya gambar tanda tangan adalah milik Panitera pengesah di blok \"Untuk Salinan\" (bila sudah terdaftar).",
        "Pilihan \"Tambah tanda tangan\" tidak berlaku di salinan.",
      ],
    },
    "fmt-ttd": {
      judul: "Tambah tanda tangan",
      singkat: "Gambar tanda tangan yang disahkan dibubuhkan di atas nama penandatangan - hanya pada PDF.",
      isi: [
        "Centang PDF lebih dulu; tanpa PDF, tanda tangan tidak dibubuhkan.",
        "Anda hanya dapat memasang tanda tangan milik akun Anda sendiri (Super Admin/Admin: semua yang sudah tersimpan).",
        "RTF dan PDF SALINAN tidak diberi gambar tanda tangan dari pilihan ini.",
      ],
    },
    "fmt-anon": {
      judul: "PDF anonim",
      singkat: "PDF putusan dengan nama pihak dan data pribadi disamarkan. Hanya untuk putusan.",
      isi: [
        "Nama pihak disamarkan lebih dulu oleh penyamar ekstensi; bila tidak dapat dipakai, anonimisasi ABT menjadi cadangan (bisa 1-2 menit).",
        "Saat Unggah ke e-Doc SIPP dicentang, versi anonim juga disusun dan diperlihatkan untuk diperiksa sebelum ikut terunggah, walau PDF anonim tidak dicentang.",
      ],
    },
    "fmt-edoc": {
      judul: "Unggah ke e-Doc SIPP",
      singkat: "Mengunggah putusan (dan versi anonimnya) ke e-Doc SIPP. Hanya untuk putusan.",
      isi: [
        "Putusan diunggah atas akun SIPP Anda; versi anonim diperlihatkan dulu untuk diperiksa sebelum ikut terunggah.",
        "BAS dan relaas diunggah lewat SIPP. Pada Tes putusan pilihan ini mati.",
      ],
    },
  };
  /** Ikon (i) keterangan fitur; kosong bila id tidak dikenal. */
  function ikonKeterangan(id) {
    const k = KETERANGAN[id];
    if (!k) return "";
    return `<button type="button" class="bd-ikon bd-infoket" data-infoket="${esc(id)}" aria-haspopup="dialog" aria-label="Keterangan: ${esc(k.judul)}" title="${esc(`${k.singkat} (Klik dua kali: penjelasan lengkap.)`)}">ⓘ</button>`;
  }
  function tutupKeterangan() {
    const lama = akar ? cari("#bd-ketpop", akar) : null;
    if (!lama) return false;
    const asal = lama.__asal;
    lama.remove();
    try {
      if (asal && asal.isConnected) asal.focus();
    } catch {
      /* fokus hanya kenyamanan */
    }
    return true;
  }
  /** Pop-up penjelasan lengkap satu fitur: judul, kalimat singkat, butir penjelasan, tombol Tutup (juga Esc / klik di luar). */
  function bukaKeterangan(id, asal) {
    const k = KETERANGAN[id];
    if (!k || !akar) return null;
    tutupKeterangan();
    const tirai = document.createElement("div");
    tirai.id = "bd-ketpop";
    tirai.className = "bd-modal bd-ketpop";
    tirai.setAttribute("role", "dialog");
    tirai.setAttribute("aria-modal", "true");
    tirai.setAttribute("aria-label", k.judul);
    tirai.setAttribute("data-infoket-buka", id);
    tirai.innerHTML =
      `<div class="bd-ketkotak"><b class="bd-ketjudul">${esc(k.judul)}</b><p class="bd-ketsingkat">${esc(k.singkat)}</p>` +
      `<ul class="bd-ketbutir">${(k.isi || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` +
      `<div class="bd-ketbaris"><button type="button" class="bd-btn kecil utama" data-bd="tutupket">Tutup</button></div></div>`;
    tirai.__asal = asal || null;
    akar.appendChild(tirai);
    try {
      cari('[data-bd="tutupket"]', tirai).focus();
    } catch {
      /* fokus hanya kenyamanan */
    }
    return tirai;
  }

  function sebutAkun() {
    if (!S.siapa) return S.siapaGalat ? "· belum terhubung ke ALETA" : "· memuat akun…";
    // Rancangan v12: hanya nama akun; peran tidak ditulis (sudah tercermin dari Alat saya).
    let t = `· ${S.siapa.nama || "?"}`;
    if (adm() && S.sebagai.nama) t += ` · dilihat sebagai ${namaTampilSebagai(S.sebagai.nama)}`;
    return t;
  }

  function renderAtas() {
    const siapa = cari("#bd-siapa", akar);
    if (siapa) siapa.textContent = sebutAkun();
    renderTes();
    const wrap = cari("#bd-lihatwrap", akar);
    if (!wrap) return;
    wrap.hidden = !adm();
    if (!adm()) return;
    const sel = cari("#bd-lihat", akar);
    const akun = (S.data && S.data.akun) || { hakim: [], pp: [], js: [], ptsp: [] };
    const label = S.peranSet.has("admin") ? "Super Admin / Admin" : "Admin";
    // 28 Okt 2026: kelompok PTSP (akun meja pendaftaran) menyusul Hakim, Panitera Pengganti, dan Juru sita; daftarnya dari server (akun, bukan jadwal).
    // Pilihan "PTSP (semua petugas PTSP)" selalu paling atas di kelompok itu, jadi tampilan PTSP bisa dipilih walau belum ada akun PTSP.
    const awalPtsp = (p) => (p === "ptsp" ? `<option value="ptsp|${esc(NAMA_PTSP_SEMUA)}" title="Tampilan PTSP: daftar perkara hari ini / rentang dan cetak massal PTSP, tanpa memilih satu akun">${esc(namaTampilSebagai(NAMA_PTSP_SEMUA))}</option>` : "");
    sel.innerHTML =
      `<option value="" title="Tampilan ${esc(label)}: semua akun">Semua akun</option>` +
      ["hakim", "pp", "js", "ptsp"]
        .map((p) => `<optgroup label="${esc(NAMA_PERAN[p])}">${awalPtsp(p)}${satukanOrang(akun[p]).map((n) => `<option value="${p}|${esc(n)}">${esc(n)}</option>`).join("")}</optgroup>`)
        .join("");
    let nilai = S.sebagai.nama ? `${S.sebagai.peran}|${S.sebagai.nama}` : "";
    sel.value = nilai;
    if (nilai && sel.value !== nilai) {
      // Orang yang sama dengan ejaan lain (mis. daftar rentang lain menulisnya tanpa gelar): pakai entri daftar, bukan entri kembar.
      const kunci = kunciOrang(S.sebagai.nama);
      const sama = Array.from(sel.options).find((o) => o.value.startsWith(`${S.sebagai.peran}|`) && kunciOrang(o.value.slice(S.sebagai.peran.length + 1)) === kunci);
      if (sama) {
        sel.value = sama.value;
        nilai = sama.value;
      }
    }
    if (sel.value !== nilai) {
      // Nama yang dipilih tidak muncul di rentang yang sedang dimuat: tetap ditampilkan.
      const o = document.createElement("option");
      o.value = nilai;
      o.textContent = S.sebagai.nama === NAMA_PTSP_SEMUA ? namaTampilSebagai(S.sebagai.nama) : `${S.sebagai.nama} (${NAMA_PERAN[S.sebagai.peran] || ""})`;
      sel.appendChild(o);
      sel.value = nilai;
    }
  }

  /** Kotak centang "Tes putusan" (hanya Super Admin) dan pita penandanya. */
  function renderTes() {
    const bungkus = cari("#bd-teswrap", akar);
    const kotak = cari("#bd-tes", akar);
    const pita = cari("#bd-pitates", akar);
    const boleh = superAdmin();
    if (bungkus) bungkus.hidden = !boleh;
    const ketTes = cari("#bd-tesket", akar);
    if (ketTes) ketTes.hidden = !boleh;
    if (kotak) kotak.checked = tesAktif();
    if (!pita) return;
    const nyala = tesAktif();
    pita.hidden = !nyala;
    if (nyala) {
      pita.innerHTML = `<b>TES PUTUSAN</b> · perkara acuan ${S.pk ? `<b>${esc(S.pk)}</b>` : "belum dipilih"} · blangko dari jenis perkara mana pun dapat dicoba; tidak ada yang ditulis ke ABT, SIPP, atau e-Court (isian tidak disimpan, tidak diunggah, tidak dicatat). Unduhan berakhiran -TES.`;
    }
  }
  /** Memasang/melepas Tes putusan: hanya selama halaman ini (tidak disimpan); blangko yang sedang terbuka dibuang (peran kunci berganti) dan daftar digambar ulang. */
  function aturTes(nyala) {
    const baru = nyala === true && superAdmin();
    if (S.cfg.tesPutusan === baru) return;
    tutupFloat();
    S.cfg.tesPutusan = baru;
    if (!baru) {
      // Perkara acuan hasil cari nomor (di luar jadwal) tidak berlaku lagi bila tes dimatikan.
      S.tesCari = { kata: "", memuat: false, galat: "", hasil: null };
      if (S.pk && !(S.data && S.data.perkara.some((x) => x.nomorPerkara === S.pk))) S.pk = null;
      S.tesAcuan = null;
    }
    renderSemua();
    umumkanPerkara();
    toast(baru ? "Tes putusan menyala: blangko apa pun dapat dicoba, tidak ada yang ditulis." : "Tes putusan mati: saringan jenis perkara dan peran berlaku lagi.");
  }

  function renderMenuDerry() {
    const wad = cari("#bd-menuderry", akar);
    if (!wad) return;
    const m = menuDerry();
    wad.innerHTML = m.length
      ? `<span class="bd-catat">Menu Blangko Derry di ABT:</span>` + m.map((x) => `<a href="${esc(x.href)}" title="${esc(x.judul)}">${esc(x.teks)}</a>`).join("")
      : "";
  }

  function renderSemua() {
    if (!akar) return;
    terapkanTema();
    renderAtas();
    renderPerkara();
    renderMenuDerry();
    const tombolMassal = cari("#bd-massal", akar);
    if (tombolMassal) tombolMassal.hidden = !berhakDaftar() || tesAktif();
    const ada = Boolean(S.pk);
    cari("#bd-setelah", akar).hidden = !ada;
  }

  // ── Daftar perkara ────────────────────────────────────────────────────────
  /** Rentang tanggal yang berlaku: "Tanggal tertentu" = satu hari, "Rentang tanggal" = DARI-SAMPAI; mode lain tanpa. */
  function rentangMode() {
    if (S.mode === "tanggal") return rentangDari(S.tgl, S.tgl);
    if (S.mode === "rentang") return rentangDari(S.dari, S.sampai);
    return null;
  }
  function kunciPermintaan() {
    const r = rentangMode();
    // "Tanggal tertentu" dan rentang sehari memuat hal yang sama dari server: ikut satu kunci singgahan.
    return [S.mode === "tanggal" ? "rentang" : S.mode, r ? r.dari : "", r ? r.sampai : "", S.sebagai.nama, S.sebagai.peran, nomorCariPtsp(), ptspDaftar() ? (S.ptspPertama ? "sp" : "ss") : ""].join("|");
  }
  function alamatPermintaan() {
    const q = new URLSearchParams();
    // PTSP mencari di seluruh rentang jadwal satker: nomor yang diketik menentukan hasilnya, bukan tab tanggal.
    q.set("mode", nomorCariPtsp() ? "semua" : S.mode === "tanggal" ? "rentang" : S.mode);
    if (nomorCariPtsp()) q.set("nomor", nomorCariPtsp());
    if (!nomorCariPtsp() && (S.mode === "rentang" || S.mode === "tanggal")) {
      const r = rentangMode() || { dari: hariIni(), sampai: hariIni() };
      q.set("dari", r.dari);
      q.set("sampai", r.sampai);
    }
    if (adm() && S.sebagai.nama) {
      q.set("sebagai", S.sebagai.nama);
      q.set("peranSebagai", S.sebagai.peran);
    }
    // Daftar PTSP per tanggal: sidang pertama di rentang (bawaan), atau semua perkara satker yang bersidang di rentang.
    if (ptspDaftar() && !nomorCariPtsp()) {
      if (S.ptspPertama) q.set("sidangPertama", "1");
      else q.set("massal", "ptsp");
    }
    return `${API_PERKARA}?${q.toString()}`;
  }

  async function muatDaftar(paksa) {
    // Daftar PTSP tidak punya tab "Semua perkara saya" (satker tidak punya "milik saya"): kembali ke hari ini; pencarian nomor tetap menjangkau 90 hari lalu - 45 hari depan.
    if (ptspDaftar() && !nomorCariPtsp() && S.mode === "semua") S.mode = "hari";
    // Pilih tanggal tanpa satu tanggal pun: tidak ada yang dimuat dan tidak ada galat - petunjuk lembut saja.
    if ((S.mode === "rentang" || S.mode === "tanggal") && !nomorCariPtsp() && !rentangMode()) {
      S.data = null;
      S.galat = "";
      S.memuat = false;
      renderSemua();
      return;
    }
    const kunci = kunciPermintaan();
    const simpan = singgah.get(kunci);
    if (!paksa && simpan && Date.now() - simpan.waktu < TTL_DAFTAR_MS) {
      S.data = simpan.data;
      S.galat = "";
      S.memuat = false;
      renderSemua();
      void lanjutTautan();
      return;
    }
    const nomor = ++nomorMuat;
    S.memuat = true;
    S.galat = "";
    renderSemua();
    try {
      await muatSiapa();
      const data = await ambil(alamatPermintaan(), "Membaca daftar perkara");
      if (nomor !== nomorMuat) return;
      data.perkara = Array.isArray(data.perkara) ? data.perkara : [];
      singgah.set(kunci, { waktu: Date.now(), data });
      S.data = data;
    } catch (e) {
      if (nomor !== nomorMuat) return;
      S.galat = String((e && e.message) || e);
    }
    S.memuat = false;
    renderSemua();
    void lanjutTautan();
  }

  // ── Tautan dari Jadwal Sidang portal (19 Okt 2026) ────────────────────────
  // ABT dibuka dengan http://.../aps_badilag/abt/#bd=<JSON ter-encode>: { v:1, nomor, perkaraId, sidangKe, tanggalSidang, jenis:
  // "putusan"|"bas"|"penetapan", agenda, tunda, keterangan, amar, verstek, jumlahSaksiP, jumlahSaksiT }.
  // Ruas opsional pop-up Draf H-7: draf: "h7" (pakai draf putusan agen), varian: "dikabulkan"|"ditolak", isian: nama isian yang ditunjuk. Tampilan ini terbuka sendiri,
  // memilih perkara dan sidang, lalu memberi tahu blangko-derry-isian.js (peristiwa "aleta-bd-tautan") untuk memilih blangko yang
  // paling cocok (mesin saran per jenis + peran + keadaan perkara + petunjuk dari tautan). Hash dihapus dari alamat sesudah dibaca;
  // hash rusak / versi tak dikenal diabaikan diam-diam.
  const JENIS_TAUTAN = ["putusan", "bas", "penetapan"];
  const teksTautan = (v, maks) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, maks || 400) : "");
  const angkaTautan = (v, maks) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= maks ? n : 0;
  };
  /** Hash "#bd=..." -> tautan ternormalkan, atau null (kosong, rusak, bukan versi 1, tanpa nomor/perkara). Murni (diuji). */
  function bacaTautanBd(hash) {
    try {
      const h = String(hash || "");
      if (!/^#bd=/i.test(h)) return null;
      const j = JSON.parse(decodeURIComponent(h.slice(4)));
      if (!j || typeof j !== "object" || Array.isArray(j) || j.v !== 1) return null;
      const nomor = teksTautan(j.nomor, 80);
      const perkaraId = /^\d{1,12}$/.test(String(j.perkaraId == null ? "" : j.perkaraId)) ? String(j.perkaraId) : "";
      if (!nomor && !perkaraId) return null;
      const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(j.tanggalSidang || "")) ? String(j.tanggalSidang) : "";
      return {
        nomor,
        perkaraId,
        sidangKe: angkaTautan(j.sidangKe, 99),
        tanggalSidang: tanggal,
        jenis: JENIS_TAUTAN.includes(j.jenis) ? j.jenis : "",
        agenda: teksTautan(j.agenda, 200),
        tunda: j.tunda === true,
        keterangan: teksTautan(j.keterangan, 400),
        amar: teksTautan(j.amar, 600),
        verstek: j.verstek === true,
        jumlahSaksiP: angkaTautan(j.jumlahSaksiP, 20),
        jumlahSaksiT: angkaTautan(j.jumlahSaksiT, 20),
        // 19 Okt: ruas opsional dari pop-up Draf H-7 portal; hanya dibawa bila sah (tautan lama tetap sama bentuknya).
        ...(j.draf === "h7" ? { draf: "h7" } : {}),
        ...(j.varian === "dikabulkan" || j.varian === "ditolak" ? { varian: j.varian } : {}),
        ...(teksTautan(j.isian, 120) ? { isian: teksTautan(j.isian, 120) } : {}),
      };
    } catch {
      return null;
    }
  }
  /** Daftar perkara sudah termuat: pilih perkara + sidang dari tautan lalu umumkan ke tahap pilih blangko. Sekali jalan. */
  async function lanjutTautan() {
    const t = S.tautan;
    if (!t || t.jalan || !S.data) return;
    t.jalan = true;
    try {
      const p = S.data.perkara.find((x) => (t.perkaraId && String(x.perkaraId) === t.perkaraId) || (t.nomor && x.nomorPerkara === t.nomor));
      if (!p) {
        S.tautan = null;
        return toast(`Perkara ${t.nomor || t.perkaraId} tidak ada di daftar perkara Anda; pilih perkara dari daftar.`);
      }
      await muatRiwayatSidang(p);
      if (S.tautan !== t) return;
      pilihPerkara(p.nomorPerkara);
      const sid = riwayatPerkara(p);
      let i = t.tanggalSidang ? sid.findIndex((x) => x.tanggal === t.tanggalSidang) : -1;
      if (i < 0 && t.sidangKe) i = sid.findIndex((x) => Number(x.urutan) === t.sidangKe);
      if (i < 0 && t.sidangKe && t.sidangKe <= sid.length) i = t.sidangKe - 1;
      if (i >= 0 && i !== S.sidIdx) {
        S.sidIdx = i;
        renderSemua();
        umumkanPerkara();
      }
      document.dispatchEvent(new CustomEvent("aleta-bd-tautan", { detail: { ...t } }));
    } catch {
      /* tautan hanya kemudahan: gagal = petugas memilih sendiri */
    }
  }

  // ── Pencarian pintar di kotak cari (19 Okt 2026) ─────────────────────────
  // Memakai data yang SUDAH dimuat tabel (tanpa permintaan server baru). Beberapa
  // kata kunci dipisah spasi: SEMUANYA harus cocok (dalam jenis yang dipilih;
  // pada "Semua" boleh di bidang mana pun).
  const JENIS_CARI = [
    ["semua", "Semua (otomatis)", "nomor, jenis, pihak, agenda, tanggal…"],
    ["nomor", "Nomor perkara", "mis. 581 atau 581/Pdt.G/2026"],
    ["jenis", "Jenis perkara", "mis. Cerai Gugat, Kewarisan"],
    ["alur", "Alur perkara", "Pdt.G atau Pdt.P"],
    ["pihak", "Nama pihak", "nama Penggugat/Tergugat/Pemohon/Termohon"],
    ["kegiatan", "Kegiatan sidang / agenda", "mis. Mediasi, Pembuktian, putus"],
    ["prioritas", "Prioritas", "Perlu segera, Menyusul, Selesai"],
    ["dokumen", "Dokumen di SIPP", "mis. belum diunggah, sudah minutasi"],
    ["tanggal", "Tanggal sidang", "mis. 15/10/2026, 15 Okt 2026, 2026-10-15"],
    ["majelis", "Majelis / PP / JS", "nama hakim, panitera pengganti, juru sita"],
  ];
  const ketik = (v) => String(v == null ? "" : v).toLowerCase();
  /** Kode alur dari nomor: "581/Pdt.G/2026/PA.Dgl" -> "pdt.g". */
  const alurDariNomor = (n) => {
    const m = /\/(pdt\.[a-z.]+?)\//i.exec(String(n || ""));
    return m ? m[1].toLowerCase() : "";
  };
  /** Tanggal ISO dari ketikan "15/10/2026", "15-10-2026", "2026-10-15"; "" bila bukan tanggal penuh. */
  function tanggalIsoDariKetikan(q) {
    const t = String(q || "").trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  }
  /** Cocok tanggal: ISO penuh, atau potongan teks tanggal ("15 okt", "oktober 2026", "2026-10"). */
  function cocokTanggal(p, q) {
    const iso = tanggalIsoDariKetikan(q);
    const kunci = ketik(q).replace(/\s+/g, " ").trim();
    return (Array.isArray(p.sidang) ? p.sidang : []).some((s) => {
      const t = String(s.tanggal || "");
      if (!t) return false;
      if (iso) return t === iso;
      const [y, m, d] = t.split("-");
      const bentuk = [t, `${+d} ${BULAN[+m - 1] || ""} ${y}`, `${+d} ${(BULAN[+m - 1] || "").slice(0, 3)} ${y}`, `${d}/${m}/${y}`].map(ketik);
      return bentuk.some((b) => b.includes(kunci));
    });
  }
  /** Satu kata kunci cocok pada jenis tertentu? */
  function cocokJenis(r, jenis, kata) {
    const p = r.p;
    const k = ketik(kata);
    switch (jenis) {
      case "nomor":
        return ketik(p.nomorPerkara).includes(k);
      case "jenis":
        return ketik(p.jenisPerkara).includes(k);
      case "alur": {
        const kode = alurDariNomor(p.nomorPerkara);
        const x = k.replace(/\s+/g, "").replace(/^pdt\.?/, "");
        if (!kode || !x) return false;
        if (/gugat/.test(x)) return kode === "pdt.g";
        if (/mohon/.test(x)) return kode === "pdt.p";
        return kode === `pdt.${x}` || (x.length > 1 && kode.includes(x));
      }
      case "pihak": {
        const ph = p.pihak || {};
        return [].concat(ph.penggugat || [], ph.tergugat || []).some((n) => ketik(n).includes(k));
      }
      case "kegiatan":
        return (Array.isArray(p.sidang) ? p.sidang : []).some((s) => ketik(s.agenda).includes(k) || ketik(s.ket).includes(k));
      case "prioritas":
        return ketik(TEKS_TINGKAT[r.tingkat]).includes(k) || r.tingkat === k || (r.alasan || []).some((a) => ketik(a).includes(k));
      case "dokumen":
        return ketik(r.dokTxt).includes(k);
      case "tanggal":
        return cocokTanggal(p, kata);
      case "majelis":
        return [p.majelisNama, p.paniteraNama, p.jurusitaNama].some((n) => ketik(n).includes(k));
      default:
        return false;
    }
  }
  /** Perkara (hasil ringkasan) cocok dengan ketikan? Kosong = cocok semua. */
  function cocokCari(r, jenis, q) {
    const teks = String(q || "").trim();
    if (!teks) return true;
    if (jenis === "tanggal") return cocokTanggal(r.p, teks);
    const kata = teks.split(/\s+/).filter(Boolean);
    const semuaJenis = JENIS_CARI.slice(1).map((x) => x[0]);
    // "Semua": tanggal yang diketik utuh ("15 Okt 2026" / "15/10/2026") dikenali sebagai satu kesatuan.
    if (jenis === "semua" && (tanggalIsoDariKetikan(teks) || kata.length > 1) && cocokTanggal(r.p, teks)) return true;
    return kata.every((w) => (jenis === "semua" ? semuaJenis.some((j) => cocokJenis(r, j, w)) : cocokJenis(r, jenis, w)));
  }

  /** Daftar menurut cari + urutan, SEBELUM perkara yang selesai disembunyikan. */
  function daftarUrutSemua() {
    const data = S.data;
    if (!data) return [];
    const q = S.cariNomor.trim();
    const ctx = ctxRingkasan();
    // PTSP: kotak ini mencari nomor di server; jenis lain tidak berlaku.
    const jenis = ptspCari() ? "nomor" : S.cariJenis;
    const l = data.perkara.map((p) => ringkasan(p, ctx)).filter((r) => cocokCari(r, jenis, q));
    return urutkan(l, S.urut, S.arah, S.depan);
  }
  /** "Sembunyikan yang selesai" berlaku bila tercentang; PTSP (mencari nomor satker, baca saja) tidak pernah menyembunyikan. */
  const sembunyiBerlaku = () => S.sembunyiSelesai && !ptspCari();
  /** Toggle "Tampilkan konsep sementara" mati: perkara konsep sementara tidak ikut daftar. PTSP tidak punya konsep sementara. */
  const konsepDisembunyikan = (r) => Boolean(r.konsep) && !S.tampilKonsep && !ptspCari();
  function daftarUrut(semua) {
    return (semua || daftarUrutSemua()).filter((r) => !(sembunyiBerlaku() && r.selesai) && !konsepDisembunyikan(r));
  }

  const tipPihak = (n) => `<span class="bd-pihak" data-tipn="${esc(n)}">Para pihak ⓘ</span>`;
  /** 29 Okt: lencana prioritas menyebut alasannya saat kursor (dulu hanya bila saklar "Alasan prioritas" menyala). */
  const ketPrio = (r) => `Prioritas: ${TEKS_TINGKAT[r.tingkat]}${r.alasan && r.alasan.length ? ` - ${r.alasan.join("; ")}` : ""}.`;
  const chipPrio = (r) => `<span class="bd-prio ${r.tingkat}" title="${esc(ketPrio(r))}">${TEKS_TINGKAT[r.tingkat]}</span>`;
  /** 29 Okt: lencana dokumen di SIPP dengan keterangan saat kursor. */
  const KET_DOK = {
    "Belum ada yang perlu dibuat": "Perkara ini belum punya dokumen untuk peran Anda saat ini.",
    "Sudah minutasi": "Perkara sudah diminutasi.",
    "Sudah ada di SIPP": "Dokumen peran Anda untuk sidang ini sudah ada di SIPP.",
    "Sudah dicetak": "Sudah dicetak dari tampilan ini, tetapi belum terlihat di SIPP.",
    "Belum waktunya": "Sidangnya belum tiba.",
    "Belum diunggah ke SIPP": "Dokumen peran Anda (putusan/BAS/relaas) belum ada di SIPP.",
    "Belum terukur": "Status dokumen belum terbaca dari SIPP.",
  };
  const chipDok = (r) => `<span class="bd-chip ${r.dokKelas}" title="${esc(KET_DOK[r.dokTxt] || "Status dokumen di SIPP.")}">${esc(r.dokTxt)}</span>`;
  /** Lencana "Konsep sementara" + nama konseptor yang ditunjuk (nama lengkap di tooltip). */
  const chipKonsep = (r) =>
    r.konsep
      ? `<span class="bd-konsep" data-konsep title="${esc(`Konseptor sementara (ditunjuk di Jadwal Sidang): ${r.konsep.nama}${r.konsep.oleh ? ` - oleh ${r.konsep.oleh}` : ""}`)}">Konsep sementara · ${potong(pertama(r.konsep.nama) || r.konsep.nama, 24)}</span>`
      : "";
  /** Lencana kelengkapan isian: tooltip menerangkan angkanya; klik membuka perkara di langkah Isian, menggulir ke isian kosong pertama. */
  const chipIsian = (r) => `<span class="bd-chip bd-isian${r.isiKelas ? ` ${r.isiKelas}` : ""}" data-isian="${esc(r.n)}" title="${esc(r.isiKet)}">${esc(r.isiTxt)}</span>`;
  const chipAlasan = (r, m) => r.alasan.slice(0, m).map((a) => `<span class="bd-alasan">${esc(a)}</span>`).join("");
  const KET_KARTU = [
    ["jenis", "Jenis perkara"],
    ["sidang", "Sidang dan agenda"],
    ["pihak", "Para pihak"],
    ["isian", "Status isian"],
    ["cetak", "Status dokumen di SIPP"],
    ["alasan", "Alasan prioritas"],
    ["majelis", "Ketua majelis"],
    ["petugas", "Panitera pengganti dan juru sita"],
  ];
  const urusanSidang = (r) => `${tglS(r.s.tanggal)} · ${esc(r.s.ket || r.s.agenda || "-")}`;
  /**
   * 22 Okt 2026: "Sidang ke-N · agenda sidang" di kolom Perkara. N = urutan sidang dari SIPP (SIPP menomori sidang per perkara);
   * bila SIPP tidak mengirim urutan, N dicari dari riwayat sidang perkara yang sudah termuat. Tanpa keduanya hanya agenda.
   * Murni: tidak membaca DOM.
   */
  function keSidang(r) {
    const s = (r && r.s) || {};
    const u = Number(s.urutan) || 0;
    if (u > 0) return u;
    const riw = r && r.p ? S.riwayat.get(r.p.nomorPerkara) : null;
    const i = riw && s.tanggal ? riw.findIndex((x) => x.tanggal === s.tanggal && (!s.sidangId || x.sidangId === s.sidangId)) : -1;
    return i >= 0 ? i + 1 : 0;
  }
  function teksKeSidang(r) {
    const n = keSidang(r);
    const agenda = String((r && r.s && r.s.agenda) || "").trim();
    return [n > 0 ? `Sidang ke-${n}` : "", agenda].filter(Boolean).join(" · ");
  }
  const barisKeSidang = (r, kelas) => {
    const t = teksKeSidang(r);
    return t ? `<span class="${kelas}" data-kesidang>${esc(t)}</span>` : "";
  };

  function kartu(r) {
    const k = S.ket;
    const baris1 = [];
    if (k.jenis) baris1.push(esc(r.p.jenisPerkara));
    // 22 Okt: agenda sidang kini ada di baris "Sidang ke-N · agenda" di bawah nomor; baris ini memuat tanggal + keterangan hasil saja.
    if (k.sidang) baris1.push(r.s.ket ? urusanSidang(r) : tglS(r.s.tanggal));
    return (
      `<button type="button" class="bd-kpk${r.konsep ? " konsep" : ""}" role="listitem" data-pk="${esc(r.n)}"><span class="a"><span>${esc(nomorPendek(r.n))}</span>${chipPrio(r)}</span>` +
      (r.konsep ? `<span class="c">${chipKonsep(r)}</span>` : "") +
      (k.sidang ? barisKeSidang(r, "b bd-kesidang") : "") +
      (baris1.length ? `<span class="b">${baris1.join(" · ")}</span>` : "") +
      (k.pihak ? `<span class="b">${tipPihak(r.n)}</span>` : "") +
      (k.majelis ? `<span class="b">Ketua: ${esc(namaBersih(pertama(r.p.majelisNama)))}</span>` : "") +
      (k.petugas ? `<span class="b">PP: ${esc(r.p.paniteraNama || "-")} · JS: ${esc(r.p.jurusitaNama || "-")}</span>` : "") +
      (k.isian || k.cetak
        ? `<span class="c">${k.isian ? chipIsian(r) : ""}${k.cetak ? chipDok(r) : ""}</span>`
        : "") +
      (k.alasan ? `<span class="c">${chipAlasan(r, 2)}</span>` : "") +
      `</button>`
    );
  }
  function baris(r, dalamTanggal) {
    return (
      `<button type="button" class="bd-brs${r.konsep ? " konsep" : ""}" role="listitem" data-pk="${esc(r.n)}"><span class="bd-no">${esc(nomorPendek(r.n))}</span><span>${esc(r.p.jenisPerkara)}</span>` +
      (dalamTanggal ? `<span class="bd-catat bd-potong">${esc(r.s.ket || r.s.agenda || "-")}</span>` : `<span class="bd-catat">${tglS(r.s.tanggal)}</span>`) +
      barisKeSidang(r, "bd-catat bd-potong bd-kesidang") +
      `${chipKonsep(r)}${tipPihak(r.n)}<span class="gap"></span>${chipIsian(r)}${chipDok(r)}${chipPrio(r)}</button>`
    );
  }
  const KOLOM = [
    ["prioritas", "Prioritas"],
    ["nomor", "Nomor perkara"],
    ["jenis", "Jenis"],
    ["tanggal", "Sidang"],
    ["", "Kegiatan sidang"],
    ["isian", "Kelengkapan isian"],
    ["cetak", "Dokumen di SIPP"],
    ["minutasi", "Batas minutasi"],
  ];
  function tabel(l) {
    return (
      `<div class="bd-tabelwadah"><table class="bd-tabelperkara"><thead><tr>` +
      KOLOM.map(([k, t]) =>
        k
          ? `<th aria-sort="${S.urut === k ? (S.arah > 0 ? "ascending" : "descending") : "none"}"><button type="button" data-urutkol="${k}">${t}${S.urut === k ? (S.arah > 0 ? " ▲" : " ▼") : ""}</button></th>`
          : `<th>${t}</th>`
      ).join("") +
      `</tr></thead><tbody>` +
      l
        .map(
          (r) =>
            `<tr${r.konsep ? ' class="konsep"' : ""} data-pk="${esc(r.n)}" tabindex="0"><td>${chipPrio(r)}</td><td class="nw"><span style="font-family:var(--mono)">${esc(nomorPendek(r.n))}</span> ${tipPihak(r.n)}${r.konsep ? `<span class="blok">${chipKonsep(r)}</span>` : ""}${barisKeSidang(r, "bd-kesidang blok")}</td>` +
            `<td>${potong(r.p.jenisPerkara, 22)}</td><td class="nw">${tglS(r.s.tanggal)}</td><td>${potong(r.s.ket || r.s.agenda, 34)}</td>` +
            `<td>${chipIsian(r)}</td><td>${chipDok(r)}</td>` +
            `<td class="nw">${r.sisaMinutasi === null || r.selesai ? "-" : `${r.sisaMinutasi} hari lagi`}</td></tr>`
        )
        .join("") +
      `</tbody></table></div>`
    );
  }
  function grupTanggal(t, ls) {
    const h = t === hariIni();
    const [y, m, dd] = t.split("-");
    const lewat = t < hariIni();
    const sel = ls.filter((r) => r.selesai).length;
    return (
      `<section class="bd-grupT${h ? " hariini" : ""}" data-tgl="${t}"><header class="bd-pitaT"><span class="bd-tglbesar"><b>${+dd}</b><small>${BULAN[+m - 1].slice(0, 3)} ${y}</small></span>` +
      `<span class="bd-hariT"><b>${hariDari(t)}</b><em>${h ? "Hari ini" : lewat ? `${selisih(t, hariIni())} hari lalu` : `${selisih(hariIni(), t)} hari lagi`}</em></span><span class="gap"></span>` +
      `<span class="bd-chip">${ls.length} perkara</span>${sel ? `<span class="bd-chip ok">${sel} selesai</span>` : ""}</header>` +
      `<div class="bd-dpk ringkas">${ls.map((r) => baris(r, true)).join("")}</div></section>`
    );
  }

  /** "Per tanggal sidang": kelompok khusus "Konsep sementara" paling atas (semua tanggalnya; tanggal tampil di tiap baris). */
  function grupKonsep(ls) {
    const sel = ls.filter((r) => r.selesai).length;
    return (
      `<section class="bd-grupT konsep" data-grup-konsep><header class="bd-pitaT"><span class="bd-hariT"><b>Konsep sementara</b><em>Ditunjuk sebagai konseptor di Jadwal Sidang</em></span><span class="gap"></span>` +
      `<span class="bd-chip">${ls.length} perkara</span>${sel ? `<span class="bd-chip ok">${sel} selesai</span>` : ""}</header>` +
      `<div class="bd-dpk ringkas">${ls.map((r) => baris(r, false)).join("")}</div></section>`
    );
  }

  function teksKosong() {
    const d = S.data;
    if (!d) return "";
    if (!d.lihatSemua && !d.adaYangCocok) {
      return `Nama akun Anda (${esc(d.nama || "?")}) tidak ditemukan sebagai majelis, panitera pengganti, atau juru sita pada ${d.mode === "hari" ? "sidang hari ini" : "rentang ini"}. Bila namanya di SIPP ditulis lain, hubungi admin.`;
    }
    if (d.ptspCari) {
      if (S.cariNomor.trim()) return "Tidak ada perkara satker dengan nomor itu pada jadwal sidang 90 hari lalu sampai 45 hari ke depan.";
      if (ptspDaftar()) {
        const apa = S.ptspPertama ? "perkara baru (sidang pertama)" : "perkara yang bersidang";
        return S.mode === "hari" ? `Tidak ada ${apa} hari ini.` : S.mode === "tanggal" ? `Tidak ada ${apa} pada tanggal itu.` : `Tidak ada ${apa} pada rentang ini.`;
      }
      return "Ketik sebagian nomor perkara untuk mencari perkara satker (hanya baca; blangko PTSP).";
    }
    if (d.mode === "hari") return "Tidak ada sidang hari ini untuk Anda.";
    if (S.mode === "tanggal") return "Tidak ada sidang Anda pada tanggal itu.";
    return "Tidak ada perkara pada rentang ini.";
  }

  /** Kotak cari pintar: pemilih jenis + kotak ketik (PTSP: hanya nomor, dicari di server). */
  function kotakCari() {
    if (ptspCari()) {
      return `<input class="bd-cari" id="bd-cari" placeholder="cari nomor perkara" aria-label="Cari nomor perkara" value="${esc(S.cariNomor)}">`;
    }
    const aktif = JENIS_CARI.find((x) => x[0] === S.cariJenis) || JENIS_CARI[0];
    return (
      `<select id="bd-carijenis" aria-label="Cari berdasarkan">` +
      JENIS_CARI.map(([k, t]) => `<option value="${k}"${k === aktif[0] ? " selected" : ""}>${esc(t)}</option>`).join("") +
      `</select><input class="bd-cari" id="bd-cari" placeholder="${esc(`cari: ${aktif[2]}`)}" aria-label="Cari perkara" title="Beberapa kata kunci dipisah spasi: semuanya harus cocok." value="${esc(S.cariNomor)}">`
    );
  }

  function renderPerkara() {
    const ringkas = cari("#bd-pkringkas", akar);
    const ganti = cari("#bd-ganti", akar);
    const pilih = cari("#bd-pkpilih", akar);
    if (S.pk) {
      pilih.hidden = true;
      ringkas.hidden = false;
      ganti.hidden = false;
      renderRingkasPerkara(ringkas);
      return;
    }
    ringkas.hidden = true;
    ganti.hidden = true;
    pilih.hidden = false;
    const fokus = akar.ownerDocument.activeElement;
    const fokusCari = fokus && fokus.id === "bd-cari" ? fokus.selectionStart : null;

    const semuaL = S.memuat || S.galat || !S.data ? [] : daftarUrutSemua();
    const l = daftarUrut(semuaL);
    // Jumlah yang disembunyikan (sudah selesai) - dilaporkan jujur di catatan daftar, bukan dibuang diam-diam.
    const sembunyi = semuaL.filter((r) => sembunyiBerlaku() && r.selesai).length;
    // Konsep sementara yang disembunyikan toggle (di luar yang sudah dihitung sebagai selesai), dan jumlah konsep sementara untuk label toggle.
    const konsepSemb = semuaL.filter((r) => konsepDisembunyikan(r) && !(sembunyiBerlaku() && r.selesai)).length;
    const konsepJumlah = semuaL.filter((r) => r.konsep && !(sembunyiBerlaku() && r.selesai)).length;
    let isi =
      `<div class="bd-kontrol"><div class="bd-seg" role="tablist" aria-label="Perkara yang ditampilkan">` +
      (ptspDaftar()
        ? [
            ["hari", "Perkara hari ini"],
            ["tanggal", "Tanggal tertentu"],
            ["rentang", "Rentang tanggal"],
          ]
        : [
            ["hari", "Sidang hari ini"],
            ["tanggal", "Tanggal tertentu"],
            ["rentang", "Rentang tanggal"],
            ["semua", "Semua perkara saya"],
          ]
      )
        .map(([m, t]) => `<button type="button" role="tab" data-mode="${m}" aria-selected="${S.mode === m}">${t}</button>`)
        .join("") +
      `</div>${kotakCari()}</div>`;
    if (ptspDaftar()) {
      isi +=
        `<div class="bd-kontrol" id="bd-ptspket"><label class="bd-cek" title="Perkara baru yang penetapan awalnya (PMH, PPP, PJS, PHS) dikerjakan meja PTSP. Dimatikan: semua perkara yang bersidang pada tanggal itu."><input type="checkbox" id="bd-pertama" ${S.ptspPertama ? "checked" : ""}> Hanya perkara baru (sidang pertama)</label>` +
        `<span class="bd-catat">Tanggal acuan: ${S.ptspPertama ? "tanggal sidang pertama" : "tanggal sidang"}. Ketik nomor perkara untuk mencari perkara mana pun.</span></div>`;
    }
    if (tesAktif()) isi += htmlTesCari();
    if (S.mode === "tanggal") {
      isi +=
        `<div class="bd-kontrol"><label class="bd-lbl" for="bd-tgl">Tanggal</label><input type="date" id="bd-tgl" value="${esc(S.tgl)}">` +
        `<button type="button" class="bd-btn kecil" data-bd="tanggal">Tampilkan</button></div>`;
    }
    if (S.mode === "rentang") {
      isi +=
        `<div class="bd-kontrol"><label class="bd-lbl" for="bd-dari">Dari</label><input type="date" id="bd-dari" value="${esc(S.dari)}">` +
        `<label class="bd-lbl" for="bd-sampai">Sampai</label><input type="date" id="bd-sampai" value="${esc(S.sampai)}">` +
        `<button type="button" class="bd-btn kecil" data-bd="rentang">Tampilkan</button></div>`;
    }
    isi +=
      `<div class="bd-kontrol"><span class="bd-lbl">Tampilan</span><div class="bd-seg" role="tablist" aria-label="Cara menampilkan daftar">` +
      [
        ["kartu", "Kartu"],
        ["ringkas", "Daftar ringkas"],
        ["tabel", "Tabel detail"],
        ["tanggal", "Per tanggal sidang"],
      ]
        .map(([m, t]) => `<button type="button" role="tab" data-lihat="${m}" aria-selected="${S.lihat === m}">${t}</button>`)
        .join("") +
      `</div>${ikonKeterangan("tampilan-daftar")}</div>` +
      `<div class="bd-kontrol"><label class="bd-lbl" for="bd-urut">Urutkan</label><select id="bd-urut">` +
      Object.keys(NAMA_URUT)
        .filter((k) => k !== "minutasi" || S.urut === "minutasi")
        .map((k) => `<option value="${k}" ${S.urut === k ? "selected" : ""}>${k === "prioritas" ? "Paling perlu dikerjakan" : NAMA_URUT[k].charAt(0).toUpperCase() + NAMA_URUT[k].slice(1)}</option>`)
        .join("") +
      `</select><button type="button" class="bd-btn kecil" data-bd="arah" aria-label="Balik urutan">${S.arah > 0 ? "Urutan: naik ▲" : "Urutan: turun ▼"}</button>` +
      `<label class="bd-cek" title="Perkara yang sudah selesai ditaruh di belakang, apa pun urutan yang dipilih."><input type="checkbox" id="bd-depan" ${S.depan ? "checked" : ""}> Yang belum selesai di depan</label>` +
      (ptspCari() ? "" : `<label class="bd-cek"><input type="checkbox" id="bd-sembunyi" ${S.sembunyiSelesai ? "checked" : ""}> Sembunyikan yang selesai</label>`) +
      (ptspCari() ? "" : `<label class="bd-cek" title="Perkara yang di Jadwal Sidang ditunjuk konseptornya (sementara) tampil paling atas. Dimatikan: disembunyikan dari daftar."><input type="checkbox" id="bd-konsep" ${S.tampilKonsep ? "checked" : ""}> Tampilkan konsep sementara${konsepJumlah ? ` (${konsepJumlah})` : ""}</label>`) +
      `</div>`;
    if (S.lihat === "kartu") {
      isi += `<div class="bd-kontrol" id="bd-ketkartu"><span class="bd-lbl" title="Mengatur isi tiap kartu perkara (hanya pada tampilan Kartu). Diingat per pengguna.">Tampilkan keterangan</span>${KET_KARTU.map(
        ([k, t]) => `<label class="bd-sak"><input type="checkbox" data-ketk="${k}" ${S.ket[k] ? "checked" : ""}><span class="bd-sakbar" aria-hidden="true"></span>${t}</label>`
      ).join("")}</div>`;
    }
    let badan;
    if (S.mode === "rentang" && !S.data && !S.memuat && !S.galat) badan = `<p class="bd-catat">Pilih tanggal (cukup satu tanggal untuk satu hari), lalu tekan Tampilkan.</p>`;
    else if (S.mode === "tanggal" && !S.data && !S.memuat && !S.galat) badan = `<p class="bd-catat">Pilih satu tanggal, lalu tekan Tampilkan.</p>`;
    else if (S.memuat || (!S.data && !S.galat)) badan = `<p class="bd-catat" role="status">Membaca daftar perkara dari SIPP…</p>`;
    else if (S.galat) {
      badan = `<div class="bd-peringatan" role="alert">${esc(S.galat)} <button type="button" class="bd-btn kecil" data-bd="coba">Coba lagi</button></div>`;
    } else if (!l.length && sembunyi && !konsepSemb) {
      badan =
        `<p class="bd-catat">Semua ${sembunyi} perkara pada daftar ini sudah selesai, jadi disembunyikan. <button type="button" class="bd-btn kecil" data-bd="tampil-selesai">Tampilkan yang selesai</button></p>`;
    } else if (!l.length && konsepSemb) {
      badan =
        `<p class="bd-catat">${sembunyi ? `${sembunyi} perkara yang selesai dan ` : "Semua "}${konsepSemb} perkara konsep sementara pada daftar ini disembunyikan. ` +
        (sembunyi ? `<button type="button" class="bd-btn kecil" data-bd="tampil-selesai">Tampilkan yang selesai</button> ` : "") +
        `<button type="button" class="bd-btn kecil" data-bd="tampil-konsep">Tampilkan konsep sementara</button></p>`;
    } else if (!l.length) {
      badan =
        `<p class="bd-catat">${teksKosong()}${S.mode === "hari" && !ptspDaftar() ? ` <button type="button" class="bd-btn kecil" data-mode="semua">Lihat semua perkara saya</button>` : ""}</p>`;
    } else {
      const wadClass = S.lihat === "kartu" ? "kartu" : S.lihat === "ringkas" ? "ringkas" : "blok";
      let dalam;
      if (S.lihat === "kartu") dalam = l.map(kartu).join("");
      else if (S.lihat === "ringkas") dalam = l.map((r) => baris(r)).join("");
      else if (S.lihat === "tabel") dalam = tabel(l);
      else {
        const grup = {};
        const konsepL = l.filter((r) => r.konsep);
        l.filter((r) => !r.konsep).forEach((r) => (grup[r.s.tanggal] = grup[r.s.tanggal] || []).push(r));
        dalam = (konsepL.length ? grupKonsep(konsepL) : "") + Object.keys(grup)
          .sort((a, b) => Math.abs(selisih(hariIni(), a)) - Math.abs(selisih(hariIni(), b)) || (a < b ? -1 : 1))
          .map((t) => grupTanggal(t, grup[t]))
          .join("");
      }
      badan = `<div class="bd-dpk ${wadClass}" id="bd-dpk" ${S.lihat === "kartu" || S.lihat === "ringkas" ? 'role="list"' : ""}>${dalam}</div>`;
      const peringatan = [];
      if (S.data && S.data.terpotong) peringatan.push("Sebagian sidang di rentang ini mungkin belum tampil (server membatasi 500 baris per minggu). Persempit tanggalnya.");
      badan +=
        `<p class="bd-catat" id="bd-ketdaftar">${l.length} perkara · ${S.data.mode === "semua" ? "sidang sejak 90 hari lalu sampai 45 hari ke depan" : `${tglS(S.data.dari)}${S.data.dari !== S.data.sampai ? ` s.d. ${tglS(S.data.sampai)}` : ""}`} · diurutkan menurut ${NAMA_URUT[S.urut]}${S.depan ? ", yang belum selesai di depan" : ""}.` +
        (sembunyi ? ` <span id="bd-ketsembunyi">${sembunyi} perkara yang selesai disembunyikan.</span> <button type="button" class="bd-tautan" data-bd="tampil-selesai">Tampilkan</button>` : "") +
        (konsepSemb ? ` <span id="bd-ketkonsep">${konsepSemb} perkara konsep sementara disembunyikan.</span> <button type="button" class="bd-tautan" data-bd="tampil-konsep">Tampilkan</button>` : "") +
        (!konsepSemb && konsepJumlah ? ` <span id="bd-ketkonsep">${konsepJumlah} perkara konsep sementara di atas.</span>` : "") +
        `${peringatan.length ? ` ${esc(peringatan.join(" "))}` : ""}</p>`;
    }
    pilih.innerHTML = isi + badan;
    if (S.data && !S.memuat && !S.galat && l.length) jadwalkanUkur(l);
    if (fokusCari !== null) {
      const c = cari("#bd-cari", akar);
      if (c) {
        c.focus();
        try {
          c.setSelectionRange(fokusCari, fokusCari);
        } catch {
          /* tipe input tanpa seleksi */
        }
      }
    }
  }

  // ── Tes putusan: perkara acuan mana pun, dicari menurut nomor di SIPP (22 Okt malam) ────────────────────────────────
  /** Satu baris hasil cari -> bentuk perkara pada daftar jadwal (riwayat sidangnya dimuat sesudah dipilih). */
  function perkaraAcuanTes(x) {
    const l = (v) => (Array.isArray(v) ? v.map((n) => String(n || "").trim()).filter(Boolean) : []);
    return {
      nomorPerkara: String((x && x.nomorPerkara) || "").trim(),
      perkaraId: String((x && x.perkaraId) || "").trim(),
      jenisPerkara: String((x && x.jenisPerkara) || "").trim(),
      alurPerkaraId: Number(x && x.alurPerkaraId) || 0,
      sudahPutus: Boolean(x && x.sudahPutus),
      tanggalPutusan: String((x && x.tanggalPutusan) || ""),
      tanggalMinutasi: String((x && x.tanggalMinutasi) || ""),
      adaBerkasPutusan: null,
      lewatEcourt: null,
      ghaib: false,
      prodeo: false,
      majelisKode: "",
      majelisNama: "",
      paniteraNama: "",
      jurusitaNama: "",
      sebagai: [],
      pihak: { penggugat: l(x && x.pihak && x.pihak.penggugat), tergugat: l(x && x.pihak && x.pihak.tergugat) },
      sidang: [],
    };
  }
  function htmlTesCari() {
    const t = S.tesCari;
    let hasil = "";
    if (t.memuat) hasil = `<p class="bd-catat" role="status">Mencari di SIPP…</p>`;
    else if (t.galat) hasil = `<p class="bd-catat" role="alert">${esc(t.galat)}</p>`;
    else if (t.hasil) {
      hasil = t.hasil.length
        ? `<div class="bd-tescarihasil" role="list">${t.hasil
            .map((p) => {
              const pihak = [p.pihak.penggugat.join("; "), p.pihak.tergugat.join("; ")].filter(Boolean).join(" melawan ");
              return `<button type="button" class="bd-tespk" role="listitem" data-tespk="${esc(p.nomorPerkara)}"><b>${esc(p.nomorPerkara)}</b><span>${esc(p.jenisPerkara)}${p.sudahPutus ? " · sudah putus" : ""}</span><span class="bd-catat">${esc(pihak || "-")}</span></button>`;
            })
            .join("")}</div>`
        : `<p class="bd-catat">Tidak ada perkara yang nomornya memuat "${esc(t.kata)}".</p>`;
    }
    return (
      `<div class="bd-kontrol bd-tescari"><label class="bd-lbl" for="bd-tescari">Cari perkara acuan di SIPP</label>` +
      `<input class="bd-cari" id="bd-tescari" placeholder="nomor perkara, mis. 600/Pdt.G/2026" aria-label="Cari perkara acuan menurut nomor" value="${esc(t.kata)}">` +
      `<button type="button" class="bd-btn kecil" data-bd="tescari">Cari</button>` +
      `<span class="bd-catat">Perkara mana pun, tidak dibatasi jadwal sidang. Hanya dibaca; tidak ada yang diubah.</span></div>${hasil}`
    );
  }
  async function cariTes() {
    if (!tesAktif()) return;
    const kata = S.tesCari.kata.trim();
    if (kata.length < 3) {
      S.tesCari = { kata, memuat: false, galat: "Ketik paling sedikit tiga karakter nomor perkara.", hasil: null };
      return renderPerkara();
    }
    S.tesCari = { kata, memuat: true, galat: "", hasil: null };
    renderPerkara();
    try {
      const d = await ambil(`${API_TES_CARI}?nomor=${encodeURIComponent(kata)}`, "Mencari perkara di SIPP");
      if (!tesAktif() || S.tesCari.kata !== kata) return;
      S.tesCari = { kata, memuat: false, galat: "", hasil: (Array.isArray(d && d.perkara) ? d.perkara : []).map(perkaraAcuanTes).filter((p) => p.nomorPerkara && p.perkaraId) };
    } catch (e) {
      if (S.tesCari.kata !== kata) return;
      S.tesCari = { kata, memuat: false, galat: String((e && e.message) || e), hasil: null };
    }
    if (!S.pk) renderPerkara();
  }
  function pilihAcuanTes(nomor) {
    const p = S.tesCari.hasil && S.tesCari.hasil.find((x) => x.nomorPerkara === nomor);
    if (!p || !tesAktif()) return;
    S.tesAcuan = p;
    pilihPerkara(nomor);
  }
  function riwayatPerkara(p) {
    const lengkap = S.riwayat.get(p.nomorPerkara);
    return lengkap && lengkap.length ? lengkap : p.sidang;
  }
  /** Perkara menurut nomor: dari daftar jadwal, atau (Tes putusan) perkara acuan hasil cari nomor di SIPP. */
  function perkaraDiDaftar(nomor) {
    const p = S.data && S.data.perkara.find((x) => x.nomorPerkara === nomor);
    if (p) return p;
    return tesAktif() && S.tesAcuan && S.tesAcuan.nomorPerkara === nomor ? S.tesAcuan : null;
  }
  function perkaraTerpilih() {
    if (!S.pk) return null;
    return perkaraDiDaftar(S.pk);
  }
  function renderRingkasPerkara(wad) {
    const p = perkaraTerpilih();
    if (!p) {
      wad.innerHTML = `<span class="bd-no">${esc(S.pk)}</span>`;
      return;
    }
    const sid = riwayatPerkara(p);
    const r = ringkasan(p, ctxRingkasan());
    wad.innerHTML =
      `<span class="bd-no" title="Klik dua kali untuk mengganti perkara">${esc(p.nomorPerkara)}</span><span>${esc(p.jenisPerkara)}${p.lewatEcourt ? " · e-Court" : ""}</span>` +
      `<span class="bd-pihak" tabindex="0" data-tipn="${esc(p.nomorPerkara)}">Para pihak ⓘ</span>` +
      `<label class="bd-lbl" for="bd-sidang">Sidang</label><select id="bd-sidang" style="width:min(100%,340px)" title="Sidang yang dipakai blangko">${sid
        .map((s, i) => `<option value="${i}" ${i === S.sidIdx ? "selected" : ""}>Ke-${i + 1} · ${tglS(s.tanggal)} · ${esc(s.agenda || "-")}${s.ket ? ` · ${esc(s.ket)}` : ""}</option>`)
        .join("")}</select>` +
      `<span class="bd-chip ${kelasIsian(r)}" title="${esc(r.isiKet)}">${esc(r.isiTxt)}</span>${r.dokKelas === "ok" ? `<span class="bd-chip ok">${esc(r.dokTxt)}</span>` : ""}`;
  }

  /** Warna lencana isian seperti rancangan: lengkap hijau, sebagian kuning, belum diisi jingga. */
  function kelasIsian(r) {
    const lap = S.lapor.get(r.n);
    if (!lap || typeof lap.t !== "number") return "";
    return lap.t === 0 || lap.a >= lap.t ? "ok" : lap.a ? "sebagian" : "belum";
  }

  // ── Ukur kelengkapan isian di latar (28 Okt 2026) ────────────────────────
  function ctxRingkasan() {
    return { hariIni: hariIni(), lapor: S.lapor, ukur: S.ukur, ptsp: ptspDaftar() || ptspCari() };
  }
  /** Jenis dokumen yang isiannya diukur untuk satu perkara di daftar: dokumen perannya; PTSP = form bantu PTSP; selain itu "" (tidak ada). */
  function jenisUkur(r) {
    if (r.dj && r.dj.length) return r.dj[0];
    return ptspDaftar() || ptspCari() ? "ptsp" : "";
  }
  function simpanSesiUkur() {
    try {
      const semua = Array.from(S.lapor).filter(([, v]) => v && typeof v.t === "number" && v.saat);
      semua.sort((a, b) => b[1].saat - a[1].saat);
      const isi = {};
      for (const [k, v] of semua.slice(0, 300)) isi[k] = { a: v.a, t: v.t, jenis: v.jenis, saat: v.saat, blangko: v.blangko || null, sumber: v.sumber || "latar", perkiraan: Boolean(v.perkiraan), kunci: v.kunci || "" };
      globalThis.sessionStorage.setItem(KUNCI_SESI_UKUR, JSON.stringify(isi));
    } catch {
      /* sessionStorage tertutup (jendela pribadi/pratinjau): hasil hanya di memori halaman ini */
    }
  }
  function pulihSesiUkur() {
    try {
      const mentah = globalThis.sessionStorage.getItem(KUNCI_SESI_UKUR);
      const isi = mentah ? JSON.parse(mentah) : null;
      if (!isi || typeof isi !== "object") return;
      for (const [k, v] of Object.entries(isi)) {
        if (!v || typeof v.t !== "number" || typeof v.a !== "number" || !v.saat || Date.now() - v.saat > UMUR_SESI_UKUR_MS || S.lapor.has(k)) continue;
        S.lapor.set(k, { a: v.a, t: v.t, jenis: String(v.jenis || ""), dicetak: {}, saat: v.saat, blangko: v.blangko || null, sumber: v.sumber === "dibuka" ? "dibuka" : "latar", perkiraan: Boolean(v.perkiraan), kunci: String(v.kunci || "") });
      }
    } catch {
      /* simpanan rusak: diukur ulang */
    }
  }
  /** Perlu diukur (ulang)? Hasil segar = baru, jenis dokumen dan peran yang sama; gagal/belum ada blangko menunggu `ulangMs`. */
  function perluUkur(r, jenis) {
    const n = r.n;
    if (S.ukurDalam.has(n)) return false;
    const lap = S.lapor.get(n);
    const kunci = peranKunci();
    if (lap && typeof lap.t === "number" && lap.saat && Date.now() - lap.saat < UKUR.umurMs && lap.jenis === jenis && (!lap.kunci || lap.kunci === kunci)) return false;
    const uk = S.ukur.get(n);
    if (uk && uk.status === "memuat") return false;
    if (uk && uk.kunci === kunci && uk.jenis === jenis && Date.now() - uk.saat < UKUR.ulangMs) return false;
    return true;
  }
  /** Mengantre perkara yang tampil (urutan layar, paling banyak `batas`) untuk diukur; aman dipanggil tiap menggambar daftar. */
  function jadwalkanUkur(rows) {
    if (!S.pengukur || tesAktif() || !Array.isArray(rows)) return;
    let baru = 0;
    for (const r of rows.slice(0, UKUR.batas)) {
      const jenis = jenisUkur(r);
      if (!jenis) {
        if (!S.ukur.has(r.n)) S.ukur.set(r.n, { status: "tanpa-dokumen", saat: Date.now(), jenis: "", kunci: peranKunci() });
        continue;
      }
      if (!perluUkur(r, jenis)) continue;
      S.ukurDalam.add(r.n);
      S.ukurAntre.push({ nomor: r.n, jenis, kunci: peranKunci() });
      baru += 1;
    }
    mulaiUkurTertunda();
  }
  /** Memulai (atau melanjutkan) pengukuran sesudah jeda singkat; tidak dobel. */
  function mulaiUkurTertunda() {
    if (S.ukurPewaktu || !S.ukurAntre.length || S.ukurJalan >= UKUR.serentak) return;
    S.ukurPewaktu = setTimeout(() => {
      S.ukurPewaktu = null;
      jalankanUkur();
    }, UKUR.mulaiMs);
  }
  const jedaUkur = (ms) => new Promise((selesai) => setTimeout(selesai, ms));
  async function ukurSatu(tugas) {
    const p = perkaraDiDaftar(tugas.nomor);
    if (!p || tugas.kunci !== peranKunci()) return;
    const r = ringkasan(p, ctxRingkasan());
    const lapAwal = S.lapor.get(tugas.nomor);
    S.ukur.set(tugas.nomor, { status: "memuat", saat: Date.now(), jenis: tugas.jenis, kunci: tugas.kunci });
    perbaruiLencanaIsian(tugas.nomor);
    const mulai = Date.now();
    let hasil;
    try {
      const ingat = lapAwal && lapAwal.jenis === tugas.jenis && lapAwal.blangko ? lapAwal.blangko : null;
      let jam;
      hasil = await Promise.race([
        Promise.resolve(S.pengukur({ p, s: r.s, jenis: tugas.jenis, ingat })),
        new Promise((_, tolak) => (jam = setTimeout(() => tolak(new Error("batas waktu")), UKUR.batasWaktuMs))),
      ]).finally(() => clearTimeout(jam));
    } catch {
      hasil = { status: "galat" };
    }
    if (tugas.kunci !== peranKunci()) {
      S.ukur.delete(tugas.nomor);
      return;
    }
    const sekarang = S.lapor.get(tugas.nomor);
    const dibukaSementara = sekarang && sekarang.sumber === "dibuka" && sekarang.saat >= mulai;
    if (hasil && hasil.status === "ok" && !dibukaSementara) {
      S.lapor.set(tugas.nomor, { a: Number(hasil.a) || 0, t: Number(hasil.t) || 0, jenis: tugas.jenis, dicetak: (sekarang && sekarang.dicetak) || {}, saat: Date.now(), blangko: hasil.blangko || null, sumber: "latar", perkiraan: Boolean(hasil.perkiraan), kunci: tugas.kunci });
      S.ukur.delete(tugas.nomor);
      simpanSesiUkur();
    } else if (dibukaSementara || (hasil && hasil.status === "lewati")) S.ukur.delete(tugas.nomor);
    else S.ukur.set(tugas.nomor, { status: hasil && hasil.status === "tanpa-blangko" ? "tanpa-blangko" : "galat", saat: Date.now(), jenis: tugas.jenis, kunci: tugas.kunci });
    perbaruiLencanaIsian(tugas.nomor);
  }
  function jalankanUkur() {
    while (S.pengukur && !S.pk && S.ukurJalan < UKUR.serentak && S.ukurAntre.length) {
      const tugas = S.ukurAntre.shift();
      S.ukurJalan += 1;
      UKUR.puncak = Math.max(UKUR.puncak, S.ukurJalan);
      void (async () => {
        try {
          await ukurSatu(tugas);
        } catch {
          S.ukur.set(tugas.nomor, { status: "galat", saat: Date.now(), jenis: tugas.jenis, kunci: tugas.kunci });
          perbaruiLencanaIsian(tugas.nomor);
        } finally {
          S.ukurDalam.delete(tugas.nomor);
          if (UKUR.jedaMs) await jedaUkur(UKUR.jedaMs);
          S.ukurJalan -= 1;
          jalankanUkur();
        }
      })();
    }
  }
  /** Menyegarkan lencana satu perkara di tempat (tanpa menggambar ulang daftar, jadi gulir dan fokus tidak bergeser). */
  function perbaruiLencanaIsian(nomor) {
    if (!akar || S.pk) return;
    const p = perkaraDiDaftar(nomor);
    if (!p) return;
    const r = ringkasan(p, ctxRingkasan());
    for (const el of akar.querySelectorAll("[data-isian]")) {
      if (el.getAttribute("data-isian") !== nomor) continue;
      el.textContent = r.isiTxt;
      el.setAttribute("title", r.isiKet);
      el.className = `bd-chip bd-isian${r.isiKelas ? ` ${r.isiKelas}` : ""}`;
    }
  }
  /** Lencana diklik: buka perkara di langkah Isian dengan blangko yang diukur, lalu gulir ke isian wajib kosong pertama. */
  function bukaIsianPerkara(nomor) {
    const p = perkaraDiDaftar(nomor);
    if (!p) return;
    const lap = S.lapor.get(nomor);
    pilihPerkara(nomor);
    try {
      document.dispatchEvent(new CustomEvent("aleta-bd-buka-isian", { detail: { nomorPerkara: nomor, blangko: lap && lap.blangko ? { ...lap.blangko } : null, jenis: lap ? lap.jenis : "" } }));
    } catch {
      /* peristiwa kustom tidak tersedia: perkara tetap terbuka */
    }
  }

  // ── Memilih perkara ───────────────────────────────────────────────────────
  function pilihPerkara(nomor) {
    const p = perkaraDiDaftar(nomor);
    if (!p) return;
    S.pk = nomor;
    S.sidIdx = Math.max(0, indeksAcuan(riwayatPerkara(p), hariIni()));
    sembunyiTip();
    renderSemua();
    umumkanPerkara();
    void muatRiwayatSidang(p);
  }
  /** Cetak massal (blangko-derry-massal.js memasang fungsinya lewat api.pasangMassal); belum terpasang = kabar singkat. */
  function bukaMassal(jenis) {
    if (tesAktif()) return toast("Cetak massal dimatikan pada mode Tes putusan: ia mengisi dan mencatat ke banyak perkara.");
    if (typeof S.massal === "function") return S.massal(typeof jenis === "string" ? jenis : undefined);
    return toast("Cetak massal belum siap. Muat ulang halaman ABT.");
  }
  function gantiPerkara() {
    S.pk = null;
    sembunyiTip();
    renderSemua();
    umumkanPerkara();
  }
  function umumkanPerkara() {
    const p = perkaraTerpilih();
    const sid = p ? riwayatPerkara(p) : [];
    try {
      document.dispatchEvent(
        new CustomEvent("aleta-bd-perkara", {
          detail: p ? { nomorPerkara: p.nomorPerkara, perkaraId: p.perkaraId, jenisPerkara: p.jenisPerkara, sidang: sid.slice(), sidangKe: S.sidIdx, sidangDipilih: sid[S.sidIdx] || null, perkara: p, putusanSipp: S.putusanSipp.get(p.nomorPerkara) || null, peranKunci: peranKunci() } : null,
        })
      );
    } catch {
      /* peristiwa kustom tidak tersedia: tahap berikutnya memakai api.perkaraTerpilih() */
    }
  }

  /** Seluruh sidang perkara (kalender perkaranya sendiri) untuk dropdown. Gagal = tetap memakai sidang yang sudah termuat. */
  async function muatRiwayatSidang(p) {
    if (S.riwayat.has(p.nomorPerkara)) return;
    try {
      const d = await ambil(`${API_SIDANG}?nomor=${encodeURIComponent(p.nomorPerkara)}`, "Membaca riwayat sidang");
      const j = d && d.sipp && Array.isArray(d.sipp.jadwalPerkara) ? d.sipp.jadwalPerkara : [];
      // 30 Okt: keadaan putusan SIPP (amar memuat verstek, tanggal putusan) untuk catatan temuan kehadiran di panel cetak.
      const pu = d && d.sipp && d.sipp.putusan && typeof d.sipp.putusan === "object" ? d.sipp.putusan : null;
      if (d && d.sipp) S.putusanSipp.set(p.nomorPerkara, { amarVerstek: Boolean(pu && (pu.amarVerstek === true || (pu.amarVerstek === undefined && /verstek/i.test(String(pu.amarRingkas || ""))))), tanggalPutusan: String((pu && pu.tanggalPutusan) || "").slice(0, 10), alurPerkaraId: Number(d.sipp.alurPerkaraId) || 0 });
      const l = j
        .map((x) => ({
          sidangId: String(x.sidangId || ""),
          tanggal: String(x.tanggalSidang || "").slice(0, 10),
          jam: String(x.jamSidang || "").slice(0, 5),
          agenda: String(x.agenda || ""),
          ket: /^(0|-|--|null)?$/i.test(String(x.alasanDitunda || "").trim()) ? "" : String(x.alasanDitunda).trim(),
          ditunda: Boolean(x.ditunda),
          urutan: Number(x.urutanSidang) || 0,
          hadir: Number(x.dihadiriOleh) || null,
          adaBas: x.adaBas === undefined ? null : Boolean(x.adaBas),
          ruangan: String(x.ruangan || ""),
        }))
        .filter((x) => x.tanggal)
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jam.localeCompare(b.jam) || a.urutan - b.urutan);
      if (!l.length) {
        // 30 Okt: tanpa sidang tidak mengumumkan ulang perkara - umumkan ulang mereset panel isian (tautan #bd=, draf H-7, sorotan isian kosong terputus); temuan verstek tetap dibaca saat sidang ada.
        return;
      }
      // Sidang yang sedang dipilih dicari lebih dulu, sebelum daftarnya diganti.
      const lama = riwayatPerkara(p)[S.sidIdx];
      S.riwayat.set(p.nomorPerkara, l);
      if (S.pk === p.nomorPerkara) {
        const idx = lama ? l.findIndex((x) => x.sidangId && x.sidangId === lama.sidangId) : -1;
        S.sidIdx = idx >= 0 ? idx : Math.max(0, indeksAcuan(l, hariIni()));
        renderSemua();
        umumkanPerkara();
      }
    } catch {
      /* dropdown tetap berisi sidang yang termuat */
    }
  }

  // ── Tip nama pihak: hanya saat kursor ─────────────────────────────────────
  function tampilTip(el) {
    const n = el.getAttribute("data-tipn");
    const p = perkaraDiDaftar(n);
    const t = cari("#bd-tip", akar);
    if (!p || !t) return;
    const pg = p.pihak.penggugat.join("; ") || "-";
    const tg = p.pihak.tergugat.join("; ");
    const permohonan = /Pdt\.P/i.test(p.nomorPerkara);
    t.innerHTML = `<b>${permohonan ? "Pemohon" : "Penggugat/Pemohon"}</b>: ${esc(pg)}${tg ? `<br><b>Tergugat/Termohon</b>: ${esc(tg)}` : ""}`;
    t.hidden = false;
    // Koordinat layar (getBoundingClientRect) dibagi skala tampilan: posisi elemen melayang di dalam akar ber-zoom.
    const z = S.skala || 1;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight || 600;
    const w = Math.min((t.offsetWidth || 260) * z, vw - 16);
    const h = (t.offsetHeight || 50) * z;
    t.style.left = `${Math.max(8, Math.min(r.left, vw - w - 8)) / z}px`;
    let top = r.bottom + 6;
    if (top + h > vh - 8) top = Math.max(8, r.top - 6 - h);
    t.style.top = `${top / z}px`;
  }
  function sembunyiTip() {
    const t = cari("#bd-tip", akar);
    if (t) {
      t.hidden = true;
      t.innerHTML = "";
    }
  }
  function saatTunjuk(e) {
    const el = e.target.closest && e.target.closest("[data-tipn]");
    if (el) tampilTip(el);
  }
  function saatLepas(e) {
    const el = e.target.closest && e.target.closest("[data-tipn]");
    if (el) sembunyiTip();
  }

  // ── Melayang: Widget ALETA dan Alat saya ──────────────────────────────────
  function taruh(pop, jangkar) {
    pop.hidden = false;
    const z = S.skala || 1;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight || 600;
    const r = jangkar.getBoundingClientRect();
    // 27 Okt: menu tinggi dulu didorong ke top 8px, naik ke belakang kepala panel dan menutupi tombolnya
    // sendiri (bagian atas terpotong). Kini menu tetap di sisi tombol yang lebih lega; isinya digulir di dalam kotak.
    pop.style.maxHeight = "none";
    const w = Math.min((pop.offsetWidth || 320) * z, vw - 16);
    const hAsli = (pop.scrollHeight || pop.offsetHeight || 240) * z;
    let left = r.right - w;
    if (left < 8) left = Math.min(r.left, vw - w - 8);
    left = Math.max(8, Math.min(left, vw - w - 8));
    const ruangBawah = Math.max(0, vh - 8 - (r.bottom + 6));
    const ruangAtas = Math.max(0, r.top - 6 - 8);
    const keBawah = hAsli <= ruangBawah || ruangBawah >= ruangAtas;
    const h = Math.min(hAsli, keBawah ? ruangBawah : ruangAtas);
    const top = keBawah ? r.bottom + 6 : r.top - 6 - h;
    pop.style.maxHeight = `${h / z}px`;
    pop.style.left = `${left / z}px`;
    pop.style.top = `${top / z}px`;
  }
  const JANGKAR = { widget: "#bd-widget-btn", alat: "#bd-alat-btn" };
  function tutupFloat(kecuali) {
    for (const id of ["widget", "alat"]) {
      if (id === kecuali) continue;
      const pop = cari(`#bd-${id}`, akar);
      if (pop && !pop.hidden) pop.hidden = true;
      const b = cari(JANGKAR[id], akar);
      if (b) b.setAttribute("aria-expanded", "false");
    }
    if (!kecuali) S.floatBuka = null;
  }
  function susunUlangFloat() {
    if (!akar || !S.floatBuka) return;
    const pop = cari(`#bd-${S.floatBuka}`, akar);
    const b = cari(JANGKAR[S.floatBuka], akar);
    if (pop && b && !pop.hidden) taruh(pop, b);
  }
  function alihkanFloat(id) {
    const pop = cari(`#bd-${id}`, akar);
    const b = cari(JANGKAR[id], akar);
    if (!pop || !b) return;
    if (!pop.hidden) {
      tutupFloat();
      return;
    }
    tutupFloat(id);
    pop.innerHTML = id === "widget" ? isiWidget() : isiAlat();
    S.floatBuka = id;
    b.setAttribute("aria-expanded", "true");
    taruh(pop, b);
  }

  /** Saklar yang berlaku untuk peran akun ini; Super Admin dan Admin melihat semuanya. */
  const WIDGET = [
    ["bawaan", "Blangko ABT by Derry Briantono sebagai tampilan bawaan", "Blangko Derry langsung terbuka saat ABT dibuka", ["hakim", "pp", "js"]],
    ["tawar", "Tawarkan Blangko ABT by Derry Briantono di ABT biasa", "kartu kecil di pojok kanan bawah ABT biasa: Aktifkan, Nanti saja, atau Jangan tawarkan lagi", ["hakim", "pp", "js"]],
    ["saran", "Saran isian (bayangan, tekan Tab)", "Usulan dari SIPP, gugatan dan riwayat", ["hakim", "pp"]],
    ["ingat", "Ingatkan isian yang masih kosong sebelum cetak", "juga tombol Cetak panel ALETA di ABT biasa", ["hakim", "pp", "js"]],
    ["isiOto", "Isi otomatis dari SIPP", "begitu perkara dan blangko dipilih, isian kosong yang datanya ada di SIPP, gugatan dan e-Court terisi dan tersimpan ke ABT; yang sudah ada isinya tidak ditimpa", ["hakim", "pp", "js"]],
    ["tjJawab", "Tanya-jawab jawab-menjawab otomatis", "jawaban, replik, duplik tertulis yang rapi ditulis ke sidang yang sesuai bila barisnya kosong", ["hakim", "pp"]],
    ["siapNaskah", "Siapkan naskah cetak di latar", "begitu isian lengkap, naskah dari ABT disusun lebih dulu supaya tombol Cetak langsung jalan; mati = naskah baru diminta saat Cetak atau Pratinjau", ["hakim", "pp", "js"]],
    ["gembok", "Gembok panel ALETA di ABT biasa: selalu tampil penuh", "mati = Ringkas otomatis (panel tinggal kepalanya saat menutupi tabel)", ["hakim", "pp", "js"]],
  ];
  function saklarUntukPeran() {
    if (adm()) return WIDGET;
    const peran = ["hakim", "pp", "js"].filter((x) => S.peranSet.has(x));
    return WIDGET.filter((w) => w[3].some((x) => peran.includes(x)));
  }
  function isiWidget() {
    const semua = adm();
    const peran = ["hakim", "pp", "js"].filter((x) => S.peranSet.has(x));
    return (
      `<b>ALETA · Pengaturan ABT</b><p class="bd-catat">${semua ? "Super Admin dan Admin melihat semua pengaturan." : `Hanya pengaturan untuk ${esc(peran.map((x) => NAMA_PERAN[x]).join(" / ") || "peran Anda")}.`}</p>` +
      saklarUntukPeran()
        .map(
          (w) =>
            `<label class="bd-wbaris"><span>${esc(w[1])}${w[2] ? `<small>${esc(w[2])}</small>` : ""}</span><input type="checkbox" data-cfg="${w[0]}" ${S.cfg[w[0]] ? "checked" : ""}></label>`
        )
        .join("") +
      `<label class="bd-wbaris"><span>Tema<small>popup, panel SIPP, panel ABT, dan Blangko ABT by Derry Briantono</small></span><select data-cfgtema="1" aria-label="Tema"><option value="gelap" ${pilihanTemaKini() === "gelap" ? "selected" : ""}>Gelap</option><option value="terang" ${pilihanTemaKini() === "terang" ? "selected" : ""}>Terang</option><option value="sistem" ${pilihanTemaKini() === "sistem" ? "selected" : ""}>Ikuti sistem</option></select></label>` +
      `<label class="bd-wbaris"><span>Ukuran tampilan<small>huruf mengikuti rancangan walau halaman ABT diperkecil (Ctrl -)</small></span><select data-cfgukuran="1" aria-label="Ukuran tampilan">${[["kecil", "Kecil"], ["biasa", "Biasa"], ["besar", "Besar"], ["lebihbesar", "Lebih besar"]].map(([k, t]) => `<option value="${k}" ${S.ukuran === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>` +
      `<p class="bd-catat">Pengaturan disimpan di ekstensi dan berlaku di semua tab; saklar yang sama ada di popup ekstensi.</p>`
    );
  }

  const ALAT = {
    hakim: [
      ["putusanOto", "Putusan otomatis"],
      ["gugatan", "Isi dari gugatan (posita)"],
      ["saksi", "Set pertanyaan saksi"],
      ["ktp", "Tanggal KTP dari bukti"],
      ["cek", "Cek kelengkapan sebelum putus"],
      ["konseptor", "Checklist konseptor putusan"],
      ["advance", "Putusan Advance (periksa draf)"],
      ["unggah", "Unggah putusan ke e-Doc SIPP"],
      ["massal:unggah", "Unggah massal ke e-Doc SIPP"],
    ],
    pp: [
      ["massal:bas", "BAS massal hari ini"],
      ["gugatan", "Isi dari gugatan (posita)"],
      ["saksi", "Set pertanyaan saksi"],
      ["ktp", "Tanggal KTP dari bukti"],
      ["konseptor", "Checklist konseptor putusan"],
      // 17 Okt: konseptor (biasanya PP) juga boleh - portal memeriksa ia konseptor perkara itu.
      ["advance", "Putusan Advance (periksa draf)"],
      ["unggah", "Unggah BAS ke e-Doc SIPP"],
      ["massal:unggah", "Unggah massal ke e-Doc SIPP"],
    ],
    js: [
      ["massal:rel", "Relaas massal hari ini"],
      ["unggah", "Unggah relaas ke e-Doc SIPP"],
    ],
    kasir: [
      ["kasir:rekap", "Rekap kasir hari ini"],
      ["kasir:otomatis", "Kasir otomatis (jurnal)"],
    ],
    ptsp: [
      ["ptsp:dataumum", "Data Umum dari gugatan"],
      ["ptsp:ktp", "Isi data saksi dari foto KTP"],
    ],
  };
  /** 17 Okt: Putusan Advance per akun (Pengaturan SIPP & ABT) - akun yang dimatikan admin tidak melihat alatnya. */
  function alatAdvanceTampil() {
    const pa = globalThis.aletaPutusanAdvance;
    return !(pa && typeof pa.menyala === "function" && pa.menyala() === false);
  }
  function isiAlat() {
    const grup = peranAlat();
    if (!grup.length) return `<p class="bd-catat">Peran Anda belum punya alat di tampilan ini.</p>`;
    const sebagai = adm() && S.sebagai.nama ? ` · ${esc(namaTampilSebagai(S.sebagai.nama))}` : !adm() && S.siapa ? ` · ${esc(S.siapa.nama || "")}` : "";
    // 19 Okt: saklar "Isi otomatis dari SIPP" ada di Alat saya (bawaan menyala; diingat per pengguna di setelan ekstensi).
    const saklarIsi = grup.some((g) => ["hakim", "pp", "js", "ptsp", "admin"].includes(g))
      ? `<label class="bd-wbaris bd-saklaralat"><span>Isi otomatis dari SIPP<small>isian kosong terisi sendiri dari SIPP, gugatan dan e-Court; yang sudah ada isinya tidak ditimpa</small></span><input type="checkbox" data-cfg="isiOto" aria-label="Isi otomatis dari SIPP" ${S.cfg.isiOto !== false ? "checked" : ""}></label>`
      : "";
    // 20 Okt: saklar pratinjau BAS & relaas (SIPP) - bawaan menyala; mati = klik unduh di SIPP langsung mengunduh seperti dulu.
    const saklarPratinjau = grup.some((g) => ["hakim", "pp", "js", "ptsp", "admin"].includes(g))
      ? `<label class="bd-wbaris bd-saklaralat"><span>Pratinjau dokumen sebelum unduh<small>klik unduh atau cetak dokumen apa pun di SIPP menampilkan isinya dulu; dari sana dapat diunduh atau dicetak. Shift atau Ctrl-klik = langsung unduh</small></span><input type="checkbox" data-cfg="pratinjau" aria-label="Pratinjau dokumen sebelum unduh" ${S.cfg.pratinjau !== false ? "checked" : ""}></label>`
      : "";
    return (
      saklarIsi +
      saklarPratinjau +
      grup
        .map(
          (g) =>
            `<div class="grup">${esc(NAMA_PERAN[g])}${adm() ? "" : sebagai}</div>` +
            ALAT[g].filter(([id]) => id !== "advance" || alatAdvanceTampil()).map(([id, t]) => `<button type="button" role="menuitem" data-alat="${id}"${ALAT_DI_SIPP[id] && !alatTersedia(id) ? ` title="${esc(ALAT_DI_SIPP[id])}"` : ""}><span>${esc(t)}</span>${alatTersedia(id) ? "" : ALAT_DI_SIPP[id] ? `<span class="bd-chip">di SIPP</span>` : `<span class="bd-chip">menyusul</span>`}</button>`).join("")
        )
        .join("") + (adm() ? `<p class="bd-catat" style="padding:4px 8px">Admin melihat semua peran. Pilih "Lihat sebagai akun" untuk menyempitkan.</p>` : "")
    );
  }
  /**
   * 29 Okt (audit runut): "BAS massal hari ini" dan "Relaas massal hari ini" dulu bertanda "menyusul" padahal Cetak massal langkah 1
   * sudah mengerjakannya (PP = BAS, juru sita = relaas) - kini membuka Cetak massal jenis itu. Alat yang ada di panel ALETA halaman
   * SIPP (kasir, PTSP) menyebut tempatnya, bukan "tahap berikutnya".
   */
  const ALAT_MASSAL = { "massal:bas": "bas", "massal:rel": "rel" };
  const ALAT_DI_SIPP = {
    "kasir:rekap": "Rekap kasir ada di panel ALETA halaman daftar perkara SIPP (bagian Kasir).",
    "kasir:otomatis": "Kasir otomatis ada di panel ALETA halaman daftar perkara SIPP (bagian Kasir).",
    "ptsp:dataumum": "Data Umum dari gugatan ada di tab PTSP panel ALETA halaman perkara SIPP.",
    "ptsp:ktp": "Isi data saksi dari foto KTP ada di tab PTSP panel ALETA halaman perkara SIPP.",
  };
  const alatTersedia = (id) => S.alatDaftar.has(id) || (Object.prototype.hasOwnProperty.call(ALAT_MASSAL, id) && typeof S.massal === "function");
  /** Alat yang menulis ke ABT/SIPP/e-Court atau mencatat kemajuan perkara: mati pada mode Tes putusan. */
  const ALAT_MENULIS = new Set(["unggah", "massal:unggah", "massal:bas", "massal:rel", "konseptor", "kasir:otomatis", "ptsp:dataumum", "ptsp:ktp"]);
  function jalankanAlat(id) {
    tutupFloat();
    if (tesAktif() && ALAT_MENULIS.has(id)) return toast("Alat ini menulis atau mencatat; dimatikan pada mode Tes putusan.");
    const fn = S.alatDaftar.get(id);
    if (typeof fn === "function") {
      try {
        fn({ perkara: perkaraTerpilih(), sidangKe: S.sidIdx });
      } catch (e) {
        toast(`Alat gagal dijalankan: ${String((e && e.message) || e)}`);
      }
      return;
    }
    if (Object.prototype.hasOwnProperty.call(ALAT_MASSAL, id) && typeof S.massal === "function") return void bukaMassal(ALAT_MASSAL[id]);
    const nama = (Object.values(ALAT).flat().find((x) => x[0] === id) || [id, id])[1];
    if (ALAT_DI_SIPP[id]) return toast(`${nama} belum ada di tampilan ini. ${ALAT_DI_SIPP[id]}`);
    toast(`${nama} belum tersedia di tampilan ini (menyusul).`);
  }

  // ── Peristiwa ─────────────────────────────────────────────────────────────
  function ubahSaklar(kunciCfg, nilai) {
    const peta = { bawaan: K.bawaan, tawar: K.tawar, saran: K.saran, ingat: K.ingat, tjJawab: K.tjJawab, isiOto: K.isiOto, siapNaskah: K.siapNaskah, pratinjau: K.pratinjau, gembok: K.gembok };
    if (!peta[kunciCfg]) return;
    S.cfg[kunciCfg] = Boolean(nilai);
    void tulisPenyimpanan({ [peta[kunciCfg]]: Boolean(nilai) });
    if (kunciCfg === "tawar") segarkanTawar();
  }

  function saatKlik(e) {
    const t = e.target;
    const c = (s) => t.closest && t.closest(s);
    if (!c("#bd-widget,#bd-widget-btn") && S.floatBuka === "widget") tutupFloat();
    if (!c("#bd-alat,#bd-alat-btn") && S.floatBuka === "alat") tutupFloat();
    // Keterangan fitur: klik sekali = keterangan singkat; papan ketik (Enter/Spasi, detail 0) = pop-up penjelasan.
    const ket = c("[data-infoket]");
    if (ket) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const id = ket.getAttribute("data-infoket");
      if (!e.detail) return void bukaKeterangan(id, ket);
      const k = KETERANGAN[id];
      return k ? toast(`${k.singkat} Klik dua kali ikon ⓘ untuk penjelasan lengkap.`) : undefined;
    }
    if (t.id === "bd-ketpop") return void tutupKeterangan();
    const aksi = c("[data-bd]");
    const kode = aksi ? aksi.getAttribute("data-bd") : "";
    if (kode === "tutupket") return void tutupKeterangan();
    if (kode === "keabt") return tutup();
    if (kode === "widget") return alihkanFloat("widget");
    if (kode === "alat") return alihkanFloat("alat");
    if (kode === "ganti") return gantiPerkara();
    if (kode === "massal") return void bukaMassal();
    if (kode === "coba") return void muatDaftar(true);
    if (kode === "tescari") return void cariTes();
    const tesPk = c("[data-tespk]");
    if (tesPk) return pilihAcuanTes(tesPk.getAttribute("data-tespk"));
    if (kode === "arah") {
      S.arah = -S.arah;
      simpanPref();
      return renderPerkara();
    }
    if (kode === "rentang") {
      // Cukup SATU tanggal (DARI atau SAMPAI) = satu hari; terbalik ditukar; keduanya kosong = petunjuk, bukan galat.
      const r = rentangDari(cari("#bd-dari", akar).value, cari("#bd-sampai", akar).value);
      if (!r) return toast("Pilih tanggal dulu - cukup satu tanggal untuk melihat satu hari.");
      S.dari = r.dari;
      S.sampai = r.sampai;
      return void muatDaftar();
    }
    if (kode === "tanggal") {
      const t = isoTanggalRentang(cari("#bd-tgl", akar).value);
      if (!t) return toast("Pilih satu tanggal dulu.");
      S.tgl = t;
      return void muatDaftar();
    }
    if (kode === "tampil-selesai") {
      S.sembunyiSelesai = false;
      simpanPref();
      return renderPerkara();
    }
    if (kode === "tampil-konsep") {
      S.tampilKonsep = true;
      simpanPref();
      return renderPerkara();
    }
    const alat = c("[data-alat]");
    if (alat) return jalankanAlat(alat.getAttribute("data-alat"));
    const mode = c("[data-mode]");
    if (mode) return gantiMode(mode.getAttribute("data-mode"));
    const lihat = c("[data-lihat]");
    if (lihat) {
      S.lihat = lihat.getAttribute("data-lihat");
      simpanPref();
      return renderPerkara();
    }
    const kol = c("[data-urutkol]");
    if (kol) {
      const k = kol.getAttribute("data-urutkol");
      if (S.urut === k) S.arah = -S.arah;
      else {
        S.urut = k;
        S.arah = ARAH_ALAMI[k] || 1;
      }
      simpanPref();
      return renderPerkara();
    }
    const isiLencana = c("[data-isian]");
    if (isiLencana) return bukaIsianPerkara(isiLencana.getAttribute("data-isian"));
    const pk = c("[data-pk]");
    if (pk) return pilihPerkara(pk.getAttribute("data-pk"));
  }

  function gantiMode(mode) {
    if (!["hari", "tanggal", "rentang", "semua"].includes(mode)) return;
    S.mode = mode;
    simpanPref();
    if (mode === "tanggal") {
      // Satu tanggal: bawaannya hari ini (atau tanggal terakhir yang dipilih) dan langsung dimuat.
      if (!isoTanggalRentang(S.tgl)) S.tgl = hariIni();
    }
    if (mode === "rentang") {
      if (!S.dari) S.dari = hariIni();
      if (!S.sampai) S.sampai = tambah(S.dari, 6);
      // Rentang baru dimuat setelah "Tampilkan"; sebelum itu tampilkan isian tanggalnya saja.
      const simpan = singgah.get(kunciPermintaan());
      if (simpan) {
        S.data = simpan.data;
        S.galat = "";
        return renderPerkara();
      }
      S.data = null;
      S.galat = "";
      S.memuat = false;
      return renderPerkara();
    }
    void muatDaftar();
  }

  function saatKlikDua(e) {
    const t = e.target;
    const ket = t.closest && t.closest("[data-infoket]");
    if (ket) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return void bukaKeterangan(ket.getAttribute("data-infoket"), ket);
    }
    if (t.closest && t.closest("#bd-pkringkas .bd-no")) gantiPerkara();
  }

  function saatUbah(e) {
    const t = e.target;
    if (t.id === "bd-urut") {
      S.urut = t.value;
      S.arah = ARAH_ALAMI[S.urut] || 1;
      simpanPref();
      return renderPerkara();
    }
    if (t.id === "bd-carijenis") {
      S.cariJenis = JENIS_CARI.some((x) => x[0] === t.value) ? t.value : "semua";
      return renderPerkara();
    }
    if (t.id === "bd-depan") {
      S.depan = t.checked;
      simpanPref();
      return renderPerkara();
    }
    if (t.id === "bd-sembunyi") {
      S.sembunyiSelesai = t.checked;
      simpanPref();
      return renderPerkara();
    }
    if (t.id === "bd-konsep") {
      S.tampilKonsep = t.checked;
      simpanPref();
      return renderPerkara();
    }
    if (t.id === "bd-tgl") {
      // Tanggal yang sah dimuat langsung; tanggal yang belum lengkap (sedang diketik) ditunggu.
      const tgl = isoTanggalRentang(t.value);
      if (!tgl) return;
      S.tgl = tgl;
      return void muatDaftar();
    }
    if (t.hasAttribute && t.hasAttribute("data-ketk")) {
      S.ket[t.getAttribute("data-ketk")] = t.checked;
      simpanPref();
      return renderPerkara();
    }
    if (t.id === "bd-sidang") {
      S.sidIdx = Number(t.value) || 0;
      renderSemua();
      return umumkanPerkara();
    }
    if (t.id === "bd-tes") return aturTes(t.checked);
    if (t.id === "bd-pertama") {
      S.ptspPertama = Boolean(t.checked);
      S.data = null;
      return void muatDaftar();
    }
    if (t.id === "bd-lihat") {
      const [peran, ...nama] = String(t.value || "").split("|");
      S.sebagai = t.value ? { peran, nama: nama.join("|") } : { peran: "", nama: "" };
      S.pk = null;
      S.data = null;
      // Perkara dilepas: tahap pilih blangko harus tahu (tanpa ini blangko BAS milik peran lama tetap terpilih di peran baru).
      umumkanPerkara();
      return void muatDaftar();
    }
    if (t.hasAttribute && t.hasAttribute("data-cfg")) return ubahSaklar(t.getAttribute("data-cfg"), t.checked);
    if (t.hasAttribute && t.hasAttribute("data-cfgukuran")) {
      S.ukuran = Object.prototype.hasOwnProperty.call(UKURAN, t.value) ? t.value : "biasa";
      terapkanSkala();
      susunUlangFloat();
      void tulisPenyimpanan({ [K.ukuran]: S.ukuran });
      return;
    }
    if (t.hasAttribute && t.hasAttribute("data-cfgtema")) {
      const pusat = pusatTema();
      if (pusat) {
        // Pusat memasang penanda halaman, menyimpan, dan mengabarkan kembali;
        // pendengar di bawah menyegarkan tampilan ini.
        pusat.pilih(t.value);
      } else {
        S.tema = t.value === "terang" ? "terang" : "gelap";
        terapkanTema();
        void tulisPenyimpanan({ [K.tema]: S.tema });
      }
    }
  }
  function saatMasuk(e) {
    const t = e.target;
    if (t.id === "bd-tescari") {
      S.tesCari.kata = t.value;
      return;
    }
    if (t.id === "bd-cari") {
      S.cariNomor = t.value;
      renderPerkara();
      // PTSP: hasil datang dari server (nomor satker), ditunda sebentar selagi mengetik.
      if (ptspCari()) {
        clearTimeout(saatMasuk.h);
        saatMasuk.h = setTimeout(() => void muatDaftar(false), 450);
      }
    }
  }

  // Kartu tawaran ada di luar akar: pendengarnya sendiri.
  function saatKlikDokumen(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const acc = t.closest("#navbar .accordion");
    if (acc && acc === tombolDerry()) {
      if (S.siapa) buka();
      else
        void muatSiapa().then(() => {
          if (S.siapa) buka();
        });
      return;
    }
    const d = t.closest(`#${ID_TAWAR} [data-bd]`);
    if (!d) return;
    const kode = d.getAttribute("data-bd");
    if (kode === "tawar-aktif") buka();
    else if (kode === "tawar-nanti") {
      sesi(SESI_NANTI, "1");
      segarkanTawar();
    } else if (kode === "tawar-jangan") {
      ubahSaklar("tawar", false);
      sesi(SESI_NANTI, "1");
      segarkanTawar();
    }
  }

  function saatPenyimpananBerubah(ubah, wilayah) {
    if (wilayah !== "local" || !ubah) return;
    const s = {};
    let berubah = false;
    for (const k of [K.bawaan, K.tawar, K.saran, K.ingat, K.tjJawab, K.isiOto, K.siapNaskah, K.pratinjau, K.gembok, K.tema, K.ukuran]) {
      if (ubah[k]) {
        berubah = true;
        s[k] = ubah[k].newValue;
      }
    }
    if (berubah) {
      const lama = { ...S.cfg };
      const dasar = {
        [K.bawaan]: S.cfg.bawaan,
        [K.tawar]: S.cfg.tawar,
        [K.saran]: S.cfg.saran,
        [K.ingat]: S.cfg.ingat,
        [K.tjJawab]: S.cfg.tjJawab,
        [K.isiOto]: S.cfg.isiOto,
        [K.siapNaskah]: S.cfg.siapNaskah,
        [K.pratinjau]: S.cfg.pratinjau,
        [K.gembok]: S.cfg.gembok,
        [K.tesPutusan]: S.cfg.tesPutusan,
        [K.tema]: S.tema,
        [K.ukuran]: S.ukuran,
      };
      const tesLama = tesAktif();
      terapkanSetelan({ ...dasar, ...s });
      terapkanTema();
      if (tesLama !== tesAktif()) {
        renderSemua();
        umumkanPerkara();
      }
      terapkanSkala();
      if (lama.tawar !== S.cfg.tawar) segarkanTawar();
      const w = akar && cari("#bd-widget", akar);
      if (w && !w.hidden) w.innerHTML = isiWidget();
    }
    if (ubah[K.aktif] && ubah[K.aktif].newValue === false) {
      tutup();
      if (tawar) {
        tawar.remove();
        tawar = null;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan
  // ──────────────────────────────────────────────────────────────────────────
  function otomatisBuka() {
    if (!S.cfg.bawaan || S.aktif || sesi(SESI_LAMA) === "1") return false;
    if (!tombolDerry() || !S.siapa) return false;
    if (!berhakDaftar()) return false;
    // Grup lain yang sedang dibuka (ABT lama / grup lain) tidak digantikan.
    return derryAktifDiHalaman() || !grupLainAktif();
  }

  async function siap() {
    await muatSiapa();
    if (S.tautan) {
      if (berhakDaftar() && tombolDerry()) {
        // Tautan Jadwal Sidang: tampilan terbuka sendiri dan daftar mencakup rentang lebar (sidang lampau/mendatang terjangkau).
        S.mode = "semua";
        if (ptspCari()) S.cariNomor = S.tautan.nomor;
        buka();
        return;
      }
      S.tautan = null;
    }
    if (otomatisBuka()) buka();
    else segarkanTawar();
  }

  async function mulai() {
    try {
      if (!/\/aps_badilag\//i.test(String(location.pathname || ""))) return;
      const nyala = await muatSetelan();
      if (!nyala) return;
      S.nyala = true;
      if (/^#bd=/i.test(String(location.hash || ""))) {
        S.tautan = bacaTautanBd(location.hash);
        // Dihapus dari alamat supaya muat ulang tidak mengulang (rusak atau tidak, tanpa pesan teknis).
        try {
          history.replaceState(history.state, "", `${location.pathname}${location.search}`);
        } catch {
          /* alamat tidak dapat diubah: tautan tetap dibaca sekali */
        }
      }
      document.addEventListener("click", saatKlikDokumen, true);
      try {
        chrome.storage.onChanged.addListener(saatPenyimpananBerubah);
      } catch {
        /* di luar konteks ekstensi */
      }
      if (pusatTema()) {
        pusatTema().dengar((kabar) => {
          const baru = kabar.resolusi === "terang" ? "terang" : "gelap";
          if (baru === S.tema) return;
          S.tema = baru;
          terapkanTema();
        });
      }
      if (tombolDerry()) return void siap();
      // Bilah kiri ABT belum ada (halaman lain, atau belum tergambar): menunggu sebentar.
      if (typeof MutationObserver === "function" && document.body) {
        const batas = setTimeout(() => pengamat && pengamat.disconnect(), 10000);
        pengamat = new (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.Pengamat : MutationObserver)(() => {
          try {
            if (!tombolDerry()) return;
            pengamat.disconnect();
            clearTimeout(batas);
            void siap();
          } catch {
            /* halaman sudah ditutup */
          }
        });
        pengamat.observe(document.body, { childList: true, subtree: true });
      }
    } catch {
      /* tampilan ini tambahan: kegagalannya tidak boleh mengganggu ABT */
    }
  }

  const api = {
    versi: "tahap-C-G",
    buka,
    tutup,
    mulai,
    muatDaftar,
    pilihPerkara,
    gantiPerkara,
    toast,
    adm,
    peranDokumen,
    /** Kunci peran yang berlaku (admin: peran yang dilihat); pilihan blangko dikunci padanya. */
    peranKunci,
    /** Jenis dokumen (put/bas/rel) yang boleh dibuka & ditulis sekarang - "Lihat sebagai" ikut membatasi. */
    jenisDokumen,
    /** Kelompok menu Blangko Derry { nama, jenis } boleh tampil/dibuka/ditulis sekarang? */
    kelompokBoleh: (k) => (tesAktif() ? Boolean(k) : kelompokBoleh(k, bahanHak())),
    /** 22 Okt: Tes putusan menyala (Super Admin)? Jalur tulis di blangko-derry-isian.js dan alat lain mati bila benar. */
    tesPutusan: () => tesAktif(),
    muatHak,
    siapa: () => (S.siapa ? { ...S.siapa, sebagai: { ...S.sebagai } } : null),
    /** Tahap F-G sudah mengisi wadah ini: tanda "menyusul" dan isi penampung dihapus. */
    tahapSiap(nama) {
      const w = akar ? cari(`[data-wadah="${nama}"]`, akar) : null;
      if (!w) return false;
      const bagian = w.closest(".bd-tahap");
      if (bagian) {
        bagian.classList.remove("menyusul");
        const chip = bagian.querySelector(".bd-tk .bd-chip");
        if (chip) chip.remove();
      }
      if (w.classList.contains("bd-wadahkosong")) {
        w.classList.remove("bd-wadahkosong");
        w.innerHTML = "";
      }
      return true;
    },
    /** Cetak massal: blangko-derry-massal.js mendaftarkan fungsi pembukanya di sini; tombol "Cetak massal" memanggilnya. */
    pasangMassal(fn) {
      S.massal = typeof fn === "function" ? fn : null;
    },
    bukaMassal,
    /** 29 Okt: ikon (i) keterangan fitur (arahkan = singkat, klik dua kali = pop-up) dan pembuka pop-up-nya; id dari daftar KETERANGAN. */
    ikonKeterangan,
    bukaKeterangan,
    tutupKeterangan,
    keterangan: (id) => (KETERANGAN[id] ? { ...KETERANGAN[id], isi: (KETERANGAN[id].isi || []).slice() } : null),
    /** Akar tampilan (untuk jendela besar Cetak massal); null bila belum dibangun. */
    akar: () => akar,
    /** Peran akun (himpunan peran tampilan: hakim, pp, js, kasir, ptsp, admin). */
    peranAkun: () => Array.from(S.peranSet),
    /** Titik sambung tahap E: fn(ctx) -> [{ berkas, kelompok, jenis, alasan }]. */
    pasangRekomendasi(fn) {
      S.rekomendasi = typeof fn === "function" ? fn : null;
    },
    rekomendasi(ctx) {
      if (!S.rekomendasi) return [];
      try {
        const h = S.rekomendasi(ctx);
        return Array.isArray(h) ? h : [];
      } catch {
        return [];
      }
    },
    /** Tahap F-G melaporkan kelengkapan isian & cetakan satu perkara untuk kartu/daftar. */
    laporIsian(nomor, lapor) {
      if (!nomor) return;
      const bl = lapor && lapor.blangko && lapor.blangko.berkas ? { berkas: String(lapor.blangko.berkas), kelompok: String(lapor.blangko.kelompok || ""), judul: String(lapor.blangko.judul || "") } : null;
      // Langkah Isian = ukuran paling baru dan paling lengkap (isian otomatis ikut): menimpa hasil pengukur latar dan menyegarkan waktunya.
      S.lapor.set(String(nomor), { a: Number(lapor && lapor.a) || 0, t: Number(lapor && lapor.t) || 0, jenis: (lapor && lapor.jenis) || "", dicetak: (lapor && lapor.dicetak) || {}, saat: Date.now(), blangko: bl, sumber: "dibuka", perkiraan: false, kunci: peranKunci() });
      S.ukur.delete(String(nomor));
      simpanSesiUkur();
      if (akar && S.aktif) renderPerkara();
    },
    /** Langkah Isian memasang pengukur satu perkara di latar: fn({ p, s, jenis, ingat }) -> { status: "ok"|"tanpa-blangko"|"galat"|"lewati", a, t, blangko, perkiraan }. */
    pasangPengukur(fn) {
      S.pengukur = typeof fn === "function" ? fn : null;
      if (S.pengukur && akar && S.aktif && !S.pk) renderPerkara();
    },
    /** Uji/alat: atur ukur latar ({ jedaMs, serentak, batas, umurMs }) dan baca keadaannya. */
    aturUkur(o) {
      const x = o || {};
      if (Number.isFinite(x.jedaMs)) UKUR.jedaMs = Math.max(0, x.jedaMs);
      if (Number.isFinite(x.mulaiMs)) UKUR.mulaiMs = Math.max(0, x.mulaiMs);
      if (Number.isFinite(x.serentak)) UKUR.serentak = Math.max(1, Math.floor(x.serentak));
      if (Number.isFinite(x.batas)) UKUR.batas = Math.max(1, Math.floor(x.batas));
      if (Number.isFinite(x.umurMs)) UKUR.umurMs = Math.max(0, x.umurMs);
    },
    ukurKeadaan: () => ({ antre: S.ukurAntre.map((x) => x.nomor), jalan: S.ukurJalan, status: Object.fromEntries(S.ukur), lapor: Object.fromEntries(Array.from(S.lapor, ([k, v]) => [k, { ...v }])), puncak: UKUR.puncak }),
    perkaraTerpilih() {
      const p = perkaraTerpilih();
      if (!p) return null;
      const sid = riwayatPerkara(p);
      return { perkara: p, sidang: sid.slice(), sidangKe: S.sidIdx, sidangDipilih: sid[S.sidIdx] || null };
    },
    setelan: () => ({ ...S.cfg, tema: S.tema }),
    /** Skala tampilan (zoom CSS akar) - elemen melayang tahap F-G membagi koordinat layar dengannya. */
    skala: () => S.skala || 1,
    /** Wadah kosong berlabel untuk tahap E-G. */
    wadah(nama) {
      return akar ? cari(`[data-wadah="${nama}"]`, akar) : null;
    },
    daftarkanAlat(id, fn) {
      S.alatDaftar.set(String(id), fn);
    },
    keadaan: () => ({
      aktif: S.aktif,
      mode: S.mode,
      /** Rentang tanggal daftar (mode tanggal/rentang) - Cetak massal PTSP memulai dari sini; null bila bukan rentang. */
      rentang: rentangMode(),
      ptspDaftar: ptspDaftar(),
      lihat: S.lihat,
      urut: S.urut,
      arah: S.arah,
      pk: S.pk,
      sidIdx: S.sidIdx,
      peran: Array.from(S.peranSet),
      adminAbt: S.adminAbt,
      sebagai: { ...S.sebagai },
      tema: S.tema,
      cfg: { ...S.cfg },
      tes: tesAktif(),
    }),
    murni: { isoTanggalRentang, rentangDari, kunciOrang, satukanOrang, bacaTautanBd, ringkasan, cocokCari, JENIS_CARI, urutkan, indeksAcuan, peranDariGolongan, KUNCI_URUT, ARAH_ALAMI, jenisDokumenBoleh, kelompokBoleh, folderTerbukaUntuk, perkiraanZoom, ikrarJenisBoleh },
  };
  globalThis.aletaBlangkoDerry = api;
  void mulai();
})();
