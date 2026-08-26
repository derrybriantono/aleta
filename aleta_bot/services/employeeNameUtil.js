"use strict";

// Utilitas nama pegawai untuk parameter query legacy.
// Sengaja tanpa dependensi apa pun supaya bisa diuji tanpa database.

/**
 * Siapkan nama pegawai sebagai parameter query legacy.
 *
 * Query legacy per-pegawai menyaring dengan `LIKE '%${nama}%'` terhadap kolom
 * SIPP (mis. f.hakim_nama). Aplikasi lama memakai nama PENDEK tanpa gelar
 * ("Derry Briantono"), sedangkan Manajemen Akun menyimpan nama lengkap bergelar
 * ("DERRY BRIANTONO, S.H."). Nama bergelar membuat LIKE menuntut SIPP memuat
 * gelar itu juga — kalau tidak, hasilnya selalu 0 baris.
 *
 * Karena itu gelar di belakang koma dan gelar depan dibuang, sehingga pencarian
 * kembali menjadi substring nama saja.
 */
function normalizeLegacyEmployeeName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";

  // "DERRY BRIANTONO, S.H., M.H." -> "DERRY BRIANTONO"
  let normalized = raw.split(",")[0].trim();

  // Buang gelar depan yang lazim dipakai, berulang karena bisa bertumpuk
  // (mis. "Dr. H. Abdul Salam" -> "Abdul Salam").
  const gelarDepan = /^(?:Prof|Dr|Drs|Dra|Ir|H|Hj|KH)\.?\s+/i;
  while (gelarDepan.test(normalized)) {
    normalized = normalized.replace(gelarDepan, "").trim();
  }

  // Jaga-jaga bila hasilnya jadi kosong (mis. nama hanya berisi gelar).
  return normalized || raw;
}

module.exports = { normalizeLegacyEmployeeName };
