"use strict";

/**
 * ============================================================================
 * CATATAN YANG MELEKAT PADA PENILAIAN - D02, D13, D14, D18
 * ============================================================================
 *
 * Yang dijaga di sini bukan penyimpanannya, melainkan hal-hal yang membuat
 * catatan itu berguna sebagai HAK JAWAB:
 *
 *   - catatan tanpa penulis ditolak. Hak jawab yang tidak dapat ditelusuri
 *     penulisnya sama saja dengan tidak ada;
 *   - penjelasan TIDAK menghapus temuannya, hanya melekat padanya;
 *   - temuan yang "dikecualikan" wajib menyebut alasannya - mengecualikan
 *     tanpa alasan adalah cara paling halus menghilangkan temuan: ia tercatat,
 *     tampak sudah ditangani, dan tidak seorang pun kembali kepadanya;
 *   - baris yang belum punya catatan diberi keadaan "belum ditindak", bukan
 *     dibiarkan kosong. Kolom kosong terbaca "tidak berlaku".
 *
 * Berjalan tanpa basis data - bot_db_config diganti penadah.
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

/* --------------------------------------------------------------- penadah -- */
const tabel = [];
let nomor = 0;
const jalurDb = require.resolve("../bot_db_config");
require("../bot_db_config");
require.cache[jalurDb].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql);
    const p = Array.isArray(params) ? params : [];
    if (/^\s*CREATE TABLE/i.test(teks)) return selesai(null, []);
    if (/^\s*INSERT INTO/i.test(teks)) {
      nomor += 1;
      tabel.push({
        id: nomor,
        jenis: p[0],
        penilaian: p[1],
        periodeJenis: p[2],
        unitKunci: p[3],
        barisKunci: p[4],
        keadaan: p[5],
        isi: p[6],
        penulis: p[7],
        jabatan: p[8],
        ditulisPada: p[9],
      });
      return selesai(null, { affectedRows: 1 });
    }
    if (/FROM aleta_bot_catatan_penilaian/i.test(teks)) {
      // Menirukan syarat WHERE seadanya: penilaian selalu ada, jenis dan
      // barisKunci menyusul bila disebut.
      let hasil = tabel.filter((b) => b.penilaian === p[0]);
      let i = 1;
      if (/jenis = \?/.test(teks)) {
        hasil = hasil.filter((b) => b.jenis === p[i]);
        i += 1;
      }
      if (/baris_kunci = \?/.test(teks)) {
        hasil = hasil.filter((b) => b.barisKunci === p[i]);
        i += 1;
      }
      hasil = hasil
        .slice()
        .sort((a, b) => String(b.ditulisPada).localeCompare(String(a.ditulisPada)) || b.id - a.id);
      return selesai(null, hasil);
    }
    return selesai(null, []);
  },
};

const K = require("../services/catatanPenilaianService");

async function utama() {
  console.log("");
  console.log("== Jenis catatan ==");
  periksa("empat jenis terdaftar", Object.keys(K.JENIS).length === 4, Object.keys(K.JENIS).join(","));
  periksa("masing-masing menyebut alat dan tempat melekatnya",
    Object.values(K.JENIS).every((j) => j.alat && j.melekatPada && j.keterangan));
  periksa("keempat alatnya D02, D13, D14, D18",
    Object.values(K.JENIS).map((j) => j.alat).sort().join(",") === "D02,D13,D14,D18");
  periksa("nama warisan Object tidak menembus daftar jenis",
    ["constructor", "toString", "__proto__"].every((k) =>
      K.celaCatatan({ jenis: k, penulis: "A", jabatan: "B", isi: "x" }).length > 0));

  console.log("== Yang ditolak ==");
  const DITOLAK = [
    ["jenis tidak dikenali", { jenis: "karangan", penulis: "A", jabatan: "B", isi: "x" }],
    ["tanpa penulis", { jenis: "penjelasan", penilaian: "p", barisKunci: "1", jabatan: "B", isi: "x" }],
    ["tanpa jabatan", { jenis: "penjelasan", penilaian: "p", barisKunci: "1", penulis: "A", isi: "x" }],
    ["penjelasan tanpa baris", { jenis: "penjelasan", penilaian: "p", penulis: "A", jabatan: "B", isi: "x" }],
    ["penjelasan tanpa isi", { jenis: "penjelasan", penilaian: "p", barisKunci: "1", penulis: "A", jabatan: "B" }],
    ["disposisi tanpa penilaian", { jenis: "disposisi", penulis: "A", jabatan: "B", isi: "x" }],
    ["peristiwa tanpa waktu", { jenis: "peristiwa", penulis: "A", jabatan: "B", isi: "x" }],
    ["tindak lanjut berkeadaan asing", { jenis: "tindakLanjut", penilaian: "p", barisKunci: "1", keadaan: "hampir", penulis: "A", jabatan: "B" }],
    ["dikecualikan tanpa alasan", { jenis: "tindakLanjut", penilaian: "p", barisKunci: "1", keadaan: "dikecualikan", penulis: "A", jabatan: "B" }],
    ["dikecualikan beralasan terlalu pendek", { jenis: "tindakLanjut", penilaian: "p", barisKunci: "1", keadaan: "dikecualikan", isi: "sudah", penulis: "A", jabatan: "B" }],
  ];
  DITOLAK.forEach(([nama, c]) => periksa(`ditolak: ${nama}`, K.celaCatatan(c).length > 0, JSON.stringify(K.celaCatatan(c))));

  const DITERIMA = [
    ["penjelasan yang lengkap", { jenis: "penjelasan", penilaian: "p", barisKunci: "312/Pdt.G/2026", isi: "Pembetulan salah ketik nama pihak; amar tidak berubah.", penulis: "Ahmad Syarif", jabatan: "Panitera Pengganti" }],
    ["tindak lanjut selesai tanpa isi", { jenis: "tindakLanjut", penilaian: "p", barisKunci: "1", keadaan: "selesai", penulis: "A", jabatan: "B" }],
    ["dikecualikan beralasan cukup", { jenis: "tindakLanjut", penilaian: "p", barisKunci: "1", keadaan: "dikecualikan", isi: "Perkara dicabut sebelum sidang pertama, sehingga panggilan keduanya tidak diperlukan.", penulis: "A", jabatan: "B" }],
    ["disposisi", { jenis: "disposisi", penilaian: "p", isi: "Dibahas pada rapat pengawasan 12 September 2026.", penulis: "Ketua", jabatan: "Ketua Pengadilan" }],
    ["peristiwa bertanggal", { jenis: "peristiwa", unitKunci: "2026-07", periodeJenis: "bulanan", isi: "Mutasi dua jurusita.", penulis: "Panitera", jabatan: "Panitera" }],
  ];
  DITERIMA.forEach(([nama, c]) => periksa(`diterima: ${nama}`, K.celaCatatan(c).length === 0, JSON.stringify(K.celaCatatan(c))));

  console.log("== Menulis dan membaca ==");
  {
    await K.tulisCatatan({
      jenis: "penjelasan",
      penilaian: "perubahanPutusan",
      barisKunci: "312/Pdt.G/2026/PA.Dgl",
      isi: "Pembetulan salah ketik pada nama pihak di halaman kedua. Amar tidak berubah.",
      penulis: "Ahmad Syarif",
      jabatan: "Panitera Pengganti",
      ditulisPada: "2026-09-01 10:00:00",
    });
    const baca = await K.bacaCatatan({ penilaian: "perubahanPutusan", jenis: "penjelasan" });
    periksa("catatan tersimpan dan terbaca", baca.length === 1);
    periksa("penulis dan jabatannya ikut", baca[0].penulis === "Ahmad Syarif" && baca[0].jabatan === "Panitera Pengganti");
    let melempar = false;
    try {
      await K.tulisCatatan({ jenis: "penjelasan", penilaian: "x", penulis: "A", jabatan: "B", isi: "x" });
    } catch (_) {
      melempar = true;
    }
    periksa("menulis catatan yang cacat melempar", melempar);
    periksa("dan tidak menambah baris", (await K.bacaCatatan({ penilaian: "x" })).length === 0);
  }

  console.log("== Keadaan tindak lanjut - yang terbaru yang berlaku ==");
  {
    for (const [keadaan, waktu] of [
      ["belum", "2026-09-01 08:00:00"],
      ["jalan", "2026-09-02 08:00:00"],
      ["selesai", "2026-09-03 08:00:00"],
    ]) {
      await K.tulisCatatan({
        jenis: "tindakLanjut",
        penilaian: "ketaatanPanggilan",
        barisKunci: "470/Pdt.G/2026",
        keadaan,
        penulis: "Rusdin",
        jabatan: "Jurusita",
        ditulisPada: waktu,
      });
    }
    const peta = await K.keadaanTindakLanjut("ketaatanPanggilan");
    periksa("keadaan terakhir yang berlaku", peta.get("470/Pdt.G/2026").keadaan === "selesai",
      peta.get("470/Pdt.G/2026").keadaan);
    periksa("riwayat perubahannya tetap tersimpan",
      (await K.bacaCatatan({ penilaian: "ketaatanPanggilan", jenis: "tindakLanjut" })).length === 3);
  }

  console.log("== Menempelkan pada baris bukti ==");
  {
    const bukti = [
      { kunci: "470/Pdt.G/2026", memenuhi: false },
      { kunci: "512/Pdt.G/2026", memenuhi: false },
      { kunci: "600/Pdt.G/2026", memenuhi: true },
    ];
    const lekat = await K.lekatkanPadaBaris("ketaatanPanggilan", bukti);
    periksa("seluruh baris terbawa", lekat.length === 3);
    periksa("baris yang bercatatan memakai keadaan terakhirnya",
      lekat[0].tindakLanjut === "selesai", lekat[0].tindakLanjut);
    // Inilah yang membedakan kolom kosong dari "belum ditindak".
    periksa("baris tanpa catatan berkeadaan belum, bukan kosong",
      lekat[1].tindakLanjut === "belum" && lekat[1].tindakLanjutTerbaca === "Belum ditindak");
    periksa("penanda memenuhi tidak berubah",
      lekat.map((b) => b.memenuhi).join(",") === "false,false,true");
    periksa("baris tanpa penjelasan ditandai demikian", lekat[1].adaPenjelasan === false);
  }

  console.log("== Penjelasan tidak menghapus temuannya ==");
  {
    await K.tulisCatatan({
      jenis: "penjelasan",
      penilaian: "ketaatanPanggilan",
      barisKunci: "512/Pdt.G/2026",
      isi: "Panggilan kedua dilakukan pada hari yang sama karena sidang dimajukan atas permintaan pihak.",
      penulis: "Yusuf",
      jabatan: "Jurusita Pengganti",
      ditulisPada: "2026-09-04 08:00:00",
    });
    const lekat = await K.lekatkanPadaBaris("ketaatanPanggilan", [{ kunci: "512/Pdt.G/2026", memenuhi: false }]);
    periksa("penjelasannya melekat", lekat[0].adaPenjelasan === true && lekat[0].penjelasan.length === 1);
    // Yang paling penting: barisnya TETAP tidak memenuhi.
    periksa("tetapi barisnya TETAP tidak memenuhi", lekat[0].memenuhi === false);
  }

  console.log("== Satu tabel untuk empat jenis ==");
  {
    const jenisTersimpan = new Set(tabel.map((b) => b.jenis));
    periksa("beberapa jenis berbagi satu tabel", jenisTersimpan.size >= 2, [...jenisTersimpan].join(","));
    periksa("dan tabelnya memang satu", new Set(["aleta_bot_catatan_penilaian"]).has(K.TABEL));
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
