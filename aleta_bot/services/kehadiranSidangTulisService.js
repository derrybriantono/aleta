"use strict";

/**
 * ============================================================================
 * PEMBETULAN PILIHAN KEHADIRAN SIDANG DI SIPP - ATAS KLIK PP (G4 4.4, 30 Okt 2026)
 * ============================================================================
 *
 * Panel Blangko Derry sudah mencatat temuan (30 Okt) "putusan verstek padahal
 * SIPP mencatat Tergugat hadir" dengan aturan IDENTIK paket ABT
 * relaas-penetapan-30okt (PASANG.md "Deteksi konflik"). Berkas ini menambah:
 *
 *   1. USULAN (murni, usulKehadiran): pilihan kehadiran SIPP yang semestinya
 *      untuk tiap sidang yang bertentangan dengan
 *        a. amar verstek - Tergugat/Termohon tidak pernah hadir sampai putus;
 *        b. BAS yang dicetak untuk sidang itu - nama blangko BAS Derry
 *           menyebut kehadiran ("P & T Hadir", "P Hadir & T Tidak Hadir",
 *           "P & T Tidak Hadir"; kehadiranBas).
 *      Dua sumber yang berselisih pada sidang yang sama = TIDAK diusulkan
 *      (manusia yang memutuskan).
 *   2. PENULISAN ke perkara_jadwal_sidang.dihadiri_oleh HANYA atas klik PP
 *      (atau Super Admin - keputusan 30 Okt malam; rute portal menegakkannya), atas akun SIPP PP
 *      perkara itu (pilihPaniteraSidang - keputusan 7 Okt "penginput tunda &
 *      putusan = PP"), dalam bentuk borang "EDIT JADWAL SIDANG" SIPP:
 *        perkara_jadwal_sidang UPDATE dihadiri_oleh (+ sifat_sidang bawaan bila
 *          kosong, seperti borang), diperbaharui_oleh/_tanggal (jam SIPP, WIB)
 *        sys_audittrail UPDATE "UPDATE table <b>perkara_jadwal_sidang</b> dari
 *          halaman <b>EDIT JADWAL SIDANG</b> dengan Primary Key [id=N]" - 13
 *          kolom borang (nilaiAuditEditJadwal).
 *      Seperti tombol Putus (keputusan 30 Sep butir 12) riwayat perkara
 *      (updateproses 200) TIDAK ditulis: membetulkan kehadiran bukan langkah
 *      perkara.
 *
 * Arti angka (borang SIPP jadwal_sidang_p_edit.php, memori sandi-kehadiran-sidang-sipp):
 *   1 Semua Pihak · 2 Pihak Pertama Saja · 3 Pihak Kedua Saja · 4 Para Pihak Tidak Hadir
 *   5 Intervensi saja · 7 P+Intervensi · 8 T+Intervensi · 9 P+T (ada intervensi)
 *   10 Sebagian Penggugat · 11 Sebagian Tergugat · 13 Turut Tergugat saja
 *   14 P+Turut T · 15 T+Turut T
 *
 * BEDA DENGAN BORANG SIPP (disebut terang di rencana - "andaian"): borang Edit
 * SIPP hanya terbuka pada sidang TERAKHIR perkara yang BELUM putus (selain
 * Admin SIPP). Pembetulan atas sidang lampau / perkara yang sudah putus tetap
 * berbentuk baris Edit Jadwal Sidang atas akun PP - keputusan pengguna rencana
 * G4 ("penulisan ke SIPP hanya atas klik PP dan atas akun SIPP PP perkara").
 * Saklar BATAS_SEPERTI_BORANG di bawah membatasinya persis seperti borang bila
 * pengguna memutuskan demikian.
 *
 * KERING SEBAGAI BAWAAN; DAFTAR PUTIH TABEL (penetapanTulisService); SATU
 * TRANSAKSI + baca ulang kehadiran (yang berubah sejak panel dibaca =
 * batal); tidak satu kata "Aleta" ke SIPP (penjagaTandaSipp di jalankanRencana).
 */

const KEHADIRAN_TERGUGAT = new Set([1, 3, 8, 9, 11, 15]);

/** Tergugat/Termohon dibetulkan menjadi TIDAK hadir (amar verstek). 11 (sebagian Tergugat) tidak diusulkan. */
const JADI_T_TIDAK_HADIR = Object.freeze({ 1: 2, 3: 4, 8: 5, 9: 7, 15: 13 });

/** Pembetulan hanya persis seperti borang SIPP (sidang terakhir, belum putus)? Bawaan: tidak (lihat kepala berkas). */
const BATAS_SEPERTI_BORANG = false;

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(nilai.getDate()).padStart(2, "0")}`;
  }
  const t = String(nilai);
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : "";
}

/** Sebutan pihak menurut alur/jenis - satu sumber (memori sebutan-pihak-satu-sumber): permohonan/talak = Pemohon/Termohon. */
function sebutanPihak({ alurPerkaraId, jenisPerkara }) {
  const alur = Number(alurPerkaraId) || 0;
  if (alur === 16 || /talak/i.test(bersih(jenisPerkara))) return { p: "Pemohon", t: "Termohon" };
  return { p: "Penggugat", t: "Tergugat" };
}

function namaKehadiran(kode, sebut = { p: "Penggugat", t: "Tergugat" }) {
  switch (Number(kode)) {
    case 1:
      return "Semua Pihak";
    case 2:
      return `${sebut.p} Saja`;
    case 3:
      return `${sebut.t} Saja`;
    case 4:
      return "Para Pihak Tidak Hadir";
    case 5:
      return "Intervensi Saja";
    case 7:
      return `${sebut.p} dan Intervensi`;
    case 8:
      return `${sebut.t} dan Intervensi`;
    case 9:
      return `${sebut.p} dan ${sebut.t} (ada Intervensi)`;
    case 10:
      return `Sebagian ${sebut.p}`;
    case 11:
      return `Sebagian ${sebut.t}`;
    case 13:
      return `Turut ${sebut.t} Saja`;
    case 14:
      return `${sebut.p} dan Turut ${sebut.t}`;
    case 15:
      return `${sebut.t} dan Turut ${sebut.t}`;
    default:
      return "belum diisi";
  }
}

/**
 * Kehadiran menurut NAMA blangko BAS Derry (ALUR 01-13): angka SIPP 1-4, atau null bila namanya tidak
 * menyebut keduanya dengan tegas. "P" dan "T" di nama blangko = pihak pertama dan kedua (juga Pemohon/Termohon).
 */
function kehadiranBas(namaBlangko) {
  const x = bersih(namaBlangko).replace(/\s+/g, " ");
  if (!/\bBAS\b/i.test(x) || /ikrar/i.test(x)) return null;
  if (/\bP\s*(?:&|dan)\s*T\s+Tidak\s+Hadir\b/i.test(x)) return 4;
  if (/\bP\s+Hadir\s*(?:&|dan)\s*T\s+Tidak\s+Hadir\b/i.test(x)) return 2;
  if (/\bP\s+Tidak\s+Hadir\s*(?:&|dan)\s*T\s+Hadir\b/i.test(x)) return 3;
  if (/\bP\s*(?:&|dan)\s*T\s+Hadir\b/i.test(x)) return 1;
  return null;
}

/**
 * USULAN pembetulan (murni).
 *   perkara: { alurPerkaraId, nomorPerkara, jenisPerkara, amarVerstek, tanggalPutusan }
 *   sidang:  [{ jadwalId, urutan, tanggal, dihadiriOleh, ikrarTalak }]
 *   bas:     { jadwalId, kode } | null   (kode 1-4 dari kehadiranBas)
 * -> { usul: [{ jadwalId, urutan, tanggal, dari, ke, sebab, kalimat }], bertentangan: [...], tanpaUsul: [...] }
 */
function usulKehadiran({ perkara = {}, sidang = [], bas = null } = {}) {
  const sebut = sebutanPihak(perkara);
  const hasil = new Map();
  const tanpaUsul = [];
  const alur = Number(perkara.alurPerkaraId) || 0;
  const gugatan = alur ? alur === 15 : /\/Pdt\.G\//i.test(bersih(perkara.nomorPerkara));
  const batas = tanggalIso(perkara.tanggalPutusan);
  const baris = (Array.isArray(sidang) ? sidang : []).filter((s) => s && Number(s.jadwalId) > 0 && bersih(s.ikrarTalak).toUpperCase() !== "Y");

  if (gugatan && perkara.amarVerstek === true && /^\d{4}-\d{2}-\d{2}$/.test(batas)) {
    for (const s of baris) {
      const kode = Number(s.dihadiriOleh) || 0;
      const tgl = tanggalIso(s.tanggal);
      if (!KEHADIRAN_TERGUGAT.has(kode) || !tgl || tgl > batas) continue;
      const ke = JADI_T_TIDAK_HADIR[kode];
      if (!ke) {
        tanpaUsul.push({ jadwalId: Number(s.jadwalId), urutan: Number(s.urutan) || 0, tanggal: tgl, dari: kode, sebab: "verstek", kalimat: `${namaKehadiran(kode, sebut)} - tidak diusulkan, periksa sendiri` });
        continue;
      }
      hasil.set(Number(s.jadwalId), { jadwalId: Number(s.jadwalId), urutan: Number(s.urutan) || 0, tanggal: tgl, dari: kode, ke, sebab: "verstek" });
    }
  }

  const bertentangan = [];
  const kodeBas = bas && [1, 2, 3, 4].includes(Number(bas.kode)) ? Number(bas.kode) : 0;
  if (kodeBas) {
    const s = baris.find((x) => Number(x.jadwalId) === Number(bas.jadwalId));
    const kode = s ? Number(s.dihadiriOleh) || 0 : -1;
    const ada = s ? hasil.get(Number(s.jadwalId)) : null;
    const usulBas = s ? { jadwalId: Number(s.jadwalId), urutan: Number(s.urutan) || 0, tanggal: tanggalIso(s.tanggal), dari: kode, ke: kodeBas, sebab: "bas" } : null;
    if (ada && ada.ke !== kodeBas) {
      // BAS sidang itu menyebut kehadiran lain dari yang diturunkan amar verstek: dua sumber berselisih, tidak diusulkan.
      hasil.delete(Number(s.jadwalId));
      bertentangan.push({ ...usulBas, keVerstek: ada.ke });
    } else if (s && !ada && kode !== kodeBas && (kode === 0 || [1, 2, 3, 4].includes(kode))) {
      // Hanya 1-4 atau belum diisi: angka intervensi/turut tergugat terlalu rinci untuk dibaca dari nama BAS.
      hasil.set(Number(s.jadwalId), usulBas);
    }
  }

  const usul = [...hasil.values()]
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.urutan - b.urutan)
    .map((u) => ({
      ...u,
      kalimat: `sidang ${u.urutan > 0 ? `ke-${u.urutan} ` : ""}(${u.tanggal}): ${namaKehadiran(u.dari, sebut)} menjadi ${namaKehadiran(u.ke, sebut)}`,
    }));
  return { usul, bertentangan, tanpaUsul, sebutan: sebut };
}

const PESAN = {
  jadwal_tidak_ketemu: "Sidang ini tidak ditemukan di SIPP - mungkin sudah diubah. Muat ulang lalu coba lagi. Tidak ada yang diubah di SIPP.",
  kehadiran_tidak_sah: "Pilihan kehadiran tidak dikenal. Tidak ada yang diubah di SIPP.",
  kehadiran_sudah_sama: "Kehadiran di SIPP sudah sesuai. Tidak ada yang diubah.",
  kehadiran_berubah: "Kehadiran sidang ini di SIPP sudah berubah sejak panel dibaca. Muat ulang lalu periksa lagi. Tidak ada yang diubah di SIPP.",
  jadwal_berubah_sebelum_ditulis: "Kehadiran sidang ini di SIPP berubah tepat sebelum ditulis. Tidak ada yang diubah di SIPP.",
  sidang_ikrar: "Kehadiran sidang ikrar talak tidak dibetulkan dari sini. Tidak ada yang diubah di SIPP.",
  bukan_borang_sipp: "SIPP hanya mengizinkan pembetulan kehadiran pada sidang terakhir perkara yang belum putus. Mintalah Admin SIPP. Tidak ada yang diubah di SIPP.",
  panitera_sidang_tidak_ketemu: "Panitera pengganti perkara ini tidak ditemukan di SIPP. Tidak ada yang diubah di SIPP.",
  panitera_sidang_ganda: "Perkara ini punya lebih dari satu panitera pengganti aktif - tidak menebak atas nama siapa. Tidak ada yang diubah di SIPP.",
  akun_sipp_pp_diblokir: "Akun SIPP panitera pengganti perkara ini diblokir. Tidak ada yang diubah di SIPP.",
  akun_sipp_pp_tidak_ada: "Panitera pengganti perkara ini belum punya akun SIPP. Tidak ada yang diubah di SIPP.",
  akun_sipp_pp_ganda: "Panitera pengganti perkara ini punya lebih dari satu akun SIPP aktif. Tidak ada yang diubah di SIPP.",
  panitera_sidang_tidak_terbaca: "Panitera pengganti perkara ini belum dapat dibaca dari SIPP. Tidak ada yang diubah di SIPP.",
  operator_tidak_disebut: "Penekan tidak disebut. Tidak ada yang diubah di SIPP.",
};

function pesanTolak(kode) {
  return PESAN[kode] || "Pembetulan kehadiran belum dapat ditulis. Tidak ada yang diubah di SIPP.";
}

/**
 * d (semua opsional, untuk uji): kueri(sql, params), waktuSipp(), jalankanUtuh(rencana, {kering}),
 * pilihPaniteraSidang(baris, tanggal), barisAudit(...), nilaiAuditEditJadwal(keadaan, nilai), sifatSidangBorang(keadaan).
 */
function buatLayanan(d = {}) {
  const hasilSidang = () => require("./sidangHasilService");
  const penetapan = () => require("./penetapanTulisService");
  const kueri =
    d.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const waktuSipp = d.waktuSipp || (() => penetapan().waktuSipp());
  const jalankanUtuh = d.jalankanUtuh || ((rencana, opsi) => hasilSidang().jalankanRencanaUtuh(rencana, opsi));
  const pilihPp = d.pilihPaniteraSidang || ((baris, tgl) => hasilSidang().pilihPaniteraSidang(baris, tgl));
  const barisAudit = d.barisAudit || ((x) => penetapan().barisAudit(x));
  const nilaiAudit = d.nilaiAuditEditJadwal || ((k, n) => hasilSidang().nilaiAuditEditJadwal(k, n));
  const sifatBawaan = d.sifatSidangBorang || ((k) => hasilSidang().sifatSidangBorang(k));
  const namaHalaman = () => (d.namaHalaman ? d.namaHalaman : hasilSidang().NAMA_HALAMAN_EDIT);

  async function bacaPerkara(perkaraId) {
    const id = Number(perkaraId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const p = await kueri(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, p.alur_perkara_id AS alurPerkaraId,
              p.jenis_perkara_text AS jenisPerkara,
              (SELECT pu.tanggal_putusan FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id LIMIT 1) AS tanggalPutusan,
              (SELECT LOCATE('verstek', LOWER(pu.amar_putusan)) > 0 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id LIMIT 1) AS amarVerstek
         FROM perkara p WHERE p.perkara_id = ? LIMIT 1`,
      [id]
    ).catch(() => []);
    return (Array.isArray(p) && p[0]) || null;
  }

  /** Keadaan untuk panel: sidang + usulan (verstek; BAS bila disebut). Hanya SELECT. */
  async function keadaanKehadiran({ perkaraId, basJadwalId, basNama } = {}) {
    const perkara = await bacaPerkara(perkaraId);
    if (!perkara) return { ok: false, alasan: "jadwal_tidak_ketemu", pesan: pesanTolak("jadwal_tidak_ketemu") };
    const sidang = await kueri(
      `SELECT id AS jadwalId, urutan, tanggal_sidang AS tanggal, dihadiri_oleh AS dihadiriOleh, ikrar_talak AS ikrarTalak
         FROM perkara_jadwal_sidang WHERE perkara_id = ? ORDER BY tanggal_sidang ASC, id ASC`,
      [Number(perkara.perkaraId)]
    ).catch(() => []);
    const kodeBas = kehadiranBas(basNama);
    const u = usulKehadiran({
      perkara: { ...perkara, amarVerstek: Number(perkara.amarVerstek) === 1 || perkara.amarVerstek === true },
      sidang: Array.isArray(sidang) ? sidang : [],
      bas: kodeBas && Number(basJadwalId) > 0 ? { jadwalId: Number(basJadwalId), kode: kodeBas } : null,
    });
    // PP yang akan tercatat (bagi panel: tombol hanya untuk PP ini). Tanggal acuan = sidang terakhir.
    let pp = null;
    if (u.usul.length) {
      const akhir = (Array.isArray(sidang) ? sidang : []).map((s) => tanggalIso(s.tanggal)).filter(Boolean).sort().pop() || "";
      const h = await paniteraSidang(perkara.perkaraId, akhir);
      pp = h && h.ok ? { username: bersih(h.akun.username), namaLengkap: bersih(h.akun.fullname) } : null;
    }
    return {
      ok: true,
      perkara: { perkaraId: Number(perkara.perkaraId), nomorPerkara: bersih(perkara.nomorPerkara) },
      kodeBas: kodeBas || 0,
      pp,
      ...u,
    };
  }

  async function keadaanJadwal(jadwalId) {
    const id = Number(jadwalId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const b = await kueri(
      `SELECT j.id AS jadwalId, j.perkara_id AS perkaraId, j.tanggal_sidang AS tanggalSidang, j.jam_sidang AS jamSidang,
              j.sampai_jam AS sampaiJam, j.agenda, j.urutan, j.ditunda, j.alasan_ditunda AS alasanDitundaAsli,
              j.ruangan_id AS ruanganId, j.ruangan, j.sidang_keliling AS sidangKeliling, j.sifat_sidang AS sifatSidang,
              j.dihadiri_oleh AS dihadiriOleh, j.ikrar_talak AS ikrarTalak, j.keterangan,
              p.nomor_perkara AS nomorPerkara, p.alur_perkara_id AS alurPerkaraId, p.jenis_perkara_id AS jenisPerkaraId,
              p.jenis_perkara_text AS jenisPerkara,
              (SELECT pu.tanggal_putusan FROM perkara_putusan pu WHERE pu.perkara_id = j.perkara_id LIMIT 1) AS tanggalPutusan,
              (SELECT COUNT(*) FROM perkara_jadwal_sidang s WHERE s.perkara_id = j.perkara_id AND s.id <> j.id
                  AND (s.urutan > j.urutan OR s.tanggal_sidang > j.tanggal_sidang)) AS sidangSesudah
         FROM perkara_jadwal_sidang j JOIN perkara p ON p.perkara_id = j.perkara_id
        WHERE j.id = ? LIMIT 1`,
      [id]
    ).catch(() => []);
    const satu = (Array.isArray(b) && b[0]) || null;
    if (!satu) return null;
    satu.tanggalSidang = tanggalIso(satu.tanggalSidang);
    satu.tanggalPutusan = tanggalIso(satu.tanggalPutusan);
    // alasanDitunda dipakai nilaiAuditEditJadwal bila alasanDitundaAsli tidak ada - di sini selalu ada.
    satu.alasanDitunda = satu.alasanDitundaAsli;
    return satu;
  }

  async function paniteraSidang(perkaraId, tanggalSidang) {
    const baris = await kueri(
      `SELECT c.panitera_id, c.panitera_nama, c.tanggal_penetapan, d.username, d.fullname, d.block
         FROM perkara_panitera_pn c
         LEFT JOIN v_users d ON d.panitera_id = c.panitera_id
        WHERE c.aktif = 'Y' AND c.perkara_id = ?`,
      [Number(perkaraId)]
    ).catch(() => null);
    if (!Array.isArray(baris)) return { ok: false, alasan: "panitera_sidang_tidak_terbaca" };
    return pilihPp(baris, tanggalSidang);
  }

  /**
   * Rencana pembetulan satu sidang.
   *   minta: { jadwalId, dihadiriOleh, sebelum (angka kehadiran yang DIBACA panel; null = tidak diperiksa), sebab, operator, ip }
   */
  async function susunRencanaKehadiran(minta = {}) {
    const operator = bersih(minta.operator);
    if (!operator) return { ok: false, alasan: "operator_tidak_disebut", pesan: pesanTolak("operator_tidak_disebut") };
    const kode = Number(minta.dihadiriOleh);
    if (!Number.isInteger(kode) || kode < 1 || kode > 15 || kode === 6 || kode === 12) {
      return { ok: false, alasan: "kehadiran_tidak_sah", pesan: pesanTolak("kehadiran_tidak_sah") };
    }
    const keadaan = await keadaanJadwal(minta.jadwalId);
    if (!keadaan) return { ok: false, alasan: "jadwal_tidak_ketemu", pesan: pesanTolak("jadwal_tidak_ketemu") };
    if (bersih(keadaan.ikrarTalak).toUpperCase() === "Y") return { ok: false, alasan: "sidang_ikrar", pesan: pesanTolak("sidang_ikrar") };
    const sekarang = Number(keadaan.dihadiriOleh) || 0;
    if (sekarang === kode) return { ok: false, alasan: "kehadiran_sudah_sama", pesan: pesanTolak("kehadiran_sudah_sama") };
    if (minta.sebelum !== undefined && minta.sebelum !== null && (Number(minta.sebelum) || 0) !== sekarang) {
      return { ok: false, alasan: "kehadiran_berubah", pesan: pesanTolak("kehadiran_berubah") };
    }
    const terakhir = Number(keadaan.sidangSesudah) === 0;
    const sudahPutus = Boolean(keadaan.tanggalPutusan);
    const sepertiBorang = terakhir && !sudahPutus;
    if (BATAS_SEPERTI_BORANG && !sepertiBorang) return { ok: false, alasan: "bukan_borang_sipp", pesan: pesanTolak("bukan_borang_sipp") };

    const pp = await paniteraSidang(keadaan.perkaraId, keadaan.tanggalSidang);
    if (!pp || !pp.ok) return { ok: false, alasan: (pp && pp.alasan) || "panitera_sidang_tidak_ketemu", pesan: pesanTolak((pp && pp.alasan) || ""), nama: (pp && pp.nama) || [] };
    const akun = pp.akun;
    const saat = await waktuSipp();
    const ip = bersih(minta.ip);

    const nilai = { dihadiri_oleh: kode, diperbaharui_oleh: akun.username, diperbaharui_tanggal: saat };
    // Borang Edit selalu mengirim sifat sidang (bawaannya bila kosong) - sama dengan tombol Putus.
    const sifatKosong = !["Y", "T"].includes(bersih(keadaan.sifatSidang).toUpperCase());
    if (sifatKosong) nilai.sifat_sidang = sifatBawaan(keadaan);
    const sebut = sebutanPihak(keadaan);
    const kalimat = `sidang ${keadaan.urutan ? `ke-${keadaan.urutan} ` : ""}${keadaan.tanggalSidang}: kehadiran ${namaKehadiran(sekarang, sebut)} menjadi ${namaKehadiran(kode, sebut)}`;
    const langkah = [
      {
        tabel: "perkara_jadwal_sidang",
        aksi: "UPDATE",
        keterangan: kalimat,
        sql:
          `UPDATE perkara_jadwal_sidang SET dihadiri_oleh = ?, ${sifatKosong ? "sifat_sidang = ?, " : ""}diperbaharui_oleh = ?, diperbaharui_tanggal = ? ` +
          `WHERE id = ? AND COALESCE(dihadiri_oleh, 0) = ?`,
        params: [kode, ...(sifatKosong ? [nilai.sifat_sidang] : []), nilai.diperbaharui_oleh, nilai.diperbaharui_tanggal, Number(keadaan.jadwalId), sekarang],
      },
      barisAudit({
        username: akun.username,
        tabel: "perkara_jadwal_sidang",
        formulir: namaHalaman(),
        aksi: "UPDATE",
        nilai: nilaiAudit(keadaan, nilai),
        kunciSendiri: `id=${keadaan.jadwalId}`,
        ip,
        saat,
      }),
    ];
    const andaian = [];
    if (!sepertiBorang) {
      andaian.push(
        `Borang Edit Jadwal Sidang SIPP sendiri hanya terbuka untuk sidang terakhir perkara yang belum putus${
          sudahPutus ? " (perkara ini sudah putus)" : " (sidang ini bukan sidang terakhir)"
        }; pembetulan tetap dicatat sebagai Edit Jadwal Sidang atas akun PP perkara.`
      );
    }
    andaian.push("Riwayat perkara tidak diubah - yang dibetulkan hanya pilihan kehadiran sidang ini.");
    return {
      ok: true,
      perkara: { perkaraId: Number(keadaan.perkaraId), nomorPerkara: bersih(keadaan.nomorPerkara) },
      sidang: { jadwalId: Number(keadaan.jadwalId), urutan: Number(keadaan.urutan) || 0, tanggal: keadaan.tanggalSidang },
      dari: sekarang,
      ke: kode,
      kalimat,
      sepertiBorang,
      atasNama: { username: akun.username, namaLengkap: akun.fullname, peran: "panitera pengganti" },
      operator,
      sebab: bersih(minta.sebab).slice(0, 20),
      saat,
      langkah,
      andaian,
      kunciPerkara: Number(keadaan.perkaraId),
      periksaUlang: [
        {
          sql: "SELECT dihadiri_oleh FROM perkara_jadwal_sidang WHERE id = ?",
          params: [Number(keadaan.jadwalId)],
          alasan: "jadwal_berubah_sebelum_ditulis",
          cocok: (baris) => Array.isArray(baris) && Boolean(baris[0]) && (Number(baris[0].dihadiri_oleh) || 0) === sekarang,
        },
      ],
    };
  }

  async function jalankanRencanaKehadiran(rencana, opsi = {}) {
    if (!rencana || rencana.ok !== true) return { ok: false, alasan: (rencana && rencana.alasan) || "rencana_tidak_sah", pesan: rencana && rencana.pesan };
    const hasil = await jalankanUtuh(rencana, { kering: opsi.kering !== false });
    if (hasil && hasil.ok !== true && !hasil.pesan) hasil.pesan = pesanTolak(String(hasil.alasan || ""));
    return hasil;
  }

  return { keadaanKehadiran, susunRencanaKehadiran, jalankanRencanaKehadiran, keadaanJadwal };
}

let bawaan = null;
function layanan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  BATAS_SEPERTI_BORANG,
  JADI_T_TIDAK_HADIR,
  KEHADIRAN_TERGUGAT,
  buatLayanan,
  kehadiranBas,
  layanan,
  namaKehadiran,
  pesanTolak,
  sebutanPihak,
  usulKehadiran,
};
