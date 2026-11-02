// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * UNDUHAN AMAN LEWAT EKSTENSI (2 Nov 2026) - RANTAI SUNGGUHAN, DIJALANKAN
 * ============================================================================
 *
 * Keluhan: Status Perkara 273/Pdt.G/2026/PA.Dgl > "Unduh seluruh berkas" ->
 * Chrome "Insecure download blocked". Yang dimuat di sini SUNGGUHAN:
 *   halaman portal (jsdom) + aleta.js (jembatan) + unduh-universal.js
 *   -> latar.js (node:vm, importScripts unduh-aman-latar.js)
 *   -> dokumen offscreen unduh-aman.js (node:vm, fetch/Response/Blob Node)
 *   -> terbitkanUnduhan latar.js -> chrome.downloads tiruan.
 * Dibuktikan: unduhan diterbitkan dari blob:chrome-extension:// (bukan http,
 * bukan data:), berkas > 40 MB tidak lewat data: maupun pesan, galat server
 * disebut sebabnya, kabar mulai/akhir sampai ke halaman, dan tanpa dukungan
 * offscreen jalurnya menolak dengan bersih (portal lalu memakai jalur lama).
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8").replace(/\r\n/g, "\n");
const SUMBER_LATAR = baca("latar.js");
const SUMBER_UNIVERSAL = baca("unduh-universal.js");
const SUMBER_ALETA = baca("aleta.js");
const SUMBER_DOK = baca("unduh-aman.js");
const SUMBER_MODUL_LATAR = baca("unduh-aman-latar.js");

const ID = "abcdefghijklmnopabcdefghijklmnop";
const ASAL_EKS = `chrome-extension://${ID}`;
const ASAL = "http://192.168.10.10";
const PORTAL = `${ASAL}/aleta/aleta-ecourt`;
const SIPP = `${ASAL}/SIPP/index.php/perkara/detil/273`;
const MB = 1024 * 1024;
const NAMA_ZIP = "perkara-273-Pdt.G-2026-PA.Dgl-data-gugatan-bas-penetapan-ecourt-lainnya.zip";
const RUTE_ZIP = "/aleta/api/aleta-ecourt/berkas-zip?nomor=273%2FPdt.G%2F2026%2FPA.Dgl&sumber=semua&isi=lengkap";

const salin = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tidur = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function tunggu(sampai: () => boolean, batasMs = 8000) {
  const mulai = Date.now();
  while (!sampai()) {
    if (Date.now() - mulai > batasMs) throw new Error("waktu habis menunggu");
    await tidur(5);
  }
}

/** Aliran ZIP potongan 1 MB; `putusSesudah` = aliran galat sesudah sekian potongan. */
function aliran(bita: number, putusSesudah = -1) {
  let terkirim = 0;
  let potongan = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (putusSesudah >= 0 && potongan >= putusSesudah) {
        c.error(new Error("net::ERR_CONNECTION_RESET"));
        return;
      }
      if (terkirim >= bita) {
        c.close();
        return;
      }
      const n = Math.min(MB, bita - terkirim);
      c.enqueue(new Uint8Array(n).fill(0x50));
      terkirim += n;
      potongan += 1;
    },
  });
}

function jawabanZip(bita: number, o: { panjang?: boolean; putusSesudah?: number } = {}) {
  const kepala: Record<string, string> = {
    "content-type": "application/zip",
    "content-disposition": `attachment; filename="${encodeURIComponent(NAMA_ZIP)}"; filename*=UTF-8''${encodeURIComponent(NAMA_ZIP)}`,
  };
  if (o.panjang) kepala["content-length"] = String(bita);
  return new Response(aliran(bita, o.putusSesudah ?? -1), { status: 200, headers: kepala });
}

type Pelayan = (alamat: string, init: any) => Response | Promise<Response>;

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function rantai(o: {
  halaman?: string;
  pelayan: Pelayan;
  tanpaOffscreen?: boolean;
  /** Ukuran yang dilaporkan chrome.downloads sesudah tersimpan (IDM = 0). */
  ukuranCakram?: (ukuranBlob: number) => number;
  muatAleta?: boolean;
  butirUnduhanLain?: Record<number, any>;
}) {
  const halaman = o.halaman ?? PORTAL;
  const pesan: any[] = [];
  const catat = (p: any) => pesan.push(salin(p));
  const pendengarLatar: any[] = [];
  const pendengarDok: any[] = [];
  const pendengarCS: any[] = [];
  const pendengarUbah: any[] = [];
  let pendengarNama: any = null;
  const unduhan: Array<{ id: number; url: string; nama: string; fileSize: number }> = [];
  const dihapus: number[] = [];
  const dokumenDibuat: any[] = [];
  let dokumenAda = false;
  let ditutup = 0;
  const blob = new Map<string, Blob>();
  const dilepas: string[] = [];
  const ambilDok: Array<{ alamat: string; init: any }> = [];

  function kirimKe(pendengar: any[], isi: any, pengirim: any, balik: ((x?: any) => void) | undefined, runtimePengirim: any) {
    catat(isi);
    let dijawab = false;
    let menunggu = false;
    const jawab = (x: any) => {
      if (dijawab) return;
      dijawab = true;
      if (balik) setTimeout(() => balik(salin(x)), 0);
    };
    for (const f of [...pendengar]) if (f(salin(isi), pengirim, jawab) === true) menunggu = true;
    if (!dijawab && !menunggu && balik) {
      setTimeout(() => {
        if (dijawab) return;
        dijawab = true;
        runtimePengirim.lastError = { message: "The message port closed before a response was received." };
        try {
          balik(undefined);
        } finally {
          runtimePengirim.lastError = undefined;
        }
      }, 0);
    }
  }

  // ---- dokumen offscreen ----------------------------------------------------
  const runtimeDok: any = {
    id: ID,
    lastError: undefined,
    onMessage: { addListener: (f: any) => pendengarDok.push(f) },
    sendMessage: (isi: any, balik?: (x?: any) => void) =>
      setTimeout(() => kirimKe(pendengarLatar, isi, { id: ID, url: `${ASAL_EKS}/unduh-aman.html` }, balik, runtimeDok), 0),
  };
  let nomorBlob = 0;
  class UrlDok extends URL {
    static createObjectURL(b: Blob) {
      nomorBlob += 1;
      const u = `blob:${ASAL_EKS}/b-${nomorBlob}`;
      blob.set(u, b);
      return u;
    }
    static revokeObjectURL(u: string) {
      dilepas.push(u);
      blob.delete(u);
    }
  }
  function nyalakanDokumen() {
    const k: Record<string, any> = {
      console,
      chrome: { runtime: runtimeDok },
      fetch: (alamat: string, init: any) => {
        ambilDok.push({ alamat, init });
        return Promise.resolve(o.pelayan(alamat, init));
      },
      URL: UrlDok,
      Blob,
      AbortController,
      setTimeout,
      clearTimeout,
      Date,
      document: {},
    };
    k.globalThis = k;
    vm.createContext(k);
    vm.runInContext(SUMBER_DOK, k, { filename: "unduh-aman.js" });
  }

  // ---- pekerja latar (latar.js sungguhan) -----------------------------------
  const gudang = (isi: Record<string, any>) => ({
    get: async (kunci: any) =>
      kunci === null ? { ...isi } : Object.fromEntries((Array.isArray(kunci) ? kunci : [kunci]).map((x: string) => [x, isi[x]])),
    set: async (b: Record<string, any>) => void Object.assign(isi, salin(b)),
    remove: async (kunci: any) => {
      for (const x of Array.isArray(kunci) ? kunci : [kunci]) delete isi[x];
    },
  });
  const runtimeLatar: any = {
    id: ID,
    lastError: undefined,
    getURL: (p: string) => `${ASAL_EKS}/${p}`,
    getManifest: () => ({ version: "1.205.62", host_permissions: ["http://192.168.10.10/*", "http://127.0.0.1/*"] }),
    onUpdateAvailable: { addListener: () => {} },
    onMessage: { addListener: (f: any) => pendengarLatar.push(f) },
    getContexts: async () => (dokumenAda ? [{ contextType: "OFFSCREEN_DOCUMENT" }] : []),
    sendMessage: (isi: any, balik?: (x?: any) => void) => kirimKe(pendengarDok, isi, { id: ID, url: `${ASAL_EKS}/_generated_background_page.html` }, balik, runtimeLatar),
  };
  const konteksLatar: Record<string, any> = {
    console,
    chrome: {
      runtime: runtimeLatar,
      offscreen: o.tanpaOffscreen
        ? undefined
        : {
            createDocument: async (opsi: any) => {
              dokumenDibuat.push(opsi);
              dokumenAda = true;
              nyalakanDokumen();
            },
            closeDocument: async () => {
              ditutup += 1;
              dokumenAda = false;
            },
          },
      downloads: {
        onDeterminingFilename: { addListener: (f: any) => (pendengarNama = f) },
        onChanged: {
          addListener: (f: any) => pendengarUbah.push(f),
          removeListener: (f: any) => {
            const i = pendengarUbah.indexOf(f);
            if (i >= 0) pendengarUbah.splice(i, 1);
          },
        },
        download: (opsi: any, balik: (id?: number) => void) => {
          let nama = String(opsi.filename);
          if (pendengarNama) pendengarNama({ filename: opsi.filename, url: opsi.url }, (u: any) => u && u.filename && (nama = u.filename));
          const ukuran = blob.get(String(opsi.url))?.size ?? 0;
          const id = 500 + unduhan.length;
          unduhan.push({ id, url: String(opsi.url), nama, fileSize: o.ukuranCakram ? o.ukuranCakram(ukuran) : ukuran });
          setTimeout(() => {
            balik(id);
            setTimeout(() => pendengarUbah.forEach((f) => f({ id, state: { current: "complete" } })), 0);
          }, 0);
        },
        search: (k: { id: number }, balik: (x: any[]) => void) => {
          const u = unduhan.find((x) => x.id === k.id);
          const lain = (o.butirUnduhanLain ?? {})[k.id];
          setTimeout(() => balik(u ? [{ id: u.id, state: "complete", fileSize: u.fileSize, exists: true, url: u.url }] : lain ? [lain] : []), 0);
        },
        erase: (k: { id: number }) => void dihapus.push(k.id),
        cancel: (_id: number, balik?: () => void) => balik?.(),
      },
      tabs: {
        query: async () => [{ id: 7, url: halaman, active: true }],
        sendMessage: (tab: number, isi: any, opsi?: any, balik?: (x?: any) => void) => {
          if (typeof opsi === "function") {
            balik = opsi;
            opsi = undefined;
          }
          void tab;
          return new Promise((selesai) =>
            kirimKe(
              pendengarCS,
              isi,
              { id: ID },
              (x) => {
                balik?.(x);
                selesai(x);
              },
              runtimeLatar
            )
          );
        },
      },
      storage: { session: gudang({}), local: gudang({}), onChanged: { addListener: () => {} } },
    },
    fetch: async () => {
      throw new Error("pekerja latar tidak mengambil berkas apa pun di jalur ini");
    },
    // Pewaktu latar dipendekkan & dijinakkan: tidak ada pewaktu latar yang hidup melewati uji.
    setTimeout: (f: (...a: any[]) => void, ms?: number, ...a: any[]) => {
      const h = setTimeout(() => void Promise.resolve().then(() => f(...a)).catch(() => {}), Math.min(Number(ms) || 0, 2000));
      (h as any).unref?.();
      return h;
    },
    clearTimeout,
    setInterval: () => 0,
    clearInterval: () => {},
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    btoa,
    atob,
    crypto: globalThis.crypto,
    // Hanya modul unduhan aman yang dimuat sungguhan; impor latar lain tidak menyentuh jalur ini.
    importScripts: (...nama: string[]) => {
      for (const n of nama) if (n === "unduh-aman-latar.js") vm.runInContext(SUMBER_MODUL_LATAR, konteksLatar, { filename: n });
    },
  };
  konteksLatar.self = konteksLatar;
  konteksLatar.globalThis = konteksLatar;
  vm.createContext(konteksLatar);
  vm.runInContext(SUMBER_LATAR, konteksLatar, { filename: "latar.js" });

  // ---- halaman + skrip konten ----------------------------------------------
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, { url: halaman, runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const keHalaman: any[] = [];
  w.postMessage = (data: unknown, origin: string) => keHalaman.push({ data: salin(data), origin });
  const runtimeCS: any = {
    id: ID,
    lastError: undefined,
    getManifest: () => ({ version: "1.205.62" }),
    getURL: (p: string) => `${ASAL_EKS}/${p}`,
    sendMessage: (isi: any, balik?: (x?: any) => void) =>
      kirimKe(pendengarLatar, isi, { id: ID, url: halaman, tab: { id: 7, url: halaman }, frameId: 0 }, balik, runtimeCS),
    onMessage: { addListener: (f: any) => pendengarCS.push(f) },
  };
  w.chrome = {
    runtime: runtimeCS,
    storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener: () => {} } },
  };
  const jalurLama: any[] = [];
  w.alatUnduh = async (b: unknown, nama: string) => {
    jalurLama.push(nama);
    return { ok: true, lewat: "data" };
  };
  w.alatNamaUnduhanLayak = (n: string) => n;
  w.alatCatat = () => {};
  w.alatCatatAsalPortal = () => {};
  w.alatAmbil = async () => ({ status: 401, ok: false, json: async () => ({}) });
  w.alatHalamanPublikPortal = () => false;
  const konteks = (dom as any).getInternalVMContext();
  new vm.Script(SUMBER_UNIVERSAL, { filename: "unduh-universal.js" }).runInContext(konteks);
  if (o.muatAleta !== false && halaman.startsWith(PORTAL)) w.eval(SUMBER_ALETA);

  /** Halaman portal mengirim permintaan lewat jembatan (MessageEvent sungguhan). */
  const mintaDariHalaman = (idPesan: string, alamat: string) =>
    w.dispatchEvent(
      new w.MessageEvent("message", {
        data: { sumber: "aleta-portal", jenis: "unduh-berkas", idPesan, muatan: { alamat } },
        origin: ASAL,
        source: w,
      })
    );
  const balasan = (idPesan: string) => keHalaman.find((k) => k.data && k.data.balasan === idPesan)?.data.jawaban;
  const kabar = (idPesan: string) => keHalaman.filter((k) => k.data && k.data.kabar === idPesan).map((k) => k.data);

  return {
    w,
    pesan,
    unduhan,
    dihapus,
    dokumenDibuat,
    dilepas,
    ambilDok,
    jalurLama,
    keHalaman,
    ditutup: () => ditutup,
    mintaDariHalaman,
    balasan,
    kabar,
    kirimUbah: (u: any) => pendengarUbah.forEach((f) => f(u)),
    kirimKeLatar: (isi: any, pengirim: any) =>
      new Promise<any>((selesai) => kirimKe(pendengarLatar, isi, pengirim, selesai, runtimeCS)),
  };
}

describe("jalur aman: halaman portal -> ekstensi -> chrome.downloads dari blob ekstensi", () => {
  it("aleta.js mengumumkan dukungan unduhan aman pada <html> portal", () => {
    const r = rantai({ pelayan: () => jawabanZip(MB) });
    expect(r.w.document.documentElement.dataset.aletaUnduhAman).toBe("1");
  });

  it("ZIP perkara: diambil dokumen offscreen berkredensial, diterbitkan dari blob:chrome-extension:// (bukan http/data:), nama dari Content-Disposition", async () => {
    const r = rantai({ pelayan: () => jawabanZip(3 * MB, { panjang: true }) });
    r.mintaDariHalaman("u1", RUTE_ZIP);
    await tunggu(() => !!r.balasan("u1"));

    const j = r.balasan("u1");
    expect(j).toMatchObject({ ok: true, nama: NAMA_ZIP, ukuran: 3 * MB });
    // Dokumen offscreen dibuat dengan alasan BLOBS, dan dialah yang mengambil rute ZIP (kuki ikut).
    expect(r.dokumenDibuat).toEqual([expect.objectContaining({ url: "unduh-aman.html", reasons: ["BLOBS"] })]);
    expect(r.ambilDok).toHaveLength(1);
    expect(r.ambilDok[0].alamat).toBe(`${ASAL}${RUTE_ZIP}`);
    expect(r.ambilDok[0].init).toMatchObject({ method: "GET", credentials: "include", cache: "no-store" });
    // Satu unduhan, alamatnya blob milik ekstensi - bukan rute http yang ditahan Chrome, bukan data:.
    expect(r.unduhan).toHaveLength(1);
    expect(r.unduhan[0].url.startsWith(`blob:${ASAL_EKS}/`)).toBe(true);
    expect(r.unduhan[0].url).not.toMatch(/^(?:https?|data):/);
    expect(r.unduhan[0].nama).toBe(NAMA_ZIP);
    // Kabar sampai ke halaman: diterima lalu mulai (dengan ukuran dari Content-Length).
    const tahap = r.kabar("u1").map((k) => k.tahap);
    expect(tahap).toContain("mulai");
    // "diterima" (jawaban pekerja latar) tidak pernah datang SESUDAH "mulai".
    expect(tahap.slice(tahap.indexOf("mulai"))).not.toContain("diterima");
    expect(r.kabar("u1").find((k) => k.tahap === "mulai")).toMatchObject({ ukuran: 3 * MB });
    // Sesudah tersimpan blob dilepas dan dokumen offscreen ditutup.
    await tunggu(() => r.ditutup() === 1);
    expect(r.dilepas).toEqual([r.unduhan[0].url]);
  });

  it("berkas 45 MB (> batas data: 40 MB): tetap blob ekstensi, tidak ada data: dan tidak ada pesan berisi badan berkas", async () => {
    const r = rantai({ pelayan: () => jawabanZip(45 * MB) });
    r.mintaDariHalaman("besar", RUTE_ZIP);
    await tunggu(() => !!r.balasan("besar"), 20000);

    expect(r.balasan("besar")).toMatchObject({ ok: true, ukuran: 45 * MB });
    expect(r.unduhan).toHaveLength(1);
    expect(r.unduhan[0].url.startsWith(`blob:${ASAL_EKS}/`)).toBe(true);
    expect(r.unduhan[0].fileSize).toBe(45 * MB);
    const terbesar = Math.max(...r.pesan.map((p) => JSON.stringify(p).length));
    expect(terbesar).toBeLessThan(4000);
    expect(r.pesan.some((p) => JSON.stringify(p).includes("data:"))).toBe(false);
    expect(r.jalurLama).toEqual([]);
  }, 30000);

  it("galat server (403 JSON portal): sebabnya sampai ke halaman, tidak ada unduhan", async () => {
    const r = rantai({
      pelayan: () =>
        new Response(JSON.stringify({ ok: false, error: { message: "Akses ditolak untuk perkara ini" } }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
    });
    r.mintaDariHalaman("g1", RUTE_ZIP);
    await tunggu(() => !!r.balasan("g1"));
    const j = r.balasan("g1");
    expect(j).toMatchObject({ ok: false, galatServer: true, status: 403 });
    expect(j.sebab).toContain("Akses ditolak untuk perkara ini");
    expect(r.unduhan).toEqual([]);
  });

  it("sesi berakhir (halaman masuk HTML 200): disebut sesi berakhir, bukan disimpan sebagai berkas", async () => {
    const r = rantai({
      pelayan: () => new Response("<!doctype html><title>Masuk - ALETA</title><form>login</form>", { status: 200, headers: { "content-type": "text/html" } }),
    });
    r.mintaDariHalaman("g2", RUTE_ZIP);
    await tunggu(() => !!r.balasan("g2"));
    expect(r.balasan("g2")).toMatchObject({ ok: false, galatServer: true });
    expect(r.balasan("g2").sebab).toMatch(/Sesi ALETA berakhir/);
    expect(r.unduhan).toEqual([]);
  });

  it("sambungan putus di tengah aliran: gagal dengan MB yang sudah diterima, tidak ada berkas terpotong", async () => {
    const r = rantai({ pelayan: () => jawabanZip(10 * MB, { putusSesudah: 2 }) });
    r.mintaDariHalaman("p1", RUTE_ZIP);
    await tunggu(() => !!r.balasan("p1"));
    const j = r.balasan("p1");
    expect(j.ok).toBe(false);
    expect(j.galatServer).toBe(false);
    expect(j.sebab).toMatch(/terputus sesudah 2,0 MB/);
    expect(r.unduhan).toEqual([]);
  });

  it("pengelola unduhan (IDM) mengosongkan hasil: dilaporkan diambilPengelola (portal lalu memakai jalur lama)", async () => {
    const r = rantai({ pelayan: () => jawabanZip(2 * MB, { panjang: true }), ukuranCakram: () => 0 });
    r.mintaDariHalaman("idm", RUTE_ZIP);
    await tunggu(() => !!r.balasan("idm"));
    expect(r.balasan("idm")).toMatchObject({ ok: false, diambilPengelola: true });
    expect(r.balasan("idm").sebab).toMatch(/Internet Download Manager/);
  });

  it("Chrome tanpa chrome.offscreen: ditolak bersih sebagai ditolakEkstensi (tidak ada fetch, tidak ada unduhan)", async () => {
    const r = rantai({ pelayan: () => jawabanZip(MB), tanpaOffscreen: true });
    r.mintaDariHalaman("lama", RUTE_ZIP);
    await tunggu(() => !!r.balasan("lama"));
    expect(r.balasan("lama")).toMatchObject({ ok: false, ditolakEkstensi: true });
    expect(r.ambilDok).toEqual([]);
    expect(r.unduhan).toEqual([]);
  });

  it("alamat lintas asal dari halaman ditolak jembatan; pekerja latar menolak alamat bukan milik tab/di luar satker", async () => {
    const r = rantai({ pelayan: () => jawabanZip(MB) });
    r.mintaDariHalaman("x1", "http://contoh.test/berkas.zip");
    await tunggu(() => !!r.balasan("x1"));
    expect(r.balasan("x1")).toMatchObject({ ok: false });
    expect(r.balasan("x1").sebab).toMatch(/bukan milik portal/);

    const tab = { id: 7, url: PORTAL };
    const lainPort = await r.kirimKeLatar(
      { sumber: "aleta-panel", jenis: "unduh-aman-mulai", alamat: `${ASAL}:8008${RUTE_ZIP}`, idTugas: "a" },
      { id: ID, url: PORTAL, tab, frameId: 0 }
    );
    expect(lainPort).toMatchObject({ ok: false, ditolakEkstensi: true });
    expect(lainPort.pesan).toMatch(/bukan milik halaman ini/);
    const luar = await r.kirimKeLatar(
      { sumber: "aleta-panel", jenis: "unduh-aman-mulai", alamat: "http://contoh.test/a.zip", idTugas: "b" },
      { id: ID, url: "http://contoh.test/x", tab: { id: 9, url: "http://contoh.test/x" }, frameId: 0 }
    );
    expect(luar.pesan).toMatch(/di luar server satker/);
    expect(r.ambilDok).toEqual([]);
  });

  it("latar.js tetap menolak menerbitkan alamat http langsung (hanya data: dan blob milik ekstensi)", async () => {
    const r = rantai({ pelayan: () => jawabanZip(MB) });
    const j = await r.kirimKeLatar(
      { sumber: "aleta-panel", jenis: "unduh", nama: "a.zip", alamat: `${ASAL}${RUTE_ZIP}` },
      { id: ID, url: PORTAL, tab: { id: 7, url: PORTAL } }
    );
    expect(j).toMatchObject({ ok: false });
    expect(j.pesan).toMatch(/bukan data:\/blob ekstensi/);
    expect(r.unduhan).toEqual([]);
  });
});

describe("unduhan portal lain dan SIPP besar memakai jalur yang sama", () => {
  it("portal: tautan unduhan ekspor (lapis 1) diambil ekstensi, bukan fetch+data: di tab", async () => {
    const r = rantai({
      pelayan: () => new Response("a,b\n1,2\n", { status: 200, headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="ekspor-e-status.csv"' } }),
    });
    const a = r.w.document.createElement("a");
    a.setAttribute("href", "/aleta/api/e-status/batches/1/export?format=csv");
    a.setAttribute("download", "");
    r.w.document.body.appendChild(a);
    a.dispatchEvent(new r.w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    await tunggu(() => r.unduhan.length === 1);
    expect(r.unduhan[0]).toMatchObject({ nama: "ekspor-e-status.csv" });
    expect(r.unduhan[0].url.startsWith(`blob:${ASAL_EKS}/`)).toBe(true);
    expect(r.jalurLama).toEqual([]);
  });

  it("portal: unduhan bingkai ZIP yang tetap ditahan Chrome diulang lewat ekstensi (bukan fetch 40 MB di tab)", async () => {
    const alamat = `${ASAL}${RUTE_ZIP}&token=abc123`;
    const r = rantai({
      pelayan: () => jawabanZip(2 * MB),
      butirUnduhanLain: {
        5: { id: 5, state: "interrupted", error: "FILE_BLOCKED", danger: "safe", url: alamat, finalUrl: alamat, referrer: PORTAL, mime: "application/zip", filename: "" },
      },
    });
    r.kirimUbah({ id: 5, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await tunggu(() => r.dihapus.includes(5));
    expect(r.ambilDok.map((x) => x.alamat)).toEqual([alamat]);
    expect(r.unduhan).toHaveLength(1);
    expect(r.unduhan[0].url.startsWith(`blob:${ASAL_EKS}/`)).toBe(true);
    expect(r.jalurLama).toEqual([]);
  });

  it("SIPP: GET > 40 MB (Content-Length) dialihkan ke jalur aman, bukan ditolak; tidak ada 'aleta' di DOM SIPP", async () => {
    const r = rantai({ halaman: SIPP, pelayan: () => jawabanZip(41 * MB, { panjang: true }) });
    const alamat = `${ASAL}/SIPP/index.php/arsip/unduh/9.zip`;
    let dibatalkan = false;
    r.w.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: (k: string) => ({ "content-type": "application/zip", "content-length": String(41 * MB) })[k.toLowerCase()] ?? null },
      body: { cancel: async () => void (dibatalkan = true) },
      blob: async () => {
        throw new Error("badan > 40 MB tidak boleh dibaca di tab");
      },
    });
    const h = await r.w.aletaUnduhUniversal.ambilDanUnduh({ alamat });
    expect(h).toMatchObject({ ok: true, lewat: "unduh-aman", nama: NAMA_ZIP });
    expect(dibatalkan).toBe(true);
    expect(r.unduhan[0].url.startsWith(`blob:${ASAL_EKS}/`)).toBe(true);
    expect(r.jalurLama).toEqual([]);
    expect(r.w.document.documentElement.outerHTML).not.toMatch(/aleta/i);
  }, 30000);
});

describe("manifest dan penanaman", () => {
  const manifest = JSON.parse(baca("manifest.json"));
  it("izin offscreen ada; berkas jalur aman ikut tertanam; latar.js memuat modulnya", () => {
    expect(manifest.permissions).toContain("offscreen");
    const susun = readFileSync(path.resolve(__dirname, "../../scripts/susun-ekstensi.mjs"), "utf8");
    for (const n of ["unduh-aman-latar.js", "unduh-aman.html", "unduh-aman.js"]) expect(susun).toContain(`"${n}"`);
    expect(SUMBER_LATAR).toContain('importScripts("unduh-aman-latar.js")');
    expect(baca("unduh-aman.html")).toContain('<script src="unduh-aman.js"></script>');
  });
});
