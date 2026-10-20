"use strict";

/**
 * ============================================================================
 * PETUNJUK ISIAN JENIS S5 - "diisi manual" + alasan, opsional + label, dan syarat berlaku
 * ============================================================================
 *
 * Bukan nilai isian. Tiga macam keterangan tentang isian blangko Derry untuk dispensasi kawin, perwalian, asal usul anak, wali
 * adhal, dan penetapan ahli waris:
 *
 *   manual    : tidak mungkin diisi otomatis - penilaian hakim, pemeriksaan di persidangan, atau data yang tidak ada di SIPP/e-Court.
 *               Tampil sebagai "Diisi manual" dengan alasan di ikon ⓘ.
 *   opsional  : isian tambahan (bila ada) - tidak dihitung "Perlu diisi"; labelPengguna = nama yang dibaca petugas.
 *   syarat    : isian hanya berlaku pada keadaan tertentu (varian blangko); di luar keadaan itu tidak dihitung kosong.
 *
 * Salinan data untuk tampilan portal ada di manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/petunjuk-s5.ts; uji
 * isi-otomatis-s5-20okt.test.ts menjaga keduanya sama.
 */

const perwalian = require("./perwalian");
const ahliWaris = require("./ahliWaris");
const B = require("./bantu");

/** Kode -> keterangan. alasan/labelPengguna ditulis dalam bahasa petugas, tanpa istilah teknis. */
const METADATA = Object.freeze({
  // --- tidak mungkin otomatis ---
  "0663": { manual: true, alasan: "Tanggal penetapan prodeo tidak disimpan SIPP; lihat penetapan prodeo dari Ketua." },
  "8812": { manual: true, alasan: "Tanggal ijazah hanya tertulis pada fotokopi ijazah di berkas bukti; tidak ada di SIPP." },
  "1552": { manual: true, alasan: "Nama ibu calon pasangan tidak tercatat di SIPP dan jarang disebut di posita; ambil dari keterangan Pemohon." },
  "8131": { manual: true, alasan: "Daftar alat bukti (P.1 dst.) disusun dari bukti yang diajukan dan diperiksa di persidangan; tidak ada di SIPP." },
  "8132": { manual: true, alasan: "Daftar alat bukti (P.1 dst.) disusun dari bukti yang diajukan dan diperiksa di persidangan; tidak ada di SIPP." },
  "9135": { manual: true, alasan: "Daftar alat bukti surat (P.1 dst.) disusun dari bukti yang diajukan dan diperiksa di persidangan; tidak ada di SIPP." },
  "8433": { manual: true, alasan: "Alasan pencabutan diketik hakim dari surat pencabutan atau keterangan di sidang; SIPP hanya menyimpannya bila pencabutan karena mediasi (sudah terisi sendiri)." },
  "8616": { manual: true, alasan: "Pengakuan Pemohon atas cacat permohonan adalah keterangan Pemohon di sidang; diketik dari berita acara." },
  "8617": { manual: true, alasan: "Uraian cacat formil permohonan adalah penilaian hakim; tidak ada di SIPP." },
  "9207": { manual: true, alasan: "Pokok keterangan wali nasab yang hadir adalah hasil pemeriksaan di sidang; diketik dari berita acara." },
  "9208": { manual: true, alasan: "Pertimbangan bahwa keengganan wali beralasan hukum adalah penilaian hakim; tidak ada di SIPP." },
  "8607": { manual: true, alasan: "Fakta tambahan dari keterangan saksi diketik dari berita acara sidang; tidak ada di SIPP." },
  "8706": { manual: true, alasan: "Dasar putusnya perkawinan (cerai atau kematian) dipastikan hakim dari akta yang dibuktikan di sidang." },
  "9762": { manual: true, alasan: "Ahli waris pengganti (cucu pewaris) ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9763": { manual: true, alasan: "Cucu pewaris pengganti ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9764": { manual: true, alasan: "Kakek pewaris ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9765": { manual: true, alasan: "Nenek dari pihak ibu ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9766": { manual: true, alasan: "Nenek dari pihak ayah ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9767": { manual: true, alasan: "Saudara seibu pewaris ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "1154": { manual: true, alasan: "Nomor surat permintaan bantuan panggilan adalah nomor surat keluar kepaniteraan; belum dicatat terstruktur di SIPP." },
  "1232": { manual: true, alasan: "Tanggal surat permintaan bantuan panggilan adalah tanggal surat keluar kepaniteraan; belum dicatat terstruktur di SIPP." },
  "5230": { manual: true, alasan: "Ongkos panggilan permintaan bantuan ditetapkan Panitera untuk perkara itu; SIPP tidak menyimpan biaya bantuan panggilan." },
  "9710": { manual: true, alasan: "Alasan anak belum punya akta kelahiran hanya tertulis bila posita menyebutnya; selainnya diketik dari keterangan Pemohon." },
  "9771": { manual: true, alasan: "Alasan mendesak yang dikemukakan Pemohon diambil dari posita bila ada kalimatnya; selainnya diketik dari keterangan Pemohon." },
  "1551": { manual: true, alasan: "Nama ayah calon pasangan hanya terbaca bila posita menyebutnya; selainnya diketik dari keterangan Pemohon." },
  "0997": { manual: true, alasan: "Nama puskesmas tertulis di surat keterangan kehamilan yang diajukan; terbaca dari posita hanya bila posita menyebutnya." },
  "1509": { manual: true, alasan: "Tempat meninggal tertulis di akta/surat kematian; posita jarang menyebutnya dan SIPP tidak menyimpannya." },
  "8613": { manual: true, alasan: "Hanya bila pasangan pewaris sudah meninggal lebih dulu; tanggal, tempat dan sebabnya dari akta kematian pasangan." },
  "9204": { manual: true, alasan: "Status calon suami (jejaka atau duda) diketahui dari keterangan di sidang; tidak ada di SIPP maupun posita." },
  // --- opsional ---
  "8712": { opsional: true, labelPengguna: "Surat teguran Panitera untuk menambah panjar (bila ada)" },
  "8713": { opsional: true, labelPengguna: "Batas waktu menambah panjar menurut surat teguran (bila ada)" },
  "8714": { opsional: true, labelPengguna: "Surat keterangan Panitera bahwa panjar tidak ditambah (bila ada)" },
  "9134": { opsional: true, labelPengguna: "Petunjuk perbaikan permohonan dari majelis (bila ada)" },
});

/**
 * Syarat berlaku: fungsi (data) -> boolean. false = isian ini tidak dipakai pada perkara itu (varian blangko lain) dan tidak
 * dihitung kosong. true / tidak ada = berlaku. `data` = keluaran bacaData.
 */
const SYARAT = Object.freeze({
  // Perwalian oleh orang tua yang masih hidup: ibu/bapak kandung. Perwalian oleh saudara/paman/kakek memakai varian lain.
  "0709": (d) => perwalian.pemohonOrangTua(d.perkara.posita) !== false,
  "0712": (d) => perwalian.pemohonOrangTua(d.perkara.posita) !== false,
  "1230": (d) => perwalian.pemohonOrangTua(d.perkara.posita) !== false,
  // Dispensasi kawin karena kehamilan: puskesmas dan umur kandungan.
  "0997": (d) => hamil(d),
  "0999": (d) => hamil(d),
  // Susunan ahli waris "kosong bila tidak ada": bila daftar ahli waris terbaca penuh dan golongan itu tidak ada, mengosongkannya sudah benar.
  "9701": (d) => !ahliWaris.golonganTiada(d).pasangan,
  "9703": (d) => !ahliWaris.golonganTiada(d).ayah,
  "9704": (d) => !ahliWaris.golonganTiada(d).ibu,
  "9718": (d) => !ahliWaris.golonganTiada(d).saudara,
  // Asal usul: varian "belum punya akta kelahiran" hanya bila posita menyebutnya.
  "9709": (d) => /\bbelum\s+(?:memiliki|mempunyai|punya)\s+akta\s+kelahiran\b/i.test(B.polos(d.perkara.posita)),
  // Pernikahan pewaris / orang tua anak: isian tempat, KUA dan tanggal nikah hanya berarti bila posita memang menceritakan pernikahannya.
  "5105": (d) => ceritaNikah(d),
  "5178": (d) => ceritaNikah(d),
  "5197": (d) => ceritaNikah(d),
  // Wali adhal: nama wali nasab hanya diisi bila yang enggan BUKAN ayah kandung (petunjuk variabelnya).
  "9201": (d) => !/\bayah\s+kandung\s+Pemohon\b/i.test(B.polos(d.perkara.posita)),
});

/** Posita menceritakan pernikahan ("telah melangsungkan perkawinan/pernikahan", "telah menikah pada tanggal")? */
function ceritaNikah(d) {
  if (Number(d.perkara.jenisId) === 358 || Number(d.perkara.jenisId) === 362) return true;
  return /\b(?:melangsungkan\s+(?:perkawinan|pernikahan)|telah\s+menikah|menikah\s+(?:secara|dengan|pada)|perkawinan\s+tersebut|pernikahan\s+tersebut)\b/i.test(B.polos(d.perkara.posita));
}

/** Perkara dispensasi kawin karena hamil: alasan di SIPP (alasan_id 1) atau posita menyebut hamil. */
function hamil(d) {
  if ((d.alasanNikah || []).some((a) => Number(a.alasanId) === 1)) return true;
  return /\bhamil\b/i.test(B.polos(d.perkara.posita));
}

/** Bagian METADATA yang tampil di portal: {manual, alasan, opsional, labelPengguna}. */
function untukTampilan() {
  return Object.fromEntries(Object.entries(METADATA).map(([k, v]) => [k, { ...v }]));
}

module.exports = { METADATA, SYARAT, hamil, untukTampilan };
