// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * PERBAIKAN 1 OKTOBER 2026 - PANEL SIPP, UI BARU SAJA (agen S)
 * ============================================================================
 *
 * Dijaga dengan MENJALANKAN panel-alat.js, basmassal.js, dan konten.js UTUH di
 * jsdom (halaman detail perkara / daftar perkara SIPP tiruan), kecuali bagian
 * pengukuran butir 12 yang memotong bagianIsiPutusan beserta tepinya supaya
 * latensi tiap langkah dapat diatur.
 *
 *   butir 1   lipat seragam (alatJadikanLipat W) pada bagian, kartu, ringkasan daftar
 *   butir 2   "Ambil usulan dari ALETA" tersembunyi di UI Baru; draf dimuat sendiri
 *   butir 3   Putusan otomatis tanpa blangko: ALETA membuka tab + Edit Putusan Akhir
 *   butir 4   anonimisasi pilihan petugas dipakai apa adanya
 *   butir 5   Langkah berikutnya: sidang putus + putusan belum diinput -> Buat putusan
 *   butir 6   Perkara berikutnya hanya Super Admin & Admin
 *   butir 11  rute unggah-sipp: perkara_id diadu dengan nomornya, nomor dari SIPP
 *   butir 12  ukuran waktu sebelum/sesudah, bukti dan urutan tetap
 *   butir 13  putusan massal SIPP: hanya putus / ditunda untuk putusan
 *   butir 14  Admin per hakim, Hakim miliknya di atas
 *   butir 16  bagian di dalam tab menurut peran
 *   butir 16b Upload putusan ke e-Court (K6)
 *   K1        Lama dan Baru tanpa satu pun jejak
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () =>
  (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js")).replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "450/Pdt.G/2026/PA.Dgl";

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const hariIni = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

async function sampai<T>(periksa: () => T, keterangan: string, batas = 5000): Promise<NonNullable<T>> {
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

// ----------------------------------------------------------------------------
// Portal tiruan
// ----------------------------------------------------------------------------
function konteksContoh() {
  return {
    ok: true,
    nomorPerkara: NOMOR,
    nomorRegister: "PA.DGL-2026-0450",
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

type Petugas = { majelis?: string[]; panitera?: string[]; jurusita?: string[] };

function statusContoh(p: Petugas, putusan: Record<string, unknown> = { sudahPutus: false }) {
  const orang = (d: string[] = []) => d.map((nama) => ({ nama }));
  return {
    majelis: orang(p.majelis),
    panitera: orang(p.panitera),
    jurusita: orang(p.jurusita),
    ikrar: null,
    sumberMajelis: "pemeriksa",
    putusan,
    putusanLengkap: {},
    penilaianSk: { rinci: [] },
    tahapan: {
      terbaca: true,
      tahap: ["pendaftaran", "pmh", "ppp", "pjs", "phs"].map((kunci) => ({ kunci, terbaca: true, tanggal: "2026-09-10" })),
    },
  };
}

type Minta = { url: string; cara: string; badan: unknown };
type Jawab = { status?: number; isi?: unknown } | null | undefined;

type Opsi = {
  simpanan?: Record<string, unknown>;
  peran?: string;
  nama?: string;
  petugas?: Petugas;
  putusan?: Record<string, unknown>;
  statusGagal?: boolean;
  daftar?: boolean;
  html?: string;
  /** Jawaban portal tambahan - dipanggil lebih dulu; null/undefined = jawaban baku. */
  jawab?: (url: string, cara: string, badan: unknown) => Jawab;
  /** Jawaban jembatan (dunia halaman) tiruan. */
  jembatan?: (pesan: Record<string, unknown>) => Record<string, unknown>;
};

type Halaman = {
  dom: JSDOM;
  w: any;
  d: Document;
  minta: Minta[];
  jembatan: Array<Record<string, unknown>>;
  simpanan: Record<string, unknown>;
  /** Nilai ekspresi di lingkup skrip konten (let/const tingkat atas tidak ada di window). */
  nilai: (ekspresi: string) => any;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Opsi = {}): Halaman {
  const peran = p.peran ?? "Super Admin";
  const nama = p.nama ?? "Munifa, S.H.";
  const dom = new JSDOM(
    p.daftar
      ? `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>DAFTAR PERKARA</h3><table><tr><th>No</th><th>Nomor Perkara</th></tr><tr><td>1</td><td>621/Pdt.G/2026/PA.Dgl</td></tr><tr><td>2</td><td>620/Pdt.G/2026/PA.Dgl</td></tr></table></div></body></html>`
      : `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3>${p.html || ""}</div></body></html>`,
    { url: p.daftar ? `${ASAL}/SIPP/main` : `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<
      typeof JSDOM
    >[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: Record<string, unknown>, wilayah: string) => void> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      const ubah: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(isi)) {
        ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async (kunci: string | string[]) => {
      for (const k of [kunci].flat()) delete simpanan[k];
    },
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.176.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: { local, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: (f: any) => void pendengar.push(f) } },
  };
  const minta: Minta[] = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    minta.push({ url, cara, badan: opsi && opsi.body });
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    const khusus = p.jawab ? p.jawab(url, cara, opsi && opsi.body) : null;
    if (khusus) {
      status = khusus.status ?? 200;
      isi = khusus.isi;
    } else if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-bot/sipp-konteks/massal")) {
      isi = { ok: true, data: { available: true, perkara: {}, identitas: {} } };
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama, peran, kapabilitas: null } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = { ok: true, data: { available: true, konteks: konteksContoh(), pengguna: { nama, peran }, kapabilitas: null } };
    } else if (url.includes("/aleta-ecourt/status-perkara?")) {
      if (p.statusGagal) {
        status = 500;
        isi = { ok: false, error: { message: "bot mati" } };
      } else {
        isi = { ok: true, data: { available: true, status: statusContoh(p.petugas ?? { majelis: [nama] }, p.putusan) } };
      }
    } else if (url.includes("/putusan/isian-sipp?")) {
      isi = { ok: true, data: { ada: false, sebab: "Belum ada draf putusan untuk perkara ini." } };
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
  const jembatan: Array<Record<string, unknown>> = [];
  const pmAsli = w.postMessage.bind(w);
  w.postMessage = (data: any, asal: string) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id, ...pesan } = data;
      jembatan.push(polos(pesan));
      const balas = p.jembatan
        ? p.jembatan(pesan)
        : pesan.jenis === "pilihan"
          ? { ok: true, tampak: false, pilihan: [], nilaiSekarang: "" }
          : pesan.jenis === "nilai"
            ? { ok: true, nilai: "", tampak: true }
            : { ok: true, medan: [] };
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ...balas }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  return { dom, w, d: w.document, minta, jembatan, simpanan, nilai: (ekspresi: string) => vm.runInContext(ekspresi, ctx) };
}

const BARU = { ujiTampilan: "baru", ujiIzinkanNyata: true };
const UI = { ujiTampilan: "ui", ujiIzinkanNyata: true };

const panelDari = (h: Halaman) => h.d.getElementById("aleta-panel-sipp") as any;
const siapUi = async (h: Halaman) => {
  try {
    return await sampai(() => {
      const pn = panelDari(h);
      return pn && pn.getAttribute("data-t7") === "ui" && pn.getAttribute("data-s1") === "ui" && pn.querySelector(".aleta-t7-tab") ? pn : null;
    }, "panel UI Baru");
  } catch (galat) {
    const pn = panelDari(h);
    const ket = pn
      ? [pn.getAttribute("data-t7"), pn.getAttribute("data-s1"), Boolean(pn.querySelector(".aleta-t7-tab")), pn.dataset.mode, pn.className].join("|")
      : "tanpa panel";
    throw new Error(`${(galat as Error).message}; ${ket}; minta=${h.minta.map((m) => m.url.replace(ASAL, "")).join(", ")}`);
  }
};
const siapBaru = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.getAttribute("data-t7-a30") === "baru" && pn.querySelector(".aleta-kelompok") ? pn : null;
  }, "panel Baru");
const bagianDi = (pn: any, kunci: string) => pn.querySelector(`.aleta-bagian[data-kunci="${kunci}"]`);
const tampakDi = (el: any) => {
  for (let x = el; x; x = x.parentElement) {
    if (x.hasAttribute && (x.hasAttribute("data-s1-sembunyi") || x.hasAttribute("data-mps-sembunyi"))) return false;
  }
  return true;
};
const tombolBertulisan = (akar: ParentNode, teks: string) =>
  Array.from(akar.querySelectorAll("button")).find((b) => String(b.textContent || "").trim() === teks) as HTMLButtonElement | undefined;
function pilihBerkas(w: any, input: HTMLInputElement, berkas: File[]) {
  Object.defineProperty(input, "files", { configurable: true, value: berkas });
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
}
const BLANGKO = ` <div id="popup_form"><form id="frm_putusan"><textarea id="perhum"></textarea><textarea id="amar"></textarea><textarea id="amar_anonim"></textarea><input type="submit" id="simpan" value="Simpan"></form></div>`;

// ============================================================================
describe("K1: Lama dan Baru tanpa satu pun jejak perbaikan 1 Okt", () => {
  it("Baru dengan blangko terbuka: tombol Ambil usulan tampak, tidak ada data-s1, draf TIDAK dimuat sendiri", async () => {
    const h = buka({ simpanan: BARU, html: BLANGKO });
    const pn = await siapBaru(h);
    await tunggu(900);
    expect(pn.outerHTML).not.toMatch(/data-s1|aleta-s1-/);
    const tombol = tombolBertulisan(bagianDi(pn, "isiPutusan"), "Ambil usulan dari ALETA");
    expect(tombol).toBeTruthy();
    expect(tombol!.hasAttribute("data-s1-sembunyi")).toBe(false);
    expect(h.minta.some((m) => m.url.includes("/putusan/isian-sipp?"))).toBe(false);
    // Tanpa blangko pun Putusan otomatis TIDAK ada di Baru (seperti 1.176.0).
    expect(pn.querySelector('[data-s1-fitur="unggah-ecourt"]')).toBeNull();
  });

  it("Baru tanpa blangko: tidak ada Putusan otomatis dan tidak ada Upload ke e-Court", async () => {
    const h = buka({ simpanan: BARU });
    const pn = await siapBaru(h);
    await tunggu(50);
    expect(bagianDi(pn, "isiPutusan")).toBeNull();
    expect(bagianDi(pn, "s1UnggahEcourt")).toBeNull();
    expect(h.minta.some((m) => m.url.includes("ecourt-putusan"))).toBe(false);
  });

  it("Lama: tidak ada atribut, kelas, maupun permintaan baru", async () => {
    const h = buka({ html: BLANGKO });
    const pn = await sampai(() => panelDari(h) && panelDari(h).querySelector(".aleta-kelompok") && panelDari(h), "panel Lama");
    await tunggu(900);
    expect(pn.outerHTML).not.toMatch(/data-s1|aleta-s1-|aleta-lipatan/);
    expect(h.minta.some((m) => /isian-sipp\?|ecourt-putusan|\/aleta-ecourt\/sidang\?/.test(m.url))).toBe(false);
  });
});

// ============================================================================
describe("butir 1: lipat seragam (alatJadikanLipat milik W) - UI Baru", () => {
  it("tiap bagian dan kartu panel perkara berbentuk lipat seragam; kartu statis kini dapat dilipat", async () => {
    const h = buka({ simpanan: UI });
    const pn = await siapUi(h);
    await sampai(() => pn.querySelector(".aleta-t7-langkah.aleta-lipatan"), "kartu Langkah dilipat");
    const bagian = Array.from(pn.querySelectorAll(".aleta-isi .aleta-bagian")) as any[];
    expect(bagian.length).toBeGreaterThan(3);
    for (const b of bagian) expect(b.classList.contains("aleta-lipatan"), b.dataset.kunci).toBe(true);
    const kartu = pn.querySelector(".aleta-t7-langkah");
    const kepala = kartu.querySelector(".aleta-lipat-kepala");
    expect(kartu.getAttribute("data-terbuka")).toBe("ya");
    kepala.click();
    expect(kartu.getAttribute("data-terbuka")).toBe("tidak");
  });

  it("panel daftar perkara: ringkasan DAFTAR PERKARA kini dapat dilipat", async () => {
    const h = buka({ simpanan: UI, daftar: true });
    const pn = await sampai(() => {
      const x = panelDari(h);
      return x && x.dataset.mode === "daftar" && x.querySelector('[data-s1-fitur="daftar-ringkas"]') ? x : null;
    }, "panel daftar UI Baru");
    const ringkas = pn.querySelector('[data-s1-fitur="daftar-ringkas"]');
    expect(ringkas.classList.contains("aleta-lipatan")).toBe(true);
    expect(ringkas.textContent).toContain("DAFTAR PERKARA");
    // Isinya tidak berkurang: keterangan penandaan ikut pindah ke dalamnya.
    expect(ringkas.querySelector(".aleta-kosong, .aleta-baris-ket, .aleta-identitas")).not.toBeNull();
  });
});

// ============================================================================
describe("butir 2, 3, 4: Putusan otomatis di UI Baru", () => {
  it("blangko terbuka: Ambil usulan disembunyikan (tetap di DOM), draf ALETA dimuat SENDIRI sekali", async () => {
    const h = buka({ simpanan: UI, html: BLANGKO });
    const pn = await siapUi(h);
    const kotak = await sampai(() => pn.querySelector('.aleta-bagian[data-kunci="isiPutusan"][data-s1-putusan="ui"]'), "Putusan otomatis UI Baru");
    const tombol = kotak.querySelector("[data-s1-tombol-usulan]");
    expect(tombol.textContent).toBe("Ambil usulan dari ALETA");
    expect(tombol.hasAttribute("data-s1-sembunyi")).toBe(true);
    await sampai(() => h.minta.some((m) => m.url.includes(`/putusan/isian-sipp?nomorPerkara=${encodeURIComponent(NOMOR)}`)), "draf dimuat sendiri", 4000);
    await tunggu(900);
    expect(h.minta.filter((m) => m.url.includes("/putusan/isian-sipp?")).length).toBe(1);
    // Bagian anonimisasi opsional (butir 4) ada di kotak naskah.
    expect(kotak.querySelector(".aleta-s1-slot-anonim input[type=file]")).not.toBeNull();
  });

  it("antrean massal SIPP yang menunggu perkara ini: pengisiannya yang berlaku (s1AntreanMenunggu)", async () => {
    const h = buka({ simpanan: { ...UI, antreanPutusanMassal: { tahap: "sipp", butir: [{ nomor: NOMOR, keadaan: "menunggu" }] } } });
    await siapUi(h);
    expect(await h.w.s1AntreanMenunggu(NOMOR)).toBe(true);
    expect(await h.w.s1AntreanMenunggu("1/Pdt.G/2026/PA.Dgl")).toBe(false);
  });

  it("TANPA blangko: naskah dipilih -> Jalankan -> tab Putusan Akhir + Edit Putusan Akhir ditekan -> naskah dibaca di blangko", async () => {
    const h = buka({
      simpanan: UI,
      // Spasi di depan: jsdom membaca innerText lewat textContent, dan nomor
      // perkara yang menempel pada kata berikutnya tidak dikenali sebagai nomor.
      html: ` <ul><li><a class="tabs10" href="#tabs10">Putusan Akhir</a></li></ul><div id="tabs10"></div>`,
      jawab: (url, cara) =>
        url.includes("/putusan/unggah-naskah") && cara === "POST"
          ? { isi: { ok: true, data: { ok: true, versi: 4, bagian: [{ judul: "Amar", aksara: 120 }] } } }
          : null,
    });
    // SIPP tiruan: tab memuat isinya lewat AJAX, tautan Edit membuka tingkap blangko.
    const ditekan: string[] = [];
    h.d.querySelector('a[href="#tabs10"]')!.addEventListener("click", () => {
      ditekan.push("tab");
      setTimeout(() => {
        h.d.getElementById("tabs10")!.innerHTML =
          `<a href="#" onclick="popup_form('${ASAL}/SIPP/add_putusan_akhir/RU5D/diversi')">Diversi</a>` +
          `<a href="#" class="edit" onclick="popup_form('${ASAL}/SIPP/add_putusan_akhir/RU5D/update')">Edit Putusan Akhir</a>`;
        h.d.querySelector("a.edit")!.addEventListener("click", () => {
          ditekan.push("edit");
          setTimeout(() => h.d.body.insertAdjacentHTML("beforeend", BLANGKO), 30);
        });
      }, 30);
    });
    const pn = await siapUi(h);
    const kotak = await sampai(() => pn.querySelector('[data-s1-fitur="putusan-tanpa-blangko"]'), "Putusan otomatis tanpa blangko");
    expect(kotak.getAttribute("data-kunci")).toBe("isiPutusan");
    const naskah = new h.w.File(["{\\rtf1 naskah}"], "putusan 450.rtf", { type: "application/rtf" });
    pilihBerkas(h.w, kotak.querySelector(".aleta-s1-slot-naskah input"), [naskah]);
    (kotak.querySelector("[data-s1-jalankan]") as HTMLButtonElement).click();
    const kirim = await sampai(() => h.minta.find((m) => m.url.includes("/putusan/unggah-naskah") && m.cara === "POST"), "naskah dikirim dari blangko", 6000);
    expect(ditekan).toEqual(["tab", "edit"]);
    expect((kirim.badan as FormData).get("berkas")).toBeTruthy();
    expect(((kirim.badan as FormData).get("berkas") as File).name).toBe("putusan 450.rtf");
    // Panel sudah digambar ulang dengan blangkonya: bagian aslinya, gaya UI Baru.
    expect(panelDari(h).querySelector('.aleta-bagian[data-kunci="isiPutusan"][data-s1-putusan="ui"]')).not.toBeNull();
    // Tidak ada tulisan ke SIPP: Simpan tidak ditekan.
    expect(h.jembatan.some((x) => x.jenis === "tekan")).toBe(false);
  });

  it("tanpa tab Putusan Akhir: disebut sebabnya, tidak ada yang ditekan", async () => {
    const h = buka({ simpanan: UI });
    const pn = await siapUi(h);
    const kotak = await sampai(() => pn.querySelector('[data-s1-fitur="putusan-tanpa-blangko"]'), "bagian");
    (kotak.querySelector("[data-s1-jalankan]") as HTMLButtonElement).click();
    await sampai(() => /Tab Putusan Akhir belum ada/.test(kotak.textContent || ""), "sebab disebut");
    expect(h.nilai("s1Tugas")).toBeNull();
  });

  it("butir 4: anonimisasi PILIHAN petugas diunggah apa adanya - tanpa konversi dan tanpa anonimisasi ABT", async () => {
    const h = buka({
      simpanan: UI,
      jawab: (url, cara) =>
        url.includes("/putusan/unggah-sipp") && cara === "POST"
          ? { isi: { ok: true, data: { ok: true, berkas: [{ jenis: "putusan", ok: true, jalur: "a" }, { jenis: "anonimisasi", ok: true, jalur: "b" }] } } }
          : null,
    });
    await siapUi(h);
    const asli = new h.w.File(["{\\rtf1 putusan}"], "putusan.rtf");
    const anonim = new h.w.File(["{\\rtf1 anonim}"], "putusan - anonim saya.rtf");
    const opsi = await h.w.a30OpsiSimpanPutusan({ nomorPerkara: NOMOR, edoc: { asli, rtf: asli, anonim } });
    const kabar = h.d.createElement("div");
    const hasil = await opsi.sesudahTersimpan(kabar);
    expect(hasil.ok).toBe(true);
    const unggah = h.minta.filter((m) => m.url.includes("/putusan/unggah-sipp"));
    expect(unggah).toHaveLength(1);
    expect(((unggah[0].badan as FormData).get("anonimisasi") as File).name).toBe("putusan - anonim saya.rtf");
    expect(h.minta.some((m) => /konversi-naskah|abt\/main\/anonim/.test(m.url))).toBe(false);
  });
});

// ============================================================================
describe("butir 5: Langkah berikutnya mengenali sidang yang sudah putus", () => {
  it("s1NilaiSidangPutus: sidang terakhir yang sudah berlangsung menentukan (aletaMassalAlasanPutusan milik M)", async () => {
    const h = buka({ simpanan: UI });
    await siapUi(h);
    const f = (j: unknown[]) => polos(h.w.s1NilaiSidangPutus(j, "2026-10-01"));
    expect(f([{ tanggalSidang: "2026-09-20", agenda: "Pembuktian", ditunda: true, alasanDitunda: "Pembuktian penggugat" }])).toBeNull();
    expect(f([{ tanggalSidang: "2026-10-01", agenda: "Pembacaan Putusan", ditunda: false, alasanDitunda: "Putus" }])).toMatchObject({ jenis: "putus", tanggal: "2026-10-01" });
    expect(f([{ tanggalSidang: "2026-09-24", agenda: "Kesimpulan", ditunda: true, alasanDitunda: "Musyawarah Majelis" }])).toMatchObject({ jenis: "tunda-putusan" });
    // Sidang yang belum berlangsung (besok) tidak dihitung.
    expect(f([{ tanggalSidang: "2026-10-02", agenda: "Pembacaan Putusan", ditunda: false, alasanDitunda: "" }])).toBeNull();
    // Urutan masukan tidak menentukan: yang TERAKHIR berlangsung yang dipakai.
    expect(
      f([
        { tanggalSidang: "2026-10-01", agenda: "Pembacaan Putusan", ditunda: false, alasanDitunda: "Putus" },
        { tanggalSidang: "2026-09-01", agenda: "Mediasi", ditunda: true, alasanDitunda: "Mediasi" },
      ])
    ).toMatchObject({ jenis: "putus" });
  });

  it("putusan belum diinput + sidang putus -> 'Buat putusan' membawa ke Putusan otomatis", async () => {
    const h = buka({
      simpanan: UI,
      jawab: (url) =>
        url.includes("/aleta-ecourt/sidang?nomor=")
          ? {
              isi: {
                ok: true,
                data: {
                  available: true,
                  sipp: { jadwalPerkara: [{ tanggalSidang: hariIni(), agenda: "Pembacaan Putusan", ditunda: false, alasanDitunda: "Putus" }] },
                },
              },
            }
          : null,
    });
    const pn = await siapUi(h);
    const butir = await sampai(() => pn.querySelector('[data-s1-langkah="buat-putusan"]'), "langkah Buat putusan");
    expect(butir.textContent).toMatch(/Buat putusan - sidang .* sudah putus .* belum diinput di SIPP/);
    expect(butir.className).toContain("aleta-t7-nada-lewat");
    tombolBertulisan(butir, "Buat putusan")!.click();
    expect(pn.getAttribute("data-t7-tab")).toBe("putusanKel");
    expect((bagianDi(pn, "isiPutusan").querySelector(".aleta-bagian-isi") as HTMLElement).style.display).not.toBe("none");
  });

  it("Juru Sita (menu tanpa Putusan): jadwal sidang tidak dibaca untuk langkah ini", async () => {
    const h = buka({ simpanan: UI, peran: "Jurusita", nama: "Mustini", petugas: { jurusita: ["Mustini"] } });
    const pn = await siapUi(h);
    await sampai(() => !pn.querySelector(".aleta-s1-langkah-kabar") || !/Memeriksa/.test(pn.querySelector(".aleta-t7-langkah").textContent), "langkah selesai");
    await tunggu(300);
    expect(h.minta.some((m) => m.url.includes("/aleta-ecourt/sidang?nomor="))).toBe(false);
  });

  it("keadaan perkara tidak terbaca: disebut, BUKAN 'tidak ada yang mendesak'", async () => {
    const h = buka({ simpanan: UI, statusGagal: true });
    const pn = await siapUi(h);
    const kartu = pn.querySelector(".aleta-t7-langkah");
    await sampai(() => /Keadaan perkara tidak terbaca/.test(kartu.textContent || ""), "gagal disebut");
    expect(kartu.textContent).not.toContain("Tidak ada yang mendesak");
  });

  it("sudah putus tanpa minutasi: Minutasi berkas perkara (tidak menanyakan jadwal sidang)", async () => {
    const h = buka({ simpanan: UI, putusan: { sudahPutus: true, tanggalPutusan: "2026-10-01", tanggalMinutasi: "", tanggalBht: "" } });
    const pn = await siapUi(h);
    await sampai(() => /Minutasi berkas perkara/.test(pn.querySelector(".aleta-t7-langkah").textContent || ""), "minutasi");
    expect(h.minta.some((m) => m.url.includes("/aleta-ecourt/sidang?nomor="))).toBe(false);
  });
});

// ============================================================================
describe("butir 6 & 16: bagian di dalam tab menurut peran (UI Baru)", () => {
  const FITUR = { "sipp-21": true, "sipp-29": true };
  const kasus: Array<[string, string, boolean]> = [
    ["Super Admin", "admin", true],
    ["Admin", "admin", true],
    ["Wakil Ketua", "ketua", false],
    ["Hakim", "hakim", false],
    ["Panitera Pengganti", "panitera", false],
    ["Jurusita", "jurusita", false],
    ["Operator", "lain", false],
  ];
  for (const [peran, golongan, bolehBerikutnya] of kasus) {
    it(`${peran}: Perkara berikutnya ${bolehBerikutnya ? "tampak" : "TIDAK tampak"}; lompatan ⋯ ikut tab perannya`, async () => {
      const h = buka({ simpanan: { ...UI, ujiFitur: FITUR }, peran, nama: "Munifa, S.H.", petugas: { majelis: ["Munifa, S.H."], panitera: ["Munifa, S.H."], jurusita: ["Munifa, S.H."] } });
      const pn = await siapUi(h);
      await tunggu(1200);
      expect(pn.getAttribute("data-s1-peran")).toBe(golongan);
      const kartu = pn.querySelector('[data-t7-fitur="sipp-21"]');
      if (bolehBerikutnya) expect(kartu && tampakDi(kartu)).toBe(true);
      else expect(Boolean(kartu && tampakDi(kartu))).toBe(false);
      // Tiap bagian yang TAMPAK harus berada di tab yang tampak bagi peran ini.
      const tabTampak = Array.from(pn.querySelectorAll(".aleta-t7-tab"))
        .filter((t: any) => tampakDi(t))
        .map((t: any) => t.getAttribute("data-t7-ke"));
      for (const b of Array.from(pn.querySelectorAll(".aleta-isi .aleta-bagian")) as any[]) {
        if (!tampakDi(b)) continue;
        const kel = b.closest(".aleta-kelompok");
        if (kel && pn.querySelector(".aleta-t7-tabbar")) expect(tabTampak, `${b.dataset.kunci} di ${kel.dataset.kunci}`).toContain(kel.dataset.kunci);
      }
      // Lompatan ⋯ ke bagian di tab yang tidak tampak ikut tersembunyi.
      const menu = pn.querySelector(".aleta-t7-menu");
      for (const teks of ["Batalkan penetapan terakhir…", "Data umum dari gugatan"]) {
        const item = Array.from(menu.querySelectorAll(".aleta-t7-menu-item")).find((b: any) => b.textContent.trim() === teks) as any;
        if (!item) continue;
        const bolehPenetapan = tabTampak.includes("kerjakan") || !pn.querySelector(".aleta-t7-tabbar");
        expect(tampakDi(item), `${peran} ${teks}`).toBe(bolehPenetapan);
      }
      const zona = menu.querySelector(".aleta-t7-menu-zona");
      if (zona) expect(zona.hasAttribute("data-s1-sembunyi")).toBe(!tabTampak.includes("kerjakan") && Boolean(pn.querySelector(".aleta-t7-tabbar")));
      // Komentar BAS bukan untuk juru sita.
      const bas = pn.querySelector('[data-t7-fitur="sipp-29"]');
      if (bas) expect(tampakDi(bas)).toBe(golongan !== "jurusita" && (golongan === "admin" || tabTampak.includes("berkas")));
    });
  }

  it("Upload ke e-Court duduk di tab Putusan: tampak bagi Admin/Ketua/Hakim, tersembunyi bersama tabnya bagi Panitera/Juru Sita", async () => {
    for (const [peran, tampak] of [
      ["Hakim", true],
      ["Panitera Pengganti", false],
      ["Jurusita", false],
    ] as const) {
      const h = buka({ simpanan: UI, peran, petugas: { majelis: ["Munifa, S.H."], panitera: ["Munifa, S.H."], jurusita: ["Munifa, S.H."] } });
      const pn = await siapUi(h);
      await tunggu(1100);
      const b = bagianDi(pn, "s1UnggahEcourt");
      expect(b, peran).not.toBeNull();
      expect(b.closest(".aleta-kelompok").dataset.kunci).toBe("putusanKel");
      expect(tampakDi(b), peran).toBe(tampak);
    }
  });
});

// ============================================================================
describe("butir 16b: Upload putusan ke e-Court (K6)", () => {
  const AKUN = (isi: unknown, status = 200) => (url: string, cara: string) => (url.includes("/ecourt-putusan/akun?") && cara === "GET" ? { status, isi } : null);

  it("letaknya tepat di bawah unggah edoc ke SIPP; rute belum ada = 'belum tersedia di server', bukan error merah", async () => {
    const h = buka({ simpanan: UI, jawab: AKUN({}, 404) });
    const pn = await siapUi(h);
    const b = bagianDi(pn, "s1UnggahEcourt");
    expect(b.previousElementSibling.getAttribute("data-kunci")).toBe("unggahPutusanSipp");
    b.querySelector(".aleta-bagian-judul").click();
    await sampai(() => b.querySelector(".aleta-t7-belum"), "belum tersedia");
    expect(b.textContent).toContain("belum tersedia di server");
    expect(b.querySelector(".aleta-abt-gagal")).toBeNull();
    expect(h.minta.find((m) => m.url.includes("/ecourt-putusan/akun?"))!.url).toContain(`nomor=${encodeURIComponent(NOMOR)}`);
  });

  it("tanpa sesi: arahan ke Integrasi e-Court, tombol mati", async () => {
    const h = buka({ simpanan: UI, jawab: AKUN({ ok: true, data: { ok: true, akun: null, alasan: "belum disambungkan", salinan: null } }) });
    const pn = await siapUi(h);
    const b = bagianDi(pn, "s1UnggahEcourt");
    b.querySelector(".aleta-bagian-judul").click();
    const a = await sampai(() => b.querySelector(".aleta-s1-ecourt-putus a"), "tautan Integrasi");
    expect(a.textContent).toContain("Integrasi e-Court");
    expect((b.querySelector(".aleta-s1-ecourt-tombol") as HTMLButtonElement).disabled).toBe(true);
  });

  it("akun tersambung: nama disebut SEBELUM tombol dan di konfirmasi; batal = tidak ada yang dikirim; ya = POST nomor + berkas", async () => {
    const h = buka({
      simpanan: UI,
      jawab: (url, cara) => {
        if (url.includes("/ecourt-putusan/akun?")) {
          return { isi: { ok: true, data: { ok: true, akun: { nama: "Dra. Hj. Munifa, M.H.", peran: "Hakim", tersambung: true, sumber: "pribadi" }, salinan: { sudahDiunggah: false } } } };
        }
        if (url.includes("/ecourt-putusan/unggah") && cara === "POST") {
          return { isi: { ok: true, data: { ok: true, akun: { nama: "Dra. Hj. Munifa, M.H.", peran: "Hakim" }, salinan: { sudahDiunggah: true, tanggal: "2026-10-01" } } } };
        }
        return null;
      },
    });
    const pn = await siapUi(h);
    const b = bagianDi(pn, "s1UnggahEcourt");
    b.querySelector(".aleta-bagian-judul").click();
    await sampai(() => /Akan diunggah atas nama: Dra\. Hj\. Munifa, M\.H\. \(Hakim\) di e-Court/.test(b.textContent || ""), "nama akun");
    expect(b.textContent).toContain("BELUM diunggah");
    const tombol = b.querySelector(".aleta-s1-ecourt-tombol") as HTMLButtonElement;
    expect(tombol.disabled).toBe(true);
    pilihBerkas(h.w, b.querySelector(".aleta-s1-slot-ecourt input"), [new h.w.File(["%PDF-1.7"], "salinan 450.pdf", { type: "application/pdf" })]);
    expect(tombol.disabled).toBe(false);
    tombol.click();
    const tanya = await sampai(() => b.querySelector(".aleta-a30-tanya"), "konfirmasi");
    expect(tanya.textContent).toContain("ATAS NAMA Dra. Hj. Munifa, M.H. (Hakim)");
    (tanya.querySelector(".aleta-a30-tanya-tidak") as HTMLButtonElement).click();
    await sampai(() => /Dibatalkan/.test(b.textContent || ""), "batal");
    expect(h.minta.some((m) => m.url.includes("/ecourt-putusan/unggah"))).toBe(false);

    tombol.click();
    const tanya2 = await sampai(() => b.querySelector(".aleta-a30-tanya"), "konfirmasi kedua");
    const cek = tanya2.querySelector("input[type=checkbox]") as HTMLInputElement;
    cek.checked = true;
    cek.dispatchEvent(new h.w.Event("change"));
    (tanya2.querySelector(".aleta-a30-tanya-ya") as HTMLButtonElement).click();
    const kirim = await sampai(() => h.minta.find((m) => m.url.includes("/ecourt-putusan/unggah") && m.cara === "POST"), "POST unggah");
    const badan = kirim.badan as FormData;
    expect(badan.get("nomor")).toBe(NOMOR);
    expect((badan.get("berkas") as File).name).toBe("salinan 450.pdf");
    await sampai(() => /Terunggah ke e-Court atas nama Dra\. Hj\. Munifa, M\.H\. \(Hakim\)/.test(b.textContent || ""), "terunggah");
    expect(b.textContent).toContain("SUDAH diunggah");
  });

  it("mode coba (tanpa izin tulis nyata): POST ditahan dan disebut - e-Court tidak masuk ALETA_COBA_BOLEH", async () => {
    const h = buka({
      simpanan: { ujiTampilan: "ui" },
      jawab: AKUN({ ok: true, data: { ok: true, akun: { nama: "Munifa", peran: "Hakim", tersambung: true }, salinan: null } }),
    });
    const pn = await siapUi(h);
    expect(h.nilai("ALETA_COBA_BOLEH").some((p: RegExp) => p.test("/aleta/api/aleta-ecourt/ecourt-putusan/unggah"))).toBe(false);
    const b = bagianDi(pn, "s1UnggahEcourt");
    b.querySelector(".aleta-bagian-judul").click();
    await sampai(() => /Akan diunggah atas nama: Munifa/.test(b.textContent || ""), "akun");
    pilihBerkas(h.w, b.querySelector(".aleta-s1-slot-ecourt input"), [new h.w.File(["%PDF"], "s.pdf")]);
    (b.querySelector(".aleta-s1-ecourt-tombol") as HTMLButtonElement).click();
    const tanya = await sampai(() => b.querySelector(".aleta-a30-tanya"), "konfirmasi");
    const cek = tanya.querySelector("input[type=checkbox]") as HTMLInputElement;
    cek.checked = true;
    cek.dispatchEvent(new h.w.Event("change"));
    (tanya.querySelector(".aleta-a30-tanya-ya") as HTMLButtonElement).click();
    await sampai(() => /ditahan/.test(b.textContent || ""), "ditahan disebut");
    expect(h.minta.some((m) => m.url.includes("/ecourt-putusan/unggah") && m.cara === "POST")).toBe(false);
  });
});

// ============================================================================
describe("butir 13 & 14: putusan massal SIPP (UI Baru)", () => {
  const SIDANG = [
    { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", perkaraId: "1", jenisPerkara: "Cerai Gugat", agenda: "Pembacaan Putusan", ditunda: false, alasanDitunda: "Putus", majelisNama: "Munifa, S.H., Ahmad Fauzi, S.H.I." },
    { nomorPerkara: "2/Pdt.G/2026/PA.Dgl", perkaraId: "2", jenisPerkara: "Cerai Talak", agenda: "Kesimpulan", ditunda: true, alasanDitunda: "Musyawarah Majelis", majelisNama: "Ahmad Fauzi, S.H.I., Munifa, S.H." },
    { nomorPerkara: "3/Pdt.G/2026/PA.Dgl", perkaraId: "3", jenisPerkara: "Cerai Gugat", agenda: "Pembuktian", ditunda: true, alasanDitunda: "Panggil saksi", majelisNama: "Munifa, S.H." },
    { nomorPerkara: "4/Pdt.G/2026/PA.Dgl", perkaraId: "4", jenisPerkara: "Cerai Gugat", agenda: "Musyawarah Majelis", ditunda: false, alasanDitunda: "", majelisNama: "Rahmat Hidayat, S.H." },
  ];
  const jawabMassal = (url: string) => {
    if (url.includes("/aleta-ecourt/sidang?") && url.includes("dari=")) return { isi: { ok: true, data: { available: true, sidang: SIDANG.map((s) => ({ ...s, tanggalSidang: hariIni() })) } } };
    if (url.includes("/putusan/isian-sipp?")) return { isi: { ok: true, data: { ada: true, versi: 1 } } };
    return null;
  };
  const muatMassal = async (h: Halaman) => {
    const kotak = h.w.bagianMassalSipp(() => undefined);
    h.d.body.appendChild(kotak);
    kotak.muat();
    await sampai(() => /dapat dicentang/.test(kotak.textContent || ""), "daftar massal tersusun");
    return kotak;
  };
  const nomorBaris = (akar: any) => Array.from(akar.querySelectorAll(".aleta-massal-baris .aleta-massal-nomor")).map((x: any) => x.textContent);

  it("Super Admin: hanya putus / ditunda untuk putusan, dikelompokkan per ketua majelis dengan centang per kelompok", async () => {
    const h = buka({ simpanan: UI, peran: "Super Admin", jawab: jawabMassal });
    await siapUi(h);
    const kotak = await muatMassal(h);
    const kelompok = Array.from(kotak.querySelectorAll(".aleta-massal-kelompok[data-pengguna]")) as any[];
    expect(kelompok.map((k) => k.textContent.match(/^[^·]+/)![0].trim())).toEqual(["Ahmad Fauzi, S.H.I.", "Munifa, S.H.", "Rahmat Hidayat, S.H."]);
    expect(nomorBaris(kotak.querySelector(".aleta-massal-per-user"))).toEqual(["2/Pdt.G/2026/PA.Dgl", "1/Pdt.G/2026/PA.Dgl", "4/Pdt.G/2026/PA.Dgl"]);
    const tidakIkut = kotak.querySelector('[data-s1-fitur="massal-tidak-ikut"]');
    expect(tidakIkut.textContent).toContain("3/Pdt.G/2026/PA.Dgl");
    // Centang "Kerjakan semua milik X" menyalakan baris kelompok itu saja.
    const cMunifa = kelompok[1].querySelector(".aleta-massal-kelompok-centang") as HTMLInputElement;
    cMunifa.checked = true;
    cMunifa.dispatchEvent(new h.w.Event("change"));
    const nyala = Array.from(kotak.querySelectorAll(".aleta-massal-baris")).filter((b: any) => b.querySelector("input").checked).map((b: any) => b.querySelector(".aleta-massal-nomor").textContent);
    expect(nyala).toEqual(["1/Pdt.G/2026/PA.Dgl"]);
    // Sebab ikutnya tertulis di barisnya.
    expect(kotak.textContent).toContain("Ditunda untuk: Musyawarah Majelis");
  });

  it("Hakim: tanpa kelompok per user; miliknya di atas, majelis lain terlipat (tetap dapat dicentang)", async () => {
    const h = buka({ simpanan: UI, peran: "Hakim", nama: "Munifa" , jawab: jawabMassal });
    await siapUi(h);
    const kotak = await muatMassal(h);
    expect(kotak.querySelector(".aleta-massal-kelompok[data-pengguna]")).toBeNull();
    const lain = kotak.querySelector('[data-s1-fitur="massal-majelis-lain"]');
    expect(nomorBaris(lain)).toEqual(["4/Pdt.G/2026/PA.Dgl"]);
    const semua = nomorBaris(kotak).filter((n: string) => !nomorBaris(lain).includes(n));
    expect(semua).toEqual(["1/Pdt.G/2026/PA.Dgl", "2/Pdt.G/2026/PA.Dgl"]);
    expect((lain.querySelector("input.aleta-massal-centang") as HTMLInputElement).disabled).toBe(false);
  });

  it("Baru: daftar seperti 1.176.0 - seluruh perkara bersidang, datar", async () => {
    const h = buka({ simpanan: BARU, peran: "Super Admin", jawab: jawabMassal });
    await siapBaru(h);
    const kotak = h.w.bagianMassalSipp(() => undefined);
    h.d.body.appendChild(kotak);
    kotak.muat();
    await sampai(() => /dapat dicentang/.test(kotak.textContent || ""), "daftar Baru");
    expect(nomorBaris(kotak)).toEqual(SIDANG.map((s) => s.nomorPerkara));
    expect(kotak.outerHTML).not.toMatch(/data-s1|aleta-massal-kelompok/);
  });
});

// ============================================================================
describe("tidak ada jalur tulis SIPP baru dari blok 1 Okt", () => {
  const konten = KONTEN();
  const blok = konten.slice(konten.indexOf("PERBAIKAN 1 OKTOBER 2026 - PANEL SIPP"));

  it("pesan ke jembatan dari blok ini hanya BACAAN (nilai / pilihan); tidak ada postMessage sendiri", () => {
    expect(blok.length).toBeGreaterThan(5000);
    const pesan = blok.match(/kirimKeJembatan(?:Langsung)?\(\{[^}]*\}/g) || [];
    expect(pesan.length).toBeGreaterThan(0);
    for (const p of pesan) expect(p).toMatch(/jenis: "(nilai|pilihan)"/);
    expect(blok).not.toMatch(/postMessage\(/);
  });

  it("non-GET-nya hanya POST Upload ke e-Court (rute E); edoc SIPP tetap lewat jalur a30 / unggah-sipp yang ada", () => {
    expect((blok.match(/method:\s*"[A-Z]+"/g) || []).length).toBe(1);
    expect(blok).toContain('const S1_API_ECOURT_UNGGAH = "/aleta/api/aleta-ecourt/ecourt-putusan/unggah";');
    expect(blok).not.toMatch(/putusan\/unggah-sipp|penunjukan\/tulis/);
  });
});

// ============================================================================
// Butir 11 - rute unggah-sipp (dijalankan, gerbang ditiru)
// ============================================================================
const rute = vi.hoisted(() => ({
  tautan: null as unknown,
  unggah: [] as Array<Record<string, unknown>>,
  panggilTautan: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Penguji" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayStatusPerkara: async () => ({ ok: true, data: { identitas: { perkaraId: "999" } } }),
  getGatewaySippKonteks: async () => ({ ok: true, data: { nomorPihak: [] } }),
  getGatewaySippTautanPerkara: async (p: Record<string, unknown>) => {
    rute.panggilTautan.push(p);
    return rute.tautan;
  },
  gatewayUnggahPutusanSipp: async (m: Record<string, unknown>) => {
    rute.unggah.push(m);
    return { ok: true, data: { ok: true, berkas: [{ jenis: "putusan", ok: true }] } };
  },
}));

describe("butir 11: rute unggah-sipp mengadu perkara_id dengan nomornya", () => {
  beforeEach(() => {
    rute.tautan = null;
    rute.unggah = [];
    rute.panggilTautan = [];
  });
  const kirim = async (isian: Record<string, string>) => {
    const borang = new FormData();
    for (const [k, v] of Object.entries(isian)) borang.append(k, v);
    borang.append("putusan", new File([new TextEncoder().encode("%PDF-1.7 putusan")], "putusan.pdf"));
    const mod = await import("@/app/api/aleta-ecourt/putusan/unggah-sipp/route");
    const j = await mod.POST(new Request("http://uji.local/x", { method: "POST", body: borang }) as unknown as Parameters<typeof mod.POST>[0]);
    return (await j.json()) as { data: Record<string, unknown> };
  };

  it("perkara_id milik perkara LAIN: ditolak, tidak ada yang ditulis", async () => {
    rute.tautan = { ok: false, error: "nomor_tidak_cocok", status: 409 };
    const { data } = await kirim({ perkaraId: "77", nomorPerkara: NOMOR });
    expect(data.ok).toBe(false);
    expect(data.alasan).toBe("perkara_id_nomor_beda");
    expect(rute.unggah).toHaveLength(0);
    expect(rute.panggilTautan).toEqual([{ perkaraId: "77", nomor: NOMOR }]);
  });

  it("nomor tidak terbaca di ABT: nomornya ditanyakan ke SIPP dari perkara_id, unggahan berjalan", async () => {
    rute.tautan = { ok: true, data: { ok: true, perkaraId: "77", nomorPerkara: NOMOR, jalur: "", pintu: "" } };
    const { data } = await kirim({ perkaraId: "77", nomorPerkara: "" });
    expect(data.ok).toBe(true);
    expect(rute.unggah).toHaveLength(1);
    expect(rute.unggah[0]).toMatchObject({ perkaraId: "77", nomorPerkara: NOMOR });
  });

  it("bot tidak dapat memastikan (kunci SIPP tak terbaca): perilaku lama - perkara_id dipakai, nomor tetap wajib", async () => {
    rute.tautan = { ok: false, error: "kunci_tidak_terbaca", status: 503 };
    const ada = await kirim({ perkaraId: "77", nomorPerkara: NOMOR });
    expect(ada.data.ok).toBe(true);
    expect(rute.unggah[0]).toMatchObject({ perkaraId: "77", nomorPerkara: NOMOR });
    const tanpa = await kirim({ perkaraId: "77", nomorPerkara: "" });
    expect(tanpa.data.sebab).toBe("Nomor perkara belum disebut.");
  });

  it("unggah-naskah (draf dari panel ABT) memakai penjagaan yang sama: perkara_id milik perkara lain ditolak", async () => {
    rute.tautan = { ok: false, error: "nomor_tidak_cocok", status: 409 };
    const borang = new FormData();
    borang.append("perkaraId", "77");
    borang.append("nomorPerkara", NOMOR);
    borang.append("berkas", new File([new TextEncoder().encode("{\\rtf1 x}")], "naskah.rtf"));
    const mod = await import("@/app/api/aleta-ecourt/putusan/unggah-naskah/route");
    const j = await mod.POST(new Request("http://uji.local/x", { method: "POST", body: borang }) as unknown as Parameters<typeof mod.POST>[0]);
    const { data } = (await j.json()) as { data: Record<string, unknown> };
    expect(data).toMatchObject({ ok: false, alasan: "perkara_id_nomor_beda" });
  });

  it("tanpa perkara_id (halaman SIPP): tidak ada pertanyaan tambahan ke bot", async () => {
    const { data } = await kirim({ nomorPerkara: NOMOR });
    expect(data.ok).toBe(true);
    expect(rute.panggilTautan).toHaveLength(0);
    expect(rute.unggah[0]).toMatchObject({ perkaraId: "999" });
  });
});

// ============================================================================
// Butir 12 - PENGUKURAN: bagianIsiPutusan dipotong, tepinya berlatensi
// ============================================================================
function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}
function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => b.startsWith(`const ${nama} = `));
  if (mulai < 0) throw new Error(`tetapan ${nama} tidak ketemu`);
  if (baris[mulai].trimEnd().endsWith(";")) return baris[mulai];
  let j = mulai;
  while (j < baris.length && baris[j] !== "};" && baris[j] !== "];") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

/** Latensi (ms) yang ditiru, sebelum dikali skala. Diukur kasar dari pemakaian kantor - lihat laporan agen S. */
const LATENSI = {
  jembatan: 4,
  jembatanKaya: 40,
  draf: 300,
  naskah: 900,
  usulan: 1200,
  praperiksa: 1500,
  statusSegar: 800,
  anonim: 4000,
  simpan: 1500,
  edoc: 3000,
};
const SKALA = Number(process.env.ALETA_UKUR_SKALA || "0.25");

async function ukurSatu(mode: "baru" | "ui") {
  const konten = KONTEN();
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  terbuka.push(dom);
  const dokumen = dom.window.document;
  const t0 = Date.now();
  const jejak: Array<{ apa: string; t: number }> = [];
  const catat = (apa: string) => jejak.push({ apa, t: Date.now() - t0 });
  const L = (k: keyof typeof LATENSI) => new Promise((r) => setTimeout(r, Math.round(LATENSI[k] * SKALA)));
  const pesanJembatan: Array<{ jenis: string; penunjuk: string; t: number }> = [];

  // Borang: status_putusan & qobla adalah pintu, seperti edit_putusan_akhir.php.
  const pil = (...x: string[]) => [{ nilai: "-1", label: "Pilih" }, ...x.map((l, i) => ({ nilai: String(i + 1), label: l }))];
  const borang: Record<string, { tampak: boolean; nilai: string; pilihan: Array<{ nilai: string; label: string }> }> = {
    'select[name="status_putusan"]': { tampak: true, nilai: "-1", pilihan: pil("Dikabulkan", "Ditolak") },
    'select[name="verstek"]': { tampak: true, nilai: "T", pilihan: [{ nilai: "T", label: "Tidak" }, { nilai: "Y", label: "Ya" }] },
    'input[name="sumber_hukum[]"]': { tampak: true, nilai: "", pilihan: pil("UU", "KHI") },
    'select[name="faktor_cerai"]': { tampak: false, nilai: "-1", pilihan: pil("Perselisihan", "Ekonomi") },
    'select[name="faktor_cerai_sekunder"]': { tampak: false, nilai: "-1", pilihan: pil("Perselisihan", "Ekonomi") },
    'input[name="status_nusyuz"]': { tampak: false, nilai: "", pilihan: pil("Ya", "Tidak") },
    'select[name="qobla"]': { tampak: false, nilai: "-1", pilihan: [{ nilai: "-1", label: "Pilih" }, { nilai: "0", label: "Qobla Dukhul" }, { nilai: "1", label: "Ba'da Dukhul" }] },
    'select[name="keadaan_istri"]': { tampak: false, nilai: "-1", pilihan: pil("Hamil", "Tidak hamil") },
  };
  const tampakkan = (penunjuk: string) => {
    if (penunjuk === 'select[name="status_putusan"]') {
      for (const k of ['select[name="faktor_cerai"]', 'select[name="faktor_cerai_sekunder"]', 'input[name="status_nusyuz"]', 'select[name="qobla"]']) borang[k].tampak = true;
    }
    if (penunjuk === 'select[name="qobla"]') borang['select[name="keadaan_istri"]'].tampak = true;
  };
  let simpanDitekan = 0;
  let edocDiunggah = 0;
  const k: Record<string, any> = {
    console: { ...console, warn() {}, log() {} },
    setTimeout,
    clearTimeout,
    AbortController,
    URLSearchParams,
    URL,
    FormData: dom.window.FormData,
    File: dom.window.File,
    Blob: dom.window.Blob,
    encodeURIComponent,
    document: dokumen,
    location: { origin: ASAL, pathname: "/SIPP/detil_perkara_agama", search: "", hostname: "192.168.10.10" },
    window: {
      location: { hostname: "192.168.10.10", pathname: "/SIPP/detil_perkara_agama", search: "", origin: ASAL },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x },
      storage: { onChanged: { addListener() {} }, local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined }, session: { get: async () => ({}), set: async () => undefined } },
    },
    fetch: async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
      const url = String(alamat);
      const cara = String(opsi?.method || "GET").toUpperCase();
      const jawab = (isi: unknown) => {
        const r: any = { ok: true, status: 200, json: async () => polos(isi), clone: () => r };
        return r;
      };
      if (url.includes("/ekstensi/tipe-keluaran")) throw new TypeError("Failed to fetch");
      if (url.includes("/putusan/unggah-naskah")) {
        await L("naskah");
        catat("naskah tersimpan sebagai draf");
        return jawab({ data: { ok: true, versi: 2, bagian: [] } });
      }
      if (url.includes("/putusan/isian-sipp") && cara === "POST") {
        await L("usulan");
        catat("usulan medan tiba");
        const badan = JSON.parse(String(opsi?.body || "{}"));
        return jawab({
          data: {
            usulan: badan.medan.map((m: { kunci: string; pilihan: Array<{ nilai: string; label: string }> }) => {
              const x = m.pilihan.find((y) => y.nilai !== "-1") || m.pilihan[0];
              return { kunci: m.kunci, nilai: x.nilai, nilaiLabel: x.label, keyakinan: "pasti", nilaiBanyak: [x] };
            }),
          },
        });
      }
      if (url.includes("/putusan/isian-sipp")) {
        await L("draf");
        catat("draf tiba");
        return jawab({ data: { ada: true, versi: 2, keadaan: "draf", jenisPerkara: "Cerai Gugat", pertimbangan: "<p>Menimbang.</p>", amar: "<p>1. Mengabulkan;</p>", amarAnonim: "<p>1. Mengabulkan;</p>" } });
      }
      if (url.includes("/putusan/praperiksa")) {
        await L("praperiksa");
        catat("praperiksa tiba");
        return jawab({ data: { ada: true, hentikan: false, ringkas: "lolos", temuan: [] } });
      }
      return jawab({ ok: true });
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(ALAT, k, { filename: "panel-alat.js" });
  Object.assign(k, {
    bagian: (judul: string) => {
      const kotak = dokumen.createElement("div") as any;
      kotak.appendChild(dokumen.createElement("h3")).textContent = judul;
      kotak.isi = dokumen.createElement("div");
      kotak.appendChild(kotak.isi);
      dokumen.body.appendChild(kotak);
      return kotak;
    },
    alatCatat: () => undefined,
    alatCatatTindakan: () => undefined,
    alatKeringNyala: () => false,
    alatCobaAktif: () => false,
    alatLatihanNyala: () => false,
    t7RaporAgen: () => dokumen.createElement("div"),
    gambarRaporAgen: () => dokumen.createElement("div"),
    t7PasangPenyunting: () => undefined,
    perkaraIdDariHalaman: () => "",
    namaPenggunaSipp: () => "petugas",
    a30Aktif: () => true,
    s1Aktif: () => mode === "ui",
    bacaPutusanSegar: async () => {
      await L("statusSegar");
      catat("keadaan sebelum terbaca");
      return { sudahPutus: false, tanggal: "", status: "" };
    },
    a30SiapkanAnonimisasi: async (p: { berkas: File }) => {
      catat("anonimisasi mulai");
      await L("anonim");
      catat("anonimisasi siap");
      return { ok: true, berkas: new dom.window.File(["anon"], `${p.berkas.name} - anonimisasi.rtf`) };
    },
    a30UnggahEdoc: async () => {
      await L("edoc");
      edocDiunggah += 1;
      catat("edoc terunggah");
      return { ok: true, bunyi: "Edoc putusan dan edoc anonimisasi terunggah." };
    },
    simpanPutusanLaluBuka: async (_n: string, _kabar: unknown, o: { sebelum?: Promise<unknown>; sesudahTersimpan?: (k: unknown) => Promise<{ bunyi: string }> }) => {
      if (o && o.sebelum) await o.sebelum;
      catat("Simpan ditekan");
      simpanDitekan += 1;
      await L("simpan");
      catat("tersimpan terbukti");
      const lanjut = o && o.sesudahTersimpan ? await o.sesudahTersimpan(null) : { bunyi: "" };
      return { ok: true, bunyi: `Tersimpan di SIPP. ${lanjut.bunyi}` };
    },
    kirimKeJembatanLangsung: async (pesan: { jenis: string; penunjuk: string; nilai?: string; jenisMedan?: string }) => {
      pesanJembatan.push({ jenis: pesan.jenis, penunjuk: pesan.penunjuk, t: Date.now() - t0 });
      await new Promise((r) => setTimeout(r, pesan.jenis === "isi" && pesan.jenisMedan === "kaya" ? LATENSI.jembatanKaya : LATENSI.jembatan));
      const m = borang[pesan.penunjuk];
      if (pesan.jenis === "pilihan") {
        if (!m) return { ok: false, alasan: "tidak_ada" };
        return { ok: true, tampak: m.tampak, nilaiSekarang: m.nilai, pilihan: m.pilihan.map((x) => ({ ...x, terpilih: x.nilai === m.nilai })) };
      }
      if (pesan.jenis === "nilai") return { ok: true, nilai: m ? m.nilai : "", tampak: true };
      if (pesan.jenis === "isi") {
        if (m) {
          m.nilai = String(pesan.nilai);
          tampakkan(pesan.penunjuk);
        }
        return { ok: true };
      }
      return { ok: false };
    },
  });
  vm.runInContext(
    [
      tetapan(konten, "ALETA_API_ISIAN_PUTUSAN"),
      tetapan(konten, "ALETA_API_PRAPERIKSA_PUTUSAN"),
      tetapan(konten, "ALETA_API_UNGGAH_NASKAH"),
      tetapan(konten, "BATAS_UNGGAH_NASKAH_MS"),
      tetapan(konten, "NILAI_BAWAAN_BORANG"),
      tetapan(konten, "PENUNJUK_TANGGAL_PUTUSAN"),
      tetapan(konten, "A30_TERIMA_NASKAH"),
      ...(/^const s1Jeda = /m.test(konten) ? [tetapan(konten, "s1Jeda")] : []),
      "let penggunaTerakhir = null;",
      "let kapabilitasTerakhir = null;",
      ...[
        "buatElemen",
        "ringkasHentikan",
        "kirimKeJembatan",
        "nilaiTerpilihMedan",
        "nilaiTerpilihBukanBawaan",
        "muatanUsulanMedan",
        "bagianIsiPutusan",
        "jalankanPraperiksaPanel",
        "bacaUsulanBorangPutusan",
        "mintaPraperiksaPutusan",
        "a30OpsiSimpanPutusan",
        "a30BarisSekaligus",
        "a30Bentuk",
        "a30PerluKeRtf",
        ...(/^async function s1BacaUsulanBorangCepat\(/m.test(konten) ? ["s1BacaUsulanBorangCepat", "s1TungguBerubah"] : []),
        ...(/^function s1SiapkanAnonimAwal\(/m.test(konten) ? ["s1SiapkanAnonimAwal"] : []),
      ].map((nama) => potongFungsi(konten, nama)),
      "this.__uji = { bagianIsiPutusan };",
    ].join("\n"),
    k,
    { filename: "konten.js (potongan)" }
  );

  const kotak = k.__uji.bagianIsiPutusan(NOMOR) as HTMLDivElement;
  const pemilih = kotak.querySelector('input[type="file"]') as HTMLInputElement;
  catat("naskah dipilih");
  Object.defineProperty(pemilih, "files", { configurable: true, value: [new dom.window.File(["{\\rtf1 x}"], "putusan 450.rtf")] });
  pemilih.dispatchEvent(new dom.window.Event("change"));
  const terap = await sampai(
    () => Array.from(kotak.querySelectorAll("button")).find((b) => b.textContent === "Isikan yang dicentang") as HTMLButtonElement | undefined,
    "Isikan muncul",
    60000
  );
  catat("usulan tampil (Isikan dapat ditekan)");
  const hasil = terap.nextElementSibling as HTMLDivElement;
  terap.click();
  catat("Isikan ditekan");
  try {
    await sampai(() => /Tersimpan di SIPP/.test(hasil.textContent || ""), "selesai", 60000);
  } catch {
    throw new Error(`tidak selesai (${mode}): ${hasil.textContent} || ${String(kotak.textContent).slice(-600)}`);
  }
  catat("selesai: tersimpan + edoc");
  return { jejak, pesanJembatan, simpanDitekan, edocDiunggah, borang: polos(borang) };
}

describe("butir 12: Putusan otomatis lebih cepat TANPA membuang bukti (diukur)", () => {
  it(
    "UI Baru lebih cepat dari Baru; Simpan tetap sekali, praperiksa tetap membaca blangko sebelum isian pertama, isian sama",
    async () => {
      const sebelum = await ukurSatu("baru");
      const sesudah = await ukurSatu("ui");
      const waktu = (r: Awaited<ReturnType<typeof ukurSatu>>, apa: string) => (r.jejak.find((x) => x.apa === apa) || { t: NaN }).t;
      const baris = (apa: string) => `${apa.padEnd(42)} ${String(waktu(sebelum, apa)).padStart(6)} ms  ${String(waktu(sesudah, apa)).padStart(6)} ms`;
      const ringkas = [
        `PENGUKURAN butir 12 (skala latensi ${SKALA}; jeda gambar-ulang SIPP 350 ms tidak diskala)`,
        `${"langkah".padEnd(42)} ${"Baru".padStart(9)}  ${"UI Baru".padStart(9)}`,
        ...[
          "naskah tersimpan sebagai draf",
          "draf tiba",
          "praperiksa tiba",
          "usulan tampil (Isikan dapat ditekan)",
          "Isikan ditekan",
          "anonimisasi siap",
          "Simpan ditekan",
          "tersimpan terbukti",
          "selesai: tersimpan + edoc",
        ].map(baris),
        `Isikan->selesai: Baru ${waktu(sebelum, "selesai: tersimpan + edoc") - waktu(sebelum, "Isikan ditekan")} ms, UI Baru ${
          waktu(sesudah, "selesai: tersimpan + edoc") - waktu(sesudah, "Isikan ditekan")
        } ms`,
      ];
      process.stdout.write(`\n${ringkas.join("\n")}\n`);

      // Bukti tidak dibuang: Simpan sekali, edoc sekali, isian yang sama.
      for (const r of [sebelum, sesudah]) {
        expect(r.simpanDitekan).toBe(1);
        expect(r.edocDiunggah).toBe(1);
      }
      const isian = (r: typeof sebelum) => r.pesanJembatan.filter((x) => x.jenis === "isi").map((x) => x.penunjuk).sort();
      expect(isian(sesudah)).toEqual(isian(sebelum));
      expect(sesudah.borang).toEqual(sebelum.borang);
      // Praperiksa membaca status/verstek blangko SEBELUM pintu mana pun diisi.
      for (const r of [sebelum, sesudah]) {
        const bacaStatus = r.pesanJembatan.find((x) => x.jenis === "pilihan" && x.penunjuk === 'select[name="status_putusan"]')!.t;
        const isiPertama = r.pesanJembatan.find((x) => x.jenis === "isi")!.t;
        expect(bacaStatus).toBeLessThan(isiPertama);
      }
      // Anonimisasi disiapkan SEBELUM Simpan ditekan di keduanya.
      for (const r of [sebelum, sesudah]) expect(waktu(r, "anonimisasi siap")).toBeLessThanOrEqual(waktu(r, "Simpan ditekan"));
      // Lebih cepat: usulan tampil lebih awal, dan Isikan->selesai lebih singkat.
      expect(waktu(sesudah, "usulan tampil (Isikan dapat ditekan)")).toBeLessThan(waktu(sebelum, "usulan tampil (Isikan dapat ditekan)"));
      const lama = waktu(sebelum, "selesai: tersimpan + edoc") - waktu(sebelum, "Isikan ditekan");
      const baru = waktu(sesudah, "selesai: tersimpan + edoc") - waktu(sesudah, "Isikan ditekan");
      expect(baru).toBeLessThan(lama * 0.85);
    },
    120000
  );
});
