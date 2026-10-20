// Membandingkan hitungan bagian JS (aleta_bot/services/isiOtomatisS5/faraid.js) dengan variabel ABT 9769 (kueri salinan server, MariaDB lokal)
// atas susunan ahli waris acak + susunan khas. Tulis fixture emas ke manajemen_surat/src/test/fixtures/faraid-banding.json
//   node banding_faraid.js [jumlahAcak=300]
const path = require("path");
const fs = require("fs");
const akar = path.resolve(__dirname, "..", "..", "..");
const F = require(path.join(akar, "aleta_bot", "services", "isiOtomatisS5", "faraid.js"));
const { buatPenjalan } = require("./jalankan_9769.js");

// deterministik
let benih = 20261020;
const acak = () => {
  benih = (benih * 1664525 + 1013904223) % 4294967296;
  return benih / 4294967296;
};
const pilih = (n) => Math.floor(acak() * n);
let seq = 0;
const nama = (p, ayah) => `${["Adi", "Budi", "Candra", "Dedi", "Edo", "Fajar", "Gita", "Hana", "Indra", "Joko", "Kiki", "Lina"][pilih(12)]}${++seq} ${p ? "binti" : "bin"} ${ayah}`;

function konfigurasi() {
  const pewarisP = acak() < 0.45;
  const c = { pewarisPerempuan: pewarisP, pasangan: [], anak: [], ayah: "", ibu: "", saudara: [], seibu: [], nenekIbu: [], nenekAyah: [], kakek: "", cucu: [], penggantiInduk: "" };
  const np = pewarisP ? pilih(2) : pilih(3);
  for (let i = 0; i < np; i++) c.pasangan.push(nama(pewarisP ? false : true, "Sahar"));
  const na = acak() < 0.55 ? 1 + pilih(4) : 0;
  for (let i = 0; i < na; i++) c.anak.push(nama(acak() < 0.5, "Fulan"));
  if (acak() < 0.4) c.ayah = nama(false, "Ali");
  if (acak() < 0.45) c.ibu = nama(true, "Usman");
  if (!na && acak() < 0.5) {
    const ns = pilih(4);
    for (let i = 0; i < ns; i++) c.saudara.push(nama(acak() < 0.5, "Hasan"));
    const nsi = pilih(3);
    for (let i = 0; i < nsi; i++) c.seibu.push(nama(acak() < 0.5, "Zaki"));
  }
  if (acak() < 0.1) c.nenekIbu.push(nama(true, "Umar"));
  if (acak() < 0.05) c.nenekAyah.push(nama(true, "Amin"));
  return c;
}

const isianSql = (c, pewaris) => {
  const o = { 1025: pewaris };
  if (c.pasangan.length) o[9701] = c.pasangan.join("; ");
  if (c.anak.length) o[9702] = c.anak.join("; ");
  if (c.ayah) o[9703] = c.ayah;
  if (c.ibu) o[9704] = c.ibu;
  if (c.saudara.length) o[9718] = c.saudara.join("; ");
  if (c.seibu.length) o[9767] = c.seibu.join("; ");
  if (c.kakek) o[9764] = c.kakek;
  if (c.nenekIbu.length) o[9765] = c.nenekIbu.join("; ");
  if (c.nenekAyah.length) o[9766] = c.nenekAyah.join("; ");
  if (c.penggantiInduk) o[9762] = c.penggantiInduk;
  if (c.cucu.length) o[9763] = c.cucu.join("; ");
  return o;
};

const reduksi = (t) => {
  const [n, d] = t.split("/").map(Number);
  const [a, b] = F.pecah(n, d);
  return `${a}/${b}`;
};
const kunciPeran = (label) => {
  const l = label.toLowerCase();
  if (/\(janda\)|\bjanda\b/.test(l)) return "janda";
  if (/\(duda\)|\bduda\b/.test(l)) return "duda";
  if (/\(ayah\)/.test(l)) return "ayah";
  if (/\(ibu\)/.test(l)) return "ibu";
  if (/saudara seibu/.test(l)) return "seibu";
  if (/saudara laki-laki/.test(l)) return "saudaraL";
  if (/saudara perempuan/.test(l)) return "saudaraP";
  if (/anak laki-laki/.test(l)) return "anakL";
  if (/anak perempuan/.test(l)) return "anakP";
  if (/nenek/.test(l)) return "nenek";
  return "lain:" + l;
};

/** Mengurai bagian rincian dari keluaran 9769 -> { peran: [pecahan per orang, terurut] } atau null. */
function uraiSql(t9769) {
  const t = t9769.replace(/<br>/g, "\n");
  const m = /(?:rincian bagian:|bagian masing-masing ahli waris menjadi:)\s*([^\n]*?);?(?:\n|$)/g;
  let terakhir = null;
  let x;
  while ((x = m.exec(t)) !== null) terakhir = x[1];
  if (!terakhir) return null;
  const hasil = {};
  for (const butir of terakhir.split(/;\s*/).filter(Boolean)) {
    const mm = /^(.*?)\s+(\d+\/\d+)$/.exec(butir.trim());
    if (!mm) return { galat: butir };
    let label = mm[1];
    const orang = /\((\d+) orang\)\s*masing-masing/.exec(label);
    const n = orang ? Number(orang[1]) : 1;
    const k = kunciPeran(label);
    hasil[k] = hasil[k] || [];
    for (let i = 0; i < n; i++) hasil[k].push(reduksi(mm[2]));
  }
  for (const k of Object.keys(hasil)) hasil[k].sort();
  return hasil;
}

function peranJs(p) {
  return kunciPeran(p === "janda" || p === "duda" ? `(${p})` : p === "ayah" ? "(ayah)" : p === "ibu" ? "(ibu)" : p);
}
function uraiJs(h) {
  const hasil = {};
  for (const b of h.bagian) {
    const k = peranJs(b.peran);
    hasil[k] = hasil[k] || [];
    hasil[k].push(b.pecahan);
  }
  for (const k of Object.keys(hasil)) hasil[k].sort();
  return hasil;
}

(async () => {
  const jumlah = Number(process.argv[2] || 300);
  const penjalan = buatPenjalan();
  const emas = [];
  let sama = 0, beda = 0, fb = 0, takTerurai = 0, kosong = 0;
  const contohBeda = [];
  for (let i = 0; i < jumlah; i++) {
    const c = konfigurasi();
    const pewaris = nama(c.pewarisPerempuan, "Hasan");
    const js = F.hitung(c);
    const sql = await penjalan.jalankan(isianSql(c, pewaris));
    const t9769 = sql[9769];
    const uSql = uraiSql(t9769);
    const catat = { masukan: c, kasusJs: js.kasus, js: js.kasus === "fb" || js.kasus === "kosong" ? null : uraiJs(js), sql: uSql, tersendiriSql: /dipertimbangkan tersendiri/.test(t9769) };
    if (js.kasus === "kosong") { kosong += 1; continue; }
    if (js.kasus === "fb") {
      fb += 1;
      // SQL juga harus menyerahkan ke hakim ("dipertimbangkan tersendiri")
      catat.sqlSerahHakim = catat.tersendiriSql;
      if (!catat.tersendiriSql) { beda += 1; contohBeda.push({ alasan: "JS fb tetapi SQL menghitung", c, js: js.alasanFb, sql: uSql }); }
      emas.push(catat);
      continue;
    }
    if (!uSql || uSql.galat) { takTerurai += 1; contohBeda.push({ alasan: "SQL tak terurai", c, t9769: t9769.slice(0, 600) }); emas.push(catat); continue; }
    if (JSON.stringify(uSql) === JSON.stringify(catat.js)) sama += 1;
    else { beda += 1; contohBeda.push({ alasan: "angka beda", c, js: catat.js, sql: uSql }); }
    emas.push(catat);
  }
  penjalan.tutup();
  console.log({ jumlah, sama, beda, fb, takTerurai, kosong });
  for (const b of contohBeda.slice(0, 8)) console.log(JSON.stringify(b).slice(0, 900));
  const keluar = path.join(akar, "manajemen_surat", "src", "test", "fixtures", "faraid-banding.json");
  fs.mkdirSync(path.dirname(keluar), { recursive: true });
  fs.writeFileSync(keluar, JSON.stringify({ catatan: "Hasil kueri ABT 9769 (salinan server 20 Okt 2026) atas susunan ahli waris acak; dipakai uji u5-faraid.test.ts", sama, beda, fb, kasus: emas.filter((e) => e.js || e.sqlSerahHakim !== undefined) }, null, 1));
  console.log("fixture ditulis:", keluar);
  if (beda || takTerurai) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
