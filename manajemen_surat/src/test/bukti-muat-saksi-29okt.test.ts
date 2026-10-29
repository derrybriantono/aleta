// @vitest-environment node
/**
 * ============================================================================
 * 29 OKT 2026 - BLANGKO DERRY: (1) alat bukti surat/elektronik otomatis masuk ABT + tombol "Input ke ABT"; (2) tombol Muat saksi di bawah pengetahuan saksi
 * ============================================================================
 *
 * Skrip ekstensi dijalankan sungguhan di jsdom (portal, bot, ABT ditiru di fetch; rute bot /abt/usulan dijalankan sungguhan). Yang dijaga:
 *   1  daftar bukti yang tersusun otomatis (bawaan ABT yang belum tersimpan) langsung ditulis SEKALI ke ABT; tidak menulis berulang bila sama;
 *      isi ABT yang bunyinya lain tidak ditimpa saat dibuka; saran bawaan panel ditulis sebelum naskah cetak diambil (BAS tidak kosong bukti);
 *   2  baris "Input ke ABT" di bawah alat bukti surat dan di bawah alat bukti elektronik: letak, keadaan, dan sunting form lama tetap otomatis;
 *   3  tombol Muat di bawah panel Pengetahuan saksi (bukan di bilah atas), hasil digulir ke tabel dan kotak pertamanya difokuskan;
 *   4  gaya baru hanya memakai variabel tema.
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
const HARI_INI = "2026-10-15";
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
const DAFTAR = [PK("581/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI("2026-10-15", "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)", { urutan: 2 })], { sudahPutus: true, tanggalPutusan: HARI_INI })];
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
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; snapPreview: string[]; abt: Record<string, string>; tj: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; pdfRtf: string[]; opsi: { hakTolak?: boolean } };
const terbuka: JSDOM[] = [];
const usulanMinta: any[] = [];
const usulanAlasan: any[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; jenis?: string; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array; tanpaBawaan1214?: boolean } = {}): Halaman {
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
  const tj: Halaman["tj"] = { "5058": [], "5059": [], "5060": [] };
  const pdfRtf: string[] = [];
  const snapPreview: string[] = []; // isi variabel 1214 di ABT pada saat naskah diminta (BAS harus memuat bukti)
  const orang = ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const nilaiDari = (kode: string[], tjKode: Set<string>) => {
    const n: Record<string, unknown> = {};
    for (const k of kode) {
      // Tanya-jawab: bot menilai "terisi" bila ABT punya barisnya (teksnya sendiri kosong, nilainya tabel).
      const v = tjKode.has(k)
        ? tj[k]?.length
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
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [{ sidangId: "s2026-10-01", tanggalSidang: "2026-10-01", jamSidang: "09:00:00", agenda: "Sidang Pertama", alasanDitunda: "Panggil Tergugat", urutanSidang: 1 }, { sidangId: "s2026-10-15", tanggalSidang: "2026-10-15", jamSidang: "09:00:00", agenda: "Pemeriksaan pokok perkara", alasanDitunda: "putus DIKABULKAN (verstek)", urutanSidang: 2 }] } } });
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
      if (kode === "1214" && !abt[kode]) return html(POPUP(kode, "data_teks", p.tanpaBawaan1214 ? "" : BAWAAN_1214));
      if (tipe === "data_tanggal") return html(POPUP(kode, tipe, abt[kode] ? abt[kode] : ""));
      return html(POPUP(kode, tipe || "data_teks", abt[kode] || ""));
    }
    if (url.startsWith(`${ABT}/tanyajawab_perkara_edit?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      const f = new URLSearchParams(badan);
      if (q.get("aksi") === "simpan") {
        tj[kode] = JSON.parse(String(f.get("data") || "[]"));
        return html("Tanya Jawab Disimpan");
      }
      if (p.tjGagal && cara === "GET" && kode === "5058") return new Response("galat", { status: 500 });
      const rows = f.get("load_template") ? { "0": { urutan_pertanyaan: "1", pertanyaan: "Apakah saudara kenal Penggugat?", jawaban: "" }, "1": { urutan_pertanyaan: "2", pertanyaan: "Bagaimana rumah tangganya?", jawaban: "" } } : (tj[kode] || []).map((r) => ({ urutan_pertanyaan: r.no, pertanyaan: r.tanya, jawaban: r.jawab }));
      return html(`<div class="panel-heading"><b><big>581/Pdt.G/2026/PA.Dgl</big></b> - TanyaJwb Saksi : <b>Nama Saksi</b></div><select><option value='A1a'>(A1a) Pertanyaan Saksi P CG</option></select><script>var ajax_data = ${JSON.stringify(rows)}\n</script>`);
    }
    if (url.startsWith(`${ABT}/preview?`)) {
      snapPreview.push(abt["1214"] || "");
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
  return { dom, w, simpanan, minta, latar, snapPreview, abt, tj, pdfRtf, opsi: p };
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

// ============================================================================
// Pembantu uji
// ============================================================================
const pilih = (h: Halaman, kunci: string, bidang: string, nilai: string) => {
  const el = q(h, `[data-skkunci="${kunci}"][data-skfld="${bidang}"]`) as HTMLSelectElement;
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("change", { bubbles: true }));
};
async function bukaSaksiDanMuat(h: Halaman, idSet = "cerai-F") {
  await pilihBas(h);
  klik(h, '[data-tj="saksi 1 p"]');
  const sel = (await sampai(() => q(h, '#bd-muattpl optgroup[label^="Panduan"]') && q(h, "#bd-muattpl"), "panduan set")) as HTMLSelectElement;
  await sampai(() => q(h, '[data-skkartu="saksi 2 p"] select') && !(q(h, '[data-skkunci="saksi 1 p"][data-skfld="modus"]') as HTMLSelectElement).disabled, "panel pengetahuan siap");
  sel.value = `aleta:${idSet}`;
  klik(h, '[data-bd2="muattpl"]');
  await sampai(() => usulanMinta.length >= 1, "permintaan jawaban otomatis");
  await sampai(() => /disusun dari data perkara/.test(akar(h).textContent || ""), "jawaban terisi");
}



// ============================================================================
// Pembantu uji bukti + Muat
// ============================================================================
type Murni = {
  susunKalimatBukti: (rows: unknown[], pihak: string) => string;
  uraiBukti: (t: string) => unknown[];
};
const murni = (h: Halaman) => h.w.aletaBlangkoDerryIsian.murni as Murni;
const POST_1214 = (h: Halaman) => mintaKe(h, /edit_data\?[^ ]*no_var=1214/, "POST");
const STATUS = (h: Halaman, bagian = "surat") => (q(h, `[data-bukabt="P"][data-bagian="${bagian}"] .bd-bukabt-st`)?.textContent || "").trim();
const TOMBOL_ABT = (h: Halaman, bagian = "surat") => q(h, `[data-bukabt="P"][data-bagian="${bagian}"] [data-bukabt-tulis]`) as HTMLButtonElement | null;
const ubah = (h: Halaman, el: HTMLInputElement | HTMLSelectElement, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  el.dispatchEvent(new h.w.Event("change", { bubbles: true }));
};
const bukaBas = async (p: Parameters<typeof buka>[0] = {}) => {
  const h = bukaPP(p);
  await pilihBas(h);
  await sampai(() => qq(h, ".bd-bnama").length >= 1 && q(h, '[data-bukabt="P"]'), "daftar bukti tergambar");
  return h;
};
const SUSUNAN_BAWAAN = (h: Halaman) => murni(h).susunKalimatBukti(murni(h).uraiBukti(BAWAAN_1214), "P");

// ============================================================================
describe("1. alat bukti surat tersusun otomatis langsung tertulis ke ABT (sekali)", () => {
  it("bawaan ABT yang belum tersimpan ditulis sekali saat dibuka, tanpa klik; cetak BAS tidak kosong bukti", async () => {
    const h = await bukaBas();
    await sampai(() => h.abt["1214"], "bukti tertulis otomatis");
    expect(h.abt["1214"]).toBe(SUSUNAN_BAWAAN(h));
    await tunggu(700);
    expect(POST_1214(h)).toHaveLength(1);
    expect(STATUS(h)).toContain("sudah di ABT");
    // Naskah yang diambil ABT sudah memuat bukti (tanpa menekan apa pun).
    await h.w.aletaBlangkoDerryIsian.naskahRtf(true);
    expect(h.snapPreview.at(-1)).toContain("Kartu Tanda Penduduk Elektronik");
    expect(POST_1214(h)).toHaveLength(1);
  });

  it("dibuka lagi dengan isi ABT yang sama: tidak menulis berulang", async () => {
    const h = await bukaBas();
    await sampai(() => h.abt["1214"], "tertulis");
    const h2 = await bukaBas({ simpanan: h.simpanan, abtAwal: { ...h.abt } });
    await tunggu(800);
    expect(POST_1214(h2)).toHaveLength(0);
    expect(STATUS(h2)).toContain("sudah di ABT");
    expect(TOMBOL_ABT(h2)!.disabled).toBe(false); // tetap bisa ditekan; hanya memberi tahu bahwa sudah sama
  });

  it("isi ABT yang bunyinya lain tidak ditimpa saat dibuka; tombol Input ke ABT menyamakannya, lalu tidak menulis ulang", async () => {
    const h = await bukaBas({ abtAwal: { "1214": BAWAAN_1214 } });
    await tunggu(800);
    expect(POST_1214(h)).toHaveLength(0);
    expect(h.abt["1214"]).toBe(BAWAAN_1214);
    expect(STATUS(h)).toContain("bunyinya berbeda");
    expect(TOMBOL_ABT(h)!.classList.contains("utama")).toBe(true);
    TOMBOL_ABT(h)!.click();
    await sampai(() => h.abt["1214"] !== BAWAAN_1214, "disamakan");
    expect(h.abt["1214"]).toBe(SUSUNAN_BAWAAN(h));
    await sampai(() => STATUS(h).includes("sudah di ABT"), "status sudah");
    expect(TOMBOL_ABT(h)!.classList.contains("utama")).toBe(false);
    TOMBOL_ABT(h)!.click();
    await tunggu(300);
    expect(POST_1214(h)).toHaveLength(1);
  });

  it("saran bawaan panel (bukan data perkara) tidak ditulis diam-diam saat dibuka, tetapi ditulis sebelum naskah cetak diambil", async () => {
    const h = await bukaBas({ tanpaBawaan1214: true });
    await tunggu(800);
    expect(POST_1214(h)).toHaveLength(0);
    expect(h.abt["1214"]).toBeUndefined();
    expect(STATUS(h)).toContain("saran bawaan panel");
    expect(TOMBOL_ABT(h)!.disabled).toBe(false);
    await h.w.aletaBlangkoDerryIsian.naskahRtf(true);
    const urutan = h.minta.map((m) => (/edit_data\?[^ ]*no_var=1214/.test(m.url) && m.cara === "POST" ? "tulis" : /abt\/preview\?/.test(m.url) ? "ambil" : ""));
    expect(urutan.indexOf("tulis")).toBeGreaterThanOrEqual(0);
    expect(urutan.indexOf("tulis")).toBeLessThan(urutan.indexOf("ambil"));
    expect(h.snapPreview.at(-1)).toContain("Kartu Tanda Penduduk Elektronik");
    expect(STATUS(h)).toContain("sudah di ABT");
  });
});

// ============================================================================
describe("2. tombol Input ke ABT di bawah alat bukti surat dan alat bukti elektronik", () => {
  it("baris surat berada tepat sesudah daftar surat dan sebelum bagian elektronik; baris elektronik di dalam bagian elektronik", async () => {
    const h = await bukaBas();
    await sampai(() => h.abt["1214"], "tertulis");
    const surat = q(h, '[data-bukabt="P"][data-bagian="surat"]')!;
    const tambah = q(h, '[data-bktambah="P"]')!;
    const bel = q(h, ".bd-bel")!;
    // urutan di halaman: butir surat -> tambah bukti -> Input ke ABT (surat) -> bagian elektronik
    expect(tambah.compareDocumentPosition(surat) & 4).toBeTruthy(); // surat SESUDAH tombol tambah
    expect(surat.compareDocumentPosition(bel) & 4).toBeTruthy(); // bagian elektronik SESUDAH baris surat
    expect(surat.querySelector("button")!.textContent).toBe("Input ke ABT");
    // sebelum ada butir elektronik terisi: tombol bagian elektronik tidak tampil (hanya tautan membuka)
    klik(h, '[data-belbuka="P"]');
    await sampai(() => q(h, '[data-bukabt="P"][data-bagian="el"]'), "baris elektronik");
    expect(TOMBOL_ABT(h, "el")!.disabled).toBe(true);
    expect(STATUS(h, "el")).toContain("Belum ada butir");
    expect(q(h, ".bd-bel")!.contains(q(h, '[data-bukabt="P"][data-bagian="el"]'))).toBe(true);
    expect(q(h, '[data-beltambah="P"]')!.compareDocumentPosition(q(h, '[data-bukabt="P"][data-bagian="el"]')!) & 4).toBeTruthy();
  });

  it("mengisi butir elektronik langsung tertulis (fungsi sunting form dipertahankan); keadaan bagian elektronik mengikuti", async () => {
    const h = await bukaBas();
    await sampai(() => h.abt["1214"], "tertulis");
    klik(h, '[data-belbuka="P"]');
    await sampai(() => qq(h, ".bd-bukti-el").length === 1, "butir pertama");
    const objek = qq(h, ".bd-bukti-el")[0].querySelector('[data-isi="objek"]') as HTMLInputElement;
    ubah(h, objek, "percakapan WhatsApp");
    await sampai(() => /bukti elektronik tersebut/.test(h.abt["1214"] || ""), "butir elektronik tertulis");
    await sampai(() => STATUS(h, "el").includes("sudah di ABT"), "status elektronik sudah");
    expect(STATUS(h, "surat")).toContain("sudah di ABT");
    expect(TOMBOL_ABT(h, "el")!.disabled).toBe(false);
  });

  it("sunting form lama tetap otomatis: menambah bukti surat menulis ke ABT tanpa menekan Input ke ABT", async () => {
    const h = await bukaBas();
    await sampai(() => h.abt["1214"], "tertulis");
    klik(h, '[data-bktambah="P"][data-nama="Surat Keterangan Domisili"]');
    await sampai(() => (h.abt["1214"] || "").includes("Surat Keterangan Domisili"), "bukti baru tertulis");
    await sampai(() => STATUS(h).includes("sudah di ABT"), "status sudah lagi");
  });
});

// ============================================================================
describe("3. tombol Muat tanya jawab saksi di bawah pilihan pengetahuan saksi", () => {
  it("Muat tidak lagi di bilah atas: urutan set pertanyaan -> pengetahuan saksi -> Muat -> tabel hasil", async () => {
    const h = bukaPP();
    await pilihBas(h);
    klik(h, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h, "#bd-muatbawah") && q(h, ".bd-skpanel") && q(h, "#bd-tjhasil") && q(h, '#bd-muattpl optgroup[label^="Panduan"]'), "panel tergambar");
    const set = q(h, "#bd-muattpl")!;
    const panel = q(h, ".bd-skpanel")!;
    const muat = q(h, '[data-bd2="muattpl"]')!;
    const hasil = q(h, "#bd-tjhasil")!;
    expect(qq(h, '[data-bd2="muattpl"]')).toHaveLength(1);
    expect(muat.closest("#bd-muatbawah")).not.toBeNull();
    expect(set.compareDocumentPosition(panel) & 4).toBeTruthy(); // pengetahuan SESUDAH pilihan set
    expect(panel.compareDocumentPosition(muat) & 4).toBeTruthy(); // Muat SESUDAH pengetahuan saksi
    expect(muat.compareDocumentPosition(hasil) & 4).toBeTruthy(); // tabel hasil SESUDAH Muat
    expect(muat.classList.contains("utama")).toBe(true);
    expect((q(h, "#bd-muatset")!.textContent || "").length).toBeGreaterThan(0);
    // Pilihan set diganti: ringkasan di sebelah Muat ikut berganti.
    const opsiLain = Array.from((set as HTMLSelectElement).options).find((o) => o.value.startsWith("aleta:"))!;
    ubah(h, set as HTMLSelectElement, opsiLain.value);
    expect(q(h, "#bd-muatset")!.textContent).toBe(`Set pertanyaan: ${String(opsiLain.textContent).trim()}`);
  });

  it("sesudah Muat layar digulir ke tabel hasil dan kotak pertamanya diberi fokus; catatan jam + jumlah pertanyaan tampil di sebelah tombol", async () => {
    const h = bukaPP();
    const digulir: string[] = [];
    const difokus: string[] = [];
    h.w.Element.prototype.scrollIntoView = function (this: Element) {
      digulir.push(this.id || this.tagName);
    };
    h.w.HTMLElement.prototype.focus = function (this: HTMLElement) {
      difokus.push(`${this.tagName}:${this.closest("#bd-tjwadah") ? "tj" : ""}`);
    };
    await bukaSaksiDanMuat(h);
    await sampai(() => digulir.includes("bd-tjhasil"), "digulir ke hasil");
    expect(difokus.some((f) => f === "TEXTAREA:tj")).toBe(true);
    await sampai(() => /Dimuat pukul \d\d\.\d\d: \d+ pertanyaan di tabel di bawah ini/.test(q(h, "#bd-muatstat")?.textContent || ""), "catatan Muat");
    expect(qq(h, "[data-sbq]").length).toBeGreaterThan(0);
  });
});

// ============================================================================
describe("4. gaya baru memakai variabel tema (terang dan gelap)", () => {
  it("baris Input ke ABT dan bilah Muat tanpa warna mati", () => {
    const css = baca("blangko-derry.css");
    const blok = css.slice(css.indexOf("alat bukti -> ABT (29 Okt)"));
    expect(blok).toContain(".bd-bukabt-st.belum");
    expect(blok).toContain(".bd-muatbawah");
    expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(blok).not.toMatch(/\brgba?\(/);
  });
});
