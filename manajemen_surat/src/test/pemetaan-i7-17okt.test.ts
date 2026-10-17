// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET VARIAN 17 OKT (I7): abt-varian-17okt-derry
 * ============================================================================
 *
 * Paket (BELUM terpasang di server; keadaan disusun di fixtures/blangko-derry-server-17okt.json dari daftar-pindah.tsv, daftar-rtf.tsv, PASANG.sql paket):
 *   - berkas baru `4a Harta Bersama/[01a] ... Rekonvensi Dikabulkan` dan `6a Hak Asuh Anak (Hadhanah)/[03a] [Tolak] ... Hadhanah Ditetapkan kepada T`;
 *   - 6 BAS mediasi pembatalan perkawinan (344) dipindah ke derry_briantono/terhapus (PERMA 1/2016 Pasal 4 ayat (2) huruf d);
 *   - menu hak asuh 133/134 kini jenis_perkara_id 369-369 (Lain-Lain), bukan alur_perkara_id 15;
 *   - isian baru 9430/9432/9434 (+ variabel otomatis 9431/9433/9435).
 * Yang dijaga: (A) pohon: berkas baru ada, yang dipindah tidak lagi dirujuk ALETA dan folder terhapus TIDAK pernah muncul di pembaca mana pun;
 * (B) putusan bawaan: HB rekonvensi dikabulkan -> [01a], hak asuh tolak Tergugat ibu -> [03a], bawaan lama utuh; (C) BAS pembatalan tanpa mediasi;
 * (D) hak asuh hanya untuk Lain-Lain Pdt.G; (E) label isian 9430/9432/9434 dan syarat "KUA di SIPP kosong".
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { jenisFolderDerry, keadaanIsian, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { ALUR_BAS_BARU, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { keadaanPutusan, rekonvensiDikabulkanDariAmar } from "@/lib/keadaan-putusan";
import { SET_BLANGKO, setBlangkoGabung, setCocokPerkara, setUntukPerkara } from "@/lib/pohon-blangko";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, rekomendasiBlangko, masukanRekomendasiDariBaris } from "@/lib/rekomendasi-blangko";
import { cariBerkasBasJenis, salinanBasJenis } from "@/lib/salinan-bas-jenis";
import { folderTugas, jalurBlangkoTerhapus, jenisDokumenBlangko } from "@/lib/tugas-blangko";

type BarisMenu = { id: number; nama: string; direktori: string; perkara_id_min?: string; perkara_id_max?: string; perkara_id_referensi?: string };
const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[]; terhapus: string[]; menu: BarisMenu[] };
const A = "derry_briantono/";
const HB = "4a Harta Bersama";
const HA = "6a Hak Asuh Anak (Hadhanah)";
const PB_BAS = "5a Pembatalan Perkawinan - BAS";
const HB_01A = "[01a] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan - Rekonvensi Dikabulkan";
const HA_03A = "[03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan kepada T (Ibu, Anak Belum Mumayyiz)";

describe("A. pohon: berkas baru, berkas yang dipindah, folder terhapus", () => {
  it("dua berkas baru ADA di folder menunya; enam BAS mediasi 5a ada di `terhapus`, tidak di pohon aktif", () => {
    expect(FIX.berkas).toContain(`${A}${HB}/${HB_01A}.rtf`);
    expect(FIX.berkas).toContain(`${A}${HA}/${HA_03A}.rtf`);
    expect(FIX.terhapus).toHaveLength(6);
    for (const j of FIX.terhapus) {
      expect(j.startsWith(`${A}terhapus/${PB_BAS}/`), j).toBe(true);
      expect(FIX.berkas, j).not.toContain(j.replace("terhapus/", ""));
      expect(jalurBlangkoTerhapus(j), j).toBe(true);
    }
    expect(FIX.terhapus.map((j) => j.split("/").pop()).sort()).toEqual(
      [
        "BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf",
        "BAS ALUR 05 [1] BAS 1 P & T Hadir - Mediasi.rtf",
        "BAS ALUR 06 [1] BAS 1 P & T Hadir - Mediasi.rtf",
        "BAS ALUR 08 [C1] BAS 1 P & T Hadir - Mediasi.rtf",
        "BAS ALUR 08 [C2] BAS Putus P & T Hadir - Cabut Perkara Damai dari Mediasi.rtf",
        "BAS ALUR 39 Pembatalan Nikah - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf",
      ].sort()
    );
  });

  it("folder `terhapus` tidak pernah muncul: bukan set, bukan folder tugas, bukan jenis folder Derry, juga bila dibaca mentah dari seluruh pohon", () => {
    const mentah = [...FIX.berkas, ...FIX.terhapus];
    const namaFolder = [...new Set(mentah.map((b) => b.split("/")[1]))];
    expect(namaFolder).toContain("terhapus"); // pembaca mentah memang melihatnya
    expect(folderTugas("terhapus")).toBeNull();
    expect(folderTugas(`terhapus/${PB_BAS}`)).toBeNull();
    expect(jenisFolderDerry("terhapus")).toBe("");
    expect(jenisFolderDerry(`terhapus/${PB_BAS}`)).toBe("");
    const semua = setBlangkoGabung([...namaFolder, `terhapus/${PB_BAS}`]);
    expect(semua.some((s) => /terhapus/i.test(s.folder) || /terhapus/i.test(s.id))).toBe(false);
    // set BAS 5a yang hidup tetap satu dan menunjuk folder aktif
    expect(semua.filter((s) => s.folder === `${A}${PB_BAS}`)).toHaveLength(1);
    // jalur lengkap berkas terhapus bukan blangko aktif walau namanya "BAS ..."
    expect(jenisDokumenBlangko(FIX.terhapus[0])).toBe("bas"); // aturan nama tidak berubah...
    expect(jalurBlangkoTerhapus(FIX.terhapus[0])).toBe(true); // ...tetapi pembaca pohon harus membuangnya lebih dulu
    expect(jalurBlangkoTerhapus(`${A}${PB_BAS}/BAS ALUR 04 [2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf`)).toBe(false);
  });

  it("pohon aktif: BAS 5a tidak lagi memuat BAS mediasi; ALUR 04 [2], 05 [2], 06 [2], 08 [A] tetap", () => {
    const di5a = FIX.berkas.filter((b) => b.startsWith(`${A}${PB_BAS}/`)).map((b) => b.split("/").pop()!);
    expect(di5a).toHaveLength(24 + 4);
    expect(di5a.some((b) => /ALUR 04 \[1\]|ALUR 05 \[1\]|ALUR 06 \[1\]|ALUR 08 \[C[12]\]|Mediasi Berhasil/.test(b))).toBe(false);
    for (const b of ["BAS ALUR 04 [2] ", "BAS ALUR 05 [2] ", "BAS ALUR 06 [2] ", "BAS ALUR 08 [A] "]) expect(di5a.some((x) => x.startsWith(b)), b).toBe(true);
  });

  it("menu hak asuh 133/134: acuan jenis_perkara_id 369-369 (dulu alur 15); ALUR 38 jenis 369", () => {
    for (const id of [133, 134]) {
      const m = FIX.menu.find((x) => x.id === id)!;
      expect(m, String(id)).toMatchObject({ perkara_id_min: "369", perkara_id_max: "369", perkara_id_referensi: "jenis_perkara_id" });
    }
    const alur38 = ALUR_BAS_BARU.find((a) => a.id === "alur-38")!;
    expect([alur38.jenisMin, alur38.jenisMaks]).toEqual([369, 369]);
  });

  it("tiap berkas bawaan yang dirujuk paket ini ADA di folder menunya", () => {
    const rujukan = Object.entries(PETA_PUTUSAN_BAWAAN).filter(([k]) => ["harta bersama|dikabulkan|rekonvensi-dikabulkan", "penguasaan anak|ditolak|hak-asuh-t-ibu", "lain-lain|ditolak|hak-asuh-t-ibu"].includes(k));
    expect(rujukan).toHaveLength(3);
    for (const [k, b] of rujukan) {
      const folder = FOLDER_MENU_PUTUSAN[String(b.blangko)];
      expect(FIX.berkas, k).toContain(`${A}${folder}/${b.berkas}.rtf`);
    }
  });
});

describe("B. putusan bawaan: varian dipilih menurut keadaan, bawaan lama utuh", () => {
  const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
    const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
    return r.length ? { berkas: r[0].berkas.replace(/\.rtf$/, ""), folder: r[0].folder.replace(A, ""), utama: r[0].utama, semua: r.map((x) => x.berkas.replace(/\.rtf$/, "")) } : null;
  };

  it("HB: rekonvensi ditolak tetap [01] (bawaan), [01a] dan [02a] muncul sebagai alternatif; rekonvensi dikabulkan -> [01a]", () => {
    const j = { jenisPerkara: "Harta Bersama", nomorPerkara: "5/Pdt.G/2026/PA.Dgl", statusPutusan: "Dikabulkan" };
    const dasar = put(j)!;
    expect(dasar.berkas).toBe("[01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan");
    expect(dasar.semua).toContain(HB_01A);
    expect(dasar.semua).toContain("[02a] [Kabul] HB - T Tidak Hadir Setelah Mediasi");
    // amar SIPP memuat rekonvensi yang dikabulkan (potongan dari bot)
    const amar = "Dalam Konvensi: 1. Mengabulkan gugatan Penggugat Konvensi untuk sebagian; Dalam Rekonvensi: 1. Mengabulkan gugatan Penggugat Rekonvensi untuk sebagian; 2. Menetapkan objek berikut sebagai harta bersama";
    expect(put({ ...j, amarRekonvensi: amar })).toMatchObject({ berkas: HB_01A, folder: HB, utama: true });
    // saklar tegas menang atas amar; saklar mati = bawaan walau amar berbunyi dikabulkan
    expect(put({ ...j, rekonvensiDikabulkan: true })!.berkas).toBe(HB_01A);
    expect(put({ ...j, amarRekonvensi: amar, rekonvensiDikabulkan: false })!.berkas).toMatch(/^\[01\] /);
    // bila rekonvensi ditolak di amar -> tetap bawaan
    expect(put({ ...j, amarRekonvensi: "Dalam Rekonvensi: Menolak gugatan Penggugat Rekonvensi seluruhnya" })!.berkas).toMatch(/^\[01\] /);
    // status lain (cabut) tidak ikut berubah
    expect(put({ ...j, statusPutusan: "Dicabut", rekonvensiDikabulkan: true })!.berkas).toMatch(/^\[98\] \[Cabut\]/);
  });

  it("deteksi amar: 'Dalam Rekonvensi' + Mengabulkan; Menolak; tanpa kata rekonvensi", () => {
    expect(rekonvensiDikabulkanDariAmar("Dalam Rekonvensi:\n1. Mengabulkan gugatan rekonvensi")).toBe(true);
    expect(rekonvensiDikabulkanDariAmar("DALAM REKONVENSI mengabulkan sebagian")).toBe(true);
    expect(rekonvensiDikabulkanDariAmar("Dalam Rekonvensi: Menolak gugatan Penggugat Rekonvensi")).toBe(false);
    expect(rekonvensiDikabulkanDariAmar("Dalam Konvensi: Mengabulkan gugatan Penggugat")).toBe(false);
    expect(rekonvensiDikabulkanDariAmar("")).toBe(false);
    expect(rekonvensiDikabulkanDariAmar(undefined)).toBe(false);
    // "Mengabulkan" milik bagian lain sesudah Dalam Rekonvensi (Dalam Pokok Perkara) tidak ikut
    expect(rekonvensiDikabulkanDariAmar("Dalam Rekonvensi: Menolak gugatan Penggugat Rekonvensi. Dalam Pokok Perkara: Mengabulkan permohonan biaya")).toBe(false);
  });

  it("keadaan: rekonvensi-dikabulkan hanya untuk harta bersama dan didahulukan; kode lama tak berubah tanpa bahan", () => {
    expect(keadaanPutusan({ jenisPerkara: "Harta Bersama", dihadiriOleh: 1 })).toEqual(["kontradiktoir"]);
    expect(keadaanPutusan({ jenisPerkara: "Harta Bersama", dihadiriOleh: 1, rekonvensiDikabulkan: true })).toEqual(["rekonvensi-dikabulkan", "kontradiktoir"]);
    expect(keadaanPutusan({ jenisPerkara: "Kewarisan", dihadiriOleh: 1, rekonvensiDikabulkan: true })).toEqual(["kontradiktoir"]);
    expect(keadaanPutusan({ jenisPerkara: "Harta Bersama", dihadiriOleh: 1, amarRekonvensi: "Dalam Rekonvensi: Mengabulkan" })).toEqual(["rekonvensi-dikabulkan", "kontradiktoir"]);
  });

  it("hak asuh tolak: Tergugat ibu -> [03a]; Tergugat ayah / tidak diketahui -> [03] (varian [03a] disebut); verstek tidak pernah [03a]", () => {
    for (const j of [
      { jenisPerkara: "Lain-Lain", nomorPerkara: "177/Pdt.G/2022/PA.Dgl" },
      { jenisPerkara: "Penguasaan Anak", nomorPerkara: "177/Pdt.G/2022/PA.Dgl" },
    ]) {
      const ibu = put({ ...j, statusPutusan: "Ditolak", tergugatPerempuan: true })!;
      expect(ibu, j.jenisPerkara).toMatchObject({ berkas: HA_03A, folder: HA });
      const ayah = put({ ...j, statusPutusan: "Ditolak", tergugatPerempuan: false })!;
      expect(ayah.berkas, j.jenisPerkara).toMatch(/^\[03\] \[Tolak\] Hak Asuh - Kontradiktoir - Kepentingan Terbaik Anak Tidak Terbukti/);
      expect(ayah.semua, j.jenisPerkara).toContain(HA_03A);
      const takTahu = put({ ...j, statusPutusan: "Ditolak" })!;
      expect(takTahu.berkas, j.jenisPerkara).toMatch(/^\[03\] /);
      // verstek (T tidak pernah hadir): bukan [03a] walau Tergugat perempuan
      expect(put({ ...j, statusPutusan: "Ditolak", tergugatPerempuan: true, verstekPutusan: true, dihadiriOleh: 2 })!.berkas).not.toMatch(/^\[03a\]/);
    }
    // Lain-Lain Pdt.P (pengangkatan anak) tidak pernah jadi hak asuh walau tergugatPerempuan = true
    expect(put({ jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.P/2024/PA.Dgl", statusPutusan: "Ditolak", tergugatPerempuan: true })?.folder ?? "").not.toBe(HA);
    // kabul hak asuh tidak terpengaruh
    expect(put({ jenisPerkara: "Lain-Lain", nomorPerkara: "177/Pdt.G/2022/PA.Dgl", statusPutusan: "Dikabulkan", tergugatPerempuan: true })!.berkas).toMatch(/^\[01\] \[Kabul\] Hak Asuh/);
  });

  it("baris jadwal bot membawa tergugatPerempuan / amarRekonvensi sampai ke rekomendasi", () => {
    const m = masukanRekomendasiDariBaris({ jenisPerkara: "Lain-Lain", nomorPerkara: "177/Pdt.G/2022/PA.Dgl", sudahPutus: true, statusPutusan: "Ditolak", dihadiriOleh: 1, tergugatPerempuan: true, amarRekonvensi: "x" });
    expect(m).toMatchObject({ tergugatPerempuan: true, amarRekonvensi: "x" });
    expect(rekomendasiBlangko({ ...m, urutanSidang: 4 }).putusan[0].berkas).toMatch(/^\[03a\]/);
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Harta Bersama" })).toMatchObject({ tergugatPerempuan: null, amarRekonvensi: "" });
  });

  it("peta bawaan ekstensi (panel-alat.js) memuat tiga baris varian yang sama dengan cermin portal", () => {
    const sumber = readFileSync(path.resolve(__dirname, "../../../ekstensi-sipp/panel-alat.js"), "utf8");
    expect(sumber).toContain("/* === I7 17 Okt === */");
    expect(sumber).toContain(HB_01A);
    expect(sumber).toContain(HA_03A);
    expect(typeof vm.runInNewContext("1")).toBe("number");
  });
});

describe("C. BAS pembatalan perkawinan (344): tanpa mediasi", () => {
  const G = "20/Pdt.G/2026/PA.Dgl";
  const bas = (m: Partial<Parameters<typeof tentukanBasBaru>[0]> = {}) => tentukanBasBaru({ jenisPerkara: "Pembatalan Perkawinan", nomorPerkara: G, urutanSidang: 1, dihadiriOleh: 1, ...m });

  it("sidang pertama P & T hadir: ALUR 04 [2] (tertulis) utama, ALUR 05 [2] (lisan) alternatif; keduanya ada di folder 5a - BAS pohon aktif", () => {
    const h = bas()!;
    expect(h.alur.folder).toBe(`${A}${PB_BAS}`);
    expect(h.langkah.berkas).toBe("BAS ALUR 04 [2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf");
    expect(h.alternatif.map((a) => a.berkas)).toEqual(["BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Jawab Menjawab Lisan, Tunda Pembuktian P.rtf"]);
    expect(h.sebab).toMatch(/dikecualikan dari mediasi/i);
    for (const b of [h.langkah.berkas, ...h.alternatif.map((a) => a.berkas)]) expect(FIX.berkas, b).toContain(`${A}${PB_BAS}/${b}`);
    // juga lewat rekomendasi sidang: tidak ada berkas dari folder terhapus, tidak ada BAS "Mediasi" ([1])
    const r = rekomendasiBlangko({ jenisPerkara: "Pembatalan Perkawinan", nomorPerkara: G, urutanSidang: 1, dihadiriOleh: 1 }).bas;
    expect(r[0].berkas).toMatch(/^BAS ALUR 04 \[2\]/);
    for (const x of r) {
      expect(FIX.berkas, x.berkas).toContain(`${x.folder}/${x.berkas}`);
      expect(x.berkas, x.berkas).not.toMatch(/ \[1\] BAS 1 P & T Hadir - Mediasi|\[C1\]|\[C2\]|Mediasi Berhasil/);
    }
  });

  it("mediasi berhasil / dicabut tidak diusulkan BAS mediasi dari folder mana pun; verstek, P tidak hadir, NO tetap ALUR 39", () => {
    expect(bas({ urutanSidang: 2, agenda: "Mediasi berhasil" })).toBeNull();
    expect(bas({ akhir: "cabut" })).toBeNull();
    expect(bas({ dihadiriOleh: 2 })).toMatchObject({ langkah: { kode: "V1" } });
    expect(bas({ dihadiriOleh: 2, urutanSidang: 2 })).toMatchObject({ langkah: { kode: "V2" } });
    expect(bas({ dihadiriOleh: 4, urutanSidang: 2 })).toMatchObject({ langkah: { kode: "TP" } });
    expect(bas({ akhir: "no", dihadiriOleh: 4, urutanSidang: 3 })).toMatchObject({ langkah: { kode: "NO" } });
    // sidang lanjutan P & T hadir: salinan ALUR 04 (jawaban dst.) masih ditemukan
    expect(bas({ urutanSidang: 4, agenda: "Replik" })).toMatchObject({ alur: { id: "alur-04" }, langkah: { kode: "4" } });
    // Hak asuh TIDAK berubah: akta perdamaian dan cabut tetap
    expect(tentukanBasBaru({ jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.G/2026/PA.Dgl", urutanSidang: 2, dihadiriOleh: 1, agenda: "Mediasi berhasil - akta perdamaian" })).toMatchObject({ langkah: { kode: "AP" } });
  });

  it("salinan BAS mediasi tidak lagi ada untuk pembatalan; tetap ada untuk jenis lain", () => {
    const alur04 = `${A}ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)`;
    const mediasi = "[1] BAS 1 P & T Hadir - Mediasi.rtf";
    expect(salinanBasJenis(alur04, mediasi, "Pembatalan Perkawinan")).toEqual([]);
    expect(salinanBasJenis(alur04, mediasi, "Penguasaan Anak").map((s) => s.folder)).toEqual([`${A}${HA} - BAS`]);
    expect(salinanBasJenis(alur04, mediasi, "Harta Bersama").map((s) => s.folder)).toEqual([`${A}4a Harta Bersama - BAS`]);
    expect(cariBerkasBasJenis("BAS ALUR 39 Pembatalan Nikah - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf", "Pembatalan Perkawinan")).toBeNull();
    expect(cariBerkasBasJenis("BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf", "Pembatalan Perkawinan")).toBeNull();
    expect(cariBerkasBasJenis("BAS ALUR 04 [2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf", "Pembatalan Perkawinan")?.folder).toBe(`${A}${PB_BAS}`);
  });
});

describe("D. hak asuh hanya untuk jenis 369 (Lain-Lain Pdt.G), bukan cerai maupun pengangkatan anak", () => {
  const putusanCocok = (jenis: string, nomor?: string) => setUntukPerkara(jenis, nomor).filter((s) => s.cocok && s.jenis === "putusan").map((s) => s.folder.replace(A, ""));

  it("Lain-Lain Pdt.G -> 6a Hak Asuh; Lain-Lain Pdt.P / tanpa nomor -> bukan 6a; cerai kumulasi hak asuh -> bukan 6a", () => {
    expect(putusanCocok("Lain-Lain", "358/Pdt.G/2020/PA.Dgl")).toContain(HA);
    expect(putusanCocok("Lain-Lain", "7/Pdt.P/2024/PA.Dgl")).not.toContain(HA);
    expect(putusanCocok("Lain-Lain")).not.toContain(HA);
    const dinamis = setBlangkoGabung(["9a Lain-Lain (Pengangkatan Anak)", HA]).filter((x) => x.jenis === "putusan");
    const cocokDinamis = (j: string, n: string) => dinamis.filter((x) => setCocokPerkara(x, j, n)).map((x) => x.folder.replace(A, ""));
    expect(cocokDinamis("Lain-Lain", "7/Pdt.P/2024/PA.Dgl")).not.toContain(HA);
    expect(cocokDinamis("Lain-Lain", "358/Pdt.G/2020/PA.Dgl")).toContain(HA);
    expect(putusanCocok("Penguasaan Anak")).toContain(HA); // jenis 349 tetap dikenal (tidak mengurangi yang lama)
    expect(putusanCocok("Cerai Gugat", "1/Pdt.G/2026/PA.Dgl")).not.toContain(HA);
    // set BAS dari folder yang ditemukan membawa syarat yang sama
    const gabung = setBlangkoGabung([HA, `${HA} - BAS`]);
    const bas = gabung.find((s) => s.folder === `${A}${HA} - BAS`)!;
    expect(bas.untukGugatan).toEqual(["lain-lain"]);
    expect(SET_BLANGKO.find((s) => s.folder === `${A}${HA}`)!.untukGugatan).toEqual(["lain-lain"]);
  });
});

describe("E. isian 9430 / 9432 / 9434", () => {
  const D = (kode: string, nama: string, jenis = "data_teks"): [string, Definisi] => [kode, { kode, nama, jenis, sql: "", bawaan: "" }];
  const KATALOG = new Map<string, Definisi>([
    D("9430", 'PEMBATALAN NIKAH: PEGAWAI PENCATAT NIKAH TEMPAT PERKAWINAN DICATAT - ISIAN (tulis "Kantor Urusan Agama Kecamatan ..., Kabupaten ..."; kosong = data SIPP)'),
    D("9431", "PEMBATALAN NIKAH: PEGAWAI PENCATAT NIKAH TEMPAT PERKAWINAN DICATAT (OTOMATIS: isian 9430; kosong = SIPP data pernikahan)", "data_sql"),
    D("9432", "HAK ASUH (TOLAK, HADHANAH KEPADA #0047#): FAKTA PENGASUHAN ANAK OLEH #0047# - ISIAN (dari bukti & saksi; kosong = kalimat bawaan)"),
    D("9433", "HAK ASUH (TOLAK, HADHANAH KEPADA #0047#): FAKTA PENGASUHAN ANAK OLEH #0047# (OTOMATIS: isian 9432)", "data_sql"),
    D("9434", "HARTA BERSAMA REKONVENSI: OBJEK YANG DITETAPKAN SEBAGAI HARTA BERSAMA - ISIAN (objek rekonvensi yang terbukti, satu per baris; kosong = seluruh objek 9283)"),
    D("9435", "HARTA BERSAMA REKONVENSI: OBJEK YANG DITETAPKAN SEBAGAI HARTA BERSAMA (OTOMATIS: isian 9434)", "data_sql"),
    D("0047", "TERGUGAT", "data_sql"),
  ]);
  const sus = (penanda: string[] = [...KATALOG.keys()]) => susunIsian(penanda, KATALOG);

  it("label awam tanpa nomor variabel; 9431/9433/9435 otomatis (bukan isian)", () => {
    const s = sus();
    const peta = Object.fromEntries(s.isian.map((b) => [b.kode, b]));
    expect(Object.keys(peta).sort()).toEqual(["9430", "9432", "9434"]);
    expect(peta["9430"].nama).toBe('Kantor Urusan Agama tempat perkawinan dicatat (tulis "Kantor Urusan Agama Kecamatan ..., Kabupaten ..."; kosong = data SIPP)');
    expect(peta["9432"].nama).toMatch(/^Fakta pengasuhan anak oleh /);
    expect(peta["9434"].nama).toMatch(/^Objek rekonvensi yang ditetapkan sebagai harta bersama/);
    for (const b of Object.values(peta)) expect(b.nama, b.kode).not.toMatch(/\b9[0-9]{3}\b|OTOMATIS|ISIAN/);
    expect(s.otomatis.map((o) => o.kode).sort()).toEqual(["0047", "9431", "9433", "9435"]);
  });

  it("9430 berlaku hanya bila KUA di SIPP kosong (9431 masih titik-titik) atau sudah diisi petugas", () => {
    expect(keadaanIsian("apa pun", "9430")).toBe("kuaKosong");
    expect(keadaanIsian("apa pun", "9432")).toBe("");
    const b = sus().isian.find((x) => x.kode === "9430")!;
    expect(b.keadaan).toBe("kuaKosong");
    const sumber = readFileSync(path.resolve(__dirname, "../../../ekstensi-sipp/blangko-derry-isian.js"), "utf8");
    // jalankan keadaanBerlakuMurni dari ekstensi (fungsi murni di dalam IIFE: ambil lewat teks sumbernya)
    const awal = sumber.indexOf("function keadaanBerlakuMurni(b, ctx) {");
    const akhir = sumber.indexOf("const keadaanBerlaku = ", awal);
    expect(awal).toBeGreaterThan(0);
    const fn = vm.runInNewContext(`(${sumber.slice(awal, akhir).trim().replace(/;$/, "")})`) as (b: object, c: object) => boolean;
    const uji = (nilai: Record<string, { status: string; teks: string }> | undefined, terisi = false) => fn({ keadaan: "kuaKosong", pemicu: "", langsung: false, kode: "9430" }, { perkara: null, menyala: () => false, terisi: () => terisi, nilai });
    expect(uji({ "9431": { status: "terisi", teks: "Kantor Urusan Agama Kecamatan ..." } })).toBe(true); // SIPP kosong -> perlu diisi
    expect(uji({ "9431": { status: "terisi", teks: "Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah" } })).toBe(false); // SIPP sudah punya
    expect(uji({ "9431": { status: "terisi", teks: "Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala" } }, true)).toBe(true); // sudah diisi petugas tetap tampil
    expect(uji(undefined)).toBe(true); // belum terbaca: tetap tampil (tidak menebak)
    expect(uji({ "9431": { status: "kosong", teks: "" } })).toBe(true);
  });
});
