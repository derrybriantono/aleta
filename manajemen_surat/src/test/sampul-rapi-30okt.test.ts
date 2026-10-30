// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BARIS_CEKLIST, BARIS_DAFTAR_ISI, LEBAR_ISI, PENANDA_LAMPIRAN_ABT, VAR_LAMPIRAN_ABT, VAR_TABEL_CEKLIST, VAR_TABEL_DAFTAR_ISI, buangParagrafPenanda } from "@/lib/berkas-cetak";
import { tabelCeklistRtf } from "@/lib/ceklist-berkas";
import { tabelDaftarIsiRtf } from "@/lib/daftar-isi-rtf";
import { monokromTajam } from "@/lib/logo-monokrom";
import { LOGO_KOP_TINGGI_TWIP, PENANDA_LOGO, grupGambarPngRtf, sisipLogoRtf } from "@/lib/logo-rtf";
import { logoMonokrom } from "@/server/modules/berkas-perkara/logo-kop";
import { FITUR_BERKAS_PERKARA, pilihanDariJejak } from "@/lib/fitur-satker";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { susunNaskahBerkas, type DepNaskah } from "@/server/modules/berkas-perkara/naskah";
import { bacaPengaturanFitur, fiturMenyala, simpanPengaturanFitur } from "@/server/modules/satker/fitur";
import { appendAuditLog } from "@/server/shared/audit";

/**
 * ============================================================================
 * 30 OKT 2026 - SAMPUL, LAMPIRAN, DAFTAR ISI, CEKLIST RAPI SAAT DICETAK (permintaan Derry)
 * ============================================================================
 * Yang dijaga (perilaku):
 *   1. logo kop MONOKROM TAJAM: satu bit (hitam/putih murni), cara cap (unsur emas/merah/gelap -> hitam, bidang hijau -> putih), transparan -> putih;
 *      logo bergaya lain -> ambang Otsu; PNG palet dua warna, lebar 640 px (lebih dari 600 dpi pada 1,9 cm)
 *   2. logo tertanam di blangko (cetak langsung ABT berlogo) DIGANTI logo Identitas satker bila ada, DIBIARKAN bila tidak
 *   3. blangko paket: tata halaman penuh (dokumen + seksi, margin aman), logo di sel kiri kop, penanda tabel ABT tanpa grup, satu huruf (Arial)
 *   4. tabel dari fungsi ABT (kata kendali RTF dari kueri data_sql) LOLOS mesin variabel portal apa adanya - cetak lewat panel = cetak dari ABT
 *   5. naskah portal: tabel daftar isi/ceklist menggantikan penanda dan MENGISI halaman (baris kosong), lampiran ABT dibuang lalu lampiran portal
 *      ditempel bila perlu, logo diganti; tidak ada penanda tersisa
 *   6. kembaran SQL <-> portal: lebar kolom, jumlah baris, nomor variabel sama; SQL fungsi MariaDB 5.5 dan aturan pembersih ABT
 */

const AKAR = path.resolve(__dirname, "../../..");
const PAKET = path.join(AKAR, "abt-paket/sampul-rapi-30okt");
const req = createRequire(import.meta.url);
const mesinAbt = req(path.join(AKAR, "aleta_bot/services/abtMesinVariabel.js"));

function gambarRgba(lebar: number, tinggi: number, warna: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8Array(lebar * tinggi * 4);
  for (let y = 0; y < tinggi; y += 1)
    for (let x = 0; x < lebar; x += 1) {
      const w = warna(x, y);
      data.set(w, (y * lebar + x) * 4);
    }
  return { data, lebar, tinggi };
}
/** logo rekaan bergaya logo pengadilan: bidang hijau polos, cincin emas, perisai merah-putih, latar transparan */
const logoPengadilan = (x: number, y: number): [number, number, number, number] => {
  const dx = (x - 50) / 45;
  const dy = (y - 60) / 55;
  const r = dx * dx + dy * dy;
  if (r > 1) return [0, 0, 0, 0];
  if (r > 0.8) return [225, 185, 13, 255]; // cincin emas
  if (Math.abs(x - 50) < 8 && Math.abs(y - 60) < 8) return x < 50 ? [230, 33, 41, 255] : [254, 254, 254, 255]; // perisai
  if (Math.abs(x - 30) < 3 && Math.abs(y - 60) < 3) return [37, 170, 67, 255]; // pohon (hijau lain)
  return [2, 150, 1, 255]; // bidang hijau
};

describe("1. logo monokrom tajam", () => {
  it("cara cap: emas, merah, pohon -> hitam; bidang hijau, putih, transparan -> putih; hanya 0/255", () => {
    const g = gambarRgba(100, 120, logoPengadilan);
    const h = monokromTajam(g);
    expect(h.cara).toBe("garis");
    expect(new Set(h.data)).toEqual(new Set([0, 255]));
    const px = (x: number, y: number) => h.data[y * 100 + x];
    expect(px(50, 6)).toBe(0); // cincin emas
    expect(px(45, 60)).toBe(0); // perisai merah
    expect(px(55, 60)).toBe(255); // perisai putih
    expect(px(30, 60)).toBe(0); // pohon
    expect(px(70, 60)).toBe(255); // bidang hijau
    expect(px(1, 1)).toBe(255); // transparan
  });
  it("logo bergaya lain (tanpa bidang hijau): ambang Otsu, gelap -> hitam", () => {
    const g = gambarRgba(40, 40, (x) => (x < 20 ? [30, 30, 120, 255] : [240, 240, 200, 255]));
    const h = monokromTajam(g);
    expect(h.cara).toBe("otsu");
    expect(h.data[5]).toBe(0);
    expect(h.data[35]).toBe(255);
  });
  it("logoMonokrom: PNG palet satu bit selebar 640 px dari sumber berwarna; bukan gambar = null", async () => {
    const sharp = (await import("sharp")).default;
    const g = gambarRgba(300, 360, (x, y) => logoPengadilan(Math.floor(x / 3), Math.floor(y / 3)));
    const png = await sharp(Buffer.from(g.data), { raw: { width: 300, height: 360, channels: 4 } }).png().toBuffer();
    const h = await logoMonokrom(png);
    expect(h).not.toBeNull();
    expect(h!.lebar).toBe(640);
    expect(h!.cara).toBe("garis");
    const { data, info } = await sharp(h!.png).raw().toBuffer({ resolveWithObject: true });
    const nilai = new Set<number>();
    for (let i = 0; i < data.length; i += info.channels) nilai.add(data[i]);
    expect([...nilai].sort((a, b) => a - b)).toEqual([0, 255]);
    expect(await logoMonokrom(Buffer.from("bukan gambar"))).toBeNull();
  });
});

describe("2. logo tertanam di blangko", () => {
  const tertanam = `{\\fs2\\cf5 ${PENANDA_LOGO}}{\\pict\\pngblip\\picw10\\pich12\\picwgoal900\\pichgoal1080\n89504e47}`;
  it("diganti logo Identitas satker bila ada; dibiarkan bila tidak; blangko lama (penanda saja) tetap dilayani", () => {
    expect(sisipLogoRtf(`A${tertanam}\\cell`, "{BARU}")).toBe("A{BARU}\\cell");
    expect(sisipLogoRtf(`A${tertanam}\\cell`, "")).toBe("A{\\pict\\pngblip\\picw10\\pich12\\picwgoal900\\pichgoal1080\n89504e47}\\cell");
    expect(sisipLogoRtf(`{\\fs2\\cf5 ${PENANDA_LOGO}}\\cell`, "{BARU}")).toBe("{BARU}\\cell");
    expect(sisipLogoRtf(`{\\fs2\\cf5 ${PENANDA_LOGO}}\\cell`, "")).toBe("\\cell");
  });
  it("ukuran tampil logo portal = logo tertanam (tinggi 1,9 cm)", () => {
    const g = grupGambarPngRtf(new Uint8Array(20).fill(1), 640, 833, LOGO_KOP_TINGGI_TWIP);
    expect(g).toContain(`\\pichgoal${LOGO_KOP_TINGGI_TWIP}`);
    expect(g).toContain(`\\picwgoal${Math.round((LOGO_KOP_TINGGI_TWIP * 640) / 833)}`);
  });
});

const RTF_DIR = path.join(PAKET, "rtf/derry_briantono");
const semuaRtf = (): Array<[string, string]> =>
  ["99 PTSP", "98b Berkas Perkara - BAS"].flatMap((f) => readdirSync(path.join(RTF_DIR, f)).map((b) => [`${f}/${b}`, readFileSync(path.join(RTF_DIR, f, b), "latin1")] as [string, string]));

describe("3. blangko paket sampul-rapi-30okt", () => {
  const kertas = { "": [11906, 16838], " (F4)": [12189, 18709], " (Legal)": [12246, 20183] } as const;
  it("21 blangko: tata halaman dokumen DAN seksi sama dengan kertasnya, margin aman 1,27 cm, satu huruf isi Arial, tanpa kata aplikasi", () => {
    const r = semuaRtf();
    expect(r).toHaveLength(21);
    for (const [nama, isi] of r) {
      const akhiran = (nama.match(/( \(F4\)| \(Legal\))\.rtf$/) || ["", ""])[1] as keyof typeof kertas;
      const [w, h] = kertas[akhiran];
      expect(isi, nama).toContain(`\\paperw${w}\\paperh${h}\\margl720\\margr720\\margt680\\margb600`);
      expect(isi, nama).toContain(`\\sectd\\pgwsxn${w}\\pghsxn${h}\\marglsxn720\\margrsxn720\\margtsxn680\\margbsxn600`);
      expect(isi, nama).toContain("{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}{\\f1\\fnil\\fcharset0 Segoe UI Symbol;}}");
      expect(isi.toLowerCase(), nama).not.toContain("aleta");
      expect(isi, nama).toMatch(/\r\n/);
      // isi terbaca: tidak ada huruf di bawah 7 pt kecuali penanda logo dan paragraf pengakhir tabel
      const kecil = [...isi.matchAll(/\\fs(\d+)/g)].map((m) => Number(m[1])).filter((x) => x < 14 && x !== 2 && x !== 4 && x !== 6 && x !== 8 && x !== 10);
      expect(kecil, nama).toEqual([]);
    }
  });
  it("logo monokrom tertanam di sel kiri kop (sesudah penanda), PNG satu bit dari sumber/logo-kop-mono.png", () => {
    const png = readFileSync(path.join(PAKET, "sumber/logo-kop-mono.png"));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png[24]).toBe(1); // kedalaman bit 1
    for (const [nama, isi] of semuaRtf()) {
      const i = isi.indexOf(`{\\fs2\\cf5 ${PENANDA_LOGO}}{\\pict\\pngblip\\picw`);
      expect(i, nama).toBeGreaterThan(0);
      expect(isi.slice(i, i + 4000).replace(/\s/g, ""), nama).toContain(png.subarray(0, 64).toString("hex"));
      expect(i, nama).toBeLessThan(isi.indexOf("#8010#"));
    }
  });
  it("pihak di sampul: pekerjaan/alamat/kuasa dari satu isian (tanpa 'Pekerjaan: - -' dan tanpa baris 'Kuasa:' kosong)", () => {
    for (const [nama, isi] of semuaRtf().filter(([b]) => b.includes("Sampul"))) {
      expect(isi, nama).not.toContain("Kuasa: #");
      expect(isi, nama).not.toContain("Pekerjaan: #");
      expect(isi, nama).toContain("#5830#");
    }
    const v = readFileSync(path.join(PAKET, "sumber/variabel.py"), "utf8");
    expect(v).toContain("REGEXP '^[-. ]*$','',CONCAT('Pekerjaan: '"); // pekerjaan kosong/"-" dilewati
    expect(v).toContain("CONCAT('<br>Kuasa: ',TRIM(k.nama))"); // baris kuasa hanya bila ada
  });
  it("penanda tabel/lampiran ABT berdiri di paragraf sendiri tanpa grup (tabel dari fungsi tidak terkurung)", () => {
    const r = Object.fromEntries(semuaRtf());
    for (const [k, n] of Object.entries(VAR_TABEL_DAFTAR_ISI)) {
      const b = `98b Berkas Perkara - BAS/Daftar Isi Berkas${k === "a4" ? "" : k === "f4" ? " (F4)" : " (Legal)"}.rtf`;
      expect(r[b]).toMatch(new RegExp(`\\\\pard\\\\plain\\\\ql\\\\f0\\\\fs\\d+\\\\sb0\\\\sa0 #${n}#\\\\par`));
    }
    for (const [k, n] of Object.entries(VAR_TABEL_CEKLIST)) expect(r[`99 PTSP/Ceklist Berkas Perkara${k === "a4" ? "" : k === "f4" ? " (F4)" : " (Legal)"}.rtf`]).toContain(` #${n}#\\par`);
    const lampiran = Object.entries(r).filter(([b]) => /Sampul Berkas Perkara(?! \(Lengkap\))/.test(b)).map(([, isi]) => (isi.match(/#(116\d\d)#\\par/) || [])[1]);
    expect(lampiran.sort()).toEqual([...VAR_LAMPIRAN_ABT].sort());
    // kaki susunan panel (#5833#) dan lampiran ABT satu paragraf catatan kaki
    for (const [b, isi] of Object.entries(r).filter(([x]) => /Sampul Berkas Perkara(?! \(Lengkap\))/.test(x))) expect(isi, b).toMatch(/#5833#\}#116\d\d#\\par/);
  });
});

describe("4. tabel RTF dari fungsi ABT lolos mesin variabel portal", () => {
  it("baris tabel (\\trowd ... \\row) dari kueri data_sql dicetak sebagai tabel, bukan teks; kosong lampiran = tanpa tampilan", async () => {
    const tabel = "\\trowd\\trgaph70\\trleft0\\trkeep\\trrh400\\clbrdrt\\brdrs\\brdrw10\\clvertalc\\cellx5000\\clvertalc\\cellx10466\\pard\\plain\\intbl\\qc\\f0\\fs19\\sb20\\sa20 1\\cell\\pard\\plain\\intbl\\ql\\f0\\fs19\\sb20\\sa20 Surat Gugatan\\cell\\row \\pard\\plain\\f0\\fs4 ";
    const katalog = [
      { no_var: "11600", nama: "tabel", data_type: "data_sql", sql_query: "SELECT x AS data" },
      { no_var: "11606", nama: "lampiran", data_type: "data_sql", sql_query: "SELECT y AS data" },
    ];
    const mesin = mesinAbt.buatMesin({ kueri: async (sql: string) => (/abt_variabel/.test(sql) ? katalog : /x AS/.test(sql) ? [{ data: tabel }] : [{ data: "\\b0" }]) });
    const h = await mesin.isiRtf("{\\rtf1 \\pard\\plain\\ql\\f0\\fs18\\sb0\\sa0 #11600#\\par \\pard #11606#\\par}", { perkaraId: "1" });
    expect(h.kosong).toEqual([]);
    expect(h.rtf).toContain("\\trowd\\trgaph70");
    expect(h.rtf).toContain("Surat Gugatan\\cell\\row");
    expect(h.rtf).toContain("\\row ");
    expect(h.rtf).not.toContain("\\\\trowd");
    expect(h.rtf).toContain("\\pard \\b0");
  });
});

/** Tiruan bot: penanda diganti nilai timpa (portal) atau isi ABT tiruan; selebihnya "..." seperti mesin. */
function depTiruan(rtfBlangko: string, abt: Record<string, string>, logo = ""): DepNaskah & { dikirim: Record<string, string>[] } {
  const dikirim: Record<string, string>[] = [];
  return {
    dikirim,
    isi: async (nilai) => {
      dikirim.push(nilai);
      const rtf = rtfBlangko.replace(/#(\d{3,5})#/g, (_m, n: string) => nilai[n] ?? abt[n] ?? "...");
      return { ok: true, data: { ok: true, berkas: "x.rtf", rtfBase64: Buffer.from(rtf, "latin1").toString("base64"), kosong: [] } };
    },
    logoKop: async () => logo,
    namaPengadilan: async () => "Pengadilan Agama Donggala",
    petugas: "Petugas Satu",
    hariIni: () => "2026-10-30",
  };
}
const blangko = (nama: string) => readFileSync(path.join(RTF_DIR, nama), "latin1");

describe("5. naskah portal atas blangko paket", () => {
  it("daftar isi: penanda tabel ABT diganti tabel portal yang mengisi halaman; logo tertanam dibiarkan bila Identitas satker tanpa logo", async () => {
    for (const k of ["a4", "f4", "legal"] as const) {
      const nama = `98b Berkas Perkara - BAS/Daftar Isi Berkas${k === "a4" ? "" : k === "f4" ? " (F4)" : " (Legal)"}.rtf`;
      const dep = depTiruan(blangko(nama), { [VAR_TABEL_DAFTAR_ISI[k]]: "TABEL-ABT" });
      const baris = [
        { bundel: "A", grup: "I. PENDAFTARAN", kunci: "gugatan", nama: "Surat Gugatan", tanggal: "2026-03-10", halaman: 4, sumber: "pasti" },
        { bundel: "A", grup: "II. PENETAPAN AWAL", kunci: "pmh", nama: "Penetapan Majelis Hakim", tanggal: "2026-03-11", halaman: 1, sumber: "pasti" },
      ];
      const h = await susunNaskahBerkas({ baris, sunting: {} }, { jenis: "daftar-isi", kertas: k, bentuk: "awal", lawan: true, banyak: false }, dep);
      expect(h.ok).toBe(true);
      if (!h.ok) return;
      const t = h.rtf.toString("latin1");
      expect(dep.dikirim[0][VAR_TABEL_DAFTAR_ISI[k]]).toBe("@@TABEL-CEKLIST@@");
      expect(t).not.toContain("TABEL-ABT");
      expect(t).not.toContain("@@");
      expect(t).not.toMatch(/#\d{3,5}#/);
      expect(t).toContain("Surat Gugatan\\cell");
      // kepala + 2 judul bagian + 2 dokumen + baris kosong = BARIS_DAFTAR_ISI baris isi (+ kepala)
      const tabel = t.slice(t.indexOf("JENIS SURAT / DOKUMEN") - 2000);
      expect((tabel.match(/\\row/g) || []).length - 0).toBeGreaterThanOrEqual(BARIS_DAFTAR_ISI[k] + 1);
      expect(t).toContain(`\\cellx${LEBAR_ISI[k]}`);
      expect(t).toContain("{\\pict\\pngblip"); // logo tertanam tetap
      expect(t).not.toContain(PENANDA_LOGO);
    }
  });
  it("ceklist: tabel portal (OTO e-Court) menggantikan tabel ABT, baris tulis tangan sampai penuh halaman", async () => {
    const dep = depTiruan(blangko("99 PTSP/Ceklist Berkas Perkara (F4).rtf"), { [VAR_TABEL_CEKLIST.f4]: "TABEL-ABT" });
    const ceklist = { jenis: "cg", lawan: true, fakta: { keadaan: { kuasa: false }, penetapan: { pmh: "2026-03-11" }, kasir: { jumlah: 500000, baris: 1 }, judulDokumen: ["Gugatan.pdf"] }, tangan: {} };
    const h = await susunNaskahBerkas({ ceklist }, { jenis: "ceklist", kertas: "f4", bentuk: "awal", lawan: true, banyak: false }, dep);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const t = h.rtf.toString("latin1");
    expect(t).not.toContain("TABEL-ABT");
    expect(t).toContain("Penetapan Majelis Hakim (PMH)");
    const nomorAkhir = Math.max(...[...t.matchAll(/\\qc\\f0\\fs18\\sb20\\sa20 (\d+)\\cell/g)].map((m) => Number(m[1])));
    expect(nomorAkhir).toBe(BARIS_CEKLIST.f4);
  });
  it("sampul: lampiran ABT dibuang (penandanya saja; kaki portal tetap di paragraf catatan), lampiran portal ditempel bila perlu, logo Identitas satker menggantikan logo tertanam", async () => {
    const n = "11606";
    const dep = depTiruan(blangko("99 PTSP/Sampul Berkas Perkara.rtf"), { [n]: "\\b Lampiran (1): LAMPIRAN-ABT" }, "{\\pict\\pngblip LOGO-SATKER}");
    const anak = Array.from({ length: 5 }, (_x, i) => ({ nama: `Anak ${i + 1}`, umur: "5", diasuh: "P" }));
    const h = await susunNaskahBerkas({ nomor: "1/Pdt.G/2026/PA.Dgl", anak, pihak: [{ sisi: 1, urutan: 1, nama: "A" }, { sisi: 2, urutan: 1, nama: "B" }], riwayat: [] },
      { jenis: "sampul", kertas: "a4", bentuk: "awal", lawan: true, banyak: false }, dep);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const t = h.rtf.toString("latin1");
    for (const k of VAR_LAMPIRAN_ABT) expect(dep.dikirim[0][k]).toBe(PENANDA_LAMPIRAN_ABT);
    expect(t).not.toContain("LAMPIRAN-ABT");
    expect(t).not.toContain("@@");
    expect(h.lampiran.map((x) => x.judul)).toEqual(["DAFTAR ANAK"]);
    expect(t).toContain("LAMPIRAN 1 - DAFTAR ANAK");
    expect(t).toContain("terisi otomatis.} {\\b\\fs15 Lampiran (1): 1. DAFTAR ANAK}\\par"); // kaki portal di paragraf catatan, lampiran ABT tanpa sisa
    expect(t).toContain("\\pagebb");
    expect(t).toContain("Anak 5\\cell");
    expect(t).toContain("{\\pict\\pngblip LOGO-SATKER}");
    expect(t.match(/\\pict/g)).toHaveLength(1);
  });
  it("buangParagrafPenanda: hanya paragraf penanda yang hilang", () => {
    const rtf = "\\pard A\\par\r\n\\pard\\plain\\ql\\f0\\fs15\\sb0\\sa0 @@X@@\\par\r\n\\pard B\\par";
    expect(buangParagrafPenanda(rtf, "@@X@@")).toBe("\\pard A\\par\r\n\\pard B\\par");
    expect(buangParagrafPenanda(rtf, "@@Y@@")).toBe(rtf);
  });
});

describe("6. kembaran fungsi ABT <-> portal, aturan pembersih ABT, MariaDB 5.5", () => {
  const fungsi = readFileSync(path.join(PAKET, "sumber/fungsi.sql"), "latin1");
  const variabel = readFileSync(path.join(PAKET, "sumber/variabel.py"), "utf8");
  it("lebar isi, jumlah baris, dan kolom sama dengan definisi variabel dan fungsi paket", () => {
    const dict = (nama: string) => Object.fromEntries([...(variabel.match(new RegExp(`${nama} = \\{([^}]*)\\}`)) || ["", ""])[1].matchAll(/'(\w+)': (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(dict("LEBAR")).toEqual(LEBAR_ISI);
    expect(dict("BARIS_DAFTAR")).toEqual(BARIS_DAFTAR_ISI);
    expect(dict("BARIS_CEKLIST")).toEqual(BARIS_CEKLIST);
    expect(fungsi).toContain("'c600,l6100,l2150,c1600'");
    expect(tabelDaftarIsiRtf([], "A", 10466)).toContain(`\\cellx${Math.trunc((600 * 10466) / 10450)}`);
    expect(fungsi).toContain("'c560,l4500,c1100,c700,c800,l2806'");
    expect(tabelCeklistRtf([], 10466)).toContain(`\\cellx${Math.trunc((560 * 10466) / 10466)}`);
  });
  it("SQL fungsi tanpa fitur di luar MariaDB 5.5; keluaran tanpa kurung kurawal, titik koma, dan spasi ganda di teks tetap", () => {
    expect(fungsi).not.toMatch(/REGEXP_REPLACE|JSON_|\bWITH\s+\w+\s+AS\s*\(|OVER\s*\(|LATERAL/i);
    expect(fungsi.toLowerCase()).not.toContain("aleta");
    const literal = [...fungsi.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]).filter((x) => x.includes("\\\\"));
    for (const x of literal) {
      expect(x, x).not.toMatch(/[{};]/);
      expect(x, x).not.toContain("  ");
    }
    expect(fungsi).toContain("RETURN '\\\\b0';");
  });
  it("paket: 20 variabel baru 11600-11619, 106 diubah, prasyarat dan pulih tersyarat md5, timpa 21 blangko", () => {
    const ps = path.join(PAKET, "paket-satker");
    if (!existsSync(ps)) return;
    const baca = (n: string) => readFileSync(path.join(ps, n), "latin1");
    expect(baca("nomor-baru.txt").split("\n").filter((x) => /^\d+$/.test(x))).toEqual(Array.from({ length: 20 }, (_x, i) => String(11600 + i)));
    expect(baca("nomor-ubah.txt").split("\n").filter((x) => /^\d+$/.test(x))).toHaveLength(106);
    expect(baca("harap.txt")).toMatch(/^HARAP='0\|0\|106\|0\|\d+\|0'$/m);
    expect(baca("abt-sampul-rapi-30okt-PULIH.sql").match(/^UPDATE .* AND MD5\(sql_query\) = '[0-9a-f]{32}';$/gm)).toHaveLength(106);
    expect(baca("daftar-timpa.tsv").split("\n").filter((x) => x.startsWith("derry_briantono/"))).toHaveLength(21);
    for (const n of ["abt-sampul-rapi-30okt-PASANG.sql", "abt-sampul-rapi-30okt-FUNGSI.sql", "daftar-timpa.tsv", "nomor-baru.txt"]) expect(baca(n).toLowerCase()).not.toContain("aleta");
  });
});

describe("7. saklar layar Sampul/Daftar Isi: bawaan MENYALA, pilihan mati yang sengaja tetap mati (keputusan pengguna 30 Okt)", () => {
  let db: AletaDatabase;
  const aktor = { id: "usr-super", name: "Super Admin" };
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.close();
  });
  const jejakLama = (ke: string, dari: string) =>
    appendAuditLog(db, { id: `adt-lama-${ke}-${Math.random().toString(36).slice(2, 8)}`, actorUserId: "usr-super", action: "UPDATE_FITUR_SATKER", entityType: "aleta_ekstensi_setelan", entityId: "*sistem*:sistem:fitur-satker", payload: { berubah: [{ kode: FITUR_BERKAS_PERKARA, dari, ke }] }, createdAt: ke === "mati" ? "2026-10-27T03:00:00.000Z" : "2026-10-27T02:00:00.000Z" });

  it("belum pernah diatur (tanpa setelan, tanpa jejak): menyala", async () => {
    expect(await fiturMenyala(db, FITUR_BERKAS_PERKARA)).toBe(true);
  });
  it("setelan lama tanpa kode ini (hanya fitur lain diubah): tetap dianggap belum diatur -> menyala", async () => {
    await simpanPengaturanFitur(db, aktor, { fitur: { "lihat-sebagai-pratinjau": "stabil", [FITUR_BERKAS_PERKARA]: "stabil" } });
    expect(await fiturMenyala(db, FITUR_BERKAS_PERKARA)).toBe(true);
  });
  it("pernah DINYALAKAN lalu SENGAJA DIMATIKAN pada masa bawaan lama (jejak terakhir 'mati', setelan tidak menyimpannya): tetap mati", async () => {
    await jejakLama("stabil", "mati");
    await jejakLama("mati", "stabil");
    expect((await bacaPengaturanFitur(db))?.fitur[FITUR_BERKAS_PERKARA]).toBe("mati");
    expect(await fiturMenyala(db, FITUR_BERKAS_PERKARA)).toBe(false);
  });
  it("pernah dinyalakan saja (jejak terakhir 'stabil'): menyala", async () => {
    await jejakLama("stabil", "mati");
    expect(await fiturMenyala(db, FITUR_BERKAS_PERKARA)).toBe(true);
  });
  it("dimatikan lewat Fitur Satker sesudah bawaan baru: tersimpan terang sebagai mati; dinyalakan lagi: menyala", async () => {
    await simpanPengaturanFitur(db, aktor, { fitur: { [FITUR_BERKAS_PERKARA]: "mati" } });
    expect(await fiturMenyala(db, FITUR_BERKAS_PERKARA)).toBe(false);
    await simpanPengaturanFitur(db, aktor, { fitur: { [FITUR_BERKAS_PERKARA]: "stabil" } });
    expect(await fiturMenyala(db, FITUR_BERKAS_PERKARA)).toBe(true);
  });
  it("pilihanDariJejak: membaca kode yang disebut saja; payload rusak = tidak ada jejak", () => {
    expect(pilihanDariJejak(JSON.stringify({ berubah: [{ kode: "lain", ke: "mati" }, { kode: FITUR_BERKAS_PERKARA, ke: "mati" }] }), FITUR_BERKAS_PERKARA)).toBe("mati");
    expect(pilihanDariJejak({ berubah: [{ kode: "lain", ke: "mati" }] }, FITUR_BERKAS_PERKARA)).toBeNull();
    expect(pilihanDariJejak("{rusak", FITUR_BERKAS_PERKARA)).toBeNull();
  });
});
