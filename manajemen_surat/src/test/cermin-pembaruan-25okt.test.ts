// @vitest-environment node
/**
 * ============================================================================
 * CERMIN PERKARA - PEMBARUAN BERKALA, TULISAN SEKETIKA, PENCOCOKAN (A3, 25 Okt 2026)
 * ============================================================================
 *
 *   A. aturan murni: waktu SIPP, jatuh tempo pencocokan (Minggu 02.00), keadaan bersih;
 *   B. pembaruan: menunggu pemindaian awal, perkara baru masuk <= satu putaran, perubahan
 *      masuk, perkara yang hilang di SIPP dihapus, tanda waktu + tumpang tindih, jendela
 *      panas, antrean tanggal, selang + galat beruntun, saklar mati;
 *   C. tulisan lewat ALETA masuk seketika (digabung, tidak bila saklar mati / tidak menyentuh data);
 *   D. pencocokan: data DIHAPUS di SIPP tertangkap, baru/berubah diperbaiki, bersih bila sama,
 *      hanya Minggu 02.00 dan sekali per Minggu, tidak sebelum pemindaian selesai;
 *   E. bot (cerminPembaruanService): hanya SELECT, tabel besar lewat kolom tanggal berindeks,
 *      tabel tak terbaca dicatat, bacaan terpotong berhenti di waktu baris terakhir.
 *
 * Data rekaan saja. Tidak ada jaringan dan tidak ada SIPP sungguhan.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PENGATURAN_CERMIN_BAWAAN,
  bersihkanKeadaanPembaruan,
  bersihkanKeadaanPencocokan,
  geserWaktuSipp,
  hariPekan,
  keadaanPemindaiAwal,
  pencocokanBersih,
  pencocokanJatuhTempo,
  tambahHari,
  waktuSippDari,
  waktuSippTerbaru,
  type PengaturanCermin,
} from "@/lib/cermin";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import type {
  BotCerminLengkap,
  IdPerkaraSumber,
  IdSidangSumber,
  PerkaraSumber,
  PerubahanSumber,
  SidangSumber,
} from "@/server/modules/cermin/bot";
import { KUNCI_JEJAK, tulisJejak } from "@/server/modules/cermin/jejak";
import {
  JEDA_SEGERA_MS,
  aturUlangPembaruanCermin,
  gabungAntrianTanggal,
  muatKeadaanPembaruan,
  putaranPembaruan,
  segarkanSegera,
  tanggalPanas,
  type DepsPembaruan,
} from "@/server/modules/cermin/pembaruan";
import { aturUlangPemindaiCermin } from "@/server/modules/cermin/pemindai";
import { aturUlangPencocokanCermin, jalankanPencocokan, muatKeadaanPencocokan, pencocokanBilaJatuhTempo } from "@/server/modules/cermin/pencocokan";
import { gantiSidangRentang, hitunganCermin, simpanKelompokPerkara, simpanJendelaSidang } from "@/server/modules/cermin/penyimpan";
import { cerminSetelahTulisan, tanggalDariBadanTulisan } from "@/server/modules/cermin/setelah-tulisan";

const AKAR = path.resolve(__dirname, "../../..");
const muatBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));

// ============================================================================
// A. aturan murni
// ============================================================================
describe("A. aturan murni", () => {
  it("geserWaktuSipp melintasi menit/hari/tahun tanpa zona; tidak sah -> kosong", () => {
    expect(geserWaktuSipp("2026-10-25 10:00:00", -120)).toBe("2026-10-25 09:58:00");
    expect(geserWaktuSipp("2026-01-01 00:00:30", -60)).toBe("2025-12-31 23:59:30");
    expect(geserWaktuSipp("2026-10-25T10:00:00", 30)).toBe("2026-10-25 10:00:30");
    expect(geserWaktuSipp("kemarin", 5)).toBe("");
  });

  it("waktuSippDari memakai jam dinding WITA; waktuSippTerbaru mengalahkan kosong", () => {
    expect(waktuSippDari(new Date("2026-10-25T14:05:09Z"))).toBe("2026-10-25 22:05:09");
    expect(waktuSippTerbaru("", "2026-10-25 10:00:00")).toBe("2026-10-25 10:00:00");
    expect(waktuSippTerbaru("2026-10-25 11:00:00", "2026-10-25 10:00:00")).toBe("2026-10-25 11:00:00");
    expect(waktuSippTerbaru("2026-10-25 11:00:00", "")).toBe("2026-10-25 11:00:00");
  });

  it("hari pekan dan jatuh tempo pencocokan: Minggu >= 02.00 WITA, sekali per Minggu", () => {
    expect(hariPekan("2026-10-25")).toBe(0); // Minggu
    expect(hariPekan("2026-10-26")).toBe(1);
    const minggu0155 = new Date("2026-10-24T17:55:00Z"); // 01.55 WITA Minggu 25 Okt
    const minggu0200 = new Date("2026-10-24T18:00:00Z"); // 02.00 WITA
    const minggu2300 = new Date("2026-10-25T15:00:00Z"); // 23.00 WITA
    const senin = new Date("2026-10-25T20:00:00Z"); // 04.00 WITA Senin 26 Okt
    expect(pencocokanJatuhTempo(minggu0155, "")).toBe(false);
    expect(pencocokanJatuhTempo(minggu0200, "")).toBe(true);
    expect(pencocokanJatuhTempo(minggu2300, "")).toBe(true);
    expect(pencocokanJatuhTempo(senin, "")).toBe(false);
    // Sudah dikerjakan Minggu itu -> tidak lagi; Minggu depannya ya.
    expect(pencocokanJatuhTempo(minggu2300, "2026-10-24T18:30:00.000Z")).toBe(false);
    expect(pencocokanJatuhTempo(new Date("2026-11-01T01:00:00Z"), "2026-10-24T18:30:00.000Z")).toBe(true);
    expect(pencocokanJatuhTempo(minggu2300, "rusak")).toBe(true);
  });

  it("pencocokanBersih: hanya bila tidak ada satu selisih pun", () => {
    const dasar = bersihkanKeadaanPencocokan({
      terakhir: { pada: "2026-10-25T00:00:00Z", ms: 5, perkaraDihapus: 0, perkaraDitambah: 0, perkaraDiperbaiki: 0, sidangDihapus: 0, sidangDitambah: 0, sidangDiperbaiki: 0, tanggalDisegarkan: 0, pemicu: "mingguan", catatan: "" },
    });
    expect(pencocokanBersih(dasar.terakhir)).toBe(true);
    expect(pencocokanBersih({ ...dasar.terakhir!, sidangDihapus: 1 })).toBe(false);
    expect(pencocokanBersih(null)).toBe(false);
  });

  it("keadaan rusak jatuh ke awal; antrean tanggal disaring dan dibatasi", () => {
    expect(bersihkanKeadaanPembaruan("x").tanda).toBe("");
    expect(bersihkanKeadaanPembaruan({ antrianTanggal: ["2026-10-25", "besok", 5] }).antrianTanggal).toEqual(["2026-10-25"]);
    expect(bersihkanKeadaanPencocokan({ terakhir: { pada: 5 } }).terakhir).toBeNull();
    expect(gabungAntrianTanggal(["2026-10-27", "2026-10-25"], ["2026-10-25", "2026-10-26"])).toEqual(["2026-10-25", "2026-10-26", "2026-10-27"]);
  });

  it("jendela panas dari hari ini WITA", () => {
    const j = tanggalPanas(new Date("2026-10-25T14:00:00Z"), { panasHariLalu: 1, panasHariDepan: 7 });
    expect(j).toEqual({ hari: "2026-10-25", dari: "2026-10-24", sampai: "2026-11-01" });
    // 17.00 UTC = 01.00 WITA hari berikutnya.
    expect(tanggalPanas(new Date("2026-10-25T17:00:00Z"), { panasHariLalu: 0, panasHariDepan: 0 }).hari).toBe("2026-10-26");
  });
});

// ============================================================================
// SIPP palsu: model data yang dapat diubah, dan bot yang membacanya
// ============================================================================
function perkara(id: number, ubah: Partial<PerkaraSumber> = {}): PerkaraSumber {
  return {
    perkaraId: String(id),
    nomorPerkara: `${id}/Pdt.G/2026/PA.Rekaan`,
    jenisPerkaraId: 346,
    jenisPerkaraNama: "Cerai Talak",
    alurPerkaraId: 15,
    tanggalPendaftaran: "2026-01-02",
    prodeo: 0,
    tahapanTerakhirId: 15,
    tahapanTerakhirText: "Persidangan",
    prosesTerakhirId: 130,
    prosesTerakhirText: "Sidang Pertama",
    majelisHakim: "Hakim Rekaan",
    paniteraPengganti: "PP Rekaan",
    jurusita: "JS Rekaan",
    sidangPertama: "2026-02-01",
    sidangTerakhir: "",
    sidangBerikut: "",
    jumlahSidang: 1,
    tanggalPutusan: "",
    statusPutusan: "",
    putusanVerstek: 0,
    tanggalMinutasi: "",
    tanggalBht: "",
    sippDiperbarui: "2026-10-20 08:00:00",
    ...ubah,
  };
}

function sidang(id: number, perkaraId: number, tanggal: string, ubah: Partial<SidangSumber> = {}): SidangSumber {
  return {
    sidangId: String(id),
    perkaraId: String(perkaraId),
    tanggalSidang: tanggal,
    jamSidang: "09:00:00",
    ruangan: "Ruang Sidang 1",
    agenda: "Pembuktian",
    ditunda: 0,
    sippDiperbarui: "2026-10-20 08:00:00",
    baris: { sidangId: String(id), nomorPerkara: `${perkaraId}/Pdt.G/2026/PA.Rekaan`, tanggalSidang: tanggal },
    ...ubah,
  };
}

class SippPalsu {
  perkara = new Map<string, PerkaraSumber>();
  sidang = new Map<string, SidangSumber>();
  /** Jawaban perubahan() yang akan datang; kosong = tidak ada yang tersentuh. */
  perubahanBerikut: Partial<PerubahanSumber> = {};
  panggilan: string[] = [];
  sejakDitanya: string[] = [];
  /** Jendela lebih dari ini hari terpotong (0 = tak pernah). */
  potongJikaLebihDari = 0;
  /** Bila diisi, semua panggilan gagal dengan pesan ini. */
  rusak = "";

  pasangPerkara(...p: PerkaraSumber[]) {
    for (const x of p) this.perkara.set(x.perkaraId, x);
  }
  pasangSidang(...s: SidangSumber[]) {
    for (const x of s) this.sidang.set(x.sidangId, x);
  }

  bot(): BotCerminLengkap {
    const gagal = () => ({ ok: false as const, error: this.rusak });
    return {
      ringkasan: async () => {
        this.panggilan.push("ringkasan");
        if (this.rusak) return gagal();
        const tgl = [...this.sidang.values()].map((s) => s.tanggalSidang).sort();
        return {
          ok: true,
          data: {
            perkara: { jumlah: this.perkara.size, terkecil: 1, terbesar: this.perkara.size },
            sidang: { jumlah: this.sidang.size, awal: tgl[0] ?? "", akhir: tgl[tgl.length - 1] ?? "" },
            hariIni: "2026-10-25",
          },
        };
      },
      perkara: async (setelahId, batas) => {
        this.panggilan.push(`perkara:${setelahId}`);
        if (this.rusak) return gagal();
        const daftar = [...this.perkara.values()].filter((p) => Number(p.perkaraId) > setelahId).sort((a, b) => Number(a.perkaraId) - Number(b.perkaraId)).slice(0, batas);
        return { ok: true, data: { perkara: daftar, terakhirId: daftar.length ? Number(daftar[daftar.length - 1].perkaraId) : setelahId, habis: daftar.length < batas } };
      },
      sidang: async (dari, sampai) => {
        this.panggilan.push(`sidang:${dari}:${sampai}`);
        if (this.rusak) return gagal();
        const dalam = [...this.sidang.values()].filter((s) => s.tanggalSidang >= dari && s.tanggalSidang <= sampai).sort((a, b) => (a.tanggalSidang + a.sidangId < b.tanggalSidang + b.sidangId ? -1 : 1));
        const lebar = Math.round((Date.parse(sampai) - Date.parse(dari)) / 86_400_000) + 1;
        if (this.potongJikaLebihDari > 0 && lebar > this.potongJikaLebihDari) {
          return { ok: true, data: { dari, sampai, terpotong: true, sidang: dalam.slice(0, 1) } };
        }
        return { ok: true, data: { dari, sampai, terpotong: false, sidang: dalam } };
      },
      perkaraId: async (id) => {
        this.panggilan.push(`perkaraId:${id.join(",")}`);
        if (this.rusak) return gagal();
        return { ok: true, data: { perkara: id.map((i) => this.perkara.get(String(i))).filter((p): p is PerkaraSumber => Boolean(p)) } };
      },
      perubahan: async (sejak, batas) => {
        this.panggilan.push(`perubahan:${batas}`);
        this.sejakDitanya.push(sejak);
        if (this.rusak) return gagal();
        const b = this.perubahanBerikut;
        return {
          ok: true,
          data: {
            sejak,
            tandaBaru: b.tandaBaru ?? sejak,
            terpotong: b.terpotong ?? false,
            jumlahTersentuh: b.perkaraId?.length ?? 0,
            perkaraId: b.perkaraId ?? [],
            tanggalSidang: b.tanggalSidang ?? [],
            tidakTerbaca: b.tidakTerbaca ?? [],
          },
        };
      },
      idPerkara: async (setelahId, batas) => {
        this.panggilan.push(`idPerkara:${setelahId}`);
        if (this.rusak) return gagal();
        const daftar = [...this.perkara.values()].filter((p) => Number(p.perkaraId) > setelahId).sort((a, b) => Number(a.perkaraId) - Number(b.perkaraId)).slice(0, batas);
        const data: IdPerkaraSumber = {
          perkara: daftar.map((p) => ({ perkaraId: p.perkaraId, waktu: p.sippDiperbarui })),
          terakhirId: daftar.length ? Number(daftar[daftar.length - 1].perkaraId) : setelahId,
          habis: daftar.length < batas,
        };
        return { ok: true, data };
      },
      idSidang: async (dari, sampai) => {
        this.panggilan.push(`idSidang:${dari}:${sampai}`);
        if (this.rusak) return gagal();
        const data: IdSidangSumber = {
          dari,
          sampai,
          sidang: [...this.sidang.values()]
            .filter((s) => s.tanggalSidang >= dari && s.tanggalSidang <= sampai)
            .map((s) => ({ sidangId: s.sidangId, perkaraId: s.perkaraId, tanggalSidang: s.tanggalSidang, waktu: s.sippDiperbarui })),
        };
        return { ok: true, data };
      },
    };
  }
}

// ============================================================================
// Perlengkapan basis data + jam
// ============================================================================
const MALAM = "2026-10-25T14:00:00.000Z"; // 22.00 WITA, Minggu 25 Okt 2026
let db: AletaDatabase;
let jam: number;
let pengaturan: PengaturanCermin;
let sipp: SippPalsu;

const deps = (): DepsPembaruan => ({ db: async () => db, bot: sipp.bot(), pengaturan: async () => pengaturan, sekarang: () => new Date(jam) });

async function pemindaianSelesai() {
  const k = keadaanPemindaiAwal();
  k.status = "selesai";
  k.tahap = "selesai";
  k.mulaiPada = "2026-10-24T12:00:00.000Z"; // 20.00 WITA 24 Okt
  k.selesaiPada = "2026-10-24T13:00:00.000Z";
  k.sidang.awal = "2026-10-01";
  k.sidang.akhir = "2026-11-30";
  await tulisJejak(db, KUNCI_JEJAK.pemindai, k);
}
const baris = async (sql: string, p: unknown[] = []) => db.queryAll<Record<string, any>>(sql, p as never);
const idPerkaraCermin = async () => (await baris("SELECT perkara_id FROM aleta_cermin_perkara ORDER BY perkara_id")).map((r) => String(r.perkara_id));
const idSidangCermin = async () => (await baris("SELECT sidang_id FROM aleta_cermin_sidang ORDER BY sidang_id")).map((r) => String(r.sidang_id));

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: false });
  aturUlangPemindaiCermin();
  aturUlangPembaruanCermin();
  aturUlangPencocokanCermin();
  jam = Date.parse(MALAM);
  pengaturan = { ...PENGATURAN_CERMIN_BAWAAN, layar: { ...PENGATURAN_CERMIN_BAWAAN.layar }, pemindaiAktif: true };
  sipp = new SippPalsu();
});
afterEach(async () => {
  aturUlangPembaruanCermin();
  await db.close();
  vi.restoreAllMocks();
});

// ============================================================================
// B. pembaruan
// ============================================================================
describe("B. pembaruan berkala", () => {
  it("saklar MATI: tidak menyentuh bot sama sekali", async () => {
    pengaturan = { ...pengaturan, pemindaiAktif: false };
    await pemindaianSelesai();
    expect((await putaranPembaruan(deps())).alasan).toBe("mati");
    expect(sipp.panggilan).toEqual([]);
  });

  it("menunggu pemindaian awal selesai - tidak menyentuh bot", async () => {
    expect((await putaranPembaruan(deps())).alasan).toBe("menunggu-pemindaian");
    expect(sipp.panggilan).toEqual([]);
  });

  it("perkara BARU di SIPP masuk dalam satu putaran (perubahan -> perkaraId -> cermin)", async () => {
    await pemindaianSelesai();
    sipp.pasangPerkara(perkara(1));
    sipp.perubahanBerikut = { perkaraId: ["1"], tandaBaru: "2026-10-25 21:59:30" };
    const r = await putaranPembaruan(deps());
    expect(r).toMatchObject({ alasan: "ok", perkara: 1 });
    expect(await idPerkaraCermin()).toEqual(["1"]);
    const k = await muatKeadaanPembaruan(db);
    expect(k.tanda).toBe("2026-10-25 21:59:30");
    expect(k.terakhir?.perkara).toBe(1);
    expect(k.galat.beruntun).toBe(0);
  });

  it("tanda awal = saat pemindaian dimulai (WITA) dikurangi 10 menit; bacaan berikutnya mundur 2 menit dari tanda", async () => {
    await pemindaianSelesai();
    await putaranPembaruan(deps());
    // mulaiPada 12.00Z = 20.00 WITA -> 19.50.00 dikurangi tumpang tindih 2 menit = 19.48.00
    expect(sipp.sejakDitanya[0]).toBe("2026-10-24 19:48:00");
    jam += 61_000;
    sipp.perubahanBerikut = { perkaraId: [], tandaBaru: "2026-10-25 22:00:30" };
    await putaranPembaruan(deps());
    jam += 61_000;
    await putaranPembaruan(deps());
    expect(sipp.sejakDitanya[2]).toBe("2026-10-25 21:58:30");
  });

  it("perubahan di SIPP masuk cermin (hanya baris yang berubah ditulis)", async () => {
    await pemindaianSelesai();
    sipp.pasangPerkara(perkara(1), perkara(2));
    await simpanKelompokPerkara(db, [perkara(1), perkara(2)], "2026-10-24T13:00:00.000Z");
    sipp.pasangPerkara(perkara(1, { tanggalPutusan: "2026-10-25", statusPutusan: "Dikabulkan", sippDiperbarui: "2026-10-25 21:00:00" }));
    sipp.perubahanBerikut = { perkaraId: ["1", "2"], tandaBaru: "2026-10-25 21:00:00" };
    const r = await putaranPembaruan(deps());
    expect(r.ditulis).toBe(1); // perkara 2 tidak berubah
    const [satu] = await baris("SELECT status_putusan, tanggal_putusan FROM aleta_cermin_perkara WHERE perkara_id = '1'");
    expect(satu).toEqual({ status_putusan: "Dikabulkan", tanggal_putusan: "2026-10-25" });
  });

  it("perkara yang diminta tetapi tidak dikembalikan SIPP (dihapus) dihapus dari cermin beserta sidangnya", async () => {
    await pemindaianSelesai();
    await simpanKelompokPerkara(db, [perkara(1), perkara(2)], "x");
    await simpanJendelaSidang(db, { sidang: [sidang(10, 2, "2026-10-26")] }, "x");
    sipp.pasangPerkara(perkara(1)); // perkara 2 sudah tidak ada
    sipp.perubahanBerikut = { perkaraId: ["1", "2"] };
    await putaranPembaruan(deps());
    expect(await idPerkaraCermin()).toEqual(["1"]);
    expect(await idSidangCermin()).toEqual([]);
  });

  it("tanggal sidang tersentuh dihitung ulang: baris baru, berubah, dan yang HILANG/dipindah dihapus", async () => {
    await pemindaianSelesai();
    // Cermin lama: sidang 10 dan 11 pada 2026-12-15 (di luar jendela panas) -> hanya lewat antrean tanggal.
    await simpanJendelaSidang(db, { sidang: [sidang(10, 1, "2026-12-15"), sidang(11, 2, "2026-12-15")] }, "x");
    sipp.pasangSidang(sidang(10, 1, "2026-12-15", { agenda: "Putusan", sippDiperbarui: "2026-10-25 20:00:00", baris: { sidangId: "10", agenda: "Putusan" } }), sidang(12, 3, "2026-12-15"));
    sipp.perubahanBerikut = { perkaraId: [], tanggalSidang: ["2026-12-15"] };
    await putaranPembaruan(deps());
    expect(sipp.panggilan).toContain("sidang:2026-12-15:2026-12-15");
    expect(await idSidangCermin()).toEqual(["10", "12"]); // 11 hilang di SIPP
    const [s10] = await baris("SELECT agenda, baris_json FROM aleta_cermin_sidang WHERE sidang_id = '10'");
    expect(s10.agenda).toBe("Putusan");
    expect(JSON.parse(s10.baris_json)).toEqual({ sidangId: "10", agenda: "Putusan" });
  });

  it("bacaan terpotong batas baris TIDAK menghapus apa pun (dibelah sampai tidak terpotong)", async () => {
    await pemindaianSelesai();
    await simpanJendelaSidang(db, { sidang: [sidang(10, 1, "2026-10-26"), sidang(11, 1, "2026-10-27"), sidang(12, 1, "2026-10-28")] }, "x");
    sipp.pasangSidang(sidang(10, 1, "2026-10-26"), sidang(11, 1, "2026-10-27"), sidang(12, 1, "2026-10-28"));
    sipp.potongJikaLebihDari = 1; // hanya jendela satu hari yang utuh
    await putaranPembaruan(deps());
    expect(await idSidangCermin()).toEqual(["10", "11", "12"]);
    // Jendela panas 24 Okt..1 Nov dibelah berulang hingga satuan hari.
    expect(sipp.panggilan.filter((p) => p.startsWith("sidang:")).length).toBeGreaterThan(9);
  });

  it("jendela panas dihitung ulang sesudah panasMenit, bukan tiap putaran", async () => {
    await pemindaianSelesai();
    await putaranPembaruan(deps());
    const sidangKe = () => sipp.panggilan.filter((p) => p === "sidang:2026-10-24:2026-11-01").length;
    expect(sidangKe()).toBe(1);
    jam += 61_000; // 1 menit: belum
    await putaranPembaruan(deps());
    expect(sidangKe()).toBe(1);
    jam += 3 * 60_000; // lewat 3 menit
    await putaranPembaruan(deps());
    expect(sidangKe()).toBe(2);
  });

  it("antrean tanggal: beberapa per putaran, sisanya menunggu", async () => {
    await pemindaianSelesai();
    const tanggal = Array.from({ length: 10 }, (_, i) => tambahHari("2027-02-01", i));
    sipp.perubahanBerikut = { perkaraId: [], tanggalSidang: tanggal };
    await putaranPembaruan(deps());
    let k = await muatKeadaanPembaruan(db);
    expect(k.antrianTanggal).toHaveLength(4); // 10 - 6 per putaran
    sipp.perubahanBerikut = {};
    jam += 61_000;
    await putaranPembaruan(deps());
    k = await muatKeadaanPembaruan(db);
    expect(k.antrianTanggal).toEqual([]);
  });

  it("selang dihormati: putaran terlalu cepat menolak tanpa menyentuh bot; paksa melewatinya", async () => {
    await pemindaianSelesai();
    await putaranPembaruan(deps());
    const n = sipp.panggilan.length;
    jam += 10_000;
    expect((await putaranPembaruan(deps())).alasan).toBe("menunggu-selang");
    expect(sipp.panggilan.length).toBe(n);
    expect((await putaranPembaruan(deps(), { paksa: true })).alasan).toBe("ok");
  });

  it("bot gagal: galat dicatat, tanda tidak bergeser, jeda bertambah, pulih sesudahnya", async () => {
    await pemindaianSelesai();
    await putaranPembaruan(deps());
    const tanda = (await muatKeadaanPembaruan(db)).tanda;
    sipp.rusak = "SIPP tidak menjawab";
    jam += 61_000;
    const r = await putaranPembaruan(deps());
    expect(r.alasan).toBe("galat");
    let k = await muatKeadaanPembaruan(db);
    expect(k.tanda).toBe(tanda);
    expect(k.galat).toMatchObject({ beruntun: 1 });
    expect(k.galat.terakhir).toContain("SIPP tidak menjawab");
    // Jeda galat pertama: 60 x 2 = 120 detik.
    jam += 61_000;
    expect((await putaranPembaruan(deps())).alasan).toBe("menunggu-selang");
    sipp.rusak = "";
    jam += 61_000;
    expect((await putaranPembaruan(deps())).alasan).toBe("ok");
    k = await muatKeadaanPembaruan(db);
    expect(k.galat.beruntun).toBe(0);
  });

  it("tabel SIPP yang tidak terbaca dicatat di keadaan, pembaruan tetap jalan", async () => {
    await pemindaianSelesai();
    sipp.perubahanBerikut = { tidakTerbaca: [{ tabel: "perkara_pihak4", sebab: "Table doesn't exist" }] };
    expect((await putaranPembaruan(deps())).alasan).toBe("ok");
    expect((await muatKeadaanPembaruan(db)).tidakTerbaca).toEqual(["perkara_pihak4: Table doesn't exist"]);
  });
});

// ============================================================================
// C. tulisan lewat ALETA masuk seketika
// ============================================================================
describe("C. tulisan masuk cermin seketika", () => {
  it("segarkanSegera menyegarkan jendela panas SEKARANG (tanpa menunggu selang) dan tanggal yang disebut", async () => {
    await pemindaianSelesai();
    sipp.pasangSidang(sidang(10, 1, "2026-10-26", { agenda: "Baru" }), sidang(20, 1, "2026-12-20"));
    await putaranPembaruan(deps()); // putaran normal pertama
    sipp.pasangSidang(sidang(10, 1, "2026-10-26", { agenda: "Ditunda ke Desember", ditunda: 1, sippDiperbarui: "2026-10-25 22:00:00" }));
    jam += 5_000; // jauh di bawah selang 60 dtk
    const r = await segarkanSegera(["2026-12-20"], deps());
    expect(r.alasan).toBe("ok");
    const [s10] = await baris("SELECT agenda, ditunda FROM aleta_cermin_sidang WHERE sidang_id = '10'");
    expect(s10).toEqual({ agenda: "Ditunda ke Desember", ditunda: 1 });
    expect(await idSidangCermin()).toContain("20"); // tanggal yang disebut tulisan ikut dihitung
  });

  it("saklar mati atau pemindaian belum selesai = tidak melakukan apa pun", async () => {
    pengaturan = { ...pengaturan, pemindaiAktif: false };
    await pemindaianSelesai();
    expect((await segarkanSegera([], deps())).alasan).toBe("mati");
    pengaturan = { ...pengaturan, pemindaiAktif: true };
    await tulisJejak(db, KUNCI_JEJAK.pemindai, keadaanPemindaiAwal());
    expect((await segarkanSegera([], deps())).alasan).toBe("menunggu-pemindaian");
    expect(sipp.panggilan).toEqual([]);
  });

  it("tulisan beruntun digabung: satu putaran segera, sisanya ditunda lalu satu putaran lagi", async () => {
    await pemindaianSelesai();
    const jendela = () => sipp.panggilan.filter((p) => p === "sidang:2026-10-24:2026-11-01").length;
    expect((await segarkanSegera([], deps())).alasan).toBe("ok");
    expect(jendela()).toBe(1);
    // Dua tulisan lagi dalam 1,5 detik: tidak ada putaran langsung.
    expect((await segarkanSegera([], deps())).alasan).toBe("menunggu-selang");
    expect((await segarkanSegera([], deps())).alasan).toBe("sibuk");
    expect(jendela()).toBe(1);
    await vi.waitFor(() => expect(jendela()).toBe(2), { timeout: 6000, interval: 100 });
    // Setelah itu tenang: tidak ada putaran ketiga.
    await new Promise((res) => setTimeout(res, JEDA_SEGERA_MS + 300));
    expect(jendela()).toBe(2);
  });

  it("tanggalDariBadanTulisan mengambil tanggal sidang dari badan; selain tanggal ISO diabaikan", () => {
    expect(tanggalDariBadanTulisan(JSON.stringify({ tanggalBerikut: "2026-11-02", tanggal: "2026-11-01", x: "2026-12-25" }))).toEqual(["2026-11-01", "2026-11-02"]);
    expect(tanggalDariBadanTulisan(JSON.stringify({ tanggalBerikut: "besok" }))).toEqual([]);
    expect(tanggalDariBadanTulisan("bukan json")).toEqual([]);
    expect(tanggalDariBadanTulisan(undefined)).toEqual([]);
  });

  it("gerbang bot: tulisan berhasil memicu segarkanSegera; antrean pesan WhatsApp dan tulisan gagal tidak", async () => {
    vi.resetModules();
    const segarkan = vi.fn(async () => ({ alasan: "ok" as const }));
    vi.doMock("@/server/modules/cermin/pembaruan", () => ({ segarkanSegera: segarkan }));
    process.env.ALETA_CERMIN_SETELAH_TULISAN = "1";
    try {
      const klien = await import("@/server/modules/aleta-bot/whatsapp-gateway-client");
      let sukses = true;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          sukses
            ? new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } })
            : new Response(JSON.stringify({ ok: false, error: "ditolak" }), { status: 400, headers: { "content-type": "application/json" } })
        )
      );
      await klien.postGatewayTundaSidang({ perkaraId: "1", tanggalBerikut: "2026-11-09" });
      await vi.waitFor(() => expect(segarkan).toHaveBeenCalledTimes(1));
      expect(segarkan).toHaveBeenCalledWith(["2026-11-09"]);
      // Antrean pesan WhatsApp: tidak menyentuh data perkara.
      await klien.enqueueGatewayMessage({ sourceApp: "uji", sourceFeature: "uji", recipientNumber: "0", message: "x" });
      // Tulisan yang ditolak bot: data tidak berubah.
      sukses = false;
      await klien.postGatewayTundaSidang({ perkaraId: "2" });
      await new Promise((r) => setTimeout(r, 30));
      expect(segarkan).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.ALETA_CERMIN_SETELAH_TULISAN;
      vi.doUnmock("@/server/modules/cermin/pembaruan");
      vi.unstubAllGlobals();
    }
  });

  it("cerminSetelahTulisan tidak pernah melempar dan diam di lingkungan uji tanpa saklar", () => {
    expect(() => cerminSetelahTulisan(undefined, "{}")).not.toThrow();
    expect(() => cerminSetelahTulisan({ ruang: [] }, "{}")).not.toThrow();
  });
});

// ============================================================================
// D. pencocokan
// ============================================================================
describe("D. pencocokan", () => {
  async function cerminSama() {
    await pemindaianSelesai();
    sipp.pasangPerkara(perkara(1), perkara(2), perkara(3));
    sipp.pasangSidang(sidang(10, 1, "2026-10-26"), sidang(11, 2, "2026-10-27"), sidang(12, 3, "2026-11-10"));
    await simpanKelompokPerkara(db, [...sipp.perkara.values()], "2026-10-24T13:00:00.000Z");
    await simpanJendelaSidang(db, { sidang: [...sipp.sidang.values()] }, "2026-10-24T13:00:00.000Z");
  }

  it("tidak berjalan sebelum pemindaian awal selesai", async () => {
    const r = await jalankanPencocokan(deps());
    expect(r).toEqual({ jalan: false, alasan: "menunggu-pemindaian" });
    expect(sipp.panggilan).toEqual([]);
  });

  it("cermin yang sama dengan SIPP: bersih, tidak ada yang ditulis", async () => {
    await cerminSama();
    const r = await jalankanPencocokan(deps(), { pemicu: "tombol" });
    expect(r.jalan).toBe(true);
    if (!r.jalan) return;
    expect(pencocokanBersih(r.hasil)).toBe(true);
    expect(r.hasil.pemicu).toBe("tombol");
    expect((await muatKeadaanPencocokan(db)).terakhir?.pada).toBe(r.hasil.pada);
    expect(await idPerkaraCermin()).toEqual(["1", "2", "3"]);
    expect(await idSidangCermin()).toEqual(["10", "11", "12"]);
  });

  it("data DIHAPUS di SIPP tertangkap: perkara beserta sidangnya, dan sidang yang hilang/dipindah", async () => {
    await cerminSama();
    sipp.perkara.delete("2"); // perkara 2 dihapus di SIPP
    sipp.sidang.delete("11"); // sidangnya ikut hilang
    sipp.sidang.delete("12"); // sidang 12 dihapus (perkara 3 tetap ada)
    const r = await jalankanPencocokan(deps());
    expect(r.jalan).toBe(true);
    if (!r.jalan) return;
    // Sidang 11 ikut terhapus bersama perkara 2; yang tersisa untuk dihitung sebagai sidang hilang hanya 12.
    expect(r.hasil).toMatchObject({ perkaraDihapus: 1, sidangDihapus: 1, perkaraDitambah: 0, sidangDitambah: 0 });
    expect(pencocokanBersih(r.hasil)).toBe(false);
    expect(await idPerkaraCermin()).toEqual(["1", "3"]);
    expect(await idSidangCermin()).toEqual(["10"]);
  });

  it("baru dan berubah di SIPP diperbaiki (perkara dan sidang)", async () => {
    await cerminSama();
    sipp.pasangPerkara(perkara(4)); // baru
    sipp.pasangPerkara(perkara(1, { statusPutusan: "Dikabulkan", tanggalPutusan: "2026-10-25", sippDiperbarui: "2026-10-25 20:00:00" })); // berubah
    sipp.pasangSidang(sidang(13, 4, "2026-10-28")); // baru
    sipp.pasangSidang(sidang(10, 1, "2026-10-26", { agenda: "Putusan", sippDiperbarui: "2026-10-25 20:00:00" })); // berubah
    const r = await jalankanPencocokan(deps());
    expect(r.jalan).toBe(true);
    if (!r.jalan) return;
    expect(r.hasil).toMatchObject({ perkaraDitambah: 1, perkaraDiperbaiki: 1, sidangDitambah: 1, sidangDiperbaiki: 1 });
    expect(r.hasil.tanggalDisegarkan).toBe(2); // 26 dan 28 Okt
    expect(await idPerkaraCermin()).toEqual(["1", "2", "3", "4"]);
    expect(await idSidangCermin()).toEqual(["10", "11", "12", "13"]);
    const [p1] = await baris("SELECT status_putusan FROM aleta_cermin_perkara WHERE perkara_id = '1'");
    expect(p1.status_putusan).toBe("Dikabulkan");
    const [s10] = await baris("SELECT agenda FROM aleta_cermin_sidang WHERE sidang_id = '10'");
    expect(s10.agenda).toBe("Putusan");
    // Pencocokan kedua atas keadaan yang sama sudah bersih.
    const kedua = await jalankanPencocokan(deps());
    expect(kedua.jalan && pencocokanBersih(kedua.hasil)).toBe(true);
  });

  it("riwayat dibatasi delapan dan memuat hasil terbaru", async () => {
    await cerminSama();
    for (let i = 0; i < 10; i++) {
      jam += 1000;
      await jalankanPencocokan(deps());
    }
    const k = await muatKeadaanPencocokan(db);
    expect(k.riwayat).toHaveLength(8);
    expect(k.riwayat[7].pada).toBe(k.terakhir?.pada);
  });

  it("galat bot di tengah jalan tidak mencatat hasil dan tidak melempar", async () => {
    await cerminSama();
    sipp.rusak = "SIPP mati";
    const r = await jalankanPencocokan(deps());
    expect(r).toMatchObject({ jalan: false, alasan: "galat" });
    expect((await muatKeadaanPencocokan(db)).terakhir).toBeNull();
  });

  it("terjadwal: hanya Minggu >= 02.00 WITA, saklar menyala, dan sekali per Minggu", async () => {
    await cerminSama();
    // Minggu 22.00 WITA: jatuh tempo.
    const pertama = await pencocokanBilaJatuhTempo(deps(), pencocokanJatuhTempo);
    expect(pertama?.jalan).toBe(true);
    // Sama hari: tidak lagi.
    jam += 3_600_000;
    expect(await pencocokanBilaJatuhTempo(deps(), pencocokanJatuhTempo)).toBeNull();
    // Senin: tidak.
    jam = Date.parse("2026-10-26T03:00:00.000Z");
    expect(await pencocokanBilaJatuhTempo(deps(), pencocokanJatuhTempo)).toBeNull();
    // Minggu berikutnya: ya.
    jam = Date.parse("2026-11-01T14:00:00.000Z");
    expect((await pencocokanBilaJatuhTempo(deps(), pencocokanJatuhTempo))?.jalan).toBe(true);
    // Saklar mati: tidak.
    pengaturan = { ...pengaturan, pemindaiAktif: false };
    jam = Date.parse("2026-11-08T14:00:00.000Z");
    expect(await pencocokanBilaJatuhTempo(deps(), pencocokanJatuhTempo)).toBeNull();
  });

  it("gantiSidangRentang: hanya menghapus pada rentangnya, dan tidak menghapus bila terpotong", async () => {
    await simpanJendelaSidang(db, { sidang: [sidang(1, 1, "2026-10-26"), sidang(2, 1, "2026-10-27"), sidang(3, 1, "2026-10-28")] }, "x");
    const h = await gantiSidangRentang(db, "2026-10-26", "2026-10-27", [sidang(1, 1, "2026-10-26")], { sekarang: "y" });
    expect(h.dihapus).toBe(1);
    expect(await idSidangCermin()).toEqual(["1", "3"]);
    const t = await gantiSidangRentang(db, "2026-10-26", "2026-10-28", [], { terpotong: true, sekarang: "y" });
    expect(t.dihapus).toBe(0);
    expect(await idSidangCermin()).toEqual(["1", "3"]);
    expect((await hitunganCermin(db)).sidang).toBe(2);
  });
});

// ============================================================================
// E. bot: cerminPembaruanService
// ============================================================================
describe("E. bot - hanya membaca", () => {
  type Layanan = {
    perubahanSejak: (o: { sejak: string; batas?: number }) => Promise<Record<string, any>>;
    idPerkara: (o: { setelahId: number; batas: number }) => Promise<Record<string, any>>;
    idSidang: (o: { dari: string; sampai: string }) => Promise<Record<string, any>>;
    TABEL_WAKTU: Array<{ tabel: string; kolom: string[] }>;
    TABEL_TANGGAL: Array<{ tabel: string; tanggal: string }>;
  };
  const Modul = muatBot("module") as unknown as new (id: string) => { filename: string; loaded: boolean; exports: unknown };
  const dipasang: string[] = [];

  function muatDenganDb(query: (sql: string, params: unknown[]) => unknown[] | Error): { layanan: Layanan; kueri: Array<{ sql: string; params: unknown[] }> } {
    const jalurDb = muatBot.resolve("./db_config.js");
    const jalurLayanan = muatBot.resolve("./services/cerminPembaruanService.js");
    const kueri: Array<{ sql: string; params: unknown[] }> = [];
    const m = new Modul(jalurDb);
    m.filename = jalurDb;
    m.loaded = true;
    m.exports = {
      query: (sql: string, params: unknown[], cb: (e: unknown, r: unknown) => void) => {
        kueri.push({ sql, params });
        const hasil = query(sql, params);
        if (hasil instanceof Error) return cb(hasil, undefined);
        return cb(null, hasil);
      },
    };
    (muatBot.cache as Record<string, unknown>)[jalurDb] = m;
    delete (muatBot.cache as Record<string, unknown>)[jalurLayanan];
    dipasang.push(jalurDb, jalurLayanan);
    return { layanan: muatBot(jalurLayanan) as Layanan, kueri };
  }
  afterEach(() => {
    for (const j of dipasang.splice(0)) delete (muatBot.cache as Record<string, unknown>)[j];
  });

  it("setiap kueri berawalan SELECT; tabel besar dibaca lewat kolom tanggal berindeks, bukan kolom waktu pembaruan", async () => {
    const { layanan, kueri } = muatDenganDb((sql) => {
      if (/FROM perkara\s+WHERE/.test(sql)) return [{ perkaraId: 1, waktu: new Date(2026, 9, 25, 10, 0, 5) }];
      if (/FROM perkara_jadwal_sidang\s+WHERE diinput/.test(sql)) return [{ perkaraId: 2, waktu: new Date(2026, 9, 25, 10, 1, 0), tanggalSidang: new Date(2026, 10, 3) }];
      if (/FROM perkara_biaya/.test(sql)) return [{ perkaraId: 3 }];
      if (/FROM perkara_proses/.test(sql)) return [{ perkaraId: 3 }, { perkaraId: 4 }];
      if (/SELECT DISTINCT tanggal_sidang/.test(sql)) return [{ tanggalSidang: new Date(2026, 9, 28) }];
      return [];
    });
    const r = await layanan.perubahanSejak({ sejak: "2026-10-25 09:58:00" });
    expect(r.ok).toBe(true);
    for (const q of kueri) {
      expect(q.sql.trim(), q.sql).toMatch(/^SELECT\b/i);
      expect(q.sql, q.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP)\b/i);
    }
    const biaya = kueri.find((q) => /FROM perkara_biaya/.test(q.sql))!;
    expect(biaya.sql).toContain("tanggal_transaksi >= ?");
    expect(biaya.sql).not.toMatch(/diperbaharui_tanggal/);
    expect(biaya.params).toEqual(["2026-10-25"]);
    const proses = kueri.find((q) => /FROM perkara_proses/.test(q.sql))!;
    expect(proses.sql).toContain("tanggal >= ?");
    // Tabel menurut waktu: seluruh kolom waktunya dibandingkan dengan sejak.
    const perkaraQ = kueri.find((q) => /FROM perkara\s+WHERE/.test(q.sql))!;
    expect(perkaraQ.params).toEqual(["2026-10-25 09:58:00", "2026-10-25 09:58:00", "2026-10-25 09:58:00"]);
    expect(layanan.TABEL_WAKTU.map((t) => t.tabel)).toContain("perkara_jadwal_sidang");
    expect(layanan.TABEL_TANGGAL.map((t) => t.tabel)).toEqual(["perkara_biaya", "perkara_proses"]);

    expect(r.perkaraId.sort()).toEqual(["1", "2", "3", "4"]);
    // Tanggal sidang: baris jadwal yang tersentuh langsung + sidang perkara lain dalam jendela.
    expect(r.tanggalSidang).toEqual(["2026-10-28", "2026-11-03"]);
    expect(r.terpotong).toBe(false);
    expect(r.tandaBaru).toBe("2026-10-25 10:01:00"); // waktu baris terakhir yang termuat (perkara 3/4 diberi waktu sejak)
  });

  it("bacaan terpotong berhenti di perkara terakhir yang termuat; tabel yang gagal dicatat, bukan melempar", async () => {
    const { layanan } = muatDenganDb((sql) => {
      if (/FROM perkara\s+WHERE/.test(sql)) {
        return [
          { perkaraId: 1, waktu: new Date(2026, 9, 25, 10, 0, 1) },
          { perkaraId: 2, waktu: new Date(2026, 9, 25, 10, 0, 2) },
          { perkaraId: 3, waktu: new Date(2026, 9, 25, 10, 0, 3) },
        ];
      }
      if (/FROM perkara_pihak4/.test(sql)) return new Error("Table 'perkara_pihak4' doesn't exist");
      return [];
    });
    const r = await layanan.perubahanSejak({ sejak: "2026-10-25 09:00:00", batas: 2 });
    expect(r).toMatchObject({ ok: true, terpotong: true, jumlahTersentuh: 3, perkaraId: ["1", "2"], tandaBaru: "2026-10-25 10:00:02" });
    expect(r.tidakTerbaca).toEqual([{ tabel: "perkara_pihak4", sebab: expect.stringContaining("doesn't exist") }]);
  });

  it("sejak tidak sah ditolak sebelum satu kueri pun", async () => {
    const { layanan, kueri } = muatDenganDb(() => []);
    const r = await layanan.perubahanSejak({ sejak: "kemarin" });
    expect(r).toMatchObject({ ok: false, error: "sejak_tidak_sah" });
    expect(kueri).toEqual([]);
  });

  it("daftar ringan pencocokan: id + waktu, berparameter dan berbatas", async () => {
    const { layanan, kueri } = muatDenganDb((sql) => {
      if (/FROM perkara\s+WHERE perkara_id > \?/.test(sql)) return [{ perkaraId: 7, waktu: new Date(2026, 9, 1, 8, 0, 0) }, { perkaraId: 8, waktu: "0000-00-00 00:00:00" }];
      if (/FROM perkara_jadwal_sidang/.test(sql)) return [{ sidangId: 5, perkaraId: 7, tanggalSidang: new Date(2026, 9, 26), waktu: new Date(2026, 9, 2, 9, 0, 0) }];
      return [];
    });
    const p = await layanan.idPerkara({ setelahId: 6, batas: 99999 });
    expect(p).toMatchObject({ terakhirId: 8, habis: true });
    expect(p.perkara).toEqual([{ perkaraId: "7", waktu: "2026-10-01 08:00:00" }, { perkaraId: "8", waktu: "" }]);
    expect(kueri[0].params).toEqual([6, 5000]); // batas dijepit di sisi bot
    const s = await layanan.idSidang({ dari: "2026-10-01", sampai: "2026-10-31" });
    expect(s.sidang).toEqual([{ sidangId: "5", perkaraId: "7", tanggalSidang: "2026-10-26", waktu: "2026-10-02 09:00:00" }]);
    for (const q of kueri) expect(q.sql.trim()).toMatch(/^SELECT\b/i);
  });
});
