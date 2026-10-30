// @vitest-environment node
/**
 * ============================================================================
 * 3.3 "N BAGIAN BERUBAH SEJAK CETAKAN TERAKHIR" dan 3.4 PUSTAKA KALIMAT PRIBADI - layar (30 Okt 2026)
 * ============================================================================
 *
 * Kode ekstensi sungguhan di jsdom (harness sama dengan uji PTSP 28 Okt); rute cetak-terakhir dan kalimat-pribadi ditiru dengan
 * aturan murni yang sama dengan portal (lib/kalimat-pribadi). "Muat ulang" = JSDOM baru dengan ingatan peramban dan server lama.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import path from "node:path";

import { JSDOM } from "jsdom";

import { berlakuUntuk, bersihkanKalimat, terlihatOleh, urutkanKalimat } from "@/lib/kalimat-pribadi";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { jenisDokumenAkun, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { susunPerkaraSaya, type BarisSidangSaya } from "@/app/api/aleta-ecourt/perkara-saya/susun";
import { namaAkunPtsp } from "@/lib/akun-ptsp";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "jurusita.js", "abt-klien.js", "blangko-derry-pulih.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-beda-cetak.js", "blangko-derry-pustaka.js", "blangko-derry-isian.js", "blangko-derry-berkas.js", "blangko-derry-massal.js"].map(baca).join("\n;\n");

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
const PTSP = ["@ 0 - PMH - PHS", "@ 1 - PMH", "@ 0a - PPP", "@ 0b - PJS", "@ 2 - PHS", "@ 4 - Penetapan Penunjukan Mediator"];
const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("0007", "Telah Dikarunai Anak", "data_teks"),
  D("1006", "Tempat tinggal setelah menikah", "data_teks"),
  D("2004", "Pekerjaan terakhir Tergugat", "data_teks"),
  D("8729", "Uraian pertimbangan hakim", "data_teks"),
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
]);
const PENANDA = ["0001", "0046", "0007", "1006", "2004", "8729", "0033"];

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const PK = (nomor: string, id: string, sidang: unknown[], extra: Record<string, unknown> = {}) => ({
  nomorPerkara: `${nomor}/Pdt.G/2026/PA.Dgl`, perkaraId: id, jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim", "pp", "js"], pihak: { penggugat: [`Penggugat ${nomor} binti Tasbih`], tergugat: [`Tergugat ${nomor} bin Syamsudin`] }, sidang, ...extra,
});
const PERKARA_A = PK("581", "10154", [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI(TGL, "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)", { urutan: 2 })], { sudahPutus: true, tanggalPutusan: TGL });
const PERKARA_B = PK("582", "10155", [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI(TGL, "Pembuktian", "", { urutan: 2 })]);
const PERKARA_C = PK("583", "10156", [SI("2026-10-16", "Sidang Pertama", "", { urutan: 1 })]);
const PERKARA_D = PK("584", "10157", [SI(TGL, "Sidang Pertama", "", { urutan: 1 })]);
const SEMUA_PERKARA = [PERKARA_A, PERKARA_B, PERKARA_C, PERKARA_D];
const NOMOR_DARI_ID: Record<string, string> = { "10154": "581/Pdt.G/2026/PA.Dgl", "10155": "582/Pdt.G/2026/PA.Dgl", "10156": "583/Pdt.G/2026/PA.Dgl", "10157": "584/Pdt.G/2026/PA.Dgl" };

type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
  js: { nama: "JS Satu", peran: "Juru Sita", roleId: "jurusita", golonganMenu: ["jurusita"] },
  ptsp: { nama: "Meja PTSP", peran: "PTSP", roleId: "ptsp", golonganMenu: ["ptsp"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};
const AKUN = { hakim: ["Hakim Satu"], pp: ["PP Satu"], js: ["JS Satu"], ptsp: ["Meja PTSP"] };

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
  `\\pard\\qc\\b NASKAH\\b0\\par\\pard\\qc Nomor ${nomor}\\par\\pard\\qj Menimbang, bahwa perkara ${nomor} telah diperiksa;\\par\\pard\\qj Tempat tinggal: ${(globalThis as any).__tempat ?? "-"}\\par\\pard\\ql Hakim Satu, S.H.\\par}`;

type Usulan = Record<string, unknown>;
type Minta = { url: string; cara: string; badan: string };
const sampulNaskah: Array<Record<string, any>> = [];
const gudang: { cetak: Map<string, any>; kalimat: any[]; panggilan: any[] } = { cetak: new Map(), kalimat: [], panggilan: [] };
const sampulFakta: string[] = [];
type Opsi = {
  /** perkaraId yang bahan sampulnya gagal dibaca bot. */
  sampulGagal?: string[];
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
  /** Portal lama: daftar akun tanpa kelompok PTSP. */
  akunLama?: boolean;
};
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; pdfRtf: string[]; pdfTtd: Array<Array<{ nama: string }>>; pratinjau: string[]; gabung: number[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Opsi = {}, awal?: { sesi?: Record<string, string>; simpanan?: Record<string, unknown>; hash?: string }): Halaman {
  const menuHalaman = menuUntuk(p.orang ?? "hakim");
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Panitera</div></div><div id="wrapper"><div id="navbar">${menuHalaman}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA + (awal?.hash ?? ""), runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ...(awal?.simpanan ?? {}) };
  for (const [k, v] of Object.entries(awal?.sesi ?? {})) dom.window.sessionStorage.setItem(k, v);
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
  const pdfTtd: Array<Array<{ nama: string }>> = [];
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
      const sebagaiPtsp = admin && q.get("peranSebagai") === "ptsp" && Boolean(q.get("sebagai"));
      const ptsp = p.orang === "ptsp" || sebagaiPtsp;
      const semua = admin || (q.get("massal") === "ptsp" && p.orang === "ptsp") || (q.get("massal") === "bas" && p.orang === "pp");
      const sasaran = dalamRentang(q.get("mode") === "semua" ? "2000-01-01" : q.get("dari") || TGL, q.get("mode") === "semua" ? "2100-01-01" : q.get("sampai") || TGL);
      let rentang: any[];
      if (ptsp) {
        // Rute: PTSP hanya menerima daftar satker lewat sidangPertama=1 / massal=ptsp / nomor (baca saja, sebagai kosong).
        const nomor = (q.get("nomor") || "").trim();
        const pertama = q.get("sidangPertama") === "1";
        const lengkap = q.get("massal") === "ptsp";
        const terpilih = nomor ? sasaran.filter((x) => x.nomorPerkara.includes(nomor)) : pertama ? sasaran.filter((x) => (x.sidang as unknown as Array<{ urutan: number }>).some((s) => (s.urutan || 1) <= 1)) : lengkap ? sasaran : [];
        rentang = terpilih.map((x) => ({ ...x, sebagai: [] }));
      } else rentang = sasaran.map((x) => ({ ...x, sebagai: semua ? (admin ? ["hakim", "pp", "js"] : p.orang === "pp" ? ["pp"] : []) : [peranKunci] }));
      return json({ ok: true, data: { hariIni: TGL, mode: "rentang", dari: q.get("dari"), sampai: q.get("sampai"), lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, ptspCari: ptsp, terpotong: false, jumlahSemua: rentang.length, adaYangCocok: true, akun: admin ? (p.akunLama ? { hakim: AKUN.hakim, pp: AKUN.pp, js: AKUN.js } : AKUN) : null, perkara: polos(rentang) } });
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
    if (url.includes("/aleta-ecourt/sampul-berkas/naskah")) {
      const b = JSON.parse(badanMinta || "{}");
      sampulNaskah.push(b);
      return json({ ok: true, data: { rtfBase64: Buffer.from(`{\\rtf1\\ansi SAMPUL ${b.perkaraId}}`).toString("base64"), kosong: [], mesinGalat: "", lampiran: [] } });
    }
    if (url.includes("/aleta-ecourt/sampul-berkas")) {
      const id = new URL(url, ASAL).searchParams.get("perkaraId") || "";
      sampulFakta.push(id);
      if (p.sampulGagal?.includes(id)) return json({ ok: false, alasan: "Bot ALETA tidak dapat membaca bahan berkas perkara ini." }, 502);
      return json({ ok: true, data: { fakta: { perkara: { perkaraId: Number(id), nomor: NOMOR_DARI_ID[id] || id, jenisId: 347, jenisNama: "Cerai Gugat", jenis: "cg", permohonan: false, berlawanan: true, sebutanP: "Penggugat", sebutanT: "Tergugat" }, jumlahPihak: { p1: 1, p2: 1, p3: 0, p4: 0 }, pihakSemua: [], anak: [], objek: [], riwayatSemua: [], susulan: { oto: {}, gagal: [] }, alasan: { oto: {}, gagal: false }, ciri: {}, isian: {}, upayaHukum: false, dokumen: [] }, sunting: { susunan: {}, tag: {}, isian: {} }, bawaan: {} } });
    }
    if (url.includes("/aleta-ecourt/cetak-terakhir")) {
      if (cara === "POST") {
        const b = JSON.parse(badanMinta || "{}");
        gudang.cetak.set(`${b.perkaraId}|${String(b.berkas).replace(/\.rtf$/i, "").toLowerCase()}`, { ada: true, dicetakPada: new Date().toISOString(), dicetakOleh: "Hakim Satu", bagian: b.bagian });
        return json({ ok: true, data: { disimpan: true, jumlah: (b.bagian || []).length, dicetakPada: new Date().toISOString() } });
      }
      const q = new URL(url, ASAL).searchParams;
      return json({ ok: true, data: gudang.cetak.get(`${q.get("perkaraId")}|${String(q.get("berkas")).replace(/\.rtf$/i, "").toLowerCase()}`) ?? { ada: false } });
    }
    if (url.includes("/aleta-ecourt/kalimat-pribadi")) {
      const saya = "u-1";
      if (cara === "POST") {
        const b = JSON.parse(badanMinta || "{}");
        if (b.aksi === "simpan") {
          const h = bersihkanKalimat(b);
          if (!h.ok) return json({ ok: false, error: { message: h.sebab } }, 400);
          const baru = { pemilikId: saya, pemilikNama: "Hakim Satu", ...h.nilai, id: `kal-${gudang.kalimat.length + 1}-xxxxxxxx`, dipakai: 0, dipakaiTerakhir: "", diubahPada: new Date().toISOString() };
          gudang.kalimat.push(baru);
          gudang.panggilan.push({ aksi: "simpan", isi: baru });
          return json({ ok: true, data: { kalimat: baru } });
        }
        if (b.aksi === "pakai") {
          const k = gudang.kalimat.find((x) => x.id === b.id);
          if (k) k.dipakai += 1;
          gudang.panggilan.push({ aksi: "pakai", id: b.id });
          return json({ ok: true, data: { dicatat: Boolean(k) } });
        }
        if (b.aksi === "hapus") {
          gudang.kalimat = gudang.kalimat.filter((x) => x.id !== b.id);
          gudang.panggilan.push({ aksi: "hapus", id: b.id });
          return json({ ok: true, data: { dihapus: true } });
        }
        return json({ ok: false }, 400);
      }
      const q = new URL(url, ASAL).searchParams;
      const konteks = { jenisPerkara: q.get("jenis") || "", status: q.get("status") || "", kode: q.get("kode") || "" };
      const berlaku = gudang.kalimat.filter((k) => terlihatOleh(k, saya, ["hakim"]) && berlakuUntuk(q.get("semuaKode") === "1" ? { ...k, kode: "" } : k, konteks));
      return json({ ok: true, data: { kalimat: urutkanKalimat(berlaku, saya), golonganBagi: ["hakim", "pp"] } });
    }
    if (url.includes("/aleta-ecourt/pemetaan-blangko")) return json({ ok: false }, 404);
    if (url.includes("/aleta-bot/abt/pdf")) {
      const b = JSON.parse(badanMinta || "{}");
      pdfRtf.push(Buffer.from(String(b.rtfBase64 || ""), "base64").toString("latin1"));
      pdfTtd.push(Array.isArray(b.ttd) ? b.ttd : []);
      // 27 Okt: portal membubuhkan tanda tangan di PDF (posisi dari koordinat nama) dan menjawab ttdPdf.
      const ttdPdf = Array.isArray(b.ttd) && b.ttd.length ? { ttdPdf: { dipasang: b.ttd.map((x: { nama: string }) => x.nama), tidakDitemukan: [] } } : {};
      return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from(`%PDF-1.4 uji ${pdfRtf.length}`).toString("base64"), byte: 12, ...ttdPdf } });
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
  return { dom, w, simpanan, minta, latar, abt, pdfRtf, pdfTtd, pratinjau, gabung };
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
const unduhan = (h: Halaman) => h.latar.filter((m) => m.jenis === "unduh") as Array<{ nama: string; alamat: string }>;

const ubah = (h: Halaman, el: HTMLInputElement | HTMLSelectElement, nilai: string | boolean) => {
  if (typeof nilai === "boolean") (el as HTMLInputElement).checked = nilai;
  else el.value = nilai;
  el.dispatchEvent(new h.w.Event("change", { bubbles: true }));
};
const kunciDaftar = (h: Halaman) => mintaKe(h, /perkara-saya\?/).map((m) => new URL(m.url, ASAL).searchParams);
const terakhir = (h: Halaman) => kunciDaftar(h).pop()!;
const nomorDaftar = (h: Halaman) => qq(h, "#bd-dpk [data-pk]").map((x) => (x.getAttribute("data-pk") || "").replace(/\/Pdt\.G\/2026\/PA\.Dgl$/, ""));
const labelTab = (h: Halaman) => qq(h, '#bd-pkpilih [role="tab"][data-mode]').map((x) => x.textContent);
const tungguDaftar = (h: Halaman) => sampai(() => !q(h, "#bd-pkpilih [role=status]"), "daftar selesai dimuat");
/** Admin memilih "Lihat sebagai" akun PTSP dan menunggu daftarnya. */
async function sebagaiPtsp(h: Halaman) {
  await siap(h);
  const sel = (await sampai(() => q(h, "#bd-lihat"), "pemilih lihat sebagai")) as HTMLSelectElement;
  ubah(h, sel, "ptsp|Meja PTSP");
  await sampai(() => terakhir(h).get("peranSebagai") === "ptsp", "kueri sebagai PTSP");
  await tungguDaftar(h);
}

// ============================================================================



beforeEach(() => {
  gudang.cetak.clear();
  gudang.kalimat = [];
  gudang.panggilan = [];
  (globalThis as any).__tempat = "-";
});

const isian = (h: Halaman) => h.w.aletaBlangkoDerryIsian;
const kini = (h: Halaman) => isian(h).keadaan();
const sesiDari = (h: Halaman) => {
  const hasil: Record<string, string> = {};
  for (let i = 0; i < h.w.sessionStorage.length; i += 1) {
    const k = h.w.sessionStorage.key(i)!;
    hasil[k] = h.w.sessionStorage.getItem(k)!;
  }
  return hasil;
};
const muatUlang = (h: Halaman) => buka({}, { sesi: sesiDari(h), simpanan: h.simpanan });
const ketik = (h: Halaman, el: HTMLInputElement | HTMLTextAreaElement, nilai: string, blur = true) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  if (blur) el.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
};
async function pilihBlangko(h: Halaman, nomor = "581/Pdt.G/2026/PA.Dgl") {
  await sampai(() => h.w.aletaBlangkoDerry.keadaan().peran.length, "peran");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((x) => /Blangko Derry/.test(x.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  (q(h, `[data-pk="${nomor}"]`) as HTMLElement).click();
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, `[data-bl="${BLANGKO_PUT}"]`), "berkas termuat");
  klik(h, `[data-bl="${BLANGKO_PUT}"]`);
  await sampai(() => kini(h).susunan, "susunan isian");
  await sampai(() => q(h, "#bd-i8729"), "isian 8729");
}
/** Cetak seperti petugas: pengingat isian kosong (yang sudah ada sejak dulu) dijawab dengan menekan Cetak sekali lagi. */
async function cetakSekarang(h: Halaman) {
  klik(h, '[data-bd2="cetak"]');
  await tunggu(250);
  const ingat = q(h, "#bd-ingat") as HTMLElement | null;
  if (ingat && !ingat.hidden) klik(h, '[data-bd2="cetak"]');
}
const bedaCetak = (h: Halaman) => q(h, "#bd-bedacetak") as HTMLDetailsElement | null;
const unduhRtf = (h: Halaman) => h.latar.filter((m) => m.jenis === "unduh");

describe("3.3 keterangan pasif: N bagian berubah sejak cetakan terakhir", () => {
  it("cetakan pertama: tidak ada keterangan; sesudah cetak ringkasan tersimpan; naskah sama -> 'Sama dengan cetakan terakhir'; isian berubah -> 'N bagian berubah' dengan rincian; cetak tidak pernah ditahan", async () => {
    const h = buka();
    await pilihBlangko(h);
    await isian(h).naskahRtf(true);
    expect(bedaCetak(h)!.hidden).toBe(true); // belum pernah dicetak
    await cetakSekarang(h);
    await sampai(() => unduhRtf(h).length === 1 && gudang.cetak.size === 1, "dicetak dan ringkasan tersimpan");
    const tersimpan = [...gudang.cetak.values()][0];
    expect(tersimpan.bagian.length).toBeGreaterThanOrEqual(3);
    expect(tersimpan.bagian.every((b: any) => /^[0-9a-f]{8}$/.test(b.h) && b.t.length <= 160)).toBe(true);
    expect(JSON.stringify(tersimpan.bagian)).toContain("Tempat tinggal: -");

    // halaman dimuat ulang: blangko pulih, naskah disusun lagi, keterangan muncul tanpa klik
    const h2 = muatUlang(h);
    await sampai(() => kini(h2).blangko && kini(h2).susunan && q(h2, "#bd-i8729"), "pulih");
    await isian(h2).naskahRtf(true);
    await sampai(() => bedaCetak(h2) && !bedaCetak(h2)!.hidden, "keterangan tampil");
    expect(bedaCetak(h2)!.querySelector("summary")!.textContent).toMatch(/^Sama dengan cetakan terakhir/);

    // isian berubah di ABT -> naskah berubah -> satu bagian diubah
    (globalThis as any).__tempat = "Palu";
    await isian(h2).naskahRtf(true);
    await sampai(() => /1 bagian berubah sejak cetakan terakhir/.test(bedaCetak(h2)!.querySelector("summary")!.textContent || ""), "satu bagian berubah");
    const rinci = bedaCetak(h2)!.querySelector("ul")!.textContent || "";
    expect(rinci).toContain("diubah");
    expect(rinci).toContain("Tempat tinggal: -");
    expect(rinci).toContain("Tempat tinggal: Palu");
    // tidak ada langkah/konfirmasi tambahan: cetak langsung jalan dan ringkasan diperbarui
    const sebelum = unduhRtf(h2).length;
    await cetakSekarang(h2);
    await sampai(() => unduhRtf(h2).length === sebelum + 1, "cetak tanpa konfirmasi tambahan");
    await sampai(() => JSON.stringify([...gudang.cetak.values()][0].bagian).includes("Tempat tinggal: Palu"), "ringkasan diperbarui");
    expect(q(h2, ".bd-modal:not([hidden]), [role=alertdialog]")).toBeNull();
  });

  it("perkara atau blangko lain tidak memakai cetakan perkara ini", async () => {
    const h = buka();
    await pilihBlangko(h);
    await isian(h).naskahRtf(true);
    await cetakSekarang(h);
    await sampai(() => gudang.cetak.size === 1, "tersimpan");
    const kunci = [...gudang.cetak.keys()][0];
    expect(kunci).toBe(`10154|${BLANGKO_PUT.toLowerCase()}`);
    const h2 = buka();
    await pilihBlangko(h2, "582/Pdt.G/2026/PA.Dgl");
    await isian(h2).naskahRtf(true);
    await tunggu(100);
    expect(bedaCetak(h2)!.hidden).toBe(true);
  });
});

describe("3.4 pustaka kalimat pribadi", () => {
  const KALIMAT = "Tergugat telah dipanggil secara sah dan patut tetapi tidak hadir.";

  it("tombol kecil hanya di kotak teks panjang; menyimpan isi kotak ke pustaka; menyisipkan satu klik ke kotak yang sudah berisi", async () => {
    const h = buka();
    await pilihBlangko(h);
    expect(q(h, '.bd-f[data-f="8729"] [data-bd2="ketpustaka"]')).toBeTruthy();
    expect(q(h, '.bd-f[data-f="1006"] [data-bd2="ketpustaka"]')).toBeNull(); // kotak satu baris tidak ditawari
    ketik(h, q(h, "#bd-i8729") as HTMLTextAreaElement, KALIMAT);
    await sampai(() => h.abt["8729"] === KALIMAT, "tersimpan di ABT");
    klik(h, '.bd-f[data-f="8729"] [data-bd2="ketpustaka"]');
    await sampai(() => q(h, '.bd-f[data-f="8729"] .bd-pustaka'), "panel terbuka");
    expect(q(h, ".bd-pustaka")!.textContent).toContain("Belum ada kalimat tersimpan");
    (q(h, "[data-pus-judul]") as HTMLInputElement).value = "Panggilan sah";
    klik(h, '[data-bd2="ketpussimpan"]');
    await sampai(() => gudang.kalimat.length === 1, "disimpan ke pustaka");
    expect(gudang.kalimat[0]).toMatchObject({ jenisPerkara: "cerai gugat", status: "", kode: "8729", judul: "Panggilan sah", teks: KALIMAT, dibagikan: [] });
    await sampai(() => qq(h, ".bd-pusisip").length === 1, "kalimat tampil di panel");
    // kotak sudah berisi sesuatu: klik kalimat menambahkannya di belakang, tersimpan lewat jalur simpan isian biasa
    ketik(h, q(h, "#bd-i8729") as HTMLTextAreaElement, "Pembuka.");
    await sampai(() => h.abt["8729"] === "Pembuka.", "pembuka tersimpan");
    if (!q(h, ".bd-pusisip")) klik(h, '.bd-f[data-f="8729"] [data-bd2="ketpustaka"]');
    await sampai(() => q(h, ".bd-pusisip"), "panel");
    klik(h, ".bd-pusisip");
    await sampai(() => h.abt["8729"] === `Pembuka. ${KALIMAT}`, "disisipkan dan tersimpan");
    await sampai(() => gudang.panggilan.some((c) => c.aksi === "pakai"), "pemakaian dicatat");
    expect(gudang.kalimat[0].dipakai).toBe(1);
  });

  it("kalimat untuk isian + jenis perkara yang sama diusulkan SENDIRI sebagai saran samar; Tab memakainya; tidak ditulis ke ABT tanpa tindakan petugas, juga oleh pengisian otomatis", async () => {
    gudang.kalimat.push({ id: "kal-seed-xxxxxxxx", pemilikId: "u-1", pemilikNama: "Hakim Satu", jenisPerkara: "cerai gugat", status: "", kode: "8729", judul: "Panggilan sah", teks: KALIMAT, dibagikan: [], dipakai: 3, dipakaiTerakhir: "", diubahPada: "2026-10-29T00:00:00.000Z" });
    gudang.kalimat.push({ id: "kal-umum-xxxxxxxx", pemilikId: "u-1", pemilikNama: "Hakim Satu", jenisPerkara: "", status: "", kode: "", judul: "Umum", teks: "Kalimat umum tanpa isian khusus.", dibagikan: [], dipakai: 9, dipakaiTerakhir: "", diubahPada: "2026-10-29T00:00:00.000Z" });
    const h = buka();
    await pilihBlangko(h, "582/Pdt.G/2026/PA.Dgl");
    const kotak = q(h, "#bd-i8729") as HTMLTextAreaElement;
    await sampai(() => (q(h, "#bd-i8729") as HTMLTextAreaElement).getAttribute("placeholder") === KALIMAT, "saran samar dari pustaka");
    expect(kotak.value).toBe("");
    expect(mintaKe(h, /edit_data\?no_var=8729/, "POST")).toEqual([]);
    // pengisian otomatis ("Isi dari gugatan") tidak menuliskan kalimat pustaka
    klik(h, "#bd-alat-btn");
    q(h, '[data-alat="gugatan"]')!.click();
    await tunggu(300);
    expect(mintaKe(h, /edit_data\?no_var=8729/, "POST")).toEqual([]);
    expect(h.abt["8729"]).toBeUndefined();
    // Tab = tindakan petugas
    (q(h, "#bd-i8729") as HTMLTextAreaElement).dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    await sampai(() => h.abt["8729"] === KALIMAT, "diterima dengan Tab");
    await sampai(() => gudang.panggilan.some((c) => c.aksi === "pakai" && c.id === "kal-seed-xxxxxxxx"), "pemakaian saran dicatat");
    // kalimat umum (tanpa isian khusus) tidak pernah diusulkan sendiri
    expect(gudang.panggilan.some((c) => c.aksi === "pakai" && c.id === "kal-umum-xxxxxxxx")).toBe(false);
  });

  it("jenis perkara lain tidak mendapat usulan; hapus hanya lewat tombol milik sendiri", async () => {
    gudang.kalimat.push({ id: "kal-itsbat-xxxxxxx", pemilikId: "u-1", pemilikNama: "Hakim Satu", jenisPerkara: "itsbat nikah", status: "", kode: "8729", judul: "x", teks: "Khusus itsbat nikah, tidak untuk cerai gugat.", dibagikan: [], dipakai: 1, dipakaiTerakhir: "", diubahPada: "2026-10-29T00:00:00.000Z" });
    const h = buka();
    await pilihBlangko(h);
    await tunggu(200);
    expect((q(h, "#bd-i8729") as HTMLTextAreaElement).getAttribute("placeholder")).not.toContain("itsbat");
    klik(h, '.bd-f[data-f="8729"] [data-bd2="ketpustaka"]');
    await sampai(() => q(h, ".bd-pustaka"), "panel");
    expect(qq(h, ".bd-pusisip")).toHaveLength(0); // tidak berlaku untuk cerai gugat
  });
});

describe("3.3 perbandingan paragraf (murni)", () => {
  it("tak berubah = 0; ubah satu = 1 'diubah'; tambah dan hapus dihitung; spasi/huruf besar tidak dianggap perubahan; urutan tertukar tetap terdeteksi", () => {
    const m = buka().w.aletaBedaCetak;
    const r = (t: string) => m.ringkas(t);
    const dasar = r("Menimbang bahwa A.\nMenimbang bahwa B.\nMengadili:\nMengabulkan gugatan.");
    expect(m.bandingkan(dasar, r("Menimbang  bahwa A.\n\nMENIMBANG BAHWA B.\nMengadili:\nMengabulkan gugatan.")).n).toBe(0);
    const ubah = m.bandingkan(dasar, r("Menimbang bahwa A.\nMenimbang bahwa B, diubah.\nMengadili:\nMengabulkan gugatan."));
    expect(ubah).toMatchObject({ n: 1 });
    expect(ubah.perubahan[0]).toMatchObject({ jenis: "diubah", lama: "Menimbang bahwa B.", baru: "Menimbang bahwa B, diubah." });
    const tambahHapus = m.bandingkan(dasar, r("Menimbang bahwa A.\nParagraf baru.\nMenimbang bahwa B.\nMengadili:"));
    expect(tambahHapus.perubahan.map((x: any) => x.jenis).sort()).toEqual(["hapus", "tambah"]);
    expect(m.bandingkan(dasar, r("Mengadili:\nMengabulkan gugatan.\nMenimbang bahwa A.\nMenimbang bahwa B.")).n).toBeGreaterThan(0);
    expect(m.bandingkan([], r("Satu paragraf.")).n).toBe(1);
    // ringkasan tidak memuat dokumen utuh: paragraf dipotong 160 huruf, paling banyak 600 bagian
    const panjang = m.ringkas("x".repeat(1000) + "\n" + Array.from({ length: 700 }, (_, i) => `baris nomor ${i}`).join("\n"));
    expect(panjang).toHaveLength(600);
    expect(panjang[0].t).toHaveLength(160);
  });
});

describe("3.2 riwayat ubah isian: pasif, terlipat, kembalikan bila perlu", () => {
  // 1006 = isian tanpa kartu usulan (ikon riwayat hanya bila ada riwayat); 8729 = isian dengan kartu usulan (ikon sudah ada sejak dulu)
  const catatan = [
    { kode: "1006", nama: "Tempat tinggal", sebelum: "Palu", sesudah: "Poso", cara: "diketik petugas", pada: "2026-10-30T02:15:00.000Z" },
    { kode: "1006", nama: "Tempat tinggal", sebelum: "", sesudah: "Palu", cara: "diisi ALETA", pada: "2026-10-30T02:10:00.000Z" },
    { kode: "8729", nama: "Uraian pertimbangan hakim", sebelum: "Uraian lama", sesudah: "Uraian baru", cara: "usulan diubah petugas", pada: "2026-10-30T01:00:00.000Z", oleh: "PP Satu", dariServerLengkap: true, bisaDiurungkan: true, utuh: true, idJejak: "j-1" },
  ];

  it("isian tanpa riwayat tidak diberi ikon", async () => {
    const h = buka();
    h.w.bacaRiwayat = async () => [];
    await pilihBlangko(h);
    await tunggu(150);
    expect(q(h, '.bd-f[data-f="1006"] [data-bd2="ketriwayat"]')).toBeNull();
    expect(qq(h, ".bd-ketriw")).toHaveLength(0);
  });

  it("ikon muncul sendiri bila ada riwayat; terlipat bawaan; baris memuat siapa, kapan, sumber, lama -> baru; Kembalikan menulis nilai lama hanya atas klik (catatan server: dua langkah)", async () => {
    const h = buka({ abtAwal: { "1006": "Poso", "8729": "Uraian baru" } });
    h.w.bacaRiwayat = async () => catatan;
    await pilihBlangko(h);
    await sampai(() => q(h, '.bd-f[data-f="1006"] [data-bd2="ketriwayat"]'), "ikon riwayat muncul");
    expect(qq(h, ".bd-ketriw")).toHaveLength(0); // terlipat bawaan
    klik(h, '.bd-f[data-f="1006"] [data-bd2="ketriwayat"]');
    await sampai(() => qq(h, '.bd-f[data-f="1006"] .bd-ketriw-baris').length === 2, "dua catatan");
    const baris = qq(h, '.bd-f[data-f="1006"] .bd-ketriw-baris').map((x) => x.textContent || "");
    expect(baris[0]).toMatch(/Anda · diketik petugas: "Palu" → "Poso"/);
    expect(baris[0]).toMatch(/30 Okt/i);
    expect(baris[1]).toMatch(/diisi ALETA: "\(kosong\)" → "Palu"/);
    // tidak ada penulisan tanpa klik
    expect(mintaKe(h, /edit_data\?no_var=1006/, "POST")).toEqual([]);
    const tombolKembali = qq(h, '.bd-f[data-f="1006"] [data-bd2="ketpulih"]');
    expect(tombolKembali.length).toBeGreaterThan(0);
    tombolKembali[0].click();
    await sampai(() => h.abt["1006"] === "Palu", "nilai lama ditulis ulang atas klik");
    // catatan dari server (akun/PC lain): konfirmasi dua langkah sebelum menimpa
    klik(h, '.bd-f[data-f="8729"] [data-bd2="ketriwayat"]');
    await sampai(() => qq(h, '.bd-f[data-f="8729"] .bd-ketriw-baris').length === 1, "catatan server");
    expect(qq(h, '.bd-f[data-f="8729"] .bd-ketriw-baris')[0].textContent).toMatch(/usulan diubah petugas: "Uraian lama" → "Uraian baru" · dicatat di server oleh PP Satu/);
    qq(h, '.bd-f[data-f="8729"] [data-bd2="ketpulih"]')[0].click();
    await tunggu(100);
    expect(h.abt["8729"]).toBe("Uraian baru"); // belum: perlu menekan sekali lagi
    qq(h, '.bd-f[data-f="8729"] [data-bd2="ketpulih"]')[0].click();
    await sampai(() => h.abt["8729"] === "Uraian lama", "dikembalikan setelah konfirmasi");
  });
});
