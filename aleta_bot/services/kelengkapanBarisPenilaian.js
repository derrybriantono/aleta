"use strict";

/**
 * ============================================================================
 * SATU BENTUK PENILAIAN YANG DIPAKAI BANYAK BUTIR
 * ============================================================================
 *
 * Register kepaniteraan (Bab 5) dan laporan perkara (Bab 4) menanyakan hal
 * yang persis sama, hanya atas populasi yang berbeda:
 *
 *   "Dari baris yang seharusnya tercatat pada rentang ini, berapa yang
 *    kolom-kolom pentingnya benar-benar terisi?"
 *
 * Menuliskannya dua kali berarti dua tempat yang harus diperbaiki ketika
 * bentuk "belum diisi" milik SIPP bertambah satu lagi - dan pada perbaikan
 * pertama seseorang akan lupa yang kedua. Itu persis kekeliruan yang sudah
 * dua kali ditemukan pada berkas lain di aplikasi ini.
 *
 * ============================================================================
 * YANG TABELNYA TIDAK ADA TIDAK DINILAI NOL
 * ============================================================================
 *
 * Penyitaan dan konsinyasi tidak punya tabelnya sendiri pada SIPP satker ini.
 * Menilainya nol berarti menuduh pengadilan tidak mencatat sesuatu yang memang
 * tidak punya tempat penyimpanan - dan angka nol yang tidak dapat diperbaiki
 * dengan cara apa pun akan membuat seluruh papan berhenti dibaca.
 *
 * Yang dipulangkan pada keadaan itu daftar KOSONG. Penilaian tanpa baris tidak
 * punya penyebut, sehingga ia tidak menghasilkan angka sama sekali - berbeda
 * dari menghasilkan angka nol.
 */

const db = require("../db_config");
const sippSkemaService = require("./sippSkemaService");

/** Batas baris bukti sekali baca. */
const BATAS_BARIS = 5000;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const teks = (n) => String(n == null ? "" : n).trim();

/**
 * Apakah satu nilai benar-benar terisi.
 *
 * SIPP menyimpan "belum diisi" dengan beberapa bentuk sekaligus, dan
 * memperlakukan sebagiannya sebagai terisi akan menggelembungkan angka
 * kelengkapan tanpa ada yang menyadarinya:
 *
 *   NULL          tidak pernah disentuh
 *   ""            disentuh lalu dikosongkan
 *   "-"           diisi tanda hubung supaya borangnya mau disimpan
 *   "0000-00-00"  tanggal nol MariaDB - dipulangkan sebagai string, bukan null
 *   "0"           nilai bawaan yang tidak pernah diubah pada kolom angka
 */
function terisi(nilai, anggapNolKosong = false) {
  const t = teks(nilai);
  if (!t) return false;
  if (t === "-") return false;
  if (/^0000-00-00/.test(t)) return false;
  if (anggapNolKosong && /^0(\.0+)?$/.test(t)) return false;
  return true;
}

/**
 * Menyusun kueri satu butir.
 *
 * Dua bentuk, sebab keduanya benar-benar berbeda: butir yang seluruh kolomnya
 * ada pada tabel perkara, dan butir yang kolomnya ada pada tabel tahapan lalu
 * disambung lewat perkara_id.
 */
function susunKueri(b) {
  const kepala = `p.perkara_id AS perkaraId,
                 p.nomor_perkara AS nomorPerkara,
                 p.jenis_perkara_nama AS jenisPerkara`;

  if (b.tabel === "perkara") {
    return `SELECT ${kepala},
                 ${b.wajib.map((k, i) => `p.${k} AS w${i}`).join(",\n                 ")}
            FROM perkara p
           WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
             ${b.saring ? `AND ${b.saring}` : ""}
           ORDER BY p.tanggal_pendaftaran
           LIMIT ${BATAS_BARIS}`;
  }

  return `SELECT ${kepala},
               ${b.wajib.map((k, i) => `x.${k} AS w${i}`).join(",\n               ")}
          FROM perkara p
          JOIN ${b.tabel} x ON x.perkara_id = p.perkara_id
         WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
           ${b.saring ? `AND ${b.saring}` : ""}
         ORDER BY p.tanggal_pendaftaran
         LIMIT ${BATAS_BARIS}`;
}

/** Pembangun baris bukti satu butir. */
function pembangunBaris(b) {
  return async function baris(rentang) {
    const adaTabel = await sippSkemaService.tabelAda(b.tabel).catch(() => false);
    if (!adaTabel) return [];

    for (const k of b.wajib) {
      const ada = await sippSkemaService.kolomAda(b.tabel, k).catch(() => false);
      if (!ada) return [];
    }

    const hasil = await runQuery(susunKueri(b), [rentang.mulai, rentang.selesai]);

    return hasil.map((x) => {
      const kosong = b.wajib.filter((_, i) => !terisi(x[`w${i}`], b.nolBerartiKosong));
      return {
        kunci: `${teks(x.nomorPerkara)}#${b.kode}`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        ruasKosong: kosong,
        memenuhi: kosong.length === 0,
        sebabTidakMemenuhi: kosong.length === 0 ? "" : `belum terisi: ${kosong.join(", ")}`,
      };
    });
  };
}

/** Definisi lengkap satu butir, siap didaftarkan ke kerangka. */
function definisi(b) {
  return {
    kunci: b.kunci,
    judul: b.judul,
    keterangan: b.keterangan,
    lantai: "bulanan",
    versiRumus: b.versiRumus || "kelengkapan-baris-v1",
    ambangDipakai: [],
    caraHitung: {
      pembilang: `Baris yang seluruh kolom wajibnya terisi: ${b.wajib.join(", ")}`,
      penyebut: `Seluruh baris ${b.tabel} milik perkara yang didaftarkan pada rentang ini${
        b.saring ? `, disaring ${b.saring}` : ""
      }`,
      dikecualikan:
        "Tidak ada yang dikecualikan dari yang tercatat. Butir yang TABELNYA tidak ada pada SIPP ini tidak menghasilkan baris sama sekali - ia tidak dinilai nol, sebab nol berarti menuduh pengadilan tidak mencatat sesuatu yang memang tidak punya tempat penyimpanan.",
      // Disebut lengkap beserta saringannya. Nama tabel saja tidak menerangkan
      // apa pun - beberapa butir sama-sama bersumber tabel perkara, dan yang
      // membedakan justru saringannya.
      tabelSumber:
        b.tabel === "perkara"
          ? `perkara${b.saring ? ` (disaring: ${b.saring})` : " (seluruh perkara pada rentang)"}`
          : `perkara disambung ${b.tabel} lewat perkara_id`,
      ruasSumber: `tanggal_pendaftaran, ${b.wajib.join(", ")}`,
    },
    baris: pembangunBaris(b),
  };
}

module.exports = {
  BATAS_BARIS,
  definisi,
  pembangunBaris,
  susunKueri,
  terisi,
};
