// @vitest-environment node
/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI D, D6: ISIAN BAS PER SIDANG DI BLANGKO DERRY (U12)
 * ============================================================================
 * Harness disalin dari blangko-derry-isian-16okt.test.ts (blangko-derry*.js dijalankan SUNGGUHAN di jsdom, portal, bot, ABT
 * ditiru di fetch; cetak sampai RTF dan PDF). Yang dijaga:
 *   A  saklar MATI (bawaan): BAS persis seperti sebelumnya - tidak ada ingatan, tidak ada catatan, tidak ada tulisan sementara ke ABT
 *   B  saklar MENYALA: isian ketikan BAS diingat server PER SIDANG (hanya BAS dan hanya isian teks/tanggal)
 *   C  catatan di bawah isian yang nilai sidang ini berbeda dari ABT; "Pakai di layar" ditekan petugas sendiri
 *   D  CETAK BAS sidang tertentu: isian sidang itu ditulis ke ABT SEMENTARA, naskah memuatnya, lalu ABT dipulihkan persis seperti semula
 *   E  gagal menulis di tengah: yang sudah ditulis dipulihkan dan cetak dibatalkan (tidak mencetak BAS dengan isian sidang lain)
 *   F  cetak yang terputus: daftar pemulihan di penyimpanan peramban memulihkan ABT begitu perkara dibuka lagi, tanpa menimpa suntingan baru
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
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1214", "2021", "2022", "0156", "0184", "8536", "0227", "11111", "11116", "11117", "0033"];
const PENANDA_BAS = ["0001", "0033", "0050", "1214", "5058", "5059", "8503", "0007", "9134"];
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

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array; sidang?: SidangSrv; tulis?: Array<[string, string]>; gagalNilai?: string[] } = {}): Halaman {
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
    const dariSidang = p.sidang ? jawabSidang(p.sidang, url, cara, badan) : undefined;
    if (dariSidang) return dariSidang;
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
        const nilaiTulis = String(f.get("value") || "");
        if (p.gagalNilai && p.gagalNilai.includes(nilaiTulis)) return html(`<font color='red' size='2'>GAGAL</font>`);
        abt[kode] = nilaiTulis;
        if (p.tulis) p.tulis.push([kode, nilaiTulis]);
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      const def = KATALOG.get(kode);
      const tipe = def ? def.jenis : "";
      if (kode === "0050") return html(POPUP(kode, "multi_sidang", String(q.get("d") || "1") === "9" ? "" : String(q.get("d") || "1")));
      if (kode === "0007" && !abt[kode] && !p.sidang) return html(POPUP(kode, "data_teks", "belum dikaruniai anak"));
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
// Portal isian-sidang tiruan
// ============================================================================
type SidangSrv = { aktif: boolean; gagal?: boolean; tersimpan: Record<string, Array<{ kode: string; nilai: string }>>; posts: Array<Record<string, any>>; tanya: number };
/** tersimpan: kunci "perkaraId|sidang" -> isian. */
const sidangBaru = (aktif: boolean, tersimpan: SidangSrv["tersimpan"] = {}): SidangSrv => ({ aktif, tersimpan, posts: [], tanya: 0 });
function jawabSidang(s: SidangSrv, url: string, cara: string, badan: string) {
  if (!/\/aleta-ecourt\/isian-sidang/.test(url)) return undefined;
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  if (/isian-sidang\?bagian=saklar/.test(url)) {
    s.tanya += 1;
    return s.gagal ? json({ ok: false }, 500) : json({ ok: true, data: { aktif: s.aktif } });
  }
  if (cara === "GET" && /isian-sidang\?perkaraId=/.test(url)) {
    if (s.gagal) return json({ ok: false }, 500);
    const q = new URL(url, "http://x").searchParams;
    const kunci = `${q.get("perkaraId")}|${q.get("sidang")}`;
    return json({ ok: true, data: { aktif: s.aktif, isian: s.aktif ? (s.tersimpan[kunci] ?? []).map((x) => ({ ...x, diubahAt: "2026-10-14T01:00:00.000Z" })) : [] } });
  }
  if (cara === "POST") {
    const isi = JSON.parse(badan || "{}");
    s.posts.push(isi);
    if (s.aktif) {
      const kunci = `${isi.perkaraId}|${isi.sidang}`;
      s.tersimpan[kunci] = (s.tersimpan[kunci] ?? []).filter((x) => x.kode !== isi.kode).concat([{ kode: isi.kode, nilai: String(isi.nilai ?? "") }]);
    }
    return json({ ok: true, data: { aktif: s.aktif, disimpan: s.aktif, sebab: "" } });
  }
  return json({ ok: false }, 404);
}
const postSidang = (h: Halaman) => h.minta.filter((m) => /isian-sidang/.test(m.url) && m.cara === "POST");
const tanyaSidang = (h: Halaman) => h.minta.filter((m) => /isian-sidang\?perkaraId=/.test(m.url));
async function pilihBasPp(h: Halaman) {
  await pilihBas(h);
  await sampai(() => q(h, "#bd-i0007"), "kotak 0007 di BAS");
}
const sidangDipilih = (h: Halaman): string => String(h.w.aletaBlangkoDerry.perkaraTerpilih?.().sidangDipilih?.urutan ?? "");
const centangPdf = (h: Halaman) => (q(h, '[data-fmt="pdf"]') as HTMLInputElement).click();
/** Menekan Cetak; bila pengingat isian kosong tampil, "Tetap cetak". Menunggu PDF jadi. */
async function cetakBas(h: Halaman): Promise<number> {
  centangPdf(h);
  klik(h, '[data-bd2="cetak"]');
  await sampai(() => {
    const e = q(h, "#bd-ingat");
    return (e && !e.hidden) || h.latar.some((m) => m.jenis === "unduh");
  }, "pengingat atau unduhan", 8000);
  if (q(h, '[data-bd2="tetapcetak"]') && !h.latar.some((m) => m.jenis === "unduh")) {
    klik(h, '[data-bd2="tetapcetak"]');
    return 2; // pengingat isian kosong tampil dulu: naskah diambil dua kali (tiap pengambilan memakai isian sidang lalu memulihkan)
  }
  return 1;
}
/** Urutan tulis ke ABT untuk n kali pengambilan naskah: tiap kali "sementara" lalu "pulih". */
const siklus = (n: number, sementara: [string, string][], pulih: [string, string][]) => Array.from({ length: n }, () => [...sementara, ...pulih]).flat();
const MINTA_PDF = (h: Halaman) => h.pdfRtf.join("\n");

// ============================================================================
describe("D6 - isian BAS per sidang: saklar MATI (bawaan) = perilaku lama persis", () => {
  it("mengetik isian BAS: ABT ditulis seperti dulu; tidak ada ingatan, catatan, atau tulisan sementara; cetak memakai isi ABT", async () => {
    const s = sidangBaru(false, { "10154|2": [{ kode: "0007", nilai: "dua anak" }] });
    const tulis: Array<[string, string]> = [];
    const h = buka({ orang: "pp", sidang: s, tulis, abtAwal: { "0007": "satu anak" } });
    await pilihBasPp(h);
    await tunggu(80);
    expect(q(h, "[data-sidang-kode]")).toBeNull();
    ketik(h, q(h, "#bd-i9134") as HTMLInputElement, "uji");
    await sampai(() => h.abt["9134"] === "uji", "9134 tersimpan");
    await cetakBas(h);
    await sampai(() => h.pdfRtf.length >= 1, "PDF", 8000);
    expect(MINTA_PDF(h)).toContain("satu anak");
    expect(MINTA_PDF(h)).not.toContain("dua anak");
    expect(postSidang(h)).toEqual([]);
    expect(tanyaSidang(h)).toEqual([]);
    expect(tulis).toEqual([["9134", "uji"]]); // hanya ketikan petugas; tanpa tulisan sementara
  });
});

describe("D6 - isian BAS per sidang: saklar MENYALA", () => {
  it("ketikan BAS diingat server per sidang (sidang yang dipilih), hanya isian teks; putusan tidak diingat per sidang", async () => {
    const s = sidangBaru(true);
    const h = buka({ orang: "pp", sidang: s });
    await pilihBasPp(h);
    const sd = sidangDipilih(h);
    expect(Number(sd)).toBeGreaterThan(0);
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "satu anak");
    await sampai(() => s.posts.length === 1, "ingatan terkirim");
    expect(s.posts[0]).toEqual({ perkaraId: "10154", nomorPerkara: "581/Pdt.G/2026/PA.Dgl", sidang: Number(sd), kode: "0007", nilai: "satu anak" });
    expect(JSON.stringify(s.posts)).not.toMatch(/aleta/i);
  });

  it("catatan per sidang: nilai sidang ini berbeda dari ABT -> tampil; sama -> tidak; 'Pakai di layar' menulis ke ABT atas tindakan petugas", async () => {
    const s = sidangBaru(true);
    const h0 = buka({ orang: "pp", sidang: s });
    await pilihBasPp(h0);
    const sd = sidangDipilih(h0);
    const s2 = sidangBaru(true, { [`10154|${sd}`]: [{ kode: "0007", nilai: "dua anak" }, { kode: "9134", nilai: "sama" }] });
    const h = buka({ orang: "pp", sidang: s2, abtAwal: { "0007": "satu anak", "9134": "sama" } });
    await pilihBasPp(h);
    const catatan = await sampai(() => q(h, '[data-sidang-kode="0007"]'), "catatan 0007");
    expect(catatan.textContent).toContain(`Isian sidang ke-${sd} yang tersimpan: dua anak`);
    expect(catatan.textContent).toContain("Dipakai otomatis saat BAS sidang ini dicetak");
    expect(q(h, '[data-sidang-kode="9134"]')).toBeNull(); // nilainya sama dengan ABT
    expect(h.abt["0007"]).toBe("satu anak"); // belum disentuh
    (catatan.querySelector("button[data-ambil]") as HTMLElement).click();
    await sampai(() => h.abt["0007"] === "dua anak", "0007 ditulis sesudah ditekan");
    await sampai(() => !q(h, '[data-sidang-kode="0007"]'), "catatan hilang");
  });

  it("CETAK BAS sidang tertentu: isian sidang itu ditulis ke ABT sementara, naskah memuatnya, ABT dipulihkan persis seperti semula", async () => {
    const s0 = sidangBaru(true);
    const h0 = buka({ orang: "pp", sidang: s0 });
    await pilihBasPp(h0);
    const sd = sidangDipilih(h0);
    const s = sidangBaru(true, { [`10154|${sd}`]: [{ kode: "0007", nilai: "dua anak" }] });
    const tulis: Array<[string, string]> = [];
    const h = buka({ orang: "pp", sidang: s, tulis, abtAwal: { "0007": "satu anak" } });
    await pilihBasPp(h);
    const kali = await cetakBas(h);
    await sampai(() => h.pdfRtf.length >= 1, "PDF", 8000);
    expect(MINTA_PDF(h)).toContain("dua anak");
    expect(MINTA_PDF(h)).not.toContain("satu anak");
    // urutan tulis ke ABT: sementara lalu pulih (tiap pengambilan naskah)
    expect(tulis).toEqual(siklus(kali, [["0007", "dua anak"]], [["0007", "satu anak"]]));
    expect(h.abt["0007"]).toBe("satu anak");
    // daftar pemulihan sudah dibersihkan; tidak ada ingatan baru dari tulisan sementara (bukan ketikan petugas)
    expect(h.simpanan["blangkoDerryPulih"] ?? null).toBeNull();
    expect(postSidang(h)).toEqual([]);
    // pratinjau sesudahnya memuat ulang dari ABT (isi ABT saat ini)
    expect(h.latar.filter((m) => m.jenis === "unduh").length).toBeGreaterThanOrEqual(1);
  });

  it("nilai sidang sama dengan ABT: tidak ada tulisan sementara sama sekali", async () => {
    const s0 = sidangBaru(true);
    const h0 = buka({ orang: "pp", sidang: s0 });
    await pilihBasPp(h0);
    const sd = sidangDipilih(h0);
    const s = sidangBaru(true, { [`10154|${sd}`]: [{ kode: "0007", nilai: "satu anak" }] });
    const tulis: Array<[string, string]> = [];
    const h = buka({ orang: "pp", sidang: s, tulis, abtAwal: { "0007": "satu anak" } });
    await pilihBasPp(h);
    await cetakBas(h);
    await sampai(() => h.pdfRtf.length >= 1, "PDF", 8000);
    expect(tulis).toEqual([]);
    expect(MINTA_PDF(h)).toContain("satu anak");
  });

  it("sidang yang nilainya dikosongkan sengaja: dipakai kosong saat cetak, lalu ABT dipulihkan", async () => {
    const s0 = sidangBaru(true);
    const h0 = buka({ orang: "pp", sidang: s0 });
    await pilihBasPp(h0);
    const sd = sidangDipilih(h0);
    const s = sidangBaru(true, { [`10154|${sd}`]: [{ kode: "9134", nilai: "" }] });
    const tulis: Array<[string, string]> = [];
    const h = buka({ orang: "pp", sidang: s, tulis, abtAwal: { "9134": "isian sidang lain" } });
    await pilihBasPp(h);
    const kali = await cetakBas(h);
    await sampai(() => h.latar.some((m) => m.jenis === "unduh"), "unduhan", 8000);
    expect(tulis).toEqual(siklus(kali, [["9134", ""]], [["9134", "isian sidang lain"]]));
    expect(h.abt["9134"]).toBe("isian sidang lain");
  });

  it("gagal menulis sementara: yang sudah ditulis dipulihkan dan cetak DIBATALKAN (tidak mencetak BAS dengan isian sidang lain)", async () => {
    const s0 = sidangBaru(true);
    const h0 = buka({ orang: "pp", sidang: s0 });
    await pilihBasPp(h0);
    const sd = sidangDipilih(h0);
    const s = sidangBaru(true, { [`10154|${sd}`]: [{ kode: "0007", nilai: "dua anak" }, { kode: "9134", nilai: "tidak bisa ditulis" }] });
    const tulis: Array<[string, string]> = [];
    const h = buka({ orang: "pp", sidang: s, tulis, abtAwal: { "0007": "satu anak", "9134": "lama" }, gagalNilai: ["tidak bisa ditulis"] });
    await pilihBasPp(h);
    centangPdf(h);
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => tulis.length >= 2, "penulisan sementara dan pemulihan", 8000);
    await tunggu(150);
    // 0007 sempat ditulis lalu dipulihkan; 9134 gagal ditulis
    expect(tulis).toEqual([["0007", "dua anak"], ["0007", "satu anak"]]);
    expect(h.abt["0007"]).toBe("satu anak");
    expect(h.abt["9134"]).toBe("lama");
    expect(h.pdfRtf).toEqual([]);
    expect(h.latar.filter((m) => m.jenis === "unduh")).toEqual([]);
  });

  it("saklar menyala tetapi server galat: cetak berjalan seperti biasa dengan isi ABT", async () => {
    const s = sidangBaru(true, { "10154|2": [{ kode: "0007", nilai: "dua anak" }] });
    s.gagal = true;
    const tulis: Array<[string, string]> = [];
    const h = buka({ orang: "pp", sidang: s, tulis, abtAwal: { "0007": "satu anak" } });
    await pilihBasPp(h);
    await cetakBas(h);
    await sampai(() => h.pdfRtf.length >= 1, "PDF", 8000);
    expect(tulis).toEqual([]);
    expect(MINTA_PDF(h)).toContain("satu anak");
    expect(q(h, "[data-sidang-kode]")).toBeNull();
  });
});

describe("D6 - isian BAS per sidang: cetak yang terputus dipulihkan saat perkara dibuka lagi", () => {
  it("ABT masih berisi nilai sementara -> dipulihkan ke nilai asal dan daftar pemulihan dibersihkan", async () => {
    const s = sidangBaru(true);
    const tulis: Array<[string, string]> = [];
    const simpanan = { blangkoDerryPulih: { perkaraId: "10154", nomor: "581/Pdt.G/2026/PA.Dgl", sidang: "2", daftar: [{ kode: "0007", asal: "satu anak", nilai: "dua anak" }], saat: 1 } };
    const h = buka({ orang: "pp", sidang: s, tulis, simpanan, abtAwal: { "0007": "dua anak" } });
    await pilihBasPp(h);
    await sampai(() => h.abt["0007"] === "satu anak", "ABT dipulihkan");
    expect(tulis).toEqual([["0007", "satu anak"]]);
    await sampai(() => (h.simpanan["blangkoDerryPulih"] ?? null) === null, "daftar pemulihan dibersihkan");
  });

  it("ABT sudah disunting petugas sesudahnya -> suntingan baru TIDAK ditimpa", async () => {
    const s = sidangBaru(true);
    const tulis: Array<[string, string]> = [];
    const simpanan = { blangkoDerryPulih: { perkaraId: "10154", nomor: "581/Pdt.G/2026/PA.Dgl", sidang: "2", daftar: [{ kode: "0007", asal: "satu anak", nilai: "dua anak" }], saat: 1 } };
    const h = buka({ orang: "pp", sidang: s, tulis, simpanan, abtAwal: { "0007": "tiga anak" } });
    await pilihBasPp(h);
    await tunggu(150);
    expect(tulis).toEqual([]);
    expect(h.abt["0007"]).toBe("tiga anak");
  });

  it("daftar pemulihan perkara lain tidak disentuh", async () => {
    const s = sidangBaru(true);
    const tulis: Array<[string, string]> = [];
    const simpanan = { blangkoDerryPulih: { perkaraId: "99999", nomor: "1/Pdt.G/2026/PA.Dgl", sidang: "2", daftar: [{ kode: "0007", asal: "x", nilai: "dua anak" }], saat: 1 } };
    const h = buka({ orang: "pp", sidang: s, tulis, simpanan, abtAwal: { "0007": "dua anak" } });
    await pilihBasPp(h);
    await tunggu(150);
    expect(tulis).toEqual([]);
    expect((h.simpanan["blangkoDerryPulih"] as { perkaraId: string }).perkaraId).toBe("99999");
  });
});
