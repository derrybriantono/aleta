// @vitest-environment node
/**
 * ============================================================================
 * CERMIN: "KEADAAN PERKARA" UNTUK PANEL EKSTENSI (A6, 25 Okt 2026)
 * ============================================================================
 *
 *   A. keadaanPerkaraDariCermin: saklar `ekstensi` MATI bawaan; satu baca Postgres; tanpa data
 *      pribadi pihak; tag hanya bila siklus lengkap; kembali ke jalur lama bila tertinggal / belum
 *      ada / baru ada tulisan;
 *   B. rute /api/aleta-ecourt/keadaan-perkara dan penyisipan `keadaanCermin` ke sipp-konteks
 *      (bot mati -> available:false TETAP memuat salinan); sipp-konteks lama tak berubah;
 *   C. EKSTENSI (konten.js dijalankan utuh di jsdom): bot tak menjawab + salinan cermin -> panel
 *      ringan bertanda "Cermin"; bot menjawab -> panel penuh menggantikannya; tanpa salinan ->
 *      perilaku lama (tidak ada panel); panel penuh tidak pernah ditimpa panel ringan.
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
import { KUNCI_JEJAK, tulisJejak } from "@/server/modules/cermin/jejak";
import { keadaanPerkaraDariCermin, type DepsKeadaanPerkara } from "@/server/modules/cermin/keadaan-perkara";
import { buangSinggahKesegaran } from "@/server/modules/cermin/kesegaran";
import { aturUlangPembaruanCermin } from "@/server/modules/cermin/pembaruan";
import { buangSinggahPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { simpanJendelaSidang, simpanKelompokPerkara } from "@/server/modules/cermin/penyimpan";
import { aturTulisCerminTerakhir } from "@/server/modules/cermin/setelah-tulisan";
import { gantiAnggotaTag } from "@/server/modules/cermin/tag";
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
const SEKARANG_MS = Date.parse("2026-10-25T14:00:00Z"); // 22.00 WITA, Minggu 25 Okt
let db: AletaDatabase;
let jam = SEKARANG_MS;
let pengaturan: PengaturanCermin;

function pasangPengaturan(layarEkstensi: boolean) {
  pengaturan = { ...PENGATURAN_CERMIN_BAWAAN, pemindaiAktif: true, layar: { ...PENGATURAN_CERMIN_BAWAAN.layar, ekstensi: layarEkstensi } };
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
async function isiPerkara() {
  await simpanKelompokPerkara(
    db,
    [
      {
        perkaraId: "556",
        nomorPerkara: NOMOR,
        jenisPerkaraId: 345,
        jenisPerkaraNama: "Cerai Gugat",
        alurPerkaraId: 15,
        tanggalPendaftaran: "2026-09-01",
        prodeo: 1,
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
      },
    ],
    new Date(jam).toISOString()
  );
  await simpanJendelaSidang(
    db,
    {
      sidang: [
        { sidangId: "1", perkaraId: "556", tanggalSidang: "2026-10-20", jamSidang: "09:00:00", ruangan: "R1", agenda: "Lama", ditunda: 0, sippDiperbarui: "", baris: {} },
        { sidangId: "2", perkaraId: "556", tanggalSidang: "2026-10-27", jamSidang: "09:00:00", ruangan: "R1", agenda: "Pembuktian", ditunda: 0, sippDiperbarui: "", baris: {} },
        { sidangId: "3", perkaraId: "556", tanggalSidang: "2026-11-03", jamSidang: "10:30:00", ruangan: "R2", agenda: "Putusan", ditunda: 1, sippDiperbarui: "", baris: { pihak: { penggugat: ["NAMA RAHASIA"] } } },
        { sidangId: "4", perkaraId: "999", tanggalSidang: "2026-10-28", jamSidang: "09:00:00", ruangan: "R1", agenda: "Perkara lain", ditunda: 0, sippDiperbarui: "", baris: {} },
      ],
    },
    new Date(jam).toISOString()
  );
}
const deps = (): DepsKeadaanPerkara => ({ db: async () => db, pengaturan: async () => pengaturan, sekarang: () => new Date(jam) });

beforeEach(async () => {
  dbRute = db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-super";
  jam = SEKARANG_MS;
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
describe("A. keadaanPerkaraDariCermin", () => {
  it("saklar Panel ekstensi MATI (bawaan) -> null, apa pun isi cermin", async () => {
    await cerminSegar();
    await isiPerkara();
    const alasan: string[] = [];
    expect(await keadaanPerkaraDariCermin(NOMOR, deps(), (a) => alasan.push(a))).toBeNull();
    expect(alasan).toEqual(["saklar-mati"]);
  });

  it("nomor kosong atau belum ada di cermin -> null dengan sebab", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await isiPerkara();
    const alasan: string[] = [];
    expect(await keadaanPerkaraDariCermin("  ", deps(), (a) => alasan.push(a))).toBeNull();
    expect(await keadaanPerkaraDariCermin("1/Pdt.G/2026/PA.Rekaan", deps(), (a) => alasan.push(a))).toBeNull();
    expect(alasan).toEqual(["nomor-kosong", "belum-ada"]);
  });

  it("segar + saklar menyala: ringkasan lengkap dari satu perkara, sidang mendatang dari cermin, tanpa data pribadi pihak", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await isiPerkara();
    const k = await keadaanPerkaraDariCermin(NOMOR, deps());
    expect(k).toMatchObject({
      perkaraId: "556",
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Gugat",
      prodeo: true,
      tahapan: "Persidangan",
      proses: "Sidang Pertama",
      majelis: "Hakim Rekaan, S.H.",
      panitera: "PP Rekaan",
      jurusita: "JS Rekaan",
      sidangTerakhir: "2026-10-20",
      sidangBerikut: "2026-10-27",
      jumlahSidang: 3,
      putusan: { tanggal: "", status: "", verstek: false, minutasi: "", bht: "" },
    });
    // Hanya sidang perkara INI pada atau setelah hari ini (WITA: 25 Okt), urut naik.
    expect(k!.sidangMendatang).toEqual([
      { tanggal: "2026-10-27", jam: "09:00", ruangan: "R1", agenda: "Pembuktian", ditunda: false },
      { tanggal: "2026-11-03", jam: "10:30", ruangan: "R2", agenda: "Putusan", ditunda: true },
    ]);
    expect(k!.diperbaruiPada).toBe(new Date(jam - 20_000).toISOString());
    // Tidak ada nama pihak/alamat/isi dokumen: bentuk hasilnya tertutup.
    expect(JSON.stringify(k)).not.toContain("NAMA RAHASIA");
    expect(Object.keys(k!).sort()).toEqual(
      [
        "alurPerkaraId", "diperbaruiPada", "jenisPerkara", "jenisPerkaraId", "jumlahSidang", "jurusita", "majelis", "nomorPerkara", "panitera", "perkaraId",
        "prodeo", "proses", "putusan", "sidangBerikut", "sidangMendatang", "sidangPertama", "sidangTerakhir", "sippDiperbarui", "tag", "tahapan", "tanggalPendaftaran",
      ].sort()
    );
  });

  it("penanda (tag) hanya bila siklus penanda lengkap dan segar; selain itu null (bukan daftar basi)", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await isiPerkara();
    expect((await keadaanPerkaraDariCermin(NOMOR, deps()))!.tag).toBeNull();
    await gantiAnggotaTag(db, "ghaib", ["556", "1"], "x");
    await gantiAnggotaTag(db, "prodeo", ["556"], "x");
    await gantiAnggotaTag(db, "verstek", ["2"], "x");
    await tulisJejak(db, KUNCI_JEJAK.tagKatalog, {
      tag: [
        { kunci: "ghaib", label: "Ghaib", kelompok: "pihak", nada: "info", judul: "", balik: false },
        { kunci: "prodeo", label: "Prodeo", kelompok: "pihak", nada: "info", judul: "", balik: false },
        { kunci: "verstek", label: "Verstek", kelompok: "putusan", nada: "info", judul: "", balik: false },
      ],
      kelompok: [],
      dasar: [],
      batasId: 20000,
    });
    await tulisJejak(db, KUNCI_JEJAK.tag, {
      siklusMulai: new Date(jam - 60_000).toISOString(),
      siklusSelesai: new Date(jam - 30_000).toISOString(),
      siklusSelesaiMulai: new Date(jam - 60_000).toISOString(),
      antrian: [],
      total: 3,
      tidakLengkap: [],
      gagal: [],
      kotorSejak: "",
      galat: { terakhir: "", pada: "", beruntun: 0 },
    });
    buangSinggahKesegaran();
    expect((await keadaanPerkaraDariCermin(NOMOR, deps()))!.tag).toEqual([
      { kunci: "ghaib", label: "Ghaib", nada: "info" },
      { kunci: "prodeo", label: "Prodeo", nada: "info" },
    ]);
  });

  it("cermin tertinggal (pembaruan 20 menit lalu) atau pemindaian belum selesai -> null", async () => {
    pasangPengaturan(true);
    await isiPerkara();
    const alasan: string[] = [];
    expect(await keadaanPerkaraDariCermin(NOMOR, deps(), (a, r) => alasan.push(`${a}:${r}`))).toBeNull();
    expect(alasan[0]).toContain("cermin-tertinggal:pemindaian awal belum selesai");
    await cerminSegar();
    jam += 20 * 60_000;
    vi.setSystemTime(jam);
    buangSinggahKesegaran();
    expect(await keadaanPerkaraDariCermin(NOMOR, deps(), (a, r) => alasan.push(`${a}:${r}`))).toBeNull();
    expect(alasan[1]).toContain("pembaruan terakhir");
  });

  it("baca tulisan sendiri: ada tulisan lewat ALETA yang belum tercermin -> null (panel memakai jalur lama)", async () => {
    pasangPengaturan(true);
    await cerminSegar();
    await isiPerkara();
    aturTulisCerminTerakhir(Date.now() + 1);
    const alasan: string[] = [];
    expect(await keadaanPerkaraDariCermin(NOMOR, deps(), (a, r) => alasan.push(`${a}:${r}`))).toBeNull();
    expect(alasan[0]).toContain("menunggu tulisan terakhir masuk cermin");
  });

  it("basis data rusak -> null (tidak pernah melempar)", async () => {
    const rusak: DepsKeadaanPerkara = {
      db: async () => {
        throw new Error("db mati");
      },
      pengaturan: async () => ({ ...pengaturan, layar: { ...pengaturan.layar, ekstensi: true } }),
      sekarang: () => new Date(jam),
    };
    const alasan: string[] = [];
    expect(await keadaanPerkaraDariCermin(NOMOR, rusak, (a) => alasan.push(a))).toBeNull();
    expect(alasan).toEqual(["galat"]);
  });
});

// ============================================================================
// B. rute
// ============================================================================
async function panggilKeadaan(query: string) {
  const modul = await import("@/app/api/aleta-ecourt/keadaan-perkara/route");
  const jawaban = await modul.GET(new NextRequest(`http://localhost/api/aleta-ecourt/keadaan-perkara?${query}`));
  return { status: jawaban.status, isi: (await jawaban.json()) as { data: Record<string, any> } };  
}
async function panggilKonteks(query: string) {
  const modul = await import("@/app/api/aleta-bot/sipp-konteks/route");
  const jawaban = await modul.GET(new NextRequest(`http://localhost/api/aleta-bot/sipp-konteks?${query}`));
  return { status: jawaban.status, isi: (await jawaban.json()) as { data: Record<string, any> } };  
}

describe("B. rute keadaan-perkara dan sipp-konteks", () => {
  it("keadaan-perkara: tanpa sesi 401, pegawai tanpa hak panel ditolak, saklar mati -> cermin null + alasan", async () => {
    aktor = null;
    expect((await panggilKeadaan(`nomor=${NOMOR}`)).status).toBe(401);
    aktor = "usr-super";
    pasangPengaturan(false);
    await simpanPengaturanDb();
    await cerminSegar();
    await isiPerkara();
    const mati = await panggilKeadaan(`nomor=${encodeURIComponent(NOMOR)}`);
    expect(mati.status).toBe(200);
    expect(mati.isi.data).toMatchObject({ available: true, cermin: null, alasan: "saklar-mati" });
    pasangPengaturan(true);
    await simpanPengaturanDb();
    const nyala = await panggilKeadaan(`nomor=${encodeURIComponent(NOMOR)}`);
    expect(nyala.isi.data.cermin).toMatchObject({ nomorPerkara: NOMOR, tahapan: "Persidangan" });
    expect(nyala.isi.data.alasan).toBe("");
  });

  function botKonteks(ok: boolean) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (masuk: string) => {
        const url = new URL(String(masuk));
        if (!url.pathname.endsWith("/sipp/konteks") && !url.pathname.includes("/sipp/")) return new Response("{}", { status: 404 });
        if (!ok) return new Response(JSON.stringify({ ok: false, error: "SIPP tidak menjawab" }), { status: 500, headers: { "content-type": "application/json" } });
        return new Response(JSON.stringify({ ok: true, nomorPerkara: NOMOR, identitas: { ditemukan: true } }), { status: 200, headers: { "content-type": "application/json" } });
      })
    );
  }

  it("sipp-konteks: bot menjawab -> bentuk lama tetap, plus keadaanCermin (null saat saklar mati)", async () => {
    botKonteks(true);
    pasangPengaturan(false);
    await simpanPengaturanDb();
    await cerminSegar();
    await isiPerkara();
    const a = await panggilKonteks(`nomor=${encodeURIComponent(NOMOR)}`);
    expect(a.status).toBe(200);
    expect(a.isi.data).toMatchObject({ available: true, konteks: { ok: true, nomorPerkara: NOMOR }, keadaanCermin: null });
    expect(a.isi.data.pengguna).toBeDefined();
    expect(a.isi.data.kapabilitas).toBeDefined();
    pasangPengaturan(true);
    await simpanPengaturanDb();
    const b = await panggilKonteks(`nomor=${encodeURIComponent(NOMOR)}`);
    expect(b.isi.data.konteks.ok).toBe(true);
    expect(b.isi.data.keadaanCermin).toMatchObject({ nomorPerkara: NOMOR, majelis: "Hakim Rekaan, S.H." });
  });

  it("sipp-konteks: bot MATI -> available:false TETAP memuat salinan cermin; tanpa salinan -> keadaanCermin null", async () => {
    botKonteks(false);
    pasangPengaturan(true);
    await simpanPengaturanDb();
    await cerminSegar();
    await isiPerkara();
    const a = await panggilKonteks(`nomor=${encodeURIComponent(NOMOR)}`);
    expect(a.isi.data).toMatchObject({ available: false, konteks: null, keadaanCermin: { nomorPerkara: NOMOR } });
    const b = await panggilKonteks(`nomor=${encodeURIComponent("9/Pdt.G/2026/PA.Rekaan")}`);
    expect(b.isi.data).toMatchObject({ available: false, konteks: null, keadaanCermin: null });
  });

  it("sipp-konteks tanpa nomor: jawaban lama utuh", async () => {
    const r = await panggilKonteks("nomor=");
    expect(r.isi.data).toMatchObject({ available: true, konteks: null, alasan: "nomor_perkara_kosong" });
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

const KEADAAN_CERMIN = {
  perkaraId: "556",
  nomorPerkara: NOMOR,
  jenisPerkara: "Cerai Gugat",
  prodeo: false,
  tahapan: "Persidangan",
  proses: "Sidang Pertama",
  majelis: "Hakim Rekaan, S.H.",
  panitera: "PP Rekaan",
  jurusita: "JS Rekaan",
  sidangTerakhir: "2026-10-20",
  sidangBerikut: "2026-10-27",
  jumlahSidang: 3,
  sidangMendatang: [{ tanggal: "2026-10-27", jam: "09:00", ruangan: "R1", agenda: "Pembuktian", ditunda: false }],
  putusan: { tanggal: "", status: "", verstek: false, minutasi: "", bht: "" },
  tag: [{ kunci: "ghaib", label: "Ghaib", nada: "info" }],
  diperbaruiPada: "2026-10-25T14:03:00.000Z", // 22.03 WITA
  sippDiperbarui: "",
};

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

type Jawaban = (nomor: string) => { available: boolean; message?: string; konteks: unknown; keadaanCermin?: unknown };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaHalaman(jawaban: { sekarang: Jawaban }) {
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
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true };
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
      const nomor = decodeURIComponent((/nomor(?:Perkara)?=([^&]+)/.exec(url) || [])[1] || "");
      isi = { ok: true, data: { pengguna: { nama: "Munifa, S.H.", peran: "Super Admin" }, kapabilitas: null, ...jawaban.sekarang(nomor) } };
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
  return { dom, w, d: w.document as Document, minta };
}

describe("C. ekstensi: panel ringan dari cermin", () => {
  it("bot tak menjawab + salinan cermin: panel ringan bertanda 'Cermin' dengan keadaan perkara, tanpa menu tindakan", async () => {
    const h = bukaHalaman({
      sekarang: () => ({ available: false, message: "ALETA Bot belum dapat dihubungi.", konteks: null, keadaanCermin: KEADAAN_CERMIN }),
    });
    const panel = (await sampai(() => h.d.querySelector("#aleta-panel-sipp[data-cermin]"), "panel ringan dari cermin")) as HTMLElement;
    const teks = panel.textContent || "";
    expect(teks).toContain("Cermin · diperbarui 22.03");
    expect(teks).toContain("ALETA Bot belum dapat dihubungi.");
    expect(teks).toContain("Persidangan — Sidang Pertama");
    expect(teks).toContain("Majelis: Hakim Rekaan, S.H.");
    expect(teks).toContain("PP: PP Rekaan");
    expect(teks).toContain("Berikut: 2026-10-27 09:00 (Pembuktian)");
    expect(teks).toContain("3 kali bersidang");
    expect(teks).toContain("Ghaib");
    // Hanya baca: tidak ada tombol tindakan penulis.
    expect(panel.querySelectorAll("button").length).toBeLessThanOrEqual(6);
    expect(panel.querySelector('[data-testid="tanda-cermin-panel"]')).toBeTruthy();
  });

  it("bot kembali menjawab: panel PENUH menggantikan panel ringan pada penyegaran berikutnya", async () => {
    let botHidup = false;
    const h = bukaHalaman({
      sekarang: (nomor) =>
        botHidup ? { available: true, konteks: konteksPenuh(nomor), keadaanCermin: KEADAAN_CERMIN } : { available: false, message: "bot mati", konteks: null, keadaanCermin: KEADAAN_CERMIN },
    });
    await sampai(() => h.d.querySelector("#aleta-panel-sipp[data-cermin]"), "panel ringan");
    botHidup = true;
    // Memicu penyegaran: halaman SIPP berubah (pengamat ekstensi menyegarkan panel).
    h.d.body.appendChild(h.d.createElement("div"));
    await sampai(() => {
      const p = h.d.getElementById("aleta-panel-sipp");
      return p && !p.hasAttribute("data-cermin") ? p : null;
    }, "panel penuh menggantikan panel ringan", 10000);
  });

  it("tanpa salinan cermin (saklar mati / cermin tertinggal): perilaku lama - tidak ada panel", async () => {
    const h = bukaHalaman({ sekarang: () => ({ available: false, message: "bot mati", konteks: null, keadaanCermin: null }) });
    await sampai(() => h.minta.some((u) => u.includes("/aleta-bot/sipp-konteks?")), "sipp-konteks ditanya");
    await tunggu(300);
    expect(h.d.getElementById("aleta-panel-sipp")).toBeNull();
  });

  it("bot menjawab sejak awal: panel penuh, bukan panel ringan", async () => {
    const h = bukaHalaman({ sekarang: (nomor) => ({ available: true, konteks: konteksPenuh(nomor), keadaanCermin: KEADAAN_CERMIN }) });
    const panel = await sampai(() => h.d.getElementById("aleta-panel-sipp"), "panel penuh");
    expect(panel.hasAttribute("data-cermin")).toBe(false);
    expect(panel.textContent).not.toContain("Cermin · diperbarui");
  });
});

// ============================================================================
// D. penjaga teks
// ============================================================================
describe("D. penjaga: ekstensi hanya membaca dari cermin dan tidak menulis tanda ke SIPP", () => {
  it("konten.js: susunPanelCermin tidak menulis ke SIPP dan tidak memuat label teknis", () => {
    const kode = baca("ekstensi-sipp/konten.js");
    const a = kode.indexOf("function susunPanelCermin(");
    const badan = kode.slice(a, kode.indexOf("function susunPanelDitolak(", a));
    expect(badan).not.toMatch(/fetch\(|XMLHttpRequest|\.submit\(|\.value\s*=/);
    expect(badan).not.toMatch(/aleta_cermin|baris_json|sidik/);
    expect(badan).toContain("Cermin · diperbarui");
  });

  it("jawaban sipp-konteks hanya MENAMBAH ruas (tidak ada yang dihapus): konteks, pengguna, kapabilitas tetap", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-bot/sipp-konteks/route.ts");
    // 30 Okt 2026: konteks menyalin seluruh hasil.data lalu MENAMBAH statusEcourt (status akun e-Court satu sumber).
    for (const ruas of ["konteks: hasil.data", "...hasil.data,", "statusEcourt:", "pengguna: {", "bolehUnggahPutusan: bolehUnggahPutusan(actor)", "golonganMenu: golonganMenuEkstensi(actor)", "kapabilitas,"]) {
      expect(rute, ruas).toContain(ruas);
    }
    expect(rute).toContain("keadaanCermin");
  });

  it("hasil tanam ekstensi di portal = berkas asli (konten.js)", () => {
    const tertanam = baca("manajemen_surat/src/server/shared/ekstensi-berkas.ts");
    expect(tertanam).toContain("susunPanelCermin");
  });
});
