// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";
import { type BarisGabung, gabungEfektif, sidik, versiDari } from "@/lib/tipe-keluaran/gabung";
import type { EntriCermin, EntriTipe } from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * MEDAN BORANG PUTUSAN AKHIR DARI BASIS DATA - DAN SIMPAN YANG DISERAHKAN
 * ============================================================================
 *
 * Yang dijalankan di sini kode SUNGGUHAN:
 *   - panel-alat.js UTUH (alatTipeKeluaran, alatSetelVersiTipe, alatAmbil,
 *     antrean) di node:vm dengan DOM jsdom;
 *   - dari konten.js, dipotong (bukan disalin): bagianIsiPutusan,
 *     jalankanSatuAntreanSipp, muatPenggunaAleta, kirimKeJembatan,
 *     nilaiTerpilihMedan, muatanUsulanMedan, buatElemen, ringkasHentikan.
 *
 * Jawaban portal /ekstensi/tipe-keluaran disusun dengan aturan gabungan portal
 * yang SESUNGGUHNYA (gabungEfektif + versiDari atas CERMIN_EKSTENSI) - bentuk
 * rute itu, bukan bentuk karangan uji ini. Yang ditiru hanya tepi luar: borang
 * SIPP di balik jembatan (kirimKeJembatanLangsung), draf dan usulan ALETA,
 * praperiksa, dan simpanPutusanLaluBuka - yang terakhir DIHITUNG, sebab
 * memanggilnya berarti menekan Simpan SIPP.
 *
 * Yang dijaga:
 *   1. tabel kosong / portal mati -> medan yang dibaca dan diusulkan persis
 *      CALON_MEDAN_PANEL (12), urutan dan isi;
 *   2. satu medan tambahan yang tampak -> dibaca, diusulkan, diisikan, dan
 *      Simpan dipanggil 0 kali; medan bawaan saja -> 1 kali, seperti dulu;
 *   3. antrean massal SIPP memegang aturan yang sama (sebabTahan
 *      'medan-tambahan'), dan blok 3b (gagal-isi) tetap mendahuluinya;
 *   4. versiTipe dari /ekstensi/siapa (data.versiTipe) dipasang, sehingga
 *      versi yang sama dengan singgahan = 0 permintaan;
 *   5. kartu medan digambar pada borang yang baru dibuka - bukan hanya bila
 *      petugas sudah memilih pintu yang berbeda (cacat sejak 2.32.0).
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const BERKAS_KONTEN = process.env.ALETA_UJI_KONTEN || path.join(EKSTENSI, "konten.js");
const baca = (berkas: string) => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");
const ALAMAT_TIPE = "/aleta/api/aleta-ecourt/ekstensi/tipe-keluaran";
const ALAMAT_ISIAN = "/aleta/api/aleta-ecourt/putusan/isian-sipp";
const ALAMAT_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

/** Satu tetapan tingkat modul - satu baris, atau objek berbaris banyak yang ditutup "};". */
function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => b.startsWith(`const ${nama} = `));
  if (mulai < 0) throw new Error(`tetapan ${nama} tidak ketemu`);
  if (baris[mulai].trimEnd().endsWith(";")) return baris[mulai];
  let j = mulai;
  while (j < baris.length && baris[j] !== "};") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

const polos = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ----------------------------------------------------------------------------
// Jawaban portal dengan aturan gabungan yang sesungguhnya
// ----------------------------------------------------------------------------
type Medan = { kunci: string; nilai: string; data: Record<string, unknown>; urutan: number };

function jawabanPortal(tambahan: Medan[] = [], mati: string[] = []) {
  const daftar: Record<string, EntriTipe[]> = {};
  for (const [nama, cermin] of Object.entries(CERMIN_EKSTENSI)) {
    const kunci = nama as keyof typeof CERMIN_EKSTENSI;
    const baris: BarisGabung[] = [];
    if (nama === "putusan.medan-borang") {
      for (const t of tambahan) {
        baris.push({
          id: `t-${t.nilai}`,
          asal: "tambahan",
          sidik: sidik(kunci, t.kunci, t.nilai, t.data),
          aktif: true,
          keadaan: "disahkan",
          kunci: t.kunci,
          nilai: t.nilai,
          data: t.data,
          urutan: t.urutan,
          dibuatAt: "2026-09-26T01:00:00.000Z",
        });
      }
      for (const nilai of mati) {
        const e = (cermin as readonly EntriCermin[]).find((x) => x.nilai === nilai)!;
        baris.push({
          id: `mati-${nilai}`,
          asal: "bawaan",
          sidik: sidik(kunci, e.kunci, e.nilai, e.data),
          aktif: false,
          keadaan: "disahkan",
          kunci: e.kunci,
          nilai: e.nilai,
          data: e.data ?? {},
          urutan: e.urutan,
          dibuatAt: "2026-09-26T00:00:00.000Z",
        });
      }
    }
    daftar[nama] = gabungEfektif(kunci, cermin, baris).entri;
  }
  return { ok: true, versi: versiDari(daftar), dibuatPada: "2026-09-26T00:00:00.000Z", daftar };
}

/** Medan tambahan satker - penunjuknya nama medan yang dikarang, tidak ada di SIPP. */
const TAMBAHAN_ANAK: Medan = {
  kunci: "putusan-akhir",
  nilai: "Jumlah Anak Diasuh",
  data: { penunjuk: 'select[name="jumlah_anak_asuh"]' },
  urutan: 20,
};

// ----------------------------------------------------------------------------
// Borang SIPP tiruan di balik jembatan
// ----------------------------------------------------------------------------
type MedanBorang = { tampak: boolean; pilihan: Array<{ nilai: string; label: string }>; nilai: string };

function borangBaru(ekstra: Record<string, MedanBorang> = {}) {
  const pil = (...x: string[]) => [{ nilai: "-1", label: "Pilih Salah Satu" }, ...x.map((l, i) => ({ nilai: String(i + 1), label: l }))];
  const b: Record<string, MedanBorang> = {};
  for (const e of CERMIN_EKSTENSI["putusan.medan-borang"]) {
    const penunjuk = String(e.data!.penunjuk);
    b[penunjuk] = { tampak: true, pilihan: pil(`${e.nilai} A`, `${e.nilai} B`), nilai: "-1" };
  }
  return Object.assign(b, ekstra);
}

/** Borang baru ditambah medan TAMBAHAN_ANAK yang tampak dan berpilihan. */
const borangDenganAnak = () =>
  borangBaru({
    'select[name="jumlah_anak_asuh"]': {
      tampak: true,
      pilihan: [
        { nilai: "-1", label: "Pilih Salah Satu" },
        { nilai: "1", label: "Satu" },
        { nilai: "2", label: "Dua" },
      ],
      nilai: "-1",
    },
  });

type Draf = Record<string, unknown>;
const drafUtuh = (): Draf => ({
  ada: true,
  versi: 3,
  keadaan: "draf",
  jenisPerkara: "Cerai Gugat",
  pertimbangan: "<p>Menimbang, bahwa xxx.</p>",
  amar: "<p>1. Mengabulkan gugatan Penggugat;</p>",
  amarAnonim: "<p>1. Mengabulkan gugatan Penggugat;</p>",
});

const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

type Pilihan = {
  portal?: () => unknown; // jawaban rute tipe keluaran; lempar = portal mati
  borang?: Record<string, MedanBorang>;
  singgahan?: Record<string, unknown>;
  siapa?: unknown;
  /** Usulan tiruan untuk satu medan (mis. bentrok); kosong = bawaan tiruan. */
  usulan?: (kunci: string) => Record<string, unknown> | undefined;
};

function muat(p: Pilihan = {}) {
  const konten = baca(BERKAS_KONTEN);
  const alat = baca(path.join(EKSTENSI, "panel-alat.js"));
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  halaman.push(dom);
  const dokumen = dom.window.document;
  const borang = p.borang ?? borangBaru();

  const simpanan: Record<string, unknown> = polos(p.singgahan ?? {});
  const mintaTipe: string[] = [];
  const muatanUsulan: Array<{ medan: Array<Record<string, unknown>> }> = [];
  const jembatan: Array<{ jenis: string; penunjuk: string; nilai?: string }> = [];
  const simpanDitekan: string[] = [];
  const catatan: Array<{ jenis: string; ringkas: string }> = [];
  const peringatan: string[] = [];

  const jawab = (isi: unknown) => {
    const r = { ok: true, status: 200, json: async () => polos(isi), clone: () => r };
    return r;
  };

  const k: Record<string, any> = {
    console: { ...console, warn: (...x: unknown[]) => peringatan.push(x.map(String).join(" ")), log() {} },
    // Jeda gambar-ulang SIPP (350 ms) dan pewaktu lain dijalankan segera.
    setTimeout: (f: () => void) => setTimeout(f, 0),
    clearTimeout,
    AbortController,
    URLSearchParams,
    URL,
    FormData: dom.window.FormData,
    encodeURIComponent,
    document: dokumen,
    location: { origin: "http://127.0.0.1", pathname: "/sipp/index.php", search: "", hostname: "127.0.0.1" },
    window: {
      location: { hostname: "127.0.0.1", pathname: "/sipp/index.php", search: "", origin: "http://127.0.0.1" },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x },
      storage: {
        onChanged: { addListener() {} },
        local: {
          get: async (kunci: string[] | string) => {
            const hasil: Record<string, unknown> = {};
            for (const x of [kunci].flat()) if (x in simpanan) hasil[x] = polos(simpanan[x]);
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
          remove: async (kunci: string[] | string) => {
            for (const x of [kunci].flat()) delete simpanan[x];
          },
        },
        session: { get: async () => ({}), set: async () => undefined },
      },
    },
    fetch: async (alamat: string, opsi?: { method?: string; body?: string }) => {
      const url = String(alamat);
      if (url.includes(ALAMAT_TIPE)) {
        mintaTipe.push(url);
        if (!p.portal) throw new TypeError("Failed to fetch");
        const isi = p.portal();
        if (isi === 503) return { ok: false, status: 503, json: async () => ({ ok: false }), clone() { return this; } };
        return jawab(isi);
      }
      if (url.includes(ALAMAT_ISIAN) && String(opsi?.method || "GET").toUpperCase() === "POST") {
        const badan = JSON.parse(String(opsi?.body || "{}"));
        muatanUsulan.push(badan);
        // Usulan: pilihan pertama yang bukan isian bawaan, keyakinan pasti.
        const usulan = badan.medan.map((m: { kunci: string; pilihan: Array<{ nilai: string; label: string }> }) => {
          const lain = p.usulan?.(m.kunci);
          if (lain) return { kunci: m.kunci, ...lain };
          const x = m.pilihan.find((y) => y.nilai !== "-1")!;
          return { kunci: m.kunci, nilai: x.nilai, nilaiLabel: x.label, keyakinan: "pasti", nilaiBanyak: [x] };
        });
        return jawab({ data: { usulan } });
      }
      if (url.includes(ALAMAT_ISIAN)) return jawab({ data: drafUtuh() });
      if (url.includes(ALAMAT_SIAPA)) return jawab(p.siapa ?? { data: { nama: "Petugas Uji", peran: "panitera" } });
      return jawab({ ok: true });
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(alat, k, { filename: "panel-alat.js" });

  // Tepi luar konten.js - ditimpa SESUDAH panel-alat.js dimuat.
  Object.assign(k, {
    bagian: (judul: string) => {
      const kotak = dokumen.createElement("div") as any;
      kotak.appendChild(dokumen.createElement("h3")).textContent = judul;
      kotak.isi = dokumen.createElement("div");
      kotak.appendChild(kotak.isi);
      dokumen.body.appendChild(kotak);
      return kotak;
    },
    alatCatat: (jenis: string, ringkas: string) => void catatan.push({ jenis, ringkas }),
    alatCatatTindakan: () => undefined,
    alatKeringNyala: () => false,
    jalankanPraperiksaPanel: async () => null,
    praperiksaSebelumMengisi: async () => ({ hentikan: false, jumlah: { perhatian: 0 }, temuan: [] }),
    gambarRaporAgen: () => dokumen.createElement("div"),
    bacaPutusanSegar: async () => ({ sudahPutus: false }),
    perkaraIdDariHalaman: () => "",
    simpanPutusanLaluBuka: async (nomor: string) => {
      simpanDitekan.push(nomor);
      return { ok: true, bunyi: "Tersimpan di SIPP." };
    },
    kirimKeJembatanLangsung: async (pesan: { jenis: string; penunjuk: string; nilai?: string }) => {
      jembatan.push({ jenis: pesan.jenis, penunjuk: pesan.penunjuk, nilai: pesan.nilai });
      const m = borang[pesan.penunjuk];
      if (pesan.jenis === "pilihan") {
        if (!m) return { ok: false, alasan: "tidak_ada" };
        return {
          ok: true,
          tampak: m.tampak,
          nilaiSekarang: m.nilai,
          pilihan: m.pilihan.map((x) => ({ ...x, terpilih: x.nilai === m.nilai })),
        };
      }
      if (pesan.jenis === "nilai") return { ok: true, nilai: m ? m.nilai : "", tampak: true };
      if (pesan.jenis === "isi") {
        if (m) m.nilai = String(pesan.nilai);
        return { ok: true };
      }
      return { ok: false, alasan: "tidak dikenal" };
    },
  });

  vm.runInContext(
    [
      tetapan(konten, "ALETA_API_ISIAN_PUTUSAN"),
      tetapan(konten, "ALETA_API_SIAPA"),
      // Naik ke tingkat modul 26 September 2026 - dipakai bersama panel dan
      // antrean. Salinan kode yang lebih tua (pembukti gigitan) belum punya.
      ...(/^const NILAI_BAWAAN_BORANG = /m.test(konten) ? [tetapan(konten, "NILAI_BAWAAN_BORANG")] : []),
      "let penggunaTerakhir = null;",
      "let kapabilitasTerakhir = null;",
      ...[
        "buatElemen",
        "ringkasHentikan",
        "kirimKeJembatan",
        "nilaiTerpilihMedan",
        ...(/^function nilaiTerpilihBukanBawaan\(/m.test(konten) ? ["nilaiTerpilihBukanBawaan"] : []),
        "muatanUsulanMedan",
        "bagianIsiPutusan",
        "jalankanSatuAntreanSipp",
        "muatPenggunaAleta",
      ].map((nama) => potongFungsi(konten, nama)),
      "this.__uji = { bagianIsiPutusan, jalankanSatuAntreanSipp, muatPenggunaAleta };",
    ].join("\n"),
    k,
    { filename: "konten.js (potongan)" }
  );

  return { k, dokumen, borang, simpanan, mintaTipe, muatanUsulan, jembatan, simpanDitekan, catatan, peringatan };
}

async function tunggu(syarat: () => boolean, apa: string) {
  for (let i = 0; i < 400; i += 1) {
    if (syarat()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`tidak kunjung terjadi: ${apa}`);
}

const tombolBertulisan = (akar: ParentNode, teks: string) =>
  [...akar.querySelectorAll("button")].find((b) => b.textContent === teks) as HTMLButtonElement | undefined;

/** Panel satu perkara dijalankan sampai Isikan selesai (tersimpan atau diserahkan). */
async function jalankanPanel(m: ReturnType<typeof muat>) {
  const kotak = m.k.__uji.bagianIsiPutusan("12/Pdt.G/2026/PA.Uji") as HTMLDivElement;
  tombolBertulisan(kotak, "Ambil usulan dari ALETA")!.click();
  await tunggu(() => Boolean(tombolBertulisan(kotak, "Isikan yang dicentang")), "tombol Isikan muncul");
  const terap = tombolBertulisan(kotak, "Isikan yang dicentang")!;
  const hasil = terap.nextElementSibling as HTMLDivElement;
  const kartu = kotak.querySelectorAll(".aleta-abt-kartu select.aleta-pilih-sendiri, .aleta-pilih-banyak").length;
  terap.click();
  await tunggu(
    () => /Tersimpan di SIPP|Simpan TIDAK|Simpan tidak/.test(hasil.textContent || ""),
    "Isikan selesai"
  );
  return { kotak, hasil: hasil.textContent || "", kartu };
}

const PENUNJUK_CALON = CERMIN_EKSTENSI["putusan.medan-borang"].map((e) => String(e.data!.penunjuk));
const pilihanDibaca = (m: ReturnType<typeof muat>) => m.jembatan.filter((x) => x.jenis === "pilihan").map((x) => x.penunjuk);

/** CALON_MEDAN_PANEL dari konten.js sendiri - dijalankan, bukan dibaca. */
function calonMedanPanel(): Array<{ penunjuk: string; label: string; banyak?: boolean }> {
  const konten = baca(BERKAS_KONTEN);
  const i = konten.indexOf("const CALON_MEDAN_PANEL = [");
  const j = konten.indexOf("];", i);
  return polos(vm.runInNewContext(`(${konten.slice(i + "const CALON_MEDAN_PANEL = ".length, j + 1)})`, {}));
}

// ============================================================================
describe("1. tabel kosong atau portal mati: persis CALON_MEDAN_PANEL", () => {
  const calon = calonMedanPanel();

  it("cermin portal sama dengan CALON_MEDAN_PANEL (12) - pembanding uji ini sendiri sah", () => {
    expect(calon).toHaveLength(12);
    expect(PENUNJUK_CALON).toEqual(calon.map((c) => c.penunjuk));
  });

  for (const [nama, portal] of [
    ["portal mati", undefined],
    ["portal 503 (tabel tak terbaca)", () => 503],
    ["tabel kosong (portal menjawab cermin)", () => jawabanPortal()],
  ] as const) {
    it(`${nama}: 12 medan dibaca dan diusulkan dengan urutan dan isi CALON_MEDAN_PANEL, Simpan 1 kali`, async () => {
      const m = muat({ portal: portal as Pilihan["portal"] });
      const { hasil } = await jalankanPanel(m);

      // Putaran baca pertama = daftar medan yang berlaku, satu per satu.
      expect(pilihanDibaca(m).slice(0, 12)).toEqual(calon.map((c) => c.penunjuk));
      // Yang diusulkan: kunci, label, banyak - persis daftar tertanam.
      const diusulkan = m.muatanUsulan.flatMap((x) => x.medan).map((x) => ({ kunci: x.kunci, label: x.label, banyak: x.banyak }));
      expect(diusulkan).toEqual(calon.map((c) => ({ kunci: c.penunjuk, label: c.label, banyak: Boolean(c.banyak) })));
      expect(m.simpanDitekan).toEqual(["12/Pdt.G/2026/PA.Uji"]);
      expect(hasil).toContain("Tersimpan di SIPP.");
    });
  }

  it("portal mati: tertanam dipakai dan kegagalannya disebut di konsol, tidak diam", async () => {
    const m = muat();
    await jalankanPanel(m);
    expect(m.mintaTipe.length).toBeGreaterThanOrEqual(1);
    expect(m.peringatan.join("\n")).toMatch(/Tipe keluaran tidak terbaca dari portal/);
  });

  it("portal menjawab putusan.medan-borang [] : 12 medan tertanam tetap dibaca, konsol menyebut kosongnya", async () => {
    // Daftar kosong dari portal lebih mungkin berarti seluruhnya terbuang
    // penyaring daripada borang tanpa medan - panel tidak boleh membaca 0 medan.
    const jawab = jawabanPortal();
    jawab.daftar["putusan.medan-borang"] = [];
    const m = muat({ portal: () => jawab });
    const { hasil } = await jalankanPanel(m);

    expect(m.mintaTipe).toHaveLength(1);
    expect(pilihanDibaca(m).slice(0, 12)).toEqual(calon.map((c) => c.penunjuk));
    const diusulkan = m.muatanUsulan.flatMap((x) => x.medan).map((x) => x.kunci);
    expect(diusulkan).toEqual(calon.map((c) => c.penunjuk));
    expect(m.peringatan.join("\n")).toMatch(/Medan blangko putusan dari portal kosong; dipakai daftar tertanam/);
    expect(m.simpanDitekan).toEqual(["12/Pdt.G/2026/PA.Uji"]);
    expect(hasil).toContain("Tersimpan di SIPP.");
  });
});

// ============================================================================
describe("2. medan tambahan satker: dibaca, diusulkan, diisikan - Simpan diserahkan", () => {
  it("1 tambahan tampak: dibaca (ke-13), diusulkan, diisikan, Simpan 0 kali, kabarnya menyebut medannya", async () => {
    const m = muat({ portal: () => jawabanPortal([TAMBAHAN_ANAK]), borang: borangDenganAnak() });
    const { hasil, kotak } = await jalankanPanel(m);

    expect(pilihanDibaca(m).slice(0, 13)).toEqual([...PENUNJUK_CALON, 'select[name="jumlah_anak_asuh"]']);
    const diusulkan = m.muatanUsulan.flatMap((x) => x.medan).map((x) => x.kunci);
    expect(diusulkan).toContain('select[name="jumlah_anak_asuh"]');
    // Isiannya tetap dikerjakan.
    expect(m.jembatan).toContainEqual({ jenis: "isi", penunjuk: 'select[name="jumlah_anak_asuh"]', nilai: "1" });
    expect(m.borang['select[name="jumlah_anak_asuh"]'].nilai).toBe("1");
    // Simpan TIDAK ditekan.
    expect(m.simpanDitekan).toEqual([]);
    expect(hasil).toContain("Simpan TIDAK ditekan: blangko memuat medan tambahan satker (Jumlah Anak Diasuh)");
    expect(m.catatan.some((c) => /medan tambahan Jumlah Anak Diasuh - Simpan diserahkan ke petugas/.test(c.ringkas))).toBe(true);
    // Kartunya bertanda.
    expect(kotak.textContent).toContain("tambahan satker");
  });

  it("tambahan yang TIDAK tampak di blangko ini tidak menahan: Simpan 1 kali", async () => {
    const borang = borangDenganAnak();
    borang['select[name="jumlah_anak_asuh"]'].tampak = false;
    const m = muat({ portal: () => jawabanPortal([TAMBAHAN_ANAK]), borang });
    await jalankanPanel(m);
    expect(pilihanDibaca(m)).toContain('select[name="jumlah_anak_asuh"]');
    expect(m.simpanDitekan).toHaveLength(1);
  });

  it("tambahan yang tidak ada sama sekali di SIPP tidak menahan: Simpan 1 kali", async () => {
    const m = muat({ portal: () => jawabanPortal([TAMBAHAN_ANAK]) });
    await jalankanPanel(m);
    expect(m.simpanDitekan).toHaveLength(1);
  });

  it("tambahan dari singgahan (portal mati) tetap menahan - asalnya dibawa singgahan", async () => {
    const jawab = jawabanPortal([TAMBAHAN_ANAK]);
    const m = muat({ borang: borangDenganAnak(), singgahan: { tipeKeluaran: { versi: jawab.versi, pada: "x", isi: jawab.daftar } } });
    const { hasil } = await jalankanPanel(m);
    expect(m.simpanDitekan).toEqual([]);
    expect(hasil).toContain("medan tambahan satker");
  });

  it("bawaan yang dimatikan tidak dibaca dan tidak diusulkan; Simpan tetap 1 kali", async () => {
    const m = muat({ portal: () => jawabanPortal([], ["Hasil Reskom"]) });
    await jalankanPanel(m);
    expect(pilihanDibaca(m)).not.toContain('select[name="status_reskom"]');
    expect(m.muatanUsulan.flatMap((x) => x.medan).map((x) => x.label)).not.toContain("Hasil Reskom");
    expect(m.simpanDitekan).toHaveLength(1);
  });

  it("entri rusak dari portal (penunjuk Simpan) dibuang, bukan dibaca", async () => {
    const rusak: Medan = { kunci: "putusan-akhir", nilai: "Tombol", data: { penunjuk: "#btn_simpan" }, urutan: 30 };
    const jawab = jawabanPortal([TAMBAHAN_ANAK]);
    jawab.daftar["putusan.medan-borang"].push({ ...rusak, asal: "tambahan", sidik: "x" } as EntriTipe);
    const m = muat({ portal: () => jawab });
    await jalankanPanel(m);
    expect(pilihanDibaca(m)).not.toContain("#btn_simpan");
    expect(m.peringatan.join("\n")).toMatch(/penunjuk tombol Simpan\/submit/);
  });
});

// ============================================================================
describe("3. kartu medan digambar pada blangko yang baru dibuka", () => {
  it("tanpa selisih pintu pun tiap medan tampak punya kartu, dan pilihannya diisikan", async () => {
    // Cacat 2.32.0: kartu hanya digambar bila petugas SUDAH memilih pintu yang
    // berbeda dengan usulan ALETA. Borang baru -> 0 kartu, 0 medan terisi.
    const m = muat({ portal: () => jawabanPortal() });
    const { kartu } = await jalankanPanel(m);
    expect(kartu).toBe(12);
    const diisi = m.jembatan.filter((x) => x.jenis === "isi" && x.penunjuk.startsWith("select[name=")).map((x) => x.penunjuk);
    expect(diisi).toContain('select[name="faktor_cerai"]');
    expect(m.borang['select[name="faktor_cerai"]'].nilai).toBe("1");
  });
});

// ============================================================================
describe("4. versiTipe dari /ekstensi/siapa", () => {
  it("data.versiTipe sama dengan singgahan -> panel membaca daftar tanpa satu permintaan pun", async () => {
    const jawab = jawabanPortal([TAMBAHAN_ANAK]);
    const m = muat({
      portal: () => jawab,
      singgahan: { tipeKeluaran: { versi: jawab.versi, pada: "x", isi: jawab.daftar } },
      siapa: { data: { nama: "Petugas Uji", peran: "panitera", versiTipe: jawab.versi } },
    });
    await m.k.__uji.muatPenggunaAleta();
    expect(vm.runInContext("alatVersiTipeKini", m.k)).toBe(jawab.versi);
    await jalankanPanel(m);
    expect(m.mintaTipe).toEqual([]);
  });

  it("data.versiTipe berbeda -> tepat 1 permintaan, lalu daftar baru dipakai", async () => {
    const lama = jawabanPortal();
    const baru = jawabanPortal([TAMBAHAN_ANAK]);
    const m = muat({
      portal: () => baru,
      singgahan: { tipeKeluaran: { versi: lama.versi, pada: "x", isi: lama.daftar } },
      siapa: { data: { nama: "Petugas Uji", peran: "panitera", versiTipe: baru.versi } },
    });
    await m.k.__uji.muatPenggunaAleta();
    await jalankanPanel(m);
    expect(m.mintaTipe).toHaveLength(1);
    expect(pilihanDibaca(m)).toContain('select[name="jumlah_anak_asuh"]');
  });

  it("data.versiTipe null (tabel tak terbaca) -> portal tidak ditanya, singgahan lama dipakai", async () => {
    const lama = jawabanPortal([TAMBAHAN_ANAK]);
    const m = muat({
      portal: () => lama,
      singgahan: { tipeKeluaran: { versi: lama.versi, pada: "x", isi: lama.daftar } },
      siapa: { data: { nama: "Petugas Uji", peran: "panitera", versiTipe: null } },
    });
    await m.k.__uji.muatPenggunaAleta();
    await jalankanPanel(m);
    expect(m.mintaTipe).toEqual([]);
    expect(pilihanDibaca(m)).toContain('select[name="jumlah_anak_asuh"]');
  });

  it("dua tekan di panel yang sama: versi berganti di antaranya -> tekan kedua membaca tambahan baru tanpa muat ulang", async () => {
    const lama = jawabanPortal();
    const baru = jawabanPortal([TAMBAHAN_ANAK]);
    let jawabKini = lama;
    const m = muat({
      portal: () => jawabKini,
      borang: borangDenganAnak(),
      singgahan: { tipeKeluaran: { versi: lama.versi, pada: "x", isi: lama.daftar } },
      siapa: { data: { nama: "Petugas Uji", peran: "panitera", versiTipe: lama.versi } },
    });
    await m.k.__uji.muatPenggunaAleta();
    const kotak = m.k.__uji.bagianIsiPutusan("12/Pdt.G/2026/PA.Uji") as HTMLDivElement;
    const ambil = tombolBertulisan(kotak, "Ambil usulan dari ALETA")!;

    // Tekan 1: versi sama dengan singgahan - tanpa permintaan, tanpa tambahan.
    ambil.click();
    await tunggu(() => Boolean(tombolBertulisan(kotak, "Isikan yang dicentang")) && !ambil.disabled, "tekan 1 selesai");
    const isikan1 = tombolBertulisan(kotak, "Isikan yang dicentang");
    const bacaanTekan1 = pilihanDibaca(m).length;
    expect(m.mintaTipe).toEqual([]);
    expect(pilihanDibaca(m)).not.toContain('select[name="jumlah_anak_asuh"]');

    // Di antaranya tambahan disahkan di portal; /ekstensi/siapa berikutnya
    // membawa versi barunya (seperti muatPenggunaAleta yang berjalan lagi).
    jawabKini = baru;
    vm.runInContext(`alatSetelVersiTipe(${JSON.stringify(baru.versi)})`, m.k);

    // Tekan 2 pada panel yang SAMA - halaman tidak dimuat ulang.
    ambil.click();
    await tunggu(() => {
      const t = tombolBertulisan(kotak, "Isikan yang dicentang");
      return Boolean(t) && t !== isikan1 && !ambil.disabled;
    }, "tekan 2 selesai");
    expect(m.mintaTipe).toHaveLength(1);
    expect(pilihanDibaca(m).slice(bacaanTekan1)).toContain('select[name="jumlah_anak_asuh"]');

    // Dan tambahan itu benar-benar berlaku: Simpan diserahkan.
    const terap = tombolBertulisan(kotak, "Isikan yang dicentang")!;
    const hasil = terap.nextElementSibling as HTMLDivElement;
    terap.click();
    await tunggu(() => /Tersimpan di SIPP|Simpan TIDAK|Simpan tidak/.test(hasil.textContent || ""), "Isikan selesai");
    expect(m.simpanDitekan).toEqual([]);
    expect(hasil.textContent).toContain("medan tambahan satker (Jumlah Anak Diasuh)");
  });
});

// ============================================================================
describe("5. antrean massal SIPP: aturan yang sama", () => {
  type Butir = { nomor: string; keadaan: string; catatan: string; sebabTahan?: string };
  type Antrean = { tahap: string; modus: string; butir: Butir[] };

  async function antrean(m: ReturnType<typeof muat>) {
    const a = vm.runInContext(`alatBuatAntrean({ butir: [{ nomor: "7/Pdt.G/2026/PA.Uji" }], tahap: "sipp", modus: "otomatis" })`, m.k) as Antrean;
    // Antrean yang dikerjakan selalu antrean yang TERSIMPAN: sejak 26
    // September 2026 keadaan butir ditulis per butir ke antrean segar, dan
    // antrean yang tidak ada (sudah diakhiri) tidak dikerjakan.
    await m.k.alatSimpanAntrean(a);
    const kabar = m.dokumen.createElement("div");
    await m.k.__uji.jalankanSatuAntreanSipp(a, a.butir[0], kabar, m.dokumen.createElement("button"));
    return { butir: a.butir[0], kabar: kabar.textContent || "" };
  }
  // Hanya tiga medan NASKAH. Sejak 26 September 2026 antrean juga mengisi
  // medan pilihan bawaan (blok 3a) - dijaga ekstensi-massal-ujung-ke-ujung.
  const naskahDiisi = (m: ReturnType<typeof muat>) =>
    m.jembatan.filter((x) => x.jenis === "isi" && x.penunjuk.startsWith("#")).map((x) => x.penunjuk);

  it("1 tambahan tampak: naskah tetap diisi, Simpan 0 kali, tertahan 'medan-tambahan'", async () => {
    const borang = borangBaru({
      'select[name="jumlah_anak_asuh"]': { tampak: true, pilihan: [{ nilai: "1", label: "Satu" }], nilai: "" },
    });
    const m = muat({ portal: () => jawabanPortal([TAMBAHAN_ANAK]), borang });
    const { butir, kabar } = await antrean(m);
    expect(naskahDiisi(m)).toEqual(["#perhum", "#amar", "#amar_anonim"]);
    expect(m.simpanDitekan).toEqual([]);
    expect(butir.keadaan).toBe("tertahan");
    expect(butir.sebabTahan).toBe("medan-tambahan");
    expect(butir.catatan).toContain("Jumlah Anak Diasuh");
    expect(kabar).toContain("Simpan sendiri");
    expect(m.catatan.some((c) => c.jenis === "massal-galat" && /medan tambahan/.test(c.ringkas))).toBe(true);
  });

  it("medan tambahan yang tampak TIDAK dibaca untuk diusulkan dan TIDAK diisi antrean - hanya menahan", async () => {
    const m = muat({ portal: () => jawabanPortal([TAMBAHAN_ANAK]), borang: borangDenganAnak() });
    const { butir } = await antrean(m);
    const ANAK = 'select[name="jumlah_anak_asuh"]';
    // Tiruan usulan menjawab SETIAP medan yang diminta (pilihan pertama,
    // pasti) - andai tambahan ikut dibaca di 3a, ia pasti diusulkan dan diisi.
    expect(m.muatanUsulan.flatMap((x) => x.medan.map((y) => y.kunci))).not.toContain(ANAK);
    expect(m.jembatan.filter((x) => x.jenis === "isi" && x.penunjuk === ANAK)).toEqual([]);
    expect(m.borang[ANAK].nilai).toBe("-1");
    // Kendali: medan bawaan yang sama-sama tampak memang diusulkan dan diisi.
    expect(m.muatanUsulan.flatMap((x) => x.medan.map((y) => y.kunci))).toContain('select[name="faktor_cerai"]');
    expect(m.borang['select[name="faktor_cerai"]'].nilai).toBe("1");
    expect(butir.sebabTahan).toBe("medan-tambahan");
    expect(m.simpanDitekan).toEqual([]);
  });

  it("tambahan tidak tampak: Simpan 1 kali, selesai", async () => {
    const borang = borangBaru({
      'select[name="jumlah_anak_asuh"]': { tampak: false, pilihan: [{ nilai: "1", label: "Satu" }], nilai: "" },
    });
    const m = muat({ portal: () => jawabanPortal([TAMBAHAN_ANAK]), borang });
    const { butir } = await antrean(m);
    expect(m.simpanDitekan).toHaveLength(1);
    expect(butir.keadaan).toBe("selesai");
  });

  // Sampai 26 September 2026 uji ini menuntut "tanpa satu pembacaan medan
  // pun" - dan justru itulah sebab antrean tidak pernah dapat menyimpan:
  // Sumber Hukum dan Status Putusan dibiarkan kosong, lalu SIPP menolak.
  // Yang dijaga kini: medan BAWAAN dibaca dan diisi, tambahan tidak disentuh.
  it("bawaan saja (tabel kosong) dan portal mati: medan bawaan dibaca dan diisi, Simpan 1 kali", async () => {
    for (const portal of [() => jawabanPortal(), undefined]) {
      const m = muat({ portal });
      const { butir } = await antrean(m);
      expect(m.simpanDitekan).toHaveLength(1);
      expect(butir.keadaan).toBe("selesai");
      expect(pilihanDibaca(m).slice(0, 12)).toEqual(PENUNJUK_CALON);
      expect(pilihanDibaca(m)).not.toContain('select[name="jumlah_anak_asuh"]');
      expect(m.jembatan.filter((x) => x.jenis === "isi" && !x.penunjuk.startsWith("#")).map((x) => x.penunjuk)).toContain(
        'select[name="status_putusan"]'
      );
    }
  });

  it("pemeriksaan medan tambahan yang sendiri gagal MENAHAN, tidak diloloskan", async () => {
    const m = muat({ portal: () => jawabanPortal() });
    m.k.alatTipeKeluaran = async () => {
      throw new Error("singgahan rusak");
    };
    const { butir } = await antrean(m);
    expect(m.simpanDitekan).toEqual([]);
    expect(butir.sebabTahan).toBe("medan-tambahan");
    expect(butir.catatan).toContain("singgahan rusak");
  });

  it("blok 3b tetap mendahului: medan naskah gagal -> 'gagal-isi', bukan 'medan-tambahan'", async () => {
    const borang = borangBaru({
      'select[name="jumlah_anak_asuh"]': { tampak: true, pilihan: [{ nilai: "1", label: "Satu" }], nilai: "" },
    });
    const m = muat({ portal: () => jawabanPortal([TAMBAHAN_ANAK]), borang });
    const asli = m.k.kirimKeJembatanLangsung;
    m.k.kirimKeJembatanLangsung = async (x: { jenis: string; penunjuk: string }) =>
      x.jenis === "isi" && x.penunjuk === "#amar" ? { ok: false, alasan: "editor belum siap" } : asli(x);
    const { butir } = await antrean(m);
    expect(butir.sebabTahan).toBe("gagal-isi");
    expect(m.simpanDitekan).toEqual([]);
  });
});

// ============================================================================
describe("6. kartu Status panel satu perkara: pilihan petugas tidak ditimpa Isikan", () => {
  const STATUS = 'select[name="status_putusan"]';

  it("Status yang sudah dipilih petugas dan berbeda dari usulan: kartunya TIDAK tercentang, kedua nilai tampak, Isikan tidak menimpanya", async () => {
    const borang = borangBaru();
    borang[STATUS].nilai = "2"; // petugas memilih pilihan kedua; usulan tiruan = pilihan pertama
    const m = muat({ portal: () => jawabanPortal(), borang });
    const { kotak } = await jalankanPanel(m);

    const kartu = [...kotak.querySelectorAll(".aleta-abt-kartu")].find(
      (x) => x.querySelector(".aleta-abt-nama")?.textContent === "Status Putusan"
    )!;
    expect(kartu).toBeTruthy();
    expect((kartu.querySelector("input.aleta-abt-centang") as HTMLInputElement).checked).toBe(false);
    expect(kartu.textContent).toContain(borang[STATUS].pilihan[2].label); // sekarang
    expect(kartu.textContent).toContain(borang[STATUS].pilihan[1].label); // usulan
    expect(kartu.textContent).toContain("Status sudah dipilih di halaman");
    expect(m.jembatan.filter((x) => x.jenis === "isi" && x.penunjuk === STATUS)).toEqual([]);
    expect(m.borang[STATUS].nilai).toBe("2");
  });

  it("kendali: Status yang belum dipilih - kartunya tercentang dan Isikan mengisinya", async () => {
    const m = muat({ portal: () => jawabanPortal() });
    const { kotak } = await jalankanPanel(m);
    const kartu = [...kotak.querySelectorAll(".aleta-abt-kartu")].find(
      (x) => x.querySelector(".aleta-abt-nama")?.textContent === "Status Putusan"
    )!;
    expect((kartu.querySelector("input.aleta-abt-centang") as HTMLInputElement).checked).toBe(true);
    expect(kartu.textContent).not.toContain("Status sudah dipilih di halaman");
    expect(m.borang[STATUS].nilai).toBe("1");
  });

  it("kendali: Status yang sama dengan usulan - kartunya tetap tercentang", async () => {
    const borang = borangBaru();
    borang[STATUS].nilai = "1";
    const m = muat({ portal: () => jawabanPortal(), borang });
    const { kotak } = await jalankanPanel(m);
    const kartu = [...kotak.querySelectorAll(".aleta-abt-kartu")].find(
      (x) => x.querySelector(".aleta-abt-nama")?.textContent === "Status Putusan"
    )!;
    expect((kartu.querySelector("input.aleta-abt-centang") as HTMLInputElement).checked).toBe(true);
  });
});

// ============================================================================
describe("7. beda yang disengaja: pintu yang usulannya bentrok", () => {
  // Panel satu perkara MEMBUKA pintu dengan usulan yang bentrok - petugas
  // yang menekan Isikan melihat kartunya lebih dulu, dan kartu yang bentrok
  // tidak tercentang. Antrean tidak punya orang di depan borang: pintu yang
  // bentrok dibiarkan, dan Status yang kosong menahan Simpan. Kesamaan daftar
  // CALON tidak berarti kesamaan perilaku - perbedaan ini dinyatakan di sini.
  const STATUS = 'select[name="status_putusan"]';
  const bentrok = (kunci: string) =>
    kunci === STATUS ? { nilai: "1", nilaiLabel: "Status Putusan A", keyakinan: "bentrok" } : undefined;

  it("panel: pintu Status dibuka dengan usulan bentrok sebelum Isikan ditekan", async () => {
    const m = muat({ portal: () => jawabanPortal(), usulan: bentrok });
    const kotak = m.k.__uji.bagianIsiPutusan("12/Pdt.G/2026/PA.Uji") as HTMLDivElement;
    tombolBertulisan(kotak, "Ambil usulan dari ALETA")!.click();
    await tunggu(() => Boolean(tombolBertulisan(kotak, "Isikan yang dicentang")), "tombol Isikan muncul");
    expect(m.jembatan.filter((x) => x.jenis === "isi" && x.penunjuk === STATUS).map((x) => x.nilai)).toEqual(["1"]);
    expect(m.simpanDitekan).toEqual([]);
  });

  it("antrean: pintu Status yang bentrok TIDAK dibuka - tertahan 'pilihan-kosong', Simpan tidak ditekan", async () => {
    const m = muat({ portal: () => jawabanPortal(), usulan: bentrok });
    const a = vm.runInContext('alatBuatAntrean({ butir: [{ nomor: "7/Pdt.G/2026/PA.Uji" }], tahap: "sipp", modus: "otomatis" })', m.k);
    await m.k.alatSimpanAntrean(a);
    await m.k.__uji.jalankanSatuAntreanSipp(a, a.butir[0], m.dokumen.createElement("div"), m.dokumen.createElement("button"));
    const butir = a.butir[0] as { keadaan: string; sebabTahan?: string; catatan: string };
    expect(m.jembatan.filter((x) => x.jenis === "isi" && x.penunjuk === STATUS)).toEqual([]);
    expect(butir.keadaan).toBe("tertahan");
    expect(butir.sebabTahan).toBe("pilihan-kosong");
    expect(butir.catatan).toContain("Status Putusan (naskah menyebut lebih dari satu)");
    expect(m.simpanDitekan).toEqual([]);
  });
});

// ============================================================================
describe("8. panel satu perkara: nilai yang dipilih blangko SIPP sendiri bukan pilihan petugas", () => {
  // Borang Putusan Akhir yang baru dibuka sudah memilih "Tidak" pada Verstek
  // dan "Qobla Dukhul" pada qobla ($qobla_bada NULL, dan NULL == 0 di PHP).
  // Bila keduanya dikirim sebagai "terpilih", hormatiTerpilih portal
  // membeonya: perkara ba'da dukhul diusulkan Qobla Dukhul. Pilihan yang
  // sungguh dibuat petugas tetap dikirim.
  const VERSTEK = 'select[name="verstek"]';
  const QOBLA = 'select[name="qobla"]';
  const borangSipp = (verstek: string, qobla: string) =>
    borangBaru({
      [VERSTEK]: {
        tampak: true,
        pilihan: [
          { nilai: "T", label: "Tidak" },
          { nilai: "Y", label: "Ya" },
        ],
        nilai: verstek,
      },
      [QOBLA]: {
        tampak: true,
        pilihan: [
          { nilai: "-1", label: "Pilih Salah Satu" },
          { nilai: "0", label: "Qobla Dukhul" },
          { nilai: "1", label: "Ba'da Dukhul" },
        ],
        nilai: qobla,
      },
    });
  async function terpilihTerkirim(borang: Record<string, MedanBorang>) {
    const m = muat({ portal: () => jawabanPortal(), borang });
    const kotak = m.k.__uji.bagianIsiPutusan("12/Pdt.G/2026/PA.Uji") as HTMLDivElement;
    tombolBertulisan(kotak, "Ambil usulan dari ALETA")!.click();
    await tunggu(() => m.muatanUsulan.length > 0, "usulan diminta");
    const medan = m.muatanUsulan.flatMap((x) => x.medan);
    const dari = (kunci: string) => medan.find((x) => x.kunci === kunci);
    expect(dari(VERSTEK), "verstek ikut dibaca").toBeTruthy();
    expect(dari(QOBLA), "qobla ikut dibaca").toBeTruthy();
    return { verstek: dari(VERSTEK)!.terpilih, qobla: dari(QOBLA)!.terpilih };
  }

  it("blangko baru (Verstek 'Tidak', 'Qobla Dukhul' bawaan): keduanya TIDAK dikirim sebagai terpilih", async () => {
    expect(await terpilihTerkirim(borangSipp("T", "0"))).toEqual({ verstek: undefined, qobla: undefined });
  });

  it("kendali: pilihan yang bukan bawaan blangko (Ya, Ba'da Dukhul) tetap dikirim sebagai terpilih", async () => {
    expect(await terpilihTerkirim(borangSipp("Y", "1"))).toEqual({ verstek: "Y", qobla: "1" });
  });
});
