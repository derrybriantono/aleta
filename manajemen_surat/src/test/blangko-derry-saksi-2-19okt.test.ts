// @vitest-environment node
/**
 * ============================================================================
 * 19 OKT 2026 (TAHAP 2) - TANYA JAWAB SAKSI BLANGKO DERRY: satu paragraf, tombol per peran, tukar/pindah jawaban
 * ============================================================================
 *
 * Yang dijaga (mesin bot abtUsulanService dijalankan sungguhan; blangko-derry-saksi.js + blangko-derry-isian.js
 * dijalankan sungguhan di jsdom; SIPP/ABT ditiru):
 *   1. jawaban tidak memuat baris baru di tengah kalimat dan butir panjang disambung dengan penyambung wajar
 *      ("A, selain itu B, dan C"), satu jawaban = satu paragraf berakhir ";" (contoh posita bergaris baru);
 *   2. deret tombol per peran: PP pada BAS; "Selesai" hilang; "Simpan ke ABT" di bawah tabel; "Set pertanyaan saksi" tidak
 *      lagi di deret isian; "Bersihkan kalimat penutup" tidak tampil di BAS; fungsi jarang di menu "Lainnya";
 *   3. tombol per jawaban: tukar (pilih saksi tujuan bila saksi lebih dari dua), naik/turun jawaban, salin, urungkan;
 *   4. alasan "sebagian": hanya alasan yang ada di posita tampil, sisanya di "Alasan lain";
 *   5. putusan dan peran hakim: tanya jawab saksi hanya dibaca (terlipat), tanpa satu pun tombol sunting.
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
  const tj: Halaman["tj"] = { "5058": [], "5059": [], "5060": [] };
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


// ============================================================================
// 1. MESIN: satu jawaban satu paragraf, penyambung wajar
// ============================================================================
const svc = () => require_("../services/abtUsulanService");
const POSITA_PATAH_DAFTAR =
  "Bahwa Penggugat dan Tergugat menikah pada tanggal 17 Januari 2014;\n" +
  "bahwa sejak Maret 2020 rumah tangga sering terjadi perselisihan dan pertengkaran yang disebabkan karena:\n" +
  "Tergugat suka bermain game,\n" +
  "Tergugat kurang memberikan perhatian sehingga untuk memenuhi kebutuhan rumah\n" +
  "tangga hanya dibantu oleh Penggugat,\n" +
  "Tergugat\n" +
  "sering mengungkit pemberian orang tua Penggugat;\n" +
  "bahwa sejak Juni 2025 Penggugat dan Tergugat telah pisah tempat tinggal;";
const POSITA_PATAH_KEPALA =
  "Bahwa menikah pada tanggal 17 Januari 2014;\n" +
  "Bahwa sebab-sebab terjadinya perselisihan Penggugat dan Tergugat yakni:\n" +
  "1. Tergugat suka bermain game\n" +
  "2. Tergugat kurang memberikan perhatian sehingga untuk memenuhi kebutuhan rumah\n" +
  "tangga hanya dibantu oleh Penggugat\n" +
  "3. Tergugat\n" +
  "sering mengungkit pemberian orang tua Penggugat\n" +
  "Bahwa sejak Juni 2025 telah pisah tempat tinggal;";
const POSITA_PATAH_HTML =
  "<ol><li>Bahwa menikah pada tanggal 17 Januari 2014;</li><li>Bahwa rumah tangga sering terjadi perselisihan yang disebabkan karena Tergugat suka bermain game, Tergugat kurang memberikan perhatian dan Tergugat<br>sering mengungkit pemberian orang tua Penggugat;</li></ol>";
const TEMPLAT_SEBAB = [
  { no: "1", tanya: "Apa yang biasa menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat?", jawab: "Yang biasa menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat adalah sebab ........;" },
  { no: "2", tanya: "Apakah saudara mengetahui penyebab perselisihan?", jawab: "Penyebabnya yang saya tahu yaitu ........;" },
];
const susunSaksi = (posita: string, modus1 = "sama") =>
  svc().susunKeteranganSaksiSdg({
    templat: TEMPLAT_SEBAB,
    posita,
    pelaku: "Tergugat",
    lawan: "Penggugat",
    nomorPerkara: "581/Pdt.G/2026/PA.Dgl",
    kodeKumpulan: "uji",
    jenisPerkara: "347",
    alur: "15",
    modus: { saksi1: { modus: modus1 }, saksi2: { modus: "sebagian" } },
  });

describe("mesin: jawaban saksi tanpa baris baru di tengah kalimat, dengan penyambung wajar", () => {
  for (const [nama, posita] of [
    ["daftar sesudah 'disebabkan karena:'", POSITA_PATAH_DAFTAR],
    ["kepala daftar 'sebab-sebab ... yakni:'", POSITA_PATAH_KEPALA],
    ["posita HTML dengan <br> di tengah kalimat", POSITA_PATAH_HTML],
  ] as const) {
    it(`posita bergaris baru - ${nama}: satu paragraf, butir tersambung, berakhir satu titik koma`, () => {
      const h = susunSaksi(posita);
      expect(h.ok).toBe(true);
      for (const saksi of [h.saksi1, h.saksi2]) {
        for (const b of saksi) {
          expect(b.jawab, `no ${b.no}`).not.toMatch(/[\r\n]/);
          expect(b.jawab).not.toMatch(/\s{2,}/);
          expect(b.jawab).toMatch(/[^;];$/);
          expect(b.jawab).not.toMatch(/\s[,;]/);
          expect(b.jawab).not.toMatch(/\.{3,}/); // sebab terisi dari gugatan
        }
      }
      const sebab = h.saksi1[0].jawab;
      // Butir panjang disambung dengan penyambung wajar, dan tidak ada butir yang hilang di tengah/ujung.
      if (posita !== POSITA_PATAH_HTML) expect(sebab).toMatch(/selain itu/);
      expect(sebab).toMatch(/Tergugat sering mengungkit pemberian orang tua Penggugat;$/);
      expect(sebab).not.toMatch(/Tergugat;$/);
      expect(sebab).not.toMatch(/Penggugat sering/);
      if (posita !== POSITA_PATAH_HTML) expect(sebab).toMatch(/kebutuhan rumah tangga hanya dibantu oleh Penggugat/);
    });
  }

  it("rapikanKalimatSaksi: baris baru dilebur, spasi sebelum koma dibuang, koma dilengkapi, tanda ganda dirapatkan, titik-titik isian utuh; idempoten", () => {
    const r = svc().rapikanKalimatSaksi.bind(svc());
    const mentah = "Tergugat kurang memberikan nafkah sehingga untuk memenuhi kebutuhan rumah\ntangga hanya dibantu oleh Penggugat,Tergugat\nsering mengungkit ;;";
    expect(r(mentah)).toBe("Tergugat kurang memberikan nafkah sehingga untuk memenuhi kebutuhan rumah tangga hanya dibantu oleh Penggugat, Tergugat sering mengungkit;");
    expect(r(r(mentah))).toBe(r(mentah));
    expect(r("sejak ........ sampai sekarang")).toBe("sejak ........ sampai sekarang");
    expect(r("1,5 juta rupiah")).toBe("1,5 juta rupiah");
  });

  it("gabungPenyebab: butir pendek tetap 'A, B dan C'; klausa panjang 'A, selain itu B, dan C'; dua klausa tanpa koma 'A dan B'", () => {
    const g = svc().gabungPenyebab;
    expect(g(["berjudi", "mabuk", "berzina"])).toBe("berjudi, mabuk dan berzina");
    expect(
      g(["Tergugat memiliki hubungan dengan wanita lain", "Tergugat kurang memberikan nafkah sehingga untuk memenuhi kebutuhan rumah tangga", "Tergugat sering mengungkit pemberian orang tua Penggugat"])
    ).toBe(
      "Tergugat memiliki hubungan dengan wanita lain, selain itu Tergugat kurang memberikan nafkah sehingga untuk memenuhi kebutuhan rumah tangga, dan Tergugat sering mengungkit pemberian orang tua Penggugat"
    );
    expect(g(["Tergugat tidak memberikan nafkah yang cukup kepada Penggugat", "Tergugat sering berkata kasar kepada Penggugat"])).toBe(
      "Tergugat tidak memberikan nafkah yang cukup kepada Penggugat dan Tergugat sering berkata kasar kepada Penggugat"
    );
    // satu butir berisi klausa bersubjek dipisah lalu dirangkai
    const sebab = svc().penyebabPosita([
      "sejak 2020 rumah tangga sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat suka berjudi, Tergugat sering pulang malam dan Tergugat tidak memberi nafkah lahir",
    ]);
    expect(sebab.nilai).toBe("Tergugat suka berjudi, selain itu Tergugat sering pulang malam dan Tergugat tidak memberi nafkah lahir");
  });

  it("kalimatPositaSambung: baris terpotong di tengah kalimat dirangkai; penanda daftar dan 'Bahwa' tetap awal butir baru", () => {
    const butir = svc().kalimatPositaSambung(POSITA_PATAH_DAFTAR) as string[];
    expect(butir.some((b) => b.includes("kebutuhan rumah tangga hanya dibantu oleh Penggugat, Tergugat sering mengungkit pemberian orang tua Penggugat"))).toBe(true);
    expect(butir.some((b) => /^sejak Juni 2025/.test(b))).toBe(true);
    const daftar = svc().kalimatPositaSambung("Bahwa sebab-sebabnya yakni:\n1. Tergugat berjudi\n2. Tergugat mabuk\nBahwa sejak Juni 2025 telah pisah rumah;") as string[];
    expect(daftar).toEqual(["sebab-sebabnya yakni:", "Tergugat berjudi", "Tergugat mabuk", "sejak Juni 2025 telah pisah rumah;"]);
  });
});

describe("abt.js: Susun saksi di panel ABT memakai satu paragraf per jawaban (mesin sama)", () => {
  it("satuParagrafSaksi melebur baris baru dan dipakai saat jawaban dimuat dan saat disimpan", () => {
    const abt = baca("abt.js");
    const a = abt.indexOf("function satuParagrafSaksi(");
    const b = abt.indexOf("const DAFTAR_ALASAN_SDG");
    expect(a > 0 && b > a).toBe(true);
    const konteks = vm.createContext({});
    vm.runInContext(`${abt.slice(a, b)}\nglobalThis.f = satuParagrafSaksi;`, konteks);
    const f = (konteks as unknown as { f: (t: string) => string }).f;
    expect(f("rumah\ntangga hanya  dibantu\r\noleh Penggugat ,\nTergugat ;")).toBe("rumah tangga hanya dibantu oleh Penggugat, Tergugat;");
    expect(abt).toMatch(/jawab: satuParagrafSaksi\(b\.jawab\)/);
    expect(abt).toMatch(/jawab: satuParagrafSaksi\(x\.jawab\.value\)/);
  });
});

// ============================================================================
// 2. MODUL: tukar, geser, salin, alasan, deret tombol (murni)
// ============================================================================
describe("modul jawaban saksi (murni): tukar, geser, salin, alasan sesuai posita, deret tombol per peran", () => {
  const m = () => require_("../../ekstensi-sipp/blangko-derry-saksi.js");
  const baris = (...j: string[]) => j.map((x, i) => ({ no: String(i + 1), tanya: `T${i + 1}`, jawab: x }));

  it("rapikanJawaban memperlakukan pasangJawaban: baris baru dari server tidak pernah terpasang", () => {
    expect(m().rapikanJawaban("rumah\ntangga,\nTergugat ;")).toBe("rumah tangga, Tergugat;");
    const hasil = m().pasangJawaban([{ no: "1", tanya: "T", jawab: "" }], [{ jawab: "Penyebabnya rumah\ntangga hanya dibantu;" }], {});
    expect(hasil.rows[0].jawab).toBe("Penyebabnya rumah tangga hanya dibantu;");
  });

  it("geserJawaban menukar JAWABAN dengan tetangga, pertanyaan tetap; di ujung tidak berubah; masukan tidak diubah", () => {
    const awal = baris("a", "b", "c");
    const naik = m().geserJawaban(awal, 1, -1);
    expect(naik.ok).toBe(true);
    expect(naik.rows.map((r: { jawab: string }) => r.jawab)).toEqual(["b", "a", "c"]);
    expect(naik.rows.map((r: { tanya: string }) => r.tanya)).toEqual(["T1", "T2", "T3"]);
    expect(m().geserJawaban(awal, 0, -1).ok).toBe(false);
    expect(m().geserJawaban(awal, 2, 1).ok).toBe(false);
    expect(awal.map((r) => r.jawab)).toEqual(["a", "b", "c"]);
    // penanda dasar/otomatis ikut berpindah bersama jawabannya
    const dgn = [{ no: "1", tanya: "T1", jawab: "x", otomatis: "x" }, { no: "2", tanya: "T2", jawab: "y" }];
    const t = m().geserJawaban(dgn, 0, 1).rows;
    expect(t[1].otomatis).toBe("x");
    expect(t[0].otomatis).toBeUndefined();
  });

  it("tukarJawaban menukar jawaban baris yang sama antar dua saksi; daftar pendek dilengkapi baris kosong", () => {
    const a = baris("a1", "a2");
    const b = baris("b1");
    const { a: A, b: B } = m().tukarJawaban(a, b, 1);
    expect(A.map((r: { jawab: string }) => r.jawab)).toEqual(["a1", ""]);
    expect(B.map((r: { jawab: string }) => r.jawab)).toEqual(["b1", "a2"]);
    expect(B[1].tanya).toBe(""); // pertanyaan tidak ikut pindah
    expect(a.length).toBe(2);
    expect(b.length).toBe(1);
  });

  it("salinJawaban menyalin ke saksi lain dan mengisi pertanyaan tujuan yang kosong", () => {
    const { b } = m().salinJawaban(baris("a1", "a2"), [{ no: "1", tanya: "T1", jawab: "b1" }], 1);
    expect(b.map((r: { jawab: string }) => r.jawab)).toEqual(["b1", "a2"]);
    expect(b[1].tanya).toBe("T2");
  });

  it("bagiAlasan: hanya alasan di posita tampil langsung, yang dicentang tetap tampil, sisanya 'lain'; posita tak terbaca = semua tampil", () => {
    const semua = ["judi", "mabuk", "cemburu", "tidak memberi nafkah"].map((k) => ({ kunci: k, label: k }));
    const hasil = m().bagiAlasan(semua, new Set(["judi", "tidak memberi nafkah"]), ["cemburu"]);
    expect(hasil.dariPosita).toBe(true);
    expect(hasil.utama.map((a: { kunci: string }) => a.kunci)).toEqual(["judi", "cemburu", "tidak memberi nafkah"]);
    expect(hasil.lain.map((a: { kunci: string }) => a.kunci)).toEqual(["mabuk"]);
    for (const sesuai of [null, new Set<string>(), new Set(["tidak ada di daftar"])]) {
      const r = m().bagiAlasan(semua, sesuai, []);
      expect(r.utama.length).toBe(4);
      expect(r.lain).toEqual([]);
      expect(r.dariPosita).toBe(false);
    }
  });

  it("deretTombol per peran: PP pada BAS menyunting; putusan/penetapan dan hakim hanya baca tanpa tombol", () => {
    const pp = m().deretTombol({ jenis: "bas", bolehTulis: true, hakimSaja: false, berpasangan: true });
    expect(pp.hanyaBaca).toBe(false);
    expect(pp.atas).toEqual(["set", "muat"]); // 20 Okt: Tambah baris pindah ke bawah tabel
    expect(pp.urungUlang).toBe(true);
    expect(pp.bawah).toEqual(["tambah", "simpan"]);
    expect(JSON.stringify(pp)).not.toMatch(/selesai|bersih/i);
    expect(pp.lainnya.map((x: { kunci: string }) => x.kunci)).toEqual(["urut", "samakanq", "salinsemua", "rapikan"]);
    for (const x of pp.lainnya) {
      expect(x.label.length).toBeGreaterThan(15);
      expect(x.title.length).toBeGreaterThan(30);
      expect(x.label).not.toMatch(/^Susun urutan$|^Samakan pertanyaan$|^Salin jawaban ke saksi 2/);
    }
    expect(m().deretTombol({ jenis: "bas", bolehTulis: true, berpasangan: false }).lainnya.map((x: { kunci: string }) => x.kunci)).toEqual(["rapikan"]);
    for (const o of [
      { jenis: "put", bolehTulis: true },
      { jenis: "bas", bolehTulis: true, hakimSaja: true },
      { jenis: "bas", bolehTulis: false },
      { jenis: "rel", bolehTulis: true },
      { jenis: "", bolehTulis: false },
    ]) {
      const r = m().deretTombol(o);
      expect(r, JSON.stringify(o)).toEqual({ hanyaBaca: true, atas: [], urungUlang: false, lainnya: [], bawah: [] });
    }
  });
});

// ============================================================================
// 3. TAMPILAN (jsdom)
// ============================================================================
const POSITA_UJI_PATAH =
  "Bahwa Penggugat dan Tergugat menikah pada tanggal 17 Januari 2014 dan pernikahan tersebut dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah;\n" +
  "bahwa setelah menikah Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Donggala selama 10 tahun;\n" +
  "bahwa dari pernikahan tersebut telah dikaruniai 2 orang anak;\n" +
  "bahwa sejak bulan Maret 2025 rumah tangga Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran disebabkan karena:\n" +
  "Tergugat suka bermain game,\n" +
  "Tergugat kurang memberikan perhatian sehingga untuk memenuhi kebutuhan rumah\n" +
  "tangga hanya dibantu oleh Penggugat,\n" +
  "Tergugat\n" +
  "sering mengungkit pemberian orang tua Penggugat;\n" +
  "bahwa sejak bulan Juni 2025 Tergugat pergi meninggalkan rumah dan hingga kini tidak pernah kembali sehingga Penggugat dan Tergugat telah berpisah tempat tinggal;\n" +
  "bahwa pihak keluarga telah berupaya merukunkan Penggugat dan Tergugat namun tidak berhasil;";

const sudahTerisi = (h: Halaman) => /disusun dari data perkara/.test(akar(h).textContent || "");
const tersembunyi = (el: Element) => Boolean(el.closest("[hidden]"));

describe("Blangko Derry (tahap 2): tombol tanya jawab saksi menurut peran", () => {
  it("jawaban dari posita bergaris baru tampil satu paragraf, butir tersambung, tanpa titik-titik; Simpan ke ABT tidak membawa baris baru", async () => {
    POSITA = POSITA_UJI_PATAH;
    try {
      const h = bukaPP();
      pasangPotonganAbt(h);
      await bukaSaksiDanMuat(h);
      for (const sisi of [0, 1]) for (const j of semuaJawab(h, sisi)) expect(j).not.toMatch(/[\r\n]/);
      const sebab = barisKe(h, /penyebab perselisihan/);
      const j = jawab(h, 0, sebab);
      expect(j).toMatch(/selain itu/);
      expect(j).toMatch(/kebutuhan rumah tangga hanya dibantu oleh Penggugat/);
      expect(j).toMatch(/Tergugat sering mengungkit pemberian orang tua Penggugat;$/);
      klik(h, '[data-bd2="simpantj"]');
      await sampai(() => h.tj["5058"].length > 0, "tersimpan");
      for (const r of h.tj["5058"]) expect(r.jawab).not.toMatch(/[\r\n]/);
    } finally {
      POSITA = POSITA_DASAR;
    }
  });

  it("PP pada BAS: 'Selesai' hilang, 'Simpan ke ABT' di bawah tabel, 'Set pertanyaan saksi' tidak di deret isian, 'Bersihkan kalimat penutup' tidak tampil", async () => {
    const h = bukaPP();
    pasangPotonganAbt(h);
    await bukaSaksiDanMuat(h);
    expect(q(h, '[data-bd2="tutuptj"]')).toBeNull();
    expect(q(h, '[data-bd2="bukatj"]')).toBeNull();
    expect(q(h, "#bd-alatisi")!.textContent).not.toMatch(/Set pertanyaan saksi/);
    expect(q(h, '[data-sbaksi="bersih"]')).toBeNull();
    expect(q(h, '[data-sbaksi="bersih1"]')).toBeNull();
    expect(akar(h).textContent).not.toMatch(/Bersihkan kalimat penutup|Susun urutan|Samakan pertanyaan|Selesai/);
    // Tambah baris (kini di bawah tabel), Muat, Urungkan, Ulangi, Lainnya tetap ada.
    for (const s of ['[data-bd2="tambahtj"]', '[data-bd2="muattpl"]', '[data-sbaksi="urung"]', '[data-sbaksi="ulang"]', '[data-bd2="lainnya"]']) expect(q(h, s), s).not.toBeNull();
    // Simpan ke ABT sesudah baris terakhir (berdampingan)...
    const simpan = q(h, '[data-bd2="simpantj"]')!;
    const terakhir = qq(h, "[data-sba]").pop()!;
    expect(terakhir.compareDocumentPosition(simpan) & 4).toBeTruthy();
    expect(q(h, ".bd-sblist")!.contains(simpan)).toBe(false);
    expect(qq(h, '[data-bd2="simpantj"]').length).toBe(1);
    // ...dan satu per satu.
    klik(h, '[data-tjmode="satu"]');
    await sampai(() => q(h, ".bd-tjtabel"), "satu per satu");
    const simpan2 = q(h, '[data-bd2="simpantj"]')!;
    expect(q(h, ".bd-tjtabel")!.compareDocumentPosition(simpan2) & 4).toBeTruthy();
    expect(q(h, '[data-sbaksi="urung"]')).not.toBeNull(); // Urungkan/Ulangi juga di satu per satu
  });

  it("fungsi yang jarang dipakai ada di menu 'Lainnya' berlabel kalimat jelas dengan penjelasan; menu terbuka lewat tombol dan tertutup bila klik di luar", async () => {
    const h = bukaPP();
    await bukaSaksiDanMuat(h);
    const menu = q(h, ".bd-lainnyamenu")!;
    expect(menu.hasAttribute("hidden")).toBe(true);
    klik(h, '[data-bd2="lainnya"]');
    expect(q(h, ".bd-lainnyamenu")!.hasAttribute("hidden")).toBe(false);
    const butir = qq(h, ".bd-lainnyamenu [data-sbaksi]");
    expect(butir.map((b) => b.getAttribute("data-sbaksi"))).toEqual(["urut", "samakanq", "salinsemua", "rapikan"]);
    expect(butir.map((b) => b.textContent)).toEqual([
      "Sejajarkan pertanyaan yang sama",
      "Samakan bunyi pertanyaan dengan saksi pertama",
      "Isi jawaban saksi kedua dari saksi pertama (kata diganti)",
      "Gabungkan baris yang terputus",
    ]);
    for (const b of butir) expect((b.getAttribute("title") || "").length).toBeGreaterThan(30);
    q(h, ".bd-petunjuk")!.click(); // klik di tempat lain pada panel menutup menu
    expect(q(h, ".bd-lainnyamenu")!.hasAttribute("hidden")).toBe(true);
    // Fungsi lama tetap berjalan lewat menu: Isi jawaban saksi kedua (salinsemua) mengisi baris kosong.
    klik(h, '[data-bd2="lainnya"]');
    klik(h, '[data-sbaksi="salinsemua"]');
    expect(q(h, ".bd-lainnyamenu")!.hasAttribute("hidden")).toBe(true);
  });

  it("tukar jawaban antar saksi dan geser jawaban naik/turun (pertanyaan tetap); Urungkan mengembalikan", async () => {
    const h = bukaPP();
    pasangPotonganAbt(h);
    await bukaSaksiDanMuat(h);
    const i = barisKe(h, /penyebab perselisihan/);
    const a = jawab(h, 0, i);
    const b = jawab(h, 1, i);
    expect(a).not.toBe(b);
    const tanyaI = tanya(h, i);
    // Dua saksi saja: tukar langsung dengan saksi lainnya.
    klik(h, `[data-jaksi="pilihtukar|saksi 1 p|${i}"]`);
    await sampai(() => jawab(h, 0, i) === b, "jawaban tertukar");
    expect(jawab(h, 1, i)).toBe(a);
    expect(tanya(h, i)).toBe(tanyaI);
    klik(h, '[data-sbaksi="urung"]');
    expect([jawab(h, 0, i), jawab(h, 1, i)]).toEqual([a, b]);
    klik(h, '[data-sbaksi="ulang"]');
    expect([jawab(h, 0, i), jawab(h, 1, i)]).toEqual([b, a]);
    klik(h, '[data-sbaksi="urung"]');
    // Naik: jawaban baris i pindah ke baris i-1 pada saksi 1 saja; saksi 2 dan semua pertanyaan tetap.
    const atas = jawab(h, 0, i - 1);
    const semuaTanya = qq(h, "[data-sbq]").map((el) => (el as HTMLTextAreaElement).value);
    const sisi2 = semuaJawab(h, 1);
    klik(h, `[data-jaksi="naik|saksi 1 p|${i}"]`);
    expect(jawab(h, 0, i - 1)).toBe(a);
    expect(jawab(h, 0, i)).toBe(atas);
    expect(semuaJawab(h, 1)).toEqual(sisi2);
    expect(qq(h, "[data-sbq]").map((el) => (el as HTMLTextAreaElement).value)).toEqual(semuaTanya);
    // Turun mengembalikan; tombol di ujung mati.
    klik(h, `[data-jaksi="turun|saksi 1 p|${i - 1}"]`);
    expect(jawab(h, 0, i)).toBe(a);
    expect((q(h, '[data-jaksi="naik|saksi 1 p|0"]') as HTMLButtonElement).disabled).toBe(true);
    const n = qq(h, "[data-sbq]").length;
    expect((q(h, `[data-jaksi="turun|saksi 2 p|${n - 1}"]`) as HTMLButtonElement).disabled).toBe(true);
    // Salin lama (→) dan ganti kalimat (⟳) tetap ada di tiap jawaban.
    expect(q(h, `[data-sbsalin="${i}.0"]`)).not.toBeNull();
    expect(q(h, `[data-sbganti="${i}.1"]`)).not.toBeNull();
  });

  it("saksi lebih dari dua: tukar meminta memilih saksi tujuan; tanpa memilih tidak ada yang berubah", async () => {
    PENANDA_BAS = [...PENANDA_BAS_DASAR, "5060"];
    try {
      const h = bukaPP();
      await bukaSaksiDanMuat(h);
      expect(qq(h, "[data-tj]").map((b) => b.getAttribute("data-tj"))).toEqual(["saksi 1 p", "saksi 2 p", "saksi 3 p"]);
      const i = barisKe(h, /penyebab perselisihan/);
      const a = jawab(h, 0, i);
      const b = jawab(h, 1, i);
      klik(h, `[data-jaksi="pilihtukar|saksi 1 p|${i}"]`);
      const pilih3 = await sampai(() => q(h, ".bd-tujuan"), "pilihan tujuan");
      expect(pilih3.textContent).toMatch(/Tukar dengan/);
      expect(Array.from(pilih3.querySelectorAll("[data-jaksi]")).map((x) => x.getAttribute("data-jaksi"))).toEqual([
        `tukar|saksi 1 p|${i}|saksi 2 p`,
        `tukar|saksi 1 p|${i}|saksi 3 p`,
        `batal|saksi 1 p|${i}`,
      ]);
      expect([jawab(h, 0, i), jawab(h, 1, i)]).toEqual([a, b]);
      klik(h, `[data-jaksi="batal|saksi 1 p|${i}"]`);
      expect(q(h, ".bd-tujuan")).toBeNull();
      // Pilih saksi 3 (belum dimuat): jawaban pindah ke sana dan tampil di tampilan satu saksi.
      klik(h, `[data-jaksi="pilihtukar|saksi 1 p|${i}"]`);
      await sampai(() => q(h, ".bd-tujuan"), "pilihan tujuan lagi");
      klik(h, `[data-jaksi="tukar|saksi 1 p|${i}|saksi 3 p"]`);
      await sampai(() => jawab(h, 0, i) === "", "jawaban saksi 1 kosong");
      expect(jawab(h, 1, i)).toBe(b);
      klik(h, '[data-tj="saksi 3 p"]');
      const ta = (await sampai(() => q(h, `[data-tjb="${i}"][data-sisi="jawab"]`), "saksi 3 tampil")) as HTMLTextAreaElement;
      expect(ta.value).toBe(a);
      // Satu per satu: salin ke saksi lain juga memilih tujuan.
      expect(q(h, `[data-jaksi="pilihsalin|saksi 3 p|${i}"]`)).not.toBeNull();
    } finally {
      PENANDA_BAS = PENANDA_BAS_DASAR;
    }
  });

  it("'Gabungkan baris yang terputus' melebur baris baru yang diketik, dapat diurungkan; Simpan ke ABT juga membuang baris baru", async () => {
    const h = bukaPP();
    await bukaSaksiDanMuat(h);
    const el = q(h, '[data-sba="0"][data-sk="0"]') as HTMLTextAreaElement;
    el.value = "Hanya dibantu oleh Penggugat,\nTergugat\nsering mengungkit;";
    el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    klik(h, '[data-bd2="lainnya"]');
    klik(h, '[data-sbaksi="rapikan"]');
    expect(jawab(h, 0, 0)).toBe("Hanya dibantu oleh Penggugat, Tergugat sering mengungkit;");
    klik(h, '[data-sbaksi="urung"]');
    expect(jawab(h, 0, 0)).toBe("Hanya dibantu oleh Penggugat,\nTergugat\nsering mengungkit;");
    // Disimpan tanpa digabung dulu: tetap satu paragraf.
    klik(h, '[data-bd2="simpantj"]');
    await sampai(() => h.tj["5058"].length > 0, "tersimpan");
    expect(h.tj["5058"][0].jawab).toBe("Hanya dibantu oleh Penggugat, Tergugat sering mengungkit;");
    expect(JSON.stringify(h.tj["5058"])).not.toMatch(/aleta/i);
  });

  it("alasan 'sebagian': hanya alasan yang ada di posita perkara tampil; sisanya di 'Alasan lain' yang dapat dibuka; pilihan tidak hilang", async () => {
    const h = bukaPP();
    pasangPotonganAbt(h);
    await pilihBas(h);
    klik(h, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h, '[data-skkunci="saksi 2 p"][data-skfld="modus"]'), "panel saksi");
    await sampai(() => usulanAlasan.length >= 1, "alasan dari posita diminta");
    pilih(h, "saksi 2 p", "modus", "sebagian");
    await sampai(() => qq(h, '[data-skkunci="saksi 2 p"][data-skfld="alasan"]').length === 16, "centang alasan tampil");
    await sampai(() => q(h, '[data-skkartu="saksi 2 p"] [data-bd2="alasanlain"]'), "alasan lain tersedia");
    const cb = () => qq(h, '[data-skkunci="saksi 2 p"][data-skfld="alasan"]') as HTMLInputElement[];
    const dariPosita = svc().alasanDariPosita(POSITA_DASAR) as string[];
    expect(dariPosita.length).toBeGreaterThan(0);
    const tampil = cb().filter((c) => !tersembunyi(c)).map((c) => c.value);
    const lipat = cb().filter((c) => tersembunyi(c)).map((c) => c.value);
    expect(tampil.sort()).toEqual(dariPosita.filter((k) => cb().some((c) => c.value === k)).sort());
    expect(lipat.length).toBeGreaterThan(0);
    expect(tampil.length + lipat.length).toBe(16);
    expect(tampil.some((k) => lipat.includes(k))).toBe(false);
    expect(q(h, '[data-skkartu="saksi 2 p"] [data-bd2="alasanlain"]')!.textContent).toMatch(/Alasan lain/);
    // Dibuka: kotak yang terlipat tampil dan dapat dicentang; centang bertahan.
    klik(h, '[data-skkartu="saksi 2 p"] [data-bd2="alasanlain"]');
    expect(cb().every((c) => !tersembunyi(c))).toBe(true);
    const lain = cb().find((c) => lipat.includes(c.value))!;
    lain.checked = true;
    lain.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => cb().find((c) => c.value === lain.value)?.checked, "centang bertahan");
    // Posita tak terbaca (server tidak menjawab): semua alasan tampil seperti dahulu.
    const h2 = bukaPP({ botMati: true });
    await pilihBas(h2);
    klik(h2, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h2, '[data-skkunci="saksi 2 p"][data-skfld="modus"]'), "panel saksi 2");
    pilih(h2, "saksi 2 p", "modus", "sebagian");
    await sampai(() => qq(h2, '[data-skkunci="saksi 2 p"][data-skfld="alasan"]').length === 16, "centang alasan");
    expect(qq(h2, '[data-skkunci="saksi 2 p"][data-skfld="alasan"]').filter((c) => tersembunyi(c)).length).toBe(0);
    expect(q(h2, '[data-bd2="alasanlain"]')).toBeNull();
  });
});

describe("Blangko Derry (tahap 2): putusan dan peran hakim hanya membaca tanya jawab saksi", () => {
  it("hakim pada putusan: satu tombol terlipat 'Lihat keterangan saksi'; terbuka berisi tabel baca saja tanpa satu pun tombol sunting; tidak menulis ke ABT", async () => {
    const h = buka();
    h.tj["5058"] = [{ no: "1", tanya: "Apakah saudara kenal Penggugat?", jawab: "Kenal, saya kakaknya;" }];
    await pilihPutusan(h);
    expect(qq(h, "[data-tj]")).toEqual([]);
    const lipat = q(h, '[data-bd2="lipattj"]')!;
    expect(lipat.textContent).toContain("Lihat keterangan saksi");
    expect(lipat.getAttribute("aria-expanded")).toBe("false");
    expect(q(h, ".bd-tjbaca")).toBeNull();
    klik(h, '[data-bd2="lipattj"]');
    const baca = await sampai(() => q(h, ".bd-tjbaca"), "keterangan terbaca");
    await sampai(() => /Kenal, saya kakaknya;/.test(baca.textContent || "") || /Kenal, saya kakaknya;/.test(q(h, ".bd-tjbaca")?.textContent || ""), "isi tampil");
    expect(qq(h, "[data-tj]").map((b) => b.getAttribute("data-tj"))).toEqual(["saksi 1 p", "saksi 2 p"]);
    expect(q(h, ".bd-tjbaca")!.textContent).toMatch(/Hanya dibaca/);
    // Tanpa sunting: tidak ada kotak isian, tombol, atau pilihan pengetahuan di bagian tanya jawab.
    const wadah = q(h, "#bd-tjwadah")!;
    expect(wadah.querySelector("textarea,input,select")).toBeNull();
    for (const s of [
      '[data-bd2="simpantj"]',
      '[data-bd2="tambahtj"]',
      '[data-bd2="muattpl"]',
      '[data-bd2="lainnya"]',
      '[data-bd2="isioto"]',
      '[data-bd2="tutuptj"]',
      "[data-sbaksi]",
      "[data-jaksi]",
      "[data-sbq]",
      "[data-skkartu]",
      "#bd-muattpl",
    ]) {
      expect(q(h, s), s).toBeNull();
    }
    // Dibuka dibaca saja: tidak ada jawaban otomatis, tidak ada penulisan ke ABT.
    expect(usulanMinta.length).toBe(0);
    expect(mintaKe(h, /tanyajawab_perkara_edit\?aksi=simpan/, "POST")).toEqual([]);
    expect(mintaKe(h, /tanyajawab_perkara_edit/, "POST")).toEqual([]);
    // Dilipat lagi: ringkas.
    klik(h, '[data-bd2="lipattj"]');
    expect(q(h, ".bd-tjbaca")).toBeNull();
    expect(qq(h, "[data-tj]")).toEqual([]);
  });

  it("susunan isian putusan memuat bagian saksi, tetapi tanpa 'Set pertanyaan saksi' di deret tombol isian (juga untuk hakim)", async () => {
    const h = buka();
    await pilihPutusan(h);
    expect(q(h, "#bd-alatisi")!.textContent).not.toMatch(/Set pertanyaan saksi/);
    expect(q(h, '[data-bd2="bukatj"]')).toBeNull();
  });
});

describe("Blangko Derry (tahap 2): Super Admin tetap dapat menyunting tanya jawab pada BAS, tetapi hanya membaca pada putusan", () => {
  it("admin: BAS = tombol sunting lengkap; putusan = hanya baca terlipat", async () => {
    const h = buka({ orang: "admin" });
    await sampaiPerkara(h);
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, '[data-jenismodal="bas"]'), "tab BAS");
    klik(h, '[data-jenismodal="bas"]');
    await sampai(() => q(h, `[data-bl="${BLANGKO_BAS}"]`), "berkas bas");
    klik(h, `[data-bl="${BLANGKO_BAS}"]`);
    await sampai(() => q(h, "[data-tj]"), "tombol saksi");
    klik(h, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h, '[data-bd2="simpantj"]'), "tombol sunting");
    expect(q(h, '[data-bd2="lainnya"]')).not.toBeNull();
    expect(q(h, '[data-bd2="lipattj"]')).toBeNull();
    // putusan: hanya baca
    const h2 = buka({ orang: "admin" });
    await sampaiPerkara(h2);
    klik(h2, '[data-bd2="bukamodal"]');
    await sampai(() => q(h2, `[data-bl="${BLANGKO_PUT}"]`), "berkas putusan");
    klik(h2, `[data-bl="${BLANGKO_PUT}"]`);
    await sampai(() => q(h2, '[data-bd2="lipattj"]'), "lipatan baca");
    expect(q(h2, '[data-bd2="simpantj"]')).toBeNull();
    expect(qq(h2, "[data-tj]")).toEqual([]);
  });
});

// ============================================================================
// Bahan tangkapan layar (replika statis dari DOM sungguhan). Hanya jalan bila TANGKAP_SAKSI = folder tujuan.
// Playwright lokal memotretnya (bukan Chrome pengguna): lihat docs/rancangan/derry-saksi-2-19okt/.
// ============================================================================
describe.skipIf(!process.env.TANGKAP_SAKSI)("bahan tangkapan layar tanya jawab saksi", () => {
  const simpanHtml = (h: Halaman, nama: string) => {
    const tujuan = String(process.env.TANGKAP_SAKSI);
    mkdirSync(tujuan, { recursive: true });
    writeFileSync(path.join(tujuan, `${nama}.html`), akar(h).outerHTML);
  };
  it("memotret keadaan", async () => {
    POSITA = POSITA_UJI_PATAH;
    try {
      const h = bukaPP();
      pasangPotonganAbt(h);
      await bukaSaksiDanMuat(h);
      simpanHtml(h, "pp-bas-berdampingan");
      klik(h, '[data-bd2="lainnya"]');
      simpanHtml(h, "pp-bas-menu-lainnya");
      klik(h, '[data-bd2="lainnya"]');
      pilih(h, "saksi 2 p", "modus", "sebagian");
      await sampai(() => qq(h, '[data-skkunci="saksi 2 p"][data-skfld="alasan"]').length === 16 && q(h, '[data-skkartu="saksi 2 p"] [data-bd2="alasanlain"]'), "alasan");
      await tunggu(300);
      simpanHtml(h, "pp-bas-alasan-sebagian");
      klik(h, '[data-skkartu="saksi 2 p"] [data-bd2="alasanlain"]');
      simpanHtml(h, "pp-bas-alasan-lain-terbuka");
      klik(h, '[data-tjmode="satu"]');
      await sampai(() => q(h, ".bd-tjtabel"), "satu per satu");
      simpanHtml(h, "pp-bas-satu-per-satu");
    } finally {
      POSITA = POSITA_DASAR;
    }
    PENANDA_BAS = [...PENANDA_BAS_DASAR, "5060"];
    try {
      const h = bukaPP();
      await bukaSaksiDanMuat(h);
      const i = barisKe(h, /penyebab perselisihan/);
      klik(h, `[data-jaksi="pilihtukar|saksi 1 p|${i}"]`);
      await sampai(() => q(h, ".bd-tujuan"), "pilihan tujuan");
      simpanHtml(h, "pp-bas-tukar-pilih-saksi");
    } finally {
      PENANDA_BAS = PENANDA_BAS_DASAR;
    }
    const hk = buka();
    hk.tj["5058"] = [
      { no: "1", tanya: "Apakah saudara kenal dengan Penggugat?", jawab: "Kenal, saya kakak kandung Penggugat;" },
      { no: "2", tanya: "Apa yang saudara ketahui tentang rumah tangga mereka?", jawab: "Mereka sering bertengkar karena Tergugat tidak memberi nafkah;" },
    ];
    await pilihPutusan(hk);
    simpanHtml(hk, "hakim-putusan-terlipat");
    klik(hk, '[data-bd2="lipattj"]');
    await sampai(() => /sering bertengkar/.test(q(hk, ".bd-tjbaca")?.textContent || ""), "isi baca");
    simpanHtml(hk, "hakim-putusan-terbuka");
  });
});
