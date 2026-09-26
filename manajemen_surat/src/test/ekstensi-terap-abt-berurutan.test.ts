// @vitest-environment node
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * "TERAPKAN YANG DICENTANG" MENULIS SATU PER SATU, TANPA JEDA BUATAN
 * ============================================================================
 *
 * Keputusan orkestrator 25 September 2026: ALETA tidak membangun jeda yang
 * tujuannya membuat kerja otomatis tampak seperti kerja tangan. Terapkan
 * karena itu menulis BERURUTAN - satu edit_data dalam satu waktu - dan tidak
 * menunggu apa pun selain jawaban ABT. Riwayat per variabel tetap dicatat,
 * dan variabel yang ditolak tetap disebut.
 *
 * panel-alat.js dan abt.js dimuat SUNGGUHAN ke satu konteks node:vm - dunia
 * yang sama dengan skrip isi Chrome - lalu terapkanUsulanBerurutan dijalankan
 * dengan jam tiruan dan rute edit_data ABT tiruan.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
// ALETA_UJI_PANEL_ALAT / ALETA_UJI_ABT hanya dipakai skrip pembukti gigitan:
// cacat dipasang pada SALINAN, bukan pada berkas yang dipakai agen/uji lain.
const SUMBER_ALAT = readFileSync(process.env.ALETA_UJI_PANEL_ALAT || path.join(AKAR, "panel-alat.js"), "utf8");
const SUMBER_ABT = readFileSync(process.env.ALETA_UJI_ABT || path.join(AKAR, "abt.js"), "utf8");

type Konteks = Record<string, any>;
type Permintaan = { pada: number; selesai: number; cara: string; alamat: string; badan: string };

function elemenTiruan(): any {
  return {
    textContent: "",
    className: "",
    hidden: false,
    disabled: false,
    title: "",
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    appendChild: (x: unknown) => x,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
}

/** Jam tiruan: setTimeout/setInterval/Date dikendalikan uji. */
function buatJam(mulai = Date.UTC(2026, 8, 25, 1, 0, 0)) {
  let kini = mulai;
  let nomor = 0;
  const antre = new Map<number, { id: number; pada: number; fn: () => void; ulang: number }>();
  const pasang = (fn: (...a: unknown[]) => void, ms: unknown, ulang: boolean, arg: unknown[]) => {
    nomor += 1;
    const selang = Math.max(ulang ? 1 : 0, Number(ms) || 0);
    antre.set(nomor, { id: nomor, pada: kini + selang, fn: () => fn(...arg), ulang: ulang ? selang : 0 });
    return nomor;
  };
  const hapus = (id: unknown) => void antre.delete(Number(id));
  class TanggalTiruan extends Date {
    constructor(...arg: any[]) {
      if (arg.length === 0) super(kini);
      else super(...(arg as [number]));
    }
    static now() {
      return kini;
    }
  }
  const alirkan = () => new Promise<void>((r) => setImmediate(r));
  // Janji dari konteks vm tidak bertipe; hasilnya diperiksa uji satu per satu.
  async function sampaiSelesai(janji: Promise<any>): Promise<any> {
    let selesai = false;
    let hasil: any;
    let galat: unknown = null;
    janji.then(
      (h) => {
        selesai = true;
        hasil = h;
      },
      (g) => {
        selesai = true;
        galat = g ?? new Error("ditolak");
      }
    );
    for (let langkah = 0; langkah < 100000; langkah += 1) {
      await alirkan();
      if (selesai) break;
      let berikut: { id: number; pada: number; fn: () => void; ulang: number } | null = null;
      for (const p of antre.values()) {
        if (!berikut || p.pada < berikut.pada || (p.pada === berikut.pada && p.id < berikut.id)) berikut = p;
      }
      if (!berikut) throw new Error("macet: janji belum selesai dan tidak ada pewaktu");
      kini = Math.max(kini, berikut.pada);
      if (berikut.ulang) berikut.pada = kini + berikut.ulang;
      else antre.delete(berikut.id);
      berikut.fn();
    }
    if (!selesai) throw new Error("batas langkah habis");
    if (galat) throw galat;
    return hasil;
  }
  return {
    setTimeout: (fn: (...a: unknown[]) => void, ms?: number, ...arg: unknown[]) => pasang(fn, ms, false, arg),
    setInterval: (fn: (...a: unknown[]) => void, ms?: number, ...arg: unknown[]) => pasang(fn, ms, true, arg),
    clearTimeout: hapus,
    clearInterval: hapus,
    Date: TanggalTiruan,
    sekarang: () => kini,
    tunda: (ms: number) => new Promise<void>((r) => pasang(r as () => void, ms, false, [])),
    sampaiSelesai,
  };
}

function jawaban(status: number, badan: string) {
  const r: any = {
    ok: status >= 200 && status < 300,
    status,
    text: async () => badan,
    json: async () => JSON.parse(badan),
    arrayBuffer: async () => new TextEncoder().encode(badan).buffer,
  };
  r.clone = () => r;
  return r;
}

/** Halaman blangko ABT tiruan dengan panel-alat.js + abt.js yang sungguhan. */
function muatAbt(opsi: { tolak?: Set<string>; latensiMs?: number } = {}) {
  const tolak = opsi.tolak || new Set<string>();
  const jam = buatJam();
  const simpanan: Record<string, unknown> = {};
  const permintaan: Permintaan[] = [];
  let terbang = 0;
  const pantau = { terbangMaks: 0 };
  const k: Konteks = {
    console,
    setTimeout: jam.setTimeout,
    clearTimeout: jam.clearTimeout,
    setInterval: jam.setInterval,
    clearInterval: jam.clearInterval,
    Date: jam.Date,
    URLSearchParams,
    URL,
    AbortController,
    TextDecoder,
    TextEncoder,
    Blob,
    FormData,
    crypto: webcrypto,
    document: {
      title: "",
      documentElement: elemenTiruan(),
      body: elemenTiruan(),
      createElement: () => elemenTiruan(),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    location: {
      origin: "http://127.0.0.1:8056",
      pathname: "/aps_badilag/index.php/abt/main/view",
      search: "?a=A&b=B&c=10018&d=3",
    },
    window: {
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "uji" }), getURL: (p: string) => p, sendMessage: () => {} },
      storage: {
        onChanged: { addListener() {} },
        local: {
          get: async (kunci: string[]) => Object.fromEntries(kunci.filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
          remove: async () => {},
        },
      },
    },
    fetch: async (alamat: string, o: any = {}) => {
      const cara = String(o.method || "GET").toUpperCase();
      const badan = typeof o.body === "string" ? o.body : "";
      const catatan: Permintaan = { pada: jam.sekarang(), selesai: 0, cara, alamat: String(alamat), badan };
      permintaan.push(catatan);
      if (String(alamat).includes("/edit_data?")) {
        terbang += 1;
        pantau.terbangMaks = Math.max(pantau.terbangMaks, terbang);
        try {
          if (opsi.latensiMs) await jam.tunda(opsi.latensiMs);
          if (cara === "GET") return jawaban(200, '<form><input type="hidden" name="var_type" value="data_teks"></form>');
          const kode = new URL(String(alamat)).searchParams.get("no_var") || "";
          return jawaban(200, tolak.has(kode) ? "DATA TIDAK TERSIMPAN" : "<font color='green'>DATA DISIMPAN</font>");
        } finally {
          terbang -= 1;
          catatan.selesai = jam.sekarang();
        }
      }
      catatan.selesai = jam.sekarang();
      if (String(alamat).includes("/abt-riwayat")) return jawaban(200, '{"ok":true}');
      return jawaban(404, "{}");
    },
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(SUMBER_ALAT, k, { filename: "panel-alat.js" });
  vm.runInContext(SUMBER_ABT, k, { filename: "abt.js" });
  return { k, jam, simpanan, permintaan, pantau };
}

/** Enam isian bentuk 10018 - tanpa nama pihak. */
const ENAM = [
  { kode: "0222", nama: "Sejak kapan tidak rukun", nilai: "bulan Maret 2020" },
  { kode: "0246", nama: "Sejak kapan pisah", nilai: "bulan Juni 2023" },
  { kode: "9944", nama: "Lama pisah", nilai: "2 (dua) tahun 3 (tiga) bulan" },
  { kode: "7035", nama: "Yang meninggalkan", nilai: "Tergugat" },
  { kode: "1268", nama: "Upaya damai", nilai: "pihak keluarga telah berupaya merukunkan Penggugat dan Tergugat namun tidak berhasil" },
  { kode: "5227", nama: "Alasan", nilai: "Tergugat tidak memberi nafkah dan sering bertengkar dengan Penggugat" },
];

function kartu(disuntingKode = "") {
  return ENAM.map((u) => ({
    usulan: { ...u, keyakinan: "pasti", sumber: [{ saksi: 1, kalimat: "xxx" }] },
    centang: { checked: true, disabled: false },
    nilai: () => (u.kode === disuntingKode ? `${u.nilai} (disunting)` : u.nilai),
    disunting: () => u.kode === disuntingKode,
  }));
}

const JATI_DIRI = { perkaraId: "10018", perkTemp: "" };
const postEditData = (p: Permintaan[]) => p.filter((x) => x.cara === "POST" && x.alamat.includes("/edit_data?"));

describe("Terapkan 6 variabel - berurutan, tanpa jeda buatan (jam tiruan)", () => {
  it("tiap POST edit_data dikirim sesudah jawaban sebelumnya: tidak pernah dua permintaan sekaligus", async () => {
    const { k, jam, permintaan, pantau } = muatAbt({ latensiMs: 400 });
    const hasil = await jam.sampaiSelesai(k.terapkanUsulanBerurutan(kartu(), JATI_DIRI, () => {}));
    expect(hasil).toEqual({ berhasil: 6, gagal: [] });
    expect(pantau.terbangMaks).toBe(1);
    const post = postEditData(permintaan);
    expect(post.map((x) => new URL(x.alamat).searchParams.get("no_var"))).toEqual(ENAM.map((x) => x.kode));
    for (let i = 1; i < post.length; i += 1) expect(post[i].pada).toBeGreaterThanOrEqual(post[i - 1].selesai);
  });

  it("tidak menunggu apa pun selain jawaban ABT: lama seluruhnya = jumlah latensi edit_data", async () => {
    const tanpa = muatAbt();
    const mulai = tanpa.jam.sekarang();
    await tanpa.jam.sampaiSelesai(tanpa.k.terapkanUsulanBerurutan(kartu(), JATI_DIRI, () => {}));
    expect(tanpa.jam.sekarang() - mulai).toBe(0);

    const dengan = muatAbt({ latensiMs: 400 });
    const mulai2 = dengan.jam.sekarang();
    await dengan.jam.sampaiSelesai(dengan.k.terapkanUsulanBerurutan(kartu(), JATI_DIRI, () => {}));
    const edit = dengan.permintaan.filter((x) => x.alamat.includes("/edit_data?"));
    // Satu GET (tipe variabel, diingat per kode) dan satu POST per variabel.
    expect(edit).toHaveLength(12);
    expect(dengan.jam.sekarang() - mulai2).toBe(12 * 400);
  });

  it("riwayat tetap dicatat per variabel - dan yang disunting petugas disebut begitu", async () => {
    const { k, jam, simpanan, permintaan } = muatAbt();
    await jam.sampaiSelesai(k.terapkanUsulanBerurutan(kartu("1268"), JATI_DIRI, () => {}));
    await jam.sampaiSelesai(Promise.resolve());
    const riwayat = simpanan.abtRiwayat as Array<{ kode: string; cara: string; sesudah: string }>;
    expect(riwayat.map((x) => x.kode).sort()).toEqual(ENAM.map((x) => x.kode).sort());
    const cara = Object.fromEntries(riwayat.map((x) => [x.kode, x.cara]));
    expect(cara["1268"]).toBe("usulan dari keterangan saksi (pasti), disunting petugas sebelum disimpan");
    expect(Object.entries(cara).filter(([kode]) => kode !== "1268").every(([, c]) => c === "usulan dari keterangan saksi (pasti)")).toBe(true);
    expect(permintaan.filter((x) => x.cara === "POST" && x.alamat.includes("/abt-riwayat"))).toHaveLength(6);
  });

  it("variabel yang ditolak ABT disebut, dan yang lain tetap berjalan", async () => {
    const { k, jam, permintaan } = muatAbt({ tolak: new Set(["7035"]) });
    const hasil = await jam.sampaiSelesai(k.terapkanUsulanBerurutan(kartu(), JATI_DIRI, () => {}));
    expect(hasil.berhasil).toBe(5);
    expect(hasil.gagal).toEqual(["7035: ABT menolak menyimpan."]);
    expect(postEditData(permintaan)).toHaveLength(6);
  });

  it("kemajuan dilaporkan per variabel", async () => {
    const { k, jam } = muatAbt();
    const kabar: string[] = [];
    await jam.sampaiSelesai(k.terapkanUsulanBerurutan(kartu(), JATI_DIRI, (t: string) => kabar.push(t)));
    expect(kabar).toEqual(ENAM.map((u, i) => `Menyimpan ${u.nama} (${i + 1} dari 6)…`));
  });
});
