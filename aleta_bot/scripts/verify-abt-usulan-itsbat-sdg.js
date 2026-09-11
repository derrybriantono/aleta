"use strict";

/**
 * Memeriksa dua penyusun baru di abtUsulanService:
 *
 *   dariPositaItsbat        - fakta pernikahan dari posita permohonan itsbat
 *   susunKeteranganSaksiSdg - keterangan dua saksi dari satu templat ABT,
 *                             substansi sama, kalimat berbeda
 *
 * Positanya diambil dari perkara itsbat sungguhan di SIPP PA Bungku
 * (2/Pdt.P/2024/PA.Buk), disamarkan seperlunya. Tidak ada satu pun nilai
 * yang boleh "ditebak": fakta yang tidak ada di posita harus pulang kosong.
 *
 *   node scripts/verify-abt-usulan-itsbat-sdg.js
 */

const A = require("../services/abtUsulanService");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) lulus += 1;
  else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const POSITA_DUA_PEMOHON =
  "<ol><li>Bahwa pada tanggal 07 Mei 2017 telah terjadi pernikahan menurut Agama Islam antara " +
  "Pemohon I dan Pemohon II yang dilangsungkan di wilayah Kecamatan Bungku Barat dan sampai saat " +
  "ini Pemohon I dan Pemohon II masih berstatus suami istri;</li>" +
  "<li>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Jejaka dalam usia 19 (sembilan belas) " +
  "tahun, dan Pemohon II berstatus Perawan dalam usia 20 (dua puluh) tahun. Pernikahan dilangsungkan " +
  "dengan wali nikah saudara kandung Pemohon II bernama NASRUDDIN dan yang menikahkan adalah Imam " +
  "Masjid bernama KASWARI serta dihadiri 2 (dua) orang saksi masing-masing bernama MILLO dan MALIWAN " +
  "dengan mahar berupa uang sejumlah Rp166,000 (seratus enam puluh enam ribu rupiah), emas seberat 1 " +
  "gram dan seperangkat alat sholat yang diberikan secara tunai oleh Pemohon I kepada Pemohon II;</li>" +
  "<li>Bahwa setelah pernikahan tersebut Pemohon I dan Pemohon II hidup rukun dan telah dikaruniai " +
  "2 (dua) orang anak bernama: RISNA;</li></ol>";

console.log("");
console.log("== dariPositaItsbat: dua pemohon ==");
const dua = A.dariPositaItsbat(POSITA_DUA_PEMOHON, {});
const nilai = (kode) => (dua.usulan.find((u) => u.kode === kode) || {}).nilai || "";
periksa("empat belas variabel diusulkan", dua.usulan.length === 14, `dapat ${dua.usulan.length}`);
periksa("seluruhnya terbaca dari posita ini", dua.ditemukan === 14, `dapat ${dua.ditemukan}`);
periksa("5197 tanggal nikah", nilai("5197") === "07 Mei 2017", nilai("5197"));
periksa("5105 tempat menikah berhenti pada kata sambung", nilai("5105") === "Kecamatan Bungku Barat", nilai("5105"));
periksa("5178 kecamatan KUA", nilai("5178") === "Bungku Barat", nilai("5178"));
periksa("1217 wali nikah", nilai("1217") === "NASRUDDIN", nilai("1217"));
periksa("1046 status wali", nilai("1046") === "saudara kandung", nilai("1046"));
periksa("8087 yang menikahkan beserta jabatannya", nilai("8087") === "Imam Masjid bernama KASWARI", nilai("8087"));
periksa("0650 saksi nikah 1", nilai("0650") === "MILLO", nilai("0650"));
periksa("0651 saksi nikah 2", nilai("0651") === "MALIWAN", nilai("0651"));
periksa("1001 mahar utuh", /^uang sejumlah Rp166,000 .* seperangkat alat sholat$/.test(nilai("1001")), nilai("1001"));
periksa("1002/1003 status", nilai("1002") === "Jejaka" && nilai("1003") === "Perawan");
periksa("7211/7212 umur", nilai("7211") === "19 tahun" && nilai("7212") === "20 tahun");
periksa("0007 anak", nilai("0007") === "telah dikaruniai 2 orang anak", nilai("0007"));
periksa("tiap usulan membawa kalimat asalnya", dua.usulan.every((u) => !u.nilai || (u.sumber[0] && u.sumber[0].asal === "posita")));

console.log("");
console.log("== dariPositaItsbat: satu pemohon, pasangan sudah wafat ==");
const satu = A.dariPositaItsbat(
  "Bahwa pada tanggal 3 Maret 2001 Pemohon menikah dengan almarhum suaminya di rumah orang tua Pemohon " +
    "di Desa Lalampu, dan pada saat itu Pemohon berstatus Perawan dalam usia 22 tahun; Bahwa wali " +
    "nikahnya adalah ayah kandung Pemohon bernama LA ODE HASAN dan yang menikahkan adalah Penghulu KUA " +
    "bernama H. AMIR; Bahwa mereka belum dikaruniai anak;",
  {}
);
const n1 = (kode) => (satu.usulan.find((u) => u.kode === kode) || {}).nilai || "";
periksa("tanggal", n1("5197") === "3 Maret 2001", n1("5197"));
periksa("tempat", n1("5105") === "rumah orang tua Pemohon di Desa Lalampu", n1("5105"));
periksa("wali dengan gelar", n1("1217") === "LA ODE HASAN", n1("1217"));
periksa("status wali", n1("1046") === "ayah kandung", n1("1046"));
periksa("yang menikahkan dengan singkatan H.", n1("8087") === "Penghulu KUA bernama H. AMIR", n1("8087"));
periksa("status Pemohon tanpa angka romawi", n1("1002") === "Perawan" && n1("7211") === "22 tahun");
periksa("belum ada anak", n1("0007") === "belum dikaruniai anak", n1("0007"));
periksa("yang tidak ada di posita pulang KOSONG, bukan ditebak", n1("5178") === "" && n1("0650") === "" && n1("1001") === "" && n1("1003") === "");
periksa("yang kosong menyebut sebabnya", satu.usulan.filter((u) => !u.nilai).every((u) => u.keyakinan === "kosong" && u.catatan));

console.log("");
console.log("== dariPositaItsbat: bukan posita itsbat ==");
const bukan = A.dariPositaItsbat("Bahwa Penggugat dan Tergugat sering bertengkar karena Tergugat tidak memberi nafkah;", {});
periksa("tidak satu pun terbaca", bukan.ditemukan === 0, `dapat ${bukan.ditemukan}`);
periksa("catatannya mengatakan itu", /bukan permohonan itsbat/.test(bukan.catatan));

console.log("");
console.log("== susunKeteranganSaksiSdg ==");
const templat = [
  { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Ya, saya kenal dengan Penggugat dan Tergugat karena saya adalah tetangga Penggugat;" },
  { no: "7", tanya: "Apakah saksi tahu penyebab perselisihan mereka?", jawab: "Ya, penyebab mereka berselisih yaitu ...........;" },
  { no: "9", tanya: "Sejak kapan mereka pisah rumah?", jawab: "Mereka sudah pisah rumah kurang lebih 4 bulan sampai sekarang;" },
  { no: "12", tanya: "Apakah saksi pernah melihat?", jawab: "Saya (melihat/mendengar) sendiri;" },
  { no: "17", tanya: "Apakah masih ada keterangan lain?", jawab: "Sudah cukup;" },
];
const sdg = A.susunKeteranganSaksiSdg({
  templat,
  posita: "Bahwa sejak 2023 rumah tangga sering terjadi perselisihan dan pertengkaran karena Tergugat tidak memberi nafkah dan sering mabuk;",
});
periksa("tersusun", sdg.ok === true);
periksa("alasan dibaca dari posita", sdg.asalAlasan === "posita" && sdg.alasan.join("|") === "perselisihan terus-menerus|tidak memberi nafkah|mabuk", sdg.alasan.join("|"));
periksa("jumlah baris sama dengan templat", sdg.saksi1.length === 5 && sdg.saksi2.length === 5);
periksa("tidak ada jawaban yang identik kata demi kata", sdg.identik === 0, `identik ${sdg.identik}`);
periksa("jawaban penyebab memuat alasan yang didalilkan saja", /tidak memberi nafkah/.test(sdg.saksi1[1].jawab) && /mabuk/.test(sdg.saksi2[1].jawab) && !/\.{3}/.test(sdg.saksi1[1].jawab));
periksa("kalimat penutup tidak diberi pembuka", sdg.saksi1[4].jawab === "Sudah cukup;" && sdg.saksi2[4].jawab === "Sudah cukup;");
periksa("titik-titik templat ditandai perlu diisi", sdg.perluDiisi.length === 1 && sdg.perluDiisi[0].no === "12", JSON.stringify(sdg.perluDiisi));
periksa("substansi lama pisah tetap 4 bulan pada keduanya", /4 bulan/.test(sdg.saksi1[2].jawab) && /4 bulan/.test(sdg.saksi2[2].jawab));
periksa("tiap jawaban berakhir titik koma", [...sdg.saksi1, ...sdg.saksi2].every((b) => /;$/.test(b.jawab)));

const dipilih = A.susunKeteranganSaksiSdg({ templat, alasan: ["judi"] });
periksa("alasan yang dipilih mengalahkan posita", dipilih.asalAlasan === "dipilih" && /judi/.test(dipilih.saksi1[1].jawab) && !/nafkah/.test(dipilih.saksi1[1].jawab));

const kosong = A.susunKeteranganSaksiSdg({ templat: [] });
periksa("templat kosong ditolak terang-terangan", kosong.ok === false && kosong.alasan === "templat_kosong");

const alasanKosong = A.alasanDariPosita("Bahwa Pemohon mohon dikabulkan;");
periksa("posita tanpa alasan tidak melahirkan alasan", alasanKosong.length === 0);

console.log("");
console.log(`${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
