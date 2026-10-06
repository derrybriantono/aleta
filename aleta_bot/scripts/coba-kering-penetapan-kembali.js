"use strict";

/**
 * Uji KERING penetapan kembali atas basis data SIPP setempat/peladen -
 * HANYA MEMBACA: menyusun rencana (SELECT saja) dan mencetaknya, tidak pernah
 * memanggil jalankanRencana dengan kering:false.
 *
 *   node scripts/coba-kering-penetapan-kembali.js <perkaraId> <akunSipp> [tanggal]
 */

require("dotenv").config();
const kembali = require("../services/penetapanKembaliService");

async function utama() {
  const perkaraId = Number(process.argv[2] || 0);
  const akun = String(process.argv[3] || "");
  const tanggal = String(process.argv[4] || new Date().toISOString().slice(0, 10));
  const keadaan = await kembali.keadaanUntukLayar({ perkaraId: [perkaraId] });
  console.log("keadaan:", JSON.stringify(keadaan.perkara, null, 1));
  console.log("referensi:", Object.fromEntries(Object.entries(keadaan.referensi).map(([k, v]) => [k, v.length])));
  const p = keadaan.perkara[0];
  if (!p) return;
  const lain = (daftar, kini) => (daftar.find((x) => x.id !== kini) || {}).id;
  const minta = {
    pmh: { hakimId: [...p.pmh.majelis.map((m) => m.hakimId)].reverse() },
    ppp: { petugasId: lain(keadaan.referensi.panitera, p.ppp.id) },
    pjs: { petugasId: lain(keadaan.referensi.jurusita, p.pjs.id) },
    phs: { tanggalSidang: tanggal, jamSidang: "09:00", ruanganId: p.phs.ruanganId || (keadaan.referensi.ruangan[0] || {}).id },
  };
  for (const jenis of ["pmh", "ppp", "pjs", "phs"]) {
    const r = await kembali.susunRencanaKembali({
      jenis,
      perkaraId,
      tanggalPenetapan: tanggal,
      alasan: "Cuti Tahunan",
      olehUsername: akun,
      operator: "uji kering",
      ip: "127.0.0.1",
      ...minta[jenis],
    });
    console.log(`\n== ${jenis}: ${r.ok ? `OK ${r.langkah.length} langkah, halaman "${r.formulir}"` : `DITOLAK ${r.alasan}`}`);
    if (r.ok) for (const l of r.langkah) console.log(`   ${l.aksi.padEnd(6)} ${l.tabel.padEnd(30)} ${l.keterangan}`);
  }
}

utama()
  .catch((g) => console.error(g))
  .finally(() => setTimeout(() => process.exit(0), 200));
