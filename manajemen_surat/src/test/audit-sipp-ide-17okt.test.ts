// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * AUDIT 17 OKT 2026 - EKSTENSI ALETA DI SIPP, POPUP, DAN WIDGET (1.201-1.205)
 * ============================================================================
 *
 * Tiap uji di sini MERAH pada a2e3618 (rilis 1.205.0) dan hijau sesudah
 * perbaikannya. Skrip ekstensi dijalankan SUNGGUHAN di jsdom.
 *
 *   A. Detak pita L1 (tiap detik) menulis ulang teks yang sama - pengamat
 *      konten.js menganggapnya perubahan SIPP dan menyegarkan panel tiap detik.
 *   B. L1/M1 yang dimuat saat ALETA MATI tidak pernah memasang pengamatnya:
 *      dinyalakan dari popup, jendela SIPP sesudahnya tanpa pita/penjaga.
 *   C. Berpindah Lama <-> UI Baru (aleta-uji-berubah) tidak diikuti L1/M1/M2;
 *      L2 (penanda) tampil dan meminta portal di Tampilan Lama.
 *   D. Judul tombol "Buka di ABT/ALETA" tetap "Nomor perkara belum terbaca"
 *      sesudah nomornya terbaca.
 *   E. Serah terima J01 ke ABT hilang di halaman masuk ABT / halaman APS.
 *   F. Saklar penanda SIPP (ideL2*) tidak ikut setelan per akun.
 *   G. Widget kehadiran menyebut "Tidak ada sidang Anda hari ini" saat jadwal
 *      sidang tidak terbaca (portal available:false).
 *   H. Penanda "Dokumen e-Court belum diverifikasi" masih "perlu dicek" padahal
 *      dasarnya sudah dipastikan pengguna (keputusan 17 Okt butir 31).
 */

const AKAR = path.resolve(__dirname, "../../..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8").replace(/\r\n/g, "\n");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

const NOMOR = "565/Pdt.G/2026/PA.Dgl";
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type Jendela = any;

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

/** Halaman SIPP/ABT tiruan + chrome.storage yang menyiarkan onChanged + fetch penghitung. */
function buka(html: string, o: { url: string; simpanan?: Record<string, unknown>; skrip: string[]; mode?: () => string }) {
  const dom = new JSDOM(html, { url: o.url, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as Jendela;
  const simpanan: Record<string, unknown> = polos({ ...(o.simpanan || {}) });
  const pendengar: Array<(u: Ubah, wil: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.0" }) },
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
          setTimeout(() => pendengar.forEach((f) => f(polos(ubah), "local")), 0);
        },
        remove: async (kunci: string | string[]) => {
          const ubah: Ubah = {};
          for (const k of [kunci].flat()) {
            ubah[k] = { oldValue: simpanan[k] };
            delete simpanan[k];
          }
          setTimeout(() => pendengar.forEach((f) => f(ubah, "local")), 0);
        },
      },
      onChanged: { addListener: (f: (u: Ubah, wil: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    minta.push(String(alamat));
    return { ok: true, status: 200, json: async () => ({ ok: true, data: { tersedia: true, boleh: [], perkara: {} } }) };
  };
  if (o.mode) w.alatUjiMode = o.mode;
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  for (const s of o.skrip) vm.runInContext(baca(s), ctx, { filename: s });
  return { w, d: w.document as Document, simpanan, minta, ubah: (isi: Record<string, unknown>) => w.chrome.storage.local.set(isi) };
}

/** Panel ALETA (bagian Putusan otomatis) + jendela Putusan Akhir SIPP 7.0.4. */
const PANEL_PUTUSAN = `<div id="aleta-panel-sipp" class="aleta-panel"><div class="aleta-bagian" data-kunci="isiPutusan"><div class="aleta-bagian-isi">
<button class="aleta-permintaan-tombol" type="button">Ambil usulan dari ALETA</button>
<div class="aleta-unggah-naskah"><div class="aleta-tetap-kaki"><input type="file" accept=".rtf,.docx,.doc,.pdf" class="aleta-berkas"></div></div>
<div class="aleta-isian-putusan"></div></div></div></div>`;
const FORM_PUTUSAN = `<div id="popup_form" class="popup"><div id="form_pop">
<form id="frm_putusan" method="post" action="http://192.168.10.10/SIPP/managePutusanAkhir/validateInput"><table><tbody>
<tr><td id="first-child">Tanggal Putusan<font color="red">*</font></td><td><input id="tgl_putusan" name="tgl_putusan" value=""></td></tr>
<tr><td id="first-child">Keterangan</td><td><textarea id="keterangan" name="keterangan"></textarea></td></tr>
<tr><td colspan="2"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
</tbody></table></form></div></div>`;
const FORM_TUNDA = `<div id="popup_form_2nd" class="popup"><div id="form_pop_2nd">
<form id="frm_tunda_jadwal_sidang" method="post" action="http://192.168.10.10/SIPP/jadwal_sidang_c/validateTunda"><table><tbody>
<tr><td id="first-child">Tanggal Sidang<font color="red">*</font></td><td><input name="tgl_sidang" value=""></td></tr>
<tr><td colspan="2"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
</tbody></table></form></div></div>`;
const URL_DETIL = "http://192.168.10.10/SIPP/perkara_detil_agama/aWQ9MTAxMTc";

// ============================================================================
// A. Detak L1 tidak boleh memicu penyegaran konten.js tiap detik
// ============================================================================
describe("A. detak pita L1 dan pengamat konten.js", () => {
  const KONTEN = baca("konten.js");
  const potong = (nama: string) => {
    const i = KONTEN.indexOf(`function ${nama}(`);
    const j = KONTEN.indexOf("\n}\n", i);
    return KONTEN.slice(i, j + 2);
  };
  // Penyaring pengamat konten.js APA ADANYA (elemenAleta + perubahanDariAleta).
  const PENYARING = `var PENANDA = "aleta-panel-sipp"; var TANDA = "data-aleta-tanda";\n${potong("elemenAleta")}\n${potong("perubahanDariAleta")}\nwindow.__dariAleta = perubahanDariAleta;`;

  it("jendela Putusan Akhir terbuka: tidak ada 'perubahan SIPP' tiap detik selama petugas diam", async () => {
    const h = buka(`<!doctype html><html><head></head><body>${PANEL_PUTUSAN}${FORM_PUTUSAN}</body></html>`, { url: URL_DETIL, skrip: ["sipp-ide-l1.js"] });
    const ctx = (terbuka[terbuka.length - 1] as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
    vm.runInContext(PENYARING, ctx);
    await sampai(() => h.d.querySelector(".aleta-l1-pita"), "pita L1 terpasang");
    await tunggu(1200);
    let picu = 0;
    new h.w.MutationObserver((daftar: MutationRecord[]) => {
      if (daftar.some((p) => !h.w.__dariAleta(p))) picu += 1;
    }).observe(h.d.body, { childList: true, subtree: true });
    await tunggu(2600);
    expect(picu).toBe(0);
    // Penghitungnya tetap hidup: kolom diisi -> teksnya berubah.
    const sebelum = h.d.querySelector('[data-l1="hitung"]')!.textContent;
    const tgl = h.d.querySelector("#tgl_putusan") as HTMLInputElement;
    tgl.value = "16/10/2026";
    tgl.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    expect(h.d.querySelector('[data-l1="hitung"]')!.textContent).not.toBe(sebelum);
  }, 10000);
});

// ============================================================================
// B. Dimuat saat ALETA mati, lalu dinyalakan dari popup
// ============================================================================
describe("B. L1/M1 dinyalakan sesudah halaman terbuka", () => {
  it("jendela yang dibuka SESUDAH ALETA dinyalakan tetap mendapat pita L1 dan M1", async () => {
    const h = buka(`<!doctype html><html><head></head><body>${PANEL_PUTUSAN}</body></html>`, {
      url: URL_DETIL,
      simpanan: { aktif: false },
      skrip: ["sipp-ide-l1.js", "sipp-ide-m1.js"],
    });
    await tunggu(100);
    await h.ubah({ aktif: true });
    await tunggu(500);
    // Petugas membuka jendela Putusan Akhir dan Tunda Sidang (SIPP: popup_form).
    h.d.body.insertAdjacentHTML("beforeend", FORM_PUTUSAN + FORM_TUNDA);
    await sampai(() => h.d.querySelector(".aleta-l1-pita") && h.d.querySelector(".aleta-m1-pita"), "pita L1 dan M1 sesudah dinyalakan", 2000);
  });
});

// ============================================================================
// C. Lama <-> UI Baru
// ============================================================================
describe("C. Tampilan Lama tidak berubah, dan pindah tampilan diikuti seketika", () => {
  it("UI Baru -> Lama (peristiwa aleta-uji-berubah): sisipan L1, M1, M2 hilang tanpa menunggu SIPP berubah; kembali UI Baru muncul lagi", async () => {
    let mode = "ui";
    const h = buka(`<!doctype html><html><head></head><body>${PANEL_PUTUSAN}${FORM_PUTUSAN}${FORM_TUNDA}</body></html>`, {
      url: URL_DETIL,
      skrip: ["sipp-ide-l1.js", "sipp-ide-m1.js", "sipp-ide-m2.js"],
      mode: () => mode,
    });
    await sampai(() => h.d.querySelector(".aleta-l1-pita") && h.d.querySelector(".aleta-m1-pita") && h.d.documentElement.getAttribute("data-aleta-lencana"), "terpasang di UI Baru");
    mode = "lama";
    h.d.dispatchEvent(new h.w.CustomEvent("aleta-uji-berubah", { detail: { mode: "lama" } }));
    await tunggu(800);
    expect(h.d.querySelector(".aleta-l1")).toBeNull();
    expect(h.d.querySelector(".aleta-m1")).toBeNull();
    expect(h.d.documentElement.hasAttribute("data-aleta-lencana")).toBe(false);
    mode = "ui";
    h.d.dispatchEvent(new h.w.CustomEvent("aleta-uji-berubah", { detail: { mode: "ui" } }));
    await sampai(() => h.d.querySelector(".aleta-l1-pita") && h.d.querySelector(".aleta-m1-pita"), "kembali di UI Baru", 2000);
  });

  it("penanda L2 di Tampilan Lama: tidak digambar dan TIDAK meminta portal", async () => {
    const daftar = `<table id="tablePerkaraAll"><tbody><tr><td>1</td><td>${NOMOR}</td><td>Cerai Gugat</td></tr></tbody></table>`;
    const h = buka(`<!doctype html><html><head><title>SIPP</title></head><body>${daftar}</body></html>`, {
      url: "http://192.168.10.10/SIPP/perkara_list/x",
      skrip: ["sipp-ide-l2.js"],
      mode: () => "lama",
    });
    await tunggu(900);
    expect(h.minta).toEqual([]);
    expect(h.d.querySelector("[data-aleta-l2]")).toBeNull();
  });

  it("penanda L2 di UI Baru tetap meminta portal (pembanding)", async () => {
    const daftar = `<table id="tablePerkaraAll"><tbody><tr><td>1</td><td>${NOMOR}</td><td>Cerai Gugat</td></tr></tbody></table>`;
    const h = buka(`<!doctype html><html><head><title>SIPP</title></head><body>${daftar}</body></html>`, {
      url: "http://192.168.10.10/SIPP/perkara_list/x",
      skrip: ["sipp-ide-l2.js"],
      mode: () => "ui",
    });
    await sampai(() => h.minta.some((a) => a.includes("/sipp-ide-l2")), "permintaan penanda", 2000);
  });
});

// ============================================================================
// D. Judul tombol J01/J02 sesudah nomor terbaca
// ============================================================================
describe("D. tombol Buka di ABT / Buka di ALETA di halaman perkara", () => {
  it("sesudah tab Data Umum termuat, judulnya kembali menerangkan tombolnya", async () => {
    const detil = `<table width="100%" id="submenus"><tr><td><table><tr>
<td id="backlist"><a class="btn btn-default btn-sm" href="/SIPP/perkara">Kembali</a></td></tr></table></td></tr></table><div id="tabs1"></div>`;
    const h = buka(`<!doctype html><html><head></head><body>${detil}</body></html>`, { url: URL_DETIL, skrip: ["sipp-ide-l1.js"] });
    const api = h.w.aletaSippIdeL1;
    api.pasang(h.d);
    const abt = h.d.querySelector('.aleta-l1-submenu [data-l1="abt"]') as HTMLAnchorElement;
    const aleta = h.d.querySelector('.aleta-l1-submenu [data-l1="aleta"]') as HTMLAnchorElement;
    expect(abt.title).toMatch(/belum terbaca/);
    h.d.querySelector("#tabs1")!.innerHTML = `<table><tr><td id="first-child">Nomor Perkara</td><td>${NOMOR}</td></tr></table>`;
    api.pasang(h.d);
    expect(abt.getAttribute("href")).toContain(encodeURIComponent(NOMOR));
    expect(abt.title).not.toMatch(/belum terbaca/);
    expect(abt.title).toMatch(/Buka di ABT/);
    expect(aleta.title).toMatch(/Buka di ALETA/);
  });
});

// ============================================================================
// E. Serah terima J01 lewat halaman masuk ABT
// ============================================================================
describe("E. J01 'Buka di ABT' saat sesi ABT habis", () => {
  const KUNCI = "sippIdeL1SerahAbt";

  it("halaman masuk ABT (alamat berhash aleta-bd): nomornya disimpan untuk sesudah masuk, tidak dibuang", async () => {
    const h = buka(`<!doctype html><html><head></head><body><form><input type="password" name="password"></form></body></html>`, {
      url: `http://192.168.10.10/aps_badilag/login#aleta-bd=${encodeURIComponent(NOMOR)}`,
      skrip: ["sipp-ide-l1.js"],
    });
    await tunggu(300);
    const s = h.simpanan[KUNCI] as { nomor?: string; saat?: number } | undefined;
    expect(s && s.nomor).toBe(NOMOR);
    expect(Date.now() - Number(s && s.saat)).toBeLessThan(5000);
  });

  it("halaman APS sesudah masuk (/aps_badilag/main, bukan ABT): serah terima yang tersimpan tidak dihabiskan", async () => {
    const saat = Date.now();
    const h = buka(`<!doctype html><html><head></head><body><div id="navbar"></div></body></html>`, {
      url: "http://192.168.10.10/aps_badilag/main",
      simpanan: { [KUNCI]: { nomor: NOMOR, saat } },
      skrip: ["sipp-ide-l1.js"],
    });
    await tunggu(300);
    expect((h.simpanan[KUNCI] as { nomor?: string } | undefined)?.nomor).toBe(NOMOR);
  });
});

// ============================================================================
// F. Saklar penanda SIPP per akun (popup)
// ============================================================================
describe("F. saklar penanda SIPP (ideL2*) ikut setelan per akun", () => {
  const popupHtml = baca("popup.html").replace(/<script[\s\S]*?<\/script>/g, "");
  const popupJs = baca("popup.js");
  const daftarFiturJs = baca("daftar-fitur.js");
  const latarJs = baca("latar.js");
  const ideL2Js = baca("popup-ide-l2.js");

  type Orang = { nama: string; peran: string; kode: string; kunci: string };
  const HAKIM: Orang = { nama: "Uji Hakim", peran: "Hakim", kode: "hakim", kunci: "kk-hakim" };
  const JS: Orang = { nama: "Uji JS", peran: "Jurusita", kode: "juru-sita", kunci: "kk-js" };

  function bukaPopup(orang: Orang, simpanan: Record<string, unknown>) {
    const dom = new JSDOM(popupHtml, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
    terbuka.push(dom);
    const w = dom.window as Jendela;
    if (!("asalPortal" in simpanan)) simpanan.asalPortal = "http://192.168.10.10/aleta";
    const pendengar: Array<(u: Record<string, { newValue?: unknown }>, t: string) => void> = [];
    w.chrome = {
      runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.0", host_permissions: [] }), sendMessage: async () => ({ ok: true }) },
      storage: {
        local: {
          get: async (kunci?: string | string[] | null) => {
            const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
            const hasil: Record<string, unknown> = {};
            for (const x of daftar) if (x in simpanan) hasil[x] = polos(simpanan[x]);
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => {
            const ubah: Record<string, { newValue?: unknown }> = {};
            for (const [k, v] of Object.entries(polos(isi))) {
              simpanan[k] = v;
              ubah[k] = { newValue: v };
            }
            for (const f of pendengar.slice()) f(ubah, "local");
          },
          remove: async (kunci: string | string[]) => {
            const ubah: Record<string, { newValue?: unknown }> = {};
            for (const k of [kunci].flat()) {
              delete simpanan[k];
              ubah[k] = {};
            }
            for (const f of pendengar.slice()) f(ubah, "local");
          },
        },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener: (f: (u: Record<string, { newValue?: unknown }>, t: string) => void) => void pendengar.push(f) },
      },
    };
    w.fetch = async (alamat: string) => {
      if (String(alamat).includes("info=siapa")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, data: { pengguna: { nama: orang.nama, peran: orang.peran, kunci: orang.kunci, golongan: { kode: orang.kode, semua: [orang.kode] } }, versi: "1.205.0" } }),
        };
      }
      return { ok: true, status: 200, url: String(alamat), json: async () => ({ ok: true, data: {} }) };
    };
    const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
    vm.runInContext(daftarFiturJs, ctx, { filename: "daftar-fitur.js" });
    vm.runInContext(popupJs, ctx, { filename: "popup.js" });
    vm.runInContext(ideL2Js, ctx, { filename: "popup-ide-l2.js" });
    return { w, d: w.document as Document };
  }
  async function tenang(p: { d: Document }) {
    await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
    await tunggu(80);
  }

  it("Hakim mematikan 'Potensi verstek'; Juru Sita di PC yang sama mulai dari bawaan; Hakim masuk lagi = tetap mati", async () => {
    const gudang: Record<string, unknown> = {};
    const a = bukaPopup(HAKIM, gudang);
    await tenang(a);
    const k = a.d.getElementById("ideL2Verstek") as HTMLInputElement;
    k.checked = false;
    k.dispatchEvent(new a.w.Event("change", { bubbles: true }));
    await sampai(() => gudang.ideL2Verstek === false, "saklar tersimpan");
    await sampai(() => (gudang["pengaturanAkun:kk-hakim|hakim"] as any)?.nilai?.ideL2Verstek === false, "salinan akun hakim memuat saklar penanda");
    a.w.close();

    const b = bukaPopup(JS, gudang);
    await tenang(b);
    expect(gudang.ideL2Verstek).not.toBe(false);
    expect((b.d.getElementById("ideL2Verstek") as HTMLInputElement).checked).toBe(true);
    b.w.close();

    const c = bukaPopup(HAKIM, gudang);
    await tenang(c);
    expect(gudang.ideL2Verstek).toBe(false);
  });

  it("daftar kunci setelan akun popup.js = latar.js, dan memuat semua saklar penanda SIPP", () => {
    const ambil = (s: string) => {
      const m = /const KUNCI_SETELAN_AKUN = \[([\s\S]*?)\];/.exec(s);
      return (m![1].match(/"[^"]+"/g) || []).map((x) => x.slice(1, -1));
    };
    const kunciIde = Array.from(ideL2Js.matchAll(/^\s{4}(ideL2\w*): \["(ideL2\w*)"/gm)).map((m) => m[2]);
    expect(kunciIde.length).toBe(14);
    expect(ambil(popupJs)).toEqual(ambil(latarJs));
    for (const k of kunciIde) expect(ambil(popupJs), k).toContain(k);
  });
});

// ============================================================================
// G. Widget kehadiran saat jadwal tidak terbaca
// ============================================================================
describe("G. widget kehadiran: jadwal sidang tidak terbaca bukan 'tidak ada sidang'", () => {
  const SUMBER_ALAT = baca("panel-alat.js");
  const SUMBER_CHECKLIST = baca("checklist.js");
  const API_KH = "/aleta/api/aleta-ecourt/antrian/kehadiran-saya";

  function bukaWidget(jawabKh: unknown) {
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
      url: "http://192.168.10.10/SIPP/detil_perkara_agama",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    } as ConstructorParameters<typeof JSDOM>[1]) as JSDOM & { getInternalVMContext(): vm.Context };
    terbuka.push(dom);
    const w = dom.window as Jendela;
    const simpanan: Record<string, unknown> = { posisiChecklistSipp: { kecil: false }, checklistMilestone: true, widgetKehadiran: true, ujiTampilan: "ui" };
    // 21 Okt 2026: widget terbentang hanya bila dibentangkan pada SESI TAB ini (panel-alat.js alatPanelTerbuka
    // sesiTab) - posisi "terbentang" yang tersimpan saja tidak lagi membentangkannya di tab baru.
    if (["posisiChecklistSipp", "posisiChecklistAbt", "posisiChecklistAleta"].some((k) => (simpanan[k] as { kecil?: boolean } | undefined)?.kecil === false)) {
      w.sessionStorage.setItem("aleta-panel-terbuka:checklist-widget", "1");
    }
    w.chrome = {
      runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
      storage: {
        local: {
          get: async (kunci?: string | string[] | null) => {
            const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
            const hasil: Record<string, unknown> = {};
            for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
          remove: async () => undefined,
        },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener: () => undefined },
      },
    };
    const tanggapan = (isi: unknown) => {
      const r = { ok: true, status: 200, json: async () => polos(isi), clone: () => r };
      return r;
    };
    w.fetch = (alamat: string) => {
      const url = String(alamat);
      if (url.includes(API_KH)) return Promise.resolve(tanggapan(jawabKh));
      if (url.includes("/aleta-ecourt/checklist")) {
        return Promise.resolve(
          tanggapan({
            ok: true,
            data: {
              pengguna: { nama: "PP Dua", peran: ["pp"], superAdmin: false },
              peranTersedia: [{ kunci: "pp", label: "Panitera Pengganti" }],
              peranAktif: "pp",
              dibuat: new Date().toISOString(),
              ringkas: { lewat: 0, hariIni: 0, mingguIni: 0, selesaiHariIni: 0, totalHariIni: 0 },
              butir: [],
              jenisTidakTersedia: [],
              galat: [],
            },
          })
        );
      }
      return Promise.resolve(tanggapan({ ok: true, data: {} }));
    };
    const ctx = dom.getInternalVMContext();
    vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
    vm.runInContext(SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
    const kotak = () => {
      const a = w.document.querySelector("aleta-cm-widget");
      return a && a.shadowRoot ? (a.shadowRoot.querySelector("[data-kehadiran-widget]") as HTMLElement | null) : null;
    };
    return { w, kotak };
  }

  it("portal menjawab available:false (bot/jadwal tidak terbaca): kalimatnya 'belum dapat dibaca'", async () => {
    const h = bukaWidget({ ok: true, data: { available: false, ok: false, alasan: "ALETA Bot tidak terjangkau.", perkara: [] } });
    const k = await sampai(() => h.kotak(), "kotak kehadiran");
    await sampai(() => !/Memuat kehadiran/.test(k.textContent || ""), "jawaban kehadiran tergambar");
    await tunggu(50);
    const teks = h.kotak()!.textContent || "";
    expect(teks).not.toMatch(/Tidak ada sidang Anda hari ini|tidak ada sidang/);
    expect(teks).toMatch(/Kehadiran belum dapat dibaca/);
  });

  it("pembanding: jawaban sah tanpa sidang tetap 'Tidak ada sidang Anda hari ini'", async () => {
    const h = bukaWidget({ ok: true, data: { available: true, ok: true, jumlah: 0, perkara: [] } });
    await sampai(() => /Tidak ada sidang Anda hari ini/.test(h.kotak()?.textContent || ""), "kalimat tanpa sidang");
  });
});

// ============================================================================
// H. Penanda verifikasi e-Court sudah dipastikan pengguna
// ============================================================================
describe("H. katalog penanda L2", () => {
  it("'Dokumen e-Court belum diverifikasi' tidak lagi 'perlu dicek' (keputusan 17 Okt butir 31)", () => {
    const muat = createRequire(import.meta.url);
    const layanan = muat(path.join(AKAR, "aleta_bot/services/sippIdeL2Service.js")) as { KATALOG: Record<string, { perluDicek?: boolean }> };
    expect(layanan.KATALOG["ecourt-verifikasi"].perluDicek).toBeFalsy();
    for (const [kode, k] of Object.entries(layanan.KATALOG)) expect(k.perluDicek, kode).toBeFalsy();
  });
});
