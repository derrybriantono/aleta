// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENETAPAN SATU KLIK (18 Okt 2026) - kartu "Penetapan" UI Baru
 * ============================================================================
 *
 * "Tetapkan semua" menekan tombol Tetapkan asli dua kali seperti alur lama:
 * pemeriksaan dulu, penulisan hanya bila lulus. Dijaga dengan MENJALANKAN
 * panel-alat.js, basmassal.js, dan konten.js utuh di jsdom (harness yang sama
 * dengan ekstensi-u1-papan-penetapan-tercatat):
 *
 *   - satu klik = urutan kiriman yang SAMA dengan dua tekanan alur lama;
 *   - langkah yang sudah ada di SIPP dilewati;
 *   - gagal di tengah dilaporkan, langkah yang bergantung ditahan, tidak ada
 *     yang ditulis;
 *   - tidak ada teks teknis di kartu;
 *   - tidak ada kata "Aleta" yang dikirim untuk ditulis ke SIPP;
 *   - PHS pada hari libur menahan tombolnya.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () =>
  (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js")).replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "653/Pdt.G/2026/PA.Dgl";
const AKUN = "Derry Briantono";
const HARI = "2026-10-09";

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

/** Bentuk usulan bot (usulanPenunjukan) - PMH tercatat seperti perkara 653 di SIPP satker. */
function usulanUntuk(keadaan: Keadaan, tanggalPhs = "2026-10-21") {
  const adaPmh = Boolean(keadaan.pmh);
  return {
    ok: true,
    perkara: { perkaraId: 10222, nomorPerkara: NOMOR, jenisPerkaraId: 347, tanggalDaftar: HARI },
    penetapan: {
      ada: adaPmh,
      ...keadaan,
      sidangPertama: keadaan.phs ? "2026-10-21" : "",
      majelisKode: adaPmh ? "C1|C2|C3" : "",
      majelisNama: adaPmh ? "Himawan Tatura Wijaya, Idris, Derry Briantono" : "",
      paniteraText: keadaan.ppp ? "Panitera Pengganti: Sri Susilowati" : "",
      jurusitaText: keadaan.pjs ? "Jurusita: Tanty" : "",
    },
    tanggalPenetapan: keadaan.pmh || HARI,
    bentuk: { bentuk: "majelis" },
    // Usulan mesin SENGAJA majelis lain (A) - seperti usulan yang tidak
    // tahu bahwa PMH sudah ditetapkan tangan atas majelis C.
    pmh: {
      bentuk: "majelis",
      majelisKode: "A",
      sebab: "beban paling ringan",
      anggota: [
        { hakimId: 32, nama: "Fahri Saifuddin" },
        { hakimId: 33, nama: "Wakil Ketua" },
        { hakimId: 30, nama: "Hakim Lain" },
      ],
      hitungan: [
        { hakimId: 32, nama: "Fahri Saifuddin", jumlah: 3 },
        { hakimId: 26, nama: "Himawan Tatura Wijaya", jumlah: 5 },
      ],
      susunanTerpakai: [
        { kunci: "32-33-30", hakimId: [32, 33, 30], majelisKode: "A", anggota: [{ nama: "Fahri Saifuddin" }, { nama: "Wakil Ketua" }, { nama: "Hakim Lain" }], perkara: 3 },
        { kunci: "26-28-31", hakimId: [26, 28, 31], majelisKode: "C", anggota: [{ nama: "Himawan Tatura Wijaya" }, { nama: "Idris" }, { nama: "Derry Briantono" }], perkara: 5 },
      ],
    },
    ppp: { usulan: { id: 30, paniteraId: 30, kode: "PP3", nama: "Sri Susilowati" }, calon: [], sebab: "panitera sidang Majelis C menurut SK" },
    pjs: { usulan: { id: 12, jurusitaId: 12, nama: "Tanty" }, calon: [], sebab: "giliran" },
    phs: { usulan: tanggalPhs, sebut: tanggalPhs, calon: [], sebab: "hari sidang Majelis C" },
    acuanMajelis: { dariTercatat: adaPmh, majelisKode: adaPmh ? "C" : "A" },
    tercatat: { ada: adaPmh, ketuaHakimId: adaPmh ? 26 : 0, ketuaNama: adaPmh ? "Himawan Tatura Wijaya" : "", hakim: [] },
  };
}

/** Rencana bot - PMH dan PPP punya calon pejabat lebih dari satu (bentuk rencanaPenetapan). */
function rencanaUntuk() {
  const calon = (jenis: string) => [
    { username: `${jenis}-1`, namaLengkap: `Pejabat ${jenis.toUpperCase()} Satu`, sebutan: "Ketua", otomatis: true },
    { username: `${jenis}-2`, namaLengkap: `Pejabat ${jenis.toUpperCase()} Dua`, sebutan: "Wakil" },
  ];
  return {
    langkah: (["pmh", "ppp", "pjs", "phs"] as Jenis[]).map((jenis) => ({
      jenis,
      akun: { username: `${jenis}-1`, namaLengkap: `Pejabat ${jenis.toUpperCase()} Satu` },
      calon: jenis === "phs" ? [] : calon(jenis),
    })),
  };
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Tulis = { jenis: Jenis; kering: boolean };

type Opsi = { gagalKering?: Jenis; tanggalPhs?: string };
function buka(keadaan: Keadaan, tampilan: "lama" | "ui", statusTulis: { nilai: number } = { nilai: 200 }, pilihan: Opsi = {}) {
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
  // Bagian penunjukan tersimpan TERBUKA, supaya usulannya dimuat seketika.
  const simpanan: Record<string, unknown> = {
    ujiTampilan: tampilan,
    ujiIzinkanNyata: true,
    lipatanBagian: { penunjukan: false, kerjakan: false },
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.188.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
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
  const tulis: Tulis[] = [];
  const kiriman: Array<{ url: string; cara: string; badan: string }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    kiriman.push({ url, cara, badan: String((opsi && opsi.body) || "") });
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
      isi = { ok: true, data: { ruangan: [] } };
    } else if (url.includes("/aleta-bot/penunjukan/riwayat")) {
      isi = { ok: true, data: { riwayat: [] } };
    } else if (url.includes("/aleta-bot/penunjukan?")) {
      isi = { ok: true, data: { available: true, usulan: usulanUntuk(keadaan, pilihan.tanggalPhs), rencana: rencanaUntuk(), bolehOtomatis: true } };
    } else if (url.includes("/aleta-bot/penunjukan/tulis") && cara === "POST") {
      const badan = JSON.parse(String(opsi?.body || "{}"));
      if (Array.isArray(badan.rantai)) {
        // Penulisan sungguhan: satu kiriman, bot satu transaksi (tulisRantaiUtuh).
        for (const s of badan.rantai) tulis.push({ jenis: s.jenis, kering: false });
        if (statusTulis.nilai === 409) {
          status = 409;
          isi = {
            ok: false,
            alasan: "gagal_menulis",
            jenisGagal: "pjs",
            pesan: "ER_LOCK_WAIT_TIMEOUT: Lock wait timeout exceeded",
            dipulihkan: true,
            hasil: badan.rantai.map((s: { jenis: string }) => ({ jenis: s.jenis, ok: false })),
          };
        } else {
          for (const s of badan.rantai) keadaan[s.jenis as Jenis] = HARI;
          isi = { ok: true, utuh: true, hasil: badan.rantai.map((s: { jenis: string }) => ({ jenis: s.jenis, ok: true, langkah: [{ tabel: "perkara_penetapan" }] })) };
        }
      } else {
        tulis.push({ jenis: badan.jenis, kering: badan.kering !== false });
      }
      if (Array.isArray(badan.rantai)) {
        /* sudah dijawab di atas */
      } else if (statusTulis.nilai === 401 || statusTulis.nilai === 403) {
        // Bentuk galat portal (handleRouteError) - TANPA `alasan`.
        status = statusTulis.nilai;
        isi = { ok: false, error: { message: status === 401 ? "Sesi berakhir. Silakan masuk kembali." : "Peran Anda tidak diberi akses papan penunjukan." } };
      } else if (keadaan[badan.jenis as Jenis]) {
        status = 409;
        isi = { ok: false, alasan: `${badan.jenis}_sudah_ada` };
      } else if (pilihan.gagalKering === badan.jenis) {
        status = 409;
        isi = { ok: false, alasan: "jurusita_tidak_aktif" };
      } else {
        isi = { ok: true, langkah: [{ tabel: "perkara_penetapan" }], andaian: [], tanggalPenetapan: badan.tanggalPenetapan };
      }
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
  return { w, d: w.document as Document, tulis, kiriman };
}

/** Papan penunjukan yang SUDAH memuat usulan dan tombol Tetapkannya. */
async function papan(h: ReturnType<typeof buka>) {
  const kotak = await sampai(() => h.d.querySelector('.aleta-bagian[data-kunci="penunjukan"]') as HTMLElement | null, "bagian penunjukan");
  // Bila tersimpan terlipat, buka (memuat usulan) - sama dengan menekan kepalanya.
  const isi = kotak.querySelector(":scope > .aleta-bagian-isi") as HTMLElement | null;
  if (isi && isi.style.display === "none") (kotak.querySelector(":scope > .aleta-bagian-judul") as HTMLElement).click();
  await sampai(() => kotak.querySelector(".aleta-tombol-tetapkan"), () => `tombol Tetapkan; papan: ${String(kotak.textContent || "").slice(0, 300)}`);
  await sampai(
    () => !/Memeriksa formulir/.test(String(kotak.querySelector(".aleta-tetap-kaki .aleta-tetap-sebab")?.textContent || "")),
    "kabar tombol selesai diperiksa"
  );
  return kotak;
}

const barisLabel = (kotak: HTMLElement, label: string) =>
  Array.from(kotak.querySelectorAll(".aleta-tetap")).find((b) => (b.querySelector(".aleta-tetap-label")?.textContent || "") === label) as HTMLElement | undefined;


const kartuDari = (h: ReturnType<typeof buka>) => h.d.querySelector(".aleta-t7-penetapan") as HTMLElement | null;
const barisJenis = (k: HTMLElement, j: Jenis) => k.querySelector(`.aleta-t7-keputusan-baris[data-jenis="${j}"]`) as HTMLElement;
const statusJenis = (k: HTMLElement, j: Jenis) => String(barisJenis(k, j)?.querySelector(".aleta-t7-langkah-status")?.textContent || "");

async function kartuSiap(h: ReturnType<typeof buka>) {
  await papan(h);
  return sampai(() => {
    const k = kartuDari(h);
    const t = k?.querySelector(".aleta-t7-tetapkan-semua") as HTMLButtonElement | null;
    return k && t && !t.hidden && !t.disabled && t.textContent === "Tetapkan semua" && k.querySelectorAll("[data-jenis]").length === 4 ? k : null;
  }, () => `kartu satu klik; isi: ${String(kartuDari(h)?.textContent || "").slice(0, 300)}`);
}
const tombolSemua = (k: HTMLElement) => k.querySelector(".aleta-t7-tetapkan-semua") as HTMLButtonElement;

describe("satu klik = urutan alur lama", () => {
  it("perkara kosong: SATU tekanan memeriksa PMH, PPP, PJS, PHS lalu menuliskannya sekaligus - sama dengan dua tekanan lama", async () => {
    // Alur lama (tampilan Lama): dua tekanan tombol asli.
    const lama = buka(kosong(), "lama");
    const kotak = await papan(lama);
    const asli = kotak.querySelector(".aleta-tombol-tetapkan") as HTMLButtonElement;
    asli.click();
    await sampai(() => asli.textContent === "Tuliskan ke SIPP" && !asli.disabled, () => `tombol lama "${asli.textContent}"`);
    asli.click();
    await sampai(() => asli.textContent === "Penetapan selesai", () => `tombol lama "${asli.textContent}"`);

    // Satu klik (UI Baru).
    const baru = buka(kosong(), "ui");
    const k = await kartuSiap(baru);
    tombolSemua(k).click();
    await sampai(() => /tersimpan di SIPP/.test(String(k.querySelector(".aleta-t7-hasil")?.textContent || "")), () => `hasil "${k.querySelector(".aleta-t7-hasil")?.textContent}"`);

    expect(baru.tulis).toEqual(lama.tulis);
    expect(baru.tulis).toEqual([
      { jenis: "pmh", kering: true },
      { jenis: "ppp", kering: true },
      { jenis: "pjs", kering: true },
      { jenis: "phs", kering: true },
      { jenis: "pmh", kering: false },
      { jenis: "ppp", kering: false },
      { jenis: "pjs", kering: false },
      { jenis: "phs", kering: false },
    ]);
    for (const j of ["pmh", "ppp", "pjs", "phs"] as Jenis[]) expect(statusJenis(k, j)).toBe("✓ Ditetapkan");
    expect(k.querySelector(".aleta-t7-hasil")!.textContent).toBe("Keempat penetapan tersimpan di SIPP. Halaman dimuat ulang sebentar lagi.");
    expect(tombolSemua(k).textContent).toBe("Penetapan selesai");
    expect(tombolSemua(k).disabled).toBe(true);
  });

  it("bilah bawah menjalankan satu klik yang sama", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, "ui");
    const k = await kartuSiap(h);
    const bilah = h.d.querySelector(".aleta-t7-bilah .aleta-t7-utama") as HTMLButtonElement;
    expect(bilah.textContent).toBe("Tetapkan semua");
    bilah.click();
    await sampai(() => /tersimpan di SIPP/.test(String(k.querySelector(".aleta-t7-hasil")?.textContent || "")), "hasil bilah");
    expect(h.tulis.filter((x) => !x.kering).map((x) => x.jenis)).toEqual(["ppp", "pjs", "phs"]);
  });
});

describe("langkah yang sudah ditetapkan dilewati", () => {
  it("PMH sudah di SIPP: hanya PPP, PJS, PHS diperiksa dan ditulis; PMH tetap 'Sudah di SIPP'", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, "ui");
    const k = await kartuSiap(h);
    expect(k.querySelector(".aleta-t7-penetapan-ringkas")!.textContent).toBe("1 sudah di SIPP · 3 belum");
    expect(k.querySelector(".aleta-t7-tetapkan-petunjuk")!.textContent).toBe(
      "Satu kali tekan: ALETA memeriksa lalu menuliskan PPP, PJS, dan PHS. PMH sudah ada di SIPP."
    );
    expect(barisJenis(k, "pmh").textContent).toContain("Sudah di SIPP");
    expect(barisJenis(k, "pmh").textContent).not.toContain("Ubah");
    tombolSemua(k).click();
    await sampai(() => /tersimpan di SIPP/.test(String(k.querySelector(".aleta-t7-hasil")?.textContent || "")), "hasil");
    expect(h.tulis).toEqual([
      { jenis: "ppp", kering: true },
      { jenis: "pjs", kering: true },
      { jenis: "phs", kering: true },
      { jenis: "ppp", kering: false },
      { jenis: "pjs", kering: false },
      { jenis: "phs", kering: false },
    ]);
    expect(k.querySelector(".aleta-t7-hasil")!.textContent).toBe("PPP, PJS, dan PHS tersimpan di SIPP. Halaman dimuat ulang sebentar lagi.");
  });

  it("keempatnya sudah ada: tombol mati, tidak ada kiriman", async () => {
    const h = buka({ pmh: HARI, ppp: HARI, pjs: HARI, phs: HARI }, "ui");
    await papan(h);
    const k = await sampai(() => {
      const x = kartuDari(h);
      return x && x.querySelectorAll("[data-jenis]").length === 4 && /Semua sudah ditetapkan/.test(x.textContent || "") ? x : null;
    }, "kartu semua ada");
    await sampai(() => tombolSemua(k).textContent === "Keempat penetapan sudah ada", () => `tombol "${tombolSemua(k).textContent}"`);
    expect(tombolSemua(k).disabled).toBe(true);
    expect(h.tulis).toEqual([]);
  });
});

describe("gagal di tengah: dilaporkan, yang bergantung ditahan, tidak ada yang ditulis", () => {
  it("PJS gagal saat pemeriksaan: PMH/PPP siap, PJS gagal bersebab, PHS ditahan; tidak ada penulisan", async () => {
    const h = buka(kosong(), "ui", { nilai: 200 }, { gagalKering: "pjs" });
    const k = await kartuSiap(h);
    tombolSemua(k).click();
    await sampai(() => /Belum ada yang ditulis/.test(String(k.querySelector(".aleta-t7-hasil")?.textContent || "")), () => `hasil "${k.querySelector(".aleta-t7-hasil")?.textContent}"`);
    expect(h.tulis.every((x) => x.kering)).toBe(true);
    expect(h.tulis.map((x) => x.jenis)).toEqual(["pmh", "ppp", "pjs"]);
    expect(statusJenis(k, "pmh")).toBe("✓ Siap");
    expect(statusJenis(k, "ppp")).toBe("✓ Siap");
    expect(statusJenis(k, "pjs")).toBe("✗ Gagal");
    expect(statusJenis(k, "phs")).toBe("Ditahan");
    expect(barisJenis(k, "phs").textContent).toContain("Menunggu PJS berhasil lebih dulu.");
    expect(k.querySelector(".aleta-t7-hasil")!.textContent).toBe("Belum ada yang ditulis ke SIPP. Perbaiki PJS, lalu tekan Tetapkan semua lagi.");
    // Dapat ditekan lagi.
    await sampai(() => !tombolSemua(k).disabled && tombolSemua(k).textContent === "Tetapkan semua", "tombol hidup lagi");
  });

  it("transaksi dibatalkan bot saat menulis: PJS gagal, sisanya ditahan, kalimatnya awam", async () => {
    const status = { nilai: 200 };
    const h = buka(kosong(), "ui", status);
    const k = await kartuSiap(h);
    // Pemeriksaan lulus, lalu penulisan dibatalkan (409 dari rantai).
    const asliFetch = h.w.fetch;
    h.w.fetch = async (u: string, o?: { body?: string }) => {
      if (String(u).includes("/penunjukan/tulis") && /"rantai"/.test(String(o?.body || ""))) status.nilai = 409;
      return asliFetch(u, o);
    };
    tombolSemua(k).click();
    await sampai(() => /Tidak ada yang tertulis/.test(String(k.querySelector(".aleta-t7-hasil")?.textContent || "")), () => `hasil "${k.querySelector(".aleta-t7-hasil")?.textContent}"`);
    expect(statusJenis(k, "pjs")).toBe("✗ Gagal");
    expect(statusJenis(k, "phs")).toBe("Ditahan");
    expect(k.textContent).not.toMatch(/ER_LOCK_WAIT_TIMEOUT/);
  });
});

describe("tampilan bersih dan aman", () => {
  it("tidak ada teks teknis di kartu - sebelum, selama, dan sesudah", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, "ui", { nilai: 200 }, { gagalKering: "phs" });
    const k = await kartuSiap(h);
    const periksa = () => {
      const t = String(k.textContent || "");
      expect(t).not.toMatch(/kering|rantai|transaksi|perkaraId|undefined|null|NaN|\[object|_sudah_ada|[a-z]+_[a-z]+_[a-z]+/);
    };
    periksa();
    tombolSemua(k).click();
    await sampai(() => /Belum ada yang ditulis/.test(String(k.querySelector(".aleta-t7-hasil")?.textContent || "")), "hasil");
    periksa();
  });

  it("tidak ada kata 'Aleta' dalam isian yang dikirim untuk ditulis ke SIPP, dan tidak ada kiriman langsung ke SIPP", async () => {
    const h = buka(kosong(), "ui");
    const k = await kartuSiap(h);
    tombolSemua(k).click();
    await sampai(() => /tersimpan di SIPP/.test(String(k.querySelector(".aleta-t7-hasil")?.textContent || "")), "hasil");
    const tulis = h.kiriman.filter((x) => x.cara === "POST");
    expect(tulis.length).toBeGreaterThan(0);
    // Semua tulisan lewat ALETA (yang meneruskannya ke bot), tidak ada POST langsung ke halaman SIPP.
    expect(tulis.every((x) => x.url.includes("/aleta/api/"))).toBe(true);
    const nilai: string[] = [];
    const kumpul = (x: unknown) => {
      if (typeof x === "string") nilai.push(x);
      else if (Array.isArray(x)) x.forEach(kumpul);
      else if (x && typeof x === "object") Object.values(x).forEach(kumpul);
    };
    for (const x of tulis.filter((t) => t.url.includes("/penunjukan/tulis"))) kumpul(JSON.parse(x.badan));
    expect(nilai.length).toBeGreaterThan(0);
    expect(nilai.filter((v) => /aleta/i.test(v))).toEqual([]);
  });

  it("PHS pada hari libur: peringatan di baris, tombol Tetapkan semua ditahan", async () => {
    const h = buka(kosong(), "ui", { nilai: 200 }, { tanggalPhs: "2026-12-25" });
    await papan(h);
    const k = await sampai(() => {
      const x = kartuDari(h);
      return x && x.querySelectorAll("[data-jenis]").length === 4 && /hari libur/.test(String(barisJenis(x, "phs")?.textContent || "")) ? x : null;
    }, () => `kartu libur; isi ${String(kartuDari(h)?.textContent || "").slice(0, 400)}`);
    expect(barisJenis(k, "phs").textContent).toMatch(/Jumat, 25-12-2026 hari libur Natal - pilih hari sidang lain sebelum menetapkan\./);
    expect(tombolSemua(k).disabled).toBe(true);
    expect(k.querySelector(".aleta-t7-tetapkan-petunjuk")!.textContent).toBe("Tanggal sidang jatuh pada hari libur. Ubah hari sidangnya dulu.");
  });
});
