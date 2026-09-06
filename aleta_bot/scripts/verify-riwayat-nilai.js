"use strict";

/**
 * ============================================================================
 * MS03 - RIWAYAT NILAI TERSIMPAN
 * ============================================================================
 *
 * Yang dijaga di sini bukan penyimpanannya, melainkan SIFAT YANG MEMBUATNYA
 * berguna:
 *
 *   1. Ambang yang disimpan diambil dari TANGGAL AKHIR PERIODENYA, bukan dari
 *      hari ini. Periode Agustus dinilai dengan aturan yang berlaku pada
 *      Agustus - itu satu-satunya cara nilai lampau tetap dapat direproduksi.
 *
 *   2. Menghitung ulang periode yang sama MEMPERBARUI barisnya, tidak menambah
 *      baris kedua. Dua baris untuk periode yang sama membuat "nilai bulan
 *      Agustus" punya dua jawaban.
 *
 *   3. Perbandingan hitung ulang menyebut DUGAAN SEBABNYA, bukan sekadar "ada
 *      selisih". Ambang yang berubah adalah sebab yang sah; data lampau yang
 *      berubah justru temuan pengawasan. Menyamakan keduanya membuang seluruh
 *      keterangan yang membuat temuan itu dapat ditindaklanjuti.
 *
 * Berjalan tanpa basis data - bot_db_config diganti penadah yang mengingat
 * kueri dan barisnya di dalam ingatan.
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

/* --------------------------------------------------------------- penadah --
 * Menirukan MySQL secukupnya: satu tabel, kunci unik, dan perilaku
 * ON DUPLICATE KEY UPDATE. Bukan MySQL sungguhan, dan tidak berpura-pura -
 * yang diuji di sini logika layanannya, bukan basis datanya.
 */
const kueri = [];
const tabel = new Map();

const jalurDb = require.resolve("../bot_db_config");
require("../bot_db_config");
require.cache[jalurDb].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql);
    const p = Array.isArray(params) ? params : [];
    kueri.push({ sql: teks, params: p });

    if (/^\s*CREATE TABLE/i.test(teks)) return selesai(null, []);

    if (/^\s*INSERT INTO/i.test(teks)) {
      const kunci = `${p[0]}|${p[1]}|${p[2]}`;
      tabel.set(kunci, {
        penilaian: p[0],
        periodeJenis: p[1],
        unitKunci: p[2],
        unitLabel: p[3],
        mulai: p[4],
        selesai: p[5],
        terpenuhi: p[6],
        penyebut: p[7],
        nilai: p[8],
        cukup: p[9],
        sebabTidakCukup: p[10],
        cakupanTerpakai: p[11],
        cakupanSemestinya: p[12],
        sidikAmbang: p[13],
        ambangJson: p[14],
        versiRumus: p[15],
        dihitungPada: p[16],
      });
      return selesai(null, { affectedRows: 1 });
    }

    if (/FROM aleta_bot_nilai_riwayat/i.test(teks) && /unit_kunci = \?/.test(teks)) {
      const kunci = `${p[0]}|${p[1]}|${p[2]}`;
      const baris = tabel.get(kunci);
      return selesai(null, baris ? [baris] : []);
    }

    if (/FROM aleta_bot_nilai_riwayat/i.test(teks)) {
      const hasil = [...tabel.values()]
        .filter((b) => b.penilaian === p[0] && b.periodeJenis === p[1])
        .sort((a, b) => String(a.unitKunci).localeCompare(String(b.unitKunci)));
      return selesai(null, hasil);
    }

    return selesai(null, []);
  },
};

const R = require("../services/riwayatNilaiService");
const A = require("../services/ambangPenilaianService");

async function utama() {
  console.log("");
  console.log("== Tabelnya dibuat sekali, bukan tiap pemanggilan ==");
  await R.pastikanTabel();
  await R.pastikanTabel();
  await R.pastikanTabel();
  const buatTabel = kueri.filter((k) => /^\s*CREATE TABLE/i.test(k.sql));
  periksa("CREATE TABLE hanya dijalankan sekali", buatTabel.length === 1, `dapat ${buatTabel.length}`);
  periksa("tabelnya bernama aleta_bot_nilai_riwayat", /aleta_bot_nilai_riwayat/.test(buatTabel[0].sql));
  periksa(
    "punya kunci unik pada penilaian, jenis periode, dan satuannya",
    /UNIQUE KEY[\s\S]*penilaian, periode_jenis, unit_kunci/.test(buatTabel[0].sql)
  );

  console.log("== Ambang diambil dari akhir periode, bukan dari hari ini ==");
  {
    // Periode yang berakhir sebelum SK minutasi lahir tidak boleh membawa
    // ambang empat belas hari.
    await R.simpanNilai({
      penilaian: "ketaatanMinutasi",
      periodeJenis: "bulanan",
      unitKunci: "2023-11",
      unitLabel: "November 2023",
      mulai: "2023-11-01",
      selesai: "2023-11-30",
      terpenuhi: 40,
      penyebut: 50,
      nilai: 80,
      cukup: true,
      versiRumus: "v1",
    });
    const lampau = await R.bacaSatu("ketaatanMinutasi", "bulanan", "2023-11");
    periksa("nilai lampau tersimpan", Boolean(lampau));
    periksa(
      "sidik ambangnya sama dengan sidik pada akhir periodenya",
      lampau.sidikAmbang === A.sidikAmbang("2023-11-30"),
      lampau.sidikAmbang
    );
    periksa(
      "dan BERBEDA dengan sidik hari ini",
      lampau.sidikAmbang !== A.sidikAmbang("2026-09-06")
    );

    const isi = JSON.parse([...tabel.values()].find((b) => b.unitKunci === "2023-11").ambangJson);
    periksa("ambang minutasi pada November 2023 memang belum ada", isi.minutasiBerkas === null, JSON.stringify(isi.minutasiBerkas));
    periksa("ambang tenggang panggilan pada November 2023 sudah ada", isi.tenggangPanggilan === 3);
  }

  console.log("== Menghitung ulang memperbarui, tidak menggandakan ==");
  {
    const sebelum = tabel.size;
    await R.simpanNilai({
      penilaian: "ketaatanMinutasi",
      periodeJenis: "bulanan",
      unitKunci: "2023-11",
      unitLabel: "November 2023",
      mulai: "2023-11-01",
      selesai: "2023-11-30",
      terpenuhi: 41,
      penyebut: 50,
      nilai: 82,
      cukup: true,
      versiRumus: "v1",
    });
    periksa("jumlah baris tidak bertambah", tabel.size === sebelum, `${sebelum} -> ${tabel.size}`);
    const kini = await R.bacaSatu("ketaatanMinutasi", "bulanan", "2023-11");
    periksa("nilainya diperbarui", Number(kini.nilai) === 82);
    periksa(
      "perintahnya memakai ON DUPLICATE KEY UPDATE",
      kueri.some((k) => /ON DUPLICATE KEY UPDATE/i.test(k.sql))
    );
  }

  console.log("== Membaca riwayat satu penilaian ==");
  {
    for (const [kunci, label, nilai] of [
      ["2026-07", "Juli 2026", 91],
      ["2026-08", "Agustus 2026", 88],
      ["2026-06", "Juni 2026", 94],
    ]) {
      await R.simpanNilai({
        penilaian: "ketaatanPanggilan",
        periodeJenis: "bulanan",
        unitKunci: kunci,
        unitLabel: label,
        mulai: `${kunci}-01`,
        selesai: `${kunci}-28`,
        terpenuhi: nilai,
        penyebut: 100,
        nilai,
        cukup: true,
        versiRumus: "v1",
      });
    }
    const riwayat = await R.bacaRiwayat("ketaatanPanggilan", "bulanan");
    periksa("tiga baris terbaca", riwayat.length === 3, `dapat ${riwayat.length}`);
    periksa(
      "terurut menurut satuannya, bukan urutan penyimpanan",
      riwayat.map((r) => r.unitKunci).join(",") === "2026-06,2026-07,2026-08",
      riwayat.map((r) => r.unitKunci).join(",")
    );
    periksa(
      "penilaian lain tidak ikut terbawa",
      riwayat.every((r) => r.penilaian === "ketaatanPanggilan")
    );
  }

  console.log("== Perbandingan hitung ulang menyebut dugaan sebabnya ==");
  {
    const tersimpan = {
      terpenuhi: 90,
      penyebut: 100,
      nilai: 90,
      sidikAmbang: A.sidikAmbang("2026-08-31"),
      versiRumus: "v1",
    };

    const sama = R.bandingkanHitungUlang(
      tersimpan,
      { terpenuhi: 90, penyebut: 100, nilai: 90, versiRumus: "v1" },
      "2026-08-31"
    );
    periksa("hitungan yang sama dinyatakan sama", sama.sama === true && sama.keadaan === "sama");

    // Ambang berubah - selisihnya SAH.
    const asli = A.AMBANG.pembatasPenyebut.riwayat.slice();
    A.AMBANG.pembatasPenyebut.riwayat.push({
      mulai: "2026-09-01",
      nilai: 25,
      dasar: "Kebijakan Pengadilan Agama Donggala",
    });
    const karenaAmbang = R.bandingkanHitungUlang(
      tersimpan,
      { terpenuhi: 88, penyebut: 100, nilai: 88, versiRumus: "v1" },
      "2026-09-30"
    );
    periksa("selisih karena ambang dikenali", karenaAmbang.ambangBerubah === true, JSON.stringify(karenaAmbang).slice(0, 160));
    periksa("dan dugaannya menyebut selisihnya sah", /sah/.test(karenaAmbang.dugaan), karenaAmbang.dugaan);
    A.AMBANG.pembatasPenyebut.riwayat.length = 0;
    asli.forEach((r) => A.AMBANG.pembatasPenyebut.riwayat.push(r));

    // Rumus berubah.
    const karenaRumus = R.bandingkanHitungUlang(
      tersimpan,
      { terpenuhi: 88, penyebut: 100, nilai: 88, versiRumus: "v2" },
      "2026-08-31"
    );
    periksa("selisih karena rumus dikenali", karenaRumus.rumusBerubah === true);
    periksa("dan dugaannya menuntut hitung ulang seluruh riwayat", /seluruh riwayat/.test(karenaRumus.dugaan), karenaRumus.dugaan);

    // Tidak ada yang berubah, tetapi angkanya berbeda - inilah temuannya.
    const karenaData = R.bandingkanHitungUlang(
      tersimpan,
      { terpenuhi: 85, penyebut: 100, nilai: 85, versiRumus: "v1" },
      "2026-08-31"
    );
    periksa("selisih tanpa perubahan ambang maupun rumus dikenali", karenaData.keadaan === "berselisih");
    periksa(
      "dan dugaannya menunjuk data lampau yang berubah",
      /data periode lampau berubah/.test(karenaData.dugaan),
      karenaData.dugaan
    );
    periksa("keduanya ikut dilaporkan supaya dapat dibandingkan manusia",
      karenaData.tersimpan.nilai === 90 && karenaData.baru.nilai === 85);

    const belum = R.bandingkanHitungUlang(null, { nilai: 90 }, "2026-08-31");
    periksa("yang belum pernah dihitung dinyatakan belum-pernah", belum.keadaan === "belum-pernah");
  }

  console.log("== Pembanding angka ==");
  {
    periksa("null sama dengan null", R.samaAngka(null, null) === true);
    periksa("null tidak sama dengan nol", R.samaAngka(null, 0) === false);
    periksa("nol tidak sama dengan null", R.samaAngka(0, null) === false);
    periksa("selisih di bawah seperseratus dianggap sama", R.samaAngka(90.001, 90.002) === true);
    periksa("selisih seperseratus dianggap berbeda", R.samaAngka(90.0, 90.01) === false);
    periksa("tulisan angka dibaca sebagai angka", R.samaAngka("90", 90) === true);
  }

  console.log("== Yang wajib ada saat menyimpan ==");
  {
    let ditolak = 0;
    for (const kurang of [
      { periodeJenis: "bulanan", unitKunci: "2026-08" },
      { penilaian: "x", unitKunci: "2026-08" },
      { penilaian: "x", periodeJenis: "bulanan" },
    ]) {
      try {
        await R.simpanNilai(kurang);
      } catch (_) {
        ditolak += 1;
      }
    }
    periksa("penyimpanan tanpa ruas wajib ditolak", ditolak === 3, `dapat ${ditolak} dari 3`);
  }

  console.log("== Tidak ada tulisan ke SIPP ==");
  {
    // Layanan ini menulis, tetapi ke basis data BOT - bukan ke SIPP. Diperiksa
    // bahwa ia memang tidak pernah memuat db_config milik SIPP.
    const fs = require("fs");
    const isi = fs.readFileSync(require.resolve("../services/riwayatNilaiService"), "utf8");
    periksa('tidak memuat require("../db_config")', !/require\(["']\.\.\/db_config["']\)/.test(isi));
    periksa("memakai botDbService", /require\(["']\.\/botDbService["']\)/.test(isi));
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
