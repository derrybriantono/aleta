"use strict";

/**
 * ============================================================================
 * MODE RINGAN - PILIHAN DI POPUP (K16, 25 Okt 2026)
 * ============================================================================
 *
 * Tiga tombol: Otomatis (bawaan) | Nyala | Mati, disimpan per PC di chrome.storage.local
 * "modeRingan". Pembacanya mode-ringan.js di tiap halaman; perubahannya berlaku seketika di tab
 * yang terbuka. Keterangan di bawah tombol menyebut keadaan komputer ini dan sebabnya.
 */
(function () {
  const KUNCI = "modeRingan";
  const KUNCI_SERVER = "tampilanServer";
  const PILIHAN = ["otomatis", "nyala", "mati"];
  const KET = {
    "pilihan-nyala": "Dinyalakan atas pilihan Anda: hiasan dimatikan dan pewaktu diperlambat.",
    "pilihan-mati": "Dimatikan atas pilihan Anda.",
    "saklar-mati": "Otomatis belum dinyalakan oleh Super Admin, jadi tampilan penuh dipakai.",
    "terdeteksi-tua": "Komputer ini terdeteksi sederhana (memori 4 GB atau kurang, atau 2 inti): hiasan dimatikan dan pewaktu diperlambat.",
    "bukan-tua": "Komputer ini cukup kuat, jadi tampilan penuh dipakai.",
  };
  const bersih = (x) => (PILIHAN.includes(x) ? x : "otomatis");
  const tua = () => {
    const m = Number(navigator.deviceMemory);
    const i = Number(navigator.hardwareConcurrency);
    return (Number.isFinite(m) && m > 0 && m <= 4) || (Number.isFinite(i) && i > 0 && i <= 2);
  };

  async function gambar() {
    const ket = document.getElementById("ringanKet");
    if (!ket || !chrome || !chrome.storage) return;
    const s = await chrome.storage.local.get([KUNCI, KUNCI_SERVER]);
    const pilihan = bersih(s[KUNCI]);
    const saklar = Boolean(s[KUNCI_SERVER] && s[KUNCI_SERVER].kinerja && s[KUNCI_SERVER].kinerja.modeRinganOtomatis === true);
    for (const p of PILIHAN) {
      const b = document.querySelector(`[data-ringan="${p}"]`);
      if (b) b.setAttribute("aria-pressed", p === pilihan ? "true" : "false");
    }
    let sebab;
    if (pilihan === "nyala") sebab = "pilihan-nyala";
    else if (pilihan === "mati") sebab = "pilihan-mati";
    else if (!saklar) sebab = "saklar-mati";
    else sebab = tua() ? "terdeteksi-tua" : "bukan-tua";
    ket.textContent = KET[sebab];
  }

  function pasang() {
    const kotak = document.getElementById("bagianModeRingan");
    if (!kotak) return;
    kotak.addEventListener("click", async (e) => {
      const b = e.target && e.target.closest ? e.target.closest("[data-ringan]") : null;
      if (!b) return;
      const p = bersih(b.getAttribute("data-ringan"));
      try {
        if (p === "otomatis") await chrome.storage.local.remove(KUNCI);
        else await chrome.storage.local.set({ [KUNCI]: p });
      } catch {
        /* penyimpanan menolak: tombol kembali ke keadaan tersimpan */
      }
      void gambar();
    });
    try {
      chrome.storage.onChanged.addListener((ubah, wilayah) => {
        if (wilayah === "local" && (ubah[KUNCI] || ubah[KUNCI_SERVER])) void gambar();
      });
    } catch {
      /* di luar ekstensi */
    }
    void gambar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pasang);
  else pasang();
})();
