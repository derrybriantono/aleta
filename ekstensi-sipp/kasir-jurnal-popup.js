"use strict";

/**
 * ============================================================================
 * TOMBOL "KASIR ALETA" DI SIPP > JURNAL PERKARA > JURNAL KEUANGAN PERKARA (T3, 23 Okt 2026)
 * ============================================================================
 *
 * Kasir tidak perlu membuka panel ALETA lalu mencari tab Kasir: di halaman jurnal keuangan SIPP ada satu tombol
 * "Kasir ALETA" yang membuka pop-up (popup-aksi.js: tutup dengan klik DUA KALI di luar kotak atau Escape DUA KALI).
 * Isinya tampilan kerja Kasir yang SAMA dengan tab Kasir ekstensi (basmassal.js):
 *   - halaman jurnal satu perkara (.../detil_biaya, "BUKU JURNAL KEUANGAN PERKARA"): Kasir per perkara;
 *   - halaman daftar jurnal (jurnal_perkara_list / all_jurnal_perkara): Kasir harian (otomatis, pengingat,
 *     massal satu hari, rekap).
 *
 * Hak (di sini hanya kenyamanan; rute kasir menolak sendiri dengan 403):
 *   - kasir / keuangan perkara / bendahara / Admin / Super Admin: penuh;
 *   - panitera dan panitera muda (pengawas): tombol ada, isinya hanya membaca (alatKasirBacaSaja, basmassal.js);
 *   - peran lain, belum masuk ALETA, atau Tampilan Lama: tidak ada tombol.
 *
 * Modul ini tidak menulis apa pun ke SIPP dan tidak mengubah elemen SIPP: hanya MENAMBAH satu tombol di bawah
 * judul halaman. Warna: gaya kasir-jurnal-popup.css (token --s-* dengan cadangan di dalam var()), kotak pop-up
 * mengikuti tema terang/gelap dari penetapan-sipp.css.
 *
 *   pasang()      memasang tombol bila halaman dan haknya sesuai; idempoten. Promise<boolean> (tombol ada)
 *   buka()        membuka pop-up (dipakai tombol dan uji). Promise<boolean>
 *   keadaan()     { tombol, terbuka, jenis, bacaSaja } - dipakai uji
 */
(function kasirJurnalPopupModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaKasirJurnalPopup) return;

  const ID_TOMBOL = "aleta-kj-tombol";
  const ID_WADAH = "aleta-kj-wadah";
  const POLA_PERKARA = /\/detil_biaya(?:_ht|_teguran)?(?:\/|$)/i;
  const POLA_DAFTAR = /\/(?:jurnal_perkara_list|all_jurnal_perkara|jurnal_all_perkara)(?:\/|$)/i;
  const POLA_NOMOR = /\b\d+\/Pdt\.[A-Za-z.]+\/\d{4}\/PA\.[A-Za-z]+/;
  const JEDA_ULANG_MS = 700;
  const BATAS_ULANG = 12;

  let akar = null; // isi pop-up (dipindahkan popup-aksi.js saat dibuka / diparkir saat ditutup)
  let terbuka = false;
  let jenisAktif = "";
  let bacaSajaAktif = false;

  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }

  /** "perkara" (jurnal satu perkara) | "daftar" (daftar jurnal) | "" (bukan halaman jurnal keuangan). */
  function jenisHalaman() {
    const jalur = String((typeof location !== "undefined" && location.pathname) || "");
    if (POLA_PERKARA.test(jalur)) return "perkara";
    if (POLA_DAFTAR.test(jalur)) return "daftar";
    const judul = cariJudul();
    if (judul) return /BUKU\s+JURNAL\s+KEUANGAN\s+PERKARA/i.test(judul.textContent || "") ? "perkara" : "daftar";
    return "";
  }

  function cariJudul() {
    const calon = Array.from(document.querySelectorAll("h1, h2, h3, h4"));
    return calon.find((h) => !h.closest(".aleta-sisip") && /JURNAL\s+KEUANGAN\s+PERKARA/i.test(h.textContent || "")) || null;
  }

  function perkaraIdHalaman() {
    if (typeof perkaraIdDariHalaman === "function") {
      try {
        return String(perkaraIdDariHalaman() || "");
      } catch {
        /* jatuh ke pembacaan sendiri */
      }
    }
    const medan = document.querySelector('input[name="perkara_id"], input#perkara_id, input[name="perkaraId"]');
    return medan && medan.value ? String(medan.value).trim() : "";
  }

  function nomorPerkaraHalaman() {
    const sumber = document.querySelector("#konten") || document.body;
    const m = POLA_NOMOR.exec((sumber && sumber.textContent) || "");
    return m ? m[0] : "";
  }

  async function penggunaAleta() {
    try {
      if (typeof muatPenggunaAleta === "function") return await muatPenggunaAleta();
      if (typeof alatPenggunaAkunAleta === "function") return alatPenggunaAkunAleta();
    } catch {
      /* belum masuk ALETA: tanpa tombol */
    }
    return null;
  }

  /** { boleh, bacaSaja } dari akun ALETA yang masuk; boleh=false bila bukan kasir/pengawas/admin. */
  async function hak() {
    const p = await penggunaAleta();
    if (!p || typeof alatBolehKasir !== "function" || alatBolehKasir(p) !== true) return { boleh: false, bacaSaja: false };
    const baca = typeof alatKasirBacaSaja === "function" && alatKasirBacaSaja(p) === true;
    return { boleh: true, bacaSaja: baca };
  }

  function tampilanLama() {
    return typeof alatUjiMode !== "function" || alatUjiMode() === "lama";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tombol
  // ──────────────────────────────────────────────────────────────────────────
  function pasangTombol() {
    const ada = document.getElementById(ID_TOMBOL);
    if (ada) return ada;
    const tombol = el("button", "btn btn-sm aleta-kj-tombol aleta-sisip", "Kasir ALETA");
    tombol.id = ID_TOMBOL;
    tombol.type = "button";
    tombol.setAttribute("aria-haspopup", "dialog");
    tombol.setAttribute("aria-expanded", "false");
    tombol.title = "Buka Kasir ALETA (jurnal keuangan perkara) di jendela tengah layar";
    tombol.addEventListener("click", (e) => {
      e.preventDefault();
      void buka();
    });
    const wadah = el("div", "aleta-kj-baris aleta-sisip");
    wadah.id = ID_WADAH;
    wadah.appendChild(tombol);
    const judul = cariJudul();
    if (judul && judul.parentNode) judul.insertAdjacentElement("afterend", wadah);
    else {
      const induk = document.querySelector("#konten") || document.body;
      induk.insertBefore(wadah, induk.firstChild);
    }
    return tombol;
  }

  function cabutTombol() {
    const w = document.getElementById(ID_WADAH);
    if (w) w.remove();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pop-up
  // ──────────────────────────────────────────────────────────────────────────
  function sibuk() {
    return Boolean(akar && akar.querySelector("[data-kasir-sibuk]"));
  }

  async function isiPopup(wadah, jenis, h) {
    wadah.textContent = "";
    if (h.bacaSaja) {
      wadah.appendChild(
        el(
          "div",
          "aleta-basmassal-kabar aleta-basmassal-kabar-peringatan aleta-kj-baca",
          "Mode baca: Anda mengawasi jurnal keuangan perkara. Mencatat jurnal dan setoran dikerjakan kasir atau petugas keuangan."
        )
      );
    }
    const tempat = el("div", "aleta-kj-tempat");
    wadah.appendChild(tempat);
    let berhasil = false;
    try {
      if (jenis === "perkara" && typeof globalThis.aletaKasirPasang === "function") {
        const nomor = nomorPerkaraHalaman();
        let perkaraId = perkaraIdHalaman();
        if (!perkaraId && nomor && typeof r11CariPerkaraId === "function") perkaraId = (await r11CariPerkaraId(nomor)) || "";
        berhasil = (await globalThis.aletaKasirPasang(tempat, { perkaraId, nomorPerkara: nomor })) !== false;
      } else if (jenis === "daftar" && typeof globalThis.aletaKasirPasangHarian === "function") {
        berhasil = (await globalThis.aletaKasirPasangHarian(tempat, { situs: "sipp" })) !== false;
      }
    } catch (galat) {
      tempat.appendChild(el("div", "aleta-basmassal-kabar aleta-basmassal-kabar-salah", `Kasir tidak dapat dimuat: ${String((galat && galat.message) || galat)}`));
      return;
    }
    if (!berhasil) tempat.appendChild(el("div", "aleta-basmassal-kabar aleta-basmassal-kabar-peringatan", "Kasir belum tersedia di tampilan ini."));
  }

  function sinkron() {
    const m = globalThis.aletaPopupAksi;
    if (!m || !akar) return false;
    const judul = jenisAktif === "perkara" ? `Kasir ALETA · ${nomorPerkaraHalaman() || "Jurnal Keuangan Perkara"}` : "Kasir ALETA · Jurnal Keuangan Perkara";
    return m.atur("kasir:jurnal", akar, terbuka, {
      judul,
      sibuk,
      saatTutup: () => {
        terbuka = false;
        const t = document.getElementById(ID_TOMBOL);
        if (t) t.setAttribute("aria-expanded", "false");
      },
    });
  }

  async function buka() {
    const m = globalThis.aletaPopupAksi;
    if (!m) return false;
    const jenis = jenisHalaman();
    if (!jenis || tampilanLama()) return false;
    const h = await hak();
    if (!h.boleh) return false;
    if (terbuka && m.keadaan().kunci === "kasir:jurnal") return true;
    jenisAktif = jenis;
    bacaSajaAktif = h.bacaSaja;
    // Bangun baru tiap dibuka: jurnal bisa berubah di SIPP selama pop-up tertutup.
    if (akar) akar.remove();
    akar = el("div", "aleta-sisip aleta-kj-akar");
    akar.setAttribute("data-kj", jenis);
    terbuka = true;
    const t = document.getElementById(ID_TOMBOL);
    if (t) t.setAttribute("aria-expanded", "true");
    const dibuka = sinkron();
    if (!dibuka) {
      terbuka = false;
      if (t) t.setAttribute("aria-expanded", "false");
      return false;
    }
    await isiPopup(akar, jenis, h);
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan
  // ──────────────────────────────────────────────────────────────────────────
  async function pasang() {
    if (!jenisHalaman() || tampilanLama()) {
      cabutTombol();
      return false;
    }
    const h = await hak();
    if (!h.boleh) {
      cabutTombol();
      return false;
    }
    pasangTombol();
    return true;
  }

  function keadaan() {
    return { tombol: Boolean(document.getElementById(ID_TOMBOL)), terbuka, jenis: jenisAktif, bacaSaja: bacaSajaAktif };
  }

  globalThis.aletaKasirJurnalPopup = { versi: "t3-23okt", pasang, buka, keadaan };

  // Halaman SIPP dan akun ALETA datang belakangan: ulangi sebentar sampai tombol terpasang (atau halaman bukan jurnal).
  if (typeof document !== "undefined") {
    let ulang = 0;
    const putaran = async () => {
      ulang += 1;
      let ada = false;
      try {
        ada = await pasang();
      } catch {
        ada = false;
      }
      if (!ada && ulang < BATAS_ULANG && jenisHalaman()) setTimeout(putaran, JEDA_ULANG_MS);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void putaran(), { once: true });
    else void putaran();
  }
})();
