"use strict";

/**
 * ============================================================================
 * TUNDA MEDIASI DARI JADWAL MEDIASI - DITULIS PERSIS SEPERTI SIPP (26 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: "tambahkan tundaan mediasi di jadwal mediasi, jadi
 * tundaannya terisi di SIPP". Jalur tulis SIPP yang BARU; alasannya: pertemuan
 * mediasi yang tidak ditunda di SIPP (monev "mediasi yang lupa ditunda") ikut
 * dihitung lewat tenggat dan menurunkan nilai SIPP, dan menundanya berarti
 * berpindah ke SIPP hanya untuk satu borang.
 *
 * ============================================================================
 * BENTUKNYA DIBACA DARI KODE SIPP, LALU DIUKUR PADA DATA SATKER
 * ============================================================================
 *
 * Kode: controllers/jadwal_mediasi_c.php tunda() + validateTunda()
 *       models/mediasi/jadwal_mediasi_m.php tunda_mediasi(), add_audittrail()
 *       views/perkara_tab/tab_mediasi_v.php (kapan tautan "Tunda" tampil)
 *       views/perkara_tab/jadwal_mediasi_p_tunda.php (hanya tanggal + tempat)
 *
 * Yang ditulis SIPP satu kali tekan Simpan (diukur pada audit trail satker,
 * 20 dan 22 Okt 2026, dan baris perkara_jadwal_mediasi 2026):
 *
 *   perkara_jadwal_mediasi  UPDATE  SEMUA pertemuan mediasi itu (WHERE
 *                           mediasi_id = ...): tempat = tempat pertemuan yang
 *                           ditunda, ditunda = 'Y', diperbaharui_oleh/_tanggal
 *   sys_audittrail          UPDATE  "UPDATE Jadwal Mediasi ... PENUNDAAN
 *                           JADWAL MEDIASI ... Primary Key [id=<MEDIASI_ID>]"
 *                           (SIPP menaruh mediasi_id pada kunci itu - bukan
 *                           bug salin; baris SIPP asli memang begitu)
 *   perkara_jadwal_mediasi  INSERT  pertemuan berikutnya: id MAX+1, urutan
 *                           MAX+1, tanggal_mediasi, tempat, diinput_oleh/_tanggal
 *                           (ditunda tetap bawaan 'T'; jam, sampai_jam,
 *                           dihadiri_oleh kosong sampai petugas menyuntingnya)
 *   sys_audittrail          INSERT  "INSERT Jadwal Mediasi ... PENUNDAAN ..."
 *
 * tablename audit = perkara_jadwal_mediasi, formname = "Add Mediasi".
 *
 * Aturan SIPP yang ditiru (validateTunda + tab_mediasi_v):
 *   - tautan Tunda HANYA pada pertemuan TERAKHIR, selama laporan mediator belum
 *     masuk (tgl_laporan_mediator kosong), dan HANYA bila kehadiran pihak pada
 *     pertemuan itu sudah diisi ("Edit untuk menampilkan link Tunda");
 *   - tempat wajib (<= 500 huruf); tanggal berikutnya wajib, harus SESUDAH
 *     pertemuan sebelumnya, bukan Sabtu/Minggu, dan penetapan sidang pertama
 *     harus ada;
 *   - langkah Edit SIPP (jadwal_mediasi_c.validateEdit) mengisi kehadiran dan
 *     jam: tanggal pertemuan tidak boleh melebihi hari ini. Tunda di sini
 *     menggabungkan keduanya bila kehadiran belum terisi / jam diisi - UPDATE
 *     tanpa audit, persis Edit SIPP (update_jadwal_mediasi tidak menulis audit).
 *
 * Alasan/keterangan penundaan TIDAK punya kolom di perkara_jadwal_mediasi
 * (form Tunda SIPP hanya tanggal + tempat), jadi hanya dicatat di jejak ALETA.
 *
 * ============================================================================
 * KERING SEBAGAI BAWAAN; DAFTAR PUTIH TABEL SENDIRI; SATU TRANSAKSI
 * ============================================================================
 *
 * Tanpa { kering: false } yang tegas hanya rencana yang dipulangkan. Seluruh
 * tulisan, termasuk penjaga "masih pertemuan terakhir" dan id MAX+1, di dalam
 * SATU transaksi (pola mediatorTulisService): gagal di tengah = ROLLBACK.
 *
 * Akun SIPP atas nama siapa tertulis: bawaan PANITERA PENGGANTI perkara
 * (keputusan 7 Okt: penginput tunda = PP), dapat dipilih mediator (bila hakim)
 * atau ketua majelis. Tidak pernah diketik orang; penekan sebenarnya hanya di
 * jejak ALETA. TIDAK satu kata "Aleta" ke SIPP (penjagaTandaSipp).
 */

const penjagaTandaSipp = require("./penjagaTandaSipp");

/** Tabel yang boleh ditulis jalur ini - daftar putih. */
const DAFTAR_TABEL_TUNDA_MEDIASI = new Set(["perkara_jadwal_mediasi", "sys_audittrail"]);

/** Nama borang pada sys_audittrail - persis add_audittrail() jadwal_mediasi_m. */
const NAMA_BORANG = "Add Mediasi";

/** Arti perkara_jadwal_mediasi.dihadiri_oleh - jadwal_mediasi_p_edit.php. */
const KEHADIRAN_MEDIASI = {
  1: "Semua pihak",
  2: "Penggugat/Pemohon saja",
  3: "Tergugat/Termohon saja",
  4: "Semua pihak tidak hadir",
};

/** PERMA 1/2016 Pasal 24: paling lama 30 hari sejak mediator ditetapkan. */
const BATAS_MEDIASI_HARI = 30;

const TANDA = { jadwal: "#JADWAL_MEDIASI_ID#" };

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function tanggalSah(nilai) {
  const teks = bersih(nilai).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return "";
  const [t, b, h] = teks.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  return d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h ? teks : "";
}

function jamSah(nilai) {
  const teks = bersih(nilai);
  const cocok = teks.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!cocok) return "";
  const j = Number(cocok[1]);
  const m = Number(cocok[2]);
  return j <= 23 && m <= 59 ? `${cocok[1]}:${cocok[2]}` : "";
}

/** Jam dua belas ala PHP date("h") - 13:05 jadi 01:05, 00:30 jadi 12:30. */
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

function tambahHari(iso, n) {
  const [t, b, h] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h + n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Tabel deskripsi audit persis fetch_description() SIPP (kolom => nilai, urutan terjaga). */
function keteranganAudit(nilai) {
  const baris = Object.entries(nilai)
    .map(([kolom, isi]) => `<tr><td>${kolom}</td><td>${isi === null || isi === undefined ? "" : String(isi)}</td></tr>`)
    .join("");
  return (
    `<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1">` +
    `<tr><th>Nama Kolom</th><th>Nilai</th></tr>${baris}</table>`
  );
}

function barisAudit({ saat, ip, username, aksi, judul, nilai }) {
  return {
    tabel: "sys_audittrail",
    aksi: "INSERT",
    sql:
      "INSERT INTO sys_audittrail (datetime, ipaddress, username, tablename, formname, action, title, description) " +
      "VALUES (?,?,?,?,?,?,?,?)",
    params: [
      saat,
      penjagaTandaSipp.ipAuditSipp(ip),
      bersih(username).slice(0, 30),
      "perkara_jadwal_mediasi",
      NAMA_BORANG,
      aksi,
      judul,
      keteranganAudit(nilai),
    ],
    keterangan: `catatan audit ${aksi === "UPDATE" ? "perubahan" : "penambahan"} jadwal mediasi atas nama ${username}`,
  };
}

/** Kalimat awam untuk kode penolakan. */
function pesanTolak(kode, h = {}) {
  switch (kode) {
    case "pertemuan_tidak_ketemu":
      return "Pertemuan mediasi ini tidak ditemukan di SIPP - mungkin sudah diubah. Muat ulang Jadwal Mediasi lalu coba lagi. Tidak ada yang diubah di SIPP.";
    case "bukan_pertemuan_terakhir":
      return "Hanya pertemuan mediasi TERAKHIR yang dapat ditunda (aturan SIPP). Pertemuan ini sudah punya pertemuan sesudahnya. Tidak ada yang diubah di SIPP.";
    case "sudah_ditunda":
      return "Pertemuan mediasi ini sudah tercatat DITUNDA di SIPP. Tidak ada yang diubah di SIPP.";
    case "mediasi_selesai":
      return "Laporan mediator untuk perkara ini sudah masuk, jadi mediasinya sudah selesai dan pertemuannya tidak dapat ditunda lagi (SIPP juga tidak menampilkan Tunda). Tidak ada yang diubah di SIPP.";
    case "kehadiran_belum_diisi":
      return "Kehadiran pihak pada pertemuan ini belum diisi di SIPP - SIPP baru menampilkan Tunda sesudahnya. Pilih kehadiran pihak pada pertemuan ini di formulir lalu simpan.";
    case "pertemuan_belum_tiba":
      return `Pertemuan ini belum berlangsung${bersih(h.tanggal) ? ` (${h.tanggal})` : ""}, jadi kehadiran pihak belum dapat diisi - SIPP menolak tanggal pertemuan yang melebihi hari ini. Tunda baru dapat dicatat pada atau sesudah hari pertemuan.`;
    case "tempat_kosong":
      return "Tempat pelaksanaan mediasi berikutnya wajib diisi.";
    case "tempat_terlalu_panjang":
      return "Tempat pelaksanaan mediasi paling panjang 500 huruf.";
    case "tanggal_berikut_tidak_sah":
      return "Tanggal mediasi berikutnya belum diisi atau bentuknya tidak sah.";
    case "tanggal_berikut_tidak_maju":
      return `Tanggal mediasi berikutnya${bersih(h.diminta) ? ` (${h.diminta})` : ""} harus SESUDAH tanggal pertemuan sebelumnya${bersih(h.sebelumnya) ? ` (${h.sebelumnya})` : ""} - SIPP juga menolak tanggal yang sama atau lebih awal.`;
    case "tanggal_berikut_akhir_pekan":
      return `Tanggal mediasi berikutnya${bersih(h.diminta) ? ` (${h.diminta})` : ""} jatuh pada Sabtu/Minggu - SIPP juga menolaknya. Pilih hari kerja.`;
    case "tanggal_berikut_hari_libur":
      return `Tanggal mediasi berikutnya hari libur${bersih(h.keterangan) ? ` (${h.keterangan})` : ""}. Pilih hari kerja.`;
    case "sidang_pertama_tidak_ada":
      return "Tanggal Penetapan Sidang Pertama tidak ditemukan di SIPP untuk perkara ini - SIPP menolak penundaan tanpa itu.";
    case "jam_tidak_sah":
      return "Jam mediasi tidak sah (contoh: 09:00).";
    case "jam_selesai_tidak_sah":
      return "Jam selesai harus sesudah jam mulai.";
    case "kehadiran_tidak_sah":
      return "Kehadiran pihak yang dipilih tidak dikenal.";
    case "akun_tidak_tersedia":
      return bersih(h.pesan) || "Akun SIPP yang akan dipakai untuk mencatat tidak tersedia. Pilih akun lain.";
    case "operator_tidak_disebut":
      return "Permintaan tidak menyebut siapa yang menekan tombolnya - masuk ulang ke ALETA lalu coba lagi.";
    case "pertemuan_berubah":
      return "Pertemuan mediasi ini baru saja diubah orang lain di SIPP. Muat ulang Jadwal Mediasi lalu coba lagi. Tidak ada yang diubah di SIPP.";
    case "jam_sipp_tidak_terbaca":
      return "Jam server SIPP tidak terbaca. Coba lagi sebentar. Tidak ada yang diubah di SIPP.";
    case "teks_menyebut_aleta":
      return bersih(h.pesan) || "Isian memuat kata yang tidak boleh tertulis di SIPP. Hapus dulu lalu coba lagi.";
    default:
      return bersih(h.pesan) || `Penundaan mediasi ditolak (${kode}). Tidak ada yang diubah di SIPP.`;
  }
}

function tolak(kode, tambahan = {}) {
  return { ok: false, alasan: kode, ...tambahan, pesan: tambahan.pesan || pesanTolak(kode, tambahan) };
}

function buatLayanan(deps = {}) {
  const kueri =
    deps.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  // Seluruh langkah satu penundaan = SATU transaksi (pola mediatorTulisService).
  // deps.kueri tanpa deps.transaksi (uji) = tanpa transaksi.
  const transaksi =
    deps.transaksi ||
    (deps.kueri ? (kerja) => kerja(kueri) : (kerja) => require("./transaksiSipp").denganTransaksi(kerja));
  // Jam SIPP (WIB, 24 jam) - bukan jam container, bukan NOW() basis data.
  const waktu = deps.waktu || (() => require("./penetapanTulisService").waktuSipp());
  const paniteraSidang =
    deps.paniteraSidang || ((perkaraId, tanggal) => require("./sidangHasilService").paniteraSidang(perkaraId, tanggal));
  const pesanSidang = deps.pesanSidang || ((h) => require("./pesanHasilSidang").pesanHasilSidang(h, "tunda"));

  async function satu(sql, params) {
    const baris = await kueri(sql, params);
    return (Array.isArray(baris) && baris[0]) || null;
  }

  /** Mediasi + seluruh pertemuannya + perkara. null bila mediasi tidak ada. */
  async function bacaMediasi(mediasiId) {
    const id = Number(mediasiId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const m = await satu(
      `SELECT m.mediasi_id AS mediasiId, m.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
              p.alur_perkara_id AS alurPerkaraId,
              m.mediator_text AS mediator, m.mediator_id AS mediatorId,
              DATE_FORMAT(m.penetapan_penunjukan_mediator, '%Y-%m-%d') AS penetapan,
              DATE_FORMAT(m.tgl_laporan_mediator, '%Y-%m-%d') AS laporan,
              DATE_FORMAT(pp.sidang_pertama, '%Y-%m-%d') AS sidangPertama
         FROM perkara_mediasi m
         JOIN perkara p ON p.perkara_id = m.perkara_id
         LEFT JOIN perkara_penetapan pp ON pp.perkara_id = m.perkara_id
        WHERE m.mediasi_id = ?
        LIMIT 1`,
      [id]
    );
    if (!m) return null;
    const jadwal = await kueri(
      `SELECT id, urutan, DATE_FORMAT(tanggal_mediasi, '%Y-%m-%d') AS tanggal,
              TIME_FORMAT(jam_mediasi, '%H:%i') AS jam, TIME_FORMAT(sampai_jam, '%H:%i') AS sampaiJam,
              tempat, dihadiri_oleh AS dihadiriOleh, ditunda
         FROM perkara_jadwal_mediasi
        WHERE mediasi_id = ?
        ORDER BY urutan ASC, id ASC`,
      [id]
    );
    return {
      mediasiId: Number(m.mediasiId),
      perkaraId: Number(m.perkaraId),
      nomorPerkara: bersih(m.nomorPerkara),
      alurPerkaraId: Number(m.alurPerkaraId) || 0,
      mediator: bersih(m.mediator).replace(/<br\s*\/?>/gi, "; "),
      mediatorId: bersih(m.mediatorId),
      penetapan: tanggalSah(m.penetapan),
      laporan: tanggalSah(m.laporan),
      sidangPertama: tanggalSah(m.sidangPertama),
      jadwal: (Array.isArray(jadwal) ? jadwal : []).map((j) => ({
        id: Number(j.id),
        urutan: Number(j.urutan) || 0,
        tanggal: tanggalSah(j.tanggal),
        jam: bersih(j.jam),
        sampaiJam: bersih(j.sampaiJam),
        tempat: bersih(j.tempat),
        dihadiriOleh: bersih(j.dihadiriOleh),
        ditunda: bersih(j.ditunda).toUpperCase() === "Y",
      })),
    };
  }

  /** Pertemuan sasaran (menurut tanggal; tanpa tanggal = yang terakhir). */
  function pilihPertemuan(med, tanggal) {
    const semua = med.jadwal;
    if (semua.length === 0) return null;
    const terakhir = semua[semua.length - 1];
    const t = tanggalSah(tanggal);
    if (!t) return { baris: terakhir, terakhir: true };
    const cocok = semua.filter((j) => j.tanggal === t);
    if (cocok.length === 0) return null;
    const baris = cocok[cocok.length - 1];
    return { baris, terakhir: baris.id === terakhir.id };
  }

  /**
   * Akun SIPP yang dapat dipakai mencatat: panitera pengganti (bawaan, ketat -
   * tidak menebak), mediator (bila hakim berakun), ketua majelis.
   */
  async function akunPerkara(med, tanggal) {
    const hasil = { panitera: null, mediator: null, hakim: null, paniteraGalat: "" };

    try {
      const pp = await paniteraSidang(med.perkaraId, tanggal);
      if (pp && pp.ok) hasil.panitera = { username: pp.akun.username, namaLengkap: pp.akun.fullname };
      else hasil.paniteraGalat = bersih(pesanSidang(pp || { alasan: "panitera_sidang_tidak_terbaca" }));
    } catch {
      hasil.paniteraGalat = "Data panitera pengganti tidak dapat dibaca dari SIPP saat ini.";
    }

    try {
      const hk = await satu(
        `SELECT b.username, b.fullname
           FROM perkara_hakim_pn a
           JOIN v_users b ON b.hakim_id = a.hakim_id
          WHERE b.block = 0 AND a.aktif = 'Y' AND a.perkara_id = ?
          ORDER BY a.urutan
          LIMIT 1`,
        [med.perkaraId]
      );
      if (hk && bersih(hk.username)) hasil.hakim = { username: bersih(hk.username), namaLengkap: bersih(hk.fullname) };
    } catch {
      // Tanpa akun ketua majelis - pilihan lain tetap ada.
    }

    try {
      const ids = bersih(med.mediatorId)
        .split(/[,;\s]+/)
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0);
      if (ids.length > 0) {
        const baris = await kueri(
          `SELECT DISTINCT u.username, u.fullname
             FROM mediator md
             JOIN v_users u ON u.hakim_id = md.hakim_id
            WHERE md.id IN (${ids.map(() => "?").join(",")}) AND md.hakim_id IS NOT NULL AND u.block = 0`,
          ids
        );
        const akun = (Array.isArray(baris) ? baris : []).filter((b) => bersih(b.username));
        // Lebih dari satu mediator berakun = tidak menebak salah satunya.
        if (akun.length === 1) hasil.mediator = { username: bersih(akun[0].username), namaLengkap: bersih(akun[0].fullname) };
      }
    } catch {
      // Mediator bukan hakim / tanpa akun - pilihan lain tetap ada.
    }
    return hasil;
  }

  /** Nama majelis dan PP untuk penjagaan hak di portal (hanya nama, bukan akun). */
  async function namaPetugasPerkara(perkaraId) {
    const hakim = await kueri(
      `SELECT hakim_nama AS nama FROM perkara_hakim_pn WHERE perkara_id = ? AND aktif = 'Y'`,
      [perkaraId]
    ).catch(() => []);
    const pp = await kueri(
      `SELECT panitera_nama AS nama FROM perkara_panitera_pn WHERE perkara_id = ? AND aktif = 'Y'`,
      [perkaraId]
    ).catch(() => []);
    const nama = (b) => [...new Set((Array.isArray(b) ? b : []).map((x) => bersih(x.nama)).filter(Boolean))];
    return { majelis: nama(hakim), panitera: nama(pp) };
  }

  /**
   * Keadaan satu pertemuan untuk formulir Tunda: boleh atau tidak (dengan
   * sebab), bahan usulan, akun yang tersedia. Hanya SELECT.
   */
  async function keadaanTunda(minta = {}) {
    const med = await bacaMediasi(minta.mediasiId);
    if (!med) return tolak("pertemuan_tidak_ketemu");
    const pilih = pilihPertemuan(med, minta.tanggal);
    if (!pilih) return tolak("pertemuan_tidak_ketemu");
    const { baris, terakhir } = pilih;

    const saat = bersih(await waktu());
    const hariIni = tanggalSah(saat.slice(0, 10));

    let sebabTolak = "";
    let kodeTolak = "";
    if (!terakhir) {
      kodeTolak = "bukan_pertemuan_terakhir";
    } else if (baris.ditunda) {
      kodeTolak = "sudah_ditunda";
    } else if (med.laporan) {
      kodeTolak = "mediasi_selesai";
    } else if (!baris.dihadiriOleh && hariIni && baris.tanggal > hariIni) {
      kodeTolak = "pertemuan_belum_tiba";
    }
    if (kodeTolak) sebabTolak = pesanTolak(kodeTolak, { tanggal: baris.tanggal });

    const tenggat = med.penetapan ? tambahHari(med.penetapan, BATAS_MEDIASI_HARI) : "";
    const akun = await akunPerkara(med, baris.tanggal);
    const petugas = await namaPetugasPerkara(med.perkaraId);

    return {
      ok: true,
      boleh: !kodeTolak,
      kodeTolak,
      sebabTolak,
      perkara: { perkaraId: med.perkaraId, nomorPerkara: med.nomorPerkara },
      mediasiId: med.mediasiId,
      mediator: med.mediator,
      majelis: petugas.majelis,
      panitera: petugas.panitera,
      pertemuan: { ...baris, kehadiran: KEHADIRAN_MEDIASI[Number(baris.dihadiriOleh)] || "" },
      jumlahPertemuan: med.jadwal.length,
      perluKehadiran: !baris.dihadiriOleh,
      pilihanKehadiran: Object.entries(KEHADIRAN_MEDIASI).map(([nilai, label]) => ({ nilai, label })),
      penetapanMediator: med.penetapan,
      tenggat,
      hariIni,
      akun,
    };
  }

  /**
   * Menyusun rencana tulis - seluruh pemeriksaan SIPP dikerjakan di sini,
   * SEBELUM satu baris pun ditulis.
   */
  async function susunRencanaTunda(minta = {}) {
    const operator = bersih(minta.operator);
    if (!operator) return tolak("operator_tidak_disebut");

    const med = await bacaMediasi(minta.mediasiId);
    if (!med) return tolak("pertemuan_tidak_ketemu");
    const pilih = pilihPertemuan(med, minta.tanggal);
    if (!pilih) return tolak("pertemuan_tidak_ketemu");
    const { baris: lama, terakhir } = pilih;

    if (!terakhir) return tolak("bukan_pertemuan_terakhir");
    if (lama.ditunda) return tolak("sudah_ditunda");
    if (med.laporan) return tolak("mediasi_selesai");

    // Urutan pemeriksaan = urutan validateTunda SIPP.
    const tempat = bersih(minta.tempat).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
    if (!tempat) return tolak("tempat_kosong");
    if (tempat.length > 500) return tolak("tempat_terlalu_panjang");
    const baru = tanggalSah(minta.tanggalBaru);
    if (!baru) return tolak("tanggal_berikut_tidak_sah");

    // Penjaga bersama: tidak satu kata "Aleta" ke SIPP (tempat ditulis ke tempat + audit).
    const tahanTanda = penjagaTandaSipp.periksaIsian({ "Tempat Pelaksanaan Mediasi": tempat });
    if (!tahanTanda.ok) return tolak("teks_menyebut_aleta", { pesan: tahanTanda.pesan, kolom: tahanTanda.kolom });

    if (baru <= lama.tanggal) return tolak("tanggal_berikut_tidak_maju", { diminta: baru, sebelumnya: lama.tanggal });
    if (!med.sidangPertama) return tolak("sidang_pertama_tidak_ada");
    const hari = hariDalamPekan(baru);
    if (hari === 0 || hari === 6) return tolak("tanggal_berikut_akhir_pekan", { diminta: baru });

    // Jam pertemuan berikutnya: opsional; bila diisi = langkah Edit SIPP sesudah Tunda.
    const jam = bersih(minta.jam) ? jamSah(minta.jam) : "";
    if (bersih(minta.jam) && !jam) return tolak("jam_tidak_sah");
    const sampai = bersih(minta.sampaiJam) ? jamSah(minta.sampaiJam) : "";
    if (bersih(minta.sampaiJam) && !sampai) return tolak("jam_tidak_sah");
    if (sampai && (!jam || sampai <= jam)) return tolak("jam_selesai_tidak_sah");

    // Kehadiran: SIPP baru menampilkan Tunda sesudah kehadiran terisi.
    const saat = bersih(await waktu());
    const saat24 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(saat) ? saat : "";
    if (!saat24) return tolak("jam_sipp_tidak_terbaca");
    const hariIni = saat24.slice(0, 10);
    let kehadiran = lama.dihadiriOleh;
    let isiKehadiran = false;
    if (!kehadiran) {
      kehadiran = bersih(minta.kehadiran);
      if (!kehadiran) return tolak("kehadiran_belum_diisi");
      if (!KEHADIRAN_MEDIASI[Number(kehadiran)] || !/^[1-4]$/.test(kehadiran)) return tolak("kehadiran_tidak_sah");
      // validateEdit SIPP: tanggal mediasi tidak boleh melebihi hari ini.
      if (lama.tanggal > hariIni) return tolak("pertemuan_belum_tiba", { tanggal: lama.tanggal });
      isiKehadiran = true;
    }

    // Akun yang tercatat di SIPP.
    const akun = await akunPerkara(med, lama.tanggal);
    const pilihAkun = ["mediator", "hakim", "panitera"].includes(bersih(minta.atasNama)) ? bersih(minta.atasNama) : "panitera";
    const atasNama = akun[pilihAkun] || null;
    if (!atasNama) {
      const sebutan = { panitera: "panitera pengganti", mediator: "mediator", hakim: "ketua majelis" }[pilihAkun];
      return tolak("akun_tidak_tersedia", {
        pesan:
          pilihAkun === "panitera" && akun.paniteraGalat
            ? akun.paniteraGalat
            : `Akun SIPP ${sebutan} perkara ini tidak tersedia (tidak tercatat, diblokir, atau lebih dari satu). Pilih akun lain.`,
      });
    }
    const username = atasNama.username;
    const saat12 = waktuDuaBelas(saat24);
    const ip = bersih(minta.ip);

    const tenggat = med.penetapan ? tambahHari(med.penetapan, BATAS_MEDIASI_HARI) : "";
    const peringatan = [];
    if (tenggat && baru > tenggat) {
      peringatan.push(
        `Tanggal ${baru} melewati batas tenggang mediasi 30 hari sejak penetapan mediator (${tenggat}, PERMA 1/2016 Pasal 24). Penundaan tetap dapat dicatat; pastikan majelis menyetujui perpanjangannya.`
      );
    }

    const langkah = [];

    if (isiKehadiran) {
      langkah.push({
        tabel: "perkara_jadwal_mediasi",
        aksi: "UPDATE",
        // Edit jadwal SIPP (update_jadwal_mediasi): tanpa audit.
        sql: "UPDATE perkara_jadwal_mediasi SET dihadiri_oleh = ?, diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE id = ?",
        params: [kehadiran, username, saat12, lama.id],
        keterangan: `kehadiran pihak pertemuan ${lama.tanggal}: ${KEHADIRAN_MEDIASI[Number(kehadiran)]} (seperti Edit Jadwal Mediasi SIPP, atas nama ${username})`,
      });
    }

    // 1. Pertemuan yang ditunda: SEMUA pertemuan mediasi itu (persis tunda_mediasi SIPP).
    const nilaiUbah = {
      tempat: lama.tempat,
      ditunda: "Y",
      diperbaharui_oleh: username,
      diperbaharui_tanggal: saat12,
    };
    langkah.push({
      tabel: "perkara_jadwal_mediasi",
      aksi: "UPDATE",
      sql: "UPDATE perkara_jadwal_mediasi SET tempat = ?, ditunda = ?, diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE mediasi_id = ?",
      params: [nilaiUbah.tempat, nilaiUbah.ditunda, nilaiUbah.diperbaharui_oleh, nilaiUbah.diperbaharui_tanggal, med.mediasiId],
      keterangan: `pertemuan mediasi ${lama.tanggal} ditandai ditunda (ditunda = Y), atas nama ${username}`,
    });
    langkah.push(
      barisAudit({
        saat: saat24,
        ip,
        username,
        aksi: "UPDATE",
        // SIPP menaruh mediasi_id pada Primary Key judul ini - lihat catatan di kepala berkas.
        judul: `UPDATE Jadwal Mediasi <br /> UPDATE table <b>perkara_jadwal_mediasi</b> dari halaman <b>PENUNDAAN JADWAL MEDIASI</b> dengan Primary Key [id=${med.mediasiId}]`,
        nilai: nilaiUbah,
      })
    );

    // 2. Pertemuan berikutnya.
    const urutanBaru = Math.max(...med.jadwal.map((j) => j.urutan), 0) + 1;
    const nilaiBaru = {
      id: TANDA.jadwal,
      mediasi_id: med.mediasiId,
      urutan: urutanBaru,
      tanggal_mediasi: baru,
      tempat,
      diinput_oleh: username,
      diinput_tanggal: saat12,
    };
    langkah.push({
      tabel: "perkara_jadwal_mediasi",
      aksi: "INSERT",
      sql: `INSERT INTO perkara_jadwal_mediasi (${Object.keys(nilaiBaru).join(", ")}) VALUES (${Object.keys(nilaiBaru).map(() => "?").join(",")})`,
      params: Object.values(nilaiBaru),
      keterangan: `pertemuan mediasi berikutnya ${baru} (urutan ${urutanBaru}) di ${tempat}`,
    });
    langkah.push(
      barisAudit({
        saat: saat24,
        ip,
        username,
        aksi: "INSERT",
        judul: `INSERT Jadwal Mediasi <br /> INSERT table <b>perkara_jadwal_mediasi</b> dari halaman <b>PENUNDAAN JADWAL MEDIASI</b> dengan Primary Key [id=${TANDA.jadwal}]`,
        nilai: nilaiBaru,
      })
    );

    // 3. Jam (opsional) = Edit SIPP pada pertemuan baru, tanpa audit.
    if (jam) {
      langkah.push({
        tabel: "perkara_jadwal_mediasi",
        aksi: "UPDATE",
        sql: "UPDATE perkara_jadwal_mediasi SET jam_mediasi = ?, sampai_jam = ?, diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE id = ?",
        params: [jam, sampai || null, username, saat12, TANDA.jadwal],
        keterangan: `jam pertemuan berikutnya ${jam}${sampai ? ` s.d. ${sampai}` : ""} (seperti Edit Jadwal Mediasi SIPP)`,
      });
    }

    return {
      ok: true,
      perkara: { perkaraId: med.perkaraId, nomorPerkara: med.nomorPerkara },
      mediasiId: med.mediasiId,
      lama: { id: lama.id, urutan: lama.urutan, tanggal: lama.tanggal, tempat: lama.tempat },
      baru: { urutan: urutanBaru, tanggal: baru, tempat, jam, sampaiJam: sampai },
      kehadiran: { nilai: kehadiran, label: KEHADIRAN_MEDIASI[Number(kehadiran)] || "", diisiSekarang: isiKehadiran },
      alasanTunda: bersih(minta.alasan).slice(0, 200),
      keteranganTunda: bersih(minta.keterangan).slice(0, 500),
      peringatan,
      tenggat,
      atasNama: { ...atasNama, sebagai: pilihAkun },
      operator,
      saat: saat24,
      langkah,
    };
  }

  /**
   * Menjalankan rencana. id pertemuan baru dihitung DI SINI, sedekat mungkin
   * dengan penulisannya, dan pertemuan terakhir dikunci lalu diperiksa ulang.
   */
  async function jalankanRencanaTunda(rencana, opsi = {}) {
    if (!rencana || rencana.ok !== true) {
      return { ok: false, alasan: (rencana && rencana.alasan) || "rencana_tidak_sah", pesan: rencana && rencana.pesan };
    }
    const kering = opsi.kering !== false;
    // Penjaga terakhir (17 Okt 2026): tak satu nilai pun yang memuat kata ALETA sampai ke SIPP.
    const tahanTanda = penjagaTandaSipp.periksaRencana(rencana);
    if (!tahanTanda.ok) {
      return { ok: false, kering, alasan: tahanTanda.alasan, pesan: tahanTanda.pesan, kolom: tahanTanda.kolom, selesai: [] };
    }
    if (kering) {
      return {
        ok: true,
        kering: true,
        jumlahLangkah: rencana.langkah.length,
        langkah: rencana.langkah.map((x) => ({ tabel: x.tabel, aksi: x.aksi, keterangan: x.keterangan })),
      };
    }

    for (const satuLangkah of rencana.langkah) {
      if (!DAFTAR_TABEL_TUNDA_MEDIASI.has(satuLangkah.tabel)) {
        return { ok: false, kering: false, alasan: "tabel_di_luar_daftar", tabel: satuLangkah.tabel, selesai: [] };
      }
    }

    const TOLAK = Symbol("tolak");
    const selesai = [];
    let pada = null;
    try {
      return await transaksi(async (lewat) => {
        // Kunci seluruh pertemuan mediasi ini lalu periksa ulang: masih pertemuan
        // TERAKHIR dan belum ditunda (penjaga terhadap dua penekan bersamaan).
        const jadwal = await lewat(
          `SELECT id, urutan, ditunda FROM perkara_jadwal_mediasi WHERE mediasi_id = ? ORDER BY urutan ASC, id ASC FOR UPDATE`,
          [rencana.mediasiId]
        );
        const daftar = Array.isArray(jadwal) ? jadwal : [];
        const akhir = daftar[daftar.length - 1];
        if (!akhir || Number(akhir.id) !== Number(rencana.lama.id) || bersih(akhir.ditunda).toUpperCase() === "Y") {
          const g = new Error(pesanTolak("pertemuan_berubah"));
          g[TOLAK] = "pertemuan_berubah";
          throw g;
        }

        const baris = await lewat("SELECT COALESCE(MAX(id),0)+1 AS n FROM perkara_jadwal_mediasi", []);
        const idBaru = Number(baris && baris[0] && baris[0].n);
        if (!Number.isFinite(idBaru) || idBaru <= 0) {
          const g = new Error("id_berikutnya_tidak_terbaca");
          g[TOLAK] = "id_berikutnya_tidak_terbaca";
          throw g;
        }
        const isi = (nilai) => {
          if (typeof nilai !== "string" || !nilai.includes(TANDA.jadwal)) return nilai;
          return nilai === TANDA.jadwal ? idBaru : nilai.split(TANDA.jadwal).join(String(idBaru));
        };

        for (const satuLangkah of rencana.langkah) {
          pada = { tabel: satuLangkah.tabel, aksi: satuLangkah.aksi, keterangan: satuLangkah.keterangan };
          await lewat(satuLangkah.sql, satuLangkah.params.map(isi));
          selesai.push({ tabel: satuLangkah.tabel, aksi: satuLangkah.aksi, keterangan: satuLangkah.keterangan });
        }
        return { ok: true, kering: false, jumlahLangkah: selesai.length, selesai, jadwalBaruId: idBaru };
      });
    } catch (galat) {
      const pesan = String((galat && galat.message) || galat).slice(0, 300);
      if (galat && galat[TOLAK]) {
        return { ok: false, kering: false, alasan: galat[TOLAK], pesan, selesai: [] };
      }
      const dipulihkan = galat && typeof galat.dipulihkan === "boolean" ? galat.dipulihkan : undefined;
      return {
        ok: false,
        kering: false,
        alasan: "gagal_menulis",
        pada,
        pesan,
        dipulihkan,
        dibatalkan: dipulihkan === true ? [...selesai] : undefined,
        selesai: dipulihkan === true ? [] : selesai,
      };
    }
  }

  return { keadaanTunda, susunRencanaTunda, jalankanRencanaTunda, bacaMediasi, akunPerkara, namaPetugasPerkara };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  DAFTAR_TABEL_TUNDA_MEDIASI,
  NAMA_BORANG,
  KEHADIRAN_MEDIASI,
  BATAS_MEDIASI_HARI,
  TANDA,
  buatLayanan,
  pesanTolak,
  waktuDuaBelas,
  keteranganAudit,
  keadaanTunda: (minta) => layananBawaan().keadaanTunda(minta),
  susunRencanaTunda: (minta) => layananBawaan().susunRencanaTunda(minta),
  jalankanRencanaTunda: (rencana, opsi) => layananBawaan().jalankanRencanaTunda(rencana, opsi),
};
