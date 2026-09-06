"use strict";

/**
 * ============================================================================
 * D17 - RENTANG KEYAKINAN, DAN D07 - DAMPAK BILA DIBERESKAN
 * ============================================================================
 *
 * Dua alat yang sama-sama menjawab "seberapa berarti angka ini", dari dua arah
 * yang berbeda.
 *
 * ============================================================================
 * D17 - SELISIH YANG BERARTI DAN SELISIH YANG KEBETULAN
 * ============================================================================
 *
 * Selisih dua poin pada penyebut empat belas ribu itu nyata. Selisih dua poin
 * pada penyebut dua puluh tiga itu kebetulan. Keduanya tampil sama pada tabel
 * biasa, dan dari situlah lahir pembinaan yang salah sasaran - seorang petugas
 * dipanggil karena angkanya turun tiga poin, padahal turunnya tidak lebih dari
 * riak.
 *
 * Yang dipakai selang Wilson, bukan selang normal biasa. Sebabnya bukan
 * kegemaran pada rumus: selang normal melar keluar batas nol dan seratus pada
 * nilai yang mendekati ujung - dan penilaian ketaatan justru hampir selalu
 * mendekati seratus. Selang yang menyatakan "97,8 persen, antara 96,2 dan
 * 101,4" adalah selang yang salah, dan kesalahannya terlihat oleh siapa pun.
 *
 * ============================================================================
 * D07 - DAMPAK BILA DIBERESKAN
 * ============================================================================
 *
 * Tahu salahnya di mana berbeda dengan tahu mana yang dikerjakan lebih dahulu.
 * Dampak dihitung apa adanya: berapa poin nilai naik bila baris ini berubah
 * dari tidak memenuhi menjadi memenuhi. Bukan taksiran, bukan pembobotan -
 * sekadar aritmetika yang dapat diperiksa siapa pun.
 *
 * Perkiraan USAHA sengaja TIDAK dihitung mesin. Mesin tidak tahu bahwa
 * melengkapi seratus dua puluh naskah anonimisasi memakan dua hari sedangkan
 * menelaah tujuh ribu suntingan memerlukan keputusan pimpinan. Menaksirnya
 * dengan angka karangan akan membuat urutan pengerjaan tampak berdasar padahal
 * tidak.
 */

/** Titik z untuk tingkat keyakinan 95 persen. */
const Z95 = 1.959963984540054;

/**
 * Bilangan, atau null bila memang tidak ada.
 *
 * `Number(null)` bernilai NOL. Memakai Number apa adanya membuat penilaian
 * yang angkanya belum ada memulangkan rentang keyakinan yang tampak sah untuk
 * nol persen - angka yang tidak pernah dihitung, disajikan seolah hasil.
 */
function angka(x) {
  if (x === null || x === undefined || x === "" || typeof x === "boolean") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Selang Wilson untuk sebuah proporsi, dalam persen.
 *
 * Selalu berada di dalam nol sampai seratus - itulah sebabnya ia dipilih.
 */
function selangWilson(terpenuhi, penyebut, z = Z95) {
  const a = angka(terpenuhi);
  const b = angka(penyebut);
  if (a === null || b === null || b <= 0 || a < 0 || a > b) return null;

  const p = a / b;
  const z2 = z * z;
  const penyebutWilson = 1 + z2 / b;
  const tengah = (p + z2 / (2 * b)) / penyebutWilson;
  const lebar = (z / penyebutWilson) * Math.sqrt((p * (1 - p)) / b + z2 / (4 * b * b));

  const bawah = Math.max(0, (tengah - lebar) * 100);
  const atas = Math.min(100, (tengah + lebar) * 100);
  const nilai = p * 100;

  return {
    nilai: +nilai.toFixed(1),
    bawah: +bawah.toFixed(1),
    atas: +atas.toFixed(1),
    // Lebar setengah, dipakai pada tampilan "97,8 ± 0,2".
    lebar: +(((atas - bawah) / 2)).toFixed(1),
    penyebut: b,
    tingkatKeyakinan: 95,
  };
}

/**
 * Apakah selisih dua nilai lebih besar daripada ketidaktelitian keduanya?
 *
 * Memulangkan `berarti: false` bila selangnya bertindihan. Itu BUKAN berarti
 * keduanya sama - hanya berarti datanya belum cukup untuk mengatakan mereka
 * berbeda. Perbedaan kedua kalimat itu menentukan apakah seseorang dipanggil
 * menghadap atau tidak.
 */
function selisihBerarti(satu, dua) {
  const a = selangWilson(satu.terpenuhi, satu.penyebut);
  const b = selangWilson(dua.terpenuhi, dua.penyebut);
  if (!a || !b) return { berarti: false, sebab: "salah satu angkanya tidak sah" };

  const bertindihan = a.bawah <= b.atas && b.bawah <= a.atas;
  return {
    berarti: !bertindihan,
    selisih: +(a.nilai - b.nilai).toFixed(1),
    satu: a,
    dua: b,
    sebab: bertindihan
      ? "rentang keduanya bertindihan - datanya belum cukup untuk mengatakan keduanya berbeda, dan itu tidak sama dengan mengatakan keduanya sama"
      : "rentang keduanya tidak bertindihan - selisihnya lebih besar daripada ketidaktelitiannya",
  };
}

/**
 * D07 - berapa poin nilai naik bila SATU baris dibereskan.
 *
 * Aritmetika belaka: (terpenuhi + 1) / penyebut dikurangi terpenuhi / penyebut.
 */
function dampakSatuBaris(terpenuhi, penyebut) {
  const a = angka(terpenuhi);
  const b = angka(penyebut);
  if (a === null || b === null || b <= 0 || a >= b) return 0;
  return +(((a + 1) / b - a / b) * 100).toFixed(3);
}

/**
 * D07 - berapa poin nilai naik bila SELURUH yang belum memenuhi dibereskan.
 * Inilah jarak menuju seratus, dan itu batas atas yang sebenarnya.
 */
function dampakSeluruhnya(terpenuhi, penyebut) {
  const a = angka(terpenuhi);
  const b = angka(penyebut);
  if (a === null || b === null || b <= 0 || a > b) return 0;
  return +(((b - a) / b) * 100).toFixed(1);
}

/**
 * Menyusun urutan pengerjaan dari beberapa penilaian.
 *
 * Diurutkan menurut dampak, dan itu satu-satunya yang dihitung mesin. Kolom
 * usaha sengaja dibiarkan kosong untuk diisi manusia - lihat keterangan di
 * kepala berkas.
 */
function urutanPengerjaan(daftar) {
  const sah = (Array.isArray(daftar) ? daftar : [])
    .filter((x) => x && angka(x.terpenuhi) !== null && angka(x.penyebut) !== null && Number(x.penyebut) > 0)
    .map((x) => {
      const belum = Number(x.penyebut) - Number(x.terpenuhi);
      return {
        kunci: x.kunci,
        judul: x.judul || x.kunci,
        belumMemenuhi: belum,
        terpenuhi: Number(x.terpenuhi),
        penyebut: Number(x.penyebut),
        nilai: +((Number(x.terpenuhi) / Number(x.penyebut)) * 100).toFixed(1),
        dampakSatu: dampakSatuBaris(x.terpenuhi, x.penyebut),
        dampakSeluruhnya: dampakSeluruhnya(x.terpenuhi, x.penyebut),
        usaha: null,
        penanggungJawab: x.penanggungJawab || null,
      };
    })
    .sort((a, b) => b.dampakSeluruhnya - a.dampakSeluruhnya || a.judul.localeCompare(b.judul, "id"));

  return {
    baris: sah,
    catatan:
      "Dampak dihitung apa adanya dari aritmetikanya dan dapat diperiksa siapa pun. Perkiraan USAHA sengaja " +
      "dibiarkan kosong: mesin tidak tahu bahwa satu pekerjaan memakan dua hari sedangkan yang lain menuntut " +
      "keputusan pimpinan, dan menaksirnya dengan angka karangan membuat urutan ini tampak berdasar padahal tidak.",
  };
}

module.exports = {
  Z95,
  selangWilson,
  selisihBerarti,
  dampakSatuBaris,
  dampakSeluruhnya,
  urutanPengerjaan,
};
