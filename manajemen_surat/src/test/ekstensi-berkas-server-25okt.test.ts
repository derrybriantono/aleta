// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * K14 - BERKAS CETAK DIKERJAKAN SERVER, SISI EKSTENSI (rantai B, 25 Okt 2026)
 * ============================================================================
 *   berkas-server.js        mati bawaan (tanpa satu permintaan pun); menyala: alur buat -> butir -> mulai -> tunggu -> unduh;
 *                           gagal-aman (null/false/[] alih-alih melempar); pemeriksa sisa hanya untuk RTF besar;
 *   deteksi-sisa-blangko.js RTF besar diperiksa server bila tersedia, jatuh ke pemeriksa lokal bila tidak;
 *                           hasil server dan lokal untuk naskah yang sama identik (satu aturan, dua tempat).
 * (Penggunaan di jendela Cetak massal diuji di blangko-derry-cetak-massal-20okt.test.ts bagian J.)
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const BERKAS = baca("berkas-server.js");
const DETEKSI = baca("deteksi-sisa-blangko.js");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Panggilan = { metode: string; alamat: string; badan: any };
type Opsi = { saklar?: boolean; jawab?: (p: Panggilan) => unknown; galat?: boolean; tanpaAlatAmbil?: boolean };

function buka(o: Opsi = {}) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/aps_badilag/abt/main/beranda", runScripts: "outside-only" } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpan: Record<string, unknown> = {};
  if (o.saklar) simpan.tampilanServer = { kinerja: { berkasDiServer: true } };
  w.chrome = {
    runtime: { sendMessage: async () => ({}) },
    storage: {
      local: { get: async (k: string[]) => Object.fromEntries([k].flat().filter((n) => n in simpan).map((n) => [n, simpan[n]])) },
      onChanged: { addListener: () => undefined },
    },
  };
  const panggilan: Panggilan[] = [];
  const respons = (data: unknown, status = 200, tipe = "application/json") => ({
    ok: status < 400,
    status,
    headers: { get: () => tipe },
    json: async () => ({ ok: status < 400, data }),
    arrayBuffer: async () => (data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : new ArrayBuffer(0)),
  });
  const ambil = async (alamat: string, opsi: any) => {
    const metode = String((opsi && opsi.method) || "GET").toUpperCase();
    let badan: any = null;
    try {
      badan = opsi && opsi.body ? JSON.parse(opsi.body) : null;
    } catch {
      badan = null;
    }
    const p = { metode, alamat, badan };
    panggilan.push(p);
    if (o.galat) throw new Error("jaringan putus");
    const j = o.jawab ? o.jawab(p) : undefined;
    if (j !== undefined) return j as ReturnType<typeof respons>;
    return respons({});
  };
  if (!o.tanpaAlatAmbil) w.alatAmbil = ambil;
  else w.fetch = ambil;
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(BERKAS, ctx, { filename: "berkas-server.js" });
  return { w, ctx, panggilan, respons, B: w.ALETA_BERKAS_SERVER };
}

describe("berkas-server.js", () => {
  it("saklar mati (bawaan): aktif false, tidak ada permintaan, semua fungsi gagal-aman", async () => {
    const h = buka({ saklar: false });
    await h.B.tungguSiap();
    expect(h.B.aktif()).toBe(false);
    expect(await h.B.buat({ format: "rtf", nama: "x" })).toBeNull();
    expect(await h.B.daftar()).toEqual([]);
    expect(await h.B.periksaSisaRtf(new Uint8Array(400 * 1024))).toBeNull();
    expect(h.panggilan).toEqual([]);
  });

  it("alur lengkap: buat -> kirim butir (base64 benar) -> mulai -> tunggu sampai selesai -> unduh sebagai Blob", async () => {
    const hasilZip = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);
    const h = buka({
      saklar: true,
      jawab: (p) => {
        const r = (d: unknown, tipe?: string) => h.respons(d, 200, tipe);
        if (p.metode === "POST" && p.badan?.aksi === "buat") return r({ tersedia: true, id: "bk-7", batas: { butir: 60 } });
        if (p.metode === "POST" && p.badan?.aksi === "butir") return r({ jumlahButir: 1 });
        if (p.metode === "POST" && p.badan?.aksi === "mulai") return r({ id: "bk-7", status: "jalan" });
        if (p.metode === "GET" && p.alamat.includes("unduh=1")) return r(hasilZip, "application/zip");
        if (p.metode === "GET") {
          const n = h.panggilan.filter((x) => x.metode === "GET" && !x.alamat.includes("unduh=1")).length;
          return r(n < 2 ? { id: "bk-7", status: "jalan", selesaiButir: 0, jumlahButir: 1 } : { id: "bk-7", status: "selesai", selesaiButir: 1, jumlahButir: 1, hasil: { nama: "x.zip" } });
        }
        return undefined;
      },
    });
    await h.B.tungguSiap();
    const kerja = await h.B.buat({ format: "pdf", nama: "Cetak massal - Putusan" });
    expect(kerja).toMatchObject({ id: "bk-7" });
    expect(h.panggilan[0]).toMatchObject({ metode: "POST", alamat: "/aleta/api/aleta-ecourt/berkas-server", badan: { aksi: "buat", format: "pdf", nama: "Cetak massal - Putusan" } });
    expect(await h.B.kirimButir("bk-7", { nama: "a.rtf", bita: new Uint8Array(Buffer.from("{\\rtf1 isi}")) })).toBe(true);
    expect(Buffer.from(h.panggilan[1].badan.rtfBase64, "base64").toString("latin1")).toBe("{\\rtf1 isi}");
    expect(await h.B.mulai("bk-7")).toMatchObject({ status: "jalan" });
    const kabar: number[] = [];
    const akhir = await h.B.tunggu("bk-7", { jedaMs: 5, padaKabar: (s: { selesaiButir: number }) => kabar.push(s.selesaiButir) });
    expect(akhir).toMatchObject({ status: "selesai" });
    expect(kabar.length).toBeGreaterThanOrEqual(2);
    const blob = await h.B.unduh("bk-7");
    expect(blob).toBeTruthy();
    expect(blob.size).toBe(hasilZip.length);
    expect(blob.type).toBe("application/zip");
  });

  it("server menolak (tersedia:false) atau jaringan putus: buat/kirim/mulai/status/unduh mengembalikan null atau false tanpa melempar; tunggu menyerah setelah 5 kegagalan", async () => {
    const tolak = buka({ saklar: true, jawab: (p) => (p.badan?.aksi === "buat" ? tolak.respons({ tersedia: false, alasan: "saklar-mati" }) : undefined) });
    expect(await tolak.B.buat({ format: "rtf" })).toBeNull();
    const putus = buka({ saklar: true, galat: true });
    await putus.B.tungguSiap();
    expect(await putus.B.buat({ format: "rtf" })).toBeNull();
    expect(await putus.B.kirimButir("x", { nama: "a", bita: new Uint8Array(1) })).toBe(false);
    expect(await putus.B.mulai("x")).toBeNull();
    expect(await putus.B.status("x")).toBeNull();
    expect(await putus.B.unduh("x")).toBeNull();
    expect(await putus.B.daftar()).toEqual([]);
    expect(await putus.B.hapus("x")).toBe(false);
    expect(await putus.B.tunggu("x", { jedaMs: 1 })).toBeNull();
    expect(putus.panggilan.filter((p) => p.metode === "GET" && !p.alamat.includes("unduh")).length).toBe(5 + 1 + 1); // 5 tunggu + 1 status + 1 daftar
  });

  it("pemeriksa sisa hanya untuk RTF besar (>= 150 KB); jawaban tak sah atau bukan RTF -> null (pemanggil memeriksa sendiri)", async () => {
    const hasil = { temuan: [{ jenis: "kurung", label: "L", sebelum: "", cocok: "[x]", sesudah: "", paragraf: 1, halaman: 1 }], jumlahParagraf: 1, jumlahHalaman: 1, terpotong: 0 };
    const h = buka({ saklar: true, jawab: (p) => (p.alamat.endsWith("/periksa-sisa") ? h.respons({ tersedia: true, dibaca: true, hasil }) : undefined) });
    await h.B.tungguSiap();
    expect(await h.B.periksaSisaRtf(new Uint8Array(1000))).toBeNull();
    expect(h.panggilan).toEqual([]);
    expect(await h.B.periksaSisaRtf(new Uint8Array(200 * 1024))).toEqual({ dibaca: true, hasil });
    const bukanRtf = buka({ saklar: true, jawab: (p) => (p.alamat.endsWith("/periksa-sisa") ? bukanRtf.respons({ tersedia: true, dibaca: false, hasil: null }) : undefined) });
    await bukanRtf.B.tungguSiap();
    expect(await bukanRtf.B.periksaSisaRtf(new Uint8Array(200 * 1024))).toBeNull();
  });

  it("tanpa alatAmbil (halaman tanpa panel) memakai fetch biasa", async () => {
    const h = buka({ saklar: true, tanpaAlatAmbil: true, jawab: (p) => (p.badan?.aksi === "buat" ? h.respons({ tersedia: true, id: "bk-1" }) : undefined) });
    await h.B.tungguSiap();
    expect(await h.B.buat({ format: "rtf" })).toMatchObject({ id: "bk-1" });
  });
});

describe("deteksi-sisa-blangko.js memakai server untuk RTF besar", () => {
  const kotor = (tambahan = 0) =>
    Buffer.from(`{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\pard Penggugat [nama penggugat] hadir. perlu di review.\\par ${"x".repeat(tambahan)}}`, "latin1");

  function bukaDeteksi(serverJawab: unknown, aktif = true) {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/SIPP/main", runScripts: "outside-only" } as ConstructorParameters<typeof JSDOM>[1]);
    terbuka.push(dom);
    const w = dom.window as any;
    const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
    w.TextDecoder = TextDecoder;
    w.TextEncoder = TextEncoder;
    const dipanggil: number[] = [];
    if (aktif) {
      w.ALETA_BERKAS_SERVER = {
        periksaSisaRtf: async (bita: Uint8Array) => {
          dipanggil.push(bita.length);
          return serverJawab;
        },
      };
    }
    vm.runInContext(DETEKSI, ctx, { filename: "deteksi-sisa-blangko.js" });
    return { w, dipanggil, D: w.aletaDeteksiSisa };
  }

  it("server menjawab: temuan dari server dipakai (lokal tidak dijalankan)", async () => {
    const dariServer = { temuan: [{ jenis: "kurung", label: "Kurung siku yang belum diganti", sebelum: "a ", cocok: "[dari server]", sesudah: "", paragraf: 1, halaman: 1 }], jumlahParagraf: 1, jumlahHalaman: 1, terpotong: 0 };
    const h = bukaDeteksi({ dibaca: true, hasil: dariServer });
    const r = await h.D.tinjau(h.w.Uint8Array.from(kotor()), { nama: "Putusan 581.rtf", jenis: "putusan", aksi: "unduh", tanpaDialog: true });
    expect(h.dipanggil).toHaveLength(1);
    expect(r.temuan).toEqual(dariServer.temuan);
  });

  it("server tidak ada / menolak (null): pemeriksa lokal seperti dulu", async () => {
    const lokal = bukaDeteksi(null, false);
    const dasar = await lokal.D.tinjau(lokal.w.Uint8Array.from(kotor()), { nama: "Putusan 581.rtf", jenis: "putusan", aksi: "unduh", tanpaDialog: true });
    expect(dasar.temuan.length).toBeGreaterThanOrEqual(2);
    const server = bukaDeteksi(null, true);
    const r = await server.D.tinjau(server.w.Uint8Array.from(kotor()), { nama: "Putusan 582.rtf", jenis: "putusan", aksi: "unduh", tanpaDialog: true });
    expect(server.dipanggil).toHaveLength(1);
    expect(r.temuan.map((t: { jenis: string; cocok: string }) => [t.jenis, t.cocok])).toEqual(dasar.temuan.map((t: { jenis: string; cocok: string }) => [t.jenis, t.cocok]));
  });

  it("server yang melempar tidak menahan unggah/unduh: jatuh ke pemeriksa lokal", async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/SIPP/main", runScripts: "outside-only" } as ConstructorParameters<typeof JSDOM>[1]);
    terbuka.push(dom);
    const w = dom.window as any;
    w.TextDecoder = TextDecoder;
    w.ALETA_BERKAS_SERVER = { periksaSisaRtf: async () => Promise.reject(new Error("putus")) };
    vm.runInContext(DETEKSI, (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext(), { filename: "deteksi-sisa-blangko.js" });
    const r = await w.aletaDeteksiSisa.tinjau(w.Uint8Array.from(kotor()), { nama: "P.rtf", jenis: "putusan", aksi: "unduh", tanpaDialog: true });
    expect(r.periksa).toBe(true);
    expect(r.temuan.length).toBeGreaterThanOrEqual(2);
  });

  it("naskah DOCX tidak dikirim ke server (hanya RTF)", async () => {
    const h = bukaDeteksi({ dibaca: true, hasil: { temuan: [], jumlahParagraf: 0, jumlahHalaman: 0, terpotong: 0 } });
    await h.D.tinjau(h.w.Uint8Array.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0]), { nama: "P.docx", jenis: "putusan", aksi: "unduh", tanpaDialog: true });
    expect(h.dipanggil).toEqual([]);
  });
});

describe("terpasang di manifest", () => {
  const manifest = JSON.parse(baca("manifest.json"));
  it("berkas-server.js dimuat di blok SIPP dan ABT sesudah antrean-server.js dan sebelum deteksi-sisa-blangko.js", () => {
    const kelompok = manifest.content_scripts.filter((c: any) => c.js.includes("berkas-server.js"));
    expect(kelompok).toHaveLength(2);
    for (const k of kelompok) {
      const i = k.js.indexOf("berkas-server.js");
      expect(k.js[i - 1]).toBe("antrean-server.js");
      expect(i).toBeLessThan(k.js.indexOf("deteksi-sisa-blangko.js"));
    }
    expect(tunggu).toBeTruthy();
  });
});
