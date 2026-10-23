// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * 23 OKT 2026 - CHECKLIST MILESTONE, KEHADIRAN SIDANG, DRAF PUTUSAN: TERSEMBUNYI BAWAAN
 * ============================================================================
 *
 * Pengguna: "checklist milestone itu hide defaultnya di semua aleta, sipp dan abt serta e-keuangan (sama juga
 * kehadiran para pihak dan draf putusan)".
 *
 *   1. Tiga bagian tidak tampil sama sekali saat halaman dimuat - di SIPP, ABT, portal ALETA, dan halaman lain
 *      mana pun tempat checklist.js dimuat (e-Keuangan bila kelak dimuat). Yang tampak hanya gelembung ALETA.
 *   2. Dibuka dari gelembung (menu kecil) dengan satu pilihan; bertahan selama halaman (data diperbarui, saklar
 *      lain berubah); muat ulang -> tersembunyi lagi; kotak punya × yang menyembunyikannya.
 *   3. Yang mendesak di kotak tersembunyi tetap terbaca: titik kecil di gelembung.
 *   4. Setelan tersimpan (saklar popup, posisi) tidak ditulis ulang.
 *   5. Popup ekstensi dapat membuka bagian itu di tab aktif (pesan ke checklist.js).
 */

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
type Jendela = any;
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

const API_KH = "/aleta/api/aleta-ecourt/antrian/kehadiran-saya";
const API_H7 = "/aleta/api/aleta-ecourt/agen-h7/saya";
const API_CHECKLIST = "/aleta/api/aleta-ecourt/checklist";

const JAWABAN_CHECKLIST = {
  ok: true,
  data: {
    pengguna: { nama: "PP Dua", peran: ["pp"], superAdmin: false },
    peranTersedia: [{ kunci: "pp", label: "Panitera Pengganti" }],
    peranAktif: "pp",
    dibuat: new Date().toISOString(),
    ringkas: { lewat: 0, hariIni: 0, mingguIni: 0, selesaiHariIni: 0, totalHariIni: 0 },
    butir: [],
    jenisTidakTersedia: [],
    galat: [],
  },
};
const KH_TENANG = { ok: true, data: { ok: true, jumlah: 1, perkara: [{ perkaraId: "11", nomorPerkara: "11/Pdt.G/2026/PA.Dgl", jam: "09:00", ruangan: "R1", nomorAntrian: 3, sedangDisidang: false, ringkas: [{ teks: "Penggugat hadir 08.47", nada: "hijau", judul: "" }] }] } };
const KH_MERAH = { ok: true, data: { ok: true, jumlah: 1, perkara: [{ perkaraId: "11", nomorPerkara: "11/Pdt.G/2026/PA.Dgl", jam: "09:00", ruangan: "R1", nomorAntrian: 3, sedangDisidang: false, ringkas: [{ teks: "Tergugat belum hadir", nada: "merah", judul: "" }] }] } };
const H7_AMAN = { ok: true, data: { ok: true, jumlah: 1, perkara: [{ perkaraId: "12", nomorPerkara: "12/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-30", sisaHari: 7, tingkat: "siap", persen: 100, perlu: [], lencana: "Draf H-7 100%" }] } };
const H7_MENDESAK = { ok: true, data: { ok: true, jumlah: 1, perkara: [{ perkaraId: "12", nomorPerkara: "12/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-24", sisaHari: 1, tingkat: "belum", persen: 20, perlu: ["Pertimbangan"], lencana: "Draf H-7 20%" }] } };

type Pilihan = { url?: string; kh?: unknown; h7?: unknown };

function bukaWidget(awal: Record<string, unknown>, pilihan: Pilihan = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: pilihan.url ?? "http://192.168.10.10/SIPP/detil_perkara_agama",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]) as JSDOM & { getInternalVMContext(): vm.Context };
  terbuka.push(dom);
  const w = dom.window as Jendela;
  // Posisi dengan kecil:false = sisa pilihan lama "terbentang"; tidak boleh lagi menampilkan apa pun.
  const simpanan: Record<string, unknown> = polos({
    ujiTampilan: "ui",
    checklistMilestone: true,
    posisiChecklistSipp: { kecil: false },
    posisiChecklistAbt: { kecil: false },
    posisiChecklistAleta: { kecil: false },
    ...awal,
  });
  const ditulis: string[] = [];
  const pendengar: Array<(u: Ubah, wil: string) => void> = [];
  const pesanMasuk: Array<(pesan: unknown, pengirim: unknown, balas: (x: unknown) => void) => unknown> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "0.0.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async () => ({}),
      onMessage: { addListener: (f: (typeof pesanMasuk)[number]) => void pesanMasuk.push(f) },
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
          const ubah: Ubah = {};
          for (const [k, v] of Object.entries(isi)) {
            ditulis.push(k);
            ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
            simpanan[k] = polos(v);
          }
          setTimeout(() => pendengar.forEach((f) => f(polos(ubah), "local")), 0);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, wil: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: string[] = [];
  const jawab = (isi: unknown) => {
    const r = { ok: true, status: 200, json: async () => polos(isi), clone: () => r };
    return r;
  };
  w.fetch = (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    if (url.includes(API_KH)) return Promise.resolve(jawab(pilihan.kh ?? KH_TENANG));
    if (url.includes(API_H7)) return Promise.resolve(jawab(pilihan.h7 ?? H7_AMAN));
    if (url.includes(API_CHECKLIST)) return Promise.resolve(jawab(JAWABAN_CHECKLIST));
    return Promise.resolve(jawab({ ok: true, data: {} }));
  };
  const ctx = dom.getInternalVMContext();
  vm.runInContext(baca("panel-alat.js"), ctx, { filename: "panel-alat.js" });
  vm.runInContext(baca("checklist.js"), ctx, { filename: "checklist.js" });
  const akar = () => w.document.querySelector("aleta-cm-widget") as HTMLElement | null;
  const q = (p: string) => {
    const a = akar();
    return a && a.shadowRoot ? (a.shadowRoot.querySelector(p) as HTMLElement | null) : null;
  };
  const qs = (p: string) => {
    const a = akar();
    return (a && a.shadowRoot ? Array.from(a.shadowRoot.querySelectorAll(p)) : []) as HTMLElement[];
  };
  return {
    w,
    q,
    qs,
    minta,
    ditulis,
    simpanan,
    pesanMasuk,
    ubah: (isi: Record<string, unknown>) => w.chrome.storage.local.set(isi),
    /** Kirim pesan seperti popup: jawaban sinkron dari pendengar. */
    kirimPesan: (pesan: unknown) => {
      let jawaban: unknown;
      for (const f of pesanMasuk) f(pesan, {}, (x) => (jawaban = x));
      return jawaban as { ok: boolean } | undefined;
    },
  };
}
type H = ReturnType<typeof bukaWidget>;

/** Tunggu data kehadiran dan draf terbaca (kotaknya sendiri tersembunyi, jadi dibaca dari permintaannya). */
async function siapData(h: H) {
  await sampai(() => h.minta.some((a) => a.includes(API_KH)) && h.minta.some((a) => a.includes(API_H7)), "data kehadiran dan draf diminta");
  await tunggu(80);
}
const bukaMenu = async (h: H) => {
  (await sampai(() => h.q(".aleta-cmw-lencana"), "gelembung")).click();
  return sampai(() => h.q("[data-menu-gelembung]"), "menu gelembung");
};
const pilih = (h: H, bagian: string) => (h.q(`[data-menu-bagian="${bagian}"]`) as HTMLElement).click();
const TIGA = ["[data-kehadiran-widget]", "[data-draf-h7-widget]", '[aria-label="Checklist milestone"]'];

describe("1. tersembunyi saat halaman dimuat - di semua tempat widget dipasang", () => {
  const tempat: Array<[string, string]> = [
    ["SIPP", "http://192.168.10.10/SIPP/detil_perkara_agama"],
    ["ABT", "http://192.168.10.10/aps_badilag/abt/index.php"],
    ["portal ALETA", "http://192.168.10.10/aleta/jadwal-sidang"],
    ["e-Keuangan (bila kelak dimuat)", "http://192.168.10.10/e-keuangan/beranda"],
  ];
  for (const [nama, url] of tempat) {
    it(`${nama}: hanya gelembung ALETA; tidak ada checklist, kehadiran, maupun draf putusan - walau posisi lama tersimpan 'terbentang'`, async () => {
      const h = bukaWidget({}, { url });
      await sampai(() => h.q(".aleta-cmw-lencana"), "gelembung");
      await siapData(h);
      for (const p of TIGA) expect(h.q(p), p).toBeNull();
      expect(h.q(".aleta-cm, .aleta-cmw-kotak, [data-menu-gelembung]")).toBeNull();
      expect(h.q('.aleta-cmw-dok[data-dok="ciut"]')).not.toBeNull();
    });
  }

  it("Checklist milestone MATI: kotak sidang juga tersembunyi - gelembung tetap ada untuk membukanya", async () => {
    const h = bukaWidget({ checklistMilestone: false });
    await sampai(() => h.q(".aleta-cmw-lencana"), "gelembung tanpa checklist");
    await siapData(h);
    expect(h.q("[data-kehadiran-widget]")).toBeNull();
    expect(h.q("[data-draf-h7-widget]")).toBeNull();
    expect(h.minta.some((a) => a.includes(API_CHECKLIST))).toBe(false);
    await bukaMenu(h);
    expect(h.qs("[data-menu-bagian]").map((b) => b.getAttribute("data-menu-bagian"))).toEqual(["kehadiran", "drafH7"]);
  });

  it("semua saklar mati: tidak ada widget sama sekali (tidak ada yang bisa dibuka)", async () => {
    const h = bukaWidget({ checklistMilestone: false, widgetKehadiran: false, widgetDrafH7: false });
    await tunggu(300);
    expect(h.w.document.querySelector("aleta-cm-widget")).toBeNull();
  });

  it("tampilan Lama TIDAK berubah (syarat mutlak Lama): mengikuti kecil/terbentang yang tersimpan; pil dibentangkan lewat klik, – kembali ke pil", async () => {
    const terbentang = bukaWidget({ ujiTampilan: "lama" }); // posisi tersimpan kecil:false -> panel, seperti sebelum aturan ini
    await sampai(() => terbentang.q(".aleta-cm[aria-label='Checklist milestone']"), "panel Lama terbentang");
    const h = bukaWidget({ ujiTampilan: "lama", posisiChecklistSipp: { kecil: true } });
    const pil = await sampai(() => h.q(".aleta-cm-pil"), "pil Lama");
    expect(h.q(".aleta-cm")).toBeNull();
    pil.click();
    await sampai(() => h.q(".aleta-cm"), "panel Lama sesudah klik");
    (h.q(".aleta-cm-kecilkan") as HTMLElement).click();
    await sampai(() => h.q(".aleta-cm-pil") && !h.q(".aleta-cm"), "pil lagi");
  });
});

describe("2. dibuka dari gelembung, bertahan selama halaman, muat ulang -> tersembunyi", () => {
  it("satu klik gelembung -> menu tiga pilihan; satu pilihan -> hanya kotak itu tampil, terbentang, menu menutup", async () => {
    const h = bukaWidget({});
    await siapData(h);
    await bukaMenu(h);
    expect(h.qs("[data-menu-bagian]").map((b) => b.getAttribute("data-menu-bagian"))).toEqual(["checklist", "kehadiran", "drafH7"]);
    pilih(h, "kehadiran");
    const kotak = await sampai(() => h.q("[data-kehadiran-widget]"), "kotak kehadiran");
    expect(kotak.getAttribute("data-terbuka")).toBe("ya");
    expect(h.q("[data-menu-gelembung]")).toBeNull();
    expect(h.q("[data-draf-h7-widget]")).toBeNull();
    expect(h.q('[aria-label="Checklist milestone"]')).toBeNull();
    expect(kotak.textContent).toContain("11/Pdt.G/2026/PA.Dgl");
    // Gelembung tetap ada untuk memilih yang lain.
    await bukaMenu(h);
    pilih(h, "drafH7");
    await sampai(() => h.q("[data-draf-h7-widget]"), "kotak draf");
    expect(h.q("[data-kehadiran-widget]")).not.toBeNull();
  });

  it("checklist dibuka dari menu", async () => {
    const h = bukaWidget({});
    await bukaMenu(h);
    pilih(h, "checklist");
    await sampai(() => h.q(".aleta-cm[aria-label='Checklist milestone']"), "panel checklist");
    expect(h.q("[data-kehadiran-widget]")).toBeNull();
  });

  it("bertahan saat data diperbarui dan saat setelan lain berubah; × menyembunyikan lagi", async () => {
    const h = bukaWidget({});
    await bukaMenu(h);
    pilih(h, "drafH7");
    await sampai(() => h.q("[data-draf-h7-widget]"), "kotak draf");
    await h.ubah({ widgetKehadiran: true });
    await tunggu(120);
    expect(h.q("[data-draf-h7-widget]")).not.toBeNull();
    // Penggambaran ulang karena data (kehadiran diminta lagi) pun tidak menutupnya.
    h.w.document.dispatchEvent(new h.w.Event("visibilitychange"));
    await tunggu(80);
    expect(h.q("[data-draf-h7-widget]")).not.toBeNull();
    (h.q("[data-draf-h7-widget] .aleta-cmw-tutup-kotak") as HTMLElement).click();
    await sampai(() => h.q("[data-draf-h7-widget]") === null, "kotak draf hilang");
    expect(h.q(".aleta-cmw-lencana")).not.toBeNull();
    expect(h.q('.aleta-cmw-dok[data-dok="ciut"]')).not.toBeNull();
  });

  it("'Sembunyikan semua' di menu dan tombol – di checklist menyembunyikan semuanya", async () => {
    const h = bukaWidget({});
    await bukaMenu(h);
    pilih(h, "kehadiran");
    await sampai(() => h.q("[data-kehadiran-widget]"), "kotak");
    await bukaMenu(h);
    (h.q(".aleta-cmw-menu-sembunyi") as HTMLElement).click();
    await sampai(() => h.q("[data-kehadiran-widget]") === null, "tersembunyi");
    await bukaMenu(h);
    pilih(h, "checklist");
    await sampai(() => h.q(".aleta-cm-kecilkan"), "panel dengan tombol –");
    (h.q(".aleta-cm-kecilkan") as HTMLElement).click();
    await sampai(() => h.q(".aleta-cm") === null, "panel hilang");
    expect(h.q(".aleta-cmw-lencana")).not.toBeNull();
  });

  it("muat halaman baru -> tersembunyi lagi (pilihan hanya hidup di halaman itu), dan tidak ada yang tertulis ke penyimpanan", async () => {
    const h = bukaWidget({});
    // panel-alat.js menyinggahkan tampilanServer sendiri; yang dijaga: setelan milik widget ini.
    const milikWidget = (x: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => k !== "tampilanServer")));
    const sebelum = milikWidget(h.simpanan);
    await bukaMenu(h);
    pilih(h, "kehadiran");
    await sampai(() => h.q("[data-kehadiran-widget]"), "kotak");
    await tunggu(100);
    // Saklar popup dan posisi tidak disentuh (posisi hanya ditulis saat digeser).
    expect(h.ditulis.filter((k) => ["checklistMilestone", "widgetKehadiran", "widgetDrafH7"].includes(k))).toEqual([]);
    expect(milikWidget(h.simpanan)).toBe(sebelum);
    // "Muat ulang": halaman baru dengan penyimpanan yang sama.
    const baru = bukaWidget(JSON.parse(sebelum));
    await sampai(() => baru.q(".aleta-cmw-lencana"), "gelembung halaman baru");
    await siapData(baru);
    expect(baru.q("[data-kehadiran-widget]")).toBeNull();
  });

  it("klik di luar widget menutup menu", async () => {
    const h = bukaWidget({});
    await bukaMenu(h);
    h.w.document.body.dispatchEvent(new h.w.Event("pointerdown", { bubbles: true, composed: true }));
    await sampai(() => h.q("[data-menu-gelembung]") === null, "menu tertutup");
    expect(h.q(".aleta-cmw-lencana")).not.toBeNull();
  });

  it("saklar kehadiran dimatikan di popup: barisnya hilang dari menu", async () => {
    const h = bukaWidget({ widgetKehadiran: false });
    await sampai(() => h.minta.some((a) => a.includes(API_H7)), "draf diminta");
    await bukaMenu(h);
    expect(h.qs("[data-menu-bagian]").map((b) => b.getAttribute("data-menu-bagian"))).toEqual(["checklist", "drafH7"]);
  });
});

describe("3. yang mendesak tetap terbaca: titik di gelembung", () => {
  it("kehadiran berketerangan merah dan draf yang belum siap padahal tinggal 1 hari: titik di gelembung, hilang saat kotaknya dibuka", async () => {
    const h = bukaWidget({}, { kh: KH_MERAH, h7: H7_MENDESAK });
    await siapData(h);
    const titik = await sampai(() => h.q(".aleta-cmw-lencana [data-titik-mendesak]"), "titik mendesak");
    expect(titik.getAttribute("data-nada")).toBe("lewat");
    expect((h.q(".aleta-cmw-lencana") as HTMLElement).title).toContain("Perlu dicek: 1 sidang, 1 draf putusan");
    await bukaMenu(h);
    expect(h.q('[data-menu-bagian="drafH7"] .aleta-cmw-menu-ket')!.textContent).toBe("1 perkara");
    pilih(h, "kehadiran");
    await sampai(() => h.q("[data-kehadiran-widget]"), "kotak kehadiran");
    // Draf masih tersembunyi: titiknya tinggal untuk draf.
    expect((h.q(".aleta-cmw-lencana") as HTMLElement).title).toContain("Perlu dicek: 1 draf putusan");
    await bukaMenu(h);
    pilih(h, "drafH7");
    await sampai(() => h.q("[data-draf-h7-widget]"), "kotak draf");
    expect(h.q(".aleta-cmw-lencana [data-titik-mendesak]")).toBeNull();
  });

  it("tidak ada yang mendesak: tidak ada titik", async () => {
    const h = bukaWidget({}, { kh: KH_TENANG, h7: H7_AMAN });
    await siapData(h);
    expect(h.q(".aleta-cmw-lencana [data-titik-mendesak]")).toBeNull();
  });
});

describe("4. popup ekstensi: Tampilkan di halaman ini", () => {
  it("pesan dari popup menampilkan bagian yang diminta bila saklarnya menyala; selain itu ditolak", async () => {
    const h = bukaWidget({ widgetKehadiran: false });
    await sampai(() => h.q(".aleta-cmw-lencana"), "gelembung");
    expect(h.pesanMasuk.length).toBeGreaterThanOrEqual(1); // 23 Okt: pusat tema (W66) ikut mendengar pesan
    expect(h.kirimPesan({ jenis: "aleta-widget-tampilkan", bagian: "kehadiran" })).toEqual({ ok: false, alasan: "tidak-tersedia" });
    expect(h.kirimPesan({ jenis: "lain", bagian: "drafH7" })).toBeUndefined();
    expect(h.kirimPesan({ jenis: "aleta-widget-tampilkan", bagian: "entah" })).toEqual({ ok: false, alasan: "bagian-tidak-dikenal" });
    expect(h.kirimPesan({ jenis: "aleta-widget-tampilkan", bagian: "drafH7" })).toEqual({ ok: true });
    await sampai(() => h.q("[data-draf-h7-widget]"), "kotak draf dari popup");
    expect(h.q("[data-kehadiran-widget]")).toBeNull();
  });

  it("popup.html: tiga tombol 'Tampilkan di halaman ini' di bagian Widget, tersembunyi di tampilan Lama", () => {
    const html = baca("popup.html");
    const blok = /<div class="skala" id="bukaWidgetHalaman" hidden>[\s\S]*?<\/div>\s*<p id="bukaWidgetKabar"/.exec(html);
    expect(blok).not.toBeNull();
    for (const b of ["checklist", "kehadiran", "drafH7"]) expect(blok![0]).toContain(`data-buka-widget="${b}"`);
    const js = baca("popup.js");
    expect(js).toContain('unsur: ["bukaWidgetHalaman"]');
    expect(js).toContain('"aleta-widget-tampilkan"');
  });
});

describe("5. cakupan", () => {
  it("checklist.js dimuat di SIPP, ABT, dan portal ALETA - bukan di e-Keuangan (manifest tidak menyebutnya)", () => {
    const manifest = JSON.parse(baca("manifest.json")) as {
      host_permissions: string[];
      content_scripts: Array<{ matches: string[]; js: string[] }>;
    };
    const pakai = manifest.content_scripts.filter((c) => c.js.includes("checklist.js")).flatMap((c) => c.matches);
    expect(pakai.some((m) => m.includes("/SIPP/"))).toBe(true);
    expect(pakai.some((m) => m.includes("/aps_badilag/"))).toBe(true);
    expect(pakai.some((m) => m.includes("/aleta/"))).toBe(true);
    expect(JSON.stringify(manifest).toLowerCase()).not.toContain("keuangan");
  });

  it("tidak ada gaya baru yang di bawah 11.5px dan tidak ada warna mentah pada gaya menu", () => {
    const sumber = baca("checklist.js");
    const awal = sumber.indexOf(".aleta-cmw-lencana-titik {");
    const akhir = sumber.indexOf("Butir 3 (6 Okt): indikator sumber daya");
    const gaya = sumber.slice(awal, akhir);
    const ukuran = [...gaya.matchAll(/font-size:\s*calc\((\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(ukuran.length).toBeGreaterThan(3);
    expect(Math.min(...ukuran)).toBeGreaterThanOrEqual(11.5);
    expect(gaya).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
