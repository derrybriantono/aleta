// @vitest-environment node
/**
 * ============================================================================
 * AGEN W2b-C (21 Okt 2026) - BANK TANYA JAWAB SAKSI PENGANGKATAN ANAK
 * (mafqud dan permohonan umum: w2b-lain-katalog-mu-21okt.test.ts)
 * ============================================================================
 *
 * Perilaku yang dijaga (mesin katalog + pembungkus Blangko Derry dijalankan SUNGGUHAN, murni tanpa DOM):
 *   1. yang sudah ada tidak dihapus (butir, pokok, dasar hukum, keadaan), isinya identik, dan versi katalog naik satu;
 *   2. butir baru (>= 40) hanya muncul pada keadaan yang tepat: pemohon seorang diri atau berdua, keadaan orang tua kandung,
 *      anak kandung pemohon, kerabat atau bukan kerabat, izin instansi sosial;
 *   3. jawaban memuat fakta isian perkara (penanda terisi) dan kalimat saksi 1 dan saksi 2 berbeda pada semua tingkat pengetahuan;
 *   4. berkas data ekstensi sinkron dengan JSON dan variabel baru 4910-4915 dideklarasikan.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const EK = path.join(REPO, "ekstensi-sipp");
const FOLDER = path.join(EK, "saksi-katalog");
const CAD = path.join(REPO, "abt-paket/w2b-keluarga-lain/cadangan-katalog");
const req = createRequire(import.meta.url);
const muat = (dir: string, n: string) => JSON.parse(readFileSync(path.join(dir, n), "utf8"));

const semua = readdirSync(FOLDER).filter((n) => n.endsWith(".json")).map((n) => muat(FOLDER, n));
(globalThis as any).ALETA_SAKSI_KATALOG_DATA = semua;
req(path.join(EK, "saksi-katalog.js"));
const Bd = req(path.join(EK, "blangko-derry-katalog.js"));

const PA = semua.find((k: any) => k.kunci === "pengangkatan-anak");
const BARU = (PA.pertanyaan as any[]).filter((q) => /^q-pa-/.test(q.id));

type Opsi = { keadaan?: Record<string, any>; saksi?: any[]; variabel?: Record<string, string>; jarang?: boolean };
function susun(o: Opsi = {}) {
  const hasil = Bd.susun({
    kat: PA,
    sebutan: { P: "Pemohon", T: "Termohon" },
    benih: "uji/Pdt.P/2026/PA.Dgl",
    keadaan: Bd.lengkapiBawaan(PA, o.keadaan || {}),
    saksi: o.saksi || [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }],
    variabel: (k: string) => (o.variabel || {})[k],
    jarang: o.jarang,
  });
  expect(hasil.ada).toBe(true);
  return hasil;
}
const idBaris = (h: any, ke = 0) => h.saksi[ke].baris.map((b: any) => b.butir) as string[];
const baris = (h: any, id: string, ke = 0) => h.saksi[ke].baris.find((b: any) => b.butir === id);

const VAR: Record<string, string> = {
  "7036": "Para Pemohon", "8602": "Syalun Mawadah", "8618": "Gorontalo pada tanggal 01 Februari 2010", "8619": "Moh. Ihsan Lareke bin Daud Lareke dan Almh. Nurfin",
  "8622": "suami istri", "8623": "paman", "0100": "Wiraswasta", "4910": "tahun 2017", "4911": "ibu anak itu telah meninggal dunia dan ayahnya tidak mampu mengasuh",
  "4912": "dilangsungkan pada tanggal 12 Februari 2004 dan telah dikaruniai satu orang anak", "4913": "izin pengasuhan dari Dinas Sosial Provinsi Sulawesi Tengah Nomor 188.4/176/SK/Yanlu/XI/2021",
  "4914": "sebesar Rp30.000.000,00 per tahun", "4915": "kelanjutan pendidikan, kesehatan, dan masa depan anak",
};

describe("katalog lama tidak dikurangi", () => {
  it("butir, pokok, dasar hukum, dan keadaan lama utuh dan identik; versi naik satu", () => {
    const lama = muat(CAD, "pengangkatan-anak.json");
    expect(lama.pertanyaan.length).toBe(24);
    const ids = new Set(PA.pertanyaan.map((q: any) => q.id));
    for (const q of lama.pertanyaan) expect(ids.has(q.id), `kehilangan ${q.id}`).toBe(true);
    for (const p of lama.pokokPembuktian) expect(JSON.stringify(PA.pokokPembuktian.find((x: any) => x.id === p.id))).toBe(JSON.stringify(p));
    for (const d of lama.dasarHukum) expect(JSON.stringify(PA.dasarHukum.find((x: any) => x.id === d.id))).toBe(JSON.stringify(d));
    for (const k of Object.keys(lama.keadaan)) expect(JSON.stringify(PA.keadaan[k])).toBe(JSON.stringify(lama.keadaan[k]));
    for (const q of lama.pertanyaan) expect(JSON.stringify(PA.pertanyaan.find((x: any) => x.id === q.id))).toBe(JSON.stringify(q));
    expect(PA.versi).toBe(lama.versi + 1);
  });
  it("butir baru berjumlah sedikitnya 40, pokok baru dan dasar hukum baru bertanda status", () => {
    expect(BARU.length).toBeGreaterThanOrEqual(40);
    const lama = muat(CAD, "pengangkatan-anak.json");
    const idLama = new Set(lama.dasarHukum.map((d: any) => d.id));
    const dasarBaru = PA.dasarHukum.filter((d: any) => !idLama.has(d.id));
    expect(dasarBaru.length).toBeGreaterThanOrEqual(4);
    for (const d of dasarBaru) expect(["terverifikasi", "perlu-verifikasi"]).toContain(d.status);
    expect(PA.pokokPembuktian.filter((p: any) => /^pp-aa-/.test(p.id)).length).toBeGreaterThanOrEqual(20);
  });
  it("tanpa kata aleta dan rujukan perlu-verifikasi tidak tercetak di teks keluaran", () => {
    const teks = JSON.stringify(PA);
    expect(teks).not.toMatch(/aleta/i);
    const keluaran = JSON.stringify(PA.pertanyaan.map((q: any) => [q.teks, q.teksVarian, q.jawaban]));
    for (const d of PA.dasarHukum.filter((x: any) => x.status === "perlu-verifikasi")) expect(keluaran.toLowerCase()).not.toContain(d.rujukan.toLowerCase());
  });
});

describe("butir baru muncul menurut keadaan", () => {
  it("pemohon berdua (bawaan) menanyakan riwayat perkawinan dan kesepakatan suami istri, bukan status seorang diri", () => {
    const h = susun({ variabel: VAR, jarang: true });
    expect(idBaris(h)).toEqual(expect.arrayContaining(["q-pa-riwayat-kawin-aa", "q-pa-setuju-pasangan-aa"]));
    expect(idBaris(h)).not.toContain("q-pa-status-sendiri-aa");
    expect(baris(h, "q-pa-riwayat-kawin-aa").jawab).toContain("12 Februari 2004");
  });
  it("pemohon seorang diri menanyakan status dan siapa yang membantu mengasuh", () => {
    const h = susun({ keadaan: { pemohonPerkawinan: "sendiri" }, variabel: { ...VAR, "8622": "seorang duda" }, jarang: true });
    expect(idBaris(h)).toEqual(expect.arrayContaining(["q-pa-status-sendiri-aa", "q-pa-pembantu-asuh-aa"]));
    expect(idBaris(h)).not.toContain("q-pa-riwayat-kawin-aa");
    expect(baris(h, "q-pa-status-sendiri-aa").jawab).toContain("seorang duda");
  });
  it("keadaan orang tua kandung: meninggal, kedua meninggal, atau tidak diketahui mengganti butir penyerahan", () => {
    const lengkap = idBaris(susun({ variabel: VAR, jarang: true }));
    expect(lengkap).toEqual(expect.arrayContaining(["q-pa-sebab-serah-aa", "q-pa-surat-serah-aa"]));
    expect(lengkap).not.toContain("q-pa-ortu-meninggal-aa");
    const satu = idBaris(susun({ keadaan: { orangTuaKandung: "salah-satu-meninggal" }, variabel: VAR, jarang: true }));
    expect(satu).toEqual(expect.arrayContaining(["q-pa-ortu-meninggal-aa", "q-pa-sebab-serah-aa"]));
    const dua = idBaris(susun({ keadaan: { orangTuaKandung: "kedua-meninggal" }, variabel: VAR, jarang: true }));
    expect(dua).toEqual(expect.arrayContaining(["q-pa-ortu-meninggal-aa", "q-pa-wali-yatim-aa"]));
    expect(dua).not.toContain("q-pa-sebab-serah-aa");
    const tak = idBaris(susun({ keadaan: { orangTuaKandung: "tidak-diketahui" }, variabel: VAR, jarang: true }));
    expect(tak).toEqual(expect.arrayContaining(["q-pa-ditemukan-aa", "q-pa-upaya-cari-ortu-aa"]));
    expect(tak).not.toContain("q-pa-sebab-serah-aa");
  });
  it("kerabat atau bukan kerabat: butir hubungan darah atau cara mengenal anak", () => {
    const kerabat = susun({ variabel: VAR });
    expect(idBaris(kerabat)).toContain("q-pa-hubungan-darah-aa");
    expect(idBaris(kerabat)).not.toContain("q-pa-kenal-bukan-kerabat-aa");
    expect(baris(kerabat, "q-pa-hubungan-darah-aa").jawab).toContain("paman");
    const bukan = susun({ keadaan: { hubunganPemohon: "bukan-keluarga" }, variabel: VAR });
    expect(idBaris(bukan)).toContain("q-pa-kenal-bukan-kerabat-aa");
    expect(idBaris(bukan)).not.toContain("q-pa-hubungan-darah-aa");
  });
  it("anak kandung pemohon: ada atau belum ada; izin instansi sosial berlaku atau tidak", () => {
    expect(idBaris(susun({ variabel: VAR, jarang: true }))).toContain("q-pa-anak-kandung-belum-aa");
    expect(idBaris(susun({ keadaan: { anakKandungPemohon: "ada" }, variabel: VAR, jarang: true }))).toContain("q-pa-anak-kandung-ada-aa");
    const izin = susun({ variabel: VAR, jarang: true });
    expect(idBaris(izin)).toContain("q-pa-izin-asuh-aa");
    expect(baris(izin, "q-pa-izin-asuh-aa").jawab).toContain("188.4/176/SK/Yanlu/XI/2021");
    expect(idBaris(susun({ keadaan: { izinInstansiSosial: "tidak-berlaku" }, variabel: VAR, jarang: true }))).not.toContain("q-pa-izin-asuh-aa");
  });
  it("jumlah butir per saksi naik dibanding katalog lama pada keadaan bawaan", () => {
    const lama = muat(CAD, "pengangkatan-anak.json");
    const hitung = (kat: any) =>
      Bd.susun({ kat, sebutan: { P: "Pemohon", T: "Termohon" }, benih: "uji", keadaan: Bd.lengkapiBawaan(kat, {}), saksi: [{ kunci: "saksi 1 p", pihak: "P" }], variabel: () => undefined, jarang: true }).saksi[0].baris.length;
    expect(hitung(PA)).toBeGreaterThan(hitung(lama) + 10);
  });
});

describe("kalimat saksi dan tingkat pengetahuan", () => {
  it("saksi 1 dan saksi 2 berbeda dan masing-masing sedikitnya 4 kalimat pada semua tingkat butir baru", () => {
    for (const q of BARU) {
      for (const [jenis, v] of Object.entries(q.jawaban) as [string, any][]) {
        for (const x of Array.isArray(v) ? v : [v]) {
          expect(x.saksi1.length, `${q.id}/${jenis}`).toBeGreaterThanOrEqual(4);
          expect(x.saksi2.length, `${q.id}/${jenis}`).toBeGreaterThanOrEqual(4);
          if (jenis !== "berbeda") for (const a of x.saksi1) for (const b of x.saksi2) expect(a, `${q.id}/${jenis}`).not.toBe(b);
        }
      }
    }
  });
  it("tingkat melihat, dari cerita, mendengar, sebagian, tidak tahu, dan ragu menghasilkan jawaban yang berbeda untuk dua saksi", () => {
    for (const jenis of ["melihat", "de-auditu", "mendengar", "sebagian", "tidak-tahu", "ragu"]) {
      const h = susun({ variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", jenis, sumber: "tetangga" }, { kunci: "saksi 2 p", pihak: "P", jenis, sumber: "keluarga" }] });
      for (const id of ["q-pa-penghasilan-aa", "q-pa-kesehatan-anak-aa", "q-pa-nasab-tetap-aa"]) {
        const a = baris(h, id).jawab;
        const b = baris(h, id, 1).jawab;
        expect(a.length, `${id}/${jenis}`).toBeGreaterThan(10);
        expect(a, `${id}/${jenis}`).not.toBe(b);
      }
    }
  });
  it("jawaban memuat fakta isian perkara (tujuan, penghasilan, alasan penyerahan)", () => {
    const h = susun({ variabel: VAR, jarang: true });
    expect(baris(h, "q-pa-penghasilan-aa").jawab).toContain("Rp30.000.000,00");
    expect(baris(h, "q-pa-rencana-masa-depan-aa").jawab).toContain("kelanjutan pendidikan");
    expect(baris(h, "q-pa-sebab-serah-aa").jawab).toContain("ibu anak itu telah meninggal dunia");
  });
});

describe("data ekstensi sinkron dengan JSON", () => {
  it("saksi-katalog-data.js memuat butir baru dan variabel baru 4910-4915 dideklarasikan", () => {
    const data = readFileSync(path.join(EK, "saksi-katalog-data.js"), "utf8");
    for (const id of ["q-pa-penghasilan-aa", "q-pa-status-sendiri-aa", "q-pa-ditemukan-aa", "q-pa-wali-nikah-aa"]) expect(data).toContain(`"${id}"`);
    expect(PA.variabelBaru).toEqual(expect.arrayContaining(["4910", "4911", "4912", "4913", "4914", "4915"]));
  });
});
