"use strict";

/**
 * ============================================================================
 * WALI ADHAL (jenis_perkara_id 363) - melengkapi bacaan posita yang sudah ada (deteksi/waliAdhol.js, blangkoDerry.js)
 * ============================================================================
 *
 *   1002  status Pemohon sebelum nikah           pihak.status_kawin Pemohon: 2 belum kawin -> gadis; 3 cerai hidup / 4 cerai mati -> janda
 *                                                (kode 1 "kawin" adalah bawaan SIPP yang tak berarti pada calon pengantin: tanpa usulan)
 *   6331  pekerjaan calon suami                  kalimat identitas calon suami di posita ("..., pekerjaan Karyawan Swasta, tempat tinggal ...")
 */

const B = require("./bantu");

const STATUS = Object.freeze({ 2: "gadis", 3: "janda", 4: "janda" });

/** 1002 dari status kawin Pemohon di SIPP; posita yang menyebut pernah menikah/janda tidak boleh bertentangan. */
function statusPemohon(pihak1, posita) {
  const p = (pihak1 || [])[0];
  const kata = p ? STATUS[Number(p.statusKawin)] : "";
  if (!kata) return [];
  const t = B.polos(posita);
  const pernah = /\b(?:janda|pernah\s+menikah|bercerai|cerai)\b/i.test(t);
  if (kata === "gadis" && pernah) return [];
  return [
    B.butir({
      kode: "1002",
      nama: "Status Pemohon sebelum nikah",
      nilai: kata,
      keyakinan: "cukup",
      kalimat: `Status perkawinan Pemohon di SIPP: ${Number(p.statusKawin) === 2 ? "belum kawin" : Number(p.statusKawin) === 3 ? "cerai hidup" : "cerai mati"}`,
      catatan:
        kata === "gadis"
          ? "Dari status kawin Pemohon di data pihak SIPP (belum kawin). Petugas juga menulis 'perawan' atau 'gadis dengan umur ... tahun'; sesuaikan."
          : "Dari status kawin Pemohon di data pihak SIPP (cerai hidup/mati). Petugas juga menulis 'janda mati'/'janda cerai'; sesuaikan.",
      kodePola: "s5-wa-1002-status-kawin",
    }),
  ];
}

/** 6331: pekerjaan calon suami dari kalimat identitasnya. */
function pekerjaanCalonSuami(posita) {
  const t = B.polos(posita);
  const awal = /\b(?:laki-laki|pria|lelaki)\s+(?:pilihan\s+)?(?:Pemohon\s+)?(?:yang\s+)?bernama\s*:?\s*/i.exec(t);
  if (!awal) return [];
  const potong = t.slice(awal.index, awal.index + 520);
  const m = /\bpekerjaan\s+(.{3,90}?)(?=\s*,\s*tempat\s+tinggal\b|\s*,\s*bertempat|\s*;|\s+tempat\s+tinggal\b)/i.exec(potong);
  if (!m) return [];
  const kerja = m[1].replace(/\s+/g, " ").replace(/\s+\)/g, ")").replace(/\(\s+/g, "(").replace(/[\s,.]+$/, "").trim();
  if (kerja.length < 3 || /^(?:tidak|belum)\b/i.test(kerja)) return [];
  return [
    B.butir({
      kode: "6331",
      nama: "Pekerjaan calon suami",
      nilai: kerja,
      keyakinan: "ragu",
      kalimat: m[0],
      asal: "posita-gugatan",
      catatan:
        "Pekerjaan calon suami dari kalimat identitasnya di posita (ejaan disalin apa adanya - periksa). Penghasilan rata-rata per bulan tidak ada di posita: tambahkan bila blangko memerlukannya.",
      kodePola: "s5-wa-6331-posita",
    }),
  ];
}

function usulanWaliAdhal(d) {
  const posita = String((d.perkara && d.perkara.posita) || "");
  return [...statusPemohon(d.pihak1, posita), ...pekerjaanCalonSuami(posita)];
}

module.exports = { usulanWaliAdhal, statusPemohon, pekerjaanCalonSuami, STATUS };
