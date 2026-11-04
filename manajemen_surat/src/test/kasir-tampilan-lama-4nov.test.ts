// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { KUNCI_SETELAN, kunciSetelanSah, normalkanSetelan, BATAS_BITA_SETELAN } from "@/lib/tampilan-ekstensi";
import { KUNCI_SETELAN_KASIR, kunciSalinanKasir, pilihanKasirDari } from "@/lib/kasir-tampilan-pilihan";

/**
 * ============================================================================
 * KASIR 4 NOV 2026: PILIHAN "TAMPILAN LAMA / TAMPILAN BARU" PER PENGGUNA (ekstensi dan setelan akun)
 * ============================================================================
 *
 * Yang dijaga:
 *   1. setelan akun "kasir.tampilan" (diizinkan, divalidasi, bawaan baru);
 *   2. tampilan lama di ekstensi menghasilkan DOM yang SAMA dengan basmassal.js rilis-1.205.71 (dibaca dari git;
 *      dilewati bila tag tidak ada) - berarti tidak ada fitur lama yang berkurang;
 *   3. tampilan baru tetap bawaan; tombol pilihan menyimpan ke akun dan memasang ulang;
 *   4. aturan CSS tampilan baru hanya berlaku bila akar Kasir berkelas aleta-kasir-baru (lama tidak terpengaruh).
 * SELURUH data REKAAN.
 */

const AKAR = path.resolve(process.cwd(), "..");
const EKS = path.join(AKAR, "ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_BARU = ["panel-alat.js", "basmassal.js"].map(baca).join("\n;\n");
const CSS = baca("panel.css");

function dariTag(berkas: string): string | null {
  try {
    return execFileSync("git", ["show", `rilis-1.205.71:ekstensi-sipp/${berkas}`], { cwd: AKAR, maxBuffer: 64 * 1024 * 1024 }).toString("utf8").replace(/\r\n/g, "\n");
  } catch {
    return null;
  }
}
const panelTag = dariTag("panel-alat.js");
const basTag = dariTag("basmassal.js");
const SUMBER_LAMA = panelTag && basTag ? `${panelTag}\n;\n${basTag}` : null;

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 5000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}

const HARI = "2026-11-03";
const usulan = (kunci: string, uraian: string, jumlah: number, ekstra: Record<string, unknown> = {}) => ({
  kunci, jenisBiayaId: 157, kategoriId: 13, jenisTransaksi: -1, pihakKe: 2, pihakId: 12, uraian, jumlah, tanggal: HARI, keterangan: "", jurusitaId: 0,
  peristiwa: "Putusan", dasar: "kebiasaan", yakin: "tinggi", pilih: true, perluResi: false, sisaOtomatis: false, tersedia: true, ...ekstra,
});

const dom: JSDOM[] = [];
afterEach(async () => {
  await tunggu(60);
  while (dom.length) dom.pop()!.window.close();
});

type Opsi = { sumber: string; setelan?: "lama" | "baru" | null; putLog?: Array<Record<string, unknown>>; setelanGagal?: boolean };

function buka(o: Opsi) {
  const d = new JSDOM(`<!doctype html><html><body><div id="wadah"></div></body></html>`, {
    url: "http://192.168.10.10/SIPP/jurnal_perkara_list/ENC",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  dom.push(d);
  const w = d.window as any;
  w.chrome = {
    runtime: { id: "x", getManifest: () => ({ version: "1.205.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: (_m: unknown, b?: (x: unknown) => void) => setTimeout(() => b && b({ ok: true }), 0) },
    storage: {
      local: { get: async () => ({ ujiTampilan: "baru", modeKering: false }), set: async () => undefined, remove: async () => undefined },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const akunKasir = { akunKasir: true, ok: true, username: "kasir_uji", nama: "Tiara Rekaan, A.Md.", calon: [], milik: [], dipilih: "", bolehPilih: false };
  w.fetch = async (alamat: string, init?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const data = (isi: unknown) => Response.json({ ok: true, data: isi });
    if (/\/ekstensi\/setelan/.test(url)) {
      if (init?.method === "PUT") {
        if (o.setelanGagal) return new Response("{}", { status: 500 });
        o.putLog?.push(JSON.parse(String(init.body)));
        return data({ kunci: "kasir.tampilan" });
      }
      if (o.setelanGagal) return new Response("{}", { status: 500 });
      return data({ setelan: o.setelan ? { "kasir.tampilan": { nilai: { tampilan: o.setelan }, diubahPada: "2026-11-04T01:00:00.000Z" } } : {} });
    }
    if (/\/pembayaran-ecourt\?/.test(url)) {
      return data({ ok: true, perkara: { "601/Pdt.G/2026/PA.Xyz": { nomorPerkara: "601/Pdt.G/2026/PA.Xyz", diterimaDari: "Budi Rekaan, S.H.", nomorRekening: "9900112233", atasNama: "", bank: "BNI", panjar: 355000, status: "Sudah dibayar", tanggal: "2026-11-01", jam: "10:12:00", adaSkum: true } } });
    }
    if (/\/kasir\/harian\?/.test(url)) {
      return data({
        available: true, ok: true, tanggal: HARI, hariIni: HARI, jumlahCalon: 4, gagal: [{ nomorPerkara: "x" }], terpotong: false, akun: akunKasir,
        lengkap: [{ perkaraId: 603, nomorPerkara: "603/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Talak", keadaan: { nama: "Putus verstek" }, sebab: ["putusan"], saldo: 0 }],
        perkara: [
          {
            perkaraId: 601, nomorPerkara: "601/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Gugat", keadaan: { nama: "Dalam persidangan" }, sebab: ["sidang"], saldo: 300000, perluPeriksa: true,
            usulan: [usulan("u1", "Redaksi", 10000), usulan("u2", "Meterai", 10000, { yakin: "rendah" })], catatan: [],
            tawaranPbt: [usulan("pbt1", "Biaya Pemberitahuan", 29500)], alasanTanpaPbt: "Putusan verstek belum diberitahukan.",
          },
          { perkaraId: 602, nomorPerkara: "602/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Talak", keadaan: { nama: "Putus verstek" }, sebab: ["putusan"], saldo: 100000, perluPeriksa: false, usulan: [usulan("u1", "Redaksi", 10000)], catatan: [] },
        ],
      });
    }
    if (/\/kasir\/psp\?/.test(url)) {
      return data({
        available: true, ok: true, dari: HARI, sampai: HARI, jumlah: 2, total: 80000, rekeningDisembunyikan: false,
        daftar: [
          { nomorPerkara: "601/Pdt.G/2026/PA.Xyz", tanggal: HARI, penerima: "Budi Rekaan", kuasa: "", ecourt: true, jumlah: 50000, rekening: { diterimaDari: "Budi Rekaan", bank: "BNI", nomorRekening: "9900112233" } },
          { nomorPerkara: "602/Pdt.G/2026/PA.Xyz", tanggal: HARI, penerima: "Siti Rekaan", kuasa: "", ecourt: false, jumlah: 30000, rekening: null },
        ],
      });
    }
    if (/\/kasir\/instrumen\?/.test(url)) return data({ available: true, ok: true, dari: HARI, sampai: HARI, kelompok: [] });
    if (/\/kasir\/otomatis\?/.test(url)) return data({ available: true, ok: true, tanggal: HARI, hariIni: HARI, bolehUbah: true, setelan: { nyala: false, butir: {} }, butirDaftar: [], perkara: [], gagal: [], ringkas: { perkara: 0, akanDiisi: 0, baris: 0 }, akun: akunKasir });
    if (/\/kasir\/pengingat/.test(url)) return data({ available: true, ok: true, hariIni: HARI, butir: [], ringkas: {} });
    if (/\/kasir\/riwayat\?/.test(url)) return data({ available: true, ok: true, jumlah: 0, pekerjaan: [] });
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.eval(`${o.sumber}\n;window.__mode = () => alatUjiMode(); alatCobaMenahan = () => false;`);
  return { w, wadah: w.document.getElementById("wadah") as HTMLElement };
}

/** Memasang Kasir, membuka Kasir Manual dan Cetak, menunggu terbaca; mengembalikan akar. */
async function pasangDanBuka(h: ReturnType<typeof buka>) {
  await sampai(() => h.w.__mode() === "baru", "mode baru");
  expect(await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" })).toBe(true);
  const akar = h.wadah.querySelector(".aleta-kasir-harian") as HTMLElement;
  const bagianBaru = akar.hasAttribute("data-kasir-tab");
  if (bagianBaru) {
    (akar.querySelector('[data-kasir-tab-ke="hari"]') as HTMLButtonElement).click();
  } else {
    for (const k of ["manual", "cetak"]) {
      const d = akar.querySelector(`details[data-kasir-bagian="${k}"]`) as HTMLDetailsElement;
      d.open = true;
      d.dispatchEvent(new h.w.Event("toggle"));
    }
  }
  await sampai(() => akar.querySelector('[data-perkara="601"] tr[data-usulan="u1"]'), "kartu");
  if (bagianBaru) (akar.querySelector('[data-kasir-tab-ke="psp"]') as HTMLButtonElement).click();
  await sampai(() => akar.querySelector('[data-kasir-cetak="psp"] table'), "tabel psp");
  await tunggu(80);
  return akar;
}

/** DOM yang dibandingkan: tanpa tombol pilihan tampilan (hanya ada di sumber baru). */
function bentukDom(akar: HTMLElement): string {
  const salin = akar.cloneNode(true) as HTMLElement;
  for (const e of Array.from(salin.querySelectorAll(".aleta-kasir-pilih-tampilan, .aleta-kasir-pilih-baris"))) e.remove();
  return salin.innerHTML.replace(/\s+/g, " ");
}

describe("1. setelan akun kasir.tampilan dan pilihan", () => {
  it("kunci diizinkan; hanya 'baru' atau 'lama' sah; ruas lain dibuang; batas ukuran kecil", () => {
    expect(KUNCI_SETELAN).toContain(KUNCI_SETELAN_KASIR);
    expect(kunciSetelanSah("kasir.tampilan")).toBe(true);
    expect(BATAS_BITA_SETELAN["kasir.tampilan"]).toBeLessThanOrEqual(256);
    expect(normalkanSetelan("kasir.tampilan", { tampilan: "lama" }).nilai).toEqual({ tampilan: "lama" });
    expect(normalkanSetelan("kasir.tampilan", { tampilan: "baru", lain: 1 }).dibuang).toEqual(["lain"]);
    expect(() => normalkanSetelan("kasir.tampilan", { tampilan: "ungu" })).toThrow();
    expect(() => normalkanSetelan("kasir.tampilan", "lama")).toThrow();
  });

  it("pilihanKasirDari: bentuk obyek atau teks; tak dikenal = null (pemanggil memakai bawaan baru)", () => {
    expect(pilihanKasirDari({ tampilan: "lama" })).toBe("lama");
    expect(pilihanKasirDari("baru")).toBe("baru");
    expect(pilihanKasirDari({ tampilan: "x" })).toBeNull();
    expect(pilihanKasirDari(undefined)).toBeNull();
    expect(kunciSalinanKasir("usr_1/../x")).toBe("aleta.kasir.tampilan.usr_1x");
  });
});

describe("2. ekstensi: tampilan lama = basmassal.js rilis 1.205.71", () => {
  const ada = SUMBER_LAMA !== null;
  (ada ? it : it.skip)("DOM Kasir Manual + Cetak (PSP) tampilan lama identik dengan rilis 1.205.71", async () => {
    const lama = buka({ sumber: SUMBER_LAMA as string });
    const domLama = bentukDom(await pasangDanBuka(lama));
    const baruMemilihLama = buka({ sumber: SUMBER_BARU, setelan: "lama" });
    const domBaruLama = bentukDom(await pasangDanBuka(baruMemilihLama));
    expect(domBaruLama.length).toBeGreaterThan(1500);
    expect(domBaruLama).toBe(domLama);
  });

  it("tampilan lama: tanpa bilah tab, tanpa kelas tampilan baru, bab berlipat seperti dulu", async () => {
    const h = buka({ sumber: SUMBER_BARU, setelan: "lama" });
    const akar = await pasangDanBuka(h);
    expect(akar.classList.contains("aleta-kasir-baru")).toBe(false);
    expect(akar.querySelector(".aleta-kasir-tab")).toBeNull();
    expect(akar.hasAttribute("data-kasir-tab")).toBe(false);
    expect(akar.querySelectorAll(":scope > details.aleta-kasir-bagian > summary").length).toBe(6);
    expect(akar.querySelector(".aleta-kasir-ringkas, .aleta-kasir-kaki, .aleta-kasir-cari-perkara")).toBeNull();
    // Tombol simpan lama tetap ada (dua tombol, tanpa kaki lengket).
    const tombolAksi = Array.from(akar.querySelectorAll('details[data-kasir-bagian="manual"] .aleta-basmassal-aksi button')).map((x) => x.textContent || "");
    expect(tombolAksi).toHaveLength(2);
    expect(tombolAksi[0]).toBe("Pratinjau");
    expect(tombolAksi[1]).toMatch(/^Simpan [0-9]+ perkara ke SIPP$/);
  });
});

describe("3. tampilan baru bawaan dan tombol pilihan", () => {
  it("tanpa pilihan tersimpan (atau server gagal) = tampilan baru dengan bilah tab dan kelas aleta-kasir-baru", async () => {
    for (const o of [{ setelan: null }, { setelanGagal: true }] as Array<Partial<Opsi>>) {
      const h = buka({ sumber: SUMBER_BARU, ...o });
      const akar = await pasangDanBuka(h);
      expect(akar.classList.contains("aleta-kasir-baru")).toBe(true);
      expect(akar.querySelectorAll(".aleta-kasir-tab-tombol").length).toBe(7);
      expect(akar.querySelector(".aleta-kasir-pilih-tampilan")).not.toBeNull();
    }
  });

  it("menekan 'Tampilan lama' menyimpan ke akun (PUT kasir.tampilan) lalu memasang ulang; kembali lagi ke 'Tampilan baru'", async () => {
    const putLog: Array<Record<string, unknown>> = [];
    const h = buka({ sumber: SUMBER_BARU, putLog });
    await pasangDanBuka(h);
    const klik = async (judul: string) => {
      const b = Array.from(h.wadah.querySelectorAll<HTMLButtonElement>(".aleta-kasir-pilih-tampilan-tombol")).find((x) => x.textContent === judul)!;
      b.click();
      await tunggu(120);
    };
    await klik("Tampilan lama");
    expect(putLog).toEqual([{ kunci: "kasir.tampilan", nilai: { tampilan: "lama" } }]);
    await sampai(() => h.wadah.querySelectorAll("details.aleta-kasir-bagian").length === 6 && !h.wadah.querySelector(".aleta-kasir-tab"), "tampilan lama terpasang");
    const aktif = Array.from(h.wadah.querySelectorAll(".aleta-kasir-pilih-tampilan-tombol")).filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(aktif.map((b) => b.textContent)).toEqual(["Tampilan lama"]);
    await klik("Tampilan baru");
    expect(putLog[1]).toEqual({ kunci: "kasir.tampilan", nilai: { tampilan: "baru" } });
    await sampai(() => h.wadah.querySelector(".aleta-kasir-tab"), "tampilan baru terpasang");
  });

  it("penyimpanan ke akun gagal: pilihan tetap berlaku di halaman ini (tidak melompat kembali)", async () => {
    const h = buka({ sumber: SUMBER_BARU, setelanGagal: true });
    await pasangDanBuka(h);
    Array.from(h.wadah.querySelectorAll<HTMLButtonElement>(".aleta-kasir-pilih-tampilan-tombol")).find((x) => x.textContent === "Tampilan lama")!.click();
    await sampai(() => h.wadah.querySelectorAll("details.aleta-kasir-bagian").length === 6 && !h.wadah.querySelector(".aleta-kasir-tab"), "lama walau gagal simpan");
  });
});

describe("4. CSS: aturan tampilan baru hanya untuk akar berkelas aleta-kasir-baru", () => {
  it("setiap aturan di blok 'KASIR 4 Nov 2026: tampilan baru' dijaga :where(.aleta-kasir-baru); token warna dan huruf >= 11.5px", () => {
    const a = CSS.indexOf("/* === KASIR 4 Nov 2026: tampilan baru Kasir ALETA");
    const b = CSS.indexOf("/* === AKHIR KASIR 4 Nov === */");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    const blok = CSS.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, "");
    const aturan = blok.match(/[^{}]+\{[^{}]*\}/g) ?? [];
    expect(aturan.length).toBeGreaterThan(60);
    for (const r of aturan) {
      const sel = r.slice(0, r.indexOf("{")).trim();
      if (sel.startsWith("@")) continue; // @media/@keyframes: isi dicek terpisah
      if (/^from|^to|^\d+%/.test(sel)) continue;
      for (const s of sel.split(",")) expect(s.trim(), s).toMatch(/:where\(\.aleta-kasir-baru\)|:where\(\.aleta-kasir-harian\.aleta-kasir-baru\)/);
    }
    expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const m of blok.matchAll(/font-size:\s*calc\((\d+(?:\.\d+)?)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(11.5);
    // Blok baru berada sebelum "V2 LAYAR".
    expect(b).toBeLessThan(CSS.indexOf("V2 LAYAR (18 Okt 2026)"));
  });

  it("pilihan tampilan berlaku di kedua tampilan (tidak dijaga) dan bertoken", () => {
    const a = CSS.indexOf("/* === KASIR 4 Nov 2026: pilihan Tampilan baru");
    const b = CSS.indexOf("/* === AKHIR PILIHAN TAMPILAN KASIR === */");
    const blok = CSS.slice(a, b);
    expect(blok).toContain(".aleta-kasir-pilih-tampilan");
    expect(blok).not.toContain("aleta-kasir-baru");
    expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(b).toBeLessThan(CSS.indexOf("V2 LAYAR (18 Okt 2026)"));
  });
});
