/**
 * Petunjuk isian jenis S5 (dispensasi kawin, perwalian, asal usul anak, wali adhal, penetapan ahli waris) - SALINAN dari
 * aleta_bot/services/isiOtomatisS5/metadata.js (dibangun scripts/isi-sipp-abt/bangun-petunjuk-s5.cjs; uji isi-otomatis-s5-20okt
 * menjaga keduanya sama).
 *
 *   manual    isian yang tidak mungkin otomatis: tampil "diisi manual" dengan alasan di ikon keterangan
 *   opsional  isian tambahan (bila ada) dengan labelPengguna
 *
 * Hanya MENAMBAH keterangan pada isian yang ada; tidak mengubah isian, urutan, atau hitungan "perlu diisi".
 */

export type PetunjukIsian = { manual?: true; alasan?: string; opsional?: true; labelPengguna?: string };

export const PETUNJUK_ISIAN_S5: Readonly<Record<string, PetunjukIsian>> = {
  "0663": { manual: true, alasan: "Tanggal penetapan prodeo tidak disimpan SIPP; lihat penetapan prodeo dari Ketua." },
  "0997": { manual: true, alasan: "Nama puskesmas tertulis di surat keterangan kehamilan yang diajukan; terbaca dari posita hanya bila posita menyebutnya." },
  "1154": { manual: true, alasan: "Nomor surat permintaan bantuan panggilan adalah nomor surat keluar kepaniteraan; belum dicatat terstruktur di SIPP." },
  "1232": { manual: true, alasan: "Tanggal surat permintaan bantuan panggilan adalah tanggal surat keluar kepaniteraan; belum dicatat terstruktur di SIPP." },
  "1509": { manual: true, alasan: "Tempat meninggal tertulis di akta/surat kematian; posita jarang menyebutnya dan SIPP tidak menyimpannya." },
  "1551": { manual: true, alasan: "Nama ayah calon pasangan hanya terbaca bila posita menyebutnya; selainnya diketik dari keterangan Pemohon." },
  "1552": { manual: true, alasan: "Nama ibu calon pasangan tidak tercatat di SIPP dan jarang disebut di posita; ambil dari keterangan Pemohon." },
  "4500": { opsional: true, labelPengguna: "Tujuan permohonan bila bukan pencairan dana (bila ada)" },
  "4502": { opsional: true, labelPengguna: "Anak angkat Pewaris (bila ada)" },
  "4505": { opsional: true, labelPengguna: "Sikap terhadap anak angkat: wasiat wajibah dalam amar (pilihan hakim, bila ada anak angkat)" },
  "4507": { opsional: true, labelPengguna: "Wasiat Pewaris (bila ada)" },
  "4510": { opsional: true, labelPengguna: "Kerabat Pewaris yang tidak beragama Islam (bila ada)" },
  "4513": { opsional: true, labelPengguna: "Keadaan perkawinan Pewaris bila berpisah atau sudah bercerai (pilihan hakim, bila ada)" },
  "4515": { opsional: true, labelPengguna: "Bagian masing-masing ahli waris (usulan hitungan, keputusan hakim; bila ada)" },
  "4520": { opsional: true, labelPengguna: "Harta peninggalan yang diperoleh selama perkawinan / harta bersama (bila ada)" },
  "4534": { opsional: true, labelPengguna: "Batasi penggunaan penetapan hanya untuk tujuan permohonan (pilihan hakim, bila ada)" },
  "4540": { opsional: true, labelPengguna: "Saudara Pewaris yang meninggal lebih dahulu dan digantikan anaknya (bila ada)" },
  "4541": { opsional: true, labelPengguna: "Anak dari saudara Pewaris yang meninggal lebih dahulu / ahli waris pengganti (bila ada)" },
  "5230": { manual: true, alasan: "Ongkos panggilan permintaan bantuan ditetapkan Panitera untuk perkara itu; SIPP tidak menyimpan biaya bantuan panggilan." },
  "8131": { manual: true, alasan: "Daftar alat bukti (P.1 dst.) disusun dari bukti yang diajukan dan diperiksa di persidangan; tidak ada di SIPP." },
  "8132": { manual: true, alasan: "Daftar alat bukti (P.1 dst.) disusun dari bukti yang diajukan dan diperiksa di persidangan; tidak ada di SIPP." },
  "8433": { manual: true, alasan: "Alasan pencabutan diketik hakim dari surat pencabutan atau keterangan di sidang; SIPP hanya menyimpannya bila pencabutan karena mediasi (sudah terisi sendiri)." },
  "8607": { manual: true, alasan: "Fakta tambahan dari keterangan saksi diketik dari berita acara sidang; tidak ada di SIPP." },
  "8613": { manual: true, alasan: "Hanya bila pasangan pewaris sudah meninggal lebih dulu; tanggal, tempat dan sebabnya dari akta kematian pasangan." },
  "8616": { manual: true, alasan: "Pengakuan Pemohon atas cacat permohonan adalah keterangan Pemohon di sidang; diketik dari berita acara." },
  "8617": { manual: true, alasan: "Uraian cacat formil permohonan adalah penilaian hakim; tidak ada di SIPP." },
  "8706": { manual: true, alasan: "Dasar putusnya perkawinan (cerai atau kematian) dipastikan hakim dari akta yang dibuktikan di sidang." },
  "8712": { opsional: true, labelPengguna: "Surat teguran Panitera untuk menambah panjar (bila ada)" },
  "8713": { opsional: true, labelPengguna: "Batas waktu menambah panjar menurut surat teguran (bila ada)" },
  "8714": { opsional: true, labelPengguna: "Surat keterangan Panitera bahwa panjar tidak ditambah (bila ada)" },
  "8812": { manual: true, alasan: "Tanggal ijazah hanya tertulis pada fotokopi ijazah di berkas bukti; tidak ada di SIPP." },
  "9134": { opsional: true, labelPengguna: "Petunjuk perbaikan permohonan dari majelis (bila ada)" },
  "9135": { manual: true, alasan: "Daftar alat bukti surat (P.1 dst.) disusun dari bukti yang diajukan dan diperiksa di persidangan; tidak ada di SIPP." },
  "9204": { manual: true, alasan: "Status calon suami (jejaka atau duda) diketahui dari keterangan di sidang; tidak ada di SIPP maupun posita." },
  "9207": { manual: true, alasan: "Pokok keterangan wali nasab yang hadir adalah hasil pemeriksaan di sidang; diketik dari berita acara." },
  "9208": { manual: true, alasan: "Pertimbangan bahwa keengganan wali beralasan hukum adalah penilaian hakim; tidak ada di SIPP." },
  "9710": { manual: true, alasan: "Alasan anak belum punya akta kelahiran hanya tertulis bila posita menyebutnya; selainnya diketik dari keterangan Pemohon." },
  "9762": { manual: true, alasan: "Ahli waris pengganti (cucu pewaris) ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9763": { manual: true, alasan: "Cucu pewaris pengganti ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9764": { manual: true, alasan: "Kakek pewaris ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9765": { manual: true, alasan: "Nenek dari pihak ibu ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9766": { manual: true, alasan: "Nenek dari pihak ayah ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9767": { manual: true, alasan: "Saudara seibu pewaris ditentukan hakim dari susunan keluarga dan bukti; jarang dan tidak ada di SIPP." },
  "9771": { manual: true, alasan: "Alasan mendesak yang dikemukakan Pemohon diambil dari posita bila ada kalimatnya; selainnya diketik dari keterangan Pemohon." },
};

type IsianBerKode = { kode: string };

/**
 * Menempelkan petunjuk ke isian susunan blangko: manual + alasanManual, opsional + labelPengguna. Nilai yang sudah ada pada
 * isian (mis. dari pekerjaan lain) tidak ditimpa.
 */
export function terapkanPetunjukS5(susunan: { isian: IsianBerKode[] }): void {
  for (const b of susunan.isian as Array<IsianBerKode & Record<string, unknown>>) {
    const p = PETUNJUK_ISIAN_S5[b.kode];
    if (!p) continue;
    if (p.manual && b.manual === undefined) {
      b.manual = true;
      if (!b.alasanManual) b.alasanManual = p.alasan;
    }
    if (p.opsional && b.opsional === undefined) {
      b.opsional = true;
      if (!b.labelPengguna) b.labelPengguna = p.labelPengguna;
    }
  }
}
