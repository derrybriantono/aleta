import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  daftarLembar,
  muatLembar,
  penandaDariLembar,
  semuaLembar,
  simpanLembar,
  tanyaJawabKeTeks,
  type Lembar,
} from "@/server/modules/aleta-ecourt/bas-lembar";

/**
 * Penyimpanan lembar BAS.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Lembar BAS diisi SEMENTARA SIDANG BERJALAN, jadi ia disimpan berkali-kali
 * dalam keadaan setengah jadi. Yang paling berbahaya bukan kegagalan menyimpan
 * - itu terlihat - melainkan penyimpanan yang berhasil sambil diam-diam
 * menghapus bagian yang sudah diisi sebelumnya. Keterangan saksi yang hilang
 * tidak dapat diulang; saksinya sudah pulang.
 *
 * Karena itu yang diuji paling keras: menyimpan sebagian TIDAK menghapus
 * sisanya, dan pertanyaannya ikut tersimpan sehingga naskah yang sudah
 * ditandatangani tidak bergeser bila katalog ABT kelak berubah.
 */

let db: AletaDatabase | null = null;

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  return db;
}

const PERKARA = "10102";

function isian(baris: Array<{ urutan: number; pertanyaan?: string; jawaban?: string }>) {
  return {
    perkaraId: PERKARA,
    nomorPerkara: "551/Pdt.G/2026/PA.Dgl",
    kode: "A1a",
    namaKumpulan: "Pertanyaan Saksi P CG",
    saksiKe: 1,
    baris,
  };
}

afterEach(async () => {
  await db?.close();
  db = null;
});

describe("menyimpan lembar", () => {
  it("lembar baru tersimpan beserta jawabannya", async () => {
    const database = await basisData();
    await simpanLembar(database, "uji-panitera", {
      ...isian([
        { urutan: 1, pertanyaan: "Apakah saudara kenal dengan Reka?", jawaban: "Saya kenal, saya kakaknya;" },
        { urutan: 2, pertanyaan: "Apakah saudara kenal dengan Ahmad?", jawaban: "Saya kenal, suaminya;" },
      ]),
      saksi: { nama: "Sitti Aminah", umur: "42", agama: "Islam" },
    });

    const lembar = await muatLembar(database, { perkaraId: PERKARA, kode: "A1a", saksiKe: 1 });
    expect(lembar?.saksi.nama).toBe("Sitti Aminah");
    expect(lembar?.saksi.umur).toBe("42");
    expect(lembar?.baris).toHaveLength(2);
    expect(lembar?.baris[0].jawaban).toBe("Saya kenal, saya kakaknya;");
  });

  it("menyimpan sebagian TIDAK menghapus jawaban yang sudah ada", async () => {
    const database = await basisData();
    await simpanLembar(
      database,
      "uji-panitera",
      isian([
        { urutan: 1, pertanyaan: "Pertanyaan satu", jawaban: "Jawaban satu" },
        { urutan: 2, pertanyaan: "Pertanyaan dua", jawaban: "Jawaban dua" },
        { urutan: 3, pertanyaan: "Pertanyaan tiga", jawaban: "Jawaban tiga" },
      ])
    );

    // Sidang berlanjut, hanya baris kedua yang berubah. Baris satu dan tiga
    // tidak ikut dikirim - dan tidak boleh lenyap karenanya.
    await simpanLembar(database, "uji-panitera", isian([{ urutan: 2, pertanyaan: "Pertanyaan dua", jawaban: "Jawaban dua diperbaiki" }]));

    const lembar = await muatLembar(database, { perkaraId: PERKARA, kode: "A1a", saksiKe: 1 });
    expect(lembar?.baris).toHaveLength(3);
    expect(lembar?.baris.find((b) => b.urutan === 1)?.jawaban).toBe("Jawaban satu");
    expect(lembar?.baris.find((b) => b.urutan === 2)?.jawaban).toBe("Jawaban dua diperbaiki");
    expect(lembar?.baris.find((b) => b.urutan === 3)?.jawaban).toBe("Jawaban tiga");
  });

  it("menyimpan dua kali tidak menggandakan lembarnya", async () => {
    const database = await basisData();
    await simpanLembar(database, "uji-panitera", isian([{ urutan: 1, jawaban: "a" }]));
    await simpanLembar(database, "uji-panitera", isian([{ urutan: 1, jawaban: "b" }]));

    const daftar = await daftarLembar(database, PERKARA);
    expect(daftar).toHaveLength(1);
    expect(daftar[0].jumlahPertanyaan).toBe(1);
  });

  it("saksi yang berbeda mendapat lembarnya sendiri", async () => {
    const database = await basisData();
    await simpanLembar(database, "uji-panitera", { ...isian([{ urutan: 1, jawaban: "kata saksi pertama" }]), saksiKe: 1 });
    await simpanLembar(database, "uji-panitera", { ...isian([{ urutan: 1, jawaban: "kata saksi kedua" }]), saksiKe: 2 });

    const pertama = await muatLembar(database, { perkaraId: PERKARA, kode: "A1a", saksiKe: 1 });
    const kedua = await muatLembar(database, { perkaraId: PERKARA, kode: "A1a", saksiKe: 2 });
    expect(pertama?.baris[0].jawaban).toBe("kata saksi pertama");
    expect(kedua?.baris[0].jawaban).toBe("kata saksi kedua");
  });

  it("bunyi pertanyaan ikut tersimpan, bukan hanya nomornya", async () => {
    // Kalau hanya nomornya yang disimpan lalu bunyinya diambil ulang dari ABT,
    // setiap perubahan katalog akan mengubah bunyi BAS yang SUDAH
    // ditandatangani.
    const database = await basisData();
    await simpanLembar(
      database,
      "uji-panitera",
      isian([{ urutan: 1, pertanyaan: "Apakah saudara kenal dengan Reka Febrianti binti Rajab?", jawaban: "Kenal;" }])
    );

    const lembar = await muatLembar(database, { perkaraId: PERKARA, kode: "A1a", saksiKe: 1 });
    expect(lembar?.baris[0].pertanyaan).toBe("Apakah saudara kenal dengan Reka Febrianti binti Rajab?");
  });

  it("lembar tanpa perkara atau tanpa kumpulan ditolak", async () => {
    const database = await basisData();
    await expect(simpanLembar(database, "uji", { ...isian([]), perkaraId: "" })).rejects.toThrow(/tidak dikenali/i);
    await expect(simpanLembar(database, "uji", { ...isian([]), kode: "" })).rejects.toThrow(/belum dipilih/i);
  });

  it("perkara yang belum punya lembar mengembalikan kosong, bukan galat", async () => {
    const database = await basisData();
    expect(await muatLembar(database, { perkaraId: "99999", kode: "A1a", saksiKe: 1 })).toBeNull();
    expect(await daftarLembar(database, "99999")).toEqual([]);
  });

  it("daftar menghitung yang sudah terjawab, bukan sekadar yang ada", async () => {
    const database = await basisData();
    await simpanLembar(
      database,
      "uji-panitera",
      isian([
        { urutan: 1, jawaban: "terjawab" },
        { urutan: 2, jawaban: "" },
        { urutan: 3, jawaban: "   " },
      ])
    );

    const daftar = await daftarLembar(database, PERKARA);
    expect(daftar[0].jumlahPertanyaan).toBe(3);
    expect(daftar[0].jumlahTerjawab).toBe(1);
  });
});

describe("lembar menjadi penanda blangko", () => {
  function lembarUji(saksiKe: number, nama: string): Lembar {
    return {
      id: `uji-${saksiKe}`,
      perkaraId: PERKARA,
      nomorPerkara: "551/Pdt.G/2026/PA.Dgl",
      kodeKumpulan: "A1a",
      namaKumpulan: "Pertanyaan Saksi P CG",
      saksiKe,
      saksi: { nama, umur: "42", agama: "Islam", pendidikan: "SMA", pekerjaan: "Petani", alamat: "Lalombi" },
      tanggalSidang: "5 September 2026",
      keadaan: "draf",
      catatan: "",
      baris: [{ urutan: 1, pertanyaan: "Apakah saudara kenal?", jawaban: "Kenal, saya kakaknya;" }],
      diubahOleh: "uji",
      diubahAt: "2026-09-05T00:00:00.000Z",
    };
  }

  it("saksi pertama dan kedua mengisi penanda yang berbeda", async () => {
    const peta = penandaDariLembar([lembarUji(1, "Sitti Aminah"), lembarUji(2, "Hasan")]);

    // Nomor penanda ini dari abt_variabel, bukan karangan: 1197 nama saksi
    // pertama, 1203 nama saksi kedua.
    expect(peta.get("1197")?.nilai).toBe("Sitti Aminah");
    expect(peta.get("1203")?.nilai).toBe("Hasan");
    expect(peta.get("1198")?.nilai).toBe("42");
    expect(peta.get("5058")?.nilai).toContain("Kenal, saya kakaknya;");
    expect(peta.get("5059")?.nilai).toContain("Kenal, saya kakaknya;");
  });

  it("saksi ketiga tidak menumpang tempat milik saksi lain", async () => {
    // Blangko hanya menyediakan dua tempat. Menaruh saksi ketiga di salah
    // satunya akan menghasilkan BAS yang menyebut keterangan orang yang keliru.
    const peta = penandaDariLembar([lembarUji(3, "Orang Ketiga")]);
    expect(peta.size).toBe(0);
  });

  it("lembar tanpa jawaban tidak mengisi penanda tanya-jawab", async () => {
    const kosong = lembarUji(1, "Sitti Aminah");
    kosong.baris = [{ urutan: 1, pertanyaan: "Apakah saudara kenal?", jawaban: "" }];
    const peta = penandaDariLembar([kosong]);

    // Jati dirinya sudah diisi, tanya-jawabnya belum - penandanya dibiarkan
    // supaya terlihat bagian itu memang belum ada isinya.
    expect(peta.get("1197")?.nilai).toBe("Sitti Aminah");
    expect(peta.has("5058")).toBe(false);
  });

  it("tanya-jawab tersusun sebagai tanya lalu jawab", async () => {
    const teks = tanyaJawabKeTeks([
      { urutan: 2, pertanyaan: "Pertanyaan dua", jawaban: "Jawaban dua" },
      { urutan: 1, pertanyaan: "Pertanyaan satu", jawaban: "Jawaban satu" },
    ]);

    // Diurutkan sendiri - urutan pada naskah resmi tidak boleh bergantung pada
    // urutan baris yang kebetulan datang dari basis data.
    expect(teks).toBe("- Tanya : Pertanyaan satu\n- Jawab : Jawaban satu\n- Tanya : Pertanyaan dua\n- Jawab : Jawaban dua");
  });

  it("lembar tersimpan terbaca kembali sebagai penanda", async () => {
    const database = await basisData();
    await simpanLembar(database, "uji-panitera", {
      ...isian([{ urutan: 1, pertanyaan: "Apakah saudara kenal?", jawaban: "Kenal;" }]),
      saksi: { nama: "Sitti Aminah", umur: "42" },
    });

    const peta = penandaDariLembar(await semuaLembar(database, PERKARA));
    expect(peta.get("1197")?.nilai).toBe("Sitti Aminah");
    expect(peta.get("5058")?.nilai).toContain("Kenal;");
  });
});
