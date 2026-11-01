/**
 * Penguraian XML mini untuk word/document.xml: pohon elemen dengan OFFSET ke teks asli, sehingga suntingan dilakukan dengan
 * menyisipkan / mengganti potongan teks (isi lain tidak disentuh sama sekali). Bukan penguraian umum: cukup untuk XML yang baik bentuknya.
 */
export type SimpulXml = {
  nama: string;
  /** Indeks "<" pembuka. */
  awal: number;
  /** Indeks tepat setelah ">" pembuka. */
  awalIsi: number;
  /** Indeks "<" penutup (= awalIsi bila elemen kosong / tertutup sendiri). */
  akhirIsi: number;
  /** Indeks tepat setelah ">" penutup. */
  akhir: number;
  tertutupSendiri: boolean;
  atribut: string;
  anak: SimpulXml[];
  induk: SimpulXml | null;
};

export function uraiXml(x: string): SimpulXml {
  const akar: SimpulXml = { nama: "#akar", awal: 0, awalIsi: 0, akhirIsi: x.length, akhir: x.length, tertutupSendiri: false, atribut: "", anak: [], induk: null };
  let kini = akar;
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  for (const m of x.matchAll(re)) {
    if (m[2] === undefined) continue;
    const awal = m.index ?? 0;
    const akhir = awal + m[0].length;
    if (m[1]) {
      // penutup: naik sampai nama cocok
      let s: SimpulXml | null = kini;
      while (s && s.nama !== m[2]) s = s.induk;
      if (!s || s === akar) continue;
      s.akhirIsi = awal;
      s.akhir = akhir;
      kini = s.induk ?? akar;
    } else {
      const sendiri = m[4] === "/";
      const s: SimpulXml = { nama: m[2], awal, awalIsi: akhir, akhirIsi: sendiri ? akhir : akhir, akhir, tertutupSendiri: sendiri, atribut: m[3], anak: [], induk: kini };
      kini.anak.push(s);
      if (!sendiri) kini = s;
    }
  }
  return akar;
}

export function semuaKeturunan(s: SimpulXml, f: (n: SimpulXml) => boolean | void, lewati?: (n: SimpulXml) => boolean): void {
  for (const a of s.anak) {
    if (f(a) === false) continue;
    if (lewati && lewati(a)) continue;
    semuaKeturunan(a, f, lewati);
  }
}

export function cari(s: SimpulXml, nama: string): SimpulXml[] {
  const hasil: SimpulXml[] = [];
  semuaKeturunan(s, (n) => {
    if (n.nama === nama) hasil.push(n);
  });
  return hasil;
}

export function leluhur(s: SimpulXml, nama: string): SimpulXml | null {
  for (let p = s.induk; p; p = p.induk) if (p.nama === nama) return p;
  return null;
}

export function atribut(s: SimpulXml, nama: string): string | null {
  const m = new RegExp(`(?:^|\\s)${nama.replace(/[:.]/g, "\\$&")}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(s.atribut);
  return m ? (m[2] ?? m[3] ?? "") : null;
}

export function dekodeEntitas(t: string): string {
  return t
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function enkodeEntitas(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
