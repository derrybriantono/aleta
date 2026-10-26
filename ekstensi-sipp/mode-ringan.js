"use strict";

/**
 * ============================================================================
 * MODE RINGAN UNTUK PC TUA (K16, 25 Okt 2026)
 * ============================================================================
 *
 * Bila komputer tergolong tua (navigator.deviceMemory <= 4 atau
 * navigator.hardwareConcurrency <= 2), ekstensi mematikan hiasan buatannya
 * (animasi, transisi, kabur latar) dan memperpanjang pewaktu lewat pengamat-bersama.js.
 * Tidak ada fungsi yang dikurangi dan halaman SIPP/ABT/portal tidak disentuh.
 *
 * KEPUTUSAN (satu aturan, putuskan() - salinannya di src/lib/mode-ringan.ts
 * dijaga uji kembar):
 *   pilihan "nyala"  -> ringan, apa pun deteksinya;
 *   pilihan "mati"   -> tidak ringan, apa pun deteksinya;
 *   pilihan "otomatis" (BAWAAN) -> ringan HANYA bila saklar Super Admin
 *       kinerja.modeRinganOtomatis menyala DAN komputer terdeteksi tua.
 * Saklar Super Admin MATI bawaan, jadi tanpa pilihan pengguna tidak ada yang berubah.
 * Pilihan pengguna disimpan per PC (chrome.storage.local "modeRingan"), tidak ikut
 * disinkronkan ke PC lain karena menyangkut mesin ini.
 *
 * Penerapan: atribut data-aleta-ringan="1" pada <html> dan satu <style> yang hanya
 * menyentuh elemen ALETA (id/kelas berawalan "aleta"); mengikuti perubahan pilihan dan saklar
 * langsung, tanpa memuat ulang tab.
 */
(function modeRinganModul(akar) {
  if (!akar || akar.ALETA_RINGAN) return;

  const KUNCI_PILIHAN = "modeRingan";
  const KUNCI_SERVER = "tampilanServer";
  const FAKTOR = 2;
  const ID_GAYA = "aleta-ringan-gaya";
  const GAYA =
    'html[data-aleta-ringan] [id^="aleta"], html[data-aleta-ringan] [id^="aleta"] *, html[data-aleta-ringan] [class*="aleta"], html[data-aleta-ringan] [class*="aleta"] * {' +
    " animation: none !important; transition: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; scroll-behavior: auto !important; }";

  const PILIHAN_SAH = ["otomatis", "nyala", "mati"];
  const bersihPilihan = (x) => (PILIHAN_SAH.includes(x) ? x : "otomatis");

  /** Komputer tua: memori <= 4 GB atau inti <= 2. Nilai tak diketahui tidak dihitung tua. */
  function terdeteksiTua(nav) {
    const n = nav || {};
    const mem = Number(n.deviceMemory);
    const inti = Number(n.hardwareConcurrency);
    return (Number.isFinite(mem) && mem > 0 && mem <= 4) || (Number.isFinite(inti) && inti > 0 && inti <= 2);
  }

  function putuskan(p) {
    const pilihan = bersihPilihan(p && p.pilihan);
    if (pilihan === "nyala") return { ringan: true, sebab: "pilihan-nyala" };
    if (pilihan === "mati") return { ringan: false, sebab: "pilihan-mati" };
    if (!(p && p.saklarOtomatis === true)) return { ringan: false, sebab: "saklar-mati" };
    return p.tua === true ? { ringan: true, sebab: "terdeteksi-tua" } : { ringan: false, sebab: "bukan-tua" };
  }

  const keadaan = { pilihan: "otomatis", saklarOtomatis: false, tua: false, ringan: false, sebab: "saklar-mati" };
  const pendengar = [];

  function terapkan() {
    const nav = akar.navigator;
    keadaan.tua = terdeteksiTua(nav);
    const h = putuskan(keadaan);
    const berubah = h.ringan !== keadaan.ringan;
    keadaan.ringan = h.ringan;
    keadaan.sebab = h.sebab;
    const d = akar.document;
    try {
      if (d && d.documentElement) {
        if (h.ringan) {
          d.documentElement.setAttribute("data-aleta-ringan", "1");
          if (!d.getElementById(ID_GAYA)) {
            const g = d.createElement("style");
            g.id = ID_GAYA;
            g.textContent = GAYA;
            (d.head || d.documentElement).appendChild(g);
          }
        } else {
          d.documentElement.removeAttribute("data-aleta-ringan");
          const g = d.getElementById(ID_GAYA);
          if (g) g.remove();
        }
      }
    } catch {
      /* hiasan saja: kegagalannya tidak boleh mengganggu halaman */
    }
    try {
      if (akar.ALETA_PENGAMAT) akar.ALETA_PENGAMAT.atur({ faktorRingan: h.ringan ? FAKTOR : 1, ringan: h.ringan });
    } catch {
      /* tanpa pengamat bersama: hanya hiasan yang dimatikan */
    }
    if (berubah) for (const f of pendengar) f(keadaan);
  }

  function dariSimpanan(s) {
    if (!s) return;
    if (KUNCI_PILIHAN in s) keadaan.pilihan = bersihPilihan(s[KUNCI_PILIHAN]);
    if (KUNCI_SERVER in s) {
      const t = s[KUNCI_SERVER];
      keadaan.saklarOtomatis = Boolean(t && t.kinerja && t.kinerja.modeRinganOtomatis === true);
    }
  }

  akar.ALETA_RINGAN = {
    aktif: () => keadaan.ringan,
    keadaan: () => ({ ...keadaan }),
    saatBerubah: (f) => void pendengar.push(f),
    faktor: FAKTOR,
    murni: { putuskan, terdeteksiTua, bersihPilihan, GAYA },
  };

  try {
    const ch = akar.chrome;
    const st = ch && ch.storage && ch.storage.local;
    if (st && typeof st.get === "function") {
      const hasil = st.get([KUNCI_PILIHAN, KUNCI_SERVER]);
      if (hasil && typeof hasil.then === "function") {
        hasil
          .then((s) => {
            dariSimpanan(s || {});
            terapkan();
          })
          .catch(() => undefined);
      }
      if (ch.storage.onChanged && typeof ch.storage.onChanged.addListener === "function") {
        ch.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah) return;
          const s = {};
          if (ubah[KUNCI_PILIHAN]) s[KUNCI_PILIHAN] = ubah[KUNCI_PILIHAN].newValue;
          if (ubah[KUNCI_SERVER]) s[KUNCI_SERVER] = ubah[KUNCI_SERVER].newValue;
          if (Object.keys(s).length) {
            dariSimpanan(s);
            terapkan();
          }
        });
      }
    }
  } catch {
    /* tanpa penyimpanan ekstensi: tetap mode biasa */
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
