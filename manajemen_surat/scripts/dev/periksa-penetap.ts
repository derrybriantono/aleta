/**
 * Membuktikan rantai penetap PMH bekerja terhadap basis data LOKAL.
 *
 * Memakai modul yang sesungguhnya - bacaPemetaanJabatan, yangSedangCuti,
 * akunPimpinan - bukan tiruannya. Yang ditiru hanya jembatan bot di 3003.
 *
 *   npx tsx scripts/dev/periksa-penetap.ts
 */

import { getDatabase } from "@/server/db/client";
import { bacaPemetaanJabatan } from "@/server/modules/aleta-ecourt/pemetaan-jabatan";
import { pejabatBertugas, yangSedangCuti } from "@/server/modules/aleta-ecourt/pejabat-bertugas";
import { JABATAN_KETUA, akunPimpinan } from "@/server/modules/aleta-ecourt/rencana-penetapan";

async function main() {
  const db = await getDatabase();

  const pemetaan = await bacaPemetaanJabatan(db);
  console.log(`pemetaan jabatan : ${pemetaan.ok ? "TERBACA" : `GAGAL - ${pemetaan.galat}`}`);
  if (!pemetaan.ok) return;
  console.log(`akun terbaca     : ${pemetaan.akun.length}`);

  for (const hari of ["2026-08-31", "2026-09-04", "2026-09-13"]) {
    const [cuti, penunjukan] = await Promise.all([
      yangSedangCuti(db, hari),
      pejabatBertugas(db, JABATAN_KETUA, hari),
    ]);
    const pilihan = akunPimpinan(pemetaan.akun, { sedangCuti: cuti, penunjukan });
    const siapa = pilihan.akun ? `${pilihan.sebutan} - ${pilihan.akun.namaLengkap} (akun ${pilihan.akun.username})` : "TIDAK ADA";
    console.log(`\n${hari}`);
    console.log(`  cuti          : ${cuti.size ? [...cuti].join(", ") : "tidak ada"}`);
    console.log(`  menandatangani: ${siapa}`);
    for (const catatan of pilihan.catatan) console.log(`  catatan       : ${catatan}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((galat) => {
    console.error("GAGAL:", galat.message);
    process.exit(1);
  });
