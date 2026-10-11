// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * "SEMBUNYIKAN PENJELASAN TEKNIS" (perbaikan 30 Sep sore butir 3, kontrak K5)
 * ============================================================================
 *
 * Yang dijaga, menurut pentingnya:
 *   1. BAWAAN NYALA: kunci sembunyikanTeknis yang belum pernah diatur berarti
 *      penjelasan teknis disembunyikan - di Baru dan UI Baru.
 *   2. Lama IDENTIK: tidak ada <html data-aleta-teknis>, tidak ada saklar di
 *      widget maupun popup, tidak ada kelas aleta-teknis di panel portal.
 *   3. Satu kunci untuk semua: popup, widget, dan tab lain (onChanged) saling
 *      mengikuti; peristiwa aleta-teknis-berubah dikirim saat berubah.
 *   4. Aturan CSS-nya ada (panel.css blok W, Shadow DOM widget, popup.html)
 *      dan hanya berlaku di bawah penandanya.
 *   5. Pesan error, peringatan, dan konfirmasi TIDAK ditandai.
 *
 * panel-alat.js, checklist.js, aleta.js, dan popup.js dijalankan SUNGGUHAN
 * di jsdom dengan chrome.storage dan fetch tiruan.
 */

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
// ALETA_UJI_ALAT: salinan yang sengaja dirusak, untuk membuktikan penjaga ini menggigit.
const SUMBER_ALAT = process.env.ALETA_UJI_ALAT
  ? readFileSync(process.env.ALETA_UJI_ALAT, "utf8").replace(/\r\n/g, "\n")
  : baca("panel-alat.js");
// ALETA_UJI_CHECKLIST / _ALETA / _POPUP: sama, untuk berkas lainnya.
const bacaGanti = (env: string | undefined, b: string) => (env ? readFileSync(env, "utf8").replace(/\r\n/g, "\n") : baca(b));
const SUMBER_CHECKLIST = bacaGanti(process.env.ALETA_UJI_CHECKLIST, "checklist.js");
const SUMBER_ALETA = bacaGanti(process.env.ALETA_UJI_ALETA, "aleta.js");
const GAYA = baca("panel.css");
const POPUP_HTML = baca("popup.html");
const POPUP_JS = bacaGanti(process.env.ALETA_UJI_POPUP, "popup.js");
const DAFTAR_FITUR_JS = baca("daftar-fitur.js");

const ASAL = "http://192.168.10.10";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 4000): Promise<NonNullable<T>> {
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

type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;

function penyimpanan(awal: Record<string, unknown>) {
  const simpanan: Record<string, unknown> = polos(awal);
  const pendengar: Array<(u: Ubah, wilayah: string) => void> = [];
  const siar = (ubah: Ubah) =>
    setTimeout(() => {
      for (const f of [...pendengar]) f(polos(ubah), "local");
    }, 0);
  return {
    simpanan,
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          const ubah: Ubah = {};
          for (const [k, v] of Object.entries(isi)) {
            ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
            simpanan[k] = polos(v);
          }
          siar(ubah);
        },
        remove: async (kunci: string | string[]) => {
          const ubah: Ubah = {};
          for (const k of [kunci].flat()) {
            ubah[k] = { oldValue: simpanan[k] };
            delete simpanan[k];
          }
          siar(ubah);
        },
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
}

function tanggapan(status: number, isi: unknown) {
  const r = { ok: status >= 200 && status < 300, status, statusText: "", json: async () => polos(isi), clone: () => r };
  return r;
}

// ── Checklist contoh (widget) ────────────────────────────────────────────────
function jawabanChecklist() {
  const t = new Date();
  t.setHours(16, 0, 0, 0);
  return {
    ok: true,
    data: {
      // 12 Okt: keterangan teknis di pita/kaki widget hanya untuk Super Admin (portal mengirim superAdmin).
      pengguna: { nama: "Hakim Uji", peran: ["hakim"], superAdmin: true },
      peranTersedia: [{ kunci: "hakim", label: "Hakim" }],
      peranAktif: "hakim",
      dibuat: new Date().toISOString(),
      ringkas: { lewat: 0, hariIni: 1, mingguIni: 0, selesaiHariIni: 0, totalHariIni: 1 },
      butir: [
        {
          id: "h1",
          jenis: "bas",
          judul: "BAS belum diunggah",
          perkara: { id: 1, nomor: "389/Pdt.G/2026/PA.Dgl" },
          tenggat: t.toISOString(),
          kelompok: "hari-ini",
          keterangan: "",
          kerjakan: { tujuan: "sipp" },
        },
      ],
      jenisTidakTersedia: [],
      galat: [],
    },
  };
}

const SIAPA = {
  nama: "Derry Briantono",
  peran: "Hakim",
  roleId: "hakim",
  kapabilitas: { panel: true, berkas: true, kerjakan: false },
  keterangan: {},
  menu: [],
  bolehMengatur: false,
  versiEkstensi: "1.175.0",
  versiTipe: null,
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(60);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Halaman = { w: any; d: Document; simpanan: Record<string, unknown>; setel: (x: Record<string, unknown>) => Promise<void> };

function buka(p: { simpanan?: Record<string, unknown>; checklist?: boolean; portal?: boolean; alamat?: string } = {}): Halaman {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><main><p>isi</p></main></body></html>`, {
    url: p.alamat || (p.portal ? `${ASAL}/aleta/aleta-ecourt` : `${ASAL}/SIPP/detil_perkara_agama`),
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  // 12 Okt: widget BAWAAN TERTUTUP bagi sesi tanpa posisi tersimpan; uji ini menguji isi yang
  // terbentang (saklar di kaki/Atur widget), jadi dimulai dari posisi "terbentang" kecuali disebut.
  const awalSimpanan: Record<string, unknown> = { ...(p.simpanan ?? {}) };
  for (const k of ["posisiChecklistSipp", "posisiChecklistAbt", "posisiChecklistAleta"]) {
    if (!(k in awalSimpanan)) awalSimpanan[k] = { kecil: false };
  }
  const { simpanan, storage } = penyimpanan(awalSimpanan);
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.175.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async () => ({}),
    },
    storage,
  };
  w.fetch = (alamat: string) => {
    const url = String(alamat);
    if (url.includes("/aleta-ecourt/checklist")) return Promise.resolve(tanggapan(200, jawabanChecklist()));
    if (url.includes("/ekstensi/siapa")) return Promise.resolve(tanggapan(200, { ok: true, data: SIAPA }));
    if (url.includes("/ekstensi?info=versi")) return Promise.resolve(tanggapan(200, { ok: true, data: { versi: "1.175.0" } }));
    return Promise.resolve(tanggapan(200, { ok: true, data: {} }));
  };
  w.Element.prototype.scrollIntoView = function () {};
  w.Response = Response;
  w.document.addEventListener("click", (e: any) => {
    if (e.target && e.target.closest && e.target.closest("a[href]")) e.preventDefault();
  }, true);
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  if (p.portal) vm.runInContext(SUMBER_ALETA, ctx, { filename: "aleta.js" });
  if (p.checklist) vm.runInContext(SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
  return { w, d: w.document, simpanan, setel: (x) => storage.local.set(x) };
}

const penanda = (h: Halaman) => h.d.documentElement.getAttribute("data-aleta-teknis");
const LAMA = { aktif: true };
const BARU = { aktif: true, ujiTampilan: "baru", ujiIzinkanNyata: true };
const UI = { aktif: true, ujiTampilan: "ui", ujiIzinkanNyata: true };

async function siapAlat(h: Halaman) {
  await h.w.alatMuatUji();
  await h.w.alatMuatTeknis();
  await tunggu(20);
}

// ============================================================================
describe("panel-alat.js: penanda <html> dan alatTeknisTersembunyi()", () => {
  it("BAWAAN NYALA: kunci belum diatur + Baru -> tersembunyi", async () => {
    const h = buka({ simpanan: BARU });
    await siapAlat(h);
    expect("sembunyikanTeknis" in h.simpanan).toBe(false);
    expect(h.w.alatTeknisTersembunyi()).toBe(true);
    expect(penanda(h)).toBe("sembunyi");
  });

  it("UI Baru juga; kunci false -> tampil", async () => {
    const a = buka({ simpanan: UI });
    await siapAlat(a);
    expect(penanda(a)).toBe("sembunyi");
    const b = buka({ simpanan: { ...UI, sembunyikanTeknis: false } });
    await siapAlat(b);
    expect(b.w.alatTeknisTersembunyi()).toBe(false);
    expect(penanda(b)).toBeNull();
  });

  it("LAMA tidak pernah: tanpa kunci, dengan kunci true, dan nilai tampilan asing", async () => {
    for (const simpan of [LAMA, { ...LAMA, sembunyikanTeknis: true }, { ...LAMA, ujiTampilan: "entah", sembunyikanTeknis: true }]) {
      const h = buka({ simpanan: simpan });
      await siapAlat(h);
      expect(h.w.alatTeknisTersembunyi(), JSON.stringify(simpan)).toBe(false);
      expect(h.d.documentElement.hasAttribute("data-aleta-teknis"), JSON.stringify(simpan)).toBe(false);
      expect(h.w.alatSaklarTeknis()).toBeNull();
    }
  });

  it("tampilan server yang diterapkan admin (tanpa uji lokal) ikut bergerbang", async () => {
    const h = buka({ simpanan: { aktif: true, tampilanServer: { mode: "baru", fitur: {}, diterapkan: true, versi: "a", diambil: Date.now() } } });
    await siapAlat(h);
    expect(penanda(h)).toBe("sembunyi");
  });

  it("berubah dari tab lain (onChanged) dan dari pengalih tampilan - seketika, dengan peristiwa", async () => {
    const h = buka({ simpanan: BARU });
    await siapAlat(h);
    const kabar: Array<{ tersembunyi: boolean; saklar: boolean }> = [];
    h.d.addEventListener("aleta-teknis-berubah", (e: any) => kabar.push(polos(e.detail)));
    await h.setel({ sembunyikanTeknis: false });
    await sampai(() => penanda(h) === null, "penanda lepas");
    expect(kabar.at(-1)).toEqual({ tersembunyi: false, saklar: false });
    await h.setel({ sembunyikanTeknis: true });
    await sampai(() => penanda(h) === "sembunyi", "penanda kembali");
    // Kembali ke Lama: penanda lepas walau saklarnya nyala.
    await h.setel({ ujiTampilan: "lama" });
    await sampai(() => penanda(h) === null, "Lama melepas penanda");
    expect(kabar.at(-1)).toEqual({ tersembunyi: false, saklar: true });
    await h.setel({ ujiTampilan: "ui" });
    await sampai(() => penanda(h) === "sembunyi", "UI Baru memasang lagi");
  });

  it("alatSetelTeknis menulis kuncinya; kunci yang dihapus kembali ke bawaan (nyala)", async () => {
    const h = buka({ simpanan: BARU });
    await siapAlat(h);
    await h.w.alatSetelTeknis(false);
    expect(h.simpanan.sembunyikanTeknis).toBe(false);
    expect(penanda(h)).toBeNull();
    await h.w.alatSetelTeknis(true);
    expect(h.simpanan.sembunyikanTeknis).toBe(true);
    expect(penanda(h)).toBe("sembunyi");
  });

  it("alatSaklarTeknis: kotak centang yang menulis dan mengikuti keadaan", async () => {
    const h = buka({ simpanan: BARU });
    await siapAlat(h);
    const label = h.w.alatSaklarTeknis();
    h.d.body.appendChild(label);
    const kotak = label.querySelector("input");
    expect(label.textContent).toMatch(/Sembunyikan penjelasan teknis/);
    expect(kotak.checked).toBe(true);
    kotak.checked = false;
    kotak.dispatchEvent(new h.w.Event("change"));
    await sampai(() => h.simpanan.sembunyikanTeknis === false, "tersimpan");
    await h.w.alatSetelTeknis(true);
    expect(kotak.checked).toBe(true);
  });

  it("ⓘ dari penjelasan teknis yang dilipat ikut teknis; yang bukan teknis tidak", async () => {
    const h = buka({ simpanan: BARU });
    await siapAlat(h);
    const akar = h.d.createElement("div");
    const panjang = "Penjelasan yang cukup panjang supaya dilipat di balik tombol info oleh panel ALETA. ".repeat(2);
    akar.innerHTML = `<p class="x aleta-teknis">${panjang}</p><p class="x">${panjang}</p>`;
    h.d.body.appendChild(akar);
    expect(h.w.alatLipatPenjelasan(akar, ".x", 20)).toBe(2);
    const tombol = Array.from(akar.querySelectorAll(".aleta-info-lipat")) as HTMLElement[];
    expect(tombol[0].classList.contains("aleta-teknis")).toBe(true);
    expect(tombol[1].classList.contains("aleta-teknis")).toBe(false);
  });

  it("profil peran boleh menetapkan keadaan awal saklarnya (K4)", () => {
    const daftar = SUMBER_ALAT.slice(SUMBER_ALAT.indexOf("const ALAT_PROFIL_SAKLAR"), SUMBER_ALAT.indexOf("const ALAT_PROFIL_KUNCI_DITERAPKAN"));
    expect(daftar).toContain('"sembunyikanTeknis"');
  });
});

// ============================================================================
describe("aturan CSS: hanya di bawah penanda", () => {
  it("panel.css blok W menyembunyikan .aleta-teknis di bawah html[data-aleta-teknis=sembunyi]", () => {
    const awal = GAYA.indexOf("/* === W - PERBAIKAN 30 SEP SORE === */");
    const akhir = GAYA.indexOf("/* === AKHIR W === */");
    expect(awal).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(awal);
    const blok = GAYA.slice(awal, akhir);
    expect(blok).toMatch(/html\[data-aleta-teknis="sembunyi"\] \.aleta-teknis \{\s*display: none !important;\s*\}/);
    // Tidak ada aturan lain yang menyembunyikan .aleta-teknis tanpa penanda.
    const semua = GAYA.match(/[^{}]*\.aleta-teknis[^{}]*\{[^}]*\}/g) || [];
    for (const aturan of semua) expect(aturan).toMatch(/data-aleta-teknis="sembunyi"/);
  });

  it("dijalankan: .aleta-teknis tersembunyi hanya selama penandanya ada", () => {
    const blok = GAYA.slice(GAYA.indexOf("/* === W - PERBAIKAN 30 SEP SORE === */"), GAYA.indexOf("/* === AKHIR W === */"));
    const dom = new JSDOM(`<!doctype html><html><head><style>${blok}</style></head><body><p class="aleta-teknis">x</p><p class="biasa">y</p></body></html>`);
    terbuka.push(dom);
    const w = dom.window;
    const [teknis, biasa] = Array.from(w.document.querySelectorAll("p"));
    expect(w.getComputedStyle(teknis).display).not.toBe("none");
    w.document.documentElement.setAttribute("data-aleta-teknis", "sembunyi");
    expect(w.getComputedStyle(teknis).display).toBe("none");
    expect(w.getComputedStyle(biasa).display).not.toBe("none");
  });

  it("widget (Shadow DOM) dan popup membawa aturannya sendiri", () => {
    expect(SUMBER_CHECKLIST).toMatch(/:host\(\[data-teknis="sembunyi"\]\) \.aleta-teknis \{ display: none !important; \}/);
    expect(POPUP_HTML).toMatch(/:root\[data-aleta-teknis="sembunyi"\] \.aleta-teknis \{ display: none !important; \}/);
  });

  it("popup memakai kunci penyimpanan yang sama dengan panel-alat.js", () => {
    const alat = SUMBER_ALAT.match(/const ALAT_TEKNIS_KUNCI = "([^"]+)"/);
    const popup = POPUP_JS.match(/const KUNCI_TEKNIS = "([^"]+)"/);
    expect(alat && alat[1]).toBe("sembunyikanTeknis");
    expect(popup && popup[1]).toBe(alat && alat[1]);
  });
});

// ============================================================================
// Widget checklist
// ============================================================================
const akarWidget = (h: Halaman) => h.d.querySelector("aleta-cm-widget") as any;
const qw = (h: Halaman, pemilih: string) => {
  const a = akarWidget(h);
  return a && a.shadowRoot ? (a.shadowRoot.querySelector(pemilih) as any) : null;
};

describe("widget checklist: saklar dan tanda", () => {
  it("Lama: tidak ada saklar, tidak ada kelas, akar tanpa data-teknis", async () => {
    const h = buka({ simpanan: { ...LAMA, checklistMilestone: true }, checklist: true });
    await sampai(() => qw(h, ".aleta-cm-kelompok"), "widget tergambar");
    await tunggu(40);
    expect(qw(h, "[data-widget-teknis]")).toBeNull();
    expect(qw(h, ".aleta-teknis")).toBeNull();
    expect(akarWidget(h).hasAttribute("data-teknis")).toBe(false);
  });

  it("Baru: saklar di kaki checklist, NYALA bawaan; keterangan kaki bertanda; menekannya menulis false", async () => {
    const h = buka({ simpanan: { ...BARU, checklistMilestone: true }, checklist: true });
    const saklar = await sampai(() => qw(h, '.aleta-cm-kaki [data-widget-teknis] [role="switch"]'), "saklar di kaki");
    await sampai(() => akarWidget(h).getAttribute("data-teknis") === "sembunyi", "akar bertanda");
    expect(saklar.getAttribute("aria-checked")).toBe("true");
    expect(qw(h, ".aleta-cm-catatan").classList.contains("aleta-teknis")).toBe(true);
    // Hasil yang dibaca untuk bertindak TIDAK ditandai.
    expect(qw(h, ".aleta-cm-waktu").classList.contains("aleta-teknis")).toBe(false);
    expect(qw(h, ".aleta-cm-kerjakan").classList.contains("aleta-teknis")).toBe(false);
    saklar.click();
    await sampai(() => h.simpanan.sembunyikanTeknis === false, "tersimpan false");
    await sampai(() => !akarWidget(h).hasAttribute("data-teknis"), "tanda akar lepas");
    expect(penanda(h)).toBeNull();
    await sampai(() => qw(h, '[data-widget-teknis] [role="switch"]')?.getAttribute("aria-checked") === "false", "rupa saklar ikut");
  });

  it("UI Baru: saklar di Atur widget; diubah dari popup (onChanged) -> widget ikut", async () => {
    const h = buka({ simpanan: { ...UI, checklistMilestone: true }, checklist: true });
    await sampai(() => qw(h, ".aleta-cmw-dok") && qw(h, ".aleta-cm-kelompok"), "dok tergambar");
    expect(qw(h, ".aleta-cm-kaki [data-widget-teknis]")).toBeNull();
    qw(h, ".aleta-cmw-atur-buka").click();
    const saklar = await sampai(() => qw(h, '.aleta-cmw-atur [data-widget-teknis] [role="switch"]'), "saklar di Atur");
    expect(saklar.getAttribute("aria-checked")).toBe("true");
    expect(qw(h, ".aleta-cmw-atur .aleta-cmw-ket").classList.contains("aleta-teknis")).toBe(true);
    await h.setel({ sembunyikanTeknis: false });
    await sampai(
      () => qw(h, '.aleta-cmw-atur [data-widget-teknis] [role="switch"]')?.getAttribute("aria-checked") === "false",
      "saklar ikut popup"
    );
    expect(akarWidget(h).hasAttribute("data-teknis")).toBe(false);
  });

  it("kabar error widget tidak pernah ditandai (penjaga teks)", () => {
    const kabar = SUMBER_CHECKLIST.slice(SUMBER_CHECKLIST.indexOf("function susunKabar()"), SUMBER_CHECKLIST.indexOf("function susunKemajuan()"));
    expect(kabar.length).toBeGreaterThan(200);
    expect(kabar).not.toMatch(/teknis/);
  });
});

// ============================================================================
// Panel portal (aleta.js)
// ============================================================================
const panelPortal = (h: Halaman) => h.d.getElementById("aleta-panel-portal") as any;

describe("panel portal: tanda teknis hanya di Baru/UI Baru", () => {
  it("Lama: tidak satu pun .aleta-teknis", async () => {
    const h = buka({ portal: true, simpanan: LAMA });
    await sampai(() => panelPortal(h), "panel lahir");
    await tunggu(80);
    expect(panelPortal(h).querySelectorAll(".aleta-teknis").length).toBe(0);
  });

  it("Baru: kotak kosong riwayat bertanda; kabar singkat panel tidak", async () => {
    const h = buka({ portal: true, simpanan: BARU });
    await sampai(() => panelPortal(h)?.querySelector(".aleta-teknis"), "tanda teknis lahir");
    expect(penanda(h)).toBe("sembunyi");
    for (const x of Array.from(panelPortal(h).querySelectorAll(".aleta-kosong-lembut")) as HTMLElement[]) {
      expect(x.classList.contains("aleta-teknis")).toBe(true);
    }
    const kabar = SUMBER_ALETA.slice(SUMBER_ALETA.indexOf("function t4Kabar("), SUMBER_ALETA.indexOf("function t4PilihTab("));
    expect(kabar).not.toMatch(/teknis/);
  });

  it("'Belum tersedia.' tetap tampil; sebab teknisnya yang ditandai", () => {
    const f = SUMBER_ALETA.slice(SUMBER_ALETA.indexOf("function t4BelumTersediaRinci("), SUMBER_ALETA.indexOf("function t4Kabar("));
    expect(f).toMatch(/buatElemen\("div", "aleta-t4-belum", "Belum tersedia\."\)/);
    expect(f).toMatch(/t4Teknis\(buatElemen\("span"/);
  });
});

// ============================================================================
// Popup
// ============================================================================
// UIBARU-WAJIB 12 Okt: pilihan Lama/Baru hanya milik Super Admin.
function bukaPopup(simpan: Record<string, unknown>, peran = "Super Admin") {
  const html = POPUP_HTML.replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const { simpanan, storage } = penyimpanan({ asalPortal: `${ASAL}/aleta`, ...simpan });
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.175.0", host_permissions: [`${ASAL}/*`] }),
      sendMessage: async () => ({}),
    },
    storage,
  };
  w.fetch = async (alamat: string) => {
    const a = String(alamat);
    if (a.includes("info=siapa")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran }, versi: "1.175.0" } }) };
    }
    return { ok: true, status: 200, url: a, json: async () => ({}) };
  };
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(DAFTAR_FITUR_JS, ctx, { filename: "daftar-fitur.js" });
  vm.runInContext(POPUP_JS, ctx, { filename: "popup.js" });
  return { w, d: w.document as Document, simpanan, setel: (x: Record<string, unknown>) => storage.local.set(x) };
}

async function tenangPopup(p: ReturnType<typeof bukaPopup>) {
  await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
  await tunggu(60);
}

describe("popup: saklar 'Sembunyikan penjelasan teknis'", () => {
  it("Lama: tidak ada saklar dan tidak ada penanda, walau kuncinya tersimpan", async () => {
    for (const simpan of [{}, { sembunyikanTeknis: true }, { ujiTampilan: "lama", sembunyikanTeknis: false }]) {
      const p = bukaPopup(simpan);
      await tenangPopup(p);
      expect(p.d.getElementById("sembunyikanTeknis"), JSON.stringify(simpan)).toBeNull();
      expect(p.d.documentElement.hasAttribute("data-aleta-teknis")).toBe(false);
      expect(p.d.querySelectorAll(".aleta-teknis").length).toBe(0);
    }
  });

  it("Baru: tercentang bawaan, penanda terpasang, sesudah Ukuran huruf panel; menghapus centang menulis false", async () => {
    const p = bukaPopup({ ujiTampilan: "baru" });
    await tenangPopup(p);
    const kotak = (await sampai(() => p.d.getElementById("sembunyikanTeknis"), "saklar lahir")) as HTMLInputElement;
    expect(kotak.checked).toBe(true);
    expect(kotak.closest("label.saklar")!.textContent).toMatch(/Sembunyikan penjelasan teknis[\s\S]*Error, peringatan, dan konfirmasi tetap tampil/);
    expect(p.d.documentElement.getAttribute("data-aleta-teknis")).toBe("sembunyi");
    const skala = p.d.getElementById("skalaNilai")!.closest(".skala")!;
    expect(skala.nextElementSibling).toBe(kotak.closest("label"));
    // Keterangan teknis popup sendiri bertanda; kabar tidak.
    expect(p.d.getElementById("perbaruiSekarang")!.closest(".skala")!.querySelector(".saklar-ket")!.classList.contains("aleta-teknis")).toBe(true);
    expect(p.d.getElementById("perbaruiKabar")!.classList.contains("aleta-teknis")).toBe(false);
    expect(p.d.getElementById("kabarReset")!.classList.contains("aleta-teknis")).toBe(false);
    // Uji popup tahap 2: tanpa saklar popup-N tetap tanpa elemen tb-*.
    expect(p.d.querySelectorAll('[class^="tb-"], [class*=" tb-"]').length).toBe(0);
    kotak.checked = false;
    kotak.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    // Sejak uji rilis U2c (2c31407) saklar ditulis lewat simpanSaklar - satu
    // giliran mikrotugas kemudian (agar penolakan penyimpanan dapat
    // mengembalikan centangnya). Ditunggu, bukan dibaca serentak.
    await sampai(() => p.simpanan.sembunyikanTeknis === false, "sembunyikanTeknis tersimpan false");
    expect(p.simpanan.sembunyikanTeknis).toBe(false);
    expect(p.d.documentElement.hasAttribute("data-aleta-teknis")).toBe(false);
  });

  it("kunci false tersimpan: tidak tercentang, tanpa penanda", async () => {
    const p = bukaPopup({ ujiTampilan: "baru", sembunyikanTeknis: false });
    await tenangPopup(p);
    const kotak = (await sampai(() => p.d.getElementById("sembunyikanTeknis"), "saklar lahir")) as HTMLInputElement;
    expect(kotak.checked).toBe(false);
    expect(p.d.documentElement.hasAttribute("data-aleta-teknis")).toBe(false);
  });

  it("UI Baru: di kelompok Tampilan; kembali ke Lama melepas saklar, penanda, dan kelas", async () => {
    const p = bukaPopup({ ujiTampilan: "ui" }, "Super Admin");
    await tenangPopup(p);
    const kotak = await sampai(() => p.d.getElementById("sembunyikanTeknis"), "saklar lahir");
    expect(kotak.closest("#kelompok-tampilan")).not.toBeNull();
    expect(p.d.documentElement.getAttribute("data-aleta-teknis")).toBe("sembunyi");
    (p.d.getElementById("ujiLama") as HTMLButtonElement).click();
    await sampai(() => p.d.getElementById("sembunyikanTeknis") === null, "saklar hilang di Lama");
    expect(p.d.documentElement.hasAttribute("data-aleta-teknis")).toBe(false);
    expect(p.d.querySelectorAll(".aleta-teknis").length).toBe(0);
  });

  it("ekspor/impor mengenal kuncinya", () => {
    const aturan = POPUP_JS.slice(POPUP_JS.indexOf("const ATURAN_PENGATURAN"), POPUP_JS.indexOf("const JENIS_BERKAS_PENGATURAN"));
    expect(aturan).toMatch(/\[KUNCI_TEKNIS\]: benarSalah/);
  });
});
