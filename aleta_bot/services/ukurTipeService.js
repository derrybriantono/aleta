"use strict";

/**
 * ============================================================================
 * GERBANG UKUR DAFTAR DETEKSI (kontrak K13) - SISI BOT, HANYA MEMBACA SIPP
 * ============================================================================
 *
 * Daftar berjenis 'deteksi' (putusan.alasan.ciri, putusan.sumber-hukum.sebutan,
 * putusan.padanan-jenis) baru dapat disahkan sesudah diukur atas data
 * sungguhan. Aturan deteksi hasil tebakan sudah tiga kali salah di repo ini;
 * gerbang ini memaksa setiap tambahan membuktikan dirinya lebih dulu.
 *
 * Layanan ini hanya MEMBACA basis data SIPP satker (SELECT) dan TIDAK membaca
 * aps_badilag. Yang dipulangkan:
 *
 *   ciri     ciriDariKalimat SUNGGUHAN (abtUsulanService) dijalankan dua kali
 *            atas posita cerai 2024+ - tanpa dan dengan calon - lalu jumlah
 *            posita yang tertangkap BARU karena calon, dan 20 contoh kalimat
 *            yang dipilih acak BERBENIH (sama pada panggilan ulang), untuk
 *            diperiksa pengesah satu per satu;
 *   sebutan  sampel 300 putusan terbaru {pertimbangan, sumberHukumId} beserta
 *            pilihan sumber hukum SIPP. Penilaiannya di portal, karena
 *            usulkanMedanPutusan adalah pustaka portal;
 *   padanan  apakah nama itu benar-benar ada di perkara.jenis_perkara_nama.
 *
 * Tabel yang dibaca didaftarkan di const TABEL sippSkemaService (dijaga
 * tabel-sipp-terdaftar.test.ts). Tabel yang tidak ada adalah GALAT yang
 * disebut namanya - bukan jawaban kosong yang terbaca "tidak tertangkap".
 */

const db = require("../db_config");
const sippSkemaService = require("./sippSkemaService");
const abtUsulanService = require("./abtUsulanService");
const kalimatBaku = require("./abtKalimatBaku");
const pemilih = require("./pemilihRagam");

const DAFTAR_CIRI = kalimatBaku.DAFTAR_TIPE.ciri;
const JUMLAH_CONTOH = 20;
const SAMPEL_SUMBER_HUKUM = 300;
const PANJANG_KALIMAT_CONTOH = 400;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Galat yang menyebut tabelnya - tidak pernah jawaban kosong. */
function wajibTabel(ada, nama) {
  if (!ada) throw new Error(`Tabel SIPP ${nama} tidak terbaca; ukur tidak dapat dijalankan.`);
}

/**
 * Pembangkit acak BERBENIH (mulberry32 dari fnv1a32+fmix32 pemilih ragam).
 * Tidak memakai Math.random: benih yang sama = urutan yang sama.
 */
function acakBerbenih(benih) {
  let a = pemilih.fmix32(pemilih.fnv1a32(String(benih))) >>> 0;
  return function acak() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates berbenih atas salinan larik. */
function kocokBerbenih(larik, benih) {
  const hasil = larik.slice();
  const acak = acakBerbenih(benih);
  for (let i = hasil.length - 1; i > 0; i -= 1) {
    const j = Math.floor(acak() * (i + 1));
    const tukar = hasil[i];
    hasil[i] = hasil[j];
    hasil[j] = tukar;
  }
  return hasil;
}

/**
 * Entri daftar ciri (bentuk EntriTipe) dinormalkan lewat penyaring bot yang
 * SAMA dengan yang dipakai /abt/usulan - bukan salinan. Yang ditolak
 * dipulangkan beserta sebabnya.
 */
function bacaEntriCiri(entri) {
  return kalimatBaku.bacaDaftarTipe({ tipeKeluaran: { daftar: { [DAFTAR_CIRI]: entri } } }, DAFTAR_CIRI);
}

function kalimatBerciri(kalimatKecil, baris) {
  return baris.kata.every((kata) => kalimatKecil.includes(kata));
}

/**
 * Inti ukur ciri, MURNI (tanpa basis data) supaya dapat diuji atas fixture.
 *
 * @param {Array<{perkaraId: string|number, posita: string}>} daftarPosita
 *   Urutannya menentukan contoh - pemanggil mengurutkannya tetap (perkara_id).
 * @param {{calon: object[], dasar?: object[]|null, benih?: string, jumlahContoh?: number}} opsi
 *   calon  entri putusan.alasan.ciri yang diukur (bentuk EntriTipe);
 *   dasar  daftar efektif yang berlaku sekarang (dari portal). Tanpa ini
 *          dipakai CIRI_ALASAN tertanam.
 * @returns {{ok: true, n, tangkapanTanpa, tangkapanCalon, tangkapanBaru, kalimatCocok,
 *   kalimatBaru, contohBaru, benih, contoh: Array<{id, perkaraId, kalimat, baru}>,
 *   dasarAsal, ditolak}  - contoh mendahulukan kalimat baru (contohBaru di antaranya)
 *   | {ok: false, alasan: string, ditolak}}
 */
function ukurCiriAtas(daftarPosita, opsi = {}) {
  const calonBaca = bacaEntriCiri(Array.isArray(opsi.calon) ? opsi.calon : []);
  if (!calonBaca.entri.length) {
    return { ok: false, alasan: "Calon ciri kosong atau ditolak penyaring bot.", ditolak: calonBaca.ditolak };
  }
  let dasar = abtUsulanService.CIRI_ALASAN;
  let dasarAsal = "tertanam";
  const ditolak = [...calonBaca.ditolak];
  if (Array.isArray(opsi.dasar)) {
    const dasarBaca = bacaEntriCiri(opsi.dasar);
    dasar = dasarBaca.entri;
    dasarAsal = "portal";
    ditolak.push(...dasarBaca.ditolak);
  }
  const calon = calonBaca.entri;
  const denganCalon = dasar.concat(calon);
  const kunciCalon = new Set(calon.map((b) => b.kunci));
  const benih = String(opsi.benih || calon.map((b) => `${b.kunci}=${b.kata.join("+")}`).join("|"));
  const jumlahContoh = Math.max(1, Math.min(100, Number(opsi.jumlahContoh) || JUMLAH_CONTOH));

  let tangkapanTanpa = 0;
  let tangkapanCalon = 0;
  let tangkapanBaru = 0;
  const kumpulan = [];
  for (const satu of daftarPosita || []) {
    const kalimat = abtUsulanService.kalimatPosita(String(satu && satu.posita ? satu.posita : ""));
    const tanpa = abtUsulanService.ciriDariKalimat(kalimat, dasar);
    const dengan = abtUsulanService.ciriDariKalimat(kalimat, denganCalon);
    if (tanpa.length) tangkapanTanpa += 1;
    const baru = dengan.filter((k) => !tanpa.includes(k));
    if (baru.length) tangkapanBaru += 1;
    const cocok = kalimat.filter((k) => {
      const kecil = k.toLowerCase();
      return calon.some((b) => kalimatBerciri(kecil, b));
    });
    if (cocok.length) tangkapanCalon += 1;
    const baruCalon = baru.some((k) => kunciCalon.has(k));
    cocok.forEach((k, i) => {
      kumpulan.push({
        id: `${satu.perkaraId}:${i}`,
        perkaraId: String(satu.perkaraId),
        kalimat: k.length > PANJANG_KALIMAT_CONTOH ? `${k.slice(0, PANJANG_KALIMAT_CONTOH)}...` : k,
        baru: baruCalon,
      });
    });
  }

  // Contoh BARU DIDAHULUKAN. Yang diputuskan pengesah adalah perubahan yang
  // dibawa calon - kalimat yang sudah tertangkap dasar perilakunya tidak
  // berubah oleh calon. Dulu 20 contoh diambil acak dari SELURUH kalimat
  // cocok: atas sipp_donggala dengan calon 'shabu', contoh berlabel baru
  // hanya 0-2 dari 20 pada lima benih, sehingga calon yang seluruh tangkapan
  // barunya salah tetap lulus gerbang <=10% salah. Kini seluruh kalimat baru
  // (acak berbenih) mengisi lebih dahulu, sisanya diisi kalimat lama (acak
  // berbenih); urutan tampilnya dikocok lagi supaya pengesah tidak menilai
  // menurut letaknya.
  const kumpulanBaru = kocokBerbenih(kumpulan.filter((c) => c.baru), `${benih}|baru`).slice(0, jumlahContoh);
  const kumpulanLama = kocokBerbenih(kumpulan.filter((c) => !c.baru), `${benih}|lama`).slice(0, jumlahContoh - kumpulanBaru.length);
  const contoh = kocokBerbenih(kumpulanBaru.concat(kumpulanLama), benih);
  return {
    ok: true,
    n: (daftarPosita || []).length,
    tangkapanTanpa,
    tangkapanCalon,
    tangkapanBaru,
    kalimatCocok: kumpulan.length,
    kalimatBaru: kumpulan.filter((c) => c.baru).length,
    contohBaru: kumpulanBaru.length,
    benih,
    contoh,
    dasarAsal,
    ditolak,
  };
}

/** Posita cerai gugat/talak terdaftar sejak 2024, urut perkara_id. */
async function bacaPositaCerai() {
  wajibTabel(await sippSkemaService.tabelAda("perkara"), "perkara");
  const baris = await runQuery(
    `SELECT perkara_id, posita
       FROM perkara
      WHERE jenis_perkara_nama IN ('Cerai Gugat', 'Cerai Talak')
        AND tanggal_pendaftaran >= '2024-01-01'
        AND CHAR_LENGTH(posita) > 200
      ORDER BY perkara_id`
  );
  return baris.map((b) => ({ perkaraId: String(b.perkara_id), posita: String(b.posita || "") }));
}

async function ukurCiri(masukan = {}) {
  const posita = await bacaPositaCerai();
  return ukurCiriAtas(posita, {
    calon: masukan.calon,
    dasar: Array.isArray(masukan.dasar) ? masukan.dasar : null,
    benih: masukan.benih,
    jumlahContoh: masukan.jumlahContoh,
  });
}

/**
 * Sampel putusan terbaru {pertimbangan, sumberHukumId}, dan pilihan sumber
 * hukum SIPP untuk peradilan agama (jenis_pengadilan 4). Pertimbangan
 * dikirim apa adanya (HTML); portal mengubahnya dengan teksDariHtml yang sama
 * dengan pembaca borang.
 */
async function sampelSumberHukum(masukan = {}) {
  wajibTabel(await sippSkemaService.tabelAda("perkara_putusan"), "perkara_putusan");
  wajibTabel(await sippSkemaService.tabelAda("perkara_pertimbangan_hukum"), "perkara_pertimbangan_hukum");
  wajibTabel(await sippSkemaService.tabelAda("sumber_hukum"), "sumber_hukum");
  const batas = Math.max(1, Math.min(SAMPEL_SUMBER_HUKUM, Number(masukan.batas) || SAMPEL_SUMBER_HUKUM));
  const baris = await runQuery(
    `SELECT pp.perkara_id, pp.sumber_hukum_id, ph.pertimbangan_hukum
       FROM perkara_putusan pp
       JOIN perkara_pertimbangan_hukum ph ON ph.perkara_id = pp.perkara_id
      WHERE pp.sumber_hukum_id IS NOT NULL AND pp.sumber_hukum_id <> ''
        AND CHAR_LENGTH(ph.pertimbangan_hukum) >= 1000
      ORDER BY pp.tanggal_putusan DESC, pp.perkara_id DESC
      LIMIT ?`,
    [batas]
  );
  const pilihan = await runQuery(
    `SELECT id, nama FROM sumber_hukum WHERE aktif = 'Y' AND jenis_pengadilan = '4' ORDER BY nama`
  );
  return {
    ok: true,
    n: baris.length,
    pilihan: pilihan.map((p) => ({ nilai: String(p.id), label: String(p.nama || "") })),
    sampel: baris.map((b) => ({
      perkaraId: String(b.perkara_id),
      pertimbangan: String(b.pertimbangan_hukum || ""),
      sumberHukumId: String(b.sumber_hukum_id || ""),
    })),
  };
}

/** Bentuk baku nama jenis: huruf kecil, spasi tunggal (sama dengan bakuJenis portal). */
function bakuNama(nama) {
  return String(nama || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Apakah nama lain itu benar-benar tertulis di perkara.jenis_perkara_nama. */
async function periksaPadanan(masukan = {}) {
  const nama = bakuNama(masukan.nama);
  if (!nama) return { ok: false, alasan: "Nama padanan kosong." };
  wajibTabel(await sippSkemaService.tabelAda("perkara"), "perkara");
  const baris = await runQuery(
    `SELECT jenis_perkara_nama AS nama, COUNT(*) AS jumlah
       FROM perkara
      WHERE jenis_perkara_nama IS NOT NULL AND jenis_perkara_nama <> ''
      GROUP BY jenis_perkara_nama`
  );
  const cocok = baris.filter((b) => bakuNama(b.nama) === nama);
  const jumlahPerkara = cocok.reduce((n, b) => n + Number(b.jumlah || 0), 0);
  return {
    ok: true,
    nama,
    adaDiSipp: cocok.length > 0,
    jumlahPerkara,
    namaSipp: cocok.map((b) => String(b.nama)),
  };
}

/** Satu pintu untuk rute /sipp/ukur-tipe. Jenis di luar tiga -> galat 400. */
async function ukur(masukan = {}) {
  const jenis = String(masukan.jenis || "");
  if (jenis === "ciri") return { jenis, ...(await ukurCiri(masukan)) };
  if (jenis === "sebutan") return { jenis, ...(await sampelSumberHukum(masukan)) };
  if (jenis === "padanan") return { jenis, ...(await periksaPadanan(masukan)) };
  return { ok: false, jenis, alasan: "Jenis ukur harus ciri, sebutan, atau padanan.", galatMasukan: true };
}

module.exports = {
  ukur,
  ukurCiri,
  ukurCiriAtas,
  sampelSumberHukum,
  periksaPadanan,
  bacaPositaCerai,
  acakBerbenih,
  kocokBerbenih,
  bakuNama,
  JUMLAH_CONTOH,
  SAMPEL_SUMBER_HUKUM,
};
