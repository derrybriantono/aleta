import { describe, expect, it } from "vitest";

import { bacaParagrafBerkas } from "@/lib/berkas-ke-paragraf";
import {
  bahanDrafDariBerkas,
  bahanDrafPerakit,
  kalimatJumlahKosong,
  tandaiKekosongan,
} from "@/lib/draf-blangko-prompt";
import { bacaRtfParagraf, paragrafDariTeks } from "@/lib/deteksi-sisa-blangko";

/**
 * RTF rekaan hasil cetak blangko ABT yang belum penuh: titik-titik, kurung
 * siku, penanda #nnnn#, tulisan merah, satu kutipan ayat ber-"..." (BUKAN
 * kekosongan), dan grup tersembunyi {\*\isianasal ...} yang harus dibuang.
 */
const RTF = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Arial;}}{\colortbl;\red255\green0\blue0;}
{\*\isianasal TERSEMBUNYI-JANGAN-MASUK ... [juga-tersembunyi]}
\pard Bahwa Penggugat dan Tergugat menikah pada tanggal ........ di KUA ...\par
\pard Allah berfirman "dan jika kamu ingin mengganti isteri ... janganlah kamu mengambil kembali" dalam ayat itu.\par
\pard Nama saksi [nama saksi] dan #1214# serta {\cf1 isi merah} dalam berkas.\par
\pard Paragraf yang sudah penuh dan tidak memuat sisa apa pun.\par
}`;

describe("kekosongan pada putusan hasil ABT", () => {
  const paragraf = bacaRtfParagraf(RTF);
  const h = tandaiKekosongan(paragraf);

  it("kekosongan terdeteksi dan bertanda dengan nomor", () => {
    expect(h.teks).toContain("[KOSONG-1: titik-titik]");
    expect(h.teks).toContain("[KOSONG-2: titik-titik]");
    expect(h.teks).toMatch(/\[KOSONG-3: kurung siku «\[nama saksi\]»\]/);
    expect(h.teks).toMatch(/\[KOSONG-4: tanda isian «#1214#»\]/);
    expect(h.teks).toMatch(/\[KOSONG-5: tulisan merah «isi merah»\]/);
    expect(h.jumlah).toBe(5);
    expect(h.kekosongan.map((k) => k.jenis)).toEqual(["titik", "titik", "kurung", "tanda", "merah"]);
  });

  it("kutipan ayat ber-titik tiga tidak dihitung dan tetap utuh", () => {
    expect(h.teks).toContain('"dan jika kamu ingin mengganti isteri ... janganlah kamu mengambil kembali"');
    expect(h.kekosongan.some((k) => k.konteks.includes("mengganti isteri"))).toBe(false);
  });

  it("grup tersembunyi dibuang", () => {
    expect(h.teks).not.toContain("TERSEMBUNYI");
    expect(h.teks).not.toContain("juga-tersembunyi");
  });

  it("paragraf yang sudah penuh tidak berubah", () => {
    expect(h.teks).toContain("Paragraf yang sudah penuh dan tidak memuat sisa apa pun.");
  });

  it("bahan perintah memuat rekap jumlah per jenis dan letaknya", () => {
    const b = bahanDrafDariBerkas("putusan-123.rtf", paragraf);
    expect(b.jumlahKosong).toBe(5);
    expect(b.rekap).toContain("Ditemukan 5 bagian kosong");
    expect(b.rekap).toMatch(/titik-titik 2/);
    expect(b.rekap).toContain("KOSONG-1 (titik-titik)");
    expect(b.sumber).toBe("Berkas putusan hasil ABT");
    expect(kalimatJumlahKosong(37)).toBe("Ditemukan 37 bagian kosong");
    expect(kalimatJumlahKosong(0)).toBe("Tidak ada bagian kosong yang terdeteksi");
  });

  it("teks biasa: titik-titik dan garis isian terdeteksi, ayat dengan kutipan tidak", () => {
    const t = tandaiKekosongan(paragrafDariTeks('Lahir di ......, alamat ____ dan "firman ... akhir" selesai.'));
    expect(t.jumlah).toBe(2);
    expect(t.teks).toContain("[KOSONG-1: titik-titik]");
    expect(t.teks).toContain("[KOSONG-2: garis isian]");
  });

  it("berkas RTF dibaca di peramban lewat bita", async () => {
    const bita = new TextEncoder().encode(RTF);
    const hasil = await bacaParagrafBerkas(bita, "putusan.rtf");
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(tandaiKekosongan(hasil.paragraf).jumlah).toBe(5);
    const tak = await bacaParagrafBerkas(new TextEncoder().encode("bukan apa-apa"), "x.bin");
    expect(tak.ok).toBe(false);
  });

  it("draf perakit putusan menjadi bahan dengan daftar bagian belum terisi", () => {
    const b = bahanDrafPerakit({ versi: 2, jenisNaskah: "PUTUSAN", keadaan: "draf", naskah: "Naskah draf", belumTerisi: ["amar", "biaya"], dibuatAt: "2026-10-18T01:00:00Z" });
    expect(b?.rekap).toContain("amar; biaya");
    expect(bahanDrafPerakit({ versi: 1, jenisNaskah: "", keadaan: "draf", naskah: "  ", belumTerisi: [], dibuatAt: "" })).toBeNull();
  });
});
