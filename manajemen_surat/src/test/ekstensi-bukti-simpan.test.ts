// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUKTI SIMPAN BORANG PUTUSAN DARI JAWABAN SIPP SENDIRI - DIJALANKAN
 * ============================================================================
 *
 * Borang Putusan Akhir disimpan SubmitHandling SIPP lewat $.ajax, yang
 * menjawab {st, msg}. Sampai 25 September 2026 jawaban itu tidak didengar:
 * ekstensi menjajak basis data 10 x (tidur 1.000 ms + 1 baca status), lalu
 * menyerah dengan pesan umum - padahal sebab penolakannya sudah tertulis di
 * layar. Tiga hal dijaga di sini, semuanya dengan MENJALANKAN kodenya:
 *
 *   1. jembatan.js (dimuat utuh ke jsdom): tombol yang tidak tampak tidak
 *      ditekan; "#simpan" di luar #frm_putusan tidak pernah terpilih; jawaban
 *      SIPP diteruskan lewat postMessage sebagai TEKS.
 *   2. simpanPutusanLaluBuka (dipotong dari konten.js, node:vm, jam tiruan):
 *      st=0 -> pesan SIPP seketika, 0 tidur 1.000 ms, 0 baca status; st=1 ->
 *      jajak pertama pada t=0; tanpa jawaban -> jajak lama.
 *   3. Muatan POST isian-sipp memuat "terpilih" untuk medan yang terisi (K9).
 *
 * jsdom tidak punya tata letak: offsetParent selalu null di sana. Uji ini
 * memasang tiruan tata letak paling sederhana - elemen yang ia sendiri atau
 * leluhurnya display:none tidak punya offsetParent - supaya tombol yang tampak
 * pun dapat dibedakan dari yang disembunyikan .hide().
 *
 * ALETA_UJI_KONTEN / ALETA_UJI_JEMBATAN menunjuk SALINAN untuk pembukti gigitan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const BERKAS_KONTEN = process.env.ALETA_UJI_KONTEN || path.join(AKAR, "konten.js");
const BERKAS_JEMBATAN = process.env.ALETA_UJI_JEMBATAN || path.join(AKAR, "jembatan.js");
const konten = () => readFileSync(BERKAS_KONTEN, "utf8").replace(/\r\n/g, "\n");
const jembatan = () => readFileSync(BERKAS_JEMBATAN, "utf8");

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

function tetapan(isi: string, nama: string, kata = "const"): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => b.startsWith(`${kata} ${nama} = `));
  if (mulai < 0) throw new Error(`tetapan ${nama} tidak ketemu`);
  if (baris[mulai].trimEnd().endsWith(";")) return baris[mulai];
  let j = mulai;
  while (j < baris.length && baris[j] !== "};" && baris[j] !== "];") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

/** PENUNJUK_SIMPAN_PUTUSAN dibaca dari sumbernya - daftar yang disalin akan menyimpang diam-diam. */
function penunjukSimpan(): string[] {
  const k: Record<string, unknown> = {};
  vm.createContext(k);
  vm.runInContext(`${tetapan(konten(), "PENUNJUK_SIMPAN_PUTUSAN")}\nthis.hasil = PENUNJUK_SIMPAN_PUTUSAN;`, k);
  return Array.from(k.hasil as string[]);
}

const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

const ALAMAT_SIMPAN = "http://127.0.0.1/index.php/managePutusanAkhir/validateInput";

type PerilakuSipp = { st?: 0 | 1; msg?: string; konfirmasi?: boolean; jquery?: boolean };

/**
 * Satu halaman SIPP tiruan dengan jembatan.js SUNGGUHAN. Bila `perilaku`
 * disebut, borang #frm_putusan diberi pengirim yang meniru SubmitHandling
 * (jquery-sipp.js): konfirmasi, #popup_msg + #pesan-container, $.ajax POST ke
 * action borang, ajaxSend serempak, lalu ajaxComplete dengan {st, msg}.
 */
function bukaSipp(badan: string, perilaku?: PerilakuSipp) {
  const dom = new JSDOM(`<!doctype html><html><body>${badan}</body></html>`, {
    url: "http://127.0.0.1/index.php/detil_perkara_agama",
    runScripts: "outside-only",
  });
  halaman.push(dom);
  const w = dom.window as unknown as Window & typeof globalThis & Record<string, any>;
  // jsdom tidak punya CSS.escape; peramban punya. Cukup untuk nama seperti "sumber_hukum[]".
  if (!w.CSS) (w as unknown as { CSS: unknown }).CSS = { escape: (s: string) => String(s).replace(/[^a-zA-Z0-9_ -￿-]/g, (c) => `\\${c}`) };
  Object.defineProperty(w.HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get(this: HTMLElement) {
      for (let n: HTMLElement | null = this; n; n = n.parentElement) {
        if (w.getComputedStyle(n).display === "none") return null;
      }
      return this.ownerDocument.body;
    },
  });
  const jawaban: any[] = [];
  w.postMessage = ((data: unknown) => void jawaban.push(data)) as typeof w.postMessage;
  const ditekan: string[] = [];
  for (const tombol of Array.from(w.document.querySelectorAll("input[type=submit], button"))) {
    tombol.addEventListener("click", () => ditekan.push(`${(tombol as HTMLElement).closest("form")?.id || "-"}#${tombol.id}`));
  }

  if (!perilaku) {
    // Tanpa pengirim tiruan, kiriman borang ditahan di sini: jsdom tidak
    // mengenal navigasi borang, dan yang diuji hanya penekanan tombolnya.
    for (const borang of Array.from(w.document.querySelectorAll("form"))) {
      borang.addEventListener("submit", (e) => e.preventDefault());
    }
  } else {
    const pendengar: Record<string, Array<(...a: unknown[]) => void>> = { ajaxSend: [], ajaxComplete: [] };
    if (perilaku.jquery !== false) {
      const jq: any = () => ({
        on: (nama: string, fn: (...a: unknown[]) => void) => void pendengar[nama].push(fn),
        off: (nama: string, fn: (...a: unknown[]) => void) => void (pendengar[nama] = pendengar[nama].filter((f) => f !== fn)),
      });
      jq.fn = { on() {}, off() {} };
      w.jQuery = jq;
    }
    const borang = w.document.querySelector("#frm_putusan") as HTMLFormElement;
    borang.addEventListener("submit", (e) => {
      e.preventDefault();
      if (perilaku.konfirmasi === false) return; // confirm() dibatalkan petugas
      const popup = w.document.createElement("div");
      popup.id = "popup_msg";
      popup.innerHTML = '<div id="pesan-container"></div>';
      w.document.body.appendChild(popup);
      const opsi = { url: borang.getAttribute("action"), type: "POST" };
      const xhr: Record<string, unknown> = { status: 200 };
      for (const f of pendengar.ajaxSend) f({}, xhr, opsi);
      setTimeout(() => {
        xhr.responseText = JSON.stringify({ st: perilaku.st, msg: perilaku.msg });
        (w.document.querySelector("#pesan-container") as HTMLElement).innerHTML = String(perilaku.msg || "");
        for (const f of [...pendengar.ajaxComplete]) f({}, xhr, opsi);
      }, 15);
    });
  }

  w.eval(jembatan());
  let urut = 0;
  const minta = (pesan: Record<string, unknown>) => {
    urut += 1;
    const id = `uji-${urut}`;
    w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan", id, ...pesan }, source: w as any }));
    return jawaban.find((x) => x.id === id);
  };
  const tungguBukti = async (id: string, batasMs = 1500) => {
    const akhir = Date.now() + batasMs;
    while (Date.now() < akhir) {
      const ada = jawaban.find((x) => x.id === id && x.jenis === "bukti-simpan");
      if (ada) return ada;
      await new Promise((r) => setTimeout(r, 20));
    }
    return null;
  };
  return { dom, w, jawaban, ditekan, minta, tungguBukti };
}

const BORANG = (isiTombol: string) =>
  `<form id="frm_putusan" method="post" action="${ALAMAT_SIMPAN}">${isiTombol}</form>`;

// ===========================================================================
describe("jembatan: tombol yang tidak tampak TIDAK ditekan", () => {
  it("tombol yang tampak ditekan", () => {
    const s = bukaSipp(BORANG('<input type="submit" id="simpan" value="Simpan">'));
    expect(s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan" })).toMatchObject({ ok: true });
    expect(s.ditekan).toEqual(["frm_putusan#simpan"]);
  });

  it(".hide() milik SIPP (display:none) - tidak ditekan", () => {
    const s = bukaSipp(BORANG('<input type="submit" id="simpan" value="Simpan" style="display: none;">'));
    expect(s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan" })).toMatchObject({ ok: false, alasan: "tombol_tidak_tampak" });
    expect(s.ditekan).toEqual([]);
  });

  it("leluhurnya yang disembunyikan - tidak ditekan", () => {
    const s = bukaSipp(`<div style="display:none">${BORANG('<input type="submit" id="simpan" value="Simpan">')}</div>`);
    expect(s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan" })).toMatchObject({ alasan: "tombol_tidak_tampak" });
    expect(s.ditekan).toEqual([]);
  });

  it("visibility:hidden - tidak ditekan", () => {
    const s = bukaSipp(BORANG('<input type="submit" id="simpan" value="Simpan" style="visibility:hidden">'));
    expect(s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan" })).toMatchObject({ alasan: "tombol_tidak_tampak" });
    expect(s.ditekan).toEqual([]);
  });
});

describe("'#simpan' di luar #frm_putusan tidak pernah terpilih", () => {
  const LUAR = '<form id="frm_lain"><input type="submit" id="simpan" value="Simpan"></form>';

  it("blangko putusan tanpa tombolnya: tidak satu penunjuk pun menekan #simpan milik blangko lain", () => {
    const s = bukaSipp(`${LUAR}${BORANG("")}`);
    for (const penunjuk of penunjukSimpan()) {
      expect(s.w.document.querySelector(penunjuk)?.closest("form")?.id ?? "-", penunjuk).not.toBe("frm_lain");
      s.minta({ jenis: "tekan", penunjuk, bukti: { borang: "#frm_putusan", id: "b" } });
    }
    expect(s.ditekan).toEqual([]);
  });

  it("tombol blangko putusan tersembunyi, #simpan lain tampak: tetap tidak ada yang ditekan", () => {
    const s = bukaSipp(`${LUAR}${BORANG('<input type="submit" id="simpan" style="display:none">')}`);
    for (const penunjuk of penunjukSimpan()) s.minta({ jenis: "tekan", penunjuk, bukti: { borang: "#frm_putusan", id: "b" } });
    expect(s.ditekan).toEqual([]);
  });

  it("dengan bukti, tombol yang bukan milik blangkonya ditolak", () => {
    const s = bukaSipp(`${LUAR}${BORANG("")}`);
    expect(s.minta({ jenis: "tekan", penunjuk: "#simpan", bukti: { borang: "#frm_putusan", id: "b" } })).toMatchObject({
      ok: false,
      alasan: "tombol_di_luar_borang",
    });
    expect(s.ditekan).toEqual([]);
  });
});

describe("jembatan meneruskan jawaban SIPP atas kiriman blangko", () => {
  const TOMBOL = BORANG('<input type="submit" id="simpan" value="Simpan">');

  it("st=0: pesan pengesahan SIPP diteruskan sebagai teks", async () => {
    const s = bukaSipp(TOMBOL, {
      st: 0,
      msg: "<strong>Peringatan:</strong><br /> Amar Putusan Tidak Boleh kurang dari 50 Karakter",
    });
    expect(s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan", bukti: { borang: "#frm_putusan", id: "b0" } })).toMatchObject({
      ok: true,
      bukti: "terkirim",
    });
    expect(await s.tungguBukti("b0")).toMatchObject({
      sumber: "aleta-jembatan-jawab",
      id: "b0",
      jenis: "bukti-simpan",
      asal: "ajax",
      st: 0,
      pesan: "Peringatan: Amar Putusan Tidak Boleh kurang dari 50 Karakter",
    });
  });

  it("st=1: jawaban berhasil diteruskan", async () => {
    const s = bukaSipp(TOMBOL, { st: 1, msg: "Data Berhasil Disimpan" });
    s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan", bukti: { borang: "#frm_putusan", id: "b1" } });
    expect(await s.tungguBukti("b1")).toMatchObject({ asal: "ajax", st: 1, pesan: "Data Berhasil Disimpan" });
  });

  it("konfirmasi SIPP dibatalkan: 'tanpa-kiriman', dan tidak ada bukti palsu", async () => {
    const s = bukaSipp(TOMBOL, { st: 1, msg: "x", konfirmasi: false });
    expect(s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan", bukti: { borang: "#frm_putusan", id: "b2" } })).toMatchObject({
      ok: true,
      bukti: "tanpa-kiriman",
    });
    expect(await s.tungguBukti("b2", 600)).toBeNull();
  });

  it("tanpa jQuery: pesan baru di #pesan-container yang diteruskan, tanpa st", async () => {
    const s = bukaSipp(TOMBOL, { st: 0, msg: "Tidak Berhasil, Sumber Hukum Belum Dipilih", jquery: false });
    expect(s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan", bukti: { borang: "#frm_putusan", id: "b3" } })).toMatchObject({
      bukti: "tanpa-jquery",
    });
    expect(await s.tungguBukti("b3")).toMatchObject({ asal: "popup", st: null, pesan: "Tidak Berhasil, Sumber Hukum Belum Dipilih" });
  });

  it("HTML jawaban tidak dijalankan dan tidak diteruskan sebagai HTML", async () => {
    const s = bukaSipp(TOMBOL, { st: 0, msg: 'Tidak Berhasil<img src="x" onerror="window.__disuntik = 1">' });
    s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan", bukti: { borang: "#frm_putusan", id: "b4" } });
    const bukti = await s.tungguBukti("b4");
    expect(bukti.pesan).toBe("Tidak Berhasil");
    expect(s.w.__disuntik).toBeUndefined();
  });
});

// ===========================================================================
// simpanPutusanLaluBuka - node:vm, jam tiruan.

function buatJam(mulai = Date.UTC(2026, 8, 25, 3, 0, 0)) {
  let kini = mulai;
  let urut = 0;
  const antre = new Map<number, { t: number; f: () => void }>();
  const tidur1000: number[] = [];
  const jam = {
    get kini() {
      return kini;
    },
    tidur1000,
    Date: class extends Date {
      constructor(...a: unknown[]) {
        if (a.length === 0) super(kini);
        else super(...(a as [string]));
      }
      static now() {
        return kini;
      }
    },
    setTimeout: (f: () => void, ms?: number) => {
      urut += 1;
      if (ms === 1000) tidur1000.push(kini);
      antre.set(urut, { t: kini + Math.max(0, Number(ms) || 0), f });
      return urut;
    },
    clearTimeout: (id: number) => void antre.delete(id),
    async jalankan(syarat: () => boolean, batasMs = 600_000) {
      const akhir = kini + batasMs;
      for (;;) {
        for (let i = 0; i < 20; i += 1) await new Promise((r) => setImmediate(r));
        if (syarat()) return true;
        let pilih: [number, { t: number; f: () => void }] | null = null;
        for (const e of antre) if (!pilih || e[1].t < pilih[1].t) pilih = e;
        if (!pilih || pilih[1].t > akhir) return syarat();
        antre.delete(pilih[0]);
        kini = Math.max(kini, pilih[1].t);
        pilih[1].f();
      }
    },
  };
  return jam;
}

type Keadaan = { sudahPutus: boolean; tanggal: string; status: string } | null;

/**
 * simpanPutusanLaluBuka SUNGGUHAN dengan jembatan tiruan yang menjawab "tekan"
 * seperti jembatan.js - dan, bila `bukti` disebut, mengirim bukti YANG DIREKAM
 * dari jembatan.js sungguhan (lihat rekamBukti) sesudah `jedaBuktiMs`.
 */
function muatSimpan(opsi: {
  tekan: (penunjuk: string) => Record<string, unknown>;
  bukti?: Record<string, unknown> | null;
  jedaBuktiMs?: number;
  keadaan: (keBaca: number) => Keadaan;
}) {
  const isi = konten();
  const jam = buatJam();
  const pendengar = new Set<(e: { source: unknown; data: unknown }) => void>();
  const w: Record<string, unknown> = {
    addEventListener: (nama: string, f: (e: { source: unknown; data: unknown }) => void) => nama === "message" && pendengar.add(f),
    removeEventListener: (nama: string, f: (e: { source: unknown; data: unknown }) => void) => void pendengar.delete(f),
  };
  const bacaan: number[] = [];
  const permintaanTekan: string[] = [];
  const muatUlang: number[] = [];
  let tekanPada = -1;
  const k: Record<string, unknown> = {
    window: w,
    setTimeout: jam.setTimeout,
    clearTimeout: jam.clearTimeout,
    Date: jam.Date,
    bacaPutusanSegar: async () => {
      bacaan.push(jam.kini);
      return opsi.keadaan(bacaan.length - 1);
    },
    kirimKeJembatan: async (pesan: { jenis: string; penunjuk: string; bukti?: { id: string } }) => {
      permintaanTekan.push(pesan.penunjuk);
      const jawab = opsi.tekan(pesan.penunjuk);
      if (jawab.ok && opsi.bukti && pesan.bukti) {
        tekanPada = jam.kini;
        const data = { ...opsi.bukti, id: pesan.bukti.id };
        jam.setTimeout(() => {
          for (const f of [...pendengar]) f({ source: w, data });
        }, opsi.jedaBuktiMs ?? 0);
      } else if (jawab.ok) {
        tekanPada = jam.kini;
      }
      return jawab;
    },
    muatUlangHalamanPerkara: () => void muatUlang.push(jam.kini),
  };
  vm.createContext(k);
  vm.runInContext(
    [
      tetapan(isi, "PENUNJUK_SIMPAN_PUTUSAN"),
      tetapan(isi, "BATAS_JAWABAN_SIMPAN_MS"),
      tetapan(isi, "nomorBuktiSimpan", "let"),
      potongFungsi(isi, "samaPutusan"),
      potongFungsi(isi, "dengarBuktiSimpan"),
      potongFungsi(isi, "tekanSimpanPutusan"),
      potongFungsi(isi, "bunyiSimpanTidakDitekan"),
      potongFungsi(isi, "simpanPutusanLaluBuka"),
      // AUDIT-GALAT 18 Okt: kalimat galat "Awalan: sebab" tanpa awalan berulang.
      potongFungsi(isi, "sambungSebab"),
      "this.simpan = simpanPutusanLaluBuka;",
    ].join("\n"),
    k
  );
  const jalankan = async () => {
    let hasil: { ok: boolean; bunyi: string } | null = null;
    const kabar = { textContent: "" };
    void (k.simpan as (n: string, kb: unknown) => Promise<{ ok: boolean; bunyi: string }>)("1/Pdt.G/2026/PA.Dgl", kabar).then(
      (h) => (hasil = h)
    );
    await jam.jalankan(() => hasil !== null);
    return hasil!;
  };
  return {
    jam,
    bacaan,
    permintaanTekan,
    muatUlang,
    jalankan,
    get tekanPada() {
      return tekanPada;
    },
  };
}

/** Bukti yang SUNGGUH dikirim jembatan.js untuk satu jawaban SIPP. */
async function rekamBukti(st: 0 | 1, msg: string) {
  const s = bukaSipp(BORANG('<input type="submit" id="simpan" value="Simpan">'), { st, msg });
  s.minta({ jenis: "tekan", penunjuk: "#frm_putusan #simpan", bukti: { borang: "#frm_putusan", id: "rekam" } });
  const bukti = await s.tungguBukti("rekam");
  expect(bukti, "jembatan tidak meneruskan bukti").toBeTruthy();
  return bukti as Record<string, unknown>;
}

const BELUM: Keadaan = { sudahPutus: false, tanggal: "", status: "" };
const PUTUS: Keadaan = { sudahPutus: true, tanggal: "2026-09-25", status: "Dikabulkan" };

describe("simpanPutusanLaluBuka membaca jawaban SIPP (jam tiruan)", () => {
  it("st=0: pesan SIPP seketika - 0 tidur 1.000 ms, 0 baca status sesudah Simpan ditekan", async () => {
    const bukti = await rekamBukti(0, "<strong>Peringatan:</strong><br /> Amar Putusan Tidak Boleh kurang dari 50 Karakter");
    const s = muatSimpan({ tekan: () => ({ ok: true, bukti: "terkirim" }), bukti, keadaan: () => BELUM });
    const hasil = await s.jalankan();
    expect(hasil.ok).toBe(false);
    expect(hasil.bunyi).toContain("SIPP menolak menyimpan: Peringatan: Amar Putusan Tidak Boleh kurang dari 50 Karakter");
    expect(s.jam.tidur1000).toEqual([]);
    // Satu-satunya bacaan adalah keadaan SEBELUM menekan - pembandingnya.
    // Sesudah Simpan ditekan: 0 baca status.
    expect(s.bacaan).toHaveLength(1);
    await s.jam.jalankan(() => false, 5000);
    expect(s.muatUlang).toEqual([]);
  });

  it("st=1: jajak basis data PERTAMA pada t=0 sesudah jawaban, bukan sesudah tidur 1.000 ms", async () => {
    const bukti = await rekamBukti(1, "Data Berhasil Disimpan");
    const s = muatSimpan({
      tekan: () => ({ ok: true, bukti: "terkirim" }),
      bukti,
      keadaan: (ke) => (ke === 0 ? BELUM : PUTUS),
    });
    const hasil = await s.jalankan();
    expect(hasil).toMatchObject({ ok: true, bunyi: "Tersimpan di SIPP." });
    expect(s.bacaan).toHaveLength(2);
    expect(s.bacaan[1] - s.tekanPada).toBe(0);
    expect(s.jam.tidur1000).toEqual([]);
    // Halaman perkara dibuka kembali sesudah terbukti tersimpan.
    await s.jam.jalankan(() => s.muatUlang.length > 0, 5000);
    expect(s.muatUlang).toHaveLength(1);
  });

  it("st=1 atas perkara yang SUDAH putus dan keadaannya tidak berubah: jawaban SIPP yang membuktikan", async () => {
    const bukti = await rekamBukti(1, "Data Berhasil Disimpan");
    const s = muatSimpan({ tekan: () => ({ ok: true, bukti: "terkirim" }), bukti, keadaan: () => PUTUS });
    const hasil = await s.jalankan();
    expect(hasil.ok).toBe(true);
    expect(hasil.bunyi).toMatch(/tidak berubah/);
    expect(s.bacaan).toHaveLength(2);
  });

  it("tanpa jawaban SIPP (blangko tidak terkirim): jalur jajak lama - sedetik sekali, sepuluh kali", async () => {
    const s = muatSimpan({ tekan: () => ({ ok: true, bukti: "tanpa-kiriman" }), bukti: null, keadaan: () => BELUM });
    const hasil = await s.jalankan();
    expect(hasil.ok).toBe(false);
    expect(hasil.bunyi).toMatch(/Tidak ada kiriman blangko yang teramati/);
    expect(hasil.bunyi).toMatch(/^Simpan sudah ditekan, tetapi sesudah 10 detik SIPP belum mencatat/);
    expect(s.jam.tidur1000).toHaveLength(10);
    expect(s.bacaan).toHaveLength(11);
    expect(s.bacaan[1] - s.tekanPada).toBe(1000);
  });

  it("jembatan tidak menjawab: TIDAK diaku 'sudah ditekan', lama tunggunya disebut apa adanya", async () => {
    // Konfirmasi SIPP yang masih terbuka menahan jawaban jembatan - Simpan
    // mungkin sudah, mungkin belum ditekan. Penunjuk kedua TIDAK dicoba:
    // bila yang pertama sebenarnya tertekan, menekan lagi mengirim dua kali.
    const s = muatSimpan({ tekan: () => ({ ok: false, alasan: "jembatan_tidak_menjawab" }), keadaan: () => BELUM });
    const hasil = await s.jalankan();
    expect(hasil.ok).toBe(false);
    expect(hasil.bunyi).toMatch(/^Permintaan menekan Simpan tidak dijawab halaman, dan sesudah 30 detik SIPP belum mencatat/);
    expect(hasil.bunyi).not.toMatch(/sudah ditekan/);
    expect(s.permintaanTekan).toHaveLength(1);
  });

  it("jawaban yang datang TERLAMBAT tetap dibaca di sela jajak lama", async () => {
    const bukti = await rekamBukti(0, "Tidak Berhasil, Qobla/Bada Belum Diisi");
    const s = muatSimpan({
      tekan: () => ({ ok: true, bukti: "terkirim" }),
      bukti,
      jedaBuktiMs: 25_000,
      keadaan: () => BELUM,
    });
    const hasil = await s.jalankan();
    expect(hasil.bunyi).toContain("SIPP menolak menyimpan: Tidak Berhasil, Qobla/Bada Belum Diisi");
  });

  it("tombol tersembunyi: TIDAK dicari lewat penunjuk lain, dan sebabnya disebut", async () => {
    const s = muatSimpan({ tekan: () => ({ ok: false, alasan: "tombol_tidak_tampak" }), keadaan: () => BELUM });
    const hasil = await s.jalankan();
    expect(hasil.ok).toBe(false);
    expect(hasil.bunyi).toMatch(/disembunyikan halaman, jadi TIDAK ditekan/);
    expect(s.permintaanTekan).toHaveLength(1);
  });

  it("penunjuk berikutnya dicoba HANYA bila tombolnya tidak ada", async () => {
    const bukti = await rekamBukti(1, "Data Berhasil Disimpan");
    const daftar = penunjukSimpan();
    const s = muatSimpan({
      tekan: (p) => (p === daftar[0] ? { ok: false, alasan: "tombol_tidak_ketemu" } : { ok: true, bukti: "terkirim" }),
      bukti,
      keadaan: (ke) => (ke === 0 ? BELUM : PUTUS),
    });
    const hasil = await s.jalankan();
    expect(hasil.ok).toBe(true);
    expect(s.permintaanTekan).toEqual(daftar.slice(0, 2));
  });
});

// ===========================================================================
describe("muatan POST isian-sipp memuat 'terpilih' untuk medan yang terisi (K9)", () => {
  function muatPembangun() {
    const isi = konten();
    const k: Record<string, unknown> = {};
    vm.createContext(k);
    vm.runInContext(
      [
        potongFungsi(isi, "nilaiTerpilihMedan"),
        potongFungsi(isi, "muatanUsulanMedan"),
        "this.terpilih = nilaiTerpilihMedan; this.muatan = muatanUsulanMedan;",
      ].join("\n"),
      k
    );
    return k as unknown as {
      terpilih: (jawab: unknown, banyak: boolean) => unknown;
      muatan: (nomor: string, jenis: string, daftar: unknown[]) => { medan: Array<Record<string, unknown>> };
    };
  }

  /** Jawaban "pilihan" dari jembatan.js SUNGGUHAN atas borang berbentuk edit_putusan_akhir.php. */
  function bacaBorang(badan: string, penunjuk: string) {
    const s = bukaSipp(BORANG(badan));
    return s.minta({ jenis: "pilihan", penunjuk });
  }

  it("isian bawaan SIPP bukan pilihan: -1, kosong, dan '- Pilih -' bernilai 0", () => {
    const p = muatPembangun();
    const status = bacaBorang(
      '<select name="status_putusan"><option value="-1" selected>Pilih Status Putusan</option><option value="62">Dikabulkan</option></select>',
      'select[name="status_putusan"]'
    );
    const istri = bacaBorang(
      '<select name="keadaan_istri"><option value="">Pilih Keadaan Istri</option><option value="1">Suci</option></select>',
      'select[name="keadaan_istri"]'
    );
    const dispen = bacaBorang(
      '<select name="alasan_dispen"><option value=0>- Pilih -</option><option value=3>Hamil</option></select>',
      'select[name="alasan_dispen"]'
    );
    expect(p.terpilih(status, false)).toBeUndefined();
    expect(p.terpilih(istri, false)).toBeUndefined();
    expect(p.terpilih(dispen, false)).toBeUndefined();
  });

  it("yang sudah dipilih petugas ikut dikirim - termasuk qobla 0 yang SAH", () => {
    const p = muatPembangun();
    const dispen = bacaBorang(
      '<select name="alasan_dispen"><option value=0>- Pilih -</option><option value=3 selected>Hamil</option></select>',
      'select[name="alasan_dispen"]'
    );
    const qobla = bacaBorang(
      '<select name="qobla"><option value=-1>Pilih Salah Satu</option><option value=0 selected>Qobla Dukhul</option><option value=1>Ba\'da Dukhul</option></select>',
      'select[name="qobla"]'
    );
    const sumber = bacaBorang(
      "<input type='checkbox' name='sumber_hukum[]' value=8 checked />Kompilasi Hukum Islam<br/>" +
        "<input type='checkbox' name='sumber_hukum[]' value=9 />Undang-Undang<br/>" +
        "<input type='checkbox' name='sumber_hukum[]' value=10 checked />Hukum Syar'i<br/>",
      'input[name="sumber_hukum[]"]'
    );
    expect(p.terpilih(dispen, false)).toBe("3");
    expect(p.terpilih(qobla, false)).toBe("0");
    expect(p.terpilih(sumber, true)).toEqual(["8", "10"]);
  });

  it("muatannya membawa 'terpilih' HANYA pada medan yang terisi", () => {
    const p = muatPembangun();
    const muatan = p.muatan("1/Pdt.P/2026/PA.Dgl", "Dispensasi Kawin", [
      { kunci: 'select[name="alasan_dispen"]', label: "Alasan", pilihan: [{ nilai: "3", label: "Hamil" }], banyak: false, terpilih: "3" },
      { kunci: 'select[name="status_putusan"]', label: "Status", pilihan: [{ nilai: "62", label: "Dikabulkan" }], banyak: false, terpilih: undefined },
      { kunci: 'input[name="sumber_hukum[]"]', label: "Sumber Hukum", pilihan: [], banyak: true, terpilih: ["8", "10"] },
    ]);
    const lewatJson = JSON.parse(JSON.stringify(muatan));
    expect(lewatJson.medan[0].terpilih).toBe("3");
    expect("terpilih" in lewatJson.medan[1]).toBe(false);
    expect(lewatJson.medan[2].terpilih).toEqual(["8", "10"]);
    expect(lewatJson.medan[0]).toMatchObject({ kunci: 'select[name="alasan_dispen"]', label: "Alasan", banyak: false });
    expect(lewatJson.nomorPerkara).toBe("1/Pdt.P/2026/PA.Dgl");
  });
});
