// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN TEMUAN AUDIT abt-klien.js (17 Okt 2026)
 * ============================================================================
 *
 *   D5  tanggal ABT "15-10-2026" (tanda hubung) dikenali di bacaan popup dan di verifikasi simpanIsian
 *   D7  galat PHP mentah ABT tidak sampai ke petugas - kalimat awam; rincian teknis hanya di console
 *
 * Jaringan ABT TIRUAN; tidak ada yang ditulis ke ABT sungguhan.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const req = createRequire(import.meta.url);
const K = req(path.resolve(process.cwd(), "../ekstensi-sipp/abt-klien.js"));

afterEach(() => vi.restoreAllMocks());

const popupTanggal = (nilai: string) =>
  `<input type="hidden" name="var_type" value="data_tanggal">` +
  `<tr><td>Nomor Variabel</td><td>: 0033</td></tr><tr><td>Nama Variabel</td><td>: Tanggal Sidang</td></tr>` +
  `<input type='text' id='tgl_form' value='${nilai}'>`;

describe("D5. tanggal ABT dengan tanda hubung", () => {
  it("popup data_tanggal: 15/10/2026 dan 15-10-2026 sama-sama terbaca sebagai 2026-10-15", () => {
    expect(K.abtKlienUraiPopupData(popupTanggal("15/10/2026")).nilaiTanggal).toBe("2026-10-15");
    expect(K.abtKlienUraiPopupData(popupTanggal("15-10-2026")).nilaiTanggal).toBe("2026-10-15");
    expect(K.abtKlienUraiPopupData(popupTanggal("15.10.2026")).nilaiTanggal).toBe("2026-10-15");
    expect(K.abtKlienUraiPopupData(popupTanggal("31-02-2026")).nilaiTanggal).toBe("");
  });

  it("simpanIsian tanggal: bacaan ulang ABT berbentuk 15-10-2026 tetap terverifikasi", async () => {
    let tersimpan = false;
    const ambil = async (url: string, init?: { method?: string; body?: unknown }) => {
      const isi =
        init && init.method === "POST"
          ? ((tersimpan = true), "<b>DATA DISIMPAN</b>")
          : popupTanggal(tersimpan ? "15-10-2026" : "01-01-2026");
      return { status: 200, text: async () => isi, headers: { get: () => "" } };
    };
    const klien = K.abtKlienBuat({ ambil, asal: "http://abt.test/abt" });
    const h = await klien.simpanIsian("0033", "10018", "2026-10-15");
    expect(h.tersimpan).toBe(true);
    expect(h.terverifikasi).toBe(true);
    expect(h.ok).toBe(true);
  });
});

describe("D7. galat PHP mentah ABT", () => {
  const phpMentah =
    '<div style="border:1px solid #990000"><h4>A PHP Error was encountered</h4><p>Severity: Warning</p>' +
    "<p>Message: mysql_connect(): Access denied for user 'abt'@'localhost'</p><p>Filename: models/Abt_model.php</p><p>Line Number: 1234</p></div>";

  it("petugas hanya membaca kalimat awam; rincian PHP tidak ikut pesan", () => {
    const peringatan = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = K.abtKlienSebabBukanJawaban(phpMentah);
    expect(s.jenis).toBe("galat-php");
    expect(s.pesan).not.toMatch(/PHP|Severity|Message|Filename|Line Number|mysql|Access denied|Abt_model/i);
    expect(s.pesan).toMatch(/ABT/);
    // rincian teknis cukup di console
    expect(peringatan).toHaveBeenCalled();
    expect(String(peringatan.mock.calls[0].join(" "))).toMatch(/Access denied/);
  });

  it("jawaban sah dan galat lain tidak ikut terpengaruh", () => {
    expect(K.abtKlienSebabBukanJawaban("<html>Beranda</html>")).toBeNull();
    expect(K.abtKlienSebabBukanJawaban("<h3>ERROR Variabel #0046#</h3>").jenis).toBe("galat-variabel");
  });
});
