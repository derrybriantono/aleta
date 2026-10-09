// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PAPAN PENETAPAN PER PERKARA: YANG SUDAH TERCATAT DI SIPP DIGAMBAR SEBAGAI
 * TERCATAT, BUKAN SEBAGAI USULAN (uji rilis U1, 9 Oktober 2026)
 * ============================================================================
 *
 * Data nyata SIPP satker, 9 Okt 2026 (baca-saja): perkara 653/Pdt.G/2026/PA.Dgl
 * (Cerai Gugat, didaftar hari itu) PMH-nya dikerjakan TANGAN pukul 09.44 oleh
 * akun "fahri" - majelis_hakim_kode "C1|C2|C3", Himawan / Idris / Derry - dan
 * PPP, PJS, PHS masih NULL. Itulah keadaan yang dituju fitur "penetapan tahap
 * sisa" 1.188.0.
 *
 * Rantainya (rantaiPenetapan) sudah benar melewati PMH. Yang keliru papannya:
 * baris "Penetapan Majelis Hakim" tetap menampilkan USULAN mesin (bisa majelis
 * lain), di UI Baru berlabel "Usulan ALETA" dan bertombol "Ubah"; dropdown
 * majelis tetap ditawarkan walau pilihannya tidak akan ditulis; "Pejabat yang
 * menetapkan" tetap memuat PMH; dan kalimatnya "menuliskan keempatnya". Perkara
 * yang keempatnya sudah ada baru mengaku "sudah ada" SESUDAH tombolnya ditekan.
 *
 * Dijaga dengan MENJALANKAN panel-alat.js, basmassal.js, dan konten.js UTUH di
 * jsdom atas halaman detil_perkara_agama tiruan, untuk Lama dan UI Baru.
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
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
function usulanUntuk(keadaan: Keadaan) {
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
    phs: { usulan: "2026-10-21", sebut: "Rabu, 21-10-2026", calon: [], sebab: "hari sidang Majelis C" },
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

function buka(keadaan: Keadaan, tampilan: "lama" | "ui", statusTulis: { nilai: number } = { nilai: 200 }) {
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
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
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
      isi = { ok: true, data: { available: true, usulan: usulanUntuk(keadaan), rencana: rencanaUntuk(), bolehOtomatis: true } };
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
  return { w, d: w.document as Document, tulis };
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

// ============================================================================
describe("PMH dikerjakan tangan (perkara 653 SIPP satker): papan menggambar yang TERCATAT", () => {
  for (const tampilan of ["lama", "ui"] as const) {
    it(`${tampilan}: baris PMH = majelis tercatat + 'sudah ada di SIPP', bukan usulan majelis lain`, async () => {
      const h = buka({ ...kosong(), pmh: HARI }, tampilan);
      const kotak = await papan(h);
      const pmh = barisLabel(kotak, "Penetapan Majelis Hakim")!;
      expect(pmh).toBeTruthy();
      expect(pmh.textContent).toContain("Himawan Tatura Wijaya, Idris, Derry Briantono");
      expect(pmh.textContent).toMatch(/sudah ada di SIPP/);
      expect(pmh.textContent).not.toContain("Fahri Saifuddin");
      // PPP/PJS/PHS tetap usulan - itulah sisa yang akan ditulis.
      expect(barisLabel(kotak, "Penunjukan Panitera Pengganti")!.textContent).toContain("Sri Susilowati");
      expect(barisLabel(kotak, "Penunjukan Panitera Pengganti")!.textContent).not.toMatch(/sudah ada di SIPP/);
    });
  }

  it("dropdown majelis tidak ditawarkan untuk PMH yang sudah ada (pilihannya tidak akan ditulis)", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, "lama");
    const kotak = await papan(h);
    const label = Array.from(kotak.querySelectorAll(".aleta-pilih-nama")).map((x) => String(x.textContent || "").trim());
    expect(label).not.toContain("Majelis");
    // Pembanding: perkara kosong TETAP menawarkannya.
    const h2 = buka(kosong(), "lama");
    const kotak2 = await papan(h2);
    expect(kotak2.textContent).toContain("Fahri Saifuddin · Wakil Ketua · Hakim Lain");
  });

  it("'Pejabat yang menetapkan' hanya memuat langkah SISA - PMH tidak lagi dipilihkan pejabatnya", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, "lama");
    const kotak = await papan(h);
    const jenis = Array.from(kotak.querySelectorAll(".aleta-tetap-pejabat-jenis")).map((x) => String(x.textContent || "").trim());
    expect(jenis).toEqual(["PPP", "PJS"]);
  });

  it("kalimat tombol menyebut langkah SISA, bukan 'keempatnya'; tanggal sisa setanggal PMH", async () => {
    const h = buka({ ...kosong(), pmh: "2026-10-08" }, "lama");
    const kotak = await papan(h);
    const kabar = String(kotak.querySelector(".aleta-tetap-kaki .aleta-tetap-sebab")?.textContent || "");
    expect(kabar).toMatch(/PPP, PJS, PHS/);
    expect(kabar).not.toMatch(/keempatnya/);
    expect(kotak.textContent).not.toContain("Tanggal penetapan keempatnya");
    expect(kotak.textContent).toMatch(/setanggal PMH yang sudah ada/);
  });

  it("UI Baru: kartu Keputusan penetapan menandai PMH 'Sudah di SIPP', tanpa 'Usulan ALETA' dan tanpa 'Ubah'", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, "ui");
    await papan(h);
    const kartu = await sampai(() => {
      const k = h.d.querySelector(".aleta-t7-keputusan");
      return k && k.querySelectorAll(".aleta-t7-keputusan-baris").length >= 4 ? k : null;
    }, () => `kartu keputusan UI Baru; isi: ${String(h.d.querySelector(".aleta-t7-keputusan")?.textContent || "").slice(0, 300)}`);
    const baris = Array.from(kartu.querySelectorAll(".aleta-t7-keputusan-baris"));
    const pmh = baris.find((b) => /Penetapan Majelis Hakim/.test(b.textContent || ""))!;
    expect(pmh.textContent).toContain("Himawan Tatura Wijaya");
    expect(pmh.textContent).toContain("Sudah di SIPP");
    expect(pmh.textContent).not.toContain("Usulan ALETA");
    expect(pmh.textContent).not.toContain("Ubah");
    const ppp = baris.find((b) => /Panitera Pengganti/.test(b.textContent || ""))!;
    expect(ppp.textContent).toContain("Usulan ALETA");
  });

  it("menekan: uji kering hanya mengirim PPP, PJS, PHS - lalu 'Tuliskan ke SIPP' terbuka", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, "lama");
    const kotak = await papan(h);
    const tombol = kotak.querySelector(".aleta-tombol-tetapkan") as HTMLButtonElement;
    tombol.click();
    await sampai(() => tombol.textContent === "Tuliskan ke SIPP", () => `tombol kini "${tombol.textContent}"`);
    expect(h.tulis.map((x) => x.jenis)).toEqual(["ppp", "pjs", "phs"]);
    expect(h.tulis.every((x) => x.kering)).toBe(true);
  });
});

// ============================================================================
describe("keempatnya sudah ada: dikatakan SEBELUM ditekan, tombol tidak menawarkan apa pun", () => {
  for (const tampilan of ["lama", "ui"] as const) {
    it(`${tampilan}: tombol 'Keempat penetapan sudah ada' mati sejak papan dimuat, tanpa satu kiriman pun`, async () => {
      const h = buka({ pmh: HARI, ppp: HARI, pjs: HARI, phs: HARI }, tampilan);
      const kotak = await papan(h);
      const tombol = kotak.querySelector(".aleta-tombol-tetapkan") as HTMLButtonElement;
      await sampai(() => tombol.textContent === "Keempat penetapan sudah ada", () => `tombol kini "${tombol.textContent}"`);
      expect(tombol.disabled).toBe(true);
      expect(h.tulis).toEqual([]);
      for (const label of ["Penetapan Majelis Hakim", "Penunjukan Panitera Pengganti", "Penunjukan Juru Sita", "Penetapan Hari Sidang"]) {
        expect(barisLabel(kotak, label)!.textContent).toMatch(/sudah ada di SIPP/);
      }
    });
  }
});

// ============================================================================
describe("perkara kosong: perilaku lama utuh", () => {
  it("usulan PMH digambar sebagai usulan, kalimat 'keempatnya' tetap, keempat langkah dikirim", async () => {
    const h = buka(kosong(), "lama");
    const kotak = await papan(h);
    const pmh = barisLabel(kotak, "Penetapan Majelis Hakim")!;
    expect(pmh.textContent).toContain("Fahri Saifuddin");
    expect(pmh.textContent).not.toMatch(/sudah ada di SIPP/);
    expect(kotak.textContent).toContain("Tanggal penetapan keempatnya");
    const tombol = kotak.querySelector(".aleta-tombol-tetapkan") as HTMLButtonElement;
    tombol.click();
    await sampai(() => tombol.textContent === "Tuliskan ke SIPP", () => `tombol kini "${tombol.textContent}"`);
    expect(h.tulis.map((x) => x.jenis)).toEqual(["pmh", "ppp", "pjs", "phs"]);
  });
});

// ============================================================================
describe("sesi ALETA habis / tidak berwenang SESUDAH papan dimuat: sebabnya terbaca, bukan 'ditolak'", () => {
  const kabarDari = (kotak: HTMLElement) => String(kotak.querySelector(".aleta-tetap-kaki .aleta-tetap-sebab")?.textContent || "");

  it("401 dari rute tulis: kalimat sesi habis, rantai berhenti, tombol dapat ditekan lagi", async () => {
    const status = { nilai: 200 };
    const h = buka({ ...kosong(), pmh: HARI }, "lama", status);
    const kotak = await papan(h);
    status.nilai = 401; // sesi habis di antara memuat papan dan menekan
    const tombol = kotak.querySelector(".aleta-tombol-tetapkan") as HTMLButtonElement;
    tombol.click();
    await sampai(() => /Sesi ALETA/.test(kabarDari(kotak)), () => `kabar kini "${kabarDari(kotak)}"`);
    expect(kabarDari(kotak)).not.toMatch(/ditolak/);
    // Hanya langkah pertama yang dicoba - rantai berhenti di sana.
    expect(h.tulis.map((x) => x.jenis)).toEqual(["ppp"]);
    await sampai(() => !tombol.disabled, "tombol hidup lagi");
    expect(tombol.textContent).toBe("Tetapkan dan tuliskan ke SIPP");
  });

  it("403: kalimat tidak berwenang; keduanya penolakan MENYELURUH (massal berhenti, tidak mengulang)", async () => {
    const status = { nilai: 403 };
    const h = buka(kosong(), "lama", status);
    const kotak = await papan(h);
    (kotak.querySelector(".aleta-tombol-tetapkan") as HTMLButtonElement).click();
    await sampai(() => /tidak diberi akses menulis(kan)? penetapan/.test(kabarDari(kotak)), () => `kabar kini "${kabarDari(kotak)}"`);
    const pola = h.w.eval("ALASAN_MENYELURUH") as RegExp;
    expect(pola.test("belum_masuk_aleta")).toBe(true);
    expect(pola.test("tidak_berwenang_aleta")).toBe(true);
  });

  it("penolakan bersebab dari bot (ada `alasan`) tidak diganti, walau berstatus 409", () => {
    const h = buka(kosong(), "lama");
    expect(polos(h.w.jawabPenetapanMenurutStatus(409, { ok: false, alasan: "pmh_sudah_ada" }))).toEqual({ ok: false, alasan: "pmh_sudah_ada" });
    expect(polos(h.w.jawabPenetapanMenurutStatus(200, { ok: true }))).toEqual({ ok: true });
  });
});

// ============================================================================
describe("penulisan sungguhan: sisa penetapan SATU kiriman, utuh atau batal (temuan U4)", () => {
  async function tekanDua(h: ReturnType<typeof buka>) {
    const kotak = await papan(h);
    const tombol = kotak.querySelector(".aleta-tombol-tetapkan") as HTMLButtonElement;
    tombol.click();
    await sampai(() => tombol.textContent === "Tuliskan ke SIPP" && !tombol.disabled, () => `tombol kini "${tombol.textContent}"`);
    h.tulis.length = 0;
    tombol.click();
    return { kotak, tombol };
  }

  it("PMH tangan: PPP, PJS, PHS dikirim dalam SATU permintaan (rantai), lalu 'Penetapan selesai'", async () => {
    const h = buka({ ...kosong(), pmh: HARI }, "lama");
    const { tombol } = await tekanDua(h);
    await sampai(() => tombol.textContent === "Penetapan selesai", () => `tombol kini "${tombol.textContent}"`);
    expect(h.tulis).toEqual([
      { jenis: "ppp", kering: false },
      { jenis: "pjs", kering: false },
      { jenis: "phs", kering: false },
    ]);
  });

  it("bot membatalkan transaksi (gagal di PJS): sebabnya terbaca, 'tidak ada yang tertulis', tombol dapat diulang", async () => {
    const status = { nilai: 200 };
    const h = buka(kosong(), "lama", status);
    const kotak = await papan(h);
    const tombol = kotak.querySelector(".aleta-tombol-tetapkan") as HTMLButtonElement;
    tombol.click();
    await sampai(() => tombol.textContent === "Tuliskan ke SIPP" && !tombol.disabled, () => `tombol kini "${tombol.textContent}"`);
    status.nilai = 409;
    tombol.click();
    const kabar = () => String(kotak.querySelector(".aleta-tetap-kaki .aleta-tetap-sebab")?.textContent || "");
    await sampai(() => /Tidak ada yang tertulis/.test(kabar()), () => `kabar kini "${kabar()}"`);
    expect(kabar()).toMatch(/dibatalkan karena PJS gagal/);
    expect(kabar()).toMatch(/ER_LOCK_WAIT_TIMEOUT/);
    await sampai(() => !tombol.disabled, "tombol hidup lagi");
    // Kembali ke awal: diperiksa (uji kering) dulu sebelum menulis lagi.
    expect(tombol.textContent).toBe("Tetapkan dan tuliskan ke SIPP");
  });
});
