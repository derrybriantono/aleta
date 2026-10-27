// @vitest-environment node
/**
 * ============================================================================
 * 27 OKT 2026 - RINCIAN ALASAN CERAI (5227): SEBAB KONKRET + RANTAI SEBAB-AKIBAT
 * ============================================================================
 *
 * Keputusan pengguna: gugatan = acuan utama, saksi (kedua pihak) = penguat dengan lencana jujur,
 * jawab-menjawab = minor (tidak pernah memunculkan alasan), bunyi menyebut sebab konkret berikut
 * akibatnya ("Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat").
 * Kalimat di bawah disamarkan (tanpa nama pihak sungguhan).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type Bunyi = { keadaan: string; nilai: string };
type Butir = { jenis: string; penutup: boolean; sebab: string[]; bunyi: Bunyi[]; lencana: string; yakin: string; dukungan: { nama: string }[]; jawab: { status: string; jenis: string } | null };
type Rincian = { jenis: string; butir: Butir[]; diLuarGugatan: { kunci: string; saksi: number[] }[] };
type Pihak = { pelaku?: string; lawan?: string };
type Usulan = { kode: string; nilai: string; keyakinan?: string; catatan?: string; pilihan?: Bunyi[]; rincian?: unknown[]; nilaiLama?: string };

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "../aleta_bot");
const mesin = require_(path.join(AKAR, "services/deteksi/alasanRincian.js")) as {
  deteksiRincian: (o: { gugatan: string[]; saksi?: { no: number; pihak?: string; butir: string[] }[]; jawab?: { jenis: string; butir: string[] }[]; pihak?: Pihak }) => Rincian;
  pilihanBunyi: (r: Rincian) => Bunyi[];
  polaUntuk: (jenis: string) => unknown;
};
const kamus = require_(path.join(AKAR, "services/kamusDeteksi.js")) as {
  aturLapisDatabase: (x: { pola?: unknown[]; templat?: unknown[] }) => void;
  lupakan: () => void;
  versi: () => number;
};
const layanan = require_(path.join(AKAR, "services/abtUsulanService.js")) as {
  dariKeteranganSaksi: (a: string, b: string, sidang?: string, pihak?: Pihak, posita?: string, opsi?: Record<string, unknown>) => { usulan: Usulan[]; rincianAlasan?: Rincian; rincianAlasanGalat?: string };
  butirKeterangan: (t: string) => string[];
};

const CG: Pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
const CT: Pihak = { pelaku: "Termohon", lawan: "Pemohon" };
const rinci = (gugatan: string[], extra: Partial<{ saksi: { no: number; pihak?: string; butir: string[] }[]; jawab: { jenis: string; butir: string[] }[]; pihak: Pihak }> = {}) =>
  mesin.deteksiRincian({ gugatan, pihak: CG, ...extra });
const baku = (r: Rincian, n = 0) => r.butir[n].bunyi[0].nilai;

afterEach(() => kamus.lupakan());

describe("rantai sebab-akibat dari gugatan", () => {
  it("contoh pengguna: malas bekerja sehingga kurang memberi nafkah", () => {
    const r = rinci(["Bahwa Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat."]);
    expect(r.butir).toHaveLength(1);
    expect(r.butir[0].jenis).toBe("rantai");
    expect(r.butir[0].sebab).toEqual(["malas-kerja", "nafkah"]);
    expect(baku(r)).toBe("Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat");
  });

  it("judi online -> uang belanja habis (akibat dikutip dari gugatan)", () => {
    const r = rinci(["Bahwa Tergugat sering bermain judi online sehingga uang belanja habis."]);
    expect(baku(r)).toMatch(/^Tergugat .*judi online sehingga uang belanja habis$/);
  });

  it("orang ketiga -> pulang larut dan jarang memberi nafkah (dua akibat dari satu sebab)", () => {
    const r = rinci(["Bahwa Tergugat menjalin hubungan dengan perempuan lain sehingga sering pulang larut malam dan jarang memberi nafkah."]);
    expect(r.butir).toHaveLength(1);
    expect(r.butir[0].sebab).toEqual(["selingkuh", "keluar-malam", "nafkah"]);
    expect(baku(r)).toContain("menjalin hubungan dengan perempuan lain sehingga Tergugat sering keluar malam");
    expect(baku(r)).toContain("dan Tergugat kurang memberikan nafkah kepada Penggugat");
  });

  it("mabuk lalu memukul (syarat), dan orang tua ikut campur sehingga ... (subjek keluarga)", () => {
    const r = rinci(["Bahwa Tergugat sering mabuk-mabukan dan bila mabuk memukul Penggugat.", "Bahwa orang tua Tergugat ikut campur urusan rumah tangga sehingga terjadi pertengkaran terus menerus."]);
    expect(baku(r, 0)).toBe("Tergugat sering mabuk-mabukan dan apabila dalam keadaan demikian Tergugat melakukan kekerasan fisik terhadap Penggugat");
    expect(baku(r, 1)).toMatch(/^orang tua Tergugat ikut campur dalam urusan rumah tangga Penggugat dan Tergugat sehingga antara Penggugat dan Tergugat terus-menerus terjadi perselisihan/);
  });

  it("akibat sebelum sebab ('karena') dinormalkan menjadi sebab -> akibat", () => {
    const r = rinci(["Bahwa Tergugat kurang memberikan nafkah karena Tergugat malas bekerja."]);
    expect(r.butir[0].sebab).toEqual(["malas-kerja", "nafkah"]);
  });

  it("akibat yang bukan sebab konkret (kesimpulan bercerai) tidak dikutip", () => {
    const r = rinci(["Bahwa Tergugat tidak memberikan nafkah kepada Penggugat sehingga rumah tangga tidak dapat dipertahankan lagi."]);
    expect(baku(r)).toBe("Tergugat tidak memberikan nafkah kepada Penggugat");
  });

  it("perselisihan hanya penutup: tidak menggantikan sebab konkret, dan hanya sekali", () => {
    const r = rinci([
      "Bahwa Tergugat tidak memberikan nafkah kepada Penggugat.",
      "Bahwa antara Penggugat dan Tergugat terus menerus terjadi perselisihan dan pertengkaran.",
      "Bahwa sering terjadi pertengkaran.",
    ]);
    expect(r.butir.map((b) => b.penutup)).toEqual([false, true]);
    expect(mesin.pilihanBunyi(r)[0].nilai).toMatch(/^Tergugat tidak memberikan nafkah kepada Penggugat; serta antara Penggugat dan Tergugat terus-menerus terjadi perselisihan/);
  });

  it("beberapa rantai yang berujung perselisihan: perselisihan ditulis sekali di akhir", () => {
    const r = rinci([
      "Bahwa Tergugat mabuk sehingga terjadi pertengkaran.",
      "Bahwa Tergugat berjudi sehingga terjadi perselisihan.",
    ]);
    const kalimat = mesin.pilihanBunyi(r)[0].nilai;
    expect(kalimat.match(/perselisihan dan pertengkaran/g)).toHaveLength(1);
    expect(kalimat).toContain("hal-hal tersebut mengakibatkan");
  });

  it("gugatan yang hanya menyebut perselisihan: item penutup saja, bukan sebab konkret", () => {
    const r = rinci(["Bahwa sejak 2024 sering terjadi perselisihan dan pertengkaran."]);
    expect(r.butir).toHaveLength(1);
    expect(r.butir[0].penutup).toBe(true);
  });

  it("cerai talak: pelaku Termohon, sebutan dinamis dan orang ketiga laki-laki", () => {
    const r = mesin.deteksiRincian({ gugatan: ["Bahwa Termohon tidak taat kepada Pemohon dan menjalin hubungan dengan laki-laki lain."], pihak: CT });
    const teks = r.butir.map((b) => b.bunyi[0].nilai).join(" | ");
    expect(teks).toContain("Termohon tidak taat kepada Pemohon sebagai kepala keluarga");
    expect(teks).toContain("Termohon menjalin hubungan dengan laki-laki lain");
    expect(teks).not.toMatch(/Tergugat|Penggugat/);
  });

  it("penyangkal dan pelaku lawan tidak menghasilkan alasan", () => {
    expect(rinci(["Bahwa Tergugat tidak pernah berjudi.", "Bahwa Penggugat memukul anak."]).butir).toHaveLength(0);
  });

  it("beberapa bunyi pilihan untuk satu alasan, tanpa duplikat", () => {
    const r = rinci(["Bahwa Tergugat tidak memberikan nafkah kepada Penggugat."]);
    const nilai = r.butir[0].bunyi.map((b) => b.nilai);
    expect(nilai.length).toBeGreaterThanOrEqual(3);
    expect(new Set(nilai).size).toBe(nilai.length);
  });

  it("slot akibat tak terbaca: tetap menyebut sebab, bertanda ragu dan perlu diperiksa", () => {
    const r = rinci(["Bahwa Tergugat berjudi sehingga hidup keluarga serba kekurangan setiap hari."]);
    expect(r.butir[0].yakin).toBe("ragu");
    expect(r.butir[0].bunyi[0].nilai).toBe("Tergugat gemar bermain judi sehingga hidup keluarga serba kekurangan setiap hari");
    // pilihan yang lebih umum tetap menyebut sebabnya
    expect(r.butir[0].bunyi.some((b) => b.nilai === "Tergugat gemar bermain judi")).toBe(true);
  });
});

describe("penjaga positif palsu", () => {
  it("kutipan norma (Pasal 19 PP) bukan dalil perbuatan", () => {
    const r = rinci(["Bahwa alasan perceraian menurut Pasal 19 huruf (a) salah satu pihak berbuat zina atau menjadi pemabuk, pemadat, penjudi dan lain sebagainya yang sukar disembuhkan."]);
    expect(r.butir).toHaveLength(0);
  });

  it("identitas pihak (tempat tinggal di Lembaga Pemasyarakatan) bukan alasan dihukum penjara", () => {
    expect(rinci(["Bahwa Tergugat, pekerjaan petani, tempat tinggal di Lembaga Pemasyarakatan Kelas II A."]).butir).toHaveLength(0);
    expect(rinci(["Bahwa Tergugat dijatuhi pidana penjara selama 3 tahun."]).butir[0].sebab).toEqual(["penjara"]);
  });

  it("cacat hukum bukan cacat badan", () => {
    expect(rinci(["Bahwa perkawinan itu mengandung cacat dalam pelaksanaannya."]).butir).toHaveLength(0);
    expect(rinci(["Bahwa Tergugat mengalami cacat badan sejak lahir."]).butir[0].sebab).toEqual(["penyakit"]);
  });

  it("pelaku tak tersirat dari kalimat tanpa subjek dianggap perbuatan pelaku, bertanda ragu", () => {
    const r = rinci(["Sering mabuk-mabukan dan memukul Penggugat."]);
    expect(r.butir.length).toBeGreaterThan(0);
    expect(r.butir.every((b) => b.yakin === "ragu")).toBe(true);
  });
});

describe("saksi menguatkan, jawab-menjawab minor", () => {
  const gugat = ["Bahwa Tergugat sering mabuk-mabukan.", "Bahwa Tergugat berjudi online."];

  it("lencana jujur: kedua saksi / satu saksi / belum dikuatkan / saksi belum diperiksa", () => {
    const dua = rinci(gugat, { saksi: [{ no: 1, pihak: "penggugat", butir: ["Bahwa Tergugat sering mabuk."]}, { no: 2, pihak: "tergugat", butir: ["Bahwa Tergugat mabuk-mabukan."] }] });
    expect(dua.butir[0].lencana).toBe("dikuatkan kedua saksi (saksi Penggugat dan saksi Tergugat)");
    expect(dua.butir[0].yakin).toBe("cukup");
    expect(dua.butir[1].lencana).toBe("dari gugatan - belum dikuatkan saksi");

    const satu = rinci(gugat, { saksi: [{ no: 1, pihak: "tergugat", butir: ["Bahwa Tergugat berjudi online."]}, { no: 2, pihak: "penggugat", butir: ["Bahwa yang lain."] }] });
    expect(satu.butir[1].lencana).toBe("dikuatkan satu saksi (saksi Tergugat)");
    expect(satu.butir[1].yakin).toBe("ragu");

    expect(rinci(gugat).butir[0].lencana).toBe("dari gugatan - saksi belum diperiksa");
  });

  it("sebab yang hanya disebut saksi TIDAK diusulkan (hanya dicatat)", () => {
    const r = rinci(["Bahwa Tergugat sering mabuk-mabukan."], { saksi: [{ no: 1, pihak: "penggugat", butir: ["Bahwa Tergugat memakai narkoba."]}] });
    expect(r.butir.map((b) => b.sebab[0])).toEqual(["mabuk"]);
    expect(r.diLuarGugatan.map((x) => x.kunci)).toEqual(["narkoba"]);
  });

  it("jawaban: diakui / dibantah dicatat, dan tidak pernah memunculkan alasan baru", () => {
    const r = rinci(gugat, {
      jawab: [
        { jenis: "jawaban", butir: ["Bahwa benar Tergugat memang sering mabuk-mabukan."] },
        { jenis: "replik", butir: ["Bahwa tidak benar Tergugat berjudi online.", "Bahwa Tergugat tidak memberi nafkah."] },
      ],
    });
    expect(r.butir.map((b) => [b.sebab[0], b.jawab && b.jawab.status])).toEqual([["mabuk", "diakui"], ["judi", "dibantah"]]);
    expect(r.butir).toHaveLength(2);
    expect(r.butir[0].lencana).toContain("diakui dalam jawaban");
  });
});

describe("integrasi dengan usulan 5227 dan kamus dua lapis", () => {
  const posita = "Bahwa Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat.\nBahwa Tergugat sering mabuk-mabukan dan memukul Penggugat.";
  const bas = (...b: string[]) => b.map((x) => `- Bahwa ${x};`).join("\n");
  const saksi1 = bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk");
  const saksi2 = bas("Tergugat sering mabuk-mabukan", "Tergugat malas bekerja");

  it("tanpa permintaan, usulan lama tidak berubah", () => {
    const h = layanan.dariKeteranganSaksi(saksi1, saksi2, "", CG, posita);
    expect(h.rincianAlasan).toBeUndefined();
    const u = h.usulan.find((x) => x.kode === "5227")!;
    expect(u.rincian).toBeUndefined();
  });

  it("dengan permintaan, 5227 memuat rincian sebab-akibat, pilihan bunyi, dan kalimat lama sebagai pilihan", () => {
    const h = layanan.dariKeteranganSaksi(saksi1, saksi2, "", CG, posita, { rincianAlasan: true, saksiPihak: { saksi1: "penggugat", saksi2: "tergugat" } });
    const u = h.usulan.find((x) => x.kode === "5227")!;
    expect(h.rincianAlasanGalat).toBeUndefined();
    expect(u.nilai).toContain("Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat");
    expect(u.nilai).not.toMatch(/perselisihan dan pertengkaran secara terus-menerus/);
    expect(u.rincian!.length).toBeGreaterThanOrEqual(2);
    expect((u.pilihan || []).length).toBeGreaterThanOrEqual(2);
    expect(u.catatan).toContain("gugatan");
    if (u.nilaiLama) expect((u.pilihan || []).some((p) => p.nilai === u.nilaiLama)).toBe(true);
  });

  it("bunyi dapat diubah lewat lapis database (ruas tambahan bunyi) dan cache dimuat ulang saat kamus berubah", () => {
    const v0 = kamus.versi();
    mesin.polaUntuk("CG");
    const asli = rinci(["Bahwa Tergugat tidak memberikan nafkah kepada Penggugat."]);
    expect(baku(asli)).toBe("Tergugat tidak memberikan nafkah kepada Penggugat");
    // Lapis database menimpa pola benih dengan kode sama: bunyi baru dari Super Admin.
    const benih = require_(path.join(AKAR, "kamus-deteksi/awal/alasan-rincian.json")) as { pola: { kode: string; [k: string]: unknown }[] };
    const dasar = benih.pola.find((p) => p.kode === "rincian-nafkah-tidak")!;
    kamus.aturLapisDatabase({ pola: [{ ...dasar, kelompok: "alasan-rincian", bunyi: ["lalai menafkahi {lawan} sama sekali"] }] });
    expect(kamus.versi()).toBeGreaterThan(v0);
    expect(baku(rinci(["Bahwa Tergugat tidak memberikan nafkah kepada Penggugat."]))).toBe("Tergugat lalai menafkahi Penggugat sama sekali");
    // Mematikan pola lewat database.
    kamus.aturLapisDatabase({ pola: [{ ...dasar, kelompok: "alasan-rincian", status: "nonaktif" }] });
    expect(rinci(["Bahwa Tergugat tidak memberikan nafkah kepada Penggugat."]).butir).toHaveLength(0);
  });

  it("pola dikompilasi sekali: set pola yang sama dikembalikan selama kamus tidak berubah", () => {
    expect(mesin.polaUntuk("CG")).toBe(mesin.polaUntuk("CG"));
  });
});
