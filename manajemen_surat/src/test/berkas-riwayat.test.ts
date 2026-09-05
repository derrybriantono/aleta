import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  bandingkanRiwayat,
  catatRiwayat,
  ringkasBerkas,
  riwayatPerkara,
  sidikRingkasan,
} from "@/server/modules/aleta-ecourt/berkas-riwayat";
import { PENARIK, halanganPenarik } from "@/server/modules/aleta-ecourt/penarik";
import type { Bagian, BerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";

/**
 * Riwayat berkas perkara dan bentuk baku penarik.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Riwayat menjawab satu pertanyaan: "apa yang tercatat waktu itu?" - dan itu
 * yang membuktikan BAS yang menyebut dua saksi memang benar pada saat
 * ditandatangani, meski SIPP kini memuat empat.
 *
 * Dua kekeliruan yang membuatnya tidak berguna, dan keduanya diam:
 *
 *   - riwayat yang mencatat tiap PEMBUKAAN, bukan tiap perubahan, sehingga
 *     penuh salinan yang sama dan tidak dapat dibaca; dan
 *   - waktu pengambilan ikut disidik, sehingga tiap perakitan menghasilkan
 *     sidik baru dan penjagaan di atas menjadi tidak berarti sama sekali.
 */

let db: AletaDatabase | null = null;

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  return db;
}

function bagian<T>(nilai: T, ada = true): Bagian<T> {
  return { ada, nilai, asal: { sistem: "SIPP", sumber: "uji", diambil: "2026-09-05T00:00:00.000Z" }, galat: "" };
}

function berkas(sebagian: Partial<BerkasPerkara> = {}): BerkasPerkara {
  return {
    ok: true,
    nomorPerkara: "551/Pdt.G/2026/PA.Dgl",
    perkaraId: "10102",
    dirakitPada: "2026-09-05T00:00:00.000Z",
    identitas: bagian<Record<string, unknown> | null>({ tahapan: "Persidangan" }),
    paraPihak: bagian<unknown[]>([{ name: "A" }, { name: "B" }]),
    majelis: bagian<unknown[]>([{ name: "H1" }]),
    panitera: bagian<unknown[]>([{ name: "P1" }]),
    jurusita: bagian<unknown[]>([]),
    riwayatSidang: bagian<unknown[]>([{ sidangKe: 1 }]),
    saksiTercatat: bagian<unknown[]>([]),
    pemeriksaanSaksi: bagian<Record<string, unknown> | null>({ jumlahSaksi: 2 }),
    dokumenECourt: bagian<Record<string, unknown> | null>(null, false),
    putusan: bagian<Record<string, unknown> | null>(null, false),
    pertimbangan: bagian<Record<string, unknown> | null>(null, false),
    selisih: [],
    halangan: [],
    ...sebagian,
  };
}

afterEach(async () => {
  await db?.close();
  db = null;
});

describe("meringkas keadaan", () => {
  it("waktu pengambilan TIDAK ikut disidik", () => {
    // Kalau waktu ikut disidik, tiap perakitan menghasilkan sidik baru dan
    // penjagaan "hanya perubahan yang disimpan" tidak berarti sama sekali.
    const pagi = ringkasBerkas(berkas({ dirakitPada: "2026-09-05T01:00:00.000Z" }));
    const sore = ringkasBerkas(berkas({ dirakitPada: "2026-09-05T09:00:00.000Z" }));
    expect(sidikRingkasan(pagi)).toBe(sidikRingkasan(sore));
  });

  it("jumlah tiap bagian terbaca, termasuk saksi yang diperiksa ABT", () => {
    const ringkas = ringkasBerkas(berkas());
    expect(ringkas.jumlah.paraPihak).toBe(2);
    expect(ringkas.jumlah.saksiDiperiksa).toBe(2);
    expect(ringkas.ada.pertimbangan).toBe(false);
  });

  it("keadaan yang berbeda menghasilkan sidik yang berbeda", () => {
    const semula = ringkasBerkas(berkas());
    const bertambah = ringkasBerkas(berkas({ saksiTercatat: bagian<unknown[]>([{ name: "S1" }]) }));
    expect(sidikRingkasan(semula)).not.toBe(sidikRingkasan(bertambah));
  });
});

describe("mencatat riwayat", () => {
  it("keadaan pertama tercatat", async () => {
    const database = await basisData();
    expect(await catatRiwayat(database, berkas(), "uji")).not.toBeNull();
    expect(await riwayatPerkara(database, "10102")).toHaveLength(1);
  });

  it("keadaan yang sama TIDAK menambah baris", async () => {
    // Perkara yang dibuka dua puluh kali sehari meninggalkan satu baris, bukan
    // dua puluh - riwayat penuh salinan yang sama tidak dapat dibaca.
    const database = await basisData();
    await catatRiwayat(database, berkas(), "uji");
    expect(await catatRiwayat(database, berkas({ dirakitPada: "2026-09-05T10:00:00.000Z" }), "uji")).toBeNull();
    expect(await riwayatPerkara(database, "10102")).toHaveLength(1);
  });

  it("keadaan yang berubah menambah baris", async () => {
    const database = await basisData();
    await catatRiwayat(database, berkas(), "uji");
    await catatRiwayat(
      database,
      berkas({ dirakitPada: "2026-09-06T00:00:00.000Z", saksiTercatat: bagian<unknown[]>([{ name: "S1" }]) }),
      "uji"
    );
    expect(await riwayatPerkara(database, "10102")).toHaveLength(2);
  });

  it("berkas yang gagal dirakit tidak dicatat", async () => {
    // Mencatatnya berarti riwayat memuat keadaan "semua kosong" yang tidak
    // pernah benar - hanya menandakan sumbernya sedang mati.
    const database = await basisData();
    expect(await catatRiwayat(database, berkas({ ok: false }), "uji")).toBeNull();
    expect(await catatRiwayat(database, berkas({ perkaraId: "" }), "uji")).toBeNull();
  });

  it("riwayat terbaru berdiri lebih dulu", async () => {
    const database = await basisData();
    await catatRiwayat(database, berkas(), "uji");
    await catatRiwayat(
      database,
      berkas({ dirakitPada: "2026-09-07T00:00:00.000Z", saksiTercatat: bagian<unknown[]>([{ name: "S1" }]) }),
      "uji"
    );

    const riwayat = await riwayatPerkara(database, "10102");
    expect(riwayat[0].dirakitAt).toBe("2026-09-07T00:00:00.000Z");
  });
});

describe("membandingkan dua keadaan", () => {
  it("perubahan jumlah disebut dengan nama bagian dalam bahasa sehari-hari", () => {
    const lama = ringkasBerkas(berkas());
    const baru = ringkasBerkas(berkas({ saksiTercatat: bagian<unknown[]>([{ name: "S1" }, { name: "S2" }]) }));

    const perubahan = bandingkanRiwayat(lama, baru);
    const saksi = perubahan.find((item) => item.hal === "Saksi tercatat");
    expect(saksi).toEqual({ hal: "Saksi tercatat", dari: "0", menjadi: "2" });
  });

  it("bagian yang berubah dari belum ada menjadi ada terbaca", () => {
    const lama = ringkasBerkas(berkas());
    const baru = ringkasBerkas(berkas({ pertimbangan: bagian<Record<string, unknown> | null>({ panjangHuruf: 900 }) }));

    expect(bandingkanRiwayat(lama, baru)).toContainEqual({
      hal: "Pertimbangan hukum",
      dari: "belum ada",
      menjadi: "ada",
    });
  });

  it("yang tidak berubah TIDAK disebut", () => {
    // Menampilkan seluruh medan beserta yang tidak berubah menjadikan perubahan
    // yang sesungguhnya tenggelam.
    expect(bandingkanRiwayat(ringkasBerkas(berkas()), ringkasBerkas(berkas()))).toEqual([]);
  });

  it("selisih yang muncul dan yang hilang keduanya dilaporkan", () => {
    const lama = ringkasBerkas(berkas());
    const baru = ringkasBerkas(
      berkas({ selisih: [{ hal: "Jumlah saksi", menurut: [], keterangan: "" }] })
    );

    expect(bandingkanRiwayat(lama, baru)).toContainEqual({
      hal: "Selisih: Jumlah saksi",
      dari: "tidak ada",
      menjadi: "muncul",
    });
    expect(bandingkanRiwayat(baru, lama)).toContainEqual({
      hal: "Selisih: Jumlah saksi",
      dari: "ada",
      menjadi: "hilang",
    });
  });
});

describe("bentuk baku penarik", () => {
  it("tiap penarik menyatakan seluruh keterangannya", () => {
    // Bentuknya menuntut seluruh medan, sehingga satu baris yang kurang lengkap
    // tidak dapat lolos.
    for (const penarik of PENARIK) {
      expect(penarik.kunci, "kunci kosong").toBeTruthy();
      expect(penarik.operasi, `${penarik.kunci}: operasi kosong`).toBeTruthy();
      expect(penarik.sumber, `${penarik.kunci}: sumber kosong`).toBeTruthy();
      expect(["SIPP", "e-Court", "APS Badilag", "ALETA"]).toContain(penarik.sistem);
    }
  });

  it("tidak ada nama medan yang terdaftar dua kali", () => {
    const kunci = PENARIK.map((item) => item.kunci);
    expect(new Set(kunci).size).toBe(kunci.length);
  });

  it("hanya sumber yang ketiadaannya menghalangi yang diwartakan", () => {
    // Jurusita yang belum ditunjuk adalah keadaan biasa, bukan halangan - dan
    // daftar halangan yang selalu berisi berhenti dibaca.
    const jurusita = PENARIK.find((item) => item.kunci === "jurusita");
    const identitas = PENARIK.find((item) => item.kunci === "identitas");
    expect(jurusita?.wartakanGagal).toBe(false);
    expect(identitas?.wartakanGagal).toBe(true);
  });

  it("halangan menyebut sistem dan tabelnya, bukan hanya kata gagal", () => {
    const gagal = {
      identitas: { ada: false, nilai: null, asal: { sistem: "SIPP" as const, sumber: "perkara", diambil: "" }, galat: "sambungan putus" },
      jurusita: { ada: false, nilai: [], asal: { sistem: "SIPP" as const, sumber: "perkara_jurusita", diambil: "" }, galat: "sambungan putus" },
    };

    const halangan = halanganPenarik(gagal);
    expect(halangan).toHaveLength(1);
    expect(halangan[0]).toContain("SIPP - perkara");
    expect(halangan[0]).toContain("sambungan putus");
  });
});
