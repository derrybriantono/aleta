// @vitest-environment node
/**
 * ============================================================================
 * 28 OKT 2026 - PDF SALINAN dari putusan yang DISUNTING SENDIRI (unggah RTF / DOCX / DOC)
 * ============================================================================
 *
 * Permintaan hakim: putusan kadang diubah manual; PDF salinannya harus tetap cepat dan berformat SAMA dengan PDF SALINAN dari naskah ABT.
 *
 *   1  panel Blangko Derry (jsdom, kode sungguhan): berkas RTF yang diunggah masuk ke jalur cetak yang SAMA dengan naskah ABT -
 *      byte demi byte, tanpa meminta naskah ke ABT, tanpa pengingat isian kosong; PDF SALINAN meminta salinan:true;
 *   2  DOCX/DOC diubah ke RTF sekali (rute konversi-naskah), lalu RTF hasilnya yang masuk jalur cetak; PDF/berkas lain ditolak;
 *   3  Hapus berkas / berganti perkara: Cetak kembali memakai naskah ABT;
 *   4  RTF hasil ubahan LibreOffice (bukan RTF ABT) tetap dikenali bot: SALINAN kiri atas, "ttd" di tiap jabatan, nama Panitera pengesah -
 *      memakai susunSalinan yang sama persis dengan jalur naskah ABT, dan suntingan manual hakim ikut terbawa;
 *   5  penjaga: tanpa kata "Aleta" pada tulisan baru, tanpa jalur tulis SIPP baru.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

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
      return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from("%PDF-1.4 uji").toString("base64"), byte: 12, ...ttdPdf, ...(b.salinan ? { salinan: { namaPanitera: "PP Satu", gambarTtdPanitera: false, ttdTerdaftar: false, ttdDitambah: 4, ttdSudahAda: 0, alasanTanpaGambar: "ttd_tidak_ada" } } : {}) } });
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
const unduhanLatar = (h: Halaman) => h.latar.filter((m) => m.jenis === "unduh");
const tampilLatar = (h: Halaman) => h.latar.filter((m) => m.jenis === "tampilkan-pdf").map((m) => String(m.nama));
const dataLatin1 = (alamat: unknown) => Buffer.from(String(alamat).split(",")[1], "base64").toString("latin1");
const pratinjauPermintaan = (h: Halaman) => mintaKe(h, /abt\/preview\?/);

/** Putusan yang sudah disunting hakim: byte 0x80-0x9F (tanda kutip Word) dan kalimat tambahan sendiri harus sampai utuh. */
const KALIMAT_SUNTINGAN = "Menimbang, bahwa kalimat ini DITAMBAH SENDIRI oleh hakim \\'93dengan tanda kutip Word\\'94;";
const RTF_UNGGAH = RTF_PUT("dikaruniai 2 orang anak").replace("\\pard\\ql Kuasa", `\\pard\\qj ${KALIMAT_SUNTINGAN}\\par\\pard\\ql Kuasa`) + "\n";
const RTF_HASIL_KONVERSI = RTF_PUT("hasil ubahan dari docx").replace("PUTUSAN", "PUTUSAN SUNTINGAN DOCX");
const DOCX_PALSU = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("isi docx palsu untuk uji")]);
const DOC_PALSU = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from("isi doc lama palsu")]);

/** Memilih berkas di kotak "Unggah putusan sendiri" (jsdom tidak punya pemilih berkas: files diganti, lalu change dikirim). */
async function unggah(h: Halaman, nama: string, isi: Uint8Array | Buffer | string) {
  const inp = (await sampai(() => q(h, "#bd-unggahputusan"), "kotak unggah")) as HTMLInputElement;
  const bita = typeof isi === "string" ? Uint8Array.from(Buffer.from(isi, "latin1")) : Uint8Array.from(isi);
  const berkas = new h.w.File([bita], nama);
  if (typeof berkas.arrayBuffer !== "function") {
    berkas.arrayBuffer = () =>
      new Promise((selesai) => {
        const r = new h.w.FileReader();
        r.onload = () => selesai(r.result);
        r.readAsArrayBuffer(berkas);
      });
  }
  Object.defineProperty(inp, "files", { value: [berkas], configurable: true });
  inp.dispatchEvent(new h.w.Event("change", { bubbles: true }));
}
const toastTeks = (h: Halaman) => (D_(h).getElementById("bd-toast")?.textContent || "").trim();

/** Menjawab rute konversi-naskah seperti server (soffice tidak ada di sini): mencatat isian formulirnya. */
function pasangKonversi(h: Halaman, hasilRtf: string, opsi: { gagal?: boolean } = {}) {
  const dikirim: Array<{ ke: string; nama: string; ukuran: number; kepala: string }> = [];
  const asli = h.w.fetch;
  h.w.fetch = async (alamat: string, o?: { body?: unknown }) => {
    if (!String(alamat).includes("/putusan/konversi-naskah")) return asli(alamat, o);
    const f = o?.body as FormData;
    const b = f.get("berkas") as File;
    const buf = Buffer.from(await new Promise<ArrayBuffer>((selesai) => { const r = new h.w.FileReader(); r.onload = () => selesai(r.result as ArrayBuffer); r.readAsArrayBuffer(b); }));
    dikirim.push({ ke: String(f.get("ke")), nama: b.name, ukuran: buf.length, kepala: buf.subarray(0, 4).toString("hex") });
    if (opsi.gagal) return new Response(JSON.stringify({ ok: false, error: { message: "soffice belum terpasang di server" } }), { status: 503, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ ok: true, data: { berkasBase64: Buffer.from(hasilRtf, "latin1").toString("base64"), namaBerkas: "naskah.rtf", mime: "application/rtf", bentukAsal: "docx", peringatan: [] } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return dikirim;
}

describe("1. RTF unggahan masuk ke jalur cetak yang SAMA dengan naskah ABT", () => {
  it("langkah Cetak menyediakan 'Unggah putusan sendiri (RTF/DOCX/DOC)'; belum ada berkas = belum ada sumber unggahan", async () => {
    const h = buka();
    await pilihPutusan(h);
    expect(q(h, "#bd-unggahputusan")).not.toBeNull();
    expect(akar(h).textContent).toContain("Unggah putusan sendiri (RTF/DOCX/DOC)");
    expect(q(h, ".bd-sumberunggah")).toBeNull();
    expect(isian(h).keadaan().unggahan).toBeNull();
    expect((q(h, "#bd-unggahputusan") as HTMLInputElement).accept).toContain(".docx");
  });

  it("PDF SALINAN dari RTF unggahan: byte sama persis dikirim ke pengubah PDF (salinan:true), ABT tidak diminta naskah, tanpa pengingat isian kosong", async () => {
    const h = buka();
    await pilihPutusan(h);
    await unggah(h, "Putusan saya.rtf", RTF_UNGGAH);
    await sampai(() => q(h, ".bd-sumberunggah"), "sumber unggahan tampil");
    expect(q(h, ".bd-sumberunggah")!.textContent).toBe("Sumber cetak: berkas unggahan Putusan saya.rtf");
    expect(isian(h).keadaan().unggahan).toMatchObject({ nama: "Putusan saya.rtf", bentukAsal: "rtf", byte: Buffer.byteLength(RTF_UNGGAH, "latin1") });
    (q(h, '[data-fmt="salinan"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => h.pdfRtf.length === 1 && tampilLatar(h).length === 1, "PDF SALINAN terbit", 8000);
    expect(h.pdfRtf[0]).toBe(RTF_UNGGAH);
    expect(h.pdfRtf[0]).toContain(KALIMAT_SUNTINGAN);
    expect(h.pdfBadan[0].salinan).toBe(true);
    expect(h.pdfBadan[0].ttd).toBeUndefined();
    expect(tampilLatar(h)).toEqual([`${NAMA_DASAR} - SALINAN.pdf`]);
    // naskah ABT sama sekali tidak diminta, tidak ada tulisan ke ABT, pengingat isian kosong tidak muncul
    expect(pratinjauPermintaan(h)).toHaveLength(0);
    expect(mintaKe(h, /edit_data\?/, "POST")).toEqual([]);
    expect(q(h, "#bd-ingat")!.hidden).toBe(true);
    const log = isian(h).keadaan().log.join("\n");
    expect(log).toContain('memakai berkas unggahan "Putusan saya.rtf"');
    expect(log).not.toContain("meminta naskah dari ABT");
    expect(log).toMatch(/PDF SALINAN dibuka di tab baru/);
  });

  it("RTF yang diunduh = berkas unggahan; PDF biasa + PDF SALINAN disusun bersamaan dari berkas yang sama dengan nama baku", async () => {
    const h = buka();
    await pilihPutusan(h);
    await unggah(h, "x.rtf", RTF_UNGGAH);
    await sampai(() => q(h, ".bd-sumberunggah"), "sumber");
    for (const f of ["pdf", "salinan"]) (q(h, `[data-fmt="${f}"]`) as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => h.pdfRtf.length === 2 && tampilLatar(h).length === 1 && unduhanLatar(h).length === 2, "semua terbit", 8000);
    expect(h.pdfRtf).toEqual([RTF_UNGGAH, RTF_UNGGAH]);
    expect(h.pdfBadan.map((b) => Boolean(b.salinan)).sort()).toEqual([false, true]);
    const unduh = unduhanLatar(h);
    expect(unduh.map((m) => String(m.nama)).sort()).toEqual([`${NAMA_DASAR}.pdf`, `${NAMA_DASAR}.rtf`]);
    expect(dataLatin1(unduh.find((m) => String(m.nama).endsWith(".rtf"))!.alamat)).toBe(RTF_UNGGAH);
    expect(pratinjauPermintaan(h)).toHaveLength(0);
  });

  it("'Tambah tanda tangan' tetap berlaku untuk PDF biasa dari berkas unggahan; pada PDF SALINAN tidak dikirim", async () => {
    const h = buka({ orang: "hakim", ttd: { akunId: "u-1", baris: [{ id: 7, namaPejabat: "Hakim Satu", jenisBerkas: "png", sahPada: "2026-10-01", jabatan: "Hakim" }] } });
    await pilihPutusan(h);
    await unggah(h, "x.rtf", RTF_UNGGAH);
    await sampai(() => q(h, ".bd-sumberunggah"), "sumber");
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    (q(h, '[data-fmt="salinan"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => h.pdfRtf.length === 2, "dua PDF diminta", 8000);
    const biasa = h.pdfBadan.find((b) => !b.salinan)!;
    const salinan = h.pdfBadan.find((b) => b.salinan)!;
    expect(salinan.ttd).toBeUndefined();
    if (biasa.ttd) expect(biasa.ttd.every((t) => t.nama && t.pngBase64)).toBe(true);
    expect(h.pdfRtf.every((r) => r === RTF_UNGGAH)).toBe(true);
  });

  it("e-Doc SIPP dari berkas unggahan: yang diunggah ke SIPP adalah berkas hakim (bukan naskah ABT), nama berkas e-Doc baku", async () => {
    const h = buka();
    await pilihPutusan(h);
    await unggah(h, "x.rtf", RTF_UNGGAH);
    await sampai(() => q(h, ".bd-sumberunggah"), "sumber");
    (q(h, '[data-fmt="rtf"]') as HTMLInputElement).click(); // matikan RTF
    (q(h, '[data-fmt="edoc"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => mintaKe(h, /putusan\/unggah-sipp/, "POST").length >= 1, "unggah e-Doc", 10000).catch(async () => {
      // pratinjau anonim ALETA tidak ada di kerangka uji; bila menunggu pilihan, lanjutkan
      const lanjut = q(h, '[data-bd2="anonlanjut"], [data-bd2="anonunggah"]');
      if (lanjut) lanjut.click();
      return sampai(() => mintaKe(h, /putusan\/unggah-sipp/, "POST").length >= 1, "unggah e-Doc (2)", 10000);
    });
    const kirim = JSON.parse(mintaKe(h, /putusan\/unggah-sipp/, "POST")[0].badan) as Record<string, string>;
    expect(kirim.putusan).toBe(`<berkas ${NAMA_DASAR}.rtf ${Buffer.byteLength(RTF_UNGGAH, "latin1")}>`);
    expect(kirim.nomorPerkara).toBe("581/Pdt.G/2026/PA.Dgl");
    expect(pratinjauPermintaan(h)).toHaveLength(0);
    // tidak satu pun tulisan ke SIPP/ABT yang memuat kata Aleta
    for (const m of h.minta.filter((x) => /unggah-sipp|edit_data|main\/anonim/.test(x.url) && x.cara === "POST")) expect(m.badan.replace(/aleta\/api/gi, "")).not.toMatch(/aleta/i);
  });
});

describe("2. DOCX / DOC diubah ke RTF sekali; bentuk lain ditolak", () => {
  it("DOCX: dikirim ke konversi-naskah (ke=rtf) dengan byte aslinya, lalu RTF hasil ubahan yang masuk jalur PDF SALINAN; catatan 'diubah ke RTF' tampil", async () => {
    const h = buka();
    await pilihPutusan(h);
    const dikirim = pasangKonversi(h, RTF_HASIL_KONVERSI);
    await unggah(h, "Putusan docx.docx", DOCX_PALSU);
    await sampai(() => q(h, ".bd-sumberunggah"), "sumber unggahan", 6000);
    expect(dikirim).toEqual([{ ke: "rtf", nama: "Putusan docx.docx", ukuran: DOCX_PALSU.length, kepala: "504b0304" }]);
    expect(isian(h).keadaan().unggahan).toMatchObject({ nama: "Putusan docx.docx", bentukAsal: "docx" });
    expect(q(h, ".bd-unggahcatat")!.textContent).toContain("DOCX diubah ke RTF");
    (q(h, '[data-fmt="salinan"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => h.pdfRtf.length === 1 && tampilLatar(h).length === 1, "PDF SALINAN terbit", 8000);
    expect(h.pdfRtf[0]).toBe(RTF_HASIL_KONVERSI);
    expect(h.pdfBadan[0].salinan).toBe(true);
    expect(pratinjauPermintaan(h)).toHaveLength(0);
    expect(tampilLatar(h)).toEqual([`${NAMA_DASAR} - SALINAN.pdf`]);
  });

  it("DOC lama diperlakukan sama (kepala OLE dikenali dari isi, bukan nama)", async () => {
    const h = buka();
    await pilihPutusan(h);
    const dikirim = pasangKonversi(h, RTF_HASIL_KONVERSI);
    await unggah(h, "nama-sembarang.bin", DOC_PALSU);
    await sampai(() => q(h, ".bd-sumberunggah"), "sumber unggahan", 6000);
    expect(dikirim[0]).toMatchObject({ ke: "rtf", kepala: "d0cf11e0" });
    expect(isian(h).keadaan().unggahan).toMatchObject({ bentukAsal: "doc" });
  });

  it("konversi gagal di server: sebabnya disebut, berkas TIDAK dipakai, Cetak kembali ke naskah ABT", async () => {
    const h = buka();
    await pilihPutusan(h);
    pasangKonversi(h, "", { gagal: true });
    await unggah(h, "a.docx", DOCX_PALSU);
    await sampai(() => /tidak dapat dipakai/.test(toastTeks(h)), "pesan gagal", 6000);
    expect(toastTeks(h)).toContain("soffice belum terpasang di server");
    expect(q(h, ".bd-sumberunggah")).toBeNull();
    expect(isian(h).keadaan().unggahan).toBeNull();
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => pratinjauPermintaan(h).length >= 1, "naskah ABT diminta", 8000);
  });

  it("PDF dan berkas yang bukan putusan ditolak tanpa menghubungi server", async () => {
    const h = buka();
    await pilihPutusan(h);
    const dikirim = pasangKonversi(h, RTF_HASIL_KONVERSI);
    await unggah(h, "salinan.pdf", "%PDF-1.4 isi");
    await sampai(() => /tidak dapat dipakai/.test(toastTeks(h)), "PDF ditolak", 4000);
    expect(toastTeks(h)).toContain("PDF tidak dapat dipakai sebagai sumber");
    await unggah(h, "foto.docx", "GIF89a bukan dokumen");
    await sampai(() => /bukan RTF, DOCX, maupun DOC/.test(toastTeks(h)), "bukan dokumen ditolak", 4000);
    expect(dikirim).toEqual([]);
    expect(isian(h).keadaan().unggahan).toBeNull();
    expect(q(h, ".bd-sumberunggah")).toBeNull();
  });

  it("berkas lebih dari 20 MB ditolak sebelum dibaca", async () => {
    const h = buka();
    await pilihPutusan(h);
    const inp = (await sampai(() => q(h, "#bd-unggahputusan"), "kotak")) as HTMLInputElement;
    const besar = { name: "besar.rtf", size: 21 * 1024 * 1024, arrayBuffer: () => Promise.reject(new Error("tidak boleh dibaca")) };
    Object.defineProperty(inp, "files", { value: [besar], configurable: true });
    inp.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => /lebih dari 20 MB/.test(toastTeks(h)), "pesan ukuran", 4000);
    expect(isian(h).keadaan().unggahan).toBeNull();
  });
});

describe("3. Hapus berkas / ganti berkas", () => {
  it("Hapus berkas: Cetak memakai naskah ABT lagi; Ganti berkas: berkas terbaru yang dipakai", async () => {
    const h = buka();
    await pilihPutusan(h);
    await unggah(h, "pertama.rtf", RTF_UNGGAH);
    await sampai(() => q(h, ".bd-sumberunggah"), "sumber");
    await unggah(h, "kedua.rtf", RTF_PUT("berkas kedua"));
    await sampai(() => q(h, ".bd-sumberunggah")?.textContent?.includes("kedua.rtf"), "berkas diganti");
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => h.pdfRtf.length === 1, "pdf dari berkas kedua", 8000);
    expect(h.pdfRtf[0]).toBe(RTF_PUT("berkas kedua"));
    expect(pratinjauPermintaan(h)).toHaveLength(0);

    await sampai(() => !q(h, '[data-bd2="cetak"]')!.hasAttribute("disabled"), "cetak selesai", 6000);
    klik(h, '[data-bd2="hapusunggah"]');
    await sampai(() => !q(h, ".bd-sumberunggah"), "sumber hilang");
    expect(isian(h).keadaan().unggahan).toBeNull();
    expect(q(h, "#bd-unggahputusan")).not.toBeNull();
    // Cetak sekarang meminta naskah ke ABT (jalur lama utuh)
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden, "pengingat isian kosong (jalur ABT)", 8000);
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.pdfRtf.length === 2, "pdf dari naskah ABT", 8000);
    expect(pratinjauPermintaan(h).length).toBeGreaterThanOrEqual(1);
    expect(h.pdfRtf[1]).not.toBe(RTF_PUT("berkas kedua"));
  });

  it("berkas unggahan dicatat atas nomor perkara yang dibuka (dasar pelepasan otomatis bila perkara berganti)", async () => {
    const h = buka();
    await pilihPutusan(h);
    await unggah(h, "x.rtf", RTF_UNGGAH);
    await sampai(() => q(h, ".bd-sumberunggah"), "sumber");
    // seolah perkara berganti: nomor yang dicatat berbeda dari perkara yang dibuka
    expect(isian(h).keadaan().unggahan!.untuk).toBe("581/Pdt.G/2026/PA.Dgl");
    expect(isian(h).keadaan().pk!.nomorPerkara).toBe("581/Pdt.G/2026/PA.Dgl");
  });

  it("Tes putusan (Super Admin): berkas unggahan tidak diterima - perkara hanya acuan, tidak ada yang dicetak dari luar ABT acuan", async () => {
    const h = buka({ orang: "admin" });
    await pilihPutusan(h);
    const inp = (await sampai(() => q(h, "#bd-unggahputusan"), "kotak")) as HTMLInputElement;
    h.w.aletaBlangkoDerry.tesPutusan = () => true;
    await unggah(h, "x.rtf", RTF_UNGGAH);
    await sampai(() => /Mode Tes putusan/.test(toastTeks(h)), "pesan tes", 4000);
    expect(isian(h).keadaan().unggahan).toBeNull();
    expect(inp).toBeTruthy();
  });
});

// ============================================================================
// 4. Bot: RTF hasil ubahan LibreOffice tetap menjadi PDF SALINAN berformat sama
// ============================================================================
const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const salinan = muat("./services/salinanPutusanService.js") as {
  teksTampak: (r: string) => string;
  potongParagraf: (r: string) => Array<{ teks: string; awal: number; akhir: number }>;
  susunSalinan: (r: string, o: { ttd?: { jenis: string; isi: Buffer } | null; ttdDiPdf?: boolean }) => { rtf: string; laporan: Record<string, unknown> };
};

/** Paragraf gaya LibreOffice (writer -> RTF): \pard\plain \ltrpar ... , teks di kelompok ber-\loch, tanpa bingkai dan tanpa teks putih. */
const LO = (isi: string, ratakan = "ql") => `\\pard\\plain \\ltrpar\\${ratakan} \\li0\\ri0\\sl276\\slmult1\\sb0\\sa0\\ltrch\\fcs0 \\fs24\\lang1033\\loch\\af0\\hich\\af0\\dbch\\af1\\cf0 ${isi ? `{\\rtlch\\fcs1 \\af0 \\ltrch\\fcs0 \\loch\\f0 ${isi}}` : ""}\\par\n`;
const LO_TAB = (a: string, b: string) => `\\pard\\plain \\ltrpar\\ql \\li0\\ri0\\sb0\\sa0 {\\loch\\f0 ${a}}{\\tab}{\\loch\\f0 ${b}}\\par\n`;
function rtfBentukLibreOffice(sunting = false): string {
  const badan: string[] = [LO("SALINAN", "qr"), LO("PUTUSAN", "qc"), LO("Nomor 581/Pdt.G/2026/PA.Dgl", "qc")];
  for (let i = 1; i <= 60; i += 1) badan.push(LO(`Menimbang, bahwa pertimbangan nomor ${i} \\u8220 dengan huruf khusus\\u8221 \\'e9 sudah panjang isinya agar blok tanda tangan jatuh di separuh akhir berkas;`, "qj"));
  if (sunting) badan.push(LO(KALIMAT_SUNTINGAN.replace(/\\'93|\\'94/g, '"'), "qj"));
  badan.push(LO("Ketua Majelis,"), LO(""), LO("Hakim Satu, S.H."), LO_TAB("Hakim Anggota,", "Hakim Anggota,"), LO(""), LO_TAB("Hakim Dua, M.H.", "Hakim Tiga, M.H."), LO("Panitera Pengganti,"), LO(""), LO("PP Satu, S.H."));
  badan.push(LO("Untuk Salinan"), LO("Pengadilan Agama Donggala"), LO("Panitera,"), LO(""), LO(""), LO("Nama Panitera Tiruan, S.H."));
  return `{\\rtf1\\ansi\\deff0\\adeflang1025{\\fonttbl{\\f0\\froman\\fprq2\\fcharset0 Times New Roman;}}{\\colortbl;\\red0\\green0\\blue0;\\red255\\green255\\blue255;}\\viewkind1\\paperw11906\\paperh16838\n${badan.join("")}}`;
}
// teksTampak tidak memberi pemisah antar paragraf: hitung per paragraf
const hitung = (rtf: string, kata: RegExp) => salinan.potongParagraf(rtf).reduce((n, p) => n + (p.teks.match(kata) || []).length, 0);

describe("4. RTF hasil ubahan DOCX (bentuk LibreOffice) -> PDF SALINAN berformat sama", () => {
  it("SALINAN rata kiri di atas, 'ttd' di tiap jabatan (4 tempat), blok Untuk Salinan dikenali beserta nama Panitera", () => {
    const hasil = salinan.susunSalinan(rtfBentukLibreOffice(), { ttd: null, ttdDiPdf: true });
    expect(hasil.laporan).toMatchObject({ salinan: "paragraf", untukSalinan: true, ttdDitambah: 4, ttdSudahAda: 0, namaPanitera: "Nama Panitera Tiruan, S.H.", ttdDiPdf: true });
    // "ttd" tertulis di tempat tanda tangan: Ketua, dua kolom Anggota, Panitera Pengganti = 4 kemunculan
    expect(hitung(hasil.rtf, /\bttd\b/g)).toBe(4);
    // SALINAN ada di paragraf pertama dan dirata kiri
    const p = salinan.potongParagraf(hasil.rtf);
    const pSalinan = p.find((x) => x.teks.trim() === "SALINAN")!;
    expect(hasil.rtf.slice(pSalinan.awal, pSalinan.akhir)).toContain("\\ql");
    expect(hasil.rtf.slice(pSalinan.awal, pSalinan.akhir)).not.toMatch(/\\q[rcj](?![a-z])/);
  });

  it("susunSalinan dua kali tidak menggandakan 'ttd' (berkas yang sudah berisi ttd dibiarkan)", () => {
    const sekali = salinan.susunSalinan(rtfBentukLibreOffice(), { ttd: null, ttdDiPdf: true });
    const dua = salinan.susunSalinan(sekali.rtf, { ttd: null, ttdDiPdf: true });
    expect(dua.laporan).toMatchObject({ ttdDitambah: 0, ttdSudahAda: 4 });
    expect(hitung(dua.rtf, /\bttd\b/g)).toBe(4);
  });

  it("suntingan manual hakim terbawa utuh ke naskah salinan (bukan dibuat ulang dari ABT)", () => {
    const hasil = salinan.susunSalinan(rtfBentukLibreOffice(true), { ttd: null, ttdDiPdf: true });
    expect(salinan.teksTampak(hasil.rtf)).toContain('kalimat ini DITAMBAH SENDIRI oleh hakim "dengan tanda kutip Word";');
  });

  it("tanpa tulisan SALINAN di berkas hakim: disisipkan sebelum PUTUSAN (format salinan tetap dipenuhi)", () => {
    const tanpa = rtfBentukLibreOffice().replace(LO("SALINAN", "qr"), "");
    const hasil = salinan.susunSalinan(tanpa, { ttd: null, ttdDiPdf: true });
    expect(hasil.laporan.salinan).toBe("disisipkan");
    const p = salinan.potongParagraf(hasil.rtf).map((x) => x.teks.trim()).filter(Boolean);
    expect(p[0]).toBe("SALINAN");
    expect(p[1]).toBe("PUTUSAN");
  });

  it("bentuk ABT (bingkai putih) dan bentuk LibreOffice menghasilkan laporan salinan yang sama dalam hal ttd dan nama Panitera", () => {
    const abt = salinan.susunSalinan(readAbtTiruan(), { ttd: null, ttdDiPdf: true });
    const lo = salinan.susunSalinan(rtfBentukLibreOffice(), { ttd: null, ttdDiPdf: true });
    for (const kunci of ["untukSalinan", "ttdDiPdf"]) expect(lo.laporan[kunci]).toBe(abt.laporan[kunci]);
    expect(Boolean(lo.laporan.namaPanitera)).toBe(Boolean(abt.laporan.namaPanitera));
    expect(Number(lo.laporan.ttdDitambah) + Number(lo.laporan.ttdSudahAda)).toBeGreaterThan(0);
  });
});

/** RTF tiruan berbentuk ABT (bingkai SALINAN dan Untuk Salinan berwarna putih) - struktur sama dengan pdf-salinan-putusan-14okt. */
function readAbtTiruan(): string {
  const P = "\\pard \\plain \\qj \\sl360 \\slmult1 \\tqc \\tx1400 \\tqc \\tx4200 \\tqc \\tx7000 \\itap0 \\fs20 ";
  const par = (isi: string) => `${P}{\\fs24 \\f4 ${isi}}{\\fs24 \\f4 \\par }`;
  const FB = "\\pard \\plain \\qc \\sa80 \\phpg \\pvpara \\posx7899 \\posy35 \\intbl \\itap1 \\fs20 ";
  const bingkaiSalinan =
    "\\trowd \\trql \\trgaph0 \\trleft0 \\cellx3472 \\pard \\plain \\qc \\phmrg \\pvpara \\posx1488 \\posy1083 \\intbl \\itap1 \\fs20 " +
    "{\\b1 \\fs24 \\f4 \\cf2 SALINAN}{\\b1 \\fs24 \\f4 \\cell }\\pard \\plain \\qr \\intbl \\itap1 \\fs20 " +
    "{\\trowd \\trql \\trgaph0 \\trrh402 \\trleft-108 \\tpvpg \\tphpg \\tposx1488 \\tposy1083 \\tabsnoovrlp1 \\clwWidth3580 \\cellx3472 \\row }";
  const bingkaiUntuk =
    "\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 " +
    `${FB}{\\fs24 \\f4 \\cf2 Untuk Salinan}{\\fs24 \\f4 \\cf2 \\par }` +
    `${FB}{\\fs24 \\f4 \\cf2 Pengadilan Agama Donggala }{\\fs24 \\f4 \\cf2 \\par }` +
    `${FB}{\\fs24 \\f4 \\cf2 Panitera,}{\\fs28 \\f5 \\cf2 \\par }` +
    `${FB}{\\fs32 \\f5 \\cf2 \\par }` +
    `${FB}{\\b1 \\fs24 \\f4 \\cf2 Nama Panitera Tiruan, S.H.}{\\b1 \\fs24 \\f5 \\cf2 \\cell }` +
    "\\pard \\plain \\qr \\intbl \\itap1 \\fs20 {\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 \\row }";
  const isi = [bingkaiSalinan, par("PUTUSAN"), ...Array.from({ length: 60 }, (_, i) => par(`Menimbang paragraf ${i + 1} yang cukup panjang isinya.`)), par("Ketua Majelis,"), par(""), par("Hakim Satu, S.H."), par("Hakim Anggota,"), par(""), par("Hakim Dua, M.H."), par("Panitera Pengganti,"), par(""), par("PP Satu, S.H."), bingkaiUntuk];
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}{\\colortbl;\\red0\\green0\\blue0;\\red255\\green255\\blue255;}${isi.join("\n")}}`;
}

// ============================================================================
// 5. Penjaga
// ============================================================================
describe("5. penjaga", () => {
  it("tulisan dan kode baru tidak menyebut Aleta ke SIPP/ABT dan tidak menambah jalur tulis SIPP", () => {
    const isi = baca("blangko-derry-isian.js");
    const awal = isi.indexOf("Putusan yang disunting sendiri (28 Okt 2026)");
    const akhir = isi.indexOf("async function pdfDari") > awal ? isi.indexOf("async function pdfDari") : isi.length;
    const bagian = isi.slice(awal, akhir);
    expect(awal).toBeGreaterThan(0);
    // nama tampil ke petugas: tanpa label teknis yang dilarang
    const tampil = (bagian.match(/(?:toast|catatLog)\(`[^`]*`|"[A-Z][^"]{12,}"|`[A-Z][^`]{12,}`/g) || []).join("\n");
    expect(tampil).not.toMatch(/borang|peladen|galat/i);
    // satu-satunya permintaan jaringan baru: konversi-naskah (hanya menghitung), melalui ambilPortal
    expect(bagian.match(/ambilPortal\(/g) || []).toHaveLength(1);
    expect(bagian).toContain("API_KONVERSI_NASKAH");
    expect(bagian).not.toMatch(/klienAbt\(\)|\/edit_data|unggah-sipp/);
    // konversi-naskah sudah diizinkan selama latihan / pada daftar yang hanya menghitung
    const panel = baca("panel-alat.js");
    expect((panel.match(/putusan\\\/konversi-naskah/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("CSS area unggah memakai token warna panel (terbaca di mode gelap dan terang), tanpa warna mati", () => {
    const css = baca("blangko-derry.css");
    const blok = css.slice(css.indexOf("Unggah putusan sendiri"), css.indexOf("Unggah putusan sendiri") + 900);
    expect(blok).toContain("var(--okln)");
    expect(blok).toContain("var(--okbg)");
    expect(blok).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});
