// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KATALOG_CHECKLIST, KUNCI_PERAN } from "@/lib/checklist-milestone-katalog";
import { bolehPengingatKasir } from "@/lib/kasir-jurnal";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * CHECKLIST MILESTONE + POSISI PANEL (12 Okt 2026) - DIJALANKAN SUNGGUHAN
 * ============================================================================
 *
 *   5  pita widget bawah ("N tugas · cincin hijau: portal tersambung") hanya
 *      Super Admin; petugas lain tidak melihat keterangan teknis itu
 *   7  checklist BAWAAN TERTUTUP (lencana) untuk sesi baru, dan yang pernah
 *      dibentangkan tetap terbentang; panel ALETA sesi baru di KANAN ATAS
 *      dengan ukuran bawaan besar dari layar; ukuran/posisi pilihan petugas
 *      dihormati
 *   8  tombol kepala checklist (menu, sembul, gabung, sembunyikan, muat
 *      ulang, minimize, tutup) tetap bekerja walau widget digambar ulang di
 *      antara tekan dan lepas - sebab klik yang hilang
 *   9  isi checklist per peran: tiap peran hanya pekerjaannya sendiri;
 *      pengingat kasir hanya kasir/keuangan; penanda superAdmin dari portal
 *
 * Kode ekstensi yang dijalankan: panel-alat.js UTUH lalu checklist.js UTUH di
 * jsdom, dan fungsi terapkanPosisi konten.js yang DIAMBIL dari berkasnya.
 * Rute portal: handler GET sungguhan atas pg-mem; hanya bot dan jembatan SIPP
 * ditiru.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca(path.join(EKSTENSI, "panel-alat.js"));
const SUMBER_CHECKLIST = baca(path.join(EKSTENSI, "checklist.js"));
const SUMBER_KONTEN = baca(path.join(EKSTENSI, "konten.js"));

const API = "/aleta/api/aleta-ecourt/checklist";
const ASAL = "http://192.168.10.10";
const NYALA = { checklistMilestone: true };
const UI = { ...NYALA, ujiTampilan: "ui" };

type OpsiJsdom = NonNullable<ConstructorParameters<typeof JSDOM>[1]> & { pretendToBeVisual?: boolean };
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

// ----------------------------------------------------------------------------
// Jawaban portal tiruan (kontrak widget)
// ----------------------------------------------------------------------------
function hariKe(n: number) {
  const t = new Date();
  t.setDate(t.getDate() + n);
  t.setHours(16, 0, 0, 0);
  return t.toISOString();
}

function jawabanContoh(pengguna: Record<string, unknown> = {}) {
  return {
    ok: true,
    data: {
      pengguna: { nama: "Hakim Uji", peran: ["hakim", "ketua"], ...pengguna },
      peranTersedia: [
        { kunci: "hakim", label: "Hakim" },
        { kunci: "ketua", label: "Ketua" },
      ],
      peranAktif: "hakim",
      dibuat: new Date().toISOString(),
      ringkas: { lewat: 1, hariIni: 1, mingguIni: 0, selesaiHariIni: 0, totalHariIni: 2 },
      butir: [
        {
          id: "l1",
          jenis: "pmh",
          judul: "PMH belum ditetapkan",
          perkara: { id: 10018, nomor: "385/Pdt.G/2026/PA.Dgl" },
          tenggat: hariKe(-2),
          kelompok: "lewat",
          keterangan: "didaftarkan 20 Sep",
          kerjakan: { tujuan: "sipp", halaman: "penetapan" },
        },
        {
          id: "h1",
          jenis: "sidang",
          judul: "Sidang hari ini",
          perkara: { id: 10021, nomor: "387/Pdt.G/2026/PA.Dgl" },
          tenggat: hariKe(0),
          kelompok: "hari-ini",
          keterangan: "Ruang 1",
          kerjakan: { tujuan: "aleta", alamat: "/aleta-ecourt?tab=jadwal" },
        },
      ],
      jenisTidakTersedia: [],
      galat: [],
    },
  };
}

type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
function penyimpananTiruan(awal: Record<string, unknown>) {
  const simpanan: Record<string, unknown> = polos(awal);
  const pendengar: Array<(ubah: Ubah, wilayah: string) => void> = [];
  const siarkan = (ubah: Ubah) => {
    if (Object.keys(ubah).length === 0) return;
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
        ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      siarkan(ubah);
    },
    remove: async (kunci: string | string[]) => {
      const ubah: Ubah = {};
      for (const k of [kunci].flat()) {
        if (!(k in simpanan)) continue;
        ubah[k] = { oldValue: simpanan[k] };
        delete simpanan[k];
      }
      siarkan(ubah);
    },
  };
  return {
    simpanan,
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (ubah: Ubah, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
}

const tanggapan = (status: number, isi: unknown) => {
  const r = { ok: status >= 200 && status < 300, status, json: async () => polos(isi), clone: () => r };
  return r;
};

type Halaman = {
  dom: JsdomUji;
  w: any;
  ctx: vm.Context;
  simpanan: Record<string, unknown>;
  minta: string[];
  setel: (isi: Record<string, unknown>) => Promise<void>;
  hapus: (kunci: string[]) => Promise<void>;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(
  p: {
    alamat?: string;
    simpanan?: Record<string, unknown>;
    pengguna?: Record<string, unknown>;
    lebar?: number;
    tinggi?: number;
    /** Jalankan panel-alat.js saja (tanpa checklist.js). */
    tanpaChecklist?: boolean;
  } = {}
): Halaman {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: p.alamat ?? `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as OpsiJsdom) as JsdomUji;
  terbuka.push(dom);
  const w = dom.window as any;
  if (p.lebar) Object.defineProperty(w, "innerWidth", { value: p.lebar, configurable: true });
  if (p.tinggi) Object.defineProperty(w, "innerHeight", { value: p.tinggi, configurable: true });
  const { simpanan, storage } = penyimpananTiruan(p.simpanan ?? {});
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "0.0.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async () => ({}),
    },
    storage,
  };
  const minta: string[] = [];
  w.fetch = (alamat: string) => {
    const url = String(alamat);
    if (!url.includes(API)) return Promise.resolve(tanggapan(200, { ok: true, data: {} }));
    minta.push(url);
    return Promise.resolve(tanggapan(200, jawabanContoh(p.pengguna)));
  };
  w.document.addEventListener("click", (e: any) => e.preventDefault(), true);
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  if (!p.tanpaChecklist) vm.runInContext(SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
  return {
    dom,
    w,
    ctx,
    simpanan,
    minta,
    setel: (isi) => storage.local.set(isi),
    hapus: (kunci) => storage.local.remove(kunci),
  };
}

const akarDari = (h: Halaman) => h.w.document.querySelector("aleta-cm-widget") as any;
const q = (h: Halaman, pemilih: string) => {
  const akar = akarDari(h);
  return akar && akar.shadowRoot ? (akar.shadowRoot.querySelector(pemilih) as any) : null;
};
const qs = (h: Halaman, pemilih: string) => {
  const akar = akarDari(h);
  return (akar && akar.shadowRoot ? Array.from(akar.shadowRoot.querySelectorAll(pemilih)) : []) as any[];
};
const ptr = (h: Halaman, sasaran: any, jenis: string, x = 10, y = 10) =>
  sasaran.dispatchEvent(
    new h.w.MouseEvent(jenis, { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  );

// ============================================================================
describe("7. checklist BAWAAN TERTUTUP; pilihan petugas diingat", () => {
  it("sesi baru (tanpa posisi tersimpan), UI Baru: hanya lencana - daftar tidak terbentang; dibuka dari lencana dan diingat", async () => {
    const h = buka({ simpanan: UI });
    const lencana = await sampai(() => q(h, ".aleta-cmw-lencana"), "lencana");
    expect(q(h, ".aleta-cm")).toBeNull();
    expect(q(h, ".aleta-cm-kelompok")).toBeNull();
    expect(lencana.getAttribute("aria-expanded")).toBe("false");
    expect(h.simpanan.posisiChecklistSipp).toBeUndefined();

    lencana.click();
    await sampai(() => q(h, ".aleta-cm-kelompok"), "daftar terbentang");
    await sampai(() => (h.simpanan.posisiChecklistSipp as any)?.kecil === false, "bentangan diingat");
  });

  it("tampilan Lama: pil, bukan daftar; klik pil membentangkan", async () => {
    const h = buka({ simpanan: NYALA });
    const pil = await sampai(() => q(h, ".aleta-cm-pil"), "pil");
    expect(q(h, ".aleta-cm")).toBeNull();
    pil.click();
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
  });

  it("yang pernah dibentangkan (kecil:false tersimpan) tetap terbentang di sesi berikutnya", async () => {
    const h = buka({ simpanan: { ...UI, posisiChecklistSipp: { kecil: false } } });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang dari ingatan");
    expect(q(h, ".aleta-cmw-lencana")).not.toBeNull(); // lencana tetap di kaki dok
    expect(q(h, ".aleta-cmw-lencana").getAttribute("aria-expanded")).toBe("true");
  });

  it("digeser selagi tertutup: tetap tertutup, posisinya diingat", async () => {
    const h = buka({ simpanan: UI });
    const lencana = await sampai(() => q(h, ".aleta-cmw-lencana"), "lencana");
    ptr(h, lencana, "pointerdown", 100, 700);
    ptr(h, lencana, "pointermove", 140, 650);
    ptr(h, lencana, "pointerup", 140, 650);
    await sampai(() => h.simpanan.posisiChecklistSipp, "posisi tersimpan");
    expect((h.simpanan.posisiChecklistSipp as any).kecil).toBe(true);
    expect(q(h, ".aleta-cm")).toBeNull();
  });

  it("Kembalikan posisi panel (kunci dihapus) = kembali ke bawaan tertutup", async () => {
    const h = buka({ simpanan: { ...UI, posisiChecklistSipp: { kecil: false, kiri: 40, bawah: 40 } } });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    await h.hapus(["posisiChecklistSipp"]);
    await sampai(() => !q(h, ".aleta-cm-kelompok") && q(h, ".aleta-cmw-lencana"), "tertutup lagi");
  });
});

// ============================================================================
describe("7. panel ALETA: sesi baru di KANAN ATAS dengan ukuran bawaan besar", () => {
  /** getBoundingClientRect yang meniru tata letak CSS panel.css: top/right 12px sampai ada left/top. */
  function tiruTataLetak(h: Halaman, panel: any) {
    panel.getBoundingClientRect = () => {
      const lebar = parseFloat(panel.style.width) || 460;
      const tinggi = parseFloat(panel.style.height) || 300;
      const kiri = panel.style.left && panel.style.left !== "auto" ? parseFloat(panel.style.left) : h.w.innerWidth - 12 - lebar;
      const atas = panel.style.top && panel.style.top !== "auto" ? parseFloat(panel.style.top) : 12;
      return { left: kiri, top: atas, width: lebar, height: tinggi, right: kiri + lebar, bottom: atas + tinggi, x: kiri, y: atas };
    };
  }

  const ukuran = (h: Halaman) => polos(vm.runInContext("alatUkuranAwal()", h.ctx));

  it("ukuran bawaan dihitung dari layar: sepertiga lebar (520-760) dan 70% tinggi, tidak melewati layar", () => {
    const tabel: Array<[number, number, { lebar: number; tinggi: number }]> = [
      [1920, 1080, { lebar: 634, tinggi: 756 }],
      [1366, 768, { lebar: 520, tinggi: 538 }],
      [2560, 1440, { lebar: 760, tinggi: 1008 }],
      [800, 600, { lebar: 520, tinggi: 420 }],
      [400, 300, { lebar: 376, tinggi: 276 }],
    ];
    for (const [lebar, tinggi, harapan] of tabel) {
      const h = buka({ lebar, tinggi, tanpaChecklist: true });
      expect(ukuran(h)).toEqual(harapan);
    }
  });

  it("alatPasangPanel: sesi baru - lebar & tinggi bawaan, sudut KANAN ATAS tetap di tempatnya", async () => {
    const h = buka({ lebar: 1920, tinggi: 1080, tanpaChecklist: true });
    const panel = h.w.document.createElement("div");
    panel.className = "aleta-panel";
    const kepala = h.w.document.createElement("div");
    panel.appendChild(kepala);
    h.w.document.body.appendChild(panel);
    tiruTataLetak(h, panel);
    await vm.runInContext("(async (p, k) => { await alatPasangPanel(p, k, 'posisiPanelAbt', {}); })", h.ctx)(panel, kepala);
    expect(panel.style.width).toBe("634px");
    expect(panel.style.height).toBe("756px");
    const r = panel.getBoundingClientRect();
    expect(Math.round(r.right)).toBe(1920 - 12); // tepi kanan 12px dari layar
    expect(Math.round(r.top)).toBe(12); // 12px dari atas
    expect(Math.round(r.bottom)).toBeLessThan(1080);
  });

  it("ukuran & posisi yang DITARIK petugas dihormati: tidak ditimpa bawaan", async () => {
    const h = buka({
      lebar: 1920,
      tinggi: 1080,
      tanpaChecklist: true,
      simpanan: { posisiPanelAbt: { kiri: 100, atas: 60, lebar: 800, tinggi: 500 } },
    });
    const panel = h.w.document.createElement("div");
    panel.className = "aleta-panel";
    const kepala = h.w.document.createElement("div");
    panel.appendChild(kepala);
    h.w.document.body.appendChild(panel);
    tiruTataLetak(h, panel);
    await vm.runInContext("(async (p, k) => { await alatPasangPanel(p, k, 'posisiPanelAbt', {}); })", h.ctx)(panel, kepala);
    expect(panel.style.width).toBe("800px");
    expect(panel.style.height).toBe("500px");
    expect([panel.style.left, panel.style.top]).toEqual(["100px", "60px"]);
  });

  it("hanya lebar yang pernah ditarik: lebar dihormati, tinggi tetap bawaan (dinilai sendiri-sendiri)", async () => {
    const h = buka({ lebar: 1920, tinggi: 1080, tanpaChecklist: true, simpanan: { posisiPanelAbt: { lebar: 700 } } });
    const panel = h.w.document.createElement("div");
    panel.className = "aleta-panel";
    h.w.document.body.appendChild(panel);
    tiruTataLetak(h, panel);
    const dipasang = vm.runInContext("alatTerapkanUkuranAwal", h.ctx)(panel, { lebar: 700 });
    expect(dipasang).toBe(true);
    expect(panel.style.width).toBe(""); // tidak disentuh di sini; alatTerapkanPosisi yang memasang 700
    expect(panel.style.height).toBe("756px");
  });

  it("panel SIPP (konten.js): terapkanPosisi yang ASLI memakai ukuran bawaan bila belum tersimpan, dan menghormati yang tersimpan", () => {
    const awal = SUMBER_KONTEN.indexOf("function terapkanPosisi(panel, posisi) {");
    expect(awal).toBeGreaterThan(0);
    // ambil fungsi utuh dengan mencocokkan kurung kurawal
    let dalam = 0;
    let akhir = -1;
    for (let i = SUMBER_KONTEN.indexOf("{", awal); i < SUMBER_KONTEN.length; i += 1) {
      const c = SUMBER_KONTEN[i];
      if (c === "{") dalam += 1;
      else if (c === "}") {
        dalam -= 1;
        if (dalam === 0) {
          akhir = i + 1;
          break;
        }
      }
    }
    const fungsi = SUMBER_KONTEN.slice(awal, akhir);

    const h = buka({ lebar: 1366, tinggi: 768, tanpaChecklist: true });
    vm.runInContext(
      `${fungsi}; var keadaanPanel = null; function jepitKeLayar(k, a) { return { kiri: k, atas: a }; } function jepitTinggiKeRuangTersisa() {}`,
      h.ctx
    );
    const terapkan = vm.runInContext("terapkanPosisi", h.ctx);

    const baru = h.w.document.createElement("div");
    terapkan(baru, null);
    expect([baru.style.width, baru.style.height]).toEqual(["520px", "538px"]);
    expect(baru.style.maxHeight).toBe("none");
    expect(baru.style.left).toBe(""); // tetap berjangkar kanan atas (CSS)

    const tarikan = h.w.document.createElement("div");
    terapkan(tarikan, { kiri: 50, atas: 40, lebar: 900, tinggi: 600 });
    expect([tarikan.style.width, tarikan.style.height, tarikan.style.left, tarikan.style.top]).toEqual(["900px", "600px", "50px", "40px"]);
  });
});

// ============================================================================
describe("8. tombol kepala checklist bekerja - klik tidak hilang saat widget digambar ulang", () => {
  const BUKA = { ...UI, posisiChecklistSipp: { kecil: false } };

  /** Pemicu penggambaran ulang yang NYATA: tulisan dari tab lain ke kunci yang didengar widget. */
  const gambarUlang = async (h: Halaman, n: number) => {
    await h.setel({ lamaSidang: { berjalan: null, riwayat: [{ n }] } });
    await tunggu(20);
  };

  it("semua tombol kepala ada dan berjudul: menu, sembul, muat ulang, minimize, tutup", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    for (const kelas of [".aleta-cm-bagian-tombol", ".aleta-cmw-pisah", ".aleta-cm-segar", ".aleta-cm-kecilkan", ".aleta-cm-tutup"]) {
      const t = q(h, kelas);
      expect(t, kelas).not.toBeNull();
      expect(t.getAttribute("aria-label"), kelas).toBeTruthy();
      expect(t.type).toBe("button");
    }
  });

  it("minimize: tekan -> widget digambar ulang di tengah -> lepas -> klik tetap bekerja (tidak hilang)", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    const tombol = q(h, ".aleta-cm-kecilkan");

    ptr(h, tombol, "pointerdown");
    ptr(h, tombol, "mousedown");
    await gambarUlang(h, 1); // jendela baru kembali fokus / tulisan tab lain / jawaban portal
    // Simpul yang ditekan TIDAK dibuang di bawah jari - itulah yang membuat klik sampai.
    expect(tombol.isConnected).toBe(true);
    expect(q(h, ".aleta-cm-kecilkan")).toBe(tombol);
    ptr(h, tombol, "pointerup");
    ptr(h, tombol, "mouseup");
    tombol.click();

    await sampai(() => !q(h, ".aleta-cm-kelompok") && q(h, ".aleta-cmw-lencana"), "diminimize");
    await sampai(() => (h.simpanan.posisiChecklistSipp as any)?.kecil === true, "minimize diingat");
  });

  it("PEMBUKTI GIGITAN: tanpa penekanan yang sedang berlangsung, penggambaran ulang MEMANG mengganti simpul tombol", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    const tombol = q(h, ".aleta-cm-kecilkan");
    await gambarUlang(h, 2);
    expect(tombol.isConnected).toBe(false); // ini yang dulu terjadi di antara tekan dan lepas
    expect(q(h, ".aleta-cm-kecilkan")).not.toBe(tombol);
  });

  it("penggambaran yang ditunda dikerjakan sesudah dilepas - tampilan tidak basi", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    const tombol = q(h, ".aleta-cm-segar");
    ptr(h, tombol, "pointerdown");
    await gambarUlang(h, 3);
    expect(tombol.isConnected).toBe(true);
    ptr(h, tombol, "pointerup");
    await sampai(() => q(h, ".aleta-cm-segar") && q(h, ".aleta-cm-segar") !== tombol, "digambar ulang sesudah dilepas");
  });

  it("penekanan yang tak pernah dilepas (pointerup hilang) tidak membekukan widget selamanya", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    ptr(h, q(h, ".aleta-cm-segar"), "pointerdown");
    h.w.dispatchEvent(new h.w.Event("blur")); // jendela kehilangan fokus
    await gambarUlang(h, 4);
    await sampai(() => q(h, ".aleta-cm-segar"), "tergambar lagi");
  });

  it("☰ menu bagian: membuka dan menutup", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    q(h, ".aleta-cm-bagian-tombol").click();
    await sampai(() => q(h, ".aleta-cm-bagian-tombol")?.getAttribute("aria-expanded") === "true", "menu terbuka");
    q(h, ".aleta-cm-bagian-tombol").click();
    await sampai(() => q(h, ".aleta-cm-bagian-tombol")?.getAttribute("aria-expanded") === "false", "menu tertutup");
  });

  it("⟳ muat ulang: meminta checklist lagi ke portal", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    const sebelum = h.minta.length;
    q(h, ".aleta-cm-segar").click();
    await sampai(() => h.minta.length > sebelum, "permintaan baru");
  });

  it("⧉ sembul -> ⤓ gabung -> ⧉ sembul -> ⊘ sembunyikan (jendela melayang), semuanya bekerja", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    q(h, ".aleta-cmw-pisah").click();
    await sampai(() => q(h, "[data-lepasan='checklist']"), "jendela melayang");
    expect(q(h, ".aleta-cmw-gabung")).not.toBeNull();
    expect(q(h, ".aleta-cmw-sembunyi")).not.toBeNull();

    // klik ⤓ walau digambar ulang di tengah tekan-lepas di jendela melayang
    const gabung = q(h, ".aleta-cmw-gabung");
    ptr(h, gabung, "pointerdown");
    await gambarUlang(h, 5);
    expect(gabung.isConnected).toBe(true);
    ptr(h, gabung, "pointerup");
    gabung.click();
    await sampai(() => !q(h, "[data-lepasan='checklist']") && q(h, ".aleta-cmw-pisah"), "digabung kembali");

    q(h, ".aleta-cmw-pisah").click();
    await sampai(() => q(h, ".aleta-cmw-sembunyi"), "melayang lagi");
    q(h, ".aleta-cmw-sembunyi").click();
    await sampai(() => !q(h, "[data-lepasan='checklist']") && !q(h, ".aleta-cm-kecilkan"), "bagian checklist disembunyikan");
  });

  it("× tutup: mematikan saklarnya (jalan pulang lewat popup disebut)", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    q(h, ".aleta-cm-tutup").click();
    await sampai(() => h.simpanan.checklistMilestone === false, "saklar mati");
    expect(akarDari(h)).toBeNull();
  });

  it("menggeser dari kepala tetap bekerja, dan tombol tidak ikut menggeser", async () => {
    const h = buka({ simpanan: { ...NYALA, posisiChecklistSipp: { kecil: false } } });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    const akar = akarDari(h);
    const judul = q(h, ".aleta-cm-judul");
    ptr(h, judul, "pointerdown", 100, 700);
    ptr(h, judul, "pointermove", 160, 600);
    ptr(h, judul, "pointerup", 160, 600);
    expect([akar.style.left, akar.style.bottom]).toEqual(["72px", "112px"]);
    const segar = q(h, ".aleta-cm-segar");
    ptr(h, segar, "pointerdown", 160, 600);
    ptr(h, segar, "pointermove", 400, 300);
    ptr(h, segar, "pointerup", 400, 300);
    expect([akar.style.left, akar.style.bottom]).toEqual(["72px", "112px"]);
  });
});

// ============================================================================
describe("5. pita widget bawah: keterangan teknis hanya Super Admin", () => {
  const BUKA = { ...UI, posisiChecklistSipp: { kecil: false } };

  it("bukan Super Admin: tanpa '... tugas · cincin ...' dan tanpa arti cincin di tooltip lencana; tombol Atur widget tetap", async () => {
    const h = buka({ simpanan: BUKA, pengguna: { superAdmin: false } });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    await sampai(() => q(h, ".aleta-cmw-lencana")?.getAttribute("data-sambungan") === "baik", "sambungan baik");
    expect(q(h, ".aleta-cmw-lencana-teks")).toBeNull();
    const teksPita = q(h, ".aleta-cmw-lencana-ket").textContent;
    expect(teksPita).toBe("");
    expect(q(h, ".aleta-cm-wadah").textContent).not.toMatch(/cincin|portal tersambung/);
    expect(q(h, ".aleta-cmw-lencana").title).not.toMatch(/cincin|tersambung/);
    expect(q(h, ".aleta-cmw-lencana").title).toMatch(/tugas belum selesai/);
    expect(q(h, ".aleta-cmw-atur-buka")).not.toBeNull();
  });

  it("portal lama yang tidak mengirim penandanya = disembunyikan (aman)", async () => {
    const h = buka({ simpanan: BUKA });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    await sampai(() => q(h, ".aleta-cmw-lencana")?.getAttribute("data-sambungan") === "baik", "sambungan baik");
    expect(q(h, ".aleta-cmw-lencana-teks")).toBeNull();
  });

  it("Super Admin: pita lengkap - jumlah tugas dan arti cincin", async () => {
    const h = buka({ simpanan: BUKA, pengguna: { superAdmin: true, nama: "SUPER ADMIN" } });
    const teks = await sampai(() => q(h, ".aleta-cmw-lencana-teks"), "pita");
    await sampai(() => /cincin hijau: portal tersambung/.test(q(h, ".aleta-cmw-lencana-teks")?.textContent ?? ""), "cincin hijau");
    expect(teks.textContent).toMatch(/2 tugas · cincin hijau: portal tersambung/);
    expect(q(h, ".aleta-cmw-lencana").title).toMatch(/cincin hijau: portal tersambung/);
  });

  it("galat tetap tampil untuk SEMUA (bukan keterangan teknis): portal mati", async () => {
    const h = buka({ simpanan: BUKA, pengguna: { superAdmin: false } });
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang");
    h.w.fetch = () => Promise.reject(new Error("Failed to fetch"));
    q(h, ".aleta-cm-segar").click();
    await sampai(() => q(h, ".aleta-cm-kabar-galat"), "kabar galat");
    expect(q(h, ".aleta-cm-kabar-galat").textContent).toMatch(/Portal ALETA tidak menjawab/);
  });
});

// ============================================================================
// 9. ISI CHECKLIST PER PERAN
// ============================================================================
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({ callAletaBotSippBridge: vi.fn() }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return { ...modul, getGatewayChecklistMilestone: vi.fn() };
});
vi.mock("@/server/modules/aleta-ecourt/kasir-otomatis", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-ecourt/kasir-otomatis")>();
  return { ...modul, bacaPengingatKasir: vi.fn() };
});

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-ketua";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const { callAletaBotSippBridge } = await import("@/server/modules/aleta-sipp/aleta-sipp-datasource");
const { getGatewayChecklistMilestone } = await import("@/server/modules/aleta-bot/whatsapp-gateway-client");
const { bacaPengingatKasir } = await import("@/server/modules/aleta-ecourt/kasir-otomatis");
const { kosongkanSinggahChecklist } = await import("@/server/modules/aleta-ecourt/checklist-milestone");
const jembatan = vi.mocked(callAletaBotSippBridge);
const gerbang = vi.mocked(getGatewayChecklistMilestone);
const pengingat = vi.mocked(bacaPengingatKasir);

const KINI = new Date("2026-09-10T02:00:00.000Z");

describe("9. isi checklist per peran dan per akun", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-ketua";
    kosongkanSinggahChecklist();
    jembatan.mockReset();
    jembatan.mockResolvedValue({ ok: true, data: { hakim: [], panitera: [], jurusita: [] }, bridge: {} } as never);
    gerbang.mockReset();
    gerbang.mockImplementation(async (m) => ({ ok: true, data: { acuan: m.acuan, peran: m.peran, fakta: {}, gagal: {} } }) as never);
    pengingat.mockReset();
    pengingat.mockResolvedValue({
      ok: true,
      data: {
        ok: true,
        hariIni: "2026-09-10",
        setorTerbaca: true,
        ringkas: { sisaPanjar: 0, belumDijurnal: 0, panjarKurang: 0, pnbpBelumSetor: 1, lewat: 1 },
        butir: [
          {
            jenis: "pnbp-belum-setor",
            perkaraId: 0,
            nomorPerkara: "",
            jenisPerkara: "",
            tanggal: "2026-09-01",
            tenggat: "2026-09-02",
            jumlah: 590000,
            keterangan: "PNBP 2026-09-01: Rp590.000 - setorannya belum dicatat.",
          },
        ],
      },
    } as never);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(KINI);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db?.close();
    db = null;
  });

  async function panggil(siapa: string, peran = "") {
    aktor = siapa;
    kosongkanSinggahChecklist();
    const { GET } = await import("@/app/api/aleta-ecourt/checklist/route");
    const jawaban = await GET(new NextRequest(`http://localhost/api/aleta-ecourt/checklist${peran ? `?peran=${peran}` : ""}`));
    expect(jawaban.status).toBe(200);
    return ((await jawaban.json()) as { data: any }).data;
  }

  // Matriks yang diperiksa: akun seed -> peran checklist yang tersedia & bawaan.
  const MATRIKS: Array<{ akun: string; sebutan: string; tersedia: string[]; bawaan: string; superAdmin: boolean; kasir: boolean }> = [
    { akun: "usr-super", sebutan: "Super Admin", tersedia: ["operator"], bawaan: "operator", superAdmin: true, kasir: false },
    { akun: "usr-admin", sebutan: "Admin", tersedia: ["operator"], bawaan: "operator", superAdmin: false, kasir: false },
    { akun: "usr-ketua", sebutan: "Ketua", tersedia: ["hakim", "ketua"], bawaan: "ketua", superAdmin: false, kasir: false },
    { akun: "usr-wakil", sebutan: "Wakil Ketua", tersedia: ["hakim", "ketua"], bawaan: "ketua", superAdmin: false, kasir: false },
    { akun: "usr-hakim", sebutan: "Hakim", tersedia: ["hakim"], bawaan: "hakim", superAdmin: false, kasir: false },
    { akun: "usr-panitera", sebutan: "Panitera", tersedia: ["panitera"], bawaan: "panitera", superAdmin: false, kasir: false },
    { akun: "usr-ahmad", sebutan: "Panitera Muda Hukum", tersedia: ["panitera"], bawaan: "panitera", superAdmin: false, kasir: false },
    { akun: "usr-ppg", sebutan: "Panitera Pengganti", tersedia: ["panitera-pengganti"], bawaan: "panitera-pengganti", superAdmin: false, kasir: false },
    { akun: "usr-jurusita", sebutan: "Juru Sita", tersedia: ["jurusita"], bawaan: "jurusita", superAdmin: false, kasir: false },
    { akun: "usr-jsp", sebutan: "Juru Sita Pengganti", tersedia: ["jurusita"], bawaan: "jurusita", superAdmin: false, kasir: false },
    { akun: "usr-ptsp", sebutan: "PTSP", tersedia: ["ptsp"], bawaan: "ptsp", superAdmin: false, kasir: false },
    { akun: "usr-analiskeu", sebutan: "Analis Keuangan", tersedia: [], bawaan: "", superAdmin: false, kasir: true },
    { akun: "usr-bendahara", sebutan: "Bendahara", tersedia: [], bawaan: "", superAdmin: false, kasir: true },
    { akun: "usr-rina", sebutan: "Kasubag Umum", tersedia: [], bawaan: "", superAdmin: false, kasir: false },
    { akun: "usr-sekretaris", sebutan: "Sekretaris", tersedia: [], bawaan: "", superAdmin: false, kasir: false },
  ];

  for (const m of MATRIKS) {
    it(`${m.sebutan} (${m.akun}): peran ${JSON.stringify(m.tersedia)}, bawaan "${m.bawaan}", superAdmin=${m.superAdmin}, pengingat kasir=${m.kasir}`, async () => {
      const data = await panggil(m.akun);
      expect(data.peranTersedia.map((p: { kunci: string }) => p.kunci)).toEqual(m.tersedia);
      expect(data.peranAktif).toBe(m.bawaan);
      expect(data.pengguna.superAdmin).toBe(m.superAdmin);

      const jenis: string[] = data.butir.map((b: { jenis: string }) => b.jenis);
      // Setor PNBP & kawan-kawan: HANYA kasir/keuangan.
      expect(jenis.some((j) => j.startsWith("kasir."))).toBe(m.kasir);
      // Selain pengingat kasir, setiap butir milik katalog PERAN YANG AKTIF - tidak ada tugas peran lain.
      for (const j of jenis.filter((x) => !x.startsWith("kasir."))) expect(j.startsWith(`${m.bawaan}.`), j).toBe(true);
      // Peran lain yang dimiliki dapat dipilih, dan isinya pun hanya katalog peran itu.
      for (const lain of m.tersedia.filter((p) => p !== m.bawaan)) {
        const d2 = await panggil(m.akun, lain);
        expect(d2.peranAktif).toBe(lain);
        for (const b of d2.butir as Array<{ jenis: string }>) expect(b.jenis.startsWith(`${lain}.`), b.jenis).toBe(true);
      }
    });
  }

  it("peran yang tidak dimiliki TIDAK dibuka lewat ?peran= (juru sita meminta Operator)", async () => {
    const data = await panggil("usr-jurusita", "operator");
    expect(data.peranAktif).toBe("jurusita");
    expect(data.galat.join(" ")).toMatch(/tidak tersedia untuk akun Anda/);
  });

  it("akun kasir murni: hanya pengingat kasir, tanpa kalimat 'belum punya peran'", async () => {
    const data = await panggil("usr-analiskeu");
    expect(data.butir.map((b: { judul: string }) => b.judul)).toEqual(["Setor PNBP ke kas negara"]);
    expect(data.butir[0]).toMatchObject({ kelompok: "lewat", kerjakan: { tujuan: "aleta" } });
    expect(data.galat.join(" ")).not.toMatch(/belum punya peran/);
  });

  it("Admin/Super Admin/Panitera boleh MEMBUKA Kasir tetapi tidak ditumpuki pengingat hariannya", async () => {
    for (const akun of ["usr-super", "usr-admin", "usr-panitera", "usr-ahmad"]) {
      const data = await panggil(akun);
      expect(data.butir.some((b: { jenis: string }) => b.jenis.startsWith("kasir.")), akun).toBe(false);
    }
    expect(pengingat).not.toHaveBeenCalled(); // bahkan tidak menanyakannya ke bot
  });

  it("katalog: kunci jenis tiap peran berawalan perannya sendiri dan tidak ada yang dipakai dua peran", () => {
    const lihat = new Set<string>();
    for (const peran of KUNCI_PERAN) {
      const daftar = KATALOG_CHECKLIST.filter((j) => j.peran === peran);
      expect(daftar.length, peran).toBeGreaterThan(0);
      for (const j of daftar) {
        expect(j.kunci.startsWith(`${peran}.`), j.kunci).toBe(true);
        expect(lihat.has(j.kunci), j.kunci).toBe(false);
        lihat.add(j.kunci);
      }
    }
  });

  it("bolehPengingatKasir: kasir/keuangan ya; admin, super admin, panitera, hakim, ketua, PTSP tidak", () => {
    const orang = (roleId: string, positionId = "", additionalRoleIds: string[] = []) => ({ roleId, positionId, additionalRoleIds }) as never;
    expect(bolehPengingatKasir(orang("staf", "pos-arsiparis", ["kasir"]))).toBe(true);
    expect(bolehPengingatKasir(orang("staf", "pos-arsiparis", ["petugas_keuangan_perkara"]))).toBe(true);
    expect(bolehPengingatKasir(orang("staf", "pos-arsiparis", ["bendahara_penerimaan"]))).toBe(true);
    expect(bolehPengingatKasir(orang("analis-keuangan"))).toBe(true);
    expect(bolehPengingatKasir(orang("staf", "pos-bendahara"))).toBe(true);
    expect(bolehPengingatKasir(orang("staf", "pos-analis-keuangan"))).toBe(true);
    for (const r of ["super-admin", "admin", "panitera", "panitera-muda", "hakim", "ketua", "jurusita", "panitera-pengganti"]) {
      expect(bolehPengingatKasir(orang(r, "pos-x")), r).toBe(false);
    }
    expect(bolehPengingatKasir(orang("staf", "pos-ptsp"))).toBe(false);
    expect(bolehPengingatKasir(null)).toBe(false);
  });
});
