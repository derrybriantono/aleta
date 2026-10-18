// @vitest-environment node
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * SAKSI YANG DIAJUKAN TERGUGAT - harta bersama dan kewarisan (keputusan 56)
 * ============================================================================
 *
 * Katalog tambahan harta-bersama-tergugat dan kewarisan-tergugat berisi butir `pihakSaksi: ["T"]` yang
 * `menggantikan` butir utama yang arahnya dalil Penggugat, dan hanya aktif bila bantahan Tergugat ditandai.
 * Yang dijaga: arah butir tiap pihak, penggantian bersyarat, urutan, tujuh jenis keterangan, dua sampai lima saksi,
 * perilaku Penggugat tidak berubah, tanpa "Aleta" dan tanpa kode yang tampil.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mesin = require(path.join(AKAR, "saksi-katalog.js")) as any;
const FOLDER = path.join(AKAR, "saksi-katalog");
const katalog: any[] = readdirSync(FOLDER)
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => JSON.parse(readFileSync(path.join(FOLDER, n), "utf8")))
  .filter((k) => !k.contoh);

const KAMUS = process.env.ALETA_ABT_VARIABEL || "D:/Aplikasi/aleta/tmp/abt-variabel.json";
const variabelAda: Set<string> | null = existsSync(KAMUS) ? new Set(Object.keys(JSON.parse(readFileSync(KAMUS, "utf8")))) : null;

const NILAI: Record<string, string> = { "0046": "Penggugat", "0047": "Tergugat", "2026": "almarhum", "1025": "Fulan", "8730": "sebidang tanah", "8717": "tiga orang anak" };
const v = (k: string) => NILAI[k] ?? "";

const HB = Mesin.kenaliPaket(katalog, { jenisPerkaraId: "348", alurPerkaraId: "15" });
const HB_UTAMA = Mesin.kenaliKatalog(katalog, { jenisPerkaraId: "348", alurPerkaraId: "15" });
const WR = Mesin.kenaliPaket(katalog, { jenisPerkaraId: "364", alurPerkaraId: "15" });
const WR_UTAMA = Mesin.kenaliKatalog(katalog, { jenisPerkaraId: "364", alurPerkaraId: "15" });

const JENIS = ["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"];

function susun(kat: any, saksi: any[], keadaan: Record<string, unknown> = {}, benih = "7/Pdt.G/2026/PA.Dgl") {
  return Mesin.susunSaksi(kat, { keadaan: { kehadiran: "kontradiktoir", ...keadaan }, benih, saksi, variabel: v });
}
const ids = (h: any, i: number) => h.saksi[i].baris.map((b: any) => b.butir) as string[];

describe("katalog tambahan Tergugat menempel pada harta bersama dan kewarisan", () => {
  it("terdaftar sebagai tambahan, tidak berdiri sendiri, dan digabung ke paketnya", () => {
    for (const [kunci, utama] of [["harta-bersama-tergugat", "harta-bersama"], ["kewarisan-tergugat", "kewarisan"]] as const) {
      const k = katalog.find((x) => x.kunci === kunci);
      expect(k, kunci).toBeTruthy();
      expect(k.tambahanUntuk).toEqual([utama]);
      expect(k.jenisKatalog).toBeUndefined();
    }
    expect(HB.digabungDari).toContain("harta-bersama-tergugat");
    expect(WR.digabungDari).toContain("kewarisan-tergugat");
    expect(HB.pertanyaan.length).toBe(HB_UTAMA.pertanyaan.length + 7);
    expect(WR.pertanyaan.length).toBe(WR_UTAMA.pertanyaan.length + 5);
  });

  it("paket gabungan lolos skema: id dan urutan tidak bentrok, butir yang digantikan ada", () => {
    for (const paket of [HB, WR]) {
      const r = Mesin.periksaKatalog(paket, { variabelAda });
      expect(r.galat, paket.kunci).toEqual([]);
      const urut = paket.pertanyaan.map((q: any) => q.urutan);
      expect(new Set(urut).size).toBe(urut.length);
    }
  });

  it("butir pengganti duduk tepat di belakang butir yang digantikannya", () => {
    const urutan = (paket: any, id: string) => paket.pertanyaan.find((q: any) => q.id === id).urutan;
    expect(urutan(HB, "q-tg-sudah-dibagi")).toBe(urutan(HB, "q-belum-terbagi") + 1);
    expect(urutan(HB, "q-tg-asal-bawaan")).toBe(urutan(HB, "q-bukan-bawaan") + 1);
    expect(urutan(WR, "q-tg-sudah-dibagi-waris")).toBe(urutan(WR, "q-belum-dibagi") + 1);
  });

  it("pemeriksa menolak penggantian butir yang tidak ada dan format yang salah", () => {
    const rusak = JSON.parse(JSON.stringify(HB));
    rusak.pertanyaan.find((q: any) => q.id === "q-tg-sudah-dibagi").menggantikan = ["q-tidak-ada"];
    expect(Mesin.periksaKatalog(rusak, { variabelAda }).galat.join(" ")).toMatch(/menggantikan butir "q-tidak-ada" yang tidak ada/);
    const salah = JSON.parse(JSON.stringify(HB));
    salah.pertanyaan.find((q: any) => q.id === "q-tg-sudah-dibagi").menggantikan = "q-belum-terbagi";
    expect(Mesin.periksaKatalog(salah, { variabelAda }).galat.join(" ")).toMatch(/menggantikan harus daftar id/);
  });

  it("nilai bantahan baru dan tulisannya ikut tergabung; tulisan milik katalog utama tidak ditimpa", () => {
    const hb = HB.keadaan.bantahan;
    for (const n of ["sudah-dibagi", "sudah-dihibahkan", "utang-bersama", "pisah-harta"]) expect(hb.nilai).toContain(n);
    expect(hb.labelNilai["sudah-dibagi"]).toBe("harta sudah dibagi");
    expect(hb.label).toBe(HB_UTAMA.keadaan.bantahan.label);
    const wr = WR.keadaan.bantahan;
    for (const n of ["ahli-waris-lain", "utang-pewaris"]) expect(wr.nilai).toContain(n);
    expect(wr.nilai).toContain("bukan-ahli-waris");
  });
});

describe("arah butir menurut siapa yang mengajukan saksi", () => {
  const P = { pihak: "P" };
  const T = { pihak: "T" };

  it("saksi Penggugat tidak berubah sama sekali oleh katalog tambahan Tergugat (hasil sama dengan katalog utama)", () => {
    for (const [paket, utama, keadaan] of [
      [HB, HB_UTAMA, { bantahan: ["sudah-dibagi", "bawaan-hibah-warisan"] }],
      [WR, WR_UTAMA, { bantahan: ["sudah-dibagi-atau-dihibahkan"] }],
    ] as const) {
      const a = susun(paket, [P, P, P], keadaan);
      const b = susun(utama, [P, P, P], keadaan);
      expect(JSON.stringify(a.saksi)).toBe(JSON.stringify(b.saksi));
    }
  });

  it("harta bersama: bantahan 'sudah dibagi' - saksi Tergugat mendapat versi Tergugat dan tidak 'belum terbagi'", () => {
    const h = susun(HB, [P, T], { bantahan: ["sudah-dibagi"] });
    expect(ids(h, 1)).toContain("q-tg-sudah-dibagi");
    expect(ids(h, 1)).not.toContain("q-belum-terbagi");
    expect(ids(h, 0)).toContain("q-belum-terbagi");
    expect(ids(h, 0)).not.toContain("q-tg-sudah-dibagi");
    const baris = h.saksi[1].baris.find((b: any) => b.butir === "q-tg-sudah-dibagi");
    expect(baris.jawab).toMatch(/sudah dibagi|telah dilakukan|sepakat membagi|sudah diserahkan/);
    expect(baris.jawab).not.toMatch(/belum pernah dibagi/);
  });

  it("tanpa bantahan yang ditandai, saksi Tergugat memakai butir utama seperti sebelumnya", () => {
    const h = susun(HB, [P, T], {});
    const utama = susun(HB_UTAMA, [P, T], {});
    expect(ids(h, 1)).toEqual(ids(utama, 1));
    expect(ids(h, 1).some((i) => i.startsWith("q-tg-"))).toBe(false);
  });

  it("harta bersama: tiap bantahan mengaktifkan butir dan menggantikan butir yang tepat", () => {
    const kasus: Array<[string, string, string[]]> = [
      ["bawaan-hibah-warisan", "q-tg-asal-bawaan", ["q-bukan-bawaan", "q-dalil-bawaan"]],
      ["sebelum-menikah", "q-tg-waktu-sebelum-menikah", ["q-waktu-perolehan"]],
      ["sudah-dibagi", "q-tg-sudah-dibagi", ["q-belum-terbagi"]],
      ["sudah-dijual-dijaminkan", "q-tg-dialihkan", ["q-dijual-dijaminkan", "q-dalil-dialihkan"]],
      ["sudah-dihibahkan", "q-tg-dialihkan", ["q-dijual-dijaminkan", "q-dalil-dialihkan"]],
      ["milik-pihak-ketiga", "q-tg-dialihkan", ["q-dijual-dijaminkan", "q-dalil-dialihkan"]],
      ["utang-bersama", "q-tg-utang-bersama", ["q-utang-bersama"]],
      ["pisah-harta", "q-tg-pisah-harta", ["q-perjanjian-kawin"]],
    ];
    for (const [bantahan, baru, lama] of kasus) {
      const h = susun(HB, [P, T], { bantahan: [bantahan], jenisObjek: ["tanah-bangunan", "utang"] });
      expect(ids(h, 1), bantahan).toContain(baru);
      for (const l of lama) expect(ids(h, 1), `${bantahan} -> ${l}`).not.toContain(l);
      expect(ids(h, 0), bantahan).not.toContain(baru);
    }
  });

  it("bantahan 'sudah dijual', 'milik pihak ketiga', dan 'sudah dihibahkan' menghasilkan kalimat yang berbeda arah", () => {
    const jawab = (bantahan: string) => susun(HB, [P, T], { bantahan: [bantahan] }).saksi[1].baris.find((b: any) => b.butir === "q-tg-dialihkan").jawab as string;
    expect(jawab("sudah-dijual-dijaminkan")).toMatch(/dijual|dijaminkan|jaminan|berpindah tangan/);
    expect(jawab("milik-pihak-ketiga")).toMatch(/pihak lain|orang lain|milik/);
    expect(jawab("sudah-dihibahkan")).toMatch(/hibah/);
  });

  it("kewarisan: sudah dibagi, hibah, bukan harta pewaris, ahli waris lain, dan utang pewaris menggantikan butir arah Penggugat", () => {
    const kasus: Array<[string, string, string[]]> = [
      ["sudah-dibagi-atau-dihibahkan", "q-tg-sudah-dibagi-waris", ["q-belum-dibagi", "q-dalil-sudah-dibagi"]],
      ["sudah-dibagi-atau-dihibahkan", "q-tg-hibah-pewaris", ["q-wasiat-hibah"]],
      ["bukan-harta-pewaris", "q-tg-bukan-harta-pewaris", ["q-asal-harta", "q-dalil-bukan-harta"]],
      ["ahli-waris-lain", "q-tg-ahli-waris-lain", ["q-ahli-waris-daftar"]],
      ["utang-pewaris", "q-tg-utang-pewaris", ["q-utang-pewaris"]],
    ];
    for (const [bantahan, baru, lama] of kasus) {
      const h = susun(WR, [P, T], { bantahan: [bantahan] });
      expect(ids(h, 1), baru).toContain(baru);
      for (const l of lama) expect(ids(h, 1), `${baru} -> ${l}`).not.toContain(l);
      expect(ids(h, 0), baru).toContain(lama[0]);
      expect(ids(h, 0), baru).not.toContain(baru);
    }
  });

  it("dua bantahan sekaligus: kedua butir pengganti aktif", () => {
    const h = susun(HB, [P, T], { bantahan: ["sudah-dibagi", "pisah-harta"] });
    expect(ids(h, 1)).toEqual(expect.arrayContaining(["q-tg-sudah-dibagi", "q-tg-pisah-harta"]));
  });

  it("urutan butir saksi Tergugat naik dan penutup tetap terakhir", () => {
    const h = susun(HB, [P, T], { bantahan: ["sudah-dibagi", "bawaan-hibah-warisan"] });
    const semua = h.saksi[1].baris.map((b: any) => b.butir) as string[];
    expect(semua[semua.length - 1]).toBe("q-penutup");
    const kat = HB.pertanyaan as any[];
    const posisi = semua.slice(0, -1).map((id) => kat.find((q) => q.id === id).urutan);
    expect(posisi).toEqual([...posisi].sort((a, b) => a - b));
  });
});

describe("tujuh jenis keterangan dan dua sampai lima saksi Tergugat", () => {
  const BANTAHAN_HB = ["bawaan-hibah-warisan", "sebelum-menikah", "sudah-dibagi", "sudah-dijual-dijaminkan", "milik-pihak-ketiga", "sudah-dihibahkan", "utang-bersama", "pisah-harta"];
  const BANTAHAN_WR = ["sudah-dibagi-atau-dihibahkan", "bukan-harta-pewaris", "ahli-waris-lain", "utang-pewaris"];

  for (const [nama, paket, bantahan] of [["harta bersama", HB, BANTAHAN_HB], ["kewarisan", WR, BANTAHAN_WR]] as const) {
    it(`${nama}: tiap butir Tergugat punya tujuh jenis keterangan dan setiap jenis menghasilkan kalimat 2 sampai 5 saksi yang berbeda`, () => {
      for (const jumlah of [2, 3, 4, 5]) {
        for (const jenis of [...JENIS, "melihat"]) {
          const saksi = Array.from({ length: jumlah }, () => ({ pihak: "T", jenis }));
          const h = susun(paket, saksi, { bantahan, jenisObjek: ["tanah-bangunan", "utang"] });
          const perButir = new Map<string, string[]>();
          h.saksi.forEach((s: any) => s.baris.forEach((b: any) => {
            if (!b.butir.startsWith("q-tg-")) return;
            perButir.set(b.butir, [...(perButir.get(b.butir) ?? []), Mesin.rapikan(b.jawab)]);
            expect(b.jawab, b.butir).not.toMatch(/#\d{4}#|\{|\}/);
            expect(b.jawab.trim().length).toBeGreaterThan(5);
          }));
          expect(perButir.size).toBeGreaterThanOrEqual(5);
          for (const [butir, jawab] of perButir) expect(new Set(jawab).size, `${nama} ${jumlah} saksi ${jenis} ${butir}: ${jawab.join(" || ")}`).toBe(jawab.length);
          expect(h.peringatan.filter((p: string) => /tidak punya jawaban/.test(p))).toEqual([]);
        }
      }
    });

    it(`${nama}: jenis 'berbeda' pada butir Tergugat tersedia dan bertanda kuning`, () => {
      const butirTg = paket.pertanyaan.filter((q: any) => String(q.id).startsWith("q-tg-"));
      expect(butirTg.length).toBeGreaterThan(0);
      for (const q of butirTg) {
        expect(q.pihakSaksi).toEqual(["T"]);
        expect(q.jawaban.berbeda, q.id).toBeTruthy();
        const o = [].concat(q.jawaban.berbeda)[0] as any;
        expect(o.saksi1.length).toBeGreaterThanOrEqual(4);
        expect(o.saksi2.length).toBeGreaterThanOrEqual(4);
        const objekMelihat = [].concat(q.jawaban.melihat) as any[];
        for (const m of objekMelihat) {
          expect(m.saksi1.length).toBeGreaterThanOrEqual(4);
          expect(m.saksi2.length).toBeGreaterThanOrEqual(4);
        }
      }
      const q = butirTg[0];
      const h = susun(paket, [{ pihak: "P" }, { pihak: "T", berbeda: [q.id] }], { bantahan: [].concat(q.keadaan.bantahan) as string[] });
      const b = h.saksi[1].baris.find((x: any) => x.butir === q.id);
      expect(b.jenis).toBe("berbeda");
      expect(b.tandaKuning).toBe(true);
    });
  }
});

describe("isi katalog Tergugat", () => {
  it("tanpa kata Aleta, tanpa istilah teknis, tanpa kode asing, tanpa rujukan yang belum terverifikasi", () => {
    for (const kunci of ["harta-bersama-tergugat", "kewarisan-tergugat"]) {
      const k = katalog.find((x) => x.kunci === kunci);
      const nilaiTeks: string[] = [];
      const kumpul = (x: unknown) => {
        if (typeof x === "string") nilaiTeks.push(x);
        else if (Array.isArray(x)) x.forEach(kumpul);
        else if (x && typeof x === "object") Object.values(x).forEach(kumpul);
      };
      kumpul([k.pertanyaan, k.catatanPetugas, k.jawabanUmum]);
      const teks = nilaiTeks.join(" | ");
      expect(teks).not.toMatch(/aleta/i);
      expect(teks).not.toMatch(/borang|peladen|galat|template|varian/i);
      expect(Mesin.periksaKatalog(k, { namaBerkas: `${kunci}.json`, variabelAda }).galat, kunci).toEqual([]);
      expect(k.variabelBaru ?? []).toEqual([]);
      for (const d of k.dasarHukum) expect(d.status).toBe("terverifikasi");
    }
  });

  it("teks petugas menyebut sebutan pihak, bukan nama, dan butir Tergugat hanya untuk pihak T", () => {
    for (const paket of [HB, WR]) {
      for (const q of paket.pertanyaan.filter((x: any) => String(x.id).startsWith("q-tg-"))) {
        expect(q.pihakSaksi).toEqual(["T"]);
        expect(Array.isArray(q.menggantikan) && q.menggantikan.length > 0).toBe(true);
        expect(q.keadaan.bantahan).toBeTruthy();
      }
    }
  });
});
