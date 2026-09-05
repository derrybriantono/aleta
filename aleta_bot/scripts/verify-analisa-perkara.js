"use strict";

/**
 * Menguji analisa satu perkara - garis waktu, jeda antar sidang, ketepatan
 * input, dan ringkasan.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Analisa berbeda dari daftar angka: ia MENYIMPULKAN, dan kesimpulan yang
 * keliru jauh lebih sulit dibantah daripada angka yang keliru - orang
 * mempercayai gambar. Maka yang diuji paling keras:
 *
 *   - titik yang tanggalnya tidak terbaca TIDAK digambar, bukan ditaruh di
 *     tempat yang ditebak,
 *   - alasan sebuah jeda diambil dari sidang yang DITUNDA, bukan dari sidang
 *     berikutnya yang belum terjadi,
 *   - poin ketepatan input mengikuti tangga SK apa adanya,
 *   - ringkasan hanya berbicara bila ada yang perlu dikatakan.
 */

const analisa = require("../services/analisaPerkaraService");

let jumlah = 0;
let gagal = 0;

function cek(nama, dapat, harap) {
  jumlah += 1;
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!sama) {
    gagal += 1;
    console.log(`  GAGAL: ${nama}`);
    console.log(`         diharap ${JSON.stringify(harap)}, didapat ${JSON.stringify(dapat)}`);
  }
}

/** Perkara acuan: didaftarkan 1 Juli 2026, tiga sidang, belum putus. */
function bahan(ubah = {}) {
  return {
    tanggalDaftar: "2026-07-01",
    hariIni: "2026-10-05",
    sudahPutus: false,
    sebabSelesai: "",
    putusan: {},
    tahapan: {
      tahap: [
        { kunci: "pendaftaran", label: "Pendaftaran", tanggal: "2026-07-01", diinput: "2026-07-01" },
        { kunci: "pmh", label: "PMH", tanggal: "2026-07-03", diinput: "2026-07-03" },
        { kunci: "ppp", label: "PPP", tanggal: "2026-07-03", diinput: "2026-07-04" },
        { kunci: "pjs", label: "PJS", tanggal: "2026-07-03", diinput: "2026-07-08" },
        { kunci: "phs", label: "PHS", tanggal: "2026-07-03", diinput: "2026-07-03" },
      ],
    },
    jadwal: [
      { tanggalSidang: "2026-07-15", agenda: "Sidang pertama", ditunda: true, alasanDitunda: "Tergugat tidak hadir" },
      { tanggalSidang: "2026-08-05", agenda: "Mediasi", ditunda: true, alasanDitunda: "Menunggu hasil mediasi" },
      { tanggalSidang: "2026-09-09", agenda: "Pembuktian", ditunda: true, alasanDitunda: "Saksi belum siap" },
    ],
    biaya: { panjar: 300000, terpakai: 228500, sisa: 71500 },
    panggilan: { jumlahPihak: 2, patut: 2 },
    penilaian: { skor: 88, keadaan: "baik", pengaturan: {} },
    hariBerjalan: 96,
    hariBersih: 97,
    hariMediasi: 0,
    hariSejakPutus: null,
    ambangMinutasi: 14,
    ambangHari: 150,
    ...ubah,
  };
}

const titik = (hasil, kunci) => hasil.garisWaktu.titik.find((x) => x.kunci === kunci);

console.log("");
console.log("Uji analisa perkara - garis waktu, jeda, ketepatan input, ringkasan");
console.log("");

// ---------------------------------------------------------------------------
console.log("  Garis waktu");
{
  const hasil = analisa.analisaPerkara(bahan());
  cek("terbaca", hasil.garisWaktu.terbaca, true);
  cek("dimulai dari pendaftaran", titik(hasil, "daftar").hariKe, 0);
  cek("PMH pada hari ke-2", titik(hasil, "pmh").hariKe, 2);
  cek("sidang pertama pada hari ke-14", titik(hasil, "sidang-1").hariKe, 14);
  cek("sidang ketiga pada hari ke-70", titik(hasil, "sidang-3").hariKe, 70);
  cek("panjangnya sampai hari ini", hasil.garisWaktu.totalHari, 96);
  cek("ambang 150 hari belum tampak", hasil.garisWaktu.ambangTampak, false);

  // Titiknya harus terurut - gambar yang titiknya melompat mundur tidak dapat
  // dibaca sama sekali.
  const urut = hasil.garisWaktu.titik.map((x) => x.hariKe);
  cek("titik terurut menurut waktunya", urut.slice().sort((a, b) => a - b), urut);
}

{
  // Tahapan yang tanggalnya kosong TIDAK boleh muncul di garis waktu. Menaruh
  // titik yang ditebak membuat gambarnya berbohong dengan meyakinkan.
  const hasil = analisa.analisaPerkara(
    bahan({
      tahapan: {
        tahap: [
          { kunci: "pmh", label: "PMH", tanggal: "2026-07-03", diinput: "2026-07-03" },
          { kunci: "ppp", label: "PPP", tanggal: "", diinput: "" },
          { kunci: "phs", label: "PHS", tanggal: null, diinput: null },
        ],
      },
    })
  );
  cek("PMH digambar", Boolean(titik(hasil, "pmh")), true);
  cek("PPP tanpa tanggal tidak digambar", Boolean(titik(hasil, "ppp")), false);
  cek("PHS tanpa tanggal tidak digambar", Boolean(titik(hasil, "phs")), false);
}

{
  // Perkara sudah putus: minutasi dan BHT jatuh SESUDAH tanggal akhir, dan
  // tidak boleh terpotong keluar dari gambar.
  const hasil = analisa.analisaPerkara(
    bahan({
      sudahPutus: true,
      sebabSelesai: "putus",
      hariIni: "2026-12-01",
      putusan: {
        tanggalPutusan: "2026-10-05",
        tanggalMinutasi: "2026-10-12",
        tanggalBht: "2026-10-20",
      },
    })
  );
  cek("akhirnya tanggal putusan", hasil.garisWaktu.akhir, "2026-10-05");
  cek("total sampai putusan", hasil.garisWaktu.totalHari, 96);
  cek("panjang gambar mencakup BHT", hasil.garisWaktu.panjangHari, 111);
  cek("minutasi digambar", titik(hasil, "minutasi").hariKe, 103);
  cek("label putusan mengikuti sebabnya", titik(hasil, "putusan").label, "Putus");

  const dicabut = analisa.analisaPerkara(
    bahan({
      sudahPutus: true,
      sebabSelesai: "dicabut",
      putusan: { tanggalPutusan: "2026-10-05" },
    })
  );
  cek("perkara dicabut disebut Dicabut", titik(dicabut, "putusan").label, "Dicabut");
}

// ---------------------------------------------------------------------------
console.log("  Jeda antar sidang");
{
  const hasil = analisa.analisaPerkara(bahan());
  const baris = hasil.jedaSidang.baris;

  cek("daftar sampai sidang pertama 14 hari", baris[0].hari, 14);
  cek("sidang 1 ke 2 sepanjang 21 hari", baris[1].hari, 21);
  cek("sidang 2 ke 3 sepanjang 35 hari", baris[2].hari, 35);

  // Alasan jeda diambil dari sidang yang DITUNDA - yaitu sidang sebelumnya.
  cek("alasan jeda dari sidang sebelumnya", baris[1].alasan, "Tergugat tidak hadir");
  cek("bukan dari sidang berikutnya", baris[2].alasan, "Menunggu hasil mediasi");

  // Sidang terakhir 9 September, hari ini 5 Oktober.
  const menggantung = baris.find((x) => x.jenis === "berjalan");
  cek("jarak sidang terakhir ke hari ini", menggantung.hari, 26);
  cek("alasannya ikut terbawa", menggantung.alasan, "Saksi belum siap");

  cek("rata-rata antar sidang", hasil.jedaSidang.rata, 28);
  cek("jeda terpanjang 35 hari", hasil.jedaSidang.terpanjang.hari, 35);
}

{
  const kosong = analisa.analisaPerkara(bahan({ jadwal: [] }));
  cek("tanpa sidang dijawab apa adanya", kosong.jedaSidang.terbaca, false);
  cek("dan tidak mengarang baris", kosong.jedaSidang.baris.length, 0);
}

{
  // Perkara yang sudah putus tidak punya jeda "sampai hari ini" - yang ada
  // jarak sidang terakhir ke putusan.
  const putus = analisa.analisaPerkara(
    bahan({ sudahPutus: true, putusan: { tanggalPutusan: "2026-09-23" } })
  );
  const baris = putus.jedaSidang.baris;
  cek("tidak ada jeda berjalan", Boolean(baris.find((x) => x.jenis === "berjalan")), false);
  cek("ada jarak sidang terakhir ke putusan", baris[baris.length - 1].hari, 14);
}

// ---------------------------------------------------------------------------
console.log("  Ketepatan input ke SIPP");
{
  const hasil = analisa.analisaPerkara(bahan());
  const cari = (kunci) => hasil.ketepatanInput.baris.find((x) => x.kunci === kunci);

  cek("PMH diinput hari yang sama", cari("pmh").selisih, 0);
  cek("dan bernilai penuh", cari("pmh").poin, 5);
  cek("PPP terlambat sehari", cari("ppp").selisih, 1);
  cek("bernilai 3 menurut tangga SK", cari("ppp").poin, 3);
  cek("PJS terlambat lima hari", cari("pjs").selisih, 5);
  cek("bernilai nol", cari("pjs").poin, 0);
  cek("sebutannya menyebut jumlah harinya", cari("pjs").sebutan, "terlambat 5 hari");
  cek("dua tahapan terlambat", hasil.ketepatanInput.terlambat, 2);
}

{
  // Tangga SK diuji langsung, supaya perubahan SK ketahuan di sini.
  cek("hari yang sama bernilai 5", analisa.poinInput(0).poin, 5);
  cek("hari ke-1 bernilai 3", analisa.poinInput(1).poin, 3);
  cek("hari ke-2 bernilai 2", analisa.poinInput(2).poin, 2);
  cek("hari ke-3 bernilai 1", analisa.poinInput(3).poin, 1);
  cek("hari ke-4 bernilai 0", analisa.poinInput(4).poin, 0);
  cek("hari ke-30 tetap 0", analisa.poinInput(30).poin, 0);
}

{
  const tanpaInput = analisa.analisaPerkara(
    bahan({ tahapan: { tahap: [{ kunci: "pmh", label: "PMH", tanggal: "2026-07-03", diinput: "" }] } })
  );
  cek("tanpa tanggal input dijawab apa adanya", tanpaInput.ketepatanInput.terbaca, false);
  cek("dan tidak mengarang baris", tanpaInput.ketepatanInput.baris.length, 0);
}

// ---------------------------------------------------------------------------
console.log("  Ringkasan");
{
  const hasil = analisa.analisaPerkara(bahan());
  const teks = hasil.ringkasan.join(" | ");

  cek("menyebut umur dan ambangnya", /97 hari.*masih di dalam ambang 150 hari/.test(teks), true);
  cek("menyebut sidang yang menggantung", /26 hari sejak sidang terakhir/.test(teks), true);
  cek("menyebut alasan tundaannya", /saksi belum siap/i.test(teks), true);
  cek("menyebut jeda terpanjang", /Jeda terpanjang 35 hari/.test(teks), true);
  cek("menyebut keterlambatan input", /2 tahapan diinput terlambat/.test(teks), true);
  cek("menyebut nilai kelengkapan", /Nilai kelengkapan 88 dari 100 - baik/.test(teks), true);
  // Panjar masih ada dan seluruh pihak dipanggil patut - tidak perlu disebut.
  cek("tidak menyebut panjar yang masih cukup", /panjar/i.test(teks), false);
  cek("tidak menyebut panggilan yang sudah patut", /belum dipanggil/i.test(teks), false);
}

{
  // Perkara yang bersih: ringkasannya harus PENDEK. Ringkasan yang memaksakan
  // lima kalimat pada perkara tanpa masalah berhenti dibaca sama seperti
  // peringatan yang selalu menyala.
  const bersih = analisa.analisaPerkara(
    bahan({
      hariIni: "2026-07-20",
      hariBerjalan: 19,
      hariBersih: 20,
      jadwal: [{ tanggalSidang: "2026-07-15", agenda: "Sidang pertama", ditunda: false, alasanDitunda: "" }],
      penilaian: { skor: 100, keadaan: "baik", pengaturan: {} },
      tahapan: {
        tahap: [
          { kunci: "pmh", label: "PMH", tanggal: "2026-07-03", diinput: "2026-07-03" },
          { kunci: "phs", label: "PHS", tanggal: "2026-07-03", diinput: "2026-07-03" },
        ],
      },
    })
  );
  cek("perkara bersih ringkasannya pendek", bersih.ringkasan.length <= 3, true);
  cek("tidak menyebut keterlambatan yang tidak ada", /terlambat/.test(bersih.ringkasan.join(" ")), false);
}

{
  // Keadaan yang menuntut tindakan harus BERSUARA.
  const bermasalah = analisa.analisaPerkara(
    bahan({
      hariBerjalan: 200,
      hariBersih: 201,
      panggilan: { jumlahPihak: 3, patut: 1 },
      biaya: { panjar: 300000, terpakai: 320000, sisa: -20000 },
      sudahPutus: true,
      putusan: { tanggalPutusan: "2026-09-01" },
      hariSejakPutus: 34,
      penilaian: { skor: 41, keadaan: "kurang", pengaturan: {} },
    })
  );
  const teks = bermasalah.ringkasan.join(" | ");
  cek("umur melewati ambang disebut", /melewati ambang 150 hari/.test(teks), true);
  cek("pihak yang belum patut disebut", /2 dari 3 pihak belum dipanggil/.test(teks), true);
  cek("panjar minus disebut", /Panjar MINUS/.test(teks), true);
  cek("minutasi yang lewat tenggang disebut", /sudah 34 hari sejak putusan/.test(teks), true);
}

{
  // Diputus kemarin, belum diminutasi: tenggangnya masih berjalan, dan
  // kalimatnya harus menyebut itu - bukan menuduh terlambat.
  const baruPutus = analisa.analisaPerkara(
    bahan({
      sudahPutus: true,
      putusan: { tanggalPutusan: "2026-10-04" },
      hariSejakPutus: 1,
    })
  );
  const teks = baruPutus.ringkasan.join(" | ");
  cek("tenggang minutasi yang berjalan disebut apa adanya", /hari ke-1 dari tenggang 14 hari/.test(teks), true);
  cek("tidak menuduh terlambat", /sudah 1 hari sejak putusan/.test(teks), false);
}

// ---------------------------------------------------------------------------
console.log("  Tanggal yang tidak terbaca tidak menjatuhkan apa pun");
{
  const rusak = analisa.analisaPerkara({ tanggalDaftar: "", hariIni: "2026-10-05" });
  cek("garis waktu menyebut sebabnya", rusak.garisWaktu.terbaca, false);
  cek("jeda menyebut sebabnya", rusak.jedaSidang.terbaca, false);
  cek("ketepatan menyebut sebabnya", rusak.ketepatanInput.terbaca, false);
  cek("ringkasan tetap tersusun", Array.isArray(rusak.ringkasan), true);
}

console.log("");
if (gagal === 0) {
  console.log(`  OK - ${jumlah} pemeriksaan lulus.`);
  console.log("");
  process.exit(0);
} else {
  console.log(`  ${gagal} dari ${jumlah} pemeriksaan GAGAL.`);
  console.log("");
  process.exit(1);
}
