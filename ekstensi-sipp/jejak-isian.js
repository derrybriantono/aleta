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
  const API_SEKALI = "/aleta/api/aleta-ecourt/isian-sekali";
  const API_WAJIB = "/aleta/api/aleta-ecourt/wajib-cetak";
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
    cacheSekali = null;
    janjiSekali = null;
    cacheWajib = null;
    janjiWajib = null;
    wajibBerkas.clear();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ISIAN SEKALI PER PERKARA (D2, 25 Okt 2026): isian manual yang belum punya sumber otomatis diingat server per perkara,
  // dan blangko lain perkara itu menampilkannya sebagai SARAN. Saklar sendiri (Fitur Satker "isian-sekali", bawaan mati);
  // gagal bertanya = MATI. Tidak pernah menulis ke ABT dan tidak pernah melempar.
  // ──────────────────────────────────────────────────────────────────────────
  let cacheSekali = null; // { aktif, kode:Set, saat, gagal }
  let janjiSekali = null;

  /** Saklar isian sekali + daftar kode yang diingat. Dijawab dari ingatan bila masih segar; gagal = { aktif:false }. */
  function infoSekali(paksa) {
    const kini = Date.now();
    if (!paksa && cacheSekali && kini - cacheSekali.saat < (cacheSekali.gagal ? TTL_GAGAL_MS : TTL_YA_MS)) return Promise.resolve(cacheSekali);
    if (janjiSekali) return janjiSekali;
    janjiSekali = (async () => {
      const d = await ambilJson(`${API_SEKALI}?bagian=saklar`);
      const ok = d && typeof d.aktif === "boolean";
      cacheSekali = ok
        ? { aktif: d.aktif, kode: new Set(Array.isArray(d.kode) ? d.kode.map((k) => teks(k)) : []), saat: Date.now(), gagal: false }
        : { aktif: false, kode: new Set(), saat: Date.now(), gagal: true };
      janjiSekali = null;
      return cacheSekali;
    })();
    return janjiSekali;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DAFTAR WAJIB SEBELUM CETAK + SALIN DARI PERKARA SERUPA (D3, 25 Okt 2026): server mencatat kelengkapan SEMUA jenis blangko
  // (saat berubah dan saat dicetak), mengingatkan isian yang biasanya sudah terisi ketika blangko itu dicetak, dan mengusulkan
  // isian bukan-identitas dari perkara serupa yang sudah putus. Saklar sendiri (Fitur Satker "wajib-sebelum-cetak", bawaan mati);
  // gagal bertanya = MATI. Hanya mengingatkan dan menyarankan: tidak pernah menahan cetak dan tidak pernah menulis ke ABT.
  // ──────────────────────────────────────────────────────────────────────────
  let cacheWajib = null; // { aktif, saat, gagal }
  let janjiWajib = null;
  const wajibBerkas = new Map(); // berkas -> { saat, data }

  function aktifWajib(paksa) {
    const kini = Date.now();
    if (!paksa && cacheWajib && kini - cacheWajib.saat < (cacheWajib.gagal ? TTL_GAGAL_MS : TTL_YA_MS)) return Promise.resolve(cacheWajib.aktif);
    if (janjiWajib) return janjiWajib;
    janjiWajib = (async () => {
      const d = await ambilJson(`${API_WAJIB}?bagian=saklar`);
      cacheWajib = d && typeof d.aktif === "boolean" ? { aktif: d.aktif, saat: Date.now(), gagal: false } : { aktif: false, saat: Date.now(), gagal: true };
      janjiWajib = null;
      return cacheWajib.aktif;
    })();
    return janjiWajib;
  }

  /** Melaporkan kelengkapan satu blangko (atau saat dicetak). Tidak pernah melempar; saklar mati = tidak mengirim apa pun. */
  async function laporWajib(detail) {
    try {
      if (!detail || !teks(detail.perkaraId) || !teks(detail.berkas) || !Array.isArray(detail.isian) || !detail.isian.length) return null;
      if (!(await aktifWajib())) return null;
      const r = await fetch(API_WAJIB, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "lapor",
          perkaraId: teks(detail.perkaraId),
          nomorPerkara: teks(detail.nomorPerkara),
          berkas: teks(detail.berkas),
          jenisBlangko: teks(detail.jenisBlangko),
          jenisPerkara: teks(detail.jenisPerkara),
          isian: detail.isian.map((i) => ({ kode: teks(i.kode), terisi: Boolean(i.terisi) })),
          dicetak: detail.dicetak === true,
          fakta: detail.fakta && typeof detail.fakta === "object" ? detail.fakta : {},
        }),
      });
      return r && r.ok ? buka(await r.json()) : null;
    } catch {
      return null;
    }
  }

  /** Isian yang biasanya sudah terisi saat blangko ini dicetak: { cukupData, wajib:[{kode, terisi, dari, rasio}] }; kosong bila mati/gagal. */
  async function bacaWajib(berkas) {
    const kosong = { cukupData: false, wajib: [] };
    const nama = teks(berkas);
    if (!nama) return kosong;
    try {
      if (!(await aktifWajib())) return kosong;
      const ada = wajibBerkas.get(nama);
      if (ada && Date.now() - ada.saat < TTL_YA_MS) return ada.data;
      const d = await ambilJson(`${API_WAJIB}?berkas=${encodeURIComponent(nama)}`);
      const data = d && d.aktif !== false && Array.isArray(d.wajib) ? { cukupData: d.cukupData === true, wajib: d.wajib } : kosong;
      wajibBerkas.set(nama, { saat: Date.now(), data });
      return data;
    } catch {
      return kosong;
    }
  }

  /** Usulan isian dari perkara serupa yang sudah putus untuk kode yang masih kosong: [{kode, nilai, jumlah, dari, nomorPerkara}]. */
  async function usulSerupa(m) {
    try {
      if (!m || !teks(m.perkaraId) || !Array.isArray(m.kode) || !m.kode.length) return [];
      if (!(await aktifWajib())) return [];
      const r = await fetch(API_WAJIB, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "serupa", perkaraId: teks(m.perkaraId), nomorPerkara: teks(m.nomorPerkara), jenisPerkara: teks(m.jenisPerkara), fakta: m.fakta || {}, kode: m.kode.map((k) => teks(k)) }),
      });
      const d = r && r.ok ? buka(await r.json()) : null;
      return d && d.aktif !== false && Array.isArray(d.usulan) ? d.usulan : [];
    } catch {
      return [];
    }
  }

  /** Nilai yang diingat untuk satu perkara: Map kode -> { nilai, diisiOleh, diubahAt }; kosong bila saklar mati atau gagal. */
  async function bacaSekali(perkaraId) {
    const hasil = new Map();
    const id = teks(perkaraId);
    if (!id) return hasil;
    const info = await infoSekali();
    if (!info.aktif) return hasil;
    const d = await ambilJson(`${API_SEKALI}?perkaraId=${encodeURIComponent(id)}`);
    if (!d || d.aktif === false || !Array.isArray(d.isian)) return hasil;
    for (const x of d.isian) if (x && teks(x.kode) && teks(x.nilai)) hasil.set(teks(x.kode), { nilai: String(x.nilai), diisiOleh: teks(x.diisiOleh), diubahAt: teks(x.diubahAt) });
    return hasil;
  }

  /** Mengingat satu isian yang baru disimpan ke ABT; hanya kode yang diingat server. Tidak pernah melempar. */
  async function catatSekali(e) {
    try {
      const kode = teks(e && e.kode);
      if (!kode || !teks(e.perkaraId)) return null;
      const info = await infoSekali();
      if (!info.aktif || !info.kode.has(kode)) return null;
      const r = await fetch(API_SEKALI, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkaraId: teks(e.perkaraId), nomorPerkara: teks(e.nomorPerkara), kode, nilai: String(e.nilai == null ? "" : e.nilai) }),
      });
      return r && r.ok ? buka(await r.json()) : null;
    } catch {
      return null; // ingatan tertinggal; isian sudah tersimpan di ABT
    }
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
    infoSekali,
    bacaSekali,
    catatSekali,
    aktifWajib,
    laporWajib,
    bacaWajib,
    usulSerupa,
    keRiwayat,
    tentukanCara,
    penandaAsal,
    kodePolaButir,
    samaLonggar,
    bakuBanding,
    API,
    API_BUTIR,
    API_SEKALI,
    API_WAJIB,
  });
})();
