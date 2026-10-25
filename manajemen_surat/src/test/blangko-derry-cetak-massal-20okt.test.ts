// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - BLANGKO ABT BY DERRY: CETAK MASSAL MENURUT PERAN
 * ============================================================================
 *
 * ekstensi-sipp/blangko-derry*.js dijalankan SUNGGUHAN di jsdom (kerangka + pengemudi isian + jendela cetak massal) dengan portal, bot dan ABT
 * ditiru di fetch. Yang dijaga:
 *   A  tombol "Cetak massal" di ujung kanan langkah 1, isi menurut peran (hakim putusan, PP BAS, juru sita relaas, PTSP penetapan,
 *      Super Admin memilih jenis)
 *   B  daftar per tanggal (hanya perkara yang cocok), tidak ada yang tercentang sendiri, "Pilih semua yang siap"
 *   C  blangko tiap perkara dari mesin saran Blangko Derry, dapat diganti per baris lewat pemilih blangko
 *   D  "Isi otomatis semua" tidak menimpa isian yang sudah ada dan hanya lewat jalur simpan isian yang sama
 *   E  Cetak memanggil ambilRtf (naskah ABT per perkara, header penanda dibersihkan) dan mengemas satu ZIP RTF / satu PDF gabungan
 *   F  gagal satu tidak menghentikan yang lain; ringkasan akhir; yang gagal tercentang kembali
 *   G  pembantu murni: ZIP, penyaring daftar, penilai keadaan; penggabung PDF sisi portal
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { PDFDocument } from "pdf-lib";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { susunPerkaraSaya, type BarisSidangSaya } from "@/app/api/aleta-ecourt/perkara-saya/susun";
import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { gabungkanPdf } from "@/lib/gabung-pdf";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "jurusita.js", "abt-klien.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-isian.js", "blangko-derry-massal.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const TGL = "2026-10-15";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 8000): Promise<NonNullable<T>> {
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
const BLANGKO_PUT_2 = "[02] [Kabul] CG - F";
const BLANGKO_BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";
const BLANGKO_BAS_1 = "BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T";
const BLANGKO_REL = "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan)";
const PTSP = ["@ 1 - PMH", "@ 0a - PPP", "@ 0b - PJS", "@ 2 - PHS"];
const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("0007", "Telah Dikarunai Anak", "data_teks"),
  D("1006", "Tempat tinggal setelah menikah", "data_teks"),
  D("2004", "Pekerjaan terakhir Tergugat", "data_teks"),
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
]);
const PENANDA = ["0001", "0046", "0007", "1006", "2004", "0033"];

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const PK = (nomor: string, id: string, sidang: unknown[], extra: Record<string, unknown> = {}) => ({
  nomorPerkara: `${nomor}/Pdt.G/2026/PA.Dgl`, perkaraId: id, jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim", "pp", "js"], pihak: { penggugat: [`Penggugat ${nomor} binti Tasbih`], tergugat: [`Tergugat ${nomor} bin Syamsudin`] }, sidang, ...extra,
});
const PERKARA_A = PK("581", "10154", [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI(TGL, "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)", { urutan: 2 })], { sudahPutus: true, tanggalPutusan: TGL });
const PERKARA_B = PK("582", "10155", [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI(TGL, "Pembuktian", "", { urutan: 2 })]);
const PERKARA_C = PK("583", "10156", [SI("2026-10-16", "Sidang Pertama", "", { urutan: 1 })]);
const SEMUA_PERKARA = [PERKARA_A, PERKARA_B, PERKARA_C];
const NOMOR_DARI_ID: Record<string, string> = { "10154": "581/Pdt.G/2026/PA.Dgl", "10155": "582/Pdt.G/2026/PA.Dgl", "10156": "583/Pdt.G/2026/PA.Dgl" };

type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
  js: { nama: "JS Satu", peran: "Juru Sita", roleId: "jurusita", golonganMenu: ["jurusita"] },
  ptsp: { nama: "Meja PTSP", peran: "PTSP", roleId: "ptsp", golonganMenu: ["ptsp"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};
const AKUN = { hakim: ["Hakim Satu"], pp: ["PP Satu"], js: ["JS Satu"] };

/** Menu ABT disaring per akun (seperti ABT sungguhan): folder PTSP hanya bagi PTSP/admin. */
const menuUntuk = (orang: string) =>
  `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel">` +
  `<a href="${BERANDA}?a=D1&c=" title="(2 Blangko)">Putusan CG</a><a href="${BERANDA}?a=D2&c=" title="(2 Blangko)">BAS CG</a>` +
  `<a href="${BERANDA}?a=D3&c=" title="(1 Blangko)">Relaas</a>${orang === "ptsp" || orang === "admin" ? `<a href="${BERANDA}?a=D4&c=" title="(4 Blangko)">Form Bantu PTSP</a>` : ""}</div>`;
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");
const POPUP = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>581/Pdt.G/2026/PA.Dgl</b>` +
  (tipe === "data_tanggal" ? `<input type='text' id='tgl_form' value='${nilai}'>` : `<textarea id="value" ${tipe === "data_sql" ? "readonly" : ""}>${nilai}</textarea>`);

const HEADER_PENANDA =
  "{\\header \\trowd \\trql \\trgaph0 \\trrh402 \\trleft-108 \\tpvpg \\tphpg \\tposx1488 \\tposy1083 \\tabsnoovrlp1 \\clvertalt \\cltxlrtb \\clwWidth3580 \\cellx3472 " +
  "\\pard \\plain \\ql \\li0 \\ri0 \\intbl \\itap1 \\fs22 {\\b1 \\fs2 \\super1 15 Oktober 2026 Kantor Hukum Uji Contoh}{\\b1 \\fs2 \\super1 \\cell }" +
  "\\pard \\plain \\li0 \\ri0 \\intbl \\itap1 \\fs22 {\\trowd \\trql \\trgaph0 \\trrh402 \\trleft-108 \\clwWidth3580 \\cellx3472 \\row }\\pard \\plain \\s23 \\li0 \\ri0 \\itap0 \\fs22 {\\fs22 \\par }}";
const rtfPerkara = (nomor: string) =>
  `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}}{\\colortbl;\\red0\\green0\\blue0;}${HEADER_PENANDA}` +
  `\\pard\\qc\\b NASKAH\\b0\\par\\pard\\qc Nomor ${nomor}\\par\\pard\\qj Menimbang, bahwa perkara ${nomor} telah diperiksa;\\par\\pard\\ql Hakim Satu, S.H.\\par}`;

type Usulan = Record<string, unknown>;
type Minta = { url: string; cara: string; badan: string };
type Opsi = {
  orang?: string;
  abtAwal?: Record<string, string>;
  usulan?: Usulan[];
  perkara?: unknown[];
  /** perkaraId yang naskahnya gagal diminta dari ABT (preview 500). */
  naskahGagal?: string[];
  /** PDF gabungan: false = rute pdf-gabung belum ada di server (404). */
  gabungAda?: boolean;
  ttd?: { baris: unknown[]; akunId: string };
  relaas?: unknown;
};
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; pdfRtf: string[]; pratinjau: string[]; gabung: number[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Opsi = {}): Halaman {
  const menuHalaman = menuUntuk(p.orang ?? "hakim");
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Panitera</div></div><div id="wrapper"><div id="navbar">${menuHalaman}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const latar: Array<Record<string, unknown>> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.15" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (pesan: Record<string, unknown>, cb?: (h: unknown) => void) => { latar.push(polos(pesan)); if (cb) cb({ ok: true, id: 1 }); }, lastError: undefined },
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
  const pdfRtf: string[] = [];
  const pratinjau: string[] = [];
  const gabung: number[] = [];
  const orang = ORANG[p.orang ?? "hakim"];
  const daftarPerkara = (p.perkara ?? SEMUA_PERKARA) as typeof SEMUA_PERKARA;
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const nilaiDari = (kode: string[]) => {
    const n: Record<string, unknown> = {};
    for (const k of kode) {
      const v = abt[k] !== undefined && abt[k] !== "" ? { status: "terisi", teks: abt[k], nama: "", sebab: "" } : k === "0001" ? { status: "terisi", teks: "581/Pdt.G/2026/PA.Dgl", nama: "", sebab: "" } : k === "0046" ? { status: "terisi", teks: "Penggugat", nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" };
      n[k] = statusNilaiLayar(v, false);
    }
    return n;
  };
  const dalamRentang = (dari: string, sampai: string) =>
    daftarPerkara
      .map((x) => ({ ...x, sidang: (x.sidang as Array<{ tanggal: string }>).filter((s) => s.tanggal >= dari && s.tanggal <= sampai) }))
      .filter((x) => x.sidang.length > 0);
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    let badanMinta = "";
    if (typeof opsi?.body === "string") badanMinta = opsi.body;
    else if (opsi?.body && typeof (opsi.body as URLSearchParams).toString === "function") badanMinta = String(opsi.body);
    minta.push({ url, cara, badan: badanMinta });
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, id: p.ttd?.akunId ?? "u-1", kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const q = new URL(url, ASAL).searchParams;
      const admin = p.orang === "admin";
      const peranKunci = { hakim: "hakim", pp: "pp", js: "js", ptsp: "" }[p.orang ?? "hakim"] ?? "";
      const semua = admin || (q.get("massal") === "ptsp" && p.orang === "ptsp") || (q.get("massal") === "bas" && p.orang === "pp");
      const rentang = dalamRentang(q.get("dari") || TGL, q.get("sampai") || TGL).map((x) => ({ ...x, sebagai: semua ? (admin ? ["hakim", "pp", "js"] : p.orang === "pp" ? ["pp"] : []) : [peranKunci] }));
      return json({ ok: true, data: { hariIni: TGL, mode: "rentang", dari: q.get("dari"), sampai: q.get("sampai"), lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: rentang.length, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos(rentang) } });
    }
    if (url.includes("/aleta-ecourt/sidang?dari=")) {
      const q = new URL(url, ASAL).searchParams;
      const rek = (nomor: string) =>
        nomor.startsWith("581")
          ? { sumberTeks: "alasan-tunda", teksDasar: "putus DIKABULKAN (verstek)", putusan: [{ berkas: `${BLANGKO_PUT}.rtf`, menu: "Putusan CG", utama: true, alasan: "putusan verstek" }], bas: [{ berkas: `${BLANGKO_BAS}.rtf`, menu: "BAS CG", utama: true, alasan: "BAS sidang putusan" }], relaas: [] }
          : nomor.startsWith("582")
            ? { sumberTeks: "agenda", teksDasar: "Pembuktian", putusan: [], bas: [{ berkas: `${BLANGKO_BAS_1}.rtf`, menu: "BAS CG", utama: true, alasan: "BAS pembuktian" }], relaas: [] }
            : { sumberTeks: "", teksDasar: "", putusan: [], bas: [], relaas: [] };
      const baris = dalamRentang(q.get("dari") || TGL, q.get("sampai") || TGL).flatMap((x) => (x.sidang as Array<{ sidangId: string; tanggal: string }>).map((s) => ({ nomorPerkara: x.nomorPerkara, sidangId: s.sidangId, tanggalSidang: s.tanggal, rekomendasiBlangko: rek(x.nomorPerkara) })));
      return json({ ok: true, data: { sidang: baris } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [] } } });
    if (url.includes("/aleta-ecourt/sidang/skors?")) return json({ ok: true, data: { available: true, ok: true, riwayat: [], kalimatBas: "" } });
    if (url.includes("/aleta-ecourt/konseptor-langkah")) return json({ ok: true, data: { ada: true, peta: {}, drafH7: {}, keadaanTerbaca: true } });
    if (url.includes("/aleta-ecourt/blangko-derry/set-saksi")) return json({ ok: true, data: { ada: false } });
    if (url.includes("/aleta-ecourt/blangko-derry?hak=1")) return json({ ok: true, data: { saklar: { hakimBas: false, ppPutusan: false }, folder: [] } });
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") {
        return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [{ nama: "1 Perceraian CG", jenis: "put", berkas: [`${BLANGKO_PUT}.rtf`, `${BLANGKO_PUT_2}.rtf`] }, { nama: "ALUR 02 Cerai Verstek 2 Sidang", jenis: "bas", berkas: [`${BLANGKO_BAS}.rtf`, `${BLANGKO_BAS_1}.rtf`] }, { nama: "98 Relaas", jenis: "rel", berkas: [`${BLANGKO_REL}.rtf`] }, { nama: "99 PTSP", jenis: "ptsp", berkas: PTSP.map((x) => `${x}.rtf`) }], sumber: "pohon", sebab: "" } });
      }
      const berkas = q.get("berkas") || "";
      const s = susunIsian(PENANDA, KATALOG, { P: q.get("sebutanP") || "Penggugat", T: q.get("sebutanT") || "Tergugat" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${berkas}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") ? nilaiDari(kode) : undefined, nilaiAda: Boolean(q.get("perkaraId")), nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/usulan")) {
      const sumber = (() => {
        try {
          return String(JSON.parse(badanMinta).sumber || "");
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
    if (url.includes("/aleta-ecourt/relaas-massal/cetak")) return json({ ok: true, data: polos(p.relaas ?? { ok: true, tanggal: TGL, dokumen: [], tidakPerlu: [], tertunda: [], ringkas: {}, catatan: [] }) });
    if (url.includes("/aleta-ecourt/pemetaan-blangko")) return json({ ok: false }, 404);
    if (url.includes("/aleta-bot/abt/pdf")) {
      const b = JSON.parse(badanMinta || "{}");
      pdfRtf.push(Buffer.from(String(b.rtfBase64 || ""), "base64").toString("latin1"));
      return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from(`%PDF-1.4 uji ${pdfRtf.length}`).toString("base64"), byte: 12 } });
    }
    if (url.includes("/aleta-ecourt/pdf-gabung")) {
      if (p.gabungAda === false) return json({ ok: false }, 404);
      const b = JSON.parse(badanMinta || "{}");
      gabung.push((b.pdfBase64 || []).length);
      return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from(`%PDF-GABUNGAN ${(b.pdfBase64 || []).length}`).toString("base64"), halaman: (b.pdfBase64 || []).length } });
    }
    if (/\/aleta-ecourt\/tanda-tangan\/\d+\/gambar/.test(url)) return new Response(new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")), { status: 200, headers: { "content-type": "image/png" } });
    if (url.includes("/aleta-ecourt/tanda-tangan")) return p.ttd ? json({ ok: true, baris: p.ttd.baris }) : json({ ok: false, alasan: "tidak berwenang" }, 403);
    // ABT
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${menuHalaman}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK("Putusan Cerai Gugat", [[BLANGKO_PUT, "A01", "B01"], [BLANGKO_PUT_2, "A02", "B02"]]));
    if (url.startsWith(`${BERANDA}?a=D2`)) return html(HAL_KELOMPOK("BAS Alur 02", [[BLANGKO_BAS, "A11", "B11"], [BLANGKO_BAS_1, "A12", "B12"]]));
    if (url.startsWith(`${BERANDA}?a=D3`)) return html(HAL_KELOMPOK("Relaas", [[BLANGKO_REL, "A21", "B21"]]));
    if (url.startsWith(`${BERANDA}?a=D4`)) return html(HAL_KELOMPOK("Form Bantu PTSP", PTSP.map((n, i) => [n, `A3${i}`, `B3${i}`] as [string, string, string])));
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    if (url.startsWith(`${ABT}/edit_data?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      if (cara === "POST") {
        abt[kode] = String(new URLSearchParams(badanMinta).get("value") || "");
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      if (kode === "0050") return html(POPUP(kode, "multi_sidang", "2"));
      return html(POPUP(kode, KATALOG.get(kode)?.jenis || "data_teks", abt[kode] || ""));
    }
    if (url.startsWith(`${ABT}/preview?`)) {
      const id = new URL(url).searchParams.get("c") || "";
      pratinjau.push(id);
      if (p.naskahGagal?.includes(id)) return new Response("galat", { status: 500 });
      return new Response(rtfPerkara(NOMOR_DARI_ID[id] || id), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="${id}.rtf"` } });
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
  w.aletaBlangkoDerryMassal.atur({ jedaMs: 0 });
  return { dom, w, simpanan, minta, latar, abt, pdfRtf, pratinjau, gabung };
}

const D_ = (h: Halaman) => h.w.document as Document;
const akar = (h: Halaman) => D_(h).getElementById("aleta-bd-akar") as HTMLElement;
const q = (h: Halaman, s: string) => akar(h).querySelector(s) as HTMLElement | null;
const qq = (h: Halaman, s: string) => Array.from(akar(h).querySelectorAll(s)) as HTMLElement[];
const mintaKe = (h: Halaman, pola: RegExp, cara?: string) => h.minta.filter((m) => pola.test(m.url) && (!cara || m.cara === cara));
const massal = (h: Halaman) => h.w.aletaBlangkoDerryMassal;
const nomorBaris = (h: Halaman) => qq(h, ".bd-ms-baris .bd-ms-no").map((x) => x.textContent);
const statusBaris = (h: Halaman, nomor: string) => (qq(h, ".bd-ms-baris").find((b) => (b.querySelector(".bd-ms-no")?.textContent || "") === nomor)?.querySelector(".bd-ms-chip")?.textContent || "").trim();
const rincianBaris = (h: Halaman, nomor: string) => (qq(h, ".bd-ms-baris").find((b) => (b.querySelector(".bd-ms-no")?.textContent || "") === nomor)?.querySelector(".bd-ms-st small")?.textContent || "").trim();

async function siap(h: Halaman) {
  await sampai(() => h.w.aletaBlangkoDerry.keadaan().peran.length, "peran terbaca");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]") || q(h, "#bd-massal"), "tampilan terbuka");
  await tunggu(30);
}
/** Membuka jendela Cetak massal dan menunggu daftar (tanggal disetel ke TGL). */
async function bukaMassal(h: Halaman, jenis?: string) {
  await siap(h);
  (q(h, "#bd-massal") as HTMLElement).click();
  await sampai(() => q(h, "#bd-ms-tgl"), "jendela terbuka");
  if (jenis) {
    const sel = q(h, "#bd-ms-jenis") as HTMLSelectElement;
    sel.value = jenis;
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
  }
  await ubahTanggal(h, TGL);
}
async function ubahTanggal(h: Halaman, tgl: string) {
  const t = q(h, "#bd-ms-tgl") as HTMLInputElement;
  t.value = tgl;
  t.dispatchEvent(new h.w.Event("change", { bubbles: true }));
  await sampai(() => !q(h, ".bd-ms-kotak > .bd-catat[role=status]") && D_(h).getElementById("bd-ms-tgl") && (h.w.aletaBlangkoDerryMassal.keadaan().tanggal === tgl), "tanggal diterapkan");
  await sampai(() => !/Membaca daftar/.test(akar(h).textContent || ""), "daftar selesai dimuat");
}
const klik = (h: Halaman, s: string) => {
  const el = q(h, s);
  if (!el) throw new Error(`tidak ada: ${s}`);
  el.click();
};
/** Menyimpan markup akar untuk tangkapan layar Playwright (ALETA_TANGKAP_MASSAL=<awalan>); tanpa variabel: tidak melakukan apa pun. */
const tangkap = (h: Halaman, nama: string) => {
  if (process.env.ALETA_TANGKAP_MASSAL) writeFileSync(`${process.env.ALETA_TANGKAP_MASSAL}-${nama}.html`, akar(h).outerHTML);
};
const dariDataUrl = (alamat: string) => Buffer.from(alamat.split(",")[1], "base64");
/** Membaca ZIP (STORE) -> { nama: isi }. */
function bacaZip(buf: Buffer): Record<string, string> {
  const hasil: Record<string, string> = {};
  let o = 0;
  while (buf.readUInt32LE(o) === 0x04034b50) {
    const metode = buf.readUInt16LE(o + 8);
    const ukuran = buf.readUInt32LE(o + 18);
    const n = buf.readUInt16LE(o + 26);
    const e = buf.readUInt16LE(o + 28);
    const nama = buf.subarray(o + 30, o + 30 + n).toString("utf8");
    const isi = buf.subarray(o + 30 + n + e, o + 30 + n + e + ukuran);
    hasil[nama] = (metode === 8 ? inflateRawSync(isi) : isi).toString("latin1");
    o += 30 + n + e + ukuran;
  }
  return hasil;
}
const unduhan = (h: Halaman) => h.latar.filter((m) => m.jenis === "unduh") as Array<{ nama: string; alamat: string }>;

// ============================================================================
describe("A. tombol Cetak massal di ujung kanan langkah 1, isi menurut peran", () => {
  it("tombol ada di kepala langkah 1 (sesudah Ganti perkara), tampil bagi peran berhak", async () => {
    const h = buka();
    await siap(h);
    const t = q(h, "#bd-t1 .bd-tk #bd-massal") as HTMLButtonElement;
    expect(t).not.toBeNull();
    expect(t.hidden).toBe(false);
    expect(t.textContent).toBe("Cetak massal");
    const anak = Array.from(q(h, "#bd-t1 .bd-tk")!.children);
    expect(anak[anak.length - 1]).toBe(t); // paling kanan
    expect(baca("blangko-derry.css")).toMatch(/\.bd-massalbtn \{ margin-left: auto;/);
    tangkap(h, "1-tombol");
  });

  it.each([
    ["hakim", ["put"], "Putusan"],
    ["pp", ["bas"], "Berita acara sidang (BAS)"],
    ["js", ["rel"], "Relaas panggilan dan pemberitahuan putusan"],
    ["ptsp", ["ptsp"], "Penetapan awal (PMH, PPP, PJS, PHS)"],
  ])("%s: hanya jenis %j, tanpa pemilih jenis", async (orang, jenis, judul) => {
    const h = buka({ orang });
    await bukaMassal(h);
    expect(massal(h).keadaan().jenis).toBe(jenis[0]);
    expect(Boolean(q(h, "#bd-ms-jenis"))).toBe(false);
    expect(q(h, ".bd-ms-jenis1")!.textContent).toBe(judul);
  });

  it("Super Admin memilih jenis (putusan, BAS, relaas, dan PTSP bila folder PTSP terbuka)", async () => {
    const h = buka({ orang: "admin" });
    await bukaMassal(h);
    const opsi = Array.from((q(h, "#bd-ms-jenis") as HTMLSelectElement).options).map((o) => o.value);
    expect(opsi).toEqual(["put", "bas", "rel", "ptsp"]);
    expect(q(h, ".bd-ms-kepala small")!.textContent).toBe("Super Admin / Admin");
  });

  it("tombol disambungkan lewat api.pasangMassal; kerangka tanpa jendela hanya memberi kabar singkat", async () => {
    expect(baca("blangko-derry.js")).toContain("pasangMassal(fn)");
    expect(baca("manifest.json")).toContain('"blangko-derry-massal.js"');
    expect(readFileSync(path.join(AKAR, "manajemen_surat/scripts/susun-ekstensi.mjs"), "utf8")).toContain('"blangko-derry-massal.js"');
  });
});

describe("B. daftar per tanggal dan centang", () => {
  it("hakim: hanya perkara yang diputus / beragenda putusan pada tanggal itu; kueri memakai tanggal terpilih", async () => {
    const h = buka({ orang: "hakim" });
    await bukaMassal(h);
    expect(nomorBaris(h)).toEqual(["581/Pdt.G/2026"]);
    const kueri = mintaKe(h, /perkara-saya\?/).pop()!.url;
    expect(kueri).toContain("mode=rentang");
    expect(kueri).toContain(`dari=${TGL}`);
    expect(kueri).toContain(`sampai=${TGL}`);
    // Tanggal lain: tidak ada putusan.
    await ubahTanggal(h, "2026-10-16");
    expect(nomorBaris(h)).toEqual([]);
    expect(akar(h).textContent).toContain("Tidak ada perkara yang diputus atau beragenda putusan pada tanggal ini.");
  });

  it("hakim: saringan 'semua sidang hari itu' menampilkan perkara lain yang bersidang", async () => {
    const h = buka({ orang: "hakim" });
    await bukaMassal(h);
    const k = q(h, "#bd-ms-semuasidang") as HTMLInputElement;
    k.checked = true;
    k.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => nomorBaris(h).length === 2, "dua perkara");
    expect(nomorBaris(h)).toEqual(["581/Pdt.G/2026", "582/Pdt.G/2026"]);
  });

  it("PP: BAS semua sidang pada tanggal itu; opsi 'semua perkara' memakai massal=bas", async () => {
    const h = buka({ orang: "pp" });
    await bukaMassal(h);
    expect(nomorBaris(h)).toEqual(["581/Pdt.G/2026", "582/Pdt.G/2026"]);
    expect(mintaKe(h, /perkara-saya\?/).pop()!.url).not.toContain("massal=");
    const k = q(h, "#bd-ms-semua") as HTMLInputElement;
    k.checked = true;
    k.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => mintaKe(h, /perkara-saya\?/).pop()!.url.includes("massal=bas"), "kueri semua");
  });

  it("PTSP: perkara baru (sidang pertama dalam 28 hari) satu baris per penetapan PMH, PPP, PJS, PHS; kueri massal=ptsp", async () => {
    const h = buka({ orang: "ptsp" });
    await bukaMassal(h);
    expect(mintaKe(h, /perkara-saya\?/).pop()!.url).toContain("massal=ptsp");
    expect(mintaKe(h, /perkara-saya\?/).pop()!.url).toContain("sampai=2026-11-12");
    expect(nomorBaris(h)).toEqual(["583/Pdt.G/2026", "583/Pdt.G/2026", "583/Pdt.G/2026", "583/Pdt.G/2026"]);
    expect(qq(h, ".bd-ms-nama").map((x) => x.textContent)).toEqual(["@ 1 - PMH", "@ 0a - PPP", "@ 0b - PJS", "@ 2 - PHS"]);
  });

  it("tidak ada yang tercentang sendiri; 'Pilih semua yang siap' hanya memilih yang punya blangko dan belum ada di SIPP", async () => {
    const h = buka({ orang: "pp", perkara: [PERKARA_A, PK("582", "10155", [SI(TGL, "Pembuktian", "", { urutan: 2, adaBas: true })])] });
    await bukaMassal(h);
    expect(massal(h).keadaan().pilih).toEqual([]);
    expect(qq(h, "[data-mscek]:checked")).toHaveLength(0);
    expect(rincianBaris(h, "582/Pdt.G/2026")).toContain("BAS sidang ini sudah ada di SIPP");
    klik(h, '[data-ms="pilihsiap"]');
    expect(massal(h).keadaan().pilih).toHaveLength(1);
    tangkap(h, "2-daftar-dipilih");
    expect(q(h, "#bd-ms-hitung")!.textContent).toBe("1 dipilih dari 2");
    klik(h, '[data-ms="kosongkan"]');
    expect(massal(h).keadaan().pilih).toEqual([]);
  });

  it("paling banyak 40 dokumen sekali jalan", async () => {
    const banyak = Array.from({ length: 45 }, (_, i) => PK(String(600 + i), String(20000 + i), [SI(TGL, "Pemeriksaan", "", { urutan: 2 })]));
    const h = buka({ orang: "pp", perkara: banyak });
    await bukaMassal(h);
    expect(qq(h, ".bd-ms-baris")).toHaveLength(45);
    klik(h, '[data-ms="pilihsiap"]');
    expect(massal(h).keadaan().pilih.length).toBeLessThanOrEqual(40);
    expect(massal(h).murni.batas).toEqual({ dokumen: 40, jedaMs: 1200 });
  });
});

describe("C. blangko dari mesin saran, dapat diganti per baris", () => {
  it("tiap baris memakai saran Blangko Derry menurut jenis dan keadaan perkara (putusan tidak menyarankan BAS)", async () => {
    const h = buka({ orang: "hakim" });
    await bukaMassal(h);
    expect(qq(h, ".bd-ms-nama").map((x) => x.title)).toEqual([BLANGKO_PUT]);
    expect(massal(h).keadaan().baris[0]).toMatchObject({ berkas: BLANGKO_PUT, kelompok: expect.stringMatching(/Putusan/), status: "menunggu" });
    const pp = buka({ orang: "pp" });
    await bukaMassal(pp);
    expect(qq(pp, ".bd-ms-nama").map((x) => x.title)).toEqual([BLANGKO_BAS, BLANGKO_BAS_1]);
  });

  it("pemilih blangko per baris: mengganti blangko, mencari nama, saran tampil paling atas", async () => {
    const h = buka({ orang: "hakim" });
    await bukaMassal(h);
    klik(h, "[data-msganti]");
    await sampai(() => q(h, ".bd-ms-picker"), "pemilih terbuka");
    expect(q(h, ".bd-ms-picker")!.textContent).toContain("Pilih blangko untuk 581/Pdt.G/2026");
    tangkap(h, "3-pemilih-blangko");
    expect(qq(h, ".bd-ms-pil").map((x) => x.querySelector("span")!.textContent)).toContain("[Kabul] CG - F");
    const cari = q(h, "#bd-ms-cariblangko") as HTMLInputElement;
    cari.value = "[02]";
    cari.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => qq(h, ".bd-ms-pil").length === 1, "terfilter");
    (q(h, ".bd-ms-pil") as HTMLElement).click();
    await sampai(() => !q(h, ".bd-ms-picker"), "pemilih tertutup");
    expect(massal(h).keadaan().baris[0]).toMatchObject({ berkas: BLANGKO_PUT_2, status: "menunggu" });
  });

  it("perkara tanpa saran: 'Belum ada blangko', tidak bisa dicentang sampai blangko dipilih", async () => {
    const h = buka({ orang: "pp", perkara: [PERKARA_C, PK("583", "10156", [SI(TGL, "Konfirmasi", "", { urutan: 2 })])] });
    await bukaMassal(h);
    expect(statusBaris(h, "583/Pdt.G/2026")).toBe("Pilih blangko");
    expect((q(h, "[data-mscek]") as HTMLInputElement).disabled).toBe(true);
    expect(q(h, ".bd-ms-kosong")!.textContent).toBe("Belum ada blangko");
  });
});

describe("D. Isi otomatis semua: tidak menimpa, hanya lewat jalur simpan isian", () => {
  const SIPP: Usulan[] = [
    { kode: "0007", nama: "Anak", nilai: "telah dikaruniai 2 orang anak", keyakinan: "cukup", sumber: [] },
    { kode: "1006", nama: "Tempat tinggal", nilai: "di rumah orang tua Penggugat", keyakinan: "cukup", sumber: [] },
    { kode: "2004", nama: "Pekerjaan", nilai: "petani", keyakinan: "ragu", sumber: [] },
  ];

  it("isian kosong terisi dan tersimpan, yang sudah ada tidak ditimpa, yang ragu tetap saran; status Perlu dicek bila masih ada yang belum terisi", async () => {
    const h = buka({ orang: "hakim", abtAwal: { "1006": "di rumah sendiri" }, usulan: SIPP });
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    klik(h, '[data-ms="isi"]');
    await sampai(() => massal(h).keadaan().jalan === "" && massal(h).keadaan().baris[0].status !== "menunggu", "selesai", 12000);
    expect(h.abt["0007"]).toBe("telah dikaruniai 2 orang anak");
    expect(h.abt["1006"]).toBe("di rumah sendiri");
    expect(mintaKe(h, /edit_data\?no_var=1006/, "POST")).toEqual([]);
    expect(h.abt["2004"]).toBeUndefined();
    // Jalur simpan yang sama dengan ketikan: tipe dibaca (GET) lalu POST aksi=Simpan.
    const simpan = mintaKe(h, /edit_data\?no_var=0007/, "POST");
    expect(simpan).toHaveLength(1);
    expect(simpan[0].badan).toBe("aksi=Simpan&value=telah+dikaruniai+2+orang+anak&var_type=data_teks");
    // Tidak ada tulisan lain selain ke edit_data ABT dan tanpa kata ALETA di muatan.
    for (const m of h.minta.filter((x) => x.cara === "POST" && /edit_data\?/.test(x.url))) expect(`${m.url} ${m.badan}`).not.toMatch(/aleta/i);
    tangkap(h, "4-isi-otomatis");
    expect(statusBaris(h, "581/Pdt.G/2026")).toContain("Perlu dicek");
    expect(rincianBaris(h, "581/Pdt.G/2026")).toMatch(/isian (belum terisi|masih ragu)/);
    expect(akar(h).textContent).toContain("Isian yang sudah ada tidak ditimpa.");
  });

  it("perkara yang sedang dibuka petugas dipulihkan sesudah massal selesai", async () => {
    const h = buka({ orang: "hakim", usulan: SIPP });
    await siap(h);
    (q(h, '[data-pk="581/Pdt.G/2026/PA.Dgl"]') as HTMLElement | null)?.click();
    await tunggu(30);
    (q(h, "#bd-massal") as HTMLElement).click();
    await sampai(() => q(h, "#bd-ms-tgl"), "jendela");
    await ubahTanggal(h, TGL);
    klik(h, '[data-ms="pilihsiap"]');
    klik(h, '[data-ms="isi"]');
    await sampai(() => massal(h).keadaan().jalan === "" && massal(h).keadaan().baris[0].status !== "menunggu", "selesai", 12000);
    expect(h.w.aletaBlangkoDerryIsian.keadaan().pk).toMatchObject({ nomorPerkara: "581/Pdt.G/2026/PA.Dgl" });
  });
});

describe("E. Cetak: ambilRtf per perkara, ZIP RTF / PDF gabungan", () => {
  it("RTF bawaan: satu ZIP berisi satu naskah per perkara, tiap naskah dari ABT milik perkaranya, header penanda dibersihkan", async () => {
    const h = buka({ orang: "pp" });
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    expect((q(h, 'input[name="bd-ms-format"][value="rtf"]') as HTMLInputElement).checked).toBe(true);
    klik(h, '[data-ms="cetak"]');
    await sampai(() => unduhan(h).length === 1 && massal(h).keadaan().jalan === "", "ZIP diunduh", 15000);
    // ambilRtf dipanggil per perkara (preview ABT, bukan main/view).
    expect(h.pratinjau.sort()).toEqual(["10154", "10155"]);
    expect(mintaKe(h, /main\/view/)).toEqual([]);
    const u = unduhan(h)[0];
    expect(u.nama).toBe(`Cetak massal - BAS - ${TGL}.zip`);
    const zip = bacaZip(dariDataUrl(u.alamat));
    expect(Object.keys(zip).sort()).toEqual([`581_Pdt.G_2026_PA.Dgl - ${BLANGKO_BAS}.rtf`, `582_Pdt.G_2026_PA.Dgl - ${BLANGKO_BAS_1}.rtf`].sort());
    const isi581 = zip[`581_Pdt.G_2026_PA.Dgl - ${BLANGKO_BAS}.rtf`];
    expect(isi581).toContain("Nomor 581/Pdt.G/2026/PA.Dgl");
    expect(isi581).not.toContain("Nomor 582");
    expect(isi581).not.toContain("Kantor Hukum Uji Contoh"); // header penanda dibuang
    expect(isi581.startsWith("{\\rtf1")).toBe(true);
    // Ringkasan akhir + status tiap baris + tercatat sebagai sudah dicetak.
    tangkap(h, "6-selesai");
    expect(akar(h).textContent).toContain("2 dari 2 berhasil dicetak.");
    expect(akar(h).textContent).toContain("2 naskah RTF dalam satu ZIP");
    expect(statusBaris(h, "581/Pdt.G/2026")).toMatch(/Sudah dicetak|Perlu dicek/);
    expect(Object.keys(h.simpanan).filter((k) => k.startsWith("blangkoDerryCetakBlangko:"))).toHaveLength(2);
    // Tidak menulis apa pun ke SIPP / ABT selain jalur isian (tak ada isian pada uji ini).
    expect(h.minta.filter((m) => m.cara === "POST" && /sipp/i.test(m.url) && !/aleta/.test(m.url))).toEqual([]);
  });

  it("PDF gabungan: tiap perkara dibuat PDF-nya lalu digabung portal menjadi SATU berkas; tanpa tanda tangan bila tidak dicentang", async () => {
    const h = buka({ orang: "pp" });
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    const pdf = q(h, 'input[name="bd-ms-format"][value="pdf"]') as HTMLInputElement;
    pdf.checked = true;
    pdf.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    (q(h, "#bd-ms-ttd") as HTMLInputElement).checked = false;
    (q(h, "#bd-ms-ttd") as HTMLInputElement).dispatchEvent(new h.w.Event("change", { bubbles: true }));
    klik(h, '[data-ms="cetak"]');
    await sampai(() => massal(h).keadaan().jalan === "", "selesai", 15000);
    await sampai(() => unduhan(h).length === 1 && massal(h).keadaan().jalan === "", "PDF gabungan diunduh", 15000);
    expect(h.pdfRtf).toHaveLength(2);
    expect(h.pdfRtf.every((x) => !x.includes("\\pict"))).toBe(true);
    expect(h.gabung).toEqual([2]);
    expect(unduhan(h)[0].nama).toBe(`Cetak massal - BAS - ${TGL}.pdf`);
    expect(dariDataUrl(unduhan(h)[0].alamat).toString("latin1")).toBe("%PDF-GABUNGAN 2");
    expect(akar(h).textContent).toContain("digabung menjadi satu PDF");
  });

  it("PDF dengan tanda tangan sah dicentang: gambar tanda tangan dibubuhkan pada tiap PDF", async () => {
    const BARIS = [{ id: 11, namaPejabat: "Hakim Satu, S.H.", disahkan: true, penggunaId: "u-hs", disahkanPada: "2026-10-19T01:00:00.000Z" }];
    const h = buka({ orang: "hakim", ttd: { baris: BARIS, akunId: "u-hs" } });
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    const pdf = q(h, 'input[name="bd-ms-format"][value="pdf"]') as HTMLInputElement;
    pdf.checked = true;
    pdf.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect((q(h, "#bd-ms-ttd") as HTMLInputElement).checked).toBe(true);
    klik(h, '[data-ms="cetak"]');
    await sampai(() => unduhan(h).length === 1 && massal(h).keadaan().jalan === "", "PDF diunduh", 15000);
    expect(h.pdfRtf).toHaveLength(1);
    expect(h.pdfRtf[0]).toContain("{\\pict\\pngblip");
    expect(mintaKe(h, /tanda-tangan\/11\/gambar/).length).toBe(1);
  });

  it("penggabung PDF belum ada di server: PDF tiap perkara tetap diberikan dalam satu ZIP", async () => {
    const h = buka({ orang: "pp", gabungAda: false });
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    const pdf = q(h, 'input[name="bd-ms-format"][value="pdf"]') as HTMLInputElement;
    pdf.checked = true;
    pdf.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    (q(h, "#bd-ms-ttd") as HTMLInputElement).checked = false;
    (q(h, "#bd-ms-ttd") as HTMLInputElement).dispatchEvent(new h.w.Event("change", { bubbles: true }));
    klik(h, '[data-ms="cetak"]');
    await sampai(() => unduhan(h).length === 1 && massal(h).keadaan().jalan === "", "ZIP PDF diunduh", 15000);
    expect(unduhan(h)[0].nama).toBe(`Cetak massal - BAS - ${TGL}.zip`);
    expect(Object.keys(bacaZip(dariDataUrl(unduhan(h)[0].alamat))).every((n) => n.endsWith(".pdf"))).toBe(true);
    expect(akar(h).textContent).toContain("PDF tidak dapat digabung");
  });

  it("Cetak tidak jalan tanpa centang dan menolak lebih dari 40", async () => {
    const h = buka({ orang: "pp" });
    await bukaMassal(h);
    expect((q(h, '[data-ms="cetak"]') as HTMLButtonElement).disabled).toBe(true);
    expect((q(h, '[data-ms="isi"]') as HTMLButtonElement).disabled).toBe(true);
    expect(h.pratinjau).toEqual([]);
  });
});

describe("F. gagal satu tidak menghentikan yang lain", () => {
  it("naskah satu perkara gagal diminta: yang lain tetap dicetak, ringkasan menyebut yang gagal, yang gagal tercentang kembali", async () => {
    const h = buka({ orang: "pp", naskahGagal: ["10154"] });
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    klik(h, '[data-ms="cetak"]');
    await sampai(() => massal(h).keadaan().jalan === "" && unduhan(h).length === 1, "selesai", 15000);
    expect(h.pratinjau.sort()).toEqual(["10154", "10155"]);
    const zip = bacaZip(dariDataUrl(unduhan(h)[0].alamat));
    expect(Object.keys(zip)).toEqual([`582_Pdt.G_2026_PA.Dgl - ${BLANGKO_BAS_1}.rtf`]);
    tangkap(h, "5-ringkasan-gagal");
    expect(statusBaris(h, "581/Pdt.G/2026")).toContain("Gagal");
    expect(rincianBaris(h, "581/Pdt.G/2026")).toMatch(/ABT menjawab 500/);
    expect(akar(h).textContent).toContain("1 dari 2 berhasil dicetak. 1 gagal.");
    expect(akar(h).textContent).toContain("Perkara yang gagal tercentang kembali");
    expect(massal(h).keadaan().pilih).toHaveLength(1);
    expect(massal(h).keadaan().baris.find((b: { nomor: string }) => b.nomor.startsWith("581")).status).toBe("gagal");
  });

  it("semua gagal: tidak ada berkas diunduh, ringkasan tetap tampil", async () => {
    const h = buka({ orang: "pp", naskahGagal: ["10154", "10155"] });
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    klik(h, '[data-ms="cetak"]');
    await sampai(() => massal(h).keadaan().jalan === "" && /0 dari 2 berhasil dicetak/.test(akar(h).textContent || ""), "selesai", 15000);
    expect(unduhan(h)).toEqual([]);
  });
});

describe("G. relaas dari fungsi bersama jurusita.js (bukan rumus baru)", () => {
  it("juru sita: daftar dan blangko datang dari jurusitaAmbilDaftarRelaas/jurusitaDokumenBarisMassal; nomor sidang panggilan jadi d", async () => {
    const dokumen = [
      {
        kunci: "sidang-ditunda:10154:2:1", perkaraId: 10154, nomorPerkara: "581/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, jenisPerkaraId: 351, golongan: "sidang-ditunda", sebabMasuk: "ditunda",
        d: 2, sidangId: "s2026-10-22", tanggalSidangTujuan: "2026-10-22", sidangAsalId: "s2026-10-15", dihadiriOleh: 2, pihakDipanggil: "pertama", pihakKe: null,
        jurusita: { nama: "JS Satu", nip: "1", dariPenunjukan: true }, sudahAdaRelaas: false, lewatEcourt: false,
        blangko: { berkas: `${BLANGKO_REL}.rtf`, label: "Relaas panggilan sidang lanjutan P" }, bisaDicetak: true, sebabTidakBisa: "", peringatan: [], ikutPilihSemua: true,
      },
    ];
    const h = buka({ orang: "js", relaas: { ok: true, tanggal: TGL, dokumen, tidakPerlu: [], tertunda: [], ringkas: {}, catatan: [] } });
    await bukaMassal(h);
    expect(mintaKe(h, /relaas-massal\/cetak\?tanggal=2026-10-15/)).toHaveLength(1);
    expect(nomorBaris(h)).toEqual(["581/Pdt.G/2026"]);
    expect(qq(h, ".bd-ms-nama").map((x) => x.title)).toEqual([BLANGKO_REL]);
    klik(h, '[data-ms="pilihsiap"]');
    expect(massal(h).keadaan().pilih).toHaveLength(1);
    klik(h, '[data-ms="cetak"]');
    await sampai(() => unduhan(h).length === 1 && massal(h).keadaan().jalan === "", "ZIP relaas", 15000);
    // ABT dipanggil dengan d = urutan sidang yang dipanggil (2).
    const prev = mintaKe(h, /preview\?/).pop()!.url;
    expect(new URL(prev).searchParams.get("d")).toBe("2");
    expect(new URL(prev).searchParams.get("c")).toBe("10154");
    expect(unduhan(h)[0].nama).toBe(`Cetak massal - Relaas - ${TGL}.zip`);
  });
});

describe("H. pembantu murni", () => {
  it("ZIP: tanda tangan berkas, CRC, nama UTF-8, isi utuh (dibaca ulang oleh pembaca ZIP lain)", async () => {
    const m = massal(buka()).murni;
    const a = new TextEncoder().encode("{\\rtf1 isi satu}");
    const b = Uint8Array.from([0, 1, 2, 250, 251, 252, 253]);
    const zip = Buffer.from(m.buatZip([{ nama: "581_Pdt.G - Putusan Ä.rtf", bita: a }, { nama: "dua.bin", bita: b }]));
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2);
    const baca2 = bacaZip(zip);
    expect(baca2["581_Pdt.G - Putusan Ä.rtf"]).toBe("{\\rtf1 isi satu}");
    expect(Buffer.from(baca2["dua.bin"], "latin1")).toEqual(Buffer.from(b));
    expect(m.crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });

  it("namaUnik menambah (2), (3) untuk nama kembar dan membersihkan karakter terlarang", () => {
    const m = massal(buka()).murni;
    const pakai = new Set<string>();
    expect(m.namaUnik("a.rtf", pakai)).toBe("a.rtf");
    expect(m.namaUnik("A.rtf", pakai)).toBe("A (2).rtf");
    expect(m.namaUnik("a.rtf", pakai)).toBe("a (3).rtf");
    expect(m.namaUnik("x/y:z.rtf", pakai)).toBe("x_y_z.rtf");
  });

  it("barisDariPerkara: putusan, BAS, PTSP menurut tanggal; penilai keadaan", () => {
    const m = massal(buka()).murni;
    const p = [{ ...PERKARA_A, sebagai: ["hakim"] }, { ...PERKARA_B, sebagai: ["hakim"] }, { ...PERKARA_C, sebagai: ["hakim"] }];
    expect(m.barisDariPerkara("put", p, TGL, {}).map((b: { nomor: string }) => b.nomor)).toEqual(["581/Pdt.G/2026/PA.Dgl"]);
    expect(m.barisDariPerkara("put", p, TGL, { semuaSidang: true })).toHaveLength(2);
    expect(m.barisDariPerkara("bas", p, TGL, {})).toHaveLength(0); // peran PP bukan hakim
    expect(m.barisDariPerkara("bas", p, TGL, { abaikanPeran: true })).toHaveLength(2);
    // Putusan lewat tanggalPutusan walau agenda sidang tak menyebut putus.
    const lain = { ...PERKARA_B, tanggalPutusan: TGL, sebagai: ["hakim"] };
    expect(m.barisDariPerkara("put", [lain], TGL, {})).toHaveLength(1);
    expect(m.nilaiKeadaan({ kosongPenting: [], ragu: 0, gagalSimpan: 0, penandaSisa: 0 })).toEqual({ status: "siap", catatan: "" });
    const n = m.nilaiKeadaan({ kosongPenting: ["a", "b", "c", "d"], ragu: 2, gagalSimpan: 1, penandaSisa: 3 });
    expect(n.status).toBe("cek");
    expect(n.catatan).toContain("4 isian belum terisi (a, b, c, …)");
    expect(n.catatan).toContain("2 isian masih ragu");
    expect(n.catatan).toContain("3 bagian naskah belum terisi");
  });

  it("rute perkara-saya: ?massal=ptsp mengembalikan semua perkara satker tanpa kata kunci; tanpa itu tetap tertutup", () => {
    const baris: BarisSidangSaya[] = [
      { perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-16", majelisNama: "X", paniteraNama: "Y", jurusitaNama: "Z", urutanSidang: 1 },
      { perkaraId: 2, nomorPerkara: "2/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-16", majelisNama: "X", paniteraNama: "Y", jurusitaNama: "Z", urutanSidang: 1 },
    ];
    const dasar = { hariIni: TGL, nama: "Meja PTSP", lihatSemua: false, cariNomorSatker: true, cariNomor: "" };
    expect(susunPerkaraSaya(baris, dasar).perkara).toHaveLength(0);
    expect(susunPerkaraSaya(baris, { ...dasar, semuaSatker: true }).perkara).toHaveLength(2);
    expect(susunPerkaraSaya(baris, { ...dasar, semuaSatker: true }).perkara[0].sebagai).toEqual([]);
    // Panitera (BAS semua): peran PP untuk semua perkara.
    expect(susunPerkaraSaya(baris, { hariIni: TGL, nama: "Panitera", lihatSemua: true, bolehLihatSebagai: false, peranSemua: ["pp"] }).perkara.map((x) => x.sebagai)).toEqual([["pp"], ["pp"]]);
  });

  it("penggabung PDF sisi portal: urutan terjaga, satu berkas rusak tidak menggagalkan yang lain", async () => {
    const buat = async (halaman: number) => {
      const d = await PDFDocument.create();
      for (let i = 0; i < halaman; i += 1) d.addPage([200, 200]);
      return await d.save();
    };
    const hasil = await gabungkanPdf([await buat(1), new Uint8Array([1, 2, 3]), await buat(2)]);
    expect(hasil.halaman).toBe(3);
    expect(hasil.gagal).toEqual([1]);
    expect((await PDFDocument.load(hasil.pdf)).getPageCount()).toBe(3);
    await expect(gabungkanPdf([new Uint8Array([9])])).rejects.toThrow("Tidak ada PDF");
  });
});

// ============================================================================
// I. K15 (rantai B, 25 Okt 2026) - antrean cetak massal disalin ke server; yang terputus ditawarkan lagi
// ============================================================================
type CatatanAntrean = { jenis: string; kunci: string; data: any; opsi: any };
function antreanServerTiruan(opsi: { aktif?: boolean; tertinggal?: any[] } = {}) {
  const catatan: CatatanAntrean[] = [];
  const akhir: Array<{ jenis: string; kunci: string; status: string }> = [];
  return {
    catatan,
    akhir,
    obyek: {
      tungguSiap: async () => undefined,
      aktif: () => opsi.aktif !== false,
      catat: async (jenis: string, kunci: string, data: any, o: any) => (catatan.push({ jenis, kunci, data, opsi: o }), true),
      akhiri: async (jenis: string, kunci: string, status: string) => (akhir.push({ jenis, kunci, status }), true),
      tertinggal: async () => opsi.tertinggal ?? [],
    },
  };
}
const TERPUTUS = (butir: Array<{ nomor: string; berkas: string; status: string }>, ubah: Record<string, unknown> = {}) => ({
  jenis: "cetak-massal",
  kunci: `bas|${TGL}`,
  perangkat: "pc-lain",
  ringkas: "x",
  selesai: butir.filter((b) => b.status === "selesai").length,
  total: butir.length,
  diubahPada: "2026-10-25T01:00:00.000Z",
  muatan: { jenis: "bas", tanggal: TGL, format: "rtf", ttd: true, butir },
  ...ubah,
});

describe("I. antrean cetak massal di server (K15)", () => {
  it("selesai bersih: tiap perkara disalin (nomor, blangko, status - tanpa isi dokumen) lalu salinan ditutup 'selesai'", async () => {
    const h = buka({ orang: "pp" });
    const a = antreanServerTiruan();
    h.w.ALETA_ANTREAN_SERVER = a.obyek;
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    klik(h, '[data-ms="cetak"]');
    await sampai(() => massal(h).keadaan().jalan === "" && unduhan(h).length === 1, "selesai", 15000);
    expect(a.catatan.length).toBeGreaterThanOrEqual(2);
    expect(a.catatan.every((c) => c.jenis === "cetak-massal" && c.kunci === `bas|${TGL}`)).toBe(true);
    const terakhir = a.catatan[a.catatan.length - 1].data;
    expect(terakhir.total).toBe(2);
    expect(terakhir.muatan.butir.map((b: { nomor: string; status: string }) => [b.nomor.slice(0, 3), b.status])).toEqual([["581", "selesai"], ["582", "selesai"]]);
    // keadaan saja: tidak ada RTF/NIK/nama pihak dalam muatan
    const teks = JSON.stringify(a.catatan.map((c) => c.data));
    expect(teks).not.toMatch(/rtf1|Penggugat|Tergugat|binti|bin /);
    expect(a.akhir).toEqual([{ jenis: "cetak-massal", kunci: `bas|${TGL}`, status: "selesai" }]);
  });

  it("ada yang gagal: salinan TIDAK ditutup dan keadaan terakhir disalin segera (supaya dapat dilanjutkan)", async () => {
    const h = buka({ orang: "pp", naskahGagal: ["10154"] });
    const a = antreanServerTiruan();
    h.w.ALETA_ANTREAN_SERVER = a.obyek;
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    klik(h, '[data-ms="cetak"]');
    await sampai(() => massal(h).keadaan().jalan === "" && unduhan(h).length === 1, "selesai", 15000);
    expect(a.akhir).toEqual([]);
    const akhirCatat = a.catatan[a.catatan.length - 1];
    expect(akhirCatat.opsi).toEqual({ segera: true });
    expect(akhirCatat.data.muatan.butir.map((b: { nomor: string; status: string }) => [b.nomor.slice(0, 3), b.status])).toEqual([["581", "gagal"], ["582", "selesai"]]);
    expect(akhirCatat.data.selesai).toBe(1);
  });

  it("antrean terputus untuk jenis + tanggal yang sama: HANYA perkara yang belum selesai dicentang kembali, dengan catatan; tidak jalan sendiri", async () => {
    const h = buka({ orang: "pp" });
    const a = antreanServerTiruan({
      tertinggal: [TERPUTUS([{ nomor: "581/Pdt.G/2026/PA.Dgl", berkas: BLANGKO_BAS, status: "selesai" }, { nomor: "582/Pdt.G/2026/PA.Dgl", berkas: BLANGKO_BAS_1, status: "menunggu" }])],
    });
    h.w.ALETA_ANTREAN_SERVER = a.obyek;
    await bukaMassal(h);
    const k = massal(h).keadaan();
    expect(k.pilih).toHaveLength(1);
    expect(qq(h, "[data-mscek]:checked")).toHaveLength(1);
    expect(akar(h).textContent).toContain("Cetak massal sebelumnya belum selesai");
    expect(akar(h).textContent).toContain("1 dari 2 perkara sudah selesai. 1 yang belum sudah dicentang kembali");
    expect(k.jalan).toBe("");
    expect(unduhan(h)).toEqual([]);
    // setelah Cetak, catatan hilang
    klik(h, '[data-ms="cetak"]');
    await sampai(() => massal(h).keadaan().jalan === "" && unduhan(h).length === 1, "selesai", 15000);
    expect(akar(h).textContent).not.toContain("Cetak massal sebelumnya belum selesai");
  });

  it("tanggal atau jenis lain, atau semua butir sudah selesai, atau saklar server mati: tidak ada yang dicentang", async () => {
    for (const kasus of [
      { tertinggal: [TERPUTUS([{ nomor: "582/Pdt.G/2026/PA.Dgl", berkas: BLANGKO_BAS_1, status: "menunggu" }], { muatan: { jenis: "bas", tanggal: "2026-01-01", format: "rtf", butir: [{ nomor: "582/Pdt.G/2026/PA.Dgl", berkas: "x", status: "menunggu" }] } })] },
      { tertinggal: [TERPUTUS([{ nomor: "582/Pdt.G/2026/PA.Dgl", berkas: BLANGKO_BAS_1, status: "menunggu" }], { muatan: { jenis: "put", tanggal: TGL, format: "rtf", butir: [{ nomor: "582/Pdt.G/2026/PA.Dgl", berkas: "x", status: "menunggu" }] } })] },
      { tertinggal: [TERPUTUS([{ nomor: "581/Pdt.G/2026/PA.Dgl", berkas: BLANGKO_BAS, status: "selesai" }])] },
      { aktif: false, tertinggal: [TERPUTUS([{ nomor: "582/Pdt.G/2026/PA.Dgl", berkas: BLANGKO_BAS_1, status: "menunggu" }])] },
    ]) {
      const h = buka({ orang: "pp" });
      h.w.ALETA_ANTREAN_SERVER = antreanServerTiruan(kasus).obyek;
      await bukaMassal(h);
      expect(massal(h).keadaan().pilih).toEqual([]);
      expect(akar(h).textContent).not.toContain("Cetak massal sebelumnya belum selesai");
    }
  });

  it("tanpa modul antrean-server.js (jalur lama) cetak massal bekerja persis seperti dulu", async () => {
    const h = buka({ orang: "pp" });
    expect(h.w.ALETA_ANTREAN_SERVER).toBeUndefined();
    await bukaMassal(h);
    klik(h, '[data-ms="pilihsiap"]');
    klik(h, '[data-ms="cetak"]');
    await sampai(() => massal(h).keadaan().jalan === "" && unduhan(h).length === 1, "selesai", 15000);
    expect(akar(h).textContent).toContain("2 dari 2 berhasil dicetak.");
  });
});
