// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - TANYA JAWAB SAKSI BLANGKO DERRY MENURUT KATALOG JENIS PERKARA
 * ============================================================================
 *
 * Keluhan: pada perkara itsbat nikah, pilihan "Yang diketahui saksi" berisi pilihan perkara CERAI ("Tahu seluruh alasan,
 * melihat sendiri", ...) dan nama saksi tertulis "Saksi 1 Penggugat" padahal permohonan.
 *
 * Dijaga (blangko-derry-katalog.js + blangko-derry-isian.js dijalankan SUNGGUHAN di jsdom bersama portal susun.ts):
 *   1. itsbat memakai pilihan KATALOG itsbat (peran saksi pada pernikahan, tingkat pengetahuan), bukan pilihan cerai;
 *   2. cerai (346/347) tetap panel lama; jenis lain yang punya katalog (dispensasi kawin) memakai katalog;
 *   3. sebutan "Saksi 1 Pemohon" menurut NOMOR alur/jenis, juga bila portal/singgahan masih menulis Penggugat;
 *   4. susunan pertanyaan mengikuti keadaan terpilih dan berubah saat pilihan berubah;
 *   5. baris yang diketik petugas bertahan;
 *   6. pengetahuan dipilih per saksi dan hanya mengubah jawaban saksi itu.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import { tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

const require_ = createRequire(path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"));
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "saksi-katalog.js", "saksi-katalog-data.js", "blangko-derry-saksi.js", "blangko-derry-katalog.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; tj: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; pdfRtf: string[]; opsi: BukaOpsi };
const terbuka: JSDOM[] = [];
const usulanMinta: any[] = [];
const usulanAlasan: any[] = [];
const penanganBot = async (_b: unknown) => ({ status: 503, json: { ok: false } as unknown });
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type BukaOpsi = { orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; jenis?: string; alur?: number; nomor?: string; jumlahP?: number; portalLama?: boolean; tjAwal?: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array };
function buka(p: BukaOpsi = {}): Halaman {
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
  const tj: Halaman["tj"] = { "5058": polos(p.tjAwal?.["5058"] ?? []), "5059": polos(p.tjAwal?.["5059"] ?? []) };
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
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos(DAFTAR.map((d) => ({ ...d, ...(p.jenis ? { jenisPerkara: p.jenis } : {}), ...(p.alur ? { alurPerkaraId: p.alur } : {}), ...(p.nomor ? { nomorPerkara: `${p.nomor}/PA.Dgl` } : {}), ...(p.jumlahP ? { pihak: { penggugat: Array.from({ length: p.jumlahP }, (_, i) => `Pemohon ${i + 1}`), tergugat: [] } } : {}) }))) } });
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
      // Portal lama (atau susunan singgahan): nama saksi tetap "Penggugat"/"Tergugat" - ekstensi harus meluruskannya.
      if (p.portalLama) for (const b of s.isian) if (b.tj) b.tj.sebutan = b.tj.sebutan.replace(/Pemohon/, "Penggugat").replace(/Termohon/, "Tergugat");
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
  klik(h, `[data-pk="${h.opsi.nomor || "581/Pdt.G/2026"}/PA.Dgl"]`);
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
const qd = (h: Halaman, s: string) => Array.from(akar(h).querySelectorAll(s)) as HTMLElement[];
const nilaiTa = (el: Element) => (el as HTMLTextAreaElement).value;
const semuaTanya = (h: Halaman) => qd(h, "[data-sbq]").map(nilaiTa);
const semuaJawab = (h: Halaman, sisi: number) => qd(h, `[data-sba][data-sk="${sisi}"]`).map(nilaiTa);
const pilihOpsi = (h: Halaman, kunci: string, bidang: string, nilai: string) => {
  const el = q(h, `[data-skkunci="${kunci}"][data-skfld="${bidang}"]`) as HTMLSelectElement;
  if (!el) throw new Error(`tidak ada pilihan ${kunci} ${bidang}`);
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("change", { bubbles: true }));
};
const opsiDari = (h: Halaman, kunci: string, bidang: string) => Array.from((q(h, `[data-skkunci="${kunci}"][data-skfld="${bidang}"]`) as HTMLSelectElement).options).map((o) => ({ nilai: o.value, label: o.textContent || "" }));
const JENIS_ITSBAT = { jenis: "Pengesahan Perkawinan/Istbat Nikah", alur: 16, nomor: "228/Pdt.P/2026", jumlahP: 2 };
async function bukaSaksi(p: BukaOpsi, tunggu = true) {
  const h = buka({ orang: "pp", ...p });
  await pilihBas(h);
  klik(h, '[data-tj="saksi 1 p"]');
  await sampai(() => q(h, '[data-skkartu="saksi 2 p"]') || q(h, '[data-skkartu="saksi 1 p"]') || q(h, ".bd-skpanel"), "panel pengetahuan tergambar");
  if (tunggu) await sampai(() => qd(h, "[data-sbq]").length >= 10, "pertanyaan tersusun");
  return h;
}

// ============================================================================
// Modul murni
// ============================================================================
const E = path.resolve(process.cwd(), "../ekstensi-sipp");
const muat = () => {
  const g = globalThis as unknown as { AletaSaksiKatalog?: unknown };
  g.AletaSaksiKatalog = require_(path.join(E, "saksi-katalog.js"));
  require_(path.join(E, "saksi-katalog-data.js"));
  return require_(path.join(E, "blangko-derry-katalog.js"));
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mod = any;
const ITS = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", jenisPerkaraId: "360", alurPerkaraId: "16", nomorPerkara: "228/Pdt.P/2026/PA.Dgl" };

describe("blangko-derry-katalog.js (murni)", () => {
  it("mengenali mode menurut NOMOR jenis: cerai tetap lama, itsbat dan dispensasi katalog, jenis tanpa katalog bukan cerai", () => {
    const K: Mod = muat();
    expect(K.kenali(ITS)).toMatchObject({ mode: "katalog", kunci: "itsbat-nikah", jenisId: "360", alurId: "16" });
    expect(K.kenali({ jenisPerkara: "Cerai Gugat", jenisPerkaraId: "347", alurPerkaraId: "15" }).mode).toBe("cerai");
    expect(K.kenali({ jenisPerkara: "Cerai Talak", nomorPerkara: "1/Pdt.G/2026/PA.Dgl" }).mode).toBe("cerai");
    expect(K.kenali({ jenisPerkara: "Dispensasi Kawin", alurPerkaraId: "16" })).toMatchObject({ mode: "katalog", jenisId: "362" });
    expect(K.kenali({ jenisPerkara: "Jenis Contoh Tanpa Katalog", jenisPerkaraId: "999", alurPerkaraId: "16" }).mode).toBe("tanpa");
    // nama SIPP ("Istbat") dikenali tanpa nomor jenis
    expect(K.kenali({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah" }).kunci).toBe("itsbat-nikah");
    // jenis belum terbaca sama sekali: panel lama (aman), bukan katalog tebakan
    expect(K.kenali({}).mode).toBe("cerai");
  });

  it("sebutan pihak sama dengan portal (sebutan-pihak.ts) menurut nomor alur/jenis untuk semua kombinasi yang dipakai", () => {
    const K: Mod = muat();
    const kasus = [
      { alurPerkaraId: 16, jenisPerkaraId: 360, jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah" },
      { alurPerkaraId: 15, jenisPerkaraId: 360, jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah" },
      { alurPerkaraId: 15, jenisPerkaraId: 347, jenisPerkara: "Cerai Gugat" },
      { alurPerkaraId: 15, jenisPerkaraId: 346, jenisPerkara: "Cerai Talak" },
      { alurPerkaraId: 15, jenisPerkaraId: 341, jenisPerkara: "Izin Poligami" },
      { alurPerkaraId: 16, jenisPerkaraId: 362, jenisPerkara: "Dispensasi Kawin" },
      { alurPerkaraId: 16, jenisPerkaraId: 363, jenisPerkara: "Wali Adhol" },
      { alurPerkaraId: 15, jenisPerkaraId: 364, jenisPerkara: "Kewarisan" },
      { alurPerkaraId: 123, jenisPerkaraId: 0, jenisPerkara: "" },
    ];
    for (const k of kasus) {
      const a = K.sebutanPihak(k);
      const b = sebutanPihakPerkara({ alurPerkaraId: k.alurPerkaraId, jenisPerkaraId: k.jenisPerkaraId || null, jenisPerkaraNama: k.jenisPerkara });
      expect([a.P, a.T, a.surat], JSON.stringify(k)).toEqual([b.satu, b.dua, b.surat]);
    }
    // permohonan bernomor /Pdt.G/ (cerai talak) tetap Pemohon; gugatan itsbat bernomor /Pdt.G/ tetap Penggugat
    expect(K.sebutanPihak({ jenisPerkara: "Cerai Talak", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" }).P).toBe("Pemohon");
    expect(K.sebutanPihak({ alurPerkaraId: 15, jenisPerkaraId: "360", nomorPerkara: "1/Pdt.G/2026/PA.Dgl" }).P).toBe("Penggugat");
    // ejaan SIPP "Istbat" (bukan "itsbat") tanpa nomor: permohonan lewat nama jenis
    expect(K.sebutanPihak({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah" }).P).toBe("Pemohon");
    expect(K.namaSaksi("saksi 1 p", { P: "Pemohon", T: "Termohon" })).toBe("Saksi 1 Pemohon");
    expect(K.namaSaksi("saksi 2 t", { P: "Pemohon", T: "Termohon" })).toBe("Saksi 2 Termohon");
  });

  it("itsbat: keadaan berlabel jelas (bentuk dari data, peran saksi per saksi) dan pilihan pengetahuan dari katalog, bukan cerai", () => {
    const K: Mod = muat();
    const kn = K.kenali(ITS);
    const dat = K.keadaanDariData(kn.kat, { alurId: kn.alurId, jumlahPemohon: 2, teksBlangko: "BAS" });
    expect(dat).toEqual({ keadaan: { bentuk: "permohonan-berdua" }, dariData: ["bentuk"] });
    const ker = K.lengkapiBawaan(kn.kat, dat.keadaan);
    const bidang = K.bidangKeadaan(kn.kat, ker, kn.sebutan, dat.dariData);
    const bentuk = bidang.find((b: Mod) => b.kunci === "bentuk");
    expect(bentuk.dariData).toBe(true);
    expect(bentuk.terpilih).toEqual(["permohonan-berdua"]);
    const peran = bidang.find((b: Mod) => b.kunci === "kedudukanSaksi");
    expect(peran.perSaksi).toBe(true);
    expect(peran.label).toBe("Peran saksi pada pernikahan itu");
    expect(peran.nilai.map((n: Mod) => n.nilai)).toEqual(["hadir-biasa", "wali-nikah", "saksi-nikah", "penghulu"]);
    expect(peran.nilai.map((n: Mod) => n.label).join(" | ")).not.toMatch(/-/);
    const pil = K.pilihanPengetahuan(kn.kat, { ...ker, pihakSaksi: "P" }, "P", K.tingkatDipakai(false)).map((x: Mod) => x.nilai);
    expect(pil).toEqual(["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"]);
    // tidak satu pun pilihan cerai
    expect(pil).not.toContain("sama");
    expect(pil).not.toContain("tidak-melihat");
    // gugatan itsbat menampilkan kehadiran Tergugat; permohonan tidak
    expect(bidang.map((b: Mod) => b.kunci)).not.toContain("kehadiran");
    const gug = K.bidangKeadaan(kn.kat, { ...ker, bentuk: "gugatan" }, kn.sebutan, []);
    expect(gug.map((b: Mod) => b.kunci)).toContain("kehadiran");
  });

  it("susunan pertanyaan mengikuti keadaan (bentuk perkara), nama saksi 'Saksi 1 Pemohon', peran saksi mengubah jawaban saksi itu saja", () => {
    const K: Mod = muat();
    const kn = K.kenali(ITS);
    const ker = K.lengkapiBawaan(kn.kat, { bentuk: "permohonan-berdua" });
    const dua = [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }];
    const a = K.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: "228", keadaan: ker, saksi: dua });
    expect(a.saksi.map((s: Mod) => s.nama)).toEqual(["Saksi 1 Pemohon", "Saksi 2 Pemohon"]);
    expect(a.saksi[0].baris.length).toBeGreaterThanOrEqual(15);
    expect(a.saksi[0].baris.every((b: Mod) => /^itsbat-nikah\/q-in-[a-z-]+-pb\/melihat$/.test(b.kunciJawaban))).toBe(true);
    const sendiri = K.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: "228", keadaan: { ...ker, bentuk: "permohonan-sendiri" }, saksi: dua });
    const idA = a.saksi[0].baris.map((b: Mod) => b.butir);
    const idB = sendiri.saksi[0].baris.map((b: Mod) => b.butir);
    expect(idB).not.toEqual(idA);
    expect(idB.some((i: string) => idA.includes(i))).toBe(false); // seluruh set berganti (pb -> pm)
    expect(a.saksi[0].baris[0].tanya).toMatch(/Pemohon I dan Pemohon II/);
    // peran saksi 1 = wali nikah: jawaban saksi 1 berubah, saksi 2 tidak
    const wali = K.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: "228", keadaan: ker, saksi: [{ ...dua[0], keadaan: { kedudukanSaksi: "wali-nikah" } }, dua[1]] });
    const jawab = (s: Mod, i: number) => s.saksi[i].baris.map((b: Mod) => b.jawab);
    expect(jawab(wali, 0)).not.toEqual(jawab(a, 0));
    expect(jawab(wali, 1)).toEqual(jawab(a, 1));
    // tingkat pengetahuan: jawaban saksi yang tahu dari cerita berbeda dari yang melihat sendiri
    const cerita = K.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: "228", keadaan: ker, saksi: [{ ...dua[0], jenis: "de-auditu", sumber: "keluarga" }, dua[1]] });
    expect(jawab(cerita, 0)).not.toEqual(jawab(a, 0));
    expect(jawab(cerita, 1)).toEqual(jawab(a, 1));
    expect(cerita.saksi[0].baris.some((b: Mod) => b.kunciJawaban.endsWith("/de-auditu"))).toBe(true);
  });

  it("gabung: ketikan petugas bertahan, jawaban dasar diganti, baris yang tak berlaku lagi dibuang, baris tambahan petugas tetap", () => {
    const K: Mod = muat();
    const kn = K.kenali(ITS);
    const ker = K.lengkapiBawaan(kn.kat, { bentuk: "permohonan-berdua" });
    const dua = [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }];
    const a = K.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: "228", keadaan: ker, saksi: dua }).saksi[0].baris;
    const awal = K.gabung([], a).rows;
    expect(awal.length).toBe(a.length);
    expect(awal[0]).toMatchObject({ butir: a[0].butir, dasar: a[0].jawab });
    // petugas mengetik satu jawaban dan menambah satu baris sendiri
    const lama = awal.map((r: Mod) => ({ ...r }));
    lama[1].jawab = "Diketik sendiri oleh petugas tentang maksud pemohon.";
    lama.splice(3, 0, { no: "x", tanya: "Pertanyaan tambahan petugas?", jawab: "Jawaban tambahan petugas." });
    const baru = K.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: "228", keadaan: { ...ker, bentuk: "permohonan-sendiri" }, saksi: dua }).saksi[0].baris;
    const g = K.gabung(lama, baru);
    const teks = g.rows.map((r: Mod) => r.jawab);
    expect(teks).toContain("Diketik sendiri oleh petugas tentang maksud pemohon.");
    expect(teks).toContain("Jawaban tambahan petugas.");
    expect(g.dibuang).toBeGreaterThan(10); // pertanyaan pb yang belum diketik tidak berlaku lagi
    expect(g.baru).toBeGreaterThanOrEqual(baru.length - 2);
    expect(g.rows.some((r: Mod) => r.butir === baru[0].butir)).toBe(true);
    // jawaban kosong/titik-titik bukan ketikan
    expect(K.diketikPetugas({ jawab: "..." })).toBe(false);
    expect(K.diketikPetugas({ jawab: "ada isinya" })).toBe(true);
    expect(K.diketikPetugas({ jawab: "isi dasar", dasar: "isi dasar" })).toBe(false);
  });

  it("usulan jawaban (kontrak {teks,yakin,sumber}) hanya mengisi baris yang belum diketik", () => {
    const K: Mod = muat();
    const rows = [
      { butir: "b1", jenisKat: "melihat", kunciJawaban: "k/b1/melihat", tanya: "t1", jawab: "saya ...", dasar: "saya ..." },
      { butir: "b2", jenisKat: "melihat", kunciJawaban: "k/b2/melihat", tanya: "t2", jawab: "Ketikan petugas sendiri." },
      { butir: "b3", jenisKat: "melihat", kunciJawaban: "k/b3/melihat", tanya: "t3", jawab: "" },
    ];
    const r = K.terapkanUsulan(rows, {
      "k/b1/melihat": { teks: "saya adalah ayah kandung Pemohon I", yakin: "yakin", sumber: "isian blangko" },
      "k/b2/melihat": { teks: "usulan yang tidak boleh menimpa", yakin: "yakin", sumber: "SIPP" },
      "k/b3/melihat": { teks: "kira-kira dua tahun", yakin: "ragu", sumber: "posita" },
    });
    expect(r.rows.map((x: Mod) => x.jawab)).toEqual(["saya adalah ayah kandung Pemohon I", "Ketikan petugas sendiri.", "kira-kira dua tahun"]);
    expect(r.terisi).toBe(2);
    expect(r.tertahan).toBe(1);
    expect(r.rows[0]).toMatchObject({ yakin: "yakin", sumberJawab: "isian blangko", otomatis: "saya adalah ayah kandung Pemohon I" });
    expect(r.rows[2].yakin).toBe("ragu");
  });

  it("setiap jenis yang punya katalog menyusun paling sedikit 10 pertanyaan untuk dua saksi dengan keadaan bawaan", () => {
    const K: Mod = muat();
    const data = (globalThis as unknown as { ALETA_SAKSI_KATALOG_DATA: Array<Record<string, unknown>> }).ALETA_SAKSI_KATALOG_DATA;
    const jenis = [["360", "16"], ["362", "16"], ["354", "16"], ["358", "16"], ["363", "16"], ["371", "16"], ["364", "15"], ["348", "15"]];
    for (const [id, alur] of jenis) {
      const kn = K.kenali({ jenisPerkaraId: id, alurPerkaraId: alur, nomorPerkara: `1/${alur === "16" ? "Pdt.P" : "Pdt.G"}/2026/PA.Dgl` });
      expect(kn.mode, id).toBe("katalog");
      const ker = K.lengkapiBawaan(kn.kat, {});
      const s = K.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: "1", keadaan: ker, saksi: [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }] });
      expect(s.saksi[0].baris.length, id).toBeGreaterThanOrEqual(10);
      expect(s.saksi[0].baris.length, id).toBe(s.saksi[1].baris.length);
    }
    expect(data.length).toBeGreaterThanOrEqual(28);
  });
});

// ============================================================================
// Panel di halaman (jsdom)
// ============================================================================
describe("Blangko Derry: panel Pengetahuan saksi menurut katalog jenis perkara", () => {
  it("itsbat (permohonan): pilihan katalog itsbat, bukan pilihan cerai; nama 'Saksi 1 Pemohon'; keadaan perkara berlabel jelas", async () => {
    const h = await bukaSaksi(JENIS_ITSBAT);
    // nama saksi di tombol dan kartu mengikuti permohonan
    expect(qd(h, '[data-tj="saksi 1 p"]')[0].textContent).toMatch(/Saksi 1 Pemohon/);
    expect(akar(h).textContent).not.toMatch(/Saksi \d Penggugat/);
    // panel katalog, bukan panel cerai
    expect(q(h, ".bd-skkatalog")).not.toBeNull();
    expect(qd(h, '[data-skfld="modus"]')).toHaveLength(0);
    expect(akar(h).textContent).not.toMatch(/Tahu seluruh alasan|Tahu berselisih|Tidak pernah menyaksikan pertengkaran/);
    // pilihan 'Yang diketahui saksi' = tingkat pengetahuan di katalog
    const pil = opsiDari(h, "saksi 1 p", "kat-jenis");
    expect(pil.map((o) => o.nilai)).toEqual(["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"]);
    expect(pil[0].label).toBe("Melihat sendiri");
    // keadaan: bentuk perkara terisi dari data (2 pemohon) dan diberi tanda; peran saksi per saksi, label manusiawi
    const bentuk = q(h, '[data-skfld="kat-keadaan:bentuk"]') as HTMLSelectElement;
    expect(bentuk.value).toBe("permohonan-berdua");
    expect(akar(h).textContent).toContain("dari data perkara");
    const peran = opsiDari(h, "saksi 1 p", "kat-saksi:kedudukanSaksi");
    expect(peran.map((o) => o.nilai)).toEqual(["hadir-biasa", "wali-nikah", "saksi-nikah", "penghulu"]);
    expect(peran.map((o) => o.label).join("|")).toContain("Wali nikah");
    expect(akar(h).textContent).toContain("Peran saksi pada pernikahan itu");
    // pilihan set pertanyaan: katalog jenis perkara tersedia dan terpilih
    const set = q(h, "#bd-muattpl") as HTMLSelectElement;
    expect(set.value).toMatch(/^katalog:itsbat-nikah$/);
    // dua saksi tersusun berdampingan dari katalog; tombol lama tetap ada
    expect(semuaTanya(h).length).toBeGreaterThanOrEqual(15);
    expect(semuaTanya(h)[0]).toMatch(/Pemohon I dan Pemohon II/);
    for (const s of ['[data-bd2="tambahtj"]', '[data-bd2="simpantj"]', '[data-bd2="muattpl"]', '[data-bd2="isioto"]', '[data-sbaksi="urung"]', '[data-tjmode="satu"]']) expect(q(h, s), s).not.toBeNull();
  });

  it("sebutan menurut nomor alur: gugatan itsbat (alur 15) 'Penggugat'; portal/singgahan lama yang menulis Penggugat pada permohonan diluruskan", async () => {
    const gugatan = await bukaSaksi({ jenis: "Pengesahan Perkawinan/Istbat Nikah", alur: 15, nomor: "1/Pdt.G/2026", jumlahP: 1 });
    expect(qd(gugatan, '[data-tj="saksi 1 p"]')[0].textContent).toMatch(/Saksi 1 Penggugat/);
    expect(q(gugatan, ".bd-skkatalog")).not.toBeNull();
    const lama = await bukaSaksi({ ...JENIS_ITSBAT, portalLama: true });
    expect(qd(lama, '[data-tj="saksi 1 p"]')[0].textContent).toMatch(/Saksi 1 Pemohon/);
    expect(akar(lama).textContent).not.toMatch(/Saksi \d Penggugat/);
  });

  it("perubahan bentuk perkara mengubah susunan pertanyaan; ketikan petugas bertahan; kehadiran muncul pada gugatan", async () => {
    const h = await bukaSaksi(JENIS_ITSBAT);
    const awal = semuaTanya(h);
    expect(qd(h, '[data-skfld="kat-keadaan:kehadiran"]')).toHaveLength(0);
    // petugas mengetik satu jawaban saksi 1
    const kotak = q(h, '[data-sba="1"][data-sk="0"]') as HTMLTextAreaElement;
    ketik(h, kotak as unknown as HTMLInputElement, "Diketik sendiri oleh petugas.");
    pilihOpsi(h, "__perkara", "kat-keadaan:bentuk", "permohonan-sendiri");
    await sampai(() => semuaTanya(h).some((t) => !awal.includes(t)), "pertanyaan berganti");
    const sesudah = semuaTanya(h);
    expect(sesudah[0]).not.toMatch(/Pemohon II/);
    expect(sesudah).not.toEqual(awal);
    expect(semuaJawab(h, 0)).toContain("Diketik sendiri oleh petugas.");
    // gugatan: kehadiran Tergugat muncul sebagai pilihan dan pertanyaan tentang lawan ikut
    pilihOpsi(h, "__perkara", "kat-keadaan:bentuk", "gugatan");
    await sampai(() => q(h, '[data-skfld="kat-keadaan:kehadiran"]'), "kehadiran muncul");
    await sampai(() => semuaTanya(h).some((t) => !sesudah.includes(t)), "pertanyaan gugatan");
    expect(semuaTanya(h)).not.toEqual(sesudah);
    expect(semuaJawab(h, 0)).toContain("Diketik sendiri oleh petugas.");
    // pilihan tersimpan per perkara
    expect(JSON.stringify(h.simpanan)).toContain("bdSaksiKat:");
  });

  it("pengetahuan dipilih per saksi: hanya jawaban saksi itu yang berubah; peran saksi mengubah jawaban saksi itu saja", async () => {
    const h = await bukaSaksi(JENIS_ITSBAT);
    const a0 = semuaJawab(h, 0);
    const a1 = semuaJawab(h, 1);
    pilihOpsi(h, "saksi 1 p", "kat-jenis", "de-auditu");
    await sampai(() => JSON.stringify(semuaJawab(h, 0)) !== JSON.stringify(a0), "jawaban saksi 1 berubah");
    expect(semuaJawab(h, 1)).toEqual(a1);
    // 'Cerita dari siapa' tampil hanya untuk pengetahuan dari cerita
    expect(q(h, '[data-skkunci="saksi 1 p"][data-skfld="kat-sumber"]')).not.toBeNull();
    expect(q(h, '[data-skkunci="saksi 2 p"][data-skfld="kat-sumber"]')).toBeNull();
    const b0 = semuaJawab(h, 0);
    pilihOpsi(h, "saksi 2 p", "kat-saksi:kedudukanSaksi", "wali-nikah");
    await sampai(() => JSON.stringify(semuaJawab(h, 1)) !== JSON.stringify(a1), "jawaban saksi 2 berubah");
    expect(semuaJawab(h, 0)).toEqual(b0);
  });

  it("pilihan petugas diingat per perkara; daftar yang sudah ada di ABT tidak disentuh saat dibuka, Isi ulang tidak merombak daftar bukan katalog, Muat katalog mempertahankan ketikan", async () => {
    const simpanan = { "bdSaksiKat:10154": { keadaan: { bentuk: "permohonan-sendiri" }, saksi: { "saksi 1 p": { jenis: "tidak-tahu", sumber: "", keadaan: { kedudukanSaksi: "penghulu" } } }, jarang: false, saat: 1 } };
    const tjAwal = {
      "5058": [{ no: "1", tanya: "Apakah saksi kenal Pemohon?", jawab: "Kenal baik, tetangga sejak kecil." }, { no: "2", tanya: "Ada hubungan keluarga?", jawab: "..." }],
      "5059": [{ no: "1", tanya: "Siapa nama saksi?", jawab: "Saksi dua." }],
    };
    const h = await bukaSaksi({ ...JENIS_ITSBAT, simpanan, tjAwal }, false);
    await sampai(() => (q(h, '[data-skkunci="__perkara"][data-skfld="kat-keadaan:bentuk"]') as HTMLSelectElement)?.value === "permohonan-sendiri", "pilihan tersimpan terpulihkan");
    expect((q(h, '[data-skkunci="saksi 1 p"][data-skfld="kat-jenis"]') as HTMLSelectElement).value).toBe("tidak-tahu");
    expect((q(h, '[data-skkunci="saksi 1 p"][data-skfld="kat-saksi:kedudukanSaksi"]') as HTMLSelectElement).value).toBe("penghulu");
    // daftar dari ABT tidak berubah saat dibuka
    await tunggu(150);
    expect(semuaTanya(h)).toEqual(["Apakah saksi kenal Pemohon?", "Ada hubungan keluarga?"]);
    // Isi ulang pada daftar yang bukan susunan katalog: tidak merombak, memberi tahu
    klik(h, '[data-bd2="isioto"]');
    await sampai(() => /bukan susunan katalog/.test(akar(h).textContent || ""), "kabar bukan susunan katalog");
    expect(semuaTanya(h)).toEqual(["Apakah saksi kenal Pemohon?", "Ada hubungan keluarga?"]);
    // Muat katalog: pertanyaan katalog masuk, ketikan petugas (jawaban tertulis) tetap ada, titik-titik contoh diganti
    const set = q(h, "#bd-muattpl") as HTMLSelectElement;
    expect(set.value).toBe("katalog:itsbat-nikah");
    klik(h, '[data-bd2="muattpl"]');
    await sampai(() => semuaTanya(h).length >= 15, "katalog termuat");
    expect(semuaJawab(h, 0)).toContain("Kenal baik, tetangga sejak kecil.");
    expect(semuaTanya(h)).toContain("Apakah saksi kenal Pemohon?");
    expect(semuaTanya(h)).not.toContain("Ada hubungan keluarga?");
  });

  it("Urungkan mengembalikan daftar sebelum disusun dari katalog; Simpan ke ABT menulis baris tanpa kata ALETA dan tanpa penanda internal", async () => {
    const h = await bukaSaksi(JENIS_ITSBAT);
    const awal = semuaTanya(h);
    pilihOpsi(h, "__perkara", "kat-keadaan:bentuk", "permohonan-sendiri");
    await sampai(() => semuaTanya(h).some((t) => !awal.includes(t)), "disusun ulang");
    klik(h, '[data-sbaksi="urung"]');
    await sampai(() => JSON.stringify(semuaTanya(h)) === JSON.stringify(awal), "urung");
    klik(h, '[data-bd2="simpantj"]');
    await sampai(() => h.tj["5058"].length >= 15, "tersimpan ke ABT");
    expect(h.tj["5058"].length).toBe(awal.length);
    const isi = JSON.stringify(h.tj["5058"]);
    expect(isi).not.toMatch(/aleta/i);
    expect(isi).not.toMatch(/"butir"|kunciJawaban|"dasar"/);
    expect(h.tj["5058"][0]).toEqual({ no: "1", tanya: awal[0], jawab: expect.any(String) });
  });

  it("cerai (346/347) tetap panel lama dengan pilihan sekarang; sebutan menurut jenis", async () => {
    const gugat = await bukaSaksi({ jenis: "Cerai Gugat", alur: 15 }, false);
    expect(q(gugat, ".bd-skkatalog")).toBeNull();
    expect(opsiDari(gugat, "saksi 1 p", "modus").map((o) => o.label)).toContain("Tahu seluruh alasan, melihat sendiri");
    expect(opsiDari(gugat, "saksi 1 p", "modus").map((o) => o.nilai)).toEqual(["sama", "mendengar", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah", "ragu"]);
    expect(qd(gugat, '[data-tj="saksi 1 p"]')[0].textContent).toMatch(/Saksi 1 Penggugat/);
    // pilihan set di dropdown tidak memuat katalog untuk cerai
    expect(Array.from((q(gugat, "#bd-muattpl") as HTMLSelectElement).options).some((o) => o.value.startsWith("katalog:"))).toBe(false);
    const talak = await bukaSaksi({ jenis: "Cerai Talak", alur: 15 }, false);
    expect(q(talak, ".bd-skkatalog")).toBeNull();
    expect(qd(talak, '[data-skfld="modus"]').length).toBeGreaterThan(0);
    expect(qd(talak, '[data-tj="saksi 1 p"]')[0].textContent).toMatch(/Saksi 1 Pemohon/);
  });

  it("dispensasi kawin memakai katalognya sendiri dan jenis tanpa katalog tidak dianggap cerai", async () => {
    const dk = await bukaSaksi({ jenis: "Dispensasi Kawin", alur: 16, nomor: "170/Pdt.P/2026" });
    expect(q(dk, ".bd-skkatalog")).not.toBeNull();
    expect(qd(dk, '[data-skfld="modus"]')).toHaveLength(0);
    expect(qd(dk, '[data-tj="saksi 1 p"]')[0].textContent).toMatch(/Saksi 1 Pemohon/);
    expect(semuaTanya(dk).length).toBeGreaterThanOrEqual(10);
    const tanpa = await bukaSaksi({ jenis: "Jenis Contoh Tanpa Katalog", alur: 16, nomor: "9/Pdt.P/2026" }, false);
    expect(q(tanpa, ".bd-skkatalog")).toBeNull();
    expect(qd(tanpa, '[data-skfld="modus"]')).toHaveLength(0);
    expect(akar(tanpa).textContent).toMatch(/belum punya katalog pertanyaan saksi/);
  });
});
