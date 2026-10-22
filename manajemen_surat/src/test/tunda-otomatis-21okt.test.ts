// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RencanaKalender, SidangRiwayat } from "@/lib/bawaan-tunda";
import { hariLibur, petaLiburBerlaku } from "@/lib/hari-libur";
import {
  JAM_PEMICU_BAWAAN,
  JAM_PEMICU_KELILING,
  bersihkanSetelan,
  jamPemicuHari,
  jatuhTempo,
  nilaiAktif,
  putuskanTundaOtomatis,
  type HasilTunda,
  type MasukanTundaOtomatis,
} from "@/lib/tunda-otomatis";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  bacaCatatanHari,
  bacaDaftarHari,
  detakTundaOtomatis,
  jalankanTundaOtomatis,
  jamTundaOtomatis,
  simpanSetelan,
  tandaiBatal,
  type BahanSidang,
  type SumberTundaOtomatis,
} from "@/server/modules/tunda-otomatis/layanan";

/**
 * ============================================================================
 * TUNDA OTOMATIS 16.30 (22 Okt 2026) - aturan, urutan, libur, keliling,
 * lewati, kering vs menulis, hak saklar, tidak ada tulisan putusan, jam pemicu
 * 14.00/16.30 tanpa jalan ganda, penjaga bot sebelum menulis.
 * ============================================================================
 */

const HARI = "2026-10-22"; // Kamis

const sidang = (id: number, tanggal: string, dihadiriOleh: number | null, agenda = "Sidang", ikrar = false): SidangRiwayat => ({
  jadwalId: id,
  tanggal,
  agenda,
  ditunda: true,
  alasan: "Panggil",
  dihadiriOleh,
  ikrar,
});

function masukan(ubah: Partial<MasukanTundaOtomatis> = {}): MasukanTundaOtomatis {
  const jadwalId = ubah.jadwalId ?? 100;
  const tanggalSidang = ubah.tanggalSidang ?? HARI;
  return {
    hariIni: HARI,
    jadwalId,
    perkaraId: 9,
    nomorPerkara: "600/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    jenisPerkaraId: 347,
    tanggalSidang,
    agenda: "Pemeriksaan Pokok Perkara",
    ditunda: false,
    alasanDitunda: "0",
    riwayat: [{ ...sidang(jadwalId, tanggalSidang, null, "Pemeriksaan Pokok Perkara"), ditunda: false, alasan: "" }],
    kalender: [],
    kontak: null,
    ppJelas: true,
    ...ubah,
  };
}

const tunda = (h: ReturnType<typeof putuskanTundaOtomatis>) => {
  expect(h.jenis).toBe("tunda");
  return h as HasilTunda;
};

// ============================================================================
// 1. ATURAN TIAP CABANG
// ============================================================================

describe("aturan tunda otomatis", () => {
  it("aturan 2: belum ada Court Calendar -> 14 hari", () => {
    const h = tunda(putuskanTundaOtomatis(masukan()));
    expect(h.aturan).toBe("tanpa-court-calendar-14");
    expect(h.nomorAturan).toBe(2);
    expect(h.tanggal).toBe("2026-11-05");
    expect(h.alasan).toBeTruthy();
    expect(h.agenda).toBeTruthy();
  });

  it("aturan 3: ada Court Calendar -> semua dianggap hadir, tanggal & agenda rencana berikutnya", () => {
    const kalender: RencanaKalender[] = [
      { tanggal: "2026-10-15", jam: "09:00", agenda: "Jawaban" },
      { tanggal: "2026-10-22", jam: "09:00", agenda: "Replik" },
      { tanggal: "2026-10-27", jam: "15:00", agenda: "Duplik Tergugat" },
    ];
    const riwayat = [sidang(90, "2026-10-15", 1, "Jawaban"), { ...sidang(100, HARI, null, "Replik"), ditunda: false }];
    const h = tunda(putuskanTundaOtomatis(masukan({ kalender, riwayat, agenda: "Replik" })));
    expect(h.aturan).toBe("court-calendar");
    expect(h.tanggal).toBe("2026-10-27");
    expect(h.agenda).toBe("Duplik Tergugat");
    expect(h.jam).toBe("15:00");
    expect(h.kehadiran).toBe(1);
  });

  it("aturan 3 tanpa rencana sesudah hari ini -> 14 hari", () => {
    const h = tunda(putuskanTundaOtomatis(masukan({ kalender: [{ tanggal: "2026-10-01" }], riwayat: [sidang(90, "2026-10-08", 1), { ...sidang(100, HARI, null), ditunda: false }] })));
    expect(h.aturan).toBe("court-calendar-habis-14");
    expect(h.tanggal).toBe("2026-11-05");
  });

  it("aturan 4 (keputusan 22 Okt): Court Calendar + pembuktian + panggilan Tergugat sebelumnya ELEKTRONIK -> 7 hari; selain itu 14 hari", () => {
    const dasar = {
      agenda: "Pembuktian Penggugat",
      kalender: [{ tanggal: "2026-11-20", agenda: "Kesimpulan" }],
      riwayat: [sidang(80, "2026-10-08", 1, "Duplik"), { ...sidang(100, HARI, null, "Pembuktian Penggugat"), ditunda: false }],
    };
    const a = tunda(putuskanTundaOtomatis(masukan({ ...dasar, panggilanTergugat: { ada: true, elektronik: true, sandi: "E" } })));
    expect([a.aturan, a.nomorAturan, a.tanggal]).toEqual(["pembuktian-elektronik-7", 4, "2026-10-29"]);
    // Surat tercatat (POS) / delegasi -> 14 hari; email tidak lagi syarat.
    const email = { ecourtTerbaca: true, sebab: "", penggugat: { adaEmail: true, sumber: "sipp" as const }, tergugat: { adaEmail: true, persetujuan: "setuju" as const } };
    const b = tunda(putuskanTundaOtomatis(masukan({ ...dasar, kontak: email, panggilanTergugat: { ada: true, elektronik: false, sandi: "S" } })));
    expect([b.aturan, b.tanggal]).toEqual(["pembuktian-14", "2026-11-05"]);
    // Cara panggil tidak terbaca = 14 hari (tidak menebak).
    expect(tunda(putuskanTundaOtomatis(masukan({ ...dasar, panggilanTergugat: null }))).aturan).toBe("pembuktian-14");
  });

  it("aturan 5: permohonan (Pdt.P) -> 7 hari; cerai talak (Pdt.G) BUKAN permohonan", () => {
    const p = tunda(putuskanTundaOtomatis(masukan({ nomorPerkara: "230/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16, jenisPerkaraId: 361 })));
    expect([p.aturan, p.nomorAturan, p.tanggal]).toEqual(["permohonan-7", 5, "2026-10-29"]);
    const ct = tunda(putuskanTundaOtomatis(masukan({ nomorPerkara: "601/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 346 })));
    expect(ct.aturan).toBe("tanpa-court-calendar-14");
  });

  it("aturan 7: Penggugat tidak hadir sidang pertama dan kedua -> usulan GUGUR, bukan tunda", () => {
    const riwayat = [sidang(90, "2026-10-08", 4), { ...sidang(100, HARI, null), ditunda: false }];
    const h = putuskanTundaOtomatis(masukan({ riwayat }));
    expect(h.jenis).toBe("gugur");
    if (h.jenis !== "gugur") return;
    expect(h.usulanStatus).toBe("Digugurkan");
    expect(h.nomorAturan).toBe(7);
    expect(h.tanda).toContain("kehadiran hari ini belum tercatat");
    // Hadir hari ini (antrian) -> bukan gugur.
    expect(putuskanTundaOtomatis(masukan({ riwayat, antrian: { hadirPihak1: true, hadirPihak2: false } })).jenis).not.toBe("gugur");
    // Sidang pertama Penggugat HADIR -> bukan gugur.
    expect(putuskanTundaOtomatis(masukan({ riwayat: [sidang(90, "2026-10-08", 2), riwayat[1]] })).jenis).not.toBe("gugur");
  });

  it("aturan 8: hadir sidang pertama, tidak hadir kedua dan ketiga -> usulan TIDAK DAPAT DITERIMA", () => {
    const riwayat = [sidang(80, "2026-10-01", 1), sidang(90, "2026-10-08", 4), { ...sidang(100, HARI, null), ditunda: false }];
    const h = putuskanTundaOtomatis(masukan({ riwayat }));
    expect(h.jenis).toBe("tidak-dapat-diterima");
    if (h.jenis !== "tidak-dapat-diterima") return;
    expect(h.nomorAturan).toBe(8);
    expect(h.usulanStatus).toBe("Tidak Dapat Diterima");
    // Kehadiran hari ini tercatat hadir -> tunda biasa.
    expect(putuskanTundaOtomatis(masukan({ riwayat, dihadiriOlehSekarang: 1 })).jenis).toBe("tunda");
  });
});

// ============================================================================
// 2. URUTAN PRIORITAS 7/8 > 5 > 4 > 3 > 2
// ============================================================================

describe("urutan prioritas aturan", () => {
  it("7 mendahului 5: permohonan yang Pemohonnya dua kali tidak hadir -> gugur", () => {
    const h = putuskanTundaOtomatis(
      masukan({ nomorPerkara: "227/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16, riwayat: [sidang(90, "2026-10-14", 4), { ...sidang(100, HARI, null), ditunda: false }] })
    );
    expect(h.jenis).toBe("gugur");
  });

  it("8 mendahului 3/2 bila ketidakhadiran hari ini diketahui (antrian), juga pada perkara ber-Court Calendar", () => {
    const riwayat = [sidang(80, "2026-10-01", 1), sidang(90, "2026-10-08", 3), { ...sidang(100, HARI, null), ditunda: false }];
    const h = putuskanTundaOtomatis(masukan({ riwayat, kalender: [{ tanggal: "2026-10-29" }], antrian: { hadirPihak1: false, hadirPihak2: true } }));
    expect(h.jenis).toBe("tidak-dapat-diterima");
  });

  it("Court Calendar = semua dianggap hadir: kehadiran hari ini yang tidak tercatat tidak memicu 8", () => {
    const riwayat = [sidang(80, "2026-10-01", 1), sidang(90, "2026-10-08", 4), { ...sidang(100, HARI, null, "Replik"), ditunda: false }];
    const h = tunda(putuskanTundaOtomatis(masukan({ riwayat, agenda: "Replik", kalender: [{ tanggal: "2026-10-29", agenda: "Duplik" }] })));
    expect(h.aturan).toBe("court-calendar");
  });

  it("5 mendahului 4: permohonan ber-Court Calendar pada pembuktian tetap 7 hari permohonan", () => {
    const h = tunda(
      putuskanTundaOtomatis(
        masukan({ nomorPerkara: "225/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16, agenda: "Pembuktian", kalender: [{ tanggal: "2026-11-30" }], riwayat: [sidang(90, "2026-10-15", 1), { ...sidang(100, HARI, null, "Pembuktian"), ditunda: false }] })
      )
    );
    expect(h.aturan).toBe("permohonan-7");
  });

  it("4 mendahului 3: pembuktian ber-Court Calendar tidak mengikuti tanggal rencana", () => {
    const h = tunda(
      putuskanTundaOtomatis(masukan({ agenda: "Pembuktian Tergugat", kalender: [{ tanggal: "2026-10-23", agenda: "Kesimpulan" }], riwayat: [sidang(90, "2026-10-15", 1), { ...sidang(100, HARI, null, "Pembuktian Tergugat"), ditunda: false }] }))
    );
    expect(h.aturan).toBe("pembuktian-14");
  });

  it("3 mendahului 2", () => {
    expect(tunda(putuskanTundaOtomatis(masukan({ kalender: [{ tanggal: "2026-11-02" }] }))).aturan).toBe("court-calendar");
  });
});

// ============================================================================
// 3. HARI LIBUR DAN SIDANG KELILING
// ============================================================================

describe("tanggal: hari libur dan sidang keliling", () => {
  it("14 hari jatuh di Natal (cuti bersama 24, Natal 25, Sabtu-Minggu) -> Senin 28 Des", () => {
    const h = tunda(putuskanTundaOtomatis(masukan({ hariIni: "2026-12-11", tanggalSidang: "2026-12-11", riwayat: [{ ...sidang(100, "2026-12-11", null), ditunda: false }] }), petaLiburBerlaku()));
    expect(h.tanggal).toBe("2026-12-28");
    expect(h.bergeserDari).toBe("2026-12-25");
    expect(hariLibur(h.tanggal)).toBe(false);
  });

  it("rencana Court Calendar hari Sabtu digeser ke Senin", () => {
    const h = tunda(putuskanTundaOtomatis(masukan({ kalender: [{ tanggal: "2026-10-31" }] })));
    expect(h.tanggal).toBe("2026-11-02");
  });

  it("sidang keliling: hari keliling berikutnya di lokasi yang sama pada/sesudah tanggal aturan", () => {
    const h = tunda(
      putuskanTundaOtomatis(masukan({ sidangKeliling: true, ruangan: "Sidang Keliling Kulawi", kelilingBerikut: ["2026-10-29", "2026-11-12", "2026-11-26"] }))
    );
    expect(h.tanggal).toBe("2026-11-12");
    expect(h.tanda).toEqual([]);
  });

  it("sidang keliling tanpa kalender lokasi -> aturan umum + tanda periksa lokasi", () => {
    const a = tunda(putuskanTundaOtomatis(masukan({ sidangKeliling: true, ruangan: "Sidang Keliling Labuan", kelilingBerikut: [] })));
    expect(a.tanggal).toBe("2026-11-05");
    expect(a.tanda).toContain("periksa lokasi");
    const b = tunda(putuskanTundaOtomatis(masukan({ sidangKeliling: true, ruangan: "Sidang Keliling Labuan", kelilingBerikut: ["2026-10-29"] })));
    expect(b.tanda).toContain("periksa lokasi");
  });
});

// ============================================================================
// 4. YANG DILEWATI
// ============================================================================

describe("dilewati dengan sebab", () => {
  const sebab = (m: Partial<MasukanTundaOtomatis>) => {
    const h = putuskanTundaOtomatis(masukan(m));
    return h.jenis === "lewati" ? h.sebab : h.jenis;
  };
  it("sudah ditunda / sudah diberi hasil / sudah diputus / ikrar / dibatalkan", () => {
    expect(sebab({ ditunda: true })).toBe("sudah-ditunda");
    expect(sebab({ alasanDitunda: "putus DIKABULKAN" })).toBe("sudah-diberi-hasil");
    expect(sebab({ sudahPutus: true })).toBe("sudah-diputus");
    expect(sebab({ ikrar: true })).toBe("ikrar-talak");
    expect(sebab({ dibatalkan: { oleh: "Derry", pada: "x" } })).toBe("dibatalkan-petugas");
  });
  it("sudah ada jadwal berikutnya, putusan sela, agenda putusan, verzet", () => {
    expect(sebab({ riwayat: [{ ...sidang(100, HARI, null), ditunda: false }, sidang(101, "2026-11-05", null)] })).toBe("sudah-ada-jadwal-berikutnya");
    expect(sebab({ agenda: "Pembacaan Putusan Sela" })).toBe("putusan-sela");
    expect(sebab({ agenda: "Musyawarah Majelis" })).toBe("agenda-putusan");
    expect(sebab({ verzet: true })).toBe("verzet");
  });
  it("petugas sedang mengerjakan (kunci), sidang berlangsung, bahan tak terbaca, PP tidak jelas", () => {
    expect(sebab({ sedangDikerjakan: true })).toBe("sedang-dikerjakan");
    expect(sebab({ antrian: { hadirPihak1: true, hadirPihak2: true, keadaan: "disidang" } })).toBe("sidang-berlangsung");
    expect(sebab({ riwayat: null })).toBe("bahan-tidak-terbaca");
    expect(sebab({ kalender: null })).toBe("bahan-tidak-terbaca");
    expect(sebab({ ppJelas: false })).toBe("pp-tidak-jelas");
  });
  it("perkiraan verstek (keputusan 22 Okt): Penggugat TERCATAT hadir -> dilewati; tidak tercatat -> tunda 14 hari panggil kedua pihak", () => {
    const riwayatV = [sidang(90, "2026-10-08", 2), { ...sidang(100, HARI, null), ditunda: false }];
    expect(sebab({ riwayat: riwayatV, dihadiriOlehSekarang: 2 })).toBe("perkiraan-verstek");
    expect(sebab({ riwayat: riwayatV, hadirRinciPertama: true })).toBe("perkiraan-verstek");
    const u = tunda(putuskanTundaOtomatis(masukan({ riwayat: riwayatV })));
    expect([u.aturan, u.tanggal, u.alasan, u.agenda, u.kehadiran]).toEqual(["panggil-ulang-14", "2026-11-05", "Panggil Penggugat dan Tergugat", "Panggil Penggugat dan Tergugat", 4]);
    // Lawan pernah hadir -> tunda biasa.
    expect(sebab({ riwayat: [sidang(90, "2026-10-08", 1), { ...sidang(100, HARI, null), ditunda: false }] })).toBe("tunda");
    // Permohonan tanpa lawan tidak terkena.
    expect(sebab({ nomorPerkara: "1/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16, riwayat: [sidang(90, "2026-10-08", 2), { ...sidang(100, HARI, null), ditunda: false }] })).toBe("tunda");
  });
});

// ============================================================================
// 5. JAM PEMICU, SETELAN
// ============================================================================

describe("jam pemicu dan setelan", () => {
  it("bawaan MATI dan mode kering; hanya false tegas mematikan kering", () => {
    const s = bersihkanSetelan({});
    expect([s.nyala, s.kering, s.jam]).toEqual([false, true, "16:30"]);
    expect(bersihkanSetelan({ nyala: "ya", kering: 0 })).toMatchObject({ nyala: false, kering: true });
  });
  it("16.30 biasa, 14.00 pada hari sidang keliling aktif", () => {
    expect(jamPemicuHari({ jam: "16:30" }, false)).toBe(JAM_PEMICU_BAWAAN);
    expect(jamPemicuHari({ jam: "16:30" }, true)).toBe(JAM_PEMICU_KELILING);
    expect(jatuhTempo("16:30", "16:29:59", false)).toBe(false);
    expect(jatuhTempo("16:30", "16:30:00", false)).toBe(true);
    expect(jatuhTempo("14:00", "16:35:00", true)).toBe(false);
    expect([true, 1, "1", "t", "true", "Y"].every(nilaiAktif)).toBe(true);
    expect([false, 0, "0", "f", null, ""].some(nilaiAktif)).toBe(false);
  });
  it("hanya Super Admin yang boleh mengubah saklar (rute memeriksanya sebelum menyimpan)", () => {
    expect(bolehMenyuntingAkses({ roleId: "super-admin" })).toBe(true);
    expect(bolehMenyuntingAkses({ roleId: "admin" })).toBe(false);
    expect(bolehMenyuntingAkses({ roleId: "hakim" })).toBe(false);
    const rute = readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-ecourt/tunda-otomatis/route.ts"), "utf8");
    const iGerbang = rute.indexOf('if (!bolehMenyuntingAkses(aktor)) throw new ApiError(403');
    expect(iGerbang).toBeGreaterThan(0);
    expect(iGerbang).toBeLessThan(rute.indexOf("await simpanSetelan("));
    expect(iGerbang).toBeLessThan(rute.indexOf("await jalankanTundaOtomatis("));
  });
});

// ============================================================================
// 6. LAYANAN: KERING VS MENULIS, TANPA TULISAN PUTUSAN, SATU JALAN PER HARI
// ============================================================================

describe("layanan tunda otomatis (basis data dalam memori)", () => {
  let db: AletaDatabase;
  let dikirim: Record<string, unknown>[];
  let dibatalkan: string[];
  const SUPER = { id: "u-super", name: "Derry" };

  const barisJadwal = (sidangId: string, ubah: Record<string, unknown> = {}) => ({
    sidangId,
    perkaraId: `p${sidangId}`,
    nomorPerkara: `${sidangId}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    tanggalSidang: HARI,
    agenda: "Pemeriksaan Pokok Perkara",
    ditunda: false,
    alasanDitunda: "0",
    sudahPutus: false,
    sidangIkrarTalak: false,
    majelisNama: "Derry Briantono",
    paniteraNama: "Munifa",
    ...ubah,
  });

  const bahan = (id: number, riwayat: SidangRiwayat[]): BahanSidang => ({
    ok: true,
    keadaan: { jadwalId: id, tanggalSidang: HARI, agenda: "Pemeriksaan Pokok Perkara", ditunda: "T", alasanDitunda: "0", sidangKeliling: "T", ruangan: "Ruang 1", alurPerkaraId: 15 },
    riwayat: { sidang: riwayat, mediasi: null },
    antrian: null,
    atasNama: { ok: true, username: "munifa,SH.", namaLengkap: "Munifa" },
    kalender: [],
    kontak: null,
    kunci: { aktif: false },
    kelilingBerikut: null,
  });

  const sumber = (): SumberTundaOtomatis => ({
    async jadwal() {
      return {
        ok: true,
        galat: "",
        sidang: [
          barisJadwal("1"), // tunda 14 hari
          barisJadwal("2"), // gugur
          barisJadwal("3", { ditunda: true }), // sudah ditunda
        ],
      };
    },
    async bahan(id) {
      if (id === "1") return bahan(1, [{ ...sidang(1, HARI, null), ditunda: false }]);
      return bahan(2, [sidang(20, "2026-10-08", 4), { ...sidang(2, HARI, null), ditunda: false }]);
    },
    async tulis(isi) {
      dikirim.push(isi);
      return isi.kering === false
        ? { ok: true, data: { ok: true, diantrekan: true, kalimat: "Di luar jam kerja - diantrekan.", dikerjakanPada: "2026-10-23 07:52:00", atasNama: { namaLengkap: "Munifa" } } }
        : { ok: true, data: { ok: true, kering: true, atasNama: { namaLengkap: "Munifa" } } };
    },
    async antrean() {
      return [];
    },
    async batalAntrean(jadwalId) {
      dibatalkan.push(jadwalId);
      return { ok: true };
    },
    async libur() {
      return petaLiburBerlaku();
    },
  });

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true });
  });
  beforeEach(async () => {
    dikirim = [];
    dibatalkan = [];
    await db.run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ?", ["*sistem*"]);
  });

  it("saklar MATI (bawaan): detak tidak menjalankan apa pun dan tidak menulis", async () => {
    const r = await detakTundaOtomatis(db, { kini: new Date("2026-10-22T08:35:00Z"), sumber: sumber() });
    expect(r).toBeNull();
    expect(dikirim).toEqual([]);
    expect((await bacaCatatanHari(db, HARI)).jalan).toBeNull();
  });

  it("MODE KERING: bot diminta menyusun rencana (kering:true), tidak ada yang ditulis; gugur hanya usulan", async () => {
    await simpanSetelan(db, SUPER, { nyala: true, kering: true }, "192.168.10.21");
    const c = await jalankanTundaOtomatis(db, { pemicu: "jadwal", tanggal: HARI, sumber: sumber() });
    expect(c.jalan?.mode).toBe("kering");
    expect(dikirim).toHaveLength(1);
    // Keputusan 22 Okt: ditulis saat jam pemicu itu juga (tidak diantrekan ke pagi berikutnya).
    expect(dikirim[0]).toMatchObject({ jadwalId: "1", kering: true, otomatis: true, tanggalSidangHarap: HARI, tanggalBerikut: "2026-11-05", ip: "192.168.10.21", jamKerja: "sekarang" });
    const per = Object.fromEntries(c.butir.map((b) => [b.jadwalId, b]));
    expect(per["1"].tulis?.status).toBe("kering-lolos");
    expect(per["2"].keputusan.jenis).toBe("gugur");
    expect(per["2"].tulis?.status).toBe("dilewati");
    expect(per["3"].keputusan).toMatchObject({ jenis: "lewati", sebab: "sudah-ditunda" });
  });

  it("MENYALA: hanya penulis tunda yang ada dipanggil, kering:false + antrean; tidak pernah ada isian putusan", async () => {
    await simpanSetelan(db, SUPER, { nyala: true, kering: false }, "192.168.10.21");
    const c = await jalankanTundaOtomatis(db, { pemicu: "jadwal", tanggal: HARI, sumber: sumber() });
    expect(dikirim).toHaveLength(1);
    expect(dikirim[0]).toMatchObject({ kering: false, otomatis: true, jamKerja: "sekarang", dihadiriOleh: expect.any(Number) });
    for (const isi of dikirim) {
      expect(isi).not.toHaveProperty("statusPutusanId");
      expect(isi).not.toHaveProperty("tulisPutusan");
      expect(JSON.stringify(isi).toLowerCase()).not.toContain("aleta");
    }
    expect(c.butir.find((b) => b.jadwalId === "1")?.tulis).toMatchObject({ status: "diantrekan", dikerjakanPada: "2026-10-23 07:52:00" });
    // Tanpa pemanggil putusan sama sekali di modul ini.
    const modul = readFileSync(path.resolve(process.cwd(), "src/server/modules/tunda-otomatis/layanan.ts"), "utf8");
    expect(modul).not.toMatch(/PutusSidang|putus-sidang|statusPutusanId|tulisPutusan/);
  });

  it("jangan tunda otomatis: sebelum jam pemicu dilewati; sesudahnya membatalkan antrean", async () => {
    await simpanSetelan(db, SUPER, { nyala: true, kering: false }, "");
    await tandaiBatal(db, { tanggal: HARI, jadwalId: "1", oleh: "u1", nama: "Munifa", batal: true, sumber: sumber() });
    const pratinjau = await bacaDaftarHari(db, { tanggal: HARI, sumber: sumber(), segarkan: true });
    expect(pratinjau.tahap).toBe("pratinjau");
    expect(pratinjau.butir.find((b) => b.jadwalId === "1")?.keputusan).toMatchObject({ jenis: "lewati", sebab: "dibatalkan-petugas" });
    await tandaiBatal(db, { tanggal: HARI, jadwalId: "1", oleh: "u1", nama: "Munifa", batal: false, sumber: sumber() });
    await jalankanTundaOtomatis(db, { pemicu: "jadwal", tanggal: HARI, sumber: sumber() });
    const r = await tandaiBatal(db, { tanggal: HARI, jadwalId: "1", oleh: "u1", nama: "Munifa", batal: true, sumber: sumber() });
    expect(dibatalkan).toEqual(["1"]);
    expect(r.pesan).toContain("dibatalkan");
    expect((await bacaCatatanHari(db, HARI)).butir.find((b) => b.jadwalId === "1")?.tulis?.status).toBe("dibatalkan");
  });

  it("jam pemicu 16.30: belum waktunya pukul 14.05, jalan pukul 16.31, tidak dobel pukul 16.36", async () => {
    await simpanSetelan(db, SUPER, { nyala: true, kering: true }, "");
    expect(await jamTundaOtomatis(db, HARI)).toBe("16:30");
    expect(await detakTundaOtomatis(db, { kini: new Date("2026-10-22T06:05:00Z"), sumber: sumber() })).toBeNull();
    expect(await detakTundaOtomatis(db, { kini: new Date("2026-10-22T08:31:00Z"), sumber: sumber() })).not.toBeNull();
    expect(await detakTundaOtomatis(db, { kini: new Date("2026-10-22T08:36:00Z"), sumber: sumber() })).toBeNull();
    expect(dikirim).toHaveLength(1);
  });

  it("hari sidang keliling aktif: jalan pukul 14.00 dan TIDAK lagi pukul 16.30", async () => {
    // Tabel milik saklar Sidang keliling (migrasi 0083) sudah ada di skema.
    const TGL = "2026-10-29";
    await db.run("INSERT INTO aleta_sidang_keliling_hari (tanggal, aktif, diubah_oleh, diubah_nama, diubah_pada) VALUES (?, ?, ?, ?, ?)", [TGL, 1, "u1", "Derry", "x"]);
    await simpanSetelan(db, SUPER, { nyala: true, kering: true }, "");
    expect(await jamTundaOtomatis(db, TGL)).toBe("14:00");
    expect(await jamTundaOtomatis(db, HARI)).toBe("16:30");
    const sumberKeliling = { ...sumber(), jadwal: async () => ({ ok: true, galat: "", sidang: [barisJadwal("1", { tanggalSidang: TGL })] }), bahan: async () => ({ ...bahan(1, [{ ...sidang(1, TGL, null), ditunda: false }]), keadaan: { jadwalId: 1, tanggalSidang: TGL, ditunda: "T", alasanDitunda: "0", sidangKeliling: "T" } }) };
    expect(await detakTundaOtomatis(db, { kini: new Date("2026-10-29T05:55:00Z"), sumber: sumberKeliling })).toBeNull();
    expect(await detakTundaOtomatis(db, { kini: new Date("2026-10-29T06:01:00Z"), sumber: sumberKeliling })).not.toBeNull();
    expect(await detakTundaOtomatis(db, { kini: new Date("2026-10-29T08:31:00Z"), sumber: sumberKeliling })).toBeNull();
    expect(dikirim).toHaveLength(1);
    expect((await bacaCatatanHari(db, TGL)).jalan?.jam).toBe("14:00");
  });

  it("Sabtu/Minggu/hari libur: tidak ada jalan", async () => {
    await simpanSetelan(db, SUPER, { nyala: true, kering: true }, "");
    expect(await detakTundaOtomatis(db, { kini: new Date("2026-10-24T08:40:00Z"), sumber: sumber() })).toBeNull();
    expect(await detakTundaOtomatis(db, { kini: new Date("2026-12-25T08:40:00Z"), sumber: sumber() })).toBeNull();
  });
});

// ============================================================================
// 7. BOT: PENJAGA SEBELUM MENULIS, ANTREAN OTOMATIS
// ============================================================================

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.env.ALETA_UJI_AKAR_BOT || path.resolve(process.cwd(), "../aleta_bot"));

describe("bot: penjaga tunda otomatis dan antrean", () => {
  let jadwalSesudah = 0;
  let kunciAktif = false;
  let penjaga: (k: Record<string, unknown>, m: Record<string, unknown>) => Promise<{ alasan: string } | null>;

  beforeAll(() => {
    const jalurDb = require_.resolve(path.join(AKAR_BOT, "db_config.js"));
    const jalurLayanan = require_.resolve(path.join(AKAR_BOT, "services/sidangHasilService.js"));
    const jalurKunci = require_.resolve(path.join(AKAR_BOT, "services/penetapanKunciService.js"));
    delete require_.cache[jalurLayanan];
    require_(jalurDb);
    require_.cache[jalurDb]!.exports = {
      query(_sql: string, params: unknown, cb?: unknown) {
        const selesai = (typeof params === "function" ? params : cb) as (g: unknown, r?: unknown) => void;
        setImmediate(() => selesai(null, [{ n: jadwalSesudah }]));
      },
    };
    require_(jalurKunci);
    require_.cache[jalurKunci]!.exports = { layanan: () => ({ lihat: async () => ({ aktif: kunciAktif }) }) };
    penjaga = require_(jalurLayanan).penjagaTundaOtomatis;
  });

  const keadaan = (ubah: Record<string, unknown> = {}) => ({ jadwalId: 1, perkaraId: 9, tanggalSidang: HARI, urutan: 3, alasanDitunda: "0", ikrarTalak: "T", tanggalPutusan: "", ...ubah });

  it("menolak menimpa hasil yang sudah dicatat (termasuk 'putus ...' berbendera ditunda=T)", async () => {
    jadwalSesudah = 0;
    kunciAktif = false;
    expect(await penjaga(keadaan(), { tanggalSidangHarap: HARI })).toBeNull();
    expect((await penjaga(keadaan({ alasanDitunda: "putus DIKABULKAN (verstek)" }), {}))?.alasan).toBe("sidang_sudah_diberi_hasil");
    expect((await penjaga(keadaan({ tanggalPutusan: "2026-10-22" }), {}))?.alasan).toBe("perkara_sudah_diputus");
    expect((await penjaga(keadaan(), { tanggalSidangHarap: "2026-10-21" }))?.alasan).toBe("jadwal_berubah");
    expect((await penjaga(keadaan({ ikrarTalak: "Y" }), {}))?.alasan).toBe("sidang_ikrar_dilewati");
  });

  it("menolak bila sudah ada sidang sesudahnya atau petugas memegang kunci perkara", async () => {
    jadwalSesudah = 1;
    expect((await penjaga(keadaan(), {}))?.alasan).toBe("sudah_ada_jadwal_berikutnya");
    jadwalSesudah = 0;
    kunciAktif = true;
    expect((await penjaga(keadaan(), {}))?.alasan).toBe("perkara_sedang_dikerjakan");
    kunciAktif = false;
  });

  it("antrean: tulisan otomatis berkunci sendiri, tercatat asal 'otomatis', hanya baris otomatis yang dapat dibatalkan", async () => {
    const { buatLayanan } = require_(path.join(AKAR_BOT, "services/antreanTulisSippService.js"));
    const kueri: Array<[string, unknown[]]> = [];
    const layanan = buatLayanan({
      db: { query: async (sql: string, p: unknown[] = []) => (kueri.push([sql, p]), /^\s*UPDATE/.test(sql) ? { affectedRows: 1 } : { affectedRows: 1, insertId: 7 }) },
      sekarang: () => "2026-10-22 16:30:10",
      aktif: () => true,
      libur: () => null,
    });
    // Keputusan 22 Okt: pukul 16.30 antrean ke besok TIDAK pernah - tulis sekarang (gerbang null).
    expect(await layanan.gerbangManual({ badan: { kering: false, jamKerja: "antrekan", otomatis: true }, jenis: "sidang-tunda", kunci: "sidang-tunda:otomatis:1", muatan: {} })).toBeNull();
    expect(kueri.some(([s]) => /INSERT INTO aleta_bot_antrean_tulis_sipp/.test(s))).toBe(false);
    // Pagi sebelum 07.30 hari yang sama: antrean boleh (masih hari itu).
    const pagi = buatLayanan({
      db: { query: async (sql: string, p: unknown[] = []) => (kueri.push([sql, p]), sql.trim().startsWith("UPDATE") ? { affectedRows: 1 } : { affectedRows: 1, insertId: 7 }) },
      sekarang: () => "2026-10-22 06:50:00",
      aktif: () => true,
      libur: () => null,
    });
    const g = await pagi.gerbangManual({ badan: { kering: false, jamKerja: "antrekan", otomatis: true }, jenis: "sidang-tunda", kunci: "sidang-tunda:otomatis:1", muatan: {} });
    expect(g.body.diantrekan).toBe(true);
    const sisip = kueri.find(([s]) => /INSERT INTO aleta_bot_antrean_tulis_sipp/.test(s))!;
    expect(sisip[1][0]).toBe("sidang-tunda:otomatis:1");
    expect(sisip[1][4]).toBe("otomatis");
    expect(String(sisip[1][6]).slice(0, 10)).toBe("2026-10-22");
    const r = await layanan.batalkanOtomatis("sidang-tunda:otomatis:1");
    expect(r.dibatalkan).toBe(true);
    expect(kueri.find(([s]) => /SET status = 'batal'/.test(s))![0]).toMatch(/asal = 'otomatis' AND status = 'menunggu'/);

    const rute = readFileSync(path.join(AKAR_BOT, "routes/internalGatewayRoutes.js"), "utf8");
    expect(rute).toContain('b.otomatis === true ? `otomatis:${String(b.jadwalId || "")}`');
    const alur = readFileSync(path.join(AKAR_BOT, "services/sidangHasilAlur.js"), "utf8");
    expect(alur).toContain("otomatis: badan.otomatis === true");
  });
});
