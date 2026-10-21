import { readFileSync } from "node:fs";
import path from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { newDb } from "pg-mem";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { MejaPaniteraSidang, NamaHakimMenyidangkan, type KelilingHakim } from "@/components/portal/jadwal-keliling-hakim";
import { AletaEcourtCetakJadwal } from "@/components/portal/aleta-ecourt-cetak-jadwal";
import {
  adaPilihanHakim,
  anggotaMajelis,
  calonHakim,
  daftarPanitera,
  kelompokPerHakim,
  kunciTawarKeliling,
  luarGedung,
  majelisTampil,
  mayoritasLuarGedung,
  perkaraPanitera,
  perluTawarKeliling,
  type PilihanHakimSidang,
} from "@/lib/jadwal-keliling-hakim";
import { AKSI, bolehAksi } from "@/lib/matriks-peran";
import {
  barisLengkap,
  bawaanCentang,
  hasilDariJawaban,
  muatanMassal,
  ringkasHasilMassal,
  terapkanTanggalSemua,
  usulanBarisMassal,
} from "@/lib/tunda-putus-massal";
import type { UserPersona } from "@/lib/types";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_SIDANG_KELILING_HAKIM } from "@/server/db/schema";
import { bacaKonseptorSementara, simpanKonseptorSementara } from "@/server/modules/aleta-ecourt/konseptor-sementara";
import {
  bacaHakimSidang,
  bacaKelilingHari,
  batalHakimSidang,
  sidangKelilingAktif,
  simpanHakimSidang,
  simpanKelilingHari,
} from "@/server/modules/aleta-ecourt/sidang-keliling-hakim";

/**
 * ============================================================================
 * JADWAL SIDANG 22 OKT 2026 - SIDANG KELILING, HAKIM PER PERKARA, CETAK PER
 * HAKIM, TUNDA & KETERANGAN PUTUS MASSAL PER PANITERA SIDANG
 * ============================================================================
 *
 *   1. migrasi 0083: jurnal tanpa lubang, berkas = schema.ts, pg-mem, cadangan;
 *   2. hak: saklar keliling & pilih hakim menurut matriks, rute memasang pagarnya;
 *   3. pop-up mayoritas luar gedung - sekali per tanggal per pengguna;
 *   4. saklar keliling tersimpan per tanggal (bawaan mati), dibaca tunda otomatis;
 *   5. pilih hakim per perkara & per panitera sidang; konseptor sementara ikut
 *      terisi, tidak menimpa tunjukan orang / konseptor SIPP tanpa konfirmasi,
 *      dikembalikan saat dibatalkan;
 *   6. tampilan: nama hakim menggantikan nama majelis, kode tetap;
 *   7. cetak per hakim terdeteksi dan dipecah per halaman;
 *   8. massal per PP: bawaan centang, simpan sekali per perkara lewat rute lama,
 *      laporan gagal per perkara; tidak ada di layar antrean.
 */

const AKAR = path.resolve(__dirname, "..");
const baca = (rel: string) => readFileSync(path.join(AKAR, rel), "utf8");

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ─── 1. migrasi ─────────────────────────────────────────────────────────────

describe("migrasi 0083", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0083_aleta_sidang_keliling_hakim.sql");

  it("jurnal: 0083 sekali, sesudah 0081 (dan 0082 bila sudah digabung), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const idx = j.entries.map((e) => e.idx);
    expect(new Set(idx).size).toBe(idx.length);
    expect(idx).toEqual(idx.map((_, i) => i));
    const ini = j.entries.filter((e) => e.tag.startsWith("0083_"));
    expect(ini).toEqual([expect.objectContaining({ tag: "0083_aleta_sidang_keliling_hakim" })]);
    const sebelum = j.entries.find((e) => e.idx === ini[0].idx - 1)!;
    expect(["0081_aleta_mediasi_arsip", ...j.entries.filter((e) => e.tag.startsWith("0082_")).map((e) => e.tag)]).toContain(sebelum.tag);
    expect(ini[0].when).toBeGreaterThan(sebelum.when);
    expect(j.entries[j.entries.length - 1].tag.startsWith("0083_") || j.entries.some((e) => e.tag > "0083")).toBe(true);
  });

  it("pernyataan berkas = DDL_SIDANG_KELILING_HAKIM, jalan di pg-mem, kedua tabel ikut cadangan, tanpa kunci asing/CHECK", () => {
    const teks = readFileSync(SQL, "utf8");
    expect(pernyataan(teks)).toEqual([...DDL_SIDANG_KELILING_HAKIM.tabel, ...DDL_SIDANG_KELILING_HAKIM.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(teks);
    for (const t of ["aleta_sidang_keliling_hari", "aleta_hakim_sidang_perkara"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(teks.replace(/--.*$/gm, ""))).toBe(false);
  });
});

// ─── 2. hak ─────────────────────────────────────────────────────────────────

const orang = (id: string, roleId: string): UserPersona =>
  ({ id, name: id, username: id, roleId, positionId: "", additionalRoleIds: [], isActive: true }) as unknown as UserPersona;

describe("hak per peran", () => {
  it("Sidang keliling: Hakim, Ketua, Panitera, PP, Admin; bukan juru sita/kasir", () => {
    for (const r of ["hakim", "ketua", "panitera", "panitera-pengganti", "admin"]) expect(bolehAksi(orang(r, r), "sidang.keliling"), r).toBe(true);
    for (const r of ["jurusita", "analis-keuangan", "operator"]) expect(bolehAksi(orang(r, r), "sidang.keliling"), r).toBe(false);
  });

  it("Pilih hakim: Hakim, Ketua, PP, Admin; bukan juru sita/kasir", () => {
    for (const r of ["hakim", "ketua", "panitera-pengganti", "admin"]) expect(bolehAksi(orang(r, r), "sidang.pilih-hakim"), r).toBe(true);
    for (const r of ["jurusita", "analis-keuangan", "operator"]) expect(bolehAksi(orang(r, r), "sidang.pilih-hakim"), r).toBe(false);
  });

  it("rute menulis memasang pagar matriksnya; tunda/putus massal memakai rute lama (pagar sidang.tunda-putus)", () => {
    expect(baca("app/api/aleta-ecourt/sidang/keliling/route.ts")).toContain('pastikanAksi(db, actorUserId, "sidang.keliling")');
    const hakim = baca("app/api/aleta-ecourt/sidang/hakim-sidang/route.ts");
    expect(hakim.match(/pastikanAksi\(db, actorUserId, "sidang\.pilih-hakim"\)/g)?.length).toBe(2);
    expect(AKSI["sidang.keliling"].rute.join()).toContain("/api/aleta-ecourt/sidang/keliling");
    const massal = baca("components/portal/jadwal-keliling-hakim.tsx");
    expect(massal).toContain('"/api/aleta-ecourt/sidang-tunda"');
    expect(massal).toContain('"/api/aleta-ecourt/sidang-putus"');
  });

  it("tidak menulis ke SIPP dan tanpa kata ALETA pada tulisan SIPP: modul keliling/hakim hanya tabel ALETA", () => {
    const modul = baca("server/modules/aleta-ecourt/sidang-keliling-hakim.ts");
    const tabel = [...modul.matchAll(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+(\w+)/g)].map((m) => m[1]);
    expect(new Set(tabel)).toEqual(new Set(["aleta_sidang_keliling_hari", "aleta_hakim_sidang_perkara", "aleta_konseptor_sementara"]));
    expect(modul).not.toMatch(/gateway|sipp-bridge|postGateway/i);
  });
});

// ─── 3. pop-up mayoritas luar gedung ────────────────────────────────────────

describe("pop-up Sidang keliling", () => {
  const dalam = { ruangan: "Ruang Sidang 1" };
  const keliling = { ruangan: "Sidang Keliling Sirenja" };
  const terpadu = { ruangan: "Sidang diluar gedung Pengadilan (sidang terpadu)" };
  const bertanda = { ruangan: "Ruang Sidang 2", sidangKeliling: true };

  it("luar gedung = bendera SIPP, keliling, terpadu, luar gedung; nama tak dikenal = dalam gedung", () => {
    expect([dalam, keliling, terpadu, bertanda, { ruangan: "1" }, { ruangan: "" }].map(luarGedung)).toEqual([false, true, true, true, false, false]);
  });

  it("mayoritas = lebih dari separuh", () => {
    expect(mayoritasLuarGedung([keliling, terpadu, dalam])).toEqual({ mayoritas: true, luar: 2, jumlah: 3 });
    expect(mayoritasLuarGedung([keliling, dalam]).mayoritas).toBe(false);
    expect(mayoritasLuarGedung([]).mayoritas).toBe(false);
  });

  it("ditawarkan sekali per tanggal per pengguna; tidak bila sudah diputuskan, rentang, tak berhak, atau bukan mayoritas", () => {
    const dasar = { satuTanggal: true, sudahDiputuskan: false, bolehUbah: true, sudahDitawarkan: false, daftar: [keliling, terpadu, dalam] };
    expect(perluTawarKeliling(dasar)).toBe(true);
    expect(perluTawarKeliling({ ...dasar, sudahDitawarkan: true })).toBe(false);
    expect(perluTawarKeliling({ ...dasar, sudahDiputuskan: true })).toBe(false);
    expect(perluTawarKeliling({ ...dasar, satuTanggal: false })).toBe(false);
    expect(perluTawarKeliling({ ...dasar, bolehUbah: false })).toBe(false);
    expect(perluTawarKeliling({ ...dasar, daftar: [dalam, dalam, keliling] })).toBe(false);
    expect(kunciTawarKeliling("u1", "2026-10-22")).not.toBe(kunciTawarKeliling("u2", "2026-10-22"));
    expect(kunciTawarKeliling("u1", "2026-10-22")).not.toBe(kunciTawarKeliling("u1", "2026-10-23"));
  });

  it("layar: pop-up berkalimat ramah, jawaban dicatat per tanggal per pengguna, Aktifkan menyimpan nyala", () => {
    const layar = baca("components/portal/jadwal-keliling-hakim.tsx");
    expect(layar).toContain("Hari ini sebagian besar sidang di luar gedung.");
    expect(layar).toContain("Aktifkan Sidang keliling?");
    expect(layar).toMatch(/tulisSimpanan\(kunci\);[\s\S]{0,120}if \(aktifkan\) void ubah\(true\)/);
  });
});

// ─── 4-5. server: saklar keliling & hakim per perkara ───────────────────────

describe("server: saklar keliling dan hakim per perkara", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true });
  });

  it("saklar: bawaan mati & belum diputuskan; tersimpan per tanggal; dibaca tunda otomatis", async () => {
    expect(await bacaKelilingHari(db, "2026-10-22")).toMatchObject({ aktif: false, diputuskan: false });
    expect(await sidangKelilingAktif(db, "2026-10-22")).toBe(false);
    await simpanKelilingHari(db, { tanggal: "2026-10-22", aktif: true, olehId: "u1", olehNama: "Derry" });
    expect(await bacaKelilingHari(db, "2026-10-22")).toMatchObject({ aktif: true, diputuskan: true, diubahNama: "Derry" });
    expect(await sidangKelilingAktif(db, "2026-10-22")).toBe(true);
    expect(await sidangKelilingAktif(db, "2026-10-23")).toBe(false);
    await simpanKelilingHari(db, { tanggal: "2026-10-22", aktif: false, olehId: "u1", olehNama: "Derry" });
    expect(await bacaKelilingHari(db, "2026-10-22")).toMatchObject({ aktif: false, diputuskan: true });
    expect(await sidangKelilingAktif(db, "bukan tanggal")).toBe(false);
    await expect(simpanKelilingHari(db, { tanggal: "2026-10-22", aktif: "ya", olehId: "", olehNama: "" })).rejects.toThrow(/nyala atau mati/);
  });

  const isian = (perkaraId: string, hakimNama: string, tambahan: Record<string, unknown> = {}) => ({
    perkaraId,
    nomorPerkara: `${perkaraId}/Pdt.G/2026/PA.Dgl`,
    sidangId: `s${perkaraId}`,
    hakimId: "7",
    hakimNama,
    hakimKode: "H7",
    anggotaMajelis: false,
    paniteraNama: "Sri Susilowati, S.H.",
    ...tambahan,
  });

  it("per perkara: hakim tersimpan untuk tanggal itu saja; konseptor sementara kosong ikut diisi", async () => {
    const h = await simpanHakimSidang(db, { tanggal: "2026-10-22", pilihan: [isian("101", "Derry Briantono, S.H.")], olehId: "u1", olehNama: "Derry" });
    expect(h).toEqual([expect.objectContaining({ perkaraId: "101", ok: true, konseptor: "diisi" })]);
    expect((await bacaHakimSidang(db, "2026-10-22"))["101"]).toMatchObject({ hakimNama: "Derry Briantono, S.H.", konseptorDiisi: true });
    expect(await bacaHakimSidang(db, "2026-10-23")).toEqual({});
    expect((await bacaKonseptorSementara(db, ["101"]))["101"].nama).toBe("Derry Briantono, S.H.");
  });

  it("per panitera sidang: banyak perkara sekali simpan; tunjukan konseptor orang TIDAK ditimpa tanpa konfirmasi", async () => {
    await simpanKonseptorSementara(db, { perkaraId: "202", nomorPerkara: "202/Pdt.G/2026/PA.Dgl", nama: "Himawan Tatura Wijaya", oleh: "Ketua" });
    const h = await simpanHakimSidang(db, {
      tanggal: "2026-10-22",
      pilihan: [isian("201", "Derry Briantono, S.H."), isian("202", "Derry Briantono, S.H."), isian("203", "Derry Briantono, S.H.")],
      olehId: "u2",
      olehNama: "PP",
      konseptorSipp: { "203": ["Hakim Lain, S.H.I."] },
    });
    expect(h.map((x) => [x.perkaraId, x.ok, x.konseptor])).toEqual([
      ["201", true, "diisi"],
      ["202", true, "perlu-konfirmasi"],
      ["203", true, "perlu-konfirmasi"],
    ]);
    expect(h[1].konseptorLama).toBe("Himawan Tatura Wijaya");
    const k = await bacaKonseptorSementara(db, ["202", "203"]);
    expect(k["202"].nama).toBe("Himawan Tatura Wijaya");
    expect(k["203"]).toBeUndefined();
    expect(Object.keys(await bacaHakimSidang(db, "2026-10-22")).sort()).toEqual(["101", "201", "202", "203"]);
  });

  it("dengan konfirmasi ditimpa; dibatalkan = kembali ke majelis DAN konseptor kembali ke tunjukan semula", async () => {
    const h = await simpanHakimSidang(db, { tanggal: "2026-10-22", pilihan: [isian("202", "Derry Briantono, S.H.")], olehId: "u2", olehNama: "PP", timpaKonseptor: true });
    expect(h[0].konseptor).toBe("diisi");
    expect((await bacaKonseptorSementara(db, ["202"]))["202"].nama).toBe("Derry Briantono, S.H.");
    // Memilih ulang hakim lain tidak menjadikan isian otomatis sebagai "asli".
    await simpanHakimSidang(db, { tanggal: "2026-10-22", pilihan: [isian("202", "Hakim Ketiga")], olehId: "u2", olehNama: "PP" });
    const b = await batalHakimSidang(db, { tanggal: "2026-10-22", perkaraIds: ["202", "101"] });
    expect(b.map((x) => x.konseptor)).toEqual(["dikembalikan", "dikembalikan"]);
    const k = await bacaKonseptorSementara(db, ["202", "101"]);
    expect(k["202"]).toMatchObject({ nama: "Himawan Tatura Wijaya", ditetapkanOleh: "Ketua" });
    expect(k["101"]).toBeUndefined();
    expect((await bacaHakimSidang(db, "2026-10-22"))["202"]).toBeUndefined();
  });

  it("konseptor yang diganti orang sesudah hakim dipilih dibiarkan saat dibatalkan", async () => {
    await simpanKonseptorSementara(db, { perkaraId: "201", nomorPerkara: "201", nama: "Konseptor Pilihan Ketua", oleh: "Ketua" });
    const b = await batalHakimSidang(db, { tanggal: "2026-10-22", perkaraIds: ["201"] });
    expect(b[0]).toMatchObject({ konseptor: "dibiarkan" });
    expect((await bacaKonseptorSementara(db, ["201"]))["201"].nama).toBe("Konseptor Pilihan Ketua");
  });
});

// ─── 5-6. calon hakim & tampilan ─────────────────────────────────────────────

const HAKIM = [
  { id: 1, kode: "A", nama: "Himawan Tatura Wijaya, S.H.I., M.H." },
  { id: 2, kode: "B", nama: "Derry Briantono, S.H." },
  { id: 3, kode: "C", nama: "Zainal Abidin, Lc." },
];

describe("calon hakim & tampilan", () => {
  const majelis = "Himawan Tatura Wijaya, S.H.I.,M.H., Zainal Abidin, Lc.";

  it("anggota majelis dikenali walau gelar berkoma", () => {
    expect(anggotaMajelis(majelis, HAKIM[0].nama)).toBe(true);
    expect(anggotaMajelis(majelis, HAKIM[2].nama)).toBe(true);
    expect(anggotaMajelis(majelis, HAKIM[1].nama)).toBe(false);
  });

  it("SEMUA hakim aktif ditawarkan; majelis perkara itu di atas sebagai saran", () => {
    const c = calonHakim(majelis, HAKIM);
    expect(c.map((h) => [h.nama, h.saran])).toEqual([
      [HAKIM[0].nama, true],
      [HAKIM[2].nama, true],
      [HAKIM[1].nama, false],
    ]);
  });

  it("nama majelis diganti hakim yang menyidangkan, KODE tetap; tanpa pilihan tetap majelis", () => {
    const baris = { perkaraId: "9", majelisKode: "C1-C2-C3", majelisNama: majelis };
    const pilihan: Record<string, PilihanHakimSidang> = { "9": { perkaraId: "9", hakimId: "2", hakimNama: HAKIM[1].nama, hakimKode: "B", anggotaMajelis: false } };
    expect(majelisTampil(baris, pilihan)).toEqual({ kode: "C1-C2-C3", nama: HAKIM[1].nama, diganti: true, asli: majelis });
    expect(majelisTampil(baris, {})).toMatchObject({ kode: "C1-C2-C3", nama: majelis, diganti: false });
    render(createElement(NamaHakimMenyidangkan, { baris, pilihan }));
    expect(screen.getByText(HAKIM[1].nama)).toBeTruthy();
    cleanup();
  });

  it("layar jadwal: kode majelis tetap digambar, nama lewat majelisTampil, pemilih hanya satu tanggal & bukan tampilan alamat", () => {
    const layar = baca("components/portal/aleta-ecourt-sidang.tsx");
    expect(layar).toContain("{baris.majelisKode || \"—\"}");
    expect(layar).toContain("majelisTampil(baris, kh.pilihan).diganti ? (");
    expect(layar).toContain("{!modeUrl && satuTanggalJadwal ? <PemilihHakimBaris baris={baris} kh={kh} /> : null}");
  });
});

// ─── 7. cetak per hakim ─────────────────────────────────────────────────────

describe("cetak per hakim", () => {
  const baris = (perkaraId: string, nomor: string) => ({
    sidangId: `s${perkaraId}`,
    perkaraId,
    nomorPerkara: nomor,
    jenisPerkara: "Cerai Gugat",
    jamSidang: "09:00",
    tanggalSidang: "2026-10-22",
    agenda: "Jawaban",
    ruangan: "Sidang Keliling",
    ditunda: false,
    majelisKode: "C1",
    majelisNama: "Majelis",
    paniteraNama: "PP Satu",
    jurusitaNama: "JS",
    pihak: { penggugat: ["P"], tergugat: ["T"] },
  });
  const daftar = [baris("1", "1/Pdt.G"), baris("2", "2/Pdt.G"), baris("3", "3/Pdt.G")];
  const pilihan: Record<string, PilihanHakimSidang> = {
    "1": { perkaraId: "1", hakimId: "2", hakimNama: "Derry", hakimKode: "B", anggotaMajelis: true },
    "3": { perkaraId: "3", hakimId: "1", hakimNama: "Ahmad", hakimKode: "A", anggotaMajelis: false },
  };

  it("terdeteksi bila ada pilihan; bagian per hakim + sisa majelis di akhir", () => {
    expect(adaPilihanHakim(daftar, pilihan)).toBe(true);
    expect(adaPilihanHakim(daftar, {})).toBe(false);
    expect(kelompokPerHakim(daftar, pilihan).map((b) => [b.hakim, b.baris.map((x) => x.perkaraId)])).toEqual([
      ["Ahmad", ["3"]],
      ["Derry", ["1"]],
      ["", ["2"]],
    ]);
  });

  it("lembar: tiap hakim bagian & halaman sendiri berjudul nama hakim", () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const selesai = vi.fn();
    render(
      createElement(AletaEcourtCetakJadwal, {
        sidang: daftar,
        dari: "2026-10-22",
        sampai: "2026-10-22",
        namaPengadilan: "PENGADILAN AGAMA DONGGALA",
        bagianHakim: kelompokPerHakim(daftar, pilihan),
        onSelesai: selesai,
      })
    );
    const bagian = document.querySelectorAll("[data-bagian-hakim]");
    expect(bagian.length).toBe(3);
    expect((bagian[1] as HTMLElement).style.pageBreakBefore).toBe("always");
    expect([...document.querySelectorAll("[data-cetak-hakim]")].map((x) => x.textContent)).toEqual([
      "Hakim: Ahmad",
      "Hakim: Derry",
      "Majelis (belum dipilih satu hakim)",
    ]);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
    vi.useRealTimers();
    cleanup();
  });

  it("tombol Cetak menawarkan per hakim / gabungan bila ada pilihan", () => {
    const layar = baca("components/portal/aleta-ecourt-sidang.tsx");
    expect(layar).toContain("if (adaPilihanHakim(sidangTampil, kh.pilihan)) setPilihCetak((b) => !b);");
    expect(layar).toMatch(/bagianHakim=\{\s*cetakPerHakim\s*\?\s*kelompokPerHakim\(/);
  });
});

// ─── 8. tunda & keterangan putus massal per PP ───────────────────────────────

describe("massal per panitera sidang: aturan", () => {
  const daftar = [
    { sidangId: "1", paniteraNama: "PP A", sidangIkrarTalak: false },
    { sidangId: "2", paniteraNama: "PP A", sidangIkrarTalak: true },
    { sidangId: "3", paniteraNama: "PP B", sidangIkrarTalak: false },
    { sidangId: "4", paniteraNama: "PP A", sidangIkrarTalak: false },
  ];

  it("panitera sidang hari itu + perkaranya", () => {
    expect(daftarPanitera(daftar)).toEqual([
      { nama: "PP A", jumlah: 3 },
      { nama: "PP B", jumlah: 1 },
    ]);
    expect(perkaraPanitera(daftar, "PP A").map((b) => b.sidangId)).toEqual(["1", "2", "4"]);
  });

  it("bawaan centang = yang belum diberi hasil; putus tidak mencentang sidang ikrar", () => {
    const sudah = (b: { sidangId: string }) => b.sidangId === "4";
    expect([...bawaanCentang(perkaraPanitera(daftar, "PP A"), sudah, "tunda")]).toEqual(["1", "2"]);
    expect([...bawaanCentang(perkaraPanitera(daftar, "PP A"), sudah, "putus")]).toEqual(["1"]);
  });

  it("lengkap: tunda butuh alasan/tanggal/jam/agenda & tanpa peringatan ikrar; putus butuh status, ikrar dilempar ke baris", () => {
    const isi = { alasan: "Tergugat tidak hadir", agenda: "Jawaban", tanggal: "2026-11-05", jam: "09:00", dihadiri: 2, statusId: "", verstek: false };
    expect(barisLengkap("tunda", isi).lengkap).toBe(true);
    expect(barisLengkap("tunda", { ...isi, alasan: " " }).sebab).toMatch(/Alasan/);
    expect(barisLengkap("tunda", { ...isi, peringatan: "Tenggat 6 bulan" }).lengkap).toBe(false);
    expect(barisLengkap("putus", isi).sebab).toMatch(/Status/);
    expect(barisLengkap("putus", { ...isi, statusId: "62" }).lengkap).toBe(true);
    expect(barisLengkap("putus", { ...isi, statusId: "62", ikrar: true }).lengkap).toBe(false);
  });

  it("muatan = bentuk menu ringkas (kering false, tanggal putus = tanggal sidang)", () => {
    const keadaan = { jadwalId: 11, perkaraId: 5, nomorPerkara: "5/Pdt.G", tanggalSidang: "2026-10-22", jamSidang: "09:00", agenda: "Jawaban", ruanganId: 3 };
    const isi = { alasan: "a", agenda: "Replik", tanggal: "2026-11-05", jam: "09:00", dihadiri: 1, statusId: "62", verstek: true };
    expect(muatanMassal("tunda", keadaan, isi, { ruanganIdBerikut: 3, sidangKelilingBerikut: true })).toEqual({
      jadwalId: 11,
      perkaraId: 5,
      alasanTunda: "a",
      tanggalBerikut: "2026-11-05",
      jamBerikut: "09:00",
      jamSekarang: "09:00",
      agendaBerikut: "Replik",
      dihadiriOleh: 1,
      ruangId: 3,
      ruanganIdBerikut: 3,
      sidangKelilingBerikut: true,
      kering: false,
    });
    expect(muatanMassal("putus", keadaan, isi, {})).toMatchObject({ jalur: "sidang", statusPutusanId: 62, tanggalPutus: "2026-10-22", verstek: "Y", kering: false });
  });

  it("usulan per baris: bot lama tanpa riwayat = dua pekan; sidang ikrar = bawaan ikrar", () => {
    const u = usulanBarisMassal({ keadaan: { jadwalId: 1, perkaraId: 1, nomorPerkara: "1/Pdt.G/2026", tanggalSidang: "2026-10-22", agenda: "Jawaban" } }, () => "Replik");
    expect(u).toMatchObject({ ikrar: false, agenda: "Replik", tanggalPutus: "2026-10-22" });
    expect(u.tanggal >= "2026-11-05").toBe(true);
    const ikrar = usulanBarisMassal({ keadaan: { jadwalId: 2, perkaraId: 2, nomorPerkara: "2/Pdt.G/2026", tanggalSidang: "2026-10-22", agenda: "SIDANG IKRAR TALAK", ikrarTalak: "Y", dihadiriOleh: 4 } });
    expect(ikrar).toMatchObject({ ikrar: true, agenda: "SIDANG IKRAR TALAK" });
    expect(ikrar.alasan).toMatch(/tidak hadir/i);
  });

  it("satu tanggal untuk semua hanya baris tercentang; laporan per perkara; tertutup sendiri hanya bila semua tersimpan", () => {
    const s = terapkanTanggalSemua({ a: { tanggal: "x" }, b: { tanggal: "y" } }, new Set(["a"]), "2026-11-12");
    expect(s).toEqual({ a: { tanggal: "2026-11-12" }, b: { tanggal: "y" } });
    const h = [hasilDariJawaban("1", "1/Pdt.G", { ok: true }), hasilDariJawaban("2", "2/Pdt.G", { ok: false, alasan: "PP perkara tidak tercatat" })];
    expect(h[1]).toEqual({ sidangId: "2", nomorPerkara: "2/Pdt.G", keadaan: "gagal", sebab: "PP perkara tidak tercatat" });
    expect(ringkasHasilMassal(h)).toMatchObject({ berhasil: 1, gagal: 1, semuaBerhasil: false, kalimat: "1 tersimpan · 1 gagal" });
    expect(ringkasHasilMassal([h[0]]).semuaBerhasil).toBe(true);
    expect(ringkasHasilMassal([hasilDariJawaban("3", "3", { ok: true, diantrekan: true })]).semuaBerhasil).toBe(false);
  });

  it("tidak digabung dengan layar antrean", () => {
    const layar = baca("components/portal/aleta-ecourt-sidang.tsx");
    const awal = layar.indexOf("function MenuLayarAntrian()");
    const menu = layar.slice(awal, layar.indexOf("\nfunction ", awal + 10));
    expect(menu).not.toMatch(/MejaPaniteraSidang|Per panitera sidang|PemilihHakimBaris/);
    for (const f of ["app/antrian-layar/page.tsx", "app/antrian-tampil", "app/antrian-ruang", "app/antrian"]) {
      const p = path.join(AKAR, f);
      const isi = f.endsWith(".tsx") ? readFileSync(p, "utf8") : "";
      expect(isi).not.toContain("jadwal-keliling-hakim");
    }
  });
});

// ─── 8b. meja panitera sidang - dirender ─────────────────────────────────────

type Panggilan = { url: string; method: string; body: Record<string, unknown> | null };

function pasangFetch(jawabPost: (body: Record<string, unknown>) => Record<string, unknown>) {
  const panggilan: Panggilan[] = [];
  const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    panggilan.push({ url, method, body });
    const json = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/sidang-tunda?jadwalId=")) {
      const id = Number(new URL(url, "http://x").searchParams.get("jadwalId"));
      return json({
        ok: true,
        keadaan: { jadwalId: id, perkaraId: id * 10, nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`, tanggalSidang: "2026-10-22", jamSidang: "09:00", agenda: "Jawaban", ruanganId: 1, ditunda: "T" },
        riwayat: null,
        ruangan: [],
        antrian: null,
        kehadiranRinci: null,
      });
    }
    if (url.includes("/sidang-putus") && method === "GET") return json({ ok: true, daftar: [{ id: 62, nama: "Dikabulkan" }, { id: 63, nama: "Ditolak" }] });
    if (method === "POST") return json(jawabPost(body ?? {}));
    return json({});
  });
  vi.stubGlobal("fetch", f);
  return panggilan;
}

const BARIS_MEJA = [1, 2, 3].map((n) => ({
  sidangId: String(n),
  perkaraId: String(n * 10),
  nomorPerkara: `${n}/Pdt.G/2026/PA.Dgl`,
  tanggalSidang: "2026-10-22",
  jamSidang: "09:00",
  agenda: "Jawaban",
  ruangan: "Sidang Keliling",
  majelisKode: "C1",
  majelisNama: "Himawan Tatura Wijaya, S.H.I.,M.H.",
  paniteraNama: n === 3 ? "PP Lain" : "Sri Susilowati, S.H.",
}));

function khUji(tambahan: Partial<KelilingHakim> = {}): KelilingHakim {
  return {
    tanggal: "2026-10-22",
    keliling: { tanggal: "2026-10-22", aktif: true, diputuskan: true, diubahNama: "", diubahPada: "" },
    bolehKeliling: true,
    pilihan: {},
    calon: HAKIM,
    alasanCalon: "",
    bolehHakim: true,
    galat: "",
    muatUlang: vi.fn(),
    ubahKeliling: vi.fn(),
    simpanHakim: vi.fn(async (isi: Array<{ perkaraId: string; nomorPerkara: string }>) =>
      isi.map((x) => ({ perkaraId: x.perkaraId, nomorPerkara: x.nomorPerkara, ok: true, sebab: "", konseptor: "diisi" as const }))
    ),
    batalHakim: vi.fn(async () => []),
    ...tambahan,
  } as unknown as KelilingHakim;
}

describe("meja panitera sidang (dirender)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const sudahHasil = (b: { sidangId: string }) => b.sidangId === "2";

  it("per panitera sidang: semua perkara PP itu langsung terpilih, satu hakim disimpan untuk semuanya", async () => {
    pasangFetch(() => ({ ok: true }));
    const kh = khUji();
    render(createElement(MejaPaniteraSidang, { daftar: BARIS_MEJA, kh, sudahHasil, bolehTundaPutus: true, onSelesai: vi.fn(), onTutup: vi.fn() }));
    fireEvent.click(screen.getByRole("radio", { name: /Sri Susilowati/ }));
    expect(screen.getByText(/dari 2 perkara dipilih/).textContent).toMatch(/^2 dari 2/);
    fireEvent.click(screen.getByText("Pilih hakimnya"));
    // Majelis di atas (saran), hakim lain tetap ditawarkan.
    expect(screen.getByText("Majelis perkara ini")).toBeTruthy();
    fireEvent.click(screen.getByText("Derry Briantono, S.H."));
    await act(async () => {
      fireEvent.click(screen.getByText("Simpan hakim"));
    });
    expect(kh.simpanHakim).toHaveBeenCalledTimes(1);
    const isi = (kh.simpanHakim as unknown as { mock: { calls: Array<[Array<{ perkaraId: string; hakimNama: string; anggotaMajelis: boolean }>]> } }).mock.calls[0][0];
    expect(isi.map((x) => [x.perkaraId, x.hakimNama, x.anggotaMajelis])).toEqual([
      ["10", "Derry Briantono, S.H.", false],
      ["20", "Derry Briantono, S.H.", false],
    ]);
  });

  it("tunda massal: bawaan yang belum diberi hasil, SEKALI POST per perkara ke rute tunda lama, laporan gagal per perkara", async () => {
    const panggilan = pasangFetch((b) => (b.jadwalId === 1 ? { ok: true } : { ok: false, alasan: "PP perkara tidak tercatat" }));
    const daftar = [...BARIS_MEJA.slice(0, 2), { ...BARIS_MEJA[0], sidangId: "4", perkaraId: "40", nomorPerkara: "4/Pdt.G/2026/PA.Dgl" }];
    render(createElement(MejaPaniteraSidang, { daftar, kh: khUji(), sudahHasil, bolehTundaPutus: true, paniteraAwal: "Sri Susilowati, S.H.", onSelesai: vi.fn(), onTutup: vi.fn() }));
    fireEvent.click(screen.getByRole("tab", { name: /Tunda massal/ }));
    await waitFor(() => expect(screen.getAllByLabelText(/^Alasan tunda /).length).toBe(3));
    // Sidang 2 sudah diberi hasil: tidak tercentang.
    expect((screen.getByLabelText("Pilih 2/Pdt.G/2026/PA.Dgl") as HTMLInputElement).checked).toBe(false);
    for (const n of [1, 4]) fireEvent.change(screen.getByLabelText(`Alasan tunda ${n}/Pdt.G/2026/PA.Dgl`), { target: { value: "Tergugat tidak hadir" } });
    // Mesin dua kali ditekan: tetap sekali per perkara.
    await act(async () => {
      fireEvent.click(screen.getByText(/^Tunda 2 perkara$/));
      fireEvent.click(screen.getByText(/^(Tunda 2 perkara|Menyimpan…)$/));
    });
    await waitFor(() => expect(document.querySelector("[data-laporan-meja]")).toBeTruthy());
    const post = panggilan.filter((p) => p.method === "POST");
    expect(post.map((p) => [p.url.replace(/^.*\/api/, "/api"), p.body?.jadwalId, p.body?.kering])).toEqual([
      ["/api/aleta-ecourt/sidang-tunda", 1, false],
      ["/api/aleta-ecourt/sidang-tunda", 4, false],
    ]);
    const laporan = document.querySelector("[data-laporan-meja]")!.textContent ?? "";
    expect(laporan).toContain("1 tersimpan · 1 gagal");
    expect(laporan).toContain("4/Pdt.G/2026/PA.Dgl - gagal: PP perkara tidak tercatat");
  });

  it("keterangan putus massal: status bawaan Dikabulkan, POST ke rute putus lama, tertutup sendiri bila semua tersimpan", async () => {
    const panggilan = pasangFetch(() => ({ ok: true }));
    const tutup = vi.fn();
    render(createElement(MejaPaniteraSidang, { daftar: BARIS_MEJA, kh: khUji({ bolehHakim: false } as Partial<KelilingHakim>), sudahHasil, bolehTundaPutus: true, paniteraAwal: "Sri Susilowati, S.H.", onSelesai: vi.fn(), onTutup: tutup }));
    expect(screen.queryByRole("tab", { name: /Pilih hakim/ })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Keterangan putus massal/ }));
    await waitFor(() => expect(screen.getAllByLabelText(/^Status putusan /).length).toBe(2));
    await waitFor(() => expect((screen.getByLabelText("Status putusan 1/Pdt.G/2026/PA.Dgl") as HTMLSelectElement).value).toBe("62"));
    await act(async () => {
      fireEvent.click(screen.getByText(/^Simpan keterangan putus \(1\)$/));
    });
    await waitFor(() => expect(document.querySelector("[data-laporan-meja]")).toBeTruthy());
    const post = panggilan.filter((p) => p.method === "POST");
    expect(post).toHaveLength(1);
    expect(post[0].url).toContain("/api/aleta-ecourt/sidang-putus");
    expect(post[0].body).toMatchObject({ jalur: "sidang", jadwalId: 1, statusPutusanId: 62, tanggalPutus: "2026-10-22", verstek: "T", kering: false });
    await waitFor(() => expect(tutup).toHaveBeenCalled(), { timeout: 4000 });
  });
});
