// @vitest-environment node
/**
 * ============================================================================
 * 30 OKT 2026 - CATATAN TEMUAN CETAK: PUTUSAN VERSTEK PADAHAL SIPP MENCATAT TERGUGAT HADIR
 * ============================================================================
 * Aturan SAMA PERSIS dengan deteksi konflik paket ABT relaas-penetapan-30okt: perkara gugatan (alur 15); amar putusan SIPP memuat
 * "verstek"; sidang dengan pilihan kehadiran SIPP 1, 3, 8, 9, 11 atau 15 dan tanggal sidang <= tanggal putusan.
 * Yang dijaga (perilaku, jsdom, harness sama dengan blangko-derry-saksi-kosong-30okt):
 *   1. putusan verstek (catatan putusan SIPP) + Tergugat tercatat hadir -> temuan menyebut sidangnya, tanpa istilah teknis;
 *   2. tiap pilihan kehadiran yang memuat Tergugat menimbulkan temuan, yang tidak memuat Tergugat tidak;
 *   3. sidang sesudah tanggal putusan tidak dihitung; permohonan tidak diperiksa; bukan verstek = tanpa temuan;
 *   4. cerai talak menyebut Termohon; BAS juga memperlihatkan temuan; temuan tidak menahan cetak dan dicatat sesudah cetak.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PILIHAN_ALASAN, kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { hurufAlasan, tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

void PILIHAN_ALASAN;
void hurufAlasan;

// ----------------------------------------------------------------------------
// Rute bot SUNGGUHAN (/abt/usulan) di node:vm; SIPP ditiru.
// ----------------------------------------------------------------------------
const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");
const require_ = createRequire(BERKAS_RUTE);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let penanganBot: (body: unknown) => Promise<{ status: number; json: any }>;
const POSITA_DASAR =
  "Bahwa Penggugat dan Tergugat menikah pada tanggal 17 Januari 2014 dan pernikahan tersebut dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah;" +
  "bahwa setelah menikah Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Donggala selama 10 tahun; " +
  "bahwa dari pernikahan tersebut telah dikaruniai 2 orang anak; " +
  "bahwa sejak bulan Maret 2025 rumah tangga Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran disebabkan Tergugat tidak memberi nafkah dan sering berjudi; " +
  "bahwa sejak bulan Juni 2025 Tergugat pergi meninggalkan rumah dan hingga kini tidak pernah kembali sehingga Penggugat dan Tergugat telah berpisah tempat tinggal; " +
  "bahwa pihak keluarga telah berupaya merukunkan Penggugat dan Tergugat namun tidak berhasil;";
let POSITA = POSITA_DASAR;
const IDENTITAS = [
  { pihak: "P", urutPihak: 1, nama: "Saksi Satu", umur: 45, agama: "Islam", pendidikan: "SLTA", pekerjaan: "Petani", alamat: "Donggala", keterangan: "ibu kandung Penggugat" },
  { pihak: "P", urutPihak: 2, nama: "Saksi Dua", umur: 38, agama: "Islam", pendidikan: "SLTA", pekerjaan: "Pedagang", alamat: "Donggala", keterangan: "tetangga Penggugat" },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asli: Record<string, any> = {};
beforeAll(() => {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
  const awal = isi.lastIndexOf("\n// ====", tanda);
  const akhir = isi.indexOf('router.post("/abt/pdf"');
  if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const konteks = vm.createContext({
    require: (p: string) => require_(p),
    abtUsulanService: require_("../services/abtUsulanService"),
    requireInternalToken: () => undefined,
    router: { post: (jalur: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[jalur] = f) },
    console,
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
  const f = rute["/abt/usulan"];
  penanganBot = async (body) => {
    let status = 200;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = null;
    await f(
      { body: JSON.parse(JSON.stringify(body)) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { status: (s: number) => ((status = s), { json: (j: any) => void (json = j) }), json: (j: any) => void (json = j) }
    );
    return { status, json };
  };
  // Pembacaan SIPP ditiru (hanya SELECT di aslinya): posita/tanggal sidang, mediasi, identitas saksi.
  const svc = require_("../services/abtUsulanService");
  const sb = require_("../services/saksiBantuService");
  asli.konteks = svc.konteksPerkaraSaksi;
  asli.mediasi = svc.mediasiPerkara;
  asli.identitas = sb.identitasSaksiBerbatas;
  svc.konteksPerkaraSaksi = async () => ({ posita: POSITA, tanggalSidang: "2026-10-15", jenisPerkaraId: 347 });
  svc.mediasiPerkara = async () => ({ selesai: true, berhasil: false, dilaksanakan: true, hasil: "T" });
  sb.identitasSaksiBerbatas = async () => IDENTITAS;
});
afterAll(() => {
  const svc = require_("../services/abtUsulanService");
  const sb = require_("../services/saksiBantuService");
  svc.konteksPerkaraSaksi = asli.konteks;
  svc.mediasiPerkara = asli.mediasi;
  sb.identitasSaksiBerbatas = asli.identitas;
});


const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-saksi.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-27";
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
const BLANGKO_BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";
const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("4001", "AMAR PUTUSAN CERAI UNIVERSAL", "data_sql", "select data from aps_badilag.abt_data_teks where no_var = '8503'"),
  D("8503", "ALASAN PERCERAIAN <br>SATU HURUF", "data_teks"),
  D("8536", "Putusan pidana (khusus alasan C) #11116#", "data_teks"),
  D("0227", "Tanggal Fasakh / Murtad #11117#", "data_tanggal"),
  D("0156", "Kantor Kuasa #0046# #11111#", "data_teks"),
  D("0184", "Tgl. Surat Kuasa #0046# #11111#", "data_tanggal"),
  D("0007", "Telah Dikarunai Anak", "data_teks", "", "#8492#"),
  D("1214", "Alat-alat bukti CG/CT", "data_teks", "", "Fotokopi KTP-el atas nama #4048#"),
  D("2021", "Keterangan Saksi 1 P", "tanya_jawab"),
  D("5058", "TanyaJwb Saksi 1 P", "tanya_jawab"),
  D("2022", "Keterangan Saksi 2 P", "tanya_jawab"),
  D("2023", "Keterangan Saksi 3 P", "tanya_jawab"),
  D("5060", "TanyaJwb Saksi 3 P", "tanya_jawab"),
  D("5059", "TanyaJwb Saksi 2 P", "tanya_jawab"),
  D("11111", "PENANDA ADA KUASA #0046#", "data_sql", "select ..."),
  D("11116", "PENANDA ALASAN C (8503)", "data_sql", "select ..."),
  D("11117", "PENANDA ALASAN H (8503)", "data_sql", "select ..."),
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
]);
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1214", "2021", "2022", "0156", "0184", "8536", "0227", "11111", "11116", "11117", "0033"];
const PENANDA_BAS_DASAR = ["0001", "0033", "0050", "1214", "5058", "5059", "8503"];
let PENANDA_BAS = PENANDA_BAS_DASAR;
const BAWAAN_1214 =
  "Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama YULFIANI, NIK 7271036411920011 tanggal 23 April 2025, yang dikeluarkan oleh Pemerintah Kabupaten Sigi, Provinsi Sulawesi Tengah, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;\n" +
  "Fotokopi Kutipan Akta Nikah, Nomor 0114/04/IV/2021 tanggal 05 April 2021, yang dikeluarkan oleh KUA Palu Selatan, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2 serta diberi tanggal dan paraf oleh Ketua Majelis;";
const RTF_PUT = (isi0007: string) =>
  `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}}{\\colortbl;\\red0\\green0\\blue0;}` +
  `\\pard\\qc\\b PUTUSAN\\b0\\par\\pard\\qc Nomor 581/Pdt.G/2026/PA.Dgl\\par` +
  `\\pard\\qj Menimbang, bahwa alasan perceraian huruf F telah terbukti; dari pernikahan ${isi0007};\\par` +
  `\\pard\\ql Kuasa: ...; putusan pidana #9999#\\par` +
  `\\trowd\\cellx3000\\cellx6000\\pard\\intbl Hakim Satu, S.H.\\cell Hakim Dua, M.H.\\cell\\row\\pard\\par}`;
const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const PK = (nomor: string, jenis: string, sidang: unknown[], extra: Record<string, unknown> = {}) => ({
  nomorPerkara: `${nomor}/PA.Dgl`, perkaraId: "10154", jenisPerkara: jenis, alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H., Hakim Dua, M.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim"], pihak: { penggugat: ["Yulfiani binti Tasbih"], tergugat: ["Andi Rustam bin Syamsudin"] }, sidang, ...extra,
});
const DAFTAR_ = (o: Uji) => [PK("581/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-01", "Sidang Pertama", "Tergugat tidak hadir", { urutan: 1, hadir: hadirKe(o, 1) }), SI("2026-10-15", "Panggil Tergugat", "Tergugat tidak hadir", { urutan: 2, hadir: hadirKe(o, 2) }), SI("2026-10-27", "Panggil Tergugat", ketAkhir(o), { urutan: 3, hadir: hadirKe(o, 3) })], { sudahPutus: true, tanggalPutusan: o.tanggalPutusan ?? HARI_INI, alurPerkaraId: o.alur ?? 15 })];
type Uji = { hadir?: Record<number, number>; verstek?: boolean; tanggalPutusan?: string; alur?: number; botLama?: boolean };
const hadirKe = (o: Uji, urutan: number) => (o.hadir && o.hadir[urutan]) || null;
// Bot sungguhan: amarVerstek dari amar UTUH; bot lama tanpa ruas itu -> amarRingkas. Ruas verstek (putusan_verstek) sengaja dibuat
// berlawanan agar uji membuktikan panel TIDAK memakainya (aturan relaas: amar memuat "verstek").
const putusanUji = (o: Uji) => {
  const v = o.verstek !== false;
  const tgl = o.tanggalPutusan ?? HARI_INI;
  const amarRingkas = v ? "MENGADILI: 1. Menyatakan Tergugat telah dipanggil secara resmi dan patut ... ; 2. Mengabulkan gugatan Penggugat secara Verstek;" : "MENGADILI: 1. Mengabulkan gugatan Penggugat;";
  // G2B 30 Okt malam: tanda Verstek SIPP sejalan dengan amar (dulu `!v`); tanda yang bertentangan kini catatan temuan tersendiri
  // (temuanTandaVerstek, diuji di saran-keadaan-g2b-30okt) dan tidak boleh ikut mengotori uji kehadiran ini.
  return o.botLama ? { sudahPutus: Boolean(tgl), tanggalPutusan: tgl, verstek: v, amarRingkas } : { sudahPutus: Boolean(tgl), tanggalPutusan: tgl, verstek: v, amarRingkas, amarVerstek: v };
};
const ketAkhir = (o: Uji) => (o.verstek === false ? "putus DIKABULKAN" : "putus DIKABULKAN (verstek)");
const AKUN = { hakim: ["Hakim Satu", "Hakim Dua"], pp: ["PP Satu"], js: ["JS Satu"] };
type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};

const MENU = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${BERANDA}?a=D1&c=" title="(2 Blangko)">Putusan CG</a><a href="${BERANDA}?a=D2&c=" title="(2 Blangko)">BAS CG</a></div>`;
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");
const POPUP = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>581/Pdt.G/2026/PA.Dgl</b>` +
  (tipe === "data_tanggal" ? `<input type='text' id='tgl_form' value='${nilai}'>` : `<textarea id="value" ${tipe === "data_sql" ? "readonly" : ""}>${nilai}</textarea>`);

type Minta = { url: string; cara: string; badan: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; tj: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; pdfRtf: string[]; opsi: { hakTolak?: boolean } };
const terbuka: JSDOM[] = [];
const usulanMinta: any[] = [];
const usulanAlasan: any[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; jenis?: string; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array; uji?: Uji } = {}): Halaman {
  const uji: Uji = p.uji ?? {};
  const DAFTAR = DAFTAR_(uji);
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Panitera</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const latar: Array<Record<string, unknown>> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.200.2" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (pesan: Record<string, unknown>, cb?: (h: unknown) => void) => {
        latar.push(polos(pesan));
        if (cb) cb({ ok: true, id: 1 });
      },
      lastError: undefined,
    },
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
  usulanMinta.length = 0;
  usulanAlasan.length = 0;
  const abt: Record<string, string> = { "8503": "F", ...(p.abtAwal ?? {}) }; // isian tersimpan di ABT (data_teks/tanggal)
  const tj: Halaman["tj"] = {}; // kunci "kode@sidang" - keterangan saksi tersimpan PER SIDANG seperti abt_keterangan_saksi
  const pdfRtf: string[] = [];
  const orang = ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const nilaiDari = (kode: string[], tjKode: Set<string>) => {
    const n: Record<string, unknown> = {};
    for (const k of kode) {
      // Tanya-jawab: bot menilai "terisi" bila ABT punya barisnya (teksnya sendiri kosong, nilainya tabel).
      const v = tjKode.has(k)
        ? Object.keys(tj).some((x) => (x.startsWith(`${k}@`) || (k === "2021" && x.startsWith("5058@")) || (k === "2022" && x.startsWith("5059@"))) && tj[x].length)
          ? { status: "terisi", teks: "", nama: "", sebab: "" }
          : { status: "kosong", teks: "", nama: "", sebab: "tanya-jawab belum diisi di ABT" }
        : abt[k] !== undefined && abt[k] !== "" ? { status: "terisi", teks: abt[k], nama: "", sebab: "" } : k === "0001" ? { status: "terisi", teks: "581/Pdt.G/2026/PA.Dgl", nama: "", sebab: "" } : k === "0046" ? { status: "terisi", teks: "Yulfiani binti Tasbih", nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" };
      n[k] = statusNilaiLayar(v, tjKode.has(k));
    }
    return n;
  };
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown; redirect?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    let badan = "";
    if (typeof opsi?.body === "string") badan = opsi.body;
    else if (opsi?.body && typeof (opsi.body as FormData).get === "function") badan = JSON.stringify(Object.fromEntries([...(opsi.body as FormData).entries()].map(([k, v]) => [k, typeof v === "string" ? v : `<berkas ${(v as File).name || ""} ${(v as File).size || 0}>`])));
    else if (opsi?.body && typeof (opsi.body as URLSearchParams).toString === "function") badan = String(opsi.body);
    minta.push({ url, cara, badan });
    if (url.startsWith("data:")) {
      const b = Buffer.from(url.split(",")[1], "base64");
      return new Response(new Uint8Array(b), { status: 200, headers: { "content-type": "image/png" } });
    }
    // Portal ALETA
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const admin = p.orang === "admin";
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos(p.jenis ? DAFTAR.map((d) => ({ ...d, jenisPerkara: p.jenis })) : DAFTAR) } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) {
      const sd = (tanggal: string, agenda: string, ket: string, urutan: number) => ({ sidangId: `s${tanggal}`, tanggalSidang: tanggal, jamSidang: "09:00:00", agenda, alasanDitunda: ket, urutanSidang: urutan, dihadiriOleh: hadirKe(uji, urutan) });
      const jadwalPerkara = [sd("2026-10-01", "Sidang Pertama", "Tergugat tidak hadir", 1), sd("2026-10-15", "Panggil Tergugat", "Tergugat tidak hadir", 2), sd("2026-10-27", "Panggil Tergugat", ketAkhir(uji), 3)];
      return json({ ok: true, data: { sipp: { alurPerkaraId: uji.alur ?? 15, jadwalPerkara, putusan: putusanUji(uji) } } });
    }
    if (url.includes("/aleta-ecourt/sidang/skors?")) {
      // F3.1: riwayat skors satu sidang + usulan kalimat BAS (rute sungguhan: lib/skors-sidang).
      const q = new URL(url, ASAL).searchParams;
      if (q.get("perkaraId") === "10154" && q.get("tanggal") === "2026-10-15") {
        return json({
          ok: true,
          data: {
            available: true,
            ok: true,
            riwayat: [{ perkaraId: "10154", tanggalSidang: "2026-10-15", diskorsPada: "2026-10-15 09:40:00", dilanjutkanPada: "2026-10-15 10:05:00", alasanKode: "saksi", alasan: "Menunggu saksi", ringkas: "09.40-10.05 (25 menit) · Menunggu saksi" }],
            kalimatBas: "Pada pukul 09.40 WITA sidang diskors untuk menunggu kehadiran saksi, dan pada pukul 10.05 WITA skors dicabut dan sidang dibuka kembali.",
          },
        });
      }
      return json({ ok: true, data: { available: true, ok: true, riwayat: [], kalimatBas: "" } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry/set-saksi")) {
      // F3.3: set pertanyaan saksi ALETA (rute sungguhan memanggil fungsi murni yang sama).
      const q = new URL(url, ASAL).searchParams;
      return json({ ok: true, data: { ...tawarkanSetSaksi({ namaJenis: q.get("jenis") || "", nomor: q.get("nomor") || "", folder: q.get("folder") || "", huruf: q.get("huruf") || "", sebutanP: q.get("sebutanP") || undefined, sebutanT: q.get("sebutanT") || undefined, jumlahP: Number(q.get("jumlahP")) || 1 }), sumberHuruf: "" } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [{ nama: "1 Perceraian CG", jenis: "put", berkas: [`${BLANGKO_PUT}.rtf`, "[02] [Kabul] CG - F.rtf"] }, { nama: "ALUR 02 Cerai Verstek 2 Sidang", jenis: "bas", berkas: [`${BLANGKO_BAS}.rtf`] }], sumber: "pohon", sebab: "" } });
      const berkas = q.get("berkas") || "";
      const put = berkas.startsWith("[01]");
      const s = susunIsian(put ? PENANDA_PUT : PENANDA_BAS, KATALOG, { P: q.get("sebutanP") || "Penggugat", T: q.get("sebutanT") || "Tergugat" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${berkas}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") && !p.botMati ? nilaiDari(kode, kodeTanyaJawab(s)) : undefined, nilaiAda: Boolean(q.get("perkaraId")) && !p.botMati, nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/usulan")) {
      const b = JSON.parse(badan || "{}");
      // Permintaan alasan dari posita (centang "sebagian") dicatat terpisah; usulanMinta hanya jawaban saksi.
      if (b.sumber === "alasan-posita") usulanAlasan.push(b);
      else usulanMinta.push(b);
      if (p.botMati) return json({ ok: false }, 503);
      const r = await penanganBot(b);
      return json(r.json, r.status);
    }
    if (url.includes("/aleta-bot/abt/pdf")) {
      const b = JSON.parse(badan || "{}");
      pdfRtf.push(Buffer.from(String(b.rtfBase64 || ""), "base64").toString("latin1"));
      return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from("%PDF-1.4 uji").toString("base64"), byte: 12, ...(b.salinan ? { salinan: { namaPanitera: "PP Satu", gambarTtdPanitera: false, ttdTerdaftar: false } } : {}) } });
    }
    if (url.includes("/aleta-ecourt/tanda-tangan")) return json({ ok: false, alasan: "tidak berwenang" }, 403);
    if (url.includes("/aleta-ecourt/putusan/unggah-sipp")) return json({ ok: true, data: { ok: true } });
    // ABT
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK("Putusan Cerai Gugat", [[BLANGKO_PUT, "A01", "B01"], ["[02] [Kabul] CG - F", "A02", "B02"]]));
    if (url.startsWith(`${BERANDA}?a=D2`)) return html(HAL_KELOMPOK("BAS Alur 02", [[BLANGKO_BAS, "A11", "B11"], ["BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T", "A12", "B12"]]));
    if (url === `${ABT}/main/cari` && cara === "POST") {
      if (p.hakTolak) return html(`<h5 style='color:red;text-align:center'>JENIS PERKARA CERAI GUGAT TIDAK DAPAT MENGGUNAKAN BLANGKO INI</h5>`);
      return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    }
    if (url.startsWith(`${ABT}/edit_data?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      if (cara === "POST") {
        const f = new URLSearchParams(badan);
        abt[kode] = String(f.get("value") || "");
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      const def = KATALOG.get(kode);
      const tipe = def ? def.jenis : "";
      if (kode === "0050") return html(POPUP(kode, "multi_sidang", String(q.get("d") || "1") === "9" ? "" : String(q.get("d") || "1")));
      if (kode === "0007" && !abt[kode]) return html(POPUP(kode, "data_teks", "belum dikaruniai anak"));
      if (kode === "1214" && !abt[kode]) return html(POPUP(kode, "data_teks", BAWAAN_1214));
      if (tipe === "data_tanggal") return html(POPUP(kode, tipe, abt[kode] ? abt[kode] : ""));
      return html(POPUP(kode, tipe || "data_teks", abt[kode] || ""));
    }
    if (url.startsWith(`${ABT}/tanyajawab_perkara_edit?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      const dd = q.get("d") || "";
      const f = new URLSearchParams(badan);
      if (q.get("aksi") === "simpan") {
        tj[`${kode}@${dd}`] = JSON.parse(String(f.get("data") || "[]"));
        return html("Tanya Jawab Disimpan");
      }
      if (p.tjGagal && cara === "GET" && kode === "5058") return new Response("galat", { status: 500 });
      const rows = f.get("load_template") ? { "0": { urutan_pertanyaan: "1", pertanyaan: "Apakah saudara kenal Penggugat?", jawaban: "" }, "1": { urutan_pertanyaan: "2", pertanyaan: "Bagaimana rumah tangganya?", jawaban: "" } } : (tj[`${kode}@${dd}`] || []).map((r) => ({ urutan_pertanyaan: r.no, pertanyaan: r.tanya, jawaban: r.jawab }));
      return html(`<div class="panel-heading"><b><big>581/Pdt.G/2026/PA.Dgl</big></b> - TanyaJwb Saksi : <b>Nama Saksi</b></div><select><option value='A1a'>(A1a) Pertanyaan Saksi P CG</option></select><script>var ajax_data = ${JSON.stringify(rows)}\n</script>`);
    }
    if (url.startsWith(`${ABT}/preview?`)) {
      if (p.rtfBytes) return new Response(new Blob([p.rtfBytes as BlobPart]), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="581/Pdt.G/2026/PA.Dgl - ${BLANGKO_PUT}.rtf"` } });
      return new Response(RTF_PUT(abt["0007"] || "..."), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="581/Pdt.G/2026/PA.Dgl - ${BLANGKO_PUT}.rtf"` } });
    }
    if (url === `${ABT}/main/anonim`) return new Response(RTF_PUT("ANONIM"), { status: 200, headers: { "content-disposition": 'attachment; filename="anonim_581.rtf"' } });
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return { dom, w, simpanan, minta, latar, abt, tj, pdfRtf, opsi: p };
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
const ketik = (h: Halaman, el: HTMLInputElement, nilai: string, blur = true) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  if (blur) el.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
};
const tombol = (h: Halaman, el: Element, key: string) => el.dispatchEvent(new h.w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const isian = (h: Halaman) => h.w.aletaBlangkoDerryIsian;
const mintaKe = (h: Halaman, pola: RegExp, cara?: string) => h.minta.filter((m) => pola.test(m.url) && (!cara || m.cara === cara));

async function sampaiPerkara(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, '[data-pk="581/Pdt.G/2026/PA.Dgl"]');
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function pilihPutusan(h: Halaman) {
  await sampaiPerkara(h);
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, `[data-bl="${BLANGKO_PUT}"]`), "berkas putusan termuat");
  klik(h, `[data-bl="${BLANGKO_PUT}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f"), "perlu diisi tergambar");
}

// 19 Okt (tahap 2): tanya jawab saksi hanya DISUNTING pada berita acara (BAS) oleh panitera pengganti; putusan dan peran
// hakim hanya membaca. Uji penyuntingan karena itu membuka BAS sebagai PP.
const bukaPP = (p: Parameters<typeof buka>[0] = {}) => buka({ orang: "pp", ...p });
async function pilihBas(h: Halaman) {
  await sampaiPerkara(h);
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, `[data-bl="${BLANGKO_BAS}"]`), "berkas bas termuat");
  klik(h, `[data-bl="${BLANGKO_BAS}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f") || q(h, "[data-tj]"), "perlu diisi tergambar");
}

const temuan = (h: Halaman) => q(h, "#bd-temuanhadir .bd-temuanhadir");
const teksTemuan = (h: Halaman) => temuan(h)?.textContent || "";
const sampaiCetak = (h: Halaman) => sampai(() => q(h, '[data-bd2="cetak"]') && q(h, "#bd-temuanhadir"), "tombol cetak");
async function tanpaTemuan(h: Halaman) {
  await sampaiCetak(h);
  // Riwayat sidang SIPP dibaca sesudah perkara dipilih: beri waktu agar temuan yang (salah) muncul belakangan ikut tertangkap.
  await sampai(() => h.minta.some((m) => m.url.includes("/aleta-ecourt/sidang?nomor=")), "riwayat sidang dibaca");
  await tunggu(150);
  expect(temuan(h)).toBeNull();
}

describe("Catatan temuan: putusan verstek padahal SIPP mencatat Tergugat hadir (30 Okt)", () => {
  it("putusan verstek + Tergugat tercatat hadir di sidang ke-1: temuan menyebut sidangnya, bahasa awam", async () => {
    const h = buka({ uji: { hadir: { 1: 9 } } });
    await pilihPutusan(h);
    await sampai(() => temuan(h), "temuan tampil");
    const t = teksTemuan(h);
    expect(t).toContain("Kehadiran Tergugat di SIPP tercatat hadir padahal putusan verstek - periksa pilihan kehadiran di SIPP (sidang ke-1 (1 Oktober 2026))");
    expect(t).toMatch(/Cetak tidak ditahan/);
    expect(t.replace(/\d{1,2} [A-Z][a-z]+ \d{4}/g, "")).not.toMatch(/\b\d{4}\b/);
    expect(t).not.toMatch(/penanda|variabel|kode|sandi|dihadiri|#/i);
  });

  it("dua sidang tercatat hadir: keduanya disebut", async () => {
    const h = buka({ uji: { hadir: { 1: 1, 2: 3 } } });
    await pilihPutusan(h);
    await sampai(() => /ke-2/.test(teksTemuan(h)), "temuan dua sidang");
    expect(teksTemuan(h)).toContain("(sidang ke-1 (1 Oktober 2026) dan ke-2 (15 Oktober 2026))");
  });

  it.each([3, 8, 11, 15])("pilihan kehadiran %i (memuat Tergugat) menimbulkan temuan", async (sandi) => {
    const h = buka({ uji: { hadir: { 2: sandi } } });
    await pilihPutusan(h);
    await sampai(() => /sidang ke-2 \(15 Oktober 2026\)/.test(teksTemuan(h)), `temuan untuk ${sandi}`);
  });

  it.each([2, 4, 5, 10])("pilihan kehadiran %i (tanpa Tergugat) tidak menimbulkan temuan", async (sandi) => {
    const h = buka({ uji: { hadir: { 1: sandi, 2: sandi } } });
    await pilihPutusan(h);
    await tanpaTemuan(h);
  });

  it("sidang sesudah tanggal putusan tidak dihitung", async () => {
    const h = buka({ uji: { hadir: { 3: 1 }, tanggalPutusan: "2026-10-15" } });
    await pilihPutusan(h);
    await tanpaTemuan(h);
  });

  it("bot lama (tanpa amarVerstek): amar ringkas yang memuat Verstek tetap dikenali", async () => {
    const h = buka({ uji: { hadir: { 1: 9 }, botLama: true } });
    await pilihPutusan(h);
    await sampai(() => temuan(h), "temuan tampil");
  });

  it("belum putus di SIPP: tidak diperiksa", async () => {
    const h = buka({ uji: { hadir: { 1: 9 }, tanggalPutusan: "" } });
    await pilihPutusan(h);
    await tanpaTemuan(h);
  });

  it("permohonan (bukan gugatan): kehadiran tidak diperiksa; tanda verstek 'Ya' pada permohonan menjadi temuan tersendiri (G2B no. 38)", async () => {
    const h = buka({ uji: { hadir: { 1: 1 }, alur: 16 } });
    await pilihPutusan(h);
    await sampaiCetak(h);
    await sampai(() => temuan(h), "temuan tanda verstek");
    expect(teksTemuan(h)).toMatch(/Perkara permohonan tidak diputus verstek.*periksa tanda verstek di SIPP/);
    expect(teksTemuan(h)).not.toMatch(/tercatat hadir/);
  });

  it("bukan verstek (BAS, SIPP tidak mencatat verstek): Tergugat hadir tidak menjadi temuan", async () => {
    const h = bukaPP({ uji: { hadir: { 1: 9 }, verstek: false } });
    await pilihBas(h);
    await tanpaTemuan(h);
  });

  it("BAS pada perkara verstek juga memperlihatkan temuan; cerai talak menyebut Termohon", async () => {
    const h = bukaPP({ uji: { hadir: { 2: 9 } }, jenis: "Cerai Talak" });
    await pilihBas(h);
    await sampai(() => temuan(h), "temuan tampil");
    expect(teksTemuan(h)).toContain("Kehadiran Termohon di SIPP tercatat hadir padahal putusan verstek");
    expect(teksTemuan(h)).toContain("sidang ke-2 (15 Oktober 2026)");
  });

  it("temuan tidak menahan cetak dan dicatat sesudah cetak", async () => {
    const h = buka({ uji: { hadir: { 1: 9 } } });
    h.tj["5058@2"] = [{ no: "1", tanya: "Apakah saksi kenal dengan Penggugat?", jawab: "Kenal;" }];
    h.tj["5059@2"] = [{ no: "1", tanya: "Apakah saksi kenal dengan Penggugat?", jawab: "Kenal;" }];
    await pilihPutusan(h);
    await sampai(() => temuan(h), "temuan tampil");
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => (q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden) || h.latar.some((m) => m.jenis === "unduh"), "pengingat isian lain atau langsung tercetak", 8000);
    const ingat = q(h, "#bd-ingat");
    if (ingat && !ingat.hidden) {
      expect(ingat.textContent || "").not.toMatch(/kehadiran/i);
      klik(h, '[data-bd2="tetapcetak"]');
    }
    await sampai(() => h.latar.some((m) => m.jenis === "unduh"), "tercetak", 8000);
    await sampai(() => /catatan temuan: Kehadiran Tergugat di SIPP tercatat hadir padahal putusan verstek/.test(q(h, "#bd-logcetak")?.textContent || ""), "catatan sesudah cetak");
  });
});
