// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET TOLAK 17 OKT (I8): abt-tolak-ikrar-derry
 * ============================================================================
 *
 * Paket (BELUM terpasang di server; keadaan disusun di fixtures/blangko-derry-server-17okt.json dari daftar-rtf.tsv paket):
 *   - `1 Perceraian CG` dan `1a Perceraian CT`: [03a] [Tolak] Cerai - Kontradiktoir (T Hadir Jawab-Menjawab) - F Tidak Terbukti (BARU); [03] tetap untuk T yang tidak hadir
 *     lagi sesudah mediasi, [01ab] tetap untuk tolak verstek;
 *   - `6a Hak Asuh Anak (Hadhanah)`: [03b] [Tolak Verstek] Hak Asuh - Kepentingan Terbaik Anak Tidak Terbukti (BARU);
 *   - variabel #9500# (amar putusan SIPP dikutip, pengganti #0065# di 16 blangko) dan #9501# (penilaian jawaban & bukti T, isian hakim [03a]).
 * Ikrar: tidak ada blangko ikrar baru (nama berkas tetap, hanya isinya) - pemetaan ikrar tidak berubah.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { keadaanIsian, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { golongkan } from "@/lib/kelas-variabel";
import { KODE_AMAR_SIPP, uraiVariabel, type DefinisiAbt } from "@/lib/kamus-sumber-abt";
import { langkahUntukIsian } from "@/lib/konseptor-langkah";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, PENETAPAN_IKRAR, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/";
const CG = "1 Perceraian CG";
const CT = "1a Perceraian CT";
const HA = "6a Hak Asuh Anak (Hadhanah)";
const CERAI_03 = "[03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti";
const CERAI_03A = "[03a] [Tolak] Cerai - Kontradiktoir (T Hadir Jawab-Menjawab) - F Tidak Terbukti";
const HA_03 = "[03] [Tolak] Hak Asuh - Kontradiktoir - Kepentingan Terbaik Anak Tidak Terbukti";
const HA_03B = "[03b] [Tolak Verstek] Hak Asuh - Kepentingan Terbaik Anak Tidak Terbukti";

const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
  const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, ...m }).putusan;
  return r.length ? { berkas: r[0].berkas.replace(/\.rtf$/, ""), folder: r[0].folder.replace(A, ""), semua: r.map((x) => x.berkas.replace(/\.rtf$/, "")), alasan: r[0].alasan } : null;
};
const MEDIASI_T = { mediasi: { hasil: "T" }, mediasiTerbaca: true };

describe("A. berkas ada di folder menunya", () => {
  it("tiga berkas baru ada di pohon; [03] cerai dan [01ab] tolak verstek tetap ada", () => {
    for (const [folder, nama] of [[CG, CERAI_03A], [CT, CERAI_03A], [HA, HA_03B], [CG, CERAI_03], [CT, CERAI_03], [HA, HA_03]] as const) expect(FIX.berkas, `${folder}/${nama}`).toContain(`${A}${folder}/${nama}.rtf`);
    expect(FIX.berkas.some((b) => b.startsWith(`${A}${CG}/[01ab] [Tolak Verstek]`))).toBe(true);
  });

  it("tiap baris putusan bawaan yang menunjuk [03a]/[03b] mengarah ke berkas yang ADA di folder menunya", () => {
    const baris = Object.entries(PETA_PUTUSAN_BAWAAN).filter(([, b]) => /^\[03[ab]\]/.test(b.berkas));
    expect(baris.map(([k]) => k).sort()).toEqual(
      [
        "cerai gugat|ditolak|kontradiktoir",
        "cerai talak|ditolak|kontradiktoir",
        "lain-lain|ditolak|hak-asuh-t-ibu",
        "lain-lain|ditolak|hak-asuh-verstek",
        "penguasaan anak|ditolak|hak-asuh-t-ibu",
        "penguasaan anak|ditolak|verstek",
      ].sort()
    );
    for (const [k, b] of baris) expect(FIX.berkas, k).toContain(`${A}${FOLDER_MENU_PUTUSAN[String(b.blangko)]}/${b.berkas}.rtf`);
  });
});

describe("B. cerai ditolak: kontradiktoir [03a], T tidak hadir lagi [03], verstek [01ab]", () => {
  for (const [jenis, folder, kode] of [["Cerai Gugat", CG, "CG"], ["Cerai Talak", CT, "CT"]] as const) {
    it(`${jenis}: T hadir pada sidang putusan -> [03a] (nama sama di ${folder}); varian [03] disebut`, () => {
      const j = { jenisPerkara: jenis, nomorPerkara: `10/Pdt.G/2026/PA.Dgl`, statusPutusan: "Ditolak" };
      // T hadir (sandi 1 semua / 3 T saja) pada sidang putusan, sesudah mediasi atau tanpa mediasi tercatat
      for (const h of [1, 3]) {
        expect(put({ ...j, dihadiriOleh: h, ...MEDIASI_T })).toMatchObject({ berkas: CERAI_03A, folder });
        expect(put({ ...j, dihadiriOleh: h })).toMatchObject({ berkas: CERAI_03A, folder });
      }
      expect(put({ ...j, dihadiriOleh: 1, ...MEDIASI_T })!.semua).toContain(CERAI_03);
      // T hadir mediasi lalu tidak hadir lagi di sidang putusan: [03] tetap
      expect(put({ ...j, dihadiriOleh: 2, tergugatPernahHadir: true, ...MEDIASI_T })).toMatchObject({ berkas: CERAI_03, folder });
      expect(put({ ...j, dihadiriOleh: 2, tergugatPernahHadir: true, ...MEDIASI_T })!.semua).toContain(CERAI_03A);
      // verstek (T tidak pernah hadir): [01ab] tetap, juga bila bendera verstek kosong
      expect(put({ ...j, dihadiriOleh: 2, verstekPutusan: true })!.berkas).toMatch(/^\[01ab\] \[Tolak Verstek\]/);
      expect(put({ ...j, dihadiriOleh: 2, mediasi: null, mediasiTerbaca: true, tergugatPernahHadir: false })!.berkas).toMatch(/^\[01ab\] \[Tolak Verstek\]/);
      // status lain tidak ikut berubah
      expect(put({ ...j, statusPutusan: "Dikabulkan", dihadiriOleh: 1 })!.berkas).toMatch(/^\[02\] \[Kabul\] /);
      expect(kode).toMatch(/^C[GT]$/);
    });
  }

  it("keadaan 'kontradiktoir' tidak ikut menyentuh tolak jenis lain (HB, waris): barisnya milik cerai saja", () => {
    expect(keadaanPutusan({ jenisPerkara: "Cerai Gugat", dihadiriOleh: 3, ...MEDIASI_T })).toContain("kontradiktoir");
    expect(put({ jenisPerkara: "Harta Bersama", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", statusPutusan: "Ditolak", dihadiriOleh: 1 })?.berkas ?? "").not.toBe(CERAI_03A);
  });

  it("sidang yang akan memutus (status belum tercatat, varian tolak H-7): kehadiran sidang sebelumnya dipakai", () => {
    // pilihBlangkoH7 mengirim dihadiriOleh = kehadiran sidang sebelumnya (T hadir -> kontradiktoir)
    const r = rekomendasiBlangko({ jenisPerkara: "Cerai Gugat", nomorPerkara: "10/Pdt.G/2026/PA.Dgl", urutanSidang: 5, dihadiriOleh: 1, statusPutusan: "Ditolak", agenda: "Musyawarah majelis" }).putusan;
    expect(r[0].berkas).toBe(`${CERAI_03A}.rtf`);
  });
});

describe("C. hak asuh ditolak verstek [03b]", () => {
  for (const j of [
    { jenisPerkara: "Lain-Lain", nomorPerkara: "177/Pdt.G/2022/PA.Dgl" },
    { jenisPerkara: "Penguasaan Anak", nomorPerkara: "177/Pdt.G/2022/PA.Dgl" },
  ]) {
    it(`${j.jenisPerkara}: verstek -> [03b], kontradiktoir -> [03] (varian [03a], [03b] disebut)`, () => {
      expect(put({ ...j, statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 })).toMatchObject({ berkas: HA_03B, folder: HA });
      // verstek tanpa bendera (T tidak pernah hadir, tanpa mediasi)
      expect(put({ ...j, statusPutusan: "Ditolak", dihadiriOleh: 2, mediasi: null, mediasiTerbaca: true, tergugatPerempuan: true })!.berkas).toBe(HA_03B);
      const kontra = put({ ...j, statusPutusan: "Ditolak", dihadiriOleh: 1 })!;
      expect(kontra.berkas).toBe(HA_03);
      expect(kontra.semua).toEqual(expect.arrayContaining([HA_03B, "[03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan kepada T (Ibu, Anak Belum Mumayyiz)"]));
    });
  }
});

describe("D. ikrar tidak berubah", () => {
  it("penetapan ikrar [90]/[90a]/[91] tetap menunjuk berkas lama yang ada di pohon", () => {
    for (const b of [PENETAPAN_IKRAR.pTidakHadirT, PENETAPAN_IKRAR.keduanyaHadir, PENETAPAN_IKRAR.gugur]) expect(FIX.berkas, b).toContain(`${PENETAPAN_IKRAR.folder}/${b}`);
  });
});

describe("E. #9500# amar SIPP dikutip dan #9501# penilaian jawaban & bukti", () => {
  const SQL_9500 =
    "SELECT REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(pp.amar_putusan, CHAR(13), ''), CHAR(10), ''), '</p>', '</p>&#32;'), 'sidang Pengadilan Agama Bantul', 'sidang #8008#'), 'sidang Pengadilan Agama Tangerang', 'sidang #8008#') AS data FROM perkara_putusan pp WHERE pp.perkara_id = '#perkara_id#' LIMIT 1";
  const D9500: DefinisiAbt = {
    noVar: "9500",
    nama: 'AMAR PUTUSAN SIPP DIKUTIP (OTOMATIS = #0065#, kecuali sisa templat amar SIPP "sidang Pengadilan Agama Bantul/Tangerang" diganti #8008#) - ikrar, BAS putusan, relaas',
    jenis: "data_sql",
    sqlQuery: SQL_9500,
  };
  const D0065: DefinisiAbt = { noVar: "0065", nama: "Amar Putusan", jenis: "data_sipp", dataTabel: "perkara_putusan", dataKolom: "amar_putusan" };
  const D8008: DefinisiAbt = { noVar: "8008", nama: "Nama satker", jenis: "data_sql", sqlQuery: 'SELECT "PA Donggala" AS data' };

  it("kelas A (otomatis); sumber SIPP perkara_putusan.amar_putusan seperti #0065#; keduanya dikenali sebagai amar SIPP", () => {
    expect(golongkan({ noVar: "9500", jenis: "data_sql", sqlQuery: SQL_9500 }).kelas).toBe("A");
    expect(KODE_AMAR_SIPP.has("0065") && KODE_AMAR_SIPP.has("9500")).toBe(true);
    const peta = new Map<string, DefinisiAbt>([["0065", D0065], ["8008", D8008], ["9500", D9500]]);
    const u = uraiVariabel(D9500, peta);
    expect(u.sumber).toBe("sipp");
    expect(u.tabelSipp).toContain("perkara_putusan");
    expect(u.sumberRinci).toMatch(/^perkara_putusan\.amar_putusan/);
    expect(u.rujukan).toContain("8008");
    const u0 = uraiVariabel(D0065, peta);
    expect(u0.sumber).toBe("sipp");
    expect(u0.sumberRinci).toBe("perkara_putusan.amar_putusan");
  });

  it("amar SIPP yang disisipkan di dalam tanda petik ganda dinilai rawan petik, seperti #0065#", () => {
    const pemakai: DefinisiAbt = { noVar: "9999", nama: "x", jenis: "data_sql", sqlQuery: 'SELECT CONCAT("Amar: ", "#9500#") AS data' };
    const pemakai65: DefinisiAbt = { ...pemakai, noVar: "9998", sqlQuery: 'SELECT CONCAT("Amar: ", "#0065#") AS data' };
    const peta = new Map<string, DefinisiAbt>([["0065", D0065], ["8008", D8008], ["9500", D9500], ["9999", pemakai], ["9998", pemakai65]]);
    expect(uraiVariabel(pemakai65, peta).rujukanPetik).toEqual(["0065"]);
    expect(uraiVariabel(pemakai, peta).rujukanPetik).toEqual(["9500"]);
  });

  it("#9501# = isian tangan hakim (kelas B), berlabel awam, langkah pertimbangan hukum konseptor", () => {
    const def: Definisi = {
      kode: "9501",
      nama: "TOLAK CERAI KONTRADIKTOIR: PENILAIAN JAWABAN & BUKTI #0047# (diisi hakim - bantahan apa yang didukung bukti/saksi #0047#, mengapa melemahkan dalil #0046#; kosong = titik-titik)",
      jenis: "data_teks",
      sql: "",
      bawaan: "",
    };
    expect(golongkan({ noVar: "9501", jenis: "data_teks" }).kelas).toBe("B");
    const s = susunIsian(["9501"], new Map([["9501", def]]));
    const b = s.isian.find((x) => x.kode === "9501")!;
    expect(b.nama).toBe("Penilaian jawaban dan bukti Tergugat/Termohon (bantahan apa yang didukung bukti atau saksi, dan mengapa melemahkan dalil Penggugat/Pemohon; kosong = titik-titik)");
    expect(b.wajib).toBe(true);
    expect(b.keadaan).toBe("");
    expect(keadaanIsian(def.nama, "9501")).toBe("");
    expect(langkahUntukIsian({ kode: "9501", nama: b.nama })).toBe("pertimbangan");
  });
});
