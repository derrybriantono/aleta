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
  const UMUR_HAK_MS = 5 * 60 * 1000;
  const K = {
    bawaan: "blangkoDerryBawaan",
    tawar: "blangkoDerryTawar",
    saran: "blangkoDerrySaran",
    ingat: "blangkoDerryIngat",
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
  const samaNamaMenu = (a, b) => String(a || "").replace(/\s+/g, " ").trim().toLowerCase() === String(b || "").replace(/\s+/g, " ").trim().toLowerCase();

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

  /** Kelompok (menu) Blangko Derry boleh tampil/dibuka? k = { nama (nama_alias ABT), jenis }. */
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
    if (!jenisDokumenBoleh(o).includes(k.jenis)) return false;
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
    const isiTxt = lap && typeof lap.t === "number" ? (lap.t === 0 ? "Tidak perlu diisi" : lap.a >= lap.t ? "Isian lengkap" : `Terisi ${lap.a} dari ${lap.t}`) : "Isian belum diukur";
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
      isiTxt,
      sisaMinutasi,
    };
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
    cfg: { bawaan: false, tawar: true, saran: true, ingat: true },
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
    dari: "",
    sampai: "",
    lihat: "kartu",
    urut: "prioritas",
    arah: -1,
    depan: true,
    ket: { jenis: true, sidang: true, pihak: true, isian: false, cetak: true, alasan: false, majelis: false, petugas: false },
    cariNomor: "",
    data: null,
    memuat: false,
    galat: "",
    pk: null,
    sidIdx: 0,
    riwayat: new Map(),
    alatDaftar: new Map(),
    lapor: new Map(),
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

  /** Peran yang menentukan dokumen/daftar saat ini. */
  function peranDokumen() {
    if (adm()) return S.sebagai.peran ? [S.sebagai.peran] : ["hakim", "pp", "js"];
    return ["hakim", "pp", "js"].filter((x) => S.peranSet.has(x));
  }
  function peranAlat() {
    if (adm()) return S.sebagai.peran ? [S.sebagai.peran] : ["hakim", "pp", "js", "kasir", "ptsp"];
    return ["hakim", "pp", "js", "kasir", "ptsp"].filter((x) => S.peranSet.has(x));
  }
  const berhakDaftar = () => adm() || ["hakim", "pp", "js", "ptsp"].some((x) => S.peranSet.has(x));
  /** PTSP (bukan admin): tak punya perkara sendiri; mencari nomor perkara satker, baca saja (folder 99 PTSP). */
  const ptspCari = () => !adm() && S.peranSet.has("ptsp");
  const nomorCariPtsp = () => (ptspCari() ? S.cariNomor.trim() : "");
  /** Bahan aturan hak dokumen untuk keadaan sekarang (akun + "Lihat sebagai" + saklar). */
  const bahanHak = () => ({ admin: adm(), sebagaiPeran: adm() ? S.sebagai.peran : "", peran: ["hakim", "pp", "js", "ptsp"].filter((x) => S.peranSet.has(x)), hak: S.hak });
  const jenisDokumen = () => jenisDokumenBoleh(bahanHak());
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
      gembok: s[K.gembok] === true,
    };
    S.tema = s[K.tema] === "terang" ? "terang" : "gelap";
    S.ukuran = Object.prototype.hasOwnProperty.call(UKURAN, s[K.ukuran]) ? s[K.ukuran] : "biasa";
  }
  async function muatSetelan() {
    const s = await bacaPenyimpanan([K.bawaan, K.tawar, K.saran, K.ingat, K.gembok, K.tema, K.daftar, K.aktif, K.ukuran]);
    terapkanSetelan(s);
    const d = s[K.daftar];
    if (d && typeof d === "object") {
      if (["kartu", "ringkas", "tabel", "tanggal"].includes(d.lihat)) S.lihat = d.lihat;
      if (KUNCI_URUT[d.urut]) S.urut = d.urut;
      if (d.arah === 1 || d.arah === -1) S.arah = d.arah;
      if (typeof d.depan === "boolean") S.depan = d.depan;
      if (["hari", "rentang", "semua"].includes(d.mode)) S.mode = d.mode;
      if (d.ket && typeof d.ket === "object") for (const k of Object.keys(S.ket)) if (typeof d.ket[k] === "boolean") S.ket[k] = d.ket[k];
    }
    return s[K.aktif] !== false;
  }
  function simpanPref() {
    void tulisPenyimpanan({ [K.daftar]: { lihat: S.lihat, urut: S.urut, arah: S.arah, depan: S.depan, mode: S.mode, ket: { ...S.ket } } });
  }
  function terapkanTema() {
    for (const e of [akar, tawar]) if (e) e.setAttribute("data-tema", S.tema);
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
      `<span class="bd-lihatwrap" id="bd-lihatwrap" hidden><label for="bd-lihat">Lihat sebagai</label><select id="bd-lihat" aria-label="Lihat sebagai akun"></select></span></div>` +
      `<div class="bd-baris"><button type="button" class="bd-btn kecil" id="bd-alat-btn" data-bd="alat" aria-expanded="false" aria-controls="bd-alat">Alat saya ▾</button>` +
      `<button type="button" class="bd-btn kecil" id="bd-widget-btn" data-bd="widget" aria-expanded="false" aria-controls="bd-widget" title="Pengaturan ALETA untuk tampilan ini">Widget ALETA ▾</button>` +
      `<button type="button" class="bd-btn kecil" data-bd="keabt">Tampilan ABT lama</button></div></div>` +
      `<div class="bd-isi">` +
      `<section class="bd-tahap" id="bd-t1"><div class="bd-tk"><span class="bd-tno">1</span><span class="bd-tj">Perkara</span>` +
      `<div class="bd-ringkas" id="bd-pkringkas" hidden></div><button type="button" class="bd-btn kecil" id="bd-ganti" data-bd="ganti" hidden>Ganti perkara</button></div>` +
      `<div id="bd-pkpilih"></div></section>` +
      `<div id="bd-setelah" class="bd-kolom" hidden>` +
      `<section class="bd-tahap bd-sebaris menyusul" id="bd-w-pilih-blangko" data-tahap="E"><div class="bd-tk"><span class="bd-tno">2</span><span class="bd-tj">Blangko</span><span class="bd-chip">menyusul · tahap E</span></div>` +
      `<div class="bd-wadahkosong" data-wadah="pilih-blangko"><b>Pilih blangko</b> akan tampil di sini: jendela dua kolom dengan saran dari keterangan sidang dan peta perkara.<div class="bd-menuderry" id="bd-menuderry"></div></div></section>` +
      `<section class="bd-tahap bd-utama3 menyusul" id="bd-w-perlu-diisi" data-tahap="F"><div class="bd-tk"><span class="bd-tno">3</span><span class="bd-tj">Perlu diisi</span><span class="bd-chip">menyusul · tahap F</span></div>` +
      `<div class="bd-wadahkosong" data-wadah="perlu-diisi"><b>Isian yang perlu diisi tangan</b>, saran samar (Tab), dan tanya jawab saksi akan tampil di sini.</div></section>` +
      `<section class="bd-tahap menyusul" id="bd-w-pratinjau" data-tahap="G"><div class="bd-tk"><span class="bd-tno">4</span><span class="bd-tj">Pratinjau</span><span class="bd-chip">menyusul · tahap G</span></div>` +
      `<div class="bd-wadahkosong" data-wadah="pratinjau"><b>Pratinjau</b> naskah yang dapat disunting langsung akan tampil di sini.</div></section>` +
      `<section class="bd-tahap menyusul" id="bd-w-cetak" data-tahap="G"><div class="bd-tk"><span class="bd-tno">5</span><span class="bd-tj">Cetak</span><span class="bd-chip">menyusul · tahap G</span></div>` +
      `<div class="bd-wadahkosong" data-wadah="cetak"><b>Cetak</b> (RTF, PDF, PDF salinan, unggah e-Doc) akan tampil di sini.</div></section>` +
      `</div></div></div>` +
      `<div class="bd-float" id="bd-widget" hidden role="dialog" aria-label="Pengaturan ALETA"></div>` +
      `<div class="bd-float alat" id="bd-alat" hidden role="menu" aria-label="Alat saya"></div>` +
      `<div class="bd-tip" id="bd-tip" hidden role="tooltip"></div>` +
      `<div class="bd-toast" id="bd-toast" hidden role="status"></div>`;
    document.body.appendChild(akar);
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
      if (e.key === "Escape") {
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

  function sebutAkun() {
    if (!S.siapa) return S.siapaGalat ? "· belum terhubung ke ALETA" : "· memuat akun…";
    // Rancangan v12: hanya nama akun; peran tidak ditulis (sudah tercermin dari Alat saya).
    let t = `· ${S.siapa.nama || "?"}`;
    if (adm() && S.sebagai.nama) t += ` · dilihat sebagai ${S.sebagai.nama}`;
    return t;
  }

  function renderAtas() {
    const siapa = cari("#bd-siapa", akar);
    if (siapa) siapa.textContent = sebutAkun();
    const wrap = cari("#bd-lihatwrap", akar);
    if (!wrap) return;
    wrap.hidden = !adm();
    if (!adm()) return;
    const sel = cari("#bd-lihat", akar);
    const akun = (S.data && S.data.akun) || { hakim: [], pp: [], js: [] };
    const label = S.peranSet.has("admin") ? "Super Admin / Admin" : "Admin";
    sel.innerHTML =
      `<option value="" title="Tampilan ${esc(label)}: semua akun">Semua akun</option>` +
      ["hakim", "pp", "js"]
        .map((p) => `<optgroup label="${esc(NAMA_PERAN[p])}">${(akun[p] || []).map((n) => `<option value="${p}|${esc(n)}">${esc(n)}</option>`).join("")}</optgroup>`)
        .join("");
    const nilai = S.sebagai.nama ? `${S.sebagai.peran}|${S.sebagai.nama}` : "";
    sel.value = nilai;
    if (sel.value !== nilai) {
      // Nama yang dipilih tidak muncul di rentang yang sedang dimuat: tetap ditampilkan.
      const o = document.createElement("option");
      o.value = nilai;
      o.textContent = `${S.sebagai.nama} (${NAMA_PERAN[S.sebagai.peran] || ""})`;
      sel.appendChild(o);
      sel.value = nilai;
    }
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
    const ada = Boolean(S.pk);
    cari("#bd-setelah", akar).hidden = !ada;
  }

  // ── Daftar perkara ────────────────────────────────────────────────────────
  function kunciPermintaan() {
    return [S.mode, S.mode === "rentang" ? S.dari : "", S.mode === "rentang" ? S.sampai : "", S.sebagai.nama, S.sebagai.peran, nomorCariPtsp()].join("|");
  }
  function alamatPermintaan() {
    const q = new URLSearchParams();
    // PTSP mencari di seluruh rentang jadwal satker: nomor yang diketik menentukan hasilnya, bukan tab tanggal.
    q.set("mode", nomorCariPtsp() ? "semua" : S.mode);
    if (nomorCariPtsp()) q.set("nomor", nomorCariPtsp());
    if (!nomorCariPtsp() && S.mode === "rentang") {
      q.set("dari", S.dari);
      q.set("sampai", S.sampai);
    }
    if (adm() && S.sebagai.nama) {
      q.set("sebagai", S.sebagai.nama);
      q.set("peranSebagai", S.sebagai.peran);
    }
    return `${API_PERKARA}?${q.toString()}`;
  }

  async function muatDaftar(paksa) {
    const kunci = kunciPermintaan();
    const simpan = singgah.get(kunci);
    if (!paksa && simpan && Date.now() - simpan.waktu < TTL_DAFTAR_MS) {
      S.data = simpan.data;
      S.galat = "";
      S.memuat = false;
      renderSemua();
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
  }

  function daftarUrut() {
    const data = S.data;
    if (!data) return [];
    const q = S.cariNomor.trim().toLowerCase();
    const ctx = { hariIni: hariIni(), lapor: S.lapor };
    const l = data.perkara.filter((p) => !q || String(p.nomorPerkara).toLowerCase().includes(q)).map((p) => ringkasan(p, ctx));
    return urutkan(l, S.urut, S.arah, S.depan);
  }

  const tipPihak = (n) => `<span class="bd-pihak" data-tipn="${esc(n)}">Para pihak ⓘ</span>`;
  const chipPrio = (r) => `<span class="bd-prio ${r.tingkat}">${TEKS_TINGKAT[r.tingkat]}</span>`;
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

  function kartu(r) {
    const k = S.ket;
    const baris1 = [];
    if (k.jenis) baris1.push(esc(r.p.jenisPerkara));
    if (k.sidang) baris1.push(urusanSidang(r));
    return (
      `<button type="button" class="bd-kpk" role="listitem" data-pk="${esc(r.n)}"><span class="a"><span>${esc(nomorPendek(r.n))}</span>${chipPrio(r)}</span>` +
      (baris1.length ? `<span class="b">${baris1.join(" · ")}</span>` : "") +
      (k.pihak ? `<span class="b">${tipPihak(r.n)}</span>` : "") +
      (k.majelis ? `<span class="b">Ketua: ${esc(namaBersih(pertama(r.p.majelisNama)))}</span>` : "") +
      (k.petugas ? `<span class="b">PP: ${esc(r.p.paniteraNama || "-")} · JS: ${esc(r.p.jurusitaNama || "-")}</span>` : "") +
      (k.isian || k.cetak
        ? `<span class="c">${k.isian ? `<span class="bd-chip">${esc(r.isiTxt)}</span>` : ""}${k.cetak ? `<span class="bd-chip ${r.dokKelas}">${esc(r.dokTxt)}</span>` : ""}</span>`
        : "") +
      (k.alasan ? `<span class="c">${chipAlasan(r, 2)}</span>` : "") +
      `</button>`
    );
  }
  function baris(r, dalamTanggal) {
    return (
      `<button type="button" class="bd-brs" role="listitem" data-pk="${esc(r.n)}"><span class="bd-no">${esc(nomorPendek(r.n))}</span><span>${esc(r.p.jenisPerkara)}</span>` +
      (dalamTanggal ? `<span class="bd-catat bd-potong">${esc(r.s.ket || r.s.agenda || "-")}</span>` : `<span class="bd-catat">${tglS(r.s.tanggal)}</span>`) +
      `${tipPihak(r.n)}<span class="gap"></span><span class="bd-chip">${esc(r.isiTxt)}</span><span class="bd-chip ${r.dokKelas}">${esc(r.dokTxt)}</span>${chipPrio(r)}</button>`
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
            `<tr data-pk="${esc(r.n)}" tabindex="0"><td>${chipPrio(r)}</td><td class="nw"><span style="font-family:var(--mono)">${esc(nomorPendek(r.n))}</span> ${tipPihak(r.n)}</td>` +
            `<td>${potong(r.p.jenisPerkara, 22)}</td><td class="nw">${tglS(r.s.tanggal)}</td><td>${potong(r.s.ket || r.s.agenda, 34)}</td>` +
            `<td><span class="bd-chip">${esc(r.isiTxt)}</span></td><td><span class="bd-chip ${r.dokKelas}">${esc(r.dokTxt)}</span></td>` +
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

  function teksKosong() {
    const d = S.data;
    if (!d) return "";
    if (!d.lihatSemua && !d.adaYangCocok) {
      return `Nama akun Anda (${esc(d.nama || "?")}) tidak ditemukan sebagai majelis, panitera pengganti, atau juru sita pada ${d.mode === "hari" ? "sidang hari ini" : "rentang ini"}. Bila namanya di SIPP ditulis lain, hubungi admin.`;
    }
    if (d.ptspCari) {
      return S.cariNomor.trim()
        ? "Tidak ada perkara satker dengan nomor itu pada jadwal sidang 90 hari lalu sampai 45 hari ke depan."
        : "Ketik sebagian nomor perkara untuk mencari perkara satker (hanya baca; blangko PTSP).";
    }
    if (d.mode === "hari") return "Tidak ada sidang hari ini untuk Anda.";
    return "Tidak ada perkara pada rentang ini.";
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

    const l = S.memuat || S.galat || !S.data ? [] : daftarUrut();
    let isi =
      `<div class="bd-kontrol"><div class="bd-seg" role="tablist" aria-label="Perkara yang ditampilkan">` +
      [
        ["hari", "Sidang hari ini"],
        ["rentang", "Pilih tanggal"],
        ["semua", "Semua perkara saya"],
      ]
        .map(([m, t]) => `<button type="button" role="tab" data-mode="${m}" aria-selected="${S.mode === m}">${t}</button>`)
        .join("") +
      `</div><input class="bd-cari" id="bd-cari" placeholder="cari nomor perkara" aria-label="Cari nomor perkara" value="${esc(S.cariNomor)}"></div>`;
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
      `</div></div>` +
      `<div class="bd-kontrol"><label class="bd-lbl" for="bd-urut">Urutkan</label><select id="bd-urut">` +
      Object.keys(NAMA_URUT)
        .filter((k) => k !== "minutasi" || S.urut === "minutasi")
        .map((k) => `<option value="${k}" ${S.urut === k ? "selected" : ""}>${k === "prioritas" ? "Paling perlu dikerjakan" : NAMA_URUT[k].charAt(0).toUpperCase() + NAMA_URUT[k].slice(1)}</option>`)
        .join("") +
      `</select><button type="button" class="bd-btn kecil" data-bd="arah" aria-label="Balik urutan">${S.arah > 0 ? "Urutan: naik ▲" : "Urutan: turun ▼"}</button>` +
      `<label class="bd-cek"><input type="checkbox" id="bd-depan" ${S.depan ? "checked" : ""}> Yang belum selesai di depan</label></div>`;
    if (S.lihat === "kartu") {
      isi += `<div class="bd-kontrol" id="bd-ketkartu"><span class="bd-lbl">Tampilkan keterangan</span>${KET_KARTU.map(
        ([k, t]) => `<label class="bd-sak"><input type="checkbox" data-ketk="${k}" ${S.ket[k] ? "checked" : ""}><span class="bd-sakbar" aria-hidden="true"></span>${t}</label>`
      ).join("")}</div>`;
    }
    let badan;
    if (S.mode === "rentang" && !S.data && !S.memuat && !S.galat) badan = `<p class="bd-catat">Pilih tanggal mulai dan akhir, lalu tekan Tampilkan.</p>`;
    else if (S.memuat || (!S.data && !S.galat)) badan = `<p class="bd-catat" role="status">Membaca daftar perkara dari SIPP…</p>`;
    else if (S.galat) {
      badan = `<div class="bd-peringatan" role="alert">${esc(S.galat)} <button type="button" class="bd-btn kecil" data-bd="coba">Coba lagi</button></div>`;
    } else if (!l.length) {
      badan =
        `<p class="bd-catat">${teksKosong()}${S.mode === "hari" ? ` <button type="button" class="bd-btn kecil" data-mode="semua">Lihat semua perkara saya</button>` : ""}</p>`;
    } else {
      const wadClass = S.lihat === "kartu" ? "kartu" : S.lihat === "ringkas" ? "ringkas" : "blok";
      let dalam;
      if (S.lihat === "kartu") dalam = l.map(kartu).join("");
      else if (S.lihat === "ringkas") dalam = l.map((r) => baris(r)).join("");
      else if (S.lihat === "tabel") dalam = tabel(l);
      else {
        const grup = {};
        l.forEach((r) => (grup[r.s.tanggal] = grup[r.s.tanggal] || []).push(r));
        dalam = Object.keys(grup)
          .sort((a, b) => Math.abs(selisih(hariIni(), a)) - Math.abs(selisih(hariIni(), b)) || (a < b ? -1 : 1))
          .map((t) => grupTanggal(t, grup[t]))
          .join("");
      }
      badan = `<div class="bd-dpk ${wadClass}" id="bd-dpk" ${S.lihat === "kartu" || S.lihat === "ringkas" ? 'role="list"' : ""}>${dalam}</div>`;
      const peringatan = [];
      if (S.data && S.data.terpotong) peringatan.push("Sebagian sidang di rentang ini mungkin belum tampil (bot membatasi 500 baris per minggu). Persempit tanggalnya.");
      badan +=
        `<p class="bd-catat" id="bd-ketdaftar">${l.length} perkara · ${S.data.mode === "semua" ? "sidang sejak 90 hari lalu sampai 45 hari ke depan" : `${tglS(S.data.dari)}${S.data.dari !== S.data.sampai ? ` s.d. ${tglS(S.data.sampai)}` : ""}`} · diurutkan menurut ${NAMA_URUT[S.urut]}${S.depan ? ", yang belum selesai di depan" : ""}.` +
        `${peringatan.length ? ` ${esc(peringatan.join(" "))}` : ""}</p>`;
    }
    pilih.innerHTML = isi + badan;
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

  function riwayatPerkara(p) {
    const lengkap = S.riwayat.get(p.nomorPerkara);
    return lengkap && lengkap.length ? lengkap : p.sidang;
  }
  function perkaraTerpilih() {
    if (!S.pk || !S.data) return null;
    return S.data.perkara.find((x) => x.nomorPerkara === S.pk) || null;
  }
  function renderRingkasPerkara(wad) {
    const p = perkaraTerpilih();
    if (!p) {
      wad.innerHTML = `<span class="bd-no">${esc(S.pk)}</span>`;
      return;
    }
    const sid = riwayatPerkara(p);
    const r = ringkasan(p, { hariIni: hariIni(), lapor: S.lapor });
    wad.innerHTML =
      `<span class="bd-no" title="Klik dua kali untuk mengganti perkara">${esc(p.nomorPerkara)}</span><span>${esc(p.jenisPerkara)}${p.lewatEcourt ? " · e-Court" : ""}</span>` +
      `<span class="bd-pihak" tabindex="0" data-tipn="${esc(p.nomorPerkara)}">Para pihak ⓘ</span>` +
      `<label class="bd-lbl" for="bd-sidang">Sidang</label><select id="bd-sidang" style="width:min(100%,340px)" title="Sidang yang dipakai blangko">${sid
        .map((s, i) => `<option value="${i}" ${i === S.sidIdx ? "selected" : ""}>Ke-${i + 1} · ${tglS(s.tanggal)} · ${esc(s.agenda || "-")}${s.ket ? ` · ${esc(s.ket)}` : ""}</option>`)
        .join("")}</select>` +
      `<span class="bd-chip ${kelasIsian(r)}">${esc(r.isiTxt)}</span>${r.dokKelas === "ok" ? `<span class="bd-chip ok">${esc(r.dokTxt)}</span>` : ""}`;
  }

  /** Warna lencana isian seperti rancangan: lengkap hijau, sebagian kuning, belum diisi jingga. */
  function kelasIsian(r) {
    const lap = S.lapor.get(r.n);
    if (!lap || typeof lap.t !== "number") return "";
    return lap.t === 0 || lap.a >= lap.t ? "ok" : lap.a ? "sebagian" : "belum";
  }

  // ── Memilih perkara ───────────────────────────────────────────────────────
  function pilihPerkara(nomor) {
    const p = S.data && S.data.perkara.find((x) => x.nomorPerkara === nomor);
    if (!p) return;
    S.pk = nomor;
    S.sidIdx = Math.max(0, indeksAcuan(riwayatPerkara(p), hariIni()));
    sembunyiTip();
    renderSemua();
    umumkanPerkara();
    void muatRiwayatSidang(p);
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
          detail: p ? { nomorPerkara: p.nomorPerkara, perkaraId: p.perkaraId, jenisPerkara: p.jenisPerkara, sidang: sid.slice(), sidangKe: S.sidIdx, sidangDipilih: sid[S.sidIdx] || null, perkara: p } : null,
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
      if (!l.length) return;
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
    const p = S.data && S.data.perkara.find((x) => x.nomorPerkara === n);
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
    pop.style.maxHeight = `${(vh - 16) / z}px`;
    const w = Math.min((pop.offsetWidth || 320) * z, vw - 16);
    const h = Math.min((pop.offsetHeight || 240) * z, vh - 16);
    let left = r.right - w;
    if (left < 8) left = Math.min(r.left, vw - w - 8);
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = r.bottom + 6;
    if (top + h > vh - 8) {
      const atas = r.top - 6 - h;
      top = atas >= 8 ? atas : Math.max(8, vh - 8 - h);
    }
    top = Math.max(8, Math.min(top, vh - 8 - h));
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
    ["tawar", "Tawarkan Blangko ABT by Derry Briantono di ABT biasa", "", ["hakim", "pp", "js"]],
    ["saran", "Saran isian (bayangan, tekan Tab)", "Usulan dari SIPP, gugatan dan riwayat", ["hakim", "pp"]],
    ["ingat", "Ingatkan isian yang masih kosong sebelum cetak", "juga tombol Cetak panel ALETA di ABT biasa", ["hakim", "pp", "js"]],
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
      `<label class="bd-wbaris"><span>Tema<small>popup, panel SIPP, panel ABT, dan Blangko ABT by Derry Briantono</small></span><select data-cfgtema="1" aria-label="Tema"><option value="gelap" ${S.tema === "gelap" ? "selected" : ""}>Gelap</option><option value="terang" ${S.tema === "terang" ? "selected" : ""}>Terang</option></select></label>` +
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
    const sebagai = adm() && S.sebagai.nama ? ` · ${esc(S.sebagai.nama)}` : !adm() && S.siapa ? ` · ${esc(S.siapa.nama || "")}` : "";
    return (
      grup
        .map(
          (g) =>
            `<div class="grup">${esc(NAMA_PERAN[g])}${adm() ? "" : sebagai}</div>` +
            ALAT[g].filter(([id]) => id !== "advance" || alatAdvanceTampil()).map(([id, t]) => `<button type="button" role="menuitem" data-alat="${id}"><span>${esc(t)}</span>${S.alatDaftar.has(id) ? "" : `<span class="bd-chip">menyusul</span>`}</button>`).join("")
        )
        .join("") + (adm() ? `<p class="bd-catat" style="padding:4px 8px">Admin melihat semua peran. Pilih "Lihat sebagai akun" untuk menyempitkan.</p>` : "")
    );
  }
  function jalankanAlat(id) {
    tutupFloat();
    const fn = S.alatDaftar.get(id);
    if (typeof fn === "function") {
      try {
        fn({ perkara: perkaraTerpilih(), sidangKe: S.sidIdx });
      } catch (e) {
        toast(`Alat gagal dijalankan: ${String((e && e.message) || e)}`);
      }
      return;
    }
    const nama = (Object.values(ALAT).flat().find((x) => x[0] === id) || [id, id])[1];
    toast(`${nama}: menyusul pada tahap berikutnya (pilih blangko, isian, cetak).`);
  }

  // ── Peristiwa ─────────────────────────────────────────────────────────────
  function ubahSaklar(kunciCfg, nilai) {
    const peta = { bawaan: K.bawaan, tawar: K.tawar, saran: K.saran, ingat: K.ingat, gembok: K.gembok };
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
    const aksi = c("[data-bd]");
    const kode = aksi ? aksi.getAttribute("data-bd") : "";
    if (kode === "keabt") return tutup();
    if (kode === "widget") return alihkanFloat("widget");
    if (kode === "alat") return alihkanFloat("alat");
    if (kode === "ganti") return gantiPerkara();
    if (kode === "coba") return void muatDaftar(true);
    if (kode === "arah") {
      S.arah = -S.arah;
      simpanPref();
      return renderPerkara();
    }
    if (kode === "rentang") {
      const d = cari("#bd-dari", akar).value;
      const s = cari("#bd-sampai", akar).value || d;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast("Isi tanggal mulai dulu.");
      if (s < d) return toast("Tanggal akhir lebih awal daripada tanggal mulai.");
      S.dari = d;
      S.sampai = s;
      return void muatDaftar();
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
    const pk = c("[data-pk]");
    if (pk) return pilihPerkara(pk.getAttribute("data-pk"));
  }

  function gantiMode(mode) {
    if (!["hari", "rentang", "semua"].includes(mode)) return;
    S.mode = mode;
    simpanPref();
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
    if (t.id === "bd-depan") {
      S.depan = t.checked;
      simpanPref();
      return renderPerkara();
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
    if (t.id === "bd-lihat") {
      const [peran, ...nama] = String(t.value || "").split("|");
      S.sebagai = t.value ? { peran, nama: nama.join("|") } : { peran: "", nama: "" };
      S.pk = null;
      S.data = null;
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
      S.tema = t.value === "terang" ? "terang" : "gelap";
      terapkanTema();
      void tulisPenyimpanan({ [K.tema]: S.tema });
    }
  }
  function saatMasuk(e) {
    const t = e.target;
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
    for (const k of [K.bawaan, K.tawar, K.saran, K.ingat, K.gembok, K.tema, K.ukuran]) {
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
        [K.gembok]: S.cfg.gembok,
        [K.tema]: S.tema,
        [K.ukuran]: S.ukuran,
      };
      terapkanSetelan({ ...dasar, ...s });
      terapkanTema();
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
    if (otomatisBuka()) buka();
    else segarkanTawar();
  }

  async function mulai() {
    try {
      if (!/\/aps_badilag\//i.test(String(location.pathname || ""))) return;
      const nyala = await muatSetelan();
      if (!nyala) return;
      S.nyala = true;
      document.addEventListener("click", saatKlikDokumen, true);
      try {
        chrome.storage.onChanged.addListener(saatPenyimpananBerubah);
      } catch {
        /* di luar konteks ekstensi */
      }
      if (tombolDerry()) return void siap();
      // Bilah kiri ABT belum ada (halaman lain, atau belum tergambar): menunggu sebentar.
      if (typeof MutationObserver === "function" && document.body) {
        const batas = setTimeout(() => pengamat && pengamat.disconnect(), 10000);
        pengamat = new MutationObserver(() => {
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
    /** Jenis dokumen (put/bas/rel) yang boleh dibuka & ditulis sekarang - "Lihat sebagai" ikut membatasi. */
    jenisDokumen,
    /** Kelompok menu Blangko Derry { nama, jenis } boleh tampil/dibuka/ditulis sekarang? */
    kelompokBoleh: (k) => kelompokBoleh(k, bahanHak()),
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
      S.lapor.set(String(nomor), { a: Number(lapor && lapor.a) || 0, t: Number(lapor && lapor.t) || 0, jenis: (lapor && lapor.jenis) || "", dicetak: (lapor && lapor.dicetak) || {} });
      if (akar && S.aktif) renderPerkara();
    },
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
    }),
    murni: { ringkasan, urutkan, indeksAcuan, peranDariGolongan, KUNCI_URUT, ARAH_ALAMI, jenisDokumenBoleh, kelompokBoleh, folderTerbukaUntuk, perkiraanZoom },
  };
  globalThis.aletaBlangkoDerry = api;
  void mulai();
})();
