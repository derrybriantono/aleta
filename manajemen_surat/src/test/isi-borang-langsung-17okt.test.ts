// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * 17 OKT 2026 - PENGISIAN BORANG LANGSUNG, TULISAN DATABASE TETAP SEPERTI PETUGAS
 * ============================================================================
 *
 * Keputusan pengguna: "isi form itu otomatis langsung isi, jangan seperti
 * manusia. Yang seperti manusia/petugas yaitu input di database server."
 *
 *   LANGSUNG   jembatan.js mengisi medan seketika dan tetap melepas
 *              input/change/blur; bot mengisi kolom e-Court lewat
 *              isiBorangLangsung (tanpa ketikan per huruf, tanpa jeda).
 *   TETAP      jedaManusiaService + pemakainya (penetapan, jadwal, putusan,
 *              kasir, e-Doc, Court Calendar beruntun) tidak berubah.
 *
 * Dijaga dengan timer palsu: semua kolom terisi tanpa memajukan waktu satu
 * milidetik pun, sedangkan jeda tulisan database tetap menunggu waktu.
 */

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const BOT = path.join(AKAR, "aleta_bot");
const baca = (...b: string[]) => readFileSync(path.join(...b), "utf8").replace(/\r\n/g, "\n");
const muat = createRequire(import.meta.url);

const halaman: JSDOM[] = [];
afterEach(() => {
  vi.useRealTimers();
  while (halaman.length) halaman.pop()!.window.close();
});

// ---------------------------------------------------------------------------
describe("ekstensi: jembatan mengisi borang SIPP seketika dan tetap memicu peristiwa halaman", () => {
  function bukaBorang() {
    const dom = new JSDOM(
      `<!doctype html><body><form id="f">
        <input id="nama" type="text">
        <textarea id="amar"></textarea>
        <select id="jenis"><option value="">-</option><option value="7">Kabul</option></select>
        <input id="a" type="radio" name="n" value="ya"><input id="b" type="radio" name="n" value="tidak">
        <input id="tgl" type="text">
      </form></body>`,
      { url: "http://127.0.0.1/index.php/detil_perkara_agama", runScripts: "outside-only" },
    );
    halaman.push(dom);
    const w = dom.window as unknown as Window & typeof globalThis & Record<string, any>;
    if (!w.CSS) (w as unknown as { CSS: unknown }).CSS = { escape: (s: string) => String(s) };
    const jawaban: any[] = [];
    w.postMessage = ((data: unknown) => void jawaban.push(data)) as typeof w.postMessage;
    w.eval(readFileSync(path.join(EKSTENSI, "jembatan.js"), "utf8"));
    const peristiwa: string[] = [];
    for (const el of Array.from(w.document.querySelectorAll("input, textarea, select"))) {
      for (const n of ["input", "change", "blur"]) el.addEventListener(n, () => peristiwa.push(`${(el as HTMLElement).id}:${n}`));
    }
    let urut = 0;
    const minta = (pesan: Record<string, unknown>) => {
      urut += 1;
      const id = `u-${urut}`;
      w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan", id, ...pesan }, source: w as any }));
      return jawaban.find((x) => x.id === id);
    };
    return { w, minta, peristiwa };
  }

  it("semua medan terisi tanpa memajukan waktu; input/change/blur dilepas tiap medan", () => {
    vi.useFakeTimers();
    const { w, minta, peristiwa } = bukaBorang();
    const hasil = [
      minta({ jenis: "isi", penunjuk: "#nama", jenisMedan: "teks", nilai: "Fulan bin Fulan" }),
      minta({ jenis: "isi", penunjuk: "#amar", jenisMedan: "teks", nilai: "MENGADILI ..." }),
      minta({ jenis: "isi", penunjuk: "#jenis", jenisMedan: "pilih", nilai: "7" }),
      minta({ jenis: "isi", penunjuk: "#b", jenisMedan: "pilih", nilai: "tidak" }),
    ];
    // Tidak ada vi.advanceTimersByTime / vi.runAllTimers di atas: bila ada
    // jeda tiruan (setTimeout), jawabannya tidak akan datang.
    expect(hasil.every((x) => x && x.ok === true)).toBe(true);
    expect((w.document.querySelector("#nama") as HTMLInputElement).value).toBe("Fulan bin Fulan");
    expect((w.document.querySelector("#amar") as HTMLTextAreaElement).value).toBe("MENGADILI ...");
    expect((w.document.querySelector("#jenis") as HTMLSelectElement).value).toBe("7");
    expect((w.document.querySelector("#b") as HTMLInputElement).checked).toBe(true);
    for (const id of ["nama", "amar", "jenis", "b"]) {
      expect(peristiwa, id).toEqual(expect.arrayContaining([`${id}:input`, `${id}:change`, `${id}:blur`]));
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("ekstensi: jeda tiruan manusia tidak lagi ada di jalur isi/tekan layar", () => {
  const sumber = (b: string) => baca(EKSTENSI, b);

  it("kirimKeJembatan tidak memanggil s2JedaTulis / alatJedaManusia", () => {
    const konten = sumber("konten.js");
    const awal = konten.indexOf("async function kirimKeJembatan(");
    expect(awal).toBeGreaterThan(0);
    const akhir = konten.indexOf("alatDaftarkanPemulih(", awal);
    const badan = konten.slice(awal, akhir);
    expect(badan).not.toMatch(/s2JedaTulis|alatJedaManusia/);
  });

  it("alatJedaManusia / s2JedaTulis hanya dipakai di tulisan database beruntun: baris Court Calendar KEDUA dst. dan upload e-Doc lewat bot", () => {
    // K11: tiap berkas dibaca apa adanya (konten.js = inti; modul panelnya berkas sendiri), bukan gabungan uji.
    process.env.ALETA_KONTEN_MENTAH = "1";
    const pakai: string[] = [];
    for (const berkas of readdirSync(EKSTENSI).filter((n) => n.endsWith(".js"))) {
      const baris = sumber(berkas).split("\n");
      baris.forEach((b, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(b)) return;
        if (/\b(await\s+)?(alatJedaManusia|s2JedaTulis|a2JedaTulis)\(/.test(b) && !/^\s*(async )?function /.test(b)) pakai.push(`${berkas}:${i + 1}`);
      });
    }
    // abt.js: a2JedaTulis adalah no-op sejak 5 Okt (tanpa jeda di ABT) - tiga panggilan lama.
    const bukanAbt = pakai.filter((x) => !x.startsWith("abt.js:") && !x.startsWith("abt-panel-"));
    // K11 (26 Okt 2026): konten.js dipecah menjadi inti + modul panel; semuanya tetap "konten" (empat pemakaian).
    expect(bukanAbt.map((x) => x.split(":")[0].replace(/^konten-panel-[a-z]+\.js$/, "konten.js"))).toEqual(["konten.js", "konten.js", "konten.js", "konten.js"]);
    const isi = bukanAbt.map((x) => sumber(x.split(":")[0]).split("\n")[Number(x.split(":")[1]) - 1].trim());
    delete process.env.ALETA_KONTEN_MENTAH;
    expect(isi.filter((b) => b.includes('s2JedaTulis("unggah"'))).toHaveLength(2);
    // Satu di badan pembungkus s2JedaTulis, satu di Court Calendar (sesudah baris pertama).
    expect(isi.filter((b) => b.includes("await alatJedaManusia(") && b.includes('"simpan"'))).toHaveLength(2);
  });

  it("a2JedaTulis (ABT) tetap no-op: tulisan ABT tidak pernah menunggu", () => {
    const abt = sumber("abt.js");
    const i = abt.indexOf("async function a2JedaTulis(");
    const badan = abt.slice(i, abt.indexOf("\n}\n", i));
    expect(badan).not.toMatch(/setTimeout|await /);
  });

  it("Court Calendar: baris PERTAMA langsung, jarak hanya antar simpanan beruntun", () => {
    const konten = sumber("konten.js");
    const i = konten.indexOf("async function ccInputKeSipp(");
    const potongan = konten.slice(i, i + 4500);
    expect(potongan).toMatch(/if \(dikirim\.length && typeof alatJedaManusia === "function"\)/);
    expect(potongan).not.toContain('dikirim.length ? "simpan" : "klik"');
  });
});

// ---------------------------------------------------------------------------
describe("bot: isiBorangLangsung mengisi kolom e-Court tanpa jeda dan tanpa ketikan per huruf", () => {
  const modul = () =>
    muat(path.join(BOT, "services/isiBorangLangsung.js")) as {
      isiKolom: (k: unknown, n: string) => Promise<boolean>;
      isiSelektor: (p: unknown, s: string, n: string) => Promise<boolean>;
      setelDiHalaman: (el: any, n: string) => boolean;
    };

  it("setelan langsung: satu evaluate, nol type, selesai dengan timer palsu tanpa dimajukan", async () => {
    vi.useFakeTimers();
    const { isiKolom } = modul();
    const kolom = { evaluate: vi.fn(async () => true), type: vi.fn(async () => {}) };
    await expect(isiKolom(kolom, "rahasia")).resolves.toBe(true);
    expect(kolom.evaluate).toHaveBeenCalledTimes(1);
    expect(kolom.type).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("nilai tidak terbaca sama -> kolom dikosongkan lalu papan ketik TANPA opsi delay", async () => {
    const { isiKolom } = modul();
    const kolom = { evaluate: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(undefined), type: vi.fn(async () => {}) };
    await expect(isiKolom(kolom, "abc")).resolves.toBe(false);
    expect(kolom.evaluate).toHaveBeenCalledTimes(2);
    expect(kolom.type).toHaveBeenCalledWith("abc");
  });

  it("isiSelektor: kolom tidak ada = galat (tidak menebak)", async () => {
    const { isiSelektor } = modul();
    await expect(isiSelektor({ $: async () => null }, "#x", "a")).rejects.toThrow("kolom_tidak_ditemukan");
  });

  it("setelDiHalaman memakai penyetel asli dan melepas input/change/blur", () => {
    const { setelDiHalaman } = modul();
    const dom = new JSDOM(`<input id="i">`, { runScripts: "outside-only" });
    halaman.push(dom);
    const w = dom.window as any;
    const el = w.document.getElementById("i");
    const lihat: string[] = [];
    for (const n of ["input", "change", "blur"]) el.addEventListener(n, () => lihat.push(n));
    // Dijalankan DI DALAM jendela jsdom, seperti di halaman sungguhan.
    const diHalaman = w.eval(`(${setelDiHalaman.toString()})`);
    expect(diHalaman(el, "nilai")).toBe(true);
    expect(el.value).toBe("nilai");
    expect(lihat).toEqual(["input", "change", "blur"]);
  });

  it("pengemudi e-Court dan login tidak memakai jedaManusiaService, .type() maupun delay", () => {
    for (const b of ["services/ecourtPerambanAksiService.js", "services/ecourtLoginService.js"]) {
      const s = baca(BOT, b);
      expect(s, b).not.toMatch(/jedaManusia\s*\.|jedaManusiaService"\)/);
      expect(s, b).not.toMatch(/\.type\(|delay:/);
      expect(s, b).toContain("isiBorangLangsung");
    }
  });
});

// ---------------------------------------------------------------------------
describe("bot: tulisan database SIPP TETAP berjeda seperti petugas", () => {
  const jeda = () =>
    muat(path.join(BOT, "services/jedaManusiaService.js")) as {
      jeda: (j?: string, o?: { kering?: boolean }) => Promise<number>;
      setelSkala: (n: number | null) => number;
    };

  it("jeda 'simpan' menunggu waktu (timer palsu): belum selesai sebelum waktunya, selesai sesudah dimajukan", async () => {
    vi.useFakeTimers();
    const j = jeda();
    j.setelSkala(1);
    let selesai = false;
    const janji = j.jeda("simpan").then((ms) => {
      selesai = true;
      return ms;
    });
    await vi.advanceTimersByTimeAsync(800);
    expect(selesai).toBe(false);
    await vi.advanceTimersByTimeAsync(1500);
    expect(selesai).toBe(true);
    expect(await janji).toBeGreaterThanOrEqual(900);
    j.setelSkala(null);
  });

  it("setiap penulis database masih memanggil jedaManusiaService", () => {
    const harus: Array<[string, RegExp]> = [
      ["routes/internalGatewayRoutes.js", /jedaManusiaService\.jeda\("simpan"/],
      ["routes/penetapanKembaliRoutes.js", /jedaManusiaService\.jeda\("simpan"/],
      ["services/courtCalendarTulisService.js", /jedaManusiaService"\)\.jeda\(/],
      ["services/kasirJurnalService.js", /jedaManusiaService"\)\.jeda\(/],
      ["services/penetapanTulisService.js", /jedaManusiaService"\)\.jeda\(/],
      ["services/penetapanEdocService.js", /jeda: require\("\.\/jedaManusiaService"\)/],
      ["services/sidangHasilAlur.js", /jeda: require\("\.\/jedaManusiaService"\)/],
    ];
    for (const [berkas, pola] of harus) expect(baca(BOT, berkas), berkas).toMatch(pola);
    const gateway = baca(BOT, "routes/internalGatewayRoutes.js");
    expect(gateway.match(/jedaManusiaService\.jeda\("simpan"/g)).toHaveLength(3);
  });
});
