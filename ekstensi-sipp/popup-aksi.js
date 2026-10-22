"use strict";

/**
 * ============================================================================
 * POP-UP UNTUK TOMBOL AKSI DI HALAMAN SIPP (22 Okt 2026, agen W54)
 * ============================================================================
 *
 * Permintaan hakim: tombol "Jadwalkan Putusan Massal" (daftar perkara perdata gugatan/permohonan),
 * "Penetapan Otomatis", "Putusan Otomatis", dan "Jadwalkan Putusan" tidak lagi MENURUNKAN tabel di dalam
 * halaman, melainkan membuka menu pop-up (jendela di tengah layar). Menutupnya:
 *   - klik DUA KALI di luar kotak (latar redup) -> tutup; satu klik di luar tidak menutup;
 *   - Escape DUA KALI -> tutup; Escape SATU kali -> "Yakin ingin keluar?" di dalam pop-up ([Keluar]/[Batal]);
 *   - tombol x -> tutup; selama ada proses tulis yang berjalan, penutupan DITAHAN dengan pesan.
 *
 * Modul ini hanya WADAH. Panel yang sudah ada (isi, hak peran, mode kering, tombol jalankan) tidak berubah:
 * elemen panelnya dipindahkan ke dalam kotak ini saat dibuka dan diparkir (tersembunyi, tetap di dokumen)
 * saat ditutup, jadi keadaan panel (data terbaca, isian, hasil) tidak hilang. Pemanggil (penetapan-sipp.js,
 * putusan-sipp.js, putusan-terjadwal.js) memanggil atur() tiap kali memasang panel: idempoten.
 *
 *   atur(kunci, akar, buka, { judul, sibuk(), saatTutup() })   true bila pop-up kunci ini terbuka
 *   lepas(awalanKunci)    menutup tanpa bertanya dan tanpa saatTutup (panel dibuang/digantikan pemanggil)
 *   mintaTutup()          jalur tombol x / klik dua kali / Escape: ditahan bila sibuk()
 *   keadaan()             { terbuka, kunci, tanya, pesan } - dipakai uji
 *
 * Tidak menulis apa pun ke SIPP. Kotaknya berkelas aleta-sisip (diabaikan pengamat konten.js).
 */
(function popupAksiModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPopupAksi) return;

  const KELAS_KUNCI_HALAMAN = "aleta-pa-kunci";
  const SELEKTOR_FOKUS =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

  let aktif = null; // { kunci, akar, latar, kotak, judulEl, isi, tanya, pesan, opsi, pembuka, pewaktuPesan }
  let parkir = null;
  let nomorKotak = 0;

  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  function tombol(teks, kelas, tanda) {
    const b = el("button", kelas, teks);
    b.type = "button";
    if (tanda) b.setAttribute("data-pa", tanda);
    return b;
  }
  const sibukSekarang = () => {
    try {
      return Boolean(aktif && aktif.opsi && typeof aktif.opsi.sibuk === "function" && aktif.opsi.sibuk());
    } catch {
      return false;
    }
  };

  /** Tempat panel disimpan selama pop-up tertutup: tersembunyi, tetapi tetap di dokumen supaya pemasangnya menemukannya. */
  function ambilParkir() {
    if (parkir && parkir.isConnected) return parkir;
    parkir = el("div", "aleta-sisip aleta-pa-parkir");
    parkir.hidden = true;
    parkir.setAttribute("data-pa", "parkir");
    (document.body || document.documentElement).appendChild(parkir);
    return parkir;
  }

  function terlihat(e) {
    if (!e || e.hidden) return false;
    for (let p = e.parentElement; p; p = p.parentElement) if (p.hidden) return false;
    return true;
  }
  function daftarFokus() {
    if (!aktif) return [];
    const wadah = [aktif.kotak, ...Array.from(document.querySelectorAll(".aleta-mu-melayang"))];
    const hasil = [];
    for (const w of wadah) {
      for (const e of Array.from(w.querySelectorAll(SELEKTOR_FOKUS))) {
        if (terlihat(e) && !e.disabled) hasil.push(e);
      }
    }
    return hasil;
  }
  function fokusAwal() {
    if (!aktif) return;
    const dalam = Array.from(aktif.isi.querySelectorAll(SELEKTOR_FOKUS)).find((e) => terlihat(e) && !e.disabled);
    const sasaran = dalam || aktif.tutup;
    try {
      sasaran.focus({ preventScroll: true });
    } catch {
      /* fokus hanya kenyamanan */
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pesan dan pertanyaan di dalam pop-up
  // ──────────────────────────────────────────────────────────────────────────
  function tampilPesan(teks) {
    if (!aktif) return;
    aktif.pesan.textContent = teks;
    aktif.pesan.hidden = !teks;
    clearTimeout(aktif.pewaktuPesan);
    if (teks) {
      const sini = aktif;
      sini.pewaktuPesan = setTimeout(() => {
        if (aktif === sini) {
          sini.pesan.textContent = "";
          sini.pesan.hidden = true;
        }
      }, 6000);
    }
  }
  function tanyaTampil() {
    return Boolean(aktif && !aktif.tanya.hidden);
  }
  function bukaTanya() {
    if (!aktif) return;
    aktif.tanya.hidden = false;
    const batal = aktif.tanya.querySelector('[data-pa="batal"]');
    if (batal) {
      try {
        batal.focus({ preventScroll: true });
      } catch {
        /* fokus hanya kenyamanan */
      }
    }
  }
  function tutupTanya() {
    if (!aktif) return;
    aktif.tanya.hidden = true;
    fokusAwal();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Menutup
  // ──────────────────────────────────────────────────────────────────────────
  function tutupDalam(a, panggil) {
    if (!a || aktif !== a) return;
    aktif = null;
    document.removeEventListener("keydown", surutTombol, true);
    document.removeEventListener("focusin", jagaFokus, true);
    clearTimeout(a.pewaktuPesan);
    try {
      document.documentElement.classList.remove(KELAS_KUNCI_HALAMAN);
    } catch {
      /* kelas halaman hanya kenyamanan */
    }
    if (a.akar) {
      a.akar.hidden = true;
      try {
        ambilParkir().appendChild(a.akar);
      } catch {
        /* tanpa tempat parkir: panel dibuat ulang oleh pemasangnya */
      }
    }
    a.latar.remove();
    if (a.pembuka && a.pembuka.isConnected && typeof a.pembuka.focus === "function") {
      try {
        a.pembuka.focus({ preventScroll: true });
      } catch {
        /* fokus hanya kenyamanan */
      }
    }
    if (panggil && a.opsi && typeof a.opsi.saatTutup === "function") {
      try {
        a.opsi.saatTutup();
      } catch {
        /* pemanggil tidak boleh menggagalkan penutupan */
      }
    }
  }

  /** Jalur petugas (x / klik dua kali / Escape kedua / [Keluar]). Pulang true bila tertutup. */
  function mintaTutup() {
    if (!aktif) return false;
    if (sibukSekarang()) {
      tampilPesan("Sedang bekerja. Tunggu sampai selesai - jendela ini tidak ditutup di tengah proses supaya tidak ada yang setengah tertulis.");
      return false;
    }
    tutupDalam(aktif, true);
    return true;
  }

  /** Tanpa bertanya, tanpa saatTutup: pemanggil sendiri yang membuang panelnya. */
  function lepas(awalan) {
    if (!aktif) return false;
    if (awalan && !String(aktif.kunci).startsWith(String(awalan))) return false;
    tutupDalam(aktif, false);
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Papan ketik dan fokus
  // ──────────────────────────────────────────────────────────────────────────
  function surutTombol(e) {
    if (!aktif) return;
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat || e.isComposing) return;
      if (sibukSekarang()) {
        tampilPesan("Sedang bekerja. Tunggu sampai selesai - jendela ini tidak ditutup di tengah proses.");
        return;
      }
      // Escape pertama bertanya; Escape berikutnya (selama pertanyaan tampil) menutup.
      if (tanyaTampil()) mintaTutup();
      else bukaTanya();
      return;
    }
    if (e.key === "Tab") {
      const daftar = daftarFokus();
      if (!daftar.length) {
        e.preventDefault();
        return;
      }
      const sekarang = daftar.indexOf(document.activeElement);
      const maju = !e.shiftKey;
      if (sekarang < 0) {
        e.preventDefault();
        daftar[maju ? 0 : daftar.length - 1].focus();
      } else if (maju && sekarang === daftar.length - 1) {
        e.preventDefault();
        daftar[0].focus();
      } else if (!maju && sekarang === 0) {
        e.preventDefault();
        daftar[daftar.length - 1].focus();
      }
    }
  }
  /** Fokus yang lari ke luar kotak (halaman di belakang) ditarik kembali; kotak muat ulang melayang tetap boleh. */
  function jagaFokus(e) {
    if (!aktif) return;
    // Selama proses berjalan, pengisian otomatis halaman SIPP (di belakang kotak) boleh memindahkan fokus.
    if (sibukSekarang()) return;
    const t = e.target;
    if (!t || !(t instanceof Node)) return;
    if (aktif.kotak.contains(t)) return;
    if (t.closest && t.closest(".aleta-mu-melayang")) return;
    fokusAwal();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Membuka
  // ──────────────────────────────────────────────────────────────────────────
  function bukaBaru(kunci, akar, opsi) {
    nomorKotak += 1;
    const idJudul = `aleta-pa-judul-${nomorKotak}`;
    const latar = el("div", "aleta-sisip aleta-pa-latar");
    latar.setAttribute("data-pa", "latar");
    const kotak = el("div", "aleta-pa-kotak");
    kotak.setAttribute("role", "dialog");
    kotak.setAttribute("aria-modal", "true");
    kotak.setAttribute("aria-labelledby", idJudul);
    kotak.setAttribute("tabindex", "-1");
    kotak.setAttribute("data-pa", "kotak");

    const kepala = el("div", "aleta-pa-kepala");
    const judulEl = el("h2", "aleta-pa-judul", String((opsi && opsi.judul) || ""));
    judulEl.id = idJudul;
    const tutup = tombol("×", "aleta-pa-tutup", "tutup");
    tutup.setAttribute("aria-label", "Tutup");
    tutup.title = "Tutup (klik dua kali di luar kotak atau tekan Esc dua kali)";
    tutup.addEventListener("click", () => mintaTutup());
    kepala.append(judulEl, tutup);

    const tanya = el("div", "aleta-pa-tanya");
    tanya.hidden = true;
    tanya.setAttribute("role", "alertdialog");
    tanya.setAttribute("aria-label", "Konfirmasi keluar");
    tanya.setAttribute("data-pa", "tanya");
    const tanyaTeks = el("span", "aleta-pa-tanya-teks", "Yakin ingin keluar?");
    const keluar = tombol("Keluar", "aleta-pa-tombol aleta-pa-utama", "keluar");
    keluar.addEventListener("click", () => mintaTutup());
    const batal = tombol("Batal", "aleta-pa-tombol", "batal");
    batal.addEventListener("click", () => tutupTanya());
    tanya.append(tanyaTeks, keluar, batal);

    const pesan = el("div", "aleta-pa-pesan");
    pesan.hidden = true;
    pesan.setAttribute("role", "status");
    pesan.setAttribute("aria-live", "polite");
    pesan.setAttribute("data-pa", "pesan");

    const isi = el("div", "aleta-pa-isi");
    isi.setAttribute("data-pa", "isi");
    kotak.append(kepala, tanya, pesan, isi);
    latar.appendChild(kotak);
    // Klik DUA KALI tepat di latar (bukan di kotak) menutup; satu klik tidak.
    latar.addEventListener("dblclick", (e) => {
      if (e.target === latar) mintaTutup();
    });

    akar.hidden = false;
    isi.appendChild(akar);
    (document.body || document.documentElement).appendChild(latar);
    aktif = { kunci, akar, latar, kotak, judulEl, isi, tanya, pesan, tutup, opsi: opsi || {}, pembuka: document.activeElement, pewaktuPesan: null };
    try {
      document.documentElement.classList.add(KELAS_KUNCI_HALAMAN);
    } catch {
      /* kelas halaman hanya kenyamanan */
    }
    document.addEventListener("keydown", surutTombol, true);
    document.addEventListener("focusin", jagaFokus, true);
    fokusAwal();
    return true;
  }

  /**
   * Menyelaraskan pop-up dengan keadaan panel: buka = true -> terbuka (bila belum); false -> tertutup (bila
   * pop-up ini yang terbuka). Dipanggil tiap putaran pemasangan; tidak melakukan apa-apa bila sudah selaras.
   */
  function atur(kunci, akar, buka, opsi) {
    if (!akar) return false;
    if (!buka) {
      if (aktif && aktif.kunci === kunci) tutupDalam(aktif, false);
      return false;
    }
    if (aktif && aktif.kunci === kunci) {
      aktif.opsi = opsi || aktif.opsi;
      if (opsi && opsi.judul != null && aktif.judulEl.textContent !== String(opsi.judul)) aktif.judulEl.textContent = String(opsi.judul);
      // Pemasang membuat panel baru (mis. digambar ulang): yang baru menggantikan yang lama di dalam kotak.
      if (aktif.akar !== akar) {
        const lama = aktif.akar;
        aktif.akar = akar;
        akar.hidden = false;
        aktif.isi.appendChild(akar);
        if (lama && lama.isConnected && lama !== akar) lama.remove();
      } else if (akar.parentNode !== aktif.isi) {
        aktif.isi.appendChild(akar);
      }
      akar.hidden = false;
      return true;
    }
    if (aktif) {
      // Pop-up lain sedang terbuka: tidak direbut; yang diminta dikembalikan ke keadaan tertutup.
      if (opsi && typeof opsi.saatTutup === "function") {
        try {
          opsi.saatTutup();
        } catch {
          /* tidak mengganggu */
        }
      }
      return false;
    }
    return bukaBaru(kunci, akar, opsi);
  }

  function keadaan() {
    return {
      terbuka: Boolean(aktif),
      kunci: aktif ? aktif.kunci : "",
      tanya: tanyaTampil(),
      pesan: aktif && !aktif.pesan.hidden ? aktif.pesan.textContent : "",
      sibuk: sibukSekarang(),
    };
  }

  globalThis.aletaPopupAksi = {
    versi: "w54-22okt",
    atur,
    lepas,
    mintaTutup,
    keadaan,
  };
})();
