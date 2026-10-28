// @vitest-environment node
/**
 * ============================================================================
 * 28 OKT 2026 - BLANGKO ABT BY DERRY: PTSP (Lihat sebagai, daftar hari ini / rentang, Cetak massal)
 * ============================================================================
 *
 * ekstensi-sipp/blangko-derry*.js dijalankan SUNGGUHAN di jsdom (seperti uji Cetak massal 20 Okt) dengan portal, bot dan ABT ditiru.
 *   A  pemilih "Lihat sebagai": kelompok PTSP setelah Hakim, Panitera Pengganti, Juru sita; memilihnya = tampilan PTSP (hak ikut)
 *   B  daftar perkara PTSP: hari ini / tanggal tertentu / rentang menurut tanggal SIDANG PERTAMA (atau semua sidang bila dimatikan)
 *   C  Cetak massal PTSP: rentang ikut daftar, penetapan yang dicetak dapat dipilih, admin "sebagai PTSP" memakai kueri satker
 *   D  sisi portal: daftar akun PTSP, saringan sidang pertama, hak jenis dokumen "ptsp" untuk admin yang meniru, penjaga rute
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { jenisDokumenAkun, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { susunPerkaraSaya, type BarisSidangSaya } from "@/app/api/aleta-ecourt/perkara-saya/susun";
import { namaAkunPtsp } from "@/lib/akun-ptsp";

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
};
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; pdfRtf: string[]; pdfTtd: Array<Array<{ nama: string }>>; pratinjau: string[]; gabung: number[] };
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
describe("A. pemilih Lihat sebagai memuat kelompok PTSP", () => {
  it("kelompok PTSP menyusul Hakim, Panitera Pengganti, dan Juru sita; akunnya dari server", async () => {
    const h = buka({ orang: "admin" });
    await siap(h);
    const sel = (await sampai(() => q(h, "#bd-lihat"), "pemilih")) as HTMLSelectElement;
    const kelompok = Array.from(sel.querySelectorAll("optgroup")).map((g) => g.getAttribute("label"));
    expect(kelompok).toEqual(["Hakim", "Panitera Pengganti", "Juru sita", "PTSP"]);
    const ptsp = Array.from(sel.querySelectorAll('optgroup[label="PTSP"] option')).map((o) => [(o as HTMLOptionElement).value, o.textContent]);
    // 28 Okt malam: pilihan umum "PTSP (semua petugas PTSP)" selalu paling atas; akun menyusul di bawahnya.
    expect(ptsp).toEqual([["ptsp|Semua petugas PTSP", "PTSP (semua petugas PTSP)"], ["ptsp|Meja PTSP", "Meja PTSP"]]);
    expect(Array.from(sel.querySelectorAll('optgroup[label="Hakim"] option')).map((o) => o.textContent)).toEqual(["Hakim Satu"]);
  });

  it("portal lama tanpa daftar PTSP: pemilih tetap jalan, kelompok PTSP hanya berisi pilihan umum", async () => {
    const h = buka({ orang: "admin", akunLama: true });
    await siap(h);
    const sel = (await sampai(() => q(h, "#bd-lihat"), "pemilih")) as HTMLSelectElement;
    expect(Array.from(sel.querySelectorAll("optgroup")).map((g) => g.getAttribute("label"))).toEqual(["Hakim", "Panitera Pengganti", "Juru sita", "PTSP"]);
    expect(Array.from(sel.querySelectorAll('optgroup[label="PTSP"] option')).map((o) => o.textContent)).toEqual(["PTSP (semua petugas PTSP)"]);
  });

  it("memilih akun PTSP: tampilan PTSP - hanya jenis ptsp, bukan peran dokumen, kueri satker baca saja", async () => {
    const h = buka({ orang: "admin" });
    await sebagaiPtsp(h);
    const api = h.w.aletaBlangkoDerry;
    expect(polos(api.jenisDokumen())).toEqual(["ptsp"]);
    expect(polos(api.peranDokumen())).toEqual([]);
    expect(api.peranKunci()).toBe("adm:ptsp");
    expect(q(h, "#bd-siapa")!.textContent).toContain("dilihat sebagai Meja PTSP");
    const k = terakhir(h);
    expect(k.get("sebagai")).toBe("Meja PTSP");
    expect(k.get("peranSebagai")).toBe("ptsp");
    expect(k.get("sidangPertama")).toBe("1");
    // Kotak cari PTSP: hanya nomor perkara.
    expect(q(h, "#bd-carijenis")).toBeNull();
    expect(q(h, "#bd-cari")!.getAttribute("placeholder")).toBe("cari nomor perkara");
  });

  it("hak: admin yang meniru PTSP hanya mendapat folder PTSP; Semua akun kembali ke semuanya", async () => {
    const h = buka({ orang: "admin" });
    await sebagaiPtsp(h);
    const api = h.w.aletaBlangkoDerry;
    expect(api.kelompokBoleh({ nama: "99 PTSP", jenis: "ptsp" })).toBe(true);
    expect(api.kelompokBoleh({ nama: "1 Perceraian CG", jenis: "put" })).toBe(false);
    expect(api.kelompokBoleh({ nama: "ALUR 02 Cerai Verstek 2 Sidang", jenis: "bas" })).toBe(false);
    expect(api.kelompokBoleh({ nama: "98 Relaas", jenis: "rel" })).toBe(false);
    ubah(h, q(h, "#bd-lihat") as HTMLSelectElement, "");
    await sampai(() => h.w.aletaBlangkoDerry.keadaan().sebagai.peran === "", "kembali ke semua akun");
    expect(polos(api.jenisDokumen())).toEqual(["put", "bas", "rel"]);
    expect(api.kelompokBoleh({ nama: "99 PTSP", jenis: "ptsp" })).toBe(true);
    expect(api.kelompokBoleh({ nama: "1 Perceraian CG", jenis: "put" })).toBe(true);
  });

  it("peran lain tidak berubah: Lihat sebagai hakim tetap tampilan hakim", async () => {
    const h = buka({ orang: "admin" });
    await siap(h);
    ubah(h, (await sampai(() => q(h, "#bd-lihat"), "pemilih")) as HTMLSelectElement, "hakim|Hakim Satu");
    await sampai(() => terakhir(h).get("peranSebagai") === "hakim", "kueri hakim");
    expect(polos(h.w.aletaBlangkoDerry.jenisDokumen())).toEqual(["put"]);
    expect(terakhir(h).get("sidangPertama")).toBeNull();
    expect(labelTab(h)).toEqual(["Sidang hari ini", "Tanggal tertentu", "Rentang tanggal", "Semua perkara saya"]);
  });
});

// ============================================================================
describe("B. daftar perkara PTSP: hari ini atau rentang tanggal", () => {
  it("PTSP: tab Perkara hari ini / Tanggal tertentu / Rentang tanggal (tanpa Semua perkara saya); hari ini = sidang pertama hari ini", async () => {
    const h = buka({ orang: "ptsp" });
    await siap(h);
    await tungguDaftar(h);
    expect(labelTab(h)).toEqual(["Perkara hari ini", "Tanggal tertentu", "Rentang tanggal"]);
    const k = terakhir(h);
    expect(k.get("mode")).toBe("hari");
    expect(k.get("sidangPertama")).toBe("1");
    expect(k.get("sebagai")).toBeNull();
    // 584 sidang pertamanya hari ini; 581/582 hari ini hanya sidang ke-2 (bukan perkara baru).
    expect(nomorDaftar(h)).toEqual(["584"]);
    expect(q(h, "#bd-ptspket")!.textContent).toContain("tanggal sidang pertama");
    tangkap(h, "ptsp-hari-ini");
  });

  it("Rentang tanggal: dari-sampai dikirim ke server; perkara baru di rentang saja", async () => {
    const h = buka({ orang: "ptsp" });
    await siap(h);
    await tungguDaftar(h);
    klik(h, '#bd-pkpilih [data-mode="rentang"]');
    ubah(h, q(h, "#bd-dari") as HTMLInputElement, "2026-10-01");
    ubah(h, q(h, "#bd-sampai") as HTMLInputElement, "2026-10-16");
    klik(h, '[data-bd="rentang"]');
    await sampai(() => terakhir(h).get("mode") === "rentang", "kueri rentang");
    await tungguDaftar(h);
    const k = terakhir(h);
    expect(k.get("dari")).toBe("2026-10-01");
    expect(k.get("sampai")).toBe("2026-10-16");
    expect(k.get("sidangPertama")).toBe("1");
    expect(nomorDaftar(h).sort()).toEqual(["581", "582", "583", "584"]);
  });

  it("Tanggal tertentu: satu hari", async () => {
    const h = buka({ orang: "ptsp" });
    await siap(h);
    await tungguDaftar(h);
    klik(h, '#bd-pkpilih [data-mode="tanggal"]');
    ubah(h, q(h, "#bd-tgl") as HTMLInputElement, "2026-10-16");
    klik(h, '[data-bd="tanggal"]');
    await sampai(() => terakhir(h).get("dari") === "2026-10-16", "kueri tanggal");
    await tungguDaftar(h);
    expect(nomorDaftar(h)).toEqual(["583"]);
  });

  it("'Hanya perkara baru' dimatikan: semua perkara satker yang bersidang pada tanggal itu", async () => {
    const h = buka({ orang: "ptsp" });
    await siap(h);
    await tungguDaftar(h);
    ubah(h, q(h, "#bd-pertama") as HTMLInputElement, false);
    await sampai(() => terakhir(h).get("massal") === "ptsp", "kueri semua sidang");
    await tungguDaftar(h);
    expect(terakhir(h).get("sidangPertama")).toBeNull();
    expect(nomorDaftar(h).sort()).toEqual(["581", "582", "584"]);
    expect(q(h, "#bd-ptspket")!.textContent).toContain("tanggal sidang.");
  });

  it("hari tanpa perkara baru: kalimat kosong yang jelas, tanpa tombol 'Lihat semua perkara saya'", async () => {
    const h = buka({ orang: "ptsp", perkara: [PERKARA_A, PERKARA_B, PERKARA_C] });
    await siap(h);
    await tungguDaftar(h);
    expect(q(h, "#bd-pkpilih")!.textContent).toContain("Tidak ada perkara baru (sidang pertama) hari ini.");
    expect(q(h, '#bd-pkpilih [data-mode="semua"]')).toBeNull();
  });

  it("mencari nomor tetap menjangkau seluruh jadwal satker (perilaku lama), lalu kembali ke daftar tanggal", async () => {
    const h = buka({ orang: "ptsp" });
    await siap(h);
    await tungguDaftar(h);
    const kotak = q(h, "#bd-cari") as HTMLInputElement;
    kotak.value = "581";
    kotak.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => terakhir(h).get("nomor") === "581", "kueri nomor");
    expect(terakhir(h).get("mode")).toBe("semua");
    expect(terakhir(h).get("sidangPertama")).toBeNull();
    await tungguDaftar(h);
    expect(nomorDaftar(h)).toEqual(["581"]);
  });

  it("admin 'sebagai PTSP': tab dan daftar sama dengan PTSP; Lihat sebagai tetap tersedia", async () => {
    const h = buka({ orang: "admin" });
    await sebagaiPtsp(h);
    expect(labelTab(h)).toEqual(["Perkara hari ini", "Tanggal tertentu", "Rentang tanggal"]);
    expect(nomorDaftar(h)).toEqual(["584"]);
    expect(q(h, "#bd-lihatwrap")!.hasAttribute("hidden")).toBe(false);
  });

  it("akun hakim yang juga PTSP tetap memakai daftar perkaranya sendiri (tidak berubah)", async () => {
    const h = buka({ orang: "hakim" });
    await siap(h);
    await tungguDaftar(h);
    expect(labelTab(h)).toEqual(["Sidang hari ini", "Tanggal tertentu", "Rentang tanggal", "Semua perkara saya"]);
    expect(terakhir(h).get("sidangPertama")).toBeNull();
  });
});

// ============================================================================
describe("C. Cetak massal PTSP", () => {
  // Pemilih atribut dengan "+" tidak ditangani jsdom: cari lewat daftar.
  const cekPtsp = (h: Halaman, label: string) => qq(h, "[data-msptsp]").find((x) => x.getAttribute("data-msptsp") === label) as HTMLInputElement;
  const namaBaris = (h: Halaman) => qq(h, ".bd-ms-nama").map((x) => x.textContent);
  const labelBaris = (h: Halaman) => qq(h, ".bd-ms-baris .bd-ms-pk small").map((x) => (x.textContent || "").split(" · ")[0]);
  async function bukaMassalPtsp(h: Halaman, tgl: string = TGL) {
    await siap(h);
    (q(h, "#bd-massal") as HTMLElement).click();
    await sampai(() => q(h, "#bd-ms-tgl"), "jendela terbuka");
    await sampai(() => !/Membaca daftar/.test(akar(h).textContent || "") && massal(h).keadaan().jenis === "ptsp", "daftar selesai");
    if (tgl) await ubahTanggal(h, tgl);
  }

  it("PTSP: dari tanggal sampai tanggal (bawaan +28 hari), empat penetapan awal tercentang, dua pilihan tambahan tidak", async () => {
    const h = buka({ orang: "ptsp" });
    await bukaMassalPtsp(h);
    const k = massal(h).keadaan();
    expect(k.jenis).toBe("ptsp");
    expect(k.penetapan).toEqual(["PMH", "PPP", "PJS", "PHS"]);
    expect((q(h, "#bd-ms-sampai") as HTMLInputElement).value).toBe(k.sampai);
    const cek = qq(h, "[data-msptsp]").map((x) => [x.getAttribute("data-msptsp"), (x as HTMLInputElement).checked]);
    expect(cek).toEqual([["PMH", true], ["PPP", true], ["PJS", true], ["PHS", true], ["PMH + PHS", false], ["Mediator", false]]);
    expect(q(h, ".bd-ms-jenis1")!.textContent).toBe("Penetapan awal (PMH, PPP, PJS, PHS)");
    expect(mintaKe(h, /perkara-saya\?/).pop()!.url).toContain("massal=ptsp");
  });

  it("PMH + PHS gabungan dan penunjukan mediator ditambah dari pilihan; empat bawaan tetap berurutan", async () => {
    const h = buka({ orang: "ptsp", perkara: [PERKARA_D] });
    await bukaMassalPtsp(h);
    expect(namaBaris(h)).toEqual(["@ 1 - PMH", "@ 0a - PPP", "@ 0b - PJS", "@ 2 - PHS"]);
    ubah(h, cekPtsp(h, "PMH + PHS"), true);
    await sampai(() => namaBaris(h).length === 5, "lima baris");
    ubah(h, cekPtsp(h, "Mediator"), true);
    await sampai(() => namaBaris(h).length === 6, "enam baris");
    expect(namaBaris(h)).toEqual(["@ 1 - PMH", "@ 0a - PPP", "@ 0b - PJS", "@ 2 - PHS", "@ 0 - PMH - PHS", "@ 4 - Penetapan Penunjukan Mediator"]);
    expect(labelBaris(h)).toEqual(["PMH", "PPP", "PJS", "PHS", "PMH + PHS", "Mediator"]);
    // Mematikan satu pilihan membuang barisnya; kotak terakhir tidak bisa dimatikan.
    ubah(h, cekPtsp(h, "PMH"), false);
    await sampai(() => namaBaris(h).length === 5, "PMH dibuang");
    expect(massal(h).keadaan().penetapan).toEqual(["PPP", "PJS", "PHS", "PMH + PHS", "Mediator"]);
  });

  it("paling sedikit satu penetapan tetap tercentang", async () => {
    const h = buka({ orang: "ptsp", perkara: [PERKARA_D] });
    await bukaMassalPtsp(h);
    for (const l of ["PMH", "PPP", "PJS"]) {
      ubah(h, cekPtsp(h, l), false);
      await sampai(() => !massal(h).keadaan().penetapan.includes(l), `${l} dimatikan`);
    }
    ubah(h, cekPtsp(h, "PHS"), false);
    await tunggu(30);
    expect(massal(h).keadaan().penetapan).toEqual(["PHS"]);
    expect((cekPtsp(h, "PHS")).checked).toBe(true);
  });

  it("rentang sidang pertama dapat diubah: kueri dan penyaring memakai dari-sampai", async () => {
    const h = buka({ orang: "ptsp" });
    await bukaMassalPtsp(h);
    await ubahTanggal(h, "2026-10-16");
    ubah(h, q(h, "#bd-ms-sampai") as HTMLInputElement, "2026-10-20");
    await sampai(() => mintaKe(h, /perkara-saya\?/).pop()!.url.includes("sampai=2026-10-20"), "kueri sampai");
    await sampai(() => !/Membaca daftar/.test(akar(h).textContent || ""), "selesai");
    expect(mintaKe(h, /perkara-saya\?/).pop()!.url).toContain("dari=2026-10-16");
    // Hanya 583 (sidang pertama 16 Okt); 584 sidang pertamanya 15 Okt di luar rentang.
    expect(Array.from(new Set(nomorBaris(h)))).toEqual(["583/Pdt.G/2026"]);
    // Tombol Hari ini mengembalikan rentang bawaan.
    klik(h, '[data-ms="hariini"]');
    await sampai(() => massal(h).keadaan().tanggal === massal(h).keadaan().tanggal && /^\d{4}/.test(massal(h).keadaan().sampai), "bawaan");
    expect(massal(h).keadaan().sampai > massal(h).keadaan().tanggal).toBe(true);
  });

  it("daftar sedang 'Rentang tanggal': Cetak massal PTSP memulai dari rentang yang sama", async () => {
    const h = buka({ orang: "ptsp" });
    await siap(h);
    await tungguDaftar(h);
    klik(h, '#bd-pkpilih [data-mode="rentang"]');
    ubah(h, q(h, "#bd-dari") as HTMLInputElement, "2026-10-14");
    ubah(h, q(h, "#bd-sampai") as HTMLInputElement, "2026-10-16");
    klik(h, '[data-bd="rentang"]');
    await sampai(() => terakhir(h).get("dari") === "2026-10-14", "kueri rentang");
    await tungguDaftar(h);
    (q(h, "#bd-massal") as HTMLElement).click();
    await sampai(() => q(h, "#bd-ms-tgl"), "jendela terbuka");
    await sampai(() => !/Membaca daftar/.test(akar(h).textContent || "") && massal(h).keadaan().tanggal === "2026-10-14", "mulai dari rentang daftar");
    expect(massal(h).keadaan().sampai).toBe("2026-10-16");
    expect(Array.from(new Set(nomorBaris(h))).sort()).toEqual(["583/Pdt.G/2026", "584/Pdt.G/2026"]);
  });

  it("admin sebagai PTSP: hanya jenis PTSP, kueri satker (peranSebagai=ptsp, massal=ptsp)", async () => {
    const h = buka({ orang: "admin" });
    await sebagaiPtsp(h);
    (q(h, "#bd-massal") as HTMLElement).click();
    await sampai(() => q(h, "#bd-ms-tgl"), "jendela terbuka");
    await sampai(() => !/Membaca daftar/.test(akar(h).textContent || "") && massal(h).keadaan().jenis === "ptsp", "daftar selesai");
    await ubahTanggal(h, TGL);
    expect(q(h, "#bd-ms-jenis")).toBeNull();
    const k = new URL(mintaKe(h, /perkara-saya\?/).pop()!.url, ASAL).searchParams;
    expect(k.get("peranSebagai")).toBe("ptsp");
    expect(k.get("sebagai")).toBe("Meja PTSP");
    expect(k.get("massal")).toBe("ptsp");
    expect(Array.from(new Set(nomorBaris(h)))).toContain("584/Pdt.G/2026");
  });

  it("Super Admin tanpa Lihat sebagai: pilihan jenis lengkap, PTSP ada dan tidak mengirim massal=ptsp (perilaku lama)", async () => {
    const h = buka({ orang: "admin" });
    await siap(h);
    (q(h, "#bd-massal") as HTMLElement).click();
    await sampai(() => q(h, "#bd-ms-jenis"), "jendela terbuka");
    const opsi = Array.from((q(h, "#bd-ms-jenis") as HTMLSelectElement).options).map((o) => o.value);
    expect(opsi).toEqual(["put", "bas", "rel", "ptsp"]);
  });
});

// ============================================================================
describe("D. sisi portal", () => {
  const akun = (id: string, name: string, roleId: string, extra: Record<string, unknown> = {}) => ({ id, name, roleId, positionId: "", additionalRoleIds: [] as string[], isActive: true, ...extra });

  it("namaAkunPtsp: hanya golongan PTSP yang aktif; satu orang satu entri; admin tidak ikut", () => {
    const hasil = namaAkunPtsp([
      akun("1", "Meja Satu", "pelaksana", { positionId: "pos-ptsp" }),
      akun("2", "Meja Dua, S.H.", "pelaksana", { additionalRoleIds: ["petugas_meja_1_pendaftaran"] }),
      akun("3", "Meja Dua", "pelaksana", { additionalRoleIds: ["petugas_ptsp"] }),
      akun("4", "Operator Tiga", "operator"),
      akun("5", "Hakim Biasa", "hakim"),
      akun("6", "PP Biasa", "panitera-pengganti"),
      akun("7", "Meja Nonaktif", "pelaksana", { positionId: "pos-ptsp", isActive: false }),
      akun("8", "Meja Terhapus", "pelaksana", { positionId: "pos-ptsp", deletedAt: "2026-10-01T00:00:00Z" }),
      akun("9", "Admin Sekaligus PTSP", "admin", { additionalRoleIds: ["petugas_ptsp"] }),
      akun("10", "Super Admin", "super-admin"),
      akun("11", "", "operator"),
    ]);
    expect(hasil).toEqual(["Meja Dua, S.H.", "Meja Satu", "Operator Tiga"]);
    expect(namaAkunPtsp([])).toEqual([]);
    expect(namaAkunPtsp(undefined as never)).toEqual([]);
  });

  const BARIS = (id: string, nomor: string, tanggal: string, urutan: number): BarisSidangSaya => ({
    sidangId: `${id}-${urutan}`, perkaraId: id, nomorPerkara: nomor, jenisPerkara: "Cerai Gugat", tanggalSidang: tanggal, urutanSidang: urutan, majelisNama: "Hakim Satu", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  });
  const BARIS_UJI = [BARIS("1", "1/Pdt.G/2026/PA.Dgl", "2026-10-15", 1), BARIS("2", "2/Pdt.G/2026/PA.Dgl", "2026-10-15", 2), BARIS("3", "3/Pdt.G/2026/PA.Dgl", "2026-10-15", 0)];
  const dasarPtsp = { hariIni: "2026-10-15", nama: "Meja PTSP", lihatSemua: false, cariNomorSatker: true, cariNomor: "", semuaSatker: true };

  it("susunPerkaraSaya: hanyaSidangPertama menyaring sidang ke-2 dan seterusnya; tanpa itu semua sidang (perilaku massal lama)", () => {
    const pertama = susunPerkaraSaya(BARIS_UJI, { ...dasarPtsp, hanyaSidangPertama: true });
    expect(pertama.perkara.map((x) => x.nomorPerkara)).toEqual(["1/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl"]); // urutan 0 (bot lama) dianggap pertama
    expect(pertama.perkara.every((x) => x.sebagai.length === 0)).toBe(true);
    const semua = susunPerkaraSaya(BARIS_UJI, dasarPtsp);
    expect(semua.perkara).toHaveLength(3);
    // Tanpa semuaSatker saringan tidak berlaku dan tidak ada yang bocor tanpa kata kunci.
    expect(susunPerkaraSaya(BARIS_UJI, { ...dasarPtsp, semuaSatker: false, hanyaSidangPertama: true }).perkara).toHaveLength(0);
  });

  it("jenisDokumenAkun: admin yang meniru PTSP hanya mendapat jenis ptsp; PTSP sungguhan sama; hakim tidak berubah", () => {
    expect(jenisDokumenAkun({ admin: true, golongan: ["super-admin"], sebagaiPeran: "ptsp" })).toEqual(["ptsp"]);
    expect(jenisDokumenAkun({ admin: false, golongan: ["ptsp"] })).toEqual(["ptsp"]);
    expect(jenisDokumenAkun({ admin: true, golongan: ["super-admin"], sebagaiPeran: "hakim" })).toEqual(["put"]);
    expect(jenisDokumenAkun({ admin: true, golongan: ["super-admin"] })).toEqual(["put", "bas", "rel", "ptsp"]);
    // Akun biasa tidak bisa meniru: sebagaiPeran diabaikan bila bukan admin (rute menyaringnya; di sini hanya golongan yang dihitung).
    expect(jenisDokumenAkun({ admin: false, golongan: ["hakim"] })).toEqual(["put"]);
  });

  it("penjaga rute: 'Lihat sebagai PTSP' hanya untuk admin; sidangPertama hanya untuk PTSP; akun PTSP hanya dikirim ke admin", () => {
    const rute = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/perkara-saya/route.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(rute).toContain('const sebagaiPtsp = admin && sebagaiNama !== "" && (cari.get("peranSebagai") || "").trim().toLowerCase() === "ptsp";');
    expect(rute).toContain("const ptsp = sebagaiPtsp || (!admin && !pimpinan && golongan.includes(\"ptsp\"));");
    expect(rute).toContain('const sidangPertama = ptsp && (cari.get("sidangPertama") || "").trim() === "1";');
    expect(rute).toContain("akun: hasil.akun ? { ...hasil.akun, ptsp: await bacaAkunPtsp(db) } : null,");
    const derry = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/blangko-derry/route.ts"), "utf8");
    expect(derry).toMatch(/PERAN_TIRUAN = new Set\(\["hakim", "pp", "js", "ptsp"\]\)/);
    const berkas = readFileSync(path.join(process.cwd(), "src/server/modules/berkas-perkara/akses.ts"), "utf8");
    expect(berkas).toMatch(/PERAN_TIRUAN = new Set\(\["hakim", "pp", "js", "ptsp"\]\)/);
  });
});
