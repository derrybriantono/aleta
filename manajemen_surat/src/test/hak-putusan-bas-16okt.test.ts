// @vitest-environment node
/**
 * ============================================================================
 * 16 OKT 2026 MALAM - HAK PUTUSAN vs BAS PER PERAN (Blangko ABT by Derry Briantono)
 * ============================================================================
 *
 * Keluhan pengguna: "role hakim masih bisa akses BAS dan begitupun sebaliknya,
 * buat sesuai role (kecuali superadmin dan admin)". Diukur: hak menu ABT di
 * server sudah memisahkan putusan (grup 1|10|20) dan BAS (grup PP/panmud, top
 * 1|30) - sebab kebocoran ada di ALETA: Super Admin/Admin yang memilih "Lihat
 * sebagai akun" tetap mendapat tiga jenis dokumen dan boleh menulis.
 *
 * Yang dijaga:
 *   M  matriks peran x folder (jenisDokumenBoleh / kelompokBoleh) - SEBELUM
 *      (admin + "Lihat sebagai" = semua) dan SESUDAH (meniru akun itu,
 *      termasuk saklar Pengaturan SIPP & ABT dan hak per folder ABT)
 *   J  jendela pilih blangko sungguhan di jsdom: tab & kelompok per peran,
 *      blangko di luar peran tidak dibuka (tanpa POST main/cari), saklar
 *      "Hakim boleh membuka folder BAS" menambah BAS bagi hakim
 *   P  portal: ringkasan hak untuk ekstensi, daftar peran kosong ditolak
 *      (ABT membacanya sebagai SEMUA pengguna), BAS massal per golongan
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { periksaPeranMenuKosong, ringkasHakBlangko, type FolderMenuAbt } from "@/lib/pengaturan-abt";
import { bolehBasMassal } from "@/lib/matriks-peran";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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

// ----------------------------------------------------------------------------
// Hak menu ABT server 16 Okt 2026 (SELECT abt_menu, baca saja) - tiga pasangan contoh
// ----------------------------------------------------------------------------
const F = (id: number, nama: string, namaAlias: string, grup: string | null, top: string | null, cek: number): FolderMenuAbt => ({
  id, nama, namaAlias, direktori: nama, user_grup_id: grup, user_top_id: top, user_validator: null, user_cek: cek,
  proses_id_min: 80, proses_id_max: 297, perkara_id_min: 347, perkara_id_max: 347, perkara_id_referensi: "jenis_perkara_id",
});
const GRUP_BAS = "1|30|500|430|1000|1010|1020";
const FOLDER_SERVER: FolderMenuAbt[] = [
  F(101, "Putusan Cerai Gugat", "CG - Putusan", "1|10|20", "1", 0),
  F(102, "Cerai Gugat - BAS", "CG - BAS", GRUP_BAS, "1|30", 3),
  // Sesudah paket abt-ganti-nama-relaas-ptsp (keputusan pengguna 16 Okt): folder "98 Relaas", HANYA juru sita + Super Admin.
  F(981, "Relaas Panggilan Sidang dan Pemberitahuan Putusan", "Relaas dan PBT", "600", "1", 0),
];
const hakDari = (folder: FolderMenuAbt[]) => ringkasHakBlangko({ folder, config: { validasi_data_bas: "0" } });

// ----------------------------------------------------------------------------
// Halaman ABT + portal tiruan
// ----------------------------------------------------------------------------
const SI = (tanggal: string, agenda: string, ket = "", urutan = 1) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan, hadir: null, adaBas: null, ruangan: "" });
const PK = {
  nomorPerkara: "581/Pdt.G/2026/PA.Dgl", perkaraId: "10154", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: true, tanggalPutusan: HARI_INI, tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim", "pp", "js"], pihak: { penggugat: ["P"], tergugat: ["T"] },
  sidang: [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", 1), SI(HARI_INI, "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)", 2)],
};
const AKUN = { hakim: ["Hakim Satu"], pp: ["PP Satu"], js: ["JS Satu"] };
type Orang = { nama: string; peran: string; roleId: string; golonganMenu: string[] };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
  js: { nama: "JS Satu", peran: "Jurusita", roleId: "jurusita", golonganMenu: ["jurusita"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};
const PUT = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";
const REL = "[JS] Pemberitahuan Putusan T";
/** Sidebar ABT: nama tampil = nama_alias. Menu akun biasa sudah disaring ABT; tiruan ini memuat apa yang diberikan uji. */
const MENU = (kel: string[]) =>
  `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel">` +
  kel.map((k) => `<a href="${BERANDA}?a=${encodeURIComponent(k)}&c=" title="(1 Blangko)">${k}</a>`).join("") +
  `</div>`;
const BERKAS_KEL: Record<string, string> = { "CG - Putusan": PUT, "CG - BAS": BAS, "Relaas dan PBT": REL };
const HAL_KELOMPOK = (judul: string, berkas: string) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div><p><a href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"A-${judul}", b:"B-${judul}", c:"" });'># <span>${berkas}</span></a></p>`;

type Minta = { url: string; cara: string };
type Halaman = { dom: JSDOM; w: any; minta: Minta[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang: string; kelompok?: string[]; hak?: ReturnType<typeof hakDari> | null; headerAdmin?: boolean }): Halaman {
  const kelompok = p.kelompok ?? ["CG - Putusan", "CG - BAS", "Relaas dan PBT"];
  const kepala = p.headerAdmin ? "Super Administrator" : "Pengguna";
  const badan = `<div id="header"><div class="h_right"><b>${kepala}</b></div></div><div id="wrapper"><div id="navbar">${MENU(kelompok)}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.202.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: () => undefined, lastError: undefined },
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
  const minta: Minta[] = [];
  const orang = ORANG[p.orang];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push({ url, cara });
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const admin = p.orang === "admin";
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: [polos(PK)] } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry?hak=1")) return p.hak ? json({ ok: true, data: p.hak }) : json({ ok: false, alasan: "tidak ada" }, 502);
    if (url.includes("/aleta-ecourt/blangko-derry")) return json({ ok: true, data: { ada: false, sebab: "uji" } });
    if (url.includes("/aleta-ecourt/sidang")) return json({ ok: true, data: { sipp: { jadwalPerkara: [] } } });
    if (url === BERANDA) return html(`<div id="navbar">${MENU(kelompok)}</div>`);
    if (url.startsWith(`${BERANDA}?a=`)) {
      const k = decodeURIComponent(new URL(url).searchParams.get("a") || "");
      return html(HAL_KELOMPOK(k, BERKAS_KEL[k] || "x"));
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
const mainCari = (h: Halaman) => h.minta.filter((m) => m.url === `${ABT}/main/cari` && m.cara === "POST").length;

async function siapPerkara(h: Halaman) {
  await sampai(() => h.w.aletaBlangkoDerry && h.w.aletaBlangkoDerry.keadaan().peran.length, "peran terbaca");
  (Array.from(h.w.document.querySelectorAll("#navbar .accordion")).find((b: any) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, `[data-pk="${PK.nomorPerkara}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function lihatSebagai(h: Halaman, nilai: string) {
  const sel = q(h, "#bd-lihat") as HTMLSelectElement;
  sel.value = nilai;
  sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
  await sampai(() => h.minta.some((m) => m.url.includes("peranSebagai=")) || !nilai, "permintaan sebagai");
  await sampai(() => q(h, "[data-pk]"), "daftar termuat ulang");
  klik(h, `[data-pk="${PK.nomorPerkara}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
/** Buka jendela pilih blangko; pulang { tab, kelompok per tab }. */
async function jendela(h: Halaman) {
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
  await tunggu(30);
  const tab = qq(h, "[data-jenismodal]").map((b) => b.getAttribute("data-jenismodal"));
  const kel: Record<string, string[]> = {};
  for (const j of tab) {
    klik(h, `[data-jenismodal="${j}"]`);
    await tunggu(10);
    kel[String(j)] = qq(h, "[data-kelmodal]").map((b) => b.querySelector(".kn")!.textContent || "").filter((n) => n !== "Disarankan");
  }
  return { tab, kel };
}

// ============================================================================
describe("M. matriks peran x folder (murni)", () => {
  const murni = () => {
    const h = buka({ orang: "hakim" });
    return h.w.aletaBlangkoDerry.murni;
  };
  const KEL = [
    { nama: "CG - Putusan", jenis: "put" },
    { nama: "CG - BAS", jenis: "bas" },
    { nama: "Relaas dan PBT", jenis: "rel" },
  ];
  const baris = (m: any, o: Record<string, unknown>) => KEL.map((k) => (m.kelompokBoleh(k, o) ? "Y" : "-")).join("");

  it("SESUDAH: Super Admin/Admin tanpa 'Lihat sebagai' semua; akun yang ditiru dan akun biasa hanya foldernya", () => {
    const m = murni();
    const hak = hakDari(FOLDER_SERVER);
    // kolom: CG - Putusan | CG - BAS | Relaas
    expect(baris(m, { admin: true, sebagaiPeran: "", peran: [], hak })).toBe("YYY");
    expect(baris(m, { admin: true, sebagaiPeran: "hakim", peran: [], hak })).toBe("Y--");
    expect(baris(m, { admin: true, sebagaiPeran: "pp", peran: [], hak })).toBe("-Y-");
    expect(baris(m, { admin: true, sebagaiPeran: "js", peran: [], hak })).toBe("--Y");
    expect(baris(m, { admin: false, sebagaiPeran: "", peran: ["hakim"], hak })).toBe("Y--");
    expect(baris(m, { admin: false, sebagaiPeran: "", peran: ["pp"], hak })).toBe("-Y-");
    expect(baris(m, { admin: false, sebagaiPeran: "", peran: ["js"], hak })).toBe("--Y");
    // Hak tidak terbaca: saklar dianggap mati, tetap per peran.
    expect(baris(m, { admin: true, sebagaiPeran: "hakim", peran: [], hak: null })).toBe("Y--");
    expect(baris(m, { admin: false, sebagaiPeran: "", peran: ["pp"], hak: null })).toBe("-Y-");
  });

  it("SEBELUM (keluhan): admin + 'Lihat sebagai' hakim/PP mendapat ketiganya - kini tidak lagi", () => {
    // Aturan lama isian: jenisAda = adm() ? ["put","bas","rel"] : jenisBoleh(); bolehTulis = adm() || ...
    const lama = (admin: boolean, peran: string[]) => (admin ? ["put", "bas", "rel"] : peran.map((p) => ({ hakim: "put", pp: "bas", js: "rel" })[p]));
    expect(lama(true, ["hakim"])).toEqual(["put", "bas", "rel"]);
    const m = murni();
    expect(m.jenisDokumenBoleh({ admin: true, sebagaiPeran: "hakim", peran: [], hak: null })).toEqual(["put"]);
    expect(m.jenisDokumenBoleh({ admin: true, sebagaiPeran: "pp", peran: [], hak: null })).toEqual(["bas"]);
  });

  it("saklar Pengaturan SIPP & ABT: hakim -> BAS dan PP -> putusan ikut menyala (ABT tetap menyaring per folder)", () => {
    const m = murni();
    const nyala = FOLDER_SERVER.map((f) =>
      f.id === 102 ? { ...f, user_grup_id: `${GRUP_BAS}|10|20` } : f.id === 101 ? { ...f, user_grup_id: "1|10|20|500" } : f
    );
    const hak = hakDari(nyala);
    expect(hak.saklar).toEqual({ hakimBas: true, ppPutusan: true });
    expect(baris(m, { admin: false, sebagaiPeran: "", peran: ["hakim"], hak })).toBe("YY-");
    expect(baris(m, { admin: true, sebagaiPeran: "hakim", peran: [], hak })).toBe("YY-");
    expect(baris(m, { admin: true, sebagaiPeran: "pp", peran: [], hak })).toBe("YY-");
    // Saklar mati di server (keadaan 16 Okt): tidak ada tambahan.
    expect(hakDari(FOLDER_SERVER).saklar).toEqual({ hakimBas: false, ppPutusan: false });
  });

  it("folderTerbukaUntuk meniru menu_cek ABT: grup ATAU grup selalu-boleh; kolom kosong = SEMUA pengguna", () => {
    const m = murni();
    expect(m.folderTerbukaUntuk(FOLDER_SERVER[1], ["20", "10"])).toBe(false);
    expect(m.folderTerbukaUntuk(FOLDER_SERVER[1], ["500"])).toBe(true);
    expect(m.folderTerbukaUntuk(FOLDER_SERVER[1], ["30"])).toBe(true);
    // Relaas: hanya juru sita (600) dan Super Admin - PP, Panitera, Ketua/Wakil, Panmud, hakim tidak.
    for (const g of ["500", "30", "10", "20", "430", "1000", "1010", "650"]) expect(m.folderTerbukaUntuk(FOLDER_SERVER[2], [g])).toBe(false);
    expect(m.folderTerbukaUntuk(FOLDER_SERVER[2], ["600"])).toBe(true);
    expect(m.folderTerbukaUntuk(FOLDER_SERVER[2], ["1"])).toBe(true);
    expect(m.folderTerbukaUntuk({ ...FOLDER_SERVER[0], user_grup_id: null }, ["600"])).toBe(true);
  });
});

describe("J. jendela pilih blangko per peran (jsdom)", () => {
  it("Super Admin tanpa 'Lihat sebagai': tiga jenis dan semua kelompok", async () => {
    const h = buka({ orang: "admin", hak: hakDari(FOLDER_SERVER) });
    await siapPerkara(h);
    const j = await jendela(h);
    expect(j.tab).toEqual(["put", "bas", "rel"]);
    expect(j.kel).toEqual({ put: ["CG - Putusan"], bas: ["CG - BAS"], rel: ["Relaas dan PBT"] });
  });

  it("Super Admin 'Lihat sebagai' hakim: hanya Putusan; BAS tidak dapat dipilih (tanpa POST main/cari)", async () => {
    const h = buka({ orang: "admin", hak: hakDari(FOLDER_SERVER) });
    await siapPerkara(h);
    await lihatSebagai(h, "hakim|Hakim Satu");
    const j = await jendela(h);
    expect(j.tab).toEqual(["put"]);
    expect(j.kel).toEqual({ put: ["CG - Putusan"] });
    klik(h, '[data-bd2="tutupmodal"]');
    const sebelum = mainCari(h);
    await h.w.aletaBlangkoDerryIsian.muatKelompok("CG - BAS");
    await h.w.aletaBlangkoDerryIsian.pilihBlangko(BAS, "CG - BAS");
    expect(q(h, "#bd-toast")!.textContent).toContain("bukan untuk peran");
    expect(mainCari(h)).toBe(sebelum);
    expect(h.w.aletaBlangkoDerryIsian.keadaan().blangko).toBeNull();
  });

  it("Super Admin 'Lihat sebagai' PP: hanya BAS; putusan tidak dapat dipilih", async () => {
    const h = buka({ orang: "admin", hak: hakDari(FOLDER_SERVER) });
    await siapPerkara(h);
    await lihatSebagai(h, "pp|PP Satu");
    const j = await jendela(h);
    expect(j.tab).toEqual(["bas"]);
    klik(h, '[data-bd2="tutupmodal"]');
    await h.w.aletaBlangkoDerryIsian.muatKelompok("CG - Putusan");
    await h.w.aletaBlangkoDerryIsian.pilihBlangko(PUT, "CG - Putusan");
    expect(q(h, "#bd-toast")!.textContent).toContain("bukan untuk peran");
    expect(mainCari(h)).toBe(0);
  });

  it("hakim biasa: hanya Putusan walau menu ABT tiruan memuat BAS; PP biasa: hanya BAS dan BAS terbuka (POST main/cari)", async () => {
    const h = buka({ orang: "hakim", hak: hakDari(FOLDER_SERVER) });
    await siapPerkara(h);
    expect((await jendela(h)).tab).toEqual(["put"]);
    const p = buka({ orang: "pp", hak: hakDari(FOLDER_SERVER), kelompok: ["CG - BAS"] });
    await siapPerkara(p);
    expect(await jendela(p)).toEqual({ tab: ["bas"], kel: { bas: ["CG - BAS"] } });
    klik(p, '[data-bd2="tutupmodal"]');
    await p.w.aletaBlangkoDerryIsian.muatKelompok("CG - BAS");
    await p.w.aletaBlangkoDerryIsian.pilihBlangko(BAS, "CG - BAS");
    expect(mainCari(p)).toBe(1);
    expect(p.w.aletaBlangkoDerryIsian.keadaan().blangko.jenis).toBe("bas");
  });

  it("saklar 'Hakim boleh membuka folder BAS' menyala: hakim mendapat Putusan + BAS (sinkron dengan Pengaturan SIPP & ABT)", async () => {
    const nyala = FOLDER_SERVER.map((f) => (f.id === 102 ? { ...f, user_grup_id: `${GRUP_BAS}|10|20` } : f));
    const h = buka({ orang: "hakim", hak: hakDari(nyala), kelompok: ["CG - Putusan", "CG - BAS"] });
    await siapPerkara(h);
    const j = await jendela(h);
    expect(j.tab).toEqual(["put", "bas"]);
    expect(j.kel.bas).toEqual(["CG - BAS"]);
  });

  it("Admin ABT (kepala 'Super Administrator') dengan akun ALETA hakim tetap admin: tiga jenis", async () => {
    const h = buka({ orang: "hakim", headerAdmin: true, hak: hakDari(FOLDER_SERVER) });
    await siapPerkara(h);
    expect((await jendela(h)).tab).toEqual(["put", "bas", "rel"]);
  });
});

describe("P. portal", () => {
  it("ringkasHakBlangko: hanya nama, alias, grup, grup selalu-boleh + saklar benar/salah", () => {
    const r = hakDari(FOLDER_SERVER);
    expect(r.ada).toBe(true);
    expect(r.folder[0]).toEqual({ id: 101, nama: "Putusan Cerai Gugat", namaAlias: "CG - Putusan", user_grup_id: "1|10|20", user_top_id: "1" });
    expect(Object.keys(r.folder[1]).sort()).toEqual(["id", "nama", "namaAlias", "user_grup_id", "user_top_id"]);
  });

  it("periksaPeranMenuKosong: mengosongkan grup/top ditolak (ABT = semua pengguna); kolom lain bebas", () => {
    expect(periksaPeranMenuKosong([{ id: 102, baru: { user_grup_id: "" } }])).toContain("SEMUA pengguna");
    expect(periksaPeranMenuKosong([{ id: 102, baru: { user_top_id: null } }])).toContain("Folder 102");
    expect(periksaPeranMenuKosong([{ id: 102, baru: { user_grup_id: "1|30" } }])).toBe("");
    expect(periksaPeranMenuKosong([{ id: 102, baru: { user_validator: null, user_cek: 3 } }])).toBe("");
  });

  it("bolehBasMassal: PP, Panitera, Panmud, Analis, Admin ya; Hakim, Ketua/Wakil, Juru sita tidak", () => {
    const boleh = (roleId: string, positionId = "") => bolehBasMassal({ roleId, positionId });
    expect(["panitera-pengganti", "panitera", "panitera-muda", "admin", "super-admin", "analis-perkara"].map((r) => boleh(r))).toEqual([true, true, true, true, true, true]);
    expect(["hakim", "ketua", "wakil-ketua", "jurusita"].map((r) => boleh(r))).toEqual([false, false, false, false]);
  });
});
