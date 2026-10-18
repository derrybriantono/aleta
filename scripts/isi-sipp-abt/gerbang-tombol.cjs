// Periksa GERBANG tombol "Isi dari posita ..." di ekstensi: pengisi yang ada di bot tidak berguna bila
// tombolnya tidak muncul di blangko itu. Cermin gerbang dibaca langsung dari ekstensi-sipp/abt.js.
//
//   node scripts/isi-sipp-abt/gerbang-tombol.cjs <analisa.json>
//
// Keluaran: daftar (blangko, isian) yang punya pengisi posita di bot tetapi tombolnya tidak terpicu.
const fs = require("fs");
const path = require("path");

const akar = path.resolve(__dirname, "..", "..");
const sumberAbt = fs.readFileSync(path.join(akar, "ekstensi-sipp", "abt.js"), "utf8");

function ambil(nama) {
  const re = new RegExp(`const ${nama} = (?:Object\\.freeze\\()?([\\s\\S]*?)\\)?;\\n`);
  const m = re.exec(sumberAbt);
  if (!m) throw new Error(`konstanta ${nama} tidak ditemukan di abt.js`);
  // Object.freeze bersarang dibiarkan: dipakai apa adanya oleh Function.
  const badan = m[1];
  // eslint-disable-next-line no-new-func
  return new Function("Object", `return (${badan.replace(/\)\s*$/, "")});`)(Object);
}

const cermin = {
  cerai: ambil("VARIABEL_CERAI_SAKSI"),
  siap: ambil("VARIABEL_SIAP_POSITA_LAIN"),
  kunciJenis: ambil("KUNCI_JENIS_LAIN"),
  j3: ambil("J3_VARIABEL_JENIS"),
  pwh: ambil("PWH_VARIABEL_JENIS"),
  y: ambil("Y_VARIABEL_JENIS"),
};

/** Variabel pemicu tombol untuk satu id jenis perkara SIPP. */
function pemicu(id) {
  const s = new Set(["5197", "8087"]);
  for (const k of cermin.siap[cermin.kunciJenis[id]] || []) s.add(k);
  for (const k of cermin.j3[id] || []) s.add(k);
  for (const k of cermin.pwh[id] || []) s.add(k);
  for (const k of cermin.y[id] || []) s.add(k);
  if (id === 346 || id === 347) for (const k of cermin.cerai) s.add(k);
  return s;
}

module.exports = { cermin, pemicu };

if (require.main === module) {
  const analisa = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const daftar = JSON.parse(fs.readFileSync(path.join(akar, "docs", "isi-sipp-abt", "DAFTAR-CEK.json"), "utf8"));
  const bl = new Map(daftar.blangko.map((b) => [b.jalur, b]));
  const isianPos = new Map(); // kunci -> isian daftar (pengisi deteksi)
  for (const i of daftar.isian) if (i.pengisi.some((p) => p.jenis === "deteksi" || p.jenis === "f23")) for (const k of i.kode) isianPos.set(k, i);
  const folderJenis = (f) => {
    const m = bl; // dummy
    return m && null;
  };
  void folderJenis;
  const { petaFolderJenis } = require("./folder-jenis.cjs");
  const gap = new Map();
  let total = 0;
  for (const b of analisa.blangko) {
    const d = bl.get(b.jalur);
    if (!d || d.universal) continue;
    const ids = petaFolderJenis(b.folder);
    if (!ids.length) continue;
    const tutup = new Set(b.tutup);
    const berfungsi = ids.some((id) => [...pemicu(id)].some((k) => tutup.has(k)));
    for (const i of b.isian) {
      const info = isianPos.get(i.kode);
      if (!info) continue;
      total++;
      if (berfungsi) continue;
      const kunci = `${i.kode}`;
      if (!gap.has(kunci)) gap.set(kunci, { kode: i.kode, nama: i.nama, blangko: [] });
      gap.get(kunci).blangko.push(b.jalur.replace(/^derry_briantono\//, ""));
    }
  }
  console.log("kejadian (blangko x isian posita):", total, "tak terpicu:", [...gap.values()].reduce((n, g) => n + g.blangko.length, 0));
  for (const g of [...gap.values()].sort((a, b) => b.blangko.length - a.blangko.length)) console.log(g.kode, g.nama.slice(0, 40), g.blangko.length, "|", g.blangko.slice(0, 2).join(" ; ").slice(0, 160));
}
