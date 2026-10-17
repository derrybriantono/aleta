// @vitest-environment node
/**
 * C3 (audit ABT 17 Okt 2026): PTSP tidak sampai ke folder "99 PTSP" karena Blangko Derry tidak
 * menampilkan daftar perkara apa pun bagi PTSP. Kini: PTSP mencari nomor perkara satker (baca saja),
 * memilih perkara, lalu hanya tab PTSP yang terbuka (tanpa putusan/BAS/relaas).
 * jsdom dengan sumber ekstensi sungguhan; portal ditiru.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-15";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => JSON.parse(JSON.stringify(x));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 6000): Promise<NonNullable<T>> {
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
    await tunggu(5);
  }
}

const SI = (tanggal: string) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda: "Sidang Pertama", ket: "", ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "" });
const PK = {
  nomorPerkara: "581/Pdt.G/2026/PA.Dgl", perkaraId: "10154", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: null, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: [] as string[], pihak: { penggugat: ["P"], tergugat: ["T"] }, sidang: [SI(HARI_INI)],
};
const ORANG = { nama: "Petugas PTSP", peran: "Petugas PTSP", roleId: "pelaksana", golonganMenu: ["ptsp"] };
const PTSP = "99 PTSP";
const BERKAS_PTSP = "[PTSP] Surat Keterangan";
const MENU = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${BERANDA}?a=${encodeURIComponent(PTSP)}&c=" title="(1 Blangko)">${PTSP}</a></div>`;
const HAL = `<div class="pricing-top tiga"><h3>${PTSP}</h3></div><p><a href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"A-${PTSP}", b:"B-${PTSP}", c:"" });'># <span>${BERKAS_PTSP}</span></a></p>`;

type Halaman = { dom: JSDOM; w: any; minta: string[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(): Halaman {
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b></div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.202.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: () => undefined, lastError: undefined },
    storage: {
      local: {
        get: async (k?: string | string[] | null) => {
          const daftar = k == null ? Object.keys(simpanan) : [k].flat();
          return Object.fromEntries(daftar.filter((x) => x in simpanan).map((x) => [x, polos(simpanan[x])]));
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: string[] = [];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...ORANG, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const nomor = new URL(url, ASAL).searchParams.get("nomor") || "";
      const perkara = nomor && PK.nomorPerkara.includes(nomor) ? [polos(PK)] : [];
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: false, nama: ORANG.nama, sebagaiNama: "", sebagaiPeran: null, ptspCari: true, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: null, perkara } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry?hak=1")) return json({ ok: false, alasan: "tidak ada" }, 502);
    if (url.includes("/aleta-ecourt/blangko-derry")) return json({ ok: true, data: { ada: false, sebab: "uji" } });
    if (url.includes("/aleta-ecourt/sidang")) return json({ ok: true, data: { sipp: { jadwalPerkara: [] } } });
    if (url === BERANDA) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=`)) return html(HAL);
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return { dom, w, minta };
}

const akar = (h: Halaman) => h.w.document.getElementById("aleta-bd-akar") as HTMLElement;
const q = (h: Halaman, s: string) => akar(h).querySelector(s) as HTMLElement | null;
const qq = (h: Halaman, s: string) => Array.from(akar(h).querySelectorAll(s)) as HTMLElement[];
const klik = (h: Halaman, s: string) => {
  const el = q(h, s);
  if (!el) throw new Error(`tidak ada: ${s}`);
  el.click();
};

describe("C3. Blangko Derry untuk PTSP", () => {
  it("PTSP: kotak cari nomor, permintaan memuat nomor=, perkara dapat dipilih, hanya tab PTSP yang terbuka", async () => {
    const h = buka();
    await sampai(() => h.w.aletaBlangkoDerry && h.w.aletaBlangkoDerry.keadaan().peran.length, "peran terbaca");
    (Array.from(h.w.document.querySelectorAll("#navbar .accordion")).find((b: any) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
    const kotak = (await sampai(() => q(h, "#bd-cari"), "kotak cari nomor")) as HTMLInputElement;
    // Belum mengetik apa pun: tidak ada perkara.
    expect(q(h, "[data-pk]")).toBeNull();
    kotak.value = "581";
    kotak.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => h.minta.some((u) => u.includes("/perkara-saya") && u.includes("nomor=581")), "permintaan dengan nomor");
    await sampai(() => q(h, "[data-pk]"), "perkara hasil pencarian");
    klik(h, `[data-pk="${PK.nomorPerkara}"]`);
    await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
    await tunggu(30);
    expect(qq(h, "[data-jenismodal]").map((b) => b.getAttribute("data-jenismodal"))).toEqual(["ptsp"]);
  });
});
