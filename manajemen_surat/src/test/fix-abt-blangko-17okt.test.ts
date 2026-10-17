// @vitest-environment node
/**
 * Perbaikan temuan audit ABT (17 Okt 2026) - tema blangko Derry:
 * C1 rekomendasi relaas ikrar, C5 jenisFolderDerry, C4 NAMA_URUT, C2/C3 perkara saya, C6 hak dokumen di rute.
 */
import { describe, expect, it } from "vitest";

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
