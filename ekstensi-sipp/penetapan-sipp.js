"use strict";

/**
 * ============================================================================
 * PENETAPAN OTOMATIS DI HALAMAN PERKARA SIPP (20 Okt 2026, butir 4 dan 8)
 * ============================================================================
 *
 * Rancangan yang disetujui: tombol "Penetapan Otomatis" (tebal, PALING KIRI di
 * deretan tombol halaman perkara, sebelum "Buka di ABT" dan "Buka di ALETA"),
 * lalu panel yang TERBENTANG di bawah deretan itu:
 *
 *   - mode Otomatis / Manual (sama dengan papan penetapan di ekstensi);
 *   - empat langkah PMH, PPP, PJS, PHS - pejabat, isi usulan, dan statusnya
 *     (akan ditulis / sudah tercatat - dilewati / menulis / mengunggah e-Doc /
 *     tercatat / gagal beserta sebabnya);
 *   - kotak centang "Unggah e-Doc" per langkah (bawaan tercentang) dan
 *     "Centang semua e-Doc";
 *   - SATU tombol "Tetapkan & unggah e-Doc" dengan konfirmasi di halaman
 *     (bukan window.confirm) yang menyebut berapa penetapan ditulis dan berapa
 *     e-Doc diunggah; lalu berurutan dalam SATU klik: tulis yang belum ada,
 *     kemudian unggah e-Doc yang dicentang; laporan akhir per langkah.
 *
 * TIDAK ADA ATURAN DAN JALAN TULIS BARU. Berkas ini hanya tampilan dan
 * pengurut. Semuanya dipinjam dari konten.js (skrip konten yang sama, lingkup
 * global yang sama, dimuat sebelum berkas ini):
 *
 *   usulan, rencana, pejabat   ambilUsulanPenunjukan -> objek `usulanTerakhir`
 *                              yang SAMA dengan papan di panel ALETA (satu
 *                              sumber keadaan; mengubah di salah satunya
 *                              terbaca di yang lain);
 *   pilihan manual             gambarPenunjukan (bagian rinci papan: majelis,
 *                              panitera, juru sita, hari sidang, sidang
 *                              keliling) dipasang di panel ini TANPA tombol
 *                              menulisnya sendiri;
 *   menulis                    tetapkanLewatAleta -> rantaiPenetapan: uji
 *                              kering lalu satu transaksi utuh-atau-batal,
 *                              dengan kunci per perkara yang dipakai semua
 *                              jalan menulis di halaman (tekanan kedua tidak
 *                              menulis ganda);
 *   mengunggah e-Doc           e6UnggahEdocPenetapan: jalur unggah e-Doc
 *                              penetapan yang sudah ada (cetak blangko ABT,
 *                              tanda tangan + cap, unggah ke e-Doc SIPP).
 *
 * Yang ditulis ke SIPP/ABT tidak pernah memuat kata ALETA (jalur yang
 * dipinjam sudah menjaganya). Teks di layar ini boleh. Tombol dan panel
 * berkelas aleta-sisip (diabaikan pengamat konten.js), semua tombol
 * type="button". Tampil hanya untuk akun yang berhak menulis penetapan
 * (boleh("penunjukan") dan boleh("kerjakan") - Super Admin, Admin, dan yang
 * diberi kewenangannya); tampilan Lama tidak berubah.
 *
 * Bila agen P1 menyediakan satu fungsi "kerjakan penetapan perkara" (kunci
 * server, anti-ganda), cukup ganti isi tulisKePenetapan() di bawah.
 */
(function penetapanSippModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPenetapanSipp) return;

  const KELAS = "aleta-sisip aleta-pensipp";
  const ID_PANEL = "aleta-pensipp-panel";
  const ID_PANEL_UTAMA = "aleta-panel-sipp";
  // 21 Okt 2026 (perbaikan): BAWAAN TERLIPAT di setiap kunjungan; pilihan petugas diingat hanya selama halaman
  // ini terbuka (aturan bersama alatPanelTerbuka/alatIngatPanel, panel-alat.js). Dulu diingat di
  // chrome.storage.local: panel yang sekali dibuka terbuka lagi di setiap perkara sesudahnya.
  const KUNCI_PANEL = "penetapan-otomatis-sipp";
  function terbukaTersimpan(nomor) {
    try {
      return typeof alatPanelTerbuka === "function" ? alatPanelTerbuka(`${KUNCI_PANEL}:${nomor}`) : false;
    } catch {
      return false;
    }
  }
  function ingatTerbuka(nomor, buka) {
    try {
      if (typeof alatIngatPanel === "function") alatIngatPanel(`${KUNCI_PANEL}:${nomor}`, buka);
    } catch {
      /* ingatan lipatan hanya kenyamanan */
    }
  }
  const URUTAN = ["pmh", "ppp", "pjs", "phs"];
  const NAMA = {
    pmh: "Penetapan Majelis Hakim",
    ppp: "Penunjukan Panitera Pengganti",
    pjs: "Penunjukan Juru Sita",
    phs: "Penetapan Hari Sidang",
  };
  const KODE_DARI_LABEL = {
    "Penetapan Majelis Hakim": "pmh",
    "Penunjukan Panitera Pengganti": "ppp",
    "Penunjukan Juru Sita": "pjs",
    "Penetapan Hari Sidang": "phs",
  };
  const STATUS = {
    tunggu: { teks: "akan ditulis", nada: "tunggu" },
    lewat: { teks: "sudah tercatat · dilewati", nada: "lewat" },
    periksa: { teks: "memeriksa…", nada: "jalan" },
    tulis: { teks: "menulis…", nada: "jalan" },
    unggah: { teks: "mengunggah e-Doc…", nada: "jalan" },
    ok: { teks: "tercatat", nada: "ok" },
    selesai: { teks: "tercatat · e-Doc terunggah", nada: "ok" },
    gagal: { teks: "gagal", nada: "salah" },
    ditahan: { teks: "ditahan", nada: "salah" },
    antre: { teks: "diantrekan", nada: "tunggu" },
    "edoc-gagal": { teks: "tercatat · e-Doc gagal", nada: "salah" },
    "edoc-ditahan": { teks: "tercatat · e-Doc tidak dikirim", nada: "salah" },
  };
  const SIBUK = new Set(["periksa", "tulis", "unggah"]);

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu kecil
  // ──────────────────────────────────────────────────────────────────────────
  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
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
  const milikAleta = (n) =>
    Boolean(n && n.nodeType === 1 && typeof n.closest === "function" && n.closest(`.aleta-sisip, #${ID_PANEL_UTAMA}, [data-aleta-tanda], .aleta-panel`));
  const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
  /**
   * Fungsi konten.js (deklarasi tingkat-atas = properti global skrip konten
   * yang sama). Tanpa eval/new Function: CSP ekstensi MV3 melarangnya.
   */
  function fungsi(nama) {
    const f = globalThis[nama];
    return typeof f === "function" ? f : null;
  }
  function panggil(nama, ...arg) {
    const f = fungsi(nama);
    if (!f) throw new Error(`${nama} belum tersedia`);
    return f(...arg);
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
  // ──────────────────────────────────────────────────────────────────────────
  // Hak, nomor, dan letak di halaman
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Hak yang SAMA dengan papan penetapan di ekstensi: boleh("penunjukan")
   * membuka papannya, boleh("kerjakan") menuliskannya. Belum masuk ALETA
   * (pengguna belum terbaca) atau panel digambar dari simpanan (luring) =
   * tombol tidak tampil; boleh() sendiri mematikan kewenangan menulis saat
   * luring.
   */
  function berhak() {
    try {
      if (typeof boleh !== "function") return false;
      if (typeof penggunaTerakhir === "undefined" || !penggunaTerakhir) return false;
      // 21 Okt 2026: HANYA PTSP (termasuk Operator/Petugas Meja), Ketua, Wakil Ketua; Super Admin tetap boleh semua.
      if (typeof alatBolehTombolPenetapanSipp === "function" && alatBolehTombolPenetapanSipp(penggunaTerakhir) !== true) return false;
      return boleh("penunjukan") === true && boleh("kerjakan") === true;
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

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan satu panel
  // ──────────────────────────────────────────────────────────────────────────
  let ctx = null;

  function buatCtx(nomor) {
    return {
      nomor,
      terbuka: false, // 21 Okt: bawaan TERLIPAT; dibuka dengan klik tombol (diingat hanya selama halaman ini terbuka)
      data: null,
      memuat: false,
      galat: "",
      sibuk: false,
      konfirm: null,
      edoc: { pmh: true, ppp: true, pjs: true, phs: true },
      edocPeta: null,
      edocPetaDimuat: false,
      hasil: {},
      laporan: null,
      kabarEdoc: {},
      akar: null,
      rinci: null,
      rinciKotak: null,
      kabarRinci: null,
      dirender: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Membaca keadaan dari papan rinci (satu sumber dengan papan di panel ALETA)
  // ──────────────────────────────────────────────────────────────────────────
  function tercatatDi(data) {
    try {
      return panggil("keadaanPenetapanUsulan", data && data.usulan);
    } catch {
      return { pmh: "", ppp: "", pjs: "", phs: "" };
    }
  }

  /** Satu langkah dibaca dari baris papan rinci; null bila belum tergambar. */
  function bacaBaris(jenis) {
    const rinci = ctx && ctx.rinci;
    if (!rinci) return null;
    const baris = Array.from(rinci.querySelectorAll(".aleta-tetap")).find((b) => {
      if (b.closest(".aleta-tetap-pejabat-baris")) return false;
      const label = b.querySelector(".aleta-tetap-label");
      return label && KODE_DARI_LABEL[sebaris(label.textContent)] === jenis;
    });
    if (!baris) return null;
    const nilai = baris.querySelector(".aleta-tetap-isi, .aleta-tetap-kosong");
    const sebab = baris.querySelector(".aleta-tetap-sebab");
    const awas = baris.querySelector(".aleta-tetap-awas");
    const penetap = baris.querySelector(".aleta-tetap-penetap");
    return {
      isi: nilai ? sebaris(nilai.textContent) : "",
      kosong: Boolean(nilai && nilai.classList.contains("aleta-tetap-kosong")),
      tercatat: Boolean(nilai && nilai.classList.contains("aleta-tetap-tercatat")),
      sebab: sebab ? sebaris(sebab.textContent) : "",
      awas: awas ? sebaris(awas.textContent) : "",
      penetap: penetap ? sebaris(penetap.textContent).replace(/\s*▾\s*$/, "").replace(/ \(akun [^)]*\)/g, "") : "",
    };
  }

  function awasLibur() {
    const b = bacaBaris("phs");
    return b && /hari libur|hari Sabtu|hari Minggu/.test(b.awas) ? b.awas : "";
  }

  function statusDasar(jenis, baris) {
    if (baris && baris.tercatat) return "lewat";
    return "tunggu";
  }
  function statusDari(jenis) {
    const h = ctx.hasil[jenis];
    if (h && h.kode) return h.kode;
    return statusDasar(jenis, bacaBaris(jenis));
  }

  function sisaTulis() {
    if (!ctx.data || !ctx.data.usulan) return [];
    try {
      return panggil("langkahSisaPenetapan", ctx.data.usulan);
    } catch {
      return [];
    }
  }

  function sudahEdoc(jenis) {
    if (!ctx.edocPeta) return false;
    try {
      return panggil("b7SudahDariPeta", ctx.edocPeta, [jenis.toUpperCase()]).length > 0;
    } catch {
      return false;
    }
  }

  function rencanaKerja() {
    const sisa = sisaTulis();
    const edoc = URUTAN.filter((j) => ctx.edoc[j]);
    const tercatat = tercatatDi(ctx.data);
    const menimpa = edoc.filter((j) => tercatat[j] && sudahEdoc(j));
    return { tulis: sisa.length, sisa, edoc: edoc.length, jenisEdoc: edoc, menimpa: menimpa.length };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Memuat usulan
  // ──────────────────────────────────────────────────────────────────────────
  function usulanBersama() {
    // `usulanTerakhir` ialah let tingkat-atas konten.js (bukan properti global).
    return typeof usulanTerakhir !== "undefined" ? usulanTerakhir : null;
  }

  function dataBersama() {
    const d = usulanBersama();
    return d && d.usulan && d.usulan.ok !== false && String(d.nomorPerkara || "") === ctx.nomor ? d : null;
  }

  function simpanBersama(data) {
    try {
      // Dapat ditulis dari skrip konten yang sama; papan di panel ALETA lalu
      // memegang objek yang SAMA dengan panel ini.
      if (typeof usulanTerakhir !== "undefined") usulanTerakhir = data;
    } catch {
      /* papan di panel ALETA tidak ikut terbarui; panel ini tetap bekerja */
    }
  }

  async function muat() {
    if (!ctx || ctx.memuat) return;
    ctx.memuat = true;
    ctx.galat = "";
    render();
    try {
      let data = dataBersama();
      if (!data) {
        data = await panggil("ambilUsulanPenunjukan", ctx.nomor);
        data.nomorPerkara = ctx.nomor;
        simpanBersama(data);
      }
      ctx.data = data;
      gambarRinci();
      void muatPetaEdoc();
    } catch (galat) {
      ctx.galat = String((galat && galat.message) || galat).slice(0, 200);
    } finally {
      ctx.memuat = false;
      render();
    }
  }

  function gambarRinci() {
    const r = ctx.rinci;
    if (!r || !ctx.data) return;
    r.textContent = "";
    try {
      panggil("gambarPenunjukan", r, ctx.data);
    } catch (galat) {
      ctx.galat = String((galat && galat.message) || galat).slice(0, 200);
    }
  }

  /** e-Doc yang sudah terunggah: dibaca sekali begitu ada penetapan tercatat. */
  async function muatPetaEdoc() {
    if (ctx.edocPetaDimuat || !ctx.data) return;
    const t = tercatatDi(ctx.data);
    if (!URUTAN.some((j) => t[j])) return;
    ctx.edocPetaDimuat = true;
    try {
      const alamat = typeof S2_API_EDOC_PETA !== "undefined" ? S2_API_EDOC_PETA : "";
      if (!alamat) return;
      const j = await panggil("t7AmbilJson", `${alamat}?nomor=${encodeURIComponent(ctx.nomor)}`, "Membaca e-Doc penetapan");
      if (j && j.ok) {
        ctx.edocPeta = panggil("s2BacaPetaEdoc", j.data);
        render();
      }
    } catch {
      /* chip "e-Doc sudah ada" hanya pelengkap */
    }
  }

  /** Mode Otomatis/Manual = saklar papan rinci yang sama (satu aturan, bukan salinan). */
  function setCara(nilai) {
    if (!ctx || ctx.sibuk || !ctx.rinci) return;
    const pil = Array.from(ctx.rinci.querySelectorAll(".aleta-saklar-pil")).find((b) => sebaris(b.textContent).toLowerCase() === nilai);
    if (pil && !pil.classList.contains("aleta-saklar-aktif")) pil.click();
  }
  function caraSekarang() {
    const d = ctx && ctx.data;
    if (!d) return "otomatis";
    return d.caraPapan || (d.bolehOtomatis ? "otomatis" : "manual");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Menggambar
  // ──────────────────────────────────────────────────────────────────────────
  let jedaRender = null;
  function jadwalRender() {
    if (jedaRender) return;
    jedaRender = setTimeout(() => {
      jedaRender = null;
      render();
    }, 40);
  }

  function buatKerangka() {
    const akar = el("section", `${KELAS} aleta-pensipp-panel`);
    akar.id = ID_PANEL;
    akar.setAttribute("role", "region");
    akar.setAttribute("aria-label", "Penetapan Otomatis");
    akar.setAttribute("data-pensipp", "panel");

    const kepala = el("div", "aleta-pensipp-kepala");
    const judul = el("div", "aleta-pensipp-judul-wadah");
    const h = el("h2", "aleta-pensipp-judul");
    h.append("Penetapan Otomatis · ", el("span", "aleta-pensipp-mono", ctx.nomor));
    judul.append(h, el("div", "aleta-pensipp-catatan", "Atas akun pejabat berwenang · sama dengan mode penetapan di ekstensi ALETA"));
    // Ringkasan di samping judul: beban usulan + perkara diterima 30 hari terakhir (dari usulan.statistik).
    const ringkasBeban = el("div", "aleta-pensipp-beban-ringkas");
    ringkasBeban.setAttribute("data-pensipp", "beban-ringkas");
    ringkasBeban.hidden = true;
    judul.append(ringkasBeban);
    const mode = el("div", "aleta-pensipp-mode");
    mode.setAttribute("role", "group");
    mode.setAttribute("aria-label", "Mode");
    for (const [nilai, label] of [
      ["otomatis", "Otomatis"],
      ["manual", "Manual"],
    ]) {
      const b = tombol(label, "aleta-pensipp-mode-pil");
      b.setAttribute("data-pensipp-mode", nilai);
      b.addEventListener("click", () => {
        setCara(nilai);
        render();
      });
      mode.appendChild(b);
    }
    kepala.append(judul, mode);

    const badan = el("div", "aleta-pensipp-badan");
    const info = el("div", "aleta-pensipp-info");
    info.setAttribute("aria-live", "polite");
    const konfirm = el("div", "aleta-pensipp-konfirm-wadah");
    const daftar = el("div", "aleta-pensipp-daftar");
    const rinciKotak = el("details", "aleta-pensipp-rinci-kotak");
    const ringkasRinci = el("summary", "aleta-pensipp-rinci-ringkas", "Pilihan lain");
    const rinci = el("div", "aleta-pensipp-rinci");
    rinci.setAttribute("data-aleta-tanpa-kaki", "1");
    rinciKotak.append(ringkasRinci, rinci);
    // Beban penetapan & SK (B1): blok yang sama dengan papan ekstensi, dari
    // usulan.statistik (penunjukan-statistik.js). Terbentang bawaannya.
    const beban = el("div", "aleta-pensipp-beban");
    beban.setAttribute("data-pensipp", "beban");
    badan.append(info, konfirm, daftar);

    const kaki = el("div", "aleta-pensipp-kaki");
    const ringkas = el("div", "aleta-pensipp-ringkas");
    ringkas.setAttribute("aria-live", "polite");
    const aksi = el("div", "aleta-pensipp-aksi");
    const semuaLabel = el("label", "aleta-pensipp-semua");
    const semua = document.createElement("input");
    semua.type = "checkbox";
    semua.setAttribute("data-pensipp", "semua");
    semua.addEventListener("change", () => {
      for (const j of URUTAN) ctx.edoc[j] = semua.checked;
      render();
    });
    semuaLabel.append(semua, " Centang semua e-Doc");
    const utama = tombol("Tetapkan & unggah e-Doc", "aleta-pensipp-utama");
    utama.setAttribute("data-pensipp", "utama");
    utama.addEventListener("click", () => mintaKonfirmasi());
    aksi.append(semuaLabel, utama);
    kaki.append(ringkas, aksi);

    const laporan = el("div", "aleta-pensipp-laporan");
    laporan.setAttribute("aria-live", "polite");
    laporan.setAttribute("data-pensipp", "laporan");

    const kabarRinci = el("div", "aleta-pensipp-tersembunyi");
    kabarRinci.hidden = true;

    // Kotak hitung mundur muat ulang (muat-ulang-sipp.js): di luar render(), tidak ikut terhapus.
    const wadahMuatUlang = el("div", "aleta-pensipp-muatulang");
    wadahMuatUlang.setAttribute("data-pensipp", "muat-ulang");
    // Urutan: daftar PMH/PPP/PJS/PHS -> centang semua & Tetapkan (kaki) -> laporan -> BARU rincian beban dan pilihan lain.
    const tambahan = el("div", "aleta-pensipp-tambahan");
    tambahan.append(beban, rinciKotak);
    akar.append(kepala, badan, kaki, laporan, wadahMuatUlang, tambahan, kabarRinci);
    ctx.wadahMuatUlang = wadahMuatUlang;
    ctx.akar = akar;
    ctx.rinci = rinci;
    ctx.beban = beban;
    ctx.bebanRingkas = ringkasBeban;
    ctx.rinciKotak = rinciKotak;
    ctx.kabarRinci = kabarRinci;
    new MutationObserver(() => jadwalRender()).observe(rinci, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "disabled"] });
    return akar;
  }

  function render() {
    if (!ctx || !ctx.akar) return;
    const akar = ctx.akar;
    ctx.dirender = true;
    // Perubahan data yang datang dari papan rinci sendiri bukan perubahan dari
    // tempat lain: sinkron() tidak perlu menggambar ulang papan rinci karenanya.
    tandaTerakhir = tandaData();
    const q = (s) => akar.querySelector(s);
    const sibuk = ctx.sibuk;

    // Mode
    const cara = caraSekarang();
    for (const b of akar.querySelectorAll("[data-pensipp-mode]")) {
      b.setAttribute("aria-pressed", b.getAttribute("data-pensipp-mode") === cara ? "true" : "false");
      b.disabled = sibuk || !ctx.data;
    }
    // Pilihan manual terbuka di mode manual; di otomatis tersedia terlipat.
    const rk = ctx.rinciKotak;
    const sedangManual = cara === "manual";
    if (rk.getAttribute("data-cara") !== cara) {
      rk.setAttribute("data-cara", cara);
      rk.open = sedangManual;
      q(".aleta-pensipp-rinci-ringkas").textContent = sedangManual ? "Pilihan manual: majelis, panitera, juru sita, hari sidang" : "Ubah pilihan: majelis, sidang keliling";
    }
    rk.hidden = !ctx.data;

    // Beban penetapan & SK: digambar ulang hanya bila usulannya (statistik)
    // berganti, supaya lipatan yang dibuka petugas tidak menutup sendiri.
    if (ctx.beban) {
      const stat = ctx.data && ctx.data.usulan ? ctx.data.usulan.statistik : null;
      const kes = ctx.data && ctx.data.usulan ? ctx.data.usulan.kesesuaianSk : null;
      if (ctx.bebanTanda !== stat || ctx.bebanKes !== kes) {
        const bukaLama = ctx.beban.querySelector("[data-bebanstat]");
        // Bawaan TERLIPAT; yang dibuka petugas tetap terbuka selama usulannya tidak berganti.
        const terbuka = bukaLama ? bukaLama.open : false;
        ctx.bebanTanda = stat;
        ctx.bebanKes = kes;
        ctx.beban.textContent = "";
        if (stat && globalThis.aletaPenunjukanStatistik) {
          try {
            globalThis.aletaPenunjukanStatistik.tempelDi(ctx.beban, ctx.data.usulan, { terbuka });
          } catch {
            /* tambahan saja */
          }
        }
      }
    }

    // Ringkasan beban di samping judul (satu baris; rinciannya di bagian "Beban penetapan" di bawah).
    if (ctx.bebanRingkas) {
      const mod = globalThis.aletaPenunjukanStatistik;
      const r = mod && ctx.data && ctx.data.usulan && typeof mod.ringkasBeban === "function" ? mod.ringkasBeban(ctx.data.usulan) : { beban: "", diterima: "" };
      ctx.bebanRingkas.textContent = "";
      if (r.beban) ctx.bebanRingkas.append(el("span", "aleta-pensipp-beban-bagian", r.beban));
      if (r.diterima) ctx.bebanRingkas.append(el("span", "aleta-pensipp-beban-bagian aleta-pensipp-beban-diterima", r.diterima));
      ctx.bebanRingkas.hidden = !(r.beban || r.diterima);
    }

    // Info / galat / mode latihan
    const info = q(".aleta-pensipp-info");
    info.textContent = "";
    info.className = "aleta-pensipp-info";
    const adaBaris = URUTAN.some((j) => bacaBaris(j));
    if (ctx.memuat && !ctx.data) {
      info.textContent = "Menyusun usulan…";
    } else if (ctx.galat) {
      info.classList.add("aleta-pensipp-info-salah");
      info.textContent = ctx.galat;
      const ulang = tombol("Coba lagi", "aleta-pensipp-kecil");
      ulang.addEventListener("click", () => {
        ctx.galat = "";
        ctx.data = null;
        void muat();
      });
      info.append(" ", ulang);
    } else if (ctx.data && !adaBaris) {
      info.classList.add("aleta-pensipp-info-salah");
      info.textContent = "Usulan penetapan belum dapat disusun untuk perkara ini.";
    } else {
      let latihan = "";
      try {
        if (typeof alatLatihanNyala === "function" && alatLatihanNyala()) latihan = "Mode latihan menyala - tidak ada yang tersimpan ke SIPP.";
        else if (typeof alatKeringNyala === "function" && alatKeringNyala()) latihan = "Mode uji menyala - tidak ada yang tersimpan ke SIPP.";
      } catch {
        latihan = "";
      }
      if (latihan) {
        info.classList.add("aleta-pensipp-info-awas");
        info.textContent = latihan;
      }
    }
    info.hidden = !info.textContent;

    // Konfirmasi di halaman
    const wadahKonfirm = q(".aleta-pensipp-konfirm-wadah");
    wadahKonfirm.textContent = "";
    if (ctx.konfirm && !sibuk) {
      const k = ctx.konfirm;
      const kotak = el("div", "aleta-pensipp-konfirm");
      kotak.setAttribute("role", "group");
      kotak.setAttribute("aria-label", "Konfirmasi penetapan");
      kotak.setAttribute("data-pensipp", "konfirmasi");
      const kalimat =
        k.tulis > 0
          ? `${k.tulis} penetapan akan ditulis ke SIPP dan ${k.edoc} e-Doc diunggah.`
          : `Tidak ada penetapan yang perlu ditulis; ${k.edoc} e-Doc diunggah.`;
      kotak.appendChild(el("b", "", kalimat));
      const rinciKonf = [];
      if (k.tulis > 0) rinciKonf.push(`Ditulis: ${k.sisa.map((j) => j.toUpperCase()).join(", ")}.`);
      if (k.menimpa > 0) {
        const satuPintu = globalThis.aletaPenetapanKerja && typeof globalThis.aletaPenetapanKerja.kerjakan === "function";
        rinciKonf.push(
          satuPintu
            ? `${k.menimpa} di antaranya sudah ada di e-Doc SIPP dan dilewati (tidak ditimpa).`
            : `${k.menimpa} di antaranya menimpa e-Doc yang sudah ada di SIPP.`
        );
      }
      rinciKonf.push("Yang sudah tercatat dilewati. Lanjutkan?");
      kotak.appendChild(el("span", "aleta-pensipp-catatan", rinciKonf.join(" ")));
      const baris = el("div", "aleta-pensipp-baris-tombol");
      const ya = tombol("Lanjutkan", "aleta-pensipp-utama aleta-pensipp-ya");
      ya.setAttribute("data-pensipp", "ya");
      ya.addEventListener("click", () => void jalankan());
      const batal = tombol("Batal", "aleta-pensipp-kecil");
      batal.setAttribute("data-pensipp", "batal");
      batal.addEventListener("click", () => {
        ctx.konfirm = null;
        render();
      });
      baris.append(ya, batal);
      kotak.appendChild(baris);
      wadahKonfirm.appendChild(kotak);
    }

    // Empat langkah
    const daftar = q(".aleta-pensipp-daftar");
    daftar.textContent = "";
    let tercatatJumlah = 0;
    for (const jenis of URUTAN) {
      const baris = bacaBaris(jenis);
      const kode = statusDari(jenis);
      const st = STATUS[kode] || STATUS.tunggu;
      if (baris && baris.tercatat) tercatatJumlah += 1;
      const k = el("div", "aleta-pensipp-langkah");
      k.setAttribute("data-jenis", jenis);
      k.setAttribute("data-status", kode);
      k.appendChild(el("span", "aleta-pensipp-no", jenis.toUpperCase()));
      const isi = el("div", "aleta-pensipp-isi");
      isi.appendChild(el("h3", "aleta-pensipp-nama", NAMA[jenis]));
      if (baris && baris.penetap && !baris.tercatat) isi.appendChild(el("p", "aleta-pensipp-penetap", baris.penetap));
      let teksIsi = baris ? baris.isi : ctx.memuat ? "memuat…" : "";
      if (baris && jenis === "phs" && !baris.tercatat && !baris.kosong) {
        try {
          const pm = (ctx.data && ctx.data.pilihanManual) || {};
          teksIsi = [teksIsi, panggil("t7JamTampil", pm.jam), panggil("t7NamaRuang", pm.ruangan)].filter(Boolean).join(" · ");
        } catch {
          /* jam dan ruang pelengkap */
        }
      }
      if (teksIsi) {
        const p = el("div", "aleta-pensipp-pejabat");
        p.appendChild(el("span", baris && baris.kosong ? "aleta-pensipp-kosong" : "aleta-pensipp-nilai", teksIsi));
        if (baris && baris.tercatat) p.appendChild(el("span", "aleta-pensipp-chip", "Sudah di SIPP"));
        if (baris && baris.tercatat && sudahEdoc(jenis)) p.appendChild(el("span", "aleta-pensipp-chip aleta-pensipp-chip-edoc", "e-Doc sudah ada"));
        isi.appendChild(p);
      }
      if (baris && baris.awas) isi.appendChild(el("p", "aleta-pensipp-awas", baris.awas));
      if (baris && baris.sebab && !baris.tercatat) isi.appendChild(el("p", "aleta-pensipp-sebab", baris.sebab));
      if (cara === "manual" && baris && !baris.tercatat) isi.appendChild(el("p", "aleta-pensipp-sebab", "Mode manual: pejabat dan isi dapat diubah sebelum ditetapkan."));
      k.appendChild(isi);
      const lencana = el("span", `aleta-pensipp-status aleta-pensipp-s-${st.nada}`);
      lencana.setAttribute("data-pensipp", "status");
      if (st.nada === "jalan") lencana.appendChild(el("span", "aleta-pensipp-putar"));
      lencana.append(st.teks);
      k.appendChild(lencana);
      const h = ctx.hasil[jenis];
      if (h && h.sebab) k.appendChild(el("p", `aleta-pensipp-hasil-sebab${st.nada === "salah" ? " aleta-pensipp-hasil-salah" : ""}`, h.sebab));

      const kotakEdoc = el("div", "aleta-pensipp-edoc");
      const label = el("label", "aleta-pensipp-edoc-label");
      const c = document.createElement("input");
      c.type = "checkbox";
      c.checked = ctx.edoc[jenis] !== false;
      c.disabled = sibuk;
      c.setAttribute("data-pensipp-edoc", jenis);
      c.addEventListener("change", () => {
        ctx.edoc[jenis] = c.checked;
        ctx.konfirm = null;
        render();
      });
      label.append(c, ` Unggah e-Doc ${jenis.toUpperCase()}`);
      kotakEdoc.append(label, el("small", "aleta-pensipp-edoc-ket", `PDF bertanda tangan elektronik${jenis === "pmh" ? " + cap kantor" : ""}`));
      const kabarEdoc = ctx.kabarEdoc[jenis];
      if (kabarEdoc) kotakEdoc.appendChild(kabarEdoc);
      k.appendChild(kotakEdoc);
      daftar.appendChild(k);
    }

    // Kaki
    const rencana = ctx.data ? rencanaKerja() : { tulis: 0, edoc: 0, menimpa: 0 };
    q(".aleta-pensipp-ringkas").textContent = ctx.data
      ? `${URUTAN.length} penetapan · ${rencana.tulis} akan ditulis · ${rencana.edoc} e-Doc dicentang`
      : "";
    const semua = q("[data-pensipp='semua']");
    semua.checked = URUTAN.every((j) => ctx.edoc[j]);
    semua.disabled = sibuk;
    const utama = q("[data-pensipp='utama']");
    const libur = awasLibur();
    const ada4 = tercatatJumlah === 4;
    const tidakAdaKerja = ctx.data && rencana.tulis === 0 && rencana.edoc === 0;
    utama.disabled = sibuk || !ctx.data || !adaBaris || Boolean(libur) || Boolean(tidakAdaKerja);
    utama.textContent = sibuk
      ? "Sedang bekerja…"
      : libur
        ? "Ubah hari sidang dulu"
        : tidakAdaKerja
          ? ada4
            ? "Keempat penetapan sudah ada"
            : "Tidak ada yang dikerjakan"
          : "Tetapkan & unggah e-Doc";
    utama.title = libur || (tidakAdaKerja ? "Centang e-Doc yang hendak diunggah, atau ubah pilihan." : "");

    // Laporan akhir
    const lap = q(".aleta-pensipp-laporan");
    lap.textContent = "";
    if (ctx.laporan) {
      lap.className = `aleta-pensipp-laporan aleta-pensipp-laporan-${ctx.laporan.nada}`;
      lap.appendChild(el("b", "aleta-pensipp-laporan-judul", ctx.laporan.ringkas));
      const ul = el("ul", "aleta-pensipp-laporan-daftar");
      for (const b of ctx.laporan.baris) {
        const li = el("li", `aleta-pensipp-laporan-baris aleta-pensipp-laporan-${b.nada}`);
        li.setAttribute("data-jenis", b.jenis);
        li.append(el("b", "", `${b.jenis.toUpperCase()} `), b.teks);
        ul.appendChild(li);
      }
      lap.appendChild(ul);
    } else {
      lap.className = "aleta-pensipp-laporan";
    }
    lap.hidden = !ctx.laporan;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Konfirmasi lalu satu klik
  // ──────────────────────────────────────────────────────────────────────────
  function mintaKonfirmasi() {
    if (!ctx || ctx.sibuk || !ctx.data) return;
    const r = rencanaKerja();
    if (r.tulis === 0 && r.edoc === 0) return;
    ctx.laporan = null;
    ctx.konfirm = { tulis: r.tulis, sisa: r.sisa, edoc: r.edoc, menimpa: r.menimpa };
    render();
    const ya = ctx.akar.querySelector("[data-pensipp='ya']");
    if (ya && typeof ya.focus === "function") ya.focus();
  }

  /** Kalimat awam untuk sebab gagal (tanpa kode mesin). */
  function awam(teks) {
    const t = sebaris(teks);
    if (!t || /^[a-z0-9_:.-]+$/i.test(t)) return "Belum dapat ditetapkan - periksa pilihan di bagian “Pilihan lain”, lalu coba lagi.";
    // Pesan basis data dalam kurung tetap di jejak server, tidak di layar.
    return t.replace(/\s*\([A-Z][A-Z0-9_]{3,}[^)]*\)/g, "");
  }

  /**
   * SATU-SATUNYA tempat panel ini menulis penetapan. Uji kering lalu penulisan
   * (dua tahap alur lama), tanpa e-Doc otomatis (e-Doc menurut kotak centang).
   * Pulang { kering, tulis } dari tetapkanLewatAleta; tulis null bila uji
   * kering tidak lulus.
   */
  async function tulisKePenetapan() {
    const usulan = ctx.data.usulan;
    const opsi = { tanpaEdocOtomatis: true, kunciDipegang: true };
    const kering = await panggil("tetapkanLewatAleta", null, ctx.kabarRinci, usulan, ctx.data, {}, true, opsi);
    if (!kering || !kering.ok) return { kering, tulis: null };
    if (!kering.dikerjakan) return { kering, tulis: { ok: true, dikerjakan: 0, hasil: kering.hasil } };
    const tulis = await panggil("tetapkanLewatAleta", null, ctx.kabarRinci, usulan, ctx.data, {}, false, opsi);
    return { kering, tulis };
  }

  async function muatUlangData() {
    try {
      panggil("lupakanStatusPerkara", ctx.nomor);
    } catch {
      /* simpanan status */
    }
    const baru = await panggil("ambilUsulanPenunjukan", ctx.nomor);
    const d = ctx.data;
    d.usulan = baru.usulan;
    d.rencana = baru.rencana;
    if (baru.pengaturan) d.pengaturan = baru.pengaturan;
    gambarRinci();
  }

  function wadahKabarEdoc(jenis) {
    const w = el("div", "aleta-pensipp-edoc-kabar");
    w.setAttribute("data-jenis", jenis);
    const isi = el("div", "aleta-abt-kabar");
    w.appendChild(isi);
    ctx.kabarEdoc[jenis] = w;
    return isi;
  }

  /**
   * Jalan satu pintu agen P1 (docs/penetapan/KERJAKAN-PENETAPAN.md):
   * aletaPenetapanKerja.kerjakan menulis sisa PMH->PHS di bawah kunci per
   * perkara dan mengunggah e-Doc yang dicentang. Panel ini hanya meneruskan
   * pilihan dan membaca laporannya.
   */
  function pilihanUntukKerja() {
    const d = ctx.data || {};
    const pm = d.pilihanManual || {};
    if (caraSekarang() !== "manual") return {};
    const hasil = {};
    for (const k of ["majelis", "pmhKursi", "ppp", "pjs", "phs", "ruangan", "jam"]) {
      const v = pm[k];
      if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) hasil[k] = v;
    }
    if (d.pejabatDipilih && Object.keys(d.pejabatDipilih).length) hasil.pejabat = { ...d.pejabatDipilih };
    return hasil;
  }

  function kodeDariLaporan(l) {
    if (l.status === "tercatat") return { kode: "ok", sebab: "" };
    if (l.status === "dilewati") {
      if (l.sebab === "sudah_ada") return { kode: "lewat", sebab: "" };
      if (l.sebab === "sedang_dikerjakan") return { kode: "ditahan", sebab: awam(l.bunyi) || "Sedang dikerjakan dari tempat lain - tidak ditulis dua kali." };
      return { kode: "lewat", sebab: "" };
    }
    return { kode: "gagal", sebab: awam(l.bunyi || l.sebab) };
  }

  async function kerjakanLewatSatuPintu(kerja, sebelum, catat) {
    const pk = (ctx.data.usulan && ctx.data.usulan.perkara) || {};
    const langkahDicentang = {};
    for (const j of URUTAN) langkahDicentang[j] = true;
    const hasil = await kerja.kerjakan({
      nomorPerkara: ctx.nomor,
      perkaraId: pk.perkaraId,
      mode: caraSekarang(),
      pilihan: pilihanUntukKerja(),
      langkah: langkahDicentang,
      unggahEdoc: { ...ctx.edoc },
      kering: false,
      pada: (k) => {
        if (!k || !k.jenis || !URUTAN.includes(k.jenis)) return;
        const kode = k.tahap === "edoc" || k.tahap === "unggah" ? "unggah" : k.tahap === "periksa" ? "periksa" : "tulis";
        if (sebelum[k.jenis] && kode !== "unggah") return;
        catat(k.jenis, kode);
        jadwalRender();
      },
    });
    const out = { edocSukses: [], edocGagal: [], edocTidak: [], adaTertulis: false, penulisanGagal: false, diantrekan: false };
    const daftar = (hasil && hasil.laporan) || [];
    if (!hasil || !daftar.length) {
      out.penulisanGagal = true;
      for (const j of URUTAN) if (!sebelum[j]) catat(j, "gagal", awam(hasil && (hasil.pesan || hasil.bunyi)));
      return out;
    }
    if (hasil.perluPilihanJamKerja) out.diantrekan = true;
    for (const l of daftar) {
      if (!URUTAN.includes(l.jenis)) continue;
      const j = l.jenis;
      const { kode, sebab } = kodeDariLaporan(l);
      if (kode === "ok") out.adaTertulis = true;
      if (kode === "gagal" || kode === "ditahan") out.penulisanGagal = true;
      const e = l.edoc || null;
      if (e && e.status === "terunggah") {
        out.edocSukses.push(j);
        catat(j, "selesai");
      } else if (e && e.status === "gagal") {
        out.edocGagal.push(j);
        catat(j, "edoc-gagal", awam(e.bunyi || e.sebab));
      } else if (e && e.status === "dilewati") {
        // Sudah terunggah: tidak ditimpa oleh satu pintu bersama.
        out.edocSukses.push(j);
        catat(j, kode === "ok" ? "selesai" : kode, sebab);
      } else {
        if (ctx.edoc[j] && kode !== "ok" && kode !== "lewat") out.edocTidak.push(j);
        catat(j, kode, sebab);
      }
    }
    return out;
  }

  async function jalankan() {
    if (!ctx || ctx.sibuk || !ctx.data || !ctx.data.usulan) return;
    const rencana = rencanaKerja();
    ctx.konfirm = null;
    // Kunci per perkara yang SAMA dengan kartu Penetapan dan tombol Tetapkan di
    // panel ALETA: dipegang selama seluruh urutan (uji kering, tulis, e-Doc).
    const nomorKunci = String((ctx.data.usulan.perkara && (ctx.data.usulan.perkara.nomorPerkara || ctx.data.usulan.perkara.perkaraId)) || "");
    const kunciBersama = typeof kunciTulisPenetapan !== "undefined" ? kunciTulisPenetapan : null;
    if (kunciBersama && nomorKunci && kunciBersama.has(nomorKunci)) {
      ctx.laporan = {
        ringkas: "Penetapan perkara ini sedang ditulis dari tempat lain di halaman ini. Tunggu sampai selesai, lalu tekan lagi - tidak ditulis dua kali.",
        baris: [],
        nada: "salah",
        muatUlang: false,
      };
      render();
      return;
    }
    if (kunciBersama && nomorKunci) kunciBersama.add(nomorKunci);
    ctx.sibuk = true;
    ctx.laporan = null;
    if (globalThis.aletaMuatUlangSipp) {
      globalThis.aletaMuatUlangSipp.batal();
      if (ctx.wadahMuatUlang) ctx.wadahMuatUlang.textContent = "";
      // Alamat perkara disimpan SEBELUM menulis; sesudah selesai halaman dimuat ulang di situ juga.
      try {
        await globalThis.aletaMuatUlangSipp.catatAlamat(ctx.nomor);
      } catch {
        /* alamat hanya kemudahan */
      }
    }
    ctx.hasil = {};
    ctx.kabarEdoc = {};
    const pencegah = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", pencegah);
    const sebelum = tercatatDi(ctx.data);
    const catat = (jenis, kode, sebab) => {
      ctx.hasil[jenis] = { kode, sebab: sebab || "" };
    };
    const laporBaris = [];
    let adaTertulis = false;
    let penulisanGagal = false;
    let diantrekan = false;
    try {
      const sisa = rencana.sisa;
      for (const j of URUTAN) if (sebelum[j]) catat(j, "lewat");
      for (const j of sisa) catat(j, "periksa");
      render();

      let edocSukses = [];
      let edocGagal = [];
      let edocTidak = [];
      const kerja = globalThis.aletaPenetapanKerja;
      if (kerja && typeof kerja.kerjakan === "function") {
        // ── Satu pintu bersama (agen P1): tulis + e-Doc + kunci server ────
        const h = await kerjakanLewatSatuPintu(kerja, sebelum, catat);
        edocSukses = h.edocSukses;
        edocGagal = h.edocGagal;
        edocTidak = h.edocTidak;
        adaTertulis = h.adaTertulis;
        penulisanGagal = h.penulisanGagal;
        diantrekan = h.diantrekan;
        if (h.adaTertulis) {
          try {
            await muatUlangData();
            ctx.edocPetaDimuat = false;
          } catch {
            /* keadaan akan terbaca ulang saat halaman dimuat ulang */
          }
        }
      } else {
        // ── 1. Tulis penetapan yang belum ada ──────────────────────────────
        let tulis = null;
        if (sisa.length) {
          let kering = null;
          try {
            const h = await tulisKePenetapan();
            kering = h.kering;
            tulis = h.tulis;
          } catch (galat) {
            kering = { ok: false, hasil: sisa.map((j) => ({ jenis: j, ok: false, bunyi: String((galat && galat.message) || galat) })) };
          }
          if (!tulis) {
            penulisanGagal = true;
            const daftar = (kering && kering.hasil) || [];
            const gagalPertama = daftar.find((x) => x && !x.ok && !x.sudahAda);
            for (const j of sisa) {
              const r = daftar.find((x) => x && x.jenis === j);
              if (r && r.sudahAda) catat(j, "lewat");
              else if (r && !r.ok && r.alasan !== "dibatalkan_rantai") catat(j, "gagal", awam(r.bunyi || r.alasan));
              else catat(j, "ditahan", gagalPertama ? `Menunggu ${String(gagalPertama.jenis || "").toUpperCase()} berhasil lebih dulu.` : "Belum ada yang ditulis.");
            }
          } else {
            const daftar = tulis.hasil || [];
            for (const j of sisa) {
              const r = daftar.find((x) => x && x.jenis === j);
              if (!r) catat(j, "gagal", "Tidak ada jawaban untuk langkah ini.");
              else if (r.diantrekan) {
                diantrekan = true;
                catat(j, "antre", awam(r.bunyi) || "Di luar jam kerja - dikerjakan pada jam kerja berikutnya.");
              } else if (r.ok) {
                adaTertulis = true;
                catat(j, "ok");
              } else if (r.sudahAda) catat(j, "lewat");
              else {
                penulisanGagal = true;
                catat(j, r.alasan === "dibatalkan_rantai" ? "ditahan" : "gagal", awam(r.bunyi || r.alasan));
              }
            }
          }
          render();
        }

        // ── 2. Keadaan terbaru, lalu e-Doc yang dicentang ──────────────────
        let sekarang = sebelum;
        if (adaTertulis) {
          try {
            await muatUlangData();
            sekarang = tercatatDi(ctx.data);
            ctx.edocPetaDimuat = false;
          } catch {
            sekarang = { ...sebelum };
            for (const j of URUTAN) if (ctx.hasil[j] && ctx.hasil[j].kode === "ok") sekarang[j] = "ok";
          }
        }
        for (const j of URUTAN) {
          if (!ctx.edoc[j]) continue;
          if (!sekarang[j]) {
            edocTidak.push(j);
            continue;
          }
          const kabarEdoc = wadahKabarEdoc(j);
          catat(j, "unggah", ctx.hasil[j] && ctx.hasil[j].sebab);
          render();
          let r = null;
          try {
            r = await panggil("e6UnggahEdocPenetapan", {
              nomorPerkara: ctx.nomor,
              perkaraId: String((ctx.data.usulan.perkara && ctx.data.usulan.perkara.perkaraId) || ""),
              jenis: [j],
              otomatis: false,
              kering: false,
              timpaDisetujui: true,
              tanpaMuatUlang: true,
              kabar: kabarEdoc,
            });
          } catch (galat) {
            r = { ok: false, galat: String((galat && galat.message) || galat) };
            kabarEdoc.textContent = `e-Doc ${j.toUpperCase()} belum terunggah: ${r.galat}`;
          }
          const berkas = r && r.hasil && r.hasil.d && Array.isArray(r.hasil.d.berkas) ? r.hasil.d.berkas : [];
          const salahBerkas = berkas.some((x) => x && x.ok === false);
          if (r && r.ditahan) {
            edocTidak.push(j);
            catat(j, "edoc-ditahan", `e-Doc tidak dikirim: ${r.ditahan} menyala.`);
          } else if (r && r.ok && !salahBerkas) {
            edocSukses.push(j);
            catat(j, "selesai");
          } else {
            edocGagal.push(j);
            const sebab = salahBerkas ? sebaris(berkas.filter((x) => x && x.ok === false).map((x) => x.sebab).join("; ")) : sebaris(kabarEdoc.textContent);
            catat(j, "edoc-gagal", sebab || "e-Doc tidak terunggah.");
          }
          render();
        }

      }

      // ── 3. Laporan akhir per langkah ───────────────────────────────────
      for (const j of URUTAN) {
        const h = ctx.hasil[j] || { kode: "tunggu" };
        let teks = "";
        let nada = "ok";
        const dicentang = ctx.edoc[j];
        const edocTeks = !dicentang
          ? "e-Doc tidak dicentang."
          : edocSukses.includes(j)
            ? "e-Doc terunggah."
            : edocGagal.includes(j)
              ? `e-Doc gagal${h.sebab ? ` (${h.sebab})` : ""}.`
              : edocTidak.includes(j)
                ? "e-Doc tidak diunggah karena penetapannya belum tercatat."
                : "";
        if (h.kode === "gagal") {
          nada = "salah";
          teks = `gagal ditulis: ${h.sebab || "sebab tidak terbaca"}`;
        } else if (h.kode === "ditahan") {
          nada = "salah";
          teks = `ditahan: ${h.sebab || "menunggu langkah sebelumnya"}`;
        } else if (h.kode === "antre") {
          nada = "tunggu";
          teks = `diantrekan: ${h.sebab}`;
        } else if (sebelum[j]) {
          teks = `sudah tercatat sebelumnya, dilewati. ${edocTeks}`;
          if (edocGagal.includes(j)) nada = "salah";
        } else {
          teks = `tercatat. ${edocTeks}`;
          if (edocGagal.includes(j)) nada = "salah";
        }
        laporBaris.push({ jenis: j, teks: sebaris(teks), nada });
      }
      const nTulis = URUTAN.filter((j) => !sebelum[j] && ctx.hasil[j] && (ctx.hasil[j].kode === "ok" || ctx.hasil[j].kode === "selesai" || ctx.hasil[j].kode === "edoc-gagal" || ctx.hasil[j].kode === "edoc-ditahan")).length;
      const ringkas = penulisanGagal
        ? "Penetapan belum selesai - lihat sebab di tiap langkah."
        : diantrekan
          ? "Di luar jam kerja: penetapan diantrekan dan dikerjakan pada jam kerja berikutnya."
          : `Selesai: ${nTulis} penetapan ditulis, ${edocSukses.length} e-Doc terunggah${edocGagal.length ? `, ${edocGagal.length} e-Doc gagal` : ""}.`;
      ctx.laporan = {
        ringkas,
        baris: laporBaris,
        nada: penulisanGagal || edocGagal.length ? "salah" : diantrekan ? "tunggu" : "ok",
        muatUlang: false,
      };
      // Sesudah SELESAI (penetapan dan e-Doc): ringkasan + muat ulang otomatis, tetap di perkara ini.
      // Ada yang gagal = hanya tombol (sebabnya terbaca dulu). Tidak ada yang berubah = tidak dimuat ulang.
      if ((adaTertulis || edocSukses.length) && globalThis.aletaMuatUlangSipp && ctx.wadahMuatUlang) {
        globalThis.aletaMuatUlangSipp.jadwalkan({
          nomor: ctx.nomor,
          ringkasan: {
            judul: ctx.laporan.ringkas,
            baris: laporBaris.map((b) => ({ jenis: b.jenis, teks: b.teks, nada: b.nada })),
            adaGagal: penulisanGagal || edocGagal.length > 0 || diantrekan,
          },
          wadah: ctx.wadahMuatUlang,
        });
      }
    } catch (galat) {
      ctx.laporan = { ringkas: `Berhenti: ${String((galat && galat.message) || galat).slice(0, 200)}`, baris: [], nada: "salah", muatUlang: false };
    } finally {
      window.removeEventListener("beforeunload", pencegah);
      if (kunciBersama && nomorKunci) kunciBersama.delete(nomorKunci);
      ctx.sibuk = false;
      render();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan di halaman
  // ──────────────────────────────────────────────────────────────────────────
  let nyala = true;
  function aktifSekarang() {
    return nyala && !modeLama();
  }

  /**
   * Keempat penetapan (PMH, PPP, PJS, PHS) perkara ini SUDAH tercatat di SIPP DAN e-Doc keempatnya sudah ada? Sumber yang sama dengan "sudah tercatat - dilewati"
   * (keadaanPenetapanUsulan). Belum terbaca / gagal baca = false (tombol tetap tampil). Sesudah petugas menjalankan penetapan di
   * halaman ini, tombol tidak dicabut di tengah jalan (hasilnya masih dibaca di panel).
   */
  function semuaPenetapanTercatat() {
    const d = ctx && ctx.data;
    if (!d || ctx.galat || ctx.sibuk || ctx.dibukaPetugas || ctx.laporan || Object.keys(ctx.hasil || {}).length) return false;
    const u = d.usulan;
    if (!u || u.ok === false || !u.penetapan || typeof u.penetapan !== "object") return false;
    const t = tercatatDi(d);
    if (!URUTAN.every((j) => Boolean(t[j]))) return false;
    // e-Doc keempatnya juga harus sudah ada (sumber "e-Doc sudah ada" yang sama dengan chip di panel); belum/gagal terbaca = tombol tetap
    // tampil supaya jalur "Tetapkan & unggah e-Doc" tidak hilang.
    return Boolean(ctx.edocPeta) && URUTAN.every((j) => sudahEdoc(j));
  }

  function buangTombol(tr) {
    const td = tr.querySelector(":scope > .aleta-pensipp-sel");
    if (td) td.remove();
    if (ctx && ctx.akar) ctx.akar.hidden = true;
    if (typeof alatUrutkanTombolSipp === "function") alatUrutkanTombolSipp(tr);
  }

  function pasangTombol(tr, sudahMuncul) {
    let td = tr.querySelector(":scope > .aleta-pensipp-sel");
    if (!td) {
      td = el("td", `${KELAS} aleta-pensipp-sel`);
      const b = tombol("", "btn btn-sm aleta-pensipp-tombol");
      b.id = "aleta-pensipp-tombol";
      b.setAttribute("data-pensipp", "tombol");
      b.setAttribute("aria-controls", ID_PANEL);
      b.append(el("span", "aleta-pensipp-ikon", "⚖"), " Penetapan Otomatis");
      b.addEventListener("click", () => {
        if (!ctx) return;
        ctx.terbuka = !ctx.terbuka;
        if (ctx.terbuka) ctx.dibukaPetugas = true; // panel yang sengaja dibuka petugas tidak dicabut walau semua penetapan tercatat
        ingatTerbuka(ctx.nomor, ctx.terbuka);
        pasangPanel(barisTombol(document) || tr);
      });
      td.appendChild(b);
    }
    // PALING KIRI di antara tombol sisipan ALETA: sebelum Putusan Otomatis, Jadwalkan Putusan, lalu
    // "Buka di ABT"/"Buka di ALETA". Urutan dijaga SATU pengurut bersama (panel-alat.js) - tidak ada
    // lagi tombol yang saling memindahkan ketika Jadwalkan Putusan hadir.
    if (td.parentElement !== tr) {
      const l1 = tr.querySelector(":scope > .aleta-l1-submenu");
      tr.insertBefore(td, l1 || null);
    }
    if (typeof alatUrutkanTombolSipp === "function") alatUrutkanTombolSipp(tr);
    const b = td.querySelector("button");
    if (b) b.setAttribute("aria-expanded", ctx && ctx.terbuka ? "true" : "false");
    return td;
  }

  function pasangPanel(tr) {
    const tabel = tr.closest("table#submenus") || (tr.closest("table") && tr.closest("table").closest("table#submenus")) || tr.closest("table");
    const ada = document.getElementById(ID_PANEL);
    if (!ctx.akar || !ada) {
      const akar = buatKerangka();
      if (ada) ada.remove();
      if (tabel && tabel.parentNode) tabel.parentNode.insertBefore(akar, tabel.nextSibling);
      else document.body.appendChild(akar);
      if (ctx.data) gambarRinci();
      ctx.dirender = false;
    }
    ctx.akar.hidden = !ctx.terbuka;
    const tb = tr.querySelector(".aleta-pensipp-tombol");
    if (tb) tb.setAttribute("aria-expanded", ctx.terbuka ? "true" : "false");
    // Keadaan penetapan dibaca walau panel terlipat: tombolnya disembunyikan bila keempat penetapan sudah tercatat di SIPP.
    if (!ctx.data && !ctx.memuat && !ctx.galat) void muat();
    else if (ctx.dirender === false) render();
  }

  function bersihkan(doc) {
    const d = doc || document;
    for (const e of Array.from(d.querySelectorAll(".aleta-pensipp"))) e.remove();
    ctx = null;
  }

  /** Satu putaran pemasangan. Pulang ringkasan (dipakai uji). */
  function pasang(doc) {
    const d = doc || document;
    if (!aktifSekarang()) {
      if (d.querySelector(".aleta-pensipp")) bersihkan(d);
      return { tombol: false, panel: false };
    }
    const tr = barisTombol(d);
    if (!tr) return { tombol: false, panel: false };
    const nomor = nomorHalaman(d);
    if (!berhak() || !nomor) {
      // Belum/tidak berhak: tidak ada tombol, tidak ada panel. Panel yang
      // sedang bekerja tidak dicabut di tengah jalan.
      if (d.querySelector(".aleta-pensipp") && !(ctx && ctx.sibuk)) bersihkan(d);
      return { tombol: false, panel: false };
    }
    if (!ctx || ctx.nomor !== nomor) {
      if (d.querySelector(".aleta-pensipp")) bersihkan(d);
      ctx = buatCtx(nomor);
      // Bawaan TERLIPAT; terbuka lagi HANYA bila petugas membukanya pada kunjungan halaman ini.
      if (terbukaTersimpan(nomor)) {
        ctx.terbuka = true;
        ctx.dibukaPetugas = true;
      }
    }
    if (semuaPenetapanTercatat()) {
      // 21 Okt: keempat penetapan sudah tercatat - tidak ada yang perlu dikerjakan, tombol dan panel tidak dimunculkan.
      buangTombol(tr);
      return { tombol: false, panel: false, lengkap: true };
    }
    pasangTombol(tr);
    pasangPanel(tr);
    return { tombol: true, panel: Boolean(ctx.akar && !ctx.akar.hidden) };
  }

  // Sinkron dengan papan di panel ALETA: objek data dipakai bersama, jadi
  // perubahan di salah satunya (cara, majelis, pejabat) terbaca di yang lain.
  let tandaTerakhir = "";
  function tandaData() {
    const d = ctx && ctx.data;
    if (!d) return "";
    try {
      return JSON.stringify([d.caraPapan, d.pilihanManual, d.pejabatDipilih, d.majelisDipilih, d.usulan && d.usulan.penetapan]);
    } catch {
      return "";
    }
  }
  function sinkron() {
    if (!ctx || !ctx.akar || ctx.sibuk || !ctx.data) return;
    const bersama = usulanBersama();
    if (bersama && bersama !== ctx.data && bersama.usulan && bersama.usulan.ok !== false && String(bersama.nomorPerkara || "") === ctx.nomor) {
      ctx.data = bersama;
      gambarRinci();
      tandaTerakhir = tandaData();
      render();
      return;
    }
    const t = tandaData();
    if (t !== tandaTerakhir) {
      tandaTerakhir = t;
      gambarRinci();
      render();
    }
  }

  let detak = null;
  function mulaiDetak() {
    if (detak) return;
    detak = setInterval(() => {
      try {
        const ada = pasang(document);
        if (ada.panel) sinkron();
      } catch {
        /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
      }
    }, 1000);
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

  globalThis.aletaPenetapanSipp = {
    versi: "p2-21okt",
    pasang,
    bersihkan,
    muat,
    jalankan,
    mintaKonfirmasi,
    keadaan: () => ctx,
    murni: { berhak, barisTombol, nomorHalaman, STATUS, URUTAN },
  };
  void mulai();
})();
