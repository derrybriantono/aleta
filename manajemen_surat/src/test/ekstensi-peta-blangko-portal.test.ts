/**
 * ============================================================================
 * PETA BLANGKO DARI PORTAL, TOKEN a/b TETAP PER PERAMBAN
 * ============================================================================
 *
 * alatMuatPetaBlangkoLengkap dijalankan sungguhan (node:vm) pada DUA peramban
 * tiruan yang masing-masing punya penyimpanan sendiri. Portalnya satu, dan
 * jawabannya disusun dengan aturan gabungan portal yang sesungguhnya.
 *
 * Yang dijaga:
 *   - satu jenis tambahan (Wasiat) yang disahkan di portal masuk ke peta
 *     KEDUA peramban tanpa penyuntingan per peramban: cakupan 4 -> 5 jenis;
 *   - token a/b tiap peramban tetap miliknya - tidak tertukar, tidak hilang;
 *   - bawaan yang dimatikan portal lenyap dari baris bawaan, tetapi baris yang
 *     pernah disunting tangan tidak disentuh;
 *   - nama berkas yang diganti portal melepas token (supaya diambil ulang),
 *     sedangkan nama yang sama dengan akhiran .RTF TIDAK - kalau ya, setiap
 *     pemuatan akan memindai ulang seluruh ABT;
 *   - tanpa portal: tidak ada yang dihapus atau disetel ulang.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";
import { type BarisGabung, gabungEfektif, sidik, versiDari } from "@/lib/tipe-keluaran/gabung";
import type { EntriTipe } from "@/lib/tipe-keluaran/kontrak";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const sumberAlat = readFileSync(path.join(AKAR, "panel-alat.js"), "utf8");
const ALAMAT_TIPE = "/aleta/api/aleta-ecourt/ekstensi/tipe-keluaran";
const KUNCI_PETA = "petaBlangkoPutusan";
const CERAI = "[01] [Kabul Verstek] Cerai (Format Lengkap)";

type Jawab = { ok: boolean; status: number; json: () => Promise<unknown>; clone?: () => Jawab };
const polos = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function elemenTiruan(tag: string): any {
  return {
    tagName: String(tag).toUpperCase(),
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    getAttribute: () => null,
    appendChild: (x: any) => x,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
}

function peramban(portal: () => Promise<Jawab> | Jawab, simpananAwal: Record<string, unknown> = {}) {
  const simpanan: Record<string, unknown> = polos(simpananAwal);
  const permintaan: string[] = [];
  const konteks: Record<string, any> = {
    console: { ...console, warn() {}, log() {} },
    setTimeout,
    clearTimeout,
    AbortController,
    URLSearchParams,
    URL,
    document: {
      documentElement: elemenTiruan("html"),
      createElement: (t: string) => elemenTiruan(t),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    location: { origin: "http://127.0.0.1", pathname: "/aps_badilag/abt/main/beranda", search: "" },
    window: {
      location: { hostname: "127.0.0.1", pathname: "/aps_badilag/abt/main/beranda", search: "", origin: "http://127.0.0.1" },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (p: string) => p },
      storage: {
        onChanged: { addListener() {} },
        local: {
          get: async (kunci: string[]) => {
            const hasil: Record<string, unknown> = {};
            for (const k of kunci) if (k in simpanan) hasil[k] = polos(simpanan[k]);
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
          remove: async (kunci: string[]) => {
            for (const k of [kunci].flat()) delete simpanan[k];
          },
        },
      },
    },
    fetch: async (url: string) => {
      if (String(url).includes(ALAMAT_TIPE)) {
        permintaan.push(String(url));
        const r = await portal();
        if (typeof r.clone !== "function") r.clone = () => r;
        return r;
      }
      const r: Jawab = { ok: true, status: 200, json: async () => ({ ok: true }) };
      r.clone = () => r;
      return r;
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(sumberAlat, konteks, { filename: "panel-alat.js" });
  const muat = async () => polos(await vm.runInContext("alatMuatPetaBlangkoLengkap()", konteks)) as Record<string, any>;
  return { k: konteks, muat, simpanan, permintaan };
}

function baris(daftar: string, e: { kunci: string; nilai: string; data?: Record<string, unknown>; urutan: number }, lain: Partial<BarisGabung>): BarisGabung {
  return {
    id: `${lain.asal}-${e.nilai}`,
    asal: "tambahan",
    sidik: sidik(daftar, e.kunci, e.nilai, e.data),
    aktif: true,
    keadaan: "disahkan",
    kunci: e.kunci,
    nilai: e.nilai,
    data: e.data ?? {},
    urutan: e.urutan,
    dibuatAt: "2026-09-25T01:00:00.000Z",
    ...lain,
  };
}

/** Jawaban rute ekstensi dengan baris tabel peta blangko dan padanan yang disebut. */
function portalDengan(barisPeta: BarisGabung[], barisPadanan: BarisGabung[] = []) {
  const daftar: Record<string, EntriTipe[]> = {};
  for (const [nama, cermin] of Object.entries(CERMIN_EKSTENSI)) {
    const b = nama === "putusan.peta-blangko" ? barisPeta : nama === "putusan.padanan-jenis" ? barisPadanan : [];
    daftar[nama] = gabungEfektif(nama as keyof typeof CERMIN_EKSTENSI, cermin, b).entri;
  }
  const isi = { ok: true, versi: versiDari(daftar), dibuatPada: "2026-09-25T00:00:00.000Z", daftar };
  return () => ({ ok: true, status: 200, json: async () => polos(isi) }) as Jawab;
}

const WASIAT = { kunci: "jenis uji tambahan", nilai: "[01] [Kabul] Wasiat", data: { jenisAsli: "Wasiat" }, urutan: 4 };
const PADANAN_WASIAT = { kunci: "jenis uji tambahan", nilai: "wasiat khusus", urutan: 10 };
const portalMati = () => Promise.reject(new TypeError("Failed to fetch"));

/** Peta yang sudah pernah dipakai di satu peramban: cerai gugat bertoken. */
function petaBertoken(a: string, b: string) {
  return {
    [KUNCI_PETA]: {
      "cerai gugat": {
        jenisAsli: "Cerai Gugat",
        berkas: `${CERAI}.RTF`,
        blangko: "Putusan Cerai Gugat",
        blangkoDiminta: "Putusan Cerai Gugat",
        blangkoLain: ["Putusan CG"],
        bawaan: true,
        a,
        b,
        d: "",
        disimpanPada: "2026-09-20T00:00:00.000Z",
      },
    },
  };
}

/** Kunci peta bawaan ekstensi (cermin putusan.peta-blangko), urut abjad. */
const KUNCI_BAWAAN = CERMIN_EKSTENSI["putusan.peta-blangko"].map((e) => e.kunci).sort();

// ============================================================================
describe("satu jenis tambahan di portal berlaku untuk dua peramban, token tetap per peramban", () => {
  // Jumlah bawaan dihitung dari cermin, bukan diketik. Jenis tambahan dipilih yang TIDAK berbawaan (kunci rekaan "jenis uji tambahan": Wasiat dan Perwalian sudah bawaan sejak pemetaan 16-17 Okt).
  it("tanpa portal: semua jenis bawaan; dengan Wasiat disahkan di portal: bawaan + 1 di KEDUA peramban", async () => {
    const tanpa = peramban(portalMati);
    const petaTanpa = await tanpa.muat();
    expect(Object.keys(petaTanpa).sort()).toEqual(KUNCI_BAWAAN);

    const portal = portalDengan(
      [baris("putusan.peta-blangko", WASIAT, { asal: "tambahan" })],
      [baris("putusan.padanan-jenis", PADANAN_WASIAT, { asal: "tambahan" })]
    );
    const A = peramban(portal, petaBertoken("tokenAAAAAAAA~1", "tokenBBBBBBBB~1"));
    const B = peramban(portal, petaBertoken("tokenCCCCCCCC~2", "tokenDDDDDDDD~2"));
    const petaA = await A.muat();
    const petaB = await B.muat();

    for (const peta of [petaA, petaB]) {
      expect(Object.keys(peta)).toHaveLength(KUNCI_BAWAAN.length + 1);
      expect(peta["jenis uji tambahan"]).toMatchObject({ jenisAsli: "Wasiat", berkas: "[01] [Kabul] Wasiat", bawaan: true });
    }
    // Token a/b milik masing-masing peramban, tidak tertukar dan tidak dilepas
    // (berkasnya berakhiran .RTF - nama yang SAMA menurut alatKunciBerkas).
    expect([petaA["cerai gugat"].a, petaA["cerai gugat"].b]).toEqual(["tokenAAAAAAAA~1", "tokenBBBBBBBB~1"]);
    expect([petaB["cerai gugat"].a, petaB["cerai gugat"].b]).toEqual(["tokenCCCCCCCC~2", "tokenDDDDDDDD~2"]);
    // Tersimpan di penyimpanan peramban masing-masing, bukan dikirim ke portal.
    expect((A.simpanan[KUNCI_PETA] as any)["jenis uji tambahan"].berkas).toBe("[01] [Kabul] Wasiat");
    expect((A.simpanan[KUNCI_PETA] as any)["cerai gugat"].a).toBe("tokenAAAAAAAA~1");
    // Satu permintaan per peramban: padanan lalu peta memakai versi yang sama.
    expect(A.permintaan).toHaveLength(1);
    expect(B.permintaan).toHaveLength(1);
    // Padanan dari portal ikut berlaku: nama lain SIPP menunjuk baris baru.
    expect(A.k.alatKunciJenis("Wasiat Khusus")).toBe("jenis uji tambahan");
    expect(petaA[A.k.alatKunciJenis("Wasiat Khusus")].berkas).toBe("[01] [Kabul] Wasiat");
  });

  it("pemuatan kedua tidak mengubah apa pun - tidak ada putaran lepas-ambil token", async () => {
    const portal = portalDengan([baris("putusan.peta-blangko", WASIAT, { asal: "tambahan" })]);
    const A = peramban(portal, petaBertoken("tokenAAAAAAAA~1", "tokenBBBBBBBB~1"));
    // Pemuatan pertama menyisipkan baris bawaan; yang kedua melengkapi
    // blangkoDiminta pada baris bawaan bermenu (perilaku lama, sebelum portal).
    // Sesudah itu tidak boleh ada lagi yang berubah.
    await A.muat();
    const kedua = await A.muat();
    const ketiga = await A.muat();
    expect(ketiga).toEqual(kedua);
    expect(kedua["cerai gugat"].a).toBe("tokenAAAAAAAA~1");
  });
});

// ============================================================================
describe("bawaan yang dimatikan atau diganti di portal", () => {
  const dispensasi = CERMIN_EKSTENSI["putusan.peta-blangko"].find((e) => e.kunci === "dispensasi kawin")!;
  const ceraiGugat = CERMIN_EKSTENSI["putusan.peta-blangko"].find((e) => e.kunci === "cerai gugat")!;

  it("dispensasi dimatikan: baris bawaannya lenyap; baris sunting tangan untuk jenis yang sama bertahan", async () => {
    const portal = portalDengan([baris("putusan.peta-blangko", dispensasi, { asal: "bawaan", aktif: false })]);
    const A = peramban(portal);
    const peta = await A.muat();
    expect(peta["dispensasi kawin"]).toBeUndefined();
    expect(Object.keys(peta)).toHaveLength(KUNCI_BAWAAN.length - 1);

    const B = peramban(portal, {
      [KUNCI_PETA]: { "dispensasi kawin": { jenisAsli: "Dispensasi Kawin", berkas: "Pilihan saya", bawaan: false } },
    });
    const petaB = await B.muat();
    expect(petaB["dispensasi kawin"].berkas).toBe("Pilihan saya");
  });

  it("berkas cerai gugat diganti di portal: token dilepas supaya diambil ulang dari berkas baru", async () => {
    const baru = { ...ceraiGugat, nilai: "[02] [Kabul] Cerai Baru", urutan: 0 };
    const portal = portalDengan([
      baris("putusan.peta-blangko", ceraiGugat, { asal: "bawaan", aktif: false }),
      baris("putusan.peta-blangko", baru, { asal: "tambahan" }),
    ]);
    const A = peramban(portal, petaBertoken("tokenAAAAAAAA~1", "tokenBBBBBBBB~1"));
    const peta = await A.muat();
    expect(peta["cerai gugat"]).toMatchObject({ berkas: "[02] [Kabul] Cerai Baru", a: "", b: "", bawaan: true });
    expect(peta["cerai gugat"].catatan).toMatch(/token diambil ulang/);
  });

  it("tanpa portal tidak ada yang dihapus atau disetel ulang - sama dengan sebelum portal ada", async () => {
    const simpan = {
      [KUNCI_PETA]: {
        ...petaBertoken("tokenAAAAAAAA~1", "tokenBBBBBBBB~1")[KUNCI_PETA],
        // Nama lama dari pemasangan terdahulu, baris bawaan - tanpa portal ia tetap.
        "dispensasi kawin": { jenisAsli: "Dispensasi Kawin", berkas: "DK (Full) Perempuan Hamil V.2", bawaan: true },
        "harta bersama": { jenisAsli: "Harta Bersama", berkas: "[01] HB", bawaan: true },
      },
    };
    const A = peramban(portalMati, simpan);
    const peta = await A.muat();
    expect(peta["dispensasi kawin"].berkas).toBe("DK (Full) Perempuan Hamil V.2");
    expect(peta["harta bersama"].berkas).toBe("[01] HB");
    expect(peta["cerai gugat"].a).toBe("tokenAAAAAAAA~1");
    expect(Object.keys(peta).sort()).toEqual(KUNCI_BAWAAN);
  });
});
