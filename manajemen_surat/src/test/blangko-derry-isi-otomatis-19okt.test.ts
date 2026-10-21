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
  D("7139", "Beracara secara elektronik", "data_teks"),
  D("0222", "Awal Konflik : bulan _ / tahun _ / awal tahun / akhir tahun / tanggal _", "data_teks", "", "#8493#"),
  D("0246", "Pisah Rumah : bulan _ / tahun _ / awal tahun / akhir tahun / tanggal _", "data_teks", "", "#8494#"),
  D("9944", "lama pisah : _ (_) tahun _ (_) bulan", "data_teks", "", "#8496#"),
  D("5227", "Alasan-Alasan Cerai (#0053# #0046#)", "data_teks", "", "#8499#"),
]);
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1006", "2004", "0364", "0156", "11111", "0033", "7139", "0222", "0246", "9944", "5227"];
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
  /** Keputusan e-litigasi #7139# dari abt.js (el7Ambil7139) - ditiru sebagai fungsi global. */
  el7?: { nilai: string; keterangan: string };
  /** Usulan dari sumber "saksi" bot (0222, 0246, 9944, 5227, ...). */
  usulanSaksi?: Usulan[];
  /** Keterangan saksi per kode penyunting ("2021"/"2022") pada sidang berapa pun: baris tanya-jawab ABT. */
  saksiRows?: Record<string, Array<{ no: string; tanya: string; jawab: string }>>;
  /** Riwayat perubahan panel (bacaRiwayat). */
  riwayat?: Array<Record<string, unknown>>;
  /** konseptor-langkah GET drafH7: perkaraId -> draf (kartu checklist). Kosong = belum ada draf. */
  drafH7?: Record<string, unknown>;
};
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; abt: Record<string, string>; opsi: Opsi; riwayatCatat: Array<Record<string, unknown>> };
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
    if (url.includes("/aleta-ecourt/konseptor-langkah")) return json({ ok: true, data: { ada: true, peta: {}, drafH7: polos(p.drafH7 ?? {}), keadaanTerbaca: true } });
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
      const sumber = (() => {
        try {
          return String(JSON.parse(badan).sumber || "");
        } catch {
          return "";
        }
      })();
      if (sumber === "saksi") return json({ ok: true, data: { available: true, saksi: { usulan: polos(p.usulanSaksi ?? []), huruf: [] } } });
      if (sumber === "itsbat" || sumber === "posita-lain") return json({ ok: true, data: { available: true, itsbat: { ok: false }, positaLain: { ok: false, alasan: "jenis_perkara_tidak_dilayani" } } });
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
    if (url.startsWith(`${ABT}/tanyajawab_perkara_edit?`)) {
      const kodeTj = new URL(url).searchParams.get("no_var") || "";
      const rows = (p.saksiRows?.[kodeTj] ?? []).map((r) => ({ urutan_pertanyaan: r.no, pertanyaan: r.tanya, jawaban: r.jawab }));
      return html(`<div class="panel-heading"><b><big>${NOMOR}</big></b> - TanyaJwb Saksi : <b>Nama Saksi</b></div><select><option value='A1a'>(A1a) Pertanyaan</option></select><script>var ajax_data = ${JSON.stringify(rows)}\n</script>`);
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
  // Pembantu abt.js yang dipanggil Blangko Derry sebagai fungsi global (di sini: sumber aslinya dari abt.js, bukan salinan).
  const riwayatCatat: Array<Record<string, unknown>> = [];
  w.eval(irisanAbt("function teksSaksiMentah(baris)", "/** Banyaknya butir"));
  w.catatRiwayat = (c: Record<string, unknown>) => {
    riwayatCatat.push(polos(c));
    return Promise.resolve();
  };
  w.bacaRiwayat = async () => polos(p.riwayat ?? []);
  if (p.saran) w.aletaBlangkoDerryIsian.pasangRekomendasi(() => p.saran);
  if (p.el7) w.el7Ambil7139 = async () => p.el7;
  return { dom, w, simpanan, minta, abt, opsi: p, riwayatCatat };
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

  it("20 Okt: saklar Pratinjau dokumen sebelum unduh di Alat saya - bawaan menyala, diingat, kunci sama di popup dan latar", async () => {
    const h = buka();
    await sampaiPerkara(h);
    expect(h.w.aletaBlangkoDerry.setelan().pratinjau).toBe(true);
    klik(h, "#bd-alat-btn");
    const kotak = (await sampai(() => q(h, '#bd-alat input[data-cfg="pratinjau"]'), "saklar pratinjau")) as HTMLInputElement;
    expect(kotak.checked).toBe(true);
    expect(q(h, "#bd-alat")!.textContent).toContain("Pratinjau dokumen sebelum unduh");
    kotak.checked = false;
    kotak.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.simpanan.pratinjauBasRelaas === false, "setelan tersimpan");
    expect(h.w.aletaBlangkoDerry.setelan().pratinjau).toBe(false);
    for (const berkas of ["popup.js", "latar.js", "blangko-derry.js", "pratinjau-bas-relaas.js"]) expect(baca(berkas), berkas).toContain("pratinjauBasRelaas");
    expect(baca("popup.html")).toContain('id="pratinjauBasRelaas"');
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
    // Saklar mati: bacaan SIPP hanya dianalisis (lencana, saran, tombol Input), tidak ada yang ditulis sendiri.
    await sampai(() => (q(h, "#bd-i0007") as HTMLInputElement | null)?.placeholder === "telah dikaruniai 2 orang anak", "saran dari SIPP tampil");
    expect(mintaKe(h, /edit_data\?/, "POST")).toEqual([]);
    expect(nilaiKotak(h, "0007")).toBe("");
    // Manual: mengisi yang kosong.
    klik(h, '[data-bd2="isisipp"]');
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "manual mengisi 0007");
    await sampai(() => h.abt["0364"] === "15/01/2020", "manual mengisi tanggal");
    expect(mintaKe(h, /aleta-bot\/abt\/usulan/, "POST")).toHaveLength(2);
    // Yang sudah ada isinya tetap; dijalankan ulang pun tidak menimpa dan tidak menulis ulang yang sama.
    expect(h.abt["1006"]).toBe("di rumah sendiri");
    const jumlah = mintaKe(h, /edit_data\?/, "POST").length;
    await sampai(() => !h.w.aletaBlangkoDerryIsian.keadaan().isiSipp.jalan, "selesai");
    klik(h, '[data-bd2="isisipp"]');
    await sampai(() => mintaKe(h, /aleta-bot\/abt\/usulan/, "POST").length === 3, "bacaan kedua");
    await tunggu(150);
    expect(mintaKe(h, /edit_data\?/, "POST").length).toBe(jumlah);
    expect(h.abt["1006"]).toBe("di rumah sendiri");
  });

  it("REGRESI fitur lama: e-litigasi #7139# tetap terisi sendiri walau saklar mati; saklar hanya mengatur mesin bersama", async () => {
    const h = buka({ simpanan: { blangkoDerryIsiOto: false }, usulan: SIPP_PUTUSAN, el7: { nilai: "1", keterangan: "E-Litigasi: penuh (Tergugat ber-email)" } });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["7139"] === "1", "7139 terisi walau saklar mati");
    await tunggu(150);
    // Mesin bersama tidak menulis: isian lain tetap kosong (hanya saran).
    expect(h.abt["0007"]).toBeUndefined();
    expect(mintaKe(h, /edit_data\?no_var=0007/, "POST")).toEqual([]);
    expect(mintaKe(h, /edit_data\?no_var=7139/, "POST")).toHaveLength(1);
  });

  it("REGRESI fitur lama: kabel bawaan itsbat dan 7139 mendahului gerbang saklar di sumber", () => {
    const sumber = baca("blangko-derry-isian.js");
    const a = sumber.indexOf("async function isiOtomatisBlangko(");
    const blok = sumber.slice(a, sumber.indexOf("\n  }\n", a));
    const iItsbat = blok.indexOf("await simpanBawaanAbtItsbat(d);");
    const i7139 = blok.indexOf("await isiElitigasiOtomatis(d);");
    const iGerbang = blok.indexOf("cfg().isiOto === false");
    expect(iItsbat).toBeGreaterThan(0);
    expect(i7139).toBeGreaterThan(iItsbat);
    expect(iGerbang).toBeGreaterThan(i7139);
  });

  it("19 Okt (isian 2): satu tombol Isi otomatis menggantikan deret Isi dari SIPP / Isi dari gugatan (posita) / Ambil tanggal KTP dari bukti", async () => {
    const h = buka({ usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const alat = qq(h, "#bd-alatisi button").map((b) => b.textContent);
    expect(alat).toContain("Isi otomatis");
    expect(alat).not.toContain("Isi dari SIPP");
    expect(alat).not.toContain("Isi dari gugatan (posita)");
    expect(alat).not.toContain("Ambil tanggal KTP dari bukti");
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
    expect(m.putuskan({ kode: "8537", nilai: "x", keyakinan: "pasti" }, ctx).golongan).toBe("tulis");
    expect(m.putuskan({ kode: "8537", nilai: "x", keyakinan: "cukup" }, ctx).golongan).toBe("tulis");
    expect(m.putuskan({ kode: "8537", nilai: "x", keyakinan: "cukup", bentrok: "y" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "8537", nilai: "x", keyakinan: "ragu" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "8537", nilai: "x", keyakinan: "ocr" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "8537", nilai: "", pilihan: ["a", "b"], keyakinan: "pasti" }, ctx).golongan).toBe("pilihan");
    expect(m.putuskan({ kode: "8503", nilai: "F", keyakinan: "pasti" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "5227", nilai: "x", keyakinan: "pasti" }, ctx).golongan).toBe("saran");
    expect(m.putuskan({ kode: "8537", nilai: "x", keyakinan: "pasti" }, { ...ctx, kosong: false }).golongan).toBe("lewati");
    expect(m.putuskan({ kode: "8537", nilai: "x", keyakinan: "pasti", dihitung: true }, ctx).golongan).toBe("lewati");
    expect(m.putuskan({ kode: "8537", nilai: "ditulis A L E T A", keyakinan: "pasti" }, ctx).golongan).toBe("lewati");
    expect(m.putuskan({ kode: "8537", nilai: "dari Aleta", keyakinan: "pasti" }, ctx).golongan).toBe("lewati");
    expect(m.putuskan({ kode: "8537", nilai: "", keyakinan: "pasti" }, ctx).golongan).toBe("lewati");
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

// ============================================================================
describe("I. mutu deteksi = mesin panel ABT: periode baku, HTML dibuang, bawaan mentah diganti, pilih bunyi 5227", () => {
  const MENTAH =
    "Januari 2023 keadaan rumah tangga Penggugat dan Tergugat tidak harmonis karena sering terjadi perselisihan dan pertengkaran terus menerus sehingga sulit untuk didamaikan lagi oleh keluarga kedua belah pihak, </div><br /><br /><div>a. Tergugat sering marah-marah tanpa sebab yang jelas;</div><div>b. Tergugat tidak memberi nafkah;</div>";
  const SAKSI_USULAN: Usulan[] = [
    { kode: "0222", nama: "Awal Konflik", nilai: "bulan Januari 2023", keyakinan: "cukup", tingkat: "pasti", kesepakatan: "sama", sumber: [{ saksi: 1, kalimat: "Bahwa sejak Januari 2023 sering bertengkar" }] },
    { kode: "0246", nama: "Pisah Rumah", nilai: "Agustus 2023", keyakinan: "cukup", sumber: [{ saksi: 2, kalimat: "Bahwa pisah rumah sejak Agustus 2023" }] },
    { kode: "9944", nama: "Lama Pisah", nilai: "3 tahun 3 bulan", keyakinan: "pasti", sumber: [{ saksi: 1, kalimat: "pisah 3 tahun" }], catatan: "Dihitung dari tanggal pisah rumah sampai sidang." },
    {
      kode: "5227",
      nama: "Alasan-Alasan Cerai",
      nilai: "",
      keyakinan: "ragu",
      pilihan: [
        { keadaan: "templat hakim - sebab saja", nilai: "Bahwa antara Penggugat dan Tergugat terus menerus berselisih" },
        { keadaan: "templat hakim - sebab + akibat (bentuk baku ALETA)", nilai: "Bahwa antara Penggugat dan Tergugat terus menerus berselisih sehingga rumah tangga pecah" },
        { keadaan: "bunyi bermasalah", nilai: "dibuat oleh ALETA" },
      ],
      sumber: [],
    },
  ];
  const ROWS = {
    "2021": [{ no: "1", tanya: "Apa yang saudara tahu?", jawab: "Penggugat dan Tergugat sering bertengkar sejak Januari 2023" }],
    "2022": [{ no: "1", tanya: "Apa yang saudara tahu?", jawab: "Mereka pisah rumah sejak Agustus 2023" }],
  };
  const dasar = { usulan: [], usulanSaksi: SAKSI_USULAN, saksiRows: ROWS, abtAwal: { "5125": "Bahwa pada tahun 2020 <b>Penggugat</b> menikah<br />dengan Tergugat", "0222": MENTAH } };

  it("bawaan mentah (HTML + potongan posita panjang) diganti hasil mesin saksi; periode baku; lama pisah dengan penghitungnya; riwayat mencatat sebelum", async () => {
    const h = buka(dasar);
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["0222"] === "bulan Januari 2023", "0222 diganti hasil mesin");
    await sampai(() => h.abt["0246"] === "bulan Agustus 2023", "0246 berformat periode baku");
    await sampai(() => h.abt["9944"] === "3 tahun 3 bulan", "9944 dari mesin");
    // Muatan ke bot sama dengan panel: keterangan dua saksi, tanggal sidang, posita tanpa tag.
    const bot = mintaKe(h, /aleta-bot\/abt\/usulan/, "POST").map((m) => JSON.parse(m.badan)).find((b) => b.sumber === "saksi");
    expect(bot).toBeTruthy();
    expect(bot.saksi1).toContain("Bahwa penggugat dan Tergugat sering bertengkar");
    expect(bot.saksi2).toContain("Bahwa mereka pisah rumah");
    expect(bot.tanggalSidang).toBe("15 Oktober 2026");
    expect(bot.posita).toBe("Bahwa pada tahun 2020 Penggugat menikah\ndengan Tergugat");
    // Penggantian dicatat agar dapat diurungkan: nilai mentah ada di "sebelum".
    const catatan = h.riwayatCatat.find((c) => c.kode === "0222");
    expect(catatan).toMatchObject({ sebelum: MENTAH, sesudah: "bulan Januari 2023" });
    expect(String(catatan!.cara)).toMatch(/mentah diganti/);
    // Tak satu pun muatan simpan memuat HTML atau kata ALETA.
    for (const m of mintaKe(h, /edit_data\?/, "POST")) {
      expect(m.badan).not.toMatch(/aleta|%3C|<div|<br/i);
    }
  });

  it("bawaan mentah yang pernah disunting petugas (jejak riwayat) tidak diganti; yang pendek dan bersih juga tidak", async () => {
    const h = buka({ ...dasar, riwayat: [{ perkaraId: "10154", kode: "0222", cara: "diketik petugas di panel ALETA", pada: "2026-10-14T01:00:00Z" }] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["0246"] === "bulan Agustus 2023", "isian lain tetap terisi");
    await tunggu(100);
    expect(h.abt["0222"]).toBe(MENTAH);
    expect(mintaKe(h, /edit_data\?no_var=0222/, "POST")).toEqual([]);
    const pendek = buka({ ...dasar, abtAwal: { ...dasar.abtAwal, "0222": "bulan Maret 2022" } });
    await sampaiPerkara(pendek);
    await pilih(pendek, BLANGKO_PUT);
    await sampai(() => pendek.abt["0246"] === "bulan Agustus 2023", "0246 terisi");
    await tunggu(100);
    expect(pendek.abt["0222"]).toBe("bulan Maret 2022");
  });

  it("5227: pilih bunyi dari varian mesin yang sama; label tanpa istilah teknis; wajib dipilih petugas (tidak terisi sendiri); varian ber-ALETA dibuang", async () => {
    const h = buka(dasar);
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const pilihan = (await sampai(() => q(h, 'select[data-bunyi="5227"]'), "pilihan bunyi 5227")) as HTMLSelectElement;
    const opsi = Array.from(pilihan.options).map((o) => o.textContent || "");
    expect(opsi[0]).toBe("— wajib dipilih petugas —");
    expect(opsi).toHaveLength(3);
    expect(opsi[1]).toContain("bunyi hakim - sebab saja");
    expect(opsi[2]).toContain("bunyi hakim - sebab + akibat");
    expect(opsi.join(" ")).not.toMatch(/templat|bentuk baku|ALETA/i);
    // Tidak terisi sendiri.
    expect(pilihan.value).toBe("");
    await tunggu(100);
    expect(h.abt["5227"]).toBeUndefined();
    expect(mintaKe(h, /edit_data\?no_var=5227/, "POST")).toEqual([]);
    // Petugas memilih -> tersimpan lewat jalur simpan yang sama.
    pilihan.value = "1";
    pilihan.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.abt["5227"] === "Bahwa antara Penggugat dan Tergugat terus menerus berselisih sehingga rumah tangga pecah", "bunyi pilihan tersimpan");
    expect(h.abt["5227"]).not.toMatch(/aleta/i);
  });

  it("murni: periode baku tanpa penggandaan, HTML dibuang kecuali variabel ber-HTML (8500), daftar pengecualian = katalog kueri ABT", () => {
    const m = buka().w.AletaIsiSipp;
    const f = (x: string) => m.formatPeriode(x);
    expect(f("Januari 2023")).toBe("bulan Januari 2023");
    expect(f("bulan Januari 2023")).toBe("bulan Januari 2023");
    expect(f("bulan bulan Januari 2023")).toBe("bulan Januari 2023");
    expect(f("bulan Januari tahun 2023")).toBe("bulan Januari 2023");
    expect(f("Pebruari 2023")).toBe("bulan Februari 2023");
    expect(f("2023")).toBe("tahun 2023");
    expect(f("tahun 2023")).toBe("tahun 2023");
    expect(f("tahun tahun 2023")).toBe("tahun 2023");
    expect(f("awal tahun 2023")).toBe("awal tahun 2023");
    expect(f("Januari 2023 keadaan rumah tangga")).toBe("Januari 2023 keadaan rumah tangga");
    // Semua kode periode mengikuti aturan lewat putuskan (awal konflik, pisah rumah).
    for (const kode of ["0222", "0246"]) {
      expect(m.putuskan({ kode, nilai: "Januari 2023", keyakinan: "cukup" }, { kosong: true, jenis: "teks" })).toMatchObject({ golongan: "tulis", nilai: "bulan Januari 2023" });
      expect(m.putuskan({ kode, nilai: "2023", keyakinan: "cukup" }, { kosong: true, jenis: "teks" })).toMatchObject({ nilai: "tahun 2023" });
    }
    // HTML -> teks rapi.
    expect(m.htmlKeTeks("a&nbsp;b<br />c</div><br /><br /><div>d &amp; e</div>")).toBe("a b\nc\nd & e");
    expect(m.bersihkanNilai("0222", "<div>satu</div><div>dua</div>")).toBe("satu\ndua");
    // Variabel yang kuerinya memang menghasilkan HTML (8500: majelis TTD putusan) tidak dibersihkan.
    expect(m.KODE_HTML).toContain("8500");
    expect(m.bersihkanNilai("8500", "<li>Ketua,<br><strong>Hakim</strong>")).toBe("<li>Ketua,<br><strong>Hakim</strong>");
    // Daftar eksplisit = variabel yang kuerinya bertag HTML di katalog ABT.
    const katalog = JSON.parse(readFileSync(path.join(process.cwd(), "src/server/modules/aleta-ecourt/kamus-variabel-awal.json"), "utf8")) as { variabel: Array<Record<string, unknown>> };
    const pola = /<\s*\/?\s*(br|li|ul|ol|div|table|tr|td|th|p|strong|b|u|i|em|span|font|center|h\d)\b/i;
    const dariKatalog = katalog.variabel.filter((x) => ["q", "d", "r", "u"].some((f) => typeof x[f] === "string" && pola.test(x[f] as string))).map((x) => String(x.k)).sort();
    expect(polos(m.KODE_HTML).slice().sort()).toEqual(dariKatalog);
    // Bawaan jelas mentah: bertag, atau panjang pada isian pendek.
    expect(m.jelasMentah("0222", MENTAH)).toBe(true);
    expect(m.jelasMentah("0222", "bulan Januari 2023")).toBe(false);
    expect(m.jelasMentah("5227", "x".repeat(400))).toBe(false);
    expect(m.jelasMentah("8500", "<li>x")).toBe(false);
    // Label bunyi.
    expect(m.labelBunyi("templat hakim - sebab + akibat (bentuk baku ALETA)")).toBe("bunyi hakim - sebab + akibat");
  });
});

// ============================================================================
describe("J. kelengkapan kartu usulan di tiap isian (lencana, sumber, bintang, riwayat, sekarang vs usulan, Input ke ABT)", () => {
  const SAKSI: Usulan[] = [
    { kode: "0222", nama: "Awal Konflik", nilai: "bulan Januari 2023", keyakinan: "cukup", tingkat: "pasti", kesepakatan: "sama", sumber: [{ saksi: 1, kalimat: "Bahwa sejak Januari 2023 sering bertengkar" }, { saksi: 2, kalimat: "Bahwa mulai bulan Januari 2023 tidak rukun" }] },
    { kode: "0246", nama: "Pisah Rumah", nilai: "bulan Agustus 2023", keyakinan: "cukup", sumber: [{ asal: "posita", kalimat: "Bahwa sejak Agustus 2023 berpisah rumah" }], catatan: "Kedua saksi tidak menyebut kapan perselisihan mulai" },
    { kode: "9944", nama: "Lama Pisah", nilai: "3 tahun 3 bulan", keyakinan: "pasti", sumber: [], catatan: "Dihitung dari tanggal pisah rumah sampai sidang." },
  ];
  const label = (h: Halaman, kode: string) => qq(h, `.bd-f[data-f="${kode}"] .bd-ket .bd-tanda`).map((x) => x.textContent);

  it("lencana keyakinan dan asal sesuai usulan, juga pada isian yang sudah terisi otomatis; catatan dan lencana kesepakatan ikut", async () => {
    const h = buka({ usulan: SIPP_PUTUSAN, usulanSaksi: SAKSI, saksiRows: { "2021": [{ no: "1", tanya: "t", jawab: "Jawaban satu" }], "2022": [{ no: "1", tanya: "t", jawab: "Jawaban dua" }] }, abtAwal: { "5125": "Bahwa Penggugat dan Tergugat menikah" } });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["0222"] === "bulan Januari 2023" && h.abt["0007"], "terisi otomatis");
    // 0222: pasti (tingkat ukur), dari keterangan saksi, kedua saksi sama.
    expect(label(h, "0222")).toEqual(["yakin: pasti", "dari keterangan saksi", "kedua saksi sama"]);
    // 0246: dari posita saja -> kuning, belum dikuatkan saksi; catatan tampil dengan (i).
    expect(label(h, "0246")).toEqual(["yakin: cukup", "dari posita — belum dikuatkan saksi"]);
    // 20 Okt: catatan tidak lagi tampil sebagai teks di kartu; ia ada di title ikon ⓘ (keterangan-info-20okt.test.ts menjaga selebihnya).
    expect(q(h, '.bd-f[data-f="0246"] .bd-ketcatatan')).toBeNull();
    expect(q(h, '.bd-f[data-f="0246"] .bd-sumber')!.getAttribute("title")).toContain("Kedua saksi tidak menyebut kapan perselisihan mulai");
    expect(q(h, '.bd-f[data-f="9944"] .bd-sumber')!.getAttribute("title")).toContain("Dihitung dari tanggal pisah rumah");
    // Isian dari SIPP yang terisi otomatis tetap berlencana; yang ragu berlencana abu-abu "periksa".
    expect(label(h, "0007")).toEqual(["yakin: cukup", "dari SIPP"]);
    expect(label(h, "2004")).toEqual(["yakin: ragu — periksa", "dari SIPP"]);
    expect(q(h, '.bd-f[data-f="2004"] .bd-tanda.abu')).not.toBeNull();
    expect(q(h, '.bd-f[data-f="0222"] .bd-tanda.hijau')).not.toBeNull();
    expect(q(h, '.bd-f[data-f="0246"] .bd-tanda.kuning')).not.toBeNull();
  });

  it("sumber (N) dapat dibuka dan ditutup; bintang menyematkan dengan kunci yang sama dengan panel", async () => {
    const h = buka({ usulan: [], usulanSaksi: SAKSI, saksiRows: { "2021": [{ no: "1", tanya: "t", jawab: "Jawaban satu" }] }, abtAwal: { "5125": "Bahwa menikah" } });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => label(h, "0222").length > 0, "lencana 0222");
    const tombolSumber = q(h, '.bd-f[data-f="0222"] [data-bd2="ketsumber"]')!;
    expect(tombolSumber.textContent).toBe("sumber (2) ▸");
    expect(q(h, '.bd-f[data-f="0222"] .bd-sumberlist')).toBeNull();
    tombolSumber.click();
    const daftar = q(h, '.bd-f[data-f="0222"] .bd-sumberlist')!;
    expect(daftar.textContent).toContain("Saksi 1");
    expect(daftar.textContent).toContain("Bahwa sejak Januari 2023 sering bertengkar");
    expect(daftar.textContent).toContain("Saksi 2");
    expect(q(h, '.bd-f[data-f="0222"] [data-bd2="ketsumber"]')!.textContent).toBe("sumber (2) ▾");
    q(h, '.bd-f[data-f="0222"] [data-bd2="ketsumber"]')!.click();
    expect(q(h, '.bd-f[data-f="0222"] .bd-sumberlist')).toBeNull();
    // Bintang.
    const bintang = q(h, '.bd-f[data-f="0222"] [data-bd2="ketsemat"]')!;
    expect(bintang.textContent).toBe("☆");
    bintang.click();
    await sampai(() => Array.isArray(h.simpanan.abtVariabelSematan) && (h.simpanan.abtVariabelSematan as string[]).includes("0222"), "tersemat tersimpan");
    expect(q(h, '.bd-f[data-f="0222"] [data-bd2="ketsemat"]')!.textContent).toBe("★");
  });

  it("riwayat per isian dengan kembalikan ↺; penggantian otomatis dapat diurungkan", async () => {
    const MENTAH_PANJANG = `Januari 2023 ${"keadaan rumah tangga tidak harmonis ".repeat(8)}<br /><div>a. Tergugat</div>`;
    const riwayat = [{ perkaraId: "10154", kode: "0222", sebelum: MENTAH_PANJANG, sesudah: "bulan Januari 2023", cara: "bawaan kueri ABT yang mentah diganti otomatis", pada: "2026-10-19T01:02:00Z" }];
    const h = buka({ usulan: [], usulanSaksi: SAKSI, saksiRows: { "2021": [{ no: "1", tanya: "t", jawab: "Jawaban satu" }] }, abtAwal: { "5125": "Bahwa menikah", "0222": "bulan Maret 2022" }, riwayat });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => label(h, "0222").length > 0, "lencana");
    q(h, '.bd-f[data-f="0222"] [data-bd2="ketriwayat"]')!.click();
    const baris = await sampai(() => q(h, '.bd-f[data-f="0222"] .bd-ketriw-baris'), "riwayat termuat");
    expect(baris.textContent).toContain("bulan Januari 2023");
    q(h, '.bd-f[data-f="0222"] [data-bd2="ketpulih"]')!.click();
    await sampai(() => h.abt["0222"] === MENTAH_PANJANG.replace(/\s+/g, " "), "isi sebelumnya dikembalikan").catch(() => undefined);
    await sampai(() => mintaKe(h, /edit_data\?no_var=0222/, "POST").length > 0, "pengembalian ditulis lewat jalur simpan");
    expect(h.riwayatCatat.some((c) => c.kode === "0222" && /dikembalikan dari riwayat/.test(String(c.cara)))).toBe(true);
  });

  it("sekarang vs usulan bila berbeda (isian tidak ditimpa), dan Pakai usulan menuliskannya", async () => {
    const h = buka({ usulan: SIPP_PUTUSAN, abtAwal: { "0007": "memiliki 1 orang anak" } });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const sanding = await sampai(() => q(h, '.bd-f[data-f="0007"] .bd-sanding'), "perbandingan");
    expect(sanding.textContent).toContain("sekarang");
    expect(sanding.textContent).toContain("memiliki 1 orang anak");
    expect(sanding.textContent).toContain("usulan");
    expect(sanding.textContent).toContain("telah dikaruniai 2 orang anak");
    expect(h.abt["0007"]).toBe("memiliki 1 orang anak");
    q(h, '.bd-f[data-f="0007"] [data-bd2="ketpakai"]')!.click();
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "usulan dipakai");
    await sampai(() => !q(h, '.bd-f[data-f="0007"] .bd-sanding'), "perbandingan hilang");
  });

  it("Input ke ABT (N) dan Input semua yang pasti (N) hanya menulis yang kosong; yang pasti saja untuk tombol kedua; saklar mati tidak menulis sendiri", async () => {
    const usulan: Usulan[] = [
      { kode: "0007", nama: "Anak", nilai: "telah dikaruniai 2 orang anak", keyakinan: "cukup", sumber: [] },
      { kode: "1006", nama: "Tempat", nilai: "di rumah bersama", keyakinan: "pasti", sumber: [] },
      { kode: "0364", nama: "Tgl KTP", nilai: "15 Januari 2020", keyakinan: "pasti", sumber: [] },
      { kode: "2004", nama: "Pekerjaan", nilai: "petani", keyakinan: "ragu", sumber: [] },
      { kode: "8503", nama: "Huruf", nilai: "F", keyakinan: "pasti", sumber: [] },
    ];
    const h = buka({ simpanan: { blangkoDerryIsiOto: false }, usulan, abtAwal: { "1006": "di rumah sendiri" } });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => q(h, '[data-bd2="inputyakin"]'), "tombol Input ke ABT");
    await tunggu(100);
    expect(mintaKe(h, /edit_data\?/, "POST")).toEqual([]);
    // 0007 cukup + 0364 pasti = 2 (1006 sudah ada isinya; 2004 ragu; 8503 keputusan hakim).
    expect(q(h, '[data-bd2="inputyakin"]')!.textContent).toBe("Input ke ABT (2)");
    expect(q(h, '[data-bd2="inputpasti"]')!.textContent).toBe("Input semua yang pasti (1)");
    klik(h, '[data-bd2="inputpasti"]');
    await sampai(() => h.abt["0364"] === "15/01/2020", "yang pasti ditulis");
    await tunggu(100);
    expect(h.abt["0007"]).toBeUndefined();
    expect(h.abt["2004"]).toBeUndefined();
    expect(h.abt["8503"]).toBeUndefined();
    expect(h.abt["1006"]).toBe("di rumah sendiri");
    // Sisanya: Input ke ABT (1) -> 0007.
    await sampai(() => q(h, '[data-bd2="inputyakin"]')?.textContent === "Input ke ABT (1)", "tinggal satu");
    expect(q(h, '[data-bd2="inputpasti"]')).toBeNull();
    klik(h, '[data-bd2="inputyakin"]');
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "yang cukup ditulis");
    expect(h.abt["2004"]).toBeUndefined();
    for (const m of mintaKe(h, /edit_data\?/, "POST")) expect(m.badan).not.toMatch(/aleta/i);
  });
});

// ============================================================================
describe("L. tautan Draf H-7: draf, varian dan isian yang ditunjuk", () => {
  const tautan = (o: Record<string, unknown>) => `#bd=${encodeURIComponent(JSON.stringify({ v: 1, nomor: NOMOR, perkaraId: "10154", sidangKe: 2, tanggalSidang: HARI_INI, jenis: "putusan", agenda: "Pemeriksaan pokok perkara", tunda: false, keterangan: "putus DIKABULKAN (verstek)", amar: "", verstek: true, jumlahSaksiP: 0, jumlahSaksiT: 0, ...o }))}`;
  const blangkoDraf = (berkas: string) => ({ folder: "1 Perceraian CG", berkas, menu: "Putusan CG", alias: [], label: berkas });
  const DRAF = {
    ringkas: { tingkat: "hampir", persen: 80 },
    blangko: blangkoDraf(BLANGKO_PUT),
    alasanBlangko: "",
    saran: { "0007": { nilai: "telah dikaruniai dua orang anak (draf dikabulkan)", golongan: "usulan", sumber: "" } },
    perlu: [],
    laporan: [],
    varian: [{ status: "ditolak", judul: "Varian ditolak", blangko: blangkoDraf(BLANGKO_PUT_3), alasanBlangko: "", saran: { "0007": { nilai: "telah dikaruniai satu orang anak (draf ditolak)", golongan: "usulan", sumber: "" } }, tingkat: "belum", persen: 40, jumlahPerlu: 3 }],
  };
  const MENU_DUA = [BLANGKO_PUT, BLANGKO_PUT_3];
  const terpilih = (h: Halaman) => isian(h).keadaan().blangko?.berkas as string | undefined;
  const alat = (h: Halaman) => {
    const gulir: string[] = [];
    const fokus: string[] = [];
    h.w.Element.prototype.scrollIntoView = function (this: Element) {
      gulir.push(this.getAttribute("data-f") || this.id);
    };
    h.w.HTMLElement.prototype.focus = function (this: HTMLElement) {
      fokus.push(this.id);
    };
    return { gulir, fokus };
  };
  const saran0007 = (h: Halaman) => (q(h, "#bd-i0007") as HTMLInputElement | HTMLTextAreaElement | null)?.getAttribute("placeholder");

  it("pembaca hash murni: draf, varian dan isian dibaca; nilai tak sah dibuang; tautan lama tidak membawa ruas baru", () => {
    const h = buka();
    const baca = h.w.aletaBlangkoDerry.murni.bacaTautanBd as (x: string) => Record<string, unknown> | null;
    expect(polos(baca(tautan({ draf: "h7", varian: "ditolak", isian: "  Anak   dari Pernikahan ini " })))).toMatchObject({ draf: "h7", varian: "ditolak", isian: "Anak dari Pernikahan ini", jenis: "putusan" });
    expect(polos(baca(tautan({ draf: "h7", varian: "dikabulkan" })))).toMatchObject({ draf: "h7", varian: "dikabulkan" });
    const tak = polos(baca(tautan({ draf: "h8", varian: "lain", isian: 5 }))) as Record<string, unknown>;
    expect(tak).not.toBeNull();
    for (const r of ["draf", "varian", "isian"]) expect(tak, r).not.toHaveProperty(r);
    expect(String((polos(baca(tautan({ isian: "x".repeat(300) }))) as Record<string, unknown>).isian)).toHaveLength(120);
    const lama = polos(baca(tautan({}))) as Record<string, unknown>;
    for (const r of ["draf", "varian", "isian"]) expect(lama, r).not.toHaveProperty(r);
    expect(baca(tautan({ v: 2, draf: "h7" }))).toBeNull();
  });

  it("draf h7 tanpa varian: draf perkara dibaca dari portal, blangko draf terbuka, isian agen hanya SARAN (tidak ada tulisan ke ABT)", async () => {
    const h = buka({ hash: tautan({ draf: "h7" }), drafH7: { "10154": DRAF }, menuPut: MENU_DUA, usulan: [] });
    await sampai(() => terpilih(h) === BLANGKO_PUT, "blangko draf terpilih");
    await sampai(() => saran0007(h) === "telah dikaruniai dua orang anak (draf dikabulkan)", "saran agen terpasang");
    expect(mintaKe(h, /konseptor-langkah\?perkaraId=10154/).length).toBe(1);
    expect(nilaiKotak(h, "0007")).toBe("");
    expect(mintaKe(h, /edit_data\?/, "POST")).toEqual([]);
    expect(h.w.location.hash).toBe("");
  });

  it("varian ditolak: blangko dan saran varian itu yang dipakai", async () => {
    const h = buka({ hash: tautan({ draf: "h7", varian: "ditolak" }), drafH7: { "10154": DRAF }, menuPut: MENU_DUA, usulan: [] });
    await sampai(() => terpilih(h) === BLANGKO_PUT_3, "blangko varian ditolak terpilih");
    await sampai(() => saran0007(h) === "telah dikaruniai satu orang anak (draf ditolak)", "saran varian terpasang");
  });

  it("varian ditolak yang tidak ada di draf: draf utama dipakai (bukan galat)", async () => {
    const h = buka({ hash: tautan({ draf: "h7", varian: "ditolak" }), drafH7: { "10154": { ...DRAF, varian: [] } }, menuPut: MENU_DUA, usulan: [] });
    await sampai(() => terpilih(h) === BLANGKO_PUT, "blangko draf utama terpilih");
    await sampai(() => saran0007(h) === "telah dikaruniai dua orang anak (draf dikabulkan)", "saran utama terpasang");
  });

  it("isian yang sudah ada isinya di ABT tidak ditimpa saran draf", async () => {
    const h = buka({ hash: tautan({ draf: "h7" }), drafH7: { "10154": DRAF }, menuPut: MENU_DUA, usulan: [], abtAwal: { "0007": "isi petugas" } });
    await sampai(() => terpilih(h) === BLANGKO_PUT, "blangko draf terpilih");
    await sampai(() => q(h, "#bd-i0007"), "kartu tergambar");
    await tunggu(150);
    expect(nilaiKotak(h, "0007")).toBe("isi petugas");
    expect(h.abt["0007"]).toBe("isi petugas");
    expect(mintaKe(h, /edit_data\?/, "POST")).toEqual([]);
  });

  it("isian yang ditunjuk: digulir, kotaknya difokus, disorot lalu sorotan hilang sendiri (cocok longgar huruf besar/spasi)", async () => {
    const h = buka({ hash: tautan({ draf: "h7", isian: "  ANAK dari   Pernikahan ini " }), drafH7: { "10154": DRAF }, menuPut: MENU_DUA, usulan: [] });
    const a = alat(h);
    await sampai(() => q(h, '#bd-perlu .bd-f[data-f="0007"].bd-sorot'), "kartu tersorot");
    expect(a.gulir).toContain("0007");
    expect(a.fokus).toContain("bd-i0007");
    // Hanya satu kartu yang tersorot.
    expect(qq(h, ".bd-sorot").length).toBe(1);
    await sampai(() => !q(h, ".bd-sorot"), "sorotan hilang", 4000);
    // Isian masih utuh, tidak ada pesan teknis.
    expect(q(h, '#bd-perlu .bd-f[data-f="0007"]')).not.toBeNull();
  });

  it("nama isian yang tidak ketemu: diam (tanpa sorotan, tanpa pesan)", async () => {
    const h = buka({ hash: tautan({ draf: "h7", isian: "Isian yang tidak pernah ada" }), drafH7: { "10154": DRAF }, menuPut: MENU_DUA, usulan: [] });
    const a = alat(h);
    await sampai(() => saran0007(h) === "telah dikaruniai dua orang anak (draf dikabulkan)", "saran terpasang");
    await tunggu(200);
    expect(qq(h, ".bd-sorot")).toEqual([]);
    expect(a.gulir).toEqual([]);
    expect(q(h, "#bd-toast")?.textContent || "").not.toMatch(/isian yang tidak pernah ada|galat|error|undefined/i);
  });

  it("belum ada draf untuk perkara itu: jalur biasa (blangko putusan dari saran sidang), isian tetap disorot", async () => {
    const SARAN = [{ berkas: BLANGKO_PUT, kelompok: "Putusan CG", jenis: "put", alasan: "dari keadaan perkara" }];
    const h = buka({ hash: tautan({ draf: "h7", isian: "anak dari pernikahan" }), drafH7: {}, saran: SARAN, menuPut: MENU_DUA, usulan: [] });
    alat(h);
    await sampai(() => terpilih(h) === BLANGKO_PUT, "blangko putusan dari saran");
    await sampai(() => q(h, '#bd-perlu .bd-f[data-f="0007"].bd-sorot'), "kartu tersorot");
  });
});
