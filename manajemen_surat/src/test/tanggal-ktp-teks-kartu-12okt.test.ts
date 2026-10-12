// @vitest-environment jsdom
/**
 * Kartu usulan (kartuUsulan di ekstensi-sipp/abt.js) dengan DOM sungguhan: centang awal mengikuti `awal`
 * (tanggal KTP, 12 Okt 2026 butir 9-10), lencana, sumber "KTP e-Court", dan usulan lain TIDAK berubah.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type Apa = any;
const AKAR = path.resolve(__dirname, "../../..");
const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");

const awalBuat = sumber.indexOf("function buatElemen(");
const buatKode = sumber.slice(awalBuat, sumber.indexOf("\n}\n", awalBuat) + 3);
const awalNada = sumber.indexOf("const NADA_KEYAKINAN = {");
const kartuKode = sumber.slice(awalNada, sumber.indexOf("/* === KAMUS-DB 10 Okt === */", awalNada));

function pasang(): Apa {
  const f = new Function("document", "suntingLangsungSekarang", `${buatKode}\n${kartuKode}\nreturn { kartuUsulan };`);
  return f(document, async () => true);
}
const K = pasang();

function kartu(u: Apa, sekarang = "") {
  const pilih: Apa[] = [];
  const el: HTMLElement = K.kartuUsulan(u, sekarang, pilih);
  return { el, pilih, centang: el.querySelector("input.aleta-abt-centang") as HTMLInputElement, lencana: el.querySelector(".aleta-tanda")?.textContent };
}
const ktp = (lebih: Apa) => ({
  kode: "0364",
  nama: "Tanggal KTP Pemohon I",
  nilai: "18/02/2012",
  sumber: [{ asal: "ktp-ecourt", keterangan: "e-Court: KTP Pemohon I (Siti) — NIK sama dengan SIPP" }],
  ...lebih,
});

describe("kartuUsulan: tanggal KTP terisi otomatis (centang awal) hanya bila yakin dan isian kosong", () => {
  it("cukup + awal:true = TERCENTANG, lencana hijau 'dari berkas KTP e-Court', sumber diberi nama 'KTP e-Court'", () => {
    const k = kartu(ktp({ keyakinan: "cukup", awal: true }), "(kosong)");
    expect(k.centang.checked).toBe(true);
    expect(k.centang.disabled).toBe(false);
    expect(k.lencana).toBe("dari berkas KTP e-Court");
    expect(k.el.querySelector(".aleta-tanda-hijau")).not.toBeNull();
    expect(k.el.querySelector(".aleta-abt-asal")?.textContent).toBe("KTP e-Court");
  });

  it("isian petugas ada dan beda (awal:false, ocr) = TIDAK tercentang; ragu = tidak tercentang; awal:false walau cukup = tidak tercentang", () => {
    expect(kartu(ktp({ keyakinan: "ocr", awal: false }), "20 Mei 2020").centang.checked).toBe(false);
    expect(kartu(ktp({ keyakinan: "ragu", awal: false }), "").centang.checked).toBe(false);
    expect(kartu(ktp({ keyakinan: "cukup", awal: false }), "20 Mei 2020").centang.checked).toBe(false);
    // `awal` benar tidak pernah memaksa centang untuk bacaan ragu atau bentrok
    expect(kartu(ktp({ keyakinan: "ragu", awal: true })).centang.checked).toBe(false);
    expect(kartu(ktp({ keyakinan: "bentrok", awal: true })).centang.checked).toBe(false);
  });

  it("usulan variabel teks: tercentang walau blangko sudah berisi (hanya bagian tanggalnya yang diisi); tanpa nilai = tidak dapat dicentang", () => {
    const teks = ktp({ kode: "1214", nama: "Alat-alat bukti CG/CT", nilai: "Fotokopi KTP ... tanggal 18 Februari 2012, yang", keyakinan: "cukup", awal: true });
    expect(kartu(teks, "Fotokopi KTP ... tanggal ..., yang").centang.checked).toBe(true);
    const kosong = kartu({ ...teks, nilai: "" });
    expect(kosong.centang.checked).toBe(false);
    expect(kosong.centang.disabled).toBe(true);
  });

  it("usulan LAMA tanpa `awal` berperilaku sama seperti sebelumnya (cukup tercentang; ragu/ocr/bentrok tidak)", () => {
    const lama = (keyakinan: string) => kartu({ kode: "0222", nama: "Awal Konflik", nilai: "sejak 2020", keyakinan, sumber: [] }).centang.checked;
    expect(lama("pasti")).toBe(true);
    expect(lama("cukup")).toBe(true);
    expect(lama("ragu")).toBe(false);
    expect(lama("ocr")).toBe(false);
    expect(lama("bentrok")).toBe(false);
    // posita cukup tetap berlabel 'dari posita', bukan KTP
    const posita = kartu({ kode: "0222", nama: "x", nilai: "y", keyakinan: "cukup", sumber: [{ asal: "posita", kalimat: "k" }] });
    expect(posita.lencana).toBe("dari posita");
    expect(posita.el.querySelector(".aleta-abt-asal")?.textContent).toBe("Posita");
  });

  it("kartu mendaftarkan dirinya ke daftar pilihan dengan nilai terkini (yang dipakai Input ke ABT)", () => {
    const k = kartu(ktp({ keyakinan: "cukup", awal: true }));
    expect(k.pilih).toHaveLength(1);
    expect(k.pilih[0].nilai()).toBe("18/02/2012");
    expect(k.pilih[0].disunting()).toBe(false);
  });
});
