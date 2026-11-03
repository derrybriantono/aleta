// @vitest-environment node
/**
 * ============================================================================
 * 1 NOV 2026 - Z CROSS OTOMATIS (awan T11, Bagian 2)
 * ============================================================================
 *
 * Aturan Derry: garis atas Z sebaris dengan kata terakhir "...berikut:" sampai batas kanan (ruang < 3 cm = kalimat dirapatkan); diagonal ke
 * kiri bawah; garis bawah +-3 cm di atas tepi bawah; tanggal tepat di bawah garis; ganti halaman; nomor halaman bagian berikutnya = halaman Z
 * + jumlah halaman bukti.
 *
 *   A  geometri murni, RTF (urai / bersihkan / tulis), DOCX (zip + XML), orkestrasi dengan mesin PALSU (PDF buatan pdf-lib berkoordinat
 *      yang diketahui) - berjalan di mana saja (juga server Linux tanpa Word);
 *   B  mesin SUNGGUHAN (Word COM di laptop ini; soffice bila ZCROSS_MESIN=soffice): fixture RTF dengan 1, 3, 12 bukti, hasil PDF dibaca
 *      balik (garis vektor, kata, nomor halaman). Dilewati bila mesin tidak ada.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { kenaliBerkasWord, wordKePdfBas } from "@/server/modules/aleta-ecourt/bas-word-pdf";
import { bukaDocx } from "@/server/modules/aleta-ecourt/zcross/docx";
import {
  CM,
  JARAK_BAWAH_HALAMAN,
  RUANG_MIN_GARIS_ATAS,
  RUANG_TANGGAL_AREA_TEKS,
  jumlahHalamanBukti,
  nomorBagianBerikutnya,
  rencanaZ,
  tanggalIndonesia,
  type LetakJangkar,
} from "@/server/modules/aleta-ecourt/zcross/geometri";
import { hitungBuktiDariNaskah, sesuaikanZcross, type Mesin } from "@/server/modules/aleta-ecourt/zcross";
import { adaWord, mesinSoffice, mesinWord } from "@/server/modules/aleta-ecourt/zcross/mesin";
import { bacaOpsiBukti, peringatanZcross, sesuaikanZcrossOtomatis } from "@/server/modules/aleta-ecourt/zcross/pakai";
import { bacaKataPdf } from "@/server/modules/aleta-ecourt/zcross/pdf-letak";
import { bersihkanZRtf, cariJangkarRtf, tulisZRtf, uraiRtf } from "@/server/modules/aleta-ecourt/zcross/rtf";
import { bacaZip, entriBaru, isiEntri, tulisZip } from "@/server/modules/aleta-ecourt/zcross/zip";
import { uraiXml } from "@/server/modules/aleta-ecourt/zcross/xml-mini";

import { buatBasRtf } from "./fixtures/zcross-fixture";
import { bacaGarisPdf } from "./fixtures/zcross-garis-pdf";

const lat1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");
const bita = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));

function seimbang(s: string): boolean {
  let d = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === "{") d += 1;
    else if (c === "}") {
      d -= 1;
      if (d < 0) return false;
    }
  }
  return d === 0;
}

// ----------------------------------------------------------------------------
// A1. Geometri
// ----------------------------------------------------------------------------
const letak = (o: Partial<LetakJangkar> = {}): LetakJangkar => ({ halaman: 1, lebarHalaman: 609.5, tinggiHalaman: 842, xAkhir: 250, yDasar: 400, ukuranHuruf: 12, teksBaris: "Bukti-bukti tersebut sebagai berikut:", ...o });
const TEPI = { kiri: 113.4, kanan: 609.5 - 56.7 };

describe("Z cross - geometri murni", () => {
  it("garis atas sebaris dengan kata terakhir: mulai di ujung kata sampai batas kanan, setinggi huruf", () => {
    const r = rencanaZ(letak(), TEPI);
    expect(r.atas.x1).toBeGreaterThan(250);
    expect(r.atas.x1).toBeLessThan(260);
    expect(r.atas.x2).toBeCloseTo(TEPI.kanan, 3);
    // di antara puncak dan garis dasar huruf (12 pt) pada baris itu
    expect(r.atas.y).toBeLessThan(400);
    expect(r.atas.y).toBeGreaterThan(400 - 12);
    expect(r.kurangRuang).toBe(0);
  });

  it("2 Nov: margin bawah diketahui -> garis bawah sampai dekat batas bawah AREA TEKS, tanggal tepat di bawahnya masih di area teks", () => {
    const r = rencanaZ(letak(), { ...TEPI, bawah: 85 });
    const batas = 842 - 85;
    expect(r.bawah.y).toBeCloseTo(batas - RUANG_TANGGAL_AREA_TEKS, 3);
    // margin bawah lebih kecil -> garis turun lebih rendah (mengikuti area teks, bukan jarak tetap dari ujung kertas)
    expect(rencanaZ(letak(), { ...TEPI, bawah: 57 }).bawah.y).toBeCloseTo(842 - 57 - RUANG_TANGGAL_AREA_TEKS, 3);
    expect(r.diagonal.y2).toBeCloseTo(r.bawah.y, 3);
    expect(r.tanggal.y).toBeGreaterThan(r.bawah.y);
    // dua baris tanggal (SC Z 1x + tanggal) muat di atas batas area teks, tidak masuk kaki halaman
    expect(r.tanggal.y + 2 * 15).toBeLessThanOrEqual(batas + 0.5);
  });

  it("garis bawah 3 cm di atas tepi bawah halaman; diagonal ke kiri bawah; tanggal tepat di bawah garis dan tidak menempel tepi", () => {
    const r = rencanaZ(letak(), TEPI);
    expect(r.bawah.y).toBeCloseTo(842 - JARAK_BAWAH_HALAMAN, 3);
    expect(r.diagonal.x1).toBeCloseTo(TEPI.kanan, 3);
    expect(r.diagonal.x2).toBeCloseTo(TEPI.kiri, 3);
    expect(r.diagonal.y2).toBeCloseTo(r.bawah.y, 3);
    expect(r.diagonal.y1).toBeCloseTo(r.atas.y, 3);
    expect(r.tanggal.y).toBeGreaterThan(r.bawah.y);
    expect(r.tanggal.y - r.bawah.y).toBeLessThan(6);
    expect(r.tanggal.y).toBeLessThan(842 - 1.2 * CM);
  });

  it("ruang < 3 cm: ditandai kurangRuang (kalimat dirapatkan), garis TETAP sebaris - tidak pindah ke bawah paragraf", () => {
    const r = rencanaZ(letak({ xAkhir: TEPI.kanan - 1.2 * CM }), TEPI);
    expect(r.kurangRuang).toBeCloseTo(RUANG_MIN_GARIS_ATAS - 1.2 * CM, 3);
    expect(r.atas.y).toBeLessThan(400);
    expect(r.atas.y).toBeGreaterThan(400 - 12);
    expect(r.atas.x1).toBeGreaterThan(TEPI.kanan - 1.2 * CM);
  });

  // 3 Nov (DIUBAH SENGAJA, uji tangan BAS 631): dulu garis bawah + tanggal DITURUNKAN melewati batas area teks bila kata terakhir dekat
  // dasar halaman (Z keluar area teks / menimpa kaki halaman). Aturan Derry: Z hanya menutup RUANG KOSONG - tanpa ruang = tanpa Z.
  it("kata terakhir dekat dasar halaman: tidak ada ruang kosong -> Z tidak digambar (cukupRuang false), garis bawah tidak pernah turun melewati area teks", () => {
    const r = rencanaZ(letak({ yDasar: 842 - 3 * CM - 5 }), TEPI);
    expect(r.cukupRuang).toBe(false);
    expect(r.bawah.y).toBeLessThanOrEqual(842 - JARAK_BAWAH_HALAMAN + 0.01);
    expect(r.temuan.some((t) => t.tingkat === "peringatan" && /tidak digambar/.test(t.pesan))).toBe(true);
    // ruang cukup (+-1 cm di bawah baris terakhir) -> tetap digambar
    expect(rencanaZ(letak({ yDasar: 842 - 3 * CM - 40 }), TEPI).cukupRuang).toBe(true);
    expect(rencanaZ(letak(), TEPI).cukupRuang).toBe(true);
  });

  it("nomor halaman bagian berikutnya = halaman Z + jumlah halaman bukti + 1 (bukti menempati halaman sesudah Z)", () => {
    expect(nomorBagianBerikutnya(3, 4)).toBe(8);
    expect(nomorBagianBerikutnya(1, 1)).toBe(3);
    expect(nomorBagianBerikutnya(2, 12)).toBe(15);
    expect(nomorBagianBerikutnya(3, 4, 0)).toBe(7);
  });

  it("jumlah halaman bukti: dari PDF bila ada, selainnya 1 per bukti dan ditandai bawaan", () => {
    expect(jumlahHalamanBukti({ jumlahBukti: 3, halamanPerBukti: [2, 1, 4] })).toEqual({ jumlah: 7, bawaan: false, terukur: 3 });
    expect(jumlahHalamanBukti({ jumlahBukti: 3 })).toEqual({ jumlah: 3, bawaan: true, terukur: 0 });
    expect(jumlahHalamanBukti({ jumlahBukti: 3, halamanPerBukti: [2, null, 4] })).toEqual({ jumlah: 7, bawaan: true, terukur: 2 });
  });

  it("tanggal Indonesia dalam bentuk '31 Oktober 2026'", () => {
    expect(tanggalIndonesia(new Date("2026-10-31T10:00:00Z"))).toBe("31 Oktober 2026");
    expect(tanggalIndonesia(new Date("2026-12-31T20:00:00Z"))).toBe("1 Januari 2027");
  });
});

// ----------------------------------------------------------------------------
// A2. RTF
// ----------------------------------------------------------------------------
describe("Z cross - RTF", () => {
  const fx = (o: Parameters<typeof buatBasRtf>[0]) => buatBasRtf(o);

  it("urai: teks tampak per paragraf; isi kotak teks, header/footer, dan {\\*...} tidak ikut", () => {
    const s = fx({ bukti: 2, isi: 1, templatZ: true });
    const u = uraiRtf(s);
    const teks = u.paragraf.map((p) => p.teks);
    expect(teks.some((t) => t.startsWith("Bukti-bukti tersebut sebagai berikut:"))).toBe(true);
    expect(teks.join("|")).not.toContain("SC Z");
    expect(teks.join("|")).not.toContain("Halaman");
    const j = cariJangkarRtf(s, u);
    expect(j?.via).toBe("bentuk");
    expect(j?.paragrafUkur.teks).toBe("Bukti-bukti tersebut sebagai berikut:");
  });

  it("jangkar tanpa templat = paragraf terakhir berujung 'berikut:' / 'berupa:'; tanpa jangkar = null", () => {
    const s = fx({ bukti: 2, isi: 1 });
    expect(cariJangkarRtf(s, uraiRtf(s))?.via).toBe("ujung-daftar");
    const t = fx({ bukti: 0, isi: 1, tanpaJangkar: true });
    expect(cariJangkarRtf(t, uraiRtf(t))).toBeNull();
  });

  it("bersihkan: bentuk templat dibuang, kotak tanggal lama diambil (isinya tetap), kurung seimbang", () => {
    const s = fx({ bukti: 2, templatZ: true });
    const b = bersihkanZRtf(s);
    expect(b.jumlahBentukDibuang).toBe(2);
    expect(b.rtf).not.toContain("FreeForm");
    expect(b.rtf).not.toContain("SC Z");
    expect(b.kotakTanggal).toContain("SC Z 1x");
    expect(seimbang(b.rtf)).toBe(true);
    expect(uraiRtf(b.rtf).paragraf.map((p) => p.teks)).toEqual(uraiRtf(s).paragraf.map((p) => p.teks));
  });

  const rencana = rencanaZ(letak(), TEPI);

  it("tulis: bentuk ditambat di paragraf jangkar, nomor halaman seksi berikut ditimpa, kurung seimbang, idempoten", () => {
    const s = fx({ bukti: 3, isi: 2, templatZ: true });
    const b = bersihkanZRtf(s);
    const j = cariJangkarRtf(s, uraiRtf(s))!;
    const t1 = tulisZRtf(b.rtf, j.indeks, { rencana, kotakTanggal: b.kotakTanggal, tanggal: "31 Oktober 2026", nomorBerikut: 7 });
    expect(t1.seksi).toBe("dipakai");
    expect(t1.nomorDitulis).toBe(7);
    expect(seimbang(t1.rtf)).toBe(true);
    expect(t1.rtf).toContain("\\pgnstarts7");
    expect(t1.rtf).not.toContain("\\pgnstarts15");
    expect((t1.rtf.match(/zcross-garis/g) ?? []).length).toBe(1);
    expect((t1.rtf.match(/zcross-tanggal/g) ?? []).length).toBe(1);
    expect(t1.rtf).toContain("SC Z 1x");
    // bentuk ada di dalam paragraf jangkar (sebelum \par penutupnya)
    const u = uraiRtf(t1.rtf);
    const p = u.paragraf[j.indeks];
    expect(p.teks).toBe("Bukti-bukti tersebut sebagai berikut:");
    expect(p.shp.length).toBe(2);
    // penyesuaian ulang: bersihkan + tulis lagi = sama persis
    const b2 = bersihkanZRtf(t1.rtf);
    expect(b2.jumlahBentukDibuang).toBe(2);
    const j2 = cariJangkarRtf(t1.rtf, uraiRtf(t1.rtf))!;
    expect(j2.indeks).toBe(j.indeks);
    const t2 = tulisZRtf(b2.rtf, j2.indeks, { rencana, kotakTanggal: b2.kotakTanggal, tanggal: "31 Oktober 2026", nomorBerikut: 7 });
    expect(t2.rtf).toBe(t1.rtf);
  });

  it("tulis: tanpa pemisah seksi tetapi ada kalimat sesudahnya -> pemisah halaman baru disisipkan dengan nomor halaman", () => {
    const s = fx({ bukti: 2, isi: 1, bagianBerikut: true, tanpaPemisah: true });
    const b = bersihkanZRtf(s);
    const j = cariJangkarRtf(s, uraiRtf(s))!;
    const t = tulisZRtf(b.rtf, j.indeks, { rencana, kotakTanggal: null, tanggal: "29 Oktober 2026", nomorBerikut: 5 });
    expect(t.seksi).toBe("disisipkan");
    expect(seimbang(t.rtf)).toBe(true);
    expect(t.rtf).toMatch(/\\sect\\sectd[^{]*\\sbkpage \\pgnrestart \\pgnstarts5 /);
    expect(t.rtf).toContain("29 Oktober 2026");
    // ukuran halaman seksi baru disalin dari seksi asal
    expect(t.rtf).toMatch(/\\sect\\sectd[^{]*\\pgwsxn12191\\pghsxn16840/);
  });

  it("tulis: tidak ada bagian sesudah Z -> hanya bentuk, tanpa pemisah dan tanpa nomor", () => {
    const s = fx({ bukti: 2, isi: 1, bagianBerikut: false });
    const b = bersihkanZRtf(s);
    const j = cariJangkarRtf(s, uraiRtf(s))!;
    const t = tulisZRtf(b.rtf, j.indeks, { rencana, kotakTanggal: null, tanggal: "29 Oktober 2026", nomorBerikut: 5 });
    expect(t.seksi).toBe("tanpa-bagian-berikut");
    expect(t.nomorDitulis).toBeNull();
    expect(t.rtf).not.toContain("pgnstarts5");
    expect(seimbang(t.rtf)).toBe(true);
  });

  it("hitung bukti dari naskah: butir di antara pengantar dan jangkar; pengantar elektronik bersambung ke daftar surat", () => {
    const u = uraiRtf(fx({ bukti: 4, isi: 1 }));
    const idx = u.paragraf.findIndex((p) => p.teks.startsWith("Bukti-bukti tersebut"));
    expect(hitungBuktiDariNaskah(u.paragraf.map((p) => p.teks), idx)).toBe(4);
    const e = uraiRtf(fx({ bukti: 4, elektronik: 2 }));
    const ie = e.paragraf.findIndex((p) => p.teks.startsWith("Bukti-bukti tersebut"));
    expect(hitungBuktiDariNaskah(e.paragraf.map((p) => p.teks), ie)).toBe(6);
  });
});

// ----------------------------------------------------------------------------
// A3. Zip + DOCX
// ----------------------------------------------------------------------------
describe("Z cross - zip", () => {
  it("tulis lalu baca kembali; entri yang tidak diubah disalin persis", () => {
    const a = entriBaru("[Content_Types].xml", new TextEncoder().encode("<Types/>"));
    const b = entriBaru("word/document.xml", new TextEncoder().encode("<w:document/>".repeat(200)));
    const zip = tulisZip([a, b]);
    const baca = bacaZip(zip);
    expect(baca.map((e) => e.nama)).toEqual(["[Content_Types].xml", "word/document.xml"]);
    expect(new TextDecoder().decode(isiEntri(baca[1]))).toBe("<w:document/>".repeat(200));
    const salin = tulisZip([baca[0], entriBaru("word/document.xml", new TextEncoder().encode("<x/>"), baca[1])]);
    const baca2 = bacaZip(salin);
    expect(Array.from(baca2[0].mentah)).toEqual(Array.from(baca[0].mentah));
    expect(new TextDecoder().decode(isiEntri(baca2[1]))).toBe("<x/>");
  });
});

// ----------------------------------------------------------------------------
// A4. Orkestrasi dengan mesin palsu
// ----------------------------------------------------------------------------
/** Mesin palsu: PDF buatan pdf-lib dari teks paragraf RTF (satu halaman = isi sampai pemisah seksi), koordinat diketahui. */
function mesinPalsu(): Mesin & { panggilan: number } {
  const m = {
    nama: "uji" as const,
    panggilan: 0,
    async ubah(isi: Uint8Array, dari: "rtf" | "docx" | "doc", ke: "rtf" | "docx" | "doc" | "pdf"): Promise<Uint8Array> {
      m.panggilan += 1;
      if (ke !== "pdf") return isi;
      if (dari !== "rtf") throw new Error("mesin palsu hanya RTF");
      const s = lat1(isi);
      const u = uraiRtf(s);
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      let hal = pdf.addPage([609.5, 842]);
      let y = 842 - 85;
      const lebar = 609.5 - 113.4 - 56.7;
      // jarak huruf dari \expndtw pada paragraf yang diberi penanda dirapatkan
      for (const p of u.paragraf) {
        const rapat = /\\zcxa\}\\expndtw-(\d+)/.exec(s.slice(p.awal, p.akhir));
        const kurang = rapat ? Number(rapat[1]) / 20 : 0;
        const kata = p.teks.split(/\s+/).filter(Boolean);
        let baris = "";
        const tulis = (t: string) => {
          if (y < 85) {
            hal = pdf.addPage([609.5, 842]);
            y = 842 - 85;
          }
          // pdf-lib tidak punya jarak huruf: jarak huruf negatif ditiru dengan mengecilkan ukuran huruf sehingga lebar baris sama
          const lebarAsli = font.widthOfTextAtSize(t, 12);
          const ukuran = kurang ? (12 * Math.max(1, lebarAsli - kurang * t.length)) / lebarAsli : 12;
          hal.drawText(t, { x: 113.4, y, size: ukuran, font });
          y -= 16;
        };
        for (const k of kata) {
          const coba = baris ? `${baris} ${k}` : k;
          if (font.widthOfTextAtSize(coba, 12) - kurang * coba.length > lebar && baris) {
            tulis(baris);
            baris = k;
          } else baris = coba;
        }
        if (baris) tulis(baris);
        if (p.penutup === "sect") {
          hal = pdf.addPage([609.5, 842]);
          y = 842 - 85;
        }
      }
      return new Uint8Array(await pdf.save());
    },
  };
  return m;
}

describe("Z cross - orkestrasi (mesin palsu)", () => {
  it("memasang Z di halaman jangkar, nomor bagian berikut = halaman Z + jumlah halaman bukti, laporan lengkap", async () => {
    const mesin = mesinPalsu();
    const s = buatBasRtf({ bukti: 3, isi: 2, templatZ: true });
    const h = await sesuaikanZcross(bita(s), "rtf", { mesin, jumlahBukti: 3, halamanBukti: [2, 1, 4] });
    expect(h.laporan.diubah).toBe(true);
    expect(h.laporan.halamanFisikZ).toBe(1);
    expect(h.laporan.halamanTampilZ).toBe(1);
    expect(h.laporan.jumlahHalamanBukti).toBe(7);
    expect(h.laporan.jumlahHalamanBuktiBawaan).toBe(false);
    expect(h.laporan.nomorBagianBerikut).toBe(9);
    expect(h.laporan.halamanBuktiDari).toBe(2);
    expect(h.laporan.halamanBuktiSampai).toBe(8);
    expect(lat1(h.bita)).toContain("\\pgnstarts9");
    expect(seimbang(lat1(h.bita))).toBe(true);
    expect(kenaliBerkasWord(h.bita)).toBe("rtf");
  });

  it("jumlah halaman bukti bawaan (1 per bukti) dilaporkan sebagai info", async () => {
    const s = buatBasRtf({ bukti: 4, isi: 1 });
    const h = await sesuaikanZcross(bita(s), "rtf", { mesin: mesinPalsu() });
    expect(h.laporan.jumlahHalamanBukti).toBe(4);
    expect(h.laporan.jumlahHalamanBuktiBawaan).toBe(true);
    expect(h.laporan.temuan.some((t) => /bawaan/.test(t.pesan))).toBe(true);
    expect(JSON.stringify(h.laporan)).not.toMatch(/aleta/i);
  });

  it("dijalankan ulang pada hasilnya: tidak menumpuk (satu pasang bentuk), hasil sama", async () => {
    const mesin = mesinPalsu();
    const s = buatBasRtf({ bukti: 3, isi: 2, templatZ: true });
    const h1 = await sesuaikanZcross(bita(s), "rtf", { mesin, jumlahBukti: 3, tanggal: "29 Oktober 2026" });
    const h2 = await sesuaikanZcross(h1.bita, "rtf", { mesin, jumlahBukti: 3, tanggal: "29 Oktober 2026" });
    expect((lat1(h2.bita).match(/zcross-garis/g) ?? []).length).toBe(1);
    expect(lat1(h2.bita)).toBe(lat1(h1.bita));
  });

  it("kata terakhir hampir di batas kanan: kalimat dirapatkan sampai ruang >= 3 cm, Z tetap sebaris", async () => {
    const mesin = mesinPalsu();
    // kalimat jangkar yang satu baris penuh: pengisi ditambah sampai lebar baris 425-435 pt (lebar isi 439 pt)
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    let kalimat = "Bukti-bukti tersebut sebagai berikut:";
    while (font.widthOfTextAtSize(kalimat, 12) < 425) kalimat = `Bukti ${kalimat}`;
    expect(font.widthOfTextAtSize(kalimat, 12)).toBeLessThan(436);
    let s = buatBasRtf({ bukti: 2, isi: 1 });
    s = s.replace("Bukti-bukti tersebut sebagai berikut:", kalimat);
    const h = await sesuaikanZcross(bita(s), "rtf", { mesin, jumlahBukti: 2 });
    expect(h.laporan.diubah).toBe(true);
    expect(h.laporan.dirapatkan).toBe(true);
    expect(lat1(h.bita)).toContain("\\expndtw-");
    expect(seimbang(lat1(h.bita))).toBe(true);
    expect(h.laporan.temuan.some((t) => /tetap kurang/.test(t.pesan))).toBe(false);
    // teks asli tidak berubah satu huruf pun
    const sebelum = uraiRtf(s).paragraf.map((p) => p.teks);
    const sesudah = uraiRtf(lat1(h.bita)).paragraf.map((p) => p.teks);
    expect(sesudah).toEqual(sebelum);
    // dijalankan ulang: jarak huruf lama dicabut lalu dipasang lagi dengan nilai sama (tidak bertumpuk)
    const h2 = await sesuaikanZcross(h.bita, "rtf", { mesin, jumlahBukti: 2 });
    expect(lat1(h2.bita)).toBe(lat1(h.bita));
  });

  it("tanpa paragraf jangkar: naskah dikembalikan apa adanya dengan alasan", async () => {
    const s = buatBasRtf({ bukti: 0, isi: 2, tanpaJangkar: true });
    const h = await sesuaikanZcross(bita(s), "rtf", { mesin: mesinPalsu() });
    expect(h.laporan.diubah).toBe(false);
    expect(h.laporan.alasan).toMatch(/Tidak ada paragraf/);
    expect(lat1(h.bita)).toBe(s);
  });

  // 3 Nov (DIUBAH SENGAJA, arahan koordinator atas BAS 631): gagal sesudah tanda Z blangko dikenali = TANPA Z + peringatan. Dulu naskah
  // dikirim apa adanya sehingga tanda Z lama tercetak di tempat yang tidak pernah diperiksa (LibreOffice: di atas tulisan halaman berikut).
  it("mesin gagal: tidak menggagalkan cetak/unduh/unggah; tanda Z lama blangko DIBUANG (tanpa Z) + peringatan, teks naskah tetap", async () => {
    const rusak: Mesin = {
      nama: "uji",
      ubah: async () => {
        throw new Error("mesin mati");
      },
    };
    const s = buatBasRtf({ bukti: 2, isi: 1, templatZ: true });
    const h = await sesuaikanZcross(bita(s), "rtf", { mesin: rusak });
    expect(h.laporan.diubah).toBe(true);
    expect(h.laporan.alasan).toMatch(/gagal/i);
    const hasil = lat1(h.bita);
    expect(hasil).not.toMatch(/SC\s*Z|FreeForm|zcross-/);
    expect(seimbang(hasil)).toBe(true);
    expect(uraiRtf(hasil).paragraf.map((p) => p.teks)).toEqual(uraiRtf(s).paragraf.map((p) => p.teks));
    expect(h.laporan.temuan.some((t) => t.tingkat === "peringatan" && /tidak dapat dipasang/.test(t.pesan))).toBe(true);
    // tanpa tanda Z sama sekali: tetap apa adanya
    const polos = buatBasRtf({ bukti: 2, isi: 1 });
    const h2 = await sesuaikanZcross(bita(polos), "rtf", { mesin: rusak, hanyaBentuk: true });
    expect(h2.laporan.diubah).toBe(false);
    expect(lat1(h2.bita)).toBe(polos);
  });
});

// ----------------------------------------------------------------------------
// A5. Penyambung ke alur cetak / unduh / unggah
// ----------------------------------------------------------------------------
describe("Z cross - penyambung otomatis", () => {
  it("hanya naskah yang memuat bentuk SC Z yang disesuaikan otomatis; paragraf 'berikut:' biasa tidak disentuh", async () => {
    const tanpa = buatBasRtf({ bukti: 2, isi: 1 });
    const h = await sesuaikanZcrossOtomatis(bita(tanpa), "rtf", { mesin: mesinPalsu() });
    expect(h.laporan.diubah).toBe(false);
    expect(h.laporan.alasan).toMatch(/SC Z/);
    expect(lat1(h.bita)).toBe(tanpa);
    const dengan = buatBasRtf({ bukti: 2, isi: 1, templatZ: true });
    const h2 = await sesuaikanZcrossOtomatis(bita(dengan), "rtf", { mesin: mesinPalsu() });
    expect(h2.laporan.diubah).toBe(true);
  });

  it("dimatikan lewat ALETA_ZCROSS=0: naskah apa adanya", async () => {
    const lama = process.env.ALETA_ZCROSS;
    process.env.ALETA_ZCROSS = "0";
    try {
      const s = buatBasRtf({ bukti: 2, isi: 1, templatZ: true });
      const h = await sesuaikanZcrossOtomatis(bita(s), "rtf", { mesin: mesinPalsu() });
      expect(h.laporan.diubah).toBe(false);
      expect(lat1(h.bita)).toBe(s);
    } finally {
      if (lama === undefined) delete process.env.ALETA_ZCROSS;
      else process.env.ALETA_ZCROSS = lama;
    }
  });

  it("masukan bukti dari panel: angka dan daftar halaman dibersihkan", () => {
    expect(bacaOpsiBukti("3", "2, 1;4")).toEqual({ jumlahBukti: 3, halamanBukti: [2, 1, 4] });
    expect(bacaOpsiBukti(undefined, null)).toEqual({});
    expect(bacaOpsiBukti("x", "0,abc,2")).toEqual({ halamanBukti: [null, null, 2] });
    expect(bacaOpsiBukti(9999, [1, 2])).toEqual({ halamanBukti: [1, 2] });
  });

  it("peringatan untuk pengguna tanpa istilah teknis dan tanpa kata Aleta", async () => {
    const s = buatBasRtf({ bukti: 4, isi: 1, templatZ: true });
    const h = await sesuaikanZcrossOtomatis(bita(s), "rtf", { mesin: mesinPalsu() });
    const teks = peringatanZcross(h.laporan).join(" ");
    expect(teks).toMatch(/1 halaman per bukti/);
    expect(teks).toMatch(/menempati halaman 2-5\): halaman berikutnya bernomor 6/);
    expect(teks).not.toMatch(/aleta|rtf|docx|soffice/i);
  });

  it("wordKePdfBas: Z disesuaikan SEBELUM diubah ke PDF; gagal tidak menggagalkan PDF", async () => {
    const urutan: string[] = [];
    const pdfContoh = async () => {
      const d = await PDFDocument.create();
      d.addPage([609.5, 842]);
      return new Uint8Array(await d.save());
    };
    const s = buatBasRtf({ bukti: 2, isi: 1, templatZ: true });
    const masukan = { bita: bita(s), namaBerkas: "BAS.rtf", denganTtd: false, akun: { id: "1", nama: "x" }, bolehSemuaTtd: false, zcross: { jumlahBukti: 2, halamanBukti: [3, 1] } };
    const dasar = {
      daftarTtdSah: async () => [],
      gambarTtd: async () => null,
      ubahKePdf: async (b: Uint8Array) => {
        urutan.push(`pdf:${lat1(b).includes("zcross-garis") ? "dengan-Z" : "tanpa-Z"}`);
        return pdfContoh();
      },
    };
    const r = await wordKePdfBas(masukan, {
      ...dasar,
      sesuaikanZ: async (b, bentuk, opsi) => {
        urutan.push(`z:${bentuk}:${opsi.jumlahBukti}:${(opsi.halamanBukti ?? []).join(",")}`);
        const h = await sesuaikanZcrossOtomatis(b, bentuk, { ...opsi, mesin: mesinPalsu() });
        return { bita: h.bita, peringatan: peringatanZcross(h.laporan), ringkas: { diubah: h.laporan.diubah, nomorBagianBerikut: h.laporan.nomorBagianBerikut } };
      },
    });
    expect(urutan).toEqual(["z:rtf:2:3,1", "pdf:dengan-Z"]);
    expect(r.zcross?.diubah).toBe(true);
    expect(r.zcross?.nomorBagianBerikut).toBe(6);

    const r2 = await wordKePdfBas(masukan, {
      ...dasar,
      sesuaikanZ: async () => {
        throw new Error("mesin mati");
      },
    });
    expect(r2.pdf.length).toBeGreaterThan(100);
    expect(r2.zcross).toBeUndefined();
  });
});

// ----------------------------------------------------------------------------
// A6. Penyambung di panel ekstensi (unduh RTF): kode SUNGGUHAN dari blangko-derry-isian.js dijalankan dengan kaki palsu
// ----------------------------------------------------------------------------
describe("Z cross - panel ekstensi (unduh RTF)", () => {
  const sumber = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/blangko-derry-isian.js"), "utf8");
  const awal = sumber.indexOf("const API_ZCROSS");
  const akhir = sumber.indexOf("async function pdfDari(");
  expect(awal).toBeGreaterThan(0);
  const kode = sumber.slice(awal, akhir);
  const latin1Js = (buf: string | ArrayBuffer | Uint8Array) => (typeof buf === "string" ? buf : Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("latin1"));
  const bufDariLatin1 = (t: string) => {
    const u = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i += 1) u[i] = t.charCodeAt(i) & 0xff;
    return u.buffer;
  };
  const buat = (S: unknown, ambilPortal: (a: string, o: { body: FormData }, y: string) => Promise<unknown>, log: string[] = []) => {
    const f = new Function("S", "ambilPortal", "latin1", "bufDariLatin1", "butirElKosong", "catatLog", "BATAS_LAMA_MS", `${kode}; return { jumlahBuktiPanel, zCrossRtf, API_ZCROSS };`);
    return f(S, ambilPortal, latin1Js, bufDariLatin1, (b: { objek?: string }) => !String(b.objek || "").trim(), (t: string) => log.push(t), 1000) as {
      jumlahBuktiPanel: () => number;
      zCrossRtf: (rtf: string | ArrayBuffer, n: number) => Promise<{ rtf: string | ArrayBuffer; ket: string }>;
      API_ZCROSS: string;
    };
  };

  it("jumlah bukti dari daftar bukti panel: surat + elektronik pihak BAS ini, baris kosong tidak dihitung", () => {
    const S = {
      susunan: { isian: [{ khusus: "bukti", pihak: "P" }, { khusus: "lain", pihak: "T" }] },
      bukti: { P: [{ nm: "Fotokopi KTP" }, { manual: "Kutipan akta nikah" }, { nm: " " }], T: [{ nm: "tidak ikut" }] },
      buktiEl: { P: { butir: [{ objek: "Tangkapan layar" }, { objek: "" }] }, T: null },
    };
    expect(buat(S, async () => ({})).jumlahBuktiPanel()).toBe(3);
    expect(buat({ susunan: null, bukti: {}, buktiEl: {} }, async () => ({})).jumlahBuktiPanel()).toBe(0);
  });

  it("RTF dikirim ke rute z-cross (keluar rtf + jumlahBukti) dan hasilnya dipakai; byte tinggi tetap utuh", async () => {
    const dikirim: { alamat: string; badan: FormData }[] = [];
    const hasil = `{rtf hasil Z ${String.fromCharCode(0xe9)}}`;
    const api = buat({ susunan: null, bukti: {}, buktiEl: {} }, async (alamat, o) => {
      dikirim.push({ alamat, badan: o.body });
      return { diubah: true, berkasBase64: Buffer.from(hasil, "latin1").toString("base64"), laporan: { jumlahHalamanBuktiBawaan: false } };
    });
    const asal = `{rtf asal ${String.fromCharCode(0xe9, 0x96)}}`;
    const r = await api.zCrossRtf(asal, 4);
    expect(dikirim[0].alamat).toBe("/aleta/api/aleta-ecourt/bas/z-cross");
    expect(dikirim[0].badan.get("keluar")).toBe("rtf");
    expect(dikirim[0].badan.get("jumlahBukti")).toBe("4");
    const berkas = dikirim[0].badan.get("berkas") as File;
    expect(Buffer.from(await berkas.arrayBuffer()).toString("latin1")).toBe(asal);
    expect(r.rtf).toBe(hasil);
    expect(r.ket).toBe("Z dipasang");
    // tanpa jumlah bukti panel: ruas tidak dikirim (portal menghitung dari naskah)
    await api.zCrossRtf(asal, 0);
    expect(dikirim[1].badan.get("jumlahBukti")).toBeNull();
  });

  it("jumlah halaman bukti bawaan disebut di keterangan unduhan", async () => {
    const api = buat({}, async () => ({ diubah: true, berkasBase64: Buffer.from("{rtf z}").toString("base64"), laporan: { jumlahHalamanBuktiBawaan: true } }));
    const r = await api.zCrossRtf("{rtf a}", 2);
    expect(r.ket).toMatch(/bawaan 1 per bukti/);
  });

  it("rute gagal / tak terjangkau / tidak mengubah: RTF apa adanya, tanpa galat", async () => {
    const log: string[] = [];
    const rusak = buat({}, async () => { throw new Error("gagal (kode 503)"); }, log);
    const asal = "{rtf asal}";
    const r = await rusak.zCrossRtf(asal, 2);
    expect(r).toEqual({ rtf: asal, ket: "" });
    expect(log.join(" ")).toContain("Z cross dilewati");
    const tidak = buat({}, async () => ({ diubah: false, alasan: "tanpa bentuk" }));
    expect(await tidak.zCrossRtf(asal, 2)).toEqual({ rtf: asal, ket: "" });
  });
});

// ----------------------------------------------------------------------------
// B. Mesin sungguhan
// ----------------------------------------------------------------------------
const MESIN_ENV = (process.env.ZCROSS_MESIN || "").toLowerCase();
const MESIN_SUNGGUHAN = process.env.ZCROSS_UJI_MESIN === "0" ? null : MESIN_ENV === "soffice" ? mesinSoffice() : adaWord() ? mesinWord() : null;
const keluarRender = process.env.ZCROSS_RENDER_DIR || path.resolve(process.env.TMP || process.cwd(), "w151", "render");

const dalam = (v: number, a: number, b: number) => v >= Math.min(a, b) && v <= Math.max(a, b);

/** Mengisi variabel #nnnn# blangko dengan teks contoh (pengganti render ABT); #11170# = daftar bukti. */
function isiBlangko(rtf: string, bukti: number): string {
  const panjang = "Majelis hakim memeriksa perkara ini dengan seksama dan mendengar keterangan para pihak serta mempertimbangkan seluruh alat bukti yang diajukan di persidangan sebagaimana dimaksud dalam ketentuan hukum acara yang berlaku pada pengadilan tingkat pertama. ".repeat(3);
  const peta: Record<string, string> = {
    "0001": "123/Pdt.G/2026/PA.Dgl", "0048": "123/Pdt.G/2026/PA.Dgl", "0032": "Kamis", "0033": "29 Oktober 2026", "0098": "Fulan bin Fulan", "0102": "Fulanah binti Fulan",
    "7085": "Penggugat", "7086": "Tergugat", "4004": "Ketua Majelis", "1261": "ruang sidang Pengadilan Agama Donggala", "8008": "Pengadilan Agama Donggala",
    "5404": panjang, "8562": panjang, "7090": panjang, "0141": panjang, "0142": panjang,
  };
  const daftar = Array.from({ length: bukti }, (_, i) => `${i + 1}. Fotokopi surat nomor ${i + 1}/2026 bermeterai cukup dan sesuai dengan aslinya (diberi tanda P.${i + 1});`).join("\\line ");
  return rtf.replace(/#11170#/g, daftar).replace(/#(\d{4,5})#/g, (_m, n: string) => peta[n] ?? "(isian contoh)");
}


describe.skipIf(!MESIN_SUNGGUHAN)(`Z cross - mesin sungguhan (${MESIN_SUNGGUHAN?.nama})`, () => {
  const mesin = MESIN_SUNGGUHAN as Mesin;
  const kasus = [
    { nama: "1 bukti", bukti: 1, isi: 3 },
    { nama: "3 bukti", bukti: 3, isi: 6 },
    { nama: "12 bukti (Z di halaman berikut)", bukti: 12, isi: 9 },
  ];

  for (const k of kasus) {
    it(`RTF ${k.nama}: garis atas sebaris 'berikut:', tanggal di bawah garis, nomor halaman sesudahnya benar (dari PDF hasil)`, async () => {
      const s = buatBasRtf({ bukti: k.bukti, isi: k.isi, templatZ: true });
      const h = await sesuaikanZcross(bita(s), "rtf", { mesin, jumlahBukti: k.bukti, halamanBukti: Array.from({ length: k.bukti }, (_, i) => (i % 2 === 0 ? 2 : 1)) });
      expect(h.laporan.diubah, JSON.stringify(h.laporan)).toBe(true);
      const hasilRtf = lat1(h.bita);
      expect(seimbang(hasilRtf)).toBe(true);
      expect(hasilRtf).not.toContain("FreeForm");
      expect((hasilRtf.match(/SC Z 1x/g) ?? []).length).toBe(1);
      expect(h.laporan.nomorBagianBerikut).toBe((h.laporan.halamanTampilZ ?? 0) + h.laporan.jumlahHalamanBukti! + 1);

      // PDF dari RTF hasil (mesin yang sama) lalu dibaca balik
      const pdf = await mesin.ubah(h.bita, "rtf", "pdf");
      mkdirSync(keluarRender, { recursive: true });
      const nama = `rtf-${k.bukti}-bukti`;
      writeFileSync(path.join(keluarRender, `${nama}.pdf`), pdf);
      writeFileSync(path.join(keluarRender, `${nama}.rtf`), h.bita);
      const baca = await bacaKataPdf(pdf);
      const garis = await bacaGarisPdf(pdf);
      const kataAkhir = [...baca.kata].reverse().find((x) => x.norm === "berikut");
      expect(kataAkhir).toBeTruthy();
      const hz = kataAkhir!.halaman;
      expect(hz).toBe(h.laporan.halamanFisikZ);
      const g = garis.filter((x) => x.halaman === hz);
      const tinggi = baca.halaman[hz - 1].tinggi;
      // garis atas: mendatar, sebaris dengan "berikut:", mulai sesudah kata itu
      const atas = g.find((x) => Math.abs(x.y1 - x.y2) < 0.5 && x.x2 - x.x1 > 40 && dalam(x.y1, kataAkhir!.yDasar - 12, kataAkhir!.yDasar + 1));
      expect(atas, `garis atas tidak ditemukan; garis=${JSON.stringify(g)}`).toBeTruthy();
      expect(Math.min(atas!.x1, atas!.x2)).toBeGreaterThanOrEqual(kataAkhir!.x2 - 0.5);
      expect(Math.min(atas!.x1, atas!.x2)).toBeLessThan(kataAkhir!.x2 + 12);
      expect(Math.max(atas!.x1, atas!.x2)).toBeCloseTo(baca.halaman[hz - 1].lebar - 56.7, 0);
      // garis bawah (2 Nov): sampai dekat batas bawah AREA TEKS (margin bawah fixture 1701 twip), menyisakan ruang tanggal di atasnya
      const bawah = g.find((x) => Math.abs(x.y1 - x.y2) < 0.5 && x.x2 - x.x1 > 200 && Math.abs(x.y1 - (tinggi - 1701 / 20 - RUANG_TANGGAL_AREA_TEKS)) < 2.5);
      expect(bawah, `garis bawah tidak ditemukan; garis=${JSON.stringify(g)}`).toBeTruthy();
      // diagonal
      const diagonal = g.find((x) => Math.abs(x.y1 - x.y2) > 50);
      expect(diagonal).toBeTruthy();
      // tanggal tepat di bawah garis bawah, tidak menempel tepi kertas
      const tgl = [...baca.kata].reverse().find((x) => x.halaman === hz && x.norm === "oktober");
      expect(tgl).toBeTruthy();
      expect(tgl!.yDasar).toBeGreaterThan(bawah!.y1);
      expect(tgl!.yDasar - bawah!.y1).toBeLessThan(45);
      expect(tgl!.yDasar).toBeLessThan(tinggi - 1.0 * CM);
      // halaman berikutnya bernomor halaman Z (tampil) + jumlah halaman bukti
      const nomor = baca.kata.filter((x) => x.halaman === hz + 1);
      const teksHal = nomor.map((x) => x.t).join(" ");
      expect(teksHal, "kalimat bagian berikut harus di halaman sesudah Z").toContain("Selanjutnya");
      const idxHal = baca.kata.findIndex((x) => x.halaman === hz + 1 && x.norm === "halaman");
      expect(Number(baca.kata[idxHal + 1]?.t)).toBe(h.laporan.nomorBagianBerikut);
      // naskah tidak berubah
      expect(uraiRtf(hasilRtf).paragraf.map((p) => p.teks)).toEqual(uraiRtf(s).paragraf.map((p) => p.teks));
    });
  }

  it("RTF tanpa templat Z (bentuk dibuat baru) + kalimat jangkar penuh: kalimat dirapatkan, garis tetap sebaris", async () => {
    const s = buatBasRtf({ bukti: 3, isi: 2, hurufJangkarMono: 56 });
    const h = await sesuaikanZcross(bita(s), "rtf", { mesin, jumlahBukti: 3, tanggal: "29 Oktober 2026" });
    expect(h.laporan.diubah, JSON.stringify(h.laporan)).toBe(true);
    expect(h.laporan.dirapatkan).toBe(true);
    const pdf = await mesin.ubah(h.bita, "rtf", "pdf");
    writeFileSync(path.join(keluarRender, "rtf-kalimat-penuh.pdf"), pdf);
    const baca = await bacaKataPdf(pdf);
    const akhir = [...baca.kata].reverse().find((x) => x.norm === "berikut")!;
    const garis = (await bacaGarisPdf(pdf)).filter((x) => x.halaman === akhir.halaman);
    const atas = garis.find((x) => Math.abs(x.y1 - x.y2) < 0.5 && x.x2 - x.x1 > 40 && dalam(x.y1, akhir.yDasar - 12, akhir.yDasar + 1));
    expect(atas).toBeTruthy();
    expect(Math.max(atas!.x1, atas!.x2) - Math.min(atas!.x1, atas!.x2)).toBeGreaterThan(RUANG_MIN_GARIS_ATAS - 4);
    // tanggal yang diberikan tercetak
    expect(baca.kata.some((x) => x.halaman === akhir.halaman && x.norm === "oktober")).toBe(true);
  });

  it("DOCX: hasil konversi RTF -> DOCX disesuaikan (wp:anchor + pgNumType) dan dibuka ulang; DOC dari DOCX", async () => {
    const s = buatBasRtf({ bukti: 3, isi: 6, templatZ: true });
    const docx = await mesin.ubah(bita(s), "rtf", "docx");
    expect(kenaliBerkasWord(docx)).toBe("docx");
    const h = await sesuaikanZcross(docx, "docx", { mesin, jumlahBukti: 3, halamanBukti: [2, 1, 2] });
    expect(h.laporan.diubah, JSON.stringify(h.laporan)).toBe(true);
    const isi = bukaDocx(h.bita).xml;
    expect(isi).toContain("<wp:anchor");
    expect(isi).toContain('name="zcross-garis"');
    expect(isi).toContain('name="zcross-tanggal"');
    // bentuk templat lama (Word menulisnya sebagai VML id="FreeForm 3" / "Text Box 3") sudah dibuang, label "SC Z 1x" tinggal satu
    expect(isi).not.toMatch(/FreeForm/);
    expect((isi.match(/SC Z 1x/g) ?? []).length).toBe(1);
    expect(isi).toContain(`<w:pgNumType w:start="${h.laporan.nomorBagianBerikut}"/>`);
    expect(() => uraiXml(isi)).not.toThrow();
    writeFileSync(path.join(keluarRender, "docx-3-bukti.docx"), h.bita);
    const pdf = await mesin.ubah(h.bita, "docx", "pdf");
    writeFileSync(path.join(keluarRender, "docx-3-bukti.pdf"), pdf);
    const baca = await bacaKataPdf(pdf);
    const akhir = [...baca.kata].reverse().find((x) => x.norm === "berikut")!;
    const garis = (await bacaGarisPdf(pdf)).filter((x) => x.halaman === akhir.halaman);
    expect(garis.find((x) => Math.abs(x.y1 - x.y2) < 0.5 && x.x2 - x.x1 > 40 && dalam(x.y1, akhir.yDasar - 12, akhir.yDasar + 1))).toBeTruthy();
    const idxHal = baca.kata.findIndex((x) => x.halaman === akhir.halaman + 1 && x.norm === "halaman");
    expect(Number(baca.kata[idxHal + 1]?.t)).toBe(h.laporan.nomorBagianBerikut);

    // DOC (dari DOCX) lalu disesuaikan lagi: bentuk DOC kembali
    const doc = await mesin.ubah(h.bita, "docx", "doc");
    expect(kenaliBerkasWord(doc)).toBe("doc");
    const hd = await sesuaikanZcross(doc, "doc", { mesin, jumlahBukti: 3, halamanBukti: [2, 1, 2] });
    expect(hd.laporan.diubah, JSON.stringify(hd.laporan)).toBe(true);
    expect(kenaliBerkasWord(hd.bita)).toBe("doc");
    writeFileSync(path.join(keluarRender, "doc-3-bukti.doc"), hd.bita);
    const pdfDoc = await mesin.ubah(hd.bita, "doc", "pdf");
    writeFileSync(path.join(keluarRender, "doc-3-bukti.pdf"), pdfDoc);
    const bd = await bacaKataPdf(pdfDoc);
    expect(bd.kata.some((x) => x.norm === "oktober")).toBe(true);
  }, 240000);


  // BAS pembuktian SUNGGUHAN dari blangko Derry (salinan laptop). Variabel diisi teks contoh (pengganti render ABT: salinan DB belum ada
  // di sesi ini) - yang diuji: struktur blangko sungguhan (bentuk "SC Z 1x" + "FreeForm 3", header/footer, seksi, pgnstarts tetap).
  const BLANGKO = process.env.ZCROSS_BLANGKO_DIR || "D:/r148/_blangko_abt/derry_briantono";
  const BLANGKO_UJI = [
    { nama: "A cerai gugat sidang 6 pembuktian P", berkas: "1 Perceraian CG - BAS/BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf", bukti: 4 },
    { nama: "B cerai gugat sidang 7 pembuktian T", berkas: "1 Perceraian CG - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf", bukti: 2 },
    { nama: "C ekonomi syariah sidang 2", berkas: "10 Ekonomi Syariah - BAS/BAS ALUR 40 ES GS - [2] Sidang 2 - P & T Hadir - Pembuktian, Tunda Putusan.rtf", bukti: 3 },
  ];
  for (const k of BLANGKO_UJI) {
    it.skipIf(!existsSync(path.join(BLANGKO, k.berkas)))(`blangko Derry sungguhan ${k.nama}: Z sebaris, bentuk lama diganti, nomor halaman seksi berikut ditulis`, async () => {
      const s = isiBlangko(readFileSync(path.join(BLANGKO, k.berkas)).toString("latin1"), k.bukti);
      const h = await sesuaikanZcross(bita(s), "rtf", { mesin, jumlahBukti: k.bukti, halamanBukti: Array.from({ length: k.bukti }, () => 2), hanyaBentuk: true });
      expect(h.laporan.diubah, JSON.stringify(h.laporan)).toBe(true);
      expect(h.laporan.seksi).toBe("dipakai");
      const hasil = lat1(h.bita);
      expect(seimbang(hasil)).toBe(true);
      expect(hasil).not.toContain("FreeForm");
      expect((hasil.match(/zcross-garis/g) ?? []).length).toBe(1);
      expect((hasil.match(/SC Z 1x/g) ?? []).length).toBe(1);
      expect(hasil).toContain(`\\pgnstarts${h.laporan.nomorBagianBerikut}`);
      expect(h.laporan.nomorBagianBerikut).toBe((h.laporan.halamanTampilZ ?? 0) + k.bukti * 2 + 1);
      mkdirSync(keluarRender, { recursive: true });
      const pdf = await mesin.ubah(h.bita, "rtf", "pdf");
      writeFileSync(path.join(keluarRender, `blangko-${k.nama.slice(0, 1)}.pdf`), pdf);
      writeFileSync(path.join(keluarRender, `blangko-${k.nama.slice(0, 1)}.rtf`), h.bita);
      const baca = await bacaKataPdf(pdf);
      // kata "berikut" TERAKHIR pada halaman Z (blangko memuat kalimat lain bertanda "berikut" di halaman sesudahnya)
      const akhir = [...baca.kata].reverse().find((x) => x.norm === "berikut" && x.halaman === h.laporan.halamanFisikZ)!;
      expect(akhir).toBeTruthy();
      const g = (await bacaGarisPdf(pdf)).filter((x) => x.halaman === akhir.halaman);
      expect(g.find((x) => Math.abs(x.y1 - x.y2) < 0.5 && x.x2 - x.x1 > 40 && dalam(x.y1, akhir.yDasar - 12, akhir.yDasar + 1) && Math.min(x.x1, x.x2) >= akhir.x2 - 0.5)).toBeTruthy();
      const tinggi = baca.halaman[akhir.halaman - 1].tinggi;
      // 2 Nov: garis bawah sampai dekat batas bawah AREA TEKS (margin bawah seksi blangko), menyisakan ruang dua baris tanggal -
      // sama dengan uji bentuk sintetis di atas; dulu jarak tetap 3 cm dari tepi kertas.
      const margbTwip = Number((hasil.match(/\\margbsxn(\d+)/) ?? hasil.match(/\\margb(\d+)/) ?? [])[1] ?? 1440);
      const yBawah = tinggi - margbTwip / 20 - RUANG_TANGGAL_AREA_TEKS;
      expect(g.find((x) => Math.abs(x.y1 - x.y2) < 0.5 && x.x2 - x.x1 > 200 && Math.abs(x.y1 - yBawah) < 2.5), `garis=${JSON.stringify(g)}`).toBeTruthy();
    }, 180000);
  }

  it("DOCX tanpa pemisah seksi: pemisah halaman disisipkan, nomor halaman berlaku di halaman sesudah Z; penyesuaian ulang tidak menumpuk", async () => {
    const s = buatBasRtf({ bukti: 2, isi: 5, templatZ: true, tanpaPemisah: true });
    const docx = await mesin.ubah(bita(s), "rtf", "docx");
    const opsi = { mesin, jumlahBukti: 2, halamanBukti: [1, 2], tanggal: "29 Oktober 2026" };
    const h = await sesuaikanZcross(docx, "docx", opsi);
    expect(h.laporan.diubah, JSON.stringify(h.laporan)).toBe(true);
    expect(h.laporan.seksi).toBe("disisipkan");
    const x1 = bukaDocx(h.bita).xml;
    expect(x1).toContain(`<w:pgNumType w:start="${h.laporan.nomorBagianBerikut}"/>`);
    expect(() => uraiXml(x1)).not.toThrow();
    const pdf = await mesin.ubah(h.bita, "docx", "pdf");
    writeFileSync(path.join(keluarRender, "docx-sisip-seksi.pdf"), pdf);
    const baca = await bacaKataPdf(pdf);
    const hz = h.laporan.halamanFisikZ!;
    const berikut = baca.kata.filter((x) => x.halaman === hz + 1);
    expect(berikut.map((x) => x.t).join(" ")).toContain("Selanjutnya");
    const idx = baca.kata.findIndex((x) => x.halaman === hz + 1 && x.norm === "halaman");
    expect(Number(baca.kata[idx + 1]?.t)).toBe(h.laporan.nomorBagianBerikut);
    // dijalankan ulang pada hasilnya
    const h2 = await sesuaikanZcross(h.bita, "docx", opsi);
    const x2 = bukaDocx(h2.bita).xml;
    expect((x2.match(/name="zcross-garis"/g) ?? []).length).toBe(1);
    expect((x2.match(/name="zcross-tanggal"/g) ?? []).length).toBe(1);
    expect(h2.laporan.nomorBagianBerikut).toBe(h.laporan.nomorBagianBerikut);
  }, 240000);

  it("keluaran PDF langsung dari RTF yang disesuaikan", async () => {
    const s = buatBasRtf({ bukti: 2, isi: 4, templatZ: true });
    const h = await sesuaikanZcross(bita(s), "rtf", { mesin, keluar: "pdf", jumlahBukti: 2 });
    expect(h.bentuk).toBe("pdf");
    expect(Buffer.from(h.bita.subarray(0, 5)).toString()).toBe("%PDF-");
    const garis = await bacaGarisPdf(h.bita);
    expect(garis.some((x) => x.x2 - x.x1 > 200 && Math.abs(x.y1 - x.y2) < 0.5)).toBe(true);
  }, 120000);
});
