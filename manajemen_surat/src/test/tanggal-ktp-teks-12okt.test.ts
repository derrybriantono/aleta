// @vitest-environment node
/**
 * ============================================================================
 * TANGGAL KTP DI DALAM VARIABEL TEKS + TERISI OTOMATIS (12 Okt 2026, butir 9-10, Agen D)
 * ============================================================================
 *
 * Yang diuji PERILAKUNYA (blok KTP-TEKS dan KTP-PIHAK pada ekstensi-sipp/abt.js, dimuat apa adanya):
 *   A. membaca bagian tanggal di satu butir KTP: "03 Mei 2025", "3 Juli 2019", "08-11-2025", "April2019",
 *      "02 06 2020", "tanggal26 Januari 2022", tanda kosong ("...", ",,,,,,,", "_"), "tanggal yang dikeluarkan",
 *      salah ketik ("29-092020"), dan yang BUKAN tanggal KTP (tanggal lahir, "tanggal dan paraf", akta nikah);
 *   B. butir KTP: dipisah dari butir lain, kata "KTP" di narasi tidak dihitung;
 *   C. pihak yang dimaksud butir: peran, nama (bin/binti, galat OCR, nama kembar = ambigu), urutan baku variabel;
 *   D. penambal: hanya bagian tanggal berubah, sisa kalimat utuh persis; kosong+kuat = otomatis; beda/lemah =
 *      tawaran; ragu/sama = dibiarkan; gaya penulisan petugas dipertahankan; idempoten;
 *   E. panel: a3UsulanTanggalKtp membaca isi asli lewat borang edit_data ABT, menyusun usulan variabel tanggal DAN
 *      teks, `awal` (centang awal) hanya untuk isian kosong + bacaan cukup/pasti, isian petugas tak ditimpa;
 *   F. pemasangan di panel hakim (soreBacaIsi/kartuUsulan) dan panitera (p7);
 *   G. atas isian ABT lokal sungguhan (dilewati bila MySQL/aps_badilag mati): tak ada galat, sisa kalimat utuh.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

import { describe, expect, it } from "vitest";

type Apa = any;

const AKAR = path.resolve(__dirname, "../../..");
const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");

const awalKonst = sumber.indexOf("const A3_VAR_TANGGAL_KTP_P");
const akhirKonst = sumber.indexOf("/**\n * 9 Okt 2026 (KUASA butir 1-4)", awalKonst);
const blok = sumber.slice(awalKonst, akhirKonst);
const awalKeadaan = sumber.indexOf("const NILAI_KOSONG");
const keadaanKode = sumber.slice(awalKeadaan, sumber.indexOf("const ALETA_API_ABT", awalKeadaan));

function muatMurni(): Apa {
  const f = new Function(
    `${keadaanKode}\n${blok}\nreturn { ktpTeksCariTanggal, ktpTeksButir, ktpTeksSusun, ktpTeksPilihPihak, ktpTeksAdaTanggal, ktpTeksPeranDiButir, ktpTeksNamaDiButir, ktpTeksTanggalDiAwal };`
  );
  return f();
}
const M = muatMurni();

const jawab = (isi: Apa, status = 200) => ({ ok: status < 400, status, json: async () => ({ data: isi }), text: async () => String(isi) });
const borang = (tipe: string, teks: string) =>
  `<html><form method="POST"><input type="hidden" name="var_type" value="${tipe}">\n<textarea autofocus style="text-align:left" id="value" name="value" \n\t>${teks}</textarea></form></html>`;

type Opsi = { sel: Record<string, string>; tipe?: Record<string, string>; jati?: Apa; nama?: Record<string, string>; muat?: (tipe: Map<string, string>) => void };
function pasang({ sel, tipe = {}, jati = { perkaraId: "9293", perkTemp: "" }, nama = {}, muat }: Opsi, fetchPalsu: (url: string) => Promise<Apa>) {
  const peta = new Map(Object.entries(sel).map(([k, n]) => [k, { kode: k, nama: nama[k] || `Variabel ${k}`, nilai: n }]));
  const tipeVariabel = new Map<string, string>(Object.entries(tipe));
  const f = new Function(
    "barisVariabel",
    "fetch",
    "a3BolehDiisi",
    "jatiDiriPerkara",
    "asalAbt",
    "muatTipeHalaman",
    "tipeVariabel",
    "a3SebabBukanAbt",
    `${keadaanKode}\n${blok}\nreturn { a3UsulanTanggalKtp, ktpKandidatTeks, ktpUsulanTanggal };`
  );
  return f(
    () => peta,
    fetchPalsu,
    (k: string) => (tipeVariabel.has(k) ? tipeVariabel.get(k) === "data_teks" || tipeVariabel.get(k) === "data_tanggal" : null),
    () => jati,
    () => "http://abt.test/aps_badilag/abt",
    async () => {
      if (muat) muat(tipeVariabel);
      return true;
    },
    tipeVariabel,
    () => ""
  );
}

// ── bahan teks nyata (bentuk dari isian satker, nama disamarkan) ─────────────

const AKTA = "2. Fotokopi Kutipan Akta Nikah, Nomor 12/34/V/2010 tanggal 5 Mei 2010, yang dikeluarkan oleh KUA Banawa, bukti surat tersebut telah diberi meterai cukup, lalu diberi tanda P.2;";
const KTP_KOSONG =
  "1. Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama RIZKA, NIK 7203144107930512 tanggal ..., yang dikeluarkan oleh Pemerintah Kabupaten Donggala, Provinsi Sulawesi Tengah, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;";
const T1214_KOSONG = `${KTP_KOSONG}\n${AKTA}`;
const P_RIZKA = { cabang: 1, urutan: 1, peran: "Penggugat", nama: "RIZKA", tanggalKtp: "18/02/2012", yakin: "cukup", cocok: "nik", kota: "Donggala", sebab: "" };

// ============================================================================
// A. bagian tanggal di satu butir
// ============================================================================
describe("A. ktpTeksCariTanggal: bagian tanggal KTP di satu butir", () => {
  const cari = (t: string) => M.ktpTeksCariTanggal(t);
  const tak = (t: string) => {
    const r = cari(t);
    return r ? t.slice(r.awal, r.akhir) : null;
  };

  it("menemukan penulisan petugas yang lazim dan tidak menyentuh kata lain", () => {
    expect(tak("Kartu Tanda Penduduk, NIK 7203, Tanggal 21 Maret 2018 yang dikeluarkan oleh Dinas")).toBe("21 Maret 2018");
    expect(tak("KTP-el atas nama X, NIK 1 tanggal 03 Mei 2025, yang dikeluarkan")).toBe("03 Mei 2025");
    expect(tak("KTP, Nomor 7 tanggal 3 Juli 2019, dikeluarkan")).toBe("3 Juli 2019");
    expect(tak("KTP tanggal 08-11-2025, yang")).toBe("08-11-2025");
    expect(tak("KTP tanggal 20- 10- 1970 ,")).toBe("20- 10- 1970");
    expect(tak("KTP Nomor 7 tanggal 23 April2019, diterbitkan")).toBe("23 April2019");
    expect(tak("KTP NIK 7, Tanggal 02 06 2020 yang dikeluarkan")).toBe("02 06 2020");
    expect(tak("KTP atas nama X, tanggal26 Januari 2022 yang dikeluarkan")).toBe("26 Januari 2022");
    expect(tak("KTP tanggal11-03-2019. yang diterbitkan")).toBe("11-03-2019");
    expect(tak("KTP tanggal 2020-01-31 yang")).toBe("2020-01-31");
    expect(tak("KTP tertanggal 20 Oktober 2022, yang diterbitkan")).toBe("20 Oktober 2022");
    expect(tak("KTP tanggal 29 Nopember 2012, yang")).toBe("29 Nopember 2012");
  });

  it("bulan salah ketik tetap dikenali dari tiga huruf awalnya; bulan yang bukan bulan atau tanggal mustahil = 'rusak' (ditawarkan saja)", () => {
    expect(tak("KTP tanggal 12 Septemer 2022 yang dikeluarkan")).toBe("12 Septemer 2022");
    expect(tak("KTP tanggal 22 Desembe 2016 yang dikeluarkan")).toBe("22 Desembe 2016");
    expect(cari("KTP tanggal 22 Xyzabc 2016 yang dikeluarkan").jenis).toBe("rusak");
    expect(cari("KTP tanggal 31 Februari 2016 yang dikeluarkan").jenis).toBe("rusak"); // tanggal mustahil
  });

  it("tanda kosong: titik, elipsis, koma berderet, garis bawah - koma penutup kalimat tidak ikut", () => {
    expect(tak("KTP NIK 7 tanggal ..., yang dikeluarkan")).toBe("...");
    expect(tak("KTP NIK 7 tanggal ... yang dikeluarkan")).toBe("...");
    expect(tak("KTP NIK 7 Tanggal ,,,,,,, yang dikeluarkan")).toBe(",,,,,,,");
    expect(tak("KTP NIK 7 tanggal _, yang dikeluarkan")).toBe("_");
    expect(cari("KTP NIK 7 tanggal ...").jenis).toBe("kosong");
  });

  it("'tanggal yang dikeluarkan' (tanggalnya terhapus): disisipkan sesudah kata tanggal, tanpa teks yang diganti", () => {
    const t = "KTP dengan NIK 7203 atas nama Eris, tanggal yang dikeluarkan oleh Kabupaten Donggala";
    const r = cari(t);
    expect(r.jenis).toBe("kosong");
    expect(r.hampa).toBe(true);
    expect(r.awal).toBe(r.akhir);
    expect(t.slice(0, r.awal)).toMatch(/tanggal $/);
  });

  it("salah ketik berawal angka = 'rusak' (ditawarkan, bukan diisi otomatis)", () => {
    expect(cari("KTP, NIK 7, Tanggal 29-092020, yang dikeluarkan").jenis).toBe("rusak");
    expect(cari("KTP, NIK 7, Tanggal 03 Juli 202 yang dikeluarkan").jenis).toBe("rusak");
    expect(cari("KTP, NIK 7, tanggal 7210146312840001 yang dikeluarkan").jenis).toBe("rusak");
  });

  it("bukan tanggal KTP: lahir, berlaku sampai, 'diberi tanggal dan paraf'", () => {
    expect(cari("KTP atas nama X, lahir tanggal 12 Mei 1990, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis")).toBeNull();
    expect(cari("KTP berlaku sampai tanggal 12 Mei 2030 dan seterusnya")).toBeNull();
    expect(cari("KTP atas nama X, yang dikeluarkan oleh Pemerintah Kabupaten Donggala, diberi tanggal dan paraf")).toBeNull();
  });
});

// ============================================================================
// B. butir KTP
// ============================================================================
describe("B. ktpTeksButir: butir KTP dipisah dari butir lain", () => {
  it("dua KTP + akta nikah = dua butir KTP, batas di penomoran/baris baru; akta tidak ikut", () => {
    const t = `1.Fotokopi Kartu Tanda Penduduk atas nama A, NIK 1 tanggal 01 Mei 2010, yang dikeluarkan;\n2.Fotokopi Kartu Tanda Penduduk atas nama B, NIK 2 tanggal 02 Mei 2011, yang dikeluarkan;\n3.Fotokopi Kutipan Akta Nikah tanggal 5 Mei 2000;`;
    const b = M.ktpTeksButir(t);
    expect(b.map((x: Apa) => x.ke)).toEqual([0, 1]);
    expect(b[0].teks).not.toContain("atas nama B");
    expect(b[1].teks).not.toContain("Akta Nikah");
    expect(M.ktpTeksCariTanggal(b[0].teks)).toMatchObject({ teks: "01 Mei 2010" });
    expect(M.ktpTeksCariTanggal(b[1].teks)).toMatchObject({ teks: "02 Mei 2011" });
  });

  it("butir pada satu baris yang dirapatkan (isi sel halaman) tetap terpisah", () => {
    const t = "1. Fotokopi KTP atas nama A, NIK 1 tanggal 01 Mei 2010, yang dikeluarkan; 2. Fotokopi KTP atas nama B, NIK 2 tanggal 02 Mei 2011, yang dikeluarkan; 3. Fotokopi Kartu Keluarga tanggal 3 Mei 2012";
    const b = M.ktpTeksButir(t);
    expect(b).toHaveLength(2);
    expect(M.ktpTeksCariTanggal(b[0].teks).teks).toBe("01 Mei 2010");
    expect(M.ktpTeksCariTanggal(b[1].teks).teks).toBe("02 Mei 2011");
  });

  it("kata KTP di narasi (bukan butir alat bukti) tidak dihitung", () => {
    const t = "Bahwa berdasarkan KTP Pemohon tanggal 12 Mei 2015 beralamat di Donggala.";
    expect(M.ktpTeksButir(t)).toEqual([]);
    expect(M.ktpTeksAdaTanggal(t)).toBe(false);
  });

  it("'Kartu Tanda Penduduk Elektronik (KTP-el)' dihitung SATU butir, bukan dua", () => {
    const b = M.ktpTeksButir("1. Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama A, NIK 1 tanggal ..., yang dikeluarkan");
    expect(b).toHaveLength(1);
    expect(M.ktpTeksAdaTanggal("1. Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama A tanggal ... yang")).toBe(true);
  });
});

// ============================================================================
// C. pihak yang dimaksud butir
// ============================================================================
describe("C. ktpTeksPilihPihak: butir -> pihak e-Court", () => {
  const P1 = { cabang: 1, urutan: 1, peran: "Pemohon I", nama: "SITI AMINAH", tanggalKtp: "18/02/2012", yakin: "cukup" };
  const P2 = { cabang: 1, urutan: 2, peran: "Pemohon II", nama: "BUDI SANTOSO", tanggalKtp: "07/09/2014", yakin: "cukup" };
  const T1 = { cabang: 2, urutan: 1, peran: "Termohon", nama: "ANDI", tanggalKtp: "01/01/2013", yakin: "cukup" };
  const butir = (teks: string) => ({ teks });
  const pilih = (teks: string, ke: number, kode: string, daftar: Apa[]) => M.ktpTeksPilihPihak(butir(teks), ke, kode, daftar);

  it("peran: '(Pemohon II)' dan 'atas nama Penggugat'; 'dan Pemohon' di narasi bukan peran", () => {
    expect(M.ktpTeksPeranDiButir("KTP atas nama Budi (Pemohon II), NIK 1")).toEqual({ cabang: 1, urutan: 2 });
    expect(M.ktpTeksPeranDiButir("KTP atas nama Penggugat, NIK 1")).toEqual({ cabang: 1, urutan: null });
    expect(M.ktpTeksPeranDiButir("KTP a.n. Tergugat I NIK 1")).toEqual({ cabang: 2, urutan: 1 });
    expect(M.ktpTeksPeranDiButir("KTP NIK 1 telah dicocokkan dengan aslinya dan Pemohon hadir")).toBeNull();
  });

  it("nama: 'atas nama', 'an.', 'a.n.' berhenti sebelum NIK/tanggal/angka", () => {
    expect(M.ktpTeksNamaDiButir("KTP atas nama Sutarmin tanggal 13 Januari 2021 yang dikeluarkan")).toBe("Sutarmin");
    expect(M.ktpTeksNamaDiButir("KTP a.n. Asmani Lahado, NIK 7210")).toBe("Asmani Lahado");
    expect(M.ktpTeksNamaDiButir("Kartu Tanda Penduduk an. Elfina Nomor 7210135010950002, Tanggal")).toBe("Elfina");
    expect(M.ktpTeksNamaDiButir("KTP atas nama Penggugat, NIK 1")).toBe("");
    expect(M.ktpTeksNamaDiButir("KTP atas nama , NIK tanggal ...")).toBe("");
  });

  it("nama lebih dulu dari urutan; bin/binti dan galat OCR satu huruf ditoleransi", () => {
    const r = pilih("KTP atas nama Siti Aminah binti Ali, NIK 1 tanggal ...", 0, "1214", [P1, P2]);
    expect(r.pihak).toBe(P1);
    expect(r.cara).toBe("nama");
    expect(r.kuat).toBe(true);
    const ocr = pilih("KTP atas nama BUDI SANTOSA, NIK 2 tanggal ...", 0, "9958", [P1, P2]);
    expect(ocr.pihak).toBe(P2);
  });

  it("peran + nama yang bertentangan, nama yang tak dikenal, dan nama kembar = DILEWATI", () => {
    expect(pilih("KTP atas nama Budi Santoso (Pemohon I), NIK 1 tanggal ...", 0, "1214", [P1, P2]).pihak).toBeNull();
    expect(pilih("KTP atas nama Orang Lain, NIK 1 tanggal ...", 0, "1214", [P1, P2]).pihak).toBeNull();
    const kembar = [
      { ...P1, nama: "FIRMAN SUHINI" },
      { ...P2, nama: "FIRMAN HAKIM" },
    ];
    expect(pilih("KTP atas nama Firman, NIK 1 tanggal ...", 0, "1214", kembar).pihak).toBeNull(); // sama-sama cocok = ambigu
  });

  it("nama satu kata yang kebetulan mirip (mis. wali bernama sama dengan nama depan pihak) = pihak dikenali LEMAH", () => {
    const r = pilih("KTP atas nama Siti, NIK 1 tanggal ...", 0, "1214", [P1, P2]);
    expect(r.pihak).toBe(P1);
    expect(r.cara).toBe("nama");
    expect(r.kuat).toBe(false);
    // nama ayah (sesudah bin/binti) tidak ikut: wali 'Ali' bukan 'Siti Aminah binti Ali'
    expect(pilih("KTP atas nama Ali, NIK 1 tanggal ...", 0, "1214", [{ ...P1, nama: "Siti Aminah binti Ali" }]).pihak).toBeNull();
  });

  it("peran tanpa angka hanya sah bila pihak e-Court tunggal di cabang itu", () => {
    expect(pilih("KTP atas nama Penggugat, NIK 1 tanggal ...", 0, "1214", [{ ...P1, peran: "Penggugat" }]).cara).toBe("peran");
    expect(pilih("KTP atas nama Pemohon, NIK 1 tanggal ...", 0, "1214", [P1]).pihak).toBeNull(); // 'Pemohon I' = ada Pemohon II
  });

  it("tanpa peran dan nama: urutan baku variabelnya (1214 = Penggugat; 9958 = Pemohon I lalu II; 9911 = Tergugat)", () => {
    expect(pilih("KTP, NIK 1 tanggal ...", 0, "1214", [P1]).pihak).toBe(P1);
    expect(pilih("KTP, NIK 1 tanggal ...", 1, "1214", [P1, P2]).pihak).toBeNull(); // butir ke-2 tak dikenal
    expect(pilih("KTP, NIK 1 tanggal ...", 1, "9958", [P1, P2]).pihak).toBe(P2);
    expect(pilih("KTP, NIK 1 tanggal ...", 0, "9911", [P1, T1]).pihak).toBe(T1);
    expect(pilih("KTP, NIK 1 tanggal ...", 0, "5105", [P1]).pihak).toBeNull(); // variabel tak dikenal
    expect(pilih("KTP, NIK 1 tanggal ...", 1, "9958", [P1]).pihak).toBeNull(); // KTP Pemohon II belum terbaca
  });
});

// ============================================================================
// D. penambal
// ============================================================================
describe("D. ktpTeksSusun: hanya bagian tanggal yang berubah", () => {
  it("tanggal kosong ('...') diisi 'dd Bulan yyyy'; koma penutup dan sisa kalimat UTUH; tanggal akta nikah tidak tersentuh", () => {
    const s = M.ktpTeksSusun(T1214_KOSONG, "1214", [P_RIZKA]);
    expect(s.ada).toBe(true);
    expect(s.otomatis).toBe(true);
    expect(s.nilai).toContain("NIK 7203144107930512 tanggal 18 Februari 2012, yang dikeluarkan");
    expect(s.nilai.replace("18 Februari 2012", "...")).toBe(T1214_KOSONG);
    expect(s.nilai).toContain("tanggal 5 Mei 2010"); // akta
    expect(s.perubahan).toEqual([expect.objectContaining({ aksi: "isi", dari: "", ke: "18 Februari 2012", cara: "nama", kuat: true })]);
    expect(s.perubahan[0].label).toContain("Penggugat");
  });

  it("idempoten: teks hasil tidak diubah lagi", () => {
    const s = M.ktpTeksSusun(T1214_KOSONG, "1214", [P_RIZKA]);
    const lagi = M.ktpTeksSusun(s.nilai, "1214", [P_RIZKA]);
    expect(lagi.nilai).toBe("");
    expect(lagi.perubahan).toEqual([]);
    expect(lagi.tetap.some((t: Apa) => /sudah sama/.test(t.alasan))).toBe(true);
  });

  it("baris baru (\\n dan \\r\\n) dan tab dipertahankan persis", () => {
    const asli = `1.\tFotocopy Kartu Tanda Penduduk atas nama RIZKA, NIK 1 tanggal ,,,,,,, yang dikeluarkan oleh X;\r\n2.\tFotokopi Kartu Keluarga tanggal 3 Mei 2012;\r\n`;
    const s = M.ktpTeksSusun(asli, "8131", [P_RIZKA]);
    expect(s.nilai).toBe(asli.replace(",,,,,,,", "18 Februari 2012"));
  });

  it("gaya petugas dipertahankan: nol di depan, pemisah angka, ISO; tanggal kosong memakai 'dd Bulan yyyy'", () => {
    const a = (t: string) => M.ktpTeksSusun(`Fotokopi KTP atas nama RIZKA, NIK 1 tanggal ${t} yang dikeluarkan`, "1214", [P_RIZKA]);
    expect(a("3 Januari 2020").nilai).toContain("tanggal 18 Februari 2012 yang"); // 18 dua digit, tak ada nol
    expect(a("08-11-2025").nilai).toContain("tanggal 18-02-2012 yang");
    expect(a("08/11/2025").nilai).toContain("tanggal 18/02/2012 yang");
    expect(a("2025-11-08").nilai).toContain("tanggal 2012-02-18 yang");
    expect(a("02 06 2020").nilai).toContain("tanggal 18 Februari 2012 yang"); // spasi saja -> ditulis jelas
    const p9 = { ...P_RIZKA, tanggalKtp: "03/05/2012" };
    expect(M.ktpTeksSusun("Fotokopi KTP atas nama RIZKA, NIK 1 tanggal 7 Juli 2020 yang dikeluarkan", "1214", [p9]).nilai).toContain("tanggal 3 Mei 2012 yang");
    expect(M.ktpTeksSusun("Fotokopi KTP atas nama RIZKA, NIK 1 tanggal 07 Juli 2020 yang dikeluarkan", "1214", [p9]).nilai).toContain("tanggal 03 Mei 2012 yang");
  });

  it("tanggal petugas yang BEDA = tawaran (tidak otomatis); yang SAMA dibiarkan (penulisan berbeda pun)", () => {
    const beda = M.ktpTeksSusun("Fotokopi KTP atas nama RIZKA, NIK 1 tanggal 20 Maret 2023 yang dikeluarkan", "1214", [P_RIZKA]);
    expect(beda.otomatis).toBe(false);
    expect(beda.perubahan).toEqual([expect.objectContaining({ aksi: "beda", dari: "20 Maret 2023", ke: "18 Februari 2012" })]);
    expect(beda.nilai).toContain("tanggal 18 Februari 2012 yang");
    for (const sama of ["18 Februari 2012", "18-02-2012", "18/2/2012", "18 Pebruari 2012", "18 02 2012"]) {
      const s = M.ktpTeksSusun(`Fotokopi KTP atas nama RIZKA, NIK 1 tanggal ${sama} yang dikeluarkan`, "1214", [P_RIZKA]);
      expect(s.nilai).toBe("");
      expect(s.perubahan).toEqual([]);
    }
  });

  it("bila ada yang kosong DAN yang beda: nilai hanya mengisi yang kosong; yang beda dicatat 'tidak diganti otomatis'", () => {
    const t =
      "1. Fotokopi KTP atas nama Siti Aminah, NIK 1 tanggal ... yang dikeluarkan oleh X;\n2. Fotokopi KTP atas nama Budi Santoso, NIK 2 tanggal 20 Maret 2023 yang dikeluarkan oleh X;";
    const P1 = { cabang: 1, urutan: 1, peran: "Pemohon I", nama: "SITI AMINAH", tanggalKtp: "18/02/2012", yakin: "cukup" };
    const P2 = { cabang: 1, urutan: 2, peran: "Pemohon II", nama: "BUDI SANTOSO", tanggalKtp: "07/09/2014", yakin: "cukup" };
    const s = M.ktpTeksSusun(t, "9958", [P1, P2]);
    expect(s.otomatis).toBe(true);
    expect(s.nilai).toContain("tanggal 18 Februari 2012 yang");
    expect(s.nilai).toContain("tanggal 20 Maret 2023 yang"); // petugas, tidak ditimpa
    expect(s.tetap.some((x: Apa) => /tidak diganti otomatis/.test(x.alasan))).toBe(true);
  });

  it("pihak dikenali LEMAH (nama satu kata) atau salah ketik ('rusak') = tawaran, tidak tercentang sendiri", () => {
    const lemah = M.ktpTeksSusun("Fotokopi KTP atas nama Siti, NIK 1 tanggal ... yang dikeluarkan", "5105", [{ ...P_RIZKA, nama: "SITI AMINAH" }]);
    expect(lemah.otomatis).toBe(false);
    expect(lemah.nilai).toContain("tanggal 18 Februari 2012 yang");
    const rusak = M.ktpTeksSusun("Fotokopi KTP atas nama RIZKA, NIK 1 tanggal 29-092020, yang dikeluarkan", "1214", [P_RIZKA]);
    expect(rusak.otomatis).toBe(false);
    expect(rusak.perubahan[0]).toMatchObject({ aksi: "beda", dari: "29-092020" });
  });

  it("bacaan 'ragu', tanggal e-Court tak terbaca, atau pihak tak dikenal = teks tidak diubah dan alasan dicatat", () => {
    const ragu = M.ktpTeksSusun(T1214_KOSONG, "1214", [{ ...P_RIZKA, yakin: "ragu" }]);
    expect(ragu.nilai).toBe("");
    expect(ragu.tetap.map((x: Apa) => x.alasan).join(" ")).toMatch(/ragu/);
    expect(M.ktpTeksSusun(T1214_KOSONG, "1214", [{ ...P_RIZKA, tanggalKtp: "31/02/2012" }]).nilai).toBe("");
    expect(M.ktpTeksSusun(T1214_KOSONG, "1214", []).nilai).toBe("");
  });

  it("'tanggal yang dikeluarkan' diisi dengan satu spasi pemisah; teks tanpa butir KTP tidak berubah", () => {
    const s = M.ktpTeksSusun("Fotokopi KTP dengan NIK 7203 atas nama RIZKA, tanggal yang dikeluarkan oleh Kabupaten Donggala", "1214", [P_RIZKA]);
    expect(s.nilai).toBe("Fotokopi KTP dengan NIK 7203 atas nama RIZKA, tanggal 18 Februari 2012 yang dikeluarkan oleh Kabupaten Donggala");
    expect(M.ktpTeksSusun("Bahwa Penggugat bertempat tinggal di Donggala.", "5105", [P_RIZKA])).toMatchObject({ ada: false, nilai: "" });
  });

  it("dua KTP pada satu teks: Pemohon I dan II masing-masing mendapat tanggalnya sendiri", () => {
    const t =
      "Fotokopi KTP atas nama SITI AMINAH, NIK 1 tanggal ..., yang dikeluarkan oleh X, diberi tanda P.1;\nFotokopi KTP atas nama BUDI SANTOSO, NIK 2 tanggal ..., yang dikeluarkan oleh X, diberi tanda P.2;";
    const P1 = { cabang: 1, urutan: 1, peran: "Pemohon I", nama: "SITI AMINAH", tanggalKtp: "18/02/2012", yakin: "cukup" };
    const P2 = { cabang: 1, urutan: 2, peran: "Pemohon II", nama: "BUDI SANTOSO", tanggalKtp: "07/09/2014", yakin: "cukup" };
    const s = M.ktpTeksSusun(t, "9958", [P1, P2]);
    expect(s.nilai).toContain("SITI AMINAH, NIK 1 tanggal 18 Februari 2012, yang");
    expect(s.nilai).toContain("BUDI SANTOSO, NIK 2 tanggal 07 September 2014, yang");
    expect(s.perubahan).toHaveLength(2);
  });
});

// ============================================================================
// E. panel: a3UsulanTanggalKtp
// ============================================================================
describe("E. a3UsulanTanggalKtp: variabel tanggal + teks, terisi otomatis", () => {
  const PIHAK = [P_RIZKA];
  const rute = (teksAsli: string, tipe = "data_teks") => async (url: string) => {
    if (url.includes("/ktp-pihak")) return jawab({ ada: true, pihak: PIHAK, catatan: [] });
    if (url.includes("/edit_data")) return { ok: true, status: 200, text: async () => borang(tipe, teksAsli) };
    throw new Error(`url tak dikenal ${url}`);
  };

  it("variabel teks 1214 berisi '...': usulan memuat teks lama utuh + tanggal e-Court, tercentang sendiri (awal), dengan konteks sebelum→sesudah", async () => {
    const diminta: string[] = [];
    const f = rute(T1214_KOSONG);
    const p = pasang({ sel: { "1214": T1214_KOSONG.replace(/\s+/g, " ") }, tipe: { "1214": "data_teks" } }, async (u) => {
      diminta.push(u);
      return f(u);
    });
    const r = await p.a3UsulanTanggalKtp("419/Pdt.G/2026/PA.Dgl");
    expect(r.usulan).toHaveLength(1);
    const u = r.usulan[0];
    expect(u).toMatchObject({ kode: "1214", keyakinan: "cukup", awal: true });
    expect(u.nilai).toBe(T1214_KOSONG.replace("tanggal ...,", "tanggal 18 Februari 2012,")); // baris baru asli terjaga
    expect(u.nilai).toContain("\n2. Fotokopi Kutipan Akta Nikah");
    expect(u.ringkas).toContain("isi tanggal KTP");
    expect(u.sumber[0]).toMatchObject({ asal: "ktp-ecourt" });
    expect(u.sumber[0].keterangan).toContain("tanggal [kosong → 18 Februari 2012],");
    // satu GET ktp-pihak + satu GET edit_data untuk 1214 - tidak ada permintaan tulis
    expect(diminta.map((x) => x.split("?")[0])).toEqual(["/aleta/api/aleta-ecourt/ktp-pihak", "http://abt.test/aps_badilag/abt/edit_data"]);
    expect(diminta[1]).toContain("no_var=1214");
    expect(diminta[1]).toContain("perkara_id=9293");
  });

  it("isi borang ABT yang berbeda dari yang tampil, karakter rusak, atau tipe bukan data_teks = TIDAK diubah, disebut di catatan", async () => {
    const beda = pasang({ sel: { "1214": T1214_KOSONG }, tipe: { "1214": "data_teks" } }, rute("isi yang sama sekali lain KTP tanggal ..."));
    const r1 = await beda.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl");
    expect(r1.usulan).toEqual([]);
    expect(r1.catatan).toContain("berbeda dari yang tampil");

    const rusak = pasang({ sel: { "1214": T1214_KOSONG }, tipe: { "1214": "data_teks" } }, rute(T1214_KOSONG.replace("RIZKA", "RIZ�KA")));
    expect((await rusak.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).catatan).toContain("karakter rusak");

    const sql = pasang({ sel: { "0315": T1214_KOSONG } }, rute(T1214_KOSONG, "data_sql"));
    expect((await sql.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan).toEqual([]);
  });

  it("variabel yang dihitung ABT (data_sql/data_sipp) tidak pernah diperiksa; isian kosong dan variabel tanpa KTP juga tidak", async () => {
    const dipanggil: string[] = [];
    const p = pasang(
      { sel: { "0315": T1214_KOSONG, "1214": "...", "5105": "Bahwa Penggugat tinggal di Donggala." }, tipe: { "0315": "data_sql", "1214": "data_teks", "5105": "data_teks" } },
      async (u) => {
        dipanggil.push(u);
        return jawab({ ada: true, pihak: PIHAK, catatan: [] });
      }
    );
    // 13 Okt (butir 14, 228/Pdt.P/2026): variabel alat bukti KTP yang DIKENAL (1214, 9958, ...) dan masih
    // kosong kini ikut diperiksa (dasarnya bawaan ABT di borang sunting); 0315 (data_sql) dan 5105 (tanpa KTP) tidak.
    expect(p.ktpKandidatTeks()).toEqual(["1214"]);
    const r = await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl");
    expect(r.usulan).toEqual([]); // borang ABT tiruan tidak berisi bawaan: tidak ada yang diusulkan
    expect(dipanggil.length).toBeGreaterThan(0);
  });

  it("13 Okt: 9958 masih DATA_TIDAK_ADA - bawaan ABT di borang (tanggal kosong) diisi dari KTP e-Court; variabel bawaan belum diolah tidak", async () => {
    const BAWAAN_9958 =
      "Fotokopi Kartu Tanda Penduduk atas nama RIZKA, NIK 7203144107930512 tanggal , yang dikeluarkan oleh Pemerintah Kabupaten Donggala, Provinsi Sulawesi Tengah, telah diberi meterai cukup, lalu oleh Pemohon diberi tanda P.1 serta diberi tanggal dan paraf Ketua Majelis;";
    const buat = (teks: string) =>
      pasang({ sel: { "9958": "DATA_TIDAK_ADA" }, tipe: { "9958": "data_teks" } }, async (u) =>
        /edit_data/.test(u) ? jawab(borang("data_teks", teks)) : jawab({ ada: true, pihak: [P_RIZKA], catatan: [] })
      );
    const p = buat(BAWAAN_9958);
    expect(p.ktpKandidatTeks()).toEqual(["9958"]);
    const r = await p.a3UsulanTanggalKtp("228/Pdt.P/2026/PA.Dgl");
    expect(r.usulan).toHaveLength(1);
    expect(r.usulan[0].kode).toBe("9958");
    expect(r.usulan[0].nilai).toContain("NIK 7203144107930512 tanggal 18 Februari 2012, yang dikeluarkan");
    const belum = await buat(BAWAAN_9958.replace("RIZKA", "#4048#")).a3UsulanTanggalKtp("228/Pdt.P/2026/PA.Dgl");
    expect(belum.usulan).toEqual([]);
    expect(belum.catatan).toMatch(/belum diolah/);
  });

  it("tipe yang baru diketahui SESUDAH dibaca halaman (data_sql) menggugurkan kandidat sebelum borang ABT diminta; variabel belum didefinisikan dilewati", async () => {
    const diminta: string[] = [];
    const p = pasang(
      { sel: { "0315": T1214_KOSONG, "0366": "DATA_TIDAK_ADA" }, nama: { "0366": "VARIABEL_TIDAK_TERSEDIA" }, muat: (tipe) => tipe.set("0315", "data_sql") },
      async (u) => {
        diminta.push(u);
        return jawab({ ada: true, pihak: [{ ...P_RIZKA, cabang: 1, urutan: 2 }], catatan: [] });
      }
    );
    expect(p.ktpKandidatTeks()).toEqual(["0315"]); // tipe belum diketahui saat disaring
    const r = await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl");
    expect(r.usulan).toEqual([]);
    expect(diminta.every((u) => u.includes("/ktp-pihak"))).toBe(true); // tak ada permintaan edit_data
  });

  it("variabel tanggal: kosong + cukup = tercentang; isian petugas BEDA = tidak dicentang (ocr), tidak ditimpa; SAMA = tidak ditampilkan; ragu = tidak dicentang", async () => {
    const SEMUA = [
      { ...P_RIZKA },
      { cabang: 1, urutan: 2, peran: "Pemohon II", nama: "Budi", tanggalKtp: "07/09/2014", yakin: "cukup", cocok: "nama_lahir" },
      { cabang: 2, urutan: 1, peran: "Termohon", nama: "Andi", tanggalKtp: "01/01/2013", yakin: "ragu", cocok: "nama", sebab: "hanya_nama_cocok" },
    ];
    const p = pasang(
      { sel: { "2222": "DATA_TIDAK_ADA", "0364": "18 Februari 2012", "0365": "...", "0366": "20 Mei 2020" }, tipe: {} },
      async () => jawab({ ada: true, pihak: SEMUA, catatan: [] })
    );
    const r = await p.a3UsulanTanggalKtp("1/Pdt.P/2026/PA.Dgl");
    const per = Object.fromEntries(r.usulan.map((u: Apa) => [u.kode, u]));
    expect(per["2222"]).toMatchObject({ nilai: "18/02/2012", keyakinan: "cukup", awal: true });
    expect(per["0364"]).toBeUndefined(); // sudah sama dengan e-Court
    expect(per["0365"]).toMatchObject({ keyakinan: "ragu", awal: false });
    expect(per["0366"]).toMatchObject({ nilai: "07/09/2014", keyakinan: "ocr", awal: false });
    expect(per["0366"].sumber[0].keterangan).toContain("isian sekarang 20 Mei 2020");
  });

  it("'pasti' (setelah terukur) membawa tingkat 'pasti' untuk isian kosong DAN (12OKT-M, 'langsung timpa') untuk isian petugas yang beda; 'cukup' beda tidak", async () => {
    const p = pasang({ sel: { "0364": "..." } }, async () => jawab({ ada: true, pihak: [{ ...P_RIZKA, yakin: "pasti" }], catatan: [] }));
    expect((await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0]).toMatchObject({ keyakinan: "cukup", tingkat: "pasti", awal: true });
    const q = pasang({ sel: { "0364": "20 Mei 2020" } }, async () => jawab({ ada: true, pihak: [{ ...P_RIZKA, yakin: "pasti" }], catatan: [] }));
    expect((await q.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0]).toMatchObject({ keyakinan: "cukup", tingkat: "pasti", awal: true, timpa: [{ dari: "20 Mei 2020", ke: "18/02/2012" }] });
    const r = pasang({ sel: { "0364": "20 Mei 2020" } }, async () => jawab({ ada: true, pihak: [{ ...P_RIZKA, yakin: "cukup" }], catatan: [] }));
    expect((await r.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0].tingkat).toBeUndefined();
  });

  it("teks dengan petik: usulan memuat peringatan penggantian; server lama (404) tanpa rute = catatan, tanpa galat", async () => {
    const dgPetik = T1214_KOSONG.replace("oleh Ketua Majelis", `oleh "Ketua" Majelis`);
    const p = pasang({ sel: { "1214": dgPetik }, tipe: { "1214": "data_teks" } }, rute(dgPetik));
    const r = await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl");
    expect(r.usulan[0].sumber.map((s: Apa) => s.keterangan).join(" ")).toContain("petik");
    const lama = pasang({ sel: { "1214": T1214_KOSONG }, tipe: { "1214": "data_teks" } }, async () => jawab({}, 404));
    const rl = await lama.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl");
    expect(rl.usulan).toEqual([]);
    expect(rl.catatan).toContain("belum punya rute");
  });

  it("galat server (500) tetap dilaporkan sebagai galat", async () => {
    const p = pasang({ sel: { "1214": T1214_KOSONG }, tipe: { "1214": "data_teks" } }, async () => jawab({}, 500));
    await expect(p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).rejects.toThrow(/500/);
  });
});

describe("E2. penolakan menulis bila isi di ABT berubah sejak dibaca (sebelumTulis) + jalur tulis", () => {
  const awal = sumber.indexOf("async function terapkanUsulanBerurutan(");
  const kode = sumber.slice(awal, sumber.indexOf("NOMOR 8 - PENJAGA SEBELUM CETAK", awal));
  function terap(spy: (k: string, v: string) => Promise<Apa>) {
    const f = new Function(
      "barisVariabel",
      "simpanVariabel",
      "catatRiwayat",
      "d2Koreksi",
      `${kode.slice(0, kode.lastIndexOf("/**"))}
return terapkanUsulanBerurutan;`
    );
    return f(() => new Map(), spy, async () => {}, () => ({}));
  }
  const jati = { perkaraId: "9293", perkTemp: "" };
  const butir = (usulan: Apa, disunting = false) => ({ usulan, centang: { checked: true, disabled: false }, nilai: () => usulan.nilai, disunting: () => disunting });

  it("isi ABT masih sama = ditulis; sudah berubah = TIDAK ditulis dan disebut gagal; disunting petugas = tidak diperiksa", async () => {
    const dasar = T1214_KOSONG;
    const p = pasang({ sel: { "1214": T1214_KOSONG.replace(/\s+/g, " ") }, tipe: { "1214": "data_teks" } }, async (u) => {
      if (u.includes("/ktp-pihak")) return jawab({ ada: true, pihak: [P_RIZKA], catatan: [] });
      return { ok: true, status: 200, text: async () => borang("data_teks", isiAbt.teks) };
    });
    const isiAbt = { teks: dasar };
    const usulan = (await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0];
    expect(typeof usulan.sebelumTulis).toBe("function");

    const ditulis: string[] = [];
    const terapkan = terap(async (k, v) => {
      ditulis.push(`${k}:${v.length}`);
      return { ok: true, pesan: "tersimpan" };
    });
    const sama = await terapkan([butir(usulan)], jati, () => {});
    expect(sama).toMatchObject({ berhasil: 1, gagal: [] });
    expect(ditulis).toEqual([`1214:${usulan.nilai.length}`]);

    isiAbt.teks = `${dasar}
3. Fotokopi Kartu Keluarga, Nomor 1 tanggal 5 Mei 2012;`; // orang lain menyunting sementara itu
    const berubah = await terapkan([butir(usulan)], jati, () => {});
    expect(berubah.berhasil).toBe(0);
    expect(berubah.gagal[0]).toContain("1214: isi variabel di ABT berubah sejak dibaca");
    expect(ditulis).toHaveLength(1); // tidak ada tulisan kedua

    const sunting = await terapkan([butir(usulan, true)], jati, () => {});
    expect(sunting.berhasil).toBe(1); // petugas yang menyunting sendiri bertanggung jawab atas teksnya
  });

  it("usulan tanpa sebelumTulis (tanggal KTP variabel tanggal, usulan SIPP/saksi lama) diterapkan seperti biasa", async () => {
    const ditulis: string[] = [];
    const terapkan = terap(async (k) => {
      ditulis.push(k);
      return { ok: true, pesan: "tersimpan" };
    });
    const r = await terapkan([butir({ kode: "0364", nama: "Tanggal KTP", nilai: "18/02/2012", keyakinan: "cukup", sumber: [{ asal: "ktp-ecourt" }] })], jati, () => {});
    expect(r).toMatchObject({ berhasil: 1, gagal: [] });
    expect(ditulis).toEqual(["0364"]);
  });
});

// ============================================================================
// F. pemasangan di panel hakim dan panitera
// ============================================================================
describe("F. pemasangan: centang awal mengikuti `awal`, kandidat teks ikut dibaca", () => {
  it("hakim (soreBacaIsi) dan panitera (p7UsulanTambahan) memanggil a3UsulanTanggalKtp juga untuk variabel teks", () => {
    const hakim = sumber.slice(sumber.indexOf("async function soreBacaIsi("), sumber.indexOf("function soreTerdeteksi("));
    expect(hakim).toContain("ktpKandidatTeks(barisVariabel()).length");
    expect(hakim).toContain("a3UsulanTanggalKtp(nomorPerkaraAbt())");
    const p7 = sumber.slice(sumber.indexOf("async function p7UsulanTambahan("), sumber.indexOf("function p7VariabelKosong("));
    expect(p7).toContain("ktpKandidatTeks(peta).length");
  });

  it("kartuUsulan: `awal` boolean menentukan centang awal; lencana hijau 'dari berkas KTP e-Court' untuk cukup; asal sumber bernama", () => {
    const kartu = sumber.slice(sumber.indexOf("function kartuUsulan("), sumber.indexOf("/* === KAMUS-DB 10 Okt === */"));
    expect(kartu).toContain('if (typeof u.awal === "boolean") centang.checked = u.awal && Boolean(u.nilai)');
    expect(kartu).toContain('dariKtp && u.keyakinan === "cukup"');
    expect(kartu).toContain('"dari berkas KTP e-Court"');
    expect(kartu).toContain('s.asal === "ktp-ecourt" ? "KTP e-Court"');
  });

  it("hakim: aturan 'blangko sudah berisi = tidak dicentang' tidak berlaku bagi usulan ber-`awal` (variabel teks alat bukti selalu berisi)", () => {
    const gambar = sumber.slice(sumber.indexOf("function soreGambarIsi("), sumber.indexOf("function soreBarisInput("));
    expect(gambar).toContain('if (typeof u.awal !== "boolean" && keadaanNilai(item.nilai) === "terisi")');
  });

  it("panitera (BAS): centang awal ikut `awal` (tipe harus diketahui data_teks/data_tanggal), baris memakai ringkasan bukan seluruh teks", () => {
    const p7 = sumber.slice(sumber.indexOf("function p7PasangBas("), sumber.indexOf("P3 - PUTUSAN PER STATUS"));
    expect(p7).toContain('if (typeof u.awal === "boolean") c.checked = u.awal && a3BolehDiisi(u.kode) === true && u.keyakinan !== "ragu";');
    expect(p7).toContain("${u.ringkas || u.nilai}");
  });

  it("jalur tulis tidak bertambah: hanya terapkanUsulanBerurutan -> simpanVariabel (blok KTP tidak memanggil edit_data POST)", () => {
    const ktp = sumber.slice(sumber.indexOf("/* === KTP-TEKS 12OKT-D === */"), sumber.indexOf("async function a3UsulanTanggalKtp("));
    expect(ktp).not.toMatch(/method:\s*"POST"/);
    expect(ktp).not.toContain("simpanVariabel(");
    expect(ktp).not.toContain("edit_data\", {");
  });
});

// ============================================================================
// G. isian ABT lokal sungguhan
// ============================================================================
async function mysqlHidup(): Promise<boolean> {
  return new Promise((ok) => {
    const s = net.connect({ host: "127.0.0.1", port: 3306 });
    const selesai = (v: boolean) => {
      s.destroy();
      ok(v);
    };
    s.setTimeout(800, () => selesai(false));
    s.on("connect", () => selesai(true));
    s.on("error", () => selesai(false));
  });
}
const dbAda = await mysqlHidup();

describe.skipIf(!dbAda)("G. atas isian ABT lokal (aps_badilag.abt_data_teks): penambal aman pada ribuan teks nyata", () => {
  it("semua isian bertanda KTP: tanpa galat, sisa teks utuh persis, hasil idempoten; kosong+kuat diisi, selebihnya tawaran", async () => {
    const mysql = createRequire(path.join(AKAR, "aleta_bot/package.json"))("mysql");
    const abt = mysql.createConnection({ host: "127.0.0.1", user: "root", password: "", database: "aps_badilag", charset: "latin1" });
    const sipp = mysql.createConnection({ host: "127.0.0.1", user: "root", password: "", database: "sipp_donggala" });
    const q = (db: Apa, sql: string): Promise<Apa[]> => new Promise((ok, no) => db.query(sql, (e: Error, r: Apa[]) => (e ? no(e) : ok(r))));
    let baris: Apa[] = [];
    try {
      baris = await q(abt, "select no_var, perkara_id, convert(data using utf8) d from abt_data_teks where data regexp 'Kartu Tanda Penduduk|KTP' limit 3000");
    } catch {
      abt.destroy();
      sipp.destroy();
      return; // basis data ABT lokal tidak ada: dilewati
    }
    if (!baris.length) {
      abt.destroy();
      sipp.destroy();
      return;
    }
    const ids = [...new Set(baris.map((r) => r.perkara_id))];
    const pihak: Record<string, Apa[]> = {};
    for (const c of [1, 2]) {
      for (const r of await q(sipp, `select perkara_id, urutan, nama from perkara_pihak${c} where perkara_id in (${ids.join(",")}) order by urutan`)) {
        (pihak[r.perkara_id] = pihak[r.perkara_id] || []).push({ cabang: c, urutan: Number(r.urutan) || 1, nama: r.nama });
      }
    }
    abt.destroy();
    sipp.destroy();
    let adaSlot = 0;
    let otomatis = 0;
    for (const r of baris) {
      const asli: string = r.d || "";
      const daftar = (pihak[r.perkara_id] || []).map((p) => ({ ...p, peran: p.cabang === 1 ? "Penggugat" : "Tergugat", tanggalKtp: "18/02/2012", yakin: "cukup" }));
      const s = M.ktpTeksSusun(asli, String(r.no_var).padStart(4, "0"), daftar);
      if (s.ada) adaSlot++;
      if (!s.nilai) continue;
      if (s.otomatis) otomatis++;
      // sisa teks utuh: tiap perubahan menyentuh HANYA rentang tanggal (<= 30 huruf angka/bulan/tanda) pada teks asli
      let kursor = 0;
      let rakit = "";
      for (const x of s.perubahan.slice().sort((a: Apa, b: Apa) => a.awal - b.awal)) {
        if (x.dari) expect(asli.slice(x.awal, x.akhir)).toBe(x.dari);
        // tanda kosong, sisipan tanpa teks, atau (13 Okt) "tanggal , yang" - spasi+koma yang diganti " <tanggal>, "
        else expect(asli.slice(x.awal, x.akhir)).toMatch(/^[.,_…\-]*$|^\s*,\s*$/);
        expect(x.akhir - x.awal).toBeLessThanOrEqual(30);
        expect(asli.slice(x.awal, x.akhir)).toMatch(/^[\dA-Za-z\s\-/.,_…]*$/);
        rakit += asli.slice(kursor, x.awal) + x.sisip;
        kursor = x.akhir;
      }
      expect(rakit + asli.slice(kursor)).toBe(s.nilai);
      // idempoten untuk yang diisi otomatis: pemanggilan kedua tidak menemukan bagian kosong lagi
      if (s.otomatis) expect(M.ktpTeksSusun(s.nilai, String(r.no_var).padStart(4, "0"), daftar).perubahan.filter((x: Apa) => x.aksi === "isi" && x.kuat)).toEqual([]);
    }
    expect(adaSlot).toBeGreaterThan(1000);
    expect(otomatis).toBeGreaterThan(0);
  }, 120000);
});
