// @vitest-environment node
/**
 * ============================================================================
 * 16 OKT 2026 - BLANGKO ABT BY DERRY BRIANTONO, TAHAP F (PERLU DIISI) DAN G (PRATINJAU, CETAK)
 * ============================================================================
 *
 * ekstensi-sipp/blangko-derry-isian.js + abt-klien.js dijalankan SUNGGUHAN di
 * jsdom di atas kerangka tahap C-D (blangko-derry.js) dan panel-alat.js, dengan
 * ABT dan portal ditiru di fetch. Yang dijaga:
 *   F  jendela pilih blangko dua kolom per peran (hakim putusan, PP BAS) dengan
 *      saran (titik sambung tahap E) dan cari; hak dicek lewat POST main/cari
 *      SEBELUM isian dibaca; main/view tidak pernah dipanggil; "Perlu diisi"
 *      dari portal (penanda x katalog): isian berpemicu muncul/sembunyi,
 *      saran samar + Tab, panah bawah pilihan, simpan ke ABT lewat edit_data
 *      dengan var_type yang dibaca dulu, huruf di luar cp1252 ditolak, peran
 *      yang tidak sesuai tidak menulis; bukti terstruktur dari bawaan ABT ->
 *      kalimat 1214; tanya jawab berdampingan, muat templat, simpan lewat
 *      tanyajawab_perkara_edit per sidang; Lihat semua isi data; laporan
 *      kelengkapan ke kartu perkara
 *   G  pratinjau terlipat dari preview ABT (hanya saat dibuka), nilai isian
 *      bertanda, klik dua kali -> simpan ke ABT; cetak: pengingat isian kosong
 *      + penanda #, nama unduhan baku, PDF lewat portal, anonim & e-Doc hanya
 *      putusan, tanda tangan akun disisipkan ke RTF sebelum PDF
 *   murni: pengurai RTF, bukti, ttd, cp1252, tanggal, nama unduhan
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

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

type Minta = { url: string; cara: string; badan: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; tj: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; pdfRtf: string[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean } = {}): Halaman {
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
  const abt: Record<string, string> = { "8503": "F" }; // isian tersimpan di ABT (data_teks/tanggal)
  const tj: Halaman["tj"] = { "5058": [{ no: "1", tanya: "Apakah saudara kenal Penggugat?", jawab: "Kenal, saya kakaknya;" }, { no: "2", tanya: "Apa yang saudara tahu?", jawab: "Mereka sering bertengkar;\nBahwa cukup sekian;" }], "5059": [] };
  const pdfRtf: string[] = [];
  const orang = ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const nilaiDari = (kode: string[]) => {
    const n: Record<string, unknown> = {};
    for (const k of kode) n[k] = abt[k] !== undefined && abt[k] !== "" ? { status: "terisi", teks: abt[k] } : k === "0001" ? { status: "terisi", teks: "581/Pdt.G/2026/PA.Dgl" } : k === "0046" ? { status: "terisi", teks: "Yulfiani binti Tasbih" } : { status: "kosong", teks: "" };
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
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos(DAFTAR) } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [{ sidangId: "s2026-10-01", tanggalSidang: "2026-10-01", jamSidang: "09:00:00", agenda: "Sidang Pertama", alasanDitunda: "Panggil Tergugat", urutanSidang: 1 }, { sidangId: "s2026-10-15", tanggalSidang: "2026-10-15", jamSidang: "09:00:00", agenda: "Pemeriksaan pokok perkara", alasanDitunda: "putus DIKABULKAN (verstek)", urutanSidang: 2 }] } } });
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [{ nama: "1 Perceraian CG", jenis: "put", berkas: [`${BLANGKO_PUT}.rtf`, "[02] [Kabul] CG - F.rtf"] }, { nama: "ALUR 02 Cerai Verstek 2 Sidang", jenis: "bas", berkas: [`${BLANGKO_BAS}.rtf`] }], sumber: "pohon", sebab: "" } });
      const berkas = q.get("berkas") || "";
      const put = berkas.startsWith("[01]");
      const s = susunIsian(put ? PENANDA_PUT : PENANDA_BAS, KATALOG, { P: q.get("sebutanP") || "Penggugat", T: q.get("sebutanT") || "Tergugat" });
      const semua = q.get("semua") === "1";
      const kode = semua ? [...new Set([...s.penanda, ...s.isian.map((b) => b.kode), ...s.otomatis.map((o) => o.kode)])] : [...s.isian.filter((b) => b.jenis !== "tj").map((b) => b.kode), ...s.pemicu.map((x) => x.kode)];
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${berkas}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") ? nilaiDari(kode) : undefined, nilaiAda: Boolean(q.get("perkaraId")), nilaiSebab: "" } });
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
      const rows = f.get("load_template") ? { "0": { urutan_pertanyaan: "1", pertanyaan: "Apakah saudara kenal Penggugat?", jawaban: "" }, "1": { urutan_pertanyaan: "2", pertanyaan: "Bagaimana rumah tangganya?", jawaban: "" } } : (tj[kode] || []).map((r) => ({ urutan_pertanyaan: r.no, pertanyaan: r.tanya, jawaban: r.jawab }));
      return html(`<div class="panel-heading"><b><big>581/Pdt.G/2026/PA.Dgl</big></b> - TanyaJwb Saksi : <b>Nama Saksi</b></div><select><option value='A1a'>(A1a) Pertanyaan Saksi P CG</option></select><script>var ajax_data = ${JSON.stringify(rows)}\n</script>`);
    }
    if (url.startsWith(`${ABT}/preview?`)) {
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
  return { dom, w, simpanan, minta, latar, abt, tj, pdfRtf };
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
describe("F. jendela pilih blangko", () => {
  it("hakim: hanya tab Putusan; kelompok dari menu Derry ABT; berkas + token dari halaman kelompok; saran tahap E bertanda; cari menyaring", async () => {
    const h = buka();
    await sampaiPerkara(h);
    h.w.aletaBlangkoDerry.pasangRekomendasi(() => [{ berkas: BLANGKO_PUT, kelompok: "Putusan CG", jenis: "put", alasan: "uji saran" }]);
    klik(h, '[data-bd2="bukamodal"]');
    const modal = await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
    expect(Array.from(modal.querySelectorAll("[data-jenismodal]")).map((b) => b.textContent)).toEqual(["Putusan"]);
    await sampai(() => q(h, `[data-bl="${BLANGKO_PUT}"]`), "berkas");
    const kel = qq(h, "[data-kelmodal]").map((b) => b.querySelector(".kn")!.textContent);
    expect(kel).toEqual(["Disarankan", "Putusan Cerai Gugat"]);
    expect(q(h, "[data-kelmodal].saran .ks")!.textContent).toContain("sidang ke-2");
    expect(q(h, `[data-bl="${BLANGKO_PUT}"] .bd-lencana`)!.textContent).toBe("disarankan");
    // Saran di ringkasan tahap 2 menyebut blangko yang sama.
    expect(q(h, "#bd-saranblangko")!.textContent).toContain("Kabul Verstek");
    // Cari menyaring di seluruh kelompok.
    const cari = q(h, "#bd-caribl") as HTMLInputElement;
    ketik(h, cari, "CG - F", false);
    await tunggu(10);
    expect(qq(h, "[data-bl]").map((b) => b.getAttribute("data-bl"))).toEqual(["[02] [Kabul] CG - F"]);
    // Tidak ada main/view yang dipanggil.
    expect(mintaKe(h, /main\/view/)).toEqual([]);
  });

  it("PP: hanya tab BAS; blangko BAS: cetak anonim & e-Doc dimatikan", async () => {
    const h = buka({ orang: "pp" });
    await sampaiPerkara(h);
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
    expect(qq(h, "[data-jenismodal]").map((b) => b.textContent)).toEqual(["Berita acara sidang"]);
    await sampai(() => q(h, `[data-bl="${BLANGKO_BAS}"]`), "berkas bas");
    klik(h, `[data-bl="${BLANGKO_BAS}"]`);
    await sampai(() => q(h, "#bd-perlu .bd-f"), "perlu diisi");
    expect((q(h, '[data-fmt="anon"]') as HTMLInputElement).disabled).toBe(true);
    expect((q(h, '[data-fmt="edoc"]') as HTMLInputElement).disabled).toBe(true);
    expect(q(h, ".bd-ingatsidang")!.textContent).toContain("bukan per sidang");
  });

  it("hak diperiksa lewat POST main/cari {a,b,c} sebelum isian dibaca; ditolak = sebab ABT ditampilkan, tanpa membaca isian", async () => {
    const h = buka({ hakTolak: true });
    await sampaiPerkara(h);
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, `[data-bl="${BLANGKO_PUT}"]`), "berkas");
    klik(h, `[data-bl="${BLANGKO_PUT}"]`);
    const p = await sampai(() => q(h, "[data-wadah='perlu-diisi'] .bd-peringatan, #aleta-bd-akar .bd-peringatan"), "peringatan");
    expect(p.textContent).toContain("TIDAK DAPAT MENGGUNAKAN BLANGKO INI");
    const cari = mintaKe(h, /main\/cari$/, "POST");
    expect(cari.length).toBe(1);
    expect(cari[0].badan).toBe("a=A01&b=B01&c=10154");
    expect(mintaKe(h, /blangko-derry\?folder=/)).toEqual([]);
  });
});

describe("F. perlu diisi", () => {
  it("isian tangan dari portal (langsung + lewat variabel lain), nilai tersimpan, pemicu sembunyi/muncul, saran samar + Tab, panah bawah pilihan; simpan lewat edit_data dengan var_type dibaca dulu", async () => {
    const h = buka();
    await pilihPutusan(h);
    const hak = mintaKe(h, /main\/cari$/, "POST");
    expect(hak.length).toBe(1);
    const susunan = mintaKe(h, /blangko-derry\?folder=/);
    expect(susunan[0].url).toContain("folder=1+Perceraian+CG");
    expect(susunan[0].url).toContain("perkaraId=10154");
    expect(susunan[0].url).toContain("sidangKe=2");
    const kode = qq(h, "#bd-perlu .bd-f").map((f) => f.getAttribute("data-f"));
    // 8503 tidak langsung di RTF tetapi dibaca #4001#; 0156/0184 (kuasa) dan 8536 (C), 0227 (H) tersembunyi.
    expect(kode).toEqual(["8503", "0007", "1214"]);
    expect((q(h, "#bd-i8503") as HTMLInputElement).value).toBe("F");
    expect(q(h, '.bd-f[data-f="8503"]')!.classList.contains("beres")).toBe(true);
    expect(akar(h).textContent).toContain("disembunyikan");
    // Saran 0007 dari jendela ABT (bawaan #8492# dihitung) menjadi bayangan.
    const i0007 = await sampai(() => {
      const i = q(h, "#bd-i0007") as HTMLInputElement;
      return i && i.placeholder === "belum dikaruniai anak" ? i : null;
    }, "saran 0007");
    tombol(h, i0007, "Tab");
    expect((q(h, "#bd-i0007") as HTMLInputElement).value).toBe("belum dikaruniai anak");
    await sampai(() => h.abt["0007"] === "belum dikaruniai anak", "0007 tersimpan di ABT");
    const simpan = mintaKe(h, /edit_data\?no_var=0007/, "POST");
    expect(simpan[0].badan).toBe("aksi=Simpan&value=belum+dikaruniai+anak&var_type=data_teks");
    // Sebelum POST, tipe dibaca lewat GET jendela sembul (bukan ditebak).
    const idxGet = h.minta.findIndex((m) => /edit_data\?no_var=0007/.test(m.url) && m.cara === "GET");
    const idxPost = h.minta.findIndex((m) => /edit_data\?no_var=0007/.test(m.url) && m.cara === "POST");
    expect(idxGet).toBeGreaterThanOrEqual(0);
    expect(idxGet).toBeLessThan(idxPost);
    await sampai(() => (q(h, '[data-status="0007"]')!.textContent || "").includes("tersimpan"), "status tersimpan");
    // Panah bawah: pilihan alasan; memilih "C ..." memunculkan isian berpemicu 11116 (putusan pidana).
    tombol(h, q(h, "#bd-i8503")!, "ArrowDown");
    const opsi = await sampai(() => q(h, '[data-ambil="8503"][data-nilai^="C"]'), "pilihan C");
    opsi.click();
    await sampai(() => q(h, '.bd-f[data-f="8536"]'), "8536 muncul");
    expect(q(h, '.bd-f[data-f="8536"] .bd-pemicuinfo')!.textContent).toContain("huruf C");
    await sampai(() => h.abt["8503"] && h.abt["8503"].startsWith("C"), "8503 tersimpan");
    expect(mintaKe(h, /main\/view/)).toEqual([]);
  });

  it("huruf di luar cp1252 ditolak tanpa menulis; PP pada blangko putusan hanya melihat", async () => {
    const h = buka();
    await pilihPutusan(h);
    const i = q(h, "#bd-i8503") as HTMLInputElement;
    const sebelum = mintaKe(h, /edit_data\?no_var=8503/, "POST").length;
    ketik(h, i, "F ☺");
    await sampai(() => /huruf/.test(q(h, '[data-status="8503"]')!.textContent || ""), "pesan huruf");
    expect(q(h, '[data-status="8503"]')!.textContent).toContain("☺");
    expect(mintaKe(h, /edit_data\?no_var=8503/, "POST").length).toBe(sebelum);
    // ’ (cp1252) boleh.
    ketik(h, i, "F ’uji’");
    await sampai(() => mintaKe(h, /edit_data\?no_var=8503/, "POST").length > sebelum, "tersimpan");

    const h2 = buka({ orang: "pp" });
    await sampaiPerkara(h2);
    await sampai(() => h2.w.aletaBlangkoDerryIsian.keadaan().terpasang, "terpasang");
    // Kelompok Putusan dimuat lewat api (PP tidak melihatnya di jendela), lalu blangko putusan dipaksa dipilih.
    await isian(h2).muatKelompok("Putusan CG");
    await isian(h2).pilihBlangko(BLANGKO_PUT, "Putusan CG");
    await sampai(() => q(h2, "#bd-i8503"), "pilih");
    expect((q(h2, "#bd-i8503") as HTMLInputElement).readOnly).toBe(true);
    ketik(h2, q(h2, "#bd-i8503") as HTMLInputElement, "G");
    await tunggu(30);
    expect(mintaKe(h2, /edit_data\?no_var=8503/, "POST")).toEqual([]);
    expect(akar(h2).textContent).toContain("hanya dapat melihat");
    expect(q(h2, '[data-status="8503"]')!.textContent).toContain("hanya ditulis Hakim");
  });

  it("bukti: baris terstruktur dari bawaan ABT (KTP-el + Akta Nikah), kode P.n otomatis; mengubah nomor menulis kalimat ke 1214; tambah bukti cepat", async () => {
    const h = buka();
    await pilihPutusan(h);
    await sampai(() => q(h, '[data-bk="P.1"][data-isi="no"]'), "bukti tergambar");
    const nama = qq(h, ".bd-bnama").map((i) => (i as HTMLInputElement).value);
    expect(nama[0]).toContain("Kartu Tanda Penduduk Elektronik (KTP-el) atas nama YULFIANI");
    expect(nama[1]).toBe("Fotokopi Kutipan Akta Nikah");
    expect((q(h, '[data-bk="P.1"][data-isi="no"]') as HTMLInputElement).value).toBe("0114/04/IV/2021");
    expect((q(h, '[data-bk="P.1"][data-isi="tgl"]') as HTMLInputElement).value).toBe("2021-04-05");
    expect((q(h, '[data-bk="P.0"][data-isi="oleh"]') as HTMLInputElement).value).toBe("Pemerintah Kabupaten Sigi, Provinsi Sulawesi Tengah");
    expect(qq(h, ".bd-kodeP").map((k) => k.textContent)).toEqual(["P.1", "P.2"]);
    const no = q(h, '[data-bk="P.0"][data-isi="no"]') as HTMLInputElement;
    no.value = "7271-01";
    no.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.abt["1214"] && h.abt["1214"].includes("Nomor 7271-01"), "1214 tersimpan");
    expect(h.abt["1214"]).toMatch(/^Fotokopi Kartu Tanda Penduduk Elektronik \(KTP-el\) atas nama YULFIANI, NIK 7271036411920011, Nomor 7271-01 tanggal 23 April 2025, yang dikeluarkan oleh Pemerintah Kabupaten Sigi, Provinsi Sulawesi Tengah, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P\.1 serta diberi tanggal dan paraf oleh Ketua Majelis;\n/);
    klik(h, '[data-bktambah="P"][data-nama="Fotokopi Kartu Keluarga"]');
    await sampai(() => qq(h, ".bd-kodeP").length === 3, "bukti ketiga");
    expect(qq(h, ".bd-kodeP").map((k) => k.textContent)).toEqual(["P.1", "P.2", "P.3"]);
    const meterai = q(h, '[data-bk="P.2"][data-isi="meterai"]') as HTMLSelectElement;
    expect(meterai.value).toBe("0");
    expect(meterai.options[0].textContent).toBe("bermeterai cukup dan dinazegelen");
  });

  it("tanya jawab: dua saksi berdampingan dari ABT per sidang, bersihkan penutup, muat templat, simpan lewat tanyajawab_perkara_edit?aksi=simpan (sidang diperiksa dulu)", async () => {
    const h = buka();
    await pilihPutusan(h);
    const tombolTj = qq(h, "[data-tj]");
    expect(tombolTj.map((b) => b.getAttribute("data-tj"))).toEqual(["saksi 1 p", "saksi 2 p"]);
    klik(h, '[data-tj="saksi 1 p"]');
    await sampai(() => q(h, ".bd-sbs .bd-sbrow"), "berdampingan");
    const baca = mintaKe(h, /tanyajawab_perkara_edit\?no_var=505[89]/, "GET");
    expect(baca.length).toBe(2);
    expect(baca[0].url).toContain("&c=10154&d=2");
    expect(qq(h, ".bd-sbrow").length).toBe(2);
    expect((q(h, '[data-sba="1"][data-sk="0"]') as HTMLTextAreaElement).value).toContain("Bahwa cukup sekian");
    klik(h, '[data-sbaksi="bersih"]');
    expect((q(h, '[data-sba="1"][data-sk="0"]') as HTMLTextAreaElement).value).toBe("Mereka sering bertengkar;");
    klik(h, '[data-sbaksi="salinsemua"]');
    expect((q(h, '[data-sba="0"][data-sk="1"]') as HTMLTextAreaElement).value).toBe("Mengenal, saya kakaknya;".replace("Mengenal", "Kenal"));
    // Muat set pertanyaan (POST load_template, belum tersimpan).
    (q(h, "#bd-muattpl") as HTMLSelectElement).value = "A1a";
    klik(h, '[data-bd2="muattpl"]');
    await sampai(() => mintaKe(h, /tanyajawab_perkara_edit/, "POST").some((m) => m.badan.includes("load_template=A1a")), "templat");
    await sampai(() => (q(h, '[data-sbq="1"]') as HTMLTextAreaElement)?.value === "Bagaimana rumah tangganya?", "baris templat");
    expect(h.tj["5058"].length).toBe(2); // belum disimpan
    (q(h, '[data-sba="0"][data-sk="0"]') as HTMLTextAreaElement).value = "Kenal;";
    q(h, '[data-sba="0"][data-sk="0"]')!.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    klik(h, '[data-bd2="simpantj"]');
    await sampai(() => h.tj["5058"].some((r) => r.jawab === "Kenal;"), "tersimpan");
    const simpan = mintaKe(h, /tanyajawab_perkara_edit\?aksi=simpan&no_var=5058/, "POST");
    expect(simpan.length).toBe(1);
    expect(simpan[0].url).toContain("&c=10154&d=2");
    expect(JSON.parse(new URLSearchParams(simpan[0].badan).get("data")!)[0]).toEqual({ no: "1", tanya: "Apakah saudara kenal Penggugat?", jawab: "Kenal;" });
    // sidangAda (0050&d=2) dibaca sebelum menulis.
    const idxCek = h.minta.findIndex((m) => /edit_data\?no_var=0050/.test(m.url) && /d=2/.test(m.url));
    const idxSimpan = h.minta.findIndex((m) => /aksi=simpan&no_var=5058/.test(m.url));
    expect(idxCek).toBeGreaterThanOrEqual(0);
    expect(idxCek).toBeLessThan(idxSimpan);
    expect(mintaKe(h, /tanyajawab_template\?hapus/)).toEqual([]);
    await sampai(() => /tersimpan di ABT/.test(akar(h).textContent || ""), "keterangan tersimpan");
  });

  it("Lihat semua isi data memuat nilai (semua=1); nama pihak disamarkan; kelengkapan dilaporkan ke daftar perkara", async () => {
    const h = buka();
    await pilihPutusan(h);
    klik(h, '[data-bd2="semua"]');
    await sampai(() => q(h, "#bd-vdaftar .bd-vbaris"), "daftar nilai");
    expect(mintaKe(h, /blangko-derry\?folder=.*semua=1/).length).toBe(1);
    const nilai = qq(h, "#bd-vdaftar .bd-vbaris");
    const noPerkara = nilai.find((b) => b.textContent!.includes("No Perkara"))!;
    expect(noPerkara.querySelector(".bd-nilai")!.textContent).toBe("581/Pdt.G/2026/PA.Dgl");
    const pihak = nilai.find((b) => b.textContent!.includes("Yulfiani"))!;
    expect(pihak.querySelector(".bd-nilai")!.classList.contains("bd-sembunyi")).toBe(true);
    // Laporan ke kerangka: daftar ringkas menyebut kelengkapan.
    klik(h, '[data-bd="ganti"]');
    await sampai(() => q(h, '[data-lihat="ringkas"]'), "daftar");
    klik(h, '[data-lihat="ringkas"]');
    const brs = await sampai(() => q(h, ".bd-brs"), "baris");
    expect(brs.textContent).toMatch(/Terisi \d+ dari \d+|Isian lengkap/);
  });
});

describe("G. pratinjau dan cetak", () => {
  it("pratinjau hanya dimuat saat dibuka (preview ABT); nilai isian bertanda; klik dua kali menyimpan ke ABT; penanda sisa disebut", async () => {
    const h = buka();
    await pilihPutusan(h);
    const i0007 = await sampai(() => {
      const i = q(h, "#bd-i0007") as HTMLInputElement;
      return i && i.placeholder ? i : null;
    }, "saran");
    tombol(h, i0007, "Tab");
    await sampai(() => h.abt["0007"] === "belum dikaruniai anak", "0007");
    expect(mintaKe(h, /abt\/preview/)).toEqual([]);
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => q(h, "#bd-kertas"), "kertas");
    const prev = mintaKe(h, /abt\/preview\?/);
    expect(prev.length).toBe(1);
    expect(prev[0].url).toContain("a=A01&b=B01&c=10154&e=&d=2");
    expect(q(h, "#bd-kertas p.qc b")!.textContent).toBe("PUTUSAN");
    expect(qq(h, "#bd-kertas table td").map((t) => t.textContent)).toEqual(["Hakim Satu, S.H.", "Hakim Dua, M.H."]);
    const v = q(h, '#bd-kertas .bd-v.anda[data-kode="0007"]')!;
    expect(v.textContent).toBe("belum dikaruniai anak");
    expect(q(h, "#bd-kertas .bd-v.rusak")!.textContent).toBe("#9999#");
    expect(akar(h).textContent).toContain("1 penanda belum terbaca: #9999#");
    v.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true }));
    const inp = q(h, "#bd-kertas input.bd-vinput") as HTMLInputElement;
    inp.value = "dikaruniai 1 anak";
    tombol(h, inp, "Enter");
    await sampai(() => h.abt["0007"] === "dikaruniai 1 anak", "tersimpan dari pratinjau");
    expect((q(h, "#bd-i0007") as HTMLInputElement).value).toBe("dikaruniai 1 anak");
    // Sunting penuh: kotak untuk tiap isian, Simpan ke ABT menulis yang berubah lalu memuat ulang.
    klik(h, '[data-bd2="suntingpenuh"]');
    const kotak = q(h, '#bd-kertas input[data-vk="0007"]') as HTMLInputElement;
    kotak.value = "dikaruniai 2 anak";
    klik(h, '[data-bd2="simpansunting"]');
    await sampai(() => h.abt["0007"] === "dikaruniai 2 anak", "sunting penuh tersimpan");
    await sampai(() => mintaKe(h, /abt\/preview\?/).length === 2, "muat ulang");
  });

  it("cetak: pengingat isian kosong + penanda (Isi dulu / Tetap cetak), lalu RTF bernama baku + PDF lewat portal; anonim ABT + e-Doc untuk putusan", async () => {
    const h = buka();
    await pilihPutusan(h);
    await sampai(() => q(h, '[data-bk="P.1"][data-isi="no"]'), "bukti");
    klik(h, '[data-bd2="cetak"]');
    const ingat = await sampai(() => {
      const e = q(h, "#bd-ingat");
      return e && !e.hidden ? e : null;
    }, "pengingat");
    expect(ingat.textContent).toContain("isian kosong");
    expect(ingat.textContent).toContain("belum terisi otomatis: #9999#");
    expect(q(h, '[data-bd2="isidulu"]')).not.toBeNull();
    expect(h.latar.filter((m) => m.jenis === "unduh")).toEqual([]);
    expect(mintaKe(h, /abt\/preview\?/).length).toBe(1);
    (q(h, '[data-fmt="anon"]') as HTMLInputElement).click();
    (q(h, '[data-fmt="edoc"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.latar.filter((m) => m.jenis === "unduh").length >= 3, "unduhan", 8000);
    const unduh = h.latar.filter((m) => m.jenis === "unduh").map((m) => m.nama);
    expect(unduh).toEqual([
      `581_Pdt.G_2026_PA.Dgl - ${BLANGKO_PUT}.rtf`,
      `581_Pdt.G_2026_PA.Dgl - ${BLANGKO_PUT}.pdf`,
      `581_Pdt.G_2026_PA.Dgl - ${BLANGKO_PUT} - anonim.pdf`,
    ]);
    expect(mintaKe(h, /aleta-bot\/abt\/pdf/, "POST").length).toBe(2);
    expect(h.pdfRtf[1]).toContain("ANONIM");
    const anonim = mintaKe(h, /main\/anonim$/, "POST");
    expect(anonim.length).toBe(1);
    expect(JSON.parse(anonim[0].badan)).toMatchObject({ perkara_id: "10154", perkara_no: "581/Pdt.G/2026/PA.Dgl" });
    const edoc = mintaKe(h, /putusan\/unggah-sipp/, "POST");
    expect(edoc.length).toBe(1);
    const f = JSON.parse(edoc[0].badan);
    expect(f.perkaraId).toBe("10154");
    expect(f.putusan).toContain(`<berkas 581_Pdt.G_2026_PA.Dgl - ${BLANGKO_PUT}.rtf`);
    expect(f.anonimisasi).toContain("- anonim.rtf");
    await sampai(() => /e-Doc SIPP: putusan \+ anonimisasi terunggah/.test(akar(h).textContent || ""), "log e-Doc");
    expect(q(h, "#bd-statuscetak")!.textContent).toContain("");
    expect(akar(h).textContent).toContain("Sudah dicetak");
  });

  it("tanda tangan akun (disimpan di ekstensi) hanya untuk nama akun sendiri; disisipkan sebagai gambar RTF di atas nama sebelum PDF", async () => {
    const h = buka({ simpanan: { blangkoDerryTtd: { nama: "Hakim Satu", png: `data:image/png;base64,${PNG_1X1}`, saat: 1 } } });
    await pilihPutusan(h);
    klik(h, '[data-bd2="popttd"]');
    const pop = await sampai(() => {
      const p = q(h, "#bd-popttd");
      return p && !p.hidden && p.querySelector("[data-ttd]") ? p : null;
    }, "popover ttd");
    const kotak = Array.from(pop.querySelectorAll("[data-ttd]")) as HTMLInputElement[];
    expect(kotak.map((k) => [k.getAttribute("data-ttd"), k.disabled])).toEqual([["ketua", false], ["anggota1", true], ["pp", true]]);
    expect(pop.textContent).toContain("tersimpan di ekstensi ini");
    expect(pop.textContent).toContain("hanya dapat dipasang oleh yang bersangkutan");
    kotak[0].click();
    kotak[0].dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(q(h, "#bd-btnttd")!.textContent).toContain("(1)");
    (q(h, '[data-fmt="rtf"]') as HTMLInputElement).click();
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden, "pengingat");
    klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.pdfRtf.length === 1, "pdf diminta", 8000);
    const rtf = h.pdfRtf[0];
    const idxPict = rtf.indexOf("{\\pict\\pngblip\\picw1\\pich1\\picwgoal1701\\pichgoal1701 89504e47");
    const idxNama = rtf.indexOf("Hakim Satu, S.H.");
    expect(idxPict).toBeGreaterThan(0);
    expect(idxPict).toBeLessThan(idxNama);
    expect(rtf.indexOf("\\pict", idxPict + 5)).toBe(-1); // hanya satu tanda tangan
    await sampai(() => /tanda tangan: Hakim Satu/.test(akar(h).textContent || ""), "log ttd");
  });
});

describe("murni", () => {
  const m = () => buka().w.aletaBlangkoDerryIsian.murni;
  it("rtfKeHtml: perataan, tebal/miring, tabel, \\'hh dan \\uN, bagian tak dicetak dilewati", () => {
    const x = m();
    // Spasi tepat sesudah kata kendali adalah pembatas; spasi naskah ditulis dua kali ("\\i0  caf").
    const html = x.rtfKeHtml(`{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}{\\info{\\author abc}}\\pard\\qc\\b Judul\\b0\\par\\pard\\qj Teks \\i miring\\i0  caf\\'e9 \\u1593?a\\par\\trowd\\cellx1\\cellx2\\intbl A\\cell B\\cell\\row\\pard Akhir\\par}`);
    expect(html).toContain('<p class="qc"><b>Judul</b></p>');
    expect(html).toContain('<p class="qj">Teks <i>miring</i> café ع' + "a</p>");
    expect(html).toContain('<table>\n<tr><td class="ql">A</td><td class="ql">B</td></tr>\n</table>');
    expect(html).not.toContain("abc");
    expect(x.cekPenandaRtf("{\\rtf1 a #1234# b #12345# #1234#}")).toEqual(["1234", "12345"]);
  });
  it("bukti: urai kalimat ABT <-> susun kembali (pulang-pergi)", () => {
    const x = m();
    const rows = x.uraiBukti(BAWAAN_1214);
    expect(rows.length).toBe(2);
    expect(rows[1]).toMatchObject({ nm: "Fotokopi Kutipan Akta Nikah", no: "0114/04/IV/2021", tgl: "2021-04-05", oleh: "KUA Palu Selatan", meterai: 0, cocok: 0 });
    expect(x.uraiBukti("Surat X, Nomor 9 tanggal 1 Januari 2020, yang dikeluarkan oleh Y, bukti surat tersebut tidak bermeterai dan tidak di-nazegelen, serta dicocokkan dari fotokopinya, lalu diberi tanda T.1;")[0]).toMatchObject({ meterai: 2, cocok: 2 });
    const ulang = x.susunKalimatBukti(rows, "P");
    expect(ulang).toContain("lalu diberi tanda P.2 serta diberi tanggal dan paraf oleh Ketua Majelis;");
    expect(x.uraiBukti(ulang)).toEqual(rows.map((r) => ({ ...r })));
  });
  it("sisipkanTtdRtf, hurufDiLuarAbt, keIso, namaUnduhan, bersihkanPenutup, gantiKalimat", () => {
    const x = m();
    const png = Uint8Array.from(Buffer.from(PNG_1X1, "base64")).buffer;
    const h = x.sisipkanTtdRtf("{\\rtf1 \\pard\\qr Hakim Satu, S.H.\\par\\pard PP Satu\\par}", [{ nama: "Hakim Satu, S.H.", png }, { nama: "Tidak Ada", png }]);
    expect(h.dipasang).toEqual(["Hakim Satu, S.H."]);
    expect(h.tidakDitemukan).toEqual(["Tidak Ada"]);
    expect(h.rtf).toMatch(/\\pard\\qr \{\\pict\\pngblip\\picw1\\pich1\\picwgoal1701\\pichgoal1701 89504e47[0-9a-f]+\}\\par Hakim Satu, S\.H\./);
    expect(x.ukuranPng(png)).toEqual({ w: 1, h: 1 });
    expect(x.hurufDiLuarAbt("Assa’ – “oke” €")).toEqual([]);
    expect(x.hurufDiLuarAbt("ok ☺ ع")).toEqual(["☺", "ع"]);
    expect(["15 Oktober 2026", "15/10/2026", "2026-10-15T00:00:00", "15 Okt. 2026"].map(x.keIso)).toEqual(["2026-10-15", "2026-10-15", "2026-10-15", "2026-10-15"]);
    expect(x.namaUnduhan("581/Pdt.G/2026/PA.Dgl", BLANGKO_PUT, "pdf")).toBe(`581_Pdt.G_2026_PA.Dgl - ${BLANGKO_PUT}.pdf`);
    expect(x.namaUnduhan("581/Pdt.G/2026/PA.Dgl", `${BLANGKO_PUT} - anonim`, "pdf")).toBe(`581_Pdt.G_2026_PA.Dgl - ${BLANGKO_PUT} - anonim.pdf`);
    expect(x.bersihkanPenutup("Mereka pisah;\nBahwa cukup sekian;")).toBe("Mereka pisah;");
    expect(x.gantiKalimat("Saya kenal dengan Penggugat karena saya tetangganya")).toBe("Saya mengenal Penggugat sebab saya tetangganya");
    expect(x.jenisKelompok("BAS Alur 02 - Cerai Verstek 2 Sidang")).toBe("bas");
    expect(x.namaTampil(BLANGKO_BAS, "bas")).toBe("BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)");
  });
});
