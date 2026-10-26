// @vitest-environment node
/**
 * ============================================================================
 * 26 OKT 2026 - BLANGKO ABT BY DERRY BRIANTONO: KONSEP SEMENTARA (tunjuk konseptor di Jadwal Sidang)
 * ============================================================================
 *
 * "Konsep sementara" = perkara yang di Jadwal Sidang ALETA diberi "tunjuk konseptor" (tabel aleta_konseptor_sementara).
 * blangko-derry.js dijalankan SUNGGUHAN di jsdom di atas panel-alat.js (ABT dan portal ditiru di fetch; peta tunjukan dihitung oleh
 * fungsi portal yang SAMA - petakanKonsepSementara - sehingga uji ini juga menjaga aturan "Lihat sebagai").
 *
 *   1  konsep sementara paling atas di Kartu, Daftar ringkas, Tabel detail, dan kelompok khusus di Per tanggal sidang;
 *      urutan pilihan pengguna berlaku di dalam masing-masing kelompok; lencana + nama konseptor;
 *   2  toggle "Tampilkan konsep sementara": bawaan nyala, mati menyembunyikan (jumlahnya disebut jujur), nyala menampilkan, diingat;
 *   3  "Lihat sebagai": akun terpilih = tunjukan akun itu; "Semua akun" = semua tunjukan (aturan portal, petakanKonsepSementara);
 *   4  tunjukan yang berubah ikut berubah pada muat/segar berikutnya (tanpa polling baru); portal membaca tabel yang sama;
 *   5  tidak satu permintaan pun selain GET; tidak satu kata "Aleta" di teks yang menuju ABT/SIPP.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { milikAkunKonsep, petakanKonsepSementara } from "@/lib/konsep-sementara-panel";
import type { KonseptorSementara } from "@/lib/konseptor-sementara";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-saksi.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");
const CSS = baca("blangko-derry.css");

const ASAL = "http://192.168.10.10";
const BERANDA = `${ASAL}/aps_badilag/index.php/abt/main/beranda`;
const HARI_INI = "2026-10-06";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 6000): Promise<NonNullable<T>> {
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
    await tunggu(5);
  }
}

// ----------------------------------------------------------------------------
// Bahan
// ----------------------------------------------------------------------------
const SI = (tanggal: string, agenda: string, ket = "", urutan = 1) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan, hadir: null, adaBas: null, ruangan: "" });
const PK = (nomor: string, jenis: string, sidang: unknown[], extra: Record<string, unknown> = {}) => ({
  nomorPerkara: `${nomor}/PA.Dgl`, perkaraId: String(nomor.split("/")[0]), jenisPerkara: jenis, alurPerkaraId: nomor.includes("Pdt.P") ? 16 : 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: true, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim"], pihak: { penggugat: ["Penggugat Satu"], tergugat: ["Tergugat Satu"] }, sidang, ...extra,
});
const N_A = "225/Pdt.P/2026/PA.Dgl"; // bukan konsep
const N_B = "228/Pdt.P/2026/PA.Dgl"; // bukan konsep
const N_C = "581/Pdt.G/2026/PA.Dgl"; // konsep: Hakim Satu
const N_D = "590/Pdt.G/2026/PA.Dgl"; // konsep: PP Satu, sidang 2 hari lagi
const N_E = "700/Pdt.G/2026/PA.Dgl"; // konsep: Hakim Satu, tetapi selesai (putusan sudah terunggah)
const DAFTAR = [
  PK("225/Pdt.P/2026", "Pengesahan Perkawinan/Istbat Nikah", [SI("2026-09-29", "Sidang Pertama", "", 1), SI(HARI_INI, "Musyawarah majelis", "putus DIKABULKAN", 2)]),
  PK("228/Pdt.P/2026", "Pengesahan Perkawinan/Istbat Nikah", [SI(HARI_INI, "Pembuktian", "", 1)]),
  PK("581/Pdt.G/2026", "Cerai Gugat", [SI(HARI_INI, "Pembuktian Penggugat", "", 2)]),
  PK("590/Pdt.G/2026", "Cerai Talak", [SI("2026-10-08", "Sidang Pertama", "", 1)]),
  PK("700/Pdt.G/2026", "Cerai Talak", [SI(HARI_INI, "Pembacaan putusan", "putus DIKABULKAN", 2)], { sudahPutus: true, tanggalPutusan: HARI_INI, adaBerkasPutusan: true }),
];
const tunjukan = (perkaraId: string, nama: string, pengguna = ""): KonseptorSementara => ({ perkaraId, nomorPerkara: "", nama, pengguna, catatan: "", ditetapkanOleh: "Panitera Uji", ditetapkanAt: "2026-10-05T10:00:00Z" });
const TUNJUKAN_AWAL = (): Record<string, KonseptorSementara> => ({
  "581": tunjukan("581", "Hakim Satu"),
  "590": tunjukan("590", "PP Satu"),
  "700": tunjukan("700", "Hakim Satu"),
});
const AKUN = { hakim: ["Hakim Satu"], pp: ["PP Satu"], js: ["JS Satu"] };
type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};
const MENU = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${BERANDA}?a=D1&c=" title="(1 Blangko)">CG - Putusan</a></div>`;

type Minta = { url: string; cara: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; tunjukan: Record<string, KonseptorSementara>; jam: { geser: number } };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; tanpaKolomKonsep?: boolean } = {}): Halaman {
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> ${p.orang === "admin" ? "Administrator" : "Panitera"}</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_m: unknown, cb?: (h: unknown) => void) => cb && cb({ ok: true, id: 1 }), lastError: undefined },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
          setTimeout(() => pendengar.forEach((f) => f({}, "local")), 0);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Minta[] = [];
  const orang = ORANG[p.orang ?? "hakim"];
  const admin = p.orang === "admin";
  const peta = TUNJUKAN_AWAL();
  const jam = { geser: 0 };
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push({ url, cara });
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const q = new URL(url, ASAL).searchParams;
      const sebagaiNama = admin ? (q.get("sebagai") || "").trim() : "";
      // Meniru rute portal: tunjukan dibaca tiap muat dan dipetakan oleh fungsi yang SAMA dengan rute.
      const konsep = petakanKonsepSementara(peta, { semua: admin && !sebagaiNama, sebagaiNama, usernames: [], nama: [orang.nama] });
      const perkara = polos(DAFTAR).map((x) => (konsep[x.perkaraId] && !p.tanpaKolomKonsep ? { ...x, konsepSementara: konsep[x.perkaraId] } : x));
      return json({ ok: true, data: { hariIni: HARI_INI, mode: q.get("mode") || "hari", dari: q.get("dari") || HARI_INI, sampai: q.get("sampai") || HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama, sebagaiPeran: null, terpotong: false, jumlahSemua: perkara.length, adaYangCocok: true, akun: admin ? AKUN : null, perkara } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: false }, 404);
    if (url.includes("/aleta-ecourt/blangko-derry")) return json({ ok: true, data: { ada: false, folder: [], sebab: "uji" } });
    if (url === BERANDA) return html(`<div id="navbar">${MENU}</div>`);
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  const asli = w.Date.now.bind(w.Date);
  w.Date.now = () => asli() + jam.geser;
  return { dom, w, simpanan, minta, tunjukan: peta, jam };
}

const D_ = (h: Halaman) => h.w.document as Document;
const akar = (h: Halaman) => D_(h).getElementById("aleta-bd-akar") as HTMLElement;
const q = (h: Halaman, s: string) => akar(h).querySelector(s) as HTMLElement | null;
const qq = (h: Halaman, s: string) => Array.from(akar(h).querySelectorAll(s)) as HTMLElement[];
const klik = (h: Halaman, s: string) => {
  const el = q(h, s);
  if (!el) throw new Error(`tidak ada: ${s}`);
  el.click();
};
const ubah = (h: Halaman, el: HTMLInputElement | HTMLSelectElement, nilai: string | boolean) => {
  if (typeof nilai === "boolean") (el as HTMLInputElement).checked = nilai;
  else el.value = nilai;
  el.dispatchEvent(new h.w.Event("change", { bubbles: true }));
};
const nomorDaftar = (h: Halaman) => qq(h, "[data-pk]").map((e) => e.getAttribute("data-pk"));
const nomorKonsep = (h: Halaman) => qq(h, "[data-pk]").filter((e) => e.querySelector("[data-konsep]")).map((e) => e.getAttribute("data-pk"));
const toggle = (h: Halaman) => q(h, "#bd-konsep") as HTMLInputElement;

async function bukaDaftar(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar perkara");
}
const lihat = async (h: Halaman, cara: "kartu" | "ringkas" | "tabel" | "tanggal") => {
  klik(h, `[data-lihat="${cara}"]`);
  await sampai(() => q(h, "[data-pk]") && q(h, `[data-lihat="${cara}"][aria-selected="true"]`), `tampilan ${cara}`);
};

// ============================================================================
describe("1. Konsep sementara paling atas di semua tampilan", () => {
  it("Kartu: konsep sementara (581, 590) di atas, lalu yang lain; lencana memuat nama konseptor; yang selesai (700) tersembunyi bawaan", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    const urut = nomorDaftar(h);
    expect(urut.slice(0, 2).sort()).toEqual([N_C, N_D].sort());
    expect(urut.slice(2).sort()).toEqual([N_A, N_B].sort());
    expect(urut).not.toContain(N_E);
    expect(nomorKonsep(h).sort()).toEqual([N_C, N_D].sort());
    const lencana = q(h, `[data-pk="${N_C}"] [data-konsep]`)!;
    expect(lencana.textContent).toContain("Konsep sementara");
    expect(lencana.textContent).toContain("Hakim Satu");
    expect(q(h, `[data-pk="${N_D}"] [data-konsep]`)!.textContent).toContain("PP Satu");
    expect(q(h, `[data-pk="${N_A}"] [data-konsep]`)).toBeNull();
  });

  it("urutan pilihan pengguna berlaku DI DALAM kelompok: nomor naik -> 581 sebelum 590, 225 sebelum 228; konsep tetap di atas", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    ubah(h, q(h, "#bd-urut") as HTMLSelectElement, "nomor");
    await sampai(() => (q(h, "#bd-urut") as HTMLSelectElement).value === "nomor", "urut nomor");
    const cekUrut = () => {
      const naik = /naik/.test(q(h, '[data-bd="arah"]')!.textContent || "");
      const urut = nomorDaftar(h);
      // konsep di atas (menurut nomor di arah terpilih), baru yang lain menurut nomor di arah yang sama
      expect(urut.slice(0, 2)).toEqual(naik ? [N_C, N_D] : [N_D, N_C]);
      expect(urut.slice(2)).toEqual(naik ? [N_A, N_B] : [N_B, N_A]);
      return naik;
    };
    const awal = cekUrut();
    klik(h, '[data-bd="arah"]');
    await sampai(() => /naik/.test(q(h, '[data-bd="arah"]')!.textContent || "") !== awal, "arah terbalik");
    expect(cekUrut()).toBe(!awal);
  });

  it("Daftar ringkas: konsep sementara di atas dan berlencana", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    await lihat(h, "ringkas");
    expect(qq(h, ".bd-brs").length).toBe(4);
    expect(nomorDaftar(h).slice(0, 2).sort()).toEqual([N_C, N_D].sort());
    expect(nomorKonsep(h).sort()).toEqual([N_C, N_D].sort());
    expect(q(h, `.bd-brs[data-pk="${N_C}"]`)!.className).toContain("konsep");
  });

  it("Tabel detail: konsep sementara di atas dan berlencana di kolom Nomor perkara", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    await lihat(h, "tabel");
    expect(qq(h, "tr[data-pk]").length).toBe(4);
    expect(nomorDaftar(h).slice(0, 2).sort()).toEqual([N_C, N_D].sort());
    expect(q(h, `tr[data-pk="${N_C}"] td [data-konsep]`)!.textContent).toContain("Hakim Satu");
    expect(q(h, `tr[data-pk="${N_C}"]`)!.className).toContain("konsep");
  });

  it("Per tanggal sidang: kelompok khusus 'Konsep sementara' paling atas (tanggal tampil di tiap baris); kelompok tanggal memuat sisanya", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    await lihat(h, "tanggal");
    const grup = qq(h, ".bd-grupT");
    expect(grup[0].hasAttribute("data-grup-konsep")).toBe(true);
    expect(grup[0].textContent).toContain("Konsep sementara");
    const dalam = Array.from(grup[0].querySelectorAll("[data-pk]")).map((e) => e.getAttribute("data-pk"));
    expect(dalam.sort()).toEqual([N_C, N_D].sort());
    // sidang 590 tanggal 8 Okt, 581 tanggal 6 Okt: tanggal disebut di barisnya
    expect(grup[0].querySelector(`[data-pk="${N_D}"]`)!.textContent).toContain("8 Okt 2026");
    const lain = grup.slice(1).flatMap((g) => Array.from(g.querySelectorAll("[data-pk]")).map((e) => e.getAttribute("data-pk")));
    expect(lain.sort()).toEqual([N_A, N_B].sort());
    expect(grup.slice(1).every((g) => !g.hasAttribute("data-grup-konsep"))).toBe(true);
  });

  it("lencana terbaca di tema terang dan gelap: memakai token warna, huruf >= 11,5px", () => {
    const aturan = CSS.split("\n").filter((b) => /\.bd-konsep\b/.test(b)).join("\n");
    expect(aturan).toMatch(/font-size:\s*(1[2-9]|11\.5)/);
    expect(aturan).toContain("var(--accent)");
    expect(aturan).toContain("var(--accentbg)");
    expect(aturan).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    // token itu didefinisikan ulang di tema terang
    expect(CSS).toMatch(/\[data-tema="terang"\][^{]*\{[^}]*--accent:/);
    expect(CSS).toMatch(/#aleta-bd-akar, #aleta-bd-tawar \{[^}]*--accent:/);
  });
});

describe("2. Toggle 'Tampilkan konsep sementara'", () => {
  it("ada di baris kendali (sesudah 'Sembunyikan yang selesai'), BAWAAN NYALA, label memuat jumlahnya", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    const kotak = toggle(h);
    expect(kotak.checked).toBe(true);
    expect(kotak.parentElement!.textContent).toContain("Tampilkan konsep sementara (2)");
    const sembunyi = q(h, "#bd-sembunyi")!;
    expect(sembunyi.parentElement!.nextElementSibling).toBe(kotak.parentElement);
    expect(q(h, "#bd-depan")!.parentElement!.parentElement).toBe(kotak.parentElement!.parentElement);
  });

  it("mati: perkara konsep sementara hilang dari daftar dan jumlahnya disebut jujur; nyala: kembali di atas; pilihan diingat", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    ubah(h, toggle(h), false);
    await sampai(() => !nomorDaftar(h).includes(N_C), "konsep disembunyikan");
    expect(nomorDaftar(h).sort()).toEqual([N_A, N_B].sort());
    expect(nomorKonsep(h)).toEqual([]);
    expect(q(h, "#bd-ketkonsep")!.textContent).toContain("2 perkara konsep sementara disembunyikan");
    expect((h.simpanan.blangkoDerryDaftar as { konsep?: boolean }).konsep).toBe(false);
    ubah(h, toggle(h), true);
    await sampai(() => nomorDaftar(h).includes(N_C), "konsep tampil lagi");
    expect(nomorDaftar(h).slice(0, 2).sort()).toEqual([N_C, N_D].sort());
    expect((h.simpanan.blangkoDerryDaftar as { konsep?: boolean }).konsep).toBe(true);
  });

  it("mati juga menyembunyikan di Tabel detail dan Per tanggal sidang (tanpa kelompok khusus)", async () => {
    const h = buka({ orang: "admin", simpanan: { blangkoDerryDaftar: { konsep: false, lihat: "tanggal" } } });
    await bukaDaftar(h);
    expect(qq(h, "[data-grup-konsep]").length).toBe(0);
    expect(nomorDaftar(h).sort()).toEqual([N_A, N_B].sort());
    await lihat(h, "tabel");
    expect(nomorDaftar(h).sort()).toEqual([N_A, N_B].sort());
  });

  it("pilihan tersimpan dibaca di kunjungan berikutnya (mati tetap mati); nilai bukan boolean diabaikan -> bawaan nyala; setelan lain tidak berubah", async () => {
    const h = buka({ orang: "admin", simpanan: { blangkoDerryDaftar: { konsep: false, sembunyi: false, lihat: "ringkas" } } });
    await bukaDaftar(h);
    expect(toggle(h).checked).toBe(false);
    expect((q(h, "#bd-sembunyi") as HTMLInputElement).checked).toBe(false);
    expect(qq(h, ".bd-brs").length).toBe(2); // 225 dan 228; 581, 590, 700 konsep sementara disembunyikan toggle (700 juga selesai tetapi sembunyi=false)
    expect(nomorDaftar(h)).not.toContain(N_C);
    ubah(h, toggle(h), true);
    await sampai(() => nomorDaftar(h).includes(N_C), "nyala");
    const tersimpan = h.simpanan.blangkoDerryDaftar as { konsep?: boolean; sembunyi?: boolean; lihat?: string };
    expect(tersimpan.sembunyi).toBe(false); // setelan pengguna lain tidak ikut berubah
    expect(tersimpan.lihat).toBe("ringkas");
    const h2 = buka({ orang: "admin", simpanan: { blangkoDerryDaftar: { konsep: "tidak" } } });
    await bukaDaftar(h2);
    expect(toggle(h2).checked).toBe(true);
  });

  it("semua perkara konsep sementara dimatikan dan daftar kosong: kalimat jujur + tombol Tampilkan konsep sementara", async () => {
    const h = buka({ orang: "admin", simpanan: { blangkoDerryDaftar: { konsep: false } } });
    await bukaDaftar(h);
    // sisa daftar (225, 228) masih ada; ubah ke 'Sembunyikan' tidak relevan. Kosongkan lewat pencarian atas konsep saja:
    ubah(h, q(h, "#bd-cari") as HTMLInputElement, "590");
    (q(h, "#bd-cari") as HTMLInputElement).dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => q(h, '[data-bd="tampil-konsep"]'), "kalimat konsep disembunyikan");
    expect(q(h, ".bd-catat")!.textContent).toContain("1 perkara konsep sementara pada daftar ini disembunyikan");
    klik(h, '[data-bd="tampil-konsep"]');
    await sampai(() => nomorDaftar(h).includes(N_D), "konsep tampil");
    expect(toggle(h).checked).toBe(true);
  });
});

describe("3. 'Lihat sebagai' menyaring", () => {
  it("Semua akun (admin tanpa Lihat sebagai): semua tunjukan; memilih Hakim Satu: hanya miliknya; memilih PP Satu: hanya miliknya", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    expect(nomorKonsep(h).sort()).toEqual([N_C, N_D].sort());

    ubah(h, q(h, "#bd-lihat") as HTMLSelectElement, "hakim|Hakim Satu");
    await sampai(() => h.minta.some((m) => m.url.includes("sebagai=Hakim+Satu")) && (q(h, "#bd-siapa")?.textContent || "").includes("Hakim Satu") && q(h, "[data-pk]"), "sebagai hakim");
    expect(nomorKonsep(h)).toEqual([N_C]);
    expect(nomorDaftar(h)[0]).toBe(N_C);
    expect(q(h, `[data-pk="${N_D}"] [data-konsep]`)).toBeNull(); // tunjukan milik PP Satu, bukan akun ini

    ubah(h, q(h, "#bd-lihat") as HTMLSelectElement, "pp|PP Satu");
    await sampai(() => h.minta.some((m) => m.url.includes("sebagai=PP+Satu")) && (q(h, "#bd-siapa")?.textContent || "").includes("PP Satu") && q(h, "[data-pk]"), "sebagai PP");
    expect(nomorKonsep(h)).toEqual([N_D]);
    expect(nomorDaftar(h)[0]).toBe(N_D);

    ubah(h, q(h, "#bd-lihat") as HTMLSelectElement, "");
    await sampai(() => (q(h, "#bd-siapa")?.textContent || "").includes("Super Admin") || nomorKonsep(h).length === 2, "kembali ke semua akun");
    expect(nomorKonsep(h).sort()).toEqual([N_C, N_D].sort());
  });

  it("pengguna biasa (hakim): hanya tunjukan atas namanya yang jadi konsep sementara", async () => {
    const h = buka({ orang: "hakim" });
    await bukaDaftar(h);
    expect(nomorKonsep(h)).toEqual([N_C]);
    expect(nomorDaftar(h)[0]).toBe(N_C);
  });

  it("aturan portal: nama dengan gelar tetap cocok; username SIPP orang lain tidak pernah cocok lewat nama; tanpa nama bukan konsep", () => {
    const acuan = { semua: false, usernames: ["fikri"], nama: ["Hakim Satu"] };
    expect(milikAkunKonsep({ nama: "Drs. H. Hakim Satu, S.H., M.H.", pengguna: "" }, acuan)).toBe(true);
    expect(milikAkunKonsep({ nama: "Hakim Satu", pengguna: "munifa" }, acuan)).toBe(false);
    expect(milikAkunKonsep({ nama: "Hakim Satu", pengguna: "FIKRI" }, acuan)).toBe(true);
    expect(milikAkunKonsep({ nama: "", pengguna: "" }, { semua: true })).toBe(false);
    expect(milikAkunKonsep({ nama: "Siapa Saja", pengguna: "" }, { semua: true })).toBe(true);
    expect(milikAkunKonsep({ nama: "Hakim Dua", pengguna: "" }, { semua: false, sebagaiNama: "Hakim Satu" })).toBe(false);
    expect(milikAkunKonsep({ nama: "Hakim Satu, S.H.", pengguna: "" }, { semua: false, sebagaiNama: "Hakim Satu" })).toBe(true);
    const peta = petakanKonsepSementara({ "1": tunjukan("1", "A"), "2": tunjukan("2", "") }, { semua: true });
    expect(Object.keys(peta)).toEqual(["1"]);
    expect(peta["1"]).toMatchObject({ nama: "A", milikAkun: true, ditetapkanOleh: "Panitera Uji" });
  });
});

describe("4. Sinkron dengan Jadwal Sidang", () => {
  it("tunjukan yang berubah di portal ikut berubah pada muat berikutnya (singgahan 45 dtk habis), tanpa polling", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    expect(nomorKonsep(h).sort()).toEqual([N_C, N_D].sort());
    const sebelum = h.minta.filter((m) => m.url.includes("perkara-saya")).length;
    await tunggu(150);
    expect(h.minta.filter((m) => m.url.includes("perkara-saya")).length).toBe(sebelum); // tidak ada polling baru

    h.tunjukan["228"] = tunjukan("228", "Hakim Dua"); // ditunjuk di Jadwal Sidang
    delete h.tunjukan["590"]; // tunjukan dicabut/diganti
    h.jam.geser = 60_000; // singgahan daftar habis
    klik(h, '[data-mode="semua"]');
    await sampai(() => q(h, "[data-pk]") && nomorKonsep(h).includes(N_B), "muat ulang");
    expect(nomorKonsep(h).sort()).toEqual([N_B, N_C].sort());
    expect(q(h, `[data-pk="${N_B}"] [data-konsep]`)!.textContent).toContain("Hakim Dua");
    expect(nomorDaftar(h).slice(0, 2).sort()).toEqual([N_B, N_C].sort());
  });

  it("bot/portal lama tanpa penanda: daftar tampil seperti biasa, tanpa lencana, tanpa galat", async () => {
    const h = buka({ orang: "admin", tanpaKolomKonsep: true });
    await bukaDaftar(h);
    expect(nomorKonsep(h)).toEqual([]);
    expect(nomorDaftar(h)).toHaveLength(4);
    expect(toggle(h).parentElement!.textContent).not.toContain("(");
  });
});

describe("5. Hanya baca; tidak ada tanda ALETA ke ABT/SIPP; sumber portal sama dengan Jadwal Sidang", () => {
  it("memuat dan memakai toggle hanya melahirkan permintaan GET", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    ubah(h, toggle(h), false);
    ubah(h, toggle(h), true);
    await tunggu(30);
    expect(h.minta.every((m) => m.cara === "GET")).toBe(true);
  });

  it("rute perkara-saya membaca tabel yang sama dengan tombol 'tunjuk konseptor' (aleta_konseptor_sementara), tanpa menulis", () => {
    const rute = readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-ecourt/perkara-saya/route.ts"), "utf8");
    expect(rute).toContain("bacaKonseptorSementara");
    expect(rute).toContain("petakanKonsepSementara");
    expect(rute).not.toMatch(/simpanKonseptorSementara|INSERT|UPDATE|DELETE/);
    const tombol = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");
    expect(tombol).toContain("/api/aleta-ecourt/konseptor-sementara");
    const modul = readFileSync(path.resolve(process.cwd(), "src/server/modules/aleta-ecourt/konseptor-sementara.ts"), "utf8");
    expect(modul).toContain("aleta_konseptor_sementara");
  });

  it("kode ekstensi yang baru tidak menulis kata 'Aleta' ke teks tampilan di ABT/SIPP (hanya label panel)", () => {
    const js = baca("blangko-derry.js");
    const dari = js.indexOf("function konsepDari");
    expect(dari).toBeGreaterThan(0);
    const potongan = [js.slice(dari, js.indexOf("const TEKS_TINGKAT")), js.slice(js.indexOf("const chipKonsep"), js.indexOf("const chipAlasan")), js.slice(js.indexOf("function grupKonsep"), js.indexOf("function teksKosong"))].join("\n");
    expect(potongan.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")).not.toMatch(/aleta/i);
  });
});
