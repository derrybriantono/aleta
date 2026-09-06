"use strict";

/**
 * ============================================================================
 * BAB 7 - GERBANG RAPOR APARATUR
 * ============================================================================
 *
 * Rapor yang menyebut NAMA ORANG adalah bagian paling berbahaya dari seluruh
 * aplikasi ini. Ia mengukur yang TERCATAT, bukan yang sebenarnya terjadi.
 * Perkara sulit, majelis yang kekurangan orang, dan wilayah yang jauh tidak
 * seluruhnya tertangkap - terlebih karena nilai kerumitan perkara tidak dapat
 * dibangun, sehingga tidak ada penyeimbang sama sekali.
 *
 * Rencana menempatkannya di tahap paling akhir dengan sengaja, dan menyebut
 * syaratnya: baru boleh terbit sesudah Bab 2 bersih, hak jawab berjalan,
 * disposisi berjalan, dan rentang keyakinan terpasang.
 *
 * ============================================================================
 * SYARAT YANG DITULIS DI DOKUMEN AKAN DILANGGAR; SYARAT YANG DIPAKSA KODE TIDAK
 * ============================================================================
 *
 * Syarat semacam itu, bila hanya tertulis pada dokumen rencana, akan dilanggar
 * pada hari pertama seseorang membutuhkan angka untuk rapat. Bukan karena
 * niat buruk - melainkan karena dokumen tidak menghalangi apa pun.
 *
 * Karena itu syaratnya dipaksakan di sini. Rapor yang belum memenuhi syarat
 * tidak dapat diterbitkan; yang dipulangkan DAFTAR SEBAB, bukan angka. Daftar
 * itu sendiri berguna: ia menyebut persis apa yang harus dikerjakan lebih
 * dahulu.
 *
 * Menerbitkan rapor yang belum memenuhi syarat bukan mustahil - pimpinan dapat
 * memutuskan demikian. Tetapi keputusan itu harus DIAMBIL DENGAN SADAR,
 * bertanggal, dan bernama; bukan terjadi karena tidak ada yang menghalangi.
 */

const catatan = require("./catatanPenilaianService");
const penyandingan = require("./penyandinganService");
const sasaran = require("./sasaranKinerjaService");
const ketelitian = require("./ketelitianNilaiService");
const periode = require("./periodePenilaianService");

/**
 * Enam syarat. Masing-masing menjawab satu cara rapor dapat menuduh keliru.
 */
const SYARAT = [
  {
    kunci: "hakJawab",
    alat: "D02",
    kalimat: "hak jawab harus tersedia pada setiap baris temuan",
    sebabnya:
      "Rapor yang menyebut nama tanpa tempat menjawab adalah tuduhan. Yang dinilai harus dapat menuliskan penjelasannya, dan penjelasan itu terbawa bersama temuannya.",
  },
  {
    kunci: "disposisi",
    alat: "D14",
    kalimat: "disposisi pimpinan harus tersedia pada layar penilaiannya",
    sebabnya:
      "Rapor aparatur adalah bahan pembinaan, dan pembinaan adalah kewenangan pimpinan. Tanpa tempat menuliskan arahan, rapor berubah menjadi vonis yang tidak berpenandatangan.",
  },
  {
    kunci: "rentangKeyakinan",
    alat: "D17",
    kalimat: "setiap baris bernama harus membawa rentang keyakinannya",
    sebabnya:
      "Selisih tiga poin pada penyebut dua puluh tiga adalah riak, bukan perbedaan. Tanpa rentang, seseorang dipanggil menghadap karena angka yang sebenarnya tidak berbeda.",
  },
  {
    kunci: "penyebutCukup",
    alat: "MS05",
    kalimat: "setiap baris bernama harus berpenyebut cukup, atau tidak diberi nilai",
    sebabnya:
      "Juru sita yang menangani tiga panggilan tidak boleh punya nilai. Justru pada tingkat orang pembatas ini paling penting, sebab di situlah namanya tertulis di sebelah angkanya.",
  },
  {
    kunci: "huluBersih",
    alat: "D06",
    kalimat: "sumber data hulunya harus bersih, atau rapornya membawa lencana bersyarat",
    sebabnya:
      "Seluruh nilai ketaatan berdiri di atas tanggal penginputan. Selama suntingan sesudah minutasi belum ditelaah, rapor yang tampil bersih memberi keyakinan yang tidak dimilikinya.",
  },
  {
    kunci: "sudahDisandingkan",
    alat: "penyandingan",
    kalimat: "angkanya harus pernah disandingkan dengan angka dari luar ALETA",
    sebabnya:
      "Aturan yang berlaku di atas segalanya: penilaian belum dianggap benar karena programnya berjalan. Rapor bernama orang yang angkanya belum pernah diperiksa dari luar adalah tuduhan tanpa bukti.",
  },
];

function bersih(x) {
  return String(x === undefined || x === null ? "" : x).trim();
}

/**
 * Memeriksa apakah sebuah rapor aparatur boleh diterbitkan.
 *
 * @param rapor  hasil raporBerjenjangService.berjenjang()
 * @param opsi   { penilaian, tanggal, periksaPenyandingan }
 */
function periksaSyarat(rapor, opsi = {}) {
  const kunciPenilaian = bersih(opsi.penilaian || (rapor && rapor.kunci));
  const tanggal = bersih(opsi.tanggal) || null;
  const belum = [];
  const terpenuhi = [];

  function catat(kunci, lulus, keteranganTambahan) {
    const s = SYARAT.find((x) => x.kunci === kunci);
    if (lulus) terpenuhi.push({ ...s });
    else belum.push({ ...s, keterangan: keteranganTambahan || "" });
  }

  if (!rapor || rapor.ok === false || !Array.isArray(rapor.ringkasPelaku)) {
    return {
      bolehTerbit: false,
      belum: [{ kunci: "rapor", kalimat: "rapornya sendiri tidak sah", sebabnya: "" }],
      terpenuhi: [],
    };
  }

  // D02 dan D14 - mekanismenya ada bila jenis catatannya terdaftar.
  catat("hakJawab", Object.prototype.hasOwnProperty.call(catatan.JENIS, "penjelasan"));
  catat("disposisi", Object.prototype.hasOwnProperty.call(catatan.JENIS, "disposisi"));

  // D17 - setiap baris bernama yang BERNILAI harus dapat dihitung rentangnya.
  // Baris yang tidak bernilai tidak menuduh siapa pun, jadi tidak perlu.
  const bernilai = rapor.ringkasPelaku.filter((p) => p.nilai !== null && p.nilai !== undefined);
  const tanpaRentang = bernilai.filter(
    (p) => ketelitian.selangWilson(p.terpenuhi, p.penyebut) === null
  );
  catat(
    "rentangKeyakinan",
    tanpaRentang.length === 0,
    tanpaRentang.length ? `${tanpaRentang.length} baris bernilai tidak dapat dihitung rentangnya` : ""
  );

  // MS05 - tidak boleh ada baris bernilai yang penyebutnya di bawah pembatas.
  const batas = periode.CUKUP_PENYEBUT;
  const penyebutKurang = bernilai.filter((p) => Number(p.penyebut) < batas);
  catat(
    "penyebutCukup",
    penyebutKurang.length === 0,
    penyebutKurang.length
      ? `${penyebutKurang.length} baris bernilai berpenyebut di bawah ${batas}: ${penyebutKurang
          .map((p) => `${p.pelaku} (${p.penyebut})`)
          .join(", ")}`
      : ""
  );

  // D06 - hulunya bersih, atau rapornya membawa lencana.
  const hulu = sasaran.keadaanMenurutHulu(kunciPenilaian);
  const membawaLencana = Boolean(opsi.membawaLencanaHulu);
  catat(
    "huluBersih",
    !hulu.perluLencana || membawaLencana,
    hulu.perluLencana ? `hulunya berkeadaan "${hulu.keadaan}" dan rapornya belum membawa lencana bersyarat` : ""
  );

  // Penyandingan - aturan yang berlaku di atas segalanya.
  const keadaanSanding = penyandingan.keadaanPenilaian(kunciPenilaian, opsi.periodePenyandingan || null);
  catat(
    "sudahDisandingkan",
    keadaanSanding.keadaan === "terbukti",
    keadaanSanding.keadaan === "belum"
      ? "belum pernah disandingkan dengan angka dari luar ALETA"
      : keadaanSanding.keadaan === "berselisih"
        ? "pernah disandingkan tetapi angkanya berselisih; selisihnya harus diselesaikan lebih dahulu"
        : ""
  );

  return {
    bolehTerbit: belum.length === 0,
    penilaian: kunciPenilaian,
    tanggal,
    belum,
    terpenuhi,
    jumlahBarisBernama: rapor.ringkasPelaku.length,
    jumlahBarisBernilai: bernilai.length,
  };
}

/**
 * Kalimat peringatan yang WAJIB tampil pada layar rapor aparatur, apa pun
 * keadaannya - termasuk ketika seluruh syarat terpenuhi.
 *
 * Syarat yang terpenuhi tidak mengubah sifat rapor ini: ia tetap mengukur yang
 * tercatat, bukan yang terjadi. Menghilangkan peringatannya ketika syaratnya
 * lengkap akan membuat orang menyangka angkanya sudah menggambarkan kinerja
 * seutuhnya.
 */
const PERINGATAN_TETAP =
  "Rapor ini mengukur yang TERCATAT, bukan yang sebenarnya terjadi. Perkara sulit, majelis yang " +
  "kekurangan orang, dan wilayah yang jauh tidak seluruhnya tertangkap. Ia bahan pembinaan, bukan " +
  "dasar penjatuhan sanksi.";

/**
 * Menyusun rapor yang siap tampil, atau menolak beserta sebabnya.
 *
 * Penolakannya tidak menyembunyikan datanya: daftar pelaku beserta penyebutnya
 * tetap dipulangkan supaya yang membaca tahu pekerjaan apa yang tercatat.
 * Yang ditahan hanyalah NILAI - sebab nilailah yang menuduh.
 */
function terbitkan(rapor, opsi = {}) {
  const syarat = periksaSyarat(rapor, opsi);
  if (syarat.bolehTerbit) {
    return {
      terbit: true,
      peringatan: PERINGATAN_TETAP,
      syarat,
      rapor,
    };
  }
  return {
    terbit: false,
    peringatan: PERINGATAN_TETAP,
    syarat,
    // Nilai ditahan; sisanya tidak.
    rapor: {
      ...rapor,
      ringkasPelaku: (rapor.ringkasPelaku || []).map((p) => ({
        pelaku: p.pelaku,
        terpenuhi: p.terpenuhi,
        penyebut: p.penyebut,
        nilai: null,
        nilaiDitahan: true,
      })),
    },
    sebabDitahan: syarat.belum.map((b) => b.kalimat),
  };
}

module.exports = { SYARAT, PERINGATAN_TETAP, periksaSyarat, terbitkan };
