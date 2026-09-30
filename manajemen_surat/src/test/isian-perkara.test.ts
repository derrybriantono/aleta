// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { kelompokUntuk, ringkasIsian, susunKelompok } from "@/lib/kelompok-isian";
import {
  butirUntukBlangko,
  isianPerkara,
  kesiapanIsian,
  penandaKelasB,
  riwayatIsian,
  simpanIsian,
} from "@/server/modules/aleta-ecourt/isian-perkara";

/**
 * Isian perkara untuk Kelas B (Tahap 3).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - HANYA Kelas B yang boleh diisi tangan. Menerima nomor variabel apa pun
 *     berarti isian tangan dapat menimpa nilai yang seharusnya dibaca dari
 *     SIPP, dan sejak itu naskah menyebut nama pihak yang berbeda dari yang
 *     tercatat pada perkaranya - tanpa satu pun tanda;
 *   - isian melekat pada PERKARA, bukan blangko - dua ketikan atas fakta yang
 *     sama pasti berselisih cepat atau lambat;
 *   - tiap perubahan tercatat riwayatnya, termasuk pengosongan.
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

async function tanamKamus(basis: AletaDatabase) {
  const sekarang = new Date().toISOString();
  const daftar: Array<[string, string, string, number]> = [
    ["1001", "Mas kawin", "B", 221],
    ["0650", "Saksi Nikah 1", "B", 220],
    ["0651", "Saksi Nikah 2", "B", 221],
    ["1046", "Status Wali Nikah", "B", 246],
    ["0600", "Nama Pria (Dispensasi)", "B", 298],
    ["1152", "Alasan poligami", "B", 40],
    ["0098", "Nama #0046#", "A", 403],
    ["7211", "Umur Isbat P1", "C", 60],
  ];
  for (const [noVar, nama, kelas, pakai] of daftar) {
    await basis.run(
      `INSERT INTO aleta_kamus_variabel
         (no_var, nama, jenis, sql_query, data_tabel, data_kolom, default_data,
          kelas, sebab_kelas, bersarang, jumlah_pakai, asal_skema, salin_id, dibuat_at, diubah_at)
       VALUES (?, ?, ?, '', '', '', '', ?, '', '', ?, 'aps_badilag', 'uji', ?, ?)`,
      [noVar, nama, kelas === "B" ? "data_teks" : "data_sql", kelas, pakai, sekarang, sekarang]
    );
  }
}

const PENANDA = ["1001", "0650", "0651", "1046", "0600", "1152", "0098", "7211"];

describe("hanya Kelas B yang boleh diisi tangan", () => {
  it("Kelas A ditolak beserta sebabnya", async () => {
    const basis = await basisData();
    await tanamKamus(basis);

    const hasil = await simpanIsian(basis, {
      perkaraId: "10096",
      nilai: { "0098": "Nama Karangan" },
      oleh: "panitera",
    });

    expect(hasil.jumlahDisimpan).toBe(0);
    expect(hasil.ditolak[0].sebab).toMatch(/Kelas A/);
    expect(hasil.ditolak[0].sebab).toMatch(/tidak boleh diisi tangan/);
  });

  it("Kelas C ditolak juga", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    const hasil = await simpanIsian(basis, { perkaraId: "10096", nilai: { "7211": "20" }, oleh: "panitera" });
    expect(hasil.jumlahDisimpan).toBe(0);
    expect(hasil.ditolak[0].sebab).toMatch(/Kelas C/);
  });

  it("nomor yang tidak ada di kamus ditolak", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    const hasil = await simpanIsian(basis, { perkaraId: "10096", nilai: { "9999": "x" }, oleh: "panitera" });
    expect(hasil.ditolak[0].sebab).toMatch(/Tidak ada di kamus/);
  });

  it("Kelas B diterima dan tersimpan", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    const hasil = await simpanIsian(basis, {
      perkaraId: "10096",
      nilai: { "1001": "seperangkat alat shalat dibayar tunai", "0650": "Nurhaimi" },
      oleh: "panitera",
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.jumlahDisimpan).toBe(2);
    expect(hasil.ditolak).toEqual([]);
  });
});

describe("isian menuntut penyebutan pengisinya", () => {
  it("tanpa nama pengisi ditolak seluruhnya", async () => {
    // Nilai tanpa penulisnya tidak dapat dipertanggungjawabkan pada hari ia
    // dipersoalkan.
    const basis = await basisData();
    await tanamKamus(basis);
    const hasil = await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "x" }, oleh: "" });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toMatch(/siapa yang mengisinya/i);
  });

  it("tanpa perkara ditolak", async () => {
    const basis = await basisData();
    const hasil = await simpanIsian(basis, { perkaraId: "", nilai: { "1001": "x" }, oleh: "panitera" });
    expect(hasil.ok).toBe(false);
  });
});

describe("isian melekat pada perkara", () => {
  it("terbaca kembali sebagai peta untuk penyelesai", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    await simpanIsian(basis, {
      perkaraId: "10096",
      nilai: { "1001": "seperangkat alat shalat", "0650": "Nurhaimi" },
      oleh: "panitera",
    });

    const peta = await isianPerkara(basis, "10096");
    expect(peta["1001"]).toBe("seperangkat alat shalat");
    expect(peta["0650"]).toBe("Nurhaimi");
  });

  it("perkara lain tidak terbawa", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "milik 10096" }, oleh: "panitera" });
    expect(await isianPerkara(basis, "20202")).toEqual({});
  });

  it("isian KOSONG tidak masuk peta - penandanya harus tetap terlihat", async () => {
    // Peta yang memuat nilai kosong akan membuat penyelesai menganggapnya
    // sudah dijawab, lalu penandanya lenyap menjadi ruang kosong pada naskah.
    const basis = await basisData();
    await tanamKamus(basis);
    await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "" }, oleh: "panitera" });
    expect(await isianPerkara(basis, "10096")).toEqual({});
  });
});

describe("riwayat penyuntingan", () => {
  it("tiap perubahan tercatat beserta nilai lamanya", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "uang tunai" }, oleh: "panitera" });
    await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "seperangkat alat shalat" }, oleh: "hakim" });

    const riwayat = await riwayatIsian(basis, "10096", "1001");
    expect(riwayat).toHaveLength(2);
    expect(riwayat[0].nilaiBaru).toBe("seperangkat alat shalat");
    expect(riwayat[0].nilaiLama).toBe("uang tunai");
    expect(riwayat[0].oleh).toBe("hakim");
  });

  it("nilai yang tidak berubah tidak menambah riwayat", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "sama" }, oleh: "panitera" });
    const kedua = await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "sama" }, oleh: "panitera" });

    expect(kedua.jumlahDisimpan).toBe(0);
    expect(await riwayatIsian(basis, "10096", "1001")).toHaveLength(1);
  });

  it("pengosongan juga tercatat", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "ada" }, oleh: "panitera" });
    await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "" }, oleh: "panitera" });

    const riwayat = await riwayatIsian(basis, "10096", "1001");
    expect(riwayat[0].nilaiLama).toBe("ada");
    expect(riwayat[0].nilaiBaru).toBe("");
  });
});

describe("pengelompokan", () => {
  it("144 kotak menjadi beberapa kelompok bermakna", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    const kelompok = await butirUntukBlangko(basis, "10096", PENANDA);

    const kode = kelompok.map((k) => k.kode);
    expect(kode).toContain("pernikahan");
    expect(kode).toContain("dispensasi");
    expect(kode).toContain("poligami");
    // Kelas A dan C tidak pernah muncul sebagai isian.
    const semuaNoVar = kelompok.flatMap((k) => k.butir.map((b) => b.noVar));
    expect(semuaNoVar).not.toContain("0098");
    expect(semuaNoVar).not.toContain("7211");
  });

  it("yang paling sering dipakai muncul lebih dulu", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    const kelompok = await butirUntukBlangko(basis, "10096", PENANDA);
    const nikah = kelompok.find((k) => k.kode === "pernikahan");
    // #1046# (246) lebih sering daripada #0651# (221) dan #0650# (220).
    expect(nikah?.butir[0].noVar).toBe("1046");
  });

  it("ringkasan menyebut berapa yang menunggu", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    await simpanIsian(basis, { perkaraId: "10096", nilai: { "1001": "terisi" }, oleh: "panitera" });

    const { ringkas } = await kesiapanIsian(basis, "10096", PENANDA);
    expect(ringkas.jumlah).toBe(6);
    expect(ringkas.terisi).toBe(1);
    expect(ringkas.kalimat).toContain("5 lagi menunggu");
  });

  it("kelompok yang tidak berlaku tidak ditampilkan", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    const kelompok = await butirUntukBlangko(basis, "10096", ["1001"]);
    expect(kelompok).toHaveLength(1);
    expect(kelompok[0].kode).toBe("pernikahan");
  });
});

describe("aturan pengelompokan dari nama variabel", () => {
  it("yang lebih khusus menang atas yang umum", () => {
    // "Alamat Wanita (dispensasi)" memuat kata umum tetapi "(dispensasi)"
    // lebih menentukan.
    expect(kelompokUntuk("Alamat Wanita (dispensasi)")).toBe("dispensasi");
    expect(kelompokUntuk("Umur Pria (dispensasi)")).toBe("dispensasi");
  });

  it("nama sungguhan dari ABT jatuh ke kelompok yang benar", () => {
    expect(kelompokUntuk("Mas kawin")).toBe("pernikahan");
    expect(kelompokUntuk("Status Wali Nikah")).toBe("pernikahan");
    expect(kelompokUntuk("Alasan poligami")).toBe("poligami");
    expect(kelompokUntuk("Nama Almarhum / Almarhumah")).toBe("waris");
    expect(kelompokUntuk("No. SK Prodeo dari Panitera")).toBe("izin-atasan");
    expect(kelompokUntuk("Nama Kasir")).toBe("keuangan");
    expect(kelompokUntuk("Kantor Kuasa #0046#")).toBe("kuasa");
    expect(kelompokUntuk("Awal Konflik : bulan _ / tahun _")).toBe("perceraian");
    expect(kelompokUntuk("Tergugat Pernah/Tidak Pernah Menjenguk Anak")).toBe("anak");
  });

  it("yang tidak dikenali jatuh ke lain-lain, bukan dipaksakan", () => {
    expect(kelompokUntuk("Sesuatu yang belum pernah ada")).toBe("lain");
  });
});

describe("ringkasan tanpa isian", () => {
  it("blangko tanpa Kelas B dinyatakan tidak menuntut isian tangan", () => {
    expect(ringkasIsian(susunKelompok([])).kalimat).toMatch(/tidak menuntut isian tangan/i);
  });
});

/**
 * Layar perkara membuka isian SEBELUM ada blangko terpilih, jadi ia meminta
 * seluruh Kelas B sekaligus. Yang dijaga: daftar itu tidak menjadi tempat
 * pembuangan seluruh isi kamus.
 */
describe("seluruh Kelas B untuk layar perkara", () => {
  it("hanya Kelas B, bukan Kelas A maupun C", async () => {
    const basis = await basisData();
    await tanamKamus(basis);

    const daftar = await penandaKelasB(basis);
    expect(daftar).toContain("1001");
    expect(daftar).not.toContain("0098"); // Kelas A
    expect(daftar).not.toContain("7211"); // Kelas C
  });

  it("yang tidak dipakai satu blangko pun TIDAK ikut", async () => {
    // Meminta panitera mengisi keterangan yang tidak akan pernah tercetak di
    // mana pun hanya menambah kotak kosong.
    const basis = await basisData();
    await tanamKamus(basis);
    await basis.run(`UPDATE aleta_kamus_variabel SET jumlah_pakai = 0 WHERE no_var = '1152'`);

    const daftar = await penandaKelasB(basis);
    expect(daftar).not.toContain("1152");
    expect(daftar).toContain("1001");
  });

  it("yang paling sering dipakai lebih dulu", async () => {
    const basis = await basisData();
    await tanamKamus(basis);
    const daftar = await penandaKelasB(basis);
    // #0600# (298) paling sering di antara Kelas B pada tanaman uji.
    expect(daftar[0]).toBe("0600");
  });

  it("kamus kosong menghasilkan daftar kosong, bukan error", async () => {
    const basis = await basisData();
    expect(await penandaKelasB(basis)).toEqual([]);
  });
});
