/**
 * Kait awal Next.js - dijalankan SEKALI saat server portal berdiri.
 *
 * Isinya: detak penjadwal Sinkron & cadangan (butir 29/30, 30 September 2026)
 * dan penyelarasan lapis kamus deteksi ke bot (10 Oktober 2026). Hanya di
 * runtime Node (bukan edge), tidak saat uji. Penjadwal sinkron dapat
 * dimatikan dengan ALETA_SINKRON_PENJADWAL=0 - misalnya bila host memilih
 * memicu lewat cron (scripts/aleta-sinkron-cron.sh); penyelarasan kamus
 * dengan ALETA_KAMUS_DETEKSI_DORONG=0.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "test") return;
  /* === KAMUS-DB 10 Okt === bot tidak memanggil portal - lapis kamus didorong dari sini. */
  if (process.env.ALETA_KAMUS_DETEKSI_DORONG !== "0") {
    const [{ mulaiSelarasBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/aleta-ecourt/kamus-deteksi"),
      import("@/server/db/client"),
    ]);
    mulaiSelarasBerkala(getDatabase);
  }
  /* === AKHIR KAMUS-DB === */
  /* === KTP-PIHAK 12 Okt === penyapu latar tanggal KTP pihak. Sejak butir 11 detaknya SELALU berdiri dan
     membaca pengaturan layar Admin (menang atas env ALETA_KTP_PIHAK_LATAR/BATAS/JEDA_MS) tiap 30 detik,
     jadi menyalakan/mematikan/mengubah jeda dari Integrasi e-Court berlaku tanpa restart. */
  {
    const [{ mulaiPindaiKtpBerkala }, { sumberPengaturanKtp }] = await Promise.all([
      import("@/server/modules/aleta-ecourt/ktp-pihak"),
      import("@/server/modules/aleta-ecourt/ktp-pihak-pengaturan"),
    ]);
    mulaiPindaiKtpBerkala(undefined, process.env, sumberPengaturanKtp);
  }
  /* === AKHIR KTP-PIHAK === */
  /* === OCR-ECOURT 19 Okt === penyapu latar lampiran e-Court (KK, akta, surat keterangan, surat kuasa): satu berkas
     per putaran, jeda bawaan 180 detik, tidak bertumpuk dengan penyapu KTP. Matikan dengan ALETA_LAMPIRAN_LATAR=0. */
  {
    const { mulaiPindaiLampiranBerkala } = await import("@/server/modules/aleta-ecourt/lampiran-ecourt");
    mulaiPindaiLampiranBerkala();
  }
  /* === AKHIR OCR-ECOURT === */
  /* === AGEN H-7 17 Okt (F4.2) === draf putusan untuk Hari Putusan tujuh hari lagi, sekali sehari (bawaan 06.00 WITA,
     ALETA_AGEN_H7_JAM); hanya membaca SIPP/ABT, menulis basis data ALETA. Matikan dengan ALETA_AGEN_H7=0;
     perkiraan putusan verstek (sidang ke-2+, Tergugat belum pernah hadir) dimatikan dengan ALETA_AGEN_H7_VERSTEK=0. */
  if (process.env.ALETA_AGEN_H7 !== "0") {
    const [{ mulaiAgenH7Berkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/aleta-ecourt/agen-h7-putusan"),
      import("@/server/db/client"),
    ]);
    mulaiAgenH7Berkala(getDatabase);
  }
  /* === AKHIR AGEN H-7 === */
  /* === PENGUKUR DRAF 1 Nov (P3) === draf putusan A1 dibandingkan dengan putusan akhir begitu putusan masuk (jam kerja, tiap 30 menit)
     dan sekali tiap malam sesudah 22.30 WITA; hanya membaca SIPP lewat bot, menulis basis data ALETA (0130). Tanpa AI. Matikan
     dengan ALETA_PENGUKUR_DRAF=0. */
  if (process.env.ALETA_PENGUKUR_DRAF !== "0") {
    const [{ mulaiPengukurDrafBerkala }, { DEPS_PENGUKUR_BAWAAN }, { getDatabase }] = await Promise.all([
      import("@/server/modules/aleta-ecourt/pengukur-draf"),
      import("@/server/modules/aleta-ecourt/pengukur-draf-bawaan"),
      import("@/server/db/client"),
    ]);
    mulaiPengukurDrafBerkala(getDatabase, DEPS_PENGUKUR_BAWAAN);
  }
  /* === AKHIR PENGUKUR DRAF === */
  /* === AGEN H-1 BAS 30 Okt (G2a 2.4) === BAS sidang hari kerja berikutnya disiapkan tiap sore hari kerja (bawaan 15.30 WITA,
     ALETA_AGEN_H1_JAM): blangko BAS Derry menurut agenda + keadaan tanya jawab saksi; draf di memori portal, hanya membaca
     SIPP/ABT. Matikan dengan ALETA_AGEN_H1=0. */
  if (process.env.ALETA_AGEN_H1 !== "0") {
    const { mulaiAgenH1Berkala } = await import("@/server/modules/aleta-ecourt/agen-h1-bas");
    mulaiAgenH1Berkala();
  }
  /* === AKHIR AGEN H-1 BAS === */
  /* === AGEN KELENGKAPAN HARI SIDANG 1 Nov (N1) === tiap pagi hari kerja (bawaan 07.00 WITA, diatur di setelan) perkara yang bersidang
     hari ini dan hari kerja berikutnya diperiksa kelengkapannya (relaas, BAS lalu, saksi, e-Court, panjar, mediasi, kuasa); hasil
     tersimpan di basis data portal untuk lencana Jadwal Sidang dan lonceng; kabar WhatsApp bersaklar (bawaan MATI). Hanya membaca
     SIPP/ABT. Matikan dengan ALETA_AGEN_KELENGKAPAN=0. */
  if (process.env.ALETA_AGEN_KELENGKAPAN !== "0") {
    const [{ mulaiKelengkapanBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/aleta-ecourt/agen-kelengkapan"),
      import("@/server/db/client"),
    ]);
    mulaiKelengkapanBerkala(getDatabase);
  }
  /* === AKHIR AGEN KELENGKAPAN === */
  /* === CERMIN PERKARA 25 Okt (C0) === pemindai awal keadaan perkara SIPP ke basis data ALETA: berkelompok, hanya di jendela
     malam (bawaan 18.00-06.30 WITA), bisa dilanjutkan, hanya MEMBACA SIPP lewat bot. Saklar pemindai MATI bawaan (layar Pemantau
     Cermin Perkara, dibaca tiap detak); saat mati detak tidak menembak bot sama sekali. Matikan detaknya dengan ALETA_CERMIN_PEMINDAI=0. */
  if (process.env.ALETA_CERMIN_PEMINDAI !== "0") {
    const { mulaiCerminBerkala } = await import("@/server/modules/cermin/berkala");
    mulaiCerminBerkala();
  }
  /* === AKHIR CERMIN PERKARA === */
  /* === PUTUSAN TERJADWAL 21 Okt (B3) === pelaksana server unggah putusan terjadwal: tiap 30 detik mengerjakan paling
     banyak SATU butir e-Doc (putusan + anonimisasi) yang jatuh tempo, di dalam jendela jam kerja jadwalnya, atas akun
     SIPP penjadwal, lewat jalur tulis unggah-sipp yang sudah ada. Pengisian Putusan Akhir TIDAK dikerjakan di sini
     (ekstensi di peramban). Matikan dengan ALETA_PUTUSAN_TERJADWAL=0 atau saklar di pengaturan layar. */
  if (process.env.ALETA_PUTUSAN_TERJADWAL !== "0") {
    const { mulaiPelaksanaBerkala } = await import("@/server/modules/putusan-terjadwal/pelaksana");
    mulaiPelaksanaBerkala();
  }
  /* === AKHIR PUTUSAN TERJADWAL === */
  /* === SALINAN BHT 30 Okt === detak 30 menit: mencatat perkara yang baru BHT menurut SIPP (bot membaca) agar salinan putusannya
     muncul di Cetak massal "Salinan putusan BHT". Hanya penunjuk perkara; tidak menulis ke SIPP/ABT. Matikan dengan ALETA_SALINAN_BHT=0. */
  if (process.env.ALETA_SALINAN_BHT !== "0") {
    const [{ mulaiSalinanBhtBerkala }, { getDatabase }] = await Promise.all([import("@/server/modules/aleta-ecourt/salinan-bht"), import("@/server/db/client")]);
    mulaiSalinanBhtBerkala(getDatabase);
  }
  /* === AKHIR SALINAN BHT === */
  /* === SIDANG TERJADWAL 27 Okt === pelaksana server unggah BAS terjadwal & tundaan terjadwal: tiap 30 detik menulis ke SIPP
     (lewat bot) paling banyak SATU pekerjaan yang jatuh tempo - BAS di dalam jam kerja atas akun SIPP penjadwal, tunda
     hanya pada hari sidangnya (yang terlambat kedaluwarsa, tidak pernah pindah hari). Hak penjadwal dinilai ulang saat
     dijalankan. Matikan dengan ALETA_SIDANG_TERJADWAL=0. */
  if (process.env.ALETA_SIDANG_TERJADWAL !== "0") {
    const { mulaiPelaksanaBerkala } = await import("@/server/modules/sidang-terjadwal/pelaksana");
    mulaiPelaksanaBerkala();
  }
  /* === AKHIR SIDANG TERJADWAL === */
  /* === TUNDA OTOMATIS 22 Okt === detak 5 menit; jalan SEKALI per tanggal pada jam pemicu (16.30 WITA, 14.00 pada hari
     sidang keliling aktif) HANYA bila saklar Super Admin menyala (bawaan MATI, mode kering). Menulis ke SIPP hanya lewat
     penulis tunda yang ada (bot, akun PP, antrean jam kerja). Matikan seluruhnya dengan ALETA_TUNDA_OTOMATIS=0. */
  if (process.env.ALETA_TUNDA_OTOMATIS !== "0") {
    const [{ mulaiTundaOtomatisBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/tunda-otomatis/layanan"),
      import("@/server/db/client"),
    ]);
    mulaiTundaOtomatisBerkala(getDatabase);
  }
  /* === AKHIR TUNDA OTOMATIS === */
  /* === PUTUS OTOMATIS 22 Okt === gugur / tidak dapat diterima: saklar TERPISAH (bawaan MATI, mode kering, Super Admin);
     pagi hari menyusun calon + pemberitahuan, jam pemicu (16.30 / 14.00 keliling) mencatat keterangan putus lewat penulis
     putus yang ada dan (sub-pilihan) menjadwalkan e-Doc. Matikan seluruhnya dengan ALETA_PUTUS_OTOMATIS=0. */
  if (process.env.ALETA_PUTUS_OTOMATIS !== "0") {
    const [{ mulaiPutusOtomatisBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/putus-otomatis/layanan"),
      import("@/server/db/client"),
    ]);
    mulaiPutusOtomatisBerkala(getDatabase);
  }
  /* === AKHIR PUTUS OTOMATIS === */
  /* === ALETA Ai REKONSILIASI 24 Okt (T10) === detak 5 menit; SEKALI per tanggal memeriksa kemarin pada jam pemicu
     (bawaan 01.00 WITA, diatur Super Admin; saklar bawaan MENYALA) dan sekali saat server menyala bila kemarin belum
     diperiksa. Hanya membaca; selisih tampil di lonceng Super Admin. Matikan seluruhnya dengan ALETA_AI_REKONSILIASI=0. */
  if (process.env.ALETA_AI_REKONSILIASI !== "0") {
    const [{ mulaiRekonsiliasiBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/aleta-ai/rekonsiliasi"),
      import("@/server/db/client"),
    ]);
    mulaiRekonsiliasiBerkala(getDatabase);
  }
  /* === AKHIR ALETA Ai REKONSILIASI === */
  /* === PENJAGA TENGGAT TERJADWAL 25 Okt (G1) === detak 5 menit; jalan SEKALI per hari kerja pada jam pemicu (bawaan 07.30 WITA)
     HANYA bila saklar jadwal Super Admin menyala (bawaan MATI: tidak ada pembacaan SIPP sama sekali). Hanya MEMBACA SIPP lewat bot;
     pengingat WhatsApp pribadi punya saklar terpisah (bawaan MATI). Matikan seluruhnya dengan ALETA_PENJAGA_TENGGAT=0. */
  if (process.env.ALETA_PENJAGA_TENGGAT !== "0") {
    const [{ mulaiTenggatBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/penjaga-tenggat/layanan"),
      import("@/server/db/client"),
    ]);
    mulaiTenggatBerkala(getDatabase);
  }
  /* === AKHIR PENJAGA TENGGAT TERJADWAL === */
  /* === PENCOCOK DATA SIPP-ABT-e-COURT 1 Nov (N3) === detak 5 menit; putaran SEKALI per tanggal WITA sesudah jam pemicu (bawaan 22.30).
     HANYA MEMBACA (SIPP, ABT, e-Court lewat bot) dan menandai; saklar jadwal Super Admin bawaan menyala. Matikan dengan ALETA_PENCOCOK=0. */
  if (process.env.ALETA_PENCOCOK !== "0") {
    const [{ mulaiPencocokBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/pencocok/layanan"),
      import("@/server/db/client"),
    ]);
    mulaiPencocokBerkala(getDatabase);
  }
  /* === AKHIR PENCOCOK DATA === */
  /* === KAIT KEAMANAN 26 Okt (gabung rantai E + Bagian 6) === mengisi kait keamanan/kait.ts: langkah kedua pengaman aksi admin
     (authenticator E5) dan laporan uji pulih gagal ke Catatan error Pusat kesehatan (E2). Tidak mengubah bawaan: saklar
     authenticator, saklar langkah kedua, dan saklar uji pulih tetap MATI sampai Super Admin menyalakannya. */
  {
    const { sambungkanKaitKeamananAman } = await import("@/server/modules/keamanan/sambung-kait");
    sambungkanKaitKeamananAman();
  }
  /* === AKHIR KAIT KEAMANAN === */
  /* === UJI PULIH CADANGAN 25 Okt (Bagian 6d) === detak 5 menit; jalan SEKALI per minggu (bawaan Minggu 03.00 WITA, sesudah
     pencocokan Cermin 02.00) HANYA bila saklar Super Admin menyala (bawaan MATI). Memulihkan cadangan ALETA terbaru ke basis data
     SEMENTARA aleta_ujipulih_*, memeriksa, lalu menghapusnya - tidak pernah menyentuh basis data produksi. Matikan seluruhnya
     dengan ALETA_UJI_PULIH=0. */
  if (process.env.ALETA_UJI_PULIH !== "0") {
    const [{ mulaiUjiPulihBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/keamanan/uji-pulih"),
      import("@/server/db/client"),
    ]);
    mulaiUjiPulihBerkala(getDatabase);
  }
  /* === AKHIR UJI PULIH CADANGAN === */
  /* === PUSAT KESEHATAN 25 Okt (E2) === detak 60 detik; BARU bekerja bila Super Admin menyalakan "pemeriksaan berkala"
     (saklar MATI bawaan): memeriksa semua komponen, mencatat riwayat, dan - bila saklar WhatsApp juga menyala - memberi
     tahu admin saat komponen MERAH dua pemeriksaan berturut-turut. Hanya membaca. Matikan seluruhnya dengan
     ALETA_KESEHATAN_BERKALA=0. */
  if (process.env.ALETA_KESEHATAN_BERKALA !== "0") {
    const [{ mulaiKesehatanBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/kesehatan/layanan"),
      import("@/server/db/client"),
    ]);
    mulaiKesehatanBerkala(getDatabase);
  }
  /* === AKHIR PUSAT KESEHATAN === */
  /* === PENJAGA SERVER 1 Nov (N4) === putaran 5 menit (mulai 2 menit sesudah menyala): memantau ruang disk, cadangan, layanan,
     sertifikat, lalu mengabari Super Admin lewat WhatsApp (satu pesan per kejadian, jam tenang malam kecuali merah). HANYA mengabari -
     tidak membersihkan/menghapus apa pun. Saklar kabar merah/peringatan di Admin > Kapasitas penyimpanan. Matikan seluruhnya
     dengan ALETA_PENJAGA_SERVER=0. */
  if (process.env.ALETA_PENJAGA_SERVER !== "0") {
    const [{ mulaiPenjagaBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/penjaga-server/layanan"),
      import("@/server/db/client"),
    ]);
    mulaiPenjagaBerkala(getDatabase);
  }
  /* === AKHIR PENJAGA SERVER === */
  /* === MODE PEMELIHARAAN 25 Okt (E3) === detak 60 detik; hanya mengirim SATU WhatsApp 15 menit sebelum jadwal mulai bila
     Super Admin mencentang kabar WhatsApp (mati bawaan). Mode pemeliharaannya sendiri dinilai tiap permintaan, bukan di sini.
     Matikan detaknya dengan ALETA_PEMELIHARAAN_DETAK=0. */
  if (process.env.ALETA_PEMELIHARAAN_DETAK !== "0") {
    const [{ mulaiPemeliharaanBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/pemeliharaan/layanan"),
      import("@/server/db/client"),
    ]);
    mulaiPemeliharaanBerkala(getDatabase);
  }
  /* === AKHIR MODE PEMELIHARAAN === */
  /* === PENJAGA INTEGRITAS BERKAS 25 Okt (E6) === detak 60 detik; SAKLAR MATI bawaan = tidak berbuat apa-apa (tidak membaca folder, tidak mengirim pesan).
     Folder terdaftar hanya DIBACA. Matikan detaknya dengan ALETA_INTEGRITAS_DETAK=0. */
  if (process.env.ALETA_INTEGRITAS_DETAK !== "0") {
    const [{ mulaiIntegritasBerkala }, { getDatabase }] = await Promise.all([
      import("@/server/modules/integritas/layanan"),
      import("@/server/db/client"),
    ]);
    mulaiIntegritasBerkala(getDatabase);
  }
  /* === AKHIR PENJAGA INTEGRITAS === */
  if (process.env.ALETA_SINKRON_PENJADWAL === "0") return;
  const { mulaiPenjadwalSinkron } = await import("@/server/modules/sinkron/penjadwal");
  mulaiPenjadwalSinkron();
}
