// @vitest-environment node
/**
 * ============================================================================
 * SALINAN BAS DI FOLDER JENIS -> "Buka di ABT" BAS massal (F3, 14 Okt 2026)
 * ============================================================================
 *
 * Paket ABT abt-susunan-satu-folder menyalin 233 BAS ke folder jenis dan menyembunyikan menu ALUR/945/946: token berkas
 * ALUR tidak lagi dapat dipanen. Yang dijaga (semuanya DIJALANKAN, bukan menyisir teks):
 *   A. tabel salinan (salinan-bas-jenis-data.ts) = persis 233 BAS di fixtures/blangko-derry-server-17okt.json (folder "... - BAS"), sumbernya ada;
 *   B. server memilih salinan di folder jenis yang SESUAI jenis perkara (CG vs CT), lewat berkas ALUR maupun folder lama,
 *      dan tidak menebak bila jenis tidak terbaca;
 *   C. pilihBlangkoBas membawa `salinan` pada tiap pilihan;
 *   D. ekstensi memanen menu BAS berpasangan "<Jenis> - BAS" (dan, bila paket lama masih terpasang, berkas ^BAS di kartu "Putusan <jenis>"), memakai salinan yang
 *      TEPAT (CG tidak dipakai untuk CT), tidak menebak, dan tetap memakai token ALUR yang sudah tersimpan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { pilihBlangkoBas } from "@/app/api/aleta-ecourt/bas-massal/susun";
import { PADANAN_BAS_ARSIP } from "@/lib/alur-bas";
import { ALUR_BAS_BARU } from "@/lib/alur-bas-baru-data";
import { SET_BLANGKO } from "@/lib/pohon-blangko";
import { awalanSalinanBas, folderJenisCocok, salinanBasJenis, semuaSalinanBas } from "@/lib/salinan-bas-jenis";
import { AKAR_SALINAN_BAS, MENU_FOLDER_JENIS, SALINAN_BAS_JENIS, SALINAN_BAS_LANGSUNG } from "@/lib/salinan-bas-jenis-data";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as {
  berkas: string[];
  menu: Array<{ id: number; nama: string; nama_alias: string; direktori: string }>;
};
const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const A = `${AKAR_SALINAN_BAS}/`;
const ALUR04 = "ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)";
const BERKAS_04 = "[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf";
const SALIN_04 = `BAS ALUR 04 ${BERKAS_04}`;
const W3A_BAS = new Set(["5c Penolakan Perkawinan - BAS", "5d Perkawinan Campuran - BAS", "3a Izin Kawin - BAS", "8a Pengesahan Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS"]); // W3a 21 Okt: dijaga w3a-pemetaan-21okt.test.ts (fixture 17 Okt tidak memuatnya)

describe("A. tabel salinan = 233 BAS paket A3 + 53 salinan F21 (58 - 5 dipindah I7) + 1 BAS langsung ikrar di fixture", () => {
  it("setiap salinan turunan tabel ADA di fixture, dan semua BAS salinan fixture ada di tabel", () => {
    const turunan = new Set<string>();
    for (const [fs, berkas] of Object.entries(SALINAN_BAS_JENIS)) {
      const awalan = awalanSalinanBas(fs);
      expect(awalan, fs).toBeTruthy();
      for (const [bs, tujuan] of Object.entries(berkas)) {
        expect(FIX.berkas, `${fs}/${bs}`).toContain(`${A}${fs}/${bs}`); // sumber tetap ada di disk
        for (const ft of tujuan) {
          expect(MENU_FOLDER_JENIS[ft], ft).toBeTruthy();
          if (W3A_BAS.has(ft)) continue; // W3a 21 Okt: 29 salinan ke 1e dan 1f (w3a-pemetaan-21okt.test.ts)
          turunan.add(`${A}${ft}/${awalan}${bs}`);
        }
      }
    }
    // Server 15 Okt memuat juga BAS BARU D3/E3 (ALUR_BAS_BARU, berkas "BAS ALUR nn ..." di folder BAS pasangan): bukan salinan A3.
    const basBaru = new Set(ALUR_BAS_BARU.flatMap((a) => a.langkah.map((l) => `${a.folder}/${l.berkas}`)));
    const diFixture = FIX.berkas.filter((b) => /\/BAS (ALUR|KUMULASI|IN GUGUR CABUT) /.test(b) && !/^derry_briantono\/(ALUR |BAS |- BAS )/.test(b) && !basBaru.has(b));
    // 233 salinan paket A3 (15 Okt) + 58 salinan F21 (17 Okt: 29 BAS ALUR 04-09 ke "5a Pembatalan Perkawinan - BAS" dan ke "6a Hak Asuh Anak (Hadhanah) - BAS").
    // I7 17 Okt: 5 salinan BAS mediasi di "5a Pembatalan Perkawinan - BAS" dipindah ke derry_briantono/terhapus (fixture: kunci `terhapus`, bukan `berkas`).
    // F22 17 Okt: + 58 salinan (29 BAS ALUR 04-09 ke "4c Wasiat - BAS" dan ke "10a Ekonomi Syariah Biasa - BAS").
    // I15 18 Okt: + 29 salinan ke "6b Penguasaan Anak - BAS".
    // I23 18 Okt: + 29 salinan ke "6c Nafkah Anak - BAS" (9 BAS ALUR 46 baru, bukan salinan).
    expect(turunan.size).toBe(233 + 58 - 5 + 58 + 29 + 29 + 58); // I28 18 Okt: + 29 salinan ke "4d Hibah - BAS" dan 29 ke "4e Wakaf - BAS"
    expect([...turunan].filter((b) => /^derry_briantono\/(5a Pembatalan Perkawinan|6a Hak Asuh Anak \(Hadhanah\)) - BAS\//.test(`${A}${b.slice(A.length)}`)).length).toBe(58 - 5);
    // BAS yang dibuat paket langsung di folder jenis tanpa berkas sumber di folder ALUR (SALINAN_BAS_LANGSUNG: ALUR 10 [4] ikrar, paket I2 16 Okt).
    const langsung = new Set<string>();
    for (const [fs, berkas] of Object.entries(SALINAN_BAS_LANGSUNG)) {
      const awalan = awalanSalinanBas(fs)!;
      for (const [bs, tujuan] of Object.entries(berkas)) for (const ft of tujuan) langsung.add(`${A}${ft}/${awalan}${bs}`);
    }
    expect(langsung.size).toBe(1);
    expect([...turunan, ...langsung].sort()).toEqual([...diFixture].sort());
  });

  it("nama menu tiap folder jenis = abt_menu.nama/nama_alias di fixture", () => {
    for (const [folder, m] of Object.entries(MENU_FOLDER_JENIS)) {
      if (W3A_BAS.has(folder)) continue;
      const baris = FIX.menu.find((x) => x.id === m.id)!;
      expect(baris.direktori, folder).toBe(folder);
      expect([baris.nama, baris.nama_alias], folder).toEqual([m.nama, m.alias]);
    }
  });

  it("padanan folder lama -> ALUR -> salinan: tiap berkas folder lama yang punya padanan ALUR berujung pada salinan", () => {
    for (const lama of Object.keys(PADANAN_BAS_ARSIP)) {
      const bagi = lama.split("/");
      const hasil = semuaSalinanBas(bagi.slice(0, 2).join("/"), bagi[2]);
      expect(hasil.length, lama).toBeGreaterThan(0);
      for (const s of hasil) if (!W3A_BAS.has(s.folder.slice(A.length))) expect(FIX.berkas, lama).toContain(`${s.folder}/${s.berkas}`);
    }
  });
});

describe("B. salinan menurut jenis perkara", () => {
  it("ALUR 04 [2]: perkara CG -> hanya '1 Perceraian CG', CT -> hanya '1a Perceraian CT', menu bernama", () => {
    const cg = salinanBasJenis(`${A}${ALUR04}`, BERKAS_04, "Cerai Gugat");
    expect(cg).toEqual([{ folder: `${A}1 Perceraian CG - BAS`, berkas: SALIN_04, menu: "Cerai Gugat - BAS", alias: "CG - BAS" }]);
    const ct = salinanBasJenis(`${A}${ALUR04}`, BERKAS_04, "Cerai Talak");
    expect(ct).toEqual([{ folder: `${A}1a Perceraian CT - BAS`, berkas: SALIN_04, menu: "Cerai Talak - BAS", alias: "CT - BAS" }]);
    // HB / waris / poligami memegang salinan yang sama di folder masing-masing
    expect(salinanBasJenis(`${A}${ALUR04}`, BERKAS_04, "Harta Bersama").map((s) => s.folder)).toEqual([`${A}4a Harta Bersama - BAS`]);
    expect(salinanBasJenis(`${A}${ALUR04}`, BERKAS_04, "Kewarisan").map((s) => s.folder)).toEqual([`${A}4b Kewarisan - BAS`]);
    expect(salinanBasJenis(`${A}${ALUR04}`, BERKAS_04, "Izin Poligami").map((s) => s.folder)).toEqual([`${A}5 Izin Poligami - BAS`]);
  });

  it("berkas khusus cerai gugat tidak dialihkan ke CT (dan sebaliknya); jenis tak terbaca/tak dikenal -> tidak menebak", () => {
    const alur01 = `${A}ALUR 01 Cerai Verstek 1 Sidang (Putus Sidang Pertama)`;
    const cgSaja = "[1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek di Sidang Pertama - Cerai Gugat.rtf";
    expect(salinanBasJenis(alur01, cgSaja, "Cerai Gugat")).toHaveLength(1);
    expect(salinanBasJenis(alur01, cgSaja, "Cerai Talak")).toEqual([]);
    expect(semuaSalinanBas(alur01, cgSaja).map((s) => s.folder)).toEqual([`${A}1 Perceraian CG - BAS`]);
    for (const jenis of ["", "   ", "Jenis yang tidak ada"]) {
      expect(salinanBasJenis(`${A}${ALUR04}`, BERKAS_04, jenis), JSON.stringify(jenis)).toEqual([]);
    }
    expect(salinanBasJenis(`${A}${ALUR04}`, "[9] Berkas yang tidak ada.rtf", "Cerai Gugat")).toEqual([]);
    expect(folderJenisCocok(`${A}9b Permohonan Umum`, "Pengesahan Perkawinan/Istbat Nikah")).toBe(false); // folder tanpa jenis: tidak ditebak
  });

  it("folder lama '- BAS VERSTEK PERCERAIAN -' lewat padanan ALUR: CG ke CG, CT ke CT, ALUR 02 dan 03 sama-sama", () => {
    const lama = `${A}- BAS VERSTEK PERCERAIAN -`;
    const nama = "[01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T";
    const cg = salinanBasJenis(lama, nama, "Cerai Gugat");
    expect(cg.map((s) => s.berkas)).toEqual([
      "BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
      "BAS ALUR 03 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
    ]);
    expect(new Set(cg.map((s) => s.folder))).toEqual(new Set([`${A}1 Perceraian CG - BAS`]));
    expect(new Set(salinanBasJenis(lama, nama, "Cerai Talak").map((s) => s.folder))).toEqual(new Set([`${A}1a Perceraian CT - BAS`]));
  });

  it("kumulasi hak asuh dan itsbat gugur-cabut: folder jenisnya masing-masing", () => {
    const kum = `${A}BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)`;
    const semua = Object.keys(SALINAN_BAS_JENIS["BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)"]);
    expect(semua.length).toBe(2);
    const s = salinanBasJenis(kum, semua[0], "Cerai Gugat");
    expect(s.map((x) => x.folder)).toEqual([`${A}1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS`]);
    expect(s[0].berkas.startsWith("BAS KUMULASI ")).toBe(true);
    expect(s[0].menu).toBe("Cerai Gugat Kumulasi Hak Asuh Anak - BAS");
    expect(salinanBasJenis(kum, semua[0], "Cerai Talak")).toEqual([]);
    const itsbat = `${A}BAS Itsbat Nikah Gugur dan Cabut`;
    const bi = Object.keys(SALINAN_BAS_JENIS["BAS Itsbat Nikah Gugur dan Cabut"])[0];
    expect(salinanBasJenis(itsbat, bi, "Pengesahan Perkawinan/Istbat Nikah").map((x) => x.berkas)[0]).toMatch(/^BAS IN GUGUR CABUT /);
  });
});

describe("C. pilihBlangkoBas membawa salinan", () => {
  const VERSTEK = SET_BLANGKO.find((s) => s.id === "bas-verstek")!.folder;
  const berkas = "[01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf";
  const katalog = {
    [VERSTEK]: {
      terbaca: true,
      sebab: "",
      blangko: [{ berkas, basKe: 1, keadaan: "P Hadir & T Tidak Hadir", tindakan: "Tunda Panggil T", judul: berkas }],
    },
  } as never;
  const pilih = (jenisPerkara: string) => pilihBlangkoBas({ jenisPerkara, urutanSidang: 1, dihadiriOleh: 2, katalog });

  it("CG dan CT mendapat salinan di folder jenisnya masing-masing (di pilihan DAN usulan); padanan ALUR lama tetap ada", () => {
    for (const [jenis, folder] of [["Cerai Gugat", "1 Perceraian CG - BAS"], ["Cerai Talak", "1a Perceraian CT - BAS"]]) {
      const h = pilih(jenis);
      expect(h.usulan, jenis).toBeTruthy();
      for (const p of [h.usulan!, ...h.pilihan.filter((x) => x.berkas === berkas)]) {
        expect(p.salinan!.map((s) => s.folder), jenis).toEqual([`${A}${folder}`, `${A}${folder}`]);
        expect(p.salinan![0].menu).toBe(jenis === "Cerai Gugat" ? "Cerai Gugat - BAS" : "Cerai Talak - BAS");
        expect(p.padanan!.length).toBe(2);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// D. ekstensi basmassal.js: panen & pemilihan token
// ---------------------------------------------------------------------------
const sumberBasmassal = readFileSync(path.join(EKSTENSI, "basmassal.js"), "utf8");
const sumberAlat = readFileSync(path.join(EKSTENSI, "panel-alat.js"), "utf8");

function muatEkstensi(html: string, simpanan: Record<string, unknown> = {}) {
  const dom = new JSDOM(html, { url: "http://192.168.10.10/aps_badilag/abt/main/beranda" });
  const awal = sumberBasmassal.indexOf("function basmassalKunciNama(");
  const akhir = sumberBasmassal.indexOf("/** Mode coba atau mode latihan menahan POST ini? */");
  const awalToken = sumberAlat.indexOf("function alatTokenDariTautan(");
  const akhirToken = sumberAlat.indexOf("/* ─── 2. ANTREAN MASSAL");
  const k: any = {
    document: dom.window.document,
    location: dom.window.location,
    URL,
    console,
    Date,
    Object,
    Array,
    String,
    Number,
    JSON,
    chrome: {
      storage: {
        local: {
          get: async (kunci: string[]) => Object.fromEntries(kunci.filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
          set: async (obj: Record<string, unknown>) => void Object.assign(simpanan, obj),
        },
      },
    },
  };
  vm.createContext(k);
  vm.runInContext(
    `${sumberBasmassal.match(/^const BASMASSAL_KUNCI_TOKEN = .*;$/m)![0]}\n${sumberBasmassal.match(/^const BASMASSAL_TOKEN_MAKS = .*;$/m)![0]}\n${sumberAlat.slice(awalToken, akhirToken)}\n${sumberBasmassal.slice(awal, akhir)}`,
    k,
    { filename: "basmassal-f3.js" }
  );
  return { k, simpanan };
}

const kartu = (kelompok: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing_inner_w3ls"><div class="pricing-top"><h3>${kelompok}<br>Cerai 1/Pdt.G/2026</h3></div><div class="pricing-bottom-bottom">` +
  berkas.map(([nama, a, b]) => `<a onclick='x({a:"${a}", b:"${b}"})'><span># ${nama}</span></a>`).join("") +
  `</div></div>`;
const HALAMAN = (isi: string) =>
  `<html><body><div id="navbar"><div class="accordion">` +
  `<a href="/aps_badilag/abt/main/beranda?a=K_CG">Cerai Gugat - BAS</a><a href="/aps_badilag/abt/main/beranda?a=K_CT">Cerai Talak - BAS</a>` +
  `<a href="/aps_badilag/abt/main/beranda?a=K_REL">Relaas Panggilan Sidang</a><a href="/aps_badilag/abt/main/beranda?a=K_ALUR">BAS Alur 04 - Cerai Kontradiktoir Tertulis</a>` +
  `</div></div>${isi}</body></html>`;

describe("D. ekstensi: panen salinan BAS & pemilihan token", () => {
  it("K3: menu berpasangan '<Jenis> - BAS' terpanen seperti menu BAS lama (kunci memuat kata bas); menu '<Jenis> - Putusan' diabaikan", async () => {
    const { k, simpanan } = muatEkstensi(
      HALAMAN(
        kartu("Cerai Gugat - BAS", [[SALIN_04, "A_CG", "B_CG"]]) +
          kartu("Cerai Gugat - Putusan", [["[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", "A_PUT", "B_PUT"]])
      )
    );
    expect(await k.basmassalPanenTokenAbt()).toBeGreaterThan(0);
    const peta = (simpanan as any).tokenBlangkoBas;
    expect(Object.keys(peta.berkas)).toEqual([expect.stringMatching(/^cerai gugat bas\|bas alur 04 2 bas 2 /)]);
    expect(Object.keys(peta.kelompok).sort()).toEqual(["bas alur 04 cerai kontradiktoir tertulis", "cerai gugat bas", "cerai talak bas"]);
    expect(peta.kelompok["cerai gugat bas"].a).toBe("K_CG");
  });

  it("pemasangan paket satu-folder yang belum diganti: kartu 'Putusan <jenis>' hanya memberi berkas ^BAS, bukan berkas putusannya", async () => {
    const { k, simpanan } = muatEkstensi(
      HALAMAN(
        kartu("Putusan Cerai Gugat", [
          [SALIN_04, "A_CG", "B_CG"],
          ["[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", "A_PUT", "B_PUT"],
        ])
      )
    );
    expect(await k.basmassalPanenTokenAbt()).toBeGreaterThan(0);
    const peta = (simpanan as any).tokenBlangkoBas;
    expect(Object.keys(peta.berkas)).toEqual([expect.stringMatching(/^putusan cerai gugat\|bas alur 04 2 bas 2 /)]);
  });

  async function petaDua() {
    const { k, simpanan } = muatEkstensi(
      HALAMAN(
        kartu("Cerai Gugat - BAS", [[SALIN_04, "A_CG", "B_CG"]]) + kartu("Cerai Talak - BAS", [[SALIN_04, "A_CT", "B_CT"]])
      )
    );
    await k.basmassalPanenTokenAbt();
    return { k, peta: (simpanan as any).tokenBlangkoBas };
  }
  const salinan = (folder: string, menu: string, alias: string) => [{ folder: `${A}${folder}`, berkas: SALIN_04, menu, alias }];
  const lamaFolder = `${A}${ALUR04}`;

  it("perkara CT memakai token CT, perkara CG token CG - nama salinan sama, tidak tertukar", async () => {
    const { k, peta } = await petaDua();
    const ct = k.basmassalTokenUntuk(peta, lamaFolder, BERKAS_04, [], salinan("1a Perceraian CT - BAS", "Cerai Talak - BAS", "CT - BAS"));
    expect(ct.berkas).toMatchObject({ a: "A_CT", b: "B_CT" });
    expect(ct.kelompok).toMatchObject({ a: "K_CT" });
    const cg = k.basmassalTokenUntuk(peta, lamaFolder, BERKAS_04, [], salinan("1 Perceraian CG - BAS", "Cerai Gugat - BAS", "CG - BAS"));
    expect(cg.berkas).toMatchObject({ a: "A_CG", b: "B_CG" });
  });

  it("hanya token CG terpanen + perkara CT: TIDAK memakai token CG (berkas null; kelompok CT bila ada)", async () => {
    const { k, simpanan } = muatEkstensi(HALAMAN(kartu("Cerai Gugat - BAS", [[SALIN_04, "A_CG", "B_CG"]])));
    await k.basmassalPanenTokenAbt();
    const peta = (simpanan as any).tokenBlangkoBas;
    const ct = k.basmassalTokenUntuk(peta, lamaFolder, BERKAS_04, [], salinan("1a Perceraian CT - BAS", "Cerai Talak - BAS", "CT - BAS"));
    expect(ct.berkas).toBeNull();
    expect(ct.kelompok).toMatchObject({ a: "K_CT" }); // tautan kelompok CT, bukan berkas CG
  });

  it("tanpa petunjuk salinan (jenis tak terbaca): tidak menebak di antara dua salinan senama", async () => {
    const { k, peta } = await petaDua();
    expect(k.basmassalTokenUntuk(peta, lamaFolder, BERKAS_04, [], undefined).berkas).toBeNull();
    expect(k.basmassalTokenUntuk(peta, lamaFolder, BERKAS_04, [], []).berkas).toBeNull();
    // petunjuk dari nama berkas "polos" (tanpa awalan BAS ALUR) pun tidak membelokkan ke salah satunya
    expect(k.basmassalTokenUntuk(peta, lamaFolder, `${SALIN_04}`, [], undefined).berkas).toBeNull();
  });

  it("token ALUR yang sudah tersimpan tetap dipakai lewat padanan (perilaku lama), dan salinan menang bila ada", async () => {
    const { k, simpanan } = muatEkstensi(
      HALAMAN(kartu("BAS Alur 04 - Cerai Kontradiktoir Tertulis", [[BERKAS_04, "A_ALUR", "B_ALUR"]])),
      {}
    );
    await k.basmassalPanenTokenAbt();
    const peta = (simpanan as any).tokenBlangkoBas;
    const padanan = [{ folder: lamaFolder, berkas: BERKAS_04 }];
    const lama = k.basmassalTokenUntuk(peta, `${A}- BAS CONTRA PERCERAIAN -`, "x.rtf", padanan, []);
    expect(lama.berkas).toMatchObject({ a: "A_ALUR" });
    // salinan CG terpanen kemudian: menang atas token ALUR
    peta.berkas["cerai gugat bas|bas alur 04 2 bas 2 p t hadir laporan mediasi dan pemeriksaan pokok perkara"] = { a: "A_CG", b: "B_CG" };
    peta.kelompok["cerai gugat bas"] = { a: "K_CG" };
    const baru = k.basmassalTokenUntuk(peta, `${A}- BAS CONTRA PERCERAIAN -`, "x.rtf", padanan, salinan("1 Perceraian CG - BAS", "Cerai Gugat - BAS", "CG - BAS"));
    expect(baru.berkas).toMatchObject({ a: "A_CG" });
  });
});
