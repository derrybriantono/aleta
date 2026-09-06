// @vitest-environment node
import { describe, expect, it } from "vitest";

import { golongkan, golonganYatim, rekapKelas, variabelBersarang } from "@/lib/kelas-variabel";

/**
 * Penggolongan variabel ABT menjadi Kelas A, B, dan C.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Penggolongan ini menentukan apa yang dilakukan penyelesai terhadap sebuah
 * penanda. Kelas A akan dijalankan mesin tanpa bertanya siapa pun; kalau
 * sesuatu digolongkan A padahal sumbernya tidak ada, mesin akan mengisi naskah
 * resmi dengan hasil yang tidak ada - dan kekosongan itu tidak terlihat seperti
 * kesalahan.
 *
 * Karena itu yang diuji paling keras bukan "berhasil menggolongkan", melainkan
 * bahwa janji tanpa isi TIDAK diangkat menjadi Kelas A.
 */
describe("janji tanpa isi tidak menjadi Kelas A", () => {
  it("data_sql tanpa sql_query jatuh ke C, bukan A", () => {
    const hasil = golongkan({ noVar: "9001", jenis: "data_sql", sqlQuery: "" });
    expect(hasil.kelas).toBe("C");
    expect(hasil.sebab).toMatch(/tidak pernah ditulis/i);
  });

  it("data_sql dengan sql_query menjadi A", () => {
    const hasil = golongkan({
      noVar: "0100",
      nama: "Pekerjaan #0046#",
      jenis: "data_sql",
      sqlQuery: "select b.pekerjaan as data from perkara_pihak1 a where a.perkara_id=#perkara_id#",
    });
    expect(hasil.kelas).toBe("A");
  });

  it("data_sipp tanpa tabel dan kolom jatuh ke C", () => {
    expect(golongkan({ noVar: "9002", jenis: "data_sipp" }).kelas).toBe("C");
  });

  it("data_sipp yang menyebut tabel dan kolomnya menjadi A", () => {
    const hasil = golongkan({
      noVar: "0098",
      jenis: "data_sipp",
      dataTabel: "perkara_pihak1",
      dataKolom: "nama",
    });
    expect(hasil.kelas).toBe("A");
    expect(hasil.sebab).toContain("perkara_pihak1.nama");
  });

  it("jenis yang belum dikenali TIDAK diangkat menjadi A", () => {
    // Jenis baru boleh muncul kapan saja di ABT. Menganggapnya mekanis berarti
    // penyelesai memperlakukan sesuatu yang belum dipahami seolah sudah.
    const hasil = golongkan({ noVar: "9003", jenis: "jenis_baru_yang_belum_ada" });
    expect(hasil.kelas).toBe("C");
    expect(hasil.sebab).toMatch(/belum dikenali/i);
  });

  it("tanpa jenis sama sekali jatuh ke C", () => {
    expect(golongkan({ noVar: "9004", jenis: "" }).kelas).toBe("C");
  });
});

describe("yang hanya diketahui manusia menjadi Kelas B", () => {
  it("data_teks tidak pernah menjadi A walau namanya jelas", () => {
    const hasil = golongkan({ noVar: "1001", nama: "Mas kawin", jenis: "data_teks" });
    expect(hasil.kelas).toBe("B");
    expect(hasil.sebab).toMatch(/hakim atau panitera/i);
  });

  it("data_teks tetap B walaupun ada nilai bawaan", () => {
    // Nilai bawaan bukan sumber - ia contoh. Mengangkatnya menjadi A berarti
    // fakta perkara diisi dari contoh.
    expect(golongkan({ noVar: "1046", nama: "Status Wali Nikah", jenis: "data_teks" }).kelas).toBe("B");
  });
});

describe("fungsi murni menjadi Kelas A", () => {
  it.each(["data_tanggal", "tanggal_hari", "tanggal_hijriah", "terbilang", "tanya_jawab", "qrcode"])(
    "%s digolongkan A",
    (jenis) => {
      expect(golongkan({ noVar: "0038", jenis }).kelas).toBe("A");
    }
  );
});

describe("kode yang dipakai blangko tetapi tidak terdaftar", () => {
  it("digolongkan C beserta sebabnya, bukan diabaikan", () => {
    const hasil = golonganYatim("7211");
    expect(hasil.kelas).toBe("C");
    expect(hasil.sebab).toContain("#7211#");
    expect(hasil.sebab).toMatch(/tidak terdaftar/i);
  });
});

/**
 * Persarangan menentukan urutan penyelesaian di Tahap 1.
 *
 * Sebuah variabel tidak dapat diselesaikan sebelum seluruh yang disebutnya
 * selesai. Kalau daftarnya keliru, penyelesai akan menjalankan kueri yang masih
 * memuat penanda mentah - dan hasilnya masuk ke naskah.
 */
describe("variabel yang disebut sebuah definisi", () => {
  it("terbaca dari namanya", () => {
    expect(variabelBersarang({ noVar: "0100", nama: "Pekerjaan #0046#" })).toEqual(["0046"]);
  });

  it("terbaca dari kuerinya, termasuk beberapa sekaligus", () => {
    const hasil = variabelBersarang({
      noVar: "2027",
      nama: "Pria / Wanita (#0046# II)",
      sqlQuery: 'select (case when "#1033#" like "%binti%" or "#0102#" like "%binti%" then "Wanita" else "Pria" end)',
    });
    expect(hasil).toEqual(["0046", "0102", "1033"]);
  });

  it("dirinya sendiri tidak dihitung bersarang", () => {
    // Variabel yang menyebut dirinya sendiri bukan lingkaran - dan
    // menghitungnya begitu membuat penyelesai menolak sesuatu yang sah.
    expect(variabelBersarang({ noVar: "0163", sqlQuery: 'case when "#0163#" like "%x%" then "#0163# #8008#"' })).toEqual(
      ["8008"]
    );
  });

  it("definisi tanpa penanda menghasilkan daftar kosong", () => {
    expect(variabelBersarang({ noVar: "8008", nama: "Nama Satker", sqlQuery: "select value as data from sys_config" })).toEqual([]);
  });
});

describe("rekapitulasi", () => {
  it("menghitung tiap kelas, termasuk yang nol", () => {
    expect(rekapKelas([{ kelas: "A" }, { kelas: "A" }, { kelas: "C" }])).toEqual({ A: 2, B: 0, C: 1 });
  });
});
