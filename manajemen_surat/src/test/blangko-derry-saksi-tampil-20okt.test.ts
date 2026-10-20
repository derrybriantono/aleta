// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - TAMPILAN TANYA JAWAB SAKSI BLANGKO DERRY (agen S4)
 * ============================================================================
 * Butir 2 Tambah baris di bawah tabel; 3 Isi ulang dari data perkara dengan konfirmasi di halaman; 5 warna kotak jawaban
 * menurut asal + ringkasan yang bisa diklik; 6 isian opsional (#9134) di "Isian tambahan"; 7 kepala panel menempel padat;
 * 9 peringatan "Daftar kosong" tidak dobel / tidak tertinggal. Berkas ekstensi dijalankan SUNGGUHAN di jsdom.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

const require_ = createRequire(path.resolve(process.cwd(), "../ekstensi-sipp/x.js"));

const EKSTENSI = process.env.ALETA_EKSTENSI_DIR || path.resolve(process.cwd(), "../ekstensi-sipp"); // ALETA_EKSTENSI_DIR: versi lama untuk foto "sebelum"
const baca = (berkas: string) => {
  try {
    return readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
  } catch {
    return ""; // berkas belum ada pada versi lama
  }
};
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-saksi.js", "blangko-derry-saksi-tampil.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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
  D("9134", "Bas permohonan", "data_teks"),
  D("9135", "Catatan tambahan majelis", "data_teks"),
  D("0050", "Sidang Ke-", "multi_sidang"),
]);
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1214", "2021", "2022", "0156", "0184", "8536", "0227", "11111", "11116", "11117", "0033"];
const PENANDA_BAS = ["0001", "0033", "0050", "1214", "5058", "5059", "8503", "9134", "9135"];
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
const usulanKe: { fungsi: (b: any) => any } = { fungsi: () => ({ ok: true, saksi1: [], saksi2: [] }) };
const usulanBot = (b: any) => usulanKe.fungsi(b);
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { opsionalKode?: string[]; orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; jenis?: string; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array } = {}): Halaman {
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
      for (const b of s.isian as Array<{ kode: string; opsional?: boolean }>) if ((p.opsionalKode ?? []).includes(b.kode)) b.opsional = true;
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${berkas}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") && !p.botMati ? nilaiDari(kode, kodeTanyaJawab(s)) : undefined, nilaiAda: Boolean(q.get("perkaraId")) && !p.botMati, nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/usulan")) {
      const b = JSON.parse(badan || "{}");
      if (b.sumber === "alasan-posita") return json({ ok: true, data: { available: true, alasanPosita: { ok: true, alasan: [] } } });
      usulanMinta.push(b);
      if (p.botMati) return json({ ok: false }, 503);
      return json({ ok: true, data: { available: true, saksiSdg: usulanBot(b) } });
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
const jawabEl = (h: Halaman, sisi: number, i: number) => q(h, `[data-sba="${i}"][data-sk="${sisi}"]`) as HTMLTextAreaElement;
const semuaJawab = (h: Halaman, sisi: number) => qq(h, `[data-sba][data-sk="${sisi}"]`) as HTMLTextAreaElement[];
const ketikJawab = (h: Halaman, el: HTMLTextAreaElement, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
};

// Jawaban rekaan bot: baris 0 = pasti (data), 1 = ragu + sumber, 2 = belum ada datanya, 3 = cukup, sisanya data.
function pasangBot(batas = 1000) {
  usulanKe.fungsi = (b: any) => {
    const buat = (sisi: number) =>
      (b.templat as Array<{ no: string; tanya: string; jawab: string }>).slice(0, batas).map((r, i) => {
        if (i === 2) return { no: r.no, tanya: r.tanya, jawab: "", belumTerisi: true };
        if (i === 1) return { no: r.no, tanya: r.tanya, jawab: `Menikah pada tanggal 17 November 2025 (saksi ${sisi + 1});`, yakin: "ragu", sumber: "tanggal nikah dibaca dari bukti akta, tidak tertulis jelas di gugatan" };
        if (i === 3) return { no: r.no, tanya: r.tanya, jawab: `Cukup yakin jawaban ${i} saksi ${sisi + 1};`, yakin: "cukup", sumber: "gugatan" };
        return { no: r.no, tanya: r.tanya, jawab: `Jawaban data ${i} saksi ${sisi + 1};`, yakin: "yakin", sumber: "SIPP" };
      });
    return { ok: true, saksi1: buat(0), saksi2: buat(1) };
  };
}
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
/** Replika statis untuk tangkapan layar (hanya bila ALETA_TANGKAP diisi). */
function simpanReplika(h: Halaman, nama: string) {
  const dir = process.env.ALETA_TANGKAP;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${nama}.html`), `<div id="aleta-bd-akar" data-tema="${akar(h).getAttribute("data-tema") || "gelap"}">${akar(h).innerHTML}</div>`, "utf8");
}
void readFileSync;
void simpanReplika;

const hitungAsalDom = (h: Halaman) => {
  const n: Record<string, number> = { data: 0, ragu: 0, kosong: 0, manual: 0 };
  for (const el of qq(h, "textarea[data-asal]")) n[el.getAttribute("data-asal") || ""] += 1;
  return n;
};
const teksRingkas = (h: Halaman) => (q(h, "#bd-asalringkas")?.textContent || "").replace(/\s+/g, " ").trim();
const angkaRingkas = (h: Halaman) => {
  const m = teksRingkas(h).match(/^(\d+) terisi · (\d+) ragu · (\d+) perlu dilengkapi$/);
  return m ? { terisi: Number(m[1]), ragu: Number(m[2]), kosong: Number(m[3]) } : null;
};
/** Versi dua dari bot: semua jawaban yang sudah terisi diberi akhiran, supaya jumlah yang berubah terukur. */
function pasangBotVersiDua(akhiran: string) {
  const dasar = usulanKe.fungsi;
  usulanKe.fungsi = (b: any) => {
    const r = dasar(b);
    const v2 = (daftar: any[]) => daftar.map((x) => (x.belumTerisi ? x : { ...x, jawab: `${x.jawab.replace(/;$/, "")} ${akhiran};` }));
    return { ...r, saksi1: v2(r.saksi1), saksi2: v2(r.saksi2) };
  };
}
const jumlahBerubah = (h: Halaman) => Number((q(h, "[data-skkal]")!.textContent || "").match(/^(\d+) jawaban akan berubah/)![1]);

// ============================================================================
// Fungsi murni (modul tampilan)
// ============================================================================
describe("modul tampilan saksi (murni): asal jawaban, hitungan, isian opsional, peringatan kosong, kalimat konfirmasi", () => {
  const T = () => require_("./blangko-derry-saksi-tampil.js") as any;

  it("asal baris mengikuti kontrak: kosong / ragu / data / manual", () => {
    const m = T();
    expect(m.asalBaris({ tanya: "a", jawab: "" })).toBe("kosong");
    expect(m.asalBaris({ tanya: "a", jawab: "   " })).toBe("kosong");
    expect(m.asalBaris({ tanya: "a", jawab: "Menikah pada ... di KUA" })).toBe("kosong");
    expect(m.asalBaris({ tanya: "a", jawab: "Menikah di …" })).toBe("kosong");
    expect(m.asalBaris({ tanya: "a", jawab: "Menikah di Palolo", otomatis: "Menikah di Palolo", usulan: { yakin: "ragu", sumber: "akta" } })).toBe("ragu");
    expect(m.asalBaris({ tanya: "a", jawab: "Menikah di Palolo", otomatis: "Menikah di Palolo", usulan: { yakin: "yakin", sumber: "SIPP" } })).toBe("data");
    expect(m.asalBaris({ tanya: "a", jawab: "Menikah di Palolo", otomatis: "Menikah di Palolo" })).toBe("data");
    // diubah petugas sesudah diusulkan -> manual, juga bila usulannya ragu
    expect(m.asalBaris({ tanya: "a", jawab: "Menikah di Sigi", otomatis: "Menikah di Palolo", usulan: { yakin: "ragu", sumber: "akta" } })).toBe("manual");
    // jawaban yang sudah ada di ABT (tanpa jejak otomatis) -> manual
    expect(m.asalBaris({ tanya: "a", jawab: "Ya, kenal" })).toBe("manual");
  });

  it("hitungan ringkasan menjumlahkan beberapa daftar dan mengabaikan baris yang sama sekali kosong", () => {
    const m = T();
    const a = [
      { tanya: "1", jawab: "x", otomatis: "x", usulan: { yakin: "yakin", sumber: "SIPP" } },
      { tanya: "2", jawab: "y", otomatis: "y", usulan: { yakin: "ragu", sumber: "akta" } },
      { tanya: "3", jawab: "..." },
      { tanya: "", jawab: "" },
    ];
    const b = [{ tanya: "1", jawab: "diketik" }, { tanya: "2", jawab: "" }];
    const h = m.hitungAsal([a, b]);
    expect(h).toMatchObject({ data: 1, ragu: 1, kosong: 2, manual: 1, terisi: 2, total: 5 });
    expect(m.ringkasAsal(h)).toBe("2 terisi · 1 ragu · 2 perlu dilengkapi");
  });

  it("tandaiUsulan menempelkan keyakinan hanya pada baris yang baru terisi", () => {
    const m = T();
    const sebelum = [{ tanya: "1", jawab: "..." }, { tanya: "2", jawab: "tetap" }];
    const res = { rows: [{ tanya: "1", jawab: "baru", otomatis: "baru" }, { tanya: "2", jawab: "tetap" }], terisi: 1 };
    const keluar = m.tandaiUsulan(sebelum, res, [{ jawab: "baru", yakin: "ragu", sumber: "dari akta" }, { jawab: "tetap", yakin: "yakin", sumber: "SIPP" }]);
    expect(keluar.rows[0].usulan).toEqual({ yakin: "ragu", sumber: "dari akta" });
    expect(keluar.rows[1].usulan).toBeUndefined();
  });

  it("isian opsional: penanda dari portal ATAU kode #9134; label #9134 menjelaskan fungsinya", () => {
    const m = T();
    expect(m.opsional({ kode: "9134", nama: "Bas permohonan" })).toBe(true);
    expect(m.opsional({ kode: "7777", nama: "x", opsional: true })).toBe(true);
    expect(m.opsional({ kode: "7777", nama: "x" })).toBe(false);
    expect(m.namaTampil({ kode: "9134", nama: "Bas permohonan" })).toBe("Petunjuk perbaikan permohonan (bila majelis memberi petunjuk)");
    expect(m.namaTampil({ kode: "7777", nama: "Nama Biasa" })).toBe("Nama Biasa");
  });

  it("peringatan daftar kosong: hanya bila sudah dicoba simpan DAN daftar masih kosong sekarang", () => {
    const m = T();
    expect(m.peringatanDaftarKosong("Saksi 1 Pemohon", [], false)).toBe("");
    expect(m.peringatanDaftarKosong("Saksi 1 Pemohon", [], true)).toMatch(/^Saksi 1 Pemohon: Daftar kosong tidak disimpan/);
    expect(m.peringatanDaftarKosong("Saksi 1 Pemohon", [{ tanya: "", jawab: "" }], true)).toMatch(/Daftar kosong/);
    expect(m.peringatanDaftarKosong("Saksi 1 Pemohon", Array.from({ length: 19 }, (_, i) => ({ tanya: `q${i}`, jawab: "" })), true)).toBe("");
  });

  it("kalimat konfirmasi: jumlah berubah dan tertahan; centang 'termasuk yang diketik' memindahkan tertahan ke berubah", () => {
    const m = T();
    const butir = [{ ubah: 7, tahan: 2 }, { ubah: 5, tahan: 1 }];
    expect(m.kalimatKonfirmasi(butir, false)).toMatchObject({ ubah: 12, tahan: 3 });
    expect(m.kalimatKonfirmasi(butir, false).kalimat).toBe("12 jawaban akan berubah; 3 jawaban yang sudah Anda ketik tertahan (tidak diubah).");
    expect(m.kalimatKonfirmasi(butir, true)).toMatchObject({ ubah: 15, tahan: 0, kalimat: "15 jawaban akan berubah." });
  });
});

// ============================================================================
// Butir 2: Tambah baris di bawah tabel
// ============================================================================
describe("Blangko Derry (20 Okt): Tambah baris di BAWAH tabel tanya jawab saksi", () => {
  it("Berdampingan dan Satu per satu: tombol ada sesudah baris terakhir, bukan di bilah atas; klik menambah satu baris", async () => {
    const h = bukaPP();
    pasangBot();
    await bukaSaksiDanMuat(h);
    const sesudah = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & 4); // b sesudah a
    // Berdampingan
    let tambah = q(h, '[data-bd2="tambahtj"]')!;
    expect(tambah, "tombol Tambah baris").not.toBeNull();
    expect(tambah.closest(".bd-tjkaki"), "di kaki tabel").not.toBeNull();
    expect(q(h, '.bd-tjalat:not(.bd-tjkaki) [data-bd2="tambahtj"]')).toBeNull();
    expect(sesudah(qq(h, ".bd-sbrow").pop()!, tambah)).toBe(true);
    expect(qq(h, '[data-bd2="tambahtj"]').length).toBe(1);
    const sebelum = qq(h, ".bd-sbrow").length;
    tambah.click();
    await sampai(() => qq(h, ".bd-sbrow").length === sebelum + 1, "baris bertambah");
    // Satu per satu
    klik(h, '[data-tjmode="satu"]');
    await sampai(() => q(h, ".bd-tjtabel table"), "tabel satu saksi");
    tambah = q(h, '[data-bd2="tambahtj"]')!;
    expect(tambah.closest(".bd-tjkaki")).not.toBeNull();
    expect(q(h, '.bd-tjalat:not(.bd-tjkaki) [data-bd2="tambahtj"]')).toBeNull();
    expect(sesudah(q(h, ".bd-tjtabel")!, tambah)).toBe(true);
    const baris = qq(h, ".bd-tjtabel tbody tr").length;
    tambah.click();
    await sampai(() => qq(h, ".bd-tjtabel tbody tr").length === baris + 1, "baris bertambah (satu per satu)");
    expect(q(h, '.bd-tjkaki [data-bd2="simpantj"]')).not.toBeNull();
  });
});

// ============================================================================
// Butir 3: Isi ulang dari data perkara + konfirmasi di halaman
// ============================================================================
describe("Blangko Derry (20 Okt): Isi ulang dari data perkara meminta persetujuan di halaman", () => {
  it("nama baru; tiap klik menampilkan konfirmasi (bukan confirm peramban) berisi jumlah berubah/tertahan; Batal tidak mengubah apa pun; ketikan dijaga", async () => {
    const h = bukaPP();
    let dialog = 0;
    h.w.confirm = () => {
      dialog += 1;
      return true;
    };
    pasangBot();
    await bukaSaksiDanMuat(h);
    const btn = q(h, '[data-bd2="isioto"]')!;
    expect(btn.textContent!.trim()).toBe("Isi ulang dari data perkara");
    expect(akar(h).textContent).not.toMatch(/Susun ulang jawaban/);
    const diketik = "Ketikan petugas sendiri tentang rumah tangga;";
    ketikJawab(h, jawabEl(h, 0, 5), diketik);
    const semua = () => [...semuaJawab(h, 0), ...semuaJawab(h, 1)].map((e) => e.value);
    const awal = semua();
    pasangBotVersiDua("versi dua");
    const minta0 = usulanMinta.length;
    btn.click();
    await sampai(() => q(h, "[data-skkonfirm]"), "konfirmasi tampil");
    expect(usulanMinta.length).toBe(minta0 + 1);
    expect(dialog, "tanpa confirm() peramban").toBe(0);
    expect(semua(), "belum ada yang berubah sebelum Lanjutkan").toEqual(awal);
    const kal = q(h, "[data-skkal]")!.textContent!;
    const m = kal.match(/^(\d+) jawaban akan berubah; (\d+) jawaban yang sudah Anda ketik tertahan/);
    expect(m, kal).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(10);
    expect(Number(m![2])).toBe(1);
    expect((q(h, '[data-bd2="tinjautimpa"]') as HTMLInputElement).checked).toBe(false);
    expect(q(h, "[data-skkonfirm]")!.textContent).toMatch(/termasuk yang sudah diketik \(1 jawaban\)/);
    // Batal
    klik(h, '[data-bd2="isiulangbatal"]');
    expect(q(h, "[data-skkonfirm]")).toBeNull();
    expect(semua()).toEqual(awal);
    // Klik lagi -> konfirmasi muncul LAGI (tiap klik); Lanjutkan tanpa centang: yang diketik tetap
    klik(h, '[data-bd2="isioto"]');
    await sampai(() => q(h, "[data-skkonfirm]"), "konfirmasi tampil lagi");
    klik(h, '[data-bd2="isiulangya"]');
    await sampai(() => !q(h, "[data-skkonfirm]") && /versi dua/.test(jawabEl(h, 0, 0).value), "jawaban diisi ulang");
    expect(jawabEl(h, 0, 5).value, "ketikan petugas dijaga").toBe(diketik);
    expect(dialog).toBe(0);
  });

  it("centang 'termasuk yang sudah diketik' menimpa ketikan petugas, dan hanya bila dicentang", async () => {
    const h = bukaPP();
    pasangBot();
    await bukaSaksiDanMuat(h);
    const diketik = "Ketikan petugas;";
    ketikJawab(h, jawabEl(h, 0, 4), diketik);
    pasangBotVersiDua("baru");
    klik(h, '[data-bd2="isioto"]');
    await sampai(() => q(h, "[data-skkonfirm]"), "konfirmasi");
    const tanpa = jumlahBerubah(h);
    klik(h, '[data-bd2="tinjautimpa"]');
    await sampai(() => (q(h, '[data-bd2="tinjautimpa"]') as HTMLInputElement)?.checked, "centang aktif");
    expect(jumlahBerubah(h)).toBe(tanpa + 1);
    expect(q(h, "[data-skkal]")!.textContent).not.toMatch(/tertahan/);
    klik(h, '[data-bd2="isiulangya"]');
    await sampai(() => !q(h, "[data-skkonfirm]") && / baru;$/.test(jawabEl(h, 0, 4).value), "ketikan ikut diganti");
    expect(jawabEl(h, 0, 4).value).not.toBe(diketik);
  });

  it("tanpa perubahan: konfirmasi memberi tahu dan Lanjutkan dinonaktifkan; server mati memberi kabar (bukan konfirmasi)", async () => {
    const h = bukaPP();
    pasangBot();
    await bukaSaksiDanMuat(h);
    klik(h, '[data-bd2="isioto"]'); // data sama dengan yang sudah terpasang
    await sampai(() => q(h, "[data-skkonfirm]"), "konfirmasi");
    expect(q(h, "[data-skkal]")!.textContent).toMatch(/^0 jawaban akan berubah/);
    expect(q(h, "[data-skkonfirm]")!.textContent).toMatch(/Tidak ada jawaban yang perlu berubah/);
    expect((q(h, '[data-bd2="isiulangya"]') as HTMLButtonElement).disabled).toBe(true);
    klik(h, '[data-bd2="isiulangbatal"]');
    usulanKe.fungsi = () => {
      throw new Error("bot mati");
    };
    klik(h, '[data-bd2="isioto"]');
    await sampai(() => /belum dapat disusun/.test(akar(h).textContent || ""), "kabar galat");
    expect(q(h, "[data-skkonfirm]")).toBeNull();
  });
});

// ============================================================================
// Butir 5: warna kotak jawaban menurut asal + ringkasan yang bisa diklik
// ============================================================================
describe("Blangko Derry (20 Okt): warna kotak jawaban saksi menurut asalnya", () => {
  it("kosong = kuning, ragu = oranye + lencana 'ragu' dengan alasan, data = tepi hijau, manual = netral; ringkasan cocok dengan kotak", async () => {
    const h = bukaPP();
    pasangBot();
    await bukaSaksiDanMuat(h);
    // baris 0 data, 1 ragu, 2 belum ada datanya, 3 cukup (data)
    for (const sisi of [0, 1]) {
      expect(jawabEl(h, sisi, 0).getAttribute("data-asal")).toBe("data");
      expect(jawabEl(h, sisi, 1).getAttribute("data-asal")).toBe("ragu");
      expect(jawabEl(h, sisi, 3).getAttribute("data-asal")).toBe("data");
      expect(jawabEl(h, sisi, 0).classList.contains("bd-asal-data")).toBe(true);
      expect(jawabEl(h, sisi, 1).classList.contains("bd-asal-ragu")).toBe(true);
      // baris 2: bot tidak punya datanya -> tetap titik-titik dari set pertanyaan -> kosong (kuning)
      expect(jawabEl(h, sisi, 2).value).toMatch(/\.\.\.|…|^$/);
      expect(jawabEl(h, sisi, 2).getAttribute("data-asal")).toBe("kosong");
      expect(jawabEl(h, sisi, 2).classList.contains("bd-asal-kosong")).toBe(true);
    }
    // Lencana 'ragu' + ⓘ dengan sumber usulan
    const ragu = jawabEl(h, 0, 1).nextElementSibling as HTMLElement;
    expect(ragu.hasAttribute("data-asalcap")).toBe(true);
    expect(ragu.textContent).toMatch(/^ragu/);
    const info = ragu.querySelector(".bd-asalinfo") as HTMLElement;
    expect(info.textContent).toBe("ⓘ");
    expect(info.getAttribute("title")).toBe("tanggal nikah dibaca dari bukti akta, tidak tertulis jelas di gugatan");
    // Lencana 'perlu dilengkapi' pada kosong; data tanpa lencana
    expect((jawabEl(h, 0, 2).nextElementSibling as HTMLElement).textContent).toBe("perlu dilengkapi");
    expect((jawabEl(h, 0, 0).nextElementSibling as HTMLElement).textContent).toBe("");
    // Ringkasan sama dengan hitungan kotak
    const n = hitungAsalDom(h);
    expect(n.ragu).toBeGreaterThanOrEqual(2);
    expect(n.kosong).toBeGreaterThanOrEqual(2);
    expect(angkaRingkas(h)).toEqual({ terisi: n.data + n.manual, ragu: n.ragu, kosong: n.kosong });
    // Manual: petugas mengetik pada kotak kosong -> netral, ringkasan ikut berubah tanpa menggambar ulang (fokus tetap)
    const kotak = jawabEl(h, 0, 2);
    kotak.focus();
    ketikJawab(h, kotak, "Tidak tahu persis, kira-kira dua tahun lalu;");
    expect(kotak.getAttribute("data-asal")).toBe("manual");
    expect(kotak.classList.contains("bd-asal-manual")).toBe(true);
    expect(kotak.classList.contains("bd-asal-kosong")).toBe(false);
    expect((kotak.nextElementSibling as HTMLElement).textContent).toBe("");
    expect(D_(h).activeElement).toBe(kotak);
    const n2 = hitungAsalDom(h);
    expect(n2.kosong).toBe(n.kosong - 1);
    expect(angkaRingkas(h)).toEqual({ terisi: n.data + n.manual + 1, ragu: n.ragu, kosong: n.kosong - 1 });
    // Mengetik titik-titik kembali -> kosong lagi; mengubah jawaban ragu -> manual (tidak ragu lagi)
    ketikJawab(h, kotak, "sekitar ... tahun");
    expect(kotak.getAttribute("data-asal")).toBe("kosong");
    ketikJawab(h, jawabEl(h, 0, 1), "Menikah 17 November 2025;");
    expect(jawabEl(h, 0, 1).getAttribute("data-asal")).toBe("manual");
    expect(hitungAsalDom(h).ragu).toBe(n.ragu - 1);
  });

  it("'perlu dilengkapi' dan 'ragu' pada ringkasan dapat diklik: melompat dan memfokuskan kotak BERIKUTNYA, lalu berputar", async () => {
    const h = bukaPP();
    pasangBot();
    await bukaSaksiDanMuat(h);
    const kosong = qq(h, 'textarea[data-asal="kosong"]');
    expect(kosong.length).toBeGreaterThanOrEqual(2);
    const lompat = q(h, '[data-bd2="lompat"][data-jenis="kosong"]')!;
    expect(lompat.textContent).toMatch(/^\d+ perlu dilengkapi$/);
    lompat.click();
    expect(D_(h).activeElement).toBe(kosong[0]);
    q(h, '[data-bd2="lompat"][data-jenis="kosong"]')!.click();
    expect(D_(h).activeElement).toBe(kosong[1]);
    for (let i = 2; i < kosong.length; i++) q(h, '[data-bd2="lompat"][data-jenis="kosong"]')!.click();
    q(h, '[data-bd2="lompat"][data-jenis="kosong"]')!.click(); // lewat yang terakhir -> kembali ke yang pertama
    expect(D_(h).activeElement).toBe(kosong[0]);
    // ragu
    const ragu = qq(h, 'textarea[data-asal="ragu"]');
    q(h, '[data-bd2="lompat"][data-jenis="ragu"]')!.click();
    expect(D_(h).activeElement).toBe(ragu[0]);
    q(h, '[data-bd2="lompat"][data-jenis="ragu"]')!.click();
    expect(D_(h).activeElement).toBe(ragu[1]);
    // Bila semua kosong sudah dilengkapi, bagian itu bukan tombol lagi
    for (const el of qq(h, 'textarea[data-asal="kosong"]')) ketikJawab(h, el as HTMLTextAreaElement, "diisi petugas;");
    expect(q(h, '[data-bd2="lompat"][data-jenis="kosong"]')).toBeNull();
    expect(teksRingkas(h)).toMatch(/ · 0 perlu dilengkapi$/);
  });

  it("Satu per satu: kotak jawaban juga berwarna dan ringkasan hanya menghitung saksi yang tampil", async () => {
    const h = bukaPP();
    pasangBot();
    await bukaSaksiDanMuat(h);
    const berdampingan = angkaRingkas(h)!;
    klik(h, '[data-tjmode="satu"]');
    await sampai(() => q(h, ".bd-tjtabel table"), "tabel satu saksi");
    const kotak = qq(h, ".bd-tjtabel textarea[data-sisi='jawab']");
    expect(kotak.length).toBeGreaterThan(10);
    expect(kotak.every((k) => ["data", "ragu", "kosong", "manual"].includes(k.getAttribute("data-asal") || ""))).toBe(true);
    expect(kotak[1].classList.contains("bd-asal-ragu")).toBe(true);
    expect(kotak[2].classList.contains("bd-asal-kosong")).toBe(true);
    const satu = angkaRingkas(h)!;
    expect(satu.ragu * 2).toBe(berdampingan.ragu);
    expect(satu.kosong * 2).toBe(berdampingan.kosong);
    // tekan ringkasan -> fokus ke kotak di tabel
    q(h, '[data-bd2="lompat"][data-jenis="ragu"]')!.click();
    expect(D_(h).activeElement).toBe(kotak[1]);
  });

  it("tema gelap dan terang: warna asal ada di kedua tema dan terang berbeda dari gelap; kosong memakai kuning, ragu oranye", () => {
    const css = readFileSync(path.join(EKSTENSI, "blangko-derry.css"), "utf8");
    const gelap = css.match(/#aleta-bd-akar \{\s*--asal-kosong-bg: ([^;]+); --asal-kosong-ln: ([^;]+); --asal-ragu-bg: ([^;]+); --asal-ragu-ln: ([^;]+); --asal-data-ln: ([^;]+);/);
    const terang = css.match(/\[data-tema="terang"\] \{\s*--asal-kosong-bg: ([^;]+); --asal-kosong-ln: ([^;]+); --asal-ragu-bg: ([^;]+); --asal-ragu-ln: ([^;]+); --asal-data-ln: ([^;]+);/);
    expect(gelap, "token gelap").not.toBeNull();
    expect(terang, "token terang").not.toBeNull();
    expect(gelap!.slice(1)).not.toEqual(terang!.slice(1));
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.trim().slice(i, i + 2), 16));
    for (const t of [gelap!, terang!]) {
      const [r, g, b] = rgb(t[2]); // garis kuning: merah & hijau tinggi, biru rendah
      expect(r).toBeGreaterThan(180);
      expect(g).toBeGreaterThan(120);
      expect(b).toBeLessThan(110);
      const [r2, g2, b2] = rgb(t[4]); // garis oranye: merah tinggi, hijau di tengah, biru rendah
      expect(r2).toBeGreaterThan(200);
      expect(g2).toBeLessThan(g + 1);
      expect(b2).toBeLessThan(110);
    }
  });
});

// ============================================================================
// Butir 6: isian opsional (#9134) di bagian tertutup "Isian tambahan (bila ada)"
// ============================================================================
describe("Blangko Derry (20 Okt): isian opsional keluar dari 'Perlu diisi'", () => {
  const dalamPerlu = (h: Halaman) => qq(h, "#bd-perlu > [data-f]").map((e) => e.getAttribute("data-f"));
  const hitunganPerlu = (h: Halaman) => {
    const teks = q(h, "#bd-progres")?.textContent || "";
    const m = teks.match(/(\d+) dari (\d+) terisi/);
    return m ? { terisi: Number(m[1]), dari: Number(m[2]) } : teks.startsWith("Semua terisi") ? { terisi: -1, dari: -1 } : null;
  };

  for (const mode of ["penanda opsional dari portal", "cadangan: kode 9134 tanpa penanda"]) {
    it(`#9134 (${mode}) tidak ada di 'Perlu diisi', ada di 'Isian tambahan (bila ada)' tertutup dengan label jelas, dan tidak ikut hitungan`, async () => {
      const h = bukaPP({ opsionalKode: mode.startsWith("penanda") ? ["9134"] : [] });
      await pilihBas(h);
      expect(dalamPerlu(h)).not.toContain("9134");
      const bagian = q(h, "details#bd-tambahan") as HTMLDetailsElement;
      expect(bagian, "bagian Isian tambahan").not.toBeNull();
      expect(bagian.open).toBe(false);
      expect(bagian.querySelector("summary")!.textContent).toMatch(/^Isian tambahan \(bila ada\)/);
      const kotak = bagian.querySelector('[data-f="9134"]') as HTMLElement;
      expect(kotak, "kotak 9134 di bagian tambahan").not.toBeNull();
      expect(kotak.querySelector("label")!.textContent).toBe("Petunjuk perbaikan permohonan (bila majelis memberi petunjuk)");
      expect(akar(h).textContent).not.toMatch(/Bas permohonan/);
      // Hitungan: pembagi = jumlah kartu yang benar-benar wajib (9134 tidak ikut)
      // Pembanding: blangko yang sama TANPA penanda 9134 sama sekali harus memberi hitungan yang sama.
      const hit = hitunganPerlu(h);
      expect(hit, q(h, "#bd-progres")?.textContent || "").not.toBeNull();
      const i9134 = PENANDA_BAS.indexOf("9134");
      PENANDA_BAS.splice(i9134, 1);
      try {
        const h0 = bukaPP();
        await pilihBas(h0);
        expect(q(h0, '[data-f="9134"]')).toBeNull();
        expect(hitunganPerlu(h0)).toEqual(hit);
        expect(dalamPerlu(h0)).toEqual(dalamPerlu(h));
      } finally {
        PENANDA_BAS.splice(i9134, 0, "9134");
      }
    });
  }

  it("hitungan 'N dari M' sama dengan blangko yang tidak punya #9134 sama sekali: mengisi #9134 tidak mengubah hitungan; bagian terbuka sendiri bila sudah berisi", async () => {
    const h = bukaPP();
    await pilihBas(h);
    const sebelum = hitunganPerlu(h)!;
    const bagian = q(h, "details#bd-tambahan") as HTMLDetailsElement;
    expect(bagian.open).toBe(false);
    const isianPerlu = dalamPerlu(h);
    // petugas mengisi 9134
    bagian.open = true;
    const ta = bagian.querySelector('[data-f="9134"] textarea, [data-f="9134"] input') as HTMLInputElement;
    expect(ta).not.toBeNull();
    ketik(h, ta, "Majelis memberi petunjuk: lengkapi identitas pemohon.");
    await tunggu(30);
    expect(hitunganPerlu(h)).toEqual(sebelum);
    expect(dalamPerlu(h)).toEqual(isianPerlu);
    // dibuka ulang dari awal dengan 9134 sudah berisi di ABT -> bagian terbuka sendiri
    const h2 = bukaPP({ abtAwal: { "9134": "Petunjuk majelis yang sudah ada." } });
    await pilihBas(h2);
    expect((q(h2, "details#bd-tambahan") as HTMLDetailsElement).open).toBe(true);
    expect(dalamPerlu(h2)).not.toContain("9134");
  });

  it("bagian tertutup dapat dibuka dan ditutup petugas lewat judulnya", async () => {
    const h = bukaPP();
    await pilihBas(h);
    const bagian = q(h, "details#bd-tambahan") as HTMLDetailsElement;
    klik(h, "#bd-tambahan > summary");
    expect((q(h, "details#bd-tambahan") as HTMLDetailsElement).open).toBe(true);
    klik(h, "#bd-tambahan > summary");
    expect((q(h, "details#bd-tambahan") as HTMLDetailsElement).open).toBe(false);
    expect(bagian.isConnected).toBe(true);
  });
});

// ============================================================================
// Butir 7: kepala panel menempel (padat, ramping, bayangan, di atas kartu)
// ============================================================================
describe("Blangko Derry (20 Okt): kepala panel menempel saat digulir", () => {
  const css = readFileSync(path.join(EKSTENSI, "blangko-derry.css"), "utf8");
  const gayaHitung = async (tema: "gelap" | "terang") => {
    const h = bukaPP();
    await sampaiPerkara(h);
    akar(h).setAttribute("data-tema", tema);
    const gaya = D_(h).createElement("style");
    gaya.textContent = css;
    D_(h).head.appendChild(gaya);
    const atas = q(h, ".bd-layar > .bd-atas")!;
    return { h, gs: h.w.getComputedStyle(atas) as CSSStyleDeclaration, atas };
  };

  for (const tema of ["gelap", "terang"] as const) {
    it(`tema ${tema}: sticky, latar padat (bukan transparan, bukan gradasi), bayangan bawah tipis, z-index di atas kartu, ramping`, async () => {
      const { gs } = await gayaHitung(tema);
      expect(gs.position).toBe("sticky");
      expect(Number(gs.zIndex)).toBeGreaterThanOrEqual(30);
      expect(gs.backgroundImage).toBe("none");
      expect(gs.backgroundColor).toMatch(/^(#[0-9a-f]{6}|rgb\(\d+, \d+, \d+\))$/i); // tanpa alfa
      expect(gs.boxShadow).toMatch(/\d+px/);
      expect(gs.boxShadow).toMatch(/0 2px 6px|0px 2px 6px/);
      const pad = parseFloat(gs.paddingTop);
      expect(pad).toBeLessThanOrEqual(6); // ramping
    });
  }

  it("kepala menempel di tepi layar, bukan di bawah padding akar (isi yang digulir tidak bocor di atas kepala)", () => {
    // Akar punya padding atas 12px (layar lebar) dan 0 (<=760px); kepala sticky memakai top negatif sebesar itu.
    const padAkar = css.match(/#aleta-bd-akar \{ padding: (\d+)px \d+px \d+px; \}/)![1];
    const pad = css.match(/--bd-pad-atas: (\d+)px;/)![1];
    expect(pad).toBe(padAkar);
    expect(css).toMatch(/\.bd-layar > \.bd-atas \{\s*position: sticky; top: calc\(var\(--bd-pad-atas\) \* -1\);/);
    expect(css).toMatch(/@media \(max-width: 760px\) \{ #aleta-bd-akar \{ --bd-pad-atas: 0px; \} \}/);
    expect(css).toMatch(/@media \(max-width: 760px\) \{\s*#aleta-bd-akar \{ padding: 0 0 40px; \}/);
  });

  it("kartu isian, kotak jawaban dan bagian tahap punya scroll-margin supaya tidak tertutup kepala; media sempit tidak memakai baris yang melebar", () => {
    expect(css).toMatch(/\.bd-tahap, #aleta-bd-akar \.bd-f, #aleta-bd-akar textarea\.bd-ed \{ scroll-margin-top: calc\(var\(--bd-tinggi-atas\)/);
    expect(css).toMatch(/scroll-padding-top: calc\(var\(--bd-tinggi-atas\)/);
    const sempit = css.slice(css.indexOf("@media (max-width: 640px) {\n  #aleta-bd-akar .bd-layar > .bd-atas"));
    expect(sempit).toMatch(/flex-direction: column/);
    expect(sempit).toMatch(/overflow-x: auto/); // deretan tombol tergulir ke samping, tidak menambah tinggi kepala
    // z-index kepala lebih besar dari semua lapisan non-overlay di dalam panel (menu Lainnya z-index 30, tahap/kartu tanpa z-index)
    const zKepala = Number(css.match(/\.bd-layar > \.bd-atas \{\s*position: sticky; top: calc\(var\(--bd-pad-atas\) \* -1\); z-index: (\d+)/)![1]);
    const menu = Number(css.match(/\.bd-lainnyamenu \{[^}]*z-index: (\d+)/)![1]);
    expect(zKepala).toBeGreaterThan(menu);
  });

  it("tinggi kepala dilaporkan ke CSS (--bd-tinggi-atas) lewat pengamat ukuran bila ada", async () => {
    const h = bukaPP();
    const w = h.w as any;
    let diamati = 0;
    w.ResizeObserver = class {
      constructor(public f: () => void) {}
      observe() {
        diamati += 1;
        this.f();
      }
    };
    await sampaiPerkara(h);
    expect(diamati).toBe(1);
    expect(akar(h).style.getPropertyValue("--bd-tinggi-atas")).toMatch(/^\d+(\.\d+)?px$/);
  });
});

// ============================================================================
// Butir 9: peringatan 'Daftar kosong tidak disimpan' tidak dobel / tidak tertinggal
// ============================================================================
describe("Blangko Derry (20 Okt): peringatan daftar kosong", () => {
  const peringatan = (h: Halaman) => qq(h, "[data-kosongsimpan]");

  it("muncul hanya saat disimpan dalam keadaan kosong, satu per saksi; hilang begitu daftar terisi dan tidak kembali sendiri", async () => {
    const h = bukaPP();
    pasangBot();
    await pilihBas(h);
    klik(h, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h, '[data-bd2="simpantj"]') && !(q(h, '[data-bd2="simpantj"]') as HTMLButtonElement).disabled, "daftar saksi terbaca");
    expect(qq(h, "[data-sba]").length).toBe(0);
    expect(peringatan(h).length).toBe(0); // belum dicoba simpan -> tidak ada peringatan
    expect(akar(h).textContent).not.toMatch(/Daftar kosong tidak disimpan/);
    klik(h, '[data-bd2="simpantj"]');
    await sampai(() => peringatan(h).length > 0, "peringatan setelah simpan kosong");
    // Berdampingan = dua saksi, masing-masing SATU peringatan, dengan nama saksinya
    expect(peringatan(h).length).toBe(2);
    expect(new Set(peringatan(h).map((e) => e.getAttribute("data-kosongsimpan"))).size).toBe(2);
    expect(peringatan(h).every((e) => /^Saksi [12] .+: Daftar kosong tidak disimpan/.test(e.textContent || ""))).toBe(true);
    expect((akar(h).textContent!.match(/Daftar kosong tidak disimpan/g) || []).length).toBe(2);
    expect(h.minta.filter((m) => /tanyajawab_perkara_edit\?.*aksi=simpan/.test(m.url)).length).toBe(0); // tidak menulis ke ABT
    // Klik simpan lagi: tetap satu per saksi (tidak bertambah)
    klik(h, '[data-bd2="simpantj"]');
    await tunggu(30);
    expect(peringatan(h).length).toBe(2);
    // Muat set pertanyaan -> daftar terisi -> peringatan hilang
    const sel = (await sampai(() => q(h, '#bd-muattpl optgroup[label^="Panduan"]') && q(h, "#bd-muattpl"), "panduan set")) as HTMLSelectElement;
    sel.value = "aleta:cerai-F";
    klik(h, '[data-bd2="muattpl"]');
    await sampai(() => qq(h, "[data-sba]").length >= 15, "daftar terisi");
    expect(peringatan(h).length).toBe(0);
    expect(akar(h).textContent).not.toMatch(/Daftar kosong tidak disimpan/);
    // Mengosongkan daftar sesudahnya TIDAK memunculkan peringatan lama; hanya percobaan simpan baru
    let sisa = qq(h, "[data-sbhapus]").length;
    while (sisa-- > 0 && q(h, '[data-sbhapus="0"]')) klik(h, '[data-sbhapus="0"]');
    await tunggu(30);
    expect(qq(h, "[data-sba]").length).toBe(0);
    expect(peringatan(h).length).toBe(0);
    klik(h, '[data-bd2="simpantj"]');
    await sampai(() => peringatan(h).length === 2, "peringatan baru setelah simpan kosong lagi");
  });
});

void hitungAsalDom;

// ============================================================================
// Tangkapan layar (hanya bila ALETA_TANGKAP diisi): replika HTML hasil render jsdom, difoto lewat skrip Playwright terpisah.
// ALETA_EKSTENSI_DIR menunjuk folder ekstensi-sipp versi LAMA untuk foto "sebelum". Jalankan dengan -t "tangkapan".
// ============================================================================
describe.skipIf(!process.env.ALETA_TANGKAP)("tangkapan layar tanya jawab saksi", () => {
  const simpanDuaTema = (h: Halaman, nama: string) => {
    for (const tema of ["gelap", "terang"]) {
      akar(h).setAttribute("data-tema", tema);
      simpanReplika(h, `${nama}-${tema}`);
    }
  };
  it("saksi berdampingan (warna asal, ringkasan, Tambah baris di bawah)", async () => {
    const h = bukaPP();
    pasangBot();
    await bukaSaksiDanMuat(h);
    simpanDuaTema(h, "1-saksi-berdampingan");
  });
  it("Isi ulang dari data perkara", async () => {
    const h = bukaPP();
    pasangBot();
    await bukaSaksiDanMuat(h);
    pasangBotVersiDua("dengan data terbaru");
    klik(h, '[data-bd2="isioto"]');
    await sampai(() => q(h, "[data-skkonfirm]") || (/dengan data terbaru/.test(akar(h).innerHTML) && !/Menyusun jawaban dari data perkara/.test(akar(h).textContent || "")), "konfirmasi (baru) atau hasil terpasang (lama)");
    simpanDuaTema(h, "2-isi-ulang");
  });
  it("bagian Perlu diisi pada BAS (isian #9134)", async () => {
    const h = bukaPP({ opsionalKode: ["9134"] });
    await pilihBas(h);
    simpanDuaTema(h, "3-perlu-diisi");
  });
  it("peringatan daftar kosong sesudah daftar terisi", async () => {
    const h = bukaPP();
    pasangBot();
    await pilihBas(h);
    klik(h, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h, '[data-bd2="simpantj"]') && !(q(h, '[data-bd2="simpantj"]') as HTMLButtonElement).disabled, "daftar terbaca");
    klik(h, '[data-bd2="simpantj"]');
    await sampai(() => /Daftar kosong tidak disimpan/.test(akar(h).textContent || ""), "peringatan");
    const sel = (await sampai(() => q(h, '#bd-muattpl optgroup[label^="Panduan"]') && q(h, "#bd-muattpl"), "panduan set")) as HTMLSelectElement;
    sel.value = "aleta:cerai-F";
    klik(h, '[data-bd2="muattpl"]');
    await sampai(() => qq(h, "[data-sba]").length >= 15, "daftar terisi");
    await tunggu(100);
    simpanDuaTema(h, "5-peringatan-kosong");
  });
});
