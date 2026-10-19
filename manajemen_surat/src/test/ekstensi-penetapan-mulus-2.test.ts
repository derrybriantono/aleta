// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENETAPAN MULUS 2 (19 Okt 2026) - rancangan docs/rancangan/penetapan-mulus-2.html
 * ============================================================================
 *
 * Kartu "Penetapan" UI Baru = "Penetapan dan Penunjukan Perkara" versi mulus.
 * Dijaga dengan MENJALANKAN panel-alat.js, basmassal.js, dan konten.js utuh di
 * jsdom (harness yang sama dengan ekstensi-penetapan-satu-klik):
 *
 *   - satu klik tetap memanggil alur tulis yang sama (kiriman sama persis
 *     dengan dua tekanan tombol asli di tampilan Lama);
 *   - "Ubah" majelis menghitung ulang usulan dan PP terpaut ikut berganti;
 *   - PP/JS pilihan tangan menang atas usulan;
 *   - pejabat PPP/PJS dipilih terpisah (lewat baris "Ditetapkan ...");
 *   - PHS bawaan: usulan (2 minggu), jam 09.00, Ruang Sidang 1 Dalam Gedung;
 *   - rinci dan mulus tidak tampil bersamaan;
 *   - tidak ada "Lihat rincian pemeriksaan", "Pilihan lain", maupun kotak
 *     "Pejabat yang menetapkan";
 *   - tidak ada passphrase di panel dan tidak ada yang mengirimnya;
 *   - tidak ada teks teknis; tidak ada kata "Aleta" yang dikirim ke SIPP;
 *   - tombol e-Doc per baris memakai mesin unggah blangko ABT yang sama.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () =>
  (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js")).replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "712/Pdt.G/2026/PA.Dgl";
const AKUN = "Derry Briantono";
const HARI = "2026-10-09";
/** Usulan PHS: hari sidang majelis sekurangnya 14 hari sesudah pendaftaran. */
const PHS_USUL = "2026-10-23";

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string | (() => string), batas = 8000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${typeof keterangan === "function" ? keterangan() : keterangan}`);
    await tunggu(10);
  }
}

type Jenis = "pmh" | "ppp" | "pjs" | "phs";
type Keadaan = Record<Jenis, string>;
const kosong = (): Keadaan => ({ pmh: "", ppp: "", pjs: "", phs: "" });

const MAJELIS_A = { kunci: "32-33-30", hakimId: [32, 33, 30], majelisKode: "A", anggota: [{ hakimId: 32, nama: "Fahri Saifuddin" }, { hakimId: 33, nama: "Muh. Arif" }, { hakimId: 30, nama: "Nur Aisyah" }], perkara: 3 };
const MAJELIS_C = { kunci: "26-28-31", hakimId: [26, 28, 31], majelisKode: "C", anggota: [{ hakimId: 26, nama: "Himawan Tatura Wijaya" }, { hakimId: 28, nama: "Idris" }, { hakimId: 31, nama: "Derry Briantono" }], perkara: 5 };
const MAJELIS_LUAR = { kunci: "32-28-30", hakimId: [32, 28, 30], majelisKode: "", anggota: [{ hakimId: 32, nama: "Fahri Saifuddin" }, { hakimId: 28, nama: "Idris" }, { hakimId: 30, nama: "Nur Aisyah" }], perkara: 2 };
const SRI = { id: 40, paniteraId: 40, kodeSk: "PP1", nama: "Sri Susilowati", jumlah: 12 };
const RAHMA = { id: 41, paniteraId: 41, kodeSk: "PP2", nama: "Rahmawati", jumlah: 9 };
const HASNAH: { id: number; paniteraId: number; kodeSk?: string; nama: string; jumlah: number } = { id: 42, paniteraId: 42, nama: "Hasnah", jumlah: 7 };

/** Bentuk usulan bot (usulanPenunjukan). `c` = usulan dihitung ulang untuk Majelis C. */
function usulanUntuk(keadaan: Keadaan, c: boolean) {
  const majelis = c ? MAJELIS_C : MAJELIS_A;
  const ppUsul = c ? RAHMA : SRI;
  return {
    ok: true,
    perkara: { perkaraId: 10333, nomorPerkara: NOMOR, jenisPerkaraId: 347, tanggalDaftar: HARI },
    penetapan: {
      ada: Boolean(keadaan.pmh),
      ...keadaan,
      sidangPertama: keadaan.phs ? PHS_USUL : "",
      majelisKode: keadaan.pmh ? "A" : "",
      majelisNama: keadaan.pmh ? "Fahri Saifuddin, Muh. Arif, Nur Aisyah" : "",
      paniteraText: keadaan.ppp ? "Panitera Pengganti: Sri Susilowati" : "",
      jurusitaText: keadaan.pjs ? "Jurusita: Tanty" : "",
    },
    tanggalPenetapan: keadaan.pmh || HARI,
    bentuk: { bentuk: "majelis" },
    pmh: {
      bentuk: "majelis",
      majelisKode: majelis.majelisKode,
      sebab: "beban paling ringan",
      anggota: majelis.anggota,
      hitungan: [
        { hakimId: 32, nama: "Fahri Saifuddin", jumlah: 3 },
        { hakimId: 26, nama: "Himawan Tatura Wijaya", jumlah: 5 },
      ],
      susunanTerpakai: [MAJELIS_A, MAJELIS_C, MAJELIS_LUAR],
    },
    ppp: {
      usulan: { ...ppUsul, kode: ppUsul.kodeSk },
      calon: [
        { ...ppUsul, dariSk: true },
        ...[SRI, RAHMA, HASNAH].filter((x) => x.id !== ppUsul.id),
      ],
      sebab: `panitera sidang Majelis ${majelis.majelisKode} menurut SK`,
    },
    pjs: {
      usulan: { id: 12, jurusitaId: 12, nama: "Tanty" },
      calon: [
        { id: 12, jurusitaId: 12, nama: "Tanty", jumlah: 21 },
        { id: 13, jurusitaId: 13, nama: "Rusli", jumlah: 24 },
      ],
      sebab: "giliran",
    },
    phs: {
      usulan: PHS_USUL,
      sebut: "Jumat, 23-10-2026",
      sebab: `hari sidang Majelis ${majelis.majelisKode}, sekurangnya 14 hari sesudah pendaftaran`,
      calon: [
        { tanggal: PHS_USUL, sebut: "Jumat, 23-10-2026", usulan: true, pekan: 0, jumlahSidang: 3 },
        { tanggal: "2026-10-30", sebut: "Jumat, 30-10-2026", usulan: false, pekan: 1, jumlahSidang: 1 },
        { tanggal: "2026-12-25", sebut: "Jumat, 25-12-2026", usulan: false, pekan: 9, jumlahSidang: 0, libur: "Natal" },
      ],
    },
    acuanMajelis: { dariTercatat: false, majelisKode: majelis.majelisKode },
    tercatat: { ada: false, ketuaHakimId: 0, ketuaNama: "", hakim: [] },
  };
}

/** Rencana bot - tiap langkah dua calon pejabat (Ketua/Wakil, Panitera/Plh, ketua majelis/anggota). */
function rencanaUntuk() {
  const sebut: Record<Jenis, [string, string]> = {
    pmh: ["Ketua Pengadilan", "Wakil Ketua"],
    ppp: ["Panitera", "Plh. Panitera"],
    pjs: ["Panitera", "Plh. Panitera"],
    phs: ["Ketua Majelis", "Hakim Anggota"],
  };
  return {
    langkah: (["pmh", "ppp", "pjs", "phs"] as Jenis[]).map((jenis) => ({
      jenis,
      akun: { username: `${jenis}-1`, namaLengkap: `Pejabat ${jenis.toUpperCase()} Satu`, sebutan: sebut[jenis][0] },
      calon: [
        { username: `${jenis}-1`, namaLengkap: `Pejabat ${jenis.toUpperCase()} Satu`, sebutan: sebut[jenis][0], otomatis: true },
        { username: `${jenis}-2`, namaLengkap: `Pejabat ${jenis.toUpperCase()} Dua`, sebutan: sebut[jenis][1] },
      ],
    })),
  };
}

const RUANGAN = [
  { id: 1, nama: "Ruang Sidang 1 Dalam Gedung", sifat: "dalam-gedung", dipakai: 812 },
  { id: 3, nama: "Ruang Sidang 2 Dalam Gedung", sifat: "dalam-gedung", dipakai: 120 },
  { id: 9, nama: "Sidang Keliling Sigi Biromaru", sifat: "keliling", dipakai: 40 },
];

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Kiriman = { url: string; cara: string; badan: unknown };

function buka(keadaan: Keadaan, tampilan: "lama" | "ui") {
  const kepala =
    `<table class="badge"><tr><td>Selamat Datang <font color='red'>${AKUN}</font>` +
    `<br> Anda Login Sebagai <font color='red'>Administrator</font></td></tr></table>`;
  const html =
    kepala +
    `<div id="tabs1"><table class="data-umum">` +
    `<tr><td id="first-child">Nomor Perkara</td><td colspan="2">${NOMOR}</td></tr>` +
    `<tr><td id="first-child">Jenis Perkara</td><td colspan="2">Cerai Gugat</td></tr>` +
    `</table></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${html}</div></body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const simpanan: Record<string, unknown> = {
    ujiTampilan: tampilan,
    ujiIzinkanNyata: true,
    lipatanBagian: { penunjukan: false, kerjakan: false },
  };
  const pesanLatar: any[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.205.11" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async (m: any) => {
        pesanLatar.push(m);
        if (m && m.jenis === "relaas-rtf") return { ok: true, rtfBase64: "e1xydGYxIFBNSH0=" };
        return {};
      },
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const kiriman: Kiriman[] = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    kiriman.push({ url, cara, badan: opsi && opsi.body });
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama: "SUPER ADMIN DERRY", peran: "Super Admin", kapabilitas: null } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = {
        ok: true,
        data: {
          available: true,
          pengguna: { nama: "SUPER ADMIN DERRY", peran: "Super Admin" },
          kapabilitas: null,
          konteks: {
            ok: true,
            nomorPerkara: NOMOR,
            nomorRegister: "",
            identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
            ringkasan: { dokumen: 0 },
            dokumen: [],
            selisih: [],
            nomorPihak: [],
            diperiksaPada: new Date().toISOString(),
            ambangMendesakHari: 3,
            hakim: null,
          },
        },
      };
    } else if (url.includes("/aleta-bot/penunjukan/borang")) {
      isi = { ok: true, data: { bolehMengisi: true, medan: [], borang: [], bolehJenis: {}, untukJabatan: {}, antrean: [] } };
    } else if (url.includes("/aleta-bot/penunjukan/ruangan")) {
      isi = { ok: true, data: { ruangan: RUANGAN } };
    } else if (url.includes("/aleta-bot/penunjukan/riwayat")) {
      isi = { ok: true, data: { riwayat: [] } };
    } else if (url.includes("/aleta-bot/penunjukan?")) {
      const c = url.includes(`majelis=${encodeURIComponent("26,28,31")}`);
      isi = { ok: true, data: { available: true, usulan: usulanUntuk(keadaan, c), rencana: rencanaUntuk(), bolehOtomatis: true } };
    } else if (url.includes("/aleta-bot/penunjukan/tulis") && cara === "POST") {
      const badan = JSON.parse(String(opsi?.body || "{}"));
      if (Array.isArray(badan.rantai)) {
        for (const s of badan.rantai) keadaan[s.jenis as Jenis] = HARI;
        isi = { ok: true, utuh: true, hasil: badan.rantai.map((s: { jenis: string }) => ({ jenis: s.jenis, ok: true, langkah: [{ tabel: "perkara_penetapan" }] })) };
      } else if (keadaan[badan.jenis as Jenis]) {
        status = 409;
        isi = { ok: false, alasan: `${badan.jenis}_sudah_ada` };
      } else {
        isi = { ok: true, langkah: [{ tabel: "perkara_penetapan" }], andaian: [], tanggalPenetapan: badan.tanggalPenetapan };
      }
    } else if (url.includes("/penetapan-edoc/peta-penetapan")) {
      isi = { ok: true, data: { butir: ["pmh", "ppp", "pjs", "phs"].map((j) => ({ jenis: j, aktif: true, namaBerkas: `@ ${j}.rtf`, kelompok: "Form Bantu PTSP", otomatisUnggah: j === "pmh" || j === "phs" })) } };
    } else if (url.includes("/penetapan-edoc/peta?")) {
      isi = { ok: true, data: { perkara: { perkaraId: 10333 }, jenis: [{ jenis: "PMH", tersedia: false, sudahDiunggah: false }] } };
    } else if (url.includes("/penetapan-edoc/unggah") && cara === "POST") {
      isi = { ok: true, data: { ok: true, berkas: [{ jenis: "PMH", ok: true, tandaTangan: "Pejabat PMH Satu" }] } };
    }
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      url,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => polos(isi),
      text: async () => JSON.stringify(isi ?? {}),
      clone: () => r,
    };
    return r;
  };
  const pmAsli = w.postMessage.bind(w);
  w.postMessage = (data: any, asal: string) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id } = data;
      const balas = data.jenis === "pilihan" ? { ok: true, tampak: false, pilihan: [], nilaiSekarang: "" } : { ok: true, medan: [] };
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ...balas }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  return { w, d: w.document as Document, kiriman, pesanLatar, simpanan, ctx };
}
type Halaman = ReturnType<typeof buka>;

async function papan(h: Halaman) {
  const kotak = await sampai(() => h.d.querySelector('.aleta-bagian[data-kunci="penunjukan"]') as HTMLElement | null, "bagian penunjukan");
  const isi = kotak.querySelector(":scope > .aleta-bagian-isi") as HTMLElement | null;
  if (isi && isi.style.display === "none") (kotak.querySelector(":scope > .aleta-bagian-judul") as HTMLElement).click();
  await sampai(() => kotak.querySelector(".aleta-tombol-tetapkan"), () => `tombol Tetapkan; papan: ${String(kotak.textContent || "").slice(0, 300)}`);
  await sampai(
    () => !/Memeriksa formulir/.test(String(kotak.querySelector(".aleta-tetap-kaki .aleta-tetap-sebab")?.textContent || "")),
    "kabar tombol selesai diperiksa"
  );
  return kotak;
}

const kartuDari = (h: Halaman) => h.d.querySelector(".aleta-t7-penetapan") as HTMLElement | null;
const barisJenis = (k: HTMLElement, j: Jenis) => k.querySelector(`.aleta-t7-keputusan-baris[data-jenis="${j}"]`) as HTMLElement;
const tombolSemua = (k: HTMLElement) => k.querySelector(".aleta-t7-tetapkan-semua") as HTMLButtonElement;

async function kartuSiap(h: Halaman) {
  await papan(h);
  return sampai(() => {
    const k = kartuDari(h);
    const t = k?.querySelector(".aleta-t7-tetapkan-semua") as HTMLButtonElement | null;
    return k && t && !t.hidden && !t.disabled && t.textContent === "Tetapkan semua" && k.querySelectorAll("[data-jenis]").length === 4 ? k : null;
  }, () => `kartu; isi: ${String(kartuDari(h)?.textContent || "").slice(0, 300)}`);
}

/** Menekan "Ubah" pada satu baris lalu menunggu menunya. */
async function bukaUbah(h: Halaman, j: Jenis) {
  const k = kartuDari(h)!;
  (barisJenis(k, j).querySelector(".aleta-t7-ubah") as HTMLButtonElement).click();
  return sampai(() => barisJenis(kartuDari(h)!, j)?.querySelector(".aleta-t7-pilih") as HTMLElement | null, `menu Ubah ${j}`);
}

/** Satu klik sampai tersimpan; pulang badan rantai yang dikirim. */
async function tetapkanSemua(h: Halaman) {
  const k = kartuDari(h)!;
  await sampai(() => !tombolSemua(k).disabled && tombolSemua(k).textContent === "Tetapkan semua", "tombol hidup");
  tombolSemua(k).click();
  await sampai(() => /tersimpan di SIPP/.test(String(k.querySelector(".aleta-t7-hasil")?.textContent || "")), () => `hasil "${k.querySelector(".aleta-t7-hasil")?.textContent}"`);
  const rantai = h.kiriman.filter((x) => x.url.includes("/penunjukan/tulis") && /"rantai"/.test(String(x.badan || "")));
  expect(rantai.length).toBe(1);
  return JSON.parse(String(rantai[0].badan)) as { rantai: Array<Record<string, unknown>> };
}
const langkahDari = (b: { rantai: Array<Record<string, unknown>> }, j: Jenis) => b.rantai.find((x) => x.jenis === j)!;

function ketik(w: any, el: HTMLInputElement | HTMLSelectElement, nilai: string) {
  el.value = nilai;
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
}

async function setujui(h: Halaman, wadah: Element) {
  const kartu = await sampai(() => wadah.querySelector(".aleta-a30-tanya"), "konfirmasi tampil");
  const cek = kartu.querySelector("input[type=checkbox]") as HTMLInputElement;
  cek.checked = true;
  cek.dispatchEvent(new h.w.Event("change"));
  (kartu.querySelector(".aleta-a30-tanya-ya") as HTMLButtonElement).click();
}

// ============================================================================
describe("satu klik tetap memanggil alur tulis yang sama", () => {
  it("kiriman tulis UI Baru = kiriman dua tekanan tombol asli di tampilan Lama (pemeriksaan + rantai)", async () => {
    const lama = buka(kosong(), "lama");
    const kotak = await papan(lama);
    const asli = kotak.querySelector(".aleta-tombol-tetapkan") as HTMLButtonElement;
    asli.click();
    await sampai(() => asli.textContent === "Tuliskan ke SIPP" && !asli.disabled, () => `tombol lama "${asli.textContent}"`);
    asli.click();
    await sampai(() => asli.textContent === "Penetapan selesai", () => `tombol lama "${asli.textContent}"`);

    const baru = buka(kosong(), "ui");
    await kartuSiap(baru);
    await tetapkanSemua(baru);
    const tulis = (h: Halaman) => h.kiriman.filter((x) => x.url.includes("/penunjukan/tulis")).map((x) => JSON.parse(String(x.badan)));
    expect(tulis(baru)).toEqual(tulis(lama));
    expect(tulis(baru).length).toBe(5);
  });
});

describe("Ubah di tiap baris: menu pilihan langsung", () => {
  it("label rounded Ketua di kiri judul kartu; Ubah semua pilihan di bawah Tetapkan semua", async () => {
    const h = buka(kosong(), "ui");
    const k = await kartuSiap(h);
    const kepala = k.querySelector(".aleta-t7-penetapan-kepala")!;
    // Kartu dijadikan lipatan seragam UI Baru (panah di paling kiri); label peran
    // tepat sesudahnya, di kiri judul - sama dengan kepala bagian lain.
    const tag = Array.from(kepala.querySelectorAll(".aleta-lipat-peran"));
    expect(tag.length, kepala.outerHTML).toBe(1);
    expect(tag[0].textContent).toBe("Ketua");
    const judul = kepala.querySelector(".aleta-t7-penetapan-judul")!;
    expect(judul.textContent).toBe("Penetapan");
    expect(tag[0].nextElementSibling, kepala.outerHTML).toBe(judul);
    expect(tombolSemua(k).nextElementSibling!.textContent).toBe("Ubah semua pilihan");
  });

  it("Ubah majelis: majelis menurut SK dan tanpa kode, berbeban; memilih Majelis C menghitung ulang dan PP terpaut ikut berganti", async () => {
    const h = buka(kosong(), "ui");
    await kartuSiap(h);
    const menu = await bukaUbah(h, "pmh");
    const judul = Array.from(menu.querySelectorAll(".aleta-t7-pilih-judul")).map((x) => x.textContent);
    expect(judul).toEqual(["Menurut SK", "Tanpa kode"]);
    expect(menu.querySelector('[data-t7-majelis="32-33-30"]')!.getAttribute("aria-checked")).toBe("true");
    expect(menu.querySelector('[data-t7-majelis="26-28-31"]')!.textContent).toContain("beban 5");
    expect(menu.querySelector('[data-t7-majelis="32-28-30"]')!.textContent).toContain("di luar SK");
    expect(barisJenis(kartuDari(h)!, "ppp").textContent).toContain("Sri Susilowati");
    (menu.querySelector('[data-t7-majelis="26-28-31"]') as HTMLButtonElement).click();
    await sampai(() => h.kiriman.some((x) => x.url.includes("majelis=26%2C28%2C31")), "usulan dihitung ulang untuk Majelis C");
    await sampai(() => /Rahmawati/.test(String(barisJenis(kartuDari(h)!, "ppp")?.textContent || "")), () => `PP terpaut; baris ${barisJenis(kartuDari(h)!, "ppp")?.textContent}`);
    expect(barisJenis(kartuDari(h)!, "pmh").textContent).toContain("Himawan Tatura Wijaya");
    await kartuSiap(h);
    const badan = await tetapkanSemua(h);
    expect(langkahDari(badan, "pmh").hakimId).toEqual([26, 28, 31]);
    expect(langkahDari(badan, "ppp").petugasId).toBe(41);
  });

  it("PP dan JS pilihan tangan menang atas usulan (dan atas PP terpaut majelis)", async () => {
    const h = buka(kosong(), "ui");
    await kartuSiap(h);
    let menu = await bukaUbah(h, "ppp");
    expect(Array.from(menu.querySelectorAll(".aleta-t7-pilih-judul")).map((x) => x.textContent)).toEqual(["Panitera sidang majelis ini", "Panitera pengganti lain"]);
    expect(menu.querySelector('[data-t7-orang="42"]')!.textContent).toContain("beban 7");
    (menu.querySelector('[data-t7-orang="42"]') as HTMLButtonElement).click();
    await sampai(() => /Hasnah/.test(String(barisJenis(kartuDari(h)!, "ppp")?.textContent || "")), "PP tangan tampil");
    menu = await bukaUbah(h, "pjs");
    (menu.querySelector('[data-t7-orang="13"]') as HTMLButtonElement).click();
    await sampai(() => /Rusli/.test(String(barisJenis(kartuDari(h)!, "pjs")?.textContent || "")), "JS tangan tampil");
    const badan = await tetapkanSemua(h);
    expect(langkahDari(badan, "ppp").petugasId).toBe(42);
    expect(langkahDari(badan, "pjs").petugasId).toBe(13);
  });

  it("PHS bawaan: usulan 2 minggu, jam 09.00, Ruang Sidang 1 Dalam Gedung; hari libur tidak dapat dipilih; jam dan ruang pilihan ikut dikirim", async () => {
    const h = buka(kosong(), "ui");
    const k = await kartuSiap(h);
    await sampai(() => /Jumat, 23-10-2026 · 09\.00 · Ruang Sidang 1 Dalam Gedung/.test(String(barisJenis(kartuDari(h)!, "phs")?.textContent || "")), () => `baris PHS ${barisJenis(k, "phs")?.textContent}`);
    const menu = await bukaUbah(h, "phs");
    expect((menu.querySelector(".aleta-t7-phs-jam") as HTMLInputElement).value).toBe("09:00");
    await sampai(() => {
      const r = barisJenis(kartuDari(h)!, "phs").querySelector(".aleta-t7-phs-ruang") as HTMLSelectElement | null;
      return r && r.options.length === 3 && r.selectedOptions[0].textContent === "Ruang Sidang 1 Dalam Gedung";
    }, "ruang bawaan");
    expect(menu.querySelector(`[data-t7-tanggal="${PHS_USUL}"]`)!.getAttribute("aria-checked")).toBe("true");
    expect((menu.querySelector('[data-t7-tanggal="2026-12-25"]') as HTMLButtonElement).disabled).toBe(true);

    // Tanpa diubah: tidak ada jam/ruang yang dikirim - mesin tulis memakai bawaannya.
    const h0 = buka(kosong(), "ui");
    await kartuSiap(h0);
    const b0 = await tetapkanSemua(h0);
    expect(langkahDari(b0, "phs")).toMatchObject({ tanggalSidang: PHS_USUL });
    expect(langkahDari(b0, "phs").jamSidang).toBeUndefined();
    expect(langkahDari(b0, "phs").ruanganId).toBeUndefined();

    // Diubah: tanggal, jam, ruang.
    (barisJenis(kartuDari(h)!, "phs").querySelector('[data-t7-tanggal="2026-10-30"]') as HTMLButtonElement).click();
    await sampai(() => /Jumat, 30-10-2026/.test(String(barisJenis(kartuDari(h)!, "phs")?.textContent || "")), "tanggal berganti");
    ketik(h.w, barisJenis(kartuDari(h)!, "phs").querySelector(".aleta-t7-phs-jam") as HTMLInputElement, "10:30");
    await sampai(() => /10\.30/.test(String(barisJenis(kartuDari(h)!, "phs")?.querySelector(".aleta-t7-keputusan-nilai")?.textContent || "")), "jam berganti");
    ketik(h.w, barisJenis(kartuDari(h)!, "phs").querySelector(".aleta-t7-phs-ruang") as HTMLSelectElement, "3");
    await sampai(() => /Ruang Sidang 2 Dalam Gedung/.test(String(barisJenis(kartuDari(h)!, "phs")?.querySelector(".aleta-t7-keputusan-nilai")?.textContent || "")), "ruang berganti");
    const b = await tetapkanSemua(h);
    expect(langkahDari(b, "phs")).toMatchObject({ tanggalSidang: "2026-10-30", jamSidang: "10:30", ruanganId: 3 });
  });
});

describe("pejabat penetap lewat baris 'Ditetapkan ...'", () => {
  it("PPP dan PJS dipilih terpisah, dapat berbeda dari PMH; baris ikut berubah; yang dikirim = yang dipilih", async () => {
    const h = buka(kosong(), "ui");
    await kartuSiap(h);
    const penetap = (j: Jenis) => barisJenis(kartuDari(h)!, j).querySelector("button.aleta-t7-penetap") as HTMLButtonElement;
    expect(penetap("pmh").textContent).toContain("Ditetapkan Ketua Pengadilan — Pejabat PMH Satu (akun pmh-1)");
    expect(penetap("ppp").textContent).toContain("Ditetapkan Panitera — Pejabat PPP Satu (akun ppp-1)");
    penetap("ppp").click();
    const menu = await sampai(() => barisJenis(kartuDari(h)!, "ppp").querySelector(".aleta-t7-pilih-pejabat"), "menu pejabat PPP");
    expect(menu.querySelector(".aleta-t7-pilih-judul")!.textContent).toBe("Yang menetapkan PPP");
    (menu.querySelector('[data-t7-pejabat="ppp-2"]') as HTMLButtonElement).click();
    await sampai(() => /Pejabat PPP Dua/.test(String(penetap("ppp")?.textContent || "")), "baris PPP berganti");
    expect(penetap("ppp").textContent).toContain("Plh. Panitera");
    expect(penetap("pjs").textContent).toContain("Pejabat PJS Satu");
    const badan = await tetapkanSemua(h);
    expect(badan.rantai.map((x) => [x.jenis, x.pejabatUsername])).toEqual([
      ["pmh", "pmh-1"],
      ["ppp", "ppp-2"],
      ["pjs", "pjs-1"],
      ["phs", "phs-1"],
    ]);
  });

  it("tampilan rinci: kotak 'Pejabat yang menetapkan' tidak ada; pejabat dipilih dengan mengeklik baris Ditetapkan dan tidak kembali ke pilihan mesin", async () => {
    const h = buka(kosong(), "ui");
    const k = await kartuSiap(h);
    (k.querySelector(".aleta-t7-ubah-semua") as HTMLButtonElement).click();
    const kotak = h.d.querySelector('.aleta-bagian[data-kunci="penunjukan"]') as HTMLElement;
    await sampai(() => kotak.querySelector('button.aleta-tetap-penetap[data-jenis="pjs"]'), "penetap rinci dapat diklik");
    expect(kotak.querySelector(".aleta-tetap-pejabat")).toBeNull();
    expect(kotak.textContent).not.toContain("Pejabat yang menetapkan");
    (kotak.querySelector('button.aleta-tetap-penetap[data-jenis="pjs"]') as HTMLButtonElement).click();
    (kotak.querySelector('.aleta-t7-pilih-pejabat [data-t7-pejabat="pjs-2"]') as HTMLButtonElement).click();
    await sampai(() => /Pejabat PJS Dua/.test(String(kotak.querySelector('button.aleta-tetap-penetap[data-jenis="pjs"]')?.textContent || "")), "rinci berganti");
    expect(vm.runInContext("usulanTerakhir.pejabatDipilih.pjs", h.ctx)).toBe("pjs-2");
  });
});

describe("rinci dan mulus tidak tampil bersamaan; yang dihapus benar-benar hilang", () => {
  it("Ubah semua pilihan membuka rinci (cara Manual, berbeban) dan menyembunyikan kartu; Selesai mengubah kembali ke kartu", async () => {
    const h = buka(kosong(), "ui");
    const k = await kartuSiap(h);
    const kotak = h.d.querySelector('.aleta-bagian[data-kunci="penunjukan"]') as HTMLElement;
    expect(kotak.hasAttribute("data-t7-tinjau")).toBe(false);
    expect(k.hidden).toBe(false);
    (k.querySelector(".aleta-t7-ubah-semua") as HTMLButtonElement).click();
    expect(kotak.hasAttribute("data-t7-tinjau")).toBe(true);
    expect(k.hidden).toBe(true);
    await sampai(() => kotak.querySelector(".aleta-saklar-aktif")?.textContent === "Manual", "cara Manual");
    // Beban tiap pilihan tampil di dropdown rinci.
    await sampai(() => /beban 12/.test(String(kotak.textContent || "")) && /beban 21/.test(String(kotak.textContent || "")), "beban PP dan JS");
    await tunggu(120);
    expect(k.hidden).toBe(true);
    (kotak.querySelector(".aleta-t7-selesai-ubah") as HTMLButtonElement).click();
    await sampai(() => !kartuDari(h)!.hidden, "kartu kembali");
    expect(kotak.hasAttribute("data-t7-tinjau")).toBe(false);
  });

  it("tidak ada 'Lihat rincian pemeriksaan', 'Pilihan lain', bagian 'Pejabat yang menetapkan', maupun 'Upload edoc penetapan' lama", async () => {
    const h = buka(kosong(), "ui");
    const k = await kartuSiap(h);
    (k.querySelector(".aleta-t7-ubah-semua") as HTMLButtonElement).click();
    await tunggu(150);
    const panel = h.d.getElementById("aleta-panel-sipp")!;
    const teks = String(panel.textContent || "");
    expect(teks).not.toContain("Lihat rincian pemeriksaan");
    expect(teks).not.toContain("Pilihan lain");
    expect(teks).not.toContain("Pejabat yang menetapkan");
    expect(teks).not.toContain("Upload edoc penetapan (PMH/PPP/PJS/PHS)");
    expect(panel.querySelector(".aleta-t7-lain, .aleta-tetap-pejabat, [data-kunci='s2EdocPenetapan']")).toBeNull();
    expect(panel.querySelector('[data-kunci="s2EdocPenetapanManual"]')!.textContent).toContain("Edoc penetapan (PMH/PPP/PJS/PHS) manual");
  });

  it("tampilan Lama tidak berubah: kotak 'Pejabat yang menetapkan' tetap, tanpa kartu mulus", async () => {
    const h = buka(kosong(), "lama");
    const kotak = await papan(h);
    expect(kotak.textContent).toContain("Pejabat yang menetapkan");
    expect(kotak.querySelector("button.aleta-tetap-penetap")).toBeNull();
    expect(kartuDari(h)).toBeNull();
  });
});

describe("e-Doc per baris dan tanpa passphrase", () => {
  it("passphrase tidak ada di panel; keterangan tanda tangan bertaut ke Tanda tangan pejabat", async () => {
    const h = buka(kosong(), "ui");
    const k = await kartuSiap(h);
    const panel = h.d.getElementById("aleta-panel-sipp")!;
    expect(panel.querySelector('input[type="password"]')).toBeNull();
    expect(panel.textContent).not.toMatch(/passphrase/i);
    const ket = k.querySelector(".aleta-t7-ttd-ket")!;
    expect(ket.textContent).toBe("Tanda tangan memakai gambar tanda tangan pejabat yang disahkan — atur di Tanda tangan pejabat");
    expect((ket.querySelector("a") as HTMLAnchorElement).href).toBe(`${ASAL}/aleta/admin/aleta-ecourt#ttd`);
  });

  it("e-Doc mati sebelum penetapan tercatat; sesudah tercatat: konfirmasi, cetak blangko ABT, unggah - tanpa passphrase", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, "ui");
    await papan(h);
    const k = await sampai(() => {
      const x = kartuDari(h);
      return x && x.querySelectorAll("[data-jenis]").length === 4 ? x : null;
    }, "kartu");
    const edoc = (j: Jenis) => barisJenis(kartuDari(h)!, j).querySelector(".aleta-t7-edoc") as HTMLButtonElement;
    expect(edoc("ppp").disabled).toBe(true);
    expect(edoc("pmh").disabled).toBe(false);
    // e-Doc di samping "Ubah" (baris yang belum tercatat punya keduanya).
    expect(Array.from(barisJenis(k, "ppp").querySelector(".aleta-t7-baris-aksi")!.children).map((x) => x.textContent)).toEqual(["Ubah", "e-Doc"]);
    edoc("pmh").click();
    const wadah = await sampai(() => barisJenis(kartuDari(h)!, "pmh").querySelector(".aleta-t7-edoc-wadah"), "wadah e-Doc");
    await setujui(h, wadah);
    const kirim = await sampai(() => h.kiriman.find((x) => x.url.includes("/penetapan-edoc/unggah") && x.cara === "POST"), "POST unggah");
    const badan = JSON.parse(String(kirim.badan));
    expect(badan.abt).toEqual([{ jenis: "pmh", isiBase64: "e1xydGYxIFBNSH0=", berkas: "@ pmh.rtf" }]);
    expect(badan.otomatis).toBe(false);
    expect(JSON.stringify(badan)).not.toMatch(/passphrase/i);
    expect(h.pesanLatar.some((m) => m.jenis === "relaas-rtf" && m.berkas === "@ pmh.rtf")).toBe(true);
    await sampai(() => /PMH: terunggah/.test(String(barisJenis(kartuDari(h)!, "pmh")?.textContent || "")), "hasil disebut");
  });

  it("bagian e-Doc manual: FormData per penetapan tanpa passphrase", async () => {
    const h = buka(kosong(), "ui");
    await kartuSiap(h);
    const kotak = h.d.querySelector('[data-kunci="s2EdocPenetapanManual"]') as HTMLElement;
    const judul = kotak.querySelector(".aleta-bagian-judul") as HTMLElement;
    if ((kotak.querySelector(":scope > .aleta-bagian-isi") as HTMLElement).style.display === "none") judul.click();
    const slot = kotak.querySelector('[data-s2-slot="PHS"] input[type=file]') as HTMLInputElement;
    Object.defineProperty(slot, "files", { value: [new h.w.File(["%PDF-1.7 phs"], "PHS 712.pdf", { type: "application/pdf" })], configurable: true });
    slot.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    const tombol = kotak.querySelector('[data-s2-edoc="manual"]') as HTMLButtonElement;
    await sampai(() => !tombol.disabled, "tombol manual hidup tanpa passphrase");
    tombol.click();
    await setujui(h, kotak);
    const kirim = await sampai(() => h.kiriman.find((x) => x.url.includes("/penetapan-edoc/unggah") && x.cara === "POST"), "POST manual");
    const fd = kirim.badan as FormData;
    expect(fd.get("sumber")).toBe("manual");
    expect(fd.getAll("jenis")).toEqual(["PHS"]);
    expect(fd.has("passphrase")).toBe(false);
  });
});

describe("tampilan bersih dan aman", () => {
  it("tidak ada teks teknis di kartu, termasuk menu yang terbuka", async () => {
    const h = buka(kosong(), "ui");
    await kartuSiap(h);
    const periksa = () => expect(String(kartuDari(h)!.textContent || "")).not.toMatch(/kering|rantai|transaksi|perkaraId|undefined|null|NaN|\[object|_sudah_ada|[a-z]+_[a-z]+_[a-z]+|susunanTerpakai|pilihanManual/);
    periksa();
    for (const j of ["pmh", "ppp", "pjs", "phs"] as Jenis[]) {
      await bukaUbah(h, j);
      periksa();
    }
    (barisJenis(kartuDari(h)!, "pmh").querySelector("button.aleta-t7-penetap") as HTMLButtonElement).click();
    await sampai(() => barisJenis(kartuDari(h)!, "pmh").querySelector(".aleta-t7-pilih-pejabat"), "menu pejabat");
    periksa();
  });

  it("tidak ada kata 'Aleta' dalam isian yang dikirim untuk ditulis ke SIPP - juga sesudah pilihan tangan", async () => {
    const h = buka(kosong(), "ui");
    await kartuSiap(h);
    const menu = await bukaUbah(h, "ppp");
    (menu.querySelector('[data-t7-orang="42"]') as HTMLButtonElement).click();
    await sampai(() => /Hasnah/.test(String(barisJenis(kartuDari(h)!, "ppp")?.textContent || "")), "PP tangan");
    await tetapkanSemua(h);
    const tulis = h.kiriman.filter((x) => x.cara === "POST");
    expect(tulis.every((x) => x.url.includes("/aleta/api/"))).toBe(true);
    const nilai: string[] = [];
    const kumpul = (x: unknown) => {
      if (typeof x === "string") nilai.push(x);
      else if (Array.isArray(x)) x.forEach(kumpul);
      else if (x && typeof x === "object") Object.values(x).forEach(kumpul);
    };
    for (const x of tulis.filter((t) => t.url.includes("/penunjukan/tulis"))) kumpul(JSON.parse(String(x.badan)));
    expect(nilai.length).toBeGreaterThan(0);
    expect(nilai.filter((v) => /aleta/i.test(v))).toEqual([]);
  });
});
