"use strict";

/**
 * ============================================================================
 * D15 SASARAN KINERJA, D06 KETERGANTUNGAN ANTAR PENILAIAN
 * ============================================================================
 *
 * Dua alat yang sama-sama menolak angka tampil lebih meyakinkan daripada
 * seharusnya:
 *
 *   D15 - nilai 86 itu baik atau buruk? Tidak dapat dijawab tanpa sasaran, dan
 *         sasaran tanpa dokumen dasarnya adalah angka karangan.
 *   D06 - nilai hilir tidak boleh tampak lebih meyakinkan daripada hulunya.
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

const S = require("../services/sasaranKinerjaService");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) lulus += 1;
  else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

function melempar(fn) {
  try {
    fn();
    return false;
  } catch (_) {
    return true;
  }
}

console.log("");
console.log("== D15 - sasaran wajib bersumber ==");
S.lupakanSasaran();
{
  periksa("sasaran tanpa sumber ditolak", melempar(() => S.tetapkanSasaran("ketaatanPanggilan", "2026", 98, "")));
  periksa("sumber terlalu pendek ditolak", melempar(() => S.tetapkanSasaran("ketaatanPanggilan", "2026", 98, "PK")));
  periksa("tahun bukan empat angka ditolak", melempar(() => S.tetapkanSasaran("ketaatanPanggilan", "26", 98, "Perjanjian Kinerja 2026")));
  periksa("sasaran nol ditolak", melempar(() => S.tetapkanSasaran("ketaatanPanggilan", "2026", 0, "Perjanjian Kinerja 2026")));
  periksa("sasaran lebih dari seratus ditolak", melempar(() => S.tetapkanSasaran("ketaatanPanggilan", "2026", 101, "Perjanjian Kinerja 2026")));
  periksa("penilaian kosong ditolak", melempar(() => S.tetapkanSasaran("", "2026", 98, "Perjanjian Kinerja 2026")));

  const sah = S.tetapkanSasaran("ketaatanPanggilan", "2026", 98, "Perjanjian Kinerja 2026 - ketaatan panggilan");
  periksa("sasaran yang lengkap diterima", sah.nilai === 98);
}

console.log("== D15 - sasaran bertahun ==");
{
  S.tetapkanSasaran("ketaatanPanggilan", "2025", 95, "Perjanjian Kinerja 2025 - ketaatan panggilan");
  periksa("sasaran 2026 sembilan puluh delapan", S.sasaranBerlaku("ketaatanPanggilan", "2026").nilai === 98);
  // Sasaran tahun ini tidak boleh dipakai menilai tahun lalu.
  periksa("sasaran 2025 sembilan puluh lima", S.sasaranBerlaku("ketaatanPanggilan", "2025").nilai === 95);
  const belum = S.sasaranBerlaku("ketaatanPanggilan", "2024");
  periksa("tahun yang belum ditetapkan menjawab belum ada", belum.ada === false && belum.nilai === null);
  periksa("dan sebabnya menyebut tahunnya", /tahun 2024/.test(belum.sebab), belum.sebab);

  const tanpa = S.sasaranBerlaku("penilaianLain", "2026");
  periksa("penilaian tanpa sasaran menjawab belum ada", tanpa.ada === false);
  periksa("nama warisan Object tidak menembus daftar sasaran",
    ["constructor", "toString", "__proto__", "hasOwnProperty"].every((k) => S.sasaranBerlaku(k, "2026").ada === false));
}

console.log("== D15 - membandingkan capaian dengan sasarannya ==");
{
  const tercapai = S.terhadapSasaran(99.1, "ketaatanPanggilan", "2026");
  periksa("capaian di atas sasaran dinyatakan tercapai", tercapai.keadaan === "tercapai");
  periksa("selisihnya positif", tercapai.selisih > 0, String(tercapai.selisih));

  const kurang = S.terhadapSasaran(97.8, "ketaatanPanggilan", "2026");
  periksa("capaian di bawah sasaran dinyatakan belum tercapai", kurang.keadaan === "belum tercapai");
  periksa("selisihnya minus nol koma dua", kurang.selisih === -0.2, String(kurang.selisih));
  periksa("sumbernya ikut terbawa", /Perjanjian Kinerja/.test(kurang.sumber));

  // Yang paling penting: nilai yang belum dapat dihitung TIDAK dinyatakan
  // belum tercapai. Menuduh tanpa mengukur adalah kesalahan yang paling mahal
  // pada aplikasi yang menyebut nama orang.
  const belumCukup = S.terhadapSasaran(null, "ketaatanPanggilan", "2026");
  periksa("nilai null tidak dinyatakan belum tercapai", belumCukup.keadaan === "belum dapat dinilai");
  periksa("dan sebabnya menyebut penyebutnya", /penyebutnya belum cukup/.test(belumCukup.sebab), belumCukup.sebab);

  const tanpaSasaran = S.terhadapSasaran(86, "penilaianLain", "2026");
  periksa("penilaian tanpa sasaran dinyatakan tanpa sasaran", tanpaSasaran.keadaan === "tanpa sasaran");
  periksa("dan capaiannya tetap terbawa", tanpaSasaran.capaian === 86);
}

console.log("== D15 - daftarnya kosong sampai Perjanjian Kinerja dibaca ==");
{
  S.lupakanSasaran();
  periksa("tanpa penetapan, tidak ada sasaran", S.sasaranBerlaku("ketaatanPanggilan", "2026").ada === false);
  periksa(
    "dan layar harus mengatakan belum ditetapkan, bukan memakai seratus",
    S.terhadapSasaran(86, "ketaatanPanggilan", "2026").keadaan === "tanpa sasaran"
  );
}

console.log("== D06 - ketergantungan ==");
S.lupakanKetergantungan();
{
  periksa("keadaan hulu asing ditolak", melempar(() => S.tetapkanHulu("waktuInput", "agakBersih", "x")));
  periksa("hulu tanpa keterangan ditolak", melempar(() => S.tetapkanHulu("waktuInput", "belumBersih", "")));
  periksa(
    "menggantungkan pada hulu yang belum ada ditolak",
    melempar(() => S.gantungkan("ketaatanMinutasi", ["huluKarangan"]))
  );

  S.tetapkanHulu(
    "waktuInput",
    "belumBersih",
    "tanggal penginputan yang belum ditelaah - 7.062 suntingan sesudah minutasi belum diperiksa."
  );
  S.tetapkanHulu("kelengkapanRuas", "bersih", "ruas wajib perkara terisi 97,8 persen.");
  S.tetapkanHulu("kodeWilayah", "tidakAda", "tabel acuan kode wilayah belum dipetakan.");

  S.gantungkan("ketaatanMinutasi", ["waktuInput"]);
  S.gantungkan("kelengkapanBerkas", ["kelengkapanRuas"]);
  S.gantungkan("sebaranWilayah", ["kodeWilayah", "kelengkapanRuas"]);
  S.gantungkan("nilaiKondisiPerkara", ["waktuInput", "kelengkapanRuas"]);

  const minutasi = S.keadaanMenurutHulu("ketaatanMinutasi");
  periksa("penilaian yang hulunya keruh perlu lencana", minutasi.perluLencana === true);
  periksa("dan kalimatnya menyebut sebabnya", /7\.062 suntingan/.test(minutasi.kalimat), minutasi.kalimat);

  const berkas = S.keadaanMenurutHulu("kelengkapanBerkas");
  periksa("penilaian yang hulunya bersih tidak perlu lencana", berkas.perluLencana === false);
  periksa("dan kalimatnya kosong", berkas.kalimat === "");

  // Yang dipulangkan keadaan hulu TERBURUK, bukan rata-ratanya.
  const wilayah = S.keadaanMenurutHulu("sebaranWilayah");
  periksa("hulu terburuk yang menentukan", wilayah.keadaan === "tidakAda", wilayah.keadaan);
  periksa("walau salah satu hulunya bersih", wilayah.hulu.some((h) => h.keadaan === "bersih"));

  const kondisi = S.keadaanMenurutHulu("nilaiKondisiPerkara");
  periksa("dua hulu, yang keruh yang menentukan", kondisi.keadaan === "belumBersih");

  const mandiri = S.keadaanMenurutHulu("penilaianMandiri");
  periksa("penilaian tanpa ketergantungan dinyatakan bersih", mandiri.bergantung === false && mandiri.keadaan === "bersih");
}

console.log("== Hitung dua kali ==");
{
  const a = JSON.stringify(S.keadaanMenurutHulu("sebaranWilayah"));
  const b = JSON.stringify(S.keadaanMenurutHulu("sebaranWilayah"));
  periksa("keadaan hulu sama persis pada pemanggilan kedua", a === b);
}

console.log("");
console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal > 0 ? 1 : 0);
