// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * INDIKATOR SUMBER DAYA DI WIDGET (butir 3, 6 Oktober 2026)
 * ============================================================================
 *
 * panel-alat.js dan checklist.js UTUH di jsdom beralamat SIPP; portal ditiru
 * di fetch. Yang dijaga:
 *
 *   - Lama: tidak ada strip dan tidak ada SATU pun permintaan sumber daya,
 *     walau saklar portal-7 tersimpan menyala;
 *   - Baru: hanya dengan saklar portal-7; UI Baru: tanpa saklar, di samping
 *     lencana dok;
 *   - warna titik = warna dari portal; klik titik/chip = beralih ALETA <->
 *     seluruh server (diingat), isinya diperbarui DI TEMPAT;
 *   - "Rincian ›" hanya bila bolehRinci, menuju /aleta/admin/sumber-daya;
 *   - tab tersembunyi: detak berhenti tanpa meminta; 403: strip hilang dan
 *     tidak bertanya lagi.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_CHECKLIST = baca("checklist.js");

const ASAL = "http://192.168.10.10";
const API_CHECKLIST = "/aleta/api/aleta-ecourt/checklist";
const API_SD = "/aleta/api/aleta-ecourt/sumber-daya";
const SEMUA_POPUP = Array.from({ length: 30 }, (_, i) => `popup-${i + 1}`);

type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };
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

function jawabanChecklist() {
  const t = new Date();
  t.setHours(16, 0, 0, 0);
  return {
    ok: true,
    data: {
      pengguna: { nama: "Admin Uji", peran: ["hakim"], superAdmin: true },
      peranTersedia: [{ kunci: "hakim", label: "Hakim" }],
      peranAktif: "hakim",
      dibuat: new Date().toISOString(),
      ringkas: { lewat: 0, hariIni: 1, mingguIni: 0, selesaiHariIni: 0, totalHariIni: 1 },
      butir: [
        {
          id: "h1",
          jenis: "sidang",
          judul: "Sidang hari ini",
          perkara: { id: 1, nomor: "1/Pdt.G/2026/PA.Dgl" },
          tenggat: t.toISOString(),
          kelompok: "hari-ini",
          keterangan: "",
          kerjakan: { tujuan: "aleta", alamat: "/aleta-ecourt" },
        },
      ],
      jenisTidakTersedia: [],
      galat: [],
    },
  };
}

const keping = (persen: number | null, warna: string, lain: Record<string, unknown> = {}) => ({ byte: 1, totalByte: 2, persen, warna, ...lain });
function jawabanSd(bolehRinci = true) {
  return {
    ok: true,
    data: {
      diukurPada: "2026-10-06T05:36:48.000Z",
      ringkas: {
        aleta: {
          ram: keping(42.4, "hijau"),
          // 12OKT-N: CPU (agen J) - laju, persen dari seluruh kapasitas server.
          cpu: { persen: 37.5, warna: "hijau", inti: 4, intiTerpakai: 1.5, beban: null, jendelaDetik: 5 },
          disk: keping(81, "kuning", { sebagian: true }),
          gpu: { ada: false, persen: null, warna: "kelabu", keterangan: "Tidak ada GPU di server ini." },
        },
        server: {
          ram: keping(93.2, "merah"),
          // Sudut pandang server: belum terbaca (persen null) -> kelabu "–", bukan 0%.
          cpu: { persen: null, warna: "merah", inti: 4, intiTerpakai: null, beban: { m1: 0.52, m5: 0.61, m15: 0.7 }, jendelaDetik: null },
          disk: keping(60.6, "hijau", { partisi: "/home" }),
          gpu: { ada: false, persen: null, warna: "kelabu", keterangan: "Tidak ada GPU di server ini." },
        },
      },
      bolehRinci,
      alamatRinci: "/admin/sumber-daya",
    },
  };
}

type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;

function penyimpananTiruan(awal: Record<string, unknown>) {
  const simpanan: Record<string, unknown> = polos(awal);
  const pendengar: Array<(ubah: Ubah, wilayah: string) => void> = [];
  const tulisan: string[] = [];
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
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async (kunci: string | string[]) => {
      for (const k of [kunci].flat()) {
        tulisan.push(`-${k}`);
        delete simpanan[k];
      }
    },
  };
  return {
    simpanan,
    tulisan,
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (ubah: Ubah, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
}

function tanggapan(status: number, isi: unknown) {
  const r = { ok: status >= 200 && status < 300, status, json: async () => polos(isi), clone: () => r };
  return r;
}

type Halaman = {
  dom: JsdomUji;
  w: any;
  simpanan: Record<string, unknown>;
  tulisan: string[];
  sd: string[];
  /** Alamat denyut yang diminta (performa muat 19 Okt). */
  denyut: string[];
  jam: Array<{ ms: number; f: () => void }>;
  setelJawabSd: (f: () => { status: number; isi: unknown }) => void;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(simpananAwal: Record<string, unknown>, opsi: { denyut?: boolean } = {}): Halaman {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]) as JsdomUji;
  terbuka.push(dom);
  const w = dom.window as any;
  // 12 Okt: widget BAWAAN TERTUTUP bagi sesi tanpa posisi tersimpan; uji ini menguji isi yang
  // terbentang, jadi dimulai dari posisi tersimpan "terbentang" kecuali berkas ini menyebutnya.
  const awalSimpanan: Record<string, unknown> = { ...simpananAwal };
  for (const k of ["posisiChecklistSipp", "posisiChecklistAbt", "posisiChecklistAleta"]) {
    if (!(k in awalSimpanan)) awalSimpanan[k] = { kecil: false };
  }
  // 21 Okt 2026: widget terbentang hanya bila dibentangkan pada SESI TAB ini (panel-alat.js alatPanelTerbuka
  // sesiTab) - posisi "terbentang" yang tersimpan saja tidak lagi membentangkannya di tab baru.
  if (["posisiChecklistSipp", "posisiChecklistAbt", "posisiChecklistAleta"].some((k) => (awalSimpanan[k] as { kecil?: boolean } | undefined)?.kecil === false)) {
    w.sessionStorage.setItem("aleta-panel-terbuka:checklist-widget", "1");
  }
  const { simpanan, tulisan, storage } = penyimpananTiruan(awalSimpanan);
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "0.0.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async () => ({}),
    },
    storage,
  };
  const sd: string[] = [];
  const denyut: string[] = [];
  let jawabSd = () => ({ status: 200, isi: jawabanSd() as unknown });
  w.fetch = (alamat: string) => {
    const url = String(alamat);
    if (url.includes("/aleta/api/aleta-ecourt/denyut") && opsi.denyut) {
      denyut.push(url);
      const bagian = new URL(url, ASAL).searchParams.get("bagian") || "";
      const isi: Record<string, unknown> = {};
      if (bagian.includes("sumberDaya")) {
        const j = jawabSd();
        isi.sumberDaya = { status: j.status, isi: j.isi };
      }
      if (bagian.includes("kehadiran")) isi.kehadiran = { status: 200, isi: { ok: true, data: { available: true, ok: true, jumlah: 0, perkara: [] } } };
      if (bagian.includes("checklist")) isi.checklist = { status: 200, isi: jawabanChecklist() };
      return Promise.resolve(tanggapan(200, { ok: true, data: { denyut: 1, bagian: isi } }));
    }
    if (url.includes(API_CHECKLIST)) return Promise.resolve(tanggapan(200, jawabanChecklist()));
    if (url.includes(API_SD)) {
      sd.push(url);
      const j = jawabSd();
      return Promise.resolve(tanggapan(j.status, j.isi));
    }
    return Promise.resolve(tanggapan(200, { ok: true, data: {} }));
  };
  const jam: Array<{ ms: number; f: () => void }> = [];
  const setIntervalAsli = w.setInterval.bind(w);
  w.setInterval = (f: () => void, ms: number) => {
    jam.push({ ms, f });
    return setIntervalAsli(f, ms);
  };
  w.document.addEventListener("click", (e: any) => {
    if (e.target && e.target.tagName === "A") e.preventDefault();
  }, true);
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
  return { dom, w, simpanan, tulisan, sd, denyut, jam, setelJawabSd: (f) => (jawabSd = f) };
}

const akarDari = (h: Halaman) => h.w.document.querySelector("aleta-cm-widget") as any;
const q = (h: Halaman, p: string) => {
  const a = akarDari(h);
  return a && a.shadowRoot ? (a.shadowRoot.querySelector(p) as any) : null;
};
const qs = (h: Halaman, p: string) => {
  const a = akarDari(h);
  return (a && a.shadowRoot ? Array.from(a.shadowRoot.querySelectorAll(p)) : []) as any[];
};
const fiturDari = (kode: string[]) => Object.fromEntries(kode.map((k) => [k, true]));
const NYALA = { checklistMilestone: true };
const titik = (h: Halaman, jenis: string) => q(h, `.aleta-cmw-sd-titik[data-sd="${jenis}"]`);
const nilai = (h: Halaman, jenis: string) => String(titik(h, jenis)?.querySelector(".aleta-cmw-sd-nilai")?.textContent ?? "");
// Performa muat 19 Okt: detak sumber daya 15 detik (dulu 5 detik).
const detakSd = (h: Halaman) => h.jam.filter((j) => j.ms === 15000).at(-1);

function setelTerlihat(h: Halaman, keadaan: "visible" | "hidden") {
  Object.defineProperty(h.w.document, "visibilityState", { value: keadaan, configurable: true });
  h.w.document.dispatchEvent(new h.w.Event("visibilitychange"));
}

describe("tampilan Lama dan Baru tanpa saklar: tidak ada apa pun", () => {
  it("Lama dengan SELURUH saklar (termasuk portal-7) tersimpan: tanpa strip, tanpa permintaan", async () => {
    const h = buka({ ...NYALA, ujiFitur: fiturDari([...SEMUA_POPUP, "portal-7"]) });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "widget Lama");
    await tunggu(150);
    expect(q(h, ".aleta-cmw-sd")).toBeNull();
    expect(h.sd).toEqual([]);
    expect(h.tulisan).not.toContain("lingkupSumberDaya");
  });

  it("Baru tanpa portal-7 (saklar popup lain menyala): tanpa strip, tanpa permintaan", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "baru", ujiFitur: fiturDari(SEMUA_POPUP) });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "widget Baru");
    await tunggu(150);
    expect(q(h, ".aleta-cmw-sd")).toBeNull();
    expect(h.sd).toEqual([]);
  });

  it("Baru DENGAN portal-7: strip di atas checklist dan satu permintaan GET", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "baru", ujiFitur: fiturDari(["portal-7"]) });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM ALETA");
    expect(q(h, ".aleta-cmw-dok")).toBeNull();
    expect(q(h, ".aleta-cm-wadah > .aleta-cmw-sd")).not.toBeNull();
    expect(h.sd).toEqual([API_SD]);
  });
});

describe("UI Baru: titik berwarna di samping lencana", () => {
  it("warna dan angka dari portal; GPU 'tidak ada' tampil '–' dan kelabu", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM");
    expect(q(h, ".aleta-cmw-lencana-baris .aleta-cmw-sd")).not.toBeNull();
    expect(q(h, ".aleta-cmw-sd-lingkup").textContent).toBe("ALETA");
    expect(["ram", "disk", "gpu"].map((j) => titik(h, j).getAttribute("data-warna"))).toEqual(["hijau", "kuning", "kelabu"]);
    expect(["ram", "disk", "gpu"].map((j) => nilai(h, j))).toEqual(["42%", "81%", "–"]);
    expect(titik(h, "disk").title).toMatch(/sebagian/);
    expect(titik(h, "gpu").title).toMatch(/Tidak ada GPU/);
  });

  it("12OKT-N: CPU di strip, urutan RAM · CPU · Disk · GPU; tooltip memuat inti terpakai", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM");
    const urut = qs(h, ".aleta-cmw-sd-titik").map((t) => t.getAttribute("data-sd"));
    expect(urut).toEqual(["ram", "cpu", "disk", "gpu"]);
    expect(nilai(h, "cpu")).toBe("38%");
    expect(titik(h, "cpu").getAttribute("data-warna")).toBe("hijau");
    expect(titik(h, "cpu").title).toMatch(/CPU ALETA: 37,5% \(1,5 dari 4 inti\)/);
    expect(titik(h, "cpu").querySelector(".aleta-cmw-sd-nama")?.textContent).toBe("CPU");
  });

  it("12OKT-N: CPU tidak terbaca = kelabu dan '–' (bukan 0%), meski kiriman memberi warna; beban tampil di tooltip", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui", lingkupSumberDaya: "server" });
    await sampai(() => nilai(h, "ram") === "93%", "nilai RAM server");
    expect(nilai(h, "cpu")).toBe("–");
    expect(titik(h, "cpu").getAttribute("data-warna")).toBe("kelabu");
    expect(titik(h, "cpu").title).toMatch(/CPU seluruh server: tidak terbaca/);
    expect(nilai(h, "cpu")).not.toMatch(/0%/);
  });

  it("12OKT-N: portal lama tanpa ruas cpu: titik CPU kelabu '–', titik lain tetap", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    const lama = jawabanSd() as { data: { ringkas: Record<string, Record<string, unknown>> } };
    delete lama.data.ringkas.aleta.cpu;
    delete lama.data.ringkas.server.cpu;
    h.setelJawabSd(() => ({ status: 200, isi: lama }));
    await sampai(() => titik(h, "cpu") && nilai(h, "cpu") === "–" && nilai(h, "ram") === "42%", "cpu kelabu, ram tetap");
    expect(titik(h, "cpu").getAttribute("data-warna")).toBe("kelabu");
    expect(nilai(h, "disk")).toBe("81%");
  });

  it("klik titik: beralih ke seluruh server DI TEMPAT (dok yang sama), diingat; klik chip: kembali ke ALETA", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM");
    const dok = q(h, ".aleta-cmw-dok");
    titik(h, "ram").click();
    await sampai(() => q(h, '.aleta-cmw-sd[data-sd-lingkup="server"]'), "lingkup server");
    expect(q(h, ".aleta-cmw-sd-lingkup").textContent).toBe("Server");
    expect(q(h, ".aleta-cmw-sd-lingkup").getAttribute("aria-pressed")).toBe("true");
    expect(["ram", "disk"].map((j) => titik(h, j).getAttribute("data-warna"))).toEqual(["merah", "hijau"]);
    expect(nilai(h, "ram")).toBe("93%");
    expect(titik(h, "disk").title).toMatch(/partisi \/home/);
    expect(q(h, ".aleta-cmw-dok")).toBe(dok);
    await sampai(() => h.simpanan.lingkupSumberDaya === "server", "tersimpan");
    q(h, ".aleta-cmw-sd-lingkup").click();
    await sampai(() => q(h, '.aleta-cmw-sd[data-sd-lingkup="aleta"]'), "kembali ALETA");
    expect(nilai(h, "ram")).toBe("42%");
    expect(h.simpanan.lingkupSumberDaya).toBe("aleta");
    // Beralih tidak meminta ulang - datanya sudah memuat kedua sudut pandang.
    expect(h.sd).toHaveLength(1);
  });

  it("lingkup tersimpan 'server' dipakai sejak awal", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui", lingkupSumberDaya: "server" });
    await sampai(() => nilai(h, "ram") === "93%", "nilai RAM server");
    expect(q(h, ".aleta-cmw-sd-lingkup").textContent).toBe("Server");
  });

  it("Rincian › hanya bagi Admin, menuju halaman admin di tab baru; tidak ada di dok ciut", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    const a = await sampai(() => q(h, ".aleta-cmw-sd-rinci"), "tautan rincian");
    expect(a.getAttribute("href")).toBe(`${ASAL}/aleta/admin/sumber-daya`);
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener");

    const bukanAdmin = buka({ ...NYALA, ujiTampilan: "ui" });
    bukanAdmin.setelJawabSd(() => ({ status: 200, isi: jawabanSd(false) }));
    await sampai(() => nilai(bukanAdmin, "ram") === "42%", "nilai RAM");
    expect(q(bukanAdmin, ".aleta-cmw-sd-rinci")).toBeNull();

    const ciut = buka({ ...NYALA, ujiTampilan: "ui", posisiChecklistSipp: { kecil: true } });
    await sampai(() => nilai(ciut, "ram") === "42%", "nilai RAM ciut");
    expect(q(ciut, '.aleta-cmw-dok[data-dok="ciut"] .aleta-cmw-sd')).not.toBeNull();
    expect(q(ciut, ".aleta-cmw-sd-rinci")).toBeNull();
  });
});

describe("detak: berhenti saat tersembunyi, berhenti bila tidak berwenang", () => {
  it("tab tersembunyi: detak tidak meminta; terlihat lagi: meminta", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM");
    const detak = await sampai(() => detakSd(h), "detak 15 detik terpasang");
    const sebelum = h.sd.length;
    setelTerlihat(h, "hidden");
    detak.f();
    await tunggu(30);
    expect(h.sd.length).toBe(sebelum);
    setelTerlihat(h, "visible");
    const detakBaru = await sampai(() => (detakSd(h) !== detak ? detakSd(h) : null), "detak dipasang lagi");
    detakBaru.f();
    await sampai(() => h.sd.length > sebelum, "permintaan sesudah terlihat");
  });

  it("jawaban baru memperbarui angka tanpa menggambar ulang dok", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM");
    // Penggambaran awal widget (setelan akun, pita pembaruan) dibiarkan selesai dulu.
    await tunggu(250);
    const dok = q(h, ".aleta-cmw-dok");
    const baru = jawabanSd();
    baru.data.ringkas.aleta.ram = keping(91, "merah");
    h.setelJawabSd(() => ({ status: 200, isi: baru }));
    (await sampai(() => detakSd(h), "detak")).f();
    await sampai(() => nilai(h, "ram") === "91%", "angka baru");
    expect(titik(h, "ram").getAttribute("data-warna")).toBe("merah");
    expect(q(h, ".aleta-cmw-dok")).toBe(dok);
  });

  it("403 (tanpa kewenangan panel): strip hilang dan detak tidak bertanya lagi", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    h.setelJawabSd(() => ({ status: 403, isi: { ok: false, error: "Peran Anda tidak diberi akses" } }));
    await sampai(() => h.sd.length === 1, "satu permintaan");
    await sampai(() => q(h, ".aleta-cm-kelompok") && !q(h, ".aleta-cmw-sd"), "strip hilang");
    for (const j of h.jam.filter((x) => x.ms === 15000)) j.f();
    await tunggu(30);
    expect(h.sd).toHaveLength(1);
  });

  it("portal berhenti menjawab SESUDAH pernah menjawab: titik kelabu dengan sebabnya - angka lama tidak tampak hidup", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM");
    h.setelJawabSd(() => {
      throw new Error("Failed to fetch");
    });
    (await sampai(() => detakSd(h), "detak")).f();
    await sampai(() => titik(h, "ram")?.getAttribute("data-warna") === "kelabu", "kelabu");
    expect(nilai(h, "ram")).toBe("–");
    expect(titik(h, "ram").title).toMatch(/portal tidak menjawab/);
    h.setelJawabSd(() => ({ status: 503, isi: { ok: false, error: "ALETA Bot tidak menjawab" } }));
    (await sampai(() => detakSd(h), "detak")).f();
    await tunggu(30);
    expect(titik(h, "ram").title).toMatch(/tidak terbaca/);
    expect(q(h, ".aleta-cmw-sd")).not.toBeNull();
  });
});

// ===========================================================================
// Performa muat 19 Okt 2026: denyut - satu permintaan, cadangan rute lama
// ===========================================================================
describe("denyut widget (performa muat 19 Okt)", () => {
  it("portal berdenyut: sumber daya dibaca LEWAT denyut, rute lamanya tidak diminta", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" }, { denyut: true });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM dari denyut");
    expect(h.denyut.length).toBeGreaterThan(0);
    expect(h.denyut.some((u) => u.includes("sumberDaya"))).toBe(true);
    expect(h.sd).toEqual([]);
    const baru = jawabanSd();
    baru.data.ringkas.aleta.ram = keping(77, "kuning");
    h.setelJawabSd(() => ({ status: 200, isi: baru }));
    (await sampai(() => detakSd(h), "detak")).f();
    await sampai(() => nilai(h, "ram") === "77%", "angka baru lewat denyut");
    expect(h.sd).toEqual([]);
  });

  it("403 di bagian sumber daya: strip hilang dan detak berhenti, sama dengan rute lama", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" }, { denyut: true });
    h.setelJawabSd(() => ({ status: 403, isi: { ok: false, error: "Peran Anda tidak diberi akses" } }));
    await sampai(() => h.denyut.length >= 1, "satu denyut");
    await sampai(() => q(h, ".aleta-cm-kelompok") && !q(h, ".aleta-cmw-sd"), "strip hilang");
    const sebelum = h.denyut.length;
    for (const j of h.jam.filter((x) => x.ms === 15000)) j.f();
    await tunggu(30);
    expect(h.denyut.length).toBe(sebelum);
  });

  it("portal lama (tanpa rute denyut): dikenali sekali, lalu rute lama seperti dulu", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM dari rute lama");
    expect(h.sd.length).toBeGreaterThan(0);
    const sebelum = h.sd.length;
    (await sampai(() => detakSd(h), "detak")).f();
    await sampai(() => h.sd.length > sebelum, "detak berikutnya langsung ke rute lama");
  });

  it("tab kembali terlihat sesudah lama tersembunyi: dibaca SEGERA sekali", async () => {
    const h = buka({ ...NYALA, ujiTampilan: "ui" }, { denyut: true });
    await sampai(() => nilai(h, "ram") === "42%", "nilai RAM");
    setelTerlihat(h, "hidden");
    const sebelum = h.denyut.length;
    // Seolah bacaan terakhir sudah 20 detik lalu.
    const asliNow = h.w.Date.now;
    const geser = Date.now() + 20_000;
    h.w.Date.now = () => geser;
    setelTerlihat(h, "visible");
    await sampai(() => h.denyut.length > sebelum, "denyut segera saat terlihat");
    // Kehadiran (semenit) baru 20 detik - tetap ikut dibaca segera karena tab baru terlihat lagi.
    expect(h.denyut.at(-1)).toContain("kehadiran");
    h.w.Date.now = asliNow;
  });
});
