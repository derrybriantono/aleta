/**
 * Tahap 1 rencana "ekstensi dulu" (29 September 2026, ekstensi 1.172.0):
 * pengalih Lama / Baru / UI Baru khusus Super Admin, kulit Modern, 120 saklar
 * fitur ide, dan MODE COBA.
 *
 * Yang dijaga, menurut pentingnya:
 *   1. SYARAT SELESAI - tampilan Lama (bawaan) tidak mengubah apa pun: tidak
 *      ada atribut di halaman, tidak ada permintaan yang ditahan, tidak ada
 *      fitur yang tampil.
 *   2. Mode coba menahan kirim dan simpan (ALETA, ABT, tombol Simpan SIPP)
 *      selama tampilan uji menyala, dan hanya meloloskan daftar baca kecil.
 *   3. Kulit Modern hanya hidup di bawah penanda <html data-aleta-kulit>, dan
 *      tokennya sama di panel.css dan widget checklist.
 *   4. Popup: pengalihnya hanya bagi Super Admin, kuncinya sama dengan yang
 *      dibaca panel, dan saklarnya semua mati sebagai bawaan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const sumberAlat = baca("panel-alat.js");
const gaya = baca("panel.css");
const konten = baca("konten.js");
const checklist = baca("checklist.js");
const popupHtml = baca("popup.html");
const popupJs = baca("popup.js");
const daftarFiturJs = baca("daftar-fitur.js");
const susun = readFileSync(path.resolve(__dirname, "../../scripts/susun-ekstensi.mjs"), "utf8");

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── panel-alat.js dijalankan sungguhan ───────────────────────────────────────

type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;

function elemenTiruan(tag: string): any {
  const atribut = new Map<string, string>();
  return {
    tagName: String(tag).toUpperCase(),
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute: (n: string, v: string) => atribut.set(n, String(v)),
    removeAttribute: (n: string) => atribut.delete(n),
    getAttribute: (n: string) => (atribut.has(n) ? atribut.get(n) : null),
    hasAttribute: (n: string) => atribut.has(n),
    appendChild: (x: any) => x,
    querySelector: () => null,
    addEventListener() {},
    atribut,
  };
}

function jalankanAlat(awal: Record<string, unknown> = {}) {
  const simpanan: Record<string, unknown> = JSON.parse(JSON.stringify(awal));
  const pendengar: Array<(u: Ubah, w: string) => void> = [];
  const diminta: Array<{ alamat: string; cara: string }> = [];
  const bacaTampilan: string[] = [];
  const akar = elemenTiruan("html");
  const k: any = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Promise,
    Error,
    Map,
    Set,
    RegExp,
    document: {
      documentElement: akar,
      createElement: (t: string) => elemenTiruan(t),
      querySelector: () => null,
      addEventListener() {},
    },
    window: {
      location: { hostname: "127.0.0.1", pathname: "/index.php/detil_perkara", search: "" },
      sessionStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "1.172.0" }) },
      storage: {
        onChanged: { addListener: (f: (u: Ubah, w: string) => void) => void pendengar.push(f) },
        local: {
          get: async (kunci: string[]) => {
            const hasil: Record<string, unknown> = {};
            for (const x of kunci) if (x in simpanan) hasil[x] = simpanan[x];
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
        },
      },
    },
    fetch: async (alamat: string, opsi?: { method?: string }) => {
      // Bacaan tampilan yang diterapkan admin (tahap 5) dicatat terpisah: ia
      // satu-satunya permintaan tambahan dalam Lama, dan dijaga uji tersendiri.
      if (String(alamat).includes("/api/aleta-ecourt/ekstensi/tampilan")) {
        bacaTampilan.push(String(opsi?.method || "GET").toUpperCase());
        return { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) };
      }
      diminta.push({ alamat: String(alamat), cara: String(opsi?.method || "GET").toUpperCase() });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ ok: true }) };
    },
    navigator: {},
    Response: class {
      body: string;
      status: number;
      ok: boolean;
      constructor(body: string, init: any) {
        this.body = body;
        this.status = init?.status ?? 200;
        this.ok = this.status >= 200 && this.status < 300;
      }
      async json() {
        return JSON.parse(this.body);
      }
    },
    AbortController: class {
      signal = {};
      abort() {}
    },
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(sumberAlat, k, { filename: "panel-alat.js" });
  /** Meniru popup yang menulis ke chrome.storage: onChanged sampai ke tab ini. */
  const ubahDariPopup = (isi: Record<string, unknown>) => {
    const ubah: Ubah = {};
    for (const [x, v] of Object.entries(isi)) {
      ubah[x] = { oldValue: simpanan[x], newValue: v };
      simpanan[x] = v;
    }
    for (const f of pendengar) f(ubah, "local");
  };
  return { k, akar, diminta, bacaTampilan, ubahDariPopup };
}

/** Sesudah bacaan penyimpanan pertama kembali. */
async function siap(awal: Record<string, unknown> = {}) {
  const h = jalankanAlat(awal);
  await h.k.alatMuatUji();
  return h;
}

// Contoh tindakan berdampak luar dari ekstensi, satu per jalur.
const TULIS_ALETA = "http://192.168.10.10/aleta/api/aleta-bot/penunjukan/tulis";
const UNGGAH_SIPP = "http://192.168.10.10/aleta/api/aleta-ecourt/putusan/unggah-sipp";
const POSITA = "http://192.168.10.10/aleta/api/aleta-bot/sipp/posita";
const EDIT_ABT = "http://192.168.10.10/aps_badilag/abt/edit_data?no_var=0098&perkara_id=1&e=2";
const TJ_SIMPAN = "http://192.168.10.10/aps_badilag/abt/tanyajawab_perkara_edit?aksi=simpan&no_var=1&a=1&b=2&c=3&d=1";
const TJ_BACA = "http://192.168.10.10/aps_badilag/abt/tanyajawab_perkara_edit?no_var=1&a=1&b=2&c=3&d=1";
const PDF = "http://192.168.10.10/aleta/api/aleta-bot/abt/pdf";

// ============================================================================
describe("SYARAT SELESAI: tampilan Lama tidak mengubah apa pun", () => {
  it("penyimpanan kosong = Lama, kulit Klasik, tanpa mode coba, tanpa fitur", async () => {
    const { k, akar } = await siap();
    expect(k.alatUjiMode()).toBe("lama");
    expect(k.alatKulit()).toBe("klasik");
    expect(k.alatCobaAktif()).toBe(false);
    expect(k.alatFiturNyala("sipp-1")).toBe(false);
    // Tidak ada satu pun atribut baru di <html>.
    expect(akar.hasAttribute("data-aleta-kulit")).toBe(false);
    expect(akar.hasAttribute("data-aleta-coba")).toBe(false);
  });

  it("dalam Lama, semua permintaan berjalan seperti sebelumnya - tidak ada yang ditahan mode coba", async () => {
    const { k, diminta } = await siap();
    for (const alamat of [TULIS_ALETA, UNGGAH_SIPP, EDIT_ABT, TJ_SIMPAN]) {
      const jawab = await k.fetch(alamat, { method: "POST" });
      expect(jawab.status, alamat).toBe(200);
    }
    expect(diminta.length).toBe(4);
  });

  it("dalam Lama, satu-satunya permintaan tambahan: SATU bacaan GET tampilan dari portal, paling sering 5 menit sekali", async () => {
    // Perlu supaya tampilan yang diterapkan admin (tahap 5) sampai ke pegawai.
    // Tidak mengubah tampilan: portal lama menjawab 404 dan semuanya tetap Lama.
    const { k, akar, bacaTampilan } = await siap();
    await new Promise((r) => setTimeout(r, 20));
    expect(bacaTampilan).toEqual(["GET"]);
    await k.alatSegarkanTampilanServer(false);
    expect(bacaTampilan).toEqual(["GET"]);
    expect(k.alatUjiMode()).toBe("lama");
    expect(akar.hasAttribute("data-aleta-kulit")).toBe(false);
  });

  it("dalam Lama, saklar fitur yang tersimpan menyala pun tetap dianggap mati", async () => {
    const { k } = await siap({ ujiTampilan: "lama", ujiFitur: { "sipp-1": true, "popup-19": true } });
    expect(k.alatFiturNyala("sipp-1")).toBe(false);
    expect(k.alatFiturNyala("popup-19")).toBe(false);
  });

  it("nilai tampilan yang tidak dikenal diperlakukan sebagai Lama", async () => {
    const { k, akar } = await siap({ ujiTampilan: "<script>" });
    expect(k.alatUjiMode()).toBe("lama");
    expect(akar.hasAttribute("data-aleta-coba")).toBe(false);
  });

  it("mode kering tetap bekerja persis seperti sebelumnya", async () => {
    const { k } = await siap();
    await k.alatSetelKering(true);
    const jawab = await k.fetch(TULIS_ALETA, { method: "POST" });
    expect(jawab.status).toBe(423);
    expect((await jawab.json()).alasan).toBe("mode_kering");
    // Kering tidak menyentuh ABT - itu wilayah mode coba.
    expect((await k.fetch(EDIT_ABT, { method: "POST" })).status).toBe(200);
  });
});

// ============================================================================
describe("mode coba: kirim dan simpan ditahan selama tampilan uji menyala", () => {
  for (const mode of ["baru", "ui"]) {
    it(`tampilan ${mode}: tulisan ke ALETA, unggah ke SIPP, posita, dan simpan ABT ditahan dengan 423`, async () => {
      const { k, diminta } = await siap({ ujiTampilan: mode });
      expect(k.alatCobaAktif()).toBe(true);
      for (const alamat of [TULIS_ALETA, UNGGAH_SIPP, POSITA, EDIT_ABT, TJ_SIMPAN]) {
        const jawab = await k.fetch(alamat, { method: "POST" });
        expect(jawab.status, alamat).toBe(423);
        const isi = await jawab.json();
        expect(isi.ok).toBe(false);
        expect(isi.alasan).toBe("mode_coba");
      }
      expect(diminta.length).toBe(0);
    });
  }

  it("bacaan tetap lolos: GET, tanya-jawab ABT tanpa aksi=simpan, dan konversi PDF", async () => {
    const { k, diminta } = await siap({ ujiTampilan: "baru" });
    expect((await k.fetch(TULIS_ALETA)).status).toBe(200);
    expect((await k.fetch(TJ_BACA, { method: "POST" })).status).toBe(200);
    expect((await k.fetch(PDF, { method: "POST" })).status).toBe(200);
    expect((await k.fetch("/aleta/api/aleta-ecourt/putusan/praperiksa", { method: "POST" })).status).toBe(200);
    expect(diminta.length).toBe(4);
  });

  it("tindakan yang ditahan tercatat di kotak hitam sebagai DITAHAN", async () => {
    const { k } = await siap({ ujiTampilan: "ui" });
    k.alatKotakKosongkan();
    await k.fetch(EDIT_ABT, { method: "POST" });
    expect(k.alatKotakHitam().some((x: any) => x.jenis === "coba" && x.ringkas.includes("DITAHAN POST"))).toBe(true);
  });

  it("'Izinkan tindakan nyata' melepas penahanan tanpa kembali ke Lama", async () => {
    const { k, akar } = await siap({ ujiTampilan: "ui", ujiIzinkanNyata: true });
    expect(k.alatCobaAktif()).toBe(false);
    expect(akar.hasAttribute("data-aleta-coba")).toBe(false);
    expect(akar.getAttribute("data-aleta-kulit")).toBe("modern");
    expect((await k.fetch(TULIS_ALETA, { method: "POST" })).status).toBe(200);
  });

  it("penanda mode coba dipasang di <html> dan berwarna lain dari mode kering", async () => {
    const { akar } = await siap({ ujiTampilan: "baru" });
    expect(akar.getAttribute("data-aleta-coba")).toBe("ya");
    expect(akar.hasAttribute("data-aleta-kulit")).toBe(false);
    expect(gaya).toMatch(/html\[data-aleta-coba="ya"\] \.aleta-panel \{\s*outline: 2px dashed #3ec6e6;/);
    expect(gaya).toMatch(/html\[data-aleta-coba="ya"\]::after \{\s*content: "Mode coba ALETA/);
  });

  it("tombol Simpan SIPP lewat jembatan ditahan mode coba, sama seperti mode kering", () => {
    const badan = konten.slice(konten.indexOf("async function kirimKeJembatan(pesan) {"));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    expect(fungsi).toContain('if (jenis === "tekan" && alatCobaAktif()) {');
    expect(fungsi).toContain('return { ok: false, alasan: "mode_coba" };');
    expect(konten).toContain('if (alasan === "mode_coba") return');
  });
});

// ============================================================================
describe("pengalih berlaku seketika di tab yang terbuka", () => {
  it("Lama -> UI Baru -> Lama: atribut dipasang lalu dilepas seluruhnya", async () => {
    const { k, akar, ubahDariPopup } = await siap();
    ubahDariPopup({ ujiTampilan: "ui" });
    expect(k.alatUjiMode()).toBe("ui");
    expect(akar.getAttribute("data-aleta-kulit")).toBe("modern");
    expect(akar.getAttribute("data-aleta-coba")).toBe("ya");
    ubahDariPopup({ ujiTampilan: "lama" });
    expect(akar.hasAttribute("data-aleta-kulit")).toBe(false);
    expect(akar.hasAttribute("data-aleta-coba")).toBe(false);
  });

  it("saklar fitur hanya menyala untuk kode yang dinyalakan, dan hanya di luar Lama", async () => {
    const { k, ubahDariPopup } = await siap();
    ubahDariPopup({ ujiTampilan: "baru", ujiFitur: { "sipp-5": true } });
    expect(k.alatFiturNyala("sipp-5")).toBe(true);
    expect(k.alatFiturNyala("sipp-6")).toBe(false);
    ubahDariPopup({ ujiFitur: {} });
    expect(k.alatFiturNyala("sipp-5")).toBe(false);
  });
});

// ============================================================================
describe("kulit Modern: hanya di bawah penandanya, token sama di mana-mana", () => {
  const tanpaCatatan = gaya.replace(/\/\*[\s\S]*?\*\//g, "");
  const TOKEN = [
    "latar",
    "latar-naik",
    "garis",
    "garis-kuat",
    "tulisan",
    "tulisan-lembut",
    "merek",
    "aman",
    "mendesak",
    "lewat",
  ];
  const blok = (teks: string, pemilih: string) => {
    const i = teks.indexOf(`${pemilih} {`);
    if (i < 0) throw new Error(`blok ${pemilih} tidak ada`);
    const isi = teks.slice(i, teks.indexOf("}", i));
    const peta: Record<string, string> = {};
    for (const m of isi.matchAll(/--aleta-([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*!important\s*;/g)) peta[m[1]] = m[2].toLowerCase();
    return peta;
  };

  it("setiap aturan yang menyebut kulit Modern atau mode coba bersyarat penanda <html>", () => {
    // Inilah jaminan bahwa kulit Klasik tidak tersentuh: aturan baru hanya
    // hidup ketika atributnya ada, dan atribut itu hanya dipasang di luar Lama.
    for (const m of tanpaCatatan.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      const pemilih = m[1].trim();
      if (!/kulit|aleta-coba/.test(pemilih)) continue;
      for (const bagian of pemilih.split(",")) {
        expect(bagian.trim(), bagian).toMatch(/^html(?:\[[^\]]+\])*\[data-aleta-(?:kulit="modern"|coba="ya")\]/);
      }
    }
  });

  it("gelap dan terang masing-masing mengganti kesepuluh token", () => {
    const gelap = blok(tanpaCatatan, 'html[data-aleta-kulit="modern"] .aleta-panel:not([data-tema="terang"])');
    const terang = blok(tanpaCatatan, 'html[data-aleta-kulit="modern"] .aleta-panel[data-tema="terang"]');
    expect(Object.keys(gelap).sort()).toEqual([...TOKEN].sort());
    expect(Object.keys(terang).sort()).toEqual([...TOKEN].sort());
    expect(gelap.merek).toBe("#3ec6e6");
  });

  it("widget checklist memakai token yang sama persis", () => {
    const ck = checklist.replace(/\$\{[^}]*\}/g, "0");
    expect(blok(ck, ':host([data-kulit="modern"]:not([data-tema="terang"]))')).toEqual(
      blok(tanpaCatatan, 'html[data-aleta-kulit="modern"] .aleta-panel:not([data-tema="terang"])')
    );
    expect(blok(ck, ':host([data-kulit="modern"][data-tema="terang"])')).toEqual(
      blok(tanpaCatatan, 'html[data-aleta-kulit="modern"] .aleta-panel[data-tema="terang"]')
    );
    // Atribut inangnya diturunkan dari penanda <html>, dan diperbarui saat pengalih berganti.
    expect(checklist).toContain('document.documentElement.getAttribute("data-aleta-kulit") === "modern"');
    expect(checklist).toContain('document.addEventListener("aleta-uji-berubah", () => terapkanTema());');
  });

  it("tidak ada huruf yang diunduh dari luar", () => {
    expect(gaya).not.toMatch(/fonts\.googleapis|@import|@font-face/);
    expect(popupHtml).not.toMatch(/fonts\.googleapis/);
  });
});

// ============================================================================
describe("daftar 120 saklar fitur", () => {
  const k: any = {};
  vm.createContext(k);
  vm.runInContext(daftarFiturJs, k);
  const daftar: any[] = k.ALETA_DAFTAR_FITUR;

  it("120 kode unik, 30 per bagian, bernomor 1-30 sesuai berkas ide", () => {
    expect(daftar.length).toBe(120);
    expect(new Set(daftar.map((x) => x.kode)).size).toBe(120);
    for (const b of ["sipp", "abt", "portal", "popup"]) {
      const nomor = daftar.filter((x) => x.bagian === b).map((x) => x.nomor);
      expect(nomor, b).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    }
    for (const x of daftar) expect(x.kode).toBe(`${x.bagian}-${x.nomor}`);
  });

  it("empat ide yang sudah diputuskan boleh ikut tidak lagi bertanda perlu keputusan", () => {
    const peta = new Map(daftar.map((x) => [x.kode, x]));
    expect(peta.get("portal-16").judul).toMatch(/Ganti peran/);
    expect(peta.get("portal-28").judul).toMatch(/layar publik/);
    expect(peta.get("popup-11").judul).toMatch(/Profil saklar/);
    expect(peta.get("popup-19").judul).toMatch(/WhatsApp/);
    for (const kode of ["portal-16", "portal-28", "popup-11", "popup-19"]) expect(peta.get(kode).perluKeputusan).toBe(false);
    expect(daftar.some((x) => x.perluKeputusan)).toBe(true);
  });

  it("ikut ditanam ke portal, dan dimuat popup SEBELUM popup.js", () => {
    expect(susun).toContain('"daftar-fitur.js",');
    const i = popupHtml.indexOf('<script src="daftar-fitur.js"></script>');
    expect(i).toBeGreaterThan(0);
    expect(popupHtml.indexOf('<script src="popup.js"></script>')).toBeGreaterThan(i);
  });
});

// ============================================================================
describe("popup: pengalih khusus Super Admin", () => {
  const terbuka: JSDOM[] = [];
  afterEach(() => {
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  function bukaPopup(peran: string, awal: Record<string, unknown> = {}) {
    const html = popupHtml.replace(/<script[\s\S]*?<\/script>/g, "");
    const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
    terbuka.push(dom);
    const w = dom.window as any;
    const simpanan: Record<string, unknown> = { asalPortal: "http://192.168.10.10/aleta", ...awal };
    w.chrome = {
      runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.172.0" }), sendMessage: async () => ({}) },
      storage: {
        local: {
          get: async (kunci?: string | string[] | null) => {
            const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
            const hasil: Record<string, unknown> = {};
            for (const x of daftar) if (x in simpanan) hasil[x] = JSON.parse(JSON.stringify(simpanan[x]));
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
          remove: async () => undefined,
        },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener() {} },
      },
    };
    w.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran }, versi: "1.172.0" } }),
    });
    // Ada saat runScripts: "outside-only", tetapi tidak tercantum di tipe JSDOM.
    const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
    vm.runInContext(daftarFiturJs, ctx, { filename: "daftar-fitur.js" });
    vm.runInContext(popupJs, ctx, { filename: "popup.js" });
    return { w, d: w.document as Document, simpanan };
  }

  async function sampai(syarat: () => boolean, apa: string) {
    const mulai = Date.now();
    while (!syarat()) {
      if (Date.now() - mulai > 2000) throw new Error(`tidak kunjung: ${apa}`);
      await tunggu(10);
    }
  }

  it("baris yang disembunyikan lewat hidden tidak dikalahkan display gayanya", () => {
    // .uji-nyata bergaya display:flex; tanpa aturan [hidden] tersendiri,
    // kotak "Izinkan tindakan nyata" tetap tampil dalam tampilan Lama.
    expect(popupHtml).toContain(".uji-nyata[hidden] { display: none; }");
  });

  it("kunci penyimpanan di popup sama dengan yang dibaca panel", () => {
    for (const [nama, nilai] of [
      ["TAMPILAN", "ujiTampilan"],
      ["FITUR", "ujiFitur"],
      ["NYATA", "ujiIzinkanNyata"],
    ]) {
      expect(popupJs).toContain(`const KUNCI_UJI_${nama} = "${nilai}";`);
      expect(sumberAlat).toContain(`const ALAT_UJI_KUNCI_${nama} = "${nilai}";`);
    }
  });

  it("tersembunyi bagi yang bukan Super Admin; tampilan Lama tidak menyisakan apa pun", async () => {
    const p = bukaPopup("Panitera Pengganti");
    await tunggu(60);
    expect((p.d.getElementById("bagianUji") as HTMLElement).hidden).toBe(true);
    expect((p.d.getElementById("ujiLainBaris") as HTMLElement).hidden).toBe(true);
    expect(p.d.documentElement.hasAttribute("data-kulit")).toBe(false);
  });

  it("Super Admin melihatnya, bawaan Lama, dan semua saklar fitur mati", async () => {
    const p = bukaPopup("Super Admin");
    await sampai(() => !(p.d.getElementById("bagianUji") as HTMLElement).hidden, "bagian uji tampil");
    expect(p.d.getElementById("ujiLama")!.getAttribute("aria-pressed")).toBe("true");
    expect((p.d.getElementById("ujiNyataBaris") as HTMLElement).hidden).toBe(true);
    const laci = p.d.getElementById("ujiFiturLaci") as HTMLDetailsElement;
    laci.open = true;
    await sampai(() => p.d.querySelectorAll("#ujiFiturDaftar input[data-kode]").length === 120, "laci tersusun");
    const kotak = Array.from(p.d.querySelectorAll("#ujiFiturDaftar input[data-kode]")) as HTMLInputElement[];
    expect(kotak.length).toBe(120);
    expect(kotak.every((x) => !x.checked)).toBe(true);
    expect(p.d.getElementById("ujiFiturHitung")!.textContent).toBe("0/120 nyala");
  });

  it("memilih UI Baru menyimpan pilihannya, memasang kulit Modern, dan menyebut mode coba", async () => {
    const p = bukaPopup("Super Admin");
    await sampai(() => !(p.d.getElementById("bagianUji") as HTMLElement).hidden, "bagian uji tampil");
    (p.d.getElementById("ujiUi") as HTMLButtonElement).click();
    await sampai(() => p.simpanan.ujiTampilan === "ui", "tersimpan");
    expect(p.d.documentElement.getAttribute("data-kulit")).toBe("modern");
    expect(p.d.getElementById("ujiKet")!.textContent).toMatch(/Mode coba/);
    expect((p.d.getElementById("ujiNyataBaris") as HTMLElement).hidden).toBe(false);
    (p.d.getElementById("ujiLama") as HTMLButtonElement).click();
    await sampai(() => p.simpanan.ujiTampilan === "lama", "kembali lama");
    expect(p.d.documentElement.hasAttribute("data-kulit")).toBe(false);
  });

  it("saklar fitur: menyalakan satu menyimpan hanya yang menyala", async () => {
    const p = bukaPopup("Super Admin", { ujiTampilan: "baru" });
    await sampai(() => !(p.d.getElementById("bagianUji") as HTMLElement).hidden, "bagian uji tampil");
    const laci = p.d.getElementById("ujiFiturLaci") as HTMLDetailsElement;
    laci.open = true;
    await sampai(() => p.d.querySelectorAll("#ujiFiturDaftar input[data-kode]").length === 120, "laci tersusun");
    const kotak = p.d.getElementById("uji-fitur-sipp-5") as HTMLInputElement;
    kotak.checked = true;
    kotak.dispatchEvent(new p.w.Event("change"));
    await sampai(() => JSON.stringify(p.simpanan.ujiFitur) === '{"sipp-5":true}', "sipp-5 tersimpan");
    (p.d.getElementById("ujiSemuaMati") as HTMLButtonElement).click();
    await sampai(() => JSON.stringify(p.simpanan.ujiFitur) === "{}", "semua mati");
  });

  it("bukan Super Admin, tetapi tampilan uji tertinggal menyala: disebut dan dapat dikembalikan ke Lama", async () => {
    const p = bukaPopup("Hakim", { ujiTampilan: "ui" });
    await sampai(() => !(p.d.getElementById("ujiLainBaris") as HTMLElement).hidden, "pesan tampil");
    expect((p.d.getElementById("bagianUji") as HTMLElement).hidden).toBe(true);
    (p.d.getElementById("ujiKembaliLama") as HTMLButtonElement).click();
    await sampai(() => p.simpanan.ujiTampilan === "lama", "kembali lama");
    expect(p.d.documentElement.hasAttribute("data-kulit")).toBe(false);
  });
});
