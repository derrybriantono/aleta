// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET KEPUTUSAN 18 OKT SORE (I25): abt-keputusan-18okt-sore-derry
 * ============================================================================
 *
 * Isi paket (peta: i25-keputusan-18okt-sore/PEMETAAN-ALETA.md): 2 BAS baru "10a Ekonomi Syariah Biasa - BAS" (cabut sesudah jawaban, ALUR 43 langkah CS / CM),
 * penyuntingan BAS verstek Izin Poligami (ALUR 34 langkah V2, berkas sama, isinya bertambah) dengan isian BARU 9760 (9761 otomatis), bawaan popup 9956 (P.10: 5178 menggantikan 5009)
 * dan 9957 (P.3: 0654/0655 menggantikan 0652/0653).
 * Yang dijaga: (A) ALUR 43 +2 langkah dan berkasnya di pohon; (B) pemilihan CS / CM hanya untuk ES acara biasa (Pdt.G), gugatan sederhana tetap ALUR 40;
 * (C) BAS verstek Poligami tetap satu berkas V2; (D) isian: 9760 berlabel awam, 9761 otomatis, 5178 muncul lewat 9956, 5009 keluar dari daftar, 0654/0655 berlabel.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ALUR_BAS_BARU, jenisBasBaru, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { rujukan, susunIsian } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/";
// 30 Okt 2026: langkah PS (pemeriksaan setempat) menunjuk berkas BARU paket ABT abt-paket/sela-ps-30okt (belum ada di pohon server 17 Okt).
const PAKET_SELA_PS = readFileSync(path.resolve(__dirname, "../../../abt-paket/sela-ps-30okt/paket-satker/daftar-rtf.tsv"), "utf8")
  .split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t")).map(([f, b]) => `${f}/${b}`);
const SERVER_DAN_PAKET = [...FIX.berkas, ...PAKET_SELA_PS];
const F10A_BAS = "10a Ekonomi Syariah Biasa - BAS";
const CS = "BAS ALUR 43 ES Acara Biasa - Cabut sesudah Jawaban - Tergugat Setuju.rtf";
const CM = "BAS ALUR 43 ES Acara Biasa - Cabut sesudah Jawaban - Tergugat Menolak.rtf";
const MD5 = { [CS]: "b0eca941501155d34ccc7a18438aa402", [CM]: "87fef5142296b81db9c5a45a822b69c9" } as const;
const JENIS_ES = "Ekonomi Syariah";
const ES_BIASA = "12/Pdt.G/2026/PA.Dgl";
const ES_SEDERHANA = "3/Pdt.G.S/2026/PA.Dgl";

describe("A. ALUR 43: langkah CS dan CM", () => {
  const alur = ALUR_BAS_BARU.find((a) => a.id === "alur-43")!;

  it("ALUR 43 kini 9 langkah (V1, AP, CB, V2, TP, NO, CS, CM, PS) di folder 10a - BAS, menu 144, jenis 370", () => {
    expect(alur).toMatchObject({ nomor: 43, folder: `${A}${F10A_BAS}`, jenisMin: 370, jenisMaks: 370, menu: { id: 144 } });
    expect(alur.langkah.map((l) => l.kode)).toEqual(["V1", "AP", "CB", "V2", "TP", "NO", "CS", "CM", "PS"]); // + PS (sela-ps 30 Okt)
    expect(alur.langkah.find((l) => l.kode === "CS")!.berkas).toBe(CS);
    expect(alur.langkah.find((l) => l.kode === "CM")!.berkas).toBe(CM);
  });

  it("dua berkas baru ada di pohon server (fixture), dan setiap langkah ALUR 43 ada di folder 10a - BAS", () => {
    expect(FIX.berkas).toContain(`${A}${F10A_BAS}/${CS}`);
    expect(FIX.berkas).toContain(`${A}${F10A_BAS}/${CM}`);
    for (const l of alur.langkah) expect(SERVER_DAN_PAKET, l.berkas).toContain(`${alur.folder}/${l.berkas}`);
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${F10A_BAS}/BAS ALUR 43 `))).toHaveLength(8);
    expect(SERVER_DAN_PAKET.filter((b) => b.startsWith(`${A}${F10A_BAS}/BAS ALUR 43 `))).toHaveLength(9);
  });

  it("md5 berkas paket (bila paket ada di laptop ini) sama dengan yang dipetakan", () => {
    const dir = "D:/aleta-dev/kerja/batch-14okt-sore/i25-keputusan-18okt-sore/abt-keputusan-18okt-sore-derry/paket-satker/rtf/derry_briantono/10a Ekonomi Syariah Biasa - BAS";
    if (!existsSync(dir)) return;
    for (const [nama, md5] of Object.entries(MD5)) {
      expect(createHash("md5").update(readFileSync(path.join(dir, nama))).digest("hex"), nama).toBe(md5);
    }
  });
});

describe("B. pemilihan CS / CM", () => {
  const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]> = {}) => {
    const h = tentukanBasBaru({ jenisPerkara: JENIS_ES, nomorPerkara: ES_BIASA, urutanSidang: 3, dihadiriOleh: 1, ...m });
    return { h, id: h?.alur.id ?? null, kode: h?.langkah.kode ?? null };
  };

  it("ES acara biasa (Pdt.G) dikenali; sesudah jawaban: dicabut Tergugat setuju = CS, Tergugat menolak = CM (bukan akhir perkara)", () => {
    expect(jenisBasBaru(JENIS_ES, ES_BIASA)).toBe("es-biasa");
    expect(t({ akhir: "cabut", sudahJawaban: true })).toMatchObject({ id: "alur-43", kode: "CS" });
    expect(t({ akhir: "cabut", sudahJawaban: true, sikapTergugatCabut: "setuju" })).toMatchObject({ id: "alur-43", kode: "CS" });
    expect(t({ sudahJawaban: true, sikapTergugatCabut: "menolak" })).toMatchObject({ id: "alur-43", kode: "CM" });
    const cm = t({ sudahJawaban: true, sikapTergugatCabut: "menolak" }).h!;
    expect(cm.alternatif.map((l) => l.kode)).toContain("CS");
  });

  it("sebelum jawaban tetap langkah lama (CB cabut sesudah mediasi); tanpa penanda tegas tidak ada CS / CM", () => {
    expect(t({ urutanSidang: 2, akhir: "cabut" })).toMatchObject({ id: "alur-43", kode: "CB" });
    expect(t({ sudahJawaban: true }).kode).not.toMatch(/^C[SM]$/);
    expect(t({ sikapTergugatCabut: "menolak" }).kode).not.toMatch(/^C[SM]$/);
  });

  it("ES gugatan sederhana (Pdt.G.S) tetap ALUR 40 dengan CS / CM sendiri di folder 10", () => {
    expect(jenisBasBaru(JENIS_ES, ES_SEDERHANA)).toBe("es");
    expect(t({ nomorPerkara: ES_SEDERHANA, akhir: "cabut", sudahJawaban: true })).toMatchObject({ id: "alur-40", kode: "CS" });
    expect(t({ nomorPerkara: ES_SEDERHANA, sudahJawaban: true, sikapTergugatCabut: "menolak" })).toMatchObject({ id: "alur-40", kode: "CM" });
  });

  it("berkas pilihan CS / CM berada di folder dan menu yang benar", () => {
    const h = t({ akhir: "cabut", sudahJawaban: true }).h!;
    expect(h.alur.folder).toBe(`${A}${F10A_BAS}`);
    expect(h.alur.menu.id).toBe(144);
    expect(h.langkah.berkas).toBe(CS);
  });
});

describe("C. BAS verstek Izin Poligami (butir 45) tetap satu berkas", () => {
  it("ALUR 34 langkah V2 = 'Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek', ada di pohon, tanpa berkas baru", () => {
    const alur = ALUR_BAS_BARU.find((a) => a.id === "alur-34")!;
    const v2 = alur.langkah.find((l) => l.kode === "V2")!;
    expect(v2.berkas).toBe("BAS ALUR 34 Poligami - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf");
    expect(FIX.berkas).toContain(`${alur.folder}/${v2.berkas}`);
  });
});

describe("D. isian paket (label awam, 9761 otomatis, 5178 muncul, 5009 keluar)", () => {
  const D = (kode: string, nm: string, jenis = "data_teks", bawaan = "", sql = "") => ({ kode, nama: nm, jenis, sql, bawaan });
  const susun = (penanda: string[], daftar: ReturnType<typeof D>[]) => susunIsian(penanda, new Map(daftar.map((d) => [d.kode, d])));

  it("9760: isian berlabel awam; 9761 otomatis (bukan isian); tanpa kode di label", () => {
    const s = susun(
      ["9760", "9761"],
      [
        D("9760", "IZIN POLIGAMI BAS VERSTEK: BUKTI PERSETUJUAN TERTULIS #0047# (ISTRI) YANG DIAJUKAN #0046# - ISIAN"),
        D("9761", "IZIN POLIGAMI BAS VERSTEK: KALIMAT BUKTI PERSETUJUAN ISTRI (OTOMATIS dari isian 9760)", "data_sql", "", "select 1"),
      ]
    );
    const peta = Object.fromEntries(s.isian.map((i) => [i.kode, i]));
    expect(peta["9760"].nama).toMatch(/^Bukti persetujuan tertulis (Termohon|Tergugat)/);
    expect(peta["9760"].nama).toContain("kosong = tidak ada bukti yang diajukan");
    expect(peta["9760"].nama).not.toMatch(/#\d{4}#|\b9760\b|\b9761\b/);
    expect(peta["9761"]).toBeUndefined();
    expect(s.otomatis.map((o) => o.kode)).toContain("9761");
  });

  it("0654 / 0655: label awam, umum untuk surat keterangan KUA (dipakai DK dan bukti itsbat)", () => {
    const s = susun(["0654", "0655"], [D("0654", "No. Surat Ket. KUA"), D("0655", "Tgl. Surat Ket. KUA", "data_tanggal")]);
    const peta = Object.fromEntries(s.isian.map((i) => [i.kode, i]));
    expect(peta["0654"].nama).toBe("Nomor surat keterangan dari KUA (mis. surat keterangan nikah tidak tercatat)");
    expect(peta["0655"].nama).toBe("Tanggal surat keterangan dari KUA (mis. surat keterangan nikah tidak tercatat)");
  });

  it("9956 baru: bawaan P.10 merujuk 5178 (KUA Kec.), tidak lagi 5009; blangko DK yang memuat 5178 menampilkannya sebagai isian", () => {
    const baru = D("9956", "DETEKTOR KLASIFIKASI BUKTI SURAT SESUAI DENGAN JENIS PERKARA", "data_teks", "P.10 ... Nomor #0652# tanggal #0653#, yang dikeluarkan oleh #5178#, bukti surat tersebut");
    expect(rujukan(baru)).toEqual(expect.arrayContaining(["5178", "0652", "0653"]));
    expect(rujukan(baru)).not.toContain("5009");
    const s = susun(["9956", "5178", "0652", "0653"], [baru, D("5178", "KUA Kec."), D("0652", "No. Surat Penolakan KUA"), D("0653", "Tgl. Surat Penolakan KUA", "data_tanggal")]);
    expect(s.isian.map((i) => i.kode)).toEqual(expect.arrayContaining(["5178", "0652", "0653"]));
    expect(s.isian.map((i) => i.kode)).not.toContain("5009");
  });

  it("5009 (Tempat menikah, tanpa jenis data) tidak ditampilkan: bukan isian, bukan otomatis, bukan tak dikenal - walau berkas lama masih memuatnya", () => {
    const lama = D("9956", "DETEKTOR KLASIFIKASI BUKTI SURAT SESUAI DENGAN JENIS PERKARA", "data_teks", "yang dikeluarkan oleh Kantor Urusan Agama #5009#, bukti surat");
    const s = susun(["9956", "5009"], [lama, D("5009", "Tempat menikah", "")]);
    expect(s.isian.map((i) => i.kode)).not.toContain("5009");
    expect(s.otomatis.map((o) => o.kode)).not.toContain("5009");
    expect(s.takDikenal).not.toContain("5009");
    const tanpaKatalog = susun(["5009"], []);
    expect(tanpaKatalog.takDikenal).not.toContain("5009");
  });

  it("9957 baru: bawaan P.3 merujuk 0654 / 0655 (surat keterangan KUA), bukan surat penolakan 0652 / 0653", () => {
    const baru = D("9957", "C3. Alat Bukti Isbat Cerai Gugat Penggugat", "data_teks", "P.3 Surat Keterangan Nikah Tidak Tercatat Nomor #0654# tanggal #0655#, yang dikeluarkan");
    const r = rujukan(baru);
    expect(r).toEqual(expect.arrayContaining(["0654", "0655"]));
    expect(r).not.toContain("0652");
    expect(r).not.toContain("0653");
  });
});
