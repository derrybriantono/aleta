// @vitest-environment node
/**
 * ============================================================================
 * 27 OKT 2026 - CETAK CEPAT dan UNDUHAN AMAN di panel Blangko ABT by Derry Briantono
 * ============================================================================
 *
 * ekstensi-sipp/blangko-derry-isian.js dijalankan SUNGGUHAN di jsdom (kerangka sama dengan blangko-derry-pemilih-cetak-19okt).
 *   1  naskah dari ABT disusun SEKALI: Pratinjau lalu Cetak tidak meminta ABT dua kali; isian berubah -> naskah lama dibuang (sidik/versi isian);
 *   2  naskah disiapkan di latar begitu petugas menunjukkan niat mencetak (centang format) atau isian lengkap dan tenang; dibatalkan bila
 *      isian berubah, tidak menulis ke ABT, tidak memunculkan galat, ada saklarnya;
 *   3  PDF, PDF SALINAN, dan PDF anonim disusun BERSAMAAN dari satu naskah; urutan pesan dan nama berkas sama dengan alur berurutan lama;
 *      PDF biasa yang sama dipakai ulang; PDF SALINAN tanpa gambar tanda tangan hakim/PP;
 *   4  semua unduhan lewat pekerja latar (chrome.downloads, data: URL): tidak ada <a download> blob dari halaman http ("Insecure download
 *      blocked") - juga penampil salinan.js;
 *   5  penjaga statis atas berkas panel Blangko Derry.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { PILIHAN_ALASAN, kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { hurufAlasan, tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
// UKUR_CETAK_DIR (hanya untuk mengukur): folder berisi ekstensi LAMA, supaya skenario di bawah dapat dijalankan atas kode sebelum dan sesudah.
const DIR_SUMBER = process.env.UKUR_CETAK_DIR || EKSTENSI;
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-isian.js"].map((b) => readFileSync(path.join(DIR_SUMBER, b), "utf8").replace(/\r\n/g, "\n")).join("\n;\n");

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


// ----------------------------------------------------------------------------
// Bahan khusus berkas ini
// ----------------------------------------------------------------------------
const BAS_DAFTAR: Array<[string, string, string]> = [
  [BLANGKO_BAS, "A11", "B11"],
  ["BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T", "A12", "B12"],
  ["BAS ALUR 03 [2] BAS Lanjutan P Hadir & T Tidak Hadir - Tunda Panggil T Lagi", "A13", "B13"],
  ["BAS ALUR 03 [3] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)", "A14", "B14"],
  ["BAS ALUR 10 [1] BAS Ikrar Talak - P Hadir & T Tidak Hadir", "A15", "B15"],
  ["BAS ALUR 04 [T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja)", "A16", "B16"],
];
/** Header sungguhan blangko Derry (dari paket BAS ALUR): tabel mengambang berisi variabel ABT berhuruf 1 pt; nilai dari ABT sudah terisi. */
const HEADER_PENANDA =
  "{\\header \\trowd \\trql \\trgaph0 \\trrh402 \\trleft-108 \\tpvpg \\tphpg \\tposx1488 \\tposy1083 \\tabsnoovrlp1 \\clvertalt \\clbrdrl \\brdrnone \\clbrdrr \\brdrnone \\cltxlrtb \\clwWidth3580 \\cellx3472 " +
  "\\pard \\plain \\ql \\li0 \\ri0 \\intbl \\itap1 \\fs22 \\rtlch \\ltrch \\dbch \\af5 \\hich \\af5 \\loch \\af5 \\trowd \\trql \\trgaph0 \\trleft0 " +
  "{\\b1 \\fs2 \\rtlch \\ltrch \\dbch \\af5 \\hich \\af4 \\loch \\f4 \\lang2052 \\langnp2052 \\cf16 \\super1 15 Oktober 2026 Kantor Hukum Uji Contoh}" +
  "{\\b1 \\fs2 \\rtlch \\ltrch \\dbch \\af5 \\hich \\af4 \\loch \\f4 \\lang2052 \\langnp2052 \\cf16 \\super1 \\cell }" +
  "\\pard \\plain \\li0 \\ri0 \\intbl \\itap1 \\fs22 {\\trowd \\trql \\trgaph0 \\trrh402 \\trleft-108 \\clwWidth3580 \\cellx3472 \\row }" +
  "\\pard \\plain \\s23 \\li0 \\ri0 \\itap0 \\fs22 {\\fs22 \\rtlch \\ltrch \\dbch \\af5 \\hich \\af5 \\loch \\f5 \\par }}";
const HEADER_KOP = "{\\header \\pard\\plain\\qc\\fs24 PENGADILAN AGAMA DONGGALA - SALINAN KOP\\par}";
const FOOTER_NOMOR =
  "{\\footer \\pard\\plain\\qr\\fs20 Putusan Nomor 581/Pdt.G/2026/PA.Dgl Halaman {\\field{\\*\\fldinst{ PAGE \\\\* Arabic }}{\\fldrslt{1}}}\\par}";
const RTF_DENGAN_HEADER = (isi0007: string) => RTF_PUT(isi0007).replace("\\pard\\qc\\b PUTUSAN", `${HEADER_PENANDA}${FOOTER_NOMOR}\\pard\\qc\\b PUTUSAN`);
const biner = (s: string) => Uint8Array.from(Buffer.from(s, "latin1")).buffer;

type Minta = { url: string; cara: string; badan: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; tj: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; pdfRtf: string[]; pdfBadan: Array<{ salinan?: boolean; ttd?: Array<{ nama: string; pngBase64: string }> }>; klikJangkar: { n: number }; opsi: { hakTolak?: boolean } };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { tundaAnon?: number; viewerGagal?: boolean; unduhGagal?: boolean; tundaPdf?: number; tundaPreview?: number; portalLama?: boolean; orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array; ttd?: { status?: number; baris?: unknown[]; akunId?: string; gambarTolak?: boolean } } = {}): Halaman {
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
        if (!cb) return;
        if (p.viewerGagal && pesan.jenis === "tampilkan-pdf") return cb({ ok: false, pesan: "penampil tidak terbuka" });
        if (p.unduhGagal && pesan.jenis === "unduh") return cb({ ok: false, pesan: "diblokir peramban" });
        cb({ ok: true, id: 1 });
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
  const abt: Record<string, string> = { "8503": "F", ...(p.abtAwal ?? {}) }; // isian tersimpan di ABT (data_teks/tanggal)
  const tj: Halaman["tj"] = { "5058": [{ no: "1", tanya: "Apakah saudara kenal Penggugat?", jawab: "Kenal, saya kakaknya;" }, { no: "2", tanya: "Apa yang saudara tahu?", jawab: "Mereka sering bertengkar;\nBahwa cukup sekian;" }], "5059": [] };
  const pdfRtf: string[] = [];
  const pdfBadan: Halaman["pdfBadan"] = [];
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
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, id: p.ttd?.akunId ?? "u-1", kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const admin = p.orang === "admin";
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos(DAFTAR) } });
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
    if (url.includes("/aleta-bot/abt/pdf")) {
      if (p.tundaPdf) await tunggu(p.tundaPdf);
      const b = JSON.parse(badan || "{}");
      pdfRtf.push(Buffer.from(String(b.rtfBase64 || ""), "base64").toString("latin1"));
      pdfBadan.push({ salinan: b.salinan, ttd: b.ttd });
      // 27 Okt: portal baru membubuhkan tanda tangan di PDF dan menjawab ttdPdf; portal lama (portalLama) tidak mengenal b.ttd.
      const ttdPdf = !p.portalLama && Array.isArray(b.ttd) && b.ttd.length ? { ttdPdf: { dipasang: b.ttd.map((x: { nama: string }) => x.nama), tidakDitemukan: [] } } : {};
      return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from("%PDF-1.4 uji").toString("base64"), byte: 12, ...ttdPdf, ...(b.salinan ? { salinan: { namaPanitera: "PP Satu", gambarTtdPanitera: false, ttdTerdaftar: false } } : {}) } });
    }
    if (/\/aleta-ecourt\/tanda-tangan\/\d+\/gambar/.test(url)) {
      if (p.ttd?.gambarTolak) return json({ ok: false }, 403);
      return new Response(new Uint8Array(Buffer.from(PNG_1X1, "base64")), { status: 200, headers: { "content-type": "image/png" } });
    }
    if (url.includes("/aleta-ecourt/tanda-tangan")) {
      if (!p.ttd) return json({ ok: false, alasan: "tidak berwenang" }, 403);
      return json({ ok: true, baris: p.ttd.baris ?? [] }, p.ttd.status ?? 200);
    }
    if (url.includes("/aleta-ecourt/putusan/unggah-sipp")) return json({ ok: true, data: { ok: true } });
    // ABT
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK("Putusan Cerai Gugat", [[BLANGKO_PUT, "A01", "B01"], ["[02] [Kabul] CG - F", "A02", "B02"]]));
    if (url.startsWith(`${BERANDA}?a=D2`)) return html(HAL_KELOMPOK("BAS Alur 02", BAS_DAFTAR.map(([n, a, b]) => [n, a, b] as [string, string, string])));
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
      if (p.tundaPreview) await tunggu(p.tundaPreview);
      if (p.rtfBytes) return new Response(new Blob([p.rtfBytes as BlobPart]), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="581/Pdt.G/2026/PA.Dgl - ${BLANGKO_PUT}.rtf"` } });
      return new Response(RTF_DENGAN_HEADER(abt["0007"] || "..."), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="581/Pdt.G/2026/PA.Dgl - ${BLANGKO_PUT}.rtf"` } });
    }
    if (url === `${ABT}/main/anonim` && p.tundaAnon) await tunggu(p.tundaAnon);
    if (url === `${ABT}/main/anonim`) return new Response(RTF_PUT("ANONIM"), { status: 200, headers: { "content-disposition": 'attachment; filename="anonim_581.rtf"' } });
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  const klikJangkar = { n: 0 };
  w.HTMLAnchorElement.prototype.click = function () {
    klikJangkar.n += 1;
  };
  w.eval(SUMBER);
  return { dom, w, simpanan, minta, latar, abt, tj, pdfRtf, pdfBadan, klikJangkar, opsi: p };
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


// ============================================================================
// Uji
// ============================================================================
const NAMA_DASAR = `581_Pdt.G_2026_PA.Dgl - ${BLANGKO_PUT}`;
const unduhanLatar = (h: Halaman) => h.latar.filter((m) => m.jenis === "unduh").map((m) => String(m.nama));
const tampilLatar = (h: Halaman) => h.latar.filter((m) => m.jenis === "tampilkan-pdf").map((m) => String(m.nama));
async function cetakSekarang(h: Halaman) {
  klik(h, '[data-bd2="cetak"]');
  await sampai(() => q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden, "pengingat");
  klik(h, '[data-bd2="tetapcetak"]');
}
const pratinjauPermintaan = (h: Halaman) => mintaKe(h, /abt\/preview\?/);

describe("1. naskah dari ABT disusun SEKALI dan dipakai ulang (sidik isian)", () => {
  it("sidikTeks: teks sama -> sidik sama; beda satu huruf -> beda", () => {
    const h = buka();
    const { sidikTeks } = isian(h).murni;
    expect(sidikTeks("isian satu")).toBe(sidikTeks("isian satu"));
    expect(sidikTeks("isian satu")).not.toBe(sidikTeks("isian satuu"));
    expect(sidikTeks("isian satu")).not.toBe(sidikTeks("isian Satu"));
  });

  it("Pratinjau lalu Cetak: ABT diminta SEKALI; Cetak memakai naskah pratinjau (log menyebutnya)", async () => {
    const h = buka();
    await pilihPutusan(h);
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => isian(h).keadaan().prat.siap, "naskah pratinjau siap");
    expect(pratinjauPermintaan(h)).toHaveLength(1);
    await cetakSekarang(h);
    await sampai(() => unduhanLatar(h).length === 1, "RTF diunduh", 8000);
    expect(pratinjauPermintaan(h)).toHaveLength(1);
    expect(isian(h).keadaan().log.join("\n")).toContain("naskah sudah siap - dipakai ulang");
    expect(isian(h).keadaan().log.join("\n")).not.toContain("meminta naskah dari ABT");
  });

  it("isian berubah sesudah naskah siap: naskah lama TIDAK dipakai; Cetak meminta ABT lagi dan RTF memuat isian baru", async () => {
    const h = buka();
    await pilihPutusan(h);
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => isian(h).keadaan().prat.siap, "naskah pratinjau siap");
    expect(pratinjauPermintaan(h)).toHaveLength(1);
    const i = (await sampai(() => q(h, "#bd-i0007"), "kotak 0007")) as HTMLInputElement;
    ketik(h, i, "dikaruniai 1 orang anak");
    await sampai(() => h.abt["0007"] === "dikaruniai 1 orang anak", "0007 tersimpan");
    await sampai(() => isian(h).keadaan().prat.kotor === true, "naskah ditandai kotor");
    expect(isian(h).keadaan().prat.siap).toBe(false);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    await cetakSekarang(h);
    await sampai(() => h.pdfRtf.length >= 1, "pdf diminta", 8000);
    expect(pratinjauPermintaan(h).length).toBeGreaterThanOrEqual(2);
    expect(h.pdfRtf[0]).toContain("dikaruniai 1 orang anak");
  });

  it("hasil identik: RTF yang diunduh = naskah ABT yang sama baik lewat pratinjau-lalu-cetak maupun cetak langsung", async () => {
    const lewatPratinjau = buka();
    await pilihPutusan(lewatPratinjau);
    klik(lewatPratinjau, '[data-bd2="bukaprat"]');
    await sampai(() => isian(lewatPratinjau).keadaan().prat.siap, "siap");
    await cetakSekarang(lewatPratinjau);
    await sampai(() => unduhanLatar(lewatPratinjau).length === 1, "unduh", 8000);
    const langsung = buka();
    await pilihPutusan(langsung);
    await cetakSekarang(langsung);
    await sampai(() => unduhanLatar(langsung).length === 1, "unduh", 8000);
    const dataDari = (h: Halaman) => String(h.latar.find((m) => m.jenis === "unduh")!.alamat);
    expect(dataDari(lewatPratinjau)).toBe(dataDari(langsung));
    expect(unduhanLatar(lewatPratinjau)).toEqual(unduhanLatar(langsung));
  });
});

describe("2. naskah disiapkan di latar (prefetch) dan dibatalkan bila isian berubah", () => {
  it("memilih format cetak = niat mencetak: naskah disiapkan sebelum Cetak; Cetak tidak meminta ABT lagi", async () => {
    const h = buka();
    await pilihPutusan(h);
    expect(pratinjauPermintaan(h)).toHaveLength(0);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    await sampai(() => isian(h).keadaan().prat.siap, "naskah siap di latar");
    expect(pratinjauPermintaan(h)).toHaveLength(1);
    expect(q(h, "#bd-siapnaskah")!.textContent).toContain("Naskah sudah siap");
    await cetakSekarang(h);
    await sampai(() => h.pdfRtf.length === 1, "pdf diminta", 8000);
    expect(pratinjauPermintaan(h)).toHaveLength(1);
    // prefetch tidak menulis apa pun ke ABT
    expect(mintaKe(h, /edit_data\?/, "POST")).toEqual([]);
  });

  it("isian berubah selama naskah disusun di latar: hasil lama tidak dianggap siap", async () => {
    const h = buka({ tundaPreview: 250 });
    await pilihPutusan(h);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    await sampai(() => isian(h).keadaan().prat.sedangDisiapkan, "sedang disiapkan");
    const i = (await sampai(() => q(h, "#bd-i0007"), "kotak 0007")) as HTMLInputElement;
    ketik(h, i, "dikaruniai 2 orang anak");
    await sampai(() => !isian(h).keadaan().prat.sedangDisiapkan, "penyusunan selesai", 8000);
    expect(isian(h).keadaan().prat.siap).toBe(false);
    expect(isian(h).keadaan().prat.kotor).toBe(true);
  });

  it("Cetak ditekan selagi naskah disiapkan: menunggu yang sama, ABT tidak diminta dua kali", async () => {
    const h = buka({ tundaPreview: 200 });
    await pilihPutusan(h);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    await sampai(() => isian(h).keadaan().prat.sedangDisiapkan, "sedang disiapkan");
    await cetakSekarang(h);
    await sampai(() => h.pdfRtf.length === 1, "pdf diminta", 8000);
    expect(pratinjauPermintaan(h)).toHaveLength(1);
    expect(isian(h).keadaan().log.join("\n")).toContain("menunggu naskah yang sedang disiapkan di latar");
  });

  it("saklar 'Siapkan naskah cetak di latar' mati: tidak ada penyiapan otomatis (Cetak tetap berjalan seperti dulu)", async () => {
    const h = buka({ simpanan: { blangkoDerrySiapNaskah: false } });
    await pilihPutusan(h);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    await tunggu(500);
    expect(pratinjauPermintaan(h)).toHaveLength(0);
    await cetakSekarang(h);
    await sampai(() => h.pdfRtf.length === 1, "pdf diminta", 8000);
    expect(pratinjauPermintaan(h)).toHaveLength(1);
  });

  it("tidak menyiapkan di latar pada Tes putusan (admin) dan tidak pernah memunculkan galat bila ABT gagal", async () => {
    const h = buka({ orang: "admin" });
    await pilihPutusan(h);
    h.w.fetch = ((asli) => async (alamat: string, opsi?: unknown) => (String(alamat).includes("/abt/preview?") ? new Response("galat", { status: 500 }) : asli(alamat, opsi as never)))(h.w.fetch);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    await sampai(() => mintaKe(h, /abt\/preview\?/).length >= 1, "mencoba", 4000).catch(() => null);
    await tunggu(100);
    expect(isian(h).keadaan().prat.galat).toBe("");
    expect(isian(h).keadaan().prat.siap).toBe(false);
  });
});

describe("3. keluaran disusun BERSAMAAN dari satu naskah; hasil dan urutan pesan sama dengan alur berurutan", () => {
  it("PDF + PDF SALINAN + PDF anonim: waktu total mendekati satu konversi (bukan jumlahnya); nama berkas tiap keluaran terkunci", async () => {
    const TUNDA = 300;
    const h = buka({ tundaPdf: TUNDA });
    await pilihPutusan(h);
    for (const f of ["pdf", "salinan", "anon"]) (q(h, `[data-fmt="${f}"]`) as HTMLInputElement).click();
    await cetakSekarang(h);
    await sampai(() => isian(h).keadaan().ukurCetak && isian(h).keadaan().ukurCetak.total > 0 && /PDF anonim diunduh/.test(akar(h).textContent || ""), "semua selesai", 15000);
    const u = isian(h).keadaan().ukurCetak;
    // Tiga konversi masing-masing ≥ TUNDA ms: berurutan ≥ 900 ms; bersamaan ≈ 300-600 ms.
    expect(h.pdfRtf).toHaveLength(3);
    expect(u.total).toBeLessThan(TUNDA * 2.5);
    expect(u.pdf).toBeGreaterThanOrEqual(TUNDA - 20);
    expect(u.salinan).toBeGreaterThanOrEqual(TUNDA - 20);
    // Nama berkas tiap jenis keluaran (tidak boleh berubah).
    expect(unduhanLatar(h).sort()).toEqual([`${NAMA_DASAR} - anonim.pdf`, `${NAMA_DASAR}.pdf`, `${NAMA_DASAR}.rtf`].sort());
    expect(tampilLatar(h)).toEqual([`${NAMA_DASAR} - SALINAN.pdf`]);
    // Urutan hasil di log = urutan lama: RTF, PDF, PDF SALINAN, anonim, PDF anonim.
    const log = isian(h).keadaan().log.join("\n");
    const urut = ["RTF diunduh", "PDF diunduh", "PDF SALINAN dibuka di tab baru", "PDF anonim diunduh"].map((k) => log.lastIndexOf(k));
    expect(urut.every((x) => x >= 0)).toBe(true);
    expect([...urut]).toEqual([...urut].sort((a, b) => a - b));
  });

  it("PDF SALINAN: yang diminta ke portal hanya RTF (tanpa gambar tanda tangan); keterangan 'ttd' bagi majelis dan panitera sidang", async () => {
    const h = buka();
    await pilihPutusan(h);
    (q(h, '[data-fmt="salinan"]') as HTMLInputElement).click();
    await cetakSekarang(h);
    await sampai(() => tampilLatar(h).length === 1, "salinan tampil", 8000);
    expect(h.pdfBadan[0].salinan).toBe(true);
    expect(h.pdfBadan[0].ttd).toBeUndefined();
    expect(h.pdfRtf[0]).not.toContain("\\pict");
    await sampai(() => /majelis dan panitera sidang: ttd/.test(akar(h).textContent || ""), "keterangan ttd");
  });

  it("PDF biasa yang sama dicetak lagi: dipakai ulang dari ingatan halaman (tanpa LibreOffice lagi); PDF SALINAN tetap dibuat ulang", async () => {
    const h = buka();
    await pilihPutusan(h);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    (q(h, '[data-fmt="salinan"]') as HTMLInputElement).click();
    await cetakSekarang(h);
    await sampai(() => h.pdfRtf.length === 2, "dua pdf", 8000);
    await sampai(() => !q(h, '[data-bd2="cetak"]')!.hasAttribute("disabled"), "selesai", 8000);
    await cetakSekarang(h);
    await sampai(() => h.pdfRtf.length === 3, "salinan diminta lagi", 8000);
    await tunggu(100);
    expect(h.pdfBadan.filter((x) => !x.salinan)).toHaveLength(1);
    expect(h.pdfBadan.filter((x) => x.salinan)).toHaveLength(2);
    expect(unduhanLatar(h).filter((n) => n === `${NAMA_DASAR}.pdf`)).toHaveLength(2); // tetap diunduh dua kali
  });

  it("satu keluaran gagal tidak menggagalkan yang lain: pesan tiap keluaran tetap tampil", async () => {
    const h = buka();
    await pilihPutusan(h);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    (q(h, '[data-fmt="salinan"]') as HTMLInputElement).click();
    const asli = h.w.fetch;
    h.w.fetch = async (alamat: string, opsi?: { body?: unknown }) => {
      if (String(alamat).includes("/aleta-bot/abt/pdf") && JSON.parse(String(opsi?.body || "{}")).salinan) return new Response(JSON.stringify({ ok: true, data: { available: false, message: "soffice mati" } }), { status: 200, headers: { "content-type": "application/json" } });
      return asli(alamat, opsi as never);
    };
    await cetakSekarang(h);
    await sampai(() => /PDF SALINAN gagal: soffice mati/.test(akar(h).textContent || "") && /RTF diunduh/.test(akar(h).textContent || ""), "semua pesan", 8000);
    expect(akar(h).textContent).toContain("PDF diunduh");
  });
});

describe("4. unduhan panel Blangko Derry tidak pernah lewat <a download> dari halaman http", () => {
  it("RTF + PDF + salinan + anonim: semuanya lewat pekerja latar (jenis unduh / tampilkan-pdf); tidak ada klik tautan halaman", async () => {
    const h = buka();
    await pilihPutusan(h);
    for (const f of ["pdf", "salinan", "anon"]) (q(h, `[data-fmt="${f}"]`) as HTMLInputElement).click();
    await cetakSekarang(h);
    await sampai(() => /PDF anonim diunduh/.test(akar(h).textContent || ""), "selesai", 15000);
    expect(unduhanLatar(h)).toHaveLength(3);
    expect(h.klikJangkar.n).toBe(0);
    for (const m of h.latar.filter((x) => x.jenis === "unduh")) expect(String(m.alamat)).toMatch(/^data:/);
  });

  it("penampil salinan gagal dibuka: salinan diunduh lewat pekerja latar dengan nama yang sama (bukan tautan halaman)", async () => {
    const h = buka({ viewerGagal: true });
    await pilihPutusan(h);
    (q(h, '[data-fmt="salinan"]') as HTMLInputElement).click();
    await cetakSekarang(h);
    await sampai(() => /PDF SALINAN diunduh/.test(akar(h).textContent || ""), "salinan diunduh", 8000);
    expect(unduhanLatar(h)).toContain(`${NAMA_DASAR} - SALINAN.pdf`);
    expect(h.klikJangkar.n).toBe(0);
  });

  it("pekerja latar menolak unduhan: dilaporkan gagal, TIDAK jatuh ke tautan halaman (yang diblokir Chrome)", async () => {
    const h = buka({ unduhGagal: true });
    await pilihPutusan(h);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    await cetakSekarang(h);
    await sampai(() => /PDF gagal: unduhan lewat ekstensi gagal: diblokir peramban/.test(akar(h).textContent || ""), "pesan gagal", 8000);
    expect(akar(h).textContent).toContain("RTF gagal: unduhan lewat ekstensi gagal: diblokir peramban");
    expect(h.klikJangkar.n).toBe(0);
  });

  it("penampil salinan.js: tombol Unduh mengirim data: ke pekerja latar dengan nama yang sama; tidak ada <a download>", async () => {
    const dom = new JSDOM(`<!doctype html><html><body><span id="judul"></span><span id="pesan"></span><button id="unduh" disabled></button><iframe id="penampil"></iframe></body></html>`, { url: "chrome-extension://aleta-uji/salinan.html#abc", runScripts: "outside-only" } as ConstructorParameters<typeof JSDOM>[1]);
    terbuka.push(dom);
    const w = dom.window as any;
    const pesanKeLatar: Array<Record<string, unknown>> = [];
    const alamat = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 uji salinan").toString("base64")}`;
    let jangkar = 0;
    w.HTMLAnchorElement.prototype.click = () => {
      jangkar += 1;
    };
    w.URL.createObjectURL = () => "blob:chrome-extension://aleta-uji/x";
    w.atob = (s: string) => Buffer.from(s, "base64").toString("latin1");
    w.chrome = {
      storage: { session: { get: async () => ({ "aletaPdf:abc": { nama: `${NAMA_DASAR} - SALINAN.pdf`, alamat, pesan: "", awas: false } }), remove: async () => undefined } },
      runtime: {
        sendMessage: (pesan: Record<string, unknown>, cb: (h: unknown) => void) => {
          pesanKeLatar.push(pesan);
          cb({ ok: true, id: 7 });
        },
        lastError: undefined,
      },
    };
    w.eval(readFileSync(path.join(EKSTENSI, "salinan.js"), "utf8"));
    await sampai(() => !(w.document.getElementById("unduh") as HTMLButtonElement).disabled, "tombol aktif");
    (w.document.getElementById("unduh") as HTMLButtonElement).click();
    await sampai(() => pesanKeLatar.length === 1, "pesan ke latar");
    expect(pesanKeLatar[0]).toMatchObject({ sumber: "aleta-panel", jenis: "unduh", nama: `${NAMA_DASAR} - SALINAN.pdf`, alamat });
    expect(jangkar).toBe(0);
    await sampai(() => /Tersimpan/.test(w.document.getElementById("pesan").textContent || ""), "pesan tersimpan");
  });
});

describe("5. penjaga: tidak ada jalur unduhan dari halaman di panel Blangko Derry", () => {
  const BERKAS = readdirSync(EKSTENSI).filter((b) => /^blangko-derry.*\.js$/.test(b)).concat(["putusan-advance.js", "deteksi-sisa-blangko.js", "salinan.js"]);
  const tanpaKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  it("daftar berkas yang dijaga mencakup semua berkas panel Blangko Derry", () => {
    expect(BERKAS).toEqual(expect.arrayContaining(["blangko-derry-isian.js", "blangko-derry.js", "blangko-derry-massal.js", "blangko-derry-berkas.js", "putusan-advance.js", "deteksi-sisa-blangko.js", "salinan.js"]));
  });
  for (const berkas of BERKAS) {
    it(`${berkas}: tanpa a[download], window.open ke berkas, location.href unduhan, atau createObjectURL untuk unduhan`, () => {
      const kode = tanpaKomentar(baca(berkas));
      expect(kode, "a.download =").not.toMatch(/\.download\s*=[^=]/);
      expect(kode, "setAttribute download").not.toMatch(/setAttribute\(\s*["']download["']/);
      expect(kode, "window.open").not.toMatch(/window\.open\(/);
      expect(kode, "location.href =").not.toMatch(/location\.(?:href|assign|replace)\s*(?:=[^=]|\()/);
      // createObjectURL hanya untuk gambar (gambarKePng di blangko-derry-isian.js), bukan untuk unduhan.
      for (const m of kode.matchAll(/createObjectURL\(([^)]*)\)/g)) expect(`${berkas}:${m[1]}`).toMatch(/blangko-derry-isian\.js:berkas|salinan\.js:blob/);
    });
  }
});

// ============================================================================
// 6. Pengukuran (hanya bila UKUR_CETAK=1): waktu dinding dari menekan "Tetap cetak" sampai semua keluaran selesai, atas latensi tiruan
//    (ABT menyusun naskah 800 ms, tiap konversi PDF 500 ms, anonimisasi 400 ms). Dijalankan atas kode lama dan baru (UKUR_CETAK_DIR).
// ============================================================================
describe.skipIf(!process.env.UKUR_CETAK)("6. pengukuran waktu cetak", () => {
  const SEMUA = ["rtf", "pdf", "salinan", "anon"];
  async function ukur(nama: string, siapkan: (h: Halaman) => Promise<void>) {
    const h = buka({ tundaPreview: 800, tundaPdf: 500, tundaAnon: 400 });
    await pilihPutusan(h);
    for (const f of SEMUA) {
      const c = q(h, `[data-fmt="${f}"]`) as HTMLInputElement;
      if (c.checked !== true) c.click();
    }
    await siapkan(h);
    klik(h, '[data-bd2="cetak"]');
    const mulaiTekan = Date.now();
    await sampai(() => q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden, "pengingat", 15000);
    const menungguNaskah = Date.now() - mulaiTekan;
    const mulai = Date.now();
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => /PDF anonim diunduh/.test(akar(h).textContent || "") && !q(h, '[data-bd2="cetak"]')!.hasAttribute("disabled"), "selesai", 30000);
    const ms = Date.now() - mulai;
    // eslint-disable-next-line no-console
    console.log(`UKUR|${nama}|tekan Cetak -> naskah/pengingat ${menungguNaskah} ms|Tetap cetak -> semua keluaran ${ms} ms|jumlah total ${menungguNaskah + ms} ms|preview=${pratinjauPermintaan(h).length}|pdf=${h.pdfRtf.length}`);
  }
  it("A. cetak langsung tanpa persiapan (ABT menyusun naskah saat Cetak)", async () => ukur("A cetak langsung", async () => undefined), 60000);
  it("B. Pratinjau sudah dibuka sebelum Cetak", async () => ukur("B pratinjau dibuka dulu", async (h) => {
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => isian(h).keadaan().prat.adaRtf, "naskah pratinjau", 15000);
  }), 60000);
  it("C. petugas berhenti 1,5 dtk sesudah memilih format (kode baru menyiapkan naskah di latar)", async () => ukur("C jeda 1,5 dtk sebelum Cetak", async () => {
    await tunggu(1500);
  }), 60000);
});
