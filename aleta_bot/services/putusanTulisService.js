"use strict";

/**
 * ============================================================================
 * MENULIS PUTUSAN AKHIR KE SIPP
 * ============================================================================
 *
 * Ini tulisan paling berat yang dikerjakan ALETA. Penetapan menunjuk siapa yang
 * menyidangkan; penundaan memindahkan tanggal. Yang ini mencatat PUTUSAN -
 * amarnya, statusnya, dan pertimbangan hukumnya - pada basis data yang dibaca
 * pengadilan tingkat banding, dipakai menyusun akta cerai, dan dikirim ke
 * Direktori Putusan.
 *
 * Karena itu bentuknya tidak dikarang. Seluruhnya diukur dari satu sesi
 * memutus sungguhan di salinan satker, baris demi baris.
 *
 * ============================================================================
 * BENTUKNYA: DUA BARIS, SATU DETIK, SATU AKUN
 * ============================================================================
 *
 *   500580 14:59:22 derry briantono  perkara_putusan             tambah
 *   500581 14:59:22 derry briantono  perkara_pertimbangan_hukum  tambah
 *   500582 14:59:48 derry briantono  perkara_putusan             UNGGAH
 *
 * Baris ketiga BUKAN bagian memutus - itu mengunggah berkasnya, dan sudah ada
 * jalannya sendiri (putusanUnggahService). Yang ditulis berkas ini dua yang
 * pertama, pada detik yang sama, atas nama satu akun.
 *
 * Yang TIDAK ikut, dan tiap-tiapnya diperiksa supaya tidak dikarang:
 *
 *   perkara_proses    0 baris sedetik dengan putusan pada 100 putusan terakhir.
 *                     Riwayat perkara TIDAK disentuh saat memutus.
 *   perkara           tersentuh keesokan harinya oleh akun meja3g dari halaman
 *                     "Proses Minutasi" - pekerjaan lain, orang lain.
 *   perkara_putusan_pemberitahuan_putusan
 *                     formname-nya memang menyebut putusan, tetapi itu langkah
 *                     JURUSITA menyampaikan pemberitahuan, terjadi belakangan
 *                     dan oleh akun berbeda.
 *
 * ============================================================================
 * JUDUL AUDITNYA BERBEDA DARI SELURUH MODUL LAIN
 * ============================================================================
 *
 * Modul lain menulis "AKSI table <b>x</b> dari halaman <b>y</b> dengan Primary
 * Key [perkara_id=N]". Modul putusan tidak:
 *
 *   tambah Data Putusan Akhir <br />dengan perkara_id [id=10049]
 *   tambah Data Pertimbangan Hukum <br />dengan perkara_id [id=10049]
 *
 * Memakai cetakan yang biasa akan menghasilkan judul yang tidak pernah ditulis
 * SIPP untuk tabel ini - satu tanda yang tidak perlu ada.
 *
 * ============================================================================
 * JAMNYA DUA BELAS, BUKAN DUA PULUH EMPAT
 * ============================================================================
 *
 * `diinput_tanggal` tercatat 02:59:22 untuk peristiwa pukul 14:59:22. Bukan
 * salah baca - diukur atas seluruh basis data, bagian baris berjam >= 13:
 *
 *      perkara_putusan               5,0%   (498 dari 9.993)
 *      perkara_pertimbangan_hukum    0,0%   (0 dari 2.228)
 *      ---------------------------------------------------------
 *      perkara_penetapan            42,0%   (4.138 dari 9.850)
 *      perkara_jadwal_sidang        33,7%   (6.786 dari 20.108)
 *      perkara_proses               38,5%   (41.531 dari 107.802)
 *
 * Kalau modul putusan memakai jam 24-jam, pekerjaan sore hari mustahil
 * sesedikit itu sementara modul lain di kantor yang sama mencapai sepertiga.
 * Jadi modul putusan menuliskannya 12-jam - dan ini KHAS modul putusan, bukan
 * sifat SIPP: penulis penetapan dan penulis penundaan ALETA sudah benar memakai
 * 24-jam dan tidak boleh ikut diubah.
 *
 * Cap waktu `sys_audittrail` tetap 24-jam - yang 12-jam hanya kolom
 * `diinput_tanggal` di dalam tabelnya.
 */

const db = require("../db_config");
const penetapan = require("./penetapanTulisService");

/** Nama halaman SIPP - persis, sebab inilah yang terbaca di layar Audit Trail. */
const FORM_PUTUSAN = "TAMBAH DATA PUTUSAN AKHIR";
const FORM_PERTIMBANGAN = "TAMBAH DATA PERTIMBANGAN HUKUM";

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

const bersih = (n) => String(n === null || n === undefined ? "" : n).trim();
const tanggalSah = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(bersih(iso));

/**
 * Cap waktu untuk kolom `diinput_tanggal` modul putusan - jam DUA BELAS.
 *
 * Pukul 14:59:22 ditulis 02:59:22, sebagaimana SIPP menuliskannya. Tanggalnya
 * tidak ikut bergeser: yang berubah hanya jamnya.
 */
function waktuPutusan(saat24) {
  const teks = bersih(saat24);
  const cocok = teks.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!cocok) return teks;
  // Jam DUA BELAS, bukan sisa bagi dua belas: pukul 12 tetap 12, dan pukul 0
  // menjadi 12. Diukur dari sebaran jamnya pada 9.993 putusan satker -
  //
  //   jam 12 : 1.045 baris        jam 0 : TIDAK ADA satu pun
  //
  // sisa bagi dua belas akan menuliskan tengah hari sebagai 00 dan melahirkan
  // jam yang tidak pernah muncul sekali pun di tabel ini.
  const jam = ((Number(cocok[2]) + 11) % 12) + 1;
  return `${cocok[1]} ${String(jam).padStart(2, "0")}:${cocok[3]}:${cocok[4]}`;
}

/** Keadaan perkara yang hendak diputus. */
async function keadaanPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const baris = await kueri(
    `SELECT p.perkara_id       AS perkaraId,
            p.nomor_perkara    AS nomorPerkara,
            p.jenis_perkara_id AS jenisPerkaraId,
            p.jenis_perkara_text AS jenisPerkara,
            pp.perkara_id      AS sudahAda,
            pp.tanggal_putusan AS tanggalPutusanLama
       FROM perkara p
       LEFT JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
      WHERE p.perkara_id = ? LIMIT 1`,
    [id]
  ).catch(() => []);
  return baris[0] || null;
}

/** Akun SIPP yang namanya akan tercatat. */
async function akunSipp(username) {
  const nama = bersih(username);
  if (!nama) return null;
  const baris = await kueri(
    `SELECT username, fullname FROM sys_users WHERE username = ? LIMIT 1`,
    [nama]
  ).catch(() => []);
  return baris[0] || null;
}

/**
 * Status putusan yang sah - diperiksa terhadap tabel rujukannya.
 *
 * ============================================================================
 * JENIS PERKARANYA TIDAK DICOCOKKAN, DAN ITU DISENGAJA
 * ============================================================================
 *
 * `status_putusan` PUNYA kolom `jenis_perkara_id`, dan mencocokkannya dengan
 * `perkara.jenis_perkara_id` terasa benar sekali. Ia keliru: kedua kolom itu
 * bernama sama tetapi menghitung hal yang berbeda.
 *
 *      status_putusan.jenis_perkara_id     1 .. 5
 *      perkara.jenis_perkara_id            346 Cerai Talak, 347 Cerai Gugat,
 *                                          348 Harta Bersama, 354 Perwalian,
 *                                          358 Asal Usul Anak, 360 Pengesahan
 *                                          Perkawinan, 362 Dispensasi Kawin,
 *                                          371 P3HP
 *
 * Kecocokan yang dituntut karena itu TIDAK PERNAH terpenuhi - seluruh putusan
 * akan ditolak dengan alasan yang terdengar masuk akal. Terjadi sekali saat
 * berkas ini ditulis, dan ketahuan hanya karena dijalankan atas perkara
 * sungguhan.
 *
 * Dan cocok-tidaknya memang tidak ada gunanya diperiksa: seluruh jenis perkara
 * satker ini memakai himpunan status yang SAMA - 62, 63, 64, 65, 67, 93 -
 * terukur pada 679 putusan 2026.
 */
async function statusSah(statusPutusanId) {
  const id = Number(statusPutusanId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const baris = await kueri(
    `SELECT id, nama FROM status_putusan WHERE id = ? AND aktif = 'Y' LIMIT 1`,
    [id]
  ).catch(() => []);
  return baris[0] || null;
}

/**
 * Status putusan yang dipakai satker ini - dibaca dari data, bukan dari daftar.
 *
 * Yang dipulangkan status yang SUNGGUH pernah dipakai pada putusan satker,
 * bukan seluruh isi tabel rujukan: `status_putusan` memuat ratusan baris untuk
 * segala jenis pengadilan, dan menawarkan seluruhnya kepada panitera sidang
 * berarti menawarkan status yang tidak pernah dipakai di pengadilan agama.
 */
async function daftarStatusPutusan() {
  return kueri(
    `SELECT sp.id, sp.nama, COUNT(pp.perkara_id) AS dipakai
       FROM status_putusan sp
       JOIN perkara_putusan pp ON pp.status_putusan_id = sp.id
      WHERE sp.aktif = 'Y'
      GROUP BY sp.id, sp.nama
      ORDER BY dipakai DESC`
  ).catch(() => []);
}

/**
 * Menyusun rencana menulis putusan - TIDAK menulis apa pun.
 *
 * @returns {Promise<object>} { ok, perkara, atasNama, langkah, andaian }
 */
async function susunRencanaPutus(minta = {}) {
  const perkara = await keadaanPerkara(minta.perkaraId);
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ketemu" };

  // Perkara yang SUDAH punya baris putusan tidak ditulisi lagi. SIPP sendiri
  // menghapus lalu menyisipkan ulang ketika putusannya disunting - 8.220 baris
  // DELETE pada basis data ini - dan meniru penyuntingan adalah pekerjaan yang
  // berbeda dari mencatat putusan baru. Yang ini menolak, bukan menebak.
  if (perkara.sudahAda) {
    return {
      ok: false,
      alasan: "perkara_sudah_diputus",
      tanggalPutusan: String(perkara.tanggalPutusanLama || "").slice(0, 10),
    };
  }

  const akun = await akunSipp(minta.olehUsername);
  if (!akun) return { ok: false, alasan: "akun_sipp_tidak_ketemu" };

  const tanggalPutusan = bersih(minta.tanggalPutusan);
  if (!tanggalSah(tanggalPutusan)) return { ok: false, alasan: "tanggal_putusan_tidak_sah" };

  const saat = await penetapan.waktuBasisData();
  const hariIni = saat.slice(0, 10);
  // Putusan bertanggal esok hari adalah putusan yang belum diucapkan. Yang
  // bertanggal lampau boleh - putusan memang sering diketik beberapa hari
  // sesudah diucapkan.
  if (tanggalPutusan > hariIni) {
    return { ok: false, alasan: "tanggal_putusan_di_depan", diminta: tanggalPutusan };
  }

  const status = await statusSah(minta.statusPutusanId);
  if (!status) return { ok: false, alasan: "status_putusan_tidak_sah" };

  const amar = bersih(minta.amarPutusan);
  if (!amar) return { ok: false, alasan: "amar_putusan_kosong" };

  const pertimbangan = bersih(minta.pertimbanganHukum);
  if (!pertimbangan) return { ok: false, alasan: "pertimbangan_hukum_kosong" };

  const verstek = bersih(minta.verstek).toUpperCase() === "Y" ? "Y" : "T";
  const catatan = bersih(minta.catatanPutusan);
  // Kolomnya berisi daftar berkoma pada baris buatan petugas, mis. "10,8,11".
  const sumberHukum = bersih(minta.sumberHukumId).replace(/[^0-9,]/g, "");

  const andaian = [];
  if (!sumberHukum) {
    andaian.push("Sumber hukum tidak disebut, jadi kolomnya dikosongkan - SIPP mengizinkannya kosong.");
  }
  if (!catatan) {
    andaian.push("Catatan putusan dikosongkan, sebagaimana sebagian besar baris buatan petugas.");
  }

  const ip = bersih(minta.ip) || "127.0.0.1";
  const saatKolom = waktuPutusan(saat);
  const langkah = [];

  // ---- 1. Putusan akhir ----------------------------------------------------
  const nilaiPutusan = {
    perkara_id: perkara.perkaraId,
    tanggal_putusan: tanggalPutusan,
    status_putusan_id: status.id,
    amar_putusan: amar,
    catatan_putusan: catatan,
    sumber_hukum_id: sumberHukum,
    putusan_verstek: verstek,
    diinput_oleh: akun.username,
    diinput_tanggal: saatKolom,
  };
  langkah.push({
    tabel: "perkara_putusan",
    aksi: "INSERT",
    keterangan: `putusan akhir ${perkara.nomorPerkara} - ${status.nama}${verstek === "Y" ? " (verstek)" : ""}`,
    sql:
      `INSERT INTO perkara_putusan
         (perkara_id, tanggal_putusan, status_putusan_id, amar_putusan, catatan_putusan,
          sumber_hukum_id, putusan_verstek, diinput_oleh, diinput_tanggal)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    params: [
      nilaiPutusan.perkara_id,
      nilaiPutusan.tanggal_putusan,
      nilaiPutusan.status_putusan_id,
      nilaiPutusan.amar_putusan,
      nilaiPutusan.catatan_putusan,
      nilaiPutusan.sumber_hukum_id,
      nilaiPutusan.putusan_verstek,
      nilaiPutusan.diinput_oleh,
      nilaiPutusan.diinput_tanggal,
    ],
  });
  langkah.push(
    penetapan.barisAudit({
      username: akun.username,
      tabel: "perkara_putusan",
      formulir: FORM_PUTUSAN,
      aksi: "tambah",
      nilai: nilaiPutusan,
      perkaraId: perkara.perkaraId,
      ip,
      saat,
      judulSendiri: `tambah Data Putusan Akhir <br />dengan perkara_id [id=${perkara.perkaraId}]`,
    })
  );

  // ---- 2. Pertimbangan hukum ----------------------------------------------
  const nilaiPertimbangan = {
    perkara_id: perkara.perkaraId,
    tanggal_pertimbangan_hukum: tanggalPutusan,
    pertimbangan_hukum: pertimbangan,
    diinput_oleh: akun.username,
    diinput_tanggal: saatKolom,
  };
  langkah.push({
    tabel: "perkara_pertimbangan_hukum",
    aksi: "INSERT",
    keterangan: `pertimbangan hukum ${perkara.nomorPerkara} - ${pertimbangan.length.toLocaleString("id-ID")} aksara`,
    sql:
      `INSERT INTO perkara_pertimbangan_hukum
         (perkara_id, tanggal_pertimbangan_hukum, pertimbangan_hukum, diinput_oleh, diinput_tanggal)
       VALUES (?,?,?,?,?)`,
    params: [
      nilaiPertimbangan.perkara_id,
      nilaiPertimbangan.tanggal_pertimbangan_hukum,
      nilaiPertimbangan.pertimbangan_hukum,
      nilaiPertimbangan.diinput_oleh,
      nilaiPertimbangan.diinput_tanggal,
    ],
  });
  langkah.push(
    penetapan.barisAudit({
      username: akun.username,
      tabel: "perkara_pertimbangan_hukum",
      formulir: FORM_PERTIMBANGAN,
      aksi: "tambah",
      nilai: nilaiPertimbangan,
      perkaraId: perkara.perkaraId,
      ip,
      saat,
      judulSendiri: `tambah Data Pertimbangan Hukum <br />dengan perkara_id [id=${perkara.perkaraId}]`,
    })
  );

  return {
    ok: true,
    jenis: "putusan",
    perkara: { perkaraId: perkara.perkaraId, nomorPerkara: perkara.nomorPerkara },
    atasNama: { username: akun.username, namaLengkap: akun.fullname },
    operator: bersih(minta.operator),
    saat,
    putusan: {
      tanggalPutusan,
      status: status.nama,
      statusPutusanId: status.id,
      verstek: verstek === "Y",
      aksaraAmar: amar.length,
      aksaraPertimbangan: pertimbangan.length,
    },
    langkah,
    andaian,
  };
}

module.exports = {
  FORM_PUTUSAN,
  FORM_PERTIMBANGAN,
  waktuPutusan,
  keadaanPerkara,
  statusSah,
  daftarStatusPutusan,
  susunRencanaPutus,
  // Satu penjalan untuk seluruh tulisan ALETA ke SIPP - satu daftar putih
  // tabel, satu cara mengisi kunci utama pada judul audit.
  jalankanRencana: penetapan.jalankanRencana,
};
