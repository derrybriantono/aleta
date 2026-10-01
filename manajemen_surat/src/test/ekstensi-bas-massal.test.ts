// @vitest-environment node
/**
 * ============================================================================
 * BAS MASSAL (PERBAIKAN 30 SEP 2026 SORE, BUTIR U4 - AGEN M, KONTRAK K4)
 * ============================================================================
 *
 * Tiga lapis, semuanya DIJALANKAN - bukan menyisir teks sumber:
 *
 *   A. susun.ts        aturan murni: kehadiran di nama blangko, usulan blangko
 *                      hanya bila cocok, saringan PP, satu baris per perkara.
 *   B. rute GET        /aleta-ecourt/bas-massal dengan bot dan basis data
 *                      dipalsukan: 400/502, saringan bawaan menurut peran,
 *                      jadwal dibaca LANGSUNG dari bot (bukan rute /sidang yang
 *                      menulis rekaman antrian).
 *   C. basmassal.js    panel-alat.js + basmassal.js sebagai satu skrip di jsdom
 *                      (SIPP daftar perkara dan beranda ABT): Lama tidak
 *                      menggambar, peran, TIDAK ADA permintaan non-GET sama
 *                      sekali, tidak ada yang tercentang sendiri, beruntun
 *                      pratinjau -> unduh, halangan dilewati, Buka di ABT lewat
 *                      POST main/cari ABT sendiri yang tunduk mode coba.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cocokKehadiran,
  kehadiranDiNama,
  pilihBlangkoBas,
  susunBarisBasMassal,
  type KatalogFolder,
} from "@/app/api/aleta-ecourt/bas-massal/susun";
import { SET_BLANGKO } from "@/lib/pohon-blangko";

const folderSet = (id: string) => SET_BLANGKO.find((s) => s.id === id)!.folder;
const VERSTEK = folderSet("bas-verstek");
const CONTRA = folderSet("bas-contra");
const ITSBAT = folderSet("bas-itsbat");

const item = (berkas: string, basKe: number, keadaan: string, tindakan = "") => ({ berkas, basKe, keadaan, tindakan, judul: berkas });
const KATALOG_VERSTEK = [
  item("[01] BAS 1 P Hadir & T Tidak Hadir - Mediasi Tidak Dapat.rtf", 1, "P Hadir & T Tidak Hadir", "Mediasi Tidak Dapat"),
  item("[02] BAS 2 P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek.rtf", 2, "P Hadir & T Tidak Hadir Pokok Perkara", "Putusan Verstek"),
  item("[02a] BAS 2 P & T Tidak Hadir - Gugur.rtf", 2, "P & T Tidak Hadir", "Gugur"),
];
const KATALOG_CONTRA = [
  item("[01] BAS 1 P & T Hadir - Mediasi.rtf", 1, "P & T Hadir", "Mediasi"),
  item("[02] BAS 2 P & T Hadir - Jawaban.rtf", 2, "P & T Hadir", "Jawaban"),
];
const katalogBaku = (): Record<string, KatalogFolder> => ({
  [VERSTEK]: { terbaca: true, sebab: "", blangko: KATALOG_VERSTEK },
  [CONTRA]: { terbaca: true, sebab: "", blangko: KATALOG_CONTRA },
});

// ============================================================================
// A. ATURAN MURNI
// ============================================================================
describe("A. susun.ts - kehadiran, usulan blangko, saringan", () => {
  it("kehadiran di nama blangko: berdua, satu-satu, dan tidak disebut", () => {
    expect(kehadiranDiNama("P Hadir & T Tidak Hadir Pokok Perkara")).toEqual({ p: true, t: false });
    expect(kehadiranDiNama("P & T Hadir")).toEqual({ p: true, t: true });
    expect(kehadiranDiNama("P & T Tidak Hadir")).toEqual({ p: false, t: false });
    expect(kehadiranDiNama("P Tidak Hadir & T Hadir")).toEqual({ p: false, t: true });
    expect(kehadiranDiNama("Pembuktian")).toEqual({ p: null, t: null });
  });

  it("cocokKehadiran memakai sandi dihadiri_oleh SIPP (1 semua, 2 pihak pertama, 3 pihak kedua, 4 tidak ada)", () => {
    expect(cocokKehadiran("P Hadir & T Tidak Hadir", 2)).toBe("cocok");
    expect(cocokKehadiran("P Hadir & T Tidak Hadir", 1)).toBe("bertentangan");
    expect(cocokKehadiran("P & T Hadir", 1)).toBe("cocok");
    expect(cocokKehadiran("P & T Tidak Hadir", 4)).toBe("cocok");
    expect(cocokKehadiran("P & T Hadir", null)).toBe("tidak-diketahui");
    expect(cocokKehadiran("Pembuktian", 2)).toBe("tidak-diketahui");
  });

  it("cerai gugat sidang ke-2, hanya P hadir: usulan verstek BAS 2 yang cocok; contra tetap ditawarkan di belakang", () => {
    const h = pilihBlangkoBas({ jenisPerkara: "Cerai Gugat", urutanSidang: 2, dihadiriOleh: 2, katalog: katalogBaku() });
    expect(h.usulan?.berkas).toBe(KATALOG_VERSTEK[1].berkas);
    expect(h.usulan?.folder).toBe(VERSTEK);
    expect(h.usulan?.basKe).toBe(2);
    expect(h.pilihan.every((p) => p.basKe === 2)).toBe(true);
    expect(h.pilihan.map((p) => p.setId)).toEqual(["bas-verstek", "bas-verstek", "bas-contra"]);
    expect(h.sebab).toBe("");
  });

  it("tergugat hadir: set contra lebih dulu dan diusulkan", () => {
    const h = pilihBlangkoBas({ jenisPerkara: "Cerai Talak", urutanSidang: 1, dihadiriOleh: 1, katalog: katalogBaku() });
    expect(h.usulan?.folder).toBe(CONTRA);
    expect(h.usulan?.berkas).toBe(KATALOG_CONTRA[0].berkas);
  });

  it("kehadiran belum dicatat: TIDAK ADA usulan, pilihan tetap ditawarkan, sebab disebut", () => {
    const h = pilihBlangkoBas({ jenisPerkara: "Cerai Gugat", urutanSidang: 2, dihadiriOleh: null, katalog: katalogBaku() });
    expect(h.usulan).toBeNull();
    expect(h.pilihan.length).toBe(3);
    expect(h.sebab).toMatch(/belum dicatat/);
  });

  it("jenis tanpa set BAS, urutan 0, jenjang kosong, katalog tidak terbaca - semuanya menyebut sebab, tanpa usulan", () => {
    expect(pilihBlangkoBas({ jenisPerkara: "Harta Bersama", urutanSidang: 2, dihadiriOleh: 1, katalog: katalogBaku() }).sebab).toMatch(
      /belum punya set blangko BAS/
    );
    expect(pilihBlangkoBas({ jenisPerkara: "Cerai Gugat", urutanSidang: 0, dihadiriOleh: 1, katalog: katalogBaku() }).sebab).toMatch(
      /Urutan sidang/
    );
    expect(pilihBlangkoBas({ jenisPerkara: "Cerai Gugat", urutanSidang: 7, dihadiriOleh: 1, katalog: katalogBaku() }).sebab).toMatch(
      /Tidak ada blangko "BAS 7"/
    );
    const gagal = pilihBlangkoBas({
      jenisPerkara: "Istbat Nikah",
      urutanSidang: 1,
      dihadiriOleh: 1,
      katalog: { [ITSBAT]: { terbaca: false, sebab: "Folder blangko tidak ditemukan.", blangko: [] } },
    });
    expect(gagal.usulan).toBeNull();
    expect(gagal.sebab).toMatch(/Katalog blangko tidak terbaca.*Folder blangko tidak ditemukan/);
  });

  it("satu baris per perkara; saringan 'saya' menurut PP (nama tanpa gelar); jumlah semua tetap dihitung", () => {
    const sidang = [
      { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", perkaraId: "11", jenisPerkara: "Cerai Gugat", urutanSidang: 2, dihadiriOleh: 2, adaBas: false, paniteraNama: "Siti Aminah, S.H." },
      { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", perkaraId: "11", jenisPerkara: "Cerai Gugat", urutanSidang: 3, dihadiriOleh: 2, adaBas: false, paniteraNama: "Siti Aminah, S.H." },
      { nomorPerkara: "2/Pdt.G/2026/PA.Dgl", perkaraId: "12", jenisPerkara: "Cerai Gugat", urutanSidang: 1, dihadiriOleh: 1, adaBas: true, paniteraNama: "Budi Santoso" },
    ];
    const saya = susunBarisBasMassal(sidang, { namaAkun: "Siti Aminah", saringan: "saya", katalog: katalogBaku(), lembar: { "11": { jumlah: 2, selesai: 1, draf: 1 } } });
    expect(saya.jumlahSemua).toBe(2);
    expect(saya.jumlahSaya).toBe(1);
    expect(saya.baris.map((b) => b.nomorPerkara)).toEqual(["1/Pdt.G/2026/PA.Dgl"]);
    expect(saya.baris[0]).toMatchObject({ urutanSidang: 2, basSipp: false, milikSaya: true, lembar: { jumlah: 2, selesai: 1 } });
    const semua = susunBarisBasMassal(sidang, { namaAkun: "Siti Aminah", saringan: "semua", katalog: katalogBaku(), lembar: {} });
    expect(semua.baris.map((b) => b.basSipp)).toEqual([false, true]);
    // Lembar tidak terbaca (tidak ada kuncinya) = null, BUKAN nol.
    expect(semua.baris[1].lembar).toBeNull();
    // Bot lama tanpa adaBas = null, bukan "belum".
    expect(susunBarisBasMassal([{ nomorPerkara: "3/Pdt.G/2026/PA.Dgl" }], { namaAkun: "", saringan: "semua", katalog: {}, lembar: {} }).baris[0].basSipp).toBeNull();
  });
});

// ============================================================================
// B. RUTE GET /aleta-ecourt/bas-massal
// ============================================================================
const rute = vi.hoisted(() => ({
  aktor: { name: "Siti Aminah", roleId: "panitera-pengganti" } as Record<string, unknown>,
  jadwal: { ok: true, data: { sidang: [] as unknown[] } } as { ok: boolean; data?: { sidang: unknown[] }; error?: string },
  jadwalDiminta: [] as unknown[],
  jembatan: [] as Array<{ operation: string; params: Record<string, unknown> }>,
  kueri: [] as Array<{ sql: string; params: unknown[] }>,
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    queryAll: async (sql: string, params: unknown[]) => {
      rute.kueri.push({ sql, params });
      return String(params[0]) === "11" ? [{ keadaan: "selesai" }, { keadaan: "draf" }] : [];
    },
  }),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => rute.aktor }));
vi.mock("@/lib/permissions", () => ({
  isPrivilegedAdmin: (u: { roleId?: string } | null) => u?.roleId === "admin" || u?.roleId === "super-admin",
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayJadwalSidang: async (p: unknown) => {
    rute.jadwalDiminta.push(p);
    return rute.jadwal;
  },
}));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: async (operation: string, params: Record<string, unknown>) => {
    rute.jembatan.push({ operation, params });
    const f = String(params.folder ?? "");
    if (f === VERSTEK_HOIST()) return { ok: true, data: { ada: true, blangko: KATALOG_VERSTEK } };
    if (f === CONTRA_HOIST()) return { ok: true, data: { ada: true, blangko: KATALOG_CONTRA } };
    return { ok: true, data: { ada: false, sebab: "Folder blangko tidak ditemukan." } };
  },
}));
// Folder dibaca saat dipanggil (bukan saat mock diangkat ke atas berkas).
function VERSTEK_HOIST() {
  return VERSTEK;
}
function CONTRA_HOIST() {
  return CONTRA;
}

async function jalankanRute(kueri = "") {
  const mod = await import("@/app/api/aleta-ecourt/bas-massal/route");
  const permintaan = { nextUrl: new URL(`http://uji.local/api/aleta-ecourt/bas-massal${kueri}`) };
  const r = await mod.GET(permintaan as unknown as Parameters<typeof mod.GET>[0]);
  return { status: r.status, isi: (await r.json()) as { ok: boolean; alasan?: string; data?: any } };
}

const SIDANG_RUTE = [
  { sidangId: "501", perkaraId: "11", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", urutanSidang: 2, dihadiriOleh: 2, adaBas: false, paniteraNama: "Siti Aminah, S.H.", saksiPihak1: 2, saksiPihak2: 0, saksiNamaPihak1: ["A", "B"], saksiNamaPihak2: [] },
  { sidangId: "502", perkaraId: "12", nomorPerkara: "2/Pdt.P/2026/PA.Dgl", jenisPerkara: "Istbat Nikah", urutanSidang: 1, dihadiriOleh: 1, adaBas: true, paniteraNama: "Budi Santoso" },
];

describe("B. rute GET bas-massal", () => {
  beforeEach(() => {
    rute.aktor = { name: "Siti Aminah", roleId: "panitera-pengganti" };
    rute.jadwal = { ok: true, data: { sidang: SIDANG_RUTE } };
    rute.jadwalDiminta = [];
    rute.jembatan = [];
    rute.kueri = [];
  });

  it("tanggal salah bentuk: 400, jadwal tidak diminta", async () => {
    const r = await jalankanRute("?tanggal=30-09-2026");
    expect(r.status).toBe(400);
    expect(r.isi.ok).toBe(false);
    expect(rute.jadwalDiminta).toEqual([]);
  });

  it("bot tidak menjawab: 502 beserta sebabnya, bukan daftar kosong", async () => {
    rute.jadwal = { ok: false, error: "ALETA Bot tidak terjangkau" };
    const r = await jalankanRute("?tanggal=2026-09-30");
    expect(r.status).toBe(502);
    expect(r.isi.alasan).toBe("ALETA Bot tidak terjangkau");
  });

  it("panitera: bawaan 'saya' - hanya perkara PP-nya; katalog & lembar hanya untuk yang tampil; jadwal langsung dari bot", async () => {
    const r = await jalankanRute("?tanggal=2026-09-30");
    expect(r.status).toBe(200);
    const d = r.isi.data;
    expect(d).toMatchObject({ tanggal: "2026-09-30", saringan: "saya", lihatSemua: false, jumlahSemua: 2, jumlahSaya: 1 });
    expect(d.sidang.map((s: { nomorPerkara: string }) => s.nomorPerkara)).toEqual(["1/Pdt.G/2026/PA.Dgl"]);
    expect(d.sidang[0].blangko.usulan.berkas).toBe(KATALOG_VERSTEK[1].berkas);
    expect(d.sidang[0].lembar).toEqual({ jumlah: 2, selesai: 1, draf: 1 });
    expect(rute.jadwalDiminta).toEqual([{ dari: "2026-09-30", sampai: "2026-09-30", cari: "", batas: 300 }]);
    // Katalog itsbat tidak dibaca - perkaranya tidak tampil.
    expect(rute.jembatan.map((j) => j.params.folder).sort()).toEqual([CONTRA, VERSTEK].sort());
    expect(rute.jembatan.every((j) => j.operation === "blangko.katalog")).toBe(true);
    expect(rute.kueri.map((k) => k.params)).toEqual([["11"]]);
    expect(rute.kueri.every((k) => /^SELECT /.test(k.sql.trim()))).toBe(true);
    // K4 (1 Okt): tiap baris membawa pemilik kerjanya; panitera tidak dikelompokkan.
    expect(d.sidang[0].pengguna).toEqual({ id: "siti aminah", nama: "Siti Aminah, S.H." });
    expect(d.kelompokPerUser).toBe(false);
  });

  it("admin: bawaan 'semua'; katalog itsbat yang tidak ada disebut sebagai sebab", async () => {
    rute.aktor = { name: "Administrator", roleId: "admin" };
    const r = await jalankanRute("?tanggal=2026-09-30");
    const d = r.isi.data;
    expect(d.saringan).toBe("semua");
    expect(d.lihatSemua).toBe(true);
    expect(d.sidang).toHaveLength(2);
    expect(d.sidang[1].blangko.usulan).toBeNull();
    expect(d.sidang[1].blangko.sebab).toMatch(/Folder blangko tidak ditemukan/);
    expect(d.katalog[ITSBAT]).toEqual({ terbaca: false, sebab: "Folder blangko tidak ditemukan." });
    // K4 (1 Okt): admin yang melihat semua PP -> kelompokPerUser, pengguna per baris.
    expect(d.kelompokPerUser).toBe(true);
    expect(d.sidang.map((s: { pengguna: { id: string } }) => s.pengguna.id)).toEqual(["siti aminah", "budi santoso"]);
    const saya = await jalankanRute("?tanggal=2026-09-30&saringan=saya");
    expect(saya.isi.data.kelompokPerUser).toBe(false);
  });

  it("saringan yang diminta menang atas bawaan", async () => {
    const r = await jalankanRute("?tanggal=2026-09-30&saringan=semua");
    expect(r.isi.data.saringan).toBe("semua");
    expect(r.isi.data.sidang).toHaveLength(2);
  });
});

// ============================================================================
// C. basmassal.js DI JSDOM
// ============================================================================
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
// ALETA_UJI_BASMASSAL hanya dipakai pembukti gigitan: cacat dipasang pada SALINAN.
const SUMBER_BAS = process.env.ALETA_UJI_BASMASSAL
  ? readFileSync(process.env.ALETA_UJI_BASMASSAL, "utf8").replace(/\r\n/g, "\n")
  : baca("basmassal.js");

const ASAL = "http://192.168.10.10";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 4000): Promise<NonNullable<T>> {
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

const PP = { nama: "Siti Aminah", peran: "Panitera Pengganti", roleId: "panitera-pengganti", peranTambahan: [] };

function barisPanel(tambahan: Record<string, unknown> = {}) {
  const pilihan = [
    { folder: VERSTEK, berkas: KATALOG_VERSTEK[1].berkas, setId: "bas-verstek", setNama: "BAS Verstek Perceraian", basKe: 2, label: "P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek", kehadiran: "cocok" },
    { folder: VERSTEK, berkas: KATALOG_VERSTEK[2].berkas, setId: "bas-verstek", setNama: "BAS Verstek Perceraian", basKe: 2, label: "P & T Tidak Hadir - Gugur", kehadiran: "bertentangan" },
  ];
  return {
    sidangId: "501",
    perkaraId: "11",
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    tanggalSidang: "2026-09-30",
    jamSidang: "09:00",
    agenda: "Pembuktian",
    ruangan: "",
    ditunda: false,
    sudahPutus: false,
    urutanSidang: 2,
    dihadiriOleh: 2,
    kehadiran: "hanya pihak pertama hadir",
    basSipp: false,
    paniteraNama: "Siti Aminah, S.H.",
    majelisNama: "",
    milikSaya: true,
    saksi: { pihak1: 2, pihak2: 0, nama1: ["A", "B"], nama2: [] },
    lembar: { jumlah: 2, selesai: 1, draf: 1 },
    blangko: { usulan: pilihan[0], pilihan, sebab: "" },
    ...tambahan,
  };
}

type PilihanDom = {
  mode?: "lama" | "baru" | "ui";
  situs?: "sipp" | "abt";
  siapa?: typeof PP | Record<string, unknown> | null;
  sidang?: unknown[];
  periksa?: Record<string, unknown> | ((url: string) => Record<string, unknown>);
  simpanan?: Record<string, unknown>;
  html?: string;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

const HTML_ABT = `
<div id="navbar" class="pricing_inner_w3ls navbar">
  <button class="accordion">Berita Acara</button>
  <div class="panel"><a href="${ASAL}/aps_badilag/abt/main/beranda?a=ENC_KEL_VERSTEK&c=">BAS VERSTEK PERCERAIAN</a>
  <a href="${ASAL}/aps_badilag/abt/main/beranda?a=ENC_KEL_PUTUSAN&c=">1 Perceraian CG</a></div>
</div>
<div class="col-md-4 pricing_inner_w3ls">
  <div class="pricing-top"><h3>- BAS VERSTEK PERCERAIAN -<br>Cerai Gugat - 1/Pdt.G/2026/PA.Dgl</h3></div>
  <div class="pricing-bottom"><div class="pricing-bottom-bottom">
    <p><a href="#" onclick='showLoading();post("${ASAL}/aps_badilag/abt/main/cari", { a:"ENC_DIR", b:"ENC_FILE_02", c:"11" });'># <span>[02] BAS 2 P Hadir &amp; T Tidak Hadir Pokok Perkara - Putusan Verstek</span></a></p>
  </div></div>
</div>`;

function buka(p: PilihanDom = {}) {
  const situs = p.situs ?? "sipp";
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body>${p.html ?? ""}<div id="panel"><div id="wadah"></div></div></body></html>`,
    {
      url: situs === "abt" ? `${ASAL}/aps_badilag/abt/main/beranda` : `${ASAL}/SIPP/list_perkara`,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos({ ujiTampilan: p.mode ?? "baru", ...(p.simpanan ?? {}) });
  const tulisan: Array<Record<string, unknown>> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.175.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      lastError: undefined,
      sendMessage: (_m: unknown, balik?: (x: unknown) => void) => setTimeout(() => balik && balik({ ok: true }), 0),
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
          tulisan.push(polos(isi));
          for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Array<{ url: string; cara: string }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    minta.push({ url, cara: String((opsi && opsi.method) || "GET").toUpperCase() });
    if (url.includes("/ekstensi/siapa")) {
      if (p.siapa === null) return new Response("{}", { status: 401 });
      return Response.json({ ok: true, data: p.siapa ?? PP });
    }
    if (url.includes("/aleta-ecourt/bas-massal")) {
      const q = new URL(url, ASAL).searchParams;
      return Response.json({
        ok: true,
        data: {
          tanggal: q.get("tanggal"),
          saringan: q.get("saringan") || "saya",
          lihatSemua: false,
          jumlahSemua: (p.sidang ?? [barisPanel()]).length,
          jumlahSaya: (p.sidang ?? [barisPanel()]).length,
          sidang: p.sidang ?? [barisPanel()],
        },
      });
    }
    if (url.includes("/bas/periksa")) {
      const isi = typeof p.periksa === "function" ? p.periksa(url) : p.periksa;
      return Response.json({
        ok: true,
        data: isi ?? { ok: true, berkas: "x", jumlahPenanda: 40, jumlahTerisi: 38, jumlahTersisa: 2, ringkasan: "siap dengan catatan", temuan: [] },
      });
    }
    if (url.includes("/bas/naskah")) {
      return new Response("{\\rtf1 isi}", {
        status: 200,
        headers: {
          "content-type": "application/rtf",
          "content-disposition": 'attachment; filename="1_Pdt.G_2026_PA.Dgl - BAS 2.rtf"',
          "x-aleta-tersisa": "0123,0456",
        },
      });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  const unduhan: Array<{ href: string; download: string }> = [];
  w.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    unduhan.push({ href: this.href, download: this.download });
  };
  w.URL.createObjectURL = () => "blob:uji-bas";
  w.URL.revokeObjectURL = () => undefined;
  const kiriman: Array<{ action: string; method: string; target: string; data: Record<string, string> }> = [];
  w.HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
    const data: Record<string, string> = {};
    for (const e of Array.from(this.elements) as HTMLInputElement[]) data[e.name] = e.value;
    kiriman.push({ action: this.action, method: this.method, target: this.target, data });
  };
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_BAS}\n;\nwindow.__uji = { mode: () => alatUjiMode(), tahanPost: (nilai) => { alatCobaMenahan = () => nilai; } };`);
  return { dom, w, simpanan, tulisan, minta, unduhan, kiriman, wadah: w.document.getElementById("wadah") as HTMLElement };
}

type H = ReturnType<typeof buka>;
const siapBaru = (h: H, mode = "baru") => sampai(() => h.w.__uji.mode() === mode, `mode ${mode}`);
const pasang = async (h: H, opsi: Record<string, unknown> = { situs: "sipp" }) => (await h.w.aletaBasMassalPasang(h.wadah, opsi)) as boolean;
const nonGet = (h: H) => h.minta.filter((m) => m.cara !== "GET" && m.cara !== "HEAD");
const barisDom = (h: H) => Array.from(h.wadah.querySelectorAll(".aleta-basmassal-baris")) as HTMLElement[];
const tombolBertulis = (akar: ParentNode, pola: RegExp) =>
  (Array.from(akar.querySelectorAll("button")) as HTMLButtonElement[]).find((b) => pola.test(b.textContent || "") && !b.hidden)!;

describe("C1. gerbang tampilan dan peran", () => {
  it("tampilan Lama: pulang false, tidak menggambar, tidak meminta, tidak menyimpan apa pun", async () => {
    const h = buka({ mode: "lama" });
    await tunggu(50);
    const sebelum = h.wadah.outerHTML;
    const mintaSebelum = h.minta.length;
    expect(await pasang(h)).toBe(false);
    await tunggu(50);
    expect(h.wadah.outerHTML).toBe(sebelum);
    expect(h.minta.slice(mintaSebelum).filter((m) => /siapa|bas-massal|bas\//.test(m.url))).toEqual([]);
    expect(h.tulisan.filter((t) => "tokenBlangkoBas" in t)).toEqual([]);
    expect(typeof h.w.aletaBasMassalPasang).toBe("function");
  });

  it("hanya panitera/PP, admin, dan super admin (matriks K1 'bas-massal') - di SIPP dan ABT", async () => {
    const boleh = ["Panitera Pengganti", "Panitera", "Admin", "Super Admin"];
    const tidak = ["Hakim", "Ketua", "Wakil Ketua", "Jurusita", "Jurusita Pengganti", "Staf Pelaksana"];
    for (const situs of ["sipp", "abt"] as const) {
      for (const peran of [...boleh, ...tidak]) {
        const h = buka({ situs, siapa: { nama: "Uji", peran, roleId: "", peranTambahan: [] } });
        await siapBaru(h);
        expect(await pasang(h, { situs }), `${situs} ${peran}`).toBe(boleh.includes(peran));
        if (!boleh.includes(peran)) expect(h.wadah.innerHTML, `${situs} ${peran}`).toBe("");
        else await sampai(() => h.wadah.querySelector(".aleta-basmassal-baris"), `${situs} ${peran} daftar`);
      }
    }
  });

  it("peran aktif dari pemanggil (ganti peran) menang atas akun; akun tak terbaca = tidak digambar", async () => {
    const h = buka({ siapa: PP });
    await siapBaru(h);
    expect(await pasang(h, { situs: "sipp", peran: "Hakim" })).toBe(false);
    expect(h.minta.filter((m) => m.url.includes("/ekstensi/siapa"))).toEqual([]);
    const h2 = buka({ siapa: null });
    await siapBaru(h2);
    expect(await pasang(h2)).toBe(false);
    expect(h2.wadah.innerHTML).toBe("");
  });

  it("UI Baru juga menggambar; dipasang ulang tidak menggandakan", async () => {
    const h = buka({ mode: "ui" });
    await siapBaru(h, "ui");
    expect(await pasang(h)).toBe(true);
    expect(await pasang(h)).toBe(true);
    expect(h.wadah.querySelectorAll(".aleta-basmassal").length).toBe(1);
  });
});

describe("C2. SIPP daftar perkara - daftar, pratinjau, unduh beruntun", () => {
  it("memuat daftar tanggal hari ini (GET), usulan blangko terpilih, TIDAK ADA yang tercentang, tidak ada non-GET", async () => {
    const h = buka();
    await siapBaru(h);
    expect(await pasang(h)).toBe(true);
    await sampai(() => barisDom(h).length === 1, "baris perkara");
    const baris = barisDom(h)[0];
    expect(h.minta.some((m) => /\/aleta\/api\/aleta-ecourt\/bas-massal\?tanggal=\d{4}-\d{2}-\d{2}/.test(m.url))).toBe(true);
    expect(baris.textContent).toContain("1/Pdt.G/2026/PA.Dgl");
    expect(baris.textContent).toContain("BAS belum di SIPP");
    expect(baris.textContent).toContain("lembar BAS 1/2 selesai");
    const pilih = baris.querySelector("select.aleta-basmassal-blangko") as HTMLSelectElement;
    expect(pilih.value).toBe("0");
    const centang = baris.querySelector(".aleta-basmassal-centang") as HTMLInputElement;
    expect(centang.disabled).toBe(false);
    expect(centang.checked).toBe(false);
    expect(tombolBertulis(h.wadah, /^Kerjakan/).disabled).toBe(true);
    expect(nonGet(h)).toEqual([]);
    expect(h.unduhan).toEqual([]);
  });

  it("tanpa usulan: tidak ada blangko terpilih, centang & tombol mati sampai petugas memilih", async () => {
    const b = barisPanel();
    const h = buka({ sidang: [{ ...b, blangko: { ...b.blangko, usulan: null, sebab: "Kehadiran sidang ini belum dicatat di SIPP - pilih blangkonya sendiri." } }] });
    await siapBaru(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 1, "baris");
    const baris = barisDom(h)[0];
    const pilih = baris.querySelector("select.aleta-basmassal-blangko") as HTMLSelectElement;
    const centang = baris.querySelector(".aleta-basmassal-centang") as HTMLInputElement;
    expect(pilih.value).toBe("");
    expect(centang.disabled).toBe(true);
    expect(tombolBertulis(baris, /^Unduh$/).disabled).toBe(true);
    expect(baris.textContent).toContain("belum dicatat");
    pilih.value = "1";
    pilih.dispatchEvent(new h.w.Event("change"));
    expect(centang.disabled).toBe(false);
  });

  it("Kerjakan: pratinjau lalu unduh BERUNTUN (GET periksa, GET naskah), nama berkas dari server, isian kosong disebut", async () => {
    const b1 = barisPanel();
    const b2 = barisPanel({ perkaraId: "12", nomorPerkara: "2/Pdt.G/2026/PA.Dgl" });
    const h = buka({ sidang: [b1, b2] });
    await siapBaru(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 2, "dua baris");
    tombolBertulis(h.wadah, /Centang semua/).click();
    const kerja = tombolBertulis(h.wadah, /^Kerjakan/);
    expect(kerja.disabled).toBe(false);
    expect(kerja.textContent).toBe("Kerjakan 2 yang dicentang");
    kerja.click();
    await sampai(() => /Selesai: 2 diunduh/.test(h.wadah.textContent || ""), "selesai beruntun");
    const bas = h.minta.filter((m) => /\/bas\/(periksa|naskah)/.test(m.url)).map((m) => `${m.url.includes("periksa") ? "periksa" : "naskah"}:${new URL(m.url, ASAL).searchParams.get("perkaraId")}`);
    expect(bas).toEqual(["periksa:11", "naskah:11", "periksa:12", "naskah:12"]);
    const q = new URL(h.minta.find((m) => m.url.includes("/bas/naskah"))!.url, ASAL).searchParams;
    expect(q.get("folder")).toBe(VERSTEK);
    expect(q.get("berkas")).toBe(KATALOG_VERSTEK[1].berkas);
    expect(q.get("sidangKe")).toBe("2");
    expect(h.unduhan).toHaveLength(2);
    expect(h.unduhan[0].download).toBe("1_Pdt.G_2026_PA.Dgl - BAS 2.rtf");
    expect(h.wadah.textContent).toContain("2 isian masih kosong");
    expect(nonGet(h)).toEqual([]);
  });

  it("pratinjau menemukan halangan: dilewati, TIDAK diunduh - kecuali 'unduh walau ada halangan'", async () => {
    const periksa = { ok: true, berkas: "x", jumlahPenanda: 40, jumlahTerisi: 20, jumlahTersisa: 20, ringkasan: "belum siap", temuan: [{ tingkat: "halangan", hal: "Saksi 1", keterangan: "belum ada", tindakan: "isi keterangan saksi 1" }] };
    const h = buka({ periksa });
    await siapBaru(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 1, "baris");
    tombolBertulis(h.wadah, /Centang semua/).click();
    tombolBertulis(h.wadah, /^Kerjakan/).click();
    await sampai(() => /Selesai: 0 diunduh · 1 dilewati/.test(h.wadah.textContent || ""), "dilewati");
    expect(h.minta.filter((m) => m.url.includes("/bas/naskah"))).toEqual([]);
    expect(h.unduhan).toEqual([]);
    expect(h.wadah.textContent).toContain("Saksi 1: isi keterangan saksi 1");
    (h.wadah.querySelector(".aleta-basmassal-paksa input") as HTMLInputElement).checked = true;
    tombolBertulis(h.wadah, /^Kerjakan/).click();
    await sampai(() => h.unduhan.length === 1, "diunduh walau halangan");
  });

  it("Hentikan: perkara sisanya tidak dikerjakan", async () => {
    const sidang = [1, 2, 3].map((i) => barisPanel({ perkaraId: String(10 + i), nomorPerkara: `${i}/Pdt.G/2026/PA.Dgl` }));
    const h = buka({ sidang });
    await siapBaru(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 3, "tiga baris");
    tombolBertulis(h.wadah, /Centang semua/).click();
    tombolBertulis(h.wadah, /^Kerjakan/).click();
    await sampai(() => h.unduhan.length === 1, "satu diunduh");
    tombolBertulis(h.wadah, /^Hentikan$/).click();
    await sampai(() => /Dihentikan/.test(h.wadah.textContent || ""), "dihentikan");
    expect(h.unduhan.length).toBeLessThan(3);
    expect(h.wadah.textContent).toMatch(/belum dikerjakan/);
  });

  it("penjelasan teknis ditandai aleta-teknis; pesan error tidak", async () => {
    const h = buka();
    await siapBaru(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 1, "baris");
    const teknis = Array.from(h.wadah.querySelectorAll(".aleta-teknis")).map((e) => e.textContent || "");
    expect(teknis.some((t) => /GET bas\/periksa/.test(t))).toBe(true);
    for (const e of Array.from(h.wadah.querySelectorAll(".aleta-basmassal-kabar-salah"))) expect(e.classList.contains("aleta-teknis")).toBe(false);
  });
});

describe("C3. beranda ABT - token blangko BAS dan Buka di ABT", () => {
  it("token kelompok & berkas BAS dibaca dari halaman ABT dan disimpan; Buka di ABT = POST main/cari {a,b,c} tab baru", async () => {
    const h = buka({ situs: "abt", html: HTML_ABT });
    await siapBaru(h);
    expect(await pasang(h, { situs: "abt" })).toBe(true);
    const token = h.simpanan.tokenBlangkoBas as { kelompok: Record<string, { a: string }>; berkas: Record<string, { a: string; b: string }> };
    expect(token.kelompok["bas verstek perceraian"].a).toBe("ENC_KEL_VERSTEK");
    // Kelompok putusan tidak disimpan - bukan BAS.
    expect(Object.keys(token.kelompok)).toEqual(["bas verstek perceraian"]);
    expect(Object.values(token.berkas)).toEqual([expect.objectContaining({ a: "ENC_DIR", b: "ENC_FILE_02" })]);
    await sampai(() => barisDom(h).length === 1, "baris");
    const baris = barisDom(h)[0];
    const buka1 = tombolBertulis(baris, /^Buka di ABT$/);
    expect(buka1).toBeTruthy();
    const cetak = baris.querySelector("a.aleta-basmassal-tautan:not([hidden])") as HTMLAnchorElement;
    expect(cetak.textContent).toBe("Cetak ABT");
    expect(cetak.href).toBe(`${ASAL}/aps_badilag/abt/preview?a=ENC_DIR&b=ENC_FILE_02&c=11`);
    expect(nonGet(h)).toEqual([]);
    expect(h.kiriman).toEqual([]);
    buka1.click();
    expect(h.kiriman).toEqual([
      { action: `${ASAL}/aps_badilag/abt/main/cari`, method: "post", target: "_blank", data: { a: "ENC_DIR", b: "ENC_FILE_02", c: "11" } },
    ]);
  });

  it("blangko lain yang berkasnya belum terbaca: hanya tautan kelompok (GET beranda?a=&c=)", async () => {
    const h = buka({ situs: "abt", html: HTML_ABT });
    await siapBaru(h);
    await pasang(h, { situs: "abt" });
    await sampai(() => barisDom(h).length === 1, "baris");
    const baris = barisDom(h)[0];
    const pilih = baris.querySelector("select.aleta-basmassal-blangko") as HTMLSelectElement;
    pilih.value = "1";
    pilih.dispatchEvent(new h.w.Event("change"));
    expect(baris.querySelector("button:not([hidden])")?.textContent).not.toBe("Buka di ABT");
    expect((Array.from(baris.querySelectorAll("button")) as HTMLButtonElement[]).find((b) => b.textContent === "Buka di ABT")!.hidden).toBe(true);
    const kel = Array.from(baris.querySelectorAll("a.aleta-basmassal-tautan")).find((a) => a.textContent === "Kelompok di ABT") as HTMLAnchorElement;
    expect(kel.hidden).toBe(false);
    expect(kel.href).toBe(`${ASAL}/aps_badilag/abt/main/beranda?a=ENC_KEL_VERSTEK&c=11`);
  });

  it("token tersimpan dari ABT dipakai di SIPP; mode yang menahan POST membuat Buka di ABT tidak dikirim", async () => {
    const abt = buka({ situs: "abt", html: HTML_ABT });
    await siapBaru(abt);
    await pasang(abt, { situs: "abt" });
    const token = polos(abt.simpanan.tokenBlangkoBas);
    const h = buka({ simpanan: { tokenBlangkoBas: token } });
    await siapBaru(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 1, "baris");
    const tombol = tombolBertulis(barisDom(h)[0], /^Buka di ABT$/);
    // Penahan mode coba/latihan dipaksa menahan: tidak ada borang yang dikirim.
    h.w.__uji.tahanPost(true);
    tombol.click();
    expect(h.kiriman).toEqual([]);
    expect(barisDom(h)[0].textContent).toContain("Ditahan mode coba");
    h.w.__uji.tahanPost(false);
    tombol.click();
    expect(h.kiriman).toHaveLength(1);
    expect(h.kiriman[0].action).toBe(`${ASAL}/aps_badilag/abt/main/cari`);
  });
});

describe("C4. manifest dan penyusun", () => {
  it("basmassal.js dimuat di SIPP dan ABT: sesudah jurusita.js, sebelum konten.js/abt.js", () => {
    const m = JSON.parse(baca("manifest.json")) as { content_scripts: Array<{ js?: string[] }> };
    for (const utama of ["konten.js", "abt.js"]) {
      const js = m.content_scripts.find((x) => (x.js || []).includes(utama))!.js!;
      expect(js.indexOf("basmassal.js"), utama).toBeGreaterThan(js.indexOf("jurusita.js"));
      expect(js.indexOf("basmassal.js"), utama).toBeLessThan(js.indexOf(utama));
    }
    const portal = m.content_scripts.find((x) => (x.js || []).includes("aleta.js"))!.js!;
    expect(portal).not.toContain("basmassal.js");
  });

  it("susun-ekstensi menanam basmassal.js dan penjaga TDZ menyisirnya", () => {
    expect(readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8")).toContain('"basmassal.js",');
    expect(readFileSync(path.resolve(process.cwd(), "src/test/ekstensi-tdz-tingkat-atas.test.ts"), "utf8")).toContain('"basmassal.js",');
  });
});
