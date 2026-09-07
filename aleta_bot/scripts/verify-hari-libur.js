"use strict";

/**
 * ============================================================================
 * PENJAGA DAFTAR HARI LIBUR
 * ============================================================================
 *
 * Berkas hariLiburService.js adalah SATU-SATUNYA berkas dalam seluruh ALETA
 * yang memang dimaksudkan untuk disunting dengan tangan oleh orang pengadilan,
 * bukan oleh yang menulis kodenya. Tiap tahun, seseorang membuka SKB tiga
 * menteri, mencocokkan tanggalnya, lalu menandai tahun itu sudah disahkan.
 *
 * Justru karena itu ia paling rawan. Salah ketik satu angka pada tanggal
 * Idulfitri tidak menggagalkan apa pun: hitungan hari kerja tetap berjalan,
 * uji tetap hijau, dan angka ketaatan tenggang pemanggilan bergeser diam-diam
 * untuk seluruh juru sita.
 *
 * Penjaga ini memeriksa hal-hal yang tidak dapat dilihat mata saat menyunting:
 * tanggal yang tidak ada di kalender, tahun yang tidak cocok dengan kuncinya,
 * tanggal kembar, dan - yang paling menentukan - tahun yang ditandai SUDAH
 * DISAHKAN tetapi tidak menyebutkan SKB-nya. Pengesahan tanpa nomor SKB tidak
 * dapat ditelusuri siapa pun, dan itu sama saja dengan tidak disahkan.
 */

const H = require("../services/hariLiburService");

let lulus = 0;
let gagal = 0;

function cek(nama, syarat, keterangan) {
  if (syarat) {
    lulus += 1;
    return;
  }
  gagal += 1;
  console.log(`  GAGAL  ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
}

/** Tanggal yang benar-benar ada di kalender, bukan sekadar berbentuk benar. */
function tanggalNyata(teks) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return false;
  const [t, b, h] = teks.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  return (
    d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h
  );
}

console.log("Daftar hari libur nasional dan cuti bersama\n");

const tahun = H.tahunTersedia();
cek("ada tahun yang terdaftar", tahun.length > 0, "daftar hari libur kosong sama sekali");

tahun.forEach((t) => {
  const isi = H.TAHUN[String(t)];
  const daftar = H.daftarTahun(t);

  cek(`${t}: punya larik libur`, Array.isArray(isi.libur));
  cek(
    `${t}: jumlahnya masuk akal`,
    daftar.length >= 10 && daftar.length <= 40,
    `${daftar.length} hari - hari libur nasional beserta cuti bersama biasanya belasan sampai dua puluhan`
  );
  cek(`${t}: penanda disahkan berupa boolean`, typeof isi.disahkan === "boolean");
  cek(
    `${t}: skb kosong atau berupa teks`,
    isi.skb === null || typeof isi.skb === "string"
  );

  // Inilah pemeriksaan yang paling menentukan. Menandai sebuah tahun sudah
  // disahkan tanpa menyebutkan SKB-nya membuat pengesahan itu tidak dapat
  // ditelusuri - dan angka ketaatan yang berdiri di atasnya tidak dapat
  // dipertahankan di hadapan orang yang keberatan.
  cek(
    `${t}: pengesahan menyebutkan SKB-nya`,
    !isi.disahkan || (typeof isi.skb === "string" && isi.skb.trim().length >= 5),
    "tahun ini ditandai sudah disahkan tetapi tidak menyebutkan nomor SKB"
  );

  const terlihat = new Set();
  daftar.forEach(({ tanggal, nama }) => {
    cek(`${t}: ${tanggal} ada di kalender`, tanggalNyata(tanggal), "tanggal tidak ada di kalender");
    cek(
      `${t}: ${tanggal} berada pada tahunnya`,
      tanggal.slice(0, 4) === String(t),
      `tercatat pada tahun ${t}`
    );
    cek(`${t}: ${tanggal} punya nama`, typeof nama === "string" && nama.trim().length >= 4);
    cek(`${t}: ${tanggal} tidak kembar`, !terlihat.has(tanggal), "tanggal ini tertulis dua kali");
    terlihat.add(tanggal);
  });

  const keadaan = H.keadaanTahun(t);
  cek(`${t}: keadaanTahun menyebut ada`, keadaan.ada === true);
  cek(
    `${t}: keadaan yang belum disahkan menyebutkan sebabnya`,
    keadaan.disahkan || (typeof keadaan.sebab === "string" && keadaan.sebab.length > 20),
    "tahun yang belum disahkan wajib menerangkan sebabnya"
  );
  cek(
    `${t}: keadaan yang sudah disahkan tidak menyisakan sebab`,
    !keadaan.disahkan || keadaan.sebab === null
  );
});

/* --------------------------------------------------------------------------
 * hariLibur() - masukan yang aneh dijawab null, bukan sesuatu yang mengejutkan
 * ------------------------------------------------------------------------ */

cek("tanggal yang ada dikenali", H.hariLibur("2026-08-17") !== null);
cek("tanggal biasa dijawab null", H.hariLibur("2026-08-18") === null);
cek("teks kosong dijawab null", H.hariLibur("") === null);
cek("null dijawab null", H.hariLibur(null) === null);
cek("angka dijawab null", H.hariLibur(20260817) === null);
cek("bentuk lain dijawab null", H.hariLibur("17-08-2026") === null);

// Kunci bawaan prototipe pernah menembus dua daftar lain di ALETA - sekali
// mengembalikan amplop palsu, sekali mengembalikan obyek berindeks huruf.
// Peta di sini disusun dengan Object.create(null) dan dibaca dengan
// hasOwnProperty; penjaga ini memastikan keduanya tidak hilang saat disunting.
["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"].forEach((k) => {
  cek(`kunci prototipe "${k}" dijawab null`, H.hariLibur(k) === null);
});

/* --------------------------------------------------------------------------
 * keadaanRentang() - rentang yang melintasi tahun tanpa daftar harus berterus
 * terang, bukan diam-diam menghitung seolah daftarnya lengkap
 * ------------------------------------------------------------------------ */

const jauh = H.keadaanRentang("2019-01-01", "2019-12-31");
cek(
  "tahun tanpa daftar dilaporkan",
  jauh.dapatDipercaya === false && jauh.tahunTanpaDaftar.includes(2019),
  JSON.stringify(jauh)
);
cek(
  "sebab tahun tanpa daftar menyebut Sabtu dan Minggu",
  typeof jauh.sebab === "string" && /Sabtu dan Minggu/.test(jauh.sebab),
  jauh.sebab || "(tanpa sebab)"
);

// Rentang yang melintasi pergantian tahun harus memeriksa KEDUA tahunnya.
//
// Yang diperiksa di sini bukan "2025 dan 2026 belum disahkan" - itu keadaan
// hari ini, dan mengunci keadaan hari ini berarti penjaga ini akan menuduh
// justru pada hari seseorang mengesahkan daftarnya. Yang dikunci: tiap tahun
// dalam rentang harus MUNCUL pada salah satu golongan yang sesuai dengan
// keadaan tahun itu sendiri.
const lintas = H.keadaanRentang("2025-12-01", "2026-01-31");
[2025, 2026].forEach((t) => {
  const k = H.keadaanTahun(t);
  const digolongkan = !k.ada
    ? lintas.tahunTanpaDaftar.includes(t)
    : k.disahkan
      ? !lintas.tahunBelumDisahkan.includes(t) && !lintas.tahunTanpaDaftar.includes(t)
      : lintas.tahunBelumDisahkan.includes(t);
  cek(
    `rentang lintas tahun menggolongkan ${t} sesuai keadaannya`,
    digolongkan,
    `keadaan ${t}: ada=${k.ada} disahkan=${k.disahkan}; rentang: ${JSON.stringify(lintas)}`
  );
});
cek(
  "rentang dipercaya hanya bila seluruh tahunnya disahkan",
  lintas.dapatDipercaya ===
    ([2025, 2026].every((t) => H.keadaanTahun(t).ada && H.keadaanTahun(t).disahkan)),
  JSON.stringify(lintas)
);

const rusak = H.keadaanRentang("bukan tanggal", "2026-01-31");
cek("rentang bertanggal rusak tidak dipercaya", rusak.dapatDipercaya === false);

/* --------------------------------------------------------------------------
 * Sambungannya ke hitungan hari kerja
 * ------------------------------------------------------------------------ */

const P = require("../services/periodePenilaianService");

// 17 Agustus 2026 jatuh pada Senin. Pekan itu karena itu hanya empat hari
// kerja, dan hitungan yang mengabaikannya akan meluluskan relaas yang
// sebenarnya tidak cukup tenggangnya.
const denganLibur = P.hariKerjaAntara("2026-08-14", "2026-08-21");
const tanpaLibur = P.hariKerjaAntara("2026-08-14", "2026-08-21", { tanpaHariLibur: true });
cek(
  "hari kemerdekaan mengurangi hitungan hari kerja",
  denganLibur === tanpaLibur - 1,
  `dengan libur ${denganLibur}, tanpa libur ${tanpaLibur}`
);

const rinci = P.hariKerjaRinci("2026-08-14", "2026-08-21");
cek(
  "rincian menyebut libur yang dilewati",
  Array.isArray(rinci.libur) && rinci.libur.some((l) => l.tanggal === "2026-08-17"),
  JSON.stringify(rinci.libur)
);
// Sama seperti di atas: yang dikunci bukan keadaan hari ini, melainkan bahwa
// rinciannya SETUJU dengan keadaan daftarnya - dan bahwa ketidakpercayaan
// selalu disertai sebab yang dapat dibaca.
const keadaan2026 = H.keadaanTahun(2026);
cek(
  "rincian setuju dengan keadaan daftar tahunnya",
  rinci.dapatDipercaya === (keadaan2026.ada && keadaan2026.disahkan),
  `rincian dapatDipercaya=${rinci.dapatDipercaya}, keadaan 2026 disahkan=${keadaan2026.disahkan}`
);
cek(
  "rincian yang tidak dapat dipercaya menyebutkan sebabnya",
  rinci.dapatDipercaya || typeof rinci.sebabTidakDapatDipercaya === "string",
  "ketidakpercayaan tanpa sebab tidak dapat ditindaklanjuti siapa pun"
);

/* --------------------------------------------------------------------------
 * Sambungannya ke penilaian
 * ------------------------------------------------------------------------ */

const kerangka = require("../services/kerangkaPenilaianService");
const ketaatan = require("../services/penilaianKetaatanService");
ketaatan.daftarkanSemua();

const bergantung = kerangka.daftar().filter((d) => d.pakaiHariKerja);
cek(
  "penilaian yang menghitung hari kerja menyatakannya",
  bergantung.length >= 1 && bergantung.some((d) => d.kunci === "ketaatanTenggangPanggilan"),
  `yang menyatakan: ${bergantung.map((d) => d.kunci).join(", ") || "(tidak ada)"}`
);

// Penilaian yang MENYEBUT hari kerja pada keterangan atau cara hitungnya
// tetapi tidak menyatakan ketergantungannya tidak akan pernah membawa
// peringatan daftar libur ke layar - dan itu persis kekeliruan yang diam.
const lalai = kerangka
  .daftar()
  .filter((d) => !d.pakaiHariKerja)
  .filter((d) =>
    /hari kerja/i.test(`${d.keterangan || ""} ${d.caraHitung ? Object.values(d.caraHitung).join(" ") : ""}`)
  )
  .map((d) => d.kunci);
cek(
  "tidak ada penilaian yang menyebut hari kerja tanpa menyatakannya",
  lalai.length === 0,
  `penilaian ini menyebut hari kerja tetapi tidak berpakaiHariKerja: ${lalai.join(", ")}`
);

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
