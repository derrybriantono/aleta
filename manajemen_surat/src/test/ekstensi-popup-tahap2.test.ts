/**
 * Tahap 2 rencana "ekstensi dulu" (29 September 2026): popup ekstensi.
 *
 * Yang dijaga, menurut pentingnya:
 *   1. SYARAT MUTLAK - tampilan Lama (bawaan, atau "lama" tersimpan) tidak
 *      berubah sama sekali, APA PUN isi saklar fiturnya: tidak ada elemen
 *      buatan, tidak ada yang dipindah atau disembunyikan, tidak ada atribut
 *      kulit atau susunan.
 *   2. Tiap ide popup-N hanya tampil bila saklarnya menyala DAN tampilan
 *      bukan Lama.
 *   3. UI Baru memasang susunan baru dari ELEMEN YANG SAMA (id dan pendengar
 *      lama tetap bekerja), dan kembali ke Lama mengembalikan susunan asli.
 *   4. Senyap menulis senyapSampai; ekspor tidak memuat kunci terlarang;
 *      impor menolak kunci asing dan nilai yang tidak sah; popup hanya GET.
 *
 * popup.html dan popup.js dijalankan SUNGGUHAN di JSDOM, dengan
 * chrome.storage dan fetch tiruan - pola yang sama dengan
 * ekstensi-uji-tampilan.test.ts bagian popup.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const popupHtml = baca("popup.html");
const popupJs = baca("popup.js");
const daftarFiturJs = baca("daftar-fitur.js");

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Panggilan = { alamat: string; cara: string };

type Opsi = {
  peran?: string;
  /** info=siapa menjawab 401: peran tidak diketahui, jadi tidak ada UI Baru wajib (UIBARU-WAJIB 12 Okt). */
  belumMasuk?: boolean;
  simpan?: Record<string, unknown>;
  /** Jawaban tiruan untuk GET ke SIPP/ABT; lempar untuk "tidak terjangkau". */
  situs?: (alamat: string) => { ok: boolean; status: number; url?: string } | "lempar";
  tabUrl?: string | null;
};

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaPopup(opsi: Opsi = {}) {
  const html = popupHtml.replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { asalPortal: "http://192.168.10.10/aleta", ...(opsi.simpan || {}) };
  const salin = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const panggilan: Panggilan[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.172.0", host_permissions: ["http://192.168.10.10/*", "http://127.0.0.1/*"] }),
      sendMessage: async () => ({}),
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const x of daftar) if (x in simpanan) hasil[x] = salin(simpanan[x]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, salin(isi)),
        remove: async (kunci: string | string[]) => {
          for (const k of [kunci].flat()) delete simpanan[k];
        },
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener() {} },
    },
  };
  if (opsi.tabUrl !== undefined) {
    w.chrome.tabs = { query: async () => [opsi.tabUrl === null ? { id: 1 } : { id: 1, url: opsi.tabUrl }] };
  }
  w.fetch = async (alamat: string, init?: { method?: string }) => {
    const a = String(alamat);
    panggilan.push({ alamat: a, cara: String((init && init.method) || "GET").toUpperCase() });
    if (a.includes("info=siapa") && opsi.belumMasuk) return { ok: false, status: 401, json: async () => ({}) };
    if (a.includes("info=siapa")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran: opsi.peran || "Super Admin" }, versi: "1.172.0" } }),
      };
    }
    const jawab = opsi.situs ? opsi.situs(a) : { ok: true, status: 200, url: a };
    if (jawab === "lempar") throw new w.TypeError("Failed to fetch");
    return { ...jawab, url: jawab.url || a, json: async () => ({}) };
  };
  const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
  vm.runInContext(daftarFiturJs, ctx, { filename: "daftar-fitur.js" });
  vm.runInContext(popupJs, ctx, { filename: "popup.js" });
  return { w, d: w.document as Document, simpanan, panggilan };
}

async function sampai(syarat: () => boolean, apa: string) {
  const mulai = Date.now();
  while (!syarat()) {
    if (Date.now() - mulai > 2000) throw new Error(`tidak kunjung: ${apa}`);
    await tunggu(10);
  }
}

/** Tunggu sampai popup selesai membaca penyimpanan dan portal, lalu susunannya. */
async function tenang(p: ReturnType<typeof bukaPopup>) {
  await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
  await tunggu(40);
}

/**
 * Sidik susunan: tag, id, hidden, dan nama atribut (selain class) tiap
 * elemen, menurut urutan dokumen. Kelas sengaja tidak ikut pada pembandingan
 * dengan markup mentah: kode lama sendiri membalik kelas "kosong" pada kolom
 * keadaan begitu nama akun terbaca.
 */
function sidik(d: Document, denganKelas = false) {
  const akar = d.documentElement;
  const atribut = Array.from(akar.attributes)
    .map((a) => a.name)
    .filter((n) => n !== "data-tema")
    .sort()
    .join(",");
  const badan = Array.from(d.body.querySelectorAll("*")).map((e) => {
    const nama = Array.from(e.attributes)
      .map((a) => a.name)
      // data-terpasang: penanda pendengar yang ditulis kode LAMA (pengalih uji).
      .filter((n) => !["class", "style", "href", "aria-pressed", "disabled", "data-terpasang"].includes(n))
      .sort()
      .join(",");
    return `${e.tagName}#${e.id}${(e as HTMLElement).hidden ? "[hidden]" : ""}{${nama}}${denganKelas ? `.${e.className}` : ""}`;
  });
  return `${atribut}\n${badan.join("\n")}`;
}

function sidikMentah() {
  const dom = new JSDOM(popupHtml.replace(/<script[\s\S]*?<\/script>/g, ""));
  terbuka.push(dom);
  return sidik(dom.window.document);
}

const SEMUA_POPUP: Record<string, true> = {};
for (let i = 1; i <= 30; i += 1) SEMUA_POPUP[`popup-${i}`] = true;

// ============================================================================
describe("tampilan Lama: popup persis seperti sebelum Tahap 2", () => {
  for (const [judul, simpan] of [
    ["tanpa kunci uji sama sekali", {}],
    ["Lama tersimpan, SEMUA saklar popup menyala", { ujiTampilan: "lama", ujiFitur: SEMUA_POPUP }],
    ["nilai tampilan tak dikenal (diperlakukan Lama)", { ujiTampilan: "entah", ujiFitur: SEMUA_POPUP }],
  ] as const) {
    it(judul, async () => {
      // UIBARU-WAJIB 12 Okt: peran dikenal selain Super Admin selalu UI Baru; Lama utuh bagi yang belum dikenal.
      const p = bukaPopup({ belumMasuk: true, simpan });
      await tenang(p);
      expect(sidik(p.d)).toBe(sidikMentah());
      expect(p.d.documentElement.hasAttribute("data-kulit")).toBe(false);
      expect(p.d.documentElement.hasAttribute("data-susunan")).toBe(false);
      expect(p.d.querySelectorAll('[class^="tb-"], [class*=" tb-"]').length).toBe(0);
      // Tidak ada GET tambahan ke SIPP/ABT: lampu sambungan tidak berjalan.
      expect(p.panggilan.every((x) => x.alamat.includes("info=siapa"))).toBe(true);
      // Tidak ada kunci baru yang ditulis.
      expect("tandaBaruDilihat" in p.simpanan).toBe(false);
      expect("senyapSampai" in p.simpanan).toBe(false);
    });
  }

  it("Baru tanpa satu pun saklar popup menyala: juga tidak ada elemen buatan", async () => {
    const p = bukaPopup({ belumMasuk: true, simpan: { ujiTampilan: "baru", ujiFitur: { "sipp-5": true } } });
    await tenang(p);
    expect(p.d.querySelectorAll('[class^="tb-"], [class*=" tb-"]').length).toBe(0);
    expect(p.d.getElementById("fiturCoba")).toBeNull();
    expect(p.d.documentElement.hasAttribute("data-kulit")).toBe(false);
  });
});

// ============================================================================
describe("tiap ide popup-N hanya tampil bila saklarnya menyala dan tampilan bukan Lama", () => {
  const PENANDA: Array<[string, string, Record<string, true>?]> = [
    ["popup-1", ".tb-ringkas"],
    ["popup-2", "#tbLampu"],
    ["popup-3", ".tb-lompat"],
    ["popup-4", "#skalaGeser"],
    ["popup-5", ".tb-contoh-tema"],
    ["popup-10", "#tbVersi"],
    ["popup-11", "#tbProfil"],
    ["popup-12", "#tbSenyap"],
    ["popup-13", ".tb-posisi-pilih"],
    ["popup-14", "#tbEksporImpor"],
    ["popup-15", "#tbCariSaklar"],
    ["popup-16", "#tbPintasan"],
    ["popup-27", "#tbBatasSitus"],
    // Tanda BARU butuh sesuatu untuk ditandai.
    ["popup-26", ".tb-baru", { "popup-12": true }],
  ];

  for (const [kode, pemilih, pendamping] of PENANDA) {
    it(`${kode} (${pemilih})`, async () => {
      const nyala = { [kode]: true as const, ...(pendamping || {}) };
      const tanpa = { ...(pendamping || {}) };
      for (const mode of ["baru", "ui"]) {
        // popup-1 dan popup-3 dalam UI Baru: ringkasan dan kelompok adalah
        // D1/D2, selalu ada; yang bergerbang hanya tombol lompat (popup-3).
        const p = bukaPopup({ simpan: { ujiTampilan: mode, ujiFitur: nyala }, tabUrl: null });
        await tenang(p);
        await sampai(() => p.d.querySelector(pemilih) !== null, `${kode} tampil dalam ${mode}`);
        if (kode === "popup-1" && mode === "ui") continue;
        const q = bukaPopup({ simpan: { ujiTampilan: mode, ujiFitur: tanpa }, tabUrl: null });
        await tenang(q);
        expect(q.d.querySelector(pemilih), `${kode} tanpa saklar dalam ${mode}`).toBeNull();
      }
      const l = bukaPopup({ simpan: { ujiTampilan: "lama", ujiFitur: nyala } });
      await tenang(l);
      expect(l.d.querySelector(pemilih), `${kode} dalam Lama`).toBeNull();
    });
  }
});

// ============================================================================
describe("UI Baru: susunan baru dari elemen yang sama", () => {
  it("memasang kepala bersaklar induk, kartu status, kelompok, Lainnya, dan pintasan kaki", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "ui" } });
    await tenang(p);
    await sampai(() => p.d.getElementById("uiStatus") !== null, "kartu status");
    const d = p.d;
    expect(d.documentElement.getAttribute("data-kulit")).toBe("modern");
    expect(d.documentElement.getAttribute("data-susunan")).toBe("ui");
    // D4: saklar induk yang SAMA, kini di kepala.
    const aktif = d.getElementById("aktif") as HTMLInputElement;
    expect(aktif.closest(".kepala")).not.toBeNull();
    expect(d.querySelectorAll("#aktif").length).toBe(1);
    // D12: × hanya menutup; Matikan ALETA di sini.
    expect(d.getElementById("uiSaklarInduk")!.title).toMatch(/× di kepala panel hanya menutup/);
    expect(d.getElementById("uiInfo")!.textContent).toMatch(/hanya MENUTUP/);
    // D3: status ringkas; kotak keadaan lama pindah ke Rincian, utuh.
    expect(d.getElementById("uiStatus")!.textContent).toMatch(/Semua tersambung/);
    expect(d.querySelector("#uiStatus details .keadaan #versiEkstensi")).not.toBeNull();
    // D1: kelompok berjudul memuat saklar aslinya.
    expect(d.getElementById("tandaiHalaman")!.closest("#kelompok-sipp")).not.toBeNull();
    expect(d.getElementById("sisipJadwal")!.closest("#kelompok-sipp")).not.toBeNull();
    expect(d.getElementById("cetakTigaBerkas")!.closest("#kelompok-abt")).not.toBeNull();
    expect(d.getElementById("suntingLangsungAbt")!.closest("#kelompok-abt")).not.toBeNull();
    expect(d.getElementById("checklistMilestone")!.closest("#kelompok-portal")).not.toBeNull();
    expect(d.getElementById("skalaNilai")!.closest("#kelompok-tampilan")).not.toBeNull();
    // D2: keterangan satu baris; uraian lengkap tetap ada, terlipat.
    const labelTandai = d.getElementById("tandaiHalaman")!.closest("label")!;
    const panjang = labelTandai.querySelector(":scope > span > .saklar-ket:not(.tb-ringkas)") as HTMLElement;
    expect(panjang.hidden).toBe(true);
    (labelTandai.querySelector(".tb-info") as HTMLButtonElement).click();
    expect(panjang.hidden).toBe(false);
    expect((d.getElementById("tandaiHalaman") as HTMLInputElement).checked).toBe(true);
    // D5: tombol skala yang sama, bertulisan A− A A+.
    expect(d.getElementById("skalaKurang")!.textContent).toBe("A−");
    expect(d.getElementById("skalaTambah")!.textContent).toBe("A+");
    // D13: tema tiga pilihan. D14: pintasan kaki. Pembaruan di Lainnya.
    expect(d.querySelectorAll("#tbTema [data-tema-pilih]").length).toBe(3);
    expect(d.getElementById("uiPintasan")!.textContent).toMatch(/Portal ↗.*SIPP ↗.*ABT ↗/);
    expect(d.getElementById("perbaruiSekarang")!.closest("#uiLainnya")).not.toBeNull();
    // Kaki lama (tautan portal) tetap ada.
    expect(d.getElementById("tautanPortal")).not.toBeNull();
  });

  it("pendengar lama tetap bekerja: saklar induk di kepala menyimpan 'aktif'", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "ui" } });
    await tenang(p);
    await sampai(() => p.d.getElementById("uiSaklarInduk") !== null, "saklar induk");
    const aktif = p.d.getElementById("aktif") as HTMLInputElement;
    aktif.checked = false;
    aktif.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    await sampai(() => p.simpanan.aktif === false, "aktif tersimpan");
    expect(p.d.getElementById("uiSaklarInduk")!.textContent).toMatch(/Mati/);
  });

  it("tema segmen menulis temaPopup dan temaPanel seperti tombol lama", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "ui" } });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbTema") !== null, "tema");
    (p.d.querySelector('[data-tema-pilih="terang"]') as HTMLButtonElement).click();
    await sampai(() => p.simpanan.temaPanel === "terang", "tema panel");
    expect(p.simpanan.temaPopup).toBe("terang");
    expect(p.d.documentElement.getAttribute("data-tema")).toBe("terang");
  });

  it("pengalih ke UI Baru lalu kembali ke Lama mengembalikan susunan asli sepenuhnya", async () => {
    const p = bukaPopup({ simpan: { ujiFitur: SEMUA_POPUP } });
    await tenang(p);
    await sampai(() => !(p.d.getElementById("bagianUji") as HTMLElement).hidden, "pengalih tampil");
    const sebelum = sidik(p.d, true);
    (p.d.getElementById("ujiUi") as HTMLButtonElement).click();
    await sampai(() => p.d.getElementById("uiStatus") !== null, "UI Baru tersusun");
    expect(p.d.getElementById("tbLampu")).not.toBeNull();
    (p.d.getElementById("ujiBaru") as HTMLButtonElement).click();
    await sampai(() => p.d.getElementById("fiturCoba") !== null && !p.d.getElementById("uiStatus"), "Baru tersusun");
    (p.d.getElementById("ujiLama") as HTMLButtonElement).click();
    await sampai(() => p.d.getElementById("fiturCoba") === null, "susunan dipulihkan");
    await tunggu(40);
    expect(sidik(p.d, true)).toBe(sebelum);
    expect(p.d.getElementById("skalaKurang")!.textContent).toBe("−");
    expect(p.d.getElementById("aktif")!.closest("label.saklar")).not.toBeNull();
  });
});

// ============================================================================
describe("popup-12 senyap 1 jam", () => {
  it("menulis senyapSampai satu jam ke depan, dan Akhiri senyap menulis 0", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "baru", ujiFitur: { "popup-12": true } } });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbSenyap") !== null, "tombol senyap");
    const awal = Date.now();
    (p.d.getElementById("tbSenyap") as HTMLButtonElement).click();
    await sampai(() => typeof p.simpanan.senyapSampai === "number", "tersimpan");
    const sampaiMs = p.simpanan.senyapSampai as number;
    expect(sampaiMs).toBeGreaterThanOrEqual(awal + 3600000);
    expect(sampaiMs).toBeLessThan(awal + 3600000 + 5000);
    expect((p.d.getElementById("tbSenyap") as HTMLElement).hidden).toBe(true);
    expect(p.d.querySelector(".tb-pita")!.textContent).toMatch(/Disenyapkan sampai/);
    (p.d.getElementById("tbAkhiriSenyap") as HTMLButtonElement).click();
    await sampai(() => p.simpanan.senyapSampai === 0, "diakhiri");
  });
});

// ============================================================================
describe("popup-14 ekspor dan impor pengaturan", () => {
  const TERLARANG = {
    asalPortal: "http://192.168.10.10/aleta",
    akunSipp: "derry",
    posisiPanel: { kiri: 1 },
    posisiChecklistSipp: { kiri: 2 },
    ujiTampilan: "baru",
    ujiFitur: { "popup-14": true },
    ujiIzinkanNyata: true,
    senyapSampai: 123,
    tokenRelaas: { token: "rahasia" },
    petaBlangkoPutusan: { x: "y" },
    tandaBaruDilihat: { "popup-14": true },
  };

  it("berkas ekspor hanya memuat setelan; tidak ada akun, sesi, posisi, uji, atau data perkara", async () => {
    const p = bukaPopup({
      simpan: {
        ...TERLARANG,
        aktif: true,
        tandaiHalaman: false,
        cetakTigaBerkas: true,
        skalaHuruf: 120,
        temaPopup: "terang",
        temaPanel: "terang",
      },
    });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbEkspor") !== null, "tombol ekspor");
    let isiBerkas = "";
    p.w.Blob = class {
      constructor(bagian: string[]) {
        isiBerkas = bagian.join("");
      }
    };
    p.w.URL.createObjectURL = () => "blob:uji";
    p.w.URL.revokeObjectURL = () => undefined;
    p.w.HTMLAnchorElement.prototype.click = function () {};
    (p.d.getElementById("tbEkspor") as HTMLButtonElement).click();
    await sampai(() => isiBerkas !== "", "berkas tersusun");
    const isi = JSON.parse(isiBerkas);
    expect(isi.jenis).toBe("aleta-pengaturan-ekstensi");
    expect(isi.pengaturan).toEqual({
      aktif: true,
      tandaiHalaman: false,
      cetakTigaBerkas: true,
      skalaHuruf: 120,
      temaPopup: "terang",
      temaPanel: "terang",
    });
    for (const k of Object.keys(TERLARANG)) expect(isiBerkas, k).not.toContain(`"${k}"`);
    expect(isiBerkas).not.toContain("rahasia");
  });

  it("impor menolak kunci asing dan nilai tidak sah; yang sah diterapkan ke saklarnya", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "baru", ujiFitur: { "popup-14": true }, sisipJadwal: false } });
    await tenang(p);
    const berkas = {
      jenis: "aleta-pengaturan-ekstensi",
      pengaturan: {
        sisipJadwal: true,
        skalaHuruf: 130,
        cetakTigaBerkas: "ya", // tidak sah: bukan benar/salah
        skalaHuruf2: 90,
        asalPortal: "http://jahat.contoh/aleta",
        tokenRelaas: { token: "x" },
        ujiIzinkanNyata: true,
      },
    };
    const kabar: string = await p.w.terimaImporPengaturan(JSON.stringify(berkas));
    expect(p.simpanan.sisipJadwal).toBe(true);
    expect(p.simpanan.skalaHuruf).toBe(130);
    expect("cetakTigaBerkas" in p.simpanan).toBe(false);
    expect(p.simpanan.asalPortal).toBe("http://192.168.10.10/aleta");
    expect("tokenRelaas" in p.simpanan).toBe(false);
    expect("ujiIzinkanNyata" in p.simpanan).toBe(false);
    expect("skalaHuruf2" in p.simpanan).toBe(false);
    expect(kabar).toMatch(/Diimpor: 2 setelan/);
    expect(kabar).toMatch(/asalPortal: tidak dikenal/);
    expect(kabar).toMatch(/cetakTigaBerkas: nilainya tidak sah/);
    // Diterapkan lewat jalan yang sama dengan saat popup dibuka.
    expect((p.d.getElementById("sisipJadwal") as HTMLInputElement).checked).toBe(true);
    expect(p.d.getElementById("skalaNilai")!.textContent).toBe("130%");
  });

  it("berkas yang bukan ekspor ALETA ditolak utuh", async () => {
    const p = bukaPopup({});
    await tenang(p);
    const sebelum = JSON.stringify(p.simpanan);
    expect(await p.w.terimaImporPengaturan(JSON.stringify({ pengaturan: { aktif: false } }))).toMatch(/Tidak ada yang diimpor/);
    expect(await p.w.terimaImporPengaturan("bukan json")).toMatch(/bukan JSON/);
    expect(JSON.stringify(p.simpanan)).toBe(sebelum);
  });
});

// ============================================================================
describe("popup-11 profil saklar", () => {
  it("menyetel lewat kotak centang aslinya, tidak menyentuh saklar induk, dan menjadi Kustom bila diubah", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "ui", ujiFitur: { "popup-11": true }, aktif: false } });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbProfil") !== null, "profil");
    (p.d.querySelector('[data-profil="pp"]') as HTMLButtonElement).click();
    await sampai(() => p.simpanan.cetakTigaBerkas === true, "profil PP tersimpan");
    // Yang berubah ditulis pendengar lamanya; yang sudah sama tidak disentuh.
    expect(p.simpanan).toMatchObject({ sisipJadwal: true, cetakTigaBerkas: true, checklistMilestone: true });
    const centang = (id: string) => (p.d.getElementById(id) as HTMLInputElement).checked;
    expect(centang("tandaiHalaman")).toBe(true);
    expect(centang("suntingLangsungAbt")).toBe(false);
    expect(p.simpanan.aktif).toBe(false);
    expect(centang("aktif")).toBe(false);
    expect(p.simpanan.suntingLangsungAbt).toBeUndefined();
    expect(p.d.querySelector('[data-profil="pp"]')!.getAttribute("aria-pressed")).toBe("true");
    const cetak = p.d.getElementById("cetakTigaBerkas") as HTMLInputElement;
    cetak.checked = false;
    cetak.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    // Tanpa cetak, PP menjadi Hakim - profil yang cocok ditandai.
    expect(p.d.querySelector('[data-profil="hakim"]')!.getAttribute("aria-pressed")).toBe("true");
    const tandai = p.d.getElementById("tandaiHalaman") as HTMLInputElement;
    tandai.checked = false;
    tandai.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    expect(p.d.querySelector('[data-profil="kustom"]')!.getAttribute("aria-pressed")).toBe("true");
  });
});

// ============================================================================
describe("popup-2 lampu sambungan", () => {
  it("hanya GET; situs yang tidak terjangkau merah dengan Perbaiki ke halamannya", async () => {
    const p = bukaPopup({
      simpan: { ujiTampilan: "baru", ujiFitur: { "popup-2": true }, akunSipp: "derry" },
      situs: (a) => (a.includes("/aps_badilag/") ? "lempar" : { ok: true, status: 200 }),
    });
    await tenang(p);
    await sampai(() => p.d.querySelector('#tbLampu [data-situs="abt"][data-keadaan="putus"]') !== null, "ABT merah");
    const sipp = p.d.querySelector('#tbLampu [data-situs="sipp"]') as HTMLElement;
    expect(sipp.dataset.keadaan).toBe("ok");
    expect(sipp.textContent).toMatch(/derry/);
    const perbaiki = p.d.querySelector('#tbLampu [data-situs="abt"] .tb-perbaiki') as HTMLAnchorElement;
    expect(perbaiki.href).toBe("http://192.168.10.10/aps_badilag/abt");
    expect(p.d.querySelector('#tbLampu [data-situs="server"]')!.getAttribute("data-keadaan")).toBe("ok");
    expect(p.d.querySelector('#tbLampu [data-situs="portal"]')!.getAttribute("data-keadaan")).toBe("ok");
    expect(p.panggilan.length).toBeGreaterThan(2);
    expect(p.panggilan.every((x) => x.cara === "GET")).toBe(true);
    expect(p.panggilan.some((x) => x.alamat === "http://192.168.10.10/SIPP/")).toBe(true);
  });

  it("SIPP yang berujung di halaman masuk: kuning 'belum masuk', bukan hijau", async () => {
    const p = bukaPopup({
      simpan: { ujiTampilan: "baru", ujiFitur: { "popup-2": true } },
      situs: (a) => (a.includes("/SIPP/") ? { ok: true, status: 200, url: "http://192.168.10.10/SIPP/login" } : { ok: true, status: 200 }),
    });
    await tenang(p);
    await sampai(() => p.d.querySelector('#tbLampu [data-situs="sipp"][data-keadaan="awas"]') !== null, "SIPP kuning");
  });
});

// ============================================================================
describe("popup-13 kembalikan posisi, dengan pilihan", () => {
  const POSISI = {
    posisiPanel: { kiri: 1 },
    posisiPanelAbt: { kiri: 1 },
    posisiPanelAbtMassal: { kiri: 1 },
    posisiPanelAleta: { kiri: 1 },
    posisiChecklistSipp: { kiri: 1 },
    posisiChecklistAbt: { kiri: 1 },
    posisiChecklistAleta: { kiri: 1 },
  };

  it("widget dilepas: hanya kunci panel yang dihapus", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "baru", ujiFitur: { "popup-13": true }, ...POSISI } });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbPosisi-widget") !== null, "pilihan");
    (p.d.getElementById("tbPosisi-widget") as HTMLInputElement).checked = false;
    (p.d.getElementById("resetPosisi") as HTMLButtonElement).click();
    await sampai(() => !("posisiPanel" in p.simpanan), "panel dikembalikan");
    for (const k of ["posisiPanelAbt", "posisiPanelAbtMassal", "posisiPanelAleta"]) expect(k in p.simpanan, k).toBe(false);
    for (const k of ["posisiChecklistSipp", "posisiChecklistAbt", "posisiChecklistAleta"]) expect(k in p.simpanan, k).toBe(true);
    expect(p.d.getElementById("kabarReset")!.textContent).toMatch(/Widget checklist dibiarkan/);
  });

  it("keduanya tercentang (bawaan): jalan lama utuh, ketujuh kunci terhapus", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "baru", ujiFitur: { "popup-13": true }, ...POSISI } });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbPosisi-widget") !== null, "pilihan");
    (p.d.getElementById("resetPosisi") as HTMLButtonElement).click();
    await sampai(() => Object.keys(POSISI).every((k) => !(k in p.simpanan)), "semua dikembalikan");
    expect(p.d.getElementById("kabarReset")!.textContent).toMatch(/widget checklist kembali ke kiri bawah/);
  });
});

// ============================================================================
describe("popup-15, popup-27, popup-26", () => {
  it("cari 'cetak' hanya menyisakan saklar CETAK", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "ui", ujiFitur: { "popup-15": true } } });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbCariSaklar") !== null, "kotak cari");
    const cari = p.d.getElementById("tbCariSaklar") as HTMLInputElement;
    cari.value = "cetak";
    cari.dispatchEvent(new p.w.Event("input"));
    const tampak = (id: string) => !p.d.getElementById(id)!.closest("label")!.hasAttribute("data-cari-sembunyi");
    expect(tampak("cetakTigaBerkas")).toBe(true);
    expect(tampak("tandaiHalaman")).toBe(false);
    // Uraian lengkap ikut dicari: "Sisipkan berkas" cocok lewat "tercetak",
    // jadi kelompok SIPP tetap tampil; kelompok Portal tidak punya yang cocok.
    expect(tampak("sisipJadwal")).toBe(true);
    expect(p.d.getElementById("kelompok-portal")!.hasAttribute("data-cari-sembunyi")).toBe(true);
    cari.value = "";
    cari.dispatchEvent(new p.w.Event("input"));
    expect(tampak("tandaiHalaman")).toBe(true);
  });

  it("Periksa tab: url kosong (di luar izin host) berarti situs lain", async () => {
    const p = bukaPopup({ simpan: { ujiTampilan: "baru", ujiFitur: { "popup-27": true } }, tabUrl: null });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbBatasSitus") !== null, "batas situs");
    expect(p.d.getElementById("tbBatasSitus")!.textContent).toMatch(/192\.168\.10\.10/);
    (p.d.querySelector("#tbBatasSitus button") as HTMLButtonElement).click();
    await sampai(() => /situs lain/.test(p.d.querySelector(".tb-batas-hasil")!.textContent || ""), "hasil");
  });

  it("Periksa tab: halaman ABT satker disebut aktif", async () => {
    const p = bukaPopup({
      simpan: { ujiTampilan: "baru", ujiFitur: { "popup-27": true } },
      tabUrl: "http://192.168.10.10/aps_badilag/abt/main",
    });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbBatasSitus") !== null, "batas situs");
    (p.d.querySelector("#tbBatasSitus button") as HTMLButtonElement).click();
    await sampai(() => /ABT di 192\.168\.10\.10 ✓/.test(p.d.querySelector(".tb-batas-hasil")!.textContent || ""), "hasil");
  });

  it("tanda BARU tampil sekali, lalu hilang pada pembukaan berikutnya", async () => {
    const fitur = { "popup-26": true, "popup-12": true } as const;
    const p = bukaPopup({ simpan: { ujiTampilan: "baru", ujiFitur: fitur } });
    await tenang(p);
    await sampai(() => p.d.querySelector("#tbSenyap .tb-baru") !== null, "BARU tampil");
    await sampai(() => (p.simpanan.tandaBaruDilihat as Record<string, boolean> | undefined)?.["popup-12"] === true, "dicatat");
    const q = bukaPopup({ simpan: { ujiTampilan: "baru", ujiFitur: fitur, tandaBaruDilihat: p.simpanan.tandaBaruDilihat } });
    await tenang(q);
    await sampai(() => q.d.getElementById("tbSenyap") !== null, "senyap");
    expect(q.d.querySelector(".tb-baru")).toBeNull();
  });
});
