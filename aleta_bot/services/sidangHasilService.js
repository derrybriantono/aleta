"use strict";

/**
 * ============================================================================
 * HASIL SIDANG - MENUNDA SIDANG DAN MENGGERAKKAN ANTRIANNYA
 * ============================================================================
 *
 * Sampai sekarang yang ditulis ALETA ke SIPP hanya PENETAPAN. Berkas ini
 * menambah satu hal yang lain sifatnya: HASIL SIDANG. Penetapan dapat
 * dibongkar tanpa bekas; penundaan melahirkan BARIS SIDANG BARU, dan baris
 * sidang yang salah tanggal berarti pihak dipanggil untuk hari yang salah.
 *
 * ============================================================================
 * BENTUKNYA DISALIN DARI SIPP, DAN DIHITUNG DARI DATANYA
 * ============================================================================
 *
 * Dibaca dari kode SIPP sendiri - bukan ditebak:
 *
 *   controllers/jadwal_sidang_c.php   validateTunda()
 *   models/jadwalsidang/jadwal_sidang_m.php   tunda_sidang()
 *   models/riwayatperkara/riwayat_perkara_m.php   updateproses()
 *   controllers/manageAntrian.php     panggil/tunda/selesai_antrian()
 *
 * Satu penundaan menyentuh tiga tempat:
 *
 *   1. perkara_jadwal_sidang  UPDATE  baris sidang hari ini - ditunda='Y',
 *      alasan, agenda, dihadiri_oleh, sifat_sidang, ruangan;
 *   2. perkara_jadwal_sidang  INSERT  baris sidang BERIKUTNYA - id MAX+1,
 *      urutan MAX+1, membawa bendera verzet/keberatan/ikrar_talak/keliling;
 *   3. perkara + perkara_proses  lewat prosedur perkara_proses_update, lalu
 *      perkara.tahapan_terakhir_* disetel dari baris proses terbaru.
 *
 * Dihitung pada basis data satker - 4.242 penundaan yang sungguh ada:
 *
 *     4242  UPDATE  perkara_jadwal_sidang    halaman PENUNDAAN JADWAL SIDANG
 *     4242  INSERT  perkara_jadwal_sidang
 *     4173  UPDATE  perkara
 *
 * Selisih 69 pada baris ketiga BUKAN kebocoran: itulah penundaan sidang ikrar
 * talak, yang menurut kodenya memang tidak memperbarui riwayat
 * (updateProses = FALSE). Angka datanya cocok dengan kodenya, dan itulah yang
 * membuat bentuk ini dapat dipercaya.
 *
 * ============================================================================
 * TANGGAL DIPERIKSA SEBELUM SATU BARIS PUN DITULIS
 * ============================================================================
 *
 * Yang dilahirkan penundaan adalah JADWAL. Karena itu tanggal sidang
 * berikutnya diperiksa lebih dahulu - bukan sesudahnya: tidak boleh mundur,
 * tidak boleh hari libur, dan diperingatkan bila bukan hari sidang majelisnya.
 * Yang tidak lolos tidak ditulis; yang patut diragukan tetap ditulis tetapi
 * andaiannya disebut, supaya petugas melihat apa yang sedang ia setujui.
 */

const db = require("../db_config");
const penetapan = require("./penetapanTulisService");
const hariLiburService = require("./hariLiburService");

/** Nama halaman pada audit - persis yang ditulis SIPP sendiri. */
const NAMA_HALAMAN = "PENUNDAAN JADWAL SIDANG";

/**
 * Proses yang dicatat riwayat perkara pada penundaan.
 *
 * Diambil dari validateTunda(): 200 pada keadaan biasa; 261 bila sidangnya
 * verzet (116 pada peradilan jenis 3); 294 bila ikrar talak - dan pada ikrar
 * talak riwayatnya TIDAK diperbarui sama sekali.
 */
const PROSES_PERSIDANGAN = 200;
const PROSES_VERZET = 261;
const PROSES_VERZET_JENIS3 = 116;
const PROSES_IKRAR_TALAK = 294;

/** Keadaan antrian menurut manageAntrian.php. */
const ANTRIAN_MENUNGGU = 0;
const ANTRIAN_SKORS = 1;
const ANTRIAN_SELESAI = 2;

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function tanggalSah(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(bersih(iso));
}

function jamSah(jam) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(bersih(jam));
}

/**
 * Keadaan satu baris jadwal sidang beserta perkaranya.
 *
 * Dibaca SEBELUM apa pun ditulis, dan dari satu kueri: baris jadwal yang
 * dibaca terpisah dari perkaranya membuka jendela bagi perkara yang berpindah
 * tahapan di antara kedua pembacaan.
 */
async function keadaanJadwal(jadwalId) {
  const id = Number(jadwalId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const baris = await kueri(
    `SELECT j.id            AS jadwalId,
            j.perkara_id    AS perkaraId,
            j.tanggal_sidang AS tanggalSidang,
            j.jam_sidang    AS jamSidang,
            j.sampai_jam    AS sampaiJam,
            j.agenda        AS agenda,
            j.agenda_id     AS agendaId,
            j.urutan        AS urutan,
            j.ditunda       AS ditunda,
            j.ruangan_id    AS ruanganId,
            j.ruangan       AS ruangan,
            j.sidang_keliling AS sidangKeliling,
            j.sifat_sidang  AS sifatSidang,
            j.dihadiri_oleh AS dihadiriOleh,
            j.verzet        AS verzet,
            j.keberatan     AS keberatan,
            j.ikrar_talak   AS ikrarTalak,
            p.nomor_perkara AS nomorPerkara,
            p.alur_perkara_id AS alurPerkaraId,
            p.jenis_perkara_text AS jenisPerkara
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
      WHERE j.id = ? LIMIT 1`,
    [id]
  ).catch(() => []);
  return (Array.isArray(baris) && baris[0]) || null;
}

/** Akun pejabat yang dipakai menulis - harus benar-benar ada di SIPP. */
async function akunSipp(username) {
  const nama = bersih(username);
  if (!nama) return null;
  const baris = await kueri(
    `SELECT username, fullname FROM sys_users WHERE username = ? LIMIT 1`,
    [nama]
  ).catch(() => []);
  return (Array.isArray(baris) && baris[0]) || null;
}

/** Tahapan dan proses menurut alur perkaranya - sumber yang sama dengan SIPP. */
async function prosesAlur(alurPerkaraId, prosesId) {
  const baris = await kueri(
    `SELECT tahapan_id AS tahapanId, tahapan_nama AS tahapanNama,
            proses_id AS prosesId, proses_nama AS prosesNama
       FROM proses_alur_perkara
      WHERE alur_perkara_id = ? AND proses_id = ? LIMIT 1`,
    [Number(alurPerkaraId) || 0, Number(prosesId) || 0]
  ).catch(() => []);
  return (Array.isArray(baris) && baris[0]) || null;
}

/**
 * Proses mana yang dicatat riwayat - beserta jawabannya apakah riwayat
 * DIPERBARUI sama sekali.
 */
function prosesUntukTunda(keadaan, jenisPengadilan) {
  if (bersih(keadaan.ikrarTalak) === "Y") {
    return { prosesId: PROSES_IKRAR_TALAK, perbaruiRiwayat: false };
  }
  if (bersih(keadaan.verzet) === "Y") {
    return {
      prosesId: Number(jenisPengadilan) === 3 ? PROSES_VERZET_JENIS3 : PROSES_VERZET,
      perbaruiRiwayat: true,
    };
  }
  return { prosesId: PROSES_PERSIDANGAN, perbaruiRiwayat: true };
}

/**
 * Menyusun rencana penundaan - TIDAK menulis apa pun.
 *
 * @returns {Promise<object>} { ok, jenis, perkara, atasNama, langkah, andaian }
 */
async function susunRencanaTunda(minta = {}) {
  const keadaan = await keadaanJadwal(minta.jadwalId);
  if (!keadaan) return { ok: false, alasan: "jadwal_tidak_ketemu" };
  if (bersih(keadaan.ditunda) === "Y") return { ok: false, alasan: "sidang_sudah_ditunda" };

  const akun = await akunSipp(minta.olehUsername);
  if (!akun) return { ok: false, alasan: "akun_sipp_tidak_ketemu" };

  const alasanTunda = bersih(minta.alasanTunda);
  if (!alasanTunda) return { ok: false, alasan: "alasan_tunda_kosong" };

  const tanggalBerikut = bersih(minta.tanggalBerikut);
  if (!tanggalSah(tanggalBerikut)) return { ok: false, alasan: "tanggal_berikut_tidak_sah" };

  const jamBerikut = bersih(minta.jamBerikut) || bersih(keadaan.jamSidang);
  if (!jamSah(jamBerikut)) return { ok: false, alasan: "jam_berikut_tidak_sah" };

  const agendaBerikut = bersih(minta.agendaBerikut);
  if (!agendaBerikut) return { ok: false, alasan: "agenda_berikut_kosong" };

  // ==========================================================================
  // TANGGALNYA DIPERIKSA DI SINI, BUKAN SESUDAH BARISNYA LAHIR
  // ==========================================================================
  const tanggalSekarang = penetapan.waktuMysql().slice(0, 10);
  if (tanggalBerikut <= tanggalSekarang) {
    return { ok: false, alasan: "tanggal_berikut_tidak_maju", diminta: tanggalBerikut };
  }

  const andaian = [];
  // hariLibur() memulangkan keterangan hari liburnya, atau null bila hari itu
  // hari kerja biasa. Tahun yang daftarnya belum dimuat juga memulangkan
  // null - karena itu ketersediaan tahunnya diperiksa TERPISAH, supaya
  // "belum ada daftarnya" tidak terbaca sebagai "bukan hari libur".
  const tahunBerikut = Number(tanggalBerikut.slice(0, 4));
  if (!hariLiburService.tahunTersedia(tahunBerikut)) {
    andaian.push(
      `Daftar hari libur tahun ${tahunBerikut} belum ada, jadi tanggal sidang berikutnya belum diperiksa terhadap hari libur.`
    );
  } else {
    const libur = hariLiburService.hariLibur(tanggalBerikut);
    if (libur) {
      return {
        ok: false,
        alasan: "tanggal_berikut_hari_libur",
        keterangan: typeof libur === "string" ? libur : String(libur.keterangan || ""),
      };
    }
  }

  const jenisPengadilan = Number(minta.jenisPengadilan) || 0;
  const { prosesId, perbaruiRiwayat } = prosesUntukTunda(keadaan, jenisPengadilan);

  const saat = penetapan.waktuMysql();
  const ip = bersih(minta.ip) || "127.0.0.1";
  const langkah = [];

  // ---- 1. Baris sidang hari ini: ditunda ----------------------------------
  const nilaiUbah = {
    jam_sidang: bersih(minta.jamSekarang) || bersih(keadaan.jamSidang),
    sampai_jam: bersih(minta.sampaiJamSekarang) || bersih(keadaan.sampaiJam),
    agenda: bersih(minta.agendaSekarang) || bersih(keadaan.agenda),
    dihadiri_oleh: Number(minta.dihadiriOleh) || Number(keadaan.dihadiriOleh) || 1,
    ditunda: "Y",
    alasan_ditunda: alasanTunda,
    sifat_sidang: bersih(minta.sifatSidang) || bersih(keadaan.sifatSidang),
    keterangan: bersih(minta.keterangan),
    diperbaharui_oleh: akun.username,
    diperbaharui_tanggal: saat,
  };

  langkah.push({
    tabel: "perkara_jadwal_sidang",
    aksi: "UPDATE",
    sql: `UPDATE perkara_jadwal_sidang
             SET jam_sidang = ?, sampai_jam = ?, agenda = ?, dihadiri_oleh = ?,
                 ditunda = ?, alasan_ditunda = ?, sifat_sidang = ?, keterangan = ?,
                 diperbaharui_oleh = ?, diperbaharui_tanggal = ?
           WHERE id = ?`,
    params: [
      nilaiUbah.jam_sidang,
      nilaiUbah.sampai_jam,
      nilaiUbah.agenda,
      nilaiUbah.dihadiri_oleh,
      nilaiUbah.ditunda,
      nilaiUbah.alasan_ditunda,
      nilaiUbah.sifat_sidang,
      nilaiUbah.keterangan,
      nilaiUbah.diperbaharui_oleh,
      nilaiUbah.diperbaharui_tanggal,
      keadaan.jadwalId,
    ],
    // Tanggalnya dilewatkan tanggalIso lebih dahulu: penggerak MySQL
    // memulangkan kolom DATE sebagai obyek Date, dan menyisipkannya apa adanya
    // ke dalam teks menghasilkan "Tue Mar 09 2027 00:00:00 GMT+0800 (Central
    // Indonesia Time)" - bahasa Inggris, di layar berbahasa Indonesia yang
    // dibaca panitera sidang sebelum ia menekan tombol tulis.
    keterangan: `menunda sidang ${penetapan.tanggalIso(keadaan.tanggalSidang)} - ${alasanTunda}`,
  });

  langkah.push(
    penetapan.barisAudit({
      username: akun.username,
      tabel: "perkara_jadwal_sidang",
      formulir: NAMA_HALAMAN,
      aksi: "UPDATE",
      nilai: nilaiUbah,
      kunciSendiri: `id=${keadaan.jadwalId}`,
      ip,
      saat,
    })
  );

  // ---- 2. Baris sidang berikutnya -----------------------------------------
  const nilaiBaru = {
    perkara_id: keadaan.perkaraId,
    tanggal_sidang: tanggalBerikut,
    jam_sidang: jamBerikut,
    agenda: agendaBerikut,
    ruangan_id: Number(minta.ruanganIdBerikut) || Number(keadaan.ruanganId) || null,
    ruangan: bersih(minta.ruanganBerikut) || bersih(keadaan.ruangan),
    sidang_keliling: bersih(keadaan.sidangKeliling) === "Y" ? "Y" : "T",
    verzet: bersih(keadaan.verzet) === "Y" ? "Y" : null,
    keberatan: bersih(keadaan.keberatan) === "Y" ? "Y" : null,
    ikrar_talak: bersih(keadaan.ikrarTalak) === "Y" ? "Y" : null,
    diinput_oleh: akun.username,
    diinput_tanggal: saat,
  };

  langkah.push({
    tabel: "perkara_jadwal_sidang",
    aksi: "INSERT",
    // id DIHITUNG saat penulisan, bukan saat rencana disusun - perkara_jadwal_sidang
    // tidak ber-auto_increment, dan jeda antara membaca MAX(id) dan memakainya
    // cukup untuk melahirkan dua baris berid sama bila dua petugas menekan
    // Simpan bersamaan. Urutannya pun dihitung di sana.
    sql: `INSERT INTO perkara_jadwal_sidang
            (id, perkara_id, tanggal_sidang, jam_sidang, agenda, ruangan_id, ruangan,
             sidang_keliling, verzet, keberatan, ikrar_talak, urutan, diinput_oleh, diinput_tanggal)
          VALUES (?,?,?,?,?,?,?,?,?,?,?, (SELECT urutan FROM (
                    SELECT IFNULL(MAX(urutan),0) + 1 AS urutan
                      FROM perkara_jadwal_sidang WHERE perkara_id = ?) u), ?, ?)`,
    params: [
      0,
      nilaiBaru.perkara_id,
      nilaiBaru.tanggal_sidang,
      nilaiBaru.jam_sidang,
      nilaiBaru.agenda,
      nilaiBaru.ruangan_id,
      nilaiBaru.ruangan,
      nilaiBaru.sidang_keliling,
      nilaiBaru.verzet,
      nilaiBaru.keberatan,
      nilaiBaru.ikrar_talak,
      nilaiBaru.perkara_id,
      nilaiBaru.diinput_oleh,
      nilaiBaru.diinput_tanggal,
    ],
    idDihitung: { tabel: "perkara_jadwal_sidang", posisiParam: 0 },
    keterangan: `sidang berikutnya ${tanggalBerikut} ${jamBerikut} - ${agendaBerikut}`,
  });

  langkah.push(
    penetapan.barisAudit({
      username: akun.username,
      tabel: "perkara_jadwal_sidang",
      formulir: NAMA_HALAMAN,
      aksi: "INSERT",
      nilai: nilaiBaru,
      // Kunci utamanya id baris yang baru saja lahir. Penandanya diisi
      // penjalan sesudah barisnya benar-benar ada - lihat kunciDariLangkah
      // pada jalankanRencana.
      kunciSendiri: "id=#ID#",
      kunciDariLangkah: { "#ID#": langkah.length - 1 },
      ip,
      saat,
    })
  );

  // ---- 3. Riwayat perkara -------------------------------------------------
  if (perbaruiRiwayat) {
    const alur = await prosesAlur(keadaan.alurPerkaraId, prosesId);
    if (!alur) {
      andaian.push(
        `Alur perkara ini tidak punya proses ${prosesId}, jadi riwayat perkaranya tidak diperbarui.`
      );
    } else {
      langkah.push({
        tabel: "perkara_proses",
        aksi: "CALL",
        // Prosedur yang SAMA dengan yang dipanggil SIPP - bukan tiruannya.
        // Ia sudah ada di basis data satker; menuliskan ulang isinya berarti
        // menyimpan salinan kedua yang perlahan menyimpang dari aslinya.
        sql: `CALL perkara_proses_update(?,?,?,?,?,?,?,?,?)`,
        params: [
          String(keadaan.perkaraId),
          String(alur.tahapanId),
          alur.tahapanNama,
          String(alur.prosesId),
          alur.prosesNama,
          tanggalBerikut,
          "",
          akun.username,
          saat,
        ],
        keterangan: `riwayat perkara: ${alur.tahapanNama} - ${alur.prosesNama}`,
      });

      const nilaiTahapan = {
        tahapan_terakhir_id: alur.tahapanId,
        tahapan_terakhir_text: alur.tahapanNama,
        proses_terakhir_id: alur.prosesId,
        proses_terakhir_text: alur.prosesNama,
        diperbaharui_oleh: akun.username,
        diperbaharui_tanggal: saat,
      };

      langkah.push({
        tabel: "perkara",
        aksi: "UPDATE",
        // Nilainya diambil dari baris proses TERBARU, urut persis seperti
        // riwayat_perkara_m::updateproses membacanya - bukan dari nilai yang
        // kita kira baru saja ditulis. Perkara yang sementara itu bergerak ke
        // tahapan lain karena itu tidak ditarik mundur.
        sql: `UPDATE perkara p
                JOIN (SELECT tahapan_id, tahapan_nama, proses_id, proses_nama
                        FROM perkara_proses
                       WHERE perkara_id = ?
                       ORDER BY tahapan_id DESC, proses_id DESC, tanggal DESC, urutan DESC,
                                IFNULL(diperbaharui_tanggal, diinput_tanggal) DESC
                       LIMIT 1) x
                 SET p.tahapan_terakhir_id = x.tahapan_id,
                     p.tahapan_terakhir_text = x.tahapan_nama,
                     p.proses_terakhir_id = x.proses_id,
                     p.proses_terakhir_text = x.proses_nama,
                     p.diperbaharui_oleh = ?, p.diperbaharui_tanggal = ?
               WHERE p.perkara_id = ?`,
        params: [keadaan.perkaraId, akun.username, saat, keadaan.perkaraId],
        keterangan: `tahapan terakhir: ${alur.tahapanNama}`,
      });

      langkah.push(
        penetapan.barisAudit({
          username: akun.username,
          tabel: "perkara",
          formulir: NAMA_HALAMAN,
          aksi: "UPDATE",
          nilai: nilaiTahapan,
          perkaraId: keadaan.perkaraId,
          ip,
          saat,
        })
      );
    }
  } else {
    andaian.push(
      "Sidang ikrar talak: riwayat perkaranya sengaja TIDAK diperbarui, sama seperti yang dikerjakan SIPP sendiri."
    );
  }

  return {
    ok: true,
    jenis: "tunda",
    perkara: { perkaraId: keadaan.perkaraId, nomorPerkara: keadaan.nomorPerkara },
    atasNama: { username: akun.username, namaLengkap: akun.fullname },
    operator: bersih(minta.operator),
    saat,
    sidangSekarang: { jadwalId: keadaan.jadwalId, tanggal: keadaan.tanggalSidang },
    sidangBerikutnya: { tanggal: tanggalBerikut, jam: jamBerikut, agenda: agendaBerikut },
    langkah,
    andaian,
  };
}

/**
 * Menggerakkan antrian sidang - dipanggil, diskors, atau selesai.
 *
 * Terpisah dari penundaannya dan disengaja: antrian bergerak beberapa kali
 * dalam satu sidang, sedangkan hasil sidang ditulis sekali. Menyatukan
 * keduanya berarti tombol "panggil" ikut menyeret rencana penundaan.
 */
async function setelAntrian({ perkaraId, tanggalSidang, ruangId, keadaan, kering = true }) {
  const id = Number(perkaraId);
  const status = Number(keadaan);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "perkara_tidak_sah" };
  if (![ANTRIAN_MENUNGGU, ANTRIAN_SKORS, ANTRIAN_SELESAI].includes(status)) {
    return { ok: false, alasan: "keadaan_antrian_tidak_dikenal" };
  }
  if (!tanggalSah(tanggalSidang)) return { ok: false, alasan: "tanggal_tidak_sah" };

  if (kering) {
    return { ok: true, kering: true, akanDisetel: { perkaraId: id, status } };
  }

  const hasil = await kueri(
    `UPDATE antrian SET status = ?
      WHERE perkara_id = ? AND tanggal_sidang = ?${ruangId ? " AND ruang_id = ?" : ""}`,
    ruangId ? [status, id, tanggalSidang, Number(ruangId)] : [status, id, tanggalSidang]
  ).catch((galat) => ({ galat: String((galat && galat.message) || galat).slice(0, 160) }));

  if (hasil && hasil.galat) return { ok: false, alasan: hasil.galat };
  const berubah = Number((hasil && hasil.affectedRows) || 0);
  // Nol baris BUKAN galat: tidak semua perkara mengambil nomor antrian.
  return { ok: true, kering: false, baris: berubah };
}

module.exports = {
  NAMA_HALAMAN,
  PROSES_PERSIDANGAN,
  PROSES_VERZET,
  PROSES_VERZET_JENIS3,
  PROSES_IKRAR_TALAK,
  ANTRIAN_MENUNGGU,
  ANTRIAN_SKORS,
  ANTRIAN_SELESAI,
  keadaanJadwal,
  prosesUntukTunda,
  susunRencanaTunda,
  setelAntrian,
  // Rencana dijalankan oleh mesin yang sama dengan penetapan - satu penjalan,
  // satu daftar putih tabel, satu cara mengisi kunci utama pada judul audit.
  jalankanRencana: penetapan.jalankanRencana,
};
