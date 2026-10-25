// @vitest-environment node
/**
 * ============================================================================
 * KABAR PERUBAHAN DATA SIPP DARI JEJAK CERMIN (A8 / U17, 25 Okt 2026)
 * ============================================================================
 *
 *   A. kabarPerubahanDariCermin: saklar `kabar` MATI bawaan; tanya pertama hanya mengambil
 *      keadaan dasar; perubahan ISI (bukan sekadar tulis ulang) sesudah `sejak` menjadi kabar,
 *      lengkap dengan bagiannya (perkara / sidang); diam bila cermin tertinggal; tanpa data
 *      pribadi dan tanpa nama petugas;
 *   B. rute /api/aleta-ecourt/kabar-perubahan (401, saklar mati, menyala);
 *   C. EKSTENSI (konten.js utuh di jsdom): pita kabar muncul sesudah perubahan, tombol Abaikan
 *      membuangnya, kalimat lunak bila mungkin dari ALETA, diam bila tidak aktif, tanpa
 *      panggilan beruntun saat dinonaktifkan.
 *
 * Data rekaan saja. Tidak ada jaringan dan tidak ada SIPP sungguhan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PENGATURAN_CERMIN_BAWAAN, keadaanPemindaiAwal, type PengaturanCermin } from "@/lib/cermin";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { JENDELA_DARI_ALETA_MS, kabarPerubahanDariCermin, type DepsKabar } from "@/server/modules/cermin/kabar";
import { KUNCI_JEJAK, tulisJejak } from "@/server/modules/cermin/jejak";
import { buangSinggahKesegaran } from "@/server/modules/cermin/kesegaran";
import { aturUlangPembaruanCermin } from "@/server/modules/cermin/pembaruan";
import { buangSinggahPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { simpanJendelaSidang, simpanKelompokPerkara } from "@/server/modules/cermin/penyimpan";
import { aturTulisCerminTerakhir } from "@/server/modules/cermin/setelah-tulisan";
import { tandaiTulisan } from "@/server/shared/singgah-singkat";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

let dbRute: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => dbRute };
});

const NOMOR = "556/Pdt.G/2026/PA.Rekaan";
const T0 = Date.parse("2026-10-25T14:00:00Z"); // 22.00 WITA, Minggu 25 Okt
let db: AletaDatabase;
let jam = T0;
let pengaturan: PengaturanCermin;
let tulisAleta = 0;

function pasangPengaturan(kabarNyala: boolean) {
  pengaturan = { ...PENGATURAN_CERMIN_BAWAAN, pemindaiAktif: true, layar: { ...PENGATURAN_CERMIN_BAWAAN.layar, kabar: kabarNyala } };
}
async function simpanPengaturanDb() {
  await db
    .prepare("INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai")
    .run("*sistem*", "sistem:cermin-perkara", JSON.stringify(pengaturan), "x");
  buangSinggahPengaturanCermin();
  buangSinggahKesegaran();
}
async function cerminSegar() {
  const k = keadaanPemindaiAwal();
  k.status = "selesai";
  k.tahap = "selesai";
  k.mulaiPada = new Date(jam - 3_600_000).toISOString();
  await tulisJejak(db, KUNCI_JEJAK.pemindai, k);
  const putaran = new Date(jam - 20_000).toISOString();
  await tulisJejak(db, KUNCI_JEJAK.pembaruan, { tanda: "2026-10-25 21:59:00", putaranTerakhir: putaran, panasTerakhir: putaran, antrianTanggal: [], terakhir: null, galat: { terakhir: "", pada: "", beruntun: 0 }, tidakTerbaca: [] });
  buangSinggahKesegaran();
}

const perkara = (tambah: Record<string, unknown> = {}) => ({
  perkaraId: "556",
  nomorPerkara: NOMOR,
  jenisPerkaraId: 345,
  jenisPerkaraNama: "Cerai Gugat",
  alurPerkaraId: 15,
  tanggalPendaftaran: "2026-09-01",
  prodeo: 0,
  tahapanTerakhirId: 15,
  tahapanTerakhirText: "Persidangan",
  prosesTerakhirId: 1,
  prosesTerakhirText: "Sidang Pertama",
  majelisHakim: "Hakim Rekaan, S.H.",
  paniteraPengganti: "PP Rekaan",
  jurusita: "JS Rekaan",
  sidangPertama: "2026-09-15",
  sidangTerakhir: "2026-10-20",
  sidangBerikut: "2026-10-27",
  jumlahSidang: 3,
  tanggalPutusan: "",
  statusPutusan: "",
  putusanVerstek: 0,
  tanggalMinutasi: "",
  tanggalBht: "",
  sippDiperbarui: "2026-10-20 08:00:00",
  ...tambah,
});
const sidangRekaan = (id: string, perkaraId: string, agenda: string, tanggal = "2026-10-27") => ({
  sidangId: id,
  perkaraId,
  tanggalSidang: tanggal,
  jamSidang: "09:00:00",
  ruangan: "R1",
  agenda,
  ditunda: 0,
  sippDiperbarui: "",
  baris: { pihak: { penggugat: ["NAMA RAHASIA"] } },
});

const iso = (ms: number) => new Date(ms).toISOString();
async function tulisPerkara(tambah: Record<string, unknown> = {}, ms = jam) {
  await simpanKelompokPerkara(db, [perkara(tambah) as never], iso(ms));
}
async function tulisSidang(agenda: string, ms = jam, id = "2", perkaraId = "556") {
  await simpanJendelaSidang(db, { sidang: [sidangRekaan(id, perkaraId, agenda)] } as never, iso(ms));
}
const deps = (): DepsKabar => ({ db: async () => db, pengaturan: async () => pengaturan, sekarang: () => new Date(jam), tulisAletaMs: () => tulisAleta });

beforeEach(async () => {
  dbRute = db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-super";
  jam = T0;
  tulisAleta = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(jam);
  pasangPengaturan(false);
  aturUlangPembaruanCermin();
  aturTulisCerminTerakhir(0);
  buangSinggahPengaturanCermin();
  buangSinggahKesegaran();
  tandaiTulisan();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  aturUlangPembaruanCermin();
  aturTulisCerminTerakhir(0);
  await db.close();
  dbRute = null;
});

// ============================================================================
// A. helper
// ============================================================================
describe("A. kabarPerubahanDariCermin", () => {
  it("saklar Kabar perubahan MATI bawaan -> tidak aktif, apa pun isi cermin", async () => {
    await cerminSegar();
    await tulisPerkara();
    const k = await kabarPerubahanDariCermin(NOMOR, "", deps());
    expect(k).toMatchObject({ aktif: false, alasan: "saklar-mati", berubah: false, token: "", bagian: [] });
    expect(PENGATURAN_CERMIN_BAWAAN.layar.kabar).toBe(false);
  });

  it("nomor kosong, belum tercermin, atau cermin tertinggal -> tidak aktif dengan sebab", async () => {
    pasangPengaturan(true);
    expect((await kabarPerubahanDariCermin("  ", "", deps())).alasan).toBe("nomor-kosong");
    // pemindaian belum selesai = tertinggal
    await tulisPerkara();
    expect((await kabarPerubahanDariCermin(NOMOR, "", deps())).alasan).toBe("cermin-tertinggal");
    await cerminSegar();
    expect((await kabarPerubahanDariCermin("1/Pdt.G/2026/PA.Rekaan", "", deps())).alasan).toBe("belum-ada");
    jam += 20 * 60_000;
    vi.setSystemTime(jam);
    buangSinggahKesegaran();
    expect((await kabarPerubahanDariCermin(NOMOR, "", deps())).alasan).toBe("cermin-tertinggal");
  });

  it("tanya pertama hanya mengambil keadaan dasar; tanpa perubahan tidak ada kabar", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await tulisPerkara({}, T0 - 600_000);
    await tulisSidang("Pembuktian", T0 - 300_000);
    const a = await kabarPerubahanDariCermin(NOMOR, "", deps());
    expect(a).toMatchObject({ aktif: true, berubah: false, diubahPada: null, bagian: [], kemungkinanDariAleta: false });
    expect(a.token).toBe(iso(T0 - 300_000)); // terbaru antara perkara dan sidang
    const b = await kabarPerubahanDariCermin(NOMOR, a.token, deps());
    expect(b).toMatchObject({ aktif: true, berubah: false, token: a.token });
  });

  it("perubahan sidang -> kabar bagian sidang; perubahan perkara -> bagian perkara; keduanya -> dua bagian", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await tulisPerkara({}, T0 - 600_000);
    await tulisSidang("Pembuktian", T0 - 600_000);
    const dasar = (await kabarPerubahanDariCermin(NOMOR, "", deps())).token;

    await tulisSidang("Putusan", T0 - 120_000);
    const s = await kabarPerubahanDariCermin(NOMOR, dasar, deps());
    expect(s).toMatchObject({ berubah: true, bagian: ["sidang"], diubahPada: iso(T0 - 120_000), token: iso(T0 - 120_000) });

    await tulisPerkara({ tahapanTerakhirText: "Putusan", prosesTerakhirText: "Diputus" }, T0 - 60_000);
    const dua = await kabarPerubahanDariCermin(NOMOR, dasar, deps());
    expect(dua.bagian).toEqual(["perkara", "sidang"]);
    expect(dua.diubahPada).toBe(iso(T0 - 60_000));

    // Hanya perubahan sesudah `sejak` yang dikabarkan.
    const sejakBaru = await kabarPerubahanDariCermin(NOMOR, iso(T0 - 90_000), deps());
    expect(sejakBaru.bagian).toEqual(["perkara"]);
  });

  it("menulis ulang ISI yang sama tidak menjadi kabar (sidik sama = waktu tidak bergeser)", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await tulisPerkara({}, T0 - 600_000);
    await tulisSidang("Pembuktian", T0 - 600_000);
    const dasar = (await kabarPerubahanDariCermin(NOMOR, "", deps())).token;
    await tulisPerkara({}, T0 - 10_000);
    await tulisSidang("Pembuktian", T0 - 10_000);
    const k = await kabarPerubahanDariCermin(NOMOR, dasar, deps());
    expect(k).toMatchObject({ aktif: true, berubah: false, token: dasar });
  });

  it("sidang perkara lain tidak memengaruhi; `sejak` rusak dianggap tanya pertama", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await tulisPerkara({}, T0 - 600_000);
    await tulisSidang("Pembuktian", T0 - 600_000);
    const dasar = (await kabarPerubahanDariCermin(NOMOR, "", deps())).token;
    await tulisSidang("Perkara lain", T0 - 5_000, "9", "999");
    expect((await kabarPerubahanDariCermin(NOMOR, dasar, deps())).berubah).toBe(false);
    await tulisSidang("Putusan", T0 - 5_000);
    expect((await kabarPerubahanDariCermin(NOMOR, "kemarin", deps())).berubah).toBe(false);
    expect((await kabarPerubahanDariCermin(NOMOR, "'; DROP TABLE x;--", deps())).berubah).toBe(false);
  });

  it("kemungkinanDariAleta: perubahan dekat dengan tulisan ALETA terakhir -> true; jauh -> false", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await tulisPerkara({}, T0 - 900_000);
    const dasar = (await kabarPerubahanDariCermin(NOMOR, "", deps())).token;
    await tulisPerkara({ tahapanTerakhirText: "Putusan" }, T0 - 30_000);
    tulisAleta = T0 - 30_000 + JENDELA_DARI_ALETA_MS - 1000;
    expect((await kabarPerubahanDariCermin(NOMOR, dasar, deps())).kemungkinanDariAleta).toBe(true);
    tulisAleta = T0 - 30_000 + JENDELA_DARI_ALETA_MS + 5000;
    expect((await kabarPerubahanDariCermin(NOMOR, dasar, deps())).kemungkinanDariAleta).toBe(false);
    tulisAleta = 0; // belum ada tulisan lewat ALETA sama sekali
    expect((await kabarPerubahanDariCermin(NOMOR, dasar, deps())).kemungkinanDariAleta).toBe(false);
  });

  it("bentuk jawaban tertutup: tanpa nama pihak, nama petugas, atau isi dokumen", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await tulisPerkara({}, T0 - 600_000);
    await tulisSidang("Pembuktian", T0 - 600_000);
    const dasar = (await kabarPerubahanDariCermin(NOMOR, "", deps())).token;
    await tulisSidang("Putusan", T0 - 1000);
    const k = await kabarPerubahanDariCermin(NOMOR, dasar, deps());
    expect(Object.keys(k).sort()).toEqual(["aktif", "alasan", "bagian", "berubah", "diubahPada", "kemungkinanDariAleta", "token"]);
    expect(JSON.stringify(k)).not.toMatch(/RAHASIA|Hakim Rekaan|PP Rekaan|JS Rekaan/);
  });

  it("basis data rusak -> tidak aktif 'galat' (tidak pernah melempar)", async () => {
    pasangPengaturan(true);
    const rusak: DepsKabar = {
      db: async () => {
        throw new Error("db mati");
      },
      pengaturan: async () => pengaturan,
      sekarang: () => new Date(jam),
      tulisAletaMs: () => 0,
    };
    expect(await kabarPerubahanDariCermin(NOMOR, "", rusak)).toMatchObject({ aktif: false, alasan: "galat" });
  });
});

// ============================================================================
// B. rute
// ============================================================================
async function panggilKabar(query: string) {
  const modul = await import("@/app/api/aleta-ecourt/kabar-perubahan/route");
  const jawaban = await modul.GET(new NextRequest(`http://localhost/api/aleta-ecourt/kabar-perubahan?${query}`));
  return { status: jawaban.status, isi: (await jawaban.json()) as { data: { available: boolean; kabar: Record<string, unknown> } } };
}

describe("B. rute kabar-perubahan", () => {
  it("tanpa sesi 401; saklar mati -> tidak aktif; menyala -> dasar lalu kabar", async () => {
    aktor = null;
    expect((await panggilKabar(`nomor=${NOMOR}`)).status).toBe(401);
    aktor = "usr-super";
    pasangPengaturan(false);
    await simpanPengaturanDb();
    await cerminSegar();
    await tulisPerkara({}, T0 - 600_000);
    const mati = await panggilKabar(`nomor=${encodeURIComponent(NOMOR)}`);
    expect(mati.status).toBe(200);
    expect(mati.isi.data).toMatchObject({ available: true, kabar: { aktif: false, alasan: "saklar-mati" } });

    pasangPengaturan(true);
    await simpanPengaturanDb();
    const dasar = await panggilKabar(`nomor=${encodeURIComponent(NOMOR)}`);
    expect(dasar.isi.data.kabar).toMatchObject({ aktif: true, berubah: false });
    const token = String(dasar.isi.data.kabar.token);
    await tulisPerkara({ tahapanTerakhirText: "Putusan" }, T0 - 1000);
    const baru = await panggilKabar(`nomor=${encodeURIComponent(NOMOR)}&sejak=${encodeURIComponent(token)}`);
    expect(baru.isi.data.kabar).toMatchObject({ aktif: true, berubah: true, bagian: ["perkara"] });
  });

  it("sumber rute: kewenangan 'panel' dan hanya GET", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/kabar-perubahan/route.ts");
    expect(rute).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
    expect(rute).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
  });
});

// ============================================================================
// C. ekstensi (konten.js utuh di jsdom)
// ============================================================================
const EKS = path.resolve(process.cwd(), "../ekstensi-sipp");
const bacaEks = (b: string) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = bacaEks("konten.js");
const ALAT = bacaEks("panel-alat.js");
const BASMASSAL = bacaEks("basmassal.js");
const ASAL = "http://192.168.10.10";

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
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
    await tunggu(10);
  }
}

function konteksPenuh(nomor: string) {
  return {
    ok: true,
    nomorPerkara: nomor,
    nomorRegister: "PA.DGL-2026-0556",
    identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
    ringkasan: { dokumen: 0 },
    dokumen: [],
    selisih: [],
    nomorPihak: [],
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: 3,
    hakim: null,
  };
}

type Kabar = { aktif: boolean; token?: string; berubah?: boolean; diubahPada?: string | null; bagian?: string[]; kemungkinanDariAleta?: boolean };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaHalaman(jawab: { kabar: (url: string) => Kabar | number; mode?: string }) {
  const html = `<table id="submenus"><tr><td><a class="btn" href="#">Kembali</a></td></tr></table><div id="tabs1"><table class="data-umum"><tr><td id="first-child">Nomor Perkara</td><td colspan="2">${NOMOR}</td></tr><tr><td id="first-child">Jenis Perkara</td><td colspan="2">Cerai Gugat</td></tr></table></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${html}</div></body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;  
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      const bagian: string[] = [];
      const jalan = this.ownerDocument.createTreeWalker(this, 4);
      for (let n = jalan.nextNode(); n; n = jalan.nextNode()) bagian.push((n as Text).data);
      return bagian.join(" ");
    },
  });
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  w.AbortController = globalThis.AbortController;
  const simpanan: Record<string, unknown> = { ujiTampilan: jawab.mode ?? "ui", ujiIzinkanNyata: true };
  const pendengar: Array<(u: Record<string, unknown>, wilayah: string) => void> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
    },
    remove: async (kunci: string | string[]) => {
      for (const k of [kunci].flat()) delete simpanan[k];
    },
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.38" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: { local, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: (f: any) => void pendengar.push(f) } },  
  };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama: "Munifa, S.H.", peran: "Super Admin", kapabilitas: null } };
    } else if (url.includes("/aleta-bot/sipp-konteks/massal")) {
      isi = { ok: true, data: { available: true, perkara: {}, identitas: {} } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = { ok: true, data: { pengguna: { nama: "Munifa, S.H.", peran: "Super Admin" }, kapabilitas: null, available: true, konteks: konteksPenuh(NOMOR), keadaanCermin: null } };
    } else if (url.includes("/aleta-ecourt/kabar-perubahan?")) {
      const j = jawab.kabar(url);
      if (typeof j === "number") status = j;
      else isi = { ok: true, data: { available: true, kabar: j } };
    } else if (url.includes("/aleta-ecourt/status-perkara?")) {
      isi = { ok: true, data: { available: true, status: { majelis: [{ nama: "Munifa, S.H." }], panitera: [], jurusita: [], ikrar: null, putusan: { sudahPutus: false }, putusanLengkap: {}, penilaianSk: { rinci: [] }, tahapan: { terbaca: false, tahap: [] } } } };
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
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(KONTEN, ctx, { filename: "konten.js" });
  const picu = () => w.document.dispatchEvent(new w.Event("visibilitychange"));
  const kabarMinta = () => minta.filter((u) => u.includes("/kabar-perubahan?"));
  return { dom, w, d: w.document as Document, minta, picu, kabarMinta };
}

describe("C. ekstensi: pita kabar perubahan", () => {
  it("pertanyaan pertama mengambil keadaan dasar; perubahan sesudahnya memunculkan pita bertombol, Abaikan membuangnya", async () => {
    let berubah = false;
    const h = bukaHalaman({
      kabar: (url) =>
        berubah
          ? { aktif: true, token: "2026-10-25T14:03:00.000Z", berubah: true, diubahPada: "2026-10-25T14:03:00.000Z", bagian: ["sidang"], kemungkinanDariAleta: false }
          : { aktif: true, token: "2026-10-25T13:50:00.000Z", berubah: false, diubahPada: null, bagian: [], kemungkinanDariAleta: false },
    });
    await sampai(() => h.d.getElementById("aleta-panel-sipp"), "panel penuh");
    // Tanya pertama (tanpa sejak) -> dasar.
    await sampai(() => h.kabarMinta().length >= 1, "tanya pertama");
    expect(h.kabarMinta()[0]).not.toContain("sejak=");
    expect(h.d.getElementById("aleta-kabar")).toBeNull();

    // Berikutnya membawa dasar sebagai `sejak`; sesudah ada perubahan pita muncul.
    berubah = true;
    h.picu();
    const pita = await sampai(() => h.d.getElementById("aleta-kabar"), "pita kabar", 8000);
    expect(h.kabarMinta().at(-1)).toContain(`sejak=${encodeURIComponent("2026-10-25T13:50:00.000Z")}`);
    expect(pita.textContent).toContain("Jadwal sidang perkara ini berubah di SIPP pukul 22.03");
    expect(pita.textContent).toContain("Muat ulang halaman SIPP untuk melihatnya");
    const tombol = [...pita.querySelectorAll("button")].map((b) => b.textContent);
    expect(tombol).toEqual(["Muat ulang halaman", "Abaikan"]);
    // Pita di dalam panel, paling atas.
    expect(h.d.getElementById("aleta-panel-sipp")!.firstElementChild).toBe(pita);

    // Abaikan membuang pita.
    (pita.querySelectorAll("button")[1] as HTMLButtonElement).click();
    expect(h.d.getElementById("aleta-kabar")).toBeNull();
  });

  it("mungkin dari ALETA -> kalimat lunak tanpa menuduh orang lain", async () => {
    let berubah = false;
    const h = bukaHalaman({
      kabar: () =>
        berubah
          ? { aktif: true, token: "2026-10-25T14:03:00.000Z", berubah: true, diubahPada: "2026-10-25T14:03:00.000Z", bagian: ["perkara", "sidang"], kemungkinanDariAleta: true }
          : { aktif: true, token: "2026-10-25T13:50:00.000Z", berubah: false },
    });
    await sampai(() => h.kabarMinta().length >= 1, "tanya pertama");
    berubah = true;
    h.picu();
    const pita = await sampai(() => h.d.getElementById("aleta-kabar"), "pita kabar", 8000);
    expect(pita.textContent).toContain("Data perkara dan jadwal sidang berubah pukul 22.03 - mungkin dari tindakan di ALETA.");
    expect(pita.textContent).not.toMatch(/petugas|oleh /i);
  });

  it("tidak aktif (saklar mati / cermin tertinggal): tanpa pita dan TIDAK bertanya lagi sampai 5 menit", async () => {
    const h = bukaHalaman({ kabar: () => ({ aktif: false }) });
    await sampai(() => h.kabarMinta().length >= 1, "tanya pertama");
    await tunggu(50);
    const awal = h.kabarMinta().length;
    h.picu();
    h.picu();
    await tunggu(200);
    expect(h.kabarMinta().length).toBe(awal);
    expect(h.d.getElementById("aleta-kabar")).toBeNull();
  });

  it("tampilan Lama (Klasik) identik dengan sebelum fitur ini: tidak satu pun permintaan kabar", async () => {
    const h = bukaHalaman({ mode: "lama", kabar: () => ({ aktif: true, token: "2026-10-25T13:50:00.000Z", berubah: true, bagian: ["sidang"], diubahPada: "2026-10-25T14:03:00.000Z" }) });
    await sampai(() => h.d.getElementById("aleta-panel-sipp"), "panel tergambar");
    h.picu();
    await tunggu(300);
    expect(h.kabarMinta()).toEqual([]);
    expect(h.d.getElementById("aleta-kabar")).toBeNull();
  });

  it("portal menjawab galat (500): diam dan tidak memukul ulang", async () => {
    const h = bukaHalaman({ kabar: () => 500 });
    await sampai(() => h.kabarMinta().length >= 1, "tanya pertama");
    await tunggu(50);
    const awal = h.kabarMinta().length;
    h.picu();
    await tunggu(200);
    expect(h.kabarMinta().length).toBe(awal);
    expect(h.d.getElementById("aleta-kabar")).toBeNull();
    // Panel utama tetap tergambar.
    expect(h.d.getElementById("aleta-panel-sipp")).toBeTruthy();
  });
});

// ============================================================================
// D. penjaga teks
// ============================================================================
describe("D. penjaga", () => {
  it("pemantau ekstensi hanya MEMBACA: tidak ada tulis ke SIPP, tidak menyebut nama petugas", () => {
    const kode = baca("ekstensi-sipp/konten.js");
    const a = kode.indexOf("const JEDA_KABAR_MS");
    const b = kode.indexOf("function tampilkan(elemen) {", a);
    const badan = kode.slice(a, b);
    expect(badan).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"|\.submit\(|\.value\s*=/);
    expect(badan).not.toMatch(/aleta_cermin|baris_json|sidik/);
    expect(badan).toContain("document.visibilityState");
    expect(badan).toContain("JEDA_KABAR_MS");
  });

  it("saklar kabar tercantum di daftar layar cermin, MATI bawaan, dan ekstensi tertanam memuat pemantaunya", () => {
    const lib = baca("manajemen_surat/src/lib/cermin.ts");
    expect(lib).toMatch(/LAYAR_CERMIN = \["mediasi", "status", "jadwal", "ekstensi", "kabar"\]/);
    expect(lib).toContain("kabar: false");
    expect(baca("manajemen_surat/src/server/shared/ekstensi-berkas.ts")).toContain("kabarPeriksa");
  });
});
