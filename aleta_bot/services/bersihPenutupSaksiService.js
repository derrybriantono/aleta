"use strict";

/**
 * ============================================================================
 * PEMBERSIH OTOMATIS KALIMAT PENUTUP SAKSI TERSIMPAN (21 Okt 2026, paket x7/x11)
 * ============================================================================
 *
 * Templat tanya jawab ABT membawa jawaban bawaan "Sudah cukup;" pada pertanyaan
 * penutup ("Apakah masih ada yang ingin Saudara sampaikan?"). Petugas yang
 * mengetik langsung di ABT menyimpannya ke abt_keterangan_saksi, dan baris itu
 * tercetak di BAS (tabel tanya-jawab PHP yang tak dapat disaring dari SQL).
 * Keputusan pengguna: baris penutup pada perkara BELUM minutasi dibersihkan
 * OTOMATIS ke depan; perkara yang sudah minutasi tidak pernah disentuh (arsipnya
 * harus sama dengan putusan/BAS yang ditandatangani).
 *
 * Aturan (satu sumber dengan penutupSaksi.js / paket x6):
 *   - yang dihapus hanya baris yang jawabannya SELURUHNYA kalimat penutup
 *     (adalahKalimatPenutupSaksi dengan pertanyaannya; "tidak sanggup lagi"
 *     ikut pertanyaan, keputusan 17 Okt). Baris keterangan perkara tidak disentuh;
 *   - perkara belum minutasi = ada di SIPP.perkara dan TANPA baris
 *     perkara_proses proses_id = 220 (Minutasi). tanggal_minutasi tidak dipakai
 *     (kolom mati).
 *
 * Cadangan: sebelum menghapus, baris LENGKAP (teks sebagai HEX byte-asli, supaya
 * pulih persis) ditulis ke berkas JSON-baris di folder yang di-mount ke luar
 * wadah (reports/cadangan-penutup-saksi, atau ALETA_BERSIH_PENUTUP_DIR). Berkas
 * itu tidak ditulis ke SIPP/ABT dan tak memuat nama aplikasi di basis data.
 * pulihkanPenutupTersimpan() mengembalikannya dengan INSERT IGNORE (baris yang
 * sudah ada tidak ditimpa).
 *
 * Pemanggil: cron harian bot (app.js) dan rute internal /abt/bersih-penutup-saksi.
 */

const fs = require("fs");
const path = require("path");
const { adalahKalimatPenutupSaksi } = require("./penutupSaksi");

const PROSES_MINUTASI = 220;
// Penyaring kasar di SQL supaya hanya baris yang mungkin penutup dibaca; keputusan akhir oleh adalahKalimatPenutupSaksi.
const POLA_KASAR = "cukup|sekian|tidak ada|sampai di sini|demikian|terima kasih|sanggup|kuat|mampu|hanya itu|itu saja";
const TEKS_MAKS = 400;
const UKURAN_POTONG = 500;

const KOLOM_TANPA_TEKS = ["id", "perkara_id", "sidang_id", "penanya_id", "saksi_id", "urutan_pertanyaan", "diinput_oleh", "diinput_tanggal", "diperbaharui_oleh", "diperbaharui_tanggal"];

function tanya(pool, sql, params) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params || [], (galat, hasil) => (galat ? reject(galat) : resolve(hasil)));
  });
}

function folderCadangan() {
  return process.env.ALETA_BERSIH_PENUTUP_DIR || path.resolve(__dirname, "../reports/cadangan-penutup-saksi");
}

/** Byte asli kolom (latin1/cp1252 di ABT) -> teks, seperti yang dilihat ekstensi. */
function teksDariHex(hex) {
  if (!hex) return "";
  return new TextDecoder("windows-1252").decode(Buffer.from(String(hex), "hex"));
}

function cap(sekarang) {
  const d = sekarang instanceof Date ? sekarang : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Baris ABT yang jawabannya seluruhnya penutup, di semua perkara (belum disaring menurut minutasi). */
async function barisPenutup(abt, perkaraId) {
  const sql =
    "SELECT id, perkara_id, sidang_id, penanya_id, saksi_id, urutan_pertanyaan, HEX(pertanyaan) AS pertanyaan_hex, HEX(jawaban) AS jawaban_hex, MD5(jawaban) AS md5_jawaban, " +
    "diinput_oleh, CAST(diinput_tanggal AS CHAR) AS diinput_tanggal, diperbaharui_oleh, CAST(diperbaharui_tanggal AS CHAR) AS diperbaharui_tanggal " +
    "FROM abt_keterangan_saksi WHERE jawaban IS NOT NULL AND CHAR_LENGTH(jawaban) > 0 AND CHAR_LENGTH(jawaban) <= ? AND jawaban REGEXP ?" +
    (perkaraId ? " AND perkara_id = ?" : "") +
    " ORDER BY id";
  const params = perkaraId ? [TEKS_MAKS, POLA_KASAR, perkaraId] : [TEKS_MAKS, POLA_KASAR];
  const baris = await tanya(abt, sql, params);
  return baris.filter((b) => {
    const jawab = teksDariHex(b.jawaban_hex);
    return jawab.trim() !== "" && adalahKalimatPenutupSaksi(jawab, teksDariHex(b.pertanyaan_hex));
  });
}

/** Subhimpunan perkara_id yang ada di SIPP dan BELUM minutasi (tanpa proses 220). */
async function perkaraBelumMinutasi(sipp, daftarId) {
  const hasil = new Set();
  for (let i = 0; i < daftarId.length; i += UKURAN_POTONG) {
    const potong = daftarId.slice(i, i + UKURAN_POTONG);
    const baris = await tanya(
      sipp,
      "SELECT p.perkara_id FROM perkara p WHERE p.perkara_id IN (?) AND NOT EXISTS (SELECT 1 FROM perkara_proses pp WHERE pp.perkara_id = p.perkara_id AND pp.proses_id = ?)",
      [potong, PROSES_MINUTASI]
    );
    for (const b of baris) hasil.add(String(b.perkara_id));
  }
  return hasil;
}

/**
 * Bersihkan baris penutup di perkara belum minutasi.
 * @param {{abt: object, sipp: object, perkaraId?: (string|number), kering?: boolean, folder?: string, sekarang?: Date}} opsi
 *   abt/sipp = kolam mysql (query(sql, params, cb)); kering = hanya hitung, tanpa menulis/menghapus.
 * @returns {Promise<{kandidat:number, perkara:number, dihapus:number, gagal:number, cadangan:string, kering:boolean, perPerkara:Object}>}
 */
async function bersihkanPenutupTersimpan(opsi) {
  const { abt, sipp } = opsi;
  const kering = Boolean(opsi.kering);
  const semua = await barisPenutup(abt, opsi.perkaraId ? Number(opsi.perkaraId) : 0);
  const idPerkara = [...new Set(semua.map((b) => String(b.perkara_id)))];
  const boleh = idPerkara.length ? await perkaraBelumMinutasi(sipp, idPerkara) : new Set();
  const sasaran = semua.filter((b) => boleh.has(String(b.perkara_id)));
  const perPerkara = {};
  for (const b of sasaran) perPerkara[b.perkara_id] = (perPerkara[b.perkara_id] || 0) + 1;
  const hasil = { kandidat: sasaran.length, perkara: Object.keys(perPerkara).length, dihapus: 0, gagal: 0, cadangan: "", kering, perPerkara };
  if (kering || sasaran.length === 0) return hasil;

  // 1. Cadangan LENGKAP dulu, dibaca ulang jumlahnya; gagal menulis = tidak ada yang dihapus.
  const folder = opsi.folder || folderCadangan();
  fs.mkdirSync(folder, { recursive: true });
  const berkas = path.join(folder, `penutup-saksi-${cap(opsi.sekarang)}.jsonl`);
  const isi = [JSON.stringify({ jenis: "kepala", waktu: (opsi.sekarang || new Date()).toISOString(), jumlah: sasaran.length, aturan: "jawaban seluruhnya penutup; perkara tanpa proses 220" })]
    .concat(sasaran.map((b) => JSON.stringify({ jenis: "baris", ...b })))
    .join("\n");
  fs.writeFileSync(berkas, isi + "\n", { flag: "wx" });
  const tertulis = fs.readFileSync(berkas, "utf8").split("\n").filter(Boolean).length - 1;
  if (tertulis !== sasaran.length) throw new Error(`cadangan tidak lengkap (${tertulis}/${sasaran.length}) - tidak ada yang dihapus`);
  hasil.cadangan = berkas;

  // 2. Hapus satu per satu; baris yang isinya berubah sejak dibaca (md5) tidak dihapus.
  for (const b of sasaran) {
    const r = await tanya(abt, "DELETE FROM abt_keterangan_saksi WHERE id = ? AND MD5(jawaban) = ?", [b.id, b.md5_jawaban]);
    if (r && r.affectedRows === 1) hasil.dihapus += 1;
    else hasil.gagal += 1;
  }
  return hasil;
}

/** Kembalikan baris dari berkas cadangan (INSERT IGNORE: yang sudah ada tidak ditimpa). */
async function pulihkanPenutupTersimpan({ abt, berkas, kering }) {
  const baris = fs
    .readFileSync(berkas, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((x) => x.jenis === "baris");
  const hasil = { tercadang: baris.length, dipulihkan: 0, sudahAda: 0, kering: Boolean(kering) };
  for (const b of baris) {
    if (kering) continue;
    const r = await tanya(
      abt,
      "INSERT IGNORE INTO abt_keterangan_saksi (id, perkara_id, sidang_id, penanya_id, saksi_id, urutan_pertanyaan, pertanyaan, jawaban, diinput_oleh, diinput_tanggal, diperbaharui_oleh, diperbaharui_tanggal) " +
        "VALUES (?, ?, ?, ?, ?, ?, UNHEX(?), UNHEX(?), ?, ?, ?, ?)",
      [b.id, b.perkara_id, b.sidang_id, b.penanya_id, b.saksi_id, b.urutan_pertanyaan, b.pertanyaan_hex, b.jawaban_hex, b.diinput_oleh, b.diinput_tanggal, b.diperbaharui_oleh, b.diperbaharui_tanggal]
    );
    if (r && r.affectedRows === 1) hasil.dipulihkan += 1;
    else hasil.sudahAda += 1;
  }
  return hasil;
}

module.exports = { bersihkanPenutupTersimpan, pulihkanPenutupTersimpan, barisPenutup, perkaraBelumMinutasi, folderCadangan, PROSES_MINUTASI, KOLOM_TANPA_TEKS };
