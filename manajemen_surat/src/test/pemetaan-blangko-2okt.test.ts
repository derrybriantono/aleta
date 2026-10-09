// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN 2 OKT SORE (AGEN P) - PEMETAAN BLANGKO TERSAMBUNG
 * ============================================================================
 *
 *   butir 1  satu pembaca pemetaan server (panel-alat.js alatPemetaanBlangko):
 *            server -> simpanan -> bawaan, singgahan 1 menit, perubahan admin
 *            sampai tanpa Reload; putusan server diterapkan ke peta peramban.
 *   butir 2  tiap kunci relaas & PBT di tangkapan 140/141 - termasuk buatan
 *            pengguna "relaas-panggilan-sidang-pertama-*" - dipakai pada
 *            keadaan yang tepat; yang khusus menang; kunci asing tidak dibuang.
 *            Aturan lib (TS) dan jurusita.js (JS) dibuktikan SAMA.
 *   butir 3  putusan per jenis DAN per status putusan (kunci teks, tanpa
 *            migrasi); daftar status = status_putusan sipp_donggala.
 *   butir 6  tab BAS - tersimpan tanpa migrasi (jenis 'relaas', awalan "bas|").
 *   butir 7  panel ABT: blangko BAS -> "Isi dari SIPP & input ke ABT (BAS)"
 *            untuk panitera/PP (UI Baru), tanpa tulis sebelum klik.
 *   butir 8  BAS massal memakai pemetaan BAS (susun.ts).
 *
 * Pembukti gigitan memakai salinan bercacat lewat ALETA_UJI_ALAT,
 * ALETA_UJI_JURUSITA, dan ALETA_UJI_ABT.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { kehadiranDiNama, pilihBlangkoBas, setBasUntukPerkara, type KatalogFolder } from "@/app/api/aleta-ecourt/bas-massal/susun";
import {
  KUNCI_BAKU,
  STATUS_PUTUSAN_SIPP,
  kapanDipakai,
  normalkanKunci,
  pilihBlangkoBasPeta,
  pilihBlangkoPutusan,
  pilihKunciRelaas,
  saranBasDariKatalog,
  uraiKunciRelaas,
  type PermintaanRelaas,
} from "@/lib/pemetaan-blangko";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { petaPemetaanBerlaku } from "@/server/modules/aleta-ecourt/pemetaan-blangko";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const bacaUji = (env: string, berkas: string) =>
  process.env[env] ? readFileSync(process.env[env]!, "utf8").replace(/\r\n/g, "\n") : baca(berkas);
const SUMBER_ALAT = bacaUji("ALETA_UJI_ALAT", "panel-alat.js");
const SUMBER_JURUSITA = bacaUji("ALETA_UJI_JURUSITA", "jurusita.js");
const SUMBER_ABT = bacaUji("ALETA_UJI_ABT", "abt.js");

const ASAL = "http://192.168.10.10";
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
    await tunggu(10);
  }
}

// ============================================================================
// Kunci di tangkapan layar 140 (relaas) dan 141 (PBT) - berkas dibuat unik
// supaya kunci yang memilihnya terbaca dari nama berkasnya.
// ============================================================================
const KUNCI_140 = [
  "amplop",
  "delegasi",
  "panggilan-ikrar",
  "panggilan-pemohon",
  "panggilan-penggugat",
  "panggilan-sidang-pertama",
  "panggilan-tergugat",
  "panggilan-termohon",
  "relaas-panggilan-sidang-pertama-pemohon",
  "relaas-panggilan-sidang-pertama-penggugat",
  "relaas-panggilan-sidang-pertama-tergugat",
  "relaas-panggilan-sidang-pertama-termohon",
];
const KUNCI_141 = ["pbt-pemohon", "pbt-penggugat", "pbt-tergugat", "pbt-termohon"];
const berkasDari = (kunci: string) => `[JS] uji ${kunci}.rtf`;

type Kasus = { nama: string; golongan: string; sisi: 1 | 2; permohonan: boolean; harap: string };
/** Tabel kunci -> kapan dipakai (juga ada di laporan agen P). */
const KASUS: Kasus[] = [
  { nama: "gugatan, sidang pertama, Penggugat", golongan: "sidang-pertama", sisi: 1, permohonan: false, harap: "relaas-panggilan-sidang-pertama-penggugat" },
  { nama: "gugatan, sidang pertama, Tergugat", golongan: "sidang-pertama", sisi: 2, permohonan: false, harap: "relaas-panggilan-sidang-pertama-tergugat" },
  { nama: "permohonan, sidang pertama, Pemohon", golongan: "sidang-pertama", sisi: 1, permohonan: true, harap: "relaas-panggilan-sidang-pertama-pemohon" },
  { nama: "permohonan, sidang pertama, Termohon", golongan: "sidang-pertama", sisi: 2, permohonan: true, harap: "relaas-panggilan-sidang-pertama-termohon" },
  { nama: "gugatan, sidang lanjutan, Penggugat", golongan: "sidang-ditunda", sisi: 1, permohonan: false, harap: "panggilan-penggugat" },
  { nama: "gugatan, sidang lanjutan, Tergugat", golongan: "sidang-ditunda", sisi: 2, permohonan: false, harap: "panggilan-tergugat" },
  { nama: "permohonan, sidang lanjutan, Pemohon", golongan: "sidang-lanjutan", sisi: 1, permohonan: true, harap: "panggilan-pemohon" },
  { nama: "permohonan, sidang lanjutan, Termohon", golongan: "sidang-lanjutan", sisi: 2, permohonan: true, harap: "panggilan-termohon" },
  { nama: "ikrar talak, Pemohon", golongan: "ikrar-talak", sisi: 1, permohonan: true, harap: "panggilan-ikrar" },
  { nama: "ikrar talak, Termohon", golongan: "ikrar-talak", sisi: 2, permohonan: true, harap: "panggilan-ikrar" },
  { nama: "PBT gugatan, Penggugat", golongan: "pemberitahuan-putusan", sisi: 1, permohonan: false, harap: "pbt-penggugat" },
  { nama: "PBT gugatan, Tergugat", golongan: "pemberitahuan-putusan", sisi: 2, permohonan: false, harap: "pbt-tergugat" },
  { nama: "PBT permohonan, Pemohon", golongan: "pemberitahuan-putusan", sisi: 1, permohonan: true, harap: "pbt-pemohon" },
  { nama: "PBT permohonan, Termohon", golongan: "pemberitahuan-putusan", sisi: 2, permohonan: true, harap: "pbt-termohon" },
];

function permintaanTs(k: { golongan: string; sisi: 1 | 2; permohonan: boolean }): PermintaanRelaas {
  const khusus = (k.permohonan ? (k.sisi === 1 ? "pemohon" : "termohon") : k.sisi === 1 ? "penggugat" : "tergugat") as PermintaanRelaas["khusus"];
  const umum = (k.sisi === 1 ? "penggugat" : "tergugat") as PermintaanRelaas["umum"];
  if (k.golongan === "pemberitahuan-putusan") return { awalan: "pbt", keadaan: "", khusus, umum };
  if (k.golongan === "ikrar-talak") return { awalan: "panggilan", keadaan: "ikrar", khusus, umum };
  if (k.golongan === "sidang-pertama") return { awalan: "panggilan", keadaan: "pertama", khusus, umum };
  return { awalan: "panggilan", keadaan: "lanjutan", khusus, umum };
}

// ============================================================================
describe("butir 2 - kunci relaas & PBT diuraikan, yang khusus menang (lib)", () => {
  it("tiap kunci di tangkapan 140/141 dikenali; tiap kasus memilih kuncinya", () => {
    for (const k of [...KUNCI_140, ...KUNCI_141]) expect(uraiKunciRelaas(k).dikenal, k).toBe(true);
    const semua = [...KUNCI_140, ...KUNCI_141];
    for (const k of KASUS) expect(pilihKunciRelaas(semua, permintaanTs(k)), k.nama).toBe(k.harap);
    // Seluruh kunci panggilan/PBT terpakai oleh paling sedikit satu keadaan -
    // kecuali panggilan-sidang-pertama, yang KALAH oleh kunci sidang pertama per
    // pihak buatan pengguna (yang khusus menang); ia dipakai bila keduanya tidak ada
    // (uji berikutnya).
    const terpakai = new Set(KASUS.map((k) => k.harap));
    for (const k of semua.filter((x) => !["amplop", "delegasi", "panggilan-sidang-pertama"].includes(x))) expect(terpakai.has(k), k).toBe(true);
  });

  it("tanpa kunci per pihak: sidang pertama = panggilan-sidang-pertama (P dan T), bukan panggilan-<pihak>", () => {
    const tanpa = KUNCI_140.filter((k) => !k.startsWith("relaas-"));
    expect(pilihKunciRelaas(tanpa, permintaanTs({ golongan: "sidang-pertama", sisi: 1, permohonan: true }))).toBe("panggilan-sidang-pertama");
    expect(pilihKunciRelaas(tanpa, permintaanTs({ golongan: "sidang-pertama", sisi: 2, permohonan: false }))).toBe("panggilan-sidang-pertama");
  });

  it("pihak umum menjadi cadangan pemohon/termohon; kunci asing tidak dipilih tetapi tetap dikenali sebagai asing", () => {
    expect(
      pilihKunciRelaas(["relaas-panggilan-sidang-pertama-penggugat", "panggilan-sidang-pertama"], permintaanTs({ golongan: "sidang-pertama", sisi: 1, permohonan: true }))
    ).toBe("relaas-panggilan-sidang-pertama-penggugat");
    expect(uraiKunciRelaas("panggilan-kuasa")).toMatchObject({ dikenal: false, asing: ["kuasa"] });
    expect(pilihKunciRelaas(["panggilan-kuasa"], permintaanTs({ golongan: "sidang-ditunda", sisi: 1, permohonan: false }))).toBeNull();
    expect(kapanDipakai("relaas", "panggilan-kuasa").dikenal).toBe(false);
    expect(uraiKunciRelaas("delegasi").awalan).toBe("delegasi");
    expect(uraiKunciRelaas("amplop").awalan).toBe("amplop");
    // delegasi/amplop tidak pernah menjadi blangko panggilan sidang.
    expect(pilihKunciRelaas(["delegasi", "amplop"], permintaanTs({ golongan: "sidang-pertama", sisi: 1, permohonan: false }))).toBeNull();
  });

  it("kalimat 'dipakai saat' untuk tiap kunci tangkapan", () => {
    const kalimat = Object.fromEntries([...KUNCI_140, ...KUNCI_141].map((k) => [k, kapanDipakai("relaas", k).dipakai]));
    expect(kalimat["relaas-panggilan-sidang-pertama-pemohon"]).toMatch(/sidang pertama - Pemohon/);
    expect(kalimat["panggilan-sidang-pertama"]).toMatch(/sidang pertama - P dan T/);
    expect(kalimat["panggilan-tergugat"]).toMatch(/lanjutan.*Tergugat/);
    expect(kalimat["panggilan-ikrar"]).toMatch(/ikrar talak/);
    expect(kalimat["pbt-termohon"]).toMatch(/Pemberitahuan isi putusan kepada Termohon/);
    expect(kalimat["delegasi"]).toMatch(/delegasi/);
  });
});

// ============================================================================
describe("butir 3 - putusan per jenis DAN per status putusan (lib)", () => {
  it("daftar status = status_putusan sipp_donggala (jenis_pengadilan 4, perdata, aktif)", () => {
    expect(STATUS_PUTUSAN_SIPP.map((s) => s.id).sort((a, b) => a - b)).toEqual([62, 63, 64, 65, 66, 67, 85, 92, 93]);
    expect(STATUS_PUTUSAN_SIPP[0]).toEqual({ id: 62, nama: "Dikabulkan" });
  });

  it("kunci teks dinormalkan: 'Cerai Gugat | dikabulkan | VERSTEK' -> 'Cerai Gugat|Dikabulkan|verstek'", () => {
    expect(normalkanKunci("putusan", " Cerai  Gugat | dikabulkan | VERSTEK ")).toBe("Cerai Gugat|Dikabulkan|verstek");
    expect(normalkanKunci("putusan", "Cerai Gugat|DIKABULKAN (verstek)")).toBe("Cerai Gugat|Dikabulkan|verstek");
    expect(normalkanKunci("putusan", "Cerai Gugat|tidak dapat diterima")).toBe("Cerai Gugat|Tidak Dapat Diterima");
    expect(normalkanKunci("putusan", "Cerai Gugat")).toBe("Cerai Gugat");
  });

  it("status+verstek -> status -> jenis; padanan nama SIPP berlaku; kosong = jenis (perilaku lama)", () => {
    const peta = {
      "Cerai Gugat": "[01] CG umum",
      "Cerai Gugat|Dikabulkan": "[01] CG kabul",
      "Cerai Gugat|Dikabulkan|verstek": "[01] CG kabul verstek",
      "Cerai Gugat|Dicabut": "[09] CG cabut",
      "Itsbat Nikah|Ditolak": "[02] IN tolak",
      "Itsbat Nikah": "[01] IN",
    };
    expect(pilihBlangkoPutusan(peta, { jenis: "Cerai Gugat", status: "DIKABULKAN (verstek)" })?.namaBerkas).toBe("[01] CG kabul verstek");
    expect(pilihBlangkoPutusan(peta, { jenis: "cerai gugat", status: "Dikabulkan", verstek: true })?.tingkat).toBe("status-verstek");
    expect(pilihBlangkoPutusan(peta, { jenis: "Cerai Gugat", status: "Dikabulkan" })?.namaBerkas).toBe("[01] CG kabul");
    expect(pilihBlangkoPutusan(peta, { jenis: "Cerai Gugat", status: "Dicabut", verstek: true })?.namaBerkas).toBe("[09] CG cabut");
    expect(pilihBlangkoPutusan(peta, { jenis: "Cerai Gugat", status: "Ditolak" })?.tingkat).toBe("jenis");
    expect(pilihBlangkoPutusan(peta, { jenis: "Cerai Gugat" })?.namaBerkas).toBe("[01] CG umum");
    expect(pilihBlangkoPutusan(peta, { jenis: "Pengesahan Perkawinan/Istbat Nikah", status: "Ditolak" })?.namaBerkas).toBe("[02] IN tolak");
    expect(pilihBlangkoPutusan(peta, { jenis: "Dispensasi Kawin", status: "Dikabulkan" })).toBeNull();
  });
});

// ============================================================================
describe("butir 6/8 - BAS (lib + susun.ts)", () => {
  const KATALOG: Record<string, KatalogFolder> = Object.fromEntries(
    setBasUntukPerkara("Cerai Gugat").map((s) => [
      s.folder,
      {
        terbaca: true,
        sebab: "",
        blangko:
          s.id === "bas-verstek"
            ? [
                { berkas: "BAS 1 P Hadir & T Tidak Hadir.rtf", basKe: 1, keadaan: "P Hadir & T Tidak Hadir" },
                { berkas: "BAS 2 P Hadir & T Tidak Hadir Pembuktian.rtf", basKe: 2, keadaan: "P Hadir & T Tidak Hadir", tindakan: "Pembuktian" },
              ]
            : [
                { berkas: "BAS 1 P & T Hadir Mediasi.rtf", basKe: 1, keadaan: "P & T Hadir", tindakan: "Perintah Mediasi" },
                { berkas: "BAS 2 P & T Hadir.rtf", basKe: 2, keadaan: "P & T Hadir" },
                { berkas: "BAS 3 Pembacaan Putusan.rtf", basKe: 3, keadaan: "", tindakan: "Pembacaan Putusan" },
              ],
      },
    ])
  );

  it("kunci BAS dinormalkan dan dipilih yang paling khusus", () => {
    expect(normalkanKunci("bas", "Cerai Gugat | BAS 2 | P hadir")).toBe("Cerai Gugat|2|p-hadir");
    expect(normalkanKunci("bas", "semua|sidang pertama|P & T hadir")).toBe("*|1|semua-hadir");
    const peta = { "*|1|*": "umum.rtf", "Cerai Gugat|1|p-hadir": "cg1p.rtf", "Cerai Gugat|lanjutan|*": "cg-lanjut.rtf", "Cerai Gugat|pembuktian|*": "cg-bukti.rtf" };
    expect(pilihBlangkoBasPeta(peta, { jenisPerkara: "Cerai Gugat", urutanSidang: 1, dihadiriOleh: 2 })?.namaBerkas).toBe("cg1p.rtf");
    expect(pilihBlangkoBasPeta(peta, { jenisPerkara: "Cerai Talak", urutanSidang: 1, dihadiriOleh: 2 })?.namaBerkas).toBe("umum.rtf");
    expect(pilihBlangkoBasPeta(peta, { jenisPerkara: "Cerai Gugat", urutanSidang: 3, agenda: "Pembuktian saksi", dihadiriOleh: 1 })?.namaBerkas).toBe("cg-bukti.rtf");
    expect(pilihBlangkoBasPeta(peta, { jenisPerkara: "Cerai Gugat", urutanSidang: 3, agenda: "Kesimpulan", dihadiriOleh: 1 })?.namaBerkas).toBe("cg-lanjut.rtf");
    // 4 jenis x 11 keadaan baku - sejak 9 Okt 2026 ditambah "gugur" dan
    // "tunda-panggil" (sidang lewat 14.00 tanpa kehadiran), sebelumnya 36.
    expect(KUNCI_BAKU.bas.length).toBe(44);
  });

  it("saran dari katalog BAS massal: kehadiran dan sidang ke- cocok", () => {
    const saran = Object.fromEntries(saranBasDariKatalog(KATALOG, (j) => setBasUntukPerkara(j), kehadiranDiNama).map((s) => [s.kunci, s.namaBerkas]));
    expect(saran["Cerai Gugat|1|p-hadir"]).toBe("BAS 1 P Hadir & T Tidak Hadir.rtf");
    expect(saran["Cerai Gugat|1|semua-hadir"]).toBe("BAS 1 P & T Hadir Mediasi.rtf");
    expect(saran["Cerai Gugat|lanjutan|p-hadir"]).toBe("BAS 2 P Hadir & T Tidak Hadir Pembuktian.rtf");
    expect(saran["Cerai Gugat|putusan|*"]).toBe("BAS 3 Pembacaan Putusan.rtf");
  });

  it("BAS massal: pemetaan menang atas usulan otomatis; berkas yang tidak ada di katalog tidak ditebak", () => {
    const dasar = { jenisPerkara: "Cerai Gugat", urutanSidang: 2, dihadiriOleh: 1, katalog: KATALOG, agenda: "Pembuktian" };
    const otomatis = pilihBlangkoBas(dasar);
    expect(otomatis.usulan?.berkas).toBe("BAS 2 P & T Hadir.rtf");
    expect(otomatis.usulan?.dariPemetaan).toBeUndefined();
    const dipetakan = pilihBlangkoBas({ ...dasar, petaBas: { "Cerai Gugat|pembuktian|*": "bas 2 p hadir & t tidak hadir pembuktian" } });
    expect(dipetakan.usulan).toMatchObject({ berkas: "BAS 2 P Hadir & T Tidak Hadir Pembuktian.rtf", dariPemetaan: "Cerai Gugat|pembuktian|*" });
    expect(dipetakan.pilihan[0].berkas).toBe("BAS 2 P Hadir & T Tidak Hadir Pembuktian.rtf");
    const hilang = pilihBlangkoBas({ ...dasar, petaBas: { "Cerai Gugat|2|*": "Tidak Ada.rtf" } });
    expect(hilang.usulan).toBeNull();
    expect(hilang.sebab).toMatch(/tidak ada di katalog/);
    expect(hilang.pilihan.length).toBeGreaterThan(0);
    // Tanpa pemetaan yang cocok: perilaku lama persis.
    expect(pilihBlangkoBas({ ...dasar, petaBas: { "Cerai Talak|2|*": "x.rtf" } })).toEqual(otomatis);
  });
});

// ============================================================================
// Ekstensi: panel-alat.js (+ jurusita.js) di jsdom
// ============================================================================
type Server = Record<string, Array<{ kunci: string; namaBerkas: string; sumber?: string }> | null>;
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaAlat(opsi: { server: Server; simpanan?: Record<string, unknown>; jurusita?: boolean; url?: string }) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="wadah"></div></body></html>`, {
    url: opsi.url || `${ASAL}/SIPP/perkara_detil_agama/xyz`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos({ ujiTampilan: "ui", ...(opsi.simpanan || {}) });
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.178.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: () => undefined },
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
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    if (url.includes("/aleta/api/aleta-ecourt/pemetaan-blangko")) {
      const jenis = new URL(url, ASAL).searchParams.get("jenis") || "";
      const butir = opsi.server[jenis];
      if (!butir) return new Response(JSON.stringify({ ok: false }), { status: 404 });
      return new Response(
        JSON.stringify({ ok: true, data: { jenis, diubahPada: "2026-10-02T09:54:00Z", butir: butir.map((b) => ({ sebutan: "", catatan: "", sumber: "admin", ...b })) } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  let geser = 0;
  const asliNow = w.Date.now.bind(w.Date);
  w.Date.now = () => asliNow() + geser;
  w.eval(
    `${SUMBER_ALAT}\n;\n${opsi.jurusita ? SUMBER_JURUSITA : ""}\n;\nwindow.__p = {` +
      `pemetaan: alatPemetaanBlangko, lengkap: alatMuatPetaBlangkoLengkap, untuk: alatPetaUntukPerkara, kunciAdmin: alatKunciPetaDariAdmin, terapkan: alatTerapkanPemetaanServer,` +
      (opsi.jurusita
        ? `urai: jurusitaUraiKunci, pilih: jurusitaPilihKunci, minta: jurusitaPermintaan, sebutan: jurusitaSebutan, muatPeta: jurusitaMuatPeta, susun: jurusitaSusunDokumen,`
        : "") +
      `};`
  );
  return { w, simpanan, minta, p: w.__p, majukan: (ms: number) => (geser += ms) };
}

const SERVER_140_141: Server = {
  relaas: [...KUNCI_140, "panggilan-kuasa"].map((kunci) => ({ kunci, namaBerkas: berkasDari(kunci) })),
  pbt: KUNCI_141.map((kunci) => ({ kunci, namaBerkas: berkasDari(kunci) })),
};

describe("butir 2 - jurusita.js memakai aturan yang SAMA dengan lib, dan tiap kunci tangkapan terpakai", () => {
  it("cermin: jurusitaUraiKunci/jurusitaPilihKunci = uraiKunciRelaas/pilihKunciRelaas", () => {
    const h = bukaAlat({ server: {}, jurusita: true });
    const kunci = [
      ...KUNCI_140,
      ...KUNCI_141,
      "panggilan-kuasa",
      "panggilan-sidang-lanjutan-tergugat",
      "pbt",
      "panggilan",
      "Panggilan Ikrar Termohon",
      "relaas panggilan tundaan pemohon",
    ];
    for (const k of kunci) {
      const ts = uraiKunciRelaas(k);
      expect(polos(h.p.urai(k)), k).toEqual({ awalan: ts.awalan, keadaan: ts.keadaan, pihak: ts.pihak, dikenal: ts.dikenal, asing: ts.asing });
    }
    const kumpulan = [kunci, KUNCI_140.filter((k) => !k.startsWith("relaas-")), ["panggilan", "pbt", "panggilan-tergugat"], ["relaas-panggilan-sidang-pertama-penggugat"]];
    for (const daftar of kumpulan) {
      for (const k of KASUS) {
        const sebutan = h.p.sebutan(k.permohonan ? "1/Pdt.P/2026/PA.Dgl" : "1/Pdt.G/2026/PA.Dgl", "");
        const m = h.p.minta(k.golongan, k.sisi, sebutan);
        expect(h.p.pilih(daftar, m), `${k.nama} / ${daftar.length}`).toBe(pilihKunciRelaas(daftar, permintaanTs(k)));
      }
    }
  });

  it("jurusitaSusunDokumen memakai tiap kunci 140/141 dari SERVER pada keadaan yang tepat", async () => {
    const h = bukaAlat({ server: SERVER_140_141, jurusita: true });
    const peta = await h.p.muatPeta();
    expect(peta.relaas.sumber).toBe("server");
    const dipakai = new Set<string>();
    for (const k of KASUS) {
      const nomor = k.permohonan ? "77/Pdt.G/2026/PA.Dgl" : "78/Pdt.G/2026/PA.Dgl";
      const rincian = {
        jenisPerkara: k.permohonan ? "Cerai Talak" : "Cerai Gugat",
        putusan: { sudahPutus: k.golongan === "ikrar-talak", tanggalPutusan: "2026-09-01" },
      };
      const sidang =
        k.golongan === "sidang-pertama"
          ? { urutanSidang: 1, tanggalSidang: "2026-08-01", agenda: "Pemeriksaan identitas" }
          : k.golongan === "ikrar-talak"
            ? { urutanSidang: 5, tanggalSidang: "2026-09-20", agenda: "Ikrar talak" }
            : { urutanSidang: 3, tanggalSidang: "2026-08-20", agenda: "Pembuktian" };
      const pilihan = k.golongan === "pemberitahuan-putusan" ? { panggilan: [], pbt: [k.sisi] } : { panggilan: [k.sisi], pbt: [] };
      const { dokumen } = h.p.susun({ perkaraId: "1", nomorPerkara: nomor, rincian, sidang, jurusita: "JS" }, pilihan, peta);
      expect(dokumen.length, k.nama).toBe(1);
      expect(dokumen[0].berkas, k.nama).toBe(berkasDari(k.harap));
      expect(dokumen[0].sumberBlangko).toBe("server");
      dipakai.add(dokumen[0].kunciBlangko);
    }
    for (const k of [...KUNCI_140, ...KUNCI_141].filter((x) => !["amplop", "delegasi", "panggilan-sidang-pertama"].includes(x))) {
      expect(dipakai.has(k), k).toBe(true);
    }
    // Tanpa kunci sidang pertama per pihak: panggilan-sidang-pertama untuk P dan T (satu dokumen).
    const h2 = bukaAlat({
      server: { relaas: KUNCI_140.filter((k) => !k.startsWith("relaas-")).map((kunci) => ({ kunci, namaBerkas: berkasDari(kunci) })), pbt: [] },
      jurusita: true,
    });
    const peta2 = await h2.p.muatPeta();
    const dua = h2.p.susun(
      { perkaraId: "1", nomorPerkara: "78/Pdt.G/2026/PA.Dgl", rincian: { jenisPerkara: "Cerai Gugat" }, sidang: { urutanSidang: 1, tanggalSidang: "2026-08-01" }, jurusita: "JS" },
      { panggilan: [1, 2], pbt: [] },
      peta2
    ).dokumen;
    expect(dua.map((d: any) => [d.berkas, d.kunciBlangko, d.label])).toEqual([
      [berkasDari("panggilan-sidang-pertama"), "panggilan-sidang-pertama", "Panggilan Penggugat dan Tergugat"],
    ]);
    // Kunci asing tidak dibuang dari simpanan.
    expect((h.simpanan.petaBlangkoRelaasPbt as any).relaas.peta["panggilan-kuasa"]).toBe(berkasDari("panggilan-kuasa"));
  });
});

// ============================================================================
describe("butir 1 - pembaca pemetaan server bersama: singgahan 1 menit, tanpa Reload", () => {
  it("dibaca sekali per menit; perubahan admin sampai sesudah singgahan habis; server mati = simpanan", async () => {
    const server: Server = { relaas: [{ kunci: "panggilan-tergugat", namaBerkas: "A.rtf" }] };
    const h = bukaAlat({ server });
    const [x, y] = await Promise.all([h.p.pemetaan("relaas"), h.p.pemetaan("relaas")]);
    expect(x.peta["panggilan-tergugat"]).toBe("A.rtf");
    expect(y.sumber).toBe("server");
    expect(h.minta.filter((u) => u.includes("jenis=relaas"))).toHaveLength(1);

    server.relaas = [{ kunci: "panggilan-tergugat", namaBerkas: "B.rtf" }];
    h.majukan(30 * 1000);
    expect((await h.p.pemetaan("relaas")).peta["panggilan-tergugat"]).toBe("A.rtf");
    h.majukan(31 * 1000);
    expect((await h.p.pemetaan("relaas")).peta["panggilan-tergugat"]).toBe("B.rtf");
    expect(h.minta.filter((u) => u.includes("jenis=relaas"))).toHaveLength(2);

    // Server tidak menjawab: simpanan terakhir, bertanda "simpanan".
    server.relaas = null;
    h.majukan(61 * 1000);
    const z = await h.p.pemetaan("relaas");
    expect(z.sumber).toBe("simpanan");
    expect(z.peta["panggilan-tergugat"]).toBe("B.rtf");
  });

  it("putusan server diterapkan ke peta peramban: nama admin menang, token diambil ulang, baris status dibuat & dilepas", async () => {
    const server: Server = {
      putusan: [
        { kunci: "Cerai Gugat", namaBerkas: "[01] Baru Admin" },
        { kunci: "Cerai Gugat|Dikabulkan|verstek", namaBerkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)" },
      ],
    };
    const h = bukaAlat({
      server,
      url: `${ASAL}/aps_badilag/index.php/abt/`,
      simpanan: {
        petaBlangkoPutusan: {
          "cerai gugat": { jenisAsli: "Cerai Gugat", blangko: "Putusan Cerai Gugat", berkas: "[01] Lama", a: "tokenAAAAAAAA1", b: "tokenBBBBBBBB1", d: "", bawaan: false },
          "cerai talak": { jenisAsli: "Cerai Talak", berkas: "[01] CT", a: "tokenAAAAAAAA2", b: "tokenBBBBBBBB2", d: "", bawaan: false },
        },
      },
    });
    const peta = await h.p.lengkap();
    expect(peta["cerai gugat"]).toMatchObject({ berkas: "[01] Baru Admin", a: "", b: "", sumber: "server" });
    expect(peta["cerai gugat|dikabulkan|verstek"]).toMatchObject({ berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)", sumber: "server", statusAsli: "Dikabulkan" });
    expect(peta["cerai talak"]).toMatchObject({ berkas: "[01] CT", a: "tokenAAAAAAAA2" });
    expect((h.simpanan.petaBlangkoPutusan as any)["cerai gugat"].berkas).toBe("[01] Baru Admin");
    expect(h.p.untuk(peta, "Cerai Gugat", "DIKABULKAN (verstek)", false).kunci).toBe("cerai gugat|dikabulkan|verstek");
    expect(h.p.untuk(peta, "Cerai Gugat", "Ditolak", false).kunci).toBe("cerai gugat");

    // Admin menghapus baris status; sesudah singgahan habis barisnya dilepas.
    server.putusan = [{ kunci: "Cerai Gugat", namaBerkas: "[01] Baru Admin" }];
    h.majukan(61 * 1000);
    const lagi = await h.p.lengkap();
    expect(lagi["cerai gugat|dikabulkan|verstek"]).toBeUndefined();
    expect(lagi["cerai gugat"].berkas).toBe("[01] Baru Admin");
  });

  it("cermin putusan: alatPetaUntukPerkara (ekstensi) = pilihBlangkoPutusan (lib)", () => {
    const h = bukaAlat({ server: {} });
    const admin: Record<string, string> = {
      "Cerai Gugat": "cg",
      "Cerai Gugat|Dikabulkan": "cg-k",
      "Cerai Gugat|Dikabulkan|verstek": "cg-kv",
      "Cerai Talak|Dicabut": "ct-c",
      "Pengesahan Perkawinan/Istbat Nikah": "in",
      "Itsbat Nikah|Ditolak": "in-t",
    };
    const petaExt: Record<string, { berkas: string }> = {};
    for (const [k, v] of Object.entries(admin)) petaExt[h.p.kunciAdmin(k)] = { berkas: v };
    const perkara = [
      { jenis: "Cerai Gugat", status: "Dikabulkan", verstek: true },
      { jenis: "Cerai Gugat", status: "DIKABULKAN (verstek)", verstek: false },
      { jenis: "Cerai Gugat", status: "Dikabulkan", verstek: false },
      { jenis: "Cerai Gugat", status: "", verstek: false },
      { jenis: "Cerai Talak", status: "Dicabut", verstek: false },
      { jenis: "Cerai Talak", status: "Dikabulkan", verstek: false },
      { jenis: "Pengesahan Perkawinan/Istbat Nikah", status: "Ditolak", verstek: false },
      { jenis: "Itsbat Nikah", status: "Dikabulkan", verstek: false },
    ];
    for (const p of perkara) {
      const ext = h.p.untuk(petaExt, p.jenis, p.status, p.verstek);
      const ts = pilihBlangkoPutusan(admin, p);
      expect(ext ? ext.baris.berkas : null, JSON.stringify(p)).toBe(ts ? ts.namaBerkas : null);
    }
  });
});

// ============================================================================
// Rute server (pg-mem): BAS tanpa migrasi, putusan per status, "dipakai saat"
// ============================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-sipp/aleta-sipp-datasource")>();
  return {
    ...modul,
    callAletaBotSippBridge: async (operasi: string, param: { folder?: string }) => {
      if (operasi !== "blangko.katalog") return { ok: false, error: "tidak ada" };
      if (!String(param.folder || "").includes("VERSTEK")) return { ok: true, data: { ada: true, blangko: [] } };
      return { ok: true, data: { ada: true, blangko: [{ berkas: "BAS 1 P Hadir & T Tidak Hadir.rtf", basKe: 1, keadaan: "P Hadir & T Tidak Hadir" }] } };
    },
  };
});

async function panggil(cara: "GET" | "PUT", opsi: { query?: string; badan?: unknown } = {}) {
  const rute = await import("@/app/api/aleta-ecourt/pemetaan-blangko/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (rute as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as { ok: boolean; data: Record<string, any> } };
}

describe("butir 3/6 - rute pemetaan-blangko", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-admin";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("BAS tersimpan TANPA migrasi (jenis 'relaas', kunci 'bas|...'), tidak bocor ke relaas, saran dari katalog", async () => {
    const t = await panggil("PUT", { badan: { jenis: "bas", butir: [{ kunci: "Cerai Gugat | BAS 2 | P hadir", namaBerkas: "BAS 2 khusus.rtf" }] } });
    expect(t.status).toBe(200);
    const baris = await db!.queryAll<{ jenis: string; kunci: string }>("SELECT jenis, kunci FROM aleta_pemetaan_blangko");
    expect(baris).toEqual([{ jenis: "relaas", kunci: "bas|Cerai Gugat|2|p-hadir" }]);
    const bas = await panggil("GET", { query: "jenis=bas" });
    expect(bas.isi.data.butir.map((b: any) => [b.kunci, b.namaBerkas, b.sumber])).toEqual([["Cerai Gugat|2|p-hadir", "BAS 2 khusus.rtf", "admin"]]);
    expect(bas.isi.data.kapan["Cerai Gugat|2|p-hadir"]).toEqual({ dikenal: true, dipakai: "BAS Cerai Gugat - sidang ke-2, hanya P hadir (T tidak hadir)." });
    expect(bas.isi.data.saran).toContainEqual(expect.objectContaining({ kunci: "Cerai Gugat|1|p-hadir", namaBerkas: "BAS 1 P Hadir & T Tidak Hadir.rtf" }));
    // 36 + 4 jenis x ("gugur", "tunda-panggil") sejak 9 Okt 2026.
    expect(bas.isi.data.kunciBaku).toHaveLength(44);
    const relaas = await panggil("GET", { query: "jenis=relaas" });
    expect(relaas.isi.data.butir.some((b: any) => b.kunci.startsWith("bas"))).toBe(false);
    expect(await petaPemetaanBerlaku(db!, "bas")).toEqual({ "Cerai Gugat|2|p-hadir": "BAS 2 khusus.rtf" });
    // Kosongkan = hapus.
    await panggil("PUT", { badan: { jenis: "bas", butir: [{ kunci: "Cerai Gugat|2|p-hadir", namaBerkas: "" }] } });
    expect(await db!.queryAll("SELECT kunci FROM aleta_pemetaan_blangko")).toEqual([]);
  });

  it("putusan per status: kunci dinormalkan, daftar status SIPP dan 'dipakai saat' dikirim", async () => {
    const t = await panggil("PUT", { badan: { jenis: "putusan", butir: [{ kunci: "Cerai Gugat | dikabulkan | VERSTEK", namaBerkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)" }] } });
    expect(t.status).toBe(200);
    expect(t.isi.data.butir.map((b: any) => b.kunci)).toEqual(["Cerai Gugat|Dikabulkan|verstek"]);
    expect(t.isi.data.statusPutusan).toEqual(STATUS_PUTUSAN_SIPP.map((s) => s.nama));
    expect(t.isi.data.kapan["Cerai Gugat|Dikabulkan|verstek"].dipakai).toBe("Putusan Cerai Gugat berstatus Dikabulkan (verstek).");
  });

  it("relaas: kunci buatan pengguna disimpan; yang asing ditandai, tidak dibuang", async () => {
    await panggil("PUT", {
      badan: {
        jenis: "relaas",
        butir: [
          { kunci: "relaas-panggilan-sidang-pertama-pemohon", namaBerkas: "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf" },
          { kunci: "panggilan-kuasa", namaBerkas: "[JS] Kuasa.rtf" },
        ],
      },
    });
    const r = await panggil("GET", { query: "jenis=relaas" });
    const kunci = r.isi.data.butir.map((b: any) => b.kunci);
    expect(kunci).toContain("relaas-panggilan-sidang-pertama-pemohon");
    expect(kunci).toContain("panggilan-kuasa");
    expect(r.isi.data.kapan["relaas-panggilan-sidang-pertama-pemohon"].dikenal).toBe(true);
    expect(r.isi.data.kapan["panggilan-kuasa"].dikenal).toBe(false);
    // Bentuk tiap butir (kontrak K3) tidak berubah.
    for (const b of r.isi.data.butir) expect(Object.keys(b).sort()).toEqual(["catatan", "diubahOleh", "diubahPada", "kunci", "namaBerkas", "sebutan", "sumber"]);
  });
});

// ============================================================================
// Panel ABT (abt.js): butir 7 BAS dan butir 3 status di putusan massal
// ============================================================================
const NOMOR = "544/Pdt.G/2026/PA.Dgl";
const ASAL_ABT = `${ASAL}/aps_badilag/index.php/abt`;
const ISI_BAS: Record<string, [string, string]> = {
  "0001": ["No Perkara", NOMOR],
  "0048": ["Jenis Perkara", "Cerai Gugat"],
  "0046": ["Sebutan P", "Penggugat"],
  "0047": ["Sebutan T", "Tergugat"],
  "0032": ["Tanggal Sidang", ""],
  "7101": ["Sidang Ke", ""],
  "7102": ["Agenda Sidang", "Mediasi"],
  "7103": ["Kehadiran Para Pihak", ""],
  "7104": ["Panitera Pengganti", ""],
};
const RINCIAN = {
  nomorPerkara: NOMOR,
  jenisPerkara: "Cerai Gugat",
  majelis: [{ kode: "1", nama: "Dra. Munifa, S.H.", jabatan: "Ketua Majelis" }],
  panitera: [{ kode: "2", nama: "Siti Aminah, S.H." }],
  saksi: { ada: false, jumlahSaksi: 0, jumlahKeterangan: 0, diajukanPihak1: 2, diajukanPihak2: 0, adaDiajukan: true },
  jadwalPerkara: [
    { sidangId: "1", urutanSidang: 1, tanggalSidang: "2026-09-10", agenda: "Pemeriksaan identitas", dihadiriOleh: 1, ditunda: true, alasanDitunda: "Mediasi" },
    { sidangId: "2", urutanSidang: 2, tanggalSidang: "2026-10-01", agenda: "Pembuktian", dihadiriOleh: 2, ditunda: true, alasanDitunda: "Pembuktian saksi" },
  ],
};

type MintaAbt = { url: string; cara: string; badan: string };
/**
 * 1.184.0 (butir 1): tipe variabel ABT lewat rute kamus. 0032 (Tanggal Sidang)
 * multi_sidang - dihitung ABT sendiri, tidak boleh diusulkan; sisanya data_teks.
 * `tanpaKamus` = rute tidak menjawab (tipe belum diketahui).
 */
const JENIS_BAS: Record<string, string> = { "0032": "multi_sidang" };

function bukaAbt(o: {
  peran: string;
  mode: "ui" | "baru" | "lama";
  judul?: string;
  tanpaKamus?: boolean;
  /** 1.184.0 (butir 23): variabel tambahan di blangko, mis. 5058 "TanyaJwb Saksi 1 P". */
  tambahIsi?: Record<string, [string, string]>;
}) {
  const baris = Object.entries({ ...ISI_BAS, ...(o.tambahIsi || {}) })
    .map(
      ([k, [nama, nilai]]) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>${nama}</td><td>${nilai}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>ABT</title></head><body><div id="wrapper"><div id="cssmenu"></div><div id="content"><div class="about" id="welcome">` +
      `<h3 class="w3l_header"><span>${NOMOR}</span></h3><h2>${o.judul ?? "BAS 2 P Hadir & T Tidak Hadir.rtf"}</h2>` +
      `<p class="cetak"><a id="cetak" href="${ASAL_ABT}/preview?c=10018&b=B&a=A">CETAK</a></p><table>${baris}</table></div></div></div></body></html>`,
    { url: `${ASAL_ABT}/main/view?a=A&b=B&c=10018`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: o.mode, ujiFitur: {}, ujiIzinkanNyata: true };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.178.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_p: unknown, b?: (x: unknown) => void) => b && b({ ok: true }), lastError: undefined },
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
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: MintaAbt[] = [];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (teks: string) => new Response(Buffer.from(teks, "latin1"), { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const badan = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan });
    if (url.includes("/aleta-bot/abt/usulan")) {
      const m = JSON.parse(badan || "{}");
      if (m.sumber === "siapa") return json({ data: { available: true, pengguna: { nama: "Siti Aminah", peran: o.peran }, kapabilitas: {} } });
      if (m.sumber === "sipp") {
        return json({ data: { available: true, sipp: { ok: true, usulan: [{ kode: "0032", nama: "Tanggal Sidang", nilai: "Rabu, 1 Oktober 2026", keyakinan: "pasti", sumber: [] }] } } });
      }
      return json({ data: { available: true } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { available: true, nomorPerkara: NOMOR, sipp: RINCIAN } });
    if (url.includes("/aleta-ecourt/kamus?jenis=")) {
      if (o.tanpaKamus) return json({ ok: false }, 404);
      const kode = decodeURIComponent(url.split("jenis=")[1] || "").split(",");
      return json({ ok: true, data: { ada: true, sumber: "abt", jenis: Object.fromEntries(kode.map((k) => [k, JENIS_BAS[k] || "data_teks"])) } });
    }
    if (url.includes("/edit_data?")) return cara === "POST" ? html("<b>DATA DISIMPAN</b>") : html('<input type="hidden" name="var_type" value="data_teks">');
    if (url.includes("/aleta-ecourt/bas-komentar")) return json({ ok: true, data: { komentar: [], saya: { id: "pp", nama: "PP", bolehMenulis: false, bolehMenyelesaikanSemua: false } } });
    if (url.includes("/aps_badilag/") && cara === "GET") return html("<html><body></body></html>");
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  w.confirm = () => true;
  w.eval(
    `${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);\n` +
      `window.__p3 = { status: p3PetaStatus, jenis: p3PetaJenis };`
  );
  const panel = () => w.document.getElementById("aleta-panel-abt");
  return { w, minta, panel, simpanan };
}

const tulisAbt = (h: { minta: MintaAbt[] }) => h.minta.filter((m) => m.cara === "POST" && m.url.includes("/edit_data"));

describe("butir 7 - blangko BAS: Isi dari SIPP & input ke ABT (BAS) untuk panitera/PP", () => {
  it("UI Baru + Panitera Pengganti: data sidang tampil, tanpa tulis sebelum klik, satu tombol menulis yang dicentang", async () => {
    const h = bukaAbt({ peran: "Panitera Pengganti", mode: "ui" });
    const bagian = await sampai(() => h.panel()?.querySelector(".aleta-p7-bas"), "bagian BAS");
    await sampai(() => bagian.querySelectorAll(".aleta-p7-baris").length >= 4, "daftar centang BAS");
    const teks = bagian.textContent || "";
    expect(teks).toContain("Sidang ke-2");
    expect(teks).toContain("Pembuktian");
    expect(teks).toContain("Penggugat hadir, Tergugat tidak hadir");
    expect(teks).toContain("Siti Aminah, S.H.");
    expect(teks).toContain("Ditunda - Pembuktian saksi");
    expect(bagian.querySelector(".aleta-lipat-peran")?.textContent).toBe("Panitera");
    const baris = Array.from(bagian.querySelectorAll(".aleta-p7-baris")) as any[];
    const kode = baris.map((b) => b.querySelector(".aleta-abt-nama").title.split(" ")[1]);
    // 7101/7103/7104 dari data sidang; 7102 (agenda) "Mediasi" diganti "Pembuktian".
    // 1.184.0 (butir 1): 0032 diusulkan bot tetapi bertipe multi_sidang - dihitung
    // ABT sendiri, jadi TIDAK diusulkan (sampai 1.183.0 tampil tercentang).
    expect(kode.sort()).toEqual(["7101", "7102", "7103", "7104"]);
    expect(bagian.textContent).toMatch(/dihitung ABT sendiri/);
    // Yang sudah terisi (agenda) tidak tercentang sendiri.
    const agenda = baris.find((b) => b.querySelector(".aleta-abt-nama").title.includes("7102"));
    expect(agenda.querySelector("input").checked).toBe(false);
    await tunggu(50);
    expect(tulisAbt(h)).toEqual([]);

    const tombol = bagian.querySelector(".aleta-p7-input") as HTMLButtonElement;
    expect(tombol.textContent).toBe("Input ke ABT (3)");
    tombol.click();
    await sampai(() => /3 variabel tersimpan ke ABT/.test(bagian.textContent || ""), "tersimpan");
    const ditulis = tulisAbt(h).map((m) => new URLSearchParams(m.url.split("?")[1]).get("no_var") || m.badan);
    expect(ditulis.length).toBe(3);
    // Tipe sudah dibaca sekali lewat kamus: tidak ada GET edit_data per variabel sebelum menulis.
    expect(h.minta.filter((m) => m.cara === "GET" && m.url.includes("/edit_data?"))).toEqual([]);
    // Tanpa penanda ALETA di isian ABT (butir 14).
    for (const m of tulisAbt(h)) expect(decodeURIComponent(m.badan)).not.toMatch(/ALETA/i);
  });

  it("1.184.0: tipe variabel tidak terbaca - usulan tetap tampil tetapi tidak dicentang sendiri", async () => {
    const h = bukaAbt({ peran: "Panitera Pengganti", mode: "ui", tanpaKamus: true });
    const bagian = await sampai(() => h.panel()?.querySelector(".aleta-p7-bas"), "bagian BAS");
    await sampai(() => bagian.querySelectorAll(".aleta-p7-baris").length >= 4, "daftar centang BAS");
    const baris = Array.from(bagian.querySelectorAll(".aleta-p7-baris")) as any[];
    expect(baris.some((b) => b.querySelector("input").checked)).toBe(false);
    expect(bagian.textContent).toMatch(/Tipe variabel ABT belum terbaca/);
    expect((bagian.querySelector(".aleta-p7-input") as HTMLButtonElement).textContent).toBe("Input ke ABT");
  });

  it("1.184.0 butir 23: blangko BAS dengan 5058 'TanyaJwb Saksi 1 P' (tanpa 2021) - Susun keterangan saksi tersedia di halaman perkara", async () => {
    const susun = (h: ReturnType<typeof bukaAbt>) =>
      (Array.from(h.panel()?.querySelectorAll("button") || []) as HTMLButtonElement[]).find((b) => b.textContent === "Susun keterangan saksi 1 & 2");
    const dengan = bukaAbt({
      peran: "Panitera Pengganti",
      mode: "ui",
      tambahIsi: { "1197": ["Nama Saksi 1 P", "Ahmad bin Madung"], "5058": ["TanyaJwb Saksi 1 P", "Saksi kenal dengan Penggugat;"] },
    });
    const tombolDengan = await sampai(() => susun(dengan), "tombol susun");
    expect(tombolDengan.hidden).toBe(false);
    await tunggu(300);
    expect(dengan.panel().textContent || "").not.toContain("Susun keterangan saksi tidak tersedia di blangko ini");
    // Blangko BAS tanpa satu pun variabel saksi: tetap tidak ditawarkan.
    const tanpa = bukaAbt({ peran: "Panitera Pengganti", mode: "ui" });
    const tombolTanpa = await sampai(() => susun(tanpa), "tombol susun (lama)");
    expect(tombolTanpa.hidden).toBe(true);
  });

  it("tidak tampil: tampilan Baru, Hakim, blangko bukan BAS; Admin melihatnya", async () => {
    const baru = bukaAbt({ peran: "Panitera Pengganti", mode: "baru" });
    await sampai(() => baru.panel(), "panel Baru");
    await tunggu(300);
    expect(baru.panel().querySelector(".aleta-p7-bas")).toBeNull();

    const hakim = bukaAbt({ peran: "Hakim", mode: "ui" });
    await sampai(() => hakim.panel()?.getAttribute("data-sore-golongan") === "hakim", "peran hakim");
    await tunggu(300);
    expect(hakim.panel().querySelector(".aleta-p7-bas")).toBeNull();

    const bukanBas = bukaAbt({ peran: "Panitera Pengganti", mode: "ui", judul: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf" });
    await sampai(() => bukanBas.panel()?.getAttribute("data-sore-golongan") === "panitera", "peran panitera");
    await tunggu(300);
    expect(bukanBas.panel().querySelector(".aleta-p7-bas")).toBeNull();

    const admin = bukaAbt({ peran: "Admin", mode: "ui" });
    await sampai(() => admin.panel()?.querySelector(".aleta-p7-bas"), "bagian BAS admin");
  });
});

describe("butir 3 - putusan massal ABT: baris khusus status menang atas utama dan jenis", () => {
  it("p3PetaStatus / p3PetaJenis", async () => {
    const h = bukaAbt({ peran: "Hakim", mode: "lama", judul: "x" });
    const peta = {
      "cerai gugat": { berkas: "jenis.rtf" },
      "cerai gugat|dikabulkan": { berkas: "kabul.rtf" },
      "cerai gugat|dikabulkan|verstek": { berkas: "kabul-verstek.rtf" },
    };
    const keadaan = { peta, statusSipp: { "2/Pdt.G/2026/PA.Dgl": { statusPutusan: "Dikabulkan", verstek: true } } };
    expect(h.w.__p3.status(keadaan, { nomor: "1/Pdt.G/2026/PA.Dgl", jenis: "Cerai Gugat", statusPutusan: "Dikabulkan" }).berkas).toBe("kabul.rtf");
    expect(h.w.__p3.status(keadaan, { nomor: "2/Pdt.G/2026/PA.Dgl", jenis: "Cerai Gugat", statusPutusan: "" }).berkas).toBe("kabul-verstek.rtf");
    expect(h.w.__p3.status(keadaan, { nomor: "3/Pdt.G/2026/PA.Dgl", jenis: "Cerai Gugat", statusPutusan: "Ditolak" })).toBeNull();
    expect(h.w.__p3.status(keadaan, { nomor: "3/Pdt.G/2026/PA.Dgl", jenis: "Cerai Gugat", statusPutusan: "" })).toBeNull();
    expect(h.w.__p3.jenis(keadaan, { nomor: "3/Pdt.G/2026/PA.Dgl", jenis: "CERAI GUGAT", statusPutusan: "Ditolak" }).berkas).toBe("jenis.rtf");
  });
});
