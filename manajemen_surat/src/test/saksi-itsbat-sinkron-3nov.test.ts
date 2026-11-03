// @vitest-environment node
/**
 * ============================================================================
 * SAKSI ITSBAT: MENU KETERANGAN SAKSI DI PENETAPAN KABUL + KATALOG = BUNYI PUTUSAN [01] IN (3 Nov 2026 sore)
 * ============================================================================
 *
 * Laporan Derry (penetapan Itsbat Nikah e-Court, blangko "2 Itsbat Nikah/[01] [Kabul] IN"): bagian 3 "Perlu diisi" panel
 * Blangko Derry tidak punya menu keterangan saksi, padahal putusan cerai punya.
 *
 * Sebab (diukur atas blangko server 2 Nov + abt_variabel server 3 Nov, dibaca saja): [01] IN mencetak keterangan saksi lewat
 * #9259#/#9260# - variabel data_sql yang memanggil fungsi isian_rtf_ket_saksi dengan nama saksi #1197#/#1203#; tidak satu pun
 * variabel tanya_jawab ("Keterangan Saksi 1 P" 2021, "TanyaJwb Saksi 1 P" 5058) terjangkau. susunIsian hanya membuat butir
 * "Tanya jawab saksi" dari variabel tanya_jawab, jadi bagian itu tidak ada. Putusan cerai Format Lengkap memuat #2021#/#2022#
 * di grup tersembunyi {\*\isianasal}; 44 dari 302 putusan bermuatan #9259#-#9265# (Itsbat [01]-[01e], [03]-[03c], Dispensasi
 * Kawin, Perwalian, Asal Usul Anak, Ahli Waris, ...) tidak.
 *
 * Yang dijaga:
 *   A. susunIsian menautkan #9259#-#9265# ke variabel Keterangan Saksi N P/T -> butir "Tanya jawab saksi" (penyunting 5058/5059)
 *      tampil, urut saksi 1 lalu 2, tanpa butir ganda pada blangko cerai yang sudah memuat #2021#; blangko tanpa keterangan
 *      saksi tetap tanpa butir saksi. Panel ABT lama: gerbang a3BlangkoMemuatSaksi mengenal kode yang SAMA (dijalankan).
 *   B. katalog saksi itsbat (permohonan dua pemohon, keadaan bawaan) memuat setiap fakta putusan [01] IN dengan nilai isian
 *      yang sama (wali, yang menikahkan, saksi nikah + banyak orang, mahar, ijab kabul tanpa jeda, darah/semenda/sesusuan,
 *      tidak berpoligami, rukun sampai sekarang, ...), saksi 1 dan saksi 2 berkalimat berbeda.
 *   C. pilihan pengetahuan lama tetap (istifadhah, hadir di pesta - rincian akad tidak ditanyakan / "tidak tahu" bersebab);
 *      tidak ada jawaban "tidak tahu" yang menggantung (keputusan 157).
 * Data rekaan saja.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

import { KETERANGAN_SAKSI_OTOMATIS, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const REPO = path.resolve(process.cwd(), "..");
const EK = path.join(REPO, "ekstensi-sipp");
const req = createRequire(import.meta.url);

// ── A. menu tanya jawab saksi ──────────────────────────────────────────────
const def = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const kueriKet = (nama: string) =>
  `SELECT aps_badilag.isian_rtf_ket_saksi('#perkara_id#', (SELECT CAST(d.id AS CHAR) FROM pihak a JOIN perkara_pihak5 d ON d.pihak_id = a.id AND d.perkara_id = '#perkara_id#' WHERE a.nama = "${nama}" ORDER BY d.urutan LIMIT 1)) AS data`;
const KATALOG = new Map<string, Definisi>([
  def("0046", "Sebutan #0046#", "data_sql", "SELECT 'Pemohon' AS data"),
  def("1197", "Nama Saksi 1 P", "data_sql", "SELECT 'x' AS data"),
  def("1203", "Nama Saksi 2 P", "data_sql", "SELECT 'x' AS data"),
  def("6100", "Nama Saksi 1 T", "data_sql", "SELECT 'x' AS data"),
  def("9259", "KETERANGAN SAKSI 1 #0046# TANPA BARIS KOSONG (OTOMATIS)", "data_sql", kueriKet("#1197#")),
  def("9260", "KETERANGAN SAKSI 2 #0046# TANPA BARIS KOSONG (OTOMATIS)", "data_sql", kueriKet("#1203#")),
  def("9264", "KETERANGAN SAKSI 1 #0047# TANPA BARIS KOSONG (OTOMATIS)", "data_sql", kueriKet("#6100#")),
  def("2021", "Keterangan Saksi 1 P", "tanya_jawab"),
  def("2022", "Keterangan Saksi 2 P", "tanya_jawab"),
  def("2023", "Keterangan Saksi 1 T", "tanya_jawab"),
  def("2031", "Keterangan Saksi 3 P", "tanya_jawab"),
  def("8920", "Keterangan Saksi 4 P", "tanya_jawab"),
  def("8932", "Keterangan Saksi 5 P", "tanya_jawab"),
  def("2024", "Keterangan Saksi 2 T", "tanya_jawab"),
  def("5058", "TanyaJwb Saksi 1 P", "tanya_jawab"),
  def("5059", "TanyaJwb Saksi 2 P", "tanya_jawab"),
  def("6120", "TanyaJwb Saksi 1 T", "tanya_jawab"),
  def("5197", "Tgl Nikah", "data_teks"),
  def("1046", "Status Wali Nikah", "data_teks"),
]);
const SEBUTAN = { P: "Pemohon", T: "Termohon" };
// Urutan penanda tabel ABT blangko "2 Itsbat Nikah/[01] [Kabul] IN" (kode variabel saja, dari blangko server 2 Nov), dipotong
// pada yang relevan: identitas saksi, keterangan otomatis, isian nikah. Tidak ada #2021#/#5058#.
const PENANDA_IN01 = ["0001", "0046", "5197", "1046", "1197", "9259", "1203", "9260", "0033"];
const tjDari = (penanda: string[]) => susunIsian(penanda, KATALOG, SEBUTAN).isian.filter((b) => b.jenis === "tj");

describe("A. penetapan kabul itsbat: menu tanya jawab saksi tampil", () => {
  it("[01] IN (#9259#/#9260# tanpa variabel tanya jawab) -> Tanya jawab Saksi 1 Pemohon dan Saksi 2 Pemohon, penyunting 5058/5059", () => {
    const tj = tjDari(PENANDA_IN01);
    expect(tj.map((b) => b.tj?.kunci)).toEqual(["saksi 1 p", "saksi 2 p"]);
    expect(tj.map((b) => b.tj?.sebutan)).toEqual(["Saksi 1 Pemohon", "Saksi 2 Pemohon"]);
    expect(tj.map((b) => b.tj?.kodeSunting)).toEqual(["5058", "5059"]);
    expect(tj.map((b) => b.kode)).toEqual(["2021", "2022"]);
    for (const b of tj) {
      expect(b.tingkat).toBe("penting");
      expect(b.langsung).toBe(false); // bukan baris tabel ABT blangko ini - hanya bagian saksi panel
      expect(b.dipakaiOleh.some((k) => /^92(59|60)$/.test(k))).toBe(true);
    }
  });
  it("blangko cerai yang sudah memuat #2021#/#2022# (grup isianasal) tidak mendapat butir saksi ganda", () => {
    const tj = tjDari(["0001", "1197", "9259", "1203", "9260", "2021", "2022"]);
    expect(tj.map((b) => b.tj?.kunci)).toEqual(["saksi 1 p", "saksi 2 p"]);
  });
  it("keterangan saksi lawan (#9264#) ikut, urut menurut letaknya di naskah; blangko tanpa keterangan saksi tetap tanpa butir saksi", () => {
    expect(tjDari(["9264", "9259"]).map((b) => b.tj?.kunci)).toEqual(["saksi 1 t", "saksi 1 p"]);
    expect(tjDari(["0001", "0046", "5197", "1046"])).toEqual([]);
  });
  it("peta tautan lengkap #9259#-#9265# dan semua sasarannya variabel Keterangan Saksi", () => {
    expect(Object.keys(KETERANGAN_SAKSI_OTOMATIS)).toEqual(["9259", "9260", "9261", "9262", "9263", "9264", "9265"]);
    for (const [asal, ke] of Object.entries(KETERANGAN_SAKSI_OTOMATIS)) expect(KATALOG.get(ke)?.nama, `${asal}->${ke}`).toMatch(/^Keterangan Saksi \d [PT]$/);
  });
  it("panel ABT lama: a3BlangkoMemuatSaksi menyalakan Susun keterangan saksi untuk kode yang sama (fungsi dijalankan)", () => {
    const src = readFileSync(path.join(EK, "abt-panel-blangko.js"), "utf8");
    const ambil = (pola: RegExp) => {
      const m = src.match(pola);
      expect(m, String(pola)).toBeTruthy();
      return m![0];
    };
    const kode = [
      ambil(/const VAR_SAKSI_1 = "\d+";/),
      ambil(/const VAR_SAKSI_2 = "\d+";/),
      ambil(/const VAR_SAKSI_TANYA_JAWAB = Object\.freeze\(\{[\s\S]*?\}\);/),
      ambil(/const VAR_NAMA_SAKSI = Object\.freeze\(\{[\s\S]*?\}\);/),
      ambil(/const A3_VAR_TANYA_JAWAB_SAKSI_LAIN = Object\.freeze\(\[[^\]]*\]\);/),
      ambil(/function a3BlangkoMemuatSaksi\(peta\) \{[\s\S]*?\n\}/),
      "globalThis.__uji = { a3BlangkoMemuatSaksi };",
    ].join("\n");
    const ctx: any = {};
    vm.createContext(ctx);
    vm.runInContext(kode, ctx);
    const { a3BlangkoMemuatSaksi } = ctx.__uji;
    const daftar = ambil(/const keteranganOtomatis = \[[^\]]*\];/).match(/\d{4}/g);
    expect(daftar).toEqual(Object.keys(KETERANGAN_SAKSI_OTOMATIS));
    expect(a3BlangkoMemuatSaksi(new Map(PENANDA_IN01.map((k) => [k, {}])))).toBe(true);
    for (const k of Object.keys(KETERANGAN_SAKSI_OTOMATIS)) expect(a3BlangkoMemuatSaksi(new Map([[k, {}]])), k).toBe(true);
    expect(a3BlangkoMemuatSaksi(new Map([["5197", {}], ["1046", {}]]))).toBe(false);
  });
});

// ── B/C. katalog = bunyi putusan [01] IN ─────────────────────────────────────
const FOLDER = path.join(EK, "saksi-katalog");
const semua = readdirSync(FOLDER).filter((n) => n.endsWith(".json")).map((n) => JSON.parse(readFileSync(path.join(FOLDER, n), "utf8")));
(globalThis as any).ALETA_SAKSI_KATALOG_DATA = semua;
req(path.join(EK, "saksi-katalog.js"));
const Bd = req(path.join(EK, "blangko-derry-katalog.js"));
const IN = semua.find((k: any) => k.kunci === "itsbat-nikah");
const JENIS = JSON.parse(readFileSync(path.join(EK, "saksi-katalog-jenis", "itsbat-nikah.json"), "utf8"));

/** Isian rekaan (kartu "Perlu diisi" [01] IN): nama rekaan. */
const VAR: Record<string, string> = {
  "5197": "13 Maret 1990",
  "5105": "Desa Contoh, wilayah hukum Kantor Urusan Agama Kecamatan Contoh",
  "1002": "jejaka",
  "1003": "perawan",
  "1046": "Ayah Kandung Pemohon II",
  "1217": "Rekaan Bapak",
  "8087": "Imam Desa Rekaan",
  "0650": "Saksi Nikah Satu",
  "0651": "Saksi Nikah Dua",
  "1001": "uang sejumlah Rp11.000,00 dibayar tunai",
  "0007": "telah dikaruniai seorang anak",
  "7211": "25 tahun",
  "7212": "20 tahun",
  "8171": "pengurusan buku nikah dan keperluan lainnya",
  "1358": "para Pemohon tidak melaporkan pernikahannya ke Pegawai Pencatat Nikah",
  "0101": "Desa Contoh",
};
function susun(keadaan: Record<string, string> = {}) {
  const h = Bd.susun({
    kat: IN,
    sebutan: { P: "Pemohon", T: "Termohon" },
    benih: "rekaan/Pdt.P/2026/PA.Dgl",
    keadaan: Bd.lengkapiBawaan(IN, { bentuk: "permohonan-berdua", ...keadaan }),
    saksi: [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }],
    variabel: (k: string) => VAR[k],
  });
  expect(h.ada).toBe(true);
  return h;
}
const baris = (h: any, id: string, ke = 0) => h.saksi[ke].baris.find((b: any) => b.butir === id);

/** Fakta hukum putusan [01] IN (butir 1-11 + kartu isian) -> butir katalog + bunyi yang wajib ada di jawaban KEDUA saksi. */
const FAKTA: { fakta: string; id: string; harus: (string | RegExp)[] }[] = [
  { fakta: "1 menikah tanggal #5197# di wilayah #5105#", id: "q-in-waktu-tempat-pb", harus: [VAR["5197"], VAR["5105"]] },
  { fakta: "1 tidak dicatatkan di KUA", id: "q-in-tidak-dicatat-pb", harus: [VAR["1358"]] },
  { fakta: "2 status #1002# / #1003#", id: "q-in-status-pb", harus: [VAR["1002"], VAR["1003"]] },
  { fakta: "3 wali nikah #1046#", id: "q-in-wali-pb", harus: [VAR["1046"]] },
  { fakta: "4 yang menikahkan #8087#", id: "q-in-menikahkan-pb", harus: [VAR["8087"]] },
  { fakta: "5 saksi nikah #0650# dan #0651#, juga disaksikan banyak orang", id: "q-in-saksi-nikah-pb", harus: [VAR["0650"], VAR["0651"], /disaksikan (?:oleh|pula oleh) banyak orang/] },
  { fakta: "6 mahar #1001#", id: "q-in-mahar-pb", harus: [VAR["1001"]] },
  { fakta: "7 ijab kabul tanpa jeda waktu", id: "q-in-ijab-kabul-pb", harus: [/ijab/, /kabul/, /tanpa jeda waktu yang lama/] },
  { fakta: "8 tidak ada hubungan darah, semenda, sesusuan", id: "q-in-halangan-pb", harus: [/darah/, /semenda/, /susuan/] },
  { fakta: "9 tidak ada pihak yang keberatan", id: "q-in-keberatan-pb", harus: [/tidak ada pihak yang keberatan|tidak (?:ada|pernah ada)\b.*keberatan/] },
  { fakta: "10 Pemohon I tidak pernah berpoligami", id: "q-in-poligami-pb", harus: [/tidak pernah (?:berpoligami|beristri lain|menikah lagi)/] },
  { fakta: "10 belum pernah bercerai", id: "q-in-tidak-bercerai-pb", harus: [/tidak pernah bercerai|belum pernah bercerai/] },
  { fakta: "10 hidup rukun sampai sekarang", id: "q-in-hidup-bersama-pb", harus: [/rukun/, /sampai sekarang/] },
  { fakta: "11 tujuan itsbat (#8171#)", id: "q-in-tujuan-pb", harus: [VAR["8171"]] },
  { fakta: "kartu Anak #0007#", id: "q-in-anak-pb", harus: [VAR["0007"]] },
  { fakta: "kartu Umur #7211#/#7212#", id: "q-in-umur-pb", harus: [VAR["7211"], VAR["7212"]] },
];

describe("B. katalog saksi itsbat = bunyi fakta putusan [01] IN", () => {
  const h = susun();
  for (const f of FAKTA) {
    it(`fakta ${f.fakta} -> ${f.id} pada susunan bawaan kedua saksi, nilai isian sama`, () => {
      for (const ke of [0, 1]) {
        const b = baris(h, f.id, ke);
        expect(b, `${f.id} saksi ${ke + 1}`).toBeTruthy();
        for (const p of f.harus) {
          if (typeof p === "string") expect(b.jawab, `${f.id} saksi ${ke + 1}`).toContain(p);
          else expect(b.jawab, `${f.id} saksi ${ke + 1}`).toMatch(p);
        }
        expect(b.jawab).not.toMatch(/#\d{4,5}#|\{(?:sumber|hal|hubungan)\}/);
      }
      expect(baris(h, f.id, 0).jawab, `${f.id}: saksi 1 dan 2 harus berkalimat berbeda`).not.toBe(baris(h, f.id, 1).jawab);
    });
  }
  it("pertanyaan poligami: kalimatnya tanpa istilah teknis, hal untuk jawaban 'tidak tahu' menyebut apa yang tidak diketahui", () => {
    const q = IN.pertanyaan.find((x: any) => x.id === "q-in-poligami-pb");
    expect(q.teks).toMatch(/berpoligami/);
    expect(q.hal).toMatch(/istri lain/);
    expect(q.keadaan).toEqual({ bentuk: "permohonan-berdua" });
    expect(JENIS.pertanyaan.some((x: any) => x.id === "q-in-poligami-pb")).toBe(true); // ikut berkas per jenis (dimuat ekstensi)
  });
  it("versi B 'berbeda' tidak ikut disamakan (ijab kabul selang waktu, saksi nikah orang lain)", () => {
    const ij = IN.pertanyaan.find((x: any) => x.id === "q-in-ijab-kabul-pb").jawaban.berbeda;
    expect(ij.saksi2.every((t: string) => !/tanpa jeda/.test(t))).toBe(true);
    const sn = IN.pertanyaan.find((x: any) => x.id === "q-in-saksi-nikah-pb").jawaban.berbeda;
    expect(sn.saksi2.every((t: string) => !/banyak orang/.test(t))).toBe(true);
  });
  it("pasangan meninggal / gugatan: 'rukun sampai sekarang' TIDAK ditambahkan", () => {
    for (const id of ["q-in-hidup-bersama-pm", "q-in-hidup-bersama-lw"]) {
      const q = IN.pertanyaan.find((x: any) => x.id === id);
      if (!q) continue;
      expect(JSON.stringify(q.jawaban), id).not.toMatch(/sampai sekarang/);
    }
  });
});

describe("C. pilihan pengetahuan lama tetap; tidak ada 'tidak tahu' menggantung", () => {
  it("hadir di pesta: rincian akad tidak ditanyakan, yang tetap ditanyakan menjawab 'tidak tahu' beserta sebabnya", () => {
    const h = susun({ bentukKesaksian: "pesta" });
    const ids = h.saksi[0].baris.map((b: any) => b.butir);
    for (const id of ["q-in-wali-syarat-pb", "q-in-saksi-syarat-pb", "q-in-saksi-hadir-pb", "q-in-kabul-pribadi-pb"]) expect(ids, id).not.toContain(id);
    for (const id of ["q-in-ijab-kabul-pb", "q-in-saksi-nikah-pb"]) {
      const j = baris(h, id).jawab;
      expect(j, id).toMatch(/tidak (?:tahu|mengetahui)|tidak saya ketahui/);
      expect(j, id).toMatch(/pesta|akad/);
      expect(j, id).not.toMatch(/tanpa jeda|banyak orang/);
    }
    expect(ids).toContain("q-in-poligami-pb");
  });
  it("istifadhah tetap memuat kabar yang tersiar luas", () => {
    const ids = susun({ bentukKesaksian: "istifadhah" }).saksi[0].baris.map((b: any) => b.butir);
    expect(ids).toEqual(expect.arrayContaining(["q-in-kabar-luas-pb", "q-in-kenal-masyarakat-pb"]));
  });
  it("seluruh jawaban katalog itsbat: tidak ada 'saya tidak tahu' tanpa objek", () => {
    const GANTUNG = /^(?:tidak,?\s*)?(?:saya\s+)?(?:tidak|kurang|belum)\s+(?:pernah\s+)?(?:tahu|mengetahui(?:nya)?|melihat(?:nya)?|mendengar(?:nya)?|kenal)\s*[.;,]?$/i;
    const kalimat: string[] = [];
    const jalan = (x: any) => (typeof x === "string" ? kalimat.push(x) : Array.isArray(x) ? x.forEach(jalan) : x && typeof x === "object" ? Object.values(x).forEach(jalan) : 0);
    for (const q of IN.pertanyaan) jalan(q.jawaban);
    jalan(IN.jawabanUmum);
    expect(kalimat.length).toBeGreaterThan(3000);
    expect(kalimat.filter((t) => GANTUNG.test(t.trim()))).toEqual([]);
    for (const t of IN.jawabanUmum["tidak-tahu"].saksi1.concat(IN.jawabanUmum["tidak-tahu"].saksi2)) expect(t).toContain("{hal}");
  });
});
