/**
 * Petunjuk isian jenis S6 (harta bersama, kewarisan, wasiat, hibah, wakaf, izin poligami, pembatalan/pencegahan perkawinan,
 * hak asuh/nafkah anak, Lain-Lain, ekonomi syariah) - SALINAN dari tabel MANUAL di
 * aleta_bot/services/isiOtomatisJenisS6.js (dibangun scripts/isi-sipp-abt/bangun-petunjuk-s6.cjs; uji isi-otomatis-s6-20okt
 * menjaga keduanya sama).
 *
 *   manual    isian yang tidak mungkin otomatis: tampil "diisi manual" dengan alasan di ikon keterangan
 *   opsional  isian yang boleh dikosongkan, dengan labelPengguna (kolom CORET, isian bawaan ABT, petunjuk majelis)
 *
 * Pengisi otomatis tetap menang bila menemukan nilai. Hanya MENAMBAH keterangan pada isian yang ada; tidak mengubah isian,
 * urutan, atau hitungan "perlu diisi".
 */

export type PetunjukIsianS6 = { manual: true; alasan: string; opsional?: true; labelPengguna?: string };

export const PETUNJUK_ISIAN_S6: Readonly<Record<string, PetunjukIsianS6>> = {
  "0182": { manual: true, alasan: "Tanggal izin kuasa insidentil tidak disimpan SIPP secara terstruktur." },
  "0183": { manual: true, alasan: "Tanggal izin kuasa insidentil Tergugat tidak disimpan SIPP secara terstruktur." },
  "0663": { manual: true, alasan: "Tanggal penetapan prodeo tidak disimpan SIPP; tertulis di penetapan prodeo." },
  "7178": { manual: true, alasan: "Penilaian hakim atas hasil panggilan (relaas). SIPP hanya mencatat hasil relaas, bukan penilaian patut atau tidaknya panggilan." },
  "8433": { manual: true, alasan: "Alasan pencabutan diucapkan Penggugat/Pemohon di sidang; SIPP hanya mencatat pencabutan karena mediasi berhasil (itu pun hanya bila hasil mediasinya tercatat)." },
  "8618": { manual: true, alasan: "Tempat lahir anak umumnya hanya tertulis di akta kelahiran (berkas e-Court); posita biasanya hanya menyebut tanggal lahirnya." },
  "8620": { manual: true, alasan: "Keterangan orang tua kandung diucapkan di persidangan; diketik panitera dari sidang." },
  "8712": { manual: true, alasan: "Surat teguran panitera tidak tercatat di SIPP; isi hanya bila perkara gugur karena panjar tidak ditambah, selain itu biarkan kosong.", opsional: true, labelPengguna: "Surat teguran panjar (isi hanya bila perkara gugur karena panjar tidak ditambah)" },
  "8713": { manual: true, alasan: "Batas waktu tertulis di surat teguran, bukan di SIPP; isi hanya bila perkara gugur karena panjar tidak ditambah.", opsional: true, labelPengguna: "Batas waktu menambah panjar (isi hanya bila perkara gugur karena panjar)" },
  "8714": { manual: true, alasan: "Laporan panitera tidak tercatat di SIPP; isi hanya bila perkara gugur karena panjar tidak ditambah.", opsional: true, labelPengguna: "Laporan panitera panjar tidak ditambah (isi hanya bila perkara gugur)" },
  "8726": { manual: true, alasan: "Izin atasan hanya untuk Pemohon PNS; nomor dan tanggalnya terbaca dari posita bila ditulis, selainnya diketik dari surat izin atasan.", opsional: true, labelPengguna: "SK izin atasan (hanya bila Pemohon PNS)" },
  "8894": { manual: true, alasan: "Kuasa insidentil tidak punya kolom sendiri di SIPP; nama penerima kuasa dan izin Ketua hanya ada di suratnya." },
  "8895": { manual: true, alasan: "Hubungan penerima kuasa insidentil dengan pemberi kuasa hanya tertulis di surat izin Ketua." },
  "8896": { manual: true, alasan: "Nomor izin Ketua Pengadilan untuk kuasa insidentil tidak disimpan SIPP secara terstruktur." },
  "9120": { manual: true, alasan: "Penilaian hakim atas sah tidaknya kuasa insidentil." },
  "9123": { manual: true, alasan: "Penilaian hakim atas sebab kuasa insidentil tidak sah." },
  "9125": { manual: true, alasan: "Penilaian hakim atas keadaan kuasa insidentil yang tidak sah." },
  "9134": { manual: true, alasan: "Petunjuk perbaikan permohonan diberikan majelis di sidang dan tidak ada di SIPP; kosong = titik-titik.", opsional: true, labelPengguna: "Petunjuk perbaikan permohonan dari majelis (bila ada)" },
  "9165": { manual: true, alasan: "Hasil pemeriksaan setempat hanya diketahui di lokasi sidang; diketik panitera." },
  "9166": { manual: true, alasan: "Aparat desa yang mendampingi dicatat panitera di lokasi sidang." },
  "9167": { manual: true, alasan: "Hasil pemeriksaan tiap objek diketik panitera dari pemeriksaan setempat." },
  "9168": { manual: true, alasan: "Tanggapan para pihak di lokasi dicatat panitera." },
  "9170": { manual: true, alasan: "Pokok jawaban istri diucapkan di sidang dan tidak ada di SIPP; kosong = menyetujui (bawaan ABT).", opsional: true, labelPengguna: "Pokok jawaban istri di persidangan (bila bukan menyetujui)" },
  "9171": { manual: true, alasan: "Keterangan calon istri kedua diucapkan di persidangan; diketik panitera dari sidang." },
  "9282": { manual: true, alasan: "Server mencari perkara cerai terdahulu kedua pihak di SIPP; isi hanya bila tidak ditemukan (mis. cerai di pengadilan lain): Pengadilan Agama X Nomor 12/Pdt.G/2024/PA.X tanggal 5 Maret 2024.", opsional: true, labelPengguna: "Putusan cerai para pihak (isi hanya bila server tidak menemukannya)" },
  "9309": { manual: true, alasan: "Penilaian hakim atas keadaan yang membuat pemegang hak asuh tidak dapat menjamin keselamatan anak." },
  "9310": { manual: true, alasan: "Pertimbangan hakim mengapa kepentingan terbaik anak tidak terpenuhi; bukan data perkara." },
  "9329": { manual: true, alasan: "Fakta alasan pembatalan yang terbukti di persidangan diputus majelis dari bukti dan saksi." },
  "9330": { manual: true, alasan: "Pertimbangan hakim menolak pembatalan; bukan data perkara." },
  "9346": { manual: true, alasan: "Pertimbangan hakim bahwa dalil wanprestasi tidak terbukti; bukan data perkara." },
  "9466": { manual: true, alasan: "Fakta alasan pencegahan yang terbukti diputus majelis dari bukti dan saksi." },
  "9467": { manual: true, alasan: "Pertimbangan hakim bahwa alasan pencegahan tidak terbukti." },
  "9468": { manual: true, alasan: "Pokok keterangan calon mempelai diucapkan di persidangan; diketik panitera." },
  "9469": { manual: true, alasan: "Waktu dan tempat perkawinan yang ternyata sudah dilangsungkan adalah fakta persidangan." },
  "9482": { manual: true, alasan: "Fakta pokok tuntutan yang terbukti diputus majelis dari bukti dan saksi." },
  "9483": { manual: true, alasan: "Pertimbangan hakim bahwa dalil gugatan tidak terbukti." },
  "9485": { manual: true, alasan: "Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak adalah penilaian hakim." },
  "9680": { manual: true, alasan: "Alasan Tergugat tidak menyetujui pencabutan diucapkan di sidang; diketik dari BAS." },
  "9682": { manual: true, alasan: "Alasan hakim bahwa perkara di luar kewenangan; putusan sela." },
  "9684": { manual: true, alasan: "Alasan hakim bahwa perkara termasuk kewenangan Pengadilan Agama; putusan sela." },
  "9685": { manual: true, alasan: "Isi eksepsi kewenangan yang diucapkan di sidang; diketik dari BAS." },
  "9750": { manual: true, alasan: "Alasan hakim menolak sebagian petitum nafkah; diputus majelis." },
  "9798": { manual: true, alasan: "Fakta pokok tuntutan hibah yang terbukti diputus majelis dari bukti dan saksi." },
  "9799": { manual: true, alasan: "Pertimbangan hakim bahwa dalil gugatan hibah tidak terbukti." },
  "9801": { manual: true, alasan: "Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak adalah penilaian hakim." },
  "9807": { manual: true, alasan: "Fakta hibah yang terbukti diputus majelis dari bukti dan saksi." },
  "9808": { manual: true, alasan: "Pertimbangan hakim bahwa dalil permohonan hibah tidak terbukti." },
  "9809": { manual: true, alasan: "Sebab permohonan hibah tidak dapat diterima adalah penilaian formil hakim." },
  "9828": { manual: true, alasan: "Fakta pokok tuntutan wakaf yang terbukti diputus majelis dari bukti dan saksi." },
  "9829": { manual: true, alasan: "Pertimbangan hakim bahwa dalil gugatan wakaf tidak terbukti." },
  "9831": { manual: true, alasan: "Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak adalah penilaian hakim." },
  "9837": { manual: true, alasan: "Fakta wakaf yang terbukti (ikrar sebelum 15 Desember 2006, belum terdaftar, dikuasai siapa) diputus majelis." },
  "9838": { manual: true, alasan: "Pertimbangan hakim bahwa dalil permohonan wakaf tidak terbukti." },
  "9839": { manual: true, alasan: "Sebab permohonan wakaf tidak dapat diterima adalah penilaian formil hakim." },
  "9868": { manual: true, alasan: "Pengumuman dicatat panitera dan tidak tersimpan terstruktur di SIPP; kosong = papan pengumuman 14 hari.", opsional: true, labelPengguna: "Cara dan jangka waktu pengumuman (bila berbeda dari bawaan)" },
  "9869": { manual: true, alasan: "Hasil pengumuman dicatat panitera; kosong = tidak ada yang memberi kabar.", opsional: true, labelPengguna: "Hasil pengumuman (bila ada yang memberi kabar)" },
  "9870": { manual: true, alasan: "Fakta mafqud yang terbukti diputus majelis dari bukti dan saksi." },
  "9871": { manual: true, alasan: "Pertimbangan hakim bahwa dalil permohonan mafqud tidak terbukti." },
  "9872": { manual: true, alasan: "Sebab permohonan mafqud tidak dapat diterima adalah penilaian formil hakim." },
  "9875": { manual: true, alasan: "Opsional; kosong = berlaku sejak penetapan diucapkan.", opsional: true, labelPengguna: "Tanggal berlaku mati secara hukum (bila bukan sejak penetapan diucapkan)" },
};

type IsianBerKode = { kode: string };

/**
 * Menempelkan petunjuk ke isian susunan blangko: manual + alasanManual, opsional + labelPengguna. Nilai yang sudah ada pada
 * isian (mis. dari pekerjaan lain) tidak ditimpa.
 */
export function terapkanPetunjukS6(susunan: { isian: IsianBerKode[] }): void {
  for (const b of susunan.isian as Array<IsianBerKode & Record<string, unknown>>) {
    const p = PETUNJUK_ISIAN_S6[b.kode];
    if (!p) continue;
    if (b.manual === undefined) {
      b.manual = true;
      if (!b.alasanManual) b.alasanManual = p.alasan;
    }
    if (p.opsional && b.opsional === undefined) {
      b.opsional = true;
      if (!b.labelPengguna) b.labelPengguna = p.labelPengguna;
    }
  }
}
