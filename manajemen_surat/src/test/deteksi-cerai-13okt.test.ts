// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Deteksi cerai gugat/talak dari posita (aleta_bot/services/deteksi/cerai.js, 13 Okt 2026, butir 16).
 * Kalimat berbentuk posita CG satker PA Donggala (nama orang diganti; nama wilayah apa adanya).
 * Ukur atas isian manusia (sipp_donggala lokal): 5105 CG 24/28 benar, CT 3/3; 0007 CG 19/22, CT 11/11;
 * 5105 terbaca pada 1.268 dari 1.334 posita cerai 2025-2026.
 */

type Fakta = Record<string, { nilai: string }>;
type Usulan = { kode: string; nilai: string; keyakinan: string };
const C = createRequire(import.meta.url)(path.resolve(process.cwd(), "../aleta_bot/services/deteksi/cerai.js")) as {
  deteksi: (p: string, o?: object) => Fakta;
  tambahUsulanCerai: (d: Usulan[], p: string) => Usulan[];
  variabel: Array<{ kode: string; sumber: string }>;
};

const POSITA_BAKU = [
  "Bahwa pada tanggal 16 Juni 2025, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama (KUA) Kecamatan Marawola, Kabupaten Sigi, Provinsi Sulawesi Tengah, sebagaimana sesuai dengan Kutipan Akta Nikah Nomor : 7210141062025015;",
  "Bahwa setelah menikah, Penggugat dan Tergugat tinggal bersama di rumah Penggugat di Desa Beka hingga pisah rumah;",
  "Bahwa selama pernikahan Penggugat dan Tergugat telah dikaruniai 2 (dua) orang anak;",
  "Bahwa sejak pisah rumah Penggugat dan Tergugat sudah tidak pernah berkomunikasi lagi;",
].join("\n");

describe("deteksi/cerai.js", () => {
  it("bentuk baku 'dicatat oleh Pegawai Pencatat Nikah pada KUA': tempat = wilayah KUA; tempat tinggal bukan tempat menikah", () => {
    const f = C.deteksi(POSITA_BAKU);
    expect(f["5105"].nilai).toBe("wilayah hukum Kantor Urusan Agama Kecamatan Marawola, Kabupaten Sigi, Provinsi Sulawesi Tengah");
    expect(f["0007"].nilai).toBe("telah dikaruniai 2 (dua) orang anak");
    expect(f["1267"].nilai).toBe("tidak berkomunikasi lagi");
  });
  it("bentuk 'menikah di Desa X wilayah hukum KUA Kecamatan Y'", () => {
    const f = C.deteksi(
      "Bahwa pada hari Minggu, tanggal 10 Maret 2013, Penggugat dengan Tergugat melangsungkan pernikahan menurut agama Islam di Desa Oti wilayah hukum Kantor Urusan Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah;"
    );
    expect(f["5105"].nilai).toBe("Desa Oti, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah");
  });
  it("kalimat tempat tinggal saja tidak menghasilkan tempat menikah; tanpa kata komunikasi = kosong", () => {
    const f = C.deteksi("Bahwa setelah menikah Penggugat dan Tergugat bertempat tinggal di rumah Penggugat di Desa Bukit Indah selama 2 tahun;");
    expect(f["5105"]).toBeUndefined();
    expect(f["1267"]).toBeUndefined();
  });
  it("tambahUsulanCerai: hanya menambah yang belum ada; 5127 = salinan 5227", () => {
    const awal: Usulan[] = [
      { kode: "0007", nilai: "telah dikaruniai 1 orang anak", keyakinan: "cukup" },
      { kode: "5227", nilai: "Tergugat kurang memberi nafkah", keyakinan: "cukup" },
    ];
    const h = C.tambahUsulanCerai(awal, POSITA_BAKU);
    expect(h.filter((u) => u.kode === "0007")).toHaveLength(1);
    expect(h.find((u) => u.kode === "0007")!.nilai).toBe("telah dikaruniai 1 orang anak");
    expect(h.find((u) => u.kode === "5127")!.nilai).toBe("Tergugat kurang memberi nafkah");
    expect(h.find((u) => u.kode === "5105")).toBeTruthy();
  });
  it("peta variabel -> sumber memuat variabel yang belum terdeteksi beserta sebabnya", () => {
    const kode = C.variabel.map((v) => v.kode);
    for (const k of ["5105", "0007", "1267", "5127", "2557", "8433", "1183"]) expect(kode).toContain(k);
  });
});
