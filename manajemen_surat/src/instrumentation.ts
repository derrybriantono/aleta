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
  if (process.env.ALETA_SINKRON_PENJADWAL === "0") return;
  const { mulaiPenjadwalSinkron } = await import("@/server/modules/sinkron/penjadwal");
  mulaiPenjadwalSinkron();
}
