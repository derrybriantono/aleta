// Mengukur pengisi izin poligami (deteksi lama + isiOtomatisW2b/poligami.js) atas perkara NYATA di SIPP lokal sipp_donggala
// (jenis 341 izin poligami; snapshot s.d. 2025). Menulis hasil mentah ke docs/gelombang2/UKURAN-W2b-poligami.json.
// Pakai: node abt-paket/w2b-keluarga-lain/alat/ukur_poligami.cjs [--tulis]
"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..", "..");
const MYSQL = "D:\\satker asal\\website pa bungku\\xampp\\mysql\\bin\\mysql.exe";
const deteksi = require(path.join(REPO, "aleta_bot", "services", "deteksi", "poligami.js"));
const W2B = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisW2b", "poligami.js"));
const P = require(path.join(REPO, "aleta_bot", "services", "deteksi", "pembantuKebendaan.js"));
const petitumBerbutir = require(path.join(REPO, "aleta_bot", "services", "petitumBerbutir.js"));

function tanya(sql) {
  const r = spawnSync(MYSQL, ["-h127.0.0.1", "-uroot", "--default-character-set=utf8", "-N", "-B", "sipp_donggala", "-e", sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((b) => b.split("\t").map((x) => x.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\")));
}

const baris = tanya(
  "SELECT p.perkara_id, p.nomor_perkara, IFNULL(p.posita,''), IFNULL(p.petitum,''), IFNULL(pp.amar_putusan,'') FROM perkara p LEFT JOIN perkara_putusan pp ON pp.perkara_id=p.perkara_id WHERE p.jenis_perkara_id=341 ORDER BY p.perkara_id"
);

const KODE_LAMA = ["8723", "8724", "8725", "1152", "8720", "8722", "8726"];
const KODE_BARU = ["4850", "4851", "4852", "4854", "4855", "4856"];
const per = [];
const hitung = {};
for (const k of [...KODE_LAMA, ...KODE_BARU]) hitung[k] = 0;
let berposita = 0;
let namaCocok = 0;
let namaAda = 0;
let petitumIzin = 0;
for (const [id, nomor, posita, petitum, amar] of baris) {
  const polos = P.satuBaris(posita);
  const adaPosita = polos.length > 200;
  if (adaPosita) berposita += 1;
  const h = adaPosita ? deteksi.deteksi(posita, { petitum }) : {};
  const butir = petitumBerbutir.petitumBerbutir(petitum, { posita, jenis: 341, alur: 15 });
  const jenis = butir.butir.map((b) => b.jenis);
  if (jenis.includes("poligami")) petitumIzin += 1;
  const rinci = { perkaraId: Number(id), nomor, adaPosita, panjangPosita: polos.length, jenisPetitum: jenis, kode: {} };
  for (const k of [...KODE_LAMA, ...KODE_BARU]) {
    if (h[k]) {
      hitung[k] += 1;
      rinci.kode[k] = { nilai: h[k].nilai, yakin: h[k].yakin };
    }
  }
  if (h["8723"]) {
    namaAda += 1;
    const depan = P.normal(h["8723"].nilai).split(" ").slice(0, 2).join(" ");
    const cocok = depan && P.normal(amar).includes(depan);
    rinci.namaCalonCocokAmar = Boolean(cocok);
    if (cocok) namaCocok += 1;
  }
  rinci.petunjukKeadaan = adaPosita ? W2B.petunjukKeadaan(polos, petitum) : {};
  per.push(rinci);
}

// coverage petunjuk keadaan: sikap istri setuju vs putusan dikabulkan (amar "Mengabulkan")
let setuju = 0;
let setujuKabul = 0;
for (const [i, r] of per.entries()) {
  if (r.petunjukKeadaan.sikapIstri === "setuju") {
    setuju += 1;
    if (/Mengabulkan/i.test(baris[i][4])) setujuKabul += 1;
  }
}

const hasil = {
  versi: "ukuran-w2b-poligami/1",
  tanggal: "2026-10-21",
  sumber: "SIPP lokal sipp_donggala (snapshot s.d. 2025), perkara jenis 341",
  batas: "hanya 12 perkara nyata (8 berposita); tidak ada isian petugas ABT pembanding untuk kode 4850-4856 (kode baru) maupun untuk 8720-8726 pada 12 perkara ini; ketepatan hanya dapat diuji terhadap amar (nama calon istri)",
  jumlahPerkara: baris.length,
  berposita,
  petitumMengandungIzinPoligami: petitumIzin,
  kodeTerbaca: hitung,
  namaCalonIstri: { terbaca: namaAda, cocokDenganAmar: namaCocok },
  sikapIstriSetuju: { terbaca: setuju, putusanMengabulkan: setujuKabul },
  perPerkara: per,
};
if (process.argv.includes("--tulis")) {
  const keluar = path.join(REPO, "docs", "gelombang2", "UKURAN-W2b-poligami.json");
  fs.mkdirSync(path.dirname(keluar), { recursive: true });
  fs.writeFileSync(keluar, `${JSON.stringify(hasil, null, 2)}\n`);
  console.log("ditulis", keluar);
}
console.log(JSON.stringify({ ...hasil, perPerkara: undefined }, null, 1));
