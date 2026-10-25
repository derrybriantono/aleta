"use strict";

/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL - PELAKSANA DI PERAMBAN: ISI & SIMPAN PUTUSAN AKHIR (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Formulir Putusan Akhir SIPP hanya aman diisi dan disimpan dari halamannya sendiri (pilihan yang disaring SIPP,
 * praperiksa, bukti simpan dari SIPP), dan bot di server tidak menulis formulir itu. Jadi langkah "isi & simpan"
 * dari jadwal dikerjakan di sini - di peramban penjadwal yang terbuka - dengan alur Putusan Otomatis yang SAMA
 * (kotak.otomatis di konten.js): ambil usulan -> praperiksa -> isikan -> Simpan -> bukti dari SIPP. TIDAK ADA
 * penulis SIPP baru di modul ini; ia hanya mengatur kapan alur yang sudah teruji itu dijalankan, atas perkara apa.
 *
 * Tiap 30 detik (dan sekali saat halaman dimuat) modul bertanya ke portal: adakah butir jadwal milik saya yang
 * jatuh tempo, atas akun SIPP yang sedang masuk di peramban ini, di dalam jam kerja jadwalnya, dan tidak terlalu
 * rapat dengan perkara sebelumnya? Bila ada:
 *
 *   1. Sedang di halaman perkara itu           -> klaim -> kerjakan di tempat;
 *   2. Di halaman lain dan petugas sedang
 *      tidak mengetik/menekan (>= 45 detik)    -> klaim -> simpan catatan -> buka halaman perkaranya
 *      (hanya dari dashboard, daftar/jurnal, atau halaman perkara; tidak dari formulir yang terbuka;
 *      dapat dimatikan: "Buka halaman perkara sendiri");
 *   3. Selain itu                              -> spanduk "jatuh tempo" dengan tombol "Kerjakan sekarang".
 *
 * Mengerjakan satu butir: (a) cek SIPP - sudah terisi = DILEWATI, tidak ditimpa; (b) portal menyiapkan draf dari
 * berkas yang dipasang; (c) pilihan form yang ditetapkan petugas dipasang lebih dulu; (d) alur Putusan Otomatis
 * TANPA e-Doc (e-Doc dikerjakan server sesudahnya, 30-150 detik kemudian); (e) hasil dilaporkan ke portal. Yang
 * ditahan praperiksa, atau tidak terbukti tersimpan, dilaporkan "tertahan"/"gagal" dengan sebabnya dan TIDAK
 * diulang sendiri.
 *
 * Ketahanan: Simpan membuat SIPP memuat ulang halaman. Catatan pengerjaan disimpan di chrome.storage.local;
 * sesudah halaman termuat modul memeriksa SIPP (terisi = selesai) sebelum melapor, dan butir yang terputus
 * dikembalikan ke antrean tanpa diulang diam-diam. Satu butir dipegang satu peramban (klaim atomik di server).
 *
 * Hak: hanya Super Admin, Admin, Hakim - dan hanya jadwal MILIK akun yang sedang masuk. Tampilan Lama tidak
 * menjalankannya. Tidak ada kata ALETA yang ditulis ke SIPP.
 */
(function putusanTerjadwalPerambanModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPutusanTerjadwalPeramban) return;

  const API = "/aleta/api/aleta-ecourt/putusan-terjadwal/peramban";
  const KUNCI_AKTIF = "putusanTerjadwalAktif";
  const KUNCI_SETELAN = "putusanTerjadwalPeramban";
  const JEDA_DETAK_MS = 30000;
  const DIAM_MS = 45000;
  const BASI_MS = 15 * 60 * 1000;
  const MENUJU_MS = 90 * 1000;
  const MENYIMPAN_MS = 2 * 60 * 1000;
  /** K15: catatan dari server baru dipulihkan bila sudah selama ini tidak berubah (sama dengan BASI_PUTUSAN_TERJADWAL_MS di lib/antrean-peramban.ts). */
  const BASI_SERVER_MS = 10 * 60 * 1000;
  const DASBOR = /\/(main|beranda|dashboard|home)(\/|$|\?)|\/(sipp|index\.php)\/?$/i;

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const fungsi = (nama) => (typeof globalThis[nama] === "function" ? globalThis[nama] : null);
  const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
  const rapat = (t) => sebaris(t).toLowerCase();
  async function tungguSampai(cari, batasMs, jedaMs) {
    const mulai = Date.now();
    for (;;) {
      let h = null;
      try {
        h = cari();
      } catch {
        h = null;
      }
      if (h) return h;
      if (Date.now() - mulai > batasMs) return null;
      await tunggu(jedaMs || 100);
    }
  }

  async function ambilJson(alamat, opsi, sebut) {
    const ambil = fungsi("alatAmbil");
    let r;
    try {
      r = ambil ? await ambil(alamat, opsi, sebut) : await fetch(alamat, opsi);
    } catch (galat) {
      return { ok: false, status: 0, data: null, pesan: sebaris((galat && galat.message) || galat) || `${sebut} gagal.` };
    }
    let luar = null;
    try {
      luar = await r.json();
    } catch {
      luar = null;
    }
    const data = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
    const galatPortal = luar && luar.error ? (typeof luar.error === "object" ? luar.error.message : luar.error) : "";
    const pesan = sebaris((data && typeof data === "object" && (data.sebab || data.alasan || data.pesan)) || galatPortal || (luar && luar.alasan) || "");
    return { ok: Boolean(r.ok) && !(data && typeof data === "object" && data.ok === false), status: r.status, data, pesan };
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
      /* catatan hanya kenyamanan - tanpanya butir diambil lagi dari portal */
    }
  }
  async function hapusPenyimpanan(kunci) {
    try {
      await chrome.storage.local.remove(kunci);
    } catch {
      /* idem */
    }
  }

  function modeLama() {
    try {
      return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") === "lama";
    } catch {
      return false;
    }
  }
  function berhak() {
    try {
      if (typeof penggunaTerakhir === "undefined" || !penggunaTerakhir) return false;
      if (typeof alatBolehUnggahPutusan !== "function" || alatBolehUnggahPutusan(penggunaTerakhir) !== true) return false;
      return typeof boleh === "function" ? boleh("data-umum") === true : true;
    } catch {
      return false;
    }
  }
  function nomorHalaman() {
    const l1 = globalThis.aletaSippIdeL1;
    try {
      const n = l1 && l1.murni && typeof l1.murni.nomorHalamanDetil === "function" ? l1.murni.nomorHalamanDetil(document) : "";
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
  const akunMasuk = () => {
    try {
      return typeof namaPenggunaSipp === "function" ? String(namaPenggunaSipp() || "") : "";
    } catch {
      return "";
    }
  };
  const adaDetail = () => Boolean(document.querySelector("#submenus td#backlist"));

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan, spanduk
  // ──────────────────────────────────────────────────────────────────────────
  let keadaan = { status: "diam", pesan: "", butir: null, terakhir: 0 };
  let bekerja = false;
  /** Pindah halaman; dapat diganti (uji) lewat setelBuka. */
  let bukaAlamat = (alamat) => location.assign(alamat);
  let terakhirAktivitas = Date.now();
  let setelan = { bukaOtomatis: true };

  function pasangPemantauAktivitas() {
    const catat = () => {
      terakhirAktivitas = Date.now();
    };
    for (const e of ["keydown", "mousedown", "touchstart", "wheel"]) document.addEventListener(e, catat, { capture: true, passive: true });
  }
  const sedangDipakai = () => Date.now() - terakhirAktivitas < DIAM_MS;

  function spanduk(teks, opsi) {
    const o = opsi || {};
    let e = document.getElementById("aleta-ptj-spanduk");
    if (!teks) {
      if (e) e.remove();
      return null;
    }
    if (!e) {
      e = document.createElement("div");
      e.id = "aleta-ptj-spanduk";
      e.className = "aleta-sisip aleta-ptj-spanduk";
      e.setAttribute("role", "status");
      e.setAttribute("aria-live", "polite");
      document.body.appendChild(e);
    }
    e.textContent = "";
    const t = document.createElement("span");
    t.textContent = teks;
    e.appendChild(t);
    if (o.tombol) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "aleta-ptj-tombol-kecil";
      b.textContent = o.tombol.teks;
      b.addEventListener("click", o.tombol.aksi);
      e.appendChild(b);
    }
    e.setAttribute("data-ptj-spanduk", o.nada || "info");
    return e;
  }
  function setKeadaan(status, pesan, butir) {
    keadaan = { status, pesan: pesan || "", butir: butir || null, terakhir: Date.now() };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Portal
  // ──────────────────────────────────────────────────────────────────────────
  const giliran = () => ambilJson(`${API}?akunSipp=${encodeURIComponent(akunMasuk())}`, { credentials: "include", cache: "no-store" }, "Memeriksa putusan terjadwal");
  const kirimAksi = (aksi, id, tambahan) =>
    ambilJson(API, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi, id, ...(tambahan || {}) }) }, "Putusan terjadwal");
  const klaim = (id) => kirimAksi("klaim", id, { akunSipp: akunMasuk() });
  const lapor = (id, hasil, catatan) => kirimAksi("lapor", id, { hasil, catatan: sebaris(catatan).slice(0, 380) });
  const lepas = (id, sebab, hitung, tundaDetik) => kirimAksi("lepas", id, { sebab, hitung: Boolean(hitung), ...(tundaDetik ? { tundaDetik } : {}) });

  /** 409 "tidak sedang Anda pegang" = sudah dilaporkan (mis. oleh tab ini sebelum halaman dimuat ulang): dianggap beres. */
  async function laporAman(id, hasil, catatan) {
    const r = await lapor(id, hasil, catatan);
    if (r.ok || r.status === 409) return true;
    // Laporan yang gagal sampai tidak boleh hilang: dicoba lagi sekali sesudah beberapa detik.
    await tunggu(3000);
    const ulang = await lapor(id, hasil, catatan);
    return ulang.ok || ulang.status === 409;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pilihan form yang ditetapkan petugas dipasang lebih dulu di formulir
  // ──────────────────────────────────────────────────────────────────────────
  async function pasangPilihan(pilihan) {
    const p = pilihan || {};
    if (!p.statusPutusan && !p.verstek) return { ok: true, terpasang: [] };
    const kirim = fungsi("kirimKeJembatan");
    if (!kirim) return { ok: false, sebab: "Penghubung ke formulir SIPP belum termuat, jadi pilihan form tidak dapat dipasang." };
    const terpasang = [];
    if (p.statusPutusan) {
      const sel = 'select[name="status_putusan"]';
      const j = await kirim({ jenis: "pilihan", penunjuk: sel });
      const daftar = (j && Array.isArray(j.pilihan) && j.pilihan) || [];
      const cocok = daftar.find((x) => rapat(x.label) === rapat(p.statusPutusan));
      if (!cocok) {
        return { ok: false, sebab: `Status putusan "${p.statusPutusan}" tidak ada di pilihan formulir SIPP untuk perkara ini (${daftar.slice(0, 6).map((x) => x.label).join(", ") || "daftar kosong"}). Tidak dipilihkan sendiri.` };
      }
      const r = await kirim({ jenis: "isi", penunjuk: sel, jenisMedan: "pilih", nilai: cocok.nilai });
      if (!r || r.ok === false) return { ok: false, sebab: `Status putusan "${p.statusPutusan}" tidak dapat dipasang di formulir.` };
      terpasang.push(`status ${cocok.label}`);
    }
    if (p.verstek === "Y" || p.verstek === "T") {
      const r = await kirim({ jenis: "isi", penunjuk: 'select[name="verstek"]', jenisMedan: "pilih", nilai: p.verstek });
      if (!r || r.ok === false) return { ok: false, sebab: "Pilihan verstek tidak dapat dipasang di formulir." };
      terpasang.push(`verstek ${p.verstek === "Y" ? "ya" : "tidak"}`);
    }
    return { ok: true, terpasang };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mengerjakan satu butir di halaman perkaranya
  // ──────────────────────────────────────────────────────────────────────────
  async function jalankanIsi(butir) {
    const buka = fungsi("s1BukaBlangkoPutusan");
    if (!buka) return { hasil: "gagal", catatan: "Pembuka blangko Putusan Akhir belum termuat." };
    const b = await buka();
    if (!b || !b.ok) return { hasil: "gagal", catatan: sebaris((b && b.pesan) || "Blangko Putusan Akhir tidak dapat dibuka.") };
    const gambarUlang = fungsi("gambarUlangSesudahBlangko");
    if (gambarUlang) await gambarUlang(butir.nomorPerkara).catch(() => false);
    const bagian = await tungguSampai(
      () => {
        for (const k of Array.from(document.querySelectorAll('.aleta-bagian[data-kunci="isiPutusan"]'))) {
          if (typeof k.otomatis === "function") return k;
        }
        return null;
      },
      15000,
      100
    );
    if (!bagian) {
      return { hasil: "gagal", catatan: "Blangko terbuka, tetapi bagian Putusan otomatis di panel tidak termuat (tampilan, kewenangan peran, atau putusan sudah terisi)." };
    }
    const pil = await pasangPilihan(butir.pilihan);
    if (!pil.ok) return { hasil: "tertahan", catatan: pil.sebab };
    // Tahap "menyimpan": Simpan SIPP memuat ulang halaman; sesudahnya keadaan SIPP diperiksa sebelum melapor.
    await simpanCatatan({ tahap: "menyimpan" });
    const h = await bagian.otomatis({ edoc: false, denganPutusan: false, denganAnonim: false, melayang: true });
    if (h && h.tersimpan) {
      return { hasil: "selesai", catatan: `Tersimpan di SIPP${pil.terpasang.length ? ` (pilihan Anda: ${pil.terpasang.join(", ")})` : ""}.` };
    }
    const pesan = sebaris((h && (h.pesan || h.bunyi)) || "Pengisian berhenti sebelum Simpan.");
    // Praperiksa/pilihan wajib/medan tambahan menahan = butuh orang; selain itu gagal.
    const tahan = h && (h.tahap === "praperiksa" || /menahan|ditahan|dikosongkan|medan tambahan|pilihan wajib|bertentangan/i.test(pesan));
    return { hasil: tahan ? "tertahan" : "gagal", catatan: pesan };
  }

  async function catatanAktif() {
    const s = await bacaPenyimpanan([KUNCI_AKTIF]);
    return (s && s[KUNCI_AKTIF]) || {};
  }

  /** Penanda halaman ini: dua tab yang membaca catatan yang sama tidak mengerjakan butir yang sama. */
  const ID_HALAMAN = `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let catatanKini = null;
  let detakJantung = null;

  /**
   * K15: salinan catatan pengerjaan ke basis data (hanya bila Super Admin menyalakan saklar antreanDiServer; mati = tidak
   * ada yang dikirim). Isinya hanya keadaan pengerjaan butir (id, nomor perkara, tahap, pilihan form) - tidak ada isi putusan.
   */
  function cerminCatatan(segera) {
    const A = globalThis.ALETA_ANTREAN_SERVER;
    const c = catatanKini;
    if (!A || !c || !c.id) return;
    void A.catat(
      "putusan-terjadwal-catatan",
      String(c.id),
      { ringkas: `Putusan terjadwal ${c.nomorPerkara || ""} - ${c.tahap || "jalan"}`, selesai: 0, total: 1, muatan: { catatan: c } },
      { segera: segera === true }
    );
  }

  /** Menghapus catatan lokal dan menandai salinannya di server selesai. */
  async function hapusCatatan(id) {
    await hapusPenyimpanan(KUNCI_AKTIF);
    const A = globalThis.ALETA_ANTREAN_SERVER;
    if (A && id) void A.akhiri("putusan-terjadwal-catatan", String(id), "selesai");
  }

  /**
   * K15: tidak ada catatan di peramban ini (Chrome dibersihkan, atau PC lain) tetapi server menyimpan catatan milik akun
   * ini yang sudah tidak berubah >= BASI_SERVER_MS: dipulihkan ke penyimpanan lokal sebagai catatan BASI (tanpa pemegang),
   * lalu ditangani alur yang sama dengan catatan lokal yang terputus (dikembalikan ke antrean / diperiksa di SIPP).
   * Tidak pernah mengerjakan apa pun sendiri.
   */
  async function pulihkanDariServer() {
    const A = globalThis.ALETA_ANTREAN_SERVER;
    if (!A) return null;
    try {
      await A.tungguSiap();
      if (!A.aktif()) return null;
      const daftar = await A.tertinggal("putusan-terjadwal-catatan");
      for (const x of daftar) {
        const c = x && x.muatan && x.muatan.catatan;
        const umur = Date.now() - Date.parse(String(x.diubahPada || ""));
        if (!c || !c.id || !Number.isFinite(umur) || umur < BASI_SERVER_MS) continue;
        const rec = { ...c, pemegang: "", pada: Date.parse(x.diubahPada) };
        await tulisPenyimpanan({ [KUNCI_AKTIF]: rec });
        return rec;
      }
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
    return null;
  }

  async function simpanCatatan(patch) {
    catatanKini = { ...(catatanKini || {}), ...(patch || {}), pemegang: ID_HALAMAN, pada: Date.now() };
    await tulisPenyimpanan({ [KUNCI_AKTIF]: catatanKini });
    cerminCatatan(true);
  }

  /**
   * Merebut catatan: tulis atas nama halaman ini, tunggu sebentar, baca lagi. Hanya SATU halaman yang
   * tulisannya bertahan, jadi dua tab di halaman perkara yang sama tidak mengisi formulir dua kali.
   */
  async function rebut(rec, tahap) {
    await simpanCatatan({ ...rec, tahap });
    await tunggu(250);
    const kini = await catatanAktif();
    return Boolean(kini && kini.id === rec.id && kini.pemegang === ID_HALAMAN);
  }

  function mulaiDetakJantung() {
    if (detakJantung) return;
    let denyut = 0;
    detakJantung = setInterval(() => {
      if (catatanKini) void tulisPenyimpanan({ [KUNCI_AKTIF]: { ...catatanKini, pada: Date.now() } });
      // K15: salinan di server diperbarui tiap 6 detak (30 detik) supaya PC lain tahu catatan ini masih hidup.
      denyut += 1;
      if (denyut % 6 === 0) cerminCatatan(false);
    }, 5000);
  }
  function hentikanDetakJantung() {
    if (detakJantung) clearInterval(detakJantung);
    detakJantung = null;
    catatanKini = null;
  }

  /**
   * Mengerjakan butir yang SUDAH diklaim, di halaman perkaranya. Tidak pernah melempar.
   */
  async function kerjakan(rec) {
    bekerja = true;
    setKeadaan("bekerja", `Mengisi Putusan Akhir ${rec.nomorPerkara}…`, rec);
    spanduk(`Putusan terjadwal: mengisi dan menyimpan Putusan Akhir ${rec.nomorPerkara}… jangan menutup atau memuat ulang halaman ini.`, { nada: "kerja" });
    let hasil = { hasil: "gagal", catatan: "tidak diketahui" };
    // K12: selama pengerjaan, tab tersembunyi tidak boleh menahan kejadian/pewaktu apa pun.
    const lepasSibuk = globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.sibuk("putusan-terjadwal") : () => undefined;
    try {
      catatanKini = { ...rec };
      await simpanCatatan({ tahap: "jalan" });
      mulaiDetakJantung();
      // (a) SIPP sudah memuat Putusan Akhir -> dilewati, tidak ditimpa.
      const baca = fungsi("b6KeadaanPutusanTerisi");
      let terisi = null;
      if (baca) {
        try {
          terisi = await baca(rec.nomorPerkara);
        } catch {
          terisi = null;
        }
      }
      if (terisi && terisi.terisi) {
        hasil = { hasil: "dilewati", catatan: `Putusan Akhir sudah terisi di SIPP${terisi.tanggal ? ` (tanggal ${terisi.tanggal})` : ""} - tidak ditimpa.` };
      } else {
        // (b) draf dari berkas yang dipasang.
        const d = await kirimAksi("draf", rec.id);
        const dd = d.data && typeof d.data === "object" ? d.data : {};
        if (!d.ok || dd.ok === false) {
          hasil = { hasil: "gagal", catatan: dd.sebab || d.pesan || "Draf putusan tidak dapat disiapkan." };
        } else {
          hasil = await jalankanIsi(rec);
        }
      }
    } catch (galat) {
      hasil = { hasil: "gagal", catatan: sebaris((galat && galat.message) || galat) };
    }
    const ok = await laporAman(rec.id, hasil.hasil, hasil.catatan);
    lepasSibuk();
    hentikanDetakJantung();
    await hapusCatatan(rec.id);
    bekerja = false;
    setKeadaan("diam", hasil.catatan, null);
    spanduk(
      `Putusan terjadwal ${rec.nomorPerkara}: ${hasil.hasil === "selesai" ? "Putusan Akhir tersimpan; e-Doc menyusul oleh server." : hasil.hasil === "dilewati" ? "sudah terisi di SIPP, tidak ditimpa." : hasil.hasil === "tertahan" ? `ditahan - ${hasil.catatan}` : `gagal - ${hasil.catatan}`}${ok ? "" : " (laporan ke server belum terkirim)"}`,
      { nada: hasil.hasil === "selesai" || hasil.hasil === "dilewati" ? "ok" : "salah", tombol: { teks: "Tutup", aksi: () => spanduk("") } }
    );
    return { ...hasil, dilaporkan: ok };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Melanjutkan sesudah halaman dimuat (menuju / menyimpan)
  // ──────────────────────────────────────────────────────────────────────────
  const POLA_BAKU = (n) => sebaris(n).replace(/[\s.]+/g, "").replace(/^0+(?=\d)/, "").toLowerCase();

  async function lanjutkanCatatan() {
    let rec = await catatanAktif();
    if (!rec || !rec.id) rec = await pulihkanDariServer();
    if (!rec || !rec.id) return false;
    const umurDetak = Date.now() - Number(rec.pada || rec.mulai || 0);
    const milikSaya = rec.pemegang === ID_HALAMAN;
    // Halaman lain masih hidup dan memegangnya (detak jantung < 12 detik): jangan disentuh.
    if (!milikSaya && umurDetak < 12000 && rec.tahap !== "menuju") return true;
    const disini = POLA_BAKU(nomorHalaman()) === POLA_BAKU(rec.nomorPerkara) && adaDetail();
    if (rec.tahap === "menuju") {
      if (disini) {
        if (!(await rebut(rec, "jalan"))) return true;
        await kerjakan({ id: rec.id, nomorPerkara: rec.nomorPerkara, perkaraId: rec.perkaraId, pilihan: rec.pilihan, akunSipp: rec.akunSipp, mulai: rec.mulai });
        return true;
      }
      if (umurDetak < MENUJU_MS) return true; // halaman masih berpindah
      await lepas(rec.id, "Halaman perkara tidak terbuka pada waktunya.", true, 120);
      await hapusCatatan(rec.id);
      return false;
    }
    if (rec.tahap === "menyimpan") {
      // Simpan SIPP baru saja memuat ulang halaman: periksa SIPP, lalu laporkan hanya yang terbukti.
      if (umurDetak < MENYIMPAN_MS && !disini && !DASBOR.test(location.pathname) && !adaDetail()) return true;
      if (!(await rebut(rec, "menyimpan"))) return true;
      const baca = fungsi("b6KeadaanPutusanTerisi");
      let terisi = null;
      if (baca) {
        try {
          terisi = await baca(rec.nomorPerkara);
        } catch {
          terisi = null;
        }
      }
      if (terisi && terisi.terisi) await laporAman(rec.id, "selesai", `Tersimpan di SIPP (terbukti setelah halaman dimuat ulang${terisi.tanggal ? `, tanggal ${terisi.tanggal}` : ""}).`);
      else if (terisi) await laporAman(rec.id, "gagal", "Halaman dimuat ulang tetapi Putusan Akhir belum terbukti tersimpan di SIPP. Periksa perkaranya, lalu ulangi bila perlu.");
      else await laporAman(rec.id, "gagal", "Putusan Akhir mungkin tersimpan, tetapi keadaan SIPP belum dapat dibaca untuk memastikannya. Periksa perkaranya.");
      hentikanDetakJantung();
      await hapusCatatan(rec.id);
      spanduk("");
      return false;
    }
    // "jalan" yang detak jantungnya mati = terputus sebelum Simpan: dikembalikan ke antrean (dihitung), tidak diulang diam-diam.
    if (!milikSaya && umurDetak >= 12000) {
      await lepas(rec.id, "Pengerjaan terputus sebelum Simpan (halaman dimuat ulang atau ditutup).", true, 180);
      await hapusCatatan(rec.id);
    }
    return false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Satu putaran pemeriksaan
  // ──────────────────────────────────────────────────────────────────────────
  function halamanAman() {
    // Hanya dashboard, daftar/jurnal, atau halaman perkara tanpa formulir yang terbuka.
    if (document.querySelector("#frm_putusan, .modal.in, .modal.show")) return false;
    const sipp = globalThis.aletaPutusanSipp && typeof globalThis.aletaPutusanSipp.keadaan === "function" ? globalThis.aletaPutusanSipp.keadaan() : null;
    if (sipp && sipp.sibuk) return false;
    const terjadwal = globalThis.aletaPutusanTerjadwal && typeof globalThis.aletaPutusanTerjadwal.keadaan === "function" ? globalThis.aletaPutusanTerjadwal.keadaan() : null;
    if (terjadwal && terjadwal.sibuk) return false;
    if (adaDetail()) return true;
    if (DASBOR.test(location.pathname) || /\/(?:jurnal_perkara_list|all_jurnal_perkara|jurnal_all_perkara)(?:\/|$)/i.test(location.pathname)) return true;
    const baris = fungsi("barisPerkaraDiHalaman");
    try {
      return Boolean(baris && baris().length >= 1);
    } catch {
      return false;
    }
  }

  async function periksaSekarang(opsi) {
    const o = opsi || {};
    if (bekerja) return { diam: true, alasan: "sedang_bekerja" };
    if (modeLama() || !berhak()) return { diam: true, alasan: "tidak_berhak" };
    if (!akunMasuk()) return { diam: true, alasan: "akun_sipp_belum_terbaca" };
    if (/\/aps_badilag\//i.test(location.pathname)) return { diam: true, alasan: "bukan_sipp" };
    bekerja = true;
    try {
      // Catatan pengerjaan yang tertinggal (menuju / menyimpan / terputus) diselesaikan lebih dulu.
      if (await lanjutkanCatatan()) return { diam: false, alasan: "melanjutkan" };
      // K12: dengan saklar "pengamat tunggal" menyala, hanya SATU tab SIPP per PC yang menanyakan giliran ke portal
      // (tab yang terlihat didahulukan). Tanpa saklar, atau pekerja latar tak menjawab, semua tab bertanya seperti dulu.
      // Pengerjaan butir tidak terpengaruh: klaim di portal tetap atomik dan catatan yang terputus sudah dilanjutkan di atas.
      if (o.paksa !== true && globalThis.ALETA_PENGAMAT && globalThis.ALETA_PENGAMAT.nyala() && !(await globalThis.ALETA_PENGAMAT.pemimpin("putusan-terjadwal", JEDA_DETAK_MS * 2 + 15000))) {
        return { diam: true, alasan: "bukan_pemimpin" };
      }
      const r = await giliran();
      const d = r.data && typeof r.data === "object" ? r.data : {};
      if (!r.ok || d.ada !== true) {
        if (d.alasan === "akun_beda" && Array.isArray(d.akunLain) && d.akunLain.length) {
          spanduk(`Ada putusan terjadwal atas akun SIPP ${d.akunLain.join(", ")}; masuk SIPP dengan akun itu supaya dikerjakan di peramban ini.`, { nada: "awas", tombol: { teks: "Tutup", aksi: () => spanduk("") } });
        } else if (document.getElementById("aleta-ptj-spanduk") && document.getElementById("aleta-ptj-spanduk").getAttribute("data-ptj-spanduk") === "jatuh-tempo") {
          spanduk("");
        }
        setKeadaan("diam", d.alasan || (r.ok ? "" : r.pesan), null);
        return { diam: true, alasan: d.alasan || "tidak_ada", berikutnya: d.berikutnyaWita || "" };
      }
      const butir = d.butir;
      const alamat = d.tautan && d.tautan.alamat;
      const disini = POLA_BAKU(nomorHalaman()) === POLA_BAKU(butir.nomorPerkara) && adaDetail();
      const boleh = disini || (setelan.bukaOtomatis && alamat && halamanAman() && !sedangDipakai()) || o.paksa === true;
      if (!boleh) {
        setKeadaan("menunggu", `${butir.nomorPerkara} jatuh tempo`, butir);
        spanduk(`Putusan terjadwal ${butir.nomorPerkara} sudah waktunya diisi dan disimpan${sedangDipakai() ? " (menunggu Anda berhenti mengetik)" : ""}.`, {
          nada: "jatuh-tempo",
          tombol: { teks: "Kerjakan sekarang", aksi: () => void periksaSekarang({ paksa: true }) },
        });
        return { diam: false, alasan: "menunggu_petugas", butir: butir.nomorPerkara };
      }
      const k = await klaim(butir.id);
      const kd = k.data && typeof k.data === "object" ? k.data : {};
      if (!k.ok || kd.ok === false) {
        setKeadaan("diam", kd.sebab || k.pesan, null);
        return { diam: true, alasan: kd.alasan || "klaim_gagal" };
      }
      const rec = { id: butir.id, nomorPerkara: butir.nomorPerkara, perkaraId: butir.perkaraId, pilihan: butir.pilihan || {}, akunSipp: butir.akunSipp, mulai: Date.now(), pada: Date.now() };
      if (disini) {
        bekerja = false;
        await kerjakan(rec);
        return { diam: false, alasan: "dikerjakan", butir: butir.nomorPerkara };
      }
      if (!alamat) {
        await lepas(butir.id, (d.tautan && d.tautan.alasan) || "Alamat halaman perkara belum dapat disusun.", true, 300);
        return { diam: true, alasan: "tanpa_tautan" };
      }
      // Pindah ke halaman perkaranya; sesudah termuat, lanjutkanCatatan() mengerjakannya.
      await tulisPenyimpanan({ [KUNCI_AKTIF]: { ...rec, tahap: "menuju", pemegang: "", pada: Date.now() } });
      setKeadaan("menuju", `Membuka halaman ${butir.nomorPerkara}…`, butir);
      spanduk(`Putusan terjadwal: membuka halaman perkara ${butir.nomorPerkara}…`, { nada: "kerja" });
      bukaAlamat(alamat);
      return { diam: false, alasan: "menuju", butir: butir.nomorPerkara };
    } catch (galat) {
      setKeadaan("diam", sebaris((galat && galat.message) || galat), null);
      return { diam: true, alasan: "galat" };
    } finally {
      if (!(keadaan.status === "bekerja")) bekerja = false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mulai
  // ──────────────────────────────────────────────────────────────────────────
  async function muatSetelan() {
    const s = await bacaPenyimpanan([KUNCI_SETELAN]);
    const x = s && s[KUNCI_SETELAN] && typeof s[KUNCI_SETELAN] === "object" ? s[KUNCI_SETELAN] : {};
    setelan = { bukaOtomatis: x.bukaOtomatis !== false };
    return setelan;
  }
  async function simpanSetelan(baru) {
    setelan = { ...setelan, ...(baru || {}) };
    await tulisPenyimpanan({ [KUNCI_SETELAN]: setelan });
    return setelan;
  }

  let detak = null;
  async function mulai() {
    try {
      if (/\/aps_badilag\//i.test(String(location.pathname || ""))) return;
      if (!document.body) return;
      await muatSetelan();
      pasangPemantauAktivitas();
      // Pemeriksaan pertama sesudah halaman tenang (konten.js memuat peran dan fungsi yang dipakai).
      setTimeout(() => void periksaSekarang(), 3000);
      setTimeout(() => void periksaSekarang(), 16000);
      // tetap: poll ini bukan penyegar tampilan - ia harus berdetak walau tab tersembunyi (hanya pemimpin yang menanyakan).
      if (!detak) detak = (globalThis.ALETA_PENGAMAT ? (f, ms) => globalThis.ALETA_PENGAMAT.interval(f, ms, { tetap: true, ringan: false }) : setInterval)(() => void periksaSekarang(), JEDA_DETAK_MS);
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
  }

  globalThis.aletaPutusanTerjadwalPeramban = {
    versi: "b3-21okt",
    periksaSekarang,
    kerjakan,
    lanjutkanCatatan,
    pasangPilihan,
    bacaSetelan: muatSetelan,
    simpanSetelan,
    keadaan: () => keadaan,
    sedangBekerja: () => bekerja,
    setelBuka: (f) => {
      bukaAlamat = typeof f === "function" ? f : (alamat) => location.assign(alamat);
    },
    idHalaman: () => ID_HALAMAN,
    murni: { halamanAman, sedangDipakai, POLA_BAKU },
  };
  void mulai();
})();
