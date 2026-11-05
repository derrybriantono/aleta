// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * ISIAN SIPP (Putusan Otomatis) - CENTANG "UBAH JADI PDF SALINAN" (5 Nov 2026)
 * ============================================================================
 *
 * putusan-sipp.js dijalankan SUNGGUHAN di jsdom bersama panel-alat.js (metode salinan bersama: alatMintaPdf, alatMintaSalinanDariPdf,
 * alatTerbitkanSalinan) dan penjaga-tanda.js; portal dan pekerja latar ditiru. Yang dijaga:
 *
 *   - centang mati (bawaan) = TIDAK ADA permintaan salinan/unduhan apa pun, dan langkah SIPP berjalan seperti biasa;
 *   - centang hidup = berkas putusan yang dipilih dikirim ke metode salinan (RTF -> rute PDF salinan; DOCX/DOC lewat RTF hasil konversi;
 *     PDF -> rute salinan-dari-pdf) dan PDF langsung diunduh lewat pekerja latar (tanpa tab) dengan nama baku;
 *   - berdiri sendiri: gagal salinan tidak membatalkan isi form/unggah e-Doc, gagal unggah tidak membatalkan salinan;
 *   - tanpa berkas: pesan jelas, tombol mati bila hanya salinan; berkas anonimisasi tidak pernah menjadi dasar;
 *   - tidak ada yang ditulis ke SIPP dari salinan; tidak ada kata Aleta pada nama berkas dan RTF yang dikirim.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const PENJAGA = baca("penjaga-tanda.js");
const PUSIPP = baca("putusan-sipp.js");
const PASANGAN = baca("putusan-terjadwal-pasangan.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
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
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  salinanTolak?: string;
  pdfTolak?: string;
  unduhGagal?: boolean;
  otomatis?: (opsi: Record<string, unknown>) => Promise<Record<string, unknown>>;
  adaPutusan?: boolean;
  adaAnonim?: boolean;
  terisi?: boolean;
};

const RTF_RAW = "{\\rtf1\\ansi{\\info{\\title Putusan ALETA rekaan}}\\pard Putusan rekaan nomor satu\\par}";
const RTF_HASIL_DOCX = "{\\rtf1\\ansi\\pard Hasil ubahan dari docx\\par}";
const PDF_RAW = "%PDF-1.4 putusan kosong rekaan";
const DOCX_RAW = "PK\u0003\u0004 isi docx rekaan";

function buka(o: Opsi = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><table width="100%" id="submenus"><tr><td><table><tr>` +
      `<td id="backlist"><a href="/index.php/perkara">Kembali</a></td><td><a href="#">Penetapan Majelis Hakim</a></td></tr></table></td></tr></table></div></body></html>`,
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true };
  const latar: Array<Record<string, unknown>> = [];
  const minta: Array<{ url: string; badan: any }> = [];
  w.chrome = {
    runtime: {
      id: "uji",
      getManifest: () => ({ version: "1.205.77" }),
      getURL: (x: string) => x,
      sendMessage: (pesan: Record<string, unknown>, cb?: (h: unknown) => void) => {
        latar.push(JSON.parse(JSON.stringify(pesan)));
        if (!cb) return;
        if (o.unduhGagal && pesan.jenis === "unduh") return cb({ ok: false, pesan: "diblokir peramban" });
        cb({ ok: true, id: 1 });
      },
      lastError: undefined,
    },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  w.fetch = async (alamat: string, opsi?: { body?: unknown }) => {
    const url = String(alamat);
    let badan: any = null;
    try {
      badan = typeof opsi?.body === "string" ? JSON.parse(opsi.body) : null;
    } catch {
      badan = null;
    }
    minta.push({ url, badan });
    if (url.includes("/putusan/salinan-dari-pdf")) {
      if (o.pdfTolak) return json({ ok: true, data: { available: false, kode: "tanpa_teks", message: o.pdfTolak } });
      return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from("%PDF-1.4 salinan dari pdf").toString("base64"), byte: 25, salinan: { jenis: "putusan-pdf", ttdDitambah: 3, ttdSudahAda: 0, namaPanitera: "PP Satu", gambarTtdPanitera: true, alasanTanpaGambar: "" } } });
    }
    if (url.includes("/aleta-bot/abt/pdf")) {
      if (o.salinanTolak) return json({ ok: true, data: { available: false, message: o.salinanTolak } });
      return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from("%PDF-1.4 salinan dari rtf").toString("base64"), byte: 25, salinan: { namaPanitera: "PP Satu", gambarTtdPanitera: true, ttdDitambah: 3, ttdSudahAda: 0 } } });
    }
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  vm.runInContext(PENJAGA, ctx, { filename: "penjaga-tanda.js" });

  const urut: string[] = [];
  const opsiOto: Array<Record<string, unknown>> = [];
  const bagianAda = { nilai: false };
  Object.assign(w, {
    penggunaTerakhir: { nama: "Derry Briantono", peran: "Hakim" },
    boleh: () => true,
    cariNomorPerkara: () => NOMOR,
    b6KeadaanPutusanTerisi: async () => (o.terisi ? { terisi: true, tanggal: "2026-10-19", status: "Dikabulkan" } : { terisi: false }),
    b6RincianPutusan: () => "",
    cekDrafPutusanAleta: async () => ({ ada: true, versi: "1" }),
    a30PerkaraIdUntukAbt: async () => "10260",
    muatUlangSesudahTulis: () => ({ otomatis: true }),
    s1BukaBlangkoPutusan: async () => ({ ok: true, lewat: "tambah" }),
    gambarUlangSesudahBlangko: async () => {
      if (!bagianAda.nilai) {
        bagianAda.nilai = true;
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
    a30KonversiNaskah: async (berkas: { name: string }) => ({
      ok: true,
      berkas: new w.File([RTF_HASIL_DOCX], String(berkas.name).replace(/\.[A-Za-z]+$/, ".rtf")),
      peringatan: [],
    }),
    aletaPutusanEdoc: {
      cekSlot: async () => ({ ok: true, adaBaris: true, adaPutusan: Boolean(o.adaPutusan), adaAnonim: Boolean(o.adaAnonim) }),
      ambilKunci: async () => ({ ok: true, lepas: async () => undefined }),
      jalankan: async (p: Record<string, unknown>) => {
        urut.push("edoc");
        opsiOto.push({ edocSaja: true, denganPutusan: p.denganPutusan, denganAnonim: p.denganAnonim });
        return { ok: true, bunyi: "x", langkah: [{ kunci: "putusan", judul: "e-Doc putusan", teks: "terunggah", nada: "ok" }, { kunci: "anonimisasi", judul: "e-Doc anonimisasi", teks: "terunggah", nada: "ok" }] };
      },
    },
  });
  vm.runInContext(PASANGAN, ctx, { filename: "putusan-terjadwal-pasangan.js" });
  vm.runInContext(PUSIPP, ctx, { filename: "putusan-sipp.js" });
  return { w, d: w.document as Document, latar, minta, urut, opsiOto };
}
type Halaman = ReturnType<typeof buka>;

const api = (h: Halaman) => h.w.aletaPutusanSipp;
const panel = (h: Halaman) => h.d.getElementById("aleta-pusipp-panel") as HTMLElement | null;
const cek = (h: Halaman, j: string) => panel(h)!.querySelector(`[data-pusipp-cek="${j}"]`) as HTMLInputElement;
const utama = (h: Halaman) => panel(h)!.querySelector('[data-pusipp="utama"]') as HTMLButtonElement;
const barisSalinan = (h: Halaman) => panel(h)!.querySelector('[data-pusipp-salinan="baris"]') as HTMLElement;
const statusSalinan = (h: Halaman) => String(barisSalinan(h).querySelector("[data-pusipp-status]")?.getAttribute("data-pusipp-status") || "");
const unduhan = (h: Halaman) => h.latar.filter((m) => m.jenis === "unduh");
const tampil = (h: Halaman) => h.latar.filter((m) => m.jenis === "tampilkan-pdf");
const dataLatin1 = (alamat: unknown) => Buffer.from(String(alamat).split(",")[1], "base64").toString("latin1");
const permintaanSalinan = (h: Halaman) => h.minta.filter((m) => /\/aleta-bot\/abt\/pdf|\/putusan\/salinan-dari-pdf/.test(m.url));

async function bukaPanel(h: Halaman) {
  await sampai(() => (api(h).pasang(h.d), h.d.querySelector(".aleta-pusipp-tombol")), "tombol");
  (h.d.querySelector(".aleta-pusipp-tombol") as HTMLElement).click();
  await sampai(() => api(h).keadaan() && api(h).keadaan().dibaca, "keadaan terbaca");
  await sampai(() => panel(h) && !panel(h)!.hidden, "panel terbuka");
}
async function pilihBerkas(h: Halaman, nama: string, isi: string) {
  await api(h).terimaBerkas([new h.w.File([Uint8Array.from(Buffer.from(isi, "latin1"))], nama)]);
  await sampai(() => api(h).berkasSiap(), "berkas siap");
}
/** Mencentang salinan saja (tiga langkah SIPP dimatikan). */
function hanyaSalinan(h: Halaman) {
  for (const j of ["isi", "putusan", "anonim"]) if (cek(h, j).checked) cek(h, j).click();
  cek(h, "salinan").click();
}
const NAMA_UNDUH = (stem: string) => `684_Pdt.G_2026_PA.Dgl - ${stem} - SALINAN.pdf`;

describe("centang 'Ubah jadi PDF salinan': tampilan dan bawaan", () => {
  it("ada di menu bersama tiga centang lain, teks sesuai, bawaan MATI, tidak ikut 'Centang semua langkah'", async () => {
    const h = buka();
    await bukaPanel(h);
    expect(cek(h, "salinan")).not.toBeNull();
    expect(cek(h, "salinan").checked).toBe(false);
    expect(barisSalinan(h).textContent).toContain("Ubah jadi PDF salinan");
    expect(barisSalinan(h).textContent).toContain("Tidak diunggah ke SIPP");
    expect(statusSalinan(h)).toBe("tidak");
    expect((panel(h)!.querySelector("[data-pusipp='semua']") as HTMLInputElement).checked).toBe(true); // tiga langkah SIPP tetap semua tercentang
    expect(panel(h)!.querySelectorAll("[data-pusipp-langkah]")).toHaveLength(3); // tiga langkah lama utuh
  });
});

describe("centang mati: tidak ada permintaan apa pun untuk salinan", () => {
  it("memilih berkas dan menjalankan langkah SIPP tanpa centang salinan = nol permintaan PDF dan nol unduhan", async () => {
    const h = buka();
    await bukaPanel(h);
    await pilihBerkas(h, "Putusan Rekaan.rtf", RTF_RAW);
    utama(h).click();
    await sampai(() => h.urut.includes("otomatis") && api(h).keadaan().sibuk === false, "langkah SIPP selesai");
    expect(permintaanSalinan(h)).toEqual([]);
    expect(unduhan(h)).toEqual([]);
    expect(h.minta.filter((m) => !/\//.test("x"))).toBeDefined();
    expect(statusSalinan(h)).toBe("tidak");
  });
});

describe("centang hidup: metode salinan dipanggil dengan berkas unggahan dan hasilnya langsung terunduh", () => {
  it("RTF: dikirim apa adanya ke rute PDF salinan (jejak sistem dibuang), diunduh langsung tanpa tab, nama baku, tidak ada tulisan ke SIPP", async () => {
    const h = buka();
    await bukaPanel(h);
    await pilihBerkas(h, "Putusan Rekaan.rtf", RTF_RAW);
    hanyaSalinan(h);
    expect(utama(h).disabled).toBe(false);
    utama(h).click();
    await sampai(() => statusSalinan(h) === "unduh", "salinan diunduh");
    const k = permintaanSalinan(h);
    expect(k).toHaveLength(1);
    expect(k[0].url).toContain("/aleta-bot/abt/pdf");
    expect(k[0].badan.salinan).toBe(true);
    const terkirim = Buffer.from(k[0].badan.rtfBase64, "base64").toString("latin1");
    expect(terkirim).toContain("Putusan rekaan nomor satu");
    expect(terkirim).not.toMatch(/aleta/i); // properti info yang menyebut sistem dibuang sebelum dikirim
    expect(unduhan(h).map((m) => m.nama)).toEqual([NAMA_UNDUH("Putusan Rekaan")]);
    expect(dataLatin1(unduhan(h)[0].alamat)).toBe("%PDF-1.4 salinan dari rtf");
    expect(tampil(h)).toEqual([]); // tidak membuka tab bila unduh berhasil
    expect(h.urut).toEqual([]); // tidak ada langkah SIPP: isi form dan e-Doc tidak disentuh
    expect(h.minta.map((m) => m.url).filter((u) => !u.includes("/ekstensi/tampilan"))).toEqual(["/aleta/api/aleta-bot/abt/pdf"]); // tidak ada permintaan lain (apalagi ke SIPP)
    expect(barisSalinan(h).textContent).toContain("PDF SALINAN diunduh");
    expect(panel(h)!.querySelector(".aleta-pusipp-ringkas")!.textContent).toContain("PDF salinan");
  });

  it("DOCX: yang dikirim adalah RTF hasil konversi jalur yang ada; DOC lama sama", async () => {
    const h = buka();
    await bukaPanel(h);
    await pilihBerkas(h, "Putusan Word.docx", DOCX_RAW);
    hanyaSalinan(h);
    utama(h).click();
    await sampai(() => statusSalinan(h) === "unduh", "salinan diunduh");
    expect(Buffer.from(permintaanSalinan(h)[0].badan.rtfBase64, "base64").toString("latin1")).toBe(RTF_HASIL_DOCX);
    expect(unduhan(h).map((m) => m.nama)).toEqual([NAMA_UNDUH("Putusan Word")]);
  });

  it("PDF yang masih kosong: dikirim ke rute salinan-dari-pdf (bukan rute RTF), diunduh langsung", async () => {
    const h = buka();
    await bukaPanel(h);
    await pilihBerkas(h, "Putusan Kosong.pdf", PDF_RAW);
    hanyaSalinan(h);
    expect(barisSalinan(h).textContent).toContain("tulisan SALINAN, ttd, dan blok Untuk Salinan ditambahkan");
    utama(h).click();
    await sampai(() => statusSalinan(h) === "unduh", "salinan diunduh");
    const k = permintaanSalinan(h);
    expect(k).toHaveLength(1);
    expect(k[0].url).toContain("/putusan/salinan-dari-pdf");
    expect(Buffer.from(k[0].badan.pdfBase64, "base64").toString("latin1")).toBe(PDF_RAW);
    expect(dataLatin1(unduhan(h)[0].alamat)).toBe("%PDF-1.4 salinan dari pdf");
    expect(unduhan(h)[0].nama).toBe(NAMA_UNDUH("Putusan Kosong"));
  });

  it("PDF yang ditolak server (sudah salinan / pindaian): pesan server tampil apa adanya, tidak ada unduhan", async () => {
    const h = buka({ pdfTolak: "PDF ini tidak memiliki lapisan teks (kemungkinan hasil pindaian), jadi salinan tidak dibuat." });
    await bukaPanel(h);
    await pilihBerkas(h, "Pindaian.pdf", PDF_RAW);
    hanyaSalinan(h);
    utama(h).click();
    await sampai(() => statusSalinan(h) === "gagal", "salinan gagal");
    expect(barisSalinan(h).textContent).toContain("tidak memiliki lapisan teks");
    expect(unduhan(h)).toEqual([]);
  });

  it("nama berkas yang memuat kata Aleta tidak ikut ke nama unduhan", async () => {
    const h = buka();
    await bukaPanel(h);
    await pilihBerkas(h, "Putusan Aleta 684.rtf", RTF_RAW);
    hanyaSalinan(h);
    utama(h).click();
    await sampai(() => statusSalinan(h) === "unduh", "salinan diunduh");
    const nama = String(unduhan(h)[0].nama);
    expect(nama).not.toMatch(/aleta/i);
    expect(nama).toBe(NAMA_UNDUH("Putusan 684"));
  });

  it("unduhan langsung diblokir -> cadangan tab penampil dengan pesan yang menyebutnya (bukan diam-diam)", async () => {
    const h = buka({ unduhGagal: true });
    await bukaPanel(h);
    await pilihBerkas(h, "Putusan Rekaan.rtf", RTF_RAW);
    hanyaSalinan(h);
    utama(h).click();
    await sampai(() => statusSalinan(h) === "unduh", "salinan terbit");
    expect(tampil(h)).toHaveLength(1);
    expect(barisSalinan(h).textContent).toContain("dibuka di tab baru");
  });
});

describe("berdiri sendiri: tidak menahan dan tidak ditahan langkah SIPP", () => {
  it("salinan gagal di server -> isi form dan e-Doc tetap berjalan dan tercatat; baris salinan gagal dengan sebabnya", async () => {
    const h = buka({ salinanTolak: "Pengubah PDF belum terpasang di server." });
    await bukaPanel(h);
    await pilihBerkas(h, "Putusan Rekaan.rtf", RTF_RAW);
    cek(h, "salinan").click();
    utama(h).click();
    await sampai(() => api(h).keadaan().sibuk === false && statusSalinan(h) === "gagal", "selesai");
    expect(h.urut).toContain("otomatis");
    expect(h.opsiOto[0]).toMatchObject({ edoc: true, denganPutusan: true, denganAnonim: true });
    expect(panel(h)!.querySelector('[data-pusipp-langkah="isi"] [data-pusipp-status]')!.getAttribute("data-pusipp-status")).toBe("ok");
    expect(barisSalinan(h).textContent).toContain("Pengubah PDF belum terpasang di server");
    expect(unduhan(h)).toEqual([]);
  });

  it("unggah/isi gagal -> salinan tetap dibuat dan diunduh selama berkasnya ada", async () => {
    const h = buka({ otomatis: async () => ({ ok: false, tersimpan: false, pesan: "praperiksa menahan" }) });
    await bukaPanel(h);
    await pilihBerkas(h, "Putusan Rekaan.rtf", RTF_RAW);
    cek(h, "salinan").click();
    utama(h).click();
    await sampai(() => api(h).keadaan().sibuk === false, "selesai");
    expect(panel(h)!.querySelector('[data-pusipp-langkah="isi"] [data-pusipp-status]')!.getAttribute("data-pusipp-status")).toBe("gagal");
    expect(statusSalinan(h)).toBe("unduh");
    expect(unduhan(h).map((m) => m.nama)).toEqual([NAMA_UNDUH("Putusan Rekaan")]);
  });

  it("langkah e-Doc saja (putusan sudah terisi) + salinan: keduanya berjalan, dan hasil salinan bertahan sesudah keadaan SIPP dibaca ulang", async () => {
    const h = buka({ terisi: true });
    await bukaPanel(h);
    await pilihBerkas(h, "Putusan Rekaan.rtf", RTF_RAW);
    cek(h, "salinan").click();
    utama(h).click();
    await sampai(() => api(h).keadaan().sibuk === false && h.urut.includes("edoc"), "selesai");
    await tunggu(80);
    expect(statusSalinan(h)).toBe("unduh");
    expect(unduhan(h)).toHaveLength(1);
  });
});

describe("tanpa berkas putusan", () => {
  it("hanya salinan dicentang tanpa berkas: tombol mati dan pesan jelas; tanpa permintaan", async () => {
    const h = buka();
    await bukaPanel(h);
    hanyaSalinan(h);
    expect(utama(h).disabled).toBe(true);
    expect(barisSalinan(h).textContent).toContain("Seret berkas putusan");
    expect(panel(h)!.querySelector(".aleta-pusipp-ringkas")!.textContent).toContain("Pilih berkas putusan lebih dulu");
    expect(permintaanSalinan(h)).toEqual([]);
  });

  it("langkah lain tercentang + salinan tanpa berkas: langkah SIPP jalan, salinan 'perlu berkas' tanpa permintaan", async () => {
    const h = buka();
    await bukaPanel(h);
    cek(h, "salinan").click();
    utama(h).click();
    await sampai(() => api(h).keadaan().sibuk === false && h.urut.includes("otomatis"), "selesai");
    expect(statusSalinan(h)).toBe("perlu");
    expect(permintaanSalinan(h)).toEqual([]);
    expect(unduhan(h)).toEqual([]);
  });
});

describe("penjaga", () => {
  it("tidak ada kata Aleta pada tulisan yang dihasilkan fitur ini ke berkas/PDF, dan tidak ada jalur tulis SIPP baru", () => {
    const sumber = PUSIPP;
    const bagian = sumber.slice(sumber.indexOf("PDF salinan (5 Nov 2026) - centang tambahan"), sumber.indexOf("// Membaca keadaan SIPP"));
    expect(bagian.length).toBeGreaterThan(1000);
    expect(bagian).not.toMatch(/fetch\(|FormData|unggah-sipp|\.append\(/);
    expect(bagian).toContain("/a[\\s._-]*l[\\s._-]*e[\\s._-]*t[\\s._-]*a/gi");
  });
});
