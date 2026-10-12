// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PERBAIKAN 30 SEPTEMBER 2026 - PANEL SIPP (agen A)
 * ============================================================================
 *
 * Butir yang dijaga di sini, semuanya dengan MENJALANKAN kodenya (panel-alat.js
 * dan konten.js UTUH di jsdom beralamat halaman SIPP; jembatan.js utuh untuk
 * konfirmasi Simpan):
 *
 *   6/26  penjelasan panjang dilipat di balik ⓘ (Baru & UI Baru); pesan error
 *         tidak dilipat; Lama tanpa jejak.
 *   7     ☀ – ⛶ ↺ tetap di kepala UI Baru; menu ⋯ memuat wakilnya.
 *   8     putusan otomatis menerima DOCX/DOC/PDF lewat K1 (konversi-naskah),
 *         lalu jalur unggah-naskah yang sama; 404 dan mode coba disebut jujur.
 *   10    konfirmasi "Apakah Anda Yakin Akan Menyimpan Data" di-OK-kan jembatan
 *         HANYA selama tekanan ALETA dan dikembalikan; keadaan "sebelum" dipakai
 *         ulang; jajak cepat sesudah SIPP menjawab tersimpan.
 *   11    hanya edoc putusan -> anonimisasi dibuat dalam bentuk yang sama (K1 ->
 *         ABT anonim -> K1) -> pemeriksa (konfirmasi) -> kedua slot sekaligus;
 *         tanpa sesi ABT: "masuk ABT dulu", tidak ada yang diunggah.
 *   18    klik ganda kepala = layar penuh, sekali lagi = kembali.
 *   19    edoc putusan + anonimisasi diunggah SESUDAH Simpan terbukti, sebelum
 *         halaman dimuat ulang.
 *   15    bagian (Baru) / tab (UI Baru) Juru Sita memanggil jurusita.js.
 *
 * ALETA_UJI_KONTEN / ALETA_UJI_JEMBATAN menunjuk SALINAN untuk pembukti gigitan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () => (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js"));
const JEMBATAN = () => (process.env.ALETA_UJI_JEMBATAN ? readFileSync(process.env.ALETA_UJI_JEMBATAN, "utf8") : baca("jembatan.js"));
const ALAT = baca("panel-alat.js");
const GAYA = baca("panel.css");

const ASAL = "http://192.168.10.10";
const NOMOR = "450/Pdt.G/2026/PA.Dgl";
const KONVERSI = "/aleta/api/aleta-ecourt/putusan/konversi-naskah";
const ANONIM_ABT = "/aps_badilag/abt/main/anonim";

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
// Portal tiruan
// ----------------------------------------------------------------------------
function konteksContoh() {
  return {
    ok: true,
    nomorPerkara: NOMOR,
    nomorRegister: "PA.DGL-2026-0450",
    identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
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
    nomorPihak: [{ nama: "Isabella binti Muhamad Aini", adaNomor: true, statusVerifikasi: "terverifikasi", nomorSamar: "08xx" }],
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: 3,
    hakim: null,
  };
}

type Minta = { url: string; cara: string; badan: unknown };
type Jawab = { status?: number; isi?: unknown; bita?: Uint8Array; url?: string };
type Penjawab = (url: string, cara: string, badan: unknown, ke: number) => Jawab | undefined;

const RTF_ANONIM = "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0 Menimbang bahwa Penggugat ( xxx ) melawan Tergugat ( xxx );\\par}";
// 12 Okt 2026 (butir 19): NIK 16 angka kini DISAMARKAN ALETA. Yang tetap tidak
// dapat disamarkan otomatis - dan karena itu ditanyakan - nama pihak yang
// terbelah ganti paragraf ("Taufik\par Qurahman", Tergugat dari tabel SIPP).
const RTF_BOCOR =
  "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0 NIK 7203111072023001 atas nama Isabella binti Muhamad Aini, Tergugat Taufik\\par Qurahman\\par}";
const TABEL_TERGUGAT = "<table><tr><td>No</td><td>Tergugat</td></tr><tr><td>1</td><td>Taufik Qurahman bin Dasril</td></tr></table>";
const b64 = (s: string) => Buffer.from(s, "latin1").toString("base64");

function jawabBaku(peran: string): Penjawab {
  return (url, cara) => {
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) return { status: 404, isi: {} };
    if (url.includes("/aleta-bot/sipp-konteks?")) {
      return { isi: { ok: true, data: { available: true, konteks: konteksContoh(), pengguna: { nama: "Derry", peran }, kapabilitas: null } } };
    }
    if (url.includes("/aleta-ecourt/status-perkara?")) {
      return { isi: { ok: true, data: { available: true, status: { putusan: { sudahPutus: false }, putusanLengkap: {}, tahapan: { terbaca: false, tahap: [] }, penilaianSk: { rinci: [] } } } } };
    }
    if (cara !== "GET") return { isi: { ok: true, data: {} } };
    return { isi: { ok: true, data: {} } };
  };
}

// ----------------------------------------------------------------------------
// Halaman SIPP tiruan
// ----------------------------------------------------------------------------
type Halaman = {
  dom: JSDOM;
  w: any;
  d: Document;
  simpanan: Record<string, unknown>;
  minta: Minta[];
  jembatan: Array<Record<string, any>>;
  jurusita: Array<Record<string, unknown>>;
  setel: (isi: Record<string, unknown>) => Promise<void>;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(
  p: {
    simpanan?: Record<string, unknown>;
    html?: string;
    peran?: string;
    jawab?: Penjawab;
    jurusita?: boolean;
    jurusitaTolak?: boolean;
    buktiSimpan?: { st: 0 | 1; pesan: string } | null;
  } = {}
): Halaman {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3>${p.html || ""}</div></body></html>`,
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: Record<string, unknown>, wilayah: string) => void> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      const ubah: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(isi)) {
        ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async (kunci: string | string[]) => {
      for (const k of [kunci].flat()) delete simpanan[k];
    },
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.174.1" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: { local, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: (f: any) => void pendengar.push(f) } },
  };
  const minta: Minta[] = [];
  const jawab = p.jawab ?? jawabBaku(p.peran ?? "Super Admin");
  const cadangan = jawabBaku(p.peran ?? "Super Admin");
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    minta.push({ url, cara, badan: opsi?.body });
    const h = jawab(url, cara, opsi?.body, minta.length) ?? cadangan(url, cara, opsi?.body, minta.length)!;
    const status = h.status ?? 200;
    const bita = h.bita ?? new TextEncoder().encode(JSON.stringify(h.isi ?? {}));
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      url: h.url ?? url,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => polos(h.isi),
      text: async () => new TextDecoder().decode(bita),
      arrayBuffer: async () => bita.buffer.slice(bita.byteOffset, bita.byteOffset + bita.byteLength),
      clone: () => r,
    };
    return r;
  };
  const jembatan: Array<Record<string, any>> = [];
  const pmAsli = w.postMessage.bind(w);
  const kirimJawab = (data: Record<string, unknown>) =>
    setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data, source: w })), 0);
  w.postMessage = (data: any, asal: string) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id, ...isi } = data;
      jembatan.push(polos(isi));
      let balas: Record<string, unknown> =
        isi.jenis === "baca"
          ? { ok: true, medan: [] }
          : isi.jenis === "nilai"
            ? { ok: true, nilai: "lama", tampak: true }
            : isi.jenis === "pilihan"
              ? { ok: true, pilihan: [], nilaiSekarang: "" }
              : { ok: true };
      if (isi.jenis === "tekan" && isi.bukti && p.buktiSimpan) {
        balas = { ok: true, bukti: "terkirim", ...(isi.setujuiKonfirmasi ? { konfirmasi: "disetujui" } : {}) };
        const bukti = { sumber: "aleta-jembatan-jawab", id: isi.bukti.id, jenis: "bukti-simpan", asal: "ajax", ...p.buktiSimpan };
        setTimeout(() => kirimJawab(bukti), 5);
      }
      kirimJawab({ sumber: "aleta-jembatan-jawab", id, ...balas });
      return;
    }
    return pmAsli(data, asal);
  };
  const jurusita: Array<Record<string, unknown>> = [];
  if (p.jurusita) {
    // jurusita.js tiruan (milik agen E) - dimuat SEBELUM konten.js, seperti di manifest.
    w.aletaJurusitaBoleh = (peran: string) => /super|admin|panitera|juru\s*sita/i.test(String(peran || ""));
    w.aletaJurusitaPasang = async (wadah: HTMLElement, opsi: Record<string, unknown>) => {
      jurusita.push(polos(opsi));
      if (p.jurusitaTolak) return false;
      const el = w.document.createElement("div");
      el.className = "aleta-jurusita";
      el.textContent = "Relaas dan PBT";
      wadah.appendChild(el);
      return true;
    };
  }
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  return { dom, w, d: w.document, simpanan, minta, jembatan, jurusita, setel: (isi) => local.set(isi) };
}

const panelDari = (h: Halaman) => h.d.getElementById("aleta-panel-sipp") as any;
const siapPanel = (h: Halaman) => sampai(() => panelDari(h) && panelDari(h).querySelector(".aleta-kelompok") && panelDari(h), "panel perkara tergambar");
const siapA30 = (h: Halaman, nilai: string) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.getAttribute("data-t7-a30") === nilai && pn.querySelector(".aleta-kelompok") ? pn : null;
  }, `panel ${nilai} tertata`);
const BARU = { ujiTampilan: "baru", ujiIzinkanNyata: true };
const UI = { ujiTampilan: "ui", ujiIzinkanNyata: true };
const pilihBerkas = (h: Halaman, el: HTMLInputElement, berkas: File[]) => {
  Object.defineProperty(el, "files", { value: berkas, configurable: true });
  el.dispatchEvent(new h.w.Event("change"));
};
const berkas = (h: Halaman, nama: string, isi = "{\\rtf1 naskah}") => new h.w.File([isi], nama, { type: "application/octet-stream" });
const klikGanda = (h: Halaman, el: Element) => el.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true, cancelable: true }));

// ============================================================================
describe("tampilan Lama: tidak ada jejak perbaikan 30 Sep", () => {
  it("tanpa penanda, tanpa ⓘ, klik ganda kepala tidak berbuat apa-apa, tekan tanpa setujuiKonfirmasi", async () => {
    const h = buka({ jurusita: true });
    const panel = await siapPanel(h);
    await tunggu(30);
    expect(panel.outerHTML).not.toMatch(/data-t7-a30|data-a30-|aleta-a30-/);
    expect(panel.querySelector('[data-kunci="juruSita"]')).toBeNull();
    expect(h.jurusita).toEqual([]);
    klikGanda(h, panel.querySelector(".aleta-kepala .aleta-merek"));
    expect(panel.classList.contains("aleta-panel-penuh")).toBe(false);
    await h.w.tekanSimpanPutusan("id-uji");
    const tekan = h.jembatan.filter((x) => x.jenis === "tekan");
    expect(tekan.length).toBeGreaterThan(0);
    for (const t of tekan) expect(t).not.toHaveProperty("setujuiKonfirmasi");
    expect(h.w.a30OpsiSimpanMassal({ sudahPutus: false })).toBeNull();
  });
});

// ============================================================================
describe("butir 6/26: penjelasan panjang di balik ⓘ (Baru & UI Baru)", () => {
  for (const [mode, simpanan] of [
    ["baru", BARU],
    ["ui", UI],
  ] as const) {
    it(`${mode}: dilipat, dapat dibuka-tutup; teksnya tetap utuh di DOM`, async () => {
      const h = buka({ simpanan });
      const panel = await siapA30(h, mode);
      const teks = await sampai(
        () => Array.from(panel.querySelectorAll(".aleta-tetap-sebab")).find((x: any) => /jawab-menjawab/.test(x.textContent)) as any,
        "penjelasan dokumen e-Court"
      );
      await sampai(() => teks.getAttribute("data-a30-lipat") === "tutup", "terlipat");
      const tombol = teks.previousElementSibling;
      expect(tombol.classList.contains("aleta-a30-info")).toBe(true);
      expect(tombol.textContent).toContain("ⓘ");
      expect(tombol.getAttribute("aria-expanded")).toBe("false");
      tombol.click();
      expect(teks.getAttribute("data-a30-lipat")).toBe("buka");
      expect(tombol.getAttribute("aria-expanded")).toBe("true");
      tombol.click();
      expect(teks.getAttribute("data-a30-lipat")).toBe("tutup");
      expect(teks.textContent).toContain("Sisipkan berkas ke Jadwal Sidang");
    });
  }

  it("pesan error, kabar, dan yang pendek TIDAK dilipat; yang lahir belakangan ikut dilipat", async () => {
    const h = buka({ simpanan: BARU });
    const panel = await siapA30(h, "baru");
    const isi = panel.querySelector(".aleta-isi");
    const panjang = "Kalimat penjelasan yang cukup panjang untuk dilipat di balik tombol info supaya panel tidak ramai. ".repeat(2);
    const gagal = h.w.buatElemen("div", "aleta-tetap-sebab aleta-abt-gagal", panjang);
    const kabar = h.w.buatElemen("div", "aleta-abt-kabar");
    kabar.appendChild(h.w.buatElemen("div", "aleta-tetap-sebab", panjang));
    const pendek = h.w.buatElemen("div", "aleta-tetap-sebab", "Pendek saja.");
    const baru = h.w.buatElemen("div", "aleta-tetap-sebab aleta-remeh", panjang);
    isi.append(gagal, kabar, pendek, baru);
    await sampai(() => baru.getAttribute("data-a30-lipat") === "tutup", "yang lahir belakangan terlipat");
    expect(gagal.hasAttribute("data-a30-lipat")).toBe(false);
    expect(kabar.firstChild.hasAttribute("data-a30-lipat")).toBe(false);
    expect(pendek.hasAttribute("data-a30-lipat")).toBe(false);
  });

  it("panel.css menyembunyikan yang terlipat hanya di bawah penanda Baru/UI Baru", () => {
    expect(GAYA).toContain('#aleta-panel-sipp[data-t7-a30] [data-a30-lipat="tutup"] { display: none !important; }');
    const a = GAYA.indexOf("PANEL SIPP - TAHAP 7 (MULAI)");
    const b = GAYA.indexOf("PANEL SIPP - TAHAP 7 (AKHIR)");
    const blok = GAYA.slice(a, b);
    expect(blok).toContain("data-t7-a30");
    expect(blok).toContain('#aleta-panel-sipp[data-t7-tab="juruSitaKel"]');
  });
});

// ============================================================================
describe("butir 7: ☀ – ⛶ ↺ tetap di kepala UI Baru; menu ⋯ memuat wakilnya", () => {
  it("tombolnya di kepala, satu elemen; wakil di menu menekan tombol yang sama", async () => {
    const h = buka({ simpanan: UI });
    const panel = await sampai(() => {
      const pn = panelDari(h);
      return pn && pn.getAttribute("data-t7") === "ui" && pn.querySelector(".aleta-t7-menu") ? pn : null;
    }, "panel UI Baru");
    const alat = panel.querySelector(".aleta-kepala .aleta-alat-kepala");
    for (const k of ["aleta-tema", "aleta-lipat", "aleta-penuh", "aleta-bawaan"]) {
      expect(alat.querySelector(`.${k}`), k).not.toBeNull();
      expect(panel.querySelectorAll(`.${k}`).length, k).toBe(1);
      expect(panel.querySelector(`.aleta-t7-menu [data-a30-wakil="${k}"]`), k).not.toBeNull();
    }
    // Urutan kepala sama dengan panel ABT/portal: tema, ciutkan, layar penuh, bawaan.
    const urut = Array.from(alat.querySelectorAll(".aleta-tema, .aleta-lipat, .aleta-penuh, .aleta-bawaan")).map((x: any) => x.className);
    expect(urut).toEqual(["aleta-tema", "aleta-lipat", "aleta-penuh", "aleta-bawaan"]);
    const wakil = panel.querySelector('.aleta-t7-menu [data-a30-wakil="aleta-penuh"]');
    expect(wakil.textContent).toContain("Layar penuh");
    wakil.click();
    expect(panel.classList.contains("aleta-panel-penuh")).toBe(true);
    // Ikon wakil mengikuti tombol kepalanya saat menu dibuka.
    panel.querySelector('.aleta-t7-ikon[aria-label="Menu panel"]').click();
    expect(wakil.querySelector(".aleta-t7-menu-ikon").textContent).toBe(alat.querySelector(".aleta-penuh").textContent);
    wakil.click();
    expect(panel.classList.contains("aleta-panel-penuh")).toBe(false);
  });
});

// ============================================================================
describe("butir 18: klik ganda kepala = layar penuh; sekali lagi = kembali", () => {
  for (const [mode, simpanan] of [
    ["baru", BARU],
    ["ui", UI],
  ] as const) {
    it(`${mode}: bolak-balik lewat tombol ⛶ yang sama; tombol di kepala tidak ikut`, async () => {
      const h = buka({ simpanan });
      const panel = await siapA30(h, mode);
      const kepala = panel.querySelector(":scope > .aleta-kepala");
      klikGanda(h, kepala.querySelector(".aleta-merek"));
      expect(panel.classList.contains("aleta-panel-penuh")).toBe(true);
      expect(panel.querySelector(".aleta-penuh").textContent).toBe("⤢");
      klikGanda(h, kepala);
      expect(panel.classList.contains("aleta-panel-penuh")).toBe(false);
      expect(panel.querySelector(".aleta-penuh").textContent).toBe("⛶");
      // Klik ganda pada tombol kepala adalah dua klik tombol itu - bukan layar penuh.
      klikGanda(h, kepala.querySelector(".aleta-bawaan"));
      expect(panel.classList.contains("aleta-panel-penuh")).toBe(false);
      // Klik ganda di dalam panel tidak menciutkannya (jalan keluar hanya di luar panel).
      expect(panel.classList.contains("aleta-panel-lencana")).toBe(false);
    });
  }
});

// ============================================================================
describe("Juru Sita (butir 15): bagian di Baru, tab di UI Baru, bila jurusita.js termuat", () => {
  // Disesuaikan perbaikan 30 Sep SORE (menu per peran, agen S): bila matriks
  // peran berlaku - di sini Super Admin - Juru Sita di tampilan Baru menjadi
  // KELOMPOK sendiri (urutan Penetapan, Putusan, Juru Sita, Berkas, Perkara),
  // bukan bagian di dalam Perkara. Peran di luar matriks tetap memakai bagian
  // lama. Dijaga ekstensi-menu-peran-sipp.test.ts. Perilaku yang dijaga di
  // sini tetap: terlipat, dibuka = jurusita.js dipanggil SEKALI.
  it("Baru: kelompok Juru Sita terlipat; dibuka = jurusita.js dipanggil sekali", async () => {
    const h = buka({ simpanan: BARU, jurusita: true });
    const panel = await siapA30(h, "baru");
    const bag = panel.querySelector('.aleta-kelompok[data-kunci="juruSitaKel"][data-a30-fitur="jurusita"]');
    expect(bag).not.toBeNull();
    await tunggu(20);
    expect(h.jurusita).toEqual([]);
    bag.querySelector(".aleta-kelompok-judul").click();
    await sampai(() => h.jurusita.length === 1, "jurusita dipasang");
    expect(h.jurusita[0]).toMatchObject({ situs: "sipp", nomorPerkara: NOMOR });
    bag.querySelector(".aleta-kelompok-judul").click();
    bag.querySelector(".aleta-kelompok-judul").click();
    await tunggu(20);
    expect(h.jurusita.length).toBe(1);
    expect(bag.querySelector(".aleta-jurusita")).not.toBeNull();
  });

  it("UI Baru: tab Juru Sita; memilih tabnya memasang isinya", async () => {
    const h = buka({ simpanan: UI, jurusita: true });
    const panel = await sampai(() => {
      const pn = panelDari(h);
      return pn && pn.getAttribute("data-t7") === "ui" && pn.querySelector('.aleta-t7-tab[data-t7-ke="juruSitaKel"]') ? pn : null;
    }, "tab Juru Sita");
    // Urutan disesuaikan perbaikan 30 Sep SORE (menu per peran, agen S):
    // Super Admin = Penetapan, Putusan, Juru Sita, Berkas, Perkara (matriks
    // alatMenuPeran). Dijaga ekstensi-menu-peran-sipp.test.ts. Perbaikan 5 Okt
    // (butir 11): tab PTSP sesudah Penetapan.
    expect(Array.from(panel.querySelectorAll(".aleta-t7-tab")).map((t: any) => t.getAttribute("data-t7-ke"))).toEqual([
      "kerjakan",
      "ptspKel",
      "putusanKel",
      "juruSitaKel",
      "berkas",
      "perkara",
    ]);
    expect(h.jurusita).toEqual([]);
    panel.querySelector('.aleta-t7-tab[data-t7-ke="juruSitaKel"]').click();
    await sampai(() => h.jurusita.length === 1, "jurusita dipasang lewat tab");
    expect(panel.getAttribute("data-t7-tab")).toBe("juruSitaKel");
  });

  it("UI Baru: jurusita.js menolak (pulang false) - tabnya disembunyikan, kembali ke tab pertama", async () => {
    const h = buka({ simpanan: UI, jurusita: true, jurusitaTolak: true });
    const panel = await sampai(() => {
      const pn = panelDari(h);
      return pn && pn.querySelector('.aleta-t7-tab[data-t7-ke="juruSitaKel"]') ? pn : null;
    }, "tab Juru Sita");
    panel.querySelector('.aleta-t7-tab[data-t7-ke="juruSitaKel"]').click();
    await sampai(() => !panel.querySelector('.aleta-t7-tab[data-t7-ke="juruSitaKel"]'), "tab dilepas");
    expect(panel.querySelector('[data-a30-fitur="jurusita"]')).toBeNull();
    expect(panel.getAttribute("data-t7-tab")).toBe("kerjakan");
  });

  it("peran Hakim, atau jurusita.js tidak termuat: tidak ada bagian Juru Sita", async () => {
    const hakim = buka({ simpanan: BARU, jurusita: true, peran: "Hakim" });
    const p1 = await siapA30(hakim, "baru");
    expect(p1.querySelector('[data-a30-fitur="jurusita"]')).toBeNull();
    const tanpa = buka({ simpanan: BARU });
    const p2 = await siapA30(tanpa, "baru");
    expect(p2.querySelector('[data-a30-fitur="jurusita"]')).toBeNull();
  });
});

// ============================================================================
// Butir 8: putusan otomatis menerima DOCX/DOC/PDF
const BORANG_PUTUSAN = '<form id="frm_putusan"><textarea id="perhum"></textarea><input type="submit" id="simpan" value="Simpan"></form>';

function penjawabNaskah(opsi: { konversi?: Jawab; peringatan?: string[] } = {}): Penjawab {
  return (url, cara, badan) => {
    if (url.includes(KONVERSI)) {
      if (opsi.konversi) return opsi.konversi;
      const ke = String((badan as any).get("ke"));
      const asal = (badan as any).get("berkas");
      return {
        isi: {
          ok: true,
          data: {
            berkasBase64: b64(ke === "rtf" ? "{\\rtf1 hasil}" : "PK-hasil"),
            namaBerkas: String(asal.name).replace(/\.[^.]+$/, `.${ke}`),
            mime: ke === "rtf" ? "application/rtf" : "application/octet-stream",
            bentukAsal: String(asal.name).split(".").pop(),
            peringatan: opsi.peringatan ?? [],
          },
        },
      };
    }
    if (url.includes("/putusan/unggah-naskah")) {
      return { isi: { ok: true, data: { ok: true, versi: 3, bagian: [{ judul: "Pertimbangan Hukum", aksara: 1200 }], perabotDibuang: 0 } } };
    }
    return undefined;
  };
}

describe("butir 8: putusan otomatis menerima DOCX, DOC, dan PDF lewat K1", () => {
  it("Lama: pemilihnya tetap RTF/TXT dan tidak ada konversi", async () => {
    const h = buka({ html: BORANG_PUTUSAN, jawab: penjawabNaskah() });
    const panel = await siapPanel(h);
    const pemilih = panel.querySelector('[data-kunci="isiPutusan"] .aleta-unggah-naskah input[type=file]');
    expect(pemilih.accept).toBe(".rtf,.txt");
    expect(panel.querySelector('[data-kunci="isiPutusan"]').textContent).toContain("berkas RTF-nya, bukan PDF");
  });

  it("Baru: DOCX diubah ke RTF (ke=rtf) lalu dikirim ke unggah-naskah sebagai RTF", async () => {
    const h = buka({ simpanan: BARU, html: BORANG_PUTUSAN, jawab: penjawabNaskah() });
    const panel = await siapA30(h, "baru");
    const bag = panel.querySelector('[data-kunci="isiPutusan"]');
    const pemilih = bag.querySelector(".aleta-unggah-naskah input[type=file]");
    expect(pemilih.accept).toBe(".rtf,.txt,.docx,.doc,.pdf");
    pilihBerkas(h, pemilih, [berkas(h, "450_Pdt.G_2026_PA.Dgl putusan.docx", "PK-docx")]);
    await sampai(() => h.minta.some((m) => m.url.includes("/putusan/unggah-naskah")), "unggah-naskah terkirim");
    const k1 = h.minta.find((m) => m.url.includes(KONVERSI))!;
    expect(k1.cara).toBe("POST");
    expect((k1.badan as any).get("ke")).toBe("rtf");
    expect((k1.badan as any).get("berkas").name).toBe("450_Pdt.G_2026_PA.Dgl putusan.docx");
    const naskah = h.minta.find((m) => m.url.includes("/putusan/unggah-naskah"))!;
    expect((naskah.badan as any).get("berkas").name).toBe("450_Pdt.G_2026_PA.Dgl putusan.rtf");
    expect(h.minta.indexOf(k1)).toBeLessThan(h.minta.indexOf(naskah));
    // Butir 19: pilihan "sekaligus" muncul untuk naskah ini, tercentang.
    const sekaligus = await sampai(() => bag.querySelector('[data-a30-fitur="sekaligus"]') as any, "baris sekaligus");
    await sampai(() => sekaligus.style.display === "", "baris sekaligus tampak");
    expect(sekaligus.querySelector("input").checked).toBe(true);
    expect(sekaligus.textContent).toContain("450_Pdt.G_2026_PA.Dgl putusan.docx");
  });

  it("Baru: PDF diberi peringatan tata letak", async () => {
    const h = buka({ simpanan: BARU, html: BORANG_PUTUSAN, jawab: penjawabNaskah() });
    const panel = await siapA30(h, "baru");
    const bag = panel.querySelector('[data-kunci="isiPutusan"]');
    pilihBerkas(h, bag.querySelector(".aleta-unggah-naskah input[type=file]"), [berkas(h, "putusan.pdf", "%PDF-1.4")]);
    await sampai(() => bag.querySelector(".aleta-unggah-hasil .aleta-tetap-awas"), "peringatan PDF");
    expect(bag.querySelector(".aleta-unggah-hasil .aleta-tetap-awas").textContent).toMatch(/tata letak/);
  });

  it("K1 belum ada di server (404): disebut apa adanya, unggah-naskah TIDAK dikirim", async () => {
    const h = buka({ simpanan: BARU, html: BORANG_PUTUSAN, jawab: penjawabNaskah({ konversi: { status: 404, isi: {} } }) });
    const panel = await siapA30(h, "baru");
    const bag = panel.querySelector('[data-kunci="isiPutusan"]');
    pilihBerkas(h, bag.querySelector(".aleta-unggah-naskah input[type=file]"), [berkas(h, "putusan.doc", "DOC")]);
    await sampai(() => /belum tersedia di server/.test(bag.textContent), "kabar 404");
    expect(h.minta.some((m) => m.url.includes("/putusan/unggah-naskah"))).toBe(false);
  });

  it("mode coba: K1 lolos (hanya menghitung - ALETA_COBA_BOLEH), unggah-naskah yang menyimpan tetap ditahan", async () => {
    // ujiIzinkanNyata tidak dinyalakan - mode coba menahan non-GET selain daftar bolehnya.
    const h = buka({ simpanan: { ujiTampilan: "baru" }, html: BORANG_PUTUSAN, jawab: penjawabNaskah() });
    const panel = await siapA30(h, "baru");
    const bag = panel.querySelector('[data-kunci="isiPutusan"]');
    pilihBerkas(h, bag.querySelector(".aleta-unggah-naskah input[type=file]"), [berkas(h, "putusan.docx", "PK")]);
    await sampai(() => /423/.test(bag.textContent), "unggah-naskah ditahan");
    expect(h.minta.filter((m) => m.cara !== "GET").map((m) => m.url.replace(ASAL, ""))).toEqual([KONVERSI]);
  });

  it("K1 yang ditahan (423 mode latihan) disebut apa adanya", async () => {
    const h = buka({
      simpanan: BARU,
      jawab: (url) => (url.includes(KONVERSI) ? { status: 423, isi: { ok: false, alasan: "mode_latihan", pesan: "Mode latihan aktif." } } : undefined),
    });
    await siapA30(h, "baru");
    const hasil = await h.w.a30KonversiNaskah(berkas(h, "putusan.docx", "PK"), "rtf");
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/^Mengubah putusan\.docx menjadi RTF ditahan mode latihan - tidak ada yang dikirim\./);
  });
});

// ============================================================================
// Butir 11: hanya edoc putusan -> anonimisasi otomatis dalam bentuk yang sama
function penjawabAnonim(opsi: { abt: Jawab; unggah?: unknown }): Penjawab {
  const naskah = penjawabNaskah();
  return (url, cara, badan, ke) => {
    if (url.includes(ANONIM_ABT)) return opsi.abt;
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return { isi: { ok: true, data: { sipp: { perkaraId: 4321 } } } };
    if (url.includes("/putusan/unggah-sipp")) {
      return {
        isi: {
          ok: true,
          data: opsi.unggah ?? {
            ok: true,
            berkas: [
              { jenis: "putusan", ok: true, jalur: "putusan/a.docx" },
              { jenis: "anonimisasi", ok: true, jalur: "anonimisasi/a.docx" },
            ],
          },
        },
      };
    }
    return naskah(url, cara, badan, ke);
  };
}

async function bukaUnggahEdoc(h: Halaman) {
  const panel = await siapA30(h, "baru");
  const bag = panel.querySelector('[data-kunci="unggahPutusanSipp"]');
  const slot = (s: string) => bag.querySelector(`input[type=file][data-slot="${s}"]`) as HTMLInputElement;
  const tombol = Array.from(bag.querySelectorAll("button")).find((b: any) => b.textContent === "Unggah edoc ke SIPP") as HTMLButtonElement;
  return { panel, bag, slot, tombol };
}

describe("butir 11: anonimisasi otomatis dalam BENTUK YANG SAMA, lalu dua slot sekaligus", () => {
  it("DOCX: K1 ke rtf -> perkara_id -> ABT anonim -> K1 ke docx -> unggah-sipp dengan KEDUA slot", async () => {
    const h = buka({ simpanan: BARU, jawab: penjawabAnonim({ abt: { bita: new TextEncoder().encode(RTF_ANONIM) } }) });
    const u = await bukaUnggahEdoc(h);
    const baris = u.bag.querySelector('[data-a30-fitur="anonim-otomatis"]');
    expect(baris.style.display).toBe("none");
    pilihBerkas(h, u.slot("putusan"), [berkas(h, "PA.Dgl_2026_Pdt.G_450_putusan_akhir.docx", "PK-docx")]);
    expect(baris.style.display).toBe("");
    expect(baris.querySelector("input").checked).toBe(true);
    expect(baris.textContent).toContain(".docx");
    u.tombol.click();
    await sampai(() => h.minta.some((m) => m.url.includes("/putusan/unggah-sipp")), "unggah-sipp");
    const urutan = h.minta
      .filter((m) => m.cara === "POST" || m.url.includes("/sidang?nomor="))
      .map((m) => (m.url.includes(KONVERSI) ? `K1:${(m.badan as any).get("ke")}` : m.url.includes(ANONIM_ABT) ? "ABT" : m.url.includes("/sidang?") ? "id" : m.url.includes("unggah-sipp") ? "unggah" : m.url));
    expect(urutan).toEqual(["K1:rtf", "id", "ABT", "K1:docx", "unggah"]);
    const abt = h.minta.find((m) => m.url.includes(ANONIM_ABT))!;
    expect(abt.url).toBe(`${ASAL}${ANONIM_ABT}`);
    expect((abt.badan as any).get("perkara_id")).toBe("4321");
    expect((abt.badan as any).get("perkara_no")).toBe(NOMOR);
    const unggah = h.minta.find((m) => m.url.includes("/putusan/unggah-sipp"))!;
    expect((unggah.badan as any).get("putusan").name).toBe("PA.Dgl_2026_Pdt.G_450_putusan_akhir.docx");
    expect((unggah.badan as any).get("anonimisasi").name).toBe("PA.Dgl_2026_Pdt.G_450_putusan_akhir - anonimisasi.docx");
    await sampai(() => /Edoc putusan dan edoc anonimisasi terunggah/.test(u.bag.textContent), "kabar sukses");
  });

  it("RTF: tanpa K1 sama sekali - ABT langsung, hasilnya RTF", async () => {
    const h = buka({ simpanan: BARU, jawab: penjawabAnonim({ abt: { bita: new TextEncoder().encode(RTF_ANONIM) } }) });
    const u = await bukaUnggahEdoc(h);
    pilihBerkas(h, u.slot("putusan"), [berkas(h, "PA.Dgl_2026_Pdt.G_450_putusan_akhir.rtf")]);
    u.tombol.click();
    await sampai(() => h.minta.some((m) => m.url.includes("/putusan/unggah-sipp")), "unggah-sipp");
    expect(h.minta.some((m) => m.url.includes(KONVERSI))).toBe(false);
    const unggah = h.minta.find((m) => m.url.includes("/putusan/unggah-sipp"))!;
    expect((unggah.badan as any).get("anonimisasi").name).toBe("PA.Dgl_2026_Pdt.G_450_putusan_akhir - anonimisasi.rtf");
  });

  it("sesi ABT tidak ada (halaman masuk): 'Masuk ABT dulu', TIDAK ada yang diunggah", async () => {
    const masuk = '<form action="http://192.168.10.10/aps_badilag/login/signin"><input type="password" name="p"></form>';
    const h = buka({ simpanan: BARU, jawab: penjawabAnonim({ abt: { bita: new TextEncoder().encode(masuk) } }) });
    const u = await bukaUnggahEdoc(h);
    pilihBerkas(h, u.slot("putusan"), [berkas(h, "PA.Dgl_2026_Pdt.G_450_putusan_akhir.rtf")]);
    u.tombol.click();
    await sampai(() => /Masuk ABT dulu/.test(u.bag.textContent), "kabar masuk ABT");
    expect(h.minta.some((m) => m.url.includes("/putusan/unggah-sipp"))).toBe(false);
    expect(u.tombol.disabled).toBe(false);
  });

  it("pemeriksa menemukan nama utuh: konfirmasi di panel; Batalkan = tidak ada yang diunggah", async () => {
    const h = buka({ simpanan: BARU, jawab: penjawabAnonim({ abt: { bita: new TextEncoder().encode(RTF_BOCOR) } }) });
    const u = await bukaUnggahEdoc(h);
    h.d.getElementById("konten")!.insertAdjacentHTML("beforeend", TABEL_TERGUGAT);
    pilihBerkas(h, u.slot("putusan"), [berkas(h, "PA.Dgl_2026_Pdt.G_450_putusan_akhir.rtf")]);
    u.tombol.click();
    const tanya = await sampai(() => u.bag.querySelector(".aleta-a30-tanya") as any, "kartu konfirmasi");
    expect(tanya.textContent).toMatch(/nama pihak "Taufik\s+Qurahman"/);
    // 12 Okt 2026: NIK disamarkan, tidak lagi ditanyakan.
    expect(tanya.textContent).not.toContain("7203111072023001");
    // 7 Okt 2026 (butir 4): nama pihak yang ditinggalkan ABT kini disamarkan
    // ALETA pada salinan anonimisasi; yang tidak dapat disamarkan tetap
    // ditanyakan. Dahulu: nama pihak "Isabella binti Muhamad Aini" ikut terdaftar.
    expect(tanya.textContent).not.toMatch(/nama pihak "Isabella/);
    expect(tanya.textContent).toMatch(/ALETA sudah menyamarkan 2 sisa yang ditinggalkan ABT/);
    // "Tetap unggah" mati sampai "Sudah saya periksa" dicentang.
    expect(tanya.querySelector(".aleta-a30-tanya-ya").disabled).toBe(true);
    tanya.querySelector(".aleta-a30-tanya-tidak").click();
    await sampai(() => /Unggah dibatalkan/.test(u.bag.textContent), "kabar batal");
    expect(h.minta.some((m) => m.url.includes("/putusan/unggah-sipp"))).toBe(false);
  });

  it("pemeriksa: dicentang lalu 'Tetap unggah' = dua slot terkirim", async () => {
    const h = buka({ simpanan: BARU, jawab: penjawabAnonim({ abt: { bita: new TextEncoder().encode(RTF_BOCOR) } }) });
    const u = await bukaUnggahEdoc(h);
    h.d.getElementById("konten")!.insertAdjacentHTML("beforeend", TABEL_TERGUGAT);
    pilihBerkas(h, u.slot("putusan"), [berkas(h, "PA.Dgl_2026_Pdt.G_450_putusan_akhir.rtf")]);
    u.tombol.click();
    const tanya = await sampai(() => u.bag.querySelector(".aleta-a30-tanya") as any, "kartu konfirmasi");
    const cek = tanya.querySelector(".aleta-a30-tanya-centang input");
    cek.checked = true;
    cek.dispatchEvent(new h.w.Event("change"));
    tanya.querySelector(".aleta-a30-tanya-ya").click();
    await sampai(() => h.minta.some((m) => m.url.includes("/putusan/unggah-sipp")), "unggah-sipp");
    const unggah = h.minta.find((m) => m.url.includes("/putusan/unggah-sipp"))!;
    expect((unggah.badan as any).has("putusan")).toBe(true);
    expect((unggah.badan as any).has("anonimisasi")).toBe(true);
    // 12 Okt 2026 (butir 19): nama yang direlakan petugas diteruskan ke server
    // ("Tetap unggah") supaya penjaga server tidak menolak nama yang sama lagi.
    expect((unggah.badan as any).get("tetapUnggah")).toBe("1");
    expect(JSON.parse((unggah.badan as any).get("tetapUnggahNama"))[0]).toMatch(/^Taufik\s+Qurahman$/);
  });

  it("centang dilepas: putusan saja, tanpa ABT", async () => {
    const h = buka({ simpanan: BARU, jawab: penjawabAnonim({ abt: { bita: new TextEncoder().encode(RTF_ANONIM) } }) });
    const u = await bukaUnggahEdoc(h);
    pilihBerkas(h, u.slot("putusan"), [berkas(h, "PA.Dgl_2026_Pdt.G_450_putusan_akhir.rtf")]);
    u.bag.querySelector('[data-a30-fitur="anonim-otomatis"] input').checked = false;
    u.tombol.click();
    await sampai(() => h.minta.some((m) => m.url.includes("/putusan/unggah-sipp")), "unggah-sipp");
    expect(h.minta.some((m) => m.url.includes(ANONIM_ABT))).toBe(false);
    const unggah = h.minta.find((m) => m.url.includes("/putusan/unggah-sipp"))!;
    expect((unggah.badan as any).has("anonimisasi")).toBe(false);
  });

  it("anonimisasi dipilih sendiri: baris otomatis tersembunyi, tidak ada ABT", async () => {
    const h = buka({ simpanan: BARU, jawab: penjawabAnonim({ abt: { bita: new TextEncoder().encode(RTF_ANONIM) } }) });
    const u = await bukaUnggahEdoc(h);
    pilihBerkas(h, u.slot("putusan"), [berkas(h, "PA.Dgl_2026_Pdt.G_450_putusan_akhir.rtf")]);
    pilihBerkas(h, u.slot("anonimisasi"), [berkas(h, "anonim 450.rtf", "{\\rtf1 lain}")]);
    expect(u.bag.querySelector('[data-a30-fitur="anonim-otomatis"]').style.display).toBe("none");
    u.tombol.click();
    await sampai(() => h.minta.some((m) => m.url.includes("/putusan/unggah-sipp")), "unggah-sipp");
    expect(h.minta.some((m) => m.url.includes(ANONIM_ABT))).toBe(false);
  });
});

// ============================================================================
describe("butir 10 & 19: simpan lebih cepat, bukti tetap; edoc sesudah Simpan terbukti", () => {
  const BELUM = { putusan: { sudahPutus: false }, putusanLengkap: {} };
  const PUTUS = { putusan: { sudahPutus: true, tanggalPutusan: "2026-09-30" }, putusanLengkap: { tanggalPutusan: "2026-09-30", statusPutusan: "Dikabulkan" } };

  function penjawabStatus(urutan: Array<typeof BELUM>, lain?: Penjawab): { jawab: Penjawab; bacaan: number[] } {
    const bacaan: number[] = [];
    const jawab: Penjawab = (url, cara, badan, ke) => {
      if (url.includes("/aleta-ecourt/status-perkara?") && url.includes(encodeURIComponent(NOMOR))) {
        bacaan.push(Date.now());
        const s = urutan[Math.min(bacaan.length - 1, urutan.length - 1)];
        return { isi: { ok: true, data: { available: true, status: s } } };
      }
      return lain ? lain(url, cara, badan, ke) : undefined;
    };
    return { jawab, bacaan };
  }

  it("Baru: tekan membawa setujuiKonfirmasi; 'sebelum' dari pemanggil tidak dibaca ulang; jajak rapat sesudah st=1", async () => {
    const st = penjawabStatus([PUTUS]);
    const h = buka({ simpanan: BARU, jawab: st.jawab, buktiSimpan: { st: 1, pesan: "Data Berhasil Disimpan" } });
    await siapA30(h, "baru");
    await tunggu(1100); // lencana status panel lewat
    h.w.muatUlangHalamanPerkara = () => undefined;
    st.bacaan.length = 0;
    const kabar = h.d.createElement("div");
    const hasil = await h.w.simpanPutusanLaluBuka(NOMOR, kabar, {
      sebelum: Promise.resolve({ sudahPutus: false, tanggal: "", status: "" }),
      jajakCepat: true,
    });
    expect(hasil.ok).toBe(true);
    const tekan = h.jembatan.filter((x) => x.jenis === "tekan");
    expect(tekan[0]).toMatchObject({ setujuiKonfirmasi: true, bukti: { borang: "#frm_putusan" } });
    // 'sebelum' dari pemanggil tidak dibaca ulang: satu-satunya bacaan status
    // adalah bacaan SESUDAH. (Bila 'sebelum' dibaca di sini, ia sudah PUTUS dan
    // bacaannya dua - lalu terbukti lewat jawaban SIPP "simpan ulang".)
    expect(st.bacaan.length).toBe(1);
    expect(hasil.bunyi).toBe("Tersimpan di SIPP.");
  });

  it("jajak cepat: sesudah SIPP menjawab tersimpan, jajak berikutnya ±400 ms, bukan 1.000 ms", async () => {
    const st = penjawabStatus([BELUM, BELUM, PUTUS]);
    const h = buka({ simpanan: BARU, jawab: st.jawab, buktiSimpan: { st: 1, pesan: "Data Berhasil Disimpan" } });
    await siapA30(h, "baru");
    await tunggu(1100);
    h.w.muatUlangHalamanPerkara = () => undefined;
    st.bacaan.length = 0;
    const hasil = await h.w.simpanPutusanLaluBuka(NOMOR, h.d.createElement("div"), {
      sebelum: Promise.resolve({ sudahPutus: false, tanggal: "", status: "" }),
      jajakCepat: true,
    });
    expect(hasil.ok).toBe(true);
    expect(st.bacaan.length).toBeGreaterThanOrEqual(2);
    const jarak = st.bacaan[1] - st.bacaan[0];
    expect(jarak).toBeGreaterThanOrEqual(350);
    expect(jarak).toBeLessThan(900);
  });

  it("antrean massal (Baru): keadaan langkah 1 dipakai ulang sebagai 'sebelum'", async () => {
    const h = buka({ simpanan: BARU });
    await siapA30(h, "baru");
    const segar = { sudahPutus: false, tanggal: "", status: "" };
    expect(h.w.a30OpsiSimpanMassal(segar)).toEqual({ sebelum: segar, jajakCepat: true });
    expect(h.w.a30OpsiSimpanMassal(null)).toEqual({ sebelum: null, jajakCepat: true });
  });

  it("butir 19: edoc diunggah SESUDAH tersimpan terbukti dan SEBELUM halaman dimuat ulang", async () => {
    const urutan: string[] = [];
    const st = penjawabStatus([PUTUS], (url) => {
      if (url.includes("/putusan/unggah-sipp")) {
        urutan.push("unggah");
        return { isi: { ok: true, data: { ok: true, berkas: [{ jenis: "putusan", ok: true, jalur: "a" }, { jenis: "anonimisasi", ok: true, jalur: "b" }] } } };
      }
      return undefined;
    });
    const h = buka({ simpanan: BARU, jawab: st.jawab, buktiSimpan: { st: 1, pesan: "Data Berhasil Disimpan" } });
    await siapA30(h, "baru");
    h.w.muatUlangHalamanPerkara = () => void urutan.push("muat-ulang");
    const kabar = h.d.createElement("div");
    const putusan = berkas(h, "putusan.docx", "PK");
    const anonim = berkas(h, "putusan - anonimisasi.docx", "PK2");
    const hasil = await h.w.simpanPutusanLaluBuka(NOMOR, kabar, {
      sebelum: Promise.resolve({ sudahPutus: false, tanggal: "", status: "" }),
      jajakCepat: true,
      sesudahTersimpan: (kb: HTMLElement) => {
        urutan.push("sesudah-tersimpan");
        return h.w.a30UnggahEdoc({ nomorPerkara: NOMOR, putusan, anonimisasi: anonim, kabar: kb });
      },
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.bunyi).toMatch(/Tersimpan di SIPP\. Edoc putusan dan edoc anonimisasi terunggah/);
    await sampai(() => urutan.includes("muat-ulang"), "muat ulang", 3000);
    expect(urutan).toEqual(["sesudah-tersimpan", "unggah", "muat-ulang"]);
  });

  it("butir 19: edoc yang gagal disiapkan tidak menahan Simpan; halaman TIDAK dimuat ulang dan sebabnya terbaca", async () => {
    const st = penjawabStatus([PUTUS], (url) => (url.includes(ANONIM_ABT) ? { bita: new TextEncoder().encode('<input type="password">') } : undefined));
    const h = buka({ simpanan: BARU, jawab: penjawabAnonimDanStatus(st.jawab), buktiSimpan: { st: 1, pesan: "Data Berhasil Disimpan" } });
    await siapA30(h, "baru");
    const muat: number[] = [];
    h.w.muatUlangHalamanPerkara = () => void muat.push(1);
    const wadah = h.d.createElement("div");
    const opsi = await h.w.a30OpsiSimpanPutusan({
      nomorPerkara: NOMOR,
      kabar: wadah,
      wadah,
      sebelum: Promise.resolve({ sudahPutus: false, tanggal: "", status: "" }),
      edoc: { asli: berkas(h, "putusan.rtf"), rtf: null },
    });
    expect(typeof opsi.sesudahTersimpan).toBe("function");
    const hasil = await h.w.simpanPutusanLaluBuka(NOMOR, wadah, opsi);
    expect(hasil.ok).toBe(true);
    expect(hasil.bunyi).toMatch(/Edoc TIDAK diunggah - Masuk ABT dulu/);
    expect(hasil.bunyi).toMatch(/Halaman TIDAK dimuat ulang/);
    await tunggu(1100);
    expect(muat).toEqual([]);
    expect(h.minta.some((m) => m.url.includes("/putusan/unggah-sipp"))).toBe(false);
  });
});

function penjawabAnonimDanStatus(status: Penjawab): Penjawab {
  const anon = penjawabAnonim({ abt: { bita: new TextEncoder().encode(RTF_ANONIM) } });
  return (url, cara, badan, ke) => status(url, cara, badan, ke) ?? anon(url, cara, badan, ke);
}

// ============================================================================
// jembatan.js: konfirmasi Simpan SIPP di-OK-kan HANYA selama tekanan ALETA
function bukaJembatan() {
  const dom = new JSDOM(
    '<!doctype html><html><body><form id="frm_putusan" action="/x"><input type="submit" id="simpan" value="Simpan"></form></body></html>',
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only" }
  );
  terbuka.push(dom);
  const w = dom.window as any;
  if (!w.CSS) w.CSS = { escape: (s: string) => String(s) };
  Object.defineProperty(w.HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get(this: HTMLElement) {
      return this.ownerDocument.body;
    },
  });
  const jawaban: any[] = [];
  w.postMessage = (data: unknown) => void jawaban.push(data);
  const ditanya: string[] = [];
  const asli = (pesan: string) => {
    ditanya.push(pesan);
    return false; // petugas menekan Cancel
  };
  w.confirm = asli;
  const hasilKonfirmasi: boolean[] = [];
  const borang = w.document.querySelector("#frm_putusan");
  // Tiruan SubmitHandling (jquery-sipp.js): confirm SERENTAK di dalam submit.
  borang.addEventListener("submit", (e: Event) => {
    e.preventDefault();
    hasilKonfirmasi.push(w.confirm("Apakah Anda Yakin Akan Menyimpan Data"));
    // Konfirmasi lain di halaman yang sama tidak ikut disetujui.
    hasilKonfirmasi.push(w.confirm("Apakah Anda Yakin Akan Menghapus Data"));
  });
  w.eval(JEMBATAN());
  let urut = 0;
  const minta = (pesan: Record<string, unknown>) => {
    urut += 1;
    const id = `uji-${urut}`;
    w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan", id, ...pesan }, source: w }));
    return jawaban.find((x) => x.id === id);
  };
  return { w, asli, ditanya, hasilKonfirmasi, minta };
}

describe("butir 10: jembatan menyetujui konfirmasi Simpan HANYA selama tekanan ALETA", () => {
  it("dengan setujuiKonfirmasi: kalimat Simpan disetujui, konfirmasi lain diteruskan, confirm dikembalikan", () => {
    const j = bukaJembatan();
    const jawab = j.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan", bukti: { borang: "#frm_putusan", id: "b1" }, setujuiKonfirmasi: true });
    expect(jawab).toMatchObject({ ok: true, konfirmasi: "disetujui" });
    expect(j.hasilKonfirmasi).toEqual([true, false]);
    expect(j.ditanya).toEqual(["Apakah Anda Yakin Akan Menghapus Data"]);
    expect(j.w.confirm).toBe(j.asli);
  });

  it("tanpa setujuiKonfirmasi (tekanan biasa / Lama): confirm asli yang menjawab, jawaban tanpa ruas konfirmasi", () => {
    const j = bukaJembatan();
    const jawab = j.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan", bukti: { borang: "#frm_putusan", id: "b2" } });
    expect(jawab.ok).toBe(true);
    expect(jawab).not.toHaveProperty("konfirmasi");
    expect(j.hasilKonfirmasi).toEqual([false, false]);
    expect(j.ditanya).toEqual(["Apakah Anda Yakin Akan Menyimpan Data", "Apakah Anda Yakin Akan Menghapus Data"]);
  });

  it("tekanan ORANG sesudah tekanan ALETA kembali ditanyai - penggantinya tidak tertinggal", () => {
    const j = bukaJembatan();
    j.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan", setujuiKonfirmasi: true });
    j.hasilKonfirmasi.length = 0;
    j.ditanya.length = 0;
    (j.w.document.querySelector("#simpan") as HTMLElement).click();
    expect(j.hasilKonfirmasi).toEqual([false, false]);
    expect(j.ditanya).toContain("Apakah Anda Yakin Akan Menyimpan Data");
  });
});

// ============================================================================
describe("pemeriksa anonim dan pembaca RTF", () => {
  it("teks RTF: tabel huruf dan tujuan \\* dibuang, \\'hh dan \\uN dibaca", async () => {
    const h = buka({ simpanan: BARU });
    await siapA30(h, "baru");
    const teks = h.w.a30TeksRtf("{\\rtf1{\\fonttbl{\\f0 Arial;}}{\\*\\generator Word;}Ba\\'e9 \\u8211? x\\par y}");
    expect(teks).toBe("Baé – x\ny");
  });

  it("NIK 16 angka, nama pihak (juga tanpa bin/binti), dan alamat jalan/desa dikenali", async () => {
    const h = buka({ simpanan: BARU });
    await siapA30(h, "baru");
    const hasil = h.w.a30PeriksaAnonim("NIK 7203111072023001, Isabella tinggal di Dusun Tiga Tamarenja", {
      nama: [{ teks: "Isabella binti Muhamad Aini", dari: "SIPP" }, { teks: "Isabella", dari: "SIPP" }],
      alamat: [{ teks: "Dusun Tiga Tamarenja", dari: "SIPP" }],
    });
    expect(hasil.temuan.map((t: any) => t.jenis)).toEqual(["NIK", "nama pihak", "alamat"]);
    const bersih = h.w.a30PeriksaAnonim("Penggugat ( xxx ) melawan Tergugat ( xxx ); 123456789012345", {
      nama: [{ teks: "Isabella", dari: "SIPP" }],
      alamat: [],
    });
    expect(bersih.temuan).toEqual([]);
  });

  it("data pribadi dibaca dari tabel pihak SIPP dan dari konteks ALETA", async () => {
    const h = buka({ simpanan: BARU });
    await siapA30(h, "baru");
    // Tabel pihak ditambahkan sesudah panel tertata - seperti tab Data Umum SIPP yang dimuat belakangan.
    h.d.getElementById("konten")!.insertAdjacentHTML(
      "beforeend",
      "<table><tr><td>No</td><td>Penggugat</td><td>Tergugat</td></tr><tr><td>1</td><td>Budi Santoso bin Ahmad</td><td>Taufik Qurahman bin Dasril</td></tr></table>" +
        "<table><tr><td>Alamat</td><td>Dusun II, Desa Tamarenja, Kecamatan Sindue</td></tr></table>"
    );
    const data = h.w.a30DataPribadiHalaman();
    const nama = data.nama.map((x: any) => x.teks);
    expect(nama).toContain("Isabella binti Muhamad Aini"); // dari konteks ALETA (nomorPihak)
    expect(nama).toContain("Isabella");
    expect(nama).toContain("Budi Santoso bin Ahmad");
    expect(nama).toContain("Taufik Qurahman");
    expect(data.alamat.map((x: any) => x.teks)).toEqual(["Dusun II", "Desa Tamarenja"]);
  });

});

// ============================================================================
describe("tidak ada jalur tulis SIPP baru dari blok perbaikan 30 Sep", () => {
  const konten = KONTEN();
  // Disesuaikan perbaikan 1 Okt (agen S): blok 1 Okt ditulis SESUDAH blok ini
  // di ujung konten.js dan membawa bacaan jembatannya sendiri (bacaan
  // praperiksa serentak, butir 12) serta POST e-Court (K6). Potongannya
  // diakhiri di penanda blok 1 Okt supaya uji ini tetap menjaga blok 30 Sep
  // saja; blok 1 Okt dijaga sendiri di ekstensi-sipp-1okt.test.ts.
  const mulaiBlok = konten.indexOf("PERBAIKAN 30 SEPTEMBER 2026 - PANEL SIPP");
  const akhirBlok = konten.indexOf("PERBAIKAN 1 OKTOBER 2026 - PANEL SIPP");
  const blok = konten.slice(mulaiBlok, akhirBlok > mulaiBlok ? akhirBlok : undefined);

  it("blok ini tidak mengirim pesan ke jembatan sendiri", () => {
    expect(blok.length).toBeGreaterThan(1000);
    expect(blok).not.toMatch(/kirimKeJembatan(Langsung)?\(/);
    expect(blok).not.toMatch(/postMessage\(/);
  });

  it("non-GET-nya hanya K1 (konversi-naskah) dan anonim ABT; unggah lewat kirimBadanUnggahSipp yang sudah ada", () => {
    expect((blok.match(/method:\s*"[A-Z]+"/g) || []).length).toBe(2);
    expect(blok).toContain('const A30_API_KONVERSI = "/aleta/api/aleta-ecourt/putusan/konversi-naskah";');
    expect(blok).toContain("`${location.origin}/aps_badilag/abt/main/anonim`");
    expect(blok).toContain("await kirimBadanUnggahSipp(badan,");
    expect(blok).not.toMatch(/\/aleta\/api\/aleta-ecourt\/putusan\/unggah-sipp/);
  });

  it("uji ini memuat panel-alat.js yang sama dengan ekstensi (tidak ada salinan)", () => {
    expect(ALAT).toContain("function alatUjiMode()");
  });
});
