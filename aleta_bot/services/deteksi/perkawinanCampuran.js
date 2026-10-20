"use strict";

/**
 * ============================================================================
 * DETEKSI PERKAWINAN CAMPURAN (jenis_perkara_id 359) - agen W3a-A, 21 Okt 2026
 * ============================================================================
 *
 * Permohonan terhadap penolakan pejabat memberikan surat keterangan bahwa
 * syarat-syarat perkawinan telah dipenuhi untuk perkawinan campuran (WNI dengan
 * WNA; Pasal 57-62 UU 1/1974, khususnya Pasal 60 ayat (3)-(5)). SIPP menamai
 * jenis ini "Penolakan Kawin Campuran". Blangko Derry: folder "5d Perkawinan
 * Campuran" (ALUR 61). Variabel ABT baru 3620-3639 + 0652/0653 (nomor/tanggal
 * surat penolakan, sudah ada).
 *
 * BATAS UKUR: perkara nyata jenis ini di PA Donggala NOL. Aturan di bawah
 * disusun dari bentuk kalimat posita permohonan PA lazim dan DIUJI atas fixture
 * sintetis (src/test/w3a-perkawinan-campuran-21okt.test.ts). Hanya data yang
 * tertulis eksplisit (nama dengan "bernama", negara asal sesudah "warga negara",
 * "Nomor ... tanggal ...", "dengan alasan ...") diberi tingkat "cukup"; huruf
 * syarat (3631) selalu "ragu" karena penilaian majelis.
 */

const B = require("./bantuAnak");
const wilayah = require("./wilayah");

const variabel = Object.freeze([
  { kode: "0652", nama: "Nomor surat penolakan pejabat", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "0653", nama: "Tanggal surat penolakan pejabat", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3620", nama: "Calon mempelai WNI (isian)", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3621", nama: "Calon mempelai WNA (isian)", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3624", nama: "Negara asal calon WNA (isian)", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3626", nama: "Pejabat yang menolak", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3627", nama: "Alasan penolakan menurut surat pejabat", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3631", nama: "Huruf syarat yang dijadikan alasan (saran)", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3629", nama: "Fakta hukum syarat terpenuhi", sumber: "saksi-sipp", blangko: ["putusan"], deteksi: false },
  { kode: "3630", nama: "Fakta hukum syarat belum terpenuhi", sumber: "saksi-sipp", blangko: ["putusan"], deteksi: false },
  { kode: "3634", nama: "Alat bukti surat", sumber: "berkas-ecourt", blangko: ["putusan", "bas"], deteksi: false },
  { kode: "3636", nama: "Keterangan pejabat yang didengar", sumber: "saksi-sipp", blangko: ["putusan", "bas"], deteksi: false },
  { kode: "3637", nama: "Pokok keterangan calon mempelai", sumber: "saksi-sipp", blangko: ["putusan"], deteksi: false },
  { kode: "3638", nama: "Fakta penyebab tidak dapat diterima", sumber: "posita", blangko: ["putusan"], deteksi: false },
]);

/** Huruf syarat (sama dengan huruf isian 3631); "" bila tidak ada atau lebih dari satu golongan cocok. */
const POLA_HURUF = Object.freeze({
  A: /surat\s+keterangan[^;]{0,80}(?:negara\s+asal|kedutaan|konsulat|perwakilan)|(?:kedutaan|konsulat|perwakilan)[^;]{0,60}surat\s+keterangan|certificate\s+of\s+no\s+impediment|belum\s+(?:ada|menyerahkan|melampirkan)[^;]{0,40}surat\s+keterangan/i,
  B: /terikat\s+(?:tali\s+)?perkawinan|masih\s+(?:beristri|bersuami)|belum\s+(?:bercerai|diceraikan)|masih\s+(?:punya|mempunyai|memiliki)\s+(?:istri|isteri|suami)/i,
  C: /belum\s+(?:cukup\s+umur|mencapai\s+(?:batas\s+)?umur|berumur|berusia)|di\s+bawah\s+umur|kurang\s+dari\s+19\s*(?:\([^)]*\)\s*)?tahun/i,
  D: /beda\s+agama|berbeda\s+agama|perbedaan\s+agama|tidak\s+beragama\s+islam|non[-\s]?muslim/i,
  E: /\bpaspor\b|izin\s+tinggal|\bvisa\b|keimigrasian|kitas/i,
});

function hurufDariAlasan(alasan) {
  const cocok = Object.entries(POLA_HURUF)
    .filter(([, re]) => re.test(alasan))
    .map(([h]) => h);
  return cocok.length === 1 ? cocok[0] : "";
}

/** Nama sesudah penanda ("... bernama X"), utuh sampai batas nama. */
function namaSesudah(t, pola) {
  const lu = require("../abtUsulanService");
  const m = pola.exec(t);
  if (!m) return null;
  const nama = B.potongEkorBukanNama(lu.namaDiAwal(t.slice(m.index + m[0].length)));
  if (!nama || nama.length < 3) return null;
  return { nama, kalimat: t.slice(m.index, m.index + m[0].length + 120) };
}

const KATA_BUKAN_NEGARA = /^(?:Indonesia|Asing|Yang|Bernama|Dan|Dengan|Sebagai|Pemohon|Termohon|Calon|Nomor|Tanggal)$/;

function deteksi(posita) {
  const t = B.polos(posita);
  const peta = {};
  if (!t) return peta;

  // 3621 / 3624 - calon WNA: "warga negara asing X bernama N", "seorang laki-laki warga negara Malaysia bernama N", "berkewarganegaraan Jepang bernama N".
  const wna = namaSesudah(
    t,
    /(?:warga\s*negara\s+asing|\bWNA\b|(?:warga\s*negara|berkewarganegaraan|berkebangsaan)\s+(?!Indonesia\b)[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)(?:\s+(?:asal|dari)\s+(?:negara\s+)?[A-Z][A-Za-z]+)?\s*(?:yang\s+)?(?:bernama|atas\s+nama)\s*:?\s*/
  );
  if (wna) B.taruh(peta, "3621", B.fakta(wna.nama, wna.kalimat, /\s/.test(wna.nama) ? "cukup" : "ragu", "campuran-3621-calon-wna"));

  const polaNegara = /(?:warga\s*negara|berkewarganegaraan|berkebangsaan|berasal\s+dari\s+negara|asal\s+negara)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/g;
  for (const negara of t.matchAll(polaNegara)) {
    // nama negara = kata huruf besar berurutan sampai kata penghubung; "Indonesia" dan "Asing" bukan negara asal calon WNA
    const kata = [];
    for (const k of negara[1].split(/\s+/)) {
      if (KATA_BUKAN_NEGARA.test(k)) break;
      kata.push(k);
    }
    const nama = kata.join(" ");
    if (nama && !/^Asing$/i.test(nama)) {
      B.taruh(peta, "3624", B.fakta(nama, t.slice(Math.max(0, negara.index - 20), negara.index + negara[0].length + 40), "cukup", "campuran-3624-negara"));
      break;
    }
  }

  // 3620 - calon WNI: "warga negara Indonesia bernama N" / "berkewarganegaraan Indonesia bernama N".
  const wni = namaSesudah(t, /(?:warga\s*negara|berkewarganegaraan|\bWNI\b)\s*(?:Indonesia\s*)?(?:\(WNI\)\s*)?(?:yang\s+)?(?:bernama|atas\s+nama)\s*:?\s*/);
  if (wni) B.taruh(peta, "3620", B.fakta(wni.nama, wni.kalimat, /\s/.test(wni.nama) ? "cukup" : "ragu", "campuran-3620-calon-wni"));

  // Kalimat tentang penolakan: menolak/penolakan/ditolak + surat keterangan / pejabat.
  const kalimat = B.kalimat(posita);
  const kal = kalimat.find((k) => /\b(?:menolak|penolakan|ditolak)\b/i.test(k) && /(?:Kantor\s+Urusan\s+Agama|\bKUA\b|Pegawai\s+Pencatat|surat\s+keterangan)/i.test(k)) || "";
  if (!kal) return peta;

  // 3626 - pejabat yang menolak (frasa lengkap seperti yang dicetak).
  const posKua = kal.search(/Kantor\s+Urusan\s+Agama|\bKUA\b/i);
  if (posKua >= 0) {
    const k = wilayah.komponenWilayah(kal.slice(posKua, posKua + 200));
    if (k.kecamatan) {
      B.taruh(
        peta,
        "3626",
        B.fakta(`Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan ${k.kecamatan}${k.kabupaten ? `, ${k.kabupaten}` : ""}`, kal, k.kabupaten ? "cukup" : "ragu", "campuran-3626-pejabat")
      );
    }
  }

  // 0652 / 0653 - nomor dan tanggal surat penolakan.
  const nomor = /(?:surat|keterangan)\s+(?:keterangan\s+)?penolakan(?:\s+(?:nikah|perkawinan))?\s*(?:Nomor|No\.?)\s*:?\s*([0-9A-Za-z][0-9A-Za-z.\-/]*\d[0-9A-Za-z.\-/]*)/i.exec(kal);
  if (nomor) {
    B.taruh(peta, "0652", B.fakta(nomor[1].replace(/[.,;]+$/, ""), kal, "cukup", "campuran-0652-nomor"));
    const sesudah = kal.slice(nomor.index + nomor[0].length);
    const tgl = /^[^;]{0,25}?tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+(?:tahun\s+)?\d{4})/i.exec(sesudah);
    if (tgl) {
      const hasil = B.tanggalPertama(tgl[1]);
      if (hasil) B.taruh(peta, "0653", B.fakta(hasil, kal, "cukup", "campuran-0653-tanggal"));
    }
  }

  // 3627 - alasan penolakan; 3631 - saran huruf.
  const alasan = /(?:dengan\s+alasan|alasan(?:nya)?(?:\s+penolakan)?\s*(?:adalah|yaitu|:)|ditolak\s+karena|menolak\s+[^;]{0,120}?\bkarena)\s+(.{6,240}?)(?=\s*;|\s*\.\s+[A-Z]|\s*$)/i.exec(kal);
  if (alasan) {
    const klausa = alasan[1].trim().replace(/[.,;]+$/, "");
    B.taruh(peta, "3627", B.fakta(klausa, kal, "cukup", "campuran-3627-alasan"));
    const huruf = hurufDariAlasan(klausa);
    if (huruf) {
      B.taruh(peta, "3631", Object.assign(B.fakta(huruf, kal, "ragu", "campuran-3631-huruf"), { catatan: "Saran dari kata kunci alasan penolakan; syarat yang dijadikan alasan adalah penilaian majelis - periksa surat penolakan." }));
    }
  }
  return peta;
}

module.exports = { kunci: "perkawinan-campuran", jenisPerkaraId: [359], variabel, deteksi, hurufDariAlasan };
