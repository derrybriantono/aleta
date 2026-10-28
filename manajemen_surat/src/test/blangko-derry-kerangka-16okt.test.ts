// @vitest-environment node
/**
 * ============================================================================
 * 16 OKT 2026 - BLANGKO ABT BY DERRY BRIANTONO, TAHAP C (KERANGKA) DAN D (DAFTAR)
 * ============================================================================
 *
 * ekstensi-sipp/blangko-derry.js dijalankan SUNGGUHAN di jsdom beralamat
 * halaman depan ABT, di atas panel-alat.js asli (alatAmbil, golongan menu).
 * Yang dijaga:
 *   C  klik grup "Blangko Derry" membuka tampilan baru; panel ALETA lama
 *      disembunyikan (kelas di <html>) dan kembali di "Tampilan ABT lama";
 *      kartu tawaran 3 tombol; saklar memakai chrome.storage.local yang sama
 *      dengan popup; tema mengikuti temaPanel; Alat saya per peran; Lihat
 *      sebagai akun hanya untuk admin; ALETA tak terjangkau = ABT biasa tetap
 *      bekerja
 *   D  4 tampilan, 6 urutan, skor prioritas, nama pihak hanya saat kursor,
 *      daftar mengecil sesudah perkara dipilih, dropdown sidang berisi tanggal
 *      + agenda + keterangan, klik dua kali nomor = ganti perkara, tiga mode
 *      (hari ini, pilih tanggal, semua) memanggil rute dengan parameter benar
 *   semua permintaan jaringan berupa GET - tidak ada yang ditulis
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_DERRY = baca("blangko-derry.js");

const ASAL = "http://192.168.10.10";
const BERANDA = `${ASAL}/aps_badilag/index.php/abt/main/beranda`;
const HARI_INI = "2026-10-15";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 4000): Promise<NonNullable<T>> {
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
// Bahan: perkara nama karangan (hari ini 15 Okt 2026)
// ----------------------------------------------------------------------------
const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({
  sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra,
});
const PK = (nomor: string, jenis: string, sidang: unknown[], extra: Record<string, unknown> = {}) => ({
  nomorPerkara: `${nomor}/PA.Dgl`, perkaraId: `id${nomor}`, jenisPerkara: jenis, alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H., Hakim Dua, M.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim"], pihak: { penggugat: [`Penggugat ${nomor}`], tergugat: [`Tergugat ${nomor}`] }, sidang, ...extra,
});
const DAFTAR = [
  PK("581/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat"), SI("2026-10-15", "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)")], { sudahPutus: true, tanggalPutusan: HARI_INI, pihak: { penggugat: ["Yulfiani binti Tasbih"], tergugat: ["Andi Rustam bin Syamsudin"] } }),
  PK("512/Pdt.G/2026", "Cerai Gugat", [SI("2026-09-28", "Sidang Pertama"), SI("2026-10-15", "Pemeriksaan pokok perkara", "putus")], { sudahPutus: true, tanggalPutusan: HARI_INI, adaBerkasPutusan: true }),
  PK("540/Pdt.G/2026", "Cerai Talak", [SI("2026-10-19", "Sidang Pertama")]),
  PK("455/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-15", "Sidang Pertama", "Mediasi")]),
  PK("410/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-02", "Pemeriksaan pokok perkara", "putus")], { sudahPutus: true, tanggalPutusan: "2026-10-02" }),
];
const AKUN = { hakim: ["Hakim Satu", "Hakim Dua"], pp: ["PP Satu"], js: ["JS Satu"] };
const dataDaftar = (mode = "hari", tambah: Record<string, unknown> = {}) => ({
  hariIni: HARI_INI, mode, dari: HARI_INI, sampai: HARI_INI, lihatSemua: false, nama: "Hakim Satu", sebagaiNama: "", sebagaiPeran: null,
  terpotong: false, jumlahSemua: 9, adaYangCocok: true, akun: null, perkara: polos(DAFTAR), ...tambah,
});

type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
  js: { nama: "JS Satu", peran: "Juru Sita", roleId: "jurusita", golonganMenu: ["jurusita"] },
  kasir: { nama: "Kasir Satu", peran: "Kasir", roleId: "kasir", golonganMenu: ["kasir"] },
  ptsp: { nama: "PTSP Satu", peran: "Petugas PTSP", roleId: "ptsp", golonganMenu: ["ptsp"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};

type Minta = { url: string; cara: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; tulis: Array<Record<string, unknown>> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

const MENU_DERRY = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${ASAL}/aps_badilag/index.php/abt/main/beranda?a=D1&c=" title="(12 Blangko)" class="DERRY1">Putusan CG</a><a href="${ASAL}/aps_badilag/index.php/abt/main/beranda?a=D2&c=" title="(4 Blangko)">BAS CG</a></div>`;
const GRUP_LAIN = (aktif = false) => `<button class="accordion">Gugatan &amp; Permohonan</button><div class="panel"><a ${aktif ? 'class="active"' : ""} href="${ASAL}/x?a=G">Gugatan Cerai</a></div><button class="accordion">Berita Acara Sidang</button><div class="panel"><a href="${ASAL}/x?a=B">BAS</a></div>`;

type Opsi = {
  orang?: string;
  orangKustom?: Orang;
  url?: string;
  simpanan?: Record<string, unknown>;
  headerAdmin?: boolean;
  grupLainAktif?: boolean;
  derryAktif?: boolean;
  tanpaDerry?: boolean;
  siapaMati?: boolean;
  sesi?: Record<string, string>;
  perkara?: (url: string) => { status?: number; isi: unknown } | undefined;
  panelLama?: boolean;
};

function buka(p: Opsi = {}): Halaman {
  const derry = p.derryAktif ? MENU_DERRY.replace('title="(12 Blangko)"', 'title="(12 Blangko)" class="active"') : MENU_DERRY;
  const badan =
    `<div id="header"><div class="h_right"><b>Pengguna Uji</b> ${p.headerAdmin ? "Administrator" : "Panitera"}</div></div>` +
    `<div id="wrapper"><div id="cssmenu"></div><div id="navbar">${GRUP_LAIN(p.grupLainAktif)}${p.tanpaDerry ? "" : derry}<button class="accordion">Blangko Fikrianto</button><div class="panel"><a href="#">F</a></div></div>` +
    `<div id="content"><div class="pricing_inner_w3ls"><div class="pricing-top"><h3>Putusan</h3></div></div></div></div>` +
    (p.panelLama ? `<div class="aleta-panel aleta-panel-abt" id="panel-lama">PANEL ALETA LAMA</div>` : "");
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, {
    url: p.url ?? BERANDA,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  for (const [k, v] of Object.entries(p.sesi || {})) w.sessionStorage.setItem(k, v);
  // 22 Okt 2026: "Sembunyikan yang selesai" kini bawaan tercentang. Uji ini mengukur isi daftar lengkap (perkara selesai ikut), jadi
  // pilihannya dimatikan di sini; perilaku bawaan dan saklarnya diuji di blangko-derry-tampilan-22okt.test.ts.
  const simpanan: Record<string, unknown> = polos({ blangkoDerryDaftar: { sembunyi: false }, ...(p.simpanan ?? {}) });
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const tulis: Array<Record<string, unknown>> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      tulis.push(polos(isi));
      const ubah: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(isi)) {
        ubah[k] = { oldValue: polos(simpanan[k]), newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async () => undefined,
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.200.2" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: () => undefined, lastError: undefined },
    storage: { local, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) } },
  };
  const minta: Minta[] = [];
  const orang = p.orangKustom ?? ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    minta.push({ url, cara: String(opsi?.method || "GET").toUpperCase() });
    if (url.includes("/ekstensi/siapa")) {
      if (p.siapaMati) return json({ ok: false, alasan: "tidak terjangkau" }, 502);
      return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: p.orang === "kasir" } });
    }
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const khusus = p.perkara && p.perkara(url);
      if (khusus) return json(khusus.isi, khusus.status ?? 200);
      const q = new URL(url, ASAL).searchParams;
      const admin = p.orang === "admin";
      return json({ ok: true, data: dataDaftar(q.get("mode") || "hari", { lihatSemua: admin, akun: admin ? AKUN : null, nama: orang.nama }) });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) {
      return json({
        ok: true,
        data: {
          sipp: {
            jadwalPerkara: [
              { sidangId: "s2026-10-01", tanggalSidang: "2026-10-01", jamSidang: "09:00:00", agenda: "Sidang Pertama", alasanDitunda: "Panggil Tergugat", ditunda: true, urutanSidang: 1, adaBas: true },
              { sidangId: "sx", tanggalSidang: "2026-10-08", jamSidang: "09:00:00", agenda: "Sidang Kedua", alasanDitunda: "0", ditunda: false, urutanSidang: 2, adaBas: false },
              { sidangId: "s2026-10-15", tanggalSidang: "2026-10-15", jamSidang: "09:00:00", agenda: "Pemeriksaan pokok perkara", alasanDitunda: "putus DIKABULKAN (verstek)", ditunda: false, urutanSidang: 3, adaBas: false },
            ],
          },
        },
      });
    }
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_DERRY}`);
  return { dom, w, simpanan, minta, tulis };
}

const D = (h: Halaman) => h.w.document as Document;
const akarDari = (h: Halaman) => D(h).getElementById("aleta-bd-akar") as HTMLElement | null;
const tawarDari = (h: Halaman) => D(h).getElementById("aleta-bd-tawar") as HTMLElement | null;
const akarTampak = (h: Halaman) => {
  const a = akarDari(h);
  return a && !a.hidden ? a : null;
};
const klikDerry = (h: Halaman) => (Array.from(D(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
const tekan = (h: Halaman, s: string) => (akarDari(h)!.querySelector(s) as HTMLElement).click();
const nomorKartu = (h: Halaman) => Array.from(akarDari(h)!.querySelectorAll("[data-pk]")).map((e) => (e as HTMLElement).getAttribute("data-pk"));
/** Menunggu pemasangan awal selesai (akun terbaca) sebelum menekan sesuatu. */
const siapPakai = (h: Halaman) => sampai(() => h.w.aletaBlangkoDerry.keadaan().peran.length > 0, "akun terbaca");
const bukaTampilan = async (h: Halaman) => {
  await sampai(() => tawarDari(h), "kartu tawaran");
  klikDerry(h);
  await sampai(() => akarTampak(h), "tampilan terbuka");
  await sampai(() => akarDari(h)!.querySelector("[data-pk]"), "daftar termuat");
};
const gerak = (h: Halaman, tipe: string, el: Element) => el.dispatchEvent(new h.w.MouseEvent(tipe, { bubbles: true }));

// ============================================================================
describe("C. kerangka: masuk, tawaran, kembali", () => {
  it("bukan halaman ABT: tidak memasang apa pun dan tidak meminta apa pun", async () => {
    const h = buka({ url: `${ASAL}/SIPP/index.php/pengguna` });
    await tunggu(60);
    expect(tawarDari(h)).toBeNull();
    expect(akarDari(h)).toBeNull();
    // Panel ALETA lain boleh menanyakan tampilan ke server; modul ini tidak menanyakan apa pun.
    expect(h.minta.filter((m) => /ekstensi\/siapa|perkara-saya|aleta-ecourt\/sidang/.test(m.url))).toEqual([]);
    expect(h.w.aletaBlangkoDerry.keadaan().peran).toEqual([]);
  });

  it("ABT tampil biasa; kartu tawaran memuat Aktifkan / Nanti saja / Jangan tawarkan lagi; panel lama tidak disentuh", async () => {
    const h = buka({ panelLama: true });
    const t = await sampai(() => tawarDari(h), "kartu tawaran");
    expect(Array.from(t.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Aktifkan", "Nanti saja", "Jangan tawarkan lagi"]);
    expect(akarDari(h)).toBeNull();
    expect(D(h).documentElement.classList.contains("aleta-bd-aktif")).toBe(false);
    expect(D(h).getElementById("panel-lama")!.hidden).toBe(false);
  });

  it("klik grup Blangko Derry: tampilan berganti, <html> bertanda (panel lama disembunyikan lewat gaya), kartu tawaran hilang", async () => {
    const h = buka({ panelLama: true });
    await sampai(() => tawarDari(h), "kartu tawaran");
    klikDerry(h);
    const a = await sampai(() => akarTampak(h), "tampilan terbuka");
    expect(a.textContent).toContain("Blangko ABT by Derry Briantono");
    expect(D(h).documentElement.classList.contains("aleta-bd-aktif")).toBe(true);
    expect(tawarDari(h)).toBeNull();
    // Aturan CSS yang menyembunyikan panel lama ada, dan mengena kelas panel ABT.
    const css = baca("blangko-derry.css");
    expect(css).toMatch(/html\.aleta-bd-aktif \.aleta-panel-abt[\s\S]*display: none !important/);
    // Hanya menu Blangko Derry yang ditawarkan di tampilan ini.
    const menu = Array.from(a.querySelectorAll("#bd-menuderry a")).map((x) => x.textContent);
    expect(menu).toEqual(["Putusan CG", "BAS CG"]);
    expect(a.textContent).not.toContain("Gugatan Cerai");
  });

  it("'Tampilan ABT lama' mengembalikan ABT: <html> bersih, tawaran muncul lagi", async () => {
    const h = buka();
    await bukaTampilan(h);
    tekan(h, '[data-bd="keabt"]');
    expect(akarDari(h)!.hidden).toBe(true);
    expect(D(h).documentElement.classList.contains("aleta-bd-aktif")).toBe(false);
    await sampai(() => tawarDari(h), "tawaran kembali");
    // Klik grup lagi: buka kembali.
    klikDerry(h);
    expect(akarTampak(h)).not.toBeNull();
  });

  it("'Nanti saja' menyembunyikan tawaran untuk sesi ini tanpa menulis apa pun; 'Jangan tawarkan lagi' menulis saklar", async () => {
    const h = buka();
    const t = await sampai(() => tawarDari(h), "kartu tawaran");
    (t.querySelectorAll("button")[1] as HTMLElement).click();
    expect(tawarDari(h)).toBeNull();
    expect(h.tulis.filter((x) => Object.keys(x).some((k) => k.startsWith("blangkoDerry")))).toEqual([]);

    const h2 = buka();
    const t2 = await sampai(() => tawarDari(h2), "kartu tawaran 2");
    (t2.querySelectorAll("button")[2] as HTMLElement).click();
    expect(tawarDari(h2)).toBeNull();
    await sampai(() => h2.simpanan.blangkoDerryTawar === false, "saklar tersimpan");
  });

  it("saklar tawaran mati di penyimpanan (popup): tidak ada kartu", async () => {
    const h = buka({ simpanan: { blangkoDerryTawar: false } });
    await tunggu(80);
    expect(tawarDari(h)).toBeNull();
  });

  it("kasir dan PTSP tidak ditawari; tetapi grup Derry tetap dapat dibuka untuk melihat Alat saya", async () => {
    const h = buka({ orang: "kasir" });
    await tunggu(80);
    expect(tawarDari(h)).toBeNull();
    klikDerry(h);
    await sampai(() => akarTampak(h), "tampilan terbuka");
    expect(akarDari(h)!.querySelector("#bd-siapa")!.textContent).toContain("Kasir Satu");
  });

  it("ALETA tidak terjangkau: grup Derry tetap ABT biasa (tidak dibajak), tanpa kartu", async () => {
    const h = buka({ siapaMati: true });
    await tunggu(80);
    klikDerry(h);
    await tunggu(80);
    expect(akarDari(h)).toBeNull();
    expect(tawarDari(h)).toBeNull();
    expect(D(h).documentElement.classList.contains("aleta-bd-aktif")).toBe(false);
  });

  it("tanpa grup Derry di bilah: tidak memasang apa pun", async () => {
    const h = buka({ tanpaDerry: true });
    await tunggu(80);
    expect(tawarDari(h)).toBeNull();
    expect(akarDari(h)).toBeNull();
  });

  it("aktif=false (panel ALETA ditutup petugas): tidak memasang apa pun", async () => {
    const h = buka({ simpanan: { aktif: false } });
    await tunggu(80);
    expect(tawarDari(h)).toBeNull();
  });
});

describe("C. bawaan: terbuka sendiri hanya di tempat yang benar", () => {
  it("bawaan menyala: terbuka sendiri di halaman depan", async () => {
    const h = buka({ simpanan: { blangkoDerryBawaan: true } });
    await sampai(() => akarTampak(h), "terbuka sendiri");
    expect(tawarDari(h)).toBeNull();
  });

  it("bawaan menyala tetapi grup lain sedang dibuka: ABT lama dipertahankan", async () => {
    const h = buka({ simpanan: { blangkoDerryBawaan: true }, grupLainAktif: true });
    await tunggu(100);
    expect(akarTampak(h)).toBeNull();
  });

  it("bawaan menyala dan grup Derry yang sedang dibuka: terbuka", async () => {
    const h = buka({ simpanan: { blangkoDerryBawaan: true }, derryAktif: true, grupLainAktif: true });
    await sampai(() => akarTampak(h), "terbuka sendiri");
  });

  it("sesudah 'Tampilan ABT lama' di tab ini, bawaan tidak membukanya lagi sampai grup diklik", async () => {
    const h = buka({ simpanan: { blangkoDerryBawaan: true }, sesi: { "aleta-bd-lama": "1" } });
    await tunggu(100);
    expect(akarDari(h)).toBeNull();
    klikDerry(h);
    await sampai(() => akarTampak(h), "dibuka dengan klik");
  });

  it("bawaan tidak membuka untuk peran tanpa pekerjaan Derry (kasir)", async () => {
    const h = buka({ simpanan: { blangkoDerryBawaan: true }, orang: "kasir" });
    await tunggu(100);
    expect(akarTampak(h)).toBeNull();
  });
});

describe("C. Widget ALETA: saklar yang sama dengan popup, tema ikut temaPanel", () => {
  const widget = (h: Halaman) => akarDari(h)!.querySelector("#bd-widget") as HTMLElement;
  const saklarWidget = (h: Halaman) => Array.from(widget(h).querySelectorAll("[data-cfg]")).map((x) => (x as HTMLElement).getAttribute("data-cfg"));

  it("hakim: bawaan, tawaran, saran Tab, pengingat; juru sita tidak melihat saran Tab; admin melihat semua", async () => {
    const h = buka();
    await bukaTampilan(h);
    tekan(h, "#bd-widget-btn");
    // F1.5 (17 Okt): + gembok panel ALETA di ABT biasa (kunci gembokKepalaAbt, sama dengan popup).
    // JJ2 (18 Okt): + tanya-jawab jawab-menjawab otomatis (hakim dan panitera pengganti; juru sita tidak).
    // 19 Okt: + isi otomatis dari SIPP (hakim, panitera pengganti, dan juru sita).
    expect(saklarWidget(h)).toEqual(["bawaan", "tawar", "saran", "ingat", "isiOto", "tjJawab", "siapNaskah", "gembok"]);

    const j = buka({ orang: "js" });
    await bukaTampilan(j);
    tekan(j, "#bd-widget-btn");
    expect(saklarWidget(j)).toEqual(["bawaan", "tawar", "ingat", "isiOto", "siapNaskah", "gembok"]);

    const a = buka({ orang: "admin" });
    await bukaTampilan(a);
    tekan(a, "#bd-widget-btn");
    expect(saklarWidget(a)).toEqual(["bawaan", "tawar", "saran", "ingat", "isiOto", "tjJawab", "siapNaskah", "gembok"]);
    expect(widget(a).textContent).toContain("Super Admin dan Admin melihat semua pengaturan");
  });

  it("mengubah saklar menulis kunci popup yang SAMA; perubahan dari popup tampil di widget", async () => {
    const h = buka();
    await bukaTampilan(h);
    tekan(h, "#bd-widget-btn");
    const bawaan = widget(h).querySelector('[data-cfg="bawaan"]') as HTMLInputElement;
    expect(bawaan.checked).toBe(false);
    bawaan.checked = true;
    bawaan.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.simpanan.blangkoDerryBawaan === true, "bawaan tersimpan");
    const saran = widget(h).querySelector('[data-cfg="saran"]') as HTMLInputElement;
    expect(saran.checked).toBe(true);
    saran.checked = false;
    saran.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.simpanan.blangkoDerrySaran === false, "saran tersimpan");
    // Dari luar (popup) saran dinyalakan lagi: widget ikut.
    await h.w.chrome.storage.local.set({ blangkoDerrySaran: true });
    await sampai(() => (widget(h).querySelector('[data-cfg="saran"]') as HTMLInputElement).checked === true, "widget mengikuti popup");
    expect(h.w.aletaBlangkoDerry.setelan()).toMatchObject({ bawaan: true, saran: true, tawar: true, ingat: true });
  });

  it("tema: temaPanel terang -> tampilan terang; memilih Gelap di widget menulis temaPanel", async () => {
    const h = buka({ simpanan: { temaPanel: "terang" } });
    await bukaTampilan(h);
    expect(akarDari(h)!.getAttribute("data-tema")).toBe("terang");
    tekan(h, "#bd-widget-btn");
    const sel = widget(h).querySelector("[data-cfgtema]") as HTMLSelectElement;
    expect(sel.value).toBe("terang");
    sel.value = "gelap";
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(akarDari(h)!.getAttribute("data-tema")).toBe("gelap");
    await sampai(() => h.simpanan.temaPanel === "gelap", "tema tersimpan");
    // Tema berganti dari popup/panel lain: ikut.
    await h.w.chrome.storage.local.set({ temaPanel: "terang" });
    await sampai(() => akarDari(h)!.getAttribute("data-tema") === "terang", "tema mengikuti");
  });

  it("kartu tawaran juga mengikuti tema", async () => {
    const h = buka({ simpanan: { temaPanel: "terang" } });
    const t = await sampai(() => tawarDari(h), "kartu tawaran");
    expect(t.getAttribute("data-tema")).toBe("terang");
  });
});

describe("C. Alat saya per peran; Lihat sebagai akun", () => {
  const alat = (h: Halaman) => Array.from(akarDari(h)!.querySelectorAll("#bd-alat [data-alat]")).map((x) => (x as HTMLElement).getAttribute("data-alat"));
  const grup = (h: Halaman) => Array.from(akarDari(h)!.querySelectorAll("#bd-alat .grup")).map((x) => x.textContent);

  it("hakim hanya alat hakim; PP hanya alat PP; juru sita hanya relaas", async () => {
    const h = buka({ orang: "hakim" });
    await bukaTampilan(h);
    tekan(h, "#bd-alat-btn");
    expect(alat(h)).toEqual(["putusanOto", "gugatan", "saksi", "ktp", "cek", "konseptor", "advance", "unggah", "massal:unggah"]); // F1.6: checklist konseptor; F4.4: Putusan Advance
    expect(grup(h)[0]).toContain("Hakim");

    const p = buka({ orang: "pp" });
    await bukaTampilan(p);
    tekan(p, "#bd-alat-btn");
    expect(alat(p)).toEqual(["massal:bas", "gugatan", "saksi", "ktp", "konseptor", "advance", "unggah", "massal:unggah"]); // F1.6; 17 Okt: Putusan Advance untuk konseptor

    const j = buka({ orang: "js" });
    await bukaTampilan(j);
    tekan(j, "#bd-alat-btn");
    expect(alat(j)).toEqual(["massal:rel", "unggah"]);
  });

  it("kasir dan PTSP mendapat alatnya sendiri, tidak tercampur", async () => {
    const k = buka({ orang: "kasir" });
    await siapPakai(k);
    klikDerry(k);
    await sampai(() => akarTampak(k), "terbuka");
    tekan(k, "#bd-alat-btn");
    expect(alat(k)).toEqual(["kasir:rekap", "kasir:otomatis"]);

    const t = buka({ orang: "ptsp" });
    await siapPakai(t);
    klikDerry(t);
    await sampai(() => akarTampak(t), "terbuka");
    tekan(t, "#bd-alat-btn");
    expect(alat(t)).toEqual(["ptsp:dataumum", "ptsp:ktp"]);
  });

  it("Super Admin ALETA melihat semua kelompok alat", async () => {
    const h = buka({ orang: "admin" });
    await bukaTampilan(h);
    tekan(h, "#bd-alat-btn");
    expect(grup(h)).toEqual(["Hakim", "Panitera Pengganti", "Juru sita", "Kasir", "PTSP"]);
  });

  it("Admin ABT (kepala halaman 'Administrator') melihat semua walau akun ALETA-nya hakim", async () => {
    const h = buka({ orang: "hakim", headerAdmin: true });
    await bukaTampilan(h);
    tekan(h, "#bd-alat-btn");
    expect(grup(h).length).toBe(5);
    expect(akarDari(h)!.querySelector("#bd-lihatwrap")!.hasAttribute("hidden")).toBe(false);
  });

  it("alat yang belum dipasang: kabar 'menyusul'; alat yang didaftarkan tahap berikutnya dijalankan", async () => {
    const h = buka({ orang: "hakim" });
    await bukaTampilan(h);
    tekan(h, "#bd-alat-btn");
    tekan(h, '[data-alat="gugatan"]');
    expect(akarDari(h)!.querySelector("#bd-toast")!.textContent).toContain("menyusul");
    let dipanggil = 0;
    h.w.aletaBlangkoDerry.daftarkanAlat("gugatan", () => dipanggil++);
    tekan(h, "#bd-alat-btn");
    tekan(h, '[data-alat="gugatan"]');
    expect(dipanggil).toBe(1);
  });

  it("'Lihat sebagai akun' hanya untuk admin; hakim biasa tidak melihatnya", async () => {
    const h = buka({ orang: "hakim" });
    await bukaTampilan(h);
    expect(akarDari(h)!.querySelector("#bd-lihatwrap")!.hasAttribute("hidden")).toBe(true);
  });

  it("admin memilih akun: daftar dimuat ulang dengan sebagai & peranSebagai, alat menyempit ke peran itu", async () => {
    const h = buka({ orang: "admin" });
    await bukaTampilan(h);
    const sel = akarDari(h)!.querySelector("#bd-lihat") as HTMLSelectElement;
    expect(Array.from(sel.options).map((o) => o.value)).toEqual(["", "hakim|Hakim Satu", "hakim|Hakim Dua", "pp|PP Satu", "js|JS Satu", "ptsp|Semua petugas PTSP"]);
    sel.value = "pp|PP Satu";
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.minta.some((m) => m.url.includes("sebagai=PP+Satu") && m.url.includes("peranSebagai=pp")), "permintaan sebagai PP");
    await sampai(() => akarDari(h)!.querySelector("[data-pk]"), "daftar termuat ulang");
    expect(akarDari(h)!.querySelector("#bd-siapa")!.textContent).toContain("dilihat sebagai PP Satu");
    tekan(h, "#bd-alat-btn");
    expect(alat(h)).toEqual(["massal:bas", "gugatan", "saksi", "ktp", "konseptor", "advance", "unggah", "massal:unggah"]); // F1.6; 17 Okt: Putusan Advance untuk konseptor
  });
});

describe("D. daftar perkara", () => {
  it("bawaan: sidang hari ini (mode=hari); urutan prioritas, yang selesai paling belakang", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(h.minta.some((m) => m.url.includes("/perkara-saya?mode=hari"))).toBe(true);
    expect(nomorKartu(h)).toEqual(["581/Pdt.G/2026/PA.Dgl", "410/Pdt.G/2026/PA.Dgl", "455/Pdt.G/2026/PA.Dgl", "540/Pdt.G/2026/PA.Dgl", "512/Pdt.G/2026/PA.Dgl"]);
    const a = akarDari(h)!;
    expect(a.querySelector('[data-pk^="581/"] .bd-prio')!.textContent).toBe("Perlu segera");
    expect(a.querySelector('[data-pk^="512/"] .bd-prio')!.textContent).toBe("Selesai");
  });

  it("nama pihak tidak ada di halaman; tampil hanya saat kursor di 'Para pihak', hilang saat kursor pergi", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(D(h).documentElement.outerHTML).not.toContain("Yulfiani");
    const pihak = akarDari(h)!.querySelector('[data-pk^="581/"] [data-tipn]')!;
    gerak(h, "mouseover", pihak);
    const tip = akarDari(h)!.querySelector("#bd-tip") as HTMLElement;
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain("Yulfiani binti Tasbih");
    expect(tip.textContent).toContain("Andi Rustam bin Syamsudin");
    gerak(h, "mouseout", pihak);
    expect(tip.hidden).toBe(true);
    expect(D(h).documentElement.outerHTML).not.toContain("Yulfiani");
  });

  it("empat tampilan: kartu, daftar ringkas, tabel detail, per tanggal sidang", async () => {
    const h = buka();
    await bukaTampilan(h);
    const a = akarDari(h)!;
    expect(a.querySelectorAll(".bd-kpk").length).toBe(5);
    tekan(h, '[data-lihat="ringkas"]');
    expect(a.querySelectorAll(".bd-brs").length).toBe(5);
    tekan(h, '[data-lihat="tabel"]');
    expect(Array.from(a.querySelectorAll("table.bd-tabelperkara th")).map((x) => x.textContent!.replace(/[▲▼\s]+$/, "").trim())).toEqual([
      "Prioritas", "Nomor perkara", "Jenis", "Sidang", "Kegiatan sidang", "Kelengkapan isian", "Dokumen di SIPP", "Batas minutasi",
    ]);
    expect(a.querySelectorAll("table.bd-tabelperkara tbody tr").length).toBe(5);
    tekan(h, '[data-lihat="tanggal"]');
    const grup = Array.from(a.querySelectorAll(".bd-grupT")).map((g) => g.getAttribute("data-tgl"));
    expect(grup[0]).toBe(HARI_INI);
    expect(new Set(grup)).toEqual(new Set(["2026-10-15", "2026-10-02", "2026-10-19"]));
    expect(a.querySelector(".bd-grupT.hariini")!.textContent).toContain("Hari ini");
    expect(a.querySelector(".bd-grupT.hariini")!.textContent).toContain("3 perkara");
  });

  it("tabel: kolom dapat diurut dengan klik judul (balik arah di klik kedua)", async () => {
    const h = buka();
    await bukaTampilan(h);
    tekan(h, '[data-lihat="tabel"]');
    const urutNomor = () => Array.from(akarDari(h)!.querySelectorAll("table.bd-tabelperkara tbody tr")).map((r) => (r as HTMLElement).getAttribute("data-pk")!.slice(0, 3));
    tekan(h, '[data-urutkol="nomor"]');
    expect(urutNomor()).toEqual(["410", "455", "540", "581", "512"]); // yang selesai tetap di belakang
    tekan(h, '[data-urutkol="nomor"]');
    expect(urutNomor()).toEqual(["581", "540", "455", "410", "512"]);
    expect(akarDari(h)!.querySelector('th[aria-sort="descending"]')!.textContent).toContain("Nomor perkara");
  });

  it("enam urutan, balik arah, dan 'yang belum selesai di depan' dapat dimatikan", async () => {
    const h = buka();
    await bukaTampilan(h);
    const sel = akarDari(h)!.querySelector("#bd-urut") as HTMLSelectElement;
    expect(Array.from(sel.options).map((o) => o.value)).toEqual(["prioritas", "tanggal", "nomor", "jenis", "isian", "cetak"]);
    sel.value = "tanggal";
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(nomorKartu(h)!.map((n) => n!.slice(0, 3))).toEqual(["410", "455", "581", "540", "512"]);
    tekan(h, '[data-bd="arah"]');
    // Yang sama tanggalnya (581 dan 455) tetap berurutan menurut nomor.
    expect(nomorKartu(h)!.map((n) => n!.slice(0, 3))).toEqual(["540", "455", "581", "410", "512"]);
    const depan = akarDari(h)!.querySelector("#bd-depan") as HTMLInputElement;
    depan.checked = false;
    depan.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(nomorKartu(h)!.map((n) => n!.slice(0, 3))).toEqual(["540", "455", "512", "581", "410"]);
    // Pilihan tampilan dan urutan diingat di penyimpanan ekstensi.
    await sampai(() => (h.simpanan.blangkoDerryDaftar as any)?.depan === false && (h.simpanan.blangkoDerryDaftar as any)?.urut === "tanggal", "pilihan tersimpan");
  });

  it("kartu bersakelar keterangan: jenis dan sidang bisa dimatikan, alasan prioritas dinyalakan", async () => {
    const h = buka();
    await bukaTampilan(h);
    const kartu = () => akarDari(h)!.querySelector('[data-pk^="581/"]')!.textContent!;
    expect(kartu()).toContain("Cerai Gugat");
    expect(kartu()).not.toContain("Sidang hari ini");
    const sak = (k: string) => akarDari(h)!.querySelector(`[data-ketk="${k}"]`) as HTMLInputElement;
    sak("jenis").checked = false;
    sak("jenis").dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(kartu()).not.toContain("Cerai Gugat");
    sak("alasan").checked = true;
    sak("alasan").dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(kartu()).toContain("Sidang hari ini");
    expect(kartu()).toContain("Putus hari ini, belum ada putusan di SIPP");
  });

  it("pencarian nomor menyaring daftar", async () => {
    const h = buka();
    await bukaTampilan(h);
    const c = akarDari(h)!.querySelector("#bd-cari") as HTMLInputElement;
    c.value = "540";
    c.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    expect(nomorKartu(h)).toEqual(["540/Pdt.G/2026/PA.Dgl"]);
  });

  it("Pilih tanggal: dua isian tanggal; 'Tampilkan' meminta rentang itu; 'Semua perkara saya' meminta mode=semua", async () => {
    const h = buka();
    await bukaTampilan(h);
    tekan(h, '[data-mode="rentang"]');
    const a = akarDari(h)!;
    expect(a.textContent).toContain("cukup satu tanggal untuk satu hari");
    (a.querySelector("#bd-dari") as HTMLInputElement).value = "2026-10-12";
    (a.querySelector("#bd-sampai") as HTMLInputElement).value = "2026-10-16";
    tekan(h, '[data-bd="rentang"]');
    await sampai(() => h.minta.some((m) => m.url.includes("mode=rentang&dari=2026-10-12&sampai=2026-10-16")), "rentang diminta");
    await sampai(() => a.querySelector("[data-pk]"), "daftar rentang");
    tekan(h, '[data-mode="semua"]');
    await sampai(() => h.minta.some((m) => m.url.includes("/perkara-saya?mode=semua")), "semua diminta");
  });

  it("21 Okt: Pilih tanggal - satu tanggal saja (DARI atau SAMPAI) = satu hari; terbalik ditukar; kosong = petunjuk tanpa galat dan tanpa permintaan", async () => {
    const h = buka();
    await bukaTampilan(h);
    tekan(h, '[data-mode="rentang"]');
    const a = akarDari(h)!;
    const dari = () => a.querySelector("#bd-dari") as HTMLInputElement;
    const sampaiI = () => a.querySelector("#bd-sampai") as HTMLInputElement;
    const adaPesanGalat = () => /Tanggal harus berbentuk/.test(a.textContent || "");
    // keduanya kosong
    dari().value = "";
    sampaiI().value = "";
    const sebelum = h.minta.length;
    tekan(h, '[data-bd="rentang"]');
    await tunggu(50);
    expect(h.minta.length).toBe(sebelum);
    expect(adaPesanGalat()).toBe(false);
    // hanya DARI
    dari().value = "2026-10-14";
    sampaiI().value = "";
    tekan(h, '[data-bd="rentang"]');
    await sampai(() => h.minta.some((m) => m.url.includes("mode=rentang&dari=2026-10-14&sampai=2026-10-14")), "satu hari (DARI)");
    // hanya SAMPAI
    dari().value = "";
    sampaiI().value = "2026-10-15";
    tekan(h, '[data-bd="rentang"]');
    await sampai(() => h.minta.some((m) => m.url.includes("mode=rentang&dari=2026-10-15&sampai=2026-10-15")), "satu hari (SAMPAI)");
    // terbalik
    dari().value = "2026-10-18";
    sampaiI().value = "2026-10-16";
    tekan(h, '[data-bd="rentang"]');
    await sampai(() => h.minta.some((m) => m.url.includes("mode=rentang&dari=2026-10-16&sampai=2026-10-18")), "tertukar");
    expect(adaPesanGalat()).toBe(false);
  });

  it("21 Okt: bawaan panel = Sidang hari ini walau kunjungan lalu menyimpan 'Pilih tanggal'", async () => {
    const h = buka({ simpanan: { blangkoDerryDaftar: { mode: "rentang", lihat: "kartu" } } });
    await bukaTampilan(h);
    expect(h.minta.some((m) => m.url.includes("mode=hari"))).toBe(true);
    expect(h.minta.some((m) => m.url.includes("mode=rentang"))).toBe(false);
    expect(akarDari(h)!.querySelector('[data-mode="hari"][aria-selected="true"]')).toBeTruthy();
  });

  it("daftar kosong hari ini menawarkan 'Lihat semua perkara saya'", async () => {
    const h = buka({ perkara: (u) => (u.includes("mode=hari") ? { isi: { ok: true, data: dataDaftar("hari", { perkara: [] }) } } : undefined) });
    await sampai(() => tawarDari(h), "kartu tawaran");
    klikDerry(h);
    const a = await sampai(() => akarTampak(h), "terbuka");
    await sampai(() => /Tidak ada sidang hari ini/.test(a.textContent || ""), "pesan kosong");
    tekan(h, '[data-mode="semua"]');
    await sampai(() => h.minta.some((m) => m.url.includes("mode=semua")), "semua diminta");
  });

  it("nama akun tidak ditemukan: pesan jelas, bukan daftar satker", async () => {
    const h = buka({ perkara: () => ({ isi: { ok: true, data: dataDaftar("hari", { perkara: [], adaYangCocok: false, nama: "Hakim Satu" }) } }) });
    await sampai(() => tawarDari(h), "kartu tawaran");
    klikDerry(h);
    const a = await sampai(() => akarTampak(h), "terbuka");
    await sampai(() => /tidak ditemukan sebagai majelis/.test(a.textContent || ""), "pesan nama");
    expect(a.querySelector("[data-pk]")).toBeNull();
  });

  it("server gagal: pesan sebabnya dan tombol Coba lagi (bukan daftar kosong)", async () => {
    let gagal = true;
    const h = buka({ perkara: () => (gagal ? { status: 502, isi: { ok: false, alasan: "ALETA Bot tidak terjangkau" } } : undefined) });
    await sampai(() => tawarDari(h), "kartu tawaran");
    klikDerry(h);
    const a = await sampai(() => akarTampak(h), "terbuka");
    await sampai(() => /ALETA Bot tidak terjangkau/.test(a.textContent || ""), "pesan gagal");
    expect(a.querySelector("[data-bd='coba']")).not.toBeNull();
    gagal = false;
    tekan(h, "[data-bd='coba']");
    await sampai(() => a.querySelector("[data-pk]"), "daftar termuat sesudah coba lagi");
  });

  it("peringatan bila bot memotong 500 baris", async () => {
    const h = buka({ perkara: () => ({ isi: { ok: true, data: dataDaftar("semua", { terpotong: true }) } }) });
    await sampai(() => tawarDari(h), "kartu tawaran");
    klikDerry(h);
    const a = await sampai(() => akarTampak(h), "terbuka");
    await sampai(() => a.querySelector("#bd-ketdaftar"), "keterangan daftar");
    expect(a.querySelector("#bd-ketdaftar")!.textContent).toContain("mungkin belum tampil");
  });
});

describe("D. memilih perkara", () => {
  it("daftar mengecil ke satu baris; dropdown sidang berisi tanggal + agenda + keterangan; wadah tahap E-G berlabel", async () => {
    const h = buka();
    await bukaTampilan(h);
    const a = akarDari(h)!;
    let peristiwa: any = null;
    D(h).addEventListener("aleta-bd-perkara", (e: any) => (peristiwa = e.detail));
    (a.querySelector('[data-pk^="581/"]') as HTMLElement).click();
    expect((a.querySelector("#bd-pkpilih") as HTMLElement).hidden).toBe(true);
    const ringkas = a.querySelector("#bd-pkringkas") as HTMLElement;
    expect(ringkas.hidden).toBe(false);
    expect(ringkas.textContent).toContain("581/Pdt.G/2026/PA.Dgl");
    expect(ringkas.textContent).toContain("Cerai Gugat");
    expect(ringkas.textContent).not.toContain("Yulfiani");
    // Sidang yang dipilih: hari ini (bukan yang terakhir secara buta).
    const sel = a.querySelector("#bd-sidang") as HTMLSelectElement;
    expect(sel.options[sel.selectedIndex].textContent).toBe("Ke-2 · 15 Okt 2026 · Pemeriksaan pokok perkara · putus DIKABULKAN (verstek)");
    // Wadah tahap E-G kosong tetapi berlabel.
    const setelah = a.querySelector("#bd-setelah") as HTMLElement;
    expect(setelah.hidden).toBe(false);
    expect(Array.from(setelah.querySelectorAll(".bd-chip")).map((c) => c.textContent)).toEqual(["menyusul · tahap E", "menyusul · tahap F", "menyusul · tahap G", "menyusul · tahap G"]);
    for (const n of ["pilih-blangko", "perlu-diisi", "pratinjau", "cetak"]) expect(h.w.aletaBlangkoDerry.wadah(n)).not.toBeNull();
    expect(peristiwa).toMatchObject({ nomorPerkara: "581/Pdt.G/2026/PA.Dgl", sidangKe: 1 });
    expect(h.w.aletaBlangkoDerry.perkaraTerpilih().sidangDipilih.tanggal).toBe(HARI_INI);
  });

  it("seluruh riwayat sidang perkara dimuat untuk dropdown (keterangan '0' dibuang)", async () => {
    const h = buka();
    await bukaTampilan(h);
    tekan(h, '[data-pk^="581/"]');
    const sel = akarDari(h)!.querySelector("#bd-sidang") as HTMLSelectElement;
    await sampai(() => sel.ownerDocument.querySelector("#bd-sidang")!.querySelectorAll("option").length === 3, "tiga sidang");
    const baru = akarDari(h)!.querySelector("#bd-sidang") as HTMLSelectElement;
    expect(Array.from(baru.options).map((o) => o.textContent)).toEqual([
      "Ke-1 · 1 Okt 2026 · Sidang Pertama · Panggil Tergugat",
      "Ke-2 · 8 Okt 2026 · Sidang Kedua",
      "Ke-3 · 15 Okt 2026 · Pemeriksaan pokok perkara · putus DIKABULKAN (verstek)",
    ]);
    expect(baru.options[baru.selectedIndex].textContent).toContain("15 Okt 2026");
  });

  it("mengganti sidang di dropdown mengumumkan sidang yang dipilih", async () => {
    const h = buka();
    await bukaTampilan(h);
    tekan(h, '[data-pk^="581/"]');
    await sampai(() => akarDari(h)!.querySelectorAll("#bd-sidang option").length === 3, "tiga sidang");
    const sel = akarDari(h)!.querySelector("#bd-sidang") as HTMLSelectElement;
    sel.value = "0";
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(h.w.aletaBlangkoDerry.perkaraTerpilih().sidangDipilih.tanggal).toBe("2026-10-01");
    expect((akarDari(h)!.querySelector("#bd-sidang") as HTMLSelectElement).value).toBe("0");
  });

  it("klik dua kali nomor perkara = ganti perkara; tombol Ganti perkara juga", async () => {
    const h = buka();
    await bukaTampilan(h);
    const a = akarDari(h)!;
    tekan(h, '[data-pk^="581/"]');
    expect((a.querySelector("#bd-pkpilih") as HTMLElement).hidden).toBe(true);
    a.querySelector("#bd-pkringkas .bd-no")!.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true }));
    expect((a.querySelector("#bd-pkpilih") as HTMLElement).hidden).toBe(false);
    expect((a.querySelector("#bd-setelah") as HTMLElement).hidden).toBe(true);
    expect(h.w.aletaBlangkoDerry.perkaraTerpilih()).toBeNull();
    tekan(h, '[data-pk^="410/"]');
    tekan(h, "#bd-ganti");
    expect((a.querySelector("#bd-pkpilih") as HTMLElement).hidden).toBe(false);
  });

  it("nama pihak di baris ringkas perkara terpilih juga hanya saat kursor", async () => {
    const h = buka();
    await bukaTampilan(h);
    tekan(h, '[data-pk^="581/"]');
    const pihak = akarDari(h)!.querySelector("#bd-pkringkas [data-tipn]")!;
    expect(D(h).documentElement.outerHTML).not.toContain("Yulfiani");
    gerak(h, "mouseover", pihak);
    expect(akarDari(h)!.querySelector("#bd-tip")!.textContent).toContain("Yulfiani");
  });
});

describe("D. skor prioritas (murni)", () => {
  const ringkasan = (h: Halaman, p: any, sebagai = ["hakim"]) => h.w.aletaBlangkoDerry.murni.ringkasan({ ...p, sebagai }, { hariIni: HARI_INI });

  it("putus hari ini tanpa putusan di SIPP + sidang hari ini + batas minutasi + belum diunggah = 90 (Perlu segera)", () => {
    const h = buka();
    const r = ringkasan(h, DAFTAR[0]);
    expect(r.skor).toBe(90);
    expect(r.tingkat).toBe("tinggi");
    expect(r.alasan).toEqual(["Sidang hari ini", "Putus hari ini, belum ada putusan di SIPP", "Belum diunggah ke SIPP"]);
  });

  it("putus beberapa hari lalu dengan batas minutasi tinggal 1 hari", () => {
    const h = buka();
    const r = ringkasan(h, DAFTAR[4]);
    expect(r.skor).toBe(30 + 25 + 15);
    expect(r.alasan).toContain("Batas minutasi 1 hari lagi");
    expect(r.sisaMinutasi).toBe(1);
  });

  it("putusan sudah di SIPP = selesai (-100) dan selalu paling belakang; minutasi juga selesai", () => {
    const h = buka();
    expect(ringkasan(h, DAFTAR[1]).tingkat).toBe("selesai");
    expect(ringkasan(h, { ...DAFTAR[4], tanggalMinutasi: "2026-10-10" })).toMatchObject({ selesai: true, dokTxt: "Sudah minutasi" });
  });

  it("sidang belum tiba -10; hakim tanpa putusan tidak punya dokumen yang perlu dibuat", () => {
    const h = buka();
    const r = ringkasan(h, DAFTAR[2]);
    expect(r).toMatchObject({ skor: -10, tingkat: "rendah", tanpaKerja: true, dokTxt: "Belum ada yang perlu dibuat" });
  });

  it("panitera pengganti dinilai dari BAS sidang acuan, bukan dari putusan", () => {
    const h = buka();
    const tanpaBas = { ...DAFTAR[3], sidang: [SI(HARI_INI, "Sidang Pertama", "Mediasi", { adaBas: false })] };
    expect(ringkasan(h, tanpaBas, ["pp"])).toMatchObject({ dj: ["bas"], dokTxt: "Belum diunggah ke SIPP", skor: 30 + 15 });
    const denganBas = { ...DAFTAR[3], sidang: [SI(HARI_INI, "Sidang Pertama", "Mediasi", { adaBas: true })] };
    expect(ringkasan(h, denganBas, ["pp"])).toMatchObject({ selesai: true, tingkat: "selesai" });
  });

  it("relaas juru sita tidak terbaca dari jadwal: 'belum terukur', tidak pernah dianggap selesai", () => {
    const h = buka();
    const r = ringkasan(h, DAFTAR[0], ["js"]);
    expect(r).toMatchObject({ dj: ["rel"], selesai: false, dokTxt: "Belum terukur" });
  });

  it("sidang acuan: hari ini, kalau tidak ada yang terakhir sampai hari ini, kalau tidak ada yang terdekat", () => {
    const h = buka();
    const idx = h.w.aletaBlangkoDerry.murni.indeksAcuan;
    const s = (...t: string[]) => t.map((tanggal) => ({ tanggal }));
    expect(idx(s("2026-10-01", "2026-10-15", "2026-10-22"), HARI_INI)).toBe(1);
    expect(idx(s("2026-10-01", "2026-10-08", "2026-10-22"), HARI_INI)).toBe(1);
    expect(idx(s("2026-10-19", "2026-10-22"), HARI_INI)).toBe(0);
    expect(idx([], HARI_INI)).toBe(-1);
  });

  it("peran dari golongan menu: ketua = hakim, panitera/panmud = PP, jurusita = JS", () => {
    const h = buka();
    const p = (g: string[]) => Array.from(h.w.aletaBlangkoDerry.murni.peranDariGolongan(g)).sort();
    expect(p(["ketua"])).toEqual(["hakim"]);
    expect(p(["panmud", "panitera-utama"])).toEqual(["pp"]);
    expect(p(["jurusita", "kasir"])).toEqual(["js", "kasir"]);
    expect(p(["sekretariat", "lain-tetap", "mediator"])).toEqual([]);
  });
});

describe("tidak ada yang ditulis", () => {
  it("seluruh permintaan jaringan GET ke rute ALETA saja - tidak satu pun ke ABT/SIPP", async () => {
    const h = buka({ orang: "admin" });
    await bukaTampilan(h);
    tekan(h, '[data-pk^="581/"]');
    await sampai(() => akarDari(h)!.querySelectorAll("#bd-sidang option").length === 3, "riwayat");
    tekan(h, "#bd-widget-btn");
    tekan(h, "#bd-alat-btn");
    expect(h.minta.length).toBeGreaterThan(2);
    for (const m of h.minta) {
      expect(m.cara).toBe("GET");
      expect(m.url.startsWith("/aleta/api/aleta-ecourt/")).toBe(true);
    }
  });
});
