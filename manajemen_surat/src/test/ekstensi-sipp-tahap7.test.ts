// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TAHAP 7 RENCANA "EKSTENSI DULU" - PANEL SIPP BARU / UI BARU, MODE LATIHAN
 * ============================================================================
 *
 * Yang dijalankan kode SUNGGUHAN: panel-alat.js dan konten.js UTUH, di jendela
 * jsdom beralamat halaman detail perkara SIPP - satu konteks vm per halaman,
 * seperti skrip konten yang berbagi satu lingkup. Portal dan jembatan.js
 * ditiru di tepi luarnya: fetch tiruan mencatat tiap permintaan beserta
 * caranya, postMessage tiruan mencatat tiap pesan ke jembatan dan
 * menjawabnya.
 *
 * Yang dijaga, menurut pentingnya:
 *   1. MODE LATIHAN - mati: tidak ada yang berubah. Menyala: tidak satu pun
 *      "tekan"/"isi" sampai ke jembatan, tidak satu pun fetch non-GET keluar
 *      (termasuk yang berangkat sebelum saklarnya terbaca), tanda LATIHAN
 *      tampil, dan yang AKAN ditulis tercatat. Saklarnya di popup hanya bagi
 *      Super Admin dan Admin.
 *   2. Tampilan Lama IDENTIK dengan commit fd9aad7 (panel-alat.js dan
 *      konten.js sebelum Tahap 7): DOM panel, permintaan, tulisan
 *      penyimpanan, dan URUTAN pesan jembatan - walau seluruh saklar sipp-N,
 *      tab, dan lebar labuh tersimpan.
 *   3. Ide sipp-N hanya bila saklarnya menyala; perbaikan D1-D15 hanya UI Baru.
 *   4. Zona berbahaya menuntut nomor perkara diketik; templat DRAF tidak dapat
 *      disisipkan; ambang pengingat tenggat = ambang Penilaian SK.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const REPO = path.resolve(process.cwd(), "..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const lama = (b: string) =>
  execFileSync("git", ["show", `fd9aad7:ekstensi-sipp/${b}`], { cwd: AKAR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(
    /\r\n/g,
    "\n"
  );
const SUMBER = { alat: baca("panel-alat.js"), konten: baca("konten.js") };
// Istilah tampilan "galat" -> "error" (permintaan pengguna 30 Sep 2026, berlaku di SEMUA tampilan
// termasuk Lama) diterapkan juga ke sumber pembanding, supaya "Lama identik" tetap menjaga
// segala hal lain. Penggantian menyeluruh aman: nama peubah yang ikut berganti berganti
// serentak di kedua berkas pembanding.
const tanpaGalat = (s: string) => s.replace(/galat/g, "error").replace(/Galat/g, "Error");
const SUMBER_LAMA = { alat: tanpaGalat(lama("panel-alat.js")), konten: tanpaGalat(lama("konten.js")) };
const GAYA = baca("panel.css");
const POPUP_HTML = baca("popup.html");
const POPUP_JS = baca("popup.js");
const DAFTAR_FITUR = baca("daftar-fitur.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "450/Pdt.G/2026/PA.Dgl";
const TULIS = `${ASAL}/aleta/api/aleta-bot/penunjukan/tulis`;
const PRAPERIKSA = `${ASAL}/aleta/api/aleta-ecourt/putusan/praperiksa`;
const SETELAN = `${ASAL}/aleta/api/aleta-ecourt/ekstensi/setelan`;
const MASUKAN = `${ASAL}/aleta/api/feedback`;
const SEMUA_SIPP = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`sipp-${i + 1}`, true]));

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 4000): Promise<NonNullable<T>> {
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

// ----------------------------------------------------------------------------
// Jawaban portal tiruan
// ----------------------------------------------------------------------------
function konteksContoh() {
  return {
    ok: true,
    nomorPerkara: NOMOR,
    nomorRegister: "PA.DGL-2026-0450",
    identitas: {
      ditemukan: true,
      jenisPerkara: "Cerai Gugat",
      jenisPerkaraLengkap: "Cerai Gugat",
      adaKumulasi: false,
      kumulasi: [],
      adaKuasa: false,
    },
    ringkasan: { dokumen: 1 },
    dokumen: [
      {
        judulDokumen: "Jawaban",
        agenda: "Jawaban",
        sisaHari: 2,
        batasUnggahTeks: "Batas unggah 2 hari lagi",
        statusVerifikasi: "menunggu",
        adaPdf: true,
        adaWord: false,
        documentKey: "k1",
      },
    ],
    selisih: [],
    nomorPihak: [],
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: 3,
    hakim: null,
  };
}

function statusContoh() {
  return {
    tahapan: {
      terbaca: true,
      tahap: [
        { kunci: "daftar", label: "Pendaftaran", terbaca: true, tanggal: "2026-09-01", hariSampaiInput: 0 },
        { kunci: "pmh", label: "Penetapan Majelis", terbaca: true, tanggal: "" },
      ],
    },
    relaas: [],
    jadwal: [],
    petitum: { ada: true },
    putusan: { sudahPutus: true, tanggalPutusan: "2026-09-27", tanggalMinutasi: "", tanggalBht: "" },
    putusanLengkap: { tanggalPutusan: "2026-09-27" },
    upayaHukum: [],
    putusanEcourt: null,
    penilaianSk: {
      rinci: [
        { kunci: "waktuMinutasi", label: "Waktu minutasi berkas perkara", terbaca: true, poin: 0, poinMaksimal: 5, poinMinimal: 0, catatan: "Berkas belum diminutasi." },
        { kunci: "waktuPublikasi", label: "Waktu publikasi putusan", terbaca: true, poin: 0, poinMaksimal: 5, poinMinimal: 0, catatan: "Putusan belum diunggah." },
        { kunci: "lengkap", label: "Kelengkapan data", terbaca: true, poin: 5, poinMaksimal: 5, poinMinimal: 0, catatan: "" },
      ],
    },
  };
}

type Hasil = { status?: number; isi?: unknown };
function jawabBaku(url: string, cara: string): Hasil {
  if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) return { status: 404, isi: {} };
  if (url.includes("/aleta-bot/sipp-konteks?")) {
    return {
      isi: {
        ok: true,
        data: {
          available: true,
          konteks: konteksContoh(),
          pengguna: { nama: "Derry", peran: "Super Admin" },
          kapabilitas: null,
        },
      },
    };
  }
  if (url.includes("/aleta-ecourt/status-perkara?")) return { isi: { ok: true, data: { available: true, status: statusContoh() } } };
  if (url.includes("/aleta-ecourt/templat-hukum")) {
    return {
      isi: {
        ok: true,
        data: {
          butir: [
            { id: "t1", jenis: "pertimbangan", kunci: "verstek", judul: "Verstek", isi: "<p>Menimbang tergugat tidak hadir</p>", disahkan: true },
            { id: "t2", jenis: "pertimbangan", kunci: "gugur", judul: "Gugur", isi: "<p>Menimbang penggugat tidak hadir</p>", disahkan: false },
          ],
        },
      },
    };
  }
  if (url.includes("/aleta-ecourt/bas-komentar")) return { status: 404, isi: {} };
  if (cara !== "GET") return { isi: { ok: true, data: {} } };
  return { isi: { ok: true, data: {} } };
}

// ----------------------------------------------------------------------------
// Halaman SIPP tiruan
// ----------------------------------------------------------------------------
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };

type Halaman = {
  dom: JsdomUji;
  w: any;
  d: Document;
  simpanan: Record<string, unknown>;
  tulisan: string[];
  minta: Array<{ url: string; cara: string; badan: string }>;
  jembatan: Array<Record<string, unknown>>;
  setel: (isi: Record<string, unknown>) => Promise<void>;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { sumber?: { alat: string; konten: string }; simpanan?: Record<string, unknown>; jawab?: typeof jawabBaku; html?: string } = {}): Halaman {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3>${p.html || ""}</div></body></html>`,
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  ) as JsdomUji;
  terbuka.push(dom);
  const w = dom.window as any;
  // jsdom tidak mengenal innerText - teks badan dibaca konten.js lewat itu.
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const tulisan: string[] = [];
  const pendengar: Array<(u: Ubah, wilayah: string) => void> = [];
  const siarkan = (ubah: Ubah) => {
    if (!Object.keys(ubah).length) return;
    setTimeout(() => {
      for (const f of [...pendengar]) f(polos(ubah), "local");
    }, 0);
  };
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      const ubah: Ubah = {};
      for (const [k, v] of Object.entries(isi)) {
        tulisan.push(k);
        ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      siarkan(ubah);
    },
    remove: async (kunci: string | string[]) => {
      const ubah: Ubah = {};
      for (const k of [kunci].flat()) {
        tulisan.push(`-${k}`);
        ubah[k] = { oldValue: simpanan[k] };
        delete simpanan[k];
      }
      siarkan(ubah);
    },
  };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.173.1" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async () => ({}),
    },
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, w: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Halaman["minta"] = [];
  const jawab = p.jawab ?? jawabBaku;
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    minta.push({ url, cara, badan: typeof opsi?.body === "string" ? opsi.body : "" });
    const h = jawab(url, cara);
    const status = h.status ?? 200;
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      headers: { get: () => "application/json" },
      json: async () => polos(h.isi),
      text: async () => JSON.stringify(h.isi ?? {}),
      clone: () => r,
    };
    return r;
  };
  // jembatan.js tiruan: tiap pesan dicatat (tanpa nomor urutnya) dan dijawab.
  const jembatan: Array<Record<string, unknown>> = [];
  const pmAsli = w.postMessage.bind(w);
  w.postMessage = (data: any, asal: string) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id, ...isi } = data;
      jembatan.push(polos(isi));
      const balas =
        isi.jenis === "baca"
          ? { ok: true, medan: [] }
          : isi.jenis === "nilai"
            ? { ok: true, nilai: "lama", tampak: true }
            : isi.jenis === "pilihan"
              ? { ok: true, pilihan: [], nilaiSekarang: "" }
              : { ok: true };
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ...balas }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  // Response milik Node - jsdom tidak menyediakannya, dan jawaban tiruan
  // mode kering/coba/latihan dibentuk dengannya.
  w.Response = globalThis.Response;
  const ctx = dom.getInternalVMContext();
  const sumber = p.sumber ?? SUMBER;
  vm.runInContext(sumber.alat, ctx, { filename: "panel-alat.js" });
  vm.runInContext(sumber.konten, ctx, { filename: "konten.js" });
  return { dom, w, d: w.document, simpanan, tulisan, minta, jembatan, setel: (isi) => local.set(isi) };
}

const panelDari = (h: Halaman) => h.d.getElementById("aleta-panel-sipp") as any;
const siapPanel = (h: Halaman) => sampai(() => panelDari(h) && panelDari(h).querySelector(".aleta-kelompok"), "panel perkara tergambar");
/**
 * Panel yang sudah DITATA untuk tampilan itu. Panel pertama dapat lahir
 * sebelum pilihan tampilan terbaca dari penyimpanan; peristiwa
 * aleta-uji-berubah lalu menggambarnya ulang (t7UjiBerubah) - yang dipegang
 * uji harus panel yang kedua.
 */
const siapT7 = (h: Halaman, nilai: string) =>
  sampai(() => {
    const p = panelDari(h);
    return p && p.getAttribute("data-t7") === nilai && p.querySelector(".aleta-kelompok") ? p : null;
  }, `panel ${nilai} tergambar`);

/** Isi panel untuk dibandingkan - jam "diperiksa" tidak berubah dalam satu uji. */
const htmlPanel = (h: Halaman) => String(panelDari(h)?.outerHTML ?? "");
const atributAkar = (h: Halaman) =>
  Object.fromEntries(Array.from(h.d.documentElement.attributes).map((a: any) => [a.name, a.value]));

/** Satu rangkaian tindakan yang sama di dua halaman: buka semua menu, lalu jembatan. */
async function jalani(h: Halaman) {
  const panel = await siapPanel(h);
  // Lencana menu menyusul 900 ms kemudian (satu panggilan status).
  await tunggu(1050);
  for (const k of ["berkas", "perkara", "putusanKel"]) {
    const kel = panel.querySelector(`.aleta-kelompok[data-kunci="${k}"]`);
    const isi = kel?.querySelector(".aleta-kelompok-isi");
    if (kel && isi && isi.style.display === "none") kel.querySelector(".aleta-kelompok-judul").click();
  }
  for (const k of ["tahapan", "penilaianSk", "putusan", "putusanEcourt", "berkasSipp"]) {
    const b = panel.querySelector(`.aleta-bagian[data-kunci="${k}"]`);
    const isi = b?.querySelector(".aleta-bagian-isi");
    if (b && isi && isi.style.display === "none") b.querySelector(".aleta-bagian-judul").click();
  }
  await tunggu(150);
  const jawab: unknown[] = [];
  jawab.push(await h.w.kirimKeJembatan({ jenis: "baca" }));
  jawab.push(await h.w.kirimKeJembatan({ jenis: "nilai", penunjuk: "#tgl_putusan" }));
  jawab.push(await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: 'input[name="majelis"]', jenisMedan: "teks", nilai: "B" }));
  jawab.push(await h.w.kirimKeJembatan({ jenis: "tekan", penunjuk: "#simpan" }));
  await tunggu(50);
  return {
    html: htmlPanel(h),
    akar: atributAkar(h),
    minta: h.minta.map((m) => `${m.cara} ${m.url.replace(ASAL, "")}`),
    tulis: h.minta.filter((m) => m.cara !== "GET").length,
    tulisan: [...h.tulisan].sort(),
    jembatan: polos(h.jembatan),
    // Nomor urut jawaban jembatan memuat jam - dibuang, isinya dibandingkan.
    jawab: polos(jawab).map((x: any) => {
      if (!x || typeof x !== "object") return x;
      const { id, ...sisa } = x;
      return sisa;
    }),
    lainDiHtml: Array.from(h.d.documentElement.children).map((e: any) => e.tagName),
  };
}

// ============================================================================
describe("MODE LATIHAN (sipp-28): mati = tidak ada yang berubah", () => {
  it("bawaannya mati: tanpa atribut, tanpa kotak, dan tekan/isi/POST berjalan seperti biasa", async () => {
    const h = buka();
    await siapPanel(h);
    expect(h.w.alatLatihanNyala()).toBe(false);
    expect(h.d.documentElement.hasAttribute("data-aleta-latihan")).toBe(false);
    await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: "#a", jenisMedan: "teks", nilai: "x" });
    await h.w.kirimKeJembatan({ jenis: "tekan", penunjuk: "#simpan" });
    expect(h.jembatan.map((x) => x.jenis)).toEqual(["nilai", "isi", "tekan"]);
    const r = await h.w.fetch(TULIS, { method: "POST", body: "{}" });
    expect(r.status).toBe(200);
    expect(h.minta.some((m) => m.cara === "POST" && m.url === TULIS)).toBe(true);
    expect(h.d.getElementById("aleta-latihan-kotak")).toBeNull();
  });
});

describe("MODE LATIHAN (sipp-28): menyala = tidak ada yang ditulis ke SIPP maupun ALETA", () => {
  it("tekan dan isi TIDAK sampai ke jembatan; bacaan tetap; jawabannya jujur", async () => {
    const h = buka({ simpanan: { modeLatihan: true } });
    await siapPanel(h);
    await tunggu(20);
    expect(h.d.documentElement.getAttribute("data-aleta-latihan")).toBe("ya");
    const sebelum = h.jembatan.length;
    const isi = await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: 'input[name="majelis"]', jenisMedan: "teks", nilai: "Majelis B" });
    const tekan = await h.w.kirimKeJembatan({ jenis: "tekan", penunjuk: "#simpan" });
    const bacaan = await h.w.kirimKeJembatan({ jenis: "nilai", penunjuk: "#tgl_putusan" });
    expect(isi).toMatchObject({ ok: true, latihan: true, alasan: "mode_latihan" });
    expect(tekan).toMatchObject({ ok: false, alasan: "mode_latihan" });
    expect(bacaan).toMatchObject({ ok: true });
    const baru = h.jembatan.slice(sebelum).map((x) => x.jenis);
    expect(baru).toEqual(["nilai"]);
    expect(h.jembatan.some((x) => x.jenis === "isi" || x.jenis === "tekan")).toBe(false);
    // Bunyi Simpan yang tidak ditekan menyebut latihan, bukan "sudah masuk blangko".
    expect(h.w.bunyiSimpanTidakDitekan(tekan)).toMatch(/^LATIHAN: isian TIDAK dimasukkan/);
  });

  it("tidak satu pun fetch non-GET keluar - juga setelan pribadi dan Masukan yang lolos mode coba; GET tetap", async () => {
    const h = buka({ simpanan: { modeLatihan: true } });
    await siapPanel(h);
    for (const [alamat, cara] of [
      [TULIS, "POST"],
      [SETELAN, "PUT"],
      [MASUKAN, "POST"],
      [`${ASAL}/aleta/api/aleta-bot/penunjukan/hapus-semua`, "POST"],
      [`${ASAL}/aps_badilag/abt/edit_data?no_var=1`, "POST"],
      [`${ASAL}/aleta/api/aleta-ecourt/bas-komentar`, "PATCH"],
    ]) {
      const r = await h.w.fetch(alamat, { method: cara, body: JSON.stringify({ jenis: "pmh", perkaraId: 7 }) });
      expect(r.status, alamat).toBe(423);
      const badan = await r.json();
      expect(badan.alasan).toBe("mode_latihan");
      expect(badan.pesan).toMatch(/^LATIHAN: /);
    }
    expect(h.minta.filter((m) => m.cara !== "GET")).toEqual([]);
    // Hitungan murni tetap boleh - hanya membaca atau menghitung.
    const pra = await h.w.fetch(PRAPERIKSA, { method: "POST", body: "{}" });
    expect(pra.status).toBe(200);
    const g = await h.w.fetch(`${ASAL}/aleta/api/aleta-ecourt/status-perkara?nomor=x`);
    expect(g.status).toBe(200);
  });

  it("yang AKAN ditulis tercatat di kotak LATIHAN, bersama ringkasan badannya", async () => {
    const h = buka({ simpanan: { modeLatihan: true } });
    await siapPanel(h);
    await h.w.fetch(TULIS, { method: "POST", body: JSON.stringify({ jenis: "pmh", perkaraId: 7, hakimId: [3, 4] }) });
    await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: "#pertimbangan", jenisMedan: "kaya", nilai: "<p>Menimbang <b>bahwa</b></p>" });
    await h.w.kirimKeJembatan({ jenis: "tekan", penunjuk: "#simpan" });
    const kotak = h.d.getElementById("aleta-latihan-kotak")!;
    expect(kotak).not.toBeNull();
    // Di <html>, bukan <body>: pengamat DOM panel mendengarkan <body>.
    expect(kotak.parentElement).toBe(h.d.documentElement);
    const teks = kotak.textContent || "";
    expect(teks).toContain("LATIHAN: yang akan ditulis");
    expect(teks).toContain("Menuliskan penetapan ke SIPP");
    expect(teks).toContain("jenis: pmh");
    expect(teks).toContain('akan diisi: "Menimbang bahwa"');
    expect(teks).toContain("#simpan - TIDAK ditekan");
    expect(h.w.alatLatihanDaftar().map((x: any) => x.jenis)).toEqual(["kirim", "isi", "tekan"]);
  });

  it("tulisan yang berangkat SEBELUM saklarnya terbaca tetap ditahan", async () => {
    const h = buka({ simpanan: { modeLatihan: true } });
    // Serempak sesudah skrip dimuat - bacaan penyimpanan belum kembali.
    const r = await h.w.fetch(TULIS, { method: "POST", body: "{}" });
    expect(r.status).toBe(423);
    expect(h.minta.filter((m) => m.cara === "POST")).toEqual([]);
  });

  it("dimatikan dari popup (tab lain): atribut dan kotak dilepas seketika, tulisan berjalan lagi", async () => {
    const h = buka({ simpanan: { modeLatihan: true } });
    await siapPanel(h);
    await h.w.kirimKeJembatan({ jenis: "tekan", penunjuk: "#simpan" });
    expect(h.d.getElementById("aleta-latihan-kotak")).not.toBeNull();
    await h.setel({ modeLatihan: false });
    await sampai(() => !h.d.documentElement.hasAttribute("data-aleta-latihan"), "atribut dilepas");
    expect(h.d.getElementById("aleta-latihan-kotak")).toBeNull();
    const r = await h.w.fetch(TULIS, { method: "POST", body: "{}" });
    expect(r.status).toBe(200);
  });

  it("berlaku juga dalam tampilan Lama, dan panel.css menandainya LATIHAN", async () => {
    const h = buka({ simpanan: { modeLatihan: true, ujiTampilan: "lama" } });
    await siapPanel(h);
    expect(h.w.alatUjiMode()).toBe("lama");
    expect(h.d.documentElement.getAttribute("data-aleta-latihan")).toBe("ya");
    expect(GAYA).toMatch(/html\[data-aleta-latihan="ya"\] \.aleta-panel:not\(\.aleta-panel-lencana\)::after \{\s*content: "LATIHAN";/);
    expect(GAYA).toMatch(/html\[data-aleta-latihan="ya"\]::before \{\s*content: "MODE LATIHAN ALETA/);
  });
});

// ============================================================================
describe("popup: saklar Mode latihan hanya bagi Super Admin dan Admin", () => {
  function bukaPopup(peran: string, simpan: Record<string, unknown> = {}) {
    const html = POPUP_HTML.replace(/<script[\s\S]*?<\/script>/g, "");
    const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" }) as JsdomUji;
    terbuka.push(dom);
    const w = dom.window as any;
    const simpanan: Record<string, unknown> = { asalPortal: "http://192.168.10.10/aleta", ...simpan };
    w.chrome = {
      runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.173.1", host_permissions: [] }), sendMessage: async () => ({}) },
      storage: {
        local: {
          get: async (kunci?: string | string[] | null) => {
            const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
            const hasil: Record<string, unknown> = {};
            for (const x of daftar) if (x in simpanan) hasil[x] = polos(simpanan[x]);
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
          remove: async () => undefined,
        },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener() {} },
      },
    };
    w.fetch = async (alamat: string) => {
      if (String(alamat).includes("info=siapa")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran }, versi: "1.173.1" } }) };
      }
      return { ok: true, status: 200, url: String(alamat), json: async () => ({}) };
    };
    const ctx = dom.getInternalVMContext();
    vm.runInContext(DAFTAR_FITUR, ctx, { filename: "daftar-fitur.js" });
    vm.runInContext(POPUP_JS, ctx, { filename: "popup.js" });
    return { w, d: w.document as Document, simpanan };
  }
  const tenang = async (p: { d: Document }) => {
    await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
    await tunggu(40);
  };

  for (const peran of ["Super Admin", "Admin"]) {
    it(`${peran}: saklarnya tampil, mati sebagai bawaan, dan menyimpan kunci modeLatihan`, async () => {
      const p = bukaPopup(peran);
      await tenang(p);
      const bagian = p.d.getElementById("bagianLatihan") as HTMLElement;
      const kotak = p.d.getElementById("modeLatihan") as HTMLInputElement;
      expect(bagian.hidden).toBe(false);
      expect(kotak.checked).toBe(false);
      expect("modeLatihan" in p.simpanan).toBe(false);
      kotak.checked = true;
      kotak.dispatchEvent(new p.w.Event("change"));
      await tunggu(10);
      expect(p.simpanan.modeLatihan).toBe(true);
      expect(p.d.getElementById("latihanKet")!.textContent).toMatch(/^MENYALA/);
    });
  }

  for (const peran of ["Hakim", "Panitera Pengganti", "Operator"]) {
    it(`${peran}: tidak melihat saklarnya; bila menyala hanya membaca kabarnya`, async () => {
      const mati = bukaPopup(peran);
      await tenang(mati);
      expect((mati.d.getElementById("bagianLatihan") as HTMLElement).hidden).toBe(true);
      expect((mati.d.getElementById("latihanLainBaris") as HTMLElement).hidden).toBe(true);
      const nyala = bukaPopup(peran, { modeLatihan: true });
      await tenang(nyala);
      expect((nyala.d.getElementById("bagianLatihan") as HTMLElement).hidden).toBe(true);
      expect((nyala.d.getElementById("latihanLainBaris") as HTMLElement).hidden).toBe(false);
      expect(nyala.simpanan.modeLatihan).toBe(true);
    });
  }

  it("kunci popup SAMA dengan yang dibaca panel-alat.js, dan tidak ikut ekspor pengaturan", () => {
    expect(POPUP_JS).toContain('const KUNCI_MODE_LATIHAN = "modeLatihan";');
    expect(SUMBER.alat).toContain('const ALAT_LATIHAN_KUNCI = "modeLatihan";');
    const aturan = POPUP_JS.slice(POPUP_JS.indexOf("const ATURAN_PENGATURAN"), POPUP_JS.indexOf("const JENIS_BERKAS_PENGATURAN"));
    expect(aturan).not.toMatch(/Latihan|latihan/);
  });
});

// ============================================================================
describe("SYARAT MUTLAK: tampilan Lama identik dengan fd9aad7", () => {
  it("DOM panel, permintaan, tulisan penyimpanan, dan urutan pesan jembatan sama persis - penyimpanan kosong", async () => {
    const dulu = await jalani(buka({ sumber: SUMBER_LAMA }));
    const kini = await jalani(buka());
    expect(kini.html).toBe(dulu.html);
    expect(kini.minta).toEqual(dulu.minta);
    expect(kini.tulisan).toEqual(dulu.tulisan);
    expect(kini.jembatan).toEqual(dulu.jembatan);
    expect(kini.jawab).toEqual(dulu.jawab);
    expect(kini.akar).toEqual(dulu.akar);
    expect(kini.lainDiHtml).toEqual(dulu.lainDiHtml);
    // Rangkaiannya sungguh menyentuh jembatan dan menulis: tekan dan isi ada.
    expect(kini.jembatan.map((x: any) => x.jenis)).toEqual(["baca", "nilai", "nilai", "isi", "tekan"]);
    expect(kini.html).not.toMatch(/aleta-t7-|data-t7/);
  });

  it("seluruh saklar sipp-N, tab, lebar labuh, dan catatan tersimpan TIDAK mengubah satu karakter pun dalam Lama", async () => {
    const simpanan = {
      ujiTampilan: "lama",
      ujiFitur: SEMUA_SIPP,
      tabPanelSipp: "putusanKel",
      lebarLabuhPanelSipp: 520,
      catatanPerkaraSipp: { [NOMOR.toUpperCase()]: { teks: "x", diubah: 1 } },
      modeLatihan: false,
    };
    const dulu = await jalani(buka({ sumber: SUMBER_LAMA, simpanan }));
    const kini = await jalani(buka({ simpanan }));
    expect(kini.html).toBe(dulu.html);
    expect(kini.minta).toEqual(dulu.minta);
    expect(kini.tulisan).toEqual(dulu.tulisan);
    expect(kini.jembatan).toEqual(dulu.jembatan);
    expect(kini.akar).toEqual(dulu.akar);
    expect(kini.akar).not.toHaveProperty("data-aleta-sipp-labuh");
    expect(kini.akar).not.toHaveProperty("data-aleta-latihan");
  });

  it("tampilan Baru TANPA satu pun saklar sipp-N sama dengan Lama (kecuali mode coba)", async () => {
    const lamaKini = await jalani(buka({ simpanan: { ujiTampilan: "lama" } }));
    const baru = buka({ simpanan: { ujiTampilan: "baru", ujiIzinkanNyata: true } });
    const hasil = await jalani(baru);
    // Satu-satunya perbedaan yang DISENGAJA: isi bagian "Unggah putusan ke SIPP"
    // - edoc putusan dan edoc anonimisasi terpisah hadir di Baru dan UI Baru
    // tanpa saklar (permintaan pengguna 30 Sep 2026: "buat hanya di ekstensi
    // baru dan ui baru"; dijaga ekstensi-unggah-edoc-terpisah.test.ts). Isinya
    // dikosongkan di kedua sisi; selebihnya tetap harus sama persis.
    const tanpaUnggah = (html: string) =>
      html.replace(
        /(<div class="aleta-bagian" data-kunci="unggahPutusanSipp">[\s\S]*?<div class="aleta-bagian-isi"[^>]*>)[\s\S]*?(<\/div><\/div><div class="aleta-bagian" data-kunci="putusan">)/,
        "$1$2"
      );
    // Perbedaan DISENGAJA kedua (perbaikan 30 Sep 2026, butir 6/15/26 - berlaku
    // di Baru DAN UI Baru tanpa saklar, dijaga ekstensi-perbaikan-a.test.ts):
    // penanda data-t7-a30, tombol ⓘ di depan penjelasan panjang beserta
    // atribut lipatnya, dan bagian Juru Sita (data-a30-fitur). Ketiganya
    // DIBUANG di kedua sisi lewat DOM; teks penjelasannya sendiri tetap
    // dibandingkan, jadi tidak ada isi Lama yang boleh hilang atau berubah.
    // Perbedaan DISENGAJA ketiga (perbaikan 30 Sep SORE, agen S - Baru & UI
    // Baru, dijaga ekstensi-menu-peran-sipp.test.ts): menu per peran menandai
    // panel (data-mps-*), mengurutkan kelompok menurut matriks peran (Super
    // Admin: Penetapan, Putusan, Berkas, Perkara), dan memberi kelas
    // aleta-teknis pada penjelasan teknis. Penanda dan kelasnya dibuang, dan
    // kelompoknya dikembalikan ke urutan Lama; isi tiap kelompok tetap
    // dibandingkan utuh.
    const URUTAN_LAMA = ["kerjakan", "berkas", "perkara", "putusanKel"];
    const tanpaA30 = (html: string) => {
      const d = new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
      for (const el of Array.from(d.querySelectorAll("[data-a30-info], [data-a30-fitur]"))) el.remove();
      for (const el of Array.from(d.querySelectorAll("[data-t7-a30], [data-a30-lipat]"))) {
        el.removeAttribute("data-t7-a30");
        el.removeAttribute("data-a30-lipat");
      }
      for (const el of Array.from(d.querySelectorAll("*"))) {
        for (const nama of Array.from(el.attributes).map((a) => a.name)) if (nama.startsWith("data-mps-")) el.removeAttribute(nama);
        if (el.classList.contains("aleta-teknis")) {
          el.classList.remove("aleta-teknis");
          if (!el.classList.length) el.removeAttribute("class");
        }
      }
      for (const isi of Array.from(d.querySelectorAll(".aleta-isi"))) {
        const kel = Array.from(isi.querySelectorAll(":scope > .aleta-kelompok")) as HTMLElement[];
        if (!kel.length) continue;
        const pos = (el: HTMLElement) => URUTAN_LAMA.indexOf(el.dataset.kunci || "");
        const penanda = d.createTextNode("");
        isi.insertBefore(penanda, kel[0]);
        for (const el of kel.slice().sort((a, b) => pos(a) - pos(b))) isi.insertBefore(el, penanda);
        penanda.remove();
      }
      return d.body.innerHTML;
    };
    const baku = (html: string) => tanpaUnggah(tanpaA30(html));
    expect(hasil.html).toContain('data-kunci="unggahPutusanSipp"');
    expect(hasil.html).toContain('data-t7-a30="baru"');
    expect(tanpaUnggah(hasil.html)).not.toBe(hasil.html);
    expect(baku(hasil.html)).toBe(baku(lamaKini.html));
    // Pembanding Lama tidak memuat satu pun jejak perbaikan 30 Sep.
    expect(lamaKini.html).not.toMatch(/data-t7-a30|data-a30-/);
    expect(hasil.jembatan).toEqual(lamaKini.jembatan);
  });
});

// ============================================================================
describe("ide sipp-N hanya bila saklarnya menyala; D1-D15 hanya UI Baru", () => {
  const fitur = (h: Halaman) =>
    Array.from(new Set(Array.from(panelDari(h).querySelectorAll("[data-t7-fitur]")).map((e: any) => e.getAttribute("data-t7-fitur")))).sort();

  it("Baru + sipp-13 saja: hanya kartu catatan internal, tanpa tab, tanpa labuh", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "sipp-13": true }, ujiIzinkanNyata: true } });
    await siapT7(h, "baru");
    await tunggu(30);
    expect(panelDari(h).getAttribute("data-t7")).toBe("baru");
    expect(fitur(h)).toEqual(["sipp-13"]);
    expect(panelDari(h).querySelector(".aleta-t7-tabbar")).toBeNull();
    expect(h.d.documentElement.hasAttribute("data-aleta-sipp-labuh")).toBe(false);
  });

  it("catatan internal (sipp-13) tersimpan di PC ini saja - tidak ada permintaan jaringan", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "sipp-13": true }, ujiIzinkanNyata: true } });
    await siapT7(h, "baru");
    const kotak = await sampai(() => {
      const t = panelDari(h).querySelector("textarea.aleta-t7-catatan");
      return t && !t.disabled ? t : null;
    }, "catatan siap");
    const sebelum = h.minta.length;
    kotak.value = "Tanya panitera soal relaas";
    kotak.dispatchEvent(new h.w.Event("input"));
    await sampai(() => h.simpanan.catatanPerkaraSipp, "catatan tersimpan", 2000);
    expect((h.simpanan.catatanPerkaraSipp as any)[NOMOR.toUpperCase()].teks).toBe("Tanya panitera soal relaas");
    expect(h.minta.slice(sebelum).filter((m) => !m.url.includes("status-perkara"))).toEqual([]);
  });

  it("UI Baru: tab (D3), menu ⋯ (D2), kartu Langkah berikutnya (D4), labuh (D1)", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true } });
    await siapT7(h, "ui");
    await tunggu(30);
    const panel = panelDari(h);
    expect(panel.getAttribute("data-t7")).toBe("ui");
    const tab = Array.from(panel.querySelectorAll(".aleta-t7-tab")).map((t: any) => t.getAttribute("data-t7-ke"));
    // Urutan disesuaikan perbaikan 30 Sep SORE (menu per peran, agen S): uji
    // ini masuk sebagai Super Admin, yang menunya Penetapan, Putusan, (Juru
    // Sita), Berkas, Perkara. Dijaga ekstensi-menu-peran-sipp.test.ts.
    expect(tab).toEqual(["kerjakan", "putusanKel", "berkas", "perkara"]);
    expect(panel.getAttribute("data-t7-tab")).toBe("kerjakan");
    (panel.querySelector('.aleta-t7-tab[data-t7-ke="perkara"]') as any).click();
    expect(panel.getAttribute("data-t7-tab")).toBe("perkara");
    await tunggu(10);
    expect(h.simpanan.tabPanelSipp).toBe("perkara");
    expect(panel.querySelector(".aleta-t7-menu")).not.toBeNull();
    expect(panel.querySelector(".aleta-t7-langkah")).not.toBeNull();
    expect(h.d.documentElement.getAttribute("data-aleta-sipp-labuh")).toBe("kanan");
    // Disesuaikan perbaikan 30 Sep 2026 (butir 7, "buat seperti ekstensi
    // lainnya posisi tombol"): tombol kepala yang lama TETAP di kepala - satu
    // elemen, tidak disalin - dan menu memuat WAKIL berlabel yang menekan
    // tombol yang sama (dijaga ekstensi-perbaikan-a.test.ts).
    const menu = panel.querySelector(".aleta-t7-menu");
    for (const k of [".aleta-tema", ".aleta-lipat", ".aleta-penuh", ".aleta-bawaan"]) {
      expect(panel.querySelector(`.aleta-kepala .aleta-alat-kepala ${k}`), k).not.toBeNull();
      expect(menu.querySelector(`[data-a30-wakil="${k.slice(1)}"]`), k).not.toBeNull();
      expect(panel.querySelectorAll(k).length, k).toBe(1);
    }
    // Ide sipp-N tetap mati dalam UI Baru tanpa saklarnya.
    expect(panel.querySelector('[data-t7-fitur="sipp-13"]')).toBeNull();
    // Kembali ke Lama: labuh dilepas, panel digambar ulang tanpa satu pun jejak.
    await h.setel({ ujiTampilan: "lama" });
    await sampai(() => !h.d.documentElement.hasAttribute("data-aleta-sipp-labuh"), "labuh dilepas");
    await sampai(() => panelDari(h) && !panelDari(h).hasAttribute("data-t7"), "digambar ulang");
    expect(htmlPanel(h)).not.toMatch(/aleta-t7-|data-t7/);
  });

  it("Baru + sipp-8: Penilaian SK ringkas - yang dapat diperbaiki sekarang di atas", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "sipp-8": true }, ujiIzinkanNyata: true } });
    const panel = await siapT7(h, "baru");
    const bag = panel.querySelector('.aleta-bagian[data-kunci="penilaianSk"]');
    bag.querySelector(".aleta-bagian-judul").click();
    const ringkas = await sampai(() => bag.querySelector(".aleta-t7-skor-ringkas"), "skor ringkas");
    expect(ringkas.textContent).toContain("1 dari 3 unsur bernilai penuh");
    expect(bag.querySelector(".aleta-t7-skor-kelompok .aleta-t7-temuan-judul").textContent).toBe("Dapat diperbaiki sekarang (2)");
  });
});

// ============================================================================
describe("D8: Zona berbahaya menuntut nomor perkara diketik", () => {
  it("tombol pembongkar yang SAMA dipindah; klik tertahan sampai nomornya cocok", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true } });
    const panel = await siapT7(h, "ui");
    await tunggu(20);
    // Bongkar-semua tiruan, dibentuk seperti tombolBongkarSemua: pembungkus + tombol + pendengar.
    const bungkus = h.d.createElement("div");
    bungkus.className = "aleta-bongkar-semua";
    const tombol = h.d.createElement("button");
    tombol.textContent = "Batalkan SELURUH penetapan perkara ini";
    let ditekan = 0;
    tombol.addEventListener("click", () => {
      ditekan += 1;
    });
    bungkus.appendChild(tombol);
    panel.querySelector('.aleta-bagian[data-kunci="penunjukan"] .aleta-bagian-isi').appendChild(bungkus);
    await sampai(() => panel.querySelector(".aleta-t7-zona-slot .aleta-bongkar-semua"), "pindah ke zona");
    expect(panel.querySelectorAll(".aleta-bongkar-semua").length).toBe(1);
    tombol.click();
    expect(ditekan).toBe(0);
    const ketik = panel.querySelector(".aleta-t7-gerbang input");
    ketik.value = "450/Pdt.G/2026";
    ketik.dispatchEvent(new h.w.Event("input"));
    tombol.click();
    expect(ditekan).toBe(0);
    ketik.value = ` ${NOMOR.toLowerCase()} `;
    ketik.dispatchEvent(new h.w.Event("input"));
    tombol.click();
    expect(ditekan).toBe(1);
  });
});

describe("sipp-27: templat pertimbangan - DRAF tidak dapat disisipkan", () => {
  it("DRAF bertanda dan tombolnya mati; penyisipnya menolak walau dipanggil langsung", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "sipp-27": true }, ujiIzinkanNyata: true } });
    const panel = await siapT7(h, "baru");
    const daftar = await sampai(() => panel.querySelectorAll(".aleta-t7-templat").length === 2 && panel.querySelectorAll(".aleta-t7-templat"), "templat");
    const [sah, draf] = Array.from(daftar) as any[];
    expect(sah.querySelector("button").disabled).toBe(false);
    expect(draf.textContent).toContain("DRAF - belum disahkan");
    expect(draf.querySelector("button").disabled).toBe(true);
    // Kotak Pertimbangan Hukum panel (seperti barisIsian).
    const kartu = h.d.createElement("div");
    kartu.className = "aleta-abt-kartu";
    kartu.innerHTML = '<span class="aleta-abt-nama">Pertimbangan Hukum</span><textarea class="aleta-sunting"></textarea>';
    panel.appendChild(kartu);
    const kotak = kartu.querySelector("textarea") as HTMLTextAreaElement;
    expect(h.w.t7SisipTemplat({ disahkan: false, judul: "Gugur", isi: "<p>x</p>" })).toMatch(/DRAF/);
    expect(kotak.value).toBe("");
    expect(h.w.t7SisipTemplat({ disahkan: true, judul: "Verstek", isi: "<p>Menimbang</p>" })).toMatch(/disisipkan/);
    expect(kotak.value).toBe("<p>Menimbang</p>");
    // Tidak ada permintaan tulis - templat hanya dibaca.
    expect(h.minta.filter((m) => m.cara !== "GET")).toEqual([]);
  });

  it("rute yang belum ada (404) berbunyi 'belum tersedia di server'", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "sipp-29": true }, ujiIzinkanNyata: true } });
    const panel = await siapT7(h, "baru");
    const kartu = await sampai(() => panel.querySelector('[data-t7-fitur="sipp-29"] .aleta-t7-belum'), "kabar 404");
    expect(kartu.textContent).toContain("belum tersedia di server");
  });
});

// ============================================================================
describe("sipp-14: ambang pengingat tenggat = ambang Penilaian SK", () => {
  const bot = readFileSync(path.join(REPO, "aleta_bot/services/penilaianSippService.js"), "utf8");

  it("tangga minutasi dan publikasi sama dengan penilaianSippService", () => {
    // Tangga di dalam unsur waktuMinutasi dan waktuPublikasi saja - skalaHarian
    // (unsur ketepatan input) memakai tangganya sendiri.
    const tangga = ["waktuMinutasi", "waktuPublikasi"].map((kunci) => {
      const i = bot.indexOf(`kunci: "${kunci}"`);
      expect(i, kunci).toBeGreaterThan(0);
      return bot.slice(i).match(/tangga\(selisih, (\[\[[^\n]*?\]\]), 0\)/)![0];
    });
    const ctx = vm.createContext({});
    const skEkstensi = vm.runInContext(`${SUMBER.konten.match(/const T7_SK = \{[\s\S]*?\n\};/)![0]}; T7_SK`, ctx);
    for (const t of tangga) {
      const pasangan = JSON.parse(t.replace(/^tangga\(selisih, /, "").replace(/, 0\)$/, ""));
      expect(pasangan).toEqual(polos(skEkstensi.tanggaSesudahPutus));
    }
    const putus = bot.match(/sampaiHari: (\d+), nilai: 5/);
    expect(Number(putus![1])).toBe(skEkstensi.putusHariPenuh);
  });

  it("hitungannya: putus 27 Sep, belum minutasi, hari ini 28 Sep -> sisa 1 hari (paling lambat 29 Sep)", async () => {
    const h = buka();
    await siapPanel(h);
    const baris = h.w.t7HitungTenggat(statusContoh(), new h.w.Date(2026, 8, 28));
    expect(baris.map((b: any) => b.judul)).toEqual(["Minutasi berkas", "Publikasi putusan"]);
    expect(baris[0].sisa).toBe("1 hari lagi (paling lambat 29 Sep 2026)");
    const lewat = h.w.t7HitungTenggat(statusContoh(), new h.w.Date(2026, 9, 3));
    expect(lewat[0].sisa).toBe("lewat 4 hari");
    expect(lewat[0].ket).toMatch(/nilainya 2/);
  });
});

// ============================================================================
describe("panel.css: blok Tahap 7 seluruhnya bersyarat", () => {
  const a = GAYA.indexOf("PANEL SIPP - TAHAP 7 (MULAI)");
  const b = GAYA.indexOf("/* PANEL SIPP - TAHAP 7 (AKHIR) */");
  // Dipotong dari pembuka komentar judulnya, supaya komentar itu ikut terbuang.
  const blok = GAYA.slice(GAYA.lastIndexOf("/*", a), b).replace(/\/\*[\s\S]*?\*\//g, "");

  it("penandanya ada, satu kali, dan bloknya tidak kosong", () => {
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(GAYA.lastIndexOf("PANEL SIPP - TAHAP 7 (MULAI)")).toBe(a);
    expect(blok.length).toBeGreaterThan(1000);
  });

  it("tiap pemilih diawali syarat yang tidak pernah terpenuhi dalam Lama dengan latihan mati", () => {
    const salah: string[] = [];
    for (const m of blok.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      const pemilih = m[1].trim();
      if (pemilih.startsWith("@media")) continue;
      for (const bagian of pemilih.split(",")) {
        const x = bagian.replace(/^@media[^{]*\{/, "").trim();
        if (!/^(#aleta-panel-sipp\[data-t7|html\[data-aleta-kulit="modern"\] #aleta-panel-sipp|html\[data-aleta-latihan="ya"\]|html\[data-aleta-sipp-labuh="kanan"\])/.test(x)) salah.push(x);
      }
    }
    expect(salah).toEqual([]);
  });
});

// ============================================================================
describe("tidak ada jalur tulis SIPP baru", () => {
  // Blok Tahap 7 berakhir di pembuka perbaikan 30 Sep 2026 (agen A), yang
  // punya penjaganya sendiri di ekstensi-perbaikan-a.test.ts: non-GET-nya
  // hanya K1 konversi-naskah dan anonim ABT, tanpa pesan jembatan sendiri.
  const awalBlok = SUMBER.konten.indexOf("TAHAP 7 - PANEL SIPP DALAM TAMPILAN BARU");
  const akhirBlok = SUMBER.konten.indexOf("PERBAIKAN 30 SEPTEMBER 2026 - PANEL SIPP", awalBlok);
  const blok = SUMBER.konten.slice(awalBlok, akhirBlok > 0 ? akhirBlok : undefined);

  it("blok Tahap 7 tidak mengirim satu pun pesan ke jembatan sendiri", () => {
    expect(blok).not.toMatch(/kirimKeJembatan(Langsung)?\(/);
    expect(blok).not.toMatch(/postMessage\(/);
  });

  it("satu-satunya permintaan non-GET-nya ke Masukan portal (sipp-30), bukan ke SIPP", () => {
    const metode = blok.match(/method:\s*"[A-Z]+"/g) || [];
    expect(metode).toEqual(['method: "POST"']);
    expect(blok).toContain('const T7_API_MASUKAN = "/aleta/api/feedback";');
  });

  it("Masukan lolos mode coba dengan alasan tertulis, tetapi tidak lolos mode latihan", () => {
    expect(SUMBER.alat).toMatch(/Laporkan masalah \(ide sipp-30[\s\S]{0,400}\/\\\/aleta\\\/api\\\/feedback\(\?:\[\?#\]\|\$\)\//);
    const latihan = SUMBER.alat.slice(SUMBER.alat.indexOf("const ALETA_LATIHAN_BOLEH"), SUMBER.alat.indexOf("const ALAT_LATIHAN_SEBUTAN"));
    expect(latihan).not.toMatch(/feedback|setelan/);
  });
});

