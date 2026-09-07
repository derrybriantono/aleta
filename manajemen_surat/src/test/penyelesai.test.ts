// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const panggil = vi.fn();

vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: (operasi: string, params: Record<string, unknown>) => panggil(operasi, params),
}));

const { createAletaDatabase } = await import("@/server/db/client");
type AletaDatabase = Awaited<ReturnType<typeof createAletaDatabase>>;

const { isiNaskah, kumpulkanDefinisi, selesaikanPenanda } = await import(
  "@/server/modules/aleta-ecourt/penyelesai"
);

/**
 * Penyelesai bertingkat (Tahap 2) - dengan kamus sungguhan di basis data.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - kueri yang MASIH bertanda tidak pernah dijalankan. MySQL akan mencari
 *     "#0046#" sebagai teks dan mengembalikan kosong - hasil yang tampak sah
 *     dan tidak berarti apa pun;
 *   - variabel yang bahannya gagal ikut GAGAL, bukan diselesaikan separuh;
 *   - Kelas B tidak pernah ditebak mesin, Kelas C tidak pernah diisi;
 *   - penanda yang tidak selesai tetap terlihat di naskah.
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

type Butir = {
  noVar: string;
  nama?: string;
  jenis: string;
  sql?: string;
  tabel?: string;
  kolom?: string;
  kelas: "A" | "B" | "C";
  bersarang?: string[];
};

async function tanam(basis: AletaDatabase, daftar: Butir[]) {
  const sekarang = new Date().toISOString();
  for (const b of daftar) {
    await basis.run(
      `INSERT INTO aleta_kamus_variabel
         (no_var, nama, jenis, sql_query, data_tabel, data_kolom, default_data,
          kelas, sebab_kelas, bersarang, jumlah_pakai, asal_skema, salin_id, dibuat_at, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, '', ?, '', ?, 0, 'aps_badilag', 'uji', ?, ?)`,
      [
        b.noVar,
        b.nama ?? "",
        b.jenis,
        b.sql ?? "",
        b.tabel ?? "",
        b.kolom ?? "",
        b.kelas,
        (b.bersarang ?? []).join(","),
        sekarang,
        sekarang,
      ]
    );
  }
}

/** Jembatan yang menjawab kueri dengan nilai yang sudah ditentukan. */
function jembatan(jawab: Record<string, string>, opsi: { catat?: string[] } = {}) {
  panggil.mockImplementation(async (operasi: string, params: Record<string, unknown>) => {
    if (operasi === "kamus.jalankanKueri") {
      const sql = String(params.sql ?? "");
      opsi.catat?.push(sql);
      // Menirukan penjagaan jembatan sungguhan: kueri bertanda ditolak.
      if (/#\d{3,5}#/.test(sql)) {
        return { ok: true, data: { ada: false, sebab: "Kueri masih memuat penanda yang belum diselesaikan." } };
      }
      for (const [kunci, nilai] of Object.entries(jawab)) {
        if (sql.includes(kunci)) return { ok: true, data: { ada: true, kosong: false, nilai } };
      }
      return { ok: true, data: { ada: true, kosong: true, nilai: "" } };
    }
    if (operasi === "kamus.bacaKolom") {
      const kunci = `${params.tabel}.${params.kolom}`;
      const nilai = jawab[kunci];
      if (nilai === undefined) return { ok: true, data: { ada: true, kosong: true, nilai: "" } };
      return { ok: true, data: { ada: true, kosong: false, nilai } };
    }
    return { ok: true, data: null };
  });
}

describe("penyelesaian berlapis", () => {
  it("kueri bersarang diselesaikan lebih dulu, lalu disisipkan", async () => {
    const basis = await basisData();
    await tanam(basis, [
      { noVar: "0015", nama: "Nama PP", jenis: "data_sql", sql: "select panitera_nama as data from x where perkara_id=#perkara_id#", kelas: "A" },
      { noVar: "8004", nama: "Nama Panitera PA", jenis: "data_sql", sql: "select value as data from sys_config where name='PanSekNama'", kelas: "A" },
      {
        noVar: "6034",
        nama: "Panitera/Panitera Pengganti",
        jenis: "data_sql",
        sql: 'select (case when "#0015#"="#8004#" then "Panitera" else "Panitera Pengganti" end) as data',
        kelas: "A",
        bersarang: ["0015", "8004"],
      },
    ]);

    const catat: string[] = [];
    jembatan(
      {
        panitera_nama: "Unun Fidiyasari Patangai, S.H.",
        PanSekNama: "Sri Susilowati, S.H.",
        'case when "Unun': "Panitera Pengganti",
      },
      { catat }
    );

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["6034"] });

    expect(hasil.ok).toBe(true);
    expect(hasil.nilai.get("6034")?.nilai).toBe("Panitera Pengganti");
    // Kuerinya sudah tidak bertanda saat dikirim.
    const kueriBersarang = catat.find((s) => s.includes("case when"));
    expect(kueriBersarang).toBeDefined();
    expect(/#\d{3,5}#/.test(kueriBersarang!)).toBe(false);
  });

  it("penanda yang tidak diminta pun ikut dikumpulkan bila disebut", async () => {
    const basis = await basisData();
    await tanam(basis, [
      { noVar: "0046", jenis: "data_sql", sql: "select 'Penggugat' as data", kelas: "A" },
      { noVar: "0100", jenis: "data_sql", sql: 'select "#0046#" as data', kelas: "A", bersarang: ["0046"] },
    ]);
    const kamus = await kumpulkanDefinisi(basis, ["0100"]);
    expect([...kamus.keys()].sort()).toEqual(["0046", "0100"]);
  });

  it("nilai membawa asal-usulnya", async () => {
    const basis = await basisData();
    await tanam(basis, [
      { noVar: "0098", nama: "Nama #0046#", jenis: "data_sipp", tabel: "perkara_pihak1", kolom: "nama", kelas: "A" },
    ]);
    jembatan({ "perkara_pihak1.nama": "Reka Febrianti binti Rajab" });

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["0098"] });
    expect(hasil.nilai.get("0098")?.asal).toBe("SIPP - perkara_pihak1.nama");
  });
});

describe("yang gagal tidak menularkan kekosongan", () => {
  it("variabel yang bahannya gagal ikut gagal, bukan diselesaikan separuh", async () => {
    const basis = await basisData();
    await tanam(basis, [
      { noVar: "0015", jenis: "data_sql", sql: "select tidak_ada as data", kelas: "A" },
      { noVar: "6034", jenis: "data_sql", sql: 'select "#0015#" as data', kelas: "A", bersarang: ["0015"] },
    ]);
    jembatan({}); // seluruh kueri mengembalikan kosong

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["6034"] });
    expect(hasil.ok).toBe(false);
    expect(hasil.nilai.has("6034")).toBe(false);
    expect(hasil.gagal.find((g) => g.noVar === "6034")?.sebab).toMatch(/menunggu #0015#/);
  });

  it("kueri yang masih bertanda TIDAK dijalankan", async () => {
    const basis = await basisData();
    await tanam(basis, [
      // Sengaja tanpa mendaftarkan #9999# sebagai bersarang - meniru kamus yang
      // daftar sarangnya tidak lengkap.
      { noVar: "0100", jenis: "data_sql", sql: 'select "#9999#" as data', kelas: "A" },
    ]);
    const catat: string[] = [];
    jembatan({}, { catat });

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["0100"] });
    expect(hasil.ok).toBe(false);
    expect(hasil.gagal[0].sebab).toMatch(/masih menyebut #9999#/);
    // Yang penting: jembatan tidak pernah dipanggil dengan kueri bertanda.
    expect(catat).toEqual([]);
  });

  it("lingkaran dilaporkan, tidak berputar selamanya", async () => {
    const basis = await basisData();
    await tanam(basis, [
      { noVar: "0001", jenis: "data_sql", sql: 'select "#0002#"', kelas: "A", bersarang: ["0002"] },
      { noVar: "0002", jenis: "data_sql", sql: 'select "#0001#"', kelas: "A", bersarang: ["0001"] },
    ]);
    jembatan({});

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["0001"] });
    expect(hasil.lingkaran).toEqual(["0001", "0002"]);
    expect(hasil.gagal.every((g) => /lingkaran/.test(g.sebab))).toBe(true);
  });
});

describe("Kelas B dan C tidak pernah ditebak", () => {
  it("Kelas B menunggu isian manusia, bukan diisi mesin", async () => {
    const basis = await basisData();
    await tanam(basis, [{ noVar: "1001", nama: "Mas kawin", jenis: "data_teks", kelas: "B" }]);
    jembatan({});

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["1001"] });
    expect(hasil.nilai.has("1001")).toBe(false);
    expect(hasil.gagal[0].sebab).toMatch(/hakim atau panitera/i);
    expect(panggil).not.toHaveBeenCalled();
  });

  it("isian yang sudah tersimpan dipakai dan menang atas apa pun", async () => {
    const basis = await basisData();
    await tanam(basis, [{ noVar: "1001", nama: "Mas kawin", jenis: "data_teks", kelas: "B" }]);
    jembatan({});

    const hasil = await selesaikanPenanda(basis, {
      perkaraId: "10096",
      penanda: ["1001"],
      isian: { "1001": "seperangkat alat shalat dibayar tunai" },
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.nilai.get("1001")?.nilai).toBe("seperangkat alat shalat dibayar tunai");
    expect(hasil.nilai.get("1001")?.asal).toBe("Isian perkara");
  });

  it("Kelas C tidak pernah diisi dan sebabnya disebut", async () => {
    const basis = await basisData();
    await tanam(basis, [{ noVar: "7211", nama: "Umur Isbat P1", jenis: "", kelas: "C" }]);
    jembatan({});

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["7211"] });
    expect(hasil.nilai.has("7211")).toBe(false);
    expect(hasil.gagal[0].sebab).toMatch(/tidak dapat diisi siapa pun/i);
  });
});

describe("fungsi tanggal dan terbilang tidak menyentuh SIPP", () => {
  it("tanggal Hijriah dihitung dari tanggal yang sudah selesai", async () => {
    const basis = await basisData();
    await tanam(basis, [
      { noVar: "1069", nama: "Tgl Putusan", jenis: "data_sipp", tabel: "perkara", kolom: "tanggal_putusan", kelas: "A" },
      { noVar: "0038", nama: "Hijriyah Tgl Putusan", jenis: "tanggal_hijriah", kelas: "A", bersarang: ["1069"] },
    ]);
    jembatan({ "perkara.tanggal_putusan": "2026-09-04" });

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["0038"] });
    // Cocok dengan penetapan sungguhan PA Donggala.
    expect(hasil.nilai.get("0038")?.nilai).toBe("21 Rabiul Awwal 1448");
    // Satu kueri saja - pengalihannya tidak menyentuh basis data.
    expect(hasil.jumlahKueri).toBe(1);
  });

  it("terbilang dieja dari angka yang sudah selesai", async () => {
    const basis = await basisData();
    await tanam(basis, [
      { noVar: "0143", jenis: "data_sipp", tabel: "perkara_biaya", kolom: "jumlah", kelas: "A" },
      { noVar: "0155", jenis: "terbilang", kelas: "A", bersarang: ["0143"] },
    ]);
    jembatan({ "perkara_biaya.jumlah": "170000" });

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["0155"] });
    expect(hasil.nilai.get("0155")?.nilai).toContain("seratus tujuh puluh ribu");
  });

  it("tanggal yang tidak terbaca menggagalkan, bukan menghasilkan kosong", async () => {
    const basis = await basisData();
    await tanam(basis, [
      { noVar: "1069", jenis: "data_sipp", tabel: "perkara", kolom: "tanggal_putusan", kelas: "A" },
      { noVar: "0038", jenis: "tanggal_hijriah", kelas: "A", bersarang: ["1069"] },
    ]);
    jembatan({ "perkara.tanggal_putusan": "bukan tanggal" });

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["0038"] });
    expect(hasil.nilai.has("0038")).toBe(false);
    expect(hasil.gagal.find((g) => g.noVar === "0038")?.sebab).toMatch(/tidak terbaca/i);
  });
});

describe("mengisi naskah", () => {
  it("penanda yang tidak selesai tetap terlihat dan disebutkan", async () => {
    const basis = await basisData();
    await tanam(basis, [
      { noVar: "0046", jenis: "data_sql", sql: "select 'Penggugat' as data", kelas: "A" },
      { noVar: "1001", nama: "Mas kawin", jenis: "data_teks", kelas: "B" },
    ]);
    jembatan({ "'Penggugat'": "Penggugat" });

    const hasil = await selesaikanPenanda(basis, { perkaraId: "10096", penanda: ["0046", "1001"] });
    const naskah = isiNaskah("Bahwa #0046# menyerahkan mahar berupa #1001#;", hasil);

    expect(naskah.naskah).toBe("Bahwa Penggugat menyerahkan mahar berupa #1001#;");
    expect(naskah.tersisa).toEqual(["1001"]);
    expect(naskah.jumlahTerisi).toBe(1);
  });
});
