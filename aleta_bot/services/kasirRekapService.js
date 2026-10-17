"use strict";

/**
 * ============================================================================
 * KASIR - REKAP PENGELUARAN, PENGINGAT TUGAS, DAN CATATAN SETOR PNBP (1.189.x)
 * ============================================================================
 *
 * Diminta pengguna 9 Okt 2026 (butir 4 & 5):
 *
 *   rekap      pengeluaran kasir harian, mingguan, bulanan, triwulan,
 *              semester, tahunan - per jenis biaya, per perkara, per hari.
 *              Rentangnya dihitung layar (lib/kasir-otomatis.ts rentangPeriode);
 *              di sini hanya dari-sampai. HANYA SELECT ke SIPP.
 *   pengingat  tugas kasir yang tertinggal:
 *                sisa-panjar      perkara putus, sisa panjar belum dikembalikan
 *                belum-dijurnal   perkara putus, Redaksi/Meterai belum dijurnal
 *                panjar-kurang    perkara putus, saldo jurnal minus
 *                pnbp-belum-setor hari ber-PNBP yang setorannya belum dicatat
 *              HANYA SELECT ke SIPP.
 *   setor PNBP SIPP tidak punya tempat mencatat setoran PNBP ke kas negara
 *              (tidak ada tabel setor/pnbp di skema satker). Catatannya
 *              karena itu di basis data ALETA bot sendiri -
 *              aleta_bot_kasir_setor_pnbp - dibuat saat pertama dipakai
 *              (pola jejakAletaService). TIDAK ADA tulisan ke SIPP dari berkas
 *              ini.
 */

const TAHAPAN = 10;
const KATEGORI_PNBP = 11;
const STATUS_DIKABULKAN = 62;
const JENIS_CERAI_TALAK = 346;
const AMBANG_SISA = 1000;
const HARI_PENGINGAT_PUTUSAN = 365;
const HARI_PENGINGAT_PNBP = 30;
const MAKS_RENTANG_HARI = 400;
const TABEL_SETOR = "aleta_bot_kasir_setor_pnbp";

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function angka(nilai) {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : 0;
}

function tanggalSah(nilai) {
  const teks = bersih(nilai).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return "";
  const [t, b, h] = teks.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  return d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h ? teks : "";
}

function geserHari(iso, n) {
  const [t, b, h] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h + n));
  return d.toISOString().slice(0, 10);
}

function selisihHari(dari, sampai) {
  const a = Date.parse(`${dari}T00:00:00Z`);
  const b = Date.parse(`${sampai}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** Hari kerja sesudah tanggal itu (Sabtu/Minggu dilompati) - tenggat setor PNBP. */
function hariKerjaBerikut(iso) {
  let t = geserHari(iso, 1);
  for (let i = 0; i < 7; i += 1) {
    const h = new Date(`${t}T00:00:00Z`).getUTCDay();
    if (h !== 0 && h !== 6) break;
    t = geserHari(t, 1);
  }
  return t;
}

function buatLayanan(deps = {}) {
  const kueri =
    deps.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const kueriAleta =
    deps.kueriAleta ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../bot_db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));

  // Isi lama kolom waktu dipindah ke UTC sebelum tulisan pertama (botDbService).
  // Basis data tiruan (uji) tidak dimigrasi kecuali disebut tegas.
  const migrasiUtc = deps.migrasiUtc || (deps.kueriAleta ? async () => {} : () => require("./botDbService").pastikanUtc());
  const sqlSetempat = (kolom) => require("../utils/waktuUtc").sqlSetempat(kolom);

  async function semua(sql, params) {
    const baris = await kueri(sql, params);
    return Array.isArray(baris) ? baris : [];
  }

  async function hariIniBasisData() {
    const b = await semua("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d') AS hari", []);
    const hari = tanggalSah(b[0] && b[0].hari);
    if (!hari) throw new Error("jam_basis_data_tidak_terbaca");
    return hari;
  }

  // ─── Catatan setor PNBP (basis data ALETA) ────────────────────────────────

  let siapSetor = null;
  function pastikanTabelSetor() {
    if (siapSetor) return siapSetor;
    siapSetor = kueriAleta(`
      CREATE TABLE IF NOT EXISTS ${TABEL_SETOR} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tanggal_transaksi DATE NOT NULL,
        jumlah DECIMAL(15,2) NOT NULL DEFAULT 0,
        ntpn VARCHAR(60) NOT NULL DEFAULT '',
        keterangan VARCHAR(200) NOT NULL DEFAULT '',
        operator VARCHAR(120) NOT NULL DEFAULT '',
        akun_sipp VARCHAR(60) NOT NULL DEFAULT '',
        ip VARCHAR(45) NOT NULL DEFAULT '',
        dicatat DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_setor_tanggal (tanggal_transaksi)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
      .then(() => migrasiUtc())
      .catch((galat) => {
        siapSetor = null;
        throw galat;
      });
    return siapSetor;
  }

  async function daftarSetor(dari, sampai) {
    try {
      await pastikanTabelSetor();
      const baris = await kueriAleta(
        `SELECT DATE_FORMAT(tanggal_transaksi, '%Y-%m-%d') AS tanggal, jumlah, ntpn, keterangan, operator,
                DATE_FORMAT(${sqlSetempat("dicatat")}, '%Y-%m-%d %H:%i:%s') AS dicatat
           FROM ${TABEL_SETOR} WHERE tanggal_transaksi BETWEEN ? AND ? ORDER BY tanggal_transaksi`,
        [dari, sampai]
      );
      return {
        ok: true,
        baris: (Array.isArray(baris) ? baris : []).map((b) => ({
          tanggal: tanggalSah(b.tanggal),
          jumlah: angka(b.jumlah),
          ntpn: bersih(b.ntpn),
          keterangan: bersih(b.keterangan),
          operator: bersih(b.operator),
          dicatat: bersih(b.dicatat),
        })),
      };
    } catch (galat) {
      return { ok: false, baris: [], alasan: String((galat && galat.message) || galat).slice(0, 200) };
    }
  }

  /**
   * Menandai hari-hari ber-PNBP sudah disetor. Jumlahnya DIBACA dari SIPP
   * (PNBP hari itu), bukan diketik - yang dicatat petugas hanya NTPN dan
   * keterangannya. Tanggal yang sudah tercatat diperbarui (NTPN susulan).
   */
  async function catatSetor(minta = {}) {
    const operator = bersih(minta.operator).slice(0, 120);
    if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };
    const tanggal = [...new Set((Array.isArray(minta.tanggal) ? minta.tanggal : [minta.tanggal]).map(tanggalSah).filter(Boolean))].slice(0, 62);
    if (!tanggal.length) return { ok: false, alasan: "Tanggal setoran tidak dikenali." };
    const hariIni = await hariIniBasisData();
    if (tanggal.some((t) => t > hariIni)) return { ok: false, alasan: "Tanggal setoran tidak boleh melebihi hari ini." };
    const pnbp = await semua(
      `SELECT DATE_FORMAT(tanggal_transaksi, '%Y-%m-%d') AS tanggal, SUM(jumlah) AS jumlah
         FROM perkara_biaya WHERE kategori_id = ? AND jenis_transaksi = -1 AND tanggal_transaksi IN (${tanggal.map(() => "?").join(",")})
        GROUP BY tanggal_transaksi`,
      [KATEGORI_PNBP, ...tanggal]
    );
    const peta = new Map(pnbp.map((b) => [tanggalSah(b.tanggal), angka(b.jumlah)]));
    await pastikanTabelSetor();
    const ntpn = bersih(minta.ntpn).slice(0, 60);
    const keterangan = bersih(minta.keterangan).slice(0, 200);
    const tercatat = [];
    for (const t of tanggal) {
      await kueriAleta(
        `INSERT INTO ${TABEL_SETOR} (tanggal_transaksi, jumlah, ntpn, keterangan, operator, akun_sipp, ip, dicatat)
         VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE jumlah = VALUES(jumlah), ntpn = IF(VALUES(ntpn) = '', ntpn, VALUES(ntpn)),
           keterangan = IF(VALUES(keterangan) = '', keterangan, VALUES(keterangan)), operator = VALUES(operator),
           akun_sipp = VALUES(akun_sipp), ip = VALUES(ip), dicatat = UTC_TIMESTAMP()`,
        [t, peta.get(t) || 0, ntpn, keterangan, operator, bersih(minta.akunSipp).slice(0, 60), bersih(minta.ip).slice(0, 45)]
      );
      tercatat.push({ tanggal: t, jumlah: peta.get(t) || 0 });
    }
    return { ok: true, tercatat };
  }

  // ─── Rekap ────────────────────────────────────────────────────────────────

  async function rekap(minta = {}) {
    const dari = tanggalSah(minta.dari);
    const sampai = tanggalSah(minta.sampai);
    if (!dari || !sampai || sampai < dari) return { ok: false, alasan: "Rentang tanggal rekap tidak sah." };
    if (selisihHari(dari, sampai) > MAKS_RENTANG_HARI) return { ok: false, alasan: "Rentang rekap paling panjang satu tahun." };
    const [perJenis, perPerkara, perHari, setor] = await Promise.all([
      semua(
        `SELECT pb.jenis_biaya_id AS jenisBiayaId, MAX(jb.nama) AS nama, MAX(kb.nama) AS kategori, MAX(pb.kategori_id) AS kategoriId,
                pb.jenis_transaksi AS jenisTransaksi, COUNT(*) AS baris, SUM(pb.jumlah) AS jumlah, COUNT(DISTINCT pb.perkara_id) AS perkara
           FROM perkara_biaya pb
           LEFT JOIN jenis_biaya jb ON jb.id = pb.jenis_biaya_id
           LEFT JOIN kategori_biaya kb ON kb.id = pb.kategori_id
          WHERE pb.tanggal_transaksi BETWEEN ? AND ?
          GROUP BY pb.jenis_biaya_id, pb.jenis_transaksi`,
        [dari, sampai]
      ),
      semua(
        `SELECT pb.perkara_id AS perkaraId, MAX(p.nomor_perkara) AS nomorPerkara, MAX(p.jenis_perkara_nama) AS jenisPerkara,
                SUM(CASE WHEN pb.jenis_transaksi < 0 THEN pb.jumlah ELSE 0 END) AS keluar,
                SUM(CASE WHEN pb.jenis_transaksi > 0 THEN pb.jumlah ELSE 0 END) AS masuk,
                SUM(CASE WHEN pb.jenis_transaksi < 0 THEN 1 ELSE 0 END) AS barisKeluar,
                SUM(CASE WHEN pb.jenis_biaya_id = 151 THEN pb.jumlah ELSE 0 END) AS sisaDikembalikan
           FROM perkara_biaya pb JOIN perkara p ON p.perkara_id = pb.perkara_id
          WHERE pb.tanggal_transaksi BETWEEN ? AND ?
          GROUP BY pb.perkara_id ORDER BY pb.perkara_id ASC LIMIT 3001`,
        [dari, sampai]
      ),
      semua(
        `SELECT DATE_FORMAT(pb.tanggal_transaksi, '%Y-%m-%d') AS tanggal,
                SUM(CASE WHEN pb.jenis_transaksi < 0 THEN pb.jumlah ELSE 0 END) AS keluar,
                SUM(CASE WHEN pb.jenis_transaksi > 0 THEN pb.jumlah ELSE 0 END) AS masuk,
                SUM(CASE WHEN pb.jenis_transaksi < 0 AND pb.kategori_id = ? THEN pb.jumlah ELSE 0 END) AS pnbp,
                COUNT(*) AS baris
           FROM perkara_biaya pb WHERE pb.tanggal_transaksi BETWEEN ? AND ?
          GROUP BY pb.tanggal_transaksi ORDER BY pb.tanggal_transaksi`,
        [KATEGORI_PNBP, dari, sampai]
      ),
      daftarSetor(dari, sampai),
    ]);
    return {
      ok: true,
      dari,
      sampai,
      perJenis: perJenis.map((b) => ({
        jenisBiayaId: Number(b.jenisBiayaId) || 0,
        nama: bersih(b.nama) || `Jenis biaya #${b.jenisBiayaId}`,
        kategori: bersih(b.kategori),
        kategoriId: Number(b.kategoriId) || 0,
        jenisTransaksi: Number(b.jenisTransaksi) || 0,
        baris: Number(b.baris) || 0,
        jumlah: angka(b.jumlah),
        perkara: Number(b.perkara) || 0,
      })),
      perPerkara: perPerkara.slice(0, 3000).map((b) => ({
        perkaraId: Number(b.perkaraId) || 0,
        nomorPerkara: bersih(b.nomorPerkara),
        jenisPerkara: bersih(b.jenisPerkara),
        keluar: angka(b.keluar),
        masuk: angka(b.masuk),
        barisKeluar: Number(b.barisKeluar) || 0,
        sisaDikembalikan: angka(b.sisaDikembalikan),
      })),
      perkaraTerpotong: perPerkara.length > 3000,
      perHari: perHari.map((b) => ({
        tanggal: tanggalSah(b.tanggal),
        keluar: angka(b.keluar),
        masuk: angka(b.masuk),
        pnbp: angka(b.pnbp),
        baris: Number(b.baris) || 0,
      })),
      setorPnbp: setor.baris,
      setorTerbaca: setor.ok,
    };
  }

  // ─── Pengingat ────────────────────────────────────────────────────────────

  async function pengingat(minta = {}) {
    const hariIni = tanggalSah(minta.hariIni) || (await hariIniBasisData());
    const dariPutus = geserHari(hariIni, -HARI_PENGINGAT_PUTUSAN);
    const dariPnbp = geserHari(hariIni, -HARI_PENGINGAT_PNBP);
    const [putus, pnbp, setor] = await Promise.all([
      semua(
        `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, p.jenis_perkara_id AS jenisPerkaraId,
                p.jenis_perkara_nama AS jenisPerkara, pu.status_putusan_id AS statusId,
                DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tanggalPutusan,
                DATE_FORMAT(it.tgl_ikrar_talak, '%Y-%m-%d') AS tanggalIkrar,
                b.saldo, b.adaSisa, b.adaPutusan, b.prodeo, b.adaPanjar
           FROM perkara_putusan pu
           JOIN perkara p ON p.perkara_id = pu.perkara_id
           LEFT JOIN perkara_ikrar_talak it ON it.perkara_id = pu.perkara_id
           JOIN (
             SELECT x.perkara_id,
                    SUM(x.jenis_transaksi * x.jumlah) AS saldo,
                    SUM(x.jenis_biaya_id = 151) AS adaSisa,
                    SUM(x.jenis_biaya_id IN (152, 157) AND x.tanggal_transaksi >= px.tanggal_putusan) AS adaPutusan,
                    SUM(x.id_pembiayaan <> 1) AS prodeo,
                    SUM(x.jenis_transaksi > 0) AS adaPanjar
               FROM perkara_biaya x JOIN perkara_putusan px ON px.perkara_id = x.perkara_id
              WHERE x.tahapan_id = ? AND px.tanggal_putusan BETWEEN ? AND ?
              GROUP BY x.perkara_id
           ) b ON b.perkara_id = pu.perkara_id
          WHERE pu.tanggal_putusan BETWEEN ? AND ?
          ORDER BY pu.tanggal_putusan ASC, p.perkara_id ASC`,
        [TAHAPAN, dariPutus, hariIni, dariPutus, hariIni]
      ),
      semua(
        `SELECT DATE_FORMAT(tanggal_transaksi, '%Y-%m-%d') AS tanggal, SUM(jumlah) AS jumlah, COUNT(*) AS baris
           FROM perkara_biaya WHERE kategori_id = ? AND jenis_transaksi = -1 AND tanggal_transaksi BETWEEN ? AND ?
          GROUP BY tanggal_transaksi ORDER BY tanggal_transaksi`,
        [KATEGORI_PNBP, dariPnbp, hariIni]
      ),
      daftarSetor(dariPnbp, hariIni),
    ]);
    return susunPengingat({ hariIni, putus, pnbp, setor });
  }

  return { rekap, pengingat, catatSetor, daftarSetor, pastikanTabelSetor };
}

/**
 * Fungsi MURNI - baris mentah menjadi pengingat. Dipisah supaya uji dapat
 * memberinya baris tiruan tanpa basis data.
 */
function susunPengingat({ hariIni, putus, pnbp, setor }) {
  const butir = [];
  for (const b of Array.isArray(putus) ? putus : []) {
    if (Number(b.prodeo) > 0 || !(Number(b.adaPanjar) > 0)) continue;
    const perkara = { perkaraId: Number(b.perkaraId) || 0, nomorPerkara: bersih(b.nomorPerkara), jenisPerkara: bersih(b.jenisPerkara) };
    const tPut = tanggalSah(b.tanggalPutusan);
    const tIkrar = tanggalSah(b.tanggalIkrar);
    const saldo = angka(b.saldo);
    const menungguIkrar = Number(b.jenisPerkaraId) === JENIS_CERAI_TALAK && Number(b.statusId) === STATUS_DIKABULKAN && !tIkrar;
    if (!(Number(b.adaPutusan) > 0)) {
      butir.push({
        jenis: "belum-dijurnal",
        ...perkara,
        tenggat: tPut,
        jumlah: null,
        keterangan: `Putus ${tPut}: Redaksi dan Meterai hari putusan belum ada di jurnal.`,
      });
    }
    if (!(Number(b.adaSisa) > 0) && saldo > AMBANG_SISA && !menungguIkrar) {
      const tenggat = Number(b.jenisPerkaraId) === JENIS_CERAI_TALAK && tIkrar ? tIkrar : tPut;
      butir.push({
        jenis: "sisa-panjar",
        ...perkara,
        tenggat,
        jumlah: saldo,
        keterangan: `Saldo panjar Rp${Math.round(saldo).toLocaleString("id-ID")} belum dikembalikan (${tenggat === tIkrar ? "ikrar" : "putus"} ${tenggat}).`,
      });
    }
    if (saldo < 0) {
      butir.push({
        jenis: "panjar-kurang",
        ...perkara,
        tenggat: tPut,
        jumlah: saldo,
        keterangan: `Saldo jurnal minus Rp${Math.round(Math.abs(saldo)).toLocaleString("id-ID")} - perlu Tambahan Panjar Biaya Perkara.`,
      });
    }
  }
  const sudahSetor = new Set(((setor && setor.baris) || []).map((x) => x.tanggal));
  for (const p of Array.isArray(pnbp) ? pnbp : []) {
    const t = tanggalSah(p.tanggal);
    if (!t || sudahSetor.has(t) || !(angka(p.jumlah) > 0)) continue;
    butir.push({
      jenis: "pnbp-belum-setor",
      perkaraId: 0,
      nomorPerkara: "",
      jenisPerkara: "",
      tanggal: t,
      tenggat: hariKerjaBerikut(t),
      jumlah: angka(p.jumlah),
      keterangan: `PNBP ${t}: Rp${Math.round(angka(p.jumlah)).toLocaleString("id-ID")} dari ${Number(p.baris) || 0} baris jurnal - setorannya belum dicatat.`,
    });
  }
  butir.sort((a, b) => a.tenggat.localeCompare(b.tenggat) || a.jenis.localeCompare(b.jenis) || a.perkaraId - b.perkaraId);
  const hitung = (j) => butir.filter((x) => x.jenis === j).length;
  return {
    ok: true,
    hariIni,
    butir,
    ringkas: {
      sisaPanjar: hitung("sisa-panjar"),
      belumDijurnal: hitung("belum-dijurnal"),
      panjarKurang: hitung("panjar-kurang"),
      pnbpBelumSetor: hitung("pnbp-belum-setor"),
      lewat: butir.filter((x) => x.tenggat < hariIni).length,
    },
    setorTerbaca: !setor || setor.ok !== false,
  };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  TABEL_SETOR,
  KATEGORI_PNBP,
  buatLayanan,
  susunPengingat,
  hariKerjaBerikut,
  rekap: (minta) => layananBawaan().rekap(minta),
  pengingat: (minta) => layananBawaan().pengingat(minta),
  catatSetor: (minta) => layananBawaan().catatSetor(minta),
};
