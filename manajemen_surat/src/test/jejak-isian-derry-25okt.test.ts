// @vitest-environment node
/**
 * 25 OKT 2026 - RANTAI C, C1: JEJAK ISIAN, BACA-ULANG, DAN URUNGKAN DI BLANGKO DERRY (U2 + U6).
 * Harness disalin dari blangko-derry-isi-otomatis-19okt.test.ts (blangko-derry*.js dijalankan SUNGGUHAN di jsdom,
 * portal, bot, dan ABT ditiru di fetch).
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
const SUMBER = ["panel-alat.js", "abt-klien.js", "jejak-isian.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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
  jejak?: Jejak;
  /** Kode yang bacaan ulangnya dari ABT berbeda (tersimpan, tetapi dibaca kembali berubah). */
  bacaUlangBeda?: string[];
  /** Bawaan popup ABT (dihitung ABT) untuk variabel yang belum tersimpan: kode -> teks. */
  bawaanPopup?: Record<string, string>;
};
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; abt: Record<string, string>; opsi: Opsi; riwayatCatat: Array<Record<string, unknown>>; jejak: Jejak };
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
  const jejak: Jejak = p.jejak ?? jejakBaru(false);
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
    const dariJejak = jawabJejak(jejak, url, cara, badan);
    if (dariJejak) return dariJejak;
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
      if (p.bacaUlangBeda?.includes(kode) && abt[kode]) return html(POPUP(kode, tipe, `${abt[kode]} [terpotong]`));
      if (p.bawaanPopup?.[kode] && !abt[kode]) return html(POPUP(kode, tipe, p.bawaanPopup[kode]));
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
  w.bacaRiwayat = async (id: string) => {
    const J = w.AletaJejakIsian;
    const server = J ? (await J.jejakPerkara(id)).map((b: any) => J.keRiwayat(b)) : [];
    return [...polos(p.riwayat ?? []), ...server];
  };
  if (p.saran) w.aletaBlangkoDerryIsian.pasangRekomendasi(() => p.saran);
  if (p.el7) w.el7Ambil7139 = async () => p.el7;
  return { dom, w, simpanan, minta, abt, opsi: p, riwayatCatat, jejak };
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
// Portal jejak tiruan
// ============================================================================
type Jejak = { aktif: boolean; tanya: number; isian: Array<Record<string, any>>; butir: Array<Record<string, any>>; daftarPerkara: Array<Record<string, any>> };
function jejakBaru(aktif: boolean): Jejak {
  return { aktif, tanya: 0, isian: [], butir: [], daftarPerkara: [] };
}
function jawabJejak(j: Jejak, url: string, cara: string, badan: string) {
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  if (!/\/aleta-ecourt\/(jejak-isian|saksi-butir)/.test(url)) return undefined;
  if (/jejak-isian\?bagian=saklar/.test(url)) {
    j.tanya += 1;
    return json({ ok: true, data: { aktif: j.aktif } });
  }
  if (/jejak-isian\?perkaraId=/.test(url)) return json({ ok: true, data: { aktif: j.aktif, ada: j.daftarPerkara.length > 0, daftar: j.aktif ? j.daftarPerkara : [] } });
  if (cara === "POST") {
    const isi = JSON.parse(badan || "{}");
    (/saksi-butir/.test(url) ? j.butir : j.isian).push(...(isi.daftar || []));
    return json({ ok: true, data: { aktif: j.aktif, dicatat: (isi.daftar || []).length } });
  }
  return json({ ok: false }, 404);
}
const tombol = (h: Halaman, el: Element, key: string) => el.dispatchEvent(new h.w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
/** Bawaan popup ABT (kueri #8493# dihitung ABT) untuk 0222: menjadi saran samar "bawaan-abt". */
const BAWAAN_AWAL = "bulan Maret 2023";
const POPUP_AWAL = { "0222": BAWAAN_AWAL };
/** Usulan SIPP yang ragu: tidak ditulis sendiri, menjadi saran samar "isi-sipp". */
const USULAN_RAGU: Usulan[] = [{ kode: "2004", nama: "Pekerjaan", nilai: "petani", keyakinan: "ragu", sumber: [] }];
/** Usulan SIPP yang cukup: kartu isian mendapat baris keterangan (riwayat, sumber); yang sudah ada isinya di ABT tidak ditimpa. */
const USULAN_CUKUP: Usulan[] = [{ kode: "0007", nama: "Anak", nilai: "telah dikaruniai 2 orang anak", keyakinan: "cukup", sumber: [] }];
const suntingKotak = async (h: Halaman, kode: string, nilai: string) => {
  const i = await sampai(() => q(h, `#bd-i${kode}`) as HTMLInputElement | null, `kotak ${kode}`);
  ketik(h, i, nilai);
};
const postJejak = (h: Halaman) => h.minta.filter((m) => m.cara === "POST" && /\/jejak-isian$/.test(m.url));
const bacaSesudahTulis = (h: Halaman, kode: string) => {
  const idxPost = h.minta.findIndex((m) => new RegExp(`edit_data\\?no_var=${kode}`).test(m.url) && m.cara === "POST");
  return h.minta.slice(idxPost + 1).filter((m) => new RegExp(`edit_data\\?no_var=${kode}`).test(m.url) && m.cara === "GET");
};

// ============================================================================
describe("C1 - jejak isian di Blangko Derry: saklar MATI = perilaku lama persis", () => {
  it("saran diterima dengan Tab: ABT ditulis seperti dulu (tipe dibaca, tanpa baca-ulang), tidak ada permintaan jejak selain menanyakan saklar", async () => {
    const h = buka({ jejak: jejakBaru(false), bawaanPopup: POPUP_AWAL });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const i = await sampai(() => {
      const k = q(h, "#bd-i0222") as HTMLInputElement;
      return k && k.placeholder === BAWAAN_AWAL ? k : null;
    }, "saran 0222");
    tombol(h, i, "Tab");
    await sampai(() => h.abt["0222"] === BAWAAN_AWAL, "0222 tersimpan di ABT");
    await sampai(() => (q(h, '[data-status="0222"]')!.textContent || "").includes("tersimpan"), "status tersimpan");
    expect(bacaSesudahTulis(h, "0222")).toEqual([]); // verifikasi mati: tidak ada GET sesudah POST
    expect(postJejak(h)).toEqual([]);
    expect(h.minta.filter((m) => /saksi-butir|jejak-isian\?perkaraId/.test(m.url))).toEqual([]);
    expect(h.jejak.isian).toEqual([]);
  });

  it("bacaan ulang yang berbeda TIDAK ditandai merah selama saklar mati", async () => {
    const h = buka({ jejak: jejakBaru(false), bacaUlangBeda: ["2004"] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await suntingKotak(h, "2004", "petani");
    await sampai(() => h.abt["2004"] === "petani", "tersimpan");
    await sampai(() => (q(h, '[data-status="2004"]')!.textContent || "").includes("tersimpan"), "status tersimpan");
    expect(q(h, '[data-status="2004"]')!.textContent).not.toContain("bacaan ulang");
    expect(h.jejak.isian).toEqual([]);
  });

  it("isi otomatis dari SIPP juga tidak mencatat apa pun", async () => {
    const h = buka({ jejak: jejakBaru(false), usulan: SIPP_PUTUSAN });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "0007 diisi otomatis");
    await tunggu(60);
    expect(h.jejak.isian).toEqual([]);
    expect(postJejak(h)).toEqual([]);
  });
});

describe("C1 - jejak isian di Blangko Derry: saklar MENYALA", () => {
  it("saran bawaan ABT diterima (Tab): dibaca ulang dari ABT dan dicatat 'saran-diterima' beserta pengisinya", async () => {
    const h = buka({ jejak: jejakBaru(true), bawaanPopup: POPUP_AWAL });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const i = await sampai(() => {
      const k = q(h, "#bd-i0222") as HTMLInputElement;
      return k && k.placeholder === BAWAAN_AWAL ? k : null;
    }, "saran 0222");
    tombol(h, i, "Tab");
    await sampai(() => h.abt["0222"] === BAWAAN_AWAL, "0222 tersimpan di ABT");
    await sampai(() => h.jejak.isian.length === 1, "jejak terkirim");
    expect(bacaSesudahTulis(h, "0222")).toHaveLength(1); // baca-ulang dari ABT
    expect(h.jejak.isian[0]).toMatchObject({
      perkaraId: "10154",
      nomorPerkara: NOMOR,
      blangko: BLANGKO_PUT,
      jenisBlangko: "put",
      jenisPerkara: "Cerai Gugat",
      kode: "0222",
      nilaiUsulan: BAWAAN_AWAL,
      asalUsulan: "bawaan-abt",
      nilaiFinal: BAWAAN_AWAL,
      cara: "saran-diterima",
      terverifikasi: "ya",
      jalur: "blangko-derry",
    });
    await sampai(() => (q(h, '[data-status="0222"]')!.textContent || "").includes("tersimpan"), "status tersimpan");
    expect(JSON.stringify(h.jejak.isian)).not.toMatch(/aleta/i);
  });

  it("saran SIPP yang ragu diterima: pengisinya 'isi-sipp' dengan keyakinan ragu", async () => {
    const h = buka({ jejak: jejakBaru(true), usulan: USULAN_RAGU });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const i = await sampai(() => {
      const k = q(h, "#bd-i2004") as HTMLInputElement;
      return k && k.placeholder === "petani" ? k : null;
    }, "saran 2004");
    tombol(h, i, "Tab");
    await sampai(() => h.jejak.isian.length === 1, "jejak terkirim");
    expect(h.jejak.isian[0]).toMatchObject({ kode: "2004", cara: "saran-diterima", asalUsulan: "isi-sipp", keyakinan: "ragu", nilaiUsulan: "petani", nilaiFinal: "petani" });
  });

  it("contoh umum per isian ('belum dikaruniai anak') BUKAN usulan mesin: diterima dengan Tab tercatat 'diketik'", async () => {
    const h = buka({ jejak: jejakBaru(true) });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const i = await sampai(() => {
      const k = q(h, "#bd-i0007") as HTMLInputElement;
      return k && k.placeholder === "belum dikaruniai anak" ? k : null;
    }, "contoh umum 0007");
    tombol(h, i, "Tab");
    await sampai(() => h.jejak.isian.length === 1, "jejak terkirim");
    expect(h.jejak.isian[0]).toMatchObject({ kode: "0007", cara: "diketik", nilaiUsulan: "", asalUsulan: "" });
  });

  it("saran diubah petugas: cara 'diubah' dengan usulan tetap tercatat; menyimpan ulang nilai yang sama tidak dicatat dua kali", async () => {
    const h = buka({ jejak: jejakBaru(true), bawaanPopup: POPUP_AWAL });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => (q(h, "#bd-i0222") as HTMLInputElement)?.placeholder === BAWAAN_AWAL, "saran 0222");
    await suntingKotak(h, "0222", "bulan Juni tahun 2022");
    await sampai(() => h.jejak.isian.length === 1, "jejak terkirim");
    expect(h.jejak.isian[0]).toMatchObject({ kode: "0222", cara: "diubah", nilaiUsulan: BAWAAN_AWAL, asalUsulan: "bawaan-abt", nilaiFinal: "bulan Juni tahun 2022" });
    await suntingKotak(h, "0222", "bulan Juni tahun 2022");
    await tunggu(80);
    expect(h.jejak.isian).toHaveLength(1);
  });

  it("diketik tanpa usulan: nilai SEBELUM yang utuh tercatat (dasar Urungkan lintas PC); 8503 dicatat sebagai bentuk yang ditulis (huruf saja)", async () => {
    const h = buka({ jejak: jejakBaru(true), abtAwal: { "8503": "F" } });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await suntingKotak(h, "8503", "C · pencegahan");
    await sampai(() => h.jejak.isian.length === 1, "jejak terkirim");
    expect(h.abt["8503"]).toBe("C");
    expect(h.jejak.isian[0]).toMatchObject({ kode: "8503", cara: "diketik", nilaiSebelum: "F", nilaiFinal: "C", nilaiUsulan: "", terverifikasi: "ya" });
  });

  it("bacaan ulang dari ABT berbeda: status MERAH, layar mengikuti isi ABT yang sebenarnya, jejak 'beda' beserta nilai terbaca", async () => {
    const h = buka({ jejak: jejakBaru(true), bacaUlangBeda: ["2004"] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await suntingKotak(h, "2004", "petani");
    await sampai(() => h.jejak.isian.length === 1, "jejak terkirim");
    await sampai(() => (q(h, '[data-status="2004"]')!.textContent || "").includes("bacaan ulang"), "status merah");
    expect(q(h, '[data-status="2004"]')!.textContent).toContain("gagal");
    expect(h.jejak.isian[0]).toMatchObject({ kode: "2004", terverifikasi: "beda", nilaiFinal: "petani", nilaiTerbaca: "petani [terpotong]" });
  });

  it("isi otomatis dari SIPP dicatat 'otomatis'; sesudah itu petugas mengubahnya -> 'diubah-otomatis' dengan usulan = nilai yang ALETA tulis", async () => {
    const h = buka({ jejak: jejakBaru(true), usulan: SIPP_PUTUSAN });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak", "0007 diisi otomatis");
    await sampai(() => h.jejak.isian.some((e) => e.kode === "0007"), "jejak otomatis terkirim");
    const oto = h.jejak.isian.find((e) => e.kode === "0007")!;
    expect(oto).toMatchObject({ cara: "otomatis", nilaiUsulan: "telah dikaruniai 2 orang anak", nilaiFinal: "telah dikaruniai 2 orang anak", keyakinan: "cukup" });
    expect(oto.asalUsulan.length).toBeGreaterThan(0);
    await suntingKotak(h, "0007", "telah dikaruniai 3 orang anak");
    await sampai(() => h.jejak.isian.some((e) => e.kode === "0007" && e.cara !== "otomatis"), "suntingan terkirim");
    const ubah = h.jejak.isian.filter((e) => e.kode === "0007").pop()!;
    expect(ubah).toMatchObject({ cara: "diubah-otomatis", nilaiUsulan: "telah dikaruniai 2 orang anak", nilaiFinal: "telah dikaruniai 3 orang anak", nilaiSebelum: "telah dikaruniai 2 orang anak", asalUsulan: oto.asalUsulan });
    // yang sudah ada isinya di ABT tidak ditimpa dan tidak dicatat sebagai tulisan otomatis
    const h2 = buka({ jejak: jejakBaru(true), abtAwal: { "1006": "di rumah sendiri" }, usulan: SIPP_PUTUSAN });
    await sampaiPerkara(h2);
    await pilih(h2, BLANGKO_PUT);
    await sampai(() => h2.abt["0007"] === "telah dikaruniai 2 orang anak", "0007 diisi otomatis");
    await tunggu(80);
    expect(h2.abt["1006"]).toBe("di rumah sendiri");
    expect(h2.jejak.isian.some((e) => e.kode === "1006")).toBe(false);
  });
});

describe("C1 - Urungkan dari server di Blangko Derry", () => {
  const SERVER = (tambah: Record<string, unknown> = {}) => ({
    id: "jejak-9",
    perkaraId: "10154",
    nomorPerkara: NOMOR,
    kode: "0007",
    nama: "Telah Dikarunai Anak",
    nilaiSebelum: "belum dikaruniai anak (nilai lama, utuh)",
    nilaiFinal: "sudah dikaruniai dua orang anak",
    cara: "diubah",
    pada: "2026-10-25T03:00:00.000Z",
    sebelumDipotong: false,
    bisaDiurungkan: true,
    olehNama: "PP Dua",
    ...tambah,
  });

  it("catatan lengkap dari PC lain: butuh dua kali tekan; menulis nilai sebelum UTUH ke ABT; pengembalian dicatat lewat riwayat dengan urungkanDari (tanpa jejak ganda)", async () => {
    const jejak = jejakBaru(true);
    jejak.daftarPerkara = [SERVER()];
    const h = buka({ jejak, abtAwal: { "0007": "sudah dikaruniai dua orang anak" }, usulan: USULAN_CUKUP });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => q(h, '[data-bd2="ketriwayat"][data-ket="0007"]'), "tombol riwayat");
    klik(h, '[data-bd2="ketriwayat"][data-ket="0007"]');
    const pulih = await sampai(() => q(h, '[data-bd2="ketpulih"][data-ket="0007"]'), "tombol kembalikan");
    expect(q(h, ".bd-ketriw")!.textContent).toContain("dicatat di server oleh PP Dua");
    expect(pulih.textContent).toBe("kembalikan ↺");
    pulih.click();
    await tunggu(60);
    expect(h.abt["0007"]).toBe("sudah dikaruniai dua orang anak"); // tekan pertama = konfirmasi, belum menulis
    expect(mintaKe(h, /edit_data\?no_var=0007/, "POST")).toEqual([]);
    expect(q(h, "#bd-toast")!.textContent).toContain("sekali lagi");
    const lagi = await sampai(() => q(h, '[data-bd2="ketpulih"][data-ket="0007"]'), "tombol kembalikan lagi");
    expect(lagi.textContent).toBe("yakin? kembalikan ↺");
    lagi.click();
    await sampai(() => h.abt["0007"] === "belum dikaruniai anak (nilai lama, utuh)", "nilai lama ditulis utuh ke ABT");
    await sampai(() => h.riwayatCatat.some((c) => c.cara === "dikembalikan dari riwayat di Blangko Derry"), "pengembalian dicatat");
    const catat = h.riwayatCatat.filter((c) => c.cara === "dikembalikan dari riwayat di Blangko Derry");
    expect(catat).toHaveLength(1);
    expect(catat[0]).toMatchObject({ kode: "0007", urungkanDari: "jejak-9", sesudah: "belum dikaruniai anak (nilai lama, utuh)", sebelum: "sudah dikaruniai dua orang anak" });
    // simpanIsian tidak mencatat jejaknya sendiri untuk pengembalian: satu baris saja, lewat riwayat
    await tunggu(60);
    expect(h.jejak.isian).toEqual([]);
  });

  it("catatan terpotong atau yang sudah dikembalikan tidak ditawari tombol kembalikan", async () => {
    const jejak = jejakBaru(true);
    jejak.daftarPerkara = [SERVER({ id: "j-potong", sebelumDipotong: true, bisaDiurungkan: false }), SERVER({ id: "j-sudah", bisaDiurungkan: false, pada: "2026-10-25T03:05:00.000Z" })];
    const h = buka({ jejak, abtAwal: { "0007": "sudah dikaruniai dua orang anak" }, usulan: USULAN_CUKUP });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => q(h, '[data-bd2="ketriwayat"][data-ket="0007"]'), "tombol riwayat");
    klik(h, '[data-bd2="ketriwayat"][data-ket="0007"]');
    await sampai(() => q(h, ".bd-ketriw .bd-ketriw-baris"), "baris riwayat");
    expect(q(h, '[data-bd2="ketpulih"][data-ket="0007"]')).toBeNull();
  });

  it("catatan terpotong dari riwayat peramban (dariPeladen + dipotong) juga tidak boleh ditawari kembalikan - akan menimpa isian dengan potongan", async () => {
    const h = buka({
      jejak: jejakBaru(false),
      abtAwal: { "0007": "sekarang" },
      usulan: USULAN_CUKUP,
      riwayat: [{ perkaraId: "10154", kode: "0007", nama: "Anak", sebelum: "potongan", sesudah: "sekarang", cara: "sunting tangan", pada: "2026-10-25T03:00:00.000Z", dariPeladen: true, dipotong: true }],
    });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => q(h, '[data-bd2="ketriwayat"][data-ket="0007"]'), "tombol riwayat");
    klik(h, '[data-bd2="ketriwayat"][data-ket="0007"]');
    await sampai(() => q(h, ".bd-ketriw .bd-ketriw-baris"), "baris riwayat");
    expect(q(h, '[data-bd2="ketpulih"][data-ket="0007"]')).toBeNull();
  });

  it("saklar mati: catatan server tidak diminta dan daftar riwayat hanya dari peramban seperti dulu", async () => {
    const jejak = jejakBaru(false);
    jejak.daftarPerkara = [SERVER()];
    const h = buka({ jejak, abtAwal: { "0007": "sudah dikaruniai dua orang anak" }, usulan: USULAN_CUKUP });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => q(h, '[data-bd2="ketriwayat"][data-ket="0007"]'), "tombol riwayat");
    klik(h, '[data-bd2="ketriwayat"][data-ket="0007"]');
    await sampai(() => (q(h, ".bd-ketriw")?.textContent || "").includes("Belum ada perubahan"), "kosong");
    expect(h.minta.filter((m) => /jejak-isian\?perkaraId/.test(m.url))).toEqual([]);
  });
});
