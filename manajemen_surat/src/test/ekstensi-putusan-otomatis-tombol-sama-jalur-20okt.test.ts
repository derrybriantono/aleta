// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TOMBOL "PUTUSAN OTOMATIS" DI HALAMAN SIPP = SATU JALUR DENGAN PANEL EKSTENSI (20 Okt 2026, agen B2)
 * ============================================================================
 *
 * Permintaan: tombol di halaman SIPP harus memakai FUNGSI YANG SAMA (satu sumber kode, bukan salinan)
 * dengan Putusan otomatis di ekstensi. Jalurnya: kotak.otomatis() menekan tombol-tombol bagian
 * "Putusan otomatis" panel (Ambil usulan -> Isikan yang dicentang) lalu menunggu hasilnya.
 *
 * Diuji dengan MENJALANKAN bagianIsiPutusan sungguhan (potongan konten.js) bersama
 * putusan-edoc-sekaligus.js sungguhan di node:vm; SIPP, portal, ABT, dan Simpan ditiru:
 *   - urutan langkah lewat tombol otomatis PERSIS sama dengan menekan tombol panel dengan tangan;
 *   - kunci per perkara (dibagi dengan penetapan) diambil sebelum mengisi dan dilepas sesudahnya;
 *     kunci dipegang pekerjaan lain = tidak mengisi dan tidak menyimpan;
 *   - praperiksa yang menahan tetap menahan (Simpan tidak ditekan);
 *   - langkah e-Doc yang tidak dicentang tidak dikerjakan;
 *   - hasilnya memuat laporan per langkah.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = baca("konten.js");
const ALAT = baca("panel-alat.js");
const MODUL = baca("putusan-edoc-sekaligus.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

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

type Opsi = { kunci?: "ok" | "sibuk"; hentikan?: boolean; tanpaDraf?: boolean; cekAda?: { adaPutusan?: boolean; adaAnonim?: boolean } };

function pasang(o: Opsi = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="sipp"></div></body></html>`);
  terbuka.push(dom);
  const dokumen = dom.window.document;
  const urut: string[] = [];
  const simpanOpsi: any[] = [];
  const edocPanggilan: any[] = [];

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
        if (o.tanpaDraf) return jawabJson({ data: { ada: false, sebab: "Belum ada draf putusan untuk perkara ini." } });
        return jawabJson({
          data: { ada: true, versi: 2, keadaan: "draf", jenisPerkara: "Cerai Gugat", pertimbangan: "<p>Menimbang.</p>", amar: "<p>1. Mengabulkan;</p>", amarAnonim: "<p>1. Mengabulkan;</p>" },
        });
      }
      if (url.includes("/putusan/praperiksa")) {
        return jawabJson({
          data: o.hentikan
            ? { ada: true, hentikan: true, ringkas: "menahan", temuan: [{ tingkat: "hentikan", judul: "Tanggal putusan mendahului sidang terakhir", rincian: "" }] }
            : { ada: true, hentikan: false, ringkas: "lolos", temuan: [] },
        });
      }
      if (url.includes("/unggah-massal/cek")) {
        urut.push("edoc:cek");
        return jawabJson({ ok: true, data: { adaBaris: true, adaPutusan: false, adaAnonim: false, ...(o.cekAda || {}) } });
      }
      return jawabJson({ ok: true });
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(ALAT, k, { filename: "panel-alat.js" });
  Object.assign(k, {
    bagian: (judul: string) => {
      const kotak = dokumen.createElement("div") as any;
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
    perkaraIdDariHalaman: () => "10260",
    namaPenggunaSipp: () => "petugas",
    a30Aktif: () => true,
    s1Aktif: () => true,
    a30PesanDitahan: (_b: unknown, apa: string) => `${apa} ditahan`,
    ambilStatusPerkara: async () => ({ putusan: { sudahPutus: false }, putusanLengkap: {} }),
    bacaPutusanSegar: async () => ({ sudahPutus: false, tanggal: "", status: "" }),
    a30PerkaraIdUntukAbt: async () => "10260",
    alatBolehUnggahPutusanKini: () => true,
    // Penetapan: kunci per perkara yang sama dengan penetapan.
    aletaPenetapanKerja: {
      ambilKunci: async (id: number, tujuan: string) => {
        urut.push(`kunci:ambil:${id}:${tujuan}`);
        return o.kunci === "sibuk" ? { ok: false, alasan: "sedang_dikerjakan", oleh: "Derry", tujuan: "kerjakan-penetapan" } : { ok: true, token: "tok1" };
      },
      lepasKunci: async () => void urut.push("kunci:lepas"),
    },
    // Dunia ABT/portal untuk modul e-Doc:
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
      simpanOpsi.push(opsi || null);
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
      if (pesan.jenis === "nilai") return { ok: true, nilai: m ? m.nilai : "20/10/2026", tampak: true };
      if (pesan.jenis === "isi") {
        urut.push(`isi:${pesan.penunjuk}`);
        if (m) m.nilai = String(pesan.nilai);
        return { ok: true };
      }
      return { ok: false };
    },
  });
  // Modul e-Doc sungguhan di konteks yang sama; jaringan ABT ditiru lewat deps di panggilan nanti.
  vm.runInContext(MODUL, k, { filename: "putusan-edoc-sekaligus.js" });
  // Putusan dari ABT dan anonimisasi ditiru pada lapisan modul (yang diuji di berkas uji modul).
  const asli = k.aletaPutusanEdoc.jalankan;
  k.aletaPutusanEdoc.jalankan = (p: Record<string, unknown>) => {
    edocPanggilan.push({ jalankan: { denganPutusan: p.denganPutusan, denganAnonim: p.denganAnonim } });
    return asli({
      ...p,
      deps: {
        putusanDariAbt: async () => ({ ok: true, berkas: new dom.window.File(["{\\rtf1 p}"], "684 - blangko.rtf") }),
        penyamar: async () => ({ ok: true, berkas: new dom.window.File(["{\\rtf1 a}"], "684 - blangko - anonimisasi.rtf"), sisa: [] }),
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
        ...fungsiOpsional("s1BacaUsulanBorangCepat", "s1TungguBerubah", "s1SiapkanAnonimAwal"),
      ].map((nama) => potongFungsi(konten, nama)),
      "this.__uji = { bagianIsiPutusan };",
    ].join("\n"),
    k,
    { filename: "konten.js (potongan)" }
  );
  return { dom, dokumen, k, uji: k.__uji, urut, simpanOpsi, edocPanggilan };
}

const ISI_TIGA = ["isi:#perhum", "isi:#amar", "isi:#amar_anonim"];

/** Panel dengan tangan: Ambil usulan -> Isikan -> tunggu Simpan + e-Doc. */
async function denganTangan(h: ReturnType<typeof pasang>) {
  const kotak = h.uji.bagianIsiPutusan(NOMOR) as HTMLDivElement;
  const ambil = Array.from(kotak.querySelectorAll("button")).find((b) => b.textContent === "Ambil usulan dari ALETA") as HTMLButtonElement;
  ambil.click();
  const terap = await sampai(
    () => Array.from(kotak.querySelectorAll("button")).find((b) => b.textContent === "Isikan yang dicentang") as HTMLButtonElement | undefined,
    "Isikan muncul"
  );
  terap.click();
  await sampai(() => h.urut.includes("kunci:lepas"), "selesai");
  return kotak;
}

describe("satu jalur: tombol otomatis = menekan tombol panel dengan tangan", () => {
  it("urutan langkahnya SAMA persis (kunci -> pilihan + tiga isian -> Simpan -> e-Doc -> lepas kunci)", async () => {
    const tangan = pasang();
    await denganTangan(tangan);

    const oto = pasang();
    const kotak = oto.uji.bagianIsiPutusan(NOMOR) as any;
    expect(typeof kotak.otomatis).toBe("function");
    const hasil = await kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: true, melayang: true });

    expect(hasil.tersimpan).toBe(true);
    expect(oto.urut).toEqual(tangan.urut);
    expect(oto.urut).toEqual([
      "kunci:ambil:10260:putusan-otomatis",
      // Medan pilihan lebih dulu daripada teks panjang (urutan panel).
      'isi:select[name="status_putusan"]',
      ...ISI_TIGA,
      "simpan",
      "edoc:cek",
      "edoc:unggah:putusan+anonim",
      "kunci:lepas",
    ]);
    // Kotak muat ulang melayang di halaman (bukan di dalam panel yang dapat tergambar ulang).
    expect(oto.simpanOpsi[0].wadahLaporan).toBeNull();
  });

  it("hasilnya membawa laporan per langkah dari modul e-Doc yang sama", async () => {
    const h = pasang();
    const kotak = h.uji.bagianIsiPutusan(NOMOR) as any;
    const hasil = await kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: true, melayang: true });
    expect(hasil.ok).toBe(true);
    expect(hasil.edoc.ok).toBe(true);
    expect(hasil.edoc.langkah.map((l: any) => [l.kunci, l.nada])).toEqual([
      ["putusan", "ok"],
      ["anonimisasi", "ok"],
    ]);
  });
});

describe("yang tidak dicentang tidak dikerjakan", () => {
  it("e-Doc tidak dicentang (edoc:false): putusan disimpan, tidak ada langkah e-Doc maupun cek", async () => {
    const h = pasang();
    const kotak = h.uji.bagianIsiPutusan(NOMOR) as any;
    const hasil = await kotak.otomatis({ edoc: false, melayang: true });
    expect(hasil.tersimpan).toBe(true);
    expect(h.urut.filter((x) => x.startsWith("edoc:"))).toEqual([]);
    expect(h.simpanOpsi[0].sesudahTersimpan).toBeUndefined();
  });

  it("hanya e-Doc putusan (anonimisasi tidak dicentang): modul dipanggil dengan denganAnonim:false", async () => {
    const h = pasang();
    const kotak = h.uji.bagianIsiPutusan(NOMOR) as any;
    await kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: false, melayang: true });
    expect(h.edocPanggilan.find((x) => x.jalankan)).toEqual({ jalankan: { denganPutusan: true, denganAnonim: false } });
    expect(h.urut).toContain("edoc:unggah:putusan+-");
  });

  it("e-Doc yang sudah ada di SIPP dilewati: tidak dikirim lagi", async () => {
    const h = pasang({ cekAda: { adaPutusan: true, adaAnonim: true } });
    const kotak = h.uji.bagianIsiPutusan(NOMOR) as any;
    const hasil = await kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: true, melayang: true });
    expect(hasil.tersimpan).toBe(true);
    expect(h.urut.some((x) => x.startsWith("edoc:unggah"))).toBe(false);
    expect(hasil.edoc.langkah.every((l: any) => l.nada === "lewat")).toBe(true);
  });
});

describe("pagar tetap berlaku lewat tombol otomatis", () => {
  it("kunci dipegang pekerjaan lain: tidak mengisi, tidak menyimpan, sebab menyebut pemegangnya", async () => {
    const h = pasang({ kunci: "sibuk" });
    const kotak = h.uji.bagianIsiPutusan(NOMOR) as any;
    const hasil = await kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: true, melayang: true });
    expect(hasil.ok).toBe(false);
    expect(hasil.tahap).toBe("kunci");
    expect(hasil.pesan).toContain("sedang dikerjakan oleh Derry");
    expect(h.urut.some((x) => x.startsWith("isi:") || x === "simpan")).toBe(false);
  });

  it("praperiksa menahan: Simpan TIDAK ditekan dan tidak ada e-Doc", async () => {
    const h = pasang({ hentikan: true });
    const kotak = h.uji.bagianIsiPutusan(NOMOR) as any;
    const hasil = await kotak.otomatis({ edoc: true, denganPutusan: true, denganAnonim: true, melayang: true });
    expect(hasil.ok).toBe(false);
    expect(hasil.tahap).toBe("praperiksa");
    expect(hasil.pesan).toContain("Praperiksa menahan");
    expect(h.urut.some((x) => x === "simpan" || x.startsWith("isi:") || x.startsWith("edoc:"))).toBe(false);
  });

  it("belum ada draf: berhenti di usulan dengan sebabnya", async () => {
    const h = pasang({ tanpaDraf: true });
    const kotak = h.uji.bagianIsiPutusan(NOMOR) as any;
    const hasil = await kotak.otomatis({ edoc: true, melayang: true });
    expect(hasil.ok).toBe(false);
    expect(hasil.tahap).toBe("usulan");
    expect(hasil.pesan).toContain("Belum ada draf putusan");
  });

  it("dua kali berjalan bersamaan: yang kedua ditolak 'sedang berjalan' dan tidak menulis ganda", async () => {
    const h = pasang();
    const kotak = h.uji.bagianIsiPutusan(NOMOR) as any;
    const pertama = kotak.otomatis({ edoc: false, melayang: true });
    const kedua = await kotak.otomatis({ edoc: false, melayang: true });
    expect(kedua.ok).toBe(false);
    expect(kedua.tahap).toBe("sibuk");
    const a = await pertama;
    expect(a.tersimpan).toBe(true);
    expect(h.urut.filter((x) => x === "simpan")).toHaveLength(1);
  });
});
