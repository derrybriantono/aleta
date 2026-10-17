// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * UNDUHAN UNIVERSAL (17 Okt 2026) - DIJALANKAN, BUKAN DIBACA
 * ============================================================================
 *
 * Permintaan: semua unduhan saat ekstensi menyala di SIPP, ALETA, dan blangko
 * Derry di ABT tidak lagi "unduhan tidak aman diblokir". Yang dibuktikan di
 * sini, dengan unduh-universal.js, unduh-halaman.js, potongan alatUnduh dari
 * panel-alat.js, dan latar.js yang SUNGGUHAN (jsdom + node:vm):
 *
 *   - klik tautan unduh SIPP / ALETA / Derry-ABT -> chrome.downloads.download
 *     dengan alamat data: dan NAMA yang benar, fetch berkredensial;
 *   - ABT non-Derry TIDAK dialihkan (tidak ada fetch, klik asli lolos);
 *   - jalur lama alatUnduh tetap (dan cadangan tautannya tidak dialihkan lagi);
 *   - unduhan terblokir (FILE_BLOCKED) diulang lewat tab asal, POST diulang
 *     sebagai POST, ABT non-Derry tidak diulang;
 *   - tidak satu pun tulisan "aleta" masuk ke DOM halaman SIPP.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8").replace(/\r\n/g, "\n");
const SUMBER_UNIVERSAL = baca("unduh-universal.js");
const SUMBER_HALAMAN = baca("unduh-halaman.js");
const SUMBER_LATAR = baca("latar.js");
const SUMBER_ALAT = baca("panel-alat.js");

function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  const hasil: string[] = [];
  for (const n of nama) {
    const i = baris.findIndex((b) => new RegExp(`^(?:async )?function ${n}\\(`).test(b));
    if (i < 0) throw new Error(`fungsi ${n} tidak ditemukan`);
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    hasil.push(baris.slice(i, j + 1).join("\n"));
  }
  return hasil.join("\n\n");
}

const POTONGAN_ALAT = [
  SUMBER_ALAT.match(/const ALAT_AKHIRAN_TIPE = \{[\s\S]*?\n\};/)![0],
  SUMBER_ALAT.match(/const ALAT_POLA_NAMA_GENERIK = .*;/)![0],
  "const ALAT_TAUTAN_ASLI = new WeakSet();",
  potongFungsi(SUMBER_ALAT, [
    "alatTandaiTautanAsli",
    "alatLepasTautanAsli",
    "alatTautanAsli",
    "alatNamaUnduhanLayak",
    "alatBlobKeData",
    "alatUnduhLewatTautan",
    "alatUnduh",
  ]),
].join("\n");

type Unduhan = { url: string; filename: string; saveAs?: boolean };
type Balasan = { status?: number; tipe?: string; disposisi?: string; isi?: string };

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

interface Opsi {
  alamat: string;
  html?: string;
  /** Balasan fetch menurut alamat (tanpa hash); selain itu 404. */
  balasan?: Record<string, Balasan>;
  /** Pekerja latar tiruan menolak pesan "unduh" (menguji cadangan tautan). */
  latarMenolak?: boolean;
  pasangShim?: boolean;
}

function lingkungan(o: Opsi) {
  const dom = new JSDOM(o.html ?? "<!doctype html><html><body></body></html>", { url: o.alamat, runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;

  // ---- pekerja latar sungguhan -------------------------------------------
  const diterbitkan: Unduhan[] = [];
  const dihapus: number[] = [];
  const dibatalkan: number[] = [];
  const pendengarLatar: any[] = [];
  const pendengarUbah: any[] = [];
  let pendengarTab: ((p: any, s: any, j: (x: unknown) => void) => unknown) | null = null;
  const butirUnduhan: Record<number, any> = {};
  const pesanKeTab: any[] = [];
  const tabTerbuka: any[] = [{ id: 11, url: o.alamat, active: true }];
  const gudang = (isi: Record<string, any>) => ({
    get: async (k: string | string[]) => Object.fromEntries((Array.isArray(k) ? k : [k]).map((x) => [x, isi[x]])),
    set: async (b: Record<string, any>) => void Object.assign(isi, JSON.parse(JSON.stringify(b))),
    remove: async () => {},
  });
  const konteksLatar: Record<string, any> = {
    console,
    chrome: {
      runtime: {
        lastError: undefined,
        getManifest: () => ({ version: "1.205.0", host_permissions: ["http://192.168.10.10/*", "http://127.0.0.1/*"] }),
        onUpdateAvailable: { addListener: () => {} },
        onMessage: { addListener: (f: any) => pendengarLatar.push(f) },
      },
      downloads: {
        onDeterminingFilename: { addListener: () => {} },
        onChanged: { addListener: (f: any) => pendengarUbah.push(f), removeListener: () => {} },
        download: (opsi: Unduhan, balik: (id?: number) => void) => {
          diterbitkan.push(opsi);
          balik(100 + diterbitkan.length);
        },
        search: (k: { id: number }, balik: (x: unknown[]) => void) => balik(butirUnduhan[k.id] ? [butirUnduhan[k.id]] : []),
        erase: (k: { id: number }) => void dihapus.push(k.id),
        cancel: (id: number, balik?: () => void) => {
          dibatalkan.push(id);
          balik?.();
        },
      },
      tabs: {
        query: async () => tabTerbuka,
        sendMessage: async (id: number, pesan: any) => {
          pesanKeTab.push({ id, pesan });
          return await new Promise((selesai, gagal) => {
            if (!pendengarTab) return gagal(new Error("Receiving end does not exist"));
            pendengarTab(JSON.parse(JSON.stringify(pesan)), {}, selesai);
          });
        },
      },
      storage: { session: gudang({}), local: gudang({}) },
    },
    fetch: async () => {
      throw new Error("latar tidak mengambil apa pun");
    },
    setTimeout: (f: () => void) => setTimeout(f, 0),
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    btoa,
    crypto: globalThis.crypto,
  };
  konteksLatar.self = konteksLatar;
  konteksLatar.globalThis = konteksLatar;
  vm.createContext(konteksLatar);
  vm.runInContext(SUMBER_LATAR, konteksLatar, { filename: "latar.js" });

  // ---- halaman: chrome, fetch, skrip konten --------------------------------
  const permintaan: Array<{ alamat: string; init: any }> = [];
  const catatan: string[] = [];
  w.chrome = {
    runtime: {
      lastError: undefined,
      sendMessage: (pesan: any, balik: (x?: unknown) => void) => {
        if (o.latarMenolak && pesan.jenis === "unduh") return balik({ ok: false, pesan: "ditolak" });
        let dijawab = false;
        for (const f of pendengarLatar) {
          f(JSON.parse(JSON.stringify(pesan)), { url: o.alamat }, (x: unknown) => {
            if (dijawab) return;
            dijawab = true;
            balik(JSON.parse(JSON.stringify(x)));
          });
        }
      },
      onMessage: {
        addListener: (f: any) => {
          pendengarTab = f;
        },
      },
    },
  };
  w.fetch = async (alamat: string, init: any = {}) => {
    permintaan.push({ alamat, init });
    const b = (o.balasan ?? {})[alamat.replace(/#.*$/, "")];
    if (!b) return { ok: false, status: 404, headers: { get: () => null }, blob: async () => new w.Blob([]) };
    const status = b.status ?? 200;
    const kepala: Record<string, string> = {
      "content-type": b.tipe ?? "application/rtf",
      ...(b.disposisi ? { "content-disposition": b.disposisi } : {}),
    };
    return {
      ok: status < 400,
      status,
      headers: { get: (k: string) => kepala[k.toLowerCase()] ?? null },
      blob: async () => new w.Blob([b.isi ?? "{\\rtf1 x}"], { type: kepala["content-type"] }),
    };
  };
  w.alatCatat = (_j: string, ringkas: string) => void catatan.push(ringkas);
  w.URL.createObjectURL = () => "blob:http://halaman/cadangan-1";
  w.URL.revokeObjectURL = () => {};

  const konteks = dom.getInternalVMContext();
  new vm.Script(POTONGAN_ALAT, { filename: "panel-alat.potongan.js" }).runInContext(konteks);
  if (o.pasangShim) new vm.Script(SUMBER_HALAMAN, { filename: "unduh-halaman.js" }).runInContext(konteks);
  new vm.Script(SUMBER_UNIVERSAL, { filename: "unduh-universal.js" }).runInContext(konteks);

  const tunggu = async (n = 8) => {
    for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const tambahTautan = (atribut: Record<string, string>, induk?: Element) => {
    const a = w.document.createElement("a");
    for (const [k, v] of Object.entries(atribut)) a.setAttribute(k, v);
    a.textContent = "unduh";
    (induk ?? w.document.body).appendChild(a);
    return a;
  };
  /** Klik sungguhan; pulang true bila klik TIDAK dibatalkan (tautan asli jalan). */
  const klik = (a: any) => {
    const e = new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    // Navigasi sungguhan tidak ada di jsdom; yang dihitung hanya apakah dibatalkan.
    a.addEventListener("click", (x: Event) => x.preventDefault(), { once: false });
    return a.dispatchEvent(e) || e.defaultPrevented;
  };
  return {
    w,
    dom,
    diterbitkan,
    dihapus,
    dibatalkan,
    permintaan,
    catatan,
    tunggu,
    tambahTautan,
    pesanKeTab,
    butirUnduhan,
    kirimUbah: (u: any) => pendengarUbah.forEach((f) => f(u)),
    tabTerbuka,
    klik,
  };
}

/** Klik dengan pendengar PALING AKHIR yang mencatat apakah klik sampai tanpa dibatalkan skrip kita. */
function klikDanLihat(l: ReturnType<typeof lingkungan>, a: any) {
  let batal = false;
  const e = new l.w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  l.w.document.addEventListener("click", () => void (batal = e.defaultPrevented), false);
  // Mencegah navigasi sungguhan jsdom setelah pengamatan.
  a.dispatchEvent(e);
  return { dibatalkan: batal || e.defaultPrevented };
}

const SIPP = "http://192.168.10.10/SIPP/index.php/perkara/detil/123";
const ALETA = "http://192.168.10.10/aleta/aleta-ecourt";
const ABT = "http://192.168.10.10/aps_badilag/index.php/abt/cetak";

describe("lapis 1: tautan unduh dialihkan ke chrome.downloads", () => {
  it("SIPP: <a download href=blob:> -> data: ke chrome.downloads, nama benar, kredensial ikut", async () => {
    const l = lingkungan({
      alamat: SIPP,
      balasan: { "blob:http://192.168.10.10/uuid-1": { isi: "{\\rtf1 isi}", tipe: "application/rtf" } },
    });
    const a = l.tambahTautan({ href: "blob:http://192.168.10.10/uuid-1", download: "630_Pdt.G_2026_PA.Dgl - BAS.rtf" });
    const { dibatalkan } = klikDanLihat(l, a);
    await l.tunggu();
    expect(dibatalkan).toBe(true);
    expect(l.permintaan[0].init.credentials).toBe("include");
    expect(l.diterbitkan).toHaveLength(1);
    expect(l.diterbitkan[0].filename).toBe("630_Pdt.G_2026_PA.Dgl - BAS.rtf");
    expect(l.diterbitkan[0].url.startsWith("data:application/rtf;base64,")).toBe(true);
    expect(l.diterbitkan[0].saveAs).toBe(false);
  });

  it("SIPP: tautan biasa ke .zip/.rtf (tanpa atribut download) memakai nama dari Content-Disposition", async () => {
    const alamat = "http://192.168.10.10/SIPP/index.php/edoc/unduh/55.rtf";
    const l = lingkungan({
      alamat: SIPP,
      balasan: { [alamat]: { disposisi: `attachment; filename="Penetapan PMH 630.rtf"`, tipe: "application/octet-stream" } },
    });
    const a = l.tambahTautan({ href: alamat });
    expect(klikDanLihat(l, a).dibatalkan).toBe(true);
    await l.tunggu();
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["Penetapan PMH 630.rtf"]);
    expect(l.permintaan[0].init.credentials).toBe("include");
  });

  it("SIPP: filename* (RFC 5987) mengalahkan atribut download", async () => {
    const alamat = "http://192.168.10.10/SIPP/index.php/laporan/ekspor";
    const l = lingkungan({
      alamat: SIPP,
      balasan: { [alamat]: { disposisi: "attachment; filename*=UTF-8''Laporan%20Bulan%20Ini.csv", tipe: "text/csv" } },
    });
    const a = l.tambahTautan({ href: alamat, download: "download.csv" });
    klikDanLihat(l, a);
    await l.tunggu();
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["Laporan Bulan Ini.csv"]);
  });

  it("tautan PDF / halaman biasa TIDAK dicegat (peramban menampilkannya)", async () => {
    const l = lingkungan({ alamat: SIPP });
    for (const href of ["http://192.168.10.10/SIPP/index.php/perkara/cetak/1.pdf", "http://192.168.10.10/SIPP/index.php/perkara/detil/2", "#bagian"]) {
      const a = l.tambahTautan({ href });
      expect(klikDanLihat(l, a).dibatalkan).toBe(false);
    }
    await l.tunggu();
    expect(l.permintaan).toEqual([]);
    expect(l.diterbitkan).toEqual([]);
  });

  it("klik dengan Ctrl / tengah dibiarkan (petugas memang minta cara lain)", async () => {
    const l = lingkungan({ alamat: SIPP, balasan: { "http://192.168.10.10/SIPP/x.zip": { tipe: "application/zip" } } });
    const a = l.tambahTautan({ href: "http://192.168.10.10/SIPP/x.zip" });
    const e = new l.w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    a.dispatchEvent(e);
    await l.tunggu();
    expect(l.permintaan).toEqual([]);
  });

  it("tautan lintas asal tidak diambil", async () => {
    const l = lingkungan({ alamat: SIPP });
    const a = l.tambahTautan({ href: "http://contoh.test/berkas.zip", download: "x.zip" });
    expect(klikDanLihat(l, a).dibatalkan).toBe(false);
    expect(l.permintaan).toEqual([]);
  });

  it("ALETA: blob CSV dari portal -> chrome.downloads dengan nama atribut", async () => {
    const l = lingkungan({
      alamat: ALETA,
      balasan: { "blob:http://192.168.10.10/uuid-2": { isi: "a,b\n1,2", tipe: "text/csv" } },
    });
    const a = l.tambahTautan({ href: "blob:http://192.168.10.10/uuid-2", download: "riwayat-aleta-2026-10-17.csv" });
    klikDanLihat(l, a);
    await l.tunggu();
    expect(l.diterbitkan).toHaveLength(1);
    expect(l.diterbitkan[0].filename).toBe("riwayat-aleta-2026-10-17.csv");
    expect(l.diterbitkan[0].url.startsWith("data:text/csv;base64,")).toBe(true);
  });

  it("ALETA: a.click() skrip halaman pada tautan yang tidak terpasang di DOM (dunia halaman)", async () => {
    const l = lingkungan({
      alamat: ALETA,
      pasangShim: true,
      balasan: { "http://192.168.10.10/aleta/api/aleta-ecourt/berkas-zip?id=9": { tipe: "application/zip", disposisi: 'attachment; filename="Arsip e-Court 630.zip"' } },
    });
    const a = l.w.document.createElement("a");
    a.href = "/aleta/api/aleta-ecourt/berkas-zip?id=9";
    a.setAttribute("download", "");
    a.click(); // tanpa appendChild: click tidak pernah naik ke document
    await l.tunggu();
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["Arsip e-Court 630.zip"]);
    expect(l.permintaan[0].init.credentials).toBe("include");
  });

  it("nama generik tanpa petunjuk lain -> 'Unduhan <waktu>.<akhiran jenis>', bukan download.rtf", async () => {
    const l = lingkungan({ alamat: SIPP, balasan: { "blob:http://192.168.10.10/u": { tipe: "application/pdf" } } });
    const a = l.tambahTautan({ href: "blob:http://192.168.10.10/u", download: "download" });
    klikDanLihat(l, a);
    await l.tunggu();
    expect(l.diterbitkan).toHaveLength(1);
    expect(l.diterbitkan[0].filename).toMatch(/^Unduhan \d{4}-\d{2}-\d{2} \d{6}\.pdf$/);
  });

  it("gagal diambil (404) -> tautan ASLI dijalankan, dicatat, tidak ada unduhan hilang diam-diam", async () => {
    const l = lingkungan({ alamat: SIPP });
    const a = l.tambahTautan({ href: "http://192.168.10.10/SIPP/x.rtf", download: "x.rtf" });
    let klikAsli = 0;
    a.addEventListener("click", () => void (klikAsli += 1));
    klikDanLihat(l, a);
    await l.tunggu();
    expect(l.diterbitkan).toEqual([]);
    expect(klikAsli).toBe(2); // klik petugas + klik asli ulangan
    expect(l.catatan.join("|")).toContain("tautan dibiarkan asli");
  });

  it("tidak satu tulisan 'aleta' ditulis ke DOM halaman SIPP", async () => {
    const l = lingkungan({ alamat: SIPP, balasan: { "blob:http://192.168.10.10/uuid-1": {} } });
    const a = l.tambahTautan({ href: "blob:http://192.168.10.10/uuid-1", download: "630_Pdt.G_2026_PA.Dgl - BAS.rtf" });
    klikDanLihat(l, a);
    await l.tunggu();
    expect(l.w.document.documentElement.outerHTML.toLowerCase()).not.toContain("aleta");
  });
});

describe("ABT: hanya blangko Derry", () => {
  it("ABT biasa (non-Derry): unduhan bawaan TIDAK dialihkan", async () => {
    const l = lingkungan({ alamat: ABT, pasangShim: true, balasan: { "http://192.168.10.10/aps_badilag/cetak/1.rtf": {} } });
    const a = l.tambahTautan({ href: "http://192.168.10.10/aps_badilag/cetak/1.rtf" });
    expect(klikDanLihat(l, a).dibatalkan).toBe(false);
    const b = l.tambahTautan({ href: "blob:http://192.168.10.10/b", download: "x.rtf" });
    expect(klikDanLihat(l, b).dibatalkan).toBe(false);
    // dunia halaman: click() juga berjalan asli
    const c = l.w.document.createElement("a");
    c.href = "/aps_badilag/cetak/2.rtf";
    c.setAttribute("download", "y.rtf");
    c.addEventListener("click", (e: Event) => e.preventDefault());
    c.click();
    await l.tunggu();
    expect(l.permintaan).toEqual([]);
    expect(l.diterbitkan).toEqual([]);
  });

  it("tampilan Blangko Derry aktif: unduhan dialihkan", async () => {
    const l = lingkungan({
      alamat: ABT,
      html: `<!doctype html><html class="aleta-bd-aktif"><body><div id="aleta-bd-akar"></div></body></html>`,
      balasan: { "blob:http://192.168.10.10/derry": { isi: "{\\rtf1 d}" } },
    });
    const a = l.tambahTautan({ href: "blob:http://192.168.10.10/derry", download: "630_Pdt.G_2026_PA.Dgl - [01] Cerai.rtf" }, l.w.document.getElementById("aleta-bd-akar"));
    expect(klikDanLihat(l, a).dibatalkan).toBe(true);
    await l.tunggu();
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["630_Pdt.G_2026_PA.Dgl - [01] Cerai.rtf"]);
  });
});

describe("jalur lama alatUnduh tetap", () => {
  it("alatUnduh -> pesan 'unduh' -> latar -> chrome.downloads (satu kali, nama dipakai)", async () => {
    const l = lingkungan({ alamat: SIPP });
    const hasil = await l.w.alatUnduh(new l.w.Blob(["{\\rtf1 x}"], { type: "application/rtf" }), "1_Pdt.G_2026_PA.Dgl - BAS.rtf");
    expect(hasil.lewat).toBe("ekstensi");
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["1_Pdt.G_2026_PA.Dgl - BAS.rtf"]);
  });

  it("latar menolak -> tautan cadangan dibuat dan TIDAK dialihkan lagi (tanpa lingkaran)", async () => {
    const l = lingkungan({ alamat: SIPP, latarMenolak: true });
    let diklik = 0;
    l.w.document.addEventListener("click", () => void (diklik += 1), false);
    const hasil = await l.w.alatUnduh(new l.w.Blob(["x"], { type: "application/rtf" }), "1_Pdt.G_2026_PA.Dgl - BAS.rtf");
    await l.tunggu();
    expect(hasil.lewat).toBe("halaman");
    expect(diklik).toBe(1);
    expect(l.permintaan).toEqual([]);
  });

  it("opsi tanpaCadangan: gagal bersih, tanpa tautan halaman", async () => {
    const l = lingkungan({ alamat: SIPP, latarMenolak: true });
    let diklik = 0;
    l.w.document.addEventListener("click", () => void (diklik += 1), false);
    const hasil = await l.w.alatUnduh(new l.w.Blob(["x"], { type: "application/rtf" }), "1_Pdt.G_2026_PA.Dgl - BAS.rtf", { tanpaCadangan: true });
    expect(hasil.ok).toBe(false);
    expect(diklik).toBe(0);
  });
});

describe("lapis 2: unduhan terblokir diulang lewat tab asal", () => {
  const terblokir = (id: number, tambahan: Record<string, unknown> = {}) => ({
    id,
    state: "interrupted",
    error: "FILE_BLOCKED",
    url: "http://192.168.10.10/SIPP/index.php/cetak/relaas/7",
    finalUrl: "http://192.168.10.10/SIPP/index.php/cetak/relaas/7",
    referrer: SIPP,
    mime: "application/rtf",
    filename: "C:\\Users\\Petugas\\Downloads\\download.rtf",
    danger: "safe",
    ...tambahan,
  });

  it("GET terblokir -> tab asal mengambil ulang berkredensial -> chrome.downloads + entri gagal dihapus", async () => {
    const l = lingkungan({
      alamat: SIPP,
      balasan: { "http://192.168.10.10/SIPP/index.php/cetak/relaas/7": { disposisi: 'attachment; filename="Relaas 630.rtf"' } },
    });
    l.butirUnduhan[5] = terblokir(5);
    l.kirimUbah({ id: 5, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await l.tunggu(20);
    expect(l.pesanKeTab).toHaveLength(1);
    expect(l.pesanKeTab[0].pesan.jenis).toBe("unduh-ulang");
    expect(l.permintaan[0].init.credentials).toBe("include");
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["Relaas 630.rtf"]);
    expect(l.dihapus).toEqual([5]);
  });

  it("blob: milik halaman diulang dari tab itu juga", async () => {
    const l = lingkungan({ alamat: SIPP, balasan: { "blob:http://192.168.10.10/lama": { isi: "{\\rtf1 b}" } } });
    l.butirUnduhan[6] = terblokir(6, { url: "blob:http://192.168.10.10/lama", finalUrl: "blob:http://192.168.10.10/lama", filename: "C:\\U\\630_Pdt.G_2026_PA.Dgl - BAS.rtf" });
    l.kirimUbah({ id: 6, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await l.tunggu(20);
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["630_Pdt.G_2026_PA.Dgl - BAS.rtf"]);
  });

  const borang = (aksi: string) =>
    `<!doctype html><html><body><form id="f" method="post" action="${aksi}"><input name="bulan" value="10"><input name="tahun" value="2026"></form></body></html>`;
  const kirimBorang = (l: ReturnType<typeof lingkungan>) => {
    const f = l.w.document.getElementById("f");
    f.addEventListener("submit", (e: Event) => e.preventDefault());
    f.dispatchEvent(new l.w.Event("submit", { bubbles: true, cancelable: true }));
  };

  it("POST cetak SIPP yang terbukti baca-saja (daftar putih) diulang otomatis sebagai POST", async () => {
    const aksi = "http://192.168.10.10/SIPP/index.php/perkara_list_cetak/cetak/1";
    const l = lingkungan({
      alamat: SIPP,
      html: borang(aksi),
      balasan: { [aksi]: { disposisi: 'attachment; filename="Daftar perkara 10-2026.xls"', tipe: "application/vnd.ms-excel" } },
    });
    kirimBorang(l);
    l.butirUnduhan[8] = terblokir(8, { url: aksi, finalUrl: aksi, mime: "application/vnd.ms-excel" });
    l.kirimUbah({ id: 8, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await l.tunggu(20);
    expect(l.permintaan[0].init.method).toBe("POST");
    expect(String(l.permintaan[0].init.body)).toBe("bulan=10&tahun=2026");
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["Daftar perkara 10-2026.xls"]);
  });

  it("POST di luar daftar putih TIDAK PERNAH diulang otomatis: hanya pemberitahuan, diulang atas klik", async () => {
    const aksi = "http://192.168.10.10/SIPP/index.php/laporan/ekspor";
    const l = lingkungan({
      alamat: SIPP,
      html: borang(aksi),
      balasan: { [aksi]: { disposisi: 'attachment; filename="Laporan 10-2026.csv"', tipe: "text/csv" } },
    });
    kirimBorang(l);
    l.butirUnduhan[8] = terblokir(8, { url: aksi, finalUrl: aksi, mime: "text/csv" });
    l.kirimUbah({ id: 8, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await l.tunggu(20);
    // Tanpa klik: tidak ada permintaan sama sekali, tidak ada unduhan, entri belum disentuh.
    expect(l.permintaan).toEqual([]);
    expect(l.diterbitkan).toEqual([]);
    expect(l.dihapus).toEqual([]);
    const tombol = l.w.document.querySelector("#unduhan-ditahan-wadah button");
    expect(tombol.textContent).toBe("Unduhan ditahan Chrome - klik untuk mengunduh ulang");
    expect(l.w.document.documentElement.outerHTML.toLowerCase()).not.toContain("aleta");
    // Klik petugas -> barulah POST dikirim, berkas turun, entri gagal dibersihkan.
    tombol.click();
    await l.tunggu(20);
    expect(l.permintaan).toHaveLength(1);
    expect(l.permintaan[0].init.method).toBe("POST");
    expect(String(l.permintaan[0].init.body)).toBe("bulan=10&tahun=2026");
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["Laporan 10-2026.csv"]);
    expect(l.dihapus).toEqual([8]);
    expect(l.w.document.querySelector("#unduhan-ditahan-wadah button")).toBeNull();
  });

  it("POST dari form.submit() skrip halaman (tanpa peristiwa submit) dikenali POST, bukan ditebak GET", async () => {
    const aksi = "http://192.168.10.10/SIPP/index.php/hapus/semua";
    const l = lingkungan({ alamat: SIPP, html: borang(aksi), pasangShim: true, balasan: { [aksi]: { tipe: "application/zip" } } });
    l.w.document.getElementById("f").submit();
    l.butirUnduhan[3] = terblokir(3, { url: aksi, finalUrl: aksi, mime: "application/zip" });
    l.kirimUbah({ id: 3, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await l.tunggu(20);
    expect(l.permintaan).toEqual([]); // tidak ada GET tebakan ke alamat penulis
    expect(l.w.document.querySelector("#unduhan-ditahan-wadah button")).not.toBeNull();
  });

  it("POST di ABT / ALETA tidak pernah di daftar putih (daftar putih hanya SIPP)", async () => {
    const aksi = "http://192.168.10.10/aleta/api/aleta-ecourt/perkara_list_cetak/cetak/1";
    const l = lingkungan({ alamat: ALETA, html: borang(aksi), balasan: { [aksi]: {} } });
    kirimBorang(l);
    l.butirUnduhan[8] = terblokir(8, { url: aksi, finalUrl: aksi, referrer: ALETA });
    l.kirimUbah({ id: 8, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await l.tunggu(20);
    expect(l.permintaan).toEqual([]);
    expect(l.diterbitkan).toEqual([]);
  });

  it("danger 'insecure' (unduhan masih berjalan/menunggu) -> diulang lewat jalur aman, lalu dibatalkan dan dihapus", async () => {
    const l = lingkungan({
      alamat: SIPP,
      balasan: { "http://192.168.10.10/SIPP/index.php/cetak/relaas/7": { disposisi: 'attachment; filename="Relaas 630.rtf"' } },
    });
    l.butirUnduhan[21] = terblokir(21, { state: "in_progress", error: undefined, danger: "insecure" });
    l.kirimUbah({ id: 21, danger: { previous: "safe", current: "insecure" } });
    await l.tunggu(20);
    expect(l.permintaan[0].init.method ?? "GET").toBe("GET");
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["Relaas 630.rtf"]);
    expect(l.dibatalkan).toEqual([21]);
    expect(l.dihapus).toEqual([21]);
  });

  it("danger 'insecure' pada unduhan yang sudah selesai atau dari asal luar -> tidak disentuh", async () => {
    const l = lingkungan({ alamat: SIPP, balasan: { "http://192.168.10.10/SIPP/index.php/cetak/relaas/7": {} } });
    l.butirUnduhan[1] = terblokir(1, { state: "complete", error: undefined, danger: "insecure" });
    l.butirUnduhan[2] = terblokir(2, { state: "in_progress", error: undefined, danger: "insecure", url: "http://contoh.test/x.rtf", finalUrl: "http://contoh.test/x.rtf", referrer: "http://contoh.test/" });
    l.kirimUbah({ id: 1, danger: { current: "insecure" } });
    l.kirimUbah({ id: 2, danger: { current: "insecure" } });
    await l.tunggu(20);
    expect(l.pesanKeTab).toEqual([]);
    expect(l.dibatalkan).toEqual([]);
  });

  it("danger 'insecure' dari borang POST di luar daftar putih -> pemberitahuan, bukan ulangan otomatis", async () => {
    const aksi = "http://192.168.10.10/SIPP/index.php/laporan/ekspor";
    const l = lingkungan({ alamat: SIPP, html: borang(aksi), balasan: { [aksi]: { tipe: "text/csv", disposisi: 'attachment; filename="L.csv"' } } });
    kirimBorang(l);
    l.butirUnduhan[30] = terblokir(30, { url: aksi, finalUrl: aksi, state: "in_progress", error: undefined, danger: "insecure" });
    l.kirimUbah({ id: 30, danger: { current: "insecure" } });
    await l.tunggu(20);
    expect(l.permintaan).toEqual([]);
    expect(l.w.document.querySelector("#unduhan-ditahan-wadah button")).not.toBeNull();
    expect(l.dibatalkan).toEqual([]);
  });

  it("galat FILE_FAILED dari alamat kita diulang; galat jaringan / lain tidak", async () => {
    const l = lingkungan({ alamat: SIPP, balasan: { "http://192.168.10.10/SIPP/index.php/cetak/relaas/7": { disposisi: 'attachment; filename="F.rtf"' } } });
    l.butirUnduhan[40] = terblokir(40, { error: "FILE_FAILED" });
    l.butirUnduhan[41] = terblokir(41, { error: "NETWORK_FAILED" });
    l.kirimUbah({ id: 41, state: { current: "interrupted" }, error: { current: "NETWORK_FAILED" } });
    l.kirimUbah({ id: 40, state: { current: "interrupted" }, error: { current: "FILE_FAILED" } });
    await l.tunggu(20);
    expect(l.diterbitkan.map((d) => d.filename)).toEqual(["F.rtf"]);
    expect(l.dihapus).toEqual([40]);
  });

  it("jawaban ulangan berupa halaman web (bukan berkas) ditolak, tidak jadi berkas", async () => {
    const l = lingkungan({
      alamat: SIPP,
      balasan: { "http://192.168.10.10/SIPP/index.php/cetak/relaas/7": { tipe: "text/html; charset=utf-8", isi: "<html>login</html>" } },
    });
    l.butirUnduhan[9] = terblokir(9);
    l.kirimUbah({ id: 9, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await l.tunggu(20);
    expect(l.diterbitkan).toEqual([]);
    expect(l.dihapus).toEqual([]);
  });

  it("bukan penahanan / buatan ekstensi / asal luar / dibatalkan pengguna -> tidak diulang", async () => {
    const l = lingkungan({ alamat: SIPP, balasan: { "http://192.168.10.10/SIPP/index.php/cetak/relaas/7": {} } });
    l.butirUnduhan[1] = terblokir(1, { error: "USER_CANCELED" });
    l.butirUnduhan[2] = terblokir(2, { byExtensionId: "abc" });
    l.butirUnduhan[3] = terblokir(3, { url: "http://contoh.test/x.rtf", finalUrl: "http://contoh.test/x.rtf", referrer: "http://contoh.test/" });
    l.butirUnduhan[4] = terblokir(4, { error: "FILE_VIRUS_INFECTED" });
    for (const id of [1, 2, 3, 4]) l.kirimUbah({ id, state: { current: "interrupted" }, error: { current: l.butirUnduhan[id].error } });
    await l.tunggu(20);
    expect(l.pesanKeTab).toEqual([]);
    expect(l.diterbitkan).toEqual([]);
  });

  it("satu id hanya diulang sekali", async () => {
    const l = lingkungan({ alamat: SIPP, balasan: { "http://192.168.10.10/SIPP/index.php/cetak/relaas/7": { disposisi: 'attachment; filename="R.rtf"' } } });
    l.butirUnduhan[5] = terblokir(5);
    l.kirimUbah({ id: 5, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    l.kirimUbah({ id: 5, error: { current: "FILE_BLOCKED" } });
    await l.tunggu(20);
    expect(l.diterbitkan).toHaveLength(1);
  });

  it("ABT non-Derry: unduhan terblokir TIDAK diulang; ABT Derry diulang", async () => {
    const alamat = "http://192.168.10.10/aps_badilag/index.php/abt/cetak/1";
    const bukan = lingkungan({ alamat: ABT, balasan: { [alamat]: { disposisi: 'attachment; filename="A.rtf"' } } });
    bukan.butirUnduhan[1] = terblokir(1, { url: alamat, finalUrl: alamat, referrer: ABT });
    bukan.kirimUbah({ id: 1, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await bukan.tunggu(20);
    expect(bukan.permintaan).toEqual([]);
    expect(bukan.diterbitkan).toEqual([]);

    const derry = lingkungan({
      alamat: ABT,
      html: `<!doctype html><html class="aleta-bd-aktif"><body></body></html>`,
      balasan: { [alamat]: { disposisi: 'attachment; filename="630 - Derry.rtf"' } },
    });
    derry.butirUnduhan[1] = terblokir(1, { url: alamat, finalUrl: alamat, referrer: ABT });
    derry.kirimUbah({ id: 1, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await derry.tunggu(20);
    expect(derry.diterbitkan.map((d) => d.filename)).toEqual(["630 - Derry.rtf"]);
  });

  it("ulangan yang gagal di latar tidak membuat tautan halaman (tanpa lingkaran)", async () => {
    const l = lingkungan({
      alamat: SIPP,
      latarMenolak: true,
      balasan: { "http://192.168.10.10/SIPP/index.php/cetak/relaas/7": { disposisi: 'attachment; filename="R.rtf"' } },
    });
    let diklik = 0;
    l.w.document.addEventListener("click", () => void (diklik += 1), false);
    l.butirUnduhan[5] = terblokir(5);
    l.kirimUbah({ id: 5, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } });
    await l.tunggu(20);
    expect(diklik).toBe(0);
    expect(l.dihapus).toEqual([]);
  });
});

describe("berkas, manifest, dan izin", () => {
  const manifest = JSON.parse(baca("manifest.json"));

  it("tidak ada izin baru: tetap storage + downloads dan dua host", () => {
    expect(manifest.permissions).toEqual(["storage", "downloads"]);
    expect(manifest.host_permissions).toEqual(["http://192.168.10.10/*", "http://127.0.0.1/*"]);
  });

  it("unduh-universal.js di SIPP + ABT + ALETA (dunia terasing, sesudah panel-alat.js); unduh-halaman.js di dunia halaman", () => {
    const urut = (nama: string) => manifest.content_scripts.findIndex((c: any) => (c.js || []).includes(nama));
    const uni = manifest.content_scripts[urut("unduh-universal.js")];
    const hal = manifest.content_scripts[urut("unduh-halaman.js")];
    expect(urut("unduh-universal.js")).toBeGreaterThan(urut("panel-alat.js"));
    for (const m of ["http://192.168.10.10/SIPP/*", "http://192.168.10.10/aps_badilag/*", "http://192.168.10.10/aleta/*"]) {
      expect(uni.matches).toContain(m);
      expect(hal.matches).toContain(m);
    }
    expect(hal.world).toBe("MAIN");
    expect(hal.run_at).toBe("document_start");
    expect(uni.world).toBeUndefined();
  });

  it("susun-ekstensi menanam kedua berkas baru", () => {
    const susun = readFileSync(path.resolve(__dirname, "../../scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"unduh-universal.js"');
    expect(susun).toContain('"unduh-halaman.js"');
  });

  it("chrome.downloads.download tetap SATU-satunya di latar.js (tidak ada jalur kedua)", () => {
    expect(SUMBER_LATAR.match(/chrome\.downloads\.download\(/g)?.length).toBe(1);
    const tanpaKomentar = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(tanpaKomentar(SUMBER_UNIVERSAL)).not.toMatch(/chrome\.downloads/);
    expect(tanpaKomentar(SUMBER_HALAMAN)).not.toMatch(/chrome\./);
  });

  it("kode (bukan komentar) tidak menulis atribut/teks 'aleta' ke DOM halaman", () => {
    const kode = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    // nama peristiwa & kelas yang DIBACA dari Derry diizinkan; yang ditulis ke DOM tidak ada.
    expect(kode(SUMBER_UNIVERSAL)).not.toMatch(/setAttribute\([^)]*aleta|dataset\.[a-z]*aleta|innerHTML|classList\.add/i);
    // Pemberitahuan "ditahan Chrome": id, teks, dan gaya netral - tidak ada kata itu di kode yang menuliskannya.
    expect(kode(SUMBER_UNIVERSAL).match(/TEKS_DITAHAN = "[^"]*"|ID_WADAH_DITAHAN = "[^"]*"/g)?.join("")).not.toMatch(/aleta/i);
    expect(kode(SUMBER_HALAMAN)).not.toMatch(/aleta/i);
  });
});
