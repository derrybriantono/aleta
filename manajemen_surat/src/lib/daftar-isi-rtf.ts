import { type BarisHitung, teksRentang, tanggalIndonesia } from "@/lib/berkas-perkara";

/**
 * ============================================================================
 * TABEL DAFTAR ISI BERKAS SEBAGAI BARIS TABEL RTF (27 Okt 2026; 30 Okt penuh halaman) - MURNI
 * ============================================================================
 *
 * Sebelumnya kolom daftar isi berupa teks bergaris banyak di sel ABT: nama panjang membungkus dan kolom tanggal/halaman tak sejajar. Sekarang portal
 * menyusun baris tabel sungguhan dan menempelkannya menggantikan paragraf penanda (#5850# blangko lama, #11300#-#11302# paket sampul-rapi-30okt)
 * di RTF hasil isian ABT.
 *
 *   - perkara tingkat pertama = BUNDEL A saja; BUNDEL B hanya bila ada upaya hukum (banding, kasasi, peninjauan kembali) dan dicetak sebagai daftar isi sendiri
 *   - judul bagian (I. PENDAFTARAN dan seterusnya) berlatar tipis, tebal, sejajar; tanpa baris pemisah bundel kosong
 *   - kolom NO dan HALAMAN rata tengah, TANGGAL rata kiri; nama dokumen membungkus dalam selnya
 *   - 30 Okt: kolom dan huruf sama dengan tabel ABT (fungsi isian_rtf_tabel_daftar_isi); baris kosong sampai `barisMin` agar tabel memenuhi
 *     halaman (dokumen tambahan ditulis tangan); diakhiri paragraf biasa agar paragraf blangko sesudahnya tidak masuk tabel
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

const GARIS = "\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10";

export function tabelDaftarIsiRtf(baris: BarisHitung[], bundel: BundelCetak, lebar: number, barisMin = 0): string {
  const w = [600, 6100, 2150, 1600];
  const jumlah = w.reduce((a, x) => a + x, 0);
  const lk = w.map((x) => Math.trunc((x * lebar) / jumlah));
  lk[3] = lebar - lk.slice(0, 3).reduce((a, x) => a + x, 0);
  const batas: number[] = [];
  lk.reduce((a, x) => {
    batas.push(a + x);
    return a + x;
  }, 0);
  const para = (teks: string, o: { b?: boolean; al?: "l" | "c"; sz?: number } = {}) => `\\pard\\plain\\intbl\\q${o.al ?? "l"}\\f0\\fs${o.sz ?? 19}\\sb20\\sa20 ${o.b ? "\\b " : ""}${teks}\\cell\n`;
  const awal = (tinggi: number, kepala = false) => `\\trowd\\trgaph70\\trleft0\\trkeep${kepala ? "\\trhdr" : ""}\\trrh${tinggi}\n`;
  const kolom = batas.map((x) => `${GARIS}\\clvertalc\\cellx${x}`).join("");
  let s = `${awal(380, true)}${batas.map((x) => `\\clcbpat2${GARIS}\\clvertalc\\cellx${x}`).join("")}\n`;
  s += `${para("NO", { b: true, al: "c", sz: 16 })}${para("JENIS SURAT / DOKUMEN", { b: true, sz: 16 })}${para("TANGGAL", { b: true, sz: 16 })}${para("HALAMAN", { b: true, al: "c", sz: 16 })}\\row\n`;
  const tampil = baris.filter((b) => b.bundel === bundel && !b.tersembunyi);
  let jml = 0;
  if (!tampil.length) {
    s += `${awal(400)}\\clvertalc${GARIS}\\cellx${lebar}\n${para(esc("Belum ada dokumen"))}\\row\n`;
    jml = 1;
  }
  let grup = "";
  let no = 0;
  for (const b of tampil) {
    if (b.grup !== grup) {
      grup = b.grup;
      s += `${awal(360)}\\clcbpat3${GARIS}\\clvertalc\\cellx${lebar}\n\\pard\\plain\\intbl\\ql\\f0\\fs17\\sb20\\sa20 \\b ${esc(grup)}\\cell\n\\row\n`;
      jml += 1;
    }
    no += 1;
    const ket = b.ket && !/^[\s\-–—.0_]*$/.test(b.ket) ? b.ket : "";
    const nama = `${b.nama}${ket ? ` - ${ket}` : ""}`.replace(/\s+/g, " ").trim();
    s += `${awal(400)}${kolom}\n`;
    s += `${para(String(no), { al: "c" })}${para(esc(nama))}${para(esc(tanggalIndonesia(b.tanggal)))}${para(esc(teksRentang(b).replace("-", "–")), { al: "c" })}\\row\n`;
    jml += 1;
  }
  for (; jml < barisMin; jml += 1) s += `${awal(400)}${kolom}\n${para("", { al: "c" })}${para("")}${para("")}${para("", { al: "c" })}\\row\n`;
  return `${s}\\pard\\plain\\f0\\fs4 `;
}

/** Judul bundel dan subjudul kop untuk bundel yang dicetak; A (tingkat pertama) adalah kop bawaan blangko. */
export function ubahKopBundel(rtf: string, bundel: BundelCetak): string {
  if (bundel !== "B") return rtf;
  return rtf.replace("BUNDEL A", "BUNDEL B").replace("Daftar isi berkas perkara tingkat pertama", "Daftar isi berkas upaya hukum");
}
