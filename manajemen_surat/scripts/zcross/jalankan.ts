/**
 * Menyesuaikan Z cross satu naskah BAS dari baris perintah (uji tangan dan bukti render).
 *
 *   npx tsx scripts/zcross/jalankan.ts <masuk.rtf|docx|doc> <keluar> [--keluar rtf|docx|doc|pdf] [--bukti N] [--halaman-bukti 2,1,3] [--mesin word|soffice]
 *
 * Mesin: bawaan Word di Windows yang memasangnya, selainnya soffice (ZCROSS_MESIN atau --mesin menimpa).
 */
import { readFile, writeFile } from "node:fs/promises";

import { kenaliBerkasWord } from "../../src/server/modules/aleta-ecourt/bas-word-pdf";
import { mesinSoffice, mesinWord, pilihMesinLokal, sesuaikanZcross } from "../../src/server/modules/aleta-ecourt/zcross";

async function utama() {
  const a = process.argv.slice(2);
  const posisi = a.filter((x, i) => !x.startsWith("--") && !(i > 0 && a[i - 1].startsWith("--")));
  const bendera = (n: string) => {
    const i = a.indexOf(`--${n}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  if (posisi.length < 2) {
    console.error("pakai: jalankan.ts <masuk> <keluar> [--keluar rtf|docx|doc|pdf] [--bukti N] [--halaman-bukti a,b,c] [--mesin word|soffice]");
    process.exit(2);
  }
  const bita = new Uint8Array(await readFile(posisi[0]));
  const bentuk = kenaliBerkasWord(bita);
  if (bentuk !== "rtf" && bentuk !== "docx" && bentuk !== "doc") {
    console.error("Berkas bukan RTF/DOCX/DOC.");
    process.exit(2);
  }
  const m = bendera("mesin");
  const mesin = m === "word" ? mesinWord() : m === "soffice" ? mesinSoffice() : pilihMesinLokal();
  const hb = bendera("halaman-bukti");
  const hasil = await sesuaikanZcross(bita, bentuk, {
    mesin,
    keluar: bendera("keluar") as "rtf" | "docx" | "doc" | "pdf" | undefined,
    jumlahBukti: bendera("bukti") ? Number(bendera("bukti")) : undefined,
    halamanBukti: hb ? hb.split(",").map((x) => Number(x) || null) : undefined,
  });
  await writeFile(posisi[1], hasil.bita);
  console.log(JSON.stringify(hasil.laporan, null, 2));
}

utama().catch((e) => {
  console.error(e);
  process.exit(1);
});
