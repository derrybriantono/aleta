// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const panggil = vi.fn();

vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: (operasi: string, params: Record<string, unknown>) => panggil(operasi, params),
}));

const { createAletaDatabase } = await import("@/server/db/client");
type AletaDatabase = Awaited<ReturnType<typeof createAletaDatabase>>;

const { naskahDariBagian, pilihBagian } = await import("@/lib/pustaka-blangko");
const {
  daftarKelasC,
  geserSaklar,
  ringkasKelasC,
  saklarMenyala,
  terbitkanBerkas,
  terbitkanNaskah,
  turunkanDariKorpus,
  ujiKemandirian,
} = await import("@/server/modules/aleta-ecourt/blangko-aleta");
const { pelajariKorpus } = await import("@/server/modules/aleta-ecourt/korpus-blangko");
const { simpanIsian } = await import("@/server/modules/aleta-ecourt/isian-perkara");

/**
 * Pustaka blangko ALETA (Tahap 5, 6, 7).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - keadaan yang BELUM DIKETAHUI mengeluarkan bagiannya, tidak meloloskannya
 *     - menuliskan "berusaha mendamaikan" pada perkara yang kehadirannya belum
 *     tercatat berarti menuliskan peristiwa yang tidak pernah terjadi;
 *   - penomoran dihitung ulang dari yang benar-benar terpakai, tidak berlubang;
 *   - blangko boleh berdiri TANPA asal ABT - itulah kemandiriannya;
 *   - saklar periksa bawaannya MATI, dan tiap pergeserannya tercatat.
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

beforeEach(() => panggil.mockReset());

const JALUR =
  "berita_acara_sidang/1 BAS Pertama Standar/04-a. BAS Pertama P Hadir _ T Tidak Hadir - Tunda Panggil T.PA.Mj.rtf";

const SUMBER = [
  {
    jalur: JALUR,
    alinea: [
      "BERITA ACARA SIDANG",
      "Pengadilan Agama Donggala memeriksa perkara #0048# antara #0098# sebagai #0046#;",
      "Kemudian Ketua Majelis berusaha mendamaikan #0046#, namun tidak berhasil;",
      "Mahar yang diserahkan berupa #1001#;",
    ],
    penanda: ["0046", "0048", "0098", "1001"],
    besarByte: 900,
  },
];

async function tanamKamus(basis: AletaDatabase) {
  const sekarang = new Date().toISOString();
  const daftar: Array<[string, string, string, string, string, string, string]> = [
    ["0046", "Pemohon/ Penggugat", "data_sql", "select 'Penggugat' as data", "", "", "A"],
    ["0048", "Jenis Perkara", "data_sipp", "", "perkara", "jenis_perkara_nama", "A"],
    ["0098", "Nama #0046#", "data_sipp", "", "perkara_pihak1", "nama", "A"],
    ["1001", "Mas kawin", "data_teks", "", "", "", "B"],
    ["7211", "Umur Isbat P1", "", "", "", "", "C"],
  ];
  for (const [noVar, nama, jenis, sql, tabel, kolom, kelas] of daftar) {
    await basis.run(
      `INSERT INTO aleta_kamus_variabel
         (no_var, nama, jenis, sql_query, data_tabel, data_kolom, default_data,
          kelas, sebab_kelas, bersarang, jumlah_pakai, asal_skema, salin_id, dibuat_at, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, '', ?, 'uji', '', 10, 'aps_badilag', 'uji', ?, ?)`,
      [noVar, nama, jenis, sql, tabel, kolom, kelas, sekarang, sekarang]
    );
  }
}

function jembatan(jawab: Record<string, string>) {
  panggil.mockImplementation(async (operasi: string, params: Record<string, unknown>) => {
    if (operasi === "kamus.jalankanKueri") {
      const sql = String(params.sql ?? "");
      for (const [kunci, nilai] of Object.entries(jawab)) if (sql.includes(kunci)) return { ok: true, data: { ada: true, nilai } };
      return { ok: true, data: { ada: true, kosong: true, nilai: "" } };
    }
    if (operasi === "kamus.bacaKolom") {
      const nilai = jawab[`${params.tabel}.${params.kolom}`];
      if (nilai === undefined) return { ok: true, data: { ada: true, kosong: true, nilai: "" } };
      return { ok: true, data: { ada: true, nilai } };
    }
    return { ok: true, data: null };
  });
}

async function siapkan(basis: AletaDatabase) {
  await tanamKamus(basis);
  await pelajariKorpus(basis, { berkas: SUMBER, oleh: "admin" });
  return turunkanDariKorpus(basis, { jalur: JALUR, kode: "BAS-PERTAMA-01", nama: "BAS Pertama", oleh: "admin" });
}

describe("menurunkan blangko dari korpus", () => {
  it("seluruh alinea menjadi bagian, dan judul dikenali", async () => {
    const basis = await basisData();
    const hasil = await siapkan(basis);

    expect(hasil.ok).toBe(true);
    expect(hasil.jumlahBagian).toBe(4);

    const judul = await basis.queryOne<Record<string, unknown>>(
      `SELECT rata, tebal FROM aleta_blangko_bagian WHERE teks = ?`,
      ["BERITA ACARA SIDANG"]
    );
    expect(String(judul?.rata)).toBe("tengah");
    expect(Number(judul?.tebal)).toBe(1);
  });

  it("kode yang sudah dipakai ditolak", async () => {
    const basis = await basisData();
    await siapkan(basis);
    const kedua = await turunkanDariKorpus(basis, { jalur: JALUR, kode: "BAS-PERTAMA-01", nama: "x", oleh: "admin" });
    expect(kedua.ok).toBe(false);
    expect(kedua.sebab).toMatch(/sudah dipakai/i);
  });

  it("penurunan menuntut penyebutan pelakunya", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    await pelajariKorpus(basis, { berkas: SUMBER, oleh: "admin" });
    const hasil = await turunkanDariKorpus(basis, { jalur: JALUR, kode: "X", nama: "x", oleh: "" });
    expect(hasil.ok).toBe(false);
  });

  it("blangko sumber yang tidak ada di korpus ditolak", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    const hasil = await turunkanDariKorpus(basis, { jalur: "tidak-ada.rtf", kode: "X", nama: "x", oleh: "admin" });
    expect(hasil.sebab).toMatch(/tidak ada di korpus/i);
  });
});

describe("menerbitkan naskah", () => {
  it("penanda terisi, yang belum diisi tetap terlihat", async () => {
    const basis = await basisData();
    await siapkan(basis);
    jembatan({
      "'Penggugat'": "Penggugat",
      "perkara.jenis_perkara_nama": "Cerai Gugat",
      "perkara_pihak1.nama": "Reka Febrianti binti Rajab",
    });

    const hasil = await terbitkanNaskah(basis, { kode: "BAS-PERTAMA-01", perkaraId: "10096" });

    expect(hasil.ok).toBe(true);
    const gabung = hasil.alinea.map((a) => a.teks).join("\n");
    expect(gabung).toContain("Reka Febrianti binti Rajab sebagai Penggugat");
    expect(gabung).toContain("Cerai Gugat");
    // #1001# Kelas B belum diisi, ABT pun tidak memulangkannya: dicetak "..."
    // (Q2 14 Okt - tidak ada penanda mentah di naskah) dan TETAP disebut tersisa.
    expect(gabung).not.toMatch(/#\d{3,5}#/);
    expect(gabung).toContain("berupa ...");
    expect(hasil.tersisa).toEqual(["1001"]);
    expect(panggil).toHaveBeenCalledWith("abt.nilaiPenanda", expect.objectContaining({ perkaraId: "10096", penanda: ["1001"] }));
  });

  it("isian Kelas B yang sudah tersimpan ikut terpakai", async () => {
    const basis = await basisData();
    await siapkan(basis);
    jembatan({ "'Penggugat'": "Penggugat" });
    await simpanIsian(basis, {
      perkaraId: "10096",
      nilai: { "1001": "seperangkat alat shalat dibayar tunai" },
      oleh: "panitera",
    });

    const hasil = await terbitkanNaskah(basis, { kode: "BAS-PERTAMA-01", perkaraId: "10096" });
    const gabung = hasil.alinea.map((a) => a.teks).join("\n");
    expect(gabung).toContain("berupa seperangkat alat shalat dibayar tunai");
    expect(hasil.tersisa).not.toContain("1001");
  });

  it("blangko yang tidak ada ditolak dengan jelas", async () => {
    const basis = await basisData();
    const hasil = await terbitkanNaskah(basis, { kode: "TIDAK-ADA", perkaraId: "10096" });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toMatch(/tidak ada di pustaka/i);
  });
});

describe("syarat: yang belum diketahui MENGELUARKAN bagiannya", () => {
  it("bagian bersyarat dikeluarkan bila keadaannya belum diisi", () => {
    const bagian = [
      { id: "a", urutan: 1, blokSidik: "", teks: "Selalu ada", syarat: {}, selalu: true },
      { id: "b", urutan: 2, blokSidik: "", teks: "Berusaha mendamaikan", syarat: { kehadiranPihak1: "hadir" } },
    ];
    const hasil = pilihBagian(bagian, {});
    expect(hasil.terpakai.map((x) => x.id)).toEqual(["a"]);
    expect(hasil.dikeluarkan[0].sebab).toMatch(/belum diketahui/);
  });

  it("bagian terpakai bila keadaannya cocok", () => {
    const bagian = [
      { id: "b", urutan: 1, blokSidik: "", teks: "Berusaha mendamaikan", syarat: { kehadiranPihak1: "hadir" } },
    ];
    expect(pilihBagian(bagian, { kehadiranPihak1: "hadir" }).terpakai).toHaveLength(1);
    expect(pilihBagian(bagian, { kehadiranPihak1: "tidak-hadir" }).terpakai).toHaveLength(0);
  });

  it("syarat berdaftar cocok bila salah satunya terpenuhi", () => {
    const bagian = [
      { id: "b", urutan: 1, blokSidik: "", teks: "x", syarat: { kehadiranPihak2: ["tidak-hadir", "ghoib"] } },
    ];
    expect(pilihBagian(bagian, { kehadiranPihak2: "ghoib" }).terpakai).toHaveLength(1);
    expect(pilihBagian(bagian, { kehadiranPihak2: "hadir" }).terpakai).toHaveLength(0);
  });

  it("kombinasi yang ABT tidak punya berkasnya tetap menghasilkan naskah", async () => {
    // Inilah yang tidak mungkin dicapai dengan menyalin berkas.
    const basis = await basisData();
    await siapkan(basis);
    jembatan({ "'Penggugat'": "Penggugat" });

    const hasil = await terbitkanNaskah(basis, {
      kode: "BAS-PERTAMA-01",
      perkaraId: "10096",
      keadaan: { kehadiranPihak1: "ghoib", kehadiranPihak2: "ghoib", akibat: "tunda-tanggal" },
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.alinea.length).toBeGreaterThan(0);
  });
});

describe("penomoran dihitung ulang, tidak berlubang", () => {
  it("bagian yang dikeluarkan tidak meninggalkan nomor yang hilang", () => {
    // Nomor tersimpan akan berbunyi "1., 3., 4." begitu satu bagian
    // dikeluarkan - dan yang membacanya menyangka ada butir yang hilang.
    const terpakai = [
      { id: "a", urutan: 1, blokSidik: "", teks: "Satu", syarat: {}, nomor: 1 },
      { id: "c", urutan: 3, blokSidik: "", teks: "Dua", syarat: {}, nomor: 1 },
      { id: "d", urutan: 4, blokSidik: "", teks: "Tiga", syarat: {}, nomor: 1 },
    ];
    expect(naskahDariBagian(terpakai).map((x) => x.nomor)).toEqual([1, 2, 3]);
  });

  it("alinea tanpa nomor memutus hitungan", () => {
    const terpakai = [
      { id: "a", urutan: 1, blokSidik: "", teks: "Satu", syarat: {}, nomor: 1 },
      { id: "b", urutan: 2, blokSidik: "", teks: "Kepala bagian", syarat: {} },
      { id: "c", urutan: 3, blokSidik: "", teks: "Satu lagi", syarat: {}, nomor: 1 },
    ];
    expect(naskahDariBagian(terpakai).map((x) => x.nomor)).toEqual([1, undefined, 1]);
  });
});

describe("menerbitkan DOCX dan PDF", () => {
  it("keduanya terbentuk dari susunan alinea yang sama", async () => {
    const basis = await basisData();
    await siapkan(basis);
    jembatan({ "'Penggugat'": "Penggugat", "perkara_pihak1.nama": "Reka Febrianti" });

    const hasil = await terbitkanBerkas(basis, { kode: "BAS-PERTAMA-01", perkaraId: "10096", oleh: "panitera" });

    expect(hasil.ok).toBe(true);
    expect(hasil.docx?.readUInt32LE(0)).toBe(0x04034b50);
    expect(hasil.pdf?.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(hasil.jumlahHalaman).toBeGreaterThanOrEqual(1);
  });

  it("penerbitan tercatat beserta penanda yang tersisa", async () => {
    const basis = await basisData();
    await siapkan(basis);
    jembatan({ "'Penggugat'": "Penggugat" });
    await terbitkanBerkas(basis, { kode: "BAS-PERTAMA-01", perkaraId: "10096", oleh: "panitera" });

    const catatan = await basis.queryOne<Record<string, unknown>>(
      `SELECT perkara_id, jumlah_tersisa, tersisa, oleh FROM aleta_blangko_terbit`
    );
    expect(String(catatan?.perkara_id)).toBe("10096");
    expect(Number(catatan?.jumlah_tersisa)).toBeGreaterThan(0);
    expect(String(catatan?.oleh)).toBe("panitera");
  });
});

describe("saklar periksa", () => {
  it("bawaannya MATI", async () => {
    const basis = await basisData();
    expect(await saklarMenyala(basis, "bas")).toBe(false);
    expect(await saklarMenyala(basis, "putusan")).toBe(false);
  });

  it("per golongan, bukan satu untuk semua", async () => {
    const basis = await basisData();
    await geserSaklar(basis, { golongan: "putusan", menyala: true, alasan: "risikonya tertinggi", oleh: "Ketua" });

    expect(await saklarMenyala(basis, "putusan")).toBe(true);
    expect(await saklarMenyala(basis, "relaas")).toBe(false);
  });

  it("tiap pergeseran tercatat beserta dari-ke dan alasannya", async () => {
    const basis = await basisData();
    await geserSaklar(basis, { golongan: "bas", menyala: true, alasan: "masa peralihan", oleh: "Ketua" });
    await geserSaklar(basis, { golongan: "bas", menyala: false, alasan: "sudah stabil", oleh: "Ketua" });

    const riwayat = await basis.queryAll<Record<string, unknown>>(
      `SELECT dari, ke, alasan, oleh FROM aleta_saklar_riwayat WHERE golongan = 'bas' ORDER BY pada`
    );
    expect(riwayat).toHaveLength(2);
    expect(Number(riwayat[0].dari)).toBe(0);
    expect(Number(riwayat[0].ke)).toBe(1);
    expect(Number(riwayat[1].ke)).toBe(0);
    expect(String(riwayat[1].alasan)).toBe("sudah stabil");
  });

  it("pergeseran tanpa penyebutan pelakunya ditolak", async () => {
    // Saklar yang dapat digeser tanpa jejak sama saja dengan tidak ada.
    const basis = await basisData();
    const hasil = await geserSaklar(basis, { golongan: "bas", menyala: true, alasan: "", oleh: "" });
    expect(hasil.ok).toBe(false);
  });

  it("naskah menyebut apakah golongannya perlu diperiksa", async () => {
    const basis = await basisData();
    await siapkan(basis);
    jembatan({ "'Penggugat'": "Penggugat" });

    expect((await terbitkanNaskah(basis, { kode: "BAS-PERTAMA-01", perkaraId: "1" })).perluDiperiksa).toBe(false);
    await geserSaklar(basis, { golongan: "bas", menyala: true, alasan: "uji", oleh: "Ketua" });
    expect((await terbitkanNaskah(basis, { kode: "BAS-PERTAMA-01", perkaraId: "1" })).perluDiperiksa).toBe(true);
  });
});

describe("uji kemandirian", () => {
  it("pustaka kosong TIDAK dinyatakan mandiri", async () => {
    // Uji yang lulus karena tidak ada yang diuji adalah uji yang berbohong.
    const basis = await basisData();
    const hasil = await ujiKemandirian(basis, { perkaraId: "10096", oleh: "admin" });
    expect(hasil.mandiri).toBe(false);
    expect(hasil.jumlahDiperiksa).toBe(0);
  });

  it("blangko yang terbit tanpa menyentuh ABT dinyatakan mandiri", async () => {
    const basis = await basisData();
    await siapkan(basis);
    jembatan({ "'Penggugat'": "Penggugat" });

    const hasil = await ujiKemandirian(basis, { perkaraId: "10096", oleh: "admin" });
    expect(hasil.mandiri).toBe(true);
    expect(hasil.temuan).toEqual([]);

    // Yang dipanggil hanya kamus - tidak satu pun operasi blangko ABT.
    const operasi = panggil.mock.calls.map((c) => c[0]);
    expect(operasi.some((o) => String(o).startsWith("blangko."))).toBe(false);
  });

  it("hasilnya tercatat supaya dapat dijalankan berkala", async () => {
    const basis = await basisData();
    await siapkan(basis);
    jembatan({ "'Penggugat'": "Penggugat" });
    await ujiKemandirian(basis, { perkaraId: "10096", oleh: "admin" });

    const catatan = await basis.queryOne<Record<string, unknown>>(
      `SELECT mandiri, jumlah_diperiksa, dijalankan_oleh FROM aleta_uji_mandiri`
    );
    expect(Number(catatan?.mandiri)).toBe(1);
    expect(String(catatan?.dijalankan_oleh)).toBe("admin");
  });
});

describe("membereskan Kelas C", () => {
  it("menunjukkan variabel mati beserta blangko yang memuatnya", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    await basis.run(`UPDATE aleta_kamus_variabel SET jumlah_pakai = 60 WHERE no_var = '7211'`);
    await pelajariKorpus(basis, {
      berkas: [{ ...SUMBER[0], penanda: [...SUMBER[0].penanda, "7211"] }],
      oleh: "admin",
    });

    const temuan = await daftarKelasC(basis);
    const mati = temuan.find((t) => t.noVar === "7211");
    expect(mati).toBeDefined();
    expect(mati?.blangko).toContain(JALUR);
  });

  it("yang mati tetapi tidak dipakai blangko mana pun tidak masuk daftar kerja", async () => {
    // Ia hanya baris kamus yang tidak menyentuh naskah siapa pun.
    const basis = await basisData();
    await tanamKamus(basis);
    await basis.run(`UPDATE aleta_kamus_variabel SET jumlah_pakai = 0 WHERE no_var = '7211'`);

    expect(await daftarKelasC(basis)).toEqual([]);
    const ringkas = await ringkasKelasC(basis);
    expect(ringkas.jumlahMati).toBe(1);
    expect(ringkas.matiDanTerpakai).toBe(0);
  });
});
