"use strict";

/**
 * ============================================================================
 * MUAT ULANG OTOMATIS SESUDAH PENETAPAN - TETAP DI PERKARANYA (20 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: sesudah penetapan (dan e-Doc yang dicentang) SELESAI,
 * halaman SIPP dimuat ulang otomatis supaya data penetapan baru tampil, dan
 * TETAP di halaman detil perkara yang sama - tidak jatuh ke dasbor.
 *
 * Dipakai tiga jalan: panel "Penetapan Otomatis" (penetapan-sipp.js), tombol
 * Tetapkan / kartu Penetapan / mode otomatis papan (konten.js:
 * siapkanKerjakan), lewat satu pintu: aletaMuatUlangPen.jadwalkan().
 *
 *   SEBELUM menulis  catatAlamat(): alamat pintu masuk perkara (perkara_detil/
 *                    <enc>, dapat dibuka ulang) dan alamat detil saat ini
 *                    disimpan di chrome.storage.local per perkara.
 *   SESUDAH selesai  jadwalkan(): ringkasan per langkah ditampilkan (bukan
 *                    langsung memuat ulang) dengan hitung mundur 3 detik dan
 *                    tombol "Muat ulang sekarang" / "Jangan muat ulang".
 *                    Ada yang GAGAL = tidak dimuat ulang sendiri; hanya
 *                    tombol, supaya sebabnya terbaca dulu.
 *   SESUDAH memuat   ringkasan hasil tampil lagi (kotak yang dapat ditutup)
 *                    supaya petugas tahu apa yang tercatat. Bila SIPP
 *                    menjatuhkan halaman ke dasbor/beranda, petugas
 *                    dikembalikan ke alamat perkara itu SEKALI saja (penanda
 *                    "menunggu" dicabut lebih dulu - tanpa perulangan).
 *   Dua tab          tab lain yang sedang dalam perjalanan memuat ulang
 *                    perkara yang sama (penanda "menunggu" masih menyala)
 *                    tidak memuat ulang lagi.
 *
 * Tidak menulis apa pun ke SIPP. Kotaknya berkelas aleta-sisip.
 */
(function penetapanMuatUlangModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaMuatUlangPen) return;

  const KUNCI = "penetapanMuatUlang";
  const UMUR_MENUNGGU_MS = 60 * 1000;
  const UMUR_RINGKASAN_MS = 10 * 60 * 1000;
  const BATAS_TAB_GANDA_MS = 8 * 1000;
  const BATAS_CATAT = 6;
  const IDTAB = Math.random().toString(36).slice(2);
  const DASBOR = /\/(main|beranda|dashboard|home)(\/|$|\?)|\/(sipp|index\.php)\/?$/i;

  const konf = { jeda: 3000, tungguNomorMs: 15000 };
  let terjadwal = null;
  let sudahMemuat = false;

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const kunciNomor = (nomor) => String(nomor || "").replace(/\s+/g, "").toUpperCase();
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  const fungsi = (nama) => (typeof globalThis[nama] === "function" ? globalThis[nama] : null);

  async function baca() {
    try {
      const s = await chrome.storage.local.get([KUNCI]);
      return s && s[KUNCI] && typeof s[KUNCI] === "object" ? s[KUNCI] : {};
    } catch {
      return {};
    }
  }
  async function tulis(peta) {
    try {
      const urut = Object.entries(peta).sort((a, b) => Number((b[1] && b[1].waktu) || 0) - Number((a[1] && a[1].waktu) || 0));
      await chrome.storage.local.set({ [KUNCI]: Object.fromEntries(urut.slice(0, BATAS_CATAT)) });
    } catch {
      /* ringkasan sesudah memuat ulang hanya kemudahan */
    }
  }

  /** Alamat yang dapat dibuka ulang: pintu masuk perkara bila terbaca, kalau tidak alamat detil sekarang. */
  function alamatSekarang() {
    const f = fungsi("alamatMasukPerkara");
    let masuk = "";
    try {
      masuk = f ? f() : "";
    } catch {
      masuk = "";
    }
    const g = fungsi("alamatHalamanPerkara");
    const detil = g && g() ? String(location.href) : "";
    return { masuk, detil };
  }

  /** SEBELUM menulis: simpan ke mana harus kembali. Aman dipanggil berulang. */
  async function catatAlamat(nomor) {
    const k = kunciNomor(nomor);
    if (!k) return false;
    const a = alamatSekarang();
    if (!a.masuk && !a.detil) return false;
    const peta = await baca();
    const lama = peta[k] || {};
    peta[k] = { ...lama, nomor, alamat: a.masuk || lama.alamat || "", alamatDetil: a.detil || lama.alamatDetil || "", waktu: Date.now() };
    await tulis(peta);
    return true;
  }

  /** Ringkasan dari hasil rantai penetapan (tetapkanLewatAleta). */
  function ringkasanDariHasil(hasil, edocPesan) {
    const daftar = (hasil && Array.isArray(hasil.hasil) ? hasil.hasil : []).filter((x) => x && x.jenis);
    let adaGagal = false;
    const baris = daftar.map((x) => {
      const teks = x.ok ? "tercatat" : x.sudahAda ? "sudah tercatat, dilewati" : sebaris(x.bunyi || x.alasan) || "gagal";
      if (!x.ok && !x.sudahAda) adaGagal = true;
      return { jenis: String(x.jenis), teks, nada: x.ok || x.sudahAda ? "ok" : "salah" };
    });
    if (edocPesan) baris.push({ jenis: "e-doc", teks: sebaris(edocPesan.teks), nada: edocPesan.gagal ? "salah" : "ok" });
    if (edocPesan && edocPesan.gagal) adaGagal = true;
    return {
      judul: adaGagal ? "Penetapan belum selesai seluruhnya." : "Penetapan selesai dan tercatat di SIPP.",
      baris,
      adaGagal,
    };
  }

  function jamTampil(ms) {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Kotak ringkasan (sebelum dan sesudah memuat ulang)
  // ──────────────────────────────────────────────────────────────────────────
  function isiBaris(kotak, ringkasan) {
    kotak.appendChild(el("b", "aleta-pen-notis-judul", ringkasan.judul));
    const ul = el("ul", "aleta-pen-notis-daftar");
    for (const b of ringkasan.baris || []) {
      const li = el("li", `aleta-pen-notis-baris aleta-pen-notis-${b.nada === "salah" ? "salah" : "ok"}`);
      li.setAttribute("data-jenis", b.jenis);
      li.append(el("b", "", `${String(b.jenis).toUpperCase()} `), sebaris(b.teks));
      ul.appendChild(li);
    }
    kotak.appendChild(ul);
  }

  function tombolKotak(teks, tanda, utama) {
    const b = el("button", utama ? "aleta-pen-notis-tombol aleta-pen-notis-utama" : "aleta-pen-notis-tombol", teks);
    b.type = "button";
    b.setAttribute("data-pen", tanda);
    return b;
  }

  function pindah(alamat) {
    // Satu tempat bernavigasi: uji menggantinya lewat aletaUjiPindah.
    if (typeof globalThis.aletaUjiPindah === "function") return globalThis.aletaUjiPindah(alamat);
    if (alamat) {
      location.assign(alamat);
      return undefined;
    }
    const f = fungsi("muatUlangHalamanPerkara");
    if (f) f();
    else location.reload();
    return undefined;
  }

  /** Memuat ulang SEKARANG (satu kali per halaman), tetap di perkaranya, dan menyimpan ringkasannya. */
  async function muatUlangSekarang(nomor, ringkasan) {
    if (sudahMemuat) return false;
    const k = kunciNomor(nomor);
    const peta = await baca();
    const lain = peta[k];
    if (lain && lain.menunggu && lain.tab && lain.tab !== IDTAB && Date.now() - Number(lain.saatMuat || 0) < BATAS_TAB_GANDA_MS) {
      // Tab lain sudah dalam perjalanan memuat ulang perkara ini: tidak ganda.
      return false;
    }
    sudahMemuat = true;
    if (terjadwal) {
      clearTimeout(terjadwal.jam);
      clearInterval(terjadwal.detik);
      terjadwal = null;
    }
    const a = alamatSekarang();
    const alamat = a.masuk || (lain && lain.alamat) || a.detil || (lain && lain.alamatDetil) || "";
    const sekarang = Date.now();
    if (k) {
      peta[k] = {
        ...(lain || {}),
        nomor,
        alamat,
        alamatDetil: a.detil || (lain && lain.alamatDetil) || "",
        ringkasan,
        waktu: sekarang,
        saatMuat: sekarang,
        menunggu: true,
        tampilkan: true,
        tab: IDTAB,
      };
      await tulis(peta);
    }
    pindah(alamat);
    return true;
  }

  /**
   * SESUDAH penetapan (dan e-Doc) selesai. Pulang { otomatis } - true bila
   * halaman akan dimuat ulang sendiri.
   * @param {{nomor:string, ringkasan:{judul,baris,adaGagal}, wadah?:HTMLElement}} p
   */
  function jadwalkan(p) {
    const nomor = String((p && p.nomor) || "");
    const ringkasan = (p && p.ringkasan) || { judul: "Penetapan selesai.", baris: [], adaGagal: false };
    if (terjadwal) return { otomatis: true, sudah: true };
    const kotak = el("div", "aleta-sisip aleta-pen-notis");
    kotak.setAttribute("role", "status");
    kotak.setAttribute("data-pen", "muat-ulang");
    isiBaris(kotak, ringkasan);
    const ket = el("p", "aleta-pen-notis-ket");
    const baris = el("div", "aleta-pen-notis-aksi");
    kotak.append(ket, baris);
    const sekarang = tombolKotak("Muat ulang sekarang", "sekarang", true);
    sekarang.addEventListener("click", () => void muatUlangSekarang(nomor, ringkasan));
    baris.appendChild(sekarang);

    if (p && p.wadah) {
      p.wadah.textContent = "";
      p.wadah.appendChild(kotak);
    } else {
      kotak.classList.add("aleta-pen-notis-melayang");
      for (const lama of Array.from(document.querySelectorAll(".aleta-pen-notis-melayang"))) lama.remove();
      document.body.appendChild(kotak);
    }

    if (ringkasan.adaGagal) {
      // Ada yang gagal: tidak dimuat ulang sebelum sebabnya terbaca. Tombol saja.
      ket.textContent = "Halaman tidak dimuat ulang sendiri karena ada yang gagal. Baca sebabnya di atas; muat ulang bila sudah siap.";
      sekarang.textContent = "Muat ulang halaman";
      return { otomatis: false };
    }

    let sisa = Math.max(1, Math.round(konf.jeda / 1000));
    const tulisKet = () => {
      ket.textContent = `Halaman dimuat ulang dalam ${sisa} detik supaya data penetapan baru tampil - tetap di perkara ini.`;
    };
    tulisKet();
    const jangan = tombolKotak("Jangan muat ulang", "jangan", false);
    baris.appendChild(jangan);
    const detik = setInterval(() => {
      sisa = Math.max(1, sisa - 1);
      tulisKet();
    }, 1000);
    const jam = setTimeout(() => {
      clearInterval(detik);
      void muatUlangSekarang(nomor, ringkasan);
    }, konf.jeda);
    terjadwal = { jam, detik };
    jangan.addEventListener("click", () => {
      clearTimeout(jam);
      clearInterval(detik);
      terjadwal = null;
      ket.textContent = "Tidak dimuat ulang. Muat ulang sendiri bila data penetapan di halaman perlu diperbarui.";
      jangan.remove();
      sekarang.textContent = "Muat ulang halaman";
    });
    return { otomatis: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sesudah halaman dimuat: kembali dari dasbor, lalu ringkasan tampil lagi
  // ──────────────────────────────────────────────────────────────────────────
  function halamanDasbor() {
    const g = fungsi("alamatHalamanPerkara");
    if (g && g()) return false;
    return DASBOR.test(String(location.pathname || ""));
  }

  function tampilkanRingkasan(rec, k) {
    if (document.querySelector(".aleta-pen-notis-sesudah")) return;
    const kotak = el("div", "aleta-sisip aleta-pen-notis aleta-pen-notis-melayang aleta-pen-notis-sesudah");
    kotak.setAttribute("role", "status");
    kotak.setAttribute("data-pen", "sesudah");
    const r = rec.ringkasan || { judul: "Penetapan tadi.", baris: [] };
    kotak.appendChild(el("p", "aleta-pen-notis-ket", `Hasil penetapan tadi (${jamTampil(rec.saatMuat || rec.waktu || Date.now())}) - perkara ${rec.nomor || ""}`));
    isiBaris(kotak, r);
    const tutup = tombolKotak("Tutup", "tutup", true);
    tutup.addEventListener("click", () => kotak.remove());
    kotak.appendChild(el("div", "aleta-pen-notis-aksi")).appendChild(tutup);
    document.body.appendChild(kotak);
    void (async () => {
      const peta = await baca();
      if (peta[k]) {
        peta[k] = { ...peta[k], tampilkan: false, ringkasan: undefined };
        await tulis(peta);
      }
    })();
  }

  async function sesudahMemuat() {
    if (!document.body) return;
    const peta = await baca();
    const sekarang = Date.now();
    const entri = Object.entries(peta).filter(([, v]) => v && typeof v === "object");
    // 1. Penanda "menunggu" yang segar: halaman ini hasil muat ulang kita.
    const segar = entri
      .filter(([, v]) => v.menunggu === true && sekarang - Number(v.saatMuat || 0) < UMUR_MENUNGGU_MS)
      .sort((a, b) => Number(b[1].saatMuat) - Number(a[1].saatMuat))[0];
    if (segar) {
      const [k, rec] = segar;
      // Dicabut SEBELUM bernavigasi: sekali saja, tanpa perulangan.
      peta[k] = { ...rec, menunggu: false, kembali: halamanDasbor() };
      await tulis(peta);
      if (halamanDasbor() && rec.alamat) {
        pindah(rec.alamat);
        return;
      }
    }
    // 2. Ringkasan yang menunggu ditampilkan di halaman perkara yang cocok.
    const g = fungsi("alamatHalamanPerkara");
    if (!(g && g())) return;
    const ada = entri.filter(([, v]) => v.tampilkan === true && v.ringkasan && sekarang - Number(v.saatMuat || 0) < UMUR_RINGKASAN_MS);
    if (!ada.length) return;
    const mulai = Date.now();
    const cari = () => {
      const c = fungsi("cariNomorPerkara");
      let nomor = "";
      try {
        nomor = c ? String(c() || "") : "";
      } catch {
        nomor = "";
      }
      const cocok = nomor ? ada.find(([k]) => k === kunciNomor(nomor)) : null;
      if (cocok) {
        tampilkanRingkasan(cocok[1], cocok[0]);
        return;
      }
      if (Date.now() - mulai < konf.tungguNomorMs) setTimeout(cari, 400);
    };
    cari();
  }

  /** Membatalkan hitung mundur yang berjalan (mis. petugas memulai pekerjaan baru). */
  function batal() {
    if (!terjadwal) return false;
    clearTimeout(terjadwal.jam);
    clearInterval(terjadwal.detik);
    terjadwal = null;
    return true;
  }

  globalThis.aletaMuatUlangPen = {
    versi: "p2-20okt",
    konf,
    batal,
    catatAlamat,
    jadwalkan,
    ringkasanDariHasil,
    muatUlangSekarang,
    sesudahMemuat,
    murni: { kunciNomor, DASBOR },
  };
  void sesudahMemuat().catch(() => undefined);
})();
