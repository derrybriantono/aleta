// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PUTUSAN OTOMATIS + e-DOC PUTUSAN + e-DOC ANONIMISASI SEKALI KERJA (20 Okt 2026, agen B2)
 * ============================================================================
 *
 * Keluhan hakim: "waktu saya pakai putusan otomatis masih belum upload sekaligus e-Doc putusan
 * dan e-Doc anonimisasi". Sebabnya: unggah e-Doc sesudah Putusan otomatis hanya hidup bila ada
 * berkas yang dipilih di panel; Putusan otomatis dari draf tidak membawa berkas.
 *
 * Yang dijaga di sini dengan MENJALANKAN kodenya (putusan-edoc-sekaligus.js sungguhan di jsdom,
 * potongan konten.js sungguhan di node:vm), jaringan ditiru:
 *   - urutan: cek e-Doc yang ada -> berkas putusan dari ABT (hak buka diperiksa dulu) ->
 *     anonimisasi -> SATU kiriman unggah (putusan + anonimisasi);
 *   - e-Doc yang sudah ada TIDAK diganti (dilewati dan dilaporkan); cek gagal = tidak mengunggah;
 *   - anonimisasi gagal tidak membatalkan e-Doc putusan, dan sebaliknya Putusan Akhir yang sudah
 *     tersimpan tidak disentuh;
 *   - berkas putusan belum tersedia = sebab jelas + tombol "Ulangi unggah e-Doc saja";
 *   - saklar (bawaan menyala, dapat dimatikan, diingat), hak peran, kunci per perkara;
 *   - laporan per langkah dan muat ulang tetap di perkara lewat modul bersama.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const MODUL = baca("putusan-edoc-sekaligus.js");
const KONTEN = baca("konten.js");

const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Kiriman = { url: string; cara: string; badan?: string };

/** Halaman SIPP tiruan + modul sungguhan; jaringan portal dan ABT ditiru. */
function buka(o: {
  cek?: Record<string, unknown> | "gagal" | "403";
  daftar?: "ada" | "kosong";
  petaLengkap?: boolean;
  hakAbt?: "ok" | "ditolak";
  cetak?: "ok" | "gagal";
  penyamar?: "bersih" | "sisa" | "gagal";
  unggah?: "ok" | "tolakAnonim" | "gagalPutusan";
  anonimAbt?: "ok" | "gagal";
  tanya?: boolean;
  peran?: boolean | null;
  kunci?: "ok" | "sibuk" | "tidakAda";
  simpanan?: Record<string, unknown>;
}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="x"></div></body></html>`, { url: "http://192.168.10.10/SIPP/detil_perkara_agama", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ...(o.simpanan || {}) };
  w.chrome = {
    storage: {
      local: {
        get: async (k: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n in simpanan) hasil[n] = simpanan[n];
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
      },
    },
  };
  const urut: string[] = [];
  const kiriman: Kiriman[] = [];
  const unggahan: Array<{ putusan: string | null; anonimisasi: string | null; samarkanSisa: boolean; tetap: unknown }> = [];
  const cekDefault = { adaBaris: true, adaPutusan: false, adaAnonim: false };
  const jawab = (isi: unknown, status = 200) => {
    const r: any = { ok: status < 300, status, json: async () => polos(isi), clone: () => r };
    return r;
  };
  w.alatAmbil = async (url: string, opsi?: { method?: string; body?: string }) => {
    const u = String(url);
    kiriman.push({ url: u, cara: String(opsi?.method || "GET"), badan: typeof opsi?.body === "string" ? opsi.body : undefined });
    if (u.includes("/unggah-massal/cek")) {
      urut.push("cek");
      if (o.cek === "gagal") throw new Error("Failed to fetch");
      if (o.cek === "403") return jawab({ ok: false, alasan: "Peran Anda tidak diberi hak unggah untuk jenis dokumen ini." }, 403);
      return jawab({ ok: true, data: { ...cekDefault, ...(o.cek || {}) } });
    }
    if (u.includes("/aleta-ecourt/unggah-massal?")) {
      urut.push("daftar");
      if (o.daftar === "kosong") return jawab({ ok: true, data: { putusan: [] } });
      return jawab({
        ok: true,
        data: {
          putusan: [
            { perkaraId: "10260", nomorPerkara: NOMOR, jenisPerkara: "Cerai Gugat", statusPutusan: "Dikabulkan", verstek: true, kumulasi: null, keadaanPutusan: ["verstek"] },
          ],
        },
      });
    }
    if (u.includes("/putusan/anonim-mandiri")) {
      urut.push("penyamar");
      if (o.penyamar === "gagal") return jawab({ ok: false, data: { ok: false, sebab: "penyamar tidak tersedia" } }, 502);
      const rtf = btoa("{\\rtf1 anonim}");
      return jawab({ ok: true, data: { ok: true, rtfBase64: rtf, sisa: o.penyamar === "sisa" ? [{ jenis: "nama pihak", kata: "Muh. Rizal", konteks: "Saksi Muh. Rizal menerangkan" }] : [] } });
    }
    throw new Error(`url tak dikenal: ${u}`);
  };
  w.alatMuatPetaBlangkoLengkap = async () => ({ "cerai gugat": { berkas: "[01] [Kabul Verstek] Cerai.rtf", a: o.petaLengkap === false ? "" : "AAA", b: o.petaLengkap === false ? "" : "BBB", blangko: "Cerai Gugat" } });
  w.alatPetaUntukPerkara = (peta: Record<string, unknown>, jenis: string, status: string, verstek: boolean) => {
    urut.push(`pilih-blangko:${jenis}|${status}|${verstek}`);
    return { baris: peta["cerai gugat"], kunci: "cerai gugat", tingkat: "status" };
  };
  w.alatBlangkoLengkap = (b: { a?: string; b?: string; berkas?: string }) => Boolean(b && b.a && b.b && b.berkas);
  w.alatBlangkoTerpetakan = (b: { berkas?: string }) => Boolean(b && b.berkas);
  w.alatNamaUnduhanBlangko = (nomor: string, berkas: string) => `${nomor.replace(/\//g, "_")} - ${berkas}`;
  w.abtKlienBuat = (opsi: { asal: string }) => {
    expect(opsi.asal).toBe("http://192.168.10.10/aps_badilag/abt");
    return {
      periksaHakBuka: async (p: { a: string; b: string; perkaraId: string }) => {
        urut.push("hak-abt");
        expect(p).toMatchObject({ a: "AAA", b: "BBB", perkaraId: "10260" });
        return o.hakAbt === "ditolak" ? { ok: false, pesan: "Anda bukan pejabat perkara ini" } : { ok: true, diizinkan: true };
      },
      cetak: async () => {
        urut.push("cetak-abt");
        return o.cetak === "gagal" ? { ok: false, pesan: "Sesi ABT habis - masuk ulang." } : { ok: true, rtf: new TextEncoder().encode("{\\rtf1 putusan}").buffer };
      },
    };
  };
  w.a30PerkaraIdUntukAbt = async () => "10260";
  w.alatBolehUnggahPutusanKini = () => (o.peran === undefined ? true : o.peran);
  w.a30Tanya = async () => {
    urut.push("tanya");
    return Boolean(o.tanya);
  };
  w.a30SiapkanAnonimisasi = async (p: { berkas: File }) => {
    urut.push("anonim-abt");
    return o.anonimAbt === "ok" ? { ok: true, berkas: new w.File(["{\\rtf1 anonim-abt}"], "x - anonimisasi.rtf") } : { ok: false, pesan: "ABT tidak menjawab" };
  };
  w.a30UnggahEdoc = async (p: { putusan: File | null; anonimisasi: File | null; samarkanSisa?: boolean; tetapUnggah?: unknown }) => {
    urut.push("unggah");
    unggahan.push({ putusan: p.putusan ? p.putusan.name : null, anonimisasi: p.anonimisasi ? p.anonimisasi.name : null, samarkanSisa: Boolean(p.samarkanSisa), tetap: p.tetapUnggah });
    const berkas: Array<{ jenis: string; ok: boolean; alasan?: string; jalur?: string }> = [];
    if (p.putusan) berkas.push(o.unggah === "gagalPutusan" ? { jenis: "putusan", ok: false, alasan: "berkas_kosong" } : { jenis: "putusan", ok: true, jalur: "Putusan/2026/684.rtf" });
    if (p.anonimisasi) {
      if (o.unggah === "tolakAnonim") return { ok: false, berkas: berkas, anonimDitolak: "Berkas anonimisasi masih memuat nama pihak.", bunyi: "Edoc putusan terunggah; edoc anonimisasi TIDAK diunggah" };
      berkas.push({ jenis: "anonimisasi", ok: true, jalur: "Anonim/2026/684.rtf" });
    }
    return { ok: berkas.every((b) => b.ok), berkas, bunyi: "x" };
  };
  w.pesanGagalUnggah = (b: { alasan?: string }) => `alasan ${b.alasan}`;
  const kunciAmbil: string[] = [];
  const kunciLepas: string[] = [];
  if (o.kunci !== "tidakAda") {
    w.aletaPenetapanKerja = {
      ambilKunci: async (id: number, tujuan: string) => {
        kunciAmbil.push(`${id}:${tujuan}`);
        return o.kunci === "sibuk" ? { ok: false, alasan: "sedang_dikerjakan", oleh: "Derry", tujuan: "kerjakan-penetapan" } : { ok: true, token: "tok1" };
      },
      lepasKunci: async (id: number, token: string) => void kunciLepas.push(`${id}:${token}`),
    };
  }
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(MODUL, ctx, { filename: "putusan-edoc-sekaligus.js" });
  const modul = w.aletaPutusanEdoc;
  const kabar = w.document.createElement("div");
  const wadah = w.document.createElement("div");
  return { w, modul, urut, kiriman, unggahan, kunciAmbil, kunciLepas, simpanan, kabar, wadah };
}

const jalankan = (h: ReturnType<typeof buka>, tambahan: Record<string, unknown> = {}) =>
  h.modul.jalankan({ nomorPerkara: NOMOR, kabar: h.kabar, wadah: h.wadah, ...tambahan }) as Promise<{ ok: boolean; bunyi: string; langkah: Array<{ kunci: string; judul: string; teks: string; nada: string }>; perluBerkas?: boolean }>;
const langkahDari = (hasil: Awaited<ReturnType<typeof jalankan>>, kunci: string) => hasil.langkah.find((l) => l.kunci === kunci)!;

// ============================================================================
describe("urutan: cek -> berkas putusan dari ABT -> anonimisasi -> SATU kiriman", () => {
  it("putusan tersimpan, tanpa berkas pilihan: e-Doc putusan dan anonimisasi terunggah sekaligus, dilaporkan per langkah", async () => {
    const h = buka({});
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(true);
    expect(h.urut).toEqual([
      "cek",
      "daftar",
      "pilih-blangko:Cerai Gugat|Dikabulkan|true",
      "hak-abt",
      "cetak-abt",
      "penyamar",
      "unggah",
    ]);
    expect(h.unggahan).toHaveLength(1);
    expect(h.unggahan[0].putusan).toBe("684_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai.rtf");
    expect(h.unggahan[0].anonimisasi).toBe("684_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai - anonimisasi.rtf");
    expect(h.unggahan[0].samarkanSisa).toBe(true);
    expect(hasil.langkah.map((l) => [l.kunci, l.nada])).toEqual([
      ["putusan", "ok"],
      ["anonimisasi", "ok"],
    ]);
    expect(langkahDari(hasil, "putusan").teks).toContain("terunggah");
  });

  it("tidak satu pun nama berkas memuat kata ALETA", async () => {
    const h = buka({});
    await jalankan(h);
    const nama = [h.unggahan[0].putusan, h.unggahan[0].anonimisasi].join(" ");
    expect(nama).not.toMatch(/aleta/i);
    expect(h.modul.bersihNama("684 - Aleta putusan ALETA.rtf")).toBe("684 - putusan.rtf");
  });

  it("berkas putusan pilihan petugas dipakai apa adanya: ABT tidak ditanya", async () => {
    const h = buka({});
    const pilihan = new h.w.File(["{\\rtf1 pilihan}"], "684 putusan.rtf");
    const hasil = await jalankan(h, { putusan: pilihan });
    expect(hasil.ok).toBe(true);
    expect(h.urut).not.toContain("cetak-abt");
    expect(h.urut).not.toContain("hak-abt");
    expect(h.unggahan[0].putusan).toBe("684 putusan.rtf");
  });

  it("hanya e-Doc anonimisasi yang dicentang (putusan sudah ada di SIPP): putusan tidak ikut dikirim", async () => {
    const h = buka({ cek: { adaPutusan: true, jalurPutusan: "Putusan/2026/684.rtf" } });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(true);
    expect(h.unggahan[0].putusan).toBeNull();
    expect(h.unggahan[0].anonimisasi).toContain("anonimisasi");
    expect(langkahDari(hasil, "putusan")).toMatchObject({ nada: "lewat" });
    expect(langkahDari(hasil, "putusan").teks).toContain("sudah ada di SIPP");
    expect(langkahDari(hasil, "anonimisasi").nada).toBe("ok");
  });

  it("langkah putusan tidak dicentang (denganPutusan:false): hanya anonimisasi dikerjakan", async () => {
    const h = buka({});
    const hasil = await jalankan(h, { denganPutusan: false });
    expect(h.unggahan[0].putusan).toBeNull();
    expect(hasil.langkah.map((l) => l.kunci)).toEqual(["anonimisasi"]);
  });
});

describe("yang sudah ada di SIPP tidak diganti", () => {
  it("keduanya sudah ada: dilewati, tidak ada yang dicetak, disamarkan, atau dikirim", async () => {
    const h = buka({ cek: { adaPutusan: true, adaAnonim: true } });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(true);
    expect(h.urut).toEqual(["cek"]);
    expect(h.unggahan).toHaveLength(0);
    expect(hasil.langkah.every((l) => l.nada === "lewat" && /sudah ada di SIPP.*tidak diganti/.test(l.teks))).toBe(true);
  });

  it("cek gagal terbaca: TIDAK mengunggah apa pun (tidak menimpa), dengan sebab", async () => {
    const h = buka({ cek: "gagal" });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(false);
    expect(h.unggahan).toHaveLength(0);
    expect(h.urut).toEqual(["cek"]);
    expect(langkahDari(hasil, "putusan").teks).toContain("tidak ada yang diunggah supaya tidak menimpa");
  });

  it("cek ditolak 403 (peran): disebut, tidak ada unggahan", async () => {
    const h = buka({ cek: "403" });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(false);
    expect(h.unggahan).toHaveLength(0);
    expect(langkahDari(hasil, "putusan").teks).toContain("hak unggah");
  });

  it("Putusan Akhir belum terbaca di SIPP: e-Doc belum diunggah, disebut", async () => {
    const h = buka({ cek: { adaBaris: false } });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(false);
    expect(h.unggahan).toHaveLength(0);
    expect(langkahDari(hasil, "putusan").teks).toContain("Putusan Akhir belum terbaca");
  });
});

describe("kegagalan tidak saling membatalkan", () => {
  it("penyamar gagal, ABT juga gagal: e-Doc putusan TETAP diunggah, anonimisasi dilaporkan tidak diunggah beserta sebab", async () => {
    const h = buka({ penyamar: "gagal", anonimAbt: "gagal" });
    const hasil = await jalankan(h);
    expect(h.urut.slice(-3)).toEqual(["penyamar", "anonim-abt", "unggah"]);
    expect(h.unggahan[0].putusan).toBeTruthy();
    expect(h.unggahan[0].anonimisasi).toBeNull();
    expect(hasil.ok).toBe(false);
    expect(langkahDari(hasil, "putusan").nada).toBe("ok");
    expect(langkahDari(hasil, "anonimisasi")).toMatchObject({ nada: "salah" });
    expect(langkahDari(hasil, "anonimisasi").teks).toContain("ABT tidak menjawab");
  });

  it("penyamar gagal, anonimisasi ABT berhasil: keduanya terunggah", async () => {
    const h = buka({ penyamar: "gagal", anonimAbt: "ok" });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(true);
    expect(h.unggahan[0].anonimisasi).toContain("anonimisasi");
  });

  it("anonimisasi masih memuat data pribadi dan petugas menolak: putusan tetap diunggah, anonimisasi tidak", async () => {
    const h = buka({ penyamar: "sisa", tanya: false });
    const hasil = await jalankan(h);
    expect(h.urut).toContain("tanya");
    expect(h.unggahan[0].anonimisasi).toBeNull();
    expect(langkahDari(hasil, "putusan").nada).toBe("ok");
    expect(langkahDari(hasil, "anonimisasi").teks).toContain("masih memuat 1 data pribadi");
  });

  it("anonimisasi masih memuat data pribadi dan petugas menyetujui: nama yang dilihat diteruskan sebagai 'tetap unggah'", async () => {
    const h = buka({ penyamar: "sisa", tanya: true });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(true);
    expect(h.unggahan[0].tetap).toEqual({ nama: ["Muh. Rizal"] });
  });

  it("penolakan rute atas anonimisasi (409): putusan masuk, anonimisasi dilaporkan ditolak beserta sebab dari rute", async () => {
    const h = buka({ unggah: "tolakAnonim" });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(false);
    expect(langkahDari(hasil, "putusan").nada).toBe("ok");
    expect(langkahDari(hasil, "anonimisasi").teks).toContain("Berkas anonimisasi masih memuat nama pihak");
  });

  it("e-Doc putusan ditolak rute: dilaporkan gagal beserta sebabnya, anonimisasi tetap tercatat", async () => {
    const h = buka({ unggah: "gagalPutusan" });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(false);
    expect(langkahDari(hasil, "putusan")).toMatchObject({ nada: "salah" });
    expect(langkahDari(hasil, "putusan").teks).toContain("alasan berkas_kosong");
    expect(langkahDari(hasil, "anonimisasi").nada).toBe("ok");
  });
});

describe("berkas putusan belum tersedia: sebab jelas + ulangi unggah saja", () => {
  const kasus: Array<[string, Parameters<typeof buka>[0], string]> = [
    ["token blangko belum tercatat di peramban", { petaLengkap: false }, "belum tercatat tokennya"],
    ["ABT menolak membuka blangko (bukan pejabat perkara)", { hakAbt: "ditolak" }, "Anda bukan pejabat perkara ini"],
    ["sesi ABT habis saat dicetak", { cetak: "gagal" }, "Sesi ABT habis"],
    ["perkara tidak ada di daftar putusan", { daftar: "kosong" }, "tidak ada di daftar putusan"],
  ];
  for (const [nama, opsi, sebab] of kasus) {
    it(`${nama}: tidak ada yang diunggah, perluBerkas menyala, sebabnya terbaca`, async () => {
      const h = buka(opsi);
      const hasil = await jalankan(h);
      expect(hasil.ok).toBe(false);
      expect(hasil.perluBerkas).toBe(true);
      expect(h.unggahan).toHaveLength(0);
      expect(langkahDari(hasil, "putusan").teks).toContain("berkas putusan belum tersedia");
      expect(langkahDari(hasil, "putusan").teks).toContain(sebab);
      expect(langkahDari(hasil, "anonimisasi").teks).toContain("tidak dikerjakan");
    });
  }

  it("tombol 'Ulangi unggah e-Doc saja' mengulang hanya langkah e-Doc, lalu hilang bila beres", async () => {
    const h = buka({ cetak: "gagal" });
    let panggilan = 0;
    const induk = h.w.document.createElement("div");
    h.w.document.body.appendChild(induk);
    let akhir: { ok: boolean } | null = null;
    h.modul.pasangUlang({
      induk,
      ulangi: async () => {
        panggilan += 1;
        return { ok: panggilan > 1, bunyi: "x", langkah: [] };
      },
      sesudah: (hasil: { ok: boolean }) => void (akhir = hasil),
    });
    const tombol = induk.querySelector("[data-b2-ulangi]") as HTMLButtonElement;
    expect(tombol.textContent).toBe("Ulangi unggah e-Doc saja");
    tombol.click();
    await tunggu(5);
    expect(panggilan).toBe(1);
    expect(akhir).toMatchObject({ ok: false });
    expect(induk.querySelector("[data-b2-ulangi]")).toBeTruthy();
    (induk.querySelector("[data-b2-ulangi]") as HTMLButtonElement).click();
    await tunggu(5);
    expect(panggilan).toBe(2);
    expect(induk.querySelector("[data-b2-ulangi]")).toBeNull();
  });

  it("mengulang sesudah perbaikan: kiriman kedua berjalan penuh dan e-Doc yang masuk di percobaan pertama tidak dikirim lagi", async () => {
    // Percobaan 1: putusan masuk, anonimisasi gagal. Percobaan 2: e-Doc putusan sudah ada -> dilewati, anonimisasi menyusul.
    const h1 = buka({ penyamar: "gagal", anonimAbt: "gagal" });
    const a = await jalankan(h1);
    expect(a.ok).toBe(false);
    const h2 = buka({ cek: { adaPutusan: true }, penyamar: "bersih" });
    const b = await jalankan(h2);
    expect(b.ok).toBe(true);
    expect(h2.unggahan[0].putusan).toBeNull();
    expect(h2.unggahan[0].anonimisasi).toBeTruthy();
  });
});

describe("hak peran dan kunci per perkara", () => {
  it("peran yang bukan Hakim/Admin/Super Admin: dilewati tanpa satu pun permintaan", async () => {
    const h = buka({ peran: false });
    const hasil = await jalankan(h);
    expect(hasil.ok).toBe(true);
    expect(h.kiriman).toHaveLength(0);
    expect(hasil.langkah.every((l) => l.nada === "lewat" && l.teks.includes("tidak berhak"))).toBe(true);
  });

  it("kunci dipegang pekerjaan lain (sedang_dikerjakan): ok:false dengan nama pemegang; tanpa kunci modul penetapan: jalan terus", async () => {
    const sibuk = buka({ kunci: "sibuk" });
    const k = await sibuk.modul.ambilKunci(NOMOR, "10260");
    expect(k.ok).toBe(false);
    expect(k.pesan).toContain("sedang dikerjakan oleh Derry");
    const bebas = buka({ kunci: "tidakAda" });
    const k2 = await bebas.modul.ambilKunci(NOMOR, "10260");
    expect(k2.ok).toBe(true);
  });

  it("kunci yang sama dengan penetapan: diambil per perkara_id dengan tujuan putusan-otomatis dan dilepas dengan token yang sama", async () => {
    const h = buka({});
    const k = await h.modul.ambilKunci(NOMOR, "10260");
    expect(k.ok).toBe(true);
    expect(h.kunciAmbil).toEqual(["10260:putusan-otomatis"]);
    await k.lepas();
    expect(h.kunciLepas).toEqual(["10260:tok1"]);
  });
});

describe("saklar: bawaan menyala, dapat dimatikan, diingat", () => {
  it("bawaan tercentang; dilepas -> tidak dipakai dan tersimpan; dimuat lagi -> tetap mati", async () => {
    const h = buka({});
    const s = h.modul.barisSaklar();
    expect(s.centang.checked).toBe(true);
    expect(s.dipakai()).toBe(true);
    s.centang.checked = false;
    s.centang.dispatchEvent(new h.w.Event("change"));
    expect(s.dipakai()).toBe(false);
    expect(h.simpanan[h.modul.KUNCI_SAKLAR]).toBe(false);
    const lagi = buka({ simpanan: { [h.modul.KUNCI_SAKLAR]: false } });
    const s2 = lagi.modul.barisSaklar();
    await tunggu(5);
    expect(s2.centang.checked).toBe(false);
    expect(s2.dipakai()).toBe(false);
  });

  it("disembunyikan saat berkas dipilih di panel: tidak dipakai walau tercentang", () => {
    const h = buka({});
    const s = h.modul.barisSaklar();
    s.tampilkan(false);
    expect(s.dipakai()).toBe(false);
    expect(s.baris.style.display).toBe("none");
    s.tampilkan(true);
    expect(s.dipakai()).toBe(true);
  });
});

// ============================================================================
function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const i = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (i < 0) throw new Error(`fungsi ${nama} tidak ditemukan`);
  let j = i;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(i, j + 1).join("\n");
}

describe("a30UnggahEdoc: putusan boleh kosong dan hasilnya membawa langkah per berkas", () => {
  function muat(jawaban: unknown, adaModul: boolean) {
    const kiriman: Array<{ kunci: string[] }> = [];
    const alatAmbil = async (_u: string, opsi: { body: FormData }) => {
      kiriman.push({ kunci: [...opsi.body.keys()] });
      return new Response(JSON.stringify(jawaban), { status: 200, headers: { "content-type": "application/json" } });
    };
    const sumber = ["kirimBadanUnggahSipp", "kirimUnggahSippTetap", "a30UnggahEdoc", "sambungSebab"].map((n) => potongFungsi(KONTEN, n)).join("\n\n");
    const modul = {
      langkahDariUnggah: (x: { ok: boolean }, kirim: { putusan: boolean; anonimisasi: boolean }) => [{ kunci: "uji", ok: x.ok, kirim }],
    };
    const fn = new Function(
      "alatAmbil",
      "ALETA_API_UNGGAH_SIPP",
      "BATAS_UNGGAH_SIPP_MS",
      "perkaraIdDariHalaman",
      "namaPenggunaSipp",
      "pesanGagalUnggah",
      "alatPesanGagal",
      "alatCatat",
      "a30Tanya",
      "a30HapusNaskahEdoc",
      "globalThis",
      `${sumber}\nreturn a30UnggahEdoc;`
    )(
      alatAmbil,
      "/aleta/api/aleta-ecourt/putusan/unggah-sipp",
      1000,
      () => "4242",
      () => "hakim1",
      () => "gagal",
      () => "status",
      () => undefined,
      async () => false,
      async () => undefined,
      adaModul ? { aletaPutusanEdoc: modul } : {}
    ) as (p: Record<string, unknown>) => Promise<{ ok: boolean; langkah?: Array<{ kirim: unknown }> }>;
    return { fn, kiriman };
  }
  const MASUK = { ok: true, data: { ok: true, berkas: [{ jenis: "anonimisasi", ok: true }] } };

  it("tanpa putusan: hanya anonimisasi dikirim, dan samarkanSisa ikut bila diminta", async () => {
    const { fn, kiriman } = muat(MASUK, true);
    const anonim = new File(["{\\rtf1 a}"], "a - anonimisasi.rtf");
    const h = await fn({ nomorPerkara: NOMOR, putusan: null, anonimisasi: anonim, samarkanSisa: true });
    expect(kiriman[0].kunci).toEqual(["perkaraId", "nomorPerkara", "olehUsername", "anonimisasi", "samarkanSisa"]);
    expect(h.ok).toBe(true);
    expect(h.langkah![0].kirim).toEqual({ putusan: false, anonimisasi: true });
  });

  it("tanpa modul laporan: hasil persis semula (tanpa langkah)", async () => {
    const { fn } = muat(MASUK, false);
    const h = await fn({ nomorPerkara: NOMOR, putusan: new File(["x"], "p.rtf"), anonimisasi: null });
    expect(h.langkah).toBeUndefined();
  });
});

// ============================================================================
describe("simpanPutusanLaluBuka: laporan per langkah dan muat ulang tetap di perkara", () => {
  function muatSimpan(edoc: { ok: boolean; bunyi: string; langkah?: unknown[] }, o: { lanjutWalauEdocGagal?: boolean; tanpaModulMuatUlang?: boolean } = {}) {
    const dipanggil: Array<{ nama: string; arg?: any }> = [];
    const jam: Array<{ fn: () => void; ms: number }> = [];
    const pendengar = new Set<(e: { source: unknown; data: unknown }) => void>();
    const w: Record<string, unknown> = {
      addEventListener: (n: string, f: (e: { source: unknown; data: unknown }) => void) => n === "message" && pendengar.add(f),
      removeEventListener: (n: string, f: (e: { source: unknown; data: unknown }) => void) => void pendengar.delete(f),
    };
    let baca = 0;
    const k: Record<string, unknown> = {
      window: w,
      // Muat ulang lama (900/1500/2500 ms) hanya dicatat; selebihnya (tunggu bukti, jajak) berjalan nyata.
      setTimeout: (fn: () => void, ms: number) => {
        jam.push({ fn, ms });
        return [900, 1500, 2500].includes(ms) ? jam.length : setTimeout(fn, Math.min(ms, 5));
      },
      clearTimeout: (x: number) => clearTimeout(x),
      bacaPutusanSegar: async () => (baca++ === 0 ? { sudahPutus: false, tanggal: "", status: "" } : { sudahPutus: true, tanggal: "2026-10-20", status: "Dikabulkan" }),
      kirimKeJembatan: async (pesan: { bukti?: { id: string } }) => {
        const id = pesan.bukti && pesan.bukti.id;
        setTimeout(() => {
          for (const f of [...pendengar]) f({ source: w, data: { sumber: "aleta-jembatan-jawab", id, jenis: "bukti-simpan", asal: "uji", st: 1, pesan: "Data Berhasil Disimpan" } });
        }, 0);
        return { ok: true, bukti: "terkirim" };
      },
      muatUlangHalamanPerkara: () => void dipanggil.push({ nama: "muatUlangHalamanPerkara" }),
      ...(o.tanpaModulMuatUlang ? {} : { muatUlangSesudahTulis: (arg: unknown) => (dipanggil.push({ nama: "muatUlangSesudahTulis", arg }), { otomatis: !(arg as any).baris.some((b: any) => b.ok === false) }) }),
    };
    vm.createContext(k);
    const potong = [
      "samaPutusan",
      "dengarBuktiSimpan",
      "tekanSimpanPutusan",
      "bunyiSimpanTidakDitekan",
      "simpanPutusanLaluBuka",
      "sambungSebab",
      "b2LaporkanEdoc",
    ].map((n) => potongFungsi(KONTEN, n));
    const tetapan = KONTEN.split("\n")
      .filter((b) => /^const (PENUNJUK_SIMPAN_PUTUSAN|BATAS_JAWABAN_SIMPAN_MS) = /.test(b) || /^let nomorBuktiSimpan = /.test(b))
      .join("\n");
    const penunjuk = KONTEN.slice(KONTEN.indexOf("const PENUNJUK_SIMPAN_PUTUSAN = ["), KONTEN.indexOf("];", KONTEN.indexOf("const PENUNJUK_SIMPAN_PUTUSAN = [")) + 2);
    vm.runInContext([penunjuk, tetapan.replace(/^const PENUNJUK_SIMPAN_PUTUSAN = .*$/m, ""), ...potong, "this.simpan = simpanPutusanLaluBuka;"].join("\n"), k);
    const jalankan = async () => {
      const kabar = { textContent: "" };
      const hasil = await (k.simpan as any)("684/Pdt.G/2026/PA.Dgl", kabar, {
        jajakCepat: true,
        ...(o.lanjutWalauEdocGagal ? { lanjutWalauEdocGagal: true } : {}),
        sesudahTersimpan: async () => {
          dipanggil.push({ nama: "edoc" });
          return edoc;
        },
      });
      return { hasil, kabar };
    };
    return { jalankan, dipanggil, jam };
  }

  const SEMUA_OK = [
    { kunci: "putusan", judul: "e-Doc putusan", teks: "terunggah", nada: "ok" },
    { kunci: "anonimisasi", judul: "e-Doc anonimisasi", teks: "terunggah", nada: "ok" },
  ];

  it("urutan: Simpan terbukti -> e-Doc -> ringkasan + muat ulang bersama (tanpa muat ulang lama 900 ms)", async () => {
    const s = muatSimpan({ ok: true, bunyi: "Edoc putusan dan edoc anonimisasi terunggah.", langkah: SEMUA_OK });
    const { hasil } = await s.jalankan();
    expect(hasil.ok).toBe(true);
    expect(s.dipanggil.map((x) => x.nama)).toEqual(["edoc", "muatUlangSesudahTulis"]);
    const arg = s.dipanggil[1].arg;
    expect(arg.nomor).toBe("684/Pdt.G/2026/PA.Dgl");
    expect(arg.baris.map((b: any) => [b.jenis, b.ok])).toEqual([
      ["Putusan Akhir", true],
      ["e-Doc putusan", true],
      ["e-Doc anonimisasi", true],
    ]);
    expect(s.jam.filter((x) => x.ms === 900)).toHaveLength(0);
  });

  it("anonimisasi gagal: Putusan Akhir tetap tersimpan (ok:true), laporan memuat yang gagal, hasil e-Doc ok:false, tidak dimuat ulang sendiri", async () => {
    const s = muatSimpan({
      ok: false,
      bunyi: "x",
      langkah: [SEMUA_OK[0], { kunci: "anonimisasi", judul: "e-Doc anonimisasi", teks: "tidak diunggah - ABT tidak menjawab", nada: "salah" }],
    });
    const { hasil } = await s.jalankan();
    expect(hasil.ok).toBe(true);
    expect(hasil.edoc).toMatchObject({ ok: false });
    const arg = s.dipanggil.find((x) => x.nama === "muatUlangSesudahTulis")!.arg;
    expect(arg.judulGagal).toContain("belum selesai seluruhnya");
    expect(arg.baris.find((b: any) => b.jenis === "e-Doc anonimisasi")).toMatchObject({ ok: false });
    expect(s.dipanggil.some((x) => x.nama === "muatUlangHalamanPerkara")).toBe(false);
  });

  it("hasil e-Doc tanpa rincian langkah: jalur lama (muat ulang 900 ms) tidak berubah", async () => {
    const s = muatSimpan({ ok: true, bunyi: "Edoc putusan terunggah." });
    const { hasil } = await s.jalankan();
    expect(hasil.ok).toBe(true);
    expect(s.dipanggil.some((x) => x.nama === "muatUlangSesudahTulis")).toBe(false);
    expect(s.jam.some((x) => x.ms === 900)).toBe(true);
  });

  it("antrean massal (lanjutWalauEdocGagal): jalur lama, tidak memakai kotak muat ulang bersama", async () => {
    const s = muatSimpan({ ok: true, bunyi: "x", langkah: SEMUA_OK }, { lanjutWalauEdocGagal: true });
    await s.jalankan();
    expect(s.dipanggil.some((x) => x.nama === "muatUlangSesudahTulis")).toBe(false);
    expect(s.jam.some((x) => x.ms === 900)).toBe(true);
  });

  it("modul muat ulang bersama tidak ada: jatuh ke jalur lama", async () => {
    const s = muatSimpan({ ok: true, bunyi: "x", langkah: SEMUA_OK }, { tanpaModulMuatUlang: true });
    const { hasil } = await s.jalankan();
    expect(hasil.ok).toBe(true);
    expect(s.jam.some((x) => x.ms === 900)).toBe(true);
  });
});

describe("terpasang di ekstensi", () => {
  it("manifest memuat abt-klien.js dan putusan-edoc-sekaligus.js di blok SIPP, dan skrip penyusun ikut menanamnya", () => {
    const manifest = JSON.parse(readFileSync(path.join(AKAR, "manifest.json"), "utf8"));
    const sipp = manifest.content_scripts.find((c: { matches: string[] }) => c.matches.some((m) => m.includes("/SIPP/")) && c.js.includes("konten.js"));
    expect(sipp.js).toEqual(expect.arrayContaining(["abt-klien.js", "putusan-edoc-sekaligus.js"]));
    expect(sipp.js.indexOf("putusan-edoc-sekaligus.js")).toBeGreaterThan(sipp.js.indexOf("konten.js"));
    const susun = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"putusan-edoc-sekaligus.js"');
  });

  it("Putusan otomatis tanpa berkas memakai alur ABT, hanya sesudah Simpan terbukti, dengan saklar", () => {
    const bagian = KONTEN.slice(KONTEN.indexOf("function bagianIsiPutusan("), KONTEN.indexOf("function bagianBacaBorang("));
    expect(bagian).toContain("globalThis.aletaPutusanEdoc.barisSaklar()");
    expect(bagian).toContain("sekaligusAbt.dipakai()");
    expect(bagian).toContain("opsiSimpanA30.sesudahTersimpan = (kabarLangkah) =>");
    // Berkas yang dipilih petugas menang: baris ABT disembunyikan.
    expect(bagian).toContain("sekaligusAbt.tampilkan(!(sekaligus && sekaligus.ada()))");
    // Tidak ada penulisan ke SIPP dari modul baru selain lewat unggah-sipp.
    expect(MODUL).not.toMatch(/method:\s*"(PUT|DELETE|PATCH)"/);
    expect(MODUL).toContain("a30UnggahEdoc");
  });
});
