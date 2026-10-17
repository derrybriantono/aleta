// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { beforeAll, describe, expect, it } from "vitest";

import { alurBasBaris } from "@/app/api/aleta-ecourt/bas-massal/susun";
import { tentukanAlurBas } from "@/lib/alur-bas";
import { ALUR_BAS_KUMULASI, butirKumulasiAlur, tentukanAlurBasKumulasi } from "@/lib/alur-bas-kumulasi";
import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";
import { validasiEntri } from "@/lib/tipe-keluaran/validasi";

/**
 * ============================================================================
 * PUTUSAN & BAS PERKARA KUMULASI + BAS ITSBAT GUGUR/CABUT (Agen T, 13 Okt 2026)
 * ============================================================================
 *
 * Paket ABT abt-putusan-bas-lengkap (folder derry_briantono 1d/1e + BAS 945/946). Yang dijaga:
 *   A. panel-alat.js SUNGGUHAN (node:vm): perkara kumulasi (keterangan bot SIPP + petitum) mendapat blangko kumulasinya;
 *      status lain dan perkara tanpa kumulasi tetap seperti sebelumnya; cermin portal sama & lolos validasi.
 *   B. alur BAS: cerai gugat verstek kumulasi hak asuh -> BAS kumulasi (alur asli jadi alternatif); itsbat gugur/cabut.
 *   C. bot: usulan set pertanyaan saksi untuk kumulasi (itsbat -> A3/A3a, anak & nafkah -> + tambah-anak-nafkah), dan rute
 *      /abt/usulan SUNGGUHAN menjawab usulanKumulasi dari kumulasi perkara itu.
 *   D. bila ABT laptop ada: setiap berkas yang dirujuk peta & alur BENAR-BENAR ada di foldernya.
 */

const AKAR = path.resolve(__dirname, "../../..");
const AKAR_EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const ABT_DERRY = "D:/satker asal/website pa bungku/xampp/htdocs/aps_badilag/_blangko_abt/derry_briantono";

function jalankanPanelAlat(fetchPalsu?: (url: string) => unknown) {
  const sumber = readFileSync(path.join(AKAR_EKSTENSI, "panel-alat.js"), "utf8");
  const elemen = () => ({
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    appendChild: (x: unknown) => x,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  });
  const konteks: Record<string, unknown> = {
    console, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Boolean, Array, Object, Promise, Error, Map, Set,
    URLSearchParams, URL, AbortController,
    document: { documentElement: elemen(), createElement: elemen, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    location: { origin: "http://127.0.0.1", pathname: "/", search: "" },
    window: {
      location: { hostname: "127.0.0.1", pathname: "/", search: "", origin: "http://127.0.0.1" },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (p: string) => p },
      storage: { onChanged: { addListener() {} }, local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined } },
    },
    fetch: async (url: string) => {
      const isi = fetchPalsu ? fetchPalsu(String(url)) : {};
      return { ok: true, status: 200, json: async () => isi, clone() { return this; } };
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(sumber, konteks, { filename: "panel-alat.js" });
  return {
    jalan: (kode: string) => JSON.parse(JSON.stringify(vm.runInContext(kode, konteks) ?? null)),
    janji: async (kode: string) => JSON.parse(JSON.stringify((await vm.runInContext(kode, konteks)) ?? null)),
  };
}

type Baris = { berkas: string; blangko: string; statusAsli?: string; jenisAsli: string; catatan?: string; blangkoLain?: string[] };
type Hasil = { baris: Baris; kunci: string; tingkat: string } | null;

const KUM = (...kode: [string, string?][]) => ({ daftar: kode.map(([k, sumber]) => ({ kode: k, nama: k, sumber: sumber || "sipp" })), sumber: "sipp" });

// ============================================================================
// A. PEMILIH BLANGKO PUTUSAN KUMULASI
// ============================================================================
describe("A. pemilih blangko putusan kumulasi (panel-alat.js yang dijalankan)", () => {
  const { jalan } = jalankanPanelAlat();
  const pilih = (jenis: string, status: string, verstek: boolean, kumulasi?: unknown): Hasil =>
    jalan(`alatPetaUntukPerkara(ALAT_PETA_BAWAAN, ${JSON.stringify(jenis)}, ${JSON.stringify(status)}, ${verstek}, ${JSON.stringify(kumulasi ?? null)})`);

  it("cerai gugat kabul verstek + hak asuh -> [01] Putusan CG Kumulasi Hak Asuh Anak (menu 1d); + nafkah anak -> [01b]", () => {
    const h = pilih("Cerai Gugat", "Dikabulkan", true, KUM(["hak-asuh-anak"]));
    expect(h!.tingkat).toBe("kumulasi-verstek");
    expect(h!.kunci).toBe("cerai gugat+hak-asuh-anak|dikabulkan|verstek");
    expect(h!.baris.berkas).toBe("[01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz");
    expect(h!.baris.blangko).toBe("Putusan Cerai Gugat Kumulasi Hak Asuh Anak");
    const n = pilih("Cerai Gugat", "Dikabulkan", true, KUM(["nafkah-anak", "petitum"], ["hak-asuh-anak"]));
    expect(n!.kunci).toBe("cerai gugat+hak-asuh-anak+nafkah-anak|dikabulkan|verstek");
    expect(n!.baris.berkas).toContain("[01b] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak dan Nafkah Anak");
  });

  it("itsbat: blangko BARU pengganti 1c [01aa] IN + CG (menu 903) - CG dan CT masing-masing; blangko lama tidak dirujuk lagi", () => {
    const g = pilih("Cerai Gugat", "Dikabulkan (verstek)", false, KUM(["itsbat-nikah"]));
    expect(g!.baris.berkas).toBe("[01aa] [Kabul Verstek] Putusan CG Kumulasi Itsbat Nikah - Format Lengkap");
    expect(g!.baris.blangko).toBe("Putusan Cerai Kumulasi Itsbat Nikah");
    const t = pilih("Cerai Talak", "Dikabulkan", true, ["itsbat-nikah"]);
    expect(t!.baris.berkas).toBe("[01aa] [Kabul Verstek] Putusan CT Kumulasi Itsbat Nikah - Format Lengkap");
    expect(t!.baris.blangko).toBe("Putusan Cerai Kumulasi Itsbat Nikah");
    // dua kumulasi tanpa blangko gabungan: itsbat didahulukan (urutan ALAT_URUT_KUMULASI)
    expect(pilih("Cerai Gugat", "Dikabulkan", true, KUM(["hak-asuh-anak"], ["itsbat-nikah"]))!.baris.berkas).toContain("Putusan CG Kumulasi Itsbat Nikah");
    const berkas = Object.values(jalan("ALAT_PETA_BAWAAN") as Record<string, Baris>).map((b) => b.berkas);
    expect(berkas.filter((b) => b.includes("IN + CG"))).toEqual([]);
  });

  it("status/keadaan tanpa blangko kumulasi tetap ke baris status cerai biasa; tanpa kumulasi = perilaku P 12 Okt", () => {
    expect(pilih("Cerai Gugat", "Ditolak", false, KUM(["hak-asuh-anak"]))!.kunci).toBe("cerai gugat|ditolak");
    // I17 18 Okt: cabut/gugur/coret/NO kumulasi kini punya blangko sendiri di folder 1c / 1d (baris kumulasi polos).
    expect(pilih("Cerai Gugat", "Dicabut", false, KUM(["hak-asuh-anak"]))).toMatchObject({ kunci: "cerai gugat+hak-asuh-anak|dicabut", tingkat: "kumulasi" });
    expect(pilih("Cerai Gugat", "Dikabulkan", false, KUM(["hak-asuh-anak"]))!.kunci).toBe("cerai gugat|dikabulkan");
    expect(pilih("Cerai Talak", "Dikabulkan", true, KUM(["hak-asuh-anak"]))!.kunci).toBe("cerai talak|dikabulkan|verstek");
    expect(pilih("Cerai Gugat", "Dikabulkan", true, null)!.kunci).toBe("cerai gugat|dikabulkan|verstek");
    expect(pilih("Cerai Gugat", "Dikabulkan", true, KUM(["harta-bersama"]))!.kunci).toBe("cerai gugat|dikabulkan|verstek");
    expect(pilih("Cerai Gugat", "", true, KUM(["hak-asuh-anak"]))!.tingkat).toBe("jenis");
  });

  it("alatKodeKumulasi menerima keterangan bot, daftar kode, dan menolak sampah", () => {
    expect(jalan(`alatKodeKumulasi(${JSON.stringify(KUM(["itsbat-nikah"], ["hak-asuh-anak", "petitum"]))})`)).toEqual(["itsbat-nikah", "hak-asuh-anak"]);
    expect(jalan(`alatKodeKumulasi(["Itsbat-Nikah", "itsbat-nikah", "<x>", 5, null])`)).toEqual(["itsbat-nikah"]);
    expect(jalan("alatKodeKumulasi(null)")).toEqual([]);
    expect(jalan(`alatCalonKunciKumulasi(["nafkah-anak", "hak-asuh-anak", "mutah"])`)).toEqual(["hak-asuh-anak+nafkah-anak", "hak-asuh-anak", "nafkah-anak"]);
  });

  it("jadwal sidang massal membawa kode kumulasi tiap perkara dari bot", async () => {
    const { janji } = jalankanPanelAlat(() => ({
      data: {
        available: true,
        sidang: [
          { nomorPerkara: "336/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", kumulasi: KUM(["hak-asuh-anak"]) },
          { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", kumulasi: null },
        ],
      },
    }));
    const d = await janji(`alatSidangPadaTanggal("2026-10-13")`);
    expect(d.map((x: { kumulasi: string[] }) => x.kumulasi)).toEqual([["hak-asuh-anak"], []]);
  });

  it("baris kumulasi ikut tipe keluaran tertanam, kembali utuh, dan cerminnya di portal sama & lolos validasi", () => {
    const tertanam = jalan("alatTipeTertanamPeta()") as { kunci: string; nilai: string; data: Record<string, unknown> }[];
    const kum = tertanam.filter((e) => e.kunci.includes("+"));
    // I17 18 Okt: + 40 baris kumulasi cabut/gugur/coret/NO/kabul/tolak (folder 1c dan 1d) di samping empat baris verstek (T 13 Okt).
    expect(kum).toHaveLength(44);
    expect(kum.map((e) => e.kunci)).toEqual(
      expect.arrayContaining([
        "cerai gugat+hak-asuh-anak+nafkah-anak|dikabulkan|verstek",
        "cerai gugat+hak-asuh-anak|dikabulkan|verstek",
        "cerai gugat+itsbat-nikah|dikabulkan|verstek",
        "cerai talak+itsbat-nikah|dikabulkan|verstek",
      ])
    );
    expect(jalan("alatPetaBawaanDariEntri(alatTipeTertanamPeta())")).toEqual(jalan("ALAT_PETA_BAWAAN"));
    const cermin = CERMIN_EKSTENSI["putusan.peta-blangko"].filter((e) => e.kunci.includes("+"));
    expect(cermin.map((e) => ({ kunci: e.kunci, nilai: e.nilai, data: e.data }))).toEqual(
      kum.map((e) => ({ kunci: e.kunci, nilai: e.nilai, data: e.data })).sort((a, b) => cermin.findIndex((c) => c.kunci === a.kunci) - cermin.findIndex((c) => c.kunci === b.kunci))
    );
    for (const e of cermin) {
      const h = validasiEntri("putusan.peta-blangko", { kunci: e.kunci, nilai: e.nilai, data: e.data });
      expect(h.ok, `${e.kunci}: ${h.ok ? "" : h.alasan.join("; ")}`).toBe(true);
    }
  });

  const folderAda = existsSync(ABT_DERRY);
  it.skipIf(!folderAda)("D. tiap berkas kumulasi (dan variannya) ada di folder derry_briantono laptop (paket terpasang)", () => {
    const folder: Record<string, string> = {
      "Putusan Cerai Kumulasi Itsbat Nikah": "1c Perceraian Kumulasi Itsbat Nikah",
      "Putusan Cerai Gugat Kumulasi Hak Asuh Anak": "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak",
    };
    const peta = jalan("ALAT_PETA_BAWAAN") as Record<string, Baris>;
    for (const [kunci, b] of Object.entries(peta)) {
      if (!kunci.includes("+")) continue;
      const d = folder[b.blangko];
      expect(d, kunci).toBeTruthy();
      // I17 18 Okt: blangko kumulasi baru (paket abt-putusan-celah-kumulasi-derry, BELUM terpasang di laptop) dijaga pemetaan-i17-18okt.test.ts atas fixture server.
      const baruI17 = (nama: string) => !/^\[01aa\]|^\[01\] |^\[01b\] /.test(nama) && !existsSync(path.join(ABT_DERRY, d, `${nama}.rtf`));
      if (baruI17(b.berkas)) continue;
      expect(existsSync(path.join(ABT_DERRY, d, `${b.berkas}.rtf`)), `${kunci}: ${b.berkas}`).toBe(true);
      for (const varian of (b.catatan || "").startsWith("varian: ") ? b.catatan!.slice(8).split("; ") : []) {
        if (baruI17(varian)) continue;
        expect(existsSync(path.join(ABT_DERRY, d, `${varian}.rtf`)), `${kunci} varian: ${varian}`).toBe(true);
      }
    }
    // blangko lama 1c [01aa] IN + CG (salah sebutan istri/suami pada cerai talak, dll.) disingkirkan paket - tidak ada lagi di menu 903
    for (const lama of ["[01aa] [Kabul Verstek] IN + CG - F.rtf", "[01aa] [Kabul Verstek] IN + CG - B & F.rtf"]) {
      expect(existsSync(path.join(ABT_DERRY, "1c Perceraian Kumulasi Itsbat Nikah", lama)), lama).toBe(false);
    }
    for (const a of ALUR_BAS_KUMULASI) {
      for (const l of a.langkah) expect(existsSync(path.join(path.dirname(ABT_DERRY), a.folder, l.berkas)), `${a.id} ${l.berkas}`).toBe(true);
    }
  });

  it.skipIf(!folderAda)("D. status sebelum menikah: #1002# = pihak pertama (#0046#), #1003# = pihak kedua (#0047#) - blangko itsbat kumulasi CG & CT dan set saksi A3/A3a sama", () => {
    // Ukur server 13 Okt (abt_data_teks x jenis perkara): CG #1002# wanita 20/24 (Penggugat), #1003# pria 18/21; CT #1002# pria 3/3.
    const folder = path.join(ABT_DERRY, "1c Perceraian Kumulasi Itsbat Nikah");
    for (const kode of ["CG", "CT"]) {
      const isi = readFileSync(path.join(folder, `[01aa] [Kabul Verstek] Putusan ${kode} Kumulasi Itsbat Nikah - Format Lengkap.rtf`), "latin1");
      expect(isi, kode).toContain("#0046# berstatus #1002# dan #0047# berstatus #1003#");
      expect(isi, kode).not.toContain("#9052#");
      expect(isi, kode).not.toMatch(/#0046# berstatus #1003#|#0047# berstatus #1002#/);
    }
    const kamus = JSON.parse(readFileSync(path.join(AKAR, "aleta_bot", "kamus-deteksi", "awal", "pertanyaan-saksi.json"), "utf8")) as {
      templat: { kode: string; jawabContoh?: string }[];
    };
    const a3a = kamus.templat.find((t) => t.kode === "ps-a3a-10");
    expect(a3a?.jawabContoh).toContain("#0046# berstatus #1002# dan #0047# berstatus #1003#");
  });

  it.skipIf(!folderAda)("D. beban pembuktian: tidak ada lagi 'Pasal 1685 KUHPerdata' (pasal hibah) di Blangko Derry - Pasal 1865 (paket tambal)", () => {
    const salah: string[] = [];
    let benar = 0;
    const jelajah = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) jelajah(p);
        else if (/\.rtf$/i.test(e.name)) {
          const isi = readFileSync(p, "latin1");
          if (isi.includes("1685 KUHPerdata")) salah.push(path.relative(ABT_DERRY, p));
          if (isi.includes("1865 KUHPerdata")) benar += 1;
        }
      }
    };
    jelajah(ABT_DERRY);
    expect(salah).toEqual([]);
    expect(benar).toBeGreaterThanOrEqual(30); // 28 blangko lama ditambal + A1/A2 paket ini
  });
});

// ============================================================================
// B. ALUR BAS KUMULASI & ITSBAT GUGUR/CABUT
// ============================================================================
describe("B. alur BAS kumulasi", () => {
  const dasar = { jenisPerkara: "Cerai Gugat", urutanSidang: 2, dihadiriOleh: 2, tergugatPernahHadir: false };

  it("cerai gugat verstek sidang putus + hak asuh -> BAS kumulasi [2]; + nafkah anak -> [2b]; alur asli jadi alternatif", () => {
    const tanpa = tentukanAlurBas(dasar);
    expect(tanpa.alur!.id).toBe("alur-02");
    expect(tanpa.langkah!.kode).toBe("2");
    const h = tentukanAlurBasKumulasi({ ...dasar, kumulasi: KUM(["hak-asuh-anak"]) });
    expect(h.alur!.id).toBe("alur-k1");
    expect(h.langkah!.kode).toBe("2");
    expect(h.alternatif.map((l) => l.berkas)).toContain(tanpa.langkah!.berkas);
    expect(h.perkiraan).toBe(tanpa.perkiraan);
    const n = tentukanAlurBasKumulasi({ ...dasar, kumulasi: KUM(["hak-asuh-anak", "petitum"], ["nafkah-anak", "petitum"]) });
    expect(n.langkah!.kode).toBe("2b");
    expect(n.sebab).toContain("lengkapi data kumulasi di SIPP");
    // alur 03 (sidang ke-3, agenda saksi) juga; alur 06 (T pernah hadir = putusan kontradiktoir) TIDAK ke BAS verstek
    expect(tentukanAlurBasKumulasi({ ...dasar, urutanSidang: 3, agenda: "Pembuktian saksi", kumulasi: ["hak-asuh-anak"] }).alur!.id).toBe("alur-k1");
    const a06 = { ...dasar, urutanSidang: 3, tergugatPernahHadir: true };
    expect(tentukanAlurBasKumulasi({ ...a06, kumulasi: ["hak-asuh-anak"] })).toEqual(tentukanAlurBas(a06));
  });

  it("langkah selain putus verstek, cerai talak, dan tanpa kumulasi tidak berubah", () => {
    const pertama = { ...dasar, urutanSidang: 1 };
    expect(tentukanAlurBasKumulasi({ ...pertama, kumulasi: ["hak-asuh-anak"] })).toEqual(tentukanAlurBas(pertama));
    const talak = { ...dasar, jenisPerkara: "Cerai Talak" };
    expect(tentukanAlurBasKumulasi({ ...talak, kumulasi: ["hak-asuh-anak"] })).toEqual(tentukanAlurBas(talak));
    expect(tentukanAlurBasKumulasi({ ...dasar, kumulasi: null })).toEqual(tentukanAlurBas(dasar));
  });

  it("kumulasi itsbat: langkah tetap (BAS memuat #7184#), sebab mengingatkan kumulasi dari petitum belum di SIPP", () => {
    const sipp = tentukanAlurBasKumulasi({ ...dasar, kumulasi: KUM(["itsbat-nikah"]) });
    expect(sipp.langkah).toEqual(tentukanAlurBas(dasar).langkah);
    expect(sipp.sebab).toContain("#7184#");
    expect(sipp.sebab).not.toContain("lengkapi");
    const pet = tentukanAlurBasKumulasi({ ...dasar, jenisPerkara: "Cerai Talak", kumulasi: KUM(["itsbat-nikah", "petitum"]) });
    expect(pet.sebab).toContain("lengkapi data kumulasi di SIPP");
  });

  it("itsbat nikah gugur / dicabut -> folder BAS Itsbat Nikah Gugur dan Cabut", () => {
    const itsbat = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", urutanSidang: 2, dihadiriOleh: 4 };
    expect(tentukanAlurBasKumulasi({ ...itsbat, akhir: "gugur" }).langkah!.kode).toBe("G");
    expect(tentukanAlurBasKumulasi({ ...itsbat, dihadiriOleh: 1, akhir: "cabut" }).langkah!.kode).toBe("C");
    const kira = tentukanAlurBasKumulasi(itsbat);
    expect(kira.alur!.id).toBe("alur-k2");
    expect(kira.perkiraan).toBe(true);
    expect(tentukanAlurBasKumulasi({ ...itsbat, urutanSidang: 1 }).alur!.id).toBe("alur-11");
  });

  it("BAS massal (susun.ts alurBasBaris) memakai pembungkus kumulasi", () => {
    const b = alurBasBaris({ ...dasar, kumulasi: KUM(["hak-asuh-anak"]) });
    expect(b!.folder).toBe("derry_briantono/BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)");
    expect(b!.alternatif.length).toBeGreaterThan(1);
    expect(butirKumulasiAlur("x")).toEqual([]);
  });
});

// ============================================================================
// C. BOT: USULAN SET PERTANYAAN SAKSI UNTUK KUMULASI
// ============================================================================
describe("C. bot: set pertanyaan saksi perkara kumulasi", () => {
  const rq = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
  const svc = rq("./services/pertanyaanSaksiService.js");

  it("itsbat -> A3a/A3; anak & nafkah -> + tambah-anak-nafkah; bukan cerai / tanpa kumulasi relevan -> null", () => {
    expect(svc.usulanSetKumulasi("347", [{ kode: "itsbat-nikah", nama: "Itsbat Nikah", sumber: "sipp" }]).namaSet).toBe("cerai-gugat-itsbat-saksi-p");
    expect(svc.usulanSetKumulasi("Cerai Talak", ["itsbat-nikah"]).namaSet).toBe("cerai-talak-itsbat-saksi-p");
    expect(svc.usulanSetKumulasi(347, ["hak-asuh-anak"]).namaSet).toBe("cerai-gugat-praktik+anak-nafkah");
    expect(svc.usulanSetKumulasi(347, ["itsbat-nikah", "nafkah-anak"]).namaSet).toBe("cerai-gugat-itsbat-saksi-p+anak-nafkah");
    expect(svc.usulanSetKumulasi(360, ["itsbat-nikah"])).toBeNull();
    expect(svc.usulanSetKumulasi(347, [])).toBeNull();
    expect(svc.usulanSetKumulasi(347, ["harta-bersama"])).toBeNull();
    const pet = svc.usulanSetKumulasi(347, [{ kode: "hak-asuh-anak", nama: "Hak Asuh Anak", sumber: "petitum" }]);
    expect(pet.catatan).toContain("Hak Asuh Anak terbaca dari petitum");
    expect(pet.label).toContain("Hak Asuh Anak");
  });

  it("set usulan dapat diambil utuh; pertanyaan anak & nafkah disisipkan", () => {
    const dasar = svc.ambilSet("cerai-gugat-praktik", {});
    const usul = svc.ambilSet("cerai-gugat-praktik+anak-nafkah", {});
    expect(usul.ok).not.toBe(false);
    expect(usul.pertanyaan.length).toBeGreaterThan(dasar.pertanyaan.length);
    const itsbat = svc.ambilSet("cerai-gugat-itsbat-saksi-p+anak-nafkah", {});
    expect(itsbat.pertanyaan.length).toBeGreaterThan(svc.ambilSet("cerai-gugat-itsbat-saksi-p", {}).pertanyaan.length);
  });

  it("kumulasiNomorPerkara: nomor -> perkara_id -> kumulasi SIPP + petitum; galat basis data = null", async () => {
    const kum = rq("./services/kumulasiPerkaraService.js");
    const db = {
      query: (sql: string, _p: unknown, cb: (e: unknown, r: unknown[]) => void) => {
        if (/nomor_perkara = \?/.test(sql)) return cb(null, [{ perkaraId: 9839 }]);
        if (/FROM perkara_kumulasi/.test(sql)) return cb(null, []);
        return cb(null, [{ perkaraId: 9839, jenisPerkaraId: 347, petitum: "<p>1. Mengabulkan gugatan Penggugat;</p><p>3. Menetapkan Penggugat sebagai pemegang hak asuh anak bernama A;</p>" }]);
      },
    };
    const skema = { tabelAda: async () => true, kolomAda: async () => true };
    const h = await kum.kumulasiNomorPerkara("336/Pdt.G/2026/PA.Dgl", { db, skema });
    expect(h.daftar.map((x: { kode: string; sumber: string }) => `${x.kode}:${x.sumber}`)).toEqual(["hak-asuh-anak:petitum"]);
    const rusak = { query: (_s: string, _p: unknown, cb: (e: unknown) => void) => cb(new Error("mati")) };
    expect(await kum.kumulasiNomorPerkara("1/Pdt.G/2026/PA.Dgl", { db: rusak, skema })).toBeNull();
    expect(await kum.kumulasiNomorPerkara("", { db, skema })).toBeNull();
  });
});

describe("C. rute bot /abt/usulan sungguhan: usulanKumulasi pada aksi daftar", () => {
  let panggil: (body: unknown) => Promise<{ status: number; json: any }>;
  const diminta: string[] = [];
  beforeAll(() => {
    const berkas = path.join(AKAR, "aleta_bot", "routes", "internalGatewayRoutes.js");
    const isi = readFileSync(berkas, "utf8");
    const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
    const awal = isi.lastIndexOf("\n// ====", tanda);
    const akhir = isi.indexOf('router.post("/abt/pdf"');
    if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
    const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
    const rqRute = createRequire(berkas);
    const kumulasiPalsu = {
      kumulasiNomorPerkara: async (nomor: string) => {
        diminta.push(nomor);
        return nomor.startsWith("336/") ? KUM(["hak-asuh-anak", "petitum"], ["itsbat-nikah"]) : null;
      },
    };
    const konteks = vm.createContext({
      require: (p: string) => (p === "../services/kumulasiPerkaraService" ? kumulasiPalsu : rqRute(p)),
      abtUsulanService: rqRute("../services/abtUsulanService"),
      requireInternalToken: () => undefined,
      router: { post: (jalur: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[jalur] = f) },
      console,
      setTimeout,
      clearTimeout,
    });
    vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
    const f = rute["/abt/usulan"];
    panggil = async (body) => {
      let status = 200;
      let json: any = null;
      await f(
        { body: JSON.parse(JSON.stringify(body)) },
        { status: (s: number) => ((status = s), { json: (j: any) => void (json = j) }), json: (j: any) => void (json = j) }
      );
      return { status, json };
    };
  });

  it("perkara kumulasi: usulan set + catatan petitum; perkara biasa/bukan cerai: tanpa usulan & tanpa membaca kumulasi", async () => {
    const r = await panggil({ nomorPerkara: "336/Pdt.G/2026/PA.Dgl", sumber: "pertanyaan-saksi", jenisPerkara: "Cerai Gugat", pertanyaanSaksi: { aksi: "daftar" } });
    const j = r.json.pertanyaanSaksi;
    expect(j.ok).toBe(true);
    expect(j.usulanKumulasi.namaSet).toBe("cerai-gugat-itsbat-saksi-p+anak-nafkah");
    expect(j.usulanKumulasi.catatan).toContain("petitum");
    expect(j.daftar.length).toBeGreaterThan(0);
    const biasa = await panggil({ nomorPerkara: "5/Pdt.G/2026/PA.Dgl", sumber: "pertanyaan-saksi", jenisPerkara: "347", pertanyaanSaksi: { aksi: "daftar" } });
    expect(biasa.json.pertanyaanSaksi.usulanKumulasi).toBeUndefined();
    const n = diminta.length;
    const itsbat = await panggil({ nomorPerkara: "7/Pdt.P/2026/PA.Dgl", sumber: "pertanyaan-saksi", jenisPerkara: "360", pertanyaanSaksi: { aksi: "daftar" } });
    expect(itsbat.json.pertanyaanSaksi.usulanKumulasi).toBeUndefined();
    expect(diminta.length).toBe(n);
    const ambil = await panggil({
      nomorPerkara: "336/Pdt.G/2026/PA.Dgl",
      sumber: "pertanyaan-saksi",
      jenisPerkara: "347",
      pertanyaanSaksi: { aksi: "ambil", namaSet: j.usulanKumulasi.namaSet, huruf: [] },
    });
    expect(ambil.json.pertanyaanSaksi.pertanyaan.length).toBeGreaterThan(20);
  });
});
