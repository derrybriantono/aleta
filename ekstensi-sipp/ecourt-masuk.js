"use strict";

/**
 * ============================================================================
 * HALAMAN e-COURT YANG DIBUKA DARI MENU "E-COURT" DI BILAH ATAS SIPP (22 Okt 2026)
 * ============================================================================
 *
 * Skrip konten kecil di https://ecourt.mahkamahagung.go.id/*. Ia HANYA bekerja di tab
 * yang dibuka lewat menu itu (pekerja latar mencatat tab tersebut; tab lain, juga yang
 * dibuka pengguna sendiri, tidak disentuh sama sekali):
 *
 *   1. Halaman Login (jalur /Login saja): mengisi kolom NAMA PENGGUNA dengan surel akun e-Court milik
 *      pengguna yang tersimpan (hanya bila kolomnya masih kosong). Kolom SANDI, captcha,
 *      dan tombol masuk TIDAK pernah disentuh - sandi diketik pengguna atau diisi
 *      pengelola sandi Chrome. Sandi tidak pernah sampai ke ekstensi ini.
 *   2. Menjaga sesi tetap hidup: sesudah pengguna masuk sendiri (halaman bukan Login),
 *      satu permintaan ringan tiap beberapa menit ke halaman Login e-Court - halaman itu
 *      mengalihkan ke dalam bila sesinya sah, dan menampilkan formulir bila sudah habis
 *      (itu bukti yang sama dengan yang dibaca bot, ecourtSesiRinganService). Berhenti
 *      sendiri bila sesinya habis, bila gagal berturut-turut, atau setelah 12 jam.
 *      Tidak menyentuh isi halaman dan tidak mengirim apa pun selain GET tanpa badan.
 *
 * Skrip ini tidak menambahkan tulisan, kelas, atau atribut ke halaman e-Court;
 * satu-satunya perubahan olehnya adalah nilai kolom nama pengguna. (Warna gelap
 * dipasang skrip terpisah, ecourt-tema.js, lewat satu atribut di <html>.)
 */
(function ecourtMasukModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaEcourtMasuk) return;

  const HOST = "ecourt.mahkamahagung.go.id";
  const JEDA_JAGA_MS = 4 * 60 * 1000;
  const BATAS_JAGA_MS = 12 * 60 * 60 * 1000;
  const BATAS_GAGAL = 3;

  /** Kolom isian yang tampak (bukan hidden/submit/captcha). */
  function kolomTeks(f) {
    return Array.from(f.querySelectorAll("input")).filter((i) => {
      const t = String(i.type || "text").toLowerCase();
      if (!["text", "email", ""].includes(t)) return false;
      if (i.hidden || i.disabled || i.readOnly) return false;
      const ciri = `${i.name || ""} ${i.id || ""} ${i.placeholder || ""} ${i.getAttribute("autocomplete") || ""}`.toLowerCase();
      return !/captcha|kode|security/.test(ciri);
    });
  }

  /** { formulir, nama, sandi } bila halaman ini formulir masuk (ada kolom sandi), selain itu null. */
  function kenaliFormulirMasuk(d) {
    for (const sandi of Array.from(d.querySelectorAll('input[type="password"]'))) {
      const f = sandi.form || sandi.closest("form") || d;
      const calon = kolomTeks(f);
      // Kolom nama pengguna = kolom teks yang paling dekat SEBELUM kolom sandi.
      const sebelum = calon.filter((c) => c.compareDocumentPosition(sandi) & 4 /* DOCUMENT_POSITION_FOLLOWING */);
      const nama = sebelum[sebelum.length - 1] || null;
      if (nama) return { formulir: f, nama, sandi };
    }
    return null;
  }

  /** Mengisi seperti diketik. HANYA kolom nama pengguna, HANYA bila kosong. Pulang true bila diisi. */
  function isiNama(d, surel) {
    const nilai = String(surel || "").trim();
    if (!nilai || nilai.length > 120 || /[\u0000-\u001f\u007f]/.test(nilai)) return false;
    const k = kenaliFormulirMasuk(d);
    if (!k || k.nama.value) return false;
    const proto = Object.getPrototypeOf(k.nama);
    const setel = proto && Object.getOwnPropertyDescriptor(proto, "value");
    if (setel && setel.set) setel.set.call(k.nama, nilai);
    else k.nama.value = nilai;
    k.nama.dispatchEvent(new Event("input", { bubbles: true }));
    k.nama.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const halamanLogin = (loc) => /^\/login(\/|$)/i.test(String((loc || location).pathname || ""));

  function kirimLatar(pesan) {
    return new Promise((selesai) => {
      const jam = setTimeout(() => selesai(null), 8000);
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

  /**
   * Satu denyut penjaga sesi. Pulang "hidup" | "habis" | "gagal".
   * redirect "manual": /Login yang mengalihkan (opaqueredirect / 3xx) = sesi sah; 200 = formulir masuk = habis.
   */
  async function denyut(opsi) {
    const o = opsi || {};
    const ambil = o.fetch || globalThis.fetch;
    try {
      const r = await ambil(`${(o.loc || location).origin}/Login`, { method: "GET", credentials: "include", cache: "no-store", redirect: "manual" });
      if (r.type === "opaqueredirect" || (r.status >= 300 && r.status < 400)) return "hidup";
      if (r.status === 200) return "habis";
      return "gagal";
    } catch {
      return "gagal";
    }
  }

  let pewaktu = null;
  function mulaiJaga(opsi) {
    const o = opsi || {};
    if (pewaktu) return false;
    const mulai = Date.now();
    let gagal = 0;
    const henti = () => {
      if (pewaktu) clearInterval(pewaktu);
      pewaktu = null;
    };
    pewaktu = setInterval(async () => {
      if (Date.now() - mulai > (o.batasMs || BATAS_JAGA_MS)) return henti();
      const h = await denyut(o);
      if (h === "habis") return henti();
      gagal = h === "gagal" ? gagal + 1 : 0;
      if (gagal >= BATAS_GAGAL) henti();
      return undefined;
    }, o.jedaMs || JEDA_JAGA_MS);
    try {
      globalThis.addEventListener("pagehide", henti, { once: true });
    } catch {
      /* tanpa pagehide: berhenti sendiri oleh batas waktu */
    }
    return true;
  }

  async function mulai(opsi) {
    const o = opsi || {};
    try {
      if (String((o.loc || location).hostname) !== HOST) return { aksi: "bukan-ecourt" };
      let h = null;
      // Tab baru: catatan tab dari pekerja latar bisa terlambat sekejap - tanya beberapa kali.
      for (let i = 0; i < 4 && !(h && h.ok); i += 1) {
        h = await (o.kirimLatar || kirimLatar)({ jenis: "menu-ecourt-nama" });
        if (h && h.ok) break;
        if (i < 3) await new Promise((r) => setTimeout(r, o.jedaTanyaMs || 400));
      }
      if (!h || h.ok !== true) return { aksi: "bukan-dari-menu" };
      const d = o.doc || document;
      let diisi = false;
      // Hanya di halaman Login: formulir sandi di halaman lain (mis. ubah sandi) tidak pernah diisi.
      if (h.surel && halamanLogin(o.loc)) {
        diisi = isiNama(d, h.surel);
        // Halaman Login yang formulirnya belum tergambar: tunggu sebentar, lalu berhenti mengamati.
        if (!diisi && typeof MutationObserver === "function" && d.body) {
          const pengamat = new MutationObserver(() => {
            if (isiNama(d, h.surel)) pengamat.disconnect();
          });
          pengamat.observe(d.body, { childList: true, subtree: true });
          setTimeout(() => pengamat.disconnect(), 8000);
        }
      }
      let menjaga = false;
      if (h.jaga && !halamanLogin(o.loc)) menjaga = mulaiJaga(o);
      return { aksi: "dikerjakan", diisi, menjaga };
    } catch {
      return { aksi: "galat" };
    }
  }

  globalThis.aletaEcourtMasuk = { mulai, isiNama, kenaliFormulirMasuk, denyut, mulaiJaga, halamanLogin };
  void mulai();
})();
