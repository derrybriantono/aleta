// @vitest-environment node
/**
 * ============================================================================
 * 2 NOV 2026 - PANEL "BLANGKO ABT BY DERRY BRIANTONO": butir 12 (bagian di bawah tanya jawab saksi diringkas)
 * ============================================================================
 *
 * Dijalankan SUNGGUHAN di jsdom (blangko-derry-isian.js + peta dalil + penilaian pembuktian, fetch & chrome tiruan, nama rekaan):
 *   - "Isian di dalam bagian otomatis" -> "Isian untuk amar": lencana kuning "perlu diisi · n" + terbuka bawaan bila ada isian berlaku
 *     yang kosong; hijau "lengkap" + tertutup bila tidak. Isian lain (sudah berisi / tidak dipakai perkara ini) di lipatan kedua dan
 *     tetap dapat disunting. Klik menutup tidak dibuka lagi saat panel digambar ulang (tiga keadaan).
 *   - "Tuntutan dalam posita dan petitum" -> "Tuntutan": lencana kuning "perlu diperiksa · n" bila ada yang ragu, hijau "lengkap" bila tidak.
 *   - Peta dalil + Penilaian pembuktian dibungkus "Bahan musyawarah majelis" (tertutup bawaan, lencana abu "tidak perlu diisi"), hanya
 *     untuk majelis/admin; PP tidak melihatnya. Buka/tutup diingat (chrome.storage "lipatTerbuka", kunci blangkoDerry:bahanMusyawarah).
 *   - CSS tambahan hanya memakai token warna, huruf >= 11,5px, tanpa animasi.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = [
  "panel-alat.js",
  "abt-klien.js",
  "blangko-derry.js",
  "saksi-katalog.js",
  "saksi-katalog-data.js",
  "blangko-derry-saksi.js",
  "blangko-derry-saksi-arah.js",
  "blangko-derry-katalog.js",
  "blangko-derry-rekomendasi.js",
  "blangko-derry-peta-dalil.js",
  "blangko-derry-penilai-bukti.js",
  "blangko-derry-isian.js",
]
  .map(baca)
  .join("\n;\n");

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
// Bahan (rekaan)
// ----------------------------------------------------------------------------
const BLANGKO_PUT = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const BLANGKO_BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";
const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  // Bagian otomatis (amar) membaca dua isian yang tidak tertulis langsung di blangko: alasan perceraian (8503) dan catatan amar (7781).
  D("4001", "AMAR PUTUSAN CERAI UNIVERSAL", "data_sql", "select data from aps_badilag.abt_data_teks where no_var = '8503' or no_var = '7781'"),
  D("8503", "ALASAN PERCERAIAN <br>SATU HURUF", "data_teks"),
  D("7781", "Catatan amar tambahan", "data_teks"),
  D("0007", "Telah Dikarunai Anak", "data_teks", "", "#8492#"),
  D("1214", "Alat-alat bukti CG/CT", "data_teks", "", "Fotokopi KTP-el atas nama #4048#"),
  D("2021", "Keterangan Saksi 1 P", "tanya_jawab"),
  D("5058", "TanyaJwb Saksi 1 P", "tanya_jawab"),
  D("2022", "Keterangan Saksi 2 P", "tanya_jawab"),
  D("5059", "TanyaJwb Saksi 2 P", "tanya_jawab"),
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
]);
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1214", "2021", "2022", "0033"];
const PENANDA_BAS = ["0001", "0033", "0050", "1214", "5058", "5059", "8503"];

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const PK = {
  nomorPerkara: "581/Pdt.G/2026/PA.Dgl", perkaraId: "10154", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: true, tanggalPutusan: HARI_INI, tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H., Hakim Dua, M.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim"], pihak: { penggugat: ["Sitirah binti Lamuda"], tergugat: ["Andi Rekaan bin Syamsu"] },
  sidang: [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI("2026-10-15", "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)", { urutan: 2 })],
};
const AKUN = { hakim: ["Hakim Satu", "Hakim Dua"], pp: ["PP Satu"], js: ["JS Satu"] };
type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  wakil: { nama: "Wakil Satu", peran: "Wakil Ketua", roleId: "wakil-ketua", golonganMenu: ["ketua"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};
// Penilaian pembuktian rekaan (bentuk keluaran rute aleta-ecourt/penilaian-bukti).
const PENILAIAN = {
  ada: true,
  sumberBahan: "abt",
  hasil: {
    baris: [
      { id: "d1", nomor: "1", ringkas: "Penggugat dan Tergugat menikah", status: "terbukti", alasan: "akta otentik", saksi: [], bukti: [] },
      { id: "d2", nomor: "2", ringkas: "Sering bertengkar", status: "belum-terbukti", alasan: "satu saksi", saksi: [], bukti: [] },
    ],
  },
};

const MENU = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${BERANDA}?a=D1&c=" title="(2 Blangko)">Putusan CG</a><a href="${BERANDA}?a=D2&c=" title="(2 Blangko)">BAS CG</a></div>`;
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");
const POPUP = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>581/Pdt.G/2026/PA.Dgl</b>` +
  (tipe === "data_tanggal" ? `<input type='text' id='tgl_form' value='${nilai}'>` : `<textarea id="value" ${tipe === "data_sql" ? "readonly" : ""}>${nilai}</textarea>`);

type Minta = { url: string; cara: string; badan: string };
type BukaOpsi = { orang?: string; abtAwal?: Record<string, string>; tuntutan?: "ragu" | "ya" | null; simpanan?: Record<string, unknown> };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; abt: Record<string, string> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: BukaOpsi = {}): Halaman {
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Panitera</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.200.2" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_p: unknown, cb?: (h: unknown) => void) => cb && cb({ ok: true, id: 1 }), lastError: undefined },
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
  const abt: Record<string, string> = { "8503": "F", ...(p.abtAwal ?? {}) };
  const orang = ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const nilaiDari = (kode: string[], tjKode: Set<string>) => {
    const n: Record<string, unknown> = {};
    for (const k of kode) {
      const v = tjKode.has(k)
        ? { status: "kosong", teks: "", nama: "", sebab: "tanya-jawab belum diisi di ABT" }
        : abt[k] !== undefined && abt[k] !== "" ? { status: "terisi", teks: abt[k], nama: "", sebab: "" } : k === "0001" ? { status: "terisi", teks: "581/Pdt.G/2026/PA.Dgl", nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" };
      n[k] = statusNilaiLayar(v, tjKode.has(k));
    }
    return n;
  };
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const badanMinta = typeof opsi?.body === "string" ? opsi.body : opsi?.body && typeof (opsi.body as URLSearchParams).toString === "function" ? String(opsi.body) : "";
    minta.push({ url, cara, badan: badanMinta });
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const admin = p.orang === "admin";
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: [polos(PK)] } });
    }
    if (url.includes("/aleta-ecourt/penilaian-bukti")) return json({ ok: true, data: polos(PENILAIAN) });
    if (url.includes("/aleta-ecourt/matriks-dalil")) return json({ ok: true, data: { ada: false, catatan: ["Dalil para pihak belum terbaca."] } });
    if (url.includes("/aleta-ecourt/rekomendasi-putusan")) return json({ ok: false, alasan: "tidak ada" }, 503);
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [{ sidangId: "s2026-10-01", tanggalSidang: "2026-10-01", jamSidang: "09:00:00", agenda: "Sidang Pertama", alasanDitunda: "Panggil Tergugat", urutanSidang: 1 }, { sidangId: "s2026-10-15", tanggalSidang: "2026-10-15", jamSidang: "09:00:00", agenda: "Pemeriksaan pokok perkara", alasanDitunda: "putus DIKABULKAN (verstek)", urutanSidang: 2 }] } } });
    if (url.includes("/aleta-ecourt/sidang/skors?")) return json({ ok: true, data: { available: true, ok: true, riwayat: [], kalimatBas: "" } });
    if (url.includes("/aleta-ecourt/blangko-derry/set-saksi")) return json({ ok: false }, 404);
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [{ nama: "1 Perceraian CG", jenis: "put", berkas: [`${BLANGKO_PUT}.rtf`] }, { nama: "ALUR 02 Cerai Verstek 2 Sidang", jenis: "bas", berkas: [`${BLANGKO_BAS}.rtf`] }], sumber: "pohon", sebab: "" } });
      const berkas = q.get("berkas") || "";
      const put = berkas.startsWith("[01]");
      const s = susunIsian(put ? PENANDA_PUT : PENANDA_BAS, KATALOG, { P: q.get("sebutanP") || "Penggugat", T: q.get("sebutanT") || "Tergugat" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      const nilai = q.get("perkaraId") ? nilaiDari(kode, kodeTanyaJawab(s)) : undefined;
      // Tuntutan nafkah iddah rekaan (bentuk susunan portal): status dari kutipan petitum #3400#.
      const tuntutan = put && p.tuntutan ? { tuntutan: [{ pemicu: "4142", label: "Nafkah iddah", keputusan: "4102", isian: [] }], kutipanTuntutan: "3400" } : {};
      if (nilai && put && p.tuntutan) nilai["3400"] = statusNilaiLayar({ status: "terisi", teks: p.tuntutan === "ragu" ? "4142|ragu|petitum di SIPP kosong" : "4142|ya|...membayar nafkah iddah sebesar Rp3.000.000,00...", nama: "", sebab: "" }, false);
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${berkas}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, ...tuntutan, nilai, nilaiAda: Boolean(q.get("perkaraId")), nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/usulan")) return json({ ok: false }, 503);
    if (url.includes("/aleta-ecourt/tanda-tangan")) return json({ ok: false, alasan: "tidak berwenang" }, 403);
    // ABT
    if (url === BERANDA) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK("Putusan Cerai Gugat", [[BLANGKO_PUT, "A01", "B01"]]));
    if (url.startsWith(`${BERANDA}?a=D2`)) return html(HAL_KELOMPOK("BAS Alur 02", [[BLANGKO_BAS, "A11", "B11"]]));
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    if (url.startsWith(`${ABT}/edit_data?`)) {
      const q = new URL(url).searchParams;
      const k = q.get("no_var") || "";
      if (cara === "POST") {
        abt[k] = String(new URLSearchParams(badanMinta).get("value") || "");
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      const def = KATALOG.get(k);
      if (k === "0050") return html(POPUP(k, "multi_sidang", "1"));
      return html(POPUP(k, def ? def.jenis : "data_teks", abt[k] || ""));
    }
    if (url.startsWith(`${ABT}/tanyajawab_perkara_edit?`)) {
      return html(`<div class="panel-heading"><b><big>581/Pdt.G/2026/PA.Dgl</big></b> - TanyaJwb Saksi : <b>Nama Saksi</b></div><select><option value='A1a'>(A1a) Pertanyaan Saksi P CG</option></select><script>var ajax_data = []\n</script>`);
    }
    if (url.startsWith(`${ABT}/preview?`)) return new Response("{\\rtf1 uji}", { status: 200, headers: { "content-type": "application/vnd.ms-word" } });
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return { dom, w, simpanan, minta, abt };
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
const ketik = (h: Halaman, el: HTMLInputElement, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  el.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
};
const kodeDi = (h: Halaman, s: string) => qq(h, `${s} .bd-f`).map((f) => f.getAttribute("data-f"));
const ringkasan = (h: Halaman, id: string) => q(h, `#${id} > summary`)!;
const lencana = (h: Halaman, id: string) => {
  const t = ringkasan(h, id).querySelector(".bd-tanda");
  return t ? { kelas: Array.from(t.classList).filter((x) => x !== "bd-tanda").join(" "), teks: t.textContent || "" } : null;
};
const terbukaEl = (h: Halaman, id: string) => (q(h, `#${id}`) as HTMLDetailsElement).open;

async function sampaiPerkara(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, '[data-pk="581/Pdt.G/2026/PA.Dgl"]');
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function pilih(h: Halaman, berkas: string) {
  await sampaiPerkara(h);
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, `[data-bl="${berkas}"]`), "berkas termuat");
  klik(h, `[data-bl="${berkas}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f") || q(h, "[data-tj]"), "perlu diisi tergambar");
}
const pilihPutusan = (h: Halaman) => pilih(h, BLANGKO_PUT);

// ============================================================================
describe("butir 12: Isian untuk amar", () => {
  it("ada isian berlaku yang kosong: judul baru, lencana kuning 'perlu diisi · 1', terbuka bawaan; isian perlu tampil dulu", async () => {
    const h = buka({ abtAwal: { "8503": "", "7781": "Biaya dibebankan kepada Penggugat" } });
    await pilihPutusan(h);
    await sampai(() => q(h, "#bd-lanjutan"), "bagian isian untuk amar");
    const r = ringkasan(h, "bd-lanjutan").textContent || "";
    expect(r).toMatch(/^Isian untuk amar /);
    expect(r).not.toContain("Isian di dalam bagian otomatis");
    expect(r).toContain("tidak tertulis langsung di blangko, dibaca kalimat otomatis (mis. amar)");
    expect(lencana(h, "bd-lanjutan")).toEqual({ kelas: "kuning", teks: "perlu diisi · 1" });
    expect(terbukaEl(h, "bd-lanjutan")).toBe(true);
    expect(ringkasan(h, "bd-lanjutan").getAttribute("aria-expanded")).toBe("true");
    // Yang perlu (8503 kosong) di atas; yang sudah berisi (7781) di lipatan kedua yang tertutup.
    expect(kodeDi(h, "#bd-lanjutanperlu")).toEqual(["8503"]);
    expect(kodeDi(h, "#bd-lanjutanlain")).toEqual(["7781"]);
    expect(terbukaEl(h, "bd-lanjutanlain")).toBe(false);
    expect(ringkasan(h, "bd-lanjutanlain").textContent).toBe("Isian lain (1) · sudah berisi atau tidak dipakai perkara ini");
    expect(q(h, "#bd-lanjutanperlu")!.compareDocumentPosition(q(h, "#bd-lanjutanlain")!) & h.w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("isian lain di lipatan kedua tetap dapat disunting dan tersimpan ke ABT", async () => {
    const h = buka({ abtAwal: { "8503": "", "7781": "Biaya dibebankan kepada Penggugat" } });
    await pilihPutusan(h);
    await sampai(() => q(h, "#bd-lanjutanlain"), "lipatan kedua");
    klik(h, '[data-bd2="lanjutanlain"]');
    expect(terbukaEl(h, "bd-lanjutanlain")).toBe(true);
    const el = q(h, "#bd-lanjutanlain #bd-i7781") as HTMLInputElement;
    expect(el).not.toBeNull();
    expect(el.value).toBe("Biaya dibebankan kepada Penggugat");
    expect(el.disabled || el.readOnly).toBe(false);
    ketik(h, el, "Biaya dibebankan menurut hukum");
    await sampai(() => h.abt["7781"] === "Biaya dibebankan menurut hukum", "isian lain tersimpan ke ABT");
  });

  it("semua berisi: lencana hijau 'lengkap', tertutup bawaan; dibuka = semua isian tetap ada dan dapat disunting", async () => {
    const h = buka({ abtAwal: { "8503": "F", "7781": "Biaya dibebankan kepada Penggugat" } });
    await pilihPutusan(h);
    await sampai(() => q(h, "#bd-lanjutan"), "bagian isian untuk amar");
    expect(lencana(h, "bd-lanjutan")).toEqual({ kelas: "hijau", teks: "lengkap" });
    expect(terbukaEl(h, "bd-lanjutan")).toBe(false);
    expect(ringkasan(h, "bd-lanjutan").getAttribute("aria-expanded")).toBe("false");
    expect(kodeDi(h, "#bd-lanjutan").sort()).toEqual(["7781", "8503"]);
    expect(q(h, "#bd-lanjutanperlu")).toBeNull();
    klik(h, '[data-bd2="lanjutan"]');
    expect(terbukaEl(h, "bd-lanjutan")).toBe(true);
    expect((q(h, "#bd-lanjutan #bd-i8503") as HTMLInputElement).value).toBe("F");
  });

  it("klik menutup (dan membuka) diingat: digambar ulang tidak membalik pilihan petugas", async () => {
    const h = buka({ abtAwal: { "8503": "", "7781": "Biaya dibebankan kepada Penggugat" }, tuntutan: "ragu" });
    await pilihPutusan(h);
    await sampai(() => q(h, "#bd-lanjutan") && q(h, "#bd-tuntutan"), "bagian tergambar");
    expect(terbukaEl(h, "bd-lanjutan")).toBe(true);
    expect(terbukaEl(h, "bd-tuntutan")).toBe(true);
    klik(h, '[data-bd2="lanjutan"]');
    klik(h, '[data-bd2="tuntutan"]');
    expect(terbukaEl(h, "bd-lanjutan")).toBe(false);
    expect(terbukaEl(h, "bd-tuntutan")).toBe(false);
    // "Tetapkan karena jabatan" menggambar ulang seluruh isian (dan sengaja membuka Tuntutan).
    const lama = q(h, "#bd-lanjutan");
    klik(h, '[data-bd2="jabatan"]');
    await sampai(() => q(h, "#bd-lanjutan") !== lama, "digambar ulang");
    expect(terbukaEl(h, "bd-lanjutan")).toBe(false);
    expect(lencana(h, "bd-lanjutan")!.teks).toBe("perlu diisi · 1");
    expect(terbukaEl(h, "bd-tuntutan")).toBe(true);
    // Tuntutan ditutup lagi oleh petugas lalu digambar ulang: tetap tertutup walau masih ada yang ragu.
    klik(h, '[data-bd2="tuntutan"]');
    const lama2 = q(h, "#bd-tuntutan");
    klik(h, '[data-bd2="jabatan"]');
    await sampai(() => q(h, "#bd-tuntutan") !== lama2, "digambar ulang (2)");
    expect(terbukaEl(h, "bd-tuntutan")).toBe(true); // jabatan = membuka dengan sengaja (perilaku lama)
    // Dibuka petugas pada "lengkap" juga bertahan.
    klik(h, '[data-bd2="lanjutan"]');
    expect(terbukaEl(h, "bd-lanjutan")).toBe(true);
    const lama3 = q(h, "#bd-lanjutan");
    klik(h, '[data-bd2="jabatan"]');
    await sampai(() => q(h, "#bd-lanjutan") !== lama3, "digambar ulang (3)");
    expect(terbukaEl(h, "bd-lanjutan")).toBe(true);
  });
});

// ============================================================================
describe("butir 12: Tuntutan", () => {
  it("ada yang ragu: judul 'Tuntutan', lencana kuning 'perlu diperiksa · 1', terbuka; tombol Tetapkan karena jabatan tetap ada", async () => {
    const h = buka({ tuntutan: "ragu" });
    await pilihPutusan(h);
    await sampai(() => q(h, "#bd-tuntutan"), "bagian tuntutan");
    const r = ringkasan(h, "bd-tuntutan").textContent || "";
    expect(r).toMatch(/^Tuntutan /);
    expect(r).not.toContain("Tuntutan dalam posita dan petitum");
    expect(lencana(h, "bd-tuntutan")).toEqual({ kelas: "kuning", teks: "perlu diperiksa · 1" });
    expect(r).toContain("tidak ada yang diminta, 1 tidak diminta");
    expect(terbukaEl(h, "bd-tuntutan")).toBe(true);
    expect(q(h, '#bd-tuntutan [data-bd2="jabatan"]')!.textContent).toBe("Tetapkan karena jabatan");
    expect(q(h, "#bd-tuntutan .bd-tuntutandaftar")!.textContent).toContain("ragu - periksa surat gugatan");
  });

  it("tidak ada yang ragu: lencana hijau 'lengkap' + ringkasan lama, tertutup bawaan", async () => {
    const h = buka({ tuntutan: "ya" });
    await pilihPutusan(h);
    await sampai(() => q(h, "#bd-tuntutan"), "bagian tuntutan");
    expect(lencana(h, "bd-tuntutan")).toEqual({ kelas: "hijau", teks: "lengkap" });
    expect(ringkasan(h, "bd-tuntutan").textContent).toContain("1 diminta");
    expect(terbukaEl(h, "bd-tuntutan")).toBe(false);
    expect(q(h, "#bd-tuntutan .bd-tuntutandaftar")!.textContent).toContain("diminta dalam petitum");
  });
});

// ============================================================================
describe("butir 12: Bahan musyawarah majelis", () => {
  it("hakim: satu bungkus tertutup bawaan berlencana abu, memuat Peta dalil dan Penilaian pembuktian yang tetap hidup", async () => {
    const h = buka({ orang: "hakim" });
    await pilihPutusan(h);
    await sampai(() => q(h, "#bd-musyawarah"), "bungkus musyawarah");
    const b = q(h, "#bd-musyawarah") as HTMLDetailsElement;
    expect(b.open).toBe(false);
    expect(ringkasan(h, "bd-musyawarah").textContent).toBe("Bahan musyawarah majelis tidak perlu diisi · peta dalil dan penilaian pembuktian, dibuka bila perlu");
    expect(lencana(h, "bd-musyawarah")).toEqual({ kelas: "abu", teks: "tidak perlu diisi" });
    // Keduanya di DALAM bungkus, masing-masing tetap lipatan sendiri yang tertutup; tidak ada salinan di luar bungkus.
    expect(q(h, "#bd-musyawarah #bd-petadalil")).not.toBeNull();
    expect(q(h, "#bd-musyawarah #bd-penilaian")).not.toBeNull();
    expect(qq(h, "#bd-petadalil, #bd-penilaian").length).toBe(2);
    expect((q(h, "#bd-petadalil") as HTMLDetailsElement).open).toBe(false);
    // pasang() tetap dipanggil walau bungkusnya tertutup.
    expect(q(h, "#bd-petadalil")!.dataset.pdPasang).toBe("1");
    expect(q(h, "#bd-penilaian")!.dataset.pbPasang).toBe("1");
    // Urutan: sesudah Isian untuk amar.
    expect(q(h, "#bd-lanjutan")!.compareDocumentPosition(b) & h.w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Dibuka -> diingat per pengguna (ingatan lipat panel-alat.js); membuka Penilaian pembuktian membaca server dan ringkasan bungkus ikut.
    klik(h, '[data-bd2="musyawarah"]');
    expect(b.open).toBe(true);
    await sampai(() => (h.simpanan.lipatTerbuka as Record<string, boolean> | undefined)?.["blangkoDerry:bahanMusyawarah"] === true, "pilihan buka tersimpan");
    const pn = q(h, "#bd-penilaian") as HTMLDetailsElement;
    pn.open = true;
    await sampai(() => h.minta.some((m) => m.url.includes("/aleta-ecourt/penilaian-bukti")), "penilaian dibaca");
    await sampai(() => /2 dalil · 1 terbukti · 1 belum terbukti/.test(ringkasan(h, "bd-musyawarah").textContent || ""), "ringkasan bungkus diperbarui");
    expect(q(h, "#bd-penilaian .bd-pb-tabel")).not.toBeNull();
  });

  it("ingatan buka dibaca: bungkus terbuka sendiri pada halaman berikutnya; ditutup -> tersimpan false", async () => {
    const h = buka({ orang: "hakim", simpanan: { lipatTerbuka: { "blangkoDerry:bahanMusyawarah": true } } });
    await pilihPutusan(h);
    await sampai(() => (q(h, "#bd-musyawarah") as HTMLDetailsElement | null)?.open, "bungkus terbuka dari ingatan");
    klik(h, '[data-bd2="musyawarah"]');
    expect((q(h, "#bd-musyawarah") as HTMLDetailsElement).open).toBe(false);
    await sampai(() => (h.simpanan.lipatTerbuka as Record<string, boolean>)["blangkoDerry:bahanMusyawarah"] === false, "pilihan tutup tersimpan");
  });

  it("Wakil Ketua (golongan ketua -> peran hakim) dan Super Admin juga melihatnya", async () => {
    for (const orang of ["wakil", "admin"]) {
      const h = buka({ orang });
      await pilihPutusan(h);
      await sampai(() => q(h, "#bd-musyawarah #bd-petadalil"), `bungkus untuk ${orang}`);
    }
  });

  it("PP (BAS): tidak ada Bahan musyawarah majelis, Peta dalil, atau Penilaian pembuktian", async () => {
    const h = buka({ orang: "pp" });
    await pilih(h, BLANGKO_BAS);
    await sampai(() => q(h, "#bd-tjtombol"), "isian BAS tergambar");
    await tunggu(30);
    expect(q(h, "#bd-musyawarah")).toBeNull();
    expect(q(h, "#bd-petadalil")).toBeNull();
    expect(q(h, "#bd-penilaian")).toBeNull();
    expect(akar(h).textContent).not.toContain("Bahan musyawarah majelis");
  });
});

// ============================================================================
describe("butir 12: teks lain dan CSS", () => {
  it("ALETA Ai C6 menunjuk letak baru; bantuan langkah 3 memakai nama baru", () => {
    expect(baca("blangko-derry-ai-inti.js")).toContain("Buka Bahan musyawarah majelis > Penilaian pembuktian pada panel ini dulu.");
    expect(baca("blangko-derry.js")).toContain('"Isian untuk amar: isian yang tidak tertulis langsung di blangko');
    expect(baca("blangko-derry.js")).not.toContain('"Isian di dalam bagian otomatis:');
  });

  it("aturan CSS butir 12 hanya token warna, huruf >= 11,5px, tanpa animasi; tidak di ujung panel.css", () => {
    const css = baca("blangko-derry.css");
    const awal = css.indexOf("/* Butir 12 (2 Nov)");
    expect(awal).toBeGreaterThan(0);
    const blok = css.slice(awal, css.indexOf("/* 21 Okt: tuntutan dalam posita", awal));
    const aturan = blok.split("\n").filter((l) => l.startsWith("#aleta-bd-akar"));
    expect(aturan.length).toBeGreaterThanOrEqual(5);
    expect(aturan.join("\n")).toContain(".bd-musyawarah");
    for (const l of aturan) {
      expect(l, l).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      expect(l, l).not.toMatch(/animation|transition/);
      for (const m of l.matchAll(/font-size:\s*([\d.]+)px/g)) expect(Number(m[1]), l).toBeGreaterThanOrEqual(11.5);
      for (const m of l.matchAll(/var\(--([a-z0-9]+)\)/g)) expect(css.slice(0, 2000), m[1]).toContain(`--${m[1]}:`);
    }
    expect(baca("panel.css")).not.toContain("bd-musyawarah");
  });
});
