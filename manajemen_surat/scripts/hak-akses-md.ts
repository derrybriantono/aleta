/**
 * Membangkitkan docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md dari peta hak akses.
 * Jalankan dari folder manajemen_surat/:  npx tsx scripts/hak-akses-md.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { susunMarkdownHakAkses } from "../src/lib/hak-akses-dokumen";

const berkas = path.resolve(__dirname, "../../docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md");
mkdirSync(path.dirname(berkas), { recursive: true });
writeFileSync(berkas, susunMarkdownHakAkses(), "utf8");
console.log(`Ditulis: ${berkas}`);
