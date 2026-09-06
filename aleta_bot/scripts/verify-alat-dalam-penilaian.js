"use strict";

/**
 * ============================================================================
 * ALAT DI DALAM PENILAIAN - D07, D10, D17
 * ============================================================================
 *
 * Tiga alat yang menyentuh SETIAP angka pada aplikasi, dan karena itu
 * dikerjakan paling awal di antara kedua puluh alat: dipasang belakangan
 * berarti membongkar seluruh layar untuk menyisipkannya.
 *
 *   D10 cakupan data   - angka ini menggambarkan berapa bagian populasinya
 *   D17 rentang        - seberapa jauh angka ini dapat meleset
 *   D07 dampak         - berapa poin naik bila barisnya dibereskan
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

const C = require("../services/cakupanDataService");
const T = require("../services/ketelitianNilaiService");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) lulus += 1;
  else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const HARI_INI = "2026-09-06";

console.log("");
console.log("== D10 - cakupan data ==");
{
  // Ketiga angka yang menjadi alasan alat ini ada.
  const panggilan = C.cakupan(14420, 14453, HARI_INI);
  const pertimbangan = C.cakupan(2224, 9989, HARI_INI);
  const nafkah = C.cakupan(191, 9989, HARI_INI);

  periksa("ketaatan panggilan bercakupan 99,8 persen", panggilan.persen === 99.8, String(panggilan.persen));
  periksa("dan tingkatnya penuh", panggilan.tingkat === "penuh", panggilan.tingkat);
  periksa("dan tidak ditandai rendah", panggilan.rendah === false);

  periksa("mutu pertimbangan bercakupan 22,3 persen", pertimbangan.persen === 22.3, String(pertimbangan.persen));
  periksa("dan ditandai rendah", pertimbangan.rendah === true);
  periksa("dan kalimatnya menolak dibaca sebagai keadaan seluruhnya",
    /sebagian kecil saja/.test(pertimbangan.kalimat), pertimbangan.kalimat);

  periksa("amar nafkah bercakupan 1,9 persen", nafkah.persen === 1.9, String(nafkah.persen));
  periksa("dan ditandai rendah", nafkah.rendah === true);

  periksa("ambangnya diambil dari daftar ambang, bukan dipatok",
    panggilan.batasRendah === 40 && pertimbangan.batasRendah === 40);

  // Yang janggal tidak boleh dipotong menjadi seratus persen.
  const janggal = C.cakupan(120, 100, HARI_INI);
  periksa("terpakai melebihi semestinya dinyatakan janggal", janggal.tingkat === "janggal");
  periksa("dan persennya null, bukan seratus", janggal.persen === null);
  periksa("dan kalimatnya menyebut angkanya belum boleh dipakai",
    /belum boleh dipakai/.test(janggal.kalimat), janggal.kalimat);

  // Yang TIDAK DIKETAHUI tidak boleh terbaca sebagai NOL PERSEN. Keduanya
  // jauh berbeda: yang pertama berarti belum diukur, yang kedua berarti sudah
  // diukur dan tidak ada satu pun baris yang terisi - temuan berat.
  [null, undefined, "", false].forEach((kosong) => {
    const c = C.cakupan(kosong, 100, HARI_INI);
    periksa(`cakupan ${JSON.stringify(kosong)} dinyatakan tidak diketahui, bukan nol persen`,
      c.tingkat === "tidak diketahui" && c.persen === null, `dapat ${c.tingkat} ${c.persen}`);
  });
  const sungguhNol = C.cakupan(0, 100, HARI_INI);
  periksa("nol yang sungguhan tetap dihitung sebagai nol persen",
    sungguhNol.persen === 0 && sungguhNol.rendah === true, JSON.stringify(sungguhNol).slice(0, 90));
  periksa("penyebut nol tidak membagi dengan nol", C.cakupan(0, 0, HARI_INI).persen === null);
  [null, undefined, ""].forEach((kosong) => {
    periksa(`rentang keyakinan atas ${JSON.stringify(kosong)} memulangkan null`,
      T.selangWilson(kosong, 100) === null);
  });

  const banding = C.bandingkanCakupan([
    { kunci: "a", cakupan: panggilan },
    { kunci: "b", cakupan: pertimbangan },
    { kunci: "c", cakupan: nafkah },
  ]);
  periksa("perbandingan menghitung yang rendah", banding.rendah === 2 && banding.jumlah === 3);
  periksa("dan menemukan yang terendah", banding.terendah.kunci === "c");
  periksa("dan menyatakan ketiganya tidak sebanding", /tidak sebanding/.test(banding.kalimat));
}

console.log("== D17 - rentang keyakinan ==");
{
  const besar = T.selangWilson(14102, 14420);
  const kecil = T.selangWilson(20, 23);

  periksa("penyebut besar menghasilkan rentang sempit", besar.lebar < 0.5, String(besar.lebar));
  periksa("penyebut kecil menghasilkan rentang lebar", kecil.lebar > 5, String(kecil.lebar));
  periksa("nilai ketaatan panggilan 97,8", besar.nilai === 97.8, String(besar.nilai));

  // Inilah sebab selang Wilson dipilih. Selang normal biasa akan melar ke atas
  // seratus pada nilai yang mendekati ujung - dan penilaian ketaatan hampir
  // selalu mendekati ujung.
  const hampirSempurna = T.selangWilson(99, 100);
  periksa("selang tidak pernah melewati seratus", hampirSempurna.atas <= 100, String(hampirSempurna.atas));
  const nolSempurna = T.selangWilson(0, 40);
  periksa("selang tidak pernah kurang dari nol", nolSempurna.bawah >= 0, String(nolSempurna.bawah));
  const sempurna = T.selangWilson(40, 40);
  periksa("seratus persen tetap punya rentang, tidak dianggap pasti", sempurna.bawah < 100, String(sempurna.bawah));

  periksa("angka tidak sah memulangkan null", T.selangWilson(5, 0) === null);
  periksa("terpenuhi melebihi penyebut memulangkan null", T.selangWilson(41, 40) === null);

  // Selisih yang berarti dan yang kebetulan.
  const nyata = T.selisihBerarti({ terpenuhi: 9000, penyebut: 10000 }, { terpenuhi: 8800, penyebut: 10000 });
  periksa("selisih dua poin pada penyebut sepuluh ribu berarti", nyata.berarti === true, JSON.stringify(nyata).slice(0, 120));

  const kebetulan = T.selisihBerarti({ terpenuhi: 20, penyebut: 23 }, { terpenuhi: 19, penyebut: 23 });
  periksa("selisih serupa pada penyebut dua puluh tiga tidak berarti", kebetulan.berarti === false);
  periksa(
    "dan kalimatnya membedakan 'belum cukup untuk mengatakan berbeda' dari 'sama'",
    /tidak sama dengan mengatakan keduanya sama/.test(kebetulan.sebab),
    kebetulan.sebab
  );
}

console.log("== D07 - dampak bila dibereskan ==");
{
  periksa("satu baris dari seratus menaikkan satu poin", T.dampakSatuBaris(90, 100) === 1);
  periksa("satu baris dari seribu menaikkan sepersepuluh poin", T.dampakSatuBaris(900, 1000) === 0.1);
  periksa("yang sudah seratus persen tidak dapat naik lagi", T.dampakSatuBaris(100, 100) === 0);
  periksa("seluruhnya dibereskan menaikkan sampai seratus", T.dampakSeluruhnya(90, 100) === 10);
  periksa("yang sudah sempurna berdampak nol", T.dampakSeluruhnya(100, 100) === 0);
  periksa("penyebut nol tidak membagi dengan nol", T.dampakSeluruhnya(0, 0) === 0);

  const urutan = T.urutanPengerjaan([
    { kunci: "anonimisasi", judul: "Naskah anonimisasi", terpenuhi: 9867, penyebut: 9989 },
    { kunci: "relaas", judul: "Relaas bertenggang cukup", terpenuhi: 14102, penyebut: 14420 },
    { kunci: "amar", judul: "Berkas amar putusan", terpenuhi: 9899, penyebut: 9989 },
  ]);
  periksa("tiga baris tersusun", urutan.baris.length === 3);
  periksa(
    "terurut menurut dampak terbesar",
    urutan.baris.every((b, i) => i === 0 || urutan.baris[i - 1].dampakSeluruhnya >= b.dampakSeluruhnya),
    urutan.baris.map((b) => `${b.kunci}:${b.dampakSeluruhnya}`).join(" ")
  );
  periksa("belum memenuhi dihitung benar", urutan.baris.find((b) => b.kunci === "anonimisasi").belumMemenuhi === 122);
  periksa("kolom usaha dibiarkan kosong", urutan.baris.every((b) => b.usaha === null));
  periksa(
    "dan catatannya menerangkan mengapa usaha tidak dihitung mesin",
    /mesin tidak tahu/.test(urutan.catatan),
    urutan.catatan.slice(0, 80)
  );
  periksa("baris yang penyebutnya nol dibuang, tidak menghasilkan pembagian nol",
    T.urutanPengerjaan([{ kunci: "x", terpenuhi: 0, penyebut: 0 }]).baris.length === 0);
}

console.log("== Cakupan dan rentang adalah dua hal yang berbeda ==");
{
  // Penilaian dapat bercakupan RENDAH tetapi berpenyebut BESAR - dan
  // sebaliknya. Mencampur keduanya adalah kekeliruan yang sering terjadi.
  const cakupanRendahPenyebutBesar = {
    cakupan: C.cakupan(2224, 9989, HARI_INI),
    rentang: T.selangWilson(2000, 2224),
  };
  periksa("cakupannya rendah", cakupanRendahPenyebutBesar.cakupan.rendah === true);
  periksa("tetapi rentangnya sempit", cakupanRendahPenyebutBesar.rentang.lebar < 2,
    String(cakupanRendahPenyebutBesar.rentang.lebar));

  const cakupanPenuhPenyebutKecil = {
    cakupan: C.cakupan(23, 23, HARI_INI),
    rentang: T.selangWilson(20, 23),
  };
  periksa("cakupannya penuh", cakupanPenuhPenyebutKecil.cakupan.persen === 100);
  periksa("tetapi rentangnya lebar", cakupanPenuhPenyebutKecil.rentang.lebar > 5);
}

console.log("== Hitung dua kali ==");
{
  const a = JSON.stringify([C.cakupan(2224, 9989, HARI_INI), T.selangWilson(2000, 2224), T.dampakSeluruhnya(90, 100)]);
  const b = JSON.stringify([C.cakupan(2224, 9989, HARI_INI), T.selangWilson(2000, 2224), T.dampakSeluruhnya(90, 100)]);
  periksa("ketiganya sama persis pada hitungan kedua", a === b);
}

console.log("");
console.log("Cakupan tiga penilaian yang menjadi alasan alat ini ada:");
[
  ["Ketaatan tenggang panggilan", 14420, 14453],
  ["Mutu pertimbangan hukum", 2224, 9989],
  ["Amar nafkah", 191, 9989],
].forEach(([nama, a, b]) => {
  const c = C.cakupan(a, b, HARI_INI);
  console.log(`  ${nama.padEnd(30)} ${String(c.persen).padStart(6)}%  ${c.sebutan}${c.rendah ? "  <- ditandai" : ""}`);
});

console.log("");
console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal > 0 ? 1 : 0);
