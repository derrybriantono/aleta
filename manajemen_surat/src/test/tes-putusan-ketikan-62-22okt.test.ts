// @vitest-environment node
/**
 * ============================================================================
 * 22 OKT 2026 MALAM (W62) - TES PUTUSAN: KETIKAN MASUK PRATINJAU + PERKARA ACUAN DICARI MENURUT NOMOR
 * ============================================================================
 *
 * Kerangka jsdom sama dengan tes-putusan-blangko-derry-22okt (W56). Yang dijaga:
 *   6  ketikan di kotak isian saat Tes putusan DIKIRIM ke ALETA (POST tes-naskah, badan permintaan, tanpa disimpan) dan tampil di pratinjau
 *      serta unduhan -TES; tetap ada saat pindah blangko pada perkara acuan yang sama; lenyap saat tes dimatikan / perkara diganti;
 *      huruf yang ditolak ABT ditolak juga; NOL permintaan tulis ke ABT, SIPP, e-Court (hanya GET dan POST hitung);
 *   7  perkara acuan dapat dicari menurut nomor APA PUN (di luar jadwal): GET tes-cari, dipilih sebagai acuan, blangko dibaca atas
 *      perkaraId-nya; hanya Super Admin; dimatikan -> pilihan dilepas.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

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

function buka(p: { orang?: string; simpanan?: Record<string, unknown> } = {}): Halaman {
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

// ============================================================================
// 6. Ketikan masuk pratinjau
// ============================================================================
async function bukaCT(h: Halaman) {
  await bukaModal(h);
  klik(h, '[data-kelmodal="k:CT - Putusan"]');
  await sampai(() => q(h, `[data-bl="${B_CT}"]`), "blangko CT termuat");
  klik(h, `[data-bl="${B_CT}"]`);
  await sampai(() => q(h, "#bd-i0007"), "isian tergambar");
  await tunggu(80);
}
const badanTes = (h: Halaman) => mintaKe(h, /blangko-derry\/tes-naskah/, "POST").map((m) => JSON.parse(m.badan) as { perkaraId: string; folder: string; berkas: string; isian: Record<string, string>; sidangKe: number });

describe("6. ketikan masuk pratinjau tes tanpa menulis", () => {
  it("diketik -> pratinjau memuatnya (POST hitung), kotak tidak terkunci, status 'tidak disimpan', NOL tulis ke ABT", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    await nyalakanTes(h);
    await bukaCT(h);
    const kotak = q(h, "#bd-i0007") as HTMLInputElement;
    expect(kotak.disabled).toBe(false);
    ketik(h, kotak, "telah dikaruniai 2 orang anak");
    await tunggu(30);
    expect(q(h, '[data-status="0007"]')!.textContent).toContain("tidak disimpan");
    expect(qq(h, ".bd-petunjuk").map((e) => e.textContent).join(" ")).toContain("hanya dipakai di pratinjau");
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => q(h, "#bd-kertas"), "pratinjau tampil");
    expect(q(h, "#bd-kertas")!.textContent).toContain("anak: telah dikaruniai 2 orang anak");
    const badan = badanTes(h);
    expect(badan).toHaveLength(1);
    expect(badan[0].isian).toEqual({ "0007": "telah dikaruniai 2 orang anak" });
    expect(badan[0].perkaraId).toBe("10154");
    expect(badan[0].berkas).toBe(B_CT);
    // Pita memuat ringkasan naskah tes (bagian kosong ditandai, tidak dikarang).
    expect(q(h, ".bd-pitates.kecil")!.textContent).toMatch(/1 bagian belum punya data/);
    // Nol tulis: tidak ada edit_data POST, tanya jawab, anonim, unggah, main/cari; ABT tidak menyusun preview.
    expect(h.abt["0007"]).toBeUndefined();
    expect(mintaKe(h, /edit_data/, "POST")).toEqual([]);
    expect(mintaKe(h, /tanyajawab_perkara_edit|validasi_bas|main\/anonim|main\/cari|unggah-sipp|konseptor-langkah/)).toEqual([]);
    expect(mintaKe(h, /abt\/preview\?/)).toEqual([]);
    for (const m of tulis(h)) expect(/\/blangko-derry\/tes-naskah$|\/abt\/pdf$|\/abt\/usulan$/.test(m.url.split("?")[0])).toBe(true);
    // Tak ada jejak di penyimpanan peramban.
    expect(JSON.stringify(h.simpanan)).not.toContain("telah dikaruniai 2 orang anak");
  });

  it("diubah lagi -> penanda 'muat ulang'; dimuat ulang -> ketikan terbaru; ketikan yang belum dilepas fokusnya ikut", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    await nyalakanTes(h);
    await bukaCT(h);
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "satu");
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => q(h, "#bd-kertas"), "pratinjau tampil");
    expect(q(h, "#bd-kertas")!.textContent).toContain("anak: satu");
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "dua");
    await sampai(() => q(h, ".bd-pratbuka")?.textContent?.includes("isian berubah - muat ulang"), "penanda muat ulang");
    // Ketikan tanpa focusout (masih di kotak) tetap terkirim.
    const el = q(h, "#bd-i0007") as HTMLInputElement;
    el.value = "tiga";
    el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    klik(h, '[data-bd2="muatprat"]');
    await sampai(() => q(h, "#bd-kertas")?.textContent?.includes("anak: tiga"), "ketikan terbaru");
    expect(badanTes(h).map((b) => b.isian["0007"])).toEqual(["satu", "tiga"]);
    expect(q(h, '[data-bd2="muatprat"]')!.textContent).toContain("ketikan terbaru");
  });

  it("unduh -TES memuat ketikan; pindah blangko pada perkara yang sama membawa ketikan; tes dimatikan -> lenyap", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    await nyalakanTes(h);
    await bukaCT(h);
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "telah dikaruniai 2 orang anak");
    klik(h, '[data-bd2="cetak"]');
    await sampai(() => h.latar.filter((m) => m.jenis === "unduh").length >= 1 || (q(h, "#bd-ingat") && !q(h, "#bd-ingat")!.hidden), "unduhan atau pengingat", 8000);
    if (h.latar.filter((m) => m.jenis === "unduh").length < 1) klik(h, '[data-bd2="tetapcetak"]');
    await sampai(() => h.latar.filter((m) => m.jenis === "unduh").length >= 1, "rtf diunduh", 8000);
    const unduh = h.latar.filter((m) => m.jenis === "unduh");
    expect(String(unduh[0].nama)).toMatch(/-TES\.rtf$/);
    expect(badanTes(h).at(-1)!.isian["0007"]).toBe("telah dikaruniai 2 orang anak");
    // Pindah ke blangko CG (perkara acuan sama): ketikan tetap di kotak (seolah tersimpan).
    await bukaModal(h);
    klik(h, '[data-kelmodal="k:CG - Putusan"]');
    await sampai(() => q(h, `[data-bl="${B_CG}"]`), "blangko CG termuat");
    klik(h, `[data-bl="${B_CG}"]`);
    await sampai(() => (q(h, "#bd-i0007") as HTMLInputElement | null)?.value === "telah dikaruniai 2 orang anak", "ketikan terbawa");
    // Tes dimatikan: kotak tidak berisi ketikan lagi (pilihan blangko dibuang -> pilih ulang tanpa tes).
    ubah(h, q(h, "#bd-tes") as HTMLInputElement, false);
    await sampai(() => kerangka(h).tesPutusan() === false, "tes mati");
    expect(JSON.stringify(h.simpanan)).not.toContain("telah dikaruniai 2 orang anak");
    expect(isian(h).murni.permintaanAbtAman).toBeTypeOf("function");
  });

  it("huruf yang ditolak ABT ditolak juga: tidak dikirim, status gagal", async () => {
    const h = buka({ orang: "super" });
    await pilihAcuan(h);
    await nyalakanTes(h);
    await bukaCT(h);
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "anak \u{1F600}");
    await tunggu(30);
    expect(q(h, '[data-status="0007"]')!.textContent).toMatch(/^gagal: huruf/);
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => q(h, "#bd-kertas"), "pratinjau tampil");
    expect(badanTes(h)[0].isian).toEqual({});
  });

  it("tanpa tes: ketikan MENULIS ke ABT seperti biasa dan pratinjau tetap dari ABT (tidak ada POST tes-naskah)", async () => {
    const h = buka({ orang: "super" });
    await lihatSebagaiHakim(h);
    await bukaModal(h);
    klik(h, '[data-kelmodal="k:CG - Putusan"]');
    await sampai(() => q(h, `[data-bl="${B_CG}"]`), "blangko CG termuat");
    klik(h, `[data-bl="${B_CG}"]`);
    await sampai(() => q(h, "#bd-i0007"), "isian tergambar");
    await tunggu(80);
    ketik(h, q(h, "#bd-i0007") as HTMLInputElement, "telah dikaruniai 2 orang anak");
    await sampai(() => mintaKe(h, /edit_data/, "POST").length >= 1, "ABT ditulis", 4000);
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => q(h, "#bd-kertas"), "pratinjau tampil");
    expect(mintaKe(h, /tes-naskah/)).toEqual([]);
    expect(mintaKe(h, /abt\/preview\?/, "GET").length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 7. Perkara acuan dicari menurut nomor apa pun
// ============================================================================
describe("7. cari nomor perkara di SIPP sebagai perkara acuan", () => {
  it("hanya tampil bagi Super Admin saat tes menyala; mengetik nomor -> GET tes-cari -> hasil dapat dipilih", async () => {
    const h = buka({ orang: "super" });
    await bukaPanel(h);
    expect(q(h, "#bd-tescari")).toBeNull(); // tes belum menyala
    await nyalakanTes(h);
    const kotak = await sampai(() => q(h, "#bd-tescari") as HTMLInputElement | null, "kotak cari nomor");
    ketik(h, kotak, "555/Pdt.G/2025");
    klik(h, '[data-bd="tescari"]');
    await sampai(() => q(h, `[data-tespk="${NOMOR_LUAR}"]`), "hasil cari");
    const panggilan = mintaKe(h, /blangko-derry\/tes-cari/);
    expect(panggilan).toHaveLength(1);
    expect(panggilan[0].cara).toBe("GET");
    expect(decodeURIComponent(panggilan[0].url)).toContain("nomor=555/Pdt.G/2025");
    expect(q(h, `[data-tespk="${NOMOR_LUAR}"]`)!.textContent).toContain("Pemohon Luar");
    expect(qq(h, `[data-pk="${NOMOR_LUAR}"]`)).toHaveLength(0); // bukan dari jadwal
  });

  it("dipilih -> menjadi perkara acuan; blangko dibaca atas perkaraId-nya; pita menyebut nomornya; NOL tulis", async () => {
    const h = buka({ orang: "super" });
    await bukaPanel(h);
    await nyalakanTes(h);
    ketik(h, (await sampai(() => q(h, "#bd-tescari") as HTMLInputElement | null, "kotak")) , "555");
    klik(h, '[data-bd="tescari"]');
    await sampai(() => q(h, `[data-tespk="${NOMOR_LUAR}"]`), "hasil cari");
    klik(h, `[data-tespk="${NOMOR_LUAR}"]`);
    await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
    expect(q(h, "#bd-pkringkas")!.textContent).toContain(NOMOR_LUAR);
    expect(q(h, "#bd-pitates")!.textContent).toContain(NOMOR_LUAR);
    await bukaCT(h);
    const baca = mintaKe(h, /blangko-derry\?folder=/, "GET").map((m) => m.url);
    expect(baca.length).toBeGreaterThan(0);
    expect(baca.every((u) => /perkaraId=9001/.test(u))).toBe(true);
    klik(h, '[data-bd2="bukaprat"]');
    await sampai(() => q(h, "#bd-kertas"), "pratinjau tampil");
    expect(badanTes(h)[0].perkaraId).toBe("9001");
    expect(q(h, "#bd-kertas")!.textContent).toContain("PUTUSAN 9001");
    expect(mintaKe(h, /edit_data/, "POST")).toEqual([]);
    for (const m of tulis(h)) expect(/\/blangko-derry\/tes-naskah$|\/abt\/pdf$|\/abt\/usulan$/.test(m.url.split("?")[0])).toBe(true);
  });

  it("kurang dari tiga karakter: pesan, tanpa permintaan; tidak ada hasil: pesan jelas", async () => {
    const h = buka({ orang: "super" });
    await bukaPanel(h);
    await nyalakanTes(h);
    const kotak = await sampai(() => q(h, "#bd-tescari") as HTMLInputElement | null, "kotak");
    ketik(h, kotak, "55");
    klik(h, '[data-bd="tescari"]');
    await sampai(() => q(h, ".bd-tescari ~ .bd-catat[role='alert']"), "pesan pendek");
    expect(mintaKe(h, /tes-cari/)).toEqual([]);
    ketik(h, q(h, "#bd-tescari") as HTMLInputElement, "999/Pdt.G");
    klik(h, '[data-bd="tescari"]');
    await sampai(() => /Tidak ada perkara yang nomornya memuat/.test(q(h, ".bd-tescari ~ .bd-catat")?.textContent || ""), "tidak ada hasil");
  });

  it("tes dimatikan: perkara acuan di luar jadwal dilepas dan kotak cari hilang; admin/hakim tak punya kotaknya", async () => {
    const h = buka({ orang: "super" });
    await bukaPanel(h);
    await nyalakanTes(h);
    ketik(h, (await sampai(() => q(h, "#bd-tescari") as HTMLInputElement | null, "kotak")), "555");
    klik(h, '[data-bd="tescari"]');
    await sampai(() => q(h, `[data-tespk="${NOMOR_LUAR}"]`), "hasil cari");
    klik(h, `[data-tespk="${NOMOR_LUAR}"]`);
    await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
    ubah(h, q(h, "#bd-tes") as HTMLInputElement, false);
    await sampai(() => kerangka(h).tesPutusan() === false, "tes mati");
    await sampai(() => q(h, "[data-pk]") && !q(h, "#bd-tescari"), "kembali ke daftar jadwal");
    expect(kerangka(h).keadaan().perkara ?? null).toBeNull();
    for (const orang of ["admin", "hakim"]) {
      const l = buka({ orang });
      await bukaPanel(l);
      expect(q(l, "#bd-tescari")).toBeNull();
      expect(mintaKe(l, /tes-cari/)).toEqual([]);
    }
  });
});
