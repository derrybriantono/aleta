/**
 * PENJAGA PANDUAN FITUR TERBARU (R9, 18 Okt 2026)
 *
 * Panduan di aplikasi tertinggal dari rilis ekstensi 1.188 sampai 1.205.x.
 * Uji ini menjaga tiga hal:
 *   1. ringkasan per peran (panduan-fitur-peran.json) lengkap, bahasanya
 *      sederhana, dan sampai ke peran yang tepat di halaman Panduan;
 *   2. tutorial per fitur untuk rilis itu ada dan hanya terlihat oleh peran
 *      yang memang memakainya;
 *   3. tutorial yang menunggu ekstensi 1.205.6 (Susun saksi menurut keadaan
 *      perkara dan tampilan panel V2) tersimpan rapi, tidak tampil sebelum
 *      waktunya, dan WAJIB diaktifkan begitu catatan 1.205.6 ada.
 */
import { describe, expect, it } from "vitest";

import { CATATAN_EKSTENSI } from "@/lib/catatan-ekstensi";
import { GOLONGAN_PERAN, type GolonganPeran } from "@/lib/matriks-peran";
import { PANDUAN_FITUR_PERAN, USER_GUIDES, GUIDE_MODULE_LABELS, type GuideAudience } from "@/lib/user-guides";
import { TUTORIAL } from "@/lib/tutorial-isi";
import {
  TUTORIAL_1206_AKTIF,
  TUTORIAL_MENUNGGU_1206,
  VERSI_TUTORIAL_MENUNGGU,
} from "@/lib/tutorial-isi-menunggu-1206";
import { tutorialTampil, type Tutorial } from "@/lib/tutorial-hidup";

const AUDIENS_SAH: readonly GuideAudience[] = ["all", "super_admin", "admin", "pimpinan", "hakim", "panitera", "jurusita", "kasir", "ptsp", "pegawai"];

const DILARANG: Array<[RegExp, string]> = [
  [/\btemplate\b/i, "pakai 'blangko', bukan 'template'"],
  [/\bpeladen\b/i, "pakai 'server', bukan 'peladen'"],
  [/\bborang\b/i, "pakai 'blangko' atau 'form'"],
  [/\bgalat\b/i, "pakai 'error'"],
  [/\bendpoint\b/i, "istilah teknis"],
  [/\bAPI\b/, "istilah teknis"],
  [/\blocalhost\b/i, "istilah teknis"],
  [/\bjson\b/i, "istilah teknis"],
  [/\bvitest\b|\bdrizzle\b|\bmigrasi\b/i, "istilah teknis"],
  [/\.(tsx?|mjs|js)\b/, "nama berkas kode"],
  [/\bhttps?:\/\//i, "alamat teknis"],
  [/\bundefined\b|\bnull\b/i, "kebocoran nilai kosong"],
];

function teksTutorial(t: Tutorial): string[] {
  return [t.judul, t.ringkas, ...t.langkah, ...(t.peringatan ?? []), ...(t.kataKunci ?? []), t.tautan?.teks ?? ""];
}

const lihat = (t: Tutorial, g: GolonganPeran) => tutorialTampil(t, { sebagaiGolongan: [g] });
const tutorial = (id: string) => {
  const t = TUTORIAL.find((x) => x.id === id);
  if (!t) throw new Error(`tutorial ${id} tidak ada`);
  return t;
};

describe("ringkasan fitur terbaru per peran", () => {
  it("memuat satu panduan untuk tiap peran utama dan semua pegawai", () => {
    const audiens = new Set(PANDUAN_FITUR_PERAN.flatMap((g) => g.audiences));
    for (const wajib of ["all", "super_admin", "admin", "pimpinan", "hakim", "panitera", "jurusita", "kasir", "ptsp"] as GuideAudience[]) {
      expect(audiens.has(wajib), `peran ${wajib} belum punya ringkasan fitur terbaru`).toBe(true);
    }
  });

  it("bentuknya benar: id unik, audiens sah, langkah praktis, modul terdaftar", () => {
    const id = PANDUAN_FITUR_PERAN.map((g) => g.id);
    expect(new Set(id).size).toBe(id.length);
    expect(new Set(USER_GUIDES.map((g) => g.id)).size, "id panduan bentrok dengan panduan lama").toBe(USER_GUIDES.length);
    for (const g of PANDUAN_FITUR_PERAN) {
      expect(GUIDE_MODULE_LABELS[g.module], g.id).toBeTruthy();
      expect(g.audiences.length, g.id).toBeGreaterThan(0);
      for (const a of g.audiences) expect(AUDIENS_SAH, `${g.id}: audiens ${a}`).toContain(a);
      expect(g.steps.length, `${g.id}: minimal lima langkah`).toBeGreaterThanOrEqual(5);
      expect(g.notes.length, g.id).toBeGreaterThan(0);
      expect(g.troubleshooting.length, g.id).toBeGreaterThan(0);
      for (const kalimat of [...g.steps, ...g.notes, ...g.troubleshooting]) {
        expect(kalimat.trim(), `${g.id}: "${kalimat.slice(0, 40)}" tanpa tanda baca penutup`).toMatch(/[.!?)]$/);
        expect(kalimat.length, `${g.id}: kalimat terlalu panjang`).toBeLessThanOrEqual(420);
      }
    }
  });

  it("bahasa sederhana: tanpa 'template', 'peladen', 'borang', 'galat', dan label teknis", () => {
    const temuan: string[] = [];
    for (const g of PANDUAN_FITUR_PERAN) {
      for (const teks of [g.title, g.summary, ...g.steps, ...g.notes, ...g.troubleshooting]) {
        for (const [pola, alasan] of DILARANG) if (pola.test(teks)) temuan.push(`${g.id}: "${teks.slice(0, 60)}" (${alasan})`);
      }
    }
    expect(temuan).toEqual([]);
  });

  it("panduan teknis server tidak ikut terbawa ke peran non-pengelola", () => {
    for (const g of PANDUAN_FITUR_PERAN.filter((x) => !x.audiences.some((a) => a === "super_admin" || a === "admin"))) {
      const teks = [...g.steps, ...g.notes, ...g.troubleshooting].join(" ");
      expect(teks, g.id).not.toMatch(/\bSSH\b|\bdocker\b|\bpatch manual\b/i);
    }
  });
});

describe("tutorial per fitur rilis 1.188 sampai 1.205.5", () => {
  const BARU: Array<[string, GolonganPeran[], GolonganPeran[]]> = [
    // id, golongan yang melihat, golongan yang tidak melihat
    ["mulai-tampilan-layar", ["hakim", "kasir", "jurusita", "ptsp"], []],
    ["jadwal-sidang-penanda-kehadiran", ["hakim", "pp", "panitera"], ["kasir"]],
    ["jadwal-sidang-belum-upload", ["panitera", "pp", "hakim"], ["jurusita", "ptsp", "kasir"]],
    ["penetapan-pmh-ppp-pjs-phs", ["pimpinan", "admin", "super-admin"], ["hakim", "kasir", "jurusita", "pp"]],
    ["blangko-derry-jendela-pilih-isian", ["hakim", "pp", "jurusita"], ["kasir", "ptsp"]],
    ["ekstensi-masuk-otomatis-sipp", ["hakim", "kasir", "jurusita", "ptsp"], []],
    ["ekstensi-sipp-penanda-usulan", ["hakim", "kasir", "jurusita", "ptsp"], []],
    ["ekstensi-sipp-putusan-akhir-kotak-penyatu", ["hakim", "jurusita", "pp"], ["kasir", "ptsp"]],
    ["ekstensi-susun-keterangan-saksi", ["pp", "panitera", "panmud"], ["hakim", "jurusita", "kasir"]],
    ["ekstensi-kartu-bacaan-abt", ["hakim", "pimpinan", "pp"], ["jurusita", "kasir"]],
    ["ekstensi-jurusita-relaas", ["jurusita"], ["hakim", "pp", "kasir"]],
    ["ekstensi-blangko-pihak-sipp", ["ptsp", "pp"], ["hakim", "jurusita", "kasir"]],
    ["pengelola-sesi-ecourt-whatsapp", ["admin", "super-admin"], ["hakim", "pp", "kasir"]],
    ["pengelola-lihat-sebagai", ["super-admin"], ["hakim", "pp", "kasir"]],
  ];

  it("setiap tutorial baru ada dan hanya terlihat oleh peran yang memakainya", () => {
    for (const [id, ya, tidak] of BARU) {
      const t = tutorial(id);
      for (const g of ya) expect(lihat(t, g), `${id} seharusnya terlihat oleh ${g}`).toBe(true);
      for (const g of tidak) expect(lihat(t, g), `${id} tidak boleh terlihat oleh ${g}`).toBe(false);
    }
  });

  it("tutorial baru ditautkan ke versi yang benar dan dapat dicari lewat katanya", () => {
    // Tanda 'Baru' hanya boleh menunjuk versi yang ada di catatan.
    for (const [id] of BARU) {
      const t = tutorial(id);
      if (t.baruDi) {
        const daftar = t.baruDi.sumber === "portal" ? [] : CATATAN_EKSTENSI.map((n) => n.versi);
        expect(daftar, `${id}: versi ${t.baruDi.versi} tidak ada di catatan`).toContain(t.baruDi.versi);
      }
    }
  });

  it("setiap golongan peran punya sedikitnya satu tutorial ekstensi atau persidangan yang relevan", () => {
    const tanpa: string[] = [];
    for (const g of GOLONGAN_PERAN) {
      const ada = TUTORIAL.some((t) => (t.kelompok === "ekstensi" || t.kelompok === "persidangan") && lihat(t, g));
      if (!ada) tanpa.push(g);
    }
    // Golongan yang memang tidak memakai ekstensi atau e-Court (staf umum, TI, pelaksana, sekretariat) boleh kosong.
    const BOLEH_KOSONG: GolonganPeran[] = ["sekretariat", "ti", "pelaksana"];
    expect(tanpa.filter((g) => !BOLEH_KOSONG.includes(g as GolonganPeran))).toEqual([]);
  });

  it("fitur penting tiap rilis disebut di tutorial atau ringkasan peran (panduan tidak tertinggal)", () => {
    const jerami = [
      ...TUTORIAL.flatMap(teksTutorial),
      ...PANDUAN_FITUR_PERAN.flatMap((g) => [g.title, g.summary, ...g.steps, ...g.notes, ...g.troubleshooting]),
    ]
      .join("\n")
      .toLowerCase();
    // [versi pertama yang membawa fitur, kata yang harus muncul]
    const WAJIB: Array<[string, string]> = [
      ["1.188.0", "belum upload"],
      ["1.188.0", "buat hasil mediasi"],
      ["1.188.0", "pmh"],
      ["1.189.0", "kuasa"],
      ["1.190.0", "kasir harian"],
      ["1.191.0", "input semua yang pasti"],
      ["1.192.0", "kamus deteksi"],
      ["1.192.0", "set pertanyaan"],
      ["1.193.0", "masuk otomatis"],
      ["1.193.0", "per kejadian"],
      ["1.194.0", "pekerjaan terbaca"],
      ["1.195.0", "zip"],
      ["1.195.0", "profil saklar"],
      ["1.196.0", "alur sidang"],
      ["1.197.0", "panggil"],
      ["1.197.0", "dari petitum"],
      ["1.198.0", "cpu"],
      ["1.199.0", "gembok"],
      ["1.199.0", "kasir otomatis"],
      ["1.200.0", "pengumuman permohonan itsbat"],
      ["1.200.1", "ganti e-doc bas"],
      ["1.200.2", "jenis - bas"],
      ["1.201.0", "tulis manual"],
      ["1.202.0", "identitas satker"],
      ["1.203.0", "buka di abt"],
      ["1.203.0", "lihat sebagai"],
      ["1.204.0", "anonim"],
      ["1.204.0", "skors"],
      ["1.204.1", "kotak penyatu"],
      ["1.205.0", "draf"],
      ["1.205.1", "sisa blangko"],
      ["1.205.1", "skp"],
      ["1.205.2", "captcha"],
      ["1.205.2", "ecourt status"],
      ["1.205.3", "fitur satker"],
      ["1.205.3", "blangko saya"],
      ["1.205.3", "kembaran"],
      ["1.205.4", "tunda"],
      ["1.205.5", "penetapan ikrar"],
      ["1.205.5", "penguasaan anak"],
      ["1.205.6", "susun saksi"],
      ["1.205.6", "900 piksel"],
      ["1.205.7", "jawab-menjawab"],
      ["1.205.7", "keterangan anak, calon, dan orang tua"],
    ];
    const hilang = WAJIB.filter(([, kata]) => !jerami.includes(kata)).map(([v, k]) => `${v}: ${k}`);
    expect(hilang, `Fitur rilis ini belum disebut di panduan: ${hilang.join("; ")}`).toEqual([]);
    for (const [versi] of WAJIB) {
      expect(CATATAN_EKSTENSI.some((n) => n.versi === versi), `versi ${versi} tidak ada di catatan ekstensi`).toBe(true);
    }
  });
});

describe("tutorial yang menunggu ekstensi 1.205.6", () => {
  it("bentuknya sama dengan tutorial lain: id unik, tanpa kunci matriks, bahasa sederhana", () => {
    const idAktif = new Set(TUTORIAL.map((t) => t.id));
    for (const t of TUTORIAL_MENUNGGU_1206) {
      if (!TUTORIAL_1206_AKTIF) expect(idAktif.has(t.id), `${t.id} tampil sebelum waktunya`).toBe(false);
      expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.untuk, `${t.id}: wajib memakai 'untuk' agar tidak bergantung pada menu yang belum ada`).toBeTruthy();
      expect((t.mencakup.aplikasi?.length ?? 0) + (t.mencakup.modul?.length ?? 0) + (t.mencakup.tab?.length ?? 0) + (t.mencakup.aksi?.length ?? 0)).toBe(0);
      expect(t.langkah.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.halaman.length, t.id).toBeGreaterThan(0);
      expect(t.baruDi, t.id).toEqual({ sumber: "ekstensi", versi: VERSI_TUTORIAL_MENUNGGU });
      for (const l of t.langkah) {
        expect(l.length, `${t.id}: langkah terlalu panjang`).toBeLessThanOrEqual(400);
        expect(l.trim(), `${t.id}: "${l.slice(0, 40)}" tanpa tanda baca penutup`).toMatch(/[.!?)]$/);
      }
      for (const teks of teksTutorial(t)) {
        for (const [pola, alasan] of DILARANG) expect(pola.test(teks), `${t.id}: "${teks.slice(0, 60)}" (${alasan})`).toBe(false);
      }
    }
  });

  it("memuat inti kedua fitur: 22 kumpulan jenis perkara, jenis keterangan, tanda kuning, layar 900 piksel, 36 persen, zoom", () => {
    const saksi = TUTORIAL_MENUNGGU_1206.find((t) => t.id === "ekstensi-susun-saksi-keadaan-perkara");
    const v2 = TUTORIAL_MENUNGGU_1206.find((t) => t.id === "ekstensi-tampilan-panel-v2");
    expect(saksi).toBeTruthy();
    expect(v2).toBeTruthy();
    const a = saksi ? teksTutorial(saksi).join(" ").toLowerCase() : "";
    // kata-kata ini = nama pilihan di layar (saksi-susun.js, LABEL_JENIS_KETERANGAN dan tombolnya), dicocokkan 18 Okt 2026
    for (const kata of ["22", "susun saksi menurut keadaan perkara", "melihat sendiri", "mendengar sendiri", "cerita orang lain", "de auditu", "sebagian", "tidak tahu", "ragu", "berbeda", "kuning", "diajukan oleh", "bantahan tergugat", "keterangan anak, calon, dan orang tua", "menurut posita", "simpan ke abt", "terverifikasi", "penguasaan anak", "dispensasi kawin", "ekonomi syariah"]) {
      expect(a, `Susun saksi: ${kata}`).toContain(kata);
    }
    const b = v2 ? teksTutorial(v2).join(" ").toLowerCase() : "";
    for (const kata of ["900", "36", "4k", "125", "150", "tv"]) {
      expect(b, `Tampilan V2: ${kata}`).toContain(kata);
    }
  });

  it("diaktifkan tepat ketika catatan 1.205.6 ada (tidak mungkin terlupa, tidak tampil terlalu dini)", () => {
    const versiAda = CATATAN_EKSTENSI.some((n) => n.versi === VERSI_TUTORIAL_MENUNGGU);
    expect(
      TUTORIAL_1206_AKTIF,
      versiAda
        ? `Catatan ekstensi ${VERSI_TUTORIAL_MENUNGGU} sudah ada: ubah TUTORIAL_1206_AKTIF menjadi true di tutorial-isi-menunggu-1206.ts setelah langkahnya dicocokkan dengan tampilan sungguhan.`
        : `Catatan ekstensi ${VERSI_TUTORIAL_MENUNGGU} belum ada: TUTORIAL_1206_AKTIF harus tetap false supaya pegawai tidak dijanjikan fitur yang belum terpasang.`
    ).toBe(versiAda);
  });

  it("saat aktif, kedua tutorial ikut daftar utama", () => {
    if (!TUTORIAL_1206_AKTIF) return;
    for (const t of TUTORIAL_MENUNGGU_1206) expect(TUTORIAL.some((x) => x.id === t.id), t.id).toBe(true);
  });
});
