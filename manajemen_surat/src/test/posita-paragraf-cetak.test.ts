import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * POSITA HARUS TERCETAK BERBARIS - DAN <br> TIDAK PERNAH SAMPAI KE SANA
 * ============================================================================
 *
 * Yang diuji di sini bukan bentuk HTML-nya, melainkan APA YANG TERCETAK.
 * Karena itu hasil perapian dijalankan melalui tiruan TemplateHelper milik
 * SIPP - aturannya disalin baris demi baris dari sumbernya di mesin ini:
 *
 *   application/libraries/TemplateHelper.php  ->  cleanHtmlTagSpecial
 *   application/views/generate_template/cetak_putusan_agama.php baris 440
 *
 * Dari situ terbaca sebab positanya menggumpal: <br> TIDAK ada dalam daftar
 * terjemahan sama sekali. Ia hanya disapu filter_var, tanpa meninggalkan satu
 * pun pemisah. Yang diterjemahkan hanya </p>, </li>, dan <li>.
 *
 * Menguji bentuk HTML-nya saja tidak akan pernah menangkap itu - ia tampak
 * rapi di layar mana pun, dan tetap tercetak sebagai satu gumpalan.
 */

const require_ = createRequire(import.meta.url);
const layanan = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/sippPositaService.js")
) as { rapikanTeksPosita: (t: string) => string };

/** Tiruan cleanHtmlTagSpecial - urutan penggantiannya persis seperti aslinya. */
function sepertiSipp(teks: string): string {
  let t = String(teks);
  t = t.split("  ").join(" ");
  t = t.split("</li>").join("</li> \\par ");
  t = t.split("<li>").join("<li> \\tab ");
  t = t.split("</p>").join("\\par");
  t = t.split("<p>1.").join("\\pard \\qj \\li630 \\linestarts 1. ");
  t = t.replace(/<[^>]*>/g, ""); // filter_var(FILTER_SANITIZE_STRING)
  return t.trim();
}

/** Berapa baris yang benar-benar tercetak. */
function barisCetak(rtf: string): number {
  return rtf.split("\\par").filter((x) => x.trim().length > 0).length;
}

/** Isi tanpa ruang dan tanpa tag - dipakai membuktikan tidak ada huruf berubah. */
function hanyaHuruf(teks: string): string {
  return teks
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<\/?div[^>]*>/gi, "")
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/\s+/g, "");
}

const POSITA_MENGGUMPAL =
  "1. Bahwa pada tanggal 06 Agustus 2020, Penggugat dan Tergugat telah melangsungkan pernikahan;" +
  "2. Bahwa setelah menikah, Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat;" +
  "3. Bahwa keadaan rumah tangga mulai tidak harmonis yang disebabkan karena a. Tergugat sering " +
  "kali mabuk-mabukkan bersama teman-teman Tergugat. b. Setiap kali terjadi pertengkaran Tergugat " +
  "melakukan kekerasan fisik kepada Penggugat;";

describe("yang tercetak, bukan yang tampak di layar", () => {
  const rapi = layanan.rapikanTeksPosita(POSITA_MENGGUMPAL);

  it("tiap butir berdiri sebagai paragrafnya sendiri di dokumen cetak", () => {
    // Lima: tiga butir induk ditambah dua anak butir.
    expect(barisCetak(sepertiSipp(rapi))).toBe(5);
  });

  it("pemisahnya <p>, BUKAN <br> - <br> disapu SIPP tanpa bekas", () => {
    expect(rapi).toContain("</p>");
    expect(rapi).not.toContain("<br>");
  });

  it("<br> membuktikan dirinya sendiri: tanpa <p>, yang tercetak satu gumpalan", () => {
    // Inilah bentuk yang dipakai sebelumnya. Diuji supaya sebabnya tercatat,
    // dan supaya siapa pun yang hendak kembali ke <br> melihat akibatnya.
    const denganBr = POSITA_MENGGUMPAL.replace(/;(?=\d)/g, ";<br>");
    expect(barisCetak(sepertiSipp(denganBr))).toBe(1);
  });

  it("butir pertama berbentuk PERSIS <p>1. - itu yang menyalakan lekukan blok", () => {
    // str_replace("<p>1.", "\\pard \\qj \\li630 \\linestarts 1. ") - satu
    // pemicu di awal melekukkan seluruh daftar, sebab sifat paragraf RTF
    // bertahan melewati \par.
    expect(rapi.startsWith("<p>1.")).toBe(true);
    expect(sepertiSipp(rapi)).toContain("\\li630");
  });

  it("anak butir diberi lekukan tambahan - di ABT tiga spasi menjadi \\tab", () => {
    expect(rapi).toContain("<p>   a.");
    expect(rapi).toContain("<p>   b.");
  });

  it("tidak satu huruf pun gugatan berubah", () => {
    // Pagar yang sama dengan yang menjaga penulisannya ke SIPP.
    expect(hanyaHuruf(rapi)).toBe(hanyaHuruf(POSITA_MENGGUMPAL));
  });
});

describe("posita yang sudah berparagraf tidak disusun ulang", () => {
  // 6.269 dari 8.097 posita di PA Donggala sudah memakai <p> dan tercetak
  // rapi selama ini. Menyusunnya ulang mempertaruhkan semuanya demi yang tidak.
  const sudahRapi = "<p>1. Bahwa pertama;</p><p>2. Bahwa kedua;</p>";

  it("dibiarkan apa adanya", () => {
    expect(layanan.rapikanTeksPosita(sudahRapi)).toBe(sudahRapi);
  });

  it("yang paragraf pertamanya berlekuk dirapatkan, supaya <p>1. menyala", () => {
    const berlekuk = '<p style="margin:0"> 1. Bahwa pertama;</p><p>2. Bahwa kedua;</p>';
    const hasil = layanan.rapikanTeksPosita(berlekuk);
    expect(hasil.startsWith("<p>1.")).toBe(true);
    expect(sepertiSipp(hasil)).toContain("\\li630");
  });
});
