"use strict";

/**
 * ============================================================================
 * SAKLAR FITUR SATKER YANG DITANYAKAN EKSTENSI (rantai C, C3, 25 Okt 2026)
 * ============================================================================
 *
 * Fitur baru yang bawaannya MATI (katalog Fitur Satker di portal, dinyalakan Super Admin) ditanyakan lewat
 * GET /aleta/api/aleta-ecourt/ekstensi/fitur?kode=a,b. Jawabannya diingat 5 menit bila berhasil dan 30 detik
 * bila gagal. Gagal bertanya = MATI: perilaku lama berjalan persis. Tidak pernah melempar.
 */
(function () {
  const API = "/aleta/api/aleta-ecourt/ekstensi/fitur";
  const TTL_YA_MS = 5 * 60 * 1000;
  const TTL_GAGAL_MS = 30 * 1000;
  const cache = new Map(); // kode -> { menyala, saat, gagal }
  let janji = null;
  let antre = new Set();

  function segar(kode) {
    const c = cache.get(kode);
    return c && Date.now() - c.saat < (c.gagal ? TTL_GAGAL_MS : TTL_YA_MS) ? c : null;
  }

  async function tanya(daftar) {
    let hasil = null;
    try {
      const r = await fetch(`${API}?kode=${encodeURIComponent(daftar.join(","))}`, { credentials: "include", cache: "no-store" });
      if (r && r.ok) {
        const j = await r.json();
        const d = j && j.data ? j.data : j;
        hasil = d && d.fitur && typeof d.fitur === "object" ? d.fitur : null;
      }
    } catch {
      hasil = null;
    }
    for (const kode of daftar) {
      if (hasil && typeof hasil[kode] === "boolean") cache.set(kode, { menyala: hasil[kode], saat: Date.now(), gagal: false });
      else cache.set(kode, { menyala: false, saat: Date.now(), gagal: true });
    }
  }

  /** Apakah fitur `kode` menyala? Pertanyaan serentak digabung menjadi satu permintaan. */
  function aktif(kode) {
    const k = String(kode || "").trim();
    if (!k) return Promise.resolve(false);
    const c = segar(k);
    if (c) return Promise.resolve(c.menyala);
    antre.add(k);
    if (!janji) {
      janji = Promise.resolve().then(async () => {
        const daftar = Array.from(antre);
        antre = new Set();
        janji = null;
        await tanya(daftar);
      });
    }
    return janji.then(() => (cache.get(k) ? cache.get(k).menyala : false));
  }

  /** Jawaban yang sudah diingat tanpa menunggu: true/false, atau null bila belum pernah ditanyakan. */
  function segera(kode) {
    const c = segar(String(kode || "").trim());
    return c ? c.menyala : null;
  }

  function lupakan() {
    cache.clear();
  }

  globalThis.AletaSaklarFitur = Object.freeze({ aktif, segera, lupakan, API });
})();
