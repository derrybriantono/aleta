// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET BLANGKO JARANG (I26, 18 Okt): abt-paw-lanjutan-derry (PAW), abt-dk-tolak-derry (dispensasi kawin ditolak),
 * abt-itsbat-tolak-cerai-no-derry (cerai kumulasi itsbat: itsbat ditolak / NO, cerai NO)
 * ============================================================================
 *
 * 8 berkas baru di folder yang ada (menu 117, 109, 105 tidak berubah), 11 variabel baru (9762-9772). Yang dijaga: (A) berkas di fixture, dijangkau peta, md5 sama dengan paket;
 * (B) keadaan baru hanya dari saklar tegas; (C) pemilihan blangko; (D) bawaan lama tidak berubah; (E) TS = panel-alat.js; (F) isian baru berlabel awam, 9768-9770 otomatis.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { susunIsian } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, masukanRekomendasiDariBaris, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

import { muatPanelAlat, pilihDariPanel } from "./panel-alat-vm";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/";
const PAW = "9 Penetapan Ahli Waris/[01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Pengganti, Kakek, Nenek, Saudara Seibu - Aul dan Radd Otomatis).rtf";
const DK_A = "3 Dispensasi Kawin/[03a] [Tolak] DK - (Anak P Cowok) Calon Istri Belum Hamil, Hanya Berpacaran.rtf";
const DK_B = "3 Dispensasi Kawin/[03b] [Tolak] DK - (Anak P Cewek) Alasan Sangat Mendesak Tidak Terbukti (Alasan Lain, Isian 9771).rtf";
const DK_C = "3 Dispensasi Kawin/[03c] [Tolak] DK - (Anak P Cowok) Alasan Sangat Mendesak Tidak Terbukti (Alasan Lain, Isian 9771).rtf";
const K_03B_CG = "1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO.rtf";
const K_03B_CT = "1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CT Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO.rtf";
const K_99D_CG = "1c Perceraian Kumulasi Itsbat Nikah/[99d] [NO] Putusan CG Kumulasi Itsbat Nikah - Itsbat NO (Poligami Sirri), Cerai NO.rtf";
const K_99D_CT = "1c Perceraian Kumulasi Itsbat Nikah/[99d] [NO] Putusan CT Kumulasi Itsbat Nikah - Itsbat NO (Poligami Sirri), Cerai NO.rtf";
const MD5: Record<string, string> = {
  [PAW]: "80930f5537a2ccffb82ae8ceae44c35f",
  [DK_A]: "f202e3c4865c69be1dd99ce5a6acd03f",
  [DK_B]: "bb9033bbf95d2f737492ed4dea3859a7",
  [DK_C]: "6c1c4d40fba29a9656ac4164081cd1b1",
  [K_03B_CG]: "3ed07c6165cdaec1b6b54b26074b1896",
  [K_03B_CT]: "1d83a1f0f22a514bcb56b9e247034717",
  [K_99D_CG]: "75adc18d9b78b2d2d650789e6efc1ce3",
  [K_99D_CT]: "f83a3e320f3daa16ee35e1572b6556d3",
};
const BARU = Object.keys(MD5);
const nama = (x: string) => x.replace(/\.rtf$/, "");
const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
  const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
  return r.length ? { berkas: nama(r[0].berkas), folder: r[0].folder.replace(A, ""), semua: r.map((x) => nama(x.berkas)) } : null;
};
const kum = (...kode: string[]) => ({ daftar: kode.map((k) => ({ kode: k })) });
const PAWP = { jenisPerkara: "Penetapan Ahli Waris", nomorPerkara: "5/Pdt.P/2026/PA.Dgl" };
const DK = { jenisPerkara: "Dispensasi Kawin", nomorPerkara: "5/Pdt.P/2026/PA.Dgl" };
const CG = { jenisPerkara: "Cerai Gugat", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" };
const CT = { jenisPerkara: "Cerai Talak", nomorPerkara: "6/Pdt.G/2026/PA.Dgl" };

describe("A. pohon", () => {
  it("8 berkas ada di fixture server dan dijangkau peta bawaan (utama atau varian)", () => {
    expect(BARU).toHaveLength(8);
    expect(BARU.filter((b) => !FIX.berkas.includes(`${A}${b}`))).toEqual([]);
    const dijangkau = new Set<string>();
    for (const b of Object.values(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (!folder) continue;
      dijangkau.add(`${folder}/${nama(b.berkas)}.rtf`);
      if (/^varian: /.test(b.catatan ?? "")) for (const v of (b.catatan ?? "").slice(8).split("; ").filter(Boolean)) dijangkau.add(`${folder}/${nama(v)}.rtf`);
    }
    expect(BARU.filter((b) => !dijangkau.has(b))).toEqual([]);
  });

  it("md5 berkas paket (bila paket ada di laptop ini) sama dengan yang dipetakan", () => {
    const akar = "D:/aleta-dev/kerja/batch-14okt-sore/i26-blangko-jarang";
    const paket: Record<string, string> = { "9 ": "abt-paw-lanjutan-derry", "3 ": "abt-dk-tolak-derry", "1c": "abt-itsbat-tolak-cerai-no-derry" };
    for (const [berkas, md5] of Object.entries(MD5)) {
      const dir = `${akar}/${paket[berkas.slice(0, 2)]}/paket-satker/rtf/${A}`;
      if (!existsSync(dir)) continue;
      expect(createHash("md5").update(readFileSync(path.join(dir, berkas))).digest("hex"), berkas).toBe(md5);
    }
  });
});

describe("B. keadaan baru (saklar tegas)", () => {
  it("PAW susunan lengkap: hanya PAW; [01c] didahulukan atas [01b] yang tetap menjadi cadangan", () => {
    const k = keadaanPutusan({ ...PAWP, susunanAhliWarisLengkap: true });
    expect(k.slice(0, 2)).toEqual(["susunan-ahli-waris-lengkap", "susunan-ahli-waris"]);
    expect(keadaanPutusan({ ...PAWP })).not.toContain("susunan-ahli-waris-lengkap");
    expect(keadaanPutusan({ ...PAWP, susunanAhliWaris: true })).not.toContain("susunan-ahli-waris-lengkap");
    expect(keadaanPutusan({ ...CG, susunanAhliWarisLengkap: true })).not.toContain("susunan-ahli-waris-lengkap");
  });

  it("DK ditolak: jenis kelamin anak + alasan; anak perempuan + pacaran tetap [03] lama (tanpa kode); setengah penanda tidak ditebak", () => {
    expect(keadaanPutusan({ ...DK, anakDispensasi: "laki-laki", alasanTolakDispensasi: "pacaran" })).toContain("anak-laki-laki-pacaran");
    expect(keadaanPutusan({ ...DK, anakDispensasi: "perempuan", alasanTolakDispensasi: "lain" })).toContain("anak-perempuan-alasan-lain");
    expect(keadaanPutusan({ ...DK, anakDispensasi: "laki-laki", alasanTolakDispensasi: "lain" })).toContain("anak-laki-laki-alasan-lain");
    const lama = keadaanPutusan({ ...DK, anakDispensasi: "perempuan", alasanTolakDispensasi: "pacaran" });
    expect(lama.filter((x) => /^anak-/.test(x))).toEqual([]);
    expect(keadaanPutusan({ ...DK, anakDispensasi: "laki-laki" }).filter((x) => /^anak-/.test(x))).toEqual([]);
    expect(keadaanPutusan({ ...DK, alasanTolakDispensasi: "lain" }).filter((x) => /^anak-/.test(x))).toEqual([]);
    expect(keadaanPutusan({ ...CG, anakDispensasi: "laki-laki", alasanTolakDispensasi: "pacaran" }).filter((x) => /^anak-/.test(x))).toEqual([]);
  });

  it("cerai kumulasi itsbat: itsbat ditolak / NO poligami sirri hanya untuk cerai yang berkumulasi itsbat", () => {
    const k = keadaanPutusan({ ...CG, kumulasi: kum("itsbat-nikah"), amarKumulasiItsbat: "itsbat-ditolak-cerai-no" });
    expect(k[0]).toBe("itsbat-ditolak-cerai-no");
    expect(k).toContain("kumulasi-itsbat");
    expect(keadaanPutusan({ ...CT, kumulasi: kum("itsbat-nikah"), amarKumulasiItsbat: "itsbat-no-poligami-sirri" })[0]).toBe("itsbat-no-poligami-sirri");
    expect(keadaanPutusan({ ...CG, amarKumulasiItsbat: "itsbat-ditolak-cerai-no" })).not.toContain("itsbat-ditolak-cerai-no"); // tanpa kumulasi
    expect(keadaanPutusan({ ...CG, kumulasi: kum("hak-asuh-anak"), amarKumulasiItsbat: "itsbat-no-poligami-sirri" })).not.toContain("itsbat-no-poligami-sirri");
    expect(keadaanPutusan({ ...CG, kumulasi: kum("itsbat-nikah"), amarKumulasiItsbat: "lain" }).filter((x) => x.startsWith("itsbat-"))).toEqual([]);
  });

  it("baris bot membawa saklar ke masukan rekomendasi; nilai bukan teks/boolean dibuang", () => {
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Dispensasi Kawin", anakDispensasi: "laki-laki", alasanTolakDispensasi: "lain" })).toMatchObject({ anakDispensasi: "laki-laki", alasanTolakDispensasi: "lain" });
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Penetapan Ahli Waris", susunanAhliWarisLengkap: true })).toMatchObject({ susunanAhliWarisLengkap: true });
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Cerai Gugat", amarKumulasiItsbat: "itsbat-no-poligami-sirri" })).toMatchObject({ amarKumulasiItsbat: "itsbat-no-poligami-sirri" });
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Cerai Gugat", amarKumulasiItsbat: null, susunanAhliWarisLengkap: "ya" })).not.toHaveProperty("amarKumulasiItsbat");
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Cerai Gugat", susunanAhliWarisLengkap: "ya" })).not.toHaveProperty("susunanAhliWarisLengkap");
  });
});

describe("C. pemilihan blangko", () => {
  it("PAW susunan lengkap [01c]; [01b] dan [01] tetap seperti sebelumnya; [01c] masuk varian", () => {
    expect(put({ ...PAWP, statusPutusan: "Dikabulkan", susunanAhliWarisLengkap: true })).toMatchObject({ berkas: nama(PAW.split("/")[1]), folder: "9 Penetapan Ahli Waris" });
    expect(put({ ...PAWP, statusPutusan: "Dikabulkan", susunanAhliWaris: true })!.berkas).toMatch(/^\[01b\] \[Kabul\] PAW - Susunan Ahli Waris Dinamis/);
    const biasa = put({ ...PAWP, statusPutusan: "Dikabulkan" })!;
    expect(biasa.berkas).toMatch(/^\[01\] \[Kabul\] PAW - Ahli Waris Anak Kandung/);
    expect(biasa.semua.some((x) => x.startsWith("[01c] [Kabul] PAW - Susunan Ahli Waris Lengkap"))).toBe(true);
  });

  it("DK ditolak: [03a] / [03b] / [03c] menurut anak dan alasan; tanpa saklar tetap [03] lama dengan ketiganya sebagai varian", () => {
    const f = "3 Dispensasi Kawin";
    expect(put({ ...DK, statusPutusan: "Ditolak", anakDispensasi: "laki-laki", alasanTolakDispensasi: "pacaran" })).toMatchObject({ berkas: nama(DK_A.split("/")[1]), folder: f });
    expect(put({ ...DK, statusPutusan: "Ditolak", anakDispensasi: "perempuan", alasanTolakDispensasi: "lain" })).toMatchObject({ berkas: nama(DK_B.split("/")[1]), folder: f });
    expect(put({ ...DK, statusPutusan: "Ditolak", anakDispensasi: "laki-laki", alasanTolakDispensasi: "lain" })).toMatchObject({ berkas: nama(DK_C.split("/")[1]), folder: f });
    const lama = put({ ...DK, statusPutusan: "Ditolak" })!;
    expect(lama.berkas).toBe("[03] [Tolak] DK - (Anak P Cewek) Belum Hamil");
    for (const v of [DK_A, DK_B, DK_C]) expect(lama.semua).toContain(nama(v.split("/")[1]));
    expect(put({ ...DK, statusPutusan: "Ditolak", anakDispensasi: "perempuan", alasanTolakDispensasi: "pacaran" })!.berkas).toBe("[03] [Tolak] DK - (Anak P Cewek) Belum Hamil");
  });

  it("cerai kumulasi itsbat: [03b] pada status ditolak maupun tidak dapat diterima, [99d] pada tidak dapat diterima; CG dan CT berbeda berkas, folder 1c", () => {
    const f = "1c Perceraian Kumulasi Itsbat Nikah";
    const k = kum("itsbat-nikah");
    for (const status of ["Ditolak", "Tidak Dapat Diterima"]) {
      expect(put({ ...CG, statusPutusan: status, kumulasi: k, amarKumulasiItsbat: "itsbat-ditolak-cerai-no" }), `CG ${status}`).toMatchObject({ berkas: nama(K_03B_CG.split("/")[1]), folder: f });
      expect(put({ ...CT, statusPutusan: status, kumulasi: k, amarKumulasiItsbat: "itsbat-ditolak-cerai-no" }), `CT ${status}`).toMatchObject({ berkas: nama(K_03B_CT.split("/")[1]), folder: f });
    }
    expect(put({ ...CG, statusPutusan: "Tidak Dapat Diterima", kumulasi: k, amarKumulasiItsbat: "itsbat-no-poligami-sirri" })).toMatchObject({ berkas: nama(K_99D_CG.split("/")[1]), folder: f });
    expect(put({ ...CT, statusPutusan: "Tidak Dapat Diterima", kumulasi: k, amarKumulasiItsbat: "itsbat-no-poligami-sirri" })).toMatchObject({ berkas: nama(K_99D_CT.split("/")[1]), folder: f });
  });

  it("bawaan lama tidak berubah: kumulasi itsbat tanpa saklar tetap [02]/[03]/[99], cerai biasa tetap blangko cerai", () => {
    const k = kum("itsbat-nikah");
    expect(put({ ...CG, statusPutusan: "Dikabulkan", kumulasi: k })!.berkas).toBe("[02] [Kabul] Putusan CG Kumulasi Itsbat Nikah - Kontradiktoir");
    expect(put({ ...CG, statusPutusan: "Ditolak", kumulasi: k, itsbatKabulCeraiDitolak: true })!.berkas).toBe("[03] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Kabul, Cerai Ditolak (Kontradiktoir)");
    expect(put({ ...CG, statusPutusan: "Ditolak", amarKumulasiItsbat: "itsbat-ditolak-cerai-no" })!.folder).toBe("1 Perceraian CG"); // tanpa kumulasi: cerai biasa
    expect(put({ ...CG, statusPutusan: "Dikabulkan" })!.berkas).toBe("[02] [Kabul] CG - F");
  });
});

describe("E. TS = panel-alat.js", () => {
  it("pilihPutusanBawaan sama dengan alatPetaUntukPerkara untuk keadaan baru", () => {
    const panel = muatPanelAlat();
    const k = kum("itsbat-nikah");
    const kasus: Array<[string, string, boolean, unknown, string[]]> = [
      ["Penetapan Ahli Waris", "Dikabulkan", false, null, ["susunan-ahli-waris-lengkap", "susunan-ahli-waris"]],
      ["Penetapan Ahli Waris", "Dikabulkan", false, null, []],
      ["Dispensasi Kawin", "Ditolak", false, null, ["anak-laki-laki-pacaran"]],
      ["Dispensasi Kawin", "Ditolak", false, null, ["anak-perempuan-alasan-lain"]],
      ["Dispensasi Kawin", "Ditolak", false, null, ["anak-laki-laki-alasan-lain"]],
      ["Dispensasi Kawin", "Ditolak", false, null, []],
      ["Cerai Gugat", "Ditolak", false, k, ["itsbat-ditolak-cerai-no", "kontradiktoir", "kumulasi-itsbat"]],
      ["Cerai Gugat", "Tidak Dapat Diterima", false, k, ["itsbat-ditolak-cerai-no", "kontradiktoir", "kumulasi-itsbat"]],
      ["Cerai Gugat", "Tidak Dapat Diterima", false, k, ["itsbat-no-poligami-sirri", "kontradiktoir", "kumulasi-itsbat"]],
      ["Cerai Talak", "Ditolak", false, k, ["itsbat-ditolak-cerai-no", "kontradiktoir", "kumulasi-itsbat"]],
      ["Cerai Talak", "Tidak Dapat Diterima", false, k, ["itsbat-no-poligami-sirri", "kontradiktoir", "kumulasi-itsbat"]],
      ["Cerai Gugat", "Ditolak", false, k, ["itsbat-kabul-cerai-ditolak", "kontradiktoir", "kumulasi-itsbat"]],
    ];
    for (const [j, s, v, km, kd] of kasus) {
      const ts = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, km as never, kd);
      expect(ts ? { kunci: ts.kunci, tingkat: ts.tingkat } : null, `${j} ${s} ${kd}`).toEqual(pilihDariPanel(panel, j, s, v, km, kd));
    }
  });
});

describe("F. isian baru (label awam; 9768-9770 otomatis; tanpa kode di label)", () => {
  const D = (kode: string, nm: string, jenis = "data_teks", sql = "") => ({ kode, nama: nm, jenis, sql, bawaan: "" });
  const susun = (penanda: string[], daftar: ReturnType<typeof D>[]) => susunIsian(penanda, new Map(daftar.map((d) => [d.kode, d])));

  it("PAW [01c]: 9762-9767 isian tangan berlabel awam, 9768-9770 otomatis", () => {
    const tangan = ["9762", "9763", "9764", "9765", "9766", "9767"];
    const s = susun(
      [...tangan, "9768", "9769", "9770"],
      [
        ...tangan.map((k) => D(k, `PAW LENGKAP ISIAN ${k}`)),
        ...["9768", "9769", "9770"].map((k) => D(k, `PAW LENGKAP OTOMATIS ${k}`, "data_sql", "select 1")),
      ]
    );
    const peta = Object.fromEntries(s.isian.map((i) => [i.kode, i]));
    for (const k of tangan) {
      expect(peta[k], k).toBeDefined();
      expect(peta[k].nama).not.toMatch(/#\d{4}#|\b97\d\d\b|PAW LENGKAP/);
      expect(peta[k].nama).toContain("kosong = tidak ada");
    }
    expect(peta["9762"].nama).toMatch(/^Ahli waris pengganti/);
    expect(peta["9765"].nama).toContain("pihak ibu");
    expect(peta["9766"].nama).toContain("pihak ayah");
    expect(s.otomatis.map((o) => o.kode).sort()).toEqual(["9768", "9769", "9770"]);
    for (const k of ["9768", "9769", "9770"]) expect(peta[k]).toBeUndefined();
  });

  it("DK 9771 dan itsbat 9772: isian satu kalimat tanpa titik akhir, tanpa kode di label", () => {
    const s = susun(["9771", "9772"], [D("9771", "DK ALASAN LAIN"), D("9772", "ITSBAT TOLAK RUKUN SYARAT")]);
    const peta = Object.fromEntries(s.isian.map((i) => [i.kode, i]));
    expect(peta["9771"].nama).toMatch(/^Alasan yang dikemukakan (Pemohon|Penggugat)/);
    expect(peta["9771"].nama).toContain("tanpa titik akhir");
    expect(peta["9772"].nama).toMatch(/^Rukun atau syarat nikah yang tidak terbukti/);
    for (const k of ["9771", "9772"]) expect(peta[k].nama).not.toMatch(/#\d{4}#|\b97\d\d\b/);
  });
});
