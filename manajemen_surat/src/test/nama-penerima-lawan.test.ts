import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  AMBANG_MIRIP,
  bersihkanKeterangan,
  cocokNamaPenerimaLawan,
  kemiripan,
  potonganNama,
} from "@/lib/nama-penerima-lawan";

/**
 * ============================================================================
 * PENANDA "DITERIMA PIHAK LAWAN?" - DIJAGA DENGAN BARIS SUNGGUHAN
 * ============================================================================
 *
 * Seluruh baris di bawah SALINAN APA ADANYA dari sipp_donggala, hasil sapuan
 * atas 14.495 relaas satker. Contoh karangan akan lulus untuk aturan yang
 * salah: yang menyusun contohnya sendiri cenderung menyusun yang menyenangkan
 * aturannya. Yang sungguh menjaga hanya kalimat yang memang ditulis jurusita -
 * dengan huruf besar semaunya, kurung, garis miring, dan salah ketik.
 *
 * Nama orang sungguhan ikut tertulis di sini. Itu disengaja dan tidak dapat
 * dihindari: penjaga ini justru menjaga bahwa nama-nama INI yang menyala dan
 * bukan yang lain, dan menyamarkannya berarti menjaga hal yang berbeda. Berkas
 * uji tidak ikut ke mana pun - ia tidak tertanam ke ekstensi dan tidak
 * dikirim ke peladen.
 */

/** Pihak lawan tunggal - bentuk yang paling sering di perkara perceraian. */
function lawan(nama: string, pihakKe: number) {
  return [{ nama, pihakKe }];
}

describe("cocokNamaPenerimaLawan - sepuluh tangkapan sungguhan", () => {
  // pihakKe di sini KEDUDUKAN RELAASNYA (2 = panggilan untuk tergugat), dan
  // nama yang disertakan nama PENGGUGATnya. Kesepuluhnya berpola sama:
  // panggilan untuk tergugat, diterima orang bernama sama dengan penggugat.
  const TANGKAPAN: Array<[string, string, string, string]> = [
    [
      "505/Pdt.G/2024",
      "telah diterima oleh Nurlina, orang yang tinggal serumah dengan pihak penerima",
      "Nur Lhyna alias Nurlina binti Beddu",
      "nurlina",
    ],
    [
      "39/Pdt.G/2025",
      "diterima oleh dian hasima",
      "Dian Hasima alias Dian Hasimah binti Abdul Latif",
      "dian",
    ],
    // Satu-satunya tangkapan yang TIDAK sama persis - 0,875, dan justru inilah
    // keadaan yang diminta ditangkap: "nama yang agak mirip".
    ["63/Pdt.G/2025", "diterima oleh Alfianti", "Alfianty binti Alam Barzah. P", "alfianti"],
    [
      "95/Pdt.G/2025",
      "DITERIMA ORANG SERUMAH (IBU YUNI)",
      "Yuni Cahyati binti Sarwan",
      "yuni",
    ],
    [
      "498/Pdt.G/2025",
      " Paket telah diterima oleh Deice ( DITERIMA ORANG SERUMAH )",
      "Deice binti Gustaf Sorongan",
      "deice",
    ],
    [
      "72/Pdt.G/2026",
      "diterima oleh yana/yang tinggal serumah dengan tergugat",
      "Ramla Yana alias Ramlayana binti Andi Ramli",
      "yana",
    ],
    [
      "87/Pdt.G/2026",
      "diterima oleh nanda/yang tinggal serumah dengan tergugat",
      "Nanda Tiara Adiningrum binti Sudiono",
      "nanda",
    ],
    [
      "419/Pdt.G/2026",
      "diterima oleh Parwati yang tinggal serumah dengan pihak penerima",
      "Parwati binti Samsudin",
      "parwati",
    ],
    [
      "483/Pdt.G/2026",
      "diterima oleh afit.d yang tinggal serumah dengan pihak penerima di rumah",
      "Afit alias Afid bin Yaco Samaila alias Yaco",
      "afit",
    ],
  ];

  it.each(TANGKAPAN)("%s menyala dan menyebut pemicunya", (_nomor, ket, nama, pemicu) => {
    const hasil = cocokNamaPenerimaLawan({
      pihakKe: 2,
      ketHasilRelaas: ket,
      pihak: lawan(nama, 1),
    });
    expect(hasil.cocok).toBe(true);
    expect(hasil.kataPemicu).toBe(pemicu);
    expect(hasil.namaLawan).toBe(nama);
  });
});

describe("cocokNamaPenerimaLawan - yang sengaja TIDAK menyala", () => {
  /**
   * Kedelapan baris ini yang muncul bila ambang diturunkan ke 0,80, dan
   * kedelapannya orang lain. Terukur: 0,85 memberi 10 tangkapan, 0,80 memberi
   * 18 - dan kedelapan tambahannya di bawah ini.
   */
  const DIAM: Array<[string, string, string]> = [
    ["nadira vs hadira", "diterima oleh HADIRA ( DITERIMA ORANG SERUMAH )", "Nadira binti Muhtar"],
    ["ervina vs ervin", "diterima oleh ( Ervin ) - ( DITERIMA ORANG SERUMAH )", "Ervina binti Sahrun"],
    ["rahman vs rahmat", "diterima oleh ( Rahmat ) - ( DITERIMA ORANG SERUMAH )", "Rahman bin Ladjalani"],
    ["andi vs andri", "telah diterima oleh Andri", "Andi Tenri binti Baso"],
    ["andi vs randi", "DITERIMA OLEH SI PENERIMA RANDI / MENOLAK UNTUK DIFOTO", "Andi Tenri binti Baso"],
    ["retna vs ratna", "diterima oleh hj.Ratna,ibu kandung pihak penerima", "Retna Wulandari binti Sudir"],
    // Yang paling terang salahnya: kata "ANTAR" pada kalimat pengantaran pos.
    ["anwar vs diantar", "PAKET AKAN DIANTAR ULANG KARENA LUAR BATAS ANTAR", "Anwar bin Latif"],
    ["desi vs desa", "diterima aparat desa", "Desi Ratnasari binti Hamid"],
  ];

  it.each(DIAM)("%s tetap diam", (_judul, ket, nama) => {
    expect(
      cocokNamaPenerimaLawan({ pihakKe: 2, ketHasilRelaas: ket, pihak: lawan(nama, 1) }).cocok
    ).toBe(false);
  });

  it("diam bila kedudukan relaasnya tidak diketahui", () => {
    // Tanpa tahu relaas ini untuk pihak yang mana, tidak ada "lawan" yang
    // dapat dibandingkan - dan menebaknya berarti menyalakan penanda merah di
    // atas tebakan.
    for (const ke of [null, undefined, 0, 3, 4, 5]) {
      expect(
        cocokNamaPenerimaLawan({
          pihakKe: ke,
          ketHasilRelaas: "diterima oleh Parwati yang tinggal serumah dengan pihak penerima",
          pihak: lawan("Parwati binti Samsudin", 1),
        }).cocok
      ).toBe(false);
    }
  });

  it("diam bila yang cocok justru pihaknya SENDIRI, bukan lawannya", () => {
    // Panggilan untuk tergugat yang diterima tergugat itu sendiri adalah
    // panggilan yang BERHASIL - kebalikan dari yang dicari penanda ini.
    expect(
      cocokNamaPenerimaLawan({
        pihakKe: 2,
        ketHasilRelaas: "diterima oleh Parwati sendiri",
        pihak: [
          { nama: "Parwati binti Samsudin", pihakKe: 2 },
          { nama: "Hamzah bin Yusuf", pihakKe: 1 },
        ],
      }).cocok
    ).toBe(false);
  });

  it("diam pada sebutan peran, betapa pun seringnya ditulis", () => {
    // "Bertemu Penggugat" tertulis ratusan kali di kolom ini. Memperlakukannya
    // sebagai nama akan menyalakan hampir seluruh berkas satker.
    for (const ket of [
      "Bertemu Penggugat",
      "panggilan sidang",
      "Panggilan Elektronik",
      "diserahkan kepada Pemerintah Desa untuk diteruskan Tergugat",
    ]) {
      expect(
        cocokNamaPenerimaLawan({
          pihakKe: 2,
          ketHasilRelaas: ket,
          pihak: lawan("Penggugat Desa binti Sidang", 1),
        }).cocok
      ).toBe(false);
    }
  });
});

describe("potonganNama - nasab, alias, gelar", () => {
  it("membuang nasab, sebab itu nama AYAH", () => {
    // Terukur pada data satker: mencocokkan nasab menaikkan tangkapan dari
    // 10/9 menjadi 13/11, dan ketiga tambahannya salah. Yang paling terang
    // perkara 148/Pdt.G/2025 - "diterima oleh bakri" atas lawan bernama
    // "Ria Artini Binti Bakri".
    expect(potonganNama("Ria Artini Binti Bakri")).not.toContain("bakri");
    expect(potonganNama("Ria Artini Binti Bakri")).toContain("artini");
    expect(
      cocokNamaPenerimaLawan({
        pihakKe: 2,
        ketHasilRelaas: "diterima oleh bakri",
        pihak: lawan("Ria Artini Binti Bakri", 1),
      }).cocok
    ).toBe(false);
  });

  it("memecah alias, tetapi tetap membuang nasab di tiap belahannya", () => {
    const potongan = potonganNama("Delvayana Haryadin alias Delvayana binti Haryadin");
    expect(potongan).toContain("delvayana");
    expect(potongan).toContain("haryadin"); // dari belahan PERTAMA - di sana ia nama sendiri
  });

  it("membuang gelar dan potongan pendek", () => {
    expect(potonganNama("Drs. H. Ali Sofyan, S.H., M.H.")).toEqual(["sofyan"]);
    // "ali" dibuang sebab kurang dari empat huruf - ia akan menyala pada
    // "alias", kata yang justru sering ada di kolom ini.
    expect(potonganNama("Drs. H. Ali Sofyan, S.H., M.H.")).not.toContain("ali");
  });
});

describe("bersihkanKeterangan", () => {
  it("membuang tag HTML dan entitas yang sungguh ada di kolom ini", () => {
    expect(bersihkanKeterangan("<p>diterima oleh&nbsp;<b>Parwati</b></p>")).toBe(
      "diterima oleh parwati"
    );
  });
});

describe("ambang 0,85 duduk di dalam jurang yang terukur", () => {
  it("melewatkan tangkapan benar terendah dan menahan tangkapan salah tertinggi", () => {
    // Jurangnya kosong antara 0,833 dan 0,875 - tidak ada satu nilai pun di
    // antaranya pada seluruh relaas satker.
    expect(kemiripan("alfianty", "alfianti")).toBeGreaterThanOrEqual(AMBANG_MIRIP);
    expect(kemiripan("nadira", "hadira")).toBeLessThan(AMBANG_MIRIP);
    expect(AMBANG_MIRIP).toBeGreaterThan(0.833);
    expect(AMBANG_MIRIP).toBeLessThanOrEqual(0.875);
  });
});

describe("penandanya sungguh terpasang di layar", () => {
  const berkas = fs.readFileSync(
    path.join(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
    "utf8"
  );

  it("dipakai pada relaas sidang ini DAN pada riwayatnya", () => {
    // Dua tempat, bukan satu. Relaas yang mencurigakan pada panggilan
    // SEBELUMNYA sama pentingnya - polanya justru terlihat di sana.
    const pakai = berkas.match(/<PenandaPenerimaLawan\b/g) ?? [];
    expect(pakai.length).toBe(2);
  });

  it("aturannya diimpor, tidak disalin ulang ke dalam layar", () => {
    expect(berkas).toContain('from "@/lib/nama-penerima-lawan"');
    expect(berkas).not.toContain("function kemiripan(");
  });

  it("judulnya bertanda tanya - mesin hanya tahu NAMAnya cocok", () => {
    // Bukan kerapian bahasa. Nama di Donggala berulang, dan penanda yang
    // pernah salah menuduh adalah penanda yang dipelajari orang untuk
    // dilewati.
    expect(berkas).toContain("Diterima pihak lawan?");
  });
});
