// @vitest-environment node
/**
 * ============================================================================
 * 22 OKT 2026 - BLANGKO ABT BY DERRY BRIANTONO: TANGGAL TERTENTU, SARAN PER TAB, KATEGORI COCOK DI ATAS, GULIR, KOLOM PERKARA, SEMBUNYI SELESAI
 * ============================================================================
 *
 * blangko-derry.js + blangko-derry-isian.js dijalankan SUNGGUHAN di jsdom di atas panel-alat.js (ABT dan portal ditiru di fetch).
 * Yang dijaga adalah PERILAKU layar:
 *   4  "Tanggal tertentu": satu tanggal saja (mode tersendiri), "Rentang tanggal" tetap DARI-SAMPAI;
 *   5  Semua akun (Super Admin tanpa "Lihat sebagai"): tanpa saran di langkah 2; "Disarankan" di jendela Pilih blangko mengikuti TAB;
 *   6  kategori yang cocok dengan jenis perkara terpilih naik ke atas daftar kiri (tepat di bawah Disarankan);
 *   7  gulir daftar kiri/kanan tidak melompat ke atas saat jendela digambar ulang; butir terpilih tetap terlihat dan bersorot;
 *   8  "Sidang ke-N · agenda sidang" di kolom Perkara (kartu, daftar ringkas, tabel detail);
 *   9  "Sembunyikan yang selesai" bawaan tercentang, diingat, jumlah yang tersembunyi disebut jujur.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-saksi.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
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
const ITSBAT = "Pengesahan Perkawinan/Istbat Nikah";
const N_ITSBAT = "225/Pdt.P/2026/PA.Dgl";
const N_ITSBAT_2 = "228/Pdt.P/2026/PA.Dgl";
const N_CG = "581/Pdt.G/2026/PA.Dgl";
const N_CT_SELESAI = "700/Pdt.G/2026/PA.Dgl";
const DAFTAR_LENGKAP = [
  PK("225/Pdt.P/2026", ITSBAT, [SI("2026-09-22", "Sidang Pertama", "Panggil Pemohon", 1), SI("2026-09-29", "Pembuktian", "", 2), SI(HARI_INI, "Musyawarah majelis", "putus DIKABULKAN", 3)]),
  PK("228/Pdt.P/2026", ITSBAT, [SI("2026-09-29", "Sidang Pertama", "Panggil Pemohon", 1), SI(HARI_INI, "Pembuktian", "", 2)]),
  PK("581/Pdt.G/2026", "Cerai Gugat", [SI(HARI_INI, "Pembuktian Penggugat", "", 2)]),
  PK("700/Pdt.G/2026", "Cerai Talak", [SI(HARI_INI, "Pembacaan putusan", "putus DIKABULKAN", 2)], { sudahPutus: true, tanggalPutusan: HARI_INI, adaBerkasPutusan: true }),
];
const AKUN = { hakim: ["Hakim Satu"], pp: ["PP Satu"], js: ["JS Satu"] };
type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};

const B_CG = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const B_CT = "[01] [Kabul] CT";
const B_IN = "[01] [Kabul] IN";
const B_BAS_CG = "BAS ALUR 02 [1] BAS 1 uji";
const B_BAS_IN = "BAS ALUR 02 [2] BAS 2 Itsbat";
const MENU = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel">` +
  [["CG - Putusan", "D1"], ["CT - Putusan", "D2"], ["Itsbat - Putusan", "D3"], ["CG - BAS", "D4"], ["Itsbat - BAS", "D5"], ["Relaas dan PBT", "D6"]]
    .map(([n, a]) => `<a href="${BERANDA}?a=${a}&c=" title="(1 Blangko)">${n}</a>`)
    .join("") +
  `</div>`;
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");
const HALAMAN: Record<string, string> = {
  D1: HAL_KELOMPOK("Cerai Gugat - Putusan", [[B_CG, "A01", "B01"]]),
  D2: HAL_KELOMPOK("Cerai Talak - Putusan", [[B_CT, "A02", "B02"]]),
  D3: HAL_KELOMPOK("Itsbat Nikah - Putusan", [[B_IN, "A03", "B03"]]),
  D4: HAL_KELOMPOK("Cerai Gugat - BAS", [[B_BAS_CG, "A04", "B04"]]),
  D5: HAL_KELOMPOK("Itsbat Nikah - BAS", [[B_BAS_IN, "A05", "B05"]]),
  D6: HAL_KELOMPOK("Relaas dan Pemberitahuan Putusan", [["Relaas uji", "A06", "B06"]]),
};

type Minta = { url: string; cara: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; gulirKe: Array<{ id: string; opsi: unknown }> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; daftar?: unknown[]; tanpaRekomendasi?: boolean } = {}): Halaman {
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
  const daftarPerkara = p.daftar ?? DAFTAR_LENGKAP;
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push({ url, cara });
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const admin = p.orang === "admin";
      const q = new URL(url, ASAL).searchParams;
      return json({ ok: true, data: { hariIni: HARI_INI, mode: q.get("mode") || "hari", dari: q.get("dari") || HARI_INI, sampai: q.get("sampai") || HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: daftarPerkara.length, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos(daftarPerkara) } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: false }, 404);
    if (url.includes("/aleta-ecourt/blangko-derry")) return json({ ok: true, data: { ada: false, folder: [], sebab: "uji" } });
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    const m = url.match(/\?a=(D\d)/);
    if (m && url.startsWith(BERANDA) && HALAMAN[m[1]]) return html(HALAMAN[m[1]]);
    return json({ ok: false }, 404);
  };
  const gulirKe: Halaman["gulirKe"] = [];
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function (this: Element, opsi: unknown) {
    gulirKe.push({ id: this.getAttribute("data-kelmodal") || this.getAttribute("data-bl") || "", opsi });
  };
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  if (!p.tanpaRekomendasi) {
    // Saran mesin ditetapkan uji: putusan Itsbat dan BAS Itsbat bagi perkara 225; perkara lain tanpa saran.
    w.aletaBlangkoDerry.pasangRekomendasi((ctx: { nomorPerkara: string }) =>
      ctx.nomorPerkara === N_ITSBAT
        ? [
            { berkas: B_IN, kelompok: "Itsbat - Putusan", jenis: "put", alasan: "uji saran putusan" },
            { berkas: B_BAS_IN, kelompok: "Itsbat - BAS", jenis: "bas", alasan: "uji saran BAS" },
          ]
        : [{ berkas: "tidak-ada-di-menu", kelompok: "tidak-ada", jenis: "put", alasan: "bukan milik perkara ini" }].slice(0, 0)
    );
  }
  return { dom, w, simpanan, minta, gulirKe };
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
const nomorKartu = (h: Halaman) => qq(h, "[data-pk]").map((e) => e.getAttribute("data-pk"));

async function bukaDaftar(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar perkara");
}
async function pilihPerkara(h: Halaman, nomor: string) {
  await bukaDaftar(h);
  klik(h, `[data-pk="${nomor}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function bukaModal(h: Halaman, tunggu: string) {
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
  await sampai(() => q(h, tunggu), `isi modal ${tunggu}`);
}
const idKiri = (h: Halaman) => qq(h, ".bd-mkiri [data-kelmodal]").map((b) => b.getAttribute("data-kelmodal"));
const berkasKanan = (h: Halaman) => qq(h, ".bd-mkanan [data-bl]").map((b) => b.getAttribute("data-bl"));

// ============================================================================
describe("9. Sembunyikan yang selesai", () => {
  it("bawaan TERCENTANG: perkara berprioritas Selesai disembunyikan dan jumlahnya disebut jujur", async () => {
    const h = buka();
    await bukaDaftar(h);
    const kotak = q(h, "#bd-sembunyi") as HTMLInputElement;
    expect(kotak.checked).toBe(true);
    expect(kotak.parentElement!.textContent).toContain("Sembunyikan yang selesai");
    expect(nomorKartu(h)).not.toContain(N_CT_SELESAI);
    expect(nomorKartu(h)).toHaveLength(3);
    expect(q(h, "#bd-ketsembunyi")!.textContent).toContain("1 perkara yang selesai disembunyikan");
    expect(q(h, "#bd-ketdaftar")!.textContent).toContain("3 perkara");
  });

  it("hilangkan centang: yang selesai tampil lagi (berlabel Selesai), pilihan diingat per pengguna", async () => {
    const h = buka();
    await bukaDaftar(h);
    ubah(h, q(h, "#bd-sembunyi") as HTMLInputElement, false);
    await sampai(() => nomorKartu(h).includes(N_CT_SELESAI), "yang selesai tampil");
    expect(nomorKartu(h)).toHaveLength(4);
    expect(q(h, `[data-pk="${N_CT_SELESAI}"] .bd-prio`)!.textContent).toBe("Selesai");
    expect(q(h, "#bd-ketsembunyi")).toBeNull();
    expect((h.simpanan.blangkoDerryDaftar as { sembunyi?: boolean }).sembunyi).toBe(false);
  });

  it("pilihan tersimpan dibaca di kunjungan berikutnya: tak tercentang tetap tak tercentang; tercentang kembali bila diceklis", async () => {
    const h = buka({ simpanan: { blangkoDerryDaftar: { sembunyi: false } } });
    await bukaDaftar(h);
    expect((q(h, "#bd-sembunyi") as HTMLInputElement).checked).toBe(false);
    expect(nomorKartu(h)).toContain(N_CT_SELESAI);
    ubah(h, q(h, "#bd-sembunyi") as HTMLInputElement, true);
    await sampai(() => !nomorKartu(h).includes(N_CT_SELESAI), "disembunyikan lagi");
    expect((h.simpanan.blangkoDerryDaftar as { sembunyi?: boolean }).sembunyi).toBe(true);
  });

  it("semua perkara selesai: bukan 'kosong' yang menyesatkan, melainkan kalimat jujur + tombol Tampilkan yang selesai", async () => {
    const h = buka({ daftar: [DAFTAR_LENGKAP[3]] });
    await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
    (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
    await sampai(() => q(h, '[data-bd="tampil-selesai"]'), "kalimat semua selesai");
    expect(q(h, ".bd-catat")!.textContent).toContain("Semua 1 perkara pada daftar ini sudah selesai");
    expect(nomorKartu(h)).toEqual([]);
    klik(h, '[data-bd="tampil-selesai"]');
    await sampai(() => nomorKartu(h).includes(N_CT_SELESAI), "yang selesai tampil");
    expect((q(h, "#bd-sembunyi") as HTMLInputElement).checked).toBe(false);
  });
});

describe("4. Tanggal tertentu", () => {
  it("tombol baru 'Tanggal tertentu' memuat SATU tanggal (dari = sampai); 'Rentang tanggal' tetap dua isian", async () => {
    const h = buka();
    await bukaDaftar(h);
    expect(qq(h, "[data-mode]").map((b) => [b.getAttribute("data-mode"), b.textContent])).toEqual([
      ["hari", "Sidang hari ini"],
      ["tanggal", "Tanggal tertentu"],
      ["rentang", "Rentang tanggal"],
      ["semua", "Semua perkara saya"],
    ]);
    klik(h, '[data-mode="tanggal"]');
    const tgl = await sampai(() => q(h, "#bd-tgl") as HTMLInputElement | null, "isian satu tanggal");
    expect(tgl.value).toBe(HARI_INI);
    expect(q(h, "#bd-dari")).toBeNull();
    expect(q(h, "#bd-sampai")).toBeNull();
    await sampai(() => h.minta.some((m) => m.url.includes("mode=rentang") && m.url.includes(`dari=${HARI_INI}`) && m.url.includes(`sampai=${HARI_INI}`)), "permintaan satu hari");
    // Tanggal lain: diminta sehari penuh itu saja.
    const sebelum = h.minta.length;
    ubah(h, q(h, "#bd-tgl") as HTMLInputElement, "2026-10-09");
    await sampai(() => h.minta.slice(sebelum).some((m) => m.url.includes("perkara-saya") && m.url.includes("dari=2026-10-09") && m.url.includes("sampai=2026-10-09")), "permintaan 9 Okt");
    // Rentang: dua isian, tanpa isian satu tanggal.
    klik(h, '[data-mode="rentang"]');
    await sampai(() => q(h, "#bd-dari"), "isian rentang");
    expect(q(h, "#bd-sampai")).not.toBeNull();
    expect(q(h, "#bd-tgl")).toBeNull();
  });

  it("tanggal belum lengkap (sedang diketik) tidak memuat apa pun; tombol Tampilkan tanpa tanggal memberi petunjuk, bukan galat", async () => {
    const h = buka();
    await bukaDaftar(h);
    klik(h, '[data-mode="tanggal"]');
    await sampai(() => q(h, "#bd-tgl"), "isian satu tanggal");
    await tunggu(30);
    const sebelum = h.minta.length;
    ubah(h, q(h, "#bd-tgl") as HTMLInputElement, "");
    await tunggu(40);
    expect(h.minta.slice(sebelum).filter((m) => m.url.includes("perkara-saya"))).toEqual([]);
    expect(q(h, ".bd-peringatan")).toBeNull();
  });
});

describe("8. Sidang ke-N dan agenda di kolom Perkara", () => {
  it("kartu: 'Sidang ke-3 · Musyawarah majelis' di bawah nomor perkara", async () => {
    const h = buka();
    await bukaDaftar(h);
    expect(q(h, `[data-pk="${N_ITSBAT}"] [data-kesidang]`)!.textContent).toBe("Sidang ke-3 · Musyawarah majelis");
    expect(q(h, `[data-pk="${N_CG}"] [data-kesidang]`)!.textContent).toBe("Sidang ke-2 · Pembuktian Penggugat");
  });

  it("daftar ringkas dan tabel detail memuat keterangan yang sama", async () => {
    const h = buka();
    await bukaDaftar(h);
    klik(h, '[data-lihat="ringkas"]');
    await sampai(() => q(h, `.bd-brs[data-pk="${N_ITSBAT}"] [data-kesidang]`), "daftar ringkas");
    expect(q(h, `.bd-brs[data-pk="${N_ITSBAT}"] [data-kesidang]`)!.textContent).toBe("Sidang ke-3 · Musyawarah majelis");
    klik(h, '[data-lihat="tabel"]');
    await sampai(() => q(h, `tr[data-pk="${N_ITSBAT}"] [data-kesidang]`), "tabel detail");
    const sel = q(h, `tr[data-pk="${N_ITSBAT}"] td.nw`)!;
    expect(sel.textContent).toContain("225/Pdt.P/2026");
    expect(sel.textContent).toContain("Sidang ke-3 · Musyawarah majelis");
  });

  it("tanpa nomor urut dari SIPP: hanya agenda (tidak ada 'ke-0')", async () => {
    const h = buka({ daftar: [PK("910/Pdt.G/2026", "Cerai Gugat", [SI(HARI_INI, "Sidang Pertama", "", 0)])] });
    await bukaDaftar(h);
    expect(q(h, '[data-pk="910/Pdt.G/2026/PA.Dgl"] [data-kesidang]')!.textContent).toBe("Sidang Pertama");
  });
});

describe("5. Semua akun: tanpa saran di langkah 2; Disarankan mengikuti tab", () => {
  it("Super Admin tanpa 'Lihat sebagai': kalimat saran dan tombol Pakai saran ini tidak tampil", async () => {
    const h = buka({ orang: "admin" });
    await pilihPerkara(h, N_ITSBAT);
    const p = await sampai(() => q(h, "#bd-saranblangko"), "baris langkah 2");
    expect(p.textContent).not.toMatch(/Saran untuk|Belum ada saran|Pakai saran/);
    expect(q(h, '[data-bd2="pakairek"]')).toBeNull();
    expect(p.textContent).toContain("Pilih blangko lewat tombol Pilih blangko");
  });

  it("memilih 'Lihat sebagai' hakim: saran langkah 2 muncul seperti biasa (perilaku peran dipertahankan)", async () => {
    const h = buka({ orang: "admin" });
    await bukaDaftar(h);
    ubah(h, q(h, "#bd-lihat") as HTMLSelectElement, "hakim|Hakim Satu");
    await sampai(() => (q(h, "#bd-siapa")?.textContent || "").includes("dilihat sebagai Hakim Satu") && q(h, "[data-pk]"), "daftar sebagai hakim");
    klik(h, `[data-pk="${N_ITSBAT}"]`);
    const p = await sampai(() => q(h, "#bd-saranblangko"), "baris langkah 2");
    expect(p.textContent).toContain("Saran untuk sidang ke-");
    expect(q(h, '[data-bd2="pakairek"]')).not.toBeNull();
  });

  it("akun hakim biasa (bukan admin) tetap mendapat saran di langkah 2", async () => {
    const h = buka({ orang: "hakim" });
    await pilihPerkara(h, N_ITSBAT);
    const p = await sampai(() => q(h, "#bd-saranblangko"), "baris langkah 2");
    expect(p.textContent).toContain("Saran untuk sidang ke-");
  });

  it("jendela Pilih blangko (Semua akun): kelompok Disarankan mengikuti TAB - Putusan, BAS, lalu Relaas dan PTSP tanpa Disarankan", async () => {
    const h = buka({ orang: "admin" });
    await pilihPerkara(h, N_ITSBAT);
    await bukaModal(h, `.bd-mkanan [data-bl="${B_IN}"]`);
    // Tab Putusan: Disarankan memuat saran putusan saja.
    expect(qq(h, ".bd-mkepala [data-jenismodal]").map((b) => b.getAttribute("data-jenismodal"))).toEqual(["put", "bas", "rel"]);
    expect(idKiri(h)[0]).toBe("saran");
    expect(berkasKanan(h)).toEqual([B_IN]);
    // Tab BAS: Disarankan memuat saran BAS.
    klik(h, '[data-jenismodal="bas"]');
    await sampai(() => q(h, ".bd-mkiri .bd-kel.saran") && idKiri(h)[0] === "saran", "Disarankan tab BAS");
    expect(berkasKanan(h)).toEqual([B_BAS_IN]);
    expect(q(h, ".bd-mkiri .bd-kel.saran .ks")!.textContent).toContain("sidang ke-");
    // Tab Relaas: tidak ada saran -> tidak ada kelompok Disarankan.
    klik(h, '[data-jenismodal="rel"]');
    await sampai(() => idKiri(h).length > 0 && !idKiri(h).includes("saran"), "tanpa Disarankan di tab Relaas");
    expect(q(h, ".bd-mkiri .bd-kel.saran")).toBeNull();
  });
});

describe("6. Kategori yang cocok dengan jenis perkara di atas", () => {
  it("perkara Itsbat Nikah: 'Itsbat - Putusan' naik ke atas, di bawah Disarankan (bukan di urutan menu aslinya)", async () => {
    const h = buka({ orang: "admin" });
    await pilihPerkara(h, N_ITSBAT);
    await bukaModal(h, `.bd-mkanan [data-bl="${B_IN}"]`);
    expect(idKiri(h)).toEqual(["saran", "k:Itsbat - Putusan", "k:CG - Putusan", "k:CT - Putusan"]);
    expect(q(h, '[data-kelmodal="k:Itsbat - Putusan"] .ks')!.textContent).toContain("sesuai jenis perkara ini");
  });

  it("tanpa saran: kategori yang cocok jadi yang paling atas dan langsung terbuka", async () => {
    const h = buka({ orang: "admin" });
    await pilihPerkara(h, N_ITSBAT_2);
    await bukaModal(h, `.bd-mkanan [data-bl]`);
    expect(idKiri(h)).toEqual(["k:Itsbat - Putusan", "k:CG - Putusan", "k:CT - Putusan"]);
    expect(q(h, '[data-kelmodal="k:Itsbat - Putusan"]')!.classList.contains("aktif")).toBe(true);
    expect(berkasKanan(h)).toEqual([B_IN]);
  });

  it("perkara Cerai Talak: 'CT - Putusan' paling atas; perkara Itsbat di tab BAS: 'Itsbat - BAS' paling atas", async () => {
    const h = buka({ orang: "admin", simpanan: { blangkoDerryDaftar: { sembunyi: false } } });
    await pilihPerkara(h, N_CT_SELESAI);
    await bukaModal(h, ".bd-mkanan [data-bl]");
    // Perkara ini sudah putus ("putus DIKABULKAN"): mesin saran memberi Disarankan; kategori yang cocok langsung di bawahnya.
    expect(idKiri(h).filter((x) => x !== "saran")[0]).toBe("k:CT - Putusan");
    expect(idKiri(h).indexOf("k:CT - Putusan")).toBeLessThanOrEqual(1);
    const h2 = buka({ orang: "admin" });
    await pilihPerkara(h2, N_ITSBAT_2);
    await bukaModal(h2, ".bd-mkanan [data-bl]");
    klik(h2, '[data-jenismodal="bas"]');
    await sampai(() => idKiri(h2)[0] === "k:Itsbat - BAS" && berkasKanan(h2).length > 0, "BAS Itsbat di atas");
    expect(idKiri(h2)).toEqual(["k:Itsbat - BAS", "k:CG - BAS"]);
  });
});

describe("7. Gulir jendela Pilih blangko dan sorot kategori terpilih", () => {
  it("memilih kategori di bagian bawah tidak melompatkan gulir daftar kiri ke atas; butir terpilih digulirkan ke tempat terlihat ('nearest')", async () => {
    const h = buka({ orang: "admin" });
    await pilihPerkara(h, N_ITSBAT_2);
    await bukaModal(h, ".bd-mkanan [data-bl]");
    (q(h, ".bd-mkiri") as HTMLElement).scrollTop = 300;
    h.gulirKe.length = 0;
    klik(h, '[data-kelmodal="k:CT - Putusan"]');
    await sampai(() => q(h, '[data-kelmodal="k:CT - Putusan"]')?.classList.contains("aktif") && berkasKanan(h).includes(B_CT), "kategori terpilih");
    expect((q(h, ".bd-mkiri") as HTMLElement).scrollTop).toBe(300);
    const ke = h.gulirKe.filter((g) => g.id === "k:CT - Putusan");
    expect(ke.length).toBeGreaterThan(0);
    expect(ke[ke.length - 1].opsi).toMatchObject({ block: "nearest" });
    // Kategori terpilih bertanda dan bersorot.
    const aktif = q(h, ".bd-kel.aktif")!;
    expect(aktif.getAttribute("data-kelmodal")).toBe("k:CT - Putusan");
    expect(aktif.getAttribute("aria-current")).toBe("true");
    expect(qq(h, ".bd-kel.aktif")).toHaveLength(1);
  });

  it("daftar kanan: gulir bertahan saat jendela digambar ulang pada isi yang sama, kembali ke atas hanya saat kategori berganti", async () => {
    const h = buka({ orang: "admin" });
    await pilihPerkara(h, N_ITSBAT_2);
    await bukaModal(h, ".bd-mkanan [data-bl]");
    (q(h, ".bd-mkanan") as HTMLElement).scrollTop = 150;
    // Digambar ulang tanpa pergantian isi (memilih kategori yang sedang aktif): gulir kanan bertahan.
    klik(h, '[data-kelmodal="k:Itsbat - Putusan"]');
    await tunggu(30);
    expect((q(h, ".bd-mkanan") as HTMLElement).scrollTop).toBe(150);
    // Berganti kategori: isi kanan baru, mulai dari atas.
    klik(h, '[data-kelmodal="k:CG - Putusan"]');
    await sampai(() => berkasKanan(h).includes(B_CG), "kategori CG");
    expect((q(h, ".bd-mkanan") as HTMLElement).scrollTop).toBe(0);
  });

  it("berganti tab jenis dokumen: daftar kiri berisi hal baru dan kembali ke atas", async () => {
    const h = buka({ orang: "admin" });
    await pilihPerkara(h, N_ITSBAT_2);
    await bukaModal(h, ".bd-mkanan [data-bl]");
    (q(h, ".bd-mkiri") as HTMLElement).scrollTop = 200;
    klik(h, '[data-jenismodal="bas"]');
    await sampai(() => idKiri(h)[0] === "k:Itsbat - BAS", "tab BAS");
    expect((q(h, ".bd-mkiri") as HTMLElement).scrollTop).toBe(0);
  });

  it("sorot kategori terpilih: latar berbeda + garis kiri, memakai token tema sehingga jelas di gelap dan terang", () => {
    const css = baca("blangko-derry.css");
    const aturan = css.match(/#aleta-bd-akar \.bd-kel\.aktif\s*\{([^}]*)\}/g) || [];
    const terakhir = aturan[aturan.length - 1] || "";
    expect(terakhir).toMatch(/background:\s*var\(--accentbg\)/);
    expect(terakhir).toMatch(/box-shadow:\s*inset 4px 0 0 var\(--accent\)/);
    // Token ada di tema gelap (bawaan) maupun terang.
    const gelap = css.match(/#aleta-bd-akar, #aleta-bd-tawar \{([^}]*)\}/)![1];
    const terang = css.match(/#aleta-bd-akar\[data-tema="terang"\][^{]*\{([^}]*)\}/)![1];
    for (const tema of [gelap, terang]) {
      expect(tema).toMatch(/--accentbg:/);
      expect(tema).toMatch(/--accent:/);
    }
  });
});
