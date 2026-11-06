// @vitest-environment node
/**
 * PERBAIKAN AUDIT 6 NOV 2026 - S-02: isian Harta Bersama 12180-12182 (banyak paragraf) tidak boleh diratakan panel.
 * Dijaga dengan fungsi sungguhan dari ekstensi: rapiSimpan (blangko-derry-isian.js) dan daftar kode (isi-sipp-bersama.js).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const req = createRequire(import.meta.url);
type Apa = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const SK: Apa = req(path.join(EKSTENSI, "blangko-derry-saksi.js"));
const ISIAN = baca("blangko-derry-isian.js");
const ctx: Apa = {};
ctx.globalThis = ctx;
vm.runInNewContext(baca("isi-sipp-bersama.js"), ctx);
const MESIN: Apa = ctx.AletaIsiSipp;

function irisan(awal: string, akhir: string): string {
  const a = ISIAN.indexOf(awal);
  const b = ISIAN.indexOf(akhir, a + awal.length);
  if (a < 0 || b < 0) throw new Error(`tidak ditemukan: ${awal}`);
  return ISIAN.slice(a, b);
}
const rapiSimpan = new Function("mesinIsi", "SK", "isianBlangko", `${irisan("function rapiSimpan(kode, nilai) {", "  async function simpanIsian(kode, nilai) {")}; return rapiSimpan;`)(
  () => MESIN,
  () => SK,
  (k: string) => ({ kode: k, jenis: "teks", nama: `Isian ${k}` })
) as (kode: string, nilai: string) => string;

const TIGA = "Saksi menerangkan bahwa objek dikuasai Tergugat; pembelian dilakukan tahun 2015.\n\n  Saksi lain  membenarkan;   tidak ada utang.\nParagraf ketiga   ";

describe("S-02: isian panjang Harta Bersama tetap berparagraf", () => {
  it("12180-12182 dikenal sebagai isian banyak paragraf, terpisah dari naskah jawab-menjawab", () => {
    expect([...MESIN.KODE_PARAGRAF_ISIAN]).toEqual(["12180", "12181", "12182"]);
    for (const k of MESIN.KODE_PARAGRAF_ISIAN) {
      expect(MESIN.KODE_NASKAH_BERBARIS).not.toContain(k);
      expect(MESIN.KODE_TEKS_PIHAK).not.toContain(k);
    }
  });
  it("rapiSimpan menjaga satu baris satu paragraf, membuang baris kosong, merapatkan spasi, tidak mengubah titik koma", () => {
    for (const k of ["12180", "12181", "12182"]) {
      expect(rapiSimpan(k, TIGA)).toBe("Saksi menerangkan bahwa objek dikuasai Tergugat; pembelian dilakukan tahun 2015.\nSaksi lain membenarkan; tidak ada utang.\nParagraf ketiga");
      expect(rapiSimpan(k, rapiSimpan(k, TIGA))).toBe(rapiSimpan(k, TIGA));
    }
  });
  it("isian teks lain tetap aturan rapi 30 Okt (dirangkai satu baris, titik koma tengah jadi koma)", () => {
    expect(rapiSimpan("5105", "Kantor Urusan Agama;\nKecamatan Contoh")).toBe("Kantor Urusan Agama, Kecamatan Contoh");
    expect(rapiSimpan("12179", TIGA)).not.toContain("\n");
  });
  it("kode naskah jawab-menjawab tidak ikut berubah dan 9881 tidak terpicu isian Harta Bersama", () => {
    expect([...MESIN.KODE_NASKAH_BERBARIS]).toEqual(["12020", "12021", "12022", "12023", "12024", "12025", "12026", "12027", "12028"]);
  });
  it("kotak isian selalu textarea lebar, supaya Enter dapat diketik walau masih kosong", () => {
    const m = /const KODE_LEBAR = new Set\(\[([^\]]*)\]\)/.exec(ISIAN);
    expect(m).not.toBeNull();
    for (const k of ["12180", "12181", "12182"]) expect(m![1]).toContain(`"${k}"`);
  });
});
