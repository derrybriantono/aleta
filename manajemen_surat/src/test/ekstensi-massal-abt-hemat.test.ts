// @vitest-environment node
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PUTUSAN MASSAL ABT - TANPA KERJA SIA-SIA, TANPA TUNGGU SIA-SIA
 * ============================================================================
 *
 * Diukur sebelum perbaikan (node:vm atas abt.js 1.167, jaringan tiruan):
 *
 *   setelan bawaan (unggah mati)   5 permintaan: pratinjau, draf, /abt/pdf,
 *                                  anonim ABT, /abt/pdf - tiga terakhir
 *                                  dibuang, ringkasan "PDF ok · anonim ok"
 *   unggah nyala                   6 permintaan, berkas PDF
 *   PDF mati + unggah nyala        "SIPP dilewati (tidak ada PDF)"
 *   antar-perkara                  1.500 ms tetap SESUDAH tiap perkara,
 *                                  termasuk yang terakhir, dan persiapan
 *                                  perkara berikutnya baru mulai sesudahnya
 *
 * Jeda 1.500 ms itu sendiri (ALAT_JEDA_MASSAL_MS) dipertahankan - gunanya
 * memberi napas peladen di antara dua tulisan ke SIPP - dan TIDAK ditiru-
 * tirukan menjadi jeda "manusia": keputusan orkestrator 25 September 2026.
 *
 * panel-alat.js dan abt.js dimuat SUNGGUHAN ke satu konteks node:vm, dengan
 * jam tiruan dan rute ABT/ALETA tiruan. Yang dihitung permintaan yang benar-
 * benar keluar, cap waktu mulai dan selesainya, dan isi berkas yang dikirim.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
// ALETA_UJI_PANEL_ALAT / ALETA_UJI_ABT hanya dipakai skrip pembukti gigitan:
// cacat dipasang pada SALINAN, bukan pada berkas yang dipakai agen/uji lain.
const SUMBER_ALAT = readFileSync(process.env.ALETA_UJI_PANEL_ALAT || path.join(AKAR, "panel-alat.js"), "utf8");
const SUMBER_ABT = readFileSync(process.env.ALETA_UJI_ABT || path.join(AKAR, "abt.js"), "utf8");

type Konteks = Record<string, any>;
type Permintaan = {
  pada: number;
  selesai: number;
  cara: string;
  alamat: string;
  berkas: Array<{ medan: string; awal: string }>;
};

function elemenTiruan(): any {
  return {
    textContent: "",
    className: "",
    hidden: false,
    disabled: false,
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    appendChild: (x: unknown) => x,
    remove() {},
    click() {},
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
  async function sampaiSelesai(janji: Promise<any>, saatLangkah?: () => void): Promise<any> {
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
    for (let langkah = 0; langkah < 500000; langkah += 1) {
      await alirkan();
      if (saatLangkah) {
        saatLangkah();
        await alirkan();
      }
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

function jawaban(status: number, badan: string | ArrayBuffer) {
  const bita = typeof badan === "string" ? new TextEncoder().encode(badan) : new Uint8Array(badan);
  const r: any = {
    ok: status >= 200 && status < 300,
    status,
    text: async () => new TextDecoder().decode(bita),
    json: async () => JSON.parse(new TextDecoder().decode(bita)),
    arrayBuffer: async () => bita.slice().buffer,
  };
  r.clone = () => r;
  return r;
}

const RTF = "{\\rtf1\\ansi PUTUSAN Nomor xxx MENGADILI: 1. Mengabulkan gugatan Penggugat.}" + " ".repeat(200);
const RTF_ANONIM = "{\\rtf1\\ansi PUTUSAN Nomor xxx (anonim) MENGADILI: 1. Mengabulkan gugatan.}" + " ".repeat(200);

/** Latensi tiruan per rute (ms): pratinjau ABT, draf, anonim ABT, PDF, unggah. */
type Latensi = { preview?: number; naskah?: number; anonim?: number; pdf?: number; unggah?: number };
/** Jawaban tiruan yang dapat diubah per uji. */
type Tiruan = {
  anonimGagal?: boolean;
  unggahDitolak?: string;
  /**
   * Penolakan 409 berbentuk persis rute unggah-sipp (route.ts): berlaku bila
   * slot yang disebut ADA di kiriman - rute memeriksa isi tiap slot yang
   * dikirim, dan menolak seluruh kiriman sebelum menulis apa pun.
   */
  unggah409?: { slot: "putusan" | "anonimisasi"; alasan: string; sebab: string; nama?: string[] };
  /** Status galat lain untuk unggah-sipp (mis. 401), dengan badan yang menyebut sesuatu. */
  unggahStatus?: number;
};

/** FileReader secukupnya untuk unduhBlob (blob -> data: URL). */
class PembacaTiruan {
  result: string | null = null;
  error: unknown = null;
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString("base64")}`;
      if (this.onload) this.onload();
    });
  }
}

function muatAbt(latensi: Latensi = {}, tiruan: Tiruan = {}) {
  const jam = buatJam();
  const simpanan: Record<string, unknown> = {};
  const permintaan: Permintaan[] = [];
  const unduhan: string[] = [];
  // Permintaan persiapan (ABT dan draf) yang sedang terbang - untuk memastikan
  // persiapan tidak pernah berjalan serentak dengan persiapan lain.
  let terbang = 0;
  const pantau = { terbangMaks: 0 };
  const tunda = async (ms?: number) => {
    if (ms) await jam.tunda(ms);
  };
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
    FileReader: PembacaTiruan,
    atob,
    btoa,
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
    location: { origin: "http://127.0.0.1:8056", pathname: "/aps_badilag/index.php/abt/main/beranda", search: "" },
    window: {
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
    },
    chrome: {
      runtime: {
        getManifest: () => ({ version: "uji" }),
        getURL: (p: string) => p,
        lastError: undefined,
        sendMessage: (pesan: any, balik?: (x: unknown) => void) => {
          if (pesan && pesan.jenis === "unduh") unduhan.push(String(pesan.nama));
          if (balik) balik({ ok: true });
        },
      },
      storage: {
        onChanged: { addListener() {} },
        local: {
          get: async (kunci: string[]) => Object.fromEntries(kunci.filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
          remove: async () => {},
        },
      },
    },
    fetch: async (alamat: string, opsi: any = {}) => {
      const cara = String(opsi.method || "GET").toUpperCase();
      const a = String(alamat);
      const catatan: Permintaan = { pada: jam.sekarang(), selesai: 0, cara, alamat: a, berkas: [] };
      if (opsi.body instanceof FormData) {
        for (const medan of ["putusan", "anonimisasi", "berkas", "file_putusan"]) {
          const f = opsi.body.get(medan);
          if (f && typeof f !== "string") {
            const b = new Uint8Array(await (f as Blob).arrayBuffer());
            catatan.berkas.push({ medan, awal: new TextDecoder("latin1").decode(b.subarray(0, 5)) });
          }
        }
      }
      permintaan.push(catatan);
      const persiapan = /\/abt\/preview\?|\/putusan\/unggah-naskah$|\/main\/anonim$|\/aleta-bot\/abt\/pdf$/.test(a);
      if (persiapan) {
        terbang += 1;
        pantau.terbangMaks = Math.max(pantau.terbangMaks, terbang);
      }
      try {
        if (a.includes("/abt/preview?")) {
          await tunda(latensi.preview);
          return jawaban(200, RTF);
        }
        if (a.endsWith("/putusan/unggah-naskah")) {
          await tunda(latensi.naskah);
          return jawaban(200, JSON.stringify({ ok: true, data: { ok: true, versi: 3 } }));
        }
        if (a.endsWith("/main/anonim")) {
          await tunda(latensi.anonim);
          return tiruan.anonimGagal ? jawaban(500, "galat") : jawaban(200, RTF_ANONIM);
        }
        if (a.endsWith("/aleta-bot/abt/pdf")) {
          await tunda(latensi.pdf);
          return jawaban(200, JSON.stringify({ data: { available: true, pdfBase64: Buffer.from("%PDF-1.7 xxx").toString("base64") } }));
        }
        if (a.endsWith("/putusan/unggah-sipp")) {
          await tunda(latensi.unggah);
          const tolak = tiruan.unggah409;
          if (tolak && catatan.berkas.some((b) => b.medan === tolak.slot)) {
            return jawaban(
              409,
              JSON.stringify({ ok: false, error: { message: tolak.sebab }, data: { ok: false, ...tolak, peringatan: [] } })
            );
          }
          if (tiruan.unggahStatus) {
            return jawaban(tiruan.unggahStatus, JSON.stringify({ ok: false, error: { message: "Silakan masuk." } }));
          }
          return tiruan.unggahDitolak
            ? jawaban(200, JSON.stringify({ ok: true, data: { ok: false, sebab: tiruan.unggahDitolak } }))
            : jawaban(200, JSON.stringify({ ok: true, data: { ok: true } }));
        }
        return jawaban(404, "{}");
      } finally {
        catatan.selesai = jam.sekarang();
        if (persiapan) terbang -= 1;
      }
    },
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(SUMBER_ALAT, k, { filename: "panel-alat.js" });
  vm.runInContext(SUMBER_ABT, k, { filename: "abt.js" });
  // Tetapan (const) tidak menjadi sifat objek konteks - dibaca lewat vm.
  const jedaMassal = Number(vm.runInContext("ALAT_JEDA_MASSAL_MS", k));
  return { k, jam, simpanan, permintaan, unduhan, pantau, jedaMassal };
}

const PETA = { blangko: "Putusan Cerai Gugat", berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)", a: "AAAAAAAA", b: "BBBBBBBB", d: "3" };
const butirKe = (i: number) => ({ nomor: `${100 + i}/Pdt.G/2026/PA.Dgl`, perkaraId: String(10000 + i), jenis: "Cerai Gugat" });

/** Permintaan ke ABT/ALETA yang dikerjakan untuk perkara itu - tanpa riwayat. */
function jalur(p: Permintaan[]) {
  return p
    .filter((x) => !x.alamat.includes("/abt-riwayat"))
    .map((x) => {
      if (x.alamat.includes("/abt/preview?")) return "GET pratinjau ABT";
      if (x.alamat.endsWith("/putusan/unggah-naskah")) return "POST draf";
      if (x.alamat.endsWith("/main/anonim")) return "POST anonim ABT";
      if (x.alamat.endsWith("/aleta-bot/abt/pdf")) return "POST /abt/pdf";
      if (x.alamat.endsWith("/putusan/unggah-sipp")) return `POST unggah-sipp (${x.berkas.map((b) => b.medan).join("+")})`;
      return `${x.cara} ${x.alamat}`;
    });
}

const unggahan = (p: Permintaan[]) => p.filter((x) => x.alamat.endsWith("/putusan/unggah-sipp"));
const pratinjau = (p: Permintaan[]) => p.filter((x) => x.alamat.includes("/abt/preview?"));

describe("satu perkara - permintaan yang hasilnya dipakai saja", () => {
  it("setelan bawaan (unggah mati): 2 permintaan, dan ringkasannya tidak mengaku 'PDF ok · anonim ok'", async () => {
    const { k, jam, permintaan } = muatAbt();
    const opsi = { draf: true, pdf: true, anonim: true, unduh: false, unggah: false };
    const h = await jam.sampaiSelesai(k.kerjakanSatuPerkaraAbt(butirKe(1), PETA, opsi, "petugas", () => {}));
    expect(jalur(permintaan)).toEqual(["GET pratinjau ABT", "POST draf"]);
    expect(h.ok).toBe(true);
    expect(h.ringkas).not.toMatch(/PDF ok|anonim ok/);
    expect(h.ringkas).toContain("PDF & anonim tidak dibuat (tidak diunduh maupun diunggah)");
  });

  it("unggah nyala: 4 permintaan tanpa /abt/pdf - RTF putusan dan RTF anonim dalam SATU kiriman", async () => {
    const { k, jam, permintaan } = muatAbt();
    const opsi = { draf: true, pdf: true, anonim: true, unduh: false, unggah: true };
    const h = await jam.sampaiSelesai(k.kerjakanSatuPerkaraAbt(butirKe(1), PETA, opsi, "petugas", () => {}));
    expect(jalur(permintaan)).toEqual([
      "GET pratinjau ABT",
      "POST draf",
      "POST anonim ABT",
      "POST unggah-sipp (putusan+anonimisasi)",
    ]);
    expect(unggahan(permintaan)[0].berkas.map((b) => b.awal)).toEqual(["{\\rtf", "{\\rtf"]);
    expect(h.ok).toBe(true);
    expect(h.ringkas).toBe("RTF ok · draf v3 · anonim ok · SIPP ok (putusan + anonimisasi)");
  });

  it("PDF mati + unggah nyala TETAP mengunggah - dahulu 'SIPP dilewati (tidak ada PDF)'", async () => {
    const { k, jam, permintaan } = muatAbt();
    const opsi = { draf: true, pdf: false, anonim: true, unduh: false, unggah: true };
    const h = await jam.sampaiSelesai(k.kerjakanSatuPerkaraAbt(butirKe(1), PETA, opsi, "petugas", () => {}));
    expect(unggahan(permintaan)).toHaveLength(1);
    expect(h.ok).toBe(true);
    expect(h.ringkas).not.toContain("dilewati");
  });

  it("unduh nyala tanpa unggah: PDF dibuat SEKALI, tiga berkas diunduh, tidak ada tulisan ke SIPP", async () => {
    const { k, jam, permintaan, unduhan } = muatAbt();
    const opsi = { draf: false, pdf: true, anonim: true, unduh: true, unggah: false };
    const h = await jam.sampaiSelesai(k.kerjakanSatuPerkaraAbt(butirKe(1), PETA, opsi, "petugas", () => {}));
    expect(jalur(permintaan)).toEqual(["GET pratinjau ABT", "POST anonim ABT", "POST /abt/pdf"]);
    expect(unduhan).toHaveLength(3);
    expect(unduhan.filter((n) => n.endsWith(".rtf"))).toHaveLength(2);
    expect(unduhan.filter((n) => n.endsWith(".pdf"))).toHaveLength(1);
    expect(h.ringkas).toContain("3 berkas diunduh");
  });

  it("anonim gagal: putusan tetap diunggah SENDIRI, dan kegagalannya disebut - bukan 'ok'", async () => {
    const { k, jam, permintaan } = muatAbt({}, { anonimGagal: true });
    const opsi = { draf: true, pdf: false, anonim: true, unduh: false, unggah: true };
    const h = await jam.sampaiSelesai(k.kerjakanSatuPerkaraAbt(butirKe(1), PETA, opsi, "petugas", () => {}));
    expect(jalur(permintaan).slice(-1)).toEqual(["POST unggah-sipp (putusan)"]);
    expect(h.ok).toBe(false);
    expect(h.ringkas).toContain("anonim gagal: ABT menjawab 500");
    expect(h.ringkas).toContain("SIPP ok (putusan)");
  });

  it("unggahan yang ditolak rute disebut sebabnya, dan perkaranya gagal", async () => {
    const { k, jam } = muatAbt({}, { unggahDitolak: "nomor pada isi RTF berbeda" });
    const opsi = { draf: false, pdf: false, anonim: false, unduh: false, unggah: true };
    const h = await jam.sampaiSelesai(k.kerjakanSatuPerkaraAbt(butirKe(1), PETA, opsi, "petugas", () => {}));
    expect(h.ok).toBe(false);
    expect(h.ringkas).toContain("SIPP gagal: nomor pada isi RTF berbeda");
  });

  // Penolakan 409 rute unggah-sipp (t1-unggah-naskah-audit). Dahulu massal ABT
  // hanya membaca angkanya: "ALETA menjawab 409", dan anonim yang bermasalah
  // ikut menahan putusan yang sah.
  const SEBAB_ANONIM =
    "Berkas anonimisasi masih memuat nama pihak: Xxxa. Berkas inilah yang terbit di Direktori Putusan. " +
    "Periksa apakah berkasnya tertukar dengan putusan asli, atau samarkan nama itu lebih dulu. Tidak ada berkas yang dikirim ke SIPP.";
  const TOLAK_ANONIM = { slot: "anonimisasi" as const, alasan: "slot_anonim_memuat_nama", sebab: SEBAB_ANONIM, nama: ["Xxxa"] };

  it("409 slot anonimisasi: sebabnya tersebut, putusan dikirim ulang SENDIRIAN dan masuk, perkaranya tetap gagal", async () => {
    const { k, jam, permintaan } = muatAbt({}, { unggah409: TOLAK_ANONIM });
    const opsi = { draf: false, pdf: false, anonim: true, unduh: false, unggah: true };
    const h = await jam.sampaiSelesai(k.kerjakanSatuPerkaraAbt(butirKe(1), PETA, opsi, "petugas", () => {}));
    expect(jalur(permintaan).slice(-2)).toEqual(["POST unggah-sipp (putusan+anonimisasi)", "POST unggah-sipp (putusan)"]);
    expect(h.ringkas).toContain(SEBAB_ANONIM);
    expect(h.ringkas).toContain("slot anonim memuat nama");
    expect(h.ringkas).toContain("SIPP ok (putusan, dikirim ulang tanpa anonimisasi)");
    expect(h.ringkas).toContain("anonimisasi gagal");
    expect(h.ringkas).not.toContain("menjawab 409");
    expect(h.dokumen.unggah).toMatch(/^putusan ok; anonimisasi gagal/);
    expect(h.ok).toBe(false);
  });

  it("409 slot putusan: sebabnya tersebut, TIDAK dikirim ulang", async () => {
    const sebab = "Berkas putusan menyebut nomor 13/Pdt.G/2026/PA.Dgl (4 kali), bukan 101/Pdt.G/2026/PA.Dgl.";
    const { k, jam, permintaan } = muatAbt({}, { unggah409: { slot: "putusan", alasan: "nomor_isi_berbeda", sebab } });
    const opsi = { draf: false, pdf: false, anonim: true, unduh: false, unggah: true };
    const h = await jam.sampaiSelesai(k.kerjakanSatuPerkaraAbt(butirKe(1), PETA, opsi, "petugas", () => {}));
    expect(unggahan(permintaan)).toHaveLength(1);
    expect(h.ringkas).toContain(`SIPP gagal: ${sebab}`);
    expect(h.ok).toBe(false);
  });

  it("401: kalimat baku alatPesanGagal, bukan badan halaman masuk, dan tidak dikirim ulang", async () => {
    const { k, jam, permintaan } = muatAbt({}, { unggahStatus: 401 });
    const opsi = { draf: false, pdf: false, anonim: true, unduh: false, unggah: true };
    const h = await jam.sampaiSelesai(k.kerjakanSatuPerkaraAbt(butirKe(1), PETA, opsi, "petugas", () => {}));
    expect(unggahan(permintaan)).toHaveLength(1);
    expect(h.ringkas).toContain("SIPP gagal: Mengunggah putusan ke SIPP");
    expect(h.ringkas).not.toContain("Silakan masuk");
    expect(h.ok).toBe(false);
  });

  it("massal: 409 anonim pada satu perkara tidak menahan putusannya, dan perkara lain tetap utuh", async () => {
    const { k, jam, permintaan } = muatAbt({}, { unggah409: TOLAK_ANONIM });
    const daftar = [1, 2].map((i) => ({ ...butirKe(i), keadaan: "menunggu", catatan: "", dokumen: {} as Record<string, string> }));
    await jam.sampaiSelesai(
      k.jalankanMassalAbt(daftar, {
        opsi: { draf: false, pdf: false, anonim: true, unduh: false, unggah: true },
        olehUsername: "petugas",
        petaUntuk: () => PETA,
      })
    );
    // Tiap perkara: kiriman berpasangan ditolak, lalu putusan sendirian.
    expect(unggahan(permintaan).map((x) => x.berkas.map((b) => b.medan).join("+"))).toEqual([
      "putusan+anonimisasi",
      "putusan",
      "putusan+anonimisasi",
      "putusan",
    ]);
    for (const butir of daftar) {
      expect(butir.keadaan).toBe("gagal");
      expect(butir.catatan).toContain("Xxxa");
      expect(butir.dokumen.unggah).toMatch(/^putusan ok/);
    }
  });

  it("rencana yang tergambar menyebut rantai yang sungguh dikerjakan", () => {
    const { k } = muatAbt();
    expect(k.rantaiMassalAbt({ draf: true, pdf: true, anonim: true, unduh: false, unggah: false })).toBe("RTF → draf");
    expect(k.rantaiMassalAbt({ draf: true, pdf: true, anonim: true, unduh: false, unggah: true })).toBe(
      "RTF → draf → anonim → SIPP (putusan + anonimisasi)"
    );
    expect(k.rantaiMassalAbt({ draf: false, pdf: true, anonim: false, unduh: true, unggah: false })).toBe("RTF → unduh (RTF, PDF)");
  });
});

describe("20 perkara - jeda yang sudah ada menampung persiapan perkara berikutnya", () => {
  async function jalankan(n: number, opsi: Record<string, boolean>, latensi: Latensi, hentikanBila?: (p: Permintaan[]) => boolean) {
    const dunia = muatAbt(latensi);
    const daftar = Array.from({ length: n }, (_, i) => ({ ...butirKe(i + 1), keadaan: "menunggu", catatan: "", dokumen: {} }));
    const pembatal = new AbortController();
    const mulai = dunia.jam.sekarang();
    await dunia.jam.sampaiSelesai(
      dunia.k.jalankanMassalAbt(daftar, {
        opsi,
        olehUsername: "petugas",
        petaUntuk: () => PETA,
        sinyalBatal: pembatal.signal,
      }),
      () => {
        if (hentikanBila && !pembatal.signal.aborted && hentikanBila(dunia.permintaan)) pembatal.abort();
      }
    );
    return { ...dunia, daftar, mulai, selesai: dunia.jam.sekarang() };
  }

  // p' = pratinjau 3 dtk + draf 3 dtk + anonim ABT 2 dtk; unggah 2 dtk.
  const LATENSI = { preview: 3000, naskah: 3000, anonim: 2000, unggah: 2000 };
  const P_AKSEN = 8000;
  const W = 2000;

  it("unggah nyala, p' = 8 dtk: lama seluruhnya ≤ 20·(p' + w) + 1 dtk - dahulu 20·(p' + w + 1,5 dtk)", async () => {
    const d = await jalankan(20, { draf: true, pdf: true, anonim: true, unduh: false, unggah: true }, LATENSI);
    expect(d.daftar.every((b) => b.keadaan === "selesai")).toBe(true);
    const tulis = unggahan(d.permintaan);
    expect(tulis).toHaveLength(20);
    expect(tulis.every((x) => x.berkas.map((b) => b.medan).join("+") === "putusan+anonimisasi")).toBe(true);
    expect(d.selesai - d.mulai).toBeLessThanOrEqual(20 * (P_AKSEN + W) + 1000);
    // Tidak ada jeda sesudah perkara terakhir.
    expect(d.selesai - tulis[tulis.length - 1].selesai).toBe(0);
  }, 120000);

  it("persiapan tidak pernah serentak, dan pratinjau perkara berikutnya baru mulai sesudah tulisan SIPP sebelumnya rampung", async () => {
    const d = await jalankan(20, { draf: true, pdf: true, anonim: true, unduh: false, unggah: true }, LATENSI);
    expect(d.pantau.terbangMaks).toBe(1);
    const tulis = unggahan(d.permintaan);
    const lihat = pratinjau(d.permintaan);
    for (let i = 0; i < 19; i += 1) expect(lihat[i + 1].pada).toBeGreaterThanOrEqual(tulis[i].selesai);
  }, 120000);

  it("tanpa latensi: dua tulisan ke SIPP tetap berselang ≥ ALAT_JEDA_MASSAL_MS, dan lamanya tepat 19 jeda", async () => {
    const d = await jalankan(20, { draf: true, pdf: false, anonim: true, unduh: false, unggah: true }, {});
    expect(d.jedaMassal).toBe(1500);
    const tulis = unggahan(d.permintaan).map((x) => x.pada);
    expect(tulis).toHaveLength(20);
    expect(Math.min(...tulis.slice(1).map((t, i) => t - tulis[i]))).toBeGreaterThanOrEqual(d.jedaMassal);
    expect(d.selesai - d.mulai).toBe(19 * d.jedaMassal);
  }, 120000);

  it("unggah mati, p' = 8 dtk: tanpa PDF dan anonim, lama ≤ 20·p'' + 1 dtk, ringkasannya jujur", async () => {
    const d = await jalankan(20, { draf: true, pdf: true, anonim: true, unduh: false, unggah: false }, LATENSI);
    expect(unggahan(d.permintaan)).toHaveLength(0);
    expect(d.permintaan.filter((x) => x.alamat.endsWith("/abt/pdf") || x.alamat.endsWith("/main/anonim"))).toHaveLength(0);
    expect(pratinjau(d.permintaan)).toHaveLength(20);
    // p'' = pratinjau + draf = 6 dtk; dahulu 20·(6 dtk + 2 × PDF + anonim + 1,5 dtk).
    expect(d.selesai - d.mulai).toBeLessThanOrEqual(20 * 6000 + 1000);
    expect(d.daftar.every((b) => b.keadaan === "selesai" && !/PDF ok|anonim ok/.test(b.catatan))).toBe(true);
  }, 120000);

  it("Hentikan sesudah tulisan ke-2: tidak ada persiapan ke-3, sisanya dilewati dan disebut", async () => {
    const d = await jalankan(5, { draf: true, pdf: false, anonim: true, unduh: false, unggah: true }, LATENSI, (p) => unggahan(p).length === 2);
    expect(unggahan(d.permintaan)).toHaveLength(2);
    expect(pratinjau(d.permintaan)).toHaveLength(2);
    expect(d.daftar.slice(0, 2).map((b) => b.keadaan)).toEqual(["selesai", "selesai"]);
    expect(d.daftar.slice(2).every((b) => b.keadaan === "dilewati" && b.catatan === "dihentikan")).toBe(true);
  }, 120000);

  it("Hentikan di dalam jeda: persiapan yang sudah berjalan ditunggu dan DISEBUT, tetapi tidak diunggah", async () => {
    const d = await jalankan(5, { draf: true, pdf: false, anonim: true, unduh: false, unggah: true }, LATENSI, (p) => pratinjau(p).length === 3);
    expect(unggahan(d.permintaan)).toHaveLength(2);
    expect(d.daftar[2].keadaan).toBe("dilewati");
    expect(d.daftar[2].catatan).toBe("dihentikan sesudah persiapan, belum diunggah: RTF ok · draf v3 · anonim ok");
    expect(d.daftar.slice(3).every((b) => b.catatan === "dihentikan")).toBe(true);
  }, 120000);
});
