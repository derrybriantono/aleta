// @vitest-environment node
/**
 * TOMBOL LIHAT DI NASKAH (5 Nov 2026, keputusan 201-203). Panel dijalankan sungguhan di jsdom: tombol Lihat per isian (hanya Super Admin),
 * blok hasil isian di pratinjau, bilah temuan, Berikutnya/Sebelumnya, Kembali ke isian, Tutup, dan penjagaan naskah cetak.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "deteksi-sisa-blangko.js", "blangko-derry-periksa.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-22";
const NOMOR_ACUAN = "600/Pdt.G/2026/PA.Dgl";
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
const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("8503", "ALASAN PERCERAIAN <br>SATU HURUF", "data_teks"),
  D("0007", "Telah Dikarunai Anak", "data_teks", "", "#8492#"),
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
]);
const PENANDA = ["0001", "0046", "0007", "8503", "0033"];
const RTF = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}}\\pard\\qc\\b PUTUSAN\\b0\\par\\pard\\qc Nomor ${NOMOR_ACUAN}\\par\\pard Penggugat: Yulfiani; anak: ...;\\par}`;

const RTF_MESIN = RTF.replace("PUTUSAN", "PUTUSAN MESIN CEPAT").replace("anak: ...;", "anak: dua orang;");
const B_CG = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const B_CT = "[01] [Kabul] CT";
const B_IN = "[01] [Kabul] IN";
const B_BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";
const B_REL = "[JS] Panggilan Sidang Pertama T";
const B_PTSP = "Data Umum PTSP";
const KELOMPOK: Array<[string, string, string, string]> = [
  ["D1", "CG - Putusan", "1 Perceraian CG", B_CG],
  ["D2", "CT - Putusan", "2 Cerai Talak CT", B_CT],
  ["D3", "Itsbat - Putusan", "3 Itsbat Nikah", B_IN],
  ["D4", "CG - BAS", "ALUR 02 Cerai Verstek", B_BAS],
  ["D5", "Relaas dan PBT", "Relaas Panggilan", B_REL],
  ["D6", "99 PTSP", "99 PTSP", B_PTSP],
];
const JENIS_FOLDER: Record<string, string> = { D1: "put", D2: "put", D3: "put", D4: "bas", D5: "rel", D6: "ptsp" };
const MENU =
  `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel">` +
  KELOMPOK.map(([a, nama]) => `<a href="${BERANDA}?a=${a}&c=" title="(1 Blangko)">${nama}</a>`).join("") +
  `</div>`;
const HAL_KELOMPOK = (judul: string, berkas: string, a: string, b: string) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div><p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${berkas}</span></a></p>`;
const POPUP = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>${NOMOR_ACUAN}</b>` +
  `<textarea id="value">${nilai}</textarea>`;

const SI = (tanggal: string, agenda: string, ket = "", urutan = 1) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan, hadir: null, adaBas: null, ruangan: "" });
const PERKARA_ACUAN = {
  nomorPerkara: NOMOR_ACUAN, perkaraId: "10154", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim"], pihak: { penggugat: ["Yulfiani binti Tasbih"], tergugat: ["Andi Rustam bin Syamsudin"] }, sidang: [SI(HARI_INI, "Pemeriksaan pokok perkara", "", 2)],
};

const NOMOR_LUAR = "555/Pdt.G/2025/PA.Dgl";
const PERKARA_LUAR_JADWAL = {
  nomorPerkara: NOMOR_LUAR, perkaraId: "9001", jenisPerkara: "Cerai Talak", alurPerkaraId: 15, sudahPutus: true, tanggalPutusan: "2025-09-01", tanggalMinutasi: "",
  adaBerkasPutusan: null, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "", paniteraNama: "", jurusitaNama: "", sebagai: [],
  pihak: { penggugat: ["Pemohon Luar"], tergugat: ["Termohon Luar"] }, sidang: [],
};
const AKUN = { hakim: ["Hakim Satu"], pp: ["PP Satu"], js: ["JS Satu"] };
type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId: string; header: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"], header: "Hakim" },
  super: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"], header: "Super Administrator" },
  admin: { nama: "Admin Biasa", peran: "Admin", roleId: "admin", golonganMenu: ["admin"], header: "Administrator" },
};

type Minta = { url: string; cara: string; badan: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; pratinjau?: (badan: any) => Response | Promise<Response>; titik?: Array<{ kode: string; nama: string }> } = {}): Halaman {
  const orang = ORANG[p.orang ?? "hakim"];
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> ${orang.header}</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const latar: Array<Record<string, unknown>> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.205.34" }),
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
  const abt: Record<string, string> = { "8503": "F" };
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    let badanMinta = "";
    if (typeof opsi?.body === "string") badanMinta = opsi.body;
    else if (opsi?.body && typeof (opsi.body as FormData).get === "function") badanMinta = JSON.stringify(Object.fromEntries([...(opsi.body as FormData).entries()].map(([k, v]) => [k, typeof v === "string" ? v : "<berkas>"])));
    else if (opsi?.body && typeof (opsi.body as URLSearchParams).toString === "function") badanMinta = String(opsi.body);
    minta.push({ url, cara, badan: badanMinta });
    // Portal
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const adm = p.orang !== "hakim";
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: adm, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: adm ? AKUN : null, perkara: [polos(PERKARA_ACUAN)] } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: false }, 404);
    // 22 Okt malam (W62): naskah tes dihitung ALETA (POST hanya menghitung) - ABT tidak diminta preview-nya.
    if (url.includes("/aleta-ecourt/blangko-derry/pratinjau") && cara === "POST") {
      const badanPratinjau = JSON.parse(badanMinta);
      if (p.pratinjau) return p.pratinjau(badanPratinjau);
      return json({ ok: true, data: { berkas: "naskah.rtf", rtfBase64: Buffer.from(RTF_MESIN, "latin1").toString("base64"), byte: RTF_MESIN.length, jumlahTerisi: 3, kosong: 0, galat: [], jumlahGalat: 0, mesinGalat: "" } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry/tes-naskah") && cara === "POST") {
      // Meniru ALETA: ketikan yang dikirim DITIMPAKAN ke naskah (seolah tersimpan); selebihnya dari "data perkara acuan".
      const b = JSON.parse(badanMinta) as { perkaraId: string; isian: Record<string, string> };
      const anak = b.isian["0007"] ?? "...";
      const rtf = RTF.replace("anak: ...;", `anak: ${anak};`).replace("PUTUSAN", `PUTUSAN ${b.perkaraId}`);
      return json({ ok: true, data: { berkas: "naskah.rtf", rtfBase64: Buffer.from(rtf, "latin1").toString("base64"), byte: rtf.length, jumlahTerisi: 3, tersisa: ["8530"], kosong: [{ noVar: "8530", nama: "Tes", sebab: "x" }], sumber: {}, mesinGalat: "", ketikanDipakai: Object.keys(b.isian || {}).length } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry/tes-cari")) {
      const kata = new URL(url, ASAL).searchParams.get("nomor") || "";
      if (p.orang !== "super") return json({ ok: false, alasan: "Tes putusan hanya untuk Super Admin." }, 403);
      if (kata.length < 3) return json({ ok: false, alasan: "Ketik paling sedikit tiga karakter nomor perkara." }, 400);
      return json({ ok: true, data: { nomor: kata, perkara: /555/.test(kata) ? [PERKARA_LUAR_JADWAL] : [] } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      // Hak folder ABT: folder "Itsbat - Putusan" HANYA untuk grup 999 (bukan hakim) - saringan yang harus dilewati Tes putusan.
      if (q.get("titik") === "1") return json({ ok: true, data: { ada: true, adaVariabel: true, titik: p.titik ?? [] } });
      if (q.get("hak") === "1") return json({ ok: true, data: { ada: true, saklar: { hakimBas: false, ppPutusan: false }, folder: [{ nama: "Itsbat - Putusan", namaAlias: "Itsbat - Putusan", user_grup_id: "999", user_top_id: "999" }] } });
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: KELOMPOK.map(([a, , folder, berkas]) => ({ nama: folder, jenis: JENIS_FOLDER[a], berkas: [`${berkas}.rtf`] })), sumber: "pohon", sebab: "" } });
      const s = susunIsian(PENANDA, KATALOG, { P: q.get("sebutanP") || "Penggugat", T: q.get("sebutanT") || "Tergugat" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      const nilai: Record<string, unknown> = {};
      for (const k of kode) nilai[k] = statusNilaiLayar(abt[k] ? { status: "terisi", teks: abt[k], nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" }, kodeTanyaJawab(s).has(k));
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${q.get("berkas")}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai, nilaiAda: true, nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/pdf")) return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from("%PDF-1.4 uji").toString("base64"), byte: 12 } });
    if (url.includes("/aleta-ecourt/tanda-tangan")) return json({ ok: false, alasan: "tidak berwenang" }, 403);
    if (url.includes("/aleta-ecourt/putusan/unggah-sipp")) return json({ ok: true, data: { ok: true } });
    // ABT
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    const m = url.match(/\?a=(D\d)/);
    if (m && url.startsWith(BERANDA)) {
      const [a, nama, , berkas] = KELOMPOK.find((x) => x[0] === m[1])!;
      return html(HAL_KELOMPOK(nama, berkas, `A-${a}`, `B-${a}`));
    }
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    if (url.startsWith(`${ABT}/edit_data?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      if (cara === "POST") {
        abt[kode] = String(new URLSearchParams(badanMinta).get("value") || "");
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      if (kode === "0050") return html(POPUP(kode, "multi_sidang", String(q.get("d") || "1")));
      return html(POPUP(kode, KATALOG.get(kode)?.jenis || "data_teks", abt[kode] || ""));
    }
    if (url.startsWith(`${ABT}/preview?`)) return new Response(new Blob([RTF]), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="${NOMOR_ACUAN} - naskah.rtf"` } });
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return { dom, w, simpanan, minta, latar, abt };
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
const ubah = (h: Halaman, el: HTMLInputElement | HTMLSelectElement, nilai: string | boolean) => {
  if (typeof nilai === "boolean") (el as HTMLInputElement).checked = nilai;
  else el.value = nilai;
  el.dispatchEvent(new h.w.Event("change", { bubbles: true }));
};
const ketik = (h: Halaman, el: HTMLInputElement, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  el.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
};
const kerangka = (h: Halaman) => h.w.aletaBlangkoDerry;
const isian = (h: Halaman) => h.w.aletaBlangkoDerryIsian;
const mintaKe = (h: Halaman, pola: RegExp, cara?: string) => h.minta.filter((m) => pola.test(m.url) && (!cara || m.cara === cara));
const tulis = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && m.cara !== "HEAD");

async function bukaPanel(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || kerangka(h).keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar perkara");
}
async function pilihAcuan(h: Halaman) {
  await bukaPanel(h);
  klik(h, `[data-pk="${NOMOR_ACUAN}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function lihatSebagaiHakim(h: Halaman) {
  await bukaPanel(h);
  ubah(h, q(h, "#bd-lihat") as HTMLSelectElement, "hakim|Hakim Satu");
  await sampai(() => (q(h, "#bd-siapa")?.textContent || "").includes("dilihat sebagai Hakim Satu") && q(h, "[data-pk]"), "daftar sebagai hakim");
  klik(h, `[data-pk="${NOMOR_ACUAN}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function nyalakanTes(h: Halaman) {
  ubah(h, q(h, "#bd-tes") as HTMLInputElement, true);
  await sampai(() => kerangka(h).tesPutusan() === true && !q(h, "#bd-pitates")!.hidden, "tes menyala");
}
async function bukaModal(h: Halaman) {
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
  await sampai(() => qq(h, ".bd-mkiri [data-kelmodal]").length > 0, "kelompok");
}
const tabModal = (h: Halaman) => qq(h, ".bd-mkepala [data-jenismodal]").map((b) => b.getAttribute("data-jenismodal"));
const kiriModal = (h: Halaman) => qq(h, ".bd-mkiri [data-kelmodal]").map((b) => b.getAttribute("data-kelmodal"));
/** Semua nama blangko yang dapat dipilih di satu tab (memuat tiap kelompok lewat pencarian kosong -> klik kelompok satu per satu). */
async function berkasTab(h: Halaman, jenis: string) {
  klik(h, `[data-jenismodal="${jenis}"]`);
  await sampai(() => q(h, `[data-jenismodal="${jenis}"][aria-selected="true"]`), `tab ${jenis}`);
  const hasil: string[] = [];
  for (const id of kiriModal(h)) {
    if (!id || !id.startsWith("k:")) continue; // "saran" dan kelompok maya Ikrar Talak bukan kelompok menu
    klik(h, `[data-kelmodal="${id}"]`);
    await sampai(() => q(h, `[data-kelmodal="${id}"].aktif`) && (qq(h, ".bd-mkanan [data-bl]").length > 0 || (q(h, ".bd-mkanan .bd-catat") && !/Membaca/.test(q(h, ".bd-mkanan .bd-catat")!.textContent || ""))), `isi ${id}`);
    hasil.push(...qq(h, ".bd-mkanan [data-bl]").map((b) => b.getAttribute("data-bl") || ""));
  }
  return hasil;
}

async function bukaCT(h: Halaman) {
  await bukaModal(h);
  klik(h, '[data-kelmodal="k:CT - Putusan"]');
  await sampai(() => q(h, `[data-bl="${B_CT}"]`), "blangko CT termuat");
  klik(h, `[data-bl="${B_CT}"]`);
  await sampai(() => q(h, "#bd-i0007"), "isian tergambar");
  await tunggu(80);
}
const mintaPratinjau = (h: Halaman) => mintaKe(h, /blangko-derry\/pratinjau/, "POST");
const mintaPreviewAbt = (h: Halaman) => mintaKe(h, /\/preview\?/);
const jsonRespons = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });


const RTF_LIHAT = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}}\\pard\\qc\\b PUTUSAN\\b0\\par\\pard Penggugat: ~~ALV:0046~~SITI REKAAN~~/ALV~~; anak: ~~ALV:0007~~...~~/ALV~~;\\par\\pard\\qc DUDUK PERKARA\\par\\pard Bahwa ~~ALV:0046~~Siti \\b Rekaan\\b0 ~~/ALV~~ menikah; ~~ALV:4001~~Kalimat ~~ALV:0007~~dua anak~~/ALV~~ selesai~~/ALV~~;\\par\\pard\\qc MENGADILI\\par\\pard Mengabulkan gugatan ~~ALV:0046~~Siti Rekaan~~/ALV~~;\\par}`;
const jawabLihat = (rtf: string, tambah: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: true, data: { berkas: "naskah.rtf", rtfBase64: Buffer.from(rtf, "latin1").toString("base64"), byte: rtf.length, jumlahTerisi: 3, kosong: 0, galat: [], jumlahGalat: 0, mesinGalat: "", ...tambah } }), { status: 200, headers: { "Content-Type": "application/json" } });
const pratinjauLihat = (badan: any) => jawabLihat(badan.tandaLihat ? RTF_LIHAT : RTF_MESIN);
const tombolLihat = (h: Halaman, kode: string) => q(h, `[data-bd2="lihat"][data-kode="${kode}"]`) as HTMLButtonElement | null;
const nyala = (h: Halaman) => Array.from(akar(h).querySelectorAll(".bd-lh.nyala")) as HTMLElement[];
const aktif = (h: Halaman) =>
  (Array.from(akar(h).querySelectorAll(".bd-lh.aktif")) as HTMLElement[])
    .map((e) => e.textContent)
    .join("");
const hit = (h: Halaman) => (q(h, "#bd-lihathit")?.textContent || "").trim();
const mintaBertanda = (h: Halaman) => mintaKe(h, /blangko-derry\/pratinjau/, "POST").filter((m) => JSON.parse(m.badan).tandaLihat === true);

async function siapLihat(h: Halaman) {
  await pilihAcuan(h);
  await bukaCT(h);
  await sampai(() => /Lihat · \d/.test(tombolLihat(h, "0007")?.textContent || ""), "jumlah temuan tampil", 8000);
}

describe("tombol Lihat di naskah", () => {
  it("hakim dan Admin biasa: tidak ada tombol dan tidak ada permintaan berpenanda", async () => {
    for (const orang of ["hakim", "admin"]) {
      const h = buka({ orang, pratinjau: pratinjauLihat });
      await pilihAcuan(h);
      await bukaCT(h);
      await tunggu(2800);
      expect(q(h, '[data-bd2="lihat"]'), orang).toBeNull();
      expect(mintaBertanda(h), orang).toHaveLength(0);
    }
  }, 30000);

  it("Super Admin: jumlah temuan tampil sebelum diklik, termasuk isian di dalam kalimat otomatis", async () => {
    const h = buka({ orang: "super", pratinjau: pratinjauLihat });
    await siapLihat(h);
    expect(tombolLihat(h, "0007")!.textContent).toBe("Lihat · 2");
    expect(mintaBertanda(h).length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it("klik: pratinjau terbuka, temuan diblok, Berikutnya dan Sebelumnya berputar tanpa permintaan baru", async () => {
    const h = buka({ orang: "super", pratinjau: pratinjauLihat });
    await siapLihat(h);
    tombolLihat(h, "0007")!.click();
    await sampai(() => q(h, "#bd-kertas .bd-lh.aktif"), "blok tampil");
    expect(nyala(h).length).toBeGreaterThanOrEqual(2);
    expect(hit(h)).toBe("1 dari 2");
    expect(aktif(h)).toBe("...");
    expect(q(h, "#bd-kertas .bd-lh.aktif")!.classList.contains("kos")).toBe(true);
    expect(q(h, "#bd-lihatbag")!.textContent).toBe("Kepala");
    expect(q(h, "#bd-lihatbilah b")!.textContent).toBe(q(h, '.bd-f[data-f="0007"] label')!.textContent);
    await tunggu(50);
    const sebelum = mintaKe(h, /blangko-derry\/pratinjau/, "POST").length;
    klik(h, '[data-bd2="lihatlanjut"]');
    expect(hit(h)).toBe("2 dari 2");
    expect(aktif(h)).toBe("dua anak");
    expect(q(h, "#bd-lihatbag")!.textContent).toBe("Duduk perkara");
    klik(h, '[data-bd2="lihatlanjut"]');
    expect(hit(h)).toBe("1 dari 2");
    klik(h, '[data-bd2="lihatbalik"]');
    expect(hit(h)).toBe("2 dari 2");
    expect(mintaKe(h, /blangko-derry\/pratinjau/, "POST").length).toBe(sebelum);
  }, 30000);

  it("hasil yang terpecah format tetap satu temuan, dan penanda tidak pernah tampil", async () => {
    const h = buka({ orang: "super", pratinjau: pratinjauLihat });
    await siapLihat(h);
    tombolLihat(h, "0007")!.click();
    await sampai(() => q(h, "#bd-kertas .bd-lh.aktif"), "blok tampil");
    const kertas = q(h, "#bd-kertas")!;
    expect(kertas.textContent).not.toContain("~~");
    expect(kertas.textContent).not.toContain("ALV");
    expect(akar(h).querySelectorAll('.bd-lh[data-lh~="0046.2"]').length).toBeGreaterThanOrEqual(2);
    expect(Array.from(akar(h).querySelectorAll('.bd-lh[data-lh~="0046.2"]')).map((e) => e.textContent).join("")).toContain("Rekaan");
    expect(akar(h).querySelectorAll('.bd-lh[data-lh~="0046.4"]').length).toBe(0);
  }, 30000);

  it("Tutup dan Esc menghapus blok; Kembali ke isian memberi fokus ke kotaknya; bilah tetap saat kembali", async () => {
    const h = buka({ orang: "super", pratinjau: pratinjauLihat });
    await siapLihat(h);
    tombolLihat(h, "0007")!.click();
    await sampai(() => q(h, "#bd-kertas .bd-lh.aktif"), "blok tampil");
    let fokus: Element | null = null;
    const asal = h.w.HTMLElement.prototype.focus;
    h.w.HTMLElement.prototype.focus = function (this: Element) {
      fokus = this;
    };
    klik(h, '[data-bd2="lihatkembali"]');
    expect(fokus).toBe(q(h, "#bd-i0007"));
    expect(q(h, "#bd-lihatbilah")).not.toBeNull();
    h.w.HTMLElement.prototype.focus = asal;
    klik(h, '[data-bd2="lihattutup"]');
    expect(q(h, "#bd-lihatbilah")).toBeNull();
    expect(nyala(h)).toHaveLength(0);
    tombolLihat(h, "0007")!.click();
    await sampai(() => q(h, "#bd-kertas .bd-lh.aktif"), "blok tampil lagi");
    akar(h).dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(q(h, "#bd-lihatbilah")).toBeNull();
    expect(nyala(h)).toHaveLength(0);
  }, 30000);

  it("isian tanpa temuan menyebut sebabnya", async () => {
    const h = buka({ orang: "super", pratinjau: (b: any) => jawabLihat(b.tandaLihat ? RTF_LIHAT.split("~~ALV:0007~~").join("").split("~~/ALV~~").join("") : RTF_MESIN) });
    await siapLihat(h);
    expect(tombolLihat(h, "0007")!.textContent).toBe("Lihat · 0");
    tombolLihat(h, "0007")!.click();
    await sampai(() => q(h, "#bd-lihatbilah"), "bilah");
    expect(hit(h)).toBe("0 temuan");
    expect(q(h, "#bd-lihatpesan")!.textContent).toContain("Tidak tertulis langsung di naskah ini");
    expect((q(h, '[data-bd2="lihatlanjut"]') as HTMLButtonElement).disabled).toBe(true);
  }, 30000);

  it("mesin ragu: tombol tanpa angka, klik memberi tahu jumlah belum tersedia", async () => {
    const h = buka({ orang: "super", pratinjau: (b: any) => jawabLihat(RTF_MESIN, b.tandaLihat ? { jumlahGalat: 1, galat: [{ nama: "X", sebab: "kueri gagal" }] } : {}) });
    await pilihAcuan(h);
    await bukaCT(h);
    await sampai(() => mintaBertanda(h).length > 0, "permintaan berpenanda", 8000);
    await tunggu(50);
    expect(tombolLihat(h, "0007")!.textContent).toBe("Lihat");
    tombolLihat(h, "0007")!.click();
    await sampai(() => (q(h, "#bd-lihatpesan")?.textContent || "").includes("Jumlah temuan belum tersedia"), "pesan");
    expect(nyala(h)).toHaveLength(0);
  }, 30000);

  it("penyusun blok: isian bersarang terhitung pada keduanya, tiap kemunculan bernomor sendiri", async () => {
    const h = buka({ orang: "super", pratinjau: pratinjauLihat });
    await bukaPanel(h);
    const { html, temuan } = h.w.aletaBlangkoDerryIsian.lihatMurni.rtfKeHtmlLihat(RTF_LIHAT);
    expect(temuan).toEqual({ "0046": [1, 2, 3], "0007": [1, 2], "4001": [1] });
    expect(html).not.toContain("~~");
    expect(html).toContain('data-lh="4001.1 0007.2"');
  }, 30000);

  it("naskah berpenanda tidak menjadi naskah Cetak", async () => {
    const h = buka({ orang: "super", pratinjau: pratinjauLihat });
    await siapLihat(h);
    tombolLihat(h, "0007")!.click();
    await sampai(() => q(h, "#bd-kertas .bd-lh.aktif"), "blok tampil");
    await tunggu(50);
    expect(h.w.aletaBlangkoDerryIsian.keadaan().prat.adaRtf).toBe(false);
    // Permintaan ke ABT untuk naskah Cetak tidak terjadi dari tombol ini.
    expect(h.minta.filter((m) => /abt\/preview|main\/preview/.test(m.url))).toEqual([]);
  }, 30000);
});
