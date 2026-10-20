// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  bacaPermintaanUnduhEvidenSkp,
  bacaPermintaanUnduhSkp,
  mulaiPeriodeEvidenSkp,
  mulaiPeriodeSkpJabatan,
  PILIHAN_PERIODE_BULANAN_SKP,
  PILIHAN_PERIODE_EVIDEN_SKP,
  susunPeriodeSkpJabatan,
  alamatUnduhSkp,
} from "@/lib/eviden-skp-unduh";
import { hitungIndikatorSkp, hitungLembarSkp, type KonteksHitungSkp } from "@/lib/skp-jabatan-hitung";
import {
  KUNCI_FAKTA_ALETA_SKP_JABATAN,
  KUNCI_FAKTA_SKP_JABATAN,
  SKP_JABATAN_2026,
  kunciFaktaIndikator,
  type DefIndikatorSkp,
} from "@/lib/skp-jabatan-katalog";
import {
  GRUP_SIPP_JABATAN,
  JABATAN_SKP,
  type FaktaAkunSkp,
  type IsianManualSkp,
  type KejadianSkp,
  type PegawaiSkp,
  type TargetSkpJabatan,
} from "@/lib/skp-jabatan-tipe";

/**
 * ============================================================================
 * KATALOG DAN ATURAN HITUNG SKP JABATAN
 * ============================================================================
 *
 * Yang dijaga: setiap jabatan punya RHK berindikator Kuantitas/Kualitas/Waktu
 * dengan kunci yang konsisten (dasar kontrak dengan bot), penyebut nol dan
 * data tak terbaca TIDAK PERNAH menjadi 0, isian draf tidak dihitung, periode
 * bulanan sah di jalur unduh baru TANPA mengubah jalur hakim lama.
 */

const PERIODE = susunPeriodeSkpJabatan("b03", 2026);

const kejadian = (over: Partial<KejadianSkp> = {}): KejadianSkp => ({
  perkaraId: "1",
  nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
  tanggal: "2026-03-10",
  tanggalAcuan: "2026-03-10",
  nilai: null,
  keterangan: null,
  ...over,
});

const akun = (fakta: FaktaAkunSkp["fakta"], over: Partial<FaktaAkunSkp> = {}): FaktaAkunSkp => ({
  username: "ketua",
  userIdSipp: "85",
  nama: "Ketua Uji",
  grup: [10],
  jabatanDugaan: "ketua",
  aktif: true,
  fakta,
  ...over,
});

const baca = (kunci: string, daftar: KejadianSkp[]) => ({ kunci, terbaca: true, kejadian: daftar, galat: null });
const tidakTerbaca = (kunci: string) => ({ kunci, terbaca: false, kejadian: [], galat: "Bagian SIPP tidak terbaca." });

function konteks(akunUji: FaktaAkunSkp[], ubah: Partial<KonteksHitungSkp> = {}): KonteksHitungSkp {
  return {
    akun: akunUji,
    periode: PERIODE,
    batas: PERIODE.selesai,
    userId: "u1",
    isian: [],
    target: [],
    jabatan: "ketua",
    ...ubah,
  };
}

function cari(jabatan: keyof typeof SKP_JABATAN_2026, kunci: string): DefIndikatorSkp {
  for (const r of SKP_JABATAN_2026[jabatan]) {
    const i = r.indikator.find((x) => x.kunci === kunci);
    if (i) return i;
  }
  throw new Error(`indikator ${kunci} tidak ada`);
}

const hitung = (jabatan: keyof typeof SKP_JABATAN_2026, kunci: string, k: KonteksHitungSkp) => {
  const rhk = SKP_JABATAN_2026[jabatan].find((r) => r.indikator.some((i) => i.kunci === kunci));
  return hitungIndikatorSkp(cari(jabatan, kunci), rhk!.kunci, { ...k, jabatan }).indikator;
};

const isian = (over: Partial<IsianManualSkp>): IsianManualSkp => ({
  id: "i1",
  userId: "u1",
  periode: "b03",
  tahun: 2026,
  kunciRhk: "pp-putusan",
  kunciIndikator: "pp-putusan-kuantitas",
  nilai: 4,
  nilaiTeks: "",
  catatan: "",
  bukti: [],
  status: "diajukan",
  diisiOlehId: "u1",
  diajukanPada: null,
  ditinjauOlehId: null,
  ditinjauPada: null,
  catatanTinjauan: "",
  dibuatPada: "2026-03-31T00:00:00.000Z",
  diperbaruiPada: "2026-03-31T00:00:00.000Z",
  ...over,
});

describe("katalog SKP_JABATAN_2026", () => {
  it("setiap jabatan punya RHK, dan setiap RHK punya tiga aspek berurutan", () => {
    for (const j of JABATAN_SKP) {
      const daftar = SKP_JABATAN_2026[j];
      expect(daftar.length, j).toBeGreaterThan(0);
      for (const r of daftar) {
        expect(r.teks.length, r.kunci).toBeGreaterThan(20);
        expect(r.judulRekap, r.kunci).toMatch(/^Rekap /);
        expect(r.indikator.map((i) => i.aspek), r.kunci).toEqual(["Kuantitas", "Kualitas", "Waktu"]);
        for (const i of r.indikator) {
          expect(i.kunci.startsWith(`${r.kunci}-`), i.kunci).toBe(true);
          expect(i.teks.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it("kunci RHK dan indikator unik di dalam jabatan, dan hanya berbagi lintas jabatan yang sengaja", () => {
    const pemilik = new Map<string, string>();
    for (const j of JABATAN_SKP) {
      const dalam = new Set<string>();
      for (const r of SKP_JABATAN_2026[j]) {
        for (const i of r.indikator) {
          expect(dalam.has(i.kunci), `${j}:${i.kunci}`).toBe(false);
          dalam.add(i.kunci);
          const lain = pemilik.get(i.kunci);
          if (lain && lain !== j) {
            // Berbagi hanya Ketua/Wakil (RHK pimpinan) dan Jurusita/Jurusita Pengganti.
            expect(
              [lain, j].sort().join("|") === "ketua|wakil-ketua" || [lain, j].sort().join("|") === "jurusita|jurusita-pengganti",
              `${i.kunci}: ${lain} vs ${j}`
            ).toBe(true);
          }
          pemilik.set(i.kunci, j);
        }
      }
    }
  });

  it("`dari` dan pembanding rasio menunjuk fakta yang ada dalam jabatan itu", () => {
    for (const j of JABATAN_SKP) {
      // Fakta dikirim bot (SIPP) atau dibaca portal dari catatan sistem (aleta).
      const dikenal = new Set([...KUNCI_FAKTA_SKP_JABATAN[j], ...Object.keys(KUNCI_FAKTA_ALETA_SKP_JABATAN[j])]);
      for (const r of SKP_JABATAN_2026[j]) {
        for (const i of r.indikator) {
          if (i.dari) expect(dikenal.has(i.dari), `${j}:${i.kunci} dari ${i.dari}`).toBe(true);
          if (i.aturan.jenis === "rasio") {
            expect(dikenal.has(i.aturan.pembilang)).toBe(true);
            expect(dikenal.has(i.aturan.penyebut)).toBe(true);
          }
          if (i.aturan.jenis === "isian") expect(kunciFaktaIndikator(i)).toEqual([]);
        }
      }
    }
  });

  it("setiap jabatan di grup SIPP dan di JABATAN_SKP punya katalog", () => {
    for (const j of Object.values(GRUP_SIPP_JABATAN)) expect(SKP_JABATAN_2026[j].length).toBeGreaterThan(0);
    for (const j of JABATAN_SKP) expect(Object.keys(SKP_JABATAN_2026)).toContain(j);
  });

  it("selaras dengan layanan bot bila berkasnya ada: setiap kunci fakta disebut di sana", () => {
    const berkas = path.resolve(process.cwd(), "..", "aleta_bot", "services", "evidenSkpJabatanService.js");
    if (!existsSync(berkas)) return; // agen bot belum tergabung; pengujian menyala sendiri sesudahnya
    const isi = readFileSync(berkas, "utf8");
    const hilang = new Set<string>();
    for (const j of JABATAN_SKP) for (const kunci of KUNCI_FAKTA_SKP_JABATAN[j]) if (!isi.includes(kunci)) hilang.add(kunci);
    expect([...hilang]).toEqual([]);
  });

  it("semua RHK dapat dihitung tanpa data: tidak ada angka 0 yang dikarang", () => {
    const pegawai: PegawaiSkp = { userId: "u1", nama: "Uji", nip: null, pangkatGolongan: null, jabatanUtama: null, jabatanTambahan: [] };
    for (const j of JABATAN_SKP) {
      const h = hitungLembarSkp({
        jenis: j,
        periode: PERIODE,
        pegawai: { ...pegawai, jabatanUtama: j },
        pejabatPenilai: null,
        data: null,
        dihitungPada: "2026-04-05T02:00:00.000Z",
      });
      for (const r of h.lembar.rhk) {
        for (const i of r.indikator) {
          expect(i.realisasi, i.kunci).toBeNull();
          expect(i.realisasiTeks, i.kunci).toBe("—");
          expect(i.statusTarget).toBe("usulan");
        }
      }
    }
  });
});

describe("aturan hitung: jumlah", () => {
  it("menghitung kejadian; daftar terbaca kosong = 0 sungguhan, tak terbaca = —", () => {
    const tiga = hitung("ketua", "pmh-kuantitas", konteks([akun([baca("pmh-kuantitas", [kejadian(), kejadian(), kejadian()])])]));
    expect(tiga.realisasi).toBe(3);
    expect(tiga.realisasiTeks).toBe("3 Perkara");
    expect(tiga.sumber).toBe("sipp");

    const nol = hitung("ketua", "pmh-kuantitas", konteks([akun([baca("pmh-kuantitas", [])])]));
    expect(nol.realisasi).toBe(0);

    const gagal = hitung("ketua", "pmh-kuantitas", konteks([akun([tidakTerbaca("pmh-kuantitas")])]));
    expect(gagal.realisasi).toBeNull();
    expect(gagal.realisasiTeks).toBe("—");

    const tanpaFakta = hitung("ketua", "pmh-kuantitas", konteks([akun([])]));
    expect(tanpaFakta.realisasi).toBeNull();

    const tanpaAkun = hitung("ketua", "pmh-kuantitas", konteks([]));
    expect(tanpaAkun.realisasi).toBeNull();
  });

  it("menggabungkan beberapa akun pegawai yang sama", () => {
    const k = konteks([
      akun([baca("pmh-kuantitas", [kejadian(), kejadian()])], { username: "lama" }),
      akun([baca("pmh-kuantitas", [kejadian()])], { username: "baru" }),
    ]);
    expect(hitung("ketua", "pmh-kuantitas", k).realisasi).toBe(3);
  });

  it("jumlah nilai rupiah: nilai null tidak dijumlahkan dan disebut", () => {
    const k = konteks([
      akun([baca("ks-penerimaan-kuantitas", [kejadian({ nilai: 106016000 }), kejadian({ nilai: 500000 }), kejadian({ nilai: null })])]),
    ]);
    const hasil = hitung("kasir", "ks-penerimaan-kuantitas", k);
    expect(hasil.realisasi).toBe(106516000);
    expect(hasil.realisasiTeks).toBe("Rp106.516.000");
    expect(hasil.dasar).toContain("1 tanpa nilai tidak dijumlahkan");
  });
});

describe("aturan hitung: persen berdasarkan hari", () => {
  const sehari = (n: number) => kejadian({ tanggalAcuan: "2026-03-10", tanggal: `2026-03-${String(10 + n).padStart(2, "0")}` });

  it("PMH di hari pendaftaran: 7 dari 8 = 87,5%", () => {
    const daftar = [...Array(7)].map(() => sehari(0)).concat([sehari(2)]);
    const hasil = hitung("ketua", "pmh-kualitas", konteks([akun([baca("pmh-kuantitas", daftar)])]));
    expect(hasil.pembilang).toBe(7);
    expect(hasil.penyebut).toBe(8);
    expect(hasil.realisasiTeks).toBe("87,5%");
    expect(hasil.realisasi).toBe(87.5);
    expect(hasil.dasar).toContain("7 dari 8");
  });

  it("penyebut nol menjadi — bukan 0%", () => {
    const hasil = hitung("ketua", "pmh-kualitas", konteks([akun([baca("pmh-kuantitas", [])])]));
    expect(hasil.realisasi).toBeNull();
    expect(hasil.realisasiTeks).toBe("—");
    expect(hasil.penyebut).toBeNull();
  });

  it("tanggal acuan kosong dikeluarkan dari penyebut, bukan dihitung gagal", () => {
    const daftar = [sehari(0), sehari(0), kejadian({ tanggalAcuan: null })];
    const hasil = hitung("ketua", "pmh-kualitas", konteks([akun([baca("pmh-kuantitas", daftar)])]));
    expect(hasil.penyebut).toBe(2);
    expect(hasil.realisasiTeks).toBe("100%");
    expect(hasil.dasar).toContain("1 tidak dihitung");
  });

  it("pekerjaan belum dilakukan: gagal bila tenggat lewat pada batas keadaan, dikeluarkan bila belum jatuh tempo", () => {
    // Pemberitahuan putusan <= 7 hari; putusan 1 Maret belum diberitahukan -> lewat tenggat (batas 31 Maret).
    const lewat = kejadian({ tanggalAcuan: "2026-03-01", tanggal: null });
    // Putusan 28 Maret belum diberitahukan -> tenggat 4 April, belum jatuh tempo pada 31 Maret.
    const belum = kejadian({ tanggalAcuan: "2026-03-28", tanggal: null });
    const tepat = kejadian({ tanggalAcuan: "2026-03-02", tanggal: "2026-03-05" });
    const hasil = hitung("panmud-gugatan", "gugatan-putusan-waktu", konteks([akun([baca("gugatan-putusan-waktu", [lewat, belum, tepat])])]));
    expect(hasil.penyebut).toBe(2);
    expect(hasil.pembilang).toBe(1);
    expect(hasil.realisasiTeks).toBe("50%");
  });

  it("relaas harus sampai paling lambat 3 hari sebelum sidang (cocok min)", () => {
    const lulus = kejadian({ tanggal: "2026-03-01", tanggalAcuan: "2026-03-04" });
    const gagal = kejadian({ tanggal: "2026-03-03", tanggalAcuan: "2026-03-04" });
    const hasil = hitung("jurusita", "js-relaas-waktu", konteks([akun([baca("js-relaas-waktu", [lulus, gagal])])]));
    expect(hasil.realisasiTeks).toBe("50%");
  });

  it("tidak terbaca tetap —, bahkan bila sebagian akun terbaca (hanya yang terbaca dipakai)", () => {
    const hasil = hitung("ketua", "pmh-kualitas", konteks([akun([tidakTerbaca("pmh-kuantitas")])]));
    expect(hasil.realisasi).toBeNull();
    expect(hasil.catatan.join(" ")).toContain("tidak terbaca");
  });
});

describe("aturan hitung: rata-rata hari dan rasio", () => {
  it("rata-rata hari dari kejadian bertanggal lengkap", () => {
    const daftar = [
      kejadian({ tanggalAcuan: "2026-03-01", tanggal: "2026-03-01" }),
      kejadian({ tanggalAcuan: "2026-03-01", tanggal: "2026-03-04" }),
      kejadian({ tanggalAcuan: null }),
    ];
    const hasil = hitung("ketua", "pmh-waktu", konteks([akun([baca("pmh-kuantitas", daftar)])]));
    expect(hasil.realisasi).toBe(1.5);
    expect(hasil.realisasiTeks).toBe("1,5 Hari");
    expect(hasil.penyebut).toBe(2);
  });

  it("rata-rata tanpa kejadian = —", () => {
    const hasil = hitung("ketua", "pmh-waktu", konteks([akun([baca("pmh-kuantitas", [])])]));
    expect(hasil.realisasiTeks).toBe("—");
  });

  it("rasio dua daftar: BAS terisi 4 dari 5 = 80%; penyebut nol = —; salah satu tak terbaca = —", () => {
    const lima = [...Array(5)].map(() => kejadian());
    const hasil = hitung(
      "pp",
      "pp-sidang-kualitas",
      konteks([akun([baca("pp-sidang-kuantitas", lima), baca("pp-sidang-bas", lima.slice(0, 4))])])
    );
    expect(hasil.realisasiTeks).toBe("80%");
    expect(hasil.pembilang).toBe(4);

    const nol = hitung("pp", "pp-sidang-kualitas", konteks([akun([baca("pp-sidang-kuantitas", []), baca("pp-sidang-bas", [])])]));
    expect(nol.realisasiTeks).toBe("—");

    const gagal = hitung("pp", "pp-sidang-kualitas", konteks([akun([baca("pp-sidang-kuantitas", lima), tidakTerbaca("pp-sidang-bas")])]));
    expect(gagal.realisasi).toBeNull();
  });
});

describe("isian manual dan target", () => {
  const k = (isianUji: IsianManualSkp[]) => konteks([], { isian: isianUji, jabatan: "pp" });

  it("indikator isian: draf tidak dihitung, diajukan dihitung dengan sumber isian", () => {
    const kosong = hitung("pp", "pp-putusan-kuantitas", k([isian({ status: "draf" })]));
    expect(kosong.realisasi).toBeNull();
    expect(kosong.dasar).toContain("belum ada isian");

    const ada = hitung("pp", "pp-putusan-kuantitas", k([isian({ status: "diajukan", nilai: 4 })]));
    expect(ada.realisasi).toBe(4);
    expect(ada.sumber).toBe("isian");
    expect(ada.realisasiTeks).toBe("4 Kegiatan");
  });

  it("isian periode atau pegawai lain tidak ikut", () => {
    const lain = [isian({ periode: "b02" }), isian({ userId: "u2" }), isian({ tahun: 2025 })];
    expect(hitung("pp", "pp-putusan-kuantitas", k(lain)).realisasi).toBeNull();
  });

  it("jumlah dari SIPP ditambah isian = gabungan", () => {
    const kontekGabungan = konteks([akun([baca("pn-penunjukan-kuantitas", [kejadian(), kejadian()])])], {
      jabatan: "panitera",
      isian: [isian({ kunciRhk: "pn-penunjukan", kunciIndikator: "pn-penunjukan-kuantitas", nilai: 3 })],
    });
    const hasil = hitung("panitera", "pn-penunjukan-kuantitas", kontekGabungan);
    expect(hasil.realisasi).toBe(5);
    expect(hasil.sumber).toBe("gabungan");
  });

  it("nilai SIPP yang tak terbaca digantikan isian bila ada", () => {
    const kontekGagal = konteks([akun([tidakTerbaca("pn-penunjukan-kuantitas")])], {
      jabatan: "panitera",
      isian: [isian({ kunciRhk: "pn-penunjukan", kunciIndikator: "pn-penunjukan-kuantitas", nilai: 9 })],
    });
    const hasil = hitung("panitera", "pn-penunjukan-kuantitas", kontekGagal);
    expect(hasil.realisasi).toBe(9);
    expect(hasil.sumber).toBe("isian");
  });

  it("target disahkan menimpa usulan", () => {
    const target: TargetSkpJabatan = {
      id: "t1",
      jabatan: "ketua",
      tahun: 2026,
      kunciRhk: "pmh",
      kunciIndikator: "pmh-kualitas",
      targetNilai: 90,
      targetTeks: "90%",
      satuan: "%",
      status: "disahkan",
      diubahOlehId: "u9",
      diubahPada: "2026-01-02T00:00:00.000Z",
    };
    const hasil = hitung("ketua", "pmh-kualitas", konteks([akun([baca("pmh-kuantitas", [kejadian()])])], { target: [target] }));
    expect(hasil.target).toBe(90);
    expect(hasil.targetTeks).toBe("90%");
    expect(hasil.statusTarget).toBe("disahkan");
    // Indikator lain tetap usulan.
    expect(hitung("ketua", "pmh-waktu", konteks([akun([])], { target: [target] })).statusTarget).toBe("usulan");
  });
});

describe("periode bulanan di jalur unduh", () => {
  it("rentang bulan: akhir Februari menurut tahun kabisat", () => {
    expect(susunPeriodeSkpJabatan("b02", 2026)).toMatchObject({ mulai: "2026-02-01", selesai: "2026-02-28", bulan: 1, label: "Februari" });
    expect(susunPeriodeSkpJabatan("b02", 2028).selesai).toBe("2028-02-29");
    expect(susunPeriodeSkpJabatan("b12", 2026)).toMatchObject({ selesai: "2026-12-31", labelPanjang: "Bulan Desember Tahun 2026" });
    expect(PILIHAN_PERIODE_BULANAN_SKP).toHaveLength(12);
  });

  it("periode triwulan dan tahun sama dengan bentuk yang dikirim bot", () => {
    expect(susunPeriodeSkpJabatan("tw2", 2026)).toEqual({
      kunci: "tw2",
      tahun: 2026,
      label: "Triwulan II",
      labelPanjang: "Triwulan II Tahun 2026",
      mulai: "2026-04-01",
      selesai: "2026-06-30",
      bulan: 3,
    });
    expect(susunPeriodeSkpJabatan("tahun", 2026)).toMatchObject({ label: "Tahunan", labelPanjang: "Tahun 2026", selesai: "2026-12-31", bulan: 12 });
  });

  it("hari pertama periode: bulanan baru, triwulan/tahun sama dengan jalur lama", () => {
    expect(mulaiPeriodeSkpJabatan("b07", 2026)).toBe("2026-07-01");
    for (const p of PILIHAN_PERIODE_EVIDEN_SKP) {
      expect(mulaiPeriodeSkpJabatan(p.kunci, 2026)).toBe(mulaiPeriodeEvidenSkp(p.kunci, 2026));
    }
  });

  it("jalur hakim LAMA tetap menolak b03; jalur baru menerimanya", () => {
    const kueri = "peran=hakim&id=26&tahun=2026&periode=b03&dokumen=semua&format=pdf";
    expect(bacaPermintaanUnduhEvidenSkp(new URLSearchParams(kueri), "2026-09-27").ok).toBe(false);
    const baru = bacaPermintaanUnduhSkp(new URLSearchParams(kueri), "2026-09-27");
    expect(baru.ok).toBe(true);
    if (baru.ok) expect(baru.nilai).toMatchObject({ jenis: "hakim", id: 26, periode: "b03", pegawai: null });
  });

  it("alamat hakim lama (tanpa jenis) dibaca sama dengan jalur lama", () => {
    const kueriSah = [
      "peran=hakim&id=26&tahun=2026&periode=tw2",
      "peran=hakim&id=26&tahun=2026&periode=TW3",
      "peran=hakim&id=26&tahun=2026&periode=tahun",
      "peran=hakim&id=26&tahun=2025&periode=tw4",
    ];
    const kueriTolak = [
      "peran=panitera&id=26&tahun=2026&periode=tw2",
      "peran=hakim&id=abc&tahun=2026&periode=tw2",
      "peran=hakim&id=0&tahun=2026&periode=tw2",
      "peran=hakim&id=26&tahun=26&periode=tw2",
      "peran=hakim&id=26&tahun=2026&periode=tw5",
      "peran=hakim&id=26&tahun=2027&periode=tw1",
    ];
    for (const kueri of [...kueriSah, ...kueriTolak]) {
      const lengkap = `${kueri}&dokumen=semua&format=pdf`;
      const lama = bacaPermintaanUnduhEvidenSkp(new URLSearchParams(lengkap), "2026-09-27");
      const baru = bacaPermintaanUnduhSkp(new URLSearchParams(lengkap), "2026-09-27");
      expect(baru.ok, kueri).toBe(lama.ok);
      if (lama.ok && baru.ok) {
        expect({ id: baru.nilai.id, tahun: baru.nilai.tahun, periode: baru.nilai.periode, format: baru.nilai.format }).toEqual({
          id: lama.nilai.id,
          tahun: lama.nilai.tahun,
          periode: lama.nilai.periode,
          format: lama.nilai.format,
        });
      }
    }
  });

  it("jenis menentukan identitas yang wajib: hakim/pimpinan butuh id SIPP, jabatan butuh pegawai", () => {
    const dasar = "tahun=2026&periode=b01&dokumen=lembar-skp&format=docx";
    expect(bacaPermintaanUnduhSkp(new URLSearchParams(`jenis=pimpinan&${dasar}`)).ok).toBe(false);
    const pimpinan = bacaPermintaanUnduhSkp(new URLSearchParams(`jenis=pimpinan&id=85&${dasar}`));
    expect(pimpinan.ok && pimpinan.nilai.jenis === "pimpinan" && pimpinan.nilai.id === 85).toBe(true);

    expect(bacaPermintaanUnduhSkp(new URLSearchParams(`jenis=panitera&${dasar}`)).ok).toBe(false);
    const panitera = bacaPermintaanUnduhSkp(new URLSearchParams(`jenis=panitera&pegawai=u-12&${dasar}&tambahan=0`));
    expect(panitera.ok && panitera.nilai.pegawai === "u-12" && panitera.nilai.id === null && !panitera.nilai.sertakanTambahan).toBe(true);

    expect(bacaPermintaanUnduhSkp(new URLSearchParams(`jenis=dukun&pegawai=u-12&${dasar}`)).ok).toBe(false);
    expect(bacaPermintaanUnduhSkp(new URLSearchParams(`jenis=panitera&pegawai=../x&${dasar}`)).ok).toBe(false);
  });

  it("periode yang belum dimulai ditolak dengan kalimat yang sama untuk bulanan", () => {
    const tolak = bacaPermintaanUnduhSkp(
      new URLSearchParams("jenis=kasir&pegawai=u1&tahun=2026&periode=b11&dokumen=semua&format=zip"),
      "2026-09-27"
    );
    expect(tolak.ok).toBe(false);
    const format = bacaPermintaanUnduhSkp(new URLSearchParams("jenis=kasir&pegawai=u1&tahun=2026&periode=b09&dokumen=semua&format=zip"), "2026-09-27");
    expect(format.ok).toBe(false);
    expect(
      bacaPermintaanUnduhSkp(new URLSearchParams("jenis=kasir&pegawai=u1&tahun=2026&periode=b09&dokumen=semua&format=pdf"), "2026-09-27").ok
    ).toBe(true);
  });

  it("alamat unduh dibaca kembali oleh pembacanya", () => {
    const alamat = alamatUnduhSkp({ jenis: "pimpinan", id: 85, tahun: 2026, periode: "b04", dokumen: "semua", format: "xlsx", sertakanTambahan: false });
    const kueri = new URL(alamat, "http://x").searchParams;
    const baca2 = bacaPermintaanUnduhSkp(kueri);
    expect(baca2.ok && baca2.nilai).toMatchObject({ jenis: "pimpinan", id: 85, periode: "b04", sertakanTambahan: false });
  });
});
