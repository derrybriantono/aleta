"use strict";

/**
 * ============================================================================
 * PERKARA TERAKHIR DAN VERSI EKSTENSI MENGIKUTI PENGGUNA (U16, 25 Okt 2026)
 * ============================================================================
 *
 * "Perkara terakhir di SIPP" (riwayatPerkaraSipp) tadinya hanya hidup di chrome.storage satu PC. Modul ini menyalinnya
 * ke setelan pribadi akun di server (kunci "konteks.perkara", tabel aleta_ekstensi_setelan) dan menggabungkannya
 * kembali di PC mana pun akun itu masuk: satu entri per nomor perkara (yang terbaru), paling banyak 12 di server dan 8
 * di tiap PC. Yang disalin HANYA nomor, pintu masuk SIPP, jenis, dan waktu - tidak ada isi perkara, nama pihak, atau NIK.
 *
 * Modul ini juga melaporkan versi ekstensi tiap PC ("perangkat.versi") supaya popup dapat memperingatkan bila PC lain
 * memakai versi yang berbeda (portal-24).
 *
 * ATURAN
 *   - Mati bawaan: hanya bekerja bila Super Admin menyalakan kinerja.konteksDiServer (singgahan tampilanServer). Mati =
 *     tidak ada satu permintaan pun dan riwayat tetap hanya lokal.
 *   - Gagal-aman: jaringan/portal galat = diam. Penulisan memakai penjaga dua-PC (jikaDiubahPada); 409 = baca ulang,
 *     gabung ulang, coba sekali lagi - tidak ada yang ditimpa.
 *   - Aturan penggabungan = src/lib/konteks-server.ts (gabungKonteksPerkara, versiBedaDiPcLain); uji menyamakan keduanya.
 *
 * Global: ALETA_KONTEKS_SERVER { aktif, tungguSiap, selaraskan, catat, laporVersi, versiBeda, murni }.
 */
(function konteksServerModul(akar) {
  if (!akar || akar.ALETA_KONTEKS_SERVER) return;

  const API = "/aleta/api/aleta-ecourt/ekstensi/setelan";
  const KUNCI_SERVER = "tampilanServer";
  const KUNCI_RIWAYAT = "riwayatPerkaraSipp";
  const KUNCI_PC = "idPerangkatAntrean";
  const KUNCI_LAPOR = "waktuLaporVersiPc";
  const KUNCI_SETELAN_PERKARA = "konteks.perkara";
  const KUNCI_SETELAN_VERSI = "perangkat.versi";
  const BATAS_SERVER = 12;
  const BATAS_LOKAL = 8;
  const BATAS_PC = 8;
  const JEDA_TULIS_MS = 4000;
  const JEDA_LAPOR_MS = 6 * 60 * 60 * 1000;
  const UMUR_PC_MAKS_MS = 30 * 24 * 60 * 60 * 1000;

  let nyala = false;
  let idPc = "";
  let pewaktu = null;

  const st = () => (akar.chrome && akar.chrome.storage && akar.chrome.storage.local) || null;

  const siap = (async () => {
    try {
      const s = st();
      if (!s) return;
      const h = await s.get([KUNCI_SERVER, KUNCI_PC]);
      nyala = bacaSaklar(h && h[KUNCI_SERVER]);
      idPc = (h && h[KUNCI_PC]) || "";
      if (!idPc) {
        idPc = `pc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        await s.set({ [KUNCI_PC]: idPc });
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
    return Boolean(t && t.kinerja && t.kinerja.konteksDiServer === true);
  }

  const waktuSah = (x) => {
    if (typeof x !== "string") return null;
    const t = new Date(x);
    return Number.isNaN(t.getTime()) ? null : t.toISOString();
  };
  const teks = (x, maks) => {
    const s = typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
    return s.length > maks ? s.slice(0, maks) : s;
  };

  /** Satu entri per nomor (yang terbaru), terbaru dulu, paling banyak `maks`. Sama dengan gabungKonteksPerkara di lib TS. */
  function gabung(a, b, maks) {
    const peta = new Map();
    for (const daftar of [a, b]) {
      for (const x of Array.isArray(daftar) ? daftar : []) {
        const o = x && typeof x === "object" ? x : null;
        const nomor = teks(o && o.nomor, 60);
        const waktu = waktuSah(o && o.waktu);
        const url = teks(o && o.url, 300);
        if (!o || !nomor || !waktu || !url) continue;
        const ada = peta.get(nomor);
        if (!ada || ada.waktu < waktu) peta.set(nomor, { nomor, url, jenis: teks(o.jenis, 60), waktu });
      }
    }
    return [...peta.values()].sort((p, q) => (p.waktu < q.waktu ? 1 : -1)).slice(0, maks === undefined ? BATAS_SERVER : maks);
  }

  const sama = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

  /** Versi lain di PC LAIN dalam 30 hari terakhir, tanpa pengulangan. Sama dengan versiBedaDiPcLain di lib TS. */
  function versiBeda(peta, idIni, versiIni, sekarang) {
    const hasil = new Map();
    if (!peta || typeof peta !== "object" || Array.isArray(peta)) return [];
    const batas = (sekarang || Date.now()) - UMUR_PC_MAKS_MS;
    for (const [id, v] of Object.entries(peta)) {
      const o = v && typeof v === "object" ? v : null;
      const versi = teks(o && o.versi, 20);
      const waktu = waktuSah(o && o.waktu);
      if (!o || id === idIni || !versi || !waktu || versi === versiIni) continue;
      if (new Date(waktu).getTime() < batas) continue;
      const ada = hasil.get(versi);
      if (ada) {
        ada.jumlahPc += 1;
        if (ada.waktu < waktu) ada.waktu = waktu;
      } else hasil.set(versi, { versi, waktu, jumlahPc: 1 });
    }
    return [...hasil.values()].sort((p, q) => (p.waktu < q.waktu ? 1 : -1));
  }

  async function ambilSemua() {
    const f = typeof akar.alatAmbil === "function" ? akar.alatAmbil : null;
    const opsi = { credentials: "include", cache: "no-store" };
    const r = f ? await f(API, opsi, "Setelan pribadi") : await akar.fetch(API, opsi);
    if (!r || !r.ok) return null;
    const luar = await r.json();
    const data = luar && luar.data ? luar.data : luar;
    return data && data.setelan && typeof data.setelan === "object" ? data.setelan : {};
  }

  /** PUT satu kunci dengan penjaga dua-PC. Pulang "ok" | "bentrok" | "gagal". */
  async function simpanKunci(kunci, nilai, jikaDiubahPada) {
    const f = typeof akar.alatAmbil === "function" ? akar.alatAmbil : null;
    const opsi = {
      method: "PUT",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kunci, nilai, jikaDiubahPada: jikaDiubahPada || "" }),
    };
    const r = f ? await f(API, opsi, "Setelan pribadi") : await akar.fetch(API, opsi);
    if (!r) return "gagal";
    if (r.status === 409) return "bentrok";
    return r.ok ? "ok" : "gagal";
  }

  /**
   * Menggabung riwayat perkara lokal dengan salinan server dan menyamakan keduanya. Tidak pernah melempar.
   * Pulang { ok, lokalBerubah, serverBerubah }.
   */
  async function selaraskan() {
    await siap;
    const hasil = { ok: false, lokalBerubah: false, serverBerubah: false };
    if (!nyala || !st()) return hasil;
    try {
      for (let coba = 0; coba < 3; coba += 1) {
        const semua = await ambilSemua();
        if (!semua) return hasil;
        const baris = semua[KUNCI_SETELAN_PERKARA];
        const serverEntri = baris && Array.isArray(baris.nilai) ? baris.nilai : [];
        const lokal = ((await st().get([KUNCI_RIWAYAT]))[KUNCI_RIWAYAT]) || [];
        const gab = gabung(lokal, serverEntri, BATAS_SERVER);
        const untukLokal = gab.slice(0, BATAS_LOKAL);
        if (!sama(untukLokal, Array.isArray(lokal) ? lokal : [])) {
          await st().set({ [KUNCI_RIWAYAT]: untukLokal });
          hasil.lokalBerubah = true;
        }
        if (sama(gab, serverEntri)) {
          hasil.ok = true;
          return hasil;
        }
        const h = await simpanKunci(KUNCI_SETELAN_PERKARA, gab, baris ? baris.diubahPada : "");
        if (h === "ok") {
          hasil.ok = true;
          hasil.serverBerubah = true;
          return hasil;
        }
        if (h === "gagal") return hasil;
        /* bentrok: PC lain menulis lebih dulu - baca ulang dan gabung lagi */
      }
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
    return hasil;
  }

  /** Dipanggil konten.js sesudah riwayat lokal berubah: penyelarasan ditunda sebentar dan digabung. */
  function catat() {
    if (pewaktu) return;
    pewaktu = setTimeout(() => {
      pewaktu = null;
      void selaraskan();
    }, JEDA_TULIS_MS);
  }

  /** Melaporkan versi ekstensi PC ini (paling sering sekali per 6 jam, atau bila versinya berganti). */
  async function laporVersi(opsi) {
    await siap;
    if (!nyala || !st() || !idPc) return false;
    try {
      const versi = String((akar.chrome.runtime && akar.chrome.runtime.getManifest && akar.chrome.runtime.getManifest().version) || "");
      if (!versi) return false;
      const kini = Date.now();
      for (let coba = 0; coba < 3; coba += 1) {
        const semua = await ambilSemua();
        if (!semua) return false;
        const baris = semua[KUNCI_SETELAN_VERSI];
        const peta = baris && baris.nilai && typeof baris.nilai === "object" && !Array.isArray(baris.nilai) ? { ...baris.nilai } : {};
        const milik = peta[idPc];
        if (!(opsi && opsi.paksa) && milik && milik.versi === versi && kini - Date.parse(milik.waktu) < JEDA_LAPOR_MS) return true;
        peta[idPc] = { versi, waktu: new Date(kini).toISOString(), nama: "" };
        // PC yang paling lama tidak melapor disingkirkan bila melebihi batas.
        const urut = Object.entries(peta).sort((a, b) => (Date.parse(a[1].waktu) < Date.parse(b[1].waktu) ? 1 : -1)).slice(0, BATAS_PC);
        const h = await simpanKunci(KUNCI_SETELAN_VERSI, Object.fromEntries(urut), baris ? baris.diubahPada : "");
        if (h === "ok") return true;
        if (h === "gagal") return false;
      }
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
    return false;
  }

  akar.ALETA_KONTEKS_SERVER = {
    versi: "u16-25okt",
    aktif: () => nyala,
    tungguSiap: () => siap,
    idPerangkat: () => idPc,
    selaraskan,
    catat,
    laporVersi,
    versiBeda,
    murni: { gabung, versiBeda, bacaSaklar, sama },
  };

  // Sekali sesudah halaman tenang: selaraskan riwayat dan laporkan versi. Saklar mati = tidak berbuat apa-apa.
  try {
    const protokol = akar.location && akar.location.protocol;
    // Hanya di halaman web (SIPP, portal); tidak di halaman ekstensi (popup memakai modul ini hanya untuk versiBeda).
    if (protokol === "http:" || protokol === "https:") {
      setTimeout(() => {
        void selaraskan();
        void laporVersi();
      }, 3000);
    }
  } catch {
    /* di luar halaman */
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
