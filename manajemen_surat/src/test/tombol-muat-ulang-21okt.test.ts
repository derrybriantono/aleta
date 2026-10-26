// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TOMBOL "MUAT ULANG" DI HALAMAN PERKARA SIPP (21 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim: bila ada berkas yang baru diunggah tetapi tampilan belum
 * berubah, cukup tekan Muat ulang di halaman perkara. Dijalankan di jsdom atas
 * replika kepala SIPP: tombol hanya di halaman perkara, berdampingan dengan
 * "Tarik data" (atau berdiri sendiri bila peran tidak berhak tarik data), klik
 * memanggil modul bersama muat-ulang-sipp.js untuk perkara & tab yang sama,
 * tembolok perkara dibuang, dan isian yang belum disimpan minta konfirmasi.
 *
 * ALETA_TANGKAP_MUATULANG=<awalan> menyimpan HTML tiap keadaan untuk tangkapan.
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (b: string) => fs.readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8").replace(/\r\n/g, "\n");
const TARIK = baca("tarik-satu-perkara.js");
const MUAT = baca("muat-ulang-sipp.js");
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const MASUK = "http://192.168.10.10/SIPP/perkara_detil/ENC123";
const ASAL = "http://192.168.10.10";
const polos = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const KEPALA =
  `<div id="atas"><div class="h_right" style="position:absolute;right:0;">` +
  `<table class='badge badge-dark'><tr><td>Selamat Datang <font color='red'>Derry</font></td>` +
  `<td><a href='/index.php/logout'>Keluar</a></td></tr></table></div></div>`;

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = { url?: string; berhak?: boolean; isi?: string; yakin?: boolean; simpanan?: Record<string, unknown>; tabAwal?: string };

function buka(o: Opsi = {}) {
  const url = o.url || `${ASAL}/SIPP/detil_perkara_agama`;
  const perkara = /detil_perkara_agama/.test(url);
  const tabs =
    `<ul id="tabs"><li class="ui-tabs-active"><a href="#tabs1">Data Umum</a></li><li><a href="#tabs10">Putusan Akhir</a></li><li><a href="#tabs11">Dokumen</a></li></ul>` +
    `<div id="tabs1">${NOMOR}</div>`;
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${KEPALA}<div id="konten">${perkara ? tabs : "Beranda"}${o.isi || ""}</div></body></html>`, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ...(o.simpanan || {}) };
  w.chrome = {
    runtime: { id: "aleta-uji" },
    storage: {
      local: {
        get: async (k?: string | string[] | null) => {
          const daftar = k == null ? Object.keys(simpanan) : [k].flat();
          const h: Record<string, unknown> = {};
          for (const x of daftar) if (x in simpanan) h[x] = polos(simpanan[x]);
          return h;
        },
        set: async (x: Record<string, unknown>) => void Object.assign(simpanan, polos(x)),
        remove: async (k: string | string[]) => void [k].flat().forEach((x) => delete simpanan[x]),
      },
      onChanged: { addListener: () => undefined },
    },
  };
  const pindah: string[] = [];
  const tanya: string[] = [];
  w.aletaUjiPindah = (a: string) => void pindah.push(a);
  w.confirm = (t: string) => {
    tanya.push(t);
    return o.yakin !== false;
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  // Pengganti konten.js (hanya yang dipakai tombol): halaman perkara, nomor, pintu masuk, hak, penjaga panel.
  vm.runInContext(
    `function alamatHalamanPerkara(){return /detil_perkara_agama/.test(location.pathname);}` +
      `function cariNomorPerkara(){return ${JSON.stringify(NOMOR)};}` +
      `function alamatMasukPerkara(){return alamatHalamanPerkara()?${JSON.stringify(MASUK)}:"";}` +
      `var penggunaTerakhir=${o.berhak === false ? "null" : '{"nama":"Derry"}'};` +
      `function boleh(k){return k==="permintaan";}` +
      `var nomorTerakhir=${JSON.stringify(NOMOR)};`,
    ctx,
  );
  w.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { available: true, ok: true, ada: false, tarikan: null, terakhirDetik: null, bolehPaksa: false } }), text: async () => "{}" });
  vm.runInContext(MUAT, ctx, { filename: "muat-ulang-sipp.js" });
  vm.runInContext(TARIK, ctx, { filename: "tarik-satu-perkara.js" });
  return { w, d: w.document as Document, simpanan, pindah, tanya, ctx };
}
type H = ReturnType<typeof buka>;
const tombolMuat = (h: H) => h.d.querySelector("[data-aleta-muat-ulang]") as HTMLButtonElement | null;
const siap = async (h: H) => {
  for (let i = 0; i < 100 && !tombolMuat(h); i += 1) {
    h.w.aletaTarikSatu.pasang();
    await tunggu(15);
  }
  return tombolMuat(h)!;
};
function tangkap(h: H, nama: string) {
  const awalan = process.env.ALETA_TANGKAP_MUATULANG;
  if (!awalan) return;
  fs.mkdirSync(path.dirname(awalan), { recursive: true });
  fs.writeFileSync(`${awalan}-${nama}.html`, h.d.documentElement.outerHTML);
}

describe("tombol Muat ulang di halaman perkara SIPP", () => {
  it("berhak tarik data: Muat ulang ada DI SAMPING 'Tarik data' dalam satu wadah, di kiri 'Selamat Datang'", async () => {
    const h = buka();
    const t = await siap(h);
    const wadah = h.d.getElementById("aleta-tarik-satu")!;
    expect(t.parentElement).toBe(wadah);
    const tombol = Array.from(wadah.querySelectorAll("button.aleta-ts-tombol"));
    expect(tombol.map((x) => x.textContent!.trim())).toEqual(["Tarik data", "Muat ulang"]);
    expect(wadah.nextElementSibling).toBe(h.d.querySelector("table.badge"));
    expect(h.d.querySelectorAll("[data-aleta-muat-ulang]")).toHaveLength(1);
    // Tanpa kata merek di teks/judul yang tampak di halaman SIPP.
    expect(`${t.textContent} ${t.title}`).not.toMatch(/aleta/i);
    tangkap(h, "1-berdampingan");
  });

  it("peran tanpa hak tarik data: Muat ulang berdiri sendiri di tempat yang sama, tanpa 'Tarik data'", async () => {
    const h = buka({ berhak: false });
    const t = await siap(h);
    expect(h.d.getElementById("aleta-tarik-satu")).toBeNull();
    const wadah = h.d.getElementById("aleta-muat-ulang-perkara")!;
    expect(t.parentElement).toBe(wadah);
    expect(wadah.nextElementSibling).toBe(h.d.querySelector("table.badge"));
    expect(wadah.textContent).not.toContain("Tarik data");
    tangkap(h, "2-sendiri");
  });

  it("HANYA di halaman perkara: tidak ada di dasbor", async () => {
    const h = buka({ url: `${ASAL}/SIPP/main` });
    await tunggu(150);
    h.w.aletaTarikSatu.pasang();
    expect(tombolMuat(h)).toBeNull();
    expect(h.d.getElementById("aleta-muat-ulang-perkara")).toBeNull();
  });

  it("klik: memanggil modul bersama (muat ulang ke pintu masuk perkara yang sama), mengingat tab, membuang tembolok perkara itu saja, tanpa tanya bila tak ada isian", async () => {
    const h = buka({
      simpanan: { simpananKonteks: { [NOMOR]: { konteks: { ok: true } }, "701/Pdt.G/2026/PA.Dgl": { konteks: { ok: true } } } },
    });
    const t = await siap(h);
    // pindah ke tab Putusan Akhir lebih dulu
    h.d.querySelector("li.ui-tabs-active")!.classList.remove("ui-tabs-active");
    h.d.querySelector('a[href="#tabs10"]')!.parentElement!.classList.add("ui-tabs-active");
    t.click();
    for (let i = 0; i < 100 && !h.pindah.length; i += 1) await tunggu(15);
    expect(h.pindah).toEqual([MASUK]);
    expect(h.tanya).toHaveLength(0);
    const sisa = h.simpanan.simpananKonteks as Record<string, unknown>;
    expect(Object.keys(sisa)).toEqual(["701/Pdt.G/2026/PA.Dgl"]);
    expect(h.simpanan.muatUlangTabPerkara).toMatchObject({ kunci: NOMOR.toUpperCase(), tab: "#tabs10" });
    // penjaga panel dikosongkan supaya panel menggambar ulang
    expect(h.w.eval("nomorTerakhir")).toBe("");
    // modul bersama mencatat alamat & penanda menunggu (untuk kembali bila SIPP menjatuhkan ke dasbor)
    expect(JSON.stringify(h.simpanan.muatUlangSipp)).toContain(MASUK);
    // klik ganda tidak memuat ulang dua kali
    t.click();
    await tunggu(80);
    expect(h.pindah).toHaveLength(1);
  });

  it("isian SIPP belum disimpan: minta konfirmasi; 'batal' = tidak memuat ulang & tidak membuang apa pun", async () => {
    const h = buka({ yakin: false, isi: `<form><input type="text" name="x" value="lama"></form>`, simpanan: { simpananKonteks: { [NOMOR]: { konteks: { ok: true } } } } });
    const t = await siap(h);
    (h.d.querySelector("input[name=x]") as HTMLInputElement).value = "diubah";
    t.click();
    await tunggu(120);
    expect(h.tanya).toHaveLength(1);
    expect(h.tanya[0]).toMatch(/belum disimpan/);
    expect(h.pindah).toHaveLength(0);
    expect(Object.keys(h.simpanan.simpananKonteks as object)).toEqual([NOMOR]);
    // sesudah batal, tombol bisa dipakai lagi
    expect(h.w.aletaTarikSatu.keadaan().memuatUlang).toBeFalsy();
  });

  it("isian SIPP belum disimpan + 'ya': memuat ulang", async () => {
    const h = buka({ yakin: true, isi: `<form><textarea name="c">awal</textarea></form>` });
    const t = await siap(h);
    (h.d.querySelector("textarea") as HTMLTextAreaElement).value = "ubah";
    t.click();
    for (let i = 0; i < 100 && !h.pindah.length; i += 1) await tunggu(15);
    expect(h.tanya).toHaveLength(1);
    expect(h.pindah).toEqual([MASUK]);
  });

  it("isian milik panel kita atau yang tidak diubah tidak memicu konfirmasi", async () => {
    const h = buka({ isi: `<form><input name="a" value="x"></form><div class="aleta-sisip"><form><input name="p" value="a"></form></div>` });
    const t = await siap(h);
    (h.d.querySelector("input[name=p]") as HTMLInputElement).value = "b";
    expect(h.w.aletaTarikSatu.adaBorangBelumDisimpan()).toBe(false);
    t.click();
    for (let i = 0; i < 100 && !h.pindah.length; i += 1) await tunggu(15);
    expect(h.tanya).toHaveLength(0);
    expect(h.pindah).toHaveLength(1);
  });

  it("sesudah dimuat ulang: kembali ke tab tadi SEKALI (catatan dicabut), hanya untuk perkara yang sama dan masih segar", async () => {
    const h = buka({ simpanan: { muatUlangTabPerkara: { kunci: NOMOR.toUpperCase(), tab: "#tabs10", waktu: Date.now() } } });
    let klik = 0;
    h.d.querySelector('a[href="#tabs10"]')!.addEventListener("click", () => void (klik += 1));
    await siap(h);
    await tunggu(80);
    h.w.aletaTarikSatu.pasang();
    await tunggu(40);
    expect(klik).toBe(1);
    expect(h.simpanan.muatUlangTabPerkara).toBeUndefined();

    const lain = buka({ simpanan: { muatUlangTabPerkara: { kunci: "701/PDT.G/2026/PA.DGL", tab: "#tabs10", waktu: Date.now() } } });
    let klik2 = 0;
    lain.d.querySelector('a[href="#tabs10"]')!.addEventListener("click", () => void (klik2 += 1));
    await siap(lain);
    await tunggu(80);
    expect(klik2).toBe(0);

    const basi = buka({ simpanan: { muatUlangTabPerkara: { kunci: NOMOR.toUpperCase(), tab: "#tabs10", waktu: Date.now() - 10 * 60 * 1000 } } });
    let klik3 = 0;
    basi.d.querySelector('a[href="#tabs10"]')!.addEventListener("click", () => void (klik3 += 1));
    await siap(basi);
    await tunggu(80);
    expect(klik3).toBe(0);
  });

  it("tidak menulis apa pun ke SIPP: tidak ada fetch/XHR dari klik Muat ulang, dan sumbernya hanya memakai modul bersama", async () => {
    const h = buka();
    const t = await siap(h);
    let panggilan = 0;
    h.w.fetch = async () => {
      panggilan += 1;
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    };
    t.click();
    for (let i = 0; i < 100 && !h.pindah.length; i += 1) await tunggu(15);
    expect(panggilan).toBe(0);
    expect(TARIK).toContain("mu.muatUlangSekarang(");
    expect(TARIK).not.toMatch(/location\.reload\(/);
  });

  it("manifest memuat muat-ulang-sipp.js pada halaman SIPP; tarik-satu-perkara.js modul malas di halaman perkara (K11)", () => {
    const m = JSON.parse(baca("manifest.json"));
    const js: string[] = m.content_scripts.flatMap((c: { js?: string[] }) => c.js || []);
    expect(js).not.toContain("tarik-satu-perkara.js");
    expect(baca("modul-malas.js")).toContain('"tarik-satu-perkara": modul([], ["tarik-satu-perkara.js"])');
    expect(js).toContain("muat-ulang-sipp.js");
  });
});
