/*
 * Alamat portal ALETA yang sedang hidup (K1, 19 Okt 2026).
 *
 * ALETA kini juga dilayani di port sendiri, http://192.168.10.10:8008/aleta,
 * supaya peramban memberinya enam sambungan sendiri - tidak lagi berebut
 * dengan SIPP dan ABT di port 80. Port 80 tetap melayani /aleta seperti
 * semula (kompatibel mundur), jadi port 8008 yang belum dibuka firewall-nya
 * tidak boleh membuat ekstensi berhenti bekerja.
 *
 *   pilihAsal(asalTersimpan)
 *     - asal tersimpan BUKAN salah satu alamat bawaan (mis. 127.0.0.1, atau
 *       alamat lain yang dicatat dari halaman portal): dipakai apa adanya;
 *     - kosong: tetap kosong (alamat tidak ditebak);
 *     - salah satu bawaan: 8008 bila terjangkau, selain itu port 80.
 *       Hasilnya diingat di chrome.storage.session (8008 hidup: 5 menit;
 *       8008 mati: 2 menit, lalu dicoba lagi).
 *
 * Dimuat oleh latar.js (importScripts) dan popup.html. Hanya membaca: satu GET
 * ke /api/install, tanpa kuki.
 */
(function (akar) {
  "use strict";

  const ASAL_8008 = "http://192.168.10.10:8008/aleta";
  const ASAL_80 = "http://192.168.10.10/aleta";
  const BAWAAN = new Set([ASAL_8008, ASAL_80]);
  const KUNCI_SESI = "asalPortalHidup";
  const INGAT_HIDUP_MS = 5 * 60 * 1000;
  const INGAT_MATI_MS = 2 * 60 * 1000;
  const BATAS_UJI_MS = 2500;

  function bersih(asal) {
    return String(asal || "").trim().replace(/\/+$/, "");
  }

  /** Asal ini salah satu alamat bawaan satker (port 80 atau 8008)? */
  function asalBawaan(asal) {
    return BAWAAN.has(bersih(asal));
  }

  function sesi() {
    try {
      return akar.chrome && akar.chrome.storage && akar.chrome.storage.session ? akar.chrome.storage.session : null;
    } catch {
      return null;
    }
  }

  async function bacaIngatan(kini) {
    const s = sesi();
    if (!s) return null;
    try {
      const isi = await s.get([KUNCI_SESI]);
      const x = isi && isi[KUNCI_SESI];
      if (x && BAWAAN.has(x.asal) && Number(x.sampai) > kini) return x.asal;
    } catch {
      /* sesi tidak terbaca: diuji ulang */
    }
    return null;
  }

  async function tulisIngatan(asal, sampai) {
    const s = sesi();
    if (!s) return;
    try {
      await s.set({ [KUNCI_SESI]: { asal, sampai } });
    } catch {
      /* tidak diingat: diuji lagi lain kali */
    }
  }

  /** Port 8008 menjawab? Satu GET ringan, tanpa kuki, dengan batas waktu. */
  async function uji8008(ambil) {
    const f = ambil || (typeof akar.fetch === "function" ? akar.fetch.bind(akar) : null);
    if (!f) return false;
    const pengendali = typeof AbortController === "function" ? new AbortController() : null;
    const tunda = pengendali ? setTimeout(() => pengendali.abort(), BATAS_UJI_MS) : null;
    try {
      const r = await f(`${ASAL_8008}/api/install`, {
        cache: "no-store",
        credentials: "omit",
        ...(pengendali ? { signal: pengendali.signal } : {}),
      });
      return Boolean(r && r.ok);
    } catch {
      return false;
    } finally {
      if (tunda) clearTimeout(tunda);
    }
  }

  let berjalan = null;

  /** Alamat portal yang dipakai sekarang - lihat penjelasan di kepala berkas. */
  async function pilihAsal(asalTersimpan, opsi) {
    const asal = bersih(asalTersimpan);
    if (!asal || !BAWAAN.has(asal)) return asal;
    const kini = Date.now();
    const ingat = await bacaIngatan(kini);
    if (ingat) return ingat;
    if (!berjalan) {
      berjalan = (async () => {
        const hidup = await uji8008(opsi && opsi.ambil);
        const pilihan = hidup ? ASAL_8008 : ASAL_80;
        await tulisIngatan(pilihan, Date.now() + (hidup ? INGAT_HIDUP_MS : INGAT_MATI_MS));
        return pilihan;
      })().finally(() => {
        berjalan = null;
      });
    }
    return berjalan;
  }

  akar.AletaAlamatPortal = { ASAL_8008, ASAL_80, KUNCI_SESI, asalBawaan, pilihAsal, uji8008 };
})(typeof globalThis !== "undefined" ? globalThis : self);
