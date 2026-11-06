// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { bacaRtfParagraf, perbaikiRtf, periksaRtf, periksaTeks, type PilihanPerbaikan, type Temuan } from "@/lib/deteksi-sisa-blangko";
import { tampilkanDialogSisa } from "@/lib/dialog-sisa-blangko";

const EKS = path.resolve(__dirname, "../../../ekstensi-sipp");

type ApiEks = {
  periksaRtf: (r: string, o?: unknown) => { temuan: Temuan[] };
  periksaTeks: (r: string, o?: unknown) => { temuan: Temuan[] };
  perbaikiRtf: (r: string, p: PilihanPerbaikan[], o?: unknown) => { rtf: string; jumlah: number; terlewat: number };
  bacaRtfParagraf: (r: string) => Array<{ teks: string }>;
  tampilkanDialog: (t: Temuan[], o: unknown) => Promise<unknown>;
};

let eks: ApiEks;
beforeAll(() => {
  const w = window as unknown as Record<string, unknown>;
  const sumber = readFileSync(path.join(EKS, "deteksi-sisa-blangko.js"), "utf8");
  // Kait halaman SIPP tidak dipasang: alamat jsdom bukan halaman SIPP yang diuji di sini.
  vm.runInThisContext(`(function(globalThis){${sumber}\n})`)(w);
  eks = w.aletaDeteksiSisa as ApiEks;
});

const rtf = (isi: string) => `{\\rtf1\\ansi\\ansicpg1252{\\colortbl;\\red0\\green0\\blue0;\\red255\\green0\\blue0;}\\pard ${isi}\\par}`;

/** Memilih semua temuan dengan cara bawaannya, seperti petugas mencentang semua. */
function semua(temuan: Temuan[], cara?: Partial<Record<string, PilihanPerbaikan["cara"]>>, ganti?: string): PilihanPerbaikan[] {
  return temuan.map((t) => ({
    paragraf: t.paragraf,
    dari: t.dari as number,
    sampai: t.sampai as number,
    jenis: t.jenis,
    cara: t.rapi !== undefined ? "rapi" : ganti ? "ganti" : cara?.[t.jenis] ?? "hapus",
    ...(t.rapi !== undefined ? { ganti: t.rapi } : ganti ? { ganti } : {}),
  }));
}

const teksHasil = (r: string) =>
  bacaRtfParagraf(r)
    .map((p) => p.teks)
    .join("\n");

describe("Desa Ganti adalah nama tempat, bukan temuan", () => {
  const bukanTemuan = [
    "Pemohon bertempat tinggal di Desa Ganti, Kecamatan Banawa, Kabupaten Donggala.",
    "bertempat kediaman di DESA GANTI KECAMATAN BANAWA",
    "tinggal di Kelurahan Ganti , Kecamatan Banawa , Kabupaten Donggala",
    "tinggal di Desa Ganti ganti Kecamatan Banawa",
    "tinggal di Kel. Ganti , Kecamatan Banawa",
    "tinggal di Ds. Ganti  kecamatan Banawa",
    "beralamat di Ganti, Banawa, Kabupaten Donggala",
  ];
  for (const k of bukanTemuan) {
    it(`bukan temuan: ${k}`, () => {
      const dekat = (t: Temuan) => t.jenis !== "ragu" || /ganti/i.test(`${t.sebelum.slice(-16)}${t.cocok}`);
      expect(periksaTeks(k, { jenis: "putusan" }).temuan.filter(dekat)).toEqual([]);
      expect(eks.periksaTeks(k, { jenis: "putusan" }).temuan.filter(dekat)).toEqual([]);
    });
  }

  it("tulisan merah yang hanya nama tempat itu bukan temuan, sedangkan merah lain tetap temuan", () => {
    const naskah = rtf("Tinggal di \\cf2 Desa Ganti\\cf0  dan \\cf2 Saksi kenal dengan\\cf0  Pemohon");
    for (const h of [periksaRtf(naskah), eks.periksaRtf(naskah)]) {
      expect(h.temuan.filter((t) => t.jenis === "merah").map((t) => t.cocok)).toEqual(["Saksi kenal dengan"]);
    }
  });

  it("kata lain tetap terdeteksi di paragraf yang sama: pengecualian tidak melebar", () => {
    const k = "Pemohon tinggal di Desa Ganti, para para pihak hadir [NAMA SAKSI] pada tanggal ......";
    for (const h of [periksaTeks(k), eks.periksaTeks(k)]) {
      expect(h.temuan.map((t) => t.jenis).sort()).toEqual(["kurung", "titik", "ulang"]);
    }
  });

  it("kata 'ganti' di luar nama tempat tidak dikecualikan oleh tanda lain", () => {
    const k = "ganti rugi ganti rugi sejumlah [BELUM DIISI]";
    expect(periksaTeks(k).temuan.map((t) => t.jenis)).toEqual(["kurung"]);
    expect(eks.periksaTeks(k).temuan.map((t) => t.jenis)).toEqual(["kurung"]);
  });
});

describe("perbaikan yang dicentang", () => {
  const naskahUji = rtf(
    "Bahwa para Para pihak hadir [NAMA SAKSI] dan #1234# tinggal di Banawa , Donggala pada tanggal ...... serta perlu diverifikasi kembali.\\par Alinea kedua tetap \\'e9 utuh {\\b tebal} sampai akhir."
  );

  it("yang tidak dicentang tidak berubah sama sekali; yang dicentang saja yang berubah", () => {
    const h = periksaRtf(naskahUji);
    const ulang = h.temuan.filter((t) => t.jenis === "ulang");
    expect(ulang).toHaveLength(1);
    const f = perbaikiRtf(naskahUji, semua(ulang));
    expect(f.jumlah).toBe(1);
    expect(f.terlewat).toBe(0);
    const t = teksHasil(f.rtf);
    expect(t).toContain("Bahwa para pihak hadir [NAMA SAKSI] dan #1234#");
    expect(t).toContain("pada tanggal ......");
    // Alinea lain dan perintah RTF-nya utuh.
    expect(f.rtf).toContain("Alinea kedua tetap \\'e9 utuh {\\b tebal} sampai akhir.");
    expect(periksaRtf(f.rtf).temuan.length).toBe(h.temuan.length - 1);
  });

  it("menghapus tidak meninggalkan spasi ganda atau spasi di depan tanda baca", () => {
    const n = rtf("Hadir [NAMA SAKSI] dan pulang [X], lalu selesai.");
    const f = perbaikiRtf(n, semua(periksaRtf(n).temuan));
    expect(teksHasil(f.rtf)).toBe("Hadir dan pulang, lalu selesai.");
  });

  it("ketikan petugas mengganti temuan; huruf khusus dan kurung tertulis aman", () => {
    const n = rtf("Saksi bernama [NAMA SAKSI] hadir.");
    const f = perbaikiRtf(n, semua(periksaRtf(n).temuan, undefined, "Andi {Ré} \\ – x"));
    expect(teksHasil(f.rtf)).toBe("Saksi bernama Andi {Ré} \\ – x hadir.");
    expect(f.rtf).toContain("Andi \\{R\\'e9\\} \\\\ \\u8211? x");
  });

  it("merah: Hitamkan mempertahankan tulisan dan warnanya hilang; Hapus membuang tulisannya", () => {
    const n = rtf("Awal \\cf2 Saksi kenal dengan\\cf0  Pemohon.");
    const pilih = semua(periksaRtf(n).temuan, { merah: "hitam" });
    const f = perbaikiRtf(n, pilih);
    expect(teksHasil(f.rtf)).toBe("Awal Saksi kenal dengan Pemohon.");
    expect(periksaRtf(f.rtf).temuan).toEqual([]);
    const g = perbaikiRtf(n, semua(periksaRtf(n).temuan, { merah: "hapus" }));
    expect(teksHasil(g.rtf)).toBe("Awal Pemohon.");
  });

  it("temuan melewati perintah RTF: perintah tetap, huruf sesudahnya tidak menempel", () => {
    const n = rtf("Hadir [NAMA\\b SAKSI\\b0 ] pulang\\b \\u8211?\\b0 selesai.");
    const f = perbaikiRtf(n, semua(periksaRtf(n).temuan));
    expect(teksHasil(f.rtf)).toBe("Hadir pulang–selesai.");
    expect(f.rtf).toContain("\\b0");
    // Huruf \uN beserta huruf cadangannya.
    const m = rtf("Mulai [A\\u8211?B] akhir");
    const h = perbaikiRtf(m, semua(periksaRtf(m).temuan));
    expect(teksHasil(h.rtf)).toBe("Mulai akhir");
    expect(h.rtf).not.toContain("?");
  });

  it("temuan yang sudah tidak cocok dengan naskah dilewati dan dihitung, naskah tidak berubah", () => {
    const n = rtf("Hadir [NAMA SAKSI] pulang.");
    const f = perbaikiRtf(n, [{ paragraf: 1, dari: 0, sampai: 5, jenis: "kurung", cara: "hapus" }]);
    expect(f.jumlah).toBe(0);
    expect(f.terlewat).toBe(1);
    expect(f.rtf).toBe(n);
  });

  it("portal dan ekstensi: temuan dan hasil perbaikan sama persis", () => {
    for (const n of [naskahUji, rtf("A , B ,, C ( ) D bin  E"), rtf("Awal \\cf2 Merah sekali\\cf0  akhir [X]")]) {
      const a = periksaRtf(n).temuan;
      expect(eks.periksaRtf(n).temuan).toEqual(a);
      const pilih = semua(a, { merah: "hitam" });
      const hasilPortal = perbaikiRtf(n, pilih);
      const hasilEks = eks.perbaikiRtf(n, pilih);
      expect(hasilEks.rtf).toBe(hasilPortal.rtf);
      expect(hasilEks.jumlah).toBe(hasilPortal.jumlah);
      expect(hasilEks.terlewat).toBe(hasilPortal.terlewat);
    }
  });

  it("bunyi rapi: kata berulang, spasi depan koma, koma ganda, kurung kosong, spasi ganda", () => {
    const n = rtf("Kata pada pada itu, di Banawa , lalu,, kemudian ( ) dan binti  Ani");
    const f = perbaikiRtf(n, semua(periksaRtf(n).temuan));
    expect(teksHasil(f.rtf)).toBe("Kata pada itu, di Banawa, lalu, kemudian dan binti Ani");
  });
});

describe("dialog bercentang, seperti dipakai petugas", () => {
  const temuanDari = (n: string) => periksaRtf(n).temuan;
  const klik = (b: Element | null | undefined) => (b as HTMLElement).click();
  const tombolBerbunyi = (awal: string) =>
    Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").startsWith(awal));

  const uji: Array<[string, (t: Temuan[], o: { bisaPerbaiki?: boolean; aksi: "unduh" }) => Promise<unknown>]> = [
    ["portal", (t, o) => tampilkanDialogSisa(t, o)],
    ["ekstensi", (t, o) => eks.tampilkanDialog(t, o)],
  ];

  for (const [nama, buka] of uji) {
    it(`${nama}: hanya yang dicentang yang dikirim, ketikan ikut, tombol mati tanpa centang`, async () => {
      const n = rtf("Hadir [NAMA SAKSI] dan pada pada [X] pulang.");
      const janji = buka(temuanDari(n), { bisaPerbaiki: true, aksi: "unduh" });
      const utama = tombolBerbunyi("Perbaiki") as HTMLButtonElement;
      expect(utama.disabled).toBe(true);
      const kotak = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-sisa-centang]"));
      expect(kotak).toHaveLength(3);
      expect(kotak.every((c) => !c.checked)).toBe(true);
      klik(kotak[0]);
      expect(utama.disabled).toBe(false);
      expect(utama.textContent).toContain("1");
      const ketik = document.querySelector<HTMLInputElement>("input[data-sisa-ketik]") as HTMLInputElement;
      ketik.value = "Andi";
      klik(utama);
      const h = (await janji) as { cara: string; daftar: PilihanPerbaikan[] };
      expect(h.cara).toBe("perbaiki");
      expect(h.daftar).toHaveLength(1);
      expect(h.daftar[0]).toMatchObject({ jenis: "kurung", cara: "ganti", ganti: "Andi" });
      expect(teksHasil(perbaikiRtf(n, h.daftar).rtf)).toBe("Hadir Andi dan pada pada [X] pulang.");
      expect(document.querySelector("[role=dialog]")).toBeNull();
    });

    it(`${nama}: tombol lama tetap ada dan dialog tanpa bisaPerbaiki tidak berubah`, async () => {
      const n = rtf("Hadir [NAMA SAKSI] pulang.");
      const janji = buka(temuanDari(n), { aksi: "unduh" });
      expect(document.querySelector("input[data-sisa-centang]")).toBeNull();
      expect(tombolBerbunyi("Perbaiki")).toBeUndefined();
      expect(tombolBerbunyi("Unduh daftar masalah")).toBeTruthy();
      klik(tombolBerbunyi("Lanjut saja"));
      await expect(janji).resolves.toBe("lanjut");

      const janji2 = buka(temuanDari(n), { bisaPerbaiki: true, aksi: "unduh" });
      expect(tombolBerbunyi("Unduh daftar masalah")).toBeTruthy();
      klik(tombolBerbunyi("Batal"));
      await expect(janji2).resolves.toBe("batal");
    });

    it(`${nama}: centang semua menampilkan semua temuan, bukan hanya 12`, async () => {
      const n = rtf(Array.from({ length: 20 }, (_, i) => `Baris ${i} [X${i}]`).join("\\par "));
      const janji = buka(temuanDari(n), { bisaPerbaiki: true, aksi: "unduh" });
      const kotak = document.querySelectorAll<HTMLInputElement>("input[data-sisa-centang]");
      expect(kotak).toHaveLength(20);
      klik(document.querySelector("input[data-sisa-semua]"));
      expect(Array.from(kotak).every((c) => c.checked)).toBe(true);
      klik(tombolBerbunyi("Perbaiki"));
      const h = (await janji) as { daftar: PilihanPerbaikan[] };
      expect(h.daftar).toHaveLength(20);
    });
  }
});

describe("kotak selesai punya tombol keluar di ujung kanan", () => {
  const sumber = readFileSync(path.join(EKS, "muat-ulang-sipp.js"), "utf8");
  const css = readFileSync(path.join(EKS, "penetapan-sipp.css"), "utf8");
  let mu: {
    konf: { jeda: number };
    jadwalkan: (p: unknown) => { otomatis: boolean };
    batal: () => boolean;
  };
  beforeAll(() => {
    const w = window as unknown as Record<string, unknown>;
    w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined } } };
    w.aletaUjiPindah = vi.fn();
    vm.runInThisContext(`(function(globalThis,chrome){${sumber}\n})`)(w, w.chrome);
    mu = w.aletaMuatUlangSipp as typeof mu;
    mu.konf.jeda = 60_000;
  });

  it("gaya: tombol di kanan atas kotak", () => {
    expect(css).toMatch(/\.aleta-mu-keluar \{[^}]*position: absolute;[^}]*top: 6px;[^}]*right: 6px;/);
    expect(css).toMatch(/\.aleta-mu \{[^}]*position: relative;/);
    // Kotak melayang tetap melayang: gayanya datang sesudah .aleta-mu.
    expect(css.indexOf(".aleta-mu-melayang {")).toBeGreaterThan(css.indexOf(".aleta-mu {"));
  });

  it("menutup kotak dan membatalkan hitung mundur", () => {
    const h = mu.jadwalkan({ nomor: "1/Pdt.G/2026/PA.Dgl", ringkasan: { judul: "Selesai.", baris: [], adaGagal: false } });
    expect(h.otomatis).toBe(true);
    const kotak = document.querySelector(".aleta-mu-melayang") as HTMLElement;
    const keluar = kotak.querySelector("[data-mu=keluar]") as HTMLButtonElement;
    expect(keluar.getAttribute("aria-label")).toBe("Tutup");
    keluar.click();
    expect(document.querySelector(".aleta-mu-melayang")).toBeNull();
    expect(mu.batal()).toBe(false);
  });

  it("ada juga saat ada yang gagal", () => {
    mu.jadwalkan({ nomor: "2/Pdt.G/2026/PA.Dgl", ringkasan: { judul: "Belum.", baris: [], adaGagal: true } });
    const keluar = document.querySelector(".aleta-mu-melayang [data-mu=keluar]") as HTMLButtonElement;
    expect(keluar).toBeTruthy();
    keluar.click();
    expect(document.querySelector(".aleta-mu-melayang")).toBeNull();
  });
});
