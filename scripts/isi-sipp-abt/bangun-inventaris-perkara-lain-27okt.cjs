// Membangun docs/kamus/inventaris-perkara-lain-27okt.md dari berkas ukuran (hasil ukur-perkara-lain / ukur-kamus-jenis / ukur-akurasi-abt).
//   node scripts/isi-sipp-abt/bangun-inventaris-perkara-lain-27okt.cjs <folder-ukuran>
// Folder ukuran memuat: rs-dasar-{1,2,3}.json, rs-baru-{1,2,3}.json, kamus-dasar.json, kamus-baru.json, akurasi-sebelum.json, akurasi-sesudah.json.
// Berkas ukuran disalin ke docs/kamus/data/ supaya dokumen dapat dibangun ulang. Tanpa nama pihak (hanya hitungan dan nama variabel ABT).
const fs = require("fs");
const path = require("path");
const akar = path.resolve(__dirname, "..", "..");
const sumber = path.resolve(process.argv[2]);
const keluarData = path.join(akar, "docs", "kamus", "data");
fs.mkdirSync(keluarData, { recursive: true });
const baca = (n) => JSON.parse(fs.readFileSync(path.join(sumber, n), "utf8"));
const salin = (n) => fs.copyFileSync(path.join(sumber, n), path.join(keluarData, n));
for (const n of fs.readdirSync(sumber).filter((x) => /^(rs-(dasar|baru)-\d|kamus-(dasar|baru)|akurasi-(sebelum|sesudah))\.?.*\.json$/.test(x))) salin(n);

const ledger = JSON.parse(fs.readFileSync(path.join(akar, "aleta_bot", "config", "gerbang-isian.json"), "utf8")).kode;
const fixture = (n) => fs.readFileSync(path.join(akar, "manajemen_surat", "src", "app", "api", "aleta-ecourt", "blangko-derry", n), "utf8");
// kode yang punya pilihan bawaan (pil) / label di tabel label
function entri(teks) {
  const hasil = {};
  const re = /["']?(\d{4,5})["']?\s*:\s*\{/g;
  let m;
  while ((m = re.exec(teks))) {
    let i = re.lastIndex;
    let d = 1;
    while (i < teks.length && d > 0) {
      const c = teks[i];
      if (c === "{") d++;
      else if (c === "}") d--;
      else if (c === '"') {
        i++;
        while (teks[i] !== '"') {
          if (teks[i] === "\\") i++;
          i++;
        }
      }
      i++;
    }
    const blok = teks.slice(m.index, i);
    hasil[m[1]] = { pil: /\bpil\s*:|"pil"\s*:/.test(blok) };
    re.lastIndex = i;
  }
  return hasil;
}
const labelSemua = { ...entri(fixture("ramah-w3b.ts")), ...entri(fixture("susun.ts")) };
const labelLama = { ...entri(fixture("ramah-w3b.ts")), ...entri(fixture("susun.ts").replace(/gabungRamahW104\(RAMAH\);/, "")) };
// susun.ts tidak memuat RAMAH_W104; tambahkan dari berkasnya
const label104 = entri(fixture("ramah-w104.ts"));
const pilSesudah = (k) => Boolean((labelSemua[k] && labelSemua[k].pil) || (label104[k] && label104[k].pil));
const pilSebelum = (k) => Boolean(labelLama[k] && labelLama[k].pil);
const labelSebelum = (k) => Boolean(labelLama[k]);
const labelSesudah = (k) => Boolean(labelSemua[k] || label104[k]);

const dasar = [1, 2, 3].map((i) => baca(`rs-dasar-${i}.json`).jenis);
const baru = [1, 2, 3].map((i) => baca(`rs-baru-${i}.json`).jenis);
const kd = baca("kamus-dasar.json").jenis;
const kb = baca("kamus-baru.json").jenis;
const as = baca("akurasi-sebelum.json").jenis;
const ak = baca("akurasi-sesudah.json").jenis;

const NAMA_JENIS = {
  "360": "Itsbat nikah (pengesahan perkawinan)", "362": "Dispensasi kawin", "371": "Penetapan ahli waris (P3HP)", "354": "Perwalian", "364": "Kewarisan",
  "369": "Lain-lain (pengangkatan anak, hak asuh)", "348": "Harta bersama", "358": "Asal usul anak", "363": "Wali adhal", "341": "Izin poligami", "365": "Wasiat",
  "370": "Ekonomi syariah", "342": "Pencegahan perkawinan", "344": "Pembatalan perkawinan", "343": "Penolakan perkawinan",
};
const KELAS = ["otomatis", "ragu", "manual", "ecourt", "opsional", "kosong"];
const jumlah = (r) => {
  const t = Object.fromEntries(KELAS.map((k) => [k, 0]));
  for (const c of Object.values(r.kode)) for (const k of KELAS) t[k] += c[k] || 0;
  return t;
};
const persen = (t) => {
  const s = Object.values(t).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round((v / s) * 1000) / 10]));
};
const msMin = (daftar, k) => Math.min(...daftar.map((j) => (j[k] ? j[k].msPerPerkara : Infinity)));
const kunci = Object.keys(dasar[0]).sort((a, b) => dasar[0][b].perkara - dasar[0][a].perkara);

const baris = [];
const p = (s = "") => baris.push(s);
p("# Inventaris variabel dan kamus blangko Derry - perkara selain cerai (27 Okt 2026)");
p();
p("Dibangun oleh `scripts/isi-sipp-abt/bangun-inventaris-perkara-lain-27okt.cjs` dari ukuran di `docs/kamus/data/`. Tanpa nama pihak: hanya hitungan dan nama variabel ABT.");
p();
p("## Cara mengukur");
p();
p("- **Terisi otomatis** diukur lewat rute bot `/abt/usulan` sungguhan (sumber `sipp` + `itsbat` atau `posita-lain`) dan mesin bersama ekstensi (`isi-sipp-bersama.js`) atas perkara terdaftar sejak 2023 di salinan `sipp_donggala` (maks 40 perkara per jenis/alur, terbaru dahulu; skrip `ukur-perkara-lain-27okt.cjs`). Ruas yang dihitung = isian popup bukan-bersyarat (kuasa/prodeo/alasan C-H dikecualikan) pada blangko putusan + BAS jenis itu (relaas, PTSP, sita lintas jenis tidak dihitung).");
p("- Kelas: **otomatis** = mesin menulis (pasti/cukup); **ragu** = hanya saran bertanda 'periksa'; **manual** = ditandai 'diisi manual' beserta alasan; **ecourt** = bergantung berkas e-Court (tak terukur lokal); **kosong** = tak ada pengisi dan belum ditandai (sebagian BENAR kosong: isian berbunyi 'kosong bila tidak ada').");
p("- **Ketepatan** diukur terhadap isian petugas yang tersimpan di ABT lokal (`aps_badilag.abt_data_teks`) lewat modul deteksi murni (`ukur-akurasi-abt-27okt.cjs`); **kamus** diukur dengan `ukur-kamus-jenis-27okt.cjs` (waktu = tercepat dari 5 putaran, CPU murni).");
p("- Sampel kecil: jenis selain itsbat/DK/PAW/perwalian punya 1-13 perkara sejak 2023; angkanya petunjuk, bukan bukti ketepatan. Gerbang otomatis (n pembanding >= 20, cocok >= 90%) hanya mungkin untuk itsbat dan dispensasi kawin; jenis lain tetap saran 'ragu' sampai datanya cukup.");
p("- Waktu rute (ms/perkara) ikut berubah menurut beban laptop (4 agen paralel); yang dijadikan bukti performa adalah waktu kamus murni di tabel 3.");
p();
p("## 1. Ringkasan per jenis/alur (sebelum -> sesudah, % dari ruas x perkara)");
p();
p("| jenis/alur | jenis | perkara diukur | ruas | otomatis | ragu | manual | e-Court | kosong | ms rute (min 3 putaran) |");
p("| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |");
for (const k of kunci) {
  const a = persen(jumlah(dasar[0][k]));
  const b = persen(jumlah(baru[0][k]));
  const f = (x, y) => (x === y ? `${x}` : `${x} -> **${y}**`);
  p(`| ${k} | ${NAMA_JENIS[k.split("/")[0]] || k} | ${dasar[0][k].perkara} | ${Object.keys(dasar[0][k].kode).length} | ${f(a.otomatis, b.otomatis)} | ${f(a.ragu, b.ragu)} | ${f(a.manual, b.manual)} | ${f(a.ecourt, b.ecourt)} | ${f(a.kosong, b.kosong)} | ${msMin(dasar, k)} -> ${msMin(baru, k)} |`);
}
p();
p("## 2. Ruas per jenis: keadaan sebelum dan sesudah");
p();
p("Kolom o/r/m/e/k = jumlah perkara (dari n) yang otomatis / ragu / manual / e-Court / kosong. `label` = punya label bahasa mudah, `pil` = punya pilihan bawaan, `gerbang` = status ledger `gerbang-isian.json` (kode@posita atau @sipp). Hanya ruas yang belum seluruhnya otomatis dan dipakai >= 3 blangko, atau yang berubah.");
p();
for (const k of kunci) {
  const d = dasar[0][k];
  const b = baru[0][k];
  const baru_ = Object.entries(b.kode);
  const tampil = baru_
    .map(([kode, c]) => ({ kode, c, d: d.kode[kode] }))
    .filter(({ kode, c, d: x }) => (c.otomatis < b.perkara && c.pakai >= 3) || (x && JSON.stringify([x.otomatis, x.ragu, x.manual, x.ecourt, x.kosong]) !== JSON.stringify([c.otomatis, c.ragu, c.manual, c.ecourt, c.kosong])) || labelSebelum(kode) !== labelSesudah(kode))
    .sort((x, y) => y.c.pakai - x.c.pakai);
  if (!tampil.length) continue;
  p(`### ${k} - ${NAMA_JENIS[k.split("/")[0]] || ""} (n = ${b.perkara}, ${b.blangko} blangko)`);
  p();
  p("| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |");
  p("| --- | --- | ---: | --- | --- | --- | --- | --- |");
  for (const { kode, c, d: x } of tampil.slice(0, 40)) {
    const g = ledger[kode] ? Object.entries(ledger[kode].asal || {}).map(([a, v]) => `${a}:${v.status}`).join(" ") : "-";
    const s = (z) => (z ? `${z.otomatis}/${z.ragu}/${z.manual}/${z.ecourt || 0}/${z.kosong}` : "-");
    p(`| ${kode} | ${String(c.nama).replace(/\|/g, "/").slice(0, 60)} | ${c.pakai} | ${s(x)} | ${s(c)} | ${labelSebelum(kode) ? "ada" : "-"} -> ${labelSesudah(kode) ? "ada" : "-"} | ${pilSebelum(kode) ? "ada" : "-"} -> ${pilSesudah(kode) ? "ada" : "-"} | ${g} |`);
  }
  p();
}
p("## 3. Kamus per jenis (benih) - bunyi keluaran, pola, performa");
p();
p("Atas seluruh posita jenis itu sejak 2022-06 di `sipp_donggala`. `ringkas`/`lengkap` = jumlah perkara yang menghasilkan kalimat pokok keterangan saksi; `usulan/perkara` = variabel bernomor ABT yang terbaca per perkara; waktu murni CPU (tanpa kueri SIPP).");
p();
p("| jenis kamus | perkara | ringkas | lengkap | usulan/perkara | kunci fakta | ms/perkara |");
p("| --- | ---: | --- | --- | --- | --- | --- |");
for (const k of Object.keys(kd)) {
  const a = kd[k];
  const b = kb[k];
  const f = (x, y) => (x === y ? `${x}` : `${x} -> **${y}**`);
  p(`| ${k} (${b.id}) | ${b.perkara} | ${f(a.ringkas, b.ringkas)} | ${f(a.lengkap, b.lengkap)} | ${(a.usulan / a.perkara).toFixed(2)} -> ${(b.usulan / b.perkara).toFixed(2)} | ${Object.keys(a.fakta).length} -> ${Object.keys(b.fakta).length} | ${a.msPerPerkara} -> ${b.msPerPerkara} |`);
}
p();
p("## 4. Ketepatan modul deteksi atas isian petugas (ABT lokal)");
p();
p("sama = nilai identik setelah huruf kecil dan buang tanda; mirip = salah satu memuat yang lain; beda = lain. Pembanding teks biasa MENGHUKUM sinonim (Perjaka/Jejaka); lihat `UKURAN-GERBANG-MAKNA-27OKT.json` untuk pembanding makna.");
p();
for (const j of Object.keys(ak).sort((a, b) => ak[b].perkara - ak[a].perkara)) {
  const baris2 = Object.entries(ak[j].kode).filter(([, c]) => c.sama + c.mirip + c.beda >= 5);
  if (!baris2.length) continue;
  p(`**${NAMA_JENIS[j] || j}** - ${ak[j].perkara} perkara ber-ABT; deteksi ${as[j] ? as[j].msPerPerkara : "-"} -> ${ak[j].msPerPerkara} ms/perkara`);
  p();
  p("| ruas | banding | sama | mirip | beda | hanya mesin | hanya petugas |");
  p("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [kode, c] of baris2.sort((x, y) => y[1].sama + y[1].mirip + y[1].beda - (x[1].sama + x[1].mirip + x[1].beda)).slice(0, 14)) p(`| ${kode} | ${c.sama + c.mirip + c.beda} | ${c.sama} | ${c.mirip} | ${c.beda} | ${c.hanyaDeteksi} | ${c.hanyaPetugas} |`);
  p();
}
fs.mkdirSync(path.join(akar, "docs", "kamus"), { recursive: true });
fs.writeFileSync(path.join(akar, "docs", "kamus", "inventaris-perkara-lain-27okt.md"), baris.join("\n") + "\n");
console.log("ditulis", baris.length, "baris");
