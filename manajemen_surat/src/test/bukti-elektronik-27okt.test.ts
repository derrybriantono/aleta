// @vitest-environment node
/**
 * ============================================================================
 * 27 OKT 2026 - BLANGKO DERRY: ALAT BUKTI ELEKTRONIK di ruas alat bukti surat (1214 Penggugat / 9911 Tergugat dst.)
 * ============================================================================
 *
 * Skrip ekstensi dijalankan sungguhan di jsdom (portal, bot, ABT ditiru di fetch). Yang dijaga:
 *   1  perangkaian kalimat tiga varian pemeriksaan (bunyi contoh pengguna apa adanya; "bunyi dirapikan" terpisah);
 *   2  penomoran butir dan nomor tanda melanjutkan jumlah bukti surat, awalan dapat dipilih;
 *   3  tanpa butir terisi, teks ruas PERSIS teks bukti surat lama (fitur lama tidak berubah);
 *   4  panel: bagian tersembunyi bawaan (hanya tautan), dibuka lewat tautan, hasil ikut ke ABT dan diingat per perkara;
 *   5  teks ABT berisi butir elektronik dibuka kembali tanpa kehilangan butir dan tanpa merusak bukti surat.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = process.env.EKSTENSI_DIR || path.join(AKAR, "ekstensi-sipp"); // EKSTENSI_DIR: hanya untuk tangkapan "sebelum" (salinan versi lama)
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const irisanAbt = (mulai: string, selesai: string) => {
  const sumberAbt = baca("abt.js");
  const a = sumberAbt.indexOf(mulai);
  if (a < 0) throw new Error(`tidak ditemukan di abt.js: ${mulai}`);
  return sumberAbt.slice(a, sumberAbt.indexOf(selesai, a));
};
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-saksi.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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
  D("5197", "Tgl Nikah", "data_teks"),
  D("5178", "KUA Kec.", "data_teks", "", "#10103#"),
  D("1268", "Pernah/tidak di damaikan keluarga P dan T", "data_teks", "", "#8498#"),
  D("7035", "Meninggalkan Kediaman Bersama Cerai", "data_teks", "", "#8495#"),
  D("5125", "Posita lengkap", "data_sipp"),
  D("1214", "Alat-alat bukti CG/CT", "data_teks", "", "Fotokopi KTP-el atas nama #4048#"),
  D("2021", "Keterangan Saksi 1 P", "tanya_jawab"),
  D("5058", "TanyaJwb Saksi 1 P", "tanya_jawab"),
  D("2022", "Keterangan Saksi 2 P", "tanya_jawab"),
  D("5059", "TanyaJwb Saksi 2 P", "tanya_jawab"),
]);
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1006", "2004", "0364", "0156", "11111", "0033", "7139", "0222", "0246", "9944", "5227", "5197", "5178", "1268", "7035", "5125", "1214", "2021", "2022"];
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
  el7?: { nilai: string; keterangan: string } | null;
  /** Kontak perkara (kontak-pihak) untuk saran beracara elektronik - el7AmbilKontak ditiru. */
  el7Kontak?: Record<string, unknown>;
  /** Nilai bawaan kueri ABT (dihitung, belum tersimpan) per kode - dibaca jendela sembul edit_data. */
  bawaan?: Record<string, string>;
  /** Jawaban mintaPositaRapi (abt.js) - ditiru sebagai fungsi global yang mencatat panggilannya di window.__rapi. */
  positaRapi?: Record<string, unknown>;
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
      return html(POPUP(kode, tipe, abt[kode] || (p.bawaan && p.bawaan[kode]) || ""));
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
  if (p.el7 !== undefined || p.el7Kontak) w.el7Ambil7139 = async () => p.el7 ?? null;
  if (p.el7Kontak) w.el7AmbilKontak = async () => polos(p.el7Kontak);
  w.__rapi = [];
  if (p.positaRapi) {
    w.mintaPositaRapi = async (id: string, uji: boolean) => {
      w.__rapi.push([String(id), uji === true]);
      return polos(p.positaRapi);
    };
  }
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

// ============================================================================
// Bahan
// ============================================================================
const CONTOH_PENGGUNA =
  "Print Out/Hasil Cetak Foto Transaksi Mobile Banking Mandiri dengan keterangan angsuran, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, bukti elektronik tersebut tidak dapat dicocokkan dengan aslinya dengan telekomunikasi atau alat yang yang digunakan untuk melakukan pengambikan cetak foto tersebut karena Penggugat tidak dapat menghadirkannya, dan bukti tersebut tidak disertai dengan digital forensic, lalu oleh Ketua Majelis diberi tanda TK.4;";
type Butir = Record<string, unknown>;
type Murni = {
  susunKalimatBukti: (rows: unknown[], pihak: string) => string;
  susunTeksBukti: (rows: unknown[], pihak: string, el: unknown, sb: { P: string; T: string }) => string;
  kalimatBuktiEl: (b: Butir, ctx: { urut: number; tanda: number; sb: { P: string; T: string }; nomori: boolean }) => string;
  pisahBuktiElektronik: (t: string) => { surat: string; el: string[] };
  butirElDariTeks: (baris: string[], pihak: string) => { butir: Butir[]; nomori: boolean };
  uraiBukti: (t: string) => unknown[];
};
const murni = (h: Halaman) => h.w.aletaBlangkoDerryIsian.murni as Murni;
const SB = { P: "Penggugat", T: "Tergugat" };
const BUTIR: Butir = { bentuk: "Print Out/Hasil Cetak Foto", objek: "Transaksi Mobile Banking Mandiri", ket: "angsuran", pengaju: "P", awalan: "TK", no: "", meterai: 0, periksa: 0, rapi: false, manual: null };
const SURAT_P = (n: number) => Array.from({ length: n }, (_, i) => ({ nm: `Fotokopi Surat ${i + 1}`, an: "", no: "", tgl: "", oleh: "", meterai: 3, cocok: 4, manual: null }));
const BAWAAN_1214 =
  "Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama YULFIANI, NIK 7271036411920011 tanggal 23 April 2025, yang dikeluarkan oleh Pemerintah Kabupaten Sigi, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;\n" +
  "Fotokopi Kutipan Akta Nikah, Nomor 0114/04/IV/2021 tanggal 05 April 2021, yang dikeluarkan oleh KUA Palu Selatan, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2 serta diberi tanggal dan paraf oleh Ketua Majelis;";
const ubah = (h: Halaman, el: HTMLInputElement | HTMLSelectElement, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  el.dispatchEvent(new h.w.Event("change", { bubbles: true }));
};
const kotakEl = (h: Halaman, isi: string, i = 0) => qq(h, ".bd-bukti-el")[i].querySelector(`[data-isi="${isi}"]`) as HTMLInputElement & HTMLSelectElement;
const bukaPut = async (p: Opsi = {}) => {
  const h = buka({ usulan: [], ...p });
  await sampaiPerkara(h);
  await pilih(h, BLANGKO_PUT);
  await sampai(() => qq(h, ".bd-bnama").length >= 2, "dua baris bukti surat");
  return h;
};

// ============================================================================
describe("1. perangkaian kalimat tiga varian", () => {
  it("varian (a) tanpa nomor urut persis bunyi contoh pengguna (termasuk 'yang yang' dan 'pengambikan')", () => {
    const h = buka();
    const k = murni(h).kalimatBuktiEl(BUTIR, { urut: 1, tanda: 4, sb: SB, nomori: false });
    expect(k).toBe(CONTOH_PENGGUNA);
    expect(k).toContain("yang yang");
    expect(k).toContain("pengambikan");
    expect(murni(h).kalimatBuktiEl(BUTIR, { urut: 1, tanda: 4, sb: SB, nomori: true })).toBe(`1. ${CONTOH_PENGGUNA}`);
  });

  it("varian (a) 'bunyi dirapikan' memperbaiki salah ketik dan hanya itu", () => {
    const h = buka();
    const k = murni(h).kalimatBuktiEl({ ...BUTIR, rapi: true }, { urut: 1, tanda: 4, sb: SB, nomori: false });
    expect(k).not.toContain("yang yang");
    expect(k).not.toContain("pengambikan");
    expect(k).toBe(CONTOH_PENGGUNA.replace("yang yang", "yang").replace("pengambikan", "pengambilan"));
  });

  it("varian (b) dicocokkan dengan aslinya dan (c) disertai hasil digital forensic; meterai dapat dipilih; sebutan pihak dinamis", () => {
    const h = buka();
    const m = murni(h);
    const b = m.kalimatBuktiEl({ ...BUTIR, periksa: 1 }, { urut: 4, tanda: 4, sb: SB, nomori: true });
    expect(b).toBe(
      "4. Print Out/Hasil Cetak Foto Transaksi Mobile Banking Mandiri dengan keterangan angsuran, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, bukti elektronik tersebut telah dicocokkan dengan aslinya dengan telekomunikasi atau alat yang digunakan untuk melakukan pengambilan cetak foto tersebut dan ternyata sesuai, lalu oleh Ketua Majelis diberi tanda TK.4;",
    );
    const c = m.kalimatBuktiEl({ ...BUTIR, periksa: 2, meterai: 3, bentuk: "Rekaman suara dalam flashdisk", objek: "percakapan telepon", ket: "", awalan: "P" }, { urut: 3, tanda: 3, sb: SB, nomori: true });
    expect(c).toBe("3. Rekaman suara dalam flashdisk percakapan telepon, bukti elektronik tersebut disertai dengan hasil digital forensic, lalu oleh Ketua Majelis diberi tanda P.3;");
    // permohonan: Termohon sebagai pengaju
    const t = m.kalimatBuktiEl({ ...BUTIR, pengaju: "T", awalan: "T" }, { urut: 1, tanda: 1, sb: { P: "Pemohon", T: "Termohon" }, nomori: false });
    expect(t).toContain("karena Termohon tidak dapat menghadirkannya");
    expect(t.endsWith("diberi tanda T.1;")).toBe(true);
    expect(m.kalimatBuktiEl({ ...BUTIR, meterai: 2 }, { urut: 1, tanda: 1, sb: SB, nomori: false })).toContain("angsuran, bukti surat tersebut tidak bermeterai dan tidak di-nazegelen, bukti elektronik");
    expect(m.kalimatBuktiEl({ ...BUTIR, meterai: 3, ket: "" }, { urut: 1, tanda: 1, sb: SB, nomori: false })).toContain("Mandiri, bukti elektronik tersebut");
  });

  it("nomor tanda dapat diubah; kalimat bebas (manual) dipakai apa adanya dan diberi nomor urut", () => {
    const h = buka();
    const m = murni(h);
    expect(m.kalimatBuktiEl({ ...BUTIR, no: "9" }, { urut: 1, tanda: 4, sb: SB, nomori: false })).toContain("diberi tanda TK.9;");
    expect(m.kalimatBuktiEl({ ...BUTIR, manual: "2. Surel dari pihak, bukti elektronik tersebut dicocokkan" }, { urut: 6, tanda: 6, sb: SB, nomori: true })).toBe("6. Surel dari pihak, bukti elektronik tersebut dicocokkan;");
  });
});

// ============================================================================
describe("2. penomoran lanjutan dan teks ruas", () => {
  it("nomor butir dan tanda melanjutkan jumlah bukti surat; butir kosong tidak ditulis dan tidak memakan nomor", () => {
    const h = buka();
    const m = murni(h);
    const el = { nomori: true, butir: [{ ...BUTIR, awalan: "P" }, { ...BUTIR, objek: "", ket: "" }, { ...BUTIR, awalan: "P", objek: "percakapan WhatsApp", ket: "pengakuan" }] };
    const baris = m.susunTeksBukti(SURAT_P(3), "P", el, SB).split("\n");
    expect(baris).toHaveLength(5);
    expect(baris[3].startsWith("4. Print Out/Hasil Cetak Foto Transaksi Mobile Banking Mandiri")).toBe(true);
    expect(baris[3].endsWith("diberi tanda P.4;")).toBe(true);
    expect(baris[4].startsWith("5. Print Out/Hasil Cetak Foto percakapan WhatsApp dengan keterangan pengakuan")).toBe(true);
    expect(baris[4].endsWith("diberi tanda P.5;")).toBe(true);
    expect(m.susunTeksBukti(SURAT_P(3), "P", { ...el, nomori: false }, SB).split("\n")[3].startsWith("Print Out")).toBe(true);
  });

  it("tanpa butir terisi, teks PERSIS teks bukti surat lama (fitur lama tidak berubah)", () => {
    const h = buka();
    const m = murni(h);
    const lama = m.susunKalimatBukti(SURAT_P(2), "P");
    expect(m.susunTeksBukti(SURAT_P(2), "P", undefined, SB)).toBe(lama);
    expect(m.susunTeksBukti(SURAT_P(2), "P", null, SB)).toBe(lama);
    expect(m.susunTeksBukti(SURAT_P(2), "P", { nomori: true, butir: [] }, SB)).toBe(lama);
    expect(m.susunTeksBukti(SURAT_P(2), "P", { nomori: true, butir: [{ ...BUTIR, objek: "", ket: "" }] }, SB)).toBe(lama);
    expect(m.susunTeksBukti(SURAT_P(2), "T", { nomori: true, butir: [] }, SB)).toBe(m.susunKalimatBukti(SURAT_P(2), "T"));
  });

  it("teks ruas dipisah kembali: bukti surat utuh, butir elektronik terbaca sebagai kalimat bebas dan disusun ulang persis sama", () => {
    const h = buka();
    const m = murni(h);
    const teks = m.susunTeksBukti(SURAT_P(2), "P", { nomori: true, butir: [BUTIR] }, SB);
    const pisah = m.pisahBuktiElektronik(teks);
    expect(pisah.surat).toBe(m.susunKalimatBukti(SURAT_P(2), "P"));
    expect(pisah.el).toHaveLength(1);
    const kembali = m.butirElDariTeks(pisah.el, "P");
    expect(kembali.nomori).toBe(true);
    expect(kembali.butir[0].manual).toBe(CONTOH_PENGGUNA.replace("TK.4;", "TK.3;")); // 2 bukti surat -> butir pertama bernomor 3
    expect(m.susunTeksBukti(SURAT_P(2), "P", kembali, SB)).toBe(teks);
  });
});

// ============================================================================
describe("4. panel: tersembunyi bawaan, dibuka lewat tautan, diingat per perkara", () => {
  it("bawaan hanya tautan '+ Alat bukti elektronik'; teks ABT bukti surat tidak berubah", async () => {
    const h = await bukaPut({ abtAwal: { "1214": BAWAAN_1214 } });
    const tautan = q(h, '[data-belbuka="P"]')!;
    expect(tautan).not.toBeNull();
    expect(tautan.textContent).toContain("+ Alat bukti elektronik");
    expect(tautan.getAttribute("aria-expanded")).toBe("false");
    expect(qq(h, ".bd-bukti-el")).toHaveLength(0);
    expect(q(h, "[data-beltambah]")).toBeNull();
    await tunggu(700);
    expect(h.abt["1214"]).toBe(BAWAAN_1214);
  });

  it("dibuka lewat tautan: butir kosong tidak ditulis; diisi -> ikut ruas alat bukti surat bernomor lanjutan; diingat per perkara", async () => {
    const h = await bukaPut({ abtAwal: { "1214": BAWAAN_1214 } });
    klik(h, '[data-belbuka="P"]');
    await sampai(() => qq(h, ".bd-bukti-el").length === 1, "butir pertama");
    await tunggu(700);
    expect(h.abt["1214"]).toBe(BAWAAN_1214);
    expect(q(h, '[data-belbuka="P"]')!.getAttribute("aria-expanded")).toBe("true");
    expect(kotakEl(h, "bentuk").value).toBe("Print Out/Hasil Cetak Foto");
    expect(kotakEl(h, "awalan").value).toBe("P");
    ubah(h, kotakEl(h, "objek"), "Transaksi Mobile Banking Mandiri");
    ubah(h, kotakEl(h, "ket"), "angsuran");
    ubah(h, kotakEl(h, "awalan"), "TK");
    await sampai(() => /bukti elektronik tersebut/.test(h.abt["1214"] || ""), "butir ditulis ke ABT");
    const baris = h.abt["1214"].split("\n");
    expect(baris).toHaveLength(3);
    // bukti surat ditulis ulang panel seperti biasa (mis. "05 April" -> "5 April"); butir elektronik tidak mengubahnya
    expect(baris.slice(0, 2).join("\n")).toBe(murni(h).susunKalimatBukti(murni(h).uraiBukti(BAWAAN_1214), "P"));
    expect(baris[2]).toBe(`3. ${CONTOH_PENGGUNA.replace("TK.4;", "TK.3;")}`);
    expect(q(h, ".bd-belprat")!.textContent).toBe(baris[2]);
    expect(q(h, "[data-beltanda]")!.textContent).toBe("TK.3");
    ubah(h, kotakEl(h, "periksa"), "2");
    await sampai(() => /disertai dengan hasil digital forensic/.test(h.abt["1214"]), "varian (c) tersimpan");
    ubah(h, kotakEl(h, "periksa"), "1");
    await sampai(() => /dan ternyata sesuai, lalu oleh Ketua Majelis/.test(h.abt["1214"]), "varian (b) tersimpan");
    const simp = h.simpanan["bdBukti:10154:P"] as { el: { butir: Butir[]; nomori: boolean } };
    expect(simp.el.butir[0]).toMatchObject({ objek: "Transaksi Mobile Banking Mandiri", ket: "angsuran", awalan: "TK", periksa: 1 });
    // buka kembali: bagian terlipat dengan jumlah butir, teks ABT tidak berubah, butir kembali saat dibuka
    const nilaiAkhir = h.abt["1214"];
    const h2 = await bukaPut({ simpanan: h.simpanan, abtAwal: { ...h.abt } });
    const tombol = q(h2, '[data-belbuka="P"]')!;
    expect(tombol.textContent).toContain("Alat bukti elektronik (1 butir)");
    expect(tombol.getAttribute("aria-expanded")).toBe("false");
    expect(qq(h2, ".bd-bukti-el")).toHaveLength(0);
    await tunggu(700);
    expect(h2.abt["1214"]).toBe(nilaiAkhir);
    klik(h2, '[data-belbuka="P"]');
    await sampai(() => qq(h2, ".bd-bukti-el").length === 1, "butir terbuka");
    expect(kotakEl(h2, "objek").value).toBe("Transaksi Mobile Banking Mandiri");
    expect(kotakEl(h2, "periksa").value).toBe("1");
  });

  it("menambah bukti surat menggeser nomor lanjutan; menghapus butir mengembalikan teks bukti surat", async () => {
    const h = await bukaPut({ abtAwal: { "1214": BAWAAN_1214 } });
    klik(h, '[data-belbuka="P"]');
    await sampai(() => qq(h, ".bd-bukti-el").length === 1, "butir");
    ubah(h, kotakEl(h, "objek"), "percakapan WhatsApp");
    await sampai(() => /bukti elektronik tersebut/.test(h.abt["1214"] || ""), "ditulis");
    klik(h, '[data-bktambah="P"][data-nama="Surat Keterangan Domisili"]');
    await sampai(() => h.abt["1214"].includes("Surat Keterangan Domisili"), "bukti surat ditambah");
    const baris = h.abt["1214"].split("\n");
    expect(baris).toHaveLength(4);
    expect(baris[3].startsWith("4. Print Out/Hasil Cetak Foto percakapan WhatsApp")).toBe(true);
    expect(baris[3].endsWith("diberi tanda P.4;")).toBe(true);
    klik(h, "[data-belhapus]");
    await sampai(() => !/bukti elektronik/.test(h.abt["1214"]), "butir dihapus");
    expect(h.abt["1214"].split("\n")).toHaveLength(3);
  });

  it("teks ABT berisi butir elektronik (tanpa simpanan peramban) dibuka tanpa kehilangan butir dan tanpa merusak bukti surat", async () => {
    const teks = `${BAWAAN_1214}\n3. ${CONTOH_PENGGUNA.replace("TK.4;", "TK.3;")}`;
    const h = await bukaPut({ abtAwal: { "1214": teks } });
    expect(qq(h, ".bd-bnama")).toHaveLength(2);
    expect(q(h, '[data-belbuka="P"]')!.textContent).toContain("(1 butir)");
    await tunggu(700);
    expect(h.abt["1214"]).toBe(teks);
    klik(h, '[data-belbuka="P"]');
    await sampai(() => qq(h, ".bd-bukti-el").length === 1, "butir terbaca");
    expect((qq(h, ".bd-bukti-el textarea")[0] as HTMLTextAreaElement).value).toBe(CONTOH_PENGGUNA.replace("TK.4;", "TK.3;"));
  });
});

describe("5. tampilan: warna ikut tema lewat variabel", () => {
  it("gaya bagian alat bukti elektronik hanya memakai variabel tema (tanpa warna mati)", () => {
    const css = baca("blangko-derry.css");
    const blok = css.slice(css.indexOf("alat bukti elektronik (27 Okt)"));
    expect(blok).toContain(".bd-belprat");
    expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(blok).not.toMatch(/\brgba?\(/);
  });
});
