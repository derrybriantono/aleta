// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { kunciRekam, susunRekamAntrian } from "@/lib/rekam-antrian";
import { petaJarakAntarSidang, petaJarakBerikutSidang } from "@/lib/jarak-antar-sidang";

/**
 * ============================================================================
 * REKAM ANTRIAN - CATATAN ALETA SENDIRI TENTANG ANTRIAN SIDANG
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026: "tambahkan saya database di aleta
 * antrian sidang yaitu urutan antrian sidang, pengambilan antrian, siapa yang
 * ambil antrian sidang, perbandingan jarak antara perkara dengan perkara
 * selanjutnya".
 *
 * Yang dijaga di sini bukan bentuk tabelnya, melainkan angka-angkanya. Tabel
 * yang kolomnya lengkap tetapi jaraknya dihitung lintas hari, atau urutannya
 * dihitung lintas ruang, akan terbaca wajar selama berbulan-bulan - dan baru
 * ketahuan keliru ketika ada yang membandingkannya dengan jadwal sungguhan.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const migrasi = baca("manajemen_surat/drizzle/0048_rekam_antrian.sql");
const skema = baca("manajemen_surat/src/server/db/schema.ts");
const modul = baca("manajemen_surat/src/server/modules/aleta-ecourt/rekam-antrian.ts");
const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/rekam-antrian/route.ts");
const ruteSidang = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/route.ts");

/** Satu hari, dua ruang, jam panggil yang sengaja tidak berurutan di daftar. */
const SIDANG = [
  { perkaraId: "1", nomorPerkara: "1/Pdt.G", sidangId: "s1", tanggalSidang: "2026-09-22", ruangan: "Ruang 1" },
  { perkaraId: "2", nomorPerkara: "2/Pdt.G", sidangId: "s2", tanggalSidang: "2026-09-22", ruangan: "Ruang 1" },
  { perkaraId: "3", nomorPerkara: "3/Pdt.G", sidangId: "s3", tanggalSidang: "2026-09-22", ruangan: "Ruang 2" },
  { perkaraId: "4", nomorPerkara: "4/Pdt.G", sidangId: "s4", tanggalSidang: "2026-09-22", ruangan: "Ruang 1" },
];

const PETA = {
  "1": {
    nomor: 3,
    tanggalSidang: "2026-09-22",
    waktuAmbil: "08:10",
    jamPanggil: "09:00",
    online: true,
    keadaan: "dipanggil",
    namaPetugas: "Rahma",
  },
  "2": {
    nomor: 7,
    tanggalSidang: "2026-09-22",
    waktuAmbil: "08:40",
    jamPanggil: "09:20",
    online: false,
    keadaan: "menunggu",
    namaPetugas: "Rahma",
  },
  "3": {
    nomor: 5,
    tanggalSidang: "2026-09-22",
    waktuAmbil: "08:15",
    jamPanggil: "09:05",
    online: false,
    keadaan: "menunggu",
    namaPetugas: "Iwan",
  },
  "4": {
    nomor: 9,
    tanggalSidang: "2026-09-22",
    waktuAmbil: "09:30",
    jamPanggil: "10:30",
    online: false,
    keadaan: "menunggu",
    namaPetugas: "Rahma",
  },
};

const petaKunci = (baris: ReturnType<typeof susunRekamAntrian>) =>
  Object.fromEntries(baris.map((x) => [x.nomorPerkara, x]));

describe("keempat yang diminta sungguh terekam", () => {
  const hasil = petaKunci(susunRekamAntrian(SIDANG, PETA));

  it("(1) urutan antrian - nomornya DAN urutannya di dalam ruang", () => {
    // Keduanya berbeda dan keduanya ditanyakan. Nomor antrian dihitung lintas
    // ruang: perkara 3 bernomor 5 tetapi ia yang PERTAMA di Ruang 2.
    expect(hasil["3/Pdt.G"].nomorAntrian).toBe(5);
    expect(hasil["3/Pdt.G"].urutanRuang).toBe(1);

    expect(hasil["1/Pdt.G"].urutanRuang).toBe(1);
    expect(hasil["2/Pdt.G"].urutanRuang).toBe(2);
    expect(hasil["4/Pdt.G"].urutanRuang).toBe(3);
  });

  it("(2) pengambilan antrian - jam ambil dan jam panggilnya", () => {
    expect(hasil["1/Pdt.G"].waktuAmbil).toBe("08:10");
    expect(hasil["1/Pdt.G"].jamPanggil).toBe("09:00");
    expect(hasil["1/Pdt.G"].online).toBe(true);
    expect(hasil["2/Pdt.G"].online).toBe(false);
    expect(hasil["1/Pdt.G"].keadaan).toBe("dipanggil");
  });

  it("(3) siapa yang mengambil", () => {
    expect(hasil["1/Pdt.G"].namaPetugas).toBe("Rahma");
    expect(hasil["3/Pdt.G"].namaPetugas).toBe("Iwan");
  });

  it("(4) jarak ke perkara sebelum DAN sesudahnya", () => {
    // Ruang 1: 09:00 → 09:20 → 10:30
    expect(hasil["1/Pdt.G"].jarakSebelumMenit).toBeNull();
    expect(hasil["1/Pdt.G"].jarakBerikutMenit).toBe(20);
    expect(hasil["2/Pdt.G"].jarakSebelumMenit).toBe(20);
    expect(hasil["2/Pdt.G"].jarakBerikutMenit).toBe(70);
    expect(hasil["4/Pdt.G"].jarakSebelumMenit).toBe(70);
    expect(hasil["4/Pdt.G"].jarakBerikutMenit).toBeNull();
  });
});

describe("yang paling mudah salah diam-diam", () => {
  it("jarak dihitung PER RUANG - bukan atas seluruh daftar", () => {
    // Perkara 3 di Ruang 2 dipanggil 09:05, tepat di antara 09:00 dan 09:20
    // milik Ruang 1. Menghitung dalam satu deret menghasilkan jeda 5 menit
    // yang tidak pernah terjadi di ruang mana pun.
    const hasil = petaKunci(susunRekamAntrian(SIDANG, PETA));
    expect(hasil["3/Pdt.G"].jarakSebelumMenit).toBeNull();
    expect(hasil["3/Pdt.G"].jarakBerikutMenit).toBeNull();
    expect(hasil["2/Pdt.G"].jarakSebelumMenit).toBe(20);
  });

  it("jarak dihitung PER HARI - bukan lintas rentang", () => {
    // Rentang seminggu yang dihitung sekaligus menghasilkan "jeda" antara
    // sidang terakhir Senin dan sidang pertama Selasa - dua puluh jam ruang
    // menganggur yang tidak pernah dialami siapa pun.
    const dua = [
      ...SIDANG.slice(0, 1),
      {
        perkaraId: "9",
        nomorPerkara: "9/Pdt.G",
        sidangId: "s9",
        tanggalSidang: "2026-09-23",
        ruangan: "Ruang 1",
      },
    ];
    const petaDua = {
      ...PETA,
      "9": {
        nomor: 1,
        tanggalSidang: "2026-09-23",
        waktuAmbil: "08:00",
        jamPanggil: "09:00",
        online: false,
        keadaan: "menunggu",
        namaPetugas: "Rahma",
      },
    };
    const hasil = petaKunci(susunRekamAntrian(dua, petaDua));
    expect(hasil["1/Pdt.G"].jarakBerikutMenit).toBeNull();
    expect(hasil["9/Pdt.G"].jarakSebelumMenit).toBeNull();
  });

  it("baris antrian hari LAIN tidak dipakai", () => {
    // Peta antrian berkunci perkara, bukan sidang. Perkara yang bersidang dua
    // kali dalam rentang yang dibuka akan mendapat baris hari lain bila
    // tanggalnya tidak diperiksa - dan jam panggil hari lain itu masuk ke
    // perhitungan jarak tanpa satu pun tanda.
    const hasil = petaKunci(
      susunRekamAntrian(SIDANG, {
        ...PETA,
        "1": { ...PETA["1"], tanggalSidang: "2026-09-21" },
      })
    );
    expect(hasil["1/Pdt.G"].nomorAntrian).toBeNull();
    expect(hasil["1/Pdt.G"].jamPanggil).toBe("");
    // Dan jarak Ruang 1 kini dihitung tanpa dia.
    expect(hasil["2/Pdt.G"].jarakSebelumMenit).toBeNull();
  });

  it("yang BELUM mengambil nomor tetap direkam", () => {
    // "Perkara ini tidak pernah mengambil nomor" adalah keterangan, bukan
    // ketiadaan keterangan - ia yang menjawab berapa banyak sidang yang
    // berjalan di luar antrian.
    const hasil = susunRekamAntrian(SIDANG, {});
    expect(hasil).toHaveLength(4);
    for (const satu of hasil) {
      expect(satu.nomorAntrian).toBeNull();
      expect(satu.urutanRuang).toBeNull();
      expect(satu.namaPetugas).toBe("");
    }
  });

  it("baris tanpa sidang_id dibuang - ia tidak punya kunci", () => {
    const hasil = susunRekamAntrian(
      [...SIDANG, { perkaraId: "5", nomorPerkara: "5/Pdt.G", sidangId: "", tanggalSidang: "2026-09-22" }],
      PETA
    );
    expect(hasil.map((x) => x.nomorPerkara)).not.toContain("5/Pdt.G");
  });

  it("kuncinya tidak pernah kembar dalam satu susunan", () => {
    // Kunci kembar berarti baris yang satu menimpa yang lain diam-diam, dan
    // salah satu hari itu hilang dari riwayat tanpa berbunyi.
    const hasil = susunRekamAntrian(SIDANG, PETA);
    const kunci = hasil.map((x) => x.id);
    expect(new Set(kunci).size).toBe(kunci.length);
    expect(hasil[0].id).toBe(kunciRekam(SIDANG[0].tanggalSidang, SIDANG[0].sidangId));
  });
});

describe("dua arah jaraknya berasal dari urutan yang SAMA", () => {
  it("jarak-berikut satu baris = jarak-sebelum baris sesudahnya", () => {
    // Kalau keduanya mengurutkan dengan cara yang berbeda, dua angka yang
    // saling bertentangan akan tampil pada baris yang sama, dan tidak ada
    // pada layarnya yang memberi tahu mana yang benar.
    const bahan = [
      { kunci: "a", ruangan: "R1", jamPanggil: "09:00" },
      { kunci: "c", ruangan: "R1", jamPanggil: "10:30" },
      { kunci: "b", ruangan: "R1", jamPanggil: "09:20" },
    ];
    const sebelum = petaJarakAntarSidang(bahan);
    const berikut = petaJarakBerikutSidang(bahan);
    expect(berikut.a).toBe(sebelum.b);
    expect(berikut.b).toBe(sebelum.c);
    expect(berikut.c).toBeUndefined();
    expect(sebelum.a).toBeUndefined();
  });

  it("dipanggil bersamaan menghasilkan NOL, bukan kosong", () => {
    // Nol adalah keadaan yang sungguh terjadi dan patut diwarnai merah;
    // mengosongkannya menyembunyikan justru yang paling perlu dilihat.
    const bahan = [
      { kunci: "a", ruangan: "R1", jamPanggil: "09:00" },
      { kunci: "b", ruangan: "R1", jamPanggil: "09:00" },
    ];
    expect(petaJarakBerikutSidang(bahan).a).toBe(0);
    expect(petaJarakAntarSidang(bahan).b).toBe(0);
  });
});

describe("migrasi 0048", () => {
  it("nomornya diklaim di journal, dan tidak kembar", () => {
    const jurnal = JSON.parse(baca("manajemen_surat/drizzle/meta/_journal.json")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const idx = jurnal.entries.map((e) => e.idx);
    expect(new Set(idx).size, "ada idx kembar di journal").toBe(idx.length);
    const punya = jurnal.entries.find((e) => e.tag === "0048_rekam_antrian");
    expect(punya, "0048 belum terdaftar di journal").toBeTruthy();
    expect(punya?.idx).toBe(48);
  });

  it("tabelnya juga ada di jalur idempoten schema.ts", () => {
    // Migrasi saja tidak cukup: basis data dalam memori dan pemasangan yang
    // melewati migrasi mengandalkan jalur ini - dan pemasangan yang melewati
    // migrasi tetap berkata berhasil.
    expect(skema).toContain("CREATE TABLE IF NOT EXISTS aleta_rekam_antrian");
    expect(skema).toContain("idx_rekam_antrian_hari");
    expect(skema).toContain("idx_rekam_antrian_perkara");
  });

  it("keempat yang diminta punya kolomnya sendiri", () => {
    for (const kolom of [
      "nomor_antrian",
      "urutan_ruang",
      "waktu_ambil",
      "nama_petugas",
      "jarak_sebelum_menit",
      "jarak_berikut_menit",
    ]) {
      expect(migrasi, `kolom ${kolom} hilang dari migrasi`).toContain(kolom);
      expect(skema, `kolom ${kolom} hilang dari schema.ts`).toContain(kolom);
    }
  });

  it("jaraknya boleh NULL - tidak dipaksa NOT NULL DEFAULT 0", () => {
    // NULL berarti "tidak ada tetangga di sisi itu"; nol berarti "dipanggil
    // bersamaan". Memaksa nol membuat perkara pertama di tiap ruang terbaca
    // sebagai tabrakan jadwal.
    expect(migrasi).not.toMatch(/jarak_sebelum_menit\s+INTEGER\s+NOT NULL/i);
    expect(migrasi).not.toMatch(/jarak_berikut_menit\s+INTEGER\s+NOT NULL/i);
    expect(migrasi).not.toMatch(/urutan_ruang\s+INTEGER\s+NOT NULL/i);
  });
});

describe("cara menulisnya", () => {
  it("diperbarui, bukan ditumpuk - dan pertama_direkam_at tidak ikut ditimpa", () => {
    expect(modul).toContain("ON CONFLICT (id) DO UPDATE SET");
    const i = modul.indexOf("ON CONFLICT (id) DO UPDATE SET");
    const blok = modul.slice(i, modul.indexOf("`,", i));
    expect(blok).toContain("direkam_at = excluded.direkam_at");
    expect(blok, "pertama_direkam_at tidak boleh ikut ditimpa").not.toContain(
      "pertama_direkam_at = excluded"
    );
  });

  it("gagalnya tidak melempar - jadwal sidang tidak boleh jatuh karenanya", () => {
    // Rekaman adalah catatan tambahan; jadwal sidang adalah pekerjaan yang
    // sedang dikerjakan orang di depan ruang sidang.
    expect(modul).toContain("} catch (kesalahan) {");
    expect(modul).toContain("return {");
    expect(modul).toContain("gagal:");
  });

  it("ditulis di server dari data SIPP, bukan dikirim balik peramban", () => {
    // Catatan pelayanan yang dapat disunting lewat DevTools tidak berguna
    // sebagai catatan pelayanan.
    expect(ruteSidang).toContain("susunRekamAntrian");
    expect(ruteSidang).toContain("rekamAntrian(");
    expect(rute, "rute rekaman tidak boleh menerima tulisan dari luar").not.toContain(
      "export async function POST("
    );
    expect(rute).not.toContain("export async function PUT(");
    expect(rute).not.toContain("export async function DELETE(");
  });

  it("hanya direkam bila antriannya sungguh terbaca", () => {
    // Sambungan antrian yang sedang putus mengirim peta kosong. Merekamnya
    // akan menimpa nomor yang sudah benar dengan kosong - dan yang hilang
    // tidak dapat dibaca ulang esok hari, sebab tabel antriannya sudah dipakai
    // ulang.
    expect(ruteSidang).toContain("antrianData?.terbaca");
  });
});
