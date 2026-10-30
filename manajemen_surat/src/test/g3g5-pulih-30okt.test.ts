// @vitest-environment node
/**
 * ============================================================================
 * TETAP DI TEMPAT SAAT HALAMAN DIMUAT ULANG (30 Okt 2026)
 * ============================================================================
 *
 * Kode ekstensi sungguhan di jsdom (harness sama dengan uji PTSP 28 Okt). "Muat ulang" = JSDOM baru yang mewarisi sessionStorage tab
 * dan chrome.storage lama (halaman baru, ingatan peramban sama).
 *   A  muat ulang: tampilan Derry tetap terbuka pada perkara, sidang, blangko yang sama, tanpa klik
 *   B  akun berganti: keadaan akun lain tidak dipulihkan
 *   C  "Tampilan ABT lama" (pilihan eksplisit) dan tautan #bd= tidak dikalahkan
 *   D  ketikan yang belum tersimpan kembali sebagai draf, TANPA menulis ke ABT
 *   E  Lihat sebagai (Super Admin) dan kedaluwarsa
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { jenisDokumenAkun, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { susunPerkaraSaya, type BarisSidangSaya } from "@/app/api/aleta-ecourt/perkara-saya/susun";
import { namaAkunPtsp } from "@/lib/akun-ptsp";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "jurusita.js", "abt-klien.js", "blangko-derry-pulih.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-isian.js", "blangko-derry-berkas.js", "blangko-derry-massal.js"].map(baca).join("\n;\n");

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
  `\\pard\\qc\\b NASKAH\\b0\\par\\pard\\qc Nomor ${nomor}\\par\\pard\\qj Menimbang, bahwa perkara ${nomor} telah diperiksa;\\par\\pard\\ql Hakim Satu, S.H.\\par}`;

type Usulan = Record<string, unknown>;
type Minta = { url: string; cara: string; badan: string };
const sampulNaskah: Array<Record<string, any>> = [];
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


const isian = (h: Halaman) => h.w.aletaBlangkoDerryIsian;
const sesiDari = (h: Halaman) => {
  const hasil: Record<string, string> = {};
  for (let i = 0; i < h.w.sessionStorage.length; i += 1) {
    const k = h.w.sessionStorage.key(i)!;
    hasil[k] = h.w.sessionStorage.getItem(k)!;
  }
  return hasil;
};
/** Memuat ulang halaman: JSDOM baru dengan sessionStorage tab dan chrome.storage lama. */
function muatUlang(h: Halaman, p: Opsi = {}, tambah?: { hash?: string; sesi?: Record<string, string> }) {
  return buka(p, { sesi: { ...sesiDari(h), ...(tambah?.sesi ?? {}) }, simpanan: h.simpanan, hash: tambah?.hash });
}
async function bukaDanPilih(p: Opsi = {}) {
  const h = buka(p);
  await siap(h);
  await sampai(() => qq(h, "[data-pk]").length, "daftar perkara");
  return h;
}
async function pilihPerkaraDanBlangko(h: Halaman, nomor = "581/Pdt.G/2026/PA.Dgl", berkas = BLANGKO_PUT) {
  if (!isian(h).keadaan().pk || isian(h).keadaan().pk.nomorPerkara !== nomor) {
    (q(h, `[data-pk="${nomor}"]`) as HTMLElement).click();
    await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
  }
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, `[data-bl="${berkas}"]`), "berkas termuat");
  klik(h, `[data-bl="${berkas}"]`);
  await sampai(() => isian(h).keadaan().susunan, "susunan isian");
}
const tampilanTerbuka = (h: Halaman) => Boolean(D_(h).getElementById("aleta-bd-akar") && !(D_(h).getElementById("aleta-bd-akar") as HTMLElement).hidden && D_(h).documentElement.classList.contains("aleta-bd-aktif"));
const kini = (h: Halaman) => isian(h).keadaan();

describe("A. muat ulang: tetap di Blangko ABT by Derry pada perkara, sidang, dan blangko yang sama", () => {
  it("tanpa klik: tampilan terbuka sendiri, perkara dan sidang sama, blangko sama", async () => {
    const h = await bukaDanPilih();
    await pilihPerkaraDanBlangko(h);
    const nilaiSidang = String(kini(h).pk.sidangKe);
    await isian(h).muatKelompok("Putusan CG");
    await isian(h).pilihBlangko(BLANGKO_PUT_2, "Putusan CG");
    await sampai(() => kini(h).blangko && kini(h).blangko.berkas === BLANGKO_PUT_2, "blangko kedua");

    const h2 = muatUlang(h);
    await sampai(() => tampilanTerbuka(h2), "tampilan terbuka sendiri");
    await sampai(() => kini(h2).pk && kini(h2).blangko && kini(h2).susunan, "perkara + blangko pulih");
    expect(kini(h2).pk.nomorPerkara).toBe("581/Pdt.G/2026/PA.Dgl");
    expect(String(kini(h2).pk.sidangKe)).toBe(nilaiSidang);
    expect(kini(h2).blangko.berkas).toBe(BLANGKO_PUT_2);
    // tanpa klik tambahan dan tanpa kartu tawaran
    expect(D_(h2).getElementById("aleta-bd-tawar")).toBeNull();
  });

  it("gulir dan langkah dikembalikan; kembali ke ABT lama tidak dipulihkan", async () => {
    const h = await bukaDanPilih();
    await pilihPerkaraDanBlangko(h);
    const akarEl = akar(h);
    akarEl.scrollTop = 420;
    akarEl.dispatchEvent(new h.w.Event("scroll"));
    await tunggu(400);
    const s = JSON.parse(h.w.sessionStorage.getItem("aleta-bd-keadaan")!);
    expect(s.gulir).toBe(420);
    const h2 = muatUlang(h);
    await sampai(() => kini(h2).blangko && kini(h2).susunan, "pulih");
    await sampai(() => akar(h2).scrollTop === 420, "gulir pulih");
  });

});

describe("B. akun berganti, C. pilihan eksplisit, E. kedaluwarsa", () => {
  it("akun lain pada tab yang sama: keadaan tidak dipulihkan dan dibuang", async () => {
    const h = await bukaDanPilih();
    await pilihPerkaraDanBlangko(h);
    expect(h.w.sessionStorage.getItem("aleta-bd-keadaan")).toContain("581/Pdt.G/2026/PA.Dgl");
    const h2 = muatUlang(h, { orang: "pp", ttd: { baris: [], akunId: "u-pp" } });
    await sampai(() => h2.w.aletaBlangkoDerry.keadaan().peran.length, "peran pp");
    await tunggu(150);
    expect(tampilanTerbuka(h2)).toBe(false);
    expect(h2.w.sessionStorage.getItem("aleta-bd-keadaan")).toBeNull();
  });

  it("pengguna ABT berganti walau akun ALETA sama: tidak dipulihkan", async () => {
    const h = await bukaDanPilih();
    await pilihPerkaraDanBlangko(h);
    const h2 = muatUlang(h);
    h2.w.document.querySelector("#header .h_right b")!.textContent = "Orang Lain";
    // ganti nama sebelum skrip berjalan tidak mungkin (skrip dieval di buka); cek identitas lewat modul
    const modul = h2.w.aletaBdPulih;
    const k = JSON.parse(h.w.sessionStorage.getItem("aleta-bd-keadaan")!);
    expect(modul.ambil(k.identitas.replace(/\|.*/, "|orang lain"))).toBeNull();
  });

  it("Tampilan ABT lama (pilihan eksplisit) tidak ditimpa", async () => {
    const h = await bukaDanPilih();
    await pilihPerkaraDanBlangko(h);
    (q(h, '[data-bd="keabt"]') as HTMLElement).click();
    await sampai(() => !tampilanTerbuka(h), "ditutup");
    expect(JSON.parse(h.w.sessionStorage.getItem("aleta-bd-keadaan")!).buka).toBe(false);
    const h2 = muatUlang(h);
    await sampai(() => h2.w.aletaBlangkoDerry.keadaan().peran.length, "peran");
    await tunggu(200);
    expect(tampilanTerbuka(h2)).toBe(false);
  });

  it("kedaluwarsa 12 jam: tidak dipulihkan", async () => {
    const h = await bukaDanPilih();
    await pilihPerkaraDanBlangko(h);
    const s = JSON.parse(h.w.sessionStorage.getItem("aleta-bd-keadaan")!);
    s.saat = Date.now() - 13 * 3600 * 1000;
    const h2 = muatUlang(h, {}, { sesi: { "aleta-bd-keadaan": JSON.stringify(s) } });
    await sampai(() => h2.w.aletaBlangkoDerry.keadaan().peran.length, "peran");
    await tunggu(200);
    expect(tampilanTerbuka(h2)).toBe(false);
  });
});

describe("C2. tautan #bd= dari Jadwal Sidang menang atas keadaan tersimpan", () => {
  it("perkara dari tautan yang dibuka, bukan perkara tersimpan", async () => {
    const h = await bukaDanPilih();
    await pilihPerkaraDanBlangko(h, "581/Pdt.G/2026/PA.Dgl");
    const tautan = encodeURIComponent(JSON.stringify({ v: 1, nomor: "582/Pdt.G/2026/PA.Dgl", perkaraId: "10155", sidangKe: 2, tanggalSidang: TGL, jenis: "bas" }));
    const h2 = muatUlang(h, {}, { hash: `#bd=${tautan}` });
    await sampai(() => kini(h2).pk && kini(h2).pk.nomorPerkara === "582/Pdt.G/2026/PA.Dgl", "perkara tautan");
    await tunggu(200);
    expect(kini(h2).pk.nomorPerkara).toBe("582/Pdt.G/2026/PA.Dgl");
  });
});

describe("D. ketikan yang belum tersimpan kembali sebagai draf tanpa menulis ke ABT", () => {
  it("draf muncul di kotaknya dengan keterangan; tidak ada POST ke ABT sampai petugas menyimpan", async () => {
    const h = await bukaDanPilih();
    await pilihPerkaraDanBlangko(h);
    const kotak = (await sampai(() => q(h, "#bd-i1006"), "kotak 1006")) as HTMLInputElement | HTMLTextAreaElement;
    kotak.value = "rumah orang tua Penggugat di Palu";
    kotak.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    // muat ulang SEBELUM penyimpanan tertunda (500 ms) berjalan
    const sesi = JSON.parse(h.w.sessionStorage.getItem("aleta-bd-keadaan")!);
    expect(sesi.draf.isian["1006"]).toBe("rumah orang tua Penggugat di Palu");
    const h2 = muatUlang(h);
    await sampai(() => kini(h2).blangko && kini(h2).susunan, "pulih");
    const k2 = (await sampai(() => q(h2, "#bd-i1006"), "kotak 1006 pulih")) as HTMLInputElement;
    await sampai(() => k2.value === "rumah orang tua Penggugat di Palu", "draf di kotak");
    expect(q(h2, '[data-status="1006"]')!.textContent).toContain("belum tersimpan ke ABT");
    expect(mintaKe(h2, /edit_data\?no_var=1006/, "POST")).toEqual([]);
    expect(h2.abt["1006"]).toBeUndefined();
    // menyimpan = tindakan petugas
    (q(h2, '[data-bd2="ketsimpandraf"]') as HTMLElement).click();
    await sampai(() => mintaKe(h2, /edit_data\?no_var=1006/, "POST").length === 1, "disimpan oleh petugas");
    expect(h2.abt["1006"]).toBe("rumah orang tua Penggugat di Palu");
    await sampai(() => !JSON.parse(h2.w.sessionStorage.getItem("aleta-bd-keadaan")!).draf, "draf dihapus sesudah tersimpan");
  });

  it("ketikan yang sempat tersimpan bukan draf", async () => {
    const h = await bukaDanPilih();
    await pilihPerkaraDanBlangko(h);
    const kotak = (await sampai(() => q(h, "#bd-i1006"), "kotak")) as HTMLInputElement;
    kotak.value = "sudah tersimpan";
    kotak.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    kotak.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
    await sampai(() => h.abt["1006"] === "sudah tersimpan", "tersimpan");
    await tunggu(50);
    const s = JSON.parse(h.w.sessionStorage.getItem("aleta-bd-keadaan")!);
    expect(s.draf == null || Object.keys(s.draf.isian || {}).length === 0).toBe(true);
  });
});

describe("E2. Lihat sebagai (Super Admin)", () => {
  it("Lihat sebagai akun yang sama dipulihkan bersama perkaranya", async () => {
    const h = buka({ orang: "admin" });
    await siap(h);
    const sel = (await sampai(() => q(h, "#bd-lihat"), "pemilih lihat sebagai")) as HTMLSelectElement;
    ubah(h, sel, "pp|PP Satu");
    await sampai(() => terakhir(h).get("peranSebagai") === "pp", "kueri sebagai PP");
    await tungguDaftar(h);
    await sampai(() => qq(h, "[data-pk]").length, "daftar");
    (qq(h, "[data-pk]")[0] as HTMLElement).click();
    await sampai(() => isian(h).keadaan().pk, "perkara");
    const nomor = isian(h).keadaan().pk.nomorPerkara;
    const h2 = muatUlang(h, { orang: "admin" });
    await sampai(() => kini(h2).pk && kini(h2).pk.nomorPerkara === nomor, "perkara pulih");
    expect(terakhir(h2).get("peranSebagai")).toBe("pp");
    expect(terakhir(h2).get("sebagai")).toBe("PP Satu");
    expect((q(h2, "#bd-lihat") as HTMLSelectElement).value).toBe("pp|PP Satu");
  });
});
