"use strict";

/**
 * ============================================================================
 * MS01 - MESIN PERIODE TUJUH JENDELA
 * ============================================================================
 *
 * Yang dijaga di sini empat hal, dan ketiganya yang pertama sudah pernah salah
 * pada prototipe:
 *
 *   1. NAMA BARIS SELALU BERTANGGAL. Memilih "Mingguan" tetapi yang tampil
 *      nama bulan adalah cacat yang berulang. Di sini diperiksa untuk ketujuh
 *      jendela sekaligus, bukan untuk yang kebetulan diingat.
 *
 *   2. BATAS TANGGALNYA BENAR. Akhir Februari pada tahun kabisat, pekan yang
 *      melintasi pergantian bulan, triwulan yang melintasi pergantian tahun -
 *      ketiganya gagal diam-diam bila aritmetikanya memakai penambahan tiga
 *      puluh hari.
 *
 *   3. TIDAK BERGANTUNG ZONA MESIN. Pengadilan berada di WITA; mesin
 *      pengembang tidak. Hasil yang berpindah hari pukul empat sore tidak
 *      menimbulkan galat, hanya angka yang salah.
 *
 *   4. NILAI TIDAK KELUAR PADA PENYEBUT KECIL, dan yang keluar `null` - bukan
 *      nol. Nol terbaca "buruk sekali"; null terbaca "belum dapat dinilai".
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

const P = require("../services/periodePenilaianService");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) {
    lulus += 1;
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

function sama(nama, dapat, harap) {
  periksa(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, seharusnya ${JSON.stringify(harap)}`);
}

/** Nama bulan telanjang - persis cacat yang berulang pada prototipe. */
const BULAN_TELANJANG = new Set(P.BULAN);

console.log("");
console.log("== Almanak ==");
sama("menambah hari melintasi pergantian bulan", P.tambahHari("2026-01-31", 1), "2026-02-01");
sama("Februari tahun kabisat punya 29 hari", P.akhirBulan(2024, 2), "2024-02-29");
sama("Februari tahun biasa punya 28 hari", P.akhirBulan(2026, 2), "2026-02-28");
sama("Februari 2000 kabisat (kelipatan 400)", P.akhirBulan(2000, 2), "2000-02-29");
sama("Februari 1900 bukan kabisat (kelipatan 100)", P.akhirBulan(1900, 2), "1900-02-28");
sama("akhir Desember", P.akhirBulan(2026, 12), "2026-12-31");
sama("awal bulan", P.awalBulan(2026, 9), "2026-09-01");
sama("mundur melintasi pergantian tahun", P.tambahHari("2026-01-01", -1), "2025-12-31");

periksa(
  "tanggal yang tidak ada pada almanak ditolak",
  (() => {
    try {
      P.tambahHari("2026-02-30", 1);
      return false;
    } catch (_) {
      return true;
    }
  })()
);
periksa(
  "tanggal berbentuk salah ditolak",
  (() => {
    try {
      P.tambahHari("6 September 2026", 1);
      return false;
    } catch (_) {
      return true;
    }
  })()
);

console.log("== Hari kerja lawan hari kalender ==");
// Selisih keduanya bukan main-main, dan justru pada bentuk yang paling sering
// terjadi: relaas Jumat untuk sidang Senin.
sama("Jumat ke Senin: tiga hari kalender", P.hariKalenderAntara("2026-09-04", "2026-09-07"), 3);
sama("Jumat ke Senin: hanya SATU hari kerja", P.hariKerjaAntara("2026-09-04", "2026-09-07"), 1);
sama("Senin ke Kamis: tiga hari kalender", P.hariKalenderAntara("2026-08-31", "2026-09-03"), 3);
sama("Senin ke Kamis: tiga hari kerja pula", P.hariKerjaAntara("2026-08-31", "2026-09-03"), 3);
sama("Sabtu ke Senin: nol hari kerja", P.hariKerjaAntara("2026-09-05", "2026-09-07"), 1);
sama("tanggal yang sama: nol", P.hariKerjaAntara("2026-09-07", "2026-09-07"), 0);
sama("mundur: nol, bukan minus", P.hariKerjaAntara("2026-09-07", "2026-09-04"), 0);
sama("sepekan penuh: lima hari kerja", P.hariKerjaAntara("2026-08-31", "2026-09-07"), 5);
sama("dua pekan: sepuluh hari kerja", P.hariKerjaAntara("2026-08-31", "2026-09-14"), 10);
// Sejak hari libur ikut dikecualikan, rentang ini berisi 1 Januari - dan
// jawabannya berubah dari 5 menjadi 4. Itu BUKAN kemunduran melainkan
// pembetulan: 1 Januari memang bukan hari kerja, dan menghitungnya sebagai
// hari kerja menuduh juru sita yang tidak dapat bekerja pada hari itu.
sama("melintasi pergantian tahun, 1 Januari dikecualikan", P.hariKerjaAntara("2025-12-29", "2026-01-05"), 4);
sama("bila hari libur diabaikan, kembali menjadi 5",
  P.hariKerjaAntara("2025-12-29", "2026-01-05", { tanpaHariLibur: true }), 5);

// Cuti bersama Idulfitri 2025: 31 Maret sampai 7 April berisi enam hari libur
// beruntun. Tanpa daftar libur, rentang itu tampak berisi lima hari kerja.
sama("pekan Idulfitri 2025 hampir tidak punya hari kerja",
  P.hariKerjaAntara("2025-03-28", "2025-04-08"), 1);
sama("dan tanpa daftar libur akan terbaca tujuh",
  P.hariKerjaAntara("2025-03-28", "2025-04-08", { tanpaHariLibur: true }), 7);

// Rinciannya mengaku bahwa daftarnya belum disahkan.
{
  const r = P.hariKerjaRinci("2025-03-28", "2025-04-08");
  periksa("rincian menyebut jumlah hari kerja", r.jumlah === 1, String(r.jumlah));
  periksa("dan menghitung akhir pekannya", r.akhirPekan === 4, String(r.akhirPekan));
  periksa("dan menyebut hari liburnya satu per satu", r.libur.length === 6, String(r.libur.length));
  periksa("dan menyebut namanya", /Idulfitri/.test(r.libur.map((x) => x.nama).join(" ")));
  periksa("dan mengaku daftarnya belum disahkan", r.dapatDipercaya === false);
  periksa("dan menyebut tahun yang belum disahkan", /2025/.test(r.sebabTidakDapatDipercaya), r.sebabTidakDapatDipercaya);
}

console.log("== Pekan mulai Senin ==");
sama("Senin pada pekan yang memuat Minggu", P.awalPekan("2026-09-06"), "2026-08-31");
sama("Senin pada pekan yang memuat Senin itu sendiri", P.awalPekan("2026-08-31"), "2026-08-31");
sama("Senin pada pekan yang memuat Sabtu", P.awalPekan("2026-09-05"), "2026-08-31");
periksa(
  "nomor pekan mengikuti aturan Kamis (ISO)",
  (() => {
    // 4 Januari selalu berada pada pekan ke-1, apa pun hari jatuhnya.
    return [2024, 2025, 2026, 2027].every((t) => P.nomorPekan(`${t}-01-04`).nomor === 1);
  })()
);
periksa(
  "29 Desember dapat masuk pekan ke-1 tahun berikutnya",
  P.nomorPekan("2025-12-29").tahun === 2026 && P.nomorPekan("2025-12-29").nomor === 1,
  JSON.stringify(P.nomorPekan("2025-12-29"))
);

console.log("== Rentang terbaca ==");
sama("sebulan setahun", P.rentangTerbaca("2026-07-13", "2026-07-19"), "13–19 Juli 2026");
sama("beda bulan setahun", P.rentangTerbaca("2026-07-27", "2026-08-02"), "27 Juli–2 Agustus 2026");
sama("beda tahun", P.rentangTerbaca("2025-12-29", "2026-01-04"), "29 Desember 2025–4 Januari 2026");

console.log("== Ketujuh jendela ==");
const ACUAN = "2026-09-06"; // Minggu
const JENDELA = P.PERIODE.map((x) => x.jenis);
sama("jumlah jendela", JENDELA.length, 7);

const semuaUnit = [];
JENDELA.forEach((jenis) => {
  const p = P.satuanPeriode(jenis, ACUAN, { tahunAwal: 2015 });
  periksa(`${jenis}: ada satuannya`, p.unit.length > 0, `dapat ${p.unit.length}`);
  periksa(
    `${jenis}: tiap satuan punya kunci, label, mulai, selesai`,
    p.unit.every((u) => u.kunci && u.label && u.mulai && u.selesai)
  );
  periksa(
    `${jenis}: mulai tidak melewati selesai`,
    p.unit.every((u) => u.mulai <= u.selesai)
  );
  periksa(
    `${jenis}: kuncinya tidak berulang`,
    new Set(p.unit.map((u) => u.kunci)).size === p.unit.length
  );
  periksa(
    `${jenis}: satuannya berurutan maju`,
    p.unit.every((u, i) => i === 0 || p.unit[i - 1].mulai < u.mulai)
  );
  periksa(
    `${jenis}: satuan terakhir memuat tanggal acuan`,
    (() => {
      const akhir = p.unit[p.unit.length - 1];
      return akhir.mulai <= ACUAN && ACUAN <= akhir.selesai;
    })(),
    JSON.stringify(p.unit[p.unit.length - 1])
  );
  // Inilah cacat yang berulang: nama baris berupa nama bulan telanjang.
  periksa(
    `${jenis}: tidak ada nama baris berupa nama bulan telanjang`,
    p.unit.every((u) => !BULAN_TELANJANG.has(String(u.label).trim())),
    p.unit
      .filter((u) => BULAN_TELANJANG.has(String(u.label).trim()))
      .map((u) => u.label)
      .join(", ")
  );
  // Dan yang lebih halus: nama baris tanpa angka tahun sama sekali.
  periksa(
    `${jenis}: setiap nama baris memuat angka tahun`,
    p.unit.every((u) => /\d{4}/.test(u.label)),
    p.unit.filter((u) => !/\d{4}/.test(u.label)).map((u) => u.label).join(", ")
  );
  semuaUnit.push({ jenis, contoh: p.unit[0].label, terakhir: p.unit[p.unit.length - 1].label });
});

console.log("== Bentuk nama baris ==");
{
  const h = P.satuanPeriode("harian", ACUAN).unit;
  sama("harian: tujuh hari", h.length, 7);
  sama("harian: hari terakhir adalah acuannya", h[6].kunci, ACUAN);
  sama("harian: nama harinya benar", h[6].label, "Minggu, 6 September 2026");
  sama("harian: hari pertama tujuh hari sebelumnya", h[0].kunci, "2026-08-31");

  const m = P.satuanPeriode("mingguan", ACUAN).unit;
  sama("mingguan: delapan pekan", m.length, 8);
  periksa("mingguan: tiap pekan tujuh hari", m.every((u) => P.tambahHari(u.mulai, 6) === u.selesai));
  periksa("mingguan: tiap pekan mulai Senin", m.every((u) => P.awalPekan(u.mulai) === u.mulai));
  periksa(
    "mingguan: labelnya memuat rentang tanggal",
    m.every((u) => /\d{1,2}(–| )/.test(u.label) && /Minggu ke-\d+/.test(u.label)),
    m[0].label
  );

  const b = P.satuanPeriode("bulanan", ACUAN).unit;
  sama("bulanan: dua belas bulan", b.length, 12);
  sama("bulanan: bulan terakhir September 2026", b[11].label, "September 2026");
  sama("bulanan: bulan pertama Oktober 2025", b[0].label, "Oktober 2025");
  sama("bulanan: batas bulan Februari ikut kabisat", P.satuanPeriode("bulanan", "2024-03-15").unit[10].selesai, "2024-02-29");

  const tw = P.satuanPeriode("triwulan", ACUAN).unit;
  sama("triwulan: delapan triwulan", tw.length, 8);
  sama("triwulan: yang terakhir Triwulan III 2026", tw[7].label, "Triwulan III 2026 · Jul–Sep");
  sama("triwulan: batasnya benar", tw[7].mulai + ".." + tw[7].selesai, "2026-07-01..2026-09-30");

  const sm = P.satuanPeriode("semester", ACUAN).unit;
  sama("semester: enam semester", sm.length, 6);
  sama("semester: yang terakhir Semester II 2026", sm[5].label, "Semester II 2026 · Jul–Des");
  sama("semester: batasnya benar", sm[5].mulai + ".." + sm[5].selesai, "2026-07-01..2026-12-31");

  const th = P.satuanPeriode("tahunan", ACUAN).unit;
  sama("tahunan: lima tahun", th.length, 5);
  sama("tahunan: yang terakhir 2026", th[4].label, "Tahun 2026 · Jan–Des");
  sama("tahunan: yang pertama 2022", th[0].label, "Tahun 2022 · Jan–Des");

  const ks = P.satuanPeriode("keseluruhan", ACUAN, { tahunAwal: 2015 }).unit;
  sama("keseluruhan: dari 2015 sampai 2026", ks.length, 12);
  sama("keseluruhan: yang pertama 2015", ks[0].label, "Tahun 2015");
}

console.log("== Melintasi pergantian tahun ==");
{
  const b = P.satuanPeriode("bulanan", "2026-01-15").unit;
  sama("bulanan dari Januari mundur ke Februari tahun lalu", b[0].label, "Februari 2025");
  const tw = P.satuanPeriode("triwulan", "2026-01-15").unit;
  sama("triwulan dari TW I 2026 mundur delapan", tw[0].label, "Triwulan II 2024 · Apr–Jun");
  const sm = P.satuanPeriode("semester", "2026-01-15").unit;
  sama("semester dari S I 2026 mundur enam", sm[0].label, "Semester II 2023 · Jul–Des");
  const m = P.satuanPeriode("mingguan", "2026-01-01").unit;
  periksa("mingguan melintasi tahun tetap tujuh hari", m.every((u) => P.tambahHari(u.mulai, 6) === u.selesai));
  periksa("mingguan melintasi tahun labelnya memuat kedua tahun bila perlu", m.some((u) => /2025.*2026/.test(u.label)), m.map((u) => u.label).join(" | "));
}

console.log("== Tidak bergantung zona mesin ==");
{
  // Hasilnya harus sama persis walau TZ mesin diubah - sebab seluruh
  // aritmetikanya memakai tanggal almanak, bukan saat.
  const sebelum = process.env.TZ;
  const hasil = [];
  for (const tz of ["UTC", "Asia/Makassar", "America/New_York", "Pacific/Kiritimati"]) {
    process.env.TZ = tz;
    hasil.push(JSON.stringify(P.satuanPeriode("mingguan", ACUAN).unit.map((u) => u.kunci + u.label)));
  }
  if (sebelum === undefined) delete process.env.TZ;
  else process.env.TZ = sebelum;
  periksa("satuan mingguan sama pada empat zona mesin", new Set(hasil).size === 1, `dapat ${new Set(hasil).size} hasil berbeda`);
}
{
  const pagi = new Date("2026-09-06T00:30:00+08:00"); // 6 Sep di WITA
  const malam = new Date("2026-09-06T23:30:00+08:00");
  sama("tanggal WITA pada dini hari", P.tanggalHariIni("Asia/Makassar", pagi), "2026-09-06");
  sama("tanggal WITA pada larut malam", P.tanggalHariIni("Asia/Makassar", malam), "2026-09-06");
  // Saat yang sama di UTC masih 5 September - itulah sebabnya zonanya ditulis tegas.
  sama("saat yang sama di UTC masih hari sebelumnya", P.tanggalHariIni("UTC", pagi), "2026-09-05");
}

console.log("== Lantai periode ==");
{
  periksa("penilaian berlantai bulanan tidak punya nilai harian", P.dibawahLantai("bulanan", "harian"));
  periksa("penilaian berlantai bulanan tidak punya nilai mingguan", P.dibawahLantai("bulanan", "mingguan"));
  periksa("penilaian berlantai bulanan punya nilai bulanan", !P.dibawahLantai("bulanan", "bulanan"));
  periksa("penilaian berlantai bulanan punya nilai tahunan", !P.dibawahLantai("bulanan", "tahunan"));
  periksa("penilaian berlantai harian punya nilai harian", !P.dibawahLantai("harian", "harian"));
  periksa(
    "lantai yang tidak dikenali ditolak",
    (() => {
      try {
        P.dibawahLantai("mingguanan", "harian");
        return false;
      } catch (_) {
        return true;
      }
    })()
  );
  periksa(
    "jendela yang tidak dikenali ditolak",
    (() => {
      try {
        P.satuanPeriode("dasawarsa", ACUAN);
        return false;
      } catch (_) {
        return true;
      }
    })()
  );
  periksa(
    "nama warisan Object tidak menembus daftar jendela",
    ["constructor", "toString", "__proto__", "hasOwnProperty"].every((k) => {
      try {
        P.satuanPeriode(k, ACUAN);
        return false;
      } catch (_) {
        return true;
      }
    })
  );
}

console.log("== MS05 pembatas kecukupan penyebut ==");
{
  const kurang = P.nilaiDenganPembatas(2, 3);
  periksa("penyebut tiga tidak menghasilkan nilai", kurang.nilai === null && kurang.cukup === false);
  periksa("dan sebabnya menyebut angkanya", /penyebutnya 3/.test(kurang.sebab), kurang.sebab);
  periksa("yang keluar null, bukan nol", kurang.nilai !== 0);

  const cukup = P.nilaiDenganPembatas(19, 20);
  periksa("penyebut dua puluh menghasilkan nilai", cukup.cukup === true && cukup.nilai === 95);

  const penuh = P.nilaiDenganPembatas(40, 40);
  periksa("seluruhnya terpenuhi bernilai seratus", penuh.nilai === 100);

  const nol = P.nilaiDenganPembatas(0, 40);
  periksa("nol dari empat puluh bernilai nol, dan itu memang nilai", nol.nilai === 0 && nol.cukup === true);

  periksa("terpenuhi melebihi penyebut ditolak", P.nilaiDenganPembatas(41, 40).nilai === null);
  periksa("angka bukan bilangan ditolak", P.nilaiDenganPembatas("banyak", 40).nilai === null);
  periksa("penyebut negatif ditolak", P.nilaiDenganPembatas(1, -5).nilai === null);
  periksa("batasnya dapat diubah pemanggil", P.nilaiDenganPembatas(2, 3, 2).cukup === true);
}

console.log("== Hitung dua kali ==");
{
  const sekali = JSON.stringify(JENDELA.map((j) => P.satuanPeriode(j, ACUAN, { tahunAwal: 2015 })));
  const dua = JSON.stringify(JENDELA.map((j) => P.satuanPeriode(j, ACUAN, { tahunAwal: 2015 })));
  periksa("ketujuh jendela sama persis pada hitungan kedua", sekali === dua);
}

console.log("");
console.log("Contoh nama baris tiap jendela:");
semuaUnit.forEach((x) => console.log(`  ${x.jenis.padEnd(12)} ${x.contoh}   …   ${x.terakhir}`));

console.log("");
console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal > 0 ? 1 : 0);
