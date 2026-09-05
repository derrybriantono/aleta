import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  catatSidik,
  daftarAturan,
  matikanAturan,
  periksa,
  perkaraSerupa,
  sahkanAturan,
  simpanAturan,
} from "@/server/modules/aleta-ecourt/aturan-pemeriksaan";
import {
  bekukanDasar,
  dasarDraf,
  halanganKutipan,
  rujukanButirDipakai,
  simpanDasar,
  susunJejak,
} from "@/server/modules/aleta-ecourt/penjagaan-putusan";

/**
 * Aturan pemeriksaan (G) dan penjagaan (J1, J3, J4) di basis data.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Empat hal, dan tiga di antaranya adalah penolakan:
 *
 *   - aturan tidak dapat lahir aktif, dan tidak dapat disahkan atas dasar
 *     pasal yang belum dimuat;
 *   - draf yang rujukannya tidak terbukti tidak dapat dinyatakan siap; dan
 *   - draf yang mengutip peraturan yang sudah DICABUT juga tertahan, meskipun
 *     bunyi pasalnya masih ada dan masih benar.
 *
 * Yang keempat: jejak harus dapat menjawab tiga pertanyaan tanpa membuka apa
 * pun selain dirinya - alinea dari butir mana, nilai dari sistem mana, pasal
 * versi berapa.
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

const SEKARANG = new Date().toISOString();

/**
 * jlf_regulations menuntut jenis peraturan yang sudah ada.
 *
 * Jenisnya SUDAH ditanam skema (jlf-regtype-uu dan seterusnya), jadi yang
 * dikerjakan di sini hanya mencarinya - bukan membuatnya. Percobaan pertama
 * membuat baris baru bernama sama dan tertolak kunci unik pada `code`, yang
 * terbaca seperti kegagalan modul padahal kegagalan penolong uji.
 */
async function jenisPeraturan(basis: AletaDatabase): Promise<string> {
  const ada = await basis.queryOne<Record<string, unknown>>(
    `SELECT id FROM jlf_regulation_types WHERE code = 'UU'`
  );
  if (ada) return String(ada.id);

  await basis.run(
    `INSERT INTO jlf_regulation_types (id, code, name, hierarchy_level, created_at, updated_at)
     VALUES ('jlf-regtype-uu', 'UU', 'Undang-Undang', 30, ?, ?)`,
    [SEKARANG, SEKARANG]
  );
  return "jlf-regtype-uu";
}

async function tanamPeraturan(
  basis: AletaDatabase,
  id: string,
  jangkar: string,
  pilihan: { berlaku?: string; dicabut?: string } = {}
) {
  const jenisId = await jenisPeraturan(basis);
  await basis.run(
    `INSERT INTO jlf_regulations
       (id, regulation_type_id, title, regulation_number, regulation_year, status,
        effective_date, revoked_at, created_at, updated_at)
     VALUES (?, ?, ?, '7', 1989, 'published', ?, ?, ?, ?)`,
    [id, jenisId, `Peraturan ${id}`, pilihan.berlaku ?? "1989-12-29", pilihan.dicabut ?? null, SEKARANG, SEKARANG]
  );
  await basis.run(
    `INSERT INTO jlf_regulation_sections
       (id, regulation_id, section_type, section_number, anchor, title, content, sort_order, created_at, updated_at)
     VALUES (?, ?, 'pasal', '49', ?, '', 'bunyi pasalnya', 1, ?, ?)`,
    [`${id}-bagian`, id, jangkar, SEKARANG, SEKARANG]
  );
}

async function tanamButirBerujukan(basis: AletaDatabase, butirId: string, jangkar: string, tertulis: string) {
  await basis.run(
    `INSERT INTO aleta_pertimbangan_butir
       (id, sidik, teks, jenis_perkara, isu, syarat, jumlah_pemakaian, keadaan, atas_perintah, versi, dibuat_at, diubah_at)
     VALUES (?, ?, ?, 'Cerai Gugat', 'maksud', '{}', 5, 'disahkan', 'Ketua', 1, ?, ?)`,
    [butirId, `sidik-${butirId}`, `Menimbang, bahwa ${tertulis};`, SEKARANG, SEKARANG]
  );
  await basis.run(
    `INSERT INTO aleta_pertimbangan_rujukan (id, butir_id, tertulis, pasal, ayat, huruf, peraturan, jangkar)
     VALUES (?, ?, ?, '49', '', '', 'Undang-Undang', ?)`,
    [`${butirId}-r`, butirId, tertulis, jangkar]
  );
}

// ── Aturan pemeriksaan ─────────────────────────────────────────────────────

describe("aturan pemeriksaan", () => {
  const contoh = {
    kode: "G1-absolut",
    kelompok: "kompetensi" as const,
    hal: "Kewenangan absolut",
    jenis: "nilaiSama" as const,
    fakta: "agamaPenggugat",
    pembanding: "Islam",
    tingkat: "halangan" as const,
    tindakan: "Periksa kewenangan pengadilan.",
    jangkar: "uu-7-1989/pasal-49",
  };

  it("aturan tanpa jangkar DITOLAK saat disimpan", () => {
    // Aturan tanpa dasar tidak memutuskan apa pun; menyimpannya hanya menunda
    // penolakan ke saat ia dijalankan, jauh dari orang yang tahu maksudnya.
    return basisData().then(async (basis) => {
      const hasil = await simpanAturan(basis, "aktor", { ...contoh, jangkar: "" });
      expect(hasil.ok).toBe(false);
      expect(hasil.sebab).toContain("jangkar");
    });
  });

  it("aturan baru selalu TIDAK aktif", async () => {
    // Aturan yang lahir aktif akan dibuat pada hari yang sibuk oleh orang yang
    // yakin, dan keyakinan itu tidak tercatat di mana pun.
    const basis = await basisData();
    await simpanAturan(basis, "aktor", contoh);
    const daftar = await daftarAturan(basis);
    expect(daftar[0].aktif).toBe(false);
  });

  it("kode yang sama tidak dapat dipakai dua kali", async () => {
    const basis = await basisData();
    await simpanAturan(basis, "aktor", contoh);
    const ulang = await simpanAturan(basis, "aktor", contoh);
    expect(ulang.ok).toBe(false);
    expect(ulang.sebab).toContain("sudah dipakai");
  });

  it("pengesahan menuntut atas perintah siapa", async () => {
    const basis = await basisData();
    await simpanAturan(basis, "aktor", contoh);
    const hasil = await sahkanAturan(basis, "aktor", { kode: contoh.kode, atasPerintah: "  " });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("atas perintah");
  });

  it("pengesahan DITOLAK bila pasalnya belum ada di pustaka", async () => {
    const basis = await basisData();
    await simpanAturan(basis, "aktor", contoh);
    const hasil = await sahkanAturan(basis, "aktor", { kode: contoh.kode, atasPerintah: "Ketua Pengadilan" });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("belum ada di pustaka");
  });

  it("pengesahan berhasil bila pasalnya ada, dan mencatat kedua namanya", async () => {
    const basis = await basisData();
    await tanamPeraturan(basis, "reg-1", contoh.jangkar);
    await simpanAturan(basis, "aktor", contoh);
    expect((await sahkanAturan(basis, "aktor", { kode: contoh.kode, atasPerintah: "Ketua Pengadilan" })).ok).toBe(true);

    const aturan = (await daftarAturan(basis))[0];
    expect(aturan.aktif).toBe(true);
    expect(aturan.disahkanOleh).toBe("aktor");
    expect(aturan.atasPerintah).toBe("Ketua Pengadilan");
  });

  it("mematikan aturan menuntut alasan", async () => {
    const basis = await basisData();
    await tanamPeraturan(basis, "reg-1", contoh.jangkar);
    await simpanAturan(basis, "aktor", contoh);
    await sahkanAturan(basis, "aktor", { kode: contoh.kode, atasPerintah: "Ketua" });

    expect((await matikanAturan(basis, { kode: contoh.kode, alasan: "" })).ok).toBe(false);
    expect((await matikanAturan(basis, { kode: contoh.kode, alasan: "keliru rujukan" })).ok).toBe(true);
    expect((await daftarAturan(basis))[0].aktif).toBe(false);
  });

  it("hanya aturan aktif yang dijalankan", async () => {
    const basis = await basisData();
    await tanamPeraturan(basis, "reg-1", contoh.jangkar);
    await simpanAturan(basis, "aktor", contoh);

    const belum = await periksa(basis, "Cerai Gugat", { agamaPenggugat: "Islam" });
    expect(belum.hasil).toEqual([]);
    expect(belum.kompetensi.boleh).toBe(false);

    await sahkanAturan(basis, "aktor", { kode: contoh.kode, atasPerintah: "Ketua" });
    const sudah = await periksa(basis, "Cerai Gugat", { agamaPenggugat: "Islam" });
    expect(sudah.hasil[0].keadaan).toBe("terpenuhi");
    expect(sudah.kompetensi.boleh).toBe(true);
  });

  it("jangkar diperiksa SAAT DIJALANKAN, bukan dipercaya dari pengesahan", async () => {
    // Peraturan dapat dicabut sesudah aturan disahkan, dan pemeriksaan yang
    // berjalan atas dasar hukum yang sudah tidak ada tidak menghasilkan galat.
    const basis = await basisData();
    await tanamPeraturan(basis, "reg-1", contoh.jangkar);
    await simpanAturan(basis, "aktor", contoh);
    await sahkanAturan(basis, "aktor", { kode: contoh.kode, atasPerintah: "Ketua" });

    await basis.run(`DELETE FROM jlf_regulation_sections WHERE anchor = ?`, [contoh.jangkar]);
    const hasil = await periksa(basis, "Cerai Gugat", { agamaPenggugat: "Islam" });
    expect(hasil.hasil[0].keadaan).toBe("dasarBelumAda");
    expect(hasil.kompetensi.boleh).toBe(false);
  });
});

// ── J1 kutipan wajib terbukti ──────────────────────────────────────────────

describe("kutipan wajib terbukti", () => {
  it("rujukan yang jangkarnya ada dinyatakan terbukti, beserta tanggal berlakunya", async () => {
    const basis = await basisData();
    await tanamPeraturan(basis, "reg-1", "uu-7-1989/pasal-49", { berlaku: "1989-12-29" });
    await tanamButirBerujukan(basis, "b1", "uu-7-1989/pasal-49", "Pasal 49 Undang-Undang Nomor 7 tahun 1989");

    const hasil = await bekukanDasar(basis, await rujukanButirDipakai(basis, ["b1"]));
    expect(hasil.dasar[0].terbukti).toBe(true);
    expect(hasil.dasar[0].versiPeraturan).toBe("1989-12-29");
    expect(halanganKutipan(hasil)).toEqual([]);
  });

  it("rujukan yang jangkarnya TIDAK ada menghasilkan halangan", async () => {
    // Pasal karangan tidak terlihat: ia tertulis persis seperti pasal yang
    // ada, bernomor wajar, dan dikutip dengan kalimat yang meyakinkan.
    const basis = await basisData();
    await tanamButirBerujukan(basis, "b1", "uu-99-2099/pasal-1", "Pasal 1 Undang-Undang Nomor 99 tahun 2099");

    const hasil = await bekukanDasar(basis, await rujukanButirDipakai(basis, ["b1"]));
    expect(hasil.takTerbukti).toHaveLength(1);
    expect(halanganKutipan(hasil)[0]).toContain("tidak ditemukan di pustaka hukum");
  });

  it("peraturan yang SUDAH DICABUT tertahan meski bunyi pasalnya masih ada", async () => {
    // Kekeliruan ini tidak terlihat dari naskahnya, karena bunyi pasalnya
    // memang masih ada dan masih benar.
    const basis = await basisData();
    await tanamPeraturan(basis, "reg-1", "uu-7-1989/pasal-49", { dicabut: "2006-03-20" });
    await tanamButirBerujukan(basis, "b1", "uu-7-1989/pasal-49", "Pasal 49 Undang-Undang Nomor 7 tahun 1989");

    const hasil = await bekukanDasar(basis, await rujukanButirDipakai(basis, ["b1"]));
    expect(hasil.dasar[0].terbukti).toBe(true);
    expect(hasil.dicabut).toHaveLength(1);
    expect(halanganKutipan(hasil).join(" ")).toContain("SUDAH DICABUT");
  });

  it("rujukan tanpa jangkar dibedakan dari pasal yang tidak ada", async () => {
    // Keduanya menahan draf, tetapi tindakannya berbeda: yang satu menuntut
    // peraturannya dimuat, yang lain menuntut kutipannya diperbaiki.
    const basis = await basisData();
    await tanamButirBerujukan(basis, "b1", "", "Pasal 5 Peraturan Daerah Sesuatu");

    const hasil = await bekukanDasar(basis, await rujukanButirDipakai(basis, ["b1"]));
    expect(hasil.tanpaJangkar).toHaveLength(1);
    expect(hasil.takTerbukti).toEqual([]);
    expect(halanganKutipan(hasil)[0]).toContain("belum tersambung ke pustaka");
  });

  it("rujukan kembar pada satu butir hanya dihitung sekali", async () => {
    const basis = await basisData();
    await tanamPeraturan(basis, "reg-1", "uu-7-1989/pasal-49");
    await tanamButirBerujukan(basis, "b1", "uu-7-1989/pasal-49", "Pasal 49");
    await basis.run(
      `INSERT INTO aleta_pertimbangan_rujukan (id, butir_id, tertulis, pasal, ayat, huruf, peraturan, jangkar)
       VALUES ('b1-r2', 'b1', 'Pasal 49', '49', '', '', 'Undang-Undang', 'uu-7-1989/pasal-49')`
    );
    const hasil = await bekukanDasar(basis, await rujukanButirDipakai(basis, ["b1"]));
    expect(hasil.dasar).toHaveLength(1);
  });
});

// ── J4 jejak menyeluruh ────────────────────────────────────────────────────

describe("jejak menyeluruh", () => {
  async function drafDenganJejak(basis: AletaDatabase) {
    const sekarang = new Date().toISOString();
    await basis.run(
      `INSERT INTO aleta_putusan_draf
         (id, perkara_id, nomor_perkara, versi, jenis_naskah, keadaan, naskah, siap, dibuat_oleh, dibuat_at, diubah_at)
       VALUES ('d1', '10301', '545/Pdt.G/2026/PA.Dgl', 1, 'PUTUSAN', 'draf', 'naskah', 1, 'aktor', ?, ?)`,
      [sekarang, sekarang]
    );
    await basis.run(
      `INSERT INTO aleta_putusan_draf_butir
         (id, draf_id, kunci_bagian, butir_id, urutan, teks_saat_itu, versi_butir, alasan)
       VALUES ('db1', 'd1', 'pertimbangan', 'b1', 0, 'bunyi saat itu', 1, '["jenisPerkara sesuai"]')`
    );
    await basis.run(
      `INSERT INTO aleta_putusan_draf_nilai (id, draf_id, nama, nilai, asal)
       VALUES ('dn1', 'd1', 'ketuaMajelis', 'Dra. Siti Zubaidah, M.H.', 'SIPP')`
    );
    return "d1";
  }

  it("menjawab tiga pertanyaan: butir mana, nilai dari mana, pasal versi berapa", async () => {
    const basis = await basisData();
    const drafId = await drafDenganJejak(basis);
    await simpanDasar(basis, drafId, [
      {
        butirId: "b1",
        jangkar: "uu-7-1989/pasal-49",
        tertulis: "Pasal 49",
        peraturan: "reg-1",
        versiPeraturan: "1989-12-29",
        terbukti: true,
        sudahDicabut: false,
      },
    ]);

    const jejak = await susunJejak(basis, drafId);
    expect(jejak.butir[0].butirId).toBe("b1");
    expect(jejak.butir[0].alasan).toEqual(["jenisPerkara sesuai"]);
    expect(jejak.nilai[0].asal).toBe("SIPP");
    expect(jejak.dasar[0].versiPeraturan).toBe("1989-12-29");
    expect(jejak.lubang).toEqual([]);
  });

  it("nilai tanpa asal dilaporkan sebagai lubang", async () => {
    // "Menurut sistem yang mana" selalu ditanyakan saat draf lama ditelusuri.
    const basis = await basisData();
    const drafId = await drafDenganJejak(basis);
    await basis.run(`UPDATE aleta_putusan_draf_nilai SET asal = '' WHERE draf_id = ?`, [drafId]);
    const jejak = await susunJejak(basis, drafId);
    expect(jejak.lubang.join(" ")).toContain("tanpa menyebut sistem asalnya");
  });

  it("dasar hukum yang belum dibekukan dilaporkan sebagai lubang", async () => {
    const basis = await basisData();
    const drafId = await drafDenganJejak(basis);
    const jejak = await susunJejak(basis, drafId);
    expect(jejak.lubang.join(" ")).toContain("belum dibekukan");
  });

  it("jejak draf yang tidak ada berkata tidak ada, bukan kosong", async () => {
    const basis = await basisData();
    const jejak = await susunJejak(basis, "tidak-ada");
    expect(jejak.draf).toBeNull();
    expect(jejak.lubang).toEqual(["Draf tidak ditemukan."]);
  });

  it("dasar yang tersimpan terbaca kembali beserta keadaan cabutnya", async () => {
    const basis = await basisData();
    const drafId = await drafDenganJejak(basis);
    await simpanDasar(basis, drafId, [
      {
        butirId: "b1",
        jangkar: "uu-7-1989/pasal-49",
        tertulis: "Pasal 49",
        peraturan: "reg-1",
        versiPeraturan: "berlaku 1989-12-29, dicabut 2006-03-20",
        terbukti: true,
        sudahDicabut: true,
      },
    ]);
    expect((await dasarDraf(basis, drafId))[0].sudahDicabut).toBe(true);
  });
});

// ── G5 perkara serupa di basis data ────────────────────────────────────────

describe("pencatatan pola perkara", () => {
  const fakta = { jenisPerkara: "Cerai Gugat", tergugatHadir: false, jumlahSaksi: 2, adaAnak: true };

  it("pola tersimpan dan perkara berpola sama ditemukan", async () => {
    const basis = await basisData();
    await catatSidik(basis, {
      perkaraId: "1",
      nomorPerkara: "545/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      fakta,
    });
    await catatSidik(basis, {
      perkaraId: "2",
      nomorPerkara: "120/Pdt.G/2025/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      fakta,
    });

    const hasil = await perkaraSerupa(basis, {
      perkaraId: "1",
      nomorPerkara: "545/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      fakta,
    });
    expect(hasil.serupa).toHaveLength(1);
    expect(hasil.serupa[0].perkaraId).toBe("2");
  });

  it("pola ditimpa, bukan ditumpuk, saat perkaranya berkembang", async () => {
    // Pola dari sidang pertama akan mencocokkan perkara ini dengan yang salah.
    const basis = await basisData();
    await catatSidik(basis, { perkaraId: "1", nomorPerkara: "a", jenisPerkara: "Cerai Gugat", fakta });
    await catatSidik(basis, {
      perkaraId: "1",
      nomorPerkara: "a",
      jenisPerkara: "Cerai Gugat",
      fakta: { ...fakta, jumlahSaksi: 3 },
    });
    const baris = await basis.queryAll<Record<string, unknown>>(
      `SELECT sidik FROM aleta_perkara_sidik WHERE perkara_id = '1'`
    );
    expect(baris).toHaveLength(1);
    expect(String(baris[0].sidik)).toContain("jumlahsaksi=3");
  });

  it("jenis perkara yang berbeda tidak dibandingkan", async () => {
    // Cerai gugat dan itsbat nikah berbagi banyak butir pola, dan kemiripan
    // antar jenis yang berbeda selalu menyesatkan.
    const basis = await basisData();
    await catatSidik(basis, { perkaraId: "2", nomorPerkara: "b", jenisPerkara: "Itsbat Nikah", fakta });
    const hasil = await perkaraSerupa(basis, {
      perkaraId: "1",
      nomorPerkara: "a",
      jenisPerkara: "Cerai Gugat",
      fakta,
    });
    expect(hasil.serupa).toEqual([]);
  });
});
