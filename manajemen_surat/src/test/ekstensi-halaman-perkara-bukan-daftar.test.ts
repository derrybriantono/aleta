// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { buatIndexedDbTiruan } from "./indexeddb-tiruan";

/**
 * ============================================================================
 * HALAMAN SATU PERKARA BUKAN HALAMAN DAFTAR (6 Oktober 2026, butir 7)
 * ============================================================================
 *
 * Keluhan: "saya buka per perkara, menu tiap perkara hilang, yang muncul yang
 * massal". Bukti layar: detil_perkara_agama, Super Admin, UI Baru, panel
 * "DAFTAR PERKARA - 2 di halaman ini" + Penetapan massal, BAS massal, Relaas
 * massal, Putusan massal - tanpa Unggah putusan ke SIPP dan Putusan otomatis.
 *
 * Sebabnya: cariNomorPerkara menganggap "lebih dari satu nomor perkara =
 * halaman daftar". Halaman detail SIPP yang posita-nya menyebut putusan lama
 * ("...dengan nomor putusan 371/Pdt.G/2024/PA.Dgl dan perkara tersebut telah
 * putus...", 131 dari 10.120 perkara sipp_donggala), atau tab Akta Cerai /
 * Banding yang menyebut nomor lain, memuat dua nomor - lalu terbaca daftar.
 *
 * Dijaga dengan MENJALANKAN panel-alat.js, basmassal.js, dan konten.js UTUH di
 * jsdom atas halaman SIPP tiruan bertabel Data Umum seperti data_umum.php
 * (td#first-child "Nomor Perkara" / "Posita"), untuk ketiga tampilan.
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () =>
  (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js")).replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "556/Pdt.G/2026/PA.Dgl";
const LAMA = "371/Pdt.G/2024/PA.Dgl";
const AKTA = "123/AC/2026/PA.Dgl";

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 5000): Promise<NonNullable<T>> {
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
    await tunggu(10);
  }
}

function konteksContoh(nomor: string) {
  return {
    ok: true,
    nomorPerkara: nomor,
    nomorRegister: "PA.DGL-2026-0556",
    identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
    ringkasan: { dokumen: 0 },
    dokumen: [],
    selisih: [],
    nomorPihak: [],
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: 3,
    hakim: null,
  };
}

function statusContoh(nama: string, sudahPutus = true) {
  return {
    majelis: [{ nama }],
    panitera: [],
    jurusita: [],
    ikrar: null,
    sumberMajelis: "pemeriksa",
    putusan: sudahPutus ? { sudahPutus: true, tanggalPutusan: "2026-09-30" } : { sudahPutus: false },
    putusanLengkap: sudahPutus ? { tanggalPutusan: "2026-09-30", statusPutusan: "Dikabulkan" } : {},
    penilaianSk: { rinci: [] },
    tahapan: {
      terbaca: true,
      tahap: ["pendaftaran", "pmh", "ppp", "pjs", "phs"].map((kunci) => ({ kunci, terbaca: true, tanggal: "2026-09-10" })),
    },
  };
}

type Minta = { url: string; cara: string };
type Halaman = { dom: JSDOM; w: any; d: Document; minta: Minta[] };

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: {
  alamat: string;
  html: string;
  simpanan?: Record<string, unknown>;
  peran?: string;
  belumPutus?: boolean;
  idb?: ReturnType<typeof buatIndexedDbTiruan>;
}): Halaman {
  const peran = p.peran || "Super Admin";
  const nama = "Munifa, S.H.";
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${p.html}</div></body></html>`, {
    url: `${ASAL}${p.alamat}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  // innerText peramban: blok dipisah, yang display:none TIDAK ikut. jsdom
  // tidak menghitung tata letak - yang tersembunyi lewat atribut style
  // dilewati di sini, setara untuk uji ini (tab SIPP yang tidak dipilih).
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      const bagian: string[] = [];
      const jalan = this.ownerDocument.createTreeWalker(this, 4 /* NodeFilter.SHOW_TEXT */);
      for (let n = jalan.nextNode(); n; n = jalan.nextNode()) {
        const induk = (n as Text).parentElement;
        if (induk && induk.closest('[style*="display:none"], [style*="display: none"]')) continue;
        bagian.push((n as Text).data);
      }
      return bagian.join(" ");
    },
  });
  w.TextDecoder = globalThis.TextDecoder;
  if (p.idb) w.indexedDB = p.idb;
  w.Response = globalThis.Response;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: Record<string, unknown>, wilayah: string) => void> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      const ubah: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(isi)) {
        ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async (kunci: string | string[]) => {
      for (const k of [kunci].flat()) delete simpanan[k];
    },
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.185.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: { local, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: (f: any) => void pendengar.push(f) } },
  };
  const minta: Minta[] = [];
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    minta.push({ url, cara });
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama, peran, kapabilitas: null } };
    } else if (url.includes("/aleta-bot/sipp-konteks/massal")) {
      isi = { ok: true, data: { available: true, perkara: {}, identitas: {} } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      const nomor = decodeURIComponent((/nomor(?:Perkara)?=([^&]+)/.exec(url) || [])[1] || "");
      isi = { ok: true, data: { available: true, konteks: konteksContoh(nomor), pengguna: { nama, peran }, kapabilitas: null } };
    } else if (url.includes("/aleta-ecourt/status-perkara?")) {
      isi = { ok: true, data: { available: true, status: statusContoh(nama, !p.belumPutus) } };
    } else if (url.includes("/putusan/isian-sipp?")) {
      isi = { ok: true, data: { ada: false, sebab: "Belum ada draf putusan untuk perkara ini." } };
    }
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      url,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => polos(isi),
      text: async () => JSON.stringify(isi ?? {}),
      clone: () => r,
    };
    return r;
  };
  const pmAsli = w.postMessage.bind(w);
  w.postMessage = (data: any, asal: string) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id } = data;
      const balas = data.jenis === "pilihan" ? { ok: true, tampak: false, pilihan: [], nilaiSekarang: "" } : { ok: true, medan: [] };
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ...balas }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  return { dom, w, d: w.document, minta };
}

/**
 * Halaman detil_perkara_agama: tab Data Umum (data_umum.php) yang posita-nya
 * menyebut putusan lama, dan tab Akta Cerai yang sedang TIDAK dipilih.
 * `lainDulu`: nomor lain tertulis LEBIH DAHULU daripada nomor perkaranya.
 */
function halamanDetail(opsi: { lainDulu?: boolean; aktaTampak?: boolean } = {}) {
  const posita =
    `<tr><td id="first-child">Posita</td><td colspan="2" class="wrapword">Bahwa Penggugat dan Tergugat pernah bercerai di Pengadilan Agama Donggala ` +
    `dengan nomor putusan ${LAMA} dan perkara tersebut telah putus pada tanggal 15 Oktober 2024, lalu rujuk kembali.</td></tr>`;
  const akta =
    `<div id="tabs25"${opsi.aktaTampak ? "" : ' style="display:none"'}><table><tr><td>Nomor Akta Cerai</td><td>${AKTA}</td></tr></table></div>`;
  return (
    `<table id="submenus"><tr><td><a class="btn" href="#">Kembali</a></td></tr></table>` +
    `<div id="tabs1"><table class="data-umum">` +
    (opsi.lainDulu ? posita : "") +
    `<tr><td id="first-child">Nomor Urut</td><td colspan="2">556</td></tr>` +
    `<tr><td id="first-child">Nomor Perkara</td><td colspan="2">\n\t\t\t\t\t${NOMOR}\t\t\t\t</td></tr>` +
    `<tr><td id="first-child">Jenis Perkara</td><td colspan="2">Cerai Gugat</td></tr>` +
    (opsi.lainDulu ? "" : posita) +
    `</table></div>` +
    akta
  );
}

const TAMPILAN: Array<[string, Record<string, unknown>]> = [
  ["Lama", { ujiTampilan: "lama" }],
  ["Baru", { ujiTampilan: "baru", ujiIzinkanNyata: true }],
  ["UI Baru", { ujiTampilan: "ui", ujiIzinkanNyata: true }],
];

const panelDari = (h: Halaman) => h.d.getElementById("aleta-panel-sipp") as any;
const kunciBagian = (pn: Element) => Array.from(pn.querySelectorAll(".aleta-bagian[data-kunci]")).map((b) => b.getAttribute("data-kunci"));
const MASSAL = /DAFTAR PERKARA|Penetapan massal|BAS massal|Putusan massal|Relaas & pemberitahuan putusan - massal/;

// ============================================================================
describe("cariNomorPerkara di halaman detail: nomor milik halaman dari baris 'Nomor Perkara'", () => {
  it("posita menyebut putusan lama: nomor halaman tetap terbaca (bukan daftar)", () => {
    const h = buka({ alamat: "/SIPP/detil_perkara_agama", html: halamanDetail() });
    expect(h.w.cariNomorPerkara()).toBe(NOMOR);
  });

  it("nomor lain tertulis LEBIH DAHULU, dan tab Akta Cerai tampak: tetap nomor dari baris 'Nomor Perkara'", () => {
    const h = buka({ alamat: "/SIPP/detil_perkara_agama", html: halamanDetail({ lainDulu: true, aktaTampak: true }) });
    expect(h.w.cariNomorPerkara()).toBe(NOMOR);
  });

  it("tab Data Umum sedang tidak dipilih (display:none): barisnya tetap dibaca", () => {
    const html = halamanDetail({ aktaTampak: true }).replace('<div id="tabs1">', '<div id="tabs1" style="display:none">');
    const h = buka({ alamat: "/SIPP/detil_perkara_agama", html });
    expect(h.w.cariNomorPerkara()).toBe(NOMOR);
  });

  it("label lain berawalan 'Nomor Perkara' (Tingkat Pertama, Terkait) tidak dipakai", () => {
    const html =
      `<table><tr><td id="first-child">Nomor Perkara Tingkat Pertama</td><td>${LAMA}</td></tr>` +
      `<tr><td id="first-child">Terkait Nomor Perkara</td><td>a. ${AKTA}</td></tr></table>`;
    const h = buka({ alamat: "/SIPP/detil_perkara_agama", html });
    expect(h.w.nomorUtamaHalamanPerkara()).toBe("");
  });

  it("halaman DAFTAR (alamat bukan detail) tetap daftar walau ada sel berlabel - hitungan lama berlaku", () => {
    const h = buka({
      alamat: "/SIPP/list_perkara",
      html: `<table><tr><td>Nomor Perkara</td><td>${NOMOR}</td></tr><tr><td>2</td><td>${LAMA}</td></tr></table>`,
    });
    expect(h.w.cariNomorPerkara()).toBe("");
  });
});

// ============================================================================
describe("panel di halaman satu perkara yang menyebut perkara lain: menu PER PERKARA, bukan massal", () => {
  for (const [nama, simpanan] of TAMPILAN) {
    it(`${nama}: panel perkara ${NOMOR} lengkap (Unggah putusan ke SIPP), tanpa satu pun bagian massal`, async () => {
      const h = buka({ alamat: "/SIPP/detil_perkara_agama", html: halamanDetail(), simpanan });
      const pn = await sampai(() => {
        const p = panelDari(h);
        return p && p.querySelector('.aleta-bagian[data-kunci="unggahPutusanSipp"]') ? p : null;
      }, `panel perkara dengan Unggah putusan ke SIPP (${nama}); panel kini: ${String(panelDari(h)?.textContent || "").slice(0, 200)}`);
      expect(pn.dataset.mode).not.toBe("daftar");
      expect(pn.textContent).not.toMatch(MASSAL);
      const kunci = kunciBagian(pn);
      expect(kunci).toContain("unggahPutusanSipp");
      for (const k of ["penetapanMassal", "putusanMassalSipp"]) expect(kunci).not.toContain(k);
      // Konteks yang diminta milik perkara halaman ini - bukan putusan lamanya.
      const konteks = h.minta.filter((m) => m.url.includes("/aleta-bot/sipp-konteks?"));
      expect(konteks.length).toBeGreaterThan(0);
      expect(konteks.every((m) => decodeURIComponent(m.url).includes(NOMOR))).toBe(true);
      expect(h.minta.some((m) => m.url.includes("/sipp-konteks/massal"))).toBe(false);
    });
  }

  it("UI Baru, peran Hakim: Unggah putusan ke SIPP (edoc putusan + anonimisasi) ada di menu perkara", async () => {
    const h = buka({ alamat: "/SIPP/detil_perkara_agama", html: halamanDetail(), simpanan: TAMPILAN[2][1], peran: "Hakim" });
    const pn = await sampai(() => {
      const p = panelDari(h);
      return p && p.querySelector('.aleta-bagian[data-kunci="unggahPutusanSipp"]') ? p : null;
    }, "panel perkara hakim");
    expect(pn.textContent).not.toMatch(MASSAL);
    expect(pn.textContent).toMatch(/Edoc putusan/);
    expect(pn.textContent).toMatch(/Edoc anonimisasi/);
  });

  it("detail perkara yang nomornya belum terbaca sama sekali (dua nomor, Data Umum belum termuat): BUKAN panel daftar", async () => {
    const h = buka({
      alamat: "/SIPP/detil_perkara_agama",
      html: `<table><tr><td>Riwayat</td><td>${LAMA}</td></tr><tr><td>Akta</td><td>${AKTA}</td></tr></table>`,
      simpanan: TAMPILAN[2][1],
    });
    await tunggu(800);
    const pn = panelDari(h);
    expect(pn ? pn.dataset.mode : "").not.toBe("daftar");
    expect(pn ? pn.textContent : "").not.toMatch(MASSAL);
  });
});

// ============================================================================
describe("pembanding: halaman DAFTAR perkara tetap menampilkan panel daftar dan menu massal", () => {
  for (const [nama, simpanan] of TAMPILAN) {
    it(`${nama}: daftar perkara gugatan - panel DAFTAR PERKARA`, async () => {
      const h = buka({
        alamat: "/SIPP/list_perkara",
        html:
          `<table><tr><th>No</th><th>Nomor Perkara</th></tr>` +
          `<tr><td>1</td><td><a href="#">${NOMOR}</a></td></tr>` +
          `<tr><td>2</td><td><a href="#">${LAMA}</a></td></tr></table>`,
        simpanan,
      });
      const pn = await sampai(() => {
        const p = panelDari(h);
        return p && p.dataset.mode === "daftar" ? p : null;
      }, `panel daftar (${nama})`);
      expect(pn.textContent).toMatch(/DAFTAR PERKARA/);
      expect(pn.querySelector('.aleta-bagian[data-kunci="unggahPutusanSipp"]')).toBeNull();
    });
  }
});

// ============================================================================
describe("Putusan otomatis satu perkara memakai naskah yang tersimpan di peramban untuk edoc (butir 6)", () => {
  const BLANGKO = ` <div id="popup_form"><div id="form_pop"><form id="frm_putusan"><textarea id="perhum"></textarea><textarea id="amar"></textarea><textarea id="amar_anonim"></textarea><input type="submit" id="simpan" value="Simpan"></form></div></div>`;
  for (const [nama, simpanan] of TAMPILAN.slice(1)) {
    it(`${nama}: naskah perkara ini sudah di rak -> baris "Sekali jalan" edoc tampil dengan nama berkasnya`, async () => {
      const idb = buatIndexedDbTiruan();
      idb.isi("aleta-naskah-edoc", "naskah").set(NOMOR.toLowerCase(), {
        kunci: NOMOR.toLowerCase(),
        nomor: NOMOR,
        asli: { nama: "556 putusan akhir.docx", tipe: "", bita: new TextEncoder().encode("PK naskah").buffer },
        rtf: null,
        waktu: Date.now(),
      });
      const h = buka({ alamat: "/SIPP/detil_perkara_agama", html: halamanDetail() + BLANGKO, simpanan, belumPutus: true, idb });
      const baris = await sampai(() => {
        const b = panelDari(h)?.querySelector(".aleta-a30-sekaligus") as HTMLElement | null;
        return b && b.style.display !== "none" && /556 putusan akhir\.docx/.test(b.textContent || "") ? b : null;
      }, `baris Sekali jalan (${nama}); panel: ${String(panelDari(h)?.textContent || "").slice(0, 300)}`);
      expect((baris.querySelector("input[type=checkbox]") as HTMLInputElement).checked).toBe(true);
    });
  }

  it("Lama: rak tidak dibaca dan barisnya tidak ada", async () => {
    const idb = buatIndexedDbTiruan();
    let dibuka = 0;
    const asliBuka = idb.open.bind(idb);
    idb.open = (n: string) => {
      dibuka += 1;
      return asliBuka(n);
    };
    const h = buka({ alamat: "/SIPP/detil_perkara_agama", html: halamanDetail() + BLANGKO, simpanan: TAMPILAN[0][1], belumPutus: true, idb });
    await sampai(() => panelDari(h)?.querySelector('.aleta-bagian[data-kunci="isiPutusan"]'), "Putusan otomatis (Lama)");
    await tunggu(300);
    expect(panelDari(h).querySelector(".aleta-a30-sekaligus")).toBeNull();
    expect(dibuka).toBe(0);
  });
});
