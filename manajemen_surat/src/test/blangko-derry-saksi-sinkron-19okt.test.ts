// @vitest-environment node
/**
 * ============================================================================
 * 19 OKT 2026 - TANYA JAWAB SAKSI BLANGKO DERRY SINKRON DENGAN SUSUN SAKSI
 * ============================================================================
 *
 * Keluhan: di panel "Blangko ABT by Derry Briantono" jawaban saksi tidak terisi
 * otomatis (masih "saya adalah ... Penggugat", "menikah pada ... di ...") dan
 * tidak ada pilihan pengetahuan saksi seperti Susun saksi di panel ABT.
 *
 * Yang dijaga (blangko-derry-saksi.js + blangko-derry-isian.js dijalankan
 * SUNGGUHAN di jsdom; rute /abt/usulan bot yang SUNGGUHAN dijalankan di node:vm
 * bersama abtUsulanService yang asli - hanya pembacaan SIPP yang ditiru):
 *   1. daftar pengetahuan saksi, sumber cerita, dan alasan sama dengan abt.js;
 *      muatan permintaan berbentuk sama dengan susunMuatanSdg milik abt.js;
 *   2. jawaban terisi dari data SIPP rekaan (hubungan saksi, posita) lewat jalur
 *      'saksi-sdg' yang sama; yang tak ada datanya tetap titik-titik;
 *   3. pilihan pengetahuan per saksi tampil di atas tabel, diingat per perkara,
 *      dan mengubahnya menyusun ulang jawaban saksi itu;
 *   4. isian yang sudah diketik tidak ditimpa tanpa konfirmasi di halaman;
 *      Urungkan tetap bekerja;
 *   5. muatan Simpan ke ABT tidak memuat kata ALETA; jalur simpan tidak berubah;
 *   6. jenis perkara selain cerai ikut (jenis dikirim sebagai id SIPP).
 */
import { readFileSync } from "node:fs";
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
const POSITA =
  "Bahwa Penggugat dan Tergugat menikah pada tanggal 17 Januari 2014 dan pernikahan tersebut dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah;" +
  "bahwa setelah menikah Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Donggala selama 10 tahun; " +
  "bahwa dari pernikahan tersebut telah dikaruniai 2 orang anak; " +
  "bahwa sejak bulan Maret 2025 rumah tangga Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran disebabkan Tergugat tidak memberi nafkah dan sering berjudi; " +
  "bahwa sejak bulan Juni 2025 Tergugat pergi meninggalkan rumah dan hingga kini tidak pernah kembali sehingga Penggugat dan Tergugat telah berpisah tempat tinggal; " +
  "bahwa pihak keluarga telah berupaya merukunkan Penggugat dan Tergugat namun tidak berhasil;";
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
  D("5059", "TanyaJwb Saksi 2 P", "tanya_jawab"),
  D("11111", "PENANDA ADA KUASA #0046#", "data_sql", "select ..."),
  D("11116", "PENANDA ALASAN C (8503)", "data_sql", "select ..."),
  D("11117", "PENANDA ALASAN H (8503)", "data_sql", "select ..."),
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
]);
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1214", "2021", "2022", "0156", "0184", "8536", "0227", "11111", "11116", "11117", "0033"];
const PENANDA_BAS = ["0001", "0033", "0050", "1214", "5058", "5059", "8503"];
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
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; tj: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; pdfRtf: string[]; opsi: { hakTolak?: boolean } };
const terbuka: JSDOM[] = [];
const usulanMinta: any[] = [];
const usulanAlasan: any[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; jenis?: string; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array } = {}): Halaman {
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
  const tj: Halaman["tj"] = { "5058": [], "5059": [] };
  const pdfRtf: string[] = [];
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
      if (kode === "1214" && !abt[kode]) return html(POPUP(kode, "data_teks", BAWAAN_1214));
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

// ============================================================================
// Pembantu uji
// ============================================================================
const jawab = (h: Halaman, sisi: number, i: number) => (q(h, `[data-sba="${i}"][data-sk="${sisi}"]`) as HTMLTextAreaElement).value;
const tanya = (h: Halaman, i: number) => (q(h, `[data-sbq="${i}"]`) as HTMLTextAreaElement).value;
const barisKe = (h: Halaman, kata: RegExp) => qq(h, "[data-sbq]").findIndex((el) => kata.test((el as HTMLTextAreaElement).value));
const semuaJawab = (h: Halaman, sisi: number) => qq(h, `[data-sba][data-sk="${sisi}"]`).map((el) => (el as HTMLTextAreaElement).value);
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

describe("daftar pilihan sama dengan Susun saksi di abt.js", () => {
  it("DAFTAR_MODUS, DAFTAR_SUMBER, dan pilihan alasan: isi dan urutan identik", () => {
    const abt = baca("abt.js");
    const ambilDaftar = (nama: string, penutup: string) => {
      const mulai = abt.indexOf(`const ${nama} = [`);
      expect(mulai, nama).toBeGreaterThan(0);
      const akhir = abt.indexOf(penutup, mulai) + penutup.length;
      return new Function(`return ${abt.slice(mulai + `const ${nama} = `.length, akhir).replace(/;\s*$/, "")}`)();
    };
    const mod = require_("../../ekstensi-sipp/blangko-derry-saksi.js");
    expect(mod.DAFTAR_MODUS).toEqual(ambilDaftar("DAFTAR_MODUS", "\n    ];"));
    expect(mod.DAFTAR_SUMBER).toEqual(ambilDaftar("DAFTAR_SUMBER", "\n    ];"));
    expect(mod.alasanBawaan().map((a: { kunci: string }) => a.kunci)).toEqual(ambilDaftar("DAFTAR_ALASAN_SDG", "\n];"));
    expect(mod.DAFTAR_MODUS.map((x: string[]) => x[0])).toEqual(["sama", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah"]);
  });

  it("muatan permintaan sama bentuk dengan susunMuatanSdg milik abt.js", () => {
    const abt = baca("abt.js");
    const a1 = abt.indexOf("function sebutanSumberSdg(");
    const a2 = abt.indexOf("/**\n * Nama jenis perkara SIPP");
    const b1 = abt.indexOf("function susunMuatanSdg(");
    const b2 = abt.indexOf("/**\n * Templat MENTAH");
    expect(a1 > 0 && a2 > a1 && b1 > 0 && b2 > b1).toBe(true);
    const konteks = vm.createContext({});
    const n1 = abt.indexOf("function nilaiUpayaDamai(");
    const n2 = abt.indexOf("/* === PSAKSI 12 Okt === */");
    expect(n1 > 0 && n2 > n1).toBe(true);
    vm.runInContext(`${abt.slice(a1, a2)}\n${abt.slice(n1, n2)}\n${abt.slice(b1, b2)}\nglobalThis.susunMuatanSdg = susunMuatanSdg;`, konteks);
    const masuk = {
      nomorPerkara: "581/Pdt.G/2026/PA.Dgl",
      templat: [{ no: "1", tanya: "Kenal?", jawab: "Kenal ..." }],
      kodeKumpulan: "ALETA:cerai-F",
      jenisPerkara: "347",
      alur: "15",
      pelaku: "Tergugat",
      lawan: "Penggugat",
      saksi: [
        { pihak: "P", ke: 1, modus: "sama", sumber: "penggugat", alasan: [] },
        { pihak: "P", ke: 2, modus: "dari-cerita", sumber: "keluarga", alasan: ["judi"] },
        { pihak: "T", ke: 1, modus: "sebagian", sumber: "tergugat", alasan: ["cemburu", "judi"] },
      ],
    };
    const mod = require_("../../ekstensi-sipp/blangko-derry-saksi.js");
    // Di sini abt.js tidak termuat (tanpa global), jadi yang diuji adalah cadangan lokal.
    expect(JSON.parse(JSON.stringify(mod.susunMuatan(masuk)))).toEqual((konteks as { susunMuatanSdg: (o: unknown) => unknown }).susunMuatanSdg(masuk));
  });
});

describe("aturan memasang jawaban (murni)", () => {
  const m = () => require_("../../ekstensi-sipp/blangko-derry-saksi.js");
  const baris = [
    { no: "1", tanya: "Kenal?", jawab: "Saya adalah ... Penggugat;", dasar: "Saya adalah ... Penggugat;" },
    { no: "2", tanya: "Anak?", jawab: "Dikaruniai ... orang anak;", dasar: "Dikaruniai ... orang anak;" },
    { no: "3", tanya: "Nafkah?", jawab: "Diketik sendiri oleh petugas;", dasar: "Contoh nafkah ...;" },
    { no: "4", tanya: "Lain?", jawab: "" },
  ];
  it("baris yang sudah diketik tertahan; kosong dan dasar terisi; penanda belum-terisi tidak dipasang", () => {
    const hasil = m().pasangJawaban(
      baris,
      [
        { jawab: "Saya adalah tetangga Penggugat;" },
        { jawab: "[BELUM TERISI - isi dari keterangan saksi]", belumTerisi: true },
        { jawab: "Tergugat tidak memberi nafkah;" },
        { jawab: "Ya, ada;" },
      ],
      {}
    );
    expect(hasil.rows[0].jawab).toBe("Saya adalah tetangga Penggugat;");
    expect(hasil.rows[1].jawab).toBe("Dikaruniai ... orang anak;"); // tetap titik-titik
    expect(hasil.rows[2].jawab).toBe("Diketik sendiri oleh petugas;"); // isian manual menang
    expect(hasil.rows[3].jawab).toBe("Ya, ada;");
    expect(hasil.tertahan).toEqual([{ i: 2, usul: "Tergugat tidak memberi nafkah;" }]);
    expect(hasil.terisi).toBe(2);
    expect(hasil.tetapTitik).toBe(1);
    // masukan tidak diubah
    expect(baris[0].jawab).toBe("Saya adalah ... Penggugat;");
  });
  it("timpa:true mengganti juga yang diketik; jawaban berpilihan tidak dipilihkan; kata ALETA ditolak", () => {
    const hasil = m().pasangJawaban(baris, [{}, {}, { jawab: "Tergugat tidak memberi nafkah;" }, { jawab: "Sesuai aplikasi ALETA;" }], { timpa: true });
    expect(hasil.rows[2].jawab).toBe("Tergugat tidak memberi nafkah;");
    expect(hasil.rows[3].jawab).toBe("");
    const pilihan = m().pasangJawaban(baris, [{ jawab: "a", pilihan: ["ibu kandung", "tetangga"] }], {});
    expect(pilihan.pilihan).toBe(1);
    expect(pilihan.rows[0].jawab).toBe("Saya adalah ... Penggugat;");
  });
  it("hubungan saksi dari SIPP mengisi titik-titik sebelum sebutan pihak; hubungan dari tebakan jawaban tidak dipakai", () => {
    expect(m().isiHubungan("Ya, saya adalah ... Penggugat;", { asal: "sipp", teks: "ibu kandung Penggugat" })).toBe("Ya, saya adalah ibu kandung Penggugat;");
    expect(m().isiHubungan("Ya, saya adalah ... Penggugat;", { asal: "jawaban", teks: "ibu kandung Penggugat" })).toBe("Ya, saya adalah ... Penggugat;");
  });
});


// abt.js sungguhan tidak dimuat di sini (terlalu besar); potongan murninya dipasang agar Derry memakai
// susunMuatanSdg dan idJenisPerkaraSipp milik abt.js seperti di Chrome (keduanya ada di dunia skrip yang sama).
function pasangPotonganAbt(h: Halaman) {
  const abt = baca("abt.js");
  const a1 = abt.indexOf("function sebutanSumberSdg(");
  const a2 = abt.indexOf("/**\n * Nama jenis perkara SIPP");
  const n1 = abt.indexOf("function nilaiUpayaDamai(");
  const n2 = abt.indexOf("/* === PSAKSI 12 Okt === */");
  const b1 = abt.indexOf("function susunMuatanSdg(");
  const b2 = abt.indexOf("/**\n * Templat MENTAH");
  expect(a2).toBeGreaterThan(a1);
  h.w.eval(`${abt.slice(a1, n2)}\n${abt.slice(b1, b2)}\nglobalThis.susunMuatanSdg = susunMuatanSdg; globalThis.idJenisPerkaraSipp = idJenisPerkaraSipp;`);
}
const tertulis = (h: Halaman, sisi: number) => semuaJawab(h, sisi).join("\n");
const unik = <T,>(a: T[]) => Array.from(new Set(a));

describe("Blangko Derry: jawaban saksi otomatis dan pilihan pengetahuan saksi", () => {
  it("pilihan pengetahuan tiap saksi tampil di atas tabel dengan daftar sama; jawaban terisi dari data SIPP rekaan, sisanya tetap titik-titik", async () => {
    const h = bukaPP();
    pasangPotonganAbt(h);
    await bukaSaksiDanMuat(h);
    // Panel: satu kartu per saksi, daftar & urutan sama dengan abt.js; bawaan sama persis dengan Susun saksi (pertama "sama", lainnya "sebagian").
    expect(qq(h, "[data-skkartu]").map((k) => k.getAttribute("data-skkartu"))).toEqual(["saksi 1 p", "saksi 2 p"]);
    const modus = (k: string) => q(h, `[data-skkunci="${k}"][data-skfld="modus"]`) as HTMLSelectElement;
    const mod = require_("../../ekstensi-sipp/blangko-derry-saksi.js");
    for (const k of ["saksi 1 p", "saksi 2 p"]) {
      expect(Array.from(modus(k).options).map((o) => [o.value, o.textContent])).toEqual(mod.DAFTAR_MODUS);
    }
    expect(modus("saksi 1 p").value).toBe("sama");
    expect(modus("saksi 2 p").value).toBe("sebagian");
    // Panel berada DI ATAS tabel jawaban.
    const panel = q(h, ".bd-skpanel")!;
    expect(panel.compareDocumentPosition(q(h, ".bd-sblist")!) & 4).toBeTruthy();
    // Permintaan ke jalur 'saksi-sdg' yang sama dengan Susun saksi, memakai susunMuatanSdg milik abt.js.
    expect(usulanMinta.length).toBe(1);
    const m = usulanMinta[0];
    expect(m.sumber).toBe("saksi-sdg");
    expect([m.nomorPerkara, m.jenisPerkara, m.alur, m.pelaku, m.lawan]).toEqual(["581/Pdt.G/2026/PA.Dgl", "347", "15", "Tergugat", "Penggugat"]);
    expect(m.saksi.map((s: { pihak: string; ke: number; modus: string }) => [s.pihak, s.ke, s.modus])).toEqual([["P", 1, "sama"], ["P", 2, "sebagian"]]);
    expect(m.saksi[0].sumberNama).toBe("Penggugat");
    expect(m.templat.length).toBeGreaterThanOrEqual(15);
    expect(m.templat.some((b: { jawab: string }) => /\.{3,}/.test(b.jawab))).toBe(true);
    // Terisi dari data perkara.
    const kenal = barisKe(h, /kenal dengan Penggugat dan Tergugat\?/);
    expect(jawab(h, 0, kenal)).toMatch(/ibu kandung Penggugat/i); // hubungan saksi 1 tercatat di SIPP
    expect(jawab(h, 1, kenal)).toMatch(/tetangga Penggugat/i); // hubungan saksi 2 tercatat di SIPP
    const nikah = barisKe(h, /hubungan antara Penggugat dan Tergugat/);
    for (const sisi of [0, 1]) {
      expect(jawab(h, sisi, nikah)).toContain("menikah pada 17 Januari 2014 di wilayah hukum Kantor Urusan Agama Kecamatan Banawa");
      expect(jawab(h, sisi, nikah)).not.toMatch(/\.{3,}/);
    }
    const anak = barisKe(h, /dikaruniai anak/);
    expect(jawab(h, 0, anak)).toContain("dikaruniai 2 orang anak");
    expect(jawab(h, 0, barisKe(h, /Di mana Penggugat dan Tergugat tinggal bersama/))).toContain("rumah orang tua Penggugat di Donggala");
    expect(jawab(h, 0, barisKe(h, /sejak kapan\?$/))).toContain("Maret 2025");
    expect(jawab(h, 0, barisKe(h, /upaya dari keluarga/))).toMatch(/dirukunkan oleh pihak keluarga/);
    // Yang datanya memang tidak ada tetap titik-titik: tidak dikarang, penanda server tidak masuk.
    expect(jawab(h, 0, anak)).toContain("tinggal bersama ...");
    expect(jawab(h, 0, barisKe(h, /Siapa yang meninggalkan tempat tinggal bersama/))).toContain("...");
    for (const sisi of [0, 1]) expect(tertulis(h, sisi)).not.toMatch(/BELUM TERISI/);
    // Ringkasan memberi tahu apa yang terisi dan apa yang tetap titik-titik, tanpa istilah teknis.
    const ringkas = q(h, '[data-skkartu="saksi 1 p"]')!.textContent || "";
    expect(ringkas).toMatch(/jawaban disusun dari data perkara di SIPP dan gugatan/);
    expect(ringkas).toMatch(/tetap titik-titik karena datanya belum ada/);
    expect(akar(h).textContent).not.toMatch(/saksi-sdg|modus|kunci|JSON/i);
    // Tidak ada yang ditulis ke ABT sebelum Simpan ke ABT.
    expect(mintaKe(h, /tanyajawab_perkara_edit\?aksi=simpan/, "POST")).toEqual([]);
  });

  it("mengubah pilihan pengetahuan menyusun ulang jawaban saksi itu saja, diingat per perkara dan saksi; sumber cerita dan alasan sebagian ikut dikirim", async () => {
    const h = bukaPP();
    pasangPotonganAbt(h);
    await bukaSaksiDanMuat(h);
    const sebab = barisKe(h, /penyebab perselisihan/);
    const sebelum1 = jawab(h, 0, sebab);
    const sebelum2 = jawab(h, 1, sebab);
    pilih(h, "saksi 2 p", "modus", "tidak-tahu");
    await sampai(() => usulanMinta.length >= 2, "permintaan ulang");
    await sampai(() => jawab(h, 1, sebab) !== sebelum2, "jawaban saksi 2 berubah");
    expect(usulanMinta[1].saksi[1].modus).toBe("tidak-tahu");
    expect(jawab(h, 1, sebab)).toMatch(/tidak (saya )?(tahu|mengetahui|ketahui)/i);
    expect(jawab(h, 0, sebab)).toBe(sebelum1); // saksi 1 tidak berubah
    // Diingat per perkara + saksi (chrome.storage), pulih pada halaman baru.
    const simpan = h.simpanan["bdSaksiPil:10154"] as { pil: Record<string, { modus: string }> };
    expect(simpan.pil["saksi 2 p"].modus).toBe("tidak-tahu");
    const h2 = bukaPP({ simpanan: h.simpanan });
    await pilihBas(h2);
    klik(h2, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h2, '[data-skkunci="saksi 2 p"][data-skfld="modus"]'), "panel saksi");
    await sampai(() => (q(h2, '[data-skkunci="saksi 2 p"][data-skfld="modus"]') as HTMLSelectElement).value === "tidak-tahu", "pilihan pulih");
    // Dari cerita: pilihan siapa yang bercerita muncul dan ikut dikirim apa adanya (sebutan blangko).
    const awal = usulanMinta.length; // buka() kedua mengosongkan catatan permintaan; hitung relatif
    pilih(h, "saksi 1 p", "modus", "dari-cerita");
    const sumberEl = await sampai(() => q(h, '[data-skkunci="saksi 1 p"][data-skfld="sumber"]'), "pilihan sumber cerita");
    expect(Array.from((sumberEl as HTMLSelectElement).options).map((o) => o.value)).toEqual(["penggugat", "tergugat", "keluarga"]);
    pilih(h, "saksi 1 p", "sumber", "tergugat");
    await sampai(() => usulanMinta.length >= awal + 2, "permintaan sumber cerita");
    const akhir = usulanMinta[usulanMinta.length - 1].saksi[0];
    expect([akhir.modus, akhir.sumber, akhir.sumberNama]).toEqual(["dari-cerita", "tergugat", "Tergugat"]);
    // Sebagian: centang alasan (16 pilihan sama dengan abt.js) ikut dikirim.
    const centang = qq(h, '[data-skkunci="saksi 2 p"][data-skfld="alasan"]') as HTMLInputElement[];
    pilih(h, "saksi 2 p", "modus", "sebagian");
    await sampai(() => qq(h, '[data-skkunci="saksi 2 p"][data-skfld="alasan"]').length === 16 && !/Menyusun jawaban/.test(q(h, '[data-skkartu="saksi 2 p"]')!.textContent || ""), "centang alasan tampil dan permintaan selesai");
    expect(centang.length).toBe(0); // saat modus "tidak-tahu" centang alasan memang tidak tampil
    const judi = qq(h, '[data-skkunci="saksi 2 p"][data-skfld="alasan"]').find((c) => (c as HTMLInputElement).value === "judi") as HTMLInputElement;
    judi.checked = true;
    judi.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => usulanMinta[usulanMinta.length - 1].saksi[1].alasan.includes("judi"), "alasan judi terkirim");
    expect(usulanMinta[usulanMinta.length - 1].saksi[1].modus).toBe("sebagian");
  });

  it("isian yang sudah diketik tidak ditimpa tanpa konfirmasi di halaman; Urungkan mengembalikannya", async () => {
    const h = bukaPP();
    await bukaSaksiDanMuat(h);
    const sebab = barisKe(h, /penyebab perselisihan/);
    const lain = barisKe(h, /masih sanggup merukunkan/);
    const diketik = "Menurut saya karena faktor lain yang saya lihat sendiri;";
    const el = q(h, `[data-sba="${sebab}"][data-sk="0"]`) as HTMLTextAreaElement;
    el.value = diketik;
    el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    const lainSebelum = jawab(h, 0, lain);
    pilih(h, "saksi 1 p", "modus", "tidak-melihat");
    await sampai(() => usulanMinta.length >= 2, "permintaan ulang");
    await sampai(() => q(h, '[data-bd2="timpaoto"]'), "pemberitahuan jawaban diketik");
    expect(jawab(h, 0, sebab)).toBe(diketik); // manual menang
    expect(q(h, '[data-skkartu="saksi 1 p"]')!.textContent).toMatch(/jawaban yang sudah Anda ketik tidak diubah/);
    expect(jawab(h, 0, barisKe(h, /melihat atau mendengar sendiri/))).toMatch(/tidak menyaksikan/i);
    expect(jawab(h, 0, lain)).toBeTruthy();
    void lainSebelum;
    // Konfirmasi dua langkah di halaman.
    klik(h, '[data-bd2="timpaoto"]');
    expect(jawab(h, 0, sebab)).toBe(diketik);
    expect(q(h, '[data-bd2="timpaoto"]')!.textContent).toMatch(/Klik sekali lagi/);
    klik(h, '[data-bd2="batalimpa"]');
    expect(q(h, '[data-bd2="timpaoto"]')!.textContent).toMatch(/Ganti dengan susunan otomatis/);
    klik(h, '[data-bd2="timpaoto"]');
    klik(h, '[data-bd2="timpaoto"]');
    expect(jawab(h, 0, sebab)).not.toBe(diketik);
    // Urungkan tetap bekerja.
    klik(h, '[data-sbaksi="urung"]');
    expect(jawab(h, 0, sebab)).toBe(diketik);
  });

  it("Simpan ke ABT memakai jalur lama: muatan tanya jawab tanpa kata ALETA, jawaban otomatis ikut tersimpan", async () => {
    const h = bukaPP();
    await bukaSaksiDanMuat(h);
    klik(h, '[data-bd2="simpantj"]');
    await sampai(() => h.tj["5058"].length > 0 && h.tj["5059"].length > 0, "tersimpan");
    const simpan = mintaKe(h, /tanyajawab_perkara_edit\?aksi=simpan&no_var=505[89]/, "POST");
    expect(simpan.length).toBe(2);
    for (const s of simpan) {
      const data = JSON.parse(new URLSearchParams(s.badan).get("data")!) as Array<{ no: string; tanya: string; jawab: string }>;
      expect(data.length).toBeGreaterThanOrEqual(15);
      expect(Object.keys(data[0]).sort()).toEqual(["jawab", "no", "tanya"]);
      expect(JSON.stringify(data)).not.toMatch(/aleta/i);
      expect(JSON.stringify(data)).not.toMatch(/BELUM TERISI/);
      expect(JSON.stringify(data)).toContain("17 Januari 2014");
    }
    // sidang diperiksa dulu seperti sebelumnya
    const idxCek = h.minta.findIndex((m) => /edit_data\?no_var=0050/.test(m.url));
    const idxSimpan = h.minta.findIndex((m) => /aksi=simpan&no_var=5058/.test(m.url));
    expect(idxCek).toBeGreaterThanOrEqual(0);
    expect(idxCek).toBeLessThan(idxSimpan);
    await sampai(() => /tersimpan di ABT/.test(akar(h).textContent || ""), "keterangan tersimpan");
  });

  it("jenis perkara selain cerai ikut: jenis dikirim sebagai id SIPP dan panel pilihan tampil", async () => {
    const h = bukaPP({ jenis: "Dispensasi Kawin" });
    pasangPotonganAbt(h);
    await pilihBas(h);
    klik(h, '[data-tj="saksi 1 p"]');
    const sel = (await sampai(() => q(h, '#bd-muattpl optgroup[label^="Panduan"]') && q(h, "#bd-muattpl"), "panduan set")) as HTMLSelectElement;
    await sampai(() => !(q(h, '[data-skkunci="saksi 1 p"][data-skfld="modus"]') as HTMLSelectElement)?.disabled, "panel pengetahuan siap");
    sel.value = (sel.querySelector('optgroup[label^="Panduan"] option') as HTMLOptionElement).value;
    klik(h, '[data-bd2="muattpl"]');
    await sampai(() => usulanMinta.length >= 1, "permintaan jawaban");
    expect(usulanMinta[0].jenisPerkara).toBe("362");
    expect(usulanMinta[0].alur).toBe("15");
    expect(usulanMinta[0].saksi.length).toBe(2);
    await sampai(() => q(h, '[data-skkartu="saksi 1 p"] .bd-catat, [data-skkartu="saksi 1 p"] .bd-peringatan'), "ringkasan");
    expect(tertulis(h, 0)).not.toMatch(/BELUM TERISI/);
  });

  it("server tidak menjawab: set pertanyaan tetap termuat apa adanya, fitur lama tidak berkurang, tombol susun ulang memberi kabar", async () => {
    const h = bukaPP({ botMati: true });
    await pilihBas(h);
    klik(h, '[data-tj="saksi 1 p"]');
    const sel = (await sampai(() => q(h, '#bd-muattpl optgroup[label^="Panduan"]') && q(h, "#bd-muattpl"), "panduan set")) as HTMLSelectElement;
    sel.value = "aleta:cerai-F";
    klik(h, '[data-bd2="muattpl"]');
    await sampai(() => qq(h, "[data-sbq]").length >= 15, "set termuat");
    expect(jawab(h, 1, 0)).toContain("..."); // titik-titik apa adanya
    klik(h, '[data-bd2="isioto"]');
    await sampai(() => /belum dapat disusun/.test(akar(h).textContent || ""), "kabar server");
    // Fitur lama tetap ada.
    for (const s of ['[data-tjmode="sisi"]', '[data-tjmode="satu"]', '[data-sbaksi="urut"]', '[data-sbaksi="samakanq"]', '[data-sbaksi="salinsemua"]', '[data-sbaksi="rapikan"]', '[data-sbaksi="urung"]', '[data-sbaksi="ulang"]', '[data-bd2="muattpl"]', '[data-bd2="tambahtj"]', '[data-bd2="simpantj"]', "#bd-muattpl"]) {
      expect(q(h, s), s).not.toBeNull();
    }
    // Satu per satu: pilihan saksi itu saja.
    klik(h, '[data-tjmode="satu"]');
    await sampai(() => qq(h, "[data-skkartu]").length === 1, "satu kartu");
    expect(unik(qq(h, "[data-skkartu]").map((k) => k.getAttribute("data-skkartu")))).toEqual(["saksi 1 p"]);
  });
});
