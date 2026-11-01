// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KartuDrafPutusanA1 } from "@/components/portal/draf-putusan-a1";

import { bandingDrafA1, butirAmarAkhir, kunciRujukan, topikPertimbangan } from "@/lib/banding-draf-a1";
import { periksaHasilAiA1, susunMasukanAiA1 } from "@/lib/draf-putusan-a1-ai";
import {
  CALON_DASAR,
  hurufDraf,
  kodeBukti,
  sasaranPeristiwaA1,
  susunDrafPutusanA1,
  type MasukanDrafA1,
  type PemeriksaRak,
  type SaksiA1,
} from "@/lib/draf-putusan-a1";
import type { Dalil, MatriksDalil, PembuktianDalil } from "@/lib/matriks-dalil";
import { bolehDisarankan, periksaNaskah } from "@/lib/rak-peraturan/indeks";
import type { Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import type { AletaDatabase } from "@/server/db/client";
import { susunDrafSatu, type SumberAgenH7 } from "@/server/modules/aleta-ecourt/agen-h7-putusan";
import { bolehDrafPutusanA1, saksiUntukA1, susunA1UntukDraf, tanpaDrafPutusan, type SumberA1 } from "@/server/modules/aleta-ecourt/draf-putusan-a1";

/**
 * A1 (1 Nov 2026) - draf pertimbangan & amar otomatis (lapis aturan + pemeriksa ALETA Ai + pemicu peristiwa + hak).
 *
 * UKUR (data lokal sipp_2810/aps_badilag_2810, 10 perkara cerai yang sudah putus: 6 CG verstek, 1 CT + 2 CG kontradiktoir,
 * 1 CG NO; matriks dalil dari posita SIPP, saksi ABT, tanpa penilaian A2, tanpa #8503# petugas), skrip
 * D:/Aplikasi/aleta/tmp/a1-ukur/ukur.ts, pembanding = bandingDrafA1 (API P3):
 *   amar      38 butir akhir: 24 sama + 10 mirip (biaya belum diketahui di data lokal) = 89%; hilang 4 (nafkah iddah/mut'ah CT
 *             dan hadhanah dari kesepakatan mediasi sebagian - di luar petitum; biaya); lebih 1.
 *   dasar     229 rujukan pasal di pertimbangan akhir: 59 ditulis draf (terverifikasi rak), 108 disebut sebagai tanda "belum
 *             terverifikasi" (RBg, UU 7/1989, PERMA belum dicocokkan naskah resmi), 62 tidak ada (hadhanah, kaidah, rujukan
 *             khusus perkara kontradiktoir); 8 rujukan draf tidak dipakai hakim. Verstek: 16/16 rujukan tertangkap pada 601.
 *   huruf     tanpa #8503#: 5/9 sama (1/9 sebelum disaring keterangan saksi); dengan #8503#: 7/9.
 *   bagian    hilang terbanyak: kaidah fikih (7/10 - sengaja tidak dikarang), akibat cerai (hadhanah), fakta pada NO.
 *   kinerja   2,4-8,5 ms per varian (pertama 78 ms karena memuat rak); pemeriksa kutipan atas draf: 0 temuan pasti.
 */

// ── Bahan sintetis (meniru 601/Pdt.G/2026, nama disamarkan) ─────────────────
function dalil(nomor: string, teks: string, huruf: string[] = [], tambahan: Partial<Dalil> = {}): Dalil {
  return {
    id: `G-${nomor.replace(/\D/g, "").padStart(10, "0").slice(0, 10)}`,
    sumber: "gugatan",
    pihak: "0046",
    sebutan: "Penggugat",
    bagian: "pokok",
    nomor,
    urut: Number(nomor) || 0,
    induk: null,
    lanjutan: null,
    teks,
    ringkas: teks.slice(0, 60),
    jenis: "posita-fakta",
    huruf,
    tanggapan: { status: "belum-dijawab", ragu: false, rincian: [] },
    pembuktian: null,
    asal: "sipp",
    dokumen: "posita SIPP",
    diunggah: "",
    ocr: false,
    berkas: -1,
    ...tambahan,
  };
}

const TEKS_4 = "4. Bahwa sejak bulan Oktober 2024 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan Tergugat kurang memnuhi nafkah;";
const TEKS_5 = "5. Bahwa puncak keretakan terjadi pada Januri 2025, Tergugat pergi meninggalkan kediaman bersama dan sejak itu Penggugat dan Tergugat berpisah tempat tinggal hingga sekarang;";

function matriks(pembuktian: Record<string, PembuktianDalil> = {}): MatriksDalil {
  const d = [
    dalil("1", "1. Bahwa pada tanggal 04 April 2021, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat Pegawai Pencatat Nikah;"),
    dalil("4", TEKS_4, ["F"]),
    dalil("5", TEKS_5, ["B", "F"]),
    dalil("7", "7. Bahwa keluarga telah mencoba mendamaikan Penggugat dan Tergugat namun tidak berhasil;"),
  ].map((x) => ({ ...x, pembuktian: pembuktian[x.nomor] ?? null }));
  return { versi: 1, sumberGugatan: "sipp", dalil: d, dokumen: [], ringkas: { jumlah: d.length, perSumber: {}, perJenis: {}, tanggapan: {}, ragu: 0, huruf: ["B", "F"] }, catatan: [], ms: 1 };
}

const SAKSI: SaksiA1[] = [1, 2].map((ke) => ({
  pihak: "P",
  ke,
  tanyaJawab: [
    { tanya: "Bagaimana rumah tangga?", jawab: "Sejak Oktober 2024 sering terjadi perselisihan dan pertengkaran karena Tergugat kurang memberi nafkah;" },
    { tanya: "Apakah masih serumah?", jawab: "Sudah berpisah tempat tinggal sejak Januari 2025, Tergugat pergi meninggalkan kediaman bersama;" },
    { tanya: "Apakah masih bisa rukun?", jawab: "Tidak ada harapan untuk rukun lagi, keluarga sudah mendamaikan namun tidak berhasil;" },
  ],
}));

const PETITUM =
  "<ol><li>Mengabulkan Gugatan Penggugat;</li><li>Menjatuhkan talak satu ba'in shughra Tergugat (Budi bin Ali) terhadap Penggugat (Sari binti Umar);</li><li>Membebankan biaya perkara ini sesuai peraturan yang berlaku;</li></ol><p>Subsider: mohon putusan yang seadil-adilnya.</p>";

function masukan(ubah: Partial<MasukanDrafA1> = {}): MasukanDrafA1 {
  return {
    jenisPerkara: "Cerai Gugat",
    nomorPerkara: "601/Pdt.G/2026/PA.Dgl",
    arah: "dikabulkan",
    verstek: true,
    sebutan: { P: "Penggugat", T: "Tergugat" },
    namaPihak1: ["Sari binti Umar"],
    namaPihak2: ["Budi bin Ali"],
    satker: "Donggala",
    biaya: 258500,
    petitum: PETITUM,
    matriks: matriks(),
    saksi: SAKSI,
    bukti: { P: ["P.1 Fotokopi Kartu Tanda Penduduk atas nama Penggugat", "P.2 Fotokopi Kutipan Akta Nikah Nomor 123/2021"], T: [] },
    lamaPisah: "1 (satu) tahun 7 (tujuh) bulan",
    lewatEcourt: true,
    ...ubah,
  };
}

/** Rak tiruan: hanya UU 1/1974, PP 9/1975, KHI, KUHPerdata yang terverifikasi (meniru keadaan rak 1 Nov). */
const RAK_TIRUAN: PemeriksaRak = (t) =>
  /Undang-Undang Nomor 1 Tahun 1974|Peraturan Pemerintah Nomor 9 Tahun 1975|Kompilasi Hukum Islam|KUHPerdata/.test(t) && !/Pasal 115 Kompilasi/.test(t)
    ? { boleh: true, sebab: "" }
    : { boleh: false, sebab: "belum dicocokkan dengan naskah resmi" };

const semuaTeks = (d: ReturnType<typeof susunDrafPutusanA1>) => d.bagian.flatMap((b) => b.paragraf.map((p) => p.teks)).join("\n");

describe("lapis aturan: dasar hukum hanya dari rak terverifikasi", () => {
  it("rujukan yang belum terverifikasi tidak ditulis di kalimat, hanya di tanda; yang terverifikasi ditulis", () => {
    const d = susunDrafPutusanA1(masukan({ periksaRak: RAK_TIRUAN }));
    const isi = semuaTeks(d);
    expect(isi).not.toMatch(/RBg|Undang-Undang Nomor 7 Tahun 1989|Peraturan Mahkamah Agung/);
    expect(isi).toContain("Pasal 19 huruf f Peraturan Pemerintah Nomor 9 Tahun 1975");
    expect(isi).toContain("Pasal 116 huruf f Kompilasi Hukum Islam");
    expect(isi).toContain("Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974");
    const tanda = d.tanda.join("\n");
    expect(tanda).toContain("Pasal 149 ayat (1) RBg");
    expect(tanda).toMatch(/^\[perlu dilengkapi: /m);
    expect(d.dasar.find((x) => x.teks === "Pasal 149 ayat (1) RBg")?.terverifikasi).toBe(false);
    // Kalimat verstek tetap utuh tanpa rujukan.
    expect(isi).toMatch(/Menimbang, bahwa gugatan yang diperiksa tanpa hadirnya Tergugat \(verstek\) dapat dikabulkan/);
  });

  it("rak sungguhan (P1): RBg/UU 7/1989 belum terverifikasi -> tidak ditulis; pemeriksa kutipan tanpa temuan pasti", () => {
    const d = susunDrafPutusanA1(masukan(), bolehDisarankan);
    const isi = semuaTeks(d);
    expect(isi).not.toMatch(/Pasal 149[^\n]*RBg/);
    expect(isi).toContain("Pasal 1865 KUHPerdata");
    expect(periksaNaskah(d.teksPertimbangan).filter((t) => t.pasti)).toEqual([]);
    for (const x of d.dasar) expect(x.terverifikasi).toBe(bolehDisarankan(x.teks).boleh);
  });

  it("rak berubah = draf berubah tanpa sunting kode (pemeriksa yang meloloskan RBg menulis Pasal 149)", () => {
    const d = susunDrafPutusanA1(masukan({ periksaRak: (t) => ({ boleh: !/SEMA|Mahkamah Agung/.test(t), sebab: "" }) }));
    expect(semuaTeks(d)).toContain("berdasarkan Pasal 149 ayat (1) RBg, gugatan");
  });
});

describe("lapis aturan: dalil, saksi, pembuktian", () => {
  it("teks dalil disalin APA ADANYA, termasuk salah ketik (keputusan 55)", () => {
    const d = susunDrafPutusanA1(masukan({ periksaRak: RAK_TIRUAN }));
    expect(d.dalil.find((x) => x.nomor === "4")?.teks).toBe(TEKS_4);
    expect(d.dalil.find((x) => x.nomor === "5")?.teks).toBe(TEKS_5);
    // Kalimat pertimbangan merujuk nomor dalil, tidak merangkum ulang ucapan pihak.
    expect(semuaTeks(d)).toContain("(dalil angka 4 dan 5 gugatan)");
    expect(semuaTeks(d)).not.toContain("memnuhi");
  });

  it("huruf dari dalil disaring keterangan saksi: B (meninggalkan dua tahun) tidak dikuatkan -> hanya F, B disebut di tanda", () => {
    const d = susunDrafPutusanA1(masukan({ periksaRak: RAK_TIRUAN }));
    expect(d.huruf).toBe("F");
    expect(d.hurufAsal).toBe("dalil");
    expect(d.tanda.join(" ")).toMatch(/huruf b juga didalilkan/);
    expect(d.isian.find((i) => i.kode === "8503")?.nilai).toBe("F");
  });

  it("huruf pilihan petugas (#8503#) menang dan tidak diusulkan ulang", () => {
    const d = susunDrafPutusanA1(masukan({ hurufAbt: "bf", periksaRak: RAK_TIRUAN }));
    expect(d.huruf).toBe("BF");
    expect(d.isian.some((i) => i.kode === "8503")).toBe(false);
    expect(hurufDraf({ hurufAbt: "", matriks: matriks({ "4": { status: "terbukti" } }) })).toEqual({ huruf: "F", asal: "pembuktian" });
  });

  it("pembuktian A2 kosong = belum dinilai (bertanda), tidak pernah dianggap terbukti diam-diam", () => {
    const d = susunDrafPutusanA1(masukan({ periksaRak: RAK_TIRUAN }));
    expect(d.dalil.every((x) => x.pembuktian === "belum-dinilai")).toBe(true);
    expect(d.pembuktian).toMatchObject({ dinilai: 0, terbukti: 0 });
    expect(d.tanda.join(" ")).toMatch(/pembuktian per dalil belum dinilai/);
  });

  it("penilaian A2 bertentangan dengan arah varian -> tanda, tidak dibetulkan", () => {
    const d = susunDrafPutusanA1(masukan({ matriks: matriks({ "4": { status: "belum-terbukti", catatan: "saksi hanya mendengar dari Penggugat" } }), periksaRak: RAK_TIRUAN }));
    expect(d.dalil.find((x) => x.nomor === "4")?.pembuktian).toBe("belum-terbukti");
    expect(d.tanda.join(" ")).toMatch(/dalil angka 4 dinilai belum terbukti tetapi varian ini mengabulkan/);
  });

  it("unsur dikuatkan dua saksi menjadi fakta hukum; saksi yang menyinggung dalil dicatat sebagai bahan", () => {
    const d = susunDrafPutusanA1(masukan({ periksaRak: RAK_TIRUAN }));
    const fakta = d.bagian.find((b) => b.kunci === "fakta")!.paragraf.map((p) => p.teks).join("\n");
    expect(fakta).toContain("1. Bahwa Penggugat dan Tergugat adalah suami istri yang sah dan belum pernah bercerai (bukti P.2);");
    expect(fakta).toContain("Bahwa antara Penggugat dan Tergugat terjadi perselisihan dan pertengkaran secara terus-menerus (keterangan saksi 1 Penggugat dan saksi 2 Penggugat);");
    expect(fakta).toContain("Bahwa Penggugat dan Tergugat telah berpisah tempat tinggal selama 1 (satu) tahun 7 (tujuh) bulan (keterangan");
    // Label pemeriksa katalog (memuat rujukan SEMA yang belum terverifikasi) tidak pernah masuk kalimat draf.
    expect(semuaTeks(d)).not.toMatch(/SEMA|orang dekat didengar|\(dinasihati/);
    expect(semuaTeks(d)).toMatch(/saksi-saksi tersebut adalah keluarga atau orang dekat Penggugat/);
    expect(d.dalil.find((x) => x.nomor === "5")?.saksi.length).toBe(2);
    expect(d.unsur.find((u) => u.kode === "f-selisih")?.saksi).toHaveLength(2);
  });

  it("bukti surat: kode dari baris #1214#, akta nikah dikenali", () => {
    expect(kodeBukti(["P.1 Fotokopi KTP", "P-2 Fotokopi Akta", "Fotokopi surat lain"], "P")).toEqual(["P.1", "P.2", "P.3"]);
    const d = susunDrafPutusanA1(masukan({ verstek: false, periksaRak: RAK_TIRUAN }));
    const bukti = d.bagian.find((b) => b.kunci === "bukti")!.paragraf.map((p) => p.teks).join("\n");
    expect(bukti).toContain("bukti surat P.1 dan P.2 serta 2 (dua) orang saksi;");
    expect(bukti).toMatch(/bukti P\.2 membuktikan Penggugat dan Tergugat terikat perkawinan yang sah[^;]*Pasal 7 ayat \(1\) Kompilasi Hukum Islam/);
  });
});

describe("lapis aturan: arah & amar", () => {
  it("dikabulkan verstek: amar dari petitum (pernyataan tidak hadir dulu, talak ba'in, biaya bernilai)", () => {
    const d = susunDrafPutusanA1(masukan({ periksaRak: RAK_TIRUAN }));
    expect(d.amar.ok).toBe(true);
    expect(d.amar.butir[0]).toMatch(/^Menyatakan Tergugat yang telah dipanggil secara resmi dan patut/);
    expect(d.amar.butir[1]).toBe("Mengabulkan gugatan Penggugat secara verstek;");
    expect(d.amar.butir.join(" ")).toMatch(/talak satu ba'in shughra Tergugat \(Budi bin Ali\) terhadap Penggugat \(Sari binti Umar\)/);
    expect(d.amar.butir.join(" ")).toMatch(/Rp258\.500,00/);
  });

  it("ditolak: penilaian 'tidak terbukti' menjadi usulan #8729#, amar menolak, tanpa usulan huruf", () => {
    const saksiLemah: SaksiA1[] = [{ pihak: "P", ke: 1, tanyaJawab: [{ tanya: "?", jawab: "Saya hanya mendengar dari Penggugat bahwa mereka bertengkar." }] }];
    const d = susunDrafPutusanA1(masukan({ arah: "ditolak", verstek: false, saksi: saksiLemah, periksaRak: RAK_TIRUAN }));
    expect(d.amar.butir.join(" ")).toMatch(/Menolak gugatan Penggugat/);
    const i = d.isian.find((x) => x.kode === "8729");
    expect(i?.nilai).toMatch(/^Menimbang, bahwa .*tidak diterangkan oleh sekurang-kurangnya dua orang saksi/);
    expect(d.isian.some((x) => x.kode === "8503")).toBe(false);
  });

  it("tanpa kata Aleta di kalimat draf; tanpa matriks tetap tersusun dengan tanda", () => {
    const d = susunDrafPutusanA1(masukan({ matriks: null, saksi: [], bukti: { P: [], T: [] }, periksaRak: RAK_TIRUAN }));
    expect(d.teksPertimbangan).not.toMatch(/aleta/i);
    expect(d.tanda.join(" ")).toMatch(/huruf alasan perceraian belum terbaca/);
    expect(d.tanda.join(" ")).toMatch(/pemeriksaan saksi belum tercatat/);
    expect(d.ms).toBeLessThan(200);
  });
});

describe("pembanding draf vs putusan akhir (API P3)", () => {
  const AMAR_AKHIR =
    "<ol><li>Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;</li><li>Mengabulkan gugatan Penggugat secara verstek;</li><li>Menjatuhkan talak satu ba&#39;in shughra Tergugat (Budi bin Ali) terhadap Penggugat (Sari binti Umar);</li><li>Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp258.500,00 (dua ratus lima puluh delapan ribu lima ratus rupiah).</li></ol>";
  const PERT =
    "<p>Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;</p><p>Menimbang, bahwa berdasarkan ketentuan Pasal 149 RBg, putusan verstek ...;</p><p>Menimbang, bahwa Penggugat mendasarkan gugatannya pada Pasal 19 huruf f Peraturan Pemerintah Nomor 9 Tahun 1975 jo. Pasal 116 huruf f Kompilasi Hukum Islam;</p><p>Artinya : kaidah fikih ...</p><p>Menimbang, bahwa berdasarkan Pasal 2 ayat (1) Undang-Undang Nomor 1 Tahun 1974 ...;</p>";

  it("amar: butir sama dihitung, dasar: sama / bertanda / hilang, bagian: kaidah fikih hilang, huruf sama", () => {
    const d = susunDrafPutusanA1(masukan({ periksaRak: RAK_TIRUAN }));
    const b = bandingDrafA1(d, { amarHtml: AMAR_AKHIR, pertimbanganHtml: PERT });
    expect(b.amar).toMatchObject({ akhir: 4, sama: 4, hilang: [], lebih: [] });
    expect(b.dasar.sama).toEqual(expect.arrayContaining(["KHI|116", "PP-9-1975|19"]));
    expect(b.dasar.samaBertanda).toContain("RBG|149");
    expect(b.dasar.hilang).toEqual(["UU-1-1974|2"]);
    expect(b.bagian.hilang).toContain("kaidah");
    expect(b.huruf).toEqual({ draf: "F", akhir: "F", sama: true });
  });

  it("pembantu: butir amar akhir tanpa judul MENGADILI, kunci rujukan, topik", () => {
    expect(butirAmarAkhir("<p>MENGADILI:</p><ol><li>Mengabulkan gugatan Penggugat;</li></ol>")).toEqual(["Mengabulkan gugatan Penggugat;"]);
    expect(kunciRujukan("Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 116 huruf f Kompilasi Hukum Islam")).toEqual(["KHI|116", "UU-1-1974|39"]);
    expect(topikPertimbangan("Menimbang, bahwa biaya perkara dibebankan kepada Penggugat;")).toEqual(["biaya"]);
  });
});

describe("pemicu peristiwa: BAS kesimpulan selesai / agenda berikutnya musyawarah", () => {
  const hariPutusan = (b: { agenda?: unknown }) => /musyawarah|putusan/i.test(String(b.agenda));
  const sidang = [
    { perkaraId: "1", tanggalSidang: "2026-10-30", agenda: "Kesimpulan" },
    { perkaraId: "1", tanggalSidang: "2026-11-10", agenda: "Musyawarah Majelis" },
    { perkaraId: "2", tanggalSidang: "2026-11-12", agenda: "Pembacaan Putusan" },
    { perkaraId: "3", tanggalSidang: "2026-10-31", agenda: "Pembuktian" },
    { perkaraId: "3", tanggalSidang: "2026-11-05", agenda: "Musyawarah Majelis" },
    { perkaraId: "4", tanggalSidang: "2026-10-29", agenda: "Kesimpulan" },
    { perkaraId: "4", tanggalSidang: "2026-11-20", agenda: "Musyawarah Majelis" },
  ];

  it("kesimpulan selesai didahulukan; tanpa sidang sebelumnya (2) atau lewat 14 hari (4) tidak dipicu", () => {
    const s = sasaranPeristiwaA1(sidang, "2026-11-01", new Map(), hariPutusan);
    expect(s.map((x) => [x.baris.perkaraId, x.sebab, x.sidangSebelum])).toEqual([
      ["1", "kesimpulan-selesai", "2026-10-30"],
      ["3", "agenda-putusan", "2026-10-31"],
    ]);
  });

  it("draf A1 yang lebih baru dari sidang sebelumnya tidak disusun ulang; draf lama atau tanpa A1 disusun", () => {
    const simpanan = new Map([
      ["1|2026-11-10", { dibuatPada: "2026-10-31T06:00:00Z", adaPutusan: true }],
      ["3|2026-11-05", { dibuatPada: "2026-11-01T06:00:00Z", adaPutusan: false }],
    ]);
    expect(sasaranPeristiwaA1(sidang, "2026-11-01", simpanan, hariPutusan).map((x) => x.baris.perkaraId)).toEqual(["3"]);
    const lama = new Map([["1|2026-11-10", { dibuatPada: "2026-10-29T06:00:00Z", adaPutusan: true }]]);
    expect(sasaranPeristiwaA1(sidang, "2026-11-01", lama, hariPutusan).map((x) => x.baris.perkaraId)).toContain("1");
  });
});

describe("lapis ALETA Ai: bahan & pemeriksa hasil", () => {
  const d = susunDrafPutusanA1(masukan({ periksaRak: RAK_TIRUAN }));

  it("masukan: nama pihak diganti [NAMA] dan dikirim untuk disamarkan; hanya rujukan terverifikasi yang boleh disebut", () => {
    const m = susunMasukanAiA1(d, "C2", d.namaSamaran);
    expect(m.masukan).not.toContain("Budi bin Ali");
    expect(m.masukan).toContain("[NAMA]");
    expect(m.samarkan.map((s) => s.nilai).sort()).toEqual(["Budi bin Ali", "Sari binti Umar"]);
    const c1 = susunMasukanAiA1(d, "C1", d.namaSamaran).masukan;
    expect(c1).toMatch(/DASAR HUKUM YANG BOLEH DISEBUT \(terverifikasi\): .*Pasal 116 huruf f Kompilasi Hukum Islam/);
    expect(c1).toMatch(/BELUM TERVERIFIKASI .*Pasal 149 ayat \(1\) RBg/);
    expect(c1).toContain(`"${TEKS_4}"`);
  });

  it("hasil: pasal di luar rak diberi [PERLU VERIFIKASI], yang terverifikasi tidak; kutipan dalil yang dibetulkan ditandai; Aleta dibuang", () => {
    const hasil =
      'Menimbang, bahwa sesuai Pasal 149 RBg dan Pasal 116 huruf f Kompilasi Hukum Islam, dalil "4. Bahwa sejak bulan Oktober 2024 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan Tergugat kurang memenuhi nafkah;" terbukti menurut ALETA Ai;';
    const h = periksaHasilAiA1(hasil, d, { boleh: RAK_TIRUAN });
    expect(h.teks).toMatch(/Pasal 149 RBg \[PERLU VERIFIKASI\]/);
    expect(h.teks).not.toMatch(/Kompilasi Hukum Islam \[PERLU VERIFIKASI\]/);
    expect(h.pasalDitandai.map((x) => x.rujukan)).toEqual([expect.stringMatching(/Pasal 149 RBg/)]);
    expect(h.kutipanBerubah.map((x) => x.nomor)).toEqual(["4"]);
    expect(h.teks).not.toMatch(/aleta/i);
    // Penanda tidak berlipat bila diperiksa ulang.
    expect(periksaHasilAiA1(h.teks, d, { boleh: RAK_TIRUAN }).teks.match(/PERLU VERIFIKASI/g)).toHaveLength(1);
  });
});

describe("hak & penyusun server", () => {
  it("hanya hakim, ketua, wakil ketua, Super Admin; peran tambahan ikut", () => {
    expect(bolehDrafPutusanA1({ roleId: "hakim" } as never)).toBe(true);
    expect(bolehDrafPutusanA1({ roleId: "wakil-ketua" } as never)).toBe(true);
    expect(bolehDrafPutusanA1({ roleId: "super-admin" } as never)).toBe(true);
    expect(bolehDrafPutusanA1({ roleId: "panitera-pengganti" } as never)).toBe(false);
    expect(bolehDrafPutusanA1({ roleId: "admin" } as never)).toBe(false);
    expect(bolehDrafPutusanA1({ roleId: "panitera-pengganti", additionalRoleIds: ["hakim"] } as never)).toBe(true);
    expect(bolehDrafPutusanA1(null)).toBe(false);
  });

  it("saksi ABT -> saksi A1 (pihak & urutan di pihaknya, jawaban kosong dibuang)", () => {
    expect(
      saksiUntukA1([
        { pihak: "P", saksiKePihak: 1, tanyaJawab: [{ pertanyaan: "a", jawaban: "b" }, { pertanyaan: "c", jawaban: "" }] },
        { pihak: "T", saksiKePihak: 1, tanyaJawab: [] },
        { tanyaJawab: [{ pertanyaan: "x", jawaban: "y" }] },
      ])
    ).toEqual([
      { pihak: "P", ke: 1, tanyaJawab: [{ tanya: "a", jawab: "b" }] },
      { pihak: "T", ke: 1, tanyaJawab: [] },
      { pihak: "P", ke: 2, tanyaJawab: [{ tanya: "x", jawab: "y" }] },
    ]);
  });

  const SUMBER_A1: SumberA1 = {
    async fakta() {
      return { petitum: PETITUM, pihak1: ["Sari binti Umar"], pihak2: ["Budi bin Ali"], perkaraId: 601, tanggalDaftar: "2026-10-01" };
    },
    async biaya() {
      return { prodeo: false, tahunDaftar: 2026, namaPengadilan: "Donggala", biaya: 258500, terbilang: "dua ratus lima puluh delapan ribu lima ratus rupiah" };
    },
    async satker() {
      return "Donggala";
    },
    async matriks() {
      return matriks();
    },
    async pustaka() {
      return [];
    },
  };

  it("bahan gagal dibaca dicatat di kendala, draf tetap tersusun", async () => {
    const h = await susunA1UntukDraf(
      {} as AletaDatabase,
      { baris: { perkaraId: "601" }, nomorPerkara: "601/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", sebutan: { P: "Penggugat", T: "Tergugat" }, nilai: {}, saksi: [], verstek: true, varian: ["dikabulkan"] },
      { ...SUMBER_A1, fakta: async () => null, matriks: async () => { throw new Error("bot mati"); } }
    );
    expect(h.kendala).toEqual(["petitum dan pihak dari SIPP (draf amar)", "matriks dalil (draf pertimbangan per dalil)"]);
    expect(h.per.dikabulkan?.tanda.join(" ")).toMatch(/petitum belum terbaca dari SIPP/);
    expect(h.per.dikabulkan?.tanda.join(" ")).toMatch(/nama para pihak belum terbaca/);
  });

  // ── Terpadu dengan agen H-7 (sumber tiruan, pola uji varian tolak 17 Okt) ──
  const KATALOG = new Map<string, Definisi>([
    ["8503", { kode: "8503", nama: "Alasan Perceraian", jenis: "data_teks", sql: "", bawaan: "" }],
    ["8729", { kode: "8729", nama: "Tolak cerai: penilaian saksi", jenis: "data_teks", sql: "", bawaan: "" }],
  ]);
  const BARIS = {
    perkaraId: "601", nomorPerkara: "601/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalSidang: "2026-11-10", agenda: "Musyawarah Majelis",
    urutanSidang: 3, panggilan: { tergugatPernahHadir: true }, lewatEcourt: true,
  };
  function sumberH7(denganA1: boolean): SumberAgenH7 {
    const tak = async () => [];
    return {
      async jadwal() {
        return { ok: true, galat: "", sidang: [] };
      },
      async bacaBlangko(_f, berkas) {
        return { ada: true, penanda: /Tolak/.test(berkas) ? ["8729"] : ["8503"], sebab: "" };
      },
      async katalog() {
        return KATALOG;
      },
      async nilaiPenanda() {
        return { ada: true, sebab: "", nilai: { "1214": { status: "terisi", teks: "P.1 Fotokopi KTP<br>P.2 Fotokopi Kutipan Akta Nikah" } } };
      },
      async usulan() {
        return { ok: true, galat: "", jalur: [] };
      },
      riwayat: tak,
      async saksi() {
        return SAKSI.map((s) => ({ pihak: s.pihak, saksiKePihak: s.ke, tanyaJawab: s.tanyaJawab.map((q) => ({ pertanyaan: q.tanya, jawaban: q.jawab })) }));
      },
      dokumen: tak,
      ktp: tak,
      ...(denganA1 ? { a1: SUMBER_A1 } : {}),
    };
  }

  it("susunDrafSatu: draf A1 per varian (mengabulkan & menolak) + kinerja; tanpa sumber A1 = draf lama", async () => {
    const d = (await susunDrafSatu({} as AletaDatabase, BARIS, sumberH7(true), new Date("2026-11-01T08:00:00+08:00"), { pemicu: "peristiwa" }))!;
    expect(d.putusan?.arah).toBe("dikabulkan");
    expect(d.putusan?.verstek).toBe(false);
    expect(d.putusan?.amar.butir[0]).toBe("Mengabulkan gugatan Penggugat;");
    expect(d.varian?.[0].putusan?.arah).toBe("ditolak");
    expect(d.kinerja).toMatchObject({ pemicu: "peristiwa" });
    expect(d.kinerja!.msTotal).toBeGreaterThanOrEqual(d.kinerja!.msSusunA1);
    // Hak: akun selain hakim tidak menerima draf pertimbangan & amar.
    const t = tanpaDrafPutusan(d);
    expect(t.putusan).toBeUndefined();
    expect(t.varian?.[0].putusan).toBeUndefined();
    expect(t.isian).toEqual(d.isian);

    const lama = (await susunDrafSatu({} as AletaDatabase, BARIS, sumberH7(false)))!;
    expect(lama.putusan).toBeUndefined();
    const mati = (await susunDrafSatu({} as AletaDatabase, BARIS, sumberH7(true), new Date(), { a1: false }))!;
    expect(mati.putusan).toBeUndefined();
  });

  it("calon dasar hukum: tiap entri satu rujukan yang dikenali pembaca rujukan (supaya rak dapat memeriksanya)", () => {
    for (const daftar of Object.values(CALON_DASAR)) for (const c of daftar) if (!/SEMA/.test(c)) expect(kunciRujukan(c).length, c).toBeGreaterThan(0);
  });
});

describe("kartu draf pertimbangan & amar (pop-up draf putusan)", () => {
  it("terlipat bawaan: ringkas di judul, isi belum dirender (pop-up tetap ringan)", () => {
    const d = susunDrafPutusanA1(masukan({ periksaRak: RAK_TIRUAN }));
    const html = renderToStaticMarkup(createElement(KartuDrafPutusanA1, { putusan: d }));
    expect(html).toContain("Draf pertimbangan dan amar");
    expect(html).toContain(`${d.amar.butir.length} butir amar`);
    expect(html).toContain(`${d.tanda.length} perlu diperiksa`);
    expect(html).not.toContain("data-isi-draf-a1");
    expect(html).toMatch(/dark:bg-sky-950/);
  });
});
