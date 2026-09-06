"use strict";

/**
 * ============================================================================
 * BAB 4 - LAPORAN PERKARA LIPA 1 SAMPAI 22
 * ============================================================================
 *
 * Yang paling dijaga di sini satu hal yang menentukan apakah penilaian ini
 * jujur atau tidak:
 *
 *   LAPORAN YANG ASPEK KEDUANYA BELUM DIPERIKSA TIDAK BOLEH BERNILAI.
 *
 * Menjumlah aspek pertama saja lalu menyebutnya "nilai" membuat laporan yang
 * angkanya tidak pernah dibandingkan dengan SIPP tampak bernilai enam puluh
 * dari seratus - padahal yang benar "enam puluh dari enam puluh yang dapat
 * dinilai". Selisih pembacaan itu menentukan apakah seseorang dianggap lalai.
 *
 * Berjalan tanpa basis data.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) lulus += 1;
  else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const tabel = new Map();
const jalurDb = require.resolve("../bot_db_config");
require("../bot_db_config");
require.cache[jalurDb].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql);
    const p = Array.isArray(params) ? params : [];
    if (/^\s*CREATE TABLE/i.test(teks)) return selesai(null, []);
    if (/^\s*INSERT INTO/i.test(teks)) {
      tabel.set(`${p[0]}|${p[1]}`, {
        lipaNomor: p[0],
        bulanLaporan: p[1],
        tanggalKirim: p[2],
        angkaLaporan: p[3],
        dicatatOleh: p[4],
        jabatan: p[5],
        keterangan: p[6],
        dicatatPada: p[7],
      });
      return selesai(null, { affectedRows: 1 });
    }
    if (/FROM aleta_bot_laporan_perkara/i.test(teks)) {
      const hasil = [...tabel.values()]
        .filter((b) => b.lipaNomor === p[0] && b.bulanLaporan >= p[1] && b.bulanLaporan <= p[2])
        .sort((a, b) => String(a.bulanLaporan).localeCompare(String(b.bulanLaporan)));
      return selesai(null, hasil);
    }
    return selesai(null, []);
  },
};

const L = require("../services/laporanPerkaraService");

async function utama() {
  console.log("");
  console.log("== Dua puluh dua laporan ==");
  periksa("berjumlah dua puluh dua", L.LIPA.length === 22, `dapat ${L.LIPA.length}`);
  periksa("bernomor satu sampai dua puluh dua", L.LIPA.every((x, i) => x.nomor === i + 1));
  periksa("masing-masing bernama", L.LIPA.every((x) => x.nama && x.nama.length > 3));
  periksa("nomornya tidak berulang", new Set(L.LIPA.map((x) => x.nomor)).size === 22);
  const dipa = L.LIPA.filter((x) => x.dipa04);
  periksa("tiga laporan berbiaya DIPA 04", dipa.length === 3, dipa.map((x) => x.nomor).join(","));
  periksa("yaitu LIPA 14, 15, dan 16", dipa.map((x) => x.nomor).join(",") === "14,15,16");
  periksa("kuncinya berbentuk LP01 sampai LP22", L.kunciLipa(1) === "LP01" && L.kunciLipa(22) === "LP22");
  periksa("LIPA yang tidak ada memulangkan null", L.butirLipa(23) === null && L.butirLipa(0) === null);

  console.log("== Batas kirim ==");
  {
    const l1 = L.batasKirim("2026-08", 1);
    periksa("LIPA 1 Agustus berbatas 5 September", l1.tanggal === "2026-09-05", l1.tanggal);
    periksa("dan harinya lima", l1.hari === 5);
    periksa("dan bukan DIPA 04", l1.dipa04 === false);
    periksa("dan menyebut dasarnya", /Petunjuk pelaporan/.test(l1.dasar), l1.dasar);

    const l14 = L.batasKirim("2026-08", 14);
    periksa("LIPA 14 Agustus berbatas 10 September", l14.tanggal === "2026-09-10", l14.tanggal);
    periksa("dan ditandai DIPA 04", l14.dipa04 === true);

    // Desember melintasi pergantian tahun.
    periksa("LIPA 1 Desember berbatas 5 Januari tahun berikutnya",
      L.batasKirim("2026-12", 1).tanggal === "2027-01-05", L.batasKirim("2026-12", 1).tanggal);
    periksa("LIPA 16 Desember berbatas 10 Januari",
      L.batasKirim("2026-12", 16).tanggal === "2027-01-10");

    periksa("bulan berbentuk salah ditolak", (() => {
      try { L.batasKirim("Agustus 2026", 1); return false; } catch (_) { return true; }
    })());
    periksa("LIPA yang tidak ada ditolak", (() => {
      try { L.batasKirim("2026-08", 99); return false; } catch (_) { return true; }
    })());
  }

  console.log("== Nilai satu baris ==");
  {
    const tepat = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: "2026-09-03", angkaLaporan: 548, angkaSipp: 548 });
    periksa("dikirim sebelum batas: tidak terlambat", tepat.terlambatHari === 0);
    periksa("dan nilai ketepatannya penuh", tepat.nilaiKetepatan === 60);
    periksa("angka sama: nilai kesesuaian penuh", tepat.nilaiKesesuaian === 40);
    periksa("nilai gabungannya seratus", tepat.nilai === 100);

    const tepatHariH = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: "2026-09-05", angkaLaporan: 1, angkaSipp: 1 });
    periksa("dikirim tepat pada hari batas tidak terlambat", tepatHariH.terlambatHari === 0 && tepatHariH.nilai === 100);

    const telat = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: "2026-09-08", angkaLaporan: 548, angkaSipp: 548 });
    periksa("terlambat tiga hari", telat.terlambatHari === 3);
    periksa("nilai ketepatan berkurang dua puluh empat", telat.nilaiKetepatan === 36);
    periksa("nilai gabungannya tujuh puluh enam", telat.nilai === 76);

    const telatSekali = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: "2026-10-05", angkaLaporan: 1, angkaSipp: 1 });
    periksa("terlambat sebulan: nilai ketepatan habis, tidak minus", telatSekali.nilaiKetepatan === 0);
    periksa("dan nilai gabungannya empat puluh", telatSekali.nilai === 40);

    const beda = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: "2026-09-03", angkaLaporan: 548, angkaSipp: 550 });
    periksa("selisih dua: kesesuaian berkurang dua puluh", beda.nilaiKesesuaian === 20);
    periksa("selisihnya tercatat", beda.selisihAngka === 2);

    const bedaJauh = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: "2026-09-03", angkaLaporan: 500, angkaSipp: 550 });
    periksa("selisih besar: kesesuaian habis, tidak minus", bedaJauh.nilaiKesesuaian === 0);

    const selisihMinus = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: "2026-09-03", angkaLaporan: 550, angkaSipp: 548 });
    periksa("selisih ke arah sebaliknya dihitung sama", selisihMinus.nilaiKesesuaian === 20);
    periksa("dan tandanya tetap terbaca", selisihMinus.selisihAngka === -2);
  }

  console.log("== Yang belum diperiksa TIDAK bernilai ==");
  {
    const tanpaSipp = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: "2026-09-03", angkaLaporan: 548, angkaSipp: null });
    periksa("aspek pertama tetap dinilai", tanpaSipp.nilaiKetepatan === 60);
    periksa("aspek kedua tidak dinilai", tanpaSipp.nilaiKesesuaian === null);
    // Inilah intinya.
    periksa("nilai gabungannya NULL, bukan enam puluh", tanpaSipp.nilai === null);
    periksa("tetapi nilai sebagiannya tetap terbaca", tanpaSipp.nilaiSebagian === 60);
    periksa("dan bobot yang terpakai disebut", tanpaSipp.bobotTerpakai === 60);
    periksa("sebabnya menyebut angka SIPP belum tersambung",
      tanpaSipp.belumDapatDinilai.some((s) => /angka SIPP/.test(s)), JSON.stringify(tanpaSipp.belumDapatDinilai));

    const tanpaKirim = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: null, angkaLaporan: 548, angkaSipp: 548 });
    periksa("tanpa tanggal kirim, aspek pertama tidak dinilai", tanpaKirim.nilaiKetepatan === null);
    periksa("dan nilai gabungannya null", tanpaKirim.nilai === null);
    periksa("sebabnya menyebut tanggal kirim belum dicatat",
      tanpaKirim.belumDapatDinilai.some((s) => /tanggal kirim/.test(s)));

    const kosong = L.nilaiBaris({ batas: "2026-09-05", tanggalKirim: null, angkaLaporan: null, angkaSipp: null });
    periksa("tanpa apa pun, nilainya null dan bobot terpakainya nol",
      kosong.nilai === null && kosong.bobotTerpakai === 0);
    periksa("dan kedua sebabnya disebut", kosong.belumDapatDinilai.length === 2);
  }

  console.log("== Blangko nilai: bentuknya sama untuk kedua puluh dua ==");
  {
    const bulan = ["2026-06", "2026-07", "2026-08"];
    const semua = L.LIPA.map((x) => L.blangkoNilai(x.nomor, bulan));
    periksa("dua puluh dua blangko terbentuk", semua.length === 22);
    const kolomPertama = JSON.stringify(semua[0].kolom);
    periksa("kolomnya sama persis untuk kedua puluh dua",
      semua.every((b) => JSON.stringify(b.kolom) === kolomPertama), kolomPertama);
    periksa("kolomnya sembilan", semua[0].kolom.length === 9);
    periksa("tiga baris tiap blangko", semua.every((b) => b.baris.length === 3));
    periksa("tiap baris punya seluruh kolomnya",
      semua.every((b) => b.baris.every((r) => b.kolom.every((k) => k in r))));
    periksa("batas kirim LIPA 1 dan LIPA 14 memang berbeda",
      semua[0].baris[0].batasKirim !== semua[13].baris[0].batasKirim,
      `${semua[0].baris[0].batasKirim} lawan ${semua[13].baris[0].batasKirim}`);
    periksa("tanpa catatan apa pun, seluruh nilainya null",
      semua.every((b) => b.baris.every((r) => r.nilai === null)));
    periksa("dan keadaannya belum dapat dinilai",
      semua.every((b) => b.baris.every((r) => r.keadaan === "belum dapat dinilai")));
    periksa("catatannya menyebut hari libur belum diperhitungkan",
      /hari libur belum diperhitungkan/i.test(semua[0].catatan), semua[0].catatan.slice(-90));
  }

  console.log("== Blangko dengan catatan dan angka SIPP ==");
  {
    const bulan = ["2026-07", "2026-08"];
    const b = L.blangkoNilai(
      1,
      bulan,
      { "2026-07": { tanggalKirim: "2026-08-04", angkaLaporan: 548 }, "2026-08": { tanggalKirim: "2026-09-09", angkaLaporan: 561 } },
      { "2026-07": 548, "2026-08": 560 }
    );
    periksa("Juli tepat waktu dan angkanya sama: seratus", b.baris[0].nilai === 100, String(b.baris[0].nilai));
    periksa("dan keadaannya baik", b.baris[0].keadaan === "baik");
    periksa("Agustus terlambat empat hari", b.baris[1].terlambatHari === 4);
    periksa("dan selisih angkanya satu", b.baris[1].selisihAngka === -1);
    periksa("nilainya dua puluh delapan ditambah tiga puluh", b.baris[1].nilai === 58, String(b.baris[1].nilai));
    periksa("dan keadaannya tindakan", b.baris[1].keadaan === "tindakan");
  }

  console.log("== Mencatat pengiriman ==");
  {
    periksa("LIPA yang tidak ada ditolak", L.celaCatatan({ lipaNomor: 99, bulanLaporan: "2026-08", dicatatOleh: "A" }).length > 0);
    periksa("bulan berbentuk salah ditolak", L.celaCatatan({ lipaNomor: 1, bulanLaporan: "Agustus", dicatatOleh: "A" }).length > 0);
    periksa("tanpa pencatat ditolak", L.celaCatatan({ lipaNomor: 1, bulanLaporan: "2026-08", dicatatOleh: "" }).length > 0);
    periksa("tanggal kirim berbentuk salah ditolak",
      L.celaCatatan({ lipaNomor: 1, bulanLaporan: "2026-08", dicatatOleh: "A", tanggalKirim: "4 Agustus" }).length > 0);
    periksa("angka bukan bilangan ditolak",
      L.celaCatatan({ lipaNomor: 1, bulanLaporan: "2026-08", dicatatOleh: "A", angkaLaporan: "banyak" }).length > 0);
    periksa("catatan yang lengkap diterima",
      L.celaCatatan({ lipaNomor: 1, bulanLaporan: "2026-08", dicatatOleh: "Nurlaila", tanggalKirim: "2026-09-03", angkaLaporan: 548 }).length === 0);
    periksa("catatan tanpa tanggal kirim tetap diterima - belum dikirim itu keadaan yang sah",
      L.celaCatatan({ lipaNomor: 1, bulanLaporan: "2026-08", dicatatOleh: "Nurlaila" }).length === 0);

    await L.catatPengiriman({ lipaNomor: 1, bulanLaporan: "2026-08", tanggalKirim: "2026-09-03", angkaLaporan: 548, dicatatOleh: "Nurlaila", jabatan: "Kepaniteraan Hukum" });
    let baca = await L.bacaPengiriman(1, "2026-01", "2026-12");
    periksa("catatan tersimpan", baca.length === 1 && baca[0].angkaLaporan === 548);

    await L.catatPengiriman({ lipaNomor: 1, bulanLaporan: "2026-08", tanggalKirim: "2026-09-04", angkaLaporan: 549, dicatatOleh: "Nurlaila", jabatan: "Kepaniteraan Hukum" });
    baca = await L.bacaPengiriman(1, "2026-01", "2026-12");
    periksa("mencatat ulang memperbarui, tidak menggandakan", baca.length === 1 && baca[0].angkaLaporan === 549);

    let melempar = false;
    try { await L.catatPengiriman({ lipaNomor: 99, bulanLaporan: "2026-08", dicatatOleh: "A" }); } catch (_) { melempar = true; }
    periksa("mencatat LIPA yang tidak ada melempar", melempar);
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
