// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * KASIR 3 NOV 2026 (20.40): DAFTAR PSP, INSTRUMEN PER JURUSITA, PBT CABUT/NO-RETUR
 * ============================================================================
 *
 *   1. PSP pada satu tanggal/rentang: penerima, rekening (hak keputusan 171), jumlah, total, PDF.
 *   2. Instrumen biaya panggilan & PBT dikelompokkan per jurusita - satu PDF per jurusita.
 *   3. Cabut / tidak dapat diterima dengan panggilan Tergugat retur: PBT TIDAK diusulkan, tetapi
 *      ditawarkan lewat tombol "Tambah biaya PBT" di kartu perkara.
 *
 * Data REKAAN (fixture kasir-keadaan-nyata.json sudah teranonim; selebihnya dibuat di sini).
 */

const keadaan = vi.hoisted(() => ({ aktor: null as Record<string, unknown> | null, bot: {} as Record<string, unknown> }));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryOne: async () => null, queryAll: async () => [] }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/audit", () => ({ appendAuditLog: async () => undefined }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
    return keadaan.aktor;
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});
vi.mock("@/server/modules/aleta-ecourt/jadwal-sidang-gateway", () => ({
  panggilBotJadwalSidang: async (jalur: string) => {
    const kunci = jalur.startsWith("/kasir/psp") ? "psp" : jalur.startsWith("/kasir/instrumen") ? "instrumen" : "";
    return kunci && keadaan.bot[kunci] ? { ok: true, data: JSON.parse(JSON.stringify(keadaan.bot[kunci])) } : { ok: false, error: "putus" };
  },
}));

import { kelompokkanInstrumen, saringRekeningPsp, teksRekeningPsp, type BarisInstrumen, type DaftarPsp } from "@/lib/kasir-cetak";
import type { UserPersona } from "@/lib/types";

const AKAR = path.resolve(process.cwd(), "..");
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const kasir = requireBot(path.join(AKAR, "aleta_bot/services/kasirJurnalService.js"));
const cetak = requireBot(path.join(AKAR, "aleta_bot/services/kasirCetakService.js"));
const NYATA = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/kasir-keadaan-nyata.json"), "utf8"));
const salin = <T>(x: T): T => JSON.parse(JSON.stringify(x));
type Baris = Record<string, any>;

function cabutRetur(retur: boolean, ubah?: (k: Baris) => void) {
  const k = salin(NYATA.contoh.cabut[0].keadaan);
  const tergugat = k.pihak.find((p: Baris) => p.ke === 2);
  k.relaas = k.relaas.map((r: Baris) => ({ ...r, retur: retur && r.pihakId === tergugat.pihakId }));
  // PBT belum pernah dijurnal untuk Tergugat (jurnal rekaan bersih dari 29/389).
  k.jurnal = k.jurnal.filter((b: Baris) => ![29, 389].includes(Number(b.jenisBiayaId)));
  if (ubah) ubah(k);
  return { k, tergugat };
}

// ============================================================================
describe("1. PBT perkara cabut / tidak dapat diterima dengan panggilan Tergugat retur", () => {
  it("cabut + retur: PBT tidak diusulkan, DITAWARKAN (Biaya Pemberitahuan + PNBP) dengan alasan singkat", () => {
    const { k, tergugat } = cabutRetur(true);
    const h = kasir.susunUsulan(k);
    expect(h.usulan.some((u: Baris) => [29, 389].includes(u.jenisBiayaId))).toBe(false);
    expect(h.tawaranPbt.map((u: Baris) => u.jenisBiayaId)).toEqual([29, 389]);
    for (const u of h.tawaranPbt) {
      expect(u).toMatchObject({ pihakKe: 2, pihakId: tergugat.pihakId, pilih: true, tawaran: true, tanggal: k.putusan.tanggal });
      expect(u.kunci).toMatch(/^pbt-/);
    }
    expect(h.tawaranPbt[0].uraian).toBe("Biaya Pemberitahuan/P");
    expect(h.tawaranPbt[1].uraian).toMatch(/^PNBP Relaas Pemberitahuan Putusan Kepada /);
    expect(h.alasanTanpaPbt).toMatch(/kembali \(retur\) - PBT tidak ditambahkan otomatis\.$/);
  });

  it("cabut tanpa retur: bawaan lama (tanpa PBT, tanpa tawaran); verstek: tidak tersentuh", () => {
    const { k } = cabutRetur(false);
    const h = kasir.susunUsulan(k);
    expect(h.tawaranPbt).toEqual([]);
    expect(h.alasanTanpaPbt).toBe("");
    const v = kasir.susunUsulan(salin(NYATA.contoh.verstek[0].keadaan));
    expect(v.tawaranPbt).toEqual([]);
  });

  it("tidak dapat diterima + retur + Tergugat tidak hadir: PBT Tergugat pindah dari usulan ke tawaran", () => {
    const ubahNo = (k: Baris) => {
      k.putusan = { ...k.putusan, statusId: 64, statusNama: "Tidak Dapat Diterima", verstek: "T" };
      for (const s of k.sidang) s.dihadiriOleh = 2;
    };
    const tanpaRetur = kasir.susunUsulan(cabutRetur(false, ubahNo).k);
    expect(tanpaRetur.usulan.some((u: Baris) => u.jenisBiayaId === 389)).toBe(true); // bawaan lama: diusulkan (tanpa centang)
    const retur = kasir.susunUsulan(cabutRetur(true, ubahNo).k);
    expect(retur.usulan.some((u: Baris) => u.jenisBiayaId === 389 || u.jenisBiayaId === 29)).toBe(false);
    expect(retur.tawaranPbt.map((u: Baris) => u.jenisBiayaId)).toEqual([29, 389]);
  });
});

// ============================================================================
describe("2. bot kasirCetakService: PSP dan instrumen dari jurnal (kueri tiruan)", () => {
  const kueri = async (sql: string) => {
    if (/jenis_biaya_id = \? OR pb.uraian LIKE '%Sisa Panjar%'/.test(sql)) {
      return [
        { id: 1, perkaraId: 11, nomorPerkara: "11/Pdt.G/2026/PA.Xyz", tanggal: "2026-11-03", jumlah: 125000, uraian: "Pengembalian Sisa Panjar", pihakId: 5, namaPihak: "Ani Rekaan" },
        { id: 2, perkaraId: 12, nomorPerkara: "12/Pdt.G/2026/PA.Xyz", tanggal: "2026-11-03", jumlah: 42000, uraian: "Pengembalian Sisa Panjar", pihakId: 6, namaPihak: "Budi Rekaan" },
      ];
    }
    if (/FROM perkara_pengacara/.test(sql)) return [{ perkaraId: 12, nama: "Citra Rekaan, S.H." }];
    if (/kategori_id IN \(4,5,6\)/.test(sql)) {
      return [
        { id: 21, perkaraId: 11, nomorPerkara: "11/Pdt.G/2026/PA.Xyz", tanggal: "2026-11-03", jenisBiayaId: 14, uraian: "Biaya Panggilan Tergugat/RR1ID", jumlah: 29500, namaPihak: "Dedi Rekaan", alamat: "Jl. Rekaan No. 1", jurusitaId: 7, jurusitaNama: "Eko Rekaan", ke: 2 },
        { id: 22, perkaraId: 12, nomorPerkara: "12/Pdt.G/2026/PA.Xyz", tanggal: "2026-11-03", jenisBiayaId: 29, uraian: "Biaya Pemberitahuan/P", jumlah: 45000, namaPihak: "Fani Rekaan", alamat: "Desa Rekaan", jurusitaId: null, jurusitaNama: null, ke: 1 },
      ];
    }
    if (/FROM perkara_jurusita/.test(sql)) return [{ perkaraId: 12, jurusitaId: 8, nama: "Gita Rekaan" }];
    return [];
  };
  const layanan = cetak.buatLayanan({
    kueri,
    hariIni: () => "2026-11-03",
    bacaPembayaran: async () => ({ "11/Pdt.G/2026/PA.Xyz": { diterimaDari: "Ani Rekaan", bank: "BNI", nomorRekening: "9900112233", atasNama: "ani@contoh.test" } }),
  });

  it("PSP: rekening e-Court bila ada; non-e-Court tanpa rekening; kuasa ikut; total", async () => {
    const h = await layanan.daftarPsp({ dari: "2026-11-03" });
    expect(h).toMatchObject({ ok: true, dari: "2026-11-03", sampai: "2026-11-03", jumlah: 2, total: 167000 });
    expect(h.daftar[0]).toMatchObject({ nomorPerkara: "11/Pdt.G/2026/PA.Xyz", ecourt: true, rekening: { bank: "BNI", nomorRekening: "9900112233" } });
    expect(h.daftar[1]).toMatchObject({ ecourt: false, rekening: null, kuasa: "Citra Rekaan, S.H." });
    expect((await layanan.daftarPsp({ dari: "2026-11-05", sampai: "2026-11-01" })).ok).toBe(false);
  });

  it("instrumen: jenis 'Panggilan sidang ke-n' / 'PBT', jurusita baris atau cadangan jurusita perkara", async () => {
    const h = await layanan.instrumen({ dari: "2026-11-03" });
    expect(h.daftar.map((x: Baris) => [x.jenis, x.jurusitaId, x.jurusita, x.jurusitaDariPerkara])).toEqual([
      ["Panggilan sidang ke-2", 7, "Eko Rekaan", false],
      ["PBT (pemberitahuan isi putusan)", 8, "Gita Rekaan", true],
    ]);
  });
});

// ============================================================================
const PSP: DaftarPsp = {
  ok: true, dari: "2026-11-03", sampai: "2026-11-03", jumlah: 2, total: 167000,
  daftar: [
    { jurnalId: 1, perkaraId: 11, nomorPerkara: "11/Pdt.G/2026/PA.Xyz", tanggal: "2026-11-03", jumlah: 125000, penerima: "Ani Rekaan", kuasa: "", ecourt: true, rekening: { diterimaDari: "Ani Rekaan", bank: "BNI", nomorRekening: "9900112233", atasNama: "" } },
    { jurnalId: 2, perkaraId: 12, nomorPerkara: "12/Pdt.G/2026/PA.Xyz", tanggal: "2026-11-03", jumlah: 42000, penerima: "Budi Rekaan", kuasa: "Citra Rekaan, S.H.", ecourt: false, rekening: null },
  ],
};
const b = (x: Partial<BarisInstrumen>): BarisInstrumen => ({ jurnalId: 1, perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Xyz", tanggal: "2026-11-03", jenisBiayaId: 14, uraian: "", jenis: "Panggilan sidang ke-1", jumlah: 29500, pihak: "Pihak Rekaan", alamat: "Jl. Rekaan", jurusitaId: 7, jurusita: "Eko Rekaan", jurusitaDariPerkara: false, ...x });
const INSTRUMEN: BarisInstrumen[] = [
  b({ jurnalId: 1, nomorPerkara: "3/Pdt.G/2026/PA.Xyz" }),
  b({ jurnalId: 2, nomorPerkara: "1/Pdt.G/2026/PA.Xyz", jenis: "PBT (pemberitahuan isi putusan)", jenisBiayaId: 29, jumlah: 45000 }),
  b({ jurnalId: 3, jurusitaId: 8, jurusita: "Gita Rekaan", jumlah: 14500 }),
  b({ jurnalId: 4, jurusitaId: 0, jurusita: "", jumlah: 10000 }),
];

describe("3. lib: rekening per peran dan kelompok per jurusita", () => {
  it("rekening disembunyikan = kolom kosong (bukan tersamar); non-e-Court = 'rekening belum ada'", () => {
    const t = saringRekeningPsp(PSP, false);
    expect(t.rekeningDisembunyikan).toBe(true);
    expect(JSON.stringify(t)).not.toContain("9900112233");
    expect(teksRekeningPsp(PSP.daftar[0])).toBe("BNI 9900112233");
    expect(teksRekeningPsp(PSP.daftar[1])).toBe("rekening belum ada");
  });

  it("per jurusita: jumlah panggilan/PBT dan total benar; baris urut nomor; tanpa jurusita terakhir", () => {
    const k = kelompokkanInstrumen(INSTRUMEN);
    expect(k.map((x) => [x.kunci, x.jurusita, x.jumlahPanggilan, x.jumlahPbt, x.total])).toEqual([
      ["js-7", "Eko Rekaan", 1, 1, 74500],
      ["js-8", "Gita Rekaan", 1, 0, 14500],
      ["tanpa-jurusita", "Jurusita belum ditunjuk", 1, 0, 10000],
    ]);
    expect(k[0].baris.map((x) => x.nomorPerkara)).toEqual(["1/Pdt.G/2026/PA.Xyz", "3/Pdt.G/2026/PA.Xyz"]);
  });
});

// ============================================================================
function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return { id: `usr-${roleId}-${positionId}`, username: roleId, password: "", name: `Uji ${roleId}`, email: `${roleId}@uji.lokal`, roleId, positionId, additionalRoleIds, isActive: true } as unknown as UserPersona;
}
const AKUN = {
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  panmud: akun("panitera-muda", "pos-panitera-muda-gugatan"),
  hakim: akun("hakim", "pos-hakim"),
};
const minta = (url: string) => new NextRequest(`http://127.0.0.1:3000/aleta${url}`);
afterEach(() => {
  keadaan.aktor = null;
  keadaan.bot = {};
});

describe("4. rute Kasir psp & instrumen", () => {
  it("PSP: kasir menerima rekening; panitera muda daftar TANPA rekening; hakim 403; PDF A4", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/sidang/kasir/psp/route");
    keadaan.bot = { psp: PSP };
    keadaan.aktor = AKUN.kasir as unknown as Record<string, unknown>;
    let isi = (await (await GET(minta("/api/aleta-ecourt/sidang/kasir/psp?dari=2026-11-03"))).json()).data;
    expect(isi.daftar[0].rekening.nomorRekening).toBe("9900112233");
    keadaan.aktor = AKUN.panmud as unknown as Record<string, unknown>;
    const r = await GET(minta("/api/aleta-ecourt/sidang/kasir/psp?dari=2026-11-03"));
    isi = (await r.json()).data;
    expect(isi.rekeningDisembunyikan).toBe(true);
    expect(JSON.stringify(isi)).not.toContain("9900112233");
    keadaan.aktor = AKUN.hakim as unknown as Record<string, unknown>;
    expect((await GET(minta("/api/aleta-ecourt/sidang/kasir/psp?dari=2026-11-03"))).status).toBe(403);
    keadaan.aktor = AKUN.kasir as unknown as Record<string, unknown>;
    const pdf = await GET(minta("/api/aleta-ecourt/sidang/kasir/psp?dari=2026-11-03&bentuk=pdf&kertas=A4"));
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toContain("Pengembalian sisa panjar 2026-11-03.pdf");
    expect(Math.round((await PDFDocument.load(new Uint8Array(await pdf.arrayBuffer()))).getPage(0).getWidth())).toBe(595);
  });

  it("instrumen: kelompok per jurusita; PDF hanya untuk jurusita yang diminta (terpisah)", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/sidang/kasir/instrumen/route");
    keadaan.bot = { instrumen: { ok: true, dari: "2026-11-03", sampai: "2026-11-03", daftar: INSTRUMEN } };
    keadaan.aktor = AKUN.kasir as unknown as Record<string, unknown>;
    const isi = (await (await GET(minta("/api/aleta-ecourt/sidang/kasir/instrumen?dari=2026-11-03"))).json()).data;
    expect(isi.kelompok.map((k: Baris) => k.kunci)).toEqual(["js-7", "js-8", "tanpa-jurusita"]);
    const pdf = await GET(minta("/api/aleta-ecourt/sidang/kasir/instrumen?dari=2026-11-03&kunci=js-8&bentuk=pdf&kertas=F4"));
    expect(pdf.headers.get("content-disposition")).toContain("Instrumen Gita Rekaan 2026-11-03.pdf");
    expect(Math.round((await PDFDocument.load(new Uint8Array(await pdf.arrayBuffer()))).getPage(0).getHeight())).toBe(935);
    const tak = (await (await GET(minta("/api/aleta-ecourt/sidang/kasir/instrumen?dari=2026-11-03&kunci=js-99&bentuk=pdf"))).json()).data;
    expect(tak.ok).toBe(false);
    keadaan.aktor = AKUN.hakim as unknown as Record<string, unknown>;
    expect((await GET(minta("/api/aleta-ecourt/sidang/kasir/instrumen?dari=2026-11-03"))).status).toBe(403);
  });
});

// ============================================================================
const EKS = path.join(AKAR, "ekstensi-sipp");
const SUMBER = ["panel-alat.js", "basmassal.js"].map((f) => readFileSync(path.join(EKS, f), "utf8").replace(/\r\n/g, "\n")).join("\n;\n");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
const HARI = "2026-11-03";

function buka() {
  const dom = new JSDOM(`<!doctype html><html><body><div id="wadah"></div></body></html>`, {
    url: "http://192.168.10.10/SIPP/jurnal_perkara_list/ENC",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  const w = dom.window as any;
  w.chrome = {
    runtime: { id: "x", getManifest: () => ({ version: "1.205.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: (_m: unknown, f?: (x: unknown) => void) => setTimeout(() => f && f({ ok: true }), 0) },
    storage: { local: { get: async () => ({ ujiTampilan: "baru", modeKering: false }), set: async () => undefined, remove: async () => undefined }, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: () => undefined } },
  };
  const { k } = cabutRetur(true);
  const h = kasir.susunUsulan(k);
  const akunKasir = { akunKasir: true, ok: true, username: "kasir_uji", nama: "Kasir Uji", calon: [], milik: [], dipilih: "", bolehPilih: false };
  const url: string[] = [];
  w.fetch = async (alamat: string) => {
    const u = String(alamat);
    url.push(u);
    const data = (isi: unknown) => Response.json({ ok: true, data: isi });
    if (/bentuk=pdf/.test(u)) return new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } });
    if (/\/kasir\/psp\?/.test(u)) return data({ available: true, ...PSP });
    if (/\/kasir\/instrumen\?/.test(u)) return data({ available: true, ok: true, dari: HARI, sampai: HARI, kelompok: kelompokkanInstrumen(INSTRUMEN) });
    if (/\/kasir\/harian\?/.test(u)) {
      return data({
        available: true, ok: true, tanggal: HARI, hariIni: HARI, jumlahCalon: 2, lengkap: [], gagal: [], terpotong: false, akun: akunKasir,
        perkara: [
          { perkaraId: 701, nomorPerkara: "701/Pdt.G/2026/PA.Xyz", keadaan: { nama: "Dicabut" }, sebab: ["putusan"], saldo: h.saldo, perluPeriksa: true, usulan: h.usulan.filter((x: Baris) => x.pilih), tawaranPbt: h.tawaranPbt, alasanTanpaPbt: h.alasanTanpaPbt, catatan: [] },
          { perkaraId: 702, nomorPerkara: "702/Pdt.G/2026/PA.Xyz", keadaan: { nama: "Putus verstek" }, sebab: ["putusan"], saldo: 100000, perluPeriksa: false, usulan: [{ kunci: "u1", jenisBiayaId: 157, uraian: "Redaksi", jumlah: 10000, tanggal: HARI, pilih: true, jenisTransaksi: -1 }], tawaranPbt: [], alasanTanpaPbt: "", catatan: [] },
        ],
      });
    }
    if (/\/kasir\/otomatis\?/.test(u)) return data({ available: true, ok: true, tanggal: HARI, hariIni: HARI, bolehUbah: true, setelan: { nyala: false, butir: {} }, butirDaftar: [], perkara: [], gagal: [], ringkas: { perkara: 0, akanDiisi: 0, baris: 0 }, akun: akunKasir });
    if (/\/kasir\/pengingat/.test(u)) return data({ available: true, ok: true, hariIni: HARI, butir: [], ringkas: {} });
    if (/\/kasir\/riwayat\?/.test(u)) return data({ available: true, ok: true, jumlah: 0, pekerjaan: [] });
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.eval(`${SUMBER}\n;window.__mode = () => alatUjiMode(); alatCobaMenahan = () => false; window.__unduh = []; alatUnduh = async (bl, n) => { window.__unduh.push(n); return { ok: true }; };`);
  return { w, dom, wadah: w.document.getElementById("wadah") as HTMLElement, url, h };
}

async function bukaBab(x: ReturnType<typeof buka>, kunci: string) {
  await sampai(() => x.w.__mode() === "baru", "mode baru");
  expect(await x.w.aletaKasirPasangHarian(x.wadah, { situs: "sipp" })).toBe(true);
  const d = x.wadah.querySelector(`details[data-kasir-bagian="${kunci}"]`) as HTMLDetailsElement;
  expect(d.open).toBe(false); // terlipat bawaan
  d.open = true;
  d.dispatchEvent(new x.w.Event("toggle"));
  return d;
}

describe("5. ekstensi: Tambah biaya PBT, bab Cetak (PSP & instrumen per jurusita)", () => {
  it("tombol 'Tambah biaya PBT' hanya di kartu cabut-retur; satu klik menambah 2 baris sebelum Sisa Panjar; Hapus memunculkannya lagi", async () => {
    const x = buka();
    const manual = await bukaBab(x, "manual");
    const kartu = await sampai(() => manual.querySelector('[data-perkara="701"]') as HTMLElement | null, "kartu");
    const lain = manual.querySelector('[data-perkara="702"]') as HTMLElement;
    expect(lain.querySelector("button.aleta-kasir-tambah-pbt")).toBeNull();
    const tombolPbt = kartu.querySelector(".aleta-kasir-kartu-kepala button.aleta-kasir-tambah-pbt") as HTMLButtonElement;
    expect(tombolPbt.textContent).toBe("Tambah biaya PBT");
    expect(kartu.querySelector(".aleta-kasir-tanpa-pbt")!.textContent).toMatch(/kembali \(retur\) - PBT tidak ditambahkan otomatis/);
    const sebelum = kartu.querySelectorAll("tbody tr[data-usulan]").length;
    tombolPbt.click();
    const k2 = manual.querySelector('[data-perkara="701"]') as HTMLElement;
    const kunci = Array.from(k2.querySelectorAll("tbody tr[data-usulan]")).map((tr) => tr.getAttribute("data-usulan"));
    expect(kunci.length).toBe(sebelum + 2);
    const iPbt = kunci.findIndex((x2) => String(x2).startsWith("pbt-"));
    const sisaKunci = x.h.usulan.find((u: Baris) => u.sisaOtomatis)?.kunci;
    if (sisaKunci) expect(iPbt).toBeLessThan(kunci.indexOf(sisaKunci));
    expect(k2.querySelector("button.aleta-kasir-tambah-pbt")).toBeNull();
    expect(k2.querySelector(".aleta-kasir-tanpa-pbt")).toBeNull();
    (k2.querySelector(`tr[data-usulan="${kunci[iPbt]}"] button.aleta-kasir-hapus`) as HTMLButtonElement).click();
    expect(manual.querySelector('[data-perkara="701"] button.aleta-kasir-tambah-pbt')).not.toBeNull();
    x.dom.window.close();
  });

  it("bab Cetak: PSP (rekening / 'rekening belum ada', total) dan instrumen per jurusita; Cetak = PDF terpisah per jurusita", async () => {
    const x = buka();
    const bab = await bukaBab(x, "cetak");
    const psp = await sampai(() => bab.querySelector('[data-kasir-cetak="psp"] table') as HTMLElement | null, "tabel PSP");
    expect(psp.querySelector('tr[data-psp="11/Pdt.G/2026/PA.Xyz"] [data-rekening]')!.textContent).toBe("BNI 9900112233");
    expect(psp.querySelector('tr[data-psp="12/Pdt.G/2026/PA.Xyz"]')!.textContent).toContain("rekening belum ada");
    expect(psp.querySelector('tr[data-psp="12/Pdt.G/2026/PA.Xyz"]')!.textContent).toContain("Budi Rekaan (kuasa: Citra Rekaan, S.H.)");
    expect(psp.querySelector("tr.aleta-kasir-total")!.textContent).toContain("Rp167.000");
    (bab.querySelector("button.aleta-kasir-cetak-psp") as HTMLButtonElement).click();
    await sampai(() => x.w.__unduh.length === 1, "unduh PSP");
    expect(x.w.__unduh[0]).toBe("Pengembalian sisa panjar 2026-11-03.pdf");

    const kartuJs = Array.from(bab.querySelectorAll("[data-jurusita]")).map((d) => d.getAttribute("data-jurusita"));
    expect(kartuJs).toEqual(["js-7", "js-8", "tanpa-jurusita"]);
    expect(bab.querySelector('[data-jurusita="js-7"]')!.textContent).toContain("1 panggilan · 1 PBT");
    expect(bab.querySelector('[data-jurusita="js-7"]')!.textContent).toContain("Rp74.500");
    (bab.querySelector("button.aleta-kasir-cetak-semua") as HTMLButtonElement).click();
    await sampai(() => x.w.__unduh.length === 4, "tiga PDF terpisah");
    expect(x.w.__unduh.slice(1)).toEqual(["Instrumen Eko Rekaan 2026-11-03.pdf", "Instrumen Gita Rekaan 2026-11-03.pdf", "Instrumen Jurusita belum ditunjuk 2026-11-03.pdf"]);
    expect(x.url.filter((u) => /instrumen\?.*bentuk=pdf/.test(u)).map((u) => new URL(u, "http://x").searchParams.get("kunci"))).toEqual(["js-7", "js-8", "tanpa-jurusita"]);
    x.dom.window.close();
  });
});
