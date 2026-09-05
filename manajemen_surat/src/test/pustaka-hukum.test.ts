import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  bagianPeraturan,
  berlakuPada,
  bukaJangkar,
  cabutPeraturan,
  cariPasal,
  daftarPeraturan,
  daftarkanPeraturan,
  peraturanTopik,
  sahkanPeraturan,
  slugPeraturan,
  tautkanTopik,
} from "@/server/modules/aleta-ecourt/pustaka-hukum";

/**
 * Pustaka hukum - penyimpanan, pencarian, keberlakuan, dan penautan topik.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Pustaka hukum yang keliru tidak salah sekali, melainkan salah di SETIAP
 * putusan yang merujuknya - dengan rapi dan tanpa ada yang memeriksanya lagi
 * karena "sudah ada di pustaka".
 *
 * Tiga penjagaan yang diuji paling keras:
 *
 *   - pencarian untuk menyusun putusan TIDAK menemukan peraturan yang belum
 *     disahkan seseorang terhadap berkas aslinya;
 *   - keberlakuan dibaca pada TANGGAL PERBUATAN, bukan hari ini; dan
 *   - peraturan yang dicabut tidak dihapus, karena putusan lama merujuknya.
 */

let db: AletaDatabase | null = null;

let aktor = "";

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  aktor = await buatPengguna(db);
  return db;
}

async function jenisPertama(database: AletaDatabase): Promise<string> {
  const baris = await database.queryOne<Record<string, unknown>>(`SELECT id FROM jlf_regulation_types LIMIT 1`);
  return String(baris?.id ?? "");
}

/**
 * Pengguna sungguhan untuk kolom created_by dan verified_by.
 *
 * Dibuat, bukan dilewati dengan id palsu: kolom itu berkunci asing ke tabel
 * pengguna, dan uji yang memakai id yang tidak ada akan lolos di sini tetapi
 * gagal di server - persis kebalikan dari gunanya uji.
 */
async function buatPengguna(database: AletaDatabase): Promise<string> {
  const sekarang = new Date().toISOString();
  const peran = await database.queryOne<Record<string, unknown>>(`SELECT id FROM roles LIMIT 1`);
  const jabatan = await database.queryOne<Record<string, unknown>>(`SELECT id FROM positions LIMIT 1`);
  if (!peran || !jabatan) return "";

  await database.run(
    `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at)
     VALUES ('uji-pustaka', 'uji.pustaka', 'x', 'Petugas Uji', 'uji@contoh.id', '0', ?, ?, ?, ?)`,
    [String(peran.id), String(jabatan.id), sekarang, sekarang]
  );
  return "uji-pustaka";
}

afterEach(async () => {
  await db?.close();
  db = null;
});

describe("mendaftarkan peraturan", () => {
  it("masuk sebagai draf yang belum disahkan", async () => {
    // Pemecahan naskah dapat meleset, dan pasal yang terpotong di tempat yang
    // salah terbaca wajar - justru itu yang membuatnya berbahaya.
    const database = await basisData();
    const peraturan = await daftarkanPeraturan(database, aktor, {
      jenisId: await jenisPertama(database),
      judul: "Peraturan Uji Susunan",
      nomor: "1",
      tahun: 2020,
    });

    expect(peraturan.status).toBe("draft");
    expect(peraturan.verifikasi).toBe("unverified");
  });

  it("judul atau jenis yang kosong ditolak", async () => {
    const database = await basisData();
    const jenisId = await jenisPertama(database);
    await expect(daftarkanPeraturan(database, aktor, { jenisId, judul: "" })).rejects.toThrow(/judul/i);
    await expect(daftarkanPeraturan(database, aktor, { jenisId: "", judul: "Ada" })).rejects.toThrow(/jenis/i);
  });

  it("jenis yang tidak terdaftar ditolak", async () => {
    const database = await basisData();
    await expect(
      daftarkanPeraturan(database, aktor, { jenisId: "tidak-ada", judul: "Ada" })
    ).rejects.toThrow(/tidak dikenali/i);
  });
});

describe("nama pendek untuk jangkar", () => {
  it("disusun dari jenis, nomor, dan tahun - bukan dari judulnya", () => {
    // Judul sering ditulis berbeda antar penerbit; jangkar yang berubah karena
    // judulnya diketik lain membuat rujukan putusan lama menunjuk ke tempat
    // yang tidak ada.
    expect(slugPeraturan("UU", "1", 1974)).toBe("uu-1-1974");
    expect(slugPeraturan("PERMA", "3", 2017)).toBe("perma-3-2017");
  });

  it("tanpa tahun tetap menghasilkan nama yang sah", () => {
    expect(slugPeraturan("KHI", "", null)).toBe("khi");
  });

  it("tanda baca pada nomor tidak merusak jangkar", () => {
    expect(slugPeraturan("SEMA", "1/2022", 2022)).toBe("sema-1-2022-2022");
  });
});

describe("pencarian pasal", () => {
  async function pustakaBerisi(database: AletaDatabase, disahkan: boolean) {
    const peraturan = await daftarkanPeraturan(database, aktor, {
      jenisId: await jenisPertama(database),
      judul: "Peraturan Uji Susunan",
      nomor: "7",
      tahun: 2019,
    });

    const sekarang = new Date().toISOString();
    await database.run(
      `INSERT INTO jlf_regulation_sections
         (id, regulation_id, section_type, section_number, anchor, citation_label,
          title, content, normalized_content, page_number, sort_order, created_at, updated_at)
       VALUES (?, ?, 'pasal', '5', 'uu-7-2019/pasal-5', 'Pasal 5', '', ?, ?, 11, 0, ?, ?)`,
      [
        "bagian-uji-1",
        peraturan.id,
        "Ketentuan mengenai tata cara pemeriksaan diatur pada bagian ini.",
        "ketentuan mengenai tata cara pemeriksaan diatur pada bagian ini.",
        sekarang,
        sekarang,
      ]
    );

    if (disahkan) await sahkanPeraturan(database, aktor, peraturan.id);
    return peraturan;
  }

  it("peraturan yang BELUM disahkan tidak ditemukan", async () => {
    // Yang menyusun putusan tidak boleh menemukan pasal yang belum
    // dibandingkan seseorang dengan berkas aslinya.
    const database = await basisData();
    await pustakaBerisi(database, false);
    expect(await cariPasal(database, "tata cara")).toEqual([]);
  });

  it("peraturan yang sudah disahkan ditemukan", async () => {
    const database = await basisData();
    await pustakaBerisi(database, true);

    const temuan = await cariPasal(database, "tata cara");
    expect(temuan).toHaveLength(1);
    expect(temuan[0].sebutan).toBe("Pasal 5");
    expect(temuan[0].halaman).toBe(11);
    expect(temuan[0].peraturanJudul).toBe("Peraturan Uji Susunan");
  });

  it("yang belum disahkan dapat dicari dengan sengaja, untuk diperiksa", async () => {
    const database = await basisData();
    await pustakaBerisi(database, false);
    expect(await cariPasal(database, "tata cara", { hanyaDisahkan: false })).toHaveLength(1);
  });

  it("pencarian kosong tidak mengembalikan seluruh pustaka", async () => {
    const database = await basisData();
    await pustakaBerisi(database, true);
    expect(await cariPasal(database, "")).toEqual([]);
  });

  it("jangkar membuka bagian yang tepat", async () => {
    // Inilah jalan rujukan putusan kembali ke pasalnya.
    const database = await basisData();
    await pustakaBerisi(database, true);

    const bagian = await bukaJangkar(database, "uu-7-2019/pasal-5");
    expect(bagian?.sebutan).toBe("Pasal 5");
    expect(await bukaJangkar(database, "uu-7-2019/pasal-99")).toBeNull();
  });

  it("bagian satu peraturan terbaca menurut urutan naskahnya", async () => {
    const database = await basisData();
    const peraturan = await pustakaBerisi(database, true);
    const bagian = await bagianPeraturan(database, peraturan.id);
    expect(bagian).toHaveLength(1);
    expect(bagian[0].jangkar).toBe("uu-7-2019/pasal-5");
  });
});

describe("keberlakuan pada tanggal perbuatan", () => {
  async function duaPeraturan(database: AletaDatabase) {
    const jenisId = await jenisPertama(database);
    const lama = await daftarkanPeraturan(database, aktor, {
      jenisId,
      judul: "Peraturan Lama",
      nomor: "1",
      tahun: 2010,
      berlakuSejak: "2010-01-01",
    });
    const baru = await daftarkanPeraturan(database, aktor, {
      jenisId,
      judul: "Peraturan Baru",
      nomor: "2",
      tahun: 2020,
      berlakuSejak: "2020-01-01",
    });
    await sahkanPeraturan(database, aktor, lama.id);
    await sahkanPeraturan(database, aktor, baru.id);
    return { lama, baru };
  }

  it("peraturan yang belum berlaku pada tanggal itu tidak dikembalikan", async () => {
    // Mengambil yang berlaku hari ini menghasilkan putusan yang menerapkan
    // aturan yang belum ada ketika perbuatannya terjadi.
    const database = await basisData();
    await duaPeraturan(database);

    const pada2015 = (await berlakuPada(database, "2015-06-01")).map((item) => item.judul);
    expect(pada2015).toContain("Peraturan Lama");
    expect(pada2015).not.toContain("Peraturan Baru");
  });

  it("peraturan yang sudah dicabut tidak berlaku sesudah tanggal cabutnya", async () => {
    const database = await basisData();
    const { lama } = await duaPeraturan(database);
    await cabutPeraturan(database, lama.id, "2020-01-01");

    expect((await berlakuPada(database, "2019-12-31")).map((i) => i.judul)).toContain("Peraturan Lama");
    expect((await berlakuPada(database, "2021-01-01")).map((i) => i.judul)).not.toContain("Peraturan Lama");
  });

  it("peraturan yang dicabut TIDAK dihapus dari pustaka", async () => {
    // Putusan lama merujuknya, dan rujukan yang menunjuk ke tempat kosong lebih
    // buruk daripada rujukan ke aturan yang sudah tidak berlaku.
    const database = await basisData();
    const { lama, baru } = await duaPeraturan(database);
    await cabutPeraturan(database, lama.id, "2020-01-01", baru.id);

    const semua = await daftarPeraturan(database);
    const dicabut = semua.find((item) => item.id === lama.id);
    expect(dicabut).toBeDefined();
    expect(dicabut?.status).toBe("revoked");
    expect(dicabut?.digantiOlehId).toBe(baru.id);
  });

  it("peraturan tanpa tanggal berlaku tetap dikembalikan", async () => {
    // Banyak naskah lama tidak mencantumkannya; membuangnya berarti pustaka
    // seolah kosong untuk tanggal mana pun.
    const database = await basisData();
    const tanpaTanggal = await daftarkanPeraturan(database, aktor, {
      jenisId: await jenisPertama(database),
      judul: "Peraturan Tanpa Tanggal",
    });
    await sahkanPeraturan(database, aktor, tanpaTanggal.id);

    expect((await berlakuPada(database, "2015-06-01")).map((i) => i.judul)).toContain("Peraturan Tanpa Tanggal");
  });

  it("yang belum disahkan tidak muncul sebagai berlaku", async () => {
    const database = await basisData();
    await daftarkanPeraturan(database, aktor, {
      jenisId: await jenisPertama(database),
      judul: "Masih Draf",
      berlakuSejak: "2010-01-01",
    });
    expect((await berlakuPada(database, "2015-06-01")).map((i) => i.judul)).not.toContain("Masih Draf");
  });

  it("tanggal kosong tidak mengembalikan apa pun", async () => {
    const database = await basisData();
    await duaPeraturan(database);
    expect(await berlakuPada(database, "")).toEqual([]);
  });
});

describe("penautan topik", () => {
  it("peraturan tertaut dan terbaca lewat topiknya", async () => {
    const database = await basisData();
    const peraturan = await daftarkanPeraturan(database, aktor, {
      jenisId: await jenisPertama(database),
      judul: "Peraturan Perceraian Uji",
    });
    await sahkanPeraturan(database, aktor, peraturan.id);
    await tautkanTopik(database, aktor, peraturan.id, "jlf-topic-cerai-gugat", "diuji");

    const daftar = await peraturanTopik(database, "cerai-gugat");
    expect(daftar.map((item) => item.judul)).toContain("Peraturan Perceraian Uji");
  });

  it("penautan yang sama dua kali tidak digandakan", async () => {
    const database = await basisData();
    const peraturan = await daftarkanPeraturan(database, aktor, {
      jenisId: await jenisPertama(database),
      judul: "Peraturan Uji Ganda",
    });
    await sahkanPeraturan(database, aktor, peraturan.id);

    expect(await tautkanTopik(database, aktor, peraturan.id, "jlf-topic-cerai-gugat")).toBe(true);
    expect(await tautkanTopik(database, aktor, peraturan.id, "jlf-topic-cerai-gugat")).toBe(false);
    expect(await peraturanTopik(database, "cerai-gugat")).toHaveLength(1);
  });

  it("topik yang tidak dikenali mengembalikan kosong, bukan galat", async () => {
    const database = await basisData();
    expect(await peraturanTopik(database, "topik-tidak-ada")).toEqual([]);
    expect(await peraturanTopik(database, "")).toEqual([]);
  });

  it("peraturan yang belum disahkan tidak muncul di daftar topik", async () => {
    const database = await basisData();
    const peraturan = await daftarkanPeraturan(database, aktor, {
      jenisId: await jenisPertama(database),
      judul: "Draf Bertopik",
    });
    await tautkanTopik(database, aktor, peraturan.id, "jlf-topic-cerai-gugat");

    expect(await peraturanTopik(database, "cerai-gugat")).toEqual([]);
    expect((await peraturanTopik(database, "cerai-gugat", false)).map((i) => i.judul)).toContain("Draf Bertopik");
  });
});
