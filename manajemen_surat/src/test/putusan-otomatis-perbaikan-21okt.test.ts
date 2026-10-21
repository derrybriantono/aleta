// @vitest-environment node
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PUTUSAN OTOMATIS DI HALAMAN SIPP TIDAK BERFUNGSI - PERBAIKAN 21 OKT 2026
 * ============================================================================
 *
 * Laporan pengguna (SIPP sungguhan, 1.205.23/24): "Isi & simpan Putusan Akhir" hanya MEMBUKA borang
 * Putusan Akhir tanpa mengisi; "e-Doc putusan" dan "e-Doc anonimisasi" GAGAL. Jejak akses server 21 Okt
 * 14.54 (229/Pdt.P/2026/PA.Dgl, perkara_id 10172): borang dibuka (add_putusan_akhir/tambah ->
 * managePutusanAkhir), lalu GET putusan/isian-sipp menjawab 126 bita = {ada:false, "Belum ada draf putusan
 * ALETA ..."} - alur berhenti di "usulan", tidak ada yang diisi, dan kedua e-Doc ditandai gagal karena
 * Putusan Akhir belum tersimpan. Berkas putusan yang diseret ke panel itu hanya dipakai untuk e-Doc, tidak
 * pernah dibaca untuk mengisi. Di log portal ada galat terpisah: "[unggah massal] sipp/varian putusan ...
 * near '?)'" - pola REGEXP "mut.?ah" ditempel di dalam kutip dan tanda tanyanya dimakan pustaka mysql
 * sebagai tempat parameter.
 *
 * Yang dijaga di sini:
 *   A. bot: kueri bahan varian putusan berparameter benar (pola REGEXP = parameter), diuji juga atas
 *      MariaDB lokal (sipp_donggala) bila menyala - parameter kosong dan terisi;
 *   B. konten.js (bagianIsiPutusan SUNGGUHAN): berkas dari panel SIPP menjadi sumber isian (naskah ->
 *      draf -> usulan -> Isikan -> Simpan -> e-Doc dari berkas itu); naskah yang ditolak berhenti dengan
 *      sebab (tidak menggantung); centang e-Doc dihormati walau naskah tersimpan di peramban; pembacaan
 *      usulan lain selagi Isikan berjalan TIDAK menyimpan dua kali;
 *   C. putusan-sipp.js: tanpa draf dan tanpa berkas -> blangko tidak dibuka, sebabnya jelas, tombol utama
 *      mati; berkas siap -> diteruskan sebagai naskah; e-Doc yang tidak dikerjakan menyebut sebabnya;
 *   D. aturan bersama panel terlipat (panel-alat.js) dan pemakaiannya.
 *
 * ALETA_TANGKAP_W31=<awalan> menyimpan HTML keadaan panel untuk tangkapan Playwright.
 */

const AKAR = path.resolve(process.cwd(), "..");
const EKS = path.join(AKAR, "ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = baca("konten.js");
const ALAT = baca("panel-alat.js");
const MODUL = baca("putusan-edoc-sekaligus.js");
const PUSIPP = baca("putusan-sipp.js");
const PASANGAN = baca("putusan-terjadwal-pasangan.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "229/Pdt.P/2026/PA.Dgl";
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
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

// ============================================================================
// A. Bot: bahan varian putusan (sippJadwalSidangService.bahanVarianPutusan)
// ============================================================================
const muatBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const ENV_LAMA: Record<string, string | undefined> = {};
const ENV_DB: Record<string, string> = {
  ALETA_BOT_DB_SIPP_HOST: "127.0.0.1",
  ALETA_BOT_DB_SIPP_PORT: "3306",
  ALETA_BOT_DB_SIPP_USER: "root",
  ALETA_BOT_DB_SIPP_PASSWORD: "",
  ALETA_BOT_DB_SIPP_NAME: "sipp_donggala",
  ALETA_BOT_DB_CONNECT_TIMEOUT_MS: "1500",
};
type Kueri = (sql: string, params: unknown[], cb: (e: unknown, r?: unknown) => void) => void;
let db: { query: Kueri; end?: (cb?: () => void) => void } & Record<string, unknown>;
let layanan: { bahanVarianPutusan: (rows: unknown[]) => Promise<Record<string, Record<string, unknown>>> };
let sqlstring: { format: (sql: string, params: unknown[]) => string };
let dbHidup = false;
const kueriAsli: { fn: Kueri | null } = { fn: null };

beforeAll(async () => {
  for (const [k, v] of Object.entries(ENV_DB)) {
    ENV_LAMA[k] = process.env[k];
    process.env[k] = v;
  }
  db = muatBot(path.join(AKAR, "aleta_bot/db_config.js"));
  layanan = muatBot(path.join(AKAR, "aleta_bot/services/sippJadwalSidangService.js"));
  sqlstring = muatBot("sqlstring");
  kueriAsli.fn = db.query.bind(db) as Kueri;
  dbHidup = await new Promise<boolean>((selesai) => {
    const batas = setTimeout(() => selesai(false), 2500);
    try {
      kueriAsli.fn!("SELECT 1 AS satu", [], (e) => {
        clearTimeout(batas);
        selesai(!e);
      });
    } catch {
      clearTimeout(batas);
      selesai(false);
    }
  });
}, 10000);

afterAll(async () => {
  for (const [k, v] of Object.entries(ENV_LAMA)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await new Promise<void>((r) => {
    try {
      if (db && typeof db.end === "function") db.end(() => r());
      else r();
    } catch {
      r();
    }
  });
});

/** Menjalankan bahanVarianPutusan dengan db.query ditiru: kueri dirakit lewat sqlstring (seperti pustaka mysql). */
async function denganKueriTiruan(rows: unknown[]) {
  const terkirim: string[] = [];
  const lama = db.query;
  db.query = ((sql: string, params: unknown[], cb: (e: unknown, r?: unknown) => void) => {
    terkirim.push(sqlstring.format(sql, params));
    setTimeout(() => cb(null, []), 0);
  }) as Kueri;
  try {
    const hasil = await layanan.bahanVarianPutusan(rows);
    return { hasil, terkirim };
  } finally {
    db.query = lama;
  }
}

describe("A. bot: kueri bahan varian putusan (sebab '[unggah massal] sipp/varian putusan ... near '?)'')", () => {
  it("pola REGEXP dikirim sebagai parameter: tidak ada '?' tersisa, nomor perkara tidak tergeser, pola utuh dalam kutip", async () => {
    const rows = [
      { perkaraId: 101, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat" },
      { perkaraId: 102, nomorPerkara: "2/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat" },
      { perkaraId: 103, nomorPerkara: "3/Pdt.P/2026/PA.Dgl", jenisPerkara: "Lain-Lain" },
    ];
    const { terkirim } = await denganKueriTiruan(rows);
    const regexp = terkirim.filter((q) => /REGEXP/.test(q));
    expect(regexp.length).toBe(2); // nafkah istri (cerai gugat) + mafqud (Lain-Lain Pdt.P)
    for (const q of regexp) {
      // Pola sendiri memuat "?" ("mut.?ah"); yang tidak boleh ada: "?" yang tertinggal sebagai tempat parameter.
      expect(q).not.toMatch(/IN \([^)]*\?/);
      expect(q).not.toMatch(/\?\)$/);
    }
    expect(regexp.find((q) => /madliyah/.test(q))).toContain("REGEXP 'madliyah|madhiyah|iddah|mut.?ah'");
    expect(regexp.find((q) => /madliyah/.test(q))).toContain("IN (101, 102)");
    expect(regexp.find((q) => /mafqud/.test(q))).toContain("REGEXP 'mafqud|orang +(yang +)?hilang'");
    expect(regexp.find((q) => /mafqud/.test(q))).toContain("IN (103)");
  });

  it("parameter kosong: tanpa perkara yang cocok tidak ada kueri sama sekali dan hasilnya kosong (bukan galat)", async () => {
    const { hasil, terkirim } = await denganKueriTiruan([]);
    expect(terkirim).toEqual([]);
    expect(polos(hasil)).toEqual({ tergugatPerempuan: {}, amarRekonvensi: {}, kabulSebagian: {}, pencairanDana: {}, kumulasiNafkahIstri: {}, plusNafkahAnak: {}, mafqud: {} });
  });

  it("MariaDB lokal (sipp_donggala): kueri lama MENOLAK 'near ?)', kueri baru menjawab untuk cerai gugat & Lain-Lain", async (ctx) => {
    if (!dbHidup) ctx.skip();
    const baris = await new Promise<Array<{ perkara_id: number; nomor_perkara: string; jenis_perkara_nama: string }>>((selesai, tolak) =>
      kueriAsli.fn!(
        "SELECT perkara_id, nomor_perkara, jenis_perkara_nama FROM perkara WHERE jenis_perkara_nama IN ('Cerai Gugat', 'Lain-Lain') ORDER BY perkara_id DESC LIMIT 40",
        [],
        (e, r) => (e ? tolak(e) : selesai(r as never))
      )
    );
    const cg = baris.filter((b) => b.jenis_perkara_nama === "Cerai Gugat").map((b) => b.perkara_id);
    expect(cg.length).toBeGreaterThan(1);
    // Bentuk LAMA (pola ditempel dalam kutip) - inilah galat di log server.
    const lama = `SELECT p.perkara_id AS perkaraId, (LOWER(p.petitum) REGEXP 'madliyah|madhiyah|iddah|mut.?ah') AS ya FROM perkara p WHERE p.perkara_id IN (${cg.map(() => "?").join(", ")})`;
    const galatLama = await new Promise<{ message?: string } | null>((selesai) => kueriAsli.fn!(lama, cg, (e) => selesai((e as { message?: string }) || null)));
    expect(String(galatLama && galatLama.message)).toMatch(/near '\?\)'/);
    // Bentuk BARU lewat layanan sungguhan.
    const rows = baris.map((b) => ({ perkaraId: b.perkara_id, nomorPerkara: b.nomor_perkara, jenisPerkara: b.jenis_perkara_nama }));
    const hasil = await layanan.bahanVarianPutusan(rows);
    expect(Object.keys(hasil.kumulasiNafkahIstri).length).toBe(cg.length);
    for (const v of Object.values(hasil.kumulasiNafkahIstri)) expect(typeof v).toBe("boolean");
  });
});

// ============================================================================
// B. konten.js: bagianIsiPutusan SUNGGUHAN lewat kotak.otomatis()
// ============================================================================
function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}
function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => b.startsWith(`const ${nama} = `));
  if (mulai < 0) throw new Error(`tetapan ${nama} tidak ketemu`);
  if (baris[mulai].trimEnd().endsWith(";")) return baris[mulai];
  let j = mulai;
  while (j < baris.length && baris[j] !== "};" && baris[j] !== "];") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}
const ada = (isi: string, nama: string) => new RegExp(`^(?:async )?function ${nama}\\(`, "m").test(isi);
const adaTetapan = (isi: string, nama: string) => new RegExp(`^const ${nama} = `, "m").test(isi);

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type OpsiKonten = {
  /** Draf ALETA sudah ada sebelum alur berjalan. */
  drafAwal?: boolean;
  /** Portal menolak naskah yang dikirim. */
  naskahDitolak?: boolean;
  /** Naskah dari kunjungan lalu tersimpan di peramban ini (a30AmbilNaskahEdoc). */
  naskahTersimpan?: boolean;
  /** Simpan ditahan sampai janji ini selesai (untuk menguji klik di tengah jalan). */
  tahanSimpan?: Promise<void>;
};

function pasangKonten(o: OpsiKonten = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="sipp"></div></body></html>`);
  terbuka.push(dom);
  const dokumen = dom.window.document;
  const urut: string[] = [];
  const edocPanggilan: Array<Record<string, unknown>> = [];
  const keadaan = { draf: Boolean(o.drafAwal) };

  const jawabJson = (isi: unknown, status = 200) => {
    const r: any = { ok: status < 300, status, json: async () => polos(isi), clone: () => r };
    return r;
  };
  const pil = (...x: string[]) => [{ nilai: "-1", label: "Pilih" }, ...x.map((l, i) => ({ nilai: String(i + 1), label: l }))];
  const borang: Record<string, { tampak: boolean; nilai: string; pilihan: Array<{ nilai: string; label: string }> }> = {
    'select[name="status_putusan"]': { tampak: true, nilai: "1", pilihan: pil("Dikabulkan", "Ditolak") },
  };
  const k: Record<string, any> = {
    console: { ...console, warn() {}, log() {} },
    setTimeout,
    clearTimeout,
    AbortController,
    URLSearchParams,
    URL,
    TextDecoder,
    TextEncoder,
    FormData: dom.window.FormData,
    File: dom.window.File,
    FileReader: dom.window.FileReader,
    Blob: dom.window.Blob,
    btoa: dom.window.btoa.bind(dom.window),
    atob: dom.window.atob.bind(dom.window),
    encodeURIComponent,
    document: dokumen,
    location: { origin: ASAL, pathname: "/SIPP/detil_perkara_agama", search: "", hostname: "192.168.10.10" },
    window: {
      location: { hostname: "192.168.10.10", pathname: "/SIPP/detil_perkara_agama", search: "", origin: ASAL },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x },
      storage: {
        onChanged: { addListener() {} },
        local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
        session: { get: async () => ({}), set: async () => undefined },
      },
    },
    fetch: async (alamat: string, opsi?: { method?: string; body?: any }) => {
      const url = String(alamat);
      const cara = String(opsi?.method || "GET").toUpperCase();
      if (url.includes("/ekstensi/tipe-keluaran")) throw new TypeError("Failed to fetch");
      if (url.includes("/putusan/unggah-naskah")) {
        const berkas = opsi && opsi.body && typeof opsi.body.get === "function" ? opsi.body.get("berkas") : null;
        urut.push(`naskah:unggah:${berkas ? berkas.name : "-"}`);
        if (o.naskahDitolak) return jawabJson({ data: { ok: false, sebab: "Naskah tidak memuat bagian AMAR." } });
        keadaan.draf = true;
        return jawabJson({ data: { ok: true, versi: 3, bagian: [{ judul: "Amar", aksara: 120 }] } });
      }
      if (url.includes("/putusan/isian-sipp") && cara === "POST") {
        const badan = JSON.parse(String(opsi?.body || "{}"));
        return jawabJson({
          data: {
            usulan: badan.medan.map((m: { kunci: string; pilihan: Array<{ nilai: string; label: string }> }) => {
              const x = m.pilihan.find((y) => y.nilai !== "-1") || m.pilihan[0];
              return { kunci: m.kunci, nilai: x.nilai, nilaiLabel: x.label, keyakinan: "pasti", nilaiBanyak: [x] };
            }),
          },
        });
      }
      if (url.includes("/putusan/isian-sipp")) {
        urut.push(`draf:baca:${keadaan.draf ? "ada" : "tidak"}`);
        if (!keadaan.draf) return jawabJson({ data: { ada: false, sebab: "Belum ada draf putusan ALETA untuk perkara ini. Rakit dulu drafnya di menu Putusan." } });
        return jawabJson({
          data: { ada: true, versi: 3, keadaan: "draf", jenisPerkara: "Lain-Lain", pertimbangan: "<p>Menimbang.</p>", amar: "<p>1. Mengabulkan;</p>", amarAnonim: "<p>1. Mengabulkan;</p>" },
        });
      }
      if (url.includes("/putusan/praperiksa")) return jawabJson({ data: { ada: true, hentikan: false, ringkas: "lolos", temuan: [] } });
      if (url.includes("/unggah-massal/cek")) {
        urut.push("edoc:cek");
        return jawabJson({ ok: true, data: { adaBaris: true, adaPutusan: false, adaAnonim: false } });
      }
      return jawabJson({ ok: true });
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(ALAT, k, { filename: "panel-alat.js" });
  const naskahLama = new dom.window.File(["{\\rtf1 naskah lama}"], "229 - naskah lama.rtf", { type: "application/rtf" });
  Object.assign(k, {
    bagian: (judul: string) => {
      const kotak = dokumen.createElement("div") as any;
      kotak.className = "aleta-bagian";
      kotak.setAttribute("data-kunci", "isiPutusan");
      kotak.appendChild(dokumen.createElement("h3")).textContent = judul;
      kotak.isi = dokumen.createElement("div");
      kotak.appendChild(kotak.isi);
      dokumen.body.appendChild(kotak);
      return kotak;
    },
    konteksTerakhir: { nomorPerkara: NOMOR, nomorPihak: [] },
    alatCatat: () => undefined,
    alatCatatTindakan: () => undefined,
    alatKeringNyala: () => false,
    alatCobaAktif: () => false,
    alatLatihanNyala: () => false,
    t7RaporAgen: () => dokumen.createElement("div"),
    gambarRaporAgen: () => dokumen.createElement("div"),
    t7PasangPenyunting: () => undefined,
    perkaraIdDariHalaman: () => "10172",
    namaPenggunaSipp: () => "petugas",
    a30Aktif: () => true,
    s1Aktif: () => true,
    a30PesanDitahan: (_b: unknown, apa: string) => `${apa} ditahan`,
    ambilStatusPerkara: async () => ({ putusan: { sudahPutus: false }, putusanLengkap: {} }),
    bacaPutusanSegar: async () => ({ sudahPutus: false, tanggal: "", status: "" }),
    a30PerkaraIdUntukAbt: async () => "10172",
    alatBolehUnggahPutusanKini: () => true,
    a30KonversiNaskah: async () => ({ ok: false, pesan: "tidak dipakai di uji ini" }),
    a30SimpanNaskahEdoc: async () => undefined,
    a30AmbilNaskahEdoc: async () => (o.naskahTersimpan ? { asli: naskahLama, rtf: naskahLama } : null),
    aletaPenetapanKerja: {
      ambilKunci: async (id: number, tujuan: string) => {
        urut.push(`kunci:ambil:${id}:${tujuan}`);
        return { ok: true, token: "tok1" };
      },
      lepasKunci: async () => void urut.push("kunci:lepas"),
    },
    alatMuatPetaBlangkoLengkap: async () => ({}),
    a30UnggahEdoc: async (p: { putusan: File | null; anonimisasi: File | null }) => {
      urut.push(`edoc:unggah:${p.putusan ? "putusan" : "-"}+${p.anonimisasi ? "anonim" : "-"}`);
      edocPanggilan.push({ putusan: p.putusan && p.putusan.name, anonimisasi: p.anonimisasi && p.anonimisasi.name });
      const berkas = [] as Array<{ jenis: string; ok: boolean }>;
      if (p.putusan) berkas.push({ jenis: "putusan", ok: true });
      if (p.anonimisasi) berkas.push({ jenis: "anonimisasi", ok: true });
      return { ok: true, berkas, bunyi: "Edoc terunggah." };
    },
    simpanPutusanLaluBuka: async (_n: string, kabar: any, opsi: any) => {
      urut.push("simpan");
      if (o.tahanSimpan) await o.tahanSimpan;
      if (opsi && opsi.sebelum) await opsi.sebelum;
      const lanjut = opsi && opsi.sesudahTersimpan ? await opsi.sesudahTersimpan(kabar) : null;
      return {
        ok: true,
        bunyi: `Tersimpan di SIPP. ${(lanjut && lanjut.bunyi) || ""}`.trim(),
        edoc: lanjut ? { ok: Boolean(lanjut.ok), bunyi: lanjut.bunyi, langkah: lanjut.langkah } : undefined,
      };
    },
    kirimKeJembatanLangsung: async (pesan: { jenis: string; penunjuk: string; nilai?: string }) => {
      await tunggu(1);
      const m = borang[pesan.penunjuk];
      if (pesan.jenis === "pilihan") {
        if (!m) return { ok: false, alasan: "tidak_ada" };
        return { ok: true, tampak: m.tampak, nilaiSekarang: m.nilai, pilihan: m.pilihan.map((x) => ({ ...x, terpilih: x.nilai === m.nilai })) };
      }
      if (pesan.jenis === "nilai") return { ok: true, nilai: m ? m.nilai : "21/10/2026", tampak: true };
      if (pesan.jenis === "isi") {
        urut.push(`isi:${pesan.penunjuk}`);
        if (m) m.nilai = String(pesan.nilai);
        return { ok: true };
      }
      return { ok: false };
    },
  });
  vm.runInContext(MODUL, k, { filename: "putusan-edoc-sekaligus.js" });
  const asli = k.aletaPutusanEdoc.jalankan;
  k.aletaPutusanEdoc.jalankan = (p: Record<string, unknown>) => {
    edocPanggilan.push({
      jalankan: { denganPutusan: p.denganPutusan, denganAnonim: p.denganAnonim, putusan: p.putusan ? (p.putusan as File).name : null },
    });
    return asli({
      ...p,
      deps: {
        putusanDariAbt: async () => ({ ok: true, berkas: new dom.window.File(["{\\rtf1 p}"], "229 - blangko ABT.rtf") }),
        penyamar: async (_a: unknown, putusan: File) => ({ ok: true, berkas: new dom.window.File(["{\\rtf1 a}"], `${putusan.name} - anonimisasi.rtf`), sisa: [] }),
      },
    });
  };

  const konten = KONTEN;
  const tetapanOpsional = (nama: string) => (adaTetapan(konten, nama) ? [tetapan(konten, nama)] : []);
  const fungsiOpsional = (...nama: string[]) => nama.filter((n) => ada(konten, n));
  vm.runInContext(
    [
      tetapan(konten, "ALETA_API_ISIAN_PUTUSAN"),
      tetapan(konten, "ALETA_API_PRAPERIKSA_PUTUSAN"),
      tetapan(konten, "ALETA_API_UNGGAH_NASKAH"),
      tetapan(konten, "BATAS_UNGGAH_NASKAH_MS"),
      tetapan(konten, "NILAI_BAWAAN_BORANG"),
      tetapan(konten, "PENUNJUK_TANGGAL_PUTUSAN"),
      tetapan(konten, "A30_TERIMA_NASKAH"),
      tetapan(konten, "A30_MIME"),
      tetapan(konten, "A30_API_SIDANG"),
      ...tetapanOpsional("A30_BATAS_ANONIM_ABT_MS"),
      ...tetapanOpsional("A30_BATAS_TUNGGU_ANONIM_MS"),
      ...tetapanOpsional("A30_DETAK_TUNGGU_ANONIM_MS"),
      ...tetapanOpsional("A30_BUKAN_SAMARAN"),
      ...(/^const s1Jeda = /m.test(konten) ? [tetapan(konten, "s1Jeda")] : []),
      "let penggunaTerakhir = null;",
      "let kapabilitasTerakhir = null;",
      ...[
        "buatElemen",
        "ringkasHentikan",
        "kirimKeJembatan",
        "nilaiTerpilihMedan",
        "nilaiTerpilihBukanBawaan",
        "muatanUsulanMedan",
        "bagianIsiPutusan",
        "b6KeadaanPutusanTerisi",
        "b6RincianPutusan",
        "b6KonfirmasiTimpaPutusan",
        "jalankanPraperiksaPanel",
        "bacaUsulanBorangPutusan",
        "mintaPraperiksaPutusan",
        "a30OpsiSimpanPutusan",
        "a30BarisSekaligus",
        "a30Bentuk",
        "a30PerluKeRtf",
        "sambungSebab",
        "a30Tanya",
        "b2AmbilKunci",
        "b2SiapkanTempat",
        "b2PasangUlangEdoc",
        "cekDrafPutusanAleta",
        ...fungsiOpsional("s1BacaUsulanBorangCepat", "s1TungguBerubah", "s1SiapkanAnonimAwal"),
      ].map((nama) => potongFungsi(konten, nama)),
      "this.__uji = { bagianIsiPutusan, cekDrafPutusanAleta };",
    ].join("\n"),
    k,
    { filename: "konten.js (potongan)" }
  );
  const rtf = (nama: string) => new dom.window.File(["{\\rtf1 PUTUSAN Nomor 229 ... AMAR ...}"], nama, { type: "application/rtf" });
  return { dom, dokumen, k, uji: k.__uji, urut, edocPanggilan, rtf, keadaan };
}

const ISI_TIGA = ["isi:#perhum", "isi:#amar", "isi:#amar_anonim"];
const tombolTeks = (kotak: Element, teks: string) => Array.from(kotak.querySelectorAll("button")).find((b) => b.textContent === teks) as HTMLButtonElement | undefined;

describe("B. kotak.otomatis(): berkas dari panel SIPP = sumber isian Putusan Akhir", () => {
  it("TANPA draf ALETA + berkas dari panel: naskah dibaca menjadi draf, Putusan Akhir terisi dan tersimpan SEKALI, e-Doc dari berkas itu", async () => {
    const h = pasangKonten();
    const kotak = h.uji.bagianIsiPutusan(NOMOR);
    const berkas = h.rtf("229 - putusan hakim.rtf");
    const hasil = await kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: true, naskah: berkas, naskahRtf: berkas, putusan: berkas, putusanRtf: berkas, melayang: true });
    expect(hasil).toMatchObject({ ok: true, tersimpan: true });
    // Urutan: naskah -> draf terbaca -> isi tiga bagian -> Simpan sekali -> e-Doc.
    const i = (x: string) => h.urut.indexOf(x);
    expect(i("naskah:unggah:229 - putusan hakim.rtf")).toBeGreaterThanOrEqual(0);
    expect(i("draf:baca:ada")).toBeGreaterThan(i("naskah:unggah:229 - putusan hakim.rtf"));
    for (const x of ISI_TIGA) expect(i(x)).toBeGreaterThan(i("draf:baca:ada"));
    expect(h.urut.filter((x) => x === "simpan")).toHaveLength(1);
    expect(i("simpan")).toBeGreaterThan(i("isi:#amar_anonim"));
    // e-Doc putusan = berkas yang dipilih (bukan blangko ABT), anonimisasi dibuat dari berkas itu.
    expect(h.edocPanggilan.find((x) => x.jalankan)).toMatchObject({ jalankan: { denganPutusan: true, denganAnonim: true, putusan: "229 - putusan hakim.rtf" } });
    expect(h.edocPanggilan.find((x) => "anonimisasi" in x)).toEqual({ putusan: "229 - putusan hakim.rtf", anonimisasi: "229 - putusan hakim.rtf - anonimisasi.rtf" });
    expect(kotak.hasAttribute("data-oto-jalan")).toBe(false);
  });

  it("naskah ditolak portal: alur SELESAI dengan sebabnya (tidak menggantung), tidak ada isian maupun Simpan", async () => {
    const h = pasangKonten({ naskahDitolak: true });
    const kotak = h.uji.bagianIsiPutusan(NOMOR);
    const berkas = h.rtf("229 - bukan putusan.rtf");
    const hasil = await Promise.race([
      kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: true, naskah: berkas, naskahRtf: berkas, melayang: true }),
      tunggu(4000).then(() => ({ menggantung: true })),
    ]);
    expect(hasil).toMatchObject({ ok: false, tahap: "naskah" });
    expect(String((hasil as { pesan?: string }).pesan)).toContain("Naskah tidak memuat bagian AMAR");
    expect(h.urut.some((x) => x.startsWith("isi:"))).toBe(false);
    expect(h.urut).not.toContain("simpan");
    expect(kotak.hasAttribute("data-oto-jalan")).toBe(false);
  });

  it("tanpa draf dan tanpa berkas: berhenti di usulan dengan sebab dari portal", async () => {
    const h = pasangKonten();
    const kotak = h.uji.bagianIsiPutusan(NOMOR);
    const hasil = await kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: true, melayang: true });
    expect(hasil).toMatchObject({ ok: false, tahap: "usulan" });
    expect(String(hasil.pesan)).toContain("Belum ada draf putusan ALETA");
    expect(h.urut).not.toContain("simpan");
  });

  it("naskah lama tersimpan di peramban + 'e-Doc anonimisasi' tidak dicentang: hanya e-Doc putusan yang diunggah (dulu keduanya)", async () => {
    const h = pasangKonten({ drafAwal: true, naskahTersimpan: true });
    const kotak = h.uji.bagianIsiPutusan(NOMOR);
    await tunggu(20); // a30AmbilNaskahEdoc memasang naskah lama ke baris sekaligus
    const hasil = await kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: false, melayang: true });
    expect(hasil).toMatchObject({ ok: true, tersimpan: true });
    expect(h.edocPanggilan.find((x) => x.jalankan)).toMatchObject({ jalankan: { denganPutusan: true, denganAnonim: false } });
    const unggah = h.urut.filter((x) => x.startsWith("edoc:unggah:"));
    expect(unggah).toEqual(["edoc:unggah:putusan+-"]);
  });

  it("'Ambil usulan' ditekan lagi (mis. muat-draf-sendiri) selagi Isikan/Simpan alur otomatis berjalan: TIDAK ada Isikan/Simpan kedua", async () => {
    let lepas: () => void = () => undefined;
    const tahan = new Promise<void>((r) => (lepas = r));
    const h = pasangKonten({ drafAwal: true, tahanSimpan: tahan });
    const kotak = h.uji.bagianIsiPutusan(NOMOR);
    const janji = kotak.otomatis({ edoc: false, denganPutusan: false, denganAnonim: false, melayang: true });
    await sampai(() => h.urut.includes("simpan"), "Simpan ditekan");
    expect(kotak.getAttribute("data-oto-jalan")).toBe("1");
    // Pembacaan usulan yang tidak diminta alur ini.
    tombolTeks(kotak, "Ambil usulan dari ALETA")!.click();
    await sampai(() => h.urut.filter((x) => x === "draf:baca:ada").length >= 2, "pembacaan kedua");
    await tunggu(150);
    lepas();
    const hasil = await janji;
    await tunggu(150);
    expect(hasil).toMatchObject({ ok: true, tersimpan: true });
    expect(h.urut.filter((x) => x === "simpan")).toHaveLength(1);
    expect(h.urut.filter((x) => x === "isi:#amar")).toHaveLength(1);
  });

  it("cekDrafPutusanAleta: ada / tidak ada / tidak terbaca - tidak pernah melempar", async () => {
    const h = pasangKonten();
    expect(await h.uji.cekDrafPutusanAleta(NOMOR)).toMatchObject({ ada: false });
    h.keadaan.draf = true;
    expect(await h.uji.cekDrafPutusanAleta(NOMOR)).toMatchObject({ ada: true, versi: 3 });
    h.k.alatAmbil = async () => {
      throw new Error("portal tidak terjangkau");
    };
    expect(await h.uji.cekDrafPutusanAleta(NOMOR)).toMatchObject({ ada: null });
  });
});

// ============================================================================
// C. putusan-sipp.js: sumber isian diperiksa sebelum blangko dibuka
// ============================================================================
type OpsiPanel = { draf?: boolean | null; otomatis?: (opsi: Record<string, unknown>) => Promise<Record<string, unknown>> };

function bukaPanel(o: OpsiPanel = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">` +
      `<table width="100%" id="submenus"><tr><td><table><tr>` +
      `<td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara">Kembali</a></td>` +
      `<td><a class="btn btn-default btn-sm" href="#">Penetapan Majelis Hakim</a></td>` +
      `</tr></table></td></tr></table></div></body></html>`,
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true };
  w.chrome = {
    runtime: { id: "uji", getManifest: () => ({ version: "1.205.25" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (kk?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [kk].flat()) if (n != null && n in simpanan) hasil[n as string] = polos(simpanan[n as string]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => {
    const r: any = { ok: false, status: 404, json: async () => ({}), text: async () => "", headers: { get: () => "" }, clone: () => r };
    return r;
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  const urut: string[] = [];
  const opsiOto: Array<Record<string, unknown>> = [];
  const keadaan = { draf: o.draf === undefined ? false : o.draf };
  Object.assign(w, {
    penggunaTerakhir: { nama: "Derry Briantono", peran: "Hakim" },
    boleh: () => true,
    cariNomorPerkara: () => NOMOR,
    b6KeadaanPutusanTerisi: async () => ({ terisi: false }),
    b6RincianPutusan: () => "",
    a30PerkaraIdUntukAbt: async () => "10172",
    muatUlangSesudahTulis: () => ({ otomatis: true }),
    cekDrafPutusanAleta: async () => {
      urut.push("draf:cek");
      return keadaan.draf === null ? { ada: null, sebab: "portal tidak menjawab" } : keadaan.draf ? { ada: true, versi: 3 } : { ada: false, sebab: "Belum ada draf putusan ALETA untuk perkara ini." };
    },
    s1BukaBlangkoPutusan: async () => {
      urut.push("buka-blangko");
      return { ok: true, lewat: "tambah" };
    },
    gambarUlangSesudahBlangko: async () => {
      urut.push("gambar-ulang");
      if (!w.document.querySelector('.aleta-bagian[data-kunci="isiPutusan"]')) {
        const bagian = w.document.createElement("div");
        bagian.className = "aleta-bagian";
        bagian.setAttribute("data-kunci", "isiPutusan");
        bagian.otomatis = async (opsi: Record<string, unknown>) => {
          urut.push("otomatis");
          opsiOto.push(opsi);
          await tunggu(5);
          if (o.otomatis) return o.otomatis(opsi);
          return { ok: true, tersimpan: true, edoc: { ok: true, langkah: [{ kunci: "putusan", judul: "e-Doc putusan", teks: "terunggah", nada: "ok" }, { kunci: "anonimisasi", judul: "e-Doc anonimisasi", teks: "terunggah", nada: "ok" }] } };
        };
        w.document.body.appendChild(bagian);
      }
      return true;
    },
    a30PerluKeRtf: (nama: string) => /\.(docx|doc|pdf)$/i.test(nama),
    a30KonversiNaskah: async (berkas: { name: string }) => ({ ok: true, berkas: new w.File([new Uint8Array(64)], String(berkas.name).replace(/\.[A-Za-z]+$/, ".rtf")), peringatan: [] }),
    aletaPutusanEdoc: {
      cekSlot: async () => ({ ok: true, adaBaris: true, adaPutusan: false, adaAnonim: false }),
      ambilKunci: async () => ({ ok: true, lepas: async () => undefined }),
      jalankan: async () => ({ ok: true, bunyi: "", langkah: [] }),
    },
  });
  vm.runInContext(PASANGAN, ctx, { filename: "putusan-terjadwal-pasangan.js" });
  vm.runInContext(PUSIPP, ctx, { filename: "putusan-sipp.js" });
  return { w, d: w.document as Document, urut, opsiOto, keadaan, simpanan };
}
type Panel = ReturnType<typeof bukaPanel>;
const api = (h: Panel) => h.w.aletaPutusanSipp;
const tombolPu = (h: Panel) => h.d.querySelector(".aleta-pusipp-tombol") as HTMLButtonElement | null;
const panelPu = (h: Panel) => h.d.getElementById("aleta-pusipp-panel") as HTMLElement | null;
const barisPu = (h: Panel, j: string) => panelPu(h)!.querySelector(`[data-pusipp-langkah="${j}"]`) as HTMLElement;
const statusPu = (h: Panel, j: string) => String(barisPu(h, j).querySelector("[data-pusipp-status]")?.getAttribute("data-pusipp-status") || "");
const utamaPu = (h: Panel) => panelPu(h)!.querySelector('[data-pusipp="utama"]') as HTMLButtonElement;

async function bukaDanBaca(h: Panel) {
  await sampai(() => (api(h).pasang(h.d), tombolPu(h)), "tombol");
  expect(panelPu(h)!.hidden).toBe(true); // bawaan terlipat
  tombolPu(h)!.click();
  await sampai(() => (api(h).pasang(h.d), api(h).keadaan().dibaca ? panelPu(h) : null), "keadaan terbaca");
}
async function pilihBerkas(h: Panel, nama: string) {
  await api(h).terimaBerkas([new h.w.File([new Uint8Array(2048)], nama, { type: "application/rtf" })]);
  await sampai(() => api(h).berkasSiap(), "berkas siap");
}
async function yaJalankan(h: Panel) {
  utamaPu(h).click();
  await sampai(() => panelPu(h)!.querySelector(".aleta-pusipp-konfirm"), "konfirmasi");
  (panelPu(h)!.querySelector('[data-pusipp="ya"]') as HTMLButtonElement).click();
}
function tangkap(h: Panel, nama: string) {
  const awalan = process.env.ALETA_TANGKAP_W31;
  if (!awalan) return;
  h.d.querySelectorAll("input[type=checkbox]").forEach((c) => {
    if ((c as HTMLInputElement).checked) c.setAttribute("checked", "");
    else c.removeAttribute("checked");
  });
  writeFileSync(`${awalan}-${nama}.html`, h.d.getElementById("konten")!.outerHTML + (panelPu(h) && !h.d.getElementById("konten")!.contains(panelPu(h)) ? panelPu(h)!.outerHTML : ""), "utf8");
}

describe("C. panel Putusan Otomatis (putusan-sipp.js): sumber isian sebelum blangko dibuka", () => {
  it("tanpa draf ALETA dan tanpa berkas: langkah isi 'perlu berkas putusan' dengan sebab jelas, tombol utama mati, blangko TIDAK dibuka", async () => {
    const h = bukaPanel({ draf: false });
    await sampai(() => (api(h).pasang(h.d), tombolPu(h)), "tombol");
    tangkap(h, "terlipat");
    tombolPu(h)!.click();
    await sampai(() => (api(h).pasang(h.d), api(h).keadaan().dibaca ? panelPu(h) : null), "keadaan terbaca");
    expect(statusPu(h, "isi")).toBe("perlu");
    expect(barisPu(h, "isi").textContent).toContain("Belum ada draf putusan ALETA");
    expect(barisPu(h, "isi").textContent).toContain("Seret berkas putusan");
    expect(utamaPu(h).disabled).toBe(true);
    expect(panelPu(h)!.querySelector(".aleta-pusipp-ringkas")!.textContent).toContain("Pilih berkas putusan lebih dulu");
    api(h).mintaKonfirmasi();
    await api(h).jalankan();
    expect(h.urut).not.toContain("buka-blangko");
    tangkap(h, "perlu-berkas");
  });

  it("tanpa draf, berkas diseret: langkah isi 'Diisi dari berkas ...', Ya meneruskan berkas sebagai NASKAH dan e-Doc", async () => {
    const h = bukaPanel({ draf: false });
    await bukaDanBaca(h);
    await pilihBerkas(h, "229 - putusan hakim.rtf");
    expect(statusPu(h, "isi")).toBe("tunggu");
    expect(barisPu(h, "isi").textContent).toContain("Diisi dari berkas 229 - putusan hakim.rtf");
    expect(utamaPu(h).disabled).toBe(false);
    tangkap(h, "berkas-siap");
    await yaJalankan(h);
    await sampai(() => statusPu(h, "anonim") === "ok", "selesai");
    expect(h.urut).toEqual(expect.arrayContaining(["buka-blangko", "gambar-ulang", "otomatis"]));
    expect((h.opsiOto[0].naskah as File).name).toBe("229 - putusan hakim.rtf");
    expect((h.opsiOto[0].putusan as File).name).toBe("229 - putusan hakim.rtf");
    tangkap(h, "selesai");
  });

  it("draf ada: diisi dari draf ALETA (bukan berkas), blangko dibuka sesudah draf terbukti ada", async () => {
    const h = bukaPanel({ draf: true });
    await bukaDanBaca(h);
    expect(barisPu(h, "isi").textContent).toContain("Diisi dari draf putusan ALETA versi 3");
    const awal = h.urut.length;
    await yaJalankan(h);
    await sampai(() => statusPu(h, "isi") === "ok", "selesai");
    const jalan = h.urut.slice(awal);
    expect(jalan.indexOf("draf:cek")).toBeGreaterThanOrEqual(0);
    expect(jalan.indexOf("draf:cek")).toBeLessThan(jalan.indexOf("buka-blangko"));
    expect(h.opsiOto[0]).toMatchObject({ naskah: null, putusan: null });
  });

  it("draf tidak terbaca (portal diam): pengisian tetap boleh dicoba - alurnya yang menyebut sebab", async () => {
    const h = bukaPanel({ draf: null });
    await bukaDanBaca(h);
    expect(statusPu(h, "isi")).toBe("tunggu");
    expect(utamaPu(h).disabled).toBe(false);
  });

  it("draf hilang di antara membuka panel dan menekan Ya: diperiksa lagi, blangko tidak dibuka, e-Doc 'tidak dikerjakan' beserta sebabnya", async () => {
    const h = bukaPanel({ draf: true });
    await bukaDanBaca(h);
    h.keadaan.draf = false;
    await yaJalankan(h);
    await sampai(() => statusPu(h, "isi") === "gagal", "gagal");
    expect(h.urut).not.toContain("buka-blangko");
    expect(barisPu(h, "isi").textContent).toContain("Belum ada draf putusan ALETA");
    expect(barisPu(h, "putusan").textContent).toContain("Tidak dikerjakan: Putusan Akhir belum tersimpan (sebabnya tertulis di langkah pertama)");
    expect(barisPu(h, "anonim").textContent).toContain("Tidak dikerjakan: Putusan Akhir belum tersimpan");
    tangkap(h, "gagal-tanpa-draf");
  });

  it("alur ekstensi berhenti dengan sebab (mis. praperiksa): sebab itu yang tampil di langkah isi, bukan hanya 'gagal'", async () => {
    const h = bukaPanel({ draf: true, otomatis: async () => ({ ok: false, tahap: "praperiksa", pesan: "Praperiksa menahan: tanggal putusan mendahului sidang terakhir." }) });
    await bukaDanBaca(h);
    await yaJalankan(h);
    await sampai(() => statusPu(h, "isi") === "gagal", "gagal");
    expect(barisPu(h, "isi").textContent).toContain("Praperiksa menahan: tanggal putusan mendahului sidang terakhir.");
  });
});

// ============================================================================
// D. Aturan bersama: semua panel ekstensi bawaannya terlipat
// ============================================================================
describe("D. panel ekstensi bawaannya TERLIPAT (kecuali Blangko ABT by Derry Briantono)", () => {
  function alat(sesi?: Map<string, string>) {
    const peta = sesi || new Map<string, string>();
    const k: Record<string, any> = {
      console,
      setTimeout,
      clearTimeout,
      sessionStorage: { getItem: (x: string) => (peta.has(x) ? peta.get(x)! : null), setItem: (x: string, v: string) => void peta.set(x, v), removeItem: (x: string) => void peta.delete(x) },
      chrome: { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } }, runtime: { getManifest: () => ({ version: "0" }) } },
      location: { pathname: "/SIPP/detil_perkara_agama", origin: ASAL, hostname: "192.168.10.10", search: "" },
      document: new JSDOM("<!doctype html><html><body></body></html>").window.document,
    };
    k.globalThis = k;
    vm.createContext(k);
    vm.runInContext(ALAT, k, { filename: "panel-alat.js" });
    return { k, peta };
  }

  it("alatPanelTerbuka/alatIngatPanel: bawaan terlipat; dibuka diingat selama kunjungan; sesiTab bertahan di tab yang sama, bukan di tab baru", () => {
    const { k, peta } = alat();
    expect(k.alatBawaanTerlipat("x")).toBe(true);
    k.alatIngatPanel("x", true);
    expect(k.alatPanelTerbuka("x")).toBe(true);
    k.alatIngatPanel("x", false);
    expect(k.alatPanelTerbuka("x")).toBe(false);
    k.alatIngatPanel("w", true, { sesiTab: true });
    // Muat ulang di tab yang sama = memori baru, sessionStorage tetap.
    const ulang = alat(peta);
    expect(ulang.k.alatPanelTerbuka("w", { sesiTab: true })).toBe(true);
    expect(ulang.k.alatPanelTerbuka("w")).toBe(false); // panel halaman perkara tidak memakai ingatan sesi
    // Tab baru = sessionStorage kosong.
    expect(alat().k.alatPanelTerbuka("w", { sesiTab: true })).toBe(false);
  });

  it("panel utama ALETA, SIPP, ABT: bawaannya lencana; pilihan 'terbuka' yang disimpan sebelum 21 Okt 2026 16.00 WITA tidak berlaku", () => {
    const { k } = alat();
    expect(polos(k.alatBawaanTampilBerlaku(null, null))).toEqual({ aleta: false, sipp: false, abt: false, sumber: "bawaan" });
    expect(polos(k.alatBawaanTampilBerlaku({ sipp: true, abt: true, diubahPada: "2026-10-21T07:00:00Z" }, null)).sipp).toBe(false);
    expect(polos(k.alatBawaanTampilBerlaku({ sipp: true, diubahPada: "2026-10-21T09:00:00Z" }, null)).sipp).toBe(true);
  });

  it("Penetapan Otomatis, Putusan Otomatis, Jadwalkan Putusan tidak lagi mengingat buka-tutup di chrome.storage.local; Blangko Derry tidak disentuh aturan ini", () => {
    for (const b of ["penetapan-sipp.js", "putusan-sipp.js", "putusan-terjadwal.js"]) {
      const isi = baca(b);
      expect(isi, b).not.toMatch(/KUNCI_LIPAT_PANEL|lipatanBagian/);
      expect(isi, b).toContain("alatPanelTerbuka");
      expect(isi, b).toContain("alatIngatPanel");
    }
    for (const b of ["blangko-derry.js", "blangko-derry-isian.js", "blangko-derry-massal.js"]) expect(baca(b), b).not.toMatch(/alatPanelTerbuka|alatBawaanTerlipat|alatIngatPanel/);
    expect(baca("checklist.js")).toContain('alatPanelTerbuka("checklist-widget", { sesiTab: true })');
    // Kotak "Perkara ini di SIPP, ABT, dan ALETA" tidak lagi terbuka sendiri.
    expect(baca("sipp-ide-m2.js")).not.toMatch(/badan\.hidden = !r\.perluPerhatian/);
  });

  it("tidak ada kata ALETA yang ditulis ke SIPP dari perubahan ini: putusan-sipp.js tidak memanggil portal/SIPP sendiri", () => {
    expect(PUSIPP).not.toMatch(/fetch\(|alatAmbil\(/);
    expect(PUSIPP).toContain('fungsi("cekDrafPutusanAleta")');
    expect(KONTEN).toContain("async function cekDrafPutusanAleta(nomorPerkara)");
  });
});
