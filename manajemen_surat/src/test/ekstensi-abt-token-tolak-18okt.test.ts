// @vitest-environment node
/**
 * ============================================================================
 * AUDIT-GALAT 18 OKT 2026 - PENCARIAN TOKEN BLANGKO YANG GAGAL TIDAK BOLEH LEPAS
 * ============================================================================
 *
 * Ditemukan di Chromium sungguhan (ekstensi unpacked atas replika beranda ABT),
 * berulang tiap beranda ABT dibuka:
 *
 *     Uncaught (in promise) Error: ABT menjawab 404 saat membaca bilah kelompok
 *         at daftarKelompokBlangko (abt.js) / cariTokenBlangko / lengkapiTokenPeta
 *
 * Panel putusan massal ABT melengkapi token pemetaan di latar dengan
 * `void lengkapiTokenPeta(...).then(...)` - TANPA .catch. Bila ABT menjawab
 * bukan-200 atau tidak terjangkau, penolakannya lepas dan menumpuk di
 * chrome://extensions (lencana merah selalu menyala, galat sungguhan tenggelam).
 * Uji lama menutupinya dengan menjawab halaman ABT "kosong, bukan 404".
 *
 * Tombol "Simpan nama" (Ketik nama berkas) juga menunggu cariTokenBlangko tanpa
 * try: galatnya lepas dan baris kabar membeku di "mencari…".
 *
 * Uji ini MENJALANKAN panel-alat.js + abt.js di jsdom dengan ABT yang menjawab
 * 404 / jaringan putus, lalu menghitung penolakan yang tidak ditangani.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_ABT = baca("abt.js");
const ASAL_ABT = "http://192.168.10.10/aps_badilag/index.php/abt";

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 8000): Promise<NonNullable<T>> {
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
    await tunggu(15);
  }
}

const terbuka: JSDOM[] = [];
const lepas: unknown[] = [];
const tangkap = (alasan: unknown) => void lepas.push(alasan);
beforeEach(() => {
  lepas.length = 0;
  process.on("unhandledRejection", tangkap);
});
afterEach(async () => {
  await tunggu(30);
  process.off("unhandledRejection", tangkap);
  while (terbuka.length) {
    const w = terbuka.pop()!.window as any;
    for (const p of Array.from(w.document.querySelectorAll(".aleta-panel")) as any[]) {
      if (p.aletaPewaktuRingkas) w.clearInterval(p.aletaPewaktuRingkas);
    }
    w.close();
  }
});

type CaraAbt = "404" | "putus";

function bukaBeranda(caraAbt: CaraAbt) {
  const badan =
    `<div id="wrapper"><div id="cssmenu"></div><div id="navbar"><button class="accordion">Putusan &amp; Penetapan</button></div>` +
    `<div id="content"><div class="pricing_inner_w3ls"><div class="pricing-top"><h3>Putusan</h3></div><div class="pricing-bottom-bottom"></div></div></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, {
    url: `${ASAL_ABT}/`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui" };
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.205.7" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }),
      lastError: undefined,
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: string[] = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    minta.push(url);
    if (url.includes("/aleta-bot/abt/usulan")) {
      const muatan = JSON.parse(typeof opsi?.body === "string" ? opsi.body : "{}");
      if (muatan.sumber === "siapa")
        return new Response(JSON.stringify({ data: { available: true, pengguna: { nama: "Uji", peran: "Super Admin" }, kapabilitas: {} } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
    }
    if (url.includes("/aps_badilag/")) {
      if (caraAbt === "putus") throw new TypeError("Failed to fetch");
      return new Response("<html><body>404</body></html>", { status: 404, headers: { "content-type": "text/html" } });
    }
    return new Response(JSON.stringify({ ok: false }), { status: 404, headers: { "content-type": "application/json" } });
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.confirm = () => false;
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);\nwindow.__kotakHitam = () => alatKotakHitam();`);
  return { w, minta };
}

const massal = (w: any) => w.document.getElementById("aleta-panel-abt-massal") as any;
const pesanLepas = () => lepas.map((x) => String((x as any)?.message || x));

describe("panel putusan massal ABT: pencarian token yang gagal ditangani", () => {
  for (const cara of ["404", "putus"] as const) {
    it(`ABT ${cara === "404" ? "menjawab 404" : "tidak terjangkau"}: panel tetap lahir, tanpa Uncaught (in promise)`, async () => {
      const { w, minta } = bukaBeranda(cara);
      await sampai(() => massal(w), "panel massal ABT lahir");
      // pencarian token di latar benar-benar menyentuh ABT (bilah kelompok tidak ada di halaman)
      await sampai(() => minta.some((u) => /\/aps_badilag\/.*main\/beranda/.test(u)), "bilah kelompok diminta dari ABT");
      await tunggu(80);
      expect(pesanLepas()).toEqual([]);
      // kegagalannya tercatat di kotak hitam, bukan hilang
      const catatan = (w.__kotakHitam() as Array<{ jenis: string; ringkas: string }>).filter((c) => c.jenis === "massal-galat");
      expect(catatan.some((c) => /token blangko belum terambil/.test(c.ringkas))).toBe(true);
    });
  }

  it('"Simpan nama" saat ABT tidak terjangkau: kabar menyebut kegagalan, nama tetap tersimpan', async () => {
    const { w } = bukaBeranda("putus");
    const panel = await sampai(() => massal(w), "panel massal ABT lahir");
    await tunggu(80);
    const ketik = await sampai(
      () => (Array.from(panel.querySelectorAll("button")) as any[]).find((b) => b.textContent === "Ketik"),
      "tombol Ketik"
    );
    ketik.click();
    const simpan = await sampai(
      () => (Array.from(panel.querySelectorAll("button")) as any[]).find((b) => b.textContent === "Simpan nama"),
      "tombol Simpan nama"
    );
    // kotak nama milik pemilih yang SAMA dengan tombolnya (bukan kotak ketik lain di panel)
    let wadah = simpan.parentElement;
    while (wadah && !wadah.querySelector("input.aleta-abt-ketik")) wadah = wadah.parentElement;
    const masukan = wadah.querySelector("input.aleta-abt-ketik");
    masukan.value = "[01] Uji Berkas Tidak Ada";
    simpan.click();
    const semuaKabar = () => (Array.from(panel.querySelectorAll(".aleta-abt-kabar")) as any[]).map((k) => k.textContent).join(" | ");
    const kabar = await sampai(
      () => (Array.from(panel.querySelectorAll(".aleta-abt-kabar")) as any[]).find((k) => /belum terambil/.test(k.textContent)),
      "kabar kegagalan"
    ).catch((e) => {
      throw new Error(`${e.message}; kabar: ${semuaKabar()}`);
    });
    expect(kabar.textContent).toContain("[01] Uji Berkas Tidak Ada");
    expect(kabar.textContent).toContain("namanya tetap tersimpan");
    await tunggu(50);
    expect(pesanLepas()).toEqual([]);
  });
});
