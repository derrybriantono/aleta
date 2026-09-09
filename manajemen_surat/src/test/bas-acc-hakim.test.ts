// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  PERAN_PENGACC,
  accLembar,
  keadaanAcc,
  kembalikanLembar,
} from "@/server/modules/aleta-ecourt/bas-acc";
import { muatLembar, simpanLembar } from "@/server/modules/aleta-ecourt/bas-lembar";
import { createManagedUserInDb } from "@/server/modules/users/service";

/**
 * ============================================================================
 * ACC HAKIM ATAS BERITA ACARA SIDANG
 * ============================================================================
 *
 * Di kenyataan, berita acara yang disusun panitera sidang di-acc hakim sebelum
 * dipakai. Langkah itu tidak pernah ada di ALETA - sehingga BAS yang sudah
 * di-acc tidak dapat dibedakan dari yang belum, dan penanda "belum ada BAS"
 * pada jadwal sidang menjawab pertanyaan yang berbeda: ia berbicara tentang
 * keberadaan berkasnya, bukan tentang persetujuan atasnya.
 *
 * ============================================================================
 * YANG PALING KERAS DIUJI DI SINI
 * ============================================================================
 *
 * Bahwa acc BATAL begitu isinya berubah. Tanpa itu, panitera dapat menyunting
 * lembar sesudah hakim menyetujuinya, dan persetujuan hakim melekat pada
 * naskah yang tidak pernah dilihatnya.
 *
 * Bukan kelalaian yang mustahil - memperbaiki satu salah ketik sesudah di-acc
 * adalah hal yang paling wajar dilakukan orang. Yang membuatnya berbahaya, acc
 * semacam itu TIDAK MENAMPAKKAN DIRINYA: di layar ia tetap tertulis "sudah
 * di-acc", lengkap dengan nama hakim dan tanggalnya, dan tidak seorang pun
 * punya sebab untuk memeriksanya.
 */

let db: AletaDatabase | null = null;
let urutan = 0;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function buatPegawai(positionId: string) {
  urutan += 1;
  const hasil = await createManagedUserInDb(db as AletaDatabase, "usr-super", {
    roleOverride: null,
    username: `ujiacc${urutan}`,
    password: "rahasia123",
    email: `ujiacc${urutan}@pa.go.id`,
    whatsappNumber: `62812977${String(3000 + urutan)}`,
    name: `Pegawai Acc ${urutan}`,
    nip: `19940102201715${String(3000 + urutan)}`,
    positionId,
    isActive: true,
  });
  return hasil.id;
}

const PERKARA = "10199";

/** Menyimpan satu lembar, lalu memulangkan idnya. */
async function buatLembar(oleh: string, keadaan: "draf" | "selesai") {
  await simpanLembar(db as AletaDatabase, oleh, {
    perkaraId: PERKARA,
    nomorPerkara: "601/Pdt.G/2026/PA.Dgl",
    kode: "A1a",
    namaKumpulan: "Pertanyaan Saksi P CG",
    saksiKe: 1,
    keadaan,
    baris: [{ urutan: 1, pertanyaan: "Apakah saudara kenal?", jawaban: "Kenal, saya kakaknya;" }],
  });
  const lembar = await muatLembar(db as AletaDatabase, { perkaraId: PERKARA, kode: "A1a", saksiKe: 1 });
  return lembar!;
}

describe("keadaan acc diturunkan, bukan disimpan", () => {
  it("empat keadaan dibedakan", () => {
    expect(keadaanAcc({ keadaan: "draf" })).toBe("belum-selesai");
    expect(keadaanAcc({ keadaan: "selesai" })).toBe("menunggu-acc");
    expect(keadaanAcc({ keadaan: "selesai", diacc_at: "2026-09-10T00:00:00.000Z" })).toBe("diacc");
    expect(keadaanAcc({ keadaan: "selesai", acc_dikembalikan_alasan: "Nama saksi keliru" })).toBe(
      "dikembalikan"
    );
  });

  it("selesai TIDAK berarti sudah di-acc", () => {
    // Inilah keterangan yang hilang bila keduanya digabung menjadi satu deret
    // keadaan - dan justru keterangan itulah yang paling sering ditunggu.
    expect(keadaanAcc({ keadaan: "selesai" })).not.toBe("diacc");
  });

  it("dikembalikan mengalahkan diacc bila keduanya terisi", () => {
    // Tidak pernah terjadi - pengembalian selalu menghapus jejak accnya -
    // tetapi urutan pemeriksaannya membuatnya tetap benar seandainya terjadi.
    expect(
      keadaanAcc({
        keadaan: "selesai",
        diacc_at: "2026-09-10T00:00:00.000Z",
        acc_dikembalikan_alasan: "Nama saksi keliru",
      })
    ).toBe("dikembalikan");
  });
});

describe("siapa yang boleh meng-acc", () => {
  it("panitera TIDAK boleh - acc adalah pemeriksaan oleh orang lain", async () => {
    const panitera = await buatPegawai("pos-panitera");
    const lembar = await buatLembar(panitera, "selesai");

    await expect(
      accLembar(db as AletaDatabase, panitera, lembar.id)
    ).rejects.toThrow(/Hanya hakim/);
  });

  it("daftar perannya tidak memuat panitera", () => {
    // Dijaga sebagai daftar, bukan hanya lewat perilaku: menambahkan panitera
    // ke daftar ini akan membuat seluruh langkah acc kehilangan gunanya, dan
    // itu perubahan yang harus disengaja.
    expect(PERAN_PENGACC).not.toContain("panitera");
    expect(PERAN_PENGACC).toContain("hakim");
  });
});

describe("acc hanya atas lembar yang sudah selesai", () => {
  it("lembar yang masih diisi ditolak", async () => {
    // Meng-acc naskah yang belum selesai berarti menyetujui kalimat yang belum
    // ditulis, dan panitera yang menuliskannya sesudah itu menulis di bawah
    // persetujuan yang sudah terlanjur diberikan.
    const panitera = await buatPegawai("pos-panitera");
    const ketua = await buatPegawai("pos-ketua");
    const lembar = await buatLembar(panitera, "draf");

    await expect(accLembar(db as AletaDatabase, ketua, lembar.id)).rejects.toThrow(/masih diisi/);
  });

  it("lembar selesai dapat di-acc, dan jejaknya tercatat", async () => {
    const panitera = await buatPegawai("pos-panitera");
    const ketua = await buatPegawai("pos-ketua");
    const lembar = await buatLembar(panitera, "selesai");

    expect(lembar.acc).toBe("menunggu-acc");

    await accLembar(db as AletaDatabase, ketua, lembar.id);

    const sesudah = await muatLembar(db as AletaDatabase, {
      perkaraId: PERKARA,
      kode: "A1a",
      saksiKe: 1,
    });
    expect(sesudah!.acc).toBe("diacc");
    expect(sesudah!.diaccOleh).toBe(ketua);
    expect(sesudah!.diaccAt).not.toBe("");
  });
});

describe("mengembalikan lembar", () => {
  it("alasannya WAJIB", async () => {
    // Pengembalian tanpa alasan memaksa panitera menebak apa yang harus
    // diperbaiki, dan tebakan yang salah menghasilkan pengembalian kedua atas
    // hal yang sama - dua kali kerja untuk satu keterangan yang tidak pernah
    // disampaikan.
    const panitera = await buatPegawai("pos-panitera");
    const ketua = await buatPegawai("pos-ketua");
    const lembar = await buatLembar(panitera, "selesai");

    await expect(
      kembalikanLembar(db as AletaDatabase, ketua, lembar.id, "   ")
    ).rejects.toThrow(/Sebutkan apa yang harus diperbaiki/);
  });

  it("pengembalian menghapus jejak acc sebelumnya", async () => {
    const panitera = await buatPegawai("pos-panitera");
    const ketua = await buatPegawai("pos-ketua");
    const lembar = await buatLembar(panitera, "selesai");

    await accLembar(db as AletaDatabase, ketua, lembar.id);
    await kembalikanLembar(db as AletaDatabase, ketua, lembar.id, "Nama saksi keliru");

    const sesudah = await muatLembar(db as AletaDatabase, {
      perkaraId: PERKARA,
      kode: "A1a",
      saksiKe: 1,
    });
    expect(sesudah!.acc).toBe("dikembalikan");
    expect(sesudah!.diaccAt).toBe("");
    expect(sesudah!.accDikembalikanAlasan).toBe("Nama saksi keliru");
  });
});

describe("acc batal begitu isinya berubah", () => {
  it("menyunting sesudah di-acc menghapus accnya", async () => {
    // ========================================================================
    // INILAH ATURAN YANG PALING MENENTUKAN DI BERKAS INI
    // ========================================================================
    //
    // Tanpanya, persetujuan hakim melekat pada naskah yang tidak pernah
    // dilihatnya - dan tidak ada seorang pun yang punya sebab memeriksanya,
    // sebab di layar ia tetap tertulis "sudah di-acc".
    const panitera = await buatPegawai("pos-panitera");
    const ketua = await buatPegawai("pos-ketua");
    const lembar = await buatLembar(panitera, "selesai");

    await accLembar(db as AletaDatabase, ketua, lembar.id);
    expect(
      (await muatLembar(db as AletaDatabase, { perkaraId: PERKARA, kode: "A1a", saksiKe: 1 }))!.acc
    ).toBe("diacc");

    // Panitera memperbaiki satu jawaban - hal yang paling wajar dilakukan.
    await simpanLembar(db as AletaDatabase, panitera, {
      perkaraId: PERKARA,
      nomorPerkara: "601/Pdt.G/2026/PA.Dgl",
      kode: "A1a",
      saksiKe: 1,
      keadaan: "selesai",
      baris: [{ urutan: 1, pertanyaan: "Apakah saudara kenal?", jawaban: "Kenal, saya adiknya;" }],
    });

    const sesudah = await muatLembar(db as AletaDatabase, {
      perkaraId: PERKARA,
      kode: "A1a",
      saksiKe: 1,
    });
    expect(sesudah!.acc).toBe("menunggu-acc");
    expect(sesudah!.diaccAt).toBe("");
    expect(sesudah!.diaccOleh).toBe("");
  });

  it("menyunting sesudah dikembalikan menghapus keterangan pengembaliannya", async () => {
    // Panitera yang sudah memperbaiki tidak boleh terus membawa keterangan
    // bahwa lembarnya dikembalikan - yang membaca berikutnya akan menyangka
    // perbaikannya belum dikerjakan.
    const panitera = await buatPegawai("pos-panitera");
    const ketua = await buatPegawai("pos-ketua");
    const lembar = await buatLembar(panitera, "selesai");

    await kembalikanLembar(db as AletaDatabase, ketua, lembar.id, "Nama saksi keliru");
    await simpanLembar(db as AletaDatabase, panitera, {
      perkaraId: PERKARA,
      nomorPerkara: "601/Pdt.G/2026/PA.Dgl",
      kode: "A1a",
      saksiKe: 1,
      keadaan: "selesai",
      baris: [{ urutan: 1, pertanyaan: "Apakah saudara kenal?", jawaban: "Kenal, saya kakaknya;" }],
    });

    const sesudah = await muatLembar(db as AletaDatabase, {
      perkaraId: PERKARA,
      kode: "A1a",
      saksiKe: 1,
    });
    expect(sesudah!.accDikembalikanAlasan).toBe("");
    expect(sesudah!.acc).toBe("menunggu-acc");
  });
});
