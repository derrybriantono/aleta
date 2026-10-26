// @vitest-environment node
/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI D, D3: DAFTAR WAJIB SEBELUM CETAK + SALIN DARI PERKARA SERUPA DI BLANGKO DERRY (U13)
 * ============================================================================
 * Harness disalin dari blangko-derry-isian-16okt.test.ts (blangko-derry*.js dijalankan SUNGGUHAN di jsdom, portal, bot, ABT
 * ditiru di fetch; cetak sampai RTF dan PDF). Yang dijaga:
 *   A  saklar MATI (bawaan): tidak ada laporan, tidak ada pengingat tambahan, tidak ada saran; yang ditanyakan hanya saklar
 *   B  saklar MENYALA: kelengkapan SEMUA jenis blangko dilaporkan (setelah jeda, hanya bila berubah) beserta pola perkara tanpa
 *      nama/tanggal/nomor; saat dicetak dilaporkan sekali lagi dengan penanda dicetak
 *   C  isian yang biasanya terisi saat cetak tetapi masih kosong ikut diingatkan; data belum cukup = tidak berubah; dialog
 *      "Tetap cetak" tetap ada
 *   D  isian kosong diberi SARAN dari perkara serupa yang sudah putus (tidak pernah ditulis ke ABT sendiri); Tab menulisnya
 *   E  gagal = perilaku lama
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { PILIHAN_ALASAN, kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { hurufAlasan, tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "jejak-isian.js", "blangko-derry.js", "blangko-derry-saksi.js", "isi-sipp-bersama.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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
  D("9134", "Petunjuk perbaikan permohonan", "data_teks"),
]);
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1214", "2021", "2022", "0156", "0184", "8536", "0227", "11111", "11116", "11117", "0033", "9134"];
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
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array; wajib?: Wajib } = {}): Halaman {
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
    const dariWajib = p.wajib ? jawabWajib(p.wajib, url, cara, badan) : undefined;
    if (dariWajib) return dariWajib;
    // Bot dan portal untuk isi dari SIPP (kosong: tidak ada usulan mesin)
    if (url.includes("/aleta-bot/abt/usulan")) return json({ ok: true, data: { available: true, sipp: { ok: true, usulan: [], jumlahKuasa: 0, prodeo: false }, saksi: { usulan: [], huruf: [] }, itsbat: { ok: false }, positaLain: { ok: false, alasan: "jenis_perkara_tidak_dilayani" } } });
    if (url.includes("/aleta-ecourt/isi-gugatan")) return json({ ok: true, data: { usulan: [], tanyaJawab: [], kalimat: [], kontak: null } });
    if (url.includes("/aleta-ecourt/kuasa-gugatan")) return json({ ok: true, data: { usulan: [], ada: false } });
    if (url.includes("/aleta-ecourt/ktp-pihak")) return json({ ok: true, data: { pihak: [] } });
    // Portal ALETA
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
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
// 19 Okt (tahap 2): tanya jawab saksi hanya DISUNTING pada berita acara (BAS) oleh panitera pengganti; putusan dan peran
// hakim hanya membaca. Uji penyuntingan membuka BAS sebagai PP.
async function pilihBas(h: Halaman) {
  await sampaiPerkara(h);
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, `[data-bl="${BLANGKO_BAS}"]`), "berkas bas");
  klik(h, `[data-bl="${BLANGKO_BAS}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f") || q(h, "[data-tj]"), "perlu diisi");
}
async function pilihPutusan(h: Halaman) {
  await sampaiPerkara(h);
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, `[data-bl="${BLANGKO_PUT}"]`), "berkas putusan termuat");
  klik(h, `[data-bl="${BLANGKO_PUT}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f"), "perlu diisi tergambar");
}


// ============================================================================
// Portal wajib-cetak tiruan
// ============================================================================
type Wajib = {
  aktif: boolean;
  gagal?: boolean;
  /** Isian yang biasanya terisi saat cetak. */
  biasanya: Array<{ kode: string; terisi: number; dari: number; rasio: number }>;
  cukupData: boolean;
  /** Usulan dari perkara serupa. */
  serupa: Array<{ kode: string; nilai: string; jumlah: number; dari: number; nomorPerkara: string[] }>;
  lapor: Array<Record<string, any>>;
  tanyaSerupa: Array<Record<string, any>>;
  tanyaBerkas: string[];
  tanyaSaklar: number;
};
const wajibBaru = (aktif: boolean, tambah: Partial<Wajib> = {}): Wajib => ({ aktif, biasanya: [], cukupData: false, serupa: [], lapor: [], tanyaSerupa: [], tanyaBerkas: [], tanyaSaklar: 0, ...tambah });
function jawabWajib(w: Wajib, url: string, cara: string, badan: string) {
  if (!/\/aleta-ecourt\/wajib-cetak/.test(url)) return undefined;
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  if (/wajib-cetak\?bagian=saklar/.test(url)) {
    w.tanyaSaklar += 1;
    return w.gagal ? json({ ok: false }, 500) : json({ ok: true, data: { aktif: w.aktif } });
  }
  if (cara === "GET" && /wajib-cetak\?berkas=/.test(url)) {
    if (w.gagal) return json({ ok: false }, 500);
    w.tanyaBerkas.push(decodeURIComponent(url.split("berkas=")[1] || ""));
    return json({ ok: true, data: { aktif: w.aktif, cetak: w.cukupData ? 12 : 3, cukupData: w.cukupData, wajib: w.biasanya } });
  }
  if (cara === "POST") {
    const isi = JSON.parse(badan || "{}");
    if (isi.aksi === "lapor") {
      w.lapor.push(isi);
      return json({ ok: true, data: { aktif: w.aktif, dicatat: true, sebab: "" } });
    }
    if (isi.aksi === "serupa") {
      w.tanyaSerupa.push(isi);
      return json({ ok: true, data: { aktif: w.aktif, serupa: w.serupa.length ? 3 : 0, usulan: w.aktif ? w.serupa.filter((u) => isi.kode.includes(u.kode)) : [] } });
    }
  }
  return json({ ok: false }, 404);
}
const permintaanWajib = (h: Halaman) => h.minta.filter((m) => /wajib-cetak/.test(m.url));
const postWajib = (h: Halaman) => permintaanWajib(h).filter((m) => m.cara === "POST");
const NILAI_SERUPA = "Perbaiki uraian posita sesuai petunjuk majelis";
const tungguIngat = (h: Halaman) =>
  sampai(() => {
    const e = q(h, "#bd-ingat");
    return e && !e.hidden ? e : null;
  }, "pengingat");

// ============================================================================
describe("D3 - daftar wajib sebelum cetak: saklar MATI (bawaan) = perilaku lama persis", () => {
  it("tidak ada laporan, pengingat cetak hanya yang lama, tidak ada saran dari perkara serupa; yang ditanyakan hanya saklar", async () => {
    const w = wajibBaru(false, { biasanya: [{ kode: "0007", terisi: 12, dari: 12, rasio: 1 }], cukupData: true, serupa: [{ kode: "9134", nilai: NILAI_SERUPA, jumlah: 3, dari: 4, nomorPerkara: ["1/Pdt.G/2026/PA.Dgl"] }] });
    const h = buka({ wajib: w });
    await pilihPutusan(h);
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "x");
    await tunggu(3500);
    klik(h, '[data-bd2="cetak"]');
    const ingat = await tungguIngat(h);
    expect(ingat.textContent).not.toContain("biasanya terisi");
    expect(q(h, '[data-bd2="tetapcetak"]')).not.toBeNull();
    expect(postWajib(h)).toEqual([]);
    expect(w.lapor).toEqual([]);
    expect(w.tanyaBerkas).toEqual([]);
    expect(w.tanyaSerupa).toEqual([]);
    expect((q(h, "#bd-i9134") as HTMLInputElement).placeholder).not.toBe(NILAI_SERUPA);
  });
});

describe("D3 - daftar wajib sebelum cetak: saklar MENYALA", () => {
  it("kelengkapan putusan dilaporkan sesudah jeda (hanya bila berubah) beserta pola perkara tanpa nama/tanggal/nomor; dicetak dilaporkan sekali lagi", async () => {
    const w = wajibBaru(true);
    const h = buka({ wajib: w });
    await pilihPutusan(h);
    const pertama = await sampai(() => w.lapor.find((l) => l.dicetak === false), "laporan pertama", 8000);
    expect(pertama).toMatchObject({ aksi: "lapor", perkaraId: "10154", nomorPerkara: "581/Pdt.G/2026/PA.Dgl", berkas: expect.stringContaining("[01]"), jenisBlangko: "put", jenisPerkara: "Cerai Gugat", dicetak: false });
    expect(pertama.isian.length).toBeGreaterThan(3);
    expect(pertama.isian.find((i: any) => i.kode === "0007")).toEqual({ kode: "0007", terisi: false });
    expect(pertama.fakta).toEqual({ alur: "15", ghaib: false, prodeo: false, jumlahP: 1, jumlahT: 1, verstek: true });
    expect(JSON.stringify(pertama.fakta)).not.toMatch(/Yulfiani|Andi|581|2026/);
    expect(JSON.stringify(w.lapor)).not.toMatch(/aleta/i);

    // berubah -> laporan baru; tidak berubah -> tidak ada laporan baru
    const jumlah = w.lapor.length;
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "dikaruniai 1 anak");
    await sampai(() => w.lapor.length > jumlah && w.lapor.at(-1)!.isian.find((i: any) => i.kode === "0007")?.terisi === true, "laporan sesudah diisi", 8000);
    const sesudah = w.lapor.length;
    await tunggu(3500);
    expect(w.lapor.length).toBe(sesudah);

    // cetak: lewati pengingat, lalu laporan saat dicetak
    klik(h, '[data-bd2="cetak"]');
    await tungguIngat(h);
    klik(h, '[data-bd2="tetapcetak"]');
    const dicetak = await sampai(() => w.lapor.find((l) => l.dicetak === true), "laporan saat dicetak", 8000);
    expect(dicetak).toMatchObject({ aksi: "lapor", perkaraId: "10154", jenisBlangko: "put", dicetak: true });
    expect(dicetak.isian.find((i: any) => i.kode === "0007")).toEqual({ kode: "0007", terisi: true });
  });

  it("BAS (bukan putusan) juga dilaporkan: semua jenis blangko, bukan hanya putusan", async () => {
    const w = wajibBaru(true);
    const h = buka({ wajib: w, orang: "pp" });
    await pilihBas(h);
    const lap = await sampai(() => w.lapor[0], "laporan BAS", 8000);
    expect(lap).toMatchObject({ jenisBlangko: "bas", berkas: expect.stringContaining("BAS ALUR 02"), dicetak: false });
  });

  it("isian yang biasanya terisi tetapi masih kosong ikut diingatkan sebagai penting; 'Tetap cetak' tetap ada dan mencetak", async () => {
    const w = wajibBaru(true, { cukupData: true, biasanya: [{ kode: "0007", terisi: 11, dari: 12, rasio: 0.917 }, { kode: "9134", terisi: 12, dari: 12, rasio: 1 }] });
    const h = buka({ wajib: w });
    await pilihPutusan(h);
    klik(h, '[data-bd2="cetak"]');
    const ingat = await tungguIngat(h);
    expect(ingat.textContent).toContain("Penting - sebaiknya diisi sebelum cetak");
    // sudah ada di daftar lama -> dianotasi; belum ada (9134) -> ditambahkan
    expect(ingat.textContent).toContain("Anak dari pernikahan ini - biasanya terisi (11 dari 12 cetak)");
    expect(ingat.textContent).toMatch(/Petunjuk perbaikan permohonan.* - biasanya terisi \(12 dari 12 cetak\)/);
    expect(w.tanyaBerkas).toHaveLength(1);
    expect(q(h, '[data-bd2="isidulu"]')).not.toBeNull();
    expect(h.latar.filter((m) => m.jenis === "unduh")).toEqual([]);
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.latar.filter((m) => m.jenis === "unduh").length >= 1, "unduhan", 8000);
  });

  it("isian yang sudah terisi tidak diingatkan; data belum cukup tidak mengubah pengingat", async () => {
    const w = wajibBaru(true, { cukupData: true, biasanya: [{ kode: "0007", terisi: 12, dari: 12, rasio: 1 }] });
    const h = buka({ wajib: w, abtAwal: { "0007": "dikaruniai 1 anak" } });
    await pilihPutusan(h);
    klik(h, '[data-bd2="cetak"]');
    const ingat = await tungguIngat(h);
    expect(ingat.textContent).not.toContain("biasanya terisi");

    const w2 = wajibBaru(true, { cukupData: false, biasanya: [{ kode: "0007", terisi: 3, dari: 3, rasio: 1 }] });
    const h2 = buka({ wajib: w2 });
    await pilihPutusan(h2);
    klik(h2, '[data-bd2="cetak"]');
    const ingat2 = await tungguIngat(h2);
    expect(ingat2.textContent).not.toContain("biasanya terisi");
  });

  it("isian teks kosong diberi SARAN dari perkara serupa; ABT tidak disentuh; Tab menerimanya dan menulis ke ABT", async () => {
    const w = wajibBaru(true, { serupa: [{ kode: "9134", nilai: NILAI_SERUPA, jumlah: 3, dari: 4, nomorPerkara: ["1/Pdt.G/2026/PA.Dgl", "2/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl"] }, { kode: "2004", nilai: "tidak diminta", jumlah: 2, dari: 2, nomorPerkara: [] }] });
    const h = buka({ wajib: w });
    await pilihPutusan(h);
    const kotak = await sampai(() => {
      const k = q(h, "#bd-i9134") as HTMLInputElement | null;
      return k && k.placeholder === NILAI_SERUPA ? k : null;
    }, "saran dari perkara serupa");
    // pertanyaan ke server: hanya kode isian teks yang kosong, dengan pola perkara (tanpa nama/tanggal/nomor)
    expect(w.tanyaSerupa).toHaveLength(1);
    expect(w.tanyaSerupa[0]).toMatchObject({ aksi: "serupa", perkaraId: "10154", jenisPerkara: "Cerai Gugat", fakta: { alur: "15", verstek: true } });
    expect(w.tanyaSerupa[0].kode).toContain("9134");
    expect(JSON.stringify(w.tanyaSerupa)).not.toMatch(/Yulfiani|Andi Rustam/);
    await tunggu(80);
    expect(h.abt["9134"]).toBeUndefined();
    tombol(h, kotak, "Tab");
    await sampai(() => h.abt["9134"] === NILAI_SERUPA, "9134 tersimpan di ABT");
  });

  it("isian yang sudah berisi di ABT tidak ditanyakan dan tidak diberi saran", async () => {
    const w = wajibBaru(true, { serupa: [{ kode: "9134", nilai: NILAI_SERUPA, jumlah: 3, dari: 4, nomorPerkara: [] }] });
    const h = buka({ wajib: w, abtAwal: { "9134": "isian petugas sendiri" } });
    await pilihPutusan(h);
    await sampai(() => (q(h, "#bd-i9134") as HTMLInputElement | null)?.value === "isian petugas sendiri", "kotak berisi");
    await tunggu(80);
    expect((w.tanyaSerupa[0]?.kode ?? []) as string[]).not.toContain("9134");
    expect(h.abt["9134"]).toBe("isian petugas sendiri");
  });
});

describe("D3 - daftar wajib sebelum cetak: gagal = perilaku lama", () => {
  it("server wajib-cetak galat: tidak ada pengingat tambahan, tidak ada saran, cetak tetap jalan", async () => {
    const w = wajibBaru(true, { gagal: true, cukupData: true, biasanya: [{ kode: "0007", terisi: 12, dari: 12, rasio: 1 }], serupa: [{ kode: "9134", nilai: NILAI_SERUPA, jumlah: 3, dari: 4, nomorPerkara: [] }] });
    const h = buka({ wajib: w });
    await pilihPutusan(h);
    klik(h, '[data-bd2="cetak"]');
    const ingat = await tungguIngat(h);
    expect(ingat.textContent).not.toContain("biasanya terisi");
    expect((q(h, "#bd-i9134") as HTMLInputElement).placeholder).not.toBe(NILAI_SERUPA);
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.latar.filter((m) => m.jenis === "unduh").length >= 1, "unduhan", 8000);
    expect(w.lapor).toEqual([]);
  });
});
