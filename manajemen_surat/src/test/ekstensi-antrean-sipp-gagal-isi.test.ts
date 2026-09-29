// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * ANTREAN PUTUSAN MASSAL SIPP: MEDAN YANG GAGAL TERISI MENAHAN SIMPAN
 * ============================================================================
 *
 * Yang dijalankan di sini fungsi SUNGGUHAN, dipotong (bukan disalin) dari
 * konten.js - jalankanSatuAntreanSipp, kirimKeJembatan, bagianAntreanSipp,
 * ringkasHentikan, buatElemen - dan dari panel-alat.js - alatBuatAntrean,
 * alatAntreanRingkas, alatAntreanBerikutnya - di node:vm dengan DOM jsdom.
 * Yang ditiru hanya tepi luarnya: jembatan ke halaman SIPP
 * (kirimKeJembatanLangsung), draf ALETA, praperiksa, penyimpanan ekstensi,
 * dan simpanPutusanLaluBuka. Yang terakhir DIHITUNG, sebab memanggilnya
 * berarti menekan Simpan SIPP.
 *
 * Yang dijaga:
 *   - satu medan saja yang gagal terisi -> Simpan TIDAK ditekan, perkaranya
 *     tertahan dengan sebab "gagal-isi", catatannya menyebut medan dan alasan
 *     jembatan, dan kegagalannya masuk kotak hitam;
 *   - semua medan terisi -> Simpan ditekan TEPAT sekali;
 *   - medan yang drafnya memang kosong bukan kegagalan (perkara cabut hanya
 *     punya satu bagian naskah) - pagarnya tidak boleh menahan yang sah;
 *   - perkara yang tertahan tidak diisi ulang sendiri pada mode otomatis;
 *   - ringkasan antrean memisahkan "ditahan praperiksa" dari "tertahan
 *     karena medan gagal terisi". Sampai 26 September 2026 keduanya terhitung
 *     praperiksa.
 *
 * Kenapa berkas ini ada: penjaga teks yang lama (putusan-status-lain,
 * praperiksa-putusan, ekstensi-putusan-massal) tetap hijau walau blok
 * penahannya dibuang seluruhnya - teks yang mereka tuntut ada di tempat lain.
 * Pemeriksa membuktikannya pada 26 September 2026.
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const BERKAS_KONTEN = process.env.ALETA_UJI_KONTEN || path.join(EKSTENSI, "konten.js");
const baca = (berkas: string) => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

/** Tetapan puncak - satu baris, atau sampai "};" di kolom nol. */
function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => b.startsWith(`const ${nama} = `));
  if (mulai < 0) throw new Error(`tetapan ${nama} tidak ketemu`);
  if (baris[mulai].trimEnd().endsWith(";")) return baris[mulai];
  let j = mulai;
  while (j < baris.length && baris[j] !== "};") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

type Butir = { nomor: string; keadaan: string; catatan: string; sebabTahan?: string };
type Antrean = { tahap: string; modus: string; posisi: number; butir: Butir[] };
type Draf = { ada: boolean; pertimbangan?: string; amar?: string; amarAnonim?: string; sebab?: string };
type Rapor = {
  hentikan: boolean;
  jumlah: { perhatian: number };
  temuan: Array<{ tingkat: string; judul: string }>;
};
type Kabar = HTMLDivElement;

const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

const drafUtuh = (): Draf => ({
  ada: true,
  pertimbangan: "<p>Menimbang, bahwa xxx.</p>",
  amar: "<p>1. Mengabulkan gugatan Penggugat;</p>",
  amarAnonim: "<p>1. Mengabulkan gugatan Penggugat;</p>",
});

const RAPOR_LOLOS: Rapor = { hentikan: false, jumlah: { perhatian: 0 }, temuan: [] };

function muatAntrean() {
  const konten = baca(BERKAS_KONTEN);
  const alat = baca(path.join(EKSTENSI, "panel-alat.js"));
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  halaman.push(dom);
  const dokumen = dom.window.document;

  // Tepi luar yang dapat diatur tiap uji.
  let gagalkan: Record<string, string> = {};
  let draf: (nomor: string) => Draf = drafUtuh;
  let praperiksa: (nomor: string) => Rapor = () => RAPOR_LOLOS;

  /** chrome.storage.local tiruan: yang tersimpan SALINAN, seperti aslinya. */
  let tersimpan: string | null = null;
  const jembatan: Array<{ jenis: string; penunjuk: string }> = [];
  const kotakHitam: Array<{ jenis: string; ringkas: string }> = [];
  const simpanDitekan: string[] = [];
  const pewaktu: number[] = [];

  const k: Record<string, unknown> = {
    document: dokumen,
    encodeURIComponent,
    // Pewaktu yang dipasang kode konten dicatat, TIDAK dijalankan: mode
    // otomatis yang memasangnya berarti mengisi perkara itu sendiri.
    setTimeout: (_f: () => void, ms?: number) => {
      pewaktu.push(Number(ms) || 0);
      return pewaktu.length;
    },
    alatMuatAntrean: async () => (tersimpan ? JSON.parse(tersimpan) : null),
    alatSimpanAntrean: async (a: Antrean | null) => {
      tersimpan = a ? JSON.stringify(a) : null;
      return true;
    },
    // Penulis tanpa kunci yang dipakai baca-ubah-tulis per butir
    // (alatUbahButirAntrean) - penyimpanan tiruan yang sama.
    alatTulisAntreanLangsung: async (a: Antrean | null) => {
      tersimpan = a ? JSON.stringify(a) : null;
      return true;
    },
    alatCatat: (jenis: string, ringkas: string) => void kotakHitam.push({ jenis, ringkas }),
    alatCatatTindakan: () => undefined,
    alatKeringNyala: () => false,
    alatPesanGagal: (_g: unknown, status: number, apa: string) => `${apa} gagal: ALETA menjawab ${status}.`,
    alatAmbil: async (alamat: string) => {
      const nomor = decodeURIComponent(String(alamat).split("nomorPerkara=")[1] || "");
      return { ok: true, status: 200, json: async () => ({ data: draf(nomor) }) };
    },
    bacaPutusanSegar: async () => ({ sudahPutus: false, tanggal: "", status: "" }),
    praperiksaSebelumMengisi: async (nomor: string) => praperiksa(nomor),
    gambarRaporAgen: () => dokumen.createElement("div"),
    // Jembatan tiruan: menjawab seperti jembatan.js - {ok} atau {ok:false, alasan}.
    kirimKeJembatanLangsung: async (pesan: { jenis: string; penunjuk: string }) => {
      jembatan.push({ jenis: pesan.jenis, penunjuk: pesan.penunjuk });
      if (pesan.jenis === "nilai") return { ok: true, nilai: "", tampak: true };
      if (pesan.jenis === "isi" && pesan.penunjuk in gagalkan) return { ok: false, alasan: gagalkan[pesan.penunjuk] };
      return { ok: true };
    },
    simpanPutusanLaluBuka: async (nomor: string) => {
      simpanDitekan.push(nomor);
      return { ok: true, bunyi: "tersimpan" };
    },
    // Daftar medan borang tanpa tambahan satker (portal mati, cadangan
    // tertanam): penahan medan tambahan tidak ikut campur di berkas ini -
    // ia dijaga ekstensi-medan-putusan-tipe.test.ts.
    alatTipeKeluaran: async () => ({ entri: [], asal: "tertanam", versi: null, dibuang: 0 }),
    cariNomorPerkara: () => "",
    bagian: (judul: string) => {
      const kotak = dokumen.createElement("div") as unknown as HTMLDivElement & { isi: HTMLDivElement };
      kotak.appendChild(dokumen.createElement("h3")).textContent = judul;
      kotak.isi = dokumen.createElement("div");
      kotak.appendChild(kotak.isi);
      return kotak;
    },
  };
  vm.createContext(k);
  // Lahir 26 September 2026 (antrean ditulis per butir, sebab tertahan
  // bernama) - diambil bila ada, supaya kode yang lebih tua tetap termuat.
  const ada = (isi: string, pola: string) => new RegExp(pola, "m").test(isi);
  const tetapanAda = (isi: string, nama: string) => (ada(isi, `^const ${nama} = `) ? [tetapan(isi, nama)] : []);
  const fungsiAda = (isi: string, nama: string) => (ada(isi, `^(?:async )?function ${nama}\\(`) ? [potongFungsi(isi, nama)] : []);
  vm.runInContext(
    [
      tetapan(konten, "ALETA_API_ISIAN_PUTUSAN"),
      tetapan(konten, "NAMA_KEADAAN_ANTREAN"),
      ...tetapanAda(konten, "NAMA_SEBAB_TAHAN"),
      ...fungsiAda(konten, "namaKeadaanButir"),
      ...["buatElemen", "ringkasHentikan", "kirimKeJembatan", "jalankanSatuAntreanSipp", "bagianAntreanSipp"].map((nama) =>
        potongFungsi(konten, nama)
      ),
      tetapan(alat, "ALAT_ANTREAN_MAKS"),
      ...["ALAT_ANTREAN_NAMA_KUNCI", "ALAT_PENANDA_HALAMAN"].flatMap((nama) => tetapanAda(alat, nama)),
      ...["alatDalamKunciAntrean", "alatUbahButirAntrean", "alatBacaButirAntrean"].flatMap((nama) => fungsiAda(alat, nama)),
      ...["alatBuatAntrean", "alatAntreanBerikutnya", "alatAntreanRingkas"].map((nama) => potongFungsi(alat, nama)),
      "this.__uji = { jalankanSatuAntreanSipp, bagianAntreanSipp, alatBuatAntrean, alatSimpanAntrean };",
    ].join("\n"),
    k,
    { filename: "konten.js + panel-alat.js (potongan)" }
  );
  const uji = k.__uji as {
    jalankanSatuAntreanSipp: (a: Antrean, b: Butir, kabar: Kabar | null, tombol: HTMLButtonElement | null) => Promise<void>;
    bagianAntreanSipp: (nomorHalaman: string) => Promise<(HTMLDivElement & { isi: HTMLDivElement }) | null>;
    alatBuatAntrean: (p: { butir: Array<{ nomor: string }>; tahap: string; modus: string }) => Antrean;
    alatSimpanAntrean: (a: Antrean | null) => Promise<boolean>;
  };

  /** Antrean tahap SIPP yang sungguh dibuat alatBuatAntrean, lalu disimpan. */
  async function antreanBaru(nomor: string[], modus = "manual") {
    const antrean = uji.alatBuatAntrean({ butir: nomor.map((n) => ({ nomor: n })), tahap: "sipp", modus });
    await uji.alatSimpanAntrean(antrean);
    return antrean;
  }

  /** Satu perkara antrean dijalankan dengan kabar dan tombol sungguhan. */
  async function jalankan(antrean: Antrean, nomor: string) {
    const butir = antrean.butir.find((b) => b.nomor === nomor)!;
    const kabar = dokumen.createElement("div");
    const tombol = dokumen.createElement("button");
    await uji.jalankanSatuAntreanSipp(antrean, butir, kabar, tombol);
    return { butir, kabar, tombol };
  }

  return {
    dokumen,
    uji,
    jembatan,
    kotakHitam,
    simpanDitekan,
    pewaktu,
    antreanBaru,
    jalankan,
    tersimpan: (): Antrean | null => (tersimpan ? JSON.parse(tersimpan) : null),
    aturGagal: (peta: Record<string, string>) => void (gagalkan = peta),
    aturDraf: (f: (nomor: string) => Draf) => void (draf = f),
    aturPraperiksa: (f: (nomor: string) => Rapor) => void (praperiksa = f),
  };
}

const N1 = "1/Pdt.G/2026/PA.Dgl";
const N2 = "2/Pdt.G/2026/PA.Dgl";
const N3 = "3/Pdt.G/2026/PA.Dgl";
const N4 = "4/Pdt.G/2026/PA.Dgl";

/** Baris ringkasan antrean (baris pertama di bagian). */
function ringkasan(kotak: HTMLDivElement & { isi: HTMLDivElement }) {
  return String(kotak.isi.querySelector(".aleta-tetap-sebab")?.textContent || "");
}

// ===========================================================================
describe("medan yang gagal terisi MENAHAN Simpan (blok 3b)", () => {
  it.each(["#perhum", "#amar", "#amar_anonim"])(
    "%s saja yang gagal: Simpan tidak ditekan, perkaranya tertahan beserta sebabnya",
    async (penunjuk) => {
      const u = muatAntrean();
      const antrean = await u.antreanBaru([N1]);
      u.aturGagal({ [penunjuk]: "medan_tidak_ketemu" });

      const { butir, kabar, tombol } = await u.jalankan(antrean, N1);

      expect(u.simpanDitekan).toEqual([]);
      expect(butir.keadaan).toBe("tertahan");
      expect(butir.sebabTahan).toBe("gagal-isi");
      expect(butir.catatan).toContain(`${penunjuk}: medan_tidak_ketemu`);
      expect(butir.catatan).toContain("Simpan tidak ditekan");
      // Ketiga medan tetap dicoba - catatannya menyebut SEMUA yang gagal,
      // bukan hanya yang pertama.
      expect(u.jembatan.filter((j) => j.jenis === "isi").map((j) => j.penunjuk)).toEqual([
        "#perhum",
        "#amar",
        "#amar_anonim",
      ]);
      // Keadaannya tersimpan: panel yang lahir kembali membaca tertahan, bukan menunggu.
      const simpanan = u.tersimpan()!;
      expect(simpanan.butir[0].keadaan).toBe("tertahan");
      expect(simpanan.butir[0].sebabTahan).toBe("gagal-isi");
      // Tidak ditelan: masuk kotak hitam dan tampak di kabar.
      expect(u.kotakHitam.some((c) => c.jenis === "massal-galat" && c.ringkas.includes(N1) && c.ringkas.includes(penunjuk))).toBe(true);
      expect(kabar.className).toContain("aleta-abt-gagal");
      expect(kabar.textContent).toContain(penunjuk);
      expect(tombol.disabled).toBe(false);
    }
  );

  it("jembatan yang tidak menjawab dihitung GAGAL, bukan terisi", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1]);
    u.aturGagal({ "#amar": "jembatan_tidak_menjawab" });

    const { butir } = await u.jalankan(antrean, N1);

    expect(u.simpanDitekan).toEqual([]);
    expect(butir.keadaan).toBe("tertahan");
    expect(butir.catatan).toContain("#amar: jembatan_tidak_menjawab");
  });

  it("dua medan gagal: keduanya disebut, Simpan tetap tidak ditekan", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1]);
    u.aturGagal({ "#perhum": "medan_tidak_ketemu", "#amar_anonim": "tidak_tampak" });

    const { butir } = await u.jalankan(antrean, N1);

    expect(u.simpanDitekan).toEqual([]);
    expect(butir.catatan).toContain("#perhum: medan_tidak_ketemu");
    expect(butir.catatan).toContain("#amar_anonim: tidak_tampak");
  });

  it("semua medan terisi: Simpan ditekan TEPAT sekali dan perkaranya selesai", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1]);

    const { butir } = await u.jalankan(antrean, N1);

    expect(u.simpanDitekan).toEqual([N1]);
    expect(butir.keadaan).toBe("selesai");
    expect(butir.sebabTahan).toBeUndefined();
    expect(butir.catatan).toContain("tersimpan di SIPP");
  });

  it("medan yang drafnya kosong BUKAN kegagalan: perkara cabut tetap tersimpan", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1]);
    u.aturDraf(() => ({ ada: true, pertimbangan: "", amar: "<p>1. Mengabulkan pencabutan;</p>", amarAnonim: "" }));

    const { butir } = await u.jalankan(antrean, N1);

    expect(u.jembatan.filter((j) => j.jenis === "isi").map((j) => j.penunjuk)).toEqual(["#amar"]);
    expect(u.simpanDitekan).toEqual([N1]);
    expect(butir.keadaan).toBe("selesai");
  });

  // Sejak 26 September 2026 praperiksa berjalan SESUDAH borang diisi dan
  // sebelum Simpan - ia harus membaca Status dan verstek yang dipilih antrean
  // sendiri (lihat 3p di jalankanSatuAntreanSipp). Yang ditahannya tetap
  // tidak disimpan; isian borangnya dibiarkan untuk diperiksa petugas.
  it("perkara yang ditahan praperiksa: blangko terisi, Simpan TIDAK ditekan, dan sebabnya praperiksa", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1]);
    u.aturPraperiksa(() => ({
      hentikan: true,
      jumlah: { perhatian: 0 },
      temuan: [{ tingkat: "hentikan", judul: "tanggal putusan sebelum sidang terakhir" }],
    }));

    const { butir } = await u.jalankan(antrean, N1);

    expect(u.jembatan.filter((j) => j.jenis === "isi").map((j) => j.penunjuk)).toEqual(["#perhum", "#amar", "#amar_anonim"]);
    expect(u.simpanDitekan).toEqual([]);
    expect(butir.keadaan).toBe("tertahan");
    expect(butir.sebabTahan).toBe("praperiksa");
    expect(butir.catatan).toContain("tanggal putusan sebelum sidang terakhir");
  });

  it("mode otomatis: perkara yang tertahan TIDAK diisi ulang sendiri saat panelnya lahir kembali", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1, N2], "otomatis");
    u.aturGagal({ "#amar": "medan_tidak_ketemu" });
    await u.jalankan(antrean, N1);
    expect(u.simpanDitekan).toEqual([]);

    // Borang perkara yang sama masih terbuka; panel digambar ulang.
    u.dokumen.body.appendChild(u.dokumen.createElement("form")).id = "frm_putusan";
    const kotak = (await u.uji.bagianAntreanSipp(N1))!;

    expect(u.pewaktu).toEqual([]);
    const tombol = Array.from(kotak.querySelectorAll("button")).map((b) => b.textContent);
    expect(tombol).not.toContain("Isi putusan & simpan (dari draf ALETA)");
    expect(kotak.textContent).toContain(`Perkara berikutnya di antrean: ${N2}`);
  });
});

// ===========================================================================
describe("ringkasan antrean memisahkan dua sebab tertahan", () => {
  it("praperiksa, gagal isi, selesai, dan menunggu dihitung masing-masing", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1, N2, N3, N4]);

    u.aturPraperiksa((nomor) =>
      nomor === N1
        ? { hentikan: true, jumlah: { perhatian: 0 }, temuan: [{ tingkat: "hentikan", judul: "pihak tidak cocok" }] }
        : RAPOR_LOLOS
    );
    await u.jalankan(antrean, N1);
    u.aturGagal({ "#amar": "medan_tidak_ketemu" });
    await u.jalankan(antrean, N2);
    u.aturGagal({});
    await u.jalankan(antrean, N3);
    expect(u.simpanDitekan).toEqual([N3]);

    const kotak = (await u.uji.bagianAntreanSipp(""))!;
    const teks = ringkasan(kotak);
    expect(teks).toContain("1 selesai, 1 menunggu, 0 gagal, 1 ditahan praperiksa, 1 tertahan karena medan gagal terisi.");
    expect(teks).not.toContain("2 ditahan praperiksa");
    // Barisnya sendiri menyebut sebab masing-masing.
    const baris = Array.from(kotak.querySelectorAll(".aleta-perkakas-baris")).map((b) => b.textContent || "");
    expect(baris.find((b) => b.includes(N1))).toContain("ditahan praperiksa: pihak tidak cocok");
    expect(baris.find((b) => b.includes(N2))).toContain("Simpan tidak ditekan - gagal terisi: #amar: medan_tidak_ketemu");
    // Antrean berlanjut ke perkara yang masih menunggu.
    expect(kotak.textContent).toContain(`Perkara berikutnya: ${N4}`);
  });

  it("antrean lama tanpa ruas sebabTahan tetap terbaca sebagai praperiksa", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1, N2]);
    // Tersimpan sebelum ruas sebabTahan lahir: satu-satunya penahan saat itu praperiksa.
    antrean.butir[0].keadaan = "tertahan";
    antrean.butir[0].catatan = "ditahan praperiksa: pihak tidak cocok";
    await u.uji.alatSimpanAntrean(antrean);

    const teks = ringkasan((await u.uji.bagianAntreanSipp(""))!);
    expect(teks).toContain("0 selesai, 1 menunggu, 0 gagal, 1 ditahan praperiksa.");
    expect(teks).not.toContain("gagal terisi");
  });

  it("sebab tahan yang belum bernama tetap dihitung dan disebut, tidak hilang dari ringkasan", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1, N2]);
    // "medan-tambahan" dan "pilihan" sudah bernama sejak 26 September 2026;
    // yang diuji di sini sebab yang BELUM bernama - dari versi yang lebih baru.
    antrean.butir[0].keadaan = "tertahan";
    antrean.butir[0].sebabTahan = "sebab-baru";
    antrean.butir[0].catatan = "Simpan diserahkan ke petugas";
    await u.uji.alatSimpanAntrean(antrean);

    const teks = ringkasan((await u.uji.bagianAntreanSipp(""))!);
    expect(teks).toContain("0 selesai, 1 menunggu, 0 gagal, 0 ditahan praperiksa, 1 tertahan (sebab-baru).");
  });

  it("antrean tanpa yang tertahan: ringkasan tidak menyebut sebab gagal isi", async () => {
    const u = muatAntrean();
    const antrean = await u.antreanBaru([N1, N2]);
    await u.jalankan(antrean, N1);

    const teks = ringkasan((await u.uji.bagianAntreanSipp(""))!);
    expect(teks).toContain("1 selesai, 1 menunggu, 0 gagal, 0 ditahan praperiksa.");
  });
});
