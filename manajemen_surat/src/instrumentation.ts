/**
 * Kait awal Next.js - dijalankan SEKALI saat server portal berdiri.
 *
 * Satu-satunya isinya: detak penjadwal Sinkron & cadangan (butir 29/30,
 * 30 September 2026). Hanya di runtime Node (bukan edge), tidak saat uji,
 * dan dapat dimatikan dengan ALETA_SINKRON_PENJADWAL=0 - misalnya bila host
 * memilih memicu lewat cron (scripts/aleta-sinkron-cron.sh).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "test" || process.env.ALETA_SINKRON_PENJADWAL === "0") return;
  const { mulaiPenjadwalSinkron } = await import("@/server/modules/sinkron/penjadwal");
  mulaiPenjadwalSinkron();
}
