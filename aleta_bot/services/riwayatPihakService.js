"use strict";

/**
 * ============================================================================
 * RIWAYAT PARA PIHAK - PERNAH CERAI BERAKTA, DAN PERKARA LAIN ORANG YANG SAMA
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026: pada bagian Para pihak di Status
 * Perkara, beri penanda pada nama pihak yang sudah bercerai LEBIH DARI SEKALI
 * - dan menekan angkanya memunculkan nomor perkaranya - serta pada pihak yang
 * perkaranya BERKAITAN dengan perkara lain (cerai dikabulkan, lalu ia
 * mendaftar harta bersama).
 *
 * Dua ketentuan dari pengguna yang menentukan bentuk berkas ini:
 *
 *   1. "Perkara cerai yang keluar akta cerai baru bisa dianggap pernah cerai."
 *      Perkara cerai yang dicabut, gugur, ditolak, atau belum berakta TIDAK
 *      dihitung - termasuk perkara ini sendiri bila aktanya belum terbit.
 *
 *   2. Penanda "pernah cerai" yang keliru merugikan orang. Karena itu orang
 *      yang sama dikenali BERTINGKAT, tingkatnya disebut pada tiap temuan, dan
 *      NAMA SAJA TIDAK PERNAH DIPAKAI.
 *
 * Seluruh kueri di berkas ini SELECT. Tidak ada satu pun tulisan ke SIPP, dan
 * tidak ada indeks yang ditambahkan - menambah indeks pada tabel SIPP adalah
 * perubahan skema milik satker, bukan milik alat yang menumpang membacanya.
 *
 * ============================================================================
 * DIUKUR DULU, BARU DIPILIH ATURANNYA - sipp_donggala, 27 September 2026
 * ============================================================================
 *
 * 20.156 baris pihak pertama/kedua (bukan saksi, bukan kuasa):
 *
 *     NIK 16 angka         8.882   44,1%   (2015-2019: 0-30%; 2023-2026: 85-93%)
 *     NIK sah (di bawah)   8.827   43,8%
 *     tanggal lahir       18.736   93,0%
 *     pihak_id dipakai ulang lintas perkara: jarang - 14.289 baris pihak
 *     pertama memakai 14.239 pihak_id berbeda.
 *
 * Tiap tingkat lalu diukur SENDIRI-SENDIRI atas seluruh pasangan kemunculan
 * (orang yang sama? di dua perkara berbeda, pihak_id berbeda):
 *
 *   NAMA SAJA        792 pasangan; 702 dapat diuji tanggal lahirnya dan 257 di
 *                    antaranya (36,6%) BERTANGGAL LAHIR BEDA. Sepertiga
 *                    "orang yang sama" menurut nama ternyata orang lain -
 *                    inilah sebabnya nama saja ditolak.
 *
 *   NIK SAMA         476 pasangan; 61 di antaranya nama DAN tanggal lahirnya
 *                    berbeda. NIK disalin antarpihak: perkara 106/Pdt.G/2023
 *                    mencatat SEMBILAN orang berbeda dengan satu NIK, dan tiga
 *                    pemohon isbat 2017 yang tak bersaudara berbagi satu NIK.
 *                    NIK karena itu hanya dipercaya bila tidak ada yang
 *                    membantahnya - lihat nikTercemar() dan tingkatOrang().
 *
 *   NAMA + LAHIR     451 pasangan; 290 dapat diuji NIK-nya, 10 berbeda (sebagian
 *                    besar salah ketik satu angka). Dipakai, dengan NIK yang
 *                    berbeda sebagai pembantah.
 *
 *   PASANGAN NAMA    kedua pihak perkara ini muncul BERSAMA di perkara lain.
 *                    1.414 dapat diuji tanggal lahirnya, 214 (15,1%) berbeda -
 *                    diperiksa satu per satu: tanggal pengganti di perkara lama,
 *                    mis. 612/Pdt.P/2017 mengetik 1994-03-05 untuk SUAMI DAN
 *                    ISTRI, dan 135/Pdt.G/2021 memberi keduanya tanggal 03-03.
 *                    Karena itu tanggal lahir yang berbeda TIDAK membatalkan
 *                    tingkat ini, tetapi DISEBUT pada temuannya.
 *
 * Tanggal lahir yang tersandi di NIK (angka 7-12) sempat ditimbang sebagai
 * penyaring NIK salinan, lalu ditinggalkan: hanya 6.263 dari 8.748 (71,6%)
 * yang cocok, sebab Dukcapil kerap memberi tanggal pengganti (01-07-YY).
 *
 * `perkara_akta_cerai.perceraian_ke` juga TIDAK dipakai: 4.496 dari 4.607
 * barisnya bernilai 1 - termasuk cerai kedua orang yang sama (275/Pdt.G/2026).
 *
 * ============================================================================
 * INDEKS - YANG ADA DAN YANG TIDAK, DAN RENCANA KUERI YANG TERUKUR
 * ============================================================================
 *
 *   pihak                PRIMARY(id), nama. TIDAK ada indeks nomor_indentitas
 *                        maupun tanggal_lahir.
 *   perkara_pihak1/2     perkara_id, pihak_id, nama berindeks.
 *   perkara              PRIMARY(perkara_id), nomor_perkara unik.
 *   perkara_putusan      PRIMARY(perkara_id, tanggal_putusan).
 *   perkara_akta_cerai   PRIMARY(perkara_id).
 *
 * EXPLAIN atas kueri yang SUNGGUH dikirim berkas ini (ditangkap saat
 * berjalan, sipp_donggala):
 *
 *   perkara ini          const(nomor_perkara) / PRIMARY
 *   pihak perkara ini    ref(perkara_id) + eq_ref(PRIMARY)
 *   NIK                  ALL - pemindaian penuh `pihak`: kolomnya tidak
 *                        berindeks. SATU-SATUNYA, sekali untuk seluruh pihak,
 *                        dan dilewati bila tidak ada NIK sah.
 *   nama                 index(nama), menutup - hanya indeksnya yang dibaca
 *   rincian senama       range(PRIMARY)
 *   kemunculan           range(pihak_id), menutup
 *   keterangan, akta     range(PRIMARY) + ref/eq_ref
 *
 * Waktu tempuh atas 45 perkara (40 acak tetap + 5 contoh), di laptop dengan
 * innodb_buffer_pool_size 16 MB dan agen lain sedang bekerja: tengah 615 ms,
 * p90 1.105 ms, terlama 1.248 ms; langkah NIK tengah 370 ms. Tabel `pihak`
 * hanya 7,5 MB - di peladen yang penyangganya memuat tabel itu, pemindaian
 * NIK tidak lagi menyentuh cakram.
 */

const db = require("../db_config");
const sippSkemaService = require("./sippSkemaService");
const { sebutanSatuPihak, perkaraPermohonan } = require("./sebutanPihakService");

function kueri(sql, nilai = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, nilai, (galat, hasil) => (galat ? gagal(galat) : selesai(Array.isArray(hasil) ? hasil : [])));
  });
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).replace(/\s+/g, " ").trim();
}

/** Tanggal "YYYY-MM-DD", atau "" untuk yang kosong dan tanggal nol SIPP (0000-00-00, 1900-01-01). */
function tanggalIso(nilai) {
  if (!nilai) return "";
  let teks = "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    teks = `${nilai.getFullYear()}-${b}-${h}`;
  } else {
    const cocok = /^(\d{4}-\d{2}-\d{2})/.exec(String(nilai).trim());
    teks = cocok ? cocok[1] : "";
  }
  return teks > "1900-01-01" ? teks : "";
}

function jenisKelamin(nilai) {
  const teks = bersih(nilai).toUpperCase();
  return teks === "L" || teks === "P" ? teks : "";
}

// ============================================================================
// NAMA DIBAKUKAN
// ============================================================================
//
// Yang dibuang hanya yang TERBUKTI bukan bagian nama. Diukur atas 20.156 nama
// pihak: token bertitik terbanyak adalah MOH. (462), ABD. (273), HI. (157),
// H. (109), M. (103), DG. (89), MUH. (80) - SINGKATAN NAMA, bukan gelar - baru
// kemudian S.PD (64), S.SOS (32), S.H (13), A.MD (12), M.PD (8).
//
// Pola umum "huruf-titik-huruf" karena itu TIDAK dipakai: ia membuang "M.
// SAID" dan "A. RAHMAN" seolah gelar, lalu dua orang berbeda menjadi sama.
// Yang dibuang hanya gelar dari daftar tertutup di bawah; ST. sengaja tidak
// termasuk sebab di sini ia singkatan SITI.

/** Gelar akademik, ditulis tanpa titik - dibuang bila tokennya bertitik. */
const GELAR_BERTITIK = new Set([
  "SPD", "SPDI", "SPDSD", "SSOS", "SH", "SHI", "SAG", "SE", "ST", "SKOM", "SIP", "SKEP", "SKM", "SST", "SSI",
  "SHUT", "SPSI", "STP", "SPT", "SIKOM", "SAK", "SAP", "SFARM", "SGZ", "STR", "SKED", "SKEB", "SSY",
  "SHUM", "SS", "MPD", "MPDI", "MH", "MHI", "MSI", "MAG", "MM", "MKES", "MKN", "MHUM", "MSC", "AMD",
  "AMDKEP", "AMDKEB", "AMK", "AMA", "AMAPD", "DRS", "DRA", "DR", "IR", "PROF", "BSC", "LLM", "MBA",
]);
/** Gelar yang juga kerap ditulis tanpa titik - dibuang bila BUKAN kata pertama. */
const GELAR_TANPA_TITIK = new Set([
  "SPD", "SPDI", "SH", "SHI", "SAG", "SSOS", "SKOM", "SKEP", "SKM", "MPD", "MH", "MSI", "MAG", "AMD",
]);
/** Sapaan - dibuang di mana pun, asal masih tersisa kata lain. */
const SAPAAN = new Set(["H", "HJ", "HI", "HAJI", "HAJJAH", "KH", "DR", "DRS", "DRA", "IR", "PROF", "UST", "USTADZ"]);

/**
 * Nama baku: huruf besar, tanpa gelar, tanpa sapaan, tanpa tanda baca.
 *
 * @returns {{ teks: string, kunci: string, kata: string[] }} teks berspasi,
 *   kunci TANPA spasi (NUR AINI = NURAINI - pemisahan kata tidak konsisten
 *   antarperkara), dan daftar katanya.
 */
function bakuNama(nama) {
  let teks = String(nama === null || nama === undefined ? "" : nama)
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’'`´]/g, "");
  // Yang sesudah koma hampir selalu gelar: "BUDI, S.H., M.H.".
  teks = teks.split(",")[0];

  const kata = [];
  teks
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token, urutan) => {
      const huruf = token.replace(/[^A-Z]/g, "");
      if (!huruf) return;
      if (token.includes(".") && GELAR_BERTITIK.has(huruf) && !/^ST\.?$/.test(token)) return;
      if (urutan > 0 && !token.includes(".") && GELAR_TANPA_TITIK.has(huruf)) return;
      // "ABD.RAHMAN" dan "ABD. RAHMAN" menjadi dua kata yang sama.
      for (const bagian of token.split(/[.\-/()]+/)) {
        const bersihKata = bagian.replace(/[^A-Z0-9]/g, "");
        if (bersihKata) kata.push(bersihKata === "BT" ? "BINTI" : bersihKata === "BN" ? "BIN" : bersihKata);
      }
    });

  const inti = kata.filter((k) => !SAPAAN.has(k));
  const akhir = inti.length > 0 ? inti : kata;
  return { teks: akhir.join(" "), kunci: akhir.join(""), kata: akhir };
}

// ============================================================================
// NIK YANG SAH - BENTUKNYA, BUKAN SEKADAR PANJANGNYA
// ============================================================================

const DERET_NAIK = "01234567890123456789012345";
const DERET_TURUN = "98765432109876543210987654";

/**
 * NIK yang sah, atau "" bila bentuknya tidak mungkin NIK sungguhan.
 *
 * 16 angka; bukan satu angka berulang; bukan deret; kode provinsi 11-94 dan
 * kode kabupaten/kecamatan bukan 00; tanggal lahir tersandi masuk akal (hari
 * 01-31, atau 41-71 untuk perempuan; bulan 01-12); nomor urut bukan 0000; dan
 * tidak berisi enam nol beruntun sesudah kode wilayah - bentuk isian dummy
 * seperti 7203010000000000.
 */
function nikSah(nilai) {
  const t = String(nilai === null || nilai === undefined ? "" : nilai).replace(/\s+/g, "");
  if (!/^\d{16}$/.test(t)) return "";
  if (/^(\d)\1+$/.test(t)) return "";
  if (DERET_NAIK.includes(t) || DERET_TURUN.includes(t)) return "";
  const provinsi = Number(t.slice(0, 2));
  if (provinsi < 11 || provinsi > 94) return "";
  if (t.slice(2, 4) === "00" || t.slice(4, 6) === "00") return "";
  const hari = Number(t.slice(6, 8));
  const bulan = Number(t.slice(8, 10));
  if (!((hari >= 1 && hari <= 31) || (hari >= 41 && hari <= 71))) return "";
  if (bulan < 1 || bulan > 12) return "";
  if (t.slice(12) === "0000") return "";
  if (/0{6,}/.test(t.slice(6))) return "";
  return t;
}

/** Satu baris pihak dalam bentuk yang dibandingkan. NIK dan tanggal lahir TIDAK pernah keluar dari berkas ini. */
function orangDari(baris) {
  const nama = bakuNama(baris.nama || baris.namaPerkara);
  const namaPerkara = bakuNama(baris.namaPerkara || baris.nama);
  return {
    pihakId: Number(baris.pihakId) || 0,
    perkaraId: Number(baris.perkaraId) || 0,
    pihakKe: Number(baris.pihakKe) || 0,
    namaTampil: bersih(baris.namaPerkara || baris.nama),
    nama,
    namaPerkara,
    nik: nikSah(baris.nik),
    lahir: tanggalIso(baris.lahir),
    jk: jenisKelamin(baris.jk),
  };
}

// ============================================================================
// PEMBANTAH - YANG MEMBUKTIKAN DUA BARIS BUKAN ORANG YANG SAMA
// ============================================================================

/**
 * Sebab dua baris TIDAK mungkin orang yang sama, atau "" bila tidak ada.
 *
 * Dua NIK sah yang berbeda, atau jenis kelamin yang berbeda. Tanggal lahir
 * sengaja tidak di sini - lihat lahirBerbeda().
 */
function bertentangan(a, b) {
  if (a.nik && b.nik && a.nik !== b.nik) return "NIK berbeda";
  if (a.jk && b.jk && a.jk !== b.jk) return "jenis kelamin berbeda";
  return "";
}

function lahirBerbeda(a, b) {
  return Boolean(a.lahir && b.lahir && a.lahir !== b.lahir);
}

function kataDepan(orang) {
  return (orang.nama.kata && orang.nama.kata[0]) || "";
}

/** Nama yang cukup mirip untuk menguatkan NIK: kunci sama, atau kata pertamanya sama. */
function namaMenguatkan(a, b) {
  if (!a.nama.kunci || !b.nama.kunci) return false;
  return a.nama.kunci === b.nama.kunci || (kataDepan(a) !== "" && kataDepan(a) === kataDepan(b));
}

/**
 * NIK yang dipakai orang-orang yang TERBUKTI berbeda.
 *
 * Dua baris ber-NIK sama dianggap orang berbeda bila jenis kelaminnya berbeda,
 * atau tanggal lahir DAN kata pertama namanya sama-sama berbeda. Terukur 106
 * NIK sah di sipp_donggala. NIK seperti itu tidak dipakai mencocokkan SIAPA
 * PUN - termasuk baris yang tanggal lahirnya kosong, yang tanpa pemeriksaan
 * ini akan tersambung ke dua orang sekaligus.
 */
function nikTercemar(daftarOrang) {
  const perNik = new Map();
  for (const orang of daftarOrang) {
    if (!orang.nik) continue;
    if (!perNik.has(orang.nik)) perNik.set(orang.nik, []);
    const daftar = perNik.get(orang.nik);
    if (!daftar.some((x) => x.pihakId === orang.pihakId)) daftar.push(orang);
  }
  const hasil = new Set();
  for (const [nik, daftar] of perNik) {
    luar: for (let i = 0; i < daftar.length; i += 1) {
      for (let j = i + 1; j < daftar.length; j += 1) {
        const a = daftar[i];
        const b = daftar[j];
        const jkBeda = a.jk && b.jk && a.jk !== b.jk;
        const orangLain = lahirBerbeda(a, b) && kataDepan(a) !== kataDepan(b);
        if (jkBeda || orangLain) {
          hasil.add(nik);
          break luar;
        }
      }
    }
  }
  return hasil;
}

/** Tanggal yang lazim dipakai sebagai pengganti tanggal lahir yang tidak diketahui. */
function tanggalPengganti(iso) {
  return /-(01-01|07-01|12-31)$/.test(String(iso || ""));
}

// ============================================================================
// TIGA TINGKAT PERTAMA - ANTARBARIS TABEL `pihak`
// ============================================================================

/** Urutan kekuatan: yang lebih kecil lebih pasti. */
const PERINGKAT = { perkara_ini: -1, pihak_id: 0, nik: 1, nama_lahir: 2, pasangan: 3 };

/**
 * Apakah `calon` (satu baris tabel pihak) orang yang sama dengan `asal`
 * (pihak perkara ini), dan lewat tingkat apa.
 *
 *   pihak_id     baris SIPP yang sama - SIPP sendiri yang menyambungnya.
 *   nik          NIK sah yang sama, NIK-nya tidak tercemar, tidak ada
 *                pembantah (NIK/jenis kelamin), tanggal lahir TIDAK berbeda,
 *                DAN dikuatkan tanggal lahir yang sama atau nama yang mirip.
 *   nama_lahir   nama baku sama DAN tanggal lahir sama (keduanya ada), tidak
 *                ada pembantah. Nama satu kata dengan tanggal pengganti
 *                (1 Januari, 1 Juli, 31 Desember) terlalu lemah dan ditolak.
 *
 * NAMA SAJA TIDAK PERNAH MENGHASILKAN TEMUAN.
 *
 * @returns {null | { tingkat: string }}
 */
function tingkatOrang(asal, calon, tercemar = new Set()) {
  if (!asal || !calon) return null;
  if (asal.pihakId > 0 && asal.pihakId === calon.pihakId) return { tingkat: "pihak_id" };

  const pembantah = bertentangan(asal, calon);

  if (asal.nik && asal.nik === calon.nik && !tercemar.has(asal.nik) && !pembantah && !lahirBerbeda(asal, calon)) {
    const lahirSama = Boolean(asal.lahir && asal.lahir === calon.lahir);
    if (lahirSama || namaMenguatkan(asal, calon)) return { tingkat: "nik" };
  }

  if (
    asal.lahir &&
    asal.lahir === calon.lahir &&
    asal.nama.kunci &&
    asal.nama.kunci === calon.nama.kunci &&
    !pembantah
  ) {
    if (asal.nama.kata.length < 2 && tanggalPengganti(asal.lahir)) return null;
    return { tingkat: "nama_lahir" };
  }

  return null;
}

// ============================================================================
// TINGKAT KEEMPAT - PASANGAN NAMA
// ============================================================================

/**
 * Pasangan pihak perkara ini (mis. suami dan istri) yang sama-sama muncul di
 * perkara lain - kuat walau NIK kosong, sebab dua nama lengkap sekaligus
 * jarang kebetulan sama.
 *
 * Syarat: kedua nama baku minimal dua kata (terukur hanya 6 temuan yang
 * gugur karenanya); keduanya muncul sebagai pihak pertama/kedua di perkara
 * lain itu pada baris pihak yang berbeda; dan tidak ada pembantah (NIK sah
 * berbeda atau jenis kelamin berbeda) untuk salah satunya. Tanggal lahir yang
 * berbeda tidak membatalkan, tetapi dicatat (`lahirBerbeda`) supaya layar
 * menyebutnya.
 *
 * @param {object[]} pihakIni   orangDari() pihak pertama/kedua perkara ini
 * @param {object[]} kemunculan orangDari() baris perkara_pihak1/2 perkara lain
 * @param {number} perkaraIniId
 * @returns {Array<{ asalPihakId, perkaraId, pihakKe, pasangan, berhadapan, lahirBerbeda }>}
 */
function cocokPasangan(pihakIni, kemunculan, perkaraIniId) {
  const perPerkara = new Map();
  for (const k of kemunculan) {
    if (!k.perkaraId || k.perkaraId === perkaraIniId) continue;
    if (k.pihakKe !== 1 && k.pihakKe !== 2) continue;
    const kunci = k.namaPerkara.kunci;
    if (!kunci) continue;
    if (!perPerkara.has(k.perkaraId)) perPerkara.set(k.perkaraId, new Map());
    const peta = perPerkara.get(k.perkaraId);
    if (!peta.has(kunci)) peta.set(kunci, []);
    peta.get(kunci).push(k);
  }

  const hasil = [];
  const sudah = new Set();
  for (const a of pihakIni) {
    for (const b of pihakIni) {
      if (a === b || a.pihakId === b.pihakId) continue;
      const kunciA = a.namaPerkara.kunci;
      const kunciB = b.namaPerkara.kunci;
      if (!kunciA || !kunciB || kunciA === kunciB) continue;
      if (a.namaPerkara.kata.length < 2 || b.namaPerkara.kata.length < 2) continue;

      for (const [perkaraId, peta] of perPerkara) {
        const calonA = peta.get(kunciA);
        const calonB = peta.get(kunciB);
        if (!calonA || !calonB) continue;
        const a2 = calonA.find((x) => !bertentangan(a, x));
        if (!a2) continue;
        const b2 = calonB.find((x) => x.pihakId !== a2.pihakId && !bertentangan(b, x));
        if (!b2) continue;
        const kunci = `${a.pihakId}|${perkaraId}`;
        if (sudah.has(kunci)) continue;
        sudah.add(kunci);
        hasil.push({
          asalPihakId: a.pihakId,
          perkaraId,
          pihakKe: a2.pihakKe,
          // Baris pihak orang itu di perkara lain. Kemunculan LAIN baris yang
          // sama ikut menjadi temuan (lihat susunRiwayat) - SIPP sendiri yang
          // menyatakan baris itu satu orang.
          pihakIdCocok: a2.pihakId,
          pasangan: b.namaTampil,
          berhadapan: a2.pihakKe !== b2.pihakKe,
          lahirBerbeda: lahirBerbeda(a, a2) || lahirBerbeda(b, b2),
        });
      }
    }
  }
  return hasil;
}

/**
 * Kata nama yang paling membedakan - penyaring kasar LIKE '%kata%' atas
 * indeks `pihak.nama`.
 *
 * Bukan sekadar yang terpanjang: MUHAMMAD, ABDUL, dan SITI terpanjang pada
 * banyak nama dan menjaring ratusan baris. Kata yang lazim dilewati lebih
 * dulu; bila tinggal itu saja, barulah dipakai. Yang dijaring kasar di sini
 * dicocokkan ulang dengan nama baku utuh - kata penyaring tidak pernah
 * menjadi dasar kecocokan.
 */
const KATA_LAZIM = new Set([
  "BINTI", "MUHAMMAD", "MUHAMAD", "MOHAMMAD", "MOHAMAD", "MOHAMMED", "ABDUL", "ANDI", "AHMAD", "SITI",
  "SITTI", "DEWI", "AGUS", "NURUL", "RAHMAN", "RAHMAT", "HASAN", "HASANUDDIN", "IBRAHIM", "ISMAIL",
]);

function kataPenyaring(orang) {
  const sumber = (orang.nama && orang.nama.kata && orang.nama.kata.length ? orang.nama : orang.namaPerkara).kata || [];
  const layak = sumber.filter((k) => k.length >= 4);
  const khas = layak.filter((k) => !KATA_LAZIM.has(k));
  const pilihan = (khas.length ? khas : layak).slice().sort((x, y) => y.length - x.length);
  return pilihan[0] || "";
}

// ============================================================================
// MENYUSUN JAWABAN
// ============================================================================

/** Hasil satu perkara dari tanggal-tanggalnya lebih dulu - status_putusan_nama kosong pada sebagian besar baris. */
function keadaanPerkara(info) {
  if (info.tanggalCabut) return "Dicabut";
  if (info.tanggalGugur) return "Gugur";
  if (info.statusPutusan) return info.statusPutusan;
  if (info.tanggalPutusan) return "Putus";
  return "Masih berjalan";
}

/** Akta cerai yang SUDAH terbit - nomor dan tanggalnya ada. */
function aktaTerbit(info) {
  const nomor = bersih(info && info.nomorAkta);
  const tanggal = tanggalIso(info && info.tanggalAkta);
  return nomor && tanggal ? { nomor, tanggal } : null;
}

function kedudukanDi(pihakKe, info) {
  const bahan = {
    alurPerkaraId: info.alurPerkaraId,
    jenisPerkaraId: info.jenisPerkaraId,
    jenisPerkaraNama: info.jenisPerkara,
    nomorPerkara: info.nomorPerkara,
  };
  if (pihakKe === 1 || pihakKe === 2) return sebutanSatuPihak(pihakKe, bahan);
  if (pihakKe === 3) return "Intervensi";
  if (pihakKe === 4) return perkaraPermohonan(bahan) ? "Turut Termohon" : "Turut Tergugat";
  return "Pihak";
}

/** Sebelum atau sesudah perkara ini - menurut tanggal pendaftaran, lalu nomor urut SIPP. */
function arahTerhadap(info, ini) {
  const a = info.tanggalDaftar || "";
  const b = ini.tanggalDaftar || "";
  if (a && b && a !== b) return a < b ? "sebelumnya" : "sesudahnya";
  return Number(info.perkaraId) < Number(ini.perkaraId) ? "sebelumnya" : "sesudahnya";
}

const LABEL_DASAR = {
  perkara_ini: "perkara ini",
  pihak_id: "data pihak SIPP yang sama",
  nik: "NIK sama",
  nama_lahir: "nama dan tanggal lahir sama",
  pasangan: "pasangan nama",
};

function dasarDari(temuan) {
  const dasar = { tingkat: temuan.tingkat, label: LABEL_DASAR[temuan.tingkat] || temuan.tingkat, catatan: "" };
  if (temuan.tingkat === "pasangan") {
    const letak = temuan.berhadapan ? "berhadapan" : "pada pihak yang sama";
    dasar.label = temuan.lewatNomor
      ? `pasangan nama — bersama ${temuan.pasangan} (${letak}) di ${temuan.lewatNomor}, lalu data pihak SIPP yang sama`
      : `pasangan nama — bersama ${temuan.pasangan} (${letak})`;
    if (temuan.lahirBerbeda) dasar.catatan = "tanggal lahir tercatat berbeda di SIPP — periksa sebelum dipakai";
  }
  return dasar;
}

const BATAS_PER_ORANG = 50;

function butirPerkara(info, pihakKe, ini, dasar) {
  const akta = aktaTerbit(info);
  return {
    perkaraId: String(info.perkaraId),
    nomorPerkara: bersih(info.nomorPerkara),
    jenisPerkara: bersih(info.jenisPerkara),
    pihakKe,
    kedudukan: kedudukanDi(pihakKe, info),
    tanggalDaftar: info.tanggalDaftar || "",
    tanggalPutusan: info.tanggalPutusan || "",
    keadaan: keadaanPerkara(info),
    aktaCerai: akta,
    arah: Number(info.perkaraId) === Number(ini.perkaraId) ? "perkara ini" : arahTerhadap(info, ini),
    dasar,
  };
}

function urutWaktu(a, b) {
  const x = a.tanggalDaftar || "";
  const y = b.tanggalDaftar || "";
  if (x !== y) return x < y ? -1 : 1;
  return Number(a.perkaraId) - Number(b.perkaraId);
}

/**
 * Riwayat tiap pihak, dari bahan yang sudah dibaca. Murni - tanpa basis data -
 * supaya aturan hitungnya dapat diuji perilakunya satu per satu.
 *
 * @param {object} bahan
 * @param {object} bahan.ini          perkara ini (perkaraId, nomorPerkara, tanggalDaftar, ...)
 * @param {object[]} bahan.pihakIni   orangDari() pihak pertama/kedua perkara ini
 * @param {Map<number, Map<number, string>>} bahan.orangSama  pihakId asal -> (pihakId calon -> tingkat)
 * @param {object[]} bahan.kemunculan { perkaraId, pihakId, pihakKe } dari perkara_pihak1..4
 * @param {object[]} bahan.pasangan   keluaran cocokPasangan()
 * @param {Map<number, object>} bahan.info  perkaraId -> keterangan perkara (nomor, jenis, putusan, akta)
 */
function susunRiwayat(bahan) {
  const { ini, pihakIni, orangSama, kemunculan, pasangan, info } = bahan;
  const kemunculanPerId = new Map();
  for (const k of kemunculan || []) {
    const id = Number(k.pihakId);
    if (!kemunculanPerId.has(id)) kemunculanPerId.set(id, []);
    kemunculanPerId.get(id).push({ perkaraId: Number(k.perkaraId), pihakKe: Number(k.pihakKe) });
  }

  const infoIni = info.get(Number(ini.perkaraId)) || ini;

  return pihakIni.map((asal) => {
    /** perkaraId -> { pihakKe, temuan } - yang paling pasti menang. */
    const tautan = new Map();
    const catat = (perkaraId, pihakKe, temuan) => {
      if (!perkaraId || perkaraId === Number(ini.perkaraId)) return;
      const lama = tautan.get(perkaraId);
      if (lama && PERINGKAT[lama.temuan.tingkat] <= PERINGKAT[temuan.tingkat]) return;
      tautan.set(perkaraId, { pihakKe, temuan });
    };

    for (const k of kemunculanPerId.get(asal.pihakId) || []) catat(k.perkaraId, k.pihakKe, { tingkat: "pihak_id" });
    for (const [idCalon, tingkat] of (orangSama && orangSama.get(asal.pihakId)) || []) {
      for (const k of kemunculanPerId.get(idCalon) || []) catat(k.perkaraId, k.pihakKe, { tingkat });
    }
    for (const p of pasangan || []) {
      if (p.asalPihakId !== asal.pihakId) continue;
      catat(Number(p.perkaraId), Number(p.pihakKe), { tingkat: "pasangan", ...p });
      // Baris pihak yang cocok lewat pasangan dipakai juga di perkara lain -
      // itu orang yang sama menurut SIPP sendiri. Dasarnya tetap "pasangan
      // nama" (mata rantai terlemahnya), dan perkara perantaranya disebut.
      const lewat = info.get(Number(p.perkaraId));
      for (const k of kemunculanPerId.get(Number(p.pihakIdCocok)) || []) {
        if (k.perkaraId === Number(p.perkaraId)) continue;
        catat(k.perkaraId, k.pihakKe, {
          tingkat: "pasangan",
          ...p,
          lewatNomor: lewat ? bersih(lewat.nomorPerkara) : "",
        });
      }
    }

    const terkait = [];
    for (const [perkaraId, { pihakKe, temuan }] of tautan) {
      const keterangan = info.get(perkaraId);
      if (!keterangan) continue;
      terkait.push(butirPerkara(keterangan, pihakKe, ini, dasarDari(temuan)));
    }
    terkait.sort(urutWaktu);

    // Cerai berakta: perkara cerai yang AKTANYA SUDAH TERBIT, orang ini pihak
    // pertama/kedua di sana - termasuk perkara ini sendiri bila aktanya ada.
    //
    // Akta cerai hanya terbit untuk perceraian: terukur atas sipp_donggala,
    // seluruh 4.527 akta bernomor dan bertanggal milik Cerai Gugat (347, 3.672)
    // dan Cerai Talak (346, 855). Karena itu aktanya sendiri yang dijadikan
    // bukti, bukan jenis perkaranya - kumulasi cerai dengan jenis lain yang
    // aktanya terbit tetap terhitung, dan cerai yang dicabut, gugur, ditolak,
    // atau belum berakta tidak pernah terhitung.
    const cerai = terkait.filter((x) => x.aktaCerai && (x.pihakKe === 1 || x.pihakKe === 2));
    if (aktaTerbit(infoIni)) {
      cerai.push(butirPerkara(infoIni, asal.pihakKe, ini, dasarDari({ tingkat: "perkara_ini" })));
    }
    cerai.sort(urutWaktu);

    return {
      pihakId: asal.pihakId,
      pihakKe: asal.pihakKe,
      nama: asal.namaTampil,
      kedudukan: kedudukanDi(asal.pihakKe, infoIni),
      ceraiBerakta: cerai.length,
      cerai,
      jumlahTerkait: terkait.length,
      terkait: terkait.slice(0, BATAS_PER_ORANG),
    };
  });
}

// ============================================================================
// PEMBACAAN SIPP
// ============================================================================

const tanda = (n) => Array.from({ length: n }, () => "?").join(",");
const unik = (daftar) => [...new Set(daftar)];

function bacaIdPerkara(nilai) {
  const teks = bersih(nilai);
  if (!/^[1-9]\d{0,17}$/.test(teks)) return 0;
  const n = Number(teks);
  return Number.isSafeInteger(n) ? n : 0;
}

async function bacaPerkaraIni(perkaraId, nomorPerkara) {
  const baris = perkaraId
    ? await kueri(
        `SELECT pk.perkara_id AS perkaraId, pk.nomor_perkara AS nomorPerkara,
                pk.jenis_perkara_id AS jenisPerkaraId, pk.jenis_perkara_nama AS jenisPerkara,
                pk.alur_perkara_id AS alurPerkaraId,
                DATE_FORMAT(pk.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar
           FROM perkara pk
          WHERE pk.perkara_id = ?
          LIMIT 1`,
        [perkaraId]
      )
    : await kueri(
        `SELECT pk.perkara_id AS perkaraId, pk.nomor_perkara AS nomorPerkara,
                pk.jenis_perkara_id AS jenisPerkaraId, pk.jenis_perkara_nama AS jenisPerkara,
                pk.alur_perkara_id AS alurPerkaraId,
                DATE_FORMAT(pk.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar
           FROM perkara pk
          WHERE pk.nomor_perkara = ?
          ORDER BY pk.perkara_id DESC
          LIMIT 1`,
        [nomorPerkara]
      );
  const p = baris[0];
  if (!p) return null;
  return { ...p, perkaraId: Number(p.perkaraId), tanggalDaftar: tanggalIso(p.tanggalDaftar) };
}

/**
 * Riwayat seluruh pihak pertama/kedua satu perkara.
 *
 * Tujuh pembacaan, dua pasang di antaranya bersamaan: perkara ini; pihaknya;
 * baris ber-NIK sama BERSAMAAN dengan id senama lewat indeks nama; rincian id
 * senama lewat PRIMARY; kemunculan orang-orang itu lewat pihak_id; lalu
 * keterangan perkaranya (putusan beserta status) BERSAMAAN dengan aktanya.
 *
 * @param {{ perkaraId?: unknown, nomorPerkara?: unknown }} masukan
 */
async function riwayatPihak(masukan = {}) {
  const mulai = Date.now();
  // Waktu tiap langkah ikut dipulangkan - di peladen, "lambat" tanpa rincian
  // tidak dapat ditindaklanjuti; dengan rincian, langkah mana yang berat
  // langsung terbaca.
  const langkahMs = {};
  let jejak = mulai;
  const catatLangkah = (nama) => {
    const kini = Date.now();
    langkahMs[nama] = kini - jejak;
    jejak = kini;
  };

  const perkaraId = bacaIdPerkara(masukan.perkaraId);
  const nomorPerkara = bersih(masukan.nomorPerkara);
  if (!perkaraId && !nomorPerkara) {
    return { ok: false, kode: "masukan_tidak_sah", alasan: "perkaraId atau nomorPerkara wajib diisi." };
  }

  const ini = await bacaPerkaraIni(perkaraId, nomorPerkara);
  if (!ini) return { ok: false, kode: "perkara_tidak_ada", alasan: "Perkara tidak ditemukan di SIPP." };
  catatLangkah("perkara");

  const barisPihak = await kueri(
    `SELECT a.pihak_ke AS pihakKe, a.pihak_id AS pihakId, a.nama AS namaPerkara,
            ph.nama AS nama, ph.nomor_indentitas AS nik,
            DATE_FORMAT(ph.tanggal_lahir, '%Y-%m-%d') AS lahir, ph.jenis_kelamin AS jk
       FROM (SELECT pihak_id, 1 AS pihak_ke, nama, urutan FROM perkara_pihak1 WHERE perkara_id = ?
             UNION ALL SELECT pihak_id, 2, nama, urutan FROM perkara_pihak2 WHERE perkara_id = ?) a
       LEFT JOIN pihak ph ON ph.id = a.pihak_id
      ORDER BY a.pihak_ke, a.urutan`,
    [ini.perkaraId, ini.perkaraId]
  );
  const pihakIni = barisPihak
    .map((b) => orangDari({ ...b, perkaraId: ini.perkaraId }))
    .filter((o) => o.namaTampil && o.nama.kunci)
    .slice(0, 30);
  catatLangkah("pihak");

  if (pihakIni.length === 0) {
    return {
      ok: true,
      perkara: { perkaraId: String(ini.perkaraId), nomorPerkara: bersih(ini.nomorPerkara) },
      aktaTerbaca: true,
      pihak: [],
      waktuMs: Date.now() - mulai,
      langkahMs,
    };
  }

  // ==========================================================================
  // CALON ORANG - LEWAT INDEKS NAMA, KECUALI NIK
  // ==========================================================================
  //
  // Diukur atas sipp_donggala (diulang lima kali, keadaan tunak):
  //
  //   pemindaian penuh `pihak` (tanggal_lahir = ?)     374-839 ms
  //   pemindaian indeks `nama` yang menutup (LIKE)       35-43 ms
  //
  // Tabel `pihak` hanya 7,5 MB, tetapi MariaDB XAMPP di sini berpenyangga
  // (innodb_buffer_pool_size) 16 MB, sehingga halamannya terus tergusur.
  //
  // Karena itu calon nama + tanggal lahir dan calon pasangan dijaring lewat
  // indeks `nama` (Using index - hanya indeksnya yang dibaca: id dan nama ada
  // di dalamnya), nama bakunya dicocokkan di sini, dan HANYA yang nama
  // bakunya sama yang dibaca rinciannya lewat PRIMARY. Hanya NIK yang tetap
  // memindai penuh: kolomnya TIDAK berindeks, dan pemeriksaan NIK tercemar
  // menuntut SELURUH baris ber-NIK itu - bukan hanya yang namanya mirip.
  // Pemindaian itu dilewati sama sekali bila tidak satu pun pihak ber-NIK sah.
  const nikDicari = unik(pihakIni.map((o) => o.nik).filter(Boolean));
  const kataDicari = unik(pihakIni.map(kataPenyaring).filter(Boolean));
  const syaratNama = kataDicari.map(() => "ph.nama LIKE ?").join(" OR ");

  const [barisNik, barisIndeksNama] = await Promise.all([
    nikDicari.length
      ? kueri(
          `SELECT ph.id AS pihakId, ph.nama AS nama, ph.nomor_indentitas AS nik,
                  DATE_FORMAT(ph.tanggal_lahir, '%Y-%m-%d') AS lahir, ph.jenis_kelamin AS jk
             FROM pihak ph
            WHERE TRIM(ph.nomor_indentitas) IN (${tanda(nikDicari.length)})
            LIMIT 2000`,
          nikDicari
        )
      : Promise.resolve([]),
    syaratNama
      ? kueri(
          `SELECT ph.id AS pihakId, ph.nama AS nama
             FROM pihak ph
            WHERE ${syaratNama}
            LIMIT 5000`,
          kataDicari.map((k) => `%${k}%`)
        )
      : Promise.resolve([]),
  ]);

  catatLangkah("nikDanNama");

  // Nama baku pihak perkara ini - menurut tabel pihak DAN menurut perkaranya.
  const kunciPihak = new Set(pihakIni.flatMap((o) => [o.nama.kunci, o.namaPerkara.kunci]).filter(Boolean));
  const sudahDibaca = new Set(barisNik.map((b) => Number(b.pihakId)));
  const idNama = unik(
    barisIndeksNama.filter((b) => kunciPihak.has(bakuNama(b.nama).kunci)).map((b) => Number(b.pihakId))
  ).filter((x) => x > 0 && !sudahDibaca.has(x));
  const barisNama = idNama.length
    ? await kueri(
        `SELECT ph.id AS pihakId, ph.nama AS nama, ph.nomor_indentitas AS nik,
                DATE_FORMAT(ph.tanggal_lahir, '%Y-%m-%d') AS lahir, ph.jenis_kelamin AS jk
           FROM pihak ph
          WHERE ph.id IN (${tanda(idNama.length)})`,
        idNama
      )
    : [];
  catatLangkah("rincianSenama");

  // --- tiga tingkat pertama, antarbaris tabel pihak ---
  const calon = [...barisNik, ...barisNama].map(orangDari);
  const tercemar = nikTercemar([...calon, ...pihakIni]);
  const orangSama = new Map();
  for (const asal of pihakIni) {
    const peta = new Map();
    for (const c of calon) {
      if (c.pihakId === asal.pihakId) continue;
      const hasil = tingkatOrang(asal, c, tercemar);
      if (hasil) peta.set(c.pihakId, hasil.tingkat);
    }
    orangSama.set(asal.pihakId, peta);
  }

  // Calon tingkat pasangan: baris yang NAMA BAKU-nya sama dengan salah satu
  // pihak perkara ini. Kata penyaring hanya menjaring; yang menentukan nama
  // bakunya utuh.
  const idSenama = pihakIni.length >= 2 ? calon.filter((c) => kunciPihak.has(c.nama.kunci)).map((c) => c.pihakId) : [];

  // --- di perkara mana saja orang-orang itu muncul (lewat pihak_id berindeks) ---
  const idOrang = unik([
    ...pihakIni.map((o) => o.pihakId),
    ...[...orangSama.values()].flatMap((peta) => [...peta.keys()]),
    ...idSenama,
  ]).filter((x) => x > 0);
  const kemunculan = idOrang.length
    ? await kueri(
        `SELECT k.perkara_id AS perkaraId, k.pihak_id AS pihakId, k.pihak_ke AS pihakKe, k.nama AS namaPerkara
           FROM (SELECT perkara_id, pihak_id, 1 AS pihak_ke, nama FROM perkara_pihak1 WHERE pihak_id IN (${tanda(idOrang.length)})
                 UNION ALL SELECT perkara_id, pihak_id, 2, nama FROM perkara_pihak2 WHERE pihak_id IN (${tanda(idOrang.length)})
                 UNION ALL SELECT perkara_id, pihak_id, 3, nama FROM perkara_pihak3 WHERE pihak_id IN (${tanda(idOrang.length)})
                 UNION ALL SELECT perkara_id, pihak_id, 4, nama FROM perkara_pihak4 WHERE pihak_id IN (${tanda(idOrang.length)})) k
          LIMIT 5000`,
        [...idOrang, ...idOrang, ...idOrang, ...idOrang]
      )
    : [];
  catatLangkah("kemunculan");

  // --- tingkat keempat, pasangan nama ---
  //
  // Kemunculan orang-orang senama digabung dengan rincian barisnya (NIK,
  // tanggal lahir, jenis kelamin) supaya pembantahnya tetap terbaca.
  const rincianCalon = new Map(calon.map((c) => [c.pihakId, c]));
  const idSenamaSet = new Set(idSenama);
  const kemunculanSenama = kemunculan
    .filter((k) => idSenamaSet.has(Number(k.pihakId)))
    .map((k) => {
      const r = rincianCalon.get(Number(k.pihakId)) || {};
      return orangDari({
        perkaraId: k.perkaraId,
        pihakId: k.pihakId,
        pihakKe: k.pihakKe,
        namaPerkara: k.namaPerkara,
        nama: r.namaTampil,
        nik: r.nik,
        lahir: r.lahir,
        jk: r.jk,
      });
    });
  const pasangan = cocokPasangan(pihakIni, kemunculanSenama, ini.perkaraId);

  // Kemunculan orang yang HANYA senama tidak boleh ikut menjadi temuan -
  // yang diteruskan ke susunRiwayat hanya milik pihak perkara ini sendiri,
  // orang yang lolos tingkat pihak_id/NIK/nama + tanggal lahir, dan baris
  // yang lolos tingkat pasangan.
  const idTerpakai = new Set([
    ...pihakIni.map((o) => o.pihakId),
    ...[...orangSama.values()].flatMap((peta) => [...peta.keys()]),
    ...pasangan.map((p) => Number(p.pihakIdCocok)),
  ]);
  const kemunculanTemuan = kemunculan.filter((k) => idTerpakai.has(Number(k.pihakId)));

  // --- keterangan seluruh perkara yang tersentuh ---
  const idPerkara = unik([
    ini.perkaraId,
    ...kemunculanTemuan.map((k) => Number(k.perkaraId)),
    ...pasangan.map((p) => Number(p.perkaraId)),
  ]).filter((x) => x > 0);

  const [adaAkta, adaStatus] = await Promise.all([
    sippSkemaService.tabelAda("perkara_akta_cerai"),
    sippSkemaService.tabelAda("status_putusan"),
  ]);

  const [barisPerkara, barisAkta] = await Promise.all([
    adaStatus
      ? kueri(
          `SELECT pk.perkara_id AS perkaraId, pk.nomor_perkara AS nomorPerkara,
                  pk.jenis_perkara_id AS jenisPerkaraId, pk.jenis_perkara_nama AS jenisPerkara,
                  pk.alur_perkara_id AS alurPerkaraId,
                  DATE_FORMAT(pk.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar,
                  DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tanggalPutusan,
                  DATE_FORMAT(pu.tanggal_cabut, '%Y-%m-%d') AS tanggalCabut,
                  DATE_FORMAT(pu.tanggal_gugur, '%Y-%m-%d') AS tanggalGugur,
                  sp.nama AS statusPutusan
             FROM perkara pk
             LEFT JOIN perkara_putusan pu ON pu.perkara_id = pk.perkara_id
             LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id
            WHERE pk.perkara_id IN (${tanda(idPerkara.length)})`,
          idPerkara
        )
      : kueri(
          `SELECT pk.perkara_id AS perkaraId, pk.nomor_perkara AS nomorPerkara,
                  pk.jenis_perkara_id AS jenisPerkaraId, pk.jenis_perkara_nama AS jenisPerkara,
                  pk.alur_perkara_id AS alurPerkaraId,
                  DATE_FORMAT(pk.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar,
                  DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tanggalPutusan,
                  DATE_FORMAT(pu.tanggal_cabut, '%Y-%m-%d') AS tanggalCabut,
                  DATE_FORMAT(pu.tanggal_gugur, '%Y-%m-%d') AS tanggalGugur,
                  pu.status_putusan_nama AS statusPutusan
             FROM perkara pk
             LEFT JOIN perkara_putusan pu ON pu.perkara_id = pk.perkara_id
            WHERE pk.perkara_id IN (${tanda(idPerkara.length)})`,
          idPerkara
        ),
    adaAkta
      ? kueri(
          `SELECT ac.perkara_id AS perkaraId, ac.nomor_akta_cerai AS nomorAkta,
                  DATE_FORMAT(ac.tgl_akta_cerai, '%Y-%m-%d') AS tanggalAkta
             FROM perkara_akta_cerai ac
            WHERE ac.perkara_id IN (${tanda(idPerkara.length)})`,
          idPerkara
        )
      : Promise.resolve([]),
  ]);

  const info = new Map();
  for (const b of barisPerkara) {
    const id = Number(b.perkaraId);
    const baru = {
      ...b,
      perkaraId: id,
      tanggalDaftar: tanggalIso(b.tanggalDaftar),
      tanggalPutusan: tanggalIso(b.tanggalPutusan),
      tanggalCabut: tanggalIso(b.tanggalCabut),
      tanggalGugur: tanggalIso(b.tanggalGugur),
      statusPutusan: bersih(b.statusPutusan),
    };
    // Kunci putusan (perkara_id, tanggal_putusan) dapat menyimpan dua baris
    // untuk satu perkara - yang terakhir yang dipakai.
    const lama = info.get(id);
    if (lama && String(lama.tanggalPutusan || "") >= String(baru.tanggalPutusan || "")) continue;
    info.set(id, baru);
  }
  for (const a of barisAkta) {
    const tujuan = info.get(Number(a.perkaraId));
    if (tujuan) Object.assign(tujuan, { nomorAkta: a.nomorAkta, tanggalAkta: a.tanggalAkta });
  }

  catatLangkah("keteranganPerkara");

  const pihak = susunRiwayat({ ini, pihakIni, orangSama, kemunculan: kemunculanTemuan, pasangan, info });

  return {
    ok: true,
    perkara: { perkaraId: String(ini.perkaraId), nomorPerkara: bersih(ini.nomorPerkara) },
    // false = tabel akta cerai tidak ada di SIPP ini - hitungan cerai tidak
    // dapat disusun, dan itu DISEBUT, bukan ditampilkan sebagai nol.
    aktaTerbaca: Boolean(adaAkta),
    pihak,
    waktuMs: Date.now() - mulai,
    langkahMs,
  };
}

/**
 * Jawaban rute /sipp/riwayat-pihak - status HTTP beserta badannya.
 *
 * Dipisah dari berkas rute supaya perilakunya dapat diuji tanpa memuat seluruh
 * router: masukan tidak sah 400, perkara tidak ada 404, galat SIPP 500.
 */
async function jawabRute(query = {}) {
  try {
    const hasil = await riwayatPihak({ perkaraId: query.perkaraId, nomorPerkara: query.nomorPerkara });
    if (hasil.ok) return { status: 200, body: hasil };
    return { status: hasil.kode === "perkara_tidak_ada" ? 404 : 400, body: hasil };
  } catch (galat) {
    return {
      status: 500,
      body: { ok: false, kode: "gagal_membaca_sipp", alasan: String((galat && galat.message) || galat).slice(0, 300) },
    };
  }
}

module.exports = {
  riwayatPihak,
  jawabRute,
  // Aturan murni - diekspor untuk diuji perilakunya.
  bakuNama,
  nikSah,
  orangDari,
  bertentangan,
  nikTercemar,
  tingkatOrang,
  cocokPasangan,
  susunRiwayat,
  aktaTerbit,
  keadaanPerkara,
  arahTerhadap,
  kataPenyaring,
  tanggalIso,
  PERINGKAT,
};
