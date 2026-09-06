"use strict";

/**
 * ============================================================================
 * TABEL PEMETAAN RUAS TEKS BEBAS
 * ============================================================================
 *
 * Diperiksa terhadap PENGUKURAN SUNGGUHAN yang tersimpan pada
 * penyandingan/ukuran-ruas-bebas-20260907.json - bukan terhadap daftar yang
 * ditulis dari ingatan.
 *
 * Yang paling dijaga: setiap tulisan yang benar-benar ada pada SIPP untuk
 * kedua ruas yang dipetakan penuh HARUS dikenali. Tabel pemetaan yang
 * meninggalkan tulisan yang ada akan membuat sebagian data jatuh ke kelompok
 * "belum dipetakan" tanpa ada yang menyadarinya - dan kelompok itu perlahan
 * membesar sampai tidak ada yang tahu berapa banyak yang hilang.
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

const fs = require("fs");
const path = require("path");
const A = require("../services/acuanRuasService");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) lulus += 1;
  else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const JALUR_UKURAN = path.resolve(__dirname, "..", "penyandingan", "ukuran-ruas-bebas-20260907.json");

console.log("");
console.log("== Pengukuran sungguhan tersimpan ==");
periksa("berkas pengukuran ada", fs.existsSync(JALUR_UKURAN), JALUR_UKURAN);

let ukuran = null;
if (fs.existsSync(JALUR_UKURAN)) {
  ukuran = JSON.parse(fs.readFileSync(JALUR_UKURAN, "utf8"));
  periksa("memuat enam ruas", (ukuran.ruas || []).length === 6, String((ukuran.ruas || []).length));
  periksa("bertanggal", /^\d{4}-\d{2}-\d{2}/.test(String(ukuran.diukurPada)), String(ukuran.diukurPada));
}

function ruasUkuran(kunci) {
  return (ukuran && ukuran.ruas.find((r) => r.kunci === kunci)) || null;
}

console.log("== Ruang sidang: setiap tulisan yang ADA harus dikenali ==");
{
  const r = ruasUkuran("ruangSidang");
  periksa("ruas ruang sidang terukur", Boolean(r && r.ukuran));
  if (r && r.ukuran) {
    const nyata = (r.ukuran.sering || []).map((x) => String(x.nilai));
    // Dua puluh dua, bukan dua puluh tiga. Percobaan pertama menghitung 23
    // karena COUNT(DISTINCT ...) atas COALESCE(x,'') ikut menghitung tulisan
    // KOSONG sebagai satu nilai - cacat pada pengukurnya sendiri, yang baru
    // ketahuan ketika daftar tulisannya dibandingkan dengan hitungannya.
    periksa("dua puluh dua tulisan terukur", nyata.length === 22, String(nyata.length));
    periksa("dan hitungan tulisan berbedanya sama dengan panjang daftarnya",
      Number(((r.ukuran.jumlah || [])[0] || {}).berbeda) === nyata.length,
      `hitungan ${((r.ukuran.jumlah || [])[0] || {}).berbeda}, daftar ${nyata.length}`);

    const belum = nyata.filter((t) => !A.petakanRuangSidang(t).dikenali);
    periksa(
      "seluruh tulisan yang ada dikenali tabel pemetaan",
      belum.length === 0,
      belum.length ? `belum dipetakan: ${belum.join(" | ")}` : ""
    );

    // Yang paling menentukan: tiga cara menulis ruangan yang sama.
    const satu = ["Ruang Sidang 1", "1", "Ruangan Satu", "Ruang Sidang 1 Dalam Gedung", "Ruang Sidang Dalam Gedung 1"];
    periksa(
      "lima cara menulis Ruang Sidang 1 menjadi satu kelompok",
      new Set(satu.map((t) => A.petakanRuangSidang(t).kelompok)).size === 1,
      JSON.stringify(satu.map((t) => A.petakanRuangSidang(t).kelompok))
    );

    // Tanpa pemetaan, satu ruangan terhitung sebagai lima. Diukur.
    const jumlahSatu = (r.ukuran.sering || [])
      .filter((x) => satu.includes(String(x.nilai)))
      .reduce((s, x) => s + Number(x.jumlah), 0);
    console.log(`        Ruang Sidang 1 sebenarnya ${jumlahSatu.toLocaleString("id-ID")} sidang, ditulis lima cara`);
    periksa("dan jumlahnya lebih dari lima belas ribu", jumlahSatu > 15000, String(jumlahSatu));

    periksa(
      "sidang di luar gedung terpisah dari dalam gedung",
      A.petakanRuangSidang("Sidang Keliling Sirenja").kelompok === "Sidang Keliling" &&
        A.petakanRuangSidang("Terpadu Labuan").kelompok === "Sidang Terpadu di Luar Gedung"
    );
  }
}

console.log("== Pendidikan: setiap tulisan yang ADA harus dikenali ==");
{
  const r = ruasUkuran("pendidikan");
  periksa("ruas pendidikan terukur", Boolean(r && r.ukuran));
  if (r && r.ukuran) {
    const nyata = (r.ukuran.sering || []).map((x) => String(x.nilai));
    const belum = nyata.filter((t) => {
      const h = A.petakanPendidikan(t);
      // Angka telanjang dan tanda hubung memang tidak dikenali, dan itu benar.
      return !h.dikenali && h.kelompok === A.BELUM_DIPETAKAN;
    });
    periksa(
      "seluruh tulisan yang berarti dikenali",
      belum.length === 0,
      belum.length ? `belum dipetakan: ${belum.join(" | ")}` : ""
    );

    periksa("SMA dan Sekolah Lanjutan Tingkat Atas satu jenjang",
      A.petakanPendidikan("SMA").kelompok === A.petakanPendidikan("Sekolah Lanjutan Tingkat Atas").kelompok);
    periksa("keempat Diploma menjadi satu kelompok",
      new Set(["Diploma I", "Diploma II", "Diploma III", "Diploma IV"].map((t) => A.petakanPendidikan(t).kelompok)).size === 1);

    // Angka telanjang TIDAK dibuang - dipetakan ke "tidak terbaca".
    periksa("angka telanjang menjadi tidak terbaca, bukan dibuang",
      A.petakanPendidikan("2").kelompok === A.TIDAK_TERBACA && A.petakanPendidikan("9").kelompok === A.TIDAK_TERBACA);
    periksa("tanda hubung menjadi tidak terbaca",
      A.petakanPendidikan("-").kelompok === A.TIDAK_TERBACA);
    periksa("kosong menjadi tidak terbaca",
      A.petakanPendidikan("").kelompok === A.TIDAK_TERBACA && A.petakanPendidikan(null).kelompok === A.TIDAK_TERBACA);

    // Cakupan sesungguhnya - mengoreksi dugaan lama.
    const jm = (r.ukuran.jumlah || [])[0] || {};
    const persen = (Number(jm.terisi) / Number(jm.semua)) * 100;
    console.log(`        pendidikan terisi ${Number(jm.terisi).toLocaleString("id-ID")} dari ${Number(jm.semua).toLocaleString("id-ID")} - ${persen.toFixed(1)} persen`);
    periksa("cakupannya di bawah lima belas persen, jauh dari dugaan lama", persen < 15, persen.toFixed(1));
  }
}

console.log("== Yang tidak dikenali tidak dipaksa masuk kelompok terdekat ==");
{
  const asing = A.petakanRuangSidang("Ruang Rapat Lantai Dua");
  periksa("tulisan asing menjadi belum dipetakan", asing.kelompok === A.BELUM_DIPETAKAN);
  periksa("dan tulisan aslinya ikut terbawa", asing.asli === "Ruang Rapat Lantai Dua");
  periksa("dan tidak dinyatakan dikenali", asing.dikenali === false);
}

console.log("== Pembandingnya tahan beda huruf besar dan spasi ==");
{
  periksa("beda huruf besar tetap dikenali",
    A.petakanRuangSidang("RUANG SIDANG 1").kelompok === "Ruang Sidang 1");
  periksa("spasi berlebih tetap dikenali",
    A.petakanRuangSidang("  Ruang   Sidang 1  ").kelompok === "Ruang Sidang 1");
  periksa("tanda baca berbeda tetap dikenali",
    A.petakanPendidikan("Taman Kanak Kanak").kelompok === "Taman Kanak-kanak");
}

console.log("== Empat ruas yang sengaja belum disusun ==");
{
  periksa("empat ruas tercatat belum disusun", A.BELUM_DISUSUN.length === 4, String(A.BELUM_DISUSUN.length));
  periksa("masing-masing menyebut jumlah tulisannya dan sebabnya",
    A.BELUM_DISUSUN.every((x) => x.ruas && x.tulisanBerbeda > 0 && x.sebab && x.sebab.length > 40));
  periksa("alasan penundaan menyebut pencampuran alasan dengan hasil",
    /mencampur ALASAN dengan HASIL/.test(A.BELUM_DISUSUN.find((x) => x.ruas === "alasanDitunda").sebab));
  periksa("kecamatan dinyatakan TIDAK perlu dipetakan",
    /TIDAK perlu dipetakan/.test(A.BELUM_DISUSUN.find((x) => x.ruas === "kecamatan").sebab));

  // Angkanya harus cocok dengan pengukuran, bukan ditulis dari ingatan.
  if (ukuran) {
    A.BELUM_DISUSUN.forEach((b) => {
      const r = ruasUkuran(b.ruas);
      if (!r || !r.ukuran) return;
      const jm = (r.ukuran.jumlah || [])[0] || {};
      periksa(
        `jumlah tulisan ${b.ruas} cocok dengan pengukuran`,
        Number(jm.berbeda) === b.tulisanBerbeda,
        `tabel menyebut ${b.tulisanBerbeda}, pengukuran ${jm.berbeda}`
      );
    });
  }
}

console.log("");
console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal > 0 ? 1 : 0);
