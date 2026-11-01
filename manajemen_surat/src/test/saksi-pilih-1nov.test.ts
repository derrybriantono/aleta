// @vitest-environment node
/**
 * ============================================================================
 * 1 NOV 2026 (agen J2, keputusan 79) - TAMBAH PERTANYAAN DARI KATALOG, HAPUS PER SAKSI, TANDA "HANYA ADA PADA SATU SAKSI"
 * ============================================================================
 *
 * Dijaga (blangko-derry-*.js dijalankan SUNGGUHAN di jsdom bersama portal susun.ts, perkara itsbat nikah berdua = katalog):
 *   1. jumlah butir bawaan mengikuti keadaan perkara (bentuk perkara mengubah susunan);
 *   2. "Tambah pertanyaan" di TENGAH keterangan saksi: memilih dari pertanyaan katalog yang TIDAK ikut tersusun (dikelompokkan, bisa
 *      dicari), disisipkan di posisi itu beserta jawaban bawaan menurut pengetahuan tiap saksi;
 *   3. mode dua saksi: hapus pertanyaan = pertanyaan + keterangan KEDUA saksi;
 *   4. hapus hanya untuk satu saksi: tampilan berpindah ke saksi itu dan pertanyaan yang hanya ada pada satu saksi ditandai;
 *   5. tambah/hapus dapat diurungkan, tersimpan seperti ketikan (simpan otomatis + Simpan ke ABT), nomor tersimpan berurut ulang;
 *   6. pertanyaan yang dihapus tidak muncul lagi saat disusun ulang dan pertanyaan tambahan tidak dibuang oleh susun ulang.
 * Seluruh nomor perkara, nama, dan isi REKAAN.
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
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "saksi-katalog.js", "saksi-katalog-data.js", "blangko-derry-saksi.js", "blangko-derry-saksi-tampil.js", "blangko-derry-draf-saksi.js", "blangko-derry-saksi-arah.js", "blangko-derry-draf-bas.js", "blangko-derry-katalog.js", "blangko-derry-jawab-katalog.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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
type Mod = any;
const muat = () => {
  const g = globalThis as unknown as { AletaSaksiKatalog?: unknown };
  g.AletaSaksiKatalog = require_(path.join(E, "saksi-katalog.js"));
  require_(path.join(E, "saksi-katalog-data.js"));
  return require_(path.join(E, "blangko-derry-katalog.js"));
};
const TP: Mod = require_(path.join(E, "blangko-derry-saksi-tampil.js"));
const ITS = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", jenisPerkaraId: "360", alurPerkaraId: "16", nomorPerkara: "228/Pdt.P/2026/PA.Dgl" };
const DUA = [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }];

describe("pembanding susunan dua saksi (murni)", () => {
  it("pertanyaan yang hanya ada pada satu saksi: menurut butir katalog atau tanda hanya; baris kosong dan pertanyaan yang sama tidak dihitung", () => {
    const A = [{ butir: "a", tanya: "Satu?", jawab: "x" }, { butir: "b", tanya: "Dua?", jawab: "y" }, { butir: "c", tanya: "Tiga?", jawab: "z" }];
    const B = [{ butir: "a", tanya: "Satu (rumusan lain)?", jawab: "x" }, { butir: "c", tanya: "Tiga?", jawab: "z" }];
    expect(TP.bandingSusunan(A, B)).toEqual({ hanyaA: [1], hanyaB: [], beda: true });
    expect(TP.bandingSusunan(A, A)).toEqual({ hanyaA: [], hanyaB: [], beda: false });
    // baris dari ABT tidak membawa butir: tanpa tanda hanya, tidak ada perbedaan yang diklaim
    const dariAbt = [{ tanya: "Satu?", jawab: "x" }, { tanya: "Lain sekali?", jawab: "y" }];
    expect(TP.bandingSusunan(dariAbt, [{ tanya: "Satu?", jawab: "x" }]).beda).toBe(false);
    // tanda hanya (hasil hapus untuk satu saksi) dipakai, tetapi batal bila saksi lain ternyata memuatnya
    expect(TP.bandingSusunan([{ tanya: "Lain sekali?", jawab: "y", hanya: true }], [{ tanya: "Satu?", jawab: "x" }])).toEqual({ hanyaA: [0], hanyaB: [], beda: true });
    expect(TP.bandingSusunan([{ tanya: "Satu?", jawab: "y", hanya: true }], [{ tanya: "satu", jawab: "x" }]).beda).toBe(false);
    expect(TP.bandingSusunan([{ tanya: "", jawab: "" , hanya: true }], [{ butir: "z", tanya: "Z?", jawab: "1" }]).hanyaA).toEqual([]);
    expect(TP.kalimatBeda("Saksi 1 Pemohon", "Saksi 2 Pemohon", { hanyaA: [1, 2], hanyaB: [] })).toBe("Pertanyaan Saksi 1 Pemohon dan Saksi 2 Pemohon tidak sama lagi: 2 pertanyaan hanya ada pada Saksi 1 Pemohon.");
    expect(TP.cariPasangan(A, 1, [A[0], A[1]])).toBe(1);
    expect(TP.cariPasangan(A, 1, [A[0]])).toBe(-1);
  });

  it("calonTambah: hanya butir yang belum tersusun, dikelompokkan menurut pokok, jawaban bawaan menurut pengetahuan tiap saksi, bisa dicari", () => {
    const K: Mod = muat();
    const kn = K.kenali(ITS);
    const ker = K.lengkapiBawaan(kn.kat, { bentuk: "permohonan-berdua" });
    const dasar = { kat: kn.kat, sebutan: kn.sebutan, benih: "228", keadaan: ker };
    const tersusun = K.susun({ ...dasar, saksi: DUA });
    const rows = { "saksi 1 p": tersusun.saksi[0].baris, "saksi 2 p": tersusun.saksi[1].baris };
    const ada = new Set(rows["saksi 1 p"].map((b: Mod) => b.butir));
    const c = K.calonTambah({ ...dasar, saksi: DUA, target: ["saksi 1 p", "saksi 2 p"], rows });
    expect(c.calon.length).toBeGreaterThan(40);
    expect(c.calon.every((x: Mod) => !ada.has(x.id))).toBe(true);
    expect(c.calon.some((x: Mod) => x.kelompok === "penutup")).toBe(false);
    // dua saksi: tiap calon membawa baris untuk KEDUA saksi dan jawaban keduanya tidak kembar
    const lengkap = c.calon.filter((x: Mod) => x.baris["saksi 1 p"].jawab && x.baris["saksi 2 p"].jawab);
    expect(lengkap.length).toBeGreaterThan(20);
    expect(lengkap.every((x: Mod) => x.baris["saksi 1 p"].jawab !== x.baris["saksi 2 p"].jawab)).toBe(true);
    // pengetahuan saksi 1 = ragu: jawaban bawaan saksi 1 mengikutinya, saksi 2 (melihat) tetap
    const ragu = K.calonTambah({ ...dasar, saksi: [{ ...DUA[0], jenis: "ragu" }, DUA[1]], target: ["saksi 1 p", "saksi 2 p"], rows });
    const sama = ragu.calon.filter((x: Mod) => x.baris["saksi 1 p"].jenis === "ragu");
    expect(sama.length).toBeGreaterThan(10);
    const id = sama[0].id;
    const semula = c.calon.find((x: Mod) => x.id === id);
    expect(sama[0].baris["saksi 1 p"].jawab).not.toBe(semula.baris["saksi 1 p"].jawab);
    expect(sama[0].baris["saksi 2 p"].jawab).toBe(semula.baris["saksi 2 p"].jawab);
    // dikelompokkan dan bisa dicari
    const kel = K.kelompokkanCalon(c.calon, "");
    expect(kel.length).toBeGreaterThan(5);
    expect(kel.reduce((n: number, g: Mod) => n + g.butir.length, 0)).toBe(c.calon.length);
    const cari = K.kelompokkanCalon(c.calon, "mahar");
    expect(cari.length).toBeGreaterThan(0);
    expect(cari.reduce((n: number, g: Mod) => n + g.butir.length, 0)).toBeLessThan(c.calon.length);
    expect(K.kelompokkanCalon(c.calon, "zzzxxyy")).toEqual([]);
    // satu saksi saja sebagai sasaran
    const satu = K.calonTambah({ ...dasar, saksi: DUA, target: ["saksi 2 p"], rows });
    expect(satu.calon.length).toBeGreaterThanOrEqual(c.calon.length);
    expect(Object.keys(satu.calon[0].baris)).toEqual(["saksi 2 p"]);
  });

  it("jumlah butir bawaan mengikuti keadaan perkara (bentuk, kehadiran, pengetahuan saksi)", () => {
    const K: Mod = muat();
    const kn = K.kenali(ITS);
    const jumlah = (keadaan: Record<string, unknown>, jarang = false) => K.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: "228", keadaan: K.lengkapiBawaan(kn.kat, keadaan), saksi: DUA, jarang }).saksi[0].baris.length;
    const berdua = jumlah({ bentuk: "permohonan-berdua" });
    const sendiri = jumlah({ bentuk: "permohonan-sendiri" });
    const gugatan = jumlah({ bentuk: "gugatan" });
    expect(new Set([berdua, sendiri, gugatan]).size).toBeGreaterThan(1);
    expect(jumlah({ bentuk: "permohonan-berdua" }, true)).toBeGreaterThan(berdua);
  });

  it("gabung: baris yang ditambahkan petugas dari katalog tidak dibuang saat disusun ulang, baris katalog biasa yang tak berlaku tetap dibuang", () => {
    const K: Mod = muat();
    const kn = K.kenali(ITS);
    const dasar = { kat: kn.kat, sebutan: kn.sebutan, benih: "228", saksi: DUA };
    const berdua = K.susun({ ...dasar, keadaan: K.lengkapiBawaan(kn.kat, { bentuk: "permohonan-berdua" }) });
    const lama = K.gabung([], berdua.saksi[0].baris).rows;
    const luar = K.calonTambah({ ...dasar, keadaan: K.lengkapiBawaan(kn.kat, { bentuk: "permohonan-berdua" }), target: ["saksi 1 p"], rows: { "saksi 1 p": lama } }).calon.find((x: Mod) => x.baris["saksi 1 p"].jawab);
    const tambahan = K.barisTambahan(luar.baris["saksi 1 p"]);
    expect(tambahan).toMatchObject({ butir: luar.id, ditambah: true, dasar: luar.baris["saksi 1 p"].jawab });
    const dgTambah = [...lama.slice(0, 3), tambahan, ...lama.slice(3)];
    const sendiri = K.susun({ ...dasar, keadaan: K.lengkapiBawaan(kn.kat, { bentuk: "permohonan-sendiri" }) }).saksi[0].baris;
    const g = K.gabung(dgTambah, sendiri);
    expect(g.rows.some((r: Mod) => r.butir === luar.id && r.ditambah)).toBe(true);
    expect(g.dibuang).toBeGreaterThan(5);
    const tanpaTanda = K.gabung(dgTambah.map((r: Mod) => ({ ...r, ditambah: undefined })), sendiri);
    expect(tanpaTanda.rows.some((r: Mod) => r.butir === luar.id)).toBe(false);
  });
});

// ============================================================================
// Di halaman (jsdom): perkara itsbat nikah berdua, BAS oleh PP
// ============================================================================
describe("Blangko Derry: Tambah pertanyaan dan hapus per saksi", () => {
  const tulisSimpan = (h: Halaman) => h.minta.filter((m) => m.cara === "POST" && /tanyajawab_perkara_edit\?aksi=simpan/.test(m.url));
  const dikirim = (m: Minta) => JSON.parse(String(new URLSearchParams(m.badan).get("data") || "[]")) as Array<{ no: string; tanya: string; jawab: string }>;
  const teksButir = (h: Halaman) => qd(h, '[data-bd2="pilihq-pilih"]').map((b) => (b.textContent || "").replace(/\s*jarang diajukan$/, "").trim());
  const tanyaSatu = (h: Halaman) => qd(h, "textarea[data-tjb][data-sisi='tanya']").map(nilaiTa);
  const jawabSatu = (h: Halaman) => qd(h, "textarea[data-tjb][data-sisi='jawab']").map(nilaiTa);
  const mulaiSaksiTersusun = async (p: BukaOpsi = JENIS_ITSBAT) => {
    const h = await bukaSaksi(p);
    await tunggu(150); // sampai jawaban dari data (bot mati: tidak ada) selesai
    return h;
  };

  it("Tambah pertanyaan di tengah (berdampingan): pilihan hanya memuat pertanyaan yang belum tersusun, dikelompokkan dan bisa dicari; pilihan masuk di posisi itu untuk KEDUA saksi dengan jawaban bawaan", async () => {
    const h = await mulaiSaksiTersusun();
    const awal = semuaTanya(h);
    const j0 = semuaJawab(h, 0);
    const j1 = semuaJawab(h, 1);
    expect(awal.length).toBeGreaterThanOrEqual(15);
    klik(h, '[data-bd2="pilihq"][data-pos="3"]'); // di bawah nomor 3
    await sampai(() => q(h, "#bd-pilihq") && teksButir(h).length > 20, "pilihan tergambar");
    // tidak satu pun pertanyaan yang sudah tersusun, dan dikelompokkan menurut pokoknya
    const daftar = teksButir(h);
    expect(daftar.some((t) => awal.includes(t))).toBe(false);
    expect(qd(h, ".bd-pilihq-judul").length).toBeGreaterThan(5);
    expect(q(h, "#bd-pilihq")!.textContent).toContain("disisipkan sebagai nomor 4 untuk kedua saksi");
    // pencarian menyaring di tempat (kotak tetap, daftar menyusut)
    ketik(h, q(h, "[data-pilihq-cari]") as HTMLInputElement, "mahar", false);
    await sampai(() => teksButir(h).length > 0 && teksButir(h).length < daftar.length, "daftar tersaring");
    expect(q(h, "[data-pilihq-cari]")).not.toBeNull();
    ketik(h, q(h, "[data-pilihq-cari]") as HTMLInputElement, "zzzxxyy", false);
    await sampai(() => /Tidak ada pertanyaan yang cocok/.test(q(h, "#bd-pilihq-daftar")!.textContent || ""), "tidak ada yang cocok");
    ketik(h, q(h, "[data-pilihq-cari]") as HTMLInputElement, "mahar", false);
    await sampai(() => teksButir(h).length > 0, "kembali tersaring");
    // memilih satu: masuk sebagai nomor 4 pada kedua saksi, urutan lain tidak berubah
    const pilih = qd(h, '[data-bd2="pilihq-pilih"]')[0];
    klik(h, `[data-butir="${pilih.getAttribute("data-butir")}"]`);
    await sampai(() => semuaTanya(h).length === awal.length + 1, "pertanyaan masuk");
    const sesudah = semuaTanya(h);
    expect(sesudah.slice(0, 3)).toEqual(awal.slice(0, 3));
    expect(sesudah.slice(4)).toEqual(awal.slice(3));
    expect(awal).not.toContain(sesudah[3]);
    expect(q(h, "#bd-pilihq")).toBeNull();
    expect(semuaJawab(h, 0).slice(0, 3)).toEqual(j0.slice(0, 3));
    expect(semuaJawab(h, 1).slice(4)).toEqual(j1.slice(3));
    expect(semuaJawab(h, 0)[3].trim()).not.toBe("");
    expect(semuaJawab(h, 1)[3].trim()).not.toBe("");
    expect(semuaJawab(h, 0)[3]).not.toBe(semuaJawab(h, 1)[3]); // dua saksi tidak berbunyi sama
    expect(qd(h, ".bd-hanya")).toHaveLength(0); // kedua saksi sama: tidak ada tanda
    expect(q(h, ".bd-hanyabanner")).toBeNull();
    // Urungkan sekali mengembalikan susunan semula
    klik(h, '[data-sbaksi="urung"]');
    await sampai(() => semuaTanya(h).length === awal.length, "diurungkan");
    expect(semuaTanya(h)).toEqual(awal);
    // Ulangi memasukkannya lagi
    klik(h, '[data-sbaksi="ulang"]');
    await sampai(() => semuaTanya(h).length === awal.length + 1, "diulangi");
    expect(semuaTanya(h)).toEqual(sesudah);
  });

  it("jawaban bawaan pertanyaan tambahan mengikuti pengetahuan TIAP saksi (saksi 1 ragu, saksi 2 melihat)", async () => {
    const h = await mulaiSaksiTersusun();
    pilihOpsi(h, "saksi 1 p", "kat-jenis", "ragu");
    await sampai(() => semuaJawab(h, 0).some((t) => /ragu|lupa|ingat|yakin|pasti/i.test(t)), "saksi 1 ragu");
    const K: Mod = muat();
    const kn = K.kenali(ITS);
    const ker = K.lengkapiBawaan(kn.kat, { bentuk: "permohonan-berdua" });
    klik(h, '[data-bd2="pilihq"][data-pos="2"]');
    await sampai(() => teksButir(h).length > 20, "pilihan tergambar");
    const awal = semuaTanya(h);
    // butir yang jawabannya berbeda menurut pengetahuan: pilih satu yang jawabnya ada untuk "ragu" pada saksi 1
    const tersusun = K.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: "228/Pdt.P/2026/PA.Dgl", keadaan: ker, saksi: [{ ...DUA[0], jenis: "ragu" }, DUA[1]] });
    const rows = { "saksi 1 p": tersusun.saksi[0].baris, "saksi 2 p": tersusun.saksi[1].baris };
    const calon = K.calonTambah({ kat: kn.kat, sebutan: kn.sebutan, benih: "228/Pdt.P/2026/PA.Dgl", keadaan: ker, saksi: [{ ...DUA[0], jenis: "ragu" }, DUA[1]], target: DUA.map((x) => x.kunci), rows }).calon;
    const sasaran = calon.find((x: Mod) => x.baris["saksi 1 p"].jenis === "ragu" && x.baris["saksi 1 p"].jawab && x.baris["saksi 2 p"].jenis === "melihat" && x.baris["saksi 2 p"].jawab && !/#\d{4}#|\.\.\./.test(x.baris["saksi 1 p"].jawab + x.baris["saksi 2 p"].jawab + x.baris["saksi 1 p"].tanya));
    expect(sasaran).toBeTruthy();
    klik(h, `[data-butir="${sasaran.id}"]`);
    await sampai(() => semuaTanya(h).length === awal.length + 1, "pertanyaan masuk");
    expect(semuaJawab(h, 0)[2]).toBe(sasaran.baris["saksi 1 p"].jawab);
    expect(semuaJawab(h, 1)[2]).toBe(sasaran.baris["saksi 2 p"].jawab);
  });

  it("hapus pertanyaan di mode dua saksi menghapus pertanyaan + keterangan KEDUA saksi; Simpan ke ABT menyimpan nomor berurut ulang tanpa baris itu", async () => {
    const h = await mulaiSaksiTersusun();
    const awal = semuaTanya(h);
    const j0 = semuaJawab(h, 0);
    const j1 = semuaJawab(h, 1);
    klik(h, '[data-sbhapus="4"]'); // nomor 5
    await sampai(() => semuaTanya(h).length === awal.length - 1, "baris dihapus");
    expect(semuaTanya(h)).toEqual([...awal.slice(0, 4), ...awal.slice(5)]);
    expect(semuaJawab(h, 0)).toEqual([...j0.slice(0, 4), ...j0.slice(5)]);
    expect(semuaJawab(h, 1)).toEqual([...j1.slice(0, 4), ...j1.slice(5)]);
    expect(qd(h, ".bd-hanya")).toHaveLength(0); // dihapus untuk kedua saksi: tetap sejajar
    expect(q(h, ".bd-hanyabanner")).toBeNull();
    // Simpan ke ABT: nomor 1..n berurutan, pertanyaan yang dihapus tidak ada, tanpa penanda internal
    klik(h, '[data-bd2="simpantj"]');
    await sampai(() => h.tj["5058"].length === awal.length - 1 && h.tj["5059"].length === awal.length - 1, "tersimpan");
    expect(h.tj["5058"].map((r) => r.no)).toEqual(h.tj["5058"].map((_, i) => String(i + 1)));
    expect(h.tj["5058"].map((r) => r.tanya)).not.toContain(awal[4]);
    expect(h.tj["5058"][4].tanya).toBe(awal[5]);
    expect(h.tj["5059"][4].jawab.toLowerCase()).toBe(j1[5].toLowerCase()); // disimpan berhuruf besar di awal
    expect(JSON.stringify(h.tj)).not.toMatch(/aleta|"butir"|ditambah|"hanya"/i);
    // Urungkan mengembalikan (sekali)
    klik(h, '[data-sbaksi="urung"]');
    await sampai(() => semuaTanya(h).length === awal.length, "diurungkan");
    expect(semuaTanya(h)).toEqual(awal);
    expect(semuaJawab(h, 0)).toEqual(j0);
  });

  it("hapus HANYA untuk satu saksi: tampilan berpindah ke saksi itu, pertanyaan yang hanya ada pada saksi lain ditandai, berdampingan memberi tahu, Urungkan mengembalikan", async () => {
    const h = await mulaiSaksiTersusun();
    const awal = semuaTanya(h);
    const j0 = semuaJawab(h, 0);
    const j1 = semuaJawab(h, 1);
    const tanya2 = qd(h, "[data-sbq]").map(nilaiTa);
    klik(h, '[data-sbhapus1="4.0"]'); // hapus nomor 5 hanya untuk saksi 1
    await sampai(() => qd(h, "textarea[data-tjb]").length > 0, "berpindah ke tampilan satu saksi");
    // tampilan berpindah ke saksi 1 (Satu per satu), saksi 1 kehilangan butir itu
    expect(qd(h, "[data-sba]")).toHaveLength(0);
    expect(q(h, '[data-tjmode="satu"]')!.getAttribute("aria-selected")).toBe("true");
    expect(tanyaSatu(h)).toEqual([...tanya2.slice(0, 4), ...tanya2.slice(5)]);
    expect(tanyaSatu(h)).toHaveLength(awal.length - 1);
    // banner menjelaskan: pertanyaan hanya ada pada saksi 2
    const banner = q(h, ".bd-hanyabanner")!;
    expect(banner.textContent).toMatch(/Saksi 1 Pemohon dan Saksi 2 Pemohon tidak sama lagi: 1 hanya pada Saksi 2 Pemohon/);
    // pindah ke saksi 2 lewat tombol di banner: pertanyaan yang tak ada pada saksi 1 ditandai "hanya ada pada Saksi 2"
    klik(h, '.bd-hanyabanner [data-bd2="lihatsaksi"]');
    await sampai(() => tanyaSatu(h).length === awal.length, "saksi 2 tampil");
    const tanda = qd(h, ".bd-hanya");
    expect(tanda).toHaveLength(1);
    expect(tanda[0].textContent).toBe("hanya ada pada Saksi 2 Pemohon");
    const tanya2Saksi2 = tanyaSatu(h);
    expect(nilaiTa(tanda[0].closest("tr")!.querySelector("textarea[data-sisi='tanya']")!)).toBe(tanya2Saksi2[4]);
    expect(tanya2Saksi2[4]).not.toBe(tanya2[4]); // rumusan pertanyaan tiap saksi boleh berbeda; dicocokkan menurut butir katalog
    expect(jawabSatu(h)).toEqual(j1);
    // hapus per saksi 2 juga tersedia di sini (hapus hanya untuk saksi ini) dan hasilnya sama lagi: tanda hilang
    klik(h, '[data-hapus="4"]');
    await sampai(() => tanyaSatu(h).length === awal.length - 1, "saksi 2 ikut dihapus");
    expect(qd(h, ".bd-hanya")).toHaveLength(0);
    expect(q(h, ".bd-hanyabanner")).toBeNull();
    klik(h, '[data-sbaksi="urung"]');
    await sampai(() => tanyaSatu(h).length === awal.length, "hapus saksi 2 diurungkan");
    expect(qd(h, ".bd-hanya")).toHaveLength(1);
    // kembali ke Berdampingan: banner dan tanda tampil di baris yang bersangkutan
    klik(h, '[data-tjmode="sisi"]');
    await sampai(() => qd(h, "[data-sbq]").length > 0, "berdampingan");
    expect(q(h, ".bd-hanyabanner")!.textContent).toMatch(/tidak sama lagi/);
    expect(qd(h, ".bd-hanya").length).toBeGreaterThanOrEqual(1);
    // Urungkan lagi (hapus pertama): kedua saksi sama lagi
    klik(h, '[data-sbaksi="urung"]');
    await sampai(() => !q(h, ".bd-hanyabanner"), "sama lagi");
    expect(semuaTanya(h)).toEqual(awal);
    expect(semuaJawab(h, 0)).toEqual(j0);
    expect(semuaJawab(h, 1)).toEqual(j1);
  });

  it("saksi yang pertanyaannya tidak sama: menambah pertanyaan hanya untuk satu saksi menandainya 'hanya ada pada saksi itu'", async () => {
    const h = await mulaiSaksiTersusun();
    klik(h, '[data-tjmode="satu"]');
    await sampai(() => qd(h, "textarea[data-tjb]").length > 0, "satu per satu");
    const awal = tanyaSatu(h);
    klik(h, '[data-bd2="pilihq"][data-pos="1"]');
    await sampai(() => teksButir(h).length > 20, "pilihan tergambar");
    expect(q(h, "#bd-pilihq")!.textContent).toContain("untuk Saksi 1 Pemohon");
    klik(h, `[data-butir="${qd(h, '[data-bd2="pilihq-pilih"]')[0].getAttribute("data-butir")}"]`);
    await sampai(() => tanyaSatu(h).length === awal.length + 1, "masuk");
    expect(tanyaSatu(h).slice(0, 1)).toEqual(awal.slice(0, 1));
    expect(tanyaSatu(h).slice(2)).toEqual(awal.slice(1));
    expect(qd(h, ".bd-hanya").map((e) => e.textContent)).toEqual(["hanya ada pada Saksi 1 Pemohon"]);
    expect(q(h, ".bd-hanyabanner")!.textContent).toMatch(/1 pertanyaan hanya ada pada Saksi 1 Pemohon/);
    klik(h, '[data-sbaksi="urung"]');
    await sampai(() => tanyaSatu(h).length === awal.length, "diurungkan");
    expect(q(h, ".bd-hanyabanner")).toBeNull();
  });

  it("susun ulang karena pengetahuan berubah: pertanyaan tambahan tetap ada, pertanyaan yang dihapus tidak kembali; Muat menyusun dari awal", async () => {
    const h = await mulaiSaksiTersusun();
    const awal = semuaTanya(h);
    klik(h, '[data-sbhapus="6"]');
    await sampai(() => semuaTanya(h).length === awal.length - 1, "dihapus");
    const hapus = awal[6];
    klik(h, '[data-bd2="pilihq"][data-pos="1"]');
    await sampai(() => teksButir(h).length > 20, "pilihan tergambar");
    const K: Mod = muat();
    void K;
    const butir = qd(h, '[data-bd2="pilihq-pilih"]')[0];
    const tambahan = (butir.textContent || "").trim();
    klik(h, `[data-butir="${butir.getAttribute("data-butir")}"]`);
    await sampai(() => semuaTanya(h).length === awal.length, "ditambah");
    const sebelum = semuaTanya(h);
    // pengetahuan saksi 2 berubah -> disusun ulang dari katalog
    pilihOpsi(h, "saksi 2 p", "kat-jenis", "tidak-tahu");
    await sampai(() => JSON.stringify(semuaJawab(h, 1)) !== JSON.stringify(semuaJawab(h, 1).map(() => "")) && /Disusun dari katalog/.test(akar(h).textContent || ""), "disusun ulang");
    await tunggu(100);
    const sesudah = semuaTanya(h);
    expect(sesudah.some((t) => t.startsWith(tambahan.slice(0, 20)))).toBe(true); // pertanyaan tambahan tetap
    expect(sesudah).not.toContain(hapus); // yang dihapus tidak kembali
    expect(sesudah.length).toBe(sebelum.length);
    // pilihan petugas tersimpan di peramban bersama daftar yang dihapus
    expect(JSON.stringify(h.simpanan)).toMatch(/"dihapus":\["q-/);
    // Muat = susun dari awal: pertanyaan yang dihapus kembali
    klik(h, '[data-bd2="muattpl"]');
    await sampai(() => semuaTanya(h).includes(hapus), "muat menyusun dari awal", 8000);
  });

  it("tersimpan seperti ketikan: hapus lalu tunggu - simpan otomatis menulis baris yang layak simpan dengan nomor berurut ulang", async () => {
    const h = await mulaiSaksiTersusun();
    const awal = semuaTanya(h);
    // dua jawaban diketik (menjadi ketikan petugas, layak simpan otomatis); lalu satu pertanyaan lain dihapus untuk kedua saksi
    ketik(h, qd(h, '[data-sba="0"][data-sk="0"]')[0] as unknown as HTMLInputElement, "Ketikan nomor satu saksi satu.", true);
    ketik(h, qd(h, '[data-sba="1"][data-sk="0"]')[0] as unknown as HTMLInputElement, "Ketikan nomor dua saksi satu.", true);
    ketik(h, qd(h, '[data-sba="2"][data-sk="0"]')[0] as unknown as HTMLInputElement, "Ketikan nomor tiga saksi satu.", true);
    await sampai(() => tulisSimpan(h).length >= 1, "simpan otomatis ketikan", 5000);
    await tunggu(300);
    const sebelumJumlah = tulisSimpan(h).length;
    klik(h, '[data-sbhapus="1"]');
    await sampai(() => tulisSimpan(h).length > sebelumJumlah, "simpan otomatis sesudah hapus", 5000);
    await tunggu(300);
    const terakhir = dikirim(tulisSimpan(h).filter((m) => /5058/.test(m.url)).at(-1)!);
    expect(terakhir.map((r) => r.no)).toEqual(terakhir.map((_, i) => String(i + 1)));
    expect(terakhir.map((r) => r.tanya)).toContain(awal[0]);
    expect(terakhir.map((r) => r.tanya)).toContain(awal[2]);
    expect(terakhir.map((r) => r.tanya)).not.toContain(awal[1]);
    expect(terakhir.find((r) => r.tanya === awal[2])!.no).toBe("2"); // nomor berurut ulang: yang tadinya nomor 3 kini nomor 2
    expect(JSON.stringify(terakhir)).not.toMatch(/aleta/i);
  });

  it("jenis perkara cerai (panel lama) tidak mendapat tombol Tambah pertanyaan katalog; fitur lama tetap ada", async () => {
    const gugat = await bukaSaksi({ jenis: "Cerai Gugat", alur: 15 }, false);
    await tunggu(100);
    expect(qd(gugat, '[data-bd2="pilihq"]')).toHaveLength(0);
    for (const s of ['[data-bd2="tambahtj"]', '[data-bd2="simpantj"]', '[data-sbaksi="urung"]']) expect(q(gugat, s), s).not.toBeNull();
  });

  it("fitur lama tetap: Tambah baris, naik/turun, tombol tukar/salin ada di tiap baris berdampingan; tombol hapus per saksi dan tambah pertanyaan ada di tiap baris", async () => {
    const h = await mulaiSaksiTersusun();
    const n = semuaTanya(h).length;
    for (const sel of ["[data-sbnaik]", "[data-sbturun]", "[data-sbhapus]", "[data-sbhapus1]", '[data-bd2="pilihq"]', "[data-sbganti]", "[data-sbsalin]"]) {
      expect(qd(h, sel).length, sel).toBeGreaterThanOrEqual(n);
    }
    klik(h, '[data-bd2="tambahtj"]');
    await sampai(() => semuaTanya(h).length === n + 1, "baris kosong ditambah");
    // tombol "+ Pertanyaan dari katalog" di bawah tabel membuka pilihan di posisi paling akhir
    klik(h, '.bd-tjkaki [data-bd2="pilihq"]');
    await sampai(() => q(h, "#bd-pilihq"), "pilihan di bawah");
    expect(q(h, "#bd-pilihq")!.textContent).toContain(`nomor ${n + 2}`);
    klik(h, '[data-bd2="pilihq-tutup"]');
    expect(q(h, "#bd-pilihq")).toBeNull();
  });
});
