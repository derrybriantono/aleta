// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TOMBOL "KASIR ALETA" DI SIPP > JURNAL KEUANGAN PERKARA (T3, 23 Okt 2026)
 * ============================================================================
 *
 * panel-alat.js, basmassal.js (tampilan Kasir yang SAMA dengan tab Kasir), popup-aksi.js, dan kasir-jurnal-popup.js
 * dijalankan sungguhan di jsdom atas replika halaman jurnal keuangan SIPP (judul + nomor perkara + perkara_id).
 * Yang dijaga:
 *   - kasir/Admin: tombol ada di bawah judul; membuka POP-UP berisi Kasir per perkara (GET kasir?perkaraId=...);
 *     satu klik di luar kotak tidak menutup, klik DUA KALI / Escape DUA KALI menutup; tombol tulis hidup;
 *   - pengawas (panitera/panmud): tombol ada, tetapi isinya hanya membaca - Pratinjau/Simpan mati, tidak ada POST;
 *   - hakim / peran lain / Tampilan Lama / halaman lain: tidak ada tombol;
 *   - daftar jurnal: Kasir harian; selama simpan berjalan penutupan DITAHAN;
 *   - warna: gaya tombol memakai token --s-* (cadangan di var()), tanpa angka warna di aturan tema gelap.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const KASIR = baca("basmassal.js");
const POPUP = baca("popup-aksi.js");
const TOMBOL = baca("kasir-jurnal-popup.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "450/Pdt.G/2026/PA.Dgl";
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

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  jalur?: string;
  halaman?: "perkara" | "daftar" | "lain";
  peran?: string;
  bolehKasir?: boolean;
  bolehMengerjakanKasir?: boolean;
  peranTambahan?: string[];
  tampilan?: "ui" | "lama";
  /** POST kasir ditahan sampai dilepas (menguji penutupan ditahan selama simpan). */
  tahanPost?: boolean;
};

function buka(o: Opsi = {}) {
  const halaman = o.halaman ?? "perkara";
  const jalur = o.jalur ?? (halaman === "perkara" ? "/SIPP/detil_biaya/ZW5jQ29udG9o" : halaman === "daftar" ? "/SIPP/jurnal_perkara_list" : "/SIPP/main");
  const isi =
    halaman === "perkara"
      ? `<h3>BUKU JURNAL KEUANGAN PERKARA GUGATAN TINGKAT PERTAMA</h3><p>Nomor Perkara ${NOMOR}</p><input type="hidden" name="perkara_id" value="9950"><table id="jurnal"><tr><th>No</th></tr></table>`
      : halaman === "daftar"
        ? `<h3>JURNAL KEUANGAN PERKARA PERDATA GUGATAN/PERMOHONAN</h3><table><tr><th>No</th><th>Nomor Perkara</th></tr><tr><td>1</td><td>${NOMOR}</td></tr></table>`
        : `<h3>DASHBOARD PERKARA PERTAMA</h3>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${isi}</div></body></html>`, {
    url: `${ASAL}${jalur}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: o.tampilan ?? "ui", ujiIzinkanNyata: true };
  w.chrome = {
    runtime: { id: "uji", getManifest: () => ({ version: "1.205.38" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (x: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(x))),
        remove: async (k: string | string[]) => void [k].flat().forEach((n) => delete simpanan[n]),
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  const permintaan: Array<{ metode: string; alamat: string; badan: any }> = [];
  let lepasPost: () => void = () => undefined;
  const tahan = new Promise<void>((r) => (lepasPost = r));
  const jawab = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => ({ ok: status < 400, data }) });
  const ambilTiruan = async (alamat: string, opsi: any) => {
    const metode = String((opsi && opsi.method) || "GET").toUpperCase();
    permintaan.push({ metode, alamat, badan: opsi && typeof opsi.body === "string" ? JSON.parse(opsi.body) : null });
    if (/\/sidang\/kasir\?perkaraId=/.test(alamat)) {
      return jawab({
        available: true,
        ok: true,
        saldo: 500000,
        hariIni: "2026-10-23",
        perkara: { perkaraId: 9950, nomorPerkara: NOMOR },
        akun: { ok: true, username: "kasir.satu" },
        keadaan: { nama: "Sidang pertama", lazim: [] },
        bolehUbah: o.bolehMengerjakanKasir === false ? false : true,
        usulan: [{ pilih: true, tanggal: "2026-10-20", uraian: "Biaya Panggilan Tergugat", jumlah: 90000, jenisBiayaId: 14, peristiwa: "panggilan", dasar: "sidang pertama", yakin: "tinggi" }],
      });
    }
    if (/\/sidang\/kasir$/.test(alamat) && metode === "POST") {
      if (o.tahanPost) await tahan;
      return jawab({ available: true, ok: true, hasil: [{ ok: true }] });
    }
    return jawab({ available: true, ok: true, pengingat: [], perkara: [], rekap: null, setelan: {}, bolehUbah: o.bolehMengerjakanKasir !== false }, 200);
  };
  const pengguna: Record<string, unknown> = { nama: "Uji", peran: o.peran ?? "Super Admin" };
  if (typeof o.bolehKasir === "boolean") pengguna.bolehKasir = o.bolehKasir;
  if (typeof o.bolehMengerjakanKasir === "boolean") pengguna.bolehMengerjakanKasir = o.bolehMengerjakanKasir;
  if (o.peranTambahan) pengguna.peranTambahan = o.peranTambahan;
  Object.assign(w, { alatAmbil: ambilTiruan });
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  Object.assign(w, { alatAmbil: ambilTiruan });
  // Pengganti konten.js: akun ALETA yang masuk (konten.js sendiri diuji di uji lain).
  vm.runInContext(`var penggunaTerakhir = ${JSON.stringify(pengguna)}; async function muatPenggunaAleta() { return penggunaTerakhir; }`, ctx);
  vm.runInContext(KASIR, ctx, { filename: "basmassal.js" });
  vm.runInContext(POPUP, ctx, { filename: "popup-aksi.js" });
  vm.runInContext(TOMBOL, ctx, { filename: "kasir-jurnal-popup.js" });
  return { w, d: w.document as Document, permintaan, lepasPost };
}
type Halaman = ReturnType<typeof buka>;

const tombolDari = (h: Halaman) => h.d.getElementById("aleta-kj-tombol") as HTMLButtonElement | null;
const kotak = (h: Halaman) => h.d.querySelector('[data-pa="kotak"]') as HTMLElement | null;
const latar = (h: Halaman) => h.d.querySelector('[data-pa="latar"]') as HTMLElement | null;
const tekan = (h: Halaman, key: string) => h.d.dispatchEvent(new h.w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const klikGanda = (h: Halaman, e: HTMLElement) => e.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true, cancelable: true }));
const tombolTeks = (akar: ParentNode, teks: RegExp) => Array.from(akar.querySelectorAll("button")).find((b) => teks.test(b.textContent || "")) as HTMLButtonElement | undefined;

const KASIR_PENUH = { peran: "Kasir", bolehKasir: true, bolehMengerjakanKasir: true, peranTambahan: ["kasir"] };
const PENGAWAS = { peran: "Panitera", bolehKasir: true, bolehMengerjakanKasir: false };

describe("1. Kasir: tombol di bawah judul, pop-up berisi Kasir per perkara", () => {
  it("tombol terpasang tepat setelah judul; klik membuka pop-up dengan jurnal perkara_id halaman ini", async () => {
    const h = buka(KASIR_PENUH);
    const tb = await sampai(() => tombolDari(h), "tombol Kasir ALETA");
    expect(tb.textContent).toBe("Kasir ALETA");
    const judul = h.d.querySelector("h3")!;
    expect(judul.nextElementSibling?.contains(tb)).toBe(true);
    expect(h.d.querySelectorAll("#aleta-kj-tombol")).toHaveLength(1);
    expect(kotak(h)).toBeNull();

    tb.click();
    const k = await sampai(() => kotak(h), "pop-up terbuka");
    expect(tb.getAttribute("aria-expanded")).toBe("true");
    expect(k.querySelector(".aleta-pa-judul")!.textContent).toContain(NOMOR);
    await sampai(() => k.querySelector('[data-aleta-kasir="perkara"] .aleta-kasir-kejadian-daftar, [data-aleta-kasir="perkara"] table'), "isi Kasir per perkara");
    expect(h.permintaan.some((p) => p.metode === "GET" && /kasir\?perkaraId=9950$/.test(p.alamat))).toBe(true);
    // tombol tulis hidup untuk pelaksana
    const simpan = tombolTeks(k, /Simpan/)!;
    expect(simpan).toBeTruthy();
    expect(simpan.disabled).toBe(false);
    expect(k.querySelector("[data-kasir-baca]")).toBeNull();
  });

  it("tutup: satu klik di luar tidak menutup; klik dua kali di luar menutup; Esc dua kali menutup; bisa dibuka lagi", async () => {
    const h = buka(KASIR_PENUH);
    const tb = await sampai(() => tombolDari(h), "tombol");
    tb.click();
    await sampai(() => kotak(h), "terbuka");
    latar(h)!.click();
    expect(kotak(h)).not.toBeNull();
    klikGanda(h, latar(h)!);
    expect(kotak(h)).toBeNull();
    expect(tb.getAttribute("aria-expanded")).toBe("false");

    tb.click();
    await sampai(() => kotak(h), "dibuka lagi");
    tekan(h, "Escape");
    expect(kotak(h)).not.toBeNull();
    expect((h.d.querySelector('[data-pa="tanya"]') as HTMLElement).hidden).toBe(false);
    tekan(h, "Escape");
    expect(kotak(h)).toBeNull();
    // Isi diparkir (tersembunyi) oleh popup-aksi.js, bukan dibuang: tidak tampak di halaman.
    for (const e of Array.from(h.d.querySelectorAll('[data-aleta-kasir="perkara"]'))) expect(e.closest("[hidden]")).not.toBeNull();
  });

  it("Admin dan Super Admin juga mendapat tombol penuh", async () => {
    for (const peran of ["Admin", "Super Admin"]) {
      const h = buka({ peran });
      const tb = await sampai(() => tombolDari(h), `tombol ${peran}`);
      tb.click();
      const k = await sampai(() => kotak(h), `pop-up ${peran}`);
      const simpan = await sampai(() => tombolTeks(k, /Simpan/), `Simpan ${peran}`);
      expect(simpan.disabled, peran).toBe(false);
    }
  });

  it("selama simpan berjalan penutupan ditahan dengan pesan, lalu menutup setelah selesai", async () => {
    const h = buka({ ...KASIR_PENUH, tahanPost: true });
    const tb = await sampai(() => tombolDari(h), "tombol");
    tb.click();
    const k = await sampai(() => kotak(h), "terbuka");
    const simpan = await sampai(() => tombolTeks(k, /Simpan ke SIPP/), "Simpan");
    simpan.click(); // pertama: minta ketik sekali lagi
    const yakin = await sampai(() => tombolTeks(k, /Tekan sekali lagi/), "konfirmasi simpan");
    yakin.click();
    await sampai(() => h.permintaan.some((p) => p.metode === "POST"), "POST terkirim");
    klikGanda(h, latar(h)!);
    expect(kotak(h)).not.toBeNull();
    expect((h.d.querySelector('[data-pa="pesan"]') as HTMLElement).textContent).toMatch(/Sedang bekerja/);
    h.lepasPost();
    await sampai(() => !k.querySelector("[data-kasir-sibuk]"), "simpan selesai");
    klikGanda(h, latar(h)!);
    expect(kotak(h)).toBeNull();
  });
});

describe("2. Pengawas (panitera/panmud): membaca saja", () => {
  it("tombol ada; isi pop-up bermode baca; Pratinjau & Simpan mati; tidak satu pun POST", async () => {
    const h = buka(PENGAWAS);
    const tb = await sampai(() => tombolDari(h), "tombol pengawas");
    tb.click();
    const k = await sampai(() => kotak(h), "terbuka");
    await sampai(() => tombolTeks(k, /Simpan/), "isi Kasir");
    expect(k.querySelector(".aleta-kj-baca")!.textContent).toMatch(/Mode baca/);
    expect(k.querySelector("[data-kasir-baca]")).not.toBeNull();
    for (const b of [tombolTeks(k, /Simpan/)!, tombolTeks(k, /Pratinjau/)!]) {
      expect(b.disabled).toBe(true);
      b.click();
    }
    await tunggu(30);
    expect(h.permintaan.filter((p) => p.metode === "POST")).toHaveLength(0);
  });

  it("tanpa jawaban server pun, panitera/panitera muda dikenali pengawas dari nama peran; peran tambahan kasir = pelaksana", async () => {
    const h = buka({ peran: "Panitera Muda", bolehKasir: undefined });
    const tb = await sampai(() => tombolDari(h), "tombol");
    tb.click();
    const k = await sampai(() => kotak(h), "terbuka");
    await sampai(() => k.querySelector(".aleta-kj-baca"), "mode baca");
    const h2 = buka({ peran: "Panitera", peranTambahan: ["kasir"] });
    const tb2 = await sampai(() => tombolDari(h2), "tombol 2");
    tb2.click();
    const k2 = await sampai(() => kotak(h2), "terbuka 2");
    const simpan = await sampai(() => tombolTeks(k2, /Simpan/), "Simpan 2");
    expect(simpan.disabled).toBe(false);
    expect(k2.querySelector(".aleta-kj-baca")).toBeNull();
  });
});

describe("3. Yang tidak mendapat tombol", () => {
  it("hakim, panitera pengganti, dan peran tanpa hak Kasir", async () => {
    for (const peran of ["Hakim", "Panitera Pengganti", "Juru Sita"]) {
      const h = buka({ peran, bolehKasir: false });
      await tunggu(120);
      expect(tombolDari(h), peran).toBeNull();
    }
  });
  it("Tampilan Lama dan halaman yang bukan jurnal keuangan", async () => {
    const lama = buka({ ...KASIR_PENUH, tampilan: "lama" });
    await tunggu(120);
    expect(tombolDari(lama)).toBeNull();
    const lain = buka({ ...KASIR_PENUH, halaman: "lain" });
    await tunggu(120);
    expect(tombolDari(lain)).toBeNull();
  });
});

describe("4. Daftar jurnal keuangan: Kasir harian", () => {
  it("tombol di bawah judul daftar; pop-up memuat Kasir harian (otomatis, pengingat, massal, rekap)", async () => {
    const h = buka({ ...KASIR_PENUH, halaman: "daftar" });
    const tb = await sampai(() => tombolDari(h), "tombol daftar");
    expect(h.d.querySelector("h3")!.nextElementSibling?.contains(tb)).toBe(true);
    tb.click();
    const k = await sampai(() => kotak(h), "terbuka");
    await sampai(() => k.querySelector('[data-aleta-kasir="harian"]'), "Kasir harian");
    expect(k.querySelector(".aleta-pa-judul")!.textContent).toBe("Kasir ALETA · Jurnal Keuangan Perkara");
    expect(k.querySelectorAll("details.aleta-kasir-bagian").length).toBeGreaterThanOrEqual(4);
  });
});

describe("5. Warna ikut tema (gaya)", () => {
  const CSS = baca("kasir-jurnal-popup.css");
  it("tombol memakai token --s-* dengan cadangan di dalam var(); tanpa aturan tema gelap berangka warna; huruf >= 11,5px", () => {
    expect(CSS).toMatch(/var\(--s-hijau, #[0-9a-f]{6}\)/i);
    const aturanGelap = CSS.split("}").filter((a) => /tema-sipp="gelap"|prefers-color-scheme: dark/.test(a));
    for (const a of aturanGelap) expect(a).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    for (const m of CSS.matchAll(/font-size:\s*([\d.]+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(11.5);
  });
  it("tidak menambah aturan sesudah blok V2 LAYAR di panel.css (berkas tidak berubah ujungnya)", () => {
    const panel = baca("panel.css");
    expect(panel).not.toMatch(/aleta-kj-/);
  });
});
