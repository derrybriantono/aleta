/**
 * ============================================================================
 * PERKIRAAN TINGGI HALAMAN RTF + TINGGI BARIS RIWAYAT SAMPUL DINAMIS (30 Okt 2026) - MURNI
 * ============================================================================
 *
 * Saklar layar Sampul/Daftar Isi kini menyala bawaan, jadi jalur PANEL adalah jalur utama dan portal menyusun naskahnya sendiri. Di jalur ini
 * tinggi baris riwayat sidang sampul cetak awal disesuaikan PER PERKARA: setinggi mungkin sehingga sampul tetap SATU lembar dan sisa ruang
 * bawah sekecil mungkin. (Cetak langsung dari ABT tetap memakai tinggi tetap yang aman untuk perkara terpadat.)
 *
 * Cara: tinggi isi halaman pertama diperkirakan dari RTF hasil isian (pengurai RTF sederhana: paragraf, tabel, ukuran huruf, tebal, spasi
 * sebelum/sesudah, tinggi baris minimum, gambar) dengan lebar huruf Arial (metrik Helvetica, sama per karakter) dan bungkus kata rakus seperti
 * pengolah kata. Baris riwayat ditandai blangko dengan grup tak terlihat {\*\bkrw}; tinggi minimumnya dicari dengan bagi-dua sehingga tinggi
 * perkiraan <= bidang cetak - cadangan. Cadangan menyerap beda Word / LibreOffice / WPS.
 */

// Lebar karakter Arial per 1000 em (sama dengan Helvetica) untuk ASCII 32..126: biasa dan tebal.
const BIASA =
  "278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584"
    .split(",")
    .map(Number);
const TEBAL =
  "278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584"
    .split(",")
    .map(Number);

/** Lebar satu karakter dalam twip pada ukuran `fs` (setengah poin). */
export function lebarKarakter(kode: number, fs: number, tebal: boolean, simbol: boolean): number {
  // +4%: pengolah kata membulatkan lebar huruf ke piksel/twip dan menambah sedikit jarak; perkiraan yang sedikit lebih lebar = bungkus baris lebih awal (aman)
  const em = (fs / 2) * 20 * 1.04; // twip per em
  if (simbol) return em * 0.9;
  if (kode === 160) return ((tebal ? TEBAL : BIASA)[0] / 1000) * em;
  if (kode < 32 || kode > 126) return 0.6 * em;
  return ((tebal ? TEBAL : BIASA)[kode - 32] / 1000) * em;
}

type Run = { teks: string; fs: number; b: boolean; simbol: boolean };
type Paragraf = { runs: Run[]; sb: number; sa: number; li: number; brdrb: boolean; gambarTinggi: number; fsDasar: number; pageBreakSebelum: boolean };
type Sel = { kanan: number; paragraf: Paragraf[] };
type BarisTabel = { trrh: number; riwayat: boolean; sel: Sel[]; batasAtas: number; batasBawah: number };
export type Blok = { jenis: "par"; p: Paragraf } | { jenis: "baris"; b: BarisTabel } | { jenis: "halaman" };

const KATA = /^[a-z]+/i;

/** Mengurai RTF menjadi urutan paragraf lepas dan baris tabel (cukup untuk blangko berkas perkara). */
export function uraiRtf(rtf: string): Blok[] {
  const blok: Blok[] = [];
  type Keadaan = { fs: number; b: boolean; simbol: boolean; abai: number };
  let k: Keadaan = { fs: 24, b: false, simbol: false, abai: 0 };
  const tumpuk: Keadaan[] = [];
  let par: Paragraf = parBaru(k.fs);
  let dalamTabel = false;
  let baris: BarisTabel | null = null;
  let barisDef: { kanan: number[]; trrh: number; riwayat: boolean; batasAtas: number; batasBawah: number } = { kanan: [], trrh: 0, riwayat: false, batasAtas: 0, batasBawah: 0 };
  let selKe = 0;
  let selPar: Paragraf[] = [];
  let gambarGrup = -1;
  let gambarTinggi = 0;
  let pageBreakBerikut = false;

  function parBaru(fs: number): Paragraf {
    return { runs: [], sb: 0, sa: 0, li: 0, brdrb: false, gambarTinggi: 0, fsDasar: fs, pageBreakSebelum: false };
  }
  function tambahTeks(t: string) {
    if (k.abai > 0) return;
    const r = par.runs[par.runs.length - 1];
    if (r && r.fs === k.fs && r.b === k.b && r.simbol === k.simbol) r.teks += t;
    else par.runs.push({ teks: t, fs: k.fs, b: k.b, simbol: k.simbol });
  }
  function tutupPar(akhirSel: boolean) {
    if (dalamTabel) {
      selPar.push(par);
      if (akhirSel) {
        if (!baris) baris = { trrh: barisDef.trrh, riwayat: barisDef.riwayat, sel: [], batasAtas: barisDef.batasAtas, batasBawah: barisDef.batasBawah };
        const kiri = selKe === 0 ? 0 : barisDef.kanan[selKe - 1] ?? 0;
        const kanan = barisDef.kanan[selKe] ?? kiri + 1000;
        baris.sel.push({ kanan: kanan - kiri, paragraf: selPar });
        selPar = [];
        selKe += 1;
      }
    } else {
      if (pageBreakBerikut) {
        blok.push({ jenis: "halaman" });
        pageBreakBerikut = false;
      }
      blok.push({ jenis: "par", p: par });
    }
    // sifat paragraf (spasi sebelum/sesudah, inden, garis) BERLANJUT ke paragraf berikutnya sampai \pard - mis. isian bergaris banyak (<br>)
    const lama = par;
    par = parBaru(k.fs);
    par.sb = lama.sb;
    par.sa = lama.sa;
    par.li = lama.li;
    par.brdrb = lama.brdrb;
    par.fsDasar = lama.fsDasar;
  }

  let i = 0;
  const n = rtf.length;
  while (i < n) {
    const c = rtf[i];
    if (c === "{") {
      tumpuk.push({ ...k });
      i += 1;
      if (rtf.startsWith("\\*", i)) {
        const m = /^\\\*\\([a-z]+)/i.exec(rtf.slice(i, i + 40));
        if (m && m[1] === "bkrw") barisDef.riwayat = true;
        k.abai += 1;
      }
      continue;
    }
    if (c === "}") {
      if (gambarGrup === tumpuk.length) {
        par.gambarTinggi = Math.max(par.gambarTinggi, gambarTinggi);
        gambarGrup = -1;
      }
      const lama = tumpuk.pop();
      if (lama) k = lama;
      i += 1;
      continue;
    }
    if (c === "\r" || c === "\n") {
      i += 1;
      continue;
    }
    if (c === "\\") {
      const d = rtf[i + 1];
      if (d === "\\" || d === "{" || d === "}") {
        tambahTeks(d);
        i += 2;
        continue;
      }
      if (d === "~") {
        tambahTeks(" ");
        i += 2;
        continue;
      }
      if (d === "'") {
        tambahTeks(String.fromCharCode(parseInt(rtf.slice(i + 2, i + 4), 16) || 63));
        i += 4;
        continue;
      }
      if (d === "-" || d === "_") {
        i += 2;
        continue;
      }
      const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i, i + 40));
      if (!m) {
        i += 2;
        continue;
      }
      const kata = m[1];
      const angka = m[2] === undefined ? null : Number(m[2]);
      i += m[0].length;
      switch (kata) {
        case "pict":
          gambarGrup = tumpuk.length;
          gambarTinggi = 0;
          k.abai += 1;
          break;
        case "pichgoal":
          if (gambarGrup >= 0) gambarTinggi = angka ?? 0;
          break;
        case "fonttbl":
        case "colortbl":
        case "stylesheet":
        case "info":
          k.abai += 1;
          break;
        case "fs":
          k.fs = angka ?? 24;
          if (!par.runs.length && k.abai === 0) par.fsDasar = k.fs;
          break;
        case "b":
          k.b = angka !== 0;
          break;
        case "f":
          k.simbol = angka === 1;
          break;
        case "plain":
          k.fs = 24;
          k.b = false;
          k.simbol = false;
          break;
        case "pard":
          par.sb = 0;
          par.sa = 0;
          par.li = 0;
          par.brdrb = false;
          if (!/\\intbl/.test(rtf.slice(i, i + 40))) dalamTabel = false;
          break;
        case "intbl":
          dalamTabel = true;
          break;
        case "sb":
          par.sb = angka ?? 0;
          break;
        case "sa":
          par.sa = angka ?? 0;
          break;
        case "li":
          par.li = angka ?? 0;
          break;
        case "brdrb":
          par.brdrb = true;
          break;
        case "pagebb":
          par.pageBreakSebelum = true;
          pageBreakBerikut = true;
          break;
        case "page":
          pageBreakBerikut = true;
          break;
        case "trowd":
          barisDef = { kanan: [], trrh: 0, riwayat: false, batasAtas: 0, batasBawah: 0 };
          baris = null;
          selKe = 0;
          selPar = [];
          break;
        case "trrh":
          barisDef.trrh = Math.abs(angka ?? 0);
          break;
        case "cellx":
          barisDef.kanan.push(angka ?? 0);
          break;
        case "brdrw":
          barisDef.batasAtas = Math.max(barisDef.batasAtas, angka ?? 0);
          break;
        case "par":
          tutupPar(false);
          break;
        case "cell":
          tutupPar(true);
          break;
        case "row":
          if (baris) blok.push({ jenis: "baris", b: baris });
          baris = null;
          selKe = 0;
          selPar = [];
          break;
        case "tab":
          tambahTeks("    ");
          break;
        case "u": {
          tambahTeks(String.fromCharCode(Math.abs(angka ?? 63) % 65536));
          if (rtf[i] === "?") i += 1;
          break;
        }
        default:
          break;
      }
      continue;
    }
    tambahTeks(c);
    i += 1;
  }
  if (par.runs.length) tutupPar(false);
  return blok;
}

/** Tinggi baris teks untuk ukuran fs (twip): Arial ~1,15 em (Word "single"). Simbol (Segoe UI Symbol) lebih tinggi. */
function tinggiBarisTeks(fs: number, simbol: boolean): number {
  return (fs / 2) * 20 * (simbol ? 1.33 : 1.15);
}

/** Tinggi satu paragraf pada lebar `lebar` twip (bungkus kata rakus). */
export function tinggiParagraf(p: Paragraf, lebar: number): number {
  const lebarEfektif = Math.max(200, lebar - p.li);
  const tinggiDasar = tinggiBarisTeks(p.fsDasar || 24, false);
  if (!p.runs.length || p.runs.every((r) => !r.teks.trim())) {
    const fsMaks = Math.max(p.fsDasar || 24, ...p.runs.map((r) => r.fs));
    return Math.max(p.gambarTinggi, tinggiBarisTeks(fsMaks, false)) + p.sb + p.sa + (p.brdrb ? 60 : 0);
  }
  // potong menjadi "kata" (dengan spasi pengikutnya) berukuran
  type Kata = { w: number; h: number; spasi: number };
  const kata: Kata[] = [];
  for (const r of p.runs) {
    const h = tinggiBarisTeks(r.fs, r.simbol);
    let cur: Kata | null = null;
    for (const ch of r.teks) {
      const w = lebarKarakter(ch.charCodeAt(0), r.fs, r.b, r.simbol);
      if (ch === " ") {
        if (!cur) {
          cur = { w: 0, h, spasi: 0 };
          kata.push(cur);
        }
        cur.spasi += w;
        cur = null;
        continue;
      }
      if (cur && cur.spasi > 0) cur = null;
      if (!cur) {
        cur = { w: 0, h, spasi: 0 };
        kata.push(cur);
      }
      cur.w += w;
      cur.h = Math.max(cur.h, h);
    }
  }
  let baris = 1;
  let x = 0;
  let hBaris = tinggiDasar;
  let total = 0;
  for (const kt of kata) {
    if (x > 0 && x + kt.w > lebarEfektif) {
      total += hBaris;
      baris += 1;
      x = 0;
      hBaris = tinggiDasar;
    }
    x += kt.w + kt.spasi;
    hBaris = Math.max(hBaris, kt.h);
    while (x > lebarEfektif && kt.w > lebarEfektif) {
      // kata lebih lebar dari kolom: dipatahkan
      total += hBaris;
      x -= lebarEfektif;
    }
  }
  total += hBaris;
  return Math.max(total, p.gambarTinggi) + p.sb + p.sa + (p.brdrb ? 60 : 0);
}

const GAPH = 70;

function tinggiBaris(b: BarisTabel, tinggiRiwayat: number | null): number {
  let isi = 0;
  for (const s of b.sel) {
    const lebar = s.kanan - 2 * GAPH;
    const h = s.paragraf.reduce((a, p) => a + tinggiParagraf(p, lebar), 0);
    isi = Math.max(isi, h);
  }
  const minimum = b.riwayat && tinggiRiwayat !== null ? tinggiRiwayat : b.trrh;
  // 	rrh (tinggi minimum) sudah mencakup garis baris; garis hanya menambah bila isi melebihi minimum
  return Math.max(minimum, isi + Math.max(10, b.batasAtas));
}

/** Tinggi isi halaman pertama (sampai pemisah halaman pertama), twip. `tinggiRiwayat` menggantikan tinggi minimum baris bertanda riwayat. */
export function tinggiHalamanPertama(blok: Blok[], lebarIsi: number, tinggiRiwayat: number | null = null): number {
  let t = 0;
  for (const x of blok) {
    if (x.jenis === "halaman") break;
    if (x.jenis === "par") {
      if (x.p.pageBreakSebelum) break;
      t += tinggiParagraf(x.p, lebarIsi);
    } else t += tinggiBaris(x.b, tinggiRiwayat);
  }
  return t;
}

/**
 * Tinggi baris riwayat terbesar (kelipatan 5 twip, >= minimum) sehingga halaman pertama <= bidang cetak - cadangan; null bila tidak ada
 * baris bertanda riwayat atau isi tanpa riwayat pun sudah melewati bidang cetak (biarkan tinggi blangko).
 */
export function cariTinggiRiwayat(blok: Blok[], lebarIsi: number, bidangCetak: number, cadangan: number, minimum = 230, maksimum = 1400): number | null {
  if (!blok.some((x) => x.jenis === "baris" && x.b.riwayat)) return null;
  const batas = bidangCetak - cadangan;
  if (tinggiHalamanPertama(blok, lebarIsi, minimum) > batas) return null;
  let lo = minimum;
  let hi = maksimum;
  while (hi - lo > 5) {
    const mid = Math.round((lo + hi) / 2);
    if (tinggiHalamanPertama(blok, lebarIsi, mid) <= batas) lo = mid;
    else hi = mid;
  }
  return lo - (lo % 5);
}

/** Mengganti tinggi minimum baris bertanda {\*\bkrw} dan membuang penandanya. */
export function setelTinggiRiwayatRtf(rtf: string, tinggi: number): string {
  return rtf.replace(/\\trowd\{\\\*\\bkrw\}([^\n]*?)\\trrh\d+/g, (_m, tengah: string) => `\\trowd${tengah}\\trrh${tinggi}`);
}

export function buangPenandaRiwayat(rtf: string): string {
  return rtf.split("{\\*\\bkrw}").join("");
}
