// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PUTUSAN OTOMATIS SIPP - 5 OKTOBER 2026 (keluhan 19, 21, 22)
 * ============================================================================
 *
 * Dijaga dengan MENJALANKAN panel-alat.js, basmassal.js, dan konten.js UTUH di
 * jsdom (halaman detail perkara SIPP tiruan), dan jembatan.js utuh untuk
 * kesiapan CKEditor.
 *
 *   19  Perkara yang BELUM diputus tidak punya tab Putusan Akhir; SIPP
 *       menawarkan tombol "Tambah Putusan Akhir" (popup_form
 *       add_putusan_akhir/<enc>/tambah). Putusan otomatis kini memakainya -
 *       dahulu menolak dengan "Tab Putusan Akhir belum ada". Antrean putusan
 *       massal mode otomatis membukanya sendiri.
 *   22  Panel membeku begitu ia sendiri memuat nomor perkara LAIN (kartu
 *       Perkara berikutnya, daftar antrean): cariNomorPerkara menghitungnya,
 *       halaman terbaca "daftar", dan blangko yang baru dibuka tidak pernah
 *       ditanggapi. Kini nomor milik panel tidak dihitung, dan Putusan
 *       otomatis menggambar ulang panelnya sendiri sesudah blangko terbuka.
 *   21  CKEditor yang belum siap ditunggu menurut keadaannya (bukan jam),
 *       dan tidak diisi selagi belum siap (isiannya akan ditimpa).
 *
 * ALETA_UJI_KONTEN / ALETA_UJI_JEMBATAN menunjuk SALINAN berkas untuk
 * pembukti gigitan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () =>
  (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js")).replace(/\r\n/g, "\n");
const JEMBATAN = () =>
  (process.env.ALETA_UJI_JEMBATAN ? readFileSync(process.env.ALETA_UJI_JEMBATAN, "utf8") : baca("jembatan.js")).replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "556/Pdt.G/2026/PA.Dgl";
const LAIN = "557/Pdt.G/2026/PA.Dgl";

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

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

function konteksContoh() {
  return {
    ok: true,
    nomorPerkara: NOMOR,
    nomorRegister: "PA.DGL-2026-0556",
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

function statusContoh(nama: string) {
  return {
    majelis: [{ nama }],
    panitera: [],
    jurusita: [],
    ikrar: null,
    sumberMajelis: "pemeriksa",
    putusan: { sudahPutus: false },
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
  html?: string;
  jawab?: (url: string, cara: string, badan: unknown) => Jawab;
  jembatan?: (pesan: Record<string, unknown>) => Record<string, unknown>;
  /** jembatan.js SUNGGUHAN di halaman yang sama (postMessage diteruskan apa adanya). */
  jembatanAsli?: boolean;
};
type Halaman = {
  dom: JSDOM;
  w: any;
  d: Document;
  minta: Minta[];
  jembatan: Array<Record<string, unknown>>;
  simpanan: Record<string, unknown>;
  nilai: (ekspresi: string) => any;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Opsi = {}): Halaman {
  const peran = "Super Admin";
  const nama = "Munifa, S.H.";
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3>${p.html || ""}</div></body></html>`,
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  // innerText peramban memisahkan blok dengan baris baru; textContent jsdom
  // menempelkannya ("…PA.DglALETA"), sehingga nomor di ujung blok tidak lagi
  // dikenali sebagai kata. Tiap simpul teks dipisah spasi - setara untuk uji ini.
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      const bagian: string[] = [];
      const jalan = this.ownerDocument.createTreeWalker(this, 4 /* NodeFilter.SHOW_TEXT */);
      for (let n = jalan.nextNode(); n; n = jalan.nextNode()) bagian.push((n as Text).data);
      return bagian.join(" ");
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
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.183.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
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
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama, peran, kapabilitas: null } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = { ok: true, data: { available: true, konteks: konteksContoh(), pengguna: { nama, peran }, kapabilitas: null } };
    } else if (url.includes("/aleta-ecourt/status-perkara?")) {
      isi = { ok: true, data: { available: true, status: statusContoh(nama) } };
    } else if (url.includes("/putusan/isian-sipp?")) {
      isi = { ok: true, data: { ada: false, sebab: "Belum ada draf putusan untuk perkara ini." } };
    } else if (url.includes("/putusan/unggah-naskah") && cara === "POST") {
      isi = { ok: true, data: { ok: true, versi: 3, bagian: [{ judul: "Amar", aksara: 120 }] } };
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
    if (p.jembatanAsli) {
      // Seperti peramban: pesan tiba sebagai MessageEvent bersumber jendela ini
      // sendiri, didengar jembatan.js dan konten.js sekaligus.
      if (data && data.sumber === "aleta-jembatan") jembatan.push(polos((({ id: _id, ...x }) => x)(data)));
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: polos(data), source: w })), 0);
      return;
    }
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
  if (p.jembatanAsli) {
    if (!w.CSS) w.CSS = { escape: (s: string) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) };
    vm.runInContext(JEMBATAN(), ctx, { filename: "jembatan.js" });
  }
  return { dom, w, d: w.document, minta, jembatan, simpanan, nilai: (ekspresi: string) => vm.runInContext(ekspresi, ctx) };
}

const UI = { ujiTampilan: "ui", ujiIzinkanNyata: true };
const panelDari = (h: Halaman) => h.d.getElementById("aleta-panel-sipp") as any;
const siapUi = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.getAttribute("data-t7") === "ui" && pn.getAttribute("data-s1") === "ui" && pn.querySelector(".aleta-t7-tab") ? pn : null;
  }, "panel UI Baru");
function pilihBerkas(w: any, input: HTMLInputElement, berkas: File[]) {
  Object.defineProperty(input, "files", { configurable: true, value: berkas });
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
}
const BLANGKO = ` <div id="popup_form"><div id="form_pop"><form id="frm_putusan"><textarea id="perhum"></textarea><textarea id="amar"></textarea><textarea id="amar_anonim"></textarea><input type="submit" id="simpan" value="Simpan"></form></div></div>`;

/**
 * Baris tombol atas detil_perkara_agama.php untuk perkara yang BELUM diputus:
 * Kembali, Tambah Data Rekonvensi, Tambah Putusan Sela, Tambah Putusan Akhir,
 * Pilih Draft Putusan Akhir - tanpa tab Putusan Akhir. Pengecoh: alamat
 * /tambah_sppa dan /tambah/tidakberwenang bukan blangko putusan biasa.
 */
const BARIS_TOMBOL =
  ` <table><tr>` +
  `<td><a href="#" class="btn">Kembali</a></td>` +
  `<td><a href="#" class="btn" onclick="popup_form('${ASAL}/SIPP/add_rekonvensi/RU5D')">Tambah Data Rekonvensi</a></td>` +
  `<td><a href="#" class="btn" onclick="popup_form('${ASAL}/SIPP/add_putusan_sela/RU5D/tambah')">Tambah Putusan Sela</a></td>` +
  `<td><a href="#" class="btn sppa" onclick="popup_form('${ASAL}/SIPP/add_putusan_akhir/RU5D/tambah_sppa')">Pengalihan SPPA</a></td>` +
  `<td><a href="#" class="btn tb" onclick="popup_form('${ASAL}/SIPP/add_putusan_akhir/RU5D/tambah/tidakberwenang')">Tidak Berwenang</a></td>` +
  `<td><a href="#" class="btn tambah" onclick="popup_form('${ASAL}/SIPP/add_putusan_akhir/RU5D/tambah')">Tambah Putusan Akhir</a></td>` +
  `<td><select><option>Pilih Draft Putusan Akhir</option></select></td>` +
  `</tr></table> `;

/** SIPP tiruan: tombol yang ditekan membuka tingkap blangko (popup_form + .load). */
function pasangSipp(h: Halaman) {
  const ditekan: string[] = [];
  for (const [kelas, nama] of [
    ["tambah", "tambah"],
    ["sppa", "sppa"],
    ["tb", "tidakberwenang"],
  ]) {
    const a = h.d.querySelector(`a.${kelas}`);
    if (!a) continue;
    a.addEventListener("click", () => {
      ditekan.push(nama);
      if (nama === "tambah") setTimeout(() => h.d.body.insertAdjacentHTML("beforeend", BLANGKO), 30);
    });
  }
  return ditekan;
}

// ============================================================================
describe("19: blangko Putusan Akhir dibuka lewat tombol SIPP 'Tambah Putusan Akhir'", () => {
  it("perkara belum diputus (tanpa tab Putusan Akhir): Jalankan -> Tambah Putusan Akhir ditekan -> naskah dibaca di blangko", async () => {
    const h = buka({ simpanan: UI, html: BARIS_TOMBOL });
    const ditekan = pasangSipp(h);
    const pn = await siapUi(h);
    const kotak = await sampai(() => pn.querySelector('[data-s1-fitur="putusan-tanpa-blangko"]'), "Putusan otomatis tanpa blangko");
    const naskah = new h.w.File(["{\\rtf1 naskah}"], "556_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai (Format Lengkap).rtf", { type: "application/rtf" });
    pilihBerkas(h.w, kotak.querySelector(".aleta-s1-slot-naskah input"), [naskah]);
    (kotak.querySelector("[data-s1-jalankan]") as HTMLButtonElement).click();
    const kirim = await sampai(
      () => h.minta.find((m) => m.url.includes("/putusan/unggah-naskah") && m.cara === "POST"),
      `naskah dikirim dari blangko; kabar: ${kotak.textContent}`,
      6000
    );
    // Hanya tombol blangko putusan biasa yang ditekan - bukan pengalihan
    // SPPA, bukan "Tidak Berwenang".
    expect(ditekan).toEqual(["tambah"]);
    expect(((kirim.badan as FormData).get("berkas") as File).name).toContain("556_Pdt.G_2026_PA.Dgl");
    expect(panelDari(h).querySelector('.aleta-bagian[data-kunci="isiPutusan"][data-s1-putusan="ui"]')).not.toBeNull();
    // Membuka blangko tidak menulis apa pun ke SIPP.
    expect(h.jembatan.some((x) => x.jenis === "tekan" || x.jenis === "isi")).toBe(false);
  });

  it("tanpa tombol Tambah maupun tab: sebabnya + syarat SIPP disebut, tidak ada yang ditekan", async () => {
    const h = buka({ simpanan: UI });
    const pn = await siapUi(h);
    const kotak = await sampai(() => pn.querySelector('[data-s1-fitur="putusan-tanpa-blangko"]'), "bagian");
    (kotak.querySelector("[data-s1-jalankan]") as HTMLButtonElement).click();
    await sampai(() => /Tambah Putusan Akhir" maupun tab Putusan Akhir tidak ada/.test(kotak.textContent || ""), "sebab disebut");
    expect(kotak.textContent).toMatch(/hasil sidang sudah dicatat/);
    expect(h.nilai("s1Tugas")).toBeNull();
  });

  it("tombol Tambah yang disembunyikan SIPP (.hide()) tidak ditekan", async () => {
    const h = buka({ simpanan: UI, html: BARIS_TOMBOL.replace('<td><a href="#" class="btn tambah"', '<td style="display:none"><a href="#" class="btn tambah"') });
    const ditekan = pasangSipp(h);
    const pn = await siapUi(h);
    const kotak = await sampai(() => pn.querySelector('[data-s1-fitur="putusan-tanpa-blangko"]'), "bagian");
    (kotak.querySelector("[data-s1-jalankan]") as HTMLButtonElement).click();
    await sampai(() => /tidak ada di halaman SIPP/.test(kotak.textContent || ""), "ditolak dengan sebab");
    expect(ditekan).toEqual([]);
  });

  it("putusan massal mode otomatis: blangko perkara antrean dibuka SENDIRI, lalu antrean mengerjakannya", async () => {
    const antrean = { id: "antrean-uji", tahap: "sipp", asal: "sidang", modus: "otomatis", butir: [{ nomor: NOMOR, keadaan: "menunggu", catatan: "" }] };
    const h = buka({ simpanan: { ...UI, antreanPutusanMassal: antrean }, html: BARIS_TOMBOL });
    const ditekan = pasangSipp(h);
    await siapUi(h);
    await sampai(() => ditekan.includes("tambah"), "Tambah Putusan Akhir ditekan sendiri", 6000);
    // Antrean berjalan atas blangko itu: draf dibaca untuk perkara ini, lalu
    // perkaranya tercatat (di sini: gagal - belum ada draf; tidak ada Simpan).
    await sampai(() => h.minta.some((m) => m.url.includes(`/putusan/isian-sipp?nomorPerkara=${encodeURIComponent(NOMOR)}`)), "draf dibaca antrean", 6000);
    await sampai(
      () => (h.simpanan.antreanPutusanMassal as typeof antrean).butir[0].keadaan === "gagal",
      `antrean tercatat; kini ${JSON.stringify((h.simpanan.antreanPutusanMassal as typeof antrean).butir[0])}`,
      6000
    );
    expect(ditekan.filter((x) => x === "tambah")).toHaveLength(1);
    expect(h.jembatan.some((x) => x.jenis === "tekan")).toBe(false);
  });

  it("putusan massal mode manual: tidak dibuka sendiri; tombol 'Buka blangko Putusan Akhir' membukanya", async () => {
    const antrean = { id: "antrean-uji", tahap: "sipp", asal: "sidang", modus: "manual", butir: [{ nomor: NOMOR, keadaan: "menunggu", catatan: "" }] };
    const h = buka({ simpanan: { ...UI, antreanPutusanMassal: antrean }, html: BARIS_TOMBOL });
    const ditekan = pasangSipp(h);
    const pn = await siapUi(h);
    const tombol = await sampai(() => pn.querySelector(".aleta-antrean-buka-blangko") as HTMLButtonElement | null, "tombol Buka blangko");
    await tunggu(300);
    expect(ditekan).toEqual([]);
    tombol.click();
    await sampai(() => ditekan.includes("tambah"), "Tambah ditekan atas tombol");
    // Panel kini menunjukkan tombol pengisian antrean untuk blangko yang terbuka.
    await sampai(
      () => Array.from(panelDari(h).querySelectorAll("button")).find((b: any) => /Isi putusan & simpan/.test(b.textContent || "")),
      "tombol Isi putusan & simpan",
      6000
    );
    expect(h.jembatan.some((x) => x.jenis === "tekan")).toBe(false);
  });
});

// ============================================================================
describe("22: panel tidak membeku karena nomor perkara lain di panel sendiri", () => {
  const antreanLain = { id: "antrean-lain", tahap: "sipp", asal: "sidang", modus: "manual", butir: [{ nomor: LAIN, keadaan: "menunggu", catatan: "" }] };

  it("cariNomorPerkara: nomor di panel ALETA tidak dihitung, nomor SIPP tetap", async () => {
    const h = buka({ simpanan: { ...UI, antreanPutusanMassal: antreanLain } });
    const pn = await siapUi(h);
    await sampai(() => (pn.textContent || "").includes(LAIN), "panel memuat nomor perkara lain (antrean)");
    const semuaNomor = (t: string) => t.match(/\d{1,5}\/[A-Za-z.]+\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6}/g) || [];
    expect(
      h.w.cariNomorPerkara(),
      `badan: ${JSON.stringify(semuaNomor(h.d.body.innerText || ""))}; panel: ${JSON.stringify(semuaNomor(pn.innerText || ""))}; ` +
        `aleta: ${JSON.stringify(Array.from(h.w.nomorDiElemenAleta ? h.w.nomorDiElemenAleta().entries() : []))}; panel tersambung: ${pn.isConnected}`
    ).toBe(NOMOR);
    // Nomor yang SAMA di SIPP dan di panel tetap terbaca dari SIPP.
    expect((pn.textContent || "").includes(NOMOR)).toBe(true);
    // Halaman daftar SIPP sungguhan (dua nomor DI SIPP) tetap daftar.
    h.d.getElementById("konten")!.insertAdjacentHTML("beforeend", ` <p> ${LAIN} </p>`);
    expect(h.w.cariNomorPerkara()).toBe("");
  });

  it("petugas membuka blangko sendiri selagi panel memuat nomor lain: panel berpindah ke Putusan otomatis blangko", async () => {
    const h = buka({ simpanan: { ...UI, antreanPutusanMassal: antreanLain } });
    const pn = await siapUi(h);
    await sampai(() => (pn.textContent || "").includes(LAIN), "panel memuat nomor perkara lain");
    await tunggu(700);
    h.d.body.insertAdjacentHTML("beforeend", BLANGKO);
    await sampai(
      () => panelDari(h) && panelDari(h).querySelector('.aleta-bagian[data-kunci="isiPutusan"][data-s1-putusan="ui"]'),
      "panel digambar ulang untuk blangko",
      5000
    );
  });

  it("Jalankan selagi panel memuat nomor lain: naskah tetap dibaca di blangko (tidak diam)", async () => {
    const h = buka({
      simpanan: { ...UI, antreanPutusanMassal: antreanLain },
      html: ` <ul><li><a class="tabs10" href="#tabs10">Putusan Akhir</a></li></ul><div id="tabs10"></div>`,
    });
    h.d.querySelector('a[href="#tabs10"]')!.addEventListener("click", () => {
      setTimeout(() => {
        h.d.getElementById("tabs10")!.innerHTML = `<a href="#" class="edit" onclick="popup_form('${ASAL}/SIPP/add_putusan_akhir/RU5D/update')">Edit Putusan Akhir</a>`;
        h.d.querySelector("a.edit")!.addEventListener("click", () => setTimeout(() => h.d.body.insertAdjacentHTML("beforeend", BLANGKO), 30));
      }, 30);
    });
    const pn = await siapUi(h);
    await sampai(() => (pn.textContent || "").includes(LAIN), "panel memuat nomor perkara lain");
    await tunggu(700);
    const kotak = await sampai(() => panelDari(h).querySelector('[data-s1-fitur="putusan-tanpa-blangko"]'), "bagian");
    const naskah = new h.w.File(["{\\rtf1 naskah}"], "putusan 556.rtf", { type: "application/rtf" });
    pilihBerkas(h.w, kotak.querySelector(".aleta-s1-slot-naskah input"), [naskah]);
    (kotak.querySelector("[data-s1-jalankan]") as HTMLButtonElement).click();
    await sampai(
      () => h.minta.find((m) => m.url.includes("/putusan/unggah-naskah") && m.cara === "POST"),
      `naskah dikirim; kabar lama: ${kotak.textContent}`,
      6000
    );
  });
});

// ============================================================================
describe("21: mengisi kolom blangko tidak lagi tertahan 5 detik per kolom", () => {
  const BLANGKO_ISI =
    ` <div id="popup_form"><div id="form_pop"><form id="frm_putusan">` +
    `<textarea id="perhum"></textarea><input id="tgl_putusan" name="tgl_putusan" value="05/10/2026">` +
    `<select name="status_putusan" id="status_putusan"><option value="-1">Pilih Status Putusan</option><option value="62">Dikabulkan</option></select>` +
    `<textarea id="amar"></textarea><textarea id="amar_anonim"></textarea><input type="submit" id="simpan" value="Simpan"></form></div></div>`;

  it("jembatan.js SUNGGUHAN: bacaan nilai terjawab (dahulu ruas `sumber` jawabannya menimpa amplop -> batas 5 detik tiap kolom)", async () => {
    const h = buka({ simpanan: UI, jembatanAsli: true, html: BLANGKO_ISI });
    await siapUi(h);
    const t0 = Date.now();
    const tanggal = await h.w.kirimKeJembatanLangsung({ jenis: "nilai", penunjuk: "#tgl_putusan" });
    expect(tanggal.ok, JSON.stringify(tanggal)).toBe(true);
    expect(tanggal.nilai).toBe("05/10/2026");
    expect(tanggal.sumberNilai).toBe("medan");
    const status = await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: 'select[name="status_putusan"]', jenisMedan: "pilih", nilai: "62" });
    const perhum = await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: "#perhum", jenisMedan: "kaya", nilai: "<p>Menimbang.</p>" });
    const lama = Date.now() - t0;
    expect(status.ok, JSON.stringify(status)).toBe(true);
    expect(perhum.ok, JSON.stringify(perhum)).toBe(true);
    expect((h.d.querySelector("#status_putusan") as HTMLSelectElement).value).toBe("62");
    expect((h.d.querySelector("#perhum") as HTMLTextAreaElement).value).toBe("<p>Menimbang.</p>");
    // Tiga perjalanan jembatan + dua bacaan nilai lama: milidetik, bukan 3 x 5 detik.
    expect(lama).toBeLessThan(1500);
  }, 30000);
});

describe("21: CKEditor blangko ditunggu menurut keadaannya, bukan jam", () => {
  it("konten: isian 'kaya' baru dikirim sesudah jembatan menyebut editornya siap", async () => {
    let siapPada = Infinity;
    const h = buka({
      simpanan: UI,
      jembatan: (pesan) =>
        pesan.jenis === "nilai"
          ? { ok: true, nilai: "", tampak: true, sumberNilai: "ckeditor", siap: Date.now() >= siapPada }
          : pesan.jenis === "isi"
            ? { ok: true, terbaca: String(pesan.nilai) }
            : { ok: true, tampak: false, pilihan: [], nilaiSekarang: "" },
    });
    await siapUi(h);
    siapPada = Date.now() + 250;
    const mulai = Date.now();
    const hasil = await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: "#perhum", jenisMedan: "kaya", nilai: "<p>Menimbang.</p>" });
    const isi = h.jembatan.filter((x) => x.jenis === "isi" && x.penunjuk === "#perhum");
    expect(hasil.ok).toBe(true);
    expect(isi).toHaveLength(1);
    expect(Date.now() - mulai).toBeGreaterThanOrEqual(240);
    // Menunggu menurut keadaan: segera sesudah siap, bukan jeda tetap yang panjang.
    expect(Date.now() - mulai).toBeLessThan(1500);
  });

  it("konten: editor yang tidak kunjung siap -> tidak diisi, sebabnya disebut (Simpan tertahan oleh 'gagal')", async () => {
    const h = buka({
      simpanan: UI,
      jembatan: (pesan) =>
        pesan.jenis === "nilai" ? { ok: true, nilai: "", tampak: true, sumberNilai: "ckeditor", siap: false } : { ok: true, terbaca: "" },
    });
    await siapUi(h);
    const hasil = await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: "#amar", jenisMedan: "kaya", nilai: "<p>1. Mengabulkan;</p>" });
    expect(hasil.ok).toBe(false);
    expect(String(hasil.alasan)).toMatch(/ckeditor_belum_siap/);
    expect(h.jembatan.some((x) => x.jenis === "isi")).toBe(false);
  }, 20000);

  it("jembatan.js: editor belum 'ready' tidak di-setData dan menjawab siap=false; sesudah ready diisi", () => {
    const dom = new JSDOM(`<!doctype html><html><body><form id="frm_putusan"><textarea id="perhum"></textarea></form></body></html>`, {
      url: "http://127.0.0.1/index.php/detil_perkara_agama",
      runScripts: "outside-only",
    });
    terbuka.push(dom);
    const w = dom.window as any;
    const jawaban: any[] = [];
    w.postMessage = (data: unknown) => void jawaban.push(data);
    const setData: string[] = [];
    const editor = { status: "loaded", data: "", setData(x: string) { setData.push(x); this.data = x; }, getData() { return this.data; } };
    w.CKEDITOR = { instances: { perhum: editor }, addCss() {} };
    w.eval(JEMBATAN());
    let urut = 0;
    const minta = (pesan: Record<string, unknown>) => {
      urut += 1;
      const id = `uji-${urut}`;
      w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan", id, ...pesan }, source: w }));
      return jawaban.find((x) => x.id === id);
    };
    const nilai = minta({ jenis: "nilai", penunjuk: "#perhum", jenisMedan: "kaya" });
    expect(nilai.siap).toBe(false);
    const isi = minta({ jenis: "isi", penunjuk: "#perhum", jenisMedan: "kaya", nilai: "<p>Menimbang.</p>" });
    expect(isi.ok).toBe(false);
    expect(isi.alasan).toBe("ckeditor_belum_siap");
    expect(setData).toEqual([]);
    editor.status = "ready";
    expect(minta({ jenis: "nilai", penunjuk: "#perhum", jenisMedan: "kaya" }).siap).toBe(true);
    const lagi = minta({ jenis: "isi", penunjuk: "#perhum", jenisMedan: "kaya", nilai: "<p>Menimbang.</p>" });
    expect(lagi.ok).toBe(true);
    expect(setData).toEqual(["<p>Menimbang.</p>"]);
  });
});
