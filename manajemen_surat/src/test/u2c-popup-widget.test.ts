/**
 * ============================================================================
 * UJI RILIS U2c (9 Oktober 2026) - POPUP EKSTENSI DIJALANKAN SUNGGUHAN
 * ============================================================================
 *
 * popup.html + popup.js dijalankan di JSDOM (pola ekstensi-popup-tahap2), dengan
 * chrome.storage, chrome.runtime.sendMessage, dan fetch tiruan. Yang dijaga di
 * sini adalah keadaan yang belum dijalankan uji lain:
 *
 *   1. Tombol "Perbarui sekarang" / "muat ulang ekstensi" atas tiap jawaban
 *      latar.js - termasuk "putaran-relaas-berjalan" (tekanan kedua memaksa)
 *      dan jawaban gagal (tombol tidak boleh mati selamanya).
 *   2. Penyimpanan ekstensi yang MENOLAK menulis: saklar tidak boleh tampak
 *      tersimpan padahal tidak - paling berbahaya pada Mode latihan dan
 *      "Izinkan tindakan nyata".
 *   3. popup-13 "Kembalikan posisi" dengan pilihan: sudut widget (popup-9)
 *      milik WIDGET checklist, bukan milik panel.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const popupHtml = baca("popup.html");
const popupJs = baca("popup.js");
const daftarFiturJs = baca("daftar-fitur.js");

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Pesan = { sumber?: string; jenis?: string; paksa?: boolean };

type Opsi = {
  peran?: string;
  simpan?: Record<string, unknown>;
  /** Jawaban latar.js atas pesan popup; melempar = konteks ekstensi mati. */
  latar?: (p: Pesan) => unknown;
  /** Kunci yang penulisannya DITOLAK penyimpanan (kuota penuh, ekstensi dimuat ulang). */
  tolakTulis?: (kunci: string[]) => boolean;
};

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaPopup(opsi: Opsi = {}) {
  const html = popupHtml.replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { asalPortal: "http://192.168.10.10/aleta", ...(opsi.simpan || {}) };
  const salin = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const pesan: Pesan[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.188.0", host_permissions: ["http://192.168.10.10/*", "http://127.0.0.1/*"] }),
      sendMessage: async (p: Pesan) => {
        pesan.push(salin(p));
        return opsi.latar ? opsi.latar(p) : {};
      },
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const x of daftar) if (x in simpanan) hasil[x] = salin(simpanan[x]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          if (opsi.tolakTulis && opsi.tolakTulis(Object.keys(isi))) {
            throw new w.Error("QUOTA_BYTES quota exceeded");
          }
          Object.assign(simpanan, salin(isi));
        },
        remove: async (kunci: string | string[]) => {
          for (const k of [kunci].flat()) delete simpanan[k];
        },
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener() {} },
    },
  };
  w.fetch = async (alamat: string) => {
    const a = String(alamat);
    if (a.includes("info=siapa")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran: opsi.peran || "Super Admin" }, versi: "1.188.0" } }),
      };
    }
    return { ok: true, status: 200, url: a, json: async () => ({}) };
  };
  const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
  vm.runInContext(daftarFiturJs, ctx, { filename: "daftar-fitur.js" });
  vm.runInContext(popupJs, ctx, { filename: "popup.js" });
  return { w, d: w.document as Document, simpanan, pesan };
}

async function sampai(syarat: () => boolean, apa: string) {
  const mulai = Date.now();
  while (!syarat()) {
    if (Date.now() - mulai > 2500) throw new Error(`tidak kunjung: ${apa}`);
    await tunggu(10);
  }
}

async function tenang(p: ReturnType<typeof bukaPopup>) {
  await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
  await tunggu(40);
}

const el = <T extends HTMLElement = HTMLElement>(p: ReturnType<typeof bukaPopup>, id: string) => p.d.getElementById(id) as T;

/** Jawaban latar.js yang menahan pemuatan ulang - bentuk relaasTahanMuatUlang. */
const TAHAN = {
  ok: false,
  keadaan: "putaran-relaas-berjalan",
  pesan:
    "Putaran cetak relaas tanggal 2026-10-09 sedang berjalan: 3 dari 8 dokumen selesai, 5 belum. Memperbarui atau memuat ulang ekstensi sekarang MENGHAPUS putaran itu - Tekan tombolnya sekali lagi bila tetap ingin sekarang.",
};

// ============================================================================
describe("Perbarui sekarang / muat ulang ekstensi atas tiap jawaban latar.js", () => {
  it("putaran relaas berjalan: kalimatnya tampil, tombol hidup berlabel paksa, tekanan kedua mengirim paksa", async () => {
    let ke = 0;
    const p = bukaPopup({
      latar: (m) => {
        if (m.jenis !== "perbarui") return {};
        ke += 1;
        return ke === 1 ? TAHAN : { ok: true, keadaan: "dipasang", pesan: "Versi 1.189.0 sedang dipasang." };
      },
    });
    await tenang(p);
    const tombol = el<HTMLButtonElement>(p, "perbaruiSekarang");
    tombol.click();
    await sampai(() => /3 dari 8 dokumen/.test(el(p, "perbaruiKabar").textContent || ""), "kalimat putaran");
    expect(el(p, "perbaruiKabar").hidden).toBe(false);
    expect(tombol.disabled).toBe(false);
    expect(tombol.textContent).toMatch(/Tetap perbarui/);
    expect(el(p, "muatUlangEkstensi").hidden, "jalan kedua belum ditawarkan").toBe(true);
    expect(p.pesan.at(-1)).toEqual({ sumber: "aleta-panel", jenis: "perbarui" });

    tombol.click();
    await sampai(() => /1\.189\.0/.test(el(p, "perbaruiKabar").textContent || ""), "dipasang");
    expect(p.pesan.at(-1)).toEqual({ sumber: "aleta-panel", jenis: "perbarui", paksa: true });
  });

  it("sudah dipaksa lewat Perbarui, Chrome tidak memasang apa pun: 'muat ulang ekstensi' tidak menahan untuk KEDUA kalinya", async () => {
    let perbarui = 0;
    const p = bukaPopup({
      latar: (m) => {
        if (m.jenis === "perbarui") {
          perbarui += 1;
          return perbarui === 1 ? TAHAN : { ok: false, keadaan: "tidak_ada_pembaruan", pesan: "Chrome menjawab tidak ada pembaruan." };
        }
        if (m.jenis === "muat-ulang") {
          return m.paksa ? { ok: true, keadaan: "dimuat_ulang", pesan: "Ekstensi sedang dimuat ulang dari berkasnya." } : TAHAN;
        }
        return {};
      },
    });
    await tenang(p);
    el<HTMLButtonElement>(p, "perbaruiSekarang").click();
    await sampai(() => /Tetap perbarui/.test(el(p, "perbaruiSekarang").textContent || ""), "tahan pertama");
    el<HTMLButtonElement>(p, "perbaruiSekarang").click();
    await sampai(() => el(p, "muatUlangEkstensi").hidden === false, "muat ulang ditawarkan");
    el<HTMLButtonElement>(p, "muatUlangEkstensi").click();
    await sampai(() => p.pesan.some((m) => m.jenis === "muat-ulang"), "muat ulang dikirim");
    // Petugas SUDAH menyetujui putarannya hilang - sama dengan alatJalankanPembaruan di panel.
    expect(p.pesan.find((m) => m.jenis === "muat-ulang")).toEqual({ sumber: "aleta-panel", jenis: "muat-ulang", paksa: true });
    await sampai(() => /dimuat ulang dari berkasnya/.test(el(p, "perbaruiKabar").textContent || ""), "kabar dimuat ulang");
  });

  it("muat ulang tanpa paksa yang ditahan putaran: kalimatnya tampil, tekanan kedua memaksa", async () => {
    const p = bukaPopup({
      latar: (m) => {
        if (m.jenis === "perbarui") return { ok: false, keadaan: "tidak_ada_pembaruan", pesan: "Chrome menjawab tidak ada pembaruan." };
        if (m.jenis === "muat-ulang") return m.paksa ? { ok: true, keadaan: "dimuat_ulang", pesan: "Ekstensi sedang dimuat ulang." } : TAHAN;
        return {};
      },
    });
    await tenang(p);
    el<HTMLButtonElement>(p, "perbaruiSekarang").click();
    await sampai(() => el(p, "muatUlangEkstensi").hidden === false, "muat ulang ditawarkan");
    const muat = el<HTMLButtonElement>(p, "muatUlangEkstensi");
    muat.click();
    await sampai(() => /Tetap muat ulang/.test(muat.textContent || ""), "label paksa");
    expect(el(p, "perbaruiKabar").textContent).toMatch(/3 dari 8 dokumen/);
    expect(muat.disabled).toBe(false);
    muat.click();
    await sampai(() => p.pesan.filter((m) => m.jenis === "muat-ulang").length === 2, "tekanan kedua");
    expect(p.pesan.filter((m) => m.jenis === "muat-ulang").at(-1)).toEqual({ sumber: "aleta-panel", jenis: "muat-ulang", paksa: true });
  });

  it("muat ulang GAGAL (keadaan putaran tidak terbaca): sebabnya tampil dan tombolnya hidup lagi", async () => {
    const p = bukaPopup({
      latar: (m) => {
        if (m.jenis === "perbarui") return { ok: false, keadaan: "ditahan", pesan: "Chrome menahan pemeriksaan pembaruan." };
        if (m.jenis === "muat-ulang") {
          return { ok: false, keadaan: "galat", pesan: "Keadaan putaran cetak relaas tidak terbaca, jadi ekstensi TIDAK dimuat ulang: x" };
        }
        return {};
      },
    });
    await tenang(p);
    el<HTMLButtonElement>(p, "perbaruiSekarang").click();
    await sampai(() => el(p, "muatUlangEkstensi").hidden === false, "muat ulang ditawarkan");
    const muat = el<HTMLButtonElement>(p, "muatUlangEkstensi");
    muat.click();
    await sampai(() => /TIDAK dimuat ulang/.test(el(p, "perbaruiKabar").textContent || ""), "sebab gagal");
    expect(muat.disabled, "tombol tidak boleh mati selamanya").toBe(false);
  });

  it("latar.js tidak menjawab sama sekali (undefined): tidak macet, jalan kedua ditawarkan", async () => {
    const p = bukaPopup({ latar: () => undefined });
    await tenang(p);
    el<HTMLButtonElement>(p, "perbaruiSekarang").click();
    await sampai(() => el(p, "muatUlangEkstensi").hidden === false, "muat ulang ditawarkan");
    expect(el(p, "perbaruiKabar").textContent).toMatch(/Tidak ada jawaban/);
    expect(el<HTMLButtonElement>(p, "perbaruiSekarang").disabled).toBe(false);
  });
});

// ============================================================================
describe("penyimpanan ekstensi menolak menulis: saklar tidak boleh berbohong", () => {
  it("Mode latihan (Admin): centang dikembalikan dan sebabnya disebut - latihan TIDAK menyala", async () => {
    const p = bukaPopup({ peran: "Admin", tolakTulis: (k) => k.includes("modeLatihan") });
    await tenang(p);
    await sampai(() => el(p, "bagianLatihan").hidden === false, "bagian latihan");
    const kotak = el<HTMLInputElement>(p, "modeLatihan");
    kotak.checked = true;
    kotak.dispatchEvent(new p.w.Event("change"));
    await sampai(() => kotak.checked === false, "centang dikembalikan");
    expect("modeLatihan" in p.simpanan).toBe(false);
    expect(el(p, "latihanKet").textContent).toMatch(/[Mm]ati/);
    expect(p.d.body.textContent).toMatch(/tidak tersimpan/i);
  });

  it("Izinkan tindakan nyata (Super Admin, Baru): mematikannya yang gagal tidak membuat popup berkata 'mode coba'", async () => {
    const p = bukaPopup({
      peran: "Super Admin",
      simpan: { ujiTampilan: "baru", ujiIzinkanNyata: true },
      tolakTulis: (k) => k.includes("ujiIzinkanNyata"),
    });
    await tenang(p);
    await sampai(() => el(p, "bagianUji").hidden === false, "bagian uji");
    const kotak = el<HTMLInputElement>(p, "ujiIzinkanNyata");
    expect(kotak.checked).toBe(true);
    kotak.checked = false;
    kotak.dispatchEvent(new p.w.Event("change"));
    await sampai(() => kotak.checked === true, "centang dikembalikan");
    expect(p.simpanan.ujiIzinkanNyata).toBe(true);
    expect(el(p, "ujiKet").textContent).toMatch(/DIIZINKAN/);
    expect(p.d.body.textContent).toMatch(/tidak tersimpan/i);
  });

  it("saklar induk dan checklist: centang dikembalikan, sebab disebut; tulisan yang berhasil sesudahnya menghapus kabarnya", async () => {
    let tolak = true;
    // UIBARU-WAJIB 12 Okt: Super Admin - susunan Lama/Baru yang diuji di sini hanya miliknya.
    const p = bukaPopup({ peran: "Super Admin", tolakTulis: () => tolak });
    await tenang(p);
    const induk = el<HTMLInputElement>(p, "aktif");
    expect(induk.checked).toBe(true);
    induk.checked = false;
    induk.dispatchEvent(new p.w.Event("change"));
    await sampai(() => induk.checked === true, "induk dikembalikan");
    expect("aktif" in p.simpanan).toBe(false);
    expect(p.d.body.textContent).toMatch(/tidak tersimpan/i);

    const cl = el<HTMLInputElement>(p, "checklistMilestone");
    cl.checked = true;
    cl.dispatchEvent(new p.w.Event("change"));
    await sampai(() => cl.checked === false, "checklist dikembalikan");

    tolak = false;
    cl.checked = true;
    cl.dispatchEvent(new p.w.Event("change"));
    await sampai(() => p.simpanan.checklistMilestone === true, "tersimpan");
    await tunggu(20);
    expect(cl.checked).toBe(true);
    const sesudahChecklist = cl.closest("label")!.nextElementSibling;
    expect(sesudahChecklist?.hasAttribute("data-gagal-simpan"), "kabar gagal checklist hilang").toBe(false);
    // Kabar saklar induk tetap ada: tulisannya memang belum berhasil.
    const sesudahInduk = induk.closest("label")!.nextElementSibling;
    expect(sesudahInduk?.getAttribute("data-gagal-simpan")).toBe("ya");
  });

  it("penyimpanan normal: tidak ada kabar gagal sama sekali", async () => {
    const p = bukaPopup({ peran: "Hakim" });
    await tenang(p);
    const induk = el<HTMLInputElement>(p, "aktif");
    induk.checked = false;
    induk.dispatchEvent(new p.w.Event("change"));
    await sampai(() => p.simpanan.aktif === false, "tersimpan");
    await tunggu(20);
    expect(p.d.querySelectorAll("[data-gagal-simpan]").length).toBe(0);
  });
});

// ============================================================================
describe("popup-13 Kembalikan posisi dengan pilihan: sudut widget milik widget", () => {
  const POSISI = {
    posisiPanel: { kiri: 1 },
    posisiPanelAbt: { kiri: 1 },
    posisiPanelAbtMassal: { kiri: 1 },
    posisiPanelAleta: { kiri: 1 },
    posisiChecklistSipp: { kiri: 1 },
    posisiChecklistAbt: { kiri: 1 },
    posisiChecklistAleta: { kiri: 1 },
    sudutWidget: { sipp: "kanan-atas", abt: "kanan-bawah" },
  };
  const pilih = async (panel: boolean, widget: boolean) => {
    const p = bukaPopup({ simpan: { ujiTampilan: "baru", ujiFitur: { "popup-13": true }, ...POSISI } });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbPosisi-widget") !== null, "pilihan");
    el<HTMLInputElement>(p, "tbPosisi-panel").checked = panel;
    el<HTMLInputElement>(p, "tbPosisi-widget").checked = widget;
    el<HTMLButtonElement>(p, "resetPosisi").click();
    await sampai(() => !el(p, "kabarReset").hidden, "kabar");
    return p;
  };

  it("hanya widget: sudut yang diingat ikut dilupakan (widget kembali ke kiri bawah), panel utuh", async () => {
    const p = await pilih(false, true);
    for (const k of ["posisiChecklistSipp", "posisiChecklistAbt", "posisiChecklistAleta", "sudutWidget"]) {
      expect(k in p.simpanan, k).toBe(false);
    }
    for (const k of ["posisiPanel", "posisiPanelAbt", "posisiPanelAbtMassal", "posisiPanelAleta"]) expect(k in p.simpanan, k).toBe(true);
  });

  it("hanya panel: sudut widget TIDAK disentuh - 'Widget checklist dibiarkan di tempatnya'", async () => {
    const p = await pilih(true, false);
    expect(p.simpanan.sudutWidget).toEqual(POSISI.sudutWidget);
    expect("posisiPanel" in p.simpanan).toBe(false);
    expect(el(p, "kabarReset").textContent).toMatch(/Widget checklist dibiarkan/);
  });
});
