// @vitest-environment node
/**
 * ============================================================================
 * AUDIT 4 NOV 2026 (perbaikan C2) - LABEL PANEL "PERLU DIISI" BLANGKO DERRY
 * ============================================================================
 *
 *   A. Nama ABT "JUDUL PAKET: RINCIAN ..." berlabel "Judul: rincian", bukan judul saja (A2-09). Label lain (6 kasus
 *      uji lama rapikanNama) tidak berubah; variabel otomatis/pemicu tetap memakai rapikanNama.
 *   B. Satu blangko contoh (sampul 99 PTSP, putusan hak asuh/izin poligami) tidak lagi memuat label kembar.
 *   C. Label teknis A2-10 (#2026#, kurung terbuka "(isian", huruf besar) lewat peta label RAMAH.
 *   D. Ciri sampul #5807#-#5821# (isian) bukan bagian "Perlu diisi" - golongan "tambahan" di layar (A2-14).
 *   E. muatIndeks ekstensi: hasil GAGAL tidak ditembolok, dicoba lagi; hasil berhasil tetap diingat (A1-09).
 *
 * Hanya tampilan: kode isian, urutan, dan medan lain tidak berubah (dibandingkan untuk semua blangko di
 * D:/aleta-dev/kerja/audit-abt-4nov/C2/label-sebelum-sesudah.csv). Data rekaan; tanpa jaringan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";

import { ISIAN_OPSIONAL } from "@/app/api/aleta-ecourt/blangko-derry/isian-metadata";
import { rapikanNama, rapikanNamaIsian, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const JS_ISIAN = readFileSync(path.join(EKSTENSI, "blangko-derry-isian.js"), "utf8").replace(/\r\n/g, "\n");

const teks = (kode: string, nama: string): Definisi => ({ kode, nama, jenis: "data_teks", sql: "", bawaan: "" });
const katalog = (...d: Definisi[]) => new Map(d.map((x) => [x.kode, x]));
const label = (penanda: string[], kat: Map<string, Definisi>, sebutan?: { P: string; T: string; gugatan?: string }) =>
  new Map(susunIsian(penanda, kat, sebutan).isian.map((b) => [b.kode, b.nama]));

const CIRI = katalog(
  teks("5807", "CIRI SAMPUL: GHAIB (ISIAN OTOMATIS dari panel; kosong = tidak berlaku; contoh isi: GHAIB T)"),
  teks("5808", "CIRI SAMPUL: MAFQUD (ISIAN OTOMATIS dari panel; kosong = tidak berlaku; contoh isi: MAFQUD T)"),
  teks("5809", "CIRI SAMPUL: PNS/ASN (ISIAN OTOMATIS dari panel; kosong = tidak berlaku; contoh isi: PNS/ASN T)"),
  teks("5810", "CIRI SAMPUL: PPPK (ISIAN OTOMATIS dari panel; kosong = tidak berlaku; contoh isi: PPPK T)"),
  teks("5811", "CIRI SAMPUL: TNI (ISIAN OTOMATIS dari panel; kosong = tidak berlaku; contoh isi: TNI T)"),
  teks("5812", "CIRI SAMPUL: POLRI (ISIAN OTOMATIS dari panel; kosong = tidak berlaku; contoh isi: POLRI T)"),
  teks("5813", "CIRI SAMPUL: BUMN/BUMD (ISIAN OTOMATIS dari panel; kosong = tidak berlaku; contoh isi: BUMN/BUMD T)"),
  teks("5815", "CIRI SAMPUL: PENERJEMAH (ISIAN TANGAN; isi PENERJEMAH bila perlu penerjemah/juru bahasa; kosong = tidak ada)"),
  teks("5819", "CIRI SAMPUL: REKONVENSI (ISIAN OTOMATIS dari panel; kosong = tidak berlaku)"),
  teks("5821", "CIRI SAMPUL: SITA (ISIAN OTOMATIS dari panel; SIPP tidak mencatat sita di proses; kosong = tidak berlaku)")
);
const KODE_CIRI = [...CIRI.keys()];

describe("A. label 'Judul: rincian'", () => {
  it("ciri sampul, izin poligami, hak asuh, intervensi berlabel judul + rincian", () => {
    const l = label(KODE_CIRI, CIRI);
    expect(l.get("5807")).toBe("Ciri sampul: ghaib");
    expect(l.get("5809")).toBe("Ciri sampul: PNS/ASN");
    expect(l.get("5811")).toBe("Ciri sampul: TNI");
    expect(l.get("5815")).toBe("Ciri sampul: penerjemah");
    expect(rapikanNamaIsian("IZIN POLIGAMI: STATUS CALON ISTRI KEDUA (pilihan: perawan | janda cerai | janda ditinggal mati suami)")).toBe(
      "Izin poligami: status calon istri kedua"
    );
    expect(rapikanNamaIsian('HAK ASUH: KELAYAKAN CALON PEMEGANG HADHANAH - ISIAN fakta jasmani, rohani; sesudah kata "fakta bahwa"')).toBe(
      "Hak asuh: kelayakan calon pemegang hadhanah"
    );
    expect(rapikanNamaIsian("MEDIASI TIDAK BERIKTIKAD BAIK: HURUF PASAL 7 AYAT (2) PERMA 1/2016 - ISIAN (a / b / c / d / e)")).toBe(
      "Mediasi tidak beriktikad baik: huruf pasal 7 ayat (2) PERMA 1/2016"
    );
  });

  it("sebutan pihak di rincian mengikuti perkara", () => {
    const nama = "PERWALIAN: HUBUNGAN #0046# DENGAN ANAK - ISIAN (frasa benda, mis. bibi)";
    expect(rapikanNamaIsian(nama)).toBe("Perwalian: hubungan Penggugat/Pemohon dengan anak");
    expect(rapikanNamaIsian(nama, { P: "Pemohon", T: "Termohon" })).toBe("Perwalian: hubungan Pemohon dengan anak");
    expect(rapikanNamaIsian("INTERVENSI: TANGGAPAN #0046# DAN #0047# - ISIAN (sikap para pihak)", { P: "Penggugat", T: "Tergugat" })).toBe(
      "Intervensi: tanggapan Penggugat dan Tergugat"
    );
  });

  it("kasus uji lama rapikanNama tidak berubah lewat label isian", () => {
    const KASUS: Array<[string, string, { P: string; T: string }?]> = [
      ["TANGGAL PENGUMUMAN PANGGILAN GHAIB I DAN II - ISIAN bila SIPP tidak memuat (contoh: 22 Januari 2026)", "Tanggal pengumuman panggilan ghaib I dan II"],
      ["PENGADILAN TINGGI TEMPAT ADVOKAT #0046# DISUMPAH (kosong = Pengadilan Tinggi Sulawesi Tengah), contoh: PT Sulsel", "Pengadilan tinggi tempat advokat Penggugat disumpah", { P: "Penggugat", T: "Tergugat" }],
      ["NOMOR KTP PEMOHON (KOSONG = DARI SIPP)", "Nomor KTP pemohon"],
      ["Kantor Kuasa #0046# (nama kantor di surat kuasa/gugatan, mis. DERRY & PARTNERS) #11111#", "Kantor Kuasa Pemohon", { P: "Pemohon", T: "Termohon" }],
      ["ALASAN PERCERAIAN <br>SATU HURUF: A, B, C", "Alasan perceraian satu huruf"],
      ["Awal Konflik : bulan _ / tahun _ / awal tahun / akhir tahun / tanggal _", "Awal Konflik"],
    ];
    for (const [n, harap, s] of KASUS) {
      expect(rapikanNamaIsian(n, s)).toBe(harap);
      expect(rapikanNama(n, s)).toBe(harap);
    }
  });

  it("variabel otomatis tetap memakai label lama (rapikanNama)", () => {
    const kat = katalog({ kode: "5802", nama: "CIRI SAMPUL: PRODEO (OTOMATIS; kosong = tidak berlaku)", jenis: "data_sql", sql: "SELECT 1", bawaan: "" });
    const s = susunIsian(["5802"], kat);
    expect(s.otomatis.map((o) => o.nama)).toEqual(["Ciri sampul"]);
  });
});

describe("B. blangko contoh tanpa label kembar", () => {
  it("sampul 99 PTSP: sepuluh ciri sampul, sepuluh label berbeda", () => {
    const nama = [...label(KODE_CIRI, CIRI).values()];
    expect(nama).toHaveLength(10);
    expect(new Set(nama.map((n) => n.toLowerCase())).size).toBe(10);
  });

  it("putusan izin poligami: tujuh isian, tujuh label berbeda", () => {
    const kat = katalog(
      teks("4850", "IZIN POLIGAMI: SURAT PERSETUJUAN TERTULIS ISTRI (tanggal dan keterangan singkat, contoh: tanggal 12 Agustus 2026)"),
      teks("4851", "IZIN POLIGAMI: ALASAN KEBERATAN ISTRI (hanya bila Termohon keberatan)"),
      teks("4852", "IZIN POLIGAMI: KEADAAN ISTRI TIDAK MUNGKIN DIMINTAI PERSETUJUAN (contoh: menderita gangguan jiwa berat)"),
      teks("4853", "IZIN POLIGAMI: BENTUK PERSETUJUAN ISTRI (pilihan: secara tertulis maupun lisan di persidangan)"),
      teks("4854", "IZIN POLIGAMI: STATUS CALON ISTRI KEDUA (pilihan: perawan | janda cerai | janda ditinggal mati suami)"),
      teks("4855", "IZIN POLIGAMI: BUKTI STATUS JANDA CALON ISTRI KEDUA (contoh: Akta Cerai Nomor 152/AC/2025/PA.Dgl)"),
      teks("4856", "IZIN POLIGAMI: JUMLAH ISTRI PEMOHON SAAT INI (contoh: seorang yaitu Termohon)")
    );
    const nama = [...label([...kat.keys()], kat).values()];
    expect(nama).toHaveLength(7);
    expect(new Set(nama.map((n) => n.toLowerCase())).size).toBe(7);
    for (const n of nama) expect(n.startsWith("Izin poligami: ")).toBe(true);
  });
});

describe("C. label teknis A2-10 lewat peta label", () => {
  it("tanpa #kode#, tanpa kurung terbuka, tanpa huruf besar seluruhnya", () => {
    const kat = katalog(
      { kode: "1246", nama: "Tanggal meninggalnya #2026#", jenis: "data_tanggal", sql: "", bawaan: "" },
      teks("1247", "Sebab meninggalnya #2026#"),
      teks("7084", "PENANDA KONVENSI/REKONVENSI (1 apabila ada)"),
      teks("9881", "lisan atau tertulis (jawaban replik dan duplik)"),
      teks("9650", "GUGATAN DITOLAK - ALASAN TIDAK TERBUKTI (isian: fakta/bukti yang tidak terbukti, satu kalimat tanpa titik akhir)"),
      teks("9651", "NO - CACAT FORMIL GUGATAN (isian: mis. gugatan kabur karena objek sengketa tidak jelas batas-batasnya)"),
      teks("9654", "PERMOHONAN DITOLAK - FAKTA/ALASAN TIDAK TERBUKTI (isian: uraian singkat apa yang tidak terbukti)"),
      teks("9681", "EKSEPSI KEWENANGAN - ISI EKSEPSI TERGUGAT/TERMOHON (isian: uraian pokok eksepsi, satu kalimat tanpa titik akhir)"),
      teks("9711", 'NAFKAH MADLIYAH (cerai gugat) - ISIAN: jumlah dan rinciannya, mis. "Rp6.000.000,00"; kosong bila tidak dikabulkan'),
      teks("9712", 'NAFKAH IDDAH (cerai gugat) - ISIAN: jumlah dan rinciannya, mis. "Rp4.500.000,00"; kosong bila tidak dikabulkan'),
      teks("9713", 'MUT\'AH (cerai gugat) - ISIAN: jumlah atau bentuknya, mis. "uang sejumlah Rp3.000.000,00"; kosong bila tidak dikabulkan')
    );
    const l = label([...kat.keys()], kat, { P: "Penggugat", T: "Tergugat" });
    expect(l.get("1246")).toBe("Tanggal meninggalnya almarhum/almarhumah");
    expect(l.get("9681")).toBe("Eksepsi kewenangan: isi eksepsi Tergugat");
    for (const [kode, n] of l) {
      expect(n, kode).not.toMatch(/#\d{4,5}#/);
      expect(n, kode).not.toMatch(/\(isian/i);
      expect((n.match(/\(/g) || []).length, kode).toBe((n.match(/\)/g) || []).length);
      expect(n, kode).not.toMatch(/[A-Z]{5,}/);
      // kata yang membuat kotak isian lebar / dijaga bentuk periode di ekstensi tidak ikut masuk lewat label baru
      expect(n, kode).not.toMatch(/rincian|uraian|pertimbangan|penilaian|awal konflik|puncak|pisah rumah sejak/i);
    }
  });
});

describe("D. ciri sampul bukan bagian 'Perlu diisi'", () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/lain/", runScripts: "outside-only" });
  const w = dom.window as unknown as { eval: (s: string) => void; aletaBlangkoDerryIsian: any; chrome: unknown };
  w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } }, runtime: { id: "uji" } };
  w.eval(readFileSync(path.join(EKSTENSI, "blangko-derry.js"), "utf8"));
  w.eval(JS_ISIAN);
  afterAll(() => dom.window.close());

  it("isian ciri sampul #5807#-#5821# opsional; layar menggolongkannya 'tambahan'", () => {
    const s = susunIsian(KODE_CIRI, CIRI);
    expect(s.isian).toHaveLength(10);
    const ctx = { menyala: () => false, terisi: () => false, perkara: {}, opsional: (b: { opsional?: boolean }) => b.opsional === true };
    for (const b of s.isian) {
      expect(ISIAN_OPSIONAL[b.kode], b.kode).toBeTruthy();
      expect(b.opsional, b.kode).toBe(true);
      expect(w.aletaBlangkoDerryIsian.murni.golonganIsianMurni(b, ctx), b.kode).toBe("tambahan");
    }
  });

  it("isian lain tetap di 'Perlu diisi' (utama)", () => {
    const kat = katalog(teks("4854", "IZIN POLIGAMI: STATUS CALON ISTRI KEDUA (pilihan: perawan | janda cerai)"));
    const b = susunIsian(["4854"], kat).isian[0];
    expect(b.opsional).toBe(true); // sudah opsional sejak 21 Okt - tidak berubah
    const kat2 = katalog(teks("9681", "EKSEPSI KEWENANGAN - ISI EKSEPSI TERGUGAT/TERMOHON (isian: uraian pokok eksepsi)"));
    const b2 = susunIsian(["9681"], kat2).isian[0];
    expect(b2.opsional).toBeFalsy();
    const ctx = { menyala: () => false, terisi: () => false, perkara: {}, opsional: (x: { opsional?: boolean }) => x.opsional === true };
    expect(w.aletaBlangkoDerryIsian.murni.golonganIsianMurni(b2, ctx)).toBe("utama");
  });
});

describe("E. muatIndeks: hasil gagal tidak ditembolok", () => {
  /** Fungsi muatIndeks dari berkas ekstensi yang asli, dijalankan dengan S/ambilPortal rekaan. */
  function muatIndeksAsli(ambilPortal: (alamat: string) => Promise<unknown>) {
    const awal = JS_ISIAN.indexOf("  async function muatIndeks() {");
    expect(awal).toBeGreaterThan(0);
    const akhir = JS_ISIAN.indexOf("\n  }\n", awal);
    const sumber = JS_ISIAN.slice(awal, akhir + 4);
    const S: { indeks: any } = { indeks: null };
    const f = new Function("S", "ambilPortal", "API_BLANGKO", `${sumber}\nreturn muatIndeks;`)(S, ambilPortal, "/api/blangko") as () => Promise<any>;
    return { S, muatIndeks: f };
  }

  it("gagal sekali lalu berhasil: panggilan kedua memulangkan indeks", async () => {
    let n = 0;
    const indeks = { ada: true, folder: [{ nama: "1 Cerai Gugat", berkas: ["[01] Format Lengkap.rtf"] }] };
    const { S, muatIndeks } = muatIndeksAsli(async () => {
      n += 1;
      if (n === 1) throw new Error("Membaca daftar folder blangko gagal (kode 502).");
      return indeks;
    });
    const a = await muatIndeks();
    expect(a.ada).toBe(false);
    expect(a.sebab).toContain("502");
    expect(S.indeks.sebab).toContain("502"); // pesan galat pemanggil tetap membaca sebabnya
    const b = await muatIndeks();
    expect(b).toBe(indeks);
    expect(n).toBe(2);
  });

  it("berhasil: diingat, tidak dibaca ulang (jalur lama)", async () => {
    let n = 0;
    const indeks = { ada: true, folder: [] };
    const { muatIndeks } = muatIndeksAsli(async () => {
      n += 1;
      return indeks;
    });
    expect(await muatIndeks()).toBe(indeks);
    expect(await muatIndeks()).toBe(indeks);
    expect(n).toBe(1);
  });

  it("jawaban server ada:false (bukan galat) tetap diingat seperti dulu", async () => {
    let n = 0;
    const { muatIndeks } = muatIndeksAsli(async () => {
      n += 1;
      return { ada: false, folder: [] };
    });
    await muatIndeks();
    await muatIndeks();
    expect(n).toBe(1);
  });
});
