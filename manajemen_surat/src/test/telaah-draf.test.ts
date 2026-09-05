import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { bacaDraf, tandatanganiDraf } from "@/server/modules/aleta-ecourt/perakit-putusan";
import {
  butirTelaah,
  naskahDiterima,
  ringkasTelaah,
  telaahButir,
  terimaSisanya,
} from "@/server/modules/aleta-ecourt/telaah-draf";

/**
 * Telaah draf per bagian (H3).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Satu hal: telaah harus MENGUBAH SYARAT, bukan sekadar menampilkan tombol.
 *
 * "Terima" dan "tolak" pada tiap alinea tidak berarti apa-apa selama draf yang
 * belum ditelaah tetap dapat ditandatangani. Ia akan dilewati pada hari kedua,
 * dan sesudah itu jejaknya menyebut "ditelaah" untuk naskah yang tidak pernah
 * dibaca - lebih buruk daripada tidak ada tombolnya sama sekali.
 *
 * Yang kedua: jalan pintas boleh ada, tetapi harus mengaku dirinya jalan
 * pintas. "Diterima" hasil sekali tekan tidak boleh terbaca sama dengan
 * "diterima" hasil membaca alineanya.
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

const DRAF = "d1";
const SEKARANG = new Date().toISOString();

async function tanamDraf(basis: AletaDatabase, jumlahButir = 2, siap = 1) {
  await basis.run(
    `INSERT INTO aleta_putusan_draf
       (id, perkara_id, nomor_perkara, versi, jenis_naskah, keadaan, naskah, siap, dibuat_oleh, dibuat_at, diubah_at)
     VALUES (?, '10401', '545/Pdt.G/2026/PA.Dgl', 1, 'PUTUSAN', 'draf', 'naskah', ?, 'aktor', ?, ?)`,
    [DRAF, siap, SEKARANG, SEKARANG]
  );
  for (let nomor = 0; nomor < jumlahButir; nomor += 1) {
    await basis.run(
      `INSERT INTO aleta_putusan_draf_butir
         (id, draf_id, kunci_bagian, butir_id, urutan, teks_saat_itu, versi_butir, alasan)
       VALUES (?, ?, 'pertimbangan', ?, ?, ?, 1, '[]')`,
      [`baris-${nomor}`, DRAF, `b${nomor}`, nomor, `Menimbang, bahwa alinea ke-${nomor + 1};`]
    );
  }
}

describe("keadaan awal", () => {
  it("butir yang baru dirakit bertanda belum ditelaah", async () => {
    const basis = await basisData();
    await tanamDraf(basis);
    const ringkas = ringkasTelaah(await butirTelaah(basis, DRAF));
    expect(ringkas.belum).toBe(2);
    expect(ringkas.selesai).toBe(false);
  });

  it("draf tanpa satu pun butir TIDAK dihitung selesai ditelaah", async () => {
    // Draf berpertimbangan kosong bukan draf yang "sudah selesai ditelaah";
    // membacanya sebagai selesai akan meloloskannya ke tanda tangan.
    const basis = await basisData();
    await tanamDraf(basis, 0);
    expect(ringkasTelaah(await butirTelaah(basis, DRAF)).selesai).toBe(false);
  });
});

describe("menelaah satu alinea", () => {
  it("menerima mencatat siapa yang memutuskan", async () => {
    const basis = await basisData();
    await tanamDraf(basis);
    expect((await telaahButir(basis, { drafId: DRAF, barisId: "baris-0", keadaan: "diterima", oleh: "Hakim A" })).ok).toBe(true);

    const butir = await butirTelaah(basis, DRAF);
    expect(butir[0].keadaan).toBe("diterima");
    expect(butir[0].diputusOleh).toBe("Hakim A");
    expect(butir[0].sekaligus).toBe(false);
  });

  it("menolak WAJIB beralasan", async () => {
    // Penolakan tanpa alasan tidak dapat dibaca ulang - dan yang paling sering
    // membacanya adalah hakim itu sendiri, saat perkara serupa datang.
    const basis = await basisData();
    await tanamDraf(basis);
    const tanpa = await telaahButir(basis, { drafId: DRAF, barisId: "baris-0", keadaan: "ditolak", oleh: "Hakim A" });
    expect(tanpa.ok).toBe(false);
    expect(tanpa.sebab).toContain("beralasan");

    const dengan = await telaahButir(basis, {
      drafId: DRAF,
      barisId: "baris-0",
      keadaan: "ditolak",
      oleh: "Hakim A",
      alasan: "tidak sesuai fakta perkara ini",
    });
    expect(dengan.ok).toBe(true);
    expect((await butirTelaah(basis, DRAF))[0].alasanTolak).toBe("tidak sesuai fakta perkara ini");
  });

  it("nama penelaah wajib disebut", async () => {
    const basis = await basisData();
    await tanamDraf(basis);
    const hasil = await telaahButir(basis, { drafId: DRAF, barisId: "baris-0", keadaan: "diterima", oleh: "  " });
    expect(hasil.ok).toBe(false);
  });

  it("butir yang ditolak TIDAK dihapus", async () => {
    // Penolakan adalah keputusan, dan keputusan adalah bagian dari jejak.
    const basis = await basisData();
    await tanamDraf(basis);
    await telaahButir(basis, {
      drafId: DRAF,
      barisId: "baris-0",
      keadaan: "ditolak",
      oleh: "Hakim A",
      alasan: "keliru",
    });
    expect(await butirTelaah(basis, DRAF)).toHaveLength(2);
  });

  it("baris milik draf lain tidak dapat ditelaah dari sini", async () => {
    const basis = await basisData();
    await tanamDraf(basis);
    const hasil = await telaahButir(basis, {
      drafId: DRAF,
      barisId: "baris-milik-draf-lain",
      keadaan: "diterima",
      oleh: "Hakim A",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("tidak ditemukan");
  });
});

describe("menerima sisanya sekaligus", () => {
  it("hanya menyentuh yang belum ditelaah", async () => {
    // Menimpanya akan menghapus penolakan yang sengaja diberikan hakim
    // beberapa saat sebelumnya.
    const basis = await basisData();
    await tanamDraf(basis, 3);
    await telaahButir(basis, {
      drafId: DRAF,
      barisId: "baris-0",
      keadaan: "ditolak",
      oleh: "Hakim A",
      alasan: "keliru",
    });

    const hasil = await terimaSisanya(basis, { drafId: DRAF, oleh: "Hakim A" });
    expect(hasil.jumlah).toBe(2);

    const butir = await butirTelaah(basis, DRAF);
    expect(butir[0].keadaan).toBe("ditolak");
    expect(butir[0].alasanTolak).toBe("keliru");
  });

  it("yang diterima sekaligus DITANDAI sekaligus", async () => {
    // Jejaknya tidak boleh mengaku telaah alinea demi alinea untuk keputusan
    // yang diambil sekali tekan.
    const basis = await basisData();
    await tanamDraf(basis, 2);
    await terimaSisanya(basis, { drafId: DRAF, oleh: "Hakim A" });

    const ringkas = ringkasTelaah(await butirTelaah(basis, DRAF));
    expect(ringkas.diterima).toBe(2);
    expect(ringkas.diterimaSekaligus).toBe(2);
    expect(ringkas.selesai).toBe(true);
  });

  it("yang ditelaah satu per satu tidak terhitung sekaligus", async () => {
    const basis = await basisData();
    await tanamDraf(basis, 2);
    await telaahButir(basis, { drafId: DRAF, barisId: "baris-0", keadaan: "diterima", oleh: "Hakim A" });
    await terimaSisanya(basis, { drafId: DRAF, oleh: "Hakim A" });

    const ringkas = ringkasTelaah(await butirTelaah(basis, DRAF));
    expect(ringkas.diterima).toBe(2);
    expect(ringkas.diterimaSekaligus).toBe(1);
  });
});

describe("telaah mengubah syarat tanda tangan", () => {
  it("draf yang siap tetapi BELUM ditelaah tidak dapat ditandatangani", async () => {
    // Inilah yang membedakan telaah dari hiasan.
    const basis = await basisData();
    await tanamDraf(basis, 2);
    const hasil = await tandatanganiDraf(basis, { drafId: DRAF, olehNama: "Dra. Siti Zubaidah, M.H." });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("belum ditelaah");
  });

  it("sesudah seluruhnya ditelaah, tanda tangan diterima", async () => {
    const basis = await basisData();
    await tanamDraf(basis, 2);
    await terimaSisanya(basis, { drafId: DRAF, oleh: "Dra. Siti Zubaidah, M.H." });
    expect((await tandatanganiDraf(basis, { drafId: DRAF, olehNama: "Dra. Siti Zubaidah, M.H." })).ok).toBe(true);
    expect((await bacaDraf(basis, DRAF))?.keadaan).toBe("ditandatangani");
  });

  it("draf yang seluruh alineanya DITOLAK tetap tidak dapat ditandatangani kosong", async () => {
    // Bukan karena telaahnya belum selesai - ia selesai - melainkan karena
    // pertimbangan yang tersisa kosong. Dijaga di tempat lain, dan uji ini
    // memastikan keduanya tidak saling meniadakan.
    const basis = await basisData();
    await tanamDraf(basis, 1);
    await telaahButir(basis, {
      drafId: DRAF,
      barisId: "baris-0",
      keadaan: "ditolak",
      oleh: "Hakim A",
      alasan: "keliru",
    });
    expect(ringkasTelaah(await butirTelaah(basis, DRAF)).selesai).toBe(true);
    expect(naskahDiterima(await butirTelaah(basis, DRAF))).toBe("");
  });

  it("draf yang sudah ditandatangani tidak dapat ditelaah lagi", async () => {
    // Mengubah butirnya berarti mengubah naskah yang sudah bertanda tangan.
    const basis = await basisData();
    await tanamDraf(basis, 2);
    await terimaSisanya(basis, { drafId: DRAF, oleh: "Hakim A" });
    await tandatanganiDraf(basis, { drafId: DRAF, olehNama: "Hakim A" });

    const hasil = await telaahButir(basis, {
      drafId: DRAF,
      barisId: "baris-0",
      keadaan: "ditolak",
      oleh: "Hakim A",
      alasan: "berubah pikiran",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("sudah ditandatangani");
  });
});

describe("naskah yang disetujui", () => {
  it("hanya memuat alinea yang diterima, menurut urutannya", () => {
    const butir = [
      { id: "b", butirId: "", urutan: 1, teks: "kedua", versi: 1, alasan: [], keadaan: "diterima" as const, diputusOleh: "A", alasanTolak: "", diputusAt: "", sekaligus: false },
      { id: "a", butirId: "", urutan: 0, teks: "pertama", versi: 1, alasan: [], keadaan: "diterima" as const, diputusOleh: "A", alasanTolak: "", diputusAt: "", sekaligus: false },
      { id: "c", butirId: "", urutan: 2, teks: "ditolak", versi: 1, alasan: [], keadaan: "ditolak" as const, diputusOleh: "A", alasanTolak: "keliru", diputusAt: "", sekaligus: false },
    ];
    expect(naskahDiterima(butir)).toBe("pertama\n\nkedua");
  });
});
