"use strict";

/**
 * ============================================================================
 * COURT CALENDAR DARI JADWAL SIDANG PORTAL - DITULIS PERSIS SEPERTI BLANGKO SIPP
 * ============================================================================
 *
 * Permintaan pengguna 6 Oktober 2026 (butir 3): di tiap baris Jadwal Sidang,
 * di bawah Agenda, Court Calendar perkara itu dapat dilihat, disusun dari
 * rekomendasi ALETA (aturan butir 29, @/lib/court-calendar-susun di portal =
 * ccSusun di ekstensi), disunting manual, dan barisnya yang LAMA dapat
 * disunting - lalu TERINPUT DI SIPP.
 *
 * Ekstensi (butir 29) menulis lewat blangko SIPP sendiri dengan sesi peramban
 * petugas. Portal tidak punya sesi SIPP, jadi jalannya lewat bot (MySQL) -
 * pola yang sama dengan penulis mediator, penundaan, dan penetapan.
 *
 * ============================================================================
 * BENTUKNYA DIBACA DARI KODE SIPP, LALU DIUKUR PADA DATA SATKER
 * ============================================================================
 *
 * Kode: controllers/manage_court_calendar.php
 *         validateInput()  $this->db->insert('perkara_court_calendar', [
 *                            perkara_id, rencana_tanggal, rencana_jam,
 *                            rencana_agenda, keterangan, diinput_oleh =
 *                            session username, diinput_tanggal =
 *                            date("Y-m-d h:i:s") ])
 *         validateEdit()   UPDATE ... SET rencana_tanggal, rencana_jam,
 *                            rencana_agenda, keterangan, diperbaharui_oleh =
 *                            session username, diperbaharui_tanggal =
 *                            date("Y-m-d h:i:s") WHERE Id = .. AND perkara_id = ..
 *       views/court_calendar/court_calendar_v.php (medan tgl_sidang, jamSidang
 *         HH:mm, agenda_sidang, keterangan)
 *
 * Pagar yang ditiru (urutan SIPP): agenda/tanggal/jam wajib (agenda di-trim),
 * Sabtu/Minggu ditolak, tanggal sebelum tanggal pendaftaran ditolak. Libur
 * nasional TIDAK ditolak SIPP - layar portal hanya mengingatkannya.
 *
 * Diukur pada sipp_donggala (6 Okt 2026, 8.541 baris Court Calendar):
 *   - diinput_tanggal berjam 01..12 SAJA (nol baris >= 13; 864 baris "12"):
 *     memang date("h") - jam dua belas. diperbaharui_tanggal sama (1.452
 *     baris). Ditiru dengan DATE_FORMAT(NOW(), '%Y-%m-%d %h:%i:%s') - jam
 *     basis data SUNGGUHAN pada detik pernyataannya berjalan, sesudah jeda.
 *   - keterangan '' (bukan NULL) pada 5.024 baris kosong - textarea selalu
 *     terkirim; ditiru: '' bila kosong.
 *   - diedit_oleh / diedit_tanggal tidak pernah terisi (0 baris) - tidak disentuh.
 *   - diperbaharui_oleh berbeda dari diinput_oleh pada 260 baris: menyunting
 *     baris orang lain memang lazim; diinput_* baris lama TIDAK diubah.
 *
 * ============================================================================
 * TIDAK ADA BARIS sys_audittrail - KARENA SIPP SENDIRI TIDAK MENULISNYA
 * ============================================================================
 *
 * manage_court_calendar.php tidak memanggil add_audittrail sama sekali, baik
 * pada tambah maupun sunting. Diukur: sys_audittrail sipp_donggala memuat
 * 503.046 baris (Mei 2016 - Sep 2026) dan NOL baris bertablename
 * perkara_court_calendar (juga nol pada `sipp` PA Bungku). Menulis satu baris
 * audit di sini justru MENCIPTAKAN catatan yang tidak pernah ada pada
 * pengisian tangan - satu-satunya tanda yang membedakan tulisan ALETA. Bentuk
 * SIPP yang ditiru karena itu: tanpa audit. Jejak jujur (operator ALETA,
 * akun SIPP, IP peramban, "lewat ALETA", berhasil/gagal) ditulis rute ke
 * aleta_bot_jejak_penetapan (jejakAletaService, jenis "court-calendar").
 *
 * ============================================================================
 * ATAS AKUN SIPP PETUGAS YANG MENEKAN - BUKAN PEJABAT PERKARA
 * ============================================================================
 *
 * diinput_oleh / diperbaharui_oleh = username SIPP milik pengguna ALETA yang
 * menekan Simpan - diturunkan portal dari kredensial SIPP yang ia simpan
 * (pemilik tunggal, tentukanPemilikSipp), lalu DIPASTIKAN ada dan tidak
 * diblokir di sys_users di sini. Tanpa akun = DITOLAK, tidak pernah jatuh ke
 * panitera perkara atau nama lain (keputusan 2 Okt 2026, butir 39).
 *
 * ============================================================================
 * KERING SEBAGAI BAWAAN; DAFTAR PUTIH TABEL SENDIRI
 * ============================================================================
 *
 * jalankanRencana tidak menulis apa pun kecuali { kering: false } disebut
 * tegas. Satu-satunya tabel yang boleh disentuh: perkara_court_calendar.
 */

const DAFTAR_TABEL_COURT_CALENDAR = new Set(["perkara_court_calendar"]);

/** date("Y-m-d h:i:s") PHP = jam DUA BELAS - dihitung basis data saat pernyataannya berjalan. */
// Jam SIPP (WIB) - SIPP menulis jamnya dengan PHP Asia/Jakarta, NOW() basis
// data WITA (13 Okt 2026). Tetap berjam dua belas, seperti date("h") SIPP.
const SAAT_SIPP_SQL = require("./penetapanTulisService").sqlJamSipp("%Y-%m-%d %h:%i:%s");

/** Batas baris per permintaan - satu perkara jarang lebih dari 12 rencana. */
const BATAS_BARIS = 30;

const PESAN = {
  libur: "Tidak Dapat Memilih Tanggal Dihari Libur, Sabtu dan Minggu.",
  sebelumDaftar: "Tanggal Rencana Sidang tidak boleh kurang dari tanggal pendaftaran.",
  agenda: "Jadwal/Agenda Sidang wajib diisi.",
  tanggal: "Tanggal Persidangan wajib diisi (tgl/bln/tahun).",
  jam: "Jam Persidangan wajib diisi (JJ:MM).",
  tidakAda: "Data Rencana Sidang Tidak Ditemukan.",
};

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function tanggalSah(nilai) {
  const teks = bersih(nilai).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) ? teks : "";
}

function jamSah(nilai) {
  const teks = bersih(nilai);
  const cocok = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(teks);
  if (!cocok) return "";
  const j = Number(cocok[1]);
  const m = Number(cocok[2]);
  if (j > 23 || m > 59) return "";
  return `${String(j).padStart(2, "0")}:${cocok[2]}`;
}

function hariDalamPekan(iso) {
  const [t, b, h] = iso.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h)).getUTCDay();
}

/** Kunci pembanding baris - sama dengan ccKunciBaris (tanggal|jam|agenda kecil berspasi tunggal). */
function kunciBaris(x) {
  return `${bersih(x && x.tanggal)}|${bersih(x && x.jam).slice(0, 5)}|${bersih(x && x.agenda)
    .replace(/\s+/g, " ")
    .toLowerCase()}`;
}

/** Pagar blangko SIPP atas satu baris. Pulang "" bila lolos. */
function periksaBaris(b, tanggalDaftar) {
  if (!bersih(b.agenda)) return PESAN.agenda;
  if (!tanggalSah(b.tanggal)) return PESAN.tanggal;
  if (!jamSah(b.jam)) return PESAN.jam;
  const h = hariDalamPekan(tanggalSah(b.tanggal));
  if (h === 0 || h === 6) return PESAN.libur;
  if (tanggalSah(tanggalDaftar) && tanggalSah(b.tanggal) < tanggalSah(tanggalDaftar)) return PESAN.sebelumDaftar;
  return "";
}

/** Nilai baris dari permintaan - bentuk yang dikirim blangko SIPP. */
function nilaiBaris(x) {
  const o = x && typeof x === "object" ? x : {};
  return {
    tanggal: tanggalSah(o.tanggal),
    jam: jamSah(o.jam),
    // agenda_sidang: 'trim|required' - di-trim SIPP.
    agenda: bersih(o.agenda).slice(0, 500),
    // keterangan: tanpa trim di SIPP, tetapi spasi tepi dari layar tidak
    // berarti apa pun; '' bila kosong (bukan NULL), seperti textarea SIPP.
    keterangan: bersih(o.keterangan).slice(0, 500),
  };
}

function buatLayanan(deps = {}) {
  const kueri =
    deps.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const tabelAda = deps.tabelAda || ((tabel) => require("./sippSkemaService").tabelAda(tabel));
  const jeda = deps.jeda || ((jenis, opsi) => require("./jedaManusiaService").jeda(jenis, opsi));

  async function satu(sql, params) {
    const baris = await kueri(sql, params);
    return (Array.isArray(baris) && baris[0]) || null;
  }

  async function bacaPerkara(perkaraId) {
    const id = Number(perkaraId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const p = await satu(
      `SELECT perkara_id AS perkaraId, nomor_perkara AS nomorPerkara,
              DATE_FORMAT(tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar,
              jenis_perkara_nama AS jenisPerkara
         FROM perkara WHERE perkara_id = ? LIMIT 1`,
      [id]
    );
    if (!p) return null;
    return {
      perkaraId: Number(p.perkaraId),
      nomorPerkara: bersih(p.nomorPerkara),
      tanggalDaftar: tanggalSah(p.tanggalDaftar),
      jenisPerkara: bersih(p.jenisPerkara),
    };
  }

  async function bacaBaris(perkaraId) {
    const baris = await kueri(
      `SELECT id, DATE_FORMAT(rencana_tanggal, '%Y-%m-%d') AS tanggal,
              TIME_FORMAT(rencana_jam, '%H:%i') AS jam,
              rencana_agenda AS agenda, keterangan,
              diinput_oleh AS diinputOleh,
              DATE_FORMAT(diinput_tanggal, '%Y-%m-%d %H:%i:%s') AS diinputTanggal,
              diperbaharui_oleh AS diperbaharuiOleh,
              DATE_FORMAT(diperbaharui_tanggal, '%Y-%m-%d %H:%i:%s') AS diperbaharuiTanggal
         FROM perkara_court_calendar
        WHERE perkara_id = ?
        ORDER BY rencana_tanggal ASC, rencana_jam ASC, id ASC
        LIMIT 200`,
      [Number(perkaraId)]
    );
    return (Array.isArray(baris) ? baris : []).map((b) => ({
      id: Number(b.id),
      tanggal: tanggalSah(b.tanggal),
      jam: bersih(b.jam).slice(0, 5),
      agenda: bersih(b.agenda),
      keterangan: bersih(b.keterangan),
      diinputOleh: bersih(b.diinputOleh),
      diinputTanggal: bersih(b.diinputTanggal),
      diperbaharuiOleh: bersih(b.diperbaharuiOleh),
      diperbaharuiTanggal: bersih(b.diperbaharuiTanggal),
    }));
  }

  /** Court Calendar SIPP satu perkara beserta id barisnya (untuk disunting). Hanya SELECT. */
  async function daftarKalender(perkaraId) {
    if (!(await tabelAda("perkara_court_calendar"))) {
      return { ok: false, alasan: "Tabel perkara_court_calendar tidak ada pada SIPP versi ini." };
    }
    const perkara = await bacaPerkara(perkaraId);
    if (!perkara) return { ok: false, alasan: "Perkara tidak ditemukan di SIPP." };
    return { ok: true, perkara, baris: await bacaBaris(perkara.perkaraId) };
  }

  /**
   * Jumlah baris Court Calendar per perkara - SATU kueri untuk seluruh baris
   * Jadwal Sidang yang tampil (angka kecil di samping tautan "Court
   * Calendar"), bukan satu panggilan per baris. Hanya SELECT.
   */
  async function jumlahKalender(daftarId) {
    const id = [...new Set((Array.isArray(daftarId) ? daftarId : String(daftarId || "").split(","))
      .map((x) => Number(String(x).trim()))
      .filter((x) => Number.isInteger(x) && x > 0))].slice(0, 500);
    if (!id.length) return { ok: true, jumlah: {} };
    if (!(await tabelAda("perkara_court_calendar"))) {
      return { ok: false, alasan: "Tabel perkara_court_calendar tidak ada pada SIPP versi ini." };
    }
    const baris = await kueri(
      `SELECT perkara_id AS perkaraId, COUNT(*) AS n FROM perkara_court_calendar
        WHERE perkara_id IN (${id.map(() => "?").join(",")}) GROUP BY perkara_id`,
      id
    );
    const jumlah = {};
    for (const x of id) jumlah[String(x)] = 0;
    for (const b of Array.isArray(baris) ? baris : []) jumlah[String(Number(b.perkaraId))] = Number(b.n) || 0;
    return { ok: true, jumlah };
  }

  /**
   * Akun SIPP yang akan tercatat. Username dibaca EJAANNYA dari sys_users -
   * itulah yang disimpan sesi SIPP - bukan ejaan kiriman portal.
   */
  async function akunPetugas(username) {
    const nama = bersih(username);
    if (!nama || nama.length > 64) return { ok: false, alasan: "akun_sipp_tidak_disebut" };
    const akun = await satu(`SELECT username, fullname, block FROM sys_users WHERE username = ? LIMIT 1`, [nama]);
    if (!akun || !bersih(akun.username)) return { ok: false, alasan: "akun_sipp_tidak_ketemu", username: nama };
    if (String(akun.block ?? "0") !== "0") return { ok: false, alasan: "akun_sipp_diblokir", username: bersih(akun.username) };
    return { ok: true, username: bersih(akun.username), namaLengkap: bersih(akun.fullname) };
  }

  /**
   * Menyusun rencana tulis. Seluruh pagar blangko SIPP dikerjakan di sini,
   * SEBELUM satu baris pun ditulis. Baris yang tidak lolos disebut per baris
   * (ditolak), yang sama persis dengan yang sudah ada dilewati - sama dengan
   * panel butir 29.
   */
  async function susunRencana(minta = {}) {
    const operator = bersih(minta.operator);
    if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };
    const tambah = Array.isArray(minta.tambah) ? minta.tambah : [];
    const ubah = Array.isArray(minta.ubah) ? minta.ubah : [];
    if (!tambah.length && !ubah.length) return { ok: false, alasan: "Tidak ada baris yang ditambah atau disunting." };
    if (tambah.length + ubah.length > BATAS_BARIS) {
      return { ok: false, alasan: `Paling banyak ${BATAS_BARIS} baris sekali simpan.` };
    }

    const akun = await akunPetugas(minta.akunSipp);
    if (!akun.ok) return { ok: false, alasan: akun.alasan, akunSipp: akun.username || bersih(minta.akunSipp) };

    const kalender = await daftarKalender(minta.perkaraId);
    if (!kalender.ok) return { ok: false, alasan: kalender.alasan };
    const { perkara } = kalender;
    const lama = new Map(kalender.baris.map((b) => [b.id, b]));
    const kunciAda = new Set(kalender.baris.map(kunciBaris));

    const langkah = [];
    const ditolak = [];
    const dilewati = [];
    const kunciDirencanakan = new Set();

    ubah.forEach((mentah, ke) => {
      const id = Number(mentah && mentah.id);
      const asal = Number.isInteger(id) && id > 0 ? lama.get(id) : null;
      if (!asal) {
        ditolak.push({ jenis: "ubah", ke, id: id || 0, pesan: PESAN.tidakAda });
        return;
      }
      const b = nilaiBaris(mentah);
      const salah = periksaBaris(b, perkara.tanggalDaftar);
      if (salah) {
        ditolak.push({ jenis: "ubah", ke, id, pesan: salah });
        return;
      }
      if (b.tanggal === asal.tanggal && b.jam === asal.jam && b.agenda === asal.agenda && b.keterangan === asal.keterangan) {
        dilewati.push({ jenis: "ubah", ke, id, pesan: "tidak berubah - tidak dikirim" });
        return;
      }
      kunciDirencanakan.add(kunciBaris(b));
      langkah.push({
        tabel: "perkara_court_calendar",
        aksi: "UPDATE",
        jenis: "ubah",
        ke,
        id,
        nilai: b,
        sebelum: { tanggal: asal.tanggal, jam: asal.jam, agenda: asal.agenda, keterangan: asal.keterangan },
        sql:
          "UPDATE perkara_court_calendar SET rencana_tanggal = ?, rencana_jam = ?, rencana_agenda = ?, keterangan = ?, " +
          `diperbaharui_oleh = ?, diperbaharui_tanggal = ${SAAT_SIPP_SQL} WHERE id = ? AND perkara_id = ?`,
        params: [b.tanggal, b.jam, b.agenda, b.keterangan, akun.username.slice(0, 30), id, perkara.perkaraId],
        keterangan: `sunting Court Calendar #${id}: ${b.tanggal} ${b.jam} ${b.agenda}`.slice(0, 300),
      });
    });

    tambah.forEach((mentah, ke) => {
      const b = nilaiBaris(mentah);
      const salah = periksaBaris(b, perkara.tanggalDaftar);
      if (salah) {
        ditolak.push({ jenis: "tambah", ke, pesan: salah });
        return;
      }
      const kunci = kunciBaris(b);
      if (kunciAda.has(kunci) || kunciDirencanakan.has(kunci)) {
        dilewati.push({ jenis: "tambah", ke, pesan: "baris yang sama persis sudah ada di SIPP - tidak dikirim lagi" });
        return;
      }
      kunciDirencanakan.add(kunci);
      langkah.push({
        tabel: "perkara_court_calendar",
        aksi: "INSERT",
        jenis: "tambah",
        ke,
        nilai: b,
        // Urutan kolom = urutan larik $data_cc validateInput.
        sql:
          "INSERT INTO perkara_court_calendar (perkara_id, rencana_tanggal, rencana_jam, rencana_agenda, keterangan, diinput_oleh, diinput_tanggal) " +
          `VALUES (?,?,?,?,?,?,${SAAT_SIPP_SQL})`,
        params: [perkara.perkaraId, b.tanggal, b.jam, b.agenda, b.keterangan, akun.username.slice(0, 30)],
        keterangan: `tambah Court Calendar ${b.tanggal} ${b.jam} ${b.agenda}`.slice(0, 300),
      });
    });

    return {
      ok: true,
      perkara,
      akunSipp: { username: akun.username, namaLengkap: akun.namaLengkap },
      operator,
      ip: bersih(minta.ip).slice(0, 45),
      langkah,
      ditolak,
      dilewati,
    };
  }

  /**
   * Menjalankan rencana. Tiap baris berdiri sendiri (sama dengan panel butir
   * 29): satu yang gagal tidak membatalkan yang lain, dan tiap hasil disebut.
   * "tersimpan" hanya bila barisnya TERBACA ULANG dengan nilai dan akunnya.
   */
  async function jalankanRencana(rencana, opsi = {}) {
    if (!rencana || rencana.ok !== true) {
      return { ok: false, alasan: (rencana && rencana.alasan) || "rencana_tidak_sah" };
    }
    const kering = opsi.kering !== false;
    const rincian = rencana.langkah.map((x) => ({
      jenis: x.jenis,
      ke: x.ke,
      id: x.id || 0,
      tabel: x.tabel,
      aksi: x.aksi,
      keterangan: x.keterangan,
      sql: String(x.sql).replace(/\s+/g, " ").trim(),
      nilai: x.params,
    }));
    if (kering) {
      return { ok: true, kering: true, jumlahLangkah: rencana.langkah.length, rencana: rincian, hasil: [] };
    }
    if (!rencana.langkah.length) {
      return { ok: false, kering: false, alasan: "Tidak ada baris yang perlu ditulis.", hasil: [] };
    }
    for (const x of rencana.langkah) {
      if (!DAFTAR_TABEL_COURT_CALENDAR.has(x.tabel)) {
        return { ok: false, kering: false, alasan: "tabel_di_luar_daftar", tabel: x.tabel, hasil: [] };
      }
    }

    // Dibaca segar tepat sebelum menulis: penekan kedua / tab SIPP yang
    // menambah baris yang sama di sela itu tidak melahirkan baris ganda.
    const sebelum = await bacaBaris(rencana.perkara.perkaraId);
    const kunciSebelum = new Set(sebelum.map(kunciBaris));
    const idSebelum = new Set(sebelum.map((b) => b.id));

    const hasil = [];
    let dikirim = 0;
    for (const x of rencana.langkah) {
      if (x.aksi === "INSERT" && kunciSebelum.has(kunciBaris(x.nilai))) {
        hasil.push({ jenis: x.jenis, ke: x.ke, keadaan: "sudah-ada", pesan: "baris yang sama persis sudah ada di SIPP - tidak dikirim lagi" });
        continue;
      }
      if (x.aksi === "UPDATE" && !idSebelum.has(x.id)) {
        hasil.push({ jenis: x.jenis, ke: x.ke, id: x.id, keadaan: "gagal", pesan: PESAN.tidakAda });
        continue;
      }
      // Jeda manusia SEBELUM jam diambil - NOW() di pernyataannya sendiri.
      try {
        await jeda(dikirim ? "simpan" : "klik", { kering: false });
      } catch {
        /* jeda gagal - simpanan tetap berjalan */
      }
      dikirim += 1;
      try {
        const jawab = await kueri(x.sql, x.params);
        if (x.aksi === "INSERT") {
          const id = Number(jawab && jawab.insertId) || 0;
          hasil.push({ jenis: x.jenis, ke: x.ke, id, keadaan: "terkirim", pesan: "" });
        } else {
          const kena = Number(jawab && jawab.affectedRows);
          hasil.push({
            jenis: x.jenis,
            ke: x.ke,
            id: x.id,
            keadaan: kena === 0 ? "gagal" : "terkirim",
            pesan: kena === 0 ? PESAN.tidakAda : "",
          });
        }
      } catch (galat) {
        hasil.push({ jenis: x.jenis, ke: x.ke, id: x.id || 0, keadaan: "gagal", pesan: String((galat && galat.message) || galat).slice(0, 300) });
      }
    }

    // Dibaca ULANG - "tersimpan" hanya untuk yang terbaca kembali utuh.
    let daftarSesudah = null;
    try {
      daftarSesudah = await bacaBaris(rencana.perkara.perkaraId);
    } catch {
      daftarSesudah = null;
    }
    const username = rencana.akunSipp.username;
    for (const h of hasil) {
      if (h.keadaan !== "terkirim") continue;
      const x = rencana.langkah.find((l) => l.jenis === h.jenis && l.ke === h.ke);
      const baris = Array.isArray(daftarSesudah) ? daftarSesudah.find((b) => b.id === h.id) : null;
      const cocok =
        baris &&
        x &&
        kunciBaris(baris) === kunciBaris(x.nilai) &&
        baris.keterangan === x.nilai.keterangan &&
        (x.aksi === "INSERT" ? baris.diinputOleh === username : baris.diperbaharuiOleh === username);
      h.keadaan = cocok ? "tersimpan" : "belum-terbaca";
      h.pesan = cocok
        ? "tersimpan dan terbaca ulang di SIPP"
        : daftarSesudah
          ? "SIPP menerima, tetapi barisnya TIDAK terbaca ulang - periksa tab Court Calendar SIPP"
          : "SIPP menerima; pembacaan ulang gagal";
    }

    const jumlah = (k) => hasil.filter((h) => h.keadaan === k).length;
    return {
      ok: jumlah("tersimpan") > 0 && !jumlah("gagal") && !jumlah("belum-terbaca"),
      kering: false,
      hasil,
      daftarSesudah,
      ringkas: {
        tersimpan: jumlah("tersimpan"),
        belumTerbaca: jumlah("belum-terbaca"),
        sudahAda: jumlah("sudah-ada"),
        gagal: jumlah("gagal"),
      },
    };
  }

  return { daftarKalender, jumlahKalender, akunPetugas, susunRencana, jalankanRencana };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  DAFTAR_TABEL_COURT_CALENDAR,
  SAAT_SIPP_SQL,
  BATAS_BARIS,
  PESAN,
  buatLayanan,
  kunciBaris,
  periksaBaris,
  daftarKalender: (perkaraId) => layananBawaan().daftarKalender(perkaraId),
  jumlahKalender: (daftarId) => layananBawaan().jumlahKalender(daftarId),
  akunPetugas: (username) => layananBawaan().akunPetugas(username),
  susunRencana: (minta) => layananBawaan().susunRencana(minta),
  jalankanRencana: (rencana, opsi) => layananBawaan().jalankanRencana(rencana, opsi),
};
