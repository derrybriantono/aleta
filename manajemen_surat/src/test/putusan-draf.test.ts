import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { terimaSisanya } from "@/server/modules/aleta-ecourt/telaah-draf";
import {
  bacaDraf,
  butirDraf,
  nilaiDraf,
  rakitPutusan,
  riwayatDraf,
  selisihDenganPustaka,
  simpanDraf,
  tandatanganiDraf,
  type MasukanRakit,
} from "@/server/modules/aleta-ecourt/perakit-putusan";

/**
 * Draf putusan dan riwayat versinya (F6).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Satu hal, dan seluruh berkas ini ada untuknya: naskah yang sudah
 * ditandatangani TIDAK BOLEH berubah bunyinya karena butir pustakanya
 * disunting kemudian.
 *
 * Draf yang hanya menunjuk butir_id akan ikut berubah setiap kali butirnya
 * disunting - termasuk draf yang ditandatangani setahun sebelumnya. Perubahan
 * itu tidak menghasilkan galat, tidak tercatat di mana pun, dan baru terlihat
 * bila ada yang kebetulan membandingkan naskah cetak dengan naskah di layar.
 *
 * Yang kedua: "siap" tidak boleh dapat dilewati. Draf yang petitumnya belum
 * terjawab tidak boleh ditandatangani lewat jalur mana pun.
 */

let db: AletaDatabase | null = null;

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  return db;
}

afterEach(async () => {
  await db?.close?.();
  db = null;
});

const PERKARA = "10201";
const NOMOR = "545/Pdt.G/2026/PA.Dgl";

async function tanamButir(basis: AletaDatabase, id: string, teks: string, syarat: Record<string, unknown> = {}) {
  const sekarang = new Date().toISOString();
  await basis.run(
    `INSERT INTO aleta_pertimbangan_butir
       (id, sidik, teks, jenis_perkara, isu, syarat, jumlah_pemakaian, keadaan, atas_perintah, versi, dibuat_at, diubah_at)
     VALUES (?, ?, ?, 'Cerai Gugat', 'maksud', ?, 10, 'disahkan', 'Ketua', 1, ?, ?)`,
    [id, `sidik-${id}`, teks, JSON.stringify(syarat), sekarang, sekarang]
  );
}

function masukan(lebih: Partial<MasukanRakit> = {}): MasukanRakit {
  return {
    perkaraId: PERKARA,
    nomorPerkara: NOMOR,
    pengadilan: "Pengadilan Agama Donggala",
    jenisPerkara: "Cerai Gugat",
    fakta: { tergugatHadir: false, saksi: 2 },
    dudukPerkara: {
      nomorPerkara: NOMOR,
      tanggalDaftar: "2026-03-02",
      penggugat: "Reka Febrianti binti Rajab",
      tergugat: "Andi Saputra bin Yusuf",
      rangkaian: [
        {
          sidangKe: 1,
          tanggal: "2026-04-01",
          hari: "",
          jam: "",
          agenda: "Pembacaan gugatan",
          ruangan: "",
          ditunda: false,
          alasanDitunda: "",
          tanggalDitunda: "",
          sebelumnya: null,
        },
      ],
      catatan: [
        {
          sidangKe: 1,
          kehadiranPenggugat: "hadir",
          kehadiranTergugat: "tidak hadir",
          agenda: "Pembacaan gugatan",
          hasil: "pemeriksaan dilanjutkan tanpa hadirnya Tergugat",
        },
      ],
      saksi: [],
    },
    petitum: [{ nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" }],
    amar: [{ nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" }],
    biaya: {
      komponen: [
        { nama: "Pendaftaran", banyak: 1, tarif: 30000 },
        { nama: "Panggilan", banyak: 2, tarif: 100000 },
      ],
      panjar: 230000,
      dibebankanKepada: "Penggugat",
    },
    nilai: [
      { nama: "ketuaMajelis", nilai: "Dra. Siti Zubaidah, M.H.", asal: "SIPP" },
      { nama: "panitera", nilai: "Muhammad Ali, S.H.", asal: "SIPP" },
      { nama: "tanggalPutusan", nilai: "Kamis, 30 April 2026", asal: "ALETA" },
    ],
    ...lebih,
  };
}

describe("merakit draf dari pustaka", () => {
  it("butir yang syaratnya terpenuhi masuk ke pertimbangan", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    await tanamButir(basis, "b2", "Menimbang, bahwa Tergugat tidak hadir;", { tergugatHadir: false });

    const hasil = await rakitPutusan(basis, masukan());
    expect(hasil.butirDipakai.map((item) => item.butirId).sort()).toEqual(["b1", "b2"]);
    expect(hasil.naskah).toContain("maksud gugatan");
  });

  it("butir USULAN tidak pernah ikut terpakai", async () => {
    // Perakit yang boleh memakai butir usulan akan memakainya pada hari
    // pustaka masih setengah terisi, yaitu hari ini.
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    await basis.run(`UPDATE aleta_pertimbangan_butir SET keadaan = 'usulan' WHERE id = 'b1'`);

    const hasil = await rakitPutusan(basis, masukan());
    expect(hasil.butirDipakai).toEqual([]);
    expect(hasil.kerangka.bagian.find((item) => item.kunci === "pertimbangan")?.halangan).toContain(
      "Tidak ada satu pun butir pustaka"
    );
  });

  it("naskah lengkap tanpa halangan dinyatakan siap", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(basis, masukan());
    expect(hasil.halangan).toEqual([]);
    expect(hasil.siapDitandatangani).toBe(true);
  });

  it("tarif yang belum disetel menahan seluruh draf, bukan hanya bagian biayanya", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(
      basis,
      masukan({
        biaya: {
          komponen: [{ nama: "Panggilan luar wilayah", banyak: 1, tarif: null }],
          panjar: 0,
          dibebankanKepada: "Penggugat",
        },
      })
    );
    expect(hasil.siapDitandatangani).toBe(false);
    expect(hasil.halangan.join(" ")).toContain("belum disetel");
  });

  it("petitum yang belum terjawab menahan draf", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(
      basis,
      masukan({
        petitum: [
          { nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" },
          { nomor: 2, teks: "Menetapkan hak asuh anak bernama Aulia kepada Penggugat;" },
        ],
      })
    );
    expect(hasil.siapDitandatangani).toBe(false);
    expect(hasil.halangan.join(" ")).toContain("Petitum 2 belum terjawab");
  });

  it("fakta yang belum diketahui dilaporkan sebagai yang perlu dilengkapi", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    await tanamButir(basis, "b2", "Menimbang, bahwa mediasi tidak berhasil;", { mediasiBerhasil: false });

    const hasil = await rakitPutusan(basis, masukan());
    expect(hasil.faktaKurang).toContain("mediasiBerhasil");
    expect(hasil.butirTertunda.map((item) => item.butirId)).toContain("b2");
  });
});

describe("amar dari templat SIPP (F4)", () => {
  const TEMPLAT = [
    {
      id: "t1",
      nama: "Kabul Cerai Gugat",
      jenisPerkara: "Cerai Gugat",
      keadaan: "dikabulkan",
      aktif: true,
      isi: "MENGADILI\n1. Mengabulkan gugatan Penggugat seluruhnya;\n2. Menjatuhkan talak satu bain sughra;",
    },
  ];

  it("templat dipakai saat amar belum disusun petugas", async () => {
    // Pemilih templat sempat ada, terjuji, dan tidak pernah dipanggil -
    // sehingga "amar dari templat SIPP" hanya berlaku bila pemanggilnya sudah
    // menyusun amarnya sendiri, yang meniadakan gunanya.
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(basis, masukan({ amar: [], templatAmar: TEMPLAT }));

    expect(hasil.kerangka.bagian.find((item) => item.kunci === "amar")?.isi).toContain(
      "Mengabulkan gugatan Penggugat"
    );
  });

  it("amar yang sudah disusun petugas TIDAK ditimpa templat", async () => {
    // Yang diketik manusia selalu menang atas yang dipilih mesin.
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(
      basis,
      masukan({ amar: [{ nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" }], templatAmar: TEMPLAT })
    );
    expect(hasil.kerangka.bagian.find((item) => item.kunci === "amar")?.isi).not.toContain("talak satu bain");
  });

  it("penomoran templat dibuang dan dinomori ulang", async () => {
    // Templat kerap dilewati sebagiannya, dan amar yang melompat dari 1 ke 3
    // dibaca sebagai ada butir yang hilang.
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(basis, masukan({ amar: [], templatAmar: TEMPLAT }));
    const amar = hasil.kerangka.bagian.find((item) => item.kunci === "amar")?.isi ?? "";
    expect(amar).toContain("1. Mengabulkan");
    expect(amar).toContain("2. Menjatuhkan");
  });

  it("tidak ada templat yang cocok disebut sebagai halangan, bukan didiamkan", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(
      basis,
      masukan({ amar: [], templatAmar: [{ ...TEMPLAT[0], jenisPerkara: "Itsbat Nikah" }] })
    );
    expect(hasil.halangan.join(" ")).toContain("Cerai Gugat");
  });
});

describe("riwayat versi draf", () => {
  it("menyimpan selalu menambah versi, tidak menimpa", async () => {
    // Draf lama adalah satu-satunya bukti bahwa naskah sempat berbunyi lain.
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(basis, masukan());

    const satu = await simpanDraf(basis, "aktor", { perkaraId: PERKARA, nomorPerkara: NOMOR, hasil });
    const dua = await simpanDraf(basis, "aktor", { perkaraId: PERKARA, nomorPerkara: NOMOR, hasil });

    expect(satu.versi).toBe(1);
    expect(dua.versi).toBe(2);
    expect(satu.drafId).not.toBe(dua.drafId);
    expect((await riwayatDraf(basis, PERKARA)).map((item) => item.versi)).toEqual([2, 1]);
  });

  it("nilai yang mengisi naskah tersimpan beserta sistem asalnya", async () => {
    // "Menurut sistem yang mana" adalah pertanyaan yang selalu ditanyakan
    // saat draf lama ditelusuri; nilai tanpa asal tidak dapat menjawabnya.
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const isi = masukan();
    const hasil = await rakitPutusan(basis, isi);
    const disimpan = await simpanDraf(basis, "aktor", {
      perkaraId: PERKARA,
      nomorPerkara: NOMOR,
      hasil,
      nilai: isi.nilai,
    });

    const nilai = await nilaiDraf(basis, disimpan.drafId);
    expect(nilai.find((item) => item.nama === "ketuaMajelis")?.asal).toBe("SIPP");
    expect(nilai.find((item) => item.nama === "tanggalPutusan")?.asal).toBe("ALETA");
  });

  it("BUNYI butir disalin, sehingga naskah lama tidak ikut berubah saat pustaka disunting", async () => {
    // Inilah sebab teks_saat_itu ada. Putusan yang bunyinya berubah sesudah
    // ditandatangani bukan kekeliruan data; ia pemalsuan, betapa pun tidak
    // disengaja.
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa bunyi yang lama;");
    const hasil = await rakitPutusan(basis, masukan());
    const disimpan = await simpanDraf(basis, "aktor", { perkaraId: PERKARA, nomorPerkara: NOMOR, hasil });

    await basis.run(`UPDATE aleta_pertimbangan_butir SET teks = 'Menimbang, bahwa bunyi yang baru;' WHERE id = 'b1'`);

    const tersimpan = await butirDraf(basis, disimpan.drafId);
    expect(tersimpan[0].teks).toBe("Menimbang, bahwa bunyi yang lama;");
    expect((await bacaDraf(basis, disimpan.drafId))?.naskah).toContain("bunyi yang lama");
  });

  it("selisih dengan pustaka hari ini terbaca, sehingga pemeriksa tahu naskahnya memakai bunyi lama", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa bunyi yang lama;");
    const hasil = await rakitPutusan(basis, masukan());
    const disimpan = await simpanDraf(basis, "aktor", { perkaraId: PERKARA, nomorPerkara: NOMOR, hasil });

    expect(await selisihDenganPustaka(basis, disimpan.drafId)).toEqual([]);

    await basis.run(`UPDATE aleta_pertimbangan_butir SET teks = 'Menimbang, bahwa bunyi yang baru;' WHERE id = 'b1'`);
    const selisih = await selisihDenganPustaka(basis, disimpan.drafId);
    expect(selisih).toHaveLength(1);
    expect(selisih[0].teksDraf).toContain("lama");
    expect(selisih[0].teksPustaka).toContain("baru");
  });

  it("butir yang sudah diganti di pustaka juga terbaca sebagai selisih", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa bunyi yang lama;");
    const hasil = await rakitPutusan(basis, masukan());
    const disimpan = await simpanDraf(basis, "aktor", { perkaraId: PERKARA, nomorPerkara: NOMOR, hasil });

    await basis.run(`UPDATE aleta_pertimbangan_butir SET keadaan = 'diganti' WHERE id = 'b1'`);
    const selisih = await selisihDenganPustaka(basis, disimpan.drafId);
    expect(selisih[0].keadaanPustaka).toBe("diganti");
  });
});

describe("tanda tangan", () => {
  /**
   * Draf yang siap DAN sudah ditelaah.
   *
   * Telaah alinea (H3) menjadi syarat tanda tangan sesudah migrasi 0029, jadi
   * draf yang hanya "siap" tidak lagi cukup. Ditelaah sekaligus di sini karena
   * yang diuji blok ini adalah tanda tangannya; syarat telaahnya sendiri
   * diuji di telaah-draf.test.ts.
   */
  async function drafSiap(basis: AletaDatabase) {
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(basis, masukan());
    const disimpan = await simpanDraf(basis, "aktor", { perkaraId: PERKARA, nomorPerkara: NOMOR, hasil });
    await terimaSisanya(basis, { drafId: disimpan.drafId, oleh: "Dra. Siti Zubaidah, M.H." });
    return disimpan;
  }

  it("draf siap dapat ditandatangani, dan namanya tercatat", async () => {
    const basis = await basisData();
    const disimpan = await drafSiap(basis);
    const hasil = await tandatanganiDraf(basis, { drafId: disimpan.drafId, olehNama: "Dra. Siti Zubaidah, M.H." });
    expect(hasil.ok).toBe(true);

    const draf = await bacaDraf(basis, disimpan.drafId);
    expect(draf?.keadaan).toBe("ditandatangani");
    expect(draf?.ditandatanganiOleh).toBe("Dra. Siti Zubaidah, M.H.");
  });

  it("nama hakim WAJIB - akun yang menekan bukan hakim", async () => {
    const basis = await basisData();
    const disimpan = await drafSiap(basis);
    const hasil = await tandatanganiDraf(basis, { drafId: disimpan.drafId, olehNama: "  " });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("wajib");
  });

  it("draf yang BELUM siap tidak dapat ditandatangani", async () => {
    // Tidak ada parameter untuk melewatinya: pelewat yang disediakan akan
    // dipakai pada hari yang paling sibuk.
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(
      basis,
      masukan({
        petitum: [
          { nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" },
          { nomor: 2, teks: "Menetapkan hak asuh anak bernama Aulia kepada Penggugat;" },
        ],
      })
    );
    const disimpan = await simpanDraf(basis, "aktor", { perkaraId: PERKARA, nomorPerkara: NOMOR, hasil });

    const tanda = await tandatanganiDraf(basis, { drafId: disimpan.drafId, olehNama: "Dra. Siti Zubaidah, M.H." });
    expect(tanda.ok).toBe(false);
    expect(tanda.sebab).toContain("belum siap");
  });

  it("draf yang sudah ditandatangani tidak dapat ditandatangani ulang", async () => {
    const basis = await basisData();
    const disimpan = await drafSiap(basis);
    await tandatanganiDraf(basis, { drafId: disimpan.drafId, olehNama: "Dra. Siti Zubaidah, M.H." });
    const ulang = await tandatanganiDraf(basis, { drafId: disimpan.drafId, olehNama: "Orang Lain" });
    expect(ulang.ok).toBe(false);
    expect(ulang.sebab).toContain("sudah ditandatangani");
  });

  it("tidak ada jalur lain yang menghasilkan draf bertanda tangan", async () => {
    // J3. Yang dijaga bukan hanya bahwa tanda tangan diminta, melainkan bahwa
    // simpanDraf SELALU melahirkan keadaan 'draf' - berapa kali pun ia
    // dipanggil dan sesiap apa pun hasilnya.
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa maksud gugatan adalah sebagaimana diuraikan;");
    const hasil = await rakitPutusan(basis, masukan());
    expect(hasil.siapDitandatangani).toBe(true);

    const satu = await simpanDraf(basis, "aktor", { perkaraId: PERKARA, nomorPerkara: NOMOR, hasil });
    const dua = await simpanDraf(basis, "aktor", { perkaraId: PERKARA, nomorPerkara: NOMOR, hasil });
    expect((await bacaDraf(basis, satu.drafId))?.keadaan).toBe("draf");
    expect((await bacaDraf(basis, dua.drafId))?.keadaan).toBe("draf");

    const bertandaTangan = await basis.queryAll<Record<string, unknown>>(
      `SELECT id FROM aleta_putusan_draf WHERE keadaan = 'ditandatangani'`
    );
    expect(bertandaTangan).toEqual([]);
  });

  it("draf yang tidak ada ditolak dengan sebabnya", async () => {
    const basis = await basisData();
    const hasil = await tandatanganiDraf(basis, { drafId: "tidak-ada", olehNama: "Hakim" });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("tidak ditemukan");
  });
});
