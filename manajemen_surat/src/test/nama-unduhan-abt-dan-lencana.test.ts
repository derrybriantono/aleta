/**
 * ============================================================================
 * NAMA UNDUHAN ABT, DAN LENCANA YANG DIBENTANGKAN KEMBALI
 * ============================================================================
 *
 * Dua keluhan petugas pada 17 September 2026, dan keduanya terukur.
 *
 * NAMA BERKAS. Pada folder unduhan terlihat "download (9).rtf", "download
 * (4).pdf" - nama bawaan peramban. Yang diminta satker: nomor perkara - jenis
 * perkara - status putusan. Dua sebab, dua tempat:
 *
 *   - papan massal sudah menerima jenisPerkara dari daftar sidang tetapi
 *     MEMBUANGNYA, lalu tempatnya diisi ringkasBlangkoAbt() - potongan kepala
 *     halaman blangko, yang bukan jenis perkara dan berubah tiap halaman;
 *   - halaman satu perkara tidak punya sumbernya sama sekali; tidak ada satu
 *     pun permintaan yang memulangkan jenis perkara atau status putusan.
 *
 * LENCANA. Panel yang diciutkan menyembunyikan seluruh anaknya dengan
 * display:none, sehingga membentangkannya menata ulang SEMUA isinya sekaligus.
 * Diukur atas replika panel, 25 putaran tiap ukuran, tiap putaran dipaksa
 * menghitung tata letaknya:
 *
 *       simpul        sebelum        sesudah
 *          200        7,90 ms        1,20 ms
 *          800       34,10 ms        4,80 ms
 *        2.000       87,60 ms       15,10 ms
 *        5.000      265,90 ms       35,90 ms   (terburuk 565,80 -> 82,70)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const abt = baca("ekstensi-sipp/abt.js");
const latar = baca("ekstensi-sipp/latar.js");
const css = baca("ekstensi-sipp/panel.css");
const layanan = baca("aleta_bot/services/abtUsulanService.js");

/** Fungsi puncak - dibuka di kolom nol, ditutup "}" di kolom nol. */
function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  const hasil: string[] = [];
  const ketemu = new Set<string>();
  for (let i = 0; i < baris.length; i += 1) {
    const cocok = baris[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/);
    if (!cocok || !nama.includes(cocok[1])) continue;
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    if (j >= baris.length) throw new Error(`penutup fungsi ${cocok[1]} tidak ditemukan`);
    hasil.push(baris.slice(i, j + 1).join("\n"));
    ketemu.add(cocok[1]);
  }
  const hilang = nama.filter((n) => !ketemu.has(n));
  if (hilang.length) throw new Error(`fungsi tidak ditemukan: ${hilang.join(", ")}`);
  return hasil.join("\n\n");
}

type Keadaan = { jenisPerkara?: string; statusPutusan?: string; verstek?: boolean };

function muatNamaBerkas(peta: Map<string, Keadaan>) {
  const sumber = potongFungsi(abt, ["sebutStatusPutusan", "sebutJenisPerkara", "namaBerkas"]);
  const buat = new Function("statusPutusanPerkara", `${sumber}\nreturn namaBerkas;`);
  return buat(peta) as (nomor: string, akhiran: string, jenis: string) => string;
}

function muatNamaUnduhan() {
  const sumber = potongFungsi(latar, ["namaUnduhanAbt"]);
  return new Function(`${sumber}\nreturn namaUnduhanAbt;`)() as (
    nama: string,
    konteks: { nomor: string; jenisPerkara: string; statusPutusan: string }
  ) => string;
}

describe("nama berkas unduhan panel", () => {
  it("nomor perkara - jenis perkara - status putusan", () => {
    const peta = new Map<string, Keadaan>([
      ["600/Pdt.G/2026/PA.Dgl", { jenisPerkara: "Cerai Gugat", statusPutusan: "Dikabulkan", verstek: false }],
    ]);
    const namaBerkas = muatNamaBerkas(peta);
    expect(namaBerkas("600/Pdt.G/2026/PA.Dgl", "rtf", "putusan")).toBe(
      "600_Pdt.G_2026_PA.Dgl - Cerai Gugat - Dikabulkan.rtf"
    );
  });

  it("verstek disebut sekali, tidak diulang bila statusnya sudah memuatnya", () => {
    const namaA = muatNamaBerkas(
      new Map([["1/Pdt.G/2026/PA.Dgl", { jenisPerkara: "Cerai Talak", statusPutusan: "Dikabulkan", verstek: true }]])
    );
    expect(namaA("1/Pdt.G/2026/PA.Dgl", "pdf", "putusan")).toContain("Dikabulkan verstek");

    const namaB = muatNamaBerkas(
      new Map([
        ["2/Pdt.G/2026/PA.Dgl", { jenisPerkara: "Cerai Gugat", statusPutusan: "DIKABULKAN (verstek)", verstek: true }],
      ])
    );
    expect(namaB("2/Pdt.G/2026/PA.Dgl", "pdf", "putusan")).toBe(
      "2_Pdt.G_2026_PA.Dgl - Cerai Gugat - DIKABULKAN (verstek).pdf"
    );
  });

  it("anonim tetap berpenanda supaya tidak menimpa putusannya", () => {
    const peta = new Map<string, Keadaan>([
      ["3/Pdt.G/2026/PA.Dgl", { jenisPerkara: "Cerai Gugat", statusPutusan: "Dikabulkan" }],
    ]);
    const namaBerkas = muatNamaBerkas(peta);
    const putusan = namaBerkas("3/Pdt.G/2026/PA.Dgl", "rtf", "putusan");
    const anonim = namaBerkas("3/Pdt.G/2026/PA.Dgl", "rtf", "anonimisasi");
    expect(anonim).not.toBe(putusan);
    expect(anonim).toContain(" - anonimisasi.rtf");
    expect(putusan).not.toContain("anonim");
    expect(namaBerkas("3/Pdt.G/2026/PA.Dgl", "pdf", "putusan")).toBe(putusan.replace(/\.rtf$/, ".pdf"));
  });

  it("perkara yang belum dikenal tetap memakai nomornya, bukan mengarang", () => {
    const namaBerkas = muatNamaBerkas(new Map());
    expect(namaBerkas("4/Pdt.G/2026/PA.Dgl", "rtf", "putusan")).toBe("4_Pdt.G_2026_PA.Dgl.rtf");
  });

  it("kepala halaman blangko tidak lagi dipakai sebagai jenis perkara", () => {
    expect(potongFungsi(abt, ["namaBerkas"])).not.toContain("ringkasBlangkoAbt()");
  });
});

describe("nama unduhan yang diterbitkan ABT sendiri", () => {
  it("bentuknya sama dengan nama berkas panel", () => {
    const namaUnduhanAbt = muatNamaUnduhan();
    expect(
      namaUnduhanAbt("download (9).rtf", {
        nomor: "600/Pdt.G/2026/PA.Dgl",
        jenisPerkara: "Cerai Gugat",
        statusPutusan: "Dikabulkan",
      })
    ).toBe("600_Pdt.G_2026_PA.Dgl - Cerai Gugat - Dikabulkan.rtf");
  });

  it("tidak lagi menempelkan kata putusan pada tiap berkas", () => {
    const badan = potongFungsi(latar, ["namaUnduhanAbt"]);
    expect(badan).not.toContain('"putusan"');
    expect(badan).toContain("konteks.jenisPerkara");
    expect(badan).toContain("konteks.statusPutusan");
  });

  it("konteks yang dikirim halaman ABT membawa kedua medan itu", () => {
    expect(abt).toContain("jenisPerkara: sebutJenisPerkara(nomor),");
    expect(abt).toContain("statusPutusan: sebutStatusPutusan(nomor),");
    expect(latar).toContain("jenisPerkara: String(pesan.jenisPerkara || \"\").slice(0, 60),");
  });
});

describe("sumber jenis perkara pada halaman satu perkara", () => {
  it("usulan SIPP ikut memulangkan keterangan perkaranya", () => {
    expect(layanan).toContain("p.jenis_perkara_text AS jenisPerkara");
    expect(layanan).toContain("pp.status_putusan_text AS statusPutusan");
    expect(layanan).toContain("keteranganPerkara,");
  });

  it("panel mengingatnya di satu tempat yang dilewati semua pemanggil", () => {
    expect(abt).toContain("ingatKeteranganPerkara(muatan?.nomorPerkara, isi?.sipp?.keteranganPerkara);");
  });

  it("yang kosong tidak menimpa yang sudah terbaca dari daftar sidang", () => {
    const badan = potongFungsi(abt, ["ingatKeteranganPerkara"]);
    expect(badan).toContain("|| lama.jenisPerkara");
    expect(badan).toContain("|| lama.statusPutusan");
  });

  it("papan massal tidak lagi membuang jenis perkaranya", () => {
    expect(abt).toContain("jenisPerkara: s.jenis || \"\",");
  });
});

describe("lencana yang dibentangkan kembali", () => {
  it("daftar panjang menata hanya yang terlihat", () => {
    expect(css).toContain(".aleta-abt-daftar > .aleta-abt-kartu,");
    expect(css).toContain(".aleta-massal-daftar > .aleta-massal-butir {");
    expect(css).toContain("content-visibility: auto;");
    expect(css).toContain("contain-intrinsic-size: auto 64px;");
  });

  it("angka ukurannya ikut tercatat di sumbernya", () => {
    expect(css).toContain("265,90 ms");
    expect(css).toContain("35,90 ms");
  });
});
