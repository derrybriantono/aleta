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
  /* === KTP-PIHAK 12 Okt === penyapu latar tanggal KTP pihak (ALETA_KTP_PIHAK_LATAR=0 mematikan). */
  if (process.env.ALETA_KTP_PIHAK_LATAR !== "0") {
    const { mulaiPindaiKtpBerkala } = await import("@/server/modules/aleta-ecourt/ktp-pihak");
    mulaiPindaiKtpBerkala();
  }
  /* === AKHIR KTP-PIHAK === */
  if (process.env.ALETA_SINKRON_PENJADWAL === "0") return;
  const { mulaiPenjadwalSinkron } = await import("@/server/modules/sinkron/penjadwal");
  mulaiPenjadwalSinkron();
}
