// @vitest-environment node
import { describe, expect, it } from "vitest";

import { pilihBlangkoBas, type KatalogFolder } from "@/app/api/aleta-ecourt/bas-massal/susun";
import { JENIS_BAS_BAKU, KEADAAN_BAS_BAKU, KUNCI_BAKU, KUNCI_BAKU_BAS, nilaiKunciBas, pilihBlangkoBasPeta } from "@/lib/pemetaan-blangko";
import { BAWAAN_PETA_PENETAPAN, BERKAS_PTSP_GABUNGAN } from "@/lib/peta-penetapan";
import { cariBerkasBasJenis } from "@/lib/salinan-bas-jenis";

/**
 * ============================================================================
 * PEMETAAN BLANGKO BAS UNTUK SEMUA FOLDER "<jenis> - BAS" (Q3, 16 Okt 2026; peta perkara L3, usulan 5) dan PTSP PPP/PJS (usulan 4)
 * ============================================================================
 */

describe("JENIS_BAS_BAKU mengikuti folder '<jenis> - BAS'", () => {
  it("18 jenis; kunci baku 11 keadaan per jenis; kunci jenis baru dikenal dan dipilih menurut jenis perkara SIPP (dengan padanan ejaan)", () => {
    expect(JENIS_BAS_BAKU).toHaveLength(26); // W3b 21 Okt: + 5 jenis keluarga/wali (353, 355, 356, 357, 350); I28 18 Okt: + Hibah, Wakaf, Penetapan Mafqud; I23 18 Okt: + Nafkah Anak Pasca Perceraian (6c); 12 + Penguasaan Anak (hak asuh), Pembatalan Perkawinan, Ekonomi Syariah (F21 17 Okt) + Pencegahan Perkawinan, Wasiat (F22 17 Okt)
    expect(KUNCI_BAKU_BAS).toHaveLength(26 * KEADAAN_BAS_BAKU.length);
    expect(KUNCI_BAKU.bas).toHaveLength(26 * KEADAAN_BAS_BAKU.length);
    for (const jenis of ["Dispensasi Kawin", "Penetapan Ahli Waris", "Perwalian", "Wali Adhal", "Lain-Lain", "Harta Bersama", "Kewarisan", "Poligami", "Penguasaan Anak", "Pembatalan Perkawinan", "Ekonomi Syariah"]) {
      expect(JENIS_BAS_BAKU as readonly string[]).toContain(jenis);
      expect(KUNCI_BAKU_BAS.some((k) => k.kunci === `${jenis}|1|semua-hadir`)).toBe(true);
    }
    // nama SIPP yang berbeda ejaan tetap cocok ke kunci baku
    const sidang = (jenisPerkara: string) => ({ jenisPerkara, urutanSidang: 1, dihadiriOleh: 1 as number | null });
    expect(nilaiKunciBas("Penetapan Ahli Waris|1|semua-hadir", sidang("P3HP/Penetapan Ahli Waris"))).toBeGreaterThan(0);
    expect(nilaiKunciBas("Wali Adhal|1|semua-hadir", sidang("Wali Adhol"))).toBeGreaterThan(0);
    expect(nilaiKunciBas("Poligami|1|semua-hadir", sidang("Izin Poligami"))).toBeGreaterThan(0);
    expect(nilaiKunciBas("Perwalian|1|semua-hadir", sidang("Cerai Gugat"))).toBe(-1);
  });
});

describe("cariBerkasBasJenis: nama yang dipetakan -> berkas di folder BAS jenis perkara", () => {
  it("nama BAS baru langsung (PAW) ditemukan hanya untuk jenis perkaranya", () => {
    const nama = "BAS ALUR 14 PAW - [1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang).rtf";
    const s = cariBerkasBasJenis(nama, "P3HP/Penetapan Ahli Waris");
    expect(s).toMatchObject({ folder: "derry_briantono/9 Penetapan Ahli Waris - BAS", berkas: nama, menu: "Penetapan Ahli Waris (P3HP) - BAS" });
    expect(cariBerkasBasJenis(nama, "Perwalian")).toBeNull();
    // huruf besar/kecil, spasi ganda dan .rtf tidak dibedakan
    expect(cariBerkasBasJenis(nama.toLowerCase().replace(".rtf", "").replace(/ /g, "  "), "P3HP/Penetapan Ahli Waris")?.berkas).toBe(nama);
  });

  it("nama salinan ('BAS ALUR 04 [2] ...') dan nama asal di folder ALUR ('[2] BAS 2 ...') sama-sama dikenali bila jelas satu berkas", () => {
    const salinan = cariBerkasBasJenis("BAS ALUR 12 [1] BAS DK - Anak Perempuan Hamil.rtf", "Dispensasi Kawin");
    expect(salinan).toMatchObject({ folder: "derry_briantono/3 Dispensasi Kawin - BAS", berkas: "BAS ALUR 12 [1] BAS DK - Anak Perempuan Hamil.rtf" });
    const asal = cariBerkasBasJenis("[1] BAS DK - Anak Perempuan Hamil.rtf", "Dispensasi Kawin");
    expect(asal?.berkas).toBe("BAS ALUR 12 [1] BAS DK - Anak Perempuan Hamil.rtf");
    // nama asal ALUR 04 ada di banyak folder jenis yang sama isinya tetapi untuk SATU jenis perkara hanya satu folder -> jelas
    const kontra = cariBerkasBasJenis("[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf", "Harta Bersama");
    expect(kontra?.folder).toBe("derry_briantono/4a Harta Bersama - BAS");
    expect(cariBerkasBasJenis("tidak ada berkas begini.rtf", "Dispensasi Kawin")).toBeNull();
    expect(cariBerkasBasJenis("", "Dispensasi Kawin")).toBeNull();
    // jenis perkara yang tak terbaca: tidak menebak folder
    expect(cariBerkasBasJenis("BAS ALUR 12 [1] BAS DK - Anak Perempuan Hamil.rtf", "")).toBeNull();
  });

  it("pemetaan admin untuk jenis tanpa set arsip kini menjadi usulan (dulu: 'tidak ada di katalog')", () => {
    const nama = "BAS ALUR 12 [1] BAS DK - Anak Perempuan Hamil.rtf";
    const katalog: Record<string, KatalogFolder> = {};
    const h = pilihBlangkoBas({
      jenisPerkara: "Dispensasi Kawin",
      urutanSidang: 1,
      dihadiriOleh: 1,
      katalog,
      petaBas: { "Dispensasi Kawin|1|semua-hadir": nama },
    });
    expect(h.usulan).toMatchObject({ dariPemetaan: "Dispensasi Kawin|1|semua-hadir", folder: "derry_briantono/3 Dispensasi Kawin - BAS", berkas: nama });
    expect(h.usulan?.salinan?.[0]).toMatchObject({ menu: "Dispensasi Kawin - BAS", alias: "Diska/DK - BAS" });
    expect(h.sebab).toBe("");
    // nama yang tidak dikenal tetap tidak ditebak
    const salah = pilihBlangkoBas({ jenisPerkara: "Dispensasi Kawin", urutanSidang: 1, dihadiriOleh: 1, katalog, petaBas: { "Dispensasi Kawin|1|semua-hadir": "Tidak Ada.rtf" } });
    expect(salah.usulan).toBeNull();
    expect(salah.sebab).toMatch(/tidak ada di katalog/);
    // pilihBlangkoBasPeta murni tidak berubah
    expect(pilihBlangkoBasPeta({ "Dispensasi Kawin|1|semua-hadir": nama }, { jenisPerkara: "Dispensasi Kawin", urutanSidang: 1, dihadiriOleh: 1 })?.namaBerkas).toBe(nama);
  });
});

describe("PTSP: PPP dan PJS lewat '@ 0 - PMH - PHS' (usulan 4)", () => {
  it("peta penetapan bawaan PPP/PJS aktif dengan blangko gabungan, tanpa unggah otomatis; PMH/PHS tidak berubah", () => {
    expect(BERKAS_PTSP_GABUNGAN).toBe("@ 0 - PMH - PHS.rtf");
    for (const j of ["ppp", "pjs"] as const) {
      // I9 17 Okt: berkas tunggal @ 0a / @ 0b; gabungan @ 0 menjadi cadangan (pemetaan-i9-17okt.test.ts).
      expect(BAWAAN_PETA_PENETAPAN[j]).toMatchObject({ aktif: true, namaBerkas: j === "ppp" ? "@ 0a - PPP.rtf" : "@ 0b - PJS.rtf", namaBerkasCadangan: "@ 0 - PMH - PHS.rtf", otomatisUnggah: false, penandatangan: "panitera", pakaiCap: true });
    }
    expect(BAWAAN_PETA_PENETAPAN.pmh).toMatchObject({ aktif: true, namaBerkas: "@ 1 - PMH.rtf", otomatisUnggah: true });
    expect(BAWAAN_PETA_PENETAPAN.phs).toMatchObject({ aktif: true, namaBerkas: "@ 2 - PHS.rtf", otomatisUnggah: true, penandatangan: "ketua_majelis" });
  });
});
