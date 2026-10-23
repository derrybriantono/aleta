// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { EKSTENSI_BERKAS } from "@/server/shared/ekstensi-berkas";

/**
 * ============================================================================
 * ALETA Ai TAHAP 2b (23 Okt 2026): GELEMBUNG CHAT DI EKSTENSI
 * ============================================================================
 *
 * aleta-ai-gelembung.js dijalankan SUNGGUHAN di jsdom atas halaman SIPP/ABT/
 * portal rekaan, dengan chrome.storage dan fetch tiruan. Yang dijaga:
 *   - tampil hanya bila saklar menyala DAN server menyatakan ALETA Ai aktif
 *     untuk akun yang masuk; saklar dimatikan = gelembung hilang seketika;
 *   - semua permintaan ke rute portal SEASAL /aleta/api/aleta-ai (sesi ALETA,
 *     credentials include); tidak ada kunci API dan tidak ada alamat layanan AI;
 *   - perkara halaman menjadi konteks percakapan; dapat dilepas;
 *   - jawaban SSE dirangkai dan ditampilkan sebagai TEKS (bukan HTML);
 *   - tidak ada yang ditulis ke formulir SIPP; jawaban hanya disalin dengan tombol;
 *   - tema gelap/terang mengikuti pusat tema; layar portal ALETA Ai tanpa gelembung.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const SKRIP = baca("aleta-ai-gelembung.js");
const ASAL = "http://192.168.10.10";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 3000): Promise<NonNullable<T>> {
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
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  url?: string;
  aktifServer?: boolean;
  statusRingkas?: number;
  simpanan?: Record<string, unknown>;
  sse?: string;
  tema?: string;
  /** e-Court: permintaan lewat port ke relai pekerja latar (dijalankan sungguhan di sisi node). */
  relai?: { connect: (info: { name: string }) => unknown };
};

const sseDari = (peristiwa: unknown[]) => peristiwa.map((p) => `data: ${JSON.stringify(p)}\n\n`).join("");

function buka(o: Opsi = {}) {
  const dom = new JSDOM(
    `<!doctype html><html${o.tema ? ` data-aleta-tema="${o.tema}"` : ""}><head><title>SIPP</title></head><body>` +
      `<form id="frm"><table><tr><td>Nomor Perkara</td><td>${NOMOR}</td></tr></table><input name="catatan" value=""><button type="submit">Simpan</button></form>` +
      `</body></html>`,
    { url: o.url ?? `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ...(o.simpanan ?? {}) };
  const pendengar: Array<(ubah: Record<string, unknown>, tempat: string) => void> = [];
  w.chrome = {
    runtime: { id: "uji", ...(o.relai ? { connect: o.relai.connect } : {}) },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          Object.assign(simpanan, JSON.parse(JSON.stringify(isi)));
          for (const f of pendengar) f(Object.fromEntries(Object.keys(isi).map((x) => [x, { newValue: isi[x] }])), "local");
        },
      },
      onChanged: { addListener: (f: (ubah: Record<string, unknown>, tempat: string) => void) => void pendengar.push(f) },
    },
  };
  const panggilan: Array<{ alamat: string; metode: string; badan: any; opsi: any }> = [];
  let nomorPercakapan = 0;
  w.fetch = async (alamat: string, opsi: any = {}) => {
    const metode = String(opsi.method || "GET").toUpperCase();
    panggilan.push({ alamat, metode, badan: opsi.body ? JSON.parse(opsi.body) : null, opsi });
    const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => (status < 400 ? { ok: true, data } : { ok: false, error: { message: "Masuk dulu." } }), text: async () => "" });
    if (alamat === "/aleta/api/aleta-ai/ringkas") return o.statusRingkas ? json(null, o.statusRingkas) : json({ aktif: o.aktifServer !== false, saldoRp: 50000 });
    if (alamat === "/aleta/api/aleta-ai/percakapan" && metode === "POST") return json({ id: `aic-${++nomorPercakapan}` });
    if (/^\/aleta\/api\/aleta-ai\/percakapan\/[^/]+\/pesan$/.test(alamat))
      return { ok: true, status: 200, json: async () => ({}), text: async () => o.sse ?? sseDari([{ jenis: "selesai", pesanId: "p", mode: "Cepat", biayaRp: 0, saldoRp: 0 }]) };
    return json(null, 404);
  };
  if (o.relai) {
    // e-Court beda asal: fetch halaman tidak boleh dipakai sama sekali.
    w.fetch = async () => {
      throw new Error("fetch langsung dipakai di e-Court");
    };
  }
  w.navigator.clipboard = { tersalin: "", writeText: async (t: string) => void (w.navigator.clipboard.tersalin = t) };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SKRIP, ctx, { filename: "aleta-ai-gelembung.js" });
  const tuan = () => w.document.getElementById("aleta-ai-gelembung") as HTMLElement | null;
  const bayang = () => tuan()?.shadowRoot as ShadowRoot;
  return { dom, w, panggilan, simpanan, tuan, bayang };
}

describe("gelembung chat ALETA Ai - tampil menurut saklar dan server", () => {
  it("tampil di halaman perkara SIPP bila saklar bawaan menyala dan server aktif; di Shadow DOM, kiri bawah", async () => {
    const h = buka();
    const t = await sampai(() => h.tuan(), "gelembung terpasang");
    expect(t.shadowRoot!.querySelector("button.gelembung")?.getAttribute("aria-label")).toBe("Tanya ALETA Ai");
    expect(t.shadowRoot!.querySelector(".panel")!.hasAttribute("hidden")).toBe(true);
    expect(t.shadowRoot!.querySelector("style")!.textContent).toMatch(/:host \{ all: initial; position: fixed; left: 16px; bottom: 16px/);
    expect(h.panggilan.map((p) => p.alamat)).toEqual(["/aleta/api/aleta-ai/ringkas"]);
    expect(h.panggilan[0]!.opsi.credentials).toBe("include");
  });

  it("tidak tampil bila server menyatakan belum aktif, belum masuk (401), saklar mati, saklar induk mati, atau di layar portal ALETA Ai", async () => {
    for (const o of [{ aktifServer: false }, { statusRingkas: 401 }, { simpanan: { aletaAiGelembung: false } }, { simpanan: { aktif: false } }, { url: `${ASAL}/aleta/aleta-ai` }] as Opsi[]) {
      const h = buka(o);
      await tunggu(40);
      expect(h.tuan(), JSON.stringify(o)).toBeNull();
    }
  });

  it("saklar dimatikan dari popup: gelembung hilang seketika; dinyalakan lagi: kembali", async () => {
    const h = buka();
    await sampai(() => h.tuan(), "terpasang");
    await h.w.chrome.storage.local.set({ aletaAiGelembung: false });
    await sampai(() => h.tuan() === null, "hilang");
    await h.w.chrome.storage.local.set({ aletaAiGelembung: true });
    await sampai(() => h.tuan(), "kembali");
  });

  it("tema mengikuti pusat tema (data-aleta-tema) dan berubah seketika", async () => {
    const h = buka({ tema: "gelap" });
    const t = await sampai(() => h.tuan(), "terpasang");
    expect(t.getAttribute("data-tema")).toBe("gelap");
    h.w.document.documentElement.setAttribute("data-aleta-tema", "terang");
    await sampai(() => t.getAttribute("data-tema") === "terang", "tema terang");
  });
});

describe("gelembung chat ALETA Ai - percakapan lewat rute portal", () => {
  const kirimPertanyaan = async (h: ReturnType<typeof buka>, teks: string) => {
    const b = h.bayang();
    const masukan = b.querySelector("textarea") as HTMLTextAreaElement;
    masukan.value = teks;
    (b.querySelector("button.kirim") as HTMLButtonElement).click();
  };

  it("perkara halaman menjadi konteks; jawaban SSE dirangkai sebagai TEKS; percakapan per perkara diingat", async () => {
    const sse = sseDari([
      { jenis: "perkiraan", mode: "Cepat", label: "Cepat", perkiraanRp: 1000 },
      { jenis: "alat", nama: "data_perkara", label: "data perkara" },
      { jenis: "teks", delta: "Sidang berikut 26 Okt. " },
      { jenis: "teks", delta: '<img src=x onerror="alert(1)">' },
      { jenis: "selesai", pesanId: "aip-1", mode: "Cepat", label: "Cepat", biayaRp: 1500, saldoRp: 48500 },
    ]);
    const h = buka({ sse });
    await sampai(() => h.tuan(), "terpasang");
    const b = h.bayang();
    (b.querySelector("button.gelembung") as HTMLButtonElement).click();
    expect(b.querySelector(".panel")!.hasAttribute("hidden")).toBe(false);
    expect(b.querySelector(".konteks span")!.textContent).toBe(`Tanya tentang ${NOMOR}?`);

    await kirimPertanyaan(h, "Kapan sidang berikutnya?");
    const ai = await sampai(() => (b.querySelector(".status")!.textContent!.startsWith("Selesai") ? b.querySelectorAll(".pesan.ai .teks") : null), "jawaban selesai");
    expect(ai[0]!.textContent).toBe('Sidang berikut 26 Okt. <img src=x onerror="alert(1)">');
    expect(b.querySelector(".pesan.ai img")).toBeNull();
    expect(b.querySelector(".status")!.textContent).toBe("Selesai. Biaya Rp1.500.");
    expect(b.querySelector(".pesan.pengguna")!.textContent).toBe("Kapan sidang berikutnya?");

    // Permintaan: buat percakapan berkonteks perkara, lalu pesan - semuanya rute portal seasal.
    expect(h.panggilan.slice(1).map((p) => [p.metode, p.alamat, p.badan])).toEqual([
      ["POST", "/aleta/api/aleta-ai/percakapan", { perkara: NOMOR }],
      ["POST", "/aleta/api/aleta-ai/percakapan/aic-1/pesan", { teks: "Kapan sidang berikutnya?" }],
    ]);
    for (const p of h.panggilan) {
      expect(p.alamat.startsWith("/aleta/api/aleta-ai/")).toBe(true);
      expect(p.opsi.credentials).toBe("include");
      expect(JSON.stringify(p.opsi.headers ?? {})).not.toMatch(/x-api-key|authorization|anthropic/i);
    }
    expect(h.simpanan.aletaAiGelembungPercakapan).toEqual({ [NOMOR]: "aic-1" });

    // Pertanyaan kedua pada perkara yang sama memakai percakapan yang sama.
    await kirimPertanyaan(h, "Siapa majelisnya?");
    await sampai(() => h.panggilan.length === 4, "pesan kedua");
    expect(h.panggilan[3]!.alamat).toBe("/aleta/api/aleta-ai/percakapan/aic-1/pesan");

    // Formulir SIPP tidak disentuh.
    expect((h.w.document.querySelector("input[name=catatan]") as HTMLInputElement).value).toBe("");
    // Salin hanya dengan tombol.
    (b.querySelector(".pesan.ai .salin") as HTMLButtonElement).click();
    await sampai(() => h.w.navigator.clipboard.tersalin, "tersalin");
    expect(h.w.navigator.clipboard.tersalin).toBe('Sidang berikut 26 Okt. <img src=x onerror="alert(1)">');
  });

  it("konteks dilepas: percakapan umum terpisah (tanpa perkara)", async () => {
    const h = buka();
    await sampai(() => h.tuan(), "terpasang");
    const b = h.bayang();
    (b.querySelector("button.gelembung") as HTMLButtonElement).click();
    (b.querySelector(".konteks button") as HTMLButtonElement).click();
    expect(b.querySelector(".konteks span")!.textContent).toBe("Pertanyaan umum (tanpa perkara).");
    await kirimPertanyaan(h, "Apa itu PMH?");
    await sampai(() => h.panggilan.length >= 3, "terkirim");
    expect(h.panggilan[1]).toMatchObject({ alamat: "/aleta/api/aleta-ai/percakapan", badan: { perkara: "" } });
    expect(h.simpanan.aletaAiGelembungPercakapan).toEqual({ umum: "aic-1" });
  });

  it("penolakan server (mis. hak peran) tampil sebagai pesan galat, tanpa gelembung jawaban kosong", async () => {
    const h = buka({ sse: sseDari([{ jenis: "gagal", pesan: 'Maaf, fitur "Draf putusan / pertimbangan / amar" di ALETA Ai hanya untuk Admin, Ketua / Wakil Ketua, Hakim.' }]) });
    await sampai(() => h.tuan(), "terpasang");
    const b = h.bayang();
    (b.querySelector("button.gelembung") as HTMLButtonElement).click();
    await kirimPertanyaan(h, "Buatkan putusan lengkap");
    const s = await sampai(() => (b.querySelector(".status.galat") ? b.querySelector(".status") : null), "galat tampil");
    expect(s.textContent).toMatch(/hanya untuk Admin, Ketua/);
    expect(b.querySelectorAll(".pesan.ai")).toHaveLength(0);
  });

  it("di ABT tanpa nomor perkara: tanpa baris konteks", async () => {
    const h = buka({ url: `${ASAL}/aps_badilag/beranda` });
    await sampai(() => h.tuan(), "terpasang");
    const b = h.bayang();
    (b.querySelector("button.gelembung") as HTMLButtonElement).click();
    expect((b.querySelector(".konteks") as HTMLElement).hidden).toBe(true);
  });
});

describe("pemasangan: manifest, popup, dan tanam ke portal", () => {
  it("dimuat di SIPP, ABT, portal, dan e-Court (lewat relai); saklar popup ada di kelompok Tampilan; berkas tertanam sama persis", () => {
    const m = JSON.parse(baca("manifest.json")) as { content_scripts: Array<{ matches: string[]; js?: string[] }> };
    const memuat = m.content_scripts.filter((c) => c.js?.includes("aleta-ai-gelembung.js")).flatMap((c) => c.matches);
    expect(memuat).toEqual(expect.arrayContaining(["http://192.168.10.10/SIPP/*", "http://192.168.10.10/aps_badilag/*", "http://192.168.10.10/aleta/*"]));
    expect(memuat).toContain("https://ecourt.mahkamahagung.go.id/*");
    expect(baca("latar.js")).toMatch(/importScripts\("aleta-ai-relai\.js"\)/);
    expect(EKSTENSI_BERKAS["aleta-ai-relai.js"]?.replace(/\r\n/g, "\n")).toBe(baca("aleta-ai-relai.js"));
    const html = new JSDOM(baca("popup.html")).window.document;
    expect((html.getElementById("aletaAiGelembung") as HTMLInputElement).checked).toBe(true);
    const popup = baca("popup.js");
    expect(popup).toMatch(/aletaAiGelembung: \["aletaAiGelembung", true\]/);
    expect(popup).toMatch(/kode: "tampilan", judul: "Tampilan", isi: \["panelRingkas", "aletaAiGelembung"\]/);
    expect(EKSTENSI_BERKAS["aleta-ai-gelembung.js"]?.replace(/\r\n/g, "\n")).toBe(SKRIP);
  });
});

// ─── e-Court lewat relai pekerja latar (keputusan pengguna 23 Okt) ───────────

type Relai = {
  NAMA_PORT: string;
  izinRelai: (m: unknown) => { metode: string; jalur: string; aliran: boolean } | null;
  pasangRelaiAletaAi: (chromeApi: unknown, ambil: (u: string, o: any) => Promise<any>, asal: () => Promise<string>) => void;
};

function muatRelai(): Relai {
  const konteks: Record<string, unknown> = { AbortController, TextDecoder, JSON, Promise, String, Number };
  konteks.self = konteks;
  vm.runInNewContext(baca("aleta-ai-relai.js"), konteks, { filename: "aleta-ai-relai.js" });
  return konteks.AletaAiRelai as Relai;
}

/** Sepasang port tiruan: sisi halaman <-> sisi pekerja latar. */
function pasanganPort(nama: string, sender: Record<string, unknown>) {
  const buat = () => ({ pesan: [] as Array<(m: any) => void>, putus: [] as Array<() => void> });
  const a = buat();
  const b = buat();
  let tertutup = false;
  const tutup = () => {
    if (tertutup) return;
    tertutup = true;
    setTimeout(() => [...a.putus, ...b.putus].forEach((f) => f()));
  };
  const sisi = (milik: ReturnType<typeof buat>, lawan: ReturnType<typeof buat>, extra: Record<string, unknown> = {}) => ({
    name: nama,
    ...extra,
    postMessage: (m: unknown) => {
      if (tertutup) return;
      const salinan = JSON.parse(JSON.stringify(m));
      setTimeout(() => lawan.pesan.forEach((f) => f(salinan)));
    },
    disconnect: tutup,
    onMessage: { addListener: (f: (m: any) => void) => void milik.pesan.push(f) },
    onDisconnect: { addListener: (f: () => void) => void milik.putus.push(f) },
  });
  return { halaman: sisi(a, b), latar: sisi(b, a, { sender }) };
}

describe("gelembung di e-Court lewat relai pekerja latar", () => {
  it("izin relai: hanya ringkas, buat percakapan, dan kirim pesan ALETA Ai; selain itu ditolak", () => {
    const r = muatRelai();
    expect(r.izinRelai({ jalur: "/api/aleta-ai/ringkas" })).toMatchObject({ metode: "GET", aliran: false });
    expect(r.izinRelai({ jalur: "/api/aleta-ai/percakapan", metode: "POST", badan: { perkara: "" } })).toMatchObject({ aliran: false });
    expect(r.izinRelai({ jalur: "/api/aleta-ai/percakapan/aic-1/pesan", metode: "post", badan: { teks: "x" } })).toMatchObject({ aliran: true });
    for (const m of [
      { jalur: "/api/aleta-ai/pengaturan", metode: "PUT" },
      { jalur: "/api/aleta-ai/kemampuan", metode: "PUT" },
      { jalur: "/api/aleta-ecourt/sidang" },
      { jalur: "/api/aleta-ai/percakapan/../../x/pesan", metode: "POST" },
      { jalur: "http://lain.test/api/aleta-ai/ringkas" },
      { jalur: "/api/aleta-ai/percakapan/aic-1/pesan", metode: "POST", badan: { teks: "x".repeat(80_000) } },
    ])
      expect(r.izinRelai(m), JSON.stringify(m).slice(0, 80)).toBeNull();
  });

  it("ujung ke ujung: halaman e-Court -> port -> pekerja latar -> portal ALETA (sesi), jawaban SSE mengalir kembali", async () => {
    const relai = muatRelai();
    const pendengar: Array<(p: unknown) => void> = [];
    const chromeLatar = { runtime: { id: "uji", onConnect: { addListener: (f: (p: unknown) => void) => void pendengar.push(f) } } };
    const ambilan: Array<{ alamat: string; opsi: any }> = [];
    const enc = new TextEncoder();
    const portal = async (alamat: string, opsi: any) => {
      ambilan.push({ alamat, opsi });
      const json = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ ok: true, data }) });
      if (alamat.endsWith("/api/aleta-ai/ringkas")) return json({ aktif: true });
      if (alamat.endsWith("/api/aleta-ai/percakapan")) return json({ id: "aic-ec" });
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(enc.encode(sseDari([{ jenis: "teks", delta: "Perkara ini " }]).slice(0, 25)));
          c.enqueue(enc.encode(sseDari([{ jenis: "teks", delta: "Perkara ini " }]).slice(25)));
          c.enqueue(enc.encode(sseDari([{ jenis: "teks", delta: "masih tahap jawaban." }, { jenis: "selesai", pesanId: "p", mode: "Cepat", biayaRp: 1000, saldoRp: 1 }])));
          c.close();
        },
      });
      return { ok: true, status: 200, body };
    };
    relai.pasangRelaiAletaAi(chromeLatar, portal, async () => "http://192.168.10.10/aleta");
    const h = buka({
      url: "https://ecourt.mahkamahagung.go.id/perkara/detail?nomor=1",
      simpanan: { asalPortal: "http://192.168.10.10/aleta" },
      relai: {
        connect: (info) => {
          const pasangan = pasanganPort(info.name, { id: "uji", url: "https://ecourt.mahkamahagung.go.id/perkara/detail?nomor=1" });
          pendengar.forEach((f) => f(pasangan.latar));
          return pasangan.halaman;
        },
      },
    });
    const t = await sampai(() => h.tuan(), "gelembung di e-Court");
    const b = t.shadowRoot!;
    expect((b.querySelector(".kaki a") as HTMLAnchorElement).getAttribute("href")).toBe("http://192.168.10.10/aleta/aleta-ai");
    (b.querySelector("button.gelembung") as HTMLButtonElement).click();
    expect(b.querySelector(".konteks span")!.textContent).toBe(`Tanya tentang ${NOMOR}?`);
    (b.querySelector("textarea") as HTMLTextAreaElement).value = "Ringkas posisi perkara ini";
    (b.querySelector("button.kirim") as HTMLButtonElement).click();
    await sampai(() => b.querySelector(".status")!.textContent!.startsWith("Selesai"), "jawaban selesai");
    expect(b.querySelector(".pesan.ai .teks")!.textContent).toBe("Perkara ini masih tahap jawaban.");
    expect(ambilan.map((x) => [x.opsi.method, x.alamat, x.opsi.credentials])).toEqual([
      ["GET", "http://192.168.10.10/aleta/api/aleta-ai/ringkas", "include"],
      ["POST", "http://192.168.10.10/aleta/api/aleta-ai/percakapan", "include"],
      ["POST", "http://192.168.10.10/aleta/api/aleta-ai/percakapan/aic-ec/pesan", "include"],
    ]);
    expect(JSON.parse(ambilan[1]!.opsi.body)).toEqual({ perkara: NOMOR });
    for (const x of ambilan) expect(JSON.stringify(x.opsi.headers ?? {})).not.toMatch(/x-api-key|authorization|anthropic/i);
  });

  it("port dari ekstensi lain diputus; alamat portal belum diketahui -> pesan jelas, gelembung tidak tampil", async () => {
    const relai = muatRelai();
    const pendengar: Array<(p: any) => void> = [];
    relai.pasangRelaiAletaAi({ runtime: { id: "uji", onConnect: { addListener: (f: (p: unknown) => void) => void pendengar.push(f) } } }, async () => {
      throw new Error("tidak boleh dipanggil");
    }, async () => "");
    const asing = pasanganPort("aleta-ai-relai", { id: "ekstensi-lain" });
    let diputus = false;
    asing.halaman.onDisconnect.addListener(() => void (diputus = true));
    pendengar.forEach((f) => f(asing.latar));
    await sampai(() => diputus, "port asing diputus");

    const h = buka({
      url: "https://ecourt.mahkamahagung.go.id/beranda",
      relai: {
        connect: (info) => {
          const p = pasanganPort(info.name, { id: "uji" });
          pendengar.forEach((f) => f(p.latar));
          return p.halaman;
        },
      },
    });
    await tunggu(80);
    expect(h.tuan()).toBeNull();
  });
});
