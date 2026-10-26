"use strict";

/**
 * ============================================================================
 * BERKAS CETAK DIKERJAKAN SERVER - SISI PERAMBAN (K14, 25 Okt 2026)
 * ============================================================================
 *
 * Cetak massal Blangko Derry (ZIP RTF atau PDF gabungan) dan pemeriksaan sisa blangko tadinya dikerjakan seluruhnya di
 * peramban: menyusun ZIP, membuat base64 puluhan MB, menunggu konversi PDF satu demi satu. Modul ini hanya KLIEN
 * kecil untuk rute /aleta-ecourt/berkas-server di portal: naskah dikirim satu per satu, server memeriksa sisa blangko,
 * mengubah ke PDF, menggabung / membungkus ZIP, lalu peramban menerima hasil jadi. Peramban boleh ditutup selagi
 * server bekerja; hasil menunggu di server (memori, dua jam) dan muncul lagi di jendela Cetak massal.
 *
 * ATURAN
 *   - Mati bawaan: hanya bekerja bila Super Admin menyalakan kinerja.berkasDiServer (singgahan tampilanServer).
 *     Mati = aktif() false dan semua pemanggil memakai JALUR LAMA di peramban persis seperti dulu.
 *   - Gagal-aman: setiap fungsi mengembalikan null / false / [] alih-alih melempar; pemanggil memutuskan jalur lama.
 *   - Tidak ada yang ditulis ke SIPP atau ABT. Naskah hanya ke portal ALETA kita sendiri.
 *
 * Global: ALETA_BERKAS_SERVER { aktif, tungguSiap, buat, kirimButir, mulai, status, tunggu, unduh, daftar, hapus, periksaSisaRtf }.
 */
(function berkasServerModul(akar) {
  if (!akar || akar.ALETA_BERKAS_SERVER) return;

  const API = "/aleta/api/aleta-ecourt/berkas-server";
  const KUNCI_SERVER = "tampilanServer";
  const JEDA_TANYA_MS = 2000;
  const BATAS_TUNGGU_MS = 25 * 60 * 1000;
  /** Naskah RTF di bawah ukuran ini diperiksa di peramban saja (lebih cepat daripada bolak-balik jaringan). */
  const MINIMAL_PERIKSA_BITA = 150 * 1024;

  let nyala = false;
  const siap = (async () => {
    try {
      const st = akar.chrome && akar.chrome.storage && akar.chrome.storage.local;
      if (!st) return;
      const s = await st.get([KUNCI_SERVER]);
      nyala = bacaSaklar(s && s[KUNCI_SERVER]);
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
    return Boolean(t && t.kinerja && t.kinerja.berkasDiServer === true);
  }

  function keBase64(bita) {
    const u = bita instanceof Uint8Array ? bita : new Uint8Array(bita);
    let s = "";
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return akar.btoa(s);
  }

  async function ambil(alamat, opsi) {
    const f = typeof akar.alatAmbil === "function" ? akar.alatAmbil : null;
    return f ? f(alamat, { credentials: "include", cache: "no-store", ...opsi }, "Berkas di server") : akar.fetch(alamat, { credentials: "include", cache: "no-store", ...opsi });
  }

  async function json(alamat, opsi) {
    const r = await ambil(alamat, opsi);
    if (!r || !r.ok) return null;
    const luar = await r.json();
    return luar && luar.data !== undefined ? luar.data : luar;
  }

  const kirimJson = (badan) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan) });

  /** Membuat pekerjaan. { id, batas } atau null (saklar mati, server menolak, jaringan putus). */
  async function buat(o) {
    await siap;
    if (!nyala) return null;
    try {
      const h = await json(API, kirimJson({ aksi: "buat", format: o && o.format === "pdf" ? "pdf" : "rtf", nama: (o && o.nama) || "Cetak massal" }));
      return h && h.tersedia === true && h.id ? { id: h.id, batas: h.batas || {} } : null;
    } catch {
      return null;
    }
  }

  /** Mengirim satu naskah RTF. true bila diterima. */
  async function kirimButir(id, o) {
    try {
      const h = await json(API, kirimJson({ aksi: "butir", id, nama: o.nama, rtfBase64: keBase64(o.bita) }));
      return Boolean(h && Number.isFinite(h.jumlahButir));
    } catch {
      return false;
    }
  }

  /** Menyuruh server bekerja. Ringkasan pekerjaan atau null. */
  async function mulai(id) {
    try {
      return (await json(API, kirimJson({ aksi: "mulai", id }))) || null;
    } catch {
      return null;
    }
  }

  async function status(id) {
    try {
      return (await json(`${API}?id=${encodeURIComponent(id)}`, { method: "GET" })) || null;
    } catch {
      return null;
    }
  }

  /** Menunggu sampai selesai atau gagal. Pulang ringkasan terakhir, atau null bila server tak terjangkau terus-menerus / waktu habis. */
  async function tunggu(id, opsi) {
    const o = opsi || {};
    const mulaiMs = Date.now();
    let galat = 0;
    for (;;) {
      const s = await status(id);
      if (s) {
        galat = 0;
        if (typeof o.padaKabar === "function") o.padaKabar(s);
        if (s.status === "selesai" || s.status === "gagal") return s;
      } else if (++galat >= 5) return null;
      if (Date.now() - mulaiMs > (o.batasMs || BATAS_TUNGGU_MS)) return null;
      await new Promise((r) => setTimeout(r, o.jedaMs || JEDA_TANYA_MS));
    }
  }

  /** Mengunduh hasil jadi sebagai Blob, atau null. */
  async function unduh(id) {
    try {
      const r = await ambil(`${API}?id=${encodeURIComponent(id)}&unduh=1`, { method: "GET" });
      if (!r || !r.ok) return null;
      const bita = await r.arrayBuffer();
      return new akar.Blob([bita], { type: (r.headers && r.headers.get && r.headers.get("content-type")) || "application/octet-stream" });
    } catch {
      return null;
    }
  }

  async function daftar() {
    await siap;
    if (!nyala) return [];
    try {
      const h = await json(API, { method: "GET" });
      return h && Array.isArray(h.pekerjaan) ? h.pekerjaan : [];
    } catch {
      return [];
    }
  }

  async function hapus(id) {
    try {
      const h = await json(`${API}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return Boolean(h && h.dihapus);
    } catch {
      return false;
    }
  }

  /**
   * Pemeriksa sisa blangko di server untuk SATU RTF besar. Bentuk jawabannya sama dengan periksaBita() lokal
   * ({ dibaca, hasil }) atau null -> pemanggil memeriksa sendiri (jalur lama).
   */
  async function periksaSisaRtf(bita) {
    await siap;
    if (!nyala || !bita || bita.length < MINIMAL_PERIKSA_BITA) return null;
    try {
      const h = await json(`${API}/periksa-sisa`, kirimJson({ rtfBase64: keBase64(bita) }));
      if (!h || h.tersedia !== true || h.dibaca !== true || !h.hasil || !Array.isArray(h.hasil.temuan)) return null;
      return { dibaca: true, hasil: h.hasil };
    } catch {
      return null;
    }
  }

  akar.ALETA_BERKAS_SERVER = {
    versi: "k14-25okt",
    aktif: () => nyala,
    tungguSiap: () => siap,
    buat,
    kirimButir,
    mulai,
    status,
    tunggu,
    unduh,
    daftar,
    hapus,
    periksaSisaRtf,
    murni: { bacaSaklar, keBase64, MINIMAL_PERIKSA_BITA },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
