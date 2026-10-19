// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PERBAIKAN 2 OKTOBER 2026 - PANEL SIPP (agen S, blok S2 di konten.js)
 * ============================================================================
 *
 * Dijaga dengan MENJALANKAN panel-alat.js, basmassal.js, dan konten.js UTUH di
 * jsdom (halaman detail perkara / daftar perkara SIPP tiruan):
 *
 *   butir 3   putusan massal SIPP: blangko utama di atas, "Blangko berbeda…"
 *             per perkara, pilihan ikut antrean; aletaMassalBarisBlangko (R)
 *             dipakai bila ada
 *   butir 7   tag peran di kepala lipatan (Ketua / Hakim / Panitera / Juru Sita)
 *   butir 14  (dicabut 17 Okt) tekanan SIPP langsung, tanpa alatJedaManusia;
 *             yang ditahan tidak menunggu; tidak ada jalur tulis SIPP baru
 *   butir 15  Perkara berikutnya menurut peran; Direktori Putusan gagal dst.
 *             hanya Super Admin & Admin
 *   butir 17  (19 Okt) Edoc penetapan manual per jenis, tanpa passphrase, 404 jujur;
 *             unggah otomatis per baris dijaga ekstensi-penetapan-mulus-2
 *   butir 19  bawaan buka/tutup: satu bagian utama per tab, kartu tab tertutup,
 *             pilihan tersimpan menang
 *   butir 2   relaas massal daftar SIPP tetap dipasang lewat aletaJurusitaPasangMassal
 *   K1        Lama dan Baru tanpa jejak S2
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () =>
  (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js")).replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");
/**
 * aletaMassalBarisBlangko (R, K3) dikerjakan paralel di basmassal.js. Uji jalur
 * R hanya berjalan bila fungsinya ada; jalur cadangan konten.js selalu diuji.
 */
const ADA_BARIS_BLANGKO_R = /function aletaMassalBarisBlangko\s*\(/.test(BASMASSAL);

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
// Portal tiruan (bentuk sama dengan ekstensi-sipp-1okt.test.ts)
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

function statusContoh(nama: string) {
  const orang = [{ nama }];
  return {
    majelis: orang,
    panitera: orang,
    jurusita: orang,
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
  peran?: string;
  nama?: string;
  daftar?: boolean;
  html?: string;
  jawab?: (url: string, cara: string, badan: unknown) => Jawab;
  /** Dijalankan sebelum skrip dimuat (memasang fungsi global milik berkas lain). */
  sebelum?: (w: any) => void;
  /** Dijalankan sesudah skrip dimuat, sebelum panel tersusun (menimpa fungsi basmassal.js). */
  sesudah?: (w: any) => void;
};
type Halaman = { dom: JSDOM; w: any; d: Document; minta: Minta[]; jembatan: Array<Record<string, unknown>>; simpanan: Record<string, unknown> };

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
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.177.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
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
      isi = { ok: true, data: { available: true, status: statusContoh(nama) } };
    } else if (url.includes("/putusan/isian-sipp?")) {
      isi = { ok: true, data: { ada: false, sebab: "Belum ada draf putusan untuk perkara ini." } };
    } else if (url.includes("/penetapan-edoc/")) {
      status = 404;
      isi = {};
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
      const balas =
        pesan.jenis === "pilihan"
          ? { ok: true, tampak: false, pilihan: [], nilaiSekarang: "" }
          : pesan.jenis === "nilai"
            ? { ok: true, nilai: "", tampak: true }
            : { ok: true, medan: [] };
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ...balas }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  if (p.sebelum) p.sebelum(w);
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  if (p.sesudah) p.sesudah(w);
  return { dom, w, d: w.document, minta, jembatan, simpanan };
}

const BARU = { ujiTampilan: "baru", ujiIzinkanNyata: true };
const UI = { ujiTampilan: "ui", ujiIzinkanNyata: true };

const panelDari = (h: Halaman) => h.d.getElementById("aleta-panel-sipp") as any;
const siapUi = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.getAttribute("data-t7") === "ui" && pn.getAttribute("data-s2") === "ui" && pn.querySelector(".aleta-t7-tab") ? pn : null;
  }, "panel UI Baru (S2)");
const siapDaftarUi = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.dataset.mode === "daftar" && pn.getAttribute("data-s2") === "ui" ? pn : null;
  }, "panel daftar UI Baru (S2)");
const bagianDi = (pn: any, kunci: string) => pn.querySelector(`.aleta-bagian[data-kunci="${kunci}"]`);
const terbukaBagian = (b: any) => (b.querySelector(":scope > .aleta-bagian-isi") as HTMLElement).style.display !== "none";
const tagDi = (el: any) => {
  const t = el && el.querySelector(".aleta-lipat-peran");
  return t && !t.hidden ? String(t.textContent || "").trim() : "";
};
const tombolBertulisan = (akar: ParentNode, teks: string) =>
  Array.from(akar.querySelectorAll("button")).find((b) => String(b.textContent || "").trim() === teks) as HTMLButtonElement | undefined;
function pilihBerkas(w: any, input: HTMLInputElement, berkas: File[]) {
  Object.defineProperty(input, "files", { configurable: true, value: berkas });
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
}
/** Menyetujui konfirmasi a30Tanya di dalam panel (centang lalu tombol ya). */
async function setujui(w: any, wadah: ParentNode, ya = true) {
  const kartu = await sampai(() => wadah.querySelector(".aleta-a30-tanya"), "konfirmasi tampil");
  const cek = kartu.querySelector("input[type=checkbox]") as HTMLInputElement;
  cek.checked = true;
  cek.dispatchEvent(new w.Event("change"));
  (kartu.querySelector(ya ? ".aleta-a30-tanya-ya" : ".aleta-a30-tanya-tidak") as HTMLButtonElement).click();
}

// ============================================================================
describe("K1: Lama dan Baru tanpa satu pun jejak S2", () => {
  it("Lama: tidak ada data-s2, kelas aleta-s2-, edoc penetapan, maupun permintaan penetapan-edoc", async () => {
    const h = buka({});
    const pn = await sampai(() => panelDari(h) && panelDari(h).querySelector(".aleta-kelompok") && panelDari(h), "panel Lama");
    await tunggu(600);
    expect(pn.outerHTML).not.toMatch(/data-s2|aleta-s2-|aleta-lipat-peran|s2EdocPenetapan/);
    expect(h.minta.some((m) => m.url.includes("/penetapan-edoc/") || /checklist\?peran=/.test(m.url))).toBe(false);
  });

  it("Baru: sama - tanpa data-s2, tag peran, edoc penetapan, maupun kartu berikutnya per peran", async () => {
    const h = buka({ simpanan: { ...BARU, ujiFitur: { "sipp-21": true } }, peran: "Hakim" });
    const pn = await sampai(() => panelDari(h) && panelDari(h).getAttribute("data-t7-a30") === "baru" && panelDari(h), "panel Baru");
    await tunggu(600);
    expect(pn.outerHTML).not.toMatch(/data-s2|aleta-s2-|s2EdocPenetapan/);
    expect(h.minta.some((m) => m.url.includes("/penetapan-edoc/"))).toBe(false);
  });
});

// ============================================================================
describe("butir 7: tag peran di kepala lipatan (UI Baru)", () => {
  it("panel perkara: Penetapan = Ketua, edoc penetapan = Ketua, Putusan = Hakim, Data Umum = PTSP", async () => {
    const h = buka({ simpanan: UI });
    const pn = await siapUi(h);
    await sampai(() => tagDi(bagianDi(pn, "penunjukan")), "tag penunjukan");
    expect(tagDi(bagianDi(pn, "penunjukan"))).toBe("Ketua");
    expect(tagDi(bagianDi(pn, "s2EdocPenetapanManual"))).toBe("Ketua");
    expect(tagDi(bagianDi(pn, "isiPutusan"))).toBe("Hakim");
    expect(tagDi(bagianDi(pn, "dataUmum"))).toBe("PTSP");
    // Tag di KEPALA (tombol lipat), di kiri judul - bukan di isi.
    const tag = bagianDi(pn, "penunjukan").querySelector(".aleta-lipat-peran");
    expect(tag.parentElement.classList.contains("aleta-bagian-judul")).toBe(true);
    // Bagian keterangan umum tanpa tag.
    expect(tagDi(bagianDi(pn, "riwayatAleta"))).toBe("");
  });

  it("panel daftar: BAS massal = Panitera, Relaas & PBT massal = Juru Sita; tag milik pemilik bagian tidak ditimpa", async () => {
    const stub = (judul: string, tagSendiri?: string) => async (wadah: any) => {
      const akar = wadah.ownerDocument.createElement("div");
      akar.className = "aleta-stub-massal";
      akar.innerHTML = `<details><summary>${tagSendiri ? `<span class="aleta-lipat-peran">${tagSendiri}</span>` : ""}${judul}</summary><div>isi</div></details>`;
      await tunggu(20);
      wadah.appendChild(akar);
      return true;
    };
    const h = buka({
      simpanan: UI,
      daftar: true,
      peran: "Super Admin",
      sesudah: (w) => {
        w.aletaBasMassalPasang = stub("BAS massal");
        w.aletaJurusitaPasangMassal = stub("Relaas & PBT massal", "PP");
      },
    });
    const pn = await siapDaftarUi(h);
    const bas = await sampai(() => {
      const d = pn.querySelector('[data-mps-massal="bas-massal"] details');
      return d && tagDi(d) ? d : null;
    }, "tag BAS massal");
    expect(tagDi(bas)).toBe("Panitera");
    const relaas = await sampai(() => pn.querySelector('[data-mps-massal="relaas-pbt-massal"] details'), "relaas massal");
    await tunggu(50);
    expect(tagDi(relaas)).toBe("PP");
    expect(relaas.querySelectorAll(".aleta-lipat-peran").length).toBe(1);
    // Penetapan massal (bagian milik konten.js) = Ketua.
    expect(tagDi(pn.querySelector('[data-mps-massal="penetapan-massal"]'))).toBe("Ketua");
  });
});

// ============================================================================
describe("butir 2: relaas massal daftar SIPP tetap dipasang R (aletaJurusitaPasangMassal)", () => {
  it("Juru Sita: wadah relaas-pbt-massal dipasang lewat fungsi R dengan situs sipp; konten.js tidak menggambar relaas sendiri", async () => {
    const panggil: Array<Record<string, unknown>> = [];
    const h = buka({
      simpanan: UI,
      daftar: true,
      peran: "Jurusita",
      nama: "Mustini",
      sebelum: (w) => {
        w.aletaJurusitaPasangMassal = async (wadah: any, opsi: Record<string, unknown>) => {
          panggil.push({ massal: wadah.getAttribute("data-mps-massal"), ...opsi });
          const d = wadah.ownerDocument.createElement("details");
          d.innerHTML = "<summary>Relaas & pemberitahuan putusan - massal</summary>";
          wadah.appendChild(d);
          return true;
        };
      },
    });
    const pn = await siapDaftarUi(h);
    await sampai(() => panggil.length > 0, "relaas massal dipasang");
    expect(panggil).toEqual([{ massal: "relaas-pbt-massal", situs: "sipp" }]);
    const wadah = pn.querySelector('[data-mps-massal="relaas-pbt-massal"]');
    expect(wadah.querySelectorAll("details")).toHaveLength(1);
    await sampai(() => tagDi(wadah.querySelector("details")), "tag relaas");
    expect(tagDi(wadah.querySelector("details"))).toMatch(/^Juru ?Sita$/i);
  });
});

// ============================================================================
describe("butir 19: bawaan buka/tutup - satu bagian utama per tab", () => {
  it("Super Admin: tiap tab hanya bagian utamanya yang terbuka; Penetapan = penunjukan", async () => {
    const h = buka({ simpanan: UI });
    const pn = await siapUi(h);
    await tunggu(300);
    const kelompok = Array.from(pn.querySelectorAll(".aleta-isi > .aleta-kelompok")) as any[];
    expect(kelompok.length).toBeGreaterThan(2);
    for (const kel of kelompok) {
      const bagian = Array.from(kel.querySelectorAll(":scope > .aleta-kelompok-isi > .aleta-bagian")) as any[];
      if (bagian.length < 2) continue;
      const buka = bagian.filter(terbukaBagian).map((b) => b.dataset.kunci);
      expect(buka, kel.dataset.kunci).toEqual(String(kel.getAttribute("data-s2-utama")).split(" "));
      expect(buka.length, kel.dataset.kunci).toBeLessThan(bagian.length);
    }
    expect(pn.querySelector('.aleta-kelompok[data-kunci="kerjakan"]').getAttribute("data-s2-utama")).toBe("penunjukan");
    expect(terbukaBagian(bagianDi(pn, "penunjukan"))).toBe(true);
    expect(terbukaBagian(bagianDi(pn, "s2EdocPenetapanManual"))).toBe(false);
    // Perbaikan 5 Okt (butir 11): Data Umum pindah ke tab PTSP dan menjadi
    // bagian utamanya - di Penetapan tinggal tautan, bukan bagian.
    expect(bagianDi(pn, "dataUmum").closest(".aleta-kelompok").dataset.kunci).toBe("ptspKel");
    expect(pn.querySelector('.aleta-kelompok[data-kunci="ptspKel"]').getAttribute("data-s2-utama")).toBe("dataUmum");
    expect(terbukaBagian(bagianDi(pn, "dataUmum"))).toBe(true);
    expect(pn.querySelector('.aleta-kelompok[data-kunci="kerjakan"] .aleta-p5-tautan-ptsp')).not.toBeNull();
  });

  it("pilihan petugas yang tersimpan menang atas bawaan", async () => {
    const h = buka({ simpanan: { ...UI, lipatanBagian: { riwayatAleta: false, penunjukan: true } } });
    const pn = await siapUi(h);
    await tunggu(300);
    expect(terbukaBagian(bagianDi(pn, "riwayatAleta"))).toBe(true);
    expect(terbukaBagian(bagianDi(pn, "penunjukan"))).toBe(false);
    // Bawaan tidak ditulis sebagai pilihan petugas.
    expect(Object.keys((h.simpanan.lipatanBagian as Record<string, boolean>) || {}).sort()).toEqual(["penunjukan", "riwayatAleta"]);
  });

  it("kartu tambahan DI DALAM tab tertutup; kartu atas (Langkah berikutnya) tetap terbuka", async () => {
    const h = buka({ simpanan: { ...UI, ujiFitur: { "sipp-13": true } } });
    const pn = await siapUi(h);
    const catatan = await sampai(() => pn.querySelector('.aleta-t7-kartu[data-t7-fitur="sipp-13"].aleta-lipatan'), "kartu catatan dilipat");
    expect(catatan.getAttribute("data-terbuka")).toBe("tidak");
    const langkah = await sampai(() => pn.querySelector(".aleta-t7-langkah.aleta-lipatan"), "kartu langkah dilipat");
    expect(langkah.getAttribute("data-terbuka")).toBe("ya");
  });
});

// ============================================================================
describe("butir 15: Perkara berikutnya menurut peran", () => {
  const BUTIR = [
    { id: "a", jenis: "operator.direktori-gagal", judul: "Antrean Direktori Putusan yang gagal", perkara: { id: "9", nomor: "90/Pdt.G/2025/PA.Dgl" }, kelompok: "lewat", kerjakan: { tujuan: "sipp" } },
    { id: "b", jenis: "hakim.hasil-sidang-belum-dicatat", judul: "Hasil sidang belum dicatat", perkara: { id: "10", nomor: "10/Pdt.G/2026/PA.Dgl" }, kelompok: "lewat", kerjakan: { tujuan: "sipp" } },
    { id: "c", jenis: "hakim.konsep-putusan", judul: "Konsep putusan belum ada", perkara: { id: "11", nomor: "11/Pdt.G/2026/PA.Dgl" }, kelompok: "hari-ini", kerjakan: { tujuan: "aleta" } },
    { id: "d", jenis: "hakim.konsep-putusan", judul: "Konsep putusan belum ada", perkara: { id: "450", nomor: NOMOR }, kelompok: "hari-ini", kerjakan: { tujuan: "aleta" } },
    { id: "e", jenis: "panitera-pengganti.bas-belum", judul: "BAS belum diunggah", perkara: { id: "12", nomor: "12/Pdt.G/2026/PA.Dgl" }, kelompok: "hari-ini", kerjakan: { tujuan: "sipp" } },
    { id: "f", jenis: "panitera-pengganti.hasil-sidang-belum-dicatat", judul: "Hasil sidang belum dicatat", perkara: { id: "15", nomor: "15/Pdt.G/2026/PA.Dgl" }, kelompok: "lewat", kerjakan: { tujuan: "sipp" } },
    { id: "g", jenis: "jurusita.relaas-belum-diinput", judul: "Relaas belum diinput", perkara: { id: "13", nomor: "13/Pdt.G/2026/PA.Dgl" }, kelompok: "hari-ini", kerjakan: { tujuan: "sipp" } },
    { id: "h", jenis: "panitera.direktori-putusan", judul: "Direktori Putusan", perkara: { id: "14", nomor: "14/Pdt.G/2026/PA.Dgl" }, kelompok: "lewat", kerjakan: { tujuan: "sipp" } },
    { id: "i", jenis: "hakim.hasil-sidang-belum-dicatat", judul: "Hasil sidang belum dicatat", perkara: { id: "11", nomor: "11/Pdt.G/2026/PA.Dgl" }, kelompok: "lewat", kerjakan: { tujuan: "sipp" } },
  ];
  const jawabChecklist = (url: string) => (url.includes("/aleta-ecourt/checklist") ? { isi: { ok: true, data: { butir: BUTIR } } } : null);

  it("s2SaringBerikutnya (murni): kepentingan peran di depan, satu baris per perkara, Direktori/operator tidak pernah ikut", async () => {
    const h = buka({ simpanan: UI });
    await siapUi(h);
    const nomor = (g: string) => polos(h.w.s2SaringBerikutnya(BUTIR, g, NOMOR)).map((b: any) => `${b.perkara.nomor.split("/")[0]}:${b.jenis}`);
    expect(nomor("hakim")).toEqual(["11:hakim.konsep-putusan", "10:hakim.hasil-sidang-belum-dicatat"]);
    expect(nomor("panitera")).toEqual(["12:panitera-pengganti.bas-belum", "15:panitera-pengganti.hasil-sidang-belum-dicatat"]);
    expect(nomor("jurusita")).toEqual(["13:jurusita.relaas-belum-diinput"]);
    expect(nomor("lain")).toEqual([]);
    for (const g of ["hakim", "ketua", "panitera", "jurusita"]) {
      expect(nomor(g).join(" "), g).not.toMatch(/direktori|operator|^90:|14:/);
    }
  });

  const kasus: Array<[string, string, RegExp, string]> = [
    ["Hakim", "hakim", /perlu putusan/, "11/Pdt.G/2026/PA.Dgl"],
    ["Wakil Ketua", "hakim", /perlu putusan/, "11/Pdt.G/2026/PA.Dgl"],
    ["Panitera Pengganti", "panitera-pengganti", /BAS/, "12/Pdt.G/2026/PA.Dgl"],
    ["Jurusita", "jurusita", /relaas & PBT/, "13/Pdt.G/2026/PA.Dgl"],
  ];
  for (const [peran, kunciPeran, judul, pertama] of kasus) {
    it(`${peran}: kartu menurut perannya (checklist?peran=${kunciPeran}), tanpa Direktori Putusan gagal`, async () => {
      const h = buka({ simpanan: { ...UI, ujiFitur: { "sipp-21": true } }, peran, jawab: jawabChecklist });
      const pn = await siapUi(h);
      const kartu = await sampai(() => {
        const k = pn.querySelector("[data-s2-berikutnya]");
        return k && k.querySelector(".aleta-t7-nomor") ? k : null;
      }, "kartu berikutnya per peran");
      expect(kartu.textContent).toMatch(judul);
      expect(kartu.hasAttribute("data-s1-sembunyi")).toBe(false);
      expect(h.minta.some((m) => m.url.includes(`/aleta-ecourt/checklist?peran=${kunciPeran}`))).toBe(true);
      expect(kartu.querySelector(".aleta-t7-nomor").textContent).toBe(pertama);
      expect(kartu.textContent).not.toMatch(/Direktori|90\/Pdt/);
      // Kartu checklist LENGKAP (milik admin) tidak ada untuk peran ini.
      expect(pn.querySelector('[data-t7-fitur="sipp-21"]:not([data-s2-berikutnya])')).toBeNull();
    });
  }

  it("Super Admin: kartu checklist lengkap seperti 1.177.0 (tanpa saringan peran); Operator: tidak ada kartu", async () => {
    const admin = buka({ simpanan: { ...UI, ujiFitur: { "sipp-21": true } }, peran: "Super Admin", jawab: jawabChecklist });
    const pn = await siapUi(admin);
    const kartu = await sampai(() => {
      const k = pn.querySelector('[data-t7-fitur="sipp-21"]');
      return k && k.querySelector(".aleta-t7-nomor") ? k : null;
    }, "kartu admin");
    expect(kartu.hasAttribute("data-s2-berikutnya")).toBe(false);
    expect(kartu.textContent).toContain("90/Pdt.G/2025/PA.Dgl");
    const op = buka({ simpanan: { ...UI, ujiFitur: { "sipp-21": true } }, peran: "Operator", jawab: jawabChecklist });
    const pnOp = await siapUi(op);
    await tunggu(400);
    expect(pnOp.querySelector("[data-s2-berikutnya]")).toBeNull();
  });
});

// ============================================================================
// 19 Okt 2026 (panel penetapan 2, butir 7-8 dan 10): bagian "Upload edoc
// penetapan" DIHAPUS. Unggah otomatis dari ABT pindah ke tombol "e-Doc" di tiap
// baris kartu Penetapan (dijaga ekstensi-penetapan-mulus-2); yang tersisa di
// sini bagian BARU "Edoc penetapan (PMH/PPP/PJS/PHS) manual". Passphrase TTE
// dihapus dari panel dan tidak dikirim. Uji lama atas centang + passphrase
// diganti uji atas bagian manual tanpa passphrase.
describe("butir 17 (19 Okt): Edoc penetapan (PMH/PPP/PJS/PHS) manual", () => {
  const PETA = {
    jenis: [
      { jenis: "PMH", tersedia: true },
      { jenis: "PHS", tersedia: true, sudahDiunggah: true, terakhirDiunggah: "2026-10-05 09:12:00" },
    ],
  };
  const jawabEdoc = (unggah?: (badan: unknown) => Jawab) => (url: string, cara: string, badan: unknown): Jawab => {
    if (url.includes("/penetapan-edoc/peta?")) return { isi: { ok: true, data: PETA } };
    if (url.includes("/penetapan-edoc/unggah") && cara === "POST") {
      return unggah ? unggah(badan) : { isi: { ok: true, data: { ok: true, berkas: [{ jenis: "PMH", ok: true }] } } };
    }
    return null;
  };
  const bukaBagian = async (h: Halaman) => {
    const pn = await siapUi(h);
    const kotak = bagianDi(pn, "s2EdocPenetapanManual");
    expect(kotak).not.toBeNull();
    (kotak.querySelector(".aleta-bagian-judul") as HTMLButtonElement).click();
    return { pn, kotak };
  };

  it("di tab Penetapan; bagian lama 'Upload edoc penetapan' tidak ada; empat slot berkas; tanpa passphrase; keterangan tanda tangan bertaut", async () => {
    const h = buka({ simpanan: UI, jawab: jawabEdoc() });
    const { pn, kotak } = await bukaBagian(h);
    expect(kotak.closest(".aleta-kelompok").dataset.kunci).toBe("kerjakan");
    expect(bagianDi(pn, "s2EdocPenetapan")).toBeNull();
    expect(Array.from(kotak.querySelectorAll("[data-s2-slot]")).map((x: any) => x.getAttribute("data-s2-slot"))).toEqual(["PMH", "PPP", "PJS", "PHS"]);
    expect(kotak.querySelector('[data-s2-slot="PJS"]').textContent).toContain("Penunjukan Juru Sita (PJS)");
    expect(kotak.querySelector('input[type="password"]')).toBeNull();
    expect(pn.textContent).not.toMatch(/passphrase/i);
    expect(kotak.querySelector(".aleta-t7-ttd-ket").textContent).toContain("Tanda tangan memakai gambar tanda tangan pejabat yang disahkan");
    expect(kotak.querySelector(".aleta-t7-ttd-ket a").getAttribute("href")).toContain("/aleta/admin/aleta-ecourt#ttd");
    // Bukan lagi lipatan yang disembunyikan saklar dobel 16 Okt - bagian yang diminta 19 Okt.
    expect(pn.querySelector('[data-s2-fitur="edoc-penetapan-manual"]')).toBeNull();
  });

  it("manual: berkas per jenis dikirim sebagai FormData (sumber manual) tanpa passphrase; batal = tidak ada POST", async () => {
    const h = buka({ simpanan: UI, jawab: jawabEdoc(() => ({ isi: { ok: true, data: { ok: true, berkas: [{ jenis: "PMH", ok: true }] } } })) });
    const { kotak } = await bukaBagian(h);
    h.w.alatSetelJedaSkala(0);
    const tombol = kotak.querySelector('[data-s2-edoc="manual"]') as HTMLButtonElement;
    expect(tombol.disabled).toBe(true);
    pilihBerkas(h.w, kotak.querySelector('[data-s2-slot="PMH"] input[type=file]'), [new h.w.File(["%PDF-1.7 pmh"], "PMH 450.pdf", { type: "application/pdf" })]);
    expect(tombol.disabled).toBe(false);
    tombol.click();
    await setujui(h.w, kotak, false);
    await tunggu(50);
    expect(h.minta.some((m) => m.url.includes("/penetapan-edoc/unggah"))).toBe(false);
    expect(kotak.textContent).toContain("Dibatalkan - tidak ada yang dikirim.");
    tombol.click();
    await setujui(h.w, kotak, true);
    const kirim = await sampai(() => h.minta.find((m) => m.url.includes("/penetapan-edoc/unggah") && m.cara === "POST"), "POST manual");
    const fd = kirim.badan as FormData;
    expect(fd.get("sumber")).toBe("manual");
    expect(fd.getAll("jenis")).toEqual(["PMH"]);
    expect((fd.get("berkas_PMH") as File).name).toBe("PMH 450.pdf");
    expect(fd.has("passphrase")).toBe(false);
    await sampai(() => /Penetapan Majelis Hakim: terunggah/.test(kotak.textContent || ""), "hasil manual");
  });

  it("butir 7: PHS sudah terupload - dialog berkata 'sudah terupload' dan 'yakin menimpa yang lama?'", async () => {
    const h = buka({ simpanan: UI, jawab: jawabEdoc() });
    const { kotak } = await bukaBagian(h);
    pilihBerkas(h.w, kotak.querySelector('[data-s2-slot="PHS"] input[type=file]'), [new h.w.File(["x"], "PHS.pdf")]);
    (kotak.querySelector('[data-s2-edoc="manual"]') as HTMLButtonElement).click();
    const kartu = await sampai(() => kotak.querySelector(".aleta-a30-tanya"), "konfirmasi tampil");
    expect(kartu.textContent).toContain("Penetapan Hari Sidang (PHS) sudah terupload di e-Doc SIPP");
    expect(kartu.textContent).toContain("yakin menimpa yang lama?");
    expect((kartu.querySelector(".aleta-a30-tanya-ya") as HTMLButtonElement).textContent).toContain("Ya, timpa yang lama");
    await setujui(h.w, kotak, false);
    await tunggu(50);
    expect(h.minta.some((m) => m.url.includes("/penetapan-edoc/unggah"))).toBe(false);
  });

  it("mode coba (tanpa izin tulis nyata) dan mode latihan: tidak ada POST sama sekali", async () => {
    for (const simpanan of [{ ujiTampilan: "ui" }, { ...UI, modeLatihan: true }]) {
      const h = buka({ simpanan, jawab: jawabEdoc() });
      const { kotak } = await bukaBagian(h);
      pilihBerkas(h.w, kotak.querySelector('[data-s2-slot="PMH"] input[type=file]'), [new h.w.File(["x"], "PMH.pdf")]);
      (kotak.querySelector('[data-s2-edoc="manual"]') as HTMLButtonElement).click();
      await setujui(h.w, kotak, true);
      await sampai(() => /ditahan mode (coba|latihan) - tidak ada yang dikirim/.test(kotak.textContent || ""), "ditahan disebut");
      expect(h.minta.some((m) => m.url.includes("/penetapan-edoc/unggah"))).toBe(false);
    }
  });

  it("rute belum ada (404): unggah berkata 'belum tersedia di server'", async () => {
    const h = buka({ simpanan: UI });
    const { kotak } = await bukaBagian(h);
    h.w.alatSetelJedaSkala(0);
    pilihBerkas(h.w, kotak.querySelector('[data-s2-slot="PMH"] input[type=file]'), [new h.w.File(["x"], "PMH.pdf")]);
    (kotak.querySelector('[data-s2-edoc="manual"]') as HTMLButtonElement).click();
    await setujui(h.w, kotak, true);
    await sampai(() => /belum tersedia di server - tidak ada yang dikirim/.test(kotak.textContent || ""), "404 unggah");
  });
});

// ============================================================================
describe("butir 3: putusan massal SIPP - blangko utama + pengecualian per perkara (UI Baru)", () => {
  const SIDANG = [
    { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", perkaraId: "1", jenisPerkara: "Cerai Gugat", agenda: "Pembacaan Putusan", ditunda: false, alasanDitunda: "Putus", majelisNama: "Munifa, S.H." },
    { nomorPerkara: "2/Pdt.G/2026/PA.Dgl", perkaraId: "2", jenisPerkara: "Cerai Talak", agenda: "Kesimpulan", ditunda: true, alasanDitunda: "Musyawarah Majelis", majelisNama: "Munifa, S.H." },
  ];
  const PETA_BLANGKO = {
    "cerai gugat": { blangko: "[01]", berkas: "Kabul Verstek CG.rtf", a: "tokenAAAAAAAA1", b: "tokenBBBBBBBB1", d: "" },
    "cerai talak": { blangko: "[02]", berkas: "Kabul CT.rtf", a: "tokenAAAAAAAA2", b: "tokenBBBBBBBB2", d: "" },
    "itsbat nikah": { blangko: "[05]", berkas: "Contra CG.rtf", a: "tokenAAAAAAAA3", b: "tokenBBBBBBBB3", d: "" },
  };
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
  const baris = (kotak: any, nomor: string) => kotak.querySelector(`[data-s2-blangko-nomor="${nomor}"]`);

  /** Menjalankan satu skenario untuk kedua kendali baris (R / cadangan sendiri). */
  const skenario = async (h: Halaman, kelasBaris: string) => {
    await siapUi(h);
    const kotak = await muatMassal(h);
    const utama = kotak.querySelector('[data-s2-fitur="blangko-utama"]');
    expect(utama).not.toBeNull();
    // Di atas daftar perkara.
    expect(utama.compareDocumentPosition(kotak.querySelector(".aleta-massal-daftar")) & h.w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const pilihUtama = utama.querySelector("select") as HTMLSelectElement;
    expect(Array.from(pilihUtama.options).map((o) => o.textContent)).toEqual([
      "menurut jenis perkara (pemetaan blangko)",
      "[05] — Contra CG.rtf",
      "[02] — Kabul CT.rtf",
      "[01] — Kabul Verstek CG.rtf",
    ]);
    const b1 = baris(kotak, "1/Pdt.G/2026/PA.Dgl");
    const b2 = baris(kotak, "2/Pdt.G/2026/PA.Dgl");
    expect(b1.classList.contains(kelasBaris)).toBe(true);
    expect(b1.textContent).toContain("Blangko utama: [01] — Kabul Verstek CG.rtf");
    expect(b2.textContent).toContain("Blangko utama: [02] — Kabul CT.rtf");

    // Blangko utama satu untuk semua.
    pilihUtama.value = pilihUtama.options[3].value;
    pilihUtama.dispatchEvent(new h.w.Event("change"));
    expect(b2.textContent).toContain("Blangko utama: [01] — Kabul Verstek CG.rtf");

    // Pengecualian perkara 1: tombol membuka pemilih, pilihan menang atas utama.
    const pilihBaris = b1.querySelector("select") as HTMLSelectElement;
    expect(pilihBaris.hidden).toBe(true);
    tombolBertulisan(b1, "Blangko berbeda…")!.click();
    expect(pilihBaris.hidden).toBe(false);
    pilihBaris.value = Array.from(pilihBaris.options).find((o) => /Contra/.test(o.textContent || ""))!.value;
    pilihBaris.dispatchEvent(new h.w.Event("change"));
    expect(b1.textContent).toContain("Blangko berbeda: [05] — Contra CG.rtf");
    expect(b1.getAttribute("data-keadaan")).toBe("beda");
    await tunggu(20);
    const tersimpan = h.simpanan.blangkoPutusanMassal as any;
    expect(Object.keys(tersimpan.perkara)).toEqual(["1/Pdt.G/2026/PA.Dgl"]);
    expect(tersimpan.perkara["1/Pdt.G/2026/PA.Dgl"].berkas).toBe("Contra CG.rtf");
    // Ganti utama: pengecualian tetap, baris yang mengikuti utama ikut berganti.
    pilihUtama.value = pilihUtama.options[2].value;
    pilihUtama.dispatchEvent(new h.w.Event("change"));
    expect(b1.textContent).toContain("Blangko berbeda: [05] — Contra CG.rtf");
    expect(b2.textContent).toContain("Blangko utama: [02] — Kabul CT.rtf");

    // Centang keduanya, susun antrean: blangko tiap butir ikut.
    for (const c of Array.from(kotak.querySelectorAll("input.aleta-massal-centang")) as HTMLInputElement[]) {
      if (!c.disabled) c.checked = true;
    }
    tombolBertulisan(kotak, "Susun antrean")!.click();
    const antrean = await sampai(() => h.simpanan.antreanPutusanMassal as any, "antrean disimpan");
    const per = Object.fromEntries(antrean.butir.map((x: any) => [x.nomor, x]));
    expect(per["1/Pdt.G/2026/PA.Dgl"].blangko).toMatchObject({ blangko: "[05]", berkas: "Contra CG.rtf", a: "tokenAAAAAAAA3" });
    expect(per["1/Pdt.G/2026/PA.Dgl"].blangkoPengecualian).toBe(true);
    expect(per["2/Pdt.G/2026/PA.Dgl"].blangko.berkas).toBe("Kabul CT.rtf");
    expect(per["2/Pdt.G/2026/PA.Dgl"].blangkoPengecualian).toBe(false);
    // Tidak ada yang ditulis ke SIPP/ABT oleh pilihan blangko.
    expect(h.minta.filter((m) => m.cara !== "GET")).toEqual([]);
  };

  it.runIf(ADA_BARIS_BLANGKO_R)("blangko utama di ATAS; tiap perkara lewat aletaMassalBarisBlangko (R): 'Blangko berbeda…' menang atas utama; pilihan ikut antrean", async () => {
    const h = buka({ simpanan: { ...UI, petaBlangkoPutusan: PETA_BLANGKO }, peran: "Hakim", nama: "Munifa", jawab: jawabMassal });
    expect(typeof h.w.aletaMassalBarisBlangko).toBe("function");
    await skenario(h, "aleta-massal-blangko-baris");
  });

  it("tanpa aletaMassalBarisBlangko: kendali baris cadangan berperilaku sama", async () => {
    const h = buka({
      simpanan: { ...UI, petaBlangkoPutusan: PETA_BLANGKO },
      peran: "Hakim",
      nama: "Munifa",
      jawab: jawabMassal,
      sesudah: (w) => {
        w.aletaMassalBarisBlangko = undefined;
      },
    });
    await skenario(h, "aleta-s2-blangko-baris");
  });

  it("Super Admin (per ketua majelis, opsi K3 R): kelompok milik akun ini terbuka, kelompok lain tertutup; kepala bertag Hakim", async () => {
    const SIDANG3 = [
      ...SIDANG,
      { nomorPerkara: "4/Pdt.G/2026/PA.Dgl", perkaraId: "4", jenisPerkara: "Cerai Gugat", agenda: "Pembacaan Putusan", ditunda: false, alasanDitunda: "Putus", majelisNama: "Rahmat Hidayat, S.H." },
    ];
    const h = buka({
      simpanan: { ...UI, petaBlangkoPutusan: PETA_BLANGKO },
      peran: "Super Admin",
      nama: "Munifa, S.H.",
      jawab: (url) =>
        url.includes("/aleta-ecourt/sidang?") && url.includes("dari=")
          ? { isi: { ok: true, data: { available: true, sidang: SIDANG3.map((s) => ({ ...s, tanggalSidang: hariIni() })) } } }
          : jawabMassal(url),
    });
    await siapUi(h);
    const kotak = await muatMassal(h);
    const kelompok = Array.from(kotak.querySelectorAll(".aleta-massal-kelompok[data-pengguna]")) as any[];
    expect(kelompok.length).toBe(2);
    const milik = kelompok.filter((k) => k.getAttribute("data-milik-saya") === "ya");
    expect(milik).toHaveLength(1);
    expect(milik[0].textContent).toContain("Munifa");
    expect(milik[0].getAttribute("data-terbuka")).toBe("ya");
    const lain = kelompok.find((k) => k !== milik[0]);
    expect(lain.getAttribute("data-terbuka")).toBe("tidak");
    for (const k of kelompok) expect(tagDi(k.querySelector(".aleta-lipat-kepala"))).toBe("Hakim");
  });

  it("tanpa pemetaan blangko: disebut jalan keluarnya; tombol pengecualian mati", async () => {
    const h = buka({ simpanan: UI, peran: "Hakim", nama: "Munifa", jawab: jawabMassal });
    await siapUi(h);
    const kotak = await muatMassal(h);
    expect(kotak.querySelector('[data-s2-fitur="blangko-utama"]').textContent).toContain("Belum ada pemetaan blangko");
    expect(tombolBertulisan(baris(kotak, "1/Pdt.G/2026/PA.Dgl"), "Blangko berbeda…")!.disabled).toBe(true);
  });

  it("Baru: tanpa blangko utama maupun kendali baris (seperti 1.177.0)", async () => {
    const h = buka({ simpanan: { ...BARU, petaBlangkoPutusan: PETA_BLANGKO }, peran: "Hakim", jawab: jawabMassal });
    await sampai(() => panelDari(h) && panelDari(h).getAttribute("data-t7-a30") === "baru", "panel Baru");
    const kotak = await muatMassal(h);
    expect(kotak.outerHTML).not.toMatch(/data-s2|aleta-s2-/);
  });
});

// ============================================================================
describe("butir 14 (dicabut 17 Okt): tekan/isi borang SIPP LANGSUNG tanpa jeda; tanpa jalur tulis SIPP baru", () => {
  const pasangPenyadap = (h: Halaman) => {
    const urutan: string[] = [];
    h.w.alatJedaManusia = async (jenis: string) => {
      urutan.push(`jeda:${jenis}`);
      return 0;
    };
    const pmLama = h.w.postMessage;
    h.w.postMessage = (data: any, asal: string) => {
      if (data && data.sumber === "aleta-jembatan") urutan.push(`jembatan:${data.jenis}`);
      return pmLama(data, asal);
    };
    return urutan;
  };

  it("UI Baru: tekan dan isi medan langsung - tidak satu pun jeda manusia diminta", async () => {
    const h = buka({ simpanan: UI });
    await siapUi(h);
    const urutan = pasangPenyadap(h);
    await h.w.kirimKeJembatan({ jenis: "tekan", penunjuk: "#simpan" });
    await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: "#amar", jenisMedan: "teks", nilai: "x" });
    expect(urutan).toEqual(["jembatan:tekan", "jembatan:nilai", "jembatan:isi"]);
  });

  it("17 Okt: bahkan dengan jeda manusia ASLI diperbesar 5x, tekan + isi selesai seketika (tidak ada timer jeda)", async () => {
    const h = buka({ simpanan: UI });
    await siapUi(h);
    h.w.alatSetelJedaSkala(5); // dulu: tekan >= 4,5 detik
    const mulai = Date.now();
    await h.w.kirimKeJembatan({ jenis: "tekan", penunjuk: "#simpan" });
    await h.w.kirimKeJembatan({ jenis: "isi", penunjuk: "#amar", jenisMedan: "teks", nilai: "x" });
    expect(Date.now() - mulai).toBeLessThan(1500);
  });

  it("Lama juga (perilaku tulis global, KONTRAK K1/K4)", async () => {
    const h = buka({});
    await sampai(() => panelDari(h) && panelDari(h).querySelector(".aleta-kelompok"), "panel Lama");
    const urutan = pasangPenyadap(h);
    await h.w.kirimKeJembatan({ jenis: "tekan", penunjuk: "#simpan" });
    expect(urutan).toEqual(["jembatan:tekan"]);
  });

  it("tekanan yang DITAHAN (mode coba) tidak menunggu dan tidak sampai ke jembatan", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui" } });
    await siapUi(h);
    const urutan = pasangPenyadap(h);
    const jawab = await h.w.kirimKeJembatan({ jenis: "tekan", penunjuk: "#simpan" });
    expect(jawab).toMatchObject({ ok: false, alasan: "mode_coba" });
    expect(urutan).toEqual([]);
  });

  it("blok S2: tidak ada pesan jembatan sendiri, tidak ada postMessage, non-GET hanya ke rute unggah edoc penetapan (ALETA, bukan SIPP)", () => {
    const konten = KONTEN();
    // Disesuaikan 5 Okt: blok S2 berhenti di awal blok 5 Okt (tab PTSP), yang
    // punya penjaganya sendiri di ekstensi-ptsp-5okt.test.ts.
    const awal = konten.indexOf("PERBAIKAN 2 OKTOBER 2026 - PANEL SIPP");
    const akhir = konten.indexOf("PERBAIKAN 5 OKTOBER 2026 - TAB PTSP", awal);
    const blok = konten.slice(awal, akhir > awal ? akhir : undefined);
    expect(blok.length).toBeGreaterThan(5000);
    expect(blok).not.toMatch(/kirimKeJembatan(?:Langsung)?\(/);
    expect(blok).not.toMatch(/postMessage\(/);
    expect((blok.match(/method:\s*"[A-Z]+"/g) || [])).toEqual(['method: "POST"']);
    expect(blok).toContain('const S2_API_EDOC_UNGGAH = "/aleta/api/aleta-ecourt/penetapan-edoc/unggah";');
    // Tidak ada penanda ALETA yang dibawa ke isian/elemen SIPP: S2 tidak
    // menyentuh borang SIPP sama sekali (hanya membaca #frm_data_umum).
    expect(blok.match(/document\.querySelector\(([^)]*)\)/g) || []).toEqual(['document.querySelector("#frm_data_umum")']);
    expect(blok).not.toMatch(/insertAdjacent|document\.body\.append/);
  });
});

// ============================================================================
describe("butir 11 (W) sisi SIPP: klik 2x sudut juga untuk panel berlabuh kanan", () => {
  it("s2PindahKeSudut melepas labuh, memindah ke sudut, menyimpan lewat simpanKeadaanPanel; ↺ bawaan berlabuh lagi", async () => {
    const h = buka({ simpanan: UI });
    const pn = await siapUi(h);
    const akar = h.d.documentElement;
    await sampai(() => akar.getAttribute("data-aleta-sipp-labuh") === "kanan", "panel berlabuh");
    const hasil = polos(h.w.s2PindahKeSudut(pn, "ki-bw"));
    expect(hasil).toMatchObject({ kiri: expect.any(Number), atas: expect.any(Number) });
    expect(akar.hasAttribute("data-aleta-sipp-labuh")).toBe(false);
    expect(pn.style.left).toBe(`${hasil.kiri}px`);
    await tunggu(20);
    expect(h.simpanan.posisiPanelSipp ?? Object.values(h.simpanan).find((v: any) => v && v.lepasLabuh)).toMatchObject({ lepasLabuh: true, kiri: hasil.kiri, atas: hasil.atas });
    // Penataan ulang tidak memasang labuh lagi selama dilepas.
    h.w.t7TerapkanLabuh();
    expect(akar.hasAttribute("data-aleta-sipp-labuh")).toBe(false);
    // ↺ kembali ke bawaan: berlabuh lagi.
    h.w.kembalikanBawaan(pn);
    expect(akar.getAttribute("data-aleta-sipp-labuh")).toBe("kanan");
  });
});
