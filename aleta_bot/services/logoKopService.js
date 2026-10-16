"use strict";

/**
 * ============================================================================
 * LOGO KOP BLANGKO DERRY - PINDAI, PRATINJAU, DAN PAKET GANTI LOGO
 * ============================================================================
 *
 * 17 Oktober 2026 (keputusan pengguna butir 4: logo kop TETAP logo satker,
 * diatur dari admin). Halaman "Pengaturan SIPP & ABT" > Identitas satker
 * menyimpan logo satker di ALETA; berkas ini membawanya ke blangko Derry.
 *
 * LOGO ADA DI DALAM RTF. Blangko ABT menanam gambar sebagai kelompok
 * {\pict ... <heksa>} - di dalam bentuk mengambang ({\shp ... {\sn pib}}),
 * cadangan untuk Word lama ({\shprslt ...} / {\nonshppict ...}), atau lepas.
 * Logo kop dipakai amplop relaas, permohonan delegasi, dan surat tercatat;
 * logo kecil yang sama juga ada di kotak "Ditandatangani secara elektronik"
 * blangko PTSP gabungan (@ 0).
 *
 * TIDAK MENULIS KE BLANGKO. Folder _blangko_abt dipasang HANYA-BACA di
 * container bot (diukur di server 17 Okt 2026: rw=false), dan memang harus
 * begitu. Karena itu penggantian dikerjakan seperti paket ABT lain:
 *
 *   1. pindai()      - semua gambar di blangko Derry, dikelompokkan per isi
 *                      (md5 bita gambar), beserta tebakan "logo" dan alasannya;
 *   2. bangunPaket() - menulis PAKET ke folder runtime bot (terpasang ke
 *                      server): RTF pengganti + daftar.tsv (md5 lama/baru) +
 *                      pasang.sh (PRASYARAT md5 lama, CADANGAN, ganti,
 *                      PERIKSA md5 baru) + pulih.sh;
 *   3. petugas server menjalankan pasang.sh (sesi utama, sesudah izin
 *      pengguna). Prasyarat gagal = tidak ada yang diubah.
 *
 * GEOMETRI: gambar baru dimuat DI DALAM kotak gambar lama dengan
 * perbandingan sisi gambar baru (tidak gepeng), dipusatkan. Untuk bentuk
 * mengambang, kotak bentuk (\shpleft..\shpbottom) ikut disesuaikan - Word
 * merentang gambar ke kotak bentuknya.
 */

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

// ---------------------------------------------------------------------------
// Membaca RTF
// ---------------------------------------------------------------------------

/** Akhir kelompok RTF yang dibuka di `awal` ("{"), -1 bila tidak seimbang. */
function akhirKelompok(rtf, awal) {
  let d = 0;
  for (let i = awal; i < rtf.length; i++) {
    const c = rtf[i];
    if (c === "\\") {
      const m = /^\\bin(\d+) ?/.exec(rtf.slice(i, i + 16));
      if (m) {
        i += m[0].length - 1 + Number(m[1]);
        continue;
      }
      i += 1;
      continue;
    }
    if (c === "{") d += 1;
    else if (c === "}") {
      d -= 1;
      if (d === 0) return i;
    }
  }
  return -1;
}

/** Teks kasar sebuah potongan RTF (kendali & kurung dibuang) - untuk mengenali isi kotak teks. */
function teksKasar(s) {
  return String(s || "")
    .replace(/[0-9a-fA-F]{64,}/g, " ")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, " ")
    .replace(/[{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const angka = (re, s) => {
  const m = re.exec(s);
  return m ? Number(m[1]) : null;
};

/**
 * Satu kelompok {\pict}: kepala (kata kendali + {\*\blipuid}) lalu data heksa.
 * @returns {{awal, akhir, kepala, heks, isi: Buffer, md5, blip, picw, pich, goalW, goalH, skalaX, skalaY} | null}
 */
function uraiPict(rtf, awal) {
  const akhir = akhirKelompok(rtf, awal);
  if (akhir < 0) return null;
  let j = awal + "{\\pict".length;
  // Kepala: kata kendali, spasi/baris, dan kelompok bersarang ({\*\blipuid ...}).
  for (;;) {
    while (j < akhir && /\s/.test(rtf[j])) j++;
    if (rtf[j] === "\\") {
      const m = /^\\(?:[a-zA-Z]+-?\d* ?|[^a-zA-Z])/.exec(rtf.slice(j, j + 40));
      if (!m) break;
      if (/^\\bin\d/.test(m[0])) return null; // data biner mentah - tidak dikenali
      j += m[0].length;
      continue;
    }
    if (rtf[j] === "{") {
      const k = akhirKelompok(rtf, j);
      if (k < 0 || k > akhir) return null;
      j = k + 1;
      continue;
    }
    break;
  }
  const kepala = rtf.slice(awal, j);
  const heks = rtf.slice(j, akhir).replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]*$/.test(heks)) return null;
  const isi = Buffer.from(heks.length % 2 ? heks.slice(0, -1) : heks, "hex");
  const blip = (/\\(pngblip|jpegblip|emfblip|wmetafile\d*|dibitmap\d*|wbitmap\d*|macpict)/.exec(kepala) || [])[1] || "";
  return {
    awal,
    akhir,
    kepala,
    isi,
    md5: isi.length ? md5(isi) : "",
    blip,
    picw: angka(/\\picw(\d+)/, kepala),
    pich: angka(/\\pich(\d+)/, kepala),
    goalW: angka(/\\picwgoal(\d+)/, kepala),
    goalH: angka(/\\pichgoal(\d+)/, kepala),
    skalaX: angka(/\\picscalex(\d+)/, kepala) || 100,
    skalaY: angka(/\\picscaley(\d+)/, kepala) || 100,
  };
}

function rentangKelompok(rtf, re) {
  const hasil = [];
  const g = new RegExp(re.source, "g");
  let m;
  while ((m = g.exec(rtf))) {
    const akhir = akhirKelompok(rtf, m.index);
    if (akhir < 0) continue;
    hasil.push({ awal: m.index, akhir });
    g.lastIndex = akhir + 1;
  }
  return hasil;
}

/** Kotak teks "Ditandatangani secara elektronik ..." sesudah `dari` (bentuk berikutnya). */
function kotakElektronikSesudah(rtf, dari) {
  const potong = rtf.slice(dari, dari + 9000);
  const i = potong.search(/\{\\shp(?![a-z])/);
  if (i < 0) return false;
  const akhir = akhirKelompok(potong, i);
  const bentuk = potong.slice(i, akhir < 0 ? potong.length : akhir + 1);
  return /\\shptxt/.test(bentuk) && /ditandatangani\s+secara\s+elektronik/i.test(teksKasar(bentuk));
}

/**
 * Semua gambar dalam satu RTF, dengan tempatnya:
 *   bentuk   - indeks bentuk {\shp} yang memuatnya (-1 = lepas)
 *   peran    - 'pib' (gambar bentuk), 'cadangan' (shprslt / nonshppict), 'lepas'
 *   nama     - wzDescription / wzName bentuknya
 *   kotakElektronik - gambar bentuk yang diikuti kotak "Ditandatangani secara elektronik"
 */
function petakanGambar(rtf) {
  const s = String(rtf || "");
  const bentuk = rentangKelompok(s, /\{\\shp(?![a-z])/).map((b) => {
    const isi = s.slice(b.awal, b.akhir + 1);
    const rslt = isi.search(/\{\\shprslt/);
    const nama =
      (/\{\\sn\s*wzDescription\}\s*\{\\sv\s*([^}]*)\}/.exec(isi) || [])[1] ||
      (/\{\\sn\s*wzName\}\s*\{\\sv\s*([^}]*)\}/.exec(isi) || [])[1] ||
      "";
    const geo = /\\shpleft(-?\d+)\s*\\shptop(-?\d+)\s*\\shpright(-?\d+)\s*\\shpbottom(-?\d+)/.exec(isi);
    return {
      ...b,
      rslt: rslt < 0 ? -1 : b.awal + rslt,
      nama: nama.replace(/\\'5c/gi, "\\").trim(),
      geo: geo ? { kiri: +geo[1], atas: +geo[2], kanan: +geo[3], bawah: +geo[4], di: b.awal + geo.index, panjang: geo[0].length } : null,
      kotakElektronik: kotakElektronikSesudah(s, b.akhir + 1),
    };
  });
  const shppict = rentangKelompok(s, /\{\\\*\\shppict/);
  const nonshppict = rentangKelompok(s, /\{\\nonshppict/);
  const gambar = [];
  const re = /\{\\pict(?![a-z])/g;
  let m;
  while ((m = re.exec(s))) {
    const p = uraiPict(s, m.index);
    if (!p) continue;
    re.lastIndex = p.akhir + 1;
    const b = bentuk.findIndex((x) => p.awal > x.awal && p.akhir < x.akhir);
    const dalamShppict = shppict.findIndex((x) => p.awal > x.awal && p.akhir < x.akhir);
    const dalamNon = nonshppict.findIndex((x) => p.awal > x.awal && p.akhir < x.akhir);
    let peran = "lepas";
    if (b >= 0) peran = bentuk[b].rslt >= 0 && p.awal > bentuk[b].rslt ? "cadangan" : "pib";
    else if (dalamNon >= 0) peran = "cadangan";
    gambar.push({
      ...p,
      bentuk: b,
      shppict: dalamShppict,
      nonshppict: dalamNon,
      peran,
      nama: b >= 0 ? bentuk[b].nama : "",
      kotakElektronik: b >= 0 ? bentuk[b].kotakElektronik : false,
    });
  }
  return { bentuk, shppict, nonshppict, gambar };
}

// ---------------------------------------------------------------------------
// Gambar baru
// ---------------------------------------------------------------------------

function jenisLogo(isi) {
  const b = Buffer.from(isi || []);
  if (b.length > 8 && b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG") return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  return "";
}

/** Ukuran piksel PNG (IHDR) / JPEG (SOFn). */
function ukuranLogo(isi) {
  const b = Buffer.from(isi || []);
  if (jenisLogo(b) === "png" && b.length >= 24) return { lebar: b.readUInt32BE(16), tinggi: b.readUInt32BE(20) };
  if (jenisLogo(b) === "jpg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const p = b[i + 1];
      const n = b.readUInt16BE(i + 2);
      if (p >= 0xc0 && p <= 0xcf && p !== 0xc4 && p !== 0xc8 && p !== 0xcc) return { lebar: b.readUInt16BE(i + 7), tinggi: b.readUInt16BE(i + 5) };
      i += 2 + n;
    }
  }
  return null;
}

/** Logo baru sah? Pulang {isi, jenis, lebar, tinggi, md5} atau melempar. */
function siapkanLogo(logo) {
  const isi = Buffer.isBuffer(logo && logo.isi) ? logo.isi : Buffer.from(String((logo && logo.base64) || ""), "base64");
  const jenis = jenisLogo(isi);
  if (!jenis) throw Object.assign(new Error("Logo harus PNG atau JPG."), { ditolak: true, kode: "logo_tidak_sah" });
  if (isi.length > 3 * 1024 * 1024) throw Object.assign(new Error("Logo terlalu besar (lebih dari 3 MB)."), { ditolak: true, kode: "logo_tidak_sah" });
  const u = ukuranLogo(isi);
  if (!u || !u.lebar || !u.tinggi) throw Object.assign(new Error("Ukuran logo tidak terbaca."), { ditolak: true, kode: "logo_tidak_sah" });
  return { isi, jenis, lebar: u.lebar, tinggi: u.tinggi, md5: md5(isi) };
}

/** Kotak (lebar, tinggi) dimuat di dalam kotak asal dengan perbandingan sisi logo. */
function muatDalam(lebarKotak, tinggiKotak, rasio) {
  if (!(lebarKotak > 0 && tinggiKotak > 0 && rasio > 0)) return { lebar: lebarKotak, tinggi: tinggiKotak };
  if (rasio >= lebarKotak / tinggiKotak) return { lebar: lebarKotak, tinggi: Math.round(lebarKotak / rasio) };
  return { lebar: Math.round(tinggiKotak * rasio), tinggi: tinggiKotak };
}

function pictBaru(p, logo) {
  // Ukuran tampil asal (twip): goal x skala; tanpa goal = piksel x 15.
  const w0 = Math.round(((p.goalW || (p.picw || 100) * 15) * (p.skalaX || 100)) / 100);
  const h0 = Math.round(((p.goalH || (p.pich || 100) * 15) * (p.skalaY || 100)) / 100);
  const u = muatDalam(w0, h0, logo.lebar / logo.tinggi);
  const heks = logo.isi.toString("hex");
  const baris = [];
  for (let i = 0; i < heks.length; i += 128) baris.push(heks.slice(i, i + 128));
  return (
    `{\\pict\\picscalex100\\picscaley100\\piccropl0\\piccropr0\\piccropt0\\piccropb0` +
    `\\picw${logo.lebar}\\pich${logo.tinggi}\\picwgoal${u.lebar}\\pichgoal${u.tinggi}` +
    `\\${logo.jenis === "jpg" ? "jpegblip" : "pngblip"}\r\n${baris.join("\r\n")}}`
  );
}

/**
 * Mengganti gambar yang md5-nya ada di `md5Dipilih` dengan logo baru.
 * Gambar bentuk (pib) yang dipilih membawa SEMUA gambar berisi di bentuk
 * itu (cadangan shprslt) ikut diganti; gambar dalam {\*\shppict} yang
 * dipilih membawa {\nonshppict} sesudahnya. Kotak bentuk disesuaikan.
 *
 * @returns {{rtf: string, jumlah: number, bentuk: number}}
 */
function gantiGambar(rtf, md5Dipilih, logoMasuk) {
  const s = String(rtf || "");
  const logo = logoMasuk && logoMasuk.md5 ? logoMasuk : siapkanLogo(logoMasuk);
  const pilih = new Set([...(md5Dipilih || [])].map((x) => String(x).toLowerCase()));
  const peta = petakanGambar(s);
  const ganti = new Set();
  const bentukUbah = new Set();
  peta.gambar.forEach((g, i) => {
    if (!g.md5 || !pilih.has(g.md5)) return;
    ganti.add(i);
    if (g.bentuk >= 0) {
      bentukUbah.add(g.bentuk);
      peta.gambar.forEach((h, k) => {
        if (h.bentuk === g.bentuk && h.isi.length) ganti.add(k);
      });
    }
    if (g.shppict >= 0) {
      const sp = peta.shppict[g.shppict];
      const non = peta.nonshppict.find((x) => x.awal > sp.akhir && !s.slice(sp.akhir + 1, x.awal).trim());
      if (non) {
        peta.gambar.forEach((h, k) => {
          if (h.awal > non.awal && h.akhir < non.akhir && h.isi.length) ganti.add(k);
        });
      }
    }
  });
  if (!ganti.size) return { rtf: s, jumlah: 0, bentuk: 0 };

  // Sunting dari belakang supaya letak di depan tidak bergeser.
  const sunting = [];
  for (const i of ganti) {
    const g = peta.gambar[i];
    sunting.push({ awal: g.awal, akhir: g.akhir + 1, isi: pictBaru(g, logo) });
  }
  for (const b of bentukUbah) {
    const geo = peta.bentuk[b].geo;
    if (!geo) continue;
    const w0 = geo.kanan - geo.kiri;
    const h0 = geo.bawah - geo.atas;
    const u = muatDalam(w0, h0, logo.lebar / logo.tinggi);
    const kiri = geo.kiri + Math.round((w0 - u.lebar) / 2);
    const atas = geo.atas + Math.round((h0 - u.tinggi) / 2);
    sunting.push({
      awal: geo.di,
      akhir: geo.di + geo.panjang,
      isi: `\\shpleft${kiri}\\shptop${atas}\\shpright${kiri + u.lebar}\\shpbottom${atas + u.tinggi}`,
    });
  }
  sunting.sort((a, b) => b.awal - a.awal);
  let hasil = s;
  for (const x of sunting) hasil = hasil.slice(0, x.awal) + x.isi + hasil.slice(x.akhir);
  return { rtf: hasil, jumlah: ganti.size, bentuk: bentukUbah.size };
}

// ---------------------------------------------------------------------------
// Tebakan logo
// ---------------------------------------------------------------------------

/**
 * Gambar ini logo satker? Alasan dikembalikan supaya admin dapat menilai.
 * Hanya TEBAKAN untuk pilihan bawaan di layar - yang diganti tetap pilihan admin.
 */
function tebakLogo(g, rel) {
  if (g.kotakElektronik) return "logo di kotak tanda tangan elektronik";
  if (/logo|\blg\b/i.test(g.nama || "")) return `nama gambar "${String(g.nama).slice(0, 60)}"`;
  if (/(^|\/)(\d+\s+)?relaas\//i.test(rel || "") && g.peran === "pib") return "gambar kop blangko relaas";
  return "";
}

// ---------------------------------------------------------------------------
// Pindai folder blangko Derry
// ---------------------------------------------------------------------------

async function daftarRtf(akar, kedalamanMaks = 4) {
  const berkas = [];
  async function jelajah(dir, k) {
    if (k > kedalamanMaks) return;
    let isi = [];
    try {
      isi = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of isi) {
      const j = path.join(dir, e.name);
      if (e.isDirectory()) await jelajah(j, k + 1);
      else if (/\.rtf$/i.test(e.name)) berkas.push(j);
    }
  }
  await jelajah(akar, 0);
  return berkas.sort();
}

const relDari = (akar, jalur) => path.relative(akar, jalur).split(path.sep).join("/");

/**
 * Semua gambar di blangko Derry dikelompokkan per isi.
 * @returns {{jumlahBerkas, gambar: Array<{md5, blip, jenis, ukuranByte, lebar, tinggi, jumlah, jumlahBerkas, berkas, nama, peran, kotakElektronik, logo, alasanLogo}>}}
 */
async function pindai(akar) {
  const berkas = await daftarRtf(akar);
  if (!berkas.length) throw Object.assign(new Error("Folder Blangko Derry tidak terbaca di server."), { ditolak: true, kode: "folder_tidak_ada" });
  const kelompok = new Map();
  for (const jalur of berkas) {
    let rtf;
    try {
      rtf = await fs.readFile(jalur, "latin1");
    } catch {
      continue;
    }
    const rel = relDari(akar, jalur);
    for (const g of petakanGambar(rtf).gambar) {
      if (!g.md5) continue;
      const k = kelompok.get(g.md5) || {
        md5: g.md5,
        blip: g.blip,
        jenis: jenisLogo(g.isi),
        ukuranByte: g.isi.length,
        ...(ukuranLogo(g.isi) || { lebar: g.picw || 0, tinggi: g.pich || 0 }),
        jumlah: 0,
        berkasSet: new Set(),
        nama: new Set(),
        peran: new Set(),
        kotakElektronik: false,
        alasanLogo: "",
      };
      k.jumlah += 1;
      k.berkasSet.add(rel);
      if (g.nama) k.nama.add(g.nama.slice(0, 80));
      k.peran.add(g.peran);
      k.kotakElektronik = k.kotakElektronik || g.kotakElektronik;
      if (!k.alasanLogo) k.alasanLogo = tebakLogo(g, rel);
      kelompok.set(g.md5, k);
    }
  }
  const gambar = [...kelompok.values()]
    .map((k) => {
      const daftar = [...k.berkasSet];
      const { berkasSet: _b, ...sisa } = k;
      void _b;
      return {
        ...sisa,
        nama: [...k.nama].slice(0, 5),
        peran: [...k.peran],
        jumlahBerkas: daftar.length,
        berkas: daftar.slice(0, 40),
        logo: Boolean(k.alasanLogo),
      };
    })
    // Gambar cadangan (WMF untuk Word lama) yang tidak pernah menjadi gambar bentuk ikut tebakan bentuknya saat diganti.
    .sort((a, b) => Number(b.logo) - Number(a.logo) || b.jumlahBerkas - a.jumlahBerkas);
  return { jumlahBerkas: berkas.length, gambar };
}

/** Bita satu gambar (untuk pratinjau) - hanya PNG/JPG. */
async function ambilGambar(akar, md5Dicari) {
  const dicari = String(md5Dicari || "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(dicari)) throw Object.assign(new Error("Kode gambar tidak sah."), { ditolak: true, kode: "ditolak" });
  for (const jalur of await daftarRtf(akar)) {
    const rtf = await fs.readFile(jalur, "latin1").catch(() => "");
    if (!rtf.includes("\\pict")) continue;
    const g = petakanGambar(rtf).gambar.find((x) => x.md5 === dicari);
    if (g) {
      const jenis = jenisLogo(g.isi);
      if (!jenis) throw Object.assign(new Error("Gambar ini bukan PNG/JPG (mis. WMF) - tidak dapat dipratinjau di peramban."), { ditolak: true, kode: "bukan_png_jpg" });
      return { isi: g.isi, jenis };
    }
  }
  throw Object.assign(new Error("Gambar tidak ditemukan di blangko Derry."), { ditolak: true, kode: "tidak_ada" });
}

// ---------------------------------------------------------------------------
// Paket
// ---------------------------------------------------------------------------

function skripPasang(akarServer) {
  return [
    "#!/bin/bash",
    "# Paket ganti logo kop blangko Derry - dibangun ALETA (Pengaturan SIPP & ABT > Identitas satker).",
    "# Jalankan sebagai root di server: bash pasang.sh   (AKAR=... untuk folder lain)",
    "set -u",
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    `AKAR="\${AKAR:-${akarServer}}"`,
    'CAD="$DIR/cadangan"',
    "[ -d \"$AKAR\" ] || { echo \"AKAR TIDAK ADA: $AKAR\"; exit 1; }",
    "gagal=0; belum=0; sudah=0",
    "while IFS=$'\\t' read -r rel lama baru n; do",
    '  [ "$rel" = "berkas" ] && continue',
    '  f="$AKAR/$rel"',
    '  if [ ! -f "$f" ]; then echo "TIDAK ADA: $rel"; gagal=1; continue; fi',
    '  m=$(md5sum "$f" | cut -d" " -f1)',
    '  if [ "$m" = "$lama" ]; then belum=$((belum+1)); elif [ "$m" = "$baru" ]; then sudah=$((sudah+1)); else echo "BERUBAH SEJAK PAKET DIBANGUN: $rel"; gagal=1; fi',
    'done < "$DIR/daftar.tsv"',
    'if [ "$gagal" != 0 ]; then echo "PRASYARAT GAGAL - tidak ada yang diubah. Bangun ulang paket dari ALETA."; exit 1; fi',
    'echo "PRASYARAT COCOK: BELUM=$belum SUDAH=$sudah"',
    'mkdir -p "$CAD"',
    "ganti=0",
    "while IFS=$'\\t' read -r rel lama baru n; do",
    '  [ "$rel" = "berkas" ] && continue',
    '  f="$AKAR/$rel"',
    '  m=$(md5sum "$f" | cut -d" " -f1)',
    '  [ "$m" = "$lama" ] || continue',
    '  mkdir -p "$CAD/$(dirname "$rel")"',
    '  [ -f "$CAD/$rel" ] || cp -p "$f" "$CAD/$rel"',
    '  cat "$DIR/rtf/$rel" > "$f"',
    "  ganti=$((ganti+1))",
    'done < "$DIR/daftar.tsv"',
    "cocok=0; salah=0",
    "while IFS=$'\\t' read -r rel lama baru n; do",
    '  [ "$rel" = "berkas" ] && continue',
    '  m=$(md5sum "$AKAR/$rel" | cut -d" " -f1)',
    '  if [ "$m" = "$baru" ]; then cocok=$((cocok+1)); else echo "TIDAK COCOK: $rel"; salah=$((salah+1)); fi',
    'done < "$DIR/daftar.tsv"',
    'echo "GANTI=$ganti COCOK=$cocok SALAH=$salah"',
    'if [ "$salah" != 0 ]; then echo "PERIKSA GAGAL - jalankan pulih.sh"; exit 1; fi',
    'echo "SELESAI - logo kop terpasang. Cadangan: $CAD  Pulih: bash $DIR/pulih.sh"',
    "",
  ].join("\n");
}

function skripPulih(akarServer) {
  return [
    "#!/bin/bash",
    "# Mengembalikan blangko sebelum paket logo kop (hanya berkas yang masih berisi hasil paket).",
    "set -u",
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    `AKAR="\${AKAR:-${akarServer}}"`,
    'CAD="$DIR/cadangan"',
    "kembali=0; biarkan=0",
    "while IFS=$'\\t' read -r rel lama baru n; do",
    '  [ "$rel" = "berkas" ] && continue',
    '  f="$AKAR/$rel"',
    '  m=$(md5sum "$f" | cut -d" " -f1)',
    '  if [ "$m" = "$baru" ] && [ -f "$CAD/$rel" ]; then cat "$CAD/$rel" > "$f"; kembali=$((kembali+1)); else echo "BIARKAN: $rel"; biarkan=$((biarkan+1)); fi',
    'done < "$DIR/daftar.tsv"',
    'echo "KEMBALI=$kembali BIARKAN=$biarkan"',
    "",
  ].join("\n");
}

/**
 * Membangun paket ganti logo di `keluarAkar/<nama>/`.
 * @param {{akar: string, keluarAkar: string, md5: string[], logo: object, akarServer: string, oleh?: string, sekarang?: Date}} p
 */
async function bangunPaket(p) {
  const logo = siapkanLogo(p.logo);
  const pilih = [...new Set((p.md5 || []).map((x) => String(x).toLowerCase()).filter((x) => /^[0-9a-f]{32}$/.test(x)))];
  if (!pilih.length) throw Object.assign(new Error("Pilih sedikitnya satu gambar yang diganti."), { ditolak: true, kode: "ditolak" });
  if (pilih.includes(logo.md5)) throw Object.assign(new Error("Gambar terpilih sudah sama dengan logo baru."), { ditolak: true, kode: "ditolak" });
  const sekarang = p.sekarang || new Date();
  // Waktu setempat server (container memasang /etc/localtime).
  const dua = (n) => String(n).padStart(2, "0");
  const cap =
    `${sekarang.getFullYear()}${dua(sekarang.getMonth() + 1)}${dua(sekarang.getDate())}-` +
    `${dua(sekarang.getHours())}${dua(sekarang.getMinutes())}${dua(sekarang.getSeconds())}`;
  const nama = `logo-kop-${cap}`;
  const folder = path.join(p.keluarAkar, nama);
  const daftar = [];
  for (const jalur of await daftarRtf(p.akar)) {
    const asal = await fs.readFile(jalur);
    const rtf = asal.toString("latin1");
    if (!rtf.includes("\\pict")) continue;
    const h = gantiGambar(rtf, pilih, logo);
    if (!h.jumlah) continue;
    const baru = Buffer.from(h.rtf, "latin1");
    const rel = relDari(p.akar, jalur);
    daftar.push({ rel, lama: md5(asal), baru: md5(baru), gambar: h.jumlah, isi: baru });
  }
  if (!daftar.length) throw Object.assign(new Error("Tidak ada blangko Derry yang memuat gambar terpilih."), { ditolak: true, kode: "tidak_ada" });
  for (const d of daftar) {
    const tujuan = path.join(folder, "rtf", ...d.rel.split("/"));
    await fs.mkdir(path.dirname(tujuan), { recursive: true });
    await fs.writeFile(tujuan, d.isi);
  }
  await fs.writeFile(
    path.join(folder, "daftar.tsv"),
    ["berkas\tmd5_lama\tmd5_baru\tgambar", ...daftar.map((d) => `${d.rel}\t${d.lama}\t${d.baru}\t${d.gambar}`)].join("\n") + "\n"
  );
  await fs.writeFile(path.join(folder, "pasang.sh"), skripPasang(p.akarServer), { mode: 0o755 });
  await fs.writeFile(path.join(folder, "pulih.sh"), skripPulih(p.akarServer), { mode: 0o755 });
  await fs.writeFile(path.join(folder, `logo-baru.${logo.jenis === "jpg" ? "jpg" : "png"}`), logo.isi);
  await fs.writeFile(
    path.join(folder, "BACA.txt"),
    [
      `Paket logo kop blangko Derry - dibangun ALETA ${sekarang.toISOString()}${p.oleh ? ` oleh ${p.oleh}` : ""}.`,
      `Gambar yang diganti (md5 isi): ${pilih.join(", ")}`,
      `Logo baru: ${logo.jenis.toUpperCase()} ${logo.lebar}x${logo.tinggi} piksel, md5 ${logo.md5}`,
      `Berkas: ${daftar.length}, gambar: ${daftar.reduce((n, d) => n + d.gambar, 0)}`,
      "",
      "Pasang (root, sesudah izin pengguna):  bash pasang.sh",
      "  PRASYARAT: md5 tiap berkas harus sama dengan md5_lama (atau md5_baru = sudah). Berbeda = berhenti tanpa mengubah apa pun.",
      "  CADANGAN berkas asli ke cadangan/ sebelum diganti; PERIKSA md5_baru sesudahnya.",
      "Pulih: bash pulih.sh  (hanya berkas yang isinya masih hasil paket ini).",
      "",
    ].join("\n")
  );
  return {
    nama,
    folder,
    jumlahBerkas: daftar.length,
    jumlahGambar: daftar.reduce((n, d) => n + d.gambar, 0),
    logo: { jenis: logo.jenis, lebar: logo.lebar, tinggi: logo.tinggi, md5: logo.md5 },
    berkas: daftar.map((d) => ({ rel: d.rel, lama: d.lama, baru: d.baru, gambar: d.gambar })),
  };
}

module.exports = {
  akhirKelompok,
  uraiPict,
  petakanGambar,
  kotakElektronikSesudah,
  jenisLogo,
  ukuranLogo,
  siapkanLogo,
  muatDalam,
  gantiGambar,
  tebakLogo,
  daftarRtf,
  pindai,
  ambilGambar,
  bangunPaket,
  skripPasang,
  skripPulih,
};
