// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 (agen S6) - LAYAR BLANGKO DERRY: PENGISI JENIS S6 SAMPAI KE KARTU ISIAN
 * ============================================================================
 *
 * Ekstensi dijalankan sungguhan di jsdom (blangko-derry.js + blangko-derry-isian.js + isi-sipp-bersama.js) dengan portal, bot dan
 * ABT ditiru di fetch. Usulan bot BUKAN ketikan tangan: disusun oleh pengisi S6 sungguhan (isiOtomatisJenisS6.js) dari perkara
 * harta bersama contoh, lalu diumpankan ke layar. Yang dijaga:
 *   A  usulan cukup/pasti dari SIPP ditulis ke ABT bila isian KOSONG lewat jalur simpan yang sama dengan ketikan;
 *   B  usulan ragu hanya menjadi saran samar (tidak ditulis) dengan lencana "yakin: ragu - periksa" dan "dari posita gugatan";
 *   C  isian yang sudah ada isinya di ABT TIDAK ditimpa;
 *   D  isian yang memang manual (usulan 'tidak_ada_sumber') tidak pernah ditulis atau disarankan; tampilan lencana "diisi manual" milik UI bersama
 *      (agen S3/S5) dan diberi data lewat petunjuk-s6.ts + usulan tidak_ada_sumber;
 *   E  saklar "Isi otomatis" mati: tidak ada yang ditulis sendiri.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { createRequire } from "node:module";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

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
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
  D("8706", "DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama (contoh: Pengadilan Agama Donggala berdasarkan Putusan Nomor 222/Pdt.G/2022/PA.Dgl)", "data_teks"),
  D("1108", "Nomor duplikat surat nikah", "data_teks"),
  D("9283", "HARTA BERSAMA REKONVENSI: OBJEK YANG DIGUGAT DALAM REKONVENSI (salin dari jawaban; satu objek per baris)", "data_teks"),
  D("9165", "PEMERIKSAAN SETEMPAT: LETAK OBJEK SENGKETA YANG DIPERIKSA (desa/kelurahan, kecamatan, kabupaten)", "data_teks"),
  D("8712", "CORET: NOMOR DAN TANGGAL SURAT TEGURAN PANITERA untuk menambah panjar (contoh: Nomor 123/PAN.PA/IX/2026 tanggal 1 September 2026)", "data_teks"),
  D("9682", "Eksepsi kewenangan dikabulkan - fakta/alasan perkara di luar kewenangan (isian: satu kalimat tanpa titik akhir)", "data_teks"),
]);
const PENANDA_PUT = ["0001", "0046", "0033", "8706", "1108", "9283", "9165", "8712", "9682"];
const PENANDA_BAS = ["0001", "0033", "0050", "0007", "1006", "8503"];
const PENANDA_REL = ["0001", "0046", "9101", "1006"];
const PENANDA_OLEH = (berkas: string, indeks: number) => (berkas.startsWith("[01]") ? PENANDA_PUT : berkas.startsWith("[JS]") ? PENANDA_REL : indeks >= 0 ? PENANDA_BAS : PENANDA_BAS);

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const PK = (extra: Record<string, unknown> = {}) => ({
  nomorPerkara: NOMOR, perkaraId: "10154", jenisPerkara: "Harta Bersama", alurPerkaraId: 15, sudahPutus: true, tanggalPutusan: HARI_INI, tanggalMinutasi: "",
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

// ----------------------------------------------------------------------------
// Usulan dari pengisi S6 sungguhan
// ----------------------------------------------------------------------------
const req_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const J6 = req_(path.join(AKAR, "aleta_bot", "services", "isiOtomatisJenisS6.js")) as { usulanDariKonteks: (k: Record<string, unknown>) => Usulan[] };
const POSITA_HB =
  "Bahwa Penggugat dan Tergugat menikah pada 27 Agustus 2014 sebagaimana tercatat dalam Duplikat Kutipan Akta Nikah Nomor: 365/Kua.22.10.04/PW.01/07/2025 tanggal 4 Februari 2020.";
const USULAN_S6 = [...J6.usulanDariKonteks({
  jenisPerkaraId: 348,
  posita: POSITA_HB,
  petitum: "",
  pihak1: ["Nisma Binti Saleh"],
  pihak2: ["Kasim Bin Imbali"],
  tanggalDaftar: "2026-06-01",
  rekonvensi: { tgl: "2026-07-01", petitum: "<p>Menetapkan harta bersama berupa:</p><ol><li>Sebidang tanah di Desa Lolu seluas 300 m2;</li></ol>" },
  terdahulu: [{ nomor: "478/Pdt.G/2021/PA.Dgl", tglPutusan: "2021-11-25", nomorAkta: "" }],
})];
const kartu = (h: Halaman, kode: string) => q(h, `.bd-f[data-f="${kode}"]`) as HTMLElement;
const ketKartu = (h: Halaman, kode: string) => (kartu(h, kode)?.textContent || "") + " " + Array.from(kartu(h, kode)?.querySelectorAll("[title]") || []).map((e) => e.getAttribute("title")).join(" ");
void ketKartu;

describe("A-D. pengisi S6 sampai ke kartu isian", () => {
  it("fixture usulan S6 memuat cukup, pasti, ragu, dan manual untuk kode-kode yang diuji", () => {
    const oleh = new Map(USULAN_S6.map((u) => [String(u.kode), u]));
    expect(oleh.get("1108")?.keyakinan).toBe("cukup");
    expect((oleh.get("1108")?.sumber as Array<{ asal: string }>)[0].asal).toBe("posita-gugatan");
    expect(oleh.get("8706")?.keyakinan).toBe("ragu");
    expect(oleh.get("9283")?.keyakinan).toBe("ragu");
    expect(oleh.get("9165")?.keyakinan).toBe("tidak_ada_sumber");
    expect(oleh.get("8712")?.opsional).toBe(true);
    expect(oleh.get("9682")?.keyakinan).toBe("tidak_ada_sumber");
  });

  it("cukup/pasti kosong -> ditulis ke ABT; ragu -> saran samar dengan lencana ragu; sudah ada isinya -> tidak ditimpa", async () => {
    const h = buka({ abtAwal: { "9283": "1. objek ketikan petugas" }, usulan: USULAN_S6 });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["1108"] === "365/Kua.22.10.04/PW.01/07/2025", "1108 (cukup) tersimpan di ABT");
    // ragu: hanya saran samar
    const ragu = (await sampai(() => {
      const i = q(h, "#bd-i8706") as HTMLInputElement | HTMLTextAreaElement | null;
      return i && /Pengadilan Agama Donggala berdasarkan Putusan Nomor 478\/Pdt\.G\/2021/.test(i.placeholder) ? i : null;
    }, "saran ragu 8706")) as HTMLInputElement;
    expect(ragu.value).toBe("");
    expect(h.abt["8706"]).toBeUndefined();
    expect(mintaKe(h, /edit_data\?no_var=8706/, "POST")).toEqual([]);
    const lencana = kartu(h, "8706").textContent || "";
    expect(lencana).toContain("yakin: ragu");
    expect(lencana).toContain("dari SIPP");
    // sudah ada isinya: tidak ditimpa
    expect(h.abt["9283"]).toBe("1. objek ketikan petugas");
    expect(mintaKe(h, /edit_data\?no_var=9283/, "POST")).toEqual([]);
    // tanpa kata ALETA di muatan simpan
    for (const m of h.minta.filter((x) => x.cara === "POST" && /edit_data\?/.test(x.url))) expect(`${m.url} ${m.badan}`).not.toMatch(/aleta/i);
  });

  it("isian manual (penilaian hakim, hasil sidang, surat yang tidak tercatat): tidak ada yang ditulis atau disarankan ke ABT", async () => {
    const h = buka({ usulan: USULAN_S6 });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await sampai(() => h.abt["1108"] === "365/Kua.22.10.04/PW.01/07/2025", "isian cukup tersimpan (bukti layar sudah jalan)");
    for (const kode of ["9682", "8712", "9165"]) {
      expect(h.abt[kode], kode).toBeUndefined();
      expect(nilaiKotak(h, kode), kode).toBe("");
      expect(((q(h, `#bd-i${kode}`) as HTMLInputElement | null)?.placeholder || "").replace("ketik di sini", ""), kode).toBe("");
    }
    expect(mintaKe(h, /edit_data\?no_var=(9682|8712|9165)/, "POST")).toEqual([]);
  });

  it("saklar Isi otomatis mati: tidak ada yang ditulis sendiri (cukup/pasti hanya menjadi saran)", async () => {
    const h = buka({ simpanan: { blangkoDerryIsiOto: false }, usulan: USULAN_S6 });
    await sampaiPerkara(h);
    await pilih(h, BLANGKO_PUT);
    await tunggu(150);
    expect(mintaKe(h, /edit_data\?no_var=(1108|8706|9283)/, "POST")).toEqual([]);
    expect(h.abt["1108"]).toBeUndefined();
  });
});
