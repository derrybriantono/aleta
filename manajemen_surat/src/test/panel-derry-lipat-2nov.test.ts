// @vitest-environment node
/**
 * ============================================================================
 * 2 NOV 2026 (sore) - PANEL "BLANGKO ABT BY DERRY BRIANTONO": butir 7, 8, 10, 11, 15
 * ============================================================================
 *
 * Dijalankan SUNGGUHAN di jsdom (blangko-derry-isian.js + modul rekomendasi/katalog/saksi-arah, fetch & chrome tiruan, nama rekaan):
 *   7  kotak "Rekomendasi putusan" bawaan TERLIPAT, satu baris chip "Rekomendasi: ... · keyakinan ...", rincian lengkap saat dibuka,
 *      buka/tutup diingat per pengguna (chrome.storage "lipatTerbuka" milik panel-alat.js);
 *   8  rekomendasi dan tanda "disarankan" di daftar Pilih blangko SINKRON: keyakinan cukup = arah rekomendasi (saran arah lain dibuang
 *      dari Disarankan); ragu = semua bertanda "disarankan · ragu", pilihan lain disebut; majelis sudah memutus = saran majelis di atas;
 *  10  urutan: alat bukti surat -> alat bukti elektronik -> TANYA JAWAB SAKSI -> bagian tertutup lain;
 *  11  bawaan "Yang diketahui saksi" saksi II = "Tahu seluruh alasan, melihat sendiri" (arah Tolak tetap "Tidak tahu");
 *  15  kotak "Keadaan perkara" (Pengetahuan saksi katalog) bawaan TERLIPAT satu baris, nilai bawaan arah kabul + data perkara dipakai
 *      kalimat saksi; dropdown tetap ada dan mengubah kalimat bila dipilih.
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
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "saksi-katalog.js", "saksi-katalog-data.js", "blangko-derry-saksi.js", "blangko-derry-saksi-arah.js", "blangko-derry-katalog.js", "blangko-derry-rekomendasi.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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
const BLANGKO_TOLAK = "[03] [Tolak] CG - F";
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
const DAFTAR_BELUM = [PK("581/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI("2026-10-15", "Pembacaan putusan", "", { urutan: 2 })], { sudahPutus: false })];
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
const rekomendasiMinta: Minta[] = [];
const penanganBot = async (_b: unknown) => ({ status: 503, json: { ok: false } as unknown });
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type BukaOpsi = { belumPutus?: boolean; rekomendasi?: unknown; orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; jenis?: string; alur?: number; nomor?: string; jumlahP?: number; portalLama?: boolean; tjAwal?: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array };
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
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos((p.belumPutus ? DAFTAR_BELUM : DAFTAR).map((d) => ({ ...d, ...(p.jenis ? { jenisPerkara: p.jenis } : {}), ...(p.alur ? { alurPerkaraId: p.alur } : {}), ...(p.nomor ? { nomorPerkara: `${p.nomor}/PA.Dgl` } : {}), ...(p.jumlahP ? { pihak: { penggugat: Array.from({ length: p.jumlahP }, (_, i) => `Pemohon ${i + 1}`), tergugat: [] } } : {}) }))) } });
    }
    if (url.includes("/aleta-ecourt/rekomendasi-putusan")) {
      rekomendasiMinta.push({ url, cara, badan });
      return p.rekomendasi ? json({ ok: true, data: polos(p.rekomendasi) }) : json({ ok: false, alasan: "tidak ada" }, 503);
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [{ sidangId: "s2026-10-01", tanggalSidang: "2026-10-01", jamSidang: "09:00:00", agenda: "Sidang Pertama", alasanDitunda: "Panggil Tergugat", urutanSidang: 1 }, { sidangId: "s2026-10-15", tanggalSidang: "2026-10-15", jamSidang: "09:00:00", agenda: p.belumPutus ? "Pembacaan putusan" : "Pemeriksaan pokok perkara", alasanDitunda: p.belumPutus ? "" : "putus DIKABULKAN (verstek)", urutanSidang: 2 }] } } });
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
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK("Putusan Cerai Gugat", [[BLANGKO_PUT, "A01", "B01"], ["[02] [Kabul] CG - F", "A02", "B02"], [BLANGKO_TOLAK, "A03", "B03"]]));
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
// Bahan rekomendasi (rekaan) - bentuk keluaran rute aleta-ecourt/rekomendasi-putusan
// ============================================================================
const E = path.resolve(process.cwd(), "../ekstensi-sipp");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const RP: Apa = require_(path.join(E, "blangko-derry-rekomendasi.js"));
const ARAH: Apa = require_(path.join(E, "blangko-derry-saksi-arah.js"));
const SAKSI: Apa = require_(path.join(E, "blangko-derry-saksi.js"));

const blangkoRek = (berkas: string, utama: boolean, alasan = "") => ({ jenis: "putusan", folder: "derry_briantono/1 Perceraian CG", berkas: `${berkas}.rtf`, menu: "Putusan CG", alias: [], label: berkas, alasan, utama, perkiraan: false });
const unsurContoh = [
  { id: "hubungan", judul: "Hubungan hukum perkawinan", status: "terbukti", ringkas: "terbukti dengan P.2", bukti: [{ kode: "P.2", kelas: "akta autentik", membuktikan: "perkawinan" }], saksi: [], catatan: [], dasar: ["Pasal 7 ayat (1) Kompilasi Hukum Islam"] },
  { id: "alasan", judul: "Perselisihan terus-menerus", status: "tidak-terbukti", ringkas: "saksi tidak mengetahui pertengkaran", bukti: [], saksi: [{ label: "Saksi 1", langsung: false, sebaliknya: true, hubungan: "Paman", kutipan: "rukun-rukun saja" }], catatan: [], dasar: [] },
];
function dataRek(o: { hasil: string; label: string; keyakinan: "cukup" | "ragu"; blangko: object[]; pilihanLain?: object | null; sebabRagu?: string[] }) {
  return {
    ada: true,
    denganPenilaian: false,
    rekomendasi: {
      versi: 1, jenis: "cerai-gugat", hasil: o.hasil, verstek: false, label: o.label, statusSipp: o.label, keyakinan: o.keyakinan, sebabRagu: o.sebabRagu || [],
      unsur: unsurContoh, belum: ["Perselisihan terus-menerus"], blangko: o.blangko, pilihanLain: o.pilihanLain || null, ringkas: "1 unsur terbukti, 1 belum/tidak terbukti",
      jumlahSaksi: { P: 2, T: 0 }, jumlahBukti: 2, ms: 1,
    },
  };
}
const REK_TOLAK_CUKUP = dataRek({ hasil: "ditolak", label: "Ditolak", keyakinan: "cukup", blangko: [blangkoRek(BLANGKO_TOLAK, true, "Rekomendasi menurut alat bukti dan keterangan saksi: ditolak.")] });
const REK_TOLAK_RAGU = dataRek({
  hasil: "ditolak", label: "Ditolak", keyakinan: "ragu", sebabRagu: ["keterangan saksi saling berbeda"],
  blangko: [blangkoRek(BLANGKO_TOLAK, true, "Rekomendasi menurut alat bukti dan keterangan saksi: ditolak."), blangkoRek("[02] [Kabul] CG - F", false, "Pilihan lain bila majelis menilai lain: dikabulkan (ragu).")],
  pilihanLain: { hasil: "dikabulkan", label: "Dikabulkan", keyakinan: "ragu", alasan: "Bila majelis menilai saksi cukup.", blangko: "[02] [Kabul] CG - F" },
});

const ringkas = (h: Halaman) => q(h, "#bd-blringkas")!.closest(".bd-tk")!.parentElement as HTMLElement;
const lencanaDi = (h: Halaman, berkas: string) => {
  const t = q(h, `#bd-modal [data-bl="${berkas}"]`);
  return t ? Array.from(t.querySelectorAll(".bd-lencana")).map((x) => x.textContent || "") : null;
};
const sebelum = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & 4);
async function bukaRekomendasi(p: BukaOpsi) {
  const h = buka(p);
  await sampaiPerkara(h);
  await sampai(() => q(h, "#bd-rekput .bd-rp-chip") && /Rekomendasi:/.test(q(h, "#bd-rekput .bd-rp-chip")!.textContent || ""), "kotak rekomendasi terisi");
  return h;
}

// ============================================================================
// 7 + 8: rekomendasi putusan terlipat & sinkron dengan saran blangko
// ============================================================================
describe("butir 7: Rekomendasi putusan bawaan terlipat satu baris, dibuka dengan klik, diingat per pengguna", () => {
  it("terlipat bawaan: chip ringkas hasil + keyakinan; rincian lengkap (unsur, dasar, blangko) tetap ada di dalam dan tampil saat dibuka", async () => {
    const h = await bukaRekomendasi({ belumPutus: true, rekomendasi: REK_TOLAK_CUKUP });
    const kotak = q(h, "#bd-rekput") as HTMLDetailsElement;
    expect(kotak.tagName).toBe("DETAILS");
    expect(kotak.open).toBe(false);
    const ringkasan = kotak.querySelector(":scope > summary")!;
    expect(ringkasan.querySelector(".bd-rp-chip")!.textContent).toBe("Rekomendasi: Ditolak · keyakinan cukup");
    expect(ringkasan.querySelector(".bd-rp-chip")!.className).toBe("bd-rp-chip cukup");
    // Fungsi tidak hilang: unsur, kutipan saksi, dasar hukum, kalimat blangko ada di rincian.
    const isi = kotak.querySelector(".bd-rp-isi")!;
    expect(isi.querySelectorAll(".bd-rp-unsur")).toHaveLength(2);
    expect(isi.textContent).toContain("Pasal 7 ayat (1) Kompilasi Hukum Islam");
    expect(isi.textContent).toContain("rukun-rukun saja");
    expect(isi.textContent).not.toMatch(/aleta/i);
    // Membuka: klik ringkasan -> pilihan diingat di ingatan lipat bersama (panel-alat.js, chrome.storage "lipatTerbuka").
    (ringkasan as HTMLElement).click();
    await sampai(() => (h.simpanan.lipatTerbuka as Record<string, boolean> | undefined)?.["blangkoDerry:rekomendasiPutusan"] === true, "pilihan buka tersimpan");
    expect(h.w.AletaBdRekomendasi.terbuka()).toBe(true);
    // Digambar ulang (mis. setelah data tiba) tetap terbuka.
    expect(h.w.AletaBdRekomendasi.htmlBungkus("581/Pdt.G/2026/PA.Dgl", "Cerai Gugat", "", false)).toMatch(/<details class="bd-rekput"[^>]* open>/);
  });

  it("pengguna yang dulu membukanya: halaman baru menampilkan kotak terbuka; yang menutup: tetap terlipat", async () => {
    const h = await bukaRekomendasi({ belumPutus: true, rekomendasi: REK_TOLAK_CUKUP, simpanan: { lipatTerbuka: { "blangkoDerry:rekomendasiPutusan": true } } });
    await sampai(() => (q(h, "#bd-rekput") as HTMLDetailsElement).open, "terbuka dari ingatan");
    const h2 = await bukaRekomendasi({ belumPutus: true, rekomendasi: REK_TOLAK_CUKUP, simpanan: { lipatTerbuka: { "blangkoDerry:rekomendasiPutusan": false } } });
    await tunggu(30);
    expect((q(h2, "#bd-rekput") as HTMLDetailsElement).open).toBe(false);
  });

  it("chip ringkas (murni): menyusun / belum terbaca / pilihan lain; ukuran huruf CSS >= 11,5px dan warna dari token", () => {
    expect(RP.ringkasChip(null, "")).toEqual({ teks: "menyusun…", kelas: "abu" });
    expect(RP.ringkasChip(null, "server mati")).toEqual({ teks: "belum terbaca", kelas: "abu" });
    expect(RP.ringkasChip(REK_TOLAK_RAGU, "").teks).toBe("Rekomendasi: Ditolak · keyakinan ragu · pilihan lain Dikabulkan");
    const css = readFileSync(path.join(E, "blangko-derry.css"), "utf8");
    const blok = css.slice(css.indexOf("2 Nov sore (butir 7, 8, 15)"));
    for (const m of blok.matchAll(/font-size:\s*([\d.]+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(11.5);
    expect(blok).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|animation|transition/i);
  });
});

describe("butir 8: rekomendasi putusan dan tanda 'disarankan' satu sumber", () => {
  it("keyakinan cukup (ditolak): saran perkiraan 'Kabul Verstek' tidak lagi disarankan; blangko tolak disarankan paling atas, kalimat kotak menyebut blangko yang sama", async () => {
    const h = await bukaRekomendasi({ belumPutus: true, rekomendasi: REK_TOLAK_CUKUP });
    await sampai(() => /Saran untuk sidang/.test(q(h, "#bd-saranblangko")?.textContent || ""), "kalimat saran");
    await tunggu(50); // daftar kelompok termuat: saran perkiraan "kabul" tetap tidak naik ke atas
    expect(q(h, "#bd-saranblangko")!.innerHTML).toContain("<b>[Tolak] CG - F</b>");
    expect(q(h, "#bd-rekput .bd-rp-blangko")!.textContent).toContain(`Blangko yang disarankan: ${BLANGKO_TOLAK}`);
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, `#bd-modal [data-bl="${BLANGKO_TOLAK}"]`), "jendela pilih blangko");
    // Kelompok "Disarankan" (pertama, terpilih): hanya blangko tolak - arah rekomendasi.
    expect(q(h, "#bd-modal .bd-kel.aktif")!.textContent).toContain("Disarankan");
    expect(lencanaDi(h, BLANGKO_TOLAK)).toEqual(["disarankan"]);
    expect(lencanaDi(h, BLANGKO_PUT)).toBeNull(); // tidak ada di Disarankan
    klik(h, '#bd-modal [data-kelmodal="k:Putusan CG"]');
    await sampai(() => q(h, `#bd-modal [data-bl="${BLANGKO_PUT}"]`), "kelompok putusan");
    expect(lencanaDi(h, BLANGKO_PUT)).toEqual([]); // blangko kabul tetap dapat dipilih, tanpa tanda disarankan
    expect(lencanaDi(h, BLANGKO_TOLAK)).toEqual(["disarankan"]);
  });

  it("keyakinan ragu: tidak ada yang tampil pasti - semua 'disarankan · ragu', pilihan lain disebut di kotak dan kalimat saran", async () => {
    const h = await bukaRekomendasi({ belumPutus: true, rekomendasi: REK_TOLAK_RAGU });
    await sampai(() => /Saran \(ragu\)/.test(q(h, "#bd-saranblangko")?.textContent || ""), "kalimat saran ragu");
    expect(q(h, "#bd-saranblangko")!.textContent).toContain("pilihan lain: [Kabul] CG - F");
    expect(q(h, "#bd-rekput .bd-rp-chip")!.className).toBe("bd-rp-chip ragu");
    expect(q(h, "#bd-rekput .bd-rp-blangko")!.textContent).toMatch(/\(ragu\): \[03\] \[Tolak\] CG - F; pilihan lain: \[02\] \[Kabul\] CG - F\. .*tidak dipilih otomatis/);
    klik(h, '[data-bd2="bukamodal"]');
    // Saran perkiraan lama (cadangan "putus" -> kabul verstek) muncul sesudah daftar kelompok termuat.
    await sampai(() => q(h, `#bd-modal [data-bl="${BLANGKO_TOLAK}"]`) && q(h, `#bd-modal [data-bl="${BLANGKO_PUT}"]`), "jendela pilih blangko");
    expect(lencanaDi(h, BLANGKO_TOLAK)).toEqual(["disarankan · ragu"]);
    expect(lencanaDi(h, "[02] [Kabul] CG - F")).toEqual(["disarankan · ragu"]);
    // Saran perkiraan lama (kabul verstek) dipertahankan sebagai pilihan, tetapi juga bertanda ragu.
    expect(lencanaDi(h, BLANGKO_PUT)).toEqual(["disarankan · ragu"]);
    expect(qq(h, "#bd-modal .bd-lencana").map((x) => x.textContent)).not.toContain("disarankan");
  });

  it("majelis sudah memutus (SIPP/keterangan sidang): saran majelis tetap di atas, kotak menyatakan saran mengikuti majelis", async () => {
    const h = await bukaRekomendasi({ rekomendasi: REK_TOLAK_CUKUP });
    expect(q(h, "#bd-rekput .bd-rp-blangko")!.textContent).toContain("Majelis sudah memutus: saran blangko mengikuti putusan majelis");
    // Saran majelis (keterangan "putus DIKABULKAN (verstek)") di atas begitu daftar kelompok termuat; rekomendasi berbeda di bawahnya.
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, `#bd-modal [data-bl="${BLANGKO_PUT}"]`) && q(h, `#bd-modal [data-bl="${BLANGKO_TOLAK}"]`), "jendela pilih blangko");
    const urut = qq(h, "#bd-modal [data-bl]").map((x) => x.getAttribute("data-bl"));
    expect(urut.indexOf(BLANGKO_PUT)).toBeLessThan(urut.indexOf(BLANGKO_TOLAK));
    expect(lencanaDi(h, BLANGKO_PUT)).toEqual(["disarankan"]);
  });

  it("aturan murni: arah blangko dari tanda nama; cukup membuang arah bertentangan, ragu menandai semua, tanpa rekomendasi tidak berubah", () => {
    expect(["[01] [Kabul Verstek] Cerai", "[03] [Tolak] DK - x", "[05] [NO] Cerai", "[98] [Gugur] 3. Cerai", "[1] [Sela Kabul] Provisi", "[02] [Kabul Sebagian] HB"].map(RP.arahBlangko)).toEqual([
      "dikabulkan", "ditolak", "tidak-dapat-diterima", "", "", "dikabulkan",
    ]);
    const menu = [{ nama: "Putusan CG", berkas: [{ berkas: BLANGKO_PUT }, { berkas: "[02] [Kabul] CG - F" }, { berkas: BLANGKO_TOLAK }] }];
    const lama = [
      { berkas: BLANGKO_PUT, jenis: "put", kelompok: "Putusan CG", utama: true, alasan: "diperkirakan dikabulkan" },
      { berkas: "[98] [Gugur] 3. Cerai P & T Tidak Hadir", jenis: "put", kelompok: "Putusan CG" },
      { berkas: "BAS ALUR 01 [1a]", jenis: "bas", kelompok: "BAS CG" },
    ];
    const cukup = RP.gabungSaran(lama, RP.saranBlangko(REK_TOLAK_CUKUP, menu), false);
    expect(cukup.map((x: Apa) => [x.berkas, Boolean(x.utama), Boolean(x.ragu)])).toEqual([
      [BLANGKO_TOLAK, true, false],
      ["[98] [Gugur] 3. Cerai P & T Tidak Hadir", false, false],
      ["BAS ALUR 01 [1a]", false, false],
    ]);
    const ragu = RP.gabungSaran(lama, RP.saranBlangko(REK_TOLAK_RAGU, menu), false);
    expect(ragu.filter((x: Apa) => x.jenis === "put").every((x: Apa) => x.ragu === true)).toBe(true);
    expect(ragu.map((x: Apa) => x.berkas)).toEqual([BLANGKO_TOLAK, "[02] [Kabul] CG - F", BLANGKO_PUT, "[98] [Gugur] 3. Cerai P & T Tidak Hadir", "BAS ALUR 01 [1a]"]);
    expect(RP.gabungSaran(lama, [], false)).toEqual(lama);
    // Saran lama yang SAMA dengan rekomendasi ikut membawa keyakinannya.
    const kembar = RP.gabungSaran([{ berkas: BLANGKO_TOLAK, jenis: "put", kelompok: "Putusan CG" }], RP.saranBlangko(REK_TOLAK_RAGU, menu), false);
    expect(kembar.find((x: Apa) => x.berkas === BLANGKO_TOLAK)).toMatchObject({ rekomendasiBukti: true, ragu: true });
    // Semua blangko rekomendasi sudah ada di saran lama: yang bertentangan tetap dibuang, blangko rekomendasi naik dan menjadi utama.
    const lamaKembar = [{ berkas: BLANGKO_PUT, jenis: "put", kelompok: "Putusan CG", utama: true }, { berkas: BLANGKO_TOLAK, jenis: "put", kelompok: "Putusan CG" }];
    expect(RP.gabungSaran(lamaKembar, RP.saranBlangko(REK_TOLAK_CUKUP, menu), false).map((x: Apa) => [x.berkas, Boolean(x.utama)])).toEqual([[BLANGKO_TOLAK, true]]);
    // Majelis sudah memutus: saran majelis tidak ikut "ragu" walau sama dengan rekomendasi yang ragu.
    const majelis = RP.gabungSaran([{ berkas: BLANGKO_TOLAK, jenis: "put", kelompok: "Putusan CG", utama: true }], RP.saranBlangko(REK_TOLAK_RAGU, menu), true);
    expect(majelis[0]).toMatchObject({ berkas: BLANGKO_TOLAK, utama: true, rekomendasiBukti: true });
    expect(majelis[0].ragu).toBeUndefined();
  });
});

// ============================================================================
// 10: urutan bukti surat -> bukti elektronik -> tanya jawab saksi
// ============================================================================
describe("butir 10: tanya jawab saksi di bawah alat bukti surat dan alat bukti elektronik", () => {
  it("BAS: kotak bukti (surat, lalu bukti elektronik) sebelum TANYA JAWAB SAKSI; bagian tertutup lain sesudahnya", async () => {
    const h = buka({ orang: "pp" });
    await pilihBas(h);
    await sampai(() => q(h, '#bd-perlu [data-f="1214"] .bd-bukti'), "kotak bukti termuat");
    await sampai(() => q(h, "#bd-tjtombol [data-tj]"), "tombol tanya jawab");
    const bukti = q(h, '#bd-perlu [data-f="1214"]')!;
    const tj = q(h, "#bd-tjtombol")!;
    expect(sebelum(bukti, tj)).toBe(true);
    // Kotak bukti adalah kotak TERAKHIR di Perlu diisi.
    const kotak = qq(h, "#bd-perlu > .bd-f");
    expect(kotak[kotak.length - 1]).toBe(bukti);
    // Bukti elektronik dibuka: bagiannya di dalam kotak bukti, sesudah bukti surat, sebelum tanya jawab saksi.
    klik(h, '[data-belbuka="P"]');
    await sampai(() => q(h, '#bd-perlu [data-f="1214"] .bd-bel [data-belbuka="P"][aria-expanded="true"]'), "bukti elektronik terbuka");
    const el = q(h, '#bd-perlu [data-f="1214"] .bd-bel')!;
    const surat = qq(h, '#bd-perlu [data-f="1214"] .bd-bukti').filter((x) => !x.closest(".bd-bel"));
    expect(surat.length).toBeGreaterThan(0);
    expect(sebelum(surat[surat.length - 1], el)).toBe(true);
    expect(sebelum(el, q(h, "#bd-tjtombol")!)).toBe(true);
    // Bagian tertutup (isian tambahan / di dalam bagian otomatis) tidak lagi menyela antara bukti dan tanya jawab.
    for (const s of ["#bd-lanjutan", ".bd-tambahan"]) {
      const x = q(h, s);
      if (x) expect(sebelum(q(h, "#bd-tjwadah")!, x)).toBe(true);
    }
  });
});

describe("butir 10 (putusan): bagian tertutup 'Isian di dalam bagian otomatis' tidak lagi menyela bukti dan tanya jawab saksi", () => {
  it("putusan (hakim): alat bukti -> tanya jawab saksi -> Isian di dalam bagian otomatis", async () => {
    const h = buka({ orang: "hakim" });
    await pilihPutusan(h);
    await sampai(() => q(h, '#bd-perlu [data-f="1214"] .bd-bukti') && q(h, "#bd-tjtombol [data-bd2]") && q(h, "#bd-lanjutan"), "bukti, tanya jawab, dan bagian otomatis tergambar");
    const bukti = q(h, '#bd-perlu [data-f="1214"]')!;
    const tj = q(h, "#bd-tjtombol")!;
    const lanjut = q(h, "#bd-lanjutan")!;
    expect(tj.textContent).toMatch(/Tanya jawab saksi/i);
    expect(sebelum(bukti, tj)).toBe(true);
    expect(sebelum(tj, lanjut)).toBe(true);
    // Fungsi lama tetap: isian 8503 masih ada di bagian otomatis.
    expect(qq(h, "#bd-lanjutan .bd-f").map((f) => f.getAttribute("data-f"))).toContain("8503");
  });
});

// ============================================================================
// 11: bawaan pengetahuan saksi II
// ============================================================================
describe("butir 11: bawaan 'Yang diketahui saksi' saksi II = tahu seluruh alasan, melihat sendiri", () => {
  it("murni: semua urutan saksi 'sama'; arah Tolak tetap 'tidak tahu', NO 'sama', saksi Tergugat 'sama'; pilihan lain tetap ada", () => {
    expect([0, 1, 2, 3].map((u) => ARAH.modusBawaan(u, {}))).toEqual(["sama", "sama", "sama", "sama"]);
    expect(ARAH.modusBawaan(1, { arah: "tolak" })).toBe("tidak-tahu-apa");
    expect(ARAH.modusBawaan(1, { arah: "no" })).toBe("sama");
    expect(ARAH.modusBawaan(1, { pihak: "T" })).toBe("sama");
    expect(SAKSI.DAFTAR_MODUS.map((x: string[]) => x[0])).toEqual(["sama", "mendengar", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah", "ragu"]);
    expect(SAKSI.DAFTAR_MODUS[0][1]).toBe("Tahu seluruh alasan, melihat sendiri");
  });

  it("panel cerai (PP, BAS): kartu Saksi 2 terpilih 'Tahu seluruh alasan, melihat sendiri' dan permintaan susun mengirim 'sama'", async () => {
    const h = buka({ orang: "pp" });
    await pilihBas(h);
    klik(h, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h, '[data-skkunci="saksi 2 p"][data-skfld="modus"]'), "kartu saksi 2");
    const s2 = q(h, '[data-skkunci="saksi 2 p"][data-skfld="modus"]') as HTMLSelectElement;
    expect(s2.value).toBe("sama");
    expect(s2.options[s2.selectedIndex].textContent).toBe("Tahu seluruh alasan, melihat sendiri");
    expect(Array.from(s2.options).map((o) => o.value)).toContain("sebagian"); // pilihan lain tetap ada
    // Pilihan baku yang dikirim ke penyusun jawaban (bakukanPilihan) untuk saksi kedua juga "sama".
    expect(SAKSI.bakukanPilihan(undefined, 1, {}).modus).toBe("sama");
    expect(SAKSI.bakukanPilihan(undefined, 1, { arah: "tolak" }).modus).toBe("tidak-tahu-apa");
  });
});

// ============================================================================
// 15: Keadaan perkara terlipat, bawaan arah kabul + data perkara
// ============================================================================
describe("butir 15: kotak Keadaan perkara (Pengetahuan saksi katalog) terlipat satu baris, bawaan dipakai kalimat saksi", () => {
  const JENIS_ITSBAT = { jenis: "Pengesahan Perkawinan/Istbat Nikah", alur: 16, nomor: "228/Pdt.P/2026", jumlahP: 2 };
  const semuaJawab = (h: Halaman) => qq(h, "[data-sba]").map((x) => (x as HTMLTextAreaElement).value).join("\n");
  async function bukaItsbat(p: BukaOpsi = {}) {
    const h = buka({ orang: "pp", ...JENIS_ITSBAT, ...p });
    await pilihBas(h);
    klik(h, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h, ".bd-skkeadaanlipat"), "kotak keadaan perkara");
    await sampai(() => qq(h, "[data-sbq]").length >= 10, "pertanyaan tersusun");
    return h;
  }

  it("terlipat bawaan: satu baris 'Keadaan perkara: otomatis menurut data perkara (arah kabul) · ... · Ubah'; dropdown ada di dalam lipatan dengan nilai arah kabul", async () => {
    const h = await bukaItsbat();
    const d = q(h, ".bd-skkeadaanlipat") as HTMLDetailsElement;
    expect(d.open).toBe(false);
    const baris = d.querySelector(":scope > summary")!.textContent || "";
    expect(baris).toMatch(/^Keadaan perkara: otomatis menurut data perkara \(arah kabul\) · 1 terbaca dari data perkara · Ubah · Lipat$/);
    // Rincian tetap ada (fungsi tidak hilang), tersembunyi di dalam lipatan.
    const nilai = (k: string) => (d.querySelector(`[data-skkunci="__perkara"][data-skfld="kat-keadaan:${k}"]`) as HTMLSelectElement).value;
    expect(nilai("bentuk")).toBe("permohonan-berdua"); // dari data perkara (dua pemohon)
    expect(nilai("dasarItsbat")).toBe("huruf-e"); // tidak ada halangan perkawinan
    expect(nilai("bentukKesaksian")).toBe("langsung"); // saksi menyaksikan sendiri
    expect(nilai("penikah")).toBe("imam-penghulu");
    expect(d.querySelector(".bd-skkeadaanisi")!.contains(d.querySelector('[data-skfld="kat-keadaan:bentuk"]'))).toBe(true);
    // Kalimat saksi memakai bawaan itu: saksi menyaksikan sendiri, bukan kabar yang tersiar luas.
    expect(semuaJawab(h)).not.toMatch(/tersiar luas/);
  });

  it("membuka & mengubah: pilihan dropdown mengubah kalimat saksi, baris ringkas menyebut yang diubah, buka/tutup diingat", async () => {
    const h = await bukaItsbat();
    (q(h, ".bd-skkeadaanlipat > summary") as HTMLElement).click();
    await sampai(() => (h.simpanan.lipatTerbuka as Record<string, boolean> | undefined)?.["blangkoDerry:keadaanPerkara"] === true, "pilihan buka tersimpan");
    pilihOpsi(h, "__perkara", "kat-keadaan:bentukKesaksian", "istifadhah");
    await sampai(() => /tersiar luas/.test(semuaJawab(h)), "kalimat istifadhah tersusun");
    const d = q(h, ".bd-skkeadaanlipat") as HTMLDetailsElement;
    expect(d.open).toBe(true); // digambar ulang tetap terbuka
    expect(d.querySelector(":scope > summary")!.textContent).toContain("· 1 diubah petugas");
    // Halaman baru: ingatan per pengguna membuka kotak sendiri.
    const h2 = await bukaItsbat({ simpanan: { lipatTerbuka: { "blangkoDerry:keadaanPerkara": true } } });
    await sampai(() => (q(h2, ".bd-skkeadaanlipat") as HTMLDetailsElement).open, "terbuka dari ingatan");
  });

  it("murni: ringkasKeadaan menyebut arah putusan blangko dan yang diubah; keadaanHtml terlipat kecuali diminta terbuka", () => {
    const K = require_(path.join(E, "blangko-derry-katalog.js"));
    const bidang = [
      { kunci: "bentuk", label: "Bentuk", perSaksi: false, dariData: true, jamak: false, nilai: [{ nilai: "a", label: "A" }], terpilih: ["a"] },
      { kunci: "x", label: "X", perSaksi: false, dariData: false, jamak: false, nilai: [{ nilai: "b", label: "B" }], terpilih: ["b"] },
      { kunci: "kedudukanSaksi", label: "Peran", perSaksi: true, dariData: false, jamak: false, nilai: [], terpilih: [] },
    ];
    expect(K.ringkasKeadaan(bidang, {})).toBe("Keadaan perkara: otomatis menurut data perkara (arah kabul) · 1 terbaca dari data perkara");
    expect(K.ringkasKeadaan(bidang, { diubah: 1, arah: "tolak" })).toBe("Keadaan perkara: otomatis menurut data perkara (blangko ditolak) · 1 terbaca dari data perkara · 1 diubah petugas");
    expect(K.keadaanHtml(bidang, "", {})).toMatch(/<details class="bd-skkeadaanlipat">/);
    expect(K.keadaanHtml(bidang, "", { buka: true })).toMatch(/<details class="bd-skkeadaanlipat" open>/);
    expect(K.keadaanHtml(bidang, "", {})).not.toMatch(/aleta/i);
  });
});
