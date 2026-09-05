"use strict";

/**
 * Menguji rubrik ALETA - penilaianPerkaraService.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Rubrik ini menilai kelengkapan perkara, dan yang paling mudah keliru bukan
 * hitungannya melainkan APA YANG IKUT DIHITUNG. Ada tiga keadaan yang harus
 * tetap terpisah:
 *
 *   1. Dinilai        - datanya ada, nilainya 0..1, ikut membagi.
 *   2. Belum terisi   - datanya SEHARUSNYA ada tetapi kosong; bernilai nol
 *                       dan TETAP ikut membagi. Inilah kekurangan sungguhan.
 *   3. Belum waktunya - perkara belum diputus, sidang belum ada yang berlalu.
 *                       Tidak ikut membagi sama sekali.
 *
 * Sebelum ada keadaan ketiga, perkara yang baru didaftarkan - majelis lengkap,
 * panitera lengkap, pihak bernomor, tidak satu pun keliru - bernilai 45 dari
 * 100 dan berpredikat "kurang". Petugas diberi tahu ada yang salah pada
 * perkara yang justru dikerjakan dengan benar.
 *
 * Yang dijaga paling keras di bawah ini: keadaan 3 tidak boleh menelan
 * keadaan 2. Kelalaian sungguhan harus tetap menurunkan nilai.
 */

const rubrik = require("../services/penilaianPerkaraService");

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

/** Perkara yang baru didaftarkan dan sudah ditetapkan majelisnya. */
function perkaraBaru(ubah = {}) {
  return {
    hariBerjalan: 3,
    sudahPutus: false,
    majelis: [{ nama: "A" }, { nama: "B" }, { nama: "C" }],
    panitera: [{ nama: "PP" }],
    pihak: [{ adaNomor: true }, { adaNomor: true }],
    nomorPihakBermasalah: 0,
    panggilan: { jumlahPihak: 0, patut: 0 },
    sidangLewat: 0,
    basAda: 0,
    adaBerkasPutusan: false,
    adaBerkasAnonim: false,
    hariMinutasi: null,
    ...ubah,
  };
}

const butir = (hasil, kunci) => hasil.rinci.find((x) => x.kunci === kunci);

console.log("");
console.log("Uji rubrik ALETA - penilaian kelengkapan perkara");
console.log("");

// ---------------------------------------------------------------------------
console.log("  Perkara baru yang dikerjakan dengan benar");
{
  const hasil = rubrik.nilaiPerkara(perkaraBaru());

  // Inilah keluhan yang diperbaiki: dulu 45 dan "kurang".
  cek("bernilai penuh, bukan kurang", hasil.skor, 100);
  cek("predikatnya baik", hasil.keadaan, "baik");

  // Pembaginya hanya butir yang sudah menjadi kewajiban perkara ini.
  cek("pembagi hanya butir yang berlaku", hasil.totalBobot, 45);
  cek("bobot yang belum waktunya disebutkan", hasil.bobotBelumBerlaku, 55);

  cek("panggilan belum waktunya", butir(hasil, "panggilanPatut").belumBerlaku, true);
  cek("BAS belum waktunya", butir(hasil, "basDiunggah").belumBerlaku, true);
  cek("putusan belum waktunya", butir(hasil, "putusanDiunggah").belumBerlaku, true);
  cek("minutasi belum waktunya", butir(hasil, "minutasiTepat").belumBerlaku, true);

  cek("yang belum waktunya tidak dihitung", butir(hasil, "minutasiTepat").dihitung, false);
  cek("yang berlaku tetap dihitung", butir(hasil, "lamaPenyelesaian").dihitung, true);

  // Butir yang belum waktunya BUKAN butir yang datanya kosong. Dua hal yang
  // berbeda, dan membedakannya yang membuat nilai dapat dipercaya.
  cek("belum waktunya bukan belum terisi", butir(hasil, "putusanDiunggah").belumDinilai, false);

  // Seluruh butir tetap ditampilkan - yang tidak dihitung pun - supaya
  // terlihat bahwa ia memang belum dinilai, bukan diam-diam dihilangkan.
  cek("seluruh butir tetap ditampilkan", hasil.rinci.length, 7);
}

// ---------------------------------------------------------------------------
console.log("  Kelalaian sungguhan tetap menurunkan nilai");
{
  // Majelis belum ditetapkan pada perkara yang sudah berjalan: ini kekurangan,
  // bukan "belum waktunya".
  const tanpaMajelis = rubrik.nilaiPerkara(perkaraBaru({ majelis: [], panitera: [] }));
  cek("tanpa majelis nilainya turun", tanpaMajelis.skor < 100, true);
  cek("majelis tetap dihitung", butir(tanpaMajelis, "majelisDitetapkan").dihitung, true);

  // Pihak tanpa nomor yang dapat dipakai.
  const nomorKurang = rubrik.nilaiPerkara(perkaraBaru({ nomorPihakBermasalah: 1 }));
  cek("nomor pihak kurang menurunkan nilai", nomorKurang.skor < 100, true);
}

// ---------------------------------------------------------------------------
console.log("  Sesudah sidang berlalu, butirnya mulai berlaku");
{
  const adaSidang = rubrik.nilaiPerkara(
    perkaraBaru({
      sidangLewat: 2,
      basAda: 2,
      panggilan: { jumlahPihak: 2, patut: 2 },
    })
  );
  cek("BAS mulai dihitung", butir(adaSidang, "basDiunggah").dihitung, true);
  cek("panggilan mulai dihitung", butir(adaSidang, "panggilanPatut").dihitung, true);
  cek("pembaginya bertambah", adaSidang.totalBobot, 75);
  cek("semuanya beres tetap penuh", adaSidang.skor, 100);

  // BAS yang tidak ada SESUDAH sidang berlalu adalah kekurangan sungguhan.
  const basKurang = rubrik.nilaiPerkara(
    perkaraBaru({ sidangLewat: 2, basAda: 0, panggilan: { jumlahPihak: 2, patut: 2 } })
  );
  cek("BAS yang tertinggal menurunkan nilai", basKurang.skor < 100, true);
  cek("dan dihitung, bukan dilewati", butir(basKurang, "basDiunggah").dihitung, true);

  // Sidang sudah berlalu tetapi keadaan panggilannya tidak terbaca: para pihak
  // PASTI dipanggil, catatannya yang tidak ada - jadi ini kekurangan, bukan
  // "belum waktunya".
  const panggilanGelap = rubrik.nilaiPerkara(
    perkaraBaru({ sidangLewat: 1, basAda: 1, panggilan: { jumlahPihak: 0, patut: 0 } })
  );
  cek("panggilan tak terbaca dihitung nol", butir(panggilanGelap, "panggilanPatut").dihitung, true);
  cek("dan ditandai belum terisi", butir(panggilanGelap, "panggilanPatut").belumDinilai, true);
  cek("bukan belum waktunya", butir(panggilanGelap, "panggilanPatut").belumBerlaku, false);
}

// ---------------------------------------------------------------------------
console.log("  Sesudah diputus, putusan dan minutasi mulai berlaku");
{
  const putus = rubrik.nilaiPerkara(
    perkaraBaru({
      hariBerjalan: 80,
      sudahPutus: true,
      sidangLewat: 4,
      basAda: 4,
      panggilan: { jumlahPihak: 2, patut: 2 },
      adaBerkasPutusan: true,
      adaBerkasAnonim: true,
      hariMinutasi: 7,
    })
  );
  cek("seluruh butir berlaku", putus.totalBobot, 100);
  cek("tidak ada yang tersisa belum waktunya", putus.bobotBelumBerlaku, 0);
  cek("perkara yang beres bernilai penuh", putus.skor, 100);

  // Diputus tetapi naskahnya belum diunggah - kekurangan sungguhan.
  const tanpaNaskah = rubrik.nilaiPerkara(
    perkaraBaru({
      hariBerjalan: 80,
      sudahPutus: true,
      sidangLewat: 4,
      basAda: 4,
      panggilan: { jumlahPihak: 2, patut: 2 },
      adaBerkasPutusan: false,
      adaBerkasAnonim: false,
      hariMinutasi: 30,
    })
  );
  cek("naskah putusan tertinggal menurunkan nilai", tanpaNaskah.skor < 100, true);
  cek("putusan dihitung", butir(tanpaNaskah, "putusanDiunggah").dihitung, true);
  cek("minutasi lewat ambang bernilai nol", butir(tanpaNaskah, "minutasiTepat").bagian, 0);
}

// ---------------------------------------------------------------------------
console.log("  Tenggang minutasi yang masih berjalan bukan kelalaian");
{
  const dasar = {
    hariBerjalan: 80,
    sudahPutus: true,
    sidangLewat: 4,
    basAda: 4,
    panggilan: { jumlahPihak: 2, patut: 2 },
    adaBerkasPutusan: true,
    adaBerkasAnonim: true,
    hariMinutasi: null,
  };

  // Diputus kemarin, belum diminutasi. Ambang bawaan 14 hari - belum ada yang
  // dilanggar, dan dulu ini bernilai nol persis seperti yang terlambat dua
  // bulan. Perkara yang baru diputus karena itu selalu turun seketika.
  const masihBerjalan = rubrik.nilaiPerkara(perkaraBaru({ ...dasar, hariSejakPutus: 1 }));
  cek("tenggang berjalan: belum waktunya", butir(masihBerjalan, "minutasiTepat").belumBerlaku, true);
  cek("tidak ikut membagi", butir(masihBerjalan, "minutasiTepat").dihitung, false);
  cek("nilainya tetap penuh", masihBerjalan.skor, 100);

  // Tepat pada hari ambang masih dianggap dalam tenggang.
  const tepatAmbang = rubrik.nilaiPerkara(perkaraBaru({ ...dasar, hariSejakPutus: 14 }));
  cek("hari ke-14 masih dalam tenggang", butir(tepatAmbang, "minutasiTepat").belumBerlaku, true);

  // Lewat ambang tanpa minutasi: kelalaian sungguhan.
  const lewat = rubrik.nilaiPerkara(perkaraBaru({ ...dasar, hariSejakPutus: 30 }));
  cek("lewat ambang: dihitung", butir(lewat, "minutasiTepat").dihitung, true);
  cek("dan bernilai nol", butir(lewat, "minutasiTepat").bagian, 0);
  cek("nilainya turun", lewat.skor < 100, true);
  cek("sebabnya menyebut umurnya", /30 hari sejak putusan/.test(butir(lewat, "minutasiTepat").catatan), true);

  // Tanpa keterangan umur - bot lama - perilakunya seperti dulu: dinilai nol.
  const tanpaUmur = rubrik.nilaiPerkara(perkaraBaru({ ...dasar }));
  cek("tanpa keterangan umur tetap dihitung", butir(tanpaUmur, "minutasiTepat").dihitung, true);
}

// ---------------------------------------------------------------------------
console.log("  Umur yang dinilai sama dengan umur yang dibaca petugas");
{
  // Layar menampilkan HARI BERSIH beserta warnanya - hari pendaftaran ikut
  // dihitung, lama mediasi dipotong. Rubrik dulu menilai hari MENTAH, jadi
  // perkara bermediasi tampil hijau di layar tetapi kehilangan bobot diam-diam.
  const bermediasi = rubrik.nilaiPerkara(
    perkaraBaru({
      hariBerjalan: 120,
      hariBersih: 81, // 121 - 40 hari mediasi
      sidangLewat: 4,
      basAda: 4,
      panggilan: { jumlahPihak: 2, patut: 2 },
    })
  );
  cek("dinilai atas hari bersih, bukan hari mentah", butir(bermediasi, "lamaPenyelesaian").bagian, 1);
  cek(
    "potongan mediasinya disebutkan",
    /lama mediasi dipotong/.test(butir(bermediasi, "lamaPenyelesaian").catatan),
    true
  );

  // Tanpa hari bersih - pemanggil lama - hari mentah tetap dipakai.
  const tanpaBersih = rubrik.nilaiPerkara(perkaraBaru({ hariBerjalan: 120 }));
  cek("tanpa hari bersih memakai hari mentah", butir(tanpaBersih, "lamaPenyelesaian").bagian, 0.5);

  // Yang benar-benar lama tetap kehilangan bobot.
  const lama = rubrik.nilaiPerkara(perkaraBaru({ hariBerjalan: 200, hariBersih: 201 }));
  cek("perkara yang benar-benar lama bernilai nol", butir(lama, "lamaPenyelesaian").bagian, 0);
}

// ---------------------------------------------------------------------------
console.log("  Cabut dan gugur diperlakukan sebagai perkara yang sudah putus");
{
  // Dikonfirmasi dari SIPP yang berjalan: perkara cabut dan gugur TETAP
  // mengisi tanggal_putusan. Jadi keduanya sampai ke rubrik sebagai perkara
  // yang sudah putus - jam umurnya sudah berhenti di pemanggil, dan butir
  // putusan serta minutasinya memang sudah jatuh tempo.
  //
  // Yang dijaga di sini: tidak ada jalur ketiga yang menganggapnya "selesai
  // tetapi belum putus". Jalur semacam itu tidak akan pernah terpakai, dan
  // keberadaannya menyiratkan keadaan yang tidak ada di data.
  const dicabut = rubrik.nilaiPerkara(
    perkaraBaru({
      hariBerjalan: 20,
      hariBersih: 21,
      sudahPutus: true,
      sidangLewat: 1,
      basAda: 1,
      panggilan: { jumlahPihak: 2, patut: 2 },
      adaBerkasPutusan: true,
      adaBerkasAnonim: true,
      hariMinutasi: 3,
    })
  );
  cek("lama penyelesaian bernilai penuh", butir(dicabut, "lamaPenyelesaian").bagian, 1);
  cek("keterangannya menyebut sampai putusan", /sampai putusan/.test(butir(dicabut, "lamaPenyelesaian").catatan), true);
  cek("putusan ikut dinilai", butir(dicabut, "putusanDiunggah").dihitung, true);
  cek("minutasi ikut dinilai", butir(dicabut, "minutasiTepat").dihitung, true);
  cek("seluruh butir berlaku", dicabut.totalBobot, 100);
}

// ---------------------------------------------------------------------------
console.log("  Pembagi tidak pernah menghilangkan bobot tanpa keterangan");
{
  const hasil = rubrik.nilaiPerkara(perkaraBaru());
  const seluruhBobot = hasil.rinci.reduce((a, b) => a + b.bobot, 0);
  cek(
    "bobot yang dihitung dan yang belum waktunya berjumlah utuh",
    hasil.totalBobot + hasil.bobotBelumBerlaku,
    seluruhBobot
  );
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
