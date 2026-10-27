// Ukur (baca saja) kamus per jenis perkara selain cerai atas posita sungguhan di sipp_donggala lokal:
// per jenis: jumlah perkara, fakta terbaca per kunci (kamus + pengurai lama), kalimat pokok ringkas/lengkap yang terbentuk, ms/perkara.
//   node scripts/isi-sipp-abt/ukur-kamus-jenis-27okt.cjs [--akar <repo>] [--keluar <berkas.json>] [--sejak 2022-06-01]
// Murni: tidak membaca ABT, tidak menulis apa pun. Keluaran TIDAK memuat nama pihak (hanya hitungan).
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const arg = (nama, bawaan) => {
  const i = process.argv.indexOf(nama);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
};
const akar = path.resolve(arg("--akar", path.resolve(__dirname, "..", "..")));
const keluar = arg("--keluar", "");
const sejak = arg("--sejak", "2022-06-01");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const dj = require(path.join(akar, "aleta_bot", "services", "deteksiJenisPerkaraService.js"));

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
const q = (sql, p) => new Promise((ok, gagal) => kon.query(sql, p || [], (e, r) => (e ? gagal(e) : ok(r))));

(async () => {
  const ids = dj.JENIS_SEMUA.flatMap((j) => j.ids);
  const baris = await q(
    `SELECT perkara_id, jenis_perkara_id j, alur_perkara_id a, jenis_perkara_text jt, posita FROM perkara
      WHERE tanggal_pendaftaran >= ? AND jenis_perkara_id IN (${ids.join(",")}) AND posita IS NOT NULL AND LENGTH(posita) > 60`,
    [sejak]
  );
  // pemanasan (kompilasi pola) di luar pengukuran waktu
  if (baris[0]) dj.faktaDariPosita(baris[0].posita, { jenisPerkara: String(baris[0].j), alur: String(baris[0].a) });
  const hasil = {};
  for (const b of baris) {
    const jenis = dj.kenaliJenis(b.j);
    if (!jenis) continue;
    const t0 = process.hrtime.bigint();
    const { fakta } = dj.faktaDariPosita(b.posita, { jenisPerkara: String(b.j), alur: String(b.a) });
    const pokok = dj.kalimatPokok({ posita: b.posita, jenisPerkara: String(b.j), alur: String(b.a), fakta });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const r = (hasil[jenis.kunci] = hasil[jenis.kunci] || { id: jenis.ids.join("/"), perkara: 0, ms: 0, fakta: {}, ringkas: 0, lengkap: 0, usulan: 0 });
    r.perkara++;
    r.ms += ms;
    for (const [k, f] of Object.entries(fakta)) if (f && (f.nilai === true || String(f.nilai || "").trim())) r.fakta[k] = (r.fakta[k] || 0) + 1;
    if (pokok && pokok.ringkas) r.ringkas++;
    if (pokok && pokok.lengkap) r.lengkap++;
    r.usulan += Object.keys(fakta).filter((k) => /^\d{4,5}$/.test(k)).length;
  }
  for (const r of Object.values(hasil)) {
    r.msPerPerkara = Math.round((r.ms / r.perkara) * 100) / 100;
    delete r.ms;
  }
  const out = { diukur: new Date().toISOString().slice(0, 10), akar, sejak, jenis: hasil };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(out, null, 1));
  for (const [k, r] of Object.entries(hasil)) {
    console.log(
      k.padEnd(20),
      `perkara ${r.perkara}`.padEnd(13),
      `ringkas ${r.ringkas} lengkap ${r.lengkap}`.padEnd(24),
      `usulan/perkara ${(r.usulan / r.perkara).toFixed(2)}`.padEnd(22),
      `${r.msPerPerkara} ms`.padEnd(10),
      Object.keys(r.fakta).length + " kunci fakta"
    );
  }
  kon.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
