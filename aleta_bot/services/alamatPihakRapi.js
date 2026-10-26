"use strict";

/**
 * ============================================================================
 * ALAMAT PIHAK TANPA EKOR WILAYAH GANDA - KEMBARAN BOT (26 Okt 2026)
 * ============================================================================
 *
 * Putusan 620/Pdt.G/2026/PA.Dgl: identitas Penggugat tercetak
 *   "Kelurahan Ganti, Kecamatan Banawa , Kabupaten Donggala, Provinsi Sulawesi Tengah,
 *    Ganti, Banawa, Kabupaten Donggala, Sulawesi Tengah"
 * SIPP/e-Court menempelkan nama desa, kecamatan, kabupaten, dan provinsi RESMI (tanpa sebutan
 * tingkatan) di ujung alamat yang diketik. Perapi lengkapnya ada di portal
 * (manajemen_surat/src/lib/alamat-pihak.ts, rapikanAlamat); file ini adalah KEMBARANNYA untuk
 * bot, dengan aturan yang SAMA untuk bagian yang menyangkut ekor ganda:
 *
 *   - spasi, koma, titik ujung dirapikan; potongan BERSEBUTAN yang kembar berurutan dibuang;
 *   - empat potongan terakhir "desa, kecamatan, Kabupaten/Kota X, provinsi" (desa dan
 *     kecamatan tanpa sebutan) dikenali sebagai ekor sistem: tingkatan yang SUDAH disebut di
 *     depan dibuang dari ekor, yang belum dipertahankan dengan sebutannya;
 *   - kabupaten/provinsi ekor yang berbeda dari yang diketik = bentrok, alamat dibiarkan;
 *   - "Domisili elektronik : surel" dipindah ke ujung, ekor sesudah surel ikut diperiksa.
 *
 * Yang SENGAJA tidak ada di sini (hanya di portal): membuang petunjuk arah di dalam kurung dan
 * memberi sebutan pada potongan lain. Kembaran SQL-nya (fungsi isian_rtf_alamat, paket ABT
 * abt-alamat-ganda-26okt) memakai himpunan aturan yang sama dengan file ini; uji
 * alamat-ganda-26okt menjaga portal, bot, dan SQL tetap sama atas korpus bersama.
 */

const fs = require("fs");
const path = require("path");

let _data = null;
function dataKelurahan() {
  if (_data) return _data;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "kamus-deteksi", "kelurahan-sulteng.json"), "utf8"));
    _data = { kelurahan: new Set(j.kelurahan || []), kabupaten: new Set(j.kabupaten || []) };
  } catch {
    _data = { kelurahan: new Set(), kabupaten: new Set() };
  }
  return _data;
}

const PROVINSI_KUNCI = new Set([
  "aceh", "sumaterautara", "sumaterabarat", "riau", "jambi", "sumateraselatan", "bengkulu", "lampung",
  "kepulauanbangkabelitung", "bangkabelitung", "kepulauanriau", "dkijakarta", "jakarta", "jawabarat",
  "jawatengah", "diyogyakarta", "daerahistimewayogyakarta", "yogyakarta", "jawatimur", "banten", "bali",
  "nusatenggarabarat", "nusatenggaratimur", "kalimantanbarat", "kalimantantengah", "kalimantanselatan",
  "kalimantantimur", "kalimantanutara", "sulawesiutara", "sulawesitengah", "sulawesiselatan",
  "sulawesitenggara", "gorontalo", "sulawesibarat", "maluku", "malukuutara", "papua", "papuabarat",
  "papuaselatan", "papuatengah", "papuapegunungan", "papuabaratdaya",
]);

const TINGKATAN = [
  { kunci: "desa", sebutan: ["desa", "kelurahan", "kel", "ds"] },
  { kunci: "kecamatan", sebutan: ["kecamatan", "kec"] },
  { kunci: "kabupaten", sebutan: ["kabupaten", "kabupaten/kota", "kota", "kab"] },
  { kunci: "provinsi", sebutan: ["provinsi", "propinsi", "prov"] },
];

const SEBUTAN_DALAM = {
  desa: /\b(?:desa|kelurahan|kel|ds)\b\.?\s*[a-z]/i,
  kecamatan: /\b(?:kecamatan|kec)\b\.?\s*[a-z]/i,
  kabupaten: /\b(?:kabupaten|kab)\b\.?\s*[a-z]|(?:^|,\s*)kota\s+[a-z]/i,
  provinsi: /\b(?:provinsi|propinsi|prov)\b\.?\s*[a-z]/i,
};

const BUKAN_NAMA_WILAYAH =
  /^(?:rt|rw|dusun|dsn|dukuh|jalan|jl|jln|gang|gg|lorong|lrg|blok|komp|komplek|perum|perumahan|btn|no|nomor|lingkungan|lk|link)\b/i;

const bersih = (v) => String(v == null ? "" : v).trim();

function rapikanTandaBaca(teks) {
  return teks
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/\s*\.\s*$/, "")
    .replace(/^[\s,]+/, "")
    .replace(/[\s,]+$/, "")
    .trim();
}

function tingkatanPada(potong) {
  const rendah = String(potong).toLowerCase().trim();
  for (const tingkat of TINGKATAN) {
    for (const sebutan of tingkat.sebutan) {
      if (new RegExp(`^${sebutan}\\b\\.?\\s`, "i").test(rendah)) return tingkat.kunci;
    }
  }
  return "";
}

function kunciTempat(potong) {
  return bersih(potong)
    .toLowerCase()
    .replace(/^(?:kabupaten\/kota|kabupaten|kecamatan|kelurahan|provinsi|propinsi|desa|kab|kec|kel|prov|kota|ds)\b\.?\s*/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function namaWilayahSah(potong) {
  const x = bersih(potong);
  if (!x || x.length > 60) return false;
  if (/[\d@():/]/.test(x)) return false;
  if (/^(?:desa|kelurahan|kel|ds|kecamatan|kec|kabupaten|kab|kota|provinsi|propinsi|prov)\.?$/i.test(x)) return false;
  if (BUKAN_NAMA_WILAYAH.test(x)) return false;
  return !/domisili|surel|email/i.test(x);
}

function miripTempat(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) return true;
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let awal = 0;
  const pendek = Math.min(a.length, b.length);
  while (awal < pendek && a[awal] === b[awal]) awal += 1;
  let akhir = 0;
  while (akhir < pendek - awal && a[a.length - 1 - akhir] === b[b.length - 1 - akhir]) akhir += 1;
  return awal + akhir >= pendek - (a.length === b.length ? 1 : 0);
}

function jenisDesaBawaan(desa, kec, kab) {
  const d = dataKelurahan();
  const kk = kunciTempat(kab);
  if (d.kelurahan.has(`${kunciTempat(desa)}|${kunciTempat(kec)}|${kk}`)) return "Kelurahan";
  if (d.kabupaten.has(kk)) return "Desa";
  return /^kota\b/i.test(kab) ? "Kelurahan" : "Desa";
}

/** Mengenali dan menyusun ulang ekor wilayah sistem; null bila bukan ekor sistem atau bentrok. */
function ekorSistem(potongan, opsi) {
  const n = potongan.length;
  if (n < 4) return null;
  const [desa, kec, kab, prov] = potongan.slice(n - 4);
  if (tingkatanPada(desa) || tingkatanPada(kec) || !namaWilayahSah(desa) || !namaWilayahSah(kec)) return null;
  if (tingkatanPada(kab) !== "kabupaten" || tingkatanPada(prov) || !PROVINSI_KUNCI.has(kunciTempat(prov))) return null;

  const depan = potongan.slice(0, n - 4);
  const teksDepan = depan.join(", ");
  const padatDepan = teksDepan.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const kunciPolos = new Set(depan.filter((x) => !tingkatanPada(x)).map(kunciTempat));
  const sudah = (tingkat, nama) => SEBUTAN_DALAM[tingkat].test(teksDepan) || kunciPolos.has(kunciTempat(nama));

  if (SEBUTAN_DALAM.kabupaten.test(teksDepan)) {
    const kk = kunciTempat(kab);
    const cocok =
      (kk.length >= 3 && padatDepan.includes(kk)) ||
      depan.some((x) => tingkatanPada(x) === "kabupaten" && miripTempat(kunciTempat(x), kk));
    if (!cocok) return null;
  }
  if (SEBUTAN_DALAM.provinsi.test(teksDepan)) {
    const kp = kunciTempat(prov);
    const cocokProv =
      padatDepan.includes(kp) ||
      depan.some((x) => {
        if (tingkatanPada(x) !== "provinsi") return false;
        const kx = kunciTempat(x);
        return (kx.length >= 4 && kp.startsWith(kx)) || miripTempat(kx, kp);
      });
    if (!cocokProv) return null;
  }

  const baru = [...depan];
  const dibuang = [];
  const jenis = (opsi && opsi.jenisDesa ? opsi.jenisDesa(desa, kec, kab) : "") || jenisDesaBawaan(desa, kec, kab);
  if (sudah("desa", desa)) dibuang.push(desa);
  else baru.push(`${jenis} ${desa}`);
  if (sudah("kecamatan", kec)) dibuang.push(kec);
  else baru.push(`Kecamatan ${kec}`);
  if (sudah("kabupaten", kab)) dibuang.push(kab);
  else baru.push(kab);
  if (sudah("provinsi", prov)) dibuang.push(prov);
  else baru.push(`Provinsi ${prov}`);
  return { potongan: baru, dibuang };
}

/** Alamat tanpa domisili elektronik: rapi, potongan kembar bersebutan, ekor sistem. */
function rapikanPokok(masukan, opsi) {
  const rapi = rapikanTandaBaca(bersih(masukan));
  if (!rapi) return { alamat: "", ekorSistem: false };
  const potongan = rapi.split(",").map(bersih).filter(Boolean);
  for (let i = potongan.length - 1; i > 0; i -= 1) {
    if (tingkatanPada(potongan[i]) && potongan[i].toLowerCase() === potongan[i - 1].toLowerCase()) potongan.splice(i, 1);
  }
  const sis = ekorSistem(potongan, opsi);
  if (sis) return { alamat: rapikanTandaBaca(sis.potongan.join(", ")), ekorSistem: true };
  return { alamat: rapikanTandaBaca(potongan.join(", ")), ekorSistem: false };
}

/**
 * @param {string} masukan alamat dari SIPP
 * @param {{jenisDesa?: (desa:string, kec:string, kab:string) => "Desa"|"Kelurahan"|""}} [opsi]
 * @returns {{alamat: string, ekorSistem: boolean}}
 */
function rapikanAlamatPihak(masukan, opsi) {
  const asli = bersih(masukan);
  // Bagian "Domisili elektronik : surel" dipertahankan APA ADANYA (huruf besar/kecil dan titik dua seperti diketik), hanya spasinya dipadatkan.
  const domisili =
    /^([\s\S]*?)([.,;]?)\s*(?:dengan\s+)?(Domisili\s+elektronik\s*:?\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})([\s\S]*)$/i.exec(asli);
  if (!domisili || !bersih(domisili[1])) return rapikanPokok(asli, opsi);
  const sambung = domisili[2] === "." ? "." : ",";
  const surel = domisili[3].replace(/\s+/g, " ");
  const ekorMentah = bersih(domisili[4]);
  if (ekorMentah) {
    const gabung = rapikanPokok(`${domisili[1]}, ${ekorMentah}`, opsi);
    if (gabung.ekorSistem) return { alamat: `${gabung.alamat}${sambung} ${surel}`, ekorSistem: true };
  }
  const pokok = rapikanPokok(domisili[1], opsi);
  const ekor = ekorMentah.split(",").map(bersih).filter(Boolean).join(", ");
  return { alamat: `${pokok.alamat}${sambung} ${surel}${ekor ? `, ${ekor}` : ""}`, ekorSistem: false };
}

// _dalam: untuk uji dan pengukuran (alat/ukur_server.js), bukan antarmuka bot.
module.exports = {
  rapikanAlamatPihak,
  kunciTempat,
  miripTempat,
  _dalam: { ekorSistem, tingkatanPada, namaWilayahSah, rapikanTandaBaca, PROVINSI_KUNCI },
};
