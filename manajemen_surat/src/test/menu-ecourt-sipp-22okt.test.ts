// @vitest-environment node
/**
 * ============================================================================
 * MENU "E-COURT" DI BILAH ATAS SIPP (22 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: menu baru di samping ALETA, "E-Court", yang membuka
 * https://ecourt.mahkamahagung.go.id/Login - tetapi lebih dulu lewat ALETA supaya
 * akun e-Court-nya terdaftar (sesuai penggunanya; menentukan perannya), dan
 * sesinya dijaga tetap hidup.
 *
 * Dibuktikan dengan kode SUNGGUHAN (menu-atas.js, latar.js, ecourt-masuk.js di
 * jsdom/vm; penjaga identitas server dan tujuan kembali sebagai fungsi murni):
 *
 *   1. urutan empat butir: Perdata | ABT By Derry | ALETA | E-Court | Jinayat;
 *   2. belum masuk ALETA -> pesan + tautan masuk (kembali ke formulir akun), tanpa tab;
 *   3. belum ada akun e-Court -> tab formulir ALETA, e-Court TIDAK dibuka;
 *   4. sudah ada -> tab baru ke e-Court Login, hanya SUREL yang dititipkan (tanpa sandi);
 *   5. akun SIPP milik pengguna lain ditolak;
 *   6. halaman e-Court: hanya kolom nama pengguna diisi; sandi/captcha/tombol tidak
 *      disentuh; tab yang bukan dari menu tidak disentuh; tidak ada kata ALETA di halaman;
 *   7. penjaga sesi: GET ringan berkala, berhenti saat sesi habis / gagal berturut-turut;
 *   8. pekerja latar menyusun alamat e-Court sendiri dan hanya melayani tab yang dicatatnya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { tujuanKembaliAman } from "@/lib/tujuan-kembali";
import { usernameSippDariPermintaan } from "@/server/modules/aleta-ecourt/ecourt-menu-sipp";

import { Dunia, jawaban, minta, nyalakan } from "./dunia-latar";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const MENU = baca("menu-atas.js");
const MASUK = baca("ecourt-masuk.js");
const MANIFEST = JSON.parse(baca("manifest.json"));
const tanpaKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ASAL = "http://192.168.10.10";
const SIPP = `${ASAL}/SIPP/index.php/home`;
const ECOURT = "https://ecourt.mahkamahagung.go.id";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, apa: string, batas = 3000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${apa}`);
    await tunggu(10);
  }
}

const MENU_SIPP = ["Home", "Jurnal Perkara", "Register Induk Keuangan", "Perdata", "Jinayat", "Jinayat Anak", "Delegasi", "Laporan", "Jadwal Sidang", "Arsip Perkara", "Antrian", "e-Court", "e-Payment", "Referensi", "Smart Majelis", "System"];
const halamanSipp = () =>
  `<!doctype html><html><head><title>SIPP</title></head><body><div id="cssmenu"><ul class='nav navbar-nav'>${MENU_SIPP.map(
    (m) => `<li class="has-sub"><a href="${ASAL}/SIPP/${m.replace(/\s/g, "_")}">${m}</a><ul></ul></li>`
  ).join("")}</ul></div></body></html>`;

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

const SIAPA_HAKIM = { id: "u1", nama: "Derry Briantono", peran: "Hakim", roleId: "hakim", peranTambahan: [], golonganMenu: ["hakim"] };
type Balasan = { status: number; data?: unknown };
type OpsiSipp = { siapa?: Balasan; sesiEcourt?: Balasan; masukDariSesiSipp?: () => Promise<unknown> };

function bukaSipp(o: OpsiSipp = {}) {
  const dom = new JSDOM(halamanSipp(), { url: SIPP, runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const h = { w, d: w.document as Document, pesan: [] as any[], fetchLog: [] as Array<{ url: string; opsi?: any }>, open: [] as unknown[][] };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      lastError: undefined,
      sendMessage: (p: any, balik?: (j: unknown) => void) => {
        h.pesan.push(p);
        if (balik) setTimeout(() => balik({ ok: true }), 0);
      },
    },
    storage: { local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined }, onChanged: { addListener() {} } },
  };
  w.fetch = async (url: string, opsi?: any) => {
    h.fetchLog.push({ url: String(url), opsi });
    const s: Balasan = String(url).includes("/ekstensi/siapa")
      ? o.siapa || { status: 200, data: SIAPA_HAKIM }
      : String(url).includes("/ecourt-sesi")
        ? o.sesiEcourt || { status: 200, data: { tersedia: true, akunDidukung: true, akun: [], sesi: [], peranTersedia: [] } }
        : { status: 404, data: {} };
    return { ok: s.status >= 200 && s.status < 300, status: s.status, json: async () => ({ ok: s.status < 300, data: s.data }) };
  };
  w.open = (...a: unknown[]) => (h.open.push(a), null);
  if (o.masukDariSesiSipp) w.masukAletaDariSesiSipp = o.masukDariSesiSipp;
  w.eval(MENU);
  return h;
}
const butir = (d: Document) => Array.from(d.querySelectorAll("#cssmenu > ul > li")).map((li) => (li.querySelector(":scope > a")!.childNodes[0].textContent || "").trim());
const teksKabar = (d: Document) => (d.querySelector(".aleta-menu-kabar")?.textContent || "").trim();
const klikEcourt = async (h: ReturnType<typeof bukaSipp>) => {
  const a = await sampai(() => h.d.querySelector('li[data-aleta-menu="ecourt"] a') as HTMLElement | null, "butir e-Court");
  a.click();
};
const AKUN = (email: string, peran = "hakim", diperbarui = "2026-10-20T01:00:00Z") => ({ peran, email, adaSandi: true, diperbaruiPada: diperbarui, diujiPada: "", hasilUji: "" });
const SESI_ADA = (akun: unknown[], sesi: unknown[] = []) => ({ status: 200, data: { tersedia: true, akunDidukung: true, akun, sesi, peranTersedia: [{ kode: "hakim", sebutan: "Hakim" }] } });

// ============================================================================
describe("urutan menu: Perdata | ABT By Derry | ALETA | E-Court | Jinayat", () => {
  it("empat butir berurutan tepat sesudah Perdata, bergaya butir SIPP; e-Court milik SIPP sendiri tetap ada", async () => {
    const h = bukaSipp();
    await sampai(() => butir(h.d).includes("E-Court MA"), "terpasang");
    const urut = butir(h.d);
    const i = urut.indexOf("Perdata");
    expect(urut.slice(i, i + 5)).toEqual(["Perdata", "ABT By Derry", "ALETA", "E-Court MA", "Jinayat"]);
    expect(urut.filter((x) => !["ABT By Derry", "ALETA", "E-Court MA"].includes(x))).toEqual(MENU_SIPP);
    const li = h.d.querySelector('li[data-aleta-menu="ecourt"]') as HTMLElement;
    expect(Array.from(li.children).map((c) => c.tagName)).toEqual(["A", "UL"]);
    expect(li.classList.contains("has-sub")).toBe(true);
    expect(li.querySelector("a")!.className).toBe("");
    expect(li.querySelector("a")!.getAttribute("style")).toBeNull();
  });

  it("tidak ganda walau SIPP menggambar ulang bilahnya", async () => {
    const h = bukaSipp();
    await sampai(() => butir(h.d).includes("E-Court MA"), "terpasang");
    h.d.getElementById("cssmenu")!.outerHTML = halamanSipp().match(/<div id="cssmenu">[\s\S]*<\/div>/)![0];
    await sampai(() => h.d.querySelectorAll("[data-aleta-menu]").length === 3, "dipasang ulang");
    await tunggu(300);
    expect(h.d.querySelectorAll("[data-aleta-menu]").length).toBe(3);
    expect(Array.from(h.d.querySelectorAll("[data-aleta-menu]")).map((x) => x.getAttribute("data-aleta-menu"))).toEqual(["abt", "aleta", "ecourt"]);
  });

  it("akun tanpa hak Blangko Derry: ABT By Derry hilang, ALETA dan E-Court tetap", async () => {
    const h = bukaSipp({ siapa: { status: 200, data: { roleId: "kasir", peran: "Kasir", golonganMenu: ["kasir"], bolehKasir: true } } });
    await sampai(() => h.d.querySelector('li[data-aleta-menu="aleta"]'), "terpasang");
    await sampai(() => !h.d.querySelector('li[data-aleta-menu="abt"]'), "abt hilang");
    expect(Array.from(h.d.querySelectorAll("[data-aleta-menu]")).map((x) => x.getAttribute("data-aleta-menu"))).toEqual(["aleta", "ecourt"]);
  });
});

// ============================================================================
describe("klik E-Court: wajib ALETA, akun e-Court milik sendiri", () => {
  const tab = (h: ReturnType<typeof bukaSipp>, jenis: string) => h.pesan.filter((p) => p.jenis === jenis);

  it("belum masuk ALETA: pesan + tautan masuk yang kembali ke formulir akun; tidak ada tab", async () => {
    const h = bukaSipp({ siapa: { status: 401 } });
    await klikEcourt(h);
    await sampai(() => teksKabar(h.d), "pesan");
    expect(teksKabar(h.d)).toContain("Masuk ke ALETA dulu");
    const tautan = (h.d.querySelector(".aleta-menu-kabar a") as HTMLAnchorElement).getAttribute("href")!;
    expect(tautan).toBe(`${ASAL}/aleta/login?kembali=${encodeURIComponent("/admin/aleta-ecourt?dari=menu#sesi-ecourt-saya")}`);
    expect(tujuanKembaliAman(decodeURIComponent(tautan.split("kembali=")[1]))).toBe("/admin/aleta-ecourt?dari=menu#sesi-ecourt-saya");
    expect(h.pesan.filter((p) => /^menu-/.test(p.jenis))).toEqual([]);
    expect(h.open).toEqual([]);
  });

  it("belum masuk ALETA tetapi sesi SIPP bisa dipakai masuk: dilanjutkan tanpa sandi", async () => {
    let masuk = false;
    const h = bukaSipp({ siapa: { status: 401 }, masukDariSesiSipp: async () => ((masuk = true), { jenis: "masuk" }) });
    const asli = h.w.fetch;
    h.w.fetch = async (u: string, o: unknown) =>
      masuk && String(u).includes("/ekstensi/siapa")
        ? { ok: true, status: 200, json: async () => ({ data: SIAPA_HAKIM }) }
        : masuk && String(u).includes("/ecourt-sesi")
          ? { ok: true, status: 200, json: async () => ({ data: SESI_ADA([AKUN("hakim@ecourt.test")]).data }) }
          : asli(u, o);
    await klikEcourt(h);
    await sampai(() => tab(h, "menu-ecourt-buka").length === 1, "e-Court dibuka");
    expect(tab(h, "menu-ecourt-buka")[0].surel).toBe("hakim@ecourt.test");
  });

  it("belum menyimpan akun e-Court: tab formulir ALETA, e-Court TIDAK dibuka, pesan menyebut peran", async () => {
    const h = bukaSipp({ sesiEcourt: SESI_ADA([]) });
    await klikEcourt(h);
    await sampai(() => tab(h, "menu-buka-tab").length === 1, "formulir dibuka");
    expect(tab(h, "menu-buka-tab")[0]).toEqual({ sumber: "aleta-panel", jenis: "menu-buka-tab", tujuan: "formulir-ecourt" });
    expect(tab(h, "menu-ecourt-buka")).toEqual([]);
    expect(teksKabar(h.d)).toContain("menentukan peran Anda");
    expect(teksKabar(h.d)).toContain("klik E-Court lagi");
  });

  it("akun tersimpan tetapi tanpa sandi (adaSandi false) dianggap belum ada", async () => {
    const h = bukaSipp({ sesiEcourt: SESI_ADA([{ ...AKUN("x@ecourt.test"), adaSandi: false }]) });
    await klikEcourt(h);
    await sampai(() => tab(h, "menu-buka-tab").length === 1, "formulir dibuka");
    expect(tab(h, "menu-ecourt-buka")).toEqual([]);
  });

  it("sudah ada akun: tab baru ke e-Court; hanya surel yang dititipkan, tanpa sandi di pesan maupun permintaan", async () => {
    const h = bukaSipp({ sesiEcourt: SESI_ADA([AKUN("hakim@ecourt.test")]) });
    await klikEcourt(h);
    await sampai(() => tab(h, "menu-ecourt-buka").length === 1, "e-Court dibuka");
    expect(tab(h, "menu-ecourt-buka")[0]).toEqual({ sumber: "aleta-panel", jenis: "menu-ecourt-buka", surel: "hakim@ecourt.test" });
    expect(tab(h, "menu-buka-tab")).toEqual([]);
    expect(JSON.stringify(h.pesan).toLowerCase()).not.toMatch(/sandi|password/);
    // semua permintaan jaringan ekstensi = GET (opsi tanpa method POST, tanpa badan)
    for (const f of h.fetchLog) {
      expect(String(f.opsi?.method || "GET").toUpperCase()).toBe("GET");
      expect(f.opsi?.body).toBeUndefined();
    }
    // penjaga identitas SIPP diminta server lewat ?dariSipp=1
    expect(h.fetchLog.some((f) => f.url.includes("/aleta/api/aleta-ecourt/ecourt-sesi?dariSipp=1"))).toBe(true);
  });

  it("beberapa akun: yang sesinya tersambung didahulukan, selain itu yang terakhir diperbarui", async () => {
    const akun = [AKUN("lama@ecourt.test", "panitera", "2026-01-01T00:00:00Z"), AKUN("baru@ecourt.test", "hakim", "2026-10-01T00:00:00Z"), AKUN("sambung@ecourt.test", "juru-sita", "2025-01-01T00:00:00Z")];
    const a = bukaSipp({ sesiEcourt: SESI_ADA(akun, [{ peran: "juru-sita", keadaan: "tersambung" }]) });
    await klikEcourt(a);
    await sampai(() => a.pesan.some((p) => p.jenis === "menu-ecourt-buka"), "dibuka");
    expect(a.pesan.find((p) => p.jenis === "menu-ecourt-buka").surel).toBe("sambung@ecourt.test");
    const b = bukaSipp({ sesiEcourt: SESI_ADA(akun) });
    await klikEcourt(b);
    await sampai(() => b.pesan.some((p) => p.jenis === "menu-ecourt-buka"), "dibuka");
    expect(b.pesan.find((p) => p.jenis === "menu-ecourt-buka").surel).toBe("baru@ecourt.test");
  });

  it("akun SIPP yang terbuka milik pengguna ALETA lain: ditolak dengan pesan server, tidak ada tab", async () => {
    const pesan = "Akun SIPP yang sedang terbuka tersimpan atas nama pengguna ALETA lain.";
    const h = bukaSipp({ sesiEcourt: { status: 200, data: { tersedia: false, alasan: "akun_sipp_milik_pengguna_lain", pesan, akun: [], sesi: [] } } });
    await klikEcourt(h);
    await sampai(() => teksKabar(h.d), "pesan");
    expect(teksKabar(h.d)).toBe(pesan);
    expect(h.pesan.filter((p) => /^menu-/.test(p.jenis))).toEqual([]);
  });

  it("bot e-Court tak terjangkau (tersedia false): diarahkan memeriksa di formulir ALETA, bukan langsung ke e-Court", async () => {
    const h = bukaSipp({ sesiEcourt: { status: 200, data: { tersedia: false, pesan: "bot mati", akun: [], sesi: [] } } });
    await klikEcourt(h);
    await sampai(() => h.pesan.some((p) => p.jenis === "menu-buka-tab"), "formulir");
    expect(h.pesan.some((p) => p.jenis === "menu-ecourt-buka")).toBe(false);
    expect(teksKabar(h.d)).toContain("belum dapat memeriksa akun e-Court");
  });

  it("server belum mendukung simpan akun: e-Court dibuka tanpa surel dan pengguna diberi tahu", async () => {
    const h = bukaSipp({ sesiEcourt: { status: 200, data: { tersedia: true, akunDidukung: false, akun: [], sesi: [] } } });
    await klikEcourt(h);
    await sampai(() => h.pesan.some((p) => p.jenis === "menu-ecourt-buka"), "dibuka");
    expect(h.pesan.find((p) => p.jenis === "menu-ecourt-buka").surel).toBe("");
    expect(teksKabar(h.d)).toContain("belum didukung");
  });

  it("menu-atas.js tidak pernah memegang sandi e-Court", () => {
    const k = tanpaKomentar(MENU);
    expect(k).not.toMatch(/\.sandi\b|(?:sandi|password)\w*\.value|body:|FormData/i);
    expect(k).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)/);
  });
});

// ============================================================================
describe("halaman e-Court: hanya nama pengguna diisi; sandi, captcha, tombol tidak disentuh", () => {
  const LOGIN = `<!doctype html><html><head><title>Login</title></head><body><form action="/Login/masuk" method="post"><label>Surel</label><input type="text" name="username" id="username" value=""><label>Sandi</label><input type="password" name="password" id="password" value=""><img id="gambar-captcha" alt="captcha"><input type="text" name="captcha" id="captcha" value=""><button type="submit" id="masuk">Masuk</button></form></body></html>`;
  const BERANDA = `<!doctype html><html><head><title>Beranda</title></head><body><div>Selamat datang</div></body></html>`;
  const UBAH_SANDI = `<!doctype html><html><body><form><input type="text" name="nama" value=""><input type="password" name="lama"><input type="password" name="baru"></form></body></html>`;

  function bukaEcourt(html: string, jalur: string, jawab: unknown, fetchMasuk?: (u: string, o: any) => any) {
    const dom = new JSDOM(html, { url: `${ECOURT}${jalur}`, runScripts: "outside-only" });
    terbuka.push(dom);
    const w = dom.window as any;
    const pesan: any[] = [];
    const masuk: Array<{ u: string; o: any }> = [];
    let ditekan = 0;
    w.chrome = {
      runtime: {
        id: "aleta-uji",
        lastError: undefined,
        sendMessage: (p: any, balik?: (j: unknown) => void) => {
          pesan.push(p);
          if (balik) setTimeout(() => balik(jawab as never), 0);
        },
      },
    };
    w.fetch = async (u: string, o: any) => {
      masuk.push({ u: String(u), o });
      return fetchMasuk ? fetchMasuk(String(u), o) : { type: "opaqueredirect", status: 0 };
    };
    w.document.addEventListener("submit", () => (ditekan += 1), true);
    w.document.addEventListener("click", (e: any) => e.target?.type === "submit" && (ditekan += 1), true);
    w.eval(MASUK);
    return { w, d: w.document as Document, pesan, masuk, tombol: () => ditekan };
  }
  const nilai = (d: Document, sel: string) => (d.querySelector(sel) as HTMLInputElement).value;

  it("tab dari menu, halaman Login: kolom nama pengguna terisi surel; sandi, captcha, dan tombol tak tersentuh", async () => {
    const h = bukaEcourt(LOGIN, "/Login", { ok: true, surel: "hakim@ecourt.test", jaga: true });
    await sampai(() => nilai(h.d, "#username") === "hakim@ecourt.test", "nama terisi");
    expect(nilai(h.d, "#password")).toBe("");
    expect(nilai(h.d, "#captcha")).toBe("");
    expect(h.tombol()).toBe(0);
    expect(h.d.activeElement === h.d.querySelector("#password")).toBe(false);
    // penjaga sesi TIDAK berjalan di halaman Login (belum masuk)
    await tunggu(100);
    expect(h.masuk).toEqual([]);
  });

  it("tidak ada kata ALETA yang masuk ke halaman e-Court (DOM sama kecuali nilai kolom nama)", async () => {
    const h = bukaEcourt(LOGIN, "/Login", { ok: true, surel: "hakim@ecourt.test", jaga: true });
    await sampai(() => nilai(h.d, "#username") === "hakim@ecourt.test", "nama terisi");
    const sebelum = new JSDOM(LOGIN).window.document.documentElement.outerHTML;
    expect(h.d.documentElement.outerHTML.toLowerCase()).not.toContain("aleta");
    expect(h.d.documentElement.outerHTML.replace(/ value="hakim@ecourt\.test"/, "")).toBe(sebelum.replace(/<\/body>/, "</body>"));
    // tak satu permintaan pun ke e-Court dari halaman Login, dan tak ada tulisan
    expect(h.masuk).toEqual([]);
  });

  it("kolom nama yang sudah berisi tidak ditimpa", async () => {
    const html = LOGIN.replace('id="username" value=""', 'id="username" value="isian.pengguna"');
    const h = bukaEcourt(html, "/Login", { ok: true, surel: "hakim@ecourt.test", jaga: true });
    await tunggu(200);
    expect(nilai(h.d, "#username")).toBe("isian.pengguna");
  });

  it("tab yang BUKAN dari menu (pekerja latar tidak mencatatnya): tidak disentuh sama sekali", async () => {
    const h = bukaEcourt(LOGIN, "/Login", { ok: false, sebab: "bukan tab menu" });
    await tunggu(2200);
    expect(nilai(h.d, "#username")).toBe("");
    expect(h.masuk).toEqual([]);
  }, 10000);

  it("halaman lain dengan formulir sandi (ubah sandi) tidak pernah diisi", async () => {
    const h = bukaEcourt(UBAH_SANDI, "/Profil/UbahSandi", { ok: true, surel: "hakim@ecourt.test", jaga: false });
    await tunggu(200);
    expect(nilai(h.d, 'input[name="nama"]')).toBe("");
  });

  it("surel tak wajar (aksara kendali, terlalu panjang) tidak diisikan", () => {
    const h = bukaEcourt(LOGIN, "/Login", { ok: false });
    expect(h.w.aletaEcourtMasuk.isiNama(h.d, "a\u0000b@x")).toBe(false);
    expect(h.w.aletaEcourtMasuk.isiNama(h.d, "a".repeat(200))).toBe(false);
    expect(h.w.aletaEcourtMasuk.isiNama(h.d, "")).toBe(false);
    expect(nilai(h.d, "#username")).toBe("");
  });

  it("penjaga sesi: sesudah masuk (halaman bukan Login) GET ringan ke /Login berkala; sesi sah -> terus", async () => {
    const h = bukaEcourt(BERANDA, "/Home", { ok: true, surel: "hakim@ecourt.test", jaga: true });
    const hasil = await h.w.aletaEcourtMasuk.denyut({ loc: { origin: ECOURT }, fetch: async (u: string, o: any) => (h.masuk.push({ u, o }), { type: "opaqueredirect", status: 0 }) });
    expect(hasil).toBe("hidup");
    expect(h.masuk[0].u).toBe(`${ECOURT}/Login`);
    expect(h.masuk[0].o).toMatchObject({ method: "GET", credentials: "include", redirect: "manual" });
    expect(h.masuk[0].o.body).toBeUndefined();
  });

  it("penjaga sesi: halaman Login yang tampil (200) = sesi habis; galat = gagal", async () => {
    const h = bukaEcourt(BERANDA, "/Home", { ok: false });
    const api = h.w.aletaEcourtMasuk;
    expect(await api.denyut({ loc: { origin: ECOURT }, fetch: async () => ({ type: "basic", status: 200 }) })).toBe("habis");
    expect(await api.denyut({ loc: { origin: ECOURT }, fetch: async () => ({ type: "basic", status: 500 }) })).toBe("gagal");
    expect(await api.denyut({ loc: { origin: ECOURT }, fetch: async () => Promise.reject(new Error("putus")) })).toBe("gagal");
  });

  it("penjaga berjalan berkala di tab menu sesudah masuk, berhenti sendiri saat sesi habis", async () => {
    let n = 0;
    const h = bukaEcourt(BERANDA, "/Home", { ok: true, surel: "hakim@ecourt.test", jaga: true });
    await tunggu(30);
    const api = h.w.aletaEcourtMasuk;
    // mulai() sudah dijalankan saat dimuat dengan jeda bawaan 4 menit; jalankan penjaga uji dengan jeda pendek
    const g = bukaEcourt(BERANDA, "/Home", { ok: false });
    expect(
      g.w.aletaEcourtMasuk.mulaiJaga({ jedaMs: 15, loc: { origin: ECOURT }, fetch: async () => ((n += 1), n < 3 ? { type: "opaqueredirect", status: 0 } : { type: "basic", status: 200 }) })
    ).toBe(true);
    await sampai(() => n >= 3, "tiga denyut");
    await tunggu(100);
    expect(n).toBe(3); // sesi habis pada denyut ketiga -> berhenti
    void api;
  });

  it("penjaga berhenti sesudah gagal berturut-turut", async () => {
    let n = 0;
    const g = bukaEcourt(BERANDA, "/Home", { ok: false });
    g.w.aletaEcourtMasuk.mulaiJaga({ jedaMs: 10, loc: { origin: ECOURT }, fetch: async () => ((n += 1), Promise.reject(new Error("putus"))) });
    await sampai(() => n >= 3, "tiga gagal");
    await tunggu(80);
    expect(n).toBe(3);
  });

  it("skrip e-Court tidak menulis apa pun selain nilai kolom nama: tanpa sandi, tanpa captcha, tanpa klik, tanpa kata aleta di kode jalan", () => {
    const k = tanpaKomentar(MASUK);
    expect(k).not.toMatch(/\.click\(\)|requestSubmit|\.submit\(|\.focus\(\)/);
    expect(k).not.toMatch(/innerHTML|insertAdjacent|appendChild|createElement|setAttribute|classList\.add/);
    expect(k).not.toMatch(/\.sandi\b|password.*\.value|\.value\s*=\s*[^;]*(sandi|password)/i);
    expect(k).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)/);
    expect(k).not.toMatch(/FormData|\bbody:/);
    // satu-satunya penulisan nilai: kolom NAMA, lewat isiNama
    expect(k.match(/\.value\s*=/g)?.length ?? 0).toBeLessThanOrEqual(1);
    // kata ALETA hanya muncul pada kunci pesan internal ekstensi ("aleta-panel"), bukan pada isi halaman
    const sisa = k.replace(/sumber:\s*"aleta-panel"/g, "").replace(/globalThis\.aletaEcourtMasuk|aletaEcourtMasuk/g, "");
    expect(sisa.toLowerCase()).not.toContain("aleta");
  });
});

// ============================================================================
describe("pekerja latar: tab e-Court dicatat; surel hanya untuk tab itu", () => {
  const SIPP_PENGIRIM = { url: `${ASAL}/SIPP/index.php/home`, origin: ASAL, frameId: 0 };
  const ECOURT_PENGIRIM = (id: number) => ({ url: `${ECOURT}/Login`, origin: ECOURT, frameId: 0, tab: { id } });
  const siapkan = () => {
    const dunia = new Dunia(() => jawaban(404, "", ""));
    const pekerja = nyalakan(dunia);
    const dibuat: any[] = [];
    let id = 40;
    pekerja.konteks.chrome.tabs = { create: async (o: any) => (dibuat.push(o), { id: (id += 1) }) };
    return { dunia, pekerja, dibuat };
  };

  it("alamat e-Court disusun di latar (bukan dari pesan); surel dicatat di storage.session, TIDAK di local", async () => {
    const { dunia, pekerja, dibuat } = siapkan();
    const j = await minta(dunia, pekerja, { jenis: "menu-ecourt-buka", surel: "hakim@ecourt.test", url: "http://jahat.example/" }, SIPP_PENGIRIM);
    expect(j).toMatchObject({ ok: true });
    expect(dibuat.map((o) => o.url)).toEqual([`${ECOURT}/Login`]);
    expect(JSON.stringify(dunia.lokal)).not.toContain("hakim@ecourt.test");
    expect(JSON.stringify(dunia.sesi)).toContain("hakim@ecourt.test");
    expect(JSON.stringify(dunia.sesi).toLowerCase()).not.toMatch(/sandi|password/);
  });

  it("tab e-Court yang dicatat mendapat surel + tanda jaga; tab lain, juga di e-Court, tidak", async () => {
    const { dunia, pekerja } = siapkan();
    await minta(dunia, pekerja, { jenis: "menu-ecourt-buka", surel: "hakim@ecourt.test" }, SIPP_PENGIRIM);
    expect(await minta(dunia, pekerja, { jenis: "menu-ecourt-nama" }, ECOURT_PENGIRIM(41))).toEqual({ ok: true, surel: "hakim@ecourt.test", jaga: true });
    expect((await minta(dunia, pekerja, { jenis: "menu-ecourt-nama" }, ECOURT_PENGIRIM(99))).ok).toBe(false);
  });

  it("pengirim harus halaman e-Court (https, host tepat) di bingkai teratas; SIPP tidak boleh meminta surel", async () => {
    const { dunia, pekerja } = siapkan();
    await minta(dunia, pekerja, { jenis: "menu-ecourt-buka", surel: "hakim@ecourt.test" }, SIPP_PENGIRIM);
    for (const pengirim of [
      SIPP_PENGIRIM,
      { url: "http://ecourt.mahkamahagung.go.id/Login", frameId: 0, tab: { id: 41 } },
      { url: "https://ecourt.mahkamahagung.go.id.jahat.example/Login", frameId: 0, tab: { id: 41 } },
      { ...ECOURT_PENGIRIM(41), frameId: 2 },
    ]) {
      expect((await minta(dunia, pekerja, { jenis: "menu-ecourt-nama" }, pengirim)).ok).toBe(false);
    }
  });

  it("pembuka harus halaman SIPP di server satker; surel tak wajar dibuang tetapi tab tetap dibuka tanpa surel", async () => {
    const { dunia, pekerja, dibuat } = siapkan();
    expect((await minta(dunia, pekerja, { jenis: "menu-ecourt-buka", surel: "a@b.c" }, { url: "https://situs.example/SIPP/x", frameId: 0 })).ok).toBe(false);
    expect((await minta(dunia, pekerja, { jenis: "menu-ecourt-buka", surel: "a@b.c" }, { ...SIPP_PENGIRIM, frameId: 3 })).ok).toBe(false);
    expect(dibuat).toEqual([]);
    await minta(dunia, pekerja, { jenis: "menu-ecourt-buka", surel: "a\u0000b@x.test" }, SIPP_PENGIRIM);
    expect(dibuat.length).toBe(1);
    expect(await minta(dunia, pekerja, { jenis: "menu-ecourt-nama" }, ECOURT_PENGIRIM(41))).toEqual({ ok: true, surel: "", jaga: true });
  });

  it("catatan tab basi (lebih dari 12 jam) tidak melayani siapa pun dan dibersihkan", async () => {
    const { dunia, pekerja } = siapkan();
    await minta(dunia, pekerja, { jenis: "menu-ecourt-buka", surel: "hakim@ecourt.test" }, SIPP_PENGIRIM);
    dunia.jam += 13 * 60 * 60 * 1000;
    expect((await minta(dunia, pekerja, { jenis: "menu-ecourt-nama" }, ECOURT_PENGIRIM(41))).ok).toBe(false);
    expect(Object.keys(dunia.sesi).some((k) => k.startsWith("menuEcourt:"))).toBe(false);
  });

  it("formulir-ecourt: tab ke formulir akun di portal dengan penanda dari menu", async () => {
    const { dunia, pekerja, dibuat } = siapkan();
    expect(await minta(dunia, pekerja, { jenis: "menu-buka-tab", tujuan: "formulir-ecourt" }, SIPP_PENGIRIM)).toMatchObject({ ok: true });
    expect(dibuat.map((o) => o.url)).toEqual([`${ASAL}/aleta/admin/aleta-ecourt?dari=menu#sesi-ecourt-saya`]);
  });
});

// ============================================================================
describe("portal: tujuan kembali dan penjaga identitas SIPP", () => {
  it("tujuanKembaliAman hanya mengikuti jalur di dalam portal", () => {
    expect(tujuanKembaliAman("/admin/aleta-ecourt?dari=menu#sesi-ecourt-saya")).toBe("/admin/aleta-ecourt?dari=menu#sesi-ecourt-saya");
    expect(tujuanKembaliAman("/portal")).toBe("/portal");
    for (const jahat of ["https://jahat.example/", "//jahat.example/x", "/\\jahat.example", "javascript:alert(1)", "http://x", "/login", "/login?kembali=/x", "/api/auth/sign-out", "x", "", null, undefined, 5, "/a\u0000b", "/a\\b", "/" + "a".repeat(400)]) {
      expect(tujuanKembaliAman(jahat as never), String(jahat)).toBe("/portal");
    }
    expect(tujuanKembaliAman("//x", "/beranda")).toBe("/beranda");
  });

  it("halaman masuk memakai tujuanKembaliAman pada kedua jalur sukses", () => {
    const src = readFileSync(path.resolve(process.cwd(), "src/app/login/page.tsx"), "utf8");
    expect(src).toContain('from "@/lib/tujuan-kembali"');
    expect(src.match(/router\.replace\(tujuanSesudahMasuk\(\)\)/g)?.length).toBe(2);
    expect(src).not.toMatch(/router\.replace\("\/portal"\)/);
  });

  it("username SIPP dari sesi SIPP di permintaan ini: dibuktikan bot; tanpa cookie / tak terbukti / bot galat = kosong (tanpa penjaga)", async () => {
    const dipanggil: unknown[][] = [];
    const bot = (balas: unknown) => async (...a: unknown[]) => (dipanggil.push(a), balas);
    const kepala = (cookie: string) => new Headers({ cookie, "user-agent": "UA-Uji" });
    expect(await usernameSippDariPermintaan(kepala("ci_session=abc123; lain=1"), bot({ ok: true, data: { terbukti: true, username: " budi.hakim " } }) as never)).toBe("budi.hakim");
    expect(dipanggil[0][0]).toBe("user.sesiSipp");
    expect(dipanggil[0][1]).toEqual({ cookie: ["abc123"], userAgent: "UA-Uji" });
    expect(await usernameSippDariPermintaan(kepala("lain=1"), bot({ ok: true, data: { terbukti: true, username: "x" } }) as never)).toBe("");
    expect(await usernameSippDariPermintaan(kepala("ci_session=abc"), bot({ ok: true, data: { terbukti: false, username: "x" } }) as never)).toBe("");
    expect(await usernameSippDariPermintaan(kepala("ci_session=abc"), bot({ ok: false, error: "mati" }) as never)).toBe("");
    expect(await usernameSippDariPermintaan(kepala("ci_session=abc"), (async () => { throw new Error("putus"); }) as never)).toBe("");
  });

  it("rute ecourt-sesi: penjaga hanya bila ?dariSipp=1, memakai periksaAkunSippTerbuka, tidak mengubah GET biasa", () => {
    const src = readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-ecourt/ecourt-sesi/route.ts"), "utf8");
    expect(src).toContain('searchParams.get("dariSipp") === "1"');
    expect(src).toContain("periksaAkunSippTerbuka(db, actor.id, await usernameSippDariPermintaan(request.headers))");
    expect(src).toContain('alasan: sipp.alasan');
  });

  it("formulir akun e-Court di portal menyebut peran dan jalan pulang bila dibuka dari menu SIPP", () => {
    const tsx = readFileSync(path.resolve(process.cwd(), "src/components/portal/ecourt-sesi-pribadi.tsx"), "utf8");
    expect(tsx).toContain('get("dari") === "menu"');
    expect(tsx).toContain("akun itulah yang menentukan peran Anda di e-Court");
    expect(tsx).toContain("Kembali ke SIPP lalu klik menu E-Court");
    // sandi tetap tidak masuk state
    expect(tsx).toContain("Sandi tidak pernah masuk state");
  });
});

// ============================================================================
describe("pendaftaran: manifest, popup, penyusun", () => {
  it("ecourt-masuk.js: skrip konten SATU-SATUNYA untuk https://ecourt.mahkamahagung.go.id/*, bingkai teratas, tanpa skrip lain", () => {
    const grup = MANIFEST.content_scripts.filter((c: any) => (c.js || []).includes("ecourt-masuk.js"));
    expect(grup.length).toBe(1);
    expect(grup[0].matches).toEqual(["https://ecourt.mahkamahagung.go.id/*"]);
    expect(grup[0].js).toEqual(["ecourt-masuk.js"]);
    expect(grup[0].all_frames).toBeUndefined();
    expect(grup[0].css).toBeUndefined();
    // tidak ada skrip ALETA lain yang menyentuh e-Court
    for (const c of MANIFEST.content_scripts) {
      if (c === grup[0]) continue;
      // Satu-satunya tambahan (T4, 23 Okt): lapisan warna tema gelap, document_start, hanya warna
      // (perilakunya diuji di tema-ecourt-23okt.test.ts).
      if ((c.js || []).includes("ecourt-tema.js")) {
        expect(c.js).toEqual(["tema-pusat.js", "ecourt-tema.js"]);
        expect(c.css).toEqual(["ecourt-tema.css"]);
        expect(c.run_at).toBe("document_start");
        continue;
      }
      expect((c.matches as string[]).some((m) => m.includes("ecourt.mahkamahagung"))).toBe(false);
    }
  });

  it("izin host: e-Court hanya lewat pencocokan skrip konten; host_permissions tidak bertambah", () => {
    expect(MANIFEST.host_permissions).toEqual(["http://192.168.10.10/*", "http://192.168.10.10:8008/*", "http://127.0.0.1/*"]);
    expect(MANIFEST.permissions).toEqual(["storage", "downloads", "nativeMessaging"]);
  });

  it("menu-atas.js, ecourt-masuk.js terdaftar di penyusun ekstensi dan saklar popup menyebut E-Court", () => {
    const susun = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"menu-atas.js"');
    expect(susun).toContain('"ecourt-masuk.js"');
    expect(baca("popup.html")).toContain("Menu ABT By Derry, ALETA, dan E-Court di bilah atas SIPP");
  });
});
