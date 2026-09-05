// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  aturanBatasSumber,
  nilaiKesegaran,
  periksaSumber,
  type Sumber,
} from "@/lib/jalur-aplikasi";
import {
  AMBANG_DITOLAK,
  MINIMAL_DIPAKAI,
  hitungKeberhasilan,
  saringSuntingan,
} from "@/lib/keberhasilan-pustaka";
import {
  AMBANG_HENTI_KUAT,
  AMBANG_PERINGATAN,
  bolehPanggil,
  hitungBiaya,
  hitungPagu,
  tingkatUntuk,
} from "@/lib/pagu-ai";

/**
 * Mutu, biaya, dan perluasan (K1-K7).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Empat keputusan yang menentukan apakah kelompok ini berguna atau hanya
 * menambah tombol:
 *
 *   - pagu habis mengembalikan ALETA ke pustaka saja, BUKAN menghentikannya.
 *     Pagu yang menghentikan segalanya akan dinaikkan sampai tidak pernah
 *     habis, yang sama saja dengan tidak ada pagu;
 *   - model kuat berhenti LEBIH DULU daripada model hemat, supaya sisa pagu
 *     cukup untuk pekerjaan murah yang berjalan sepanjang hari;
 *   - ukuran keberhasilan adalah BERKURANGNYA pemakaian AI; dan
 *   - butir yang baru dipakai dua kali TIDAK dinilai, betapa pun tinggi
 *     persentase penolakannya.
 */

// ── K1 pagu ────────────────────────────────────────────────────────────────

describe("pagu AI", () => {
  it("pagu belum disetel berarti tidak dibatasi, bukan habis", () => {
    // Membacanya sebagai habis akan mematikan seluruh lapisan AI pada
    // pemasangan baru, dan yang memasangnya mengira ada kerusakan.
    const keadaan = hitungPagu({ pagu: 0, terpakai: 0 });
    expect(keadaan.tingkat).toBe("aman");
    expect(keadaan.bolehKuat).toBe(true);
    expect(keadaan.pesan).toContain("belum disetel");
  });

  it("di bawah 70 persen tidak ada pesan apa pun", () => {
    const keadaan = hitungPagu({ pagu: 500_000, terpakai: 300_000 });
    expect(keadaan.tingkat).toBe("aman");
    expect(keadaan.pesan).toBe("");
  });

  it("peringatan muncul di 70 persen, bukan setelah habis", () => {
    // Peringatan yang datang saat pagu habis tidak dapat ditindaklanjuti -
    // yang membacanya sudah tidak punya pilihan.
    const keadaan = hitungPagu({ pagu: 500_000, terpakai: 500_000 * AMBANG_PERINGATAN });
    expect(keadaan.tingkat).toBe("peringatan");
    expect(keadaan.persen).toBe(70);
    expect(keadaan.bolehKuat).toBe(true);
    expect(keadaan.pesan).toContain("Masih ada waktu memutuskan");
  });

  it("model kuat berhenti di 90 persen, model hemat masih jalan", () => {
    // Menghentikan keduanya bersamaan berarti penarikan fakta - yang biayanya
    // kecil - ikut mati karena satu penyusunan menghabiskan sisanya.
    const keadaan = hitungPagu({ pagu: 500_000, terpakai: 500_000 * AMBANG_HENTI_KUAT });
    expect(keadaan.bolehKuat).toBe(false);
    expect(keadaan.bolehHemat).toBe(true);
    expect(keadaan.pesan).toContain("dihentikan lebih dulu");
  });

  it("pagu habis mengembalikan ke pustaka saja, dan pesannya mengatakan itu", () => {
    const keadaan = hitungPagu({ pagu: 500_000, terpakai: 520_000 });
    expect(keadaan.tingkat).toBe("habis");
    expect(keadaan.bolehKuat).toBe(false);
    expect(keadaan.bolehHemat).toBe(false);
    expect(keadaan.pesan).toContain("pustaka saja");
    expect(keadaan.pesan).toContain("draf tetap dirakit");
  });

  it("sisa tidak pernah negatif", () => {
    expect(hitungPagu({ pagu: 500_000, terpakai: 900_000 }).sisa).toBe(0);
  });
});

describe("model sesuai pekerjaan", () => {
  it("hanya penyusunan pertimbangan yang menuntut model kuat", () => {
    expect(tingkatUntuk("susunPertimbangan")).toBe("kuat");
    expect(tingkatUntuk("tarikFakta")).toBe("hemat");
    expect(tingkatUntuk("percakapan")).toBe("hemat");
  });

  it("di 90 persen, penyusunan ditolak tetapi penarikan fakta masih boleh", () => {
    const keadaan = hitungPagu({ pagu: 500_000, terpakai: 460_000 });
    expect(bolehPanggil("susunPertimbangan", keadaan).boleh).toBe(false);
    expect(bolehPanggil("tarikFakta", keadaan).boleh).toBe(true);
  });

  it("penolakan menyertakan sebabnya untuk ditampilkan", () => {
    const keadaan = hitungPagu({ pagu: 500_000, terpakai: 500_000 });
    const hasil = bolehPanggil("tarikFakta", keadaan);
    expect(hasil.boleh).toBe(false);
    expect(hasil.sebab).toContain("habis");
  });
});

describe("menghitung biaya panggilan", () => {
  it("dihitung dari token dan tarif yang diberikan", () => {
    expect(
      hitungBiaya({
        tokenMasuk: 1_000_000,
        tokenKeluar: 500_000,
        tarifMasukPerJuta: 3000,
        tarifKeluarPerJuta: 15000,
      })
    ).toBe(3000 + 7500);
  });

  it("tarif nol menghasilkan biaya nol, bukan galat", () => {
    expect(
      hitungBiaya({ tokenMasuk: 1000, tokenKeluar: 1000, tarifMasukPerJuta: 0, tarifKeluarPerJuta: 0 })
    ).toBe(0);
  });

  it("angka negatif diperlakukan nol", () => {
    expect(
      hitungBiaya({ tokenMasuk: -5, tokenKeluar: -5, tarifMasukPerJuta: 3000, tarifKeluarPerJuta: 3000 })
    ).toBe(0);
  });
});

// ── K4 ukuran keberhasilan ─────────────────────────────────────────────────

describe("ukuran keberhasilan pustaka", () => {
  it("angka yang naik adalah draf yang selesai TANPA model", () => {
    const hasil = hitungKeberhasilan({ jumlahDraf: 10, tanpaModel: 8, denganModel: 2, tanpaButir: 0 });
    expect(hasil.persenTanpaModel).toBe(80);
    expect(hasil.kalimat).toContain("80 persen");
  });

  it("draf tanpa butir TIDAK dihitung sebagai keberhasilan", () => {
    // Menghitungnya akan membuat angka ini tertinggi justru pada hari pustaka
    // masih kosong - persis kebalikan dari yang hendak diukur.
    const hasil = hitungKeberhasilan({ jumlahDraf: 10, tanpaModel: 2, denganModel: 0, tanpaButir: 8 });
    expect(hasil.persenTanpaModel).toBe(100);
    expect(hasil.kalimat).toContain("2 dari 2 draf berbutir");
    expect(hasil.kalimat).toContain("8 draf lain belum memuat butir");
  });

  it("seluruh draf tanpa butir dinyatakan apa adanya", () => {
    const hasil = hitungKeberhasilan({ jumlahDraf: 5, tanpaModel: 0, denganModel: 0, tanpaButir: 5 });
    expect(hasil.persenTanpaModel).toBe(0);
    expect(hasil.kalimat).toContain("Pustaka belum menjawab apa pun");
  });

  it("tanpa draf sama sekali tidak menghasilkan kalimat", () => {
    expect(hitungKeberhasilan({ jumlahDraf: 0, tanpaModel: 0, denganModel: 0, tanpaButir: 0 }).kalimat).toBe("");
  });
});

// ── K5 belajar dari suntingan ──────────────────────────────────────────────

describe("belajar dari suntingan", () => {
  it("butir yang baru dipakai sedikit TIDAK dinilai", () => {
    // Satu penolakan pada satu pemakaian menghasilkan 100 persen, dan angka
    // itu akan menaikkannya ke puncak daftar tanpa arti apa pun.
    const temuan = saringSuntingan([
      { butirId: "b1", teks: "x", jumlahDipakai: MINIMAL_DIPAKAI - 1, jumlahDitolak: 4, alasan: [] },
    ]);
    expect(temuan).toEqual([]);
  });

  it("butir yang sering ditolak muncul beserta alasannya", () => {
    const temuan = saringSuntingan([
      {
        butirId: "b1",
        teks: "Menimbang, bahwa ...",
        jumlahDipakai: 20,
        jumlahDitolak: 18,
        alasan: ["tidak sesuai fakta", "terlalu umum"],
      },
    ]);
    expect(temuan).toHaveLength(1);
    expect(temuan[0].persenDitolak).toBe(90);
    expect(temuan[0].alasan).toContain("tidak sesuai fakta");
  });

  it("hasilnya SARAN untuk dibaca, bukan tindakan", () => {
    // Butir yang sering ditolak mungkin keliru, mungkin dipakai pada jenis
    // perkara yang salah, mungkin hakimnya yang keliru.
    const temuan = saringSuntingan([
      { butirId: "b1", teks: "x", jumlahDipakai: 10, jumlahDitolak: 9, alasan: [] },
    ]);
    expect(temuan[0].saran).toContain("Periksa");
  });

  it("di bawah ambang tidak muncul", () => {
    const temuan = saringSuntingan([
      {
        butirId: "b1",
        teks: "x",
        jumlahDipakai: 20,
        jumlahDitolak: Math.floor(20 * AMBANG_DITOLAK) - 1,
        alasan: [],
      },
    ]);
    expect(temuan).toEqual([]);
  });

  it("yang seri persentasenya diurutkan menurut berapa kali dipakai", () => {
    // Butir yang dipakai dua ratus kali lebih mendesak daripada yang dipakai
    // lima kali dengan persentase sama.
    const temuan = saringSuntingan([
      { butirId: "jarang", teks: "x", jumlahDipakai: 10, jumlahDitolak: 5, alasan: [] },
      { butirId: "sering", teks: "y", jumlahDipakai: 200, jumlahDitolak: 100, alasan: [] },
    ]);
    expect(temuan.map((item) => item.butirId)).toEqual(["sering", "jarang"]);
  });
});

// ── K7 jalur aplikasi baru ─────────────────────────────────────────────────

function sumber(lebih: Partial<Sumber> = {}): Sumber {
  return {
    kode: "db_surat",
    nama: "Manajemen Surat",
    asal: "MySQL db_surat di 127.0.0.1",
    hanyaBaca: true,
    umurWajarJam: 24,
    ruas: [{ nama: "db_suratNomor", batas: "samar", keterangan: "Nomor surat menunjuk berkas nyata." }],
    didaftarkanOleh: "Pranata Komputer",
    atasPerintah: "Sekretaris",
    ...lebih,
  };
}

describe("syarat masuk sumber aplikasi baru", () => {
  it("sumber lengkap diterima", () => {
    expect(periksaSumber(sumber()).ok).toBe(true);
  });

  it("sumber yang bukan hanya-baca DITOLAK", () => {
    // Aturan ini pernah hampir dilanggar karena "cuma menandai sudah terbaca".
    const hasil = periksaSumber(sumber({ hanyaBaca: false }));
    expect(hasil.ok).toBe(false);
    expect(hasil.halangan.join(" ")).toContain("hanya-baca");
  });

  it("umur wajar wajib dinyatakan", () => {
    // Sumber yang tidak menyatakannya akan dibaca seolah selalu mutakhir.
    const hasil = periksaSumber(sumber({ umurWajarJam: 0 }));
    expect(hasil.ok).toBe(false);
    expect(hasil.halangan.join(" ")).toContain("Umur wajar");
  });

  it("ruas wajib didaftarkan beserta batasnya", () => {
    // J5 memperlakukan ruas tak dikenal sebagai terlarang; tanpa pendaftaran,
    // sumbernya tersambung tetapi tidak satu pun datanya dapat dipakai.
    expect(periksaSumber(sumber({ ruas: [] })).ok).toBe(false);
  });

  it("ruas berbatas bebas wajib beralasan", () => {
    const hasil = periksaSumber(
      sumber({ ruas: [{ nama: "db_suratJumlah", batas: "bebas", keterangan: "" }] })
    );
    expect(hasil.ok).toBe(false);
    expect(hasil.halangan.join(" ")).toContain("beralasan");
  });

  it("atas perintah siapa wajib disebut", () => {
    expect(periksaSumber(sumber({ atasPerintah: "" })).ok).toBe(false);
  });

  it("ruas tanpa awalan kode sumbernya diperingatkan, bukan ditolak", () => {
    const hasil = periksaSumber(
      sumber({ ruas: [{ nama: "nomor", batas: "samar", keterangan: "x" }] })
    );
    expect(hasil.ok).toBe(true);
    expect(hasil.peringatan.join(" ")).toContain("tidak berawalan");
  });

  it("kode yang tidak sah ditolak", () => {
    expect(periksaSumber(sumber({ kode: "DB Surat!" })).ok).toBe(false);
  });

  it("aturan batasnya dapat dipakai penyaring J5", () => {
    const aturan = aturanBatasSumber(sumber());
    expect(aturan[0].ruas).toBe("db_suratNomor");
    expect(aturan[0].batas).toBe("samar");
  });
});

describe("kesegaran data sumber", () => {
  const SEKARANG = new Date("2026-09-06T12:00:00.000Z");

  it("data dalam batas wajar dinyatakan segar", () => {
    const hasil = nilaiKesegaran(sumber({ umurWajarJam: 24 }), "2026-09-06T00:00:00.000Z", SEKARANG);
    expect(hasil.segar).toBe(true);
    expect(hasil.keterangan).toBe("");
  });

  it("data yang lewat umurnya DITAMPILKAN dengan umurnya, bukan disembunyikan", () => {
    // Menyembunyikannya membuat layar kosong yang terbaca sebagai "tidak ada
    // data", padahal yang benar "datanya ada, hanya lama".
    const hasil = nilaiKesegaran(sumber({ umurWajarJam: 24 }), "2026-09-01T00:00:00.000Z", SEKARANG);
    expect(hasil.segar).toBe(false);
    expect(hasil.umurJam).toBeGreaterThan(24);
    expect(hasil.keterangan).toContain("Ditampilkan apa adanya");
  });

  it("waktu pengambilan yang tidak tercatat dinyatakan begitu", () => {
    const hasil = nilaiKesegaran(sumber(), "", SEKARANG);
    expect(hasil.segar).toBe(false);
    expect(hasil.keterangan).toContain("tidak tercatat");
  });
});
