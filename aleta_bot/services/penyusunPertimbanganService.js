/**
 * ============================================================================
 * AGEN PENYUSUN PERTIMBANGAN - PEMBACA FAKTANYA (TAHAP 4)
 * ============================================================================
 *
 * HANYA MEMBACA. Tidak ada satu pun INSERT, UPDATE, atau DELETE - dan ada
 * penjaga yang menuntutnya tetap begitu.
 *
 * Sebabnya bukan kehati-hatian umum. Daftar alat bukti menyatakan bahwa
 * selembar surat SUDAH dicocokkan dengan aslinya, SUDAH bermeterai, SUDAH
 * di-nazegelen, dan SUDAH diparaf Ketua Majelis. Itu kesaksian tentang apa
 * yang terjadi di ruang sidang, bukan fakta yang tersimpan di basis data.
 * Mesin dapat menyusun kalimatnya; mesin tidak dapat menyaksikannya.
 *
 * Yang disusun dari sini diukur pada 548 perkara cerai 2026:
 *   nomor identitas pihak      548/548
 *   nomor kutipan akta nikah   548/548
 *   tanggal kutipan akta nikah 548/548
 *   KUA tempat nikah           543/548
 *   TANGGAL TERBIT KTP         tidak ada kolomnya di SIPP
 */

const db = require("../db_config");

function jalankan(sql, nilai = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, nilai, (galat, baris) => (galat ? gagal(galat) : selesai(baris || [])));
  });
}

function isoTanggal(nilai) {
  if (!nilai) return null;
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return null;
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(
      nilai.getDate()
    ).padStart(2, "0")}`;
  }
  const cocok = String(nilai).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return cocok ? `${cocok[1]}-${cocok[2]}-${cocok[3]}` : null;
}

/** "Pemohon" pada cerai talak, "Penggugat" pada selainnya. */
function peranPihakPertama(jenisPerkara) {
  return /talak|permohonan|Pdt\.P/i.test(String(jenisPerkara || "")) ? "Pemohon" : "Penggugat";
}

/**
 * Fakta untuk menyusun daftar alat bukti satu perkara.
 *
 * perkara_pihak1 dibaca langsung, BUKAN lewat v_pihak_perkara: view itu
 * memaksa MariaDB membentuk seluruh isinya sebelum saringan berlaku - 8,5
 * detik untuk 20 perkara. Di sini yang diminta satu perkara, dan pengguna
 * menunggu di depan layar.
 */
async function bacaFaktaBukti(nomorPerkara) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return { ok: false, alasan: "nomor perkara kosong" };

  const perkara = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara
       FROM perkara p
      WHERE p.nomor_perkara = ?
      LIMIT 1`,
    [nomor]
  );
  if (perkara.length === 0) return { ok: false, alasan: "perkara tidak ditemukan di SIPP" };
  const pokok = perkara[0];

  const [pihak, nikah] = await Promise.all([
    jalankan(
      `SELECT x.nama AS nama, COALESCE(k.nomor_indentitas, '') AS nomorIdentitas
         FROM perkara_pihak1 x
         LEFT JOIN pihak k ON k.id = x.pihak_id
        WHERE x.perkara_id = ?
        ORDER BY x.urutan ASC
        LIMIT 1`,
      [pokok.perkaraId]
    ),
    jalankan(
      `SELECT COALESCE(no_kutipan_akta_nikah, '') AS nomorKutipan,
              tgl_kutipan_akta_nikah AS tanggalKutipan,
              COALESCE(kua_tempat_nikah, '') AS kuaTempatNikah
         FROM perkara_data_pernikahan
        WHERE perkara_id = ?
        LIMIT 1`,
      [pokok.perkaraId]
    ),
  ]);

  return {
    ok: true,
    fakta: {
      nomorPerkara: String(pokok.nomorPerkara || ""),
      jenisPerkara: String(pokok.jenisPerkara || ""),
      penggugat: pihak.length
        ? {
            nama: String(pihak[0].nama || ""),
            nomorIdentitas: String(pihak[0].nomorIdentitas || ""),
            peran: peranPihakPertama(pokok.jenisPerkara),
          }
        : null,
      nikah: nikah.length
        ? {
            nomorKutipan: String(nikah[0].nomorKutipan || ""),
            tanggalKutipan: isoTanggal(nikah[0].tanggalKutipan),
            kuaTempatNikah: String(nikah[0].kuaTempatNikah || ""),
          }
        : null,
    },
  };
}

module.exports = {
  bacaFaktaBukti,
  isoTanggal,
  peranPihakPertama,
};
