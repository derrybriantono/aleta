/**
 * ============================================================================
 * alatTipeKeluaran DAN alatSetelVersiTipe (K7) - DIJALANKAN, BUKAN DIBACA
 * ============================================================================
 *
 * panel-alat.js dijalankan di node:vm dengan chrome.storage dan fetch tiruan.
 * Jawaban portal disusun dengan aturan gabungan portal yang SESUNGGUHNYA
 * (gabungEfektif + versiDari atas CERMIN_EKSTENSI), jadi bentuknya bentuk
 * rute /ekstensi/tipe-keluaran, bukan bentuk yang dikarang uji ini.
 *
 * Yang dijaga:
 *   1. portal mati + singgahan kosong  -> tertanam, deep-equal dengan
 *      ALAT_PETA_BAWAAN dan ALAT_PADANAN_JENIS di berkas itu sendiri;
 *   2. versi sama -> 0 permintaan; versi berbeda -> tepat 1; portal gagal ->
 *      singgahan lama dengan asal 'singgahan';
 *   3. entri rusak ('#simpan', 'submit', '${', '<', baris baru) dibuang di
 *      klien, dan 0 yang sampai ke pemakai.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";
import { type BarisGabung, gabungEfektif, sidik, versiDari } from "@/lib/tipe-keluaran/gabung";
import type { EntriCermin, EntriTipe } from "@/lib/tipe-keluaran/kontrak";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const sumberAlat = readFileSync(path.join(AKAR, "panel-alat.js"), "utf8");
const ALAMAT_TIPE = "/aleta/api/aleta-ecourt/ekstensi/tipe-keluaran";

type Konteks = Record<string, any>;
type Jawab = { ok: boolean; status: number; json: () => Promise<unknown>; clone?: () => Jawab };

function elemenTiruan(tag: string): any {
  return {
    tagName: String(tag).toUpperCase(),
    className: "",
    textContent: "",
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    appendChild: (x: any) => x,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
}

/**
 * Satu peramban tiruan: penyimpanannya sendiri, portalnya lewat `portal`.
 * `permintaan` mencatat SETIAP fetch ke rute tipe keluaran.
 */
function peramban(portal: () => Promise<Jawab> | Jawab, simpananAwal: Record<string, unknown> = {}) {
  const simpanan: Record<string, unknown> = JSON.parse(JSON.stringify(simpananAwal));
  const permintaan: string[] = [];
  const peringatan: string[] = [];
  const konteks: Konteks = {
    console: { ...console, warn: (...x: unknown[]) => peringatan.push(x.map(String).join(" ")), log() {} },
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
      location: { hostname: "127.0.0.1", pathname: "/index.php", search: "", origin: "http://127.0.0.1" },
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
            for (const k of kunci) if (k in simpanan) hasil[k] = JSON.parse(JSON.stringify(simpanan[k]));
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
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
  const jalan = <T = any>(kode: string): T => vm.runInContext(kode, konteks);
  return { k: konteks, jalan, simpanan, permintaan, peringatan };
}

const polos = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** Jawaban rute ekstensi, disusun dengan aturan gabungan portal. */
function jawabanPortal(tambahan: Partial<Record<string, BarisGabung[]>> = {}, mati: Partial<Record<string, string[]>> = {}) {
  const daftar: Record<string, EntriTipe[]> = {};
  for (const [nama, cermin] of Object.entries(CERMIN_EKSTENSI)) {
    const kunci = nama as keyof typeof CERMIN_EKSTENSI;
    const baris: BarisGabung[] = [...(tambahan[nama] ?? [])];
    for (const nilai of mati[nama] ?? []) {
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
        dibuatAt: "2026-09-25T00:00:00.000Z",
      });
    }
    daftar[nama] = gabungEfektif(kunci, cermin, baris).entri;
  }
  return { ok: true, versi: versiDari(daftar), dibuatPada: "2026-09-25T00:00:00.000Z", daftar };
}

function tambahanBaris(daftar: string, kunci: string, nilai: string, data: Record<string, unknown>, urutan: number): BarisGabung {
  return {
    id: `t-${nilai}`,
    asal: "tambahan",
    sidik: sidik(daftar, kunci, nilai, data),
    aktif: true,
    keadaan: "disahkan",
    kunci,
    nilai,
    data,
    urutan,
    dibuatAt: "2026-09-25T01:00:00.000Z",
  };
}

const jawab200 = (isi: unknown): Jawab => ({ ok: true, status: 200, json: async () => polos(isi) });
const portalMati = () => Promise.reject(new TypeError("Failed to fetch"));

// ============================================================================
describe("1. portal mati dan singgahan kosong: sama persis dengan yang tertanam", () => {
  it("peta blangko dan padanan jenis deep-equal dengan ALAT_PETA_BAWAAN dan ALAT_PADANAN_JENIS", async () => {
    const p = peramban(portalMati);
    const petaTertanam = polos(p.jalan("ALAT_PETA_BAWAAN"));
    const padananTertanam = polos(p.jalan("ALAT_PADANAN_JENIS"));

    const peta = await p.jalan("alatPetaBawaanBerlaku()");
    expect(peta.asal).toBe("tertanam");
    expect(polos(peta.bawaan)).toEqual(petaTertanam);

    const padanan = await p.jalan("alatMuatPadananJenis()");
    expect(padanan.asal).toBe("tertanam");
    expect(polos(padanan.padanan)).toEqual(padananTertanam);

    // Yang dibaca pemakai pun sama: alatKunciJenis dan alatNamaLainJenis.
    expect(p.k.alatKunciJenis("Pengesahan Perkawinan/Istbat Nikah")).toBe("itsbat nikah");
    expect(p.k.alatKunciJenis("Wali Adhol")).toBe("wali adhal");
    expect(polos(p.k.alatNamaLainJenis("poligami"))).toEqual(["izin poligami"]);

    // Portal DITANYA (versinya belum diketahui), gagal, dan itu disebut.
    expect(p.permintaan.length).toBeGreaterThanOrEqual(1);
    expect(p.peringatan.some((x) => x.includes("tidak terbaca dari portal"))).toBe(true);
  });

  it("entri tertanam sama dengan cermin portal - bawaan portal dan tertanam tidak dapat berselisih", async () => {
    const p = peramban(portalMati);
    for (const daftar of ["putusan.peta-blangko", "putusan.padanan-jenis"] as const) {
      const hasil = await p.jalan(`alatTipeKeluaran(${JSON.stringify(daftar)})`);
      expect(hasil.asal).toBe("tertanam");
      const tanpaSidik = polos(hasil.entri).map((e: any) => ({ kunci: e.kunci, nilai: e.nilai, data: e.data, urutan: e.urutan }));
      expect(tanpaSidik).toEqual(CERMIN_EKSTENSI[daftar].map((e) => ({ ...e, data: (e as any).data ?? {} })));
    }
    // Pulang-pergi: jawaban portal yang berisi bawaan saja menghasilkan bentuk
    // yang SAMA PERSIS dengan konstanta tertanam - portal hidup tanpa tambahan
    // tidak mengubah apa pun di layar.
    const bawaanSaja = jawabanPortal();
    p.k.__peta = bawaanSaja.daftar["putusan.peta-blangko"];
    p.k.__padanan = bawaanSaja.daftar["putusan.padanan-jenis"];
    expect(polos(p.jalan("alatPetaBawaanDariEntri(__peta)"))).toEqual(polos(p.jalan("ALAT_PETA_BAWAAN")));
    expect(polos(p.jalan("alatPadananDariEntri(__padanan)"))).toEqual(polos(p.jalan("ALAT_PADANAN_JENIS")));
  });

  it("portal 503 (tabel tak terbaca) dan singgahan kosong: tertanam juga", async () => {
    const p = peramban(() => ({ ok: false, status: 503, json: async () => ({ ok: false, alasan: "basis_data_tidak_terbaca" }) }));
    const hasil = await p.jalan('alatTipeKeluaran("putusan.peta-blangko")');
    expect(hasil.asal).toBe("tertanam");
    expect(hasil.entri).toHaveLength(4);
  });
});

// ============================================================================
describe("2. versi sama 0 permintaan, versi berbeda tepat 1, portal gagal pakai singgahan lama", () => {
  const lama = jawabanPortal();
  const baru = jawabanPortal({
    "putusan.peta-blangko": [
      tambahanBaris("putusan.peta-blangko", "perwalian", "[01] [Kabul] Perwalian", { jenisAsli: "Perwalian" }, 4),
    ],
  });

  it("versi sama dengan singgahan: 0 permintaan, asal 'singgahan'", async () => {
    const p = peramban(() => jawab200(baru), { tipeKeluaran: { versi: lama.versi, pada: "2026-09-25", isi: lama.daftar } });
    expect(p.k.alatSetelVersiTipe(lama.versi)).toBe(lama.versi);
    const hasil = await p.jalan('alatTipeKeluaran("putusan.peta-blangko")');
    expect(p.permintaan).toHaveLength(0);
    expect(hasil.asal).toBe("singgahan");
    expect(hasil.entri).toHaveLength(4);
    // opsi.versiTipe sama berlakunya dengan alatSetelVersiTipe.
    const lagi = await p.jalan(`alatTipeKeluaran("putusan.padanan-jenis", { versiTipe: ${JSON.stringify(lama.versi)} })`);
    expect(lagi.asal).toBe("singgahan");
    expect(p.permintaan).toHaveLength(0);
  });

  it("versi berbeda: tepat 1 permintaan, singgahan diperbarui, pemanggilan berikutnya 0", async () => {
    const p = peramban(() => jawab200(baru), { tipeKeluaran: { versi: lama.versi, pada: "2026-09-25", isi: lama.daftar } });
    p.k.alatSetelVersiTipe(baru.versi);
    const hasil = await p.jalan('alatTipeKeluaran("putusan.peta-blangko")');
    expect(p.permintaan).toHaveLength(1);
    expect(hasil.asal).toBe("portal");
    expect(hasil.entri.map((e: any) => e.kunci)).toContain("perwalian");
    expect((p.simpanan.tipeKeluaran as any).versi).toBe(baru.versi);
    // Daftar lain, versi yang sama - dari singgahan yang baru ditulis.
    const padanan = await p.jalan('alatTipeKeluaran("putusan.padanan-jenis")');
    expect(padanan.asal).toBe("singgahan");
    expect(p.permintaan).toHaveLength(1);
  });

  it("versi belum diketahui: dua pemanggil sejajar berbagi SATU permintaan, lalu versinya diingat", async () => {
    const p = peramban(() => jawab200(baru));
    const [a, b] = await p.jalan(
      'Promise.all([alatTipeKeluaran("putusan.peta-blangko"), alatTipeKeluaran("putusan.padanan-jenis")])'
    );
    expect(p.permintaan).toHaveLength(1);
    expect(a.asal).toBe("portal");
    expect(b.asal).toBe("portal");
    const ketiga = await p.jalan('alatTipeKeluaran("putusan.peta-blangko")');
    expect(ketiga.asal).toBe("singgahan");
    expect(p.permintaan).toHaveLength(1);
  });

  it("portal gagal: singgahan lama dipakai dengan asal 'singgahan' - tambahan sah tidak hilang", async () => {
    const p = peramban(portalMati, { tipeKeluaran: { versi: baru.versi, pada: "2026-09-25", isi: baru.daftar } });
    p.k.alatSetelVersiTipe("0123456789abcdef");
    const hasil = await p.jalan('alatTipeKeluaran("putusan.peta-blangko")');
    expect(hasil.asal).toBe("singgahan");
    expect(hasil.entri.map((e: any) => e.kunci)).toContain("perwalian");
    // Baru saja gagal untuk versi yang sama: tidak ditanya lagi seketika.
    await p.jalan('alatTipeKeluaran("putusan.padanan-jenis")');
    expect(p.permintaan.length).toBeLessThanOrEqual(2); // satu percobaan + satu ulangan alatAmbil
    const sebelum = p.permintaan.length;
    await p.jalan('alatTipeKeluaran("putusan.peta-blangko")');
    expect(p.permintaan.length).toBe(sebelum);
  });

  it("portal menyatakan versiTipe null: tidak ditanya, singgahan lama dipakai", async () => {
    const p = peramban(() => jawab200(baru), { tipeKeluaran: { versi: lama.versi, pada: "2026-09-25", isi: lama.daftar } });
    p.k.alatSetelVersiTipe(null);
    const hasil = await p.jalan('alatTipeKeluaran("putusan.peta-blangko")');
    expect(p.permintaan).toHaveLength(0);
    expect(hasil.asal).toBe("singgahan");
  });

  it("jawaban 200 yang bentuknya salah dihitung gagal dan tidak menimpa singgahan", async () => {
    const p = peramban(() => jawab200({ ok: true }), { tipeKeluaran: { versi: baru.versi, pada: "2026-09-25", isi: baru.daftar } });
    p.k.alatSetelVersiTipe(lama.versi);
    const hasil = await p.jalan('alatTipeKeluaran("putusan.peta-blangko")');
    expect(hasil.asal).toBe("singgahan");
    expect((p.simpanan.tipeKeluaran as any).versi).toBe(baru.versi);
  });

  it("penyimpanan yang melempar tidak mematahkan pembacaan", async () => {
    const p = peramban(portalMati);
    p.k.chrome.storage.local.get = async () => {
      throw new Error("storage mati");
    };
    const hasil = await p.jalan('alatTipeKeluaran("putusan.padanan-jenis")');
    expect(hasil.asal).toBe("tertanam");
    expect(p.peringatan.some((x) => x.includes("Singgahan tipe keluaran tidak terbaca"))).toBe(true);
  });
});

// ============================================================================
describe("3. entri rusak dibuang di klien - 0 yang sampai ke pemakai", () => {
  const RUSAK_MEDAN = [
    { kunci: "putusan-akhir", nilai: "Tombol Simpan", data: { penunjuk: "#simpan" } },
    { kunci: "putusan-akhir", nilai: "Kirim", data: { penunjuk: 'button[name="submit"]' } },
    { kunci: "putusan-akhir", nilai: "Sisip ${alert(1)}", data: { penunjuk: 'select[name="x"]' } },
    { kunci: "putusan-akhir", nilai: "<b>tebal</b>", data: { penunjuk: 'select[name="y"]' } },
    { kunci: "putusan-akhir", nilai: "dua\nbaris", data: { penunjuk: 'select[name="z"]' } },
    { kunci: "putusan-akhir", nilai: "Penunjuk aneh", data: { penunjuk: "form > button" } },
  ];
  const tertanamMedan = CERMIN_EKSTENSI["putusan.medan-borang"];

  function portalRusak() {
    const isi = jawabanPortal();
    isi.daftar["putusan.medan-borang"] = [
      ...isi.daftar["putusan.medan-borang"],
      ...RUSAK_MEDAN.map((e, i) => ({ ...e, urutan: 20 + i, asal: "tambahan", sidik: "x" }) as EntriTipe),
    ];
    isi.daftar["putusan.padanan-jenis"] = [
      ...isi.daftar["putusan.padanan-jenis"],
      { kunci: "perwalian", nilai: "perwalian ${x}", data: {}, urutan: 30, asal: "tambahan", sidik: "y" },
      { kunci: "perwalian", nilai: "perwalian anak", data: {}, urutan: 31, asal: "tambahan", sidik: "z" },
    ];
    return isi;
  }

  it("dari portal: keenam medan rusak dibuang, 12 medan sah tetap, dan pembuangannya disebut", async () => {
    const p = peramban(() => jawab200(portalRusak()));
    const hasil = await p.jalan(
      `alatTipeKeluaran("putusan.medan-borang", { tertanam: ${JSON.stringify(tertanamMedan)} })`
    );
    expect(hasil.asal).toBe("portal");
    expect(hasil.dibuang).toBe(6);
    expect(hasil.entri).toHaveLength(12);
    const semuaTeks = JSON.stringify(hasil.entri);
    for (const larangan of ["#simpan", "submit", "${", "<", "\\n", "form > button"]) expect(semuaTeks).not.toContain(larangan);
    expect(p.peringatan.some((x) => x.includes("6 entri dibuang"))).toBe(true);
  });

  it("dari singgahan yang disunting tangan: sama dibuangnya", async () => {
    const isi = portalRusak();
    const p = peramban(portalMati, { tipeKeluaran: { versi: isi.versi, pada: "2026-09-25", isi: isi.daftar } });
    p.k.alatSetelVersiTipe(isi.versi);
    const hasil = await p.jalan(`alatTipeKeluaran("putusan.medan-borang", { tertanam: [] })`);
    expect(hasil.asal).toBe("singgahan");
    expect(hasil.dibuang).toBe(6);
    expect(JSON.stringify(hasil.entri)).not.toMatch(/simpan|submit|\$\{|</i);
  });

  it("padanan berisi '${' tidak pernah dipadankan; padanan sah dari portal berlaku", async () => {
    const p = peramban(() => jawab200(portalRusak()));
    const hasil = await p.jalan("alatMuatPadananJenis()");
    expect(hasil.asal).toBe("portal");
    expect(p.k.alatKunciJenis("Perwalian Anak")).toBe("perwalian");
    expect(p.k.alatKunciJenis("perwalian ${x}")).toBe("perwalian ${x}");
    expect(JSON.stringify(hasil.padanan)).not.toContain("${");
  });

  it("daftar tanpa tertanam dan daftar asing ditolak dengan galat, bukan dijawab kosong", async () => {
    const p = peramban(portalMati);
    await expect(p.jalan('alatTipeKeluaran("putusan.medan-borang")')).rejects.toThrow(/tertanam/);
    await expect(p.jalan('alatTipeKeluaran("bas.saksi.bentuk")')).rejects.toThrow(/tidak dibaca ekstensi/);
  });
});

// Tanda bahwa uji ini benar-benar menjalankan berkasnya, bukan membaca teks.
describe("alatSetelVersiTipe menyaring versi", () => {
  it("hanya 16 hex yang diterima", () => {
    const p = peramban(portalMati);
    expect(p.k.alatSetelVersiTipe("bukan-versi")).toBeUndefined();
    expect(p.k.alatSetelVersiTipe(null)).toBeNull();
    expect(p.k.alatSetelVersiTipe("abcdef0123456789")).toBe("abcdef0123456789");
  });
});
