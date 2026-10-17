// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET PENETAP, PHS SITA DAN PUTUSAN SELA (I9): abt-penetap-phs-sita-derry
 * ============================================================================
 *
 * Paket (BELUM terpasang di server; keadaan disusun di fixtures/blangko-derry-server-17okt.json dari daftar-rtf.tsv dan PASANG.sql paket):
 *   - `99 PTSP`: PPP dan PJS berkas TUNGGAL `@ 0a - PPP.rtf` / `@ 0b - PJS.rtf` (gabungan `@ 0` tetap = cadangan); PHS sita `@ 2a` dikabulkan / `@ 2b` ditolak;
 *   - folder baru `97 Sita` (menu 150 "Putusan Sela & Penetapan Sita"): putusan sela [01] kabul, [02] tolak (jalur ditangguhkan -> sidang insidentil -> putusan sela).
 * Yang dijaga: (A) pohon; (B) bot PETA_PTSP dan peta() (berkas tunggal, cadangan, varian sita, perkara bersita) beserta ciri isi atas RTF paket bila ada di laptop;
 * (C) peta penetapan portal (bawaan PPP/PJS, cadangan, varian sita, tidak ikut tersimpan); (D) putusan sela sita di rekomendasi dan set pohon;
 * (E) mesin e-Doc ekstensi: cadangan bila berkas tunggal tidak ada, varian sita tanpa jatuh ke bawaan.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { jenisFolderDerry, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import {
  BAWAAN_PETA_PENETAPAN,
  BERKAS_PJS_TUNGGAL,
  BERKAS_PPP_TUNGGAL,
  BERKAS_PTSP_GABUNGAN,
  VARIAN_SITA_PHS,
  aturUntukBot,
  bersihkanAturPenetapan,
} from "@/lib/peta-penetapan";
import { setBlangkoGabung, setCocokPerkara, setUntukPerkara } from "@/lib/pohon-blangko";
import { FOLDER_MENU_PUTUSAN, PUTUSAN_SELA_SITA, masukanRekomendasiDariBaris, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";
import { folderTugas, tugasBlangko } from "@/lib/tugas-blangko";
import { petaPenetapanBerlaku } from "@/server/modules/aleta-ecourt/peta-penetapan";

type BarisMenu = { id: number; nama: string; nama_alias: string; direktori: string; parent_direktori: string; user_cek: number; user_grup_id: string; user_top_id: string; perkara_id_min?: string; perkara_id_max?: string; perkara_id_referensi?: string };
const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[]; menu: BarisMenu[] };
const A = "derry_briantono/";
const PTSP = "99 PTSP";
const SITA = "97 Sita";
const BARU = ["@ 0a - PPP.rtf", "@ 0b - PJS.rtf", "@ 2a - PHS - Sita Dikabulkan.rtf", "@ 2b - PHS - Sita Ditolak.rtf"];

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");
const jalurBot = (r: string) => require_.resolve(path.join(akarBot, r));
type Modul = { filename: string; loaded: boolean; exports: unknown };
const ModulKelas = require_("module") as unknown as new (id: string) => Modul;
const dipasang: string[] = [];
function pasang(relatif: string, isi: unknown) {
  const jalur = jalurBot(relatif);
  const m = new ModulKelas(jalur);
  m.filename = jalur;
  m.loaded = true;
  m.exports = isi;
  (require_.cache as Record<string, unknown>)[jalur] = m;
  dipasang.push(jalur);
}
function muatSegar<T>(relatif: string): T {
  const jalur = jalurBot(relatif);
  delete (require_.cache as Record<string, unknown>)[jalur];
  const m = require_(jalur) as T;
  delete (require_.cache as Record<string, unknown>)[jalur];
  return m;
}
type Edoc = {
  PETA_PTSP: { berkasGabungan: string; jenis: Record<string, { berkasTunggal: string; cadangan?: string; varian?: Record<string, string>; bagianGabungan: number }> };
  ambilBagian: (rtf: string, jenis: string) => { ok: boolean; alasan?: string };
  buatLayanan: (d: Record<string, unknown>) => { peta: (m: Record<string, unknown>) => Promise<any> };
};
function modulEdoc(): Edoc {
  pasang("db_config.js", { query: () => undefined });
  pasang("bot_db_config.js", { query: () => undefined });
  const m = muatSegar<Edoc>("services/penetapanEdocService.js");
  for (const j of dipasang.splice(0)) delete (require_.cache as Record<string, unknown>)[j];
  return m;
}

describe("A. pohon server: berkas baru, folder 97 Sita, menu 150", () => {
  it("empat berkas PTSP baru + @ 0 gabungan tetap + dua putusan sela di 97 Sita", () => {
    for (const b of [...BARU, "@ 0 - PMH - PHS.rtf", "@ 1 - PMH.rtf", "@ 2 - PHS.rtf"]) expect(FIX.berkas, b).toContain(`${A}${PTSP}/${b}`);
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${SITA}/`)).map((b) => b.split("/").pop())).toEqual([
      "[01] [Kabul] Putusan Sela - Sita Dikabulkan.rtf",
      "[02] [Tolak] Putusan Sela - Sita Ditolak.rtf",
    ]);
    expect(PUTUSAN_SELA_SITA.kabul).toBe("[01] [Kabul] Putusan Sela - Sita Dikabulkan.rtf");
    expect(PUTUSAN_SELA_SITA.tolak).toBe("[02] [Tolak] Putusan Sela - Sita Ditolak.rtf");
    expect(FIX.berkas).toContain(`${PUTUSAN_SELA_SITA.folder}/${PUTUSAN_SELA_SITA.kabul}`);
    expect(FIX.berkas).toContain(`${PUTUSAN_SELA_SITA.folder}/${PUTUSAN_SELA_SITA.tolak}`);
  });

  it("menu 150 'Putusan Sela & Penetapan Sita': putusan hakim di folder 97 Sita, acuan alur 15-17; FOLDER_MENU_PUTUSAN mengenalnya", () => {
    const m = FIX.menu.find((x) => x.id === 150)!;
    expect(m).toMatchObject({ nama: "Putusan Sela & Penetapan Sita", nama_alias: "Sita - Putusan Sela", direktori: SITA, parent_direktori: "derry_briantono", user_cek: 3, user_grup_id: "1|10|20", user_top_id: "1", perkara_id_min: "15", perkara_id_max: "17", perkara_id_referensi: "alur_perkara_id" });
    expect(FOLDER_MENU_PUTUSAN[m.nama]).toBe(SITA);
    expect(PUTUSAN_SELA_SITA.menu).toBe(m.nama);
    expect(PUTUSAN_SELA_SITA.alias).toContain(m.nama_alias);
    // Menu hakim seperti menu putusan lain (hak sama dengan 133/135/137).
    const hak = FIX.menu.find((x) => x.id === 133)!;
    expect([m.user_cek, m.user_grup_id, m.user_top_id]).toEqual([hak.user_cek, hak.user_grup_id, hak.user_top_id]);
    expect(tugasBlangko(`${A}${SITA}/[01] [Kabul] Putusan Sela - Sita Dikabulkan.rtf`)).toBe("hakim");
    expect(jenisFolderDerry(SITA)).toBe("put");
    expect(tugasBlangko(`${A}${PTSP}/@ 0a - PPP.rtf`)).toBe("ptsp");
  });
});

describe("B. bot: PETA_PTSP, peta() dan ciri isi", () => {
  it("PPP/PJS berkas tunggal dengan cadangan gabungan; PHS varian sita; PMH/PHS bawaan tidak berubah", () => {
    const { PETA_PTSP } = modulEdoc();
    expect(PETA_PTSP.berkasGabungan).toBe("@ 0 - PMH - PHS.rtf");
    expect(PETA_PTSP.jenis.ppp).toMatchObject({ berkasTunggal: "@ 0a - PPP.rtf", cadangan: "@ 0 - PMH - PHS.rtf", bagianGabungan: 2 });
    expect(PETA_PTSP.jenis.pjs).toMatchObject({ berkasTunggal: "@ 0b - PJS.rtf", cadangan: "@ 0 - PMH - PHS.rtf", bagianGabungan: 3 });
    expect(PETA_PTSP.jenis.pmh.berkasTunggal).toBe("@ 1 - PMH.rtf");
    expect(PETA_PTSP.jenis.phs.berkasTunggal).toBe("@ 2 - PHS.rtf");
    expect(PETA_PTSP.jenis.phs.varian).toEqual({ "sita-dikabulkan": "@ 2a - PHS - Sita Dikabulkan.rtf", "sita-ditolak": "@ 2b - PHS - Sita Ditolak.rtf" });
    for (const k of [BARU[0], BARU[1], BARU[2], BARU[3]]) expect(FIX.berkas).toContain(`${A}${PTSP}/${k}`);
  });

  const depsPeta = (sita: unknown) => ({
    kueriSipp: async (sql: string) => {
      if (sql.includes("FROM perkara WHERE")) return [{ perkara_id: 901, nomor_perkara: "12/Pdt.G/2026/PA.Dgl" }];
      return [];
    },
    dokumen: {
      TABEL_PENETAPAN: { pmh: "perkara_penetapan", ppp: "perkara_panitera_pn", pjs: "perkara_jurusita", phs: "perkara_penetapan_hari_sidang" },
      JENIS_DOKUMEN_ID: { pmh: 1, ppp: 2, pjs: 3, phs: 4 },
      pengaturanBlangko: () => ({ aktif: true, pmh: "x", ppp: "x", pjs: "x", phs: "x" }),
    },
    ...(sita === undefined ? {} : { sita }),
  });

  it("peta(): berkas tunggal tampil sebagai berkas, cadangan dan varian ikut; perkara bersita ditandai (benar/salah/tidak terbaca)", async () => {
    const { buatLayanan } = modulEdoc();
    const bersita = await buatLayanan(depsPeta(async () => ({ sita: { "901": { ada: true } }, eksekusi: {} }))).peta({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl" });
    expect(bersita.ok).toBe(true);
    expect(bersita.perkara).toMatchObject({ perkaraId: 901, bersita: true });
    const j = Object.fromEntries(bersita.jenis.map((x: { jenis: string }) => [x.jenis, x]));
    expect(j.ppp.blangko).toMatchObject({ berkas: "@ 0a - PPP.rtf", bagianGabungan: 2, cadangan: "@ 0 - PMH - PHS.rtf" });
    expect(j.pjs.blangko).toMatchObject({ berkas: "@ 0b - PJS.rtf", cadangan: "@ 0 - PMH - PHS.rtf" });
    expect(j.phs.blangko.varian).toEqual({ "sita-dikabulkan": BARU[2], "sita-ditolak": BARU[3] });
    expect(j.pmh.blangko.cadangan).toBeUndefined();
    const tanpa = await buatLayanan(depsPeta(async () => ({ sita: {}, eksekusi: {} }))).peta({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl" });
    expect(tanpa.perkara.bersita).toBe(false);
    const gagal = await buatLayanan(depsPeta(async () => Promise.reject(new Error("tabel tidak terbaca")))).peta({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl" });
    expect(gagal.perkara.bersita).toBeNull(); // tidak ditebak
    const lama = await buatLayanan(depsPeta(undefined)).peta({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl" });
    expect(lama.perkara.bersita).toBeNull();
  });

  const RTF = "D:/aleta-dev/kerja/batch-14okt-sore/i9-penetap-phs-sita/abt-penetap-phs-sita-derry/paket-satker/rtf/derry_briantono/99 PTSP/";
  it.skipIf(!existsSync(RTF))("ciri isi: berkas tunggal PPP/PJS hanya memuat jenisnya, @ 2a/@ 2b dikenali sebagai PHS, gabungan @ 0 tetap memuat empat bagian (RTF paket di laptop)", () => {
    const { ambilBagian } = modulEdoc();
    const baca = (n: string) => readFileSync(RTF + n, "latin1");
    expect(ambilBagian(baca("@ 0a - PPP.rtf"), "ppp").ok).toBe(true);
    expect(ambilBagian(baca("@ 0a - PPP.rtf"), "pjs").ok).toBe(false);
    expect(ambilBagian(baca("@ 0b - PJS.rtf"), "pjs").ok).toBe(true);
    expect(ambilBagian(baca("@ 0b - PJS.rtf"), "ppp").ok).toBe(false);
    for (const n of [BARU[2], BARU[3]]) {
      expect(ambilBagian(baca(n), "phs").ok, n).toBe(true);
      expect(ambilBagian(baca(n), "pmh").ok, n).toBe(false);
    }
    for (const j of ["pmh", "ppp", "pjs", "phs"]) expect(ambilBagian(baca("@ 0 - PMH - PHS.rtf"), j).ok, j).toBe(true);
  });
});

describe("C. peta penetapan portal", () => {
  it("bawaan PPP/PJS = berkas tunggal, cadangan = gabungan; PMH/PHS tanpa cadangan; unggah otomatis PPP/PJS tetap mati", () => {
    expect(BAWAAN_PETA_PENETAPAN.ppp).toMatchObject({ namaBerkas: BERKAS_PPP_TUNGGAL, namaBerkasCadangan: BERKAS_PTSP_GABUNGAN, otomatisUnggah: false, aktif: true });
    expect(BAWAAN_PETA_PENETAPAN.pjs).toMatchObject({ namaBerkas: BERKAS_PJS_TUNGGAL, namaBerkasCadangan: BERKAS_PTSP_GABUNGAN, otomatisUnggah: false, aktif: true });
    expect(BERKAS_PPP_TUNGGAL).toBe("@ 0a - PPP.rtf");
    expect(BERKAS_PJS_TUNGGAL).toBe("@ 0b - PJS.rtf");
    expect(BAWAAN_PETA_PENETAPAN.pmh.namaBerkasCadangan).toBeUndefined();
    expect(BAWAAN_PETA_PENETAPAN.phs.namaBerkas).toBe("@ 2 - PHS.rtf");
    expect(VARIAN_SITA_PHS).toEqual({ dikabulkan: BARU[2], ditolak: BARU[3] });
    // Satu sumber dengan bot
    const { PETA_PTSP } = modulEdoc();
    expect(PETA_PTSP.jenis.ppp.berkasTunggal).toBe(BERKAS_PPP_TUNGGAL);
    expect(PETA_PTSP.jenis.pjs.berkasTunggal).toBe(BERKAS_PJS_TUNGGAL);
    expect(PETA_PTSP.jenis.ppp.cadangan).toBe(BERKAS_PTSP_GABUNGAN);
    expect(PETA_PTSP.jenis.phs.varian).toEqual({ "sita-dikabulkan": VARIAN_SITA_PHS.dikabulkan, "sita-ditolak": VARIAN_SITA_PHS.ditolak });
    // Pengaturan yang diteruskan ke bot tidak membawa nama blangko (nama lewat peta, bukan aturBerlaku)
    expect(Object.keys(aturUntukBot(BAWAAN_PETA_PENETAPAN.ppp))).not.toContain("namaBerkas");
  });

  it("butir yang dikirim ke ekstensi: cadangan dari bawaan (juga bila admin pernah menyimpan baris), varian sita hanya PHS", async () => {
    const fake = (baris: Array<Record<string, unknown>>) => ({ prepare: () => ({ all: async () => baris }) }) as never;
    const bawaan = await petaPenetapanBerlaku(fake([]));
    const per = Object.fromEntries(bawaan.map((b) => [b.jenis, b]));
    expect(per.ppp).toMatchObject({ namaBerkas: "@ 0a - PPP.rtf", namaBerkasCadangan: "@ 0 - PMH - PHS.rtf", sumber: "bawaan", varianSita: {} });
    expect(per.pjs).toMatchObject({ namaBerkas: "@ 0b - PJS.rtf", namaBerkasCadangan: "@ 0 - PMH - PHS.rtf" });
    expect(per.phs.varianSita).toEqual({ dikabulkan: BARU[2], ditolak: BARU[3] });
    expect(per.pmh.varianSita).toEqual({});
    // Admin menyimpan PPP dengan nama gabungan (pengaturan 16 Okt): nama itu dihormati; cadangan tetap dari bawaan
    const tersimpan = await petaPenetapanBerlaku(
      fake([{ kunci: "penetapan|ppp", nama_berkas: "@ 0 - PMH - PHS.rtf", catatan: JSON.stringify({ aktif: true, otomatisUnggah: false, pakaiCap: true, penandatangan: "panitera" }), diubah_oleh: "u", diubah_pada: "2026-10-16T00:00:00Z" }])
    );
    const ppp = tersimpan.find((b) => b.jenis === "ppp")!;
    expect(ppp).toMatchObject({ namaBerkas: "@ 0 - PMH - PHS.rtf", namaBerkasCadangan: "@ 0 - PMH - PHS.rtf", sumber: "admin" });
    // Membersihkan butir tidak membuang cadangan dari bawaan
    expect(bersihkanAturPenetapan("ppp", { namaBerkas: "@ 0a - PPP.rtf" }).namaBerkasCadangan).toBe("@ 0 - PMH - PHS.rtf");
  });
});

describe("D. putusan sela sita: rekomendasi dan set pohon", () => {
  const rek = (m: Parameters<typeof rekomendasiBlangko>[0]) => rekomendasiBlangko({ urutanSidang: 3, dihadiriOleh: 1, ...m }).putusan;
  const HB = { jenisPerkara: "Harta Bersama", nomorPerkara: "30/Pdt.G/2026/PA.Dgl" };

  it("sidang pembacaan putusan sela atas permohonan sita: [01] kabul (perkiraan) dan [02] tolak dari folder 97 Sita, menu 150; bukan putusan akhir", () => {
    const r = rek({ ...HB, agenda: "Pembacaan putusan sela", bersita: true });
    expect(r.map((x) => x.berkas)).toEqual([PUTUSAN_SELA_SITA.kabul, PUTUSAN_SELA_SITA.tolak]);
    expect(r[0]).toMatchObject({ jenis: "putusan", folder: `${A}${SITA}`, menu: "Putusan Sela & Penetapan Sita", alias: ["Sita - Putusan Sela"], utama: true, perkiraan: true });
    expect(r[1].utama).toBe(false);
    for (const x of r) expect(FIX.berkas, x.berkas).toContain(`${x.folder}/${x.berkas}`);
    // alasan tunda mendahului agenda (teks dasar): "Putusan sela sita" ditulis di alasan
    expect(rek({ ...HB, agenda: "Sidang lanjutan", alasanDitunda: "Putusan sela permohonan sita jaminan" })[0].berkas).toBe(PUTUSAN_SELA_SITA.kabul);
    // perkara belum ditandai bersita tetapi agendanya menyebut sita/insidentil: tetap ditawarkan, diberi catatan
    const tanpaTanda = rek({ ...HB, agenda: "Putusan sela sita jaminan" });
    expect(tanpaTanda[0].berkas).toBe(PUTUSAN_SELA_SITA.kabul);
    expect(tanpaTanda[0].alasan).toMatch(/belum ditandai bersita/);
  });

  it("sela di luar konteks sita tidak diubah (eksepsi): perilaku lama; perkara yang sudah putus tidak mendapat putusan sela", () => {
    const eks = rek({ ...HB, agenda: "Putusan sela eksepsi" });
    expect(eks.some((x) => x.folder.endsWith(SITA))).toBe(false);
    expect(eks[0]?.berkas ?? "").toMatch(/^\[01\] \[Kabul\]/); // dulu: perkiraan putusan akhir dikabulkan
    const putus = rek({ ...HB, agenda: "Pembacaan putusan sela", bersita: true, sudahPutus: true, statusPutusan: "Dikabulkan" });
    expect(putus.some((x) => x.folder.endsWith(SITA))).toBe(false);
    // sidang biasa perkara bersita tidak mendapat putusan sela
    expect(rek({ ...HB, agenda: "Pembuktian", bersita: true }).some((x) => x.folder.endsWith(SITA))).toBe(false);
  });

  it("isian sita (9162-9164) berlabel awam, sama untuk BAS insidentil dan putusan sela", () => {
    const D = (kode: string, nama: string): [string, Definisi] => [kode, { kode, nama, jenis: "data_teks", sql: "", bawaan: "" }];
    const katalog = new Map<string, Definisi>([D("9162", "SITA: OBJEK - ISIAN"), D("9163", "SITA: ALASAN - ISIAN"), D("9164", "SITA: TANGGAPAN #0047# - ISIAN")]);
    const label = Object.fromEntries(susunIsian([...katalog.keys()], katalog).isian.map((b) => [b.kode, b.nama]));
    expect(label).toEqual({
      "9162": "Objek yang dimohonkan untuk disita (satu per baris)",
      "9163": "Alasan permohonan sita",
      "9164": "Tanggapan Tergugat/Termohon atas permohonan sita (dari jawaban atau sidang insidentil)",
    });
  });

  it("baris jadwal bot: kolom `sita` terisi -> bersita", () => {
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Harta Bersama", sita: { jenis: "jaminan" } }).bersita).toBe(true);
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Harta Bersama", sita: null }).bersita).toBe(false);
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Harta Bersama" }).bersita).toBe(false);
  });

  it("folder 97 Sita menjadi set putusan hakim tanpa jenis perkara: TIDAK pernah cocok jenis mana pun (tidak mengisi pemetaan putusan akhir)", () => {
    expect(folderTugas(SITA)).toMatchObject({ jenis: "putusan", tugas: "hakim", untuk: [] });
    const gabung = setBlangkoGabung([SITA, "4a Harta Bersama", "1 Perceraian CG"]);
    const sita = gabung.find((s) => s.folder === `${A}${SITA}`)!;
    expect(sita).toMatchObject({ jenis: "putusan", untuk: [] });
    for (const jenis of ["Harta Bersama", "Kewarisan", "Ekonomi Syariah", "Cerai Gugat", "Cerai Talak", "Lain-Lain"]) {
      expect(setCocokPerkara(sita, jenis, "1/Pdt.G/2026/PA.Dgl"), jenis).toBe(false);
      expect(setUntukPerkara(jenis).some((s) => s.folder === sita.folder && s.cocok), jenis).toBe(false);
    }
  });
});

describe("E. ekstensi: e-Doc penetapan dengan cadangan dan varian sita", () => {
  const sumber = readFileSync(path.resolve(__dirname, "../../../ekstensi-sipp/konten.js"), "utf8");
  function ambilFungsi(nama: string): string {
    const awal = sumber.indexOf(`async function ${nama}(`);
    expect(awal, nama).toBeGreaterThan(0);
    let kedalaman = 0;
    let i = sumber.indexOf("{", awal);
    for (; i < sumber.length; i += 1) {
      if (sumber[i] === "{") kedalaman += 1;
      else if (sumber[i] === "}" && --kedalaman === 0) break;
    }
    return sumber.slice(awal, i + 1);
  }

  /** Menjalankan e6UnggahEdocPenetapan dengan tiruan; mencatat blangko yang dicetak. */
  async function jalankan(butir: Array<Record<string, unknown>>, ada: Set<string>, p: Record<string, unknown>) {
    const dicetak: string[] = [];
    const dikirim: Array<{ jenis: string; berkas: string }> = [];
    const tulisan: string[] = [];
    const konteks = vm.createContext({
      e6BacaPeta: async () => ({ ok: true, butir }),
      e6JenisDipakai: (b: Array<Record<string, unknown>>, jenis: string[]) => b.filter((x) => jenis.includes(String(x.jenis)) && x.aktif === true),
      e6PerkaraId: async () => "901",
      e6CetakRtfAbt: async (_id: string, b: Record<string, unknown>) => {
        dicetak.push(String(b.namaBerkas));
        return ada.has(String(b.namaBerkas)) ? { ok: true, rtfBase64: "e1xydGYxfQ==" } : { ok: false, sebab: `blangko "${b.namaBerkas}" tidak ditemukan di ABT ini` };
      },
      s2KirimEdoc: async (badan: string) => {
        for (const x of JSON.parse(badan).abt) dikirim.push({ jenis: x.jenis, berkas: x.berkas });
        return { ok: true, d: { berkas: [] } };
      },
      s2ModeMenahan: () => "",
      s2JedaTulis: async () => undefined,
      b7BacaSudahTerunggah: async () => [],
      e6RingkasHasil: () => "",
      namaPenggunaSipp: () => "u",
      S2_API_EDOC_UNGGAH: "/x",
    });
    vm.runInContext(ambilFungsi("e6UnggahEdocPenetapan"), konteks);
    const kabar = { className: "", textContent: "" };
    await vm.runInContext("e6UnggahEdocPenetapan", konteks)({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl", perkaraId: "901", otomatis: false, kering: true, kabar, ...p });
    tulisan.push(kabar.textContent);
    return { dicetak, dikirim, tulisan };
  }

  const PPP = { jenis: "ppp", aktif: true, namaBerkas: "@ 0a - PPP.rtf", namaBerkasCadangan: "@ 0 - PMH - PHS.rtf", kelompok: "Form Bantu PTSP" };
  const PHS = { jenis: "phs", aktif: true, namaBerkas: "@ 2 - PHS.rtf", kelompok: "Form Bantu PTSP", varianSita: { dikabulkan: BARU[2], ditolak: BARU[3] } };

  it("PPP: berkas tunggal dipakai bila ada; bila tidak ada, gabungan @ 0 (nama yang dikirim ke portal = berkas yang benar-benar tercetak)", async () => {
    const ada = await jalankan([PPP], new Set(["@ 0a - PPP.rtf", "@ 0 - PMH - PHS.rtf"]), { jenis: ["ppp"] });
    expect(ada.dicetak).toEqual(["@ 0a - PPP.rtf"]);
    expect(ada.dikirim).toEqual([{ jenis: "ppp", berkas: "@ 0a - PPP.rtf" }]);
    const cadangan = await jalankan([PPP], new Set(["@ 0 - PMH - PHS.rtf"]), { jenis: ["ppp"] });
    expect(cadangan.dicetak).toEqual(["@ 0a - PPP.rtf", "@ 0 - PMH - PHS.rtf"]);
    expect(cadangan.dikirim).toEqual([{ jenis: "ppp", berkas: "@ 0 - PMH - PHS.rtf" }]);
    const tiada = await jalankan([PPP], new Set(), { jenis: ["ppp"] });
    expect(tiada.dikirim).toEqual([]);
    expect(tiada.tulisan[0]).toMatch(/PPP: .*tidak ditemukan/);
    // tanpa cadangan (PMH): tidak mencoba berkas lain
    const pmh = await jalankan([{ jenis: "pmh", aktif: true, namaBerkas: "@ 1 - PMH.rtf" }], new Set(["@ 0 - PMH - PHS.rtf"]), { jenis: ["pmh"] });
    expect(pmh.dicetak).toEqual(["@ 1 - PMH.rtf"]);
  });

  it("PHS: tanpa pilihan = bawaan @ 2; sita dikabulkan = @ 2a; ditolak = @ 2b; varian yang tidak ada TIDAK jatuh ke @ 2", async () => {
    const semua = new Set(["@ 2 - PHS.rtf", BARU[2], BARU[3]]);
    expect((await jalankan([PHS], semua, { jenis: ["phs"] })).dikirim).toEqual([{ jenis: "phs", berkas: "@ 2 - PHS.rtf" }]);
    expect((await jalankan([PHS], semua, { jenis: ["phs"], sita: "" })).dikirim).toEqual([{ jenis: "phs", berkas: "@ 2 - PHS.rtf" }]);
    expect((await jalankan([PHS], semua, { jenis: ["phs"], sita: "dikabulkan" })).dikirim).toEqual([{ jenis: "phs", berkas: BARU[2] }]);
    expect((await jalankan([PHS], semua, { jenis: ["phs"], sita: "ditolak" })).dikirim).toEqual([{ jenis: "phs", berkas: BARU[3] }]);
    const hilang = await jalankan([PHS], new Set(["@ 2 - PHS.rtf"]), { jenis: ["phs"], sita: "dikabulkan" });
    expect(hilang.dicetak).toEqual([BARU[2]]);
    expect(hilang.dikirim).toEqual([]);
    // pilihan sita tidak mengubah jenis lain, dan peta lama tanpa varianSita tetap bawaan
    expect((await jalankan([{ ...PHS, varianSita: undefined }], semua, { jenis: ["phs"], sita: "ditolak" })).dikirim).toEqual([{ jenis: "phs", berkas: "@ 2 - PHS.rtf" }]);
  });

  it("tombol di tab PTSP memuat pilihan sita yang tersembunyi sampai portal menyatakan perkara bersita", () => {
    const awal = sumber.indexOf("function e6BagianEdocPenetapan(");
    const badan = sumber.slice(awal, sumber.indexOf("/* === KONTAK-EC 11 Okt === */", awal));
    expect(badan).toContain('data-e6-sita');
    expect(badan).toContain("barisSita.hidden = true");
    expect(badan).toMatch(/if \(bersita === true\) barisSita\.hidden = false/);
    expect(badan).toMatch(/sita: pilihSita\.value/);
    for (const nilai of ['""', '"dikabulkan"', '"ditolak"']) expect(badan).toContain(`[${nilai}, "Sita:`);
  });
});
