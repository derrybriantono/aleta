/**
 * Widget (popup) ekstensi per akun dan peran - 12 Okt 2026 (Agen B).
 *
 * Keluhan pengguna yang dijaga di sini:
 *   2. isi widget dicampur seluruh peran; pengaturan harus tersimpan PER AKUN + PERAN;
 *   3. profil saklar (Hakim / PP / Juru Sita / Kustom) tidak mengubah apa pun;
 *   4. kartu "Semua tersambung" terlalu makan tempat dan menyebut tersambung walau
 *      SIPP/ABT menjawab 404;
 *   5. keterangan teknis hanya untuk Super Admin;
 *   6. pemberitahuan versi baru + "Perbaharui" + unduhan otomatis sesudah masuk;
 *  13. selain Super Admin popup SELALU UI Baru dan tanpa pengalih.
 *
 * popup.html + popup.js dan latar.js dijalankan SUNGGUHAN (jsdom / vm) dengan
 * chrome.storage (yang menyiarkan onChanged) dan fetch tiruan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { golonganPopup } from "@/lib/golongan-popup";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const popupHtml = baca("popup.html");
const popupJs = baca("popup.js");
const latarJs = baca("latar.js");
const sumberAlat = baca("panel-alat.js");
const aletaJs = baca("aleta.js");
const daftarFiturJs = baca("daftar-fitur.js");

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sampai(syarat: () => boolean, apa: string, batas = 3000) {
  const mulai = Date.now();
  while (!syarat()) {
    if (Date.now() - mulai > batas) throw new Error(`tidak kunjung: ${apa}`);
    await tunggu(10);
  }
}

// ── Peran uji: nama, golongan, kunci akun ────────────────────────────────────
type Orang = { nama: string; peran: string; kode: string; semua?: string[]; kunci: string };
const ORANG: Record<"admin" | "adminBiasa" | "hakim" | "pp" | "js" | "kasir" | "ptsp" | "panitera", Orang> = {
  admin: { nama: "Uji Admin", peran: "Super Admin", kode: "super-admin", kunci: "kk-admin" },
  adminBiasa: { nama: "Uji Admin Biasa", peran: "Admin", kode: "admin", kunci: "kk-adm2" },
  hakim: { nama: "Uji Hakim", peran: "Hakim", kode: "hakim", kunci: "kk-hakim" },
  pp: { nama: "Uji PP", peran: "Panitera Pengganti", kode: "panitera-pengganti", kunci: "kk-pp" },
  js: { nama: "Uji JS", peran: "Jurusita", kode: "juru-sita", kunci: "kk-js" },
  kasir: { nama: "Uji Kasir", peran: "Analis Keuangan", kode: "kasir", kunci: "kk-kasir" },
  ptsp: { nama: "Uji PTSP", peran: "Staf Pelaksana", kode: "ptsp", kunci: "kk-ptsp" },
  panitera: { nama: "Uji Panitera", peran: "Panitera", kode: "panitera", kunci: "kk-pan" },
};

type Opsi = {
  orang?: Orang | null; // null = belum masuk (401)
  simpanan?: Record<string, unknown>; // penyimpanan bersama antar-pembukaan
  versiPortal?: string;
  versiTerpasang?: string;
  situs?: (alamat: string) => { ok: boolean; status: number } | "lempar";
  kirim?: Array<Record<string, unknown>>;
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
  const simpanan: Record<string, unknown> = opsi.simpanan ?? {};
  if (!("asalPortal" in simpanan)) simpanan.asalPortal = "http://192.168.10.10/aleta";
  const salin = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const pendengar: Array<(u: Record<string, { newValue?: unknown }>, t: string) => void> = [];
  const kirim = opsi.kirim ?? [];
  const metode: string[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: opsi.versiTerpasang ?? "1.194.0", host_permissions: ["http://192.168.10.10/*", "http://127.0.0.1/*"] }),
      sendMessage: async (p: Record<string, unknown>) => {
        kirim.push(p);
        return { ok: true };
      },
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const x of daftar) if (x in simpanan) hasil[x] = salin(simpanan[x]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          const ubah: Record<string, { newValue?: unknown }> = {};
          for (const [k, v] of Object.entries(salin(isi) as Record<string, unknown>)) {
            simpanan[k] = v;
            ubah[k] = { newValue: v };
          }
          for (const f of pendengar.slice()) f(ubah, "local");
        },
        remove: async (kunci: string | string[]) => {
          const ubah: Record<string, { newValue?: unknown }> = {};
          for (const k of [kunci].flat()) {
            delete simpanan[k];
            ubah[k] = {};
          }
          for (const f of pendengar.slice()) f(ubah, "local");
        },
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Record<string, { newValue?: unknown }>, t: string) => void) => void pendengar.push(f) },
    },
  };
  w.fetch = async (alamat: string, init?: { method?: string }) => {
    const a = String(alamat);
    metode.push(String((init && init.method) || "GET").toUpperCase());
    if (a.includes("info=siapa")) {
      if (opsi.orang === null) return { ok: false, status: 401, json: async () => ({}) };
      const o = opsi.orang ?? ORANG.admin;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            pengguna: { nama: o.nama, peran: o.peran, kunci: o.kunci, golongan: { kode: o.kode, semua: o.semua ?? [o.kode] } },
            versi: opsi.versiPortal ?? "1.194.0",
          },
        }),
      };
    }
    if (a.includes("/ekstensi/setelan")) return { ok: true, status: 200, json: async () => ({ ok: true, data: {} }) };
    const j = opsi.situs ? opsi.situs(a) : { ok: true, status: 200 };
    if (j === "lempar") throw new w.TypeError("Failed to fetch");
    return { ...j, url: a, json: async () => ({}) };
  };
  const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
  vm.runInContext(daftarFiturJs, ctx, { filename: "daftar-fitur.js" });
  vm.runInContext(popupJs, ctx, { filename: "popup.js" });
  return { w, d: w.document as Document, simpanan, kirim, metode };
}
type Popup = ReturnType<typeof bukaPopup>;

async function tenang(p: Popup) {
  await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
  await tunggu(80);
}

const SAKLAR = ["tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone"];
const tampak = (p: Popup, id: string) => {
  const k = p.d.getElementById(id);
  if (!k) return false;
  const label = k.closest("label");
  return !!label && !label.hasAttribute("data-peran-sembunyi") && !(label.closest("[data-peran-sembunyi]") as Element | null);
};
const saklarTampak = (p: Popup) => SAKLAR.filter((id) => tampak(p, id));
const nilaiSaklar = (p: Popup) => SAKLAR.map((id) => ((p.d.getElementById(id) as HTMLInputElement).checked ? "1" : "0")).join("");
const UI_FITUR = { ujiTampilan: "ui", ujiFitur: { "popup-11": true, "popup-27": true, "popup-2": true } };

// ============================================================================
describe("butir 2 - isi popup hanya yang relevan bagi peran", () => {
  const harapan: Record<string, string[]> = {
    admin: SAKLAR,
    adminBiasa: SAKLAR,
    hakim: SAKLAR,
    pp: SAKLAR,
    js: ["tandaiHalaman", "checklistMilestone"],
    kasir: ["checklistMilestone"],
    ptsp: ["tandaiHalaman", "checklistMilestone"],
    panitera: ["tandaiHalaman", "sisipJadwal", "checklistMilestone"],
  };
  for (const [kunci, saklar] of Object.entries(harapan)) {
    it(`${kunci}: saklar yang tampak = ${saklar.join(", ")}`, async () => {
      const p = bukaPopup({ orang: (ORANG as Record<string, Orang>)[kunci] });
      await tenang(p);
      expect(saklarTampak(p)).toEqual(saklar);
    });
  }

  it("isinya BERBEDA antar peran (bukan satu susunan campuran)", async () => {
    const ciri = new Set<string>();
    for (const o of [ORANG.hakim, ORANG.js, ORANG.kasir, ORANG.panitera]) {
      const p = bukaPopup({ orang: o });
      await tenang(p);
      ciri.add(saklarTampak(p).join(","));
    }
    expect(ciri.size).toBe(4);
  });

  it("panel saat halaman dibuka: Kasir tidak melihat panel ABT; Hakim melihat ketiganya? (aleta hanya bila relevan)", async () => {
    const kasir = bukaPopup({ orang: ORANG.kasir });
    await tenang(kasir);
    expect(tampak(kasir, "bawaanPanel-abt")).toBe(false);
    expect(tampak(kasir, "bawaanPanel-sipp")).toBe(true);
    const hakim = bukaPopup({ orang: ORANG.hakim });
    await tenang(hakim);
    expect(tampak(hakim, "bawaanPanel-abt")).toBe(true);
    expect(tampak(hakim, "bawaanPanel-aleta")).toBe(false);
    const admin = bukaPopup({ orang: ORANG.admin, simpanan: { ...UI_FITUR } });
    await tenang(admin);
    expect(tampak(admin, "bawaanPanel-aleta")).toBe(true);
  });

  it("yang disembunyikan tidak dihapus: nilainya tetap tersimpan", async () => {
    const p = bukaPopup({ orang: ORANG.kasir, simpanan: { cetakTigaBerkas: true } });
    await tenang(p);
    expect(tampak(p, "cetakTigaBerkas")).toBe(false);
    expect((p.d.getElementById("cetakTigaBerkas") as HTMLInputElement).checked).toBe(true);
  });
});

// ============================================================================
describe("butir 2 - penyimpanan terpisah per akun + peran", () => {
  it("akun lain pada PC yang sama memulai dari profil perannya, dan setelan akun pertama kembali saat ia masuk lagi", async () => {
    const gudang: Record<string, unknown> = {};
    // Hakim: setelan pertama pada PC ini (diadopsi apa adanya), lalu diubah.
    const a = bukaPopup({ orang: ORANG.hakim, simpanan: gudang });
    await tenang(a);
    (a.d.getElementById("sisipJadwal") as HTMLInputElement).checked = false;
    a.d.getElementById("sisipJadwal")!.dispatchEvent(new a.w.Event("change", { bubbles: true }));
    a.w.chrome.storage.local.set({ skalaHuruf: 130, temaPopup: "terang" });
    await sampai(() => (gudang["pengaturanAkun:kk-hakim|hakim"] as any)?.nilai?.skalaHuruf === 130, "salinan hakim");
    a.w.close();

    // Juru Sita: kunci global diganti ke profil perannya; setelan hakim tidak bocor.
    const b = bukaPopup({ orang: ORANG.js, simpanan: gudang });
    await tenang(b);
    expect(gudang.skalaHuruf).toBe(100);
    expect(gudang.temaPopup).toBe("ikut");
    expect(gudang.sisipJadwal).toBe(false);
    expect(gudang.checklistMilestone).toBe(true);
    expect((gudang[`pengaturanAkun:kk-hakim|hakim`] as any).nilai.skalaHuruf).toBe(130);
    expect((gudang[`pengaturanAkun:kk-js|juru-sita`] as any).nilai.skalaHuruf).toBe(100);
    (b.d.getElementById("tandaiHalaman") as HTMLInputElement).checked = false;
    b.d.getElementById("tandaiHalaman")!.dispatchEvent(new b.w.Event("change", { bubbles: true }));
    await sampai(() => (gudang["pengaturanAkun:kk-js|juru-sita"] as any)?.nilai?.tandaiHalaman === false, "salinan juru sita");
    b.w.close();

    // Hakim masuk lagi: setelannya pulih; setelan juru sita tetap miliknya.
    const c = bukaPopup({ orang: ORANG.hakim, simpanan: gudang });
    await tenang(c);
    expect(gudang.skalaHuruf).toBe(130);
    expect(gudang.temaPopup).toBe("terang");
    expect(gudang.sisipJadwal).toBe(false);
    expect(gudang.tandaiHalaman).toBe(true);
    expect((c.d.getElementById("skalaNilai") as HTMLElement).textContent).toBe("130%");
    expect((gudang["pengaturanAkun:kk-js|juru-sita"] as any).nilai.tandaiHalaman).toBe(false);
  });

  it("peran berganti pada akun yang sama = salinan terpisah (kunci akun|peran)", async () => {
    const gudang: Record<string, unknown> = {};
    const a = bukaPopup({ orang: ORANG.hakim, simpanan: gudang });
    await tenang(a);
    a.w.close();
    const b = bukaPopup({ orang: { ...ORANG.hakim, peran: "Jurusita", kode: "juru-sita" }, simpanan: gudang });
    await tenang(b);
    expect(Object.keys(gudang).filter((k) => k.startsWith("pengaturanAkun:")).sort()).toEqual([
      "pengaturanAkun:kk-hakim|hakim",
      "pengaturanAkun:kk-hakim|juru-sita",
    ]);
  });

  it("setelan PC yang sudah ada (sebelum pembaruan) menjadi milik akun pertama, tidak direset", async () => {
    const gudang: Record<string, unknown> = { sisipJadwal: true, skalaHuruf: 120 };
    const p = bukaPopup({ orang: ORANG.hakim, simpanan: gudang });
    await tenang(p);
    expect(gudang.skalaHuruf).toBe(120);
    expect((gudang["pengaturanAkun:kk-hakim|hakim"] as any).nilai.skalaHuruf).toBe(120);
  });

  it("kunci setelan akun di popup.js sama dengan latar.js", () => {
    const ambil = (s: string) => {
      const m = /const KUNCI_SETELAN_AKUN = \[([\s\S]*?)\];/.exec(s);
      return (m![1].match(/"[^"]+"/g) || []).join(",");
    };
    expect(ambil(popupJs)).toBe(ambil(latarJs));
  });
});

// ============================================================================
describe("butir 3 - profil saklar: bug dan perbedaan nyata per peran", () => {
  async function bukaAdminUi() {
    const p = bukaPopup({ orang: ORANG.admin, simpanan: { ...UI_FITUR } });
    await tenang(p);
    await sampai(() => p.d.getElementById("tbProfil") !== null, "kartu profil");
    return p;
  }
  const tekan = (p: Popup, kode: string) => (p.d.querySelector(`#tbProfil button[data-profil="${kode}"]`) as HTMLButtonElement).click();

  it("ada profil untuk Hakim, PP, Juru Sita, Panitera, Kasir, PTSP, Mediator, Operator, dan Kustom", async () => {
    const p = await bukaAdminUi();
    const kode = Array.from(p.d.querySelectorAll("#tbProfil button[data-profil]")).map((b) => (b as HTMLElement).dataset.profil);
    expect(kode).toEqual(["hakim", "pp", "jurusita", "panitera", "kasir", "ptsp", "mediator", "operator", "kustom"]);
  });

  it("tiap profil menyetel saklar + panel yang BERBEDA (tanda tangan unik) dan berubah nyata di penyimpanan", async () => {
    const p = await bukaAdminUi();
    const tandaTangan = new Map<string, string>();
    for (const kode of ["hakim", "pp", "jurusita", "panitera", "kasir", "ptsp", "mediator", "operator"]) {
      tekan(p, kode);
      await sampai(() => (p.d.querySelector(`#tbProfil button[data-profil="${kode}"]`) as HTMLElement).getAttribute("aria-pressed") === "true", `profil ${kode} terpilih`);
      await sampai(() => (p.simpanan.panelBawaanTampil as any)?.diubahPada !== undefined && (p.simpanan.pengaturanAkun_x ?? true) !== null, "panel tertulis");
      await tunggu(60);
      const panel = p.simpanan.panelBawaanTampil as { aleta: boolean; sipp: boolean; abt: boolean };
      tandaTangan.set(kode, `${nilaiSaklar(p)}|${panel.aleta ? 1 : 0}${panel.sipp ? 1 : 0}${panel.abt ? 1 : 0}`);
    }
    // 14 Okt (permintaan pengguna): panel ALETA di portal TERTUTUP bawaan untuk SEMUA profil - Panitera
    // kini sama dengan Juru Sita. 21 Okt 2026: SEMUA panel (ALETA, SIPP, ABT) terlipat bawaan untuk semua
    // profil, jadi profil hanya berbeda di saklarnya: lima tanda tangan berbeda.
    expect(new Set(tandaTangan.values()).size).toBe(5);
    expect(tandaTangan.get("panitera")).toBe(tandaTangan.get("jurusita"));
    for (const v of tandaTangan.values()) expect(v.split("|")[1]).toBe("000");
    // Nilai di penyimpanan = nilai di kotak centang (satu penulis); profil terakhir = Operator.
    expect(p.simpanan.checklistMilestone).toBe((p.d.getElementById("checklistMilestone") as HTMLInputElement).checked);
    expect(p.simpanan.checklistMilestone).toBe(false);
    expect(tandaTangan.get("kasir")).toBe("00001|000");
    expect(tandaTangan.get("hakim")).toBe("11001|000");
    expect(tandaTangan.get("pp")).toBe("11101|000");
    expect(tandaTangan.get("jurusita")).toBe("10001|000");
  });

  it("Kustom = setelan sendiri: diingat sebelum profil dicoba, dan dipulihkan saat Kustom ditekan", async () => {
    const p = await bukaAdminUi();
    // Setelan sendiri yang tidak cocok dengan profil mana pun.
    for (const [id, nilai] of [
      ["tandaiHalaman", false],
      ["sisipJadwal", true],
      ["cetakTigaBerkas", true],
      ["suntingLangsungAbt", true],
      ["checklistMilestone", false],
    ] as const) {
      const k = p.d.getElementById(id) as HTMLInputElement;
      k.checked = nilai;
      k.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    }
    const sendiri = nilaiSaklar(p);
    expect(p.d.querySelector('#tbProfil button[data-profil="kustom"]')!.getAttribute("aria-pressed")).toBe("true");
    tekan(p, "kasir");
    await sampai(() => nilaiSaklar(p) === "00001", "kasir terpasang");
    tekan(p, "kustom");
    await sampai(() => nilaiSaklar(p) === sendiri, "setelan sendiri kembali");
    expect(p.d.querySelector('#tbProfil button[data-profil="kustom"]')!.getAttribute("aria-pressed")).toBe("true");
  });

  it("kartu profil hanya untuk Super Admin dan Admin; peran lain mengikuti profil perannya", async () => {
    const hakim = bukaPopup({ orang: ORANG.hakim, simpanan: { ...UI_FITUR } });
    await tenang(hakim);
    expect(hakim.d.getElementById("tbProfil")).toBeNull();
    // Profil bawaan peran sudah terpasang untuk akun baru.
    const js = bukaPopup({ orang: ORANG.js, simpanan: { ...UI_FITUR } });
    await tenang(js);
    expect(js.d.getElementById("tbProfil")).toBeNull();
    expect(js.simpanan.sisipJadwal).toBe(false);
    expect(js.simpanan.checklistMilestone).toBe(true);
    // Admin: UI Baru wajib; saklar fitur "popup-11" datang dari tampilan yang diterapkan server.
    const adm = bukaPopup({
      orang: ORANG.adminBiasa,
      simpanan: {
        tampilanServer: {
          mode: "ui",
          diterapkan: true,
          fitur: { "popup-11": true },
          versi: "v",
          diambil: Date.now(),
          profil: { peran: "admin", saklar: null, fitur: null, sumber: "bawaan", bolehUbahProfil: true },
        },
      },
    });
    await tenang(adm);
    expect(adm.d.getElementById("tbProfil")).not.toBeNull();
  });
});

// ============================================================================
describe("butir 4 - kartu sambungan: ringkas bila semua tersambung, penuh bila ada masalah", () => {
  const kartu = (p: Popup) => p.d.getElementById("uiStatus") as HTMLElement;

  it("semua tersambung: satu baris (ringkas), dapat dibuka lewat 'rincian'", async () => {
    const p = bukaPopup({ orang: ORANG.admin, simpanan: { ...UI_FITUR } });
    await tenang(p);
    await sampai(() => kartu(p).dataset.keadaan === "ok", "keadaan ok");
    expect(kartu(p).dataset.ringkas).toBe("ya");
    expect(kartu(p).querySelector(".tb-status-judul")!.textContent).toBe("Semua tersambung");
    expect((kartu(p).querySelector(".tb-status-lipat") as HTMLElement).hidden).toBe(false);
    expect(kartu(p).dataset.terbuka).toBeUndefined();
    (kartu(p).querySelector(".tb-status-lipat") as HTMLButtonElement).click();
    expect(kartu(p).dataset.terbuka).toBe("ya");
    expect(popupHtml).toContain('.tb-status[data-ringkas="ya"] .tb-status-isi { display: none; }');
  });

  it("SIPP/ABT menjawab 404: TIDAK boleh bertulis 'Semua tersambung'; tampil penuh dengan sebabnya", async () => {
    const p = bukaPopup({
      orang: ORANG.admin,
      simpanan: { ...UI_FITUR },
      situs: (a) => (/index\.php|SIPP|aps_badilag/.test(a) ? { ok: false, status: 404 } : { ok: true, status: 200 }),
    });
    await tenang(p);
    await sampai(() => kartu(p).dataset.keadaan === "masalah", "masalah terbaca");
    expect(kartu(p).dataset.ringkas).toBeUndefined();
    expect(kartu(p).querySelector(".tb-status-judul")!.textContent).toMatch(/2 hal perlu dibereskan/);
    const daftar = Array.from(kartu(p).querySelectorAll(".tb-status-masalah li")).map((l) => l.textContent);
    expect(daftar).toEqual(["SIPP menjawab 404.", "ABT menjawab 404."]);
    expect((kartu(p).querySelector(".tb-status-lipat") as HTMLElement).hidden).toBe(true);
  });

  it("tanpa saklar popup-2 pun, SIPP/ABT tetap diperiksa untuk kartu status", async () => {
    const p = bukaPopup({
      orang: ORANG.admin,
      simpanan: { ujiTampilan: "ui", ujiFitur: {} },
      situs: () => ({ ok: false, status: 404 }),
    });
    await tenang(p);
    await sampai(() => kartu(p).dataset.keadaan === "masalah", "masalah terbaca");
  });
});

// ============================================================================
describe("butir 5 - keterangan teknis hanya untuk Super Admin", () => {
  const KALIMAT = [
    /Saklar disetel menurut profil peran/,
    /Aktif hanya di/,
    /Tampilan uji Super Admin sedang menyala/,
    /Mati = panel lahir sebagai logo ALETA/,
    /Mengikuti setelan (akun|peramban)/,
    /uji setempat/,
  ];
  const teks = (p: Popup) =>
    Array.from(p.d.querySelectorAll("body *"))
      .filter((e) => !e.closest("[hidden], [data-peran-sembunyi]"))
      .map((e) =>
        Array.from(e.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent)
          .join("")
      )
      .join("\n");

  it("Hakim, Juru Sita, Kasir, Admin biasa: tidak satu pun kalimat teknis tampil", async () => {
    for (const o of [ORANG.hakim, ORANG.js, ORANG.kasir, ORANG.adminBiasa]) {
      const p = bukaPopup({ orang: o, simpanan: { ...UI_FITUR, ujiTampilan: "baru" }, versiPortal: "1.194.0" });
      await tenang(p);
      for (const k of KALIMAT) expect(teks(p), `${o.peran}: ${k}`).not.toMatch(k);
      expect(p.d.getElementById("tbBatasSitus"), o.peran).toBeNull();
      expect(p.d.getElementById("tbProfilPeran"), o.peran).toBeNull();
    }
  });

  it("Super Admin tetap melihatnya", async () => {
    const p = bukaPopup({ orang: ORANG.admin, simpanan: { ...UI_FITUR } });
    await tenang(p);
    expect(teks(p)).toMatch(/Aktif hanya di 192\.168\.10\.10/);
    expect(teks(p)).toMatch(/Mati = panel lahir sebagai logo ALETA/);
    expect(teks(p)).toMatch(/Mengikuti setelan|Memakai bawaan/);
  });
});

// ============================================================================
describe("butir 6 - pemberitahuan versi baru di puncak popup", () => {
  const pita = (p: Popup) => p.d.getElementById("pemberitahuanVersi") as HTMLElement;

  it("versi portal lebih baru: pita tampil dengan tautan biru 'Perbaharui' di atas kotak keadaan", async () => {
    const p = bukaPopup({ orang: ORANG.hakim, versiPortal: "1.200.0", versiTerpasang: "1.194.0" });
    await tenang(p);
    expect(pita(p).hidden).toBe(false);
    expect(pita(p).textContent).toMatch(/Versi baru 1\.200\.0 tersedia/);
    const tautan = p.d.getElementById("tautanPerbaharui") as HTMLAnchorElement;
    expect(tautan.textContent).toBe("Perbaharui");
    expect(tautan.className).toContain("tautan-biru");
    expect(popupHtml).toMatch(/\.pita-versi a\.tautan-biru \{ color: #2f8bff/);
    // Puncak jendela: sebelum kotak Versi/Masuk ALETA.
    expect(pita(p).compareDocumentPosition(p.d.querySelector(".keadaan")!) & 4).toBeTruthy();
  });

  it("versi sama: pita tersembunyi", async () => {
    const p = bukaPopup({ orang: ORANG.hakim, versiPortal: "1.194.0", versiTerpasang: "1.194.0" });
    await tenang(p);
    expect(pita(p).hidden).toBe(true);
  });

  it("'Perbaharui' (jalan manual) meminta latar memperbarui", async () => {
    const p = bukaPopup({ orang: ORANG.js, versiPortal: "1.200.0" });
    await tenang(p);
    (p.d.getElementById("tautanPerbaharui") as HTMLAnchorElement).click();
    await sampai(() => p.kirim.some((m) => m.jenis === "perbarui"), "pesan perbarui");
  });

  it("paket yang sudah diunduh otomatis: pita menyebutnya dan tombol 'tampilkan berkas' meminta latar membukanya", async () => {
    const p = bukaPopup({
      orang: ORANG.hakim,
      versiPortal: "1.194.0",
      simpanan: { pembaruanOtomatis: { versiPortal: "1.200.0", diunduh: { versi: "1.200.0", id: 77, nama: "ALETA/aleta-ekstensi-sipp-1.200.0.zip" } } },
    });
    await tenang(p);
    expect(pita(p).hidden).toBe(false);
    expect(pita(p).textContent).toMatch(/diunduh otomatis/);
    const lihat = p.d.getElementById("tampilkanPaketBaru") as HTMLButtonElement;
    expect(lihat.hidden).toBe(false);
    lihat.click();
    await sampai(() => p.kirim.some((m) => m.jenis === "tampilkan-unduhan" && m.id === 77), "pesan tampilkan");
  });
});

// ============================================================================
describe("butir 13 - UI Baru wajib bagi selain Super Admin", () => {
  it("non-Super Admin: kulit Modern + susunan UI Baru walau tersimpan 'lama' / 'baru'; tanpa pengalih", async () => {
    for (const simpan of [{}, { ujiTampilan: "lama" }, { ujiTampilan: "baru" }]) {
      for (const o of [ORANG.hakim, ORANG.js, ORANG.kasir, ORANG.adminBiasa]) {
        const p = bukaPopup({ orang: o, simpanan: { ...simpan } });
        await tenang(p);
        expect(p.d.documentElement.getAttribute("data-kulit"), `${o.peran} ${JSON.stringify(simpan)}`).toBe("modern");
        expect(p.d.documentElement.getAttribute("data-susunan")).toBe("ui");
        expect((p.d.getElementById("bagianUji") as HTMLElement).hidden).toBe(true);
        expect((p.d.getElementById("ujiLainBaris") as HTMLElement).hidden).toBe(true);
      }
    }
  });

  it("popup yang dibuka kembali memakai golongan terakhir sejak gambar pertama (tanpa kedip ke Lama)", async () => {
    const gudang: Record<string, unknown> = {};
    const a = bukaPopup({ orang: ORANG.hakim, simpanan: gudang });
    await tenang(a);
    a.w.close();
    const b = bukaPopup({ orang: null, simpanan: gudang });
    await tenang(b);
    expect(b.d.documentElement.getAttribute("data-kulit")).toBe("modern");
  });

  it("Super Admin boleh memilih Lama, Baru, dan UI Baru", async () => {
    const p = bukaPopup({ orang: ORANG.admin });
    await sampai(() => !(p.d.getElementById("bagianUji") as HTMLElement).hidden, "pengalih tampil");
    expect(p.d.documentElement.hasAttribute("data-kulit")).toBe(false);
    for (const [id, mode, kulit] of [
      ["ujiUi", "ui", "modern"],
      ["ujiBaru", "baru", null],
      ["ujiLama", "lama", null],
    ] as const) {
      (p.d.getElementById(id) as HTMLButtonElement).click();
      await sampai(() => p.simpanan.ujiTampilan === mode, `tersimpan ${mode}`);
      expect(p.d.documentElement.getAttribute("data-kulit")).toBe(kulit);
    }
  });

  it("panel (panel-alat.js): peran bukan Super Admin selalu 'ui', tanpa mode coba; Super Admin memakai pilihannya", async () => {
    const jalankanAlat = async (awal: Record<string, unknown>) => {
      const simpanan: Record<string, unknown> = JSON.parse(JSON.stringify(awal));
      const atribut = new Map<string, string>();
      const akar: any = {
        tagName: "HTML",
        dataset: {},
        style: { setProperty() {} },
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        setAttribute: (n: string, v: string) => atribut.set(n, String(v)),
        removeAttribute: (n: string) => atribut.delete(n),
        getAttribute: (n: string) => (atribut.has(n) ? atribut.get(n) : null),
        hasAttribute: (n: string) => atribut.has(n),
        appendChild: (x: any) => x,
        querySelector: () => null,
        addEventListener() {},
      };
      const k: any = {
        console, Date, JSON, Math, Number, String, Boolean, Array, Object, Promise, Error, Map, Set, RegExp, setTimeout, clearTimeout,
        document: { documentElement: akar, createElement: () => ({ ...akar, dataset: {} }), querySelector: () => null, addEventListener() {} },
        window: { location: { hostname: "192.168.10.10", pathname: "/SIPP/x", search: "" }, sessionStorage: { getItem: () => null, setItem() {} }, addEventListener() {}, postMessage() {} },
        chrome: {
          runtime: { getManifest: () => ({ version: "1.194.0" }) },
          storage: {
            onChanged: { addListener() {} },
            local: {
              get: async (kunci: string[]) => Object.fromEntries(kunci.filter((x) => x in simpanan).map((x) => [x, JSON.parse(JSON.stringify(simpanan[x]))])),
              set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
            },
          },
        },
        fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
        navigator: {},
        Response: class {},
        AbortController: class { signal = {}; abort() {} },
      };
      k.globalThis = k;
      vm.createContext(k);
      vm.runInContext(sumberAlat, k, { filename: "panel-alat.js" });
      await k.alatMuatUji();
      return k;
    };
    const profil = (peran: string, ubah = false) => ({ peran, saklar: null, fitur: null, sumber: "bawaan", bolehUbahProfil: ubah });
    const sv = (peran: string, ubah?: boolean) => ({ mode: "lama", fitur: {}, diterapkan: false, versi: "v", diambil: Date.now(), profil: profil(peran, ubah) });

    for (const peran of ["hakim", "juru-sita", "panitera-pengganti", "admin", "kasir"]) {
      for (const lokal of ["lama", "baru", "ui"]) {
        const k = await jalankanAlat({ tampilanServer: sv(peran, peran === "admin"), ujiTampilan: lokal });
        expect(k.alatUjiMode(), `${peran}/${lokal}`).toBe("ui");
        expect(k.alatKulit()).toBe("modern");
        expect(k.alatCobaAktif(), `${peran}/${lokal} tanpa mode coba`).toBe(false);
      }
    }
    const super1 = await jalankanAlat({ tampilanServer: sv("super-admin", true), ujiTampilan: "baru" });
    expect(super1.alatUjiMode()).toBe("baru");
    const super2 = await jalankanAlat({ tampilanServer: sv("super-admin", true), ujiTampilan: "lama" });
    expect(super2.alatUjiMode()).toBe("lama");
    // Peran belum diketahui (belum masuk / portal lama): aturan lama.
    const tanpa = await jalankanAlat({ ujiTampilan: "lama" });
    expect(tanpa.alatUjiMode()).toBe("lama");
    expect(sumberAlat).toContain("/* === UIBARU-WAJIB 12 Okt === */");
  });
});

// ============================================================================
describe("butir 6 - latar.js: pembaruan otomatis sesudah masuk ALETA", () => {
  type Dunia = { lokal: Record<string, unknown>; unduhan: Array<{ url: string; filename: string }>; cek: number; pesan: ((p: any, k: any, j: (x: unknown) => void) => unknown) | null };

  function nyalakan(opsi: { tipe: string; versiPortal?: string; versi?: string; periksa?: { status: string; version?: string }; masuk?: boolean; lokal?: Record<string, unknown> }) {
    const dunia: Dunia = { lokal: { asalPortal: "http://192.168.10.10/aleta", ...(opsi.lokal || {}) }, unduhan: [], cek: 0, pesan: null };
    const salin = (x: unknown) => JSON.parse(JSON.stringify(x));
    const gudang = (isi: Record<string, unknown>) => ({
      get: async (k?: string | string[] | null) => {
        if (k == null) return salin(isi);
        return Object.fromEntries([k].flat().filter((x) => x in isi).map((x) => [x, salin(isi[x])]));
      },
      set: async (o: Record<string, unknown>) => void Object.assign(isi, salin(o)),
      remove: async (k: string | string[]) => void [k].flat().forEach((x) => delete isi[x]),
    });
    const sesi: Record<string, unknown> = {};
    const chrome: any = {
      runtime: {
        id: "aleta-uji",
        getManifest: () => ({ version: opsi.versi ?? "1.194.0" }),
        reload() {},
        requestUpdateCheck: async () => {
          dunia.cek += 1;
          return salin(opsi.periksa ?? { status: "no_update" });
        },
        onUpdateAvailable: { addListener() {} },
        onMessage: { addListener: (f: any) => (dunia.pesan = f) },
      },
      management: { getSelf: async () => ({ installType: opsi.tipe }) },
      storage: { session: gudang(sesi), local: gudang(dunia.lokal), onChanged: { addListener() {} } },
      action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
      downloads: {
        onDeterminingFilename: { addListener() {} },
        onChanged: { addListener() {}, removeListener() {} },
        search: (_q: unknown, f: (x: unknown[]) => void) => f([]),
        download: (o: { url: string; filename: string }, cb: (id: number) => void) => {
          dunia.unduhan.push({ url: o.url, filename: o.filename });
          cb(900 + dunia.unduhan.length);
        },
        show() {},
      },
    };
    const konteks: Record<string, unknown> = {
      chrome,
      console,
      setTimeout: (f: () => void, ms?: number) => globalThis.setTimeout(f, ms),
      clearTimeout: (t: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(t),
      AbortController,
      btoa: (s: string) => Buffer.from(s, "binary").toString("base64"),
      fetch: async (alamat: string) => {
        const a = String(alamat);
        if (a.includes("info=siapa")) {
          if (opsi.masuk === false) return { ok: false, status: 401, json: async () => ({}) };
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              data: { versi: opsi.versiPortal ?? "1.200.0", pengguna: { nama: "Uji", peran: "Hakim", kunci: "kk-1", golongan: { kode: "hakim", semua: ["hakim"] } } },
            }),
          };
        }
        return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("PK-zip-palsu").buffer };
      },
    };
    const ctx = vm.createContext(konteks);
    vm.runInContext(latarJs, ctx, { filename: "latar.js" });
    const kirim = (pesan: Record<string, unknown>) =>
      new Promise<any>((selesai) => {
        const jawab = (x: unknown) => selesai(x);
        const r = dunia.pesan!({ sumber: "aleta-panel", ...pesan }, {}, jawab);
        if (r !== true) selesai(r);
      });
    return { dunia, kirim, ctx: ctx as any };
  }

  it("dimuat sebagai folder (development): paket ZIP terbaru diunduh sekali ke Unduhan/ALETA, tanpa requestUpdateCheck", async () => {
    const { dunia, kirim } = nyalakan({ tipe: "development" });
    const h = await kirim({ jenis: "periksa-pembaruan", paksa: true });
    expect(h.keadaan).toBe("paket-diunduh");
    expect(dunia.unduhan).toHaveLength(1);
    expect(dunia.unduhan[0].filename).toBe("ALETA/aleta-ekstensi-sipp-1.200.0.zip");
    expect(dunia.unduhan[0].url.startsWith("data:application/zip;base64,")).toBe(true);
    expect(dunia.cek).toBe(0);
    const c = dunia.lokal.pembaruanOtomatis as any;
    expect(c.versiPortal).toBe("1.200.0");
    expect(c.diunduh).toMatchObject({ versi: "1.200.0", nama: "ALETA/aleta-ekstensi-sipp-1.200.0.zip" });
    // Pemeriksaan kedua (paksa) untuk versi yang sama tidak mengunduh ulang.
    await kirim({ jenis: "periksa-pembaruan", paksa: true });
    expect(dunia.unduhan).toHaveLength(1);
  });

  it("dibatasi satu pemeriksaan per 30 menit (tanpa paksa)", async () => {
    const { dunia, kirim } = nyalakan({ tipe: "development", lokal: { pembaruanOtomatis: { periksaPada: Date.now() } } });
    const h = await kirim({ jenis: "periksa-pembaruan" });
    expect(h.keadaan).toBe("dilewati");
    expect(dunia.unduhan).toHaveLength(0);
  });

  it("terkemas (CRX/update_url): Chrome diminta mengunduh sendiri (requestUpdateCheck); dicatat menunggu dipasang; tidak dimuat ulang", async () => {
    const { dunia, kirim } = nyalakan({ tipe: "normal", periksa: { status: "update_available", version: "1.200.0" } });
    await tunggu(50); // pemeriksaan saat pekerja bangun selesai dulu
    dunia.cek = 0;
    const h = await kirim({ jenis: "periksa-pembaruan", paksa: true });
    expect(h.keadaan).toBe("menunggu-pasang");
    expect(dunia.cek).toBe(1);
    expect(dunia.unduhan).toHaveLength(0);
    expect((dunia.lokal.pembaruanOtomatis as any).menunggu).toBe("1.200.0");
  });

  it("belum masuk ALETA (401) atau versi sama: tidak ada unduhan", async () => {
    const a = nyalakan({ tipe: "development", masuk: false });
    expect((await a.kirim({ jenis: "periksa-pembaruan", paksa: true })).keadaan).toBe("belum-masuk");
    expect(a.dunia.unduhan).toHaveLength(0);
    const b = nyalakan({ tipe: "development", versiPortal: "1.194.0" });
    expect((await b.kirim({ jenis: "periksa-pembaruan", paksa: true })).keadaan).toBe("terbaru");
    expect(b.dunia.unduhan).toHaveLength(0);
  });

  it("'Perbarui sekarang' pada pemasangan folder mengunduh paket dan menjelaskan langkah sisanya (jujur)", async () => {
    const { dunia, kirim } = nyalakan({ tipe: "development" });
    const h = await kirim({ jenis: "perbarui" });
    expect(h.ok).toBe(false);
    expect(h.keadaan).toBe("paket_diunduh");
    expect(h.idUnduhan).toBe(901);
    expect(h.pesan).toMatch(/tidak dapat mengganti berkasnya sendiri/);
    expect(h.pesan).toMatch(/muat ulang ekstensi/);
    expect(dunia.unduhan).toHaveLength(1);
  });

  it("akun berganti: salinan akun lama dikunci (mirror dijeda) sampai popup menukar setelan", async () => {
    const { dunia, kirim } = nyalakan({ tipe: "normal", lokal: { identitasPopup: { kunci: "kk-lain|hakim" } } });
    await kirim({ jenis: "periksa-pembaruan", paksa: true });
    expect(dunia.lokal.identitasMenunggu).toBe("kk-1|hakim");
    expect(dunia.lokal.identitasPeralihan).toBe(true);
  });

  it("halaman portal memicu pemeriksaan sesudah masuk (aleta.js)", () => {
    expect(aletaJs).toMatch(/sesiPortalMasuk: Date.now()/);
    expect(latarJs).toMatch(/ubah.sesiPortalMasuk/);
    expect(latarJs).toContain('pesan.jenis === "periksa-pembaruan"');
    expect(latarJs).toContain('pesan.jenis === "tampilkan-unduhan"');
  });
});

// ============================================================================
describe("golongan pegawai untuk popup (portal)", () => {
  const g = (x: Record<string, unknown>) => golonganPopup(x as never);
  it("memetakan peran/posisi ke golongan", () => {
    expect(g({ roleId: "super-admin" }).kode).toBe("super-admin");
    expect(g({ roleId: "admin" }).kode).toBe("admin");
    expect(g({ roleId: "hakim" }).kode).toBe("hakim");
    expect(g({ roleId: "wakil-ketua" }).kode).toBe("ketua");
    expect(g({ roleId: "staf", positionId: "pos-panitera-pengganti" }).kode).toBe("panitera-pengganti");
    expect(g({ roleId: "jurusita" }).kode).toBe("juru-sita");
    expect(g({ roleId: "staf", positionId: "pos-jurusita" }).kode).toBe("juru-sita");
    expect(g({ roleId: "panitera-muda" }).kode).toBe("panitera");
    expect(g({ roleId: "analis-keuangan" }).kode).toBe("kasir");
    expect(g({ roleId: "staf", positionId: "pos-ptsp" }).kode).toBe("ptsp");
    expect(g({ roleId: "staf", additionalRoleIds: ["operator"] }).kode).toBe("operator");
    expect(g({ roleId: "staf" }).kode).toBe("umum");
  });
  it("peran tambahan menambah golongan, tidak menggantikan", () => {
    const r = g({ roleId: "hakim", additionalRoleIds: ["operator", "mediator"] });
    expect(r.kode).toBe("hakim");
    expect(r.semua).toEqual(["hakim", "mediator", "operator"]);
  });
  it("rute ?info=siapa membawa kunci akun (sidik), peranId, dan golongan", () => {
    const rute = readFileSync(path.resolve(__dirname, "../app/api/aleta-ecourt/ekstensi/route.ts"), "utf8");
    expect(rute).toMatch(/golongan: golonganPopup\(actor as never\)/);
    expect(rute).toMatch(/kunci: createHash\("sha256"\)/);
  });
});
