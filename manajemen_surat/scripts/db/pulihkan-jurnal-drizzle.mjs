/**
 * Memulihkan jurnal migrasi Drizzle agar SELURUH berkas migrasi terlacak.
 *
 * =============================================================================
 * MASALAH YANG DIPECAHKAN
 * =============================================================================
 *
 * drizzle/meta/_journal.json hanya mencatat 4 entri, padahal ada 22 berkas
 * migrasi di folder yang sama. Drizzle membaca DAFTAR DI JURNAL, bukan isi
 * folder - jadi 18 migrasi sisanya tidak pernah dilihatnya sama sekali.
 *
 * Akibatnya `npm run db:migrate` selalu menjawab "applied successfully" tanpa
 * menerapkan apa pun. Kegagalan yang berbunyi seperti keberhasilan adalah
 * kegagalan yang paling mahal: pemasangan baru akan kehilangan tabel tanpa satu
 * pun tanda, dan gejalanya baru muncul jauh kemudian sebagai galat yang tampak
 * tidak berhubungan.
 *
 * =============================================================================
 * YANG DIKERJAKAN
 * =============================================================================
 *
 *   1. Jurnal ditulis ulang memuat semua berkas .sql, berurutan menurut nama.
 *      Nama berkasnya berawalan nomor urut, dan ITU yang menjadi acuan - cap
 *      waktu berkas tidak dapat dipakai: sebagian besar sama persis karena
 *      berasal dari satu kali salin, dan 0021 bahkan lebih tua daripada 0020.
 *
 *   2. Tabel drizzle.__drizzle_migrations diisi barisnya untuk migrasi yang
 *      SUDAH terpasang di basis data ini. Tanpa langkah ini, jurnal yang benar
 *      justru berbahaya: Drizzle akan menganggap 18 migrasi itu belum jalan,
 *      lalu menerapkannya ulang di atas tabel yang sudah ada.
 *
 * Sidiknya dihitung persis seperti Drizzle menghitungnya - sha256 atas ISI
 * berkas apa adanya (lihat drizzle-orm/migrator.js). Sidik yang meleset
 * sedikit pun membuat migrasinya dianggap baru dan dijalankan ulang.
 *
 * Dijalankan berulang aman: yang sudah tercatat dilewati.
 *
 *   node scripts/db/pulihkan-jurnal-drizzle.mjs           (periksa saja)
 *   node scripts/db/pulihkan-jurnal-drizzle.mjs --tulis   (perbaiki)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const AKAR = process.cwd();
const FOLDER = path.join(AKAR, "drizzle");
const JURNAL = path.join(FOLDER, "meta", "_journal.json");
const TULIS = process.argv.includes("--tulis");

// Jarak antar entri baru. Nilainya hanya perlu menaik; Drizzle memakainya
// sebagai created_at dan membandingkannya dengan yang TERAKHIR di basis data.
const JARAK_MS = 1000;

function bacaJurnal() {
  const isi = JSON.parse(fs.readFileSync(JURNAL, "utf8"));
  const lama = new Map(isi.entries.map((e) => [e.tag, e]));
  return { isi, lama };
}

function daftarMigrasi() {
  return fs
    .readdirSync(FOLDER)
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .map((n) => n.replace(/\.sql$/, ""));
}

function sidik(tag) {
  const isi = fs.readFileSync(path.join(FOLDER, `${tag}.sql`), "utf8");
  return crypto.createHash("sha256").update(isi).digest("hex");
}

async function main() {
  const { isi, lama } = bacaJurnal();
  const tags = daftarMigrasi();

  console.log(`Berkas migrasi : ${tags.length}`);
  console.log(`Tercatat jurnal: ${isi.entries.length}`);

  // --- 1. Susun jurnal yang lengkap -----------------------------------------
  const entri = [];
  let waktuTerakhir = 0;
  for (const [idx, tag] of tags.entries()) {
    const sebelumnya = lama.get(tag);
    // Entri lama dipertahankan APA ADANYA - "when"-nya sudah tersimpan sebagai
    // created_at di basis data, dan mengubahnya membuat keduanya berselisih.
    let when = sebelumnya?.when ?? waktuTerakhir + JARAK_MS;
    if (when <= waktuTerakhir) when = waktuTerakhir + JARAK_MS;
    waktuTerakhir = when;
    entri.push({ idx, version: "7", when, tag, breakpoints: sebelumnya?.breakpoints ?? true });
  }

  const jurnalBaru = { version: isi.version ?? "7", dialect: isi.dialect ?? "postgresql", entries: entri };

  // --- 2. Cocokkan dengan yang sudah tercatat di basis data ------------------
  const alamat = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/aleta";
  const klien = new pg.Client({ connectionString: alamat });
  await klien.connect();

  await klien.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await klien.query(
    'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)'
  );

  const ada = await klien.query('select hash from "drizzle"."__drizzle_migrations"');
  const sudah = new Set(ada.rows.map((r) => r.hash));

  const perluDicatat = entri.filter((e) => !sudah.has(sidik(e.tag)));
  console.log(`Tercatat di basis data: ${sudah.size}`);
  console.log(`Belum tercatat        : ${perluDicatat.length}`);
  for (const e of perluDicatat) console.log(`  - ${e.tag}`);

  if (!TULIS) {
    console.log("\n(periksa saja - jalankan dengan --tulis untuk memperbaiki)");
    await klien.end();
    return;
  }

  // Salinan jurnal lama disimpan. Jurnal adalah satu-satunya penentu migrasi
  // mana yang dianggap sudah jalan; salah menulisnya jauh lebih mudah
  // dibatalkan bila yang lama masih ada.
  const cadangan = `${JURNAL}.bak-${new Date().toISOString().slice(0, 10)}`;
  if (!fs.existsSync(cadangan)) fs.copyFileSync(JURNAL, cadangan);
  fs.writeFileSync(JURNAL, `${JSON.stringify(jurnalBaru, null, 2)}\n`, "utf8");
  console.log(`\nJurnal ditulis (${entri.length} entri). Cadangan: ${path.basename(cadangan)}`);

  for (const e of perluDicatat) {
    await klien.query('insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ($1, $2)', [
      sidik(e.tag),
      e.when,
    ]);
  }
  console.log(`Baris migrasi ditambahkan: ${perluDicatat.length}`);

  const akhir = await klien.query('select count(*)::int n from "drizzle"."__drizzle_migrations"');
  console.log(`Total tercatat di basis data: ${akhir.rows[0].n}`);
  await klien.end();
}

main().catch((galat) => {
  console.error("GAGAL:", galat.message);
  process.exit(1);
});
