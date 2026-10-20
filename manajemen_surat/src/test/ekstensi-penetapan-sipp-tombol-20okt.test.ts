// @vitest-environment node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENETAPAN OTOMATIS DI HALAMAN PERKARA SIPP (20 Okt 2026, butir 4 dan 8)
 * ============================================================================
 *
 * ekstensi-sipp/penetapan-sipp.js dijalankan SUNGGUHAN di jsdom bersama
 * panel-alat.js, basmassal.js, konten.js, dan sipp-ide-l1.js atas replika
 * halaman perkara SIPP (deretan tombol #submenus). Yang dijaga:
 *
 *   - tombol "Penetapan Otomatis" tebal, PALING KIRI sebelum Buka di ABT /
 *     Buka di ALETA, kontras cukup di tema terang dan gelap;
 *   - akun yang tidak berhak tidak melihat tombol maupun panel;
 *   - panel terbentang, e-Doc tercentang semua, konfirmasi di halaman berangka;
 *   - SATU klik: uji kering, satu transaksi tulis, lalu unggah e-Doc yang
 *     dicentang, berurutan; yang sudah tercatat dilewati; gagal dilaporkan;
 *   - kunci: dua klik bersamaan tidak menulis dua kali.
 *
 * ALETA_TANGKAP_PENSIPP=<awalan> menyimpan HTML tiap keadaan untuk tangkapan
 * Playwright (docs/rancangan/penetapan-sipp-20okt/tangkap.mjs).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");
const KONTEN = baca("konten.js");
const L1 = baca("sipp-ide-l1.js");
const PENSIPP = baca("penetapan-sipp.js");
const CSS = baca("penetapan-sipp.css");

const ASAL = "http://192.168.10.10";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const AKUN = "Derry Briantono";
const HARI = "2026-10-20";

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string | (() => string), batas = 9000): Promise<NonNullable<T>> {
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

type Jenis = "pmh" | "ppp" | "pjs" | "phs";
type Keadaan = Record<Jenis, string>;
const JENIS: Jenis[] = ["pmh", "ppp", "pjs", "phs"];
const kosong = (): Keadaan => ({ pmh: "", ppp: "", pjs: "", phs: "" });

function usulanUntuk(keadaan: Keadaan) {
  const adaPmh = Boolean(keadaan.pmh);
  return {
    ok: true,
    perkara: { perkaraId: 10260, nomorPerkara: NOMOR, jenisPerkaraId: 347, tanggalDaftar: HARI },
    penetapan: {
      ada: adaPmh,
      ...keadaan,
      sidangPertama: keadaan.phs ? "2026-11-02" : "",
      majelisKode: adaPmh ? "C1|C2|C3" : "",
      majelisNama: adaPmh ? "Himawan Tatura Wijaya, Idris, Derry Briantono" : "",
      paniteraText: keadaan.ppp ? "Panitera Pengganti: Sri Susilowati" : "",
      jurusitaText: keadaan.pjs ? "Jurusita: Mustini" : "",
    },
    tanggalPenetapan: keadaan.pmh || HARI,
    bentuk: { bentuk: "majelis" },
    pmh: {
      bentuk: "majelis",
      majelisKode: "C",
      sebab: "beban paling ringan",
      anggota: [
        { hakimId: 26, nama: "Himawan Tatura Wijaya" },
        { hakimId: 28, nama: "Idris" },
        { hakimId: 31, nama: "Derry Briantono" },
      ],
      hitungan: [
        { hakimId: 26, nama: "Himawan Tatura Wijaya", jumlah: 5 },
        { hakimId: 32, nama: "Fahri Saifuddin", jumlah: 3 },
      ],
      susunanTerpakai: [
        { kunci: "26-28-31", hakimId: [26, 28, 31], majelisKode: "C", anggota: [{ nama: "Himawan Tatura Wijaya" }, { nama: "Idris" }, { nama: "Derry Briantono" }], perkara: 5 },
        { kunci: "32-33-30", hakimId: [32, 33, 30], majelisKode: "A", anggota: [{ nama: "Fahri Saifuddin" }, { nama: "Wakil Ketua" }, { nama: "Hakim Lain" }], perkara: 3 },
      ],
    },
    ppp: {
      usulan: { id: 30, paniteraId: 30, kode: "PP3", nama: "Sri Susilowati" },
      calon: [
        { id: 30, paniteraId: 30, kode: "PP3", nama: "Sri Susilowati", jumlah: 4 },
        { id: 31, paniteraId: 31, kode: "PP4", nama: "Mannaria", jumlah: 6 },
      ],
      sebab: "panitera sidang Majelis C menurut SK",
    },
    pjs: {
      usulan: { id: 12, jurusitaId: 12, nama: "Mustini" },
      calon: [
        { id: 12, jurusitaId: 12, nama: "Mustini", jumlah: 2 },
        { id: 13, jurusitaId: 13, nama: "Tanty", jumlah: 3 },
      ],
      sebab: "giliran",
    },
    phs: { usulan: "2026-11-02", sebut: "Senin, 02 November 2026", calon: [], sebab: "hari sidang Majelis C" },
    acuanMajelis: { dariTercatat: adaPmh, majelisKode: "C" },
    tercatat: { ada: adaPmh, ketuaHakimId: adaPmh ? 26 : 0, ketuaNama: adaPmh ? "Himawan Tatura Wijaya" : "", hakim: [] },
  };
}

function rencanaUntuk() {
  const calon = (jenis: string) => [
    { username: `${jenis}-1`, namaLengkap: `Pejabat ${jenis.toUpperCase()} Satu`, sebutan: "Ketua", otomatis: true },
    { username: `${jenis}-2`, namaLengkap: `Pejabat ${jenis.toUpperCase()} Dua`, sebutan: "Wakil" },
  ];
  return {
    langkah: JENIS.map((jenis) => ({
      jenis,
      akun: { username: `${jenis}-1`, namaLengkap: `Pejabat ${jenis.toUpperCase()} Satu`, sebutan: "Ketua" },
      calon: jenis === "phs" ? [] : calon(jenis),
    })),
  };
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Kiriman = { url: string; cara: string; badan: string };
type Opsi = {
  tampilan?: "lama" | "ui" | "baru";
  kapabilitas?: Record<string, boolean> | null;
  urutL1?: "sebelum" | "sesudah";
  gagalKering?: Jenis;
  edocSudah?: Jenis[];
  tahanUnggah?: { lepas: () => void; menunggu: Promise<void> } | null;
  edocGagal?: Jenis;
  aktif?: boolean;
};

function buka(keadaan: Keadaan, o: Opsi = {}) {
  const tampilan = o.tampilan || "ui";
  const kepala =
    `<table class="badge"><tr><td>Selamat Datang <font color='red'>${AKUN}</font>` +
    `<br> Anda Login Sebagai <font color='red'>Administrator</font></td></tr></table>`;
  const html =
    kepala +
    `<table width="100%" id="submenus"><tr><td><table><tr>` +
    `<td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara">Kembali</a></td>` +
    `<td><a class="btn btn-default btn-sm" href="#">Penetapan Majelis Hakim</a></td>` +
    `</tr></table></td></tr></table>` +
    `<div id="tabs1"><table class="data-umum">` +
    `<tr><td id="first-child">Nomor Perkara</td><td colspan="2">${NOMOR}</td></tr>` +
    `<tr><td id="first-child">Jenis Perkara</td><td colspan="2">Cerai Gugat</td></tr>` +
    `</table></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${html}</div></body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  let konfirmDipanggil = 0;
  w.confirm = () => {
    konfirmDipanggil += 1;
    return true;
  };
  const simpanan: Record<string, unknown> = {
    ujiTampilan: tampilan,
    ujiIzinkanNyata: true,
    lipatanBagian: { penunjukan: true, kerjakan: true },
    ...(o.aktif === false ? { aktif: false } : {}),
  };
  const pesanLatar: any[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.205.18" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async (m: any) => {
        pesanLatar.push(m);
        if (m && m.jenis === "relaas-rtf") return { ok: true, rtfBase64: "e1xydGYxIFBNSH0=" };
        return {};
      },
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const kapabilitas = o.kapabilitas === undefined ? null : o.kapabilitas;
  const kiriman: Kiriman[] = [];
  const edocSudah = o.edocSudah || [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    kiriman.push({ url, cara, badan: typeof opsi?.body === "string" ? opsi.body : "" });
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama: "SUPER ADMIN DERRY", peran: "Super Admin", kapabilitas } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = {
        ok: true,
        data: {
          available: true,
          pengguna: { nama: "SUPER ADMIN DERRY", peran: "Super Admin" },
          kapabilitas,
          konteks: {
            ok: true,
            nomorPerkara: NOMOR,
            nomorRegister: "",
            identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
            ringkasan: { dokumen: 0 },
            dokumen: [],
            selisih: [],
            nomorPihak: [],
            diperiksaPada: new Date().toISOString(),
            ambangMendesakHari: 3,
            hakim: null,
          },
        },
      };
    } else if (url.includes("/aleta-bot/penunjukan/borang")) {
      isi = { ok: true, data: { bolehMengisi: true, medan: [], borang: [], bolehJenis: {}, untukJabatan: {}, antrean: [] } };
    } else if (url.includes("/aleta-bot/penunjukan/ruangan")) {
      isi = { ok: true, data: { ruangan: [] } };
    } else if (url.includes("/aleta-bot/penunjukan/riwayat")) {
      isi = { ok: true, data: { riwayat: [] } };
    } else if (url.includes("/aleta-bot/penunjukan?")) {
      isi = { ok: true, data: { available: true, usulan: usulanUntuk(keadaan), rencana: rencanaUntuk(), bolehOtomatis: true } };
    } else if (url.includes("/aleta-bot/penunjukan/tulis") && cara === "POST") {
      const badan = JSON.parse(String(opsi?.body || "{}"));
      if (Array.isArray(badan.rantai)) {
        for (const s of badan.rantai) keadaan[s.jenis as Jenis] = HARI;
        isi = { ok: true, utuh: true, hasil: badan.rantai.map((s: { jenis: string }) => ({ jenis: s.jenis, ok: true, langkah: [{ tabel: "perkara_penetapan" }] })) };
      } else if (keadaan[badan.jenis as Jenis]) {
        status = 409;
        isi = { ok: false, alasan: `${badan.jenis}_sudah_ada` };
      } else if (o.gagalKering === badan.jenis) {
        status = 409;
        isi = { ok: false, alasan: "jurusita_tidak_aktif" };
      } else {
        isi = { ok: true, langkah: [{ tabel: "perkara_penetapan" }], andaian: [], tanggalPenetapan: badan.tanggalPenetapan };
      }
    } else if (url.includes("/penetapan-edoc/peta-penetapan")) {
      isi = { ok: true, data: { butir: JENIS.map((j) => ({ jenis: j, aktif: true, namaBerkas: `@ ${j}.rtf`, kelompok: "Form Bantu PTSP", otomatisUnggah: true })) } };
    } else if (url.includes("/penetapan-edoc/peta?")) {
      isi = {
        ok: true,
        data: {
          perkara: { perkaraId: 10260 },
          jenis: JENIS.map((j) => ({ jenis: j.toUpperCase(), tersedia: true, sudahDiunggah: edocSudah.includes(j), terakhirDiunggah: edocSudah.includes(j) ? "2026-10-19 10:00:00" : "" })),
        },
      };
    } else if (url.includes("/penetapan-edoc/unggah") && cara === "POST") {
      const b = JSON.parse(String(opsi?.body || "{}"));
      const jenisKirim = String((b.abt && b.abt[0] && b.abt[0].jenis) || "").toLowerCase();
      if (o.tahanUnggah) await o.tahanUnggah.menunggu;
      if (o.edocGagal === jenisKirim) {
        isi = { ok: true, data: { ok: true, berkas: [{ jenis: jenisKirim.toUpperCase(), ok: false, sebab: "tanda tangan pejabat belum disahkan" }] } };
      } else {
        isi = { ok: true, data: { ok: true, berkas: [{ jenis: jenisKirim.toUpperCase(), ok: true, tandaTangan: "Pejabat" }] } };
      }
    }
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      url,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => polos(isi),
      text: async () => JSON.stringify(isi ?? {}),
      clone: () => r,
    };
    return r;
  };
  const pmAsli = w.postMessage.bind(w);
  w.postMessage = (data: any, asal: string) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id } = data;
      const balas = data.jenis === "pilihan" ? { ok: true, tampak: false, pilihan: [], nilaiSekarang: "" } : { ok: true, medan: [] };
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ...balas }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(KONTEN, ctx, { filename: "konten.js" });
  if ((o.urutL1 || "sebelum") === "sebelum") {
    vm.runInContext(L1, ctx, { filename: "sipp-ide-l1.js" });
    vm.runInContext(PENSIPP, ctx, { filename: "penetapan-sipp.js" });
  } else {
    vm.runInContext(PENSIPP, ctx, { filename: "penetapan-sipp.js" });
    vm.runInContext(L1, ctx, { filename: "sipp-ide-l1.js" });
  }
  return { w, d: w.document as Document, kiriman, pesanLatar, keadaan, konfirmDipanggil: () => konfirmDipanggil };
}
type Halaman = ReturnType<typeof buka>;

const api = (h: Halaman) => h.w.aletaPenetapanSipp;
const tombolPen = (h: Halaman) => h.d.querySelector(".aleta-pensipp-tombol") as HTMLButtonElement | null;
const panel = (h: Halaman) => h.d.getElementById("aleta-pensipp-panel") as HTMLElement | null;
const langkah = (h: Halaman, j: Jenis) => panel(h)!.querySelector(`.aleta-pensipp-langkah[data-jenis="${j}"]`) as HTMLElement;
const statusTeks = (h: Halaman, j: Jenis) => String(langkah(h, j)?.querySelector('[data-pensipp="status"]')?.textContent || "");
const utama = (h: Halaman) => panel(h)!.querySelector('[data-pensipp="utama"]') as HTMLButtonElement;
/** Teks yang terlihat: tanpa rincian pemeriksaan yang disembunyikan. */
const teksTampak = (h: Halaman) => {
  const salin = panel(h)!.cloneNode(true) as HTMLElement;
  salin.querySelectorAll(".aleta-pensipp-tersembunyi").forEach((x) => x.remove());
  return String(salin.textContent || "");
};
const edocCek = (h: Halaman, j: Jenis) => panel(h)!.querySelector(`[data-pensipp-edoc="${j}"]`) as HTMLInputElement;

/** Menunggu tombol muncul (pasang dipanggil tiap putaran, tanpa menunggu detak 1 dtk). */
async function tombolSiap(h: Halaman) {
  return sampai(() => {
    api(h)?.pasang(h.d);
    return tombolPen(h);
  }, () => `tombol Penetapan Otomatis; badan: ${String(h.d.body.textContent || "").slice(0, 200)}`);
}

/** Panel dengan usulan termuat: empat langkah bertulis dan tombol utama hidup. */
async function panelSiap(h: Halaman) {
  await tombolSiap(h);
  await sampai(() => {
    api(h).pasang(h.d);
    const p = panel(h);
    return p && p.querySelectorAll(".aleta-pensipp-langkah").length === 4 && !/memuat…/.test(p.textContent || "") && utama(h) && !utama(h).disabled ? p : null;
  }, () => `panel siap; isi: ${String(panel(h)?.textContent || "").slice(0, 400)}`);
  return panel(h)!;
}

const tulisPost = (h: Halaman) => h.kiriman.filter((x) => x.url.includes("/penunjukan/tulis") && x.cara === "POST").map((x) => JSON.parse(x.badan));
const unggahPost = (h: Halaman) => h.kiriman.filter((x) => x.url.includes("/penetapan-edoc/unggah") && x.cara === "POST").map((x) => JSON.parse(x.badan));
const jenisUnggah = (h: Halaman) => unggahPost(h).map((b) => String(b.abt[0].jenis).toLowerCase());

async function klikSatuKali(h: Halaman) {
  utama(h).click();
  await sampai(() => panel(h)!.querySelector('[data-pensipp="konfirmasi"]'), "konfirmasi tampil");
  (panel(h)!.querySelector('[data-pensipp="ya"]') as HTMLButtonElement).click();
}
async function tungguLaporan(h: Halaman) {
  return sampai(() => {
    const l = panel(h)!.querySelector('[data-pensipp="laporan"]') as HTMLElement;
    return l && !l.hidden && /Selesai|belum selesai|Berhenti|diantrekan/.test(l.textContent || "") ? l : null;
  }, () => `laporan; panel: ${String(panel(h)?.textContent || "").slice(0, 600)}`);
}

function simpanTangkapan(h: Halaman, nama: string) {
  const awalan = process.env.ALETA_TANGKAP_PENSIPP;
  if (!awalan) return;
  const html = h.d.getElementById("konten")!.innerHTML;
  writeFileSync(`${awalan}-${nama}.html`, html, "utf8");
}

// ============================================================================
describe("tombol: paling kiri, tebal, hanya untuk yang berhak", () => {
  it("muncul paling kiri sebelum Buka di ABT / Buka di ALETA (l1 lebih dulu dimuat)", async () => {
    const h = buka(kosong(), { urutL1: "sebelum" });
    const t = await tombolSiap(h);
    await sampai(() => h.d.querySelector(".aleta-l1-submenu"), "tautan l1");
    api(h).pasang(h.d);
    expect(t.textContent).toContain("Penetapan Otomatis");
    const baris = h.d.querySelector("#submenus td#backlist")!.parentElement!;
    const anak = Array.from(baris.children);
    const iTombol = anak.findIndex((x) => x.classList.contains("aleta-pensipp-sel"));
    const iL1 = anak.findIndex((x) => x.classList.contains("aleta-l1-submenu"));
    expect(iTombol).toBeGreaterThan(-1);
    expect(iL1).toBeGreaterThan(-1);
    expect(iTombol).toBeLessThan(iL1);
    const kiriL1 = anak[iL1].querySelectorAll("a");
    expect(Array.from(kiriL1).map((a) => a.textContent)).toEqual(["Buka di ABT", "Buka di ALETA"]);
  });

  it("tetap paling kiri bila skripnya dimuat sebelum l1", async () => {
    const h = buka(kosong(), { urutL1: "sesudah" });
    await tombolSiap(h);
    await sampai(() => h.d.querySelector(".aleta-l1-submenu"), "tautan l1");
    api(h).pasang(h.d);
    const anak = Array.from(h.d.querySelector("#submenus td#backlist")!.parentElement!.children);
    expect(anak.findIndex((x) => x.classList.contains("aleta-pensipp-sel"))).toBeLessThan(anak.findIndex((x) => x.classList.contains("aleta-l1-submenu")));
  });

  it("gaya: huruf tebal (>= 700) dan kontras >= 4,5:1 di tema terang dan gelap", () => {
    const ambil = (selektor: string) => {
      const m = CSS.replace(/\/\*[\s\S]*?\*\//g, "").match(new RegExp(`${selektor.replace(/[.[\]"=-]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
      return m ? m[1] : "";
    };
    const dasar = ambil(".aleta-pensipp-tombol");
    expect(Number(/font-weight:\s*(\d+)/.exec(dasar)?.[1])).toBeGreaterThanOrEqual(700);
    const hex = (s: string, nama: string) => new RegExp(`${nama}:\\s*(#[0-9a-fA-F]{6})`).exec(s)?.[1] || "";
    const lum = (h: string) => {
      const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const rasio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const terang = rasio(hex(dasar, "--ps-t-teks"), hex(dasar, "--ps-t-latar"));
    const gelap = ambil('html[data-aleta-tema-sipp="gelap"] .aleta-pensipp-tombol');
    const gelapRasio = rasio(hex(gelap, "--ps-t-teks"), hex(gelap, "--ps-t-latar"));
    expect(terang).toBeGreaterThanOrEqual(4.5);
    expect(gelapRasio).toBeGreaterThanOrEqual(4.5);
    // tombol utama panel juga terbaca di kedua tema
    const pTerang = ambil(".aleta-pensipp-panel");
    const pGelap = ambil('html[data-aleta-tema-sipp="gelap"] .aleta-pensipp-panel');
    expect(rasio(hex(pTerang, "--ps-merek-teks"), hex(pTerang, "--ps-merek"))).toBeGreaterThanOrEqual(4.5);
    expect(rasio(hex(pGelap, "--ps-merek-teks"), hex(pGelap, "--ps-merek"))).toBeGreaterThanOrEqual(4.5);
  });

  it("akun tanpa kewenangan menulis penetapan tidak melihat tombol maupun panel", async () => {
    const h = buka(kosong(), { kapabilitas: { penunjukan: true, kerjakan: false } });
    await sampai(() => typeof h.w.penggunaTerakhir !== "undefined" || true, "pengguna");
    await tunggu(700);
    api(h).pasang(h.d);
    expect(tombolPen(h)).toBeNull();
    expect(panel(h)).toBeNull();
    expect(h.d.querySelector(".aleta-pensipp")).toBeNull();
  });

  it("akun tanpa papan penunjukan juga tidak melihatnya", async () => {
    const h = buka(kosong(), { kapabilitas: { penunjukan: false, kerjakan: true } });
    await tunggu(700);
    api(h).pasang(h.d);
    expect(tombolPen(h)).toBeNull();
  });

  it("tampilan Lama tidak berubah: tidak ada tombol", async () => {
    const h = buka(kosong(), { tampilan: "lama" });
    await tunggu(700);
    api(h).pasang(h.d);
    expect(tombolPen(h)).toBeNull();
    expect(panel(h)).toBeNull();
  });

  it("ALETA dimatikan dari popup: tidak ada tombol", async () => {
    const h = buka(kosong(), { aktif: false });
    await tunggu(700);
    api(h).pasang(h.d);
    expect(tombolPen(h)).toBeNull();
  });
});

describe("panel: terbentang, empat langkah, e-Doc tercentang semua", () => {
  it("bawaan terbentang; empat langkah dengan pejabat, isi, dan status 'akan ditulis'", async () => {
    const h = buka(kosong());
    const p = await panelSiap(h);
    expect(p.hidden).toBe(false);
    expect(tombolPen(h)!.getAttribute("aria-expanded")).toBe("true");
    expect(p.previousElementSibling!.id).toBe("submenus");
    expect(Array.from(p.querySelectorAll(".aleta-pensipp-langkah")).map((x) => x.getAttribute("data-jenis"))).toEqual(JENIS);
    for (const j of JENIS) expect(statusTeks(h, j)).toBe("akan ditulis");
    expect(langkah(h, "pmh").textContent).toContain("Himawan Tatura Wijaya");
    expect(langkah(h, "pmh").textContent).toContain("Ditetapkan");
    expect(langkah(h, "ppp").textContent).toContain("Sri Susilowati");
    expect(langkah(h, "pjs").textContent).toContain("Mustini");
    expect(langkah(h, "phs").textContent).toContain("02 November 2026");
    expect(langkah(h, "pmh").textContent).not.toMatch(/\(akun /);
    expect(p.textContent).toContain("Atas akun pejabat berwenang");
    simpanTangkapan(h, "1-awal");
  });

  it("semua kotak 'Unggah e-Doc' dan 'Centang semua' tercentang; ringkasan berangka", async () => {
    const h = buka(kosong());
    const p = await panelSiap(h);
    for (const j of JENIS) expect(edocCek(h, j).checked).toBe(true);
    expect((p.querySelector('[data-pensipp="semua"]') as HTMLInputElement).checked).toBe(true);
    expect(p.querySelector(".aleta-pensipp-ringkas")!.textContent).toBe("4 penetapan · 4 akan ditulis · 4 e-Doc dicentang");
    expect(utama(h).textContent).toBe("Tetapkan & unggah e-Doc");
  });

  it("'Centang semua' mencabut dan memasang semua; mencabut satu mematikan 'Centang semua'", async () => {
    const h = buka(kosong());
    const p = await panelSiap(h);
    const semua = p.querySelector('[data-pensipp="semua"]') as HTMLInputElement;
    semua.checked = false;
    semua.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    for (const j of JENIS) expect(edocCek(h, j).checked).toBe(false);
    edocCek(h, "pmh").checked = true;
    edocCek(h, "pmh").dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect((panel(h)!.querySelector('[data-pensipp="semua"]') as HTMLInputElement).checked).toBe(false);
    expect(panel(h)!.querySelector(".aleta-pensipp-ringkas")!.textContent).toContain("1 e-Doc dicentang");
    const s2 = panel(h)!.querySelector('[data-pensipp="semua"]') as HTMLInputElement;
    s2.checked = true;
    s2.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    for (const j of JENIS) expect(edocCek(h, j).checked).toBe(true);
  });

  it("tombol pembuka melipat dan membentang panel", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    tombolPen(h)!.click();
    expect(panel(h)!.hidden).toBe(true);
    expect(tombolPen(h)!.getAttribute("aria-expanded")).toBe("false");
    tombolPen(h)!.click();
    expect(panel(h)!.hidden).toBe(false);
  });

  it("memakai objek data yang SAMA dengan papan di panel ALETA (satu sumber keadaan)", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    const bersama = h.w.eval("usulanTerakhir");
    expect(bersama).toBeTruthy();
    expect(api(h).keadaan().data).toBe(bersama);
  });
});

describe("mode Otomatis / Manual", () => {
  it("Manual membuka pilihan (dropdown panitera, juru sita); Otomatis kembali ke usulan", async () => {
    const h = buka(kosong());
    const p = await panelSiap(h);
    const pil = (n: string) => p.querySelector(`[data-pensipp-mode="${n}"]`) as HTMLButtonElement;
    expect(pil("otomatis").getAttribute("aria-pressed")).toBe("true");
    pil("manual").click();
    await sampai(() => panel(h)!.querySelector(".aleta-pensipp-rinci .aleta-pilih"), "dropdown manual");
    expect(pil("manual").getAttribute("aria-pressed")).toBe("true");
    expect(h.w.eval("usulanTerakhir.caraPapan")).toBe("manual");
    const rk = panel(h)!.querySelector(".aleta-pensipp-rinci-kotak") as HTMLDetailsElement;
    expect(rk.open).toBe(true);
    expect(panel(h)!.querySelector(".aleta-pensipp-rinci .aleta-tombol-tetapkan")).toBeNull();
    // pilih Mannaria sebagai panitera pengganti
    const kotakPp = Array.from(panel(h)!.querySelectorAll(".aleta-pilih")).find((x) => /Panitera pengganti/.test(x.textContent || ""))!;
    const sel = kotakPp.querySelector("select") as HTMLSelectElement;
    const opsi = Array.from(sel.options).find((x) => /Mannaria/.test(x.textContent || ""))!;
    sel.value = opsi.value;
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => /Mannaria/.test(langkah(h, "ppp").textContent || ""), () => `ppp: ${langkah(h, "ppp").textContent}`);
    expect(langkah(h, "ppp").textContent).toContain("Mode manual");
    simpanTangkapan(h, "6-manual");
    pil("otomatis").click();
    await sampai(() => /Sri Susilowati/.test(langkah(h, "ppp").textContent || ""), "kembali ke usulan");
    expect(h.w.eval("usulanTerakhir.caraPapan")).toBe("otomatis");
  });

  it("pilihan manual ikut tertulis: PP pilihan masuk rantai tulis", async () => {
    const h = buka(kosong());
    const p = await panelSiap(h);
    (p.querySelector('[data-pensipp-mode="manual"]') as HTMLButtonElement).click();
    await sampai(() => panel(h)!.querySelector(".aleta-pensipp-rinci .aleta-pilih"), "dropdown manual");
    const kotakPp = Array.from(panel(h)!.querySelectorAll(".aleta-pilih")).find((x) => /Panitera pengganti/.test(x.textContent || ""))!;
    const sel = kotakPp.querySelector("select") as HTMLSelectElement;
    sel.value = Array.from(sel.options).find((x) => /Mannaria/.test(x.textContent || ""))!.value;
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => /Mannaria/.test(langkah(h, "ppp").textContent || ""), "ppp Mannaria");
    await klikSatuKali(h);
    await tungguLaporan(h);
    const rantai = tulisPost(h).find((b) => Array.isArray(b.rantai))!;
    const ppp = rantai.rantai.find((x: { jenis: string }) => x.jenis === "ppp");
    expect(JSON.stringify(ppp)).toMatch(/31/);
  });
});

describe("satu klik: konfirmasi di halaman, tulis lalu unggah", () => {
  it("konfirmasi di halaman (bukan confirm) menyebut jumlah ditulis dan diunggah; Batal tidak mengirim apa pun", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    utama(h).click();
    const k = await sampai(() => panel(h)!.querySelector('[data-pensipp="konfirmasi"]') as HTMLElement | null, "konfirmasi");
    expect(k.textContent).toContain("4 penetapan akan ditulis ke SIPP dan 4 e-Doc diunggah.");
    expect(k.textContent).toContain("Yang sudah tercatat dilewati");
    simpanTangkapan(h, "2-konfirmasi");
    const sebelum = h.kiriman.length;
    (k.querySelector('[data-pensipp="batal"]') as HTMLButtonElement).click();
    expect(panel(h)!.querySelector('[data-pensipp="konfirmasi"]')).toBeNull();
    expect(tulisPost(h)).toEqual([]);
    expect(unggahPost(h)).toEqual([]);
    expect(h.kiriman.length).toBe(sebelum);
    expect(h.konfirmDipanggil()).toBe(0);
  });

  it("Lanjutkan: uji kering PMH-PPP-PJS-PHS, satu transaksi tulis, lalu unggah e-Doc PMH-PPP-PJS-PHS berurutan", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    await klikSatuKali(h);
    const lap = await tungguLaporan(h);
    const urut = h.kiriman
      .filter((x) => x.cara === "POST" && (x.url.includes("/penunjukan/tulis") || x.url.includes("/penetapan-edoc/unggah")))
      .map((x) => {
        const b = JSON.parse(x.badan);
        if (x.url.includes("/penetapan-edoc/unggah")) return `edoc:${String(b.abt[0].jenis).toLowerCase()}`;
        return Array.isArray(b.rantai) ? `rantai:${b.rantai.map((s: { jenis: string }) => s.jenis).join(",")}` : `kering:${b.jenis}`;
      });
    expect(urut).toEqual([
      "kering:pmh",
      "kering:ppp",
      "kering:pjs",
      "kering:phs",
      "rantai:pmh,ppp,pjs,phs",
      "edoc:pmh",
      "edoc:ppp",
      "edoc:pjs",
      "edoc:phs",
    ]);
    for (const j of JENIS) expect(statusTeks(h, j)).toBe("tercatat · e-Doc terunggah");
    expect(lap.textContent).toContain("Selesai: 4 penetapan ditulis, 4 e-Doc terunggah.");
    for (const j of JENIS) expect(lap.querySelector(`[data-jenis="${j}"]`)!.textContent).toMatch(/tercatat\. e-Doc terunggah\./);
    expect(lap.querySelector('[data-pensipp="muat-ulang"]')).not.toBeNull();
    expect(h.konfirmDipanggil()).toBe(0);
    simpanTangkapan(h, "4-selesai");
  });

  it("e-Doc yang tidak dicentang tidak diunggah; yang dicentang saja", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    for (const j of ["ppp", "pjs"] as Jenis[]) {
      edocCek(h, j).checked = false;
      edocCek(h, j).dispatchEvent(new h.w.Event("change", { bubbles: true }));
    }
    utama(h).click();
    const k = await sampai(() => panel(h)!.querySelector('[data-pensipp="konfirmasi"]') as HTMLElement | null, "konfirmasi");
    expect(k.textContent).toContain("4 penetapan akan ditulis ke SIPP dan 2 e-Doc diunggah.");
    (k.querySelector('[data-pensipp="ya"]') as HTMLButtonElement).click();
    const lap = await tungguLaporan(h);
    expect(jenisUnggah(h)).toEqual(["pmh", "phs"]);
    expect(tulisPost(h).filter((b) => Array.isArray(b.rantai)).length).toBe(1);
    expect(lap.querySelector('[data-jenis="ppp"]')!.textContent).toContain("e-Doc tidak dicentang");
    expect(statusTeks(h, "ppp")).toBe("tercatat");
  });

  it("tanpa satu pun e-Doc dicentang: hanya menulis, tidak ada unggahan", async () => {
    const h = buka(kosong());
    const p = await panelSiap(h);
    const semua = p.querySelector('[data-pensipp="semua"]') as HTMLInputElement;
    semua.checked = false;
    semua.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    utama(h).click();
    const k = await sampai(() => panel(h)!.querySelector('[data-pensipp="konfirmasi"]') as HTMLElement | null, "konfirmasi");
    expect(k.textContent).toContain("4 penetapan akan ditulis ke SIPP dan 0 e-Doc diunggah.");
    (k.querySelector('[data-pensipp="ya"]') as HTMLButtonElement).click();
    await tungguLaporan(h);
    expect(unggahPost(h)).toEqual([]);
    expect(tulisPost(h).filter((b) => Array.isArray(b.rantai)).length).toBe(1);
  });

  it("PMH sudah tercatat: dilewati (tidak ditulis), e-Doc-nya tetap diunggah bila dicentang", async () => {
    const h = buka({ ...kosong(), pmh: HARI });
    await panelSiap(h);
    expect(statusTeks(h, "pmh")).toBe("sudah tercatat · dilewati");
    expect(statusTeks(h, "ppp")).toBe("akan ditulis");
    expect(panel(h)!.querySelector(".aleta-pensipp-ringkas")!.textContent).toBe("4 penetapan · 3 akan ditulis · 4 e-Doc dicentang");
    utama(h).click();
    const k = await sampai(() => panel(h)!.querySelector('[data-pensipp="konfirmasi"]') as HTMLElement | null, "konfirmasi");
    expect(k.textContent).toContain("3 penetapan akan ditulis ke SIPP dan 4 e-Doc diunggah.");
    (k.querySelector('[data-pensipp="ya"]') as HTMLButtonElement).click();
    const lap = await tungguLaporan(h);
    const rantai = tulisPost(h).filter((b) => Array.isArray(b.rantai));
    expect(rantai.length).toBe(1);
    expect(rantai[0].rantai.map((s: { jenis: string }) => s.jenis)).toEqual(["ppp", "pjs", "phs"]);
    expect(tulisPost(h).filter((b) => !Array.isArray(b.rantai) && b.jenis === "pmh")).toEqual([]);
    expect(jenisUnggah(h)).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(lap.querySelector('[data-jenis="pmh"]')!.textContent).toContain("sudah tercatat sebelumnya, dilewati");
  });

  it("keempatnya sudah tercatat: tidak ada yang ditulis; konfirmasi hanya soal e-Doc; e-Doc yang sudah ada disebut menimpa", async () => {
    const h = buka({ pmh: HARI, ppp: HARI, pjs: HARI, phs: HARI }, { edocSudah: ["pmh", "phs"] });
    const p = await panelSiap(h);
    await sampai(() => p.querySelectorAll(".aleta-pensipp-chip-edoc").length === 2, () => `chip e-Doc; ${p.textContent}`);
    for (const j of JENIS) expect(statusTeks(h, j)).toBe("sudah tercatat · dilewati");
    utama(h).click();
    const k = await sampai(() => panel(h)!.querySelector('[data-pensipp="konfirmasi"]') as HTMLElement | null, "konfirmasi");
    expect(k.textContent).toContain("Tidak ada penetapan yang perlu ditulis; 4 e-Doc diunggah.");
    expect(k.textContent).toContain("2 di antaranya menimpa e-Doc yang sudah ada di SIPP.");
    (k.querySelector('[data-pensipp="ya"]') as HTMLButtonElement).click();
    await tungguLaporan(h);
    expect(tulisPost(h)).toEqual([]);
    expect(jenisUnggah(h)).toEqual(["pmh", "ppp", "pjs", "phs"]);
  });

  it("keempatnya tercatat dan tidak ada e-Doc dicentang: tombol utama mati dan jujur", async () => {
    const h = buka({ pmh: HARI, ppp: HARI, pjs: HARI, phs: HARI });
    const p = await panelSiap(h).catch(async () => panel(h)!);
    const semua = p.querySelector('[data-pensipp="semua"]') as HTMLInputElement;
    semua.checked = false;
    semua.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(utama(h).disabled).toBe(true);
    expect(utama(h).textContent).toBe("Keempat penetapan sudah ada");
  });

  it("selama bekerja: status 'mengunggah e-Doc…', kotak dan tombol terkunci; sesudahnya hidup lagi", async () => {
    let lepas!: () => void;
    const menunggu = new Promise<void>((r) => (lepas = r));
    const h = buka(kosong(), { tahanUnggah: { lepas, menunggu } });
    await panelSiap(h);
    await klikSatuKali(h);
    await sampai(() => statusTeks(h, "pmh") === "mengunggah e-Doc…", () => `status pmh: ${statusTeks(h, "pmh")}`);
    expect(utama(h).disabled).toBe(true);
    expect(utama(h).textContent).toBe("Sedang bekerja…");
    expect(edocCek(h, "pmh").disabled).toBe(true);
    expect(panel(h)!.querySelector('[data-pensipp="semua"]') as HTMLInputElement).toHaveProperty("disabled", true);
    simpanTangkapan(h, "3-berjalan");
    lepas();
    await tungguLaporan(h);
    expect(edocCek(h, "pmh").disabled).toBe(false);
  });
});

describe("gagal dilaporkan, tidak ada tulis ganda", () => {
  it("uji kering PJS gagal: tidak ada transaksi tulis, PJS gagal bersebab, PHS ditahan, e-Doc tidak diunggah", async () => {
    const h = buka(kosong(), { gagalKering: "pjs" });
    await panelSiap(h);
    await klikSatuKali(h);
    const lap = await tungguLaporan(h);
    expect(tulisPost(h).filter((b) => Array.isArray(b.rantai))).toEqual([]);
    expect(unggahPost(h)).toEqual([]);
    expect(statusTeks(h, "pjs")).toBe("gagal");
    expect(statusTeks(h, "phs")).toBe("ditahan");
    expect(langkah(h, "phs").textContent).toContain("Menunggu PJS berhasil lebih dulu.");
    expect(lap.textContent).toContain("Penetapan belum selesai");
    expect(lap.querySelector('[data-pensipp="muat-ulang"]')).toBeNull();
    expect(teksTampak(h)).not.toMatch(/jurusita_tidak_aktif|ER_LOCK|undefined|\[object|Ubah semua pilihan/);
    // dapat ditekan lagi
    await sampai(() => !utama(h).disabled, "tombol hidup lagi");
    simpanTangkapan(h, "5-gagal");
  });

  it("penulisan gagal tetapi PMH sudah tercatat: e-Doc PMH tetap diunggah, yang belum tercatat tidak", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, { gagalKering: "pjs" });
    await panelSiap(h);
    await klikSatuKali(h);
    const lap = await tungguLaporan(h);
    expect(jenisUnggah(h)).toEqual(["pmh"]);
    expect(lap.querySelector('[data-jenis="ppp"]')!.textContent).toMatch(/belum tercatat|ditahan|gagal/);
    expect(lap.querySelector('[data-jenis="pjs"]')!.textContent).toMatch(/gagal/);
  });

  it("e-Doc satu langkah gagal: dilaporkan bersebab, yang lain tetap terunggah", async () => {
    const h = buka(kosong(), { edocGagal: "ppp" });
    await panelSiap(h);
    await klikSatuKali(h);
    const lap = await tungguLaporan(h);
    expect(jenisUnggah(h)).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(statusTeks(h, "ppp")).toBe("tercatat · e-Doc gagal");
    expect(statusTeks(h, "pmh")).toBe("tercatat · e-Doc terunggah");
    expect(lap.querySelector('[data-jenis="ppp"]')!.textContent).toContain("tanda tangan pejabat belum disahkan");
    expect(lap.textContent).toContain("1 e-Doc gagal");
  });

  it("dua klik bersamaan menulis SEKALI saja (kunci per perkara)", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    const a = api(h).jalankan();
    const b = api(h).jalankan();
    await Promise.all([a, b]);
    await tungguLaporan(h);
    expect(tulisPost(h).filter((x) => Array.isArray(x.rantai)).length).toBe(1);
    expect(jenisUnggah(h)).toEqual(["pmh", "ppp", "pjs", "phs"]);
  });

  it("kunci bersama: jalan tulis lain di halaman yang sama ditolak selama panel menulis, bukan menulis ganda", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    // Jalan tulis lama (tetapkanLewatAleta) dipanggil bersamaan dengan panel ini.
    const usulan = api(h).keadaan().data.usulan;
    const data = api(h).keadaan().data;
    const panelJalan = api(h).jalankan();
    // Seketika (tanpa menunggu): semua jawaban tiruan selesai dalam satu putaran mikro.
    const lain = await h.w.tetapkanLewatAleta(null, h.d.createElement("div"), usulan, data, {}, false);
    await panelJalan;
    const rantai = tulisPost(h).filter((x) => Array.isArray(x.rantai));
    expect(rantai.length).toBeLessThanOrEqual(1);
    expect(lain.ok).toBe(false);
    expect(JSON.stringify(lain.hasil)).toMatch(/sedang_ditulis/);
  });
});

describe("satu pintu bersama (aletaPenetapanKerja dari agen P1)", () => {
  type Panggilan = Record<string, any>;
  function pasangKerja(h: Halaman, laporan: unknown[], ekstra: Record<string, unknown> = {}) {
    const panggilan: Panggilan[] = [];
    h.w.aletaPenetapanKerja = {
      kerjakan: async (arg: Panggilan) => {
        panggilan.push(JSON.parse(JSON.stringify({ ...arg, pada: undefined })));
        arg.pada?.({ tahap: "tulis", jenis: "pmh", teks: "menulis" });
        await tunggu(5);
        return { ok: true, laporan, pesan: "", ...ekstra };
      },
    };
    return panggilan;
  }
  const lapor = (jenis: string, status: string, o: Record<string, unknown> = {}) => ({ jenis, status, sebab: "", bunyi: "", ...o });

  it("meneruskan mode, langkah, dan centang e-Doc; tidak menulis/mengunggah sendiri", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    const panggilan = pasangKerja(h, JENIS.map((j) => lapor(j, "tercatat", { edoc: { status: "terunggah" } })));
    edocCek(h, "ppp").checked = false;
    edocCek(h, "ppp").dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await klikSatuKali(h);
    const lap = await tungguLaporan(h);
    expect(panggilan.length).toBe(1);
    expect(panggilan[0].nomorPerkara).toBe(NOMOR);
    expect(panggilan[0].perkaraId).toBe(10260);
    expect(panggilan[0].mode).toBe("otomatis");
    expect(panggilan[0].pilihan).toEqual({});
    expect(panggilan[0].langkah).toEqual({ pmh: true, ppp: true, pjs: true, phs: true });
    expect(panggilan[0].unggahEdoc).toEqual({ pmh: true, ppp: false, pjs: true, phs: true });
    expect(panggilan[0].kering).toBe(false);
    expect(tulisPost(h)).toEqual([]);
    expect(unggahPost(h)).toEqual([]);
    expect(lap.textContent).toContain("Selesai: 4 penetapan ditulis");
  });

  it("mode manual membawa pilihan (PP, pejabat) ke satu pintu", async () => {
    const h = buka(kosong());
    const p = await panelSiap(h);
    (p.querySelector('[data-pensipp-mode="manual"]') as HTMLButtonElement).click();
    await sampai(() => panel(h)!.querySelector(".aleta-pensipp-rinci .aleta-pilih"), "dropdown manual");
    const kotakPp = Array.from(panel(h)!.querySelectorAll(".aleta-pilih")).find((x) => /Panitera pengganti/.test(x.textContent || ""))!;
    const sel = kotakPp.querySelector("select") as HTMLSelectElement;
    sel.value = Array.from(sel.options).find((x) => /Mannaria/.test(x.textContent || ""))!.value;
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => /Mannaria/.test(langkah(h, "ppp").textContent || ""), "ppp Mannaria");
    const panggilan = pasangKerja(h, JENIS.map((j) => lapor(j, "tercatat")));
    await klikSatuKali(h);
    await tungguLaporan(h);
    expect(panggilan[0].mode).toBe("manual");
    expect(String(panggilan[0].pilihan.ppp)).toBe("31");
  });

  it("laporan satu pintu dipetakan: tercatat+e-Doc, sudah ada, gagal bersebab, sedang dikerjakan, e-Doc gagal", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    pasangKerja(h, [
      lapor("pmh", "tercatat", { edoc: { status: "terunggah" } }),
      lapor("ppp", "dilewati", { sebab: "sudah_ada", edoc: { status: "gagal", bunyi: "tanda tangan belum disahkan" } }),
      lapor("pjs", "gagal", { sebab: "jurusita_tidak_aktif", bunyi: "Juru sita tidak aktif." }),
      lapor("phs", "dilewati", { sebab: "sedang_dikerjakan", bunyi: "Sedang dikerjakan dari tab lain." }),
    ]);
    await klikSatuKali(h);
    const lap = await tungguLaporan(h);
    expect(statusTeks(h, "pmh")).toBe("tercatat · e-Doc terunggah");
    expect(statusTeks(h, "ppp")).toBe("tercatat · e-Doc gagal");
    expect(statusTeks(h, "pjs")).toBe("gagal");
    expect(statusTeks(h, "phs")).toBe("ditahan");
    expect(lap.querySelector('[data-jenis="pjs"]')!.textContent).toContain("Juru sita tidak aktif.");
    expect(lap.querySelector('[data-jenis="phs"]')!.textContent).toContain("Sedang dikerjakan dari tab lain.");
    expect(lap.querySelector('[data-jenis="ppp"]')!.textContent).toContain("tanda tangan belum disahkan");
    expect(teksTampak(h)).not.toMatch(/jurusita_tidak_aktif|sedang_dikerjakan|sudah_ada/);
  });
});

describe("batas aman", () => {
  it("tidak ada kata ALETA di isian yang dikirim untuk ditulis/diunggah, dan tidak ada kiriman langsung ke SIPP", async () => {
    const h = buka(kosong());
    await panelSiap(h);
    await klikSatuKali(h);
    await tungguLaporan(h);
    const tulis = h.kiriman.filter((x) => x.cara === "POST");
    expect(tulis.length).toBeGreaterThan(0);
    expect(tulis.every((x) => x.url.includes("/aleta/api/"))).toBe(true);
    const nilai: string[] = [];
    const kumpul = (x: unknown) => {
      if (typeof x === "string") nilai.push(x);
      else if (Array.isArray(x)) x.forEach(kumpul);
      else if (x && typeof x === "object") Object.values(x).forEach(kumpul);
    };
    for (const x of tulis.filter((t) => t.url.includes("/penunjukan/tulis") || t.url.includes("/penetapan-edoc/unggah"))) {
      const b = JSON.parse(x.badan);
      delete b.abt; // isi RTF base64 bukan teks isian
      kumpul(b);
    }
    expect(nilai.filter((v) => /aleta/i.test(v))).toEqual([]);
  });

  it("tidak ada teks teknis di panel - sebelum, selama gagal, dan sesudah", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, { gagalKering: "phs" });
    const p = await panelSiap(h);
    const periksa = () => expect(teksTampak(h)).not.toMatch(/kering|rantai|transaksi|perkaraId|undefined|null|NaN|\[object|_sudah_ada|[a-z]+_[a-z]+_[a-z]+/);
    periksa();
    await klikSatuKali(h);
    await tungguLaporan(h);
    periksa();
    expect(p.isConnected).toBe(true);
  });

  it("manifest memuat skrip dan gaya, penyusun tanam mendaftarkannya", () => {
    const manifest = JSON.parse(readFileSync(path.join(AKAR, "manifest.json"), "utf8"));
    const blok = manifest.content_scripts.find((c: { js: string[] }) => c.js.includes("sipp-ide-l1.js") && c.js.includes("konten.js"));
    expect(blok.js.indexOf("penetapan-sipp.js")).toBeGreaterThan(blok.js.indexOf("konten.js"));
    expect(blok.js.indexOf("penetapan-sipp.js")).toBeGreaterThan(blok.js.indexOf("sipp-ide-l1.js"));
    expect(blok.css).toContain("penetapan-sipp.css");
    const susun = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"penetapan-sipp.js"');
    expect(susun).toContain('"penetapan-sipp.css"');
  });
});
