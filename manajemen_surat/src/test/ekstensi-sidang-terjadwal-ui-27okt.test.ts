// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * JADWALKAN BAS DAN TUNDA - TOMBOL, PANEL, PASANGAN BERKAS, MUATAN KE SERVER (27 Okt 2026)
 * ============================================================================
 *
 * sidang-terjadwal.js dijalankan SUNGGUHAN di jsdom bersama panel-alat.js (hak peran, mode tampilan),
 * putusan-terjadwal.js (tetangga tombolnya), dan putusan-terjadwal-pasangan.js, atas replika halaman
 * perkara dan daftar/dashboard SIPP, dengan server portal TIRUAN yang menyimpan semua permintaannya.
 * Yang dijaga:
 *
 *   - tombol "Jadwalkan BAS" / "Jadwalkan Tunda" tepat sesudah "Jadwalkan Putusan" per peran: BAS untuk
 *     golongan BAS massal (PP, Panitera, Admin, Super Admin), Tunda untuk yang boleh menunda sidang
 *     (hakim, ketua, panitera, PP, admin); peran lain dan tampilan Lama tidak melihatnya;
 *   - panel bawaan TERLIPAT; Jadwalkan Putusan tidak berubah;
 *   - berkas BAS yang diseret dipasangkan ke sidang menurut nomor perkara (cocok / tidak cocok / ganda /
 *     bukan BAS / manual); BAS yang sudah ada di SIPP hanya diganti bila dicentang tegas;
 *   - muatan POST multipart (BAS) dan JSON (tunda) persis kontrak server; penolakan server ditampilkan;
 *   - pemeriksaan sisa blangko membatalkan penjadwalan; tunda hanya pada hari sidang;
 *   - antrean dengan Batal dan Jadwal ulang.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const PASANGAN = baca("putusan-terjadwal-pasangan.js");
const PTJ = baca("putusan-terjadwal.js");
const STJ = baca("sidang-terjadwal.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string | (() => string), batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${typeof keterangan === "function" ? keterangan() : keterangan}`);
    await tunggu(10);
  }
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

const hariIniWita = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

type Panggilan = { metode: string; alamat: string; badan: any; formulir?: Record<string, any> };
type Opsi = {
  peran?: string | null;
  tampilan?: "lama" | "ui";
  halaman?: "perkara" | "daftar" | "dasbor";
  sidang?: Array<Record<string, unknown>>;
  antrean?: any[];
  usulan?: any;
  tolakBuat?: { sebab: string; tolak?: Array<{ nomorPerkara: string; sebab: string }> };
  deteksiLanjut?: boolean;
  /** Ringkasan hitungan yang dijawab server pada GET ...?ringkas=1 (lencana tombol). */
  ringkasan?: { bas: { menunggu: number; jalan: number }; tunda: { menunggu: number; jalan: number } };
};

function sidangContoh(): Array<Record<string, unknown>> {
  const tgl = hariIniWita();
  return [
    { sidangId: "9001", perkaraId: "30684", nomorPerkara: NOMOR, jenisPerkara: "Cerai Gugat", tanggalSidang: tgl, jamSidang: "09:00", agenda: "Pembuktian", sudahPutus: false, ditunda: false, adaBas: false },
    { sidangId: "9002", perkaraId: "30685", nomorPerkara: "685/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalSidang: tgl, jamSidang: "09:30", agenda: "Jawab-menjawab", sudahPutus: false, ditunda: false, adaBas: true },
    { sidangId: "9003", perkaraId: "30686", nomorPerkara: "686/Pdt.P/2026/PA.Dgl", jenisPerkara: "Itsbat Nikah", tanggalSidang: tgl, jamSidang: "10:00", agenda: "Putusan", sudahPutus: true, ditunda: false, adaBas: false },
  ];
}

function buka(o: Opsi = {}) {
  const halaman = o.halaman ?? "perkara";
  const jalur = halaman === "perkara" ? "/SIPP/detil_perkara_agama" : halaman === "dasbor" ? "/SIPP/main" : "/SIPP/perkara_list";
  const tabelDaftar = `<table id="daftar"><tr><th>No</th><th>Nomor</th></tr><tr><td>1</td><td>${NOMOR}</td></tr></table>`;
  const isiDaftar =
    `<div id="konten-sipp"><div id="pageTitle">DAFTAR PERKARA PERDATA GUGATAN</div><hr class="thick-line">` +
    `<div id="left"><input id="cetak_perkara_list" type="submit" value="Cetak" class="btn"></div><div id="pages">${tabelDaftar}</div></div>`;
  const isiDasbor = `<section class="content-header"><h1><small>DASHBOARD PERKARA PERTAMA</small> <small>[Statistik Perkara]</small></h1></section><div class="konten"><section class="content">${tabelDaftar}</section></div>`;
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">` +
      (halaman === "perkara"
        ? `<table width="100%" id="submenus"><tr><td><table><tr><td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara">Kembali</a></td></tr></table></td></tr></table>`
        : halaman === "dasbor"
          ? isiDasbor
          : isiDaftar) +
      `</div></body></html>`,
    { url: `${ASAL}${jalur}`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: o.tampilan || "ui", ujiIzinkanNyata: true };
  w.chrome = {
    runtime: { id: "uji", getManifest: () => ({ version: "1.205.19" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async (k: string | string[]) => void [k].flat().forEach((n) => delete simpanan[n]),
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);

  const panggilan: Panggilan[] = [];
  const jawab = (data: unknown, status = 200, galat?: string) => ({
    ok: status < 400,
    status,
    json: async () => (galat ? { ok: false, error: { message: galat } } : { ok: status < 400, data }),
  });
  const butirServer = o.antrean ?? [];
  const alatAmbilTiruan = async (alamat: string, opsi: any) => {
    const metode = String((opsi && opsi.method) || "GET").toUpperCase();
    let badan: any = null;
    let formulir: Record<string, any> | undefined;
    if (opsi && typeof opsi.body === "string") badan = JSON.parse(opsi.body);
    else if (opsi && opsi.body && typeof opsi.body.get === "function") {
      formulir = {};
      for (const [k, v] of opsi.body.entries()) formulir[k] = typeof v === "string" ? v : { nama: v.name, ukuran: v.size };
    }
    panggilan.push({ metode, alamat, badan, formulir });
    if (alamat.includes("/sipp-ide/jendela")) {
      return jawab({
        available: true,
        ok: true,
        tunda: o.usulan === undefined ? { usulan: { alasan: "Panggilan para pihak belum patut", agenda: "Pembuktian", tanggal: "2099-02-10", jam: "09:00", penjelasan: "Usulan dari riwayat sidang." }, kehadiranAntrian: 2 } : o.usulan,
      });
    }
    if (alamat.includes("/aleta-ecourt/sidang-terjadwal")) {
      if (metode === "POST") {
        if (o.tolakBuat) return jawab({ ok: false, sebab: o.tolakBuat.sebab, tolak: o.tolakBuat.tolak || [] }, 400);
        const daftar = formulir ? JSON.parse(formulir.butir) : badan.butir;
        return jawab({ ok: true, butir: daftar.map((b: any, i: number) => ({ id: `stj-${i + 1}`, nomorPerkara: b.nomorPerkara, waktuWita: `2099-01-05 08:0${i}` })), perkiraanSelesai: "2099-01-05 08:30" });
      }
      if (metode === "PATCH") return jawab({ ok: true, butir: { id: badan.id } });
      return jawab({
        ok: true,
        butir: butirServer,
        pelaksanaNyala: true,
        ...(alamat.includes("ringkas=1") ? { ringkasan: o.ringkasan ?? { bas: { menunggu: 0, jalan: 0 }, tunda: { menunggu: 0, jalan: 0 } } } : {}),
      });
    }
    if (alamat.includes("/aleta-ecourt/sidang")) return jawab({ available: true, sidang: o.sidang ?? sidangContoh() });
    return jawab({ ok: false, sebab: `tak dikenal: ${alamat}` }, 404);
  };
  const peran = o.peran === undefined ? "Super Admin" : o.peran;
  Object.assign(w, {
    penggunaTerakhir: peran === null ? null : { nama: "Petugas Satu", peran },
    boleh: () => true,
    cariNomorPerkara: () => NOMOR,
    a30PerkaraIdUntukAbt: async () => "30684",
    namaPenggunaSipp: () => "Petugas Satu",
    alatAmbil: alatAmbilTiruan,
    alatSidangPadaTanggal: async () => [],
    barisPerkaraDiHalaman: () => [],
  });
  if (o.deteksiLanjut !== undefined) {
    w.aletaDeteksiSisa = { tinjau: async () => ({ lanjut: o.deteksiLanjut, periksa: true, temuan: [] }) };
  }
  vm.runInContext(PASANGAN, ctx, { filename: "putusan-terjadwal-pasangan.js" });
  if (halaman === "perkara") {
    const baris = w.document.querySelector("#submenus td#backlist").parentElement as HTMLElement;
    const l1 = w.document.createElement("td");
    l1.className = "aleta-l1-submenu";
    l1.innerHTML = '<a href="#">Buka di ABT</a>';
    baris.appendChild(l1);
  }
  vm.runInContext(PTJ, ctx, { filename: "putusan-terjadwal.js" });
  vm.runInContext(STJ, ctx, { filename: "sidang-terjadwal.js" });
  return { w, d: w.document as Document, panggilan, simpanan };
}
type Halaman = ReturnType<typeof buka>;

const api = (h: Halaman) => h.w.aletaSidangTerjadwal;
const tombolBas = (h: Halaman) => h.d.querySelector('[data-stj="tombol-bas"]') as HTMLButtonElement | null;
const tombolTunda = (h: Halaman) => h.d.querySelector('[data-stj="tombol-tunda"]') as HTMLButtonElement | null;
const panel = (h: Halaman) => h.d.getElementById("aleta-stj-panel") as HTMLElement | null;
const q = (h: Halaman, sel: string) => panel(h)!.querySelector(sel) as HTMLElement;
const qq = (h: Halaman, sel: string) => Array.from(panel(h)!.querySelectorAll(sel)) as HTMLElement[];
const siapMode = (h: Halaman) => sampai(() => (typeof h.w.alatUjiMode === "function" && h.w.alatUjiMode() !== "lama" ? true : null), "mode tampilan terbaca");

async function panelTerbuka(h: Halaman, tab: "bas" | "tunda") {
  await sampai(() => (api(h).pasang(h.d), tab === "bas" ? tombolBas(h) : tombolTunda(h)), `tombol ${tab}`);
  (tab === "bas" ? tombolBas(h) : tombolTunda(h))!.click();
  await sampai(() => (api(h).pasang(h.d), panel(h) && !panel(h)!.hidden && api(h).keadaan().sidangDimuat ? panel(h) : null), "panel terbuka dan sidang termuat");
  return panel(h)!;
}

function isi(h: Halaman, el: HTMLElement, nilai: string, peristiwa: "input" | "change" = "change") {
  (el as HTMLInputElement).value = nilai;
  el.dispatchEvent(new h.w.Event(peristiwa, { bubbles: true }));
}
async function seret(h: Halaman, nama: string[], ukuran = 4096) {
  const zona = q(h, '[data-stj="zona"]');
  const evt = new h.w.Event("drop", { bubbles: true, cancelable: true }) as any;
  evt.dataTransfer = { files: nama.map((n) => new h.w.File([new Uint8Array(ukuran)], n)) };
  zona.dispatchEvent(evt);
  await sampai(() => api(h).keadaan().berkas.length === nama.length, "berkas masuk daftar");
}
const kirimTerakhir = (h: Halaman, metode: string) => [...h.panggilan].reverse().find((p) => p.alamat.includes("/aleta-ecourt/sidang-terjadwal") && p.metode === metode);

// ============================================================================
describe("tombol per peran", () => {
  it("halaman perkara: tepat sesudah Jadwalkan Putusan, sebelum Buka di ABT; Super Admin melihat keduanya; pemasangan berulang tidak menggandakan", async () => {
    const h = buka();
    await sampai(() => (api(h).pasang(h.d), tombolBas(h)), "tombol");
    const anak = Array.from(h.d.querySelector("#submenus td#backlist")!.parentElement!.children);
    const idx = (kelas: string) => anak.findIndex((x) => x.classList.contains(kelas));
    expect(idx("aleta-stj-sel")).toBe(idx("aleta-ptj-sel") + 1);
    expect(idx("aleta-stj-sel")).toBeLessThan(idx("aleta-l1-submenu"));
    expect(tombolBas(h)!.textContent).toContain("Jadwalkan BAS");
    expect(tombolTunda(h)!.textContent).toContain("Jadwalkan Tunda");
    // Jadwalkan Putusan tidak berubah.
    expect(h.d.querySelector("#aleta-ptj-tombol")!.textContent).toContain("Jadwalkan Putusan");
    for (let i = 0; i < 5; i += 1) api(h).pasang(h.d);
    expect(h.d.querySelectorAll(".aleta-stj-sel")).toHaveLength(1);
    expect(h.d.querySelectorAll('[data-stj="tombol-bas"]')).toHaveLength(1);
  });

  it("BAS hanya untuk golongan BAS massal; Tunda hanya untuk yang boleh menunda sidang; peran lain, peran belum terbaca, dan tampilan Lama tidak melihat apa pun", async () => {
    const harapan: Array<[string | null, boolean, boolean]> = [
      ["Super Admin", true, true],
      ["Panitera Pengganti", true, true],
      ["Panitera", true, true],
      ["Hakim", false, true],
      ["Ketua", false, true],
      ["Juru Sita", false, false],
      ["Kasir", false, false],
      [null, false, false],
    ];
    for (const [peran, bas, tunda] of harapan) {
      const h = buka({ peran });
      await siapMode(h);
      await tunggu(20);
      api(h).pasang(h.d);
      expect(Boolean(tombolBas(h)), `BAS ${peran}`).toBe(bas);
      expect(Boolean(tombolTunda(h)), `Tunda ${peran}`).toBe(tunda);
    }
    const lama = buka({ tampilan: "lama" });
    await tunggu(150);
    expect(api(lama).pasang(lama.d).tombol).toBe(false);
    expect(lama.d.querySelector(".aleta-stj")).toBeNull();
  });

  it("MASSAL: di samping Jadwalkan Putusan Massal di daftar perkara dan di dalam judul dashboard; jurnal/halaman lain tidak", async () => {
    const l = buka({ halaman: "daftar" });
    await sampai(() => (api(l).pasang(l.d), l.d.getElementById("aleta-stj-massal")), "tombol massal daftar");

    const cetak = l.d.getElementById("cetak_perkara_list")!;
    expect(cetak.nextElementSibling === l.d.getElementById("aleta-ptj-massal")).toBe(true);
    expect(l.d.getElementById("aleta-ptj-massal")!.nextElementSibling === l.d.getElementById("aleta-stj-massal")).toBe(true);
    for (let i = 0; i < 4; i += 1) api(l).pasang(l.d);
    expect(l.d.querySelectorAll("#aleta-stj-massal")).toHaveLength(1);
    const d = buka({ halaman: "dasbor", peran: "Panitera Pengganti" });
    await sampai(() => (api(d).pasang(d.d), d.d.getElementById("aleta-stj-massal")), "tombol massal dashboard");
    expect(d.d.getElementById("aleta-stj-massal")!.parentElement === d.d.querySelector("section.content-header h1")).toBe(true);
    expect(Boolean(tombolBas(d))).toBe(true);
    expect(Boolean(tombolTunda(d))).toBe(true);
    const hakim = buka({ halaman: "dasbor", peran: "Hakim" });
    await sampai(() => (api(hakim).pasang(hakim.d), tombolTunda(hakim)), "tombol tunda hakim");
    expect(tombolBas(hakim) === null).toBe(true);
  });

  it("panel bawaannya TERLIPAT dan terbuka lewat tombol; tombol yang sama menutupnya", async () => {
    const h = buka();
    await sampai(() => (api(h).pasang(h.d), tombolBas(h)), "tombol");
    expect(api(h).keadaan().terbuka).toBe(false);
    expect(tombolBas(h)!.getAttribute("aria-expanded")).toBe("false");
    expect(!panel(h) || panel(h)!.hidden).toBe(true);
    tombolBas(h)!.click();
    await sampai(() => (api(h).pasang(h.d), panel(h) && !panel(h)!.hidden), "panel terbuka");
    expect(tombolBas(h)!.getAttribute("aria-expanded")).toBe("true");
    tombolBas(h)!.click();
    expect(panel(h)!.hidden).toBe(true);
  });
});

// ============================================================================
describe("Jadwalkan BAS", () => {
  it("halaman perkara: sidang perkara itu saja; satu berkas tanpa nomor dipasang ke perkara halaman; muatan multipart sesuai kontrak", async () => {
    const h = buka({ peran: "Panitera Pengganti" });
    await panelTerbuka(h, "bas");
    expect(api(h).keadaan().sidang.map((s: any) => s.nomor)).toEqual([NOMOR]);
    await seret(h, ["BAS sidang 2.rtf"]);
    expect(api(h).keadaan().berkas[0]).toMatchObject({ status: "cocok", perkaraKunci: api(h).keadaan().sidang[0].kunci });
    isi(h, q(h, '[data-stj="mulai-tanggal"]'), "2099-01-05");
    isi(h, q(h, '[data-stj="mulai-jam"]'), "08:00");
    isi(h, q(h, '[data-stj="jeda-min"]'), "2", "input");
    isi(h, q(h, '[data-stj="jeda-maks"]'), "5", "input");
    const jadwalkan = q(h, '[data-stj="jadwalkan"]') as HTMLButtonElement;
    expect(jadwalkan.disabled).toBe(false);
    jadwalkan.click();
    expect(q(h, '[data-stj="kaki"]').textContent).toMatch(/1 BAS akan diunggah.*pukul 08:00 WITA/);
    (q(h, '[data-stj="ya"]') as HTMLButtonElement).click();
    const kirim = await sampai(() => kirimTerakhir(h, "POST"), "POST jadwal");
    expect(kirim.formulir).toMatchObject({ jenis: "bas", mulai: "2099-01-05 08:00", jedaMin: "120", jedaMaks: "300" });
    expect(JSON.parse(kirim.formulir!.butir)).toEqual([
      { perkaraId: "30684", sidangId: "9001", nomorPerkara: NOMOR, tanggalSidang: hariIniWita(), berkas: "berkas0" },
    ]);
    expect(kirim.formulir!.berkas0).toMatchObject({ nama: "BAS sidang 2.rtf" });
    await sampai(() => api(h).keadaan().tab === "antrean", "pindah ke antrean");
    expect(api(h).keadaan().pesan.teks).toMatch(/1 BAS dijadwalkan/);
  });

  it("massal: dipasangkan menurut nomor di nama; tidak cocok, ganda, bukan BAS, dan salah bentuk ditandai; pasangan manual menang", async () => {
    const h = buka({ halaman: "dasbor", peran: "Super Admin" });
    await panelTerbuka(h, "bas");
    expect(api(h).keadaan().sidang).toHaveLength(3);
    await seret(h, [
      "BAS 684_Pdt.G_2026_PA.Dgl.rtf",
      "BAS 684_Pdt.G_2026_PA.Dgl (salinan).rtf",
      "BAS 999_Pdt.G_2026_PA.Dgl.rtf",
      "BAS tanpa nomor.docx",
      "Relaas panggilan 685_Pdt.G_2026_PA.Dgl.rtf",
      "catatan.txt",
      "BAS 685_Pdt.G_2026_PA.Dgl.pdf",
    ]);
    const per = Object.fromEntries(api(h).keadaan().berkas.map((b: any) => [b.nama, b]));
    expect(per["BAS 684_Pdt.G_2026_PA.Dgl.rtf"].status).toBe("ganda");
    expect(per["BAS 684_Pdt.G_2026_PA.Dgl (salinan).rtf"].status).toBe("ganda");
    expect(per["BAS 999_Pdt.G_2026_PA.Dgl.rtf"].status).toBe("tidak-cocok");
    expect(per["BAS tanpa nomor.docx"].status).toBe("tanpa-nomor");
    expect(per["Relaas panggilan 685_Pdt.G_2026_PA.Dgl.rtf"]).toMatchObject({ status: "ditolak" });
    expect(per["Relaas panggilan 685_Pdt.G_2026_PA.Dgl.rtf"].tolak).toMatch(/bukan BAS/);
    expect(per["catatan.txt"]).toMatchObject({ status: "ditolak", tolak: "bukan RTF, DOCX, DOC, atau PDF" });
    expect(per["BAS 685_Pdt.G_2026_PA.Dgl.pdf"]).toMatchObject({ status: "cocok" });
    // Pasangan manual menang atas tebakan: salinan dipilih petugas untuk 684, jadi yang asli tidak ganda lagi hanya bila ia manual.
    const kunci684 = api(h).keadaan().sidang.find((s: any) => s.nomor === NOMOR).kunci;
    const barisSalinan = qq(h, "[data-stj-berkas]").find((e) => e.getAttribute("data-stj-berkas") === "BAS 684_Pdt.G_2026_PA.Dgl (salinan).rtf")!;
    isi(h, barisSalinan.querySelector("select") as HTMLElement, kunci684);
    const sesudah = Object.fromEntries(api(h).keadaan().berkas.map((b: any) => [b.nama, b]));
    expect(sesudah["BAS 684_Pdt.G_2026_PA.Dgl (salinan).rtf"]).toMatchObject({ status: "cocok", perkaraKunci: kunci684 });
    expect(sesudah["BAS 684_Pdt.G_2026_PA.Dgl.rtf"].status).toBe("ganda");
  });

  it("BAS yang sudah ada di SIPP tidak dijadwalkan kecuali 'ganti' dicentang tegas; berkas lebih dari 10 MB ditolak", async () => {
    const h = buka({ halaman: "dasbor", peran: "Super Admin" });
    await panelTerbuka(h, "bas");
    await seret(h, ["BAS 685_Pdt.G_2026_PA.Dgl.rtf"]);
    isi(h, q(h, '[data-stj="mulai-tanggal"]'), "2099-01-05");
    expect(api(h).keadaan().berkas[0].status).toBe("cocok");
    // Sidang 685 sudah ber-BAS di SIPP: tanpa 'ganti' tidak ada yang siap.
    expect((q(h, '[data-stj="jadwalkan"]') as HTMLButtonElement).disabled).toBe(true);
    expect(q(h, '[data-stj="kaki"]').textContent).toMatch(/Belum ada berkas BAS yang cocok/);
    const ganti = q(h, '[data-stj="ganti"]') as HTMLInputElement;
    ganti.checked = true;
    ganti.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect((q(h, '[data-stj="jadwalkan"]') as HTMLButtonElement).disabled).toBe(false);
    (q(h, '[data-stj="jadwalkan"]') as HTMLButtonElement).click();
    (q(h, '[data-stj="ya"]') as HTMLButtonElement).click();
    const kirim = await sampai(() => kirimTerakhir(h, "POST"), "POST jadwal");
    expect(JSON.parse(kirim.formulir!.butir)[0]).toMatchObject({ nomorPerkara: "685/Pdt.G/2026/PA.Dgl", ganti: true });

    const besar = buka({ halaman: "dasbor" });
    await panelTerbuka(besar, "bas");
    await seret(besar, ["BAS 684_Pdt.G_2026_PA.Dgl.rtf"], 11 * 1024 * 1024);
    expect(api(besar).keadaan().berkas[0]).toMatchObject({ status: "ditolak", tolak: "lebih dari 10 MB" });
  });

  it("pemeriksaan sisa blangko: Batal membatalkan penjadwalan (tidak ada POST); Lanjut meneruskan", async () => {
    const tahan = buka({ deteksiLanjut: false });
    await panelTerbuka(tahan, "bas");
    await seret(tahan, ["BAS 684_Pdt.G_2026_PA.Dgl.rtf"]);
    isi(tahan, q(tahan, '[data-stj="mulai-tanggal"]'), "2099-01-05");
    (q(tahan, '[data-stj="jadwalkan"]') as HTMLButtonElement).click();
    (q(tahan, '[data-stj="ya"]') as HTMLButtonElement).click();
    await sampai(() => api(tahan).keadaan().pesan && /sisa blangko/.test(api(tahan).keadaan().pesan.teks), "pesan dibatalkan");
    expect(kirimTerakhir(tahan, "POST")).toBeUndefined();
    const terus = buka({ deteksiLanjut: true });
    await panelTerbuka(terus, "bas");
    await seret(terus, ["BAS 684_Pdt.G_2026_PA.Dgl.rtf"]);
    isi(terus, q(terus, '[data-stj="mulai-tanggal"]'), "2099-01-05");
    (q(terus, '[data-stj="jadwalkan"]') as HTMLButtonElement).click();
    (q(terus, '[data-stj="ya"]') as HTMLButtonElement).click();
    await sampai(() => kirimTerakhir(terus, "POST"), "POST jadwal");
  });

  it("server menolak: sebab dan tolakan per perkara tampil, berkas tetap di daftar", async () => {
    const h = buka({ tolakBuat: { sebab: "Ada yang tidak sah.", tolak: [{ nomorPerkara: NOMOR, sebab: "BAS sudah dijadwalkan." }] } });
    await panelTerbuka(h, "bas");
    await seret(h, ["BAS 684_Pdt.G_2026_PA.Dgl.rtf"]);
    isi(h, q(h, '[data-stj="mulai-tanggal"]'), "2099-01-05");
    (q(h, '[data-stj="jadwalkan"]') as HTMLButtonElement).click();
    (q(h, '[data-stj="ya"]') as HTMLButtonElement).click();
    await sampai(() => api(h).keadaan().pesan && api(h).keadaan().pesan.jenis === "galat", "pesan galat");
    expect(api(h).keadaan().pesan.teks).toContain("Ada yang tidak sah.");
    expect(api(h).keadaan().pesan.teks).toContain("BAS sudah dijadwalkan.");
    expect(api(h).keadaan().berkas).toHaveLength(1);
    expect(api(h).keadaan().tab).toBe("bas");
  });
});

// ============================================================================
describe("Jadwalkan Tunda", () => {
  it("sidang yang sudah diputus tidak dapat dipilih; usulan hanya mengisi kolom kosong; muatan JSON sesuai kontrak", async () => {
    const h = buka({ halaman: "dasbor", peran: "Hakim" });
    await panelTerbuka(h, "tunda");
    expect(tombolBas(h)).toBeNull();
    const cek = qq(h, "[data-stj-sidang]") as HTMLInputElement[];
    expect(cek).toHaveLength(3);
    expect(cek.find((c) => c.disabled)).toBeTruthy();
    expect(qq(h, ".aleta-ptj-kandidat label").map((l) => l.textContent).join("|")).toContain("sudah diputus di SIPP");
    const pilih = (nomor: string) => {
      const s = api(h).keadaan().sidang.find((x: any) => x.nomor === nomor);
      const c = cek.find((x) => x.getAttribute("data-stj-sidang") === s.kunci)!;
      c.checked = true;
      c.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    };
    pilih(NOMOR);
    pilih("686/Pdt.P/2026/PA.Dgl");
    expect(qq(h, "[data-stj-tunda]").map((e) => e.getAttribute("data-stj-tunda"))).toEqual([NOMOR]);
    // Belum lengkap: tombol mati dengan sebab.
    expect((q(h, '[data-stj="jadwalkan"]') as HTMLButtonElement).disabled).toBe(true);
    expect(q(h, '[data-stj="kaki"]').textContent).toMatch(/belum lengkap/);
    // Alasan diketik sendiri; usulan tidak menimpanya.
    isi(h, q(h, '[data-stj="alasan"]'), "Menunggu hasil mediasi", "input");
    (q(h, '[data-stj="usulan"]') as HTMLButtonElement).click();
    await sampai(() => api(h).keadaan().tunda.get(api(h).keadaan().sidang[0].kunci)?.agendaBerikut, "usulan terisi");
    const t = api(h).keadaan().tunda.get(api(h).keadaan().sidang[0].kunci);
    expect(t).toMatchObject({ alasanTunda: "Menunggu hasil mediasi", agendaBerikut: "Pembuktian", tanggalBerikut: "2099-02-10", jamBerikut: "09:00", dihadiriOleh: 2 });
    expect(h.panggilan.find((p) => p.alamat.includes("/sipp-ide/jendela"))!.alamat).toMatch(/jendela=tunda&nomor=684%2FPdt\.G%2F2026%2FPA\.Dgl&tanggal=\d{4}-\d{2}-\d{2}/);
    isi(h, q(h, '[data-stj="mulai-jam"]'), "23:59");
    const jadwalkan = q(h, '[data-stj="jadwalkan"]') as HTMLButtonElement;
    expect(jadwalkan.disabled).toBe(false);
    jadwalkan.click();
    (q(h, '[data-stj="ya"]') as HTMLButtonElement).click();
    const kirim = await sampai(() => kirimTerakhir(h, "POST"), "POST jadwal");
    expect(kirim.badan).toEqual({
      jenis: "tunda",
      mulai: `${hariIniWita()} 23:59`,
      jedaMin: 60,
      jedaMaks: 180,
      butir: [
        {
          jadwalId: "9001",
          perkaraId: "30684",
          nomorPerkara: NOMOR,
          tanggalSidang: hariIniWita(),
          alasanTunda: "Menunggu hasil mediasi",
          tanggalBerikut: "2099-02-10",
          jamBerikut: "09:00",
          agendaBerikut: "Pembuktian",
          dihadiriOleh: 2,
        },
      ],
    });
    await sampai(() => api(h).keadaan().tab === "antrean", "pindah ke antrean");
  });

  it("tanpa usulan dari server, kolom dibiarkan kosong (tidak dikarang) dan petugas mengisi sendiri", async () => {
    const h = buka({ peran: "Hakim", usulan: { usulan: null, alasan: "Riwayat sidang perkara ini belum terbaca." } });
    await panelTerbuka(h, "tunda");
    (q(h, '[data-stj="usulan"]') as HTMLButtonElement).click();
    await sampai(() => qq(h, "[data-stj-tunda]")[0]?.textContent?.includes("belum terbaca"), "catatan usulan");
    const t = api(h).keadaan().tunda.get(api(h).keadaan().sidang[0].kunci);
    expect(t).toMatchObject({ alasanTunda: "", agendaBerikut: "", tanggalBerikut: "", jamBerikut: "" });
  });

  it("hanya pada hari sidangnya: sidang tanggal lain tidak dapat dijadwalkan dan sebabnya disebut", async () => {
    const h = buka({ peran: "Hakim" });
    await panelTerbuka(h, "tunda");
    isi(h, q(h, '[data-stj="alasan"]'), "Menunggu", "input");
    isi(h, q(h, '[data-stj="agenda"]'), "Pembuktian", "input");
    isi(h, q(h, '[data-stj="tanggal-berikut"]'), "2099-02-10");
    isi(h, q(h, '[data-stj="jam-berikut"]'), "09:00");
    isi(h, q(h, '[data-stj="mulai-jam"]'), "23:59");
    expect((q(h, '[data-stj="jadwalkan"]') as HTMLButtonElement).disabled).toBe(false);
    isi(h, q(h, '[data-stj="tanggal-sidang"]'), "2099-03-01");
    await sampai(() => api(h).keadaan().tanggal === "2099-03-01" && api(h).keadaan().sidangDimuat, "sidang tanggal lain termuat");
    // Perkara itu bersidang pada tanggal tiruan itu (server tiruan mengembalikan daftar yang sama): tombol tetap mati karena bukan hari ini.
    expect(q(h, '[data-stj="kaki"]').textContent).toMatch(/hanya dapat dijadwalkan pada hari sidangnya|Centang sidang/);
    expect((q(h, '[data-stj="jadwalkan"]') as HTMLButtonElement).disabled).toBe(true);
  });
});

// ============================================================================
describe("Lencana tombol (jumlah menunggu / sedang dikerjakan)", () => {
  const lencana = (h: Halaman, tab: "bas" | "tunda") => h.d.querySelector(`[data-stj-lencana="${tab}"]`) as HTMLElement;
  const bacaRingkas = (h: Halaman) => h.panggilan.filter((p) => p.metode === "GET" && p.alamat.includes("ringkas=1"));

  it("tersembunyi saat nol; satu GET ringan (aktif, batas 1, ringkas) mengisi hitungan per tombol tanpa menyentuh lencana Jadwalkan Putusan", async () => {
    const h = buka({ ringkasan: { bas: { menunggu: 2, jalan: 1 }, tunda: { menunggu: 0, jalan: 0 } } });
    await sampai(() => (api(h).pasang(h.d), tombolBas(h) && tombolTunda(h)), "tombol");
    expect(lencana(h, "bas").hidden).toBe(true);
    expect(lencana(h, "tunda").hidden).toBe(true);
    expect(lencana(h, "bas").className).toBe("aleta-stj-lencana");
    await api(h).bacaLencana();
    expect(bacaRingkas(h)).toHaveLength(1);
    expect(bacaRingkas(h)[0].alamat).toContain("aktif=1");
    expect(bacaRingkas(h)[0].alamat).toContain("batas=1");
    expect(bacaRingkas(h)[0].alamat).not.toContain("semua=1");
    expect(lencana(h, "bas").textContent).toBe("3");
    expect(lencana(h, "bas").hidden).toBe(false);
    expect(lencana(h, "bas").title).toContain("3 unggah BAS");
    expect(lencana(h, "tunda").hidden).toBe(true);
    expect(api(h).lencana()).toEqual({ bas: 3, tunda: 0 });
    // lencana Jadwalkan Putusan milik modul lain tidak ikut berubah
    expect(h.d.querySelectorAll(".aleta-ptj-lencana")).toHaveLength(1);
    expect((h.d.querySelector(".aleta-ptj-lencana") as HTMLElement).textContent).not.toBe("3");
  });

  it("tombol yang dipasang belakangan langsung memuat hitungan terakhir; hitungan menurun kembali menyembunyikan", async () => {
    const h = buka({ ringkasan: { bas: { menunggu: 0, jalan: 0 }, tunda: { menunggu: 1, jalan: 1 } } });
    await sampai(() => (api(h).pasang(h.d), tombolBas(h)), "tombol");
    await api(h).bacaLencana();
    expect(lencana(h, "tunda").textContent).toBe("2");
    h.d.querySelector(".aleta-stj-sel")!.remove();
    api(h).pasang(h.d);
    expect(lencana(h, "tunda").textContent).toBe("2");
    expect(lencana(h, "tunda").hidden).toBe(false);
    expect(api(h).murni.hitungLencana({ bas: { menunggu: 0, jalan: 0 } })).toEqual({ bas: 0, tunda: 0 });
    expect(api(h).murni.hitungLencana(null)).toEqual({ bas: 0, tunda: 0 });
  });

  it("tanpa tombol di halaman (peran tak berhak) tidak ada GET sama sekali", async () => {
    const h = buka({ peran: "Kasir" });
    await siapMode(h);
    await tunggu(20);
    api(h).pasang(h.d);
    await api(h).bacaLencana();
    expect(bacaRingkas(h)).toHaveLength(0);
  });
});

describe("Antrean", () => {
  const antrean = [
    { id: "a1", jenis: "bas", perkaraId: "1", nomorPerkara: NOMOR, jadwalId: "9001", tanggalSidang: "2099-01-05", waktuWita: "2099-01-05 08:00", status: "menunggu", namaStatus: "Menunggu", hasilRingkas: "", berkasNama: "BAS.rtf", ringkasMuatan: "", dibuatNama: "Petugas Satu", bolehBatal: true },
    { id: "a2", jenis: "tunda", perkaraId: "2", nomorPerkara: "685/Pdt.G/2026/PA.Dgl", jadwalId: "9002", tanggalSidang: "2099-01-05", waktuWita: "2099-01-05 09:00", status: "gagal", namaStatus: "Gagal", hasilRingkas: "Perkara sudah diputus.", berkasNama: "", ringkasMuatan: "", dibuatNama: "Petugas Satu", bolehBatal: true },
    { id: "a3", jenis: "bas", perkaraId: "3", nomorPerkara: "686/Pdt.P/2026/PA.Dgl", jadwalId: "9003", tanggalSidang: "2099-01-05", waktuWita: "2099-01-05 10:00", status: "selesai", namaStatus: "Sudah ditulis ke SIPP", hasilRingkas: "BAS terunggah.", berkasNama: "", ringkasMuatan: "", dibuatNama: "Orang Lain", bolehBatal: false },
  ];

  it("daftar dengan status dan hasil; Batal hanya pada yang menunggu; Jadwal ulang mengirim waktu baru; Ulangi hanya pada yang gagal", async () => {
    const h = buka({ antrean });
    await panelTerbuka(h, "bas");
    qq(h, '[role="tab"]').find((b) => b.getAttribute("data-stj") === "tab-antrean")!.click();
    await sampai(() => qq(h, "[data-stj-butir]").length === 3, "antrean tampil");
    expect(q(h, '[data-stj-butir="a2"]').textContent).toContain("Perkara sudah diputus.");
    expect(q(h, '[data-stj-butir="a3"]').querySelector("button")).toBeNull();
    expect(q(h, '[data-stj-butir="a2"]').querySelector('[data-stj-aksi="batal:a2"]')).toBeNull();
    expect(q(h, '[data-stj-butir="a2"]').querySelector('[data-stj-aksi="ulang:a2"]')).toBeTruthy();
    (q(h, '[data-stj-aksi="batal:a1"]') as HTMLButtonElement).click();
    const batal = await sampai(() => kirimTerakhir(h, "PATCH"), "PATCH batal");
    expect(batal.badan).toEqual({ aksi: "batal", id: "a1" });
    await sampai(() => api(h).keadaan().sibuk === false, "selesai");
    (q(h, '[data-stj-aksi="jadwal-ulang:a2"]') as HTMLButtonElement).click();
    isi(h, q(h, '[data-stj="ulang-tanggal"]'), "2099-01-06");
    isi(h, q(h, '[data-stj="ulang-jam"]'), "13:30");
    (q(h, '[data-stj-aksi="simpan-ulang:a2"]') as HTMLButtonElement).click();
    await sampai(() => kirimTerakhir(h, "PATCH")!.badan.aksi === "jadwal-ulang", "PATCH jadwal ulang");
    expect(kirimTerakhir(h, "PATCH")!.badan).toEqual({ aksi: "jadwal-ulang", id: "a2", wita: "2099-01-06 13:30" });
  });

  it("pengawas (admin) meminta semua butir; petugas biasa hanya miliknya", async () => {
    const admin = buka({ antrean, peran: "Super Admin" });
    await panelTerbuka(admin, "bas");
    await api(admin).muatAntrean();
    expect(admin.panggilan.filter((p) => p.metode === "GET" && p.alamat.includes("sidang-terjadwal")).pop()!.alamat).toContain("semua=1");
    const pp = buka({ antrean, peran: "Panitera Pengganti" });
    await panelTerbuka(pp, "bas");
    await api(pp).muatAntrean();
    expect(pp.panggilan.filter((p) => p.metode === "GET" && p.alamat.includes("sidang-terjadwal")).pop()!.alamat).not.toContain("semua=1");
  });
});

describe("pemasangan", () => {
  it("modul terdaftar di manifest dan susun-ekstensi, dan tidak menyebut ALETA di teks layar maupun label teknis", () => {
    const manifest = JSON.parse(baca("manifest.json"));
    const sipp = manifest.content_scripts.find((c: any) => c.js.includes("putusan-terjadwal.js"));
    expect(sipp.js.indexOf("sidang-terjadwal.js")).toBeGreaterThan(sipp.js.indexOf("putusan-terjadwal.js"));
    expect(sipp.css).toContain("sidang-terjadwal.css");
    const susun = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"sidang-terjadwal.js"');
    expect(susun).toContain('"sidang-terjadwal.css"');
    const kodeTampil = STJ.split("\n").filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b)).join("\n");
    const teksLiteral = [...kodeTampil.matchAll(/"([^"\n]{12,})"/g)].map((m) => m[1]).filter((t) => /\s/.test(t) && !/^[a-z0-9_./:?=&%-]+$/i.test(t));
    for (const t of teksLiteral) expect(t, t).not.toMatch(/ALETA|API|butir_id|kering/);
  });
});
