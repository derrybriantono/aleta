/*
 * ============================================================================
 * PEMUAT MODUL MALAS - KODE DIMUAT SAAT DIPAKAI (K11, 26 Okt 2026)
 * ============================================================================
 *
 * Masalah (PC tua): konten.js seberat 1,2 MB dimuat di SETIAP halaman SIPP -
 * beranda, menu, laporan - padahal panel perkara (±600 KB kodenya) hanya
 * digambar di halaman satu perkara, dan panel daftar (±85 KB) hanya di halaman
 * daftar perkara.
 *
 * Kini bagian itu berkas terpisah (konten-panel-*.js). Berkas ini - global
 * AletaModul - memintanya dimuat TEPAT sebelum dipakai:
 *
 *   AletaModul.siap(id)       true bila semua berkas modul id sudah dimuat.
 *   AletaModul.pastikan(id)   memuat modul id (dan prasyaratnya) bila belum;
 *                             Promise<boolean>, TIDAK pernah melempar. false =
 *                             gagal; pemanggil tidak menggambar apa pun dan
 *                             mencoba lagi pada putaran berikutnya.
 *
 * KENAPA LEWAT PEKERJA LATAR, BUKAN import()
 * ------------------------------------------
 * Kode yang dipindah adalah potongan utuh konten.js: ia memakai const/let/function
 * tingkat atas konten.js, dan konten.js memakai miliknya. Modul ES (import())
 * memberi tiap berkas lingkup sendiri, jadi semua rujukan silang harus diekspor
 * satu per satu - dan salinan dari let yang berubah akan basi. Skrip klasik yang
 * disuntikkan chrome.scripting.executeScript ke dunia terasing YANG SAMA
 * berbagi lingkup leksikal global dengan skrip konten manifest, persis seperti
 * berkas-berkas manifest berbagi satu sama lain; tidak ada yang berubah artinya.
 * (Diukur di Chromium sungguhan: let yang ditulis modul tersuntik terbaca skrip
 * manifest dan sebaliknya.) Izin "scripting" tidak menimbulkan peringatan pasang.
 *
 * Penyuntikan berjalan SATU-SATU lewat antrean (urutan prasyarat terjaga, tidak
 * ada penyuntikan ganda - const yang dideklarasikan dua kali adalah galat
 * sintaks). Tiap berkas menutup dirinya dengan penanda __aletaModulSelesai;
 * modul baru dianggap siap bila SEMUA penanda berkasnya ada. Pekerja latar yang
 * mati/menunda, jawaban lewat batas waktu, atau galat sintaks di berkas = false.
 *
 * Tanpa chrome.runtime (uji jsdom) pemuat ini tidak dipasang, dan kode yang
 * menunggunya (konten.js: pastikanModulPanel) menganggap semua kode sudah ada.
 */
(function (akar) {
  "use strict";

  if (!akar || akar.AletaModul) return;
  const pelari = akar.chrome && akar.chrome.runtime;
  if (!pelari || typeof pelari.sendMessage !== "function") return;

  /** id -> prasyarat (modul lain, dimuat lebih dulu) dan berkas (berurutan). */
  const DAFTAR = Object.freeze({
    "panel-bersama": Object.freeze({ pra: Object.freeze([]), berkas: Object.freeze(["konten-panel-bersama.js"]) }),
    "panel-perkara": Object.freeze({ pra: Object.freeze(["panel-bersama"]), berkas: Object.freeze(["konten-panel-perkara.js"]) }),
    "panel-daftar": Object.freeze({ pra: Object.freeze(["panel-bersama"]), berkas: Object.freeze(["konten-panel-daftar.js"]) }),
  });

  const BATAS_JAWABAN_MS = 10000;
  const JEDA_ULANG_GAGAL_MS = 3000;

  const selesai = () => akar.__aletaModulSelesai || (akar.__aletaModulSelesai = new Set());
  const gagalSampai = new Map(); // id -> waktu (ms) sebelum boleh dicoba lagi
  const jalan = new Map(); // id -> Promise<boolean> yang sedang terbang
  let antrean = Promise.resolve();

  /** Berkas modul id beserta prasyaratnya, berurutan, tanpa ulangan. */
  function berkasUntuk(id, lihat = new Set()) {
    const d = DAFTAR[id];
    if (!d || lihat.has(id)) return [];
    lihat.add(id);
    const hasil = [];
    for (const p of d.pra) for (const b of berkasUntuk(p, lihat)) if (!hasil.includes(b)) hasil.push(b);
    for (const b of d.berkas) if (!hasil.includes(b)) hasil.push(b);
    return hasil;
  }

  function siap(id) {
    const semua = berkasUntuk(id);
    return semua.length > 0 && semua.every((b) => selesai().has(b));
  }

  async function tanyaPekerja(berkas) {
    let pewaktu = null;
    try {
      const jawab = await Promise.race([
        pelari.sendMessage({ sumber: "aleta-panel", jenis: "muat-modul", berkas }),
        new Promise((_, tolak) => {
          pewaktu = setTimeout(() => tolak(new Error("batas waktu")), BATAS_JAWABAN_MS);
        }),
      ]);
      return !!(jawab && jawab.ok === true);
    } catch {
      return false;
    } finally {
      if (pewaktu) clearTimeout(pewaktu);
    }
  }

  async function muatKini(id) {
    // dihitung ulang SAAT gilirannya tiba: panggilan lain mungkin sudah memuat sebagian
    const kurang = berkasUntuk(id).filter((b) => !selesai().has(b));
    if (!kurang.length) return true;
    const ok = await tanyaPekerja(kurang);
    return ok && kurang.every((b) => selesai().has(b));
  }

  function pastikan(id) {
    try {
      if (!DAFTAR[id]) return Promise.resolve(false);
      if (siap(id)) return Promise.resolve(true);
      const tunda = gagalSampai.get(id) || 0;
      if (tunda > Date.now()) return Promise.resolve(false);
      const ada = jalan.get(id);
      if (ada) return ada;
      const kerja = antrean.then(() => muatKini(id)).catch(() => false);
      antrean = kerja.then(
        () => undefined,
        () => undefined
      );
      const janji = kerja.then((ok) => {
        jalan.delete(id);
        if (ok) gagalSampai.delete(id);
        else gagalSampai.set(id, Date.now() + JEDA_ULANG_GAGAL_MS);
        return ok;
      });
      jalan.set(id, janji);
      return janji;
    } catch {
      return Promise.resolve(false);
    }
  }

  akar.AletaModul = Object.freeze({ siap, pastikan, daftar: DAFTAR, berkasUntuk });
})(globalThis);
