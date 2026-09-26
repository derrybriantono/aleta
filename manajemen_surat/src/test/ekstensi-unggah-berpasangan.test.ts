// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PUTUSAN DAN ANONIMISASI DARI SATU PEMILIH - DUA KIRIMAN BERURUTAN, TANPA JEDA
 * ============================================================================
 *
 * Yang dijalankan di sini fungsi SUNGGUHAN dari konten.js (dipotong, bukan
 * disalin) di node:vm dengan DOM jsdom dan jam tiruan. Yang dijaga:
 *
 *   - satu pemilih multi-berkas; berkas dipasangkan menurut nomor perkara dan
 *     slot (putusan / anonimisasi); perkara lain, BAS, dan bentuk asing
 *     ditolak beserta sebabnya; dua calon untuk satu slot menunggu petugas;
 *   - putusan dikirim lebih dahulu, anonimisasi LANGSUNG sesudah jawaban atas
 *     putusannya tiba - tidak sebelum, dan tanpa pewaktu apa pun di antaranya;
 *   - putusan yang gagal membuat anonimisasinya TIDAK dikirim;
 *   - tidak ada antrean tunda: chrome.storage tidak disentuh sama sekali.
 *
 * Keputusan orkestrator 25 September 2026: ALETA tidak membuat jeda yang
 * gunanya membuat kerja otomatis tampak seperti kerja manusia. Uji jeda
 * "putusan-ke-anonim" yang sempat ditulis untuk itu sudah dihapus bersama
 * kodenya.
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
 */

const BERKAS_KONTEN = process.env.ALETA_UJI_KONTEN || path.resolve(process.cwd(), "../ekstensi-sipp/konten.js");
const konten = () => readFileSync(BERKAS_KONTEN, "utf8").replace(/\r\n/g, "\n");

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

/** Tetapan puncak - satu baris, atau sampai "};" / "];" di kolom nol. */
function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => b.startsWith(`const ${nama} = `));
  if (mulai < 0) throw new Error(`tetapan ${nama} tidak ketemu`);
  if (baris[mulai].trimEnd().endsWith(";")) return baris[mulai];
  let j = mulai;
  while (j < baris.length && baris[j] !== "};" && baris[j] !== "];") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

/**
 * Jam tiruan. Pewaktu yang dipasang KODE KONTEN dicatat terpisah dari latensi
 * jawaban tiruan, supaya "tanpa pewaktu di antara dua kiriman" dapat diukur.
 */
function buatJam(mulai = Date.UTC(2026, 8, 25, 2, 0, 0)) {
  let kini = mulai;
  let urut = 0;
  const antre = new Map<number, { t: number; f: () => void }>();
  const pewaktuKonten: Array<{ pada: number; ms: number }> = [];
  const jadwal = (f: () => void, ms: number) => {
    urut += 1;
    antre.set(urut, { t: kini + Math.max(0, Number(ms) || 0), f });
    return urut;
  };
  const jam = {
    get kini() {
      return kini;
    },
    pewaktuKonten,
    jadwal,
    Date: class extends Date {
      constructor(...a: unknown[]) {
        if (a.length === 0) super(kini);
        else super(...(a as [string]));
      }
      static now() {
        return kini;
      }
    },
    setTimeout: (f: () => void, ms?: number) => {
      pewaktuKonten.push({ pada: kini, ms: Number(ms) || 0 });
      return jadwal(f, Number(ms) || 0);
    },
    clearTimeout: (id: number) => void antre.delete(id),
    async redam() {
      for (let i = 0; i < 40; i += 1) await new Promise((r) => setImmediate(r));
    },
    /** Menjalankan pewaktu berurutan sampai syarat terpenuhi, atau sampai jam mencapai batasMs dari sekarang. */
    async jalankan(syarat: () => boolean, batasMs = 600_000) {
      const akhir = kini + batasMs;
      for (;;) {
        await jam.redam();
        if (syarat()) return true;
        let pilih: [number, { t: number; f: () => void }] | null = null;
        for (const e of antre) if (!pilih || e[1].t < pilih[1].t) pilih = e;
        if (!pilih || pilih[1].t > akhir) {
          kini = Math.max(kini, akhir);
          return syarat();
        }
        antre.delete(pilih[0]);
        kini = Math.max(kini, pilih[1].t);
        pilih[1].f();
      }
    },
  };
  return jam;
}

const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

type Jawab = {
  ok: boolean;
  sebab?: string;
  antrean?: boolean;
  berkas?: Array<{ jenis: string; ok: boolean; jalur?: string; alasan?: string; pesan?: string }>;
};

function muatUnggah() {
  const isi = konten();
  const dom = new JSDOM(
    "<!doctype html><html><body><div>Selamat Datang <font>petugas.satu</font></div></body></html>"
  );
  halaman.push(dom);
  const jam = buatJam();
  const sentuhanPenyimpanan: string[] = [];
  const muatUlang: number[] = [];
  const permintaan: Array<{ t: number; badan: FormData }> = [];
  /** Kapan tiap jawaban tiba (jam tiruan). */
  const jawabTiba: number[] = [];
  let jawabBerikut: (jenis: string) => Jawab = (jenis) => ({
    ok: true,
    antrean: jenis === "putusan",
    berkas: [{ jenis, ok: true, jalur: `resources/file/${jenis}/2026/09/berkas.rtf` }],
  });
  let latensi: (jenis: string) => number = () => 0;
  const catatPenyimpanan = (nama: string) => async () => {
    sentuhanPenyimpanan.push(nama);
    return {};
  };
  const k: Record<string, unknown> = {
    document: dom.window.document,
    // Tidak ada antrean tunda: sentuhan apa pun ke penyimpanan ekstensi tercatat.
    chrome: {
      storage: {
        local: { get: catatPenyimpanan("local.get"), set: catatPenyimpanan("local.set"), remove: catatPenyimpanan("local.remove") },
        session: { get: catatPenyimpanan("session.get"), set: catatPenyimpanan("session.set") },
      },
    },
    setTimeout: jam.setTimeout,
    clearTimeout: jam.clearTimeout,
    Date: jam.Date,
    FormData,
    File,
    alatPesanGagal: (_g: unknown, status: number, apa: string) => `${apa} gagal: ALETA menjawab ${status}.`,
    alatAmbil: async (_alamat: string, opsiAmbil: { body: FormData }) => {
      permintaan.push({ t: jam.kini, badan: opsiAmbil.body });
      const jenis = opsiAmbil.body.has("putusan") ? "putusan" : "anonimisasi";
      const lama = latensi(jenis);
      if (lama > 0) await new Promise((r) => jam.jadwal(r as () => void, lama));
      jawabTiba.push(jam.kini);
      const jawab = jawabBerikut(jenis);
      return { ok: true, status: 200, json: async () => ({ data: jawab }) };
    },
    muatUlangHalamanPerkara: () => void muatUlang.push(jam.kini),
    bagian: (judul: string) => {
      const kotak = dom.window.document.createElement("div") as unknown as HTMLDivElement & { isi: HTMLDivElement };
      kotak.appendChild(dom.window.document.createElement("h3")).textContent = judul;
      kotak.isi = dom.window.document.createElement("div");
      kotak.appendChild(kotak.isi);
      return kotak;
    },
  };
  vm.createContext(k);
  vm.runInContext(
    [
      tetapan(isi, "POLA_PERKARA"),
      tetapan(isi, "ALETA_API_UNGGAH_SIPP"),
      tetapan(isi, "BATAS_UNGGAH_SIPP_MS"),
      tetapan(isi, "PESAN_GAGAL_UNGGAH"),
      ...[
        "buatElemen",
        "perkaraIdDariHalaman",
        "namaPenggunaSipp",
        "pesanGagalUnggah",
        "namaBerkasAnonim",
        "nomorDariNamaBerkas",
        "tandaBukanNaskahPutusan",
        "pasangkanBerkasUnggah",
        "kirimBadanUnggahSipp",
        "unggahBerpasangan",
        "bagianUnggahPutusanSipp",
      ].map((nama) => potongFungsi(isi, nama)),
      "this.__uji = { pasangkanBerkasUnggah, unggahBerpasangan, bagianUnggahPutusanSipp, BATAS_UNGGAH_SIPP_MS };",
    ].join("\n"),
    k,
    { filename: "konten.js (potongan)" }
  );
  const uji = k.__uji as {
    pasangkanBerkasUnggah: (daftar: File[], nomor: string) => { putusan: any[]; anonimisasi: any[]; ditolak: any[] };
    unggahBerpasangan: (pasangan: unknown, alat: unknown) => Promise<{ adaYangMasuk: boolean; gagal: string }>;
    bagianUnggahPutusanSipp: (nomor: string) => HTMLDivElement;
    BATAS_UNGGAH_SIPP_MS: number;
  };
  return {
    dom,
    jam,
    uji,
    muatUlang,
    permintaan,
    jawabTiba,
    sentuhanPenyimpanan,
    aturJawab: (f: (jenis: string) => Jawab) => void (jawabBerikut = f),
    aturLatensi: (f: (jenis: string) => number) => void (latensi = f),
  };
}
type Uji = ReturnType<typeof muatUnggah>;

const NOMOR = "1/Pdt.G/2026/PA.Dgl";
const berkas = (nama: string, isi = "{\\rtf1 naskah}") => new File([isi], nama, { type: "application/rtf" });
const jenisKiriman = (u: Uji) => u.permintaan.map((p) => (p.badan.has("putusan") ? "putusan" : "anonimisasi"));

/** Panel SUNGGUHAN, berkas dipilih lewat satu pemilih, lalu "Unggah ke SIPP" ditekan. */
function panelDenganBerkas(u: Uji, daftar: File[]) {
  const panel = u.uji.bagianUnggahPutusanSipp(NOMOR);
  u.dom.window.document.body.appendChild(panel);
  const pemilih = panel.querySelector("input[type=file]") as HTMLInputElement;
  Object.defineProperty(pemilih, "files", { value: daftar });
  pemilih.dispatchEvent(new u.dom.window.Event("change"));
  const tombol = Array.from(panel.querySelectorAll("button")).find((b) => b.textContent === "Unggah ke SIPP") as HTMLButtonElement;
  const kabar = panel.querySelector(".aleta-abt-kabar") as HTMLElement;
  return { panel, pemilih, tombol, kabar };
}

const PASANGAN = () => [
  berkas("PA.Dgl_2026_Pdt.G_1_putusan_akhir.rtf"),
  berkas("PA.Dgl_2026_Pdt.G_1_putusan_anonimisasi.rtf"),
];

// ===========================================================================
describe("satu pemilih: dipasangkan menurut nomor dan slot", () => {
  it("putusan dan anonimisasi dikenali dari namanya; perkara lain, BAS, dan bentuk asing ditolak", () => {
    const u = muatUnggah();
    const hasil = u.uji.pasangkanBerkasUnggah(
      [
        berkas("PA.Dgl_2026_Pdt.G_1_putusan_akhir.rtf"),
        berkas("PA.Dgl_2026_Pdt.G_1_putusan_anonimisasi.rtf"),
        berkas("2_Pdt.G_2026_PA.Dgl - [01] Kabul.rtf"),
        berkas("1_Pdt.G_2026_PA.Dgl - [02] BAS 1 P & T Hadir.rtf"),
        berkas("pindaian.jpg"),
      ],
      NOMOR
    );
    expect(hasil.putusan.map((c) => c.nama)).toEqual(["PA.Dgl_2026_Pdt.G_1_putusan_akhir.rtf"]);
    expect(hasil.anonimisasi.map((c) => c.nama)).toEqual(["PA.Dgl_2026_Pdt.G_1_putusan_anonimisasi.rtf"]);
    expect(hasil.ditolak.map((c) => c.sebab)).toEqual([
      "berkas perkara lain (2/Pdt.G/2026/PA.Dgl)",
      "berita acara sidang (BAS)",
      "bukan naskah putusan yang dapat diunggah - yang diterima RTF, DOC, DOCX, atau PDF",
    ]);
  });

  it("panel SUNGGUHAN: satu pemilih multi-berkas, dan yang ditolak tampak beserta sebabnya", () => {
    const u = muatUnggah();
    const { panel, pemilih, tombol } = panelDenganBerkas(u, [...PASANGAN(), berkas("2_Pdt.G_2026_PA.Dgl - [01] Kabul.rtf")]);
    expect(pemilih.multiple).toBe(true);
    expect(panel.querySelectorAll("input[type=file]")).toHaveLength(1);
    expect(panel.textContent).toContain("berkas perkara lain (2/Pdt.G/2026/PA.Dgl) - tidak dikirim");
    expect(tombol.disabled).toBe(false);
  });

  it("dua calon untuk satu slot: tidak ada yang dikirim sampai petugas memilih", async () => {
    const u = muatUnggah();
    const { panel, tombol } = panelDenganBerkas(u, [
      berkas("1_Pdt.G_2026_PA.Dgl - [01] Kabul.rtf"),
      berkas("1_Pdt.G_2026_PA.Dgl - [03] Menolak.rtf"),
    ]);
    expect(tombol.disabled).toBe(true);
    tombol.click();
    await u.jam.redam();
    expect(u.permintaan).toHaveLength(0);
    const pilih = panel.querySelector("select") as HTMLSelectElement;
    expect(Array.from(pilih.options).map((o) => o.textContent)).toEqual([
      "2 berkas - pilih satu",
      "1_Pdt.G_2026_PA.Dgl - [01] Kabul.rtf",
      "1_Pdt.G_2026_PA.Dgl - [03] Menolak.rtf",
    ]);
    pilih.value = "1";
    pilih.dispatchEvent(new u.dom.window.Event("change"));
    expect(tombol.disabled).toBe(false);
    tombol.click();
    await u.jam.jalankan(() => u.muatUlang.length > 0);
    expect(u.permintaan).toHaveLength(1);
    expect((u.permintaan[0].badan.get("putusan") as File).name).toBe("1_Pdt.G_2026_PA.Dgl - [03] Menolak.rtf");
  });
});

// ===========================================================================
describe("putusan lebih dahulu, anonimisasi LANGSUNG sesudah jawabannya - tanpa jeda", () => {
  it("dua permintaan, satu berkas masing-masing, akun SIPP yang membuka halaman tercatat", async () => {
    const u = muatUnggah();
    const { tombol, kabar } = panelDenganBerkas(u, PASANGAN());
    tombol.click();
    await u.jam.jalankan(() => u.muatUlang.length > 0);
    expect(jenisKiriman(u)).toEqual(["putusan", "anonimisasi"]);
    const [p, a] = u.permintaan;
    expect(p.badan.has("anonimisasi")).toBe(false);
    expect(a.badan.has("putusan")).toBe(false);
    expect(p.badan.get("olehUsername")).toBe("petugas.satu");
    expect(a.badan.get("nomorPerkara")).toBe(NOMOR);
    expect(kabar.textContent).toContain(
      "Putusan akhir terunggah, dan perkara ini masuk antrean Direktori Putusan. Anonimisasi terunggah."
    );
    // Halaman dibuka kembali SESUDAH anonimisasinya, tidak di antaranya.
    expect(u.muatUlang[0]).toBeGreaterThanOrEqual(a.t);
  });

  it("anonimisasi dikirim TEPAT saat jawaban putusan tiba: tidak sebelum, tidak ada pewaktu di antaranya", async () => {
    for (const lamaPutusan of [0, 1_200, 7_000, 45_000]) {
      const u = muatUnggah();
      u.aturLatensi((jenis) => (jenis === "putusan" ? lamaPutusan : 3_000));
      const { tombol } = panelDenganBerkas(u, PASANGAN());
      tombol.click();
      // Sebelum jawaban putusan tiba, anonimisasi BELUM dikirim.
      if (lamaPutusan > 0) {
        await u.jam.jalankan(() => false, lamaPutusan - 1);
        expect(jenisKiriman(u), `latensi ${lamaPutusan}`).toEqual(["putusan"]);
      }
      await u.jam.jalankan(() => u.muatUlang.length > 0);
      expect(jenisKiriman(u)).toEqual(["putusan", "anonimisasi"]);
      // Selisihnya tepat lama jawaban putusan - 0 ms tambahan.
      expect(u.permintaan[1].t - u.permintaan[0].t, `latensi ${lamaPutusan}`).toBe(lamaPutusan);
      expect(u.permintaan[1].t).toBe(u.jawabTiba[0]);
      // Satu-satunya pewaktu yang dipasang kode konten: pembukaan kembali
      // halaman sesudah KEDUA kiriman tuntas.
      expect(u.jam.pewaktuKonten.map((x) => x.ms)).toEqual([1500]);
      expect(u.jam.pewaktuKonten[0].pada).toBe(u.jawabTiba[1]);
    }
  });

  it("tanpa antrean tunda: penyimpanan ekstensi tidak disentuh sama sekali", async () => {
    const u = muatUnggah();
    const { tombol } = panelDenganBerkas(u, PASANGAN());
    tombol.click();
    await u.jam.jalankan(() => u.muatUlang.length > 0);
    expect(u.sentuhanPenyimpanan).toEqual([]);
  });

  it("putusan GAGAL: anonimisasinya tidak dikirim sama sekali, dan halaman tidak dimuat ulang", async () => {
    const u = muatUnggah();
    u.aturJawab((jenis) =>
      jenis === "putusan" ? { ok: false, sebab: "Nomor perkara tidak ditemukan di SIPP." } : { ok: true, berkas: [] }
    );
    const { tombol, kabar } = panelDenganBerkas(u, PASANGAN());
    tombol.click();
    await u.jam.jalankan(() => tombol.disabled === false && u.permintaan.length > 0, 60_000);
    await u.jam.jalankan(() => false, 10_000);
    expect(jenisKiriman(u)).toEqual(["putusan"]);
    expect(kabar.textContent).toBe(
      "Putusan akhir: Nomor perkara tidak ditemukan di SIPP. Anonimisasi TIDAK dikirim - pilih ulang sesudah putusannya masuk."
    );
    expect(u.muatUlang).toEqual([]);
  });

  it("putusan masuk, anonimisasi DITOLAK: sebabnya terbaca, dan halaman tidak dimuat ulang menghapusnya", async () => {
    const u = muatUnggah();
    u.aturJawab((jenis) =>
      jenis === "putusan"
        ? { ok: true, berkas: [{ jenis, ok: true, jalur: "resources/file/doc/2026/09/p.rtf" }] }
        : { ok: true, berkas: [{ jenis, ok: false, alasan: "bentuk_tidak_dikenali" }] }
    );
    const { panel, tombol, kabar } = panelDenganBerkas(u, PASANGAN());
    tombol.click();
    await u.jam.jalankan(() => tombol.disabled === false && u.permintaan.length === 2, 60_000);
    await u.jam.jalankan(() => false, 10_000);
    expect(jenisKiriman(u)).toEqual(["putusan", "anonimisasi"]);
    expect(kabar.className).toContain("aleta-abt-gagal");
    expect(kabar.textContent).toMatch(/^Putusan akhir terunggah\. Anonimisasi: Isi berkasnya bukan naskah putusan/);
    // Tiap berkas dilaporkan sendiri: yang masuk tetap tercatat masuk.
    expect(panel.textContent).toContain("resources/file/doc/2026/09/p.rtf");
    expect(u.muatUlang).toEqual([]);
  });

  it("anonimisasi saja (putusannya sudah masuk sebelumnya): dikirim seketika, satu permintaan", async () => {
    const u = muatUnggah();
    u.aturJawab((jenis) => ({ ok: true, antrean: true, berkas: [{ jenis, ok: true, jalur: "resources/file/anonimisasi/a.rtf" }] }));
    const { tombol, kabar } = panelDenganBerkas(u, [berkas("PA.Dgl_2026_Pdt.G_1_putusan_anonimisasi.rtf")]);
    const mulai = u.jam.kini;
    tombol.click();
    await u.jam.jalankan(() => u.muatUlang.length > 0);
    expect(jenisKiriman(u)).toEqual(["anonimisasi"]);
    expect(u.permintaan[0].t).toBe(mulai);
    expect(kabar.textContent).toContain("Anonimisasi terunggah, dan perkara ini masuk antrean Direktori Putusan.");
  });

  it("batas waktu satu kiriman 150 detik (K6: bot 90 < gerbang 120 < ekstensi 150)", () => {
    expect(muatUnggah().uji.BATAS_UNGGAH_SIPP_MS).toBe(150_000);
  });
});
