// @vitest-environment node
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CABANG_JAWABAN_MODUS, CERMIN_BAS_SAKSI } from "@/lib/tipe-keluaran/bawaan/bawaan-bas-saksi";
import { batasEntriDaftar } from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * BUTIR 9 (13 OKT 2026) - SEPULUH VARIAN JAWABAN LAGI PER JENIS PERKARA x KEADAAN
 * ============================================================================
 *
 * "Susun keterangan saksi" memakai set pertanyaan kamus pertanyaan-saksi (per
 * jenis perkara) dan dropdown keadaan pengetahuan saksi (modus). Kalimat yang
 * bergantung keadaan itu tinggal di bank JAWABAN_MODUS ragamBasBawaan.js
 * ('kelompok|modus'); banknya tidak bergantung jenis perkara - sebutan pihak
 * hanya lewat {sumber}. Yang dijaga di sini:
 *
 *   1. tiap bank 4 -> >= 14 bentuk; tiap (jenis perkara di kamus x modus) hanya
 *      menjangkau bank ber->= 14 bentuk (matriks dihitung dari kamus sungguhan);
 *   2. tidak ada duplikat, penanda hanya {sumber}/{daftar}/{isi}/{jawab} dan
 *      sama dengan bentuk lama sebanknya, tanpa sebutan/variabel tertulis keras,
 *      aman bagi replace_ket_saksi ABT ('ya, ');
 *   3. bunyinya sesuai keadaan (tahu-pisah tidak mengaku tahu pertengkaran, dst.);
 *   4. varian baru SUNGGUH terpilih (berbenih per perkara), saksi seperkara tetap
 *      berbeda, cetak ulang sama, sebutan cerai talak Pemohon/Termohon;
 *   5. batas entri jawaban-modus portal = bot (400) dan cermin muat.
 */

const AKAR = path.resolve(__dirname, "../../..");
const require_ = createRequire(import.meta.url);
const ragam = require_(path.join(AKAR, "aleta_bot/services/ragamBasBawaan.js")) as { JAWABAN_MODUS: Record<string, string[]> };
type Butir = { no: string; tanya: string; jawab: string; varian: { indeks: number; n: number } };
type Hasil = { saksi: { ke: number; jawaban: Butir[] }[]; tipeKeluaranDitolak?: unknown[] };
const layanan = require_(path.join(AKAR, "aleta_bot/services/abtUsulanService.js")) as {
  jawabMenurutModus: (a: Record<string, unknown>) => string | null;
  susunKeteranganSaksiSdg: (o: Record<string, unknown>) => Hasil;
  bacaBankBas: (o: Record<string, unknown>) => { ditolak: unknown[]; asal: Record<string, string> };
};
const kamus = JSON.parse(fs.readFileSync(path.join(AKAR, "aleta_bot/kamus-deteksi/awal/pertanyaan-saksi.json"), "utf8")) as {
  templat: { kode: string; bagian: string; teks: string; syarat: { jenisPerkaraId?: string[] }; pertanyaan?: { kode: string }[]; belumAdaContoh?: boolean; namaSet?: string }[];
};

const BANK = ragam.JAWABAN_MODUS;
const LAMA = 4; // bentuk per bank sebelum butir 9 (butir 27, 5 Okt 2026)
const TAMBAH = 10;
const MODUS = ["sama", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah"];
const PENANDA = ["{sumber}", "{daftar}", "{isi}", "{jawab}"];
const penandaDari = (s: string) => [...new Set(s.match(/\{[^{}]*\}/g) ?? [])].sort().join(",");
const normal = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const baru = Object.entries(BANK).flatMap(([kunci, isi]) => isi.slice(LAMA).map((nilai) => ({ kunci, nilai })));

/** Matriks jenis perkara (kamus) x modus -> kunci bank yang dijangkau pertanyaan set-setnya. */
function matriks(): Map<string, Set<string>> {
  const tanya = new Map(kamus.templat.filter((t) => t.bagian === "pertanyaan").map((t) => [t.kode, t.teks]));
  const mata: Record<string, string[]> = {};
  for (const k of Object.keys(BANK)) mata[k] = [k];
  const hasil = new Map<string, Set<string>>();
  for (const s of kamus.templat.filter((t) => t.bagian === "set" && !t.belumAdaContoh)) {
    for (const jenis of s.syarat.jenisPerkaraId ?? []) {
      for (const modus of MODUS) {
        for (const q of s.pertanyaan ?? []) {
          const teks = tanya.get(q.kode);
          if (!teks) continue;
          const kunci = layanan.jawabMenurutModus({
            tanya: teks.replace(/#0046#/g, "Penggugat").replace(/#0047#/g, "Tergugat"),
            modus, alasan: ["judi"], daftar: "x", sumber: "y", nomorSaksi: 1, urutan: 0, jawab: "z",
            bank: mata, pilihBentuk: (_b: string[], k: string) => k,
          });
          if (!kunci) continue;
          const sel = `${jenis}|${modus}`;
          if (!hasil.has(sel)) hasil.set(sel, new Set());
          hasil.get(sel)!.add(kunci);
        }
      }
    }
  }
  return hasil;
}

describe("butir 9 - jumlah varian per jenis perkara x keadaan", () => {
  it("20 bank, masing-masing >= lama + 10 bentuk", () => {
    expect(Object.keys(BANK)).toHaveLength(20);
    for (const [kunci, isi] of Object.entries(BANK)) expect(isi.length, kunci).toBeGreaterThanOrEqual(LAMA + TAMBAH);
    expect(baru).toHaveLength(20 * TAMBAH);
  });

  it("tiap jenis perkara x keadaan di kamus hanya menjangkau bank >= lama + 10; cerai talak & gugat x 6 keadaan terjangkau", () => {
    const m = matriks();
    for (const jenis of ["346", "347"]) for (const modus of MODUS) expect(m.has(`${jenis}|${modus}`), `${jenis}|${modus}`).toBe(true);
    for (const [sel, kunciSet] of m) {
      for (const kunci of kunciSet) expect(BANK[kunci]?.length ?? 0, `${sel} -> ${kunci}`).toBeGreaterThanOrEqual(LAMA + TAMBAH);
    }
  });

  it("setiap kunci bank punya cabang kode (CABANG_JAWABAN_MODUS)", () => {
    expect(Object.keys(BANK).sort()).toEqual(Object.keys(CABANG_JAWABAN_MODUS).sort());
  });
});

describe("butir 9 - bentuk teks varian baru", () => {
  it("tanpa duplikat: dalam bank, dan varian baru tidak sama dengan kalimat mana pun", () => {
    for (const [kunci, isi] of Object.entries(BANK)) expect(new Set(isi.map(normal)).size, kunci).toBe(isi.length);
    const semua = Object.values(BANK).flat().map(normal);
    for (const b of baru) expect(semua.filter((s) => s === normal(b.nilai)), b.nilai).toHaveLength(1);
  });

  it("penanda sah dan sama dengan bentuk lama sebanknya; tanpa sebutan/variabel tertulis keras", () => {
    for (const b of baru) {
      for (const p of b.nilai.match(/\{[^{}]*\}/g) ?? []) expect(PENANDA, `${b.kunci}: ${b.nilai}`).toContain(p);
      expect(penandaDari(b.nilai), `${b.kunci}: ${b.nilai}`).toBe(penandaDari(BANK[b.kunci][0]));
      expect(b.nilai, b.nilai).not.toMatch(/#\d{4}#|\b(penggugat|tergugat|pemohon|termohon)\b/i);
      expect(b.nilai, b.nilai).not.toMatch(/[<\n\r]|\$\{/);
    }
  });

  it("aman bagi ABT: 20-240 huruf, tanpa '...ya, ' (replace_ket_saksi), tanpa titik/koma ganda di ujung", () => {
    for (const b of baru) {
      expect(b.nilai.length, b.nilai).toBeGreaterThanOrEqual(20);
      expect(b.nilai.length, b.nilai).toBeLessThanOrEqual(240);
      expect(b.nilai.replace(/\bsaya, /gi, ""), b.nilai).not.toMatch(/ya, /i);
      expect(b.nilai, b.nilai).not.toMatch(/[.;,]$|^\s|\s$|\s{2}/);
    }
  });
});

describe("butir 9 - bunyi sesuai keadaan pengetahuan saksi", () => {
  const TAK_TAHU = /tidak (pernah )?(mengetahui|tahu|saya ketahui)|tidak (pernah )?saya ketahui|tidak dapat menerangkan/i;
  const aturan: Record<string, (s: string) => void> = {
    "cara-tahu|sama": (s) => {
      expect(s).toMatch(/sendiri|langsung/);
      expect(s).not.toMatch(/cerita|\btidak\b/);
    },
    "cara-tahu|tidak-melihat": (s) => expect(s).toMatch(/cerita|dengar|diberi tahu|obrolan|pembicaraan|kabar/),
    "cara-tahu|dari-cerita": (s) => expect(s).toContain("{sumber}"),
    "cara-tahu|tidak-tahu": (s) => expect(s).toMatch(TAK_TAHU),
    "penyebab|sama": (s) => expect(s).not.toMatch(/\b(tidak|belum)\b/),
    "penyebab|sebagian": (s) => expect(s).toMatch(TAK_TAHU),
    "penyebab|tidak-tahu": (s) => {
      expect(s).toMatch(TAK_TAHU);
      // Bank ini juga melayani 'tidak-melihat': varian baru tidak mengaku menyaksikan.
      expect(s).not.toMatch(/melihat|menyaksikan|mendengar/);
    },
    "penyebab|dari-cerita": (s) => expect(s).toContain("{sumber}"),
    "penyebab|tahu-pisah": (s) => expect(s).toMatch(/tidak (mengetahui|pernah mengetahui|saya ketahui)/i),
    "menyaksikan|tahu-pisah": (s) => expect(s).toMatch(/(tidak|belum) pernah (sekalipun saya )?(melihat|menyaksikan)/i),
    "menyaksikan|tidak-melihat": (s) => {
      expect(s).toMatch(/\b(tidak|belum)\b/);
      expect(s).not.toMatch(/^saya pernah/);
    },
    "menyaksikan|tidak-tahu": (s) => {
      expect(s).toMatch(/pernah|beberapa kali|lebih dari sekali/);
      expect(s).toMatch(/tidak (tahu|mengetahui|mengerti)|tidak saya ketahui/);
    },
    "rukun|tahu-pisah": (s) => {
      expect(s).toMatch(/tidak (sanggup|dapat|bisa|mampu)/);
      expect(s).toMatch(TAK_TAHU);
    },
    "waktu|tidak-melihat": (s) => expect(s).toMatch(/cerita|dengar/),
    "waktu|dari-cerita": (s) => expect(s).toMatch(/cerita|menceritakan|penuturan/),
    "kehidupan|tidak-melihat": (s) => expect(s).toMatch(/cerita|dengar/),
    "kehidupan|dari-cerita": (s) => expect(s).toContain("{sumber}"),
  };
  for (const kunci of ["cara-tahu|tahu-pisah", "kehidupan|tahu-pisah", "waktu|tahu-pisah"]) {
    aturan[kunci] = (s) => {
      expect(s).toMatch(TAK_TAHU);
      expect(s).not.toMatch(/melihat sendiri|sering terjadi perselisihan|terjadi sejak/i);
    };
  }

  it.each(Object.keys(CABANG_JAWABAN_MODUS))("%s", (kunci) => {
    const cek = aturan[kunci];
    expect(cek, kunci).toBeDefined();
    for (const s of BANK[kunci].slice(LAMA)) {
      try {
        cek(s);
      } catch (e) {
        throw new Error(`${kunci}: "${s}" - ${(e as Error).message}`);
      }
    }
  });
});

describe("butir 9 - varian baru terpakai di penyusun bot", () => {
  const templat = (p: string, t: string) =>
    [
      ["1", `Apakah saksi kenal dengan ${p} dan ${t}?`, `Ya, saya kenal dengan ${p} dan ${t} karena saya adalah tetangga ${p};`],
      ["2", `Bagaimana kehidupan rumah tangga ${p} dan ${t}?`, `Pada awalnya kehidupan rumah tangga ${p} dan ${t} rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang terus menerus;`],
      ["3", `Kapan mulai terjadi perselisihan dan pertengkaran antara ${p} dan ${t}?`, `Perselisihan dan pertengkaran ${p} dan ${t} terjadi sejak ...;`],
      ["4", `Apakah saksi tahu penyebab perselisihan dan pertengkaran ${p} dan ${t}?`, "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu ...;"],
      ["5", "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?", `Saya mengetahui karena saya pernah/sering melihat dan mendengar pertengkaran dan perselisihan ${p} dan ${t};`],
      ["6", `Berapa kali saksi melihat dan mendengar ${p} dan ${t} bertengkar?`, `Saya melihat dan mendengar ${p} dan ${t} bertengkar kurang lebih _ kali;`],
      ["7", `Apakah saksi masih sanggup untuk mendamaikan ${p} dan ${t}?`, "Saya tidak sanggup lagi;"],
    ].map(([no, tanya, jawab]) => ({ no, tanya, jawab }));
  const posita = (p: string, t: string) =>
    `Bahwa sejak bulan Maret 2021 rumah tangga ${p} dan ${t} sering terjadi perselisihan dan pertengkaran disebabkan karena ${t} tidak memberikan nafkah kepada ${p}; Bahwa puncaknya pada bulan Agustus 2023 ${t} pergi meninggalkan rumah sehingga ${p} dan ${t} telah pisah rumah;`;
  const susun = (jenis: "347" | "346", modus: string, nomor: number, banyak = 2) => {
    const [p, t] = jenis === "347" ? ["Penggugat", "Tergugat"] : ["Pemohon", "Termohon"];
    return layanan.susunKeteranganSaksiSdg({
      templat: templat(p, t),
      posita: posita(p, t),
      pelaku: t,
      lawan: p,
      jenisPerkara: jenis,
      nomorPerkara: `${nomor}/Pdt.G/2026/PA.Dgl`,
      kodeKumpulan: "04",
      saksi: Array.from({ length: banyak }, (_, i) => ({ ke: i + 1, pihak: "P", modus, sumber: "penggugat", sumberNama: p, alasan: ["tidak memberi nafkah"] })),
    });
  };

  it("antarperkara memakai lebih dari 4 bentuk per bank (varian baru terpilih), n bank = 14", () => {
    for (const jenis of ["347", "346"] as const) {
      for (const modus of MODUS) {
        const perNo = new Map<string, Set<number>>();
        for (let i = 1; i <= 60; i++) {
          for (const s of susun(jenis, modus, i).saksi) {
            for (const b of s.jawaban) {
              if (b.varian.n !== LAMA + TAMBAH) continue;
              if (!perNo.has(b.no)) perNo.set(b.no, new Set());
              perNo.get(b.no)!.add(b.varian.indeks);
            }
          }
        }
        expect(perNo.size, `${jenis} ${modus}: ada jawaban dari bank modus`).toBeGreaterThan(0);
        for (const [no, indeks] of perNo) {
          expect(indeks.size, `${jenis} ${modus} #${no}`).toBeGreaterThan(LAMA);
          expect([...indeks].some((x) => x >= LAMA), `${jenis} ${modus} #${no}`).toBe(true);
        }
      }
    }
  });

  it("saksi seperkara berbeda pada jawaban modus; cetak ulang sama persis; sebutan sesuai jenis perkara", () => {
    for (const jenis of ["347", "346"] as const) {
      const [p, lawanSebutan] = jenis === "347" ? ["Penggugat", /\b(Pemohon|Termohon)\b/] : ["Pemohon", /\b(Penggugat|Tergugat)\b/];
      for (const modus of MODUS) {
        for (let i = 1; i <= 15; i++) {
          const h = susun(jenis, modus, i, 4);
          expect(susun(jenis, modus, i, 4)).toEqual(h);
          const [s1, ...lain] = h.saksi;
          for (const b of s1.jawaban) {
            if (b.varian.n !== LAMA + TAMBAH) continue;
            for (const s of lain) expect(s.jawaban.find((x) => x.no === b.no)?.jawab, `${jenis} ${modus} ${i} #${b.no}`).not.toBe(b.jawab);
          }
          for (const s of h.saksi) {
            for (const b of s.jawaban) {
              expect(b.jawab, b.jawab).not.toMatch(/\{(sumber|daftar|isi|jawab)\}/);
              expect(b.jawab, b.jawab).not.toMatch(lawanSebutan);
            }
          }
          if (modus === "dari-cerita") {
            const dariCerita = h.saksi.flatMap((s) => s.jawaban).filter((b) => b.varian.n === LAMA + TAMBAH && /cerita|penuturan|mengadu|bercerita/.test(b.jawab));
            expect(dariCerita.some((b) => b.jawab.includes(p)), `${jenis} ${i}`).toBe(true);
          }
        }
      }
    }
  });
});

describe("butir 9 - batas entri jawaban-modus", () => {
  it("portal 400 untuk jawaban-modus, 200 untuk daftar lain; cermin muat", () => {
    expect(batasEntriDaftar("bas.saksi.jawaban-modus")).toBe(400);
    expect(batasEntriDaftar("bas.saksi.bentuk")).toBe(200);
    expect(CERMIN_BAS_SAKSI["bas.saksi.jawaban-modus"].length).toBeLessThan(batasEntriDaftar("bas.saksi.jawaban-modus"));
  });

  it("bot menerima 280 entri cermin tanpa memotong, dan menolak lewat 400", () => {
    const daftar = (n: number) => ({
      versi: "uji",
      daftar: { "bas.saksi.jawaban-modus": Array.from({ length: n }, (_, i) => CERMIN_BAS_SAKSI["bas.saksi.jawaban-modus"][i % 280]) },
    });
    expect(layanan.bacaBankBas({ tipeKeluaran: daftar(280) }).ditolak).toEqual([]);
    const lewat = layanan.bacaBankBas({ tipeKeluaran: daftar(401) }).ditolak as { alasan: string }[];
    expect(lewat).toHaveLength(1);
    expect(lewat[0].alasan).toBe("lebih_dari_400_entri");
  });

  it("rute bot memakai batas yang sama (400 untuk jawaban-modus)", () => {
    const rute = fs.readFileSync(path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js"), "utf8");
    expect(rute).toMatch(/BATAS_ENTRI_KHUSUS_ABT = Object\.freeze\(\{ "bas\.saksi\.jawaban-modus": 400 \}\)/);
    expect(rute).toContain("mentah.slice(0, batasEntri)");
  });
});
