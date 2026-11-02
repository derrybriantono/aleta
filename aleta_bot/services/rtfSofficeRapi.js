"use strict";

/**
 * ============================================================================
 * RTF DIRAPIKAN SEBELUM LibreOffice - SUPAYA PDF SAMA DENGAN WORD/WPS (2 Nov 2026)
 * ============================================================================
 *
 * Diukur dengan LibreOffice 24.2 atas blangko BAS Derry (rendering di laptop dan di cloud sama):
 *
 * 1. CERMIN ANGGOTA GRUP DIABAIKAN. Word/WPS mematuhi tanda cermin anggota grup (fRelFlipH / fRelFlipV); LibreOffice
 *    mengabaikannya (tanda cermin bentuk yang berdiri sendiri, fFlipH / fFlipV, dipatuhi keduanya). Garis Z BAS ALUR verstek adalah grup tiga garis penghubung, dan diagonalnya
 *    disimpan sebagai garis "kiri-atas ke kanan-bawah" bertanda fRelFlipH=1 -> di RTF (WPS) Z benar, di PDF diagonalnya terbalik.
 *    Perbaikan: titik-titik bentuk ditulis apa adanya (sudah dicerminkan) dan tanda cerminnya dinolkan; garis/penghubung lurus
 *    bercermin di dalam grup diubah menjadi bentuk bebas dua titik. Garis lurus di luar grup tidak disentuh (LibreOffice sudah benar).
 *
 * 2. KOTAK NOMOR HALAMAN TIDAK MENGECIL. BAS lama menaruh field PAGE di kotak teks 2x2 inci di kaki halaman, rata kanan terhadap
 *    margin (posh=3) dan "sesuaikan bentuk dengan teks" (fFitShapeToText). Word mengecilkan kotaknya selebar angka; LibreOffice
 *    tidak, sehingga angka (rata kiri di dalam kotak) tercetak +-2/3 lebar halaman dan kotaknya terdorong naik ke area teks.
 *    Perbaikan: kotak di kaki/kepala halaman yang memuat PAGE dan fFitShapeToText diperkecil (2 cm x 1 baris) dan paragrafnya
 *    diratakan menurut posh (3 = kanan, 2 = tengah).
 *
 * Fungsi MURNI atas teks RTF (latin1). Bentuk yang tidak dikenali dibiarkan.
 */

/** Grup seimbang yang dimulai di `awal` ("{"); mengembalikan indeks SESUDAH "}" penutupnya (atau -1). */
function akhirGrup(s, awal) {
  let d = 0;
  for (let k = awal; k < s.length; k += 1) {
    const c = s[k];
    if (c === "\\") {
      k += 1;
      continue;
    }
    if (c === "{") d += 1;
    else if (c === "}") {
      d -= 1;
      if (d === 0) return k + 1;
    }
  }
  return -1;
}

const reSp = (nama) => new RegExp(`\\{\\\\sp\\s*\\{\\\\sn\\s*${nama}\\}\\s*\\{\\\\sv\\s*([^}]*)\\}\\s*\\}`);
const ambilSp = (isi, nama) => {
  const m = reSp(nama).exec(isi);
  return m ? m[1].trim() : null;
};
const gantiSp = (isi, nama, nilai) => isi.replace(reSp(nama), `{\\sp{\\sn ${nama}}{\\sv ${nilai}}}`);
const sp = (nama, nilai) => `{\\sp{\\sn ${nama}}{\\sv ${nilai}}}`;

/** Bagian instruksi bentuk {\*\shpinst ...} TANPA grup anak (anggota grup, isi kotak teks). */
function bagianSendiri(isi) {
  // {\shp{\*\shpinst ... }} : properti langsung = {\sp ...} di tingkat pertama \shpinst
  const i = isi.indexOf("\\shpinst");
  if (i < 0) return { awal: -1, akhir: -1 };
  const buka = isi.lastIndexOf("{", i);
  const tutup = akhirGrup(isi, buka);
  return { awal: buka, akhir: tutup };
}

/** Properti {\sp} di tingkat pertama sebuah \shpinst (tanpa masuk ke {\shp} anak / {\shptxt}). */
function propertiLangsung(inst) {
  const hasil = [];
  let k = inst.indexOf("\\shpinst") + "\\shpinst".length;
  while (k < inst.length - 1) {
    const c = inst[k];
    if (c === "\\") {
      k += 2;
      continue;
    }
    if (c === "{") {
      const akhir = akhirGrup(inst, k);
      if (akhir < 0) break;
      const potong = inst.slice(k, akhir);
      if (/^\{\\sp\s*\{/.test(potong)) hasil.push({ awal: k, akhir, isi: potong });
      k = akhir;
      continue;
    }
    k += 1;
  }
  return hasil;
}

/** Nilai satu properti langsung (bukan milik anak). */
function nilaiLangsung(inst, nama) {
  for (const p of propertiLangsung(inst)) {
    const m = new RegExp(`^\\{\\\\sp\\s*\\{\\\\sn\\s*${nama}\\}\\s*\\{\\\\sv\\s*([^}]*)\\}`).exec(p.isi);
    if (m) return { nilai: m[1].trim(), ...p };
  }
  return null;
}

function aturLangsung(inst, nama, nilai) {
  const ada = nilaiLangsung(inst, nama);
  if (ada) return `${inst.slice(0, ada.awal)}${sp(nama, nilai)}${inst.slice(ada.akhir)}`;
  // sisipkan sebelum "}" penutup \shpinst
  const tutup = inst.lastIndexOf("}");
  return `${inst.slice(0, tutup)}${sp(nama, nilai)}${inst.slice(tutup)}`;
}

/** Titik-titik pVerticies "8;n;(x,y);..." -> {kepala, titik[]} atau null bila ada nilai bukan angka. */
function bacaTitik(nilai) {
  const m = /^(\d+;\d+);(.*)$/.exec(String(nilai || "").trim());
  if (!m) return null;
  const titik = [];
  for (const t of m[2].matchAll(/\((-?\d+),(-?\d+)\)/g)) titik.push([Number(t[1]), Number(t[2])]);
  const jumlah = Number(m[1].split(";")[1]);
  if (!titik.length || titik.length !== jumlah) return null;
  return { kepala: m[1], titik };
}

/** Cerminkan titik bentuk bebas menurut geo* (bawaan 0..21600) dan nolkan tanda cerminnya. */
function cerminkanBebas(inst, flipH, flipV, namaH, namaV) {
  const v = nilaiLangsung(inst, "pVerticies");
  if (!v) return null;
  const t = bacaTitik(v.nilai);
  if (!t) return null;
  const angka = (nama, bawaan) => {
    const x = nilaiLangsung(inst, nama);
    const n = x ? Number(x.nilai) : NaN;
    return Number.isFinite(n) ? n : bawaan;
  };
  const kiri = angka("geoLeft", 0);
  const kanan = angka("geoRight", 21600);
  const atas = angka("geoTop", 0);
  const bawah = angka("geoBottom", 21600);
  const baru = t.titik.map(([x, y]) => [flipH ? kiri + kanan - x : x, flipV ? atas + bawah - y : y]);
  let hasil = aturLangsung(inst, "pVerticies", `${t.kepala};${baru.map(([x, y]) => `(${x},${y})`).join(";")}`);
  if (flipH) hasil = aturLangsung(hasil, namaH, 0);
  if (flipV) hasil = aturLangsung(hasil, namaV, 0);
  return hasil;
}

/** Garis/penghubung lurus anggota grup yang bercermin -> bentuk bebas dua titik dalam kotaknya sendiri. */
function garisGrupKeBebas(inst, flipH, flipV) {
  const ambil = (nama) => {
    const x = nilaiLangsung(inst, nama);
    const n = x ? Number(x.nilai) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const l = ambil("relLeft");
  const t = ambil("relTop");
  const r = ambil("relRight");
  const b = ambil("relBottom");
  if ([l, t, r, b].some((x) => x === null)) return null;
  const w = Math.max(1, Math.abs(r - l));
  const h = Math.max(1, Math.abs(b - t));
  const awal = [flipH ? w : 0, flipV ? h : 0];
  const akhir = [flipH ? 0 : w, flipV ? 0 : h];
  let hasil = aturLangsung(inst, "shapeType", 0);
  hasil = aturLangsung(hasil, "fRelFlipH", 0);
  hasil = aturLangsung(hasil, "fRelFlipV", 0);
  hasil = aturLangsung(hasil, "geoLeft", 0);
  hasil = aturLangsung(hasil, "geoTop", 0);
  hasil = aturLangsung(hasil, "geoRight", w);
  hasil = aturLangsung(hasil, "geoBottom", h);
  hasil = aturLangsung(hasil, "shapePath", 4);
  hasil = aturLangsung(hasil, "pVerticies", `8;2;(${awal[0]},${awal[1]});(${akhir[0]},${akhir[1]})`);
  hasil = aturLangsung(hasil, "pSegmentInfo", "2;3;16384;1;32768");
  hasil = aturLangsung(hasil, "fFilled", 0);
  return hasil;
}

/** Semua grup {\shp ...} (termasuk anggota grup) beserta apakah ia anggota grup. */
function daftarBentuk(s) {
  const hasil = [];
  const re = /\{\\shp(?:grp)?(?=[\s\\{])/g;
  let m;
  while ((m = re.exec(s))) {
    const akhir = akhirGrup(s, m.index);
    if (akhir < 0) continue;
    hasil.push({ awal: m.index, akhir, grup: s.startsWith("{\\shpgrp", m.index) });
  }
  return hasil;
}

/**
 * 1. Anggota grup bercermin: cerminan ditulis di titik-titiknya. Mengembalikan { rtf, diubah }.
 * Anggota grup dikenali dari properti rel* (relLeft, fRelFlipH/V); grup itu sendiri dan bentuk di luar grup tidak diubah.
 */
function rapikanBentukCermin(rtf) {
  let s = String(rtf || "");
  if (!/fRelFlip[HV]\}\s*\{\\sv\s*1/.test(s)) return { rtf: s, diubah: 0 };
  let diubah = 0;
  // Dari belakang supaya indeks yang belum diproses tetap sah; hanya \shpinst milik bentuk itu sendiri (bagianSendiri) yang ditulis ulang.
  const bentuk = daftarBentuk(s).filter((b) => !b.grup).sort((a, b) => b.awal - a.awal);
  for (const b of bentuk) {
    const isi = s.slice(b.awal, b.akhir);
    const { awal, akhir } = bagianSendiri(isi);
    if (awal < 0 || akhir < 0) continue;
    const inst = isi.slice(awal, akhir);
    // Hanya ANGGOTA grup (properti rel*): bentuk sendiri yang bercermin (fFlipH/V) sudah dipatuhi LibreOffice - diukur 2 Nov.
    if (nilaiLangsung(inst, "relLeft") === null) continue;
    const namaH = "fRelFlipH";
    const namaV = "fRelFlipV";
    const fh = (nilaiLangsung(inst, namaH) || {}).nilai === "1";
    const fv = (nilaiLangsung(inst, namaV) || {}).nilai === "1";
    if (!fh && !fv) continue;
    const jenis = Number((nilaiLangsung(inst, "shapeType") || {}).nilai);
    let baru = null;
    if (jenis === 0 && nilaiLangsung(inst, "pVerticies")) baru = cerminkanBebas(inst, fh, fv, namaH, namaV);
    else if (jenis === 20 || jenis === 32) baru = garisGrupKeBebas(inst, fh, fv);
    if (!baru) continue;
    const isiBaru = `${isi.slice(0, awal)}${baru}${isi.slice(akhir)}`;
    s = `${s.slice(0, b.awal)}${isiBaru}${s.slice(b.akhir)}`;
    diubah += 1;
  }
  return { rtf: s, diubah };
}

/** Grup kaki/kepala halaman: {\footer ...} {\footerl ...} {\header ...} dst. */
function daftarKakiKepala(s) {
  const hasil = [];
  const re = /\{\\(?:footer|header)[lrf]?(?=[\s\\{])/g;
  let m;
  while ((m = re.exec(s))) {
    const akhir = akhirGrup(s, m.index);
    if (akhir > 0) {
      hasil.push({ awal: m.index, akhir });
      re.lastIndex = akhir;
    }
  }
  return hasil;
}

/** Lebar x tinggi kotak nomor halaman sesudah dikecilkan (twip): 2 cm x satu baris 12 pt. */
const LEBAR_KOTAK_NOMOR = 1134;
const TINGGI_KOTAK_NOMOR = 360;

/**
 * 2. Kotak teks nomor halaman di kaki/kepala halaman: dikecilkan dan diratakan menurut posh. Mengembalikan { rtf, diubah }.
 */
function rapikanKotakNomorHalaman(rtf) {
  let s = String(rtf || "");
  if (!/\\footer|\\header/.test(s) || !/PAGE/.test(s)) return { rtf: s, diubah: 0 };
  let diubah = 0;
  for (const kk of daftarKakiKepala(s).sort((a, b) => b.awal - a.awal)) {
    let blok = s.slice(kk.awal, kk.akhir);
    const bentuk = daftarBentuk(blok).filter((b) => !b.grup).sort((a, b) => b.awal - a.awal);
    let ubahBlok = false;
    for (const b of bentuk) {
      let isi = blok.slice(b.awal, b.akhir);
      if (!/\\shptxt/.test(isi) || !/\\fldinst[^}]*PAGE|\{\s*PAGE\b|\sPAGE\s/.test(isi)) continue;
      if (ambilSp(isi, "fFitShapeToText") !== "1") continue;
      const posh = Number(ambilSp(isi, "posh"));
      const m = /\\shpleft(-?\d+)\s*\\shptop(-?\d+)\s*\\shpright(-?\d+)\s*\\shpbottom(-?\d+)/.exec(isi);
      if (m) {
        const l = Number(m[1]);
        const t = Number(m[2]);
        const r = Number(m[3]);
        const btm = Number(m[4]);
        const lebar = Math.min(r - l, LEBAR_KOTAK_NOMOR);
        const tinggi = Math.min(btm - t, TINGGI_KOTAK_NOMOR);
        // posh=3 (kanan): tepi KANAN kotak tetap; selainnya tepi kiri tetap. posh mengatur letak di Word & LibreOffice, \shpleft cadangan.
        const kiriBaru = posh === 3 ? r - lebar : posh === 2 ? Math.round((l + r - lebar) / 2) : l;
        isi = isi.replace(m[0], `\\shpleft${kiriBaru}\\shptop${t}\\shpright${kiriBaru + lebar}\\shpbottom${t + tinggi}`);
      }
      const rata = posh === 3 ? "\\qr" : posh === 2 ? "\\qc" : "";
      if (rata) {
        const i = isi.indexOf("{\\shptxt");
        const j = i >= 0 ? akhirGrup(isi, i) : -1;
        if (i >= 0 && j > 0) {
          const txt = isi
            .slice(i, j)
            .replace(/\\q[lcrj](?![a-z])/g, "")
            .replace(/\\pard(?![a-z])/g, `\\pard${rata}`);
          isi = `${isi.slice(0, i)}${txt}${isi.slice(j)}`;
        }
      }
      blok = `${blok.slice(0, b.awal)}${isi}${blok.slice(b.akhir)}`;
      ubahBlok = true;
      diubah += 1;
    }
    if (ubahBlok) s = `${s.slice(0, kk.awal)}${blok}${s.slice(kk.akhir)}`;
  }
  return { rtf: s, diubah };
}

/** Seluruh perapian untuk LibreOffice. Buffer masuk/keluar; bukan RTF atau memuat data biner mentah = apa adanya. */
function rapikanUntukSoffice(isi) {
  if (!Buffer.isBuffer(isi) || isi.length < 6 || isi.subarray(0, 5).toString("latin1") !== "{\\rtf") return { isi, laporan: { cermin: 0, nomorHalaman: 0 } };
  const teks = isi.toString("latin1");
  if (/\\bin\d/.test(teks)) return { isi, laporan: { cermin: 0, nomorHalaman: 0 } };
  const a = rapikanBentukCermin(teks);
  const b = rapikanKotakNomorHalaman(a.rtf);
  const laporan = { cermin: a.diubah, nomorHalaman: b.diubah };
  return { isi: a.diubah || b.diubah ? Buffer.from(b.rtf, "latin1") : isi, laporan };
}

module.exports = { rapikanUntukSoffice, rapikanBentukCermin, rapikanKotakNomorHalaman, akhirGrup, LEBAR_KOTAK_NOMOR, TINGGI_KOTAK_NOMOR };
