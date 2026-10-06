// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUTIR 28 (C) - KETERANGAN SAKSI TIDAK PERNAH DIPULANGKAN "..." (30 Sep 2026)
 * ============================================================================
 *
 * 459/Pdt.G/2026/PA.Dgl pertanyaan 14 "Apakah sejak ada masalah, Penggugat
 * dan Tergugat pernah diupayakan untuk rukun kembali?" terjawab "...;" -
 * templat 04 ABT "Ya, #1268#;" dan variabel 1268 perkara itu kosong.
 *
 * Diukur atas 558 perkara Cerai Gugat/Talak 2026 sipp_donggala dengan templat
 * 04 aps_badilag (D:/aleta-dev/kerja/perbaikan-30sep/agen-c/ukur-saksi.js):
 *   jawaban templat yang kosong seluruhnya         373 -> 0 dipulangkan kosong
 *   pertanyaan upaya rukun: 1268 sudah terisi 185, diisi dari posita 362,
 *   dari mediasi 2, bertanda BELUM TERISI 9.
 * Contoh-contoh di bawah memakai kalimat SUNGGUHAN dari data itu.
 */

const AKAR_BOT = path.resolve(__dirname, "../../../aleta_bot");
const muat = createRequire(path.join(AKAR_BOT, "package.json"));

type Butir = { no: string; tanya: string; jawab: string; perluDiisi?: boolean; belumTerisi?: boolean; pilihan?: string[] };
type Hasil = {
  saksi: { jawaban: Butir[] }[];
  saksi1: Butir[];
  saksi2: Butir[];
  perluDiisi: { no: string }[];
  terisiDariData: { no: string; sumber: string }[];
  belumTerisi: { no: string }[];
  tandaBelumTerisi: string;
};
type Layanan = {
  susunKeteranganSaksiSdg: (o: Record<string, unknown>) => Hasil;
  sumberUpayaDamai: (o: Record<string, unknown>) => { sumber: string; kalimat: string; perukun: string };
  jawabanKosong: (t: string) => boolean;
  TANDA_BELUM_TERISI: string;
};
const L = () => muat("./services/abtUsulanService.js") as Layanan;

const TANYA_14 = "Apakah sejak ada masalah, Penggugat dan Tergugat pernah diupayakan untuk rukun kembali?";
// Posita 459/Pdt.G/2026/PA.Dgl - kalimat upaya damainya apa adanya.
const POSITA_459 =
  "<p>Bahwa sejak awal tahun 2025 rumah tangga Penggugat dan Tergugat mulai goyah karena sering terjadi perselisihan dan pertengkaran;</p>" +
  "<p>Bahwa atas permasalahan dan kemelut rumah tangga yang dihadapi, keluarga Tergugat sudah pernah mencoba memusyawarahkan dengan keluarga Penggugat untuk mencari penyelesaian dan demi menyelamatkan perkawinan namun tidak berhasil;</p>";
// Nilai bawaan variabel 1268 di ABT (abt_variabel.default_data), berekor #8498#.
const NILAI_1268 = "pihak keluarga telah berusaha untuk mendamaikan #0046# dan #0047#, namun tidak berhasil\n\n#8498#";

function susun(jawab14: string, tambahan: Record<string, unknown> = {}) {
  return L().susunKeteranganSaksiSdg({
    templat: [
      { no: "13", tanya: "Apakah Penggugat dan Tergugat masih tinggal bersama?", jawab: "Penggugat dan Tergugat sudah pisah rumah;" },
      { no: "14", tanya: TANYA_14, jawab: jawab14 },
      { no: "15", tanya: "Apakah saksi sanggup merukunkan?", jawab: "Saya tidak sanggup lagi merukunkan mereka;" },
    ],
    pelaku: "Tergugat",
    lawan: "Penggugat",
    nomorPerkara: "459/Pdt.G/2026/PA.Dgl",
    kodeKumpulan: "04",
    ...tambahan,
  });
}

// saksi1/saksi2 polos (no, tanya, jawab); tanda perluDiisi/belumTerisi ada di saksi[].jawaban.
const j14 = (h: Hasil, ke: 1 | 2 = 1) => h.saksi[ke - 1].jawaban.find((b) => b.no === "14")!;

describe("28. pertanyaan upaya rukun diisi dari data yang ada", () => {
  it("459/Pdt.G/2026: 'Ya, ...;' + posita -> diupayakan dirukunkan oleh keluarga Tergugat, tidak berhasil", () => {
    const h = susun("Ya, ...;", { posita: POSITA_459 });
    for (const ke of [1, 2] as const) {
      const b = j14(h, ke);
      expect(b.jawab).not.toMatch(/\.{3}|\u2026|_/);
      expect(b.jawab).toMatch(/keluarga Tergugat/);
      expect(b.jawab).toMatch(/tidak berhasil/);
      expect(b.perluDiisi).toBe(false);
    }
    expect(h.terisiDariData).toEqual([expect.objectContaining({ no: "14", sumber: "posita" })]);
  });

  it("variabel 1268 lebih dulu - '#1268#' diganti nilainya, sebutan terisi, #8498# dibuang", () => {
    const h = susun("Ya, #1268#;", { posita: POSITA_459, upayaDamai: NILAI_1268 });
    const b = j14(h);
    // Kalimatnya boleh diragamkan ("telah berusaha" -> "sudah berupaya"); substansinya tidak.
    expect(b.jawab).toMatch(/pihak keluarga .*(mendamaikan|merukunkan).* Penggugat dan Tergugat/i);
    expect(b.jawab).not.toMatch(/#\d{4}#/);
    expect(h.terisiDariData[0].sumber).toBe("1268");
  });

  it("tanpa 1268 dan tanpa kalimat posita: mediasi yang tidak berhasil", () => {
    const h = susun("Ya, ;", { posita: "<p>Bahwa Tergugat pergi meninggalkan rumah;</p>", mediasi: { selesai: true, berhasil: false } });
    expect(j14(h).jawab).toMatch(/melalui mediasi/);
    expect(j14(h).jawab).toMatch(/tidak berhasil/);
    expect(h.terisiDariData[0].sumber).toBe("mediasi");
  });

  it("posita menyebut BELUM pernah ada upaya -> dijawab demikian, bukan dikarang berhasil/gagal", () => {
    const posita = "<p>Bahwa belum pernah ada upaya untuk merukunkan Penggugat dan Tergugat oleh keluarga;</p>";
    expect(j14(susun("...;", { posita })).jawab).toMatch(/^Belum pernah ada upaya untuk merukunkan Penggugat dan Tergugat/);
  });

  it("templat pilihan 'dirukunkan oleh ...., namun tidak berhasil' - hanya slot perukunnya yang diisi", () => {
    const u = L().sumberUpayaDamai({ posita: POSITA_459, pelaku: "Tergugat", lawan: "Penggugat" });
    expect(u).toMatchObject({ sumber: "posita", perukun: "keluarga Tergugat" });
    const h = susun(
      "Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh ...., namun tidak berhasil;Belum pernah ada upaya untuk merukunkan Penggugat dan Tergugat karena ....;",
      { posita: POSITA_459 }
    );
    expect(j14(h).jawab).toMatch(/dirukunkan oleh keluarga Tergugat/);
    expect(j14(h).jawab).not.toMatch(/Belum pernah/);
  });

  it("jawaban yang SUDAH berisi tidak disentuh", () => {
    const h = susun("Ya, sudah pernah dirukunkan oleh orang tua Penggugat namun tidak berhasil;", {
      posita: POSITA_459,
      upayaDamai: NILAI_1268,
    });
    expect(j14(h).jawab).toMatch(/orang tua Penggugat/);
    expect(h.terisiDariData).toEqual([]);
  });
});

describe("28. tidak pernah memulangkan kosong / '...' / '…' / '_' / variabel templat", () => {
  // Diubah butir 14 (6 Okt 2026): pertanyaan UPAYA RUKUN tanpa sumber apa pun
  // kini menjadi pilihan "sudah diupayakan, tidak berhasil" / "belum pernah
  // ada upaya" yang WAJIB dipilih petugas (panel menahan simpan) - kalimat
  // utuh, tidak ada yang dikarang, tetap perluDiisi. Tanda belum terisi
  // tetap untuk pertanyaan lain (uji di bawah).
  it("tanpa sumber apa pun: pilihan sudah/belum yang wajib dipilih, perluDiisi, tanpa titik-titik", () => {
    const h = susun("Ya, ...;");
    const b = j14(h);
    expect(b.jawab).not.toMatch(/\.{3}|BELUM TERISI/);
    expect(b.pilihan).toEqual([
      "Penggugat dan Tergugat sudah pernah diupayakan untuk rukun kembali, namun tidak berhasil;",
      "Belum pernah ada upaya untuk merukunkan Penggugat dan Tergugat;",
    ]);
    expect(b.perluDiisi).toBe(true);
    expect(h.belumTerisi).toEqual([]);
    expect(h.tandaBelumTerisi).toBe(L().TANDA_BELUM_TERISI);
  });

  it("setiap bentuk kosong pada pertanyaan mana pun menjadi tanda, di SEMUA saksi", () => {
    for (const kosong of ["", "...;", "…", "_", "____;", "Ya, ;", "#5227#;", "Ya, #1268#;"]) {
      const h = L().susunKeteranganSaksiSdg({
        templat: [{ no: "9", tanya: "Apa penyebab pertengkaran mereka?", jawab: kosong }],
        pelaku: "Tergugat",
        lawan: "Penggugat",
        nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      });
      for (const s of h.saksi) {
        for (const b of s.jawaban) {
          expect(b.jawab, JSON.stringify(kosong)).toBe(L().TANDA_BELUM_TERISI);
          expect(L().jawabanKosong(b.jawab)).toBe(false);
        }
      }
    }
  });

  it("jawaban pendek yang SAH tidak terbaca kosong ('Ya;', 'Sudah cukup;', 'Tidak ada;')", () => {
    for (const sah of ["Ya;", "Sudah cukup;", "Tidak ada;", "Sudah;"]) expect(L().jawabanKosong(sah), sah).toBe(false);
  });

  it("titik-titik DI TENGAH kalimat tetap seperti semula (sudah ditandai perluDiisi)", () => {
    const h = L().susunKeteranganSaksiSdg({
      templat: [{ no: "3", tanya: "Kapan mereka menikah?", jawab: "Mereka menikah pada ...........;" }],
      pelaku: "Tergugat",
      lawan: "Penggugat",
    });
    expect(h.saksi[0].jawaban[0].jawab).toMatch(/\.{3,}/);
    expect(h.saksi[0].jawaban[0].perluDiisi).toBe(true);
  });
});

describe("28. gerbang bot meneruskan sumbernya", () => {
  const gerbang = readFileSync(path.join(AKAR_BOT, "routes/internalGatewayRoutes.js"), "utf8");

  it("variabel 1268 (upayaDamai) dan mediasi sampai ke penyusun", () => {
    expect(gerbang).toContain('upayaDamai: String(req.body?.upayaDamai || "").slice(0, 600),');
    expect(gerbang).toMatch(/abtUsulanService\.mediasiPerkara\(nomorPerkara\)/);
    // SIPP hanya dibaca bila templatnya memang menanyakan upaya rukun.
    expect(gerbang).toContain("tanyaUpaya && nomorPerkara ?");
  });

  it("rute portal /aleta-bot/abt/usulan meneruskan kedua ruasnya (penyaringnya menyebut ruas satu per satu)", () => {
    const portal = readFileSync(path.resolve(__dirname, "../app/api/aleta-bot/abt/usulan/route.ts"), "utf8");
    expect(portal).toContain('upayaDamai: String(body.upayaDamai || "").slice(0, 600),');
    expect(portal).toMatch(/mediasi:\s*\n\s*body\.mediasi && typeof body\.mediasi === "object"/);
  });

  it("mediasiPerkara hanya SELECT", () => {
    const layanan = readFileSync(path.join(AKAR_BOT, "services/abtUsulanService.js"), "utf8");
    const i = layanan.indexOf("async function mediasiPerkara(");
    const badan = layanan.slice(i, layanan.indexOf("\n}\n", i));
    expect(badan).toContain("SELECT m.hasil_mediasi");
    expect(badan).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  });
});
