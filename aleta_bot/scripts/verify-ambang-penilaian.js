"use strict";

/**
 * ============================================================================
 * AMBANG PENILAIAN - BERTANGGAL, BERDASAR, DAN TIDAK BERUBAH KE BELAKANG
 * ============================================================================
 *
 * Yang paling dijaga di sini bukan angkanya, melainkan sifat ini:
 *
 *   MENGUBAH AMBANG HARI INI TIDAK BOLEH MENGGESER NILAI PERIODE LAMPAU.
 *
 * Laporan bulan lalu yang sudah ditandatangani harus tetap dapat direproduksi.
 * Bila tidak, tidak ada gunanya menyimpan riwayat nilai sama sekali - dan
 * pengawasan kehilangan satu-satunya cara membuktikan bahwa angkanya tidak
 * disesuaikan belakangan.
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

const A = require("../services/ambangPenilaianService");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) lulus += 1;
  else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

console.log("");
console.log("== Bentuk daftar ==");
const daftar = A.daftarAmbang();
periksa("daftar ambang tidak kosong", daftar.length >= 10, `dapat ${daftar.length}`);
periksa("setiap ambang punya label, satuan, sifat, dan keterangan",
  daftar.every((x) => x.label && x.satuan && x.sifat && x.keterangan));
periksa("sifatnya hanya peraturan atau kebijakan",
  daftar.every((x) => ["peraturan", "kebijakan"].includes(x.sifat)),
  daftar.filter((x) => !["peraturan", "kebijakan"].includes(x.sifat)).map((x) => x.kunci).join(","));
periksa("setiap ambang punya riwayat yang tidak kosong", daftar.every((x) => x.riwayat.length > 0));
periksa("setiap baris riwayat punya tanggal mulai, nilai, dan dasar",
  daftar.every((x) => x.riwayat.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.mulai) && r.nilai !== undefined && r.dasar)));
periksa("riwayat terurut dari yang paling lama",
  daftar.every((x) => x.riwayat.every((r, i) => i === 0 || x.riwayat[i - 1].mulai <= r.mulai)));
periksa("ambang berdasar peraturan menyebut peraturannya, bukan kebijakan",
  daftar.filter((x) => x.sifat === "peraturan").every((x) =>
    x.riwayat.every((r) => /(Pasal|SEMA|PERMA|SK |UU |Petunjuk)/i.test(r.dasar))),
  daftar.filter((x) => x.sifat === "peraturan")
    .filter((x) => !x.riwayat.every((r) => /(Pasal|SEMA|PERMA|SK |UU |Petunjuk)/i.test(r.dasar)))
    .map((x) => x.kunci).join(","));
periksa("ambang kebijakan menyebut pengadilannya",
  daftar.filter((x) => x.sifat === "kebijakan").every((x) =>
    x.riwayat.every((r) => /Kebijakan Pengadilan/i.test(r.dasar))));
console.log(`        ${daftar.length} ambang: ${daftar.filter((x) => x.sifat === "peraturan").length} berdasar peraturan, ${daftar.filter((x) => x.sifat === "kebijakan").length} kebijakan pengadilan`);

console.log("== Ambang yang berlaku pada sebuah tanggal ==");
{
  const a = A.ambangBerlaku("tenggangPanggilan", "2026-09-06");
  periksa("tenggang panggilan tiga hari kerja", a.nilai === 3, JSON.stringify(a));
  periksa("dan menyebut Pasal 122 HIR", /Pasal 122 HIR/.test(a.dasar), a.dasar);

  const m = A.ambangBerlaku("minutasiBerkas", "2026-09-06");
  periksa("minutasi empat belas hari", m.nilai === 14);
  periksa("dan menyebut SK Dirjen Badilag", /SK Dirjen Badilag/.test(m.dasar), m.dasar);

  // Sebelum SK-nya lahir, ambangnya memang belum ada.
  const sebelum = A.ambangBerlaku("minutasiBerkas", "2023-12-31");
  periksa("sebelum SK berlaku, ambangnya null - bukan empat belas", sebelum.nilai === null, JSON.stringify(sebelum));
  periksa("dan sebabnya menyebut tanggal berlaku paling awal", /2024-01-01/.test(sebelum.sebab), sebelum.sebab);

  const tepat = A.ambangBerlaku("minutasiBerkas", "2024-01-01");
  periksa("pada hari pertama berlakunya, ambangnya sudah ada", tepat.nilai === 14);

  periksa("ambang yang tidak dikenali ditolak", (() => {
    try { A.ambangBerlaku("tidakAda", "2026-09-06"); return false; } catch (_) { return true; }
  })());
  periksa("nama warisan Object tidak menembus daftar ambang",
    ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"].every((k) => {
      try { A.ambangBerlaku(k, "2026-09-06"); return false; } catch (_) { return true; }
    }));
  periksa("tanggal berbentuk salah ditolak", (() => {
    try { A.ambangBerlaku("tenggangPanggilan", "6 September 2026"); return false; } catch (_) { return true; }
  })());
}

console.log("== Mengubah ambang tidak menggeser nilai lampau ==");
{
  // Inilah sifat yang paling menentukan. Diuji dengan menambahkan riwayat baru
  // pada salinan, lalu memastikan tanggal lampau tetap menjawab yang lama.
  const asli = A.AMBANG.pembatasPenyebut.riwayat.slice();
  A.AMBANG.pembatasPenyebut.riwayat.push({
    mulai: "2027-01-01",
    nilai: 30,
    dasar: "Kebijakan Pengadilan Agama Donggala",
  });

  const lampau = A.ambangBerlaku("pembatasPenyebut", "2026-10-01");
  const kelak = A.ambangBerlaku("pembatasPenyebut", "2027-06-01");
  periksa("periode lampau tetap memakai ambang lama", lampau.nilai === 20, JSON.stringify(lampau));
  periksa("periode sesudah perubahan memakai ambang baru", kelak.nilai === 30, JSON.stringify(kelak));
  periksa("tanggal mulai berlakunya ikut terbawa", kelak.mulai === "2027-01-01");

  // Sidiknya harus BERBEDA antara kedua masa - itulah cara MS03 mengetahui
  // bahwa nilai lama dihitung dengan aturan yang berbeda.
  periksa("sidik ambang berbeda antara kedua masa",
    A.sidikAmbang("2026-10-01") !== A.sidikAmbang("2027-06-01"));

  A.AMBANG.pembatasPenyebut.riwayat.length = 0;
  asli.forEach((r) => A.AMBANG.pembatasPenyebut.riwayat.push(r));
  periksa("keadaan dikembalikan sesudah uji", A.ambangBerlaku("pembatasPenyebut", "2027-06-01").nilai === 20);
}

console.log("== Kumpulan dan sidik ambang ==");
{
  const k = A.kumpulanAmbang("2026-09-06");
  periksa("kumpulan memuat seluruh ambang", Object.keys(k).length === daftar.length);
  periksa("kumpulan memuat pembatas penyebut dua puluh", k.pembatasPenyebut === 20);

  const s1 = A.sidikAmbang("2026-09-06");
  const s2 = A.sidikAmbang("2026-09-06");
  periksa("sidik sama pada pemanggilan kedua", s1 === s2);
  periksa("sidik memuat seluruh kunci", daftar.every((d) => s1.includes(d.kunci + "=")));
  // Sifat yang sebenarnya dimaksud: sidiknya tidak berubah bila urutan
  // penulisan ambang di dalam berkas kelak diubah. Itu dijamin dengan
  // mengurutkan kuncinya, bukan dengan kunci tertentu berada di depan.
  periksa(
    "kunci pada sidik terurut menurut abjad",
    (() => {
      const kunci = s1.split(";").map((x) => x.split("=")[0]);
      return kunci.every((k, i) => i === 0 || kunci[i - 1].localeCompare(k) <= 0);
    })(),
    s1.slice(0, 80)
  );

  // Sebelum sebagian besar aturan lahir, sidiknya memang berbeda.
  periksa("sidik pada 2010 berbeda dengan sidik hari ini", A.sidikAmbang("2010-01-01") !== s1);
}

console.log("== Hitung dua kali ==");
{
  const a = JSON.stringify(A.daftarAmbang());
  const b = JSON.stringify(A.daftarAmbang());
  periksa("daftar ambang sama persis pada pemanggilan kedua", a === b);
  periksa("daftar yang dipulangkan salinan, bukan yang asli", (() => {
    const d = A.daftarAmbang();
    d[0].riwayat[0].nilai = 999;
    return A.daftarAmbang()[0].riwayat[0].nilai !== 999;
  })());
}

console.log("");
console.log("Ambang yang berlaku hari ini:");
daftar.forEach((d) => {
  const a = A.ambangBerlaku(d.kunci, "2026-09-06");
  console.log(`  ${d.kunci.padEnd(22)} ${String(a.nilai).padStart(4)} ${d.satuan.padEnd(16)} ${d.sifat.padEnd(10)} ${a.dasar}`);
});

console.log("");
console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal > 0 ? 1 : 0);
