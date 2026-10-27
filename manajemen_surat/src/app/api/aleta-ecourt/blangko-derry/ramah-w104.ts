/**
 * ============================================================================
 * LABEL, PILIHAN DAN PENANDA "DIISI MANUAL" - PERKARA SELAIN CERAI (27 Okt 2026, agen w104)
 * ============================================================================
 *
 * Isian popup blangko Derry untuk itsbat nikah, dispensasi kawin, penetapan ahli waris, kewarisan, perwalian, asal usul anak,
 * wali adhal, harta bersama, izin poligami, pengangkatan anak, dan sejenisnya yang belum punya label bahasa mudah atau pilihan
 * bawaan. Isinya murni data (tanpa ekspresi) dan DIGABUNG ke tabel label susun.ts oleh `gabungRamahW104`:
 *
 *   - kode yang belum ada di tabel label -> ditambahkan utuh;
 *   - kode yang sudah punya label tetapi belum punya pilihan -> hanya pilihan/saran yang ditambahkan (label lama tetap);
 *   - kode yang sudah punya pilihan -> tidak diubah.
 *
 * Pilihan diambil dari isian petugas yang paling sering tersimpan di ABT (sipp_donggala + aps_badilag lokal, diukur 27 Okt 2026);
 * label memakai {P}/{T} (sebutan pihak perkara). Nama variabel ABT tidak diubah - ini hanya tampilan.
 */

export type RamahW104 = { nm: string; pil?: string[]; saran?: string };

export const RAMAH_W104: Record<string, RamahW104> = {
  // === Itsbat nikah / asal usul anak / wali adhal: status sebelum menikah ===
  "1002": {
    nm: "Status {P} sebelum menikah (jejaka, perawan, duda atau janda)",
    pil: ["Jejaka", "Perjaka", "Perawan", "Gadis", "Duda cerai hidup", "Duda cerai mati", "Janda cerai hidup", "Janda cerai mati"],
  },
  "1003": {
    nm: "Status pasangan {P} sebelum menikah (Pemohon II atau pihak lawan)",
    pil: ["Perawan", "Gadis", "Jejaka", "Perjaka", "Janda cerai hidup", "Janda cerai mati", "Duda cerai hidup", "Duda cerai mati"],
  },
  "8171": {
    nm: "Tujuan permohonan (kata sesudah \"untuk\", mis. mengurus buku nikah)",
    pil: [
      "pengurusan buku nikah dan keperluan lainnya",
      "mengurus buku nikah dan untuk kepentingan hukum lainnya",
      "penerbitan akta nikah para Pemohon serta keperluan lainnya",
      "pengurusan kelengkapan administrasi kependudukan dan keperluan lainnya",
    ],
  },
  "9958": { nm: "Alat bukti surat itsbat nikah (daftar bukti P.1 dst.; dibaca dari berkas e-Court)" },
  "0378": { nm: "Alat bukti surat itsbat nikah (daftar bukti P.1 dst.)" },
  "0652": { nm: "Nomor surat penolakan KUA" },
  "1108": { nm: "Nomor duplikat atau kutipan akta nikah" },

  // === Dispensasi kawin ===
  "0600": { nm: "Nama calon suami (pihak pria)" },
  "0606": { nm: "Nama calon istri (pihak wanita)" },
  "0601": { nm: "Umur calon suami" },
  "0607": { nm: "Umur calon istri" },
  "1551": { nm: "Nama ayah dari anak yang dimohonkan dispensasi (orang tua yang memberi keterangan)" },
  "1552": { nm: "Nama ibu dari anak yang dimohonkan dispensasi (istri dari ayah di atas)" },
  "2029": { nm: "Status calon suami sebelum menikah", pil: ["Jejaka", "Perjaka", "Bujang", "Duda cerai hidup", "Duda cerai mati"] },
  "2030": { nm: "Status calon istri sebelum menikah", pil: ["Perawan", "Gadis", "Janda cerai hidup", "Janda cerai mati"] },
  "0603": { nm: "Pendidikan terakhir calon suami", pil: ["Tidak sekolah", "Tidak tamat SD", "SD", "SLTP", "SLTA"] },
  "0609": { nm: "Pendidikan terakhir calon istri", pil: ["Tidak sekolah", "Tidak tamat SD", "SD", "SLTP", "SLTA"] },
  "0604": { nm: "Pekerjaan calon suami", pil: ["Belum bekerja", "Pelajar", "Petani", "Nelayan", "Buruh harian lepas", "Wiraswasta"] },
  "0610": { nm: "Pekerjaan calon istri", pil: ["Belum bekerja", "Pelajar", "Mengurus rumah tangga"] },
  "6331": {
    nm: "Pekerjaan beserta penghasilan rata-rata setiap bulan (mis. petani dengan penghasilan rata-rata Rp...)",
    pil: ["Petani", "Nelayan", "Buruh harian lepas", "Wiraswasta", "Karyawan swasta", "Mengurus rumah tangga"],
  },
  "1666": {
    nm: "Lama berpacaran atau saling mengenal",
    pil: ["1 (satu) tahun", "2 (dua) tahun", "3 (tiga) tahun", "6 (enam) bulan"],
  },
  "0999": { nm: "Usia kehamilan calon istri (mis. 12 (dua belas) minggu atau 5 (lima) bulan)" },
  "0997": { nm: "Puskesmas atau dokter yang menerbitkan surat keterangan hamil (mis. UPT Puskesmas ..., Kecamatan ...)" },
  "1014": {
    nm: "Eratnya hubungan calon suami dan calon istri",
    pil: ["telah saling mencintai dan sudah tidak dapat lagi dipisahkan", "telah sedemikian eratnya sehingga sulit dipisahkan"],
  },
  "9956": { nm: "Daftar bukti surat sesuai jenis perkara (dibaca dari berkas e-Court)" },
  "8812": { nm: "Tanggal ijazah calon pasangan (bila diajukan sebagai bukti)" },

  // === Wali adhal ===
  "1029": { nm: "Nama calon suami" },
  "1030": { nm: "Umur calon suami" },
  "6087": { nm: "Alasan wali nikah menolak menikahkan" },
  "9201": { nm: "Nama wali nasab yang enggan (diisi bila wali bukan ayah kandung)" },
  "9203": {
    nm: "Hubungan wali nasab dengan {P}",
    pil: ["ayah kandung", "kakek (ayah dari ayah)", "saudara laki-laki kandung", "saudara laki-laki seayah", "paman (saudara laki-laki ayah)"],
  },
  "9204": { nm: "Status calon suami sebelum menikah", pil: ["Jejaka", "Perjaka", "Duda cerai hidup", "Duda cerai mati"] },
  "9206": { nm: "Wilayah KUA tempat wali hakim bertugas (mis. Kecamatan ..., Kabupaten ...)" },
  "9135": { nm: "Alat bukti surat wali adhal (daftar bukti P.1 dst.; mis. KTP, KK, akta kelahiran, surat penolakan KUA)" },
  "9207": { nm: "Pokok keterangan wali nasab yang hadir di persidangan" },
  "9208": { nm: "Pertimbangan bahwa keengganan wali beralasan hukum (untuk putusan ditolak)" },

  // === Penetapan ahli waris / kewarisan ===
  "8614": { nm: "Harta peninggalan pewaris (satu objek per baris)" },
  "8608": { nm: "Nama ahli waris (satu per baris, nama lengkap dengan bin atau binti)" },
  "8610": { nm: "Nama suami atau istri pewaris" },
  "8613": { nm: "Keterangan meninggalnya suami atau istri pewaris (mis. pada tanggal ... di ...)" },
  "8132": { nm: "Alat bukti surat penetapan ahli waris (daftar bukti P.1 dst.; dibaca dari berkas e-Court)" },
  "8616": { nm: "Pengakuan {P} atas cacat permohonan" },
  "8617": { nm: "Uraian cacat formil permohonan (mis. tidak jelas atau kabur)" },
  "9700": { nm: "Dana yang dicairkan (jenis dana, lembaga atau bank, atas nama; satu frasa tanpa titik akhir)" },
  "9701": { nm: "Pasangan pewaris yang masih hidup (nama lengkap; beberapa nama dipisah titik koma)" },
  "9702": { nm: "Anak kandung pewaris (nama lengkap dengan bin atau binti; dipisah titik koma)" },
  "9703": { nm: "Ayah kandung pewaris yang masih hidup (nama lengkap)" },
  "9704": { nm: "Ibu kandung pewaris yang masih hidup (nama lengkap)" },
  "9718": { nm: "Saudara kandung atau seayah pewaris (nama lengkap dengan bin atau binti; bukan saudara seibu)" },
  "8717": { nm: "Ahli waris pewaris (satu per baris, nama lengkap dengan bin atau binti)" },
  "8718": { nm: "Harta peninggalan (tirkah) pewaris (satu objek per baris)" },
  "8719": { nm: "Bagian masing-masing ahli waris (mis. istri 1/8, anak laki-laki dan perempuan ashabah)" },

  // === Perwalian ===
  "0712": { nm: "Orang tua anak yang meninggal (ayah atau ibu)", pil: ["ayah", "ibu"] },
  "8131": { nm: "Alat bukti surat perwalian anak (daftar bukti P.1 dst.)" },

  // === Harta bersama dan sita ===
  "8706": { nm: "Dasar putusnya perkawinan (mis. Putusan Pengadilan Agama ... Nomor .../Pdt.G/.../PA... tanggal ...)" },
  "9282": { nm: "Putusan cerai para pihak (isi bila tidak ditemukan otomatis di SIPP)" },
  "8730": { nm: "Harta yang diperoleh selama perkawinan (satu objek per baris)" },
  "5032": { nm: "Harta bersama yang digugat (satu objek per baris)" },
  "9283": { nm: "Objek yang digugat dalam rekonvensi (satu objek per baris)" },
  "8704": { nm: "Isi kesepakatan perdamaian" },
  "9161": {
    nm: "Jenis sita yang dimohonkan",
    pil: ["sita jaminan (conservatoir beslag)", "sita marital (maritaal beslag)", "sita revindikasi (revindicatoir beslag)"],
  },
  "9165": { nm: "Lokasi pemeriksaan setempat (alamat objek sengketa)" },
  "9166": { nm: "Aparat desa atau kelurahan yang mendampingi pemeriksaan setempat (nama dan jabatan)" },
  "9167": { nm: "Hasil pemeriksaan setempat tiap objek (letak, luas, batas, bangunan di atasnya, yang menguasai; satu objek per baris)" },
  "9168": { nm: "Keterangan atau tanggapan para pihak di lokasi" },
  "9951": { nm: "Bukti elektronik {P} (mis. tangkapan layar percakapan WhatsApp, diberi tanda P.5; kosong = bagian ini dihapus)" },
  "9952": { nm: "Bukti elektronik {T} (mis. tangkapan layar percakapan WhatsApp, diberi tanda T.5; kosong = bagian ini dihapus)" },

  // === Izin poligami ===
  "8720": { nm: "Huruf alasan poligami (a, b atau c; boleh lebih dari satu)", pil: ["a", "b", "c", "a, b", "b, c"] },
  "8722": { nm: "Harta bersama {P} dan {T} yang ada (satu objek per baris; kosong = tidak ada)" },
  "8723": { nm: "Nama calon istri kedua" },
  "8724": { nm: "Identitas calon istri kedua (umur, pekerjaan, alamat)" },
  "8725": { nm: "Penghasilan {P} setiap bulan (mis. Rp9.000.000,00 (sembilan juta rupiah))" },
  "8726": { nm: "Izin atasan khusus PNS (nomor dan tanggal surat izin beristri lebih dari seorang)" },
  "9170": { nm: "Pokok jawaban istri {T} di persidangan (bawaan: menyetujui)" },
  "9171": { nm: "Pokok keterangan calon istri kedua di persidangan" },
  "1152": { nm: "Alasan {P} mengajukan izin poligami" },

  // === Pengangkatan anak / Lain-Lain ===
  "8618": { nm: "Tempat lahir anak yang akan diangkat" },
  "8619": { nm: "Nama orang tua kandung anak (mis. A bin B dan C binti D)" },
  "8620": { nm: "Keterangan orang tua kandung di persidangan (identitas dan butir keterangan)" },
  "8621": { nm: "Alat bukti surat pengangkatan anak (daftar bukti P.1 dst.)" },
  "8622": { nm: "Status perkawinan {P}", pil: ["suami istri", "seorang duda", "seorang janda", "belum menikah"] },
  "8623": {
    nm: "Hubungan {P} dengan calon anak angkat",
    pil: ["paman", "bibi", "kakek", "nenek", "saudara kandung", "tidak ada hubungan keluarga"],
  },

  // === Asal usul anak ===
  "8605": { nm: "Tempat dan tanggal pernikahan dicatat secara resmi (mis. di KUA Kecamatan ... pada tanggal ...)" },
  "8607": { nm: "Fakta tambahan keterangan saksi" },
  "9709": { nm: "Tempat dan tanggal lahir anak (mis. di Palu pada tanggal 1 Januari 2020)" },
  "9710": { nm: "Alasan anak belum mempunyai akta kelahiran (satu kalimat tanpa titik akhir)" },
};

type Dasar = Record<string, { nm: string; pil?: string[]; saran?: string; opsi?: Array<{ nilai: string; label: string }> }>;

/**
 * Menggabungkan RAMAH_W104 ke tabel label susun.ts tanpa menimpa yang sudah ada:
 * kode baru ditambah utuh; kode berlabel tanpa pilihan hanya diberi pilihan/saran.
 */
export function gabungRamahW104(dasar: Dasar): void {
  for (const [kode, baru] of Object.entries(RAMAH_W104)) {
    const lama = dasar[kode];
    if (!lama) {
      dasar[kode] = { ...baru };
      continue;
    }
    if (!lama.pil && baru.pil) dasar[kode] = { ...lama, pil: baru.pil, ...(lama.saran || !baru.saran ? {} : { saran: baru.saran }) };
  }
}
