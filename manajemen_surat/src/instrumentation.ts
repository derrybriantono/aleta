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
  if (process.env.ALETA_SINKRON_PENJADWAL === "0") return;
  const { mulaiPenjadwalSinkron } = await import("@/server/modules/sinkron/penjadwal");
  mulaiPenjadwalSinkron();
}
