"use strict";

/**
 * ============================================================================
 * PENETAPAN MEDIATOR DARI JADWAL SIDANG - DITULIS PERSIS SEPERTI BLANGKO SIPP
 * ============================================================================
 *
 * Perbaikan 1 Oktober 2026 (butir J1). Tombol "mediator" di Jadwal Sidang
 * sampai 1.176.0 hanya membuka keterangan, dan menyebut terus terang bahwa
 * "belum ada jalur yang menuliskannya". Pengguna meminta memilih mediator
 * langsung, seperti di SIPP. Ini jalur tulis SIPP yang BARU - alasannya
 * tertulis di sini, sesuai aturan: penunjukan mediator dikerjakan pada hari
 * sidang pertama (118 dari 118 penetapan 2025-2026 bertanggal sama dengan
 * sidangnya), di layar yang sedang dibuka panitera sidang, dan berpindah ke
 * SIPP hanya untuk satu borang adalah yang dikeluhkan.
 *
 * ============================================================================
 * BENTUKNYA DIBACA DARI KODE SIPP, LALU DIUKUR PADA DATA SATKER
 * ============================================================================
 *
 * Kode: controllers/tab_mediasi_c.php insert_update_penetapan_mediasi()
 *       models/mediasi/mediasi_m.php  add_mediasi, add_perkara_mediator,
 *         add_data_dukung_mediasi, updateproses, cancelproses, add_audittrail
 *       models/mediasi/jadwal_mediasi_m.php add_jadwal_mediasi
 *       views/perkara_tab/tab_mediasi_tambah.php (jns=1, urutan=1)
 *
 * Satu penetapan (act tambah, mediasi pertama) menulis - diukur pada
 * sipp_donggala, mediasi_id 780 (8 Sep 2026, akun sudarmin):
 *
 *   perkara_mediator            INSERT  id MAX+1 - TANPA audit
 *   perkara_mediasi             INSERT  mediasi_id IFNULL(MAX+1,1) + audit
 *   perkara_data_dukung_mediasi INSERT  #pilih_mediator# I_03 + audit (isi
 *                                       tabel audit KOSONG - SIPP mengirim
 *                                       $data_add yang tidak ada di sana)
 *   perkara_jadwal_mediasi      INSERT  id MAX+1, urutan 1, tempat
 *                                       "Ditentukan Kemudian" + audit
 *   perkara_proses              110 Penetapan Mediator, 120 Penetapan Tanggal
 *                                       Mediasi, 121 Mulai Mediasi (urutan 1)
 *   perkara                     tahapan_terakhir_* / proses_terakhir_*
 *
 * Ketiga baris audit: tablename perkara_mediasi, formname "Add Mediasi",
 * action INSERT, judul seperti di bawah - sama persis dengan baris SIPP.
 *
 * Yang diukur dan sengaja ditiru (sipp_donggala, 1 Okt 2026):
 *   - diinput_tanggal perkara_mediasi / perkara_mediator / perkara_jadwal_mediasi
 *     ditulis SIPP dengan date("Y-m-d h:i:s") - JAM 12: 0 dari 754, 762, 754
 *     baris berjam >= 13. perkara_proses dan sys_audittrail 24 jam.
 *   - mediator_text / nama_mediator = mediator.nama_gelar (144 dari 192 baris
 *     sejak 2024 sama dengan nama_gelar, NOL sama dengan nama).
 *   - nomor SK: 47 sama dengan nomor perkara, 67 kosong, 4 lain (dari 118) -
 *     layar mengisinya dengan nomor perkara, dapat diubah/dikosongkan.
 *   - jenis penetapan: "Majelis Hakim memilih" 496, "Pihak sepakat" 208.
 *
 * ============================================================================
 * PERKARA PADA perkara.tahapan_terakhir_* - AKHIRNYA SAMA DENGAN SIPP
 * ============================================================================
 *
 * SIPP menjalankan cancelproses+updateproses tiga kali; tiap updateproses
 * MENIMPA perkara dengan baris perkara_proses ber-proses_id terbesar SEBELUM
 * barisnya sendiri disisipkan. Yang tersisa sesudah ketiganya: baris terbesar
 * di luar 121 yang baru. Itulah yang ditulis sekali di sini - hasil akhirnya
 * sama, tanpa enam UPDATE antara yang saling menimpa.
 *
 * ============================================================================
 * KERING SEBAGAI BAWAAN; DAFTAR PUTIH TABEL SENDIRI
 * ============================================================================
 *
 * Sama dengan penetapan dan penundaan: tanpa { kering: false } yang tegas,
 * yang dipulangkan hanya rencananya. Tabelnya dijaga daftar putih sendiri -
 * DAFTAR_TABEL penetapanTulisService milik penulis penetapan dan sengaja
 * tidak dilebarkan dari sini.
 */

/** Tabel yang boleh ditulis jalur ini - daftar putih. */
const DAFTAR_TABEL_MEDIATOR = new Set([
  "perkara_mediator",
  "perkara_mediasi",
  "perkara_data_dukung_mediasi",
  "perkara_jadwal_mediasi",
  "perkara_proses",
  "perkara",
  "sys_audittrail",
]);

/** Nama borang pada sys_audittrail - persis add_audittrail() mediasi_m. */
const NAMA_BORANG = "Add Mediasi";

/** Pilihan "Jenis Penetapan Mediator" - nilai <option> blangko SIPP apa adanya. */
const JENIS_PENETAPAN = [
  {
    nilai: "sepakat untuk menyerahkan kepada Majelis Hakim untuk menunjuk Mediator dari Daftar Mediator",
    label: "Majelis Hakim Memilih Mediator",
  },
  { nilai: "sepakat memilih Mediator", label: "Pihak Sepakat Memilih Mediator" },
];

/** Proses yang dicatat riwayat perkara - urutan SIPP. */
const PROSES_MEDIASI = [110, 120, 121];

/** Penanda id yang baru lahir saat ditulis. */
const TANDA = {
  mediasi: "#MEDIASI_ID#",
  mediator: "#PERKARA_MEDIATOR_ID#",
  jadwal: "#JADWAL_MEDIASI_ID#",
};

/** Arti hasil_mediasi - <option> tab_mediasi_edit2.php. */
const HASIL_MEDIASI = {
  Y1: "Berhasil dengan akta perdamaian",
  Y2: "Berhasil dengan pencabutan",
  S: "Berhasil sebagian",
  T: "Tidak berhasil",
  D: "Tidak dapat dilaksanakan",
};

/** Arti perkara_jadwal_mediasi.dihadiri_oleh - jadwal_mediasi_p_edit.php. */
const KEHADIRAN_MEDIASI = {
  1: "Semua pihak",
  2: "Penggugat saja",
  3: "Tergugat saja",
  4: "Semua pihak tidak hadir",
};

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function tanggalSah(nilai) {
  const teks = bersih(nilai).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) ? teks : "";
}

/**
 * Jam dua belas ala PHP date("h") - 13:05 jadi 01:05, 00:30 jadi 12:30.
 * Sama dengan waktuPutusan di putusanTulisService.
 */
function waktuDuaBelas(saat24) {
  const cocok = bersih(saat24).match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!cocok) return bersih(saat24);
  const jam = ((Number(cocok[2]) + 11) % 12) + 1;
  return `${cocok[1]} ${String(jam).padStart(2, "0")}:${cocok[3]}:${cocok[4]}`;
}

/** Hari dalam pekan untuk tanggal ISO - 0 Minggu, 6 Sabtu. Tanpa zona waktu. */
function hariDalamPekan(iso) {
  const [t, b, h] = iso.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h)).getUTCDay();
}

/** Tabel deskripsi audit persis fetch_description() SIPP. */
function keteranganAudit(nilai) {
  const baris = Object.entries(nilai)
    .map(([kolom, isi]) => `<tr><td>${kolom}</td><td>${isi === null || isi === undefined ? "" : String(isi)}</td></tr>`)
    .join("");
  return (
    `<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1">` +
    `<tr><th>Nama Kolom</th><th>Nilai</th></tr>${baris}</table>`
  );
}

function barisAudit({ saat, ip, username, judul, nilai }) {
  return {
    tabel: "sys_audittrail",
    aksi: "INSERT",
    sql:
      "INSERT INTO sys_audittrail (datetime, ipaddress, username, tablename, formname, action, title, description) " +
      "VALUES (?,?,?,?,?,?,?,?)",
    params: [
      saat,
      bersih(ip).slice(0, 15),
      bersih(username).slice(0, 30),
      "perkara_mediasi",
      NAMA_BORANG,
      "INSERT",
      judul,
      keteranganAudit(nilai),
    ],
    keterangan: `catatan audit "${judul.split(" <br />")[0]}" atas nama ${username}`,
  };
}

function sisip(tabel, nilai, keterangan) {
  const kolom = Object.keys(nilai);
  return {
    tabel,
    aksi: "INSERT",
    sql: `INSERT INTO ${tabel} (${kolom.join(", ")}) VALUES (${kolom.map(() => "?").join(",")})`,
    params: kolom.map((k) => nilai[k]),
    keterangan,
  };
}

function buatLayanan(deps = {}) {
  const kueri =
    deps.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  // Uji rilis 9 Okt 2026 (pola kasus 273): seluruh langkah satu penetapan
  // mediator = SATU transaksi. Tanpa itu langkah yang gagal di tengah
  // meninggalkan perkara_mediasi tertulis sendirian, dan penekanan ulang
  // ditolak "Data Mediasi Sudah Tersimpan" - setengah jadi selamanya.
  // deps.kueri tanpa deps.transaksi (uji lama) = tanpa transaksi.
  const transaksi =
    deps.transaksi ||
    (deps.kueri ? (kerja) => kerja(kueri) : (kerja) => require("./transaksiSipp").denganTransaksi(kerja));
  // Jam basis data SIPP (24 jam) - bukan jam container. Lihat waktuBasisData.
  const waktu =
    deps.waktu || (() => require("./penetapanTulisService").waktuBasisData());

  async function satu(sql, params) {
    const baris = await kueri(sql, params);
    return (Array.isArray(baris) && baris[0]) || null;
  }

  /** Daftar mediator yang ditawarkan popup SIPP: aktif = 'Y'. */
  async function daftarMediator(perkaraId) {
    const baris = await kueri(
      `SELECT m.id, m.status_mediator AS status, m.nama, m.nama_gelar AS namaGelar,
              m.no_sertifikasi AS noSertifikasi, m.hakim_id AS hakimId
         FROM mediator m
        WHERE m.aktif = 'Y'
        ORDER BY m.status_mediator, m.nama`,
      []
    );
    const majelis = new Set();
    const id = Number(perkaraId);
    if (Number.isInteger(id) && id > 0) {
      const hk = await kueri(
        `SELECT hakim_id AS hakimId FROM perkara_hakim_pn WHERE perkara_id = ? AND aktif = 'Y'`,
        [id]
      ).catch(() => []);
      for (const h of Array.isArray(hk) ? hk : []) majelis.add(Number(h.hakimId));
    }
    return (Array.isArray(baris) ? baris : []).map((m) => ({
      id: Number(m.id),
      status: bersih(m.status),
      nama: bersih(m.nama),
      namaGelar: bersih(m.namaGelar) || bersih(m.nama),
      noSertifikasi: bersih(m.noSertifikasi),
      // Keterangan, BUKAN larangan: 25 dari 118 penetapan 2025-2026 menunjuk
      // anggota majelis perkaranya sendiri.
      anggotaMajelis: m.hakimId !== null && majelis.has(Number(m.hakimId)),
    }));
  }

  /**
   * Proses mediasi satu perkara - untuk rincian Jadwal Sidang (J7) dan untuk
   * menolak penetapan kedua. Hanya SELECT.
   */
  async function prosesMediasi(perkaraId) {
    const id = Number(perkaraId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "perkara_tidak_sah" };
    const mediasi = await kueri(
      `SELECT mediasi_id AS mediasiId, tahapan_id AS tahapanId, jenis_mediasi AS jenisMediasi,
              DATE_FORMAT(penetapan_penunjukan_mediator, '%Y-%m-%d') AS penetapan,
              nomor_sk_penetapan_mediator AS nomorSk, mediator_text AS mediator,
              status_mediator AS statusMediator,
              DATE_FORMAT(dimulai_mediasi, '%Y-%m-%d') AS mulai,
              DATE_FORMAT(keputusan_mediasi, '%Y-%m-%d') AS keputusan,
              hasil_mediasi AS hasil,
              DATE_FORMAT(tgl_laporan_mediator, '%Y-%m-%d') AS laporan,
              DATE_FORMAT(mediasi_berhasil, '%Y-%m-%d') AS berhasil,
              DATE_FORMAT(mediasi_gagal, '%Y-%m-%d') AS gagal,
              catatan_mediasi AS catatan
         FROM perkara_mediasi
        WHERE perkara_id = ?
        ORDER BY mediasi_id ASC`,
      [id]
    );
    const daftar = Array.isArray(mediasi) ? mediasi : [];
    const idMediasi = daftar.map((m) => Number(m.mediasiId)).filter((n) => n > 0);
    let jadwal = [];
    if (idMediasi.length > 0) {
      const baris = await kueri(
        `SELECT mediasi_id AS mediasiId, urutan, DATE_FORMAT(tanggal_mediasi, '%Y-%m-%d') AS tanggal,
                TIME_FORMAT(jam_mediasi, '%H:%i') AS jam, TIME_FORMAT(sampai_jam, '%H:%i') AS sampaiJam,
                tempat, dihadiri_oleh AS dihadiriOleh, ditunda
           FROM perkara_jadwal_mediasi
          WHERE mediasi_id IN (${idMediasi.map(() => "?").join(",")})
          ORDER BY mediasi_id ASC, urutan ASC`,
        idMediasi
      );
      jadwal = (Array.isArray(baris) ? baris : []).map((j) => ({
        mediasiId: Number(j.mediasiId),
        urutan: Number(j.urutan) || 0,
        tanggal: tanggalSah(j.tanggal),
        jam: bersih(j.jam),
        sampaiJam: bersih(j.sampaiJam),
        tempat: bersih(j.tempat),
        dihadiriOleh: j.dihadiriOleh === null || j.dihadiriOleh === undefined ? null : Number(j.dihadiriOleh),
        kehadiran: KEHADIRAN_MEDIASI[Number(j.dihadiriOleh)] || "",
        ditunda: bersih(j.ditunda).toUpperCase() === "Y",
      }));
    }
    return {
      ok: true,
      mediasi: daftar.map((m) => ({
        mediasiId: Number(m.mediasiId),
        tahapanId: Number(m.tahapanId) || 0,
        jenisMediasi: Number(m.jenisMediasi) || 0,
        penetapan: tanggalSah(m.penetapan),
        nomorSk: bersih(m.nomorSk),
        mediator: bersih(m.mediator).replace(/<br\s*\/?>/gi, ", "),
        statusMediator: bersih(m.statusMediator),
        mulai: tanggalSah(m.mulai),
        keputusan: tanggalSah(m.keputusan),
        hasil: bersih(m.hasil),
        hasilSebutan: HASIL_MEDIASI[bersih(m.hasil)] || "",
        laporan: tanggalSah(m.laporan),
        berhasil: tanggalSah(m.berhasil),
        gagal: tanggalSah(m.gagal),
        catatan: bersih(m.catatan),
        jadwal: jadwal.filter((j) => j.mediasiId === Number(m.mediasiId)),
      })),
    };
  }

  /** Akun SIPP atas nama siapa penetapan ditulis - diturunkan dari perkaranya. */
  async function akunPerkara(perkaraId) {
    const hakim = await satu(
      `SELECT b.username, b.fullname
         FROM perkara_hakim_pn a
         JOIN v_users b ON b.hakim_id = a.hakim_id
        WHERE b.block = 0 AND a.aktif = 'Y' AND a.perkara_id = ?
        ORDER BY a.urutan
        LIMIT 1`,
      [perkaraId]
    ).catch(() => null);
    const panitera = await satu(
      `SELECT d.username, d.fullname
         FROM perkara_panitera_pn c
         JOIN v_users d ON d.panitera_id = c.panitera_id
        WHERE d.block = 0 AND c.aktif = 'Y' AND c.perkara_id = ?
        LIMIT 1`,
      [perkaraId]
    ).catch(() => null);
    return {
      hakim: hakim && bersih(hakim.username) ? { username: bersih(hakim.username), namaLengkap: bersih(hakim.fullname) } : null,
      panitera:
        panitera && bersih(panitera.username)
          ? { username: bersih(panitera.username), namaLengkap: bersih(panitera.fullname) }
          : null,
    };
  }

  /**
   * Menyusun rencana tulis - seluruh pemeriksaan blangko SIPP dikerjakan di
   * sini, SEBELUM satu baris pun ditulis.
   */
  async function susunRencanaMediator(minta = {}) {
    const perkaraId = Number(minta.perkaraId);
    if (!Number.isInteger(perkaraId) || perkaraId <= 0) return { ok: false, alasan: "Perkara tidak dikenali." };
    const mediatorId = Number(minta.mediatorId);
    if (!Number.isInteger(mediatorId) || mediatorId <= 0) return { ok: false, alasan: "Nama Mediator wajib dipilih." };
    const tanggal = tanggalSah(minta.tanggalPenetapan);
    if (!tanggal) return { ok: false, alasan: "Tanggal Penetapan Mediator wajib diisi (tgl/bln/tahun)." };
    const jenis = JENIS_PENETAPAN.find((j) => j.nilai === bersih(minta.jenisPenetapan));
    if (!jenis) return { ok: false, alasan: "Jenis Penetapan Mediator wajib dipilih." };
    const nomorSk = bersih(minta.nomorSk);
    if (nomorSk.length > 50) return { ok: false, alasan: "No. Penetapan Mediator paling panjang 50 huruf." };
    const operator = bersih(minta.operator);
    if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };

    const perkara = await satu(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, p.alur_perkara_id AS alurPerkaraId,
              DATE_FORMAT(pp.sidang_pertama, '%Y-%m-%d') AS sidangPertama
         FROM perkara p
         LEFT JOIN perkara_penetapan pp ON pp.perkara_id = p.perkara_id
        WHERE p.perkara_id = ?
        LIMIT 1`,
      [perkaraId]
    );
    if (!perkara) return { ok: false, alasan: "Perkara tidak ditemukan di SIPP." };
    if (!tanggalSah(perkara.sidangPertama)) {
      return { ok: false, alasan: "Data Penetapan Sidang Tidak Ditemukan." };
    }

    // Pemeriksaan tanggal - urutannya urutan SIPP.
    const sebelumnya = await satu(
      `SELECT DATE_FORMAT(keputusan_mediasi, '%Y-%m-%d') AS keputusan
         FROM perkara_mediasi
        WHERE perkara_id = ? AND mediasi_id = (SELECT MAX(mediasi_id) FROM perkara_mediasi WHERE perkara_id = ?)`,
      [perkaraId, perkaraId]
    ).catch(() => null);
    const keputusanSebelumnya = tanggalSah(sebelumnya && sebelumnya.keputusan);
    if (keputusanSebelumnya && tanggal < keputusanSebelumnya) {
      return { ok: false, alasan: "Tanggal Penetapan Mediator Tidak Boleh Sebelum Tanggal Kesepakatan Mediasi Sebelumnya." };
    }
    const saat = bersih(await waktu());
    const hariIni = saat.slice(0, 10);
    if (tanggalSah(hariIni) && tanggal > hariIni) {
      return { ok: false, alasan: `Tanggal Penetapan Mediator Tidak Boleh Melebihi Hari ini (${hariIni}).` };
    }
    if (tanggal < perkara.sidangPertama) {
      return { ok: false, alasan: "Tanggal Penetapan Mediator Tidak Boleh Kurang Dari Tanggal Sidang Pertama." };
    }
    const hari = hariDalamPekan(tanggal);
    if (hari === 0 || hari === 6) {
      return { ok: false, alasan: "Tidak Dapat memilih Tanggal Penetapan Mediator diluar hari kerja (Sabtu - Minggu)." };
    }

    // Penetapan pertama hanya sekali - persis penjaga "Data Mediasi Sudah
    // Tersimpan" SIPP. Mengganti mediator tetap di SIPP (Edit Penetapan).
    const sudah = await satu(
      `SELECT mediasi_id AS mediasiId, mediator_text AS mediator
         FROM perkara_mediasi
        WHERE perkara_id = ? AND tahapan_id = 10 AND jenis_mediasi = 1
        LIMIT 1`,
      [perkaraId]
    );
    if (sudah) {
      return {
        ok: false,
        alasan: `Data Mediasi Sudah Tersimpan (mediator ${bersih(sudah.mediator) || "-"}). Mengganti mediator dikerjakan lewat Edit Penetapan Mediasi di SIPP.`,
        sudahAda: true,
      };
    }

    const mediator = await satu(
      `SELECT id, status_mediator AS status, nama, nama_gelar AS namaGelar
         FROM mediator WHERE id = ? AND aktif = 'Y' LIMIT 1`,
      [mediatorId]
    );
    if (!mediator) return { ok: false, alasan: "Data Mediator Tidak Ditemukan." };
    const namaMediator = bersih(mediator.namaGelar) || bersih(mediator.nama);
    const statusMediator = bersih(mediator.status);

    const alur = await kueri(
      `SELECT proses_id AS prosesId, tahapan_id AS tahapanId, tahapan_nama AS tahapanNama, proses_nama AS prosesNama
         FROM proses_alur_perkara
        WHERE alur_perkara_id = ? AND proses_id IN (${PROSES_MEDIASI.join(",")})`,
      [perkara.alurPerkaraId]
    );
    const proses = PROSES_MEDIASI.map((pid) =>
      (Array.isArray(alur) ? alur : []).find((x) => Number(x.prosesId) === pid)
    );
    if (proses.some((x) => !x)) {
      return { ok: false, alasan: "Alur perkara ini tidak mengenal proses mediasi (110/120/121) di SIPP." };
    }

    const akun = await akunPerkara(perkaraId);
    const pilihAkun = bersih(minta.atasNama) === "panitera" ? "panitera" : "hakim";
    const atasNama = akun[pilihAkun] || null;
    if (!atasNama) {
      return {
        ok: false,
        alasan:
          pilihAkun === "hakim"
            ? "Ketua majelis perkara ini tidak punya akun SIPP aktif - penetapan tidak dapat ditulis atas namanya."
            : "Panitera pengganti perkara ini tidak punya akun SIPP aktif.",
      };
    }
    const username = atasNama.username;
    const saat24 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(saat) ? saat : "";
    if (!saat24) return { ok: false, alasan: "Jam basis data SIPP tidak terbaca." };
    const saat12 = waktuDuaBelas(saat24);
    const ip = bersih(minta.ip);

    const nilaiMediator = {
      id: TANDA.mediator,
      perkara_id: perkaraId,
      tanggal_penetapan: tanggal,
      nomor_sk_penetapan: nomorSk,
      mediator_id: mediatorId,
      status_mediator: statusMediator,
      nama_mediator: namaMediator,
      aktif: "Y",
      diinput_oleh: username,
      diinput_tanggal: saat12,
    };
    // Urutan kolom = urutan $data_add SIPP, lalu tambahan cabang jns=1. Audit
    // menyalin urutan yang sama - begitulah fetch_description menuliskannya.
    const nilaiMediasi = {
      mediasi_id: TANDA.mediasi,
      perkara_id: perkaraId,
      nomor_sk_penetapan_mediator: nomorSk,
      penetapan_penunjukan_mediator: tanggal,
      dimulai_mediasi: tanggal,
      diinput_oleh: username,
      diinput_tanggal: saat12,
      jenis_mediasi: 1,
      mediator_id: String(mediatorId),
      status_mediator: statusMediator,
      mediator_text: namaMediator,
    };
    const nilaiDukung = {
      perkara_id: perkaraId,
      identifier: "#pilih_mediator#",
      kode_template: "I_03",
      uraian: jenis.nilai,
      mediasi_id: TANDA.mediasi,
    };
    const nilaiJadwal = {
      id: TANDA.jadwal,
      mediasi_id: TANDA.mediasi,
      urutan: 1,
      tanggal_mediasi: tanggal,
      tempat: "Ditentukan Kemudian",
      diinput_oleh: username,
      diinput_tanggal: saat12,
    };

    const langkah = [
      sisip("perkara_mediator", nilaiMediator, `mediator ${namaMediator} untuk perkara ${perkara.nomorPerkara}`),
      sisip("perkara_mediasi", nilaiMediasi, `penetapan mediasi ${tanggal}`),
      barisAudit({
        saat: saat24,
        ip,
        username,
        judul: `Tambah Data Mediasi <br />Tambah table <b>Perkara_Mediasi</b> dari halaman <b>Mediasi</b> dengan Primary Key [mediasi_id=${TANDA.mediasi}]`,
        nilai: nilaiMediasi,
      }),
      sisip("perkara_data_dukung_mediasi", nilaiDukung, `jenis penetapan: ${jenis.label}`),
      barisAudit({
        saat: saat24,
        ip,
        username,
        judul: `Tambah Data Dukung Mediasi <br />Tambah table <b>perkara_data_dukung_mediasi</b> dari halaman <b>Mediasi</b> dengan Primary Key [mediasi_id=${TANDA.mediasi}]`,
        // Kosong - persis SIPP (add_data_dukung_mediasi memakai $data_add yang
        // tidak ada di fungsinya). Terukur: deskripsi audit 780 kosong.
        nilai: {},
      }),
      sisip("perkara_jadwal_mediasi", nilaiJadwal, `jadwal mediasi pertama ${tanggal}`),
      barisAudit({
        saat: saat24,
        ip,
        username,
        judul: `Tambah Data Jadwal Mediasi <br />Tambah table <b>Perkara_Jadwal_Mediasi</b> dari halaman <b>Penetapan Mediasi</b> dengan Primary Key [id=${TANDA.jadwal}]`,
        nilai: nilaiJadwal,
      }),
    ];

    for (const p of proses) {
      langkah.push({
        tabel: "perkara_proses",
        aksi: "DELETE",
        sql: "DELETE FROM perkara_proses WHERE proses_id = ? AND perkara_id = ? AND urutan = ?",
        params: [Number(p.prosesId), perkaraId, 1],
        keterangan: `riwayat ${bersih(p.prosesNama)} lama (urutan 1) dibersihkan - cancelproses SIPP`,
      });
      langkah.push(
        sisip(
          "perkara_proses",
          {
            perkara_id: perkaraId,
            tahapan_id: Number(p.tahapanId),
            tahapan_nama: bersih(p.tahapanNama),
            proses_id: Number(p.prosesId),
            proses_nama: bersih(p.prosesNama),
            tanggal,
            urutan: 1,
            diinput_oleh: username,
            diinput_tanggal: saat24,
          },
          `riwayat perkara: ${bersih(p.prosesNama)} atas nama ${username}`
        )
      );
    }
    langkah.push({
      tabel: "perkara",
      aksi: "UPDATE",
      sql:
        `UPDATE perkara p
           JOIN (SELECT tahapan_id, tahapan_nama, proses_id, proses_nama
                   FROM perkara_proses
                  WHERE perkara_id = ? AND NOT (proses_id = ? AND urutan = ?)
                  ORDER BY proses_id DESC
                  LIMIT 1) x
            SET p.tahapan_terakhir_id = x.tahapan_id, p.tahapan_terakhir_text = x.tahapan_nama,
                p.proses_terakhir_id = x.proses_id, p.proses_terakhir_text = x.proses_nama
          WHERE p.perkara_id = ?`,
      params: [perkaraId, PROSES_MEDIASI[PROSES_MEDIASI.length - 1], 1, perkaraId],
      keterangan: "tahapan terakhir perkara - keadaan akhir updateproses SIPP",
    });

    return {
      ok: true,
      perkara: { perkaraId, nomorPerkara: bersih(perkara.nomorPerkara) },
      mediator: { id: mediatorId, nama: namaMediator, status: statusMediator },
      penetapan: { tanggal, nomorSk, jenis: jenis.label },
      atasNama: { ...atasNama, sebagai: pilihAkun },
      operator,
      saat: saat24,
      langkah,
    };
  }

  /**
   * Menjalankan rencana. Id tabel tanpa auto_increment dihitung DI SINI, sedekat
   * mungkin dengan penulisannya - sama dengan alasan pada penetapan.
   */
  async function jalankanRencanaMediator(rencana, opsi = {}) {
    if (!rencana || rencana.ok !== true) {
      return { ok: false, alasan: (rencana && rencana.alasan) || "rencana_tidak_sah" };
    }
    const kering = opsi.kering !== false;
    if (kering) {
      return {
        ok: true,
        kering: true,
        jumlahLangkah: rencana.langkah.length,
        langkah: rencana.langkah.map((x) => ({ tabel: x.tabel, aksi: x.aksi, keterangan: x.keterangan })),
      };
    }

    for (const satuLangkah of rencana.langkah) {
      if (!DAFTAR_TABEL_MEDIATOR.has(satuLangkah.tabel)) {
        return { ok: false, kering: false, alasan: "tabel_di_luar_daftar", tabel: satuLangkah.tabel, selesai: [] };
      }
    }

    // Seluruh tulisan - termasuk penjaga "sudah tersimpan" dan id MAX+1 -
    // di dalam SATU transaksi (lihat `transaksi` di atas).
    const TOLAK = Symbol("tolak");
    const selesai = [];
    let pada = null;
    try {
      return await transaksi(async (lewat) => {
        const satuLewat = async (sql, params) => {
          const baris = await lewat(sql, params);
          return (Array.isArray(baris) && baris[0]) || null;
        };
        // Penjaga terakhir terhadap dua penekan bersamaan.
        const sudah = await satuLewat(
          `SELECT mediasi_id FROM perkara_mediasi WHERE perkara_id = ? AND tahapan_id = 10 AND jenis_mediasi = 1 LIMIT 1`,
          [rencana.perkara.perkaraId]
        );
        if (sudah) {
          const g = new Error("Data Mediasi Sudah Tersimpan.");
          g[TOLAK] = true;
          throw g;
        }

        const ambilAngka = async (sql) => {
          const b = await satuLewat(sql, []);
          const n = Number(b && b.n);
          if (!Number.isFinite(n) || n <= 0) {
            const g = new Error("id_berikutnya_tidak_terbaca");
            g[TOLAK] = true;
            throw g;
          }
          return n;
        };
        const id = {
          [TANDA.mediasi]: await ambilAngka("SELECT IFNULL(MAX(mediasi_id)+1,1) AS n FROM perkara_mediasi"),
          [TANDA.mediator]: await ambilAngka("SELECT COALESCE(MAX(id),0)+1 AS n FROM perkara_mediator"),
          [TANDA.jadwal]: await ambilAngka("SELECT COALESCE(MAX(id),0)+1 AS n FROM perkara_jadwal_mediasi"),
        };

        const isi = (nilai) => {
          if (typeof nilai !== "string") return nilai;
          if (Object.prototype.hasOwnProperty.call(id, nilai)) return id[nilai];
          let hasil = nilai;
          for (const [tanda, angka] of Object.entries(id)) hasil = hasil.split(tanda).join(String(angka));
          return hasil;
        };

        for (const satuLangkah of rencana.langkah) {
          pada = { tabel: satuLangkah.tabel, aksi: satuLangkah.aksi, keterangan: satuLangkah.keterangan };
          await lewat(satuLangkah.sql, satuLangkah.params.map(isi));
          selesai.push({ tabel: satuLangkah.tabel, aksi: satuLangkah.aksi, keterangan: satuLangkah.keterangan });
        }
        return {
          ok: true,
          kering: false,
          jumlahLangkah: selesai.length,
          selesai,
          mediasiId: id[TANDA.mediasi],
        };
      });
    } catch (galat) {
      const pesan = String((galat && galat.message) || galat).slice(0, 300);
      if (galat && galat[TOLAK]) return { ok: false, kering: false, alasan: pesan, selesai: [] };
      const dipulihkan = galat && typeof galat.dipulihkan === "boolean" ? galat.dipulihkan : undefined;
      return {
        ok: false,
        kering: false,
        alasan: "gagal_menulis",
        pada,
        pesan,
        dipulihkan,
        // Yang dibatalkan ROLLBACK tidak lagi "selesai".
        dibatalkan: dipulihkan === true ? [...selesai] : undefined,
        selesai: dipulihkan === true ? [] : selesai,
      };
    }
  }

  return { daftarMediator, prosesMediasi, akunPerkara, susunRencanaMediator, jalankanRencanaMediator };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  DAFTAR_TABEL_MEDIATOR,
  NAMA_BORANG,
  JENIS_PENETAPAN,
  PROSES_MEDIASI,
  HASIL_MEDIASI,
  KEHADIRAN_MEDIASI,
  TANDA,
  buatLayanan,
  waktuDuaBelas,
  keteranganAudit,
  daftarMediator: (perkaraId) => layananBawaan().daftarMediator(perkaraId),
  prosesMediasi: (perkaraId) => layananBawaan().prosesMediasi(perkaraId),
  akunPerkara: (perkaraId) => layananBawaan().akunPerkara(perkaraId),
  susunRencanaMediator: (minta) => layananBawaan().susunRencanaMediator(minta),
  jalankanRencanaMediator: (rencana, opsi) => layananBawaan().jalankanRencanaMediator(rencana, opsi),
};
