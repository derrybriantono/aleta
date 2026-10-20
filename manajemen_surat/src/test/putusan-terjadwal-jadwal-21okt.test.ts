// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BATAS,
  awalJendelaBerikut,
  bersihkanPilihanForm,
  dalamJendela,
  hitungStatusButir,
  jedaAcak,
  jendelaHari,
  msKeWita,
  ringkasLangkah,
  ringkasPilihanForm,
  sebutWaktuWita,
  susunJadwal,
  witaKeMs,
  type LangkahButir,
} from "@/lib/putusan-terjadwal";

/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL - JADWAL, JEDA MANUSIAWI, JENDELA KERJA, STATUS (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Aturan murni (src/lib/putusan-terjadwal.ts): saat tiap perkara dihitung dengan jeda acak, hanya di dalam
 * jam kerja yang dipilih (tidak di istirahat siang, tidak di malam/akhir pekan/libur kecuali dipilih tegas),
 * dan tidak melewati batas akhir. Rabu 21 Okt 2026 hari kerja; Sabtu 24 Okt bukan.
 */

const TIDAK_LIBUR = () => false;
/** Acak bergilir yang deterministik, tersebar di [0,1). */
function acakBenih(awal = 7) {
  let x = awal;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}
const detik = (a: number, b: number) => Math.round((b - a) / 1000);

describe("waktu WITA", () => {
  it("bolak-balik WITA <-> ms tepat 8 jam dari UTC", () => {
    expect(witaKeMs("2026-10-21 09:00")).toBe(Date.UTC(2026, 9, 21, 1, 0, 0));
    expect(msKeWita(Date.UTC(2026, 9, 21, 1, 0, 0))).toBe("2026-10-21 09:00:00");
    expect(msKeWita(Date.UTC(2026, 9, 21, 16, 30, 0))).toBe("2026-10-22 00:30:00");
  });
  it("tanggal/jam yang tidak sah ditolak (31 Februari, jam 25)", () => {
    expect(Number.isNaN(witaKeMs("2026-02-31 09:00"))).toBe(true);
    expect(Number.isNaN(witaKeMs("2026-10-21 25:00"))).toBe(true);
    expect(Number.isNaN(witaKeMs("kemarin"))).toBe(true);
  });
  it("sebutan untuk petugas memakai nama hari dan bulan Indonesia", () => {
    expect(sebutWaktuWita(witaKeMs("2026-10-21 09:15"))).toBe("Rabu, 21 Oktober 2026 pukul 09.15");
  });
});

describe("jendela kerja", () => {
  it("Senin-Kamis 07.30-16.00, Jumat sampai 16.30, istirahat dihindari", () => {
    const rabu = jendelaHari("2026-10-21", {}, TIDAK_LIBUR)!;
    expect([rabu.dari, rabu.sampai, rabu.istirahatDari, rabu.istirahatSampai]).toEqual(["07:30", "16:00", "12:00", "13:00"]);
    const jumat = jendelaHari("2026-10-23", {}, TIDAK_LIBUR)!;
    expect([jumat.sampai, jumat.istirahatDari]).toEqual(["16:30", "11:30"]);
  });
  it("Sabtu, Minggu, dan hari libur: tidak ada jendela (kecuali malam dibolehkan tegas)", () => {
    expect(jendelaHari("2026-10-24", {}, TIDAK_LIBUR)).toBeNull();
    expect(jendelaHari("2026-10-25", {}, TIDAK_LIBUR)).toBeNull();
    expect(jendelaHari("2026-10-21", {}, (iso) => iso === "2026-10-21")).toBeNull();
    expect(jendelaHari("2026-10-24", { malamBoleh: true }, TIDAK_LIBUR)).not.toBeNull();
  });
  it("pilihan petugas hanya MENYEMPITKAN jam kerja, tidak melebarkannya", () => {
    const sempit = jendelaHari("2026-10-21", { dari: "09:00", sampai: "11:00" }, TIDAK_LIBUR)!;
    expect([sempit.dari, sempit.sampai]).toEqual(["09:00", "11:00"]);
    const lebar = jendelaHari("2026-10-21", { dari: "05:00", sampai: "22:00" }, TIDAK_LIBUR)!;
    expect([lebar.dari, lebar.sampai]).toEqual(["07:30", "16:00"]);
  });
  it("dalamJendela: istirahat dan malam di luar; awalJendelaBerikut melompat ke hari kerja berikutnya", () => {
    expect(dalamJendela(witaKeMs("2026-10-21 10:00"), {}, TIDAK_LIBUR)).toBe(true);
    expect(dalamJendela(witaKeMs("2026-10-21 12:30"), {}, TIDAK_LIBUR)).toBe(false);
    expect(dalamJendela(witaKeMs("2026-10-21 16:00"), {}, TIDAK_LIBUR)).toBe(false);
    expect(dalamJendela(witaKeMs("2026-10-21 03:00"), {}, TIDAK_LIBUR)).toBe(false);
    expect(msKeWita(awalJendelaBerikut(witaKeMs("2026-10-21 12:30"), {}, TIDAK_LIBUR))).toBe("2026-10-21 13:00:00");
    expect(msKeWita(awalJendelaBerikut(witaKeMs("2026-10-21 17:00"), {}, TIDAK_LIBUR))).toBe("2026-10-22 07:30:00");
    expect(msKeWita(awalJendelaBerikut(witaKeMs("2026-10-23 17:00"), {}, TIDAK_LIBUR))).toBe("2026-10-26 07:30:00");
  });
});

describe("susunJadwal - jeda manusiawi", () => {
  it("jeda antar perkara selalu di dalam rentang 2-7 menit, urut naik, semua di jam kerja dan di luar istirahat", () => {
    for (const benih of [1, 2, 3, 99, 12345]) {
      const h = susunJadwal({ jumlah: 25, mulai: "2026-10-21 08:00", jedaMinDetik: 120, jedaMaksDetik: 420, lintasHari: true, libur: TIDAK_LIBUR, acak: acakBenih(benih) });
      expect(h.ok).toBe(true);
      expect(h.butir).toHaveLength(25);
      for (let i = 0; i < h.butir.length; i += 1) {
        const b = h.butir[i];
        expect(dalamJendela(b.ms, {}, TIDAK_LIBUR)).toBe(true);
        if (i > 0) {
          const sela = detik(h.butir[i - 1].ms, b.ms);
          expect(sela).toBeGreaterThan(0);
          // Antar butir sehari yang sama: jeda dalam rentang (kecuali melompat istirahat/hari baru).
          const sehari = h.butir[i - 1].wita.slice(0, 10) === b.wita.slice(0, 10);
          const lewatIstirahat = h.butir[i - 1].wita.slice(11, 13) < "12" && b.wita.slice(11, 13) >= "12";
          if (sehari && !lewatIstirahat) {
            expect(sela).toBeGreaterThanOrEqual(120);
            expect(sela).toBeLessThanOrEqual(420);
          }
        }
      }
    }
  });
  it("jeda bukan konstan: nilainya beragam dan butir pertama tidak tepat di menit bulat dengan benih berbeda", () => {
    const h = susunJadwal({ jumlah: 12, mulai: "2026-10-21 08:00", lintasHari: true, libur: TIDAK_LIBUR, acak: acakBenih(42) });
    const sela = h.butir.slice(1).map((b, i) => detik(h.butir[i].ms, b.ms));
    expect(new Set(sela).size).toBeGreaterThan(6);
    expect(h.butir[0].wita >= "2026-10-21 08:00:00" && h.butir[0].wita <= "2026-10-21 08:00:45").toBe(true);
  });
  it("jedaAcak tak pernah keluar rentang, termasuk acak ekstrem 0 dan 1", () => {
    expect(jedaAcak(120, 420, () => 0)).toBe(120);
    expect(jedaAcak(120, 420, () => 1)).toBe(420);
    expect(jedaAcak(300, 300)).toBe(300);
  });
  it("jeda ditekan ke batas wajar (tidak di bawah 30 detik, tidak di atas 1 jam)", () => {
    const h = susunJadwal({ jumlah: 2, mulai: "2026-10-21 08:00", jedaMinDetik: 1, jedaMaksDetik: 999999, libur: TIDAK_LIBUR });
    expect(h.jedaMinDetik).toBe(BATAS.jedaTerpendek);
    expect(h.jedaMaksDetik).toBe(BATAS.jedaTerpanjang);
  });
});

describe("susunJadwal - jendela, batas akhir, dan sambung hari", () => {
  it("tidak ada butir di istirahat siang walau jedanya jatuh ke sana: melompat ke 13.00 dan dilanjutkan", () => {
    const h = susunJadwal({ jumlah: 12, mulai: "2026-10-21 11:40", jedaMinDetik: 300, jedaMaksDetik: 300, libur: TIDAK_LIBUR, acak: () => 0.5 });
    for (const b of h.butir) expect(b.wita.slice(11, 16) >= "12:00" && b.wita.slice(11, 16) < "13:00").toBe(false);
    expect(h.butir.some((b) => b.wita.slice(11, 16) >= "13:00")).toBe(true);
  });
  it("jam mulai di malam hari digeser ke jam kerja berikutnya dengan peringatan", () => {
    const h = susunJadwal({ jumlah: 3, mulai: "2026-10-21 22:00", libur: TIDAK_LIBUR, lintasHari: true, acak: acakBenih(5) });
    expect(h.butir[0].wita.slice(0, 10)).toBe("2026-10-22");
    expect(h.butir[0].wita.slice(11, 16) >= "07:30").toBe(true);
    expect(h.peringatan.join(" ")).toMatch(/di luar jam kerja/);
  });
  it("mulai Sabtu: digeser ke Senin 26 Okt, tidak pernah di akhir pekan", () => {
    const h = susunJadwal({ jumlah: 4, mulai: "2026-10-24 09:00", libur: TIDAK_LIBUR, acak: acakBenih(3) });
    expect(h.ok).toBe(true);
    for (const b of h.butir) expect(b.wita.slice(0, 10)).toBe("2026-10-26");
  });
  it("hari libur dilewati", () => {
    const h = susunJadwal({ jumlah: 30, mulai: "2026-10-21 14:00", jedaMinDetik: 300, jedaMaksDetik: 300, lintasHari: true, libur: (iso) => iso === "2026-10-22", acak: () => 0.5 });
    expect(h.butir.some((b) => b.wita.startsWith("2026-10-22"))).toBe(false);
    expect(h.butir.some((b) => b.wita.startsWith("2026-10-23"))).toBe(true);
  });
  it("tidak muat di hari itu dan tanpa izin lintas hari: sisanya DISEBUT, tidak diam-diam ditaruh di hari lain", () => {
    const h = susunJadwal({ jumlah: 40, mulai: "2026-10-21 14:00", jedaMinDetik: 300, jedaMaksDetik: 300, libur: TIDAK_LIBUR, acak: () => 0.5 });
    expect(h.ok).toBe(false);
    expect(h.tidakMuat).toBeGreaterThan(0);
    expect(h.butir.length + h.tidakMuat).toBe(40);
    for (const b of h.butir) expect(b.wita.startsWith("2026-10-21")).toBe(true);
    expect(h.sebab).toMatch(/muat di hari itu/);
  });
  it("lintas hari diizinkan: sisanya jatuh di hari kerja berikutnya pada pagi hari", () => {
    const h = susunJadwal({ jumlah: 40, mulai: "2026-10-21 14:00", jedaMinDetik: 300, jedaMaksDetik: 300, lintasHari: true, libur: TIDAK_LIBUR, acak: () => 0.5 });
    expect(h.ok).toBe(true);
    const hariKedua = h.butir.filter((b) => b.wita.startsWith("2026-10-22"));
    expect(hariKedua.length).toBeGreaterThan(0);
    expect(hariKedua[0].wita.slice(11, 16) >= "07:30" && hariKedua[0].wita.slice(11, 16) <= "07:45").toBe(true);
  });
  it("batas akhir dihormati: tidak ada butir sesudahnya", () => {
    const h = susunJadwal({ jumlah: 30, mulai: "2026-10-21 09:00", batasAkhir: "2026-10-21 10:00", jedaMinDetik: 300, jedaMaksDetik: 300, libur: TIDAK_LIBUR, acak: () => 0.5 });
    expect(h.ok).toBe(false);
    for (const b of h.butir) expect(b.wita <= "2026-10-21 10:00:00").toBe(true);
    expect(h.sebab).toMatch(/sebelum batas akhir/);
  });
  it("batas akhir sebelum mulai atau masukan rusak ditolak dengan kalimat awam", () => {
    expect(susunJadwal({ jumlah: 2, mulai: "2026-10-21 09:00", batasAkhir: "2026-10-21 08:00", libur: TIDAK_LIBUR }).sebab).toMatch(/sesudah jam mulai/);
    expect(susunJadwal({ jumlah: 0, mulai: "2026-10-21 09:00", libur: TIDAK_LIBUR }).sebab).toMatch(/Belum ada perkara/);
    expect(susunJadwal({ jumlah: 2, mulai: "besok", libur: TIDAK_LIBUR }).sebab).toMatch(/belum sah/);
    expect(susunJadwal({ jumlah: BATAS.butirPerJadwal + 1, mulai: "2026-10-21 09:00", libur: TIDAK_LIBUR }).ok).toBe(false);
  });
  it("malam hanya bila dipilih tegas: dengan malamBoleh jam 21.00 dipakai apa adanya, Sabtu pun", () => {
    const h = susunJadwal({ jumlah: 3, mulai: "2026-10-24 21:00", jamKerja: { malamBoleh: true }, libur: TIDAK_LIBUR, acak: acakBenih(2) });
    expect(h.ok).toBe(true);
    expect(h.butir[0].wita.startsWith("2026-10-24 21:")).toBe(true);
    expect(h.peringatan).toEqual([]);
    const tanpa = susunJadwal({ jumlah: 3, mulai: "2026-10-24 21:00", libur: TIDAK_LIBUR, acak: acakBenih(2) });
    expect(tanpa.butir[0].wita.startsWith("2026-10-26")).toBe(true);
  });
  it("jendela yang disempitkan petugas (09.00-10.00) membatasi butir", () => {
    const h = susunJadwal({ jumlah: 30, mulai: "2026-10-21 08:00", jamKerja: { dari: "09:00", sampai: "10:00" }, jedaMinDetik: 300, jedaMaksDetik: 300, libur: TIDAK_LIBUR, acak: () => 0.5 });
    expect(h.butir[0].wita >= "2026-10-21 09:00:00").toBe(true);
    for (const b of h.butir) expect(b.wita < "2026-10-21 10:00:00").toBe(true);
  });
});

describe("status butir dari status langkahnya", () => {
  const L = (isi: LangkahButir["isi"], putusan: LangkahButir["putusan"], anonim: LangkahButir["anonim"]): LangkahButir => ({ isi, putusan, anonim });
  it("semua yang dipilih selesai atau dilewati = selesai", () => {
    expect(hitungStatusButir(L("selesai", "selesai", "dilewati"))).toBe("selesai");
    expect(hitungStatusButir(L("tidak", "dilewati", "tidak"))).toBe("selesai");
  });
  it("masih ada yang menunggu = menunggu; ada yang jalan = jalan", () => {
    expect(hitungStatusButir(L("selesai", "menunggu", "menunggu"))).toBe("menunggu");
    expect(hitungStatusButir(L("selesai", "jalan", "menunggu"))).toBe("jalan");
  });
  it("sebagian selesai + sebagian gagal/tertahan = sebagian; semuanya gagal = gagal", () => {
    expect(hitungStatusButir(L("selesai", "selesai", "tertahan"))).toBe("sebagian");
    expect(hitungStatusButir(L("gagal", "gagal", "gagal"))).toBe("gagal");
    expect(hitungStatusButir(L("tidak", "gagal", "tidak"))).toBe("gagal");
  });
  it("dibatalkan menang atas segalanya; ringkasLangkah menghitung yang dipilih saja", () => {
    expect(hitungStatusButir(L("selesai", "selesai", "selesai"), true)).toBe("dibatalkan");
    expect(ringkasLangkah(L("selesai", "gagal", "tidak"))).toEqual({ dipilih: 2, selesai: 1, macet: 1 });
  });
});

describe("pilihan form", () => {
  it("hanya status putusan (teks) dan verstek Y/T yang diterima; sisanya dibuang", () => {
    expect(bersihkanPilihanForm({ statusPutusan: "  Dikabulkan ", verstek: "y", lain: "x" })).toEqual({ statusPutusan: "Dikabulkan", verstek: "Y" });
    expect(bersihkanPilihanForm({ verstek: "mungkin" })).toEqual({});
    expect(bersihkanPilihanForm(null)).toEqual({});
  });
  it("ringkasan menyebut yang ditentukan petugas dan yang dipilih ALETA", () => {
    expect(ringkasPilihanForm({})).toMatch(/dipilih ALETA dari bunyi amar/);
    expect(ringkasPilihanForm({ statusPutusan: "Ditolak", verstek: "T" })).toBe("Status putusan: Ditolak · Verstek: tidak");
  });
});
