/**
 * ============================================================================
 * AGEN ARSIP e-COURT BERTINDAK (TAHAP 5) - PENCOCOKANNYA
 * ============================================================================
 *
 * Berkas ini MEMBACA catatan arsip dan MEMERIKSA cakram. Ia tidak mengunduh,
 * tidak menghapus, dan tidak menyentuh SIPP. Yang memutuskan apakah pantas
 * bertindak adalah src/lib/arsip-ecourt-bertindak.ts di portal; yang menarik
 * ulang adalah penarik arsip yang sudah ada.
 *
 * ============================================================================
 * PEMERIKSAAN VOLUME - BAGIAN YANG PALING MUDAH DILUPAKAN
 * ============================================================================
 *
 * Diukur di peladen 15 September 2026:
 *
 *   aleta_bot_ecourt_files   400 tercatat
 *   ada di cakram              0
 *
 * Seluruhnya hilang - dan bukan karena dihapus. Berkasnya diunduh KE DALAM
 * lapisan peti sebelum volume ecourt-docs dipasang; begitu peti dibangun
 * ulang, lapisan itu musnah dan catatannya tinggal.
 *
 * Volumenya kini ada:
 *   /var/www/html/aleta-data/ecourt-docs -> /usr/src/app/data/ecourt
 *
 * Tetapi kalau suatu hari ia lepas lagi, menarik ulang 400 berkas ke sana
 * adalah pekerjaan yang menghapus dirinya sendiri. Karena itu ketahanan
 * akarnya DIPERIKSA, bukan diandaikan - dengan menulis berkas penanda dan
 * membandingkannya dengan daftar mount peti.
 */

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

/**
 * Sambungan BOT, bukan sambungan SIPP.
 *
 * db_config menunjuk basis data SIPP; catatan arsip ALETA berada di basis
 * datanya sendiri (aleta_bot). Memakai db_config di sini menjawab
 * "Table 'SIPP.aleta_bot_ecourt_files' doesn't exist" - galat yang terdengar
 * seperti tabelnya belum dibuat, padahal ia ada di tempat lain. Terukur di
 * peladen: 400 baris, di basis data aleta_bot.
 */
const db = require("../bot_db_config");

/** Akar arsip. Sama dengan yang dipakai penarik arsip. */
const AKAR_ARSIP = process.env.ALETA_BOT_ECOURT_DIR || "/usr/src/app/data/ecourt";

function jalankan(sql, nilai = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, nilai, (galat, baris) => (galat ? gagal(galat) : selesai(baris || [])));
  });
}

/**
 * Memeriksa apakah akar arsip benar-benar bertahan antar pembangunan peti.
 *
 * Caranya membaca /proc/self/mountinfo, bukan menebak dari ada-tidaknya
 * direktori: direktori SELALU ada - ia dibuat sendiri oleh penarik arsip -
 * dan justru itulah yang membuat kegagalan ini tidak pernah terlihat.
 *
 * Di luar peti (uji setempat, mesin pengembang) mountinfo tidak menyebut apa
 * pun tentangnya; di situ ketahanannya diterima apa adanya, sebab di luar peti
 * memang tidak ada yang membangun ulang lapisan.
 */
async function periksaAkar(akar = AKAR_ARSIP) {
  const hasil = { akar, bertahan: false, alasan: "", diPeti: false };

  try {
    await fsp.mkdir(akar, { recursive: true });
  } catch (galat) {
    hasil.alasan = `direktori tidak dapat dibuat: ${String(galat.message || galat).slice(0, 120)}`;
    return hasil;
  }

  let mountinfo = "";
  try {
    mountinfo = await fsp.readFile("/proc/self/mountinfo", "utf8");
    hasil.diPeti = fs.existsSync("/.dockerenv") || /docker|containerd|overlay/i.test(mountinfo);
  } catch {
    // Bukan Linux, atau tanpa /proc - mesin pengembang.
    hasil.bertahan = true;
    hasil.alasan = "di luar peti - tidak ada lapisan yang dibangun ulang";
    return hasil;
  }

  if (!hasil.diPeti) {
    hasil.bertahan = true;
    hasil.alasan = "di luar peti";
    return hasil;
  }

  // Di dalam peti, akarnya harus muncul sebagai titik mount tersendiri.
  // Yang hanya berada di lapisan overlay TIDAK muncul di sana - dan itulah
  // perbedaan antara berkas yang bertahan dan berkas yang musnah.
  // Medan ke-5 mountinfo adalah titik tambatnya. Yang dicari PERSIS akarnya -
  // bukan induknya: /usr/src/app yang tertambat tidak membuat
  // /usr/src/app/data/ecourt ikut bertahan, dan sebaliknya.
  const tertambat = mountinfo
    .split("\n")
    .some((b) => (b.split(" ")[4] || "") === akar);

  hasil.bertahan = tertambat;
  hasil.alasan = tertambat
    ? "terpasang sebagai volume"
    : "TIDAK terpasang sebagai volume - isinya musnah tiap peti dibangun ulang";
  return hasil;
}

/**
 * Mencocokkan catatan arsip dengan cakram.
 *
 * Tidak memakai kolom ukuran sebagai bukti keberadaan: catatan menyimpan
 * ukuran saat diunduh, dan ukuran yang tercatat pada berkas yang sudah musnah
 * tetap terbaca meyakinkan. Yang diperiksa keberadaan berkasnya sendiri.
 */
async function cocokkanArsip(batasBaca = 2000) {
  const akar = await periksaAkar();

  let baris = [];
  try {
    baris = await jalankan(
      `SELECT id, nomor_perkara AS nomorPerkara, jalur_berkas AS jalurBerkas,
              COALESCE(sumber_url, '') AS sumberUrl, ukuran_byte AS ukuranByte
         FROM aleta_bot_ecourt_files
        WHERE COALESCE(dihapus_retensi, 0) = 0
        ORDER BY diunduh_pada DESC
        LIMIT ?`,
      [Number(batasBaca) || 2000]
    );
  } catch (galat) {
    return {
      ok: false,
      alasan: `catatan arsip tidak terbaca: ${String(galat.message || galat).slice(0, 160)}`,
    };
  }

  const berkas = baris.map((b) => {
    const jalur = String(b.jalurBerkas || "");
    let ada = false;
    try {
      ada = Boolean(jalur) && fs.statSync(jalur).size > 0;
    } catch {
      ada = false;
    }
    return {
      id: String(b.id),
      nomorPerkara: String(b.nomorPerkara || ""),
      jalurBerkas: jalur,
      sumberUrl: String(b.sumberUrl || ""),
      adaDiCakram: ada,
      ukuranByte: b.ukuranByte == null ? null : Number(b.ukuranByte),
    };
  });

  return {
    ok: true,
    fakta: {
      akar: akar.akar,
      akarBertahan: akar.bertahan,
      alasanTidakBertahan: akar.bertahan ? undefined : akar.alasan,
      berkas,
    },
  };
}

module.exports = {
  AKAR_ARSIP,
  cocokkanArsip,
  periksaAkar,
  // Dibuka supaya jalur berkasnya dapat diperiksa sendiri saat angkanya
  // dicurigai, tanpa membaca seluruh catatan.
  _jalurAkar: () => path.resolve(AKAR_ARSIP),
};
