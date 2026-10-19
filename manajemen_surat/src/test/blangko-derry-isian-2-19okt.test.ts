// @vitest-environment node
/**
 * ============================================================================
 * 19 OKT 2026 - BLANGKO DERRY: ISIAN 2 (tanggal nikah, satu tombol Isi otomatis, kartu lebar, bentuk nilai, upaya damai,
 * beracara elektronik, penomoran bukti, perapian otomatis putusan)
 * ============================================================================
 *
 * Skrip ekstensi dijalankan sungguhan di jsdom (blangko-derry.js + blangko-derry-saksi.js + blangko-derry-isian.js + isi-sipp-bersama.js)
 * dengan portal, bot dan ABT ditiru di fetch; bot (abtUsulanService.js) dijalankan sungguhan dengan db.query ditiru. Yang dijaga:
 *   1  mesin bersama: nilai harus sesuai MAKNA isian (periode, lama, pihak, tanggal nikah, KUA, upaya damai, anak);
 *   2  bot: tanggal nikah dari posita / data pernikahan SIPP, KUA dari posita (saran), upaya damai dari posita;
 *   3  panel: Tgl Nikah terisi dari tiga sumber (SIPP, posita gugatan, saran dari bukti P);
 *   4  satu tombol "Isi otomatis" menggantikan deret tombol;
 *   5  awal perselisihan bukan kalimat ghaib/pisah;
 *   6  upaya damai dan beracara secara elektronik terdeteksi;
 *   7  penomoran awal alat bukti dibuang;
 *   8  tata letak: rincian alasan cerai selebar penuh, lencana satu baris pembungkus;
 *   9  putusan merapikan posita dan keterangan saksi sendiri.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { bersihkanNilaiUsulan, rapikanBentuk as rapikanBentukTs, sahBentuk as sahBentukTs } from "@/lib/isi-sipp-format";
import { masukanRekomendasiDariBaris, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

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
// Bahan khusus isian 2
// ============================================================================
const GHAIB = "saat itu Tergugat telah pergi meninggalkan Penggugat hingga sekarang (GHOIB) sesuai surat keterangan nomor 12/2026";
const POTONGAN_KUA = "Kecamatan Sindue Tobata, Kabupaten Donggala, sebagaimana sesuai dengan Kutipan Akta Nikah Nomor: 161/02/VII/2011, tertanggal 04 Juli 2011";
const BUNYI_GAGAL = "pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil";
const BAWAAN_1214_NOMOR =
  "1. Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama YULFIANI, NIK 7271036411920011 tanggal 23 April 2025, yang dikeluarkan oleh Pemerintah Kabupaten Sigi, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;\n" +
  "2. Fotokopi Kutipan Akta Nikah, Nomor 0114/04/IV/2021 tanggal 05 April 2021, yang dikeluarkan oleh KUA Palu Selatan, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2 serta diberi tanggal dan paraf oleh Ketua Majelis;";
const U5197 = (nilai: string, asal: string, yakin = "pasti"): Usulan => ({ kode: "5197", nama: "Tgl Nikah", nilai, keyakinan: yakin, sumber: [{ asal, keterangan: "sumber uji", kalimat: "sumber uji" }] });
const lencanaTeks = (h: Halaman, kode: string) => qq(h, `.bd-f[data-f="${kode}"] .bd-tanda`).map((e) => e.textContent || "");
const tunggu2 = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
describe("1. mesin bersama: bentuk nilai mengikuti MAKNA isian", () => {
  const m = () => buka().w.AletaIsiSipp as Record<string, (...a: any[]) => any>;

  it("periode hanya 'bulan X YYYY' / 'tahun YYYY' / awal-akhir tahun / awal pernikahan; kalimat ghaib dan pisah ditolak", () => {
    const e = m();
    for (const ok of ["Juni 2020", "bulan Juni 2020", "tahun 2023", "awal tahun 2023", "akhir tahun 2022", "awal pernikahan", "awal bulan Agustus 2025"]) expect(e.sahBentuk("0222", ok, "Awal perselisihan"), ok).toBe(true);
    expect(e.rapikanBentuk("0222", "awal bulan Agustus 2025")).toBe("bulan Agustus 2025");
    expect(e.rapikanBentuk("0246", "Juni 2020")).toBe("bulan Juni 2020");
    for (const salah of [GHAIB, "saat itu hak dan kewajiban suami isteri tidak terlaksana", "Tergugat pergi meninggalkan Penggugat", "2 tahun", ""]) expect(e.sahBentuk("0222", salah, "Awal perselisihan"), salah).toBe(false);
    // nama isian lain di blangko lain (kode berbeda) tetap dijaga lewat namanya
    expect(e.sahBentuk("9999", GHAIB, "Pisah rumah sejak")).toBe(false);
    expect(e.sahBentuk("9999", "bulan Mei 2021", "Pisah rumah sejak")).toBe(true);
  });

  it("lama pisah, yang meninggalkan rumah, tanggal nikah, KUA, upaya damai dan anak punya bentuk sendiri", () => {
    const e = m();
    expect(e.sahBentuk("9944", "1 tahun 4 bulan")).toBe(true);
    expect(e.sahBentuk("9944", "2 (dua) tahun 3 (tiga) bulan")).toBe(true);
    expect(e.sahBentuk("9944", "kurang lebih 8 bulan")).toBe(true);
    expect(e.sahBentuk("9944", "sejak Tergugat pergi")).toBe(false);
    expect(e.sahBentuk("7035", "Tergugat")).toBe(true);
    expect(e.sahBentuk("7035", "telah")).toBe(false);
    expect(e.sahBentuk("7035", "Penggugat/Tergugat")).toBe(false);
    expect(e.sahBentuk("5197", "04 Juli 2011")).toBe(true);
    expect(e.sahBentuk("5197", "pada tanggal 04 Juli 2011, Penggugat dan Tergugat telah melangsungkan pernikahan")).toBe(false);
    expect(e.sahBentuk("5178", "Kecamatan Sindue Tobata, Kabupaten Donggala")).toBe(true);
    expect(e.sahBentuk("5178", POTONGAN_KUA)).toBe(false);
    expect(e.sahBentuk("1268", BUNYI_GAGAL)).toBe(true);
    expect(e.sahBentuk("1268", "Tergugat bekerja di Morowali")).toBe(false);
    expect(e.sahBentuk("0007", "telah dikaruniai 2 (dua) orang anak")).toBe(true);
    expect(e.sahBentuk("0007", "Bahwa sebagaimana akta nikah nomor 12 telah dikaruniai anak")).toBe(false);
    // isian lain tidak dijaga
    expect(e.sahBentuk("8537", "apa saja")).toBe(true);
    // isian kalimat dirapatkan menjadi satu baris
    expect(e.rapikanBentuk("1268", "pihak keluarga telah berusaha\nmendamaikan  Penggugat dan Tergugat")).toBe("pihak keluarga telah berusaha mendamaikan Penggugat dan Tergugat");
  });

  it("putuskan: bentuk salah tidak ditulis dan tidak disarankan; bentuk benar ditulis baku", () => {
    const e = m();
    const ctx = { kosong: true, jenis: "teks" };
    expect(e.putuskan({ kode: "0222", nilai: GHAIB, keyakinan: "pasti" }, ctx)).toMatchObject({ golongan: "lewati", sebab: "bentuk tidak sesuai isian" });
    expect(e.putuskan({ kode: "0246", nilai: "Juni 2022", keyakinan: "cukup" }, ctx)).toMatchObject({ golongan: "tulis", nilai: "bulan Juni 2022" });
    expect(e.putuskan({ kode: "7035", nilai: "telah", keyakinan: "pasti" }, ctx).golongan).toBe("lewati");
    expect(e.putuskan({ kode: "5197", nilai: "04 Juli 2011", keyakinan: "pasti" }, ctx)).toMatchObject({ golongan: "tulis", nilai: "04 Juli 2011" });
    expect(e.putuskan({ kode: "5178", nilai: "Kecamatan Sindue Tobata, Kabupaten Donggala", keyakinan: "ragu" }, ctx).golongan).toBe("saran");
  });

  it("nilai yang TERISI tetapi jelas bukan bentuk isiannya dianggap mentah (boleh diganti); ketikan pendek petugas tidak", () => {
    const e = m();
    expect(e.jelasMentah("0222", GHAIB)).toBe(true);
    expect(e.jelasMentah("5178", POTONGAN_KUA)).toBe(true);
    expect(e.jelasMentah("0222", "sejak lebaran 2020")).toBe(false);
    expect(e.jelasMentah("0222", "bulan Maret 2024")).toBe(false);
    expect(e.jelasMentah("8537", GHAIB)).toBe(false);
  });

  it("cermin portal (isi-sipp-format.ts, dipakai agen draf putusan) sama dengan mesin ekstensi pada korpus nilai", () => {
    const e = m();
    const korpus: Array<[string, string]> = [
      ["0222", GHAIB], ["0222", "Juni 2020"], ["0222", "awal bulan Agustus 2025"], ["0222", "tahun 2023"], ["0222", "28 Agustus 2025"], ["0246", "bulan Maret 2022"], ["0246", ""],
      ["9944", "1 tahun 4 bulan"], ["9944", "sejak 2020"], ["7035", "Tergugat"], ["7035", "telah"], ["1268", BUNYI_GAGAL], ["1268", "bekerja di Morowali"],
      ["0007", "belum dikaruniai anak"], ["0007", "x"], ["5178", POTONGAN_KUA], ["5178", "Kecamatan Sigi Biromaru, Kabupaten Sigi"], ["5197", "04 Juli 2011"], ["5197", "4 Juli"],
      ["8537", "apa saja"],
    ];
    for (const [kode, nilai] of korpus) {
      expect(sahBentukTs(kode, nilai), `${kode}: ${nilai}`).toBe(e.sahBentuk(kode, nilai));
      if (e.sahBentuk(kode, nilai)) expect(rapikanBentukTs(kode, nilai), `rapi ${kode}: ${nilai}`).toBe(e.rapikanBentuk(kode, nilai));
    }
    expect(bersihkanNilaiUsulan("0222", GHAIB)).toBe("");
    expect(bersihkanNilaiUsulan("0222", "awal bulan Agustus 2025")).toBe("bulan Agustus 2025");
    expect(bersihkanNilaiUsulan("8537", "Budi, S.H.")).toBe("Budi, S.H.");
  });

  it("saran beracara elektronik: perkara e-Court + email Tergugat = penuh, tanpa email = hybrid, bukan e-Court = tidak ada", () => {
    const e = m();
    const kontak = (f: Record<string, unknown>, email = "") => ({ ada: true, elitigasi: f, domisili: { 2: { email } }, orang: [] });
    expect(e.saranElitigasi(kontak({ lewatEcourt: true, tergugatHadir: false }, "tergugat@gmail.com"))).toMatchObject({ nilai: "1" });
    expect(e.saranElitigasi(kontak({ lewatEcourt: true, tergugatHadir: false }))).toMatchObject({ nilai: "2" });
    expect(e.saranElitigasi(kontak({ lewatEcourt: false, tergugatHadir: true }, "x@gmail.com"))).toBeNull();
    expect(e.saranElitigasi(kontak({ lewatEcourt: true }, "admin@pa-donggala.go.id"))).toMatchObject({ nilai: "2" });
    expect(e.saranElitigasi(null)).toBeNull();
  });
});

// ============================================================================
describe("2. bot: tanggal nikah dari posita, data pernikahan SIPP, upaya damai dari posita", () => {
  const AKAR_REPO = path.resolve(process.cwd(), "..");
  const req = createRequire(import.meta.url);
  const layanan = req(path.join(AKAR_REPO, "aleta_bot/services/abtUsulanService.js")) as Record<string, (...a: any[]) => any>;
  const butir = (teks: string) => layanan.kalimatPosita(teks);

  it("tanggal nikah dari kalimat pernikahan: dua angka hari, nama bulan baku; tanggal akta/kelahiran tidak terbaca", () => {
    const f = (t: string) => layanan.tanggalNikahDariPosita(butir(t)).nilai;
    expect(f("Bahwa pada tanggal 04 Juli 2011, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah, sebagaimana Kutipan Akta Nikah Nomor : 161/02/VII/2011, tertanggal 15 Juli 2011;")).toBe("04 Juli 2011");
    expect(f("Bahwa pada tanggal 4 Pebruari 2015 Pemohon dan Termohon menikah secara sah di KUA;")).toBe("04 Februari 2015");
    // hanya tanggal akta (tanpa tanggal nikah) -> kosong, bukan salah
    expect(f("Bahwa Penggugat dan Tergugat telah melangsungkan pernikahan sebagaimana Kutipan Akta Nikah Nomor 1/2/III/2020, tertanggal 30 November 2020;")).toBe("");
    // kalimat riwayat bukan pernikahan
    expect(f("Bahwa setelah menikah, Penggugat dan Tergugat tinggal bersama sampai 12 Mei 2012;")).toBe("");
    expect(f("Bahwa dari pernikahan tersebut dikaruniai seorang anak lahir pada tanggal 3 Mei 2015;")).toBe("");
    expect(f("")).toBe("");
  });

  it("KUA dari posita berupa nama wilayah tanpa kalimat akta", () => {
    const k = butir("Bahwa pada tanggal 18 Juni 2020, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama (KUA) Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, sebagaimana sesuai dengan Kutipan Akta Nikah Nomor : 119/009/XI/2020, tertanggal 30 November 2020;");
    expect(layanan.kuaDariPosita(k).nilai).toBe("Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(layanan.kuaDariPosita(butir("Bahwa Penggugat dan Tergugat menikah di rumah orang tua Penggugat;")).nilai).toBe("");
  });

  it("dariSipp: 5197 dari data pernikahan perkara (pasti), kalau kosong dari posita (cukup), KUA hanya saran", async () => {
    const db = req(path.join(AKAR_REPO, "aleta_bot/db_config.js")) as Record<string, any>;
    const asli = db.query;
    const POSITA = "<ol><li>Bahwa pada tanggal 04 Juli 2011, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama (KUA) Kecamatan Sindue Tobata, Kabupaten Donggala, sebagaimana Kutipan Akta Nikah Nomor : 161/02/VII/2011, tertanggal 15 Juli 2011;</li></ol>";
    const pasang = (tglNikah: string | null) => {
      db.query = (sql: string, _p: unknown, cb: (e: unknown, r: unknown) => void) => {
        const s = String(sql);
        let r: unknown[] = [];
        if (/FROM perkara p\s+LEFT JOIN perkara_putusan/.test(s)) r = [{ perkara_id: 9001, prodeo: 0, jenisPerkara: "Cerai Gugat", statusPutusan: "", verstek: "", tanggalDaftar: "2026-10-01" }];
        else if (/FROM perkara_data_pernikahan/.test(s)) r = tglNikah ? [{ tglNikah }] : [];
        else if (/SELECT posita FROM perkara/.test(s)) r = [{ posita: POSITA }];
        setImmediate(() => cb(null, r));
      };
    };
    try {
      pasang("2011-07-05");
      const a = await layanan.dariSipp("1/Pdt.G/2026/PA.Dgl");
      const u5197 = a.usulan.find((x: any) => x.kode === "5197");
      expect(u5197).toMatchObject({ nilai: "05 Juli 2011", keyakinan: "pasti" });
      expect(u5197.sumber[0].asal).toBe("data-nikah");
      pasang(null);
      const b = await layanan.dariSipp("1/Pdt.G/2026/PA.Dgl");
      expect(b.usulan.find((x: any) => x.kode === "5197")).toMatchObject({ nilai: "04 Juli 2011", keyakinan: "cukup" });
      expect(b.usulan.find((x: any) => x.kode === "5178")).toMatchObject({ nilai: "Kecamatan Sindue Tobata, Kabupaten Donggala", keyakinan: "ragu" });
      // tanggal nikah 0000-00-00 di SIPP = belum diisi -> jatuh ke posita
      pasang("0000-00-00");
      const c = await layanan.dariSipp("1/Pdt.G/2026/PA.Dgl");
      expect(c.usulan.find((x: any) => x.kode === "5197")).toMatchObject({ nilai: "04 Juli 2011", keyakinan: "cukup" });
    } finally {
      db.query = asli;
    }
  });

  it("1268: kedua saksi diam -> posita menentukan (gagal = kalimat baku; keluarga tidak pernah mendamaikan = isi sesuai; diam = kosong)", () => {
    const pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
    const u = (posita: string) => layanan.dariKeteranganSaksi("", "", "", pihak, posita).usulan.find((x: any) => x.kode === "1268");
    const gagal = u("Bahwa pada tanggal 04 Juli 2011, Penggugat dan Tergugat menikah.\nBahwa atas permasalahan dan kemelut rumah tangga yang dihadapi, keluarga telah mencoba memusyawarahkan untuk mencari penyelesaian namun usaha tersebut tidak membuahkan hasil;");
    expect(gagal).toMatchObject({ nilai: BUNYI_GAGAL, keyakinan: "cukup" });
    expect(gagal.sumber[0]).toMatchObject({ asal: "posita" });
    const belum = u("Bahwa atas permasalahan dan kemelut rumah tangga yang dihadapi, keluarga tidak pernah mencoba memusyawarahkan untuk mencari penyelesaian;");
    expect(belum.nilai).toMatch(/belum pernah ada upaya/);
    expect(belum.keyakinan).toBe("cukup");
    expect(u("Bahwa Penggugat dan Tergugat telah menikah dan tinggal bersama.").nilai).toBe("");
    // saksi yang bicara tetap mengalahkan posita
    const saksi = layanan.dariKeteranganSaksi("- Bahwa keluarga sudah berusaha mendamaikan namun tidak berhasil", "", "", pihak, "Bahwa atas permasalahan dan kemelut rumah tangga yang dihadapi, keluarga tidak pernah mencoba memusyawarahkan;").usulan.find((x: any) => x.kode === "1268");
    expect(saksi.sumber[0].saksi).toBe(1);
  });
});

// ============================================================================
describe("3. panel: Tgl Nikah terisi dari SIPP, posita gugatan, dan saran dari bukti P", () => {
  it("data pernikahan SIPP: terisi '04 Juli 2011', tersimpan lewat jalur lama, lencana jujur", async () => {
    const h = buka({ usulan: [U5197("04 Juli 2011", "data-nikah")] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["5197"] === "04 Juli 2011", "5197 tersimpan di ABT");
    expect(nilaiKotak(h, "5197")).toBe("04 Juli 2011");
    expect(mintaKe(h, /edit_data\?no_var=5197/, "POST")[0].badan).toBe("aksi=Simpan&value=04+Juli+2011&var_type=data_teks");
    expect(lencanaTeks(h, "5197").join("|")).toContain("dari data pernikahan SIPP");
    expect(akar(h).textContent).not.toMatch(/ketik di sini[\s\S]{0,0}Tgl Nikah/);
  });

  it("posita gugatan: terisi bila cukup; lencana 'dari posita gugatan'", async () => {
    const h = buka({ usulan: [U5197("18 Juni 2020", "posita-gugatan", "cukup")] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["5197"] === "18 Juni 2020", "5197 dari posita tersimpan");
    expect(lencanaTeks(h, "5197").join("|")).toContain("dari posita gugatan");
  });

  it("bukti P akta nikah: hanya SARAN samar (tanggal akta belum tentu tanggal nikah) - tidak ditulis, juga oleh Isi otomatis", async () => {
    const h = buka({ abtAwal: { "1214": BAWAAN_1214_NOMOR }, usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => (q(h, "#bd-i5197") as HTMLInputElement | null)?.getAttribute("placeholder") === "05 April 2021", "saran dari bukti terpasang");
    expect(nilaiKotak(h, "5197")).toBe("");
    klik(h, '[data-bd2="isisipp"]');
    await sampai(() => /Belum ada isian|Semua isian|isian diisi|Tidak ada isian/.test(q(h, "#bd-toast")?.textContent || ""), "tombol selesai");
    await tunggu2(150);
    expect(h.abt["5197"]).toBeUndefined();
    expect(nilaiKotak(h, "5197")).toBe("");
  });
});

// ============================================================================
describe("4. panel: satu tombol Isi otomatis menggantikan deret tombol", () => {
  it("hanya satu tombol; deret lama (Isi dari SIPP, Isi dari gugatan (posita), Ambil tanggal KTP dari bukti) tidak ada", async () => {
    const h = buka({ usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const alat = qq(h, "#bd-alatisi button").map((b) => (b.textContent || "").trim());
    expect(alat.filter((a) => a === "Isi otomatis")).toHaveLength(1);
    for (const lama of ["Isi dari SIPP", "Isi dari gugatan (posita)", "Ambil tanggal KTP dari bukti"]) expect(alat).not.toContain(lama);
    expect(q(h, '[data-bd2="pakaisaran"]')).toBeNull();
    expect(q(h, '[data-bd2="ktpbukti"]')).toBeNull();
  });

  it("saklar mati: tombol menjalankan SIPP + saran gugatan sekaligus; yang ada isinya tidak ditimpa; saran yang bentuknya salah tidak dipakai", async () => {
    const bawaan = { "0222": GHAIB, "0246": "bulan Maret 2022", "9944": "kurang lebih 1 tahun 4 bulan", "5178": POTONGAN_KUA, "7035": "telah", "1268": BUNYI_GAGAL };
    const h = buka({ simpanan: { blangkoDerryIsiOto: false }, abtAwal: { "1006": "di rumah sendiri" }, bawaan, usulan: [{ kode: "0007", nama: "Anak", nilai: "telah dikaruniai 2 orang anak", keyakinan: "cukup", sumber: [] }, { kode: "1006", nama: "Tempat", nilai: "di rumah orang tua Penggugat", keyakinan: "cukup", sumber: [] }] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    expect(mintaKe(h, /edit_data\?/, "POST")).toEqual([]);
    // sebelum ditekan: saran samar yang salah bentuk tidak tampil sebagai saran
    const ph = (k: string) => (q(h, `#bd-i${k}`) as HTMLInputElement | HTMLTextAreaElement).getAttribute("placeholder");
    await sampai(() => ph("0246") === "bulan Maret 2022", "saran valid terpasang");
    expect(ph("0222")).not.toBe(GHAIB);
    expect(ph("5178")).not.toBe(POTONGAN_KUA);
    expect(ph("7035")).not.toBe("telah");
    klik(h, '[data-bd2="isisipp"]');
    await sampai(() => h.abt["0007"] === "telah dikaruniai 2 orang anak" && h.abt["0246"] === "bulan Maret 2022", "tombol mengisi");
    expect(h.abt["1006"]).toBe("di rumah sendiri");
    expect(h.abt["9944"]).toBe("kurang lebih 1 tahun 4 bulan");
    expect(h.abt["1268"]).toBe(BUNYI_GAGAL);
    for (const salah of ["0222", "5178", "7035"]) expect(h.abt[salah], salah).toBeUndefined();
    expect(JSON.stringify(h.abt)).not.toMatch(/GHOIB|Sindue|Aleta|ALETA/i);
    await sampai(() => /isian diisi dan tersimpan/.test(q(h, "#bd-toast")?.textContent || ""), "satu pesan ringkasan");
  });
});

// ============================================================================
describe("5. awal perselisihan: kalimat ghaib/pisah bukan periode", () => {
  it("bawaan ABT berupa kalimat ghaib tidak disarankan dan tidak ditulis; kotak tetap kosong", async () => {
    const h = buka({ bawaan: { "0222": GHAIB }, usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await tunggu2(200);
    expect(nilaiKotak(h, "0222")).toBe("");
    expect(JSON.stringify(h.abt)).not.toContain("GHOIB");
    klik(h, '[data-bd2="isisipp"]');
    await tunggu2(300);
    expect(h.abt["0222"]).toBeUndefined();
  });

  it("nilai tersimpan berupa kalimat ghaib (belum pernah disunting) diganti periode dari mesin; ada di riwayat", async () => {
    const h = buka({ abtAwal: { "0222": GHAIB }, usulan: [{ kode: "0222", nama: "Awal Konflik", nilai: "Maret 2024", keyakinan: "cukup", sumber: [{ saksi: 1, kalimat: "sejak Maret 2024 tidak harmonis" }] }] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["0222"] === "bulan Maret 2024", "periode baku menggantikan kalimat ghaib");
    expect(h.riwayatCatat.some((c) => c.kode === "0222" && String(c.sebelum) === GHAIB)).toBe(true);
  });

  it("usulan mesin yang bentuknya kalimat tidak ditulis walau 'pasti'", async () => {
    const h = buka({ usulan: [{ kode: "0222", nama: "Awal Konflik", nilai: GHAIB, keyakinan: "pasti", sumber: [] }, { kode: "0246", nama: "Pisah Rumah", nilai: "bulan Januari 2025", keyakinan: "pasti", sumber: [] }] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["0246"] === "bulan Januari 2025", "yang benar tetap ditulis");
    await tunggu2(150);
    expect(h.abt["0222"]).toBeUndefined();
  });
});

// ============================================================================
describe("6. upaya damai oleh keluarga dan beracara secara elektronik", () => {
  it("upaya damai dari posita (kalimat baku) terisi otomatis", async () => {
    const h = buka({ usulan: [{ kode: "1268", nama: "Upaya Damai Keluarga", nilai: BUNYI_GAGAL, keyakinan: "cukup", sumber: [{ saksi: 0, asal: "posita", kalimat: "keluarga telah mencoba memusyawarahkan namun tidak berhasil" }] }] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["1268"] === BUNYI_GAGAL, "1268 tersimpan");
    expect(lencanaTeks(h, "1268").join("|")).toContain("dari posita");
  });

  it("e-Court tanpa email Tergugat (belum cukup pasti untuk ditulis): SARAN 'hybrid' di pilihan, tidak tersimpan", async () => {
    const kontak = { ada: true, elitigasi: { lewatEcourt: true, tergugatHadir: false, jumlahSidang: 1 }, domisili: { 1: null, 2: { email: "", milik: "pihak", asal: "" } }, orang: [] };
    const h = buka({ el7: null as never, el7Kontak: kontak, usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const pilihan = (await sampai(() => q(h, "#bd-i7139 option[value='']"), "pilihan beracara elektronik")) as HTMLOptionElement;
    await sampai(() => /^saran: E-Litigasi hybrid/.test((q(h, "#bd-i7139 option[value='']") as HTMLOptionElement).textContent || ""), "saran hybrid terpasang");
    expect(pilihan.textContent).toContain("Panitera Sidang");
    expect(q(h, '.bd-f[data-f="7139"] .bd-el7')?.textContent).toMatch(/^Saran:/);
    expect(h.abt["7139"]).toBeUndefined();
  });

  it("e-Court dengan email Tergugat tetapi pemiliknya belum pasti: SARAN 'penuh'; bukan perkara e-Court: tanpa saran; keputusan pasti tetap ditulis", async () => {
    const dengan = { ada: true, elitigasi: { lewatEcourt: true, tergugatHadir: false }, domisili: { 2: { email: "tergugat@gmail.com", milik: "pihak", asal: "ecourt", keyakinan: "ragu" } }, orang: [] };
    const h = buka({ el7: null as never, el7Kontak: dengan, usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => /^saran: E-Litigasi penuh/.test((q(h, "#bd-i7139 option[value='']") as HTMLOptionElement | null)?.textContent || ""), "saran penuh");
    const bukan = buka({ el7: null as never, el7Kontak: { ...dengan, elitigasi: { lewatEcourt: false, tergugatHadir: true } }, usulan: [] });
    await sampaiPerkara(bukan);
    await pilih(bukan, BLANGKO_PUT);
    await tunggu2(250);
    expect(q(bukan, "#bd-i7139 option[value='']")?.textContent).toBe("pilih…");
    const pasti = buka({ el7: { nilai: "1", keterangan: "E-Litigasi: penuh (Tergugat ber-email)" }, usulan: [] });
    await sampaiPerkara(pasti);
    await pilih(pasti, BLANGKO_PUT);
    await sampai(() => pasti.abt["7139"] === "1", "keputusan pasti ditulis");
  });
});

// ============================================================================
describe("7. alat bukti surat: penomoran awal dibuang", () => {
  it("'1. Fotokopi ...' menjadi 'Fotokopi ...' di tampilan dan di nilai yang disimpan ke ABT", async () => {
    const h = buka({ abtAwal: { "1214": BAWAAN_1214_NOMOR }, usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => qq(h, ".bd-bnama").length >= 2, "dua baris bukti");
    const nama = qq(h, ".bd-bnama").map((e) => (e as HTMLInputElement).value);
    expect(nama).toEqual(["Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el)", "Fotokopi Kutipan Akta Nikah"]);
    await sampai(() => !/(^|\n)\s*\d+\s*[.)]\s/.test(h.abt["1214"]), "nilai tersimpan tanpa penomoran awal");
    expect(h.abt["1214"]).toContain("Fotokopi Kutipan Akta Nikah");
    expect(h.abt["1214"]).toContain("lalu diberi tanda P.2");
  });

  it("murni: uraiBukti dan kalimatBukti membuang '2)' / '(3)' di depan nama; nama biasa tidak disentuh", () => {
    const h = buka();
    const m = h.w.aletaBlangkoDerryIsian.murni as { uraiBukti: (t: string) => Array<{ nm: string }>; kalimatBukti: (r: unknown, p: string, i: number) => string };
    expect(m.uraiBukti("2) Fotokopi Kartu Keluarga atas nama Ani, Nomor 123, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;")[0].nm).toBe("Fotokopi Kartu Keluarga");
    const r = { nm: "3. Surat Keterangan KUA", an: "", no: "", tgl: "", oleh: "", meterai: 3, cocok: 4, manual: null };
    expect(m.kalimatBukti(r, "P", 2).startsWith("Surat Keterangan KUA")).toBe(true);
    expect(m.kalimatBukti({ ...r, nm: "Fotokopi 2 lembar Akta" }, "P", 0).startsWith("Fotokopi 2 lembar Akta")).toBe(true);
    expect(m.kalimatBukti({ ...r, nm: "", manual: "1. Fotokopi KTP, lalu diberi tanda P.1" }, "P", 0).startsWith("Fotokopi KTP")).toBe(true);
  });
});

// ============================================================================
describe("8. tata letak: rincian alasan cerai selebar penuh, lencana satu baris yang membungkus rapi", () => {
  it("kartu 'Rincian alasan cerai' selalu selebar penuh dengan kotak tumbuh (juga saat masih kosong); isian pendek tetap seragam", async () => {
    const h = buka({ usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    const kartu = q(h, '.bd-f[data-f="5227"]')!;
    expect(kartu.textContent).toContain("Rincian alasan cerai");
    expect(kartu.classList.contains("panjang")).toBe(true);
    const kotak = kartu.querySelector("textarea.bd-auto") as HTMLTextAreaElement;
    expect(kotak).not.toBeNull();
    expect(Number(kotak.getAttribute("rows"))).toBeGreaterThanOrEqual(3);
    expect(q(h, '.bd-f[data-f="0222"]')!.classList.contains("panjang")).toBe(false);
    expect(q(h, "#bd-i0222")!.tagName).toBe("INPUT");
    // CSS: kartu panjang membentang seluruh kolom grid
    const css = baca("blangko-derry.css");
    expect(css).toMatch(/\.bd-f\.panjang,\s*#aleta-bd-akar \.bd-f\.lebar\s*\{\s*grid-column:\s*1 \/ -1/);
  });

  it("isian panjang lain (uraian, pertimbangan) ikut selebar penuh; hasil pilih bunyi 5227 tumbuh sesuai isi", async () => {
    const h = buka({
      usulan: [
        { kode: "5227", nama: "Alasan-Alasan Cerai", nilai: "", keyakinan: "ragu", pilihan: [{ keadaan: "templat hakim", nilai: "Tergugat sering marah dan berkata kasar kepada Penggugat, sehingga Penggugat dan Tergugat sering bertengkar dan tidak ada harapan untuk hidup rukun kembali dalam rumah tangga" }], sumber: [] },
      ],
    });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => q(h, '.bd-f[data-f="5227"] select[data-bunyi]'), "pilih bunyi");
    const sel = q(h, '.bd-f[data-f="5227"] select[data-bunyi]') as HTMLSelectElement;
    sel.value = "0";
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => /Tergugat sering marah/.test(h.abt["5227"] || ""), "bunyi dipilih tersimpan");
    expect(q(h, '.bd-f[data-f="5227"]')!.classList.contains("panjang")).toBe(true);
  });

  it("lencana dalam satu baris pembungkus (.bd-tandabaris) dengan tombol sumber/sematan/riwayat di ujung (.bd-ketaksi)", async () => {
    const h = buka({ usulan: [{ kode: "0246", nama: "Pisah Rumah", nilai: "bulan Januari 2025", keyakinan: "cukup", sumber: [{ saksi: 1, kalimat: "pisah sejak Januari 2025" }] }] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => q(h, '.bd-f[data-f="0246"] .bd-ket'), "lencana");
    const ket = q(h, '.bd-f[data-f="0246"] .bd-ket')!;
    expect(ket.querySelectorAll(":scope > .bd-tandabaris .bd-tanda").length).toBeGreaterThanOrEqual(2);
    expect(ket.querySelector(":scope > .bd-ketaksi [data-bd2='ketsemat']")).not.toBeNull();
    const css = baca("blangko-derry.css");
    expect(css).toMatch(/\.bd-tandabaris\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.bd-tanda\s*\{[^}]*max-width:\s*100%/);
  });
});

// ============================================================================
describe("9. blangko PUTUSAN: perapian posita dan kalimat penutup keterangan saksi jalan sendiri", () => {
  it("posita dirapikan otomatis satu kali (uji kering lalu tulis), dicatat di riwayat; tidak untuk BAS; tidak bila tak ada perubahan", async () => {
    const h = buka({ positaRapi: { ok: true, berubah: true, sebelum: "1. a 2. b", sesudah: "1. a\n2. b" }, usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => (h.w.__rapi as unknown[]).length >= 2, "posita dirapikan");
    expect(polos(h.w.__rapi)).toEqual([["10154", true], ["10154", false]]);
    await sampai(() => h.riwayatCatat.some((c) => c.kode === "5125"), "riwayat posita");
    expect(h.riwayatCatat.find((c) => c.kode === "5125")).toMatchObject({ cara: "dirapikan otomatis di Blangko Derry", sebelum: "1. a 2. b", sesudah: "1. a\n2. b" });
    expect(String(q(h, "#bd-toast")?.textContent)).toMatch(/Posita dirapikan otomatis/);

    const bas = buka({ orang: "pp", positaRapi: { ok: true, berubah: true, sebelum: "x", sesudah: "y" }, usulan: [] });
    await sampaiPerkara(bas);
    await pilih(bas, BLANGKO_BAS, "bas");
    await tunggu2(250);
    expect(bas.w.__rapi).toEqual([]);

    const rapi = buka({ positaRapi: { ok: true, berubah: false }, usulan: [] });
    await sampaiPerkara(rapi);
    await pilih(rapi, BLANGKO_PUT);
    await sampai(() => (rapi.w.__rapi as unknown[]).length >= 1, "uji kering");
    await tunggu2(150);
    expect(polos(rapi.w.__rapi)).toEqual([["10154", true]]);
  });

  it("keterangan saksi putusan hanya-baca: kalimat penutup tidak tampil, tidak ada editor/tombol, dan tidak ada tulisan ke ABT", async () => {
    const baris = [
      { no: "1", tanya: "Apakah saksi kenal Penggugat?", jawab: "Bahwa saya kenal Penggugat sebagai tetangga." },
      { no: "2", tanya: "Ada lagi?", jawab: "Bahwa cukup sekian" },
    ];
    const h = buka({ saksiRows: { "2021": baris, "5058": baris }, usulan: [] });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    klik(h, '[data-bd2="lipattj"]');
    await sampai(() => qq(h, ".bd-tjbaca tbody tr").length >= 1 && /kenal Penggugat/.test(q(h, ".bd-tjbaca")?.textContent || ""), "tampilan hanya-baca");
    const teksTabel = q(h, ".bd-tjbaca")!.textContent || "";
    expect(teksTabel).toContain("kenal Penggugat");
    expect(teksTabel).not.toMatch(/cukup sekian/i);
    expect(q(h, "[data-sba]")).toBeNull();
    expect(q(h, '[data-sbaksi="bersih1"]')).toBeNull();
    expect(mintaKe(h, /tanyajawab_perkara_edit\?aksi=simpan/, "POST")).toEqual([]);
    expect(mintaKe(h, /edit_data\?no_var=20(21|22)/, "POST")).toEqual([]);
  });

  it("RTF cetak putusan: paragraf kalimat penutup saksi dibuang; ekor kalimat, tabel, dan paragraf lain tidak disentuh; RTF tetap seimbang", () => {
    const h = buka();
    const fn = h.w.aletaBlangkoDerryIsian.murni.bersihkanPenutupSaksiRtf as (r: string | Uint8Array) => { rtf: string | Uint8Array; jumlah: number };
    const BS = String.fromCharCode(92); // "@" di bawah = garis miring terbalik RTF
    const rtf = (
      "{@rtf1@ansi{@fonttbl{@f0 Times;}}" +
      "@pard@qj Menimbang bahwa saksi pertama menerangkan sebagai berikut;@par" +
      "@pard@qj Bahwa saya kenal Penggugat sebagai tetangga;@par" +
      "@pard@qj Bahwa cukup sekian@par" +
      "@pard@qj 2. Bahwa sudah cukup;@par" +
      "@pard@qj Bahwa Tergugat sering pergi, cukup sekian@par" +
      "@pard@intbl Bahwa cukup sekian@cell@row" +
      "@pard@qj {@b Bahwa cukup sekian}@par" +
      "@pard@qj Menimbang bahwa cukup alasan untuk bercerai;@par}"
    ).replace(/@/g, BS);
    const r = fn(rtf);
    // dua paragraf utuh dibuang; paragraf bergrup yang menempel pada baris tabel dilewati (tidak aman dipotong)
    expect(r.jumlah).toBe(2);
    const t = r.rtf as string;
    expect(t).toContain("Menimbang bahwa saksi pertama");
    expect(t).toContain("kenal Penggugat sebagai tetangga");
    expect(t).toContain("Tergugat sering pergi, cukup sekian"); // ekor di paragraf lain: tidak aman, dibiarkan
    expect(t).toContain(`${BS}intbl Bahwa cukup sekian${BS}cell`); // sel tabel: dibiarkan
    expect(t).toContain("Menimbang bahwa cukup alasan untuk bercerai");
    expect((t.match(/Bahwa cukup sekian/g) || []).length).toBe(2); // sel tabel dan paragraf bergrup sesudah tabel dibiarkan
    expect(t.split("{").length).toBe(t.split("}").length);
    // keluaran tanpa penutup apa pun: persis sama
    expect(fn(`{${BS}rtf1 ${BS}pard Isi biasa${BS}par}`).jumlah).toBe(0);
    // masukan Uint8Array dikembalikan sebagai Uint8Array
    const bita = fn(new TextEncoder().encode(rtf));
    expect(typeof bita.rtf).toBe("object");
    expect(bita.jumlah).toBe(2);
  });

  it("ambilRtf hanya membersihkan penutup untuk PUTUSAN, sesudah header penanda, tanpa memanggil simpan", () => {
    const sumber = baca("blangko-derry-isian.js");
    const a = sumber.indexOf("async function ambilRtf(");
    const fungsi = sumber.slice(a, sumber.indexOf("async function muatPratinjau(", a));
    expect(fungsi.indexOf("bersihkanHeaderPenanda")).toBeLessThan(fungsi.indexOf("bersihkanPenutupSaksiRtf"));
    expect(fungsi).toMatch(/S\.blangko\.jenis === "put"[\s\S]*bersihkanPenutupSaksiRtf/);
    expect(fungsi).not.toMatch(/jadwalkanSimpan|simpanIsian|simpanTj|edit_data/);
  });
});

// ============================================================================
// Tangkapan layar (opsional, hanya dengan TANGKAP=1): menyimpan HTML kartu "Perlu diisi" untuk dipotret Playwright
// (docs/rancangan/derry-isian-2-19okt/tangkap.mjs). Tidak ikut menjadi penjaga.
// ============================================================================
describe.skipIf(process.env.TANGKAP !== "1")("tangkapan layar", () => {
  it("menyimpan HTML kartu isian untuk replika", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const keluar = process.env.TANGKAP_KE || "D:/Aplikasi/aleta/tmp/isian2/tangkap";
    mkdirSync(keluar, { recursive: true });
    const potret = async (nama: string, o: Opsi) => {
      const h = buka(o);
      await sampaiPerkara(h);
      await pilih(h, BLANGKO_PUT);
      await tunggu2(900);
      for (const el of qq(h, "input")) el.setAttribute("value", (el as HTMLInputElement).value);
      for (const el of qq(h, "textarea")) el.textContent = (el as HTMLTextAreaElement).value;
      writeFileSync(`${keluar}/${nama}.html`, akar(h).outerHTML);
    };
    const usulan: Usulan[] = [
      U5197("04 Juli 2011", "data-nikah"),
      { kode: "0222", nama: "Awal Konflik", nilai: "Maret 2024", keyakinan: "cukup", kesepakatan: "posita", sumber: [{ saksi: 0, asal: "posita", kalimat: "sejak bulan Maret 2024 keadaan rumah tangga mulai tidak harmonis" }] },
      { kode: "0246", nama: "Pisah Rumah", nilai: "bulan Januari 2025", keyakinan: "pasti", kesepakatan: "sama", sumber: [{ saksi: 1, kalimat: "pisah sejak Januari 2025" }, { saksi: 2, kalimat: "pisah rumah sejak Januari 2025" }] },
      { kode: "9944", nama: "Lama Pisah", nilai: "1 tahun 4 bulan", keyakinan: "cukup", sumber: [{ saksi: 1, kalimat: "sudah 1 tahun 4 bulan" }] },
      { kode: "7035", nama: "Meninggalkan", nilai: "Tergugat", keyakinan: "pasti", sumber: [{ saksi: 1, kalimat: "yang meninggalkan adalah Tergugat" }] },
      { kode: "1268", nama: "Upaya Damai", nilai: BUNYI_GAGAL, keyakinan: "cukup", sumber: [{ saksi: 0, asal: "posita", kalimat: "keluarga telah mencoba memusyawarahkan namun tidak berhasil" }] },
      { kode: "0007", nama: "Anak", nilai: "telah dikaruniai 2 orang anak", keyakinan: "cukup", sumber: [] },
      { kode: "5227", nama: "Alasan-Alasan Cerai", nilai: "", keyakinan: "ragu", pilihan: [{ keadaan: "templat hakim", nilai: "Tergugat sering marah dan berkata kasar kepada Penggugat, sehingga Penggugat dan Tergugat sering bertengkar dan tidak ada harapan untuk hidup rukun kembali dalam rumah tangga" }, { keadaan: "dari sebab gugatan", nilai: "tidak ada nafkah" }], sumber: [{ saksi: 1, kalimat: "sering bertengkar" }] },
    ];
    const kontak = { ada: true, elitigasi: { lewatEcourt: true, tergugatHadir: false, jumlahSidang: 1 }, domisili: { 1: null, 2: { email: "", milik: "pihak", asal: "" } }, orang: [] };
    await potret(process.env.TANGKAP_NAMA || "putusan-sesudah", { abtAwal: { "1214": BAWAAN_1214_NOMOR }, bawaan: { "5178": POTONGAN_KUA }, el7: null as never, el7Kontak: kontak, usulan });
  });
});
