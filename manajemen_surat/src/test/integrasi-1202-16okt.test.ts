// @vitest-environment node
/**
 * ============================================================================
 * 16 OKT 2026 - INTEGRASI 1.202.0: SAMBUNGAN REKOMENDASI TAHAP E -> F-G, DAN PEMETAAN PAKET I2
 * ============================================================================
 *
 * A. Saran blangko portal (lib/rekomendasi-blangko.ts, rute jadwal sidang ?rekomendasi=1) mengisi kolom "Disarankan" jendela pilih
 *    blangko Blangko Derry lewat titik sambung kerangka aletaBlangkoDerry.pasangRekomendasi(fn) - dijalankan SUNGGUHAN di jsdom
 *    (panel-alat.js + abt-klien.js + blangko-derry.js + blangko-derry-isian.js) dengan jawaban portal dihitung oleh fungsi TS yang sama.
 * B. Paket ABT I2 16 Okt yang terpasang: abt-wali-adhal (folder 7 Wali Adhal, menu 113), abt-ikrar-derry (penetapan ikrar [90]/[90a]/[91],
 *    BAS ALUR 10 [4], PTSP @ 3/3a/3b), abt-mediasi-derry (relaas mediasi [JS] 10.1/10.2, PTSP @ 4) - terpetakan di putusan per jenis/
 *    keadaan, set putusan, BAS (salinan di folder jenis), relaas, dan peta tugas peran. Nama berkas = PASANG.md paket (persis).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { tentukanAlurBas } from "@/lib/alur-bas";
import { bawaanPemetaan } from "@/lib/pemetaan-blangko";
import { BLANGKO_RELAAS, blangkoRelaas, setUntukPerkara } from "@/lib/pohon-blangko";
import { FOLDER_MENU_PUTUSAN, masukanRekomendasiDariBaris, PETA_PUTUSAN_BAWAAN, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";
import { cariBerkasBasJenis, salinanBasJenis } from "@/lib/salinan-bas-jenis";
import { petaStatusDariBerkas, statusDariNamaBlangko, tugasBlangko } from "@/lib/tugas-blangko";

const A = "derry_briantono/";
const CG = "Cerai Gugat";
const CT = "Cerai Talak";

// Nama berkas paket I2 (PASANG.md, 16 Okt 2026).
const WA = {
  kabul: "[01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf",
  kabulHadir: "[01a] [Kabul] Wali Adhal - Wali Hadir Tetap Enggan.rtf",
  tolak: "[03] [Tolak] Wali Adhal - Keengganan Wali Beralasan Hukum.rtf",
  cabut: "[98] [Cabut] Wali Adhal.rtf",
};
const IKRAR = {
  p90: "[90] [Ikrar] Penetapan Ikrar Talak - P Hadir & T Tidak Hadir.rtf",
  p90a: "[90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir.rtf",
  p91: "[91] [Ikrar Gugur] Penetapan Kekuatan Putusan Gugur - P Tidak Ikrar 6 Bulan.rtf",
  bas4: "BAS ALUR 10 [4] BAS Ikrar Talak - P & T Tidak Hadir, Tunda Tenggang Waktu 6 Bulan.rtf",
  ptsp: ["@ 3 - PMH - PHS Ikrar Talak.rtf", "@ 3a - PHS Ikrar Talak.rtf", "@ 3b - PHS Ikrar Talak Lanjutan.rtf"],
};
const MEDIASI = { p: "[JS] 10.1. Relaas Panggilan Mediasi P.rtf", t: "[JS] 10.2. Relaas Panggilan Mediasi T.rtf", ptsp: "@ 4 - Penetapan Penunjukan Mediator.rtf" };

// ============================================================================
// A. Sambungan rekomendasi
// ============================================================================
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");
const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-15";
const NOMOR = "581/Pdt.G/2026/PA.Dgl";
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

/** Baris jadwal sidang bot untuk sidang ke-2 perkara uji (putus verstek dikabulkan, T tidak hadir). */
const BARIS_BOT = {
  nomorPerkara: NOMOR,
  sidangId: "s2026-10-15",
  tanggalSidang: HARI_INI,
  jenisPerkara: CG,
  urutanSidang: 2,
  dihadiriOleh: 2,
  agenda: "Pemeriksaan pokok perkara",
  alasanDitunda: "putus DIKABULKAN (verstek)",
  sudahPutus: true,
  statusPutusan: "Dikabulkan",
  verstekPutusan: true,
  panggilan: { tergugatPernahHadir: false },
  lewatEcourt: false,
};
const HASIL_PORTAL = rekomendasiBlangko(masukanRekomendasiDariBaris(BARIS_BOT));
const tanpaRtf = (b: string) => b.replace(/\.rtf$/i, "");
const PUT_SARAN = tanpaRtf(HASIL_PORTAL.putusan[0].berkas);
const BAS_SARAN = tanpaRtf(HASIL_PORTAL.bas.find((b) => b.utama)!.berkas);

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const DAFTAR = [
  {
    nomorPerkara: NOMOR, perkaraId: "10154", jenisPerkara: CG, alurPerkaraId: 15, sudahPutus: true, tanggalPutusan: HARI_INI, tanggalMinutasi: "",
    adaBerkasPutusan: false, lewatEcourt: false, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
    sebagai: ["hakim"], pihak: { penggugat: ["Yulfiani binti Tasbih"], tergugat: ["Andi Rustam bin Syamsudin"] },
    sidang: [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI(HARI_INI, "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)", { urutan: 2 })],
  },
];
const ORANG: Record<string, { nama: string; peran: string; roleId: string; golonganMenu: string[] }> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
};
// Sidebar ABT: kelompok putusan memakai ALIAS menu ("CG - Putusan"), BAS memakai nama menu - keduanya harus dikenali.
const MENU =
  `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel">` +
  `<a href="${BERANDA}?a=D1&c=" title="(2 Blangko)">CG - Putusan</a><a href="${BERANDA}?a=D2&c=" title="(2 Blangko)">Cerai Gugat - BAS</a></div>`;
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");

type Halaman = { dom: JSDOM; w: any; minta: string[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; portalSaran?: boolean } = {}): Halaman {
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Hakim</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.201.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_: unknown, cb?: (h: unknown) => void) => cb && cb({ ok: true }), lastError: undefined },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          return Object.fromEntries(daftar.filter((k) => k in simpanan).map((k) => [k, polos(simpanan[k])]));
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: string[] = [];
  const orang = ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: false, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: null, perkara: polos(DAFTAR) } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) {
      return json({ ok: true, data: { sipp: { jadwalPerkara: [{ sidangId: "s2026-10-01", tanggalSidang: "2026-10-01", jamSidang: "09:00:00", agenda: "Sidang Pertama", alasanDitunda: "Panggil Tergugat", urutanSidang: 1 }, { sidangId: "s2026-10-15", tanggalSidang: HARI_INI, jamSidang: "09:00:00", agenda: "Pemeriksaan pokok perkara", alasanDitunda: "putus DIKABULKAN (verstek)", urutanSidang: 2 }] } } });
    }
    if (url.includes("/aleta-ecourt/sidang?dari=")) {
      if (p.portalSaran === false) return json({ ok: false }, 404);
      // Sama dengan rute portal: baris bot + rekomendasiBlangko(masukanRekomendasiDariBaris(baris)); baris perkara lain ikut (disaring ekstensi).
      const lain = { ...BARIS_BOT, nomorPerkara: "582/Pdt.G/2026/PA.Dgl", sidangId: "lain" };
      return json({ ok: true, data: { available: true, sidang: [lain, BARIS_BOT].map((b) => ({ ...b, rekomendasiBlangko: rekomendasiBlangko(masukanRekomendasiDariBaris(b)) })) } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry")) return json({ ok: true, data: { ada: false, folder: [], sumber: "pohon", sebab: "" } });
    if (url === BERANDA) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK("Putusan Cerai Gugat", [[PUT_SARAN, "A01", "B01"], ["[02] [Kabul] CG - F", "A02", "B02"]]));
    if (url.startsWith(`${BERANDA}?a=D2`)) return html(HAL_KELOMPOK("Cerai Gugat - BAS", [[BAS_SARAN, "A11", "B11"], ["BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T", "A12", "B12"]]));
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return { dom, w, minta };
}
const akar = (h: Halaman) => h.w.document.getElementById("aleta-bd-akar") as HTMLElement;
const q = (h: Halaman, s: string) => akar(h).querySelector(s) as HTMLElement | null;
const qq = (h: Halaman, s: string) => Array.from(akar(h).querySelectorAll(s)) as HTMLElement[];
async function bukaJendela(h: Halaman) {
  await sampai(() => h.w.document.getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(h.w.document.querySelectorAll("#navbar .accordion")).find((b: any) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  q(h, `[data-pk="${NOMOR}"]`)!.click();
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
  q(h, '[data-bd2="bukamodal"]')!.click();
  await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
}

describe("A. saran portal Tahap E di jendela pilih blangko F-G", () => {
  it("hakim: kolom Disarankan memakai putusan dari portal (alasan tunda + keadaan), kelompok ditemukan lewat alias menu; satu permintaan per sidang", async () => {
    const h = buka();
    await bukaJendela(h);
    // Jawaban portal tiba di latar; jendela digambar ulang dengan alasan portal.
    const alasan = await sampai(() => qq(h, ".bd-alasanrek").find((x) => /dari keterangan sidang ke-2/.test(x.textContent || "")), "alasan saran portal");
    expect(alasan.textContent).toContain('"putus DIKABULKAN (verstek)"');
    expect(alasan.textContent).toContain(HASIL_PORTAL.putusan[0].alasan.replace(/\.$/, ""));
    // Kelompok tampil dengan judul halaman kelompoknya; kuncinya (data-kel) tetap nama menu di bilah ABT.
    expect(qq(h, "[data-kelmodal] .kn").map((x) => x.textContent)).toEqual(["Disarankan", "Putusan Cerai Gugat"]);
    const tombol = await sampai(() => q(h, `[data-bl="${PUT_SARAN}"]:not([disabled])`), "blangko saran dapat dipilih");
    expect(tombol.getAttribute("data-kel")).toBe("CG - Putusan");
    expect(tombol.querySelector(".bd-lencana")!.textContent).toBe("disarankan");
    // Ringkasan tahap 2 menyebut saran yang sama.
    expect(q(h, "#bd-saranblangko")!.textContent).toContain("dari keterangan sidang ke-2");
    // Satu permintaan jadwal sidang tanggal itu, berparameter rekomendasi=1 dan nomor perkara.
    const permintaan = h.minta.filter((u) => u.includes("/aleta-ecourt/sidang?dari="));
    expect(permintaan).toHaveLength(1);
    expect(permintaan[0]).toContain(`dari=${HARI_INI}&sampai=${HARI_INI}&cari=${encodeURIComponent(NOMOR)}`);
    expect(permintaan[0]).toContain("rekomendasi=1");
    // Bentuk titik sambung: berkas tanpa .rtf, jenis put/bas/rel.
    const rek = h.w.aletaBlangkoDerryIsian.rekomendasi();
    expect(rek[0]).toMatchObject({ berkas: PUT_SARAN, kelompok: "CG - Putusan", jenis: "put" });
    expect(rek.some((r: { jenis: string; kelompok: string }) => r.jenis === "bas" && r.kelompok === "Cerai Gugat - BAS")).toBe(true);
  });

  it("PP: BAS saran portal lebih dulu (jenis peran akun), kelompok BAS lewat nama menu", async () => {
    const h = buka({ orang: "pp" });
    await bukaJendela(h);
    const tombol = await sampai(() => q(h, `[data-bl="${BAS_SARAN}"]:not([disabled])`), "BAS saran");
    expect(tombol.getAttribute("data-kel")).toBe("Cerai Gugat - BAS");
    await sampai(() => (h.w.aletaBlangkoDerryIsian.rekomendasi()[0] || {}).jenis === "bas", "BAS lebih dulu");
  });

  it("portal gagal: cadangan sederhana tetap memberi saran (perilaku F-G lama), tanpa mengulang permintaan terus-menerus", async () => {
    const h = buka({ portalSaran: false });
    await bukaJendela(h);
    await sampai(() => h.minta.some((u) => u.includes("/aleta-ecourt/sidang?dari=")), "permintaan saran");
    await tunggu(30);
    const rek = h.w.aletaBlangkoDerryIsian.rekomendasi();
    expect(rek[0].alasan).toContain("dari keterangan sidang ke-2");
    expect(rek[0].jenis).toBe("put");
    expect(h.minta.filter((u) => u.includes("/aleta-ecourt/sidang?dari="))).toHaveLength(1);
  });

  it("murni: saranDariPortal - utama + paling banyak 3 alternatif per jenis, kelompok dari menu/alias/folder; barisSidangSaran memilih sidang yang sama", () => {
    const h = buka();
    const m = h.w.aletaBlangkoDerryIsian.murni;
    const menu = [{ nama: "Putusan Cerai Gugat" }, { nama: "CG - BAS" }, { nama: "Relaas" }];
    const out = polos(m.saranDariPortal(HASIL_PORTAL, menu, { urutan: 2 })) as Array<{ berkas: string; kelompok: string; jenis: string; alasan: string; utama: boolean }>;
    expect(out[0]).toMatchObject({ jenis: "put", berkas: PUT_SARAN, kelompok: "Putusan Cerai Gugat", utama: true });
    for (const j of ["put", "bas", "rel"]) expect(out.filter((x) => x.jenis === j && !x.utama).length).toBeLessThanOrEqual(3);
    expect(out.filter((x) => x.jenis === "bas").every((x) => x.kelompok === "CG - BAS")).toBe(true);
    // Relaas pemberitahuan putusan T: folder "derry_briantono/Relaas" dikenali dari nama foldernya.
    const rel = out.find((x) => x.jenis === "rel");
    expect(rel && rel.kelompok).toBe("Relaas");
    expect(polos(m.saranDariPortal(null, menu, {}))).toEqual([]);
    expect(m.kelompokUntukSaran([{ nama: "Wali Adhal - Putusan" }], { menu: "Putusan Wali Adhal", alias: ["Wali Adhal - Putusan"], folder: `${A}7 Wali Adhal` })).toBe("Wali Adhal - Putusan");
    expect(m.kelompokUntukSaran([{ nama: "Wali Adhal" }], { menu: "x", alias: [], folder: `${A}7 Wali Adhal` })).toBe("Wali Adhal");
    const k = { nomor: NOMOR, tanggal: HARI_INI, sidangId: "s2" };
    const baris = [{ nomorPerkara: "lain", sidangId: "s2" }, { nomorPerkara: NOMOR, sidangId: "s1", tanggalSidang: HARI_INI }, { nomorPerkara: NOMOR, sidangId: "s2", tanggalSidang: HARI_INI }];
    expect(m.barisSidangSaran(baris, k).sidangId).toBe("s2");
    expect(m.barisSidangSaran(baris.slice(0, 2), k).sidangId).toBe("s1");
    expect(m.barisSidangSaran([], k)).toBeNull();
  });
});

// ============================================================================
// B. Pemetaan paket I2
// ============================================================================
describe("B. wali adhal (abt-wali-adhal, menu 113)", () => {
  it("putusan per status: kabul [01] (+ varian [01a]), tolak [03], cabut [98], gugur/NO -> 9b; ejaan SIPP 'Wali Adhol' dipadankan", () => {
    const pilih = (status: string) => pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, "Wali Adhol", status, false);
    expect(pilih("Dikabulkan")).toMatchObject({ tingkat: "status", baris: { berkas: tanpaRtf(WA.kabul), blangko: "Putusan Wali Adhal", blangkoLain: ["Wali Adhal - Putusan"] } });
    expect(pilih("Dikabulkan")!.baris.catatan).toBe(`varian: ${tanpaRtf(WA.kabulHadir)}`);
    expect(pilih("Ditolak")!.baris.berkas).toBe(tanpaRtf(WA.tolak));
    expect(pilih("Dicabut")!.baris.berkas).toBe(tanpaRtf(WA.cabut));
    expect(pilih("Digugurkan")!.baris).toMatchObject({ berkas: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)" });
    expect(pilih("Tidak Dapat Diterima")!.baris.blangko).toBe("Putusan Permohonan Umum (Cabut/Gugur/NO)");
    expect(pilih("")).toMatchObject({ tingkat: "jenis", baris: { berkas: tanpaRtf(WA.kabul) } });
    expect(FOLDER_MENU_PUTUSAN["Putusan Wali Adhal"]).toBe("7 Wali Adhal");
  });

  it("rekomendasi putusan: folder 7 Wali Adhal, menu + alias untuk tombol Buka di ABT, varian wali hadir sebagai alternatif", () => {
    const h = rekomendasiBlangko({ jenisPerkara: "Wali Adhol", nomorPerkara: "173/Pdt.P/2026/PA.Dgl", urutanSidang: 1, dihadiriOleh: 1, sudahPutus: true, statusPutusan: "Dikabulkan" });
    expect(h.putusan.map((r) => [r.folder, r.berkas, r.utama])).toEqual([
      [`${A}7 Wali Adhal`, WA.kabul, true],
      [`${A}7 Wali Adhal`, WA.kabulHadir, false],
    ]);
    expect(h.putusan[0]).toMatchObject({ menu: "Putusan Wali Adhal", alias: ["Wali Adhal - Putusan"] });
    // BAS ALUR 19 wali adhal (paket D3, menu 114) tetap terpakai.
    expect(h.bas[0].folder).toBe(`${A}7 Wali Adhal - BAS`);
  });

  it("set putusan: perkara wali adhal mendapat set 7 Wali Adhal, bukan perwalian; peta tugas = hakim, status dari nama berkas", () => {
    const cocok = setUntukPerkara("Wali Adhol").filter((s) => s.cocok);
    expect(cocok.map((s) => s.folder)).toEqual([`${A}7 Wali Adhal`]);
    expect(setUntukPerkara("Perwalian").filter((s) => s.cocok).map((s) => s.folder)).toContain(`${A}6 Perwalian`);
    for (const b of Object.values(WA)) expect(tugasBlangko(`${A}7 Wali Adhal/${b}`), b).toBe("hakim");
    expect(petaStatusDariBerkas(Object.values(WA)).map((x) => [x.status, x.berkas])).toEqual([
      ["Dikabulkan", WA.kabul],
      ["Ditolak", WA.tolak],
      ["Dicabut", WA.cabut],
    ]);
  });
});

describe("B. ikrar talak (abt-ikrar-derry)", () => {
  const ikrar = (dihadiriOleh: number | null, extra: Record<string, unknown> = {}) =>
    rekomendasiBlangko({ jenisPerkara: CT, nomorPerkara: "90/Pdt.G/2026/PA.Dgl", urutanSidang: 5, dihadiriOleh, sidangIkrarTalak: true, sudahPutus: true, statusPutusan: "Dikabulkan", ditunda: false, ...extra });

  it("sidang ikrar: penetapan ikrar [90] (T tidak hadir) / [90a] (keduanya hadir), bukan putusan CT; Pemohon tidak hadir -> tanpa penetapan", () => {
    expect(ikrar(2).putusan.map((r) => [r.berkas, r.utama])).toEqual([[IKRAR.p90, true], [IKRAR.p90a, false]]);
    expect(ikrar(1).putusan.map((r) => [r.berkas, r.utama])).toEqual([[IKRAR.p90a, true], [IKRAR.p90, false]]);
    expect(ikrar(2).putusan[0]).toMatchObject({ folder: `${A}1a Perceraian CT`, menu: "Putusan Cerai Talak", perkiraan: false });
    expect(ikrar(null).putusan[0]).toMatchObject({ berkas: IKRAR.p90, perkiraan: true });
    expect(ikrar(3).putusan).toEqual([]);
    expect(ikrar(4).putusan).toEqual([]);
    expect(ikrar(3, { alasanDitunda: "Pemohon tidak ikrar dalam 6 bulan" }).putusan.map((r) => r.berkas)).toEqual([IKRAR.p91]);
    // Sidang biasa cerai talak tidak terpengaruh.
    expect(rekomendasiBlangko({ jenisPerkara: CT, urutanSidang: 2, dihadiriOleh: 2, sudahPutus: true, statusPutusan: "Dikabulkan", verstekPutusan: true }).putusan[0].berkas).not.toMatch(/Ikrar/);
  });

  it("BAS ALUR 10 [4]: P & T tidak hadir -> [4] (bukan tebakan [1]); salinannya di 1a Perceraian CT - BAS dan ditemukan BAS massal", () => {
    const t = tentukanAlurBas({ jenisPerkara: CT, urutanSidang: 5, dihadiriOleh: 4, sidangIkrarTalak: true });
    expect(t.alur?.id).toBe("alur-10");
    expect(t.langkah?.kode).toBe("4");
    expect(t.perkiraan).toBe(false);
    const s = salinanBasJenis(`${A}ALUR 10 Cerai Talak Sidang Ikrar Talak`, t.langkah!.berkas, CT);
    expect(s).toEqual([{ folder: `${A}1a Perceraian CT - BAS`, berkas: IKRAR.bas4, menu: "Cerai Talak - BAS", alias: "CT - BAS" }]);
    expect(salinanBasJenis(`${A}ALUR 10 Cerai Talak Sidang Ikrar Talak`, t.langkah!.berkas, CG)).toEqual([]);
    expect(cariBerkasBasJenis(IKRAR.bas4, CT)).toMatchObject({ folder: `${A}1a Perceraian CT - BAS`, berkas: IKRAR.bas4 });
    const r = ikrar(4, { ditunda: true });
    expect(r.bas.find((b) => b.utama)).toMatchObject({ folder: `${A}1a Perceraian CT - BAS`, berkas: IKRAR.bas4, menu: "Cerai Talak - BAS" });
    // Kehadiran lain tetap seperti sebelumnya.
    expect(tentukanAlurBas({ jenisPerkara: CT, urutanSidang: 5, dihadiriOleh: 3, sidangIkrarTalak: true }).langkah?.kode).toBe("3");
  });

  it("peta tugas: penetapan ikrar = hakim tanpa status putusan; PTSP ikrar = PTSP; BAS [4] = panitera", () => {
    for (const b of [IKRAR.p90, IKRAR.p90a, IKRAR.p91]) {
      expect(tugasBlangko(`${A}1a Perceraian CT/${b}`), b).toBe("hakim");
      expect(statusDariNamaBlangko(b), b).toBeNull(); // tidak pernah terpilih sebagai putusan per status
    }
    for (const b of [...IKRAR.ptsp, MEDIASI.ptsp]) expect(tugasBlangko(`${A}PTSP/${b}`), b).toBe("ptsp");
    expect(tugasBlangko(`${A}1a Perceraian CT - BAS/${IKRAR.bas4}`)).toBe("panitera");
  });
});

describe("B. mediasi (abt-mediasi-derry)", () => {
  it("relaas panggilan mediasi per pihak; semua hadir = tidak dipanggil; daftar blangko relaas memuatnya; tugas juru sita", () => {
    expect(blangkoRelaas("mediasi", "pertama")!.berkas).toBe(MEDIASI.p);
    expect(blangkoRelaas("mediasi", "kedua")!.berkas).toBe(MEDIASI.t);
    expect(blangkoRelaas("mediasi", "tidak-perlu")).toBeNull();
    expect(BLANGKO_RELAAS.filter((b) => b.keadaan === "mediasi").map((b) => [b.folder, b.menuAbt.nama])).toEqual([
      [`${A}Relaas`, "Relaas dan PBT (Blangko Derry)"],
      [`${A}Relaas`, "Relaas dan PBT (Blangko Derry)"],
    ]);
    // Kunci pemetaan admin relaas tidak bertambah: tata kata kuncinya (portal = jurusita.js) belum mengenal "mediasi",
    // dan relaas massal tidak menyusun dokumen mediasi (jadwal mediasi bukan jadwal sidang).
    expect(bawaanPemetaan("relaas").some((x) => /mediasi/i.test(x.namaBerkas))).toBe(false);
    for (const b of [MEDIASI.p, MEDIASI.t]) expect(tugasBlangko(`${A}Relaas/${b}`)).toBe("jurusita");
  });

  it("rekomendasi: sidang ditunda untuk mediasi -> relaas mediasi pihak yang tidak hadir sebagai alternatif, panggilan sidang tetap utama", () => {
    const r = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 2, ditunda: true, alasanDitunda: "Mediasi dengan mediator hakim" });
    const mediasi = r.relaas.find((x) => x.berkas === MEDIASI.t);
    expect(mediasi).toMatchObject({ utama: false, folder: `${A}Relaas` });
    expect(r.relaas[0].utama).toBe(true);
    expect(r.relaas.some((x) => x.berkas === MEDIASI.p)).toBe(false); // Penggugat hadir
    // Laporan/hasil mediasi bukan panggilan mediasi.
    expect(rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, ditunda: true, alasanDitunda: "laporan mediasi tidak berhasil" }).relaas.some((x) => x.berkas === MEDIASI.t)).toBe(false);
  });
});
