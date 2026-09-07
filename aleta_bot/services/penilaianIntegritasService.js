"use strict";

/**
 * ============================================================================
 * INTEGRITAS DATA - DUA POLA YANG BERULANG
 * ============================================================================
 *
 * Bab 2 katalog memuat empat belas butir, dan sebagian besar berbentuk salah
 * satu dari dua pertanyaan:
 *
 *   1. KELENGKAPAN - "apakah ruas ini benar-benar terisi?"
 *   2. URUTAN      - "apakah tanggal-tanggal ini berurutan sebagaimana
 *                     seharusnya peristiwanya terjadi?"
 *
 * Keduanya sederhana, dan justru karena itu sering dianggap tidak perlu
 * dinilai. Padahal seluruh penilaian lain berdiri di atasnya: tenggang tidak
 * dapat dihitung dari tanggal yang kosong, dan angka yang dihitung dari
 * tanggal yang urutannya terbalik hanya tampak seperti angka.
 *
 * ============================================================================
 * TERISI BUKAN SEKADAR BUKAN-NULL
 * ============================================================================
 *
 * Ruas berisi spasi, tanda hubung, titik, atau angka nol tunggal dihitung
 * KOSONG. Pengukuran ruas bebas pada SIPP menemukan 6.210 entri alasan
 * penundaan yang isinya hanya "0" - bila itu dihitung terisi, angka
 * kelengkapan akan tampak baik padahal tidak ada isinya sama sekali.
 *
 * ============================================================================
 * URUTAN TERBALIK ADALAH TEMUAN, BUKAN GALAT
 * ============================================================================
 *
 * Putusan yang bertanggal sesudah minutasi, atau berkekuatan hukum tetap
 * sebelum diputus, tidak mungkin terjadi. Bila tercatat begitu, salah
 * satunya salah - dan menemukannya justru guna penilaian ini. Karena itu
 * barisnya tidak dibuang, melainkan ditandai.
 */

const db = require("../db_config");

/** Pembungkus baca, sebentuk dengan layanan penilaian lain. */
function runQuery(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => {
      if (galat) gagal(galat);
      else selesai(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const kerangka = require("./kerangkaPenilaianService");

const BATAS_BARIS = 20000;

function teks(v) {
  return v === null || v === undefined ? "" : String(v);
}

function tanggalIso(v) {
  if (!v) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v).trim());
  return m ? m[1] : null;
}

/**
 * Apakah sebuah ruas benar-benar terisi?
 *
 * Yang ditolak: kosong, hanya spasi, hanya tanda baca pengisi, dan angka nol
 * tunggal. Ketiganya dipakai orang untuk melewati ruas wajib tanpa mengisinya,
 * dan menghitungnya "terisi" membuat angka kelengkapan berbohong.
 */
function terisi(nilai) {
  const s = teks(nilai).trim();
  if (!s) return false;
  if (/^[-.,_/\\\s]+$/.test(s)) return false;
  if (/^0+$/.test(s)) return false;
  return true;
}

/* ==========================================================================
 * POLA 1 - KELENGKAPAN RUAS
 * ========================================================================== */

const KELENGKAPAN = [
  {
    kode: "IN07",
    kunci: "kelengkapanRuasWajibPerkara",
    judul: "Kelengkapan Ruas Wajib Perkara",
    keterangan:
      "Perkara yang telah diputus memiliki amar dan petitum yang terisi pada SIPP. Keduanya menjadi dasar seluruh penilaian mutu putusan.",
    tabel: "perkara",
    ruas: ["amar", "petitum"],
    syaratPutus: true,
  },
  {
    kode: "IN08",
    kunci: "kelengkapanDokumenElektronik",
    judul: "Kelengkapan Dokumen Elektronik",
    keterangan:
      "Putusan yang telah diucapkan memiliki berkas amar putusan dan berkas anonimisasinya terunggah pada SIPP.",
    tabel: "perkara_putusan",
    ruas: ["amar_putusan_dok", "amar_putusan_anonimisasi_dok"],
    syaratPutus: true,
  },
  {
    kode: "IN13",
    kunci: "perkaraTanpaDataSaksi",
    judul: "Perkara Tanpa Data Saksi",
    keterangan:
      "Perkara yang diperiksa dengan pembuktian memiliki sekurangnya satu keterangan saksi yang tercatat.",
    tabel: "perkara_keterangan_saksi",
    hitungAda: true,
    syaratPutus: true,
  },
];

function kueriKelengkapan(k) {
  if (k.hitungAda) {
    // Bentuk kedua: yang diperiksa keberadaan baris pada tabel lain, bukan
    // isi ruas pada tabel perkara.
    return `SELECT p.perkara_id AS perkaraId,
                   p.nomor_perkara AS nomorPerkara,
                   p.jenis_perkara_nama AS jenisPerkara,
                   (SELECT COUNT(*) FROM ${k.tabel} s WHERE s.perkara_id = p.perkara_id) AS jumlahAda
              FROM perkara p
             WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
             ORDER BY p.tanggal_pendaftaran ASC
             LIMIT ${BATAS_BARIS}`;
  }

  const ambilRuas = k.ruas
    .map((r) =>
      k.tabel === "perkara"
        ? `p.${r} AS ${r}`
        : `(SELECT MAX(x.${r}) FROM ${k.tabel} x WHERE x.perkara_id = p.perkara_id) AS ${r}`
    )
    .join(",\n                   ");

  return `SELECT p.perkara_id AS perkaraId,
                   p.nomor_perkara AS nomorPerkara,
                   p.jenis_perkara_nama AS jenisPerkara,
                   ${ambilRuas}
              FROM perkara p
             WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
             ORDER BY p.tanggal_pendaftaran ASC
             LIMIT ${BATAS_BARIS}`;
}

function barisKelengkapan(k) {
  return async function baris(rentang) {
    const hasil = await runQuery(kueriKelengkapan(k), [rentang.mulai, rentang.selesai]);

    return hasil.map((r) => {
      if (k.hitungAda) {
        const jumlah = Number(r.jumlahAda) || 0;
        return {
          kunci: `${teks(r.nomorPerkara)}#${k.kode}`,
          nomorPerkara: teks(r.nomorPerkara),
          jenisPerkara: teks(r.jenisPerkara),
          jumlahTercatat: jumlah,
          memenuhi: jumlah > 0,
          sebabTidakMemenuhi: jumlah > 0 ? "" : "tidak ada satu pun baris tercatat",
        };
      }

      const kosong = k.ruas.filter((nama) => !terisi(r[nama]));
      return {
        kunci: `${teks(r.nomorPerkara)}#${k.kode}`,
        nomorPerkara: teks(r.nomorPerkara),
        jenisPerkara: teks(r.jenisPerkara),
        ruasKosong: kosong.join(", "),
        jumlahRuasKosong: kosong.length,
        memenuhi: kosong.length === 0,
        sebabTidakMemenuhi: kosong.length === 0 ? "" : `ruas kosong: ${kosong.join(", ")}`,
      };
    });
  };
}

/* ==========================================================================
 * POLA 2 - URUTAN TANGGAL
 * ========================================================================== */

const URUTAN = [
  {
    kode: "IN09",
    kunci: "kewajaranUrutanTanggalPutusan",
    judul: "Kewajaran Tanggal Putus, Minutasi, dan BHT",
    keterangan:
      "Tanggal putusan mendahului minutasi, dan minutasi mendahului berkekuatan hukum tetap. Urutan yang terbalik tidak mungkin terjadi, sehingga salah satunya pasti keliru.",
    tabel: "perkara_putusan",
    tahap: [
      { nama: "putusan", ruas: "tanggal_putusan" },
      { nama: "minutasi", ruas: "tanggal_minutasi" },
      { nama: "berkekuatan hukum tetap", ruas: "tanggal_bht" },
    ],
  },
];

function kueriUrutan(u) {
  const ambil = u.tahap
    .map(
      (t) =>
        `(SELECT MIN(x.${t.ruas}) FROM ${u.tabel} x WHERE x.perkara_id = p.perkara_id) AS ${t.ruas}`
    )
    .join(",\n                   ");

  return `SELECT p.perkara_id AS perkaraId,
                   p.nomor_perkara AS nomorPerkara,
                   p.jenis_perkara_nama AS jenisPerkara,
                   ${ambil}
              FROM perkara p
             WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
             ORDER BY p.tanggal_pendaftaran ASC
             LIMIT ${BATAS_BARIS}`;
}

function barisUrutan(u) {
  return async function baris(rentang) {
    const hasil = await runQuery(kueriUrutan(u), [rentang.mulai, rentang.selesai]);

    return hasil
      .map((r) => {
        const isi = u.tahap.map((t) => ({ nama: t.nama, tanggal: tanggalIso(r[t.ruas]) }));
        const ada = isi.filter((x) => x.tanggal);

        // Perkara yang belum punya dua tanggal tidak dapat dinilai urutannya -
        // ia belum sampai ke sana. Dikeluarkan dari penyebut, bukan dihitung
        // gagal; menilai urutan dari satu tanggal tidak bermakna.
        if (ada.length < 2) return null;

        const terbalik = [];
        for (let i = 1; i < ada.length; i += 1) {
          if (ada[i].tanggal < ada[i - 1].tanggal) {
            terbalik.push(`${ada[i].nama} (${ada[i].tanggal}) mendahului ${ada[i - 1].nama} (${ada[i - 1].tanggal})`);
          }
        }

        const catat = {};
        isi.forEach((x) => {
          catat[x.nama] = x.tanggal;
        });

        return {
          kunci: `${teks(r.nomorPerkara)}#${u.kode}`,
          nomorPerkara: teks(r.nomorPerkara),
          jenisPerkara: teks(r.jenisPerkara),
          ...catat,
          tanggalTerbaca: ada.length,
          memenuhi: terbalik.length === 0,
          sebabTidakMemenuhi: terbalik.join("; "),
        };
      })
      .filter(Boolean);
  };
}

/* ==========================================================================
 * PENDAFTARAN
 * ========================================================================== */

function daftarkanSemua() {
  KELENGKAPAN.forEach((k) => {
    kerangka.daftarkan({
      kunci: k.kunci,
      judul: k.judul,
      keterangan: k.keterangan,
      lantai: "bulanan",
      versiRumus: "kelengkapan-v1",
      caraHitung: {
        pembilang: k.hitungAda
          ? `Perkara yang punya sekurangnya satu baris pada tabel ${k.tabel}`
          : `Perkara yang seluruh ruas ${k.ruas.join(" dan ")} pada ${k.tabel} terisi`,
        penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
        dikecualikan:
          "Tidak ada yang dikecualikan. Ruas berisi spasi, tanda hubung, titik, atau angka nol tunggal dihitung KOSONG - ketiganya dipakai melewati ruas wajib tanpa mengisinya",
        tabelSumber:
          k.tabel === "perkara"
            ? "perkara (induk perkara, tempat ruas wajibnya tersimpan)"
            : `perkara sebagai induk, ${k.tabel} sebagai tempat ruas yang diperiksa`,
        ruasSumber: k.hitungAda
          ? `perkara_id pada ${k.tabel}, dihitung keberadaan barisnya`
          : `${k.ruas.join(", ")} - masing-masing diperiksa terisi atau tidak`,
      },
      baris: barisKelengkapan(k),
    });
  });

  URUTAN.forEach((u) => {
    kerangka.daftarkan({
      kunci: u.kunci,
      judul: u.judul,
      keterangan: u.keterangan,
      lantai: "bulanan",
      versiRumus: "urutan-v1",
      caraHitung: {
        pembilang: `Perkara yang tanggal ${u.tahap.map((t) => t.nama).join(", ")} berurutan sebagaimana peristiwanya`,
        penyebut: "Perkara yang sekurangnya dua di antara tanggal itu sudah terisi",
        dikecualikan:
          "Perkara yang baru punya satu tanggal atau tidak sama sekali - urutannya belum dapat dinilai, dan menilainya dari satu tanggal tidak bermakna",
        tabelSumber: `perkara, ${u.tabel}`,
        ruasSumber: u.tahap.map((t) => t.ruas).join(", "),
      },
      baris: barisUrutan(u),
    });
  });
}

/** Seluruh nama tabel dan ruas SIPP yang disebut berkas ini. */
function namaSippDipakai() {
  const tabel = new Set(["perkara"]);
  const ruas = new Set(["perkara_id", "nomor_perkara", "jenis_perkara_nama", "tanggal_pendaftaran"]);
  KELENGKAPAN.forEach((k) => {
    tabel.add(k.tabel);
    (k.ruas || []).forEach((r) => ruas.add(r));
  });
  URUTAN.forEach((u) => {
    tabel.add(u.tabel);
    u.tahap.forEach((t) => ruas.add(t.ruas));
  });
  return { tabel: [...tabel].sort(), ruas: [...ruas].sort() };
}

/** Kueri yang benar-benar tersusun, untuk diperiksa penjaga. */
function seluruhKueri() {
  return [
    ...KELENGKAPAN.map((k) => ({ kode: k.kode, sql: kueriKelengkapan(k) })),
    ...URUTAN.map((u) => ({ kode: u.kode, sql: kueriUrutan(u) })),
  ];
}

module.exports = { KELENGKAPAN, URUTAN, terisi, daftarkanSemua, namaSippDipakai, seluruhKueri };
