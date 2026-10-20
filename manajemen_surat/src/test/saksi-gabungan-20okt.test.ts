// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - UJI GABUNGAN UJUNG KE UJUNG JAWABAN SAKSI (agen S7)
 * ============================================================================
 * Menyambung S1 (katalog + panel), S2 (pengisi jawaban dari data) dan S4 (warna/ringkasan) dengan bot SUNGGUHAN:
 * ekstensi dijalankan di jsdom, permintaan ke bot dijawab oleh isiJawabanSaksiService / abtUsulanService asli
 * (tanpa basis data: data SIPP dan posita dipasok uji). Mencakup itsbat 228/Pdt.P/2026 (2 pemohon, alur 16),
 * cerai gugat (panel lama), dan ketikan petugas yang tidak boleh ditimpa "Isi ulang".
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
const bot: { fn: (b: any) => Promise<{ status: number; json: unknown }> } = { fn: async () => ({ status: 503, json: { ok: false } }) };
const penanganBot = (b: unknown) => bot.fn(b);
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


// ============================================================================
// Bot sungguhan (tanpa basis data)
// ============================================================================
const servis = require_("../services/isiJawabanSaksiService.js");
const usul = require_("../services/abtUsulanService.js");
const djp = require_("../services/deteksiJenisPerkaraService.js");
const dsaksi = require_("../services/deteksiSaksiService.js");
const pemilih = require_("../services/pemilihRagam.js");

const POSITA_ITSBAT = `<ol><li>Bahwa pada hari Senin, 17 November 2025 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam, bertempat di Desa Lembantongoa , di wilayah hukum Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah;</li>
<li>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Perjaka dalam usia 21 tahun, dan Pemohon II berstatus Perawan dalam usia 18 tahun Pernikahan dilangsungkan dengan wali nikah yaitu Samsul Bahri (Ayah Kandung Pemohon II) dan yang menikahkan adalah Fathoni (Imam Desa), dan dihadiri saksi nikah bernama Azumar dan Luthfi Hakim, dengan mas kawin berupa Rp.1.100.000 (Satu Juta Seratus Ribu Rupiah) dan dibayar tunai;</li>
<li>Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun sebagaimana layaknya suami istri, dan telah dikaruniai seorang anak yang bernama Risal bin Ali, usia 6 bulan;</li>
<li>Bahwa sampai sekarang Pemohon I dan Pemohon II tidak mempunyai Kutipan Akta Nikah, karena Para Pemohon masih berstatus belum cukup umur saat pernikahan dan pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah, sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang, sementara saat ini para Pemohon I dan Pemohon II membutuhkan Akta Nikah tersebut untuk mengurus Buku Nikah dan untuk kepentingan hukum lainnya;</li></ol>`;

const POSITA_CERAI = `1. Bahwa pada tanggal 25 Juli 2010, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama (KUA) Kecamatan Palu Barat, Kota Palu, Provinsi Sulawesi Tengah;
2. Bahwa setelah menikah, Penggugat dan Tergugat hidup selayaknya suami isteri dan telah dikaruniai 2 (dua) orang anak, saat ini anak tersebut berada dalam pengasuhan Penggugat;
3. Bahwa sejak bulan Juli 2020 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran;
4. Bahwa puncak keretakan hubungan rumah tangga Penggugat dengan Tergugat tersebut terjadi pada Maret 2024, Tergugat pergi meninggalkan kediaman bersama ke rumah orangtua Tergugat di Desa Loli Oge dikarenakan antara Penggugat dan Tergugat terjadi perselisihan dan pertengkaran sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 1 tahun 9 bulan;`;

type Dasar = { posita: string; sipp: Record<string, unknown> };
/** Pasang bot sungguhan: 'isi-jawaban' (katalog) dan 'saksi-sdg' (panel cerai) dijawab kode bot yang sama dengan rute. */
function pasangBotNyata(d: Dasar) {
  bot.fn = async (b: any) => {
    if (b.sumber === "alasan-posita") return { status: 200, json: { ok: true, data: { available: true, alasanPosita: { ok: true, alasan: [] } } } };
    if (b.sumber === "isi-jawaban") {
      const isiJawaban = servis.isiBaris({ posita: d.posita, jenisPerkara: String(b.jenisPerkara || ""), alur: String(b.alur || ""), kunciKatalog: String(b.kunciKatalog || ""), pelaku: b.pelaku, lawan: b.lawan, isian: b.isian, sipp: d.sipp, saksiIsi: b.saksiIsi });
      return { status: 200, json: { ok: true, data: { available: true, isiJawaban } } };
    }
    // saksi-sdg (panel cerai lama): jalur yang sama dengan rute
    const templatMasuk = (b.templat as any[]).map((x) => ({ ...x }));
    const templatSebelum = templatMasuk.map((x) => ({ ...x }));
    const j3 = djp.isiTemplatSaksi(templatMasuk, { posita: d.posita, jenisPerkara: String(b.jenisPerkara || ""), alur: String(b.alur || "") });
    if (j3 && j3.jenis && Array.isArray(j3.templat) && j3.terisi.length) templatMasuk.splice(0, templatMasuk.length, ...j3.templat);
    const h = usul.susunKeteranganSaksiSdg({ templat: templatMasuk, posita: d.posita, alasan: [], pelaku: b.pelaku, lawan: b.lawan, nomorPerkara: String(b.nomorPerkara || ""), kodeKumpulan: "", jenisPerkara: String(b.jenisPerkara || ""), alur: String(b.alur || ""), tanggalSidang: "", modus: b.modus, ...(b.saksi && b.saksi.length ? { saksi: b.saksi } : {}) });
    if (h.ok) {
      servis.lengkapi(h, { templatMasuk: templatSebelum, posita: d.posita, jenisPerkara: String(b.jenisPerkara || ""), alur: String(b.alur || ""), pelaku: b.pelaku, lawan: b.lawan, tanggalSidang: "", isian: b.isian, sipp: d.sipp, saksi: b.saksi });
      Object.assign(h, dsaksi.lengkapiSusunan(h, { identitas: (d.sipp.saksi as unknown[]) || [], lawan: b.lawan, pelaku: b.pelaku, kelompokTanya: pemilih.kelompokTanya, penutup: "" }));
    }
    return { status: 200, json: { ok: true, data: { available: true, saksiSdg: h } } };
  };
}
const saksiSipp = (label: string[]) => label.map((k, i) => ({ pihak: "P", urutPihak: i + 1, nama: "", umur: null, agama: "", pendidikan: "", pekerjaan: "", alamat: "", keterangan: k }));
const SIPP_ITSBAT = { nikah: null, itsbat: null, anak: [], pihak1: [{ urutan: 1, nama: "Pemohon Satu", alamat: "", pekerjaan: "", lahir: "", jk: "L" }, { urutan: 2, nama: "Pemohon Dua", alamat: "", pekerjaan: "", lahir: "", jk: "P" }], pihak2: [], saksi: saksiSipp(["Tetangga Pemohon", "Adik Kandung Pemohon"]) };

const kotak = (h: Halaman, sisi: number) => qd(h, `textarea[data-sba][data-sk="${sisi}"]`) as HTMLTextAreaElement[];
const asalDom = (h: Halaman) => {
  const n: Record<string, number> = { data: 0, ragu: 0, kosong: 0, manual: 0 };
  for (const el of qd(h, "textarea[data-asal]")) n[el.getAttribute("data-asal") || ""] += 1;
  return n;
};
const ringkas = (h: Halaman) => {
  const m = (q(h, "#bd-asalringkas")?.textContent || "").replace(/\s+/g, " ").trim().match(/^(\d+) terisi · (\d+) ragu · (\d+) perlu dilengkapi$/);
  return m ? { terisi: Number(m[1]), ragu: Number(m[2]), kosong: Number(m[3]) } : null;
};
const css = readFileSync(path.join(EKSTENSI, "blangko-derry.css"), "utf8");

describe("sambungan S1<->S2: terapkanUsulan memakai kunci berekor saksi lebih dulu", () => {
  it("kalimat saksi 2 dipakai untuk saksi 2, kalimat polos untuk saksi lain; usulan {yakin,sumber,ket} sampai ke baris", () => {
    const K: Mod = muat();
    const rows = [{ butir: "b1", jenisKat: "melihat", kunciJawaban: "k/b1/melihat", tanya: "t", jawab: "saya ...", dasar: "saya ..." }];
    const u = {
      "k/b1/melihat": { teks: "kalimat polos", yakin: "yakin", sumber: "isian blangko", ket: "dasar polos" },
      "k/b1/melihat@saksi 2 p": { teks: "kalimat saksi dua", yakin: "ragu", sumber: "gugatan", ket: "tanggal berbeda antar sumber" },
    };
    const dua = K.terapkanUsulan(rows, u, "saksi 2 p");
    expect(dua.rows[0].jawab).toBe("kalimat saksi dua");
    expect(dua.rows[0].usulan).toEqual({ teks: "kalimat saksi dua", yakin: "ragu", sumber: "gugatan", ket: "tanggal berbeda antar sumber" });
    expect(dua.ragu).toBe(1);
    expect(K.terapkanUsulan(rows, u, "saksi 1 p").rows[0].jawab).toBe("kalimat polos");
    expect(K.terapkanUsulan(rows, u).rows[0].jawab).toBe("kalimat polos");
    // tampilan S4 membaca baris itu: ragu / data
    const T = require_("../../../ekstensi-sipp/blangko-derry-saksi-tampil.js");
    expect(T.asalBaris(dua.rows[0])).toBe("ragu");
    expect(T.alasanRagu(dua.rows[0])).toBe("gugatan");
    expect(T.asalBaris(K.terapkanUsulan(rows, u, "saksi 1 p").rows[0])).toBe("data");
  });

  it("baris katalog dan jalur cerai lama memberi usulan yang sama-sama terbaca metaUsulan", () => {
    const K: Mod = muat();
    const T = require_("../../../ekstensi-sipp/blangko-derry-saksi-tampil.js");
    const BD = require_("../../../ekstensi-sipp/blangko-derry-saksi.js");
    const katalog = K.terapkanUsulan([{ butir: "b", jenisKat: "melihat", kunciJawaban: "k/b/melihat", tanya: "t", jawab: "..." }], { "k/b/melihat": { teks: "isi", yakin: "ragu", sumber: "akta", ket: "k" } }).rows[0];
    const lama = BD.pasangJawaban([{ no: "1", tanya: "t", jawab: "...", dasar: "..." }], [{ no: "1", tanya: "t", jawab: "isi lama", usulan: { yakin: "ragu", sumber: "gugatan", ket: "k2" } }], {}).rows[0];
    expect(T.metaUsulan(katalog)).toMatchObject({ yakin: "ragu", sumber: "akta" });
    expect(T.metaUsulan(lama)).toMatchObject({ yakin: "ragu", sumber: "gugatan" });
    expect(T.asalBaris(katalog)).toBe("ragu");
    expect(T.asalBaris(lama)).toBe("ragu");
  });
});

describe("uji gabungan jsdom: itsbat 228/Pdt.P/2026 (2 pemohon, alur 16)", () => {
  it("panel katalog itsbat, 'Saksi 1 Pemohon', jawaban terisi dari data, saksi 2 berbeda kalimat, warna menurut asal, ringkasan benar", async () => {
    pasangBotNyata({ posita: POSITA_ITSBAT, sipp: SIPP_ITSBAT });
    const h = await bukaSaksi(JENIS_ITSBAT);
    await sampai(() => /\d+ terisi/.test(q(h, "#bd-asalringkas")?.textContent || ""), "ringkasan tampil");
    await sampai(() => kotak(h, 0).some((k) => /17 November 2025/.test(k.value)), "jawaban terisi dari data");
    // panel katalog itsbat, bukan panel cerai
    expect(q(h, ".bd-skkatalog")).not.toBeNull();
    expect(qd(h, '[data-skfld="modus"]')).toHaveLength(0);
    expect(qd(h, '[data-tj="saksi 1 p"]')[0].textContent).toMatch(/Saksi 1 Pemohon/);
    expect(akar(h).textContent).not.toMatch(/Saksi \d Penggugat/);
    expect(opsiDari(h, "saksi 1 p", "kat-jenis").map((o) => o.nilai)).toContain("de-auditu");
    // permintaan ke bot memakai sumber 'isi-jawaban' dan penanda kode
    const minta = usulanMinta.filter((b) => b.sumber === "isi-jawaban");
    expect(minta.length).toBeGreaterThanOrEqual(1);
    expect(minta[0].kunciKatalog).toBe("itsbat-nikah");
    expect(JSON.stringify(minta[0].saksiIsi)).not.toMatch(/aleta/i);
    // isi jawaban saksi 1 (gabungan semua kotak)
    const s1 = kotak(h, 0).map(nilaiTa).join("\n");
    const s2 = kotak(h, 1).map(nilaiTa).join("\n");
    for (const kata of ["17 November 2025", "Palolo", "Samsul Bahri", "Azumar", "Luthfi Hakim", "1.100.000"]) expect(s1, kata).toContain(kata);
    expect(s1).toMatch(/Fathoni/);
    // saksi 2 memakai kalimat berbeda pada paling sedikit satu baris, tetapi memuat fakta yang sama
    const a = kotak(h, 0).map(nilaiTa);
    const b = kotak(h, 1).map(nilaiTa);
    expect(a.length).toBe(b.length);
    expect(a.some((x, i) => x !== b[i] && b[i].trim() !== "")).toBe(true);
    for (const kata of ["17 November 2025", "Palolo", "Samsul Bahri"]) expect(s2, kata).toContain(kata);
    // hubungan saksi dari SIPP ("karena saya adalah ...")
    expect(s1).toMatch(/tetangga Pemohon/i);
    expect(s2).toMatch(/adik kandung Pemohon/i);
    // warna: setiap kotak punya kelas asal yang sesuai isinya, "..." selalu kosong
    for (const el of [...kotak(h, 0), ...kotak(h, 1)]) {
      const asal = el.getAttribute("data-asal") || "";
      expect(el.classList.contains(`bd-asal-${asal}`), el.value).toBe(true);
      if (/\.{3,}|…/.test(el.value) || !el.value.trim()) expect(asal).toBe("kosong");
      else expect(["data", "ragu"]).toContain(asal);
    }
    // ringkasan sama dengan hitungan kotak
    const n = asalDom(h);
    expect(ringkas(h)).toEqual({ terisi: n.data + n.manual, ragu: n.ragu, kosong: n.kosong });
    expect(n.data + n.ragu).toBeGreaterThan(20);
    expect(n.kosong).toBeLessThan(n.data + n.ragu);
    // warna ragu berwarna oranye di stylesheet
    expect(css).toMatch(/--asal-ragu-ln: #e0711a/);
  });

  it("sumber yang berselisih menjadi 'ragu': kotak oranye, lencana ragu, ikon info berisi alasan, dan terhitung di ringkasan", async () => {
    pasangBotNyata({ posita: POSITA_ITSBAT, sipp: { ...SIPP_ITSBAT, itsbat: { tgl: "2025-11-18", tempat: "Desa Lembantongoa" } } });
    const h = await bukaSaksi(JENIS_ITSBAT);
    await sampai(() => qd(h, 'textarea[data-asal="ragu"]').length > 0, "ada jawaban ragu");
    const ragu = qd(h, 'textarea[data-asal="ragu"]') as HTMLTextAreaElement[];
    expect(ragu.every((el) => el.classList.contains("bd-asal-ragu"))).toBe(true);
    const lencana = qd(h, ".bd-asallencana.ragu");
    expect(lencana.length).toBe(ragu.length);
    const info = lencana[0].querySelector(".bd-asalinfo") as HTMLElement;
    expect(info.getAttribute("title")).toMatch(/18 November 2025|17 November 2025/);
    expect(ringkas(h)!.ragu).toBe(ragu.length);
    expect(ragu[0].value).toMatch(/November 2025/);
  });
});

describe("uji gabungan jsdom: cerai gugat (panel lama)", () => {
  async function bukaCerai(sipp: Record<string, unknown>) {
    pasangBotNyata({ posita: POSITA_CERAI, sipp });
    const h = buka({ orang: "pp" });
    await pilihBas(h);
    klik(h, '[data-tj="saksi 1 p"]');
    const sel = (await sampai(() => q(h, '#bd-muattpl optgroup[label^="Panduan"]') && q(h, "#bd-muattpl"), "panduan set")) as HTMLSelectElement;
    await sampai(() => q(h, '[data-skkartu="saksi 2 p"] select') && !(q(h, '[data-skkunci="saksi 1 p"][data-skfld="modus"]') as HTMLSelectElement).disabled, "panel pengetahuan siap");
    sel.value = "aleta:cerai-F";
    klik(h, '[data-bd2="muattpl"]');
    await sampai(() => usulanMinta.length >= 1, "permintaan jawaban otomatis");
    await sampai(() => /disusun dari data perkara/.test(akar(h).textContent || ""), "jawaban terisi");
    return h;
  }

  it("panel lama (pilihan cerai), tanggal nikah dan puncak perselisihan terisi, hubungan saksi dari SIPP, jawaban ragu tampil oranye", async () => {
    const sipp = { nikah: { tgl_nikah: "2010-07-26", kua: "Palu Barat" }, itsbat: null, anak: [], pihak1: [{ urutan: 1, nama: "Yulfiani", alamat: "Jl. Mawar No 1, Kota Palu", pekerjaan: "", lahir: "", jk: "P" }], pihak2: [{ urutan: 1, nama: "Andi", alamat: "Desa Loli Oge", pekerjaan: "", lahir: "", jk: "L" }], saksi: saksiSipp(["Tetangga Penggugat", "Adik Kandung Penggugat"]) };
    const h = await bukaCerai(sipp);
    expect(q(h, ".bd-skkatalog")).toBeNull();
    expect(opsiDari(h, "saksi 1 p", "modus").map((o) => o.label)).toContain("Tahu seluruh alasan, melihat sendiri");
    const s1 = kotak(h, 0).map(nilaiTa).join("\n");
    expect(s1).toMatch(/Juli 2010/);
    expect(s1).toMatch(/Maret 2024/);
    expect(s1).toMatch(/tetangga Penggugat/i);
    expect(kotak(h, 1).map(nilaiTa).join("\n")).toMatch(/adik kandung Penggugat/i);
    // tanggal nikah SIPP (26 Juli) berbeda dari gugatan (25 Juli): jawaban itu ragu
    await sampai(() => qd(h, 'textarea[data-asal="ragu"]').length > 0, "ada jawaban ragu");
    const ragu = qd(h, 'textarea[data-asal="ragu"]') as HTMLTextAreaElement[];
    expect(ragu.every((el) => el.classList.contains("bd-asal-ragu"))).toBe(true);
    expect(qd(h, ".bd-asallencana.ragu .bd-asalinfo").length).toBe(ragu.length);
    const n = asalDom(h);
    expect(ringkas(h)).toEqual({ terisi: n.data + n.manual, ragu: n.ragu, kosong: n.kosong });
    // sisa titik-titik berwarna "perlu dilengkapi"
    for (const el of qd(h, "textarea[data-asal]") as HTMLTextAreaElement[]) if (/\.{3,}|…/.test(el.value)) expect(el.getAttribute("data-asal")).toBe("kosong");
  });
});

describe("uji gabungan jsdom: ketikan petugas tidak ditimpa", () => {
  it("Isi ulang tanpa centang mempertahankan jawaban yang diketik (dan memberi tahu jumlah yang tertahan)", async () => {
    pasangBotNyata({ posita: POSITA_ITSBAT, sipp: SIPP_ITSBAT });
    const h = await bukaSaksi(JENIS_ITSBAT);
    await sampai(() => kotak(h, 0).some((k) => /17 November 2025/.test(k.value)), "jawaban terisi dari data");
    const idx = kotak(h, 0).findIndex((k) => /17 November 2025/.test(k.value));
    const el = kotak(h, 0)[idx];
    const diketik = "Menurut saya menikahnya pada 20 November 2025, bukan 17 November 2025.";
    el.value = diketik;
    el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => kotak(h, 0)[idx].getAttribute("data-asal") === "manual", "kotak menjadi manual");
    const sebelum = kotak(h, 0).map(nilaiTa);
    klik(h, '[data-bd2="isioto"]');
    // konfirmasi memuat jumlah jawaban yang berubah dan yang tertahan; tanpa centang ketikan petugas tertahan
    await sampai(() => q(h, "[data-skkonfirm]"), "konfirmasi tampil");
    const kal = await sampai(() => q(h, "[data-skkal]")?.textContent, "kalimat konfirmasi");
    expect(kal).toMatch(/\d+ jawaban akan berubah|0 jawaban akan berubah/);
    expect(kal).toMatch(/1 jawaban yang sudah Anda ketik tertahan/);
    const centang = q(h, '[data-bd2="tinjautimpa"]') as HTMLInputElement;
    expect(centang.checked).toBe(false);
    const ya = q(h, '[data-bd2="isiulangya"]') as HTMLButtonElement | null;
    if (ya && !ya.disabled) ya.click();
    await tunggu(80);
    expect(nilaiTa(kotak(h, 0)[idx])).toBe(diketik);
    expect(kotak(h, 0)[idx].getAttribute("data-asal")).toBe("manual");
    expect(kotak(h, 0).map(nilaiTa).filter((x) => x === diketik)).toHaveLength(1);
    expect(kotak(h, 0).length).toBe(sebelum.length);
  });
});
