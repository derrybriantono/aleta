"use strict";

/**
 * Menyatukan baris petugas perkara dari SIPP menjadi satu keterangan.
 *
 * ============================================================================
 * SIPP MENYIMPAN LEBIH DARI SATU BARIS UNTUK ORANG YANG SAMA
 * ============================================================================
 *
 * Diperiksa pada data sungguhan PA Donggala, dan bentuknya dua macam:
 *
 *   perkara_panitera_pn 9587:
 *     aktif=Y urutan=1 [Sri Susilowati, S.H.]
 *     aktif=Y urutan=1 [Sri Susilowati, S.H.]      <- kembar persis
 *
 *   perkara_jurusita 9587:
 *     aktif=Y urutan=1 [Mohammad Syukri]
 *     aktif=Y urutan=1 [Mohammad Syukri, S.H.]     <- orang yang sama, dua ejaan
 *
 * GROUP_CONCAT tanpa penyaringan mengeluarkan keduanya, dan layar berbunyi
 * "Mohammad Syukri, S.H., Mohammad Syukri" - satu orang tampak menjadi dua.
 * DISTINCT saja tidak cukup: kedua ejaan itu memang teks yang berbeda.
 *
 * ============================================================================
 * PADA IKRAR TALAK, KODE MAJELIS ADA DI BARIS YANG TIDAK AKTIF
 * ============================================================================
 *
 *   perkara_hakim_pn 9587 (cerai talak, sidang ikrar talak):
 *     aktif=T urutan=1 C1   Himawan Tatura Wijaya, S.H.I.,M.H.
 *     aktif=Y urutan=1 null Himawan Tatura Wijaya, S.H.I.,M.H.
 *
 * Menyaring aktif='Y' saja - sebagaimana kueri sebelumnya - mengambil baris
 * yang KODENYA NULL, sehingga kolom Majelis berbunyi "—" pada tiap perkara
 * ikrar talak. Majelisnya ada; hanya kodenya yang tertinggal di baris lain.
 *
 * Karena itu penyatuan dikerjakan di sini, bukan di SQL: baris aktif yang
 * menentukan SIAPA, dan kode diambil dari baris mana pun yang punya - dua
 * pertanyaan berbeda atas orang yang sama.
 */

/**
 * Nama yang sudah dilucuti gelar dan tanda baca - untuk MEMBANDINGKAN saja.
 *
 * Tidak pernah ditampilkan: gelar adalah bagian dari nama seseorang pada
 * naskah pengadilan, dan yang tampil harus ejaan aslinya yang terlengkap.
 */
function kunciNama(nama) {
  return String(nama || "")
    .toLowerCase()
    .replace(/\b(s\.?h\.?i?|m\.?h\.?|s\.?ag|s\.?sy|lc|m\.?a|dr|drs|h|hj)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bersih(nilai) {
  if (nilai === null || nilai === undefined) return "";
  return String(nilai).trim();
}

/**
 * Menyatukan baris petugas satu perkara.
 *
 * `baris` berisi { nama, kode, urutan, aktif } apa adanya dari SIPP - seluruh
 * baris, aktif maupun tidak.
 */
function satukanPetugas(baris = []) {
  const semua = (Array.isArray(baris) ? baris : [])
    .map((b) => ({
      nama: bersih(b.nama),
      kode: bersih(b.kode),
      urutan: Number(b.urutan) || 0,
      aktif: bersih(b.aktif).toUpperCase() === "Y",
    }))
    .filter((b) => b.nama);

  if (semua.length === 0) return { nama: "", kode: "" };

  // Baris aktif yang menentukan siapa yang bertugas SEKARANG. Bila tidak ada
  // satu pun yang aktif, seluruhnya dipakai - menampilkan majelis yang pernah
  // memeriksa jauh lebih berguna daripada menampilkan tanda hubung.
  const adaAktif = semua.some((b) => b.aktif);
  const dipakai = adaAktif ? semua.filter((b) => b.aktif) : semua;

  const kelompok = new Map();
  for (const b of dipakai) {
    const kunci = kunciNama(b.nama) || b.nama.toLowerCase();
    const ada = kelompok.get(kunci);
    if (!ada) {
      kelompok.set(kunci, { nama: b.nama, kode: b.kode, urutan: b.urutan });
      continue;
    }
    // Ejaan terlengkap yang menang - "Mohammad Syukri, S.H." memuat
    // keterangan yang tidak ada pada "Mohammad Syukri".
    if (b.nama.length > ada.nama.length) ada.nama = b.nama;
    if (!ada.kode && b.kode) ada.kode = b.kode;
    if (b.urutan > 0 && (ada.urutan === 0 || b.urutan < ada.urutan)) ada.urutan = b.urutan;
  }

  // Kode diambil dari baris MANA PUN yang punya, termasuk yang tidak aktif:
  // pada perkara ikrar talak, kodenya hanya ada di baris yang tidak aktif.
  for (const b of semua) {
    if (!b.kode) continue;
    const kunci = kunciNama(b.nama) || b.nama.toLowerCase();
    const ada = kelompok.get(kunci);
    if (ada && !ada.kode) ada.kode = b.kode;
  }

  const urut = [...kelompok.values()].sort((a, b) => {
    if (a.urutan !== b.urutan) return a.urutan - b.urutan;
    return a.nama.localeCompare(b.nama, "id");
  });

  return {
    nama: urut.map((x) => x.nama).join(", "),
    kode: urut.map((x) => x.kode).filter(Boolean).join("-"),
  };
}

module.exports = { satukanPetugas, kunciNama };
