"use strict";
/**
 * Ukur fungsi alamat atas alamat pihak SUNGGUHAN (diambil BACA-SAJA dari SIPP server: perkara_pihak1/2/4 perkara 2025-2026).
 * Masukan: JSON [[sisi, perkara_id, urutan, alamat], ...] di luar repo (berisi data pribadi). Keluaran: hitungan saja, tanpa alamat.
 * pakai: node ukur_server.js D:/Aplikasi/aleta/tmp/w82/alamat.json
 */
const fs = require("fs");
const path = require("path");
const { rapikanAlamatPihak, _dalam } = require("../../../aleta_bot/services/alamatPihakRapi.js");

const berkas = process.argv[2] || path.join("D:/Aplikasi/aleta/tmp/w82", "alamat.json");
const baris = JSON.parse(fs.readFileSync(berkas, "utf8"));
const NAMA = { 1: "Pemohon/Penggugat", 2: "Termohon/Tergugat", 4: "Turut Tergugat/Termohon" };

function polaEkor(alamat) {
  // bentuk ekor sistem pada alamat tanpa domisili elektronik/surel: D, C, Kabupaten/Kota K, provinsi
  const t = _dalam.rapikanTandaBaca(String(alamat || ""));
  const p = t.split(",").map((x) => x.trim()).filter((x) => x && !/@|domisili/i.test(x));
  const n = p.length;
  if (n < 4) return false;
  const [d, c, k, v] = p.slice(n - 4);
  return !_dalam.tingkatanPada(d) && !_dalam.tingkatanPada(c) && _dalam.namaWilayahSah(d) && _dalam.namaWilayahSah(c) && _dalam.tingkatanPada(k) === "kabupaten" && !_dalam.tingkatanPada(v);
}

const hit = {};
for (const [sisi, , , alamat] of baris) {
  const s = (hit[sisi] = hit[sisi] || { total: 0, kosong: 0, ekor: 0, ganda: 0, sebutan: 0, bentrok: 0, berubah: 0, rusak: 0 });
  s.total += 1;
  const a = String(alamat || "").trim();
  if (!a) {
    s.kosong += 1;
    continue;
  }
  const r = rapikanAlamatPihak(a);
  const pola = polaEkor(a);
  const tanpaSurel = (x) => x.replace(/,?\s*(?:dengan\s+)?domisili\s+elektronik\s*:?\s*\S+@\S+/i, "").split(",").filter((y) => y.trim() && !/@/.test(y)).length;
  if (r.ekorSistem) {
    s.ekor += 1;
    if (tanpaSurel(r.alamat) < tanpaSurel(a)) s.ganda += 1;
    else s.sebutan += 1;
  } else if (pola) {
    s.bentrok += 1;
  }
  if (r.alamat !== a) s.berubah += 1;
  if (!r.alamat) s.rusak += 1;
}
const ringkas = {};
for (const [sisi, v] of Object.entries(hit)) ringkas[NAMA[sisi] || sisi] = v;
console.log(JSON.stringify(ringkas, null, 1));
const total = Object.values(hit).reduce((x, v) => x + v.total, 0);
const ganda = Object.values(hit).reduce((x, v) => x + v.ganda, 0);
const ekor = Object.values(hit).reduce((x, v) => x + v.ekor, 0);
const bentrok = Object.values(hit).reduce((x, v) => x + v.bentrok, 0);
const berubah = Object.values(hit).reduce((x, v) => x + v.berubah, 0);
console.log(`alamat ${total}; berekor sistem ${ekor} (ganda dibuang ${ganda}, hanya diberi sebutan ${ekor - ganda}); pola ekor tetapi bentrok ${bentrok}; berubah ${berubah}`);
