// @vitest-environment node
/**
 * ============================================================================
 * 28 OKT 2026 - BLANGKO ABT BY DERRY: pilihan "Lihat sebagai" PTSP umum + lencana Kelengkapan isian yang terukur
 * ============================================================================
 *
 * ekstensi-sipp/blangko-derry*.js dijalankan SUNGGUHAN di jsdom (portal, bot dan ABT ditiru; perkaranya dihitung oleh aturan isian yang sama
 * dengan langkah Isian):
 *   A  "Lihat sebagai": pilihan "PTSP (semua petugas PTSP)" selalu ada dan dapat dipilih walau belum ada akun PTSP
 *   B  lencana kelengkapan isian: diukur otomatis di latar (antre, serentak terbatas, hanya membaca), diingat, jujur bila blangko belum dipilih
 *   C  lencana dapat diarahkan tetikus (keterangan) dan diklik: perkara terbuka di langkah Isian dengan blangko yang diukur, gulir ke isian kosong
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { susunPerkaraSaya, type BarisSidangSaya } from "@/app/api/aleta-ecourt/perkara-saya/susun";

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
  /** Portal lama: daftar akun tanpa kelompok PTSP. */
  akunLama?: boolean;
  /** Daftar akun PTSP dari server (bawaan satu akun); [] = belum ada akun PTSP. */
  akunPtsp?: string[];
  /** Nilai ABT khusus per perkaraId (menimpa `abt`). */
  abtPerPerkara?: Record<string, Record<string, string>>;
  /** Bot tidak menjawab nilai (nilaiAda=false): ukuran latar harus menyerah, bukan menyapu jendela ABT. */
  tanpaBot?: boolean;
  /** Nomor perkara (awalan) yang tidak punya saran blangko dari portal. */
  tanpaSaran?: string[];
  /** Jeda (ms) pada pembacaan susunan isian, untuk mengukur banyaknya yang serentak. */
  tundaSusunan?: number;
  /** Isi sessionStorage sebelum skrip ekstensi dimuat (hasil ukur tab sebelumnya). */
  sesiAwal?: Record<string, unknown>;
  /** Sidang portal (?rekomendasi) selalu gagal. */
  sidangGagal?: boolean;
};
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; pdfRtf: string[]; pdfTtd: Array<Array<{ nama: string }>>; pratinjau: string[]; gabung: number[]; lalu: { berjalan: number; puncak: number } };
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
  const pdfTtd: Array<Array<{ nama: string }>> = [];
  const pratinjau: string[] = [];
  const gabung: number[] = [];
  const lalu = { berjalan: 0, puncak: 0 };
  const orang = ORANG[p.orang ?? "hakim"];
  const daftarPerkara = (p.perkara ?? SEMUA_PERKARA) as typeof SEMUA_PERKARA;
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const nilaiDari = (kode: string[], perkaraId = "") => {
    const n: Record<string, unknown> = {};
    for (const k of kode) {
      const abtIni = { ...abt, ...(p.abtPerPerkara?.[perkaraId] ?? {}) };
      const v = abtIni[k] !== undefined && abtIni[k] !== "" ? { status: "terisi", teks: abtIni[k], nama: "", sebab: "" } : k === "0001" ? { status: "terisi", teks: "581/Pdt.G/2026/PA.Dgl", nama: "", sebab: "" } : k === "0046" ? { status: "terisi", teks: "Penggugat", nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" };
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
      return json({ ok: true, data: { hariIni: TGL, mode: "rentang", dari: q.get("dari"), sampai: q.get("sampai"), lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, ptspCari: ptsp, terpotong: false, jumlahSemua: rentang.length, adaYangCocok: true, akun: admin ? (p.akunLama ? { hakim: AKUN.hakim, pp: AKUN.pp, js: AKUN.js } : { ...AKUN, ptsp: p.akunPtsp ?? AKUN.ptsp }) : null, perkara: polos(rentang) } });
    }
    if (url.includes("/aleta-ecourt/sidang?dari=")) {
      if (p.sidangGagal) return json({ ok: false, alasan: "bot mati" }, 502);
      const q = new URL(url, ASAL).searchParams;
      const rek = (nomor: string) =>
        (p.tanpaSaran ?? []).some((a) => nomor.startsWith(a))
          ? { sumberTeks: "", teksDasar: "", putusan: [], bas: [], relaas: [] }
          : nomor.startsWith("581")
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
      if (q.get("perkaraId") && p.tundaSusunan) {
        lalu.berjalan += 1;
        lalu.puncak = Math.max(lalu.puncak, lalu.berjalan);
        await tunggu(p.tundaSusunan);
        lalu.berjalan -= 1;
      }
      const botMenjawab = Boolean(q.get("perkaraId")) && !p.tanpaBot;
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${berkas}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: botMenjawab ? nilaiDari(kode, q.get("perkaraId") || "") : undefined, nilaiAda: botMenjawab, nilaiSebab: "" } });
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
  for (const [k, v] of Object.entries(p.sesiAwal ?? {})) w.sessionStorage.setItem(k, JSON.stringify(v));
  w.eval(SUMBER);
  w.aletaBlangkoDerryMassal.atur({ jedaMs: 0 });
  w.aletaBlangkoDerry.aturUkur({ jedaMs: 0, mulaiMs: 0 });
  return { dom, w, simpanan, minta, latar, abt, pdfRtf, pdfTtd, pratinjau, gabung, lalu };
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


const NO = { a: "581/Pdt.G/2026/PA.Dgl", b: "582/Pdt.G/2026/PA.Dgl", d: "584/Pdt.G/2026/PA.Dgl" };
/** Lencana kelengkapan isian satu perkara di daftar. */
const lencana = (h: Halaman, nomor: string) => qq(h, "[data-isian]").find((x) => x.getAttribute("data-isian") === nomor) as HTMLElement | undefined;
const teksLencana = (h: Halaman, nomor: string) => (lencana(h, nomor)?.textContent || "").trim();
/** Daftar ditampilkan sebagai "Daftar ringkas" (lencana isian tampil di semua baris) dan menunggu semuanya selesai diukur. */
async function daftarRingkas(h: Halaman) {
  await siap(h);
  await tungguDaftar(h);
  (q(h, '[data-lihat="ringkas"]') as HTMLElement).click();
  await sampai(() => q(h, "#bd-dpk [data-isian]"), "lencana isian tampil");
}
const tungguSelesaiUkur = (h: Halaman) =>
  sampai(() => {
    const k = h.w.aletaBlangkoDerry.ukurKeadaan();
    return k.antre.length === 0 && k.jalan === 0 && qq(h, "[data-isian]").every((x) => !/Mengukur|belum diukur/.test(x.textContent || "")) && qq(h, "[data-isian]").length > 0;
  }, "pengukuran selesai", 12000);
const permintaanSusunan = (h: Halaman) => mintaKe(h, /\/aleta-ecourt\/blangko-derry\?.*perkaraId=/).map((m) => new URL(m.url, ASAL).searchParams);

// ============================================================================
describe("A. Lihat sebagai: PTSP umum selalu ada dan dapat dipilih", () => {
  it("belum ada akun PTSP: pilihan 'PTSP (semua petugas PTSP)' tetap ada, paling atas di kelompok PTSP", async () => {
    const h = buka({ orang: "admin", akunPtsp: [] });
    await siap(h);
    const sel = (await sampai(() => q(h, "#bd-lihat"), "pemilih")) as HTMLSelectElement;
    const ptsp = Array.from(sel.querySelectorAll('optgroup[label="PTSP"] option')) as HTMLOptionElement[];
    expect(ptsp.map((o) => [o.value, o.textContent])).toEqual([["ptsp|Semua petugas PTSP", "PTSP (semua petugas PTSP)"]]);
    expect(ptsp[0].disabled).toBe(false);
  });

  it("dipilih: tampilan PTSP muncul (daftar perkara baru, hak hanya PTSP) tanpa satu akun PTSP pun", async () => {
    const h = buka({ orang: "admin", akunPtsp: [] });
    await siap(h);
    ubah(h, (await sampai(() => q(h, "#bd-lihat"), "pemilih")) as HTMLSelectElement, "ptsp|Semua petugas PTSP");
    await sampai(() => terakhir(h).get("peranSebagai") === "ptsp", "kueri sebagai PTSP");
    await tungguDaftar(h);
    const api = h.w.aletaBlangkoDerry;
    expect(polos(api.jenisDokumen())).toEqual(["ptsp"]);
    expect(terakhir(h).get("sidangPertama")).toBe("1");
    expect(labelTab(h)).toEqual(["Perkara hari ini", "Tanggal tertentu", "Rentang tanggal"]);
    expect(nomorDaftar(h)).toEqual(["584"]);
    expect(q(h, "#bd-siapa")!.textContent).toContain("dilihat sebagai PTSP (semua petugas PTSP)");
    expect((q(h, "#bd-lihat") as HTMLSelectElement).value).toBe("ptsp|Semua petugas PTSP");
  });

  it("cetak massal PTSP dapat dibuka dari tampilan umum, memakai kueri satker", async () => {
    const h = buka({ orang: "admin", akunPtsp: [] });
    await siap(h);
    ubah(h, (await sampai(() => q(h, "#bd-lihat"), "pemilih")) as HTMLSelectElement, "ptsp|Semua petugas PTSP");
    await sampai(() => terakhir(h).get("peranSebagai") === "ptsp", "kueri sebagai PTSP");
    await tungguDaftar(h);
    (q(h, "#bd-massal") as HTMLElement).click();
    await sampai(() => q(h, "#bd-ms-tgl"), "jendela cetak massal terbuka");
    expect(q(h, "#bd-ms-tgl")).not.toBeNull();
  });

  it("akun PTSP yang sudah ada tampil di bawah pilihan umum, seperti kelompok lain", async () => {
    const h = buka({ orang: "admin", akunPtsp: ["Meja PTSP", "Loket Pendaftaran"] });
    await siap(h);
    const sel = (await sampai(() => q(h, "#bd-lihat"), "pemilih")) as HTMLSelectElement;
    expect(Array.from(sel.querySelectorAll('optgroup[label="PTSP"] option')).map((o) => (o as HTMLOptionElement).value)).toEqual(["ptsp|Semua petugas PTSP", "ptsp|Meja PTSP", "ptsp|Loket Pendaftaran"]);
    ubah(h, sel, "ptsp|Loket Pendaftaran");
    await sampai(() => terakhir(h).get("sebagai") === "Loket Pendaftaran", "akun dipilih");
    expect(q(h, "#bd-siapa")!.textContent).toContain("dilihat sebagai Loket Pendaftaran");
  });

  it("sisi server: sebagai PTSP umum (nama tetap) = daftar satker baca saja, tanpa peran tulis", () => {
    const baris = (nomor: string, id: string, tgl: string, urutan: number): BarisSidangSaya =>
      ({ nomorPerkara: nomor, perkaraId: id, sidangId: `s${id}`, tanggalSidang: tgl, jamSidang: "09:00", urutanSidang: urutan, majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu", agenda: "Sidang Pertama" }) as unknown as BarisSidangSaya;
    const hasil = susunPerkaraSaya([baris("584/Pdt.G/2026/PA.Dgl", "10157", TGL, 1)], {
      hariIni: TGL,
      nama: "Super Admin",
      lihatSemua: true,
      sebagaiNama: "Semua petugas PTSP",
      sebagaiPeran: null,
      bolehLihatSebagai: true,
      cariNomorSatker: true,
      semuaSatker: true,
      hanyaSidangPertama: true,
      cariNomor: "",
    });
    expect(hasil.perkara.map((x) => x.nomorPerkara)).toEqual(["584/Pdt.G/2026/PA.Dgl"]);
    expect(hasil.perkara[0].sebagai).toEqual([]);
  });
});

// ============================================================================
describe("B. Lencana Kelengkapan isian terukur di latar", () => {
  it("PP: perkara yang punya saran blangko terukur otomatis; yang tanpa blangko ditulis jujur; tidak ada lagi 'belum diukur'", async () => {
    const h = buka({ orang: "pp", tanpaSaran: ["584"] });
    await daftarRingkas(h);
    await tungguSelesaiUkur(h);
    expect(teksLencana(h, NO.a)).toMatch(/^(Terisi \d+ dari \d+|Isian lengkap)$/);
    expect(teksLencana(h, NO.b)).toMatch(/^(Terisi \d+ dari \d+|Isian lengkap)$/);
    expect(teksLencana(h, NO.d)).toBe("Blangko belum dipilih");
    expect(qq(h, "[data-isian]").some((x) => /belum diukur/i.test(x.textContent || ""))).toBe(false);
    // Blangko yang diukur = saran utama portal untuk sidang acuan perkara itu.
    const lap = h.w.aletaBlangkoDerry.ukurKeadaan().lapor;
    expect(lap[NO.a].blangko.berkas).toBe(BLANGKO_BAS);
    expect(lap[NO.b].blangko.berkas).toBe(BLANGKO_BAS_1);
    expect(lap[NO.a].sumber).toBe("latar");
  });

  it("angkanya mengikuti ABT: isian wajib yang sudah terisi menambah angka 'Terisi'", async () => {
    const kosong = buka({ orang: "pp" });
    await daftarRingkas(kosong);
    await tungguSelesaiUkur(kosong);
    const awal = kosong.w.aletaBlangkoDerry.ukurKeadaan().lapor[NO.a];
    expect(awal.t).toBeGreaterThan(awal.a);
    const terisi = buka({ orang: "pp", abtPerPerkara: { "10154": { "0007": "Ya", "1006": "Rumah orang tua", "2004": "Petani" } } });
    await daftarRingkas(terisi);
    await tungguSelesaiUkur(terisi);
    const akhir = terisi.w.aletaBlangkoDerry.ukurKeadaan().lapor[NO.a];
    expect(akhir.t).toBe(awal.t);
    expect(akhir.a).toBeGreaterThan(awal.a);
    // Perkara lain (tanpa isian tambahan) tidak ikut berubah.
    expect(terisi.w.aletaBlangkoDerry.ukurKeadaan().lapor[NO.b].a).toBe(kosong.w.aletaBlangkoDerry.ukurKeadaan().lapor[NO.b].a);
  });

  it("hakim: putusan yang belum diputus = 'Belum ada yang perlu diisi'; yang sudah putus terukur dengan blangko putusan", async () => {
    const h = buka({ orang: "hakim" });
    await daftarRingkas(h);
    await tungguSelesaiUkur(h);
    expect(teksLencana(h, NO.b)).toBe("Belum ada yang perlu diisi");
    expect(teksLencana(h, NO.a)).toMatch(/^(Terisi \d+ dari \d+|Isian lengkap)$/);
    expect(h.w.aletaBlangkoDerry.ukurKeadaan().lapor[NO.a].blangko.berkas).toBe(BLANGKO_PUT);
  });

  it("ringan: paling banyak dua pembacaan serentak dan hanya membaca (tidak ada tulisan ke ABT atau portal)", async () => {
    const h = buka({ orang: "pp", tundaSusunan: 250 });
    await daftarRingkas(h);
    await tungguSelesaiUkur(h);
    expect(h.lalu.puncak).toBe(2);
    expect(h.w.aletaBlangkoDerry.ukurKeadaan().puncak).toBeLessThanOrEqual(2);
    expect(h.minta.filter((m) => m.cara !== "GET" && !/\/aleta-ecourt\/perkara-saya|\/ekstensi\//.test(m.url)).map((m) => `${m.cara} ${m.url}`)).toEqual([]);
    expect(h.minta.some((m) => /edit_data/.test(m.url))).toBe(false);
    expect(h.latar.filter((m) => m.jenis === "unduh").length).toBe(0);
  });

  it("hasil diingat: menggambar ulang daftar tidak mengukur ulang; lewat umur segar diukur lagi", async () => {
    const h = buka({ orang: "pp" });
    await daftarRingkas(h);
    await tungguSelesaiUkur(h);
    const jumlah = permintaanSusunan(h).length;
    expect(jumlah).toBe(2);
    // Ganti cara tampil = daftar digambar ulang.
    (q(h, '[data-lihat="tabel"]') as HTMLElement).click();
    await sampai(() => q(h, ".bd-tabelperkara [data-isian]"), "tabel tampil");
    await tunggu(60);
    expect(permintaanSusunan(h).length).toBe(jumlah);
    expect(teksLencana(h, NO.a)).toMatch(/Terisi|lengkap/);
    // Umur segar habis (0 ms) + gambar ulang = diukur ulang.
    h.w.aletaBlangkoDerry.aturUkur({ umurMs: 0 });
    (q(h, '[data-lihat="ringkas"]') as HTMLElement).click();
    await sampai(() => permintaanSusunan(h).length >= jumlah + 2, "diukur ulang");
  });

  it("hasil tersimpan di sessionStorage tab: halaman ABT berikutnya langsung menampilkannya tanpa mengukur ulang", async () => {
    const h = buka({ orang: "pp" });
    await daftarRingkas(h);
    await tungguSelesaiUkur(h);
    const mentah = h.w.sessionStorage.getItem("aleta-bd-ukur");
    expect(mentah).toBeTruthy();
    const simpan = JSON.parse(mentah as string);
    expect(Object.keys(simpan).sort()).toEqual([NO.a, NO.b].sort());
    expect(typeof simpan[NO.a].saat).toBe("number");
    const h2 = buka({ orang: "pp", sesiAwal: { "aleta-bd-ukur": simpan } });
    await daftarRingkas(h2);
    await tunggu(80);
    expect(teksLencana(h2, NO.a)).toMatch(/Terisi|lengkap/);
    expect(permintaanSusunan(h2).length).toBe(0);
  });

  it("blangko yang pernah dibuka petugas diukur (bukan saran): hasil lama yang sudah basi diukur ulang dengan blangko itu", async () => {
    const lama = { a: 1, t: 4, jenis: "bas", saat: Date.now() - 3 * 3600 * 1000, blangko: { berkas: BLANGKO_BAS_1, kelompok: "BAS CG", judul: "BAS CG" }, sumber: "dibuka", perkiraan: false, kunci: "akun:pp" };
    const h = buka({ orang: "pp", sesiAwal: { "aleta-bd-ukur": { [NO.a]: lama } } });
    await daftarRingkas(h);
    await tungguSelesaiUkur(h);
    const baca = permintaanSusunan(h).filter((s) => s.get("perkaraId") === "10154");
    expect(baca.length).toBe(1);
    expect(baca[0].get("berkas")).toBe(BLANGKO_BAS_1);
  });

  it("bot tidak menjawab nilai: lencana 'Isian belum terbaca', tanpa menyapu jendela ABT satu per satu", async () => {
    const h = buka({ orang: "pp", tanpaBot: true });
    await daftarRingkas(h);
    await sampai(() => qq(h, "[data-isian]").filter((x) => /Isian belum terbaca/.test(x.textContent || "")).length >= 2, "galat jujur");
    expect(h.minta.some((m) => /edit_data/.test(m.url))).toBe(false);
    expect(lencana(h, NO.a)!.getAttribute("title")).toMatch(/akan dicoba lagi/);
  });

  it("portal saran gagal: 'Isian belum terbaca', bukan 'Blangko belum dipilih'", async () => {
    const h = buka({ orang: "pp", sidangGagal: true });
    await daftarRingkas(h);
    await sampai(() => teksLencana(h, NO.a) === "Isian belum terbaca", "galat");
  });
});

// ============================================================================
describe("C. Lencana: keterangan dan klik membuka isian kosong pertama", () => {
  it("keterangan (tooltip) menjelaskan yang dihitung, blangko, dan kapan diukur", async () => {
    const h = buka({ orang: "pp" });
    await daftarRingkas(h);
    await tungguSelesaiUkur(h);
    const ket = lencana(h, NO.a)!.getAttribute("title") || "";
    expect(ket).toContain("Isian wajib blangko yang sudah terisi");
    expect(ket).toContain(BLANGKO_BAS);
    expect(ket).toMatch(/Diukur (baru saja|\d+ menit lalu)/);
    expect(ket).toContain("Klik untuk membuka");
    const kosong = buka({ orang: "pp", tanpaSaran: ["584"] });
    await daftarRingkas(kosong);
    await sampai(() => teksLencana(kosong, NO.d) === "Blangko belum dipilih", "tanpa blangko");
    expect(lencana(kosong, NO.d)!.getAttribute("title")).toMatch(/belum punya blangko yang dipilih/);
  });

  it("klik: perkara terbuka di langkah Isian dengan blangko yang diukur, lalu isian wajib kosong pertama digulir dan disorot", async () => {
    const h = buka({ orang: "pp" });
    await daftarRingkas(h);
    await tungguSelesaiUkur(h);
    const gulir: Element[] = [];
    h.w.Element.prototype.scrollIntoView = function (this: Element) {
      gulir.push(this);
    };
    lencana(h, NO.a)!.click();
    await sampai(() => h.w.aletaBlangkoDerryIsian.keadaan().blangko, "blangko terbuka");
    const kd = () => h.w.aletaBlangkoDerryIsian.keadaan();
    expect(kd().pk.nomorPerkara).toBe(NO.a);
    expect(kd().blangko.berkas).toBe(BLANGKO_BAS);
    const kartuKosong = await sampai(() => qq(h, "#bd-perlu .bd-f.bd-sorot")[0], "isian kosong disorot");
    // Yang disorot = kartu wajib pertama yang masih kosong, dan itu yang digulir ke tengah layar.
    expect(kartuKosong.getAttribute("data-f")).toBe("0007");
    expect(kartuKosong.classList.contains("beres")).toBe(false);
    expect(gulir.map((e) => e.getAttribute("data-f"))).toContain("0007");
  });

  it("klik pada perkara yang sudah terbuka blangkonya tidak memilih blangko lain; angka lencana ikut diperbarui sesudah dibuka", async () => {
    const h = buka({ orang: "pp" });
    await daftarRingkas(h);
    await tungguSelesaiUkur(h);
    lencana(h, NO.b)!.click();
    await sampai(() => h.w.aletaBlangkoDerryIsian.keadaan().susunan, "susunan termuat");
    await sampai(() => h.w.aletaBlangkoDerry.ukurKeadaan().lapor[NO.b].sumber === "dibuka", "dilaporkan dari langkah Isian");
    const lap = h.w.aletaBlangkoDerry.ukurKeadaan().lapor[NO.b];
    expect(lap.blangko.berkas).toBe(BLANGKO_BAS_1);
    expect(lap.a).toBeLessThanOrEqual(lap.t);
  });

  it("klik pada 'Blangko belum dipilih': perkara terbuka di langkah pilih blangko (tidak ada blangko yang dipaksakan)", async () => {
    const h = buka({ orang: "pp", tanpaSaran: ["584"] });
    await daftarRingkas(h);
    await sampai(() => teksLencana(h, NO.d) === "Blangko belum dipilih", "tanpa blangko");
    lencana(h, NO.d)!.click();
    await sampai(() => h.w.aletaBlangkoDerryIsian.keadaan().pk, "perkara terbuka");
    await tunggu(80);
    expect(h.w.aletaBlangkoDerryIsian.keadaan().pk.nomorPerkara).toBe(NO.d);
    expect(h.w.aletaBlangkoDerryIsian.keadaan().blangko).toBeNull();
  });
});
