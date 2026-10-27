// @vitest-environment node
/**
 * ============================================================================
 * 19 OKT 2026 - BLANGKO ABT BY DERRY: PEMILIH BLANGKO (LENCANA SIDANG) DAN ALUR CETAK
 * ============================================================================
 *
 * ekstensi-sipp/blangko-derry-isian.js dijalankan SUNGGUHAN di jsdom (kerangka sama dengan blangko-derry-isian-16okt).
 *   6   jendela Pilih blangko: lencana perkiraan "sidang ke-berapa" di kiri nama, diturunkan dari tulisan nama
 *       (BAS 1/2/..., Lanjutan, Terakhir/Putus, Ikrar), kosong bila tak ada petunjuk, disorot bila cocok dengan sidang
 *       yang dipilih di langkah 1
 *   16  header penanda (tabel mengambang berhuruf 1 pt berisi variabel ABT) dibuang dari RTF/PDF/salinan; kop, nomor
 *       halaman, footer "Putusan Nomor ..." tetap; berkas sumber tidak diubah
 *   17  bawaan pilihan cetak hanya RTF; PDF dibuat hanya bila dicentang
 *   18  menu "Tambah tanda tangan ke PDF" membaca tanda tangan SAH dari ALETA (bentuk jawaban bot { ok, baris }),
 *       tercentang otomatis, dibubuhkan pada PDF dan PDF salinan
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { PILIHAN_ALASAN, kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { hurufAlasan, tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; tj: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; pdfRtf: string[]; pdfBadan: Array<{ salinan?: boolean; ttd?: Array<{ nama: string; pngBase64: string }> }>; opsi: { hakTolak?: boolean } };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { portalLama?: boolean; orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array; ttd?: { status?: number; baris?: unknown[]; akunId?: string; gambarTolak?: boolean } } = {}): Halaman {
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
      if (p.rtfBytes) return new Response(new Blob([p.rtfBytes as BlobPart]), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="581/Pdt.G/2026/PA.Dgl - ${BLANGKO_PUT}.rtf"` } });
      return new Response(RTF_DENGAN_HEADER(abt["0007"] || "..."), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="581/Pdt.G/2026/PA.Dgl - ${BLANGKO_PUT}.rtf"` } });
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
  return { dom, w, simpanan, minta, latar, abt, tj, pdfRtf, pdfBadan, opsi: p };
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
// 6. Lencana perkiraan "sidang ke-berapa" di jendela Pilih blangko
// ============================================================================
describe("6. lencana perkiraan sidang di jendela Pilih blangko", () => {
  const lencana = (h: Halaman, berkas: string) => {
    const tombolBl = q(h, `[data-bl="${berkas}"]`);
    if (!tombolBl) throw new Error(`tombol tidak ada: ${berkas}`);
    const sd = tombolBl.querySelector(".sd") as HTMLElement;
    return { teks: sd.textContent || "", cocok: sd.classList.contains("cocok"), sebelumNama: Boolean(sd.nextElementSibling && sd.nextElementSibling.classList.contains("nm")) };
  };

  it("diturunkan dari tulisan nama blangko Derry; tanpa petunjuk -> kosong (tidak menebak)", () => {
    const h = buka();
    const sd = (nama: string, jenis = "bas") => {
      const k = isian(h).murni.perkiraanSidang(nama, jenis);
      return k ? k.teks : "";
    };
    expect(sd("BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf")).toBe("sidang 1");
    expect(sd("BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)")).toBe("sidang 2");
    expect(sd("BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P")).toBe("sidang 6");
    expect(sd("[02] BAS 6 ... - (3 Saksi)")).toBe("sidang 6");
    expect(sd("BAS ALUR 11 [1] BAS 1 IN - Pemberitahuan Putusan")).toBe("sidang 1");
    expect(sd("BAS ALUR 03 [2] BAS Lanjutan P Hadir & T Tidak Hadir - Tunda Panggil T Lagi")).toBe("lanjutan");
    expect(sd("BAS ALUR 03 [3a] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi)")).toBe("putusan");
    expect(sd("BAS ALUR 07 [3] BAS Putus P & T Tidak Hadir - Gugur")).toBe("putusan");
    expect(sd("BAS ALUR 10 [1] BAS Ikrar Talak - P Hadir & T Tidak Hadir")).toBe("ikrar");
    // Tanpa petunjuk di nama: kosong.
    expect(sd("BAS ALUR 04 [T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja)")).toBe("");
    expect(sd("[01] Cerai V Kabul.rtf", "put")).toBe("");
    expect(sd("[01] Kabul.rtf", "put")).toBe("");
    // Putusan / penetapan dengan petunjuk.
    expect(sd("[1] Sidang 1 - Calon Hadir - Bukti & 2 Saksi, Penetapan Dibacakan.rtf", "put")).toBe("sidang 1");
    expect(sd("[2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf", "put")).toBe("lanjutan");
    expect(sd("[3] Sidang Terakhir - Pengucapan Putusan dan Hak Keberatan.rtf", "put")).toBe("putusan");
    expect(sd("[01] Putusan.rtf", "put")).toBe("putusan");
    // "Tunda Putusan" bukan putusan; "2 Saksi" bukan sidang ke-2; pemberitahuan/salinan bukan sidang.
    expect(sd("Pembuktian P, Tunda Putusan", "put")).toBe("");
    expect(sd("Sidang 2 Saksi dan Pembuktian", "put")).toBe("");
    expect(sd("Relaas Pemberitahuan Putusan", "rel")).toBe("");
    expect(sd("Salinan Putusan", "put")).toBe("");
    // Relaas dan PTSP.
    expect(sd("[JS] Panggilan Sidang Pertama T", "rel")).toBe("sidang 1");
    expect(sd("Panggilan Sidang T (Sidang Lanjutan)", "rel")).toBe("lanjutan");
    expect(sd("BAS 1 P & T Hadir - Mediasi", "ptsp")).toBe("");
  });

  it("tampil di KIRI nama tiap blangko (sebelum .nm), sidang yang cocok dengan langkah 1 disorot, juga di kelompok Disarankan", async () => {
    const h = buka({ orang: "pp" });
    await sampaiPerkara(h);
    h.w.aletaBlangkoDerry.pasangRekomendasi(() => [{ berkas: BLANGKO_BAS, kelompok: "BAS CG", jenis: "bas", alasan: "uji saran" }]);
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
    // Kelompok Disarankan aktif lebih dulu.
    await sampai(() => q(h, `[data-bl="${BLANGKO_BAS}"]`), "berkas saran");
    expect(q(h, `[data-bl="${BLANGKO_BAS}"] .bd-lencana`)!.textContent).toBe("disarankan");
    const saran = lencana(h, BLANGKO_BAS);
    expect(saran).toEqual({ teks: "sidang 2", cocok: true, sebelumNama: true });
    if (process.env.ALETA_TANGKAP_PEMILIH) writeFileSync(`${process.env.ALETA_TANGKAP_PEMILIH}-saran.html`, akar(h).outerHTML);
    // Kelompok BAS: semua berkas.
    const kelBas = await sampai(() => qq(h, "[data-kelmodal]:not(.saran):not(.ikrar)")[0], "kelompok bas");
    kelBas.click();
    await sampai(() => q(h, `[data-bl="${BAS_DAFTAR[1][0]}"]`), "berkas kelompok");
    await sampai(() => qq(h, "[data-bl]").length >= 6, "enam berkas");
    expect(lencana(h, BAS_DAFTAR[1][0])).toEqual({ teks: "sidang 1", cocok: false, sebelumNama: true });
    expect(lencana(h, BAS_DAFTAR[0][0])).toEqual({ teks: "sidang 2", cocok: true, sebelumNama: true });
    expect(lencana(h, BAS_DAFTAR[2][0]).teks).toBe("lanjutan");
    expect(lencana(h, BAS_DAFTAR[2][0]).cocok).toBe(true); // sidang yang dipilih = ke-2 (>= 2)
    // Sidang ke-2 itu putus (keterangan "putus DIKABULKAN") -> lencana putusan ikut menyala.
    expect(lencana(h, BAS_DAFTAR[3][0])).toEqual({ teks: "putusan", cocok: true, sebelumNama: true });
    expect(lencana(h, BAS_DAFTAR[5][0])).toEqual({ teks: "", cocok: false, sebelumNama: true }); // tanpa petunjuk: lajur kosong, nama tidak bergeser
    // Bahan tangkapan layar (Playwright, replika statis): hanya bila diminta lewat lingkungan.
    if (process.env.ALETA_TANGKAP_PEMILIH) writeFileSync(`${process.env.ALETA_TANGKAP_PEMILIH}-bas.html`, akar(h).outerHTML);
    // Ikrar: tampil di pencarian (kelompok maya Ikrar Talak memakai tombol ikrar).
    const cari = q(h, "#bd-caribl") as HTMLInputElement;
    ketik(h, cari, "ikrar", false);
    await tunggu(10);
    const sdIkrar = qq(h, "[data-bl] .sd").map((e) => e.textContent);
    expect(sdIkrar.length).toBeGreaterThan(0);
    expect(sdIkrar.every((t) => t === "ikrar")).toBe(true);
    expect(qq(h, "[data-bl] .sd.cocok").length).toBe(0); // sidang aktif bukan ikrar
  });

  it("CSS: lajur lencana tetap (tidak menggeser nama), lencana cocok disorot", () => {
    const css = baca("blangko-derry.css");
    expect(css).toContain("grid-template-columns: auto 5.2em 1fr auto auto");
    expect(css).toMatch(/\.bd-bl \.sd\.cocok \{[^}]*font-weight: 700/);
    expect(css).toMatch(/\.bd-bl \.sd:empty \{ border: 0/);
  });
});

// ============================================================================
// 16. Header penanda kecil dibuang dari keluaran cetak
// ============================================================================
describe("16. header penanda blangko Derry hilang dari keluaran cetak", () => {
  const bersih = (h: Halaman, rtf: string | ArrayBuffer) => isian(h).murni.bersihkanHeaderPenanda(rtf) as { rtf: string | ArrayBuffer; jumlah: number };

  it("header berisi variabel berhuruf 1 pt dibuang; kop, nomor halaman, dan footer 'Putusan Nomor' tetap; sumber tidak berubah", () => {
    const h = buka();
    const asli = RTF_DENGAN_HEADER("ada anak");
    const salinan = String(asli);
    const hasil = bersih(h, asli);
    expect(hasil.jumlah).toBe(1);
    const rtf = hasil.rtf as string;
    expect(rtf).not.toContain("Kantor Hukum Uji Contoh");
    expect(rtf).not.toContain("\\cf16");
    expect(rtf).toContain("{\\header\\pard\\plain\\fs2\\par}");
    expect(rtf).toContain("{\\footer \\pard\\plain\\qr\\fs20 Putusan Nomor 581/Pdt.G/2026/PA.Dgl Halaman {\\field{\\*\\fldinst{ PAGE");
    expect(rtf).toContain("PUTUSAN");
    expect(rtf).toContain("Menimbang, bahwa alasan perceraian huruf F telah terbukti; dari pernikahan ada anak;");
    expect(rtf).toContain("Hakim Satu, S.H.");
    expect(asli).toBe(salinan); // masukan tidak diubah
  });

  it("ArrayBuffer masuk -> ArrayBuffer keluar (bita lain tetap); tanpa header penanda -> objek yang sama", () => {
    const h = buka();
    const masuk = biner(RTF_DENGAN_HEADER("x"));
    const sebelum = Buffer.from(new Uint8Array(masuk)).toString("latin1");
    const hasil = bersih(h, masuk);
    expect(hasil.jumlah).toBe(1);
    expect(hasil.rtf instanceof ArrayBuffer || ArrayBuffer.isView(hasil.rtf) || Object.prototype.toString.call(hasil.rtf) === "[object ArrayBuffer]").toBe(true);
    expect(Buffer.from(new Uint8Array(hasil.rtf as ArrayBuffer)).toString("latin1")).not.toContain("Kantor Hukum Uji Contoh");
    expect(Buffer.from(new Uint8Array(masuk)).toString("latin1")).toBe(sebelum);
    const tanpa = biner(RTF_PUT("x"));
    const h2 = bersih(h, tanpa);
    expect(h2.jumlah).toBe(0);
    expect(h2.rtf).toBe(tanpa);
  });

  it("hanya pola yang terbukti: header kop bermuka normal, header ber-nomor halaman, dan header kosong tidak disentuh", () => {
    const h = buka();
    const dasar = (header: string) => `{\\rtf1\\ansi{\\fonttbl{\\f0 Times;}}${header}\\pard Isi naskah\\par}`;
    for (const header of [
      HEADER_KOP,
      "{\\header \\pard\\plain\\qr\\fs24 Halaman {\\field{\\*\\fldinst{ PAGE }}{\\fldrslt{1}}}\\par}",
      "{\\header \\pard\\plain\\fs2 kecil {\\field{\\*\\fldinst{ PAGE }}{\\fldrslt{1}}}\\par}", // ada kolom nomor halaman -> aman
      "{\\header\\pard\\plain\\f1\\fs22     \\par}", // header kosong bawaan Derry
      "{\\header \\pard\\plain\\fs2 kecil\\fs24 TAPI ADA TEKS NORMAL\\par}", // campuran
    ]) {
      const r = bersih(h, dasar(header));
      expect(r.jumlah).toBe(0);
      expect(r.rtf).toBe(dasar(header));
    }
    // Variabel kosong (tanpa teks) pada tabel berhuruf kecil juga dibuang; header kop di sebelahnya dibiarkan.
    const campur = dasar(`{\\headerl \\trowd \\cellx3000 \\pard\\intbl \\plain \\fs2 \\cell \\row \\pard\\par}${HEADER_KOP}`);
    const r2 = bersih(h, campur);
    expect(r2.jumlah).toBe(1);
    expect(r2.rtf as string).toContain("{\\headerl\\pard\\plain\\fs2\\par}");
    expect(r2.rtf as string).toContain("PENGADILAN AGAMA DONGGALA - SALINAN KOP");
    // Tidak seimbang: dibiarkan.
    const rusak = "{\\rtf1{\\header \\fs2 teks kecil";
    expect(bersih(h, rusak).jumlah).toBe(0);
  });

  it("cetak sungguhan: RTF, PDF, PDF salinan memakai naskah tanpa header penanda; ABT hanya dibaca (tidak ada tulis naskah)", async () => {
    const h = buka();
    await pilihPutusan(h);
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    (q(h, '[data-fmt="salinan"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden, "pengingat");
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.pdfRtf.length === 2 && h.latar.some((m) => m.jenis === "unduh"), "pdf dan salinan diminta", 8000);
    const unduhRtf = h.latar.find((m) => m.jenis === "unduh" && /\.rtf$/.test(String(m.nama))) as { alamat: string };
    const isiRtf = Buffer.from(String(unduhRtf.alamat).split(",")[1], "base64").toString("latin1");
    for (const naskah of [isiRtf, ...h.pdfRtf]) {
      expect(naskah).not.toContain("Kantor Hukum Uji Contoh");
      expect(naskah).toContain("{\\header\\pard\\plain\\fs2\\par}");
      expect(naskah).toContain("Putusan Nomor 581/Pdt.G/2026/PA.Dgl Halaman");
      expect(naskah).toContain("PUTUSAN");
    }
    // Naskah di ABT hanya diminta lewat preview (GET); tidak ada permintaan menulis berkas naskah.
    expect(mintaKe(h, /abt\/preview\?/).every((m) => m.cara === "GET")).toBe(true);
    expect(h.minta.filter((m) => m.cara !== "GET" && /\.rtf|simpan_blangko|upload/i.test(m.url))).toEqual([]);
  });
});

// ============================================================================
// 17. Bawaan pilihan cetak: hanya RTF
// ============================================================================
describe("17. bawaan pilihan cetak hanya RTF", () => {
  it("hanya RTF tercentang; PDF, PDF SALINAN, PDF anonim, e-Doc tidak; keadaan internal sama", async () => {
    const h = buka();
    await pilihPutusan(h);
    const centang = (k: string) => (q(h, `[data-fmt="${k}"]`) as HTMLInputElement).checked;
    expect(["rtf", "pdf", "salinan", "anon", "edoc"].map(centang)).toEqual([true, false, false, false, false]);
    expect(isian(h).keadaan().fmt).toEqual({ rtf: true, pdf: false, salinan: false, anon: false, edoc: false });
    expect(q(h, "#bd-statuscetak")!.textContent).toContain("Akan menerbitkan: RTF.");
  });

  it("tidak ada penyimpanan pilihan: panel dibuka ulang (halaman baru) tetap RTF saja walau sesi lalu mencentang PDF; pilihan di sesi yang sama dipertahankan", async () => {
    const lama = buka({ simpanan: { blangkoDerryFmt: { pdf: true, salinan: true }, blangkoDerry: { fmt: { pdf: true } } } });
    await pilihPutusan(lama);
    (q(lama, '[data-fmt="pdf"]') as HTMLInputElement).click();
    expect(isian(lama).keadaan().fmt.pdf).toBe(true); // pengguna mengubah di sesi ini
    klik(lama, '[data-bd2="bukamodal"]');
    await sampai(() => q(lama, "#bd-modal:not([hidden])"), "modal lagi");
    expect(isian(lama).keadaan().fmt.pdf).toBe(true);
    const baru = buka({ simpanan: { blangkoDerryFmt: { pdf: true, salinan: true }, blangkoDerry: { fmt: { pdf: true } } } });
    await pilihPutusan(baru);
    expect(isian(baru).keadaan().fmt).toEqual({ rtf: true, pdf: false, salinan: false, anon: false, edoc: false });
  });

  it("hanya RTF dicentang -> tidak ada permintaan PDF dan log tidak menyebut 'membuat PDF' atau 'PDF diunduh'", async () => {
    const h = buka();
    await pilihPutusan(h);
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden, "pengingat");
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.latar.filter((m) => m.jenis === "unduh").length >= 1 && /RTF diunduh/.test(akar(h).textContent || ""), "rtf diunduh", 8000);
    await tunggu(60);
    expect(h.latar.filter((m) => m.jenis === "unduh").map((m) => m.nama)).toEqual([`581_Pdt.G_2026_PA.Dgl - ${BLANGKO_PUT}.rtf`]);
    expect(mintaKe(h, /aleta-bot\/abt\/pdf/)).toEqual([]);
    const teks = akar(h).textContent || "";
    expect(teks).not.toContain("membuat PDF");
    expect(teks).not.toContain("PDF diunduh");
    expect(h.pdfRtf).toEqual([]);
  });
});

// ============================================================================
// 18. Menu "Tambah tanda tangan ke PDF" membaca tanda tangan SAH dari ALETA
// ============================================================================
describe("18. tanda tangan sah dari ALETA tercentang otomatis dan dibubuhkan", () => {
  const BARIS = [
    { id: 11, namaPejabat: "Hakim Satu, S.H.", disahkan: true, penggunaId: "u-hs", disahkanPada: "2026-10-19T01:00:00.000Z" },
    { id: 14, namaPejabat: "Hakim Satu", disahkan: true, penggunaId: "", disahkanPada: "2026-10-19T03:00:00.000Z" }, // lebih baru tetapi belum tertaut
    { id: 12, namaPejabat: "Hakim Dua, M.H.", disahkan: true, penggunaId: "u-hd", disahkanPada: "2026-10-19T01:30:00.000Z" },
    { id: 13, namaPejabat: "PP Satu", disahkan: false, penggunaId: "u-pp" }, // belum disahkan
  ];
  const kotakTtd = async (h: Halaman) => {
    klik(h, '[data-bd2="popttd"]');
    const pop = await sampai(() => {
      const p = q(h, "#bd-popttd");
      return p && !p.hidden && p.querySelector("[data-ttd]") ? p : null;
    }, "popover ttd");
    return Array.from(pop.querySelectorAll("[data-ttd]")) as HTMLInputElement[];
  };

  it("hakim: miliknya yang sah OTOMATIS tercentang (tautan akun didahulukan dari nama); milik orang lain tidak bisa; yang tak punya tidak tercentang", async () => {
    const h = buka({ ttd: { baris: BARIS, akunId: "u-hs" } });
    await pilihPutusan(h);
    await sampai(() => /\(1\)/.test(q(h, "#bd-btnttd")!.textContent || ""), "tercentang otomatis");
    const kotak = await kotakTtd(h);
    expect(kotak.map((k) => [k.getAttribute("data-ttd"), k.checked, k.disabled])).toEqual([["ketua", true, false], ["anggota1", false, true], ["pp", false, true]]);
    const pop = q(h, "#bd-popttd")!;
    expect(pop.textContent).toContain("tanda tangan tersimpan di ALETA (sudah disahkan)");
    expect(pop.textContent).toContain("hanya dapat dipasang oleh yang bersangkutan");
    expect(pop.textContent).not.toContain("belum ada tanda tangan tersimpan");
  });

  it("PDF biasa mengirim gambar ke portal untuk dibubuhkan di PDF (posisi dari koordinat nama); PDF SALINAN TIDAK memuat gambar tanda tangan hakim/PP sama sekali (id 11)", async () => {
    const h = buka({ ttd: { baris: BARIS, akunId: "u-hs" } });
    await pilihPutusan(h);
    await sampai(() => /\(1\)/.test(q(h, "#bd-btnttd")!.textContent || ""), "tercentang otomatis");
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    (q(h, '[data-fmt="salinan"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden, "pengingat");
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.pdfRtf.length === 2, "pdf diminta", 8000);
    // RTF kedua keluaran bersih dari gambar (tidak ada lagi gambar yang posisinya ditebak di RTF).
    for (const rtf of h.pdfRtf) expect(rtf).not.toContain("\\pict");
    const biasa = h.pdfBadan.find((x) => !x.salinan)!;
    const salinan = h.pdfBadan.find((x) => x.salinan)!;
    expect(biasa.ttd).toHaveLength(1);
    expect(biasa.ttd![0].nama).toBe("Hakim Satu, S.H.");
    expect(biasa.ttd![0].pngBase64.length).toBeGreaterThan(20);
    expect(salinan.ttd).toBeUndefined();
    // Gambar hanya diambil sekali (untuk PDF biasa), bukan lagi untuk salinan.
    expect(mintaKe(h, /tanda-tangan\/11\/gambar/).length).toBe(1);
    expect(mintaKe(h, /tanda-tangan\/14\/gambar/)).toEqual([]);
    await sampai(() => /tanda tangan: Hakim Satu/.test(akar(h).textContent || ""), "log ttd");
    await sampai(() => /majelis dan panitera sidang: ttd|tanpa tanda tangan Panitera yang disahkan; majelis dan panitera sidang: ttd/.test(akar(h).textContent || ""), "keterangan salinan: ttd");
  });

  it("portal lama (jawaban tanpa ttdPdf): PDF biasa memakai cara lama - gambar disisipkan di RTF - dan tetap berhasil", async () => {
    const h = buka({ portalLama: true, ttd: { baris: BARIS, akunId: "u-hs" } });
    await pilihPutusan(h);
    await sampai(() => /\(1\)/.test(q(h, "#bd-btnttd")!.textContent || ""), "tercentang otomatis");
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden, "pengingat");
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.pdfRtf.length === 2, "pdf diminta dua kali (baru lalu cadangan lama)", 8000);
    expect(h.pdfRtf[0]).not.toContain("\\pict");
    const idxPict = h.pdfRtf[1].indexOf("{\\pict\\pngblip");
    expect(idxPict).toBeGreaterThan(0);
    expect(idxPict).toBeLessThan(h.pdfRtf[1].indexOf("Hakim Satu, S.H."));
    await sampai(() => /tanda tangan: Hakim Satu/.test(akar(h).textContent || ""), "log ttd");
  });

  it("pengguna yang mencabut centang tidak dicentang ulang otomatis dan PDF tidak dibubuhi", async () => {
    const h = buka({ ttd: { baris: BARIS, akunId: "u-hs" } });
    await pilihPutusan(h);
    await sampai(() => /\(1\)/.test(q(h, "#bd-btnttd")!.textContent || ""), "tercentang otomatis");
    const kotak = await kotakTtd(h);
    kotak[0].click();
    kotak[0].dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(q(h, "#bd-btnttd")!.textContent).not.toContain("(1)");
    (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden, "pengingat");
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.pdfRtf.length === 1, "pdf diminta", 8000);
    expect(h.pdfRtf[0]).not.toContain("\\pict");
  });

  it("tanpa gambar yang disahkan (belum ada baris, atau baris belum sah): tidak tercentang, kalimat 'belum ada gambar tanda tangan yang disahkan'", async () => {
    const h = buka({ ttd: { baris: [{ id: 13, namaPejabat: "Hakim Satu, S.H.", disahkan: false, penggunaId: "u-hs" }], akunId: "u-hs" } });
    await pilihPutusan(h);
    await tunggu(80);
    expect(q(h, "#bd-btnttd")!.textContent).not.toContain("(1)");
    const kotak = await kotakTtd(h);
    expect(kotak.every((k) => !k.checked)).toBe(true);
    expect(q(h, "#bd-popttd")!.textContent).toContain("belum ada gambar tanda tangan yang disahkan");
  });

  it("Admin/Super Admin: semua penanda tangan yang punya tanda tangan sah tercentang; yang tak punya tidak", async () => {
    const h = buka({ orang: "admin", ttd: { baris: BARIS, akunId: "u-admin" } });
    await pilihPutusan(h);
    await sampai(() => /\(2\)/.test(q(h, "#bd-btnttd")!.textContent || ""), "dua tercentang otomatis");
    const kotak = await kotakTtd(h);
    expect(kotak.map((k) => [k.getAttribute("data-ttd"), k.checked, k.disabled])).toEqual([["ketua", true, false], ["anggota1", true, false], ["pp", false, true]]);
    expect(q(h, "#bd-popttd")!.textContent).toContain("belum ada gambar tanda tangan yang disahkan");
  });

  it("bot menjawab bentuk asli { ok, baris } diterima; 403 menampilkan sebab dan tidak ada yang tercentang", async () => {
    const h = buka(); // tanpa ttd -> rute menjawab 403
    await pilihPutusan(h);
    await tunggu(80);
    expect(q(h, "#bd-btnttd")!.textContent).not.toContain("(");
    const kotak = await kotakTtd(h);
    expect(kotak.every((k) => !k.checked)).toBe(true);
    expect(q(h, "#bd-popttd")!.textContent).toContain("akun Anda tidak berwenang membaca berkas tanda tangan ALETA");
  });
});
