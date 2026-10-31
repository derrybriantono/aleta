// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import * as TS from "@/lib/deteksi-sisa-blangko";

/**
 * ============================================================================
 * SISA BLANGKO MERAH + PERLUASAN POLA + RAPIKAN PARAGRAF KOSONG (31 Okt 2026)
 * ============================================================================
 *
 * 1. Temuan tingkat PASTI diwarnai merah di RTF cetak/unduh (\colortbl + \cfN ... kembali ke warna semula), RTF tetap seimbang.
 * 2. Pola baru: PASTI (merah + .txt) dan RAGU (hanya .txt "Periksa"), tiap pola = uji kena + uji tidak salah tangkap.
 * 3. Bahasa blangko / isian kosong (permintaan tambahan A).
 * 4. Blok Jurusita / Jurusita Pengganti: titik isian tangan tidak ditandai, tidak dimerahkan, tidak dirapikan.
 * 5. Paragraf kosong akibat enter dihapus (kecuali kop, TTD, Jurusita, ganti halaman, tabel, gambar).
 *
 * Naskah seluruhnya rekaan.
 */

const AKAR = path.resolve(__dirname, "../../..");
const JS = createRequire(import.meta.url)(path.join(AKAR, "ekstensi-sipp/deteksi-sisa-blangko.js")) as typeof TS & {
  merahkanRtf: (rtf: string, opsi?: Record<string, unknown>) => { rtf: string; jumlah: number; potongan: number; indeks: number };
  rapikanBarisKosong: (rtf: string) => { rtf: string; tempat: number; dihapus: number; judul: number };
  JENIS_RAGU: Set<string>;
};

const WARNA = String.raw`{\colortbl;\red0\green0\blue0;\red0\green0\blue255;}`;
const KEPALA = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}${WARNA}\f0\fs24 `;
/** Satu paragraf = satu argumen; "" = paragraf kosong (enter). */
function rtf(...paragraf: string[]): string {
  return KEPALA + paragraf.map((p) => `${p}\\par `).join("") + "}";
}
function seimbang(r: string): boolean {
  let dalam = 0;
  for (let i = 0; i < r.length; i += 1) {
    if (r[i] === "\\") {
      i += 1;
      continue;
    }
    if (r[i] === "{") dalam += 1;
    else if (r[i] === "}") {
      dalam -= 1;
      if (dalam < 0) return false;
    }
  }
  return dalam === 0;
}
const jenis = (teks: string, opsi?: { jenis?: string }) => JS.periksaTeks(teks, opsi as never).temuan.map((t) => t.jenis);
const cocok = (teks: string, j: string, opsi?: { jenis?: string }) => JS.periksaTeks(teks, opsi as never).temuan.filter((t) => t.jenis === j).map((t) => t.cocok);
/** Teks merah hasil pembacaan RTF yang sudah dimerahkan. */
function teksMerah(r: string): string[] {
  const hasil: string[] = [];
  for (const p of JS.bacaRtfParagraf(r)) for (const [a, b] of p.merah) hasil.push(p.teks.slice(a, b));
  return hasil;
}

// ---------------------------------------------------------------------------
describe("1. pola PASTI baru (3b): kena + tidak salah tangkap", () => {
  it("isian setengah: 20..", () => {
    expect(cocok("pada tahun 20.. di Donggala", "titik")).toEqual(["20.."]);
    expect(cocok("pada tahun 202… di Donggala", "titik")).toEqual(["202…"]);
    expect(jenis("pada tahun 2026. Setelah itu 20 orang")).toEqual([]);
    expect(jenis("tahun 2026..")).toEqual([]);
  });
  it("isian setengah: Nomor ..../Pdt.G/....", () => {
    expect(cocok("Nomor ..../Pdt.G/.... di PA", "titik")).toEqual(["..../Pdt.G/...."]);
    expect(cocok("Nomor 12/Pdt.G/..../PA.Dgl", "titik")).toEqual(["Pdt.G/..../PA.Dgl"]);
    expect(jenis("Nomor 12/Pdt.G/2026/PA.Dgl")).toEqual([]);
  });
  it("isian setengah: Rp. ....", () => {
    expect(cocok("sebesar Rp. .... untuk biaya", "titik")).toEqual(["Rp. ...."]);
    expect(jenis("sebesar Rp. 60.000,- untuk biaya")).toEqual([]);
    // pengecualian lama: titik pengantar sebelum nominal
    expect(jenis("Biaya panggilan ........ Rp. 60.000,-")).toEqual([]);
  });
  it("isian setengah: hari ..., tanggal ...", () => {
    expect(cocok("pada hari ..., tanggal ... dibacakan", "titik")).toEqual(["hari ..., tanggal ..."]);
    expect(jenis("pada hari Senin, tanggal 5 Oktober 2026 dibacakan")).toEqual([]);
    // relaas: isian tangan jurusita tetap dikecualikan
    expect(jenis("pada hari ini ... tanggal ...", { jenis: "relaas" })).toEqual([]);
  });
  it("XXX / xx sebagai isian", () => {
    expect(cocok("nama XXX dan umur XX tahun", "tanda")).toEqual(["XXX", "XX"]);
    expect(cocok("nomor XX/2026", "tanda")).toEqual(["XX"]);
    expect(jenis("sesuai Pasal XX dan abad XX serta Bab XXX")).toEqual([]);
    expect(jenis("fixxer boxxes MAXXIS 2XX")).toEqual([]);
    // huruf kecil = topeng anonimisasi putusan, BUKAN isian kosong
    expect(jenis("Penggugat ( xxx ) bin xxx, NIK xxxxxxxxxxxxxxxx, umur xx tahun")).toEqual([]);
  });
  it("kata berulang: para Para, pada pada, yang yang (tak peka huruf besar)", () => {
    expect(cocok("kepada para Para pihak", "ulang")).toEqual(["para Para"]);
    expect(cocok("hadir pada pada hari ini", "ulang")).toEqual(["pada pada"]);
    expect(cocok("hal yang yang benar", "ulang")).toEqual(["yang yang"]);
    expect(jenis("Penggugat bernama Siti Siti binti Ali")).toEqual([]); // nama kembar
    expect(jenis("anak-anak sama-sama hadir, 2026 2026")).toEqual([]);
  });
  it("kata berulang tidak ditandai di sekitar teks Arab", () => {
    expect(jenis("firman Allah بسم بسم الله yang")).toEqual([]);
  });
});

describe("2. pola RAGU (hanya .txt, ditandai Periksa)", () => {
  it.each([
    ["Penggugat/Tergugat", "Nama Penggugat/Tergugat telah hadir"],
    ["Pemohon / Termohon", "Nama Pemohon / Termohon telah hadir"],
    ["laki-laki/perempuan", "jenis kelamin laki-laki/perempuan"],
    ["bin/binti", "Fulan bin/binti Fulan"],
    ["suami/istri", "hak suami/istri dalam rumah tangga"],
  ])("kena: %s", (_n, teks) => {
    expect(jenis(teks)).toEqual(["ragu"]);
  });
  it("tidak salah tangkap: dan/atau, Rekonvensi, kutipan pasal, kutip, Arab", () => {
    expect(jenis("secara bersama dan/atau sendiri-sendiri")).toEqual([]);
    expect(jenis("Penggugat/Tergugat Rekonvensi mengajukan jawaban")).toEqual([]);
    expect(jenis("Pasal 31 menyatakan hak suami/istri adalah seimbang")).toEqual([]);
    expect(jenis('bunyinya "suami/istri wajib saling mencintai"')).toEqual([]);
  });
  it("RAGU tidak diwarnai merah dan tidak menelan temuan PASTI", () => {
    const r = rtf("Nomor 1", "b", "c", "d", "e", "Penggugat/Tergugat hadir");
    const m = JS.merahkanRtf(r, { jenis: "putusan" });
    expect(m.jumlah).toBe(0);
    expect(m.rtf).toBe(r);
    expect(jenis("Penggugat/Tergugat [nama]")).toEqual(expect.arrayContaining(["ragu", "kurung"]));
  });
  it("kata kerja petunjuk polos, contoh:, label di ujung paragraf (ragu); label sel sendirian tidak ditandai", () => {
    expect(jenis("tulis nama lengkap di sini")).toEqual(["ragu"]);
    expect(jenis("contoh: tanggal lahir")).toEqual(["ragu"]);
    expect(jenis("Penggugat, Nama :")).toEqual(["ragu"]);
    expect(jenis("Nama :")).toEqual([]); // sel tabel
    expect(jenis("tertulis dengan jelas dan dipilih hakim")).toEqual([]);
  });
});

describe("3. bahasa blangko dan isian kosong (tambahan A)", () => {
  it("kalimat petunjuk: isi dengan, sesuaikan dengan, hapus bagian ini, *) coret yang tidak perlu", () => {
    expect(cocok("isi dengan nama pihak", "kalimat")).toEqual(["isi dengan"]);
    expect(cocok("sesuaikan dengan perkara", "kalimat")).toEqual(["sesuaikan dengan"]);
    expect(cocok("hapus bagian ini bila tidak perlu", "kalimat")).toEqual(["hapus bagian ini"]);
    expect(cocok("*) coret yang tidak perlu", "kalimat")).toEqual(["*) coret yang tidak perlu"]);
    expect(jenis("Majelis mengisi kekosongan hukum dan menyesuaikan putusan")).toEqual([]);
  });
  it("placeholder berkurung (nama), (alamat), (pilih salah satu); {tanda}; #kode# huruf", () => {
    expect(cocok("Pemohon (nama) beralamat (alamat)", "tanda")).toEqual(["(nama)", "(alamat)"]);
    expect(cocok("(pilih salah satu) sesuai", "kalimat")).toEqual(["(pilih salah satu)"]);
    expect(cocok("bernama {nama_pihak} hadir", "tanda")).toEqual(["{nama_pihak}"]);
    expect(cocok("bernama #nama_pihak# hadir", "tanda")).toEqual(["#nama_pihak#"]);
    expect(jenis("(Penggugat) dan (Tergugat) hadir, Pasal 5 (1)")).toEqual([]);
  });
  it("verifikasi sebagai penanda isian", () => {
    expect(cocok("alamat butuh verifikasi", "perbaikan")).toEqual(["butuh verifikasi"]);
    expect(cocok("umur perlu verifikasi", "perbaikan")).toEqual(["perlu verifikasi"]);
    expect(cocok("[verifikasi] alamat", "kurung")).toEqual(["[verifikasi]"]);
    expect(cocok("nama (verifikasi dulu)", "perbaikan")).toEqual(["(verifikasi dulu)"]);
    expect(jenis("Majelis telah melakukan verifikasi terhadap identitas para pihak")).toEqual([]);
  });
  it("label tanpa isi: Nama : ......, Nama : Umur :", () => {
    expect(cocok("Nama : ......", "kosong")).toEqual(["Nama : ......"]);
    expect(cocok("NIK : ____ dan Alamat : ----", "kosong")).toEqual(["NIK : ____", "Alamat : ----"]);
    expect(cocok("Nama : Umur : 30 tahun", "kosong")).toEqual(["Nama :"]);
    expect(jenis("Nama : Ahmad, Umur : 30 tahun, Alamat : Donggala")).toEqual([]);
  });
  it("tanggal/nomor/nominal kosong", () => {
    expect(cocok("pada tanggal bulan tahun dibacakan", "kosong")).toEqual(["tanggal bulan tahun"]);
    expect(cocok("sebesar Rp,00 dibayar", "kosong")).toEqual(["Rp,00"]);
    expect(cocok("sebesar Rp ,- dibayar", "kosong")).toEqual(["Rp ,-"]);
    expect(cocok("Nomor /Pdt.G/ tahun", "kosong")).toEqual(["Nomor /Pdt.G/"]);
    expect(cocok("Nomor 12/Pdt.G//PA.Dgl", "kosong")).toEqual(["/Pdt.G//"]);
    expect(jenis("pada tanggal 5 bulan Oktober tahun 2026 sebesar Rp 60.000,- Nomor 12/Pdt.G/2026/PA.Dgl")).toEqual([]);
  });
  it("bekas isian kosong di tengah kalimat: tanggal ,  bin  ,  , ,  ( )", () => {
    expect(cocok("pada tanggal , di kantor", "kosong")).toEqual(["tanggal ,"]);
    expect(cocok("Penggugat  bin  Ali", "kosong")).toEqual(["bin"]);
    expect(cocok("Ahmad, , dan Budi", "kosong")).toEqual([", ,"]);
    expect(cocok("nomor ( ) hadir", "kosong")).toEqual(["( )"]);
    expect(jenis("pada tanggal 5, Ahmad bin Ali, (Penggugat) hadir")).toEqual([]);
  });
  it("RAGU: spasi ganda antar kata, spasi sebelum koma, titik ganda", () => {
    expect(jenis("satu  dua kecil")).toContain("ragu");
    expect(jenis("Ahmad , Budi hadir")).toContain("ragu");
    expect(jenis("dsb.. selesai")).toContain("ragu");
    expect(jenis("kata satu spasi, titik. 20 Oktober 2026.")).toEqual([]);
  });
  it("pemeriksaan umum (e-Doc lain) tidak memakai aturan lemah baru", () => {
    expect(jenis("nama XXX dan para Para (nama) {x} bin/binti", { jenis: "umum" })).toEqual(["tanda"]); // hanya (nama)
    // titik di sekitar koma tidak jadi RAGU ganda ("Donggala, ......")
    expect(jenis("Donggala, ......................", { jenis: "relaas" })).toEqual([]);
  });
});

describe("4. blok Jurusita / Jurusita Pengganti", () => {
  const relaas = rtf(
    "RELAAS PANGGILAN",
    "Nomor 12/Pdt.G/2026/PA.Dgl",
    "Kepada Tergugat di Donggala",
    "Bahwa surat ini disampaikan",
    "Demikian dibuat",
    "Jurusita Pengganti,",
    "",
    "..............................",
    "Nama : ......",
    "Diterima oleh : ............ tanggal ..........",
    "Tanda tangan penerima ................"
  );
  it("titik isian jurusita -> 0 temuan (relaas dan jenis naskah lain)", () => {
    for (const j of ["relaas", "putusan", "bas"]) {
      const h = JS.periksaRtf(relaas, { jenis: j } as never);
      expect(h.temuan, j).toEqual([]);
      expect(TS.periksaRtf(relaas, { jenis: j as never })).toEqual(h);
    }
  });
  it("titik di luar blok Jurusita tetap temuan; kurung di dalam blok Jurusita tetap temuan", () => {
    expect(jenis("Jurusita ......")).toEqual([]);
    const jauh = rtf("Jurusita,", "a", "b", "c", "d", "e", "f", "g", "umur .... tahun");
    expect(JS.periksaRtf(jauh).temuan.map((t) => t.jenis)).toEqual(["titik"]);
    expect(JS.periksaRtf(rtf("Jurusita Pengganti [nama]")).temuan.map((t) => t.jenis)).toEqual(["kurung"]);
  });
  it("RTF di bagian Jurusita tidak berubah (tanpa warna, tanpa rapikan)", () => {
    const b = rtf("a", "b", "c", "d", "e", "Jurusita Pengganti,", "", "", "", "..............................");
    const m = JS.merahkanRtf(b, { jenis: "relaas" });
    expect(m.jumlah).toBe(0);
    expect(m.rtf).toBe(b);
    const r = JS.rapikanBarisKosong(b);
    expect(r.rtf).toBe(b);
    expect(r.dihapus).toBe(0);
    expect(JS.merahkanRtf(relaas, { jenis: "relaas" }).rtf).toBe(relaas);
    expect(JS.rapikanBarisKosong(relaas).rtf).toBe(relaas);
  });
});

describe("5. RTF dimerahkan (merahkanRtf)", () => {
  it("potongan PASTI dibungkus \\cfN ... \\cf0, warna merah ditambah di \\colortbl, kurung seimbang", () => {
    const r = rtf("a", "b", "c", "d", "e", "Pemohon [nama] umur .... tahun, kepada para Para pihak");
    const m = JS.merahkanRtf(r, { jenis: "putusan" });
    expect(m.indeks).toBe(3);
    expect(m.rtf).toContain(String.raw`{\colortbl;\red0\green0\blue0;\red0\green0\blue255;\red255\green0\blue0;}`);
    expect(m.rtf).toContain(String.raw`\cf3 [nama]\cf0 `);
    expect(m.rtf).toContain(String.raw`\cf3 ....\cf0 `);
    expect(m.rtf).toContain(String.raw`\cf3 para Para\cf0 `);
    expect(seimbang(m.rtf)).toBe(true);
    expect(teksMerah(m.rtf)).toEqual(["[nama]", "....", "para Para"]);
    expect(m.potongan).toBe(3);
  });
  it("memakai warna merah yang sudah ada; tanpa \\colortbl dibuatkan", () => {
    const ada = KEPALA.replace(WARNA, String.raw`{\colortbl;\red255\green0\blue0;}`) + "a\\par b\\par c\\par d\\par e\\par ada [x] di sini\\par }";
    const m = JS.merahkanRtf(ada);
    expect(m.indeks).toBe(1);
    expect(m.rtf).toContain(String.raw`\cf1 [x]\cf0 `);
    expect(m.rtf.match(/\\colortbl/g)?.length).toBe(1);
    const tanpa = String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}\f0 ada [x] di sini\par }`;
    const t = JS.merahkanRtf(tanpa);
    expect(t.rtf).toContain(String.raw`{\colortbl;\red255\green0\blue0;}`);
    expect(t.rtf).toContain(String.raw`\cf1 [x]\cf0 `);
    expect(seimbang(t.rtf)).toBe(true);
    expect(teksMerah(t.rtf)).toEqual(["[x]"]);
  });
  it("warna semula dipulihkan, escape \\' \\{ \\} dan pemformatan di tengah potongan tidak merusak RTF", () => {
    const r = rtf(String.raw`{\cf2 biru }Teks {\b nomor ..../Pdt.\'47/....} dan \{pilih\} {\cf2 [nama }tersisa]`);
    const m = JS.merahkanRtf(r, { jenis: "putusan" });
    expect(seimbang(m.rtf)).toBe(true);
    expect(m.rtf).toContain(String.raw`\cf2 `); // biru tetap
    const merah = teksMerah(m.rtf);
    expect(merah.join("|")).toContain("....");
    expect(merah.join("|")).toContain("[nama");
    // tulisan sesudah potongan tidak ikut merah
    expect(merah.join("|")).not.toContain("Teks");
    // baca ulang: isi teks sama dengan sebelum diwarnai
    expect(JS.bacaRtfParagraf(m.rtf).map((p) => p.teks)).toEqual(JS.bacaRtfParagraf(r).map((p) => p.teks));
  });
  it("tulisan yang sudah merah tidak digandakan; pengecualian kutipan tetap berlaku", () => {
    const r = rtf(String.raw`Allah berfirman "Talak itu dua ... atau menceraikan" lalu {\cf2 sudah merah}`);
    const m = JS.merahkanRtf(r, { jenis: "putusan" });
    expect(m.jumlah).toBe(0);
    expect(m.rtf).toBe(r);
  });
  it("hasil dimerahkan terbaca merah oleh pemeriksa unggah (deteksi tulisan merah tetap jalan)", () => {
    const m = JS.merahkanRtf(rtf("a", "b", "c", "d", "e", "kepada para Para pihak"), { jenis: "putusan" });
    expect(JS.periksaRtf(m.rtf).temuan.map((t) => t.jenis)).toContain("merah");
  });
  it("semua jenis PASTI dimerahkan sekaligus (titik, garis, tanda, kosong, kalimat, ulang, perbaikan)", () => {
    const isi = ["tahun 20..", "tanggal ____", "bernama #1234#", "pada tanggal bulan tahun", "isi dengan nama", "yang yang", "butuh verifikasi"];
    const m = JS.merahkanRtf(rtf("a", "b", "c", "d", "e", ...isi), { jenis: "putusan" });
    expect(m.potongan).toBe(isi.length);
    expect(teksMerah(m.rtf)).toEqual(["20..", "____", "#1234#", "tanggal bulan tahun", "isi dengan", "yang yang", "butuh verifikasi"]);
    expect(seimbang(m.rtf)).toBe(true);
  });
});

describe("6. paragraf kosong dihapus (rapikanBarisKosong)", () => {
  const isi = ["Satu", "Dua", "Tiga", "Empat", "Lima"];
  const par = (r: string) => JS.bacaRtfParagraf(r).map((p) => p.teks);
  const jumlahPar = (r: string) => (r.match(/\\par(?![a-z])/g) || []).length;

  it("3 paragraf kosong beruntun -> 0; satu paragraf kosong pun dihapus", () => {
    const r = rtf(...isi, "", "", "", "Enam", "", "Tujuh");
    const h = JS.rapikanBarisKosong(r);
    expect(h.dihapus).toBe(4);
    expect(h.tempat).toBe(2);
    expect(jumlahPar(h.rtf)).toBe(jumlahPar(r) - 4);
    expect(seimbang(h.rtf)).toBe(true);
    expect(par(h.rtf)).toEqual([...isi, "Enam", "Tujuh"]);
    // tiap paragraf tersisa masih berpenutup \par: tidak ada dua \par berurutan tanpa isi
    expect(/\\par\s*\\par(?![a-z])/.test(h.rtf)).toBe(false);
  });
  it("isian kosong yang menghasilkan baris kosong ikut hilang", () => {
    const r = rtf(...isi, "Nama : Ahmad", "   ", String.raw`{\b }`, "Alamat : Donggala");
    const h = JS.rapikanBarisKosong(r);
    expect(h.dihapus).toBe(2);
    expect(par(h.rtf)).toEqual([...isi, "Nama : Ahmad", "Alamat : Donggala"]);
    expect(seimbang(h.rtf)).toBe(true);
  });
  it("format di antaranya tidak disentuh (\\pard\\plain tetap, hanya kata \\par yang dibuang)", () => {
    const r = KEPALA + String.raw`A\par B\par C\par D\par E\par F\par \pard\qc\plain\fs24\par \pard\ql\par G\par }`;
    const h = JS.rapikanBarisKosong(r);
    expect(h.rtf).toContain(String.raw`\pard\qc\plain\fs24`);
    expect(h.rtf).toContain(String.raw`\pard\ql`);
    expect(par(h.rtf)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(seimbang(h.rtf)).toBe(true);
  });
  it("blok TTD tidak berubah (Ketua Majelis, Hakim Anggota, Panitera Pengganti, ttd)", () => {
    const b = rtf(...isi, "Demikian diputuskan", "Ketua Majelis,", "", "", "", "Drs. Fulan", "", "", "Hakim Anggota,", "", "", "Dra. Fulanah", "", "Panitera Pengganti,", "", "", "ttd", "", "Fulan, S.H.");
    const h = JS.rapikanBarisKosong(b);
    expect(h.rtf).toBe(b);
    expect(h.dihapus).toBe(0);
  });
  it("kop surat (sebelum paragraf isi ke-5) tidak disentuh", () => {
    const b = rtf("PENGADILAN AGAMA", "", "", "Alamat", "", "PUTUSAN");
    expect(JS.rapikanBarisKosong(b).rtf).toBe(b);
  });
  it("sekitar ganti halaman dan tabel dan gambar tidak disentuh", () => {
    const halaman = KEPALA + "A\\par B\\par C\\par D\\par E\\par F\\par \\par \\page G\\par }";
    expect(JS.rapikanBarisKosong(halaman).rtf).toBe(halaman);
    const halamanBB = KEPALA + "A\\par B\\par C\\par D\\par E\\par F\\par \\par \\pard\\pagebb G\\par }";
    expect(JS.rapikanBarisKosong(halamanBB).rtf).toBe(halamanBB);
    const tabel = KEPALA + "A\\par B\\par C\\par D\\par E\\par \\trowd\\intbl \\cell \\intbl \\cell \\row \\pard F\\par }";
    expect(JS.rapikanBarisKosong(tabel).rtf).toBe(tabel);
    const gambar = KEPALA + "A\\par B\\par C\\par D\\par E\\par {\\pict\\pngblip 89504e47}\\par F\\par }";
    expect(JS.rapikanBarisKosong(gambar).rtf).toBe(gambar);
  });
  it("judul bab tanpa \\sb/\\sa diberi \\sb240 bila paragraf kosong di sekitarnya dihapus; yang sudah punya jarak tidak ditambah", () => {
    const tanpaJarak = rtf(...isi, "", String.raw`\pard\qc\b DUDUK PERKARA\b0`, "", "Isi paragraf satu");
    const h = JS.rapikanBarisKosong(tanpaJarak);
    expect(h.dihapus).toBe(2);
    expect(h.judul).toBe(1);
    expect(h.rtf).toContain(String.raw`\sb240 DUDUK PERKARA`);
    expect(seimbang(h.rtf)).toBe(true);
    expect(par(h.rtf)).toEqual([...isi, "DUDUK PERKARA", "Isi paragraf satu"]);
    const berjarak = rtf(...isi, "", String.raw`\pard\sb200\qc\b MENGADILI\b0`, "", "Isi");
    const g = JS.rapikanBarisKosong(berjarak);
    expect(g.judul).toBe(0);
    expect(g.rtf).not.toContain("sb240");
    const bukanJudul = rtf(...isi, "", "Paragraf biasa", "", "Isi");
    expect(JS.rapikanBarisKosong(bukanJudul).judul).toBe(0);
  });
  describe("format paragraf yang benar tidak berubah (inden/tab/perataan/spasi tiap paragraf identik)", () => {
    const PROP = /^(fi|li|ri|qj|ql|qr|qc|sl|slmult|sb|sa|tx|tqr|tqc)$/;
    /** Pengaturan paragraf EFEKTIF (sejak \pard terakhir, termasuk yang diwarisi) pada huruf/tab pertama tiap paragraf berisi. */
    function sifat(r: string): string[] {
      const hasil: string[] = [];
      let state: Record<string, string> = {};
      let ambil: string | null = null;
      for (const m of r.slice(KEPALA.length).matchAll(/\\([a-z]+)(-?\d+)? ?|[{}]|([^\\{}]+)/g)) {
        if (m[3] !== undefined) {
          if (ambil === null && /\S/.test(m[3])) ambil = JSON.stringify(state);
          continue;
        }
        const k = m[1];
        if (!k) continue;
        if (k === "par") {
          if (ambil !== null) hasil.push(ambil);
          ambil = null;
        } else if (k === "tab") {
          if (ambil === null) ambil = `${JSON.stringify(state)}+tab`;
        } else if (k === "pard") state = {};
        else if (PROP.test(k)) state[k] = m[2] ?? "";
      }
      return hasil;
    }
    const IS = String.raw`\pard\fi720\qj\sl360\slmult1\sb0\sa0 `;
    const kosongIs = String.raw`\pard\fi720\qj\sl360\slmult1\sb0\sa0`;
    const awal = ["Satu", "Dua", "Tiga", "Empat", "Lima"].map((t) => IS + String.raw`\tab ` + t);

    it("BAS: paragraf kosong di antara paragraf bertab -> menempel, inden/tab identik, bunyi tidak berubah", () => {
      const a = IS + String.raw`\tab Selanjutnya Ketua Majelis menyatakan persidangan tertutup untuk umum;`;
      const b = IS + String.raw`\tab Kemudian Majelis Hakim memberikan nasihat kepada Penggugat dan Tergugat;`;
      const r = rtf(...awal, a, kosongIs, kosongIs, b);
      const h = JS.rapikanBarisKosong(r);
      expect(h.dihapus).toBe(2);
      expect(sifat(h.rtf)).toEqual(sifat(r));
      expect(sifat(h.rtf).every((s) => s.endsWith("+tab"))).toBe(true);
      expect(par(h.rtf)).toEqual(par(r).filter((t) => t.trim() !== ""));
      expect(par(h.rtf).slice(-2)).toEqual(["Selanjutnya Ketua Majelis menyatakan persidangan tertutup untuk umum;", "Kemudian Majelis Hakim memberikan nasihat kepada Penggugat dan Tergugat;"].map((t) => ` ${t}`));
      expect(seimbang(h.rtf)).toBe(true);
    });
    it("Putusan: Menimbang... dengan paragraf kosong berformat sendiri di antaranya -> pengaturan paragraf berikutnya tidak hilang/terbawa salah", () => {
      const a = IS + String.raw`\tab Menimbang, bahwa semua yang tercatat dalam berita acara sidang dianggap termuat;`;
      // paragraf kosong membawa format lain (rata tengah, spasi sebelum) yang TIDAK boleh bocor ke paragraf berikutnya
      const e1 = String.raw`\pard\qc\sb240`;
      const b = String.raw`\tab Menimbang, bahwa Majelis Hakim telah menasihati para pihak;`;
      const r = rtf(...awal, a, e1, IS + b, e1, IS + b);
      const h = JS.rapikanBarisKosong(r);
      expect(h.dihapus).toBe(2);
      expect(sifat(h.rtf)).toEqual(sifat(r));
      // setiap paragraf berisi masih diawali \pard + pengaturannya sendiri
      expect(h.rtf).toContain(IS + b + String.raw`\par `);
      expect(par(h.rtf).length).toBe(8);
      expect(seimbang(h.rtf)).toBe(true);
    });
    it("paragraf campuran (bertab, tanpa tab, \\fi, inden gantung, judul tengah, rata kiri): yang berisi BYTE-IDENTIK, hanya yang kosong hilang", () => {
      const berisi = [
        IS + String.raw`\tab Menimbang, bahwa semua yang tercatat dalam berita acara sidang;`, // bertab
        String.raw`\pard\fi720\qj Paragraf berinden \fi tanpa tab, jarak diatur format.`, // \fi tanpa tab
        String.raw`\pard\fi-360\li720\qj - Bahwa butir dengan inden gantung;`,
        String.raw`\pard\qc\b\fs26 DUDUK PERKARA\b0\fs24`, // judul tengah tanpa \sb/\sa
        String.raw`\pard\ql Identitas pihak rata kiri tanpa tab dan tanpa inden.`,
        String.raw`\pard\qj\tab\tab Dua tab di awal.`,
        String.raw`\pard\qr Donggala, 5 Oktober 2026`,
        String.raw`\pard\ql\sl276\slmult1\sb120\sa120 Paragraf dengan jarak sendiri.`,
      ];
      const kosong = [String.raw`\pard\fi720\qj`, "", String.raw`\pard\qc\sb240`, String.raw`\pard\ql\tx720`];
      const sisip: string[] = [];
      berisi.forEach((b, i) => {
        sisip.push(b);
        sisip.push(kosong[i % kosong.length]);
        if (i % 2 === 0) sisip.push(kosong[(i + 1) % kosong.length]);
      });
      const r = rtf(...awal, ...sisip);
      const h = JS.rapikanBarisKosong(r);
      // hasil = asli tanpa kata \par milik paragraf kosong, tidak ada perubahan lain selain \sb240 pada judul
      const tanpaJudul = h.rtf.replace(String.raw`\sb240 DUDUK PERKARA`, "DUDUK PERKARA");
      const harapan = KEPALA + [...awal, ...sisip].map((p) => (JS.bacaRtfParagraf(KEPALA + p + "\\par }").length === 0 ? p : `${p}\\par `)).join("") + "}";
      expect(tanpaJudul).toBe(harapan);
      // tiap paragraf berisi muncul utuh (teks + pengaturan paragrafnya) dan berurutan seperti sebelumnya
      for (const b of berisi) expect(tanpaJudul).toContain(`${b}\\par `);
      expect(sifat(tanpaJudul)).toEqual(sifat(r)); // judul tanpa \sb/\sa mendapat \sb240 (satu-satunya perubahan pengaturan paragraf)
      expect(par(h.rtf)).toEqual(par(r));
      // tidak ada tab yang ditambah/dibuang dan tidak ada \fi yang berubah
      expect((h.rtf.match(/\\tab/g) || []).length).toBe((r.match(/\\tab/g) || []).length);
      expect(h.rtf.match(/\\fi-?\d+/g)).toEqual(r.match(/\\fi-?\d+/g));
      expect(h.judul).toBe(1);
      expect(seimbang(h.rtf)).toBe(true);
    });
    it("butir bernomor / inden gantung / '- Bahwa' tidak berubah", () => {
      const hang = String.raw`\pard\fi-360\li720\qj\sl276\slmult1\sb120\sa120 `;
      const r = rtf(...awal, hang + "1.\\tab Bahwa pertama;", String.raw`\pard\fi-360\li720`, hang + "2.\\tab Bahwa kedua;", "", hang + "- Bahwa ketiga;");
      const h = JS.rapikanBarisKosong(r);
      expect(h.dihapus).toBe(2);
      expect(sifat(h.rtf)).toEqual(sifat(r));
      expect(h.rtf).toContain(hang + "- Bahwa ketiga;");
    });
  });

  it("RTF bersih tidak berubah", () => {
    const b = rtf(...isi, "Enam", "Tujuh");
    const h = JS.rapikanBarisKosong(b);
    expect(h.rtf).toBe(b);
    expect(h).toMatchObject({ tempat: 0, dihapus: 0, judul: 0 });
  });
});

describe("7. daftar .txt, salinan TS = JS, dan pemasangan di panel", () => {
  const korpus = [
    "Tahun 20.. Nomor ..../Pdt.G/.... Rp. .... hari ..., tanggal ...",
    "xx dan XXX tapi Pasal XX; para Para pada pada; Siti Siti",
    "Penggugat/Tergugat; dan/atau; Pemohon/Termohon Rekonvensi; laki-laki/perempuan; Fulan bin/binti Fulan; suami/istri",
    "butuh verifikasi {nama} (nama) #nama_x# *) coret yang tidak perlu",
    "isi dengan nama; Nama : ...... ; Nama : Umur : ; tanggal bulan tahun; Rp,00; Nomor /Pdt.G/; pada tanggal , lahir; Penggugat  bin  X; a, , b; ( ); contoh: x; kata  kata; abc , def",
    "Jurusita Pengganti ..... Nama : ...... dan [x]",
    "Allah berfirman \"Talak itu dua ... atau\" suami/istri Pasal 31",
  ];
  it("periksaTeks TS sama dengan JS atas seluruh korpus pola baru", () => {
    for (const t of korpus) {
      expect(TS.periksaTeks(t), t).toEqual(JS.periksaTeks(t));
      expect(TS.periksaTeks(t, { jenis: "relaas" }), t).toEqual(JS.periksaTeks(t, { jenis: "relaas" }));
      expect(TS.periksaTeks(t, { jenis: "umum" }), t).toEqual(JS.periksaTeks(t, { jenis: "umum" }));
    }
  });
  it(".txt memuat catatan info rapikan dan penjelasan Periksa; TS sama dengan JS; tanpa kata Aleta", () => {
    const h = JS.periksaTeks("Fulan bin/binti Fulan dan umur .... tahun");
    const o = { nama: "putusan.rtf", jenis: "putusan", catatan: ["4 paragraf kosong di 2 tempat dirapikan otomatis"] };
    const txt = JS.susunDaftarTxt(h.temuan, o);
    expect(TS.susunDaftarTxt(h.temuan, o)).toBe(txt);
    expect(txt).toContain("Info   : 4 paragraf kosong di 2 tempat dirapikan otomatis");
    expect(txt).toContain("Periksa: pilihan atau isian yang mungkin belum beres");
    expect(txt).toContain('Butir bertanda "Periksa" belum tentu salah');
    expect(txt).toContain("Titik-titik isian yang belum diisi");
    expect(/aleta/i.test(txt)).toBe(false);
    // tanpa RAGU dan tanpa catatan: bentuk lama persis
    const lama = JS.susunDaftarTxt(JS.periksaTeks("umur .... tahun").temuan, { nama: "a.rtf" });
    expect(lama).not.toContain("Info");
    expect(lama).not.toContain("Periksa");
  });
  it("tingkat: hanya jenis ragu yang tidak dimerahkan", () => {
    expect([...JS.JENIS_RAGU]).toEqual(["ragu"]);
    expect([...TS.JENIS_RAGU]).toEqual(["ragu"]);
  });
  it("panel Blangko Derry memanggil rapikan lalu periksa lalu merahkan; e-Doc dan anonim memakai naskah tanpa warna", () => {
    const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8");
    const awal = sumber.indexOf("async function lakukanCetak(");
    const akhir = sumber.indexOf("async function unggahEdoc(");
    const badan = sumber.slice(awal, akhir);
    expect(badan.indexOf("rapikanBarisKosong")).toBeGreaterThan(-1);
    expect(badan.indexOf("rapikanBarisKosong")).toBeLessThan(badan.indexOf("aletaDeteksiSisa.tinjau("));
    expect(badan.indexOf("aletaDeteksiSisa.tinjau(")).toBeLessThan(badan.indexOf("merahkanRtf"));
    expect(badan).toContain("catatan: catatanRapi");
    expect(badan).toContain('new Blob([rtfCetak], { type: "application/rtf" })');
    expect(badan).toContain("pdfBiasaDenganTtd(rtfCetak)");
    expect(badan).toContain("pdfDari(rtfLatin1, true)");
    expect(badan).toContain("alatAnonimMandiri(rtfBuf");
    expect(badan).toContain("unggahEdoc(rtfBuf");
  });
});
