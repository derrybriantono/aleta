"use strict";

/**
 * ============================================================================
 * DISPENSASI KAWIN (362) - isian TAMBAHAN dari posita dan data calon mempelai SIPP (agen U4, 20 Okt 2026)
 * ============================================================================
 * Melengkapi isiOtomatisS5/dk.js (nama, umur, tanggal lahir wanita, pendidikan, pekerjaan, status, alasan lain) dan
 * deteksiDispensasiKawinService (hamil, hubungan erat). Yang ditambahkan, semuanya diukur atas perkara DK PA Donggala
 * 2015-2026 yang isiannya sudah diketik petugas (scripts/ukur-isian-u4.cjs):
 *
 *   5178  KUA yang menolak pendaftaran nikah   posita "melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan X, Kabupaten Y"
 *   3333  kecamatan + kabupaten KUA            bentuk pendek isian petugas ("Banawa, Kabupaten Donggala")
 *   0652  nomor surat penolakan KUA            posita "surat Penolakan Nomor : B.042/KUA.22.02.08/PW.01/3/2025"
 *   0653  tanggal surat penolakan KUA          posita "... tanggal 11 Februari 2025" (hanya bila tertulis)
 *   1666  lama pacaran / saling mengenal       posita "telah saling mengenal selama 3 tahun" (ragu: lama di sidang bisa lebih panjang)
 *   1014  eratnya hubungan calon               kalimat "saling mengenal ... sedemikian eratnya ..." (ragu)
 *   0340 / 0344  tempat lahir calon pria / wanita   perkara_mempelai_dk.tempat_lahir
 *   0348  tanggal lahir calon pria             perkara_mempelai_dk.tanggal_lahir (0349 wanita sudah di S5)
 *
 * MURNI. Keyakinan: bentuk baku posita (kalimat hasil formulir e-Court) = "cukup"; kalimat bebas = "ragu".
 */

const B = require("../isiOtomatisS5/bantu");
const { pasangan } = require("../isiOtomatisS5/dk");

const NAMA_WILAYAH = "[A-Z][A-Za-z'’]+(?:\\s+[A-Za-z'’]+){0,3}?";
const RE_KUA = new RegExp(
  "(?:Pegawai\\s+Pencatat\\s+Nikah\\s+(?:pada\\s+)?)?(?:Kantor\\s+Urusan\\s+Agama|KUA)\\s+(?:\\(KUA\\)\\s+)?Kecamatan\\s+(" +
    NAMA_WILAYAH +
    ")\\s*,\\s*(Kabupaten|Kota)\\s+(" +
    NAMA_WILAYAH +
    ")(?=\\s*(?:[,;.]|\\(|guna\\b|untuk\\b|dan\\b|Provinsi\\b|namun\\b|$))"
);

const rapikan = (t) => String(t || "").replace(/\s+/g, " ").replace(/\s+([,;.])/g, "$1").trim();

function kuaPenolak(teks) {
  // hanya kalimat yang bicara melapor/mendaftar dan penolakan
  for (const k of teks.split(/;\s+|\.\s+(?=Bahwa|[A-Z])/)) {
    if (!/\b(?:tolak|ditolak|penolakan|melapor|mendaftarkan|mencatatkan)\b/i.test(k)) continue;
    const m = RE_KUA.exec(k);
    if (m) return { kecamatan: rapikan(m[1]), jenis: m[2], wilayah: rapikan(m[3]), kalimat: rapikan(k) };
  }
  return null;
}

function suratPenolakan(teks) {
  const m = /surat\s+penolakan\s+nomor\s*:?\s*([A-Za-z0-9][A-Za-z0-9./\-_]*)(?:\s*,)?(?:\s+(?:tertanggal|tanggal)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}))?/i.exec(teks);
  if (!m) return null;
  return { nomor: m[1].replace(/[.,;]+$/, ""), tanggal: m[2] || "", kalimat: rapikan(m[0]) };
}

function lamaKenal(teks) {
  const m = /saling\s+(?:mengenal|kenal)\s+(?:dengan\s+[^,;]{0,40}?\s+)?(?:selama|sejak|sudah|sekitar)\s+(\d+(?:\s*\([a-z ]+\))?\s*(?:tahun|bulan|minggu|hari))/i.exec(teks);
  if (!m) return null;
  const nilai = m[1].replace(/\s*\([a-z ]+\)/i, "").replace(/\s+/g, " ").trim();
  return { nilai, kalimat: rapikan(m[0]) };
}

function eratHubungan(teks) {
  const m = /(saling\s+(?:mengenal|kenal)[^;.]{0,160}?(?:sedemikian\s+erat\w*|sangat\s+erat\w*|tidak\s+dapat\s+(?:lagi\s+)?dipisahkan|sudah\s+erat))/i.exec(teks);
  if (!m) return null;
  // bentuk baku isian petugas: "telah saling mengenal selama N, dan hubungan mereka telah sedemikian eratnya"
  const lama = lamaKenal(teks);
  const baku = lama && /sedemikian\s+erat/i.test(m[1]) ? `telah saling mengenal selama ${lama.nilai}, dan hubungan mereka telah sedemikian eratnya` : "";
  return { nilai: baku || rapikan(m[1]).replace(/^saling/i, "telah saling"), kalimat: rapikan(m[0]) };
}

/**
 * @param {{perkara: {posita: string}, mempelai: object[]}} d  keluaran isiOtomatisJenisS5.bacaData
 */
function usulanU4Dk(d) {
  const posita = B.polos((d.perkara && d.perkara.posita) || "");
  const hasil = [];
  const kua = kuaPenolak(posita);
  if (kua) {
    const lengkap = `Kantor Urusan Agama Kecamatan ${kua.kecamatan}, ${kua.jenis} ${kua.wilayah}`;
    hasil.push(
      B.butir({
        kode: "5178",
        nama: "KUA yang menolak pendaftaran nikah",
        nilai: lengkap,
        keyakinan: "pasti",
        kalimat: kua.kalimat,
        asal: "posita-gugatan",
        catatan: "Dari kalimat baku posita tentang pelaporan ke Pegawai Pencatat Nikah dan penolakannya; samakan dengan surat penolakan KUA.",
        kodePola: "u4-dk-5178-kua",
      }),
      B.butir({
        kode: "3333",
        nama: "Kecamatan KUA yang menolak",
        nilai: `${kua.kecamatan}, ${kua.jenis} ${kua.wilayah}`,
        keyakinan: "cukup",
        kalimat: kua.kalimat,
        asal: "posita-gugatan",
        catatan: "Dari kalimat baku posita; bentuk pendek untuk kalimat 'KUA Kecamatan ...'.",
        kodePola: "u4-dk-3333-kua",
      })
    );
  }
  const surat = suratPenolakan(posita);
  if (surat) {
    hasil.push(
      B.butir({ kode: "0652", nama: "No. surat penolakan KUA", nilai: surat.nomor, keyakinan: "cukup", kalimat: surat.kalimat, asal: "posita-gugatan", catatan: "Nomor surat penolakan sebagaimana tertulis di posita; cocokkan dengan suratnya.", kodePola: "u4-dk-0652-nomor-surat" })
    );
    const iso = surat.tanggal ? B.indonesiaKeIso(surat.tanggal) : "";
    if (iso)
      hasil.push(
        B.butir({ kode: "0653", nama: "Tgl. surat penolakan KUA", nilai: B.isoKeTampil(iso), keyakinan: "cukup", kalimat: surat.kalimat, asal: "posita-gugatan", catatan: "Tanggal surat penolakan sebagaimana tertulis di posita; cocokkan dengan suratnya.", kodePola: "u4-dk-0653-tgl-surat" })
      );
  }
  const lama = lamaKenal(posita);
  if (lama)
    hasil.push(
      B.butir({
        kode: "1666",
        nama: "Lama pacaran / saling mengenal",
        nilai: lama.nilai,
        keyakinan: "ragu",
        kalimat: lama.kalimat,
        asal: "posita-gugatan",
        catatan: "Lama saling mengenal menurut posita saat didaftarkan; di sidang anak biasanya menyebut waktu yang lebih panjang atau berbeda - sesuaikan dengan keterangan anak.",
        kodePola: "u4-dk-1666-lama",
      })
    );
  const erat = eratHubungan(posita);
  if (erat)
    hasil.push(
      B.butir({ kode: "1014", nama: "Eratnya hubungan calon", nilai: erat.nilai, keyakinan: "ragu", kalimat: erat.kalimat, asal: "posita-gugatan", catatan: "Disalin dari kalimat posita tentang hubungan kedua calon; ringkas sesuai selera blangko.", kodePola: "u4-dk-1014-erat" })
    );
  const { pria, wanita } = pasangan(d.mempelai);
  const tempat = (kode, nama, orang, yakin) => {
    const t = B.rapikanNama(orang && orang.tempat);
    if (!t || t.length < 3 || /^[-.\s]+$/.test(t)) return [];
    return [B.butir({ kode, nama, nilai: t, keyakinan: yakin, kalimat: `Tempat lahir calon mempelai di SIPP: ${t}`, catatan: "Dari data calon mempelai di SIPP; kadang berbeda dari tempat lahir di akta kelahiran/KTP (diukur: cocok 76% untuk pria, 87% untuk wanita) - cocokkan dengan akta kelahiran.", kodePola: `u4-dk-${kode}-tempat` })];
  };
  if (pria) {
    hasil.push(...tempat("0340", "Tempat lahir calon mempelai pria", pria, "ragu"));
    const tampil = B.isoKeTampil(pria.lahir);
    if (tampil)
      hasil.push(B.butir({ kode: "0348", nama: "Tanggal lahir calon mempelai pria", nilai: tampil, keyakinan: "cukup", kalimat: `Tanggal lahir calon mempelai pria di SIPP: ${B.isoKeIndonesia(pria.lahir)}`, catatan: "Dari data calon mempelai di SIPP; cocokkan dengan akta kelahiran.", kodePola: "u4-dk-0348-lahir" }));
  }
  if (wanita) hasil.push(...tempat("0344", "Tempat lahir calon mempelai wanita", wanita, "cukup"));
  return hasil;
}

module.exports = { usulanU4Dk, kuaPenolak, suratPenolakan, lamaKenal, eratHubungan };
