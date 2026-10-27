// @vitest-environment node
/**
 * 19 OKT 2026 - NAMA MENU DERRY DITULIS LENGKAP ("CG - BAS" -> "Cerai Gugat - BAS")
 *
 * Yang dijaga:
 *   C  cermin: pasangan nama lama -> lengkap di ekstensi (panel-alat.js) SAMA dengan sumber portal (lib/alias-menu-derry.ts)
 *   K  kunci kelompok: nama lama dan lengkap satu kunci; nama lain tidak ikut berubah
 *   T  tampilan: nama lama ditampilkan lengkap, nama lain apa adanya
 *   P  portal: rekomendasi membawa KEDUA alias (ABT sebelum dan sesudah paket nama lengkap)
 *   J  jendela "Pilih blangko" di ABT sebelum DAN sesudah paket: kelompok BAS Cerai Gugat tampil "Cerai Gugat - BAS",
 *      hak per folder (nama lama atau lengkap) tetap mengenali kelompoknya, dan blangko tetap dapat dipilih
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { ALIAS_MENU_DERRY_LAMA_KE_BARU, AWALAN_ALIAS_MENU_DERRY, aliasMenuLengkap, perluasAliasMenu } from "@/lib/alias-menu-derry";
import { ringkasHakBlangko, type FolderMenuAbt } from "@/lib/pengaturan-abt";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const PANEL = baca("panel-alat.js");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

/** Potongan panel-alat.js: dari konstanta awalan sampai akhir alatKunciKelompok - dijalankan terpisah (tanpa DOM). */
function muatPotongan() {
  const awal = PANEL.indexOf("const ALAT_ALIAS_MENU_DERRY_AWALAN");
  const akhirFungsi = PANEL.indexOf("function alatKunciKelompok(nama)");
  expect(awal).toBeGreaterThan(0);
  expect(akhirFungsi).toBeGreaterThan(awal);
  const tutup = PANEL.indexOf("\n}\n", akhirFungsi) + 3;
  const kode = PANEL.slice(awal, tutup);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const f = new Function(`${kode}\nreturn { AWALAN: ALAT_ALIAS_MENU_DERRY_AWALAN, BARU: ALAT_ALIAS_MENU_DERRY_BARU, kunci: alatKunciKelompok, lengkap: alatNamaMenuLengkap };`);
  return f() as {
    AWALAN: Array<[string, string]>;
    BARU: Record<string, string>;
    kunci: (n: unknown) => string;
    lengkap: (n: unknown) => string;
  };
}

describe("C. cermin portal <-> ekstensi", () => {
  it("awalan identik dan urutannya sama", () => {
    const e = muatPotongan();
    expect(e.AWALAN).toEqual(AWALAN_ALIAS_MENU_DERRY.map((p) => [...p]));
  });
  it("peta lama -> lengkap identik (huruf kecil di ekstensi)", () => {
    const e = muatPotongan();
    const dariPortal = Object.fromEntries(Object.entries(ALIAS_MENU_DERRY_LAMA_KE_BARU).map(([k, v]) => [k.toLowerCase(), v]));
    expect({ ...e.BARU }).toEqual(dariPortal);
  });
  it("tiap nama lengkap unik dan tidak ada nama lengkap yang juga nama lama", () => {
    const baru = Object.values(ALIAS_MENU_DERRY_LAMA_KE_BARU).map((x) => x.toLowerCase());
    expect(new Set(baru).size).toBe(baru.length);
    const lama = new Set(Object.keys(ALIAS_MENU_DERRY_LAMA_KE_BARU).map((x) => x.toLowerCase()));
    expect(baru.filter((x) => lama.has(x))).toEqual([]);
  });
  it("32 nama menu berganti: 15 pasang Putusan/BAS + Relaas + PTSP", () => {
    expect(Object.keys(ALIAS_MENU_DERRY_LAMA_KE_BARU)).toHaveLength(15 * 2 + 2);
  });
});

describe("K. kunci kelompok", () => {
  const e = muatPotongan();
  it("nama lama dan lengkap satu kunci, besar-kecil dan spasi tidak berpengaruh", () => {
    for (const [lama, baru] of Object.entries(ALIAS_MENU_DERRY_LAMA_KE_BARU)) {
      expect(e.kunci(lama)).toBe(e.kunci(baru));
      expect(e.kunci(`  ${lama.toUpperCase()}  `)).toBe(e.kunci(baru.replace(/ /g, "  ")));
    }
  });
  it("CG - BAS = Cerai Gugat - BAS, tetapi bukan Cerai Talak - BAS", () => {
    expect(e.kunci("CG - BAS")).toBe(e.kunci("Cerai Gugat - BAS"));
    expect(e.kunci("CG - BAS")).not.toBe(e.kunci("Cerai Talak - BAS"));
    expect(e.kunci("CG - Putusan")).not.toBe(e.kunci("CG - BAS"));
  });
  it("nama yang bukan singkatan tidak berubah (Perwalian, Wali Adhal, nama menu 'Putusan Cerai Gugat')", () => {
    for (const n of ["Perwalian - BAS", "Wali Adhal - Putusan", "Putusan Cerai Gugat", "Cerai Talak - BAS", "Sita - Putusan Sela", "Mafqud - BAS", "Putusan CG"]) {
      expect(e.kunci(n)).toBe(n.toLowerCase());
    }
  });
  it("nama kosong atau bukan teks tidak melempar", () => {
    expect(e.kunci(undefined)).toBe("");
    expect(e.kunci(null)).toBe("");
  });
});

describe("T. tampilan", () => {
  const e = muatPotongan();
  it("nama lama tampil lengkap; nama lain apa adanya", () => {
    expect(e.lengkap("CG - BAS")).toBe("Cerai Gugat - BAS");
    expect(e.lengkap("Diska/DK - Putusan")).toBe("Dispensasi Kawin - Putusan");
    expect(e.lengkap("PAW/P3HP - BAS")).toBe("Penetapan Ahli Waris/Pertolongan Pembagian Harta Peninggalan - BAS");
    expect(e.lengkap("Relaas dan PBT")).toBe("Relaas dan Pemberitahuan Putusan");
    expect(e.lengkap("Form PTSP")).toBe("Form Pelayanan Terpadu Satu Pintu (PTSP)");
    expect(e.lengkap("Cerai Talak - BAS")).toBe("Cerai Talak - BAS");
    expect(e.lengkap("Perwalian - BAS")).toBe("Perwalian - BAS");
    expect(e.lengkap("")).toBe("");
  });
  it("tidak ada nama lengkap yang memuat singkatan yang dilarang", () => {
    for (const baru of Object.values(ALIAS_MENU_DERRY_LAMA_KE_BARU)) {
      expect(baru).not.toMatch(/\b(CG|CT|DK|HB|PAW|IN|ES|PBT|Diska)\b/);
    }
  });
});

describe("P. portal", () => {
  it("perluasAliasMenu membawa alias lama dan lengkap, tanpa ganda", () => {
    expect(perluasAliasMenu(["CG - BAS"])).toEqual(["CG - BAS", "Cerai Gugat - BAS"]);
    expect(perluasAliasMenu(["Cerai Gugat - BAS"])).toEqual(["Cerai Gugat - BAS", "CG - BAS"]);
    expect(perluasAliasMenu(["Putusan CT", "CT - Putusan"])).toEqual(["Putusan CT", "CT - Putusan", "Cerai Talak - Putusan"]);
    expect(perluasAliasMenu(["Perwalian - BAS"])).toEqual(["Perwalian - BAS"]);
    expect(perluasAliasMenu([])).toEqual([]);
  });
  it("aliasMenuLengkap", () => {
    expect(aliasMenuLengkap("hb - bas")).toBe("Harta Bersama - BAS");
    expect(aliasMenuLengkap("Kewarisan - BAS")).toBe("Kewarisan - BAS");
  });
});

// ----------------------------------------------------------------------------
// J. jendela "Pilih blangko" - ABT sebelum dan sesudah paket nama lengkap
// ----------------------------------------------------------------------------
const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-15";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => JSON.parse(JSON.stringify(x));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(5);
  }
}
const F = (id: number, nama: string, namaAlias: string, grup: string, top: string, cek: number): FolderMenuAbt => ({
  id, nama, namaAlias, direktori: nama, user_grup_id: grup, user_top_id: top, user_validator: null, user_cek: cek,
  proses_id_min: 80, proses_id_max: 297, perkara_id_min: 347, perkara_id_max: 347, perkara_id_referensi: "jenis_perkara_id",
});
const GRUP_BAS = "1|30|500|430|1000|1010|1020";
const SI = (tanggal: string, agenda: string, ket = "", urutan = 1) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan, hadir: null, adaBas: null, ruangan: "" });
const PK = {
  nomorPerkara: "581/Pdt.G/2026/PA.Dgl", perkaraId: "10154", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: true, tanggalPutusan: HARI_INI, tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["pp"], pihak: { penggugat: ["P"], tergugat: ["T"] },
  sidang: [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", 1), SI(HARI_INI, "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)", 2)],
};
const BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";

type Halaman = { dom: JSDOM; w: any; minta: string[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

/**
 * ABT tiruan. `alias` = nama di bilah kiri (abt_menu.nama_alias); judul kartu kelompok (h3) sengaja SAMA dengan alias agar nama lama pun diuji.
 * `hak` = daftar folder untuk ringkas hak (namaAlias SAMA dengan alias bilah kiri, seperti di server).
 */
function buka(p: { alias: string; hakAlias: string }): Halaman {
  const MENU =
    `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel">` +
    `<a href="${BERANDA}?a=${encodeURIComponent(p.alias)}&c=" title="(54 Blangko)">${p.alias}</a></div>`;
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b></div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.12" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: () => undefined, lastError: undefined },
    storage: {
      local: {
        get: async (k?: string | string[] | null) => {
          const daftar = k == null ? Object.keys(simpanan) : [k].flat();
          return Object.fromEntries(daftar.filter((x) => x in simpanan).map((x) => [x, polos(simpanan[x])]));
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const hak = ringkasHakBlangko({ folder: [F(102, "Cerai Gugat - BAS", p.hakAlias, GRUP_BAS, "1|30", 3)], config: { validasi_data_bas: "0" } });
  const minta: string[] = [];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push(`${cara} ${url}`);
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"], kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: false, nama: "PP Satu", sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangLain: false, perkara: [PK] } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry?hak=1")) return json({ ok: true, data: hak });
    if (url.includes("/aleta-ecourt/blangko-derry")) return json({ ok: true, data: { ada: false, sebab: "uji" } });
    if (url.includes("/aleta-ecourt/sidang")) return json({ ok: true, data: { sipp: { jadwalPerkara: [] } } });
    if (url === BERANDA) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=`)) {
      return html(`<div class="pricing-top tiga"><h3>${p.alias}</h3></div><p><a href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"A-CG", b:"B-CG", c:"" });'># <span>${BAS}</span></a></p>`);
    }
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" } as unknown as Response;
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return { dom, w, minta };
}

const akar = (h: Halaman) => h.w.document.getElementById("aleta-bd-akar") as HTMLElement;
const q = (h: Halaman, s: string) => akar(h).querySelector(s) as HTMLElement | null;
const qq = (h: Halaman, s: string) => Array.from(akar(h).querySelectorAll(s)) as HTMLElement[];
const klik = (h: Halaman, s: string) => {
  const el = q(h, s);
  if (!el) throw new Error(`tidak ada: ${s}`);
  el.click();
};

async function bukaJendelaBas(h: Halaman) {
  await sampai(() => h.w.aletaBlangkoDerry && h.w.aletaBlangkoDerry.keadaan().peran.length, "peran terbaca");
  (Array.from(h.w.document.querySelectorAll("#navbar .accordion")).find((b: any) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, `[data-pk="${PK.nomorPerkara}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
  await tunggu(30);
  klik(h, '[data-jenismodal="bas"]');
  await tunggu(10);
}
// 27 Okt: hanya sisi kiri (tombol asal saran di sisi kanan juga ber-data-kelmodal).
const namaKelompok = (h: Halaman) => qq(h, ".bd-mkiri [data-kelmodal]").map((b) => b.querySelector(".kn")!.textContent || "").filter((n) => n !== "Disarankan");

describe("J. jendela Pilih blangko sebelum dan sesudah paket nama lengkap", () => {
  for (const [keadaan, alias] of [["SEBELUM paket (alias lama)", "CG - BAS"], ["SESUDAH paket (alias lengkap)", "Cerai Gugat - BAS"]] as const) {
    it(`${keadaan}: kelompok tampil "Cerai Gugat - BAS", hak mengenalinya, blangko dapat dipilih`, async () => {
      const h = buka({ alias, hakAlias: alias });
      await bukaJendelaBas(h);
      expect(namaKelompok(h)).toEqual(["Cerai Gugat - BAS"]);
      expect(h.w.document.getElementById("bd-modal").textContent).not.toContain("CG - BAS");
      const kel = h.w.aletaBlangkoDerry.keadaan();
      expect(kel).toBeTruthy();
    });
  }

  it("hak per folder memakai nama LAIN dari bilah kiri (portal sudah paket, ABT belum / sebaliknya) tetap cocok", async () => {
    for (const [alias, hakAlias] of [["CG - BAS", "Cerai Gugat - BAS"], ["Cerai Gugat - BAS", "CG - BAS"]] as const) {
      const h = buka({ alias, hakAlias });
      const murni = h.w.aletaBlangkoDerry.murni;
      const hak = { saklar: { hakimBas: false, ppPutusan: false }, folder: [{ id: 102, nama: "Cerai Gugat - BAS", namaAlias: hakAlias, user_grup_id: GRUP_BAS, user_top_id: "1|30" }] };
      // admin meniru PP: folder dikenali lewat nama lama maupun lengkap -> hak grup 500 terbuka
      expect(murni.kelompokBoleh({ nama: alias, jenis: "bas" }, { admin: true, sebagaiPeran: "pp", peran: [], hak })).toBe(true);
      // admin meniru hakim: grup 20 tidak ada di GRUP_BAS -> tertutup (membuktikan folder DITEMUKAN, bukan jatuh ke "boleh")
      expect(murni.kelompokBoleh({ nama: alias, jenis: "bas" }, { admin: true, sebagaiPeran: "hakim", peran: [], hak: { ...hak, saklar: { hakimBas: true, ppPutusan: false } } })).toBe(false);
    }
  });

  it("saran portal (alias lama ATAU lengkap) menemukan kelompok pada ABT sebelum maupun sesudah paket", () => {
    const h = buka({ alias: "CG - BAS", hakAlias: "CG - BAS" });
    const { kelompokUntukSaran } = h.w.aletaBlangkoDerryIsian.murni;
    const menuLama = [{ nama: "CG - Putusan" }, { nama: "CG - BAS" }, { nama: "Diska/DK - Putusan" }];
    const menuBaru = [{ nama: "Cerai Gugat - Putusan" }, { nama: "Cerai Gugat - BAS" }, { nama: "Dispensasi Kawin - Putusan" }];
    // portal LAMA (hanya alias lama) dan portal BARU (alias lama + lengkap), terhadap ABT lama dan ABT baru
    const rBas = (alias: string[]) => ({ menu: "Cerai Gugat - BAS", alias, folder: "derry_briantono/1 Perceraian CG - BAS" });
    const rPut = (alias: string[]) => ({ menu: "Putusan Cerai Gugat", alias, folder: "derry_briantono/1 Perceraian CG" });
    const rDk = (alias: string[]) => ({ menu: "Putusan Dispensasi Kawin", alias, folder: "derry_briantono/3 Dispensasi Kawin" });
    for (const [menu, nBas, nPut, nDk] of [[menuLama, "CG - BAS", "CG - Putusan", "Diska/DK - Putusan"], [menuBaru, "Cerai Gugat - BAS", "Cerai Gugat - Putusan", "Dispensasi Kawin - Putusan"]] as const) {
      for (const aliasBas of [["CG - BAS"], ["CG - BAS", "Cerai Gugat - BAS"]]) expect(kelompokUntukSaran(menu, rBas(aliasBas))).toBe(nBas);
      for (const aliasPut of [["Putusan CG", "CG - Putusan"], ["Putusan CG", "CG - Putusan", "Cerai Gugat - Putusan"]]) expect(kelompokUntukSaran(menu, rPut(aliasPut))).toBe(nPut);
      for (const aliasDk of [["Diska/DK - Putusan"], ["Diska/DK - Putusan", "Dispensasi Kawin - Putusan"]]) expect(kelompokUntukSaran(menu, rDk(aliasDk))).toBe(nDk);
    }
  });
});
