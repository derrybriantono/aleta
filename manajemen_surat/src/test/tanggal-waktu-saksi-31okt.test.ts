// @vitest-environment node
/**
 * 31 OKT 2026 - BUTIR 16: 0222 (awal konflik) & 0246 (pisah sejak) MENYIMPAN TANGGAL LENGKAP bila saksi menyebutnya.
 *
 * Keputusan pengguna: "sejak tanggal 23 Juli 2024" -> "tanggal 23 Juli 2024" (bentuk "tanggal _" variabelnya), bukan
 * "bulan Juli 2024". Dua saksi SAMA bila tanggalnya sama, atau yang satu menyebut bulan dan yang lain tanggal di bulan
 * itu -> dipakai yang lebih rinci. Kasus nyata: 8674 & 8850 (aps_badilag_2810.abt_keterangan_saksi) - kedua saksi
 * "sejak tanggal 23 Juli 2024" / "28 September 2022", petugas menulis tanggalnya.
 * Ukur 368 perkara (isian petugas): 0246 sama persis 286 -> 289, 4 usulan kini lebih rinci daripada isian (bulan yang
 * sama), selisih lain tetap 64; 0222 tidak berubah (saksi tidak pernah menyebut tanggal awal konflik).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Usulan = { kode: string; nilai: string; keyakinan?: string; bentrok?: string; tingkat?: string };
const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "../aleta_bot");
const L = require_(path.join(AKAR, "services/abtUsulanService.js")) as {
  dariKeteranganSaksi: (a: string, b: string, sidang?: string, pihak?: { pelaku?: string; lawan?: string }, posita?: string) => {
    usulan: Usulan[];
    kesesuaian?: { fakta: { kode: string; status: string }[] };
  };
  ambilBulanTahun: (k: string, o?: { tanggal?: boolean }) => { nilai: string; jenis: string };
  waktuSetara: (a: string, b: string) => string;
  lamaSejakAcuan: (n: string, t: string) => { teks: string; totalBulan: number } | null;
};
const bas = (...b: string[]) => b.map((x) => `- Bahwa ${x};`).join("\n");
const CG = { pelaku: "Tergugat", lawan: "Penggugat" };
const jalan = (s1: string, s2: string, sidang = "22 Oktober 2024") => {
  const h = L.dariKeteranganSaksi(bas(s1), bas(s2), sidang, CG, "");
  return { u: (k: string) => h.usulan.find((x) => x.kode === k)!, fakta: (k: string) => h.kesesuaian?.fakta.find((x) => x.kode === k) };
};

describe("0246 menyimpan tanggal yang disebut saksi", () => {
  it("8674: kedua saksi 'sejak tanggal 23 Juli 2024' -> tanggal 23 Juli 2024, pasti", () => {
    const r = jalan("Penggugat dan Tergugat sudah pisah tempat tinggal sejak tanggal 23 Juli 2024", "Penggugat dan Tergugat sudah pisah tempat tinggal sejak tanggal 23 Juli 2024 dan sudah berlangsung kurang lebih 3 bulan");
    expect(r.u("0246").nilai).toBe("tanggal 23 Juli 2024");
    expect(r.u("0246").keyakinan).toBe("pasti");
  });
  it("bulan + tanggal di bulan itu = sama; dipakai yang lebih rinci (dua arah)", () => {
    const a = jalan("sudah pisah tempat tinggal sejak bulan Juli 2024", "sudah pisah tempat tinggal sejak tanggal 23 Juli 2024");
    const b = jalan("sudah pisah tempat tinggal sejak tanggal 23 Juli 2024", "sudah pisah tempat tinggal sejak bulan Juli 2024");
    for (const r of [a, b]) {
      expect(r.u("0246").nilai).toBe("tanggal 23 Juli 2024");
      expect(r.u("0246").keyakinan).toBe("pasti");
      expect(r.fakta("0246")?.status).toBe("sama");
    }
  });
  it("dua tanggal berbeda = bentrok; '05' dan '5' = sama", () => {
    const r = jalan("sudah pisah tempat tinggal sejak tanggal 2 Juli 2024", "sudah pisah tempat tinggal sejak tanggal 23 Juli 2024");
    expect(r.u("0246").keyakinan).toBe("bentrok");
    expect(r.fakta("0246")?.status).toBe("berbeda");
    const s = jalan("sudah pisah tempat tinggal sejak tanggal 05 Desember 2024", "sudah pisah tempat tinggal sejak tanggal 5 Desember 2024");
    expect(s.u("0246").keyakinan).toBe("pasti");
  });
  it("bulan lain tetap bentrok; tanpa hari tetap 'bulan ...' seperti dahulu", () => {
    expect(jalan("sudah pisah tempat tinggal sejak bulan Juni 2024", "sudah pisah tempat tinggal sejak tanggal 23 Juli 2024").u("0246").keyakinan).toBe("bentrok");
    expect(jalan("sudah pisah tempat tinggal sejak bulan Juli 2024", "sudah pisah tempat tinggal sejak bulan Juli 2024").u("0246").nilai).toBe("bulan Juli 2024");
  });
});

describe("0222 awal konflik ikut aturan yang sama", () => {
  it("perselisihan sejak tanggal 5 Januari 2024 / bulan Januari 2024 -> tanggal, pasti", () => {
    const r = jalan("perselisihan dan pertengkaran terjadi sejak tanggal 5 Januari 2024", "perselisihan dan pertengkaran terjadi sejak bulan Januari 2024");
    expect(r.u("0222").nilai).toBe("tanggal 5 Januari 2024");
    expect(r.u("0222").keyakinan).toBe("pasti");
  });
});

describe("lama pisah dihitung dari tanggal: bulan yang belum genap dibuang", () => {
  it("23 Juli 2024 -> 22 Oktober 2024 = 2 bulan; -> 23 Oktober = 3 bulan; bulan saja tetap 3 bulan", () => {
    expect(L.lamaSejakAcuan("tanggal 23 Juli 2024", "2024-10-22")?.totalBulan).toBe(2);
    expect(L.lamaSejakAcuan("tanggal 23 Juli 2024", "2024-10-23")?.totalBulan).toBe(3);
    expect(L.lamaSejakAcuan("bulan Juli 2024", "2024-10-22")?.totalBulan).toBe(3);
    const r = jalan("sudah pisah tempat tinggal sejak tanggal 23 Juli 2024", "sudah pisah tempat tinggal sejak tanggal 23 Juli 2024", "22 Oktober 2024");
    expect(r.u("9944").nilai).toBe("2 bulan");
  });
});

describe("pemakai lain ambilBulanTahun tidak berubah", () => {
  it("tanpa opsi: tetap 'bulan Juli 2024'", () => {
    expect(L.ambilBulanTahun("menikah pada tanggal 23 Juli 2024").nilai).toBe("bulan Juli 2024");
    expect(L.ambilBulanTahun("sejak tanggal 23 Juli 2024", { tanggal: true }).nilai).toBe("tanggal 23 Juli 2024");
    expect(L.ambilBulanTahun("sejak 40 Juli 2024", { tanggal: true }).nilai).toBe("bulan Juli 2024");
  });
});
