// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  KEDUDUKAN_MEDIASI,
  bacaKehadiran,
  ringkasKehadiranBanyak,
  simpanKehadiran,
} from "@/server/modules/aleta-ecourt/kehadiran-mediasi";

/**
 * Kehadiran pertemuan mediasi.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * SIPP menyimpan kehadiran mediasi sebagai SATU ruas bebas - "dihadiri 2".
 * Angka itu tidak membedakan dua keadaan yang akibat hukumnya berlawanan:
 *
 *   dua PIHAK hadir sendiri    memenuhi PERMA 1/2016 Pasal 7 ayat (1);
 *   dua KUASA hadir sendirian  tidak memenuhi, dan dapat berujung pada
 *                              penilaian iktikad baik menurut Pasal 6.
 *
 * Karena itu ALETA mencatatnya menurut empat kedudukan terpisah. Yang diuji di
 * sini bukan tampilannya, melainkan janji-janji yang membuat catatan itu dapat
 * dipercaya saat dipersoalkan.
 */

let db: AletaDatabase | null = null;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: false });
});

afterEach(async () => {
  await db?.close?.();
  db = null;
});

const pertemuan = { mediasiId: "M-1", perkaraId: "9984", nomorPerkara: "471/Pdt.G/2026/PA.Dgl" };

describe("empat kedudukan, dan keempatnya selalu dikembalikan", () => {
  it("kedudukan yang belum pernah dicatat tetap muncul, ditandai belum dicatat", async () => {
    // Menghilangkannya membuat layar menampilkan tiga baris, dan pembacanya
    // menyangka kedudukan keempat memang tidak ada pada perkara itu.
    const hasil = await bacaKehadiran(db!, "M-belum-ada", "2026-09-07");
    expect(hasil.baris).toHaveLength(4);
    expect(hasil.adaCatatan).toBe(false);
    expect(hasil.baris.every((x) => x.belumDicatat)).toBe(true);
  });

  it("keempat kunci persis yang dikenali modul", () => {
    // Kunci di layar disalin dari daftar ini. Kalau salah satunya berubah,
    // rute menolak simpanannya - dan penolakan itu memang disengaja.
    expect(KEDUDUKAN_MEDIASI.map((x) => x.kunci)).toEqual([
      "penggugat",
      "kuasa_penggugat",
      "tergugat",
      "kuasa_tergugat",
    ]);
  });

  it("kuasa selalu berpasangan dengan sisinya, tidak pernah berdiri sendiri", () => {
    // "kuasa" tanpa sisi tidak menjawab apa pun: yang menentukan sah tidaknya
    // pertemuan adalah kehadiran tiap SISI, bukan jumlah kuasa yang datang.
    for (const kedudukan of KEDUDUKAN_MEDIASI) {
      if (kedudukan.kuasa) expect([1, 2]).toContain(kedudukan.sisi);
    }
  });
});

describe("pihak hadir sendiri dibedakan dari kuasanya yang hadir", () => {
  it("dua kuasa hadir tanpa pihaknya tercatat sebagai keadaan yang berbeda", async () => {
    // Inilah sebab tabel ini ada. Pada SIPP keduanya sama-sama "dihadiri 2".
    await simpanKehadiran(db!, {
      ...pertemuan,
      tanggalPertemuan: "2026-09-07",
      oleh: "Panitera Uji",
      isian: [
        { kedudukan: "penggugat", hadir: false, alasan: "diwakilkan kuasa" },
        { kedudukan: "kuasa_penggugat", hadir: true, nama: "Kuasa A, S.H." },
        { kedudukan: "tergugat", hadir: false, alasan: "diwakilkan kuasa" },
        { kedudukan: "kuasa_tergugat", hadir: true, nama: "Kuasa B, S.H." },
      ],
    });

    const hasil = await bacaKehadiran(db!, "M-1", "2026-09-07");
    const peta = Object.fromEntries(hasil.baris.map((x) => [x.kedudukan, x]));

    expect(peta.penggugat.hadir).toBe(false);
    expect(peta.tergugat.hadir).toBe(false);
    expect(peta.kuasa_penggugat.hadir).toBe(true);
    expect(peta.kuasa_tergugat.hadir).toBe(true);
    // Jumlah yang hadir dua - persis seperti "dihadiri 2" di SIPP - tetapi
    // TIDAK satu pun pihaknya hadir sendiri.
    expect(hasil.baris.filter((x) => x.hadir)).toHaveLength(2);
  });
});

describe("catatan yang dapat dipercaya saat dipersoalkan", () => {
  it("alasan dibuang ketika ditandai hadir", async () => {
    // Alasan ketidakhadiran pada orang yang justru datang adalah keterangan
    // yang bertentangan dengan dirinya sendiri.
    await simpanKehadiran(db!, {
      ...pertemuan,
      tanggalPertemuan: "2026-09-07",
      oleh: "Panitera Uji",
      isian: [{ kedudukan: "penggugat", hadir: true, nama: "Karmila", alasan: "sakit" }],
    });

    const hasil = await bacaKehadiran(db!, "M-1", "2026-09-07");
    const penggugat = hasil.baris.find((x) => x.kedudukan === "penggugat")!;
    expect(penggugat.hadir).toBe(true);
    expect(penggugat.alasan).toBe("");
    expect(penggugat.nama).toBe("Karmila");
  });

  it("menyimpan dua kali tidak menghasilkan dua baris yang bertentangan", async () => {
    const isian = [{ kedudukan: "penggugat", hadir: true, nama: "Karmila" }];
    await simpanKehadiran(db!, {
      ...pertemuan,
      tanggalPertemuan: "2026-09-07",
      oleh: "Panitera Uji",
      isian,
    });
    await simpanKehadiran(db!, {
      ...pertemuan,
      tanggalPertemuan: "2026-09-07",
      oleh: "Panitera Uji",
      isian: [{ kedudukan: "penggugat", hadir: false, alasan: "keliru dicatat" }],
    });

    const hasil = await bacaKehadiran(db!, "M-1", "2026-09-07");
    const penggugat = hasil.baris.filter((x) => x.kedudukan === "penggugat");
    expect(penggugat).toHaveLength(1);
    expect(penggugat[0].hadir).toBe(false);
    expect(penggugat[0].alasan).toBe("keliru dicatat");
  });

  it("pertemuan pada tanggal berbeda dicatat terpisah", async () => {
    // Satu mediasi dapat berlangsung beberapa pertemuan, dan kehadirannya
    // berbeda tiap kali. Menyatukannya menghapus riwayat yang justru dicari.
    await simpanKehadiran(db!, {
      ...pertemuan,
      tanggalPertemuan: "2026-09-07",
      oleh: "Panitera Uji",
      isian: [{ kedudukan: "tergugat", hadir: false, alasan: "tidak hadir" }],
    });
    await simpanKehadiran(db!, {
      ...pertemuan,
      tanggalPertemuan: "2026-09-14",
      oleh: "Panitera Uji",
      isian: [{ kedudukan: "tergugat", hadir: true, nama: "Andika" }],
    });

    const pertama = await bacaKehadiran(db!, "M-1", "2026-09-07");
    const kedua = await bacaKehadiran(db!, "M-1", "2026-09-14");
    expect(pertama.baris.find((x) => x.kedudukan === "tergugat")!.hadir).toBe(false);
    expect(kedua.baris.find((x) => x.kedudukan === "tergugat")!.hadir).toBe(true);
  });

  it("nama pencatat tersimpan - tanpa itu catatannya tidak dapat ditelusuri", async () => {
    await simpanKehadiran(db!, {
      ...pertemuan,
      tanggalPertemuan: "2026-09-07",
      oleh: "Sri Susilowati, S.H.",
      isian: [{ kedudukan: "penggugat", hadir: true }],
    });
    const hasil = await bacaKehadiran(db!, "M-1", "2026-09-07");
    expect(hasil.baris.find((x) => x.kedudukan === "penggugat")!.dicatatOleh).toBe(
      "Sri Susilowati, S.H."
    );
  });
});

describe("kedudukan asing ditolak, bukan didiamkan", () => {
  it("kunci di luar keempatnya tidak tersimpan dan sebabnya disebutkan", async () => {
    // Nilai yang tidak dikenali dan tersimpan diam-diam akan muncul kembali
    // sebagai baris yang tidak dapat dibaca layar mana pun.
    const hasil = await simpanKehadiran(db!, {
      ...pertemuan,
      tanggalPertemuan: "2026-09-07",
      oleh: "Panitera Uji",
      isian: [
        { kedudukan: "turut_tergugat", hadir: true },
        { kedudukan: "penggugat", hadir: true },
      ],
    });

    expect(hasil.jumlahDisimpan).toBe(1);
    expect(hasil.ditolak).toHaveLength(1);
    expect(hasil.ditolak[0].kedudukan).toBe("turut_tergugat");
    expect(hasil.ditolak[0].sebab).toContain("tidak dikenali");
  });

  it("tanpa mediasiId ditolak seluruhnya", async () => {
    const hasil = await simpanKehadiran(db!, {
      mediasiId: "",
      tanggalPertemuan: "2026-09-07",
      oleh: "Panitera Uji",
      isian: [{ kedudukan: "penggugat", hadir: true }],
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.jumlahDisimpan).toBe(0);
  });
});

describe("ringkasan untuk banyak pertemuan sekaligus", () => {
  it("memisahkan yang hadir dari yang tidak", async () => {
    await simpanKehadiran(db!, {
      ...pertemuan,
      tanggalPertemuan: "2026-09-07",
      oleh: "Panitera Uji",
      isian: [
        { kedudukan: "penggugat", hadir: true },
        { kedudukan: "tergugat", hadir: false, alasan: "tidak hadir" },
      ],
    });

    const ringkas = await ringkasKehadiranBanyak(db!, ["M-1", "M-tidak-ada"]);
    expect(ringkas["M-1"].hadir).toEqual(["penggugat"]);
    expect(ringkas["M-1"].tidakHadir).toEqual(["tergugat"]);
    // Pertemuan yang belum pernah dicatat tidak punya baris sama sekali -
    // berbeda dari yang dicatat sebagai tidak hadir.
    expect(ringkas["M-tidak-ada"]).toBeUndefined();
  });

  it("daftar kosong tidak menembak basis data", async () => {
    expect(await ringkasKehadiranBanyak(db!, [])).toEqual({});
  });
});
