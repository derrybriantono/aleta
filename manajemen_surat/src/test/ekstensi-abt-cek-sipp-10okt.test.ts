// @vitest-environment node
/**
 * ============================================================================
 * 10 OKT 2026 - B1 PENGINGAT SIPP vs ABT SEBELUM CETAK (UI BARU)
 * ============================================================================
 *
 * Yang dijaga (panel-alat.js + abt.js dijalankan sungguhan di jsdom):
 *   1. ada beda data inti -> kotak "x data berbeda dengan SIPP" + rincian
 *      (nilai ABT vs SIPP) + tombol "Muat ulang variabel" + penanda info di
 *      samping CETAK; isi halaman TIDAK dikirim (hanya perkaraId + kode)
 *   2. CETAK TETAP JALAN: klik CETAK tidak dicegah, tidak ada dialog "Sudah
 *      saya periksa" (itu milik penahan error variabel), tidak ada confirm
 *   3. semua sama -> tanda centang, tanpa penanda di samping CETAK; tanggal
 *      dan nominal dibandingkan menurut artinya
 *   4. "Muat ulang variabel" membaca ulang halaman (GET) dan mengganti sel
 *      di tempat - tanpa satu tulisan pun ke ABT - lalu memeriksa lagi
 *   5. isian manual yang meniru SIPP dibandingkan dengan acuannya
 *   6. tampilan Baru (bukan UI Baru) tidak mendapat pengingat ini
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_ABT = baca("abt.js");

const ASAL = "http://192.168.10.10";
const ASAL_ABT = `${ASAL}/aps_badilag/index.php/abt`;
const NOMOR = "533/Pdt.G/2026/PA.Dgl";
const CETAK = `${ASAL_ABT}/preview?c=10018&b=B&a=A`;
const ALAMAT = `${ASAL_ABT}/main/view?a=A&b=B&c=10018&d=3`;

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
    await tunggu(10);
  }
}

const ISI: Record<string, string> = {
  "0001": NOMOR,
  "0048": "Cerai Gugat",
  "0046": "Penggugat",
  "0047": "Tergugat",
  "0098": "Siti Aminah binti Ahmad",
  "0102": "Budi",
  "0012": "Drs. H. Ahmad Yani, M.H.",
  "1069": "01 Oktober 2026",
  "0279": "Rp 30.000",
  "8537": "DATA_TIDAK_ADA",
};
const NAMA: Record<string, string> = {
  "0001": "No Perkara",
  "0048": "Jenis Perkara",
  "0098": "Nama #0046#",
  "0102": "Nama #0047#",
  "0012": "Nama #0668#",
  "1069": "Tgl Putusan",
  "0279": "Biaya Pendaftaran",
  "8537": "Nama Advokat Kuasa #0046# (kosong = dari SIPP)",
};

type Butir = { kode: string; status: string; cermin: string; label: string; acuan?: string; terbaca: boolean; nilaiSipp: string };
const SIPP_SAMA: Butir[] = [
  { kode: "0001", status: "otomatis", cermin: "nomor_perkara", label: "Nomor perkara", terbaca: true, nilaiSipp: NOMOR },
  { kode: "0098", status: "otomatis", cermin: "nama_pihak1", label: "Nama Penggugat/Pemohon", terbaca: true, nilaiSipp: "SITI AMINAH BINTI AHMAD" },
  { kode: "0102", status: "otomatis", cermin: "nama_pihak2", label: "Nama Tergugat/Termohon", terbaca: true, nilaiSipp: "Budi" },
  { kode: "0012", status: "otomatis", cermin: "hakim_ketua", label: "Ketua Majelis/Hakim", terbaca: true, nilaiSipp: "Drs. H. Ahmad Yani, M.H." },
  { kode: "1069", status: "otomatis", cermin: "tanggal_putusan", label: "Tanggal putusan", terbaca: true, nilaiSipp: "2026-10-01" },
  { kode: "0279", status: "otomatis", cermin: "biaya", label: "Biaya perkara", terbaca: true, nilaiSipp: "30000.00" },
  { kode: "8537", status: "manual", cermin: "kuasa_pihak1", label: "Kuasa Penggugat/Pemohon", acuan: "0106", terbaca: true, nilaiSipp: "Andi Wijaya, S.H." },
];
const ganti = (daftar: Butir[], kode: string, nilaiSipp: string) => daftar.map((b) => (b.kode === kode ? { ...b, nilaiSipp } : b));

type Minta = { url: string; cara: string; badan: string };
type Jawab = { status?: number; isi?: unknown; mentah?: string; jenis?: string };

function tabel(isi: Record<string, string>) {
  return Object.keys(isi)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>${NAMA[k] || `Variabel ${k}`}</td>` +
        `<td>${isi[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
}

function halamanHtml(isi: Record<string, string>) {
  return (
    `<div id="wrapper"><div id="cssmenu"></div><div id="content"><h3 class="w3l_header"><span>${NOMOR}</span></h3>` +
    `<h2>CG (Lite) Verstek F V.2</h2>` +
    `<p class="cetak"><a id="cetak" href="${CETAK}">CETAK</a></p><table>${tabel(isi)}</table></div></div>`
  );
}

function jawabBaku(url: string, cara: string, badan: string, sipp: () => Butir[], halamanUlang: () => string): Jawab {
  if (url.includes("/aleta-ecourt/abt-cek-sipp")) return { isi: { ok: true, data: { perkaraId: "10018", butir: sipp(), catatan: "" } } };
  if (url.includes("/aleta-bot/abt/usulan")) {
    const muatan = JSON.parse(badan || "{}");
    if (muatan.sumber === "siapa") return { isi: { data: { available: true, pengguna: { nama: "Uji PP", peran: "Panitera Pengganti" }, kapabilitas: {} } } };
    return { isi: { data: { available: true } } };
  }
  if (url.includes("/aleta-ecourt/bas-komentar")) {
    return { isi: { ok: true, data: { komentar: [], saya: { id: "p", nama: "PP", bolehMenulis: false, bolehMenyelesaikanSemua: false } } } };
  }
  if (url.includes("/aleta-ecourt/abt-wajib")) return { isi: { ok: true, data: { jenis: "Cerai Gugat", variabel: [], catatan: "" } } };
  if (url.includes("/aleta-ecourt/abt-riwayat")) return { isi: { ok: true, data: { daftar: [] } } };
  if (url.includes("/aleta-ecourt/templat-hukum")) return { isi: { ok: true, data: { butir: [], bolehMenyunting: false } } };
  if (url.startsWith(ALAMAT) && cara === "GET") return { mentah: halamanUlang(), jenis: "text/html" };
  if (url.includes("/aps_badilag/") && cara === "GET") return { mentah: "<html><body></body></html>", jenis: "text/html" };
  return { status: 404, isi: { ok: false, error: { message: "tidak ada" } } };
}

function tanggapan(j: Jawab) {
  const status = j.status ?? 200;
  if (j.mentah !== undefined) return new Response(Buffer.from(j.mentah, "latin1"), { status, headers: { "content-type": j.jenis || "text/plain" } });
  return new Response(JSON.stringify(j.isi ?? {}), { status, headers: { "content-type": "application/json" } });
}

type Halaman = { dom: JSDOM; w: any; minta: Minta[]; konfirmasi: string[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = { tampilan?: "ui" | "baru"; isi?: Record<string, string>; sipp?: () => Butir[]; halamanUlang?: () => string };

function buka(p: Opsi = {}): Halaman {
  const isi = { ...ISI, ...(p.isi || {}) };
  const sipp = p.sipp ?? (() => SIPP_SAMA);
  const halamanUlang = p.halamanUlang ?? (() => `<html><body>${halamanHtml(isi)}</body></html>`);
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${halamanHtml(isi)}</body></html>`, {
    url: ALAMAT,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: p.tampilan ?? "ui", ujiFitur: p.tampilan === "baru" ? { "abt-5": true } : {}, ujiIzinkanNyata: true };
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.190.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }),
      lastError: undefined,
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (baru: Record<string, unknown>) => {
          const ubah: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(baru)) {
            ubah[k] = { oldValue: polos(simpanan[k]), newValue: polos(v) };
            simpanan[k] = polos(v);
          }
          setTimeout(() => {
            for (const f of [...pendengar]) f(polos(ubah), "local");
          }, 0);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Minta[] = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const b = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan: b });
    return tanggapan(jawabBaku(url, cara, b, sipp, halamanUlang));
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  const konfirmasi: string[] = [];
  w.confirm = (pesan: string) => {
    konfirmasi.push(pesan);
    return false;
  };
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`);
  return { dom, w, minta, konfirmasi };
}

const panelDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-abt") as any;
const kotak = (h: Halaman) => panelDari(h)?.querySelector(".aleta-t6-cek-sipp") as any;
const penandaCetak = (h: Halaman) => h.w.document.querySelector(".aleta-t6-cek-sipp-cetak") as any;
const tulisAbt = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && m.url.includes("/aps_badilag/"));
const selNilai = (h: Halaman, kode: string) => h.w.document.getElementById(kode).parentElement.children[2];
const kotakSelesai = (h: Halaman, pola: RegExp) => sampai(() => (kotak(h) && pola.test(kotak(h).textContent) ? kotak(h) : null), `kotak cek SIPP ${pola}`);

/** Klik CETAK; true bila ALETA mencegah bawaan tautan (diperiksa di tautan, sebelum pendengar halaman uji). */
function klikCetak(h: Halaman): boolean {
  const a = h.w.document.getElementById("cetak");
  let dicegah = false;
  a.addEventListener("click", (e: any) => {
    dicegah = e.defaultPrevented;
    e.preventDefault(); // jsdom tidak berpindah halaman
  });
  a.dispatchEvent(new h.w.MouseEvent("click", { bubbles: true, cancelable: true }));
  return dicegah;
}

describe("1-2. beda data inti: pengingat muncul, CETAK tetap jalan", () => {
  it("kotak 'x data berbeda dengan SIPP' + rincian ABT vs SIPP + muat ulang + penanda info di samping CETAK", async () => {
    const h = buka({ sipp: () => ganti(SIPP_SAMA, "0102", "Budi Santoso") });
    const k = await kotakSelesai(h, /berbeda dengan SIPP/);
    expect(k.textContent).toContain("1 data berbeda dengan SIPP");
    const baris = k.querySelector('tr[data-kode="0102"]');
    expect(baris).toBeTruthy();
    expect(baris.querySelector(".aleta-t6-cek-sipp-abt").textContent).toBe("Budi");
    expect(baris.querySelector(".aleta-t6-cek-sipp-nilai").textContent).toBe("Budi Santoso");
    expect(k.querySelector(".aleta-t6-cek-sipp-muat").textContent).toBe("Muat ulang variabel");
    expect(k.textContent).toContain("CETAK tetap dapat ditekan");
    // Yang sama tidak ikut terdaftar (huruf besar, tanggal, nominal menurut artinya).
    expect(k.querySelectorAll("tr[data-kode]").length).toBe(1);

    const tanda = await sampai(() => penandaCetak(h), "penanda di samping CETAK");
    expect(tanda.textContent).toBe("ⓘ 1 beda SIPP");
    expect(tanda.className).not.toContain("aleta-t6-wajib-cetak");
    expect(tanda.closest("a")).toBeNull();

    // Hanya perkaraId dan kode yang dikirim - nilai halaman tidak.
    const permintaan = h.minta.filter((m) => m.url.includes("/abt-cek-sipp"));
    expect(permintaan).toHaveLength(1);
    expect(permintaan[0].cara).toBe("GET");
    expect(permintaan[0].url).toContain("perkaraId=10018");
    expect(decodeURIComponent(permintaan[0].url)).toContain("0102");
    expect(decodeURIComponent(permintaan[0].url)).not.toMatch(/Budi|Siti/);
  });

  it("klik CETAK tidak dicegah: tanpa dialog 'Sudah saya periksa', tanpa confirm", async () => {
    const h = buka({ sipp: () => ganti(SIPP_SAMA, "0102", "Budi Santoso") });
    await kotakSelesai(h, /berbeda dengan SIPP/);
    // 14 Okt: klik CETAK diambil alih ekstensi (unduhan aman bernama baku) - yang dijaga: pemeriksaan SIPP tidak menahan cetak.
    klikCetak(h);
    await tunggu(50);
    expect(h.w.document.querySelector(".aleta-t6-tirai")).toBeNull();
    expect(h.konfirmasi).toEqual([]);
    expect(tulisAbt(h)).toEqual([]);
  });
});

describe("3. semua sama", () => {
  it("tanda centang, tanpa penanda di samping CETAK", async () => {
    const h = buka();
    const k = await kotakSelesai(h, /sama dengan SIPP/);
    expect(k.textContent).toContain("✓ Data inti blangko sama dengan SIPP (6 diperiksa)");
    expect(k.classList.contains("aleta-t6-cek-sipp-beda")).toBe(false);
    expect(penandaCetak(h)).toBeNull();
    // 14 Okt: klik CETAK diambil alih ekstensi (unduhan aman bernama baku) - yang dijaga: pemeriksaan SIPP tidak menahan cetak.
    klikCetak(h);
  });

  it("pembanding: tanggal, nominal, huruf besar, tanda baca ujung", () => {
    // abt.js "use strict": deklarasinya tidak tampak dari luar eval. Potongan
    // pembandingnya dijalankan sendiri di konteks vm - sumber yang SAMA.
    const awal = SUMBER_ABT.indexOf("const CEK_SIPP_BULAN");
    const akhir = SUMBER_ABT.indexOf("function cekSippBanding(");
    expect(awal).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(awal);
    const sama = runInNewContext(`${SUMBER_ABT.slice(awal, akhir)}\n;cekSippSama`) as (a: string, b: string) => boolean;
    expect(typeof sama).toBe("function");
    expect(sama("Senin, 01 Oktober 2026", "2026-10-01")).toBe(true);
    expect(sama("1-10-2026", "2026-10-01 00:00:00")).toBe(true);
    expect(sama("Mon Oct 01 2026 00:00:00 GMT+0800", "01 Okt 2026")).toBe(true);
    expect(sama("02 Oktober 2026", "2026-10-01")).toBe(false);
    expect(sama("Rp 1.250.000,-", "1250000.00")).toBe(true);
    expect(sama("Rp 1.250.000", "1250001")).toBe(false);
    expect(sama("SITI AMINAH.", "Siti  Aminah")).toBe(true);
    expect(sama("Siti Aminah", "Siti Aminah binti Ahmad")).toBe(false);
  });
});

describe("4. muat ulang variabel", () => {
  it("membaca ulang halaman (GET), mengganti sel di tempat, lalu sama - tanpa menulis ke ABT", async () => {
    let sippNama = "Budi Santoso";
    const h = buka({
      sipp: () => ganti(SIPP_SAMA, "0102", sippNama),
      halamanUlang: () => `<html><body>${halamanHtml({ ...ISI, "0102": "Budi Santoso" })}</body></html>`,
    });
    const k = await kotakSelesai(h, /berbeda dengan SIPP/);
    k.querySelector(".aleta-t6-cek-sipp-muat").click();
    const sesudah = await kotakSelesai(h, /sama dengan SIPP/);
    expect(selNilai(h, "0102").textContent).toBe("Budi Santoso");
    expect(sesudah.textContent).toContain("Variabel dimuat ulang dari ABT: 0102");
    expect(h.minta.filter((m) => m.url.startsWith(ALAMAT) && m.cara === "GET").length).toBeGreaterThanOrEqual(1);
    expect(h.minta.filter((m) => m.url.includes("/abt-cek-sipp")).length).toBe(2);
    expect(tulisAbt(h)).toEqual([]);
    expect(penandaCetak(h)).toBeNull();
    sippNama = "Budi";
  });
});

describe("5. isian manual yang meniru SIPP", () => {
  it("kosong = dari SIPP: tidak dibandingkan; terisi berbeda: ditandai 'isian manual' dengan acuannya", async () => {
    const kosong = buka();
    await kotakSelesai(kosong, /sama dengan SIPP/);

    const h = buka({ isi: { "8537": "Andi, S.H." } });
    const k = await kotakSelesai(h, /berbeda dengan SIPP/);
    const baris = k.querySelector('tr[data-kode="8537"]');
    expect(baris.textContent).toContain("isian manual - SIPP dari #0106#");
    expect(baris.querySelector(".aleta-t6-cek-sipp-nilai").textContent).toBe("Andi Wijaya, S.H.");
    expect(k.textContent).toContain("Isian manual yang berbeda disunting di ABT");
  });
});

describe("6. hanya UI Baru", () => {
  it("tampilan Baru: tidak ada kotak dan tidak ada permintaan abt-cek-sipp", async () => {
    const h = buka({ tampilan: "baru", sipp: () => ganti(SIPP_SAMA, "0102", "Budi Santoso") });
    await sampai(() => panelDari(h), "panel ABT");
    await tunggu(300);
    expect(kotak(h)).toBeNull();
    expect(h.minta.some((m) => m.url.includes("/abt-cek-sipp"))).toBe(false);
  });
});
