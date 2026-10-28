"use strict";

/**
 * ============================================================================
 * HASIL MEDIASI DARI JADWAL MEDIASI - DITULIS PERSIS SEPERTI SIPP (28 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: "buat hasil mediasi serta isi form bagi yang perlu untuk
 * hasil mediasi dan di isi oleh akun PP". Jalur tulis SIPP yang BARU, meniru
 * borang "Edit Hasil Mediasi" SIPP. Kajian lengkap:
 * D:/aleta-dev/kerja/rencana-hasil-mediasi-28okt.md.
 *
 * Kode SIPP: controllers/tab_mediasi_c.php update_hasil_mediasi()
 *            models/mediasi/mediasi_m.php edit_mediasi(), cancelproses(),
 *            updateproses(), add_audittrail()
 *            views/perkara_tab/tab_mediasi_edit2.php (isian), tab_mediasi_v.php
 *            (kapan tautan Edit Hasil tampil)
 *
 * Yang ditulis SIPP satu kali tekan Simpan (diukur pada sipp_donggala, audit
 * 506518 / 505852 / 505672, Okt 2026) - semuanya pada DETIK yang sama:
 *
 *   perkara_mediasi   UPDATE  keputusan_mediasi (= tanggal pertemuan TERAKHIR),
 *                     catatan_mediasi, diinput_oleh/_tanggal (DITIMPA; jam
 *                     12 jam ala PHP "h"), tgl_laporan_mediator, [kesepakatan],
 *                     hasil_mediasi, [pengosongan akta/kesepakatan]
 *   sys_audittrail    EDIT    "Edit Data Mediasi ... [Mediasi_id=N]",
 *                     tablename perkara_mediasi, formname "Add Mediasi"
 *   perkara_proses    DELETE  200,190,181,180,151,150,130 pada urutan mediasi
 *                     itu (+ UPDATE perkara tahapan/proses terakhir tiap kali)
 *   perkara_proses    INSERT  130 + (T: 150,200 | D: 151,200 | Y1/Y2: 180 |
 *                     S: 181) (+ UPDATE perkara SEBELUM tiap INSERT - persis
 *                     updateproses, yang memperbarui perkara dari proses
 *                     terbesar sebelum barisnya sendiri lahir)
 *
 * perkara_proses dan perkara tidak diaudit (SIPP tidak mengauditnya).
 *
 * KERING SEBAGAI BAWAAN; DAFTAR PUTIH TABEL; SATU TRANSAKSI; IDEMPOTEN - isian
 * yang sama persis dengan SIPP tidak ditulis ulang. Akun SIPP: bawaan PANITERA
 * PENGGANTI perkara (permintaan pengguna 28 Okt), dapat dipilih mediator
 * berakun atau ketua majelis; tidak pernah diketik. TIDAK satu kata "Aleta" ke
 * SIPP (penjagaTandaSipp).
 */

const penjagaTandaSipp = require("./penjagaTandaSipp");
const tundaMediasiService = require("./tundaMediasiService");

/** Tabel yang boleh ditulis jalur ini - daftar putih. */
// perkara_jadwal_mediasi hanya untuk kehadiran pertemuan terakhir yang belum diisi (Edit jadwal SIPP).
const DAFTAR_TABEL_HASIL_MEDIASI = new Set(["perkara_mediasi", "sys_audittrail", "perkara_proses", "perkara", "perkara_jadwal_mediasi"]);

const NAMA_BORANG = "Add Mediasi";

/** Pilihan Hasil Mediasi borang SIPP (tab_mediasi_edit2.php) - urutan sama. */
const HASIL_SIPP = {
  Y1: "Berhasil Dengan Akta Perdamaian",
  Y2: "Berhasil Dengan Pencabutan",
  S: "Berhasil Sebagian",
  T: "Tidak Berhasil",
  D: "Tidak Dapat Dilaksanakan",
};

/** Hasil yang mewajibkan tanggal dan isi kesepakatan perdamaian. */
const BERKESEPAKATAN = new Set(["Y1", "Y2", "S"]);

/** Urutan cancelproses update_hasil_mediasi. */
const PROSES_DIBATALKAN = [200, 190, 181, 180, 151, 150, 130];

/** Proses yang dicatat menurut hasil (sesudah 130 Kesepakatan Mediasi). */
const PROSES_MENURUT_HASIL = { T: [150, 200], D: [151, 200], Y1: [180], Y2: [180], S: [181] };

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

const tanggalSah = (nilai) => {
  const teks = bersih(nilai).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return "";
  const [t, b, h] = teks.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  return d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h ? teks : "";
};

function hariDalamPekan(iso) {
  const [t, b, h] = iso.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h)).getUTCDay();
}

/** strlen PHP = panjang bita UTF-8. */
function panjangBita(teks) {
  return Buffer.byteLength(String(teks || ""), "utf8");
}

/** Kalimat awam untuk kode penolakan. */
function pesanTolak(kode, h = {}) {
  switch (kode) {
    case "mediasi_tidak_ketemu":
      return "Data mediasi ini tidak ditemukan di SIPP - mungkin sudah diubah. Muat ulang Jadwal Mediasi lalu coba lagi. Tidak ada yang diubah di SIPP.";
    case "bukan_mediasi_terakhir":
      return "Hasil hanya dapat diisi pada mediasi TERAKHIR perkara ini (aturan SIPP). Tidak ada yang diubah di SIPP.";
    case "belum_ada_pertemuan":
      return "Mediasi ini belum punya pertemuan di SIPP, jadi tanggal hasil mediasi belum ada. Tidak ada yang diubah di SIPP.";
    case "kehadiran_belum_diisi":
      return "Kehadiran pihak pada pertemuan mediasi terakhir belum diisi di SIPP - SIPP baru menampilkan Edit Hasil Mediasi sesudahnya. Pilih kehadiran pihak pada pertemuan itu di form ini.";
    case "kehadiran_tidak_sah":
      return "Kehadiran pihak yang dipilih tidak dikenal.";
    case "pertemuan_belum_tiba":
      return `Pertemuan mediasi terakhir belum berlangsung${bersih(h.tanggal) ? ` (${h.tanggal})` : ""}, jadi kehadiran dan hasilnya belum dapat dicatat.`;
    case "perkara_sudah_putus":
      return "Perkara ini sudah diputus. Di SIPP, majelis dan panitera pengganti tidak dapat lagi menyunting hasil mediasi; mintalah Admin SIPP bila perlu dikoreksi. Tidak ada yang diubah di SIPP.";
    case "hasil_tidak_sah":
      return "Pilih hasil mediasi (Berhasil dengan akta perdamaian, Berhasil dengan pencabutan, Berhasil sebagian, Tidak berhasil, atau Tidak dapat dilaksanakan).";
    case "laporan_tidak_sah":
      return "Tanggal laporan mediator wajib diisi.";
    case "laporan_melebihi_hari_ini":
      return `Tanggal laporan mediator tidak boleh melebihi hari ini${bersih(h.hariIni) ? ` (${h.hariIni})` : ""}.`;
    case "laporan_sebelum_hasil":
      return `Tanggal laporan mediator tidak boleh sebelum tanggal hasil mediasi${bersih(h.tanggalHasil) ? ` (${h.tanggalHasil}, pertemuan mediasi terakhir)` : ""}.`;
    case "keterangan_terlalu_pendek":
      return "Keterangan paling sedikit 5 huruf bila diisi (aturan SIPP), atau kosongkan.";
    case "keterangan_terlalu_panjang":
      return "Keterangan paling panjang 500 huruf.";
    case "kesepakatan_tanggal_tidak_sah":
      return "Tanggal kesepakatan perdamaian wajib diisi untuk hasil berhasil / berhasil sebagian.";
    case "kesepakatan_melebihi_hari_ini":
      return `Tanggal kesepakatan perdamaian tidak boleh melebihi hari ini${bersih(h.hariIni) ? ` (${h.hariIni})` : ""}.`;
    case "kesepakatan_melebihi_laporan":
      return "Tanggal kesepakatan perdamaian tidak boleh melebihi tanggal laporan mediator.";
    case "kesepakatan_isi_pendek":
      return "Isi kesepakatan perdamaian paling sedikit 50 huruf (aturan SIPP).";
    case "akun_tidak_tersedia":
      return bersih(h.pesan) || "Akun SIPP yang akan dipakai untuk mencatat tidak tersedia. Pilih akun lain.";
    case "operator_tidak_disebut":
      return "Permintaan tidak menyebut siapa yang menekan tombolnya - masuk ulang ke ALETA lalu coba lagi.";
    case "mediasi_berubah":
      return "Hasil mediasi ini baru saja diubah orang lain di SIPP. Muat ulang lalu coba lagi. Tidak ada yang diubah di SIPP.";
    case "jam_sipp_tidak_terbaca":
      return "Jam server SIPP tidak terbaca. Coba lagi sebentar. Tidak ada yang diubah di SIPP.";
    case "proses_tidak_terbaca":
      return "Daftar tahapan perkara ini (alur proses) tidak terbaca dari SIPP. Tidak ada yang diubah di SIPP.";
    case "teks_menyebut_aleta":
      return bersih(h.pesan) || "Isian memuat kata yang tidak boleh tertulis di SIPP. Hapus dulu lalu coba lagi.";
    default:
      return bersih(h.pesan) || `Pencatatan hasil mediasi ditolak (${kode}). Tidak ada yang diubah di SIPP.`;
  }
}

function tolak(kode, tambahan = {}) {
  return { ok: false, alasan: kode, ...tambahan, pesan: tambahan.pesan || pesanTolak(kode, tambahan) };
}

/**
 * Isi kolom perkara_mediasi PERSIS urutan $data_add update_hasil_mediasi
 * (urutan kunci = urutan deskripsi audit; kunci yang ditimpa tetap di tempatnya).
 */
function isianMediasi({ tanggalHasil, keterangan, username, saat12, laporan, hasil, tanggalKesepakatan, isiKesepakatan }) {
  const data = {
    keputusan_mediasi: tanggalHasil,
    catatan_mediasi: keterangan,
    diinput_oleh: username,
    diinput_tanggal: saat12,
    tgl_laporan_mediator: laporan,
  };
  if (BERKESEPAKATAN.has(hasil)) {
    data.tgl_kesepakatan_perdamaian = tanggalKesepakatan;
    data.isi_kesepakatan_perdamaian = isiKesepakatan;
  }
  data.hasil_mediasi = hasil;
  if (hasil === "D" || hasil === "T") {
    data.akta_perdamaian = null;
    data.isi_akta_perdamaian = "";
    data.isi_akta_perdamaian_dok = "";
    data.tgl_kesepakatan_perdamaian = null;
    data.isi_kesepakatan_perdamaian = "";
  } else if (hasil === "S") {
    data.akta_perdamaian = null;
    data.isi_akta_perdamaian = "";
    data.isi_akta_perdamaian_dok = "";
  }
  return data;
}

/**
 * Tiruan urutan cancelproses/updateproses SIPP atas salinan perkara_proses -
 * untuk pratinjau (kering) dan untuk uji. Mengembalikan baris yang dihapus,
 * baris yang lahir, dan keadaan tahapan terakhir perkara sesudahnya.
 */
function tiruProses(barisAwal, { perkaraId, urutan, tanggal, prosesBaru, alur }) {
  let baris = barisAwal.map((b) => ({ ...b, proses_id: Number(b.proses_id), urutan: Number(b.urutan) }));
  let perkara = null;
  const dihapus = [];
  const lahir = [];
  const dari = (b) =>
    b ? { tahapan_id: b.tahapan_id, tahapan_nama: b.tahapan_nama, proses_id: b.proses_id, proses_nama: b.proses_nama } : null;
  const terbesar = (daftar) => daftar.reduce((a, b) => (!a || b.proses_id > a.proses_id ? b : a), null);

  for (const pid of PROSES_DIBATALKAN) {
    const kena = baris.filter((b) => b.proses_id === pid && b.urutan === urutan);
    dihapus.push(...kena);
    baris = baris.filter((b) => !(b.proses_id === pid && b.urutan === urutan));
    const sama = baris.filter((b) => b.urutan === urutan);
    const pilih = terbesar(sama.length ? baris.filter((b) => b.proses_id === terbesar(sama).proses_id) : baris);
    if (pilih) perkara = dari(pilih);
  }
  for (const pid of prosesBaru) {
    const atas = terbesar(baris);
    if (atas) perkara = dari(atas);
    const a = alur[pid];
    const b = {
      perkara_id: perkaraId,
      tahapan_id: a.tahapan_id,
      tahapan_nama: a.tahapan_nama,
      proses_id: pid,
      proses_nama: a.proses_nama,
      tanggal,
      urutan,
    };
    baris.push(b);
    lahir.push(b);
  }
  return { dihapus, lahir, perkara, baris };
}

function buatLayanan(deps = {}) {
  const kueri =
    deps.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const transaksi =
    deps.transaksi ||
    (deps.kueri ? (kerja) => kerja(kueri) : (kerja) => require("./transaksiSipp").denganTransaksi(kerja));
  const waktu = deps.waktu || (() => require("./penetapanTulisService").waktuSipp());
  // Pertemuan & akun perkara: satu sumber dengan Tunda mediasi.
  const tunda =
    deps.tunda ||
    tundaMediasiService.buatLayanan({
      kueri,
      transaksi,
      waktu,
      ...(deps.paniteraSidang ? { paniteraSidang: deps.paniteraSidang } : {}),
      ...(deps.pesanSidang ? { pesanSidang: deps.pesanSidang } : {}),
    });

  async function satu(sql, params) {
    const baris = await kueri(sql, params);
    return (Array.isArray(baris) && baris[0]) || null;
  }

  /** Data hasil mediasi + pertemuan + kedudukan mediasi itu di perkaranya. */
  async function bacaHasil(mediasiId) {
    const med = await tunda.bacaMediasi(mediasiId);
    if (!med) return null;
    const h = await satu(
      `SELECT m.hasil_mediasi AS hasil, DATE_FORMAT(m.keputusan_mediasi, '%Y-%m-%d') AS keputusan,
              DATE_FORMAT(m.tgl_kesepakatan_perdamaian, '%Y-%m-%d') AS kesepakatan,
              m.isi_kesepakatan_perdamaian AS isiKesepakatan, m.catatan_mediasi AS catatan,
              m.diinput_oleh AS diinputOleh, DATE_FORMAT(m.diinput_tanggal, '%Y-%m-%d %H:%i:%s') AS diinputTanggal,
              DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tanggalPutusan
         FROM perkara_mediasi m
         LEFT JOIN perkara_putusan pu ON pu.perkara_id = m.perkara_id
        WHERE m.mediasi_id = ?
        LIMIT 1`,
      [med.mediasiId]
    );
    const semua = await kueri(`SELECT mediasi_id AS id FROM perkara_mediasi WHERE perkara_id = ? ORDER BY mediasi_id ASC`, [med.perkaraId]);
    const daftar = (Array.isArray(semua) ? semua : []).map((x) => Number(x.id));
    const urutan = daftar.indexOf(med.mediasiId) + 1;
    const hasil = bersih(h && h.hasil).toUpperCase();
    return {
      ...med,
      hasil: hasil === "Y" ? "Y1" : hasil,
      keputusan: tanggalSah(h && h.keputusan),
      kesepakatan: tanggalSah(h && h.kesepakatan),
      isiKesepakatan: String((h && h.isiKesepakatan) || ""),
      catatan: String((h && h.catatan) || ""),
      diinputOleh: bersih(h && h.diinputOleh),
      diinputTanggal: bersih(h && h.diinputTanggal),
      tanggalPutusan: tanggalSah(h && h.tanggalPutusan),
      urutanMediasi: urutan > 0 ? urutan : 1,
      terakhir: daftar.length === 0 || daftar[daftar.length - 1] === med.mediasiId,
    };
  }

  function pertemuanTerakhir(med) {
    return med.jadwal.length ? med.jadwal[med.jadwal.length - 1] : null;
  }

  /** Sebab borang tidak dapat dibuka (tanpa isian) - "" = boleh. */
  function sebabTertutup(med, hariIni) {
    if (!med.terakhir) return "bukan_mediasi_terakhir";
    const akhir = pertemuanTerakhir(med);
    if (!akhir || !akhir.tanggal) return "belum_ada_pertemuan";
    if (med.tanggalPutusan) return "perkara_sudah_putus";
    // Kehadiran kosong TIDAK menutup borang: diisi sekalian (langkah Edit jadwal SIPP),
    // asal pertemuannya sudah berlangsung - validateEdit SIPP menolak tanggal sesudah hari ini.
    if (!akhir.dihadiriOleh && hariIni && akhir.tanggal > hariIni) return "pertemuan_belum_tiba";
    return "";
  }

  /** Keadaan untuk borang: isian SIPP sekarang, pilihan, akun. Hanya SELECT. */
  async function keadaanHasil(minta = {}) {
    const med = await bacaHasil(minta.mediasiId);
    if (!med) return tolak("mediasi_tidak_ketemu");
    const saat = bersih(await waktu());
    const hariIni = tanggalSah(saat.slice(0, 10));
    const akhir = pertemuanTerakhir(med);
    const kode = sebabTertutup(med, hariIni);
    const akun = await tunda.akunPerkara(med, akhir ? akhir.tanggal : "");
    const petugas = await tunda.namaPetugasPerkara(med.perkaraId);
    return {
      ok: true,
      boleh: !kode,
      kodeTolak: kode,
      sebabTolak: kode ? pesanTolak(kode) : "",
      perkara: { perkaraId: med.perkaraId, nomorPerkara: med.nomorPerkara },
      mediasiId: med.mediasiId,
      mediator: med.mediator,
      majelis: petugas.majelis,
      panitera: petugas.panitera,
      urutanMediasi: med.urutanMediasi,
      tanggalHasil: akhir ? akhir.tanggal : "",
      jumlahPertemuan: med.jadwal.length,
      perluKehadiran: Boolean(akhir && !akhir.dihadiriOleh),
      kehadiran: akhir ? { nilai: akhir.dihadiriOleh, label: tundaMediasiService.KEHADIRAN_MEDIASI[Number(akhir.dihadiriOleh)] || "" } : null,
      pilihanKehadiran: Object.entries(tundaMediasiService.KEHADIRAN_MEDIASI).map(([nilai, label]) => ({ nilai, label })),
      sipp: {
        hasil: med.hasil,
        hasilLabel: HASIL_SIPP[med.hasil] || "",
        laporan: med.laporan,
        kesepakatan: med.kesepakatan,
        isiKesepakatan: med.isiKesepakatan,
        keterangan: med.catatan,
        diisiOleh: med.laporan ? med.diinputOleh : "",
      },
      pilihanHasil: Object.entries(HASIL_SIPP).map(([nilai, label]) => ({ nilai, label, kesepakatan: BERKESEPAKATAN.has(nilai) })),
      hariIni,
      akun,
    };
  }

  /** Alur proses perkara (proses_alur_perkara) untuk proses yang mungkin dicatat. */
  async function bacaAlur(alurPerkaraId) {
    const ids = [130, 150, 151, 180, 181, 200];
    const baris = await kueri(
      `SELECT proses_id, tahapan_id, tahapan_nama, proses_nama FROM proses_alur_perkara
        WHERE alur_perkara_id = ? AND proses_id IN (${ids.map(() => "?").join(",")})`,
      [alurPerkaraId, ...ids]
    ).catch(() => null);
    if (!Array.isArray(baris)) return null;
    const peta = {};
    for (const b of baris) peta[Number(b.proses_id)] = { tahapan_id: b.tahapan_id, tahapan_nama: b.tahapan_nama, proses_nama: b.proses_nama };
    return peta;
  }

  /** Rencana tulis - seluruh pemeriksaan SIPP SEBELUM satu baris pun ditulis. */
  async function susunRencanaHasil(minta = {}) {
    const operator = bersih(minta.operator);
    if (!operator) return tolak("operator_tidak_disebut");
    const med = await bacaHasil(minta.mediasiId);
    if (!med) return tolak("mediasi_tidak_ketemu");
    const tutupAwal = sebabTertutup(med, "");
    if (tutupAwal) return tolak(tutupAwal);
    const akhir = pertemuanTerakhir(med);
    const tanggalHasil = akhir.tanggal;

    // Urutan pemeriksaan = urutan update_hasil_mediasi SIPP.
    const laporan = tanggalSah(minta.tanggalLaporan);
    if (!laporan) return tolak("laporan_tidak_sah");
    const hasil = bersih(minta.hasil).toUpperCase();
    if (!HASIL_SIPP[hasil]) return tolak("hasil_tidak_sah");
    const keterangan = bersih(minta.keterangan).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
    if (keterangan && keterangan.length < 5) return tolak("keterangan_terlalu_pendek");
    if (keterangan.length > 500) return tolak("keterangan_terlalu_panjang");
    const berkesepakatan = BERKESEPAKATAN.has(hasil);
    const isiKesepakatan = berkesepakatan ? bersih(minta.isiKesepakatan).replace(/&nbsp;/g, " ") : "";
    let kesepakatan = "";
    if (berkesepakatan) {
      kesepakatan = tanggalSah(minta.tanggalKesepakatan);
      if (!kesepakatan) return tolak("kesepakatan_tanggal_tidak_sah");
      if (panjangBita(isiKesepakatan) < 50) return tolak("kesepakatan_isi_pendek");
    }

    const saat = bersih(await waktu());
    const saat24 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(saat) ? saat : "";
    if (!saat24) return tolak("jam_sipp_tidak_terbaca");
    const hariIni = saat24.slice(0, 10);
    // Kehadiran pertemuan terakhir: SIPP baru menampilkan Edit Hasil sesudah terisi.
    let kehadiran = akhir.dihadiriOleh;
    let isiKehadiran = false;
    if (!kehadiran) {
      kehadiran = bersih(minta.kehadiran);
      if (!kehadiran) return tolak("kehadiran_belum_diisi");
      if (!/^[1-4]$/.test(kehadiran)) return tolak("kehadiran_tidak_sah");
      if (akhir.tanggal > hariIni) return tolak("pertemuan_belum_tiba", { tanggal: akhir.tanggal });
      isiKehadiran = true;
    }
    if (laporan > hariIni) return tolak("laporan_melebihi_hari_ini", { hariIni });
    if (laporan < tanggalHasil) return tolak("laporan_sebelum_hasil", { tanggalHasil });
    if (berkesepakatan) {
      if (kesepakatan > hariIni) return tolak("kesepakatan_melebihi_hari_ini", { hariIni });
      if (kesepakatan > laporan) return tolak("kesepakatan_melebihi_laporan");
    }

    // Penjaga bersama: tidak satu kata "Aleta" ke SIPP.
    const tahanTanda = penjagaTandaSipp.periksaIsian({ Keterangan: keterangan, "Isi Kesepakatan Perdamaian": isiKesepakatan });
    if (!tahanTanda.ok) return tolak("teks_menyebut_aleta", { pesan: tahanTanda.pesan, kolom: tahanTanda.kolom });

    const peringatan = [];
    const hariLaporan = hariDalamPekan(laporan);
    if (hariLaporan === 0 || hariLaporan === 6) {
      peringatan.push(`Tanggal laporan mediator ${laporan} jatuh pada Sabtu/Minggu - pemilih tanggal SIPP tidak menawarkannya. Pastikan tanggalnya benar.`);
    }

    // Isian sama persis dengan SIPP = tidak ada yang ditulis (idempoten).
    const sama =
      !isiKehadiran &&
      med.hasil === hasil &&
      med.laporan === laporan &&
      med.keputusan === tanggalHasil &&
      bersih(med.catatan) === keterangan &&
      (!berkesepakatan || (med.kesepakatan === kesepakatan && bersih(med.isiKesepakatan) === isiKesepakatan));

    const akun = await tunda.akunPerkara(med, tanggalHasil);
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
    const ringkas = {
      ok: true,
      perkara: { perkaraId: med.perkaraId, nomorPerkara: med.nomorPerkara },
      mediasiId: med.mediasiId,
      mediator: { nama: med.mediator },
      urutanMediasi: med.urutanMediasi,
      tanggalHasil,
      hasil: { kode: hasil, label: HASIL_SIPP[hasil] },
      laporan,
      kesepakatan,
      keterangan,
      kehadiran: { nilai: kehadiran, label: tundaMediasiService.KEHADIRAN_MEDIASI[Number(kehadiran)] || "", diisiSekarang: isiKehadiran },
      sebelumnya: { hasil: med.hasil, laporan: med.laporan, diisiOleh: med.laporan ? med.diinputOleh : "" },
      penanda: { hasil: med.hasil, laporan: med.laporan, diinputTanggal: med.diinputTanggal },
      atasNama: { ...atasNama, sebagai: pilihAkun },
      operator,
      saat: saat24,
      peringatan,
    };
    if (sama) return { ...ringkas, tanpaPerubahan: true, langkah: [] };

    const alur = await bacaAlur(med.alurPerkaraId);
    const prosesBaru = [130, ...PROSES_MENURUT_HASIL[hasil]];
    if (!alur || prosesBaru.some((pid) => !alur[pid])) return tolak("proses_tidak_terbaca");
    const prosesAda = await kueri(
      `SELECT perkara_id, tahapan_id, tahapan_nama, proses_id, proses_nama, urutan FROM perkara_proses WHERE perkara_id = ?`,
      [med.perkaraId]
    ).catch(() => null);
    if (!Array.isArray(prosesAda)) return tolak("proses_tidak_terbaca");
    const tiru = tiruProses(prosesAda, { perkaraId: med.perkaraId, urutan: med.urutanMediasi, tanggal: tanggalHasil, prosesBaru, alur });
    const persidanganTerhapus = tiru.dihapus.filter((b) => b.proses_id === 200);
    if (persidanganTerhapus.length) {
      peringatan.push(
        prosesBaru.includes(200)
          ? `Seperti SIPP, catatan riwayat "Persidangan" urutan ${med.urutanMediasi} dicatat ulang dengan tanggal hasil mediasi (${tanggalHasil}). Jadwal sidang sendiri tidak berubah.`
          : `Seperti SIPP, catatan riwayat "Persidangan" urutan ${med.urutanMediasi} ikut dihapus dari riwayat perkara karena hasilnya berhasil. Jadwal sidang sendiri tidak berubah.`
      );
    }

    const saat12 = tundaMediasiService.waktuDuaBelas(saat24);
    const nilai = isianMediasi({ tanggalHasil, keterangan, username, saat12, laporan, hasil, tanggalKesepakatan: kesepakatan, isiKesepakatan });
    const ip = bersih(minta.ip);
    const langkah = [];
    if (isiKehadiran) {
      langkah.push({
        tabel: "perkara_jadwal_mediasi",
        aksi: "UPDATE",
        // Edit jadwal SIPP (update_jadwal_mediasi): tanpa audit - sama dengan Tunda mediasi.
        sql: "UPDATE perkara_jadwal_mediasi SET dihadiri_oleh = ?, diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE id = ?",
        params: [kehadiran, username, saat12, akhir.id],
        keterangan: `kehadiran pihak pertemuan ${akhir.tanggal}: ${tundaMediasiService.KEHADIRAN_MEDIASI[Number(kehadiran)]} (seperti Edit Jadwal Mediasi SIPP, atas nama ${username})`,
      });
    }
    langkah.push({
      tabel: "perkara_mediasi",
      aksi: "UPDATE",
      sql: `UPDATE perkara_mediasi SET ${Object.keys(nilai).map((k) => `${k} = ?`).join(", ")} WHERE mediasi_id = ?`,
      params: [...Object.values(nilai), med.mediasiId],
      keterangan: `hasil mediasi: ${HASIL_SIPP[hasil]}, laporan mediator ${laporan}${kesepakatan ? `, kesepakatan ${kesepakatan}` : ""}, atas nama ${username}`,
    });
    langkah.push({
      tabel: "sys_audittrail",
      aksi: "INSERT",
      sql:
        "INSERT INTO sys_audittrail (datetime, ipaddress, username, tablename, formname, action, title, description) " +
        "VALUES (?,?,?,?,?,?,?,?)",
      params: [
        saat24,
        penjagaTandaSipp.ipAuditSipp(ip),
        bersih(username).slice(0, 30),
        "perkara_mediasi",
        NAMA_BORANG,
        "EDIT",
        `Edit Data Mediasi <br />Edit table <b>Perkara_Mediasi</b> dari halaman <b>Mediasi</b> dengan Primary Key [Mediasi_id=${med.mediasiId}]`,
        tundaMediasiService.keteranganAudit(nilai),
      ],
      keterangan: `catatan audit perubahan data mediasi atas nama ${username}`,
    });
    const urutan = med.urutanMediasi;
    for (const pid of PROSES_DIBATALKAN) {
      langkah.push({
        tabel: "perkara_proses",
        aksi: "DELETE",
        sql: "DELETE FROM perkara_proses WHERE proses_id = ? AND perkara_id = ? AND urutan = ?",
        params: [pid, med.perkaraId, urutan],
        keterangan: `riwayat proses ${pid} urutan ${urutan} dibersihkan (seperti SIPP sebelum mencatat ulang)`,
      });
      langkah.push({ tabel: "perkara", aksi: "UPDATE", segarkan: "batal", urutan, sql: SQL_PERKARA, params: [], keterangan: "tahapan terakhir perkara disegarkan (seperti SIPP)" });
    }
    for (const pid of prosesBaru) {
      const a = alur[pid];
      langkah.push({ tabel: "perkara", aksi: "UPDATE", segarkan: "catat", urutan, sql: SQL_PERKARA, params: [], keterangan: "tahapan terakhir perkara disegarkan (seperti SIPP)" });
      langkah.push({
        tabel: "perkara_proses",
        aksi: "INSERT",
        sql:
          "INSERT INTO perkara_proses (perkara_id, tahapan_id, tahapan_nama, proses_id, proses_nama, tanggal, urutan, diinput_oleh, diinput_tanggal) " +
          "VALUES (?,?,?,?,?,?,?,?,?)",
        params: [med.perkaraId, a.tahapan_id, a.tahapan_nama, pid, a.proses_nama, tanggalHasil, urutan, username, saat24],
        keterangan: `riwayat perkara: ${a.proses_nama} (${tanggalHasil})`,
      });
    }

    return {
      ...ringkas,
      tahapanSesudah: tiru.perkara ? { tahapan: tiru.perkara.tahapan_nama, proses: tiru.perkara.proses_nama } : null,
      riwayatDihapus: tiru.dihapus.map((b) => ({ prosesId: b.proses_id, proses: b.proses_nama, urutan: b.urutan })),
      riwayatBaru: tiru.lahir.map((b) => ({ prosesId: b.proses_id, proses: b.proses_nama, tanggal: b.tanggal })),
      langkah,
    };
  }

  /** Menjalankan rencana dalam satu transaksi; perkara_mediasi dikunci lalu diperiksa ulang. */
  async function jalankanRencanaHasil(rencana, opsi = {}) {
    if (!rencana || rencana.ok !== true) {
      return { ok: false, alasan: (rencana && rencana.alasan) || "rencana_tidak_sah", pesan: rencana && rencana.pesan };
    }
    const kering = opsi.kering !== false;
    const tahanTanda = penjagaTandaSipp.periksaRencana(rencana);
    if (!tahanTanda.ok) {
      return { ok: false, kering, alasan: tahanTanda.alasan, pesan: tahanTanda.pesan, kolom: tahanTanda.kolom, selesai: [] };
    }
    if (rencana.tanpaPerubahan) {
      return { ok: true, kering, tanpaPerubahan: true, jumlahLangkah: 0, selesai: [], langkah: [] };
    }
    if (kering) {
      return {
        ok: true,
        kering: true,
        jumlahLangkah: rencana.langkah.length,
        langkah: rencana.langkah.map((x) => ({ tabel: x.tabel, aksi: x.aksi, keterangan: x.keterangan })),
      };
    }
    for (const l of rencana.langkah) {
      if (!DAFTAR_TABEL_HASIL_MEDIASI.has(l.tabel)) {
        return { ok: false, kering: false, alasan: "tabel_di_luar_daftar", tabel: l.tabel, selesai: [] };
      }
    }

    const TOLAK = Symbol("tolak");
    const selesai = [];
    let pada = null;
    const perkaraId = rencana.perkara.perkaraId;
    try {
      return await transaksi(async (lewat) => {
        const kini = await lewat(
          `SELECT hasil_mediasi AS hasil, DATE_FORMAT(tgl_laporan_mediator, '%Y-%m-%d') AS laporan,
                  DATE_FORMAT(diinput_tanggal, '%Y-%m-%d %H:%i:%s') AS diinputTanggal
             FROM perkara_mediasi WHERE mediasi_id = ? FOR UPDATE`,
          [rencana.mediasiId]
        );
        const b = Array.isArray(kini) ? kini[0] : null;
        const hasilKini = bersih(b && b.hasil).toUpperCase();
        if (
          !b ||
          (hasilKini === "Y" ? "Y1" : hasilKini) !== rencana.penanda.hasil ||
          tanggalSah(b.laporan) !== rencana.penanda.laporan ||
          bersih(b.diinputTanggal) !== rencana.penanda.diinputTanggal
        ) {
          const g = new Error(pesanTolak("mediasi_berubah"));
          g[TOLAK] = "mediasi_berubah";
          throw g;
        }
        for (const l of rencana.langkah) {
          pada = { tabel: l.tabel, aksi: l.aksi, keterangan: l.keterangan };
          if (l.segarkan) {
            // Kueri SIPP apa adanya (cancelproses / updateproses).
            const atas =
              l.segarkan === "batal"
                ? await lewat(
                    `SELECT tahapan_id, tahapan_nama, proses_id, proses_nama FROM perkara_proses
                      WHERE perkara_id = ? AND proses_id = (SELECT MAX(proses_id) FROM perkara_proses WHERE perkara_id = ? AND urutan = ?)`,
                    [perkaraId, perkaraId, l.urutan]
                  ).then(async (r) =>
                    Array.isArray(r) && r.length
                      ? r
                      : lewat(
                          `SELECT tahapan_id, tahapan_nama, proses_id, proses_nama FROM perkara_proses
                            WHERE perkara_id = ? AND proses_id = (SELECT MAX(proses_id) FROM perkara_proses WHERE perkara_id = ?)`,
                          [perkaraId, perkaraId]
                        )
                  )
                : await lewat(
                    `SELECT tahapan_id, tahapan_nama, proses_id, proses_nama FROM perkara_proses WHERE perkara_id = ? ORDER BY proses_id DESC LIMIT 1`,
                    [perkaraId]
                  );
            const r = Array.isArray(atas) ? atas[0] : null;
            // Tanpa riwayat sama sekali: SIPP akan menulis NULL - di sini dilewati.
            if (!r) continue;
            await lewat(l.sql, [r.tahapan_id, r.tahapan_nama, r.proses_id, r.proses_nama, perkaraId]);
          } else {
            await lewat(l.sql, l.params);
          }
          selesai.push({ tabel: l.tabel, aksi: l.aksi, keterangan: l.keterangan });
        }
        return { ok: true, kering: false, jumlahLangkah: selesai.length, selesai };
      });
    } catch (galat) {
      const pesan = String((galat && galat.message) || galat).slice(0, 300);
      if (galat && galat[TOLAK]) return { ok: false, kering: false, alasan: galat[TOLAK], pesan, selesai: [] };
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

  return { keadaanHasil, susunRencanaHasil, jalankanRencanaHasil, bacaHasil };
}

const SQL_PERKARA =
  "UPDATE perkara SET tahapan_terakhir_id = ?, tahapan_terakhir_text = ?, proses_terakhir_id = ?, proses_terakhir_text = ? WHERE perkara_id = ?";

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  DAFTAR_TABEL_HASIL_MEDIASI,
  HASIL_SIPP,
  PROSES_DIBATALKAN,
  PROSES_MENURUT_HASIL,
  buatLayanan,
  pesanTolak,
  isianMediasi,
  tiruProses,
  keadaanHasil: (minta) => layananBawaan().keadaanHasil(minta),
  susunRencanaHasil: (minta) => layananBawaan().susunRencanaHasil(minta),
  jalankanRencanaHasil: (rencana, opsi) => layananBawaan().jalankanRencanaHasil(rencana, opsi),
};
