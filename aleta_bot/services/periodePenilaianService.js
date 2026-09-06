"use strict";

/**
 * ============================================================================
 * MS01 - MESIN PERIODE TUJUH JENDELA
 * ============================================================================
 *
 * Satu butir penilaian ditulis SEKALI sebagai fungsi berparameter tanggal,
 * lalu dilihat dari tujuh jendela waktu. Tanpa mesin ini, tujuh jendela berarti
 * tujuh salinan kode yang perlahan menyimpang satu sama lain - dan yang
 * menyimpang tidak akan ketahuan, sebab tidak ada yang membandingkan nilai
 * mingguan dengan nilai bulanan.
 *
 * ============================================================================
 * ALMANAK, BUKAN SAAT
 * ============================================================================
 *
 * Seluruh perhitungan di sini memakai TANGGAL ALMANAK ("2026-09-06"), bukan
 * saat (instant). Sebabnya bukan kerapian melainkan kebenaran: pengadilan
 * berada di WITA, sedangkan Date milik Node berpusat pada UTC. Menghitung
 * "hari ini" dengan waktu setempat mesin membuat hasilnya berpindah hari pukul
 * empat sore bila mesinnya kebetulan berzona lain - dan pergeseran itu tidak
 * menimbulkan galat, hanya angka yang salah.
 *
 * Maka tanggal masuk sebagai tulisan, aritmetikanya memakai Date.UTC (yang
 * tidak pernah menyentuh zona mesin), dan keluarannya tulisan lagi. Zona waktu
 * hanya disentuh di satu tempat - `tanggalHariIni()` - dan itu pun dapat
 * digantikan pemanggilnya.
 *
 * ============================================================================
 * NAMA BARIS SELALU BERTANGGAL
 * ============================================================================
 *
 * Cacat yang paling sering muncul pada prototipe: memilih "Mingguan" tetapi
 * yang tampil nama bulan. Di sini tidak mungkin terjadi, sebab nama baris
 * dibuat oleh mesin yang sama yang menghitung batas tanggalnya - bukan diambil
 * dari daftar terpisah yang dipakai apa adanya.
 *
 * Nomor minggu memakai nomor minggu DALAM TAHUN, bukan urutan di dalam jendela
 * yang sedang dilihat. Prototipe memakai urutan jendela ("Minggu I" untuk
 * minggu paling awal yang kebetulan tampil), dan itu berpindah arti setiap kali
 * orang membukanya di hari yang berbeda. Nomor yang berpindah arti tidak boleh
 * ada pada laporan pengadilan.
 */

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
const ROMAWI = ["", "I", "II", "III", "IV"];

/**
 * Tujuh jendela. `lantai` menentukan periode terendah yang boleh menghasilkan
 * NILAI; di bawahnya yang disajikan daftar kerja, bukan angka.
 */
const PERIODE = [
  { jenis: "harian", label: "Harian", satuan: "hari", tingkat: 0, banyak: 7 },
  { jenis: "mingguan", label: "Mingguan", satuan: "minggu", tingkat: 1, banyak: 8 },
  { jenis: "bulanan", label: "Bulanan", satuan: "bulan", tingkat: 2, banyak: 12 },
  { jenis: "triwulan", label: "Triwulan", satuan: "triwulan", tingkat: 3, banyak: 8 },
  { jenis: "semester", label: "Semester", satuan: "semester", tingkat: 4, banyak: 6 },
  { jenis: "tahunan", label: "Tahunan", satuan: "tahun", tingkat: 5, banyak: 5 },
  { jenis: "keseluruhan", label: "Keseluruhan", satuan: "tahun", tingkat: 6, banyak: 0 },
];

const PETA_PERIODE = Object.assign(Object.create(null), Object.fromEntries(PERIODE.map((p) => [p.jenis, p])));

/** Lantai yang boleh dipakai sebuah penilaian, beserta tingkatnya. */
const LANTAI = Object.assign(Object.create(null), {
  harian: 0,
  mingguan: 1,
  bulanan: 2,
  triwulan: 3,
});

/**
 * Penyebut serendah ini tidak boleh menghasilkan nilai.
 *
 * Pengadilan ini menerima sekitar tujuh puluh perkara sebulan. Bila ketaatan
 * dihitung harian, satu perkara terlambat pada hari yang hanya berisi tiga
 * perkara langsung menjatuhkan nilai menjadi 67 persen - bukan karena
 * kinerjanya buruk, melainkan karena penyebutnya kecil.
 */
const CUKUP_PENYEBUT = 20;

/* ==========================================================================
 * Almanak
 * ========================================================================== */

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;

function uraikan(tanggal) {
  const cocok = POLA_TANGGAL.exec(String(tanggal || "").trim());
  if (!cocok) throw new Error(`Tanggal harus berbentuk YYYY-MM-DD, dapat: ${tanggal}`);
  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);
  if (bulan < 1 || bulan > 12) throw new Error(`Bulan di luar jangkauan: ${tanggal}`);
  const stempel = Date.UTC(tahun, bulan - 1, hari);
  const kembali = new Date(stempel);
  // Menolak 31 Februari dan sebangsanya: Date memuainya menjadi 3 Maret tanpa
  // mengeluh, dan tanggal yang diam-diam bergeser jauh lebih buruk daripada
  // tanggal yang ditolak.
  if (
    kembali.getUTCFullYear() !== tahun ||
    kembali.getUTCMonth() !== bulan - 1 ||
    kembali.getUTCDate() !== hari
  ) {
    throw new Error(`Tanggal tidak ada pada almanak: ${tanggal}`);
  }
  return stempel;
}

function tulis(stempel) {
  const d = new Date(stempel);
  const b = String(d.getUTCMonth() + 1).padStart(2, "0");
  const h = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${b}-${h}`;
}

const SEHARI = 24 * 60 * 60 * 1000;

function tambahHari(tanggal, n) {
  return tulis(uraikan(tanggal) + n * SEHARI);
}

function bagian(tanggal) {
  const d = new Date(uraikan(tanggal));
  return {
    tahun: d.getUTCFullYear(),
    bulan: d.getUTCMonth() + 1,
    hari: d.getUTCDate(),
    // 0 Minggu .. 6 Sabtu
    hariPekan: d.getUTCDay(),
  };
}

function awalBulan(tahun, bulan) {
  return tulis(Date.UTC(tahun, bulan - 1, 1));
}

function akhirBulan(tahun, bulan) {
  // Hari ke-0 bulan berikutnya adalah hari terakhir bulan ini - benar pula
  // untuk Februari pada tahun kabisat.
  return tulis(Date.UTC(tahun, bulan, 0));
}

/**
 * ============================================================================
 * HARI KERJA - DAN MENGAPA IA TIDAK SAMA DENGAN HARI KALENDER
 * ============================================================================
 *
 * Pasal 122 HIR menuntut panggilan disampaikan dalam "tenggang waktu yang
 * patut", dan yang dipakai selama ini tiga hari. Pertanyaan yang menentukan:
 * tiga hari KALENDER atau tiga hari KERJA?
 *
 * Selisihnya bukan main-main. Relaas yang disampaikan Jumat untuk sidang Senin
 * berjarak tiga hari kalender - lulus menurut hitungan kalender - tetapi hanya
 * SATU hari kerja. Pihak yang menerimanya praktis tidak punya kesempatan
 * menyiapkan diri, dan itulah yang hendak dilindungi pasal tersebut.
 *
 * Kueri yang berjalan pada analisis lama memakai DATEDIFF, yaitu hari
 * kalender. Penilaian di sini menghitung KEDUANYA dan menyimpan keduanya,
 * sehingga:
 *
 *   - selisih antara keduanya terlihat, tidak tersembunyi;
 *   - penyandingan dengan angka lama dapat menjelaskan sebab selisihnya;
 *   - pengadilan dapat memutuskan mana yang berlaku, dan keputusannya tercatat
 *     sebagai ambang - bukan terkubur di dalam kode.
 *
 * HARI LIBUR NASIONAL BELUM DIPERHITUNGKAN. Yang dikecualikan baru Sabtu dan
 * Minggu. Itu disebutkan terus terang: penilaian yang mengaku menghitung hari
 * kerja padahal mengabaikan libur bersama Idulfitri akan menuduh juru sita
 * yang justru tidak dapat bekerja. Daftar hari libur harus dimasukkan sebelum
 * angka ini dipakai membina.
 */
function hariKerjaAntara(mulai, selesai) {
  const a = uraikan(mulai);
  const b = uraikan(selesai);
  if (b <= a) return 0;
  let jumlah = 0;
  for (let t = a + SEHARI; t <= b; t += SEHARI) {
    const hari = new Date(t).getUTCDay();
    if (hari !== 0 && hari !== 6) jumlah += 1;
  }
  return jumlah;
}

/** Selisih hari kalender - bentuk yang dipakai analisis lama. */
function hariKalenderAntara(mulai, selesai) {
  return Math.round((uraikan(selesai) - uraikan(mulai)) / SEHARI);
}

/** Senin pada pekan yang memuat tanggal ini. Pekan pengadilan mulai Senin. */
function awalPekan(tanggal) {
  const { hariPekan } = bagian(tanggal);
  const mundur = hariPekan === 0 ? 6 : hariPekan - 1;
  return tambahHari(tanggal, -mundur);
}

/**
 * Nomor pekan dalam tahun menurut ISO 8601: pekan mulai Senin, dan pekan ke-1
 * adalah pekan yang memuat hari Kamis pertama.
 *
 * Dipakai supaya nomornya tidak berpindah arti. Aturan Kamis itu juga yang
 * membuat 29 Desember dapat berada pada pekan ke-1 tahun berikutnya, dan itu
 * benar - bukan cacat.
 */
function nomorPekan(tanggal) {
  const senin = awalPekan(tanggal);
  const kamis = tambahHari(senin, 3);
  const { tahun } = bagian(kamis);
  const seninPertama = awalPekan(`${tahun}-01-04`); // 4 Januari selalu ada di pekan ke-1
  const selisih = Math.round((uraikan(senin) - uraikan(seninPertama)) / (7 * SEHARI));
  return { nomor: selisih + 1, tahun };
}

function namaHari(tanggal) {
  return HARI[bagian(tanggal).hariPekan];
}

function tanggalTerbaca(tanggal) {
  const { tahun, bulan, hari } = bagian(tanggal);
  return `${hari} ${BULAN[bulan - 1]} ${tahun}`;
}

/**
 * Rentang tanggal yang tidak mengulang keterangan yang sama dua kali:
 *   13–19 Juli 2026            (sebulan, setahun)
 *   27 Juli–2 Agustus 2026     (beda bulan, setahun)
 *   29 Desember 2025–4 Januari 2026 (beda tahun)
 */
function rentangTerbaca(mulai, selesai) {
  const a = bagian(mulai);
  const b = bagian(selesai);
  if (a.tahun !== b.tahun) {
    return `${a.hari} ${BULAN[a.bulan - 1]} ${a.tahun}–${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`;
  }
  if (a.bulan !== b.bulan) {
    return `${a.hari} ${BULAN[a.bulan - 1]}–${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`;
  }
  return `${a.hari}–${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`;
}

/* ==========================================================================
 * Satuan tiap jendela
 * ========================================================================== */

function satuanHarian(acuan, banyak) {
  const unit = [];
  for (let i = banyak - 1; i >= 0; i -= 1) {
    const hari = tambahHari(acuan, -i);
    unit.push({
      kunci: hari,
      label: `${namaHari(hari)}, ${tanggalTerbaca(hari)}`,
      mulai: hari,
      selesai: hari,
    });
  }
  return unit;
}

function satuanMingguan(acuan, banyak) {
  const unit = [];
  const seninIni = awalPekan(acuan);
  for (let i = banyak - 1; i >= 0; i -= 1) {
    const mulai = tambahHari(seninIni, -7 * i);
    const selesai = tambahHari(mulai, 6);
    const { nomor, tahun } = nomorPekan(mulai);
    unit.push({
      kunci: `${tahun}-W${String(nomor).padStart(2, "0")}`,
      label: `Minggu ke-${nomor} · ${rentangTerbaca(mulai, selesai)}`,
      mulai,
      selesai,
    });
  }
  return unit;
}

function satuanBulanan(acuan, banyak) {
  const { tahun, bulan } = bagian(acuan);
  const unit = [];
  for (let i = banyak - 1; i >= 0; i -= 1) {
    const geser = bulan - 1 - i;
    const t = tahun + Math.floor(geser / 12);
    const b = ((geser % 12) + 12) % 12 + 1;
    unit.push({
      kunci: `${t}-${String(b).padStart(2, "0")}`,
      label: `${BULAN[b - 1]} ${t}`,
      mulai: awalBulan(t, b),
      selesai: akhirBulan(t, b),
    });
  }
  return unit;
}

function satuanTriwulan(acuan, banyak) {
  const { tahun, bulan } = bagian(acuan);
  const triwulanIni = Math.ceil(bulan / 3);
  const unit = [];
  for (let i = banyak - 1; i >= 0; i -= 1) {
    const geser = tahun * 4 + (triwulanIni - 1) - i;
    const t = Math.floor(geser / 4);
    const tw = (geser % 4) + 1;
    const bulanMulai = (tw - 1) * 3 + 1;
    unit.push({
      kunci: `${t}-TW${tw}`,
      label: `Triwulan ${ROMAWI[tw]} ${t} · ${BULAN_PENDEK[bulanMulai - 1]}–${BULAN_PENDEK[bulanMulai + 1]}`,
      mulai: awalBulan(t, bulanMulai),
      selesai: akhirBulan(t, bulanMulai + 2),
    });
  }
  return unit;
}

function satuanSemester(acuan, banyak) {
  const { tahun, bulan } = bagian(acuan);
  const semesterIni = bulan <= 6 ? 1 : 2;
  const unit = [];
  for (let i = banyak - 1; i >= 0; i -= 1) {
    const geser = tahun * 2 + (semesterIni - 1) - i;
    const t = Math.floor(geser / 2);
    const sm = (geser % 2) + 1;
    const bulanMulai = sm === 1 ? 1 : 7;
    unit.push({
      kunci: `${t}-S${sm}`,
      label: `Semester ${ROMAWI[sm]} ${t} · ${BULAN_PENDEK[bulanMulai - 1]}–${BULAN_PENDEK[bulanMulai + 4]}`,
      mulai: awalBulan(t, bulanMulai),
      selesai: akhirBulan(t, bulanMulai + 5),
    });
  }
  return unit;
}

function satuanTahunan(acuan, banyak) {
  const { tahun } = bagian(acuan);
  const unit = [];
  for (let i = banyak - 1; i >= 0; i -= 1) {
    const t = tahun - i;
    unit.push({
      kunci: String(t),
      label: `Tahun ${t} · Jan–Des`,
      mulai: awalBulan(t, 1),
      selesai: akhirBulan(t, 12),
    });
  }
  return unit;
}

/**
 * Keseluruhan riwayat: dari tahun paling awal yang ada datanya sampai tahun
 * berjalan. Tahun awalnya diserahkan pemanggil, sebab hanya SIPP yang tahu
 * sejak kapan perkara tercatat - menebaknya di sini akan membuat baris kosong
 * bertahun-tahun yang terbaca seperti pengadilan tidak bekerja.
 */
function satuanKeseluruhan(acuan, tahunAwal) {
  const { tahun } = bagian(acuan);
  const awal = Number(tahunAwal) || tahun - 11;
  const unit = [];
  for (let t = awal; t <= tahun; t += 1) {
    unit.push({
      kunci: String(t),
      label: `Tahun ${t}`,
      mulai: awalBulan(t, 1),
      selesai: akhirBulan(t, 12),
    });
  }
  return unit;
}

const PEMBUAT = Object.assign(Object.create(null), {
  harian: (acuan, p, opsi) => satuanHarian(acuan, opsi.banyak || p.banyak),
  mingguan: (acuan, p, opsi) => satuanMingguan(acuan, opsi.banyak || p.banyak),
  bulanan: (acuan, p, opsi) => satuanBulanan(acuan, opsi.banyak || p.banyak),
  triwulan: (acuan, p, opsi) => satuanTriwulan(acuan, opsi.banyak || p.banyak),
  semester: (acuan, p, opsi) => satuanSemester(acuan, opsi.banyak || p.banyak),
  tahunan: (acuan, p, opsi) => satuanTahunan(acuan, opsi.banyak || p.banyak),
  keseluruhan: (acuan, p, opsi) => satuanKeseluruhan(acuan, opsi.tahunAwal),
});

/**
 * Satuan baris untuk sebuah jendela.
 *
 * @param {string} jenis  salah satu dari tujuh jendela
 * @param {string} acuan  tanggal almanak "hari ini", YYYY-MM-DD
 * @param {object} opsi   { banyak, tahunAwal }
 */
function satuanPeriode(jenis, acuan, opsi = {}) {
  const p = Object.prototype.hasOwnProperty.call(PETA_PERIODE, jenis) ? PETA_PERIODE[jenis] : null;
  if (!p) throw new Error(`Jendela periode tidak dikenali: ${jenis}`);
  const pembuat = PEMBUAT[jenis];
  const unit = pembuat(acuan, p, opsi || {});
  return {
    jenis: p.jenis,
    label: p.label,
    satuan: p.satuan,
    tingkat: p.tingkat,
    banyak: unit.length,
    unit,
  };
}

/** Apakah jendela ini berada DI BAWAH lantai sebuah penilaian? */
function dibawahLantai(lantai, jenisPeriode) {
  const p = Object.prototype.hasOwnProperty.call(PETA_PERIODE, jenisPeriode) ? PETA_PERIODE[jenisPeriode] : null;
  if (!p) throw new Error(`Jendela periode tidak dikenali: ${jenisPeriode}`);
  const batas = Object.prototype.hasOwnProperty.call(LANTAI, lantai) ? LANTAI[lantai] : null;
  if (batas === null) throw new Error(`Lantai tidak dikenali: ${lantai}`);
  return p.tingkat < batas;
}

/**
 * MS05 - nilai hanya keluar bila penyebutnya cukup.
 *
 * Memulangkan `nilai: null` beserta sebabnya, bukan nol. Nol terbaca sebagai
 * "buruk sekali"; null terbaca sebagai "belum dapat dinilai", dan keduanya
 * jauh berbeda artinya bagi orang yang namanya tertulis di sebelahnya.
 */
function nilaiDenganPembatas(terpenuhi, penyebut, batas = CUKUP_PENYEBUT) {
  const a = Number(terpenuhi);
  const b = Number(penyebut);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < 0 || a < 0) {
    return { nilai: null, cukup: false, sebab: "angka penyusunnya tidak sah" };
  }
  if (a > b) {
    return { nilai: null, cukup: false, sebab: "yang terpenuhi melebihi penyebutnya" };
  }
  if (b < batas) {
    return {
      nilai: null,
      cukup: false,
      penyebut: b,
      sebab: `penyebutnya ${b}, di bawah ${batas} - yang tampil daftarnya, bukan nilainya`,
    };
  }
  return { nilai: +((a / b) * 100).toFixed(1), cukup: true, penyebut: b };
}

/**
 * Tanggal almanak hari ini menurut zona pengadilan.
 *
 * Satu-satunya tempat di berkas ini yang menyentuh waktu berjalan. Zonanya
 * ditulis tegas, bukan mengikuti zona mesin: mesin pengembang berzona lain,
 * dan hasil yang berpindah hari pukul empat sore tidak menimbulkan galat -
 * hanya angka yang salah.
 */
function tanggalHariIni(zona = "Asia/Makassar", sekarang = new Date()) {
  const bagianZona = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sekarang);
  return bagianZona; // en-CA memberi YYYY-MM-DD
}

module.exports = {
  PERIODE,
  LANTAI,
  CUKUP_PENYEBUT,
  BULAN,
  HARI,
  satuanPeriode,
  dibawahLantai,
  nilaiDenganPembatas,
  tanggalHariIni,
  // Diekspor untuk diuji satuan.
  tambahHari,
  hariKerjaAntara,
  hariKalenderAntara,
  awalPekan,
  nomorPekan,
  awalBulan,
  akhirBulan,
  rentangTerbaca,
  tanggalTerbaca,
};
