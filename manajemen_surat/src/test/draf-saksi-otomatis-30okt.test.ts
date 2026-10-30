// @vitest-environment node
/**
 * ============================================================================
 * 30 OKT 2026 (G2a 2.1) - DRAF TANYA JAWAB SAKSI LANGSUNG TERISI SAAT PENYUNTING DIBUKA
 * ============================================================================
 * Arahan pengguna 30 Okt malam: tanpa tombol tambahan. Perkara cerai dulu menunggu petugas memilih set dan menekan Muat;
 * kini daftar yang terbaca KOSONG dari ABT langsung diberi set yang disarankan lalu jawabannya diisi dari data perkara
 * (rute bot /abt/usulan sungguhan di node:vm, SIPP ditiru - harness sama dengan blangko-derry-saksi-kosong-30okt).
 * Yang dijaga (perilaku):
 *   1. PP membuka "Isi tanya jawab saksi": tabel langsung berisi pertanyaan set yang disarankan, sebagian jawaban dari
 *      data perkara, kalimat contoh dan titik-titik DITANDAI; tidak ada satu pun yang tersimpan ke ABT;
 *   2. tanya jawab yang sudah ada di ABT tidak disentuh (tidak ditimpa, tidak ditambah);
 *   3. tersimpan hanya lewat Simpan ke ABT, dengan bunyi draf yang tampil;
 *   4. Urungkan mengembalikan daftar kosong dan draf tidak muncul lagi;
 *   5. putusan (hakim, hanya baca): tanpa draf;
 *   6. fungsi murni pemilih set: set utama + tambahan yang disarankan; daftar berisi/berubah/galat tidak diberi draf.
 *   7. (2.4) BAS yang disiapkan agen H-1 terbuka sendiri untuk PP pada sidangnya; sore H-1 sidang berikutnya dipilih bila BAS
 *      sidang lalu sudah terunggah; hakim dan portal tanpa agen tidak berubah.
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
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-saksi.js", "blangko-derry-saksi-tampil.js", "blangko-derry-draf-saksi.js", "blangko-derry-draf-bas.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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
const DAFTAR = [PK("581/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-01", "Sidang Pertama", "Tergugat tidak hadir", { urutan: 1 }), SI("2026-10-15", "Panggil Tergugat", "Tergugat tidak hadir", { urutan: 2 }), SI("2026-10-27", "Panggil Tergugat", "putus DIKABULKAN (verstek)", { urutan: 3 })], { sudahPutus: true, tanggalPutusan: HARI_INI })];
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

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; jenis?: string; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array; daftar?: unknown[]; h1?: Record<string, unknown> } = {}): Halaman {
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
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos(p.daftar ?? (p.jenis ? DAFTAR.map((d) => ({ ...d, jenisPerkara: p.jenis })) : DAFTAR)) } });
    }
    // G2a 2.4: daftar perkara uji sendiri -> riwayat sidang perkara mengikutinya.
    if (url.includes("/aleta-ecourt/sidang?nomor=") && p.daftar) {
      const sd = ((p.daftar[0] as { sidang?: Array<{ sidangId: string; tanggal: string; agenda: string; ket: string; urutan: number; adaBas?: unknown }> }).sidang || []);
      return json({ ok: true, data: { sipp: { jadwalPerkara: sd.map((x) => ({ sidangId: x.sidangId, tanggalSidang: x.tanggal, jamSidang: "09:00:00", agenda: x.agenda, alasanDitunda: x.ket, urutanSidang: x.urutan, adaBas: x.adaBas })) } } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [{ sidangId: "s2026-10-01", tanggalSidang: "2026-10-01", jamSidang: "09:00:00", agenda: "Sidang Pertama", alasanDitunda: "Tergugat tidak hadir", urutanSidang: 1 }, { sidangId: "s2026-10-15", tanggalSidang: "2026-10-15", jamSidang: "09:00:00", agenda: "Panggil Tergugat", alasanDitunda: "Tergugat tidak hadir", urutanSidang: 2 }, { sidangId: "s2026-10-27", tanggalSidang: "2026-10-27", jamSidang: "09:00:00", agenda: "Panggil Tergugat", alasanDitunda: "putus DIKABULKAN (verstek)", urutanSidang: 3 }] } } });
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
    // G2a 2.4: BAS H-1 yang disiapkan agen (rute sungguhan: lib/agen-h1-bas); tanpa p.h1 = portal tanpa agen (404).
    if (url.includes("/aleta-ecourt/agen-h1-bas") && p.h1) return json({ ok: true, data: polos(p.h1) });
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

// ============================================================================
// Draf tanya jawab otomatis
// ============================================================================
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DS = require(path.join(EKSTENSI, "blangko-derry-draf-saksi.js"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TP = require(path.join(EKSTENSI, "blangko-derry-saksi-tampil.js"));
const tulisTj = (h: Halaman) => h.minta.filter((m) => m.cara === "POST" && m.url.includes("/tanyajawab_perkara_edit") && /aksi=simpan/.test(m.url));
const jawabanTampil = (h: Halaman) => qq(h, "textarea[data-asal]");
const asalTampil = (h: Halaman) => jawabanTampil(h).map((el) => el.getAttribute("data-asal") || "");
const nilaiKolom = (h: Halaman, sk: string) => qq(h, `textarea[data-sba][data-sk="${sk}"]`).map((el) => (el as HTMLTextAreaElement).value);
async function bukaSaksiPertama(h: Halaman) {
  await pilihBas(h);
  await sampai(() => q(h, '[data-tj="saksi 1 p"]'), "tombol saksi 1");
  klik(h, '[data-tj="saksi 1 p"]');
  await sampai(() => q(h, '[data-bd2="simpantj"]'), "penyunting terbuka");
}
const SAKSI_ADA = [
  { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Ya, saya kenal Penggugat karena saya ibu kandungnya;" },
  { no: "2", tanya: "Bagaimana keadaan rumah tangga mereka?", jawab: "Sering bertengkar soal nafkah;" },
];

describe("Draf tanya jawab saksi langsung terisi (G2a 2.1)", () => {
  it("PP membuka penyunting: set yang disarankan terpasang sendiri, jawaban dari data perkara, sisanya ditandai; tidak menulis ke ABT", async () => {
    const h = bukaPP();
    await bukaSaksiPertama(h);
    // tanpa menekan Muat: tabel berisi pertanyaan
    await sampai(() => jawabanTampil(h).length >= 4, "draf tergambar");
    // jawaban dari data perkara (posita: nafkah, judi, pergi Juni 2025) diisi pengisi jawaban yang sama dengan Muat
    await sampai(() => asalTampil(h).includes("data"), "ada jawaban dari data perkara", 8000);
    const asal = asalTampil(h);
    expect(asal.every((a) => ["data", "ragu", "kosong", "contoh"].includes(a))).toBe(true);
    // draf tidak pernah tampil sebagai "ketikan petugas"
    expect(asal).not.toContain("manual");
    // catatan di sebelah tombol Muat menjelaskan asalnya, tanpa istilah teknis
    const catat = q(h, "#bd-muatstat")?.textContent || "";
    expect(catat).toMatch(/Draf disusun otomatis pukul \d{2}\.\d{2} dari set pertanyaan yang disarankan \(Cerai - /);
    expect(catat).toMatch(/Belum disimpan ke ABT/);
    expect(catat).not.toMatch(/variabel|penanda|kode|#/i);
    // ringkasan menyebut yang harus diperiksa petugas
    const ringkas = (q(h, "#bd-asalringkas")?.textContent || "").replace(/\s+/g, " ");
    expect(ringkas).toMatch(/\d+ terisi · \d+ ragu · \d+ perlu dilengkapi/);
    // tombol saksi menyebut belum disimpan; ABT tidak ditulis
    expect(q(h, '[data-tj="saksi 1 p"]')!.textContent).toMatch(/belum disimpan/);
    await tunggu(150);
    expect(tulisTj(h)).toEqual([]);
    expect(Object.keys(h.tj)).toEqual([]);
  });

  it("tanya jawab yang sudah ada di ABT tidak disentuh", async () => {
    const h = bukaPP();
    h.tj["5058@3"] = polos(SAKSI_ADA);
    await bukaSaksiPertama(h);
    await sampai(() => nilaiKolom(h, "0").filter((x) => x.trim()).length >= 2, "daftar terbaca");
    await tunggu(300);
    expect(nilaiKolom(h, "0").slice(0, 2)).toEqual(SAKSI_ADA.map((r) => r.jawab));
    expect(nilaiKolom(h, "0").filter((x) => x.trim()).length).toBe(2);
    expect(tulisTj(h)).toEqual([]);
    expect(h.tj["5058@3"]).toEqual(SAKSI_ADA);
  });

  it("tersimpan hanya lewat Simpan ke ABT, dengan bunyi draf yang tampil", async () => {
    const h = bukaPP();
    await bukaSaksiPertama(h);
    await sampai(() => asalTampil(h).includes("data"), "jawaban dari data", 8000);
    await tunggu(100);
    const tampilA = nilaiKolom(h, "0");
    expect(tulisTj(h)).toEqual([]);
    klik(h, '[data-bd2="simpantj"]');
    await sampai(() => h.tj["5058@3"] && h.tj["5058@3"].length, "tersimpan saksi 1", 8000);
    // yang tersimpan = yang tampil (dirapikan seperti biasa: titik koma akhir butir)
    const rapi = (x: string) => x.replace(/[;.\s]+$/, "").replace(/;/g, ",");
    const tersimpan = h.tj["5058@3"].map((r) => rapi(r.jawab));
    expect(tersimpan).toEqual(tampilA.filter((x) => x.trim()).map(rapi));
    // tidak satu kata nama aplikasi masuk ke ABT
    expect(JSON.stringify(h.tj)).not.toMatch(/aleta/i);
  });

  it("Urungkan mengembalikan daftar kosong", async () => {
    const h = bukaPP();
    await bukaSaksiPertama(h);
    await sampai(() => asalTampil(h).includes("data"), "pengisi jawaban selesai", 8000);
    await tunggu(100);
    for (let i = 0; i < 6 && jawabanTampil(h).length; i += 1) {
      const u = q(h, '[data-sbaksi="urung"]') as HTMLButtonElement | null;
      if (!u || u.disabled) break;
      u.click();
      await tunggu(60);
    }
    expect(jawabanTampil(h).length).toBe(0);
    await tunggu(200);
    expect(jawabanTampil(h).length).toBe(0);
    expect(tulisTj(h)).toEqual([]);
  });

  it("putusan, hakim (hanya baca): tanpa draf", async () => {
    const h = buka();
    await pilihPutusan(h);
    await sampai(() => q(h, '#bd-saksikosong [data-bd2="isisaksi"]'), "peringatan");
    klik(h, '#bd-saksikosong [data-bd2="isisaksi"]');
    await sampai(() => q(h, ".bd-tjbaca"), "hanya baca");
    await tunggu(200);
    expect(q(h, ".bd-tjbaca")!.textContent || "").not.toMatch(/Draf disusun otomatis/);
    expect(qq(h, "textarea[data-asal]").length).toBe(0);
    expect(tulisTj(h)).toEqual([]);
  });
});

describe("Pemilih set draf (fungsi murni)", () => {
  const S = (id: string, utama: boolean, tambahan = false, n = 3) => ({ id, judul: id, utama, tambahan, baris: Array.from({ length: n }, (_, i) => ({ tanya: `t${i}`, jawab: `j${i}` })) });
  it("set utama = disarankan bukan tambahan; tambahan = tambahan yang disarankan", () => {
    const p = DS.pilihSetDraf([S("tambah-verstek", true, true), S("cerai-F", true), S("cerai-A", false), S("tambah-kontra", false, true), S("tambah-itsbat", true, true)]);
    expect(p.utama.id).toBe("cerai-F");
    expect(p.tambahan.map((x: { id: string }) => x.id)).toEqual(["tambah-verstek", "tambah-itsbat"]);
    expect(DS.pilihSetDraf([S("cerai-F", false)])).toBeNull();
    expect(DS.pilihSetDraf([S("cerai-F", true, false, 0)])).toBeNull();
    expect(DS.pilihSetDraf(undefined)).toBeNull();
  });
  it("hanya daftar terbaca kosong, belum diubah, tanpa galat, bukan hanya-baca/katalog", () => {
    const t = (x: Record<string, unknown>) => ({ dimuat: true, memuat: false, berubah: false, galat: "", rows: [], ...x });
    expect(DS.perluDraf(t({}), {})).toBe(true);
    expect(DS.perluDraf(t({ rows: [{ tanya: "", jawab: "" }] }), {})).toBe(true);
    expect(DS.perluDraf(t({ rows: [{ tanya: "Kenal?", jawab: "" }] }), {})).toBe(false);
    expect(DS.perluDraf(t({ berubah: true }), {})).toBe(false);
    expect(DS.perluDraf(t({ dimuat: false }), {})).toBe(false);
    expect(DS.perluDraf(t({ galat: "Tanya jawab tidak terbaca." }), {})).toBe(false);
    expect(DS.perluDraf(t({}), { hanyaBaca: true })).toBe(false);
    expect(DS.perluDraf(t({}), { katalog: true })).toBe(false);
    expect(DS.perluDraf(null, {})).toBe(false);
  });
  it("kalimat contoh yang belum diubah ditandai 'contoh', bukan ketikan petugas; diketik = manual; dari data = data", () => {
    expect(TP.asalBaris({ tanya: "a", jawab: "Saksi melihat sendiri", dasar: "Saksi melihat sendiri" })).toBe("contoh");
    expect(TP.asalBaris({ tanya: "a", jawab: "Saksi mendengar dari tetangga", dasar: "Saksi melihat sendiri" })).toBe("manual");
    expect(TP.asalBaris({ tanya: "a", jawab: "Sejak Juni 2025", dasar: "Sejak ...", otomatis: "Sejak Juni 2025" })).toBe("data");
    expect(TP.asalBaris({ tanya: "a", jawab: "Sejak ...", dasar: "Sejak ..." })).toBe("kosong");
    expect(TP.alasanRagu({ tanya: "a", jawab: "x", dasar: "x" })).toMatch(/Sesuaikan dengan keterangan saksi/);
    const h = TP.hitungAsal([[{ tanya: "a", jawab: "x", dasar: "x" }, { tanya: "b", jawab: "y" }]]);
    expect(h).toMatchObject({ contoh: 1, manual: 1, terisi: 1, total: 2 });
    expect(TP.ringkasAsal(h)).toBe("1 terisi · 0 ragu · 0 perlu dilengkapi · 1 kalimat contoh");
    expect(TP.ringkasAsal(TP.hitungAsal([[{ tanya: "b", jawab: "y" }]]))).toBe("1 terisi · 0 ragu · 0 perlu dilengkapi");
  });
});

describe("Pengisi jawaban: 'menurut yang Saudara ketahui' bukan pertanyaan cara saksi tahu (temuan ukur G2a)", () => {
  it("pertanyaan sikap pihak lawan tidak dijawab 'saya melihat sendiri'; pertanyaan cara tahu tetap", () => {
    const u = require_("../services/abtUsulanService");
    const p = require_("../services/pemilihRagam");
    const SIKAP = "Bagaimana sikap Tergugat terhadap rumah tangganya dengan Penggugat menurut yang Saudara ketahui, apakah masih ingin mempertahankannya?";
    const CARA = "Bagaimana Saudara mengetahui penyebab pertengkaran itu?";
    const templat = [
      { no: "1", tanya: SIKAP, jawab: "Tergugat ... (membantah adanya pertengkaran / tidak keberatan bercerai / masih ingin mempertahankan rumah tangga);" },
      { no: "2", tanya: CARA, jawab: "Saya ..." },
    ];
    const h = u.susunKeteranganSaksiSdg({ templat, posita: "", alasan: [], pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", kodeKumpulan: "", jenisPerkara: "347", alur: "15", tanggalSidang: "", modus: { saksi1: "sama", saksi2: "sebagian" } });
    expect(h.ok).toBe(true);
    expect(h.saksi1[0].jawab).not.toMatch(/mata kepala|melihat sendiri|menyaksikan/i);
    expect(h.saksi1[0].jawab).toMatch(/\.\.\./);
    expect(h.saksi1[1].jawab).toMatch(/menyaksikan|melihat/i);
    expect(p.kelompokTanya(SIKAP).kelompok).not.toBe("cara tahu");
    expect(p.kelompokTanya("Dari mana Saudara tahu mereka sering bertengkar?").kelompok).toBe("cara tahu");
  });
});

// ============================================================================
// G2a 2.4 - BAS sidang yang disiapkan agen H-1 terbuka sendiri untuk PP
// ============================================================================
const DRAF_H1 = (tanggal: string) => ({
  perkaraId: "10154",
  nomorPerkara: "581/Pdt.G/2026/PA.Dgl",
  tanggalSidang: tanggal,
  jenisAgenda: "pembuktian",
  blangko: { folder: "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang", berkas: `${BLANGKO_BAS}.rtf`, menu: "BAS CG", alias: [], label: "BAS 2 - saksi dan putusan verstek" },
  alasan: "Sidang pembuktian dengan dua saksi.",
  catatan: [],
});
const PK_H1 = (sidang: unknown[]) => [PK("581/Pdt.G/2026", "Cerai Gugat", sidang, { sudahPutus: false, tanggalPutusan: "" })];
const blangkoTerbuka = (h: Halaman) => {
  const k = h.w.aletaBlangkoDerryIsian && typeof h.w.aletaBlangkoDerryIsian.keadaan === "function" ? h.w.aletaBlangkoDerryIsian.keadaan() : null;
  return k && k.blangko ? String(k.blangko.berkas || k.blangko.nama || "") : "";
};
async function bukaPerkaraSaja(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, '[data-pk="581/Pdt.G/2026/PA.Dgl"]');
}
const tandaBas = (h: Halaman) => qq(h, "*").some((el) => el.children.length === 0 && (el.textContent || "").includes(BLANGKO_BAS));

describe("BAS sidang berikutnya disiapkan otomatis (G2a 2.4)", () => {
  it("PP membuka perkara pada hari sidangnya: blangko BAS draf terbuka sendiri, tanpa menulis ke ABT", async () => {
    const h = bukaPP({ daftar: PK_H1([SI("2026-10-15", "Sidang Pertama", "Tergugat tidak hadir", { urutan: 1, adaBas: true }), SI(HARI_INI, "Pembuktian", "", { urutan: 2 })]), h1: { ada: true, hariIni: HARI_INI, peta: { "10154": DRAF_H1(HARI_INI) } } });
    await bukaPerkaraSaja(h);
    await sampai(() => mintaKe(h, /agen-h1-bas\?perkaraId=10154/).length, "draf dibaca");
    await sampai(() => mintaKe(h, /\/main\/cari/, "POST").length && (q(h, "#bd-perlu .bd-f") || q(h, "[data-tj]")), "blangko draf terbuka", 8000);
    const cari = mintaKe(h, /\/main\/cari/, "POST");
    expect(cari.length).toBe(1);
    expect(mintaKe(h, /tanyajawab_perkara_edit\?aksi=simpan/)).toEqual([]);
    expect(mintaKe(h, /edit_data\?/, "POST").every((m) => !/5058|5059/.test(m.url))).toBe(true);
  });

  it("sore sebelum sidang (H-1): sidang berikutnya dipilih sendiri bila BAS sidang lalu sudah terunggah, lalu blangkonya dibuka", async () => {
    const besok = "2026-10-28";
    const h = bukaPP({ daftar: PK_H1([SI("2026-10-15", "Sidang Pertama", "Tergugat tidak hadir", { urutan: 1, adaBas: true }), SI(besok, "Pembuktian", "", { urutan: 2 })]), h1: { ada: true, hariIni: HARI_INI, peta: { "10154": DRAF_H1(besok) } } });
    await bukaPerkaraSaja(h);
    await sampai(() => (q(h, "#bd-sidang") as HTMLSelectElement | null)?.value === "1", "sidang besok terpilih", 8000);
    await sampai(() => mintaKe(h, /\/main\/cari/, "POST").length, "blangko draf terbuka", 8000);
  });

  it("BAS sidang lalu belum terunggah: sidang tidak dipindah dan blangko tidak dibuka", async () => {
    const besok = "2026-10-28";
    const h = bukaPP({ daftar: PK_H1([SI("2026-10-15", "Sidang Pertama", "Tergugat tidak hadir", { urutan: 1, adaBas: false }), SI(besok, "Pembuktian", "", { urutan: 2 })]), h1: { ada: true, hariIni: HARI_INI, peta: { "10154": DRAF_H1(besok) } } });
    await bukaPerkaraSaja(h);
    await sampai(() => mintaKe(h, /agen-h1-bas\?perkaraId=10154/).length, "draf dibaca");
    await tunggu(400);
    expect((q(h, "#bd-sidang") as HTMLSelectElement | null)?.value).toBe("0");
    expect(mintaKe(h, /\/main\/cari/, "POST")).toEqual([]);
  });

  it("hakim tidak dibukakan BAS; portal tanpa agen = panel seperti biasa", async () => {
    const h = buka({ orang: "hakim", daftar: PK_H1([SI(HARI_INI, "Pembuktian", "", { urutan: 1 })]), h1: { ada: true, hariIni: HARI_INI, peta: { "10154": DRAF_H1(HARI_INI) } } });
    await bukaPerkaraSaja(h);
    await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
    await tunggu(400);
    expect(mintaKe(h, /agen-h1-bas/)).toEqual([]);
    expect(mintaKe(h, /\/main\/cari/, "POST")).toEqual([]);
    const h2 = bukaPP({ daftar: PK_H1([SI(HARI_INI, "Pembuktian", "", { urutan: 1 })]) });
    await bukaPerkaraSaja(h2);
    await sampai(() => q(h2, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
    await tunggu(400);
    expect(mintaKe(h2, /\/main\/cari/, "POST")).toEqual([]);
    void blangkoTerbuka;
    void tandaBas;
  });
});
