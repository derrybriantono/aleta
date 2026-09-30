/**
 * Perbaikan 30 September 2026 - BAGIAN BERSAMA ekstensi (agen D).
 *
 *   butir 9   lapisan gelap SIPP: kotak pesan "Pesan ... tutup", SweetAlert2,
 *             jQuery UI ikut gelap; "Dokumen Belum Ada" merah muda dan
 *             dokumen yang ada biru muda - kontrasnya DIUKUR per palet
 *   butir 18  klik 2x kepala panel = layar penuh, klik 2x lagi = kembali;
 *             tidak dari tombol, tidak dalam Lama, tidak pada lencana
 *   butir 24  pita "Pembaruan tersedia" di atas panel (dan widget); klik =
 *             minta pembaruan lalu muat ulang ekstensi
 *   butir 25  profil saklar mengikuti peran login (kontrak K4)
 *   butir 6   penjelasan panjang di balik ⓘ (panel, popup, widget)
 *   K1        konversi-naskah lolos mode coba dan latihan (hanya menghitung),
 *             unggah-sipp tetap ditahan
 *
 * panel-alat.js, aleta.js, dan popup.js dijalankan SUNGGUHAN di JSDOM
 * dengan chrome.storage dan fetch tiruan - pola yang sama dengan
 * ekstensi-portal-tahap4 dan ekstensi-popup-tahap2.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_ALETA = baca("aleta.js");
const SUMBER_LATAR = baca("latar.js");
const SUMBER_CHECKLIST = baca("checklist.js");
const GAYA = baca("panel.css");
const POPUP_HTML = baca("popup.html");
const POPUP_JS = baca("popup.js");
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

// ============================================================================
// Halaman tiruan: panel-alat.js (dan aleta.js bila portal)
// ============================================================================
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type Jawab = { status?: number; isi?: unknown };

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

function jawabBaku(url: string, versiPortal: string): Jawab {
  if (url.includes("/ekstensi/siapa")) return { isi: { ok: true, data: SIAPA } };
  if (url.includes("/ekstensi?info=versi")) return { isi: { ok: true, data: { versi: versiPortal } } };
  return { isi: { ok: true, data: {} } };
}

function tanggapan(status: number, isi: unknown) {
  const r = { ok: status >= 200 && status < 300, status, statusText: "", json: async () => polos(isi), clone: () => r };
  return r;
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Halaman = {
  w: any;
  simpanan: Record<string, unknown>;
  minta: Array<{ url: string; cara: string }>;
  pesan: Array<Record<string, unknown>>;
};

function buka(p: {
  simpanan?: Record<string, unknown>;
  alamat?: string;
  portal?: boolean;
  checklist?: boolean;
  versiPortal?: string;
  jawabLatar?: (pesan: Record<string, unknown>) => unknown;
  ganti?: (url: string, cara: string) => Jawab | undefined;
} = {}): Halaman {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><main><p>isi</p></main></body></html>`, {
    url: p.alamat || (p.portal ? `${ASAL}/aleta/aleta-ecourt` : `${ASAL}/SIPP/x`),
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: Ubah, wilayah: string) => void> = [];
  const local = {
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
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async () => undefined,
  };
  const pesan: Array<Record<string, unknown>> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.174.1" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async (x: Record<string, unknown>) => {
        pesan.push(polos(x));
        return p.jawabLatar ? p.jawabLatar(x) : { ok: false, keadaan: "tidak_ada_pembaruan", pesan: "Chrome menjawab tidak ada pembaruan." };
      },
    },
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Array<{ url: string; cara: string }> = [];
  w.fetch = (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push({ url, cara });
    const j = (p.ganti && p.ganti(url, cara)) || jawabBaku(url, p.versiPortal || "1.175.0");
    return Promise.resolve(tanggapan(j.status ?? 200, j.isi));
  };
  w.Element.prototype.scrollIntoView = function () {};
  // Jawaban 423 mode coba/latihan dibuat dengan Response - jsdom tidak punya.
  w.Response = Response;
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  if (p.portal) vm.runInContext(SUMBER_ALETA, ctx, { filename: "aleta.js" });
  if (p.checklist) vm.runInContext(SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
  return { w, simpanan, minta, pesan };
}

const UI = { ujiTampilan: "ui", ujiIzinkanNyata: true, aktif: true };
const BARU = { ujiTampilan: "baru", ujiIzinkanNyata: true, aktif: true };
const panelPortal = (h: Halaman) => h.w.document.getElementById("aleta-panel-portal") as any;

// ============================================================================
// K1 - konversi naskah lolos mode coba dan latihan; unggahan tetap ditahan
// ============================================================================
describe("K1 konversi-naskah: hanya menghitung, jadi lolos; unggahan tetap ditahan", () => {
  const KONVERSI = `${ASAL}/aleta/api/aleta-ecourt/putusan/konversi-naskah`;
  const UNGGAH = `${ASAL}/aleta/api/aleta-ecourt/putusan/unggah-sipp`;

  it("mode coba (UI Baru tanpa izin tindakan nyata)", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui" } });
    await h.w.alatMuatUji();
    expect(h.w.alatCobaAktif()).toBe(true);
    expect(h.w.alatCobaMenahan(KONVERSI, "POST")).toBe(false);
    expect(h.w.alatCobaMenahan(UNGGAH, "POST")).toBe(true);
    expect((await h.w.fetch(KONVERSI, { method: "POST" })).status).toBe(200);
    expect((await h.w.fetch(UNGGAH, { method: "POST" })).status).toBe(423);
  });

  it("mode latihan", async () => {
    const h = buka({ simpanan: { modeLatihan: true } });
    await h.w.alatMuatLatihan();
    expect(h.w.alatLatihanMenahan(KONVERSI, "POST")).toBe(false);
    expect(h.w.alatLatihanMenahan(UNGGAH, "POST")).toBe(true);
  });

  it("alasannya tertulis di sebelah polanya", () => {
    const coba = SUMBER_ALAT.slice(SUMBER_ALAT.indexOf("const ALETA_COBA_BOLEH"), SUMBER_ALAT.indexOf("function alatUjiBersihMode"));
    expect(coba).toMatch(/Konversi naskah \(K1[\s\S]{0,400}konversi-naskah/);
  });
});

// ============================================================================
// Butir 25 - profil saklar mengikuti peran login (K4)
// ============================================================================
const PROFIL_HAKIM = {
  peran: "hakim",
  saklar: { tandaiHalaman: true, sisipJadwal: true, cetakTigaBerkas: false, checklistMilestone: true, suntingLangsungAbt: false },
  fitur: { "sipp-5": true, "popup-11": true },
  sumber: "admin",
  bolehUbahProfil: false,
};
const SERVER_UI = (profil: unknown) => ({
  mode: "ui",
  fitur: { "sipp-5": true, "sipp-6": true, "popup-11": true },
  diterapkan: true,
  versi: "v1",
  diambil: Date.now(),
  profil,
});

describe("butir 25: profil peran (K4) di panel-alat.js", () => {
  it("pegawai biasa: fitur ide hanya yang ada di profil perannya, saklar mengikuti profil", async () => {
    const h = buka({ simpanan: { tampilanServer: SERVER_UI(PROFIL_HAKIM), cetakTigaBerkas: true } });
    await h.w.alatMuatUji();
    expect(h.w.alatUjiMode()).toBe("ui");
    expect(h.w.alatFiturNyala("sipp-5")).toBe(true);
    expect(h.w.alatFiturNyala("sipp-6")).toBe(false);
    expect(h.simpanan.cetakTigaBerkas).toBe(false);
    expect(h.simpanan.checklistMilestone).toBe(true);
    expect(h.simpanan.profilSaklarDiterapkan).toBe(`hakim|${JSON.stringify(PROFIL_HAKIM.saklar)}`);
  });

  it("Super Admin/Admin (bolehUbahProfil): tidak disaring dan saklarnya tidak disentuh", async () => {
    const h = buka({
      simpanan: { tampilanServer: SERVER_UI({ ...PROFIL_HAKIM, peran: "admin", bolehUbahProfil: true }), cetakTigaBerkas: true },
    });
    await h.w.alatMuatUji();
    expect(h.w.alatFiturNyala("sipp-6")).toBe(true);
    expect(h.simpanan.cetakTigaBerkas).toBe(true);
    expect("profilSaklarDiterapkan" in h.simpanan).toBe(false);
  });

  it("profil.fitur null: tidak menyaring apa pun", async () => {
    const h = buka({ simpanan: { tampilanServer: SERVER_UI({ ...PROFIL_HAKIM, fitur: null }) } });
    await h.w.alatMuatUji();
    expect(h.w.alatFiturNyala("sipp-6")).toBe(true);
  });

  it("Lama: profil tidak berlaku sama sekali - tidak ada yang ditulis", async () => {
    const h = buka({ simpanan: { tampilanServer: { ...SERVER_UI(PROFIL_HAKIM), diterapkan: false }, cetakTigaBerkas: true } });
    await h.w.alatMuatUji();
    expect(h.w.alatUjiMode()).toBe("lama");
    expect(h.w.alatProfilPeran()).toBeNull();
    expect(h.simpanan.cetakTigaBerkas).toBe(true);
    expect("profilSaklarDiterapkan" in h.simpanan).toBe(false);
  });

  it("diterapkan SEKALI per profil: saklar yang diubah pemiliknya sesudahnya bertahan; profil baru menerapkan lagi", async () => {
    const h = buka({ simpanan: { tampilanServer: SERVER_UI(PROFIL_HAKIM) } });
    await h.w.alatMuatUji();
    expect(h.simpanan.checklistMilestone).toBe(true);
    // × widget mematikan checklist - pilihan pemiliknya.
    h.simpanan.checklistMilestone = false;
    expect(await h.w.alatTerapkanProfilSaklar()).toBe(false);
    expect(h.simpanan.checklistMilestone).toBe(false);
    // Admin mengubah profil hakim: diterapkan lagi.
    const baru = { ...PROFIL_HAKIM, saklar: { ...PROFIL_HAKIM.saklar, sisipJadwal: false } };
    h.w.alatUjiTerima({ tampilanServer: SERVER_UI(baru) });
    expect(await h.w.alatTerapkanProfilSaklar()).toBe(true);
    expect(h.simpanan.checklistMilestone).toBe(true);
    expect(h.simpanan.sisipJadwal).toBe(false);
  });

  it("jawaban server dibersihkan: saklar induk dan kunci asing dibuang, kode fitur harus sah", async () => {
    const h = buka({
      simpanan: { aktif: true },
      ganti: (url) =>
        url.includes("/ekstensi/tampilan")
          ? {
              isi: {
                ok: true,
                data: {
                  versi: "v2",
                  tampilan: { mode: "baru", fitur: { "sipp-5": true }, diterapkan: true },
                  profil: {
                    peran: "juru-sita",
                    saklar: { aktif: false, sisipJadwal: false, jahat: true, tandaiHalaman: "ya" },
                    fitur: { "sipp-5": true, "x;alert(1)": true },
                    sumber: "admin",
                    bolehUbahProfil: false,
                  },
                },
              },
            }
          : undefined,
    });
    await h.w.alatMuatUji();
    await h.w.alatSegarkanTampilanServer(true);
    const profil = (h.simpanan.tampilanServer as any).profil;
    expect(profil.saklar).toEqual({ sisipJadwal: false });
    expect(profil.fitur).toEqual({ "sipp-5": true });
    expect(h.simpanan.aktif).toBe(true);
    expect(h.simpanan.sisipJadwal).toBe(false);
  });

  it("tanpa jawaban server (404): perilaku sekarang - tidak ada profil", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "sipp-6": true } }, ganti: (url) => (url.includes("/ekstensi/tampilan") ? { status: 404, isi: {} } : undefined) });
    await h.w.alatMuatUji();
    await h.w.alatSegarkanTampilanServer(true);
    expect(h.w.alatProfilPeran()).toBeNull();
    expect(h.w.alatFiturNyala("sipp-6")).toBe(true);
  });

  it("latar.js menyaring angka ikon dengan aturan yang sama", () => {
    const awal = SUMBER_LATAR.indexOf("function tampilanBerlakuLatar(");
    const fungsi = SUMBER_LATAR.slice(awal, SUMBER_LATAR.indexOf("\n}\n", awal) + 3);
    const k: any = { Object, Array, JSON };
    vm.createContext(k);
    vm.runInContext(`${fungsi}\nthis.f = tampilanBerlakuLatar;`, k);
    const sv = { mode: "ui", diterapkan: true, fitur: { "popup-6": true, "popup-7": true } };
    expect(k.f({ tampilanServer: { ...sv, profil: { fitur: { "popup-7": true } } } }).fitur).toEqual({ "popup-7": true });
    expect(k.f({ tampilanServer: { ...sv, profil: { fitur: { "popup-7": true }, bolehUbahProfil: true } } }).fitur["popup-6"]).toBe(true);
    expect(k.f({ tampilanServer: { ...sv, profil: { fitur: null } } }).fitur["popup-6"]).toBe(true);
  });
});

// ============================================================================
// Butir 25 dan 6 di popup
// ============================================================================
function bukaPopup(simpan: Record<string, unknown>) {
  const html = POPUP_HTML.replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { asalPortal: `${ASAL}/aleta`, ...polos(simpan) };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.174.1", host_permissions: [`${ASAL}/*`] }),
      sendMessage: async () => ({}),
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const x of daftar) if (x in simpanan) hasil[x] = polos(simpanan[x]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener() {} },
    },
  };
  w.fetch = async (alamat: string) => {
    const a = String(alamat);
    if (a.includes("info=siapa")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran: "Hakim" }, versi: "1.174.1" } }) };
    }
    return { ok: true, status: 200, url: a, json: async () => ({}) };
  };
  const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
  vm.runInContext(DAFTAR_FITUR_JS, ctx, { filename: "daftar-fitur.js" });
  vm.runInContext(POPUP_JS, ctx, { filename: "popup.js" });
  return { w, d: w.document as Document };
}

async function popupTenang(p: ReturnType<typeof bukaPopup>) {
  await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
  await tunggu(60);
}

describe("popup: profil saklar hanya bagi Super Admin dan Admin (butir 25)", () => {
  it("pegawai dengan profil peran: bagian Profil saklar TIDAK tampil, kalimat profilnya tampil", async () => {
    const p = bukaPopup({ tampilanServer: SERVER_UI(PROFIL_HAKIM) });
    await popupTenang(p);
    expect(p.d.getElementById("tbProfil")).toBeNull();
    expect(p.d.getElementById("tbProfilPeran")?.textContent).toMatch(/profil peran hakim yang diatur admin/);
    // Saklarnya sendiri tetap ada dan tetap dapat diubah.
    expect((p.d.getElementById("checklistMilestone") as HTMLInputElement).disabled).toBe(false);
  });

  it("Admin (bolehUbahProfil): Profil saklar tetap tampil", async () => {
    const p = bukaPopup({ tampilanServer: SERVER_UI({ ...PROFIL_HAKIM, peran: "admin", bolehUbahProfil: true }) });
    await popupTenang(p);
    expect(p.d.getElementById("tbProfil")).not.toBeNull();
    expect(p.d.getElementById("tbProfilPeran")).toBeNull();
  });

  it("tanpa profil dari server: Profil saklar tetap seperti sekarang", async () => {
    const p = bukaPopup({ tampilanServer: SERVER_UI(null) });
    await popupTenang(p);
    expect(p.d.getElementById("tbProfil")).not.toBeNull();
  });

  it("fitur popup-N ikut disaring profil.fitur", async () => {
    const p = bukaPopup({ tampilanServer: SERVER_UI({ ...PROFIL_HAKIM, saklar: null, fitur: { "sipp-5": true } }) });
    await popupTenang(p);
    expect(p.w.fiturPopupNyala("popup-11")).toBe(false);
    expect(p.d.getElementById("tbProfil")).toBeNull();
  });

  it("Lama: tidak ada kalimat profil maupun elemen buatan", async () => {
    const p = bukaPopup({ tampilanServer: { ...SERVER_UI(PROFIL_HAKIM), diterapkan: false } });
    await popupTenang(p);
    expect(p.d.querySelectorAll('[class^="tb-"], [class*=" tb-"]').length).toBe(0);
  });
});

describe("popup: penjelasan panjang di balik ⓘ (butir 6/26)", () => {
  it("Baru dengan popup-1: pengantar panjang dilipat, ⓘ membukanya; Lama tidak", async () => {
    const p = bukaPopup({ ujiTampilan: "baru", ujiFitur: { "popup-1": true }, ujiIzinkanNyata: true });
    await popupTenang(p);
    const pengantar = p.d.querySelector(".isi .pengantar") as HTMLElement;
    expect(pengantar.hidden).toBe(true);
    const ringkas = pengantar.previousElementSibling as HTMLElement;
    expect(ringkas.classList.contains("tb-lipat")).toBe(true);
    const tombol = ringkas.querySelector(".tb-lipat-tombol") as HTMLButtonElement;
    expect(tombol.textContent).toBe("ⓘ");
    tombol.click();
    expect(pengantar.hidden).toBe(false);
    expect(tombol.getAttribute("aria-expanded")).toBe("true");
    tombol.click();
    expect(pengantar.hidden).toBe(true);

    const lama = bukaPopup({ ujiTampilan: "lama", ujiFitur: { "popup-1": true } });
    await popupTenang(lama);
    expect((lama.d.querySelector(".isi .pengantar") as HTMLElement).hidden).toBe(false);
    expect(lama.d.querySelector(".tb-lipat")).toBeNull();
  });

  it("ⓘ di dalam label saklar tidak membalik saklarnya", async () => {
    const p = bukaPopup({ ujiTampilan: "baru", ujiFitur: { "popup-1": true }, ujiIzinkanNyata: true, aktif: true });
    await popupTenang(p);
    const aktif = p.d.getElementById("aktif") as HTMLInputElement;
    const sebelum = aktif.checked;
    const label = aktif.closest("label")!;
    const tombol = label.querySelector(".tb-info") as HTMLButtonElement;
    expect(tombol).not.toBeNull();
    tombol.click();
    expect(aktif.checked).toBe(sebelum);
  });
});

// ============================================================================
// Butir 24 - pita pembaruan; butir 18 - klik ganda kepala (panel portal)
// ============================================================================
describe("butir 24: pita Pembaruan tersedia", () => {
  it("UI Baru: pita di atas panel portal bila server menyajikan versi lebih baru", async () => {
    const h = buka({ portal: true, simpanan: UI, versiPortal: "1.175.0" });
    const pita = await sampai(() => panelPortal(h)?.querySelector(":scope > .aleta-pita-pembaruan"), "pita lahir");
    expect(panelPortal(h).firstElementChild).toBe(pita);
    expect(pita.textContent).toContain("Pembaruan tersedia 1.175.0");
    // Disinggahkan: pemuatan halaman berikutnya tidak bertanya lagi.
    expect((h.simpanan.pitaPembaruan as any).portal).toBe("1.175.0");
  });

  it("klik = minta pembaruan ke latar.js, lalu muat ulang ekstensi bila Chrome tidak memasang apa pun", async () => {
    const h = buka({ portal: true, simpanan: BARU, versiPortal: "1.175.0" });
    const pita = await sampai(() => panelPortal(h)?.querySelector(".aleta-pita-pembaruan"), "pita lahir");
    pita.click();
    await sampai(() => h.pesan.length >= 2, "dua pesan ke latar");
    expect(h.pesan.map((x) => x.jenis)).toEqual(["perbarui", "muat-ulang"]);
    expect(h.pesan.every((x) => x.sumber === "aleta-panel")).toBe(true);
  });

  it("CRX terpasang: satu pesan saja, tidak memuat ulang dari folder", async () => {
    const h = buka({
      portal: true,
      simpanan: BARU,
      jawabLatar: () => ({ ok: true, keadaan: "dipasang", pesan: "sedang dipasang" }),
    });
    const pita = await sampai(() => panelPortal(h)?.querySelector(".aleta-pita-pembaruan"), "pita lahir");
    pita.click();
    await tunggu(50);
    expect(h.pesan.map((x) => x.jenis)).toEqual(["perbarui"]);
  });

  it("putaran relaas berjalan: ditahan dan disebut; klik kedua memaksa", async () => {
    let n = 0;
    const h = buka({
      portal: true,
      simpanan: BARU,
      jawabLatar: () => (n++ === 0 ? { ok: false, keadaan: "putaran-relaas-berjalan", pesan: "Putaran cetak relaas belum selesai." } : { ok: true, keadaan: "dipasang" }),
    });
    const pita = await sampai(() => panelPortal(h)?.querySelector(".aleta-pita-pembaruan"), "pita lahir");
    pita.click();
    await sampai(() => !pita.disabled && /sekali lagi/.test(pita.textContent), "kabar putaran");
    pita.click();
    await sampai(() => h.pesan.length >= 2, "klik kedua");
    expect(h.pesan[1]).toMatchObject({ jenis: "perbarui", paksa: true });
  });

  it("versi sama atau lebih lama: tidak ada pita", async () => {
    const h = buka({ portal: true, simpanan: UI, versiPortal: "1.174.1" });
    await sampai(() => panelPortal(h), "panel lahir");
    await tunggu(80);
    expect(panelPortal(h).querySelector(".aleta-pita-pembaruan")).toBeNull();
  });

  it("Lama: tidak ada pita dan tidak ada permintaan versi", async () => {
    const h = buka({ portal: true, simpanan: { aktif: true }, versiPortal: "1.175.0" });
    await sampai(() => panelPortal(h), "panel lahir");
    await tunggu(80);
    expect(panelPortal(h).querySelector(".aleta-pita-pembaruan")).toBeNull();
    expect(h.minta.some((m) => m.url.includes("info=versi"))).toBe(false);
  });

  it("widget checklist hanya membaca singgahan - tidak menambah permintaan", async () => {
    const h = buka({ simpanan: { ...UI, pitaPembaruan: { portal: "1.175.0", diambil: Date.now() } } });
    await h.w.alatMuatUji();
    expect(await h.w.alatPembaruanTersedia(false, { tanpaAmbil: true })).toEqual({ portal: "1.175.0", terpasang: "1.174.1" });
    const kosong = buka({ simpanan: UI });
    await kosong.w.alatMuatUji();
    expect(await kosong.w.alatPembaruanTersedia(false, { tanpaAmbil: true })).toBeNull();
    expect(kosong.minta.some((m) => m.url.includes("info=versi"))).toBe(false);
    expect(SUMBER_CHECKLIST).toContain("alatPembaruanTersedia(false, { tanpaAmbil: true })");
  });

  it("banding versi: angka per bagian, bukan huruf", async () => {
    const h = buka();
    expect(h.w.alatBandingVersi("1.175.0", "1.174.1")).toBeGreaterThan(0);
    expect(h.w.alatBandingVersi("1.99.0", "1.100.0")).toBeLessThan(0);
    expect(h.w.alatBandingVersi("1.174.1", "1.174.1")).toBe(0);
  });
});

describe("butir 18: klik 2x kepala panel = layar penuh", () => {
  async function panelSiap(simpanan: Record<string, unknown>) {
    const h = buka({ portal: true, simpanan, versiPortal: "1.174.1" });
    const panel = await sampai(() => panelPortal(h), "panel lahir");
    const kepala = await sampai(() => panel.querySelector(".aleta-kepala"), "kepala");
    await tunggu(30);
    const dbl = (el: any) => el.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    return { h, panel, kepala, dbl };
  }

  it("UI Baru: klik 2x masuk layar penuh, klik 2x lagi kembali", async () => {
    const { panel, kepala, dbl } = await panelSiap(UI);
    dbl(kepala);
    expect(panel.classList.contains("aleta-panel-penuh")).toBe(true);
    expect(panel.querySelector(".aleta-penuh").textContent).toBe("⤡");
    dbl(kepala);
    expect(panel.classList.contains("aleta-panel-penuh")).toBe(false);
  });

  it("Baru juga; klik 2x pada tombol di kepala TIDAK memicu", async () => {
    const { panel, kepala, dbl } = await panelSiap(BARU);
    dbl(kepala.querySelector(".aleta-bawaan"));
    expect(panel.classList.contains("aleta-panel-penuh")).toBe(false);
    dbl(kepala);
    expect(panel.classList.contains("aleta-panel-penuh")).toBe(true);
  });

  it("Lama: klik 2x kepala tidak berbuat apa pun", async () => {
    const { panel, kepala, dbl } = await panelSiap({ aktif: true });
    dbl(kepala);
    expect(panel.classList.contains("aleta-panel-penuh")).toBe(false);
  });

  it("lencana: klik 2x membentangkan saja, tidak langsung layar penuh", async () => {
    const { h, panel, kepala, dbl } = await panelSiap(UI);
    h.w.alatCiutkan(panel, "posisiPanelAleta", true);
    expect(panel.classList.contains("aleta-panel-lencana")).toBe(true);
    dbl(kepala);
    expect(panel.classList.contains("aleta-panel-penuh")).toBe(false);
  });

  it("fungsi bersama tersedia untuk panel SIPP (agen A) dan dipasang alatPasangPanel", () => {
    expect(SUMBER_ALAT).toContain("function alatPasangKlikGandaKepala(panel, kunci, kepala)");
    expect(SUMBER_ALAT).toContain("alatPasangKlikGandaKepala(panel, kunci, kepala);");
    // Nomor perkara di kepala SIPP punya klik gandanya sendiri (tukar nomor).
    expect(SUMBER_ALAT).toMatch(/const ALAT_KLIK_GANDA_BUKAN =[\s\S]{0,200}\.aleta-nomor-tukar/);
  });
});

// ============================================================================
// Butir 6 - alatLipatPenjelasan
// ============================================================================
describe("butir 6: penjelasan panjang di balik ⓘ (panel)", () => {
  const PANJANG =
    "Mengambil draf putusan ALETA yang terbaru untuk perkara ini, lalu mengisikan Pertimbangan Hukum, Amar, dan Amar Anonim ke formulir di halaman ini.";

  function susun(w: any) {
    const akar = w.document.createElement("div");
    akar.innerHTML = `<p class="k" id="panjang">${PANJANG}</p><p class="k" id="pendek">Pendek saja.</p><p class="k" id="bertombol">${PANJANG} <button>Ambil</button></p>`;
    w.document.body.appendChild(akar);
    return akar;
  }

  it("Baru/UI Baru: yang panjang dilipat, kalimat pertamanya jadi ringkasan, ⓘ membuka-tutup", async () => {
    const h = buka({ simpanan: UI });
    await h.w.alatMuatUji();
    const akar = susun(h.w);
    expect(h.w.alatLipatPenjelasan(akar, ".k")).toBe(1);
    const panjang = akar.querySelector("#panjang");
    expect(panjang.hidden).toBe(true);
    const tombol = panjang.previousElementSibling;
    expect(tombol.className).toBe("aleta-info-lipat");
    expect(tombol.textContent).toMatch(/^ⓘ/);
    tombol.click();
    expect(panjang.hidden).toBe(false);
    tombol.click();
    expect(panjang.hidden).toBe(true);
    // Yang pendek dan yang memuat tombol tidak dilipat - tidak ada fitur di balik ⓘ.
    expect(akar.querySelector("#pendek").hidden).toBe(false);
    expect(akar.querySelector("#bertombol").hidden).toBe(false);
    // Idempoten.
    expect(h.w.alatLipatPenjelasan(akar, ".k")).toBe(0);
  });

  it("Lama: tidak berbuat apa pun", async () => {
    const h = buka();
    await h.w.alatMuatUji();
    const akar = susun(h.w);
    expect(h.w.alatLipatPenjelasan(akar, ".k")).toBe(0);
    expect(akar.querySelector("#panjang").hidden).toBe(false);
  });

  it("panel portal memakainya untuk keterangan murni saja", () => {
    expect(SUMBER_ALETA).toContain('alatLipatPenjelasan(akar, ".aleta-t4-ket, .aleta-kosong-lembut, .aleta-t4-belum")');
  });

  it("[hidden] milik yang dilipat dijamin menang atas display penulis gaya", () => {
    expect(GAYA).toMatch(/\[data-aleta-dilipat="ya"\]\[hidden\] \{\s*display: none !important;/);
  });
});

// ============================================================================
// Butir 9 - lapisan gelap SIPP: diukur, bukan dinilai dengan mata
// ============================================================================
const AA = 4.5;
const AAA = 7;

function luminansi(heks: string): number {
  const n = heks.replace("#", "");
  const ruas = [0, 2, 4]
    .map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * ruas[0] + 0.7152 * ruas[1] + 0.0722 * ruas[2];
}

function rasio(a: string, b: string): number {
  const x = luminansi(a);
  const y = luminansi(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Nilai token pada palet (kosong = dasar); palet yang tidak menimpanya mewarisi dasar. */
function token(nama: string, palet = ""): string {
  const dasar = () => {
    const m = GAYA.match(new RegExp(`${nama}:\\s*(#[0-9a-fA-F]{6})`));
    expect(m, `token ${nama} tidak ada`).not.toBeNull();
    return (m as RegExpMatchArray)[1];
  };
  if (!palet) return dasar();
  const jangkar = `html[data-aleta-warna="${palet}"][data-aleta-tema-sipp="gelap"] {`;
  const i = GAYA.indexOf(jangkar);
  expect(i, `palet ${palet}`).toBeGreaterThan(-1);
  const blok = GAYA.slice(i, GAYA.indexOf("\n}", i));
  const m = blok.match(new RegExp(`${nama}:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1] : dasar();
}

/** Blok CSS milik agen D. */
const BAGIAN_D = GAYA.slice(
  GAYA.indexOf("BERSAMA - PERBAIKAN 30 SEP (MULAI)"),
  GAYA.indexOf("/* BERSAMA - PERBAIKAN 30 SEP (AKHIR) */")
);

function aturan(pemilihMengandung: string): string {
  const i = BAGIAN_D.indexOf(pemilihMengandung);
  expect(i, `aturan ${pemilihMengandung} tidak ada di bagian D`).toBeGreaterThan(-1);
  return BAGIAN_D.slice(i, BAGIAN_D.indexOf("}", i));
}

const PALET = ["", "arang", "neon", "hangat", "pastel", "permata", "vibran"];

describe("butir 9: status dokumen Jadwal Sidang terbaca di lapisan gelap - diukur per palet", () => {
  for (const palet of PALET) {
    const nama = palet || "dasar";
    it(`${nama}: "Dokumen Belum Ada" dan "Unduh Dokumen BAS" memenuhi AAA di atas tabel, AA di baris yang disorot`, () => {
      const belum = token("--s-dok-belum", palet);
      const ada = token("--s-dok-ada", palet);
      for (const [label, latar] of [
        ["permukaan", token("--s-permukaan", palet)],
        ["permukaan-2", token("--s-permukaan-2", palet)],
        ["latar", token("--s-latar", palet)],
      ] as const) {
        expect(rasio(belum, latar), `${nama}: belum ada di atas ${label}`).toBeGreaterThanOrEqual(AAA);
        expect(rasio(ada, latar), `${nama}: sudah ada di atas ${label}`).toBeGreaterThanOrEqual(AAA);
      }
      expect(rasio(belum, token("--s-sorot", palet)), `${nama}: belum ada, baris disorot`).toBeGreaterThanOrEqual(AA);
      expect(rasio(ada, token("--s-sorot", palet)), `${nama}: sudah ada, baris disorot`).toBeGreaterThanOrEqual(AA);
      // Tombol PDF/Word kotak e-Court di atas permukaan-3.
      expect(rasio(ada, token("--s-permukaan-3", palet)), `${nama}: PDF/Word`).toBeGreaterThanOrEqual(AAA);
    });
  }

  it("merah dan biru tetap BERBEDA - status tidak boleh rata menjadi satu warna", () => {
    expect(token("--s-dok-belum")).not.toBe(token("--s-dok-ada"));
    expect(Math.abs(luminansi(token("--s-dok-belum")) - luminansi(token("--s-dok-ada")))).toBeLessThan(0.2);
  });

  it("pemilihnya mengenai markah SIPP apa adanya dan menang atas aturan pewarisan", () => {
    const merah = aturan('[style^="color:red"]');
    expect(merah).toContain("color: var(--s-dok-belum) !important");
    // Pewarisan: html[..] :is(#konten, ...) :is(font[color], [style*="color"]) = (1,2,2).
    // Ini: html:not([..])[..] :is(#konten, ...) [style^=..] = (1,3,1) - lebih tinggi.
    const kepala = BAGIAN_D.slice(0, BAGIAN_D.indexOf(merah) + 1).split("}").pop() as string;
    expect(kepala).toContain('html:not([data-aleta-halaman="abt"])[data-aleta-tema-sipp="gelap"] :is(#konten,');
    const biru = aturan('a[target="_new"][href] {');
    expect(biru).toContain("color: var(--s-dok-ada) !important");
    // "background-color:red" tidak ikut: yang dicocokkan awal nilai atau sesudah titik koma.
    expect(merah).not.toContain('[style*="color:red"]');
  });
});

describe("butir 9: kotak pesan SIPP dan dialog lain ikut gelap", () => {
  it("kotak Pesan: latar putih .pesan ditimpa permukaan, tulisan terbaca", () => {
    const pesan = aturan("] table.pesan {");
    expect(pesan).toContain("background-color: var(--s-permukaan) !important");
    expect(pesan).toContain("color: var(--s-tulisan) !important");
    for (const palet of PALET) {
      expect(rasio(token("--s-tulisan", palet), token("--s-permukaan", palet))).toBeGreaterThanOrEqual(AAA);
      expect(rasio(token("--s-tulisan-atas", palet), token("--s-hijau-tua", palet))).toBeGreaterThanOrEqual(AAA);
    }
  });

  it("pesan error (latar kuning) menjadi kuning tua yang terbaca", () => {
    const galat = aturan('td[style*="background-color:yellow"]');
    const latar = galat.match(/background-color:\s*(#[0-9a-f]{6})/)![1];
    const tulisan = galat.match(/(?<!background-)color:\s*(#[0-9a-f]{6})/)![1];
    expect(rasio(tulisan, latar)).toBeGreaterThanOrEqual(AAA);
    expect(luminansi(latar)).toBeLessThan(0.05);
  });

  it("SweetAlert2 dan jQuery UI ikut; semuanya hanya di SIPP, tidak di ABT", () => {
    expect(aturan(".swal2-popup {")).toContain("background: var(--s-permukaan) !important");
    expect(aturan(".ui-datepicker, .ui-widget-content, .ac_results)")).toContain("background: var(--s-permukaan) !important");
    const pemilihGelap = BAGIAN_D.match(/^html[^{]*data-aleta-tema-sipp="gelap"[^{]*\{/gm) || [];
    const diluarSipp = pemilihGelap.filter(
      (x) => !x.includes(':not([data-aleta-halaman="abt"])') && !/^html\[data-aleta-tema-sipp="gelap"\] (\{|\.aleta-sisip)/.test(x)
    );
    expect(diluarSipp).toEqual([]);
  });

  it("markah kotak pesan yang dipetakan memang markah jquery-sipp.js", () => {
    // Disalin dari resources/js/jquery-sipp.js SIPP 7.0.4 - bila SIPP mengubahnya, peta ini harus ikut.
    const MARKAH =
      '<div id="popup_message" class="popup"><div class="centering"><table class="pesan"><tr style="background-color: #5FB85C;"><td align="center" style="padding:5px;" id="test">Pesan</td><td id="close_error_windows" class="tutup_windows tutups" align="center" style="padding:5px;" width="50">tutup</td></tr><tr><td style="padding:5px;background-color:yellow;" colspan="2"><div id="popup-container"></div></td></tr></table></div></div>';
    const dom = new JSDOM(`<!doctype html><html data-aleta-tema-sipp="gelap"><body>${MARKAH}</body></html>`);
    terbuka.push(dom);
    const d = dom.window.document;
    expect(d.querySelector("table.pesan tr[style*=\"background-color\"]")).not.toBeNull();
    expect(d.querySelector("table.pesan td.tutup_windows")).not.toBeNull();
    expect(d.querySelector('table.pesan td[style*="background-color:yellow"]')).not.toBeNull();
  });
});
