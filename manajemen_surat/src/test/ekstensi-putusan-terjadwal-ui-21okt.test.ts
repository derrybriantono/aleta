// @vitest-environment node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * JADWALKAN PUTUSAN - TOMBOL, PANEL SERET-LEPAS, JAM, ANTREAN (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * putusan-terjadwal.js (+ pasangan) dijalankan SUNGGUHAN di jsdom bersama panel-alat.js (hak peran, mode
 * tampilan) atas replika halaman perkara dan halaman daftar/jurnal SIPP, dengan server portal TIRUAN yang
 * menyimpan keadaannya. Yang dijaga:
 *
 *   - tombol tebal di sebelah "Putusan Otomatis" (halaman perkara) dan melayang di daftar/jurnal; hanya
 *     Super Admin/Admin/Hakim; tampilan Lama tidak berubah;
 *   - berkas yang diseret banyak sekaligus diunggah ke server dan dipasangkan menurut nomor perkara di nama
 *     dan isi: cocok / konflik / tidak cocok / ganda / bukan naskah; pasangan manual;
 *   - langkah tiap perkara, pilihan form (status putusan, verstek) yang dapat ditetapkan, jam dari pratinjau
 *     server, konfirmasi di halaman yang menyebut angka, lalu satu kiriman jadwal yang benar bentuknya;
 *   - pilihan perkara menurut tanggal di halaman daftar; antrean terjadwal dengan batal / tunda / ulangi.
 *
 * ALETA_TANGKAP_PTJ=<awalan> menyimpan HTML tiap keadaan untuk tangkapan Playwright
 * (docs/rancangan/putusan-terjadwal-21okt/tangkap.mjs).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const PASANGAN = baca("putusan-terjadwal-pasangan.js");
const PTJ = baca("putusan-terjadwal.js");
const CSS = baca("putusan-terjadwal.css");
const CSS_BERSAMA = baca("penetapan-sipp.css");

/** Isi blok CSS yang daftar selektornya memuat `selektor` PERSIS (aturan berdaftar-selektor dikenali). */
function blokCss(css: string, selektor: string): string {
  const bersih = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of bersih.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (m[1].split(",").some((x) => x.trim() === selektor)) return m[2];
  }
  return "";
}

const ASAL = "http://192.168.10.10";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string | (() => string), batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${typeof keterangan === "function" ? keterangan() : keterangan}`);
    await tunggu(10);
  }
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Panggilan = { metode: string; alamat: string; badan: any };
type Opsi = {
  peran?: string | null;
  tampilan?: "lama" | "ui";
  halaman?: "perkara" | "daftar" | "jurnal" | "dasbor" | "lain";
  /** nomor isi per nama berkas */
  isi?: Record<string, string>;
  tolakBerkas?: Record<string, string>;
  sudahPutus?: boolean;
  antrean?: any;
  buatGagal?: { pesan: string; rincian?: unknown };
  sidang?: Array<Record<string, unknown>>;
  massal?: { putusan?: any[]; tertahan?: any[] };
  tanpaPasangan?: boolean;
};

function buka(o: Opsi = {}) {
  const halaman = o.halaman ?? "perkara";
  const jalur = halaman === "perkara" ? "/SIPP/detil_perkara_agama" : halaman === "jurnal" ? "/SIPP/jurnal_perkara_list" : halaman === "dasbor" ? "/SIPP/main" : "/SIPP/perkara_list";
  const tabelDaftar =
    `<table id="daftar"><tr><th>No</th><th>Nomor</th></tr>` +
    `<tr><td>1</td><td>12/Pdt.G/2026/PA.Dgl</td></tr><tr><td>2</td><td>13/Pdt.G/2026/PA.Dgl</td></tr><tr><td>3</td><td>14/Pdt.P/2026/PA.Dgl</td></tr></table>`;
  // Daftar perkara SIPP (views/body/body.php + perkara_list.php): #pageTitle, tombol Cetak di #left, tabel di #pages.
  const isiDaftar =
    `<div id="konten-sipp"><div id="pageTitle">DAFTAR PERKARA PERDATA GUGATAN</div><hr class="thick-line">` +
    `<div id="left"><input id="cetak_perkara_list" type="submit" value="Cetak" class="btn"></div>` +
    `<div id="pages">${tabelDaftar}</div></div>`;
  // Dashboard SIPP (views/dashboard/dashboard2.php): section.content-header h1.
  const isiDasbor =
    `<section class="content-header"><h1><small>DASHBOARD PERKARA PERTAMA</small> <small>[Statistik Perkara]</small></h1></section>` +
    `<div class="konten"><section class="content">${tabelDaftar}</section></div>`;
  const isiJurnal = `<div id="pageTitle">JURNAL PERKARA</div>${tabelDaftar}`;
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">` +
      (halaman === "perkara"
        ? `<table width="100%" id="submenus"><tr><td><table><tr>` +
          `<td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara">Kembali</a></td>` +
          `<td><a class="btn btn-default btn-sm" href="#">Penetapan Majelis Hakim</a></td>` +
          `</tr></table></td></tr></table>`
        : halaman === "lain"
          ? `<form><input name="x"></form>`
          : halaman === "dasbor"
            ? isiDasbor
            : halaman === "jurnal"
              ? isiJurnal
              : isiDaftar) +
      `</div></body></html>`,
    { url: `${ASAL}${jalur}`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: o.tampilan || "ui", ujiIzinkanNyata: true };
  w.chrome = {
    runtime: { id: "uji", getManifest: () => ({ version: "1.205.19" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async (k: string | string[]) => void [k].flat().forEach((n) => delete simpanan[n]),
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });

  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);

  // ── Server portal tiruan ──
  const panggilan: Panggilan[] = [];
  const selesaiDikirim: any[] = [];
  const jalanDengan: any[] = [];
  const berkasServer = new Map<string, { nama: string; bentuk: string; nomorIsi: string }>();
  let urutBerkas = 0;
  const jawab = (data: unknown, status = 200, galat?: { pesan: string; rincian?: unknown }) => ({
    ok: status < 400,
    status,
    json: async () => (galat ? { ok: false, error: { message: galat.pesan, details: galat.rincian } } : { ok: status < 400, data }),
  });
  const antrean = o.antrean ?? { ok: true, jadwal: [], ringkasan: { menunggu: 0, jalan: 0, selesai: 0, sebagian: 0, gagal: 0, dibatalkan: 0, belumDilihat: 0, menungguPeramban: 0 }, pengaturan: { hapusHari: 7, pelaksanaNyala: true } };
  const alatAmbilTiruan = async (alamat: string, opsi: any) => {
    const metode = String((opsi && opsi.method) || "GET").toUpperCase();
    let badan: any = null;
    if (opsi && typeof opsi.body === "string") badan = JSON.parse(opsi.body);
    else if (opsi && opsi.body && typeof opsi.body.get === "function") badan = { berkas: opsi.body.get("berkas") };
    panggilan.push({ metode, alamat, badan });
    if (alamat.includes("/putusan-terjadwal/berkas")) {
      if (metode === "DELETE") return jawab({ ok: true });
      const file = badan.berkas as { name: string; size: number };
      const tolak = o.tolakBerkas && o.tolakBerkas[file.name];
      if (tolak) return jawab({ ok: false, sebab: tolak });
      urutBerkas += 1;
      const id = `ptf-${urutBerkas}`;
      const bentuk = /\.docx$/i.test(file.name) ? "docx" : /\.pdf$/i.test(file.name) ? "pdf" : /\.doc$/i.test(file.name) ? "doc" : "rtf";
      const nomorIsi = (o.isi && o.isi[file.name]) || "";
      berkasServer.set(id, { nama: file.name, bentuk, nomorIsi });
      return jawab({ ok: true, berkas: { id, nama: file.name, bentuk, ukuran: file.size, nomorIsi, peringatan: bentuk === "pdf" ? ["PDF diubah lewat ekstraksi teks saat dijalankan."] : [] } });
    }
    if (alamat.includes("/putusan-terjadwal/pratinjau")) {
      const mulai = new Date(`${badan.mulai.replace(" ", "T")}:00Z`).getTime();
      const butir = Array.from({ length: badan.jumlah }, (_, i) => {
        const t = new Date(mulai + i * 5 * 60_000).toISOString();
        return { urut: i + 1, iso: t, wita: `${t.slice(0, 10)} ${t.slice(11, 16)}` };
      });
      return jawab({ ok: true, sebab: "", benih: 4242, tidakMuat: 0, jedaMin: badan.jedaMin, jedaMaks: badan.jedaMaks, peringatan: [], butir });
    }
    if (alamat.includes("/putusan-terjadwal/ringkasan-form")) {
      const ringkasan: Record<string, unknown> = {};
      for (const b of badan.berkas) {
        ringkasan[b.berkasId] = { ada: true, sebab: "", status: { label: "Dikabulkan", keyakinan: "pasti", kutipan: "Mengabulkan gugatan", alasan: "" }, verstek: { label: "Ya", keyakinan: "pasti", kutipan: "verstek", alasan: "" } };
      }
      return jawab({ ok: true, statusTersedia: ["Dikabulkan", "Ditolak", "Tidak Diterima"], ringkasan });
    }
    if (alamat.includes("/unggah-massal")) return jawab({ ok: true, putusan: o.massal?.putusan ?? [], tertahan: o.massal?.tertahan ?? [] });
    if (alamat.includes("/aleta-ecourt/sidang")) return jawab({ available: true, sidang: o.sidang ?? [] });
    if (alamat.includes("/putusan-terjadwal/peramban") && metode === "POST") {
      if (badan.aksi === "berkas") return jawab({ ok: true, nama: "putusan.rtf", bentuk: "rtf", base64: btoa("{\rtf1 isi}") });
      if (badan.aksi === "edoc-selesai") {
        selesaiDikirim.push(badan);
        return jawab({ ok: true, status: "selesai", rincian: badan.langkah.map((l: any) => ({ langkah: l.langkah, status: l.hasil === "selesai" ? "selesai" : "gagal", catatan: l.catatan })) });
      }
    }
    if (alamat.includes("/putusan-terjadwal") && metode === "POST") {
      if (o.buatGagal) return jawab({ ok: false }, 400, o.buatGagal);
      const butir = badan.butir.map((b: any, i: number) => ({ id: `ptb-${i + 1}`, urut: i + 1, nomorPerkara: b.nomorPerkara, waktuWita: `${badan.mulai.slice(0, 16)}`, waktuIso: "", langkah: [], ringkasForm: "" }));
      return jawab({ ok: true, jadwalId: "ptj-1", akunSipp: "hakim.satu", butir, peringatan: [] });
    }
    if (alamat.includes("/putusan-terjadwal") && metode === "PATCH") return jawab({ ok: true, ringkas: `${badan.aksi} dilakukan.` });
    if (alamat.includes("/putusan-terjadwal") && metode === "GET") return jawab(antrean);
    return jawab({ ok: false, sebab: `tak dikenal: ${alamat}` }, 404);
  };

  const peran = o.peran === undefined ? "Hakim" : o.peran;
  Object.assign(w, {
    penggunaTerakhir: peran === null ? null : { nama: "Hakim Satu", peran },
    boleh: () => true,
    cariNomorPerkara: () => NOMOR,
    a30PerkaraIdUntukAbt: async (nomor: string) => String(30000 + Number(String(nomor).split("/")[0])),
    b6KeadaanPutusanTerisi: async () => (o.sudahPutus ? { terisi: true, tanggal: "2026-10-19", status: "Dikabulkan" } : { terisi: false }),
    namaPenggunaSipp: () => "Hakim Satu, S.H.",
    alatAmbil: alatAmbilTiruan,
    alatSidangPadaTanggal: async (tgl: string) => (o.sidang ?? []).map((s) => ({ ...s, tanggalSidang: tgl })),
    barisPerkaraDiHalaman: () => Array.from(w.document.querySelectorAll("#daftar tr")).slice(1).map((tr: any) => ({ nomor: tr.cells[1].textContent, baris: tr })),
  });
  w.aletaPutusanEdoc = {
    ambilKunci: async () => ({ ok: true, lepas: async () => undefined }),
    jalankan: async (p: any) => {
      jalanDengan.push({ nomorPerkara: p.nomorPerkara, perkaraId: p.perkaraId, namaBerkas: p.putusan && p.putusan.name, denganPutusan: p.denganPutusan, denganAnonim: p.denganAnonim });
      return { ok: true, bunyi: "x", langkah: [{ kunci: "anonimisasi", judul: "e-Doc anonimisasi", teks: "terunggah (disamarkan)", nada: "ok" }] };
    },
  };
  if (!o.tanpaPasangan) vm.runInContext(PASANGAN, ctx, { filename: "putusan-terjadwal-pasangan.js" });
  // Tempat tombol: Putusan Otomatis (B2) dan Buka di ABT / ALETA (L1).
  if (halaman === "perkara") {
    const baris = w.document.querySelector("#submenus td#backlist").parentElement as HTMLElement;
    const l1 = w.document.createElement("td");
    l1.className = "aleta-l1-submenu";
    l1.innerHTML = '<a href="#">Buka di ABT</a> <a href="#">Buka di ALETA</a>';
    baris.appendChild(l1);
    const pen = w.document.createElement("td");
    pen.className = "aleta-sisip aleta-pensipp aleta-pensipp-sel";
    pen.innerHTML = '<button class="aleta-pensipp-tombol">Penetapan Otomatis</button>';
    baris.insertBefore(pen, l1);
    const put = w.document.createElement("td");
    put.className = "aleta-sisip aleta-pusipp aleta-pusipp-sel";
    put.innerHTML = '<button class="aleta-pusipp-tombol">Putusan Otomatis</button>';
    baris.insertBefore(put, l1);
  }
  vm.runInContext(PTJ, ctx, { filename: "putusan-terjadwal.js" });
  return { w, d: w.document as Document, panggilan, simpanan, berkasServer, selesaiDikirim, jalanDengan };
}
type Halaman = ReturnType<typeof buka>;

const api = (h: Halaman) => h.w.aletaPutusanTerjadwal;
const tombolPt = (h: Halaman) => h.d.querySelector("#aleta-ptj-tombol") as HTMLButtonElement | null;
const panel = (h: Halaman) => h.d.getElementById("aleta-ptj-panel") as HTMLElement | null;
const q = (h: Halaman, sel: string) => panel(h)!.querySelector(sel) as HTMLElement;
const qq = (h: Halaman, sel: string) => Array.from(panel(h)!.querySelectorAll(sel)) as HTMLElement[];

async function panelSiap(h: Halaman, _lama = false) {
  await sampai(() => (api(h).pasang(h.d), tombolPt(h)), "tombol Jadwalkan Putusan");
  // 21 Okt 2026: SEMUA panel bawaannya TERLIPAT - petugas membukanya dulu (sekali).
  if (!api(h).keadaan().terbuka) {
    tombolPt(h)!.click();
    api(h).pasang(h.d);
  }
  await sampai(() => (api(h).pasang(h.d), panel(h) && !panel(h)!.hidden ? panel(h) : null), "panel terbuka");
  return panel(h)!;
}

function berkasTiruan(w: any, nama: string, ukuran = 4096) {
  const f = new w.File([new Uint8Array(ukuran)], nama);
  return f;
}
async function seret(h: Halaman, nama: string[]) {
  const zona = q(h, '[data-ptj="zona"]');
  const evt = new h.w.Event("drop", { bubbles: true, cancelable: true }) as any;
  evt.dataTransfer = { files: nama.map((n) => berkasTiruan(h.w, n)) };
  zona.dispatchEvent(evt);
  await sampai(() => api(h).keadaan().berkas.length === nama.length && api(h).keadaan().berkas.every((b: any) => b.status === "ok" || b.status === "ditolak"), "semua berkas diproses");
}

function simpanTangkapan(h: Halaman, nama: string) {
  const awalan = process.env.ALETA_TANGKAP_PTJ;
  if (!awalan) return;
  h.d.querySelectorAll("input[type=checkbox]").forEach((c) => {
    if ((c as HTMLInputElement).checked) c.setAttribute("checked", "");
    else c.removeAttribute("checked");
  });
  h.d.querySelectorAll("select").forEach((s) => {
    Array.from((s as HTMLSelectElement).options).forEach((o) => (o.selected ? o.setAttribute("selected", "") : o.removeAttribute("selected")));
  });
  h.d.querySelectorAll("input").forEach((i) => i.setAttribute("value", (i as HTMLInputElement).value));
  const luar = Array.from(h.d.querySelectorAll("body > .aleta-ptj")).map((x) => x.outerHTML).join("");
  writeFileSync(`${awalan}-${nama}.html`, h.d.getElementById("konten")!.innerHTML + luar, "utf8");
}

// ============================================================================
describe("tombol", () => {
  it("halaman perkara: tepat sesudah Putusan Otomatis (yang sesudah Penetapan Otomatis), sebelum Buka di ABT / Buka di ALETA, tebal", async () => {
    const h = buka();
    await sampai(() => (api(h).pasang(h.d), tombolPt(h)), "tombol");
    const anak = Array.from(h.d.querySelector("#submenus td#backlist")!.parentElement!.children);
    const idx = (kelas: string) => anak.findIndex((x) => x.classList.contains(kelas));
    expect(idx("aleta-ptj-sel")).toBe(idx("aleta-pusipp-sel") + 1);
    expect(idx("aleta-pusipp-sel")).toBe(idx("aleta-pensipp-sel") + 1);
    expect(idx("aleta-ptj-sel")).toBeLessThan(idx("aleta-l1-submenu"));
    expect(tombolPt(h)!.textContent).toContain("Jadwalkan Putusan");
    expect(Number(/font-weight:\s*(\d+)/.exec(blokCss(CSS_BERSAMA, ".aleta-ptj-tombol"))?.[1])).toBeGreaterThanOrEqual(800);
    for (let i = 0; i < 5; i += 1) api(h).pasang(h.d);
    expect(h.d.querySelectorAll(".aleta-ptj-sel")).toHaveLength(1);
    expect(h.d.querySelectorAll("#aleta-ptj-panel")).toHaveLength(1);
  });

  it("tanpa Putusan Otomatis di halaman: tetap tampil, sebelum Buka di ABT", async () => {
    const h = buka();
    h.d.querySelector(".aleta-pusipp-sel")!.remove();
    await sampai(() => (api(h).pasang(h.d), tombolPt(h)), "tombol");
    const anak = Array.from(h.d.querySelector("#submenus td#backlist")!.parentElement!.children);
    expect(anak.findIndex((x) => x.classList.contains("aleta-ptj-sel"))).toBe(anak.findIndex((x) => x.classList.contains("aleta-pensipp-sel")) + 1);
  });

  it("hanya Ketua, Wakil Ketua, Hakim, dan Super Admin; panitera, juru sita, dan peran belum terbaca tidak melihatnya; tampilan Lama tidak berubah", async () => {
    for (const peran of ["Super Admin", "Hakim", "Ketua", "Wakil Ketua"]) {
      const h = buka({ peran });
      await sampai(() => (api(h).pasang(h.d), tombolPt(h)), `tombol untuk ${peran}`);
    }
    for (const peran of ["Panitera Pengganti", "Juru Sita", "Panitera", "Panitera Muda", "Kasir", "Operator", "Petugas PTSP", "Analis Perkara", null]) {
      const h = buka({ peran: peran as string | null });
      // Pembanding positif lebih dulu: tombol Putusan Otomatis versi tiruan tetap ada, jadi inisialisasi sudah selesai.
      await sampai(() => (typeof h.w.alatUjiMode === "function" && h.w.alatUjiMode() !== "lama" ? true : null), "mode tampilan terbaca");
      const r = api(h).pasang(h.d);
      expect(tombolPt(h), String(peran)).toBeNull();
      expect(r.tombol).toBe(false);
    }
    const lama = buka({ tampilan: "lama" });
    await tunggu(150);
    expect(api(lama).pasang(lama.d).tombol).toBe(false);
    expect(tombolPt(lama)).toBeNull();
  });

  it("MASSAL hanya di dashboard (di samping judul DASHBOARD PERKARA) dan di daftar perkara gugatan/permohonan (di samping Cetak); jurnal dan halaman lain tidak", async () => {
    // Dashboard: tombol di dalam judul h1, tepat sesudah tulisan "[Statistik Perkara]".
    const d = buka({ halaman: "dasbor" });
    await sampai(() => (api(d).pasang(d.d), d.d.querySelector("#aleta-ptj-massal")), "tombol massal di dashboard");
    const h1 = d.d.querySelector("section.content-header h1")!;
    expect(d.d.querySelector("#aleta-ptj-massal")!.parentElement).toBe(h1);
    expect(h1.textContent).toMatch(/DASHBOARD PERKARA.*Statistik Perkara.*Jadwalkan Putusan Massal/);
    expect(api(d).pasang(d.d)).toMatchObject({ mode: "daftar", tempat: "dashboard" });
    expect(d.d.querySelector("td.aleta-ptj-sel")).toBeNull();
    // Daftar perkara: tombol tepat sesudah tombol Cetak, di wadah yang sama.
    const l = buka({ halaman: "daftar" });
    await sampai(() => (api(l).pasang(l.d), l.d.querySelector("#aleta-ptj-massal")), "tombol massal di daftar perkara");
    const cetak = l.d.getElementById("cetak_perkara_list")!;
    expect(cetak.nextElementSibling).toBe(l.d.getElementById("aleta-ptj-massal"));
    expect(api(l).pasang(l.d)).toMatchObject({ mode: "daftar", tempat: "daftar" });
    // Jurnal, formulir, dan daftar lain (banding, eksekusi, dst.) tidak diberi tombol.
    for (const halaman of ["jurnal", "lain"] as const) {
      const x = buka({ halaman });
      await sampai(() => (typeof x.w.alatUjiMode === "function" && x.w.alatUjiMode() !== "lama" ? true : null), "mode tampilan terbaca");
      expect(api(x).pasang(x.d).mode, halaman).toBe("");
      expect(x.d.querySelector(".aleta-ptj"), halaman).toBeNull();
    }
    const banding = buka({ halaman: "daftar" });
    banding.d.getElementById("pageTitle")!.textContent = "DAFTAR PERKARA BANDING";
    await sampai(() => (typeof banding.w.alatUjiMode === "function" && banding.w.alatUjiMode() !== "lama" ? true : null), "mode tampilan terbaca");
    expect(api(banding).pasang(banding.d).mode).toBe("");
    // Permohonan juga.
    const mohon = buka({ halaman: "daftar" });
    mohon.d.getElementById("pageTitle")!.textContent = "DAFTAR PERKARA PERDATA PERMOHONAN";
    await sampai(() => (api(mohon).pasang(mohon.d), mohon.d.querySelector("#aleta-ptj-massal")), "tombol massal di daftar permohonan");
  });

  it("peran lain tidak melihat tombol massal; Hakim, Ketua, Wakil Ketua, Super Admin melihatnya", async () => {
    for (const peran of ["Hakim", "Ketua", "Wakil Ketua", "Super Admin"]) {
      const h = buka({ halaman: "dasbor", peran });
      await sampai(() => (api(h).pasang(h.d), h.d.querySelector("#aleta-ptj-massal")), `tombol massal untuk ${peran}`);
    }
    for (const peran of ["Panitera Pengganti", "Panitera", "Juru Sita", "Operator", "Kasir", null]) {
      const h = buka({ halaman: "daftar", peran: peran as string | null });
      await sampai(() => (typeof h.w.alatUjiMode === "function" && h.w.alatUjiMode() !== "lama" ? true : null), "mode tampilan terbaca");
      api(h).pasang(h.d);
      expect(h.d.querySelector("#aleta-ptj-massal"), String(peran)).toBeNull();
    }
  });

  it("panel massal dan satu perkara BERBEDA: massal punya pilihan tanggal, saringan, banyak berkas, jeda; satu perkara hanya satu berkas, satu tanggal-jam", async () => {
    const m = buka({ halaman: "dasbor" });
    await panelSiap(m);
    expect(q(m, "h2").textContent).toContain("Jadwalkan Putusan Massal");
    expect(q(m, '[data-ptj="tanggal-cari"]')).toBeTruthy();
    expect(q(m, '[data-ptj="saring"]')).toBeTruthy();
    expect(q(m, '[data-ptj="pilih-berkas"]').hasAttribute("multiple")).toBe(true);
    expect(q(m, '[data-ptj="jadwal-jeda-min"]')).toBeTruthy();
    expect(q(m, '[data-ptj="acak-ulang"]')).toBeTruthy();
    expect(panel(m)!.textContent).not.toMatch(/buka dashboard atau jurnal/);
    const p = buka();
    await panelSiap(p);
    expect(q(p, "h2").textContent).not.toContain("Massal");
    expect(panel(p)!.querySelector('[data-ptj="tanggal-cari"]')).toBeNull();
    expect(panel(p)!.querySelector('[data-ptj="saring"]')).toBeNull();
    expect(q(p, '[data-ptj="pilih-berkas"]').hasAttribute("multiple")).toBe(false);
    expect(panel(p)!.querySelector('[data-ptj="jadwal-jeda-min"]')).toBeNull();
    expect(panel(p)!.querySelector('[data-ptj="acak-ulang"]')).toBeNull();
    expect(q(p, '[data-ptj="jadwal-tanggal"]')).toBeTruthy();
    expect(q(p, '[data-ptj="jadwal-jam"]')).toBeTruthy();
    // Teks "untuk banyak perkara buka dashboard..." DIHAPUS dari detil perkara.
    expect(panel(p)!.textContent).not.toMatch(/banyak perkara|dashboard atau jurnal/);
    expect(baca("putusan-terjadwal.js")).not.toContain("buka dashboard atau jurnal");
  });

  it("semua panel bawaannya TERLIPAT (satu perkara, dashboard, daftar); dibuka petugas diingat selama kunjungan ini saja", async () => {
    for (const halaman of ["perkara", "dasbor", "daftar"] as const) {
      const h = buka({ halaman });
      await sampai(() => (api(h).pasang(h.d), tombolPt(h)), `tombol di ${halaman}`);
      expect(api(h).keadaan().terbuka, halaman).toBe(false);
      expect(tombolPt(h)!.getAttribute("aria-expanded"), halaman).toBe("false");
      const ada = panel(h);
      expect(!ada || ada.hidden, halaman).toBe(true);
    }
    const h = buka();
    await sampai(() => (api(h).pasang(h.d), tombolPt(h)), "tombol");
    tombolPt(h)!.click();
    expect(panel(h)!.hidden).toBe(false);
    // 21 Okt 2026 (perbaikan): diingat di memori halaman (alatPanelTerbuka), BUKAN chrome.storage.local -
    // kunjungan berikutnya / sesudah muat ulang kembali terlipat.
    await tunggu(30);
    expect(h.simpanan.lipatanBagian).toBeUndefined();
    expect((h.w as any).alatPanelTerbuka(`jadwalkan-putusan:perkara:${api(h).keadaan().nomor}`)).toBe(true);
  });

  it("gaya: SATU gaya dan palet dengan Penetapan Otomatis (tanpa ungu tetap); kontras >= 4,5:1 terang dan gelap", () => {
    const hex = (x: string, nama: string) => new RegExp(`${nama}:\\s*(#[0-9a-fA-F]{6})`).exec(x)?.[1] || "";
    const lum = (x: string) => {
      const c = [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const rasio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const dasar = blokCss(CSS_BERSAMA, ".aleta-ptj-tombol");
    expect(dasar).toBe(blokCss(CSS_BERSAMA, ".aleta-pensipp-tombol"));
    expect(Number(/font-weight:\s*(\d+)/.exec(dasar)?.[1])).toBeGreaterThanOrEqual(800);
    expect(rasio(hex(dasar, "--ps-t-teks"), hex(dasar, "--ps-t-latar"))).toBeGreaterThanOrEqual(4.5);
    const gelap = blokCss(CSS_BERSAMA, 'html[data-aleta-tema-sipp="gelap"] .aleta-ptj-tombol');
    expect(rasio(hex(gelap, "--ps-t-teks"), hex(gelap, "--ps-t-latar"))).toBeGreaterThanOrEqual(4.5);
    // Palet panel dan tombol massal bersama (termasuk spanduk pelaksana).
    for (const sel of [".aleta-ptj-panel", ".aleta-ptj-massal", ".aleta-ptj-spanduk"]) {
      expect(blokCss(CSS_BERSAMA, sel), sel).toContain("--ps-latar:");
      expect(blokCss(CSS_BERSAMA, `html[data-aleta-tema-sipp="gelap"] ${sel}`), sel).toContain("--ps-latar:");
    }
    expect(blokCss(CSS, ".aleta-ptj-panel")).toContain("--pt-merek: var(--ps-merek)");
    expect(CSS).not.toMatch(/#4b2f8f|#3a2370|#c9b5f5|#b49be8|#1a1627/i);
    // Tidak ada lagi tombol melayang / laci tetap.
    expect(CSS).not.toMatch(/aleta-ptj-melayang|aleta-ptj-laci/);
  });
});

// ============================================================================
describe("halaman perkara: panel, seret-lepas banyak berkas, pasangan", () => {
  it("panel terbentang dengan perkara halaman ini tercentang; e-Doc tidak dapat dipilih sebelum ada berkas; isi Putusan Akhir bawaan menyala", async () => {
    const h = buka();
    await panelSiap(h);
    const k = api(h).keadaan();
    expect(k.mode).toBe("perkara");
    expect([...k.terpilih]).toHaveLength(1);
    const c = (j: string) => q(h, `[data-ptj-langkah="${k.kandidat[0].kunci}:${j}"]`) as HTMLInputElement;
    expect(c("isi").checked).toBe(true);
    expect(c("putusan").checked).toBe(false);
    expect(c("putusan").disabled).toBe(true);
    expect(c("anonim").disabled).toBe(true);
    expect(q(h, '[data-ptj="utama"]')).toBeTruthy();
  });

  it("Putusan Akhir yang SUDAH terisi di SIPP: langkah isi dimatikan dan tidak dapat dicentang (tidak ditimpa)", async () => {
    const h = buka({ sudahPutus: true });
    await panelSiap(h);
    await sampai(() => api(h).keadaan().kandidat[0].sudahPutus === true, "keadaan SIPP terbaca");
    const k = api(h).keadaan();
    const c = q(h, `[data-ptj-langkah="${k.kandidat[0].kunci}:isi"]`) as HTMLInputElement;
    expect(c.checked).toBe(false);
    expect(c.disabled).toBe(true);
    expect(panel(h)!.textContent).toMatch(/sudah terisi di SIPP: tidak ditimpa/);
  });

  it("satu berkas diseret: diunggah ke server, dipasang menurut nomor di NAMA, langkah e-Doc menyala, ringkasan form tampil", async () => {
    const h = buka({ isi: {} });
    await panelSiap(h);
    await seret(h, ["684_Pdt.G_2026_PA.Dgl putusan.rtf"]);
    await sampai(() => qq(h, '[data-status="cocok"]').length === 1, "berkas cocok");
    const unggah = h.panggilan.find((p) => p.alamat.includes("/berkas") && p.metode === "POST")!;
    expect(unggah.badan.berkas.name).toBe("684_Pdt.G_2026_PA.Dgl putusan.rtf");
    const k = api(h).keadaan();
    const c = (j: string) => q(h, `[data-ptj-langkah="${k.kandidat[0].kunci}:${j}"]`) as HTMLInputElement;
    await sampai(() => !c("putusan").disabled, "e-Doc dapat dipilih");
    expect(c("putusan").checked).toBe(true);
    expect(c("anonim").checked).toBe(true);
    await sampai(() => q(h, '[data-ptj="ringkas-form"]').textContent!.includes("Dikabulkan"), "ringkasan form");
    expect(q(h, '[data-ptj="ringkas-form"]').textContent).toMatch(/status Dikabulkan · verstek Ya/);
    simpanTangkapan(h, "perkara-berkas");
  });

  it("banyak berkas sekaligus: cocok dari nama, dari isi, konflik, tidak cocok, bukan naskah (BAS), anonimisasi, ganda - tiap status terbaca", async () => {
    const h = buka({
      halaman: "daftar",
      isi: { "putusan-akhir.rtf": "13/Pdt.G/2026/PA.Dgl", "14_Pdt.P_2026_PA.Dgl campur.rtf": "14/Pdt.P/2026/PA.Dgl" },
    });
    await panelSiap(h, true);
    const k = api(h).keadaan();
    // Tiga perkara di halaman ditambahkan dan dicentang.
    q(h, '[data-ptj="dari-halaman"]').click();
    expect([...k.terpilih]).toHaveLength(3);
    await seret(h, [
      "12_Pdt.G_2026_PA.Dgl putusan.rtf", // nama -> 12
      "putusan-akhir.rtf", // isi -> 13
      "99_Pdt.G_2026_PA.Dgl.rtf", // nomor tidak ada di daftar
      "14_Pdt.P_2026_PA.Dgl campur.rtf", // nama 14, isi 14 -> nama+isi
      "BAS 12_Pdt.G_2026_PA.Dgl.rtf", // bukan naskah (BAS) -> ditolak sebelum diunggah
      "12_Pdt.G_2026_PA.Dgl anonimisasi.rtf", // anonim -> ditolak sebelum diunggah
      "catatan.rtf", // tanpa nomor
    ]);
    const hasil = Object.fromEntries(api(h).hasilPasangan().map((x: any) => [k.berkas.find((b: any) => b.kunci === x.kunci).nama, x]));
    expect(hasil["12_Pdt.G_2026_PA.Dgl putusan.rtf"]).toMatchObject({ status: "cocok", sumber: "nama" });
    expect(hasil["putusan-akhir.rtf"]).toMatchObject({ status: "cocok", sumber: "isi" });
    expect(hasil["14_Pdt.P_2026_PA.Dgl campur.rtf"]).toMatchObject({ status: "cocok", sumber: "nama+isi" });
    expect(hasil["99_Pdt.G_2026_PA.Dgl.rtf"]).toMatchObject({ status: "tidak-cocok" });
    expect(hasil["catatan.rtf"]).toMatchObject({ status: "tanpa-nomor" });
    // BAS dan anonimisasi TIDAK sampai ke server.
    const diunggah = h.panggilan.filter((p) => p.alamat.includes("/berkas") && p.metode === "POST").map((p) => p.badan.berkas.name);
    expect(diunggah).not.toContain("BAS 12_Pdt.G_2026_PA.Dgl.rtf");
    expect(diunggah).not.toContain("12_Pdt.G_2026_PA.Dgl anonimisasi.rtf");
    const ditolak = k.berkas.filter((b: any) => b.status === "ditolak").map((b: any) => b.tolak);
    expect(ditolak.some((t: string) => /berita acara sidang/.test(t))).toBe(true);
    expect(ditolak.some((t: string) => /anonimisasi dibuat otomatis/.test(t))).toBe(true);
    // Tiap baris punya chip yang terbaca.
    expect(qq(h, '[data-status="cocok"]')).toHaveLength(3);
    expect(qq(h, '[data-status="tidak-cocok"]')).toHaveLength(1);
    expect(qq(h, '[data-status="tanpa-nomor"]')).toHaveLength(1);
    expect(qq(h, '[data-status="ditolak"]')).toHaveLength(2);
    simpanTangkapan(h, "daftar-pasangan");
  });

  it("nama dan isi menyebut perkara BERBEDA = konflik, tidak dipasang ke salah satunya; dipasang manual lewat pilihan perkara", async () => {
    const h = buka({ halaman: "daftar", isi: { "12_Pdt.G_2026_PA.Dgl x.rtf": "13/Pdt.G/2026/PA.Dgl" } });
    await panelSiap(h, true);
    q(h, '[data-ptj="dari-halaman"]').click();
    const k = api(h).keadaan();
    await seret(h, ["12_Pdt.G_2026_PA.Dgl x.rtf"]);
    const berkas = k.berkas[0];
    expect(api(h).hasilPasangan()[0].status).toBe("konflik");
    expect(qq(h, '[data-status="konflik"]')).toHaveLength(1);
    const pilih = q(h, `[data-ptj-pasang="${berkas.kunci}"]`) as HTMLSelectElement;
    pilih.value = k.kandidat.find((x: any) => x.nomor.startsWith("13/")).kunci;
    pilih.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(api(h).hasilPasangan()[0]).toMatchObject({ status: "cocok", sumber: "manual" });
  });

  it("MASSAL: dua berkas untuk satu perkara = ganda; membuang salah satunya (juga dari server) menyelesaikannya", async () => {
    const h = buka({ halaman: "daftar" });
    await panelSiap(h);
    q(h, '[data-ptj="dari-halaman"]').click();
    await seret(h, ["12_Pdt.G_2026_PA.Dgl v1.rtf", "12_Pdt.G_2026_PA.Dgl v2.docx"]);
    expect(api(h).hasilPasangan().map((x: any) => x.status)).toEqual(["ganda", "ganda"]);
    const buang = qq(h, "button").find((b) => b.getAttribute("aria-label") === "Buang 12_Pdt.G_2026_PA.Dgl v1.rtf")!;
    buang.click();
    await sampai(() => h.panggilan.some((p) => p.metode === "DELETE" && p.alamat.includes("id=ptf-1")), "berkas dibuang dari server");
    expect(api(h).hasilPasangan().map((x: any) => x.status)).toEqual(["cocok"]);
  });

  it("SATU perkara: hanya satu berkas - yang kedua MENGGANTIKAN yang pertama (yang lama dibuang dari server) dan langsung terpasang ke perkara ini walau nomornya lain", async () => {
    const h = buka();
    await panelSiap(h);
    await seret(h, ["684_Pdt.G_2026_PA.Dgl v1.rtf"]);
    expect(api(h).hasilPasangan().map((x: any) => x.status)).toEqual(["cocok"]);
    const zona = q(h, '[data-ptj="zona"]');
    const evt = new h.w.Event("drop", { bubbles: true, cancelable: true }) as any;
    evt.dataTransfer = { files: [berkasTiruan(h.w, "bebas nomor.docx"), berkasTiruan(h.w, "lain.rtf")] };
    zona.dispatchEvent(evt);
    await sampai(() => api(h).keadaan().berkas.length === 1 && api(h).keadaan().berkas[0].status === "ok", "berkas pengganti diproses");
    expect(api(h).keadaan().berkas[0].nama).toBe("bebas nomor.docx");
    await sampai(() => h.panggilan.some((p) => p.metode === "DELETE" && p.alamat.includes("id=ptf-1")), "berkas lama dibuang dari server");
    expect(api(h).hasilPasangan().map((x: any) => x.status)).toEqual(["cocok"]);
  });

  it("berkas yang ditolak server (bukan putusan) ditandai dengan sebabnya dan tidak ikut dipasangkan", async () => {
    const h = buka({ tolakBerkas: { "684_Pdt.G_2026_PA.Dgl putusan.rtf": "Berkas ini Berita Acara, bukan naskah putusan." } });
    await panelSiap(h);
    await seret(h, ["684_Pdt.G_2026_PA.Dgl putusan.rtf"]);
    expect(qq(h, '[data-status="ditolak"]')).toHaveLength(1);
    expect(panel(h)!.textContent).toMatch(/Berita Acara, bukan naskah putusan/);
    expect(api(h).hasilPasangan()).toEqual([]);
  });

  it("perkara yang disebut berkas tetapi belum dipilih dapat ditambahkan dari berkasnya (nomor induk dicari)", async () => {
    const h = buka({ halaman: "daftar" });
    await panelSiap(h, true);
    await seret(h, ["77_Pdt.G_2026_PA.Dgl putusan.rtf"]);
    expect(api(h).hasilPasangan()[0].status).toBe("tidak-cocok");
    (q(h, "[data-ptj-tambah-perkara]") as HTMLButtonElement).click();
    await sampai(() => api(h).hasilPasangan()[0] && api(h).hasilPasangan()[0].status === "cocok", "berkas dipasang sesudah perkara ditambahkan");
    expect(api(h).keadaan().kandidat.find((x: any) => x.nomor === "77/Pdt.G/2026/PA.Dgl")).toMatchObject({ perkaraId: "30077" });
  });
});

// ============================================================================
describe("jam, konfirmasi, dan satu kiriman jadwal", () => {
  async function siapKirim(h: Halaman) {
    await seret(h, ["684_Pdt.G_2026_PA.Dgl putusan.rtf"]);
    await sampai(() => api(h).keadaan().pratinjau && api(h).keadaan().pratinjau.ok, "pratinjau jam");
    await sampai(() => !(q(h, '[data-ptj="utama"]') as HTMLButtonElement).disabled, "tombol jadwalkan siap");
  }

  it("pratinjau jam dari server tampil per perkara dan ringkasannya; jeda yang diubah menghitung ulang (massal)", async () => {
    const h = buka({ halaman: "daftar" });
    await panelSiap(h);
    q(h, '[data-ptj="dari-halaman"]').click();
    await seret(h, ["12_Pdt.G_2026_PA.Dgl putusan.rtf"]);
    // Dua perkara lain di halaman dilepas: tinggal satu yang dijadwalkan.
    for (const k of api(h).keadaan().kandidat.slice(1)) {
      const cek = q(h, `[data-ptj-kandidat="${k.kunci}"]`) as HTMLInputElement;
      cek.checked = false;
      cek.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    }
    await sampai(() => api(h).keadaan().pratinjau && api(h).keadaan().pratinjau.ok, "pratinjau jam");
    expect(qq(h, '[data-ptj="jam-baris"]')[0].textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(q(h, '[data-ptj="pratinjau"]').textContent).toMatch(/1 perkara · mulai .* WITA · jeda 2-7 menit/);
    const sebelum = h.panggilan.filter((p) => p.alamat.includes("/pratinjau")).length;
    const jedaMaks = q(h, '[data-ptj="jadwal-jeda-maks"]') as HTMLInputElement;
    jedaMaks.value = "9";
    jedaMaks.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.panggilan.filter((p) => p.alamat.includes("/pratinjau")).length > sebelum, "pratinjau dihitung ulang");
    const terakhir = h.panggilan.filter((p) => p.alamat.includes("/pratinjau")).at(-1)!;
    expect(terakhir.badan).toMatchObject({ jumlah: 1, jedaMin: 120, jedaMaks: 540 });
    // Pengaturan jeda diingat untuk jadwal berikutnya.
    expect((h.simpanan.putusanTerjadwalSetelan as any).jedaMaks).toBe(9);
  });

  it("30 Okt 2026: keterangan apa yang dikerjakan tampil di kaki (bukan pertanyaan); SATU klik langsung mengirim jadwal sekali, tanpa kotak konfirmasi", async () => {
    const h = buka();
    await panelSiap(h);
    await siapKirim(h);
    expect(q(h, '[data-ptj="kaki"]').textContent).toMatch(/Putusan Akhir diisi dan disimpan lewat SIPP yang terbuka di peramban ini/);
    expect(q(h, '[data-ptj="kaki"]').textContent).toMatch(/e-Doc diunggah oleh server/);
    const utama = q(h, '[data-ptj="utama"]') as HTMLButtonElement;
    utama.click();
    utama.click();
    expect(panel(h)!.querySelector(".aleta-ptj-konfirm")).toBeNull();
    expect(q(h, '[data-ptj="ya"]')).toBeNull();
    await sampai(() => h.panggilan.some((p) => p.metode === "POST" && /putusan-terjadwal$/.test(p.alamat)), "jadwal terkirim");
    await tunggu(30);
    expect(h.panggilan.filter((p) => p.metode === "POST" && /putusan-terjadwal$/.test(p.alamat))).toHaveLength(1);
    simpanTangkapan(h, "perkara-satu-klik");
  });

  it("satu kiriman jadwal: benih pratinjau, jam, akun SIPP yang masuk, pilihan form, langkah, berkas terpasang; lalu pindah ke antrean", async () => {
    const h = buka();
    await panelSiap(h);
    await siapKirim(h);
    const k = api(h).keadaan();
    // Petugas menetapkan status putusan dan verstek sendiri.
    await sampai(() => (q(h, `[data-ptj-status="${k.kandidat[0].kunci}"]`) as HTMLSelectElement).options.length > 1, "pilihan status tersedia");
    const st = q(h, `[data-ptj-status="${k.kandidat[0].kunci}"]`) as HTMLSelectElement;
    st.value = "Ditolak";
    st.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    const vs = q(h, `[data-ptj-verstek="${k.kandidat[0].kunci}"]`) as HTMLSelectElement;
    vs.value = "T";
    vs.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    (q(h, '[data-ptj="utama"]') as HTMLButtonElement).click();
    await sampai(() => h.panggilan.some((p) => p.metode === "POST" && /putusan-terjadwal$/.test(p.alamat)), "jadwal terkirim");
    const kirim = h.panggilan.find((p) => p.metode === "POST" && /putusan-terjadwal$/.test(p.alamat))!.badan;
    expect(kirim).toMatchObject({
      benih: 4242,
      sumber: "perkara",
      namaSipp: "Hakim Satu, S.H.",
      jedaMin: 120,
      jedaMaks: 420,
      malamBoleh: false,
      lintasHari: false,
    });
    expect(kirim.mulai).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(kirim.butir).toEqual([
      {
        perkaraId: "30684",
        nomorPerkara: NOMOR,
        jenisPerkara: "",
        berkasId: "ptf-1",
        langkah: { isi: true, putusan: true, anonim: true },
        pilihan: { statusPutusan: "Ditolak", verstek: "T" },
      },
    ]);
    // Sukses: kembali ke antrean, keadaan bersih.
    await sampai(() => api(h).keadaan().tab === "antrean", "berpindah ke antrean");
    expect(panel(h)!.textContent).toMatch(/1 perkara dijadwalkan .* atas akun SIPP hakim\.satu/);
    expect(api(h).keadaan().berkas).toEqual([]);
  });

  it("langkah yang tidak dicentang tidak dikirim; perkara tanpa langkah sama sekali tidak ikut dijadwalkan", async () => {
    const h = buka();
    await panelSiap(h);
    await siapKirim(h);
    const k = api(h).keadaan();
    for (const j of ["isi", "anonim"]) {
      const c = q(h, `[data-ptj-langkah="${k.kandidat[0].kunci}:${j}"]`) as HTMLInputElement;
      c.checked = false;
      c.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    }
    await sampai(() => (q(h, '[data-ptj="utama"]') as HTMLButtonElement).textContent!.includes("Jadwalkan 1 perkara") && !(q(h, '[data-ptj="utama"]') as HTMLButtonElement).disabled, "ringkasan diperbarui");
    expect(q(h, '[data-ptj="kaki"]').textContent).toMatch(/0 isi Putusan Akhir · 1 e-Doc putusan · 0 e-Doc anonimisasi/);
    const p = q(h, `[data-ptj-langkah="${k.kandidat[0].kunci}:putusan"]`) as HTMLInputElement;
    p.checked = false;
    p.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => (q(h, '[data-ptj="utama"]') as HTMLButtonElement).disabled, "tombol mati bila tak ada langkah");
    expect(q(h, '[data-ptj="jam-baris"]').textContent).toBe("tidak dijadwalkan");
  });

  it("server menolak (satu perkara tidak sah): pesannya tampil apa adanya, keadaan tidak dibuang; akun SIPP ganda meminta pilihan akun", async () => {
    const h = buka({ buatGagal: { pesan: "684/Pdt.G/2026/PA.Dgl sudah dijadwalkan (Rabu, 21 Oktober 2026 pukul 09.00). Batalkan jadwal itu dulu bila ingin menggantinya." } });
    await panelSiap(h);
    await siapKirim(h);
    (q(h, '[data-ptj="utama"]') as HTMLButtonElement).click();
    await sampai(() => panel(h)!.querySelector(".aleta-ptj-galat"), "galat tampil");
    expect(panel(h)!.textContent).toMatch(/sudah dijadwalkan/);
    expect(api(h).keadaan().berkas).toHaveLength(1);
    expect(api(h).keadaan().tab).toBe("baru");

    const g = buka({ buatGagal: { pesan: "Anda menyimpan 2 akun SIPP (a, b). Pilih akun yang dipakai.", rincian: { kode: "akun_sipp_ganda", milik: ["a", "b"] } } });
    await panelSiap(g);
    await siapKirim(g);
    (q(g, '[data-ptj="utama"]') as HTMLButtonElement).click();
    // Temuan nyata (akun SIPP ganda): baru satu kotak muncul - pilih akun lalu jadwalkan, atau batal.
    const pilihAkun = (await sampai(() => panel(g)!.querySelector('[data-ptj="pilih-akun"]'), "pilihan akun")) as HTMLSelectElement;
    expect(Array.from(pilihAkun.options).map((o) => o.value)).toEqual(["a", "b"]);
    expect(q(g, '[data-ptj="ya"]')).toBeTruthy();
    expect(q(g, '[data-ptj="batal"]')).toBeTruthy();
  });
});

// ============================================================================
describe("massal (dashboard dan daftar perkara): perkara menurut tanggal", () => {
  const SIDANG = [
    { nomor: "21/Pdt.G/2026/PA.Dgl", perkaraId: "9021", jenis: "Cerai Gugat", agenda: "Putusan", sudahPutus: false, jam: "09:00" },
    { nomor: "22/Pdt.G/2026/PA.Dgl", perkaraId: "9022", jenis: "Cerai Talak", agenda: "Pembuktian", sudahPutus: false, jam: "10:00" },
    { nomor: "23/Pdt.G/2026/PA.Dgl", perkaraId: "9023", jenis: "Cerai Gugat", agenda: "Putusan", sudahPutus: true, jam: "11:00" },
  ];

  it("menurut tanggal sidang: sidang beragenda putusan yang belum diputus + sidang putusan yang belum diisi langsung tercentang; yang lain dapat dicentang sendiri", async () => {
    const h = buka({ halaman: "daftar", sidang: SIDANG, massal: { tertahan: [{ perkaraId: "9030", nomorPerkara: "30/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-21" }] } });
    await panelSiap(h, true);
    const tgl = q(h, '[data-ptj="tanggal-cari"]') as HTMLInputElement;
    tgl.value = "2026-10-21";
    tgl.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    (q(h, '[data-ptj="muat-tanggal"]') as HTMLButtonElement).click();
    await sampai(() => api(h).keadaan().kandidat.length >= 4, "kandidat termuat");
    const k = api(h).keadaan();
    const terpilih = k.kandidat.filter((x: any) => k.terpilih.has(x.kunci)).map((x: any) => x.nomor).sort();
    expect(terpilih).toEqual(["21/Pdt.G/2026/PA.Dgl", "30/Pdt.G/2026/PA.Dgl"]);
    expect(k.kandidat.find((x: any) => x.nomor.startsWith("23/")).sudahPutus).toBe(true);
    expect(panel(h)!.textContent).toMatch(/Putusan Akhir belum diisi di SIPP/);
    expect(panel(h)!.textContent).toMatch(/sudah diputus di SIPP/);
    simpanTangkapan(h, "daftar-tanggal");
  });

  it("menurut tanggal putus: putusan saya yang e-Doc-nya menunggu pada tanggal itu; isi Putusan Akhir mati (sudah terisi), e-Doc yang sudah ada dilewati", async () => {
    const h = buka({
      halaman: "daftar",
      massal: {
        putusan: [
          { perkaraId: "9041", nomorPerkara: "41/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalPutusan: "2026-10-19", statusPutusan: "Dikabulkan", adaPutusan: true, adaAnonim: false },
          { perkaraId: "9042", nomorPerkara: "42/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalPutusan: "2026-10-18", statusPutusan: "Dikabulkan", adaPutusan: false, adaAnonim: false },
        ],
      },
    });
    await panelSiap(h, true);
    (q(h, '[data-ptj="sumber-tanggal"]') as HTMLSelectElement).value = "putus";
    q(h, '[data-ptj="sumber-tanggal"]').dispatchEvent(new h.w.Event("change", { bubbles: true }));
    const tgl = q(h, '[data-ptj="tanggal-cari"]') as HTMLInputElement;
    tgl.value = "2026-10-19";
    tgl.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    (q(h, '[data-ptj="muat-tanggal"]') as HTMLButtonElement).click();
    await sampai(() => api(h).keadaan().kandidat.some((x: any) => x.nomor.startsWith("41/")), "kandidat pada tanggal itu");
    const k = api(h).keadaan();
    // Hanya yang bertanggal putus 19 Okt (bukan 42, bertanggal 18 Okt); baris halaman tetap ada tetapi tidak tercentang.
    expect(k.kandidat.some((x: any) => x.nomor.startsWith("42/"))).toBe(false);
    const k41 = k.kandidat.find((x: any) => x.nomor.startsWith("41/"));
    expect(k.terpilih.has(k41.kunci)).toBe(true);
    expect(k.terpilih.size).toBe(1);
    expect(k41).toMatchObject({ nomor: "41/Pdt.G/2026/PA.Dgl", sudahPutus: true, adaPutusan: true, adaAnonim: false });
    const c = (j: string) => q(h, `[data-ptj-langkah="${k41.kunci}:${j}"]`) as HTMLInputElement;
    expect(c("isi").checked).toBe(false);
    expect(c("isi").disabled).toBe(true);
    await seret(h, ["41_Pdt.G_2026_PA.Dgl putusan.rtf"]);
    await sampai(() => !c("putusan").disabled, "e-Doc dapat dipilih");
    // e-Doc putusan sudah ada di SIPP: tidak dicentang bawaannya; anonimisasi menunggu.
    expect(c("putusan").checked).toBe(false);
    expect(c("anonim").checked).toBe(true);
  });

  it("baris perkara yang tampil di daftar dapat ditambahkan sekaligus; panel terbuka di bawah daftar tombol (bukan melayang) dan tidak menutup tombolnya", async () => {
    const h = buka({ halaman: "daftar" });
    await panelSiap(h);
    expect(api(h).keadaan().kandidat.map((x: any) => x.nomor)).toEqual(["12/Pdt.G/2026/PA.Dgl", "13/Pdt.G/2026/PA.Dgl", "14/Pdt.P/2026/PA.Dgl"]);
    expect(api(h).keadaan().terpilih.size).toBe(0);
    q(h, '[data-ptj="dari-halaman"]').click();
    expect(api(h).keadaan().terpilih.size).toBe(3);
    // Panel inline: tepat sebelum #pages (tabel daftar), sesudah baris tombol (#left).
    expect(panel(h)!.nextElementSibling).toBe(h.d.getElementById("pages"));
    expect(panel(h)!.previousElementSibling).toBe(h.d.getElementById("left"));
    expect(CSS).not.toMatch(/position:\s*fixed;[^}]*bottom:\s*70px/);
  });

  it("di dashboard panel terbuka tepat di bawah judul (section.content-header)", async () => {
    const h = buka({ halaman: "dasbor" });
    await panelSiap(h);
    expect(panel(h)!.previousElementSibling).toBe(h.d.querySelector("section.content-header"));
    expect(h.d.querySelector("#aleta-ptj-tombol")!.getAttribute("aria-expanded")).toBe("true");
  });

  it("saringan: menyempitkan daftar menurut nomor, jenis, keterangan, atau majelis; 'Centang yang tampil' hanya yang tersaring", async () => {
    const h = buka({
      halaman: "daftar",
      sidang: [
        { nomor: "21/Pdt.G/2026/PA.Dgl", perkaraId: "9021", jenis: "Cerai Gugat", agenda: "Putusan", sudahPutus: false, jam: "09:00", majelis: "Majelis A" },
        { nomor: "22/Pdt.G/2026/PA.Dgl", perkaraId: "9022", jenis: "Cerai Talak", agenda: "Pembuktian", sudahPutus: false, jam: "10:00", majelis: "Majelis B" },
      ],
    });
    await panelSiap(h);
    (q(h, '[data-ptj="muat-tanggal"]') as HTMLButtonElement).click();
    await sampai(() => api(h).keadaan().kandidat.some((x: any) => x.nomor.startsWith("22/")), "kandidat termuat");
    const sar = q(h, '[data-ptj="saring"]') as HTMLInputElement;
    sar.value = "majelis b";
    sar.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    const tampil = qq(h, "[data-ptj-kandidat]");
    expect(tampil).toHaveLength(1);
    expect(panel(h)!.textContent).toContain("22/Pdt.G/2026/PA.Dgl");
    const semua = qq(h, "button").find((b) => /Centang yang tampil/.test(b.textContent || ""));
    expect(semua).toBeTruthy();
  });
});

// ============================================================================
describe("antrean terjadwal", () => {
  const BUTIR = (id: string, status: string, st: Record<string, string>, ekstra: Record<string, unknown> = {}) => ({
    id,
    jadwalId: "ptj-1",
    urut: 1,
    perkaraId: "1",
    nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    waktuIso: "2026-10-21T01:00:00.000Z",
    waktuWita: "2026-10-21 09:00",
    waktuSebut: "Rabu, 21 Oktober 2026 pukul 09.00",
    langkah: { isi: true, putusan: true, anonim: true },
    status,
    statusLangkah: st,
    catatan: { isi: "", putusan: "", anonim: "" },
    pilihan: {},
    berkasNama: "x.rtf",
    berkasBentuk: "rtf",
    berkasAda: true,
    menungguPeramban: false,
    dapatBatal: status === "menunggu",
    dapatUlang: status === "sebagian" || status === "gagal",
    dilihat: true,
    pemilikId: "u1",
    akunSipp: "hakim.satu",
    selesaiPada: "",
    ...ekstra,
  });
  const ANTREAN = {
    ok: true,
    jadwal: [
      {
        id: "ptj-1",
        dibuatNama: "Hakim Satu",
        dibuatPada: "2026-10-20T22:00:00.000Z",
        sumber: "perkara",
        tanggalAcuan: "",
        mulaiWita: "2026-10-21 09:00",
        batasAkhirWita: "",
        jedaMin: 120,
        jedaMaks: 420,
        status: "aktif",
        akunSipp: "hakim.satu",
        butir: [
          BUTIR("101", "menunggu", { isi: "menunggu", putusan: "menunggu", anonim: "menunggu" }, { menungguPeramban: true }),
          BUTIR("102", "selesai", { isi: "selesai", putusan: "selesai", anonim: "dilewati" }, { dilihat: false }),
          BUTIR("103", "sebagian", { isi: "selesai", putusan: "selesai", anonim: "tertahan" }, { catatan: { isi: "", putusan: "", anonim: "Anonimisasi masih memuat 2 bagian yang tampak data pribadi." } }),
        ],
      },
    ],
    ringkasan: { menunggu: 1, jalan: 0, selesai: 1, sebagian: 1, gagal: 0, dibatalkan: 0, belumDilihat: 1, menungguPeramban: 1 },
    pengaturan: { hapusHari: 7, pelaksanaNyala: true },
  };

  it("menampilkan status tiap langkah, sebab yang tertahan, dan peringatan menunggu SIPP terbuka; lencana tombol menghitung yang perlu dilihat", async () => {
    const h = buka({ antrean: ANTREAN });
    await panelSiap(h);
    (q(h, '[data-ptj="tab-antrean"]') as HTMLButtonElement).click();
    await sampai(() => qq(h, "[data-ptj-butir]").length === 3, "tiga butir");
    expect(qq(h, "[data-ptj-status]").map((x) => x.getAttribute("data-ptj-status"))).toEqual(
      expect.arrayContaining(["isi:menunggu", "isi:selesai", "anonim:dilewati", "anonim:tertahan"])
    );
    expect(panel(h)!.textContent).toMatch(/Anonimisasi masih memuat 2 bagian yang tampak data pribadi/);
    expect(panel(h)!.textContent).toMatch(/1 perkara menunggu pengisian Putusan Akhir di SIPP yang terbuka di peramban ini/);
    expect(q(h, '[data-ptj="tab-antrean"]').textContent).toBe("Antrean terjadwal (2)");
    expect(h.d.querySelector(".aleta-ptj-lencana")!.textContent).toBe("2");
    simpanTangkapan(h, "antrean");
  });

  it("aksi: batalkan / tunda 1 jam / ulangi / tandai dilihat / batalkan seluruh jadwal memanggil PATCH yang benar", async () => {
    const h = buka({ antrean: ANTREAN });
    await panelSiap(h);
    (q(h, '[data-ptj="tab-antrean"]') as HTMLButtonElement).click();
    await sampai(() => qq(h, "[data-ptj-butir]").length === 3, "tiga butir");
    for (const a of ["batal:101", "tunda:101", "ulang:103", "lihat:102", "batal-jadwal:ptj-1"]) {
      (q(h, `[data-ptj-aksi="${a}"]`) as HTMLButtonElement).click();
      const [aksi, id] = a.split(":");
      await sampai(() => h.panggilan.some((p) => p.metode === "PATCH" && p.badan.aksi === aksi && p.badan.id === id), `PATCH ${a}`);
    }
    expect(h.panggilan.find((p) => p.metode === "PATCH" && p.badan.aksi === "tunda")!.badan.menit).toBe(60);
    // Butir yang selesai tidak punya tombol batal.
    expect(panel(h)!.querySelector('[data-ptj-aksi="batal:102"]')).toBeNull();
  });

  it("e-Doc yang tertahan (anonimisasi): 'Selesaikan di peramban ini' mengambil berkas, menjalankan alur e-Doc yang sama dengan Putusan Otomatis, lalu mencatat hasil ke server", async () => {
    const h = buka({ antrean: ANTREAN });
    await panelSiap(h);
    (q(h, '[data-ptj="tab-antrean"]') as HTMLButtonElement).click();
    await sampai(() => qq(h, "[data-ptj-butir]").length === 3, "tiga butir");
    // Tombol hanya untuk butir yang e-Doc-nya tertahan/gagal dan Putusan Akhir-nya sudah beres.
    expect(panel(h)!.querySelector('[data-ptj-aksi="peramban:101"]')).toBeNull();
    expect(panel(h)!.querySelector('[data-ptj-aksi="peramban:102"]')).toBeNull();
    (q(h, '[data-ptj-aksi="peramban:103"]') as HTMLButtonElement).click();
    await sampai(() => h.selesaiDikirim.length === 1, "hasil dicatat ke server");
    // Hanya langkah yang tertahan yang dikerjakan: e-Doc putusan sudah selesai, tidak diunggah ulang.
    expect(h.jalanDengan).toEqual([{ nomorPerkara: "103/Pdt.G/2026/PA.Dgl", perkaraId: "1", namaBerkas: "putusan.rtf", denganPutusan: false, denganAnonim: true }]);
    expect(h.selesaiDikirim[0]).toMatchObject({ aksi: "edoc-selesai", id: "103", langkah: [{ langkah: "anonim", hasil: "selesai", catatan: "terunggah (disamarkan)" }] });
    await sampai(() => panel(h)!.textContent!.includes("103/Pdt.G/2026/PA.Dgl: e-Doc anonimisasi selesai"), "hasil tampil");
  });

  it("pelaksana server dimatikan admin: dikatakan di antrean", async () => {
    const h = buka({ antrean: { ...ANTREAN, pengaturan: { hapusHari: 7, pelaksanaNyala: false } } });
    await panelSiap(h);
    (q(h, '[data-ptj="tab-antrean"]') as HTMLButtonElement).click();
    await sampai(() => panel(h)!.textContent!.includes("DIMATIKAN oleh admin"), "peringatan pelaksana mati");
  });
});

// ============================================================================
describe("tidak ada tulisan ke SIPP dari layar ini", () => {
  it("berkas ini tidak mengirim apa pun ke alamat SIPP, tidak memanggil jembatan, dan tidak memuat kata ALETA dalam data yang dikirim ke SIPP", () => {
    expect(PTJ).not.toMatch(/kirimKeJembatan|manage_|validateInput|\/SIPP\//);
    // Semua permintaan lewat portal (/aleta/api/...).
    const alamat = [...PTJ.matchAll(/"(\/aleta\/api\/[^"]+)"/g)].map((m) => m[1]);
    expect(alamat.length).toBeGreaterThan(4);
    expect(alamat.every((a) => a.startsWith("/aleta/api/aleta-ecourt/"))).toBe(true);
  });
});
