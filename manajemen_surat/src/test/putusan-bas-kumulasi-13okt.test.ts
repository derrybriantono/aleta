// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
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

  it("itsbat: cerai gugat -> 1c [01aa] IN + CG - F (sudah ada); cerai talak -> 1e [01aa] Putusan CT Kumulasi Itsbat Nikah - F", () => {
    const g = pilih("Cerai Gugat", "Dikabulkan (verstek)", false, KUM(["itsbat-nikah"]));
    expect(g!.baris.berkas).toBe("[01aa] [Kabul Verstek] IN + CG - F");
    expect(g!.baris.blangko).toBe("Putusan Cerai Kumulasi Itsbat Nikah");
    const t = pilih("Cerai Talak", "Dikabulkan", true, ["itsbat-nikah"]);
    expect(t!.baris.berkas).toBe("[01aa] [Kabul Verstek] Putusan CT Kumulasi Itsbat Nikah - F");
    expect(t!.baris.blangko).toBe("Putusan Cerai Talak Kumulasi Itsbat Nikah");
    // dua kumulasi tanpa blangko gabungan: itsbat didahulukan (urutan ALAT_URUT_KUMULASI)
    expect(pilih("Cerai Gugat", "Dikabulkan", true, KUM(["hak-asuh-anak"], ["itsbat-nikah"]))!.baris.berkas).toBe("[01aa] [Kabul Verstek] IN + CG - F");
  });

  it("status/keadaan tanpa blangko kumulasi tetap ke baris status cerai biasa; tanpa kumulasi = perilaku P 12 Okt", () => {
    expect(pilih("Cerai Gugat", "Dicabut", false, KUM(["hak-asuh-anak"]))!.kunci).toBe("cerai gugat|dicabut");
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
    expect(kum.map((e) => e.kunci).sort()).toEqual([
      "cerai gugat+hak-asuh-anak+nafkah-anak|dikabulkan|verstek",
      "cerai gugat+hak-asuh-anak|dikabulkan|verstek",
      "cerai gugat+itsbat-nikah|dikabulkan|verstek",
      "cerai talak+itsbat-nikah|dikabulkan|verstek",
    ]);
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
      "Putusan Cerai Talak Kumulasi Itsbat Nikah": "1e Putusan Cerai Talak Kumulasi Itsbat Nikah",
      "Putusan Cerai Gugat Kumulasi Hak Asuh Anak": "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak",
    };
    const peta = jalan("ALAT_PETA_BAWAAN") as Record<string, Baris>;
    for (const [kunci, b] of Object.entries(peta)) {
      if (!kunci.includes("+")) continue;
      const d = folder[b.blangko];
      expect(d, kunci).toBeTruthy();
      expect(existsSync(path.join(ABT_DERRY, d, `${b.berkas}.rtf`)), `${kunci}: ${b.berkas}`).toBe(true);
      for (const varian of (b.catatan || "").startsWith("varian: ") ? b.catatan!.slice(8).split("; ") : []) {
        expect(existsSync(path.join(ABT_DERRY, d, `${varian}.rtf`)), `${kunci} varian: ${varian}`).toBe(true);
      }
    }
    for (const a of ALUR_BAS_KUMULASI) {
      for (const l of a.langkah) expect(existsSync(path.join(path.dirname(ABT_DERRY), a.folder, l.berkas)), `${a.id} ${l.berkas}`).toBe(true);
    }
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
    // alur 03 (sidang ke-3, agenda saksi) dan 06 (T pernah hadir) juga
    expect(tentukanAlurBasKumulasi({ ...dasar, urutanSidang: 3, agenda: "Pembuktian saksi", kumulasi: ["hak-asuh-anak"] }).alur!.id).toBe("alur-k1");
    expect(tentukanAlurBasKumulasi({ ...dasar, urutanSidang: 3, tergugatPernahHadir: true, kumulasi: ["hak-asuh-anak"] }).alur!.id).toBe("alur-k1");
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
