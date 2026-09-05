/**
 * Membuktikan Tahap 1 dan Tahap 2 bekerja terhadap data sungguhan.
 *
 * Memakai modul yang dipakai portal - rakitBerkasPerkara dan
 * susunLembarTanyaJawab - bukan tiruannya.
 *
 *   npx tsx scripts/dev/periksa-tahap-1-2.ts <perkaraId>
 */

import { rakitBerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import { susunLembarTanyaJawab } from "@/server/modules/aleta-ecourt/bas-tanya-jawab";

const perkaraId = process.argv[2] ?? "";

async function main() {
  console.log("=== TAHAP 1 · Berkas Perkara Terpadu ===\n");
  const berkas = await rakitBerkasPerkara(perkaraId);

  console.log(`nomor perkara : ${berkas.nomorPerkara || "(tidak terbaca)"}`);
  const bagian: Array<[string, { ada: boolean; asal: { sistem: string; sumber: string } }]> = [
    ["identitas", berkas.identitas],
    ["para pihak", berkas.paraPihak],
    ["majelis", berkas.majelis],
    ["riwayat sidang", berkas.riwayatSidang],
    ["saksi tercatat", berkas.saksiTercatat],
    ["pemeriksaan saksi", berkas.pemeriksaanSaksi],
    ["putusan", berkas.putusan],
    ["pertimbangan", berkas.pertimbangan],
  ];
  for (const [nama, isi] of bagian) {
    console.log(`  ${(isi.ada ? "ADA" : "-").padEnd(4)} ${nama.padEnd(20)} ${isi.asal.sistem} · ${isi.asal.sumber}`);
  }

  const saksi = berkas.pemeriksaanSaksi.nilai as { jumlahSaksi?: number; jumlahTanyaJawab?: number } | null;
  if (saksi?.jumlahSaksi) {
    console.log(`\n  pemeriksaan   : ${saksi.jumlahSaksi} saksi, ${saksi.jumlahTanyaJawab} tanya-jawab`);
  }
  const pert = berkas.pertimbangan.nilai as { panjangHuruf?: number } | null;
  if (pert?.panjangHuruf) console.log(`  pertimbangan  : ${pert.panjangHuruf} huruf`);

  if (berkas.selisih.length) {
    console.log("\n  SELISIH ANTAR SUMBER:");
    for (const s of berkas.selisih) {
      console.log(`    ${s.hal}: ${s.menurut.map((m) => `${m.sistem} ${m.nilai}`).join("  vs  ")}`);
      console.log(`      -> ${s.keterangan}`);
    }
  }
  if (berkas.halangan.length) {
    console.log("\n  HALANGAN:");
    for (const h of berkas.halangan) console.log(`    ${h}`);
  }

  console.log("\n=== TAHAP 2 · Lembar Tanya-Jawab (A1a, saksi Penggugat cerai gugat) ===\n");
  const lembar = await susunLembarTanyaJawab({ perkaraId, kode: "A1a" });

  if (!lembar.ok) {
    console.log("  gagal:", lembar.halangan.join(" | "));
    return;
  }

  console.log(`  pertanyaan    : ${lembar.jumlahPertanyaan}`);
  console.log(`  terisi sendiri: ${lembar.terisi.length}  |  perlu diisi panitera: ${lembar.kosong.length}`);
  for (const t of lembar.terisi) console.log(`    ${t.nama} = ${t.nilai}   [${t.asal}]`);
  for (const k of lembar.kosong) console.log(`    (kosong) ${k.nama} - ${k.sebab}`);

  console.log("\n  tiga pertanyaan pertama sesudah pengisian:");
  for (const b of lembar.baris.slice(0, 3)) console.log(`    ${b.urutan}. ${b.pertanyaan}`);
}

main()
  .then(() => process.exit(0))
  .catch((galat) => {
    console.error("GAGAL:", galat instanceof Error ? galat.message : galat);
    process.exit(1);
  });
