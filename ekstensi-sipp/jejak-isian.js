"use strict";

/**
 * ============================================================================
 * JEJAK ISIAN DAN BUTIR SAKSI - SISI EKSTENSI (25 Okt 2026, rantai C butir C1)
 * ============================================================================
 *
 * U1 + U2 + U6. Pembantu bersama untuk halaman ABT (abt.js, saksi-susun.js,
 * blangko-derry-isian.js). Berkas ini TIDAK menulis ke ABT/SIPP/e-Court dan
 * tidak pernah melempar galat ke pemanggilnya: mencatat jejak adalah tambahan,
 * dan gagalnya tidak boleh menggagalkan penyimpanan isian.
 *
 * ============================================================================
 * SAKLAR: BAWAAN MATI, MATI = PERILAKU LAMA PERSIS
 * ============================================================================
 *
 * Saklar milik server (Fitur Satker "jejak-isian", bawaan mati). Ekstensi
 * menanyakannya lewat GET ?bagian=saklar dan MENGINGAT jawabannya (5 menit bila
 * berhasil, 30 detik bila gagal). Gagal bertanya = MATI: tidak ada catatan,
 * tidak ada baca-ulang tambahan, dan tidak ada daftar Urungkan dari server.
 *
 * ============================================================================
 * APA YANG DICATAT
 * ============================================================================
 *
 *   catatIsian   satu penyimpanan isian ABT: usulan beserta pengisinya, nilai
 *                sebelum (utuh), nilai final, cara, hasil baca-ulang.
 *   catatButir   satu baris per butir tanya-jawab saksi yang disimpan:
 *                pertanyaan, usulan mesin, teks final, katalog/varian/pola.
 *   jejakPerkara jejak LENGKAP satu perkara dari server, untuk Urungkan dari
 *                PC mana pun (nilai sebelum tidak dipotong).
 *
 * Data berisi nama asli dan teks keterangan saksi: hanya dikirim ke portal di
 * server kantor (alamat relatif /aleta/api/...), tidak ke tempat lain.
 */
(function () {
  const API = "/aleta/api/aleta-ecourt/jejak-isian";
  const API_BUTIR = "/aleta/api/aleta-ecourt/saksi-butir";
  const TTL_YA_MS = 5 * 60 * 1000;
  const TTL_GAGAL_MS = 30 * 1000;
  const BATAS_KIRIM = 60;

  let cache = null; // { aktif, saat, gagal }
  let janji = null;

  const teks = (x) => String(x == null ? "" : x).trim();

  /** Bentuk baku untuk membandingkan dua nilai: spasi dilebur, kutip disamakan, huruf kecil. */
  function bakuBanding(x) {
    return String(x == null ? "" : x)
      .replace(/[’‘`"“”]/g, "'")
      .replace(/\r\n/g, "\n")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
  const samaLonggar = (a, b) => bakuBanding(a) === bakuBanding(b);

  function buka(jawaban) {
    return jawaban && jawaban.data && typeof jawaban.data === "object" ? jawaban.data : jawaban;
  }

  async function ambilJson(alamat, opsi) {
    try {
      const r = await fetch(alamat, Object.assign({ credentials: "include", cache: "no-store" }, opsi || {}));
      if (!r || !r.ok) return null;
      return buka(await r.json());
    } catch {
      return null;
    }
  }

  /** Apakah saklar server menyala? Dijawab dari ingatan bila masih segar; gagal bertanya = false. */
  function aktif(paksa) {
    const kini = Date.now();
    if (!paksa && cache && kini - cache.saat < (cache.gagal ? TTL_GAGAL_MS : TTL_YA_MS)) return Promise.resolve(cache.aktif);
    if (janji) return janji;
    janji = (async () => {
      let hasil = null;
      try {
        hasil = await ambilJson(`${API}?bagian=saklar`);
      } catch {
        hasil = null;
      }
      cache = hasil && typeof hasil.aktif === "boolean" ? { aktif: hasil.aktif, saat: Date.now(), gagal: false } : { aktif: false, saat: Date.now(), gagal: true };
      janji = null;
      return cache.aktif;
    })();
    return janji;
  }

  /** Jawaban saklar yang sudah diingat tanpa menunggu jaringan: true/false, atau null bila belum pernah ditanyakan. */
  function aktifSegera() {
    return cache ? cache.aktif : null;
  }

  /** Untuk uji / penyegaran manual. */
  function lupakan() {
    cache = null;
    janji = null;
  }

  async function kirim(alamat, daftar) {
    if (!Array.isArray(daftar) || !daftar.length) return null;
    if (!(await aktif())) return { aktif: false, dicatat: 0 };
    let terakhir = null;
    for (let i = 0; i < daftar.length; i += BATAS_KIRIM) {
      try {
        const r = await fetch(alamat, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ daftar: daftar.slice(i, i + BATAS_KIRIM) }),
        });
        terakhir = r && r.ok ? buka(await r.json()) : null;
      } catch {
        terakhir = null; // jejak tertinggal; penyimpanan isiannya sudah berhasil
      }
    }
    return terakhir;
  }

  /** Mencatat satu atau beberapa penyimpanan isian. Tidak pernah melempar. */
  function catatIsian(entri) {
    const daftar = (Array.isArray(entri) ? entri : [entri]).filter(Boolean);
    return kirim(API, daftar).catch(() => null);
  }

  /** Mencatat butir tanya-jawab saksi. Tidak pernah melempar. */
  function catatButir(daftar) {
    return kirim(API_BUTIR, (Array.isArray(daftar) ? daftar : [daftar]).filter(Boolean)).catch(() => null);
  }

  /** Jejak lengkap satu perkara dari server; [] bila saklar mati atau gagal. */
  async function jejakPerkara(perkaraId) {
    const id = teks(perkaraId);
    if (!id || !(await aktif())) return [];
    const d = await ambilJson(`${API}?perkaraId=${encodeURIComponent(id)}`);
    return d && d.aktif !== false && Array.isArray(d.daftar) ? d.daftar : [];
  }

  /**
   * Baris jejak server -> bentuk catatan riwayat yang dipakai panel ABT dan Blangko Derry.
   * `utuh` = nilai sebelumnya tidak terpotong; `bisaDiurungkan` dihitung server (baris terbaru untuk kodenya,
   * belum diurungkan). `dariServerLengkap` menandai asalnya; dedupe dengan salinan peramban memakai kode + waktu.
   */
  function keRiwayat(baris) {
    const b = baris || {};
    const cara =
      b.cara === "diurungkan"
        ? "dikembalikan"
        : b.cara === "otomatis"
          ? "diisi ALETA"
          : b.cara === "saran-diterima"
            ? "saran diterima"
            : b.cara === "diubah" || b.cara === "diubah-otomatis"
              ? "usulan diubah petugas"
              : b.cara === "diketik"
                ? "diketik petugas"
                : "diubah";
    return {
      perkaraId: teks(b.perkaraId),
      nomorPerkara: teks(b.nomorPerkara),
      kode: teks(b.kode),
      nama: teks(b.nama),
      sebelum: String(b.nilaiSebelum == null ? "" : b.nilaiSebelum),
      sesudah: String(b.nilaiFinal == null ? "" : b.nilaiFinal),
      cara,
      pada: teks(b.pada),
      // dariPeladen hanya benar bila isinya terpotong: catatan LENGKAP boleh dikembalikan dan harus lolos penjaga "dariPeladen" di panel.
      dariPeladen: b.sebelumDipotong === true,
      dariServerLengkap: true,
      dipotong: b.sebelumDipotong === true,
      utuh: b.sebelumDipotong !== true,
      bisaDiurungkan: b.bisaDiurungkan === true,
      idJejak: teks(b.id),
      oleh: teks(b.olehNama),
    };
  }

  /**
   * Cara satu penyimpanan isian oleh MANUSIA (atau mesin):
   *   ditulisOtomatis  ALETA yang menulis sendiri            -> "otomatis"
   *   urungkan                                               -> "diurungkan"
   *   ada usulan ditulis ALETA sebelumnya, nilai berubah     -> "diubah-otomatis" (sama: tidak dicatat sebagai suntingan)
   *   ada saran yang tampil: sama -> "saran-diterima"; beda  -> "diubah"
   *   tanpa usulan                                           -> "diketik"
   * `sama` bisa diganti untuk isian yang ditulis dalam bentuk lain (mis. huruf alasan).
   */
  function tentukanCara(o, sama) {
    const banding = typeof sama === "function" ? sama : samaLonggar;
    if (o.urungkan) return "diurungkan";
    if (o.ditulisOtomatis) return "otomatis";
    const usulan = teks(o.usulan);
    if (!usulan) return "diketik";
    const akhir = teks(o.final);
    if (banding(usulan, akhir)) return "saran-diterima";
    return o.usulanDariOtomatis ? "diubah-otomatis" : "diubah";
  }

  /** Penanda asal usulan -> penanda pendek huruf kecil (sama dengan penandaAsal di portal). */
  function penandaAsal(x) {
    return String(x == null ? "" : x)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  /** Kode pola butir saksi: "<katalog>/<butir>" bila ada, selain itu kode pola bawaan usulan, selain itu "". */
  function kodePolaButir(o) {
    const k = teks(o && o.katalog);
    const b = teks(o && o.butir);
    if (k && b) return `${k}/${b}`;
    return teks(o && o.kodePola);
  }

  globalThis.AletaJejakIsian = Object.freeze({
    aktif,
    aktifSegera,
    lupakan,
    catatIsian,
    catatButir,
    jejakPerkara,
    keRiwayat,
    tentukanCara,
    penandaAsal,
    kodePolaButir,
    samaLonggar,
    bakuBanding,
    API,
    API_BUTIR,
  });
})();
