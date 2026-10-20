"use strict";

/**
 * ============================================================================
 * DETEKSI PENOLAKAN PERKAWINAN (jenis_perkara_id 343) - agen W3a-A, 21 Okt 2026
 * ============================================================================
 *
 * Permohonan calon mempelai terhadap penolakan Pegawai Pencatat Nikah (KUA)
 * melangsungkan perkawinan (Pasal 21 ayat (1)-(5) UU 1/1974). Blangko Derry:
 * folder "5c Penolakan Perkawinan" (ALUR 60). Variabel ABT baru 3600-3619
 * (paket abt-w3a-blangko-baru-perkawinan) + 0652/0653 (nomor/tanggal surat
 * penolakan KUA, sudah ada).
 *
 * BATAS UKUR: perkara nyata jenis ini di PA Donggala NOL (satu-satunya perkara
 * 343 di SIPP, 483/Pdt.P/2019, ternyata itsbat nikah yang salah jenis). Aturan
 * di bawah disusun dari bentuk kalimat posita permohonan PA lazim dan DIUJI
 * atas fixture sintetis (src/test/w3a-penolakan-perkawinan-21okt.test.ts).
 * Sebab itu hanya data terstruktur-eksplisit ("Nomor ... tanggal ...", "Kantor
 * Urusan Agama Kecamatan X Kabupaten Y", "dengan alasan ...", "calon suami
 * bernama ...") yang diberi tingkat "cukup"; huruf larangan (3606) selalu
 * "ragu" (penilaian majelis) dan hanya menjadi saran.
 */

const B = require("./bantuAnak");
const wilayah = require("./wilayah");

const variabel = Object.freeze([
  { kode: "0652", nama: "Nomor surat penolakan KUA", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "0653", nama: "Tanggal surat penolakan KUA", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3600", nama: "Calon suami (isian)", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3601", nama: "Calon istri (isian)", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3604", nama: "Wilayah KUA yang menolak", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3605", nama: "Alasan penolakan menurut surat PPN", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3606", nama: "Huruf larangan yang dijadikan alasan (saran)", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3609", nama: "Fakta hukum larangan tidak terbukti", sumber: "saksi-sipp", blangko: ["putusan"], deteksi: false },
  { kode: "3610", nama: "Fakta hukum larangan terbukti", sumber: "saksi-sipp", blangko: ["putusan"], deteksi: false },
  { kode: "3611", nama: "Keterangan PPN yang didengar", sumber: "saksi-sipp", blangko: ["putusan", "bas"], deteksi: false },
  { kode: "3612", nama: "Pokok keterangan calon mempelai", sumber: "saksi-sipp", blangko: ["putusan"], deteksi: false },
  { kode: "3613", nama: "Alat bukti surat", sumber: "berkas-ecourt", blangko: ["putusan", "bas"], deteksi: false },
  { kode: "3616", nama: "Pengadilan Agama berwenang (NO wilayah)", sumber: "posita", blangko: ["putusan"], deteksi: false },
  { kode: "3617", nama: "Keadaan belum ada penolakan tertulis (NO)", sumber: "posita", blangko: ["putusan"], deteksi: false },
]);

/** Huruf larangan menurut isi alasan penolakan (sama dengan huruf isian 3606). Mengembalikan "" bila tak ada atau lebih dari satu cocok. */
const POLA_HURUF = Object.freeze({
  A: /terikat\s+(?:tali\s+)?perkawinan|masih\s+(?:beristri|bersuami|berstatus\s+(?:suami|istri|isteri))|belum\s+(?:bercerai|diceraikan)|masih\s+(?:punya|mempunyai|memiliki)\s+(?:istri|isteri|suami)/i,
  B: /belum\s+(?:cukup\s+umur|mencapai\s+(?:batas\s+)?umur|berumur|berusia|cukup\s+usia)|di\s+bawah\s+umur|kurang\s+dari\s+19\s*(?:\([^)]*\)\s*)?tahun/i,
  C: /hubungan\s+(?:darah|semenda|susuan)|sesusuan|sepersusuan|saudara\s+(?:kandung|sesusuan)|mahram|muhrim|ibu\s+tiri|anak\s+tiri|mertua|menantu/i,
  D: /masa\s+(?:iddah|idah|tunggu)|dalam\s+iddah/i,
  E: /beda\s+agama|berbeda\s+agama|perbedaan\s+agama|tidak\s+beragama\s+islam|non[-\s]?muslim/i,
  F: /talak\s+(?:tiga|3)|ditalak\s+(?:tiga|3)|li['’]?an|bercerai\s+(?:lagi\s+)?untuk\s+(?:yang\s+)?kedua|cerai\s+dua\s+kali/i,
  G: /izin\s+(?:kedua\s+)?orang\s*tua|persetujuan\s+(?:calon|kedua\s+calon)|tanpa\s+(?:izin|persetujuan)|tidak\s+(?:mendapat|memperoleh)\s+(?:izin|restu|persetujuan)/i,
  H: /(?:syarat|persyaratan)\s+administrasi|berkas\s+(?:belum\s+)?(?:tidak\s+)?lengkap|belum\s+lengkap|kutipan\s+akta\s+kelahiran\s+(?:belum|tidak)|surat\s+(?:kematian|keterangan\s+cerai)\s+(?:belum|tidak)/i,
});

function hurufDariAlasan(alasan) {
  const cocok = Object.entries(POLA_HURUF)
    .filter(([, re]) => re.test(alasan))
    .map(([h]) => h);
  return cocok.length === 1 ? cocok[0] : "";
}

/** Nama setelah "calon suami/istri ... bernama". */
function namaCalon(t, peran, kode, kodePola, peta) {
  const lu = require("../abtUsulanService");
  const pola = new RegExp(
    `calon\\s+${peran}(?:nya|\\s+Pemohon(?:\\s+(?:I|II|1|2))?)?\\s*(?:\\([^)]*\\)\\s*)?(?:yang\\s+)?(?:bernama|atas\\s+nama|yaitu)\\s*:?\\s*|` +
      `dengan\\s+(?:seorang\\s+)?${peran === "suami" ? "(?:laki-laki|pria)" : "(?:perempuan|wanita)"}\\s+(?:pilihan\\s+(?:Pemohon\\s+)?)?(?:yang\\s+)?bernama\\s*:?\\s*`,
    "i"
  );
  const m = pola.exec(t);
  if (!m) return;
  const sisa = t.slice(m.index + m[0].length);
  const nama = B.potongEkorBukanNama(lu.namaDiAwal(sisa));
  if (!nama || nama.length < 3) return;
  const lengkap = /\b(?:bin|binti)\b/i.test(nama) || nama.split(" ").length >= 2;
  B.taruh(peta, kode, B.fakta(nama, t.slice(m.index, m.index + m[0].length + 120), lengkap ? "cukup" : "ragu", kodePola));
}

function deteksi(posita) {
  const t = B.polos(posita);
  const peta = {};
  if (!t) return peta;

  namaCalon(t, "suami", "3600", "penolakan-3600-calon-suami", peta);
  namaCalon(t, "(?:istri|isteri)", "3601", "penolakan-3601-calon-istri", peta);

  // Kalimat tentang penolakan: memuat kata menolak/penolakan/ditolak dan KUA / Pegawai Pencatat.
  const kalimat = B.kalimat(posita);
  const kal = kalimat.find((k) => /\b(?:menolak|penolakan|ditolak)\b/i.test(k) && /(?:Kantor\s+Urusan\s+Agama|\bKUA\b|Pegawai\s+Pencatat)/i.test(k)) || "";
  if (!kal) return peta;

  // 3604 - wilayah KUA yang menolak.
  const posKua = kal.search(/Kantor\s+Urusan\s+Agama|\bKUA\b/i);
  if (posKua >= 0) {
    const k = wilayah.komponenWilayah(kal.slice(posKua, posKua + 200));
    if (k.kecamatan) {
      B.taruh(
        peta,
        "3604",
        B.fakta(`Kecamatan ${k.kecamatan}${k.kabupaten ? `, ${k.kabupaten}` : ""}`, kal, k.kabupaten ? "cukup" : "ragu", "penolakan-3604-kua")
      );
    }
  }

  // 0652 / 0653 - nomor dan tanggal surat penolakan.
  const nomor = /(?:surat|keterangan)\s+(?:keterangan\s+)?penolakan(?:\s+(?:nikah|perkawinan))?\s*(?:Nomor|No\.?)\s*:?\s*([0-9A-Za-z][0-9A-Za-z.\-/]*\d[0-9A-Za-z.\-/]*)/i.exec(kal);
  if (nomor) {
    B.taruh(peta, "0652", B.fakta(nomor[1].replace(/[.,;]+$/, ""), kal, "cukup", "penolakan-0652-nomor"));
    const sesudah = kal.slice(nomor.index + nomor[0].length);
    const tgl = /^[^;]{0,25}?tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+(?:tahun\s+)?\d{4})/i.exec(sesudah);
    if (tgl) {
      const hasil = B.tanggalPertama(tgl[1]);
      if (hasil) B.taruh(peta, "0653", B.fakta(hasil, kal, "cukup", "penolakan-0653-tanggal"));
    }
  }

  // 3605 - alasan penolakan.
  const alasan = /(?:dengan\s+alasan|alasan(?:nya)?(?:\s+penolakan)?\s*(?:adalah|yaitu|:)|ditolak\s+karena|menolak\s+[^;]{0,120}?\bkarena)\s+(.{6,240}?)(?=\s*;|\s*\.\s+[A-Z]|\s*$)/i.exec(kal);
  if (alasan) {
    const klausa = alasan[1].trim().replace(/[.,;]+$/, "");
    B.taruh(peta, "3605", B.fakta(klausa, kal, "cukup", "penolakan-3605-alasan"));
    const huruf = hurufDariAlasan(klausa);
    if (huruf) {
      B.taruh(peta, "3606", Object.assign(B.fakta(huruf, kal, "ragu", "penolakan-3606-huruf"), { catatan: "Saran dari kata kunci alasan penolakan; huruf larangan adalah penilaian majelis - periksa surat penolakan." }));
    }
  }
  return peta;
}

module.exports = { kunci: "penolakan-perkawinan", jenisPerkaraId: [343], variabel, deteksi, hurufDariAlasan };
