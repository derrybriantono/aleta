// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL - MEMASANGKAN BERKAS KE PERKARA (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * putusan-terjadwal-pasangan.js dijalankan SUNGGUHAN. Pembaca nomor dari nama dan penanda bukan-naskah
 * diadu dengan salinan di konten.js (nomorDariNamaBerkas, tandaBukanNaskahPutusan, namaBerkasAnonim) atas
 * nama-nama nyata; pemasangan diuji: cocok dari nama / isi / keduanya, konflik, tidak cocok, ganda,
 * pilihan manual, dan yang bukan naskah.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const P = require(path.join(AKAR, "putusan-terjadwal-pasangan.js")) as {
  baku: (n: string) => string;
  nomorDariNama: (n: string) => string;
  tandaBukanNaskah: (n: string) => string;
  namaAnonim: (n: string) => boolean;
  pasangkan: (m: unknown) => Array<{ kunci: string; status: string; perkaraKunci: string; sumber: string; sebab: string; nomorNama: string; nomorIsi: string }>;
  ringkas: (h: unknown) => Record<string, number>;
};

/** Memuat fungsi bernama dari konten.js tanpa menjalankan seluruh berkas (27 ribu baris). */
function muatDariKonten() {
  const kode = readFileSync(path.join(AKAR, "konten.js"), "utf8").replace(/\r\n/g, "\n");
  const ambil = (awal: string) => {
    const i = kode.indexOf(awal);
    if (i < 0) throw new Error(`tidak ada: ${awal}`);
    const j = kode.indexOf("\n}\n", i);
    return kode.slice(i, j + 3);
  };
  const polaPerkara = kode.slice(kode.indexOf("const POLA_PERKARA = "), kode.indexOf("\n", kode.indexOf("const POLA_PERKARA = ")) + 1);
  const sumber = [polaPerkara, ambil("function nomorDariNamaBerkas(nama) {"), ambil("function tandaBukanNaskahPutusan(nama) {"), ambil("function namaBerkasAnonim(nama) {")].join("\n");
  const ctx = vm.createContext({});
  vm.runInContext(`${sumber}\nglobalThis.k = { nomorDariNamaBerkas, tandaBukanNaskahPutusan, namaBerkasAnonim };`, ctx);
  return (ctx as unknown as { k: { nomorDariNamaBerkas: (n: string) => string; tandaBukanNaskahPutusan: (n: string) => string; namaBerkasAnonim: (n: string) => boolean } }).k;
}

const NAMA_NYATA = [
  "100_Pdt.G_2026_PA.Dgl - [01] Kabul Verstek Cerai (Format Lengkap).rtf",
  "684_Pdt.G_2026_PA.Dgl - Putusan.docx",
  "..._OK_299_Pdt_G_2021_PA_Buk_.rtf",
  "PA.Dgl_2025_Pdt.G_637_putusan_akhir.rtf",
  "PA.Buk_2020_Pdt.G_142_petitum.rtf",
  "PA.Buk_2020_Pdt.G_142_putusan_anonimisasi.rtf",
  "putusan_17_pdt.g_2021_pa.sgta_20210512.pdf",
  "12/Pdt.G/2026/PA.Dgl putusan.rtf",
  "~$6_Pdt.P_2026_PA.Dgl.docx",
  "BAS 100_Pdt.G_2026_PA.Dgl.rtf",
  "100_Pdt.G_2026_PA.Dgl dan 101_Pdt.G_2026_PA.Dgl.rtf",
  "Relaas 100_Pdt.G_2026_PA.Dgl.rtf",
  "PHS_100_Pdt.G_2026_PA.Dgl.rtf",
  "Sampul 100_Pdt.G_2026_PA.Dgl.pdf",
  "tanpa nomor sama sekali.rtf",
  "0001_Pdt.G_2015_PA.Buk.rtf",
  "PA.Dgl_2026_Pdt.G.S_55_bas_2.rtf",
  "putusan anom 100_Pdt.G_2026_PA.Dgl.rtf",
];

describe("pembaca nama = salinan konten.js (satu aturan, dua salinan)", () => {
  const k = muatDariKonten();
  it("nomor dari nama sama dengan nomorDariNamaBerkas untuk semua nama nyata", () => {
    for (const nama of NAMA_NYATA) expect(P.nomorDariNama(nama), nama).toBe(k.nomorDariNamaBerkas(nama));
  });
  it("penanda bukan-naskah dan anonim sama dengan salinan di konten.js", () => {
    for (const nama of NAMA_NYATA) {
      expect(P.tandaBukanNaskah(nama), nama).toBe(k.tandaBukanNaskahPutusan(nama));
      expect(P.namaAnonim(nama), nama).toBe(k.namaBerkasAnonim(nama));
    }
  });
  it("contoh yang dijaga: nol di depan dipertahankan, dua nomor berbeda dalam satu nama = kosong, berkas kunci Word = kosong", () => {
    expect(P.nomorDariNama("0001_Pdt.G_2015_PA.Buk.rtf")).toBe("0001/Pdt.G/2015/PA.Buk");
    expect(P.nomorDariNama("100_Pdt.G_2026_PA.Dgl dan 101_Pdt.G_2026_PA.Dgl.rtf")).toBe("");
    expect(P.nomorDariNama("~$6_Pdt.P_2026_PA.Dgl.docx")).toBe("");
    expect(P.nomorDariNama("PA.Dgl_2025_Pdt.G_637_putusan_akhir.rtf")).toBe("637/Pdt.G/2025/PA.Dgl");
  });
  it("baku: titik, spasi, nol di depan, dan huruf besar-kecil tidak membedakan", () => {
    expect(P.baku("0012/Pdt.G/2026/PA.Dgl")).toBe(P.baku("12 / pdt.g / 2026 / pa dgl".replace(/ /g, "")));
    expect(P.baku("12/Pdt.G/2026/PA.Dgl")).not.toBe(P.baku("13/Pdt.G/2026/PA.Dgl"));
  });
});

describe("pemasangan berkas ke perkara", () => {
  const perkara = [
    { kunci: "p1", nomor: "100/Pdt.G/2026/PA.Dgl" },
    { kunci: "p2", nomor: "101/Pdt.G/2026/PA.Dgl" },
    { kunci: "p3", nomor: "102/Pdt.P/2026/PA.Dgl" },
  ];
  const run = (berkas: Array<Record<string, unknown>>, manual?: Record<string, string>) => P.pasangkan({ berkas, perkara, manual });

  it("cocok dari NAMA, dari ISI, atau keduanya; sumbernya disebut", () => {
    const h = run([
      { kunci: "b1", nama: "100_Pdt.G_2026_PA.Dgl putusan.rtf" },
      { kunci: "b2", nama: "putusan-akhir.rtf", nomorIsi: "101/Pdt.G/2026/PA.Dgl" },
      { kunci: "b3", nama: "102_Pdt.P_2026_PA.Dgl.docx", nomorIsi: "102/Pdt.P/2026/PA.Dgl" },
    ]);
    expect(h.map((x) => [x.kunci, x.status, x.perkaraKunci, x.sumber])).toEqual([
      ["b1", "cocok", "p1", "nama"],
      ["b2", "cocok", "p2", "isi"],
      ["b3", "cocok", "p3", "nama+isi"],
    ]);
  });

  it("nomor di nama dan isi BERBEDA = konflik, tidak dipasang ke salah satunya", () => {
    const [h] = run([{ kunci: "b1", nama: "100_Pdt.G_2026_PA.Dgl.rtf", nomorIsi: "101/Pdt.G/2026/PA.Dgl" }]);
    expect(h.status).toBe("konflik");
    expect(h.perkaraKunci).toBe("");
    expect(h.sebab).toMatch(/nama menyebut 100\/Pdt\.G\/2026\/PA\.Dgl, isi menyebut 101\/Pdt\.G\/2026\/PA\.Dgl/);
  });

  it("nomor yang tidak ada di daftar = tidak-cocok (dengan nomornya); tanpa nomor = tanpa-nomor; bukan nama bentuk dikenal ditandai", () => {
    const h = run([
      { kunci: "b1", nama: "999_Pdt.G_2026_PA.Dgl.rtf" },
      { kunci: "b2", nama: "catatan hakim.rtf" },
      { kunci: "b3", nama: "foto.jpg" },
    ]);
    expect(h[0]).toMatchObject({ status: "tidak-cocok" });
    expect(h[0].sebab).toMatch(/999\/Pdt\.G\/2026\/PA\.Dgl/);
    expect(h[1].status).toBe("tanpa-nomor");
    expect(h[2].status).toBe("bukan-naskah");
  });

  it("BAS, PHS, relaas, sampul, berkas kunci Word = bukan-naskah; berkas anonimisasi = anonim (tidak dipakai)", () => {
    const h = run([
      { kunci: "b1", nama: "BAS 100_Pdt.G_2026_PA.Dgl.rtf" },
      { kunci: "b2", nama: "PHS_101_Pdt.G_2026_PA.Dgl.rtf" },
      { kunci: "b3", nama: "Relaas 100_Pdt.G_2026_PA.Dgl.rtf" },
      { kunci: "b4", nama: "~$0_Pdt.G_2026_PA.Dgl.docx" },
      { kunci: "b5", nama: "100_Pdt.G_2026_PA.Dgl putusan anonimisasi.rtf" },
    ]);
    expect(h.map((x) => x.status)).toEqual(["bukan-naskah", "bukan-naskah", "bukan-naskah", "bukan-naskah", "anonim"]);
    expect(h.every((x) => x.perkaraKunci === "")).toBe(true);
  });

  it("dua berkas untuk satu perkara = keduanya GANDA (tidak ada yang dipilihkan); pilihan manual memutuskan", () => {
    const berkas = [
      { kunci: "b1", nama: "100_Pdt.G_2026_PA.Dgl putusan v1.rtf" },
      { kunci: "b2", nama: "100_Pdt.G_2026_PA.Dgl putusan v2.docx" },
    ];
    const h = run(berkas);
    expect(h.map((x) => x.status)).toEqual(["ganda", "ganda"]);
    expect(h.every((x) => x.perkaraKunci === "")).toBe(true);
    const sesudah = run(berkas, { b2: "p1", b1: "" });
    expect(sesudah[0].status).not.toBe("ganda");
    expect(sesudah[1]).toMatchObject({ status: "cocok", perkaraKunci: "p1", sumber: "manual" });
    // Petugas memasang berkas lain ke perkara yang sudah ditunjuk otomatis oleh berkas pertama: yang manual menang, yang otomatis menjadi ganda.
    const bentrok = run(berkas.slice(0, 1).concat([{ kunci: "b3", nama: "catatan.rtf" }]), { b3: "p1" });
    expect(bentrok.map((x) => x.status)).toEqual(["ganda", "cocok"]);
  });

  it("pilihan manual menang atas tebakan; manual ke perkara yang tidak ada di daftar tidak dipasang", () => {
    const h = run([{ kunci: "b1", nama: "999_Pdt.G_2026_PA.Dgl.rtf" }, { kunci: "b2", nama: "x.rtf" }], { b1: "p2", b2: "tidak-ada" });
    expect(h[0]).toMatchObject({ status: "cocok", perkaraKunci: "p2", sumber: "manual" });
    expect(h[1].status).toBe("tanpa-nomor");
  });

  it("ringkas menghitung per status", () => {
    const h = run([{ kunci: "b1", nama: "100_Pdt.G_2026_PA.Dgl.rtf" }, { kunci: "b2", nama: "BAS.rtf" }, { kunci: "b3", nama: "zzz.rtf" }]);
    expect(P.ringkas(h)).toEqual({ cocok: 1, "bukan-naskah": 1, "tanpa-nomor": 1 });
  });

  it("berkas yang diunggah ke server membawa bentuk dari kepala berkas: nama tanpa ekstensi tetap diperiksa nomornya", () => {
    const [h] = run([{ kunci: "b1", nama: "putusan 100_Pdt.G_2026_PA.Dgl", bentuk: "rtf" }]);
    expect(h).toMatchObject({ status: "cocok", perkaraKunci: "p1" });
  });
});
