// @vitest-environment node
/**
 * Perbaikan temuan audit ABT (17 Okt 2026) - tema blangko Derry:
 * C1 rekomendasi relaas ikrar, C5 jenisFolderDerry, C4 NAMA_URUT, C2/C3 perkara saya, C6 hak dokumen di rute.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { jenisFolderDerry } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

describe("C1. relaas sidang ikrar talak: ikrar diperiksa sebelum sudahPutus", () => {
  it("cerai talak, sudah putus (izin ikrar), sidang ikrar ditunda -> panggilan ikrar talak kedua pihak, bukan pemberitahuan putusan", () => {
    const r = rekomendasiBlangko({
      jenisPerkara: "Cerai Talak",
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      urutanSidang: 6,
      dihadiriOleh: 2,
      sudahPutus: true,
      statusPutusan: "Dikabulkan",
      sidangIkrarTalak: true,
      ditunda: true,
      agenda: "Sidang ikrar talak",
    });
    const alasan = r.relaas.map((x) => x.alasan).join(" | ");
    expect(alasan).toMatch(/ikrar talak/i);
    expect(alasan).not.toMatch(/Pemberitahuan isi putusan/i);
    expect(r.relaas.filter((x) => x.utama).map((x) => x.berkas)).toEqual(["[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf"]);
  });
});

describe("C5. jenisFolderDerry atas nama folder server 17 Okt", () => {
  const fx = JSON.parse(readFileSync(path.resolve(process.cwd(), "src/test/fixtures/blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
  const folder = [...new Set(fx.berkas.map((b) => b.match(/^derry_briantono\/([^/]+)\//)?.[1] ?? "").filter(Boolean))];

  it("98 Relaas = rel, 99 PTSP = ptsp (awalan angka)", () => {
    expect(jenisFolderDerry("98 Relaas")).toBe("rel");
    expect(jenisFolderDerry("99 PTSP")).toBe("ptsp");
  });
  it("folder '<Jenis> - BAS' = bas; folder putusan '<Jenis>' = put", () => {
    expect(jenisFolderDerry("1 Perceraian CG - BAS")).toBe("bas");
    expect(jenisFolderDerry("6a Hak Asuh Anak (Hadhanah) - BAS")).toBe("bas");
    expect(jenisFolderDerry("1 Perceraian CG")).toBe("put");
  });
  it("seluruh folder fixture server: bas/rel/ptsp sesuai nama, sisanya put", () => {
    expect(folder.length).toBeGreaterThan(40);
    const salah = folder.filter((f) => {
      const harap = /^(98 )?Relaas$/i.test(f) ? "rel" : /^(99 )?PTSP$/i.test(f) ? "ptsp" : /(^|\s)-\s*BAS(\s|-|$)|^ALUR \d|^BAS /i.test(f) ? "bas" : "put";
      return jenisFolderDerry(f) !== harap;
    });
    expect(salah).toEqual([]);
    expect(folder.filter((f) => jenisFolderDerry(f) === "put").length).toBeGreaterThan(10);
  });
});
