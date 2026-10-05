"use strict";

/**
 * ============================================================================
 * PANGGIL PETUGAS SIDANG DAN PARA PIHAK - BUTIR 33, 34, 36 (5 OKT 2026)
 * ============================================================================
 *
 * Diminta pengguna: dari Jadwal Sidang, Hasil Sidang, dan Jadwal Mediasi, nama
 * petugas (hakim ketua, hakim anggota, panitera pengganti, juru sita,
 * mediator) dan nama pihak (pihak pertama, pihak kedua, kuasa masing-masing -
 * BUKAN saksi) dapat diklik untuk memanggilnya lewat chat WhatsApp, dan
 * petugas juga lewat pengumuman suara di pengeras suara.
 *
 * Berkas ini mengerjakan tiga hal, dan HANYA tiga:
 *
 *   1. SASARAN - siapa saja yang dapat dipanggil pada satu perkara, dibaca
 *      dari SIPP (hanya SELECT). Nomor telepon PIHAK dibaca di sini (pihak.
 *      telepon, kuasa lewat perkara_pengacara.pengacara_id -> pihak.telepon)
 *      beserta keadaan verifikasinya (aleta_bot_nomor_terverifikasi). Nomor
 *      PETUGAS tidak ada di SIPP sama sekali (hakim_pn, panitera_pn, jurusita,
 *      mediator tidak punya kolom telepon) - portal yang mencarinya di akun
 *      ALETA (users.whatsapp_number).
 *
 *   2. RIWAYAT - tiap panggilan dicatat di aleta_bot_panggil_riwayat: siapa
 *      memanggil, siapa dipanggil, saluran, waktu, alamat IP, dan HASILNYA
 *      apa adanya (diantre, tidak dikirim karena bot nonaktif, nomor tidak
 *      ada, gagal, diumumkan). Satu baris per panggilan, tidak pernah dihapus.
 *      Dibuat sendiri (CREATE TABLE IF NOT EXISTS) seperti tabel Jadwal Sidang
 *      lain - bukan migrasi Drizzle portal.
 *
 *   3. PENGUMUMAN SUARA - baris bersaluran "audio" sekaligus antrean yang
 *      dibaca layar antrian / papan panggil (GET /pengumuman), yang lalu
 *      mengucapkannya dengan suara peramban. Tidak ada suara yang dibuat di
 *      server.
 *
 * Yang MENGIRIM pesan WhatsApp bukan berkas ini: portal memakai jalur kirim
 * yang sudah ada (sendPortalWhatsappMessage -> /messages/enqueue), supaya
 * aturan antrean, dry-run, dan bot nonaktif yang sama berlaku.
 *
 * ============================================================================
 * NOMOR UTUH TIDAK PERNAH SAMPAI KE PERAMBAN
 * ============================================================================
 *
 * Rute ini hanya dipanggil portal (token internal). Portal menyamarkan nomor
 * sebelum menjawab layar; nomor utuh hanya dipakai di peladen untuk
 * mengantre pesan.
 */

const TABEL = "aleta_bot_panggil_riwayat";

/** Jeda minimum antara dua panggilan ke orang yang sama lewat saluran yang sama. */
const JEDA_BAWAAN_DETIK = 60;

/** Pengumuman suara yang lebih tua dari ini tidak diputar lagi oleh layar. */
const UMUR_PENGUMUMAN_DETIK = 180;

const SALURAN = ["whatsapp", "audio"];

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sebutGalat(galat) {
  return String((galat && galat.message) || galat || "galat").slice(0, 200);
}

/**
 * Nomor WhatsApp Indonesia pertama yang sah dari isian telepon SIPP.
 *
 * Isian SIPP bebas: "0812xxx / 0813yyy", "00000", "-", spasi di ekor. Yang
 * tidak sah (terlalu pendek, bukan 08/628) dianggap TIDAK ADA, bukan ditebak.
 */
function ambilNomor(teks) {
  const potongan = String(teks || "")
    .split(/[\/,;|]|\s{2,}|\bdan\b/i)
    .map((x) => x.replace(/[^\d+]/g, ""));
  for (const p of potongan) {
    let angka = p.replace(/^\+/, "");
    if (angka.startsWith("0")) angka = `62${angka.slice(1)}`;
    else if (angka.startsWith("8")) angka = `62${angka}`;
    if (/^628\d{7,12}$/.test(angka)) return angka;
  }
  return "";
}

/** Nama yang dilucuti gelar - untuk menyatukan baris kembar orang yang sama. */
function kunciNama(nama) {
  return bersih(nama)
    .toLowerCase()
    .replace(/\b(s\.?h\.?i?|m\.?h\.?|s\.?ag|s\.?sy|lc|m\.?a|dr|drs|h|hj)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Menyatukan baris petugas satu perkara (pola petugasPerkaraUtil.satukanPetugas):
 * baris AKTIF menentukan siapa yang bertugas sekarang; bila tidak ada yang
 * aktif, seluruhnya dipakai. Orang yang sama (id sama, atau nama tanpa gelar
 * sama) dijadikan satu dengan ejaan terlengkap.
 */
function satukanOrang(baris) {
  const semua = (Array.isArray(baris) ? baris : [])
    .map((b) => ({
      id: bersih(b.id),
      nama: bersih(b.nama),
      jabatan: bersih(b.jabatan),
      jabatanId: Number(b.jabatanId) || 0,
      urutan: Number(b.urutan) || 0,
      aktif: bersih(b.aktif).toUpperCase() === "Y",
    }))
    .filter((b) => b.nama);
  const adaAktif = semua.some((b) => b.aktif);
  const dipakai = adaAktif ? semua.filter((b) => b.aktif) : semua;
  const peta = new Map();
  for (const b of dipakai) {
    const kunci = b.id && b.id !== "0" ? `id:${b.id}` : `nama:${kunciNama(b.nama)}`;
    const ada = peta.get(kunci);
    if (!ada) {
      peta.set(kunci, { ...b });
      continue;
    }
    if (b.nama.length > ada.nama.length) ada.nama = b.nama;
    if (!ada.jabatan && b.jabatan) ada.jabatan = b.jabatan;
    if (!ada.jabatanId && b.jabatanId) ada.jabatanId = b.jabatanId;
    if (b.urutan > 0 && (ada.urutan === 0 || b.urutan < ada.urutan)) ada.urutan = b.urutan;
  }
  return [...peta.values()].sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama, "id"));
}

/** Sebutan hakim: SIPP menulis jabatan_hakim_nama (Hakim Ketua / Anggota / Tunggal). */
function peranHakim(orang, ke) {
  if (orang.jabatan) return orang.jabatan;
  if (orang.jabatanId === 1) return "Hakim Ketua";
  if (orang.jabatanId === 3) return "Hakim Tunggal";
  if (orang.jabatanId === 2) return "Hakim Anggota";
  return ke === 0 ? "Hakim Ketua" : "Hakim Anggota";
}

/** Keadaan verifikasi nomor pihak -> golongan layar. */
function golonganVerifikasi(catatan) {
  const status = bersih(catatan && catatan.status).toLowerCase();
  if (status === "terverifikasi") return "terverifikasi";
  if (status === "ditolak") return "bermasalah";
  return "belum-terverifikasi";
}

function buatLayanan(deps = {}) {
  const kueriSipp =
    deps.kueriSipp ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const kueriBot = deps.kueriBot || ((sql, params = []) => require("./botDbService").query(sql, params));
  const statusNomor =
    deps.statusNomor || ((nomor, nama) => require("./nomorVerificationService").getStatus(nomor, nama));

  const kueriAman = async (sql, params) => {
    try {
      const hasil = await kueriSipp(sql, params);
      return { ok: true, baris: Array.isArray(hasil) ? hasil : [] };
    } catch (galat) {
      return { ok: false, baris: [], alasan: sebutGalat(galat) };
    }
  };

  /**
   * Siapa saja yang dapat dipanggil pada satu perkara.
   *
   * Tiap bagian yang gagal dibaca tidak menjatuhkan bagian lain - dan
   * disebut di `tidakTerbaca`, bukan didiamkan sebagai "tidak ada orangnya".
   */
  async function sasaran({ perkaraId, tanggal = "" } = {}) {
    const id = bersih(perkaraId);
    if (!/^\d{1,20}$/.test(id)) return { ok: false, alasan: "perkara_tidak_sah" };
    const tidakTerbaca = [];
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(bersih(tanggal).slice(0, 10)) ? bersih(tanggal).slice(0, 10) : "";

    const [perkara, hakim, panitera, jurusita, mediator, pihak1, pihak2, kuasa, jadwal] = await Promise.all([
      kueriAman(
        `SELECT nomor_perkara AS nomorPerkara, alur_perkara_id AS alurPerkaraId,
                jenis_perkara_id AS jenisPerkaraId, jenis_perkara_nama AS jenisPerkaraNama
           FROM perkara WHERE perkara_id = ? LIMIT 1`,
        [id]
      ),
      kueriAman(
        `SELECT hakim_id AS id, hakim_nama AS nama, jabatan_hakim_id AS jabatanId,
                jabatan_hakim_nama AS jabatan, urutan, aktif
           FROM perkara_hakim_pn WHERE perkara_id = ?`,
        [id]
      ),
      kueriAman(
        `SELECT panitera_id AS id, panitera_nama AS nama, urutan, aktif
           FROM perkara_panitera_pn WHERE perkara_id = ?`,
        [id]
      ),
      kueriAman(
        `SELECT jurusita_id AS id, jurusita_nama AS nama, urutan, aktif
           FROM perkara_jurusita WHERE perkara_id = ?`,
        [id]
      ),
      kueriAman(
        `SELECT pm.mediator_id AS id, COALESCE(NULLIF(m.nama_gelar, ''), m.nama, pm.nama_mediator) AS nama,
                m.hakim_id AS hakimId, pm.urutan AS urutan, pm.aktif AS aktif
           FROM perkara_mediator pm
           LEFT JOIN mediator m ON m.id = pm.mediator_id
          WHERE pm.perkara_id = ?`,
        [id]
      ),
      kueriAman(
        `SELECT x.pihak_id AS id, x.nama AS nama, x.urutan AS urutan, p.telepon AS telepon
           FROM perkara_pihak1 x LEFT JOIN pihak p ON p.id = x.pihak_id
          WHERE x.perkara_id = ? ORDER BY x.urutan`,
        [id]
      ),
      kueriAman(
        `SELECT x.pihak_id AS id, x.nama AS nama, x.urutan AS urutan, p.telepon AS telepon
           FROM perkara_pihak2 x LEFT JOIN pihak p ON p.id = x.pihak_id
          WHERE x.perkara_id = ? ORDER BY x.urutan`,
        [id]
      ),
      // aktif = 'Y': kuasa yang sudah dicabut tidak boleh menerima apa pun
      // tentang perkara kliennya (pola kelengkapanDataService.bacaPihak).
      kueriAman(
        `SELECT a.pengacara_id AS id, a.nama AS nama, a.pihak_ke AS pihakKe, a.urutan AS urutan,
                b.telepon AS telepon
           FROM perkara_pengacara a LEFT JOIN pihak b ON b.id = a.pengacara_id
          WHERE a.perkara_id = ? AND a.aktif = 'Y' ORDER BY a.urutan`,
        [id]
      ),
      tgl
        ? kueriAman(
            `SELECT ruangan, agenda FROM perkara_jadwal_sidang
              WHERE perkara_id = ? AND tanggal_sidang = ? ORDER BY urutan DESC LIMIT 1`,
            [id, tgl]
          )
        : Promise.resolve({ ok: true, baris: [] }),
    ]);

    const catat = (nama, hasil) => {
      if (!hasil.ok) tidakTerbaca.push(`${nama}: ${hasil.alasan}`);
    };
    catat("perkara", perkara);
    catat("hakim", hakim);
    catat("panitera pengganti", panitera);
    catat("juru sita", jurusita);
    catat("mediator", mediator);
    catat("pihak pertama", pihak1);
    catat("pihak kedua", pihak2);
    catat("kuasa", kuasa);

    const satuPerkara = perkara.baris[0] || {};

    const majelis = satukanOrang(hakim.baris).map((o, ke) => ({
      kunci: `hakim:${o.id || `n${ke}`}`,
      golongan: "majelis",
      pejabatId: o.id,
      nama: o.nama,
      peran: peranHakim(o, ke),
    }));
    const pp = satukanOrang(panitera.baris).map((o, ke) => ({
      kunci: `pp:${o.id || `n${ke}`}`,
      golongan: "pp",
      pejabatId: o.id,
      nama: o.nama,
      peran: "Panitera Pengganti",
    }));
    const js = satukanOrang(jurusita.baris).map((o, ke) => ({
      kunci: `js:${o.id || `n${ke}`}`,
      golongan: "js",
      pejabatId: o.id,
      nama: o.nama,
      peran: "Juru Sita",
    }));
    const hakimMediator = new Map(mediator.baris.map((b) => [bersih(b.id), bersih(b.hakimId)]));
    const daftarMediator = satukanOrang(mediator.baris).map((o, ke) => ({
      kunci: `mediator:${o.id || `n${ke}`}`,
      golongan: "mediator",
      pejabatId: o.id,
      hakimId: hakimMediator.get(o.id) && hakimMediator.get(o.id) !== "0" ? hakimMediator.get(o.id) : "",
      nama: o.nama,
      peran: "Mediator",
    }));

    // Pihak - nomor dan keadaan verifikasinya. Nomor pihak dikirim ke portal
    // (peladen ke peladen), yang menyamarkannya sebelum menjawab peramban.
    const susunPihak = async (baris, golongan, awalanKunci, jenis) => {
      const hasil = [];
      const terlihat = new Set();
      for (const b of baris) {
        const nama = bersih(b.nama);
        if (!nama) continue;
        const kunci = `${awalanKunci}:${bersih(b.id) || kunciNama(nama)}`;
        if (terlihat.has(kunci)) continue;
        terlihat.add(kunci);
        const nomor = ambilNomor(b.telepon);
        let statusNomorTeks = nomor ? "belum-terverifikasi" : bersih(b.telepon) ? "bermasalah" : "tidak-ada";
        let keteranganNomor = nomor
          ? "belum pernah dijawab pemiliknya lewat verifikasi nomor ALETA"
          : bersih(b.telepon)
            ? "isian telepon di SIPP bukan nomor WhatsApp yang sah"
            : "telepon tidak diisi di SIPP";
        if (nomor) {
          try {
            const catatan = await statusNomor(nomor, nama);
            statusNomorTeks = golonganVerifikasi(catatan);
            if (statusNomorTeks === "terverifikasi") keteranganNomor = "dijawab YA oleh pemiliknya";
            else if (statusNomorTeks === "bermasalah")
              keteranganNomor = "pemilik nomor menjawab BUKAN - salah alamat, tidak dikirimi";
            else if (catatan) keteranganNomor = "pertanyaan verifikasi belum dijawab pemiliknya";
          } catch {
            keteranganNomor = "keadaan verifikasi nomor tidak terbaca";
          }
        }
        hasil.push({
          kunci,
          golongan,
          jenis,
          nama,
          nomor,
          statusNomor: statusNomorTeks,
          keteranganNomor,
        });
      }
      return hasil;
    };

    const kuasa1 = kuasa.baris.filter((b) => Number(b.pihakKe) !== 2);
    const kuasa2 = kuasa.baris.filter((b) => Number(b.pihakKe) === 2);
    const [p1, p2, k1, k2] = await Promise.all([
      susunPihak(pihak1.baris, "pihak1", "pihak1", "pihak"),
      susunPihak(pihak2.baris, "pihak2", "pihak2", "pihak"),
      susunPihak(kuasa1, "pihak1", "kuasa1", "kuasa"),
      susunPihak(kuasa2, "pihak2", "kuasa2", "kuasa"),
    ]);

    const satuJadwal = jadwal.baris[0] || {};
    return {
      ok: true,
      perkara: {
        perkaraId: id,
        nomorPerkara: bersih(satuPerkara.nomorPerkara),
        alurPerkaraId: satuPerkara.alurPerkaraId ?? null,
        jenisPerkaraId: satuPerkara.jenisPerkaraId ?? null,
        jenisPerkaraNama: bersih(satuPerkara.jenisPerkaraNama),
        ruang: bersih(satuJadwal.ruangan),
        agenda: bersih(satuJadwal.agenda),
      },
      petugas: { majelis, pp, js, mediator: daftarMediator },
      pihak: [...p1, ...k1, ...p2, ...k2],
      tidakTerbaca,
    };
  }

  let tabelSiap = false;
  async function pastikanTabel() {
    if (tabelSiap) return;
    await kueriBot(`
      CREATE TABLE IF NOT EXISTS ${TABEL} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        perkara_id VARCHAR(32) NOT NULL,
        mediasi_id VARCHAR(32) NOT NULL DEFAULT '',
        konteks VARCHAR(16) NOT NULL DEFAULT 'sidang',
        nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
        sasaran_kunci VARCHAR(64) NOT NULL,
        sasaran_nama VARCHAR(191) NOT NULL DEFAULT '',
        sasaran_peran VARCHAR(64) NOT NULL DEFAULT '',
        sasaran_jenis VARCHAR(16) NOT NULL DEFAULT '',
        saluran VARCHAR(16) NOT NULL,
        nomor_tersamar VARCHAR(32) NOT NULL DEFAULT '',
        teks TEXT NULL,
        ruang VARCHAR(128) NOT NULL DEFAULT '',
        oleh VARCHAR(191) NOT NULL DEFAULT '',
        oleh_user_id VARCHAR(64) NOT NULL DEFAULT '',
        ip VARCHAR(45) NOT NULL DEFAULT '',
        lewat VARCHAR(32) NOT NULL DEFAULT 'ALETA',
        hasil VARCHAR(32) NOT NULL DEFAULT 'diproses',
        keterangan VARCHAR(255) NOT NULL DEFAULT '',
        antrean_id VARCHAR(64) NOT NULL DEFAULT '',
        dibuat_pada DATETIME NOT NULL,
        diperbarui_pada DATETIME NULL,
        PRIMARY KEY (id),
        INDEX idx_panggil_perkara (perkara_id, dibuat_pada),
        INDEX idx_panggil_saluran (saluran, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tabelSiap = true;
  }

  /**
   * Mencatat panggilan. Menolak bila orang yang sama baru saja dipanggil lewat
   * saluran yang sama (jeda) - dua petugas yang menekan nama yang sama hampir
   * bersamaan tidak boleh membuat hakim menerima dua pesan.
   */
  async function catat(isi = {}) {
    const perkaraId = bersih(isi.perkaraId);
    const saluran = bersih(isi.saluran);
    const kunci = bersih(isi.sasaranKunci).slice(0, 64);
    if (!/^\d{1,20}$/.test(perkaraId)) return { ok: false, alasan: "perkara_tidak_sah" };
    if (!SALURAN.includes(saluran)) return { ok: false, alasan: "saluran_tidak_sah" };
    if (!kunci) return { ok: false, alasan: "sasaran_tidak_sah" };
    const jeda = Number.isFinite(Number(isi.jedaDetik)) ? Math.max(0, Number(isi.jedaDetik)) : JEDA_BAWAAN_DETIK;
    try {
      await pastikanTabel();
      if (jeda > 0) {
        const baru = await kueriBot(
          `SELECT id, oleh, DATE_FORMAT(dibuat_pada, '%H:%i') AS jam FROM ${TABEL}
            WHERE perkara_id = ? AND sasaran_kunci = ? AND saluran = ?
              AND hasil IN ('diproses', 'diantre', 'diumumkan')
              AND dibuat_pada >= (NOW() - INTERVAL ? SECOND)
            ORDER BY id DESC LIMIT 1`,
          [perkaraId, kunci, saluran, jeda]
        );
        if (Array.isArray(baru) && baru.length > 0) {
          return {
            ok: false,
            alasan: "baru_saja_dipanggil",
            pesan: `Baru saja dipanggil lewat ${saluran === "audio" ? "pengeras suara" : "WhatsApp"} oleh ${bersih(baru[0].oleh) || "petugas lain"} pukul ${bersih(baru[0].jam)}. Tunggu sebentar sebelum memanggil lagi.`,
          };
        }
      }
      const hasil = await kueriBot(
        `INSERT INTO ${TABEL}
           (perkara_id, mediasi_id, konteks, nomor_perkara, sasaran_kunci, sasaran_nama, sasaran_peran,
            sasaran_jenis, saluran, nomor_tersamar, teks, ruang, oleh, oleh_user_id, ip, lewat, hasil,
            keterangan, dibuat_pada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALETA', ?, ?, NOW())`,
        [
          perkaraId,
          bersih(isi.mediasiId).slice(0, 32),
          bersih(isi.konteks) === "mediasi" ? "mediasi" : "sidang",
          bersih(isi.nomorPerkara).slice(0, 191),
          kunci,
          bersih(isi.sasaranNama).slice(0, 191),
          bersih(isi.sasaranPeran).slice(0, 64),
          bersih(isi.sasaranJenis).slice(0, 16),
          saluran,
          bersih(isi.nomorTersamar).slice(0, 32),
          String(isi.teks || "").slice(0, 1000),
          bersih(isi.ruang).slice(0, 128),
          bersih(isi.oleh).slice(0, 191),
          bersih(isi.olehUserId).slice(0, 64),
          bersih(isi.ip).slice(0, 45),
          bersih(isi.hasil || "diproses").slice(0, 32),
          bersih(isi.keterangan).slice(0, 255),
        ]
      );
      return { ok: true, id: Number(hasil && hasil.insertId) || 0 };
    } catch (galat) {
      return { ok: false, alasan: `Riwayat panggilan ALETA tidak tersimpan: ${sebutGalat(galat)}` };
    }
  }

  /** Mengisi hasil akhir panggilan yang sudah dicatat (sesudah pesan diantre / ditolak). */
  async function perbarui({ id, hasil, keterangan = "", antreanId = "" } = {}) {
    const nomor = Number(id);
    if (!Number.isFinite(nomor) || nomor <= 0) return { ok: false, alasan: "id_tidak_sah" };
    try {
      await pastikanTabel();
      await kueriBot(
        `UPDATE ${TABEL} SET hasil = ?, keterangan = ?, antrean_id = ?, diperbarui_pada = NOW() WHERE id = ?`,
        [bersih(hasil).slice(0, 32), bersih(keterangan).slice(0, 255), bersih(antreanId).slice(0, 64), nomor]
      );
      return { ok: true };
    } catch (galat) {
      return { ok: false, alasan: `Hasil panggilan tidak tersimpan: ${sebutGalat(galat)}` };
    }
  }

  /**
   * Pengumuman suara untuk layar antrian / papan panggil.
   *
   * Tanpa `sejakId` hanya id terakhir yang dijawab (daftar kosong): layar yang
   * baru dibuka tidak memutar ulang pengumuman yang sudah lewat.
   */
  async function pengumuman({ sejakId } = {}) {
    try {
      await pastikanTabel();
      const sejak = Number(sejakId);
      if (!Number.isFinite(sejak) || sejak < 0 || String(sejakId ?? "") === "") {
        const akhir = await kueriBot(`SELECT COALESCE(MAX(id), 0) AS id FROM ${TABEL} WHERE saluran = 'audio'`);
        return { ok: true, terakhirId: Number(akhir && akhir[0] && akhir[0].id) || 0, daftar: [] };
      }
      const baris = await kueriBot(
        `SELECT id, teks, ruang, DATE_FORMAT(dibuat_pada, '%Y-%m-%d %H:%i:%s') AS dibuat
           FROM ${TABEL}
          WHERE saluran = 'audio' AND hasil = 'diumumkan' AND id > ?
            AND dibuat_pada >= (NOW() - INTERVAL ? SECOND)
          ORDER BY id ASC LIMIT 20`,
        [sejak, UMUR_PENGUMUMAN_DETIK]
      );
      const daftar = (Array.isArray(baris) ? baris : []).map((b) => ({
        id: Number(b.id),
        teks: String(b.teks || "").slice(0, 400),
        ruang: bersih(b.ruang),
        dibuat: bersih(b.dibuat),
      }));
      const terakhirId = daftar.length > 0 ? daftar[daftar.length - 1].id : sejak;
      return { ok: true, terakhirId, daftar };
    } catch (galat) {
      return { ok: false, alasan: sebutGalat(galat), terakhirId: Number(sejakId) || 0, daftar: [] };
    }
  }

  /** Riwayat panggilan satu perkara pada satu hari - untuk pop-up ("terakhir dipanggil ..."). */
  async function riwayat({ perkaraId, tanggal } = {}) {
    const id = bersih(perkaraId);
    const tgl = bersih(tanggal).slice(0, 10);
    if (!/^\d{1,20}$/.test(id)) return { ok: false, alasan: "perkara_tidak_sah", daftar: [] };
    try {
      await pastikanTabel();
      const baris = await kueriBot(
        `SELECT id, sasaran_kunci AS kunci, sasaran_nama AS nama, saluran, hasil, keterangan, oleh,
                DATE_FORMAT(dibuat_pada, '%Y-%m-%d %H:%i:%s') AS waktu
           FROM ${TABEL}
          WHERE perkara_id = ? ${/^\d{4}-\d{2}-\d{2}$/.test(tgl) ? "AND DATE(dibuat_pada) = ?" : ""}
          ORDER BY id DESC LIMIT 50`,
        /^\d{4}-\d{2}-\d{2}$/.test(tgl) ? [id, tgl] : [id]
      );
      return { ok: true, daftar: Array.isArray(baris) ? baris : [] };
    } catch (galat) {
      return { ok: false, alasan: sebutGalat(galat), daftar: [] };
    }
  }

  return { sasaran, catat, perbarui, pengumuman, riwayat, pastikanTabel };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  TABEL,
  JEDA_BAWAAN_DETIK,
  UMUR_PENGUMUMAN_DETIK,
  buatLayanan,
  ambilNomor,
  satukanOrang,
  sasaran: (opsi) => layananBawaan().sasaran(opsi),
  catat: (opsi) => layananBawaan().catat(opsi),
  perbarui: (opsi) => layananBawaan().perbarui(opsi),
  pengumuman: (opsi) => layananBawaan().pengumuman(opsi),
  riwayat: (opsi) => layananBawaan().riwayat(opsi),
};
