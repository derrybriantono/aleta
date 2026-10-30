// @vitest-environment jsdom
/**
 * 30 Okt 2026 (keputusan pengguna): paket ABT alasan-belum-dipilih-30okt mengganti bunyi cabang terakhir 10 variabel alasan
 * perceraian ("TIDAK BENAR QUERY NYA ...") menjadi "[HURUF ALASAN PERCERAIAN BELUM DIPILIH]". Pengenal di ekstensi harus mengenali
 * bunyi BARU dan bunyi LAMA (server yang belum dipasang paket):
 *   1. keadaanNilai panel ABT (abt-panel-blangko.js) -> "galat" untuk keduanya, di mana pun letaknya;
 *   2. pemeriksa sebelum cetak (deteksi-sisa-blangko.js) menemukan bunyi baru dalam naskah RTF;
 *   3. peringatan kotak huruf alasan di panel Blangko Derry menyebut bunyi baru, tanpa angka empat digit telanjang.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const EKS = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");
const BARU = "[HURUF ALASAN PERCERAIAN BELUM DIPILIH]";

function potong(isi: string, buka: string, tutup: string): string {
  const a = isi.indexOf(buka);
  if (a < 0) throw new Error(`penanda pembuka tidak ditemukan: ${buka}`);
  const b = isi.indexOf(tutup, a);
  if (b < 0) throw new Error(`penanda penutup tidak ditemukan: ${tutup}`);
  return isi.slice(a, b + tutup.length);
}

describe("bunyi baru alasan perceraian belum dipilih dikenali bersama bunyi lama", () => {
  it("panel ABT: keadaanNilai menggolongkan bunyi baru dan lama sebagai galat", () => {
    const sumber = potong(baca("abt-panel-blangko.js"), "const NILAI_KOSONG = new Set(", 'return "terisi";\n}');
    const keadaanNilai = new Function(`${sumber}\nreturn keadaanNilai;`)() as (n: unknown) => string;
    expect(keadaanNilai(BARU)).toBe("galat");
    expect(keadaanNilai(`Menimbang, bahwa ${BARU};`)).toBe("galat");
    expect(keadaanNilai("huruf alasan perceraian belum dipilih")).toBe("galat");
    expect(keadaanNilai("TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT")).toBe("galat");
    expect(keadaanNilai("TIDAK BENAR QUERY NYA")).toBe("galat");
    expect(keadaanNilai("Menimbang, bahwa alasan perceraian telah terbukti;")).toBe("terisi");
  });

  it("pemeriksa sebelum cetak menemukan bunyi baru di naskah", () => {
    const d = createRequire(path.join(EKS, "x.js"))("./deteksi-sisa-blangko.js") as Record<string, unknown>;
    expect(d).toBeTruthy();
    const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\pard Menimbang, bahwa ${BARU};\\par\\pard Menimbang, bahwa perkawinan telah terbukti;\\par}`;
    const periksa = d.periksaRtf as (x: unknown) => { temuan: Array<{ jenis: string }> };
    expect(typeof periksa).toBe("function");
    const h = periksa(rtf);
    expect(h.temuan.length).toBeGreaterThan(0);
    expect(h.temuan.some((t) => t.jenis === "kurung")).toBe(true);
  });

  it("peringatan kotak huruf alasan (panel Blangko Derry) menyebut bunyi baru dan lama, tanpa angka empat digit", () => {
    const js = baca("blangko-derry-isian.js");
    const m = js.match(/if \(!v\) return "(Alasan perceraian belum dipilih\.[^\n]*?)";\n/);
    expect(m).toBeTruthy();
    const teks = m![1].replace(/\\"/g, '"');
    expect(teks).toContain(BARU);
    expect(teks).toContain("TIDAK BENAR QUERY NYA");
    expect(teks).not.toMatch(/\b\d{4}\b/);
  });
});
