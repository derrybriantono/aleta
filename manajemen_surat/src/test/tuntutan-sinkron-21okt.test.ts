// @vitest-environment node
/**
 * ============================================================================
 * 21 OKT 2026 - BLANGKO DERRY SINKRON DENGAN TABEL ABT DAN DENGAN POSITA/PETITUM
 * ============================================================================
 *
 * Temuan pengguna (perkara cerai gugat verstek, blangko "[01] [Kabul Verstek] Cerai (Format Lengkap)"):
 *   1. Tabel variabel ABT lama TIDAK memuat mut'ah, nafkah iddah, madliyah, nafkah anak, kenaikan nafkah, dasar kemampuan,
 *      pendapat anak mumayyiz - tetapi panel Blangko Derry menampilkan kartunya ("diisi manual", "sejumlah Rp_,00").
 *      "ABT lama dan ABT by Derry harus sinkron dan sama, yang membedakan cuma tampilan."
 *   2. "Kalau tidak ada permintaan mut'ah maka tidak ada pertimbangan mut'ah, begitupun semua variabel/form yang tidak diminta
 *      di posita dan petitum."
 *
 * Yang dijaga:
 *   A  bot: penanda blangko PERSIS tabel ABT (Abt_model::show_variabel_rtf - urutan kemunculan, tanpa penyatuan). Diukur
 *      21 Okt atas 1.753 RTF Derry server: sama dengan php56 asli 1.753/1.753.
 *   B  portal susun.ts: urutan isian = urutan tabel ABT; isian tuntutan bertanda pemicu petitumnya; pemicu 4140-4145 dan
 *      #3400# (kutipan) ikut dinilai.
 *   C  ekstensi: kartu daftar utama hanya penanda tabel ABT (perkara tanpa tuntutan); isian tuntutan yang tidak diminta
 *      disembunyikan; yang diminta / ditetapkan karena jabatan / sudah dipilih / sudah berisi tampil. Fixture = 13 blangko
 *      server (CG, CT, kumulasi, itsbat, DK, hak asuh, hak bekas istri) dengan katalog ABT server.
 *   D  paket ABT x3: pola pembaca petitum tidak menyala atas nama pihak; 3400 dan 25 baris ubah; ASCII, hanya SELECT.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";

import { kodeUntukNilai, susunIsian, TUNTUTAN_CERAI, tuntutanIsian, type ButirIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const mesin = req(path.join(AKAR, "aleta_bot/services/abtMesinVariabel.js")) as { penandaUrutAbt: (rtf: string) => string[] };

type Fixture = { blangko: Array<{ berkas: string; penandaAbt: string[] }>; katalog: Record<string, { nama: string; jenis: string; sql: string; bawaan: string }> };
const FX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "tuntutan-sinkron-21okt.json"), "utf8")) as Fixture;
const KATALOG = new Map<string, Definisi>(Object.entries(FX.katalog).map(([kode, d]) => [kode, { kode, ...d }]));
const blangko = (awal: string) => {
  const b = FX.blangko.find((x) => x.berkas.startsWith(awal));
  if (!b) throw new Error(`fixture tanpa ${awal}`);
  return b;
};
const penandaTabel = (b: { penandaAbt: string[] }) => b.penandaAbt.filter((k) => /^\d{3,5}$/.test(k));
const CG01 = "1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf";
const CT01 = "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf";
const CT_MI = "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah";
const CG01D = "1 Perceraian CG/[01d]";

// ----------------------------------------------------------------------------
// A. Penanda persis tabel ABT
// ----------------------------------------------------------------------------
describe("A. penanda blangko persis tabel variabel ABT", () => {
  it("urutan kemunculan, ganda dibuang, baris baru dan dua kode huruf Word dibuang, penanda terpecah TIDAK disatukan (ABT pun tidak)", () => {
    const rtf = "x #0001# y #00\n46# #4138##8505# #0001# {\\hich\\af1\\dbch\\af31505\\loch\\f0 #85}03# ##";
    expect(mesin.penandaUrutAbt(rtf)).toEqual(["0001", "0046", "4138", "8505", ""]);
    expect(mesin.penandaUrutAbt("{\\hich\\af1\\dbch\\af31505\\loch\\f1 #8503#}#8503#")).toEqual(["8503"]);
  });

  it("jembatan bot memulangkan penandaAbt dan rute portal memakainya (urutan dan himpunan tabel ABT)", () => {
    const jembatan = readFileSync(path.join(AKAR, "aleta_bot/services/sippReadOnlyBridgeService.js"), "utf8");
    expect(jembatan).toMatch(/penandaAbt = mesin\.penandaUrutAbt\(asli\)/);
    const rute = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/blangko-derry/route.ts"), "utf8");
    expect(rute).toMatch(/const penanda = penandaAbt\.length \? penandaAbt :/);
  });
});

// ----------------------------------------------------------------------------
// B. susun.ts
// ----------------------------------------------------------------------------
describe("B. susunIsian atas blangko server", () => {
  it("urutan isian langsung mengikuti urutan tabel ABT; isian langsung = penanda tabel ABT, tak langsung = bukan", () => {
    for (const b of FX.blangko) {
      const tabel = penandaTabel(b);
      const s = susunIsian(tabel, KATALOG);
      const idx = (k: string) => tabel.indexOf(k);
      const langsung = s.isian.filter((x) => x.langsung && x.jenis !== "tj" && !x.khusus);
      for (let i = 1; i < langsung.length; i++) expect(idx(langsung[i].kode), `${b.berkas}: ${langsung[i - 1].kode} sebelum ${langsung[i].kode}`).toBeGreaterThan(idx(langsung[i - 1].kode));
      for (const x of s.isian) expect(tabel.includes(x.kode), `${b.berkas} ${x.kode}`).toBe(x.langsung);
    }
  });

  it("CG [01] verstek: mut'ah, nafkah iddah, madliyah, nafkah anak, kenaikan, dasar kemampuan, pendapat anak TIDAK ada di tabel ABT - hanya dibaca #4119#/#4138#", () => {
    const tabel = penandaTabel(blangko(CG01));
    for (const k of ["6054", "6055", "6071", "6072", "7120", "9050", "4107", "4108", "9711", "9712", "9713", "9740", "9741"]) expect(tabel).not.toContain(k);
    expect(tabel).toEqual(expect.arrayContaining(["4119", "4138", "8503", "8530", "8531", "8532"]));
    const s = susunIsian(tabel, KATALOG);
    expect(s.isian.find((x) => x.kode === "6055")).toMatchObject({ langsung: false, tuntutan: ["4143"] });
    expect(s.isian.find((x) => x.kode === "4107")!.tuntutan).toEqual(["4141", "4142", "4143", "4144"]);
    expect((s.tuntutan || []).map((t) => t.pemicu)).toEqual(["4140", "4141", "4142", "4143", "4144", "4145"]);
    expect(s.pemicu.map((p) => p.kode)).toEqual(expect.arrayContaining(["4140", "4141", "4142", "4143", "4144", "4145"]));
    expect(s.kutipanTuntutan).toBe("3400");
    expect(kodeUntukNilai(s, false)).toEqual(expect.arrayContaining(["3400", "4142", "4143"]));
  });

  it("peta tuntutan: tiap isian satu tuntutan kecuali isian bersama; keputusan majelis 4100-4105", () => {
    expect(TUNTUTAN_CERAI.map((t) => t.keputusan)).toEqual(["4100", "4101", "4102", "4103", "4104", "4105"]);
    expect(tuntutanIsian("9712")).toEqual(["4142"]);
    expect(tuntutanIsian("8603")).toEqual(["4140", "4141"]);
    expect(tuntutanIsian("8503")).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// C. Ekstensi: golongan tampil (fungsi murni yang SAMA dengan layar)
// ----------------------------------------------------------------------------
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/lain/", runScripts: "outside-only" });
const w = dom.window as unknown as { eval: (s: string) => void; aletaBlangkoDerryIsian: any; chrome: unknown };
w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } }, runtime: { id: "uji" } };
w.eval(readFileSync(path.join(EKSTENSI, "blangko-derry.js"), "utf8"));
w.eval(readFileSync(path.join(EKSTENSI, "blangko-derry-isian.js"), "utf8"));
afterAll(() => dom.window.close());
const M = () => w.aletaBlangkoDerryIsian.murni;

type Keadaan = { menyala?: string[]; jabatan?: string[]; isi?: Record<string, string> };
function golongan(awal: string, k: Keadaan = {}) {
  const b = blangko(awal);
  const tabel = penandaTabel(b);
  const s = susunIsian(tabel, KATALOG);
  const isi = k.isi || {};
  const keputusan = (p: string) => {
    const kode = TUNTUTAN_CERAI.find((t) => t.pemicu === p)?.keputusan || "";
    return Boolean(M().keputusanDipilihMurni(s.isian.find((x) => x.kode === kode) || { kode }, isi[kode] || ""));
  };
  const ctx = {
    dikenal: (p: string) => TUNTUTAN_CERAI.some((t) => t.pemicu === p),
    // simulasi nilai TERSIMPAN petugas: kerangka/bawaan tidak dihitung, keputusan harus tepat satu pilihan
    terisiTuntutan: (x: ButirIsian) => Boolean(String(isi[x.kode] || "").trim()) && !M().kerangkaBawaanMurni(x, isi[x.kode]) && (!x.pilihan.length || M().keputusanDipilihMurni(x, isi[x.kode])),
    perkara: { prodeo: false, ghaib: false, lewatEcourt: true, kuasaP: false, kuasaT: false },
    menyala: (p: string) => (k.menyala || []).includes(p),
    terisi: (x: ButirIsian) => Boolean(String(isi[x.kode] || "").trim()),
    jabatan: (p: string) => (k.jabatan || []).includes(p),
    keputusan,
    opsional: (x: ButirIsian) => Boolean(x.opsional),
    jenisCerai: b.berkas.startsWith("1a Perceraian CT") ? "ct" : "cg",
  };
  const g = new Map<string, string>(s.isian.map((x) => [x.kode, M().golonganIsianMurni(x, ctx) as string]));
  const dengan = (nama: string) => [...g.entries()].filter(([, v]) => v === nama).map(([kode]) => kode);
  return { tabel, s, g, utama: dengan("utama"), tuntutan: dengan("tuntutan"), lanjutan: dengan("lanjutan") };
}

describe("C. panel = tabel ABT; tuntutan yang tidak diminta tidak tampil", () => {
  it("13 blangko server, perkara tanpa tuntutan/kuasa/ghaib: SETIAP kartu daftar utama adalah baris tabel ABT; setiap isian di tabel ABT punya tempat di panel", () => {
    for (const b of FX.blangko) {
      const h = golongan(b.berkas);
      for (const k of h.utama) expect(h.tabel, `${b.berkas}: kartu ${k} tidak ada di tabel ABT`).toContain(k);
      for (const x of h.s.isian.filter((y) => y.langsung)) expect(["utama", "takberlaku", "tambahan", "pilihan", "tuntutan"], `${b.berkas} ${x.kode}`).toContain(h.g.get(x.kode));
    }
  });

  it("CG [01] verstek tanpa tuntutan: kartu yang dikeluhkan (6054, 6055, 6071, 6072, 7120, 9050, 4107, 4108, ...) disembunyikan sebagai tuntutan tidak diminta", () => {
    const h = golongan(CG01);
    for (const k of ["6054", "6055", "6071", "6072", "7120", "9050", "4107", "4108", "4102", "4103", "9711", "9712", "9713", "9740", "9741", "2004", "8603"]) {
      expect(h.g.get(k), k).toBe("tuntutan");
    }
    expect(h.utama).toEqual(expect.arrayContaining(["8503", "0222", "0246"]));
    // isian keadaan yang hanya dibaca bagian otomatis (e-litigasi, kuasa, ghaib) masuk bagian tertutup, bukan daftar utama
    for (const k of ["7139", "8564", "8892", "0185", "8894"]) if (h.g.has(k)) expect(h.g.get(k), k).toBe("lanjutan");
  });

  it("petitum menuntut nafkah iddah (#4142# menyala): HANYA isian nafkah iddah dan isian bersamanya yang tampil", () => {
    const dasar = golongan(CG01);
    const h = golongan(CG01, { menyala: ["4142"] });
    const tambah = h.utama.filter((k) => !dasar.utama.includes(k)).sort();
    expect(tambah).toEqual(["4102", "4107", "4109", "9712", "9715"].filter((k) => h.g.has(k)).sort());
    // kotak cerai talak untuk besaran yang sama (6054) = cadangan pada cerai gugat: bagian tertutup, bukan kartu kedua
    expect(h.g.get("6054")).toBe("lanjutan");
    expect(h.g.get("6055")).toBe("tuntutan");
    expect(h.g.get("7120")).toBe("tuntutan");
  });

  it("cerai talak, mut'ah tidak diminta: hakim menetapkan karena jabatan -> isian mut'ah tampil; manual menang (isian yang sudah berisi tetap tampil)", () => {
    expect(golongan(CT01).g.get("6055")).toBe("tuntutan");
    const ex = golongan(CT01, { jabatan: ["4143"] });
    expect(ex.utama).toEqual(expect.arrayContaining(["4103", "6055"]));
    expect(ex.g.get("9713")).toBe("lanjutan"); // kotak cerai gugat untuk besaran yang sama
    expect(ex.g.get("6054")).toBe("tuntutan");
    // keputusan sudah dipilih (tersimpan di ABT) = tetap tampil walau saklar tidak menyala lagi
    expect(golongan(CT01, { isi: { "4103": "diberikan secara ex officio (tidak dituntut)" } }).utama).toEqual(expect.arrayContaining(["4103", "6055"]));
    // nilai yang sudah ada tidak pernah disembunyikan
    expect(golongan(CT01, { isi: { "6054": "Rp3.000.000,00" } }).g.get("6054")).toBe("utama");
  });

  it("hak asuh dan nafkah anak: kumulasi/pemicu menyala -> keputusan, keadaan anak, pendapat anak, kenaikan nafkah tampil", () => {
    const h = golongan(CG01, { menyala: ["4140", "4141"] });
    expect(h.utama).toEqual(expect.arrayContaining(["4100", "4101", "4106", "4108", "9740", "9741"].filter((k) => h.g.has(k))));
    expect(h.g.get("6071")).toBe("lanjutan");
    expect(h.g.get("6054")).toBe("tuntutan");
  });

  it("varian CT Mut'ah Iddah: nafkah iddah dan mut'ah TERTULIS LANGSUNG di blangko (baris tabel ABT) - tampil bila diminta / karena jabatan, disembunyikan bila tidak diminta (21 Okt w25)", () => {
    const h = golongan(CT_MI, { menyala: ["4142", "4143"] });
    expect(h.tabel).toEqual(expect.arrayContaining(["6054", "6055", "4139"]));
    expect(h.utama).toEqual(expect.arrayContaining(["6054", "6055"]));
    const tak = golongan(CT_MI);
    expect(tak.g.get("6054")).toBe("tuntutan");
    expect(tak.g.get("6055")).toBe("tuntutan");
  });

  it("CG [01d] kumulasi nafkah istri: madliyah/iddah/mut'ah dibaca #9716#/#9717# - hanya yang diminta yang tampil", () => {
    const h = golongan(CG01D, { menyala: ["4142", "4143"] });
    expect(h.g.get("9712")).toBe("utama");
    expect(h.g.get("9713")).toBe("utama");
    expect(h.g.get("9711")).toBe("tuntutan");
  });

  it("Hak Bekas Istri [98a] Gugur: 17 isian hak (3740-3756) tidak ada di tabel ABT blangko gugur - tidak menjadi kartu", () => {
    const h = golongan("1f Hak Bekas Istri/[98a]");
    expect(h.utama.filter((k) => /^37[45]\d$/.test(k))).toEqual([]);
  });

  it("kutipan #3400# terurai: diminta / tidak / ragu beserta kutipan petitum", () => {
    const u = M().uraiKutipanTuntutan("4140|tidak|\n4142|ya|...membayar nafkah iddah sebesar Rp3.000.000,00...\n4143|ya|...mut&#39;ah berupa uang...\n4145|ragu|petitum di SIPP kosong");
    expect(u["4140"]).toEqual({ status: "tidak", kutipan: "" });
    expect(u["4142"].status).toBe("ya");
    expect(u["4143"].kutipan).toContain("mut'ah");
    expect(u["4145"]).toEqual({ status: "ragu", kutipan: "petitum di SIPP kosong" });
    expect(M().uraiKutipanTuntutan("")).toEqual({});
  });

  it("layar: saklar karena jabatan hanya untuk penulis putusan; bagian tuntutan dan bagian isian lanjutan ada; 8503 kosong menjelaskan 'TIDAK BENAR QUERY NYA'", () => {
    const js = readFileSync(path.join(EKSTENSI, "blangko-derry-isian.js"), "utf8");
    expect(js).toMatch(/if \(kode === "jabatan"\) \{\s*\/\/[^\n]*\n\s*if \(!bolehTulis\(\) \|\| !S\.blangko \|\| S\.blangko\.jenis !== "put"\) return;/);
    expect(js).toContain("Tuntutan dalam posita dan petitum");
    expect(js).toContain("Isian di dalam bagian otomatis");
    // 30 Okt: bunyi baru paket ABT alasan-belum-dipilih-30okt + bunyi lama untuk server yang belum dipasang.
    expect(js).toContain('[HURUF ALASAN PERCERAIAN BELUM DIPILIH]\\" (di ABT yang belum diperbarui: \\"TIDAK BENAR QUERY NYA\\") dan ikut tercetak.');
    // isi otomatis tetap mencakup isian di dalam bagian otomatis (fitur lama tidak berkurang)
    expect(js).toMatch(/const perlu = \(\) => daftarIsiOtomatis\(\)\.filter/);
  });
});

// ----------------------------------------------------------------------------
// D. Paket ABT x3
// ----------------------------------------------------------------------------
const PAKET = path.join(AKAR, "abt-paket", "x3-tuntutan-sinkron-21okt");
describe("D. paket ABT x3-tuntutan-sinkron-21okt", () => {
  const def = readFileSync(path.join(PAKET, "sumber", "variabel_def.py"), "utf8");
  const baru = (nama: "ti" | "tm" | "td") => {
    const m = def.match(new RegExp(`"IF\\(w\\.pet REGEXP '([^"]+)', 1, 0\\) AS ${nama}"\\),`));
    if (!m) throw new Error(`pola baru ${nama}`);
    return new RegExp(m[1]);
  };
  it("pola baru tidak menyala atas nama pihak yang terukur salah nyala; tetap menyala atas tuntutan sungguhan", () => {
    const ti = baru("ti");
    const tm = baru("tm");
    const td = baru("td");
    for (const nama of ["terhadap penggugat (azidah alias azidah n., s.pd binti nadjo)", "termohon (rosidah alias firdaus rosyida binti imam)", "penggugat (holidah binti abd ajis)", "termohon (nurfaidah binti kisman)", "penggugat (zulkaidah binti lahidin)", "termohon (nur saidah binti ismail)"]) {
      expect(ti.test(nama), nama).toBe(false);
    }
    for (const t of ["menghukum tergugat membayar nafkah iddah sebesar rp", "nafkah selama masa iddah sejumlah rp", "biaya/nafkah iddah kepada tergugat", "nafkah &#39;iddah selama 3 bulan"]) expect(ti.test(t), t).toBe(true);
    for (const nama of ["pemohon (ainul mutahir alias ainul mutakhir bin dahiri)", "tergugat (adi permata nagara bin hi. anwar mutaher)"]) expect(tm.test(nama), nama).toBe(false);
    for (const t of ["mut&#39;ah berupa uang", "mutah sebesar", "mut’ah kepada", "muth'ah"]) expect(tm.test(t), t).toBe(true);
    expect(td.test("tergugat (punggawa pramadhika bin abd salam)")).toBe(false);
    expect(td.test("mahar terhutang sebesar")).toBe(false);
    for (const t of ["nafkah madliyah sebesar", "biaya/nafkah mahdhiyah (nafkah lampau)", "nafkah lampau selama 2 tahun", "nafkah madhiyah kepada"]) expect(td.test(t), t).toBe(true);
  });

  it("isi paket: 1 baru (3400, bebas dari jatah u2 4100-4299 dan paket x1/x2) + 25 ubah, ASCII, tanpa nama aplikasi, hanya tabel abt_variabel, satu transaksi", () => {
    const ps = readFileSync(path.join(PAKET, "paket-satker", "abt-x3-tuntutan-sinkron-21okt-PASANG.sql"), "latin1");
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(ps)).toBe(true);
    expect(/aleta/i.test(ps)).toBe(false);
    expect(ps.match(/^START TRANSACTION;$/gm)).toHaveLength(1);
    expect(ps.match(/^COMMIT;$/gm)).toHaveLength(1);
    const tulis = ps.split("\n").filter((l) => /^(INSERT|UPDATE|DELETE|REPLACE)\b/.test(l));
    expect(tulis.every((l) => /^(INSERT INTO|UPDATE) abt_variabel\b/.test(l))).toBe(true);
    expect(tulis.filter((l) => l.startsWith("INSERT"))).toHaveLength(1);
    expect(tulis.filter((l) => l.startsWith("UPDATE"))).toHaveLength(25);
    expect(readFileSync(path.join(PAKET, "paket-satker", "nomor-baru.txt"), "utf8").trim()).toBe("3400");
    const ubah = readFileSync(path.join(PAKET, "paket-satker", "nomor-ubah.txt"), "utf8").trim().split(",").map(Number);
    expect(ubah).toHaveLength(25);
    expect(ubah.every((n) => n >= 4110 && n <= 4150)).toBe(true);
    // nomor x1 dan x2 (21 Okt) tidak disentuh
    const X1X2 = [237, 3121, 3131, 5078, 5118, 5510, 8013, 8129, 9023, 10113, 74, 207, 5052, 6115, 6116, 8155, 8439, 8445, 10121, 10126, 15, 1241, 1242, 1251, 1252, 5101, 6032, 6149, 6271, 7105, 7106, 8544, 8545, 9003];
    for (const n of [3400, ...ubah]) expect(X1X2).not.toContain(n);
  });

  it("PERIKSA dan PULIH ada dan cocok dengan MD5SUMS; PRASYARAT harapan 0|0|25|0|13|0", () => {
    const md5 = readFileSync(path.join(PAKET, "paket-satker", "MD5SUMS.txt"), "utf8");
    for (const f of ["PASANG", "PERIKSA", "PRASYARAT", "PULIH"]) expect(md5).toContain(`abt-x3-tuntutan-sinkron-21okt-${f}.sql`);
    expect(readFileSync(path.join(PAKET, "paket-satker", "pasang-satker.sh"), "utf8")).toContain("HARAP='0|0|25|0|13|0'");
    expect(existsSync(path.join(PAKET, "PASANG.md"))).toBe(true);
  });
});
