"use strict";
// Teks isian bukti 4 keadaan, dibangun oleh fungsi ekstensi sungguhan (susunTeksBukti) - persis yang ditulis panel ke ABT.
const fs = require("fs");
const path = require("path");
const SUMBER = fs.readFileSync("D:/aleta-dev/wt/w155/ekstensi-sipp/blangko-derry-isian.js", "utf8");
const AWAL = SUMBER.indexOf("  const buangNomorAwal = ");
const AKHIR = SUMBER.indexOf("  /** Teks ruas -> { surat, el[] }");
const mesin = new Function("tglIndo", `${SUMBER.slice(AWAL, AKHIR)}\nreturn { susunTeksBukti, butirElBaru, buktiBaru };`)((t) => t);
const SB = { P: "Penggugat", T: "Tergugat" };
const surat = (w) => w === "P"
  ? [mesin.buktiBaru("Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama BUDI REKAAN", "Pemerintah Kabupaten Donggala"), mesin.buktiBaru("Fotokopi Kutipan Akta Nikah", "Kantor Urusan Agama Kecamatan Banawa")]
  : [mesin.buktiBaru("Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama SITI REKAAN", "Pemerintah Kabupaten Donggala"), mesin.buktiBaru("Fotokopi Kartu Keluarga", "Dinas Kependudukan")];
const el = (w) => ({ nomori: true, butir: [
  { ...mesin.butirElBaru(w), bentuk: "Tangkapan layar (screenshot)", objek: "percakapan WhatsApp antara Penggugat dan Tergugat tanggal 3 Maret 2026", periksa: 1 },
  { ...mesin.butirElBaru(w), bentuk: "Rekaman suara dalam flashdisk", objek: "pembicaraan telepon Tergugat tanggal 5 Maret 2026", periksa: 0 },
] });
const hasil = {};
for (const [n, ada_s, ada_e] of [["surat", 1, 0], ["elektronik", 0, 1], ["keduanya", 1, 1], ["tanpa", 0, 0]]) {
  hasil[n] = {};
  for (const w of ["P", "T"]) hasil[n][w] = mesin.susunTeksBukti(ada_s ? surat(w) : [], w, ada_e ? el(w) : null, SB);
}
process.stdout.write(JSON.stringify(hasil, null, 1));
