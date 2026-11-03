// @vitest-environment node
/**
 * ============================================================================
 * 3 NOV 2026 - DAFTAR BUKTI SATU BUKTI SATU BARIS (laporan Derry, itsbat 232/Pdt.P/2026/PA.Dgl)
 * ============================================================================
 *
 * Isian "Alat bukti surat itsbat nikah" (#9958#) tersimpan di ABT sebagai SATU baris: "... lalu oleh Ketua Majelis diberi tanda P.1 serta
 * diberi tanggal dan paraf Ketua Majelis Fotokopi Kartu Tanda Penduduk ... P.2 ...". Fungsi cetak ABT (isian_bukti_baris / isian_rtf_bukti)
 * menomori PER BARIS, jadi kedua bukti tercetak sebagai satu butir. Sebab di panel: rapiSimpan memperlakukan semua isian teks selain
 * 1214/9911 dengan rapiIsian (baris dirangkai spasi, ";" di tengah jadi ",").
 *
 * Yang dijaga (data rekaan, tanpa nama/NIK sungguhan):
 *   1  rapiDaftarBukti: satu bukti satu baris, tiap butir diakhiri ";", bukti menyambung (dengan atau tanpa ";") dipisah, baris lanjutan
 *      (huruf kecil) tidak dipotong, judul sub-bab dibiarkan, idempoten; tidak ada lagi "Ketua Majelis Fotokopi";
 *   2  pemisahan tidak memotong di dalam satu bukti ("Fotokopi Kartu ...", "Kutipan Akta Nikah" tanpa tanda bukti sebelumnya);
 *   3  rapiSimpan panel (fungsi sungguhan dari blangko-derry-isian.js): isian daftar bukti (9958, 0378, 9955, 9135 ...) TIDAK dirangkai;
 *      isian teks lain tetap aturan rapi 30 Okt;
 *   4  perapian otomatis saat blangko dibuka: hanya isian TERSIMPAN yang menyambung dan hanya bila huruf/angkanya sama persis; ketikan
 *      petugas (sedang diketik, sudah berbaris, atau berbeda huruf) tidak ditimpa; sekali per perkara+isian;
 *   5  penyunting terstruktur 1214/9911 (uraiBukti) memisah bukti menyambung menjadi baris sendiri-sendiri.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const req = createRequire(import.meta.url);
type Apa = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const SK: Apa = req(path.join(EKSTENSI, "blangko-derry-saksi.js"));
const ISIAN = baca("blangko-derry-isian.js");

/** Potongan sumber satu fungsi dari blangko-derry-isian.js (mulai `awal`, berhenti sebelum `akhir`). */
function irisan(awal: string, akhir: string): string {
  const a = ISIAN.indexOf(awal);
  if (a < 0) throw new Error(`tidak ditemukan: ${awal}`);
  const b = ISIAN.indexOf(akhir, a + awal.length);
  if (b < 0) throw new Error(`tidak ditemukan: ${akhir}`);
  return ISIAN.slice(a, b);
}

// Bukti rekaan, bunyi bawaan ABT #9958# (blangko Derry) dengan nama/NIK rekaan.
const KTP = (nama: string, nik: string, tanda: string) =>
  `Fotokopi Kartu Tanda Penduduk atas nama ${nama}, NIK ${nik} tanggal 12 Juli 2013, yang dikeluarkan oleh Pemerintah Kabupaten Contoh, Provinsi Sulawesi Tengah, telah diberi meterai cukup, di-nazegelen dan telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh Ketua Majelis diberi tanda ${tanda} serta diberi tanggal dan paraf Ketua Majelis`;
const B1 = KTP("AHMAD REKAAN", "7200000000000001", "P.1");
const B2 = KTP("SITI REKAAN", "7200000000000002", "P.2");
const NYAMBUNG = `${B1} ${B2}`; // bentuk yang tersimpan di ABT perkara 232 (tanpa ";" dan tanpa ganti baris)

describe("1. rapiDaftarBukti - satu bukti satu baris", () => {
  it("bukti menyambung tanpa pemisah dipisah, tiap butir diakhiri titik koma", () => {
    const r = SK.rapiDaftarBukti(NYAMBUNG);
    expect(r.split("\n")).toEqual([`${B1};`, `${B2};`]);
    expect(r).not.toMatch(/Ketua Majelis Fotokopi/);
  });
  it("bukti menyambung dengan titik koma (bawaan lama ABT) dan bernomor juga dipisah", () => {
    expect(SK.rapiDaftarBukti(`${B1}; ${B2};`).split("\n")).toEqual([`${B1};`, `${B2};`]);
    const bernomor =
      "1. Fotokopi Kartu Tanda Penduduk a.n. Contoh, kemudian diberi kode bukti (P.1). Diberi tanggal dan paraf Hakim; 2. Fotocopy Kartu Keluarga Nomor 1, kemudian diberi kode bukti (P.2). Diberi tanggal dan paraf Hakim;";
    expect(SK.rapiDaftarBukti(bernomor).split("\n")).toEqual([
      "1. Fotokopi Kartu Tanda Penduduk a.n. Contoh, kemudian diberi kode bukti (P.1). Diberi tanggal dan paraf Hakim;",
      "2. Fotocopy Kartu Keluarga Nomor 1, kemudian diberi kode bukti (P.2). Diberi tanggal dan paraf Hakim;",
    ]);
  });
  it("bukti elektronik dan bukti Tergugat (T.1, PK.1) ikut dipisah", () => {
    const el =
      "Tangkapan layar percakapan WhatsApp, bukti elektronik tersebut tidak dapat dicocokkan dengan aslinya, lalu oleh Ketua Majelis diberi tanda P.3 Rekaman suara dalam flashdisk, bukti elektronik tersebut disertai dengan hasil digital forensic, lalu oleh Ketua Majelis diberi tanda P.4";
    expect(SK.rapiDaftarBukti(el).split("\n")).toHaveLength(2);
    expect(SK.rapiDaftarBukti("Fotokopi Akta Cerai, lalu diberi tanda T.1 Fotokopi Kartu Keluarga, lalu diberi tanda T.2").split("\n")).toEqual([
      "Fotokopi Akta Cerai, lalu diberi tanda T.1;",
      "Fotokopi Kartu Keluarga, lalu diberi tanda T.2;",
    ]);
    expect(SK.rapiDaftarBukti("Fotokopi Surat Perjanjian, lalu diberi tanda PK.1 Salinan Putusan, lalu diberi tanda PK.2").split("\n")).toHaveLength(2);
  });
  it("baris lanjutan (huruf kecil) tetap satu bukti, judul sub-bab dibiarkan, idempoten", () => {
    const t = "A. Bukti Surat:\nFotokopi Kartu Keluarga Nomor 1,\nyang dikeluarkan oleh Dinas, lalu diberi tanda P.1\nFotokopi Surat Keterangan Desa, lalu diberi tanda P.2";
    const r = SK.rapiDaftarBukti(t);
    expect(r.split("\n")).toEqual(["A. Bukti Surat:", "Fotokopi Kartu Keluarga Nomor 1, yang dikeluarkan oleh Dinas, lalu diberi tanda P.1;", "Fotokopi Surat Keterangan Desa, lalu diberi tanda P.2;"]);
    expect(SK.rapiDaftarBukti(r)).toBe(r);
    expect(SK.rapiDaftarBukti(SK.rapiDaftarBukti(NYAMBUNG))).toBe(SK.rapiDaftarBukti(NYAMBUNG));
  });
  it("gabungan bukti SELALU berpemisah: tiap baris memuat tepat satu tanda bukti", () => {
    for (const n of [2, 3, 5, 9]) {
      const daftar = Array.from({ length: n }, (_, i) => KTP(`PIHAK ${String.fromCharCode(65 + i)} REKAAN`, `72000000000000${String(i + 10)}`, `P.${i + 1}`));
      for (const pemisah of [" ", "; ", ";\n", "\n", ";  \r\n"]) {
        const baris = SK.rapiDaftarBukti(daftar.join(pemisah)).split("\n");
        expect(baris).toHaveLength(n);
        baris.forEach((b: string, i: number) => {
          expect(b.match(/tanda P\.\d+/g)).toEqual([`tanda P.${i + 1}`]);
          expect(b.endsWith(";")).toBe(true);
        });
      }
    }
  });
});

describe("2. tidak memotong di dalam satu bukti", () => {
  it("kata Fotokopi/Kartu/Kutipan/Akta di dalam bukti yang belum bertanda tidak memotong", () => {
    const satu = "Fotokopi Kutipan Akta Nikah Nomor 12/34/V/2010 tanggal 3 Mei 2010, Kartu Keluarga terlampir, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;";
    expect(SK.pisahDaftarBukti(satu)).toEqual([satu]);
    expect(SK.rapiDaftarBukti(B1).split("\n")).toEqual([`${B1};`]);
  });
  it("isian daftar bukti dikenali dari kode dan nama, isian lain tidak", () => {
    for (const k of ["9958", "0378", "1214", "9911", "9955", "9956", "9957", "8131", "8132", "8133", "9135", "9470", "9804", "9951"]) expect(SK.adalahDaftarBukti(k, "")).toBe(true);
    expect(SK.adalahDaftarBukti("99999", "Alat bukti surat Pemohon (daftar bukti P.1 dst.)")).toBe(true);
    for (const k of ["5125", "0007", "8503", "1046"]) expect(SK.adalahDaftarBukti(k, "Posita")).toBe(false);
  });
});

// rapiSimpan sungguhan dari panel, dengan isian blangko dan mesin rapi (blangko-derry-saksi.js) asli.
function buatRapiSimpan(isian: Record<string, Apa>) {
  const sumber = irisan("function rapiSimpan(kode, nilai) {", "  async function simpanIsian(kode, nilai) {");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function("mesinIsi", "SK", "isianBlangko", `${sumber}; return rapiSimpan;`)(
    () => ({ KODE_NASKAH_BERBARIS: [], KODE_TEKS_PIHAK: [] }),
    () => SK,
    (k: string) => isian[k] || { kode: k }
  ) as (kode: string, nilai: string) => string;
}

describe("3. rapiSimpan panel - daftar bukti tidak dirangkai", () => {
  const isian: Record<string, Apa> = {
    "9958": { kode: "9958", jenis: "teks", nama: "Alat bukti surat itsbat nikah (daftar bukti P.1 dst.; dibaca dari berkas e-Court)", namaAsli: "C3. Alat Bukti Isbat Nikah Terpadu" },
    "0378": { kode: "0378", jenis: "teks", nama: "Alat bukti surat itsbat nikah (daftar bukti P.1 dst.)", namaAsli: "Bukti Surat IN" },
    "9135": { kode: "9135", jenis: "teks", nama: "Alat bukti surat wali adhal (daftar bukti P.1 dst.)", namaAsli: "ALAT BUKTI SURAT WALI ADHAL - ISIAN (daftar bukti P.1 dst.)" },
    "1214": { kode: "1214", jenis: "teks", khusus: "bukti", pihak: "P", nama: "Alat bukti surat Penggugat", namaAsli: "Alat-alat bukti CG/CT" },
    "5105": { kode: "5105", jenis: "teks", nama: "Tempat akad nikah", namaAsli: "Tempat akad nikah" },
  };
  const rapiSimpan = buatRapiSimpan(isian);
  it("isian bukti itsbat 9958 yang menyambung disimpan per baris (perkara 232)", () => {
    expect(rapiSimpan("9958", NYAMBUNG)).toBe(`${B1};\n${B2};`);
  });
  it("bawaan ABT berbaris (#9958#/#0378#/#9135#) tetap berbaris, tidak dirangkai koma", () => {
    for (const k of ["9958", "0378", "9135"]) {
      const r = rapiSimpan(k, `${B1};\r\n${B2};`);
      expect(r).toBe(`${B1};\n${B2};`);
      expect(r).not.toMatch(/Majelis, Fotokopi|Majelis Fotokopi/);
    }
  });
  it("penyunting terstruktur 1214 tetap per baris, isian teks lain tetap aturan rapi 30 Okt", () => {
    expect(rapiSimpan("1214", `${B1};\n${B2};`)).toBe(`${B1};\n${B2};`);
    expect(rapiSimpan("5105", "Kantor Urusan Agama;\nKecamatan Contoh")).toBe("Kantor Urusan Agama, Kecamatan Contoh");
  });
});

// rapikanDaftarBuktiOtomatis sungguhan dari panel; ABT ditiru (jadwalkanSimpan mencatat yang ditulis).
function buatPerapian(nilaiAbt: Record<string, string>, opsi: { diketik?: string[]; isi?: Record<string, string> } = {}) {
  const sumber = irisan("const rapiBuktiSudah = new Set();", "  const BAWAAN_ABT_ITSBAT = ");
  const ditulis: Array<{ kode: string; nilai: string }> = [];
  const riwayat: Apa[] = [];
  const S: Apa = {
    pk: { perkara: { perkara_id: "9001" } },
    blangko: { jenis: "put" },
    nilai: Object.fromEntries(Object.entries(nilaiAbt).map(([k, t]) => [k, { status: t.trim() ? "terisi" : "kosong", teks: t }])),
    isi: { ...(opsi.isi || {}) },
    diketik: new Set(opsi.diketik || []),
  };
  const d: Apa = {
    isian: [
      { kode: "9958", jenis: "teks", nama: "Alat bukti surat itsbat nikah", namaAsli: "C3. Alat Bukti Isbat Nikah Terpadu" },
      { kode: "0378", jenis: "teks", nama: "Alat bukti surat itsbat nikah", namaAsli: "Bukti Surat IN" },
      { kode: "1214", jenis: "teks", khusus: "bukti", pihak: "P", nama: "Alat bukti surat Penggugat", namaAsli: "Alat-alat bukti CG/CT" },
      { kode: "5125", jenis: "teks", nama: "Posita lengkap", namaAsli: "Posita" },
    ],
  };
  S.susunan = d;
  const rapiSimpan = buatRapiSimpan(Object.fromEntries(d.isian.map((b: Apa) => [b.kode, b])));
  const jadwalkanSimpan = async (kode: string, nilai: string) => {
    const v = rapiSimpan(kode, nilai);
    S.isi[kode] = v;
    ditulis.push({ kode, nilai: v });
    return true;
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fungsi = new Function(
    "S", "SK", "bolehTulis", "perkaraId", "jadwalkanSimpan", "segarKartu", "catatRiwayat", "toast", "catatTeknis",
    `${sumber}; return rapikanDaftarBuktiOtomatis;`
  )(S, () => SK, () => true, () => "9001", jadwalkanSimpan, () => undefined, (r: Apa) => riwayat.push(r), () => undefined, () => undefined) as (d: Apa) => Promise<void>;
  return { jalan: () => fungsi(d), ditulis, riwayat, S };
}

describe("4. perapian otomatis data tersimpan - tidak menimpa ketikan petugas", () => {
  it("isian tersimpan yang menyambung dipisah sendiri saat blangko dibuka, sekali saja, tercatat di riwayat", async () => {
    const t = buatPerapian({ "9958": NYAMBUNG });
    await t.jalan();
    expect(t.ditulis).toEqual([{ kode: "9958", nilai: `${B1};\n${B2};` }]);
    expect(t.riwayat).toHaveLength(1);
    expect(t.riwayat[0].sebelum).toBe(NYAMBUNG);
    expect(t.riwayat[0].cara).toMatch(/satu bukti satu baris/);
    t.S.isi = {};
    await t.jalan();
    expect(t.ditulis).toHaveLength(1);
  });
  it("isian yang sudah berbaris, kosong, atau sedang diketik tidak ditulis", async () => {
    const t = buatPerapian({ "9958": `${B1};\n${B2};`, "0378": "" });
    await t.jalan();
    expect(t.ditulis).toEqual([]);
    const k = buatPerapian({ "9958": NYAMBUNG }, { diketik: ["9958"] });
    await k.jalan();
    expect(k.ditulis).toEqual([]);
    const ketik = buatPerapian({ "9958": NYAMBUNG }, { isi: { "9958": "ketikan petugas yang belum tersimpan" } });
    await ketik.jalan();
    expect(ketik.ditulis).toEqual([]);
  });
  it("teks satu baris yang bukan dua bukti (satu bukti, kalimat bebas petugas) dibiarkan apa adanya", async () => {
    const t = buatPerapian({ "9958": B1, "0378": "Para Pemohon tidak mengajukan bukti surat" });
    await t.jalan();
    expect(t.ditulis).toEqual([]);
  });
  it("perbaikiBuktiMenyambung hanya mengubah pemisah dan tanda baca (huruf/angka sama persis)", () => {
    const r = SK.perbaikiBuktiMenyambung(NYAMBUNG);
    expect(r.replace(/[^0-9A-Za-z]/g, "")).toBe(NYAMBUNG.replace(/[^0-9A-Za-z]/g, ""));
    expect(SK.perbaikiBuktiMenyambung(`${B1};\n${B2};`)).toBe("");
  });
  it("penyunting terstruktur (1214/9911) dan isian bukan daftar bukti tidak ikut ditulis ulang", async () => {
    const t = buatPerapian({ "1214": NYAMBUNG, "5125": NYAMBUNG });
    await t.jalan();
    expect(t.ditulis).toEqual([]);
  });
});

describe("5. penyunting terstruktur 1214/9911 memisah bukti menyambung", () => {
  it("uraiBukti memakai pisahBarisBukti sesudah pemisah lama", () => {
    const u = irisan("function uraiBukti(teks) {", "    for (const p0 of potongan) {");
    expect(u).toMatch(/pisahBarisBukti/);
    expect(SK.pisahBarisBukti(NYAMBUNG)).toEqual([B1, B2]);
  });
  it("rapiSimpan dan perapian otomatis tersambung ke jalur panel", () => {
    expect(irisan("function rapiSimpan(kode, nilai) {", "  async function simpanIsian(kode, nilai) {")).toMatch(/adalahDaftarBukti\(kode, b\.namaAsli \|\| b\.nama\)\) return m\.rapiDaftarBukti\(nilai\)/);
    expect(irisan("async function isiOtomatisBlangko(d, opsi) {", "  /**")).toMatch(/await rapikanDaftarBuktiOtomatis\(d\);/);
  });
});
