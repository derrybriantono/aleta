import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  KUNCI_SIMPANAN_TAMPILAN,
  SAKLAR_TAMPILAN,
  SAKLAR_WAJIB,
  bacaTampilan,
  jumlahDimatikan,
  kelompokTampilan,
  tampil,
  tampilanBawaan,
} from "@/lib/tampilan-antrian-sidang";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

describe("saklar tampilan", () => {
  it("bawaannya menyala SEMUA", () => {
    // Layar ini sudah berjalan sebelum saklarnya ada. Bawaan yang mematikan
    // sesuatu menghilangkan penanda dari layar orang yang tidak pernah
    // meminta apa pun - perubahan yang tidak diminta dan tidak diumumkan.
    const bawaan = tampilanBawaan();
    for (const saklar of SAKLAR_TAMPILAN) {
      expect(bawaan[saklar.kunci]).toBe(true);
    }
  });

  it("kuncinya tidak ada yang kembar", () => {
    // Kunci kembar membuat dua saklar berbeda menulis ke ruas simpanan yang
    // sama, dan yang kedua diam-diam mengendalikan keduanya.
    const kunci = SAKLAR_TAMPILAN.map((x) => x.kunci);
    expect(new Set(kunci).size).toBe(kunci.length);
  });

  it("tiap saklar punya keterangan yang sungguh menerangkan", () => {
    for (const saklar of SAKLAR_TAMPILAN) {
      expect(saklar.label.length).toBeGreaterThan(2);
      expect(saklar.keterangan.length).toBeGreaterThan(20);
    }
  });

  it("tiap saklar duduk di kelompok yang sungguh ada", () => {
    const kelompok = kelompokTampilan();
    const jumlah = kelompok.reduce((n, k) => n + k.anggota.length, 0);
    expect(jumlah).toBe(SAKLAR_TAMPILAN.length);
    for (const k of kelompok) expect(k.anggota.length).toBeGreaterThan(0);
  });
});

describe("yang mendesak tidak dapat dimatikan", () => {
  // Keempat ini disebut pengguna satu per satu. Penjaga ini ada supaya
  // keempatnya tidak berpindah ke daftar yang dapat dimatikan pada suatu
  // perapian di kemudian hari - dan hilangnya tidak akan berbunyi apa pun
  // sampai satu sidang batal atau satu berkas tidak pernah dijahit.
  const WAJIB = ["retur", "belum-dipanggil", "belum-minutasi", "belum-unggah-putusan"];

  it("keempatnya bertanda wajib", () => {
    for (const kunci of WAJIB) {
      const saklar = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci);
      expect(saklar, `saklar ${kunci} hilang dari daftar`).toBeDefined();
      expect(saklar?.wajib, `saklar ${kunci} tidak lagi wajib`).toBe(true);
    }
    expect([...SAKLAR_WAJIB].sort()).toEqual([...WAJIB].sort());
  });

  it("tampil() menyalakannya walau simpanannya berkata false", () => {
    // Simpanan peramban dapat disunting lewat DevTools. Sebuah nilai false di
    // sana tidak boleh cukup untuk memadamkan penanda retur.
    const jahat = Object.fromEntries(WAJIB.map((k) => [k, false]));
    for (const kunci of WAJIB) {
      expect(tampil(jahat, kunci)).toBe(true);
    }
  });

  it("bacaTampilan menolak mematikannya dari simpanan", () => {
    const hasil = bacaTampilan(JSON.stringify({ retur: false, "belum-minutasi": false }));
    expect(hasil.retur).toBe(true);
    expect(hasil["belum-minutasi"]).toBe(true);
  });

  it("tidak ikut terhitung pada angka 'berapa yang dimatikan'", () => {
    const jahat = Object.fromEntries(SAKLAR_TAMPILAN.map((x) => [x.kunci, false]));
    // Yang wajib tidak pernah benar-benar mati, jadi menghitungnya akan
    // memajang angka yang tidak sesuai dengan apa yang hilang dari layar.
    expect(jumlahDimatikan(jahat)).toBe(SAKLAR_TAMPILAN.length - SAKLAR_WAJIB.length);
  });

  it("saklarnya TETAP digambar - tidak dibuang dari daftar", () => {
    // Menghilangkannya membuat orang mengira penandanya sudah tidak ada lagi,
    // lalu mencarinya di tempat yang salah.
    const semua = kelompokTampilan().flatMap((k) => k.anggota.map((x) => x.kunci));
    for (const kunci of WAJIB) expect(semua).toContain(kunci);
  });
});

describe("tampil()", () => {
  it("tanpa pilihan sama sekali - semuanya menyala", () => {
    expect(tampil(undefined, "saksi")).toBe(true);
  });

  it("saklar yang BARU ditambahkan menyala walau simpanannya lama", () => {
    // Simpanan yang ditulis versi sebelumnya tidak memuat kunci baru. Yang
    // tidak terbaca harus menyala; kalau tidak, tiap penanda baru lahir dalam
    // keadaan padam bagi seluruh pemakai lama.
    expect(tampil({ saksi: false }, "kuasa")).toBe(true);
  });

  it("yang dimatikan sungguh mati", () => {
    expect(tampil({ saksi: false }, "saksi")).toBe(false);
  });
});

describe("bacaTampilan", () => {
  it("simpanan kosong memakai bawaan", () => {
    expect(bacaTampilan(null)).toEqual(tampilanBawaan());
  });

  it("JSON rusak tidak melempar - memakai bawaan", () => {
    // Simpanan yang rusak tidak boleh membuat layarnya gagal digambar sama
    // sekali. Yang hilang cukup pilihannya.
    expect(bacaTampilan("{bukan json")).toEqual(tampilanBawaan());
    expect(bacaTampilan("[1,2,3]")).toEqual(tampilanBawaan());
    expect(bacaTampilan("null")).toEqual(tampilanBawaan());
  });

  it("ruas asing dibuang, bukan dipercaya", () => {
    const hasil = bacaTampilan(JSON.stringify({ saksi: false, "entah-apa": false }));
    expect(hasil.saksi).toBe(false);
    expect(hasil["entah-apa"]).toBeUndefined();
  });

  it("nilai yang bukan boolean diabaikan", () => {
    const hasil = bacaTampilan(JSON.stringify({ saksi: "tidak", kuasa: 0 }));
    expect(hasil.saksi).toBe(true);
    expect(hasil.kuasa).toBe(true);
  });
});

describe("layarnya sungguh memakai saklarnya", () => {
  const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

  it("tiap saklar yang dapat dimatikan sungguh dipakai menggambar", () => {
    // Penjaga terpenting berkas ini. Saklar yang ada di daftar tetapi tidak
    // pernah dipanggil akan tergambar di panel, dapat ditekan, tersimpan - dan
    // tidak mengubah apa pun. Itu lebih buruk daripada tidak ada saklarnya:
    // orangnya menyangka sudah mematikan sesuatu.
    for (const saklar of SAKLAR_TAMPILAN) {
      if (saklar.wajib) continue;
      expect(
        layar.includes(`tampil(tampilan, "${saklar.kunci}")`),
        `saklar ${saklar.kunci} tidak dipakai di layar`
      ).toBe(true);
    }
  });

  it("yang WAJIB tidak pernah dipakai menggambar", () => {
    // Kebalikannya, dan sama pentingnya: memanggil tampil() untuk yang wajib
    // berarti seseorang menyiapkan jalan untuk mematikannya.
    for (const kunci of SAKLAR_WAJIB) {
      expect(
        layar.includes(`tampil(tampilan, "${kunci}")`),
        `saklar wajib ${kunci} dipakai menggambar - ia tidak boleh dapat dimatikan`
      ).toBe(false);
    }
  });

  it("kunci simpanannya dipakai apa adanya, bukan diketik ulang", () => {
    expect(layar).toContain("KUNCI_SIMPANAN_TAMPILAN");
    expect(layar).not.toContain(`"${KUNCI_SIMPANAN_TAMPILAN}"`);
  });

  it("panelnya punya jalan kembali ke keadaan semula", () => {
    // Tanpa ini, orang yang mematikan sepuluh saklar harus mengingat yang mana
    // saja untuk mengembalikannya.
    expect(layar).toContain("setelUlangTampilan");
    expect(layar).toContain("Nyalakan semua");
  });
});
