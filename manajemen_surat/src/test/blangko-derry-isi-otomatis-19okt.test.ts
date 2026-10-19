// @vitest-environment node
/**
 * ============================================================================
 * 19 OKT 2026 - BLANGKO DERRY: ISI OTOMATIS DARI SIPP, CATATAN TEKNIS, SARAN PER JENIS DAN PERAN
 * ============================================================================
 *
 * Skrip ekstensi dijalankan sungguhan di jsdom (blangko-derry.js + blangko-derry-isian.js + isi-sipp-bersama.js)
 * dengan portal, bot dan ABT ditiru di fetch. Yang dijaga:
 *   A  saklar "Isi otomatis dari SIPP": bawaan menyala, ada di Alat saya, diingat per pengguna (chrome.storage);
 *   B  begitu perkara + blangko dipilih, isian kosong yang datanya ada di SIPP/e-Court terisi dan tersimpan lewat jalur
 *      simpan yang sama dengan ketikan (tipe dibaca dulu); yang ragu hanya saran; yang sudah ada isinya TIDAK ditimpa;
 *      berlaku untuk putusan, BAS dan relaas; tanpa kata ALETA di muatan simpan;
 *   C  saklar mati: tidak mengisi sendiri, tombol "Isi dari SIPP" tetap bekerja;
 *   D  keterangan teknis ("isian tidak berlaku ... disembunyikan", "penanda tidak ada di katalog ABT") tidak tampil;
 *   E  saran blangko mengikuti JENIS blangko dan PERAN (putusan tidak pernah menyarankan BAS dan sebaliknya);
 *   F  mesin bersama sama dengan abt.js (pembobotan, rute, kode variabel) dan portal membawa jumlah saksi.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { masukanRekomendasiDariBaris, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-15";
const NOMOR = "581/Pdt.G/2026/PA.Dgl";
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
const BLANGKO_PUT = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const BLANGKO_PUT_3 = "[01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi)";
const BLANGKO_BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";
const BLANGKO_BAS_1 = "BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T";
const BLANGKO_REL = "[JS] Relaas Panggilan Sidang T";
const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("0007", "Telah Dikarunai Anak", "data_teks"),
  D("1006", "Tempat tinggal setelah menikah", "data_teks"),
  D("2004", "Pekerjaan terakhir Tergugat", "data_teks"),
  D("0364", "Tanggal KTP Penggugat", "data_tanggal"),
  D("8503", "ALASAN PERCERAIAN <br>SATU HURUF", "data_teks"),
  D("4001", "AMAR PUTUSAN CERAI UNIVERSAL", "data_sql", "select data from aps_badilag.abt_data_teks where no_var = '8503'"),
  D("0156", "Kantor Kuasa #0046# #11111#", "data_teks"),
  D("11111", "PENANDA ADA KUASA #0046#", "data_sql", "select ..."),
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
  D("9101", "Alamat tempat panggilan", "data_teks"),
]);
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1006", "2004", "0364", "0156", "11111", "0033"];
const PENANDA_BAS = ["0001", "0033", "0050", "0007", "1006", "8503"];
const PENANDA_REL = ["0001", "0046", "9101", "1006"];
const PENANDA_OLEH = (berkas: string, indeks: number) => (berkas.startsWith("[01]") ? PENANDA_PUT : berkas.startsWith("[JS]") ? PENANDA_REL : indeks >= 0 ? PENANDA_BAS : PENANDA_BAS);

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const PK = (extra: Record<string, unknown> = {}) => ({
  nomorPerkara: NOMOR, perkaraId: "10154", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: true, tanggalPutusan: HARI_INI, tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim", "pp", "js"], pihak: { penggugat: ["Yulfiani binti Tasbih"], tergugat: ["Andi Rustam bin Syamsudin"] },
  sidang: [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI(HARI_INI, "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)", { urutan: 2 })],
  ...extra,
});
const AKUN = { hakim: ["Hakim Satu"], pp: ["PP Satu"], js: ["JS Satu"] };
type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
  js: { nama: "JS Satu", peran: "Juru Sita", roleId: "jurusita", golonganMenu: ["jurusita"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};

const MENU =
  `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel">` +
  `<a href="${BERANDA}?a=D1&c=" title="(3 Blangko)">Putusan CG</a><a href="${BERANDA}?a=D2&c=" title="(2 Blangko)">BAS CG</a><a href="${BERANDA}?a=D3&c=" title="(1 Blangko)">Relaas</a></div>`;
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");
const POPUP = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>${NOMOR}</b>` +
  (tipe === "data_tanggal" ? `<input type='text' id='tgl_form' value='${nilai}'>` : `<textarea id="value" ${tipe === "data_sql" ? "readonly" : ""}>${nilai}</textarea>`);

type Usulan = Record<string, unknown>;
type Minta = { url: string; cara: string; badan: string };
type Opsi = {
  orang?: string;
  simpanan?: Record<string, unknown>;
  abtAwal?: Record<string, string>;
  usulan?: Usulan[];
  usulanGugatan?: Usulan[];
  tahanUsulan?: Promise<void>;
  rekomendasiPortal?: unknown;
  menuPut?: string[];
  /** Hash alamat ABT, mis. "#bd=...". */
  hash?: string;
  /** Saran yang dipasang segera sesudah skrip termuat (sebelum tautan diproses). */
  saran?: unknown[];
};
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; abt: Record<string, string>; opsi: Opsi };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Opsi = {}): Halaman {
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Panitera</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA + (p.hash ?? ""), runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.11" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_p: unknown, cb?: (h: unknown) => void) => cb && cb({ ok: true, id: 1 }), lastError: undefined },
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
  const abt: Record<string, string> = { ...(p.abtAwal ?? {}) };
  const orang = ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const nilaiDari = (kode: string[], tjKode: Set<string>) => {
    const n: Record<string, unknown> = {};
    for (const k of kode) {
      const v = abt[k] !== undefined && abt[k] !== "" ? { status: "terisi", teks: abt[k], nama: "", sebab: "" } : k === "0001" ? { status: "terisi", teks: NOMOR, nama: "", sebab: "" } : k === "0046" ? { status: "terisi", teks: "Yulfiani binti Tasbih", nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" };
      n[k] = statusNilaiLayar(v, tjKode.has(k));
    }
    return n;
  };
  const BERKAS_PUT = p.menuPut ?? [BLANGKO_PUT, "[02] [Kabul] CG - F"];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    let badan = "";
    if (typeof opsi?.body === "string") badan = opsi.body;
    else if (opsi?.body && typeof (opsi.body as URLSearchParams).toString === "function") badan = String(opsi.body);
    minta.push({ url, cara, badan });
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const admin = p.orang === "admin";
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos([PK({ sebagai: admin ? ["hakim", "pp", "js"] : [{ hakim: "hakim", pp: "pp", js: "js" }[p.orang ?? "hakim"]] })]) } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [] } } });
    if (url.includes("/aleta-ecourt/sidang?dari=")) {
      if (p.rekomendasiPortal) return json({ ok: true, data: { sidang: [{ nomorPerkara: NOMOR, sidangId: `s${HARI_INI}`, tanggalSidang: HARI_INI, rekomendasiBlangko: p.rekomendasiPortal }] } });
      return json({ ok: false }, 404);
    }
    if (url.includes("/aleta-ecourt/sidang/skors?")) return json({ ok: true, data: { available: true, ok: true, riwayat: [], kalimatBas: "" } });
    if (url.includes("/aleta-ecourt/blangko-derry/set-saksi")) return json({ ok: true, data: { ada: false } });
    if (url.includes("/aleta-ecourt/blangko-derry?hak=1")) return json({ ok: true, data: { saklar: { hakimBas: false, ppPutusan: false }, folder: [] } });
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") {
        return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [{ nama: "1 Perceraian CG", jenis: "put", berkas: BERKAS_PUT.map((x) => `${x}.rtf`) }, { nama: "ALUR 02 Cerai Verstek 2 Sidang", jenis: "bas", berkas: [`${BLANGKO_BAS}.rtf`, `${BLANGKO_BAS_1}.rtf`] }, { nama: "98 Relaas", jenis: "rel", berkas: [`${BLANGKO_REL}.rtf`] }], sumber: "pohon", sebab: "" } });
      }
      const berkas = q.get("berkas") || "";
      const s = susunIsian(PENANDA_OLEH(berkas, 0), KATALOG, { P: q.get("sebutanP") || "Penggugat", T: q.get("sebutanT") || "Tergugat" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${berkas}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") ? nilaiDari(kode, kodeTanyaJawab(s)) : undefined, nilaiAda: Boolean(q.get("perkaraId")), nilaiSebab: "" } });
    }
    // Bot / portal: sumber isi dari SIPP
    if (url.includes("/aleta-bot/abt/usulan")) {
      if (p.tahanUsulan) await p.tahanUsulan;
      return json({ ok: true, data: { available: true, sipp: { ok: true, usulan: polos(p.usulan ?? []), jumlahKuasa: 0, prodeo: false } } });
    }
    if (url.includes("/aleta-ecourt/isi-gugatan")) return json({ ok: true, data: { usulan: polos(p.usulanGugatan ?? []), tanyaJawab: [], kalimat: [], kontak: null } });
    if (url.includes("/aleta-ecourt/kuasa-gugatan")) return json({ ok: true, data: { usulan: [], ada: false } });
    if (url.includes("/aleta-ecourt/ktp-pihak")) return json({ ok: true, data: { pihak: [] } });
    if (url.includes("/aleta-ecourt/tanda-tangan")) return json({ ok: false, alasan: "tidak berwenang" }, 403);
    // ABT
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK("Putusan Cerai Gugat", BERKAS_PUT.map((n, i) => [n, `A0${i + 1}`, `B0${i + 1}`] as [string, string, string])));
    if (url.startsWith(`${BERANDA}?a=D2`)) return html(HAL_KELOMPOK("BAS Alur 02", [[BLANGKO_BAS, "A11", "B11"], [BLANGKO_BAS_1, "A12", "B12"]]));
    if (url.startsWith(`${BERANDA}?a=D3`)) return html(HAL_KELOMPOK("Relaas", [[BLANGKO_REL, "A21", "B21"]]));
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    if (url.startsWith(`${ABT}/edit_data?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      if (cara === "POST") {
        abt[kode] = String(new URLSearchParams(badan).get("value") || "");
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      const def = KATALOG.get(kode);
      const tipe = def ? def.jenis : "data_teks";
      if (kode === "0050") return html(POPUP(kode, "multi_sidang", "2"));
      return html(POPUP(kode, tipe, abt[kode] || ""));
    }
    if (url.startsWith(`${ABT}/tanyajawab_perkara_edit?`)) return html(`<script>var ajax_data = []\n</script>`);
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.console.info = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  if (p.saran) w.aletaBlangkoDerryIsian.pasangRekomendasi(() => p.saran);
  return { dom, w, simpanan, minta, abt, opsi: p };
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
const mintaKe = (h: Halaman, pola: RegExp, cara?: string) => h.minta.filter((m) => pola.test(m.url) && (!cara || m.cara === cara));
const ketik = (h: Halaman, el: HTMLInputElement, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  el.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
};

async function sampaiPerkara(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, `[data-pk="${NOMOR}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function pilih(h: Halaman, berkas: string, jenis?: string) {
  klik(h, '[data-bd2="bukamodal"]');
  if (jenis) {
    await sampai(() => q(h, `[data-jenismodal="${jenis}"]`), "tab jenis");
    klik(h, `[data-jenismodal="${jenis}"]`);
  }
  // Berkas ada di salah satu kelompok jendela (Disarankan atau kelompok menu): kelompok dibuka satu per satu sampai ketemu.
  await sampai(() => {
    if (q(h, `[data-bl="${berkas}"]:not([disabled])`)) return true;
    const jumlah = qq(h, "[data-kelmodal]").length;
    for (let i = 0; i < jumlah; i += 1) {
      qq(h, "[data-kelmodal]")[i]?.click(); // gambar ulang menggantikan tombol: ambil lagi tiap putaran
      if (q(h, `[data-bl="${berkas}"]:not([disabled])`)) return true;
    }
    return false;
  }, `berkas ${berkas}`);
  klik(h, `[data-bl="${berkas}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f") || q(h, ".bd-ok"), "perlu diisi tergambar");
}
const isian = (h: Halaman) => h.w.aletaBlangkoDerryIsian;
const nilaiKotak = (h: Halaman, kode: string) => (q(h, `#bd-i${kode}`) as HTMLInputElement | null)?.value;

const SIPP_PUTUSAN: Usulan[] = [
  { kode: "0007", nama: "Anak", nilai: "telah dikaruniai 2 orang anak", keyakinan: "cukup", sumber: [] },
  { kode: "1006", nama: "Tempat tinggal", nilai: "di rumah orang tua Penggugat", keyakinan: "cukup", sumber: [] },
  { kode: "2004", nama: "Pekerjaan", nilai: "petani", keyakinan: "ragu", sumber: [] },
  { kode: "0364", nama: "Tanggal KTP", nilai: "15 Januari 2020", keyakinan: "cukup", sumber: [{ asal: "ktp-ecourt", keterangan: "berkas KTP" }] },
  { kode: "8503", nama: "Huruf alasan", nilai: "F", keyakinan: "pasti", sumber: [] },
];

// ============================================================================
describe("A. saklar Isi otomatis dari SIPP", () => {
  it("bawaan menyala, ada di Alat saya, dan pilihan petugas diingat per pengguna di setelan ekstensi", async () => {
    const h = buka();
    await sampaiPerkara(h);
    expect(h.w.aletaBlangkoDerry.setelan().isiOto).toBe(true);
    klik(h, "#bd-alat-btn");
    const kotak = (await sampai(() => q(h, '#bd-alat input[data-cfg="isiOto"]'), "saklar di Alat saya")) as HTMLInputElement;
    expect(kotak.checked).toBe(true);
    expect(q(h, "#bd-alat")!.textContent).toContain("Isi otomatis dari SIPP");
    kotak.checked = false;
    kotak.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.simpanan.blangkoDerryIsiOto === false, "setelan tersimpan");
    expect(h.w.aletaBlangkoDerry.setelan().isiOto).toBe(false);
  });

  it("setelan yang sudah dimatikan dibaca saat mulai; kunci yang sama ada di popup, latar dan widget", async () => {
    const h = buka({ simpanan: { blangkoDerryIsiOto: false } });
    await sampaiPerkara(h);
    expect(h.w.aletaBlangkoDerry.setelan().isiOto).toBe(false);
    klik(h, "#bd-alat-btn");
    expect(((await sampai(() => q(h, '#bd-alat input[data-cfg="isiOto"]'), "saklar")) as HTMLInputElement).checked).toBe(false);
    for (const berkas of ["popup.js", "latar.js", "blangko-derry.js"]) expect(baca(berkas), berkas).toContain("blangkoDerryIsiOto");
    expect(baca("popup.html")).toContain('id="derryIsiOto"');
  });
});

describe("B. isi otomatis begitu perkara dan blangko dipilih", () => {
  it("putusan: isian kosong terisi dan tersimpan lewat jalur lama; ragu hanya saran; yang sudah ada tidak ditimpa; 8503 tidak ditulis sendiri", async () => {
    const h = buka({ abtAwal: { "1006": "di rumah sendiri" }, usulan: SIPP_PUTUSAN });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "0007 tersimpan di ABT");
    // Jalur simpan yang sama dengan ketikan: tipe dibaca dulu (GET), lalu POST aksi=Simpan dengan var_type.
    const simpan = mintaKe(h, /edit_data\?no_var=0007/, "POST");
    expect(simpan).toHaveLength(1);
    expect(simpan[0].badan).toBe("aksi=Simpan&value=telah+dikaruniai+2+orang+anak&var_type=data_teks");
    const idxGet = h.minta.findIndex((m) => /edit_data\?no_var=0007/.test(m.url) && m.cara === "GET");
    const idxPost = h.minta.findIndex((m) => /edit_data\?no_var=0007/.test(m.url) && m.cara === "POST");
    expect(idxGet).toBeGreaterThanOrEqual(0);
    expect(idxGet).toBeLessThan(idxPost);
    await sampai(() => nilaiKotak(h, "0007") === "telah dikaruniai 2 orang anak", "0007 tampil terisi");
    await sampai(() => (q(h, '[data-status="0007"]')!.textContent || "").includes("terisi dari SIPP"), "status terisi dari SIPP");
    // Tanggal: terbaca dari bacaan SIPP, disimpan d/m/Y.
    await sampai(() => h.abt["0364"] === "15/01/2020", "0364 tersimpan sebagai tanggal ABT");
    // Sudah ada isinya (tersimpan di ABT): tidak ditimpa.
    expect(h.abt["1006"]).toBe("di rumah sendiri");
    expect(mintaKe(h, /edit_data\?no_var=1006/, "POST")).toEqual([]);
    // Ragu: hanya saran samar, belum ditulis.
    const ragu = (await sampai(() => {
      const i = q(h, "#bd-i2004") as HTMLInputElement;
      return i && i.placeholder === "petani" ? i : null;
    }, "saran ragu 2004")) as HTMLInputElement;
    expect(ragu.value).toBe("");
    expect(h.abt["2004"]).toBeUndefined();
    expect(mintaKe(h, /edit_data\?no_var=2004/, "POST")).toEqual([]);
    // Huruf alasan perceraian tidak ditulis sendiri walau terbaca pasti.
    expect(mintaKe(h, /edit_data\?no_var=8503/, "POST")).toEqual([]);
  });

  it("tidak ada kata ALETA di muatan simpan; usulan yang memuatnya dilewati", async () => {
    const h = buka({ usulan: [{ kode: "0007", nama: "Anak", nilai: "dicatat oleh ALETA", keyakinan: "pasti", sumber: [] }, { kode: "1006", nama: "Tempat", nilai: "di rumah bersama", keyakinan: "pasti", sumber: [] }] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["1006"] === "di rumah bersama", "1006 tersimpan");
    await tunggu(100);
    const semuaTulis = h.minta.filter((m) => m.cara === "POST" && /edit_data\?/.test(m.url));
    expect(semuaTulis.length).toBeGreaterThan(0);
    for (const m of semuaTulis) expect(`${m.url} ${m.badan}`, m.url).not.toMatch(/aleta/i);
    expect(h.abt["0007"]).toBeUndefined();
  });

  it("isian yang diketik petugas selagi bacaan SIPP masih berjalan menang (tidak ditimpa)", async () => {
    let lepas: () => void = () => undefined;
    const tahan = new Promise<void>((r) => {
      lepas = r;
    });
    const h = buka({ usulan: SIPP_PUTUSAN, tahanUsulan: tahan });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "belum dikaruniai anak");
    await sampai(() => h.abt["0007"] === "belum dikaruniai anak", "ketikan tersimpan");
    lepas();
    await sampai(() => h.abt["1006"] === "di rumah orang tua Penggugat", "isian lain terisi dari SIPP");
    expect(h.abt["0007"]).toBe("belum dikaruniai anak");
    expect(mintaKe(h, /edit_data\?no_var=0007/, "POST")).toHaveLength(1);
  });

  it("BAS (panitera pengganti) juga terisi otomatis", async () => {
    const h = buka({ orang: "pp", usulan: SIPP_PUTUSAN });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_BAS);
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak" && h.abt["1006"] === "di rumah orang tua Penggugat", "BAS terisi");
    expect(mintaKe(h, /edit_data\?no_var=8503/, "POST")).toEqual([]);
  });

  it("relaas (juru sita) juga terisi otomatis dan punya tombol Isi dari SIPP", async () => {
    const h = buka({ orang: "js", usulan: [{ kode: "9101", nama: "Alamat", nilai: "Jl. Mawar No. 3, Palu", keyakinan: "pasti", sumber: [] }, { kode: "1006", nama: "Tempat", nilai: "di rumah bersama", keyakinan: "cukup", sumber: [] }] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_REL);
    await sampai(() => h.abt["9101"] === "Jl. Mawar No. 3, Palu", "relaas terisi");
    expect(q(h, '[data-bd2="isisipp"]')).not.toBeNull();
  });

  it("peran yang tidak berhak menulis jenis blangko itu tidak menulis apa pun", async () => {
    // Hakim tidak boleh menulis BAS: kelompok BAS bahkan tidak ditawarkan; admin tanpa meniru boleh semuanya.
    const h = buka({ orang: "hakim", usulan: SIPP_PUTUSAN });
    await sampaiPerkara(h);
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
    expect(qq(h, "[data-jenismodal]").map((b) => b.textContent)).toEqual(["Putusan"]);
  });
});

describe("C. saklar mati: tidak mengisi sendiri, tombol manual tetap bekerja", () => {
  it("tanpa saklar tidak ada bacaan SIPP dan tidak ada tulisan; Isi dari SIPP mengisi, tanpa menimpa", async () => {
    const h = buka({ simpanan: { blangkoDerryIsiOto: false }, abtAwal: { "1006": "di rumah sendiri" }, usulan: SIPP_PUTUSAN });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await tunggu(200);
    expect(mintaKe(h, /aleta-bot\/abt\/usulan/)).toEqual([]);
    expect(mintaKe(h, /edit_data\?/, "POST")).toEqual([]);
    expect(nilaiKotak(h, "0007")).toBe("");
    // Manual: mengisi yang kosong.
    klik(h, '[data-bd2="isisipp"]');
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "manual mengisi 0007");
    await sampai(() => h.abt["0364"] === "15/01/2020", "manual mengisi tanggal");
    expect(mintaKe(h, /aleta-bot\/abt\/usulan/, "POST")).toHaveLength(1);
    // Yang sudah ada isinya tetap; dijalankan ulang pun tidak menimpa dan tidak menulis ulang yang sama.
    expect(h.abt["1006"]).toBe("di rumah sendiri");
    const jumlah = mintaKe(h, /edit_data\?/, "POST").length;
    await sampai(() => !h.w.aletaBlangkoDerryIsian.keadaan().isiSipp.jalan, "selesai");
    klik(h, '[data-bd2="isisipp"]');
    await sampai(() => mintaKe(h, /aleta-bot\/abt\/usulan/, "POST").length === 2, "bacaan kedua");
    await tunggu(150);
    expect(mintaKe(h, /edit_data\?/, "POST").length).toBe(jumlah);
    expect(h.abt["1006"]).toBe("di rumah sendiri");
  });

  it("tombol manual berada sejajar Isi dari gugatan (posita)", async () => {
    const h = buka({ usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const alat = qq(h, "#bd-alatisi button").map((b) => b.textContent);
    expect(alat).toContain("Isi dari SIPP");
    expect(alat).toContain("Isi dari gugatan (posita)");
  });
});

describe("D. keterangan teknis tidak tampil", () => {
  it("tanpa 'tidak berlaku ... disembunyikan', 'Tampilkan juga' dan 'tidak ada di katalog ABT'", async () => {
    const h = buka({ orang: "admin", usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const teks = akar(h).textContent || "";
    expect(teks).not.toMatch(/disembunyikan|Tampilkan juga|tidak ada di katalog|tidak berlaku untuk perkara ini|dibaca langsung dari jendela/i);
    // Isian yang tak berlaku (kuasa) tetap disembunyikan diam-diam dan terjangkau lewat Lihat semua isi data.
    expect(qq(h, "#bd-perlu .bd-f").map((f) => f.getAttribute("data-f"))).not.toContain("0156");
    expect(isian(h).keadaan().takBerlaku).toContain("0156");
    klik(h, '[data-bd2="semua"]');
    await sampai(() => (q(h, "#bd-vdaftar")!.textContent || "").includes("biasanya tidak berlaku"), "daftar semua isi data memuat isian tak berlaku");
    expect(q(h, "#bd-vdaftar")!.textContent).toContain("Nama kantor advokat");
  });
});

describe("E. saran blangko mengikuti jenis blangko dan peran", () => {
  const SARAN_CAMPUR = () => [
    { berkas: BLANGKO_BAS_1, kelompok: "BAS CG", jenis: "bas", alasan: 'dari agenda sidang ke-2: "Pembuktian" - Langkah BAS menurut keadaan sidang. Perkara ini memakai folder alur 01 yang disalin.' },
    { berkas: BLANGKO_PUT, kelompok: "Putusan CG", jenis: "put", alasan: 'dari keterangan sidang ke-2: "putus DIKABULKAN (verstek)" - Putusan dikabulkan (verstek).' },
    { berkas: BLANGKO_REL, kelompok: "Relaas", jenis: "rel", alasan: "dari keadaan perkara - Relaas pemberitahuan putusan." },
  ];
  const teksSaran = (h: Halaman) => q(h, "#bd-saranblangko")!.textContent || "";

  it("blangko putusan terpilih: saran putusan, BAS yang kebetulan paling depan tidak ikut; teks tanpa istilah teknis", async () => {
    const h = buka({ orang: "admin", usulan: [] });
    await sampaiPerkara(h);
    isian(h).pasangRekomendasi(SARAN_CAMPUR);
    await pilih(h, BLANGKO_PUT);
    const t = teksSaran(h);
    expect(t).toContain("Blangko ini sesuai saran untuk sidang ke-2");
    expect(t).not.toMatch(/BAS|folder|alur|salin/i);
    expect(t).not.toMatch(/ALETA/);
    // Blangko BAS terpilih: sebaliknya.
    await pilih(h, BLANGKO_BAS, "bas");
    const b = teksSaran(h);
    expect(b).toContain("Saran untuk sidang ke-2");
    expect(b).toContain("BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T");
    expect(b).not.toContain("Kabul Verstek");
    expect(b).not.toMatch(/folder|alur 01|disalin/i);
    expect(q(h, '[data-bd2="pakairek"]')).not.toBeNull();
  });

  it("tanpa blangko: hakim dapat putusan, panitera pengganti BAS, juru sita relaas; tidak pernah jenis lain", async () => {
    for (const [orang, harus, tidak] of [
      ["hakim", "Kabul Verstek", "Tunda Panggil"],
      ["pp", "Tunda Panggil T", "Kabul Verstek"],
      ["js", "Relaas Panggilan Sidang T", "Kabul Verstek"],
    ] as const) {
      const h = buka({ orang, usulan: [] });
      await sampaiPerkara(h);
      isian(h).pasangRekomendasi(SARAN_CAMPUR);
      klik(h, '[data-bd2="bukamodal"]'); // memuat menu lalu gambar ulang ringkasan
      await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
      klik(h, '[data-bd2="tutupmodal"]');
      await sampai(() => teksSaran(h).includes("Saran untuk sidang ke-2"), `saran ${orang}`);
      expect(teksSaran(h), orang).toContain(harus);
      expect(teksSaran(h), orang).not.toContain(tidak);
    }
  });

  it("tidak ada saran yang cocok jenisnya: dikatakan terus terang, tidak menyarankan jenis lain", async () => {
    const h = buka({ orang: "admin", usulan: [] });
    await sampaiPerkara(h);
    isian(h).pasangRekomendasi(() => [{ berkas: BLANGKO_BAS_1, kelompok: "BAS CG", jenis: "bas", alasan: "dari keadaan perkara" }]);
    await pilih(h, BLANGKO_PUT);
    const t = teksSaran(h);
    expect(t).toContain("Belum ada saran blangko putusan atau penetapan untuk sidang ke-2");
    expect(t).not.toContain("Tunda Panggil");
    expect(q(h, '[data-bd2="pakairek"]')).toBeNull();
  });

  it("alasan saran diramahkan; varian jumlah saksi dipilih sesuai saksi yang ada", () => {
    const h = buka();
    const m = isian(h).murni;
    expect(m.ramahkanAlasan('dari agenda sidang ke-2: "Pembuktian" - Langkah BAS menurut keadaan sidang. Gugatan ini memakai BAS ALUR 04 yang disalin ke folder jenisnya.')).toBe('agenda "Pembuktian" - Langkah BAS menurut keadaan sidang.');
    expect(m.ramahkanAlasan("Jenis perkara ini belum punya folder alur BAS.")).toBe("");
    const daftar = ["[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", "[01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf", "[01] [Kabul Verstek] Cerai (Format Lengkap) - (4 Saksi).rtf", "[01] [Kabul Verstek] Cerai (Format Lengkap) - (5 Saksi).rtf"];
    const dasar = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
    expect(m.pilihVarianSaksi(dasar, daftar, 2)).toBe(dasar);
    expect(m.pilihVarianSaksi(dasar, daftar, 3)).toBe(`${dasar} - (3 Saksi)`);
    expect(m.pilihVarianSaksi(dasar, daftar, 5)).toBe(`${dasar} - (5 Saksi)`);
    expect(m.pilihVarianSaksi(dasar, daftar, 9)).toBe(`${dasar} - (5 Saksi)`);
    expect(m.pilihVarianSaksi(dasar, daftar, 0)).toBe(dasar);
    expect(m.pilihVarianSaksi(dasar, [daftar[0]], 4)).toBe(dasar);
    expect(m.pilihVarianSaksi(`${dasar} - (3 Saksi)`, daftar, 2)).toBe(dasar);
  });

  it("perkara putus kabul verstek dengan tiga saksi: portal membawa jumlah saksi dan saran putusan memakai varian 3 saksi", async () => {
    const baris = {
      nomorPerkara: NOMOR, sidangId: `s${HARI_INI}`, tanggalSidang: HARI_INI, jenisPerkara: "Cerai Gugat", urutanSidang: 2, dihadiriOleh: 2, agenda: "Pemeriksaan pokok perkara", alasanDitunda: "putus DIKABULKAN (verstek)",
      sudahPutus: true, statusPutusan: "Dikabulkan", verstekPutusan: true, panggilan: { tergugatPernahHadir: false }, lewatEcourt: false, saksiPihak1: 3, saksiPihak2: 0,
    };
    const hasil = rekomendasiBlangko(masukanRekomendasiDariBaris(baris));
    expect(hasil.jumlahSaksi).toBe(3);
    expect(hasil.putusan.length).toBeGreaterThan(0);
    // Sambungan portal -> ekstensi: banyaknya saksi ikut ke tiap saran.
    const h = buka({ orang: "hakim", usulan: [], menuPut: [BLANGKO_PUT, BLANGKO_PUT_3] });
    const murni = isian(h).murni;
    const out = polos(murni.saranDariPortal(hasil, [{ nama: "CG - Putusan" }], { urutan: 2 })) as Array<{ jenis: string; saksi?: number }>;
    expect(out.filter((x) => x.jenis === "put").every((x) => x.saksi === 3)).toBe(true);
    // Di jendela: dasar "(2 saksi)" diganti varian "(3 Saksi)" begitu daftar kelompoknya termuat.
    await sampaiPerkara(h);
    isian(h).pasangRekomendasi(() => [{ berkas: BLANGKO_PUT, kelompok: "Putusan CG", jenis: "put", alasan: "dari keadaan perkara - Putusan dikabulkan (verstek).", saksi: 3 }]);
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
    const rek = await sampai(() => isian(h).rekomendasi().find((x: { jenis: string; berkas: string }) => x.jenis === "put" && x.berkas === BLANGKO_PUT_3), "saran putusan varian 3 saksi");
    expect(rek.alasan).not.toMatch(/folder|alur/i);
    // Dua saksi: blangko dasar.
    isian(h).pasangRekomendasi(() => [{ berkas: BLANGKO_PUT_3, kelompok: "Putusan CG", jenis: "put", alasan: "", saksi: 2 }]);
    expect(isian(h).rekomendasi()[0].berkas).toBe(BLANGKO_PUT);
  });

  it("tanpa data saksi dari portal: tidak menebak varian; masukan lama tetap sama", () => {
    const hasil = rekomendasiBlangko(masukanRekomendasiDariBaris({ nomorPerkara: NOMOR, jenisPerkara: "Cerai Gugat", urutanSidang: 2, agenda: "Pembuktian" }));
    expect("jumlahSaksi" in hasil).toBe(false);
  });
});

describe("F. mesin bersama sama dengan abt.js", () => {
  const abt = baca("abt.js");
  const mesin = () => {
    const h = buka();
    return h.w.AletaIsiSipp as {
      PANGKAT_YAKIN: Record<string, number>;
      KTP_KODE_PIHAK: Record<string, unknown>;
      API: Record<string, string>;
      VAR_ECOURT: string[];
      VAR_KUASA: string[];
      VAR_BUKTI: string[];
      terdeteksi: (u: unknown) => boolean;
      bobot: (u: unknown) => number;
      putuskan: (u: unknown, c: unknown) => { golongan: string; nilai: string; sebab: string };
    };
  };
  const literal = (nama: string) => {
    const a = abt.indexOf(`const ${nama} = `);
    if (a < 0) throw new Error(`tidak ditemukan di abt.js: ${nama}`);
    const dari = abt.indexOf("(", a);
    const akhir = abt.indexOf(");", a);
    return new Function(`return (${abt.slice(dari + 1, akhir)});`)();
  };

  it("pangkat keyakinan, terdeteksi dan bobot menghasilkan angka yang sama", () => {
    const m = mesin();
    const pangkat = literal("SORE_PANGKAT_YAKIN");
    expect(polos(m.PANGKAT_YAKIN)).toEqual(polos(pangkat));
    const a = abt.indexOf("function soreTerdeteksi(u)");
    const blok = abt.slice(a, abt.indexOf("function sorePilihUsulan", a));
    const abtFn = new Function("SORE_PANGKAT_YAKIN", `${blok}\nreturn { soreTerdeteksi, soreBobot };`)(pangkat) as { soreTerdeteksi: (u: unknown) => boolean; soreBobot: (u: unknown) => number };
    const contoh: unknown[] = [
      { nilai: "x", keyakinan: "pasti" },
      { nilai: "", keyakinan: "cukup" },
      { nilai: "  ", pilihan: ["a"], keyakinan: "ragu" },
      { nilai: "", pilihan: [{ nilai: "b" }], keyakinan: "bentrok" },
      { nilai: "", pilihan: [{ nilai: " " }, ""], keyakinan: "kosong" },
      { nilai: "y", keyakinan: "tidak dikenal" },
      { keyakinan: "pasti" },
    ];
    for (const u of contoh) {
      expect(m.terdeteksi(u), JSON.stringify(u)).toBe(abtFn.soreTerdeteksi(u));
      expect(m.bobot(u), JSON.stringify(u)).toBe(abtFn.soreBobot(u));
    }
  });

  it("rute bacaan, kode tanggal KTP, kode e-Court dan kuasa sama dengan yang dipakai abt.js", () => {
    const m = mesin();
    const dalamAbt = (nama: string) => (abt.match(new RegExp(`const ${nama} = "([^"]+)"`)) || [])[1];
    expect(m.API.usulan).toBe(dalamAbt("ALETA_API_ABT"));
    expect(m.API.gugatan).toBe(dalamAbt("ALETA_API_ISI_GUGATAN"));
    expect(m.API.kuasa).toBe(dalamAbt("ALETA_API_KUASA"));
    expect(m.API.ktp).toBe(dalamAbt("ALETA_API_KTP_PIHAK"));
    expect(polos(m.KTP_KODE_PIHAK)).toEqual(literal("KTP_KODE_PIHAK"));
    expect(polos(m.VAR_KUASA)).toEqual(polos(literal("A3_VAR_KUASA")));
    expect(polos(m.VAR_BUKTI)).toEqual(polos(literal("P4_VAR_BUKTI")));
    expect(polos(m.VAR_ECOURT)).toEqual(polos([...literal("P4_VAR_ECOURT"), ...literal("K5_VAR_KONTAK")]));
  });

  it("keputusan menulis: pasti/cukup + kosong = tulis; ragu, pilihan, huruf alasan = saran; ada isinya, dihitung ABT, memuat ALETA = lewati", () => {
    const m = mesin();
    const ctx = { kosong: true, jenis: "teks" };
    expect(m.putuskan({ kode: "0007", nilai: "x", keyakinan: "pasti" }, ctx).golongan).toBe("tulis");
    expect(m.putuskan({ kode: "0007", nilai: "x", keyakinan: "cukup" }, ctx).golongan).toBe("tulis");
    expect(m.putuskan({ kode: "0007", nilai: "x", keyakinan: "cukup", bentrok: "y" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "0007", nilai: "x", keyakinan: "ragu" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "0007", nilai: "x", keyakinan: "ocr" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "0007", nilai: "", pilihan: ["a", "b"], keyakinan: "pasti" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "8503", nilai: "F", keyakinan: "pasti" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "5227", nilai: "x", keyakinan: "pasti" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "0007", nilai: "x", keyakinan: "pasti" }, { ...ctx, kosong: false }).golongan).toBe("lewati");
    expect(m.putuskan({ kode: "0007", nilai: "x", keyakinan: "pasti", dihitung: true }, ctx).golongan).toBe("lewati");
    expect(m.putuskan({ kode: "0007", nilai: "ditulis A L E T A", keyakinan: "pasti" }, ctx).golongan).toBe("lewati");
    expect(m.putuskan({ kode: "0007", nilai: "dari Aleta", keyakinan: "pasti" }, ctx).golongan).toBe("lewati");
    expect(m.putuskan({ kode: "0007", nilai: "", keyakinan: "pasti" }, ctx).golongan).toBe("lewati");
  });

  it("berkas baru terdaftar di manifest (ABT, sebelum abt.js) dan di penyusun ekstensi", () => {
    const manifest = JSON.parse(baca("manifest.json")) as { content_scripts: Array<{ js: string[] }> };
    const entri = manifest.content_scripts.find((c) => c.js.includes("blangko-derry-isian.js"))!;
    expect(entri.js.indexOf("isi-sipp-bersama.js")).toBeGreaterThanOrEqual(0);
    expect(entri.js.indexOf("isi-sipp-bersama.js")).toBeLessThan(entri.js.indexOf("abt.js"));
    expect(entri.js.indexOf("isi-sipp-bersama.js")).toBeLessThan(entri.js.indexOf("blangko-derry-isian.js"));
    const susun = readFileSync(path.join(process.cwd(), "scripts", "susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"isi-sipp-bersama.js"');
  });
});

// ============================================================================
describe("G. tautan dari Jadwal Sidang portal (#bd=)", () => {
  const tautan = (o: Record<string, unknown>) => `#bd=${encodeURIComponent(JSON.stringify({ v: 1, nomor: NOMOR, perkaraId: "10154", sidangKe: 2, tanggalSidang: HARI_INI, jenis: "putusan", agenda: "Pemeriksaan pokok perkara", tunda: false, keterangan: "putus DIKABULKAN (verstek)", amar: "Mengabulkan gugatan Penggugat secara verstek", verstek: true, jumlahSaksiP: 2, jumlahSaksiT: 0, ...o }))}`;
  const SARAN = [
    { berkas: BLANGKO_BAS_1, kelompok: "BAS CG", jenis: "bas", alasan: 'dari agenda sidang ke-2: "Pembuktian"' },
    { berkas: BLANGKO_PUT, kelompok: "Putusan CG", jenis: "put", alasan: "dari keadaan perkara - Putusan dikabulkan (verstek)." },
  ];
  const blangkoTerpilih = (h: Halaman) => isian(h).keadaan().blangko?.berkas as string | undefined;
  const toast = (h: Halaman) => q(h, "#bd-toast")?.textContent || "";

  it("hash dibaca: panel terbuka sendiri, perkara + sidang dipilih, blangko putusan dipilih dari saran, isi otomatis jalan, hash dihapus dari alamat", async () => {
    const h = buka({ hash: tautan({}), saran: SARAN, usulan: SIPP_PUTUSAN });
    await sampai(() => D_(h).documentElement.classList.contains("aleta-bd-aktif"), "panel terbuka sendiri");
    await sampai(() => blangkoTerpilih(h) === BLANGKO_PUT, "blangko saran terpilih");
    // Sidang ke-2 (tanggal tautan) yang terpilih, bukan sidang acuan lain.
    expect(isian(h).keadaan().pk.sidangKe).toBe(1);
    expect(h.w.aletaBlangkoDerry.keadaan().sidIdx).toBe(1);
    // Daftar perkara diminta dalam rentang lebar.
    expect(mintaKe(h, /perkara-saya\?mode=semua/).length).toBeGreaterThan(0);
    // Isi otomatis berjalan sesudah blangko terpilih (saklar menyala).
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "isi otomatis");
    // Hash dihapus: muat ulang tidak mengulang.
    expect(h.w.location.hash).toBe("");
    expect(h.w.location.href).toBe(BERANDA);
    // Blangko tetap bisa diganti.
    expect(q(h, '[data-bd2="bukamodal"]')).not.toBeNull();
  });

  it("jenis BAS: panitera pengganti mendapat BAS, bukan putusan", async () => {
    const h = buka({ orang: "pp", hash: tautan({ jenis: "bas", verstek: false }), saran: SARAN, usulan: [] });
    await sampai(() => blangkoTerpilih(h) === BLANGKO_BAS_1, "BAS terpilih");
    expect(blangkoTerpilih(h)).not.toBe(BLANGKO_PUT);
  });

  it("hak peran tetap berlaku: panitera pengganti tidak dibukakan blangko putusan; kalimat biasa, tanpa blangko terpilih", async () => {
    const h = buka({ orang: "pp", hash: tautan({ jenis: "putusan" }), saran: SARAN, usulan: SIPP_PUTUSAN });
    await sampai(() => D_(h).documentElement.classList.contains("aleta-bd-aktif"), "panel terbuka");
    await sampai(() => /tidak berhak membuka blangko putusan/.test(toast(h)), "kalimat hak");
    expect(toast(h)).not.toMatch(/galat|error|undefined|json/i);
    await tunggu(200);
    expect(blangkoTerpilih(h)).toBeUndefined();
    expect(mintaKe(h, /edit_data\?/, "POST")).toEqual([]);
  });

  it("tanpa saran yang pasti: jendela pilih blangko terbuka pada jenis yang diminta", async () => {
    const h = buka({ orang: "admin", hash: tautan({ jenis: "bas", keterangan: "", agenda: "", amar: "", verstek: false }), saran: [{ berkas: BLANGKO_PUT, kelompok: "Putusan CG", jenis: "put", alasan: "" }], usulan: [] });
    await sampai(() => q(h, "#bd-modal:not([hidden])"), "jendela terbuka");
    expect(q(h, '[data-jenismodal="bas"][aria-selected="true"]')).not.toBeNull();
    expect(blangkoTerpilih(h)).toBeUndefined();
  });

  it("tanpa mesin saran dari portal: petunjuk tautan (verstek, amar) dan jumlah saksi memilih putusan dan varian saksinya", async () => {
    const h = buka({ hash: tautan({ jumlahSaksiP: 3, keterangan: "", agenda: "Pembacaan putusan" }), menuPut: [BLANGKO_PUT, BLANGKO_PUT_3], usulan: [] });
    await sampai(() => blangkoTerpilih(h) === BLANGKO_PUT_3, "putusan varian 3 saksi terpilih");
  });

  it("hash rusak atau versi tak dikenal diabaikan diam-diam (hash tetap dihapus, tanpa pesan)", async () => {
    const rusak = ["#bd=%7Bbukan-json", "#bd=" + encodeURIComponent(JSON.stringify({ v: 2, nomor: NOMOR })), "#bd=" + encodeURIComponent(JSON.stringify({ v: 1 })), "#bd=" + encodeURIComponent("[]"), "#bd="];
    for (const hash of rusak) {
      const h = buka({ hash, usulan: [] });
      await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
      await tunggu(80);
      expect(h.w.location.hash, hash).toBe("");
      expect(D_(h).documentElement.classList.contains("aleta-bd-aktif"), hash).toBe(false);
      expect(mintaKe(h, /perkara-saya/), hash).toEqual([]);
      expect(D_(h).body.textContent, hash).not.toMatch(/SyntaxError|Unexpected|JSON/);
    }
  });

  it("perkara tidak ada di daftar akun: kalimat biasa dan panel tetap terbuka", async () => {
    const h = buka({ hash: tautan({ nomor: "999/Pdt.G/2026/PA.Dgl", perkaraId: "99999" }), saran: SARAN, usulan: [] });
    await sampai(() => /tidak ada di daftar perkara Anda/.test(toast(h)), "kalimat perkara tak ditemukan");
    expect(blangkoTerpilih(h)).toBeUndefined();
  });

  it("pembaca hash murni: menormalkan, memangkas, dan menolak yang tak sah", () => {
    const h = buka();
    const baca = h.w.aletaBlangkoDerry.murni.bacaTautanBd as (x: string) => Record<string, unknown> | null;
    const ok = polos(baca(tautan({ jenis: "penetapan", sidangKe: 3, jumlahSaksiP: 2, jumlahSaksiT: 99, tunda: "ya", agenda: "  A   B  " })));
    expect(ok).toMatchObject({ nomor: NOMOR, perkaraId: "10154", sidangKe: 3, tanggalSidang: HARI_INI, jenis: "penetapan", agenda: "A B", tunda: false, verstek: true, jumlahSaksiP: 2, jumlahSaksiT: 0 });
    expect(polos(baca(tautan({ jenis: "relaas", tanggalSidang: "besok", sidangKe: -1 })))).toMatchObject({ jenis: "", tanggalSidang: "", sidangKe: 0 });
    expect(baca("")).toBeNull();
    expect(baca("#lain=1")).toBeNull();
    expect(baca(tautan({ v: 2 }))).toBeNull();
    expect(baca(tautan({ nomor: "", perkaraId: "" }))).toBeNull();
  });
});

// ============================================================================
describe("H. kotak blangko di langkah 2 dapat dibuka dengan klik dua kali, Enter atau Spasi", () => {
  const dblklik = (h: Halaman, el: Element) => el.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true, cancelable: true }));
  const tekan = (h: Halaman, el: Element, key: string) => el.dispatchEvent(new h.w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  const modalTerbuka = (h: Halaman) => q(h, "#bd-modal:not([hidden])");

  it("belum ada blangko: kotak berpetunjuk, klik dua kali, Enter dan Spasi membuka pemilih; klik satu kali tidak", async () => {
    const h = buka({ usulan: [] });
    await sampaiPerkara(h);
    const kotak = q(h, "#bd-blringkas")!;
    expect(kotak.textContent).toContain("Belum ada blangko dipilih");
    expect(kotak.getAttribute("title")).toBe("Klik dua kali untuk memilih blangko");
    expect(kotak.getAttribute("tabindex")).toBe("0");
    expect(kotak.getAttribute("style")).toContain("cursor:pointer");
    kotak.click();
    expect(modalTerbuka(h)).toBeNull();
    dblklik(h, kotak);
    await sampai(() => modalTerbuka(h), "pemilih dari klik dua kali");
    klik(h, '[data-bd2="tutupmodal"]');
    tekan(h, q(h, "#bd-blringkas")!, "Enter");
    await sampai(() => modalTerbuka(h), "pemilih dari Enter");
    klik(h, '[data-bd2="tutupmodal"]');
    tekan(h, q(h, "#bd-blringkas")!, " ");
    await sampai(() => modalTerbuka(h), "pemilih dari Spasi");
  });

  it("blangko sudah terpilih: klik dua kali pada kotak (bukan hanya pada namanya) membuka pemilih untuk mengganti", async () => {
    const h = buka({ usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    expect(modalTerbuka(h)).toBeNull();
    const kotak = q(h, "#bd-blringkas")!;
    dblklik(h, kotak.querySelector(".bd-chip") || kotak);
    await sampai(() => modalTerbuka(h), "pemilih dari kotak blangko terpilih");
  });

  it("teks saran dibersihkan dari istilah teknis (folder alur, salinan) dan perkiraan tetap disebut", () => {
    const h = buka();
    const ramah = h.w.aletaBlangkoDerryIsian.murni.ramahkanAlasan as (x: string) => string;
    const asli = 'dari keterangan sidang ke-1: "putus verstek" - (Putus di sidang pertama: folder alur 01.) (perkiraan, periksa kembali)';
    const hasil = ramah(asli);
    expect(hasil).toBe('keterangan "putus verstek" - Putus di sidang pertama. (perkiraan, periksa kembali)');
    expect(hasil).not.toMatch(/folder|alur|ALETA/i);
  });
});
