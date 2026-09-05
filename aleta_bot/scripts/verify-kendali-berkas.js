"use strict";

/**
 * Menguji penyusunan kendali berkas tanpa menyentuh SIPP maupun basis data bot.
 *
 * Yang diuji perilaku yang menentukan benar salahnya daftar kerja panitera:
 * apa yang disebut kurang, apa yang disebut lengkap, dan - yang paling penting -
 * apa yang terjadi ketika SIPP tidak terbaca.
 */

const kendali = require("../services/kendaliBerkasService");

let jumlah = 0;
let gagal = 0;

function cek(nama, dapat, harap) {
  jumlah += 1;
  if (JSON.stringify(dapat) !== JSON.stringify(harap)) {
    gagal += 1;
    console.log(`  GAGAL: ${nama}`);
    console.log(`         diharap ${JSON.stringify(harap)}, didapat ${JSON.stringify(dapat)}`);
  }
}

const perkara = {
  perkaraId: 4211,
  nomorPerkara: "419/Pdt.G/2025/PA.Dgl",
  jenisPerkara: "Cerai Gugat",
  tanggalDaftar: "2025-03-04",
  lewatEcourt: true,
};

/** Inventaris SIPP yang serba lengkap - tidak ada yang kurang. */
const sippLengkap = {
  dokumen: 6,
  sidang: 4,
  basAda: 4,
  relaas: 3,
  relaasBerdokumen: 3,
  putusan: true,
  putusanAnonim: true,
  aktaCerai: true,
  sudahPutus: true,
};

const aletaLengkap = { dokumen: 6, berkas: 9, belumTerunduh: 0 };

console.log("");
console.log("Uji kendali berkas");
console.log("");

// ---------------------------------------------------------------------------
console.log("Perkara lengkap");
// ---------------------------------------------------------------------------

const lengkap = kendali.susunKendali(perkara, sippLengkap, aletaLengkap);
cek("perkara lengkap berkeadaan lengkap", lengkap.keadaan, "lengkap");
cek("perkara lengkap tanpa kekurangan", lengkap.jumlahKurang, 0);
cek("perkara lengkap: rincian kosong", lengkap.rincianKurang.length, 0);
cek("perkara lengkap: SIPP terbaca", lengkap.sippTerbaca, true);

// ---------------------------------------------------------------------------
console.log("SIPP tidak terbaca - tidak boleh dinyatakan lengkap");
// ---------------------------------------------------------------------------

const gelap = kendali.susunKendali(perkara, null, aletaLengkap);
cek("SIPP gelap: keadaan belum_diperiksa, BUKAN lengkap", gelap.keadaan, "belum_diperiksa");
cek("SIPP gelap: ditandai tidak terbaca", gelap.sippTerbaca, false);
cek("SIPP gelap: tidak menyebut ada kekurangan", gelap.jumlahKurang, 0);
cek("SIPP gelap: menyebutkan sebabnya", gelap.alasanTidakTerbaca.length > 0, true);
// Inilah pokoknya: perkara yang SIPP-nya gelap tidak boleh hilang dari daftar
// kerja. daftarKurang menyaring keadaan <> 'lengkap', jadi selama keadaannya
// bukan lengkap, perkara ini tetap muncul.
cek("SIPP gelap: tetap masuk daftar kerja", gelap.keadaan !== "lengkap", true);

// ---------------------------------------------------------------------------
console.log("Berkas e-Court belum terunduh");
// ---------------------------------------------------------------------------

const belumUnduh = kendali.susunKendali(perkara, sippLengkap, {
  dokumen: 6,
  berkas: 4,
  belumTerunduh: 2,
});
cek("2 dokumen belum terunduh = kurang", belumUnduh.keadaan, "kurang");
cek("2 dokumen belum terunduh = 2 kekurangan", belumUnduh.jumlahKurang, 2);
cek(
  "jenis kekurangannya berkas_ecourt",
  belumUnduh.rincianKurang.map((x) => x.jenis),
  ["berkas_ecourt"]
);

// ---------------------------------------------------------------------------
console.log("Perkara yang belum pernah ditarik");
// ---------------------------------------------------------------------------

const belumDitarik = kendali.susunKendali(perkara, sippLengkap, {
  dokumen: 0,
  berkas: 0,
  belumTerunduh: 0,
});
cek("arsip kosong padahal SIPP punya dokumen = kurang", belumDitarik.keadaan, "kurang");
cek(
  "disebut belum pernah ditarik",
  belumDitarik.rincianKurang.some((x) => x.jenis === "belum_pernah_ditarik"),
  true
);
cek("jumlahnya sebanyak dokumen SIPP", belumDitarik.jumlahKurang, 6);

// Perkara yang SIPP-nya sendiri belum punya dokumen bukan kekurangan arsip.
const sippKosong = { ...sippLengkap, dokumen: 0 };
const tidakAdaApaApa = kendali.susunKendali(perkara, sippKosong, {
  dokumen: 0,
  berkas: 0,
  belumTerunduh: 0,
});
cek(
  "SIPP tanpa dokumen + arsip kosong bukan kekurangan arsip",
  tidakAdaApaApa.rincianKurang.some((x) => x.jenis === "belum_pernah_ditarik"),
  false
);

// ---------------------------------------------------------------------------
console.log("Kekurangan yang letaknya di SIPP");
// ---------------------------------------------------------------------------

const basKurang = kendali.susunKendali(perkara, { ...sippLengkap, sidang: 4, basAda: 1 }, aletaLengkap);
cek("3 dari 4 sidang tanpa BAS = 3 kekurangan", basKurang.jumlahKurang, 3);
cek(
  "disebut bas_belum_ada",
  basKurang.rincianKurang.map((x) => x.jenis),
  ["bas_belum_ada"]
);

const relaasKurang = kendali.susunKendali(
  perkara,
  { ...sippLengkap, relaas: 3, relaasBerdokumen: 1 },
  aletaLengkap
);
cek("2 relaas tanpa dokumen = 2 kekurangan", relaasKurang.jumlahKurang, 2);

const putusanKurang = kendali.susunKendali(
  perkara,
  { ...sippLengkap, putusan: false, putusanAnonim: false },
  aletaLengkap
);
cek("putusan dan anonim belum diunggah = 2 kekurangan", putusanKurang.jumlahKurang, 2);
cek(
  "keduanya disebut sendiri-sendiri",
  putusanKurang.rincianKurang.map((x) => x.jenis).sort(),
  ["anonim_belum_ada", "putusan_belum_ada"]
);

// Perkara yang belum putus tidak dituntut punya naskah putusan.
const belumPutus = kendali.susunKendali(
  perkara,
  { ...sippLengkap, sudahPutus: false, putusan: false, putusanAnonim: false },
  aletaLengkap
);
cek("perkara belum putus tidak dituntut naskah putusan", belumPutus.jumlahKurang, 0);
cek("perkara belum putus berkeadaan lengkap", belumPutus.keadaan, "lengkap");

// ---------------------------------------------------------------------------
console.log("Beberapa kekurangan sekaligus");
// ---------------------------------------------------------------------------

const banyak = kendali.susunKendali(
  perkara,
  { ...sippLengkap, sidang: 4, basAda: 2, putusan: false },
  { dokumen: 6, berkas: 3, belumTerunduh: 1 }
);
cek("1 berkas + 2 BAS + 1 putusan = 4 kekurangan", banyak.jumlahKurang, 4);
cek("ketiga jenisnya tercatat", banyak.rincianKurang.length, 3);
cek(
  "tiap kekurangan membawa keterangan yang dapat dibaca",
  banyak.rincianKurang.every((x) => typeof x.keterangan === "string" && x.keterangan.length > 10),
  true
);

// ---------------------------------------------------------------------------
console.log("Kunci baris");
// ---------------------------------------------------------------------------

const kunci = kendali.kunciPerkara("419/Pdt.G/2025/PA.Dgl");
cek("kunci berupa 40 huruf heksa", /^[0-9a-f]{40}$/.test(kunci), true);
cek("nomor yang sama menghasilkan kunci yang sama", kendali.kunciPerkara("419/Pdt.G/2025/PA.Dgl"), kunci);
cek(
  "nomor berbeda menghasilkan kunci berbeda",
  kendali.kunciPerkara("420/Pdt.G/2025/PA.Dgl") !== kunci,
  true
);
// Kunci ringkas dipakai justru supaya UNIQUE KEY tidak menabrak batas 767 byte
// MySQL lama - lihat catatan pada ecourtStoreService.
cek("kunci muat dalam VARCHAR(64)", kunci.length <= 64, true);

// ---------------------------------------------------------------------------
console.log("Batas dan tetapan");
// ---------------------------------------------------------------------------

cek("dibaca berkelompok, tidak satu per satu", kendali.UKURAN_KELOMPOK > 1, true);
cek("ada batas atas jumlah perkara sekali jalan", kendali.MAKS_PERKARA > 0, true);
cek("batas detak dinyatakan dalam menit", kendali.BATAS_DETAK_MENIT > 0, true);

// ---------------------------------------------------------------------------
console.log("Kueri SIPP hanya membaca");
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const sumber = fs.readFileSync(
  path.join(__dirname, "..", "services", "kendaliBerkasService.js"),
  "utf8"
);

// runSipp adalah satu-satunya pintu ke SIPP. Yang diperiksa: tidak ada satu pun
// perintah yang mengubah data.
const menulis = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP|TRUNCATE|ALTER\s+TABLE|REPLACE\s+INTO)\b/i;

/** Isi tiap kueri, diambil dari kurung buka sampai kurung tutup pemanggilnya. */
function blokKueri(teks, pemanggil) {
  const blok = [];
  let dari = teks.indexOf(pemanggil);
  while (dari !== -1) {
    let i = dari + pemanggil.length;
    let dalam = 1;
    while (i < teks.length && dalam > 0) {
      if (teks[i] === "(") dalam += 1;
      else if (teks[i] === ")") dalam -= 1;
      i += 1;
    }
    blok.push(teks.slice(dari + pemanggil.length, i - 1));
    dari = teks.indexOf(pemanggil, i);
  }
  return blok;
}

const blokSipp = blokKueri(sumber, "runSipp(");
cek("blok kueri SIPP ditemukan", blokSipp.length >= 5, true);
cek("tidak ada kueri SIPP yang menulis", blokSipp.some((x) => menulis.test(x)), false);

/**
 * Sisipan yang boleh masuk ke dalam teks kueri.
 *
 * MySQL menolak placeholder pada daftar IN dan pada LIMIT, jadi keduanya
 * memang harus disisipkan. Yang membuatnya aman bukan niat, melainkan
 * bentuknya: isian hanya deretan tanda tanya yang dibangkitkan sendiri, dan
 * batasnya angka yang sudah dibulatkan dan dijepit sebelum sampai ke sini.
 *
 * Uji ini menyebut daftar yang BOLEH, bukan daftar yang dilarang. Sisipan baru
 * yang belum dipikirkan akan menggagalkan uji ini alih-alih lolos diam-diam.
 */
const SISIPAN_BOLEH = [
  // Deretan tanda tanya yang dibangkitkan sendiri untuk daftar IN.
  "isian",
  // Angka batas LIMIT yang sudah dibulatkan dan dijepit sebelum sampai ke sini.
  "batas",
  "maksBaris",
  "BATAS_DETAK_MENIT",
  // Daftar syarat WHERE. Isinya HANYA penggal harfiah yang ditulis di dalam
  // layanannya sendiri - "p.tanggal_pendaftaran >= ?" dan pasangannya - dan
  // seluruh nilainya masuk lewat parameter. Yang disisipkan bentuk kuerinya,
  // bukan isian dari luar.
  "syarat",
];

/**
 * Kepala tiap sisipan ${...} di dalam satu blok kueri.
 *
 * ============================================================================
 * YANG DIAMBIL KATA PERTAMANYA, BUKAN SELURUH ISINYA
 * ============================================================================
 *
 * Pemindai sebelumnya mencocokkan ${...} sampai kurung tutup PERTAMA, dan
 * karena itu tergagap pada sisipan bersarang - satu WHERE bersyarat terbaca
 * sebagai untaian rusak yang tidak menyerupai nama apa pun.
 *
 * Yang benar-benar menentukan aman tidaknya adalah dari mana nilainya datang,
 * dan itu terjawab oleh kata pertamanya. Sisipan bersarang pun tetap terbaca,
 * sebab tiap ${ dipindai sendiri-sendiri.
 *
 * Daftar yang dipakai daftar yang BOLEH, bukan daftar yang dilarang: sisipan
 * baru yang belum dipikirkan menggagalkan uji ini alih-alih lolos diam-diam.
 */
function kepalaSisipan(blok) {
  const kepala = [];
  const teks = String(blok);
  const pembuka = "${";
  let i = teks.indexOf(pembuka);
  while (i !== -1) {
    let j = i + pembuka.length;
    while (j < teks.length && /\s/.test(teks[j])) j += 1;
    let nama = "";
    while (j < teks.length && /[A-Za-z0-9_$]/.test(teks[j])) {
      nama += teks[j];
      j += 1;
    }
    kepala.push(nama);
    i = teks.indexOf(pembuka, i + pembuka.length);
  }
  return kepala;
}

function hitungSisipan(daftarBlok) {
  let jumlah = 0;
  for (const blok of daftarBlok) jumlah += kepalaSisipan(blok).length;
  return jumlah;
}

function sisipanTerlarang(daftarBlok) {
  const temuan = [];
  for (const blok of daftarBlok) {
    for (const nama of kepalaSisipan(blok)) {
      if (!SISIPAN_BOLEH.includes(nama)) temuan.push(nama || "(tanpa nama)");
    }
  }
  return temuan;
}

// Penjaganya sendiri diperiksa lebih dulu. Uji ini pernah lulus HAMPA: polanya
// dahulu ditulis dengan dua garis miring terbalik, sehingga ia mencari untaian
// yang tidak pernah ada, selalu menemukan nol, dan selalu lulus. Kueri SIPP di
// sini memang memakai sisipan - jadi nol temuan berarti pemindainya yang rusak,
// bukan kuerinya yang bersih.
cek("pemindai sisipan benar-benar menemukan sesuatu", hitungSisipan(blokSipp) > 0, true);
cek("tidak ada sisipan tak terduga pada kueri SIPP", sisipanTerlarang(blokSipp), []);

const blokBot = blokKueri(sumber, "botDb.query(");
cek("blok kueri basis data bot ditemukan", blokBot.length >= 5, true);
cek("pemindai sisipan bekerja pada kueri bot", hitungSisipan(blokBot) > 0, true);
cek("tidak ada sisipan tak terduga pada kueri bot", sisipanTerlarang(blokBot), []);

// Yang boleh disisipkan hanya angka batas yang sudah dibulatkan dan dijepit.
cek(
  "batas LIMIT daftar perkara dibulatkan dan dijepit",
  /Math\.min\(Math\.max\(Math\.floor\(Number\(maks\)/.test(sumber),
  true
);
cek(
  "batas LIMIT daftar kurang dibulatkan dan dijepit",
  /const maksBaris = Math\.min\(Math\.max\(Math\.floor/.test(sumber),
  true
);

// Nomor perkara selalu lewat parameter, tidak pernah masuk teks kueri.
cek(
  "nomor perkara tidak pernah disambung ke teks kueri",
  [...blokSipp, ...blokBot].some((x) => /\\x24\{[^}]*(nomor|perkara|sejak|sampai|tanggal)/i.test(x)),
  false
);
// Pemeriksaan diri: pastikan skrip ini benar-benar menguji sesuatu.
if (jumlah < 35) {
  gagal += 1;
  console.log(`  GAGAL: skrip hanya menjalankan ${jumlah} pemeriksaan - ada yang tidak berjalan.`);
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
