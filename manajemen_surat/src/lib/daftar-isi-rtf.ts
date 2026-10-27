import { type BarisHitung, teksRentang, tanggalIndonesia } from "@/lib/berkas-perkara";

/**
 * ============================================================================
 * TABEL DAFTAR ISI BERKAS SEBAGAI BARIS TABEL RTF (27 Okt 2026) - MURNI
 * ============================================================================
 *
 * Sebelumnya kolom daftar isi berupa teks bergaris banyak di sel ABT: nama panjang membungkus dan kolom tanggal/halaman tak sejajar. Sekarang portal
 * menyusun baris tabel sungguhan dan menempelkannya menggantikan paragraf penanda #5850# di RTF hasil isian ABT.
 *
 *   - perkara tingkat pertama = BUNDEL A saja; BUNDEL B hanya bila ada upaya hukum (banding, kasasi, peninjauan kembali) dan dicetak sebagai daftar isi sendiri
 *   - judul bagian (I. PENDAFTARAN dan seterusnya) berlatar tipis, tebal, sejajar; tanpa baris pemisah bundel kosong
 *   - kolom NO dan HALAMAN rata tengah, TANGGAL rata kiri; nama dokumen membungkus dalam selnya
 */

export type BundelCetak = "A" | "B";

function esc(t: string): string {
  let h = "";
  for (const ch of t) {
    const o = ch.codePointAt(0) ?? 0;
    if (ch === "\\" || ch === "{" || ch === "}") h += `\\${ch}`;
    else if (o > 127) h += `\\u${o > 32767 ? o - 65536 : o}?`;
    else h += ch;
  }
  return h;
}

export function tabelDaftarIsiRtf(baris: BarisHitung[], bundel: BundelCetak, lebar: number): string {
  const w = [620, 6200, 2000, 1686];
  const jumlah = w.reduce((a, x) => a + x, 0);
  const lk = w.map((x) => Math.trunc((x * lebar) / jumlah));
  lk[3] = lebar - lk.slice(0, 3).reduce((a, x) => a + x, 0);
  const batas: number[] = [];
  lk.reduce((a, x) => {
    batas.push(a + x);
    return a + x;
  }, 0);
  const garis = `\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10`;
  const para = (teks: string, o: { b?: boolean; al?: "l" | "c"; sz?: number } = {}) => `\\pard\\plain\\intbl\\q${o.al ?? "l"}\\f0\\fs${o.sz ?? 17}\\sb40\\sa40 ${o.b ? "\\b " : ""}${teks}\\cell\n`;
  const awal = `\\trowd\\trgaph80\\trleft0\\trkeep\n`;
  let s = `${awal.replace("\\trkeep", "\\trkeep\\trhdr")}${batas.map((x) => `\\clcbpat2${garis}\\clvertalc\\cellx${x}`).join("")}\n`;
  s += `${para("NO", { b: true, al: "c", sz: 15 })}${para("JENIS DOKUMEN", { b: true, sz: 15 })}${para("TANGGAL", { b: true, sz: 15 })}${para("HALAMAN", { b: true, al: "c", sz: 15 })}\\row\n`;
  const tampil = baris.filter((b) => b.bundel === bundel && !b.tersembunyi);
  if (!tampil.length) {
    return `${s}${awal}\\clvertalc${garis}\\cellx${lebar}\n${para(esc("Belum ada dokumen"), { sz: 17 })}\\row\n`;
  }
  let grup = "";
  let no = 0;
  for (const b of tampil) {
    if (b.grup !== grup) {
      grup = b.grup;
      s += `${awal}\\clcbpat3${garis}\\clvertalc\\cellx${lebar}\n\\pard\\plain\\intbl\\ql\\f0\\fs16\\sb50\\sa50 \\b ${esc(grup)}\\cell\n\\row\n`;
    }
    no += 1;
    const nama = `${b.nama}${b.ket ? ` - ${b.ket}` : ""}`.replace(/\s+/g, " ").trim();
    s += `${awal}${batas.map((x) => `${garis}\\clvertalc\\cellx${x}`).join("")}\n`;
    s += `${para(String(no), { al: "c" })}${para(esc(nama))}${para(esc(tanggalIndonesia(b.tanggal)))}${para(esc(teksRentang(b).replace("-", "–")), { al: "c" })}\\row\n`;
  }
  return s;
}

/** Judul bundel dan subjudul kop untuk bundel yang dicetak; A (tingkat pertama) adalah kop bawaan blangko. */
export function ubahKopBundel(rtf: string, bundel: BundelCetak): string {
  if (bundel !== "B") return rtf;
  return rtf.replace("BUNDEL A", "BUNDEL B").replace("Daftar isi berkas perkara tingkat pertama", "Daftar isi berkas upaya hukum");
}
