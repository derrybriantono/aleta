// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BANK TANYA JAWAB SAKSI CERAI v2 (U1, 20 Okt 2026)
 * ============================================================================
 *
 * Yang dijaga (perilaku, bukan sekadar isi berkas):
 *   - katalog cerai gugat/talak/kumulasi lolos skema, jauh lebih lengkap dari v1, dan tiap pokok wajib punya butir untuk
 *     verstek, kontradiktoir, dan kehadiran setelah mediasi;
 *   - profil pengetahuan saksi ("hanya tahu pisah", "mendengar sendiri", ...) memilih jenis keterangan yang benar PER BUTIR;
 *   - saksi keluarga atau bukan dibaca dari uraian hubungan, dan dapat diganti petugas per saksi;
 *   - fakta gugatan hanya mengisi yang KOSONG (variabel ABT dan isian petugas menang), membawa sumber dan keyakinan, dan
 *     tidak dipakai jawaban ragu/tidak tahu;
 *   - nafkah selama berpisah pada cerai talak mengikuti kedudukan suami (Pemohon), bukan terbalik seperti v1;
 *   - borang: pilihan profil, kedudukan saksi, dan centang alasan per saksi benar-benar mengubah jawaban.
 */

const REPO = path.resolve(__dirname, "../../..");
const AKAR = path.join(REPO, "ekstensi-sipp");
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const M = require(path.join(AKAR, "saksi-katalog.js")) as any;
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8");
const katalog = (k: string) => JSON.parse(readFileSync(path.join(AKAR, "saksi-katalog", `${k}.json`), "utf8"));
const SEMUA = ["cerai-gugat", "cerai-talak", "cerai-kumulasi", "cerai-kumulasi-itsbat"].map(katalog);
const paket = (jenisId: string) => M.kenaliPaket(SEMUA, { jenisPerkaraId: jenisId, alurPerkaraId: "15", nama: jenisId === "346" ? "Cerai Talak" : "Cerai Gugat" });

const susun = (jenisId: string, o: { keadaan?: any; saksi: any[]; variabel?: Record<string, string>; fakta?: any; slotSaksi?: any[] }) => {
  const kat = paket(jenisId);
  const keadaan = Object.assign(M.keadaanBawaan(kat, {}), { kehadiran: "kontradiktoir", alasan: ["F"], suami: jenisId === "346" ? "pengaju" : "lawan" }, o.keadaan || {});
  const v = Object.assign({ "0046": jenisId === "346" ? "Pemohon" : "Penggugat", "0047": jenisId === "346" ? "Termohon" : "Tergugat" }, o.variabel || {});
  return M.susunSaksi(kat, { keadaan, benih: "1/Pdt.G/2026/PA.Dgl", saksi: o.saksi, variabel: (k: string) => v[k], slot: {}, slotSaksi: o.slotSaksi || o.saksi.map(() => ({})), fakta: o.fakta || {}, tingkat: ["inti", "pilihan", "tambahan"] });
};
const barisDi = (h: any, ke: number, butir: string) => h.saksi[ke].baris.find((b: any) => b.butir === butir);

describe("katalog cerai v2 - lebih lengkap dari v1 dan sah", () => {
  const awal: Record<string, number> = { "347": 80, "346": 80 }; // butir v1 pada paket gabungan (cerai + kumulasi + itsbat)

  for (const jenisId of ["347", "346"]) {
    it(`jenis ${jenisId}: butir, kombinasi jenis keterangan, dan kalimat varian melampaui v1; lolos skema`, () => {
      const kat = paket(jenisId);
      const r = M.ringkasKatalog(kat);
      expect(r.pertanyaan).toBeGreaterThanOrEqual(awal[jenisId] + 50);
      expect(r.kalimat).toBeGreaterThanOrEqual(3500);
      for (const j of ["melihat", "mendengar", "de-auditu", "sebagian"]) expect(r.perJenis[j], j).toBeGreaterThanOrEqual(60);
      expect(M.periksaKatalog(kat, {}).galat).toEqual([]);
    });
  }

  it("setiap pokok wajib punya butir pada verstek, kontradiktoir, dan hadir sampai mediasi", () => {
    for (const k of ["cerai-gugat", "cerai-talak"]) {
      const kat = katalog(k);
      const r = M.periksaKatalog(kat, {});
      expect(r.peringatan.filter((p: string) => /kehadiran/.test(p)), k).toEqual([]);
    }
  });

  it("alasan A-H masing-masing memiliki lebih dari tiga butir (v1: dua sampai tiga)", () => {
    const kat = katalog("cerai-gugat");
    for (const h of ["A", "B", "C", "D", "E", "G", "H"]) {
      const n = kat.pertanyaan.filter((q: any) => q.keadaan && q.keadaan.alasan === h).length;
      expect(n, `huruf ${h}`).toBeGreaterThanOrEqual(3);
    }
    // perselisihan terus-menerus (F): sejak kapan, sebab, bentuk, puncak, pisah, upaya damai, harapan rukun, nafkah
    const idF = new Set(kat.pertanyaan.map((q: any) => q.id));
    for (const id of ["q-awal-konflik", "q-penyebab", "q-bentuk", "q-terus-menerus", "q-puncak", "q-pisah", "q-pisah-enam-bulan", "q-yang-pergi", "q-upaya-keluarga", "q-harapan-rukun", "q-nafkah-pisah"]) expect(idF.has(id), id).toBe(true);
  });

  it("verstek dan kontradiktoir menghidupkan butir pihak lawan yang berbeda", () => {
    const kat = paket("347");
    const id = (kehadiran: string) => new Set(M.pertanyaanAktif(kat, Object.assign(M.keadaanBawaan(kat, {}), { kehadiran, alasan: ["F"] }), "P").map((q: any) => q.id));
    const verstek = id("verstek");
    const kontra = id("kontradiktoir");
    const sesudahMediasi = id("t-tidak-hadir-setelah-mediasi");
    expect(verstek.has("q-lawan-alamat") && verstek.has("q-lawan-kabar")).toBe(true);
    expect(verstek.has("q-lawan-sikap")).toBe(false);
    expect(kontra.has("q-lawan-sikap") && kontra.has("q-upaya-tanggapan")).toBe(true);
    expect(kontra.has("q-lawan-alamat")).toBe(false);
    expect(sesudahMediasi.has("q-lawan-tidak-hadir") && sesudahMediasi.has("q-upaya-mediasi")).toBe(true);
    expect(verstek.has("q-lawan-tidak-hadir")).toBe(false);
  });

  it("masih serumah menukar pokok pisah rumah dengan pokok serumah", () => {
    const kat = paket("347");
    const id = (pisahRumah: string) => new Set(M.pertanyaanAktif(kat, Object.assign(M.keadaanBawaan(kat, {}), { kehadiran: "verstek", alasan: ["F"], pisahRumah }), "P").map((q: any) => q.id));
    expect(id("sudah-pisah").has("q-pisah-enam-bulan")).toBe(true);
    expect(id("sudah-pisah").has("q-serumah-keadaan")).toBe(false);
    expect(id("masih-serumah").has("q-serumah-keadaan")).toBe(true);
    expect(id("masih-serumah").has("q-pisah-enam-bulan")).toBe(false);
  });

  it("pisah kurang dari enam bulan menjawab 'belum enam bulan', bukan 'lebih dari enam bulan'", () => {
    const sudah = susun("347", { saksi: [{ pihak: "P", jenis: "melihat" }], variabel: { "9944": "4 bulan" }, keadaan: { kehadiran: "verstek", lamaPisah: "kurang-enam-bulan" } });
    const b = barisDi(sudah, 0, "q-pisah-enam-bulan");
    expect(b.jawab).toMatch(/belum/);
    expect(b.jawab).toContain("4 bulan");
    const lebih = susun("347", { saksi: [{ pihak: "P", jenis: "melihat" }], variabel: { "9944": "1 tahun" }, keadaan: { kehadiran: "verstek" } });
    expect(barisDi(lebih, 0, "q-pisah-enam-bulan").jawab).toMatch(/lebih dari enam bulan|melampaui enam bulan|melebihi enam bulan|lewat enam bulan/);
    expect(barisDi(lebih, 0, "q-pisah-enam-bulan").jawab).not.toMatch(/belum/);
  });

  it("cerai talak: nafkah selama berpisah diberikan Pemohon (suami) kepada Termohon, cerai gugat Tergugat kepada Penggugat", () => {
    const ct = susun("346", { saksi: [{ pihak: "P", jenis: "melihat" }] });
    const bt = barisDi(ct, 0, "q-nafkah-pisah");
    expect(bt.tanya).toBe("Selama berpisah apakah Pemohon masih memberikan nafkah kepada Termohon ?");
    expect(bt.jawab).not.toMatch(/Termohon[^.]*nafkah kepada Pemohon/);
    expect(bt.jawab).toMatch(/Pemohon|Termohon/);
    const cg = susun("347", { saksi: [{ pihak: "P", jenis: "melihat" }] });
    expect(barisDi(cg, 0, "q-nafkah-pisah").tanya).toBe("Selama berpisah apakah Tergugat masih memberikan nafkah kepada Penggugat ?");
    // versi 'berbeda' pun mengikuti suami
    const beda = susun("346", { saksi: [{ pihak: "P", jenis: "melihat", berbeda: ["q-nafkah-pisah"] }] });
    expect(barisDi(beda, 0, "q-nafkah-pisah").jawab).toMatch(/Pemohon/);
  });
});

describe("profil pengetahuan saksi", () => {
  const saksi = (jenis: string) => [{ pihak: "P", jenis }, { pihak: "P", jenis: "melihat" }];

  it("katalog menyediakan delapan profil, termasuk dua tambahan (mendengar sendiri, ragu)", () => {
    const profil = M.profilUntukBorang(paket("347"));
    expect(profil.map((p: any) => p.nilai)).toEqual(
      expect.arrayContaining(["profil:sama", "profil:mendengar-sendiri", "profil:sebagian-alasan", "profil:tidak-tahu-sebab", "profil:tidak-menyaksikan", "profil:dari-cerita", "profil:hanya-tahu-pisah", "profil:ragu"])
    );
  });

  it("hanya tahu pisah: pertengkaran 'tidak tahu', pisah rumah tetap dijawab, hubungan dan penutup melihat", () => {
    const h = susun("347", { saksi: saksi("profil:hanya-tahu-pisah"), variabel: { "0246": "Maret 2024", "5227": "judi" } });
    expect(barisDi(h, 0, "q-penyebab").jenis).toBe("tidak-tahu");
    expect(barisDi(h, 0, "q-awal-konflik").jenis).toBe("tidak-tahu");
    expect(barisDi(h, 0, "q-pisah").jenis).toBe("melihat");
    expect(barisDi(h, 0, "q-pisah").jawab).toContain("Maret 2024");
    expect(barisDi(h, 0, "q-kenal").jenis).toBe("melihat");
    expect(barisDi(h, 0, "q-penutup").jenis).toBe("melihat");
    expect(barisDi(h, 0, "q-penyebab").jawab).toMatch(/tidak/);
    expect(barisDi(h, 0, "q-penyebab").jawab).not.toContain("judi"); // sebab tidak diketahui saksi ini
    // saksi lain (melihat) tetap menerangkan sebabnya
    expect(barisDi(h, 1, "q-penyebab").jawab).toContain("judi");
  });

  it("mendengar sendiri: pertengkaran dijawab 'mendengar', bukan melihat dan bukan dari cerita", () => {
    const h = susun("347", { saksi: saksi("profil:mendengar-sendiri") });
    for (const butir of ["q-bentuk", "q-saksi-lihat", "q-terus-menerus"]) {
      const b = barisDi(h, 0, butir);
      expect(b.jenis, butir).toBe("mendengar");
      expect(b.jawab, butir).toMatch(/dengar/);
      expect(b.jawab, butir).not.toMatch(/cerita|diberi tahu|penuturan/);
    }
    expect(barisDi(h, 0, "q-pisah").jenis).toBe("melihat");
  });

  it("dari cerita memakai sumber cerita yang dipilih petugas", () => {
    const h = susun("347", { saksi: saksi("profil:dari-cerita"), slotSaksi: [{ sumber: "ibu kandung Penggugat" }, {}] });
    const b = barisDi(h, 0, "q-bentuk");
    expect(b.jenis).toBe("de-auditu");
    expect(b.jawab).toContain("ibu kandung Penggugat");
    expect(b.jawab).toMatch(/cerita|penuturan|diceritakan|kabar|menceritakan|bercerita/);
  });

  it("sebagian alasan: sebab hanya yang dicentang, kosong menjadi titik-titik", () => {
    const h = susun("347", { saksi: saksi("profil:sebagian-alasan"), slotSaksi: [{ daftar: "masalah ekonomi dan nafkah dan kecemburuan" }, {}], variabel: { "5227": "A dan B dan C" } });
    const b = barisDi(h, 0, "q-penyebab");
    expect(b.jenis).toBe("sebagian");
    expect(b.jawab).toContain("masalah ekonomi dan nafkah dan kecemburuan");
    expect(b.jawab).toMatch(/sebagian|sebatas|selebihnya/);
    expect(b.tandaKuning).toBe(true);
    const tanpa = susun("347", { saksi: saksi("profil:sebagian-alasan") });
    expect(barisDi(tanpa, 0, "q-penyebab").kosong).toContain("{daftar}");
  });

  it("ragu: butir pokok tanpa angka dan tanpa nama; semua ragu pada pokok wajib memunculkan peringatan", () => {
    const h = susun("347", { saksi: [{ pihak: "P", jenis: "profil:ragu" }, { pihak: "P", jenis: "profil:ragu" }], variabel: { "0222": "Maret 2023", "0246": "Januari 2024" } });
    const b = barisDi(h, 0, "q-awal-konflik");
    expect(b.jenis).toBe("ragu");
    expect(b.jawab).not.toMatch(/\d/);
    expect(h.peringatan.some((p: string) => /ragu atau tidak tahu/.test(p))).toBe(true);
    expect(barisDi(h, 0, "q-kenal").jenis).toBe("melihat");
  });

  it("pilihan per butir mengalahkan profil", () => {
    const kat = paket("347");
    const h = M.susunSaksi(kat, { keadaan: Object.assign(M.keadaanBawaan(kat, {}), { kehadiran: "verstek", alasan: ["F"] }), benih: "x", saksi: [{ pihak: "P", jenis: "profil:hanya-tahu-pisah", perButir: { "q-penyebab": "melihat" } }], variabel: () => undefined, tingkat: ["inti", "pilihan"] });
    expect(barisDi(h, 0, "q-penyebab").jenis).toBe("melihat");
    expect(barisDi(h, 0, "q-awal-konflik").jenis).toBe("tidak-tahu");
  });

  it("profil yang tidak dikenal jatuh ke melihat, tidak menggagalkan penyusunan", () => {
    const h = susun("347", { saksi: [{ pihak: "P", jenis: "profil:tidak-ada" }] });
    expect(barisDi(h, 0, "q-penyebab").jenis).toBe("melihat");
  });
});

describe("saksi keluarga atau bukan keluarga", () => {
  it("kerabatDariHubungan: keluarga, bukan keluarga, dan tidak ditebak", () => {
    expect(M.kerabatDariHubungan("ibu kandung Penggugat")).toBe("keluarga");
    expect(M.kerabatDariHubungan("saudara sepupu Tergugat")).toBe("keluarga");
    expect(M.kerabatDariHubungan("tetangga Penggugat")).toBe("bukan-keluarga");
    expect(M.kerabatDariHubungan("teman kerja Tergugat")).toBe("bukan-keluarga");
    expect(M.kerabatDariHubungan("")).toBe("");
    expect(M.kerabatDariHubungan("kenalan lama")).toBe("bukan-keluarga");
    expect(M.kerabatDariHubungan("orang yang pernah menolong")).toBe("");
  });

  it("dibaca dari variabel hubungan saksi ke-n; jawaban 'hubungan keluarga' berbeda menurut kedudukan", () => {
    const h = susun("347", { saksi: [{ pihak: "P", jenis: "melihat" }, { pihak: "P", jenis: "melihat" }], variabel: { "1241": "ibu kandung Penggugat", "1242": "tetangga Penggugat" } });
    expect(barisDi(h, 0, "q-hubungan-keluarga").jawab).toMatch(/keluarga/);
    expect(barisDi(h, 0, "q-hubungan-keluarga").jawab).toContain("ibu kandung Penggugat");
    expect(barisDi(h, 1, "q-hubungan-keluarga").jawab).toMatch(/bukan|tidak mempunyai hubungan keluarga|bukan kerabat|tidak berkerabat|tidak ada hubungan keluarga/);
    expect(barisDi(h, 1, "q-hubungan-keluarga").jawab).toContain("tetangga Penggugat");
  });

  it("pilihan petugas per saksi mengalahkan bacaan dari hubungan", () => {
    const h = susun("347", { saksi: [{ pihak: "P", jenis: "melihat", keadaan: { kerabat: "bukan-keluarga" } }], variabel: { "1241": "ibu kandung Penggugat" } });
    expect(barisDi(h, 0, "q-hubungan-keluarga").jawab).toMatch(/bukan|tidak/);
  });
});

describe("fakta gugatan mengisi yang kosong, dengan sumber dan keyakinan", () => {
  const fakta = {
    awalKonflik: { nilai: "bulan Juli 2020", yakin: "cukup", sumber: "gugatan", ket: "" },
    pisahSejak: { nilai: "bulan Maret 2024", yakin: "ragu", sumber: "gugatan", ket: "Dua sumber berbeda." },
    puncak: { nilai: "akhir Februari 2025", yakin: "cukup", sumber: "gugatan", ket: "" },
    puncakPeristiwa: { nilai: "Tergugat pergi meninggalkan kediaman bersama", yakin: "cukup", sumber: "gugatan", ket: "" },
    tglNikah: { nilai: "25 Juli 2010", yakin: "yakin", sumber: "data SIPP + gugatan", ket: "" },
    jumlahAnak: { nilai: "2", yakin: "yakin", sumber: "data SIPP", ket: "" },
  };

  it("variabel ABT kosong diisi dari fakta, ditandai sumber dan keyakinan; yang ragu berwarna kuning", () => {
    const h = susun("347", { saksi: [{ pihak: "P", jenis: "melihat" }], fakta, keadaan: { kehadiran: "verstek" } });
    const awal = barisDi(h, 0, "q-awal-konflik");
    expect(awal.jawab).toContain("bulan Juli 2020");
    expect(awal.dariGugatan[0]).toMatchObject({ kunci: "awalKonflik", yakin: "cukup", sumber: "gugatan" });
    expect(awal.kosong).toEqual([]);
    const pisah = barisDi(h, 0, "q-pisah");
    expect(pisah.jawab).toContain("bulan Maret 2024");
    expect(pisah.tandaKuning).toBe(true);
    expect(barisDi(h, 0, "q-anak").jawab).toContain("2 orang anak");
    expect(barisDi(h, 0, "q-nikah").jawab).toContain("25 Juli 2010");
    expect(barisDi(h, 0, "q-lama-nikah").jawab).toMatch(/\d+ tahun/);
  });

  it("slotDari: puncak dan peristiwanya diisi dari gugatan; petugas yang mengetik slot menang", () => {
    const h = susun("347", { saksi: [{ pihak: "P", jenis: "melihat" }], fakta });
    const b = barisDi(h, 0, "q-puncak");
    expect(b.jawab).toContain("akhir Februari 2025");
    expect(b.jawab).toContain("Tergugat pergi meninggalkan kediaman bersama");
    const petugas = susun("347", { saksi: [{ pihak: "P", jenis: "melihat" }], fakta, slotSaksi: [{ waktu: "Desember 2022", peristiwa: "Penggugat diusir" }] });
    const bp = barisDi(petugas, 0, "q-puncak");
    expect(bp.jawab).toContain("Desember 2022");
    expect(bp.jawab).not.toContain("akhir Februari 2025");
    expect(bp.dariGugatan).toEqual([]);
  });

  it("nilai variabel ABT menang atas fakta", () => {
    const h = susun("347", { saksi: [{ pihak: "P", jenis: "melihat" }], fakta, variabel: { "0222": "Januari 2018" } });
    const awal = barisDi(h, 0, "q-awal-konflik");
    expect(awal.jawab).toContain("Januari 2018");
    expect(awal.jawab).not.toContain("Juli 2020");
    expect(awal.dariGugatan).toEqual([]);
  });

  it("jawaban ragu dan tidak tahu tidak menurunkan fakta (tidak ada angka atau tanggal)", () => {
    const h = susun("347", { saksi: [{ pihak: "P", jenis: "ragu" }, { pihak: "P", jenis: "tidak-tahu" }], fakta });
    for (const ke of [0, 1]) for (const b of h.saksi[ke].baris) if (["q-awal-konflik", "q-pisah", "q-penyebab"].includes(b.butir)) expect(b.dariGugatan, `${ke}:${b.butir}`).toEqual([]);
    expect(barisDi(h, 0, "q-awal-konflik").jawab).not.toMatch(/\d/);
  });

  it("tanpa fakta dan tanpa variabel: titik-titik, tidak pernah ditebak", () => {
    const h = susun("347", { saksi: [{ pihak: "P", jenis: "melihat" }], keadaan: { kehadiran: "verstek" } });
    expect(barisDi(h, 0, "q-awal-konflik").kosong).toContain("#0222#");
    expect(barisDi(h, 0, "q-awal-konflik").jawab).toContain("...");
  });
});

// ---------------------------------------------------------------------------
// Borang di panel ABT (jsdom)
// ---------------------------------------------------------------------------

const SUMBER_EKSTENSI = ["panel-alat.js", "saksi-katalog.js", "saksi-katalog-data.js", "saksi-susun.js", "blangko-derry-jawab-katalog.js", "abt.js"].map(baca).join("\n;\n");
const KODE = "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 0047 0222 5227 0246 9944 7035 1268 8503 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 8505 0155 7095 8501 0032 0033 5197 5105 8535 7777".split(" ");
const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

function buka(isi: Record<string, string>, fetchBuatan?: (alamat: string, o?: any) => Promise<any>) {
  const baris = KODE.map((k) => `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${k in isi ? isi[k] : `isi ${k}`}</td><td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`).join("");
  const dom = new JSDOM(`<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="content"><h3 class="w3l_header"><span>123/Pdt.G/2026/PA.Dgl</span></h3><table>${baris}</table></div></div></body></html>`, {
    url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3",
    runScripts: "outside-only",
  });
  halaman.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
  w.chrome = {
    runtime: { getManifest: () => ({ version: "uji" }), getURL: (p: string) => `chrome-extension://uji/${p}`, sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }), lastError: undefined },
    storage: { local: { get: async (kunci: string[]) => Object.fromEntries((kunci || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])), set: async (b: Record<string, unknown>) => void Object.assign(simpanan, b), remove: async () => {} }, onChanged: { addListener: () => {} } },
  };
  w.Response = globalThis.Response;
  w.fetch = fetchBuatan || (async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "", clone() { return this; } }));
  Object.defineProperty(w.HTMLElement.prototype, "innerText", { configurable: true, get() { return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""); } });
  w.eval(`${SUMBER_EKSTENSI}\n;\nwindow.__uji = { mode: () => alatUjiMode() };`);
  return w;
}
const tunggu = async (kondisi: () => boolean, pesan: string) => {
  for (let i = 0; i < 300; i += 1) {
    if (kondisi()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`menunggu: ${pesan}`);
};
const TOMBOL = "Susun saksi menurut keadaan perkara";
const tombolDi = (akar: any, teks: string) => Array.from(akar.querySelectorAll("button")).find((b: any) => b.textContent === teks) as any;

async function bukaBorang(isi: Record<string, string> = {}, fetchBuatan?: (alamat: string, o?: any) => Promise<any>) {
  const w = buka({ "0048": "Cerai Gugat", "0046": "Penggugat", "0047": "Tergugat", "1241": "ibu kandung Penggugat", "1242": "tetangga Penggugat", "0246": "Maret 2024", "8503": "F", ...isi }, fetchBuatan);
  await tunggu(() => Boolean(w.document.getElementById("aleta-panel-abt")), "panel");
  const panel = w.document.getElementById("aleta-panel-abt");
  await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog");
  tombolDi(panel, TOMBOL).click();
  await tunggu(() => Boolean(panel.querySelector(".aleta-ssk .aleta-sdg-form")), "borang");
  return { w, panel, wadah: panel.querySelector(".aleta-ssk") };
}
const ubah = (w: any, el: any, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new w.Event("change"));
};
const jawabDi = (wadah: any, ke: number, butir: string) => (wadah.querySelectorAll(".aleta-ssk-saksi")[ke].querySelector(`.aleta-ssk-baris[data-butir="${butir}"] textarea`) as any).value as string;

describe("borang: profil pengetahuan, kedudukan saksi, centang alasan, dan fakta gugatan", () => {
  it("tiap saksi punya pilihan profil dan pilihan keluarga/bukan; keadaan per saksi tidak muncul di keadaan perkara", async () => {
    const { wadah } = await bukaBorang();
    const barisSaksi = Array.from(wadah.querySelectorAll(".aleta-sdg-modus")) as any[];
    expect(barisSaksi).toHaveLength(2);
    for (const b of barisSaksi) {
      expect(b.querySelector('select[data-keadaan-saksi="kerabat"]')).toBeTruthy();
      const jenis = Array.from(b.querySelectorAll("select")).find((s: any) => Array.from(s.options).some((o: any) => o.value === "profil:hanya-tahu-pisah")) as any;
      expect(jenis).toBeTruthy();
      expect(Array.from(jenis.options).map((o: any) => o.textContent)).toEqual(expect.arrayContaining(["Tidak tahu pertengkarannya, hanya tahu sudah pisah", "Mendengar sendiri pertengkaran, tidak melihat"]));
    }
    expect(wadah.querySelectorAll('select[data-keadaan-saksi="kerabat"]')).toHaveLength(2);
    const keadaanPerkara = Array.from(wadah.querySelectorAll(".aleta-sdg-alasan")).find((e: any) => /Keadaan perkara/.test(e.textContent)) as any;
    expect(keadaanPerkara.textContent).not.toMatch(/Saksi keluarga atau bukan keluarga/);
  });

  it("memilih 'hanya tahu pisah' pada saksi 1 mengubah jawaban pertengkarannya saja", async () => {
    const { w, wadah } = await bukaBorang();
    const jenis = Array.from(wadah.querySelectorAll(".aleta-sdg-modus")).map((b: any) => Array.from(b.querySelectorAll("select")).find((s: any) => Array.from(s.options).some((o: any) => o.value === "ragu"))) as any[];
    ubah(w, jenis[0], "profil:hanya-tahu-pisah");
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi");
    expect(jawabDi(wadah, 0, "q-penyebab")).toMatch(/tidak/);
    expect(jawabDi(wadah, 0, "q-pisah")).toContain("Maret 2024");
    expect(jawabDi(wadah, 1, "q-penyebab")).not.toMatch(/ tidak (?:saya )?(?:mengetahui|tahu)/);
    expect(wadah.textContent).toContain("Tidak tahu pertengkarannya, hanya tahu sudah pisah");
  });

  it("pilihan keluarga/bukan keluarga per saksi mengubah jawaban hubungan; bawaan dibaca dari uraian hubungan", async () => {
    const { w, wadah } = await bukaBorang();
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi");
    expect(jawabDi(wadah, 0, "q-hubungan-keluarga")).toMatch(/keluarga/);
    expect(jawabDi(wadah, 1, "q-hubungan-keluarga")).toMatch(/bukan|tidak/);
    const sel = wadah.querySelector('.aleta-sdg-modus select[data-keadaan-saksi="kerabat"]');
    ubah(w, sel, "bukan-keluarga");
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => /bukan|tidak/.test(jawabDi(wadah, 0, "q-hubungan-keluarga")), "jawaban saksi 1 berubah menjadi bukan keluarga");
    expect(jawabDi(wadah, 0, "q-hubungan-keluarga")).toContain("ibu kandung Penggugat");
  });

  it("centang alasan yang diketahui saksi masuk ke jawaban 'sebagian'", async () => {
    const { w, wadah } = await bukaBorang();
    const baris = Array.from(wadah.querySelectorAll(".aleta-sdg-modus")) as any[];
    const jenis = Array.from(baris[0].querySelectorAll("select")).find((s: any) => Array.from(s.options).some((o: any) => o.value === "ragu")) as any;
    ubah(w, jenis, "profil:sebagian-alasan");
    const kotak = Array.from(baris[0].querySelectorAll(".aleta-ssk-daftar input[type=checkbox]")) as any[];
    expect(kotak.length).toBeGreaterThanOrEqual(10);
    for (const c of kotak.filter((x) => ["masalah ekonomi dan nafkah", "kecemburuan", "kekerasan dalam rumah tangga"].includes(x.value))) {
      c.checked = true;
      c.dispatchEvent(new w.Event("change"));
    }
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi");
    const j = jawabDi(wadah, 0, "q-penyebab");
    expect(j).toContain("masalah ekonomi dan nafkah, kecemburuan dan kekerasan dalam rumah tangga");
    expect(j).toMatch(/sebagian|sebatas|selebihnya/);
  });

  it("fakta gugatan dari server mengisi variabel yang kosong dan jawabannya bersumber, berkeyakinan; variabel terisi tidak ditimpa", async () => {
    const dipanggil: any[] = [];
    const fetchBuatan = async (alamat: string, o?: any) => {
      const jawab = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
      if (/aleta-bot\/abt\/usulan/.test(alamat)) {
        const m = JSON.parse((o && o.body) || "{}");
        dipanggil.push(m);
        if (m.sumber === "isi-jawaban" && m.mintaFakta === true) {
          return jawab({ data: { available: true, faktaPerkara: {
            awalKonflik: { nilai: "bulan Juli 2020", yakin: "cukup", sumber: "gugatan", ket: "" },
            pisahSejak: { nilai: "bulan Januari 1999", yakin: "ragu", sumber: "gugatan", ket: "Dua sumber berbeda" },
            tglNikah: { nilai: "25 Juli 2010", yakin: "yakin", sumber: "data SIPP + gugatan", ket: "" },
          } } });
        }
        return jawab({ data: { available: true } });
      }
      return jawab({ ok: false }, 404);
    };
    const { wadah } = await bukaBorang({ "0222": "DATA_TIDAK_ADA", "5197": "DATA_TIDAK_ADA", "0246": "Maret 2024" }, fetchBuatan);
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi");
    expect(dipanggil.some((m) => m.sumber === "isi-jawaban" && m.mintaFakta === true && Array.isArray(m.saksiIsi) && m.saksiIsi.length === 0)).toBe(true);
    expect(jawabDi(wadah, 0, "q-awal-konflik")).toContain("bulan Juli 2020");
    expect(jawabDi(wadah, 0, "q-nikah")).toContain("25 Juli 2010");
    // variabel 0246 sudah terisi di ABT: tidak ditimpa fakta
    expect(jawabDi(wadah, 0, "q-pisah")).toContain("Maret 2024");
    expect(jawabDi(wadah, 0, "q-pisah")).not.toContain("1999");
    const baris = wadah.querySelector('.aleta-ssk-saksi .aleta-ssk-baris[data-butir="q-awal-konflik"]');
    const ket = baris.querySelector("[data-sumber-fakta]");
    expect(ket.textContent).toMatch(/Diisi dari gugatan/);
    expect(ket.textContent).toMatch(/awal perselisihan/);
    expect(ket.textContent).toMatch(/keyakinan cukup/);
    expect(wadah.textContent).not.toMatch(/aleta/i);
  });

  it("server tidak menjawab: penyusunan tetap berjalan dengan variabel ABT dan isian petugas", async () => {
    const { wadah } = await bukaBorang({ "0222": "Maret 2023" });
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi");
    expect(jawabDi(wadah, 0, "q-awal-konflik")).toContain("Maret 2023");
    expect(wadah.querySelector("[data-sumber-fakta]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Jalur cerai lama: dua pilihan "Yang diketahui saksi" baru
// ---------------------------------------------------------------------------
describe("jalur lama: 'mendengar sendiri' dan 'ragu' pada penyusun keterangan saksi", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bot = require(path.resolve(REPO, "aleta_bot/services/abtUsulanService.js")) as any;
  const TEMPLAT = [
    { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Ya, saya kenal dengan Penggugat dan Tergugat karena saya adalah tetangga Penggugat;" },
    { no: "2", tanya: "Bagaimana kehidupan rumah tangga Penggugat dan Tergugat?", jawab: "Pada awalnya rumah tangga mereka rukun dan harmonis, namun sekarang tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran;" },
    { no: "3", tanya: "Kapan mulai terjadi perselisihan dan pertengkaran antara Penggugat dan Tergugat?", jawab: "Perselisihan dan pertengkaran mereka terjadi sejak bulan Maret 2023;" },
    { no: "4", tanya: "Apakah saksi tahu penyebab perselisihan dan pertengkaran Penggugat dan Tergugat?", jawab: "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu xxx;" },
    { no: "5", tanya: "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?", jawab: "Saya mengetahui karena saya melihat dan mendengar pertengkaran mereka;" },
    { no: "6", tanya: "Apakah saksi pernah melihat atau mendengar Penggugat dan Tergugat bertengkar? Berapa kali?", jawab: "Saya melihat dan mendengar mereka bertengkar sebanyak 3 kali;" },
    { no: "7", tanya: "Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?", jawab: "Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari 2025;" },
  ];
  const POSITA = "Bahwa sejak bulan Maret 2023 sering terjadi perselisihan dan pertengkaran disebabkan Tergugat tidak memberi nafkah kepada Penggugat dan Tergugat sering berjudi.";
  const susunLama = (modus: string, nomor = "1/Pdt.G/2026/PA.Dgl") =>
    bot.susunKeteranganSaksiSdg({ templat: TEMPLAT, posita: POSITA, alasan: ["tidak memberi nafkah", "judi"], pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara: nomor, kodeKumpulan: "", jenisPerkara: "347", alur: "15", modus: { saksi1: { modus, sumber: "penggugat", alasan: [] }, saksi2: { modus: "sama", sumber: "penggugat", alasan: [] } } });
  const j = (h: any, ke: number, no: string) => h.saksi[ke].jawaban.find((x: any) => x.no === no).jawab as string;

  it("mendengar: sebab dan cara tahu bersumber pendengaran sendiri, tidak mengaku melihat; kenal dan pisah rumah tetap dari templat", () => {
    const h = susunLama("mendengar");
    expect(h.ok).toBe(true);
    expect(j(h, 0, "4")).toMatch(/dengar|pendengaran/i);
    expect(j(h, 0, "5")).toMatch(/dengar|pendengaran/i);
    expect(j(h, 0, "5")).not.toMatch(/melihat dan mendengar|melihat sendiri/i);
    expect(j(h, 0, "6")).toMatch(/dengar/i);
    expect(j(h, 0, "6")).toMatch(/tidak|belum|bukan|tanpa/i);
    expect(j(h, 0, "7")).toMatch(/pisah/i);
    // saksi 2 bermodus "sama" tidak berubah
    expect(j(h, 1, "5")).not.toMatch(/tidak|bukan/i);
    expect(JSON.stringify(h)).not.toMatch(/aleta/i);
  });

  it("ragu: sebab, cara tahu, waktu, dan keadaan rumah tangga dijawab ragu tanpa angka dan tanggal", () => {
    const h = susunLama("ragu");
    for (const no of ["2", "3", "4", "5", "6"]) {
      const t = j(h, 0, no);
      expect(t, no).toMatch(/ragu|lupa|kurang (yakin|jelas|ingat|pasti)|tidak (terlalu )?(yakin|ingat)|samar|kabur|mengira-ngira/i);
      expect(t, no).not.toMatch(/\d/);
    }
    expect(j(h, 0, "3")).not.toContain("Maret 2023");
    expect(j(h, 1, "3")).toContain("Maret 2023");
  });

  it("dua saksi bermodus sama tidak berbunyi sama (ragam), dan hasil deterministik", () => {
    const h = bot.susunKeteranganSaksiSdg({ templat: TEMPLAT, posita: POSITA, alasan: ["judi"], pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara: "5/Pdt.G/2026/PA.Dgl", kodeKumpulan: "", jenisPerkara: "347", alur: "15", modus: { saksi1: { modus: "mendengar", sumber: "penggugat", alasan: [] }, saksi2: { modus: "mendengar", sumber: "penggugat", alasan: [] } } });
    expect(j(h, 0, "5")).not.toBe(j(h, 1, "5"));
    expect(JSON.stringify(susunLama("ragu"))).toBe(JSON.stringify(susunLama("ragu")));
  });
});

describe("pengisi jawaban bersumber: pekerjaan pihak dan puncak perselisihan", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const isi = require(path.resolve(REPO, "aleta_bot/services/isiJawabanSaksi.js")) as any;
  const fakta = () =>
    isi.bangunFakta({
      sipp: { pihak1: [{ pekerjaan: "Mengurus Rumah Tangga", alamat: "Desa A" }], pihak2: [{ pekerjaan: "Buruh Harian Lepas", alamat: "Desa B" }] },
      cerai: { puncak: "akhir Februari 2025", puncakPeristiwa: "Penggugat pergi meninggalkan kediaman bersama" },
      sebutan: { P: "Penggugat", T: "Tergugat" },
    });
  const ctx = { jenis: "cg", P: "Penggugat", T: "Tergugat", ke: 1 };

  it("'X bekerja sebagai ...' diisi dari pekerjaan di SIPP menurut pihaknya, dengan sumber dan keyakinan", () => {
    const r = isi.isiJawaban({ tanya: "Apa pekerjaan Tergugat?", jawab: "Tergugat bekerja sebagai ..., penghasilannya kira-kira Rp... setiap bulan;" }, fakta(), ctx);
    expect(r.teks).toContain("Tergugat bekerja sebagai buruh harian lepas");
    expect(r.sumber).toBe("data SIPP");
    expect(r.yakin).toBe("cukup");
    const p = isi.isiJawaban({ tanya: "Apa pekerjaan Penggugat?", jawab: "Penggugat bekerja sebagai ... dan masih mempunyai waktu untuk mengasuh anak;" }, fakta(), ctx);
    expect(p.teks).toContain("Penggugat bekerja sebagai mengurus rumah tangga");
  });

  it("slot {waktu} dan {peristiwa} pada pertanyaan puncak diisi dari gugatan; pada pertanyaan lain dibiarkan", () => {
    const r = isi.isiPlaceholder("puncak pertengkaran terjadi pada {waktu} ketika {peristiwa}", "Apakah ada kejadian yang menjadi puncak perselisihan?", { nilai: (k: string) => ({ puncak: "akhir Februari 2025", puncakPeristiwa: "Penggugat pergi" } as any)[k] ?? null }, ctx);
    expect(r).toBe("puncak pertengkaran terjadi pada akhir Februari 2025 ketika Penggugat pergi");
    const lain = isi.isiPlaceholder("terjadi pada {waktu}", "Sejak kapan kekerasan itu terjadi?", { nilai: () => "x" }, ctx);
    expect(lain).toBe("terjadi pada {waktu}");
  });
});
