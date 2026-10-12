// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { beforeAll, describe, expect, it } from "vitest";

import { periksaBerkasBenih } from "@/lib/kamus-deteksi";
import { PENANDA_SAKSI, bacaSaksiAbt, letakSaksiAbt, penandaDariAbt, pihakKumpulan } from "@/lib/keterangan-abt";
import { saksiDituntut } from "@/lib/pemeriksaan-bas";
import { penandaDariLembar, type Lembar } from "@/server/modules/aleta-ecourt/bas-lembar";

/**
 * ============================================================================
 * PERTANYAAN SAKSI BAKU (kamus pertanyaan-saksi) DAN SAKSI KE-3, KE-4, KE-5
 * ============================================================================
 *
 * 12 Okt 2026, Agen Q (paket ABT abt-saksi-pertanyaan, variabel 8920-8943).
 *
 *   A. Kamus aleta_bot/kamus-deteksi/awal/pertanyaan-saksi.json: sah menurut kontrak, rujukan set -> pertanyaan utuh,
 *      jenis tanpa contoh nyata TIDAK dikarang (belumAdaContoh), angka tingkat cocok dengan ambangnya.
 *   B. Layanan pertanyaanSaksiService (kamus -> set -> baris), dan penyusun keterangan saksi (abtUsulanService) yang kini
 *      melayani 5 saksi Penggugat + 4 saksi Tergugat TANPA mengubah jawaban saksi 1-2.
 *   C. Rute bot /abt/usulan SUNGGUHAN (dipotong dan dijalankan di node:vm): sumber 'pertanyaan-saksi' dan sembilan saksi.
 *   D. Tabel penanda saksi portal = cermin ekstensi (abt.js) = cermin bot; blangko BAS N saksi dituntut N saksi.
 */

const AKAR = path.resolve(process.cwd(), "..");
const BERKAS_KAMUS = path.join(AKAR, "aleta_bot", "kamus-deteksi", "awal", "pertanyaan-saksi.json");
const require_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));

type Butir = {
  kode: string;
  bagian: string;
  teks: string;
  jawabContoh?: string;
  status?: string;
  belumAdaContoh?: boolean;
  namaSet?: string;
  kodeAbt?: string;
  pihakSaksi?: string;
  gaya?: string;
  syarat?: { jenisPerkaraId?: string[] };
  pertanyaan?: Array<{ kode: string; tingkat: string; persen: number | null; n: number; dariData?: boolean }>;
  huruf?: string;
};
const kamusIsi = JSON.parse(readFileSync(BERKAS_KAMUS, "utf8")) as { kelompok: string; templat: Butir[] };
const PERTANYAAN = new Map(kamusIsi.templat.filter((t) => t.bagian === "pertanyaan").map((t) => [t.kode, t]));
const SET = kamusIsi.templat.filter((t) => t.bagian === "set");

// ============================================================================
// A. KAMUS
// ============================================================================
describe("kamus pertanyaan-saksi", () => {
  it("sah menurut kontrak kamus deteksi (kode unik, tanpa kurung kurawal rusak) dan bernama sesuai berkasnya", () => {
    const hasil = periksaBerkasBenih(kamusIsi, "pertanyaan-saksi.json");
    expect(hasil.galat).toEqual([]);
    expect(kamusIsi.kelompok).toBe("pertanyaan-saksi");
    expect(PERTANYAAN.size).toBeGreaterThan(150);
    expect(SET.length).toBeGreaterThanOrEqual(35);
  });

  it("tiap set merujuk pertanyaan yang ada, tanpa rujukan ganda, dan tingkatnya cocok dengan persen saksi nyata", () => {
    for (const s of SET) {
      const daftar = s.pertanyaan ?? [];
      const kode = daftar.map((q) => q.kode);
      expect(new Set(kode).size, `${s.namaSet}: rujukan ganda`).toBe(kode.length);
      for (const q of daftar) {
        expect(PERTANYAAN.has(q.kode), `${s.namaSet} -> ${q.kode}`).toBe(true);
        if (q.tingkat === "inti") expect(q.persen ?? 0, `${s.namaSet} ${q.kode}`).toBeGreaterThanOrEqual(50);
        if (q.tingkat === "pilihan") {
          expect(q.persen ?? 0).toBeGreaterThanOrEqual(15);
          expect(q.persen ?? 100).toBeLessThan(50);
        }
        if (q.tingkat === "jarang") expect(q.persen ?? 0).toBeLessThan(15);
        expect(["inti", "pilihan", "jarang", "templat", "tambahan"]).toContain(q.tingkat);
      }
    }
  });

  it("penanda di pertanyaan hanya sebutan pihak/variabel 3-5 angka; tanpa nama orang dari BAS nyata", () => {
    for (const p of PERTANYAAN.values()) {
      expect(p.teks.trim().length, p.kode).toBeGreaterThan(8);
      expect(/[{}]/.test(p.teks), p.kode).toBe(false);
      // Nama diri dari BAS nyata tidak boleh masuk bunyi baku: pertanyaan bergaya data memakai #0046#/#0047#.
      if (p.gaya === "data-nyata") expect(/\b(bin|binti)\s+[A-Z]/.test(p.teks), p.kode).toBe(false);
    }
  });

  it("JUJUR: jenis dan huruf tanpa contoh nyata tidak dikarang - tercatat belumAdaContoh dan kosong", () => {
    const belum = new Map(SET.filter((s) => s.belumAdaContoh).map((s) => [s.namaSet, s]));
    for (const nama of ["tambah-c", "tambah-e", "tambah-g", "tambah-h", "belum-ada-349", "belum-ada-348", "belum-ada-364", "belum-ada-347t"]) {
      const s = belum.get(nama);
      expect(s, nama).toBeTruthy();
      expect(s!.pertanyaan ?? [], nama).toEqual([]);
      expect(s!.status, nama).toBe("aktif"); // tetap dimuat: layanan menjawab 'belum_ada_contoh', bukan 'set_tidak_ada'
    }
    // Tambahan huruf yang punya contoh nyata: A, B, D.
    for (const nama of ["tambah-a", "tambah-b", "tambah-d"]) {
      expect(SET.find((s) => s.namaSet === nama)?.pertanyaan?.length, nama).toBeGreaterThan(0);
    }
  });

  it("set cerai gugat saksi Penggugat = kumpulan A1a satker: 16 pertanyaan, mulai 'kenal' dan berakhir penutup, 14 di antaranya inti", () => {
    const s = SET.find((x) => x.namaSet === "cerai-gugat-saksi-p")!;
    expect(s.kodeAbt).toBe("A1a");
    const teks = s.pertanyaan!.map((q) => PERTANYAAN.get(q.kode)!.teks);
    expect(teks).toHaveLength(16);
    expect(teks[0]).toBe("Apakah saudara kenal dengan #0046#?");
    expect(teks[15]).toBe("Apakah masih ada yang ingin saudara sampaikan?");
    expect(s.pertanyaan!.filter((q) => q.tingkat === "inti")).toHaveLength(14);
    expect(PERTANYAAN.get(s.pertanyaan![0].kode)!.jawabContoh).toContain("#0046#");
  });
});

// ============================================================================
// B. LAYANAN
// ============================================================================
type Layanan = {
  idJenis: (x: unknown) => string;
  hurufDariTeks: (t: string) => string[];
  daftarSet: (o?: Record<string, unknown>) => Array<{ namaSet: string; kodeKatalog: string; gaya: string; pihakSaksi: string; tambahan: boolean; belumAdaContoh: boolean; jumlah: number }>;
  ambilSet: (n: string, o?: Record<string, unknown>) => { ok: boolean; sebab?: string; catatan?: string[]; pertanyaan: Array<{ no: string; kode: string; tanya: string; jawab: string }> };
  untukKatalog: (j: unknown) => Array<{ kode: string; nama: string; jenisPerkaraId: string; jumlahPertanyaan: number }>;
  untukTanyaJawab: (k: string) => { ada: boolean; kode?: string; pertanyaan: Array<{ urutan: number; pertanyaan: string; jawabanBawaan: string }>; variabel: unknown[]; sebab?: string };
  kodeAleta: (k: string) => boolean;
};
const layanan = () => require_(path.join(AKAR, "aleta_bot", "services", "pertanyaanSaksiService.js")) as Layanan;
const penyusun = () =>
  require_(path.join(AKAR, "aleta_bot", "services", "abtUsulanService.js")) as {
    susunKeteranganSaksiSdg: (o: Record<string, unknown>) => { ok: boolean; saksi: Array<{ pihak: string; jawaban: Array<{ tanya: string; jawab: string }> }>; saksi1: unknown[]; saksi2: unknown[] };
    BATAS_SAKSI_SDG: { P: number; T: number };
  };

describe("pertanyaanSaksiService", () => {
  it("jenis perkara dikenali dari nama atau id", () => {
    const s = layanan();
    expect(s.idJenis("Cerai Gugat")).toBe("347");
    expect(s.idJenis("Pengesahan Perkawinan/Istbat Nikah")).toBe("360");
    expect(s.idJenis(346)).toBe("346");
    expect(s.idJenis("tidak ada")).toBe("");
  });

  it("daftar set cerai gugat: praktik BAS lebih dulu, tambahan huruf hanya bila diminta, set 'belum ada' ditandai", () => {
    const s = layanan();
    const d = s.daftarSet({ jenisPerkaraId: "347", termasukTambahan: false });
    expect(d[0].namaSet).toBe("cerai-gugat-praktik");
    expect(d.map((x) => x.namaSet)).toEqual(expect.arrayContaining(["cerai-gugat-saksi-p", "cerai-gugat-itsbat-saksi-p", "cerai-gugat-derry-f"]));
    expect(d.every((x) => !x.tambahan)).toBe(true);
    const semua = s.daftarSet({ jenisPerkaraId: "347" });
    expect(semua.some((x) => x.namaSet === "tambah-a" && x.tambahan)).toBe(true);
    expect(semua.find((x) => x.namaSet === "belum-ada-347t")?.belumAdaContoh).toBe(true);
    expect(s.daftarSet({ jenisPerkaraId: "349" }).every((x) => x.belumAdaContoh)).toBe(true);
  });

  it("ambilSet: pertanyaan jarang tidak ikut kecuali diminta; huruf A menyisipkan tambahan SEBELUM penutup; huruf C jujur 'belum ada contoh'", () => {
    const s = layanan();
    const dasar = s.ambilSet("cerai-gugat-saksi-p");
    expect(dasar.ok).toBe(true);
    expect(dasar.pertanyaan).toHaveLength(16);
    expect(dasar.pertanyaan.map((p) => p.no)).toEqual(Array.from({ length: 16 }, (_, i) => String(i + 1)));
    const a = s.ambilSet("ALETA:cerai-gugat-saksi-p", { huruf: ["A"] });
    expect(a.pertanyaan.length).toBeGreaterThan(dasar.pertanyaan.length);
    expect(a.pertanyaan[a.pertanyaan.length - 1].tanya).toBe("Apakah masih ada yang ingin saudara sampaikan?");
    const tambahan = a.pertanyaan.filter((p) => !dasar.pertanyaan.some((d) => d.kode === p.kode));
    expect(tambahan.length).toBeGreaterThan(0);
    expect(tambahan.some((p) => /sabu|judi|obat|wanita lain|menikah lagi/i.test(p.tanya))).toBe(true);
    const c = s.ambilSet("cerai-gugat-saksi-p", { huruf: ["C"] });
    expect(c.pertanyaan).toHaveLength(dasar.pertanyaan.length);
    expect((c.catatan ?? []).join(" ")).toMatch(/huruf C.*belum ada contoh/);
    const kosong = s.ambilSet("tambah-c");
    expect(kosong.ok).toBe(false);
    expect(kosong.sebab).toBe("belum_ada_contoh");
    expect(s.ambilSet("set-yang-tidak-ada").sebab).toBe("set_tidak_ada");
  });

  it("huruf dari posita: usulan mesin deteksi alasan (KDRT -> D, mabuk -> A), bukan putusan", () => {
    const s = layanan();
    expect(s.hurufDariTeks("Bahwa Tergugat sering memukul Penggugat sampai lebam.")).toContain("D");
    expect(s.hurufDariTeks("Bahwa Tergugat suka mabuk dan berjudi.")).toContain("A");
    expect(s.hurufDariTeks("")).toEqual([]);
  });

  it("katalog Lembar BAS: kode 'ALETA:...', pihak saksi T terbaca portal dari namanya, tanya-jawab memakai bentuk kumpulan ABT", () => {
    const s = layanan();
    const katalog = s.untukKatalog("346");
    expect(katalog.length).toBeGreaterThan(2);
    expect(katalog.every((k) => k.kode.startsWith("ALETA:") && s.kodeAleta(k.kode))).toBe(true);
    const t = katalog.find((k) => k.kode === "ALETA:cerai-talak-saksi-t")!;
    expect(t.nama).toMatch(/Saksi T/);
    expect(pihakKumpulan(t.kode, t.nama)).toBe("T");
    const p = katalog.find((k) => k.kode === "ALETA:cerai-talak-saksi-p")!;
    expect(pihakKumpulan(p.kode, p.nama)).toBe("P");
    // "Pilih sesuai alasan" di Lembar BAS: set praktik + huruf A/B/D sebagai kumpulan bergabung, susunannya TETAP per kode
    // (Lembar menyimpan jawaban menurut urutan pertanyaan).
    const cg = s.untukKatalog("347");
    for (const akhiran of ["a", "b", "d"]) expect(cg.map((k) => k.kode)).toContain(`ALETA:cerai-gugat-praktik+${akhiran}`);
    const dasar = s.untukTanyaJawab("ALETA:cerai-gugat-praktik");
    const gabung = s.untukTanyaJawab("ALETA:cerai-gugat-praktik+d");
    expect(gabung.pertanyaan.length).toBeGreaterThan(dasar.pertanyaan.length);
    expect(gabung.pertanyaan.map((p) => p.pertanyaan)).toEqual(s.untukTanyaJawab("ALETA:cerai-gugat-praktik+d").pertanyaan.map((p) => p.pertanyaan));
    expect(gabung.pertanyaan.some((p) => /memukul|KDRT|kekerasan/i.test(p.pertanyaan))).toBe(true);
    expect(gabung.pertanyaan[gabung.pertanyaan.length - 1].pertanyaan).toBe(dasar.pertanyaan[dasar.pertanyaan.length - 1].pertanyaan);
    // Set tanpa contoh nyata tidak ditawarkan.
    expect(s.untukKatalog("349")).toEqual([]);
    const tj = s.untukTanyaJawab("ALETA:cerai-gugat-saksi-p");
    expect(tj.ada).toBe(true);
    expect(tj.variabel).toEqual([]);
    expect(tj.pertanyaan[0]).toMatchObject({ urutan: 1, pertanyaan: "Apakah saudara kenal dengan #0046#?" });
    expect(s.untukTanyaJawab("ALETA:tambah-c").ada).toBe(false);
  });
});

describe("penyusun keterangan saksi: sampai 5 saksi Penggugat + 4 saksi Tergugat", () => {
  const ganti = (t: string) => String(t || "").replace(/#0046#/g, "Penggugat").replace(/#0047#/g, "Tergugat").replace(/#\d{4}#/g, "xxx");
  const set = () => layanan().ambilSet("cerai-gugat-saksi-p");
  const templat = () => set().pertanyaan.map((p) => ({ no: p.no, tanya: ganti(p.tanya), jawab: ganti(p.jawab) }));
  const saksi = (daftar: Array<[string, number]>) =>
    daftar.map(([pihak, ke], i) => ({ pihak, ke, modus: i === 0 ? "sama" : "sebagian", sumber: pihak === "T" ? "tergugat" : "penggugat", alasan: [] as string[] }));
  const dasar = {
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    kodeKumpulan: "ALETA:cerai-gugat-saksi-p",
    jenisPerkara: "347",
    alur: "15",
    alasan: [] as string[],
    posita: "Bahwa Tergugat sering memukul Penggugat dan tidak memberi nafkah. Sejak Januari 2025 Penggugat dan Tergugat pisah rumah.",
    pelaku: "Tergugat",
    lawan: "Penggugat",
  };
  const sembilan: Array<[string, number]> = [["P", 1], ["P", 2], ["P", 3], ["P", 4], ["P", 5], ["T", 1], ["T", 2], ["T", 3], ["T", 4]];

  it("batas bot = 5 P + 4 T, dan sembilan saksi tersusun semuanya dengan jawaban untuk tiap pertanyaan", () => {
    const p = penyusun();
    expect(p.BATAS_SAKSI_SDG).toEqual({ P: 5, T: 4 });
    const h = p.susunKeteranganSaksiSdg({ ...dasar, templat: templat(), saksi: saksi(sembilan) });
    expect(h.ok).toBe(true);
    expect(h.saksi).toHaveLength(9);
    expect(h.saksi.map((s) => s.pihak).join("")).toBe("PPPPPTTTT");
    for (const s of h.saksi) {
      expect(s.jawaban).toHaveLength(16);
      expect(s.jawaban.every((b) => String(b.jawab).trim().length > 0)).toBe(true);
    }
  });

  it("saksi di luar batas (P ke-6, T ke-5) dibuang di penyusun, tidak mengubah yang lain", () => {
    const p = penyusun();
    const lebih: Array<[string, number]> = [...sembilan, ["P", 6], ["T", 5]];
    const h = p.susunKeteranganSaksiSdg({ ...dasar, templat: templat(), saksi: saksi(lebih) });
    expect(h.saksi).toHaveLength(9);
  });

  it("FITUR LAMA IDENTIK: jawaban saksi 1 dan 2 sama persis dengan atau tanpa saksi tambahan; bentuk lama saksi1/saksi2 tetap", () => {
    const p = penyusun();
    const dua = p.susunKeteranganSaksiSdg({ ...dasar, templat: templat(), saksi: saksi([["P", 1], ["P", 2]]) });
    const sembilanH = p.susunKeteranganSaksiSdg({ ...dasar, templat: templat(), saksi: saksi(sembilan) });
    const ringkas = (h: typeof dua, n: number) => h.saksi.slice(0, n).map((s) => s.jawaban.map((b) => `${b.tanya}=>${b.jawab}`));
    expect(ringkas(sembilanH, 2)).toEqual(ringkas(dua, 2));
    expect(sembilanH.saksi1).toEqual(dua.saksi1);
    expect(sembilanH.saksi2).toEqual(dua.saksi2);
    // Bentuk paling lama (tanpa saksi[] sama sekali): dua saksi Penggugat.
    const lama = p.susunKeteranganSaksiSdg({ ...dasar, templat: templat(), modus: { saksi1: { modus: "sama" }, saksi2: { modus: "sebagian" } } });
    expect(lama.saksi).toHaveLength(2);
    expect(lama.saksi.map((s) => s.pihak)).toEqual(["P", "P"]);
  });
});

// ============================================================================
// C. RUTE BOT SUNGGUHAN
// ============================================================================
describe("rute /abt/usulan: set pertanyaan saksi dan sembilan saksi", () => {
  let panggil: (body: unknown) => Promise<{ status: number; json: any }>;
  beforeAll(() => {
    const berkas = path.join(AKAR, "aleta_bot", "routes", "internalGatewayRoutes.js");
    const isi = readFileSync(berkas, "utf8");
    const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
    const awal = isi.lastIndexOf("\n// ====", tanda);
    const akhir = isi.indexOf('router.post("/abt/pdf"');
    if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
    const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
    const rq = createRequire(berkas);
    const konteks = vm.createContext({
      require: (p: string) => rq(p),
      abtUsulanService: rq("../services/abtUsulanService"),
      requireInternalToken: () => undefined,
      router: { post: (jalur: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[jalur] = f) },
      console,
    });
    vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
    const f = rute["/abt/usulan"];
    panggil = async (body) => {
      let status = 200;
      let json: any = null;
      await f(
        { body: JSON.parse(JSON.stringify(body)) },
        { status: (s: number) => ((status = s), { json: (j: any) => void (json = j) }), json: (j: any) => void (json = j) }
      );
      return { status, json };
    };
  });

  it("aksi daftar: set cocok dengan jenis perkara; huruf dari posita (usulan) ikut dijawab", async () => {
    const r = await panggil({
      nomorPerkara: "5/Pdt.G/2026/PA.Dgl",
      sumber: "pertanyaan-saksi",
      jenisPerkara: "Cerai Gugat",
      posita: "Tergugat sering memukul Penggugat dan pergi meninggalkan rumah.",
      pertanyaanSaksi: { aksi: "daftar" },
    });
    const j = r.json.pertanyaanSaksi;
    expect(j.ok).toBe(true);
    expect(j.jenisPerkaraId).toBe("347");
    expect(j.hurufAsal).toBe("posita");
    expect(j.huruf).toContain("D");
    expect(j.daftar[0].namaSet).toBe("cerai-gugat-praktik");
    expect(j.daftar.map((x: { namaSet: string }) => x.namaSet)).toContain("cerai-gugat-saksi-p");
  });

  it("aksi ambil: huruf yang DIPILIH petugas menang atas posita; huruf tanpa contoh disebut", async () => {
    const r = await panggil({
      nomorPerkara: "5/Pdt.G/2026/PA.Dgl",
      sumber: "pertanyaan-saksi",
      jenisPerkara: "347",
      posita: "Tergugat sering memukul Penggugat.",
      pertanyaanSaksi: { aksi: "ambil", namaSet: "cerai-gugat-saksi-p", huruf: ["A", "C"] },
    });
    const j = r.json.pertanyaanSaksi;
    expect(j.ok).toBe(true);
    expect(j.hurufAsal).toBe("dipilih");
    expect(j.huruf).toEqual(["A", "C"]);
    expect(j.tanpaContoh).toEqual(["C"]);
    expect(j.pertanyaan.length).toBeGreaterThan(16);
    const nol = await panggil({ nomorPerkara: "5/Pdt.G/2026/PA.Dgl", sumber: "pertanyaan-saksi", jenisPerkara: "347", pertanyaanSaksi: { aksi: "ambil", namaSet: "tambah-c" } });
    expect(nol.json.pertanyaanSaksi.ok).toBe(false);
    expect(nol.json.pertanyaanSaksi.sebab).toBe("belum_ada_contoh");
  });

  it("saksi[]: lima P + empat T diterima; P ke-6 dan T ke-5 ditolak dengan sebab per pihak", async () => {
    const ganti = (t: string) => t.replace(/#0046#/g, "Penggugat").replace(/#0047#/g, "Tergugat").replace(/#\d{4}#/g, "xxx");
    const templat = layanan()
      .ambilSet("cerai-gugat-saksi-p")
      .pertanyaan.map((p) => ({ no: p.no, tanya: ganti(p.tanya), jawab: ganti(p.jawab) }));
    const saksi = [
      ...[1, 2, 3, 4, 5, 6].map((ke) => ({ ke, pihak: "P", modus: "sama", sumber: "penggugat", alasan: [] as string[] })),
      ...[1, 2, 3, 4, 5].map((ke) => ({ ke, pihak: "T", modus: "sebagian", sumber: "tergugat", alasan: [] as string[] })),
    ];
    const r = await panggil({
      nomorPerkara: "5/Pdt.G/2026/PA.Dgl",
      sumber: "saksi-sdg",
      templat,
      kodeKumpulan: "A1a",
      jenisPerkara: "347",
      alur: "15",
      pelaku: "Tergugat",
      lawan: "Penggugat",
      posita: "Tergugat sering memukul Penggugat.",
      saksi,
    });
    expect(r.json.saksiSdg.saksi).toHaveLength(9);
    expect(r.json.saksiDitolak).toEqual([
      { indeks: 5, alasan: "ke_di_luar_1_sampai_5" },
      { indeks: 10, alasan: "ke_di_luar_1_sampai_4" },
    ]);
  });
});

// ============================================================================
// D. TABEL PENANDA - PORTAL, EKSTENSI, BOT, DAN BLANGKO
// ============================================================================
describe("saksi ke-3 sampai ke-5 di portal, ekstensi, dan blangko BAS", () => {
  const SUMBER_ABT = readFileSync(path.join(AKAR, "ekstensi-sipp", "abt.js"), "utf8");

  it("tabel portal: P 1-5, T 1-4; variabel baru 8920-8943 hanya sekali dipakai; 6122 tetap milik saksi 3 PENGGUGAT", () => {
    expect(Object.keys(PENANDA_SAKSI.P)).toEqual(["1", "2", "3", "4", "5"]);
    expect(Object.keys(PENANDA_SAKSI.T)).toEqual(["1", "2", "3", "4"]);
    const semua: string[] = [];
    for (const pihak of ["P", "T"] as const) {
      for (const p of Object.values(PENANDA_SAKSI[pihak])) semua.push(p.nama, p.umur, p.agama, p.pendidikan, p.pekerjaan, p.alamat, p.sumpah, ...p.tanyaJawab);
    }
    expect(new Set(semua).size).toBe(semua.length);
    expect(PENANDA_SAKSI.T[3].tanyaJawab).toEqual(["8921"]);
    expect(PENANDA_SAKSI.T[3].nama).toBe("6138");
    expect(PENANDA_SAKSI.P[3].tanyaJawab).toContain("6122");
    const baru = semua.filter((n) => Number(n) >= 8920 && Number(n) <= 8949);
    // saksi 5 P: nama..alamat (6) + sumpah + tanya-jawab = 8; saksi 3 T: tanya-jawab 8921; saksi 4 T: 8.
    expect(baru).toHaveLength(17);
    for (const n of baru) expect(Number(n)).toBeLessThanOrEqual(8943);
  });

  it("cermin ekstensi abt.js = tabel portal: nama saksi tiap pihak, jumlah variabel tanya-jawab, dan batas jumlah saksi", () => {
    const blok = (nama: string) => {
      const m = SUMBER_ABT.match(new RegExp(`const ${nama} = Object\\.freeze\\(\\{\\s*P: Object\\.freeze\\(\\[([^\\]]*)\\]\\),\\s*T: Object\\.freeze\\(\\[([^\\]]*)\\]\\),?\\s*\\}\\);`));
      expect(m, nama).toBeTruthy();
      const angka = (s: string) => Array.from(s.matchAll(/"(\d{4})"/g)).map((x) => x[1]);
      return { P: angka(m![1]), T: angka(m![2]) };
    };
    const nama = blok("VAR_NAMA_SAKSI");
    const tj = blok("VAR_SAKSI_TANYA_JAWAB");
    for (const pihak of ["P", "T"] as const) {
      expect(nama[pihak], `nama ${pihak}`).toEqual(Object.values(PENANDA_SAKSI[pihak]).map((p) => p.nama));
      expect(tj[pihak].length, `tanya-jawab ${pihak}`).toBe(nama[pihak].length);
    }
    const batas = SUMBER_ABT.match(/const BATAS_SAKSI_SDG = Object\.freeze\(\{ P: (\d+), T: (\d+) \}\);/)!;
    expect([Number(batas[1]), Number(batas[2])]).toEqual([Object.keys(PENANDA_SAKSI.P).length, Object.keys(PENANDA_SAKSI.T).length]);
    expect([Number(batas[1]), Number(batas[2])]).toEqual([penyusun().BATAS_SAKSI_SDG.P, penyusun().BATAS_SAKSI_SDG.T]);
    // Variabel tanya-jawab baru ditawarkan juga ke tombol di halaman blangko BAS.
    const lain = SUMBER_ABT.match(/const A3_VAR_TANYA_JAWAB_SAKSI_LAIN = Object\.freeze\(\[([^\]]*)\]\);/)!;
    for (const kode of ["8921", "8931", "8941"]) expect(lain[1]).toContain(kode);
  });

  it("blangko BAS N saksi menuntut N saksi (jumlah dari penanda), termasuk varian 5 P dan 4 T", () => {
    const bas6 = (n: number) => {
      const t = ["5058", "5059", "5060", "6124", "8931"].slice(0, n);
      return t;
    };
    expect(saksiDituntut("[02] BAS 6 ... - (3 Saksi).rtf", bas6(3))).toBe(3);
    expect(saksiDituntut("[02] BAS 6 ... - (5 Saksi).rtf", bas6(5))).toBe(5);
    expect(saksiDituntut("[02] BAS 7 ... - (4 Saksi).rtf", ["6120", "6121", "8921", "8941"])).toBe(4);
    expect(saksiDituntut("Verstek (5 Saksi).rtf", ["5058", "5059", "6122", "6124", "8931"])).toBe(5);
  });

  const lembar = (kode: string, nama: string, ke: number, saksi: string): Lembar => ({
    id: `${kode}-${ke}`,
    perkaraId: "1",
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    kodeKumpulan: kode,
    namaKumpulan: nama,
    saksiKe: ke,
    saksi: { nama: saksi, umur: "40", agama: "Islam", pendidikan: "SMA", pekerjaan: "Petani", alamat: "xxx" },
    tanggalSidang: "",
    keadaan: "draf",
    catatan: "",
    acc: "belum-selesai",
    diaccOleh: "",
    diaccAt: "",
    accDikembalikanAlasan: "",
    baris: [{ urutan: 1, pertanyaan: "Apakah saudara kenal?", jawaban: `Kenal ${saksi};` }],
    diubahOleh: "uji",
    diubahAt: "",
  });

  it("Lembar BAS dari set ALETA mengisi saksi P ke-5 (8924-8929, 8931) dan T ke-4 (8934-8939, 8941) - tidak menimpa saksi lain", () => {
    const nilai = penandaDariLembar([
      lembar("ALETA:cerai-gugat-saksi-p", "Pertanyaan Saksi P - Cerai gugat", 5, "P5"),
      lembar("ALETA:cerai-talak-saksi-t", "Pertanyaan Saksi T - Cerai talak", 4, "T4"),
      lembar("ALETA:cerai-gugat-saksi-p", "Pertanyaan Saksi P - Cerai gugat", 1, "P1"),
    ]);
    expect(nilai.get("8924")?.nilai).toBe("P5");
    expect(nilai.get("8929")?.nilai).toBe("xxx");
    expect(nilai.get("8931")?.nilai).toContain("Kenal P5;");
    expect(nilai.get("8934")?.nilai).toBe("T4");
    expect(nilai.get("8941")?.nilai).toContain("Kenal T4;");
    expect(nilai.get("1197")?.nilai).toBe("P1");
    expect(nilai.get("5058")?.nilai).toContain("Kenal P1;");
    expect(nilai.has("8921")).toBe(false);
  });

  it("rekaman ABT dengan pihak dari jembatan bot: saksi P ke-5 -> 8931, saksi T ke-4 -> 8941; urutan 3+ tanpa pihak tetap TIDAK ditebak", () => {
    const tj = [{ urutan: 1, pertanyaan: "Kenal?", jawaban: "Kenal" }];
    const abt = bacaSaksiAbt({
      saksi: [
        { saksiId: "15", saksiKe: 1, pihak: "P", saksiKePihak: 5, tanyaJawab: tj },
        { saksiId: "16", saksiKe: 2, pihak: "T", saksiKePihak: 4, tanyaJawab: tj },
        { saksiId: "17", saksiKe: 3, tanyaJawab: tj },
      ],
    });
    expect(letakSaksiAbt(abt[0])).toEqual({ pihak: "P", ke: 5 });
    expect(letakSaksiAbt(abt[2])).toBeNull();
    const peta = penandaDariAbt(abt, new Set());
    expect([...peta.keys()].sort()).toEqual(["8931", "8941"]);
    expect(peta.get("8941")?.asal).toContain("saksi Tergugat ke-4");
  });
});
