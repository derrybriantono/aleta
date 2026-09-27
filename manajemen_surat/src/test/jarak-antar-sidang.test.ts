import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  BATAS_JARAK,
  petaJarakAntarSidang,
  pitaJarak,
  sebutanJarak,
  selisihJam,
} from "@/lib/jarak-antar-sidang";

/**
 * ============================================================================
 * JARAK ANTAR PERKARA - LIMA WARNA ATAS SEBARAN TERUKUR
 * ============================================================================
 *
 * Ambangnya 5 / 15 / 30 / 60 menit, diukur atas 10.989 jarak dari 1.753
 * kelompok (hari x ruang) pada perkara_jadwal_sidang satker. Penjaga ini
 * memaku ambang itu: mengubahnya tanpa mengukur ulang berarti mengarang
 * warna, dan warna yang dikarang tetap tampak meyakinkan di layar.
 */

const AKAR = process.cwd();

describe("pitaJarak - lima warna, batas yang diukur", () => {
  it("batasnya persis yang terukur", () => {
    expect([...BATAS_JARAK]).toEqual([5, 15, 30, 60]);
  });

  it("tiap sisi batas jatuh ke pita yang benar", () => {
    // Batasnya EKSKLUSIF di bawah: tepat 5 menit sudah kuning, bukan hijau.
    expect(pitaJarak(0)?.pita).toBe("hijau");
    expect(pitaJarak(4.9)?.pita).toBe("hijau");
    expect(pitaJarak(5)?.pita).toBe("kuning");
    expect(pitaJarak(14.9)?.pita).toBe("kuning");
    expect(pitaJarak(15)?.pita).toBe("jingga");
    expect(pitaJarak(29.9)?.pita).toBe("jingga");
    expect(pitaJarak(30)?.pita).toBe("merah");
    expect(pitaJarak(59.9)?.pita).toBe("merah");
    expect(pitaJarak(60)?.pita).toBe("merah-gelap");
    expect(pitaJarak(600)?.pita).toBe("merah-gelap");
  });

  it("jarak negatif tidak dipaksakan menjadi nol", () => {
    // Urutan pemanggilan terbalik berarti datanya keliru. Menampilkannya
    // sebagai "0 menit, cepat" menyembunyikan kekeliruan itu di balik hijau.
    expect(pitaJarak(-1)).toBeNull();
    expect(pitaJarak(null)).toBeNull();
    expect(pitaJarak(undefined)).toBeNull();
    expect(pitaJarak(Number.NaN)).toBeNull();
  });

  it("kelima pita punya kelas warna yang berbeda", () => {
    const kelas = [0, 10, 20, 45, 120].map((m) => pitaJarak(m)?.kelas);
    expect(new Set(kelas).size).toBe(5);
  });
});

describe("selisihJam", () => {
  it("menghitung selisih menit pada hari yang sama", () => {
    expect(selisihJam("09:00", "09:07")).toBe(7);
    expect(selisihJam("09:00", "10:30")).toBe(90);
    expect(selisihJam("09:00", "09:00")).toBe(0);
  });

  it("jam yang tidak terbaca memulangkan null, BUKAN nol", () => {
    // Nol berarti dua perkara dipanggil pada menit yang sama - keterangan
    // yang berbeda sama sekali dari "belum dipanggil".
    for (const jam of ["", "-", "0000-00-00", "25:00", "09:99", "abc"]) {
      expect(selisihJam("09:00", jam), jam).toBeNull();
      expect(selisihJam(jam, "09:00"), jam).toBeNull();
    }
  });
});

describe("sebutanJarak - satuan yang dipakai orang", () => {
  it("menit di bawah sejam, jam di atasnya", () => {
    expect(sebutanJarak(7)).toBe("7 menit");
    expect(sebutanJarak(59)).toBe("59 menit");
    expect(sebutanJarak(60)).toBe("1 jam");
    expect(sebutanJarak(65)).toBe("1 jam 5 menit");
    expect(sebutanJarak(125)).toBe("2 jam 5 menit");
  });

  it("tidak pernah memulangkan '90 menit', yang harus dihitung sendiri", () => {
    expect(sebutanJarak(90)).toBe("1 jam 30 menit");
  });
});

describe("petaJarakAntarSidang", () => {
  it("menghitung per RUANG, bukan satu deret", () => {
    // Dua ruang sidang berjalan bersamaan. Satu deret menghasilkan jarak nol
    // dan satu menit yang tidak pernah terjadi di ruang mana pun - dan
    // seluruh warnanya menjadi hijau justru pada hari tersibuk.
    const peta = petaJarakAntarSidang([
      { kunci: "a", ruangan: "Ruang 1", jamPanggil: "09:00" },
      { kunci: "b", ruangan: "Ruang 2", jamPanggil: "09:02" },
      { kunci: "c", ruangan: "Ruang 1", jamPanggil: "09:35" },
      { kunci: "d", ruangan: "Ruang 2", jamPanggil: "09:40" },
    ]);
    expect(peta.c).toBe(35);
    expect(peta.d).toBe(38);
    // Yang pertama di ruangnya tidak punya jarak - dan tidak diberi nol.
    expect(peta.a).toBeUndefined();
    expect(peta.b).toBeUndefined();
  });

  it("diurut menurut jam panggil, bukan urutan yang diberikan", () => {
    // Daftar di layar dapat diurutkan menurut apa saja. Angka yang berubah
    // ketika kepala kolom ditekan bukan angka tentang sidang.
    const terbalik = petaJarakAntarSidang([
      { kunci: "akhir", ruangan: "R", jamPanggil: "10:00" },
      { kunci: "awal", ruangan: "R", jamPanggil: "09:00" },
    ]);
    expect(terbalik.akhir).toBe(60);
    expect(terbalik.awal).toBeUndefined();
  });

  it("yang belum dipanggil tidak ikut dan tidak merusak tetangganya", () => {
    const peta = petaJarakAntarSidang([
      { kunci: "a", ruangan: "R", jamPanggil: "09:00" },
      { kunci: "belum", ruangan: "R", jamPanggil: "" },
      { kunci: "c", ruangan: "R", jamPanggil: "09:20" },
    ]);
    expect(peta.belum).toBeUndefined();
    // c tetap berjarak dari a, bukan dari baris yang belum dipanggil.
    expect(peta.c).toBe(20);
  });

  it("daftar kosong tidak meledak", () => {
    expect(petaJarakAntarSidang([])).toEqual({});
  });
});

describe("terpasang di bawah tombol antrian", () => {
  const layar = fs.readFileSync(
    path.join(AKAR, "src/components/portal/aleta-ecourt-sidang.tsx"),
    "utf8"
  );

  // Sejak 27 September 2026 yang terpasang di sini TIGA jarak bernama
  // (TigaJarakSidang), menggantikan lencana "+X"/"→Y" - lihat
  // tiga-jarak-sidang.test.ts untuk perilakunya.
  it("dipakai sesudah TombolAmbilAntrian, bukan di kolom lain", () => {
    const iTombol = layar.indexOf("<TombolAmbilAntrian");
    const iJarak = layar.indexOf("<TigaJarakSidang");
    expect(iTombol).toBeGreaterThan(-1);
    expect(iJarak).toBeGreaterThan(iTombol);
  });

  it("petanya dihitung SEKALI, bukan di dalam tiap baris", () => {
    // Baris yang mencari tetangganya sendiri menyapu daftar penuh untuk tiap
    // baris - pada jadwal dua puluh perkara itu empat ratus penyapuan.
    expect(layar).toContain("const tigaJarak = useMemo(");
    expect(layar.match(/hitungTigaJarak\(/g)?.length).toBe(1);
  });

  it("lencana lama tidak hidup berdampingan dengan tiga jarak", () => {
    // Dua cara menghitung jarak yang sama di satu layar adalah persis
    // kebingungan yang dikeluhkan pengguna 27 September 2026.
    expect(layar).not.toContain("function JarakAntarSidang(");
    expect(layar).not.toContain("<JarakAntarSidang");
    expect(layar).not.toContain("petaJarakAntarSidang(");
    expect(layar).not.toContain("petaJarakBerikutSidang(");
  });

  it("aturan warnanya diimpor, tidak ditulis ulang di layar", () => {
    expect(layar).toContain('from "@/lib/jarak-antar-sidang"');
    expect(layar).not.toContain("BATAS_JARAK = [");
  });
});
