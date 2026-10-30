"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY - "N BAGIAN BERUBAH SEJAK CETAKAN TERAKHIR" (30 Okt 2026)
 * ============================================================================
 *
 * Sesudah sebuah blangko dicetak, ringkasan teksnya (tiap paragraf: sidik 8 huruf + 160 huruf pertama) disimpan di server ALETA per
 * perkara + blangko. Saat blangko yang sama dibuka lagi pada perkara yang sama, naskah sekarang dibandingkan dengan ringkasan itu dan
 * langkah Cetak menulis keterangan kecil PASIF "N bagian berubah sejak cetakan terakhir" (rincian terlipat). Tidak ada langkah,
 * konfirmasi, atau tombol tambahan sebelum cetak; cetak tidak pernah ditahan.
 *
 * Berkas ini: bagian MURNI (meringkas teks, membandingkan) dan pemanggilan rute portal /aleta-ecourt/cetak-terakhir. Tidak menulis ke
 * ABT/SIPP/e-Court. Yang disimpan bukan dokumen (tidak dapat disusun kembali dari ringkasan).
 */
(function bedaCetakModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaBedaCetak) return;

  const API = "/aleta/api/aleta-ecourt/cetak-terakhir";
  const BATAS_BAGIAN = 600;
  const BATAS_TEKS = 160;

  const lipat = (x) => String(x == null ? "" : x).replace(/\s+/g, " ").trim();

  /** Sidik FNV-1a 32-bit (8 huruf heksa) atas bentuk baku paragraf: spasi dilebur, huruf kecil, kutip disamakan. */
  function sidik(paragraf) {
    const baku = lipat(paragraf).toLowerCase().replace(/[’‘`"“”]/g, "'");
    let h = 0x811c9dc5;
    for (let i = 0; i < baku.length; i += 1) {
      h ^= baku.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  /** Teks polos naskah -> [{ h, t }] per paragraf (garis baru memisahkan; baris kosong dan tanda baca saja dilewati). */
  function ringkas(teks) {
    const hasil = [];
    for (const baris of String(teks == null ? "" : teks).split(/\r\n|\r|\n/)) {
      const t = lipat(baris);
      if (t.length < 2 || !/[\p{L}\p{N}]/u.test(t)) continue;
      hasil.push({ h: sidik(t), t: t.slice(0, BATAS_TEKS) });
      if (hasil.length >= BATAS_BAGIAN) break;
    }
    return hasil;
  }

  /**
   * Membandingkan ringkasan lama dan baru (runtun terpanjang yang sama atas sidik). Bagian berubah = dihapus atau disisipkan; satu hapus +
   * satu sisip yang bersebelahan dihitung SATU bagian "diubah". Hasil { n, perubahan:[{ jenis:"diubah"|"tambah"|"hapus", lama, baru }] }.
   */
  function bandingkan(lama, baru) {
    const a = Array.isArray(lama) ? lama : [];
    const b = Array.isArray(baru) ? baru : [];
    const n = a.length;
    const m = b.length;
    // tabel LCS (n, m <= 600 -> ~360 ribu sel)
    const tabel = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) tabel[i][j] = a[i].h === b[j].h ? tabel[i + 1][j + 1] + 1 : Math.max(tabel[i + 1][j], tabel[i][j + 1]);
    const perubahan = [];
    let hapus = [];
    let tambah = [];
    const tutup = () => {
      const pasang = Math.min(hapus.length, tambah.length);
      for (let k = 0; k < pasang; k += 1) perubahan.push({ jenis: "diubah", lama: hapus[k].t, baru: tambah[k].t });
      for (let k = pasang; k < hapus.length; k += 1) perubahan.push({ jenis: "hapus", lama: hapus[k].t, baru: "" });
      for (let k = pasang; k < tambah.length; k += 1) perubahan.push({ jenis: "tambah", lama: "", baru: tambah[k].t });
      hapus = [];
      tambah = [];
    };
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i].h === b[j].h) {
        tutup();
        i += 1;
        j += 1;
      } else if (j >= m || (i < n && tabel[i + 1][j] >= tabel[i][j + 1])) {
        hapus.push(a[i]);
        i += 1;
      } else {
        tambah.push(b[j]);
        j += 1;
      }
    }
    tutup();
    return { n: perubahan.length, perubahan };
  }

  function buka(jawaban) {
    return jawaban && jawaban.data && typeof jawaban.data === "object" ? jawaban.data : jawaban;
  }

  /** Ringkasan cetakan terakhir dari server: { ada, dicetakPada, dicetakOleh, bagian } atau null bila gagal. Tidak pernah melempar. */
  async function baca(perkaraId, berkas) {
    try {
      const r = await fetch(`${API}?perkaraId=${encodeURIComponent(String(perkaraId))}&berkas=${encodeURIComponent(String(berkas))}`, { credentials: "include", cache: "no-store" });
      if (!r || !r.ok) return null;
      const d = buka(await r.json());
      return d && typeof d === "object" ? d : null;
    } catch {
      return null;
    }
  }

  /** Menyimpan ringkasan cetakan yang baru saja berhasil. Pulang ringkasan yang disimpan (untuk singgahan) atau null. */
  async function simpan(m) {
    try {
      const bagian = ringkas(m.teks);
      if (!bagian.length || !m.perkaraId || !m.berkas) return null;
      const r = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkaraId: String(m.perkaraId), nomorPerkara: String(m.nomorPerkara || ""), berkas: String(m.berkas), bagian }),
      });
      if (!r || !r.ok) return null;
      const d = buka(await r.json());
      return { ada: true, dicetakPada: (d && d.dicetakPada) || new Date().toISOString(), dicetakOleh: "", bagian };
    } catch {
      return null;
    }
  }

  globalThis.aletaBedaCetak = Object.freeze({ API, sidik, ringkas, bandingkan, baca, simpan });
})();
