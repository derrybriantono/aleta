"use strict";

/**
 * ============================================================================
 * SAKLAR "SIPP DENGAN IDE ALETA" GELOMBANG 1 (Tahap L2, 16 Okt 2026) - POPUP
 * ============================================================================
 *
 * Satu saklar induk (ideL2) dan sebelas saklar penanda. Kunci boolean datar di
 * chrome.storage.local; tidak ada kunci = MENYALA (penanda hanya menambah
 * keterangan, tidak mengubah SIPP). Pembacanya ekstensi-sipp/sipp-ide-l2.js.
 *
 * Saklar yang tidak berguna bagi peran yang masuk DISEMBUNYIKAN (nilainya tetap
 * tersimpan) - tabel peran SAMA dengan manajemen_surat/src/lib/sipp-ide-l2.ts
 * (dijaga uji sipp-ide-l2-16okt). Portal tetap menyaring lagi menurut peran,
 * jadi saklar yang tersembunyi tidak membuka apa pun.
 *
 * Menyimpan lewat simpanSaklar() milik popup.js: penyimpanan yang menolak
 * menulis mengembalikan centangnya dan menyebut sebabnya.
 */
(function () {
  /** id kotak -> [kunci penyimpanan, kode penanda | null untuk saklar induk]. */
  const SAKLAR_IDE_L2 = {
    ideL2: ["ideL2", null],
    ideL2Sita: ["ideL2Sita", "sita"],
    ideL2Eksekusi: ["ideL2Eksekusi", "eksekusi"],
    ideL2IzinCerai: ["ideL2IzinCerai", "izin-cerai"],
    ideL2Penetapan: ["ideL2Penetapan", "penetapan-awal"],
    ideL2BelumDitunda: ["ideL2BelumDitunda", "belum-ditunda"],
    ideL2Verstek: ["ideL2Verstek", "potensi-verstek"],
    ideL2Umur: ["ideL2Umur", "umur-perkara"],
    ideL2TanpaSidang: ["ideL2TanpaSidang", "tanpa-sidang-berikut"],
    ideL2Ikrar: ["ideL2Ikrar", "sisa-ikrar"],
    ideL2AktaCerai: ["ideL2AktaCerai", "akta-cerai"],
    ideL2LimaBulan: ["ideL2LimaBulan", "lewat-5-bulan"],
    ideL2EcourtVerifikasi: ["ideL2EcourtVerifikasi", "ecourt-verifikasi"],
  };

  /** Golongan (selain Super Admin/Admin) yang melihat tiap penanda - sama dengan lib/sipp-ide-l2.ts. */
  const PERAN_IDE_L2 = {
    sita: ["ketua", "hakim", "panitera-pengganti", "juru-sita", "panitera"],
    eksekusi: ["ketua", "hakim", "panitera-pengganti", "juru-sita", "panitera"],
    "izin-cerai": ["ketua", "hakim", "panitera-pengganti", "panitera"],
    "penetapan-awal": ["ketua", "panitera", "panitera-pengganti"],
    "belum-ditunda": ["ketua", "hakim", "panitera-pengganti", "panitera"],
    "potensi-verstek": ["ketua", "hakim", "panitera-pengganti"],
    "umur-perkara": ["ketua", "hakim", "panitera-pengganti", "panitera"],
    "tanpa-sidang-berikut": ["ketua", "hakim", "panitera-pengganti", "panitera"],
    "sisa-ikrar": ["ketua", "hakim", "panitera-pengganti", "panitera"],
    "akta-cerai": ["ketua", "panitera", "panitera-pengganti", "ptsp"],
    "lewat-5-bulan": ["ketua"],
    "ecourt-verifikasi": ["ketua", "hakim", "panitera-pengganti"],
  };

  const gudang =
    typeof chrome !== "undefined" && chrome.storage && chrome.storage.local ? chrome.storage.local : null;

  function kotakDari(id) {
    return document.getElementById(id);
  }

  function pasang(simpan) {
    for (const [id, [kunci]] of Object.entries(SAKLAR_IDE_L2)) {
      const k = kotakDari(id);
      if (k) k.checked = simpan[kunci] !== false;
    }
  }

  /** Golongan yang masuk, dari identitasPopup milik popup.js; null = belum diketahui. */
  function golonganMasuk() {
    try {
      // eslint-disable-next-line no-undef
      const id = typeof identitasPopup !== "undefined" ? identitasPopup : null;
      return id && id.golongan && Array.isArray(id.golongan.semua) ? id.golongan.semua : null;
    } catch {
      return null;
    }
  }

  /** Menyembunyikan saklar penanda yang tidak berguna bagi peran ini. Super Admin, Admin, belum diketahui = semua. */
  function terapkanPeranIdeL2() {
    const semua = golonganMasuk();
    const semuanya = !semua || semua.includes("super-admin") || semua.includes("admin");
    let tampil = 0;
    for (const [id, [, kode]] of Object.entries(SAKLAR_IDE_L2)) {
      if (!kode) continue;
      const k = kotakDari(id);
      const label = k ? k.closest("label.saklar") : null;
      if (!label) continue;
      const boleh = semuanya || (PERAN_IDE_L2[kode] || []).some((g) => semua.includes(g));
      if (boleh) {
        label.removeAttribute("data-peran-sembunyi");
        tampil += 1;
      } else label.setAttribute("data-peran-sembunyi", "ya");
    }
    const kotak = kotakDari("ideL2Kotak");
    if (kotak) {
      if (tampil === 0) kotak.setAttribute("data-peran-sembunyi", "ya");
      else kotak.removeAttribute("data-peran-sembunyi");
    }
  }

  /** UI Baru menyusun saklar SIPP ke kelompok "SIPP" - kotak ini ikut ke sana. */
  function ikutKelompokSipp() {
    const kotak = kotakDari("ideL2Kotak");
    const kelompok = document.getElementById("kelompok-sipp");
    if (kotak && kelompok && kotak.parentNode !== kelompok) kelompok.appendChild(kotak);
  }

  for (const [id, [kunci]] of Object.entries(SAKLAR_IDE_L2)) {
    const k = kotakDari(id);
    if (!k) continue;
    k.addEventListener("change", () => {
      // simpanSaklar milik popup.js (mengembalikan centang bila gagal).
      // eslint-disable-next-line no-undef
      if (typeof simpanSaklar === "function") void simpanSaklar({ [kunci]: k.checked }, k);
      else if (gudang) void Promise.resolve(gudang.set({ [kunci]: k.checked })).catch(() => {});
    });
  }

  if (gudang) {
    Promise.resolve()
      .then(() => gudang.get(Object.values(SAKLAR_IDE_L2).map((x) => x[0])))
      .then((s) => pasang(s || {}))
      .catch(() => pasang({}));
  } else {
    pasang({});
  }

  // Peran diketahui sesudah portal menjawab (popup.js: terapkanPeranPopup). Dibungkus
  // supaya penyembunyian ini ikut setiap kali popup.js menyusun ulang perannya.
  try {
    // eslint-disable-next-line no-undef
    if (typeof terapkanPeranPopup === "function") {
      // eslint-disable-next-line no-undef
      const asli = terapkanPeranPopup;
      // eslint-disable-next-line no-global-assign, no-func-assign
      terapkanPeranPopup = function () {
        const hasil = asli.apply(this, arguments);
        ikutKelompokSipp();
        terapkanPeranIdeL2();
        return hasil;
      };
    }
  } catch {
    /* popup lama tanpa fungsi peran */
  }
  terapkanPeranIdeL2();
  ikutKelompokSipp();
  // Kelompok UI Baru dibuat sesudah skrip ini terbaca.
  try {
    const isi = document.querySelector(".isi");
    if (isi && typeof MutationObserver === "function") {
      new MutationObserver(() => ikutKelompokSipp()).observe(isi, { childList: true });
    }
  } catch {
    /* tanpa pengamat: kotak tetap di tempat asalnya */
  }
})();
