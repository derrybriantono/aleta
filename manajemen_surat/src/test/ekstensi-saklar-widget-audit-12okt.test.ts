// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { buatIndexedDbTiruan } from "./indexeddb-tiruan";

/**
 * ============================================================================
 * AUDIT SAKLAR ON/OFF WIDGET ALETA (popup ekstensi) - 12 Okt 2026, butir 17
 * ============================================================================
 *
 * Pengguna: "cek kembali semua fungsi toggle on/off di ekstensi widget aleta
 * berfungsi sesuai". Uji lama menjaga saklar satu per satu, sebagian besar
 * lewat toContain atas kode sendiri - yang lulus walau POPUP menulis kunci A
 * sementara PEMBACANYA membaca kunci B. Yang dijaga di sini adalah UJUNG KE
 * UJUNG, dengan logika yang DIJALANKAN:
 *
 *   popup.html + popup.js (JSDOM)  --chrome.storage.local (satu gudang)-->
 *   halaman SIPP (JSDOM): panel-alat.js + basmassal.js + konten.js + checklist.js
 *
 * Satu gudang bersama meneruskan onChanged ke semua konteks, seperti Chrome.
 * Centang dibalik di popup; yang diperiksa adalah (1) kunci dan nilai yang
 * ditulis popup, (2) keadaan PEMBACA di halaman sesudahnya, (3) penghapusan
 * kunci kembali ke bawaan pembaca (bukan ke "mati" diam-diam), dan (4)
 * penyimpanan yang menolak menulis mengembalikan centangnya.
 *
 * Tabel saklar -> pembaca ada di laporan butir 17 (sesi ini).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const POPUP_HTML = baca("popup.html");
const POPUP_JS = baca("popup.js");
const POPUP_IDE_L2 = baca("popup-ide-l2.js");
const DAFTAR_FITUR = baca("daftar-fitur.js");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");
const KONTEN = baca("konten.js");
const CHECKLIST = baca("checklist.js");
const ABT = baca("abt.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "556/Pdt.G/2026/PA.Dgl";
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T | Promise<T>, apa: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = await periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${apa}`);
    await tunggu(10);
  }
}

// ── satu gudang chrome.storage.local untuk semua konteks ─────────────────────

type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;

class Gudang {
  data: Record<string, unknown>;
  pendengar: Array<(u: Ubah, wilayah: string) => void> = [];
  /** Isi tiap set() yang berhasil, urut. */
  tulisan: Array<Record<string, unknown>> = [];
  /** Penyimpanan menolak menulis (kuota/konteks mati). */
  menolak = false;
  constructor(awal: Record<string, unknown> = {}) {
    this.data = polos(awal);
  }
  private sebar(ubah: Ubah) {
    setTimeout(() => {
      for (const f of [...this.pendengar]) f(polos(ubah), "local");
    }, 0);
  }
  api() {
    return {
      get: async (kunci?: string | string[] | null) => {
        const daftar = kunci == null ? Object.keys(this.data) : [kunci].flat();
        const hasil: Record<string, unknown> = {};
        for (const k of daftar) if (k in this.data) hasil[k] = polos(this.data[k]);
        return hasil;
      },
      set: async (isi: Record<string, unknown>) => {
        if (this.menolak) throw new Error("QUOTA_BYTES");
        const ubah: Ubah = {};
        for (const [k, v] of Object.entries(isi)) {
          ubah[k] = { oldValue: this.data[k], newValue: polos(v) };
          this.data[k] = polos(v);
        }
        this.tulisan.push(polos(isi));
        this.sebar(ubah);
      },
      remove: async (kunci: string | string[]) => {
        const ubah: Ubah = {};
        for (const k of [kunci].flat()) {
          if (!(k in this.data)) continue;
          ubah[k] = { oldValue: this.data[k] }; // Chrome: tanpa newValue
          delete this.data[k];
        }
        this.sebar(ubah);
      },
    };
  }
  /** Yang disimpan terakhir untuk kunci itu di antara tulisan() popup. */
  terakhir(kunci: string) {
    for (let i = this.tulisan.length - 1; i >= 0; i -= 1) if (kunci in this.tulisan[i]) return this.tulisan[i][kunci];
    return undefined;
  }
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function chromeTiruan(gudang: Gudang, versi = "1.196.0") {
  return {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: versi, host_permissions: ["http://192.168.10.10/*", "http://127.0.0.1/*"] }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async () => ({}),
    },
    storage: {
      local: gudang.api(),
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, w: string) => void) => void gudang.pendengar.push(f) },
    },
  };
}

// ── popup (JSDOM) ────────────────────────────────────────────────────────────

function bukaPopup(gudang: Gudang, peran: string) {
  // Alamat portal dicatat skrip konten di halaman nyata; popup tanpanya tidak tahu ke mana bertanya.
  if (!("asalPortal" in gudang.data)) gudang.data.asalPortal = `${ASAL}/aleta`;
  const html = POPUP_HTML.replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { url: "chrome-extension://aleta-uji/popup.html", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  w.chrome = chromeTiruan(gudang);
  w.fetch = async (alamat: string, init?: { method?: string }) => {
    const a = String(alamat);
    const cara = String((init && init.method) || "GET").toUpperCase();
    const baik = (data: unknown) => ({ ok: true, status: 200, url: a, json: async () => ({ ok: true, data }) });
    if (a.includes("info=siapa")) return baik({ pengguna: { nama: "Uji", peran }, versi: "1.196.0" });
    if (a.includes("/ekstensi/tarik-ecourt")) return baik({ tersedia: true, ringkas: { keadaan: "mati", aktif: false, label: "Tidak aktif", keterangan: "x", sedangJalan: false, terakhirSelesai: null } });
    if (a.includes("/ekstensi/tampilan")) return { ok: false, status: 404, url: a, json: async () => ({}) };
    if (a.includes("/ekstensi/setelan") && cara === "PUT") return baik({ nilai: {}, diubahPada: new Date().toISOString() });
    if (a.includes("/ekstensi/setelan")) return baik({ setelan: {} });
    return { ok: true, status: 200, url: a, json: async () => ({}) };
  };
  const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
  vm.runInContext(DAFTAR_FITUR, ctx, { filename: "daftar-fitur.js" });
  vm.runInContext(POPUP_JS, ctx, { filename: "popup.js" });
  vm.runInContext(POPUP_IDE_L2, ctx, { filename: "popup-ide-l2.js" });
  const d = w.document as Document;
  return {
    w,
    d,
    kotak: (id: string) => d.getElementById(id) as HTMLInputElement,
    /** Membalik centang seperti pengguna: ubah checked lalu peristiwa change. */
    balik(id: string) {
      const k = d.getElementById(id) as HTMLInputElement;
      k.checked = !k.checked;
      k.dispatchEvent(new w.Event("change", { bubbles: true }));
      return k.checked;
    },
    /** Portal terjawab, lalu bagian khusus Super Admin/Admin (mode latihan, tampilan uji) terpasang. */
    siap: async () => {
      await sampai(() => !/memuat/.test(d.getElementById("akunAleta")!.textContent || ""), "popup membaca portal");
      await sampai(() => !(d.getElementById("bagianLatihan") as HTMLElement).hidden, "mode latihan terpasang");
      if (/super/i.test(peran)) await sampai(() => !(d.getElementById("bagianUji") as HTMLElement).hidden, "tampilan uji terpasang");
      await tunggu(40);
    },
  };
}
type Popup = ReturnType<typeof bukaPopup>;

// ── halaman SIPP (JSDOM): panel-alat + basmassal + konten + checklist ────────

function halamanDetail() {
  return (
    `<table id="submenus"><tr><td><a class="btn" href="#">Kembali</a></td></tr></table>` +
    `<div id="tabs1"><table class="data-umum">` +
    `<tr><td id="first-child">Nomor Urut</td><td colspan="2">556</td></tr>` +
    `<tr><td id="first-child">Nomor Perkara</td><td colspan="2">${NOMOR}</td></tr>` +
    `<tr><td id="first-child">Jenis Perkara</td><td colspan="2">Cerai Gugat</td></tr>` +
    `</table></div>`
  );
}

function bukaSipp(gudang: Gudang) {
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${halamanDetail()}</div></body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
  w.TextDecoder = globalThis.TextDecoder;
  w.indexedDB = buatIndexedDbTiruan();
  w.Response = globalThis.Response;
  w.chrome = chromeTiruan(gudang);
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama: "Uji", peran: "Super Admin", kapabilitas: null } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = {
        ok: true,
        data: {
          available: true,
          konteks: {
            ok: true,
            nomorPerkara: NOMOR,
            nomorRegister: "PA.DGL-2026-0556",
            identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
            ringkasan: { dokumen: 0 },
            dokumen: [],
            selisih: [],
            nomorPihak: [],
            diperiksaPada: new Date().toISOString(),
            ambangMendesakHari: 3,
            hakim: null,
          },
          pengguna: { nama: "Uji", peran: "Super Admin" },
          kapabilitas: null,
        },
      };
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
  vm.runInContext(KONTEN, ctx, { filename: "konten.js" });
  vm.runInContext(CHECKLIST, ctx, { filename: "checklist.js" });
  const d = w.document as Document;
  return {
    w,
    d,
    panel: () => d.getElementById("aleta-panel-sipp"),
    widget: () => d.querySelector("aleta-cm-widget"),
  };
}


// ── halaman ABT (JSDOM): panel-alat + abt ────────────────────────────────────

function bukaAbt(gudang: Gudang) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>ABT</title></head><body><div id="wrapper"><div id="content"></div></div><div id="cssmenu"></div></body></html>`,
    { url: `${ASAL}/aps_badilag/abt/main/view?c=10014`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  w.TextDecoder = globalThis.TextDecoder;
  w.indexedDB = buatIndexedDbTiruan();
  w.Response = globalThis.Response;
  w.chrome = chromeTiruan(gudang);
  w.chrome.runtime.sendMessage = (_p: unknown, balik?: (x: unknown) => void) => {
    if (balik) balik({ ok: true });
  };
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    const kosong: any = { ok: false, status: 404, statusText: "", url, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "{}", clone: () => kosong };
    return kosong;
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(ABT, ctx, { filename: "abt.js" });
  return { w, d: w.document as Document };
}

/** Popup dan halaman SIPP di atas SATU gudang; peran Super Admin kecuali disebut. */
async function pasangan(awal: Record<string, unknown> = {}, peran = "Super Admin") {
  const gudang = new Gudang(awal);
  const halaman = bukaSipp(gudang);
  const popup = bukaPopup(gudang, peran);
  await popup.siap();
  await tunggu(60);
  return { gudang, halaman, popup };
}

// ============================================================================
describe("A. popup: tiap saklar menulis kunci dan nilai yang benar (dan membaca keadaan awalnya)", () => {
  // id kotak centang -> kunci chrome.storage.local, bawaan bila kunci tak ada.
  const STATIS: Array<{ id: string; kunci: string; bawaan: boolean }> = [
    { id: "aktif", kunci: "aktif", bawaan: true },
    { id: "tandaiHalaman", kunci: "tandaiHalaman", bawaan: true },
    { id: "sisipJadwal", kunci: "sisipJadwal", bawaan: false },
    { id: "cetakTigaBerkas", kunci: "cetakTigaBerkas", bawaan: false },
    { id: "suntingLangsungAbt", kunci: "suntingLangsungAbt", bawaan: false },
    { id: "checklistMilestone", kunci: "checklistMilestone", bawaan: false },
    { id: "modeLatihan", kunci: "modeLatihan", bawaan: false },
    // Blangko ABT by Derry Briantono (16 Okt, tahap C).
    { id: "derryBawaan", kunci: "blangkoDerryBawaan", bawaan: false },
    { id: "derryTawar", kunci: "blangkoDerryTawar", bawaan: true },
    { id: "derrySaran", kunci: "blangkoDerrySaran", bawaan: true },
    { id: "derryIngat", kunci: "blangkoDerryIngat", bawaan: true },
    // JJ2 (18 Okt): tanya-jawab jawab-menjawab otomatis dari berkas e-Court - bawaan menyala.
    { id: "derryTjJawab", kunci: "blangkoDerryTjJawab", bawaan: true },
    // 19 Okt: isi otomatis dari SIPP di Blangko Derry - bawaan menyala.
    { id: "derryIsiOto", kunci: "blangkoDerryIsiOto", bawaan: true },
    // SIPP dengan Ide ALETA gelombang 1 (Tahap L2, 16 Okt) - popup-ide-l2.js.
    { id: "ideL2", kunci: "ideL2", bawaan: true },
    { id: "ideL2Sita", kunci: "ideL2Sita", bawaan: true },
    { id: "ideL2Eksekusi", kunci: "ideL2Eksekusi", bawaan: true },
    { id: "ideL2IzinCerai", kunci: "ideL2IzinCerai", bawaan: true },
    { id: "ideL2Penetapan", kunci: "ideL2Penetapan", bawaan: true },
    { id: "ideL2BelumDitunda", kunci: "ideL2BelumDitunda", bawaan: true },
    { id: "ideL2Verstek", kunci: "ideL2Verstek", bawaan: true },
    { id: "ideL2Umur", kunci: "ideL2Umur", bawaan: true },
    { id: "ideL2TanpaSidang", kunci: "ideL2TanpaSidang", bawaan: true },
    { id: "ideL2Ikrar", kunci: "ideL2Ikrar", bawaan: true },
    { id: "ideL2AktaCerai", kunci: "ideL2AktaCerai", bawaan: true },
    { id: "ideL2LimaBulan", kunci: "ideL2LimaBulan", bawaan: true },
    { id: "ideL2EcourtVerifikasi", kunci: "ideL2EcourtVerifikasi", bawaan: true },
    // SIPP dengan Ide ALETA gelombang 2 (16 Okt, tahap M2).
    { id: "sippPenyatu", kunci: "sippPenyatu", bawaan: true },
    { id: "sippTampilDobel", kunci: "sippTampilDobel", bawaan: false },
    // F3.2 (17 Okt): kotak kehadiran sidang hari ini di widget.
    { id: "widgetKehadiran", kunci: "widgetKehadiran", bawaan: true },
    // F4.2 (17 Okt): kotak draf putusan H-7 di widget.
    { id: "widgetDrafH7", kunci: "widgetDrafH7", bawaan: true },
    // 20 Okt: pratinjau BAS & relaas di SIPP sebelum diunduh - bawaan menyala.
    { id: "pratinjauBasRelaas", kunci: "pratinjauBasRelaas", bawaan: true },
    // F1.5 (17 Okt): gembok panel ALETA di ABT biasa - menyala = terkunci (tampil penuh).
    { id: "gembokAbt", kunci: "gembokKepalaAbt", bawaan: false },
    // X1 (21 Okt): ringkas keterangan panel - kunci sama dengan tombol panah di kaki panel.
    { id: "panelRingkas", kunci: "panelRingkas", bawaan: false },
    { id: "gembokSipp", kunci: "gembokKepalaSipp", bawaan: false },
    { id: "gembokAleta", kunci: "gembokKepalaAleta", bawaan: false },
  ];

  it.each(STATIS)("$id: kunci tak ada = bawaan ($bawaan); dibalik menulis $kunci, dibalik lagi kembali", async ({ id, kunci, bawaan }) => {
    const gudang = new Gudang({});
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    await tunggu(60);
    expect(p.kotak(id).checked, `${id} awal`).toBe(bawaan);
    p.balik(id);
    await sampai(() => gudang.terakhir(kunci) === !bawaan, `${kunci} ditulis ${!bawaan}`);
    p.balik(id);
    await sampai(() => gudang.terakhir(kunci) === bawaan, `${kunci} kembali ${bawaan}`);
  });

  it.each(STATIS)("$id: nilai tersimpan dilukiskan oleh centangnya", async ({ id, kunci, bawaan }) => {
    const gudang = new Gudang({ [kunci]: !bawaan });
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    await tunggu(60);
    expect(p.kotak(id).checked, `${id} dengan ${kunci}=${!bawaan}`).toBe(!bawaan);
  });

  it.each(STATIS)("$id: penyimpanan menolak menulis -> centang KEMBALI dan kabar gagal tampil", async ({ id, bawaan }) => {
    const gudang = new Gudang({});
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    await tunggu(60);
    const sebelum = gudang.tulisan.length;
    gudang.menolak = true;
    p.balik(id);
    await sampai(() => p.kotak(id).checked === bawaan, `${id} kembali ke ${bawaan}`);
    expect(gudang.tulisan.length).toBe(sebelum);
    expect(p.d.querySelector("[data-gagal-simpan]")).not.toBeNull();
  });

  it("ujiIzinkanNyata (Super Admin, tampilan Baru): menulis ujiIzinkanNyata; menolak -> kembali", async () => {
    const gudang = new Gudang({ ujiTampilan: "baru" });
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    await tunggu(60);
    expect(p.kotak("ujiIzinkanNyata").checked).toBe(false);
    p.balik("ujiIzinkanNyata");
    await sampai(() => gudang.terakhir("ujiIzinkanNyata") === true, "ujiIzinkanNyata true");
    gudang.menolak = true;
    p.balik("ujiIzinkanNyata");
    await sampai(() => p.kotak("ujiIzinkanNyata").checked === true, "centang kembali true");
  });

  it("tiga pengalih tampilan menulis ujiTampilan lama|baru|ui", async () => {
    const gudang = new Gudang({});
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    await tunggu(60);
    for (const [id, nilai] of [["ujiUi", "ui"], ["ujiBaru", "baru"], ["ujiLama", "lama"]] as const) {
      p.d.getElementById(id)!.click();
      await sampai(() => gudang.data.ujiTampilan === nilai, `ujiTampilan ${nilai}`);
    }
  });

  it("120 saklar fitur ide: tiap kotak menulis kodenya di peta ujiFitur (dan mati menghapusnya)", async () => {
    const gudang = new Gudang({ ujiTampilan: "ui" });
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    await tunggu(60);
    (p.d.getElementById("ujiFiturLaci") as HTMLDetailsElement).open = true;
    p.d.getElementById("ujiFiturLaci")!.dispatchEvent(new p.w.Event("toggle"));
    const kotakFitur = await sampai(() => {
      const semua = Array.from(p.d.querySelectorAll<HTMLInputElement>("#ujiFiturDaftar input[data-kode]"));
      return semua.length === 120 ? semua : null;
    }, "120 kotak fitur tersusun");
    for (const k of kotakFitur) {
      const kode = k.getAttribute("data-kode")!;
      k.checked = true;
      k.dispatchEvent(new p.w.Event("change", { bubbles: true }));
      await sampai(() => (gudang.data.ujiFitur as Record<string, boolean> | undefined)?.[kode] === true, `${kode} menyala`, 1500);
    }
    expect(Object.keys(gudang.data.ujiFitur as object)).toHaveLength(120);
    for (const k of kotakFitur.slice(0, 3)) {
      k.checked = false;
      k.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    }
    await sampai(() => Object.keys(gudang.data.ujiFitur as object).length === 117, "tiga kode dihapus dari peta");
  });

  it("tidak ada kotak centang di popup yang luput dari tabel audit (Super Admin, UI Baru)", async () => {
    const gudang = new Gudang({ ujiTampilan: "ui" });
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    await tunggu(150);
    const dikenal = new Set([
      ...STATIS.map((s) => s.id),
      "ujiIzinkanNyata", // sendiri di atas
      "sembunyikanTeknis", // bagian C
      "bawaanPanel-aleta", "bawaanPanel-sipp", "bawaanPanel-abt", // bagian C
    ]);
    // Pilihan untuk tombol "Kembalikan posisi" (popup-13) - bukan saklar tersimpan.
    const bukanSaklar = new Set(["tbPosisi-panel", "tbPosisi-widget"]);
    const ada = Array.from(p.d.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      .map((k) => k.id)
      .filter((id) => id && !id.startsWith("uji-fitur-"));
    expect(ada.filter((id) => !dikenal.has(id) && !bukanSaklar.has(id)), "kotak centang baru: masukkan ke tabel audit").toEqual([]);
    for (const id of dikenal) expect(ada, `${id} hilang dari popup`).toContain(id);
  });
});

// ============================================================================
describe("B. ujung ke ujung: popup membalik, halaman SIPP (pembaca) mengikuti", () => {
  it("aktif: dimatikan -> panel ALETA hilang dari halaman; dinyalakan -> kembali, tanpa memuat ulang", async () => {
    const { halaman, popup } = await pasangan({});
    await sampai(() => halaman.panel(), "panel lahir");
    expect(await halaman.w.sedangAktif()).toBe(true);
    popup.balik("aktif");
    await sampai(() => halaman.panel() === null, "panel hilang");
    expect(await halaman.w.sedangAktif()).toBe(false);
    popup.balik("aktif");
    await sampai(() => halaman.panel(), "panel kembali");
    expect(await halaman.w.sedangAktif()).toBe(true);
  });

  it("aktif tersimpan false sejak awal: panel tidak pernah lahir", async () => {
    const { halaman } = await pasangan({ aktif: false });
    await tunggu(300);
    expect(halaman.panel()).toBeNull();
    expect(await halaman.w.sedangAktif()).toBe(false);
  });

  it("tandaiHalaman: bawaan menyala; dimatikan/dinyalakan dari popup dibaca pembaca seketika", async () => {
    const { halaman, popup } = await pasangan({});
    expect(await halaman.w.sedangMenandai()).toBe(true);
    popup.balik("tandaiHalaman");
    await sampai(async () => (await halaman.w.sedangMenandai()) === false, "penanda mati");
    popup.balik("tandaiHalaman");
    await sampai(async () => (await halaman.w.sedangMenandai()) === true, "penanda menyala");
  });

  it("tandaiHalaman: kunci DIHAPUS (bukan false) kembali ke bawaan MENYALA, bukan mati diam-diam", async () => {
    const { gudang, halaman } = await pasangan({ tandaiHalaman: false });
    expect(await halaman.w.sedangMenandai()).toBe(false);
    await gudang.api().remove("tandaiHalaman");
    await tunggu(50);
    expect(await halaman.w.sedangMenandai()).toBe(true);
  });

  it("sisipJadwal: bawaan mati; dinyalakan dari popup dibaca pembaca; kunci dihapus = mati", async () => {
    const { gudang, halaman, popup } = await pasangan({});
    expect(await halaman.w.sedangMenyisipkan()).toBe(false);
    popup.balik("sisipJadwal");
    await sampai(async () => (await halaman.w.sedangMenyisipkan()) === true, "sisip menyala");
    await gudang.api().remove("sisipJadwal");
    await sampai(async () => (await halaman.w.sedangMenyisipkan()) === false, "sisip kembali bawaan mati");
  });

  it("checklistMilestone: widget lahir saat dinyalakan dari popup, hilang saat dimatikan; induk 'aktif' mati = tidak ada widget", async () => {
    const { halaman, popup } = await pasangan({});
    await tunggu(200);
    expect(halaman.widget()).toBeNull();
    popup.balik("checklistMilestone");
    await sampai(() => halaman.widget(), "widget lahir");
    popup.balik("checklistMilestone");
    await sampai(() => halaman.widget() === null, "widget hilang");
    popup.balik("checklistMilestone");
    await sampai(() => halaman.widget(), "widget lahir lagi");
    popup.balik("aktif");
    await sampai(() => halaman.widget() === null, "widget ikut hilang saat induk mati");
  });

  it("modeLatihan: dinyalakan dari popup -> halaman menahan penulisan; dimatikan -> lepas", async () => {
    const { halaman, popup } = await pasangan({});
    await sampai(() => halaman.w.alatLatihanNyala() === false, "latihan mati awal");
    popup.balik("modeLatihan");
    await sampai(() => halaman.w.alatLatihanNyala() === true, "latihan menyala");
    popup.balik("modeLatihan");
    await sampai(() => halaman.w.alatLatihanNyala() === false, "latihan mati");
  });

  it("ujiTampilan + ujiIzinkanNyata: pengalih menentukan mode coba; 'Izinkan tindakan nyata' melepasnya", async () => {
    const { halaman, popup } = await pasangan({});
    expect(halaman.w.alatUjiMode()).toBe("lama");
    expect(halaman.w.alatCobaAktif()).toBe(false);
    popup.d.getElementById("ujiBaru")!.click();
    await sampai(() => halaman.w.alatUjiMode() === "baru", "Baru");
    expect(halaman.w.alatCobaAktif()).toBe(true);
    popup.balik("ujiIzinkanNyata");
    await sampai(() => halaman.w.alatCobaAktif() === false, "coba lepas");
    popup.balik("ujiIzinkanNyata");
    await sampai(() => halaman.w.alatCobaAktif() === true, "coba menahan lagi");
    popup.d.getElementById("ujiLama")!.click();
    await sampai(() => halaman.w.alatUjiMode() === "lama" && halaman.w.alatCobaAktif() === false, "kembali Lama");
  });

  it("ujiFitur: kotak fitur ide dibaca alatFiturNyala di halaman - hanya selama tampilan bukan Lama", async () => {
    const { halaman, popup } = await pasangan({ ujiTampilan: "ui" });
    expect(halaman.w.alatFiturNyala("sipp-5")).toBe(false);
    (popup.d.getElementById("ujiFiturLaci") as HTMLDetailsElement).open = true;
    popup.d.getElementById("ujiFiturLaci")!.dispatchEvent(new popup.w.Event("toggle"));
    await sampai(() => popup.d.getElementById("uji-fitur-sipp-5"), "kotak sipp-5");
    popup.balik("uji-fitur-sipp-5");
    await sampai(() => halaman.w.alatFiturNyala("sipp-5") === true, "sipp-5 menyala di halaman");
    expect(halaman.w.alatFiturNyala("sipp-6")).toBe(false);
    popup.d.getElementById("ujiLama")!.click();
    await sampai(() => halaman.w.alatFiturNyala("sipp-5") === false, "Lama mematikan semua fitur");
  });

  it("sembunyikanTeknis (UI Baru): bawaan menyala; popup membalik -> alatTeknisTersembunyi di halaman; kunci dihapus = bawaan", async () => {
    const { gudang, halaman, popup } = await pasangan({ ujiTampilan: "ui" });
    await sampai(() => popup.d.getElementById("sembunyikanTeknis"), "saklar teknis tersusun");
    await sampai(() => halaman.w.alatTeknisTersembunyi() === true, "bawaan tersembunyi");
    popup.balik("sembunyikanTeknis");
    await sampai(() => gudang.terakhir("sembunyikanTeknis") === false, "false tertulis");
    await sampai(() => halaman.w.alatTeknisTersembunyi() === false, "penjelasan teknis tampil");
    await gudang.api().remove("sembunyikanTeknis");
    await sampai(() => halaman.w.alatTeknisTersembunyi() === true, "dihapus = bawaan tersembunyi");
  });

  it("panelBawaanTampil (UI Baru): kotak per situs menulis peta yang dibaca alatBawaanTampilBerlaku", async () => {
    const { gudang, halaman, popup } = await pasangan({ ujiTampilan: "ui" });
    await sampai(() => popup.d.getElementById("bawaanPanel-sipp"), "kotak panel bawaan tersusun");
    expect(popup.kotak("bawaanPanel-sipp").checked).toBe(true);
    popup.balik("bawaanPanel-sipp");
    await sampai(() => (gudang.data.panelBawaanTampil as Record<string, boolean> | undefined)?.sipp === false, "peta lokal tertulis");
    const b = halaman.w.alatBawaanTampilBerlaku(gudang.data.panelBawaanTampil, null);
    // Bawaan panel: portal tertutup (lencana), SIPP dan ABT terbuka.
    expect(b).toMatchObject({ aleta: false, sipp: false, abt: true, sumber: "lokal" });
  });

  it("senyap (popup-12): tombol popup menulis senyapSampai yang dibaca alatSenyapAktif; berakhir dengan sendirinya", async () => {
    const { gudang, halaman } = await pasangan({ ujiTampilan: "ui", ujiFitur: { "popup-12": true } });
    expect(halaman.w.alatSenyapAktif()).toBe(false);
    await gudang.api().set({ senyapSampai: Date.now() + 60 * 60 * 1000 });
    await sampai(() => halaman.w.alatSenyapAktif() === true, "senyap menyala");
    await gudang.api().set({ senyapSampai: Date.now() - 1000 });
    await sampai(() => halaman.w.alatSenyapAktif() === false, "waktu lewat = tidak senyap");
    await gudang.api().remove("senyapSampai");
    await sampai(() => halaman.w.alatSenyapAktif() === false, "kunci dihapus = tidak senyap");
  });

  it("suntingLangsungAbt: kunci yang ditulis popup sama dengan yang dibaca pembaca di panel-alat.js", async () => {
    const { halaman, popup } = await pasangan({});
    expect(await halaman.w.alatSuntingLangsung()).toBe(false);
    popup.balik("suntingLangsungAbt");
    await sampai(async () => (await halaman.w.alatSuntingLangsung()) === true, "sunting menyala");
    popup.balik("suntingLangsungAbt");
    await sampai(async () => (await halaman.w.alatSuntingLangsung()) === false, "sunting mati");
  });
});

// ============================================================================
describe("D. halaman ABT: pembaca cetakTigaBerkas dan aktif", () => {
  it("cetakTigaBerkas: popup menyalakan -> saklarCetakSekarang() membaca true seketika; dimatikan/dihapus -> false", async () => {
    const gudang = new Gudang({});
    const abt = bukaAbt(gudang);
    const popup = bukaPopup(gudang, "Super Admin");
    await popup.siap();
    expect(await abt.w.saklarCetakSekarang()).toBe(false);
    popup.balik("cetakTigaBerkas");
    await sampai(async () => (await abt.w.saklarCetakSekarang()) === true, "cetak tiga menyala");
    popup.balik("cetakTigaBerkas");
    await sampai(async () => (await abt.w.saklarCetakSekarang()) === false, "cetak tiga mati");
    await gudang.api().set({ cetakTigaBerkas: true });
    await gudang.api().remove("cetakTigaBerkas");
    expect(await abt.w.saklarCetakSekarang(), "dihapus = bawaan mati").toBe(false);
  });

  it("cetakTigaBerkas: penyimpanan yang tak terbaca dianggap MATI (yang ragu tidak menerbitkan tiga berkas)", async () => {
    const gudang = new Gudang({ cetakTigaBerkas: true });
    const abt = bukaAbt(gudang);
    expect(await abt.w.saklarCetakSekarang()).toBe(true);
    abt.w.chrome.storage.local.get = async () => {
      throw new Error("konteks mati");
    };
    expect(await abt.w.saklarCetakSekarang()).toBe(false);
  });

  it("aktif: sedangAktif() ABT mengikuti popup; kunci dihapus = bawaan menyala", async () => {
    const gudang = new Gudang({});
    const abt = bukaAbt(gudang);
    const popup = bukaPopup(gudang, "Super Admin");
    await popup.siap();
    expect(await abt.w.sedangAktif()).toBe(true);
    popup.balik("aktif");
    await sampai(async () => (await abt.w.sedangAktif()) === false, "ABT: aktif mati");
    await gudang.api().remove("aktif");
    expect(await abt.w.sedangAktif()).toBe(true);
  });
});

// ============================================================================
describe("E. butir 13: blok 'tampilan uji' Super Admin bawaannya diciutkan, dengan ringkasan satu baris", () => {
  it("markup: <details> TANPA open; seluruh isi lama (pengalih, izinkan nyata, laci fitur ide) ada di dalamnya", () => {
    const dom = new JSDOM(POPUP_HTML.replace(/<script[\s\S]*?<\/script>/g, ""));
    terbuka.push(dom);
    const d = dom.window.document;
    const laci = d.getElementById("ujiBagianLaci") as HTMLDetailsElement;
    expect(laci.tagName).toBe("DETAILS");
    expect(laci.open).toBe(false);
    expect(laci.hasAttribute("open")).toBe(false);
    expect(laci.parentElement!.id).toBe("bagianUji");
    expect(laci.firstElementChild!.id).toBe("ujiRingkasan");
    for (const id of ["ujiLama", "ujiBaru", "ujiUi", "ujiKet", "ujiNyataBaris", "ujiIzinkanNyata", "ujiFiturLaci", "ujiSemuaNyala", "ujiSemuaMati", "ujiFiturDaftar"]) {
      expect(laci.contains(d.getElementById(id)), id).toBe(true);
    }
    // Mode latihan TIDAK ikut diciutkan: ia milik Admin juga dan saklar keselamatan.
    expect(laci.contains(d.getElementById("bagianLatihan"))).toBe(false);
  });

  it("Super Admin: terlihat tetapi tertutup; ringkasan menyebut tampilan dan tindakan nyata, dan ikut berubah", async () => {
    const gudang = new Gudang({});
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    const laci = p.d.getElementById("ujiBagianLaci") as HTMLDetailsElement;
    const ringkasan = p.d.getElementById("ujiRingkasan") as HTMLElement;
    expect((p.d.getElementById("bagianUji") as HTMLElement).hidden).toBe(false);
    expect(laci.open).toBe(false);
    expect(ringkasan.textContent).toBe("Tampilan uji · Lama");
    expect(ringkasan.hasAttribute("data-nyata")).toBe(false);

    p.d.getElementById("ujiBaru")!.click(); // tombol tetap berfungsi walau laci tertutup
    await sampai(() => ringkasan.textContent === "Tampilan uji · Baru · tindakan nyata mati", "ringkasan Baru");
    p.balik("ujiIzinkanNyata");
    await sampai(() => ringkasan.textContent === "Tampilan uji · Baru · tindakan nyata NYALA", "ringkasan nyata");
    expect(ringkasan.getAttribute("data-nyata")).toBe("ya");
    p.d.getElementById("ujiLama")!.click();
    await sampai(() => ringkasan.textContent === "Tampilan uji · Lama", "kembali Lama");
    expect(ringkasan.hasAttribute("data-nyata")).toBe(false);
    expect(laci.open, "tidak pernah terbuka sendiri").toBe(false);
  });

  it("keadaan tersimpan (UI Baru + nyata) langsung tampil di ringkasan saat popup dibuka, laci tetap tertutup", async () => {
    const gudang = new Gudang({ ujiTampilan: "ui", ujiIzinkanNyata: true });
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    const ringkasan = p.d.getElementById("ujiRingkasan") as HTMLElement;
    await sampai(() => ringkasan.textContent === "Tampilan uji · UI Baru · tindakan nyata NYALA", "ringkasan tersimpan");
    expect((p.d.getElementById("ujiBagianLaci") as HTMLDetailsElement).open).toBe(false);
  });

  it("peran lain: blok tetap tersembunyi seluruhnya", async () => {
    const gudang = new Gudang({});
    const p = bukaPopup(gudang, "Hakim");
    await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal");
    await tunggu(120);
    expect((p.d.getElementById("bagianUji") as HTMLElement).hidden).toBe(true);
  });
});

// ============================================================================
describe("C. peta fitur ide: tiap kode punya pembaca, atau tercatat belum dibangun", () => {
  // Kode yang SAKLARNYA ada di popup tetapi belum ada fiturnya (tidak ada pembaca
  // satu pun di berkas ekstensi). Menyalakannya tidak mengubah apa pun - dijaga
  // di sini supaya (a) daftar ini tidak membesar diam-diam, dan (b) fitur yang
  // kelak dibangun membuat kodenya KELUAR dari daftar (uji gagal mengingatkan).
  const BELUM_DIBANGUN = [
    "sipp-3", "sipp-4", "sipp-9", "sipp-12", "sipp-15", "sipp-18", "sipp-19", "sipp-20", "sipp-24", "sipp-25", "sipp-26", "sipp-28",
    "portal-15", "portal-17", "portal-21", "portal-24", "portal-30",
    "popup-25", "popup-28", "popup-29", "popup-30",
  ];

  const BERKAS = ["popup.js", "panel-alat.js", "konten.js", "abt.js", "aleta.js", "checklist.js", "latar.js"];
  // 12OKT-N: daftar FITUR_BELUM_ADA di popup.js hanya menyebut kodenya untuk keterangan "belum ada" -
  // itu bukan pembaca fitur, jadi blok berlabelnya dibuang sebelum mencari pembaca.
  const isi = Object.fromEntries(
    BERKAS.map((b) => [b, baca(b).replace(/const FITUR_BELUM_ADA = new Set\(\[[\s\S]*?\]\);/, "")])
  );
  const kodeDaftar = [...DAFTAR_FITUR.matchAll(/"kode":"([a-z]+-\d+)"/g)].map((m) => m[1]);

  it("daftar-fitur.js memuat 120 kode", () => {
    expect(kodeDaftar).toHaveLength(120);
  });

  // 12OKT-N (keputusan 4): 21 saklar tanpa pembaca tetap tampil di popup tetapi diberi keterangan "belum ada".
  it("popup.js menyimpan daftar 'belum ada' yang SAMA dengan BELUM_DIBANGUN (tidak ada daftar kedua yang melenceng)", () => {
    const blok = /const FITUR_BELUM_ADA = new Set\(\[([\s\S]*?)\]\)/.exec(POPUP_JS);
    expect(blok).not.toBeNull();
    const kode = [...blok![1].matchAll(/"([a-z]+-\d+)"/g)].map((m) => m[1]);
    expect(kode.sort()).toEqual([...BELUM_DIBANGUN].sort());
    expect(BELUM_DIBANGUN).toHaveLength(21);
  });

  it("popup (Super Admin): tepat 21 kotak bertanda 'belum ada' - kotaknya tetap ada dan tetap dapat dinyalakan; yang sudah ada fiturnya tidak bertanda", async () => {
    const gudang = new Gudang({ ujiTampilan: "ui" });
    const p = bukaPopup(gudang, "Super Admin");
    await p.siap();
    (p.d.getElementById("ujiFiturLaci") as HTMLDetailsElement).open = true;
    p.d.getElementById("ujiFiturLaci")!.dispatchEvent(new p.w.Event("toggle"));
    await sampai(() => p.d.querySelectorAll("#ujiFiturDaftar input[data-kode]").length === 120, "120 kotak fitur tersusun");
    const belum = Array.from(p.d.querySelectorAll<HTMLElement>("#ujiFiturDaftar .uji-baris[data-belum-ada]"));
    const kodeBelum = belum.map((b) => b.querySelector("input")!.getAttribute("data-kode")!);
    expect(kodeBelum.sort()).toEqual([...BELUM_DIBANGUN].sort());
    for (const b of belum) {
      expect(b.querySelector(".uji-belum")?.textContent).toContain("belum ada");
      expect(b.title).toMatch(/belum dibangun/);
    }
    // Yang punya pembaca: tanpa keterangan.
    const ada = p.d.querySelector("#uji-fitur-sipp-5")!.closest(".uji-baris")!;
    expect(ada.querySelector(".uji-belum")).toBeNull();
    // Kodenya tidak diubah: kotak "belum ada" tetap menulis kodenya seperti saklar lain.
    const kotak = p.d.getElementById("uji-fitur-sipp-3") as HTMLInputElement;
    kotak.checked = true;
    kotak.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    await sampai(() => (gudang.data.ujiFitur as Record<string, boolean> | undefined)?.["sipp-3"] === true, "sipp-3 tertulis");
  });

  it("kode yang disebut di berkas pembaca (selain daftar-fitur.js) = 120 - belum dibangun; sisanya tidak punya pembaca", () => {
    const disebut = (k: string) => BERKAS.some((b) => new RegExp(`["'\`]${k}["'\`]`).test(isi[b]));
    const tanpaPembaca = kodeDaftar.filter((k) => !disebut(k));
    expect(tanpaPembaca.sort()).toEqual([...BELUM_DIBANGUN].sort());
  });

  it("alatFiturNyala/fiturPopupNyala (aturan inti) dijalankan: Lama mematikan semua, profil peran menyaring", async () => {
    const { w } = bukaSipp(new Gudang({ ujiTampilan: "lama", ujiFitur: { "sipp-5": true } }));
    await w.alatMuatUji();
    expect(w.alatFiturNyala("sipp-5")).toBe(false);
    const g2 = bukaSipp(new Gudang({ ujiTampilan: "ui", ujiFitur: { "sipp-5": true, "sipp-6": false } }));
    await g2.w.alatMuatUji();
    expect(g2.w.alatFiturNyala("sipp-5")).toBe(true);
    expect(g2.w.alatFiturNyala("sipp-6")).toBe(false);
    expect(g2.w.alatFiturNyala("tak-ada-99")).toBe(false);
  });
});
