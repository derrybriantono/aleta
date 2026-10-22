/**
 * X1 (21 Okt 2026): popup ekstensi - tiap saklar di bagian yang BENAR.
 *
 * Yang dijaga:
 *   1. Tiap kunci saklar yang dibaca fitur muncul TEPAT SEKALI di popup dan
 *      berada di bagian menurut fungsinya (UI Baru); tidak ada saklar yatim
 *      di luar bagian.
 *   2. Mengubah saklar menyimpan kunci penyimpanan yang SAMA (kunci lama tidak
 *      berubah, bawaannya tetap).
 *   3. Tampilan per peran: saklar yang hanya untuk peran tertentu tidak tampil
 *      bagi peran lain; nilainya tetap tersimpan.
 *   4. Pembacanya benar-benar ada di berkas fiturnya; kunci per-akun terdaftar
 *      di popup.js dan latar.js; tabel docs/popup/SAKLAR.md memuat semuanya.
 *   5. Bagian dapat dilipat dan pilihannya diingat.
 *
 * popup.html + popup.js + popup-ide-l2.js dijalankan SUNGGUHAN di JSDOM.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const REPO = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const popupHtml = baca("popup.html");
const popupJs = baca("popup.js");
const popupL2Js = baca("popup-ide-l2.js");
const daftarFiturJs = baca("daftar-fitur.js");
const latarJs = baca("latar.js");
const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Baris = { id: string; kunci: string; bagian: string; bawaan: boolean; pembaca: string[] };
const L2 = (id: string): Baris => ({ id: `ideL2${id}`, kunci: `ideL2${id}`, bagian: "sipp", bawaan: true, pembaca: ["sipp-ide-l2.js"] });
/** SATU-SATUNYA tabel kebenaran: id kotak, kunci simpanan, bagian (kode kelompok UI Baru), bawaan, berkas pembaca. */
const TABEL: Baris[] = [
  { id: "panelRingkas", kunci: "panelRingkas", bagian: "tampilan", bawaan: false, pembaca: ["panel-alat.js"] },
  { id: "tandaiHalaman", kunci: "tandaiHalaman", bagian: "sipp", bawaan: true, pembaca: ["konten.js", "panel-alat.js"] },
  { id: "sisipJadwal", kunci: "sisipJadwal", bagian: "sipp", bawaan: false, pembaca: ["konten.js"] },
  { id: "pratinjauBasRelaas", kunci: "pratinjauBasRelaas", bagian: "sipp", bawaan: true, pembaca: ["pratinjau-bas-relaas.js"] },
  { id: "menuAtasSipp", kunci: "menuAtasSipp", bagian: "sipp", bawaan: true, pembaca: ["menu-atas.js"] },
  { id: "sippPenyatu", kunci: "sippPenyatu", bagian: "sipp", bawaan: true, pembaca: ["sipp-ide-m2.js"] },
  { id: "sippTampilDobel", kunci: "sippTampilDobel", bagian: "sipp", bawaan: false, pembaca: ["sipp-ide-m2.js"] },
  { id: "gembokSipp", kunci: "gembokKepalaSipp", bagian: "sipp", bawaan: false, pembaca: ["panel-alat.js"] },
  { id: "ideL2", kunci: "ideL2", bagian: "sipp", bawaan: true, pembaca: ["sipp-ide-l2.js"] },
  L2("Sita"),
  L2("Eksekusi"),
  L2("IzinCerai"),
  L2("Penetapan"),
  L2("BelumDitunda"),
  L2("Verstek"),
  L2("Umur"),
  L2("TanpaSidang"),
  L2("Ikrar"),
  L2("AktaCerai"),
  L2("LimaBulan"),
  L2("EcourtVerifikasi"),
  L2("PutusanEcourt"),
  { id: "suntingLangsungAbt", kunci: "suntingLangsungAbt", bagian: "abt", bawaan: false, pembaca: ["panel-alat.js"] },
  { id: "cetakTigaBerkas", kunci: "cetakTigaBerkas", bagian: "abt", bawaan: false, pembaca: ["abt.js", "panel-alat.js"] },
  { id: "gembokAbt", kunci: "gembokKepalaAbt", bagian: "abt", bawaan: false, pembaca: ["panel-alat.js", "blangko-derry.js"] },
  { id: "derryBawaan", kunci: "blangkoDerryBawaan", bagian: "derry", bawaan: false, pembaca: ["blangko-derry.js"] },
  { id: "derryTawar", kunci: "blangkoDerryTawar", bagian: "derry", bawaan: true, pembaca: ["blangko-derry.js"] },
  { id: "derrySaran", kunci: "blangkoDerrySaran", bagian: "derry", bawaan: true, pembaca: ["blangko-derry.js"] },
  { id: "derryIngat", kunci: "blangkoDerryIngat", bagian: "derry", bawaan: true, pembaca: ["blangko-derry.js", "abt.js"] },
  { id: "derryIsiOto", kunci: "blangkoDerryIsiOto", bagian: "derry", bawaan: true, pembaca: ["blangko-derry.js"] },
  { id: "derryTjJawab", kunci: "blangkoDerryTjJawab", bagian: "derry", bawaan: true, pembaca: ["blangko-derry.js"] },
  { id: "gembokAleta", kunci: "gembokKepalaAleta", bagian: "aleta", bawaan: false, pembaca: ["panel-alat.js"] },
  { id: "checklistMilestone", kunci: "checklistMilestone", bagian: "portal", bawaan: false, pembaca: ["checklist.js", "panel-alat.js"] },
  { id: "widgetKehadiran", kunci: "widgetKehadiran", bagian: "portal", bawaan: true, pembaca: ["checklist.js"] },
  { id: "widgetDrafH7", kunci: "widgetDrafH7", bagian: "portal", bawaan: true, pembaca: ["checklist.js"] },
  { id: "modeLatihan", kunci: "modeLatihan", bagian: "admin", bawaan: false, pembaca: ["panel-alat.js"] },
];
/** Di luar bagian pada UI Baru, dengan sengaja (kepala jendela dan blok uji Super Admin). */
const DI_LUAR_BAGIAN = new Set(["aktif", "ujiIzinkanNyata"]);
/** Dalam bagian tetapi bukan dari tabel saklar fitur (kunci disimpan dengan cara lain, diaudit di berkas uji lain). */
const SAKLAR_LAIN = new Set(["sembunyikanTeknis", "bawaanPanel-aleta", "bawaanPanel-sipp", "bawaanPanel-abt"]);

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaPopup(peran: string, simpan: Record<string, unknown> = {}, mode: "ui" | "lama" = "ui") {
  const html = popupHtml.replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { asalPortal: "http://192.168.10.10/aleta", ujiTampilan: mode, ...simpan };
  const salin = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.19" }), sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const x of daftar) if (x in simpanan) hasil[x] = salin(simpanan[x]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, salin(isi)),
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
      return { ok: true, status: 200, json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran }, versi: "1.205.19" } }) };
    }
    return { ok: true, status: 200, url: a, json: async () => ({}) };
  };
  const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
  vm.runInContext(daftarFiturJs, ctx, { filename: "daftar-fitur.js" });
  vm.runInContext(popupJs, ctx, { filename: "popup.js" });
  vm.runInContext(popupL2Js, ctx, { filename: "popup-ide-l2.js" });
  return { w, d: w.document as Document, simpanan };
}

async function sampai(syarat: () => boolean, apa: string) {
  const mulai = Date.now();
  while (!syarat()) {
    if (Date.now() - mulai > 3000) throw new Error(`tidak kunjung: ${apa}`);
    await tunggu(10);
  }
}

async function tenang(p: ReturnType<typeof bukaPopup>, bagian = "sipp") {
  await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
  await sampai(() => Boolean(p.d.getElementById(`kelompok-${bagian}`)), `bagian ${bagian} tersusun`);
  await tunggu(60);
}

const kotak = (p: ReturnType<typeof bukaPopup>, id: string) => p.d.getElementById(id) as HTMLInputElement;
const tersembunyi = (p: ReturnType<typeof bukaPopup>, id: string) => {
  const k = kotak(p, id);
  return Boolean(k.closest("[data-peran-sembunyi]"));
};
const bagianTersembunyi = (p: ReturnType<typeof bukaPopup>, kode: string) =>
  p.d.getElementById(`kelompok-${kode}`)!.hasAttribute("data-peran-sembunyi");

describe("X1 - saklar popup di bagian yang benar (UI Baru, Super Admin)", () => {
  it("tiap kunci saklar muncul tepat sekali dan berada di bagian menurut fungsinya", async () => {
    const p = bukaPopup("Super Admin");
    await tenang(p);
    for (const b of TABEL) {
      expect(p.d.querySelectorAll(`#${b.id}`).length, `${b.id} harus satu`).toBe(1);
      const g = kotak(p, b.id).closest(".tb-kelompok") as HTMLElement | null;
      expect(g?.dataset.kelompok, `${b.id} di bagian ${b.bagian}`).toBe(b.bagian);
    }
  });

  it("tidak ada kotak centang yatim: semuanya di dalam bagian, kecuali saklar induk dan blok uji", async () => {
    const p = bukaPopup("Super Admin");
    await tenang(p);
    const yatim = Array.from(p.d.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      .filter((k) => k.id && !k.id.startsWith("uji-fitur-") && !k.closest(".tb-kelompok") && !DI_LUAR_BAGIAN.has(k.id))
      .map((k) => k.id);
    expect(yatim).toEqual([]);
    // Dan tiap kotak di dalam bagian dikenal tabel (tak ada saklar baru yang luput dari tabel ini).
    const dikenal = new Set([...TABEL.map((b) => b.id), ...SAKLAR_LAIN]);
    const asing = Array.from(p.d.querySelectorAll<HTMLInputElement>(".tb-kelompok input[type=checkbox]")).map((k) => k.id).filter((id) => !dikenal.has(id));
    expect(asing, "saklar baru: tambahkan ke TABEL dan docs/popup/SAKLAR.md").toEqual([]);
  });

  it("urutan bagian logis: Tampilan, Panel, SIPP, ABT, Derry, Portal ALETA, Widget, Admin", async () => {
    const p = bukaPopup("Super Admin");
    await tenang(p);
    const urut = Array.from(p.d.querySelectorAll(".isi > .tb-kelompok")).map((g) => (g as HTMLElement).dataset.kelompok);
    expect(urut).toEqual(["tampilan", "bawaan-panel", "sipp", "abt", "derry", "aleta", "portal", "admin"]);
  });

  it("judul statis tampilan Lama tidak ikut tampil di UI Baru", async () => {
    const p = bukaPopup("Super Admin");
    await tenang(p);
    const judul = Array.from(p.d.querySelectorAll<HTMLElement>(".isi .bag-judul"));
    expect(judul.length).toBeGreaterThan(0);
    expect(judul.every((h) => h.hidden)).toBe(true);
  });

  it.each(TABEL.filter((b) => b.id !== "modeLatihan"))("$id: bawaan $bawaan; dibalik menulis $kunci", async (b) => {
    const p = bukaPopup("Super Admin");
    await tenang(p);
    const k = kotak(p, b.id);
    expect(k.checked, `${b.id} awal`).toBe(b.bawaan);
    k.checked = !b.bawaan;
    k.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    await sampai(() => p.simpanan[b.kunci] === !b.bawaan, `${b.kunci} tersimpan`);
    expect(p.simpanan[b.kunci]).toBe(!b.bawaan);
  });

  it("nilai tersimpan pengguna tampil apa adanya (kunci sama, tak berubah)", async () => {
    const simpan: Record<string, unknown> = {};
    for (const b of TABEL.filter((x) => x.id !== "modeLatihan")) simpan[b.kunci] = !b.bawaan;
    const p = bukaPopup("Super Admin", simpan);
    await tenang(p);
    for (const b of TABEL.filter((x) => x.id !== "modeLatihan")) expect(kotak(p, b.id).checked, b.id).toBe(!b.bawaan);
    // Membuka popup tidak menulis ulang nilai apa pun.
    for (const b of TABEL.filter((x) => x.id !== "modeLatihan")) expect(p.simpanan[b.kunci], b.kunci).toBe(!b.bawaan);
  });

  it("Mode latihan (bagian Admin) menulis kunci modeLatihan", async () => {
    const p = bukaPopup("Super Admin");
    await tenang(p, "admin");
    await sampai(() => !(kotak(p, "modeLatihan").closest("#bagianLatihan") as HTMLElement).hidden, "latihan tampil");
    const k = kotak(p, "modeLatihan");
    k.checked = true;
    k.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    await sampai(() => p.simpanan.modeLatihan === true, "modeLatihan tersimpan");
  });
});

describe("X1 - tampilan Lama: tiap saklar ada tepat sekali, urut logis, tanpa elemen buatan", () => {
  it("semua id tabel ada sekali dan tidak ada .tb-kelompok", async () => {
    const p = bukaPopup("Super Admin", {}, "lama");
    await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
    await tunggu(80);
    for (const b of TABEL) expect(p.d.querySelectorAll(`#${b.id}`).length, b.id).toBe(1);
    expect(p.d.querySelectorAll(".tb-kelompok").length).toBe(0);
    const judul = Array.from(p.d.querySelectorAll(".isi .bag-judul")).map((h) => h.textContent);
    expect(judul).toEqual(["SIPP", "ABT", "Blangko ABT by Derry Briantono", "Portal ALETA", "Widget", "Tampilan"]);
  });
});

describe("X1 - hak per peran", () => {
  const DERRY = ["derryBawaan", "derryTawar", "derrySaran", "derryIngat", "derryIsiOto", "derryTjJawab"];

  it("Kasir: saklar Derry, widget sidang, dan gembok ABT tidak tampil; bagian Derry dan Admin tersembunyi; nilai tetap tersimpan", async () => {
    const p = bukaPopup("Kasir", { blangkoDerrySaran: false });
    await tenang(p, "tampilan");
    for (const id of [...DERRY, "widgetKehadiran", "widgetDrafH7", "gembokAbt"]) expect(tersembunyi(p, id), id).toBe(true);
    expect(bagianTersembunyi(p, "derry")).toBe(true);
    expect(bagianTersembunyi(p, "admin")).toBe(true);
    expect(p.simpanan.blangkoDerrySaran).toBe(false);
    // Yang berlaku untuk semua peran tetap tampil.
    for (const id of ["panelRingkas", "gembokSipp", "gembokAleta", "sippPenyatu"]) expect(tersembunyi(p, id), id).toBe(false);
  });

  it("Hakim: semua saklar Derry, kehadiran, draf H-7, dan gembok ABT tampil; bagian Admin tersembunyi", async () => {
    const p = bukaPopup("Hakim");
    await tenang(p, "derry");
    for (const id of [...DERRY, "widgetKehadiran", "widgetDrafH7", "gembokAbt"]) expect(tersembunyi(p, id), id).toBe(false);
    expect(bagianTersembunyi(p, "derry")).toBe(false);
    expect(bagianTersembunyi(p, "admin")).toBe(true);
  });

  it("Juru Sita: tanpa saran isian, tanya-jawab, dan draf H-7; kehadiran sidang dan isi otomatis tampil", async () => {
    const p = bukaPopup("Juru Sita");
    await tenang(p, "derry");
    for (const id of ["derrySaran", "derryTjJawab", "widgetDrafH7"]) expect(tersembunyi(p, id), id).toBe(true);
    for (const id of ["derryBawaan", "derryTawar", "derryIngat", "derryIsiOto", "widgetKehadiran"]) expect(tersembunyi(p, id), id).toBe(false);
  });

  it("Admin dan Super Admin melihat semuanya, termasuk bagian Admin", async () => {
    for (const peran of ["Admin", "Super Admin"]) {
      const p = bukaPopup(peran);
      await tenang(p, "admin");
      for (const b of TABEL) {
        if (b.id === "modeLatihan") continue;
        expect(tersembunyi(p, b.id), `${peran}: ${b.id}`).toBe(false);
      }
      expect(bagianTersembunyi(p, "admin"), peran).toBe(false);
    }
  });
});

describe("X1 - bagian dapat dilipat dan diingat", () => {
  it("menekan judul melipat bagian dan menulis popupLipat; popup berikutnya membukanya terlipat", async () => {
    const p = bukaPopup("Super Admin");
    await tenang(p);
    const g = p.d.getElementById("kelompok-sipp") as HTMLDetailsElement;
    expect(g.open).toBe(true);
    (g.querySelector("summary") as HTMLElement).click();
    await sampai(() => (p.simpanan.popupLipat as Record<string, boolean> | undefined)?.sipp === true, "lipatan tersimpan");
    expect(g.open).toBe(false);
    const p2 = bukaPopup("Super Admin", { popupLipat: { sipp: true } });
    await tenang(p2);
    expect((p2.d.getElementById("kelompok-sipp") as HTMLDetailsElement).open).toBe(false);
    expect((p2.d.getElementById("kelompok-abt") as HTMLDetailsElement).open).toBe(true);
  });

  it("judul bagian menyebut jumlah saklar yang menyala dan ikut berubah", async () => {
    const p = bukaPopup("Super Admin");
    await tenang(p);
    const hitung = () => p.d.querySelector("#kelompok-abt .tb-hitung")!.textContent;
    expect(hitung()).toBe("0/3 nyala");
    const k = kotak(p, "cetakTigaBerkas");
    k.checked = true;
    k.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    expect(hitung()).toBe("1/3 nyala");
  });
});

describe("X1 - pembaca, kunci per akun, dan tabel dokumen", () => {
  it("tiap kunci benar-benar dibaca di berkas fiturnya", () => {
    for (const b of TABEL) {
      for (const berkas of b.pembaca) {
        const isi = baca(berkas);
        expect(isi.includes(`"${b.kunci}"`) || isi.includes(`'${b.kunci}'`) || isi.includes(`.${b.kunci}`), `${b.kunci} dibaca ${berkas}`).toBe(true);
      }
    }
  });

  it("kunci setelan per akun sama di popup.js dan latar.js, dan memuat semua kunci tabel", () => {
    const ambil = (teks: string) => {
      const a = teks.indexOf("const KUNCI_SETELAN_AKUN = [");
      const b = teks.indexOf("];", a);
      return new Set(Array.from(teks.slice(a, b).matchAll(/"([A-Za-z0-9]+)"/g)).map((m) => m[1]));
    };
    const popup = ambil(popupJs);
    const latar = ambil(latarJs);
    expect([...popup].sort()).toEqual([...latar].sort());
    // modeLatihan sengaja global di PC ini (saklar keselamatan), bukan per akun.
    for (const b of TABEL.filter((x) => x.id !== "modeLatihan")) expect(popup.has(b.kunci), `${b.kunci} per akun`).toBe(true);
  });

  it("docs/popup/SAKLAR.md memuat tiap saklar: bagian, kunci, dan pembacanya", () => {
    const md = readFileSync(path.join(REPO, "docs/popup/SAKLAR.md"), "utf8");
    for (const b of TABEL) {
      const baris = md.split("\n").find((l) => l.includes(`\`${b.kunci}\``));
      expect(baris, `${b.kunci} ada di SAKLAR.md`).toBeTruthy();
      for (const berkas of b.pembaca) expect(baris, `${b.kunci} -> ${berkas}`).toContain(berkas);
    }
  });
});
