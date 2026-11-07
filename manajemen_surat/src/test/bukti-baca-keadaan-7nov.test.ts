import { describe, expect, it } from "vitest";

import { bacaDariNaskah } from "@/components/portal/bukti-aleta-abt";

const alinea = (...teks: string[]) => teks.map((t) => ({ teks: t }));

/**
 * Keadaan putusan dibaca dari AMAR. Kasus nyata 7 Nov 2026: putusan cerai gugat verstek yang Dikabulkan terbaca "Ditolak" karena
 * majelis mengutip kaidah fikih "Menolak kemudaratan ... lebih diutamakan" di pertimbangan dan petitum "Mengabulkan gugatan" di duduk perkara.
 */
describe("bacaDariNaskah: keadaan putusan dari amar", () => {
  const pertimbangan = [
    "Bahwa Penggugat mohon: 1.Mengabulkan gugatan Penggugat; 2.Menjatuhkan talak satu ba'in shughra",
    "Menimbang, kaidah fikih yang diambil alih sebagai pendapat Majelis Hakim: Menolak kemudaratan (keburukan) lebih diutamakan dari pada meraih kemaslahatan (kebaikan);",
  ];

  it("Dikabulkan verstek tidak terbaca Ditolak walau fikih memuat kata menolak", () => {
    const h = bacaDariNaskah(alinea(...pertimbangan, "MENGADILI", "1.Menyatakan Tergugat tidak hadir;", "2.Mengabulkan gugatan Penggugat secara verstek;"));
    expect(h.status).toBe("Dikabulkan");
    expect(h.verstek).toBe(true);
  });

  it("Dikabulkan kontradiktoir", () => {
    expect(bacaDariNaskah(alinea(...pertimbangan, "MENGADILI", "1.Mengabulkan gugatan Penggugat;")).status).toBe("Dikabulkan");
  });

  it("amar memuat Menolak gugatan selain dan selebihnya: Dikabulkan sebagian", () => {
    const h = bacaDariNaskah(alinea("MENGADILI", "1.Mengabulkan gugatan Penggugat sebagian;", "2.Menolak gugatan Penggugat untuk selain dan selebihnya;"));
    expect(h.status).toBe("Dikabulkan sebagian");
  });

  it("eksepsi ditolak lalu pokok dikabulkan terbaca Dikabulkan", () => {
    const h = bacaDariNaskah(alinea("MENGADILI", "Dalam Eksepsi: Menolak eksepsi Tergugat;", "Dalam Pokok Perkara: Mengabulkan gugatan Penggugat;"));
    expect(h.status).toBe("Dikabulkan");
  });

  it("Ditolak: amar hanya Menolak gugatan", () => {
    expect(bacaDariNaskah(alinea("petitum: Mengabulkan gugatan", "MENGADILI", "Menolak gugatan Penggugat;")).status).toBe("Ditolak");
  });

  it("Menolak permohonan pada perkara permohonan", () => {
    expect(bacaDariNaskah(alinea("MENGADILI", "Menolak permohonan Pemohon;")).status).toBe("Ditolak");
  });

  it("Tidak Dapat Diterima dan Dicabut dibaca dari amar, bukan dari eksepsi di pertimbangan", () => {
    expect(bacaDariNaskah(alinea("MENGADILI", "Menyatakan gugatan Penggugat tidak dapat diterima;")).status).toBe("Tidak Dapat Diterima");
    expect(bacaDariNaskah(alinea("MENGADILI", "Menyatakan perkara dicabut;")).status).toBe("Dicabut");
    expect(bacaDariNaskah(alinea("Tergugat berpendapat gugatan tidak dapat diterima;", "MENGADILI", "Mengabulkan gugatan Penggugat;")).status).toBe("Dikabulkan");
  });

  it("tanpa kata MENGADILI seluruh naskah dibaca seperti semula", () => {
    expect(bacaDariNaskah(alinea("Majelis mengabulkan gugatan Penggugat")).status).toBe("Dikabulkan");
    expect(bacaDariNaskah(alinea("Majelis menolak gugatan Penggugat")).status).toBe("Ditolak");
    expect(bacaDariNaskah(alinea("tidak ada amar")).status).toBe("");
  });
});
