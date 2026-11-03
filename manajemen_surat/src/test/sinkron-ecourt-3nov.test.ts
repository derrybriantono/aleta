// @vitest-environment node
/**
 * Tombol "Sync E-Court" di samping Help (3 Nov 2026, sinkron-ecourt.js): kode SUNGGUHAN di jsdom.
 *   1. uraian halaman SIPP "Monitoring Sinkronisasi Data" (total, baris, bukan-halamannya = ditolak);
 *   2. tombol dipasang tepat di kiri Help, lencana angka bila antrian > 0, hilang bila peran ditolak;
 *   3. panel: tabel antrian; "Sinkronisasi data" meminta konfirmasi dulu, baru memanggil api/Sync;
 *   4. pembacaan hanya lewat jalur SIPP yang sama dan tidak berulang (simpanan 5 menit);
 *   5. tidak ada kata ALETA di teks yang tampil; terdaftar di manifest dan daftar tanam.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const KODE = readFileSync(path.join(EKSTENSI, "sinkron-ecourt.js"), "utf8");
const CSS = readFileSync(path.join(EKSTENSI, "panel.css"), "utf8");
const MANIFEST = JSON.parse(readFileSync(path.join(EKSTENSI, "manifest.json"), "utf8"));
const SUSUN = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");

const halamanMonitoring = (total: number, baris: Array<[string, string]>) => `<!doctype html><html><body><div class="konten">
<div id="pageTitle">MONITORING SINKRONISASI DATA</div>
<div id="right"><div class="total_perkara">
 Total Antrian Data : ${total.toLocaleString("id-ID")}
</div></div>
<div class="cssTable"><table id="tablePerkaraAll"><tbody>
<tr><td>No</td><td>Table</td><td>Data ID</td></tr>
${baris.length ? baris.map((b, i) => `<tr><td align="center">${i + 1}</td><td>${b[0]}</td><td>${b[1]}</td></tr>`).join("") : "<tr><td colspan='3' align='center'>Data Antrian Kosong</td></tr>"}
</tbody></table></div></div></body></html>`;
const halamanMasuk = `<!doctype html><html><body><form id="login"><input name="username"></form></body></html>`;

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, apa: string, batas = 2000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${apa}`);
    await tunggu(5);
  }
}

function buka(opsi: { monitoring: string; simpanan?: unknown; sync?: string }) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="cssmenu"><ul class="nav navbar-nav"><li><a>Home</a></li></ul><div class="about"><i class="fa fa-question-circle"></i> Help</div></div></body></html>`,
    { url: "http://192.168.10.10/SIPP/detil_perkara_agama", runScripts: "outside-only" }
  );
  const w = dom.window as any;
  const panggilan: string[] = [];
  const simpan: Record<string, unknown> = opsi.simpanan ? { sinkronEcourt: opsi.simpanan } : {};
  w.chrome = {
    storage: {
      local: {
        get: async (k: string) => (k in simpan ? { [k]: simpan[k] } : {}),
        set: async (o: Record<string, unknown>) => Object.assign(simpan, o),
      },
    },
  };
  w.fetch = async (u: string) => {
    panggilan.push(String(u));
    if (/api\/Sync$/.test(String(u))) return { ok: true, status: 200, text: async () => opsi.sync ?? '{"status":1,"message":"Sinkronisasi selesai"}' };
    return { ok: true, status: 200, text: async () => opsi.monitoring };
  };
  Object.defineProperty(w.HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 60 });
  w.eval(KODE);
  return { dom, w, panggilan, simpan, api: w.aletaSinkronEcourt };
}

describe("uraian halaman Monitoring Sinkronisasi Data", () => {
  const { w } = buka({ monitoring: "" });
  const m = w.aletaSinkronEcourt.murni;
  it("total dan baris terbaca dari markup SIPP", () => {
    const u = m.uraiHalaman(halamanMonitoring(1234, [["perkara", "99"], ["perkara_pihak1", "100"]]));
    expect(u.ok).toBe(true);
    expect(u.total).toBe(1234);
    expect(u.baris).toEqual([
      { no: "1", tabel: "perkara", dataId: "99" },
      { no: "2", tabel: "perkara_pihak1", dataId: "100" },
    ]);
  });
  it("antrian kosong: total 0, tanpa baris", () => {
    const u = m.uraiHalaman(halamanMonitoring(0, []));
    expect(u).toMatchObject({ ok: true, total: 0, baris: [] });
  });
  it("halaman masuk / dasbor bukan halamannya", () => {
    expect(m.uraiHalaman(halamanMasuk).ok).toBe(false);
    expect(m.uraiHalaman("").ok).toBe(false);
  });
  it("alamat dasar SIPP, lencana, simpanan, pesan sinkron", () => {
    expect(m.alamatDasar({ origin: "http://192.168.10.10", pathname: "/SIPP/detil_perkara_agama" })).toBe("http://192.168.10.10/SIPP/");
    expect(m.alamatDasar({ origin: "http://127.0.0.1", pathname: "/index.php/home" })).toBe("http://127.0.0.1/index.php/");
    expect(m.teksLencana(0)).toBe("");
    expect(m.teksLencana(7)).toBe("7");
    expect(m.teksLencana(5000)).toBe("999+");
    const sekarang = 1_000_000;
    expect(m.simpananSegar({ saat: sekarang - 60_000, ok: true }, sekarang)).toBe(true);
    expect(m.simpananSegar({ saat: sekarang - 6 * 60_000, ok: true }, sekarang)).toBe(false);
    expect(m.simpananSegar({ saat: sekarang - 6 * 60_000, ok: false }, sekarang)).toBe(true); // ditolak diingat lebih lama
    expect(m.pesanSinkron('{"status":0,"message":"Authentikasi Gagal"}', 200)).toEqual({ ok: false, teks: "Authentikasi Gagal" });
    expect(m.pesanSinkron("", 500).ok).toBe(false);
  });
});

describe("tombol di samping Help", () => {
  it("antrian > 0: tombol tepat di kiri Help, lencana angka, jalur baca = monitoring_sinkron", async () => {
    const t = buka({ monitoring: halamanMonitoring(3, [["perkara", "1"], ["perkara", "2"], ["perkara", "3"]]) });
    await t.api.segarkan();
    const tombol = (await sampai(() => t.w.document.getElementById("aleta-sec-tombol"), "tombol")) as HTMLElement;
    expect(tombol.classList.contains("about")).toBe(true);
    expect(tombol.nextElementSibling?.textContent).toContain("Help");
    expect(tombol.style.right).toBe("71px"); // 5 + 60 (lebar Help) + 6
    expect(tombol.textContent).toContain("Sync E-Court");
    const lencana = tombol.querySelector(".aleta-sec-lencana") as HTMLElement;
    expect(lencana.hidden).toBe(false);
    expect(lencana.textContent).toBe("3");
    expect(t.panggilan).toEqual(["http://192.168.10.10/SIPP/monitoring_sinkron"]);
  });

  it("antrian kosong: tombol ada, lencana tersembunyi", async () => {
    const t = buka({ monitoring: halamanMonitoring(0, []) });
    await t.api.segarkan();
    const tombol = (await sampai(() => t.w.document.getElementById("aleta-sec-tombol"), "tombol")) as HTMLElement;
    expect((tombol.querySelector(".aleta-sec-lencana") as HTMLElement).hidden).toBe(true);
  });

  it("peran yang dialihkan SIPP (bukan halamannya): tombol tidak dipasang dan penolakan diingat", async () => {
    const t = buka({ monitoring: halamanMasuk });
    await t.api.segarkan();
    await tunggu(30);
    expect(t.w.document.getElementById("aleta-sec-tombol")).toBeNull();
    expect((t.simpan.sinkronEcourt as any).ok).toBe(false);
  });

  it("simpanan segar dipakai bersama: tanpa membaca SIPP lagi", async () => {
    const t = buka({ monitoring: halamanMonitoring(9, []), simpanan: { saat: Date.now() - 30_000, ok: true, total: 4 } });
    await t.api.segarkan();
    const tombol = (await sampai(() => t.w.document.getElementById("aleta-sec-tombol"), "tombol")) as HTMLElement;
    expect(tombol.querySelector(".aleta-sec-lencana")!.textContent).toBe("4");
    expect(t.panggilan).toEqual([]);
  });

  it("simpanan menolak: tombol tidak muncul dan SIPP tidak dibaca", async () => {
    const t = buka({ monitoring: halamanMonitoring(9, []), simpanan: { saat: Date.now() - 60_000, ok: false, total: 0 } });
    await t.api.segarkan();
    expect(t.w.document.getElementById("aleta-sec-tombol")).toBeNull();
    expect(t.panggilan).toEqual([]);
  });
});

describe("panel", () => {
  it("membuka panel membaca antrian; Sinkronisasi data meminta konfirmasi dulu, baru memanggil api/Sync", async () => {
    const t = buka({ monitoring: halamanMonitoring(2, [["perkara", "11"], ["perkara_pihak1", "12"]]) });
    await t.api.segarkan();
    const tombol = (await sampai(() => t.w.document.getElementById("aleta-sec-tombol"), "tombol")) as HTMLElement;
    tombol.click();
    const panel = (await sampai(() => t.w.document.getElementById("aleta-sec-panel"), "panel")) as HTMLElement;
    await sampai(() => panel.querySelectorAll("table tr").length === 3, "tabel antrian");
    // panel digambar ulang sesudah bacaan segar selesai; tombol aktif = sudah stabil
    await sampai(() => (panel.querySelector(".aleta-sec-btn") as HTMLButtonElement | null)?.disabled === false, "panel stabil");
    expect(panel.textContent).toContain("Total antrian data: 2");
    expect(panel.textContent).toContain("perkara_pihak1");
    const btn = (teks: string) => Array.from(panel.querySelectorAll("button")).find((b: Element) => (b.textContent || "").includes(teks)) as HTMLButtonElement;
    const sebelum = t.panggilan.length;
    btn("Sinkronisasi data").click();
    expect((panel.querySelector(".aleta-sec-konfirmasi") as HTMLElement).hidden).toBe(false);
    expect(t.panggilan.some((u) => /api\/Sync/.test(u))).toBe(false);
    btn("Batal").click();
    expect((panel.querySelector(".aleta-sec-konfirmasi") as HTMLElement).hidden).toBe(true);
    expect(t.panggilan.some((u) => /api\/Sync/.test(u))).toBe(false);
    btn("Sinkronisasi data").click();
    btn("Ya, sinkronkan").click();
    await sampai(() => t.panggilan.some((u) => /api\/Sync$/.test(u)), "api/Sync");
    await sampai(() => (t.w.document.getElementById("aleta-sec-panel")?.textContent || "").includes("Sinkronisasi selesai"), "pesan selesai");
    expect(t.panggilan.slice(sebelum).filter((u) => /monitoring_sinkron$/.test(u)).length).toBeGreaterThanOrEqual(1);
    expect(t.panggilan.every((u) => /\/SIPP\/(monitoring_sinkron|api\/Sync)$/.test(u))).toBe(true);
  });

  it("teks yang tampil tanpa kata ALETA; Escape menutup panel", async () => {
    const t = buka({ monitoring: halamanMonitoring(1, [["perkara", "5"]]) });
    await t.api.segarkan();
    const tombol = (await sampai(() => t.w.document.getElementById("aleta-sec-tombol"), "tombol")) as HTMLElement;
    tombol.click();
    const panel = (await sampai(() => t.w.document.getElementById("aleta-sec-panel"), "panel")) as HTMLElement;
    await sampai(() => panel.querySelectorAll("table tr").length === 2, "tabel");
    expect(`${tombol.textContent} ${tombol.title} ${panel.textContent}`).not.toMatch(/aleta/i);
    t.w.document.dispatchEvent(new t.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(t.w.document.getElementById("aleta-sec-panel")).toBeNull();
  });
});

describe("terpasang", () => {
  it("manifest SIPP memuat sinkron-ecourt.js (bukan ABT); daftar tanam memuatnya; gaya panel ada terang dan gelap", () => {
    const sipp = MANIFEST.content_scripts.filter((c: any) => c.matches.some((m: string) => /\/SIPP\//.test(m)) && c.js.includes("menu-atas.js"));
    expect(sipp).toHaveLength(1);
    expect(sipp[0].js).toContain("sinkron-ecourt.js");
    const abt = MANIFEST.content_scripts.filter((c: any) => c.matches.some((m: string) => /aps_badilag/.test(m)) && c.js.includes("sinkron-ecourt.js"));
    expect(abt).toHaveLength(0);
    expect(SUSUN).toContain('"sinkron-ecourt.js"');
    expect(CSS).toContain(".aleta-sec-panel");
    expect(CSS).toMatch(/html\[data-aleta-tema-sipp="gelap"\] \.aleta-sec-panel/);
  });
});
