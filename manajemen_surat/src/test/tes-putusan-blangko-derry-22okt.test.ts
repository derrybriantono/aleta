// @vitest-environment node
/**
 * ============================================================================
 * 22 OKT 2026 - BLANGKO ABT BY DERRY BRIANTONO: "TES PUTUSAN" (HANYA SUPER ADMIN)
 * ============================================================================
 *
 * blangko-derry.js + blangko-derry-isian.js dijalankan SUNGGUHAN di jsdom di atas panel-alat.js (portal dan ABT ditiru di fetch; kerangka
 * sama dengan blangko-derry-pemilih-cetak-19okt). Yang dijaga:
 *   1  kotak "Tes putusan" di samping "Lihat sebagai": hanya Super Admin; bawaan mati; diingat per pengguna; peran lain tidak dapat
 *      menyalakannya walau penyimpanannya berisi "nyala";
 *   2  tercentang: jendela Pilih blangko menampilkan SEMUA blangko dari semua jenis perkara dan semua tab (Putusan, BAS, Relaas, PTSP),
 *      tanpa saringan hak folder; blangko jenis lain dapat dibuka pada perkara acuan;
 *   3  TIDAK SATU PUN permintaan tulis ke ABT, SIPP, atau e-Court (memilih perkara, memilih blangko, mengetik, pratinjau, cetak, unduh);
 *      pembanding: tanpa tes, mengetik yang sama MENULIS ke ABT;
 *   4  pita "TES PUTUSAN - perkara acuan ..." di panel, pratinjau, dan cetak; unduhan berakhiran -TES; tidak ada catatan cetak;
 *   5  centang dilepas: perilaku normal kembali seketika (saringan jenis dan hak folder, penulisan).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-22";
const NOMOR_ACUAN = "600/Pdt.G/2026/PA.Dgl";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 6000): Promise<NonNullable<T>> {
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
    await tunggu(5);
  }
}

// ----------------------------------------------------------------------------
// Bahan
// ----------------------------------------------------------------------------
const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("8503", "ALASAN PERCERAIAN <br>SATU HURUF", "data_teks"),
  D("0007", "Telah Dikarunai Anak", "data_teks", "", "#8492#"),
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
]);
const PENANDA = ["0001", "0046", "0007", "8503", "0033"];
const RTF = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}}\\pard\\qc\\b PUTUSAN\\b0\\par\\pard\\qc Nomor ${NOMOR_ACUAN}\\par\\pard Penggugat: Yulfiani; anak: ...;\\par}`;

const B_CG = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const B_CT = "[01] [Kabul] CT";
const B_IN = "[01] [Kabul] IN";
const B_BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";
const B_REL = "[JS] Panggilan Sidang Pertama T";
const B_PTSP = "Data Umum PTSP";
const KELOMPOK: Array<[string, string, string, string]> = [
  ["D1", "CG - Putusan", "1 Perceraian CG", B_CG],
  ["D2", "CT - Putusan", "2 Cerai Talak CT", B_CT],
  ["D3", "Itsbat - Putusan", "3 Itsbat Nikah", B_IN],
  ["D4", "CG - BAS", "ALUR 02 Cerai Verstek", B_BAS],
  ["D5", "Relaas dan PBT", "Relaas Panggilan", B_REL],
  ["D6", "99 PTSP", "99 PTSP", B_PTSP],
];
const JENIS_FOLDER: Record<string, string> = { D1: "put", D2: "put", D3: "put", D4: "bas", D5: "rel", D6: "ptsp" };
const MENU =
  `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel">` +
  KELOMPOK.map(([a, nama]) => `<a href="${BERANDA}?a=${a}&c=" title="(1 Blangko)">${nama}</a>`).join("") +
  `</div>`;
const HAL_KELOMPOK = (judul: string, berkas: string, a: string, b: string) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div><p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${berkas}</span></a></p>`;
const POPUP = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>${NOMOR_ACUAN}</b>` +
  `<textarea id="value">${nilai}</textarea>`;

const SI = (tanggal: string, agenda: string, ket = "", urutan = 1) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan, hadir: null, adaBas: null, ruangan: "" });
const PERKARA_ACUAN = {
  nomorPerkara: NOMOR_ACUAN, perkaraId: "10154", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim"], pihak: { penggugat: ["Yulfiani binti Tasbih"], tergugat: ["Andi Rustam bin Syamsudin"] }, sidang: [SI(HARI_INI, "Pemeriksaan pokok perkara", "", 2)],
};
const AKUN = { hakim: ["Hakim Satu"], pp: ["PP Satu"], js: ["JS Satu"] };
type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId: string; header: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"], header: "Hakim" },
  super: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"], header: "Super Administrator" },
  admin: { nama: "Admin Biasa", peran: "Admin", roleId: "admin", golonganMenu: ["admin"], header: "Administrator" },
};

type Minta = { url: string; cara: string; badan: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown> } = {}): Halaman {
  const orang = ORANG[p.orang ?? "hakim"];
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> ${orang.header}</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const latar: Array<Record<string, unknown>> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.205.34" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (pesan: Record<string, unknown>, cb?: (h: unknown) => void) => {
        latar.push(polos(pesan));
        if (cb) cb({ ok: true, id: 1 });
      },
      lastError: undefined,
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
          for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
          setTimeout(() => pendengar.forEach((f) => f({}, "local")), 0);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Minta[] = [];
  const abt: Record<string, string> = { "8503": "F" };
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    let badanMinta = "";
    if (typeof opsi?.body === "string") badanMinta = opsi.body;
    else if (opsi?.body && typeof (opsi.body as FormData).get === "function") badanMinta = JSON.stringify(Object.fromEntries([...(opsi.body as FormData).entries()].map(([k, v]) => [k, typeof v === "string" ? v : "<berkas>"])));
    else if (opsi?.body && typeof (opsi.body as URLSearchParams).toString === "function") badanMinta = String(opsi.body);
    minta.push({ url, cara, badan: badanMinta });
    // Portal
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const adm = p.orang !== "hakim";
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: adm, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: adm ? AKUN : null, perkara: [polos(PERKARA_ACUAN)] } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: false }, 404);
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      // Hak folder ABT: folder "Itsbat - Putusan" HANYA untuk grup 999 (bukan hakim) - saringan yang harus dilewati Tes putusan.
      if (q.get("hak") === "1") return json({ ok: true, data: { ada: true, saklar: { hakimBas: false, ppPutusan: false }, folder: [{ nama: "Itsbat - Putusan", namaAlias: "Itsbat - Putusan", user_grup_id: "999", user_top_id: "999" }] } });
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: KELOMPOK.map(([a, , folder, berkas]) => ({ nama: folder, jenis: JENIS_FOLDER[a], berkas: [`${berkas}.rtf`] })), sumber: "pohon", sebab: "" } });
      const s = susunIsian(PENANDA, KATALOG, { P: q.get("sebutanP") || "Penggugat", T: q.get("sebutanT") || "Tergugat" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      const nilai: Record<string, unknown> = {};
      for (const k of kode) nilai[k] = statusNilaiLayar(abt[k] ? { status: "terisi", teks: abt[k], nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" }, kodeTanyaJawab(s).has(k));
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${q.get("berkas")}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai, nilaiAda: true, nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/pdf")) return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from("%PDF-1.4 uji").toString("base64"), byte: 12 } });
    if (url.includes("/aleta-ecourt/tanda-tangan")) return json({ ok: false, alasan: "tidak berwenang" }, 403);
    if (url.includes("/aleta-ecourt/putusan/unggah-sipp")) return json({ ok: true, data: { ok: true } });
    // ABT
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    const m = url.match(/\?a=(D\d)/);
    if (m && url.startsWith(BERANDA)) {
      const [a, nama, , berkas] = KELOMPOK.find((x) => x[0] === m[1])!;
      return html(HAL_KELOMPOK(nama, berkas, `A-${a}`, `B-${a}`));
    }
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    if (url.startsWith(`${ABT}/edit_data?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      if (cara === "POST") {
        abt[kode] = String(new URLSearchParams(badanMinta).get("value") || "");
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      if (kode === "0050") return html(POPUP(kode, "multi_sidang", String(q.get("d") || "1")));
      return html(POPUP(kode, KATALOG.get(kode)?.jenis || "data_teks", abt[kode] || ""));
    }
    if (url.startsWith(`${ABT}/preview?`)) return new Response(new Blob([RTF]), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="${NOMOR_ACUAN} - naskah.rtf"` } });
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return { dom, w, simpanan, minta, latar, abt };
}

const D_ = (h: Halaman) => h.w.document as Document;
const akar = (h: Halaman) => D_(h).getElementById("aleta-bd-akar") as HTMLElement;
const q = (h: Halaman, s: string) => akar(h).querySelector(s) as HTMLElement | null;
const qq = (h: Halaman, s: string) => Array.from(akar(h).querySelectorAll(s)) as HTMLElement[];
const klik = (h: Halaman, s: string) => {
  const el = q(h, s);
  if (!el) throw new Error(`tidak ada: ${s}`);
  el.click();
};
const ubah = (h: Halaman, el: HTMLInputElement | HTMLSelectElement, nilai: string | boolean) => {
  if (typeof nilai === "boolean") (el as HTMLInputElement).checked = nilai;
  else el.value = nilai;
  el.dispatchEvent(new h.w.Event("change", { bubbles: true }));
};
const ketik = (h: Halaman, el: HTMLInputElement, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  el.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
};
const kerangka = (h: Halaman) => h.w.aletaBlangkoDerry;
const isian = (h: Halaman) => h.w.aletaBlangkoDerryIsian;
const mintaKe = (h: Halaman, pola: RegExp, cara?: string) => h.minta.filter((m) => pola.test(m.url) && (!cara || m.cara === cara));
const tulis = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && m.cara !== "HEAD");

async function bukaPanel(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || kerangka(h).keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar perkara");
}
async function pilihAcuan(h: Halaman) {
  await bukaPanel(h);
  klik(h, `[data-pk="${NOMOR_ACUAN}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function lihatSebagaiHakim(h: Halaman) {
  await bukaPanel(h);
  ubah(h, q(h, "#bd-lihat") as HTMLSelectElement, "hakim|Hakim Satu");
  await sampai(() => (q(h, "#bd-siapa")?.textContent || "").includes("dilihat sebagai Hakim Satu") && q(h, "[data-pk]"), "daftar sebagai hakim");
  klik(h, `[data-pk="${NOMOR_ACUAN}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function nyalakanTes(h: Halaman) {
  ubah(h, q(h, "#bd-tes") as HTMLInputElement, true);
  await sampai(() => kerangka(h).tesPutusan() === true && !q(h, "#bd-pitates")!.hidden, "tes menyala");
}
async function bukaModal(h: Halaman) {
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
  await sampai(() => qq(h, ".bd-mkiri [data-kelmodal]").length > 0, "kelompok");
}
const tabModal = (h: Halaman) => qq(h, ".bd-mkepala [data-jenismodal]").map((b) => b.getAttribute("data-jenismodal"));
const kiriModal = (h: Halaman) => qq(h, ".bd-mkiri [data-kelmodal]").map((b) => b.getAttribute("data-kelmodal"));
/** Semua nama blangko yang dapat dipilih di satu tab (memuat tiap kelompok lewat pencarian kosong -> klik kelompok satu per satu). */
async function berkasTab(h: Halaman, jenis: string) {
  klik(h, `[data-jenismodal="${jenis}"]`);
  await sampai(() => q(h, `[data-jenismodal="${jenis}"][aria-selected="true"]`), `tab ${jenis}`);
  const hasil: string[] = [];
  for (const id of kiriModal(h)) {
    if (!id || !id.startsWith("k:")) continue; // "saran" dan kelompok maya Ikrar Talak bukan kelompok menu
    klik(h, `[data-kelmodal="${id}"]`);
    await sampai(() => q(h, `[data-kelmodal="${id}"].aktif`) && (qq(h, ".bd-mkanan [data-bl]").length > 0 || (q(h, ".bd-mkanan .bd-catat") && !/Membaca/.test(q(h, ".bd-mkanan .bd-catat")!.textContent || ""))), `isi ${id}`);
    hasil.push(...qq(h, ".bd-mkanan [data-bl]").map((b) => b.getAttribute("data-bl") || ""));
  }
  return hasil;
}

// ============================================================================
// 1. Kotak "Tes putusan": hanya Super Admin
// ============================================================================
describe("1. kotak Tes putusan di samping Lihat sebagai", () => {
  it("Super Admin: kotak ada tepat sesudah 'Lihat sebagai', bawaan TIDAK tercentang, pita tersembunyi", async () => {
    const h = buka({ orang: "super" });
    await bukaPanel(h);
    const bungkus = q(h, "#bd-teswrap")!;
    expect(bungkus.hidden).toBe(false);
    expect(bungkus.textContent).toContain("Tes putusan");
    expect(q(h, "#bd-lihatwrap")!.nextElementSibling).toBe(bungkus);
    expect((q(h, "#bd-tes") as HTMLInputElement).checked).toBe(false);
    expect(q(h, "#bd-pitates")!.hidden).toBe(true);
    expect(kerangka(h).tesPutusan()).toBe(false);
  });

  it("Admin biasa dan hakim tidak melihat kotak; menyalakannya lewat penyimpanan pun tidak berlaku bagi mereka", async () => {
    for (const orang of ["admin", "hakim"]) {
      const h = buka({ orang, simpanan: { blangkoDerryTesPutusan: true } });
      await bukaPanel(h);
      expect(q(h, "#bd-teswrap")!.hidden).toBe(true);
      expect(q(h, "#bd-pitates")!.hidden).toBe(true);
      expect(kerangka(h).tesPutusan()).toBe(false);
      expect(kerangka(h).keadaan().tes).toBe(false);
    }
  });

  it("dicentang: pita tampil dengan nomor perkara acuan; status hanya selama halaman ini - panel berikutnya selalu mati (22 Okt malam)", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    await nyalakanTes(h);
    expect(h.simpanan.blangkoDerryTesPutusan).toBeUndefined();
    expect(kerangka(h).tesPutusan()).toBe(true);
    const pita = q(h, "#bd-pitates")!;
    expect(pita.textContent).toContain("TES PUTUSAN");
    expect(pita.textContent).toContain(`perkara acuan ${NOMOR_ACUAN}`);
    expect(pita.textContent).toContain("tidak ada yang ditulis ke ABT, SIPP, atau e-Court");
    expect(pita.textContent).not.toMatch(/aleta/i);
    // Sisa simpanan lama "nyala" pun tidak menyalakannya lagi.
    const lagi = buka({ orang: "super", simpanan: { ...h.simpanan, blangkoDerryTesPutusan: true } });
    await bukaPanel(lagi);
    expect((q(lagi, "#bd-tes") as HTMLInputElement).checked).toBe(false);
    expect(q(lagi, "#bd-pitates")!.hidden).toBe(true);
    expect(lagi.w.aletaBlangkoDerry.tesPutusan()).toBe(false);
  });

  it("Cetak massal mati pada mode tes (tombol tersembunyi, pemanggilan langsung ditolak)", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    const sebelum = h.minta.length;
    expect(q(h, "#bd-massal")!.hidden).toBe(false);
    await nyalakanTes(h);
    expect(q(h, "#bd-massal")!.hidden).toBe(true);
    kerangka(h).bukaMassal();
    expect(q(h, "#bd-toast")!.textContent).toContain("Cetak massal dimatikan");
    expect(h.minta.slice(sebelum).filter((m) => m.cara !== "GET")).toEqual([]);
  });
});

// ============================================================================
// 2. Semua blangko dari semua jenis perkara dan semua tab
// ============================================================================
describe("2. jendela Pilih blangko pada mode tes", () => {
  it("tanpa tes (Lihat sebagai hakim): hanya tab Putusan dan 'Itsbat - Putusan' tertutup oleh hak folder; dengan tes: semua tab dan semua kelompok", async () => {
    const h = buka({ orang: "super" });
    await lihatSebagaiHakim(h);
    await bukaModal(h);
    expect(tabModal(h)).toEqual(["put"]);
    await sampai(() => kiriModal(h).includes("k:CG - Putusan"), "kelompok CG");
    expect(kiriModal(h)).not.toContain("k:Itsbat - Putusan");
    expect(kiriModal(h)).toContain("k:CT - Putusan");
    // Menyalakan tes: jendela ditutup dan blangko terbuka dibuang (keadaan baru); buka lagi.
    await nyalakanTes(h);
    expect(q(h, "#bd-modal")!.hidden).toBe(true);
    await bukaModal(h);
    expect(q(h, ".bd-mkepala")!.textContent).toContain("Tes putusan");
    expect(tabModal(h)).toEqual(["put", "bas", "rel", "ptsp"]);
    await sampai(() => kiriModal(h).includes("k:Itsbat - Putusan"), "kelompok Itsbat terbuka");
    expect(kiriModal(h)).toEqual(expect.arrayContaining(["k:CG - Putusan", "k:CT - Putusan", "k:Itsbat - Putusan"]));
    expect(await berkasTab(h, "put")).toEqual(expect.arrayContaining([B_CG, B_CT, B_IN]));
    expect(await berkasTab(h, "bas")).toEqual([B_BAS]);
    expect(await berkasTab(h, "rel")).toEqual([B_REL]);
    expect(await berkasTab(h, "ptsp")).toEqual([B_PTSP]);
  });

  it("perkara Cerai Gugat (acuan): blangko Itsbat dan Cerai Talak dapat dibuka dan isiannya terbaca; ABT hanya diminta lewat GET", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    await nyalakanTes(h);
    await bukaModal(h);
    klik(h, '[data-kelmodal="k:Itsbat - Putusan"]');
    await sampai(() => q(h, `[data-bl="${B_IN}"]`), "blangko Itsbat termuat");
    klik(h, `[data-bl="${B_IN}"]`);
    await sampai(() => q(h, "#bd-perlu .bd-f") || q(h, "#bd-perlu .bd-ok"), "isian tergambar");
    expect(isian(h).keadaan().blangko.berkas).toBe(B_IN);
    expect(isian(h).keadaan().blangko.hak).toBe("ok");
    // Pemeriksaan hak ABT (main/cari) dilewati sengaja; saringan 'sebagaiPeran' tidak dikirim ke portal.
    expect(mintaKe(h, /main\/cari/)).toEqual([]);
    expect(mintaKe(h, /blangko-derry\?folder=/).every((m) => !m.url.includes("sebagaiPeran"))).toBe(true);
    // Kotak isian dikunci dengan keterangan yang benar (bukan "akun Anda hanya dapat melihat").
    expect(qq(h, ".bd-petunjuk").map((e) => e.textContent).join(" ")).toContain("Mode Tes putusan");
    expect((q(h, "#bd-i0007") as HTMLInputElement).readOnly).toBe(true);
  });

  it("dilepas: saringan kembali seketika - tab dan kelompok semula, blangko jenis lain dibuang", async () => {
    const h = buka({ orang: "super" });
    await lihatSebagaiHakim(h);
    await nyalakanTes(h);
    await bukaModal(h);
    klik(h, '[data-kelmodal="k:Itsbat - Putusan"]');
    await sampai(() => q(h, `[data-bl="${B_IN}"]`), "blangko Itsbat termuat");
    klik(h, `[data-bl="${B_IN}"]`);
    await sampai(() => isian(h).keadaan().blangko, "blangko terpilih");
    ubah(h, q(h, "#bd-tes") as HTMLInputElement, false);
    await sampai(() => kerangka(h).tesPutusan() === false && q(h, "#bd-pitates")!.hidden, "tes mati");
    await sampai(() => !isian(h).keadaan().blangko, "blangko tes dibuang");
    expect(h.simpanan.blangkoDerryTesPutusan).toBeUndefined();
    expect(q(h, "#bd-pitates")!.hidden).toBe(true);
    await bukaModal(h);
    expect(tabModal(h)).toEqual(["put"]);
    await sampai(() => kiriModal(h).includes("k:CG - Putusan"), "kelompok CG");
    expect(kiriModal(h)).not.toContain("k:Itsbat - Putusan");
    expect(q(h, ".bd-mkepala")!.textContent).not.toContain("Tes putusan");
    expect(q(h, "#bd-massal")!.hidden).toBe(false);
  });
});

// ============================================================================
// 3. Tidak ada permintaan tulis
// ============================================================================
describe("3. mode tes tidak menulis apa pun", () => {
  const BOLEH_NON_GET = [/\/aleta-bot\/abt\/pdf$/, /\/aleta-bot\/abt\/usulan$/]; // hanya MENGHITUNG (PDF, usulan jawaban saksi); tidak menyimpan
  const TULIS_TERLARANG = /edit_data.*POST|tanyajawab_perkara_edit\?aksi=simpan|validasi_bas|main\/anonim|main\/cari|unggah-sipp|konseptor-langkah|tanya_jawab|ecourt|simpan/i;

  it("memilih perkara, memilih blangko, mengetik, pratinjau, cetak RTF+PDF, centang e-Doc: NOL permintaan tulis; unduhan berakhiran -TES; tanpa catatan cetak", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    await nyalakanTes(h);
    await bukaModal(h);
    klik(h, '[data-kelmodal="k:CT - Putusan"]');
    await sampai(() => q(h, `[data-bl="${B_CT}"]`), "blangko CT termuat");
    klik(h, `[data-bl="${B_CT}"]`);
    await sampai(() => q(h, "#bd-i0007"), "isian tergambar");
    await tunggu(80);
    // Mengetik di kotak (walau terkunci): tidak boleh menjadi permintaan tulis; kotak tidak berisi ketikan.
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "telah dikaruniai 2 orang anak");
    await tunggu(700);
    expect(h.abt["0007"]).toBeUndefined();
    // Pratinjau (ABT menyusun naskah lewat GET preview).
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => q(h, "#bd-kertas"), "pratinjau tampil");
    expect(q(h, "#bd-pratinjau-tes, .bd-pitates.kecil")!.textContent).toContain(`perkara acuan ${NOMOR_ACUAN}`);
    expect(q(h, '[data-bd2="suntingpenuh"]')).toBeNull();
    expect(q(h, '[data-bd2="simpansunting"]')).toBeNull();
    // Cetak RTF + PDF; e-Doc tak dapat dicentang.
    expect((q(h, '[data-fmt="edoc"]') as HTMLInputElement).disabled).toBe(true);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => h.latar.filter((m) => m.jenis === "unduh").length >= 2 || (q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden), "pengingat atau unduhan", 8000);
    if (h.latar.filter((m) => m.jenis === "unduh").length < 2) klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.latar.filter((m) => m.jenis === "unduh").length >= 2, "rtf dan pdf diunduh", 8000);
    const nama = h.latar.filter((m) => m.jenis === "unduh").map((m) => String(m.nama));
    expect(nama.every((n) => /-TES\.(rtf|pdf)$/.test(n))).toBe(true);
    expect(nama.some((n) => n.endsWith("-TES.rtf"))).toBe(true);
    expect(nama.some((n) => n.endsWith("-TES.pdf"))).toBe(true);
    expect(q(h, ".bd-tahap [data-wadah='cetak'] .bd-pitates.kecil, [data-wadah='cetak'] .bd-pitates.kecil")).not.toBeNull();
    // Tidak ada catatan "sudah dicetak" di penyimpanan (cetak sungguhan akan mencatatnya).
    expect(Object.keys(h.simpanan).filter((k) => k.startsWith("blangkoDerryCetak:"))).toEqual([]);
    expect(q(h, "#bd-statuscetak")!.textContent).not.toMatch(/Sudah dicetak|Belum dicetak/);
    // Daftar tulis: hanya PDF (menghitung), tidak ada yang lain.
    const tulisan = tulis(h);
    expect(tulisan.length).toBeGreaterThan(0);
    for (const m of tulisan) {
      expect(BOLEH_NON_GET.some((p) => p.test(m.url.split("?")[0]))).toBe(true);
      expect(`${m.cara} ${m.url}`).not.toMatch(TULIS_TERLARANG);
    }
    expect(mintaKe(h, /edit_data/, "POST")).toEqual([]);
    expect(mintaKe(h, /tanyajawab_perkara_edit/, "POST")).toEqual([]);
    expect(mintaKe(h, /unggah-sipp|main\/anonim|validasi_bas|konseptor-langkah/)).toEqual([]);
    expect(mintaKe(h, /abt\/preview\?/).every((m) => m.cara === "GET")).toBe(true);
    expect(mintaKe(h, /abt\/preview\?/).length).toBeGreaterThan(0);
  });

  it("PEMBANDING: tanpa tes, ketikan yang sama MENULIS ke ABT (edit_data POST) dan memeriksa hak (main/cari)", async () => {
    const h = buka({ orang: "super" });
    await lihatSebagaiHakim(h);
    await bukaModal(h);
    klik(h, '[data-kelmodal="k:CG - Putusan"]');
    await sampai(() => q(h, `[data-bl="${B_CG}"]`), "blangko CG termuat");
    klik(h, `[data-bl="${B_CG}"]`);
    await sampai(() => q(h, "#bd-i0007"), "isian tergambar");
    await tunggu(80);
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "telah dikaruniai 2 orang anak");
    await sampai(() => mintaKe(h, /edit_data/, "POST").length >= 1, "ABT ditulis", 4000);
    expect(h.abt["0007"]).toBe("telah dikaruniai 2 orang anak");
    expect(mintaKe(h, /main\/cari/, "POST").length).toBeGreaterThanOrEqual(1);
  });

  it("penjaga lapis dalam: permintaan tulis ke ABT dan portal ditolak walau dipanggil langsung; baca dan hitung lolos", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    await nyalakanTes(h);
    const aman = isian(h).murni.permintaanAbtAman as (a: string, o?: { method?: string; body?: string }) => boolean;
    expect(aman(`${ABT}/edit_data?no_var=0007&perkara_id=1`)).toBe(true);
    expect(aman(`${ABT}/edit_data?no_var=0007&perkara_id=1`, { method: "POST", body: "aksi=Simpan&value=x" })).toBe(false);
    expect(aman(`${ABT}/tanyajawab_perkara_edit?aksi=simpan&no_var=5058`, { method: "POST", body: "data=[]" })).toBe(false);
    expect(aman(`${ABT}/tanyajawab_perkara_edit?no_var=5058`, { method: "POST", body: "load_template=A01" })).toBe(true);
    expect(aman(`${ABT}/tanyajawab_perkara_edit?aksi=simpan&no_var=5058`, { method: "POST", body: "load_template=A01" })).toBe(false);
    expect(aman(`${ABT}/get_nomor_perkara`, { method: "POST", body: "noperk=600" })).toBe(true);
    expect(aman(`${ABT}/main/cari`, { method: "POST", body: "a=1" })).toBe(false);
    expect(aman(`${ABT}/main/validasi_bas?aksi=tambah_data`, { method: "POST", body: "x=1" })).toBe(false);
    expect(aman(`${ABT}/main/anonim`, { method: "POST", body: "x=1" })).toBe(false);
    expect(aman(`${ABT}/tanyajawab_template_edit?aksi=simpan&kode=A01`, { method: "POST", body: "data=[]" })).toBe(false);
    const sebelum = h.minta.length;
    await expect(isian(h).massal.ambilPortal("/aleta/api/aleta-ecourt/putusan/unggah-sipp", { method: "POST", body: "x" }, "Unggah")).rejects.toThrow(/Tes putusan/);
    await expect(isian(h).massal.ambilPortal("/aleta/api/aleta-ecourt/konseptor-langkah", { method: "POST", body: "{}" }, "Lapor")).rejects.toThrow(/Tes putusan/);
    expect(h.minta.length).toBe(sebelum);
    // Tanpa tes: pagar yang sama tidak menghalangi (ia hanya hidup pada mode tes).
    ubah(h, q(h, "#bd-tes") as HTMLInputElement, false);
    await sampai(() => kerangka(h).tesPutusan() === false, "tes mati");
    await isian(h).massal.ambilPortal("/aleta/api/aleta-ecourt/putusan/unggah-sipp", { method: "POST", body: "x" }, "Unggah");
    expect(mintaKe(h, /unggah-sipp/, "POST").length).toBe(1);
  });

  it("alat yang menulis atau mencatat (unggah, massal, konseptor, kasir otomatis) dimatikan pada mode tes", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    await nyalakanTes(h);
    let dipanggil = 0;
    kerangka(h).daftarkanAlat("unggah", () => (dipanggil += 1));
    kerangka(h).daftarkanAlat("massal:unggah", () => (dipanggil += 1));
    kerangka(h).daftarkanAlat("konseptor", () => (dipanggil += 1));
    klik(h, "#bd-alat-btn");
    await sampai(() => q(h, '[data-alat="unggah"]'), "menu alat");
    for (const id of ["unggah", "massal:unggah", "konseptor", "kasir:otomatis"]) {
      const t = q(h, `[data-alat="${id}"]`);
      if (!t) continue; // alat yang bukan milik peran yang ditampilkan
      t.click();
      expect(q(h, "#bd-toast")!.textContent).toContain("dimatikan pada mode Tes putusan");
    }
    expect(dipanggil).toBe(0);
  });
});

// ============================================================================
// 4. Gaya: pita memakai token warna
// ============================================================================
describe("4. gaya pita Tes putusan", () => {
  it("memakai token tema (terang dan gelap), tanpa angka warna", () => {
    const css = baca("blangko-derry.css");
    const aturan = (css.match(/#aleta-bd-akar \.bd-pitates[^{]*\{[^}]*\}/g) || []).join("\n");
    expect(aturan).toMatch(/var\(--warn\)/);
    expect(aturan).toMatch(/var\(--warnbg\)/);
    expect(aturan).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(aturan).not.toMatch(/rgba?\(/);
  });
});
