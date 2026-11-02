import { CM, keTwip, tanggalIndonesia, type RencanaZ, type Tepi } from "./geometri";

/**
 * Z CROSS OTOMATIS - LINTASAN 2 UNTUK RTF: membaca paragraf (teks tampak + letak di dalam RTF) dan menulis balik garis Z, tanggal, ganti
 * halaman, dan nomor halaman bagian berikutnya.
 *
 * RTF TIDAK TAHU LETAK HALAMAN. Pengukuran dikerjakan mesin (Word / LibreOffice) pada PDF hasilnya (lihat index.ts); modul ini hanya
 * membaca struktur RTF dan menulis bentuknya:
 *   - Z digambar sebagai satu bentuk bebas {\shp ...} (garis atas + diagonal + garis bawah, sama dengan bentuk "FreeForm" di blangko
 *     Derry) dan satu kotak teks tanggal, KEDUANYA tertambat ke paragraf jangkar tetapi diletakkan relatif terhadap HALAMAN
 *     (\shpbxpage \shpbypage) supaya sama dengan koordinat PDF yang diukur;
 *   - nama bentuk "zcross-*" menandai buatan modul ini sehingga penyesuaian ulang (tiap cetak / unduh / unggah) MENGGANTI, bukan menumpuk;
 *   - kalimat yang harus dirapatkan diberi \expndtw (jarak huruf) ditandai {\*\zcxa} / {\*\zcxb} supaya dapat dicabut pada penyesuaian ulang.
 */

export type Segmen = [number, number];

export type ParagrafRtf = {
  indeks: number;
  teks: string;
  /** Indeks awal (tepat setelah \par paragraf sebelumnya). */
  awal: number;
  /** Indeks token penutup paragraf (\par, \sect, \cell, \row) atau panjang dokumen. */
  akhir: number;
  /** Indeks tepat setelah token penutup. */
  akhirToken: number;
  /** Bila token penutup berada di grup yang dibuka DI DALAM paragraf ini ({...\par }): indeks tepat setelah grup itu; selainnya = akhirToken. */
  akhirGrup: number;
  /** Indeks tepat setelah karakter tampak terakhir; -1 bila paragraf tanpa teks. */
  akhirTeks: number;
  segmen: Segmen[];
  /** Kelompok {\shp ...} terluar yang berada di paragraf ini. */
  shp: Segmen[];
  penutup: "par" | "sect" | "sel" | "baris" | "akhir";
};

export type KejadianRtf = { jenis: "sectd" | "sect"; pos: number; akhir: number; akhirKontrol: number };

export type HasilUrai = { paragraf: ParagrafRtf[]; kejadian: KejadianRtf[]; panjang: number };

const TUJUAN_ABAIKAN = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "header", "headerl", "headerr", "headerf", "footer", "footerl", "footerr", "footerf", "pict",
  "shp", "shpgrp", "shpinst", "shprslt", "shptxt", "listtable", "listoverridetable", "rsidtbl", "generator", "themedata", "colorschememapping",
  "datastore", "latentstyles", "pgdsctbl", "fldinst", "footnote", "annotation", "comment", "xmlnstbl", "mmathpr", "background", "private",
  "objdata", "listtext", "pntext", "pntxta", "pntxtb", "revtbl", "protusertbl", "userprops", "falt", "panose",
]);

const KATA_KONTROL_SEKSI = /^(?:sectd|sbk\w*|pgw\w*|pgh\w*|marg\w*sxn|guttersxn|headery|footery|pgbrdropt|sectdefaultcl|endnhere|pgn\w*|cols\w*|colno|colw|colsr|linemod|linex|linestarts|linerestart|lineppage|linecont|vertal\w*|titlepg|sectunlocked|ds|rtlsect|ltrsect|lndscpsxn|margmirsxn|sectlinegrid|sectexpand|binfsxn|binsxn|stextflow|footnotetype|ftnbj|fet|endnotes|sftn\w*|saftn\w*|pgbrd\w*|brdr\w*|brsp\d*|brdrframe|pgbrdr\w+)$/;

const cp1252 = new TextDecoder("windows-1252");

/** Isi satu karakter \'hh. */
const dariHex = (h: string): string => cp1252.decode(new Uint8Array([parseInt(h, 16)]));

/**
 * Membaca RTF menjadi paragraf dan kejadian seksi. Paragraf = teks TAMPAK di badan dokumen (tanpa header/footer, tanpa isi kotak teks,
 * tanpa tujuan yang diabaikan seperti {\*\isianasal ...}).
 */
export function uraiRtf(s: string): HasilUrai {
  const n = s.length;
  type Tingkat = { abaikan: boolean; uc: number; shpAwal: number };
  let kini: Tingkat = { abaikan: false, uc: 1, shpAwal: -1 };
  const tumpukan: Tingkat[] = [];
  const posBuka: number[] = [];
  const paragraf: ParagrafRtf[] = [];
  const kejadian: KejadianRtf[] = [];
  let awalPar = 0;
  let teks = "";
  let segmen: Segmen[] = [];
  let segAwal = -1;
  let segAkhir = -1;
  let shp: Segmen[] = [];
  let lewatiUc = 0;

  const tutupSegmen = () => {
    if (segAwal >= 0) segmen.push([segAwal, segAkhir]);
    segAwal = -1;
    segAkhir = -1;
  };
  const tambahTeks = (t: string, dari: number, sampai: number) => {
    if (kini.abaikan) return;
    teks += t;
    if (segAwal < 0) segAwal = dari;
    segAkhir = sampai;
  };
  const akhiriParagraf = (pos: number, akhirToken: number, penutup: ParagrafRtf["penutup"]) => {
    tutupSegmen();
    let akhirGrup = akhirToken;
    const buka = posBuka.length ? posBuka[posBuka.length - 1] : -1;
    if (buka >= awalPar && buka < pos) {
      let d = 1;
      let k = akhirToken;
      while (k < n && d > 0) {
        const ch = s[k];
        if (ch === "\\") k += 1;
        else if (ch === "{") d += 1;
        else if (ch === "}") d -= 1;
        k += 1;
      }
      akhirGrup = k;
    }
    paragraf.push({
      indeks: paragraf.length,
      teks,
      awal: awalPar,
      akhir: pos,
      akhirToken,
      akhirGrup,
      akhirTeks: segmen.length ? segmen[segmen.length - 1][1] : -1,
      segmen,
      shp,
      penutup,
    });
    awalPar = akhirToken;
    teks = "";
    segmen = [];
    shp = [];
  };

  let i = 0;
  while (i < n) {
    const c = s[i];
    if (c === "{") {
      tutupSegmen();
      posBuka.push(i);
      tumpukan.push(kini);
      kini = { ...kini, shpAwal: kini.shpAwal };
      // tujuan?
      let j = i + 1;
      while (j < n && (s[j] === "\r" || s[j] === "\n")) j += 1;
      if (s[j] === "\\") {
        if (s[j + 1] === "*") {
          kini.abaikan = true;
        } else {
          const m = /^\\([a-zA-Z]+)/.exec(s.slice(j, j + 24));
          if (m) {
            const nama = m[1].toLowerCase();
            if (TUJUAN_ABAIKAN.has(nama)) {
              if ((nama === "shp" || nama === "shpgrp") && kini.shpAwal < 0 && !tumpukan[tumpukan.length - 1].abaikan) kini.shpAwal = i;
              kini.abaikan = true;
            }
          }
        }
      }
      i += 1;
      continue;
    }
    if (c === "}") {
      tutupSegmen();
      posBuka.pop();
      const induk = tumpukan.pop();
      if (kini.shpAwal >= 0 && (!induk || induk.shpAwal < 0)) shp.push([kini.shpAwal, i + 1]);
      if (induk) kini = induk;
      i += 1;
      continue;
    }
    if (c === "\r" || c === "\n") {
      i += 1;
      continue;
    }
    if (c === "\\") {
      const awal = i;
      const d = s[i + 1];
      if (d === undefined) {
        i += 1;
        continue;
      }
      if (d === "'") {
        const h = s.slice(i + 2, i + 4);
        i += 4;
        if (lewatiUc > 0) {
          lewatiUc -= 1;
          continue;
        }
        tambahTeks(dariHex(h), awal, i);
        continue;
      }
      if (!/[a-zA-Z]/.test(d)) {
        i += 2;
        if (d === "~") tambahTeks(" ", awal, i);
        else if (d === "\\" || d === "{" || d === "}") {
          if (lewatiUc > 0) lewatiUc -= 1;
          else tambahTeks(d, awal, i);
        } else if (d === "_") tambahTeks("-", awal, i);
        else if (d === "*") {
          // \* di luar awal grup: tidak berpengaruh pada teks
        } else tutupSegmen();
        continue;
      }
      let j = i + 1;
      while (j < n && /[a-zA-Z]/.test(s[j])) j += 1;
      const nama = s.slice(i + 1, j).toLowerCase();
      let param = "";
      if (s[j] === "-" || (s[j] >= "0" && s[j] <= "9")) {
        let k = j;
        if (s[k] === "-") k += 1;
        while (k < n && s[k] >= "0" && s[k] <= "9") k += 1;
        param = s.slice(j, k);
        j = k;
      }
      if (s[j] === " ") j += 1;
      i = j;
      if (nama === "uc") {
        kini.uc = Number(param) || 0;
        continue;
      }
      if (nama === "u") {
        let v = Number(param) || 0;
        if (v < 0) v += 65536;
        if (!kini.abaikan) tambahTeks(String.fromCharCode(v), awal, i);
        lewatiUc = kini.uc;
        continue;
      }
      if (nama === "bin") {
        i += Number(param) || 0;
        continue;
      }
      if (nama === "par" && !kini.abaikan) {
        akhiriParagraf(awal, i, "par");
        continue;
      }
      if (nama === "cell" && !kini.abaikan) {
        akhiriParagraf(awal, i, "sel");
        continue;
      }
      if (nama === "row" && !kini.abaikan) {
        akhiriParagraf(awal, i, "baris");
        continue;
      }
      if (nama === "sect" && !kini.abaikan) {
        kejadian.push({ jenis: "sect", pos: awal, akhir: i, akhirKontrol: i });
        akhiriParagraf(awal, i, "sect");
        continue;
      }
      if (nama === "sectd" && !kini.abaikan) {
        // kontrol seksi: tanpa menelan kontrol paragraf berikutnya
        let k = i;
        for (;;) {
          while (k < n && (s[k] === " " || s[k] === "\r" || s[k] === "\n")) k += 1;
          const m = /^\\([a-zA-Z]+)(-?\d*)/.exec(s.slice(k, k + 40));
          if (!m || !KATA_KONTROL_SEKSI.test(m[1].toLowerCase())) break;
          k += m[0].length;
          if (s[k] === " ") k += 1;
        }
        kejadian.push({ jenis: "sectd", pos: awal, akhir: i, akhirKontrol: k });
        continue;
      }
      if (lewatiUc > 0 && (nama === "tab" || nama === "line")) {
        lewatiUc -= 1;
        continue;
      }
      if (nama === "tab" || nama === "line" || nama === "lbr" || nama === "enspace" || nama === "emspace") {
        tambahTeks(" ", awal, i);
        continue;
      }
      tutupSegmen();
      continue;
    }
    // karakter biasa
    if (lewatiUc > 0) {
      lewatiUc -= 1;
      i += 1;
      continue;
    }
    tambahTeks(c, i, i + 1);
    i += 1;
  }
  if (teks.length || segmen.length || segAwal >= 0) akhiriParagraf(n, n, "akhir");
  return { paragraf, kejadian, panjang: n };
}

// ----------------------------------------------------------------------------
// Jangkar
// ----------------------------------------------------------------------------
export const POLA_UJUNG_DAFTAR = /(?:berikut|berupa)\s*:\s*$/i;

export type JangkarRtf = { indeks: number; via: "bentuk" | "ujung-daftar"; paragrafUkur: ParagrafRtf; paragrafBentuk: ParagrafRtf | null };

const bermakna = (t: string): boolean => /\p{L}{2,}/u.test(t);
const bentukZ = (isi: string): boolean => /zcross-|SC\s*Z/.test(isi);
/** Z gambar tangan blangko lama TANPA kotak "SC Z" (bentuk bebas "FreeForm") - keputusan 87 (1 Nov): ikut disesuaikan otomatis bila
 * paragraf bertulisan terdekat di atasnya penutup daftar ("...berikut:" / "...berupa:"). */
const bentukFreeForm = (isi: string): boolean => /\{\\sv\s*FreeForm/i.test(isi);

/**
 * Paragraf jangkar: (1) paragraf pemilik bentuk "SC Z" / "zcross-*" yang TERAKHIR (mundur ke paragraf bertulisan terdekat bila pemiliknya
 * kosong); (2) selainnya paragraf TERAKHIR yang kata akhirnya "berikut:" / "berupa:".
 */
export function cariJangkarRtf(s: string, urai: HasilUrai): JangkarRtf | null {
  const { paragraf } = urai;
  for (let i = paragraf.length - 1; i >= 0; i -= 1) {
    const p = paragraf[i];
    const sc = p.shp.some(([a, b]) => bentukZ(s.slice(a, b)));
    if (!sc && !p.shp.some(([a, b]) => bentukFreeForm(s.slice(a, b)))) continue;
    let t = i;
    // paragraf ukur = paragraf BERTULISAN terdekat; isian kosong "..." dilewati (ekornya tidak dapat dicari di PDF) - keputusan 87
    while (t > 0 && !bermakna(paragraf[t].teks)) t -= 1;
    if (!bermakna(paragraf[t].teks)) {
      if (sc) return null;
      continue;
    }
    if (!sc && !POLA_UJUNG_DAFTAR.test(paragraf[t].teks)) continue;
    return { indeks: t, via: "bentuk", paragrafUkur: paragraf[t], paragrafBentuk: p };
  }
  for (let i = paragraf.length - 1; i >= 0; i -= 1) {
    if (POLA_UJUNG_DAFTAR.test(paragraf[i].teks)) return { indeks: i, via: "ujung-daftar", paragrafUkur: paragraf[i], paragrafBentuk: null };
  }
  return null;
}

export const EKOR_KATA = 4;

/** Ekor kata-kata paragraf dan berapa paragraf SEBELUMNYA yang berekor sama (ordinal pencarian di PDF). */
export function ekorDanOrdinal(urai: HasilUrai, indeks: number, ekorDari: (t: string) => string[]): { ekor: string[]; ordinal: number } {
  const ekor = ekorDari(urai.paragraf[indeks].teks);
  let ordinal = 0;
  for (let i = 0; i < indeks; i += 1) {
    const e = ekorDari(urai.paragraf[i].teks);
    if (e.length === ekor.length && e.every((k, j) => k === ekor[j])) ordinal += 1;
  }
  return { ekor, ordinal };
}

// ----------------------------------------------------------------------------
// Pembersihan Z lama
// ----------------------------------------------------------------------------
const RE_PENANDA_RAPAT = /\{\\\*\\zcx[ab]\}\\expndtw-?\d+ ?/g;

function hapusRentang(s: string, rentang: Segmen[]): string {
  let hasil = s;
  for (const [a, b] of [...rentang].sort((x, y) => y[0] - x[0])) hasil = hasil.slice(0, a) + hasil.slice(b);
  return hasil;
}

export type Pembersihan = {
  rtf: string;
  /** Kotak teks tanggal lama (RTF mentah grup {\shp ...}), bila ada: isinya dipakai ulang di tempat baru. */
  kotakTanggal: string | null;
  jumlahBentukDibuang: number;
};

/** Grup bentuk yang SEMUA anggotanya garis lurus (20), penghubung lurus (32), atau bentuk bebas (0) - bukan kotak teks/gambar. */
function grupHanyaGaris(isi: string): boolean {
  const jenis = [...isi.matchAll(/\{\\sn\s*shapeType\}\{\\sv\s*(-?\d+)\}/g)].map((m) => Number(m[1]));
  const anggota = (isi.match(/\{\\shp[\s\\{]/g) ?? []).length;
  if (!anggota || /\\pict(?!\s*\})|\\blipuid|\\pngblip|\\jpegblip/.test(isi.replace(/\{\\shprslt[^{}]*\{\\pict\s*\}\}/g, ""))) return false;
  return jenis.length >= anggota && jenis.every((j) => j === 20 || j === 32 || j === 0);
}

/**
 * Membuang Z lama: bentuk buatan modul ini (zcross-*), bentuk "SC Z" / "FreeForm" di paragraf jangkar (blangko), dan jarak huruf yang
 * pernah dipasang modul ini. Kotak teks tanggal lama dipertahankan isinya.
 */
export function bersihkanZRtf(sumber: string): Pembersihan {
  let s = sumber.replace(RE_PENANDA_RAPAT, "");
  const urai = uraiRtf(s);
  const jangkar = cariJangkarRtf(s, urai);
  const buang: Segmen[] = [];
  let kotak: string | null = null;
  // Tanda Z ("SC Z" / FreeForm) dapat berada di paragraf jangkar ATAU di paragraf pemilik bentuk (kosong, sesudah jangkar): tandanya
  // dilihat bersama untuk KEDUA paragraf, supaya garis Z lama di paragraf jangkar ikut dibuang walau kotak "SC Z"-nya di paragraf lain
  // (2 Nov: BAS ALUR verstek - Z lama = grup tiga garis penghubung di paragraf "...berikut:", kotak "SC Z" di paragraf kosong sesudahnya).
  const diperiksa: ParagrafRtf[] = [];
  if (jangkar) {
    diperiksa.push(jangkar.paragrafUkur);
    if (jangkar.paragrafBentuk && jangkar.paragrafBentuk.indeks !== jangkar.paragrafUkur.indeks) diperiksa.push(jangkar.paragrafBentuk);
  }
  const adaTanda = diperiksa.some((p) => p.shp.some(([a, b]) => /SC\s*Z|\{\\sv\s*FreeForm/i.test(s.slice(a, b))));
  const lihat = (p: ParagrafRtf) => {
    // Z gambar tangan blangko lama berupa garis lurus (AutoShape garis / penghubung lurus), atau GRUP yang seluruh anggotanya garis /
    // penghubung / bentuk bebas tanpa tulisan, di paragraf pemilik tanda Z ikut dibuang supaya tidak bertumpuk dengan Z otomatis
    // (keputusan 87, BAS jawab-menjawab; 2 Nov grup garis BAS ALUR verstek).
    for (const [a, b] of p.shp) {
      const isi = s.slice(a, b);
      const buatanKita = /zcross-/.test(isi);
      const garisLama = adaTanda && /\{\\sn\s*shapeType\}\{\\sv\s*(?:20|32)\}/.test(isi) && !/\\shptxt/.test(isi);
      const grupGarisLama = adaTanda && /^\{\\shpgrp/.test(isi) && !/\\shptxt/.test(isi) && grupHanyaGaris(isi);
      const templat = /SC\s*Z/.test(isi) || /\{\\sv\s*FreeForm/i.test(isi) || garisLama || grupGarisLama;
      if (!buatanKita && !templat) continue;
      buang.push([a, b]);
      if (/\\shptxt/.test(isi) && !kotak) kotak = isi;
    }
  };
  for (const p of diperiksa) lihat(p);
  // sisa bentuk buatan modul ini di mana pun (mis. jangkar bergeser sesudah disunting)
  for (const p of urai.paragraf) {
    if (jangkar && (p.indeks === jangkar.paragrafUkur.indeks || p.indeks === jangkar.paragrafBentuk?.indeks)) continue;
    for (const [a, b] of p.shp) if (/zcross-/.test(s.slice(a, b))) buang.push([a, b]);
  }
  s = hapusRentang(s, buang);
  return { rtf: s, kotakTanggal: kotak, jumlahBentukDibuang: buang.length };
}

// ----------------------------------------------------------------------------
// Ukuran halaman dan tepi dari RTF
// ----------------------------------------------------------------------------
export type UkuranRtf = { lebar: number; tinggi: number; kiri: number; kanan: number; atas: number; bawah: number };

/** Ukuran halaman (pt) dan tepi dari seksi yang memuat posisi `pos` (kontrol \sxn bila ada, selainnya bawaan dokumen). */
export function ukuranDiPosisi(s: string, urai: HasilUrai, pos: number): UkuranRtf {
  const angka = (re: RegExp, dalam: string, bawaan: number): number => {
    const m = re.exec(dalam);
    return m ? Number(m[1]) : bawaan;
  };
  const kepala = s.slice(0, Math.min(s.length, 6000));
  let lebar = angka(/\\paperw(\d+)/, kepala, 12240);
  let tinggi = angka(/\\paperh(\d+)/, kepala, 15840);
  let kiri = angka(/\\margl(\d+)/, kepala, 1800);
  let kanan = angka(/\\margr(\d+)/, kepala, 1800);
  let atas = angka(/\\margt(\d+)/, kepala, 1440);
  let bawah = angka(/\\margb(\d+)/, kepala, 1440);
  let sd: KejadianRtf | null = null;
  for (const k of urai.kejadian) if (k.jenis === "sectd" && k.pos <= pos) sd = k;
  if (sd) {
    const kontrol = s.slice(sd.pos, sd.akhirKontrol);
    lebar = angka(/\\pgwsxn(\d+)/, kontrol, lebar);
    tinggi = angka(/\\pghsxn(\d+)/, kontrol, tinggi);
    kiri = angka(/\\marglsxn(\d+)/, kontrol, kiri);
    kanan = angka(/\\margrsxn(\d+)/, kontrol, kanan);
    atas = angka(/\\margtsxn(\d+)/, kontrol, atas);
    bawah = angka(/\\margbsxn(\d+)/, kontrol, bawah);
  }
  const pt = (t: number) => t / 20;
  return { lebar: pt(lebar), tinggi: pt(tinggi), kiri: pt(kiri), kanan: pt(kanan), atas: pt(atas), bawah: pt(bawah) };
}

export const tepiDariUkuran = (u: UkuranRtf): Tepi => ({ kiri: u.kiri, kanan: u.lebar - u.kanan, bawah: u.bawah });

// ----------------------------------------------------------------------------
// Bentuk
// ----------------------------------------------------------------------------
function idBentukBerikut(s: string): number {
  let maks = 2000;
  for (const m of s.matchAll(/\\shplid(\d+)/g)) maks = Math.max(maks, Number(m[1]));
  return maks + 1;
}

const sp = (nama: string, nilai: string | number) => `{\\sp{\\sn ${nama}}{\\sv ${nilai}}}`;

/** Bentuk bebas Z: garis atas dari (xAtas,0) ke (W,0), diagonal ke (0,H), garis bawah ke (W,H). Koordinat dalam twip relatif halaman. */
export function bentukGarisZ(r: RencanaZ, idAwal: number): string {
  const kiri = keTwip(r.bawah.x1);
  const kanan = keTwip(r.bawah.x2);
  const atas = keTwip(r.atas.y);
  const bawah = keTwip(r.bawah.y);
  const w = kanan - kiri;
  const h = bawah - atas;
  const xa = Math.max(0, Math.min(w, keTwip(r.atas.x1) - kiri));
  return (
    `{\\shp{\\*\\shpinst\\shpleft${kiri}\\shptop${atas}\\shpright${kanan}\\shpbottom${bawah}\\shpfhdr0\\shpbxpage\\shpbxignore\\shpbypage\\shpbyignore\\shpwr3\\shpwrk0\\shpfblwtxt0\\shpz0\\shplid${idAwal}` +
    sp("shapeType", 0) +
    sp("fFlipH", 0) +
    sp("fFlipV", 0) +
    sp("fLockAspectRatio", 0) +
    sp("WrapText", 0) +
    sp("posh", 0) +
    sp("posrelh", 1) +
    sp("posv", 0) +
    sp("posrelv", 1) +
    sp("geoRight", w) +
    sp("geoBottom", h) +
    sp("shapePath", 4) +
    sp("pVerticies", `8;4;(${xa},0);(${w},0);(0,${h});(${w},${h})`) +
    sp("pSegmentInfo", "2;9;16384;44032;1;44032;1;44032;1;44032;32768") +
    sp("fFilled", 0) +
    sp("lineStyle", 0) +
    sp("lineWidth", 9525) +
    sp("fLine", 1) +
    sp("fArrowheadsOK", 1) +
    sp("wzName", "zcross-garis") +
    sp("fLayoutInCell", 1) +
    "}}"
  );
}

/** Isi kotak teks tanggal bila tidak ada kotak lama: satu paragraf tanggal. */
function isiKotakBaru(tanggal: string): string {
  const aman = tanggal.replace(/[\\{}]/g, "").replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0)}?`);
  return `{\\shptxt \\pard\\plain\\li0\\ri0\\sa0\\sl240\\slmult1\\fs24 ${aman}\\par}`;
}

/** Grup {\shptxt ...} seimbang dari RTF sebuah bentuk, atau null. */
function ambilIsiKotak(bentuk: string): string | null {
  const awal = bentuk.indexOf("{\\shptxt");
  if (awal < 0) return null;
  let d = 0;
  for (let k = awal; k < bentuk.length; k += 1) {
    const c = bentuk[k];
    if (c === "\\") {
      k += 1;
      continue;
    }
    if (c === "{") d += 1;
    else if (c === "}") {
      d -= 1;
      if (d === 0) return bentuk.slice(awal, k + 1);
    }
  }
  return null;
}

/** Kotak teks tanggal baru, atau kotak lama yang dipindahkan: isinya (SC Z 1x / tanggal) tetap persis. */
export function bentukTanggal(r: RencanaZ, idAwal: number, lama: string | null, tanggal: string): string {
  const kiri = keTwip(r.tanggal.x);
  const atas = keTwip(r.tanggal.y);
  const kanan = kiri + keTwip(r.tanggal.lebar);
  const bawah = atas + keTwip(r.tanggal.tinggi);
  const posisi = `\\shpleft${kiri}\\shptop${atas}\\shpright${kanan}\\shpbottom${bawah}\\shpfhdr0\\shpbxpage\\shpbxignore\\shpbypage\\shpbyignore\\shpwr3\\shpwrk0\\shpfblwtxt0\\shpz1\\shplid${idAwal}`;
  const isiTeks = (lama ? ambilIsiKotak(lama) : null) ?? isiKotakBaru(tanggal);
  return (
    `{\\shp{\\*\\shpinst${posisi}` +
    sp("shapeType", 202) +
    sp("fFlipH", 0) +
    sp("fFlipV", 0) +
    sp("dxTextLeft", 0) +
    sp("dyTextTop", 0) +
    sp("dxTextRight", 0) +
    sp("dyTextBottom", 0) +
    sp("WrapText", 0) +
    sp("posh", 0) +
    sp("posrelh", 1) +
    sp("posv", 0) +
    sp("posrelv", 1) +
    sp("fLineOK", 1) +
    sp("fShadowOK", 0) +
    sp("fillOpacity", 0) +
    sp("fFilled", 0) +
    sp("lineStyle", 0) +
    sp("fLine", 0) +
    sp("wzName", "zcross-tanggal") +
    sp("fLayoutInCell", 1) +
    isiTeks +
    "}}"
  );
}

// ----------------------------------------------------------------------------
// Jarak huruf (merapatkan kalimat)
// ----------------------------------------------------------------------------
/** Memasang \expndtw-N pada tiap potongan teks paragraf (ditandai agar dapat dicabut). N dalam twip (1/20 pt) per huruf. */
export function rapatkanParagraf(s: string, p: ParagrafRtf, twipPerHuruf: number): string {
  const n = Math.max(1, Math.min(40, Math.round(twipPerHuruf)));
  let hasil = s;
  for (const [a, b] of [...p.segmen].sort((x, y) => y[0] - x[0])) {
    hasil = hasil.slice(0, b) + "{\\*\\zcxb}\\expndtw0 " + hasil.slice(b);
    hasil = hasil.slice(0, a) + `{\\*\\zcxa}\\expndtw-${n} ` + hasil.slice(a);
  }
  return hasil;
}

// ----------------------------------------------------------------------------
// Penulisan akhir
// ----------------------------------------------------------------------------
export type MasukanTulis = {
  rencana: RencanaZ;
  kotakTanggal: string | null;
  tanggal: string;
  /** Nomor halaman bagian berikutnya; null = tidak diatur. */
  nomorBerikut: number | null;
};

export type SeksiZ = "dipakai" | "disisipkan" | "tanpa-bagian-berikut";

type Ubahan = { dari: number; sampai: number; teks: string };

/** Kontrol seksi tanpa pengatur nomor halaman dan jenis pemisah (untuk disalin ke seksi baru). */
function kontrolSeksiBersih(kontrol: string): string {
  return kontrol.replace(/\\pgn(?:restart|cont|starts-?\d+|x-?\d+|y-?\d+)\s?/g, "").replace(/\\sbk(?:none|col|page|even|odd)\s?/g, "").trim();
}

/**
 * Menulis balik ke RTF yang SUDAH dibersihkan (bersihkanZRtf) dan dikenai jarak huruf bila perlu: menyisipkan bentuk di paragraf jangkar
 * dan mengatur ganti halaman + nomor halaman bagian berikutnya.
 *   - bila sesudah paragraf jangkar sudah ada pemisah seksi (\sect) tanpa teks di antaranya, seksi itu dipakai (nomor ditimpa);
 *   - bila masih ada teks sesudah jangkar tanpa pemisah, pemisah seksi halaman baru DISISIPKAN tepat sesudah paragraf jangkar;
 *   - bila tidak ada apa pun sesudahnya, tidak ada yang diubah selain bentuknya.
 */
export function tulisZRtf(s: string, jangkarIndeks: number, m: MasukanTulis): { rtf: string; seksi: SeksiZ; nomorDitulis: number | null } {
  const urai = uraiRtf(s);
  const p = urai.paragraf[jangkarIndeks];
  if (!p) throw new Error("Paragraf jangkar tidak ditemukan.");
  const id = idBentukBerikut(s);
  const bentuk = bentukGarisZ(m.rencana, id) + bentukTanggal(m.rencana, id + 1, m.kotakTanggal, m.tanggal);
  const ubahan: Ubahan[] = [];
  let seksi: SeksiZ = "tanpa-bagian-berikut";

  const sectBerikut = urai.kejadian.find((k) => k.jenis === "sect" && k.pos >= p.akhir);
  const adaTeksSesudah = urai.paragraf.some((q) => q.indeks > p.indeks && q.teks.trim().length > 0);
  const teksSebelumSect = sectBerikut
    ? urai.paragraf.some((q) => q.indeks > p.indeks && q.teks.trim().length > 0 && q.awal < sectBerikut.pos)
    : adaTeksSesudah;

  if (sectBerikut && !teksSebelumSect) {
    const sd = urai.kejadian.find((k) => k.jenis === "sectd" && k.pos >= sectBerikut.akhir);
    if (sd) {
      seksi = "dipakai";
      if (m.nomorBerikut != null) {
        const lama = s.slice(sd.akhir, sd.akhirKontrol);
        const sisa = lama.replace(/\\pgn(?:restart|cont|starts-?\d+)\s?/g, "").replace(/\\sbk(?:none|col)\s?/g, "").trim();
        const jenis = /\\sbk(?:page|even|odd)/.test(sisa) ? "" : "\\sbkpage ";
        ubahan.push({ dari: sd.akhir, sampai: sd.akhirKontrol, teks: `\\pgnrestart \\pgnstarts${m.nomorBerikut} ${jenis}${sisa} ` });
      }
    }
  } else if (adaTeksSesudah) {
    seksi = "disisipkan";
    let sd: KejadianRtf | null = null;
    for (const k of urai.kejadian) if (k.jenis === "sectd" && k.pos <= p.akhir) sd = k;
    const kontrol = sd ? kontrolSeksiBersih(s.slice(sd.pos, sd.akhirKontrol)) : "\\sectd";
    const nomor = m.nomorBerikut != null ? `\\pgnrestart \\pgnstarts${m.nomorBerikut} ` : "";
    ubahan.push({ dari: p.akhirGrup, sampai: p.akhirGrup, teks: `\\sect${kontrol} \\sbkpage ${nomor}` });
  }

  const posBentuk = p.akhirTeks >= 0 ? p.akhirTeks : p.akhir;
  ubahan.push({ dari: posBentuk, sampai: posBentuk, teks: bentuk });

  let hasil = s;
  for (const u of [...ubahan].sort((a, b) => b.dari - a.dari)) hasil = hasil.slice(0, u.dari) + u.teks + hasil.slice(u.sampai);
  return { rtf: hasil, seksi, nomorDitulis: seksi === "tanpa-bagian-berikut" ? null : m.nomorBerikut };
}

/** Tanggal pertama "tanggal 12 Agustus 2026" di naskah (tanggal sidang), selainnya null. */
export function tanggalDariNaskah(urai: HasilUrai): string | null {
  const bulan = "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember";
  const re = new RegExp(`tanggal\\s+(\\d{1,2}\\s+(?:${bulan})\\s+\\d{4})`, "i");
  for (const p of urai.paragraf) {
    const m = re.exec(p.teks);
    if (m) return m[1].replace(/\s+/g, " ");
  }
  return null;
}

export { CM, tanggalIndonesia };
