// @vitest-environment node
/**
 * ============================================================================
 * 21 OKT 2026 (AGEN W2b-B) - ISIAN OTOMATIS KELUARGA ANAK: HAK ASUH, PENGUASAAN ANAK, NAFKAH ANAK
 * ============================================================================
 *
 * Perilaku yang dijaga (modul dijalankan SUNGGUHAN atas kalimat posita/petitum berbentuk gugatan PA Donggala; nama diganti nama rekaan,
 * bentuk kalimat disalin dari perkara cerai gugat 2016-2026 di SIPP lokal yang memuat tuntutan hak asuh dan nafkah anak):
 *   - 4890 hanya bila PETITUM meminta anak diserahkan (bukan menyerahkan nafkah atau pengasuhan bersama);
 *   - 4899 nominal nafkah anak yang DITUNTUT; angka dan terbilang yang berbeda di petitum tidak diam-diam "diperbaiki";
 *   - 4888 frasa waktu bertemu; 4884 dan 4901 hanya kalimat yang subjeknya tepat; 4905 hanya anak < 21 tahun di dua sisi batas 12 tahun;
 *   - semua usulan "ragu" dan menjaga isian lama; tidak ada kata aplikasi; jenis non-anak tidak menghasilkan apa pun;
 *   - tersambung ke jalur S6 (usulanDariKonteks) dan tidak masuk daftar kode "pasti/cukup" tanpa ukuran di gerbang.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const req = createRequire(path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"));
const anak = req("../services/isiOtomatisW2b/anak.js");
const s6 = req("../services/isiOtomatisJenisS6.js");
const gerbang = req("../services/gerbangIsian.js");

const nilai = (daftar: any[], kode: string) => daftar.find((x) => x.kode === kode);

const PETITUM_ASUH = `<ol>
 <li>Mengabulkan gugatan Penggugat untuk seluruhnya;</li>
 <li>Menetapkan Penggugat sebagai pemegang hak asuh anak bernama Aisyah binti Budi;</li>
 <li>Menghukum Tergugat untuk menyerahkan anak yang bernama Aisyah binti Budi kepada Penggugat;</li>
 <li>Menghukum Tergugat memberikan nafkah anak sebesar Rp1.500.000,00 (satu juta lima ratus ribu rupiah) setiap bulan sampai anak dewasa;</li>
 <li>Membebankan biaya perkara menurut hukum;</li>
</ol>`;

const POSITA_ASUH = `<p>1. Bahwa Penggugat dan Tergugat telah menikah pada tahun 2015. 2. Bahwa dari perkawinan tersebut telah dikaruniai 3 (tiga) orang anak yang bernama : Fajar bin Budi, usia 14 tahun ; Nisa binti Budi, usia 8 tahun ; Rafi bin Budi, usia 4 tahun. 3. Bahwa Penggugat sehat jasmani dan rohani, bekerja sebagai guru dan memiliki rumah sendiri sehingga mampu mengasuh anak. 4. Bahwa Tergugat tidak memiliki penghasilan tetap sehingga nafkah anak tidak pernah diberikan. 5. Bahwa Tergugat memberi kesempatan kepada Penggugat bertemu anak setiap akhir pekan.</p>`;

describe("pembaca petitum dan posita keluarga anak", () => {
  it("4890 hanya bila petitum meminta anak diserahkan; menyerahkan nafkah atau pengasuhan bersama bukan penyerahan anak", () => {
    const u = anak.usulanAnak({ jenisPerkaraId: 349, posita: POSITA_ASUH, petitum: PETITUM_ASUH });
    expect(nilai(u, "4890").nilai).toBe("1");
    expect(nilai(u, "4890").sumber[0].kalimat).toMatch(/menyerahkan anak yang bernama Aisyah/);
    const nafkah = anak.usulanAnak({ jenisPerkaraId: 349, posita: "", petitum: "<ol><li>Menghukum Tergugat untuk menyerahkan kepada Penggugat nafkah 3 (tiga) orang anak bernama : Fajar, lahir tanggal 3 Mei 2011;</li></ol>" });
    expect(nilai(nafkah, "4890")).toBeUndefined();
    const bersama = anak.usulanAnak({ jenisPerkaraId: 349, posita: "", petitum: "<ol><li>Menghukum Tergugat untuk menyerahkan pengasuhan dan pemeliharaan anak dalam pengasuhan BERSAMA.</li></ol>" });
    expect(nilai(bersama, "4890")).toBeUndefined();
  });

  it("4899 nominal nafkah anak yang dituntut dengan terbilang; kosong bila petitum tidak menyebut uang", () => {
    const u = anak.usulanAnak({ jenisPerkaraId: 350, posita: "", petitum: PETITUM_ASUH });
    expect(nilai(u, "4899").nilai).toBe("Rp1.500.000,00 (satu juta lima ratus ribu rupiah)");
    expect(nilai(u, "4899").catatan).toMatch(/DITUNTUT/);
    expect(nilai(anak.usulanAnak({ jenisPerkaraId: 350, posita: "", petitum: "<ol><li>Menghukum Tergugat memberikan nafkah anak setiap bulan;</li></ol>" }), "4899")).toBeUndefined();
  });

  it("4899: angka dan terbilang yang berbeda di petitum dipertahankan apa adanya dan diberi peringatan", () => {
    const pet = "<ol><li>Menghukum kepada TERGUGAT memberikan nafkah hidup dan biaya pendidikan kepada anak sebesar Rp. 1.000,- (satu juta rupiah) / bulan sampai anak dewasa</li></ol>";
    const u = nilai(anak.usulanAnak({ jenisPerkaraId: 350, posita: "", petitum: pet }), "4899");
    expect(u.nilai).toBe("Rp. 1.000,- (satu juta rupiah)");
    expect(u.catatan).toMatch(/berbeda/i);
  });

  it("4888 frasa waktu bertemu dari petitum atau posita; tanpa frasa waktu tidak diisi", () => {
    const u = anak.usulanAnak({ jenisPerkaraId: 349, posita: POSITA_ASUH, petitum: "" });
    expect(nilai(u, "4888").nilai).toBe("setiap akhir pekan");
    const tanpa = anak.usulanAnak({ jenisPerkaraId: 349, posita: "<p>Bahwa Penggugat ingin bertemu anak dan memberi akses.</p>", petitum: "" });
    expect(nilai(tanpa, "4888")).toBeUndefined();
    const pet = "<ol><li>Menghukum Penggugat rekonvensi untuk memberikan akses kepada Tergugat rekonvensi dalam bertemu anak pada hari libur atau waktu lain yang disepakati;</li></ol>";
    expect(nilai(anak.usulanAnak({ jenisPerkaraId: 349, posita: "", petitum: pet }), "4888").nilai).toBe("pada hari libur atau waktu lain yang disepakati");
  });

  it("4884 hanya kalimat yang subjeknya Penggugat dan tidak menyebut Tergugat; sebutan diganti penanda", () => {
    const u = nilai(anak.usulanAnak({ jenisPerkaraId: 349, posita: POSITA_ASUH, petitum: "" }), "4884");
    expect(u.nilai).toBe("#0046# sehat jasmani dan rohani, bekerja sebagai guru dan memiliki rumah sendiri sehingga mampu mengasuh anak");
    const salah = anak.usulanAnak({ jenisPerkaraId: 349, posita: "<p>Bahwa Penggugat dan Tergugat sering bertengkar dan Tergugat bekerja sebagai sopir sehingga anak jarang diurus.</p>", petitum: "" });
    expect(nilai(salah, "4884")).toBeUndefined();
  });

  it("4901 hanya bila yang tidak mampu adalah Tergugat atau ayah; 'sakit hati' dan kesulitan Penggugat tidak dihitung", () => {
    const u = nilai(anak.usulanAnak({ jenisPerkaraId: 350, posita: POSITA_ASUH, petitum: PETITUM_ASUH }), "4901");
    expect(u.nilai).toMatch(/^#0047# tidak memiliki penghasilan tetap/);
    expect(nilai(anak.usulanAnak({ jenisPerkaraId: 350, posita: "<p>Bahwa Penggugat sakit hati dan tidak mampu bekerja karena melahirkan sehingga biaya anak sulit.</p>", petitum: "" }), "4901")).toBeUndefined();
    expect(nilai(anak.usulanAnak({ jenisPerkaraId: 350, posita: "<p>Bahwa Tergugat sakit hati kepada Penggugat dan nafkah anak tidak diberikan.</p>", petitum: "" }), "4901")).toBeUndefined();
  });

  it("4905 hanya bila anak di bawah 21 tahun berada di dua sisi batas 12 tahun; anak dewasa tidak ikut; pemegang hak asuh anak mumayyiz dikosongkan untuk majelis", () => {
    const u = nilai(anak.usulanAnak({ jenisPerkaraId: 349, posita: POSITA_ASUH, petitum: "" }), "4905");
    const baris = u.nilai.split("\n");
    expect(baris).toEqual(["Fajar bin Budi - mumayyiz memilih -", "Nisa binti Budi - belum mumayyiz - ibu kandung", "Rafi bin Budi - belum mumayyiz - ibu kandung"]);
    const semuaKecil = POSITA_ASUH.replace("usia 14 tahun", "usia 10 tahun");
    expect(nilai(anak.usulanAnak({ jenisPerkaraId: 349, posita: semuaKecil, petitum: "" }), "4905")).toBeUndefined();
    const dewasa = POSITA_ASUH.replace("usia 14 tahun", "usia 23 tahun");
    const d = nilai(anak.usulanAnak({ jenisPerkaraId: 349, posita: dewasa, petitum: "" }), "4905");
    expect(d).toBeUndefined();
  });
});

describe("sifat usulan dan sambungan", () => {
  const u = anak.usulanAnak({ jenisPerkaraId: 349, posita: POSITA_ASUH, petitum: PETITUM_ASUH }).concat(anak.usulanAnak({ jenisPerkaraId: 350, posita: POSITA_ASUH, petitum: PETITUM_ASUH }));
  it("semua usulan berkeyakinan ragu, menjaga isian lama, membawa sumber dan tanpa kata aplikasi", () => {
    expect(u.length).toBeGreaterThanOrEqual(8);
    for (const x of u) {
      expect(x.keyakinan, x.kode).toBe("ragu");
      expect(x.jagaIsianLama, x.kode).toBe(true);
      expect(x.sumber.length, x.kode).toBe(1);
      expect(x.nilai.length, x.kode).toBeGreaterThan(0);
      expect(JSON.stringify(x), x.kode).not.toMatch(/aleta/i);
      expect(anak.KODE).toContain(x.kode);
    }
  });
  it("jenis di luar keluarga anak, dan Lain-Lain yang bukan hak asuh, tidak menghasilkan apa pun", () => {
    expect(anak.usulanAnak({ jenisPerkaraId: 347, posita: POSITA_ASUH, petitum: PETITUM_ASUH })).toEqual([]);
    expect(anak.usulanAnak({ jenisPerkaraId: 369, posita: "<p>Bahwa Pemohon memohon penetapan mafqud suaminya.</p>", petitum: "<ol><li>Menetapkan mafqud;</li></ol>" })).toEqual([]);
    expect(anak.usulanAnak({ jenisPerkaraId: 369, posita: POSITA_ASUH, petitum: PETITUM_ASUH }).length).toBeGreaterThan(0);
  });
  it("tersambung ke jalur S6 (usulanDariKonteks) untuk 349 dan 350", () => {
    const k = s6.usulanDariKonteks({ jenisPerkaraId: 349, posita: POSITA_ASUH, petitum: PETITUM_ASUH, pihak1: ["Siti"], pihak2: ["Budi"], tanggalDaftar: "2026-03-01" });
    expect(nilai(k, "4890").nilai).toBe("1");
    expect(nilai(k, "4899").nilai).toMatch(/^Rp1\.500\.000,00/);
    const n = s6.usulanDariKonteks({ jenisPerkaraId: 350, posita: POSITA_ASUH, petitum: PETITUM_ASUH, pihak1: ["Siti"], pihak2: ["Budi"], tanggalDaftar: "2026-03-01" });
    expect(nilai(n, "4899")).toBeTruthy();
    expect(nilai(n, "4890")).toBeUndefined();
  });
  it("gerbang: kode keluarga anak tidak pernah ditulis pasti atau cukup oleh pengisi", () => {
    const dipindai = gerbang.pindaiPengisi();
    for (const kode of anak.KODE) {
      const lokasi = (dipindai[kode] || []).filter((l: string) => l.startsWith("isiOtomatisW2b/anak.js"));
      expect(lokasi, kode).toEqual([]);
    }
  });
});
