/**
 * ============================================================================
 * PEMBACA RUJUKAN PASAL (P1 rak peraturan, 1 Nov 2026)
 * ============================================================================
 *
 * Menemukan rujukan "Pasal ... <peraturan>" di naskah (teks polos hasil RTF) beserta ayat/huruf/angka dan kutipan bunyinya
 * ("... yang berbunyi: "...""). Murni: tanpa DOM, tanpa jaringan, tanpa berkas.
 *
 * KINERJA (arahan pengguna 1 Nov): satu sapuan linear. Satu regex global sederhana mencari kata "Pasal"; sesudahnya penguraian
 * maju dengan regex lekat (flag y) yang masing-masing berpanjang terbatas - tanpa kuantor bersarang, jadi tanpa backtracking
 * katastrofik. Jendela per rujukan dibatasi (BATAS_JENDELA), kutipan dibatasi (BATAS_KUTIPAN).
 *
 * Bentuk yang dikenali (diukur atas blangko Derry, katalog saksi, dan kode deteksi):
 *   Pasal 116 huruf f Kompilasi Hukum Islam            Pasal 116 huruf (f) KHI
 *   Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974  Pasal 19 huruf f PP 9/1975        Pasal 3 ayat (2)(3) PP 10/1983
 *   Pasal 171, 172 dan 175 RBg                          Pasal 308 dan 309 RBg             Pasal 39 sampai dengan Pasal 44 KHI
 *   Pasal 154 ayat (2) dan ayat (3) RBg                 Pasal 49 huruf a angka 20 ...     Penjelasan Pasal 49 ... (ditandai penjelasan)
 */

export type ButirPasal = {
  /** Nomor pasal sebagaimana tertulis, huruf akhiran dikecilkan ("132b"). */
  pasal: string;
  ayat: string[];
  huruf: string[];
  angka: string[];
  /** "Pasal 39 sampai dengan Pasal 44": butir 39 dengan rentangKe "44". */
  rentangKe?: string;
};

export type Rujukan = {
  /** Posisi rujukan di teks (kata "Pasal" pertama sampai akhir nama peraturan). */
  mulai: number;
  akhir: number;
  teks: string;
  /** Kode peraturan (lihat kenaliPeraturan): "KHI", "RBG", "HIR", "UU-1-1974", "PP-9-1975", ... ; null = nama tidak dikenali/tidak ada. */
  peraturan: string | null;
  namaTertulis: string;
  butir: ButirPasal[];
  /** Didahului kata "Penjelasan" - yang dirujuk penjelasan pasal, bukan batang tubuhnya. */
  penjelasan: boolean;
  /** Bunyi yang dikutip sesudah rujukan (di antara tanda petik), atau null. */
  kutipan: string | null;
  /** Peraturan tidak tertulis langsung: diambil dari rujukan sesudah "jo." ("Pasal 4 ayat (1) jo. Pasal 17 PERMA 1/2016"). */
  ikutBerikut?: boolean;
};

const BATAS_JENDELA = 320;
const BATAS_KUTIPAN = 2400;
const JARAK_KUTIPAN = 160;

// ── Regex lekat (y): tiap pola berpanjang terbatas ─────────────────────────────────────────────────────────────────────
const R_SPASI = /[ \t\u00a0\r\n]{0,12}/y;
const R_NOMOR = /(\d{1,4})([A-Za-z](?![A-Za-z]))?/y;
const R_AYAT = /ayat[ \t\u00a0]{0,4}/iy;
const R_KURUNG_ANGKA = /\([ ]{0,2}(\d{1,3}[a-z]?)[ ]{0,2}\)/y;
const R_ANGKA_POLOS = /(\d{1,3})(?![\d/])/y;
const R_HURUF_KATA = /huruf[ \t\u00a0]{0,4}/iy;
const R_HURUF = /\(?([a-z])\)?(?![a-zA-Z])/y;
const R_ANGKA_KATA = /angka[ \t\u00a0]{0,4}(\d{1,3})(?!\d)/iy;
const R_SAMBUNG = /(?:,[ \t]{0,3}(?:dan|serta|atau)?|dan|serta|atau|jo\.?|juncto|sampai[ \t]{1,3}dengan|s\.[ ]?d\.?|hingga|-|–)(?![A-Za-z])/iy;
const R_RENTANG = /(?:sampai[ \t]{1,3}dengan|s\.[ ]?d\.?|hingga|-|–)$/i;
/** Sambungan ANTAR butir pasal tanpa "jo." - "jo." biasanya menyambung peraturan lain ("Pasal 116 huruf f jo. Pasal 19 ... PP 9/1975"). */
const R_SAMBUNG_BUTIR = /(?:,[ \t]{0,3}(?:dan|serta|atau)?|dan|serta|atau|sampai[ \t]{1,3}dengan|s\.[ ]?d\.?|hingga|-|–)(?![A-Za-z])/iy;
const R_PASAL_KATA = /pasal[ \t\u00a0]{1,4}/iy;
const R_PENGHUBUNG = /(?:dari|pada|dalam|di[ \t]{1,3}dalam)[ \t\u00a0]{1,4}/iy;

type PolaPeraturan = { re: RegExp; kode: (m: RegExpExecArray) => string };
const NOMOR_TAHUN = String.raw`(?:Republik[ \t]{1,3}Indonesia[ \t]{1,3}|RI[ \t]{1,3})?(?:Nomor|No\.?|Nr\.?)[ \t]{0,3}(\d{1,4})[ \t]{1,3}Tahun[ \t]{1,3}(\d{4})`;
const NOMOR_GARIS = String.raw`(\d{1,4})[ \t]{0,2}\/[ \t]{0,2}(\d{4})(?!\d)`;
const POLA_PERATURAN: PolaPeraturan[] = [
  { re: /Kompilasi[ \t\u00a0]{1,3}Hukum[ \t\u00a0]{1,3}Islam|KHI(?![A-Za-z])/y, kode: () => "KHI" },
  { re: /Undang-Undang[ \t]{1,3}Dasar(?:[ \t]{1,3}Negara[ \t]{1,3}Republik[ \t]{1,3}Indonesia)?[ \t]{1,3}(?:Tahun[ \t]{1,3})?1945|UUD[ \t]{0,3}(?:NRI[ \t]{1,3})?(?:Tahun[ \t]{1,3})?1945/iy, kode: () => "UUD-1945" },
  { re: new RegExp(String.raw`(?:Undang-Undang|Undang-undang|UU)[ \t]{1,3}${NOMOR_TAHUN}`, "iy"), kode: (m) => `UU-${+m[1]}-${m[2]}` },
  { re: new RegExp(String.raw`UU[ \t]{0,3}${NOMOR_GARIS}`, "iy"), kode: (m) => `UU-${+m[1]}-${m[2]}` },
  { re: new RegExp(String.raw`(?:Peraturan[ \t]{1,3}Pemerintah|PP)[ \t]{1,3}${NOMOR_TAHUN}`, "iy"), kode: (m) => `PP-${+m[1]}-${m[2]}` },
  { re: new RegExp(String.raw`PP[ \t]{0,3}${NOMOR_GARIS}`, "iy"), kode: (m) => `PP-${+m[1]}-${m[2]}` },
  { re: new RegExp(String.raw`(?:Peraturan[ \t]{1,3}Mahkamah[ \t]{1,3}Agung(?:[ \t]{1,3}Republik[ \t]{1,3}Indonesia|[ \t]{1,3}RI)?|PERMA)[ \t]{1,3}${NOMOR_TAHUN}`, "iy"), kode: (m) => `PERMA-${+m[1]}-${m[2]}` },
  { re: new RegExp(String.raw`PERMA[ \t]{0,3}${NOMOR_GARIS}`, "iy"), kode: (m) => `PERMA-${+m[1]}-${m[2]}` },
  { re: new RegExp(String.raw`(?:Surat[ \t]{1,3}Edaran[ \t]{1,3}Mahkamah[ \t]{1,3}Agung(?:[ \t]{1,3}Republik[ \t]{1,3}Indonesia|[ \t]{1,3}RI)?|SEMA)[ \t]{1,3}${NOMOR_TAHUN}`, "iy"), kode: (m) => `SEMA-${+m[1]}-${m[2]}` },
  { re: new RegExp(String.raw`SEMA[ \t]{0,3}${NOMOR_GARIS}`, "iy"), kode: (m) => `SEMA-${+m[1]}-${m[2]}` },
  { re: new RegExp(String.raw`(?:Instruksi[ \t]{1,3}Presiden|Inpres)[ \t]{1,3}${NOMOR_TAHUN}`, "iy"), kode: (m) => `INPRES-${+m[1]}-${m[2]}` },
  {
    re: /R\.[ ]?Bg\.?|RBg(?![A-Za-z])|Rbg(?![A-Za-z])|RBG(?![A-Za-z])|Reglemen[ \t]{1,3}Acara[ \t]{1,3}Hukum[ \t]{1,3}untuk[ \t]{1,3}Daerah[ \t]{1,3}Luar[ \t]{1,3}Jawa[ \t]{1,3}dan[ \t]{1,3}Madura|Rechtsreglement[ \t]{1,3}Buitengewesten/iy,
    kode: () => "RBG",
  },
  { re: /H\.I\.R\.?|HIR(?![A-Za-z])|Herzien[ \t]{1,3}Inlandsch[ \t]{1,3}Reglement|Reglemen[ \t]{1,3}Indonesia[ \t]{1,3}yang[ \t]{1,3}Diperbaharui/iy, kode: () => "HIR" },
  {
    re: /KUH[ ]?Perdata|KUHPer(?![A-Za-z])|Kitab[ \t]{1,3}Undang-Undang[ \t]{1,3}Hukum[ \t]{1,3}Perdata|BW(?![A-Za-z])|Burgerlijk[ \t]{1,3}Wetboek/iy,
    kode: () => "KUHPERDATA",
  },
  { re: /Rv\.?(?![A-Za-z])|RV(?![A-Za-z])|Reglement[ \t]{1,3}op[ \t]{1,3}de[ \t]{1,3}(?:Burgerlijke[ \t]{1,3})?Rechtsvordering/y, kode: () => "RV" },
];

/** Kode peraturan untuk nama yang dimulai tepat di posisi `i`; null bila tidak ada. */
export function kenaliPeraturan(s: string, i: number): { kode: string; akhir: number; nama: string } | null {
  for (const p of POLA_PERATURAN) {
    p.re.lastIndex = i;
    const m = p.re.exec(s);
    if (m) return { kode: p.kode(m), akhir: p.re.lastIndex, nama: m[0] };
  }
  return null;
}

/** Kode peraturan dari teks bebas ("Pasal 39 ayat (2) UU 1/1974" -> UU-1-1974), dipakai untuk rujukan tunggal. */
export function kodePeraturanDariTeks(t: string): string | null {
  const s = String(t ?? "");
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // Hanya mencoba di awal kata.
    if (i > 0 && /[A-Za-z0-9]/.test(s[i - 1])) continue;
    if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122))) continue;
    const k = kenaliPeraturan(s, i);
    if (k) return k.kode;
  }
  return null;
}

function lekat(re: RegExp, s: string, i: number): RegExpExecArray | null {
  re.lastIndex = i;
  return re.exec(s);
}

const lewatSpasi = (s: string, i: number) => {
  R_SPASI.lastIndex = i;
  R_SPASI.exec(s);
  return R_SPASI.lastIndex;
};

/** Ayat: "ayat (2)", "ayat (2)(3)", "ayat (2) dan (3)", "ayat (2) dan ayat (3)", "ayat 2". -> [daftar, posisi akhir] */
function bacaAyat(s: string, i: number): [string[], number] {
  const hasil: string[] = [];
  let j = i;
  if (!lekat(R_AYAT, s, j)) return [hasil, i];
  j = R_AYAT.lastIndex;
  let m = lekat(R_KURUNG_ANGKA, s, j);
  if (!m) {
    m = lekat(R_ANGKA_POLOS, s, j);
    if (!m) return [hasil, i];
    hasil.push(m[1]);
    // "ayat 1 dan 2" / "ayat 1, 2" (tanpa kurung)
    let jp = R_ANGKA_POLOS.lastIndex;
    for (let n = 0; n < 8; n++) {
      const k = lewatSpasi(s, jp);
      if (!lekat(R_SAMBUNG, s, k)) break;
      let k2 = lewatSpasi(s, R_SAMBUNG.lastIndex);
      if (lekat(R_AYAT, s, k2)) k2 = R_AYAT.lastIndex;
      const m2 = lekat(R_ANGKA_POLOS, s, k2);
      if (!m2) break;
      hasil.push(m2[1]);
      jp = R_ANGKA_POLOS.lastIndex;
    }
    return [hasil, jp];
  }
  hasil.push(m[1]);
  j = R_KURUNG_ANGKA.lastIndex;
  for (let n = 0; n < 12; n++) {
    // "(2)(3)" langsung bersambung
    let k = lewatSpasi(s, j);
    let m2 = lekat(R_KURUNG_ANGKA, s, k);
    if (m2) {
      hasil.push(m2[1]);
      j = R_KURUNG_ANGKA.lastIndex;
      continue;
    }
    const sb = lekat(R_SAMBUNG, s, k);
    if (!sb) break;
    const sesudahSambung = R_SAMBUNG.lastIndex;
    k = lewatSpasi(s, sesudahSambung);
    if (lekat(R_AYAT, s, k)) k = R_AYAT.lastIndex;
    m2 = lekat(R_KURUNG_ANGKA, s, k);
    if (!m2) break;
    if (R_RENTANG.test(sb[0].trim())) {
      const a = parseInt(hasil[hasil.length - 1], 10);
      const b = parseInt(m2[1], 10);
      for (let x = a + 1; x <= b && x - a < 30; x++) hasil.push(String(x));
    } else hasil.push(m2[1]);
    j = R_KURUNG_ANGKA.lastIndex;
  }
  return [hasil, j];
}

/** Huruf: "huruf f", "huruf (f)", "huruf a, b dan c", "huruf a dan huruf b". */
function bacaHuruf(s: string, i: number): [string[], number] {
  const hasil: string[] = [];
  if (!lekat(R_HURUF_KATA, s, i)) return [hasil, i];
  let j = R_HURUF_KATA.lastIndex;
  const m = lekat(R_HURUF, s, j);
  if (!m) return [hasil, i];
  hasil.push(m[1].toLowerCase());
  j = R_HURUF.lastIndex;
  for (let n = 0; n < 12; n++) {
    let k = lewatSpasi(s, j);
    const sb = lekat(R_SAMBUNG, s, k);
    if (!sb) break;
    k = lewatSpasi(s, R_SAMBUNG.lastIndex);
    if (lekat(R_HURUF_KATA, s, k)) k = R_HURUF_KATA.lastIndex;
    const m2 = lekat(R_HURUF, s, k);
    // Huruf tunggal sesudah "dan" bisa awal kata biasa ("dan c" vs "dan tidak") - R_HURUF menolak huruf yang diikuti huruf lain.
    if (!m2) break;
    hasil.push(m2[1].toLowerCase());
    j = R_HURUF.lastIndex;
  }
  return [hasil, j];
}

/** Satu butir pasal mulai dari nomor di posisi i. */
function bacaButir(s: string, i: number): [ButirPasal, number] | null {
  const m = lekat(R_NOMOR, s, i);
  if (!m) return null;
  const butir: ButirPasal = { pasal: m[1] + (m[2] ? m[2].toLowerCase() : ""), ayat: [], huruf: [], angka: [] };
  let j = R_NOMOR.lastIndex;
  for (let n = 0; n < 4; n++) {
    const k = lewatSpasi(s, j);
    const [ay, ja] = bacaAyat(s, k);
    if (ay.length) {
      butir.ayat.push(...ay);
      j = ja;
      continue;
    }
    const [hu, jh] = bacaHuruf(s, k);
    if (hu.length) {
      butir.huruf.push(...hu);
      j = jh;
      continue;
    }
    const an = lekat(R_ANGKA_KATA, s, k);
    if (an) {
      butir.angka.push(an[1]);
      j = R_ANGKA_KATA.lastIndex;
      continue;
    }
    break;
  }
  return [butir, j];
}

const R_PEMICU_KUTIPAN = /(?:berbunyi|menyatakan|menyebutkan|menegaskan|menentukan|disebutkan|ditegaskan|ditentukan|mengatur|diatur|bahwa)[ \t]{0,3}:?|:/i;
const R_SUMBER_LAIN = /kaidah|kaedah|qaidah|qa'idah|kitab|hadis|hadits|hadist|firman|al-?qur|\bQS\.?\s|surat\s+al|surah|ulama|fuqaha|pendapat|doktrin|yurisprudensi|putusan\s+mahkamah|dalil|sabda|rasulullah|\bnabi\b|surat\s+edaran|\bsema\b|\bperma\b|peraturan\s+mahkamah|\bjo\b|juncto/i;
const BUKA_PETIK = new Set(['"', "“", "„", "«"]);
const TUTUP_PETIK: Record<string, string[]> = { '"': ['"', "”"], "“": ["”", '"'], "„": ["”", "“"], "«": ["»"] };

/** Kutipan sesudah rujukan: petik pembuka dalam JARAK_KUTIPAN aksara yang didahului kata pemicu, sampai petik penutup. */
function bacaKutipan(s: string, i: number): string | null {
  const batas = Math.min(s.length, i + JARAK_KUTIPAN);
  let buka = -1;
  for (let k = i; k < batas; k++) {
    const c = s[k];
    if (c === ";") return null;
    if (BUKA_PETIK.has(c)) {
      buka = k;
      break;
    }
    // Rujukan berikutnya sebelum petik = kutipan itu bukan milik rujukan ini.
    if ((c === "P" || c === "p") && /^pasal\s/i.test(s.slice(k, k + 6))) return null;
  }
  if (buka < 0) return null;
  // Pemicu ("yang berbunyi:", "menyatakan", ":") harus ada, dan antara rujukan dan petik tidak boleh ada sumber lain
  // (kaidah fikih, kitab, hadis, ayat Al-Qur'an, pendapat ulama) - kutipan itu bukan bunyi pasal.
  const antara = s.slice(i, buka);
  if (!R_PEMICU_KUTIPAN.test(antara) || R_SUMBER_LAIN.test(antara)) return null;
  const pembuka = s[buka];
  const penutup = TUTUP_PETIK[pembuka] || ['"'];
  const akhirBatas = Math.min(s.length, buka + 1 + BATAS_KUTIPAN);
  for (let k = buka + 1; k < akhirBatas; k++) {
    if (penutup.includes(s[k])) {
      const isi = s.slice(buka + 1, k).trim();
      return isi.length >= 12 ? isi : null;
    }
    // Petik penutup terlupa: petik pembuka lengkung berikutnya, atau butir/paragraf baru ("; - Bahwa", "Menimbang"), mengakhiri
    // kutipan di titik koma terakhir sebelumnya.
    if (s[k] === "“" || ((s[k] === "M" || s[k] === "-") && /^(?:Menimbang|- Bahwa)/.test(s.slice(k, k + 10)))) {
      const potong = s.slice(buka + 1, k);
      const tk = potong.lastIndexOf(";");
      const isi = (tk > 0 ? potong.slice(0, tk) : potong).trim();
      return isi.length >= 12 ? isi : null;
    }
  }
  return null;
}

/**
 * Semua rujukan pasal di teks. Rujukan yang namanya tidak dikenali tetap dikembalikan dengan peraturan null
 * ("Pasal 49 tersebut", "pasal ini") supaya pemanggil dapat mengabaikannya.
 */
export function temukanRujukan(teksMasuk: string): Rujukan[] {
  const s = String(teksMasuk ?? "");
  const hasil: Rujukan[] = [];
  const joKe = new Map<number, number>();
  const cari = /\bpasal[ \t\u00a0]{1,4}(?=\d)/gi;
  let m: RegExpExecArray | null;
  while ((m = cari.exec(s))) {
    const mulai = m.index;
    const batas = Math.min(s.length, mulai + BATAS_JENDELA);
    const butir: ButirPasal[] = [];
    let j = cari.lastIndex;
    let akhirButir = j;
    let rentangBerikut = false;
    for (let n = 0; n < 24 && j < batas; n++) {
      const b = bacaButir(s, j);
      if (!b) break;
      const [bt, jb] = b;
      if (rentangBerikut && butir.length) {
        butir[butir.length - 1].rentangKe = bt.pasal;
        rentangBerikut = false;
      } else butir.push(bt);
      j = jb;
      akhirButir = j;
      // sambungan ke butir berikutnya: ", 172", "dan 175", "jo. Pasal 19", "sampai dengan Pasal 44"
      const k = lewatSpasi(s, j);
      const sb = lekat(R_SAMBUNG_BUTIR, s, k);
      if (!sb) break;
      let k2 = lewatSpasi(s, R_SAMBUNG_BUTIR.lastIndex);
      if (lekat(R_PASAL_KATA, s, k2)) k2 = R_PASAL_KATA.lastIndex;
      if (!lekat(R_NOMOR, s, k2)) break;
      if (R_RENTANG.test(sb[0].trim())) rentangBerikut = true;
      j = k2;
    }
    if (!butir.length) continue;
    // Nama peraturan: langsung sesudah butir, boleh didahului "dari"/"pada"/"dalam".
    let k = lewatSpasi(s, akhirButir);
    if (lekat(R_PENGHUBUNG, s, k)) k = R_PENGHUBUNG.lastIndex;
    const per = kenaliPeraturan(s, k);
    const akhir = per ? per.akhir : akhirButir;
    const sebelum = s.slice(Math.max(0, mulai - 14), mulai);
    const r: Rujukan = {
      mulai,
      akhir,
      teks: s.slice(mulai, akhir),
      peraturan: per ? per.kode : null,
      namaTertulis: per ? per.nama : "",
      butir,
      penjelasan: /penjelasan[\s\u00a0]+$/i.test(sebelum),
      kutipan: per ? bacaKutipan(s, akhir) : null,
    };
    hasil.push(r);
    if (!per) {
      // "Pasal 4 ayat (1) jo. Pasal 17 ... PERMA 1/2016": tanpa nama, langsung disambung "jo." ke rujukan berikutnya.
      R_JO.lastIndex = akhirButir;
      if (R_JO.exec(s)) joKe.set(hasil.length - 1, R_JO.lastIndex);
    }
    // Rujukan berikutnya dicari sesudah butir terakhir (bukan sesudah nama) supaya "jo. Pasal ..." tetap terbaca.
    cari.lastIndex = Math.max(cari.lastIndex, akhirButir);
  }
  // Rujukan tanpa nama yang di-"jo."-kan mengikuti peraturan rujukan sesudahnya (ditandai ikutBerikut - tafsiran, bukan tertulis).
  for (let i = hasil.length - 2; i >= 0; i--) {
    const ke = joKe.get(i);
    const n = hasil[i + 1];
    if (ke === undefined || !n.peraturan || n.mulai !== ke) continue;
    hasil[i].peraturan = n.peraturan;
    hasil[i].namaTertulis = n.namaTertulis;
    hasil[i].ikutBerikut = true;
  }
  return hasil;
}

/** "jo." / "juncto" lalu kata "Pasal" (posisi akhir = awal rujukan berikutnya). */
const R_JO = /[ \t\u00a0]{0,4}(?:jo\.?|juncto)[ \t\u00a0]{1,4}(?=pasal[ \t\u00a0])/iy;

