"use strict";

/**
 * ============================================================================
 * ANTREAN KERJA PERAMBAN -> BASIS DATA (K15, 25 Okt 2026)
 * ============================================================================
 *
 * Antrean cetak massal dan catatan putusan terjadwal tadinya hanya hidup di memori/chrome.storage peramban:
 * Chrome ditutup atau PC diganti, kerjanya hilang. Modul ini menyalin KEADAAN pengerjaannya (nomor perkara, nama
 * berkas, status per butir - tidak pernah isi putusan, NIK, atau nama pihak) ke portal
 * (PUT/POST/GET /ekstensi/antrean, tabel aleta_antrean_peramban) dan menyodorkannya lagi kepada PEMILIKNYA.
 *
 * ATURAN
 *   - Mati bawaan: hanya bekerja bila Super Admin menyalakan kinerja.antreanDiServer (singgahan tampilanServer,
 *     ditulis panel-alat.js). Mati = tidak ada satu permintaan pun dan tidak ada yang berubah.
 *   - Gagal-aman: jaringan/portal galat = diam; kerja di peramban tidak pernah menunggu atau gagal karenanya.
 *   - Tidak menjalankan apa pun sendiri: yang dikembalikan hanya data; modul pemiliknya yang memutuskan memakainya.
 *   - Penulisan disatukan per (jenis, kunci): paling sering sekali per JEDA_TULIS_MS, dan yang terakhir menang.
 *
 * Global: ALETA_ANTREAN_SERVER { aktif, catat, akhiri, tertinggal, idPerangkat, tungguSiap }.
 */
(function antreanServerModul(akar) {
  if (!akar || akar.ALETA_ANTREAN_SERVER) return;

  const API = "/aleta/api/aleta-ecourt/ekstensi/antrean";
  const KUNCI_SERVER = "tampilanServer";
  const KUNCI_PERANGKAT = "idPerangkatAntrean";
  const JEDA_TULIS_MS = 4000;
  const JENIS = ["cetak-massal", "relaas-massal", "putusan-terjadwal-catatan"];

  let nyala = false;
  let idPerangkat = "";
  const menunggu = new Map(); // "jenis|kunci" -> { data, pewaktu, janji, selesai }

  const siap = (async () => {
    try {
      const st = akar.chrome && akar.chrome.storage && akar.chrome.storage.local;
      if (!st) return;
      const s = await st.get([KUNCI_SERVER, KUNCI_PERANGKAT]);
      nyala = bacaSaklar(s && s[KUNCI_SERVER]);
      idPerangkat = (s && s[KUNCI_PERANGKAT]) || "";
      if (!idPerangkat) {
        idPerangkat = `pc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        await st.set({ [KUNCI_PERANGKAT]: idPerangkat });
      }
      if (akar.chrome.storage.onChanged && typeof akar.chrome.storage.onChanged.addListener === "function") {
        akar.chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah === "local" && ubah && ubah[KUNCI_SERVER]) nyala = bacaSaklar(ubah[KUNCI_SERVER].newValue);
        });
      }
    } catch {
      /* tanpa penyimpanan ekstensi: tetap mati */
    }
  })();

  function bacaSaklar(t) {
    return Boolean(t && t.kinerja && t.kinerja.antreanDiServer === true);
  }

  async function panggil(metode, badan, query) {
    const alamat = API + (query || "");
    const opsi = {
      method: metode,
      credentials: "include",
      cache: "no-store",
      ...(badan ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan) } : {}),
    };
    const ambil = typeof akar.alatAmbil === "function" ? akar.alatAmbil : null;
    const r = ambil ? await ambil(alamat, opsi, "Antrean kerja") : await akar.fetch(alamat, opsi);
    if (!r || !r.ok) return null;
    const luar = await r.json();
    return luar && luar.data ? luar.data : luar;
  }

  function kirimSekarang(jenis, kunci) {
    const k = `${jenis}|${kunci}`;
    const m = menunggu.get(k);
    if (!m) return Promise.resolve(false);
    menunggu.delete(k);
    if (m.pewaktu) clearTimeout(m.pewaktu);
    const d = m.data || {};
    return panggil("PUT", {
      jenis,
      kunci,
      perangkat: idPerangkat,
      ringkas: d.ringkas || "",
      selesai: d.selesai || 0,
      total: d.total || 0,
      muatan: d.muatan === undefined ? {} : d.muatan,
      status: "jalan",
    })
      .then((h) => Boolean(h && h.disimpan))
      .catch(() => false)
      .then((hasil) => {
        m.lepas(hasil);
        return hasil;
      });
  }

  /** Mencatat keadaan antrean. Tidak pernah melempar. Mengembalikan janji yang selesai sesudah terkirim (atau tidak jadi). */
  function catat(jenis, kunci, data, opsi) {
    return siap.then(() => {
      if (!nyala || !JENIS.includes(jenis) || !kunci) return false;
      const k = `${jenis}|${kunci}`;
      const segera = Boolean(opsi && opsi.segera);
      let m = menunggu.get(k);
      if (m) {
        m.data = data;
      } else {
        let lepas;
        const janji = new Promise((r) => {
          lepas = r;
        });
        m = { data, pewaktu: null, janji, lepas };
        menunggu.set(k, m);
        if (!segera) m.pewaktu = setTimeout(() => void kirimSekarang(jenis, kunci), JEDA_TULIS_MS);
      }
      if (segera) void kirimSekarang(jenis, kunci);
      return m.janji;
    });
  }

  /** Menandai antrean selesai atau dibuang; menggugurkan tulisan yang masih menunggu. */
  function akhiri(jenis, kunci, status) {
    return siap.then(async () => {
      if (!nyala || !JENIS.includes(jenis) || !kunci) return false;
      const k = `${jenis}|${kunci}`;
      const m = menunggu.get(k);
      if (m) {
        if (m.pewaktu) clearTimeout(m.pewaktu);
        menunggu.delete(k);
        m.lepas(false);
      }
      try {
        const h = await panggil("POST", { jenis, kunci, status: status === "dibuang" ? "dibuang" : "selesai" });
        return Boolean(h && h.diakhiri);
      } catch {
        return false;
      }
    });
  }

  /** Antrean yang belum selesai milik pengguna ini (satu jenis, atau semua). Saklar mati atau galat = []. */
  function tertinggal(jenis) {
    return siap.then(async () => {
      if (!nyala) return [];
      try {
        const h = await panggil("GET", null, jenis ? `?jenis=${encodeURIComponent(jenis)}` : "");
        return h && Array.isArray(h.antrean) ? h.antrean : [];
      } catch {
        return [];
      }
    });
  }

  akar.ALETA_ANTREAN_SERVER = {
    versi: "k15-25okt",
    aktif: () => nyala,
    tungguSiap: () => siap,
    idPerangkat: () => idPerangkat,
    catat,
    akhiri,
    tertinggal,
    murni: { bacaSaklar },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
