// @vitest-environment node
/**
 * ============================================================================
 * 16 OKT 2026 MALAM - BLANGKO ABT BY DERRY BRIANTONO: ISIAN BERSYARAT, LABEL AWAM, BUKTI BEBAS, ZOOM
 * ============================================================================
 *
 * Keluhan pengguna: "abt masih mendeteksi variabel yang seharusnya tidak muncul (seperti contoh disini muncul
 * variabel ghaib dalam putusan)". Perkara 581/Pdt.G/2026 (CG verstek, e-Court, tanpa kuasa) menampilkan
 * tanggal pengumuman ghaib, tanggal surat kuasa Tergugat, pengadilan tinggi advokat, kuasa insidentil.
 *
 * Yang dijaga:
 *   susun.ts  keadaan tiap isian dari nama ABT (#111xx#, "Isi Apabila #0047# Pakai Kuasa", "GHAIB",
 *             "KUASA INSIDENTIL", "BERACARA SECARA ELEKTRONIK") + pemicu ABT yang sama untuk kuasa T;
 *             tingkat penting/tambahan untuk pengingat cetak; label awam tanpa keterangan teknis;
 *             7139 sebagai pilihan bernilai (Sepakat/Tidak), bukan "(1 = sepakat, 2 = tidak)".
 *   ekstensi  aturan berlaku per perkara (581 / berkuasa / ghaib / prodeo) - fungsi murni yang SAMA dengan
 *             yang dipakai layar; kalimat bukti dengan bagian opsional + tulis manual; perkiraan zoom
 *             halaman (ABT diperkecil 67% -> tampilan dikembalikan ke ukuran rancangan).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";

import { keadaanIsian, rapikanNama, susunIsian, type ButirIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
/** Potongan katalog ABT server 16 Okt (nama persis; kueri diringkas ke rujukannya saja). */
const KATALOG = new Map<string, Definisi>([
  D("8503", "ALASAN PERCERAIAN SATU HURUF: A, B, C, D, E, F, G, H GABUNGAN BEBAS", "data_teks"),
  D("8521", "PERTIMBANGAN FAKTA HUKUM PERCERAIAN (OTOMATIS)", "data_sql", "select data from abt_data_teks where no_var=8503"),
  D("7139", "<mark>SEPAKAT BERACARA SECARA ELEKTRONIK (1 = SEPAKAT, 2= TIDAK)</mark>", "data_teks"),
  D("7140", "<mark>DETEKSI SEPAKAT BERACARA SECARA ELEKTRONIK</mark>", "data_sql", "SELECT ... no_var=7139 ..."),
  D("8509", "DUDUK PERKARA KUASA/TIDAK (E-COURT/BIASA) (OTOMATIS)", "data_sql", "#7140# #8541#"),
  D("8564", "TANGGAL PENGUMUMAN PANGGILAN GHAIB I DAN II - ISIAN bila SIPP tidak memuat (contoh: 22 Januari 2026 dan 24 Februari 2026)", "data_teks"),
  D("7063", "WAKTU PANGGILAN RADIO OTOMATIS", "data_sql", "-- 1) isian 8564 ... no_var=8564"),
  D("8526", "PERTIMBANGAN HUKUM GHAIB/BIASA (OTOMATIS) (MASIH UNTUK VERSTEK)", "data_sql", "CASE WHEN ghaib = 1 THEN '... #7063# ...' END"),
  D("0185", "Tgl. Surat Kuasa #0047# (Isi Apabila #0047# Pakai Kuasa)", "data_tanggal"),
  D("8541", "KALIMAT KUASA #0047# (OTOMATIS: advokat, kantor, alamat, tgl surat kuasa)", "data_sql", "... #0185# ..."),
  D("8892", "PENGADILAN TINGGI TEMPAT ADVOKAT #0046# DISUMPAH (kosong = Pengadilan Tinggi Sulawesi Tengah), contoh: Pengadilan Tinggi Sulawesi Selatan", "data_teks"),
  D("8893", "PENGADILAN TINGGI SUMPAH ADVOKAT (OTOMATIS dari isian 8892)", "data_sql", "no_var=8892"),
  D("8894", "NO KUASA INSIDENTIL: nama penerima kuasa insidentil #0046# (contoh: Rahmadhani binti M. Kasim)", "data_teks"),
  D("8516", "KEHADIRAN PIHAK DI KAKI PUTUSAN", "data_sql", "... no_var=8894 ..."),
  D("0156", "Kantor Kuasa #0046# (nama kantor di surat kuasa/gugatan, mis. DERRY & PARTNERS) #11111#", "data_teks"),
  D("0661", "No. SK Prodeo #11112#", "data_teks"),
  D("8536", "Putusan pidana (khusus alasan C, tanpa kata salinan) #11116#", "data_teks"),
  D("1214", "Alat-alat bukti CG/CT", "data_teks"),
  D("11111", "PENANDA ADA KUASA #0046#", "data_sql", "select ..."),
  D("11112", "PENANDA ADA PRODEO", "data_sql", "select ..."),
  D("11113", "PENANDA ADA KUASA #0047#", "data_sql", "select ..."),
  D("11116", "PENANDA ALASAN C (8503)", "data_sql", "select ..."),
]);
const PENANDA = ["8521", "8509", "8526", "8893", "8516", "0156", "0661", "8536", "1214"];
const SEBUTAN = { P: "Penggugat", T: "Tergugat", gugatan: "gugatan" };
const h = susunIsian(PENANDA, KATALOG, SEBUTAN);
const by = (k: string) => h.isian.find((b) => b.kode === k) as ButirIsian;

describe("susun.ts: keadaan, tingkat, label awam", () => {
  it("keadaan dibaca dari nama ABT; kuasa Tergugat memakai pemicu ABT #11113# walau namanya tidak bertanda", () => {
    expect(by("0185")).toMatchObject({ keadaan: "kuasaT", pemicu: "11113", nama: "Tanggal surat kuasa Tergugat" });
    expect(by("8564")).toMatchObject({ keadaan: "ghaib", pemicu: "", langsung: false });
    expect(by("7139")).toMatchObject({ keadaan: "ecourt", pemicu: "" });
    expect(by("8894")).toMatchObject({ keadaan: "insidentil", langsung: false });
    expect(by("8892")).toMatchObject({ keadaan: "kuasaP", pemicu: "11111" });
    expect(by("0156")).toMatchObject({ keadaan: "kuasaP", pemicu: "11111" });
    expect(by("0661")).toMatchObject({ keadaan: "prodeo", pemicu: "11112" });
    expect(by("8536")).toMatchObject({ keadaan: "alasanC", pemicu: "11116" });
    expect(by("8503").keadaan).toBe(""); // namanya menyebut "H (murtad)" tetapi alasan perceraian selalu berlaku
    expect(h.pemicu.map((p) => p.kode)).toEqual(["11111", "11112", "11113", "11116"]);
    expect(keadaanIsian("Tgl Pemberian Izin Kuasa Insidentil P")).toBe("insidentil");
    expect(keadaanIsian("Media pengumuman panggilan ghaib #0047#")).toBe("ghaib");
    expect(keadaanIsian("Telah Dikarunai Anak")).toBe("");
  });

  it("tingkat: masuk naskah/amar/pertimbangan = penting; berbawaan atau 'bila SIPP tidak memuat' = tambahan", () => {
    expect(by("8503").tingkat).toBe("penting"); // dibaca PERTIMBANGAN
    expect(by("0185").tingkat).toBe("penting"); // kalimat kuasa dibaca duduk perkara yang tertulis di naskah
    expect(by("7139").tingkat).toBe("penting");
    expect(by("8564").tingkat).toBe("tambahan"); // SIPP biasanya memuatnya
    expect(by("8892").tingkat).toBe("tambahan"); // kosong = Pengadilan Tinggi Sulawesi Tengah
    expect(by("1214").tingkat).toBe("penting");
  });

  it("label awam: tanpa kode, tanpa '(1 = sepakat, 2 = tidak)', tanpa 'ISIAN bila SIPP tidak memuat'; 7139 pilihan bernilai", () => {
    expect(by("7139").nama).toBe("Beracara secara elektronik");
    expect(by("7139").opsi).toEqual([
      { nilai: "1", label: "Sepakat beracara secara elektronik" },
      { nilai: "2", label: "Tidak sepakat beracara secara elektronik" },
    ]);
    expect(by("8564").nama).toBe("Tanggal pengumuman panggilan ghaib pertama dan kedua");
    expect(by("8892").nama).toBe("Pengadilan Tinggi tempat advokat Penggugat disumpah");
    expect(susunIsian(PENANDA, KATALOG, { P: "Pemohon", T: "Termohon" }).isian.find((b) => b.kode === "0185")!.nama).toBe("Tanggal surat kuasa Termohon");
    // Nama ABT tanpa kamus: huruf kapital dibiasakan, contoh/syarat dibuang, singkatan tetap.
    expect(rapikanNama("TANGGAL PENGUMUMAN PANGGILAN GHAIB I DAN II - ISIAN bila SIPP tidak memuat (contoh: 22 Januari 2026)")).toBe("Tanggal pengumuman panggilan ghaib I dan II");
    expect(rapikanNama("PENGADILAN TINGGI TEMPAT ADVOKAT #0046# DISUMPAH (kosong = Pengadilan Tinggi Sulawesi Tengah), contoh: PT Sulsel", SEBUTAN)).toBe(
      "Pengadilan tinggi tempat advokat Penggugat disumpah"
    );
    expect(rapikanNama("NOMOR KTP PEMOHON (KOSONG = DARI SIPP)")).toBe("Nomor KTP pemohon");
    for (const b of h.isian) expect(b.nama).not.toMatch(/#\d|\(\s*1\s*=|isian bila|<mark>/i);
  });
});

// ----------------------------------------------------------------------------
// Ekstensi: fungsi murni yang sama dengan layar
// ----------------------------------------------------------------------------
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8");
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/lain/", runScripts: "outside-only" });
const w = dom.window as unknown as { eval: (s: string) => void; aletaBlangkoDerry: any; aletaBlangkoDerryIsian: any; chrome: unknown };
w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } }, runtime: { id: "uji" } };
w.eval(baca("blangko-derry.js"));
w.eval(baca("blangko-derry-isian.js"));
afterAll(() => dom.window.close());
const murniI = () => w.aletaBlangkoDerryIsian.murni;

type PerkaraUji = { prodeo: boolean; ghaib: boolean; lewatEcourt: boolean | null; kuasaP: boolean; kuasaT: boolean };
/** Isian yang tampil untuk satu perkara: pemicu ABT dihitung seperti #11111#/#11113#/#11112# (SIPP), C dari huruf 8503. */
function tampil(p: PerkaraUji, isi: Record<string, string> = {}) {
  const menyala = (k: string) => (k === "11111" ? p.kuasaP : k === "11113" ? p.kuasaT : k === "11112" ? p.prodeo : k === "11116" ? /C/.test(isi["8503"] || "") : false);
  const terisi = (b: ButirIsian) => Boolean(String(isi[b.kode] || "").trim());
  return h.isian.filter((b) => b.wajib && murniI().keadaanBerlakuMurni(b, { perkara: p, menyala, terisi })).map((b) => b.kode);
}

describe("ekstensi: isian hanya muncul bila keadaannya berlaku", () => {
  const dasar = { prodeo: false, ghaib: false, lewatEcourt: true, kuasaP: false, kuasaT: false };
  it("581/Pdt.G/2026 (CG verstek, e-Court, tanpa kuasa): tanpa ghaib, tanpa kuasa, tanpa kuasa insidentil, tanpa prodeo", () => {
    expect(tampil(dasar, { "8503": "AF" })).toEqual(["8503", "7139", "1214"]);
  });
  it("Penggugat berkuasa: kantor advokat + PT tempat advokat disumpah; Tergugat berkuasa: tanggal surat kuasa T", () => {
    expect(tampil({ ...dasar, kuasaP: true })).toEqual(["8503", "7139", "0156", "8892", "1214"]);
    expect(tampil({ ...dasar, kuasaT: true })).toEqual(["8503", "7139", "0185", "1214"]);
  });
  it("ghaib: tanggal pengumuman panggilan ghaib muncul; perkara bukan e-Court: beracara elektronik hilang", () => {
    expect(tampil({ ...dasar, ghaib: true, lewatEcourt: false })).toEqual(["8503", "8564", "1214"]);
    expect(tampil({ ...dasar, lewatEcourt: null })).toContain("7139"); // tidak diketahui = tetap tampil
  });
  it("prodeo (dari pemicu ABT atau data perkara SIPP) dan alasan C dari huruf yang diketik", () => {
    expect(tampil({ ...dasar, prodeo: true })).toEqual(["8503", "7139", "0661", "1214"]);
    expect(tampil(dasar, { "8503": "CF" })).toContain("8536");
  });
  it("kuasa insidentil yang hanya dibaca variabel lain muncul bila sudah terisi; yang tertulis langsung di blangko selalu", () => {
    expect(tampil(dasar, { "8894": "Rahmadhani binti M. Kasim" })).toContain("8894");
    const langsung = susunIsian(["8894"], KATALOG, SEBUTAN).isian[0];
    expect(murniI().keadaanBerlakuMurni(langsung, { perkara: dasar, menyala: () => false, terisi: () => false })).toBe(true);
  });
});

describe("ekstensi: kalimat alat bukti - semua bagian opsional, tulis manual", () => {
  it("bagian kosong tidak ditulis; pencocokan 'kopian sebelumnya' dan 'tanpa kalimat'", () => {
    const k = murniI().kalimatBukti;
    expect(k({ nm: "Fotokopi Surat Pernyataan", an: "Manaf Mustawi", no: "", tgl: "2016-06-24", oleh: "", meterai: 0, cocok: 4 }, "T", 2)).toBe(
      "Fotokopi Surat Pernyataan atas nama Manaf Mustawi tanggal 24 Juni 2016, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, lalu diberi tanda T.3 serta diberi tanggal dan paraf oleh Ketua Majelis;"
    );
    expect(k({ nm: "Fotokopi Akta Hibah", an: "Tuan Manaf Mustawi", no: "27/HB/Klawara/XI/2016", tgl: "2016-11-01", oleh: "Pejabat Pembuat Akta Tanah Notaris/PPAT Sigi", meterai: 0, cocok: 3 }, "T", 0)).toBe(
      "Fotokopi Akta Hibah atas nama Tuan Manaf Mustawi, Nomor 27/HB/Klawara/XI/2016 tanggal 1 November 2016, yang dikeluarkan oleh Pejabat Pembuat Akta Tanah Notaris/PPAT Sigi, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan kopian sebelumnya dan ternyata sesuai, lalu diberi tanda T.1 serta diberi tanggal dan paraf oleh Ketua Majelis;"
    );
    expect(k({ nm: "Fotokopi Kartu Keluarga", an: "", no: "", tgl: "", oleh: "", meterai: 3, cocok: 1 }, "P", 1)).toBe(
      "Fotokopi Kartu Keluarga, bukti surat tersebut tidak dapat dicocokkan dengan aslinya, lalu diberi tanda P.2 serta diberi tanggal dan paraf oleh Ketua Majelis;"
    );
    expect(murniI().jenisBukti("Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el)")).toBe("ktp");
    expect(murniI().jenisBukti("Fotokopi Kartu Keluarga")).toBe("kk");
  });
  it("kalimat berbentuk lain dibuka sebagai tulis manual tanpa diubah; kodenya mengikuti urutan", () => {
    const asli =
      "Fotokopi Surat Pernyataan atas nama Manaf Mustawi, tertanggal 24 Juni 2016. Bukti tersebut telah diberi meterai cukup, dinazegellen pos dan surat tersebut telah dicocokkan dengan aslinya dan ternyata sesuai dengan aslinya, lalu diberi tanggal dan diparaf oleh Ketua Majelis, kemudian diberi tanda pada surat tersebut dengan tanda T.3.;";
    const rows = murniI().uraiBukti(asli);
    expect(rows).toHaveLength(1);
    expect(rows[0].manual).toBe(asli);
    expect(murniI().kalimatBukti(rows[0], "T", 2)).toBe(asli);
    expect(murniI().kalimatBukti(rows[0], "T", 0)).toContain("dengan tanda T.1.;");
    // Manual tanpa kode: ekor baku ditambahkan.
    expect(murniI().kalimatBukti({ manual: "Fotokopi Salinan Putusan Nomor 84/PDT/2025/PT.PAL. Bukti tersebut telah diberi meterai cukup, dinazegellen pos." }, "P", 4)).toBe(
      "Fotokopi Salinan Putusan Nomor 84/PDT/2025/PT.PAL. Bukti tersebut telah diberi meterai cukup, dinazegellen pos, lalu diberi tanda P.5 serta diberi tanggal dan paraf oleh Ketua Majelis;"
    );
  });
  it("kalimat baku ABT/ALETA terurai ke kolom: atas nama dan NIK terpisah, lalu tersusun kembali sama persis", () => {
    const baku =
      "Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama YULFIANI, NIK 7271036411920011 tanggal 23 April 2025, yang dikeluarkan oleh Pemerintah Kabupaten Sigi, Provinsi Sulawesi Tengah, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;";
    const [r] = murniI().uraiBukti(baku);
    expect(r).toMatchObject({ nm: "Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el)", an: "YULFIANI", no: "7271036411920011", tgl: "2025-04-23", manual: null });
    expect(murniI().kalimatBukti(r, "P", 0)).toBe(baku);
  });
});

describe("kerangka: tampilan melawan zoom kecil halaman ABT", () => {
  it("perkiraan zoom Chrome dari ukuran jendela dan devicePixelRatio; zoom perbesar dibiarkan", () => {
    const z = w.aletaBlangkoDerry.murni.perkiraanZoom;
    expect(z(1920, 2841, 0.67)).toBe(0.67); // ABT diperkecil 67% (tangkapan layar pengguna 16 Okt)
    expect(z(1920, 2268, 0.67)).toBe(0.67); // ... dengan panel samping Chrome terbuka
    expect(z(1920, 1904, 1)).toBe(1);
    expect(z(1536, 1216, 1.25)).toBe(1); // layar Windows 125% + panel samping: bukan zoom
    expect(z(1920, 1536, 1.25)).toBe(1); // diperbesar 125%: pilihan petugas, tidak dilawan
    expect(z(0, 0, 1)).toBe(1);
  });
});
