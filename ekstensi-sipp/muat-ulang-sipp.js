"use strict";

/**
 * ============================================================================
 * MUAT ULANG BERSAMA SESUDAH MENULIS KE SIPP - TETAP DI HALAMANNYA (20 Okt 2026)
 * ============================================================================
 *
 * Satu modul untuk SEMUA jalur ekstensi/widget/penanda halaman SIPP yang
 * menulis ke SIPP (lewat bot/portal, atau dengan mengisi lalu menekan Simpan
 * borang SIPP) sehingga halaman yang terbuka menampilkan data basi. Daftar
 * jalur dan keputusannya: docs/muat-ulang/DAFTAR-JALUR-TULIS-SIPP.md.
 *
 *   catatAlamat(kunci)     SEBELUM menulis: simpan alamat halaman ini (pintu
 *                          masuk perkara perkara_detil/<enc> bila halaman
 *                          perkara, kalau tidak alamat saat ini) di
 *                          chrome.storage.local.
 *   jadwalkan({...})       SESUDAH selesai: ringkasan per langkah + hitung
 *                          mundur (3 detik) + tombol "Muat ulang sekarang" /
 *                          "Jangan muat ulang". Ada yang GAGAL = tidak dimuat
 *                          ulang sendiri, hanya tombol (sebab terbaca dulu).
 *   pasangPengawal(kunci)  Untuk jalur yang menekan Simpan borang SIPP: SIPP
 *                          sendiri yang memuat ulang. Pengawal hanya menjaga
 *                          bila SIPP menjatuhkan halaman ke dasbor - petugas
 *                          dikembalikan ke alamat semula SEKALI saja.
 *   tahan() / lepasTahan() Antrean massal: muat ulang di tengah antrean
 *                          DITAHAN (juga dari muatUlangHalamanPerkara lama);
 *                          sekali saja di akhir, kembali ke halaman asal.
 *   sesudahMemuat()        Dipanggil sendiri saat skrip dimuat: kembali dari
 *                          dasbor (sekali, penanda dicabut lebih dulu - tanpa
 *                          perulangan) dan menampilkan lagi ringkasan hasil
 *                          sesudah muat ulang (sekali, lalu bersih).
 *   Dua tab                tab lain yang sedang dalam perjalanan memuat ulang
 *                          halaman yang sama (penanda masih menyala) tidak
 *                          memuat ulang lagi.
 *
 * Tidak menulis apa pun ke SIPP. Kotaknya berkelas aleta-sisip (diabaikan
 * pengamat konten.js).
 */
(function muatUlangSippModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaMuatUlangSipp) return;

  const KUNCI = "muatUlangSipp";
  const UMUR_MENUNGGU_MS = 60 * 1000;
  const UMUR_RINGKASAN_MS = 10 * 60 * 1000;
  const BATAS_TAB_GANDA_MS = 8 * 1000;
  const BATAS_CATAT = 8;
  const IDTAB = Math.random().toString(36).slice(2);
  const DASBOR = /\/(main|beranda|dashboard|home)(\/|$|\?)|\/(sipp|index\.php)\/?$/i;

  const konf = { jeda: 3000, tungguNomorMs: 15000, pengawalMs: 15000 };
  let terjadwal = null;
  let sudahMemuat = false;
  let tahanHitung = 0;
  let tahanSejak = 0;
  let tertunda = null;
  // Tahanan yang bocor (antrean mati di tengah) tidak menahan selamanya.
  const BATAS_TAHAN_MS = 3 * 60 * 60 * 1000;
  const sedangDitahan = () => {
    if (tahanHitung > 0 && Date.now() - tahanSejak > BATAS_TAHAN_MS) tahanHitung = 0;
    return tahanHitung > 0;
  };

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const kunciNomor = (nomor) => String(nomor || "").replace(/\s+/g, "").toUpperCase();
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  const fungsi = (nama) => (typeof globalThis[nama] === "function" ? globalThis[nama] : null);
  const halamanPerkara = () => {
    const g = fungsi("alamatHalamanPerkara");
    return Boolean(g && g());
  };

  /** Kunci catatan: nomor perkara bila ada, kalau tidak halaman ini (jalur + query). */
  function kunciDari(nomorAtauKunci) {
    const n = sebaris(nomorAtauKunci);
    if (n) return kunciNomor(n);
    return `H:${String(location.pathname || "")}${String(location.search || "")}`;
  }

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

  /** Alamat yang dapat dibuka ulang: pintu masuk perkara bila terbaca, dan alamat halaman ini. */
  function alamatSekarang() {
    const f = fungsi("alamatMasukPerkara");
    let masuk = "";
    try {
      masuk = f && halamanPerkara() ? f() : "";
    } catch {
      masuk = "";
    }
    return { masuk, detil: String(location.href) };
  }

  /** SEBELUM menulis: simpan ke mana harus kembali. Aman dipanggil berulang. */
  async function catatAlamat(nomorAtauKunci) {
    const k = kunciDari(nomorAtauKunci);
    const a = alamatSekarang();
    const peta = await baca();
    const lama = peta[k] || {};
    peta[k] = { ...lama, nomor: sebaris(nomorAtauKunci), alamat: a.masuk || lama.alamat || "", alamatDetil: a.detil || lama.alamatDetil || "", waktu: Date.now() };
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

  /** Ringkasan umum untuk jalur lain: baris = [{ jenis(label), teks, ok }]. */
  function ringkasan(judulOk, baris, judulGagal) {
    const b = (baris || []).map((x) => ({ jenis: String(x.jenis || x.label || "hasil"), teks: sebaris(x.teks), nada: x.ok === false ? "salah" : "ok" }));
    const adaGagal = b.some((x) => x.nada === "salah");
    return { judul: adaGagal ? judulGagal || "Belum selesai seluruhnya." : judulOk, baris: b, adaGagal };
  }

  function jamTampil(ms) {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Kotak ringkasan (sebelum dan sesudah memuat ulang)
  // ──────────────────────────────────────────────────────────────────────────
  function isiBaris(kotak, r) {
    kotak.appendChild(el("b", "aleta-mu-judul", r.judul));
    if (!(r.baris || []).length) return;
    const ul = el("ul", "aleta-mu-daftar");
    for (const b of r.baris) {
      const li = el("li", `aleta-mu-baris aleta-mu-${b.nada === "salah" ? "salah" : "ok"}`);
      li.setAttribute("data-jenis", b.jenis);
      li.append(el("b", "", `${String(b.jenis).toUpperCase()} `), sebaris(b.teks));
      ul.appendChild(li);
    }
    kotak.appendChild(ul);
  }

  function tombolKotak(teks, tanda, utama) {
    const b = el("button", utama ? "aleta-mu-tombol aleta-mu-utama" : "aleta-mu-tombol", teks);
    b.type = "button";
    b.setAttribute("data-mu", tanda);
    return b;
  }

  function pindah(alamat) {
    // Satu tempat bernavigasi: uji menggantinya lewat aletaUjiPindah.
    if (typeof globalThis.aletaUjiPindah === "function") return globalThis.aletaUjiPindah(alamat);
    if (alamat) {
      location.assign(alamat);
      return undefined;
    }
    location.reload();
    return undefined;
  }

  /** Memuat ulang SEKARANG (satu kali per halaman), tetap di halamannya, dan menyimpan ringkasannya. */
  async function muatUlangSekarang(nomorAtauKunci, r) {
    if (sudahMemuat) return false;
    const k = kunciDari(nomorAtauKunci);
    const peta = await baca();
    const lain = peta[k];
    if (lain && lain.menunggu && lain.tab && lain.tab !== IDTAB && Date.now() - Number(lain.saatMuat || 0) < BATAS_TAB_GANDA_MS) {
      // Tab lain sudah dalam perjalanan memuat ulang halaman ini: tidak ganda.
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
    peta[k] = {
      ...(lain || {}),
      nomor: sebaris(nomorAtauKunci),
      alamat,
      alamatDetil: a.detil || (lain && lain.alamatDetil) || "",
      ringkasan: r,
      waktu: sekarang,
      saatMuat: sekarang,
      sampai: sekarang + UMUR_MENUNGGU_MS,
      menunggu: true,
      tampilkan: Boolean(r),
      tab: IDTAB,
    };
    await tulis(peta);
    pindah(alamat);
    return true;
  }

  /**
   * SESUDAH menulis (dan e-Doc) selesai. Pulang { otomatis } - true bila
   * halaman akan dimuat ulang sendiri; { tertunda:true } bila antrean massal
   * masih berjalan (dimuat ulang SEKALI di akhir, lewat lepasTahan).
   * @param {{nomor?:string, kunci?:string, ringkasan:{judul,baris,adaGagal}, wadah?:HTMLElement}} p
   */
  function jadwalkan(p) {
    if (sedangDitahan()) {
      tertunda = { ...p };
      return { otomatis: false, tertunda: true };
    }
    const nomor = String((p && (p.nomor || p.kunci)) || "");
    const r = (p && p.ringkasan) || { judul: "Selesai.", baris: [], adaGagal: false };
    if (terjadwal) return { otomatis: true, sudah: true };
    const kotak = el("div", "aleta-sisip aleta-mu");
    kotak.setAttribute("role", "status");
    kotak.setAttribute("data-mu", "muat-ulang");
    isiBaris(kotak, r);
    const ket = el("p", "aleta-mu-ket");
    const baris = el("div", "aleta-mu-aksi");
    kotak.append(ket, baris);
    const sekarang = tombolKotak("Muat ulang sekarang", "sekarang", true);
    sekarang.addEventListener("click", () => void muatUlangSekarang(nomor, r));
    baris.appendChild(sekarang);

    if (p && p.wadah) {
      p.wadah.textContent = "";
      p.wadah.appendChild(kotak);
    } else {
      kotak.classList.add("aleta-mu-melayang");
      for (const lama of Array.from(document.querySelectorAll(".aleta-mu-melayang"))) lama.remove();
      document.body.appendChild(kotak);
    }

    if (r.adaGagal) {
      // Ada yang gagal: tidak dimuat ulang sebelum sebabnya terbaca. Tombol saja.
      ket.textContent = "Halaman tidak dimuat ulang sendiri karena ada yang gagal. Baca sebabnya di atas; muat ulang bila sudah siap.";
      sekarang.textContent = "Muat ulang halaman";
      return { otomatis: false };
    }
    if (p && p.tanpaOtomatis) {
      // Dikerjakan sendiri di latar (tanpa ditekan petugas): halaman yang sedang dipakai tidak direbut.
      ket.textContent = "Selesai dikerjakan di latar. Halaman tidak dimuat ulang sendiri; muat ulang bila ingin melihat data terbaru.";
      sekarang.textContent = "Muat ulang halaman";
      return { otomatis: false };
    }

    let sisa = Math.max(1, Math.round(konf.jeda / 1000));
    const tulisKet = () => {
      ket.textContent = `Halaman dimuat ulang dalam ${sisa} detik supaya data baru tampil - tetap di halaman ini.`;
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
      void muatUlangSekarang(nomor, r);
    }, konf.jeda);
    terjadwal = { jam, detik };
    jangan.addEventListener("click", () => {
      clearTimeout(jam);
      clearInterval(detik);
      terjadwal = null;
      ket.textContent = "Tidak dimuat ulang. Muat ulang sendiri bila data di halaman perlu diperbarui.";
      jangan.remove();
      sekarang.textContent = "Muat ulang halaman";
    });
    return { otomatis: true };
  }

  /** Membatalkan hitung mundur yang berjalan (mis. petugas memulai pekerjaan baru). */
  function batal() {
    if (!terjadwal) return false;
    clearTimeout(terjadwal.jam);
    clearInterval(terjadwal.detik);
    terjadwal = null;
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pengawal: SIPP memuat ulang sendiri sesudah Simpan; kita hanya menjaga agar
  // tidak berakhir di dasbor.
  // ──────────────────────────────────────────────────────────────────────────
  async function pasangPengawal(nomorAtauKunci, ms) {
    const k = kunciDari(nomorAtauKunci);
    const a = alamatSekarang();
    const peta = await baca();
    const lama = peta[k] || {};
    const sekarang = Date.now();
    peta[k] = {
      ...lama,
      nomor: sebaris(nomorAtauKunci),
      alamat: a.masuk || lama.alamat || "",
      alamatDetil: a.detil || lama.alamatDetil || "",
      waktu: sekarang,
      saatMuat: sekarang,
      sampai: sekarang + (ms || konf.pengawalMs),
      menunggu: true,
      tab: IDTAB,
    };
    await tulis(peta);
    return true;
  }
  /** Simpan gagal / tidak ada muat ulang: pengawal dilepas supaya tidak membajak halaman lain. */
  async function lepaskan(nomorAtauKunci) {
    const k = kunciDari(nomorAtauKunci);
    const peta = await baca();
    if (peta[k] && peta[k].menunggu) {
      peta[k] = { ...peta[k], menunggu: false };
      await tulis(peta);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Antrean massal: tidak memuat ulang di tengah, sekali di akhir.
  // ──────────────────────────────────────────────────────────────────────────
  function tahan() {
    if (tahanHitung === 0) tahanSejak = Date.now();
    tahanHitung += 1;
    return tahanHitung;
  }
  /** Mengakhiri satu tahanan; bila yang terakhir, muat ulang yang tertunda dikerjakan SEKALI. */
  function lepasTahan() {
    tahanHitung = Math.max(0, tahanHitung - 1);
    if (tahanHitung > 0 || !tertunda) return false;
    const p = tertunda;
    tertunda = null;
    if (p.legacy) {
      void muatUlangSekarang(p.kunci || "", null);
    } else jadwalkan(p);
    return true;
  }
  /** Dipakai muatUlangHalamanPerkara (jalur lama): true = ditahan, jangan memuat ulang sekarang. */
  function tahanLegacy(kunci) {
    if (!sedangDitahan()) return false;
    tertunda = { legacy: true, kunci: kunci || "" };
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sesudah halaman dimuat: kembali dari dasbor, lalu ringkasan tampil lagi
  // ──────────────────────────────────────────────────────────────────────────
  function halamanDasbor() {
    if (halamanPerkara()) return false;
    return DASBOR.test(String(location.pathname || ""));
  }

  function tampilkanRingkasan(rec, k) {
    if (document.querySelector(".aleta-mu-sesudah")) return;
    const kotak = el("div", "aleta-sisip aleta-mu aleta-mu-melayang aleta-mu-sesudah");
    kotak.setAttribute("role", "status");
    kotak.setAttribute("data-mu", "sesudah");
    const r = rec.ringkasan || { judul: "Hasil tadi.", baris: [] };
    kotak.appendChild(el("p", "aleta-mu-ket", `Hasil tadi (${jamTampil(rec.saatMuat || rec.waktu || Date.now())})${rec.nomor ? ` - ${rec.nomor}` : ""}`));
    isiBaris(kotak, r);
    const tutup = tombolKotak("Tutup", "tutup", true);
    tutup.addEventListener("click", () => kotak.remove());
    kotak.appendChild(el("div", "aleta-mu-aksi")).appendChild(tutup);
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
    // 1. Penanda "menunggu" yang segar: halaman ini hasil muat ulang kita / SIPP.
    const segar = entri
      .filter(([, v]) => v.menunggu === true && sekarang < Number(v.sampai || Number(v.saatMuat || 0) + UMUR_MENUNGGU_MS))
      .sort((a, b) => Number(b[1].saatMuat) - Number(a[1].saatMuat))[0];
    if (segar) {
      const [k, rec] = segar;
      // Dicabut SEBELUM bernavigasi: sekali saja, tanpa perulangan.
      peta[k] = { ...rec, menunggu: false, kembali: halamanDasbor() };
      await tulis(peta);
      if (halamanDasbor() && (rec.alamat || rec.alamatDetil)) {
        pindah(rec.alamat || rec.alamatDetil);
        return;
      }
    }
    // 2. Ringkasan yang menunggu ditampilkan di halaman yang cocok.
    const ada = entri.filter(([, v]) => v.tampilkan === true && v.ringkasan && sekarang - Number(v.saatMuat || 0) < UMUR_RINGKASAN_MS);
    if (!ada.length) return;
    const mulai = Date.now();
    const cari = () => {
      let kunci = "";
      if (halamanPerkara()) {
        const c = fungsi("cariNomorPerkara");
        try {
          kunci = c ? kunciNomor(c() || "") : "";
        } catch {
          kunci = "";
        }
      } else {
        kunci = kunciDari("");
      }
      const cocok = kunci ? ada.find(([k]) => k === kunci) : null;
      if (cocok) {
        tampilkanRingkasan(cocok[1], cocok[0]);
        return;
      }
      if (halamanPerkara() && Date.now() - mulai < konf.tungguNomorMs) setTimeout(cari, 400);
    };
    cari();
  }

  globalThis.aletaMuatUlangSipp = {
    versi: "p2-20okt-bersama",
    konf,
    batal,
    catatAlamat,
    jadwalkan,
    pasangPengawal,
    lepaskan,
    tahan,
    lepasTahan,
    tahanLegacy,
    ringkasan,
    ringkasanDariHasil,
    muatUlangSekarang,
    sesudahMemuat,
    murni: { kunciNomor, kunciDari, DASBOR },
  };
  void sesudahMemuat().catch(() => undefined);
})();
