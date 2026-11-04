"use strict";

/**
 * ============================================================================
 * KASIR: DAFTAR PENGEMBALIAN SISA PANJAR (PSP) DAN INSTRUMEN JURUSITA (3 Nov 2026)
 * ============================================================================
 *
 * Permintaan Derry (3 Nov 20.40):
 *   1. kasir dapat mencetak nomor rekening penerima PSP dalam sehari (atau tanggal/rentang pilihan);
 *   2. instrumen biaya panggilan dan PBT otomatis per jurusita, dicetak terpisah.
 *
 * Sumbernya jurnal keuangan SIPP (perkara_biaya) - HANYA SELECT:
 *   - PSP: jenis_biaya 151 "Pengembalian Sisa Panjar" (atau uraian yang menyebutnya) tahap pertama;
 *     rekening penerima dari pembayaran e-Court yang dibaca jembatan (aleta_bot_ecourt_pembayaran).
 *   - instrumen: biaya berkategori jurusita (4, 5, 6 - panggilan, pemberitahuan, panggilan mediasi/ikrar),
 *     jurusita dari perkara_biaya_jurusita (yang dipilih kasir pada baris itu), cadangannya jurusita aktif
 *     perkara (perkara_jurusita). Urutan panggilan ke-n dihitung dari jurnal perkara itu sendiri.
 *
 * Penyamaran/hak lihat rekening dikerjakan portal (lib/pembayaran-ecourt.ts, keputusan 171).
 */

const TAHAPAN = 10;
const JB_SISA = 151;
const JB_PEMBERITAHUAN = 29;
const JB_PANGGIL_MEDIASI = 381;
const KATEGORI_JURUSITA = [4, 5, 6];
const MAKS_RENTANG_HARI = 62;
const BATAS_BARIS = 1500;

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

function selisihHari(dari, sampai) {
  return Math.round((Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86400000);
}

/** Rentang sah: sampai >= dari, paling panjang MAKS_RENTANG_HARI. */
function rentangSah(dari, sampai, hariIni) {
  const d = tanggalSah(dari) || tanggalSah(hariIni);
  const s = tanggalSah(sampai) || d;
  if (!d) return { ok: false, alasan: "Tanggal tidak sah." };
  if (s < d) return { ok: false, alasan: "Tanggal akhir mendahului tanggal awal." };
  if (selisihHari(d, s) > MAKS_RENTANG_HARI) return { ok: false, alasan: `Rentang paling panjang ${MAKS_RENTANG_HARI} hari.` };
  return { ok: true, dari: d, sampai: s };
}

/** Jenis baris instrumen dalam bahasa kasir. */
function jenisInstrumen(b) {
  const uraian = bersih(b.uraian);
  if (Number(b.jenisBiayaId) === JB_PEMBERITAHUAN || /pemberitahuan/i.test(uraian)) return "PBT (pemberitahuan isi putusan)";
  if (Number(b.jenisBiayaId) === JB_PANGGIL_MEDIASI || /mediasi/i.test(uraian)) return `Panggilan mediasi ke-${angka(b.ke) || 1}`;
  if (/ikrar/i.test(uraian)) return `Panggilan ikrar talak ke-${angka(b.ke) || 1}`;
  return `Panggilan sidang ke-${angka(b.ke) || 1}`;
}

/** Alamat singkat: satu baris, paling banyak 90 huruf. */
/** "Tergugat", "Pemohon II" - urutan disebut hanya bila sekedudukannya lebih dari satu. */
function statusPihak(b, pihak) {
  const { sebutanPerkara, sebutKe, akhiranUrut } = require("./kasirJurnalService");
  const sebutan = sebutanPerkara({
    alurPerkaraId: b.alurPerkaraId,
    jenisPerkaraId: b.jenisPerkaraId,
    jenisPerkaraNama: b.jenisPerkaraNama,
    nomorPerkara: b.nomorPerkara,
  });
  const milik = pihak.find((x) => x.pihakId === Number(b.pihakId));
  if (!milik) return Number(b.pihakKe) > 0 ? sebutKe(Number(b.pihakKe), sebutan) : "";
  const sederet = pihak.filter((x) => x.ke === milik.ke);
  return `${sebutKe(milik.ke, sebutan)}${akhiranUrut(sederet.indexOf(milik), sederet.length)}`;
}

function alamatSingkat(teks) {
  const t = bersih(teks).replace(/\s+/g, " ");
  return t.length > 90 ? `${t.slice(0, 87).trimEnd()}...` : t;
}

function buatLayanan(deps = {}) {
  const kueri =
    deps.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const bacaPembayaran = deps.bacaPembayaran || ((nomor) => require("./ecourtStoreService").bacaPembayaranEcourt(nomor));
  const hariIni = deps.hariIni || (() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date()));

  async function semua(sql, params) {
    const baris = await kueri(sql, params);
    return Array.isArray(baris) ? baris : [];
  }

  /** Pihak tiap perkara per kedudukan, urut sesuai SIPP. Gagal baca = kosong; statusnya dari pihak_ke baris jurnal. */
  async function bacaKedudukan(idPerkara) {
    if (!idPerkara.length) return {};
    const tanda = idPerkara.map(() => "?").join(",");
    const bagian = [1, 2, 3, 4].map(
      (ke) => `SELECT perkara_id AS perkaraId, ${ke} AS ke, urutan, id, pihak_id AS pihakId FROM perkara_pihak${ke} WHERE perkara_id IN (${tanda})`
    );
    const baris = await semua(
      `${bagian.join(" UNION ALL ")} ORDER BY perkaraId ASC, ke ASC, urutan ASC, id ASC`,
      [...idPerkara, ...idPerkara, ...idPerkara, ...idPerkara]
    ).catch(() => []);
    const peta = {};
    for (const b of baris) (peta[Number(b.perkaraId)] = peta[Number(b.perkaraId)] || []).push({ ke: Number(b.ke), pihakId: Number(b.pihakId) });
    return peta;
  }

  /**
   * PSP pada rentang tanggal. Tiap baris: perkara, tanggal, jumlah, penerima (pihak pada baris jurnal),
   * kuasa pihak pertama (bila ada), dan rekening e-Court (bila perkara itu membayar lewat e-Court).
   */
  async function daftarPsp({ dari, sampai } = {}) {
    const r = rentangSah(dari, sampai, hariIni());
    if (!r.ok) return r;
    const baris = await semua(
      `SELECT pb.id, pb.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
              DATE_FORMAT(pb.tanggal_transaksi, '%Y-%m-%d') AS tanggal, pb.jumlah, pb.uraian,
              pb.pihak_id AS pihakId, ph.nama AS namaPihak
         FROM perkara_biaya pb
         JOIN perkara p ON p.perkara_id = pb.perkara_id
         LEFT JOIN pihak ph ON ph.id = pb.pihak_id
        WHERE pb.tahapan_id = ? AND pb.jenis_transaksi = -1
          AND (pb.jenis_biaya_id = ? OR pb.uraian LIKE '%Sisa Panjar%')
          AND pb.tanggal_transaksi BETWEEN ? AND ?
        ORDER BY pb.tanggal_transaksi ASC, pb.perkara_id ASC, pb.id ASC
        LIMIT ${BATAS_BARIS}`,
      [TAHAPAN, JB_SISA, r.dari, r.sampai]
    );
    const nomor = [...new Set(baris.map((b) => bersih(b.nomorPerkara)).filter(Boolean))];
    let bayar = {};
    try {
      bayar = nomor.length ? (await bacaPembayaran(nomor)) || {} : {};
    } catch {
      bayar = {};
    }
    const kuasa = {};
    const id = [...new Set(baris.map((b) => Number(b.perkaraId)).filter((x) => x > 0))];
    if (id.length) {
      const k = await semua(
        `SELECT perkara_id AS perkaraId, nama FROM perkara_pengacara WHERE perkara_id IN (${id.map(() => "?").join(",")}) AND pihak_ke = 1 ORDER BY id ASC`,
        id
      ).catch(() => []);
      for (const x of k) if (!kuasa[Number(x.perkaraId)]) kuasa[Number(x.perkaraId)] = bersih(x.nama);
    }
    const daftar = baris.map((b) => {
      const n = bersih(b.nomorPerkara);
      const e = bayar[n] || null;
      return {
        jurnalId: Number(b.id),
        perkaraId: Number(b.perkaraId),
        nomorPerkara: n,
        tanggal: tanggalSah(b.tanggal),
        jumlah: angka(b.jumlah),
        penerima: bersih(b.namaPihak),
        kuasa: kuasa[Number(b.perkaraId)] || "",
        ecourt: Boolean(e),
        rekening: e && (e.nomorRekening || e.bank) ? { diterimaDari: e.diterimaDari || "", bank: e.bank || "", nomorRekening: e.nomorRekening || "", atasNama: e.atasNama || "" } : null,
      };
    });
    return { ok: true, dari: r.dari, sampai: r.sampai, jumlah: daftar.length, total: daftar.reduce((s, x) => s + x.jumlah, 0), daftar, terpotong: baris.length >= BATAS_BARIS };
  }

  /** Baris biaya jurusita pada rentang tanggal, dengan jurusitanya - dikelompokkan portal per jurusita. */
  async function instrumen({ dari, sampai } = {}) {
    const r = rentangSah(dari, sampai, hariIni());
    if (!r.ok) return r;
    const baris = await semua(
      `SELECT pb.id, pb.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
              p.alur_perkara_id AS alurPerkaraId, p.jenis_perkara_id AS jenisPerkaraId, p.jenis_perkara_nama AS jenisPerkaraNama,
              DATE_FORMAT(pb.tanggal_transaksi, '%Y-%m-%d') AS tanggal, pb.jenis_biaya_id AS jenisBiayaId,
              pb.uraian, pb.jumlah, pb.pihak_id AS pihakId, pb.pihak_ke AS pihakKe, ph.nama AS namaPihak, ph.alamat,
              c.jurusita_id AS jurusitaId, j.nama_gelar AS jurusitaNama,
              (SELECT COUNT(*) FROM perkara_biaya x
                WHERE x.perkara_id = pb.perkara_id AND x.tahapan_id = pb.tahapan_id AND x.jenis_biaya_id = pb.jenis_biaya_id
                  AND (x.pihak_id <=> pb.pihak_id)
                  AND (x.tanggal_transaksi < pb.tanggal_transaksi OR (x.tanggal_transaksi = pb.tanggal_transaksi AND x.id <= pb.id))) AS ke
         FROM perkara_biaya pb
         JOIN perkara p ON p.perkara_id = pb.perkara_id
         LEFT JOIN pihak ph ON ph.id = pb.pihak_id
         LEFT JOIN perkara_biaya_jurusita c ON c.perkara_biaya_id = pb.id
         LEFT JOIN jurusita j ON j.id = c.jurusita_id
        WHERE pb.tahapan_id = ? AND pb.jenis_transaksi = -1 AND pb.kategori_id IN (${KATEGORI_JURUSITA.join(",")})
          AND pb.tanggal_transaksi BETWEEN ? AND ?
        ORDER BY pb.tanggal_transaksi ASC, pb.perkara_id ASC, pb.id ASC
        LIMIT ${BATAS_BARIS}`,
      [TAHAPAN, r.dari, r.sampai]
    );
    // Cadangan: baris tanpa jurusita tercatat -> jurusita aktif perkara.
    const tanpa = [...new Set(baris.filter((b) => !(Number(b.jurusitaId) > 0)).map((b) => Number(b.perkaraId)))];
    const aktif = {};
    if (tanpa.length) {
      const js = await semua(
        `SELECT perkara_id AS perkaraId, jurusita_id AS jurusitaId, jurusita_nama AS nama FROM perkara_jurusita
          WHERE perkara_id IN (${tanpa.map(() => "?").join(",")}) AND aktif = 'Y' ORDER BY id ASC`,
        tanpa
      ).catch(() => []);
      for (const x of js) if (!aktif[Number(x.perkaraId)]) aktif[Number(x.perkaraId)] = { jurusitaId: Number(x.jurusitaId) || 0, nama: bersih(x.nama) };
    }
    // 4 Nov 2026: status pihak di bawah nomor perkara (Tergugat, Pemohon II) - kedudukan dari tabel pihak perkara.
    const idPerkara = [...new Set(baris.map((b) => Number(b.perkaraId)))];
    const petaPihak = await bacaKedudukan(idPerkara);
    const daftar = baris.map((b) => {
      const cad = aktif[Number(b.perkaraId)] || { jurusitaId: 0, nama: "" };
      const ada = Number(b.jurusitaId) > 0;
      return {
        jurnalId: Number(b.id),
        perkaraId: Number(b.perkaraId),
        nomorPerkara: bersih(b.nomorPerkara),
        tanggal: tanggalSah(b.tanggal),
        jenisBiayaId: Number(b.jenisBiayaId) || 0,
        uraian: bersih(b.uraian),
        jenis: jenisInstrumen(b),
        jumlah: angka(b.jumlah),
        pihak: bersih(b.namaPihak),
        statusPihak: statusPihak(b, petaPihak[Number(b.perkaraId)] || []),
        alamat: alamatSingkat(b.alamat),
        jurusitaId: ada ? Number(b.jurusitaId) : cad.jurusitaId,
        jurusita: ada ? bersih(b.jurusitaNama) : cad.nama,
        jurusitaDariPerkara: !ada,
      };
    });
    return { ok: true, dari: r.dari, sampai: r.sampai, jumlah: daftar.length, daftar, terpotong: baris.length >= BATAS_BARIS };
  }

  return { daftarPsp, instrumen };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  buatLayanan,
  jenisInstrumen,
  alamatSingkat,
  statusPihak,
  rentangSah,
  daftarPsp: (minta) => layananBawaan().daftarPsp(minta),
  instrumen: (minta) => layananBawaan().instrumen(minta),
};
