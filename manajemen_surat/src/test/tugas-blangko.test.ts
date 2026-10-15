// @vitest-environment node
/**
 * ============================================================================
 * PETA BLANGKO PER TUGAS (butir 7, 13 Okt 2026) + BLANGKO DERRY RAPI (butir 6)
 * ============================================================================
 *
 * Yang dijaga, atas keadaan SERVER satker sesudah paket ABT abt-susunan-satu-folder (fixtures/blangko-derry-susunan-14okt.json:
 * berkas & abt_menu grup Derry diukur lewat ssh 13 Okt 2026, ditambah paket abt-blangko-derry-rapi dan - F3, 14 Okt - paket
 * abt-susunan-satu-folder: 233 BAS disalin ke folder jenis, hak gabungan putusan+BAS, menu ALUR/945/946 tersembunyi):
 *   A. tiap berkas Derry punya tugas menurut ATURAN nama folder/berkas (putusan -> hakim, BAS -> panitera, relaas ->
 *      juru sita, form PTSP -> PTSP), tanpa satu pun yang tak terbaca;
 *   B. ABT dan ALETA sepakat: grup abt_menu tiap folder = grup tugasnya, dan baris yang SUNGGUH dibaca ABT
 *      (hak_akses_menu: direktori=folder OR direktori='derry_briantono', urut indeks) mengizinkan grup tugas itu -
 *      sebelum paket, folder Relaas & PTSP dibaca dari baris induk 900 yang hanya untuk hakim;
 *   C. status putusan dibaca dari tanda nama berkas, dan peta status otomatis tidak menyalahi pilihan bawaan;
 *   D. folder baru (mis. putusan/BAS per jenis x status agen T) menjadi set tanpa menyunting daftar;
 *   E. BAS lama yang disembunyikan punya padanan ALUR yang ADA, dan ekstensi memakai padanan itu untuk token ABT;
 *   F. ekstensi mengisi baris status dari pohon hanya bila belum ada, dan set kumulasi tidak menjadi bawaan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

import { ALUR_BAS, PADANAN_BAS_ARSIP, padananBasArsip } from "@/lib/alur-bas";
import { SET_BLANGKO, setBlangkoGabung, setDariFolder, tugasSet } from "@/lib/pohon-blangko";
import {
  GRUP_ABT_FOLDER_JENIS,
  GRUP_ABT_TUGAS,
  berkasBasSalinan,
  folderTugas,
  grupFolderJenis,
  grupTugas,
  jenisDokumenBlangko,
  jenisPerkaraDariFolder,
  petaStatusDariBerkas,
  statusDariNamaBlangko,
  tugasBlangko,
  type TugasBlangko,
} from "@/lib/tugas-blangko";

type BarisMenu = {
  id: number;
  nama: string;
  nama_alias: string;
  direktori: string;
  parent_direktori: string;
  proses_id_min: number;
  proses_id_max: number;
  user_cek: number;
  user_grup_id: string;
  user_top_id: string;
};
const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-susunan-14okt.json"), "utf8")) as {
  berkasSebelum: string[];
  berkas: string[];
  menu: BarisMenu[];
};
const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const folderDari = (jalur: string) => jalur.split("/").slice(0, 2).join("/");
const menuDerry = FIX.menu.filter((m) => m.parent_direktori === "derry_briantono");

describe("A. tugas tiap berkas Derry menurut aturan nama", () => {
  it("seluruh berkas server (sesudah paket) punya tugas, dan tugasnya = tugas foldernya", () => {
    expect(FIX.berkas.length).toBeGreaterThan(200);
    const tanpa = FIX.berkas.filter((b) => !tugasBlangko(b));
    expect(tanpa).toEqual([]);
    // F3 14 Okt: folder jenis memuat dua tugas - BAS salinan ("BAS ...") = panitera, selebihnya = tugas foldernya.
    for (const b of FIX.berkas) {
      const nama = b.split("/").pop()!;
      expect(tugasBlangko(b), b).toBe(/^BAS\b/.test(nama) ? "panitera" : tugasBlangko(folderDari(b)));
    }
  });

  it("F3: 233 BAS salinan di folder jenis terbaca BAS (panitera), folder jenisnya tetap putusan (hakim)", () => {
    const salinan = FIX.berkas.filter((b) => /^BAS\b/.test(b.split("/").pop()!) && !/^derry_briantono\/(ALUR |BAS |- BAS )/.test(b));
    expect(salinan).toHaveLength(233);
    for (const b of salinan) {
      expect(jenisDokumenBlangko(b), b).toBe("bas");
      expect(tugasBlangko(b), b).toBe("panitera");
      expect(tugasBlangko(folderDari(b)), b).toBe("hakim");
      expect(berkasBasSalinan(b.split("/").pop()!)).toBe(true);
    }
    // 11 folder jenis menerima salinan; HB Kabul pindah ke 4a, folder 4 Kebendaan sudah tidak ada.
    expect(new Set(salinan.map(folderDari)).size).toBe(11);
    expect(FIX.berkas.some((b) => b.includes("/4 Kebendaan/"))).toBe(false);
    expect(FIX.berkas).toContain("derry_briantono/4a Harta Bersama/[01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan.rtf");
  });

  it("tiap jenis tugas punya contohnya sendiri di server", () => {
    const per: Record<string, number> = {};
    for (const b of FIX.berkas) per[tugasBlangko(b)] = (per[tugasBlangko(b)] ?? 0) + 1;
    expect(per.hakim).toBeGreaterThan(80);
    expect(per.panitera).toBeGreaterThan(233); // 233 salinan di folder jenis + BAS di folder ALUR/kumulasi/legacy
    expect(per.jurusita).toBe(20); // 10 [JS] + 10 dari "Blangko Jurusita Donggala"
    expect(per.ptsp).toBe(3); // "@PMH PHS - Lama" disingkirkan paket
  });

  it("urutan aturan: relaas/BAS yang menyebut 'putusan' tidak menjadi tugas hakim", () => {
    expect(tugasBlangko("derry_briantono/Relaas/[JS] 2. Relaas Pemberitahuan Putusan T.rtf")).toBe("jurusita");
    expect(tugasBlangko("[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf")).toBe("jurusita");
    expect(tugasBlangko("[2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf")).toBe("panitera");
    expect(tugasBlangko("@ 0 - PMH - PHS.rtf")).toBe("ptsp");
    expect(tugasBlangko("[02] [Kabul] CG - F.rtf")).toBe("hakim");
    expect(tugasBlangko("Catatan bebas.rtf")).toBe("");
    // F3: nama berkas ^BAS menang atas folder putusan, tanpa mengubah yang lain.
    expect(tugasBlangko("derry_briantono/1 Perceraian CG/BAS ALUR 04 [2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf")).toBe("panitera");
    expect(tugasBlangko("derry_briantono/1a Perceraian CT/BAS KUMULASI [2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak.rtf")).toBe("panitera");
    expect(tugasBlangko("derry_briantono/2 Itsbat Nikah/BAS IN GUGUR CABUT [C] BAS Putus Itsbat Nikah Dicabut.rtf")).toBe("panitera");
    expect(tugasBlangko("derry_briantono/1 Perceraian CG")).toBe("hakim");
    expect(tugasBlangko("derry_briantono/1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf")).toBe("hakim");
    expect(tugasBlangko("derry_briantono/1 Perceraian CG/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi.rtf")).toBe("hakim");
    expect(tugasBlangko("derry_briantono/Relaas/[JS] 2. Relaas Pemberitahuan Putusan T.rtf")).toBe("jurusita");
    expect(tugasBlangko("derry_briantono/PTSP/@ 1 - PMH.rtf")).toBe("ptsp");
    expect(tugasBlangko("derry_briantono/1 Perceraian CG/BASIC putusan.rtf")).toBe("hakim"); // kata utuh "BAS" saja
    expect(jenisDokumenBlangko("derry_briantono/- BAS VERSTEK PERCERAIAN -")).toBe("bas");
    expect(jenisDokumenBlangko("derry_briantono/9b Permohonan Umum")).toBe("putusan");
    // "Pemberitahuan Putusan" di nama BAS salinan tidak membelokkannya ke relaas.
    expect(jenisDokumenBlangko("derry_briantono/2 Itsbat Nikah/BAS ALUR 11 [1] BAS 1 IN - Pemberitahuan Putusan.rtf")).toBe("bas");
  });

  it("konvensi folder agen T (paket terpisah, terukur di ABT laptop 13 Okt) ikut terbaca", () => {
    expect(tugasBlangko("derry_briantono/1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz.rtf")).toBe("hakim");
    expect(tugasBlangko("derry_briantono/BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)/[2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak - P Hadir & T Tidak Hadir (2 Saksi).rtf")).toBe("panitera");
    expect(tugasBlangko("derry_briantono/BAS Itsbat Nikah Gugur dan Cabut/[C] BAS Putus Itsbat Nikah Dicabut - Para Pemohon Hadir Mencabut.rtf")).toBe("panitera");
  });
});

/** hak_akses_menu ABT: WHERE direktori=<folder> OR direktori='derry_briantono' LIMIT 1, urut indeks (latin1_swedish_ci). */
function barisDibacaAbt(direktori: string): BarisMenu | undefined {
  const kunci = (s: string) => s.toLowerCase();
  return FIX.menu
    .filter((m) => m.direktori === direktori || m.direktori === "derry_briantono")
    .sort((a, b) => (kunci(a.direktori) < kunci(b.direktori) ? -1 : kunci(a.direktori) > kunci(b.direktori) ? 1 : 0))[0];
}
const bolehGrup = (m: BarisMenu, g: string) => `${m.user_grup_id}|${m.user_top_id}`.split("|").includes(g);

describe("B. ABT dan ALETA sepakat tentang tugas tiap folder", () => {
  it("menu Derry yang tampil: grup abt_menu = grup tugas folder (folder jenis = gabungan putusan + BAS)", () => {
    expect(menuDerry.length).toBeGreaterThan(15);
    const jenis = menuDerry.filter((m) => /^\d/.test(m.direktori));
    expect(jenis.map((m) => m.id).sort((a, b) => a - b)).toEqual([901, 902, 903, 904, 905, 910, 911, 913, 914, 915, 920, 921, 922, 923, 940]);
    for (const m of menuDerry) {
      const t = tugasBlangko(`derry_briantono/${m.direktori}`) as TugasBlangko;
      expect(t, m.direktori).toBeTruthy();
      if (jenis.includes(m)) {
        // F3 14 Okt: hak gabungan paket abt-susunan-satu-folder (HAK-GABUNGAN.md).
        expect(t).toBe("hakim");
        expect(new Set(m.user_grup_id.split("|")), m.direktori).toEqual(new Set(grupFolderJenis()));
        expect(m.user_grup_id).toBe(GRUP_ABT_FOLDER_JENIS.grup);
        expect(m.user_top_id).toBe(GRUP_ABT_FOLDER_JENIS.top);
        expect(m.user_cek, m.direktori).toBe(3);
        expect(m.proses_id_max, m.direktori).toBeGreaterThanOrEqual(297);
        // gabungan = seluruh grup kedua tugasnya, tidak ada grup lain
        expect(new Set(m.user_grup_id.split("|"))).toEqual(new Set([...grupTugas("hakim"), ...grupTugas("panitera")]));
      } else {
        expect(new Set(m.user_grup_id.split("|")), m.direktori).toEqual(new Set(GRUP_ABT_TUGAS[t].grup.split("|")));
      }
    }
  });

  it("baris yang SUNGGUH dibaca ABT untuk tiap folder mengizinkan seluruh grup tugasnya (Relaas & PTSP lewat 900)", () => {
    for (const m of menuDerry) {
      const t = tugasBlangko(`derry_briantono/${m.direktori}`) as TugasBlangko;
      const dibaca = barisDibacaAbt(m.direktori)!;
      for (const g of grupTugas(t)) expect(bolehGrup(dibaca, g), `${m.direktori} -> menu ${dibaca.id} grup ${g}`).toBe(true);
      // F3: tiap BERKAS di folder itu (putusan hakim DAN BAS salinan panitera) harus terbuka bagi seluruh grup tugasnya.
      for (const b of FIX.berkas.filter((x) => folderDari(x) === `derry_briantono/${m.direktori}`)) {
        const tb = tugasBlangko(b) as TugasBlangko;
        for (const g of grupTugas(tb)) expect(bolehGrup(dibaca, g), `${b} -> menu ${dibaca.id} grup ${g}`).toBe(true);
      }
    }
    expect(barisDibacaAbt("Relaas")!.id).toBe(900);
    expect(barisDibacaAbt("PTSP")!.id).toBe(900);
    expect(barisDibacaAbt("Relaas")!.proses_id_max).toBeGreaterThanOrEqual(600); // PBT & ikrar sesudah putus
  });

  it("BAS lama, ALUR, kumulasi, itsbat gugur-cabut tersembunyi; grup Jurusita Donggala tertutup; alias ALUR berawalan BAS", () => {
    const alur = Array.from({ length: 13 }, (_, i) => 960 + i);
    for (const id of [951, 952, 954, 955, 945, 946, ...alur]) expect(FIX.menu.find((m) => m.id === id)!.parent_direktori, String(id)).toBe("_arsip_derry_briantono");
    const jsd = FIX.menu.find((m) => m.id === 800)!;
    expect([jsd.user_grup_id, jsd.user_top_id]).toEqual(["-1", "-1"]);
    // tidak ada menu BAS/ALUR yang masih tampil di bawah derry_briantono - semuanya lewat folder jenis
    expect(menuDerry.filter((x) => /^(ALUR |BAS |- BAS )/.test(x.direktori))).toEqual([]);
    for (const m of FIX.menu.filter((x) => x.direktori.startsWith("ALUR "))) expect(m.nama_alias.startsWith("BAS Alur ")).toBe(true);
    expect(FIX.menu.find((m) => m.id === 965)!.nama_alias).not.toMatch(/verstek/i);
    // hak baris tersembunyi tetap berlaku untuk tautan langsung (token ALUR yang sudah tersimpan)
    for (const id of [945, 946, ...alur]) {
      const m = FIX.menu.find((x) => x.id === id)!;
      expect(m.user_grup_id.split("|")).toContain("30");
      expect(m.proses_id_max).toBeGreaterThanOrEqual(297);
    }
  });

  it("tidak ada lagi berkas kembar yang tampil bagi satu tugas di folder BAS (folder lama tersembunyi)", () => {
    const tampil = new Set(menuDerry.map((m) => `derry_briantono/${m.direktori}`));
    const terlihat = FIX.berkas.filter((b) => tampil.has(folderDari(b)));
    expect(terlihat.some((b) => b.includes("/- BAS "))).toBe(false);
    expect(FIX.berkasSebelum.some((b) => b.includes("/- BAS VERSTEK PERCERAIAN -/"))).toBe(true);
  });
});

describe("C. status putusan dari tanda nama berkas", () => {
  it("tanda kurung siku kedua -> status SIPP + verstek", () => {
    expect(statusDariNamaBlangko("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf")).toMatchObject({ status: ["Dikabulkan"], verstek: true });
    expect(statusDariNamaBlangko("[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi.rtf")).toMatchObject({ status: ["Dikabulkan"], verstek: false });
    expect(statusDariNamaBlangko("[98] [Gugur] 3. Cerai P & T Tidak Hadir.rtf")!.status).toEqual(["Digugurkan", "Gugur"]);
    expect(statusDariNamaBlangko("[98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar Habis.rtf")!.status).toEqual(["Dicoret dari Register"]);
    expect(statusDariNamaBlangko("[99] [NO] IN - Dibawah Umur.rtf")!.status).toEqual(["Tidak Dapat Diterima"]);
    expect(statusDariNamaBlangko("[97] [Perdamaian] Akta Perdamaian.rtf")!.status).toEqual(["Perdamaian"]);
    expect(statusDariNamaBlangko("[00] [E-Court] HB Kabul.rtf")).toBeNull();
    // F3: HB Kabul di 4a ber-[Kabul] dan masuk peta status folder itu (Dikabulkan, kontradiktoir).
    const hb = FIX.berkas.filter((b) => b.startsWith("derry_briantono/4a Harta Bersama/")).map((b) => b.split("/")[2]);
    expect(petaStatusDariBerkas(hb).find((p) => p.status === "Dikabulkan" && !p.verstek)?.berkas).toMatch(/^\[01\] \[Kabul\] \[E-Court\] HB/);
  });

  it("peta status folder CG server = pilihan bawaan agen P untuk kabul (verstek & kontradiktoir), [01c] hanya varian", () => {
    const cg = FIX.berkas.filter((b) => b.startsWith("derry_briantono/1 Perceraian CG/")).map((b) => b.split("/")[2]);
    expect(cg).toContain("[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi.rtf");
    const peta = petaStatusDariBerkas(cg);
    const cari = (s: string, v: boolean) => peta.find((p) => p.status === s && p.verstek === v)?.berkas;
    expect(cari("Dikabulkan", true)).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf");
    // F3: BAS salinan di folder jenis tidak bertanda status - tidak mengubah peta status putusan.
    expect(cg.some((b) => berkasBasSalinan(b))).toBe(true);
    expect(petaStatusDariBerkas(cg.filter((b) => !berkasBasSalinan(b)))).toEqual(peta);
    expect(cari("Dikabulkan", false)).toBe("[02] [Kabul] CG - F.rtf");
    expect(cari("Ditolak", true)).toMatch(/^\[01ab\] \[Tolak Verstek\]/);
    expect(cari("Digugurkan", false)).toBe(cari("Gugur", false));
    expect(peta.filter((p) => p.status === "Dikabulkan" && !p.verstek)).toHaveLength(1);
  });
});

describe("D. folder baru menjadi set tanpa menyunting daftar", () => {
  const derry = [...new Set(FIX.berkas.map((b) => b.split("/")[1]))];

  it("set tertulis tetap di depan; folder server yang belum tertulis menjadi set bertugas sesuai aturan", () => {
    const gabung = setBlangkoGabung([...derry, "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak", "BAS Itsbat Nikah Gugur dan Cabut"]);
    expect(gabung.slice(0, SET_BLANGKO.length)).toEqual(SET_BLANGKO);
    expect(new Set(gabung.map((s) => s.folder)).size).toBe(gabung.length);
    const baru = gabung.slice(SET_BLANGKO.length);
    const f = (d: string) => baru.find((s) => s.folder === `derry_briantono/${d}`);
    expect(f("4a Harta Bersama")).toMatchObject({ jenis: "putusan", untuk: ["harta bersama"] });
    expect(SET_BLANGKO.some((s) => s.folder.includes("4 Kebendaan"))).toBe(false); // folder dihapus paket abt-susunan-satu-folder
    expect(f("5 Izin Poligami")).toMatchObject({ jenis: "putusan", untuk: ["poligami"] });
    expect(f("1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak")).toMatchObject({ jenis: "putusan", nama: "Putusan Cerai Gugat Kumulasi Hak Asuh Anak" });
    expect(f("1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak")!.untuk).toContain("cerai gugat");
    expect(f("BAS Itsbat Nikah Gugur dan Cabut")).toMatchObject({ jenis: "bas", untuk: ["istbat nikah", "itsbat nikah", "pengesahan perkawinan"] });
    expect(f("ALUR 06 Cerai T Hadir Mediasi lalu Tidak Hadir")).toMatchObject({ jenis: "bas" });
    expect(f("PTSP")).toBeUndefined(); // PTSP punya petanya sendiri (peta-penetapan.ts / penetapanEdocService)
    expect(setDariFolder("_arsip")).toBeNull();
  });

  it("tiap set tertulis bertugas sesuai jenisnya", () => {
    const harap: Record<string, TugasBlangko> = { putusan: "hakim", bas: "panitera", relaas: "jurusita" };
    for (const s of SET_BLANGKO) expect(tugasSet(s), s.id).toBe(harap[s.jenis]);
  });

  it("jenis perkara dari nama folder: kumulasi menyebut keduanya, 'Perceraian' = CG & CT", () => {
    expect(jenisPerkaraDariFolder("1c Perceraian Kumulasi Itsbat Nikah").untuk).toEqual(
      expect.arrayContaining(["cerai gugat", "cerai talak", "itsbat nikah"])
    );
    expect(jenisPerkaraDariFolder("1a Perceraian CT").untuk).toEqual(["cerai talak"]);
    expect(folderTugas("Relaas")).toMatchObject({ tugas: "jurusita", untuk: [] });
  });
});

describe("E. BAS lama tersembunyi -> padanan ALUR yang ada di server", () => {
  it("29 berkas folder lama, tiap padanan menunjuk berkas yang ADA sesudah paket", () => {
    const ada = new Set(FIX.berkas);
    expect(Object.keys(PADANAN_BAS_ARSIP)).toHaveLength(29);
    for (const [lama, daftar] of Object.entries(PADANAN_BAS_ARSIP)) {
      expect(FIX.berkasSebelum, lama).toContain(lama);
      expect(ada.has(lama), `${lama} tetap ada di disk sesudah paket A3`).toBe(true);
      expect(daftar.length, lama).toBeGreaterThan(0);
      for (const p of daftar) expect(ada.has(`${p.folder}/${p.berkas}`), `${lama} -> ${p.folder}/${p.berkas}`).toBe(true);
    }
    expect(padananBasArsip("derry_briantono/- BAS VERSTEK PERCERAIAN -", "[01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T")[0]).toEqual({
      folder: "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang",
      berkas: "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
    });
  });

  it("langkah ALUR di peta alur-bas ada di server sesudah paket (ALUR 06 [3] berputusan tanpa verstek)", () => {
    const ada = new Set(FIX.berkas);
    for (const a of ALUR_BAS) for (const l of a.langkah) expect(ada.has(`${a.folder}/${l.berkas}`), `${a.folder}/${l.berkas}`).toBe(true);
    const a6 = ALUR_BAS.find((a) => a.id === "alur-06")!;
    expect(a6.langkah.filter((l) => /Putusan Verstek/.test(l.berkas))).toEqual([]);
  });

  it("ekstensi BAS massal: token berkas lama tidak ada -> token padanan ALUR (kelompok 'BAS Alur NN ...')", () => {
    const sumber = readFileSync(path.join(EKSTENSI, "basmassal.js"), "utf8");
    const awal = sumber.indexOf("function basmassalKunciNama(");
    const akhir = sumber.indexOf("/** Mode coba atau mode latihan menahan POST ini? */");
    const k: any = {};
    vm.createContext(k);
    vm.runInContext(sumber.slice(awal, akhir).replace(/async function basmassal(BacaToken|PanenTokenAbt)[\s\S]*?\n}\n/g, ""), k);
    const peta = {
      kelompok: { "bas alur 04 cerai kontradiktoir tertulis": { a: "K4" } },
      berkas: {
        "bas alur 04 cerai kontradiktoir tertulis|2 bas 2 p t hadir laporan mediasi dan pemeriksaan pokok perkara": { a: "A4", b: "B4" },
        "bas alur 02 cerai verstek 2 sidang|1 bas 1 p hadir t tidak hadir tunda panggil t": { a: "A2", b: "B2" },
        "bas alur 03 cerai verstek 3 sidang atau lebih|1 bas 1 p hadir t tidak hadir tunda panggil t": { a: "A3", b: "B3" },
      },
    };
    const lama = "derry_briantono/- BAS CONTRA PERCERAIAN -";
    const nama = "[02] BAS 2 P & T Hadir Laporan Mediasi dan Pemeriksaan Pokok Perkara PERMA 7 2022 & Keputusan Dirjen 1465.rtf";
    expect(k.basmassalTokenUntuk(peta, lama, nama).berkas).toBeNull();
    const t = k.basmassalTokenUntuk(peta, lama, nama, padananBasArsip(lama, nama));
    expect(t.berkas).toMatchObject({ a: "A4" });
    expect(t.kelompok).toMatchObject({ a: "K4" });
    // nama sama di ALUR 02 dan 03: padanan pertama (ALUR 02) yang dipakai, bukan ditebak dari dua kandidat
    const v = "derry_briantono/- BAS VERSTEK PERCERAIAN -";
    const n = "[01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf";
    expect(k.basmassalTokenUntuk(peta, v, n, padananBasArsip(v, n)).berkas).toMatchObject({ a: "A2" });
  });
});

describe("F. ekstensi: baris status dari pohon & set kumulasi", () => {
  const sumberAlat = readFileSync(path.join(EKSTENSI, "panel-alat.js"), "utf8");
  function alat(): any {
    const el = (): any => ({ style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, dataset: {}, setAttribute() {}, appendChild: (x: any) => x, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
    const k: any = {
      console, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Boolean, Array, Object, Promise, Error, Map, Set, URLSearchParams, URL, AbortController,
      document: { documentElement: el(), createElement: () => el(), querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
      location: { origin: "http://127.0.0.1", pathname: "/aps_badilag/abt/main/beranda", search: "" },
      window: { location: { hostname: "127.0.0.1", pathname: "/index.php", search: "", origin: "http://127.0.0.1" }, sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} }, addEventListener() {}, postMessage() {} },
      chrome: { runtime: { getManifest: () => ({ version: "1.199.0" }), getURL: (p: string) => p }, storage: { onChanged: { addListener() {} }, local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined } } },
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }), clone() { return this; } }),
      requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
    };
    k.globalThis = k;
    vm.createContext(k);
    vm.runInContext(sumberAlat, k, { filename: "panel-alat.js" });
    return k;
  }
  const POHON = [
    {
      nama: "Putusan Cerai Kumulasi Itsbat Nikah",
      folder: "derry_briantono/1c Perceraian Kumulasi Itsbat Nikah",
      untuk: ["cerai gugat", "cerai talak", "istbat nikah", "itsbat nikah"],
      usulan: { berkas: "[01aa] [Kabul Verstek] IN + CG - F.rtf", kategori: "Kabul Verstek" },
      petaStatus: [{ status: "Dikabulkan", verstek: true, berkas: "[01aa] [Kabul Verstek] IN + CG - F.rtf", tanda: "Kabul Verstek" }],
    },
    {
      nama: "Penetapan Itsbat Nikah",
      folder: "derry_briantono/2 Itsbat Nikah",
      untuk: ["istbat nikah", "itsbat nikah", "pengesahan perkawinan"],
      usulan: { berkas: "[01] [Kabul] IN.rtf", kategori: "Kabul" },
      petaStatus: petaStatusDariBerkas(FIX.berkas.filter((b) => b.startsWith("derry_briantono/2 Itsbat Nikah/")).map((b) => b.split("/")[2])),
    },
    {
      nama: "Putusan Cerai Gugat",
      folder: "derry_briantono/1 Perceraian CG",
      untuk: ["cerai gugat"],
      usulan: { berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", kategori: "Kabul Verstek" },
      petaStatus: petaStatusDariBerkas(FIX.berkas.filter((b) => b.startsWith("derry_briantono/1 Perceraian CG/")).map((b) => b.split("/")[2])),
    },
  ];

  it("itsbat: usulan jenis dari set itsbat (bukan kumulasi), baris status terisi dari nama berkas", () => {
    const k = alat();
    const peta: any = {};
    const terisi = k.alatIsiPetaDariPohon(peta, POHON, {});
    expect(peta["itsbat nikah"].berkas).toBe("[01] [Kabul] IN");
    expect(peta["itsbat nikah|dicabut"]).toMatchObject({ berkas: "[98] [Cabut] IN", sumber: "pohon", statusAsli: "Dicabut" });
    expect(peta["itsbat nikah|digugurkan"].berkas).toBe("[98] [Gugur] IN");
    expect(peta["itsbat nikah|dikabulkan"].berkas).toBe("[01] [Kabul] IN");
    expect(peta["itsbat nikah|dikabulkan|verstek"]).toBeUndefined(); // tanda kumulasi tidak menjadi bawaan itsbat biasa
    expect(terisi.length).toBeGreaterThan(3);
  });

  it("baris status bawaan / buatan admin TIDAK ditimpa; baris jenis bawaan juga tidak tersentuh status", () => {
    const k = alat();
    const peta: any = {
      "cerai gugat|dicabut": { jenisAsli: "Cerai Gugat", statusAsli: "Dicabut", berkas: "[98] [Cabut] 1a. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (Alamat T Tidak Diketahui)", bawaan: true },
      "cerai gugat|dikabulkan": { jenisAsli: "Cerai Gugat", statusAsli: "Dikabulkan", berkas: "Pilihan Admin", sumber: "admin" },
    };
    k.alatIsiPetaDariPohon(peta, POHON, {});
    expect(peta["cerai gugat|dicabut"].berkas).toMatch(/^\[98\] \[Cabut\] 1a\./);
    expect(peta["cerai gugat|dikabulkan"].berkas).toBe("Pilihan Admin");
    expect(peta["cerai gugat|tidak dapat diterima"]).toMatchObject({ sumber: "pohon" });
  });

  it("F3: gugur menyebut varian 3b kuasa insidentil (paket abt-kuasa-insidentil) untuk CG dan CT", () => {
    const k = alat();
    for (const [jenis, kode] of [["Cerai Gugat", "CG"], ["Cerai Talak", "CT"]]) {
      const peta = k.alatPetaStatusCerai(jenis, kode);
      for (const kunci of [`${jenis.toLowerCase()}|digugurkan`, `${jenis.toLowerCase()}|gugur`]) {
        expect(peta[kunci].berkas).toBe("[98] [Gugur] 3. Cerai P & T Tidak Hadir");
        expect(peta[kunci].catatan).toContain("[98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir");
        expect(peta[kunci].catatan).toContain("[98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah (P Tidak Pernah Hadir)");
      }
      // [98] [NO] 4b tetap di baris NO
      expect(peta[`${jenis.toLowerCase()}|tidak dapat diterima`].catatan).toContain("[98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah");
    }
  });

  it("varian kabul cerai menyebut [01c] format lengkap setelah mediasi", () => {
    const k = alat();
    expect(k.alatPetaStatusCerai("Cerai Gugat", "CG")["cerai gugat|dikabulkan"].catatan).toContain("[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi");
    expect(k.alatPetaStatusCerai("Cerai Talak", "CT")["cerai talak|dikabulkan"].catatan).toContain("[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi");
  });
});
