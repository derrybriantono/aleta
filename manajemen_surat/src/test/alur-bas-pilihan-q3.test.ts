// @vitest-environment node
import { describe, expect, it } from "vitest";

import { gabungAlurLama, susunBarisBasMassal, type BarisSidangBas, type KatalogFolder } from "@/app/api/aleta-ecourt/bas-massal/susun";
import { ALUR_BAS, langkahAlur04, tentukanAlurBas } from "@/lib/alur-bas";
import { tentukanAlurBasKumulasi } from "@/lib/alur-bas-kumulasi";

/**
 * ============================================================================
 * BAS MASSAL: TAG ALUR MENJADI PILIHAN (Q3, 16 Okt 2026; peta perkara L3 15 Okt, kesenjangan bagian 2)
 * ============================================================================
 *
 * Yang dijaga:
 *   - langkah ALUR 04 ditebak dari AGENDA lebih dulu (mediasi|laporan|pokok -> 2, jawab -> 3, replik -> 4, duplik [rekonvensi] -> 5/5a,
 *     kesimpulan -> 8, musyawarah|putusan -> 9, pembuktian P/T -> 6/7), baru dari urutan sidang;
 *   - varian saksi (2c, 3c, 6a-c, 7a-b, ALUR 06 3c) dan langkah alur lain (ALUR 01, ALUR 03 [2], ALUR 05, cabut/NO/gugur) jadi alternatif;
 *   - hasil itu menjadi PILIHAN berkas di folder "<jenis> - BAS" yang sesuai jenis perkara (lewat salinannya), tanpa menggandakan
 *     berkas arsip yang sama dan tanpa mengganti usulan katalog/pemetaan admin.
 */

const CG = "Cerai Gugat";
const CT = "Cerai Talak";
const tebak = (m: Parameters<typeof tentukanAlurBas>[0]) => tentukanAlurBas(m);
const kode = (h: ReturnType<typeof tentukanAlurBas>) => `${h.alur?.id}[${h.langkah?.kode}]`;
const alt = (h: ReturnType<typeof tentukanAlurBas>) => h.alternatif.map((l) => l.kode);
const lain = (h: ReturnType<typeof tentukanAlurBas>) => (h.lainAlur ?? []).map((x) => `${x.alur.id}[${x.langkah.kode}]`);

describe("langkah ALUR 04 dari agenda", () => {
  it("kata kunci agenda menentukan langkah (urutan sama dengan penyusun peta L3)", () => {
    const l = (n: number, ag: string) => langkahAlur04(n, ag).kode;
    expect(l(3, "Laporan Mediasi dan Pemeriksaan Pokok Perkara")).toBe("2");
    expect(l(4, "Jawaban Tergugat")).toBe("3");
    expect(l(5, "Jawab menjawab")).toBe("3");
    expect(l(5, "Replik Penggugat")).toBe("4");
    expect(l(6, "Duplik Tergugat")).toBe("5");
    expect(l(6, "Duplik Rekonvensi")).toBe("5a");
    expect(l(7, "Kesimpulan para pihak")).toBe("8");
    expect(l(8, "Musyawarah Majelis dan Pembacaan Putusan")).toBe("9");
    expect(l(5, "Pembuktian Penggugat")).toBe("6");
    expect(l(9, "Pembuktian Tergugat")).toBe("7");
    expect(l(6, "Pembuktian")).toBe("6"); // sisi tak disebut: ke-6 ke bawah = P
    expect(l(8, "Pembuktian")).toBe("7"); // sesudahnya T
    expect(langkahAlur04(6, "Pembuktian").alternatif).toEqual(["6a", "6b", "6c", "7"]);
  });

  it("sidang 1 dan 2 tetap [1]/[2]; tanpa agenda atau agenda tak dikenal jatuh ke urutan sidang (perilaku lama, maks 9)", () => {
    expect(langkahAlur04(1, "Jawaban").kode).toBe("1");
    expect(langkahAlur04(2, "Pembuktian").kode).toBe("2");
    expect(langkahAlur04(4, "").kode).toBe("4");
    expect(langkahAlur04(4, "Sidang lanjutan").kode).toBe("4");
    expect(langkahAlur04(12, "").kode).toBe("9");
    expect(langkahAlur04(5, "").alternatif).toEqual(["5a"]);
    expect(langkahAlur04(6, "").alternatif).toEqual(["6a", "6b", "6c"]);
    expect(langkahAlur04(7, "").alternatif).toEqual(["7a", "7b"]);
    expect(langkahAlur04(5, "Duplik").dariAgenda).toBe(true);
    expect(langkahAlur04(5, "").dariAgenda).toBe(false);
  });

  it("tentukanAlurBas memakai agenda untuk kontradiktoir dan menyebutkannya di sebab", () => {
    const h = tebak({ jenisPerkara: CG, urutanSidang: 5, dihadiriOleh: 1, agenda: "Replik Penggugat" });
    expect(kode(h)).toBe("alur-04[4]");
    expect(h.sebab).toContain("dibaca dari agenda");
    const k = tebak({ jenisPerkara: CT, urutanSidang: 8, dihadiriOleh: 1, agenda: "Pembuktian Tergugat" });
    expect(kode(k)).toBe("alur-04[7]");
    expect(alt(k)).toEqual(["7a", "7b"]);
  });
});

describe("alternatif: varian saksi dan alur lain", () => {
  it("verstek: ALUR 01 (1a CG / 1b CT) pada sidang 1; ALUR 03 [2] dan 5 saksi pada sidang 2; agenda tunda TIDAK menggeser usulan", () => {
    const g = tebak({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 2 });
    expect(kode(g)).toBe("alur-02[1]");
    expect(lain(g)).toContain("alur-01[1a]");
    const t = tebak({ jenisPerkara: CT, urutanSidang: 1, dihadiriOleh: 2 });
    expect(lain(t)).toContain("alur-01[1b]");
    expect(lain(t)).not.toContain("alur-01[1a]");

    const s2 = tebak({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, agenda: "Panggil Tergugat" });
    expect(kode(s2)).toBe("alur-02[2]"); // 81% sidang ke-2 verstek tuntas di sidang itu walau agenda masih "panggil"
    expect(alt(s2)).toEqual(["2a", "2b", "2c"]);
    expect(lain(s2)).toContain("alur-03[2]");
  });

  it("verstek 3+ sidang: varian 5 saksi; ALUR 03 [3] dan [2] saling menjadi alternatif", () => {
    const akhir = tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 2, agenda: "Pembuktian" });
    expect(kode(akhir)).toBe("alur-03[3]");
    expect(alt(akhir)).toEqual(["3a", "3b", "3c", "2"]);
    const tunda = tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 2, agenda: "Panggil Tergugat" });
    expect(kode(tunda)).toBe("alur-03[2]");
    expect(alt(tunda)).toEqual(["3", "3a", "3b", "3c"]);
  });

  it("T pernah hadir lalu tidak hadir: ALUR 06 [3] ber-5 saksi; semua tak hadir -> ALUR 04 [T] / 07 ikut", () => {
    const a = tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 2, tergugatPernahHadir: true });
    expect(kode(a)).toBe("alur-06[3]");
    expect(alt(a)).toEqual(["3a", "3b", "3c", "2"]);
    const b = tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 4, tergugatPernahHadir: true });
    expect(lain(b)).toEqual(expect.arrayContaining(["alur-04[T]", "alur-07[2]"]));
  });

  it("kontradiktoir sidang awal: ALUR 05 (lisan) ditawarkan bila agenda tak menyebut penanda tertulis; tidak bila ada", () => {
    const polos = tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 1, agenda: "Jawab menjawab" });
    expect(lain(polos)).toEqual(expect.arrayContaining(["alur-05[3]", "alur-05[3a]"]));
    const tertulis = tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 1, agenda: "Jawaban e-Litigasi" });
    expect(lain(tertulis).some((x) => x.startsWith("alur-05"))).toBe(false);
    const jauh = tebak({ jenisPerkara: CG, urutanSidang: 6, dihadiriOleh: 1, agenda: "Pembuktian" });
    expect(lain(jauh).some((x) => x.startsWith("alur-05"))).toBe(false);
  });

  it("cerai: cabut / NO / gugur yang belum diketahui ikut sebagai pilihan (dulu hanya bila akhir diketahui)", () => {
    const k = tebak({ jenisPerkara: CT, urutanSidang: 3, dihadiriOleh: 1, agenda: "Pembuktian" });
    expect(lain(k)).toEqual(expect.arrayContaining(["alur-08[B]", "alur-08[C2]", "alur-09[1]", "alur-09[2]", "alur-07[3]"]));
    const s1 = tebak({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 2 });
    expect(lain(s1)).toEqual(expect.arrayContaining(["alur-08[A]", "alur-09[1]"]));
    expect(lain(s1)).not.toContain("alur-07[3]");
    // bukan perceraian: tidak ada pilihan cabut/NO ala cerai
    const it = tebak({ jenisPerkara: "Istbat Nikah", urutanSidang: 2, dihadiriOleh: 1 });
    expect(lain(it)).toEqual([]);
  });

  it("tiap langkah alternatif dan lain ada di peta alur (tidak ada kombinasi yang jatuh ke 'peta rusak')", () => {
    for (const j of [CG, CT]) {
      for (const u of [0, 1, 2, 3, 4, 5, 6, 8, 12]) {
        for (const h of [null, 1, 2, 3, 4]) {
          for (const pernah of [undefined, true, false]) {
            for (const ag of ["", "Pembuktian", "Jawab menjawab lisan", "Duplik Rekonvensi", "Panggil Tergugat", "Musyawarah dan putusan"]) {
              const r = tentukanAlurBasKumulasi({ jenisPerkara: j, urutanSidang: u, dihadiriOleh: h, tergugatPernahHadir: pernah, agenda: ag });
              expect(r.alur).not.toBeNull();
              expect(r.sebab).not.toMatch(/Peta alur BAS rusak/);
              for (const x of r.lainAlur ?? []) expect(ALUR_BAS.find((a) => a.id === x.alur.id)!.langkah.includes(x.langkah)).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("pilihan BAS massal dari penebak alur (susun.ts sungguhan)", () => {
  const dasar: BarisSidangBas = {
    sidangId: "s1",
    perkaraId: "100",
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    jenisPerkara: CG,
    tanggalSidang: "2026-10-16",
    jamSidang: "09:00",
    agenda: "Sidang Pertama",
    urutanSidang: 1,
    dihadiriOleh: 2,
    paniteraNama: "PP Satu",
  };
  const susun = (baris: BarisSidangBas[], katalog: Record<string, KatalogFolder> = {}) =>
    susunBarisBasMassal(baris, { namaAkun: "PP Satu", saringan: "semua", katalog, lembar: {}, saat: null }).baris;

  it("tag alur menjadi pilihan berisi SALINAN di folder '<jenis> - BAS'; cerai talak mendapat folder CT, bukan CG", () => {
    const [cg, ct] = susun([dasar, { ...dasar, nomorPerkara: "2/Pdt.G/2026/PA.Dgl", perkaraId: "101", jenisPerkara: CT }]);
    expect(cg.blangko.pilihan.every((p) => (p.salinan ?? []).every((s) => s.menu === "Cerai Gugat - BAS"))).toBe(true);
    expect(ct.blangko.pilihan.every((p) => (p.salinan ?? []).every((s) => s.menu === "Cerai Talak - BAS"))).toBe(true);
    expect(cg.blangko.pilihan.every((p) => (p.salinan ?? []).length > 0)).toBe(true);
    // ALUR 01 (putus verstek di sidang 1) ikut: 1a untuk CG, 1b untuk CT
    expect(cg.blangko.pilihan.some((p) => p.berkas.startsWith("[1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek di Sidang Pertama - Cerai Gugat"))).toBe(true);
    expect(ct.blangko.pilihan.some((p) => p.berkas.startsWith("[1b] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek di Sidang Pertama - Cerai Talak"))).toBe(true);
    expect(cg.blangko.pilihan.some((p) => p.berkas.startsWith("[1b]"))).toBe(false);
    // usulan = langkah utama alur, ditandai perkiraan
    expect(cg.blangko.usulan).toMatchObject({ setId: "alur-02", perkiraan: true, kehadiran: "tidak-diketahui" });
    expect(cg.blangko.usulan!.berkas).toBe(cg.alurBas!.berkas);
    // tanpa duplikat salinan
    const kunci = cg.blangko.pilihan.map((p) => `${p.salinan![0].folder}|${p.salinan![0].berkas}`);
    expect(new Set(kunci).size).toBe(kunci.length);
  });

  it("varian saksi dan langkah lintas alur ikut sebagai pilihan (verstek sidang 2: 2, 2a, 2b, 2c, ALUR 03 [2], cabut/NO)", () => {
    const [b] = susun([{ ...dasar, urutanSidang: 2, agenda: "Pembuktian" }]);
    const nama = b.blangko.pilihan.map((p) => p.label.split("]")[0].replace("[", ""));
    expect(nama).toEqual(expect.arrayContaining(["2", "2a", "2b", "2c"]));
    expect(b.blangko.pilihan.map((p) => p.setId)).toEqual(expect.arrayContaining(["alur-02", "alur-03", "alur-08", "alur-09"]));
  });

  it("usulan dari katalog arsip / pemetaan admin TIDAK diganti; berkas arsip yang sama dengan langkah alur tidak digandakan", () => {
    // Katalog arsip set contra: BAS 4 (Replik) - padanannya ALUR 04 [4]
    const folderContra = "derry_briantono/- BAS CONTRA PERCERAIAN -";
    const katalog: Record<string, KatalogFolder> = {
      [folderContra]: {
        terbaca: true,
        sebab: "",
        blangko: [
          {
            berkas: "[02] BAS 4 P & T Hadir Replik dan (Apabila ada Jawaban Rekonvensi) PERMA 7 2022 & Keputusan Dirjen 1465.rtf",
            basKe: 4,
            keadaan: "P & T Hadir",
            tindakan: "Replik",
          },
        ],
      },
    };
    const [b] = susun([{ ...dasar, urutanSidang: 4, dihadiriOleh: 1, agenda: "Replik Penggugat" }], katalog);
    expect(b.blangko.usulan).not.toBeNull();
    expect(b.blangko.usulan!.folder).toBe(folderContra); // usulan arsip dipertahankan
    expect(b.blangko.usulan!.perkiraan).toBeFalsy();
    // ALUR 04 [4] adalah berkas yang sama dengan BAS 4 arsip: tidak muncul dua kali
    const bas4 = b.blangko.pilihan.filter((p) => /BAS ALUR 04 \[4\]/.test(p.salinan?.[0]?.berkas ?? ""));
    expect(bas4).toHaveLength(1);
    // pilihan alur lain (cabut/NO) tetap ditambahkan di belakang; agenda "Replik" bertanda tertulis sehingga ALUR 05 (lisan) tidak ditawarkan
    expect(b.blangko.pilihan.some((p) => p.setId === "alur-08")).toBe(true);
    expect(b.blangko.pilihan.some((p) => p.setId === "alur-05")).toBe(false);
  });

  it("gabungAlurLama: format tanpa-kehadiran (tahan) tidak menyentuh usulan; alur tanpa salinan di folder jenis dilewati", () => {
    const h = tentukanAlurBasKumulasi({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, agenda: "" });
    const usulanFormat = { folder: "x", berkas: "format.rtf", setId: "f", setNama: "F", basKe: 0, label: "format", kehadiran: "cocok" as const };
    const g = gabungAlurLama({ usulan: usulanFormat, pilihan: [usulanFormat], sebab: "" }, h, CG, true);
    expect(g.usulan).toBe(usulanFormat);
    expect(g.pilihan[0]).toBe(usulanFormat);
    expect(g.pilihan.length).toBeGreaterThan(1);
    // jenis yang tak punya salinan (Ekonomi Syariah): hasil dasar dikembalikan apa adanya
    const dasarKosong = { usulan: null, pilihan: [], sebab: "belum ada" };
    expect(gabungAlurLama(dasarKosong, h, "Ekonomi Syariah")).toBe(dasarKosong);
    expect(gabungAlurLama(dasarKosong, null, CG)).toBe(dasarKosong);
  });

  it("agenda 'Jawaban' pada sidang ke-5 kontradiktoir menaikkan [3] menjadi usulan dan [5] tetap pilihan", () => {
    const [b] = susun([{ ...dasar, urutanSidang: 5, dihadiriOleh: 1, agenda: "Jawaban Tergugat" }]);
    expect(b.alurBas).toMatchObject({ id: "alur-04", kode: "3" });
    expect(b.blangko.usulan!.label.startsWith("[3]")).toBe(true);
  });
});
