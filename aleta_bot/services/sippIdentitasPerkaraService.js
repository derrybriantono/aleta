"use strict";

/**
 * Identitas perkara dari SIPP: jenis perkara, kumulasi, dan kuasa hukum.
 *
 * ============================================================================
 * KENAPA TIGA HAL INI DIKUMPULKAN JADI SATU
 * ============================================================================
 *
 * Ketiganya menjawab pertanyaan yang sama: perkara ini perkara macam apa, dan
 * siapa yang berbicara untuk para pihaknya. Petugas menanyakannya sekaligus -
 * memisahkannya menjadi tiga permintaan hanya menambah perjalanan ke SIPP tanpa
 * menambah keterangan apa pun.
 *
 * ============================================================================
 * SIPP HANYA DIBACA
 * ============================================================================
 *
 * Tidak ada satu pun tulisan ke SIPP di berkas ini. Kueri di sini SELECT
 * semua, dan nomor perkara selalu masuk sebagai parameter - tidak pernah
 * disambung ke dalam teks kueri.
 *
 * ============================================================================
 * KUMULASI: BARIS JENIS PERKARA UTAMA DIKELUARKAN
 * ============================================================================
 *
 * perkara_kumulasi berisi jenis perkara yang dikumulasikan pada satu perkara.
 * Bila baris jenis perkara pokoknya ikut tercatat di sana, memperhitungkannya
 * membuat SETIAP perkara tampak berkumulasi - penanda yang menyala pada semua
 * perkara tidak memberi tahu apa-apa. Karena itu baris yang sama dengan jenis
 * perkara pokok dikeluarkan lebih dulu.
 */

const db = require("../db_config");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Menerjemahkan pihak_ke SIPP menjadi sebutan yang dipakai petugas. */
function sebutanPihak(pihakKe) {
  if (Number(pihakKe) === 1) return "penggugat";
  if (Number(pihakKe) === 2) return "tergugat";
  return "";
}

/**
 * Identitas satu perkara.
 *
 * Mengembalikan bentuk yang sama walau perkaranya tidak ditemukan, sehingga
 * pemanggil tidak perlu membedakan "tidak ada kuasa" dari "gagal dibaca" -
 * keduanya ditandai lewat medan ditemukan.
 */
async function identitasPerkara(nomorMentah) {
  const nomorPerkara = normalizeCaseNumber(nomorMentah);

  const kosong = {
    nomorPerkara,
    ditemukan: false,
    jenisPerkara: "",
    jenisPerkaraLengkap: "",
    kumulasi: [],
    adaKumulasi: false,
    kuasa: [],
    adaKuasa: false,
    kuasaPenggugat: false,
    kuasaTergugat: false,
  };

  if (!nomorPerkara) return kosong;

  const barisPerkara = await runQuery(
    `SELECT p.perkara_id       AS perkaraId,
            p.jenis_perkara_id AS jenisPerkaraId,
            p.jenis_perkara_nama AS jenisPerkaraNama,
            p.jenis_perkara_text AS jenisPerkaraText
       FROM perkara p
      WHERE p.nomor_perkara = ?
      ORDER BY p.perkara_id DESC
      LIMIT 1`,
    [nomorPerkara]
  );

  const perkara = barisPerkara[0];
  if (!perkara) return kosong;

  // Kumulasi dan kuasa diambil bersamaan - keduanya bergantung pada perkaraId
  // yang sama dan tidak bergantung satu sama lain.
  const [barisKumulasi, barisKuasa] = await Promise.all([
    runQuery(
      `SELECT j.nama AS nama
         FROM perkara_kumulasi k
         JOIN jenis_perkara j ON j.id = k.jenis_perkara_id
        WHERE k.perkara_id = ?
        ORDER BY j.nama ASC`,
      [perkara.perkaraId]
    ),
    runQuery(
      `SELECT a.nama AS nama, a.pihak_ke AS pihakKe
         FROM perkara_pengacara a
        WHERE a.perkara_id = ?
        ORDER BY a.pihak_ke ASC, a.urutan ASC`,
      [perkara.perkaraId]
    ),
  ]);

  const jenisPerkara = cleanText(perkara.jenisPerkaraNama);

  const kumulasi = [];
  const sudahAda = new Set();
  for (const baris of barisKumulasi) {
    const nama = cleanText(baris.nama);
    if (!nama) continue;
    // Jenis perkara pokok bukan kumulasi - lihat catatan di kepala berkas.
    if (nama.toLowerCase() === jenisPerkara.toLowerCase()) continue;
    if (sudahAda.has(nama.toLowerCase())) continue;
    sudahAda.add(nama.toLowerCase());
    kumulasi.push(nama);
  }

  const kuasa = [];
  for (const baris of barisKuasa) {
    const nama = cleanText(baris.nama);
    if (!nama) continue;
    kuasa.push({ nama, pihakKe: Number(baris.pihakKe) || 0, pihak: sebutanPihak(baris.pihakKe) });
  }

  return {
    nomorPerkara,
    ditemukan: true,
    jenisPerkara,
    jenisPerkaraLengkap: cleanText(perkara.jenisPerkaraText) || jenisPerkara,
    kumulasi,
    adaKumulasi: kumulasi.length > 0,
    kuasa,
    adaKuasa: kuasa.length > 0,
    kuasaPenggugat: kuasa.some((k) => k.pihakKe === 1),
    kuasaTergugat: kuasa.some((k) => k.pihakKe === 2),
  };
}

module.exports = { identitasPerkara, sebutanPihak };
