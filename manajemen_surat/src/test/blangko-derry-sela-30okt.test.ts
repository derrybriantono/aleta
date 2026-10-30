// @vitest-environment node
/**
 * ============================================================================
 * 30 OKT 2026 - BLANGKO ABT BY DERRY: TAB "PUTUSAN SELA"
 * ============================================================================
 *
 * Permintaan: sita tetap di folder "97 Sita", tetapi di jendela "Pilih blangko" ada tab baru "Putusan sela" di samping "Putusan" yang
 * mengumpulkan SEMUA putusan sela (menu umum Putusan Sela, menu Sita, dan butir "[Sela]" di menu putusan per jenis perkara), dikelompokkan
 * per pokok/status sela dan per jenis perkara. blangko-derry-isian.js dijalankan SUNGGUHAN di jsdom dengan portal dan ABT ditiru di fetch.
 * Yang dijaga:
 *   A  tab "Putusan sela" tepat sesudah "Putusan", hanya bila menu memuat kelompok putusan sela; tanpa itu tab sama seperti dulu;
 *   B  isi tab: kelompok per pokok sela (eksepsi kewenangan, eksepsi lain, provisi, sumpah, pemeriksaan setempat, sita, mediasi, ...) lalu
 *      butir sela per jenis perkara; status (dikabulkan, ditolak, ...) di keterangan kelompok; "Keselamatan" bukan putusan sela;
 *   C  membuka butir memakai token kelompok ASLINYA; berkas tidak digandakan; PP (tanpa putusan) tidak melihat tab ini;
 *   D  aturan murni kumpulkanSela; label tanpa nama berkas, kurung siku, atau angka empat digit telanjang.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-30";
const NOMOR = "308/Pdt.G/2026/PA.Dgl";
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
// Bahan: nama berkas persis seperti paket sela-ps-30okt dan folder Derry yang ada
// ----------------------------------------------------------------------------
const SITA_1 = "[01] [Kabul] Putusan Sela - Sita Dikabulkan";
const SITA_2 = "[02] [Tolak] Putusan Sela - Sita Ditolak";
const S01 = "[01] [Sela Tolak] Eksepsi Kewenangan Absolut Ditolak - Pemeriksaan Dilanjutkan";
const S02 = "[02] [NO] Eksepsi Kewenangan Absolut Dikabulkan - Pengadilan Agama Tidak Berwenang (Putusan Akhir)";
const S05 = "[05] [Sela Kabul] Tuntutan Provisi Dikabulkan";
const S06 = "[06] [Sela Tolak] Tuntutan Provisi Ditolak";
const S13 = "[13] [Sela] Sumpah Pelengkap (Suppletoir) - Gugatan";
const S15 = "[15] [Sela] Pemeriksaan Setempat - Perintah Pemeriksaan di Lokasi Objek";
const S16 = "[16] [NO] Eksepsi Gugatan Kabur (Obscuur Libel) Dikabulkan - Gugatan Tidak Dapat Diterima (Putusan Akhir)";
const S17 = "[17] [Sisipan] Eksepsi Gugatan Kabur (Obscuur Libel) Ditolak - Bagian Dalam Eksepsi untuk Putusan Akhir";
const S26 = "[26] [Sela] Gugatan Rekonvensi Tidak Dapat Diterima - Pemeriksaan Konvensi Dilanjutkan";
const S27 = "[27] [Sela Kabul] Penggabungan Perkara Dikabulkan";
const S36 = "[36] [Sela Kabul] Pemisahan Perkara (Splitsing) Dikabulkan";
const S32 = "[32] [Penetapan] Tergugat Tidak Beriktikad Baik dalam Mediasi - Biaya Mediasi (PERMA 1 2016 Pasal 23)";
const HB_1 = "[01] [Kabul] HB - Kontradiktoir";
const HB_98E = "[98e] [Sela] HB - Eksepsi Kewenangan Absolut Ditolak";
const HA_SELAMAT = "[01d] [Kabul] Hak Asuh - Kontradiktoir - Pemegang Hadhanah Tidak Menjamin Keselamatan Anak";
const BAS_SELA = "BAS SELA [1] Sidang Insidentil - Pemeriksaan Eksepsi, Provisi atau Intervensi, Tunda Putusan Sela";
const BAS_HB = "BAS ALUR 30 HB - Sidang 1 - P & T Hadir - Mediasi";
const MENU_SELA = "Putusan Sela (Eksepsi, Provisi, Intervensi, Sumpah, Pemeriksaan Setempat, Mediasi, Rekonvensi, Penggabungan)";

type Kel = Record<string, { id: string; a: string; berkas: string[] }>;
const KELOMPOK_PENUH: Kel = {
  "Harta Bersama - Putusan": { id: "D1", a: "A1", berkas: [HB_1, HB_98E] },
  "Hak Asuh Anak - Putusan": { id: "D2", a: "A2", berkas: [HA_SELAMAT] },
  "Putusan Sela & Penetapan Sita": { id: "D3", a: "A3", berkas: [SITA_1, SITA_2] },
  [MENU_SELA]: { id: "D4", a: "A4", berkas: [S01, S02, S05, S06, S13, S15, S16, S17, S26, S27, S32, S36] },
  "Putusan Sela - BAS": { id: "D5", a: "A5", berkas: [BAS_SELA] },
  "Harta Bersama - BAS": { id: "D6", a: "A6", berkas: [BAS_HB] },
};
const KELOMPOK_LAMA: Kel = {
  "Harta Bersama - Putusan": KELOMPOK_PENUH["Harta Bersama - Putusan"],
  "Harta Bersama - BAS": KELOMPOK_PENUH["Harta Bersama - BAS"],
};

const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([D("0001", "No Perkara", "data_sipp"), D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."), D("0033", "Tgl Sidang", "multi_sidang")]);
const PENANDA = ["0001", "0046", "0033"];

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const PK = () => ({
  nomorPerkara: NOMOR, perkaraId: "9806", jenisPerkara: "Harta Bersama", alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim", "pp", "js"], pihak: { penggugat: ["Penggugat Uji"], tergugat: ["Tergugat Uji"] },
  sidang: [SI("2026-10-01", "Mediasi", "", { urutan: 1, hadir: 1 }), SI(HARI_INI, "Jawaban dan eksepsi", "", { urutan: 2, hadir: 1 })],
});
type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
};
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");

type Minta = { url: string; cara: string; badan: string };
type Halaman = { dom: JSDOM; w: any; minta: Minta[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; kelompok?: Kel } = {}): Halaman {
  const KELOMPOK = p.kelompok ?? KELOMPOK_PENUH;
  const MENU =
    `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel">` +
    Object.entries(KELOMPOK).map(([nama, k]) => `<a href="${BERANDA}?a=${k.id}&c=" title="(${k.berkas.length} Blangko)">${nama}</a>`).join("") +
    `</div>`;
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Panitera</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.12" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_p: unknown, cb?: (h: unknown) => void) => cb && cb({ ok: true, id: 1 }), lastError: undefined },
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
  const orang = ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const badanMinta = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan: badanMinta });
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: false, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: null, perkara: polos([PK()]) } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [] } } });
    if (url.includes("/aleta-ecourt/sidang?dari=")) return json({ ok: false }, 404);
    if (url.includes("/aleta-ecourt/sidang/skors?")) return json({ ok: true, data: { available: true, ok: true, riwayat: [], kalimatBas: "" } });
    if (url.includes("/aleta-ecourt/blangko-derry/set-saksi")) return json({ ok: true, data: { ada: false } });
    if (url.includes("/aleta-ecourt/blangko-derry?hak=1")) return json({ ok: true, data: { saklar: { hakimBas: false, ppPutusan: false }, folder: [] } });
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [] } });
      const s = susunIsian(PENANDA, KATALOG, { P: "Penggugat", T: "Tergugat" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      const nilai: Record<string, unknown> = {};
      for (const k of kode) nilai[k] = statusNilaiLayar(k === "0001" ? { status: "terisi", teks: NOMOR, nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" }, kodeTanyaJawab(s).has(k));
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${q.get("berkas")}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") ? nilai : undefined, nilaiAda: Boolean(q.get("perkaraId")), nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/usulan")) return json({ ok: true, data: { available: true, sipp: { ok: true, usulan: [], jumlahKuasa: 0, prodeo: false }, saksi: { usulan: [], huruf: [] } } });
    if (url.includes("/aleta-ecourt/isi-gugatan")) return json({ ok: true, data: { usulan: [], tanyaJawab: [], kalimat: [], kontak: null } });
    if (url.includes("/aleta-ecourt/kuasa-gugatan")) return json({ ok: true, data: { usulan: [], ada: false } });
    if (url.includes("/aleta-ecourt/ktp-pihak")) return json({ ok: true, data: { pihak: [] } });
    if (url.includes("/aleta-ecourt/tanda-tangan")) return json({ ok: false, alasan: "tidak berwenang" }, 403);
    if (url === BERANDA) return html(`<div id="navbar">${MENU}</div>`);
    for (const [nama, k] of Object.entries(KELOMPOK)) {
      if (url.startsWith(`${BERANDA}?a=${k.id}`)) return html(HAL_KELOMPOK(nama, k.berkas.map((n, i) => [n, `${k.a}${i}`, `B${k.id}${i}`] as [string, string, string])));
    }
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    if (url.startsWith(`${ABT}/edit_data?`)) return html(`<input type="hidden" name="var_type" value="data_teks"><textarea id="value"></textarea>`);
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.console.info = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  w.catatRiwayat = () => Promise.resolve();
  w.bacaRiwayat = async () => [];
  return { dom, w, minta };
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
const tab = (h: Halaman) => qq(h, "[data-jenismodal]").map((b) => b.textContent);
const namaKelompok = (h: Halaman) => qq(h, ".bd-mkiri [data-kelmodal]").map((b) => b.querySelector(".kn")!.textContent);
const butir = (h: Halaman) => qq(h, ".bd-mkanan [data-bl]").map((b) => b.getAttribute("data-bl"));

async function bukaJendela(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, `[data-pk="${NOMOR}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, "#bd-modal:not([hidden])"), "jendela");
}
/** Membuka tab Putusan sela lalu menunggu semua kelompok putusan termuat. */
async function bukaSela(h: Halaman) {
  await bukaJendela(h);
  await sampai(() => q(h, '[data-jenismodal="sela"]'), "tab Putusan sela");
  klik(h, '[data-jenismodal="sela"]');
  await sampai(() => namaKelompok(h).includes("Harta Bersama - Putusan") && namaKelompok(h).includes("Sita"), "kelompok sela lengkap");
}

// ============================================================================
describe("A. tab Putusan sela", () => {
  it("hakim: tab Putusan sela tepat sesudah Putusan", async () => {
    const h = buka();
    await bukaJendela(h);
    await sampai(() => tab(h).includes("Putusan sela"), "tab muncul sesudah menu terbaca");
    const t = tab(h);
    expect(t.indexOf("Putusan sela")).toBe(t.indexOf("Putusan") + 1);
    // Tab Putusan tetap terpilih saat jendela dibuka; tab Putusan sela baru terpilih bila diklik.
    expect(q(h, '[data-jenismodal="put"]')!.getAttribute("aria-selected")).toBe("true");
    expect(q(h, '[data-jenismodal="sela"]')!.getAttribute("aria-selected")).toBe("false");
  });

  it("menu tanpa kelompok putusan sela: tab sama seperti dulu", async () => {
    const h = buka({ kelompok: KELOMPOK_LAMA });
    await bukaJendela(h);
    await sampai(() => namaKelompok(h).includes("Harta Bersama - Putusan"), "menu terbaca");
    expect(tab(h)).toEqual(["Putusan"]);
  });

  it("panitera pengganti (tanpa putusan): tidak ada tab Putusan sela", async () => {
    const h = buka({ orang: "pp" });
    await bukaJendela(h);
    await sampai(() => namaKelompok(h).length > 0, "menu terbaca");
    expect(tab(h)).not.toContain("Putusan sela");
  });
});

describe("B. isi tab: per pokok sela lalu per jenis perkara", () => {
  it("kelompok berurutan, sita ikut dari menu Sita, butir [Sela] jenis perkara ikut, Keselamatan tidak", async () => {
    const h = buka();
    await bukaSela(h);
    const kel = namaKelompok(h);
    expect(q(h, '[data-jenismodal="sela"]')!.getAttribute("aria-selected")).toBe("true");
    // Harta Bersama = jenis perkara terpilih: naik ke atas.
    expect(kel[0]).toBe("Harta Bersama - Putusan");
    expect(kel.slice(1)).toEqual([
      "Eksepsi kewenangan mengadili",
      "Eksepsi lain",
      "Tuntutan provisi",
      "Sumpah",
      "Pemeriksaan setempat",
      "Sita",
      "Tidak beriktikad baik dalam mediasi",
      "Gugatan rekonvensi",
      "Penggabungan dan pemisahan perkara",
    ]);
    expect(kel).not.toContain("Hak Asuh Anak - Putusan");
    // Kelompok jenis perkara hanya memuat butir sela-nya.
    klik(h, '[data-kelmodal="sela:k:Harta Bersama - Putusan"]');
    expect(butir(h)).toEqual([HB_98E]);
    klik(h, '[data-kelmodal="sela:sita"]');
    expect(butir(h)).toEqual([SITA_1, SITA_2]);
  });

  it("status di keterangan kelompok dan urutan butir: dikabulkan, ditolak, tidak dapat diterima, bagian putusan akhir", async () => {
    const h = buka();
    await bukaSela(h);
    const ket = Object.fromEntries(qq(h, ".bd-mkiri [data-kelmodal]").map((b) => [b.querySelector(".kn")!.textContent, b.querySelector(".ks")?.textContent || ""]));
    expect(ket["Eksepsi kewenangan mengadili"]).toBe("ditolak, perkara tidak dapat diterima");
    expect(ket["Eksepsi lain"]).toBe("perkara tidak dapat diterima, bagian putusan akhir");
    expect(ket["Tuntutan provisi"]).toBe("dikabulkan, ditolak");
    expect(ket["Tidak beriktikad baik dalam mediasi"]).toBe("penetapan");
    klik(h, '[data-kelmodal="sela:provisi"]');
    expect(butir(h)).toEqual([S05, S06]);
    klik(h, '[data-kelmodal="sela:eksepsi"]');
    expect(butir(h)).toEqual([S16, S17]);
    // Label tampilan: tanpa .rtf, tanpa kurung siku, tanpa angka empat digit telanjang.
    for (const t of [...namaKelompok(h), ...Object.values(ket)]) {
      expect(t).not.toMatch(/\.rtf|[[\]]/i);
      expect(t).not.toMatch(/(^|[^\d])\d{4}([^\d]|$)/);
    }
  });

  it("kotak cari di tab Putusan sela hanya mencari di antara putusan sela", async () => {
    const h = buka();
    await bukaSela(h);
    const cari = q(h, "#bd-caribl") as HTMLInputElement;
    cari.value = "kabul";
    cari.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => qq(h, "#bd-modal h5").length > 0, "hasil cari");
    expect(butir(h)).not.toContain(HB_1);
    expect(butir(h)).not.toContain(HA_SELAMAT);
    expect(butir(h)).toEqual(expect.arrayContaining([SITA_1, S05, S27]));
  });
});

describe("C. membuka butir lewat kelompok aslinya", () => {
  it("butir sita dibuka dengan token menu Sita; butir HB dengan token menu Harta Bersama", async () => {
    const h = buka();
    await bukaSela(h);
    klik(h, '[data-kelmodal="sela:sita"]');
    expect(q(h, `[data-bl="${SITA_2}"]`)!.getAttribute("data-kel")).toBe("Putusan Sela & Penetapan Sita");
    klik(h, `[data-bl="${SITA_2}"]`);
    await sampai(() => h.minta.filter((m) => /main\/cari$/.test(m.url) && m.cara === "POST").length >= 1, "main/cari");
    const b = h.minta.filter((m) => /main\/cari$/.test(m.url) && m.cara === "POST")[0].badan;
    expect(b).toContain("a=A31");
    expect(b).toContain("b=BD31");
  });
});

describe("D. aturan murni", () => {
  it("kumpulkanSela: pokok sela, status, jenis perkara; kelompok yang tidak boleh dan BAS tidak ikut", () => {
    const h = buka();
    const m = h.w.aletaBlangkoDerryIsian.murni;
    const B = (n: string) => ({ berkas: n, a: "a", b: "b" });
    const g = m.kumpulkanSela(
      [
        { nama: MENU_SELA, jenis: "put", berkas: [S13, S01, S02].map(B) },
        { nama: "Putusan Sela - BAS", jenis: "bas", berkas: [B(BAS_SELA)] },
        { nama: "Harta Bersama - Putusan", jenis: "put", berkas: [HB_1, HB_98E].map(B) },
        { nama: "Kewarisan - Putusan", jenis: "put", berkas: null },
        { nama: "Rahasia - Putusan", jenis: "put", berkas: [B("[98e] [Sela] Rahasia")] },
      ],
      (k: { nama: string }) => k.nama !== "Rahasia - Putusan",
      (k: { nama: string }) => `Judul ${k.nama}`,
    );
    expect(g.memuat).toBe(true);
    expect(g.kelompok.map((x: { id: string }) => x.id)).toEqual(["sela:kewenangan", "sela:sumpah", "sela:k:Harta Bersama - Putusan"]);
    expect(g.kelompok[0].berkas.map((x: { berkas: string }) => x.berkas)).toEqual([S01, S02]);
    expect(g.kelompok[2]).toMatchObject({ nama: "Judul Harta Bersama - Putusan", asal: "Harta Bersama - Putusan", sub: "ditolak" });
    expect(m.adalahBlangkoSela(HA_SELAMAT)).toBe(false);
    expect(m.adalahBlangkoSela(HB_98E)).toBe(true);
    expect(m.adalahBlangkoSela(SITA_1)).toBe(true);
    expect(m.statusSela(S16).nama).toBe("perkara tidak dapat diterima");
    expect(m.statusSela(S32).nama).toBe("penetapan");
  });
});
