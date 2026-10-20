"use strict";

/**
 * ============================================================================
 * PERWALIAN (jenis_perkara_id 354) - melengkapi bacaan posita/petitum yang sudah ada (deteksi/perwalian.js)
 * ============================================================================
 *
 * Yang sudah dibaca modul perwalian (1025 pewaris, 0709/0712 orang tua, 1230 tanggal wafat, 5110 anak, 8171 keperluan,
 * 5197/5105/5178 pernikahan) tidak diulang di sini. Yang ditambahkan:
 *
 *   6331  pekerjaan (+ penghasilan) Pemohon     pihak.pekerjaan Pemohon di SIPP; penghasilan per bulan tidak ada di SIPP
 *   5110  nama anak                              perkara_anak_pihak bila petitum tidak menyebut nama anak
 *
 * Syarat berlakunya (dipakai ukuran): 0709 / 0712 / 1230 hanya pada perwalian oleh ORANG TUA yang masih hidup (ibu/bapak
 * kandung) - pada perwalian oleh saudara, paman atau kakek blangko variannya tidak memakai isian itu.
 */

const B = require("./bantu");

const KELUARGA_LAIN = /\b(?:saudara|kakak|adik|paman|bibi|kakek|nenek|keponakan|sepupu|om|tante)\b/i;

/** Pemohon perwalian adalah orang tua anak yang masih hidup (bukan saudara/paman/kakek)? null bila tidak terbaca. */
function pemohonOrangTua(posita) {
  const t = B.polos(posita);
  if (!t) return null;
  if (/\bPemohon\b[^.;]{0,40}\b(?:merupakan|adalah|sebagai)\s+(?:seorang\s+)?(?:ibu|bapak|ayah)\s+(?:kandung|angkat)?/i.test(t)) return true;
  if (/\b(?:suami|isteri|istri)\s+Pemohon\b[^.;]{0,160}\bmeninggal\b|\(\s*(?:suami|isteri|istri)\s+Pemohon\s*\)[^.;]{0,60}\bmeninggal\b/i.test(t)) return true;
  const hubungan = /\bPemohon\b[^.;]{0,30}\b(?:merupakan|adalah|sebagai)\s+([A-Za-z ]{3,40}?)(?:\s+(?:kandung|dari|anak|dari anak)\b|[;.,]|\s+bagi)/i.exec(t);
  if (hubungan && KELUARGA_LAIN.test(hubungan[1])) return false;
  if (KELUARGA_LAIN.test((/\bPemohon\b[^.;]{0,80}\b(?:wali|perwalian)\b/i.exec(t) || [""])[0])) return false;
  return null;
}

/** 6331: pekerjaan Pemohon dari data pihak SIPP - "ragu" karena penghasilan per bulan tidak tercatat. */
function pekerjaanPemohon(pihak1) {
  const p = (pihak1 || [])[0];
  const kerja = B.rapikanNama(p && p.pekerjaan);
  if (!kerja || /^(?:tidak\s+diketahui|-)$/i.test(kerja)) return [];
  return [
    B.butir({
      kode: "6331",
      nama: "Pekerjaan Pemohon",
      nilai: kerja,
      keyakinan: "ragu",
      kalimat: `Data Pemohon di SIPP: pekerjaan ${kerja}`,
      catatan:
        "Pekerjaan Pemohon dari data pihak di SIPP. Penghasilan rata-rata per bulan tidak tersimpan di SIPP: tambahkan 'dengan penghasilan rata-rata sejumlah Rp... (... rupiah) per bulan' dari keterangan Pemohon bila blangko memerlukannya.",
      kodePola: "s5-perwalian-6331-pekerjaan",
    }),
  ];
}

/** 5110 dari data anak SIPP (cadangan bila petitum tidak menyebut nama anak). */
function namaAnakSipp(anak) {
  const nama = (anak || []).map((a) => B.rapikanNama(a.nama)).filter((n) => n.length >= 3);
  if (!nama.length) return [];
  return [
    B.butir({
      kode: "5110",
      nama: "Nama anak",
      nilai: nama.join(", "),
      keyakinan: "cukup",
      kalimat: `Anak di SIPP: ${nama.join(", ")}`,
      catatan: "Dari data anak yang didaftarkan di SIPP; periksa dengan petitum dan akta kelahiran.",
      kodePola: "s5-perwalian-5110-anak-sipp",
    }),
  ];
}

function usulanPerwalian(d) {
  return [...pekerjaanPemohon(d.pihak1), ...namaAnakSipp(d.anak)];
}

module.exports = { usulanPerwalian, pemohonOrangTua, pekerjaanPemohon, namaAnakSipp };
