"use strict";

/**
 * ============================================================================
 * PERINGATAN VERSI EKSTENSI BERBEDA DI PC LAIN (U16 / portal-24, 25 Okt 2026)
 * ============================================================================
 *
 * Bila akun ini juga memakai ekstensi di PC lain dan versinya berbeda dengan PC ini, popup menyebutnya satu baris
 * ("PC lain memakai 1.205.38"). Datanya "perangkat.versi" dari setelan pribadi akun (disinggahkan panel-alat.js di
 * chrome.storage "tampilanServer"); aturan banding ada di konteks-server.js. Tersembunyi bila saklar Super Admin
 * kinerja.konteksDiServer mati, belum ada data, atau semua PC lain sama.
 */
(function () {
  async function gambar() {
    const baris = document.getElementById("versiPcLainBaris");
    const el = document.getElementById("versiPcLain");
    if (!baris || !el || typeof chrome === "undefined" || !chrome.storage) return;
    try {
      const s = await chrome.storage.local.get(["tampilanServer", "idPerangkatAntrean"]);
      const t = s.tampilanServer;
      const aktif = Boolean(t && t.kinerja && t.kinerja.konteksDiServer === true);
      const baris2 = t && t.setelan && t.setelan["perangkat.versi"];
      const ini = String((chrome.runtime.getManifest && chrome.runtime.getManifest().version) || "");
      const K = globalThis.ALETA_KONTEKS_SERVER;
      const beda = aktif && baris2 && K ? K.versiBeda(baris2.nilai, s.idPerangkatAntrean || "", ini) : [];
      if (!beda.length) {
        baris.hidden = true;
        el.textContent = "";
        return;
      }
      const daftar = beda.map((b) => `${b.versi}${b.jumlahPc > 1 ? ` (${b.jumlahPc} PC)` : ""}`).join(", ");
      el.textContent = `memakai versi lain: ${daftar}. Perbarui supaya sama dengan PC ini (${ini}).`;
      baris.hidden = false;
    } catch {
      baris.hidden = true;
    }
  }
  function pasang() {
    void gambar();
    try {
      chrome.storage.onChanged.addListener((ubah, wilayah) => {
        if (wilayah === "local" && ubah.tampilanServer) void gambar();
      });
    } catch {
      /* di luar ekstensi */
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pasang);
  else pasang();
})();
