// Bukan berkas uji: dipakai ekstensi-relaas-massal.test.ts (node) dan
// cetak-relaas-antrian.test.tsx (jsdom). Isinya harness yang semula tinggal di
// ekstensi-relaas-massal.test.ts, dipindahkan APA ADANYA (hanya "export" yang
// ditambahkan) supaya uji layar menggambar jawaban latar.js yang SUNGGUHAN,
// bukan jawaban yang diketik tangan.
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";

/**
 * ============================================================================
 * DUNIA TIRUAN UNTUK MENJALANKAN latar.js SUNGGUHAN
 * ============================================================================
 *
 * latar.js dimuat SUNGGUHAN ke node:vm, di atas:
 *   - jam maya (Date dan setTimeout/setInterval milik pekerja), sehingga jeda
 *     manusia puluhan detik berjalan seketika tetapi tetap TERUKUR;
 *   - chrome.storage.session/local tiruan yang MENYERIALKAN isinya (seperti
 *     Chrome), dibagi antar pekerja - itulah satu-satunya yang selamat;
 *   - chrome.downloads tiruan dengan riwayat unduhan (search) dan pendengar
 *     onDeterminingFilename latar.js sendiri;
 *   - ABT dan portal palsu yang bentuk halamannya disalin dari view ABT asli.
 *
 * "Membunuh" pekerja = konteks vm-nya dibuang: seluruh panggilan chrome.* dan
 * fetch miliknya tidak pernah selesai, timernya tidak pernah berbunyi. Pekerja
 * baru dibuat dari berkas yang sama di atas penyimpanan yang sama - persis
 * yang dilakukan Chrome.
 */

export const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
// ALETA_UJI_LATAR hanya dipakai skrip pembukti gigitan: cacat dipasang pada
// SALINAN latar.js, bukan pada berkas yang sedang dipakai agen/uji lain.
export const SUMBER_LATAR = readFileSync(process.env.ALETA_UJI_LATAR || path.join(AKAR, "latar.js"), "utf8");

export const ASAL = "http://127.0.0.1:8056";
export const ABT = `${ASAL}/aps_badilag/abt`;
export const PENGIRIM = { url: `${ASAL}/aleta/aleta-ecourt`, origin: ASAL };
export const FOLDER_UNDUHAN = "D:\\Unduhan\\";
export const KUNCI_PUTARAN = "aletaRelaasMassal";

export const KATALOG = BLANGKO_RELAAS.map((b) => b.berkas);
export const BERKAS = (keadaan: string) => BLANGKO_RELAAS.find((b) => b.keadaan === keadaan)!.berkas;

// ---------------------------------------------------------------------------
// Dunia: yang selamat dari matinya pekerja
// ---------------------------------------------------------------------------

export type Pewaktu = { id: number; jatuh: number; fn: () => void; ulang: number; pekerja: number };
export type Unduhan = { id: number; filename: string; url: string; state: string; startTime: string; pekerja: number };
export type Permintaan = { pada: number; metode: string; alamat: string; badan: string; pekerja: number };
export type Jawaban = {
  ok: boolean;
  status: number;
  url: string;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
  json: () => Promise<any>;
};
export type Pelayan = (p: Permintaan) => Jawaban | "bunuh";

export function jawaban(status: number, isi: string | Uint8Array, url: string): Jawaban {
  const bita = typeof isi === "string" ? new TextEncoder().encode(isi) : isi;
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => new TextDecoder().decode(bita),
    arrayBuffer: async () => bita.buffer.slice(bita.byteOffset, bita.byteOffset + bita.byteLength) as ArrayBuffer,
    json: async () => JSON.parse(new TextDecoder().decode(bita)),
  };
}

export class Dunia {
  sesi: Record<string, any> = {};
  lokal: Record<string, any> = {};
  jam = Date.UTC(2026, 8, 25, 0, 30, 0);
  pewaktu: Pewaktu[] = [];
  nomorPewaktu = 1;
  unduhan: Unduhan[] = [];
  nomorUnduhan = 1;
  pencarian: any[] = [];
  permintaan: Permintaan[] = [];
  galatKonsol: unknown[][] = [];
  pekerjaHidup = new Set<number>();
  nomorPekerja = 0;
  kematian = 0;
  /** Berapa kali chrome.runtime.reload() dipanggil pekerja. */
  dimuatUlang = 0;
  /** Jawaban chrome.runtime.requestUpdateCheck(). */
  pembaruan: { status: string; version?: string } = { status: "no_update" };
  /** Dipanggil tiap chrome.downloads.download - "bunuh" mematikan pekerjanya sesudah unduhan lahir. */
  kaitUnduh: ((relatif: string, pekerja: number) => "bunuh" | "blokir" | undefined) | null = null;
  pelayan: Pelayan;

  constructor(pelayan: Pelayan) {
    this.pelayan = pelayan;
  }

  putaran(): any {
    return this.sesi[KUNCI_PUTARAN] ?? null;
  }
}

export const salin = <T>(x: T): T => (x === undefined ? x : structuredClone(x));
export const tidakPernah = () => new Promise<never>(() => {});

/** Menyalakan satu pekerja latar dari latar.js - mewakili Chrome membangunkannya. */
export function nyalakan(dunia: Dunia) {
  dunia.nomorPekerja += 1;
  const saya = dunia.nomorPekerja;
  dunia.pekerjaHidup.add(saya);
  const hidup = () => dunia.pekerjaHidup.has(saya);
  const matikan = () => {
    if (dunia.pekerjaHidup.delete(saya)) dunia.kematian += 1;
  };

  const pendengarPesan: any[] = [];
  const pendengarUbah: any[] = [];
  let pendengarNama: any = null;
  const runtime: any = {
    lastError: undefined,
    getManifest: () => ({ version: "1.167.0" }),
    onUpdateAvailable: { addListener: () => {} },
    onMessage: { addListener: (f: any) => pendengarPesan.push(f) },
    requestUpdateCheck: async () => salin(dunia.pembaruan),
    reload: () => {
      if (hidup()) dunia.dimuatUlang += 1;
    },
  };

  const gudang = (isi: Record<string, any>) => ({
    get: (k: string | string[]) => {
      if (!hidup()) return tidakPernah();
      const kunci = Array.isArray(k) ? k : [k];
      return Promise.resolve(Object.fromEntries(kunci.map((x) => [x, salin(isi[x])])));
    },
    set: (o: Record<string, any>) => {
      if (!hidup()) return tidakPernah();
      Object.assign(isi, salin(o));
      return Promise.resolve();
    },
    remove: (k: string | string[]) => {
      if (!hidup()) return tidakPernah();
      for (const x of Array.isArray(k) ? k : [k]) delete isi[x];
      return Promise.resolve();
    },
  });

  const downloads: any = {
    onDeterminingFilename: { addListener: (f: any) => (pendengarNama = f) },
    onChanged: {
      addListener: (f: any) => pendengarUbah.push(f),
      removeListener: (f: any) => {
        const i = pendengarUbah.indexOf(f);
        if (i >= 0) pendengarUbah.splice(i, 1);
      },
    },
    download: (opsi: any, balik: (id?: number) => void) => {
      if (!hidup()) return;
      // Seperti Chrome: pendengar penamaan latar.js ditanya lebih dahulu.
      let relatif = String(opsi.filename);
      if (pendengarNama) {
        pendengarNama({ filename: opsi.filename, url: opsi.url }, (usul?: { filename?: string }) => {
          if (usul && usul.filename) relatif = usul.filename;
        });
      }
      // conflictAction "uniquify": nama yang sudah ada diberi " (n)".
      const titik = relatif.lastIndexOf(".");
      let calon = relatif;
      for (let n = 1; dunia.unduhan.some((u) => u.filename.toLowerCase() === (FOLDER_UNDUHAN + calon.replace(/\//g, "\\")).toLowerCase()); n += 1) {
        calon = `${relatif.slice(0, titik)} (${n})${relatif.slice(titik)}`;
      }
      const kait = dunia.kaitUnduh ? dunia.kaitUnduh(calon, saya) : undefined;
      const barang: Unduhan = {
        id: dunia.nomorUnduhan++,
        filename: FOLDER_UNDUHAN + calon.replace(/\//g, "\\"),
        url: String(opsi.url).slice(0, 40),
        state: kait === "blokir" ? "interrupted" : "complete",
        startTime: new Date(dunia.jam).toISOString(),
        pekerja: saya,
      };
      dunia.unduhan.push(barang);
      if (kait === "bunuh") {
        // Unduhannya SUDAH lahir, tetapi pekerja mati sebelum sempat tahu.
        matikan();
        return;
      }
      queueMicrotask(() => {
        if (!hidup()) return;
        balik(barang.id);
        queueMicrotask(() => {
          for (const f of [...pendengarUbah]) {
            f(
              kait === "blokir"
                ? { id: barang.id, state: { current: "interrupted" }, error: { current: "FILE_BLOCKED" } }
                : { id: barang.id, state: { current: "complete" } }
            );
          }
        });
      });
    },
    search: (kueri: any, balik: (d: any[]) => void) => {
      if (!hidup()) return;
      dunia.pencarian.push(salin(kueri));
      const pola = new RegExp(kueri.filenameRegex);
      const sejak = kueri.startedAfter ? Date.parse(kueri.startedAfter) : 0;
      const hasil = dunia.unduhan.filter((u) => pola.test(u.filename) && Date.parse(u.startTime) > sejak);
      queueMicrotask(() => hidup() && balik(salin(hasil)));
    },
  };

  const DateAsli = Date;
  class DateMaya extends DateAsli {
    constructor(...a: any[]) {
      if (a.length === 0) super(dunia.jam);
      else super(...(a as [any]));
    }
    static now() {
      return dunia.jam;
    }
  }

  const pasangPewaktu = (fn: () => void, ms: number, ulang: number) => {
    const id = dunia.nomorPewaktu++;
    dunia.pewaktu.push({ id, jatuh: dunia.jam + Math.max(0, Number(ms) || 0), fn, ulang, pekerja: saya });
    return id;
  };
  const lepasPewaktu = (id: number) => {
    dunia.pewaktu = dunia.pewaktu.filter((p) => p.id !== id);
  };

  const fetchMaya = (alamat: string, init: any = {}) => {
    if (!hidup()) return tidakPernah();
    const p: Permintaan = {
      pada: dunia.jam,
      metode: String(init.method || "GET"),
      alamat: String(alamat),
      badan: typeof init.body === "string" ? init.body : "",
      pekerja: saya,
    };
    dunia.permintaan.push(p);
    const r = dunia.pelayan(p);
    if (r === "bunuh") {
      matikan();
      return tidakPernah();
    }
    return Promise.resolve(r);
  };

  const konteks: Record<string, any> = {
    console: {
      log: () => {},
      info: () => {},
      warn: (...a: unknown[]) => dunia.galatKonsol.push(["warn", ...a]),
      error: (...a: unknown[]) => dunia.galatKonsol.push(["error", ...a]),
    },
    chrome: { runtime, downloads, storage: { session: gudang(dunia.sesi), local: gudang(dunia.lokal) } },
    fetch: fetchMaya,
    setTimeout: (fn: () => void, ms: number) => pasangPewaktu(fn, ms, 0),
    clearTimeout: lepasPewaktu,
    setInterval: (fn: () => void, ms: number) => pasangPewaktu(fn, ms, Math.max(1, Number(ms) || 1)),
    clearInterval: lepasPewaktu,
    Date: DateMaya,
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    btoa: globalThis.btoa,
    atob: globalThis.atob,
    crypto: webcrypto,
    queueMicrotask,
  };
  konteks.self = konteks;
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(SUMBER_LATAR, konteks, { filename: "latar.js" });

  return {
    saya,
    konteks,
    matikan,
    /** Seperti chrome.runtime.sendMessage dari jembatan aleta.js. */
    kirim(pesan: any, pengirim: any = PENGIRIM): { selesai: () => boolean; nilai: () => any } {
      let dijawab = false;
      let nilai: any;
      for (const f of pendengarPesan) {
        f(salin(pesan), pengirim, (x: unknown) => {
          if (dijawab) return;
          dijawab = true;
          nilai = salin(x);
        });
      }
      return { selesai: () => dijawab, nilai: () => nilai };
    },
  };
}

export const kosongkan = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((r) => setImmediate(r));
};

/** Menggerakkan jam maya sampai `sampai()` benar. Macet (tanpa pewaktu hidup) = galat. */
export async function jalankan(dunia: Dunia, sampai: () => boolean, batasLangkah = 50000) {
  for (let i = 0; i < batasLangkah; i += 1) {
    await kosongkan();
    if (sampai()) return;
    const hidup = dunia.pewaktu.filter((p) => dunia.pekerjaHidup.has(p.pekerja));
    dunia.pewaktu = hidup;
    if (hidup.length === 0) {
      await kosongkan();
      if (sampai()) return;
      throw new Error(`macet: tidak ada pewaktu yang hidup (pekerja hidup: ${[...dunia.pekerjaHidup].join(",") || "-"})`);
    }
    hidup.sort((a, b) => a.jatuh - b.jatuh || a.id - b.id);
    const p = hidup[0];
    if (p.ulang) p.jatuh += p.ulang;
    else dunia.pewaktu = dunia.pewaktu.filter((x) => x.id !== p.id);
    dunia.jam = Math.max(dunia.jam, p.ulang ? p.jatuh - p.ulang : p.jatuh);
    p.fn();
  }
  throw new Error("batas langkah jam maya habis");
}

export async function minta(dunia: Dunia, pekerja: ReturnType<typeof nyalakan>, pesan: any, pengirim?: any) {
  const j = pekerja.kirim({ sumber: "aleta-panel", ...pesan }, pengirim);
  await jalankan(dunia, j.selesai);
  return j.nilai();
}

// ---------------------------------------------------------------------------
// ABT dan portal palsu - bentuk halamannya disalin dari view ABT asli
// ---------------------------------------------------------------------------

export const TOKEN_KELOMPOK = { pmh: "GRPpmh~11.a-", relaas: "GRPrelaas~22.b-" };
export const tokenBerkas = (i: number) => ({ a: `DIR${i}~x.y-`, b: `BRK${i}~q.w-` });

export function halamanBeranda() {
  return (
    `<div id="navbar" class="pricing_inner_w3ls navbar">` +
    `<a title="(11 Blangko)" href="/aps_badilag/abt/main/beranda?a=${TOKEN_KELOMPOK.pmh}&c=">PMH &amp; PHT</a>` +
    `<a title="(6 Blangko)" href="/aps_badilag/abt/main/beranda?a=${TOKEN_KELOMPOK.relaas}&c=">Relaas dan PBT</a>` +
    `</div>`
  );
}

export function halamanKelompok(namaBerkas: string[]) {
  const tautan = namaBerkas
    .map((nama, i) => {
      const t = tokenBerkas(i);
      // views/abt/beranda.php: pathinfo(PATHINFO_FILENAME) - ".rtf" saja yang dibuang.
      return (
        `\t<p><a title='ukuran file 54 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", {\n` +
        `\t\ta:"${t.a}",\n\t\tb:"${t.b}",\n\t\tc:""\n\t\t});'># <span>${nama.replace(/\.rtf$/, "")}</span></a></p>`
      );
    })
    .join("\n");
  return (
    `<div class="pricing-top pricing-top-hijau">\n\t\t\t<h3>Relaas Panggilan Sidang dan Pemberitahuan Putusan</h3>\n\t\t</div>` +
    `<div class="pricing-bottom"><div class="pricing-bottom-bottom">\n${tautan}</div></div>`
  );
}

export const HALAMAN_MASUK =
  `<form action="${ASAL}/aps_badilag/index.php/login/signin" method="post">` +
  `<input name="username" type="text"><input name="password" type="password"></form>`;

export function kueri(alamat: string) {
  return new URL(alamat).searchParams;
}

export type OpsiAbt = {
  berkasAda?: string[];
  masuk?: () => boolean;
  cetak500?: (perkaraId: string) => boolean;
  tolakAkses?: (perkaraId: string) => string | null;
  pdf?: (hitung: number) => Jawaban | "bunuh" | null;
  bunuhSaat?: (p: Permintaan) => boolean;
  kelompok500?: boolean;
  /**
   * Penolakan MENYELURUH akses_pengguna ABT (grup akun tidak ada di
   * user_grup_id menu) - bentuknya disalin dari models/abt/Abt_model.php: h3
   * merah TANPA nomor perkara, disusul meta refresh ke beranda ABT.
   */
  tolakSemua?: () => string | null;
};

/** ABT setempat tiruan: beranda, kelompok, cari (303 ke view), view&d, preview, lalu PDF portal. */
export function abtPalsu(o: OpsiAbt = {}): Pelayan {
  let hitungPdf = 0;
  return (p) => {
    if (o.bunuhSaat && o.bunuhSaat(p)) return "bunuh";
    const u = new URL(p.alamat);
    if (u.pathname === "/aleta/api/aleta-bot/abt/pdf") {
      hitungPdf += 1;
      const khusus = o.pdf ? o.pdf(hitungPdf) : null;
      if (khusus) return khusus;
      const rtf = JSON.parse(p.badan).rtfBase64 as string;
      const pdf = Buffer.from(`%PDF-1.4 dari ${Buffer.from(rtf, "base64").toString("latin1")}`).toString("base64");
      return jawaban(200, JSON.stringify({ ok: true, data: { available: true, pdfBase64: pdf } }), p.alamat);
    }
    if (o.masuk && !o.masuk()) return jawaban(200, HALAMAN_MASUK, `${ASAL}/aps_badilag/index.php/login`);
    if (u.pathname === "/aps_badilag/abt/main/beranda" && !u.searchParams.get("a")) {
      return jawaban(200, halamanBeranda(), p.alamat);
    }
    if (u.pathname === "/aps_badilag/abt/main/beranda") {
      const a = u.searchParams.get("a");
      if (a === TOKEN_KELOMPOK.relaas) {
        if (o.kelompok500) return jawaban(500, "A PHP Error was encountered", p.alamat);
        return jawaban(200, halamanKelompok(o.berkasAda ?? KATALOG), p.alamat);
      }
      return jawaban(200, halamanKelompok(["Penetapan Hari Sidang.rtf"]), p.alamat);
    }
    if (u.pathname === "/aps_badilag/abt/main/cari" && p.metode === "POST") {
      const badan = new URLSearchParams(p.badan);
      const id = String(badan.get("c"));
      const grup = o.tolakSemua ? o.tolakSemua() : null;
      if (grup) {
        return jawaban(
          200,
          `<h3 style='color:red;font-weight:bold;text-align:center;margin:50px;'>USER ${grup}<br>TIDAK ADA AKSES MENGGUNAKAN BLANGKO INI</h3>` +
            `<meta http-equiv=refresh content='3;url=/aps_badilag/abt'>`,
          `${ASAL}/aps_badilag/index.php/abt/main/cari`
        );
      }
      const tolak = o.tolakAkses ? o.tolakAkses(id) : null;
      if (tolak) {
        return jawaban(
          200,
          `<h5 style='color:red;font-weight:bold;text-align:center;margin:20px;'>${tolak}</h5>`,
          `${ASAL}/aps_badilag/index.php/abt/main/cari`
        );
      }
      // redirect("abt/main/view?b=".encode($file)."&c=$perkara_id&a=".encode($dir)) - token BARU.
      const lihat = `${ASAL}/aps_badilag/index.php/abt/main/view?b=V${id}b~n.&c=${id}&a=V${id}a~n.`;
      return jawaban(200, `<h2>blangko</h2>`, lihat);
    }
    if (u.pathname === "/aps_badilag/index.php/abt/main/view") {
      const q = kueri(p.alamat);
      const d = q.get("d") ?? "";
      // base_url() ABT hanya JALUR ($root = "/aps_badilag/"), jadi tautannya relatif.
      const cetak = `/aps_badilag/abt/preview?c=${q.get("c")}&e=&b=${q.get("b")}&a=${q.get("a")}&d=${d}`;
      return jawaban(200, `<table></table><a href="${cetak}"><img src="cetak.png"></a>`, p.alamat);
    }
    if (u.pathname === "/aps_badilag/abt/preview") {
      const q = kueri(p.alamat);
      if (o.cetak500 && o.cetak500(String(q.get("c")))) return jawaban(500, "Internal Server Error", p.alamat);
      return jawaban(200, `{\\rtf1\\ansi perkara ${q.get("c")} sidang ${q.get("d")}}`, p.alamat);
    }
    return jawaban(404, "tidak ada", p.alamat);
  };
}

// ---------------------------------------------------------------------------
// Dokumen
// ---------------------------------------------------------------------------

export function dokumen(i: number, golongan: string, d: number | null, jurusita: string) {
  const keadaan = golongan === "sidang-lanjutan" ? "sidang-ditunda" : golongan;
  return {
    kunci: `${golongan}:${100 + i}:${d ?? 0}:0`,
    perkaraId: String(100 + i),
    nomorPerkara: `${100 + i}/Pdt.G/2026/PA.Dgl`,
    golongan,
    label: `Dokumen ${i}`,
    d,
    berkas: BERKAS(keadaan),
    nama: `${100 + i}-Pdt.G-2026-PA.Dgl - dokumen ${i}`,
    jurusita,
  };
}

export const ENAM = [
  dokumen(1, "sidang-pertama", 1, "Andi Juru Sita, S.H."),
  dokumen(2, "sidang-ditunda", 3, "Andi Juru Sita, S.H."),
  dokumen(3, "pemberitahuan-putusan", null, "Budi Santoso"),
  dokumen(4, "ikrar-talak", 2, "Budi Santoso"),
  dokumen(5, "sidang-pertama", 1, "tidak tercatat"),
  dokumen(6, "sidang-ditunda", 4, "Andi Juru Sita, S.H."),
];

export function pesanMulai(dok: any[], tambahan: Record<string, unknown> = {}) {
  return {
    jenis: "relaas-mulai",
    asal: ASAL,
    asalAbt: `${ASAL}/aps_badilag`,
    pekerjaan: { tanggal: "2026-09-25", dokumen: dok, dilewati: [], asal: ASAL, asalAbt: `${ASAL}/aps_badilag`, ...tambahan },
  };
}

export const cetakUntuk = (dunia: Dunia, perkaraId: string) =>
  dunia.permintaan.filter((p) => p.alamat.includes("/abt/preview?") && kueri(p.alamat).get("c") === perkaraId);

export const namaRelatif = (u: Unduhan) => u.filename.slice(FOLDER_UNDUHAN.length).replace(/\\/g, "/");

export function simpangan(x: number[]) {
  const rata = x.reduce((a, b) => a + b, 0) / x.length;
  return { rata, baku: Math.sqrt(x.reduce((a, b) => a + (b - rata) ** 2, 0) / x.length) };
}
