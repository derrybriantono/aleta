// @vitest-environment node
/**
 * ============================================================================
 * 19 OKT 2026 - BLANGKO ABT BY DERRY: KELOMPOK "IKRAR TALAK"
 * ============================================================================
 *
 * Keluhan: "ikrar talak kenapa belum ada di blangko derry?" Blangko ikrarnya ADA tetapi tersebar di tiga folder - berita acara sidang
 * ikrar (menu Cerai Talak - BAS), penetapan ikrar dan penetapan putusan gugur (menu Cerai Talak - Putusan), relaas/amplop panggilan ikrar
 * (menu Relaas) - sehingga tidak ketemu di jendela "Pilih blangko". blangko-derry-isian.js dijalankan SUNGGUHAN di jsdom dengan portal, bot,
 * dan ABT ditiru di fetch. Yang dijaga:
 *   A  kelompok maya "Ikrar Talak" tepat di bawah menu cerai talak, berisi butir dari tiga folder asal (tanpa memindah/menggandakan);
 *   B  hak per peran mengikuti hak folder asal: hakim = penetapan + BAS, PP = BAS, juru sita = relaas, Super Admin semuanya;
 *   C  kotak cari menemukan dengan kata "ikrar" (juga "penetapan", "relaas"); membuka butir memakai token kelompok ASLINYA;
 *   D  saran menurut kehadiran (cadangan ekstensi dan aturan portal rekomendasi-blangko.ts): P hadir & T tidak -> [1]/[90]; keduanya -> [2]/[90a]
 *      ([2a] bila ada beban); P tidak hadir -> [3]/[4]; lewat 6 bulan -> [91];
 *   E  isi otomatis dari SIPP berlaku juga untuk blangko ikrar.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { tentukanAlurBas } from "@/lib/alur-bas";
import { masukanRekomendasiDariBaris, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const irisanAbt = (mulai: string, selesai: string) => {
  const sumberAbt = baca("abt.js");
  const a = sumberAbt.indexOf(mulai);
  if (a < 0) throw new Error(`tidak ditemukan di abt.js: ${mulai}`);
  return sumberAbt.slice(a, sumberAbt.indexOf(selesai, a));
};
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-15";
const NOMOR = "540/Pdt.G/2026/PA.Dgl";
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
// Bahan: tiga folder asal butir ikrar (nama berkas persis seperti di ABT) + folder lain yang BUKAN ikrar
// ----------------------------------------------------------------------------
const CT_PUT_BIASA = "[01] [Kabul Verstek] Cerai Talak (Format Lengkap)";
const P_90 = "[90] [Ikrar] Penetapan Ikrar Talak - P Hadir & T Tidak Hadir";
const P_90A = "[90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir";
const P_91 = "[91] [Ikrar Gugur] Penetapan Kekuatan Putusan Gugur - P Tidak Ikrar 6 Bulan";
const CT_BAS_BIASA = "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T";
const B_1 = "[1] BAS Ikrar Talak - P Hadir & T Tidak Hadir";
const B_2 = "[2] BAS Ikrar Talak - P & T Hadir";
const B_2A = "[2a] BAS Ikrar Talak - P & T Hadir, Ada Beban";
const B_3 = "[3] BAS Ikrar Talak - P Tidak Hadir & T Hadir, Tunda Tenggang Waktu 6 Bulan";
const B_4 = "[4] BAS Ikrar Talak - P & T Tidak Hadir, Tunda Tenggang Waktu 6 Bulan";
const R_BIASA = "[JS] 1. Relaas Panggilan Sidang Pertama T";
const R_4 = "[JS] 4. Relaas Panggilan Ikrar Talak P dan T";
const R_7 = "[JS] 7. Relaas Panggilan Ikrar Talak (e-Court)";
const R_831 = "[JS] 8.3.1. Amplop Relaas Panggilan Ikrar Talak P";
const R_832 = "[JS] 8.3.2. Amplop Relaas Panggilan Ikrar Talak T";
const CG_PUT = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const CG_BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";

// kelompok -> [token a, halaman]; kelompok "ALUR 10" menggandakan sebagian nama BAS ikrar (harus diambil sekali)
const KELOMPOK: Record<string, { id: string; a: string; berkas: string[] }> = {
  "Cerai Talak - Putusan": { id: "D1", a: "A1", berkas: [CT_PUT_BIASA, P_90, P_90A, P_91] },
  "Cerai Gugat - Putusan": { id: "D4", a: "A4", berkas: [CG_PUT] },
  "Cerai Talak - BAS": { id: "D2", a: "A2", berkas: [CT_BAS_BIASA, B_1, B_2, B_2A, B_3, B_4] },
  "Cerai Gugat - BAS": { id: "D5", a: "A5", berkas: [CG_BAS] },
  "ALUR 10 Cerai Talak Sidang Ikrar Talak": { id: "D6", a: "A6", berkas: [B_1, B_2] },
  Relaas: { id: "D3", a: "A3", berkas: [R_BIASA, R_4, R_7, R_831, R_832] },
};

const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("0007", "Telah Dikarunai Anak", "data_teks"),
  D("1006", "Tempat tinggal setelah menikah", "data_teks"),
  D("9101", "Alamat tempat panggilan", "data_teks"),
  D("0033", "Tgl Sidang", "multi_sidang"),
]);
const PENANDA_PUT = ["0001", "0046", "0007", "1006", "0033"];
const PENANDA_BAS = ["0001", "0033", "0007", "1006"];
const PENANDA_REL = ["0001", "0046", "9101", "1006"];
const PENANDA_OLEH = (berkas: string) => (berkas.startsWith("[JS]") ? PENANDA_REL : berkas.startsWith("[9") || berkas.startsWith("[01]") ? PENANDA_PUT : PENANDA_BAS);

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const PK = (extra: Record<string, unknown> = {}) => ({
  nomorPerkara: NOMOR, perkaraId: "10154", jenisPerkara: "Cerai Talak", alurPerkaraId: 15, sudahPutus: true, tanggalPutusan: "2026-09-01", tanggalMinutasi: "",
  adaBerkasPutusan: true, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim", "pp", "js"], pihak: { penggugat: ["Yulfiani binti Tasbih"], tergugat: ["Andi Rustam bin Syamsudin"] },
  sidang: [SI("2026-08-20", "Pembuktian", "putus DIKABULKAN", { urutan: 1 }), SI(HARI_INI, "Sidang Ikrar Talak", "", { urutan: 2, hadir: 1 })],
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
  Object.entries(KELOMPOK).map(([nama, k]) => `<a href="${BERANDA}?a=${k.id}&c=" title="(${k.berkas.length} Blangko)">${nama}</a>`).join("") +
  `</div>`;
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");
const POPUP = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>${NOMOR}</b>` +
  (tipe === "data_tanggal" ? `<input type='text' id='tgl_form' value='${nilai}'>` : `<textarea id="value" ${tipe === "data_sql" ? "readonly" : ""}>${nilai}</textarea>`);

type Minta = { url: string; cara: string; badan: string };
type Opsi = { orang?: string; hadir?: number | null; ket?: string; usulan?: Array<Record<string, unknown>> };
type Halaman = { dom: JSDOM; w: any; minta: Minta[]; abt: Record<string, string> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Opsi = {}): Halaman {
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Panitera</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.12" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_p: unknown, cb?: (h: unknown) => void) => cb && cb({ ok: true, id: 1 }), lastError: undefined },
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
  const abt: Record<string, string> = {};
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
  const sidang = [SI("2026-08-20", "Pembuktian", "putus DIKABULKAN", { urutan: 1 }), SI(HARI_INI, "Sidang Ikrar Talak", p.ket ?? "", { urutan: 2, hadir: p.hadir === undefined ? 1 : p.hadir })];
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
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos([PK({ sidang })]) } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [] } } });
    if (url.includes("/aleta-ecourt/sidang?dari=")) return json({ ok: false }, 404);
    if (url.includes("/aleta-ecourt/sidang/skors?")) return json({ ok: true, data: { available: true, ok: true, riwayat: [], kalimatBas: "" } });
    if (url.includes("/aleta-ecourt/blangko-derry/set-saksi")) return json({ ok: true, data: { ada: false } });
    if (url.includes("/aleta-ecourt/blangko-derry?hak=1")) return json({ ok: true, data: { saklar: { hakimBas: false, ppPutusan: false }, folder: [] } });
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") {
        return json({
          ok: true,
          data: {
            ada: true,
            akar: "derry_briantono",
            folder: [
              { nama: "1a Perceraian CT", jenis: "put", berkas: KELOMPOK["Cerai Talak - Putusan"].berkas.map((x) => `${x}.rtf`) },
              { nama: "1a Perceraian CT - BAS", jenis: "bas", berkas: KELOMPOK["Cerai Talak - BAS"].berkas.map((x) => `${x}.rtf`) },
              { nama: "98 Relaas", jenis: "rel", berkas: KELOMPOK.Relaas.berkas.map((x) => `${x}.rtf`) },
            ],
          },
        });
      }
      const berkas = q.get("berkas") || "";
      const s = susunIsian(PENANDA_OLEH(berkas), KATALOG, { P: q.get("sebutanP") || "Pemohon", T: q.get("sebutanT") || "Termohon" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${berkas}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") ? nilaiDari(kode, kodeTanyaJawab(s)) : undefined, nilaiAda: Boolean(q.get("perkaraId")), nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/usulan")) {
      const sumber = (() => {
        try {
          return String(JSON.parse(badan).sumber || "");
        } catch {
          return "";
        }
      })();
      if (sumber === "saksi") return json({ ok: true, data: { available: true, saksi: { usulan: [], huruf: [] } } });
      if (sumber === "itsbat" || sumber === "posita-lain") return json({ ok: true, data: { available: true, itsbat: { ok: false }, positaLain: { ok: false, alasan: "jenis_perkara_tidak_dilayani" } } });
      return json({ ok: true, data: { available: true, sipp: { ok: true, usulan: polos(p.usulan ?? []), jumlahKuasa: 0, prodeo: false } } });
    }
    if (url.includes("/aleta-ecourt/isi-gugatan")) return json({ ok: true, data: { usulan: [], tanyaJawab: [], kalimat: [], kontak: null } });
    if (url.includes("/aleta-ecourt/kuasa-gugatan")) return json({ ok: true, data: { usulan: [], ada: false } });
    if (url.includes("/aleta-ecourt/ktp-pihak")) return json({ ok: true, data: { pihak: [] } });
    if (url.includes("/aleta-ecourt/tanda-tangan")) return json({ ok: false, alasan: "tidak berwenang" }, 403);
    // ABT
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    for (const [nama, k] of Object.entries(KELOMPOK)) {
      if (url.startsWith(`${BERANDA}?a=${k.id}`)) return html(HAL_KELOMPOK(nama, k.berkas.map((n, i) => [n, `${k.a}${i}`, `B${k.id}${i}`] as [string, string, string])));
    }
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
  w.eval(irisanAbt("function teksSaksiMentah(baris)", "/** Banyaknya butir"));
  w.catatRiwayat = () => Promise.resolve();
  w.bacaRiwayat = async () => [];
  return { dom, w, minta, abt };
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

async function sampaiPerkara(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, `[data-pk="${NOMOR}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
/** Membuka jendela Pilih blangko lalu menunggu kelompok Ikrar Talak lengkap (semua kelompok asalnya termuat). */
async function bukaIkrar(h: Halaman, jumlah: number) {
  await sampaiPerkara(h);
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
  await sampai(() => q(h, '[data-kelmodal="ikrar"]'), "kelompok Ikrar Talak");
  klik(h, '[data-kelmodal="ikrar"]');
  await sampai(() => qq(h, "[data-ikrar]").length === jumlah, `${jumlah} butir ikrar`);
}
const butir = (h: Halaman) => qq(h, "[data-ikrar]").map((b) => b.getAttribute("data-bl"));
const namaKelompok = (h: Halaman) => qq(h, "[data-kelmodal]").map((b) => b.querySelector(".kn")!.textContent);

// ============================================================================
describe("A. kelompok maya Ikrar Talak", () => {
  it("hakim: kelompok tepat di bawah menu Cerai Talak - Putusan; isi dari tiga folder asal (penetapan + BAS), tanpa relaas", async () => {
    const h = buka();
    await bukaIkrar(h, 8);
    const kel = namaKelompok(h);
    expect(kel.indexOf("Ikrar Talak")).toBe(kel.indexOf("Cerai Talak - Putusan") + 1);
    // Disarankan (keduanya hadir) lebih dulu; sisanya berurutan BAS lalu penetapan.
    expect(butir(h)).toEqual([B_2, B_2A, P_90A, B_1, B_3, B_4, P_90, P_91]);
    // Butir dari "ALUR 10" yang namanya sama tidak dobel.
    expect(new Set(butir(h)).size).toBe(8);
    // Butir tetap membawa nama kelompok ASLINYA (BAS dari Cerai Talak - BAS, penetapan dari Cerai Talak - Putusan).
    const kelAsal = Object.fromEntries(qq(h, "[data-ikrar]").map((b) => [b.getAttribute("data-bl"), b.getAttribute("data-kel")]));
    expect(kelAsal[B_2]).toBe("Cerai Talak - BAS");
    expect(kelAsal[P_90]).toBe("Cerai Talak - Putusan");
  });

  it("tiap butir ditulis dengan kalimat biasa (jenis dan kehadiran), tanpa kurung siku atau .rtf", async () => {
    const h = buka();
    await bukaIkrar(h, 8);
    const kalimat = qq(h, "[data-ikrar] .nm").map((x) => x.textContent);
    expect(kalimat).toEqual([
      "Berita acara sidang ikrar talak: Pemohon dan Termohon hadir",
      "Berita acara sidang ikrar talak: Pemohon dan Termohon hadir, ada beban yang harus dipenuhi",
      "Penetapan sidang ikrar talak: Pemohon dan Termohon hadir",
      "Berita acara sidang ikrar talak: Pemohon hadir dan Termohon tidak hadir",
      "Berita acara sidang ikrar talak: Pemohon tidak hadir dan Termohon hadir; sidang ditunda, tenggang waktu 6 bulan",
      "Berita acara sidang ikrar talak: Pemohon dan Termohon tidak hadir; sidang ditunda, tenggang waktu 6 bulan",
      "Penetapan sidang ikrar talak: Pemohon hadir dan Termohon tidak hadir",
      "Penetapan putusan gugur: Pemohon tidak mengikrarkan talak dalam 6 bulan",
    ]);
    for (const k of kalimat) expect(k).not.toMatch(/[[\]]|\.rtf/i);
  });

  it("uraian murni: relaas dan amplop ikrar", () => {
    const h = buka();
    const u = h.w.aletaBlangkoDerryIsian.murni.uraikanIkrar;
    expect(u("rel", R_4)).toMatchObject({ jenis: "Relaas", kalimat: "Relaas panggilan sidang ikrar talak kepada Pemohon dan Termohon", kode: "4" });
    expect(u("rel", R_7).kalimat).toBe("Relaas panggilan sidang ikrar talak kepada Termohon (perkara e-Court)");
    expect(u("rel", R_831).kalimat).toBe("Amplop panggilan sidang ikrar talak untuk Pemohon");
    expect(u("rel", R_832).kalimat).toBe("Amplop panggilan sidang ikrar talak untuk Termohon");
    expect(u("rel", R_4).urut).toBeLessThan(u("rel", R_7).urut);
    expect(h.w.aletaBlangkoDerryIsian.murni.adalahBlangkoIkrar("bas", CT_BAS_BIASA)).toBe(false);
    expect(h.w.aletaBlangkoDerryIsian.murni.adalahBlangkoIkrar("put", CT_PUT_BIASA)).toBe(false);
    expect(h.w.aletaBlangkoDerryIsian.murni.adalahBlangkoIkrar("rel", R_BIASA)).toBe(false);
  });
});

describe("B. hak per peran mengikuti hak folder asal", () => {
  it("panitera pengganti: hanya BAS ikrar", async () => {
    const h = buka({ orang: "pp" });
    await bukaIkrar(h, 5);
    expect(butir(h).sort()).toEqual([B_1, B_2, B_2A, B_3, B_4].sort());
    // Kelompok aslinya tidak berubah (tidak dipindah, tidak digandakan): tetap memuat berkas BAS biasa dan keempat BAS ikrar.
    klik(h, '[data-kelmodal="k:Cerai Talak - BAS"]');
    expect(qq(h, "[data-bl]:not([data-ikrar])").map((b) => b.getAttribute("data-bl"))).toEqual([CT_BAS_BIASA, B_1, B_2, B_2A, B_3, B_4]);
  });

  it("juru sita: hanya relaas dan amplop ikrar", async () => {
    const h = buka({ orang: "js" });
    await bukaIkrar(h, 4);
    expect(butir(h).sort()).toEqual([R_4, R_7, R_831, R_832].sort());
  });

  it("Super Admin: semuanya (BAS, penetapan, relaas)", async () => {
    const h = buka({ orang: "admin" });
    await bukaIkrar(h, 12);
    expect(butir(h)).toHaveLength(12);
    expect(butir(h)).toEqual(expect.arrayContaining([B_1, P_91, R_4, R_832]));
  });

  it("aturan murni: jenis ikrar per peran, dan hanya bila butirnya bertanda ikrar", () => {
    const h = buka();
    const m = h.w.aletaBlangkoDerry.murni;
    expect(m.ikrarJenisBoleh({ peran: ["hakim"] })).toEqual(["put", "bas"]);
    expect(m.ikrarJenisBoleh({ peran: ["pp"] })).toEqual(["bas"]);
    expect(m.ikrarJenisBoleh({ peran: ["js"] })).toEqual(["rel"]);
    expect(m.ikrarJenisBoleh({ admin: true, sebagaiPeran: "pp" })).toEqual(["bas"]);
    expect(m.ikrarJenisBoleh({ admin: true })).toEqual(["put", "bas", "rel"]);
    const hakim = { admin: false, peran: ["hakim"], hak: null };
    expect(m.kelompokBoleh({ nama: "Cerai Talak - BAS", jenis: "bas", ikrar: true }, hakim)).toBe(true);
    // BAS biasa tetap bukan untuk hakim (kecuali saklar Pengaturan SIPP & ABT)
    expect(m.kelompokBoleh({ nama: "Cerai Talak - BAS", jenis: "bas" }, hakim)).toBe(false);
    expect(m.kelompokBoleh({ nama: "Relaas", jenis: "rel", ikrar: true }, hakim)).toBe(false);
    expect(m.kelompokBoleh({ nama: "Cerai Talak - Putusan", jenis: "put", ikrar: true }, { admin: false, peran: ["pp"], hak: null })).toBe(false);
  });
});

describe("C. pencarian dan pembukaan", () => {
  it("kata \"ikrar\" menemukan butir ikrar dari tiga folder di bawah kelompok Ikrar Talak; \"penetapan\" hanya yang bertalian", async () => {
    const h = buka({ orang: "admin" });
    await bukaIkrar(h, 12);
    const cari = q(h, "#bd-caribl") as HTMLInputElement;
    cari.value = "ikrar";
    cari.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => qq(h, "[data-ikrar]").length === 12, "pencarian ikrar");
    expect(qq(h, "#bd-modal h5").map((x) => x.textContent)).toContain("Ikrar Talak");
    expect(butir(h)).toEqual(expect.arrayContaining([B_2, P_90, R_4]));
    expect(butir(h)).not.toContain(CT_BAS_BIASA);
    const cari2 = q(h, "#bd-caribl") as HTMLInputElement; // jendela digambar ulang: kotak lama sudah lepas
    cari2.value = "relaas";
    cari2.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => qq(h, "[data-ikrar]").length === 4, "pencarian relaas");
  });

  it("membuka butir memakai token kelompok asalnya (main/cari), bukan token buatan", async () => {
    const h = buka();
    await bukaIkrar(h, 8);
    klik(h, `[data-ikrar][data-bl="${P_90A}"]`);
    // Penetapan [90a] berada di "Cerai Talak - Putusan" (token A1 + indeks 2).
    await sampai(() => mintaKe(h, /main\/cari$/, "POST").length >= 1, "main/cari");
    const b = mintaKe(h, /main\/cari$/, "POST")[0].badan;
    expect(b).toContain("a=A12");
    expect(b).toContain("b=BD12");
  });
});

describe("D. saran menurut kehadiran", () => {
  const lencana = (h: Halaman) => qq(h, "[data-ikrar]").filter((b) => b.querySelector(".bd-lencana")).map((b) => b.getAttribute("data-bl"));

  it("keduanya hadir: BAS [2] dan penetapan [90a] disarankan, [2a] sebagai alternatif; kelompok menyebut ada yang disarankan", async () => {
    const h = buka({ hadir: 1 });
    await bukaIkrar(h, 8);
    await sampai(() => lencana(h).length > 0, "lencana");
    expect(lencana(h).sort()).toEqual([B_2, B_2A, P_90A].sort());
    expect(q(h, '[data-kelmodal="ikrar"] .ks')!.textContent).toContain("disarankan");
  });

  it("Pemohon hadir, Termohon tidak: [1] dan [90]", async () => {
    const h = buka({ hadir: 2 });
    await bukaIkrar(h, 8);
    await sampai(() => lencana(h).length > 0, "lencana");
    expect(lencana(h).sort()).toEqual([B_1, P_90].sort());
  });

  it("Pemohon tidak hadir: BAS [3] / [4] (tunda 6 bulan), tanpa penetapan ikrar", async () => {
    const h3 = buka({ hadir: 3 });
    await bukaIkrar(h3, 8);
    await sampai(() => lencana(h3).length > 0, "lencana 3");
    expect(lencana(h3)).toEqual([B_3]);
    const h4 = buka({ hadir: 4 });
    await bukaIkrar(h4, 8);
    await sampai(() => lencana(h4).length > 0, "lencana 4");
    expect(lencana(h4)).toEqual([B_4]);
  });

  it("sidang menyebut 6 bulan tidak ikrar: penetapan gugur [91]", async () => {
    const h = buka({ hadir: 4, ket: "Pemohon tidak mengikrarkan talak sampai lewat 6 bulan" });
    await bukaIkrar(h, 8);
    await sampai(() => lencana(h).length > 0, "lencana gugur");
    expect(lencana(h)).toEqual(expect.arrayContaining([P_91, B_4]));
  });

  it("cadangan murni sama dengan aturan portal", () => {
    const h = buka();
    const s = h.w.aletaBlangkoDerryIsian.murni.saranIkrarCadangan;
    const nama = (x: Array<{ jenis: string; pola: RegExp }>) => x.map((y) => `${y.jenis}:${y.pola.source}`);
    expect(s(null, "sidang ikrar talak").map((x: { jenis: string }) => x.jenis)).toEqual(["bas", "put"]);
    expect(nama(s(3, ""))).toEqual(["bas:^\\[3\\]\\s*BAS\\s+Ikrar"]);
    expect(s(1, "")).toHaveLength(3);
    expect(s(4, "lewat 6 bulan")[0]).toMatchObject({ jenis: "put", utama: true });
  });

  it("portal: kehadiran -> BAS dan penetapan yang sama dengan cadangan ekstensi", () => {
    const dasar = { jenisPerkara: "Cerai Talak", nomorPerkara: NOMOR, sidangIkrarTalak: true, sudahPutus: true, agenda: "Sidang Ikrar Talak", tanggalSidang: HARI_INI };
    const pakai = (extra: Record<string, unknown>) => rekomendasiBlangko(masukanRekomendasiDariBaris({ ...dasar, ...extra }));
    const berkas = (x: { berkas: string }[]) => x.map((y) => (y.berkas.match(/\[\d+[a-z]?\]/) || [""])[0]);
    // P hadir & T tidak
    let r = pakai({ dihadiriOleh: 2 });
    expect(berkas(r.putusan)[0]).toBe("[90]");
    expect(berkas(r.bas)[0]).toBe("[1]");
    // keduanya hadir
    r = pakai({ dihadiriOleh: 1 });
    expect(berkas(r.putusan)[0]).toBe("[90a]");
    expect(berkas(r.bas)[0]).toBe("[2]");
    // keduanya hadir + beban -> [2a]
    r = pakai({ dihadiriOleh: 1, alasanDitunda: "Ikrar talak, Pemohon telah membayar mut'ah dan nafkah iddah" });
    expect(berkas(r.bas)[0]).toBe("[2a]");
    // Pemohon tidak hadir -> BAS [3] / [4], tidak ada penetapan ikrar
    r = pakai({ dihadiriOleh: 3 });
    expect(berkas(r.bas)[0]).toBe("[3]");
    expect(r.putusan).toEqual([]);
    r = pakai({ dihadiriOleh: 4 });
    expect(berkas(r.bas)[0]).toBe("[4]");
    expect(r.putusan).toEqual([]);
    // lewat 6 bulan sejak penetapan hari sidang ikrar -> [91] utama; tepat pada batas masih sah
    r = pakai({ dihadiriOleh: 4, tanggalPenetapanSidangIkrar: "2026-04-01" });
    expect(berkas(r.putusan)).toEqual(["[91]"]);
    expect(r.putusan[0].utama).toBe(true);
    expect(r.putusan[0].perkiraan).toBe(false);
    r = pakai({ dihadiriOleh: 1, tanggalPenetapanSidangIkrar: "2026-04-15" });
    expect(berkas(r.putusan)[0]).toBe("[90a]");
    r = pakai({ dihadiriOleh: 1, tanggalPenetapanSidangIkrar: "2026-04-01" });
    expect(berkas(r.putusan)).toEqual(["[91]", "[90a]", "[90]"]);
    expect(r.putusan[1].utama).toBe(false);
    // relaas panggilan ikrar bila sidang ikrar ditunda
    r = pakai({ dihadiriOleh: 4, ditunda: true });
    expect(r.relaas.length).toBeGreaterThan(0);
    // mesin BAS: beban hanya bila keduanya hadir
    expect(tentukanAlurBas({ jenisPerkara: "Cerai Talak", urutanSidang: 3, dihadiriOleh: 2, sidangIkrarTalak: true, agenda: "ada beban" }).langkah?.kode).toBe("1");
    expect(tentukanAlurBas({ jenisPerkara: "Cerai Talak", urutanSidang: 3, dihadiriOleh: 1, sidangIkrarTalak: true, agenda: "ada beban" }).langkah?.kode).toBe("2a");
  });
});

describe("E. isi otomatis dari SIPP berlaku untuk blangko ikrar", () => {
  const USULAN = [
    { kode: "0007", nama: "Anak", nilai: "telah dikaruniai 2 orang anak", keyakinan: "cukup", sumber: [] },
    { kode: "1006", nama: "Tempat tinggal", nilai: "di rumah orang tua Pemohon", keyakinan: "cukup", sumber: [] },
  ];
  const pilihIkrar = async (h: Halaman, berkas: string, jumlah: number) => {
    await bukaIkrar(h, jumlah);
    klik(h, `[data-ikrar][data-bl="${berkas}"]`);
    await sampai(() => q(h, "#bd-perlu .bd-f") || q(h, ".bd-ok"), "isian tergambar");
  };

  it("hakim membuka penetapan ikrar: terisi sendiri dan ada tombol Isi dari SIPP", async () => {
    const h = buka({ usulan: USULAN });
    await pilihIkrar(h, P_90A, 8);
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak" && h.abt["1006"] === "di rumah orang tua Pemohon", "penetapan ikrar terisi");
    expect(q(h, '[data-bd2="isisipp"]')).not.toBeNull();
    expect(mintaKe(h, /aleta-bot\/abt\/usulan/, "POST").length).toBeGreaterThan(0);
  });

  it("panitera pengganti membuka BAS ikrar: terisi sendiri", async () => {
    const h = buka({ orang: "pp", usulan: USULAN });
    await pilihIkrar(h, B_2, 5);
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "BAS ikrar terisi");
    expect(q(h, '[data-bd2="isisipp"]')).not.toBeNull();
  });

  it("juru sita membuka relaas ikrar: terisi sendiri", async () => {
    const h = buka({ orang: "js", usulan: [{ kode: "9101", nama: "Alamat", nilai: "Jl. Mawar No. 3, Palu", keyakinan: "pasti", sumber: [] }] });
    await pilihIkrar(h, R_4, 4);
    await sampai(() => h.abt["9101"] === "Jl. Mawar No. 3, Palu", "relaas ikrar terisi");
  });

  it("hakim membuka BAS ikrar (hak folder ikrar): boleh menulis, isi otomatis berjalan; BAS biasa tetap tidak ditawarkan", async () => {
    const h = buka({ usulan: USULAN });
    await pilihIkrar(h, B_2, 8);
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "BAS ikrar oleh hakim terisi");
    // Hakim tetap hanya melihat tab Putusan: BAS biasa tidak ditawarkan, hanya BAS ikrar lewat kelompok Ikrar Talak.
    expect(qq(h, "[data-jenismodal]").map((b) => b.textContent)).toEqual(["Putusan"]);
  });
});
