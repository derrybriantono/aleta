// @vitest-environment node
/**
 * ============================================================================
 * P1 RAK PERATURAN + PEMERIKSA KUTIPAN DASAR HUKUM (1 Nov 2026, keputusan pengguna 89-B5 & 90-P1)
 * ============================================================================
 *
 *   1. Pembaca rujukan: bentuk yang dipakai blangko Derry (ayat/huruf/angka, daftar & rentang pasal, "jo.", penjelasan, kutipan).
 *   2. Pencocokan dengan rak: rujukan & kutipan benar = tanpa temuan; ayat salah; huruf salah; pasal tak dikenal; kutipan beda;
 *      kutipan milik sumber lain (kaidah/SEMA) tidak dibandingkan.
 *   3. Rak: tiap entri terverifikasi bersumber & berbunyi; tiga naskah B5 (SEMA 6/1983, MK 69/PUU-XIII/2015, HIR 197).
 *   4. ALETA Ai: hanya pasal terverifikasi yang boleh disarankan.
 *   5. Panel "Periksa sebelum cetak" (ekstensi): butir dasar hukum tampil sebagai info, tanpa butir bila tidak ada temuan.
 *   6. Kinerja: indeks sekali; satu putusan panjang diperiksa jauh di bawah batas; masukan patologis tetap linear.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { bolehDisarankan, indeksRak, periksaNaskah, saringSaranAi } from "@/lib/rak-peraturan/indeks";
import { jenisInfo, skorKutipan } from "@/lib/rak-peraturan/periksa";
import { temukanRujukan } from "@/lib/rak-peraturan/rujukan";

const masalah = (teks: string) => periksaNaskah(teks).filter((t) => !jenisInfo(t.jenis));

describe("1. pembaca rujukan", () => {
  it("membaca ayat, huruf, angka, daftar pasal, rentang, jo., dan penjelasan", () => {
    const t =
      'Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 19 huruf f Peraturan Pemerintah Nomor 9 Tahun 1975 jo. Pasal 116 huruf (f) Kompilasi Hukum Islam; Pasal 171, 172 ayat (2) dan 175 RBg; Pasal 39 sampai dengan Pasal 44 KHI; Pasal 154 ayat (2) dan ayat (3) R.Bg.; Penjelasan Pasal 49 huruf a angka 20 UU 3/2006; Pasal 3 ayat (2)(3) PP 10/1983; Pasal 87 ayat 1 dan 2 KHI; Pasal 4 ayat (1) jo. Pasal 17 ayat (1) PERMA Nomor 1 Tahun 2016';
    const r = temukanRujukan(t);
    const ringkas = r.map((x) => [x.peraturan, x.butir.map((b) => `${b.pasal}${b.ayat.length ? `(${b.ayat.join(",")})` : ""}${b.huruf.join("")}${b.rentangKe ? `-${b.rentangKe}` : ""}${b.angka.length ? `#${b.angka}` : ""}`).join("+"), x.penjelasan, Boolean(x.ikutBerikut)]);
    expect(ringkas).toEqual([
      ["UU-1-1974", "39(2)", false, false],
      ["PP-9-1975", "19f", false, false],
      ["KHI", "116f", false, false],
      ["RBG", "171+172(2)+175", false, false],
      ["KHI", "39-44", false, false],
      ["RBG", "154(2,3)", false, false],
      ["UU-3-2006", "49a#20", true, false],
      ["PP-10-1983", "3(2,3)", false, false],
      ["KHI", "87(1,2)", false, false],
      ["PERMA-1-2016", "4(1)", false, true],
      ["PERMA-1-2016", "17(1)", false, false],
    ]);
  });

  it("kutipan diambil sesudah kata pemicu; kutipan yang didahului sumber lain (kaidah, SEMA) tidak dianggap bunyi pasal", () => {
    const [a] = temukanRujukan('Pasal 116 huruf f Kompilasi Hukum Islam yang berbunyi: "antara suami dan isteri terus menerus terjadi perselisihan"');
    expect(a.kutipan).toBe("antara suami dan isteri terus menerus terjadi perselisihan");
    const [b] = temukanRujukan("Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974, dan kaidah fikih yang berbunyi: “Menolak kemudaratan lebih diutamakan daripada meraih kemaslahatan”");
    expect(b.kutipan).toBeNull();
    const [c] = temukanRujukan('Pasal 148 RBg jo. Surat Edaran Mahkamah Agung Nomor 1 Tahun 2022 angka 5 huruf a yang berbunyi "Pihak Penggugat yang pernah hadir pada sidang pertama"');
    expect(c.kutipan).toBeNull();
    // Petik penutup terlupa: kutipan berakhir di titik koma sebelum butir berikutnya.
    const [d] = temukanRujukan("Pasal 149 huruf a Kompilasi Hukum Islam bahwa “Bilamana perkawinan putus karena talak, maka bekas suami wajib memberikan mut’ah yang layak; - Bahwa Majelis mengetengahkan firman “Senangkanlah hati mereka”");
    expect(d.kutipan).toBe("Bilamana perkawinan putus karena talak, maka bekas suami wajib memberikan mut’ah yang layak");
  });
});

describe("2. pencocokan dengan rak", () => {
  it("rujukan dan kutipan yang benar: tanpa temuan", () => {
    const t =
      "Menimbang, bahwa berdasarkan Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 116 huruf f Kompilasi Hukum Islam yang berbunyi: “antara suami dan isteri terus menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga”, gugatan beralasan; Pasal 35 ayat (2) Undang-Undang Nomor 1 Tahun 1974 menyatakan “Harta bawaan dari masing-masing suami dan isteri dan harta benda yang di peroleh masing-masing sebagai hadiah atau warisan, adalah di bawah penguasaan masing-masing sepanjang para pihak tidak menentukan lain”;";
    expect(masalah(t)).toEqual([]);
  });

  it("ayat yang tidak ada ditandai PASTI bila pasalnya terverifikasi", () => {
    const [t] = masalah("berdasarkan Pasal 39 ayat (4) Undang-Undang Nomor 1 Tahun 1974");
    expect(t.jenis).toBe("ayat-tak-ada");
    expect(t.pasti).toBe(true);
    expect(t.pesan).toMatch(/tidak memiliki ayat \(4\) - ayatnya \(1\), \(2\), \(3\)/);
  });

  it("huruf yang tidak ada (temuan blangko Derry: Pasal 58 ayat (1) huruf c KHI; Pasal 7 ayat (4) huruf a KHI)", () => {
    const t = masalah("Pasal 58 ayat (1) huruf b dan huruf c Kompilasi Hukum Islam; Pasal 7 ayat (4) huruf a Kompilasi Hukum Islam");
    expect(t.map((x) => [x.jenis, x.pasti])).toEqual([
      ["huruf-tak-ada", true],
      ["huruf-tak-ada", true],
    ]);
    expect(t[0].pesan).toMatch(/tidak memiliki huruf c - hurufnya a, b/);
    expect(t[1].pesan).toMatch(/Pasal 7 ayat \(4\) Kompilasi Hukum Islam tidak memuat huruf/);
  });

  it("pasal tak dikenal: nomor di luar peraturan = pasal-tidak-ada (pasti); peraturan di luar rak = info saja", () => {
    const [a] = masalah("Pasal 70 Undang-Undang Nomor 1 Tahun 1974");
    expect(a).toMatchObject({ jenis: "pasal-tidak-ada", pasti: true });
    const [b] = masalah("Pasal 245 Kompilasi Hukum Islam");
    expect(b).toMatchObject({ jenis: "pasal-tidak-ada", pasti: true });
    expect(masalah("Pasal 5 Peraturan Mahkamah Agung Nomor 9 Tahun 2099")).toEqual([]);
    const semua = periksaNaskah("Pasal 5 Peraturan Mahkamah Agung Nomor 9 Tahun 2099");
    expect(semua.map((x) => x.jenis)).toEqual(["peraturan-belum-di-rak"]);
  });

  it("kutipan beda: bunyi ayat lain (temuan blangko HB: Pasal 35 ayat (1) dikutip bunyi ayat (2)) dan bunyi yang diubah", () => {
    const [a] = masalah(
      "berdasarkan Pasal 35 ayat (1) Undang-Undang Nomor 1 Tahun 1974 Tentang Perkawinan disebutkan “Harta bawaan dari masing-masing suami isteri dan harta benda yang di peroleh masing-masing sebagai hadiah atau warisan adalah di bawah penguasaan masing-masing sepanjang para pihak tidak menentukan lain”"
    );
    expect(a).toMatchObject({ jenis: "kutipan-beda", pasti: true });
    expect(a.pesan).toMatch(/bukan di ayat\/huruf yang dirujuk/);
    const [b] = masalah("Pasal 7 ayat (1) Undang-Undang Nomor 16 Tahun 2019 yang menyatakan bahwa, “Perkawinan hanya diizinkan jika pihak pria dan wanita sudah mencapai usia 19 tahun”");
    expect(b).toMatchObject({ jenis: "kutipan-beda", pasti: true });
    expect(b.pesan).toMatch(/tidak sesuai bunyi Pasal 7 ayat \(1\)/);
  });

  it("skor kutipan tahan ejaan (isteri/istri, di bawah/dibawah) dan kutipan sebagian", () => {
    expect(skorKutipan("di bawah penguasaan masing-masing", "adalah dibawah penguasaan masing-masing")).toBe(1);
    expect(skorKutipan("terus menerus ... tidak ada harapan", "terus menerus terjadi perselisihan dan tidak ada harapan")).toBe(1);
    expect(skorKutipan("Menolak kemudaratan lebih diutamakan", "Perceraian hanya dapat dilakukan didepan Sidang")).toBeLessThan(0.2);
  });

  it("terjemahan (KUHPerdata/HIR/RBg): kutipan beda kata tidak pasti salah; pasal RBg belum terverifikasi tidak menghasilkan temuan pasti", () => {
    const t = periksaNaskah("Pasal 1865 Kitab Undang-Undang Hukum Perdata yang berbunyi: “Barang siapa yang mendalilkan mempunyai suatu hak wajib membuktikan adanya hak itu”");
    expect(t.filter((x) => x.pasti)).toEqual([]);
    const r = periksaNaskah("Pasal 149 ayat (1) RBg");
    expect(r.filter((x) => x.pasti)).toEqual([]);
    expect(r.map((x) => x.jenis)).toContain("belum-terverifikasi");
  });

  it("HIR 197 berayat (1)-(9) menurut urutan paragraf: ayat (6) ada, ayat (10) tidak", () => {
    expect(masalah("Pasal 197 ayat (6) HIR")).toEqual([]);
    expect(masalah("Pasal 197 ayat (10) HIR")[0]).toMatchObject({ jenis: "ayat-tak-ada", pasti: true });
  });

  it("naskah tidak diubah dan temuan digabung per kemunculan", () => {
    const t = "Pasal 39 ayat (4) Undang-Undang Nomor 1 Tahun 1974; lagi Pasal 39 ayat (4) Undang-Undang Nomor 1 Tahun 1974";
    const salin = String(t);
    const [x] = masalah(t);
    expect(x.jumlah).toBe(2);
    expect(t).toBe(salin);
  });
});

describe("3. rak peraturan", () => {
  const rak = indeksRak().rak;
  it("tiap entri terverifikasi berbunyi dan bersumber; sumbernya terdaftar dengan URL dan tanggal akses", () => {
    for (const p of rak.pasal) {
      if (p.status !== "terverifikasi") continue;
      expect(p.bunyi.trim(), `${p.peraturan} ${p.pasal}`).not.toBe("");
      expect(p.sumber.length, `${p.peraturan} ${p.pasal}`).toBeGreaterThan(0);
      for (const s of p.sumber) expect(rak.sumber[s], s).toBeTruthy();
    }
    for (const [k, s] of Object.entries(rak.sumber)) {
      expect(s.url, k).toBeTruthy();
      expect(s.diakses, k).toMatch(/2026-1[01]-\d{2}/);
    }
    const n = rak.pasal.filter((p) => p.status === "terverifikasi").length;
    expect(n).toBeGreaterThan(500);
  });

  it("entri tanpa naskah tetap 'belum' dan tanpa bunyi karangan", () => {
    for (const p of rak.pasal) if (!p.bunyi) expect(p.status).toBe("belum");
    const per = rak.pasal.filter((p) => p.peraturan === "PERMA-1-2016");
    expect(per.length).toBeGreaterThan(0);
    for (const p of per) expect([p.status, p.bunyi]).toEqual(["belum", ""]);
  });

  it("B5: MK 69/PUU-XIII/2015 (amar terverifikasi), SEMA 6/1983 (judul terverifikasi, isi belum), HIR 197 (9 ayat)", () => {
    const d = new Map((rak.dokumen || []).map((x) => [x.kode, x]));
    const mk = d.get("MK-69-PUU-XIII-2015")!;
    expect(mk.status).toBe("terverifikasi");
    expect(mk.bunyi).toContain("Pada waktu, sebelum dilangsungkan atau selama dalam ikatan perkawinan kedua belah pihak atas persetujuan bersama dapat mengajukan perjanjian tertulis");
    expect(mk.catatan).toMatch(/27 Oktober 2016/);
    expect(rak.sumber[mk.sumber[0]].url).toBe("https://s.mkri.id/public/content/persidangan/putusan/69_PUU-XIII_2015.pdf");
    const sema = d.get("SEMA-6-1983")!;
    expect(sema.status).toBe("belum");
    expect(sema.nama).toMatch(/Penyempurnaan Surat Edaran Nomor 2 Tahun 1979/);
    const hir = rak.pasal.find((p) => p.peraturan === "HIR" && p.pasal === "197")!;
    expect(hir.status).toBe("terverifikasi");
    expect(hir.bunyi.split("\n").map((b) => b.slice(0, 3))).toEqual(["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", "(9)"]);
    expect(hir.bunyi).toMatch(/\(6\) Di waktu melakukan penyitaan itu ia dibantu oleh dua orang saksi/);
    const u29 = rak.pasal.find((p) => p.peraturan === "UU-1-1974" && p.pasal === "29")!;
    expect(u29.catatan).toMatch(/69\/PUU-XIII\/2015/);
  });
});

describe("4. ALETA Ai: hanya pasal terverifikasi yang boleh disarankan", () => {
  it("terverifikasi lolos; belum terverifikasi, ayat salah, dan bukan rujukan ditolak", () => {
    expect(bolehDisarankan("Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974").boleh).toBe(true);
    expect(bolehDisarankan("Pasal 116 huruf f KHI").boleh).toBe(true);
    expect(bolehDisarankan("Pasal 149 ayat (1) RBg")).toMatchObject({ boleh: false });
    expect(bolehDisarankan("Pasal 39 ayat (4) UU 1/1974").sebab).toMatch(/tidak memiliki ayat \(4\)/);
    expect(bolehDisarankan("asas kepentingan terbaik anak").boleh).toBe(false);
    const s = saringSaranAi(["Pasal 116 huruf f Kompilasi Hukum Islam", "Pasal 82 ayat (4) Undang-Undang Nomor 7 Tahun 1989", "Pasal 70 UU 1/1974"]);
    expect(s.boleh).toEqual(["Pasal 116 huruf f Kompilasi Hukum Islam"]);
    expect(s.ditolak.map((x) => x.teks)).toEqual(["Pasal 82 ayat (4) Undang-Undang Nomor 7 Tahun 1989", "Pasal 70 UU 1/1974"]);
  });
});

describe("5. Periksa sebelum cetak (ekstensi)", () => {
  const kode = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/blangko-derry-periksa.js"), "utf8");
  const ctx = vm.createContext({});
  vm.runInContext(kode, ctx);
  const PC = (ctx as { AletaPeriksaCetak: { kumpulkan: (b: unknown) => Array<{ jenis: string; teks: string; perbaiki: unknown }> } }).AletaPeriksaCetak;

  it("temuan rute periksa-kutipan tampil sebagai butir dasar hukum (pasti / perlu dicek), membuka pratinjau", () => {
    const d = PC.kumpulkan({
      kutipan: {
        temuan: [
          { jenis: "huruf-tak-ada", pasti: true, rujukan: "Pasal 58 ayat (1) huruf c KHI", pesan: "Pasal 58 ayat (1) Kompilasi Hukum Islam tidak memiliki huruf c - hurufnya a, b.", jumlah: 1 },
          { jenis: "kutipan-beda", pasti: false, rujukan: "Pasal 148 RBg", pesan: "Bunyi yang dikutip tidak sesuai.", jumlah: 3 },
        ],
        lebih: 0,
      },
    });
    expect(d.map((x) => x.teks)).toEqual([
      "Dasar hukum: Pasal 58 ayat (1) Kompilasi Hukum Islam tidak memiliki huruf c - hurufnya a, b.",
      "Dasar hukum (perlu dicek): Bunyi yang dikutip tidak sesuai. (3 tempat)",
    ]);
    expect(d[0]).toMatchObject({ jenis: "kutipan-huruf-tak-ada", perbaiki: { aksi: "pratinjau" } });
  });

  it("tanpa temuan (atau rute belum menjawab) tidak ada butir dasar hukum; lebih dari 6 diringkas", () => {
    expect(PC.kumpulkan({ kutipan: null })).toEqual([]);
    expect(PC.kumpulkan({ kutipan: { temuan: [], lebih: 0 } })).toEqual([]);
    const banyak = Array.from({ length: 9 }, (_, i) => ({ jenis: "ayat-tak-ada", pasti: true, rujukan: `Pasal ${i}`, pesan: `p${i}`, jumlah: 1 }));
    const d = PC.kumpulkan({ kutipan: { temuan: banyak, lebih: 2 } });
    expect(d.length).toBe(7);
    expect(d[6].teks).toBe("5 catatan dasar hukum lain.");
  });

  it("panel meminta pemeriksaan sekali per naskah (kunci sidik|saat), bukan tiap ketikan", () => {
    const isian = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/blangko-derry-isian.js"), "utf8");
    const awal = isian.indexOf("function kutipanUntukPeriksa(");
    const fungsi = isian.slice(awal, isian.indexOf("\n  }\n", awal));
    expect(fungsi).toMatch(/if \(kutipanPeriksa\.kunci === kunci\) return kutipanPeriksa\.data;/);
    expect(fungsi).toMatch(/API_KUTIPAN/);
  });
});

describe("6. kinerja", () => {
  it("indeks dibangun sekali; satu putusan panjang (±200 rb aksara) diperiksa < 150 ms", () => {
    expect(indeksRak()).toBe(indeksRak());
    const paragraf =
      "Menimbang, bahwa berdasarkan Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 19 huruf f Peraturan Pemerintah Nomor 9 Tahun 1975 jo. Pasal 116 huruf f Kompilasi Hukum Islam yang berbunyi: “antara suami dan isteri terus menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga”, serta Pasal 171, 172 dan 175 RBg, maka keterangan saksi-saksi tersebut telah memenuhi syarat formil dan materiil sebagai alat bukti; ";
    const naskah = paragraf.repeat(Math.ceil(200_000 / paragraf.length));
    periksaNaskah(naskah); // pemanasan JIT
    const a = performance.now();
    const t = periksaNaskah(naskah);
    const ms = performance.now() - a;
    expect(t.filter((x) => !jenisInfo(x.jenis))).toEqual([]);
    expect(ms).toBeLessThan(150);
  });

  it("masukan patologis (daftar pasal sangat panjang, petik tanpa penutup) tetap linear", () => {
    const a = performance.now();
    periksaNaskah(`Pasal ${"1, ".repeat(20_000)}2 KHI yang berbunyi: "${"x ".repeat(50_000)}`);
    periksaNaskah(`${"Pasal 3 ayat (1) ".repeat(10_000)}`);
    expect(performance.now() - a).toBeLessThan(400);
  });
});
