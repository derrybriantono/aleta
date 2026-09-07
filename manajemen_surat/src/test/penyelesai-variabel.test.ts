// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  keHijriah,
  namaHari,
  nilaiFungsi,
  penandaDalam,
  sandikanUntukSql,
  sisipkanPenanda,
  tanggalHijriah,
  tanggalPanjang,
  urutanPenyelesaian,
  type DefinisiSelesai,
} from "@/lib/penyelesai-variabel";

/**
 * Penyelesai bertingkat (Tahap 2).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - variabel diselesaikan SESUDAH seluruh yang disebutnya - satu kali jalan
 *     tidak akan pernah cukup untuk 178 kueri bersarang;
 *   - lingkaran BERHENTI dengan menyebut variabelnya, bukan berputar selamanya
 *     dan bukan gagal tanpa keterangan;
 *   - nilai yang disisipkan ke dalam kueri DISANDIKAN - ABT membungkus penanda
 *     bersarang di dalam tanda kutip, dan nilai bertanda kutip akan membobolnya.
 */

function def(noVar: string, bersarang: string[] = [], lain: Partial<DefinisiSelesai> = {}): DefinisiSelesai {
  return {
    noVar,
    nama: lain.nama ?? "",
    jenis: lain.jenis ?? "data_sql",
    sqlQuery: lain.sqlQuery ?? "",
    dataTabel: lain.dataTabel ?? "",
    dataKolom: lain.dataKolom ?? "",
    kelas: lain.kelas ?? "A",
    bersarang,
  };
}

function kamusDari(daftar: DefinisiSelesai[]): Map<string, DefinisiSelesai> {
  return new Map(daftar.map((d) => [d.noVar, d]));
}

describe("urutan penyelesaian", () => {
  it("yang dasar diselesaikan lebih dulu", () => {
    // #0100# "Pekerjaan #0046#" tidak dapat diselesaikan sebelum #0046#.
    const kamus = kamusDari([def("0100", ["0046"]), def("0046", [])]);
    const hasil = urutanPenyelesaian(kamus);
    expect(hasil.urutan.indexOf("0046")).toBeLessThan(hasil.urutan.indexOf("0100"));
    expect(hasil.lingkaran).toEqual([]);
  });

  it("persarangan tiga lapis tetap urut", () => {
    const kamus = kamusDari([def("c", ["b"]), def("b", ["a"]), def("a", [])]);
    expect(urutanPenyelesaian(kamus).urutan).toEqual(["a", "b", "c"]);
  });

  it("satu variabel menunggu dua sekaligus", () => {
    // #2027# menyebut #1033# dan #0102# dalam satu kueri.
    const kamus = kamusDari([def("2027", ["1033", "0102"]), def("1033", []), def("0102", [])]);
    const hasil = urutanPenyelesaian(kamus);
    expect(hasil.urutan.indexOf("1033")).toBeLessThan(hasil.urutan.indexOf("2027"));
    expect(hasil.urutan.indexOf("0102")).toBeLessThan(hasil.urutan.indexOf("2027"));
  });

  it("urutannya ajek dari satu jalan ke jalan berikutnya", () => {
    // Urutan yang berubah-ubah membuat selisih antar dua penyusunan mustahil
    // dibaca - dan selisih itulah yang dipakai memeriksa naskah.
    const kamus = kamusDari([def("c", []), def("a", []), def("b", [])]);
    const pertama = urutanPenyelesaian(kamus).urutan;
    const kedua = urutanPenyelesaian(kamusDari([def("b", []), def("c", []), def("a", [])])).urutan;
    expect(pertama).toEqual(kedua);
  });
});

describe("lingkaran berhenti dengan menyebut variabelnya", () => {
  it("dua variabel yang saling menunjuk tidak membuat mesin berputar", () => {
    const kamus = kamusDari([def("a", ["b"]), def("b", ["a"])]);
    const hasil = urutanPenyelesaian(kamus);
    expect(hasil.urutan).toEqual([]);
    expect(hasil.lingkaran).toEqual(["a", "b"]);
  });

  it("lingkaran tidak menyeret variabel sehat ikut gagal", () => {
    const kamus = kamusDari([def("a", ["b"]), def("b", ["a"]), def("sehat", [])]);
    const hasil = urutanPenyelesaian(kamus);
    expect(hasil.urutan).toEqual(["sehat"]);
    expect(hasil.lingkaran).toEqual(["a", "b"]);
  });

  it("variabel yang menyebut dirinya sendiri terdeteksi", () => {
    const kamus = kamusDari([def("a", ["a"])]);
    expect(urutanPenyelesaian(kamus).lingkaran).toEqual(["a"]);
  });

  it("yang disebut tetapi tidak ada di kamus dilaporkan namanya", () => {
    const kamus = kamusDari([def("a", ["9999"])]);
    const hasil = urutanPenyelesaian(kamus);
    expect(hasil.takDikenal).toEqual(["9999"]);
    // #a# tetap dapat diselesaikan - yang hilang hanya salah satu bahannya,
    // dan itu akan tampak sebagai penanda tersisa saat penyisipan.
    expect(hasil.urutan).toEqual(["a"]);
  });
});

describe("penyandian nilai untuk kueri", () => {
  it("tanda kutip ganda tidak dapat membobol petikan", () => {
    // ABT menulis `select "#0015#" as data`. Nilai bertanda kutip akan menutup
    // petikannya dan sisa kalimatnya terbaca sebagai SQL.
    //
    // Yang diuji bukan hilangnya tanda kutip - ia memang boleh ada - melainkan
    // bahwa TIDAK ADA tanda kutip yang berdiri tanpa didahului tanda miring
    // balik. Itulah yang membuatnya tidak dapat menutup petikan.
    const jahat = sandikanUntukSql('Ali" or 1=1 -- ');
    expect(jahat).toBe('Ali\\" or 1=1 -- ');
    expect(/(^|[^\\])"/.test(jahat)).toBe(false);
    expect(/(^|[^\\])'/.test(sandikanUntukSql("Ali' or 1=1"))).toBe(false);
  });

  it("tanda miring balik disandikan lebih dulu, tidak berlipat keliru", () => {
    expect(sandikanUntukSql("a\\b")).toBe("a\\\\b");
  });

  it("baris baru dan bita kendali dibuang", () => {
    expect(sandikanUntukSql("a\nb\r\0c")).toBe("a b  c");
  });

  it("nilai yang teramat panjang dipotong", () => {
    expect(sandikanUntukSql("x".repeat(9000))).toHaveLength(500);
  });

  it("naskah biasa TIDAK disandikan - tanda miring balik tak pernah diketik siapa pun", () => {
    const nilai = new Map([["0098", 'Ali "Si Fulan"']]);
    expect(sisipkanPenanda("Nama #0098#;", nilai).teks).toBe('Nama Ali "Si Fulan";');
    expect(sisipkanPenanda('select "#0098#"', nilai, { untukSql: true }).teks).toBe(
      'select "Ali \\"Si Fulan\\""'
    );
  });
});

describe("penyisipan penanda", () => {
  it("penanda tanpa nilai DIBIARKAN utuh dan disebutkan", () => {
    const hasil = sisipkanPenanda("#0046# dan #9999#", new Map([["0046", "Penggugat"]]));
    expect(hasil.teks).toBe("Penggugat dan #9999#");
    expect(hasil.tersisa).toEqual(["9999"]);
  });

  it("penanda yang sama muncul dua kali terisi dua-duanya", () => {
    const hasil = sisipkanPenanda("#0046# lawan #0046#", new Map([["0046", "Penggugat"]]));
    expect(hasil.teks).toBe("Penggugat lawan Penggugat");
  });

  it("nilai kosong tetap dianggap ada - bukan penanda tersisa", () => {
    // Nilai yang memang kosong berbeda dari nilai yang tidak diketahui.
    const hasil = sisipkanPenanda("[#0046#]", new Map([["0046", ""]]));
    expect(hasil.teks).toBe("[]");
    expect(hasil.tersisa).toEqual([]);
  });

  it("penanda yang disebut sebuah teks terbaca tanpa kembar", () => {
    expect(penandaDalam("#0046# #0053# #0046#")).toEqual(["0046", "0053"]);
  });
});

describe("fungsi tanggal", () => {
  it("tanggal panjang dalam bentuk yang dipakai naskah pengadilan", () => {
    expect(tanggalPanjang("2026-09-04")).toBe("04 September 2026");
  });

  it("tanggal dibaca sebagai UTC, tidak mundur sehari", () => {
    // SIPP mengirim tengah malam UTC. Ditafsirkan waktu setempat, tanggalnya
    // mundur sehari di mesin sebelah barat - sidang tercatat di hari yang salah.
    expect(tanggalPanjang("2026-09-04T00:00:00.000Z")).toBe("04 September 2026");
    expect(namaHari("2026-09-04T00:00:00.000Z")).toBe("Jumat");
  });

  it("tanggal yang tidak terbaca menghasilkan kosong, bukan tebakan", () => {
    for (const buruk of ["", "bukan tanggal", null, undefined]) {
      expect(tanggalPanjang(buruk)).toBe("");
      expect(namaHari(buruk)).toBe("");
      expect(tanggalHijriah(buruk)).toBe("");
    }
  });
});

describe("pengalihan Hijriah", () => {
  it("cocok dengan penetapan sungguhan PA Donggala", () => {
    // Penetapan 206/Pdt.P/2026/PA.Dgl berbunyi: "hari Jumat tanggal
    // 04 September 2026 Masehi bertepatan dengan tanggal 21 Rabiul Awwal 1448
    // Hijriah". Inilah jangkarnya - bukan contoh buatan.
    expect(namaHari("2026-09-04")).toBe("Jumat");
    expect(tanggalHijriah("2026-09-04")).toBe("21 Rabiul Awwal 1448");

    const h = keHijriah("2026-09-04");
    expect(h).toEqual({ tahun: 1448, bulan: 3, tanggal: 21 });
  });

  it("bergerak sehari demi sehari tanpa melompat", () => {
    expect(tanggalHijriah("2026-09-03")).toBe("20 Rabiul Awwal 1448");
    expect(tanggalHijriah("2026-09-05")).toBe("22 Rabiul Awwal 1448");
  });

  it("bulan Hijriah selalu di antara 1 dan 12", () => {
    for (let hari = 0; hari < 400; hari += 7) {
      const d = new Date(Date.UTC(2026, 0, 1 + hari));
      const h = keHijriah(d.toISOString());
      expect(h, d.toISOString()).not.toBeNull();
      expect(h!.bulan).toBeGreaterThanOrEqual(1);
      expect(h!.bulan).toBeLessThanOrEqual(12);
      expect(h!.tanggal).toBeGreaterThanOrEqual(1);
      expect(h!.tanggal).toBeLessThanOrEqual(30);
    }
  });
});

describe("penjalan fungsi menurut jenis", () => {
  it("jenis yang dikenali dihitung", () => {
    expect(nilaiFungsi("data_tanggal", "2026-09-04")).toBe("04 September 2026");
    expect(nilaiFungsi("tanggal_hari", "2026-09-04")).toBe("Jumat");
    expect(nilaiFungsi("tanggal_hijriah", "2026-09-04")).toBe("21 Rabiul Awwal 1448");
  });

  it("jenis yang menuntut basis data mengembalikan null, bukan kosong", () => {
    // Kosong akan terbaca sebagai "sudah diselesaikan dan hasilnya nihil";
    // null memberitahu pemanggilnya bahwa variabel ini masih butuh SIPP.
    expect(nilaiFungsi("data_sql", "apa saja")).toBeNull();
    expect(nilaiFungsi("data_sipp", "apa saja")).toBeNull();
    expect(nilaiFungsi("data_teks", "apa saja")).toBeNull();
  });
});
