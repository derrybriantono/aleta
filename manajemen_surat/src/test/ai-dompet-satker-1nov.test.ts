// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { hakSatker, sisaBatas, type AturanSatker } from "@/lib/aleta-ai/dompet-satker";
import type { PermintaanAi } from "@/lib/aleta-ai/penyusun";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_AI_SATKER } from "@/server/db/schema";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import {
  bacaAturanSatker,
  hapusAturanSatker,
  isiSaldoSatker,
  keadaanSatkerPengguna,
  pemakaianSatkerBulanIni,
  riwayatSatker,
  saldoSatker,
  selesaikanSatker,
  simpanAturanSatker,
  tahanSatker,
  verifikasiSatker,
} from "@/server/modules/aleta-ai/dompet-satker";
import { masukanDariBadan } from "@/server/modules/aleta-ai/fitur-blangko";
import { suntikKlienAi, type HasilAi, type KlienAi, type OpsiAlir } from "@/server/modules/aleta-ai/klien";
import { simpanKurs, tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { ringkasAi } from "@/server/modules/aleta-ai/layanan";
import { kirimPesan, perkirakanPesan, ulangiBatasLaju, type EventAi } from "@/server/modules/aleta-ai/mesin";
import { buatPercakapan } from "@/server/modules/aleta-ai/percakapan";
import { jalankanRekonsiliasi } from "@/server/modules/aleta-ai/rekonsiliasi";
import { unggahProyek } from "@/server/modules/aleta-ai/proyek";
import { saldoPengguna, terapkanMutasi, verifikasiSaldo } from "@/server/modules/aleta-ai/saldo";
import { susunZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * ALETA Ai - DOMPET SATKER (1 Nov 2026, migrasi 0124)
 * ============================================================================
 * Isi saldo oleh Super Admin (riwayat), aturan per peran/pengguna, batas bulanan, pemotongan dari dompet satker bila dipilih dan
 * berhak (dompet pengguna tidak berubah), saldo satker habis -> terkunci tetapi saldo pribadi tetap bisa. Klien AI tiruan.
 */

const ctx = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => ctx.db }));

const SQL = readFileSync(path.join(process.cwd(), "drizzle", "0124_aleta_ai_dompet_satker.sql"), "utf8");
const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const hakim: PelakuAi = { id: "usr-hakim", nama: "Hakim", peranId: "hakim", superAdmin: false };
const hakim2: PelakuAi = { id: "usr-hakim-2", nama: "Hakim Dua", peranId: "hakim", superAdmin: false };
const pp: PelakuAi = { id: "usr-pp", nama: "PP", peranId: "panitera-pengganti", superAdmin: false };
const superAdmin: PelakuAi = { id: "usr-super", nama: "Super", peranId: "super-admin", superAdmin: true };

describe("migrasi 0124 dan aturan murni", () => {
  it("berkas SQL = DDL_ALETA_AI_SATKER (tiga tabel, indeks), jurnal memuat 0124 di idx 108 sekali", () => {
    expect(pernyataan(SQL)).toEqual([...DDL_ALETA_AI_SATKER.tabel, ...DDL_ALETA_AI_SATKER.indeks].map((s) => pernyataan(s)[0]));
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(j.entries.filter((e) => e.tag.startsWith("0124_"))).toEqual([expect.objectContaining({ idx: 108, tag: "0124_aleta_ai_dompet_satker" })]);
    const sebelum = j.entries.filter((e) => e.idx < 108);
    expect(j.entries.find((e) => e.idx === 108)!.when).toBeGreaterThan(Math.max(...sebelum.map((e) => e.when)));
  });

  it("hakSatker: tanpa aturan = tidak boleh; aturan peran; peran tambahan; pengguna mengalahkan peran; batas terlonggar", () => {
    const aturan: AturanSatker[] = [
      { sasaran: "peran", sasaranId: "hakim", boleh: true, batasBulananRp: 50_000 },
      { sasaran: "peran", sasaranId: "kasir", boleh: true, batasBulananRp: 0 },
      { sasaran: "pengguna", sasaranId: "usr-hakim-2", boleh: false, batasBulananRp: 0 },
      { sasaran: "pengguna", sasaranId: "usr-pp", boleh: true, batasBulananRp: 10_000 },
    ];
    expect(hakSatker([], { id: "x", peranId: "hakim" })).toMatchObject({ boleh: false, sumber: "tidak-ada" });
    expect(hakSatker(aturan, { id: "usr-hakim", peranId: "hakim" })).toMatchObject({ boleh: true, batasBulananRp: 50_000, sumber: "peran" });
    // Peran tambahan kasir tanpa batas = paling longgar.
    expect(hakSatker(aturan, { id: "usr-hakim", peranId: "hakim", peranTambahan: ["kasir"] })).toMatchObject({ boleh: true, batasBulananRp: 0 });
    // Aturan pengguna mengalahkan aturan peran, ke dua arah.
    expect(hakSatker(aturan, { id: "usr-hakim-2", peranId: "hakim" })).toMatchObject({ boleh: false, sumber: "pengguna" });
    expect(hakSatker(aturan, { id: "usr-pp", peranId: "panitera-pengganti" })).toMatchObject({ boleh: true, batasBulananRp: 10_000, sumber: "pengguna" });
    expect(hakSatker(aturan, { id: "usr-lain", peranId: "jurusita" })).toMatchObject({ boleh: false });
    expect(sisaBatas(50_000, 20_000)).toBe(30_000);
    expect(sisaBatas(50_000, 90_000)).toBe(0);
    expect(sisaBatas(0, 90_000)).toBeNull();
  });
});

// ─── Basis data ──────────────────────────────────────────────────────────────

const MENU_MD = `# ALETA_05 — TRIGGER MENU LENGKAP
Modul rekaan untuk uji.

## KELOMPOK A — DRAFTING UTAMA
| Trigger | Output |
|---|---|
| Duduk Perkara | Ringkasan "Bahwa" rekaan |
`;
const zipRekaan = () =>
  susunZip([
    { nama: "ALETA_AI_PA_Edition_V4_5_Core_Prompt.md", isi: Buffer.from("# CORE PROMPT REKAAN\n" + "Kalimat pengisi core prompt. ".repeat(40), "utf8") },
    { nama: "ALETA_05_Trigger_Menu.md", isi: Buffer.from(MENU_MD, "utf8") },
  ]);

class KlienTiruan implements KlienAi {
  panggilan: PermintaanAi[] = [];
  async alirkan(p: PermintaanAi, opsi: OpsiAlir = {}): Promise<HasilAi> {
    this.panggilan.push(p);
    opsi.onTeks?.("Hasil rekaan.");
    return { teks: "Hasil rekaan.", berhenti: "selesai", model: p.model, penggunaan: { masuk: 1000, keluar: 500, cacheTulis: 0, cacheBaca: 0 }, iterasi: [], kategoriTolak: "", dialihkan: false };
  }
  async hitungToken(): Promise<number> {
    return 3000;
  }
}

async function kumpulkan(g: AsyncGenerator<EventAi, void, void>) {
  const h: EventAi[] = [];
  for await (const e of g) h.push(e);
  return h;
}

describe("dompet satker (pg-mem)", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
    ctx.db = db;
    await simpanKurs(db, { tanggal: tanggalLokal(), kurs: 16000, sumber: "uji" });
    await unggahProyek(db, superAdmin.id, { bita: zipRekaan(), namaBerkas: "proyek-rekaan.zip" });
  }, 180000);
  afterAll(async () => {
    suntikKlienAi(undefined);
    await db?.close();
  });
  afterEach(() => ulangiBatasLaju());

  const bahan = { perkara: "Nomor perkara: 1/Pdt.G/2026/PA.Dgl", naskah: "Naskah rekaan." };
  const satker = (p: PelakuAi, fitur = "D1") => masukanDariBadan({ fitur, bahan, dompet: "satker" });
  const pribadi = (fitur = "D1") => masukanDariBadan({ fitur, bahan });
  const siapkan = async (p: PelakuAi, klien: KlienTiruan, saldoPribadi = 0) => {
    suntikKlienAi(klien);
    if (saldoPribadi > 0) await terapkanMutasi(db, { penggunaId: p.id, jenis: "isi", jumlahRp: saldoPribadi, catatan: "uji" });
    return (await buatPercakapan(db, p.id)).id;
  };

  it("isi saldo oleh Super Admin: tercatat siapa/kapan/berapa, saldo = jumlah mutasi; jumlah tak wajar ditolak", async () => {
    expect(await saldoSatker(db)).toBe(0);
    await expect(isiSaldoSatker(db, superAdmin.id, { jumlahRp: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(isiSaldoSatker(db, superAdmin.id, { jumlahRp: -5 })).rejects.toMatchObject({ status: 400 });
    await expect(isiSaldoSatker(db, superAdmin.id, { jumlahRp: 5e10 })).rejects.toMatchObject({ status: 400 });
    expect(await isiSaldoSatker(db, superAdmin.id, { jumlahRp: 100_000, catatan: "Anggaran November" })).toEqual({ saldoRp: 100_000 });
    const r = await riwayatSatker(db);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ jenis: "isi", jumlahRp: 100_000, saldoSetelah: 100_000, olehId: superAdmin.id, catatan: "Anggaran November" });
    expect(Date.parse(r[0]!.waktu)).toBeGreaterThan(0);
    expect(await verifikasiSatker(db)).toEqual({ saldo: 100_000, jumlahMutasi: 100_000, seimbang: true });
    const jejak = await db.queryAll<{ aksi: string }>(`SELECT aksi FROM aleta_ai_jejak WHERE aksi = 'satker.isi'`);
    expect(jejak).toHaveLength(1);
  });

  it("aturan: simpan, ganti, hapus; sasaran dan batas divalidasi; perubahan tercatat di jejak", async () => {
    await expect(simpanAturanSatker(db, superAdmin.id, { sasaran: "kelompok", sasaranId: "x", boleh: true })).rejects.toMatchObject({ status: 400 });
    await expect(simpanAturanSatker(db, superAdmin.id, { sasaran: "peran", sasaranId: "", boleh: true })).rejects.toMatchObject({ status: 400 });
    await expect(simpanAturanSatker(db, superAdmin.id, { sasaran: "peran", sasaranId: "hakim", boleh: true, batasBulananRp: -1 })).rejects.toMatchObject({ status: 400 });
    await simpanAturanSatker(db, superAdmin.id, { sasaran: "peran", sasaranId: "hakim", boleh: true, batasBulananRp: 30_000 });
    let a = await simpanAturanSatker(db, superAdmin.id, { sasaran: "pengguna", sasaranId: hakim2.id, boleh: false });
    expect(a).toEqual([
      { sasaran: "pengguna", sasaranId: "usr-hakim-2", boleh: false, batasBulananRp: 0 },
      { sasaran: "peran", sasaranId: "hakim", boleh: true, batasBulananRp: 30_000 },
    ]);
    a = await simpanAturanSatker(db, superAdmin.id, { sasaran: "peran", sasaranId: "hakim", boleh: true, batasBulananRp: 40_000 });
    expect(a.find((x) => x.sasaranId === "hakim")!.batasBulananRp).toBe(40_000);
    expect(a).toHaveLength(2); // diganti, bukan ganda
    await simpanAturanSatker(db, superAdmin.id, { sasaran: "peran", sasaranId: "kasir", boleh: true });
    expect((await hapusAturanSatker(db, superAdmin.id, "peran", "kasir")).map((x) => x.sasaranId)).not.toContain("kasir");
    const jejak = await db.queryAll<{ aksi: string }>(`SELECT aksi FROM aleta_ai_jejak WHERE aksi = 'satker.aturan'`);
    expect(jejak.length).toBeGreaterThanOrEqual(5);
  });

  it("memotong dompet SATKER (bukan dompet pengguna) bila dipilih dan berhak; riwayat mencatat siapa memakai; buku seimbang", async () => {
    const klien = new KlienTiruan();
    const id = await siapkan(hakim, klien, 10_000);
    const sebelumSatker = await saldoSatker(db);
    const e = await kumpulkan(kirimPesan(db, hakim, id, satker(hakim)));
    expect(e.map((x) => x.jenis)).toEqual(["perkiraan", "teks", "selesai"]);
    const selesai = e[2] as Extract<EventAi, { jenis: "selesai" }>;
    expect(selesai.dompet).toBe("satker");
    expect(selesai.biayaRp).toBeGreaterThanOrEqual(1000);
    expect(selesai.saldoRp).toBe(sebelumSatker - selesai.biayaRp);
    // Dompet pengguna TIDAK berubah dan buku utuh.
    expect(await saldoPengguna(db, hakim.id)).toBe(10_000);
    expect((await verifikasiSaldo(db, hakim.id)).seimbang).toBe(true);
    expect(await saldoSatker(db)).toBe(selesai.saldoRp);
    expect(await verifikasiSatker(db)).toMatchObject({ seimbang: true });
    const potong = (await riwayatSatker(db)).filter((m) => m.jenis === "potong");
    expect(potong).toHaveLength(1);
    expect(potong[0]).toMatchObject({ penggunaId: hakim.id, peranId: "hakim", jumlahRp: -selesai.biayaRp });
    expect(await pemakaianSatkerBulanIni(db)).toEqual([{ penggunaId: hakim.id, peranId: "hakim", terpakaiRp: selesai.biayaRp }]);
    const k = await keadaanSatkerPengguna(db, hakim);
    expect(k).toMatchObject({ boleh: true, batasBulananRp: 40_000, terpakaiBulanIniRp: selesai.biayaRp, sisaBatasRp: 40_000 - selesai.biayaRp });
  });

  it("tanpa pilihan satker, dompet pengguna dipotong persis seperti sebelumnya dan dompet satker tidak tersentuh", async () => {
    const klien = new KlienTiruan();
    const id = await siapkan(hakim, klien, 0);
    const satkerSebelum = await saldoSatker(db);
    const pribadiSebelum = await saldoPengguna(db, hakim.id);
    const e = await kumpulkan(kirimPesan(db, hakim, id, pribadi()));
    const selesai = e[e.length - 1] as Extract<EventAi, { jenis: "selesai" }>;
    expect(selesai.dompet).toBeUndefined();
    expect(await saldoSatker(db)).toBe(satkerSebelum);
    expect(await saldoPengguna(db, hakim.id)).toBe(pribadiSebelum - selesai.biayaRp);
    expect((await verifikasiSaldo(db, hakim.id)).seimbang).toBe(true);
  });

  it("tanpa hak (aturan pengguna menolak / peran tanpa aturan): ditolak dengan kalimat biasa, layanan AI tidak dipanggil, saldo tak berubah", async () => {
    for (const p of [hakim2, pp]) {
      const klien = new KlienTiruan();
      const id = await siapkan(p, klien, 10_000);
      const sebelum = await saldoSatker(db);
      const e = await kumpulkan(kirimPesan(db, p, id, satker(p)));
      expect(e).toHaveLength(1);
      expect((e[0] as { pesan: string }).pesan).toBe("Anda belum diberi hak memakai saldo satker. Pakai saldo Anda sendiri atau hubungi Super Admin.");
      expect(klien.panggilan).toHaveLength(0);
      expect(await saldoSatker(db)).toBe(sebelum);
      expect(await saldoPengguna(db, p.id)).toBe(10_000);
    }
    // Perkiraan memberi alasan yang sama dan menandai dompet satker.
    const hasil = await perkirakanPesan(db, pp, "", satker(pp));
    expect(hasil).toMatchObject({ bolehJalan: false, dompet: "satker" });
    expect(hasil.alasan).toMatch(/belum diberi hak/);
  });

  it("perkiraan dompet satker: saldo yang ditampilkan = saldo satker, boleh jalan untuk yang berhak", async () => {
    const h = await perkirakanPesan(db, hakim, "", satker(hakim));
    expect(h).toMatchObject({ bolehJalan: true, dompet: "satker", saldoRp: await saldoSatker(db) });
    // Tanpa pilihan satker: bentuk lama (tanpa penanda dompet).
    const lama = await perkirakanPesan(db, hakim, "", pribadi());
    expect(lama.dompet).toBeUndefined();
  });

  it("batas bulanan per pengguna: sesudah tercapai ditolak (saldo pribadi tetap bisa); pengguna lain peran yang sama tidak terdampak", async () => {
    const hakimC: PelakuAi = { id: "usr-hakim-3", nama: "Hakim Tiga", peranId: "hakim", superAdmin: false };
    await simpanAturanSatker(db, superAdmin.id, { sasaran: "pengguna", sasaranId: hakimC.id, boleh: true, batasBulananRp: 0 });
    const taksiran = (await perkirakanPesan(db, hakimC, "", satker(hakimC))).perkiraanRp;
    // Batas = tepat satu perkiraan: giliran pertama muat, sisanya (batas dikurangi biaya nyata) tidak lagi cukup untuk perkiraan berikutnya.
    await simpanAturanSatker(db, superAdmin.id, { sasaran: "pengguna", sasaranId: hakimC.id, boleh: true, batasBulananRp: taksiran });
    const klien = new KlienTiruan();
    const id = await siapkan(hakimC, klien, 20_000);
    const pertama = await kumpulkan(kirimPesan(db, hakimC, id, satker(hakimC)));
    expect(pertama[pertama.length - 1]).toMatchObject({ jenis: "selesai", dompet: "satker" });
    const k = await keadaanSatkerPengguna(db, hakimC);
    expect(k.sisaBatasRp).toBeLessThan(taksiran);
    const kedua = await kumpulkan(kirimPesan(db, hakimC, id, satker(hakimC)));
    expect(kedua).toHaveLength(1);
    expect((kedua[0] as { pesan: string }).pesan).toBe("Batas pemakaian saldo satker Anda bulan ini sudah tercapai. Pakai saldo Anda sendiri atau hubungi Super Admin.");
    // Perkiraan pun menolak, dan saldo pribadi tetap dapat dipakai.
    expect(await perkirakanPesan(db, hakimC, "", satker(hakimC))).toMatchObject({ bolehJalan: false, dompet: "satker" });
    const pribadiJalan = await kumpulkan(kirimPesan(db, hakimC, id, pribadi()));
    expect(pribadiJalan[pribadiJalan.length - 1]).toMatchObject({ jenis: "selesai" });
    // Hakim lain (aturan peran, batas lebih besar) tidak terdampak batas hakimC.
    expect((await keadaanSatkerPengguna(db, hakim)).boleh).toBe(true);
  });

  it("saldo satker habis: pemakaian dari dompet satker terkunci (di mesin, perkiraan, dan ringkas), saldo pribadi tetap jalan; tahan tak cukup tidak mengubah apa pun", async () => {
    const klien = new KlienTiruan();
    const id = await siapkan(hakim, klien, 20_000);
    // Kosongkan dompet satker hingga di bawah minimum (oleh pemakai lain, supaya batas bulanan hakim tidak ikut terpakai).
    const sisa = await saldoSatker(db);
    expect(await tahanSatker(db, { id: "usr-pengosong", peranId: "jurusita" }, sisa + 1, "rujukan-tak-cukup")).toBe(false);
    expect(await saldoSatker(db)).toBe(sisa);
    expect(await tahanSatker(db, { id: "usr-pengosong", peranId: "jurusita" }, sisa - 500, "rujukan-kosongkan")).toBe(true);
    await selesaikanSatker(db, { id: "usr-pengosong", peranId: "jurusita" }, "rujukan-kosongkan", sisa - 500);
    expect(await saldoSatker(db)).toBe(500);
    // Idempoten per rujukan: menutup dua kali tidak memotong dua kali.
    expect(await selesaikanSatker(db, { id: "usr-pengosong", peranId: "jurusita" }, "rujukan-kosongkan", sisa - 500)).toMatchObject({ sudahDiproses: true, dipotongRp: 0 });

    const e = await kumpulkan(kirimPesan(db, hakim, id, satker(hakim)));
    expect(e).toHaveLength(1);
    expect((e[0] as { pesan: string }).pesan).toBe("Saldo satker habis. Pakai saldo Anda sendiri atau hubungi Super Admin untuk mengisinya.");
    expect(klien.panggilan).toHaveLength(0);
    expect(await perkirakanPesan(db, hakim, "", satker(hakim))).toMatchObject({ bolehJalan: false, dompet: "satker", saldoRp: 500 });
    const r = await ringkasAi(db, hakim);
    expect(r.satker).toMatchObject({ boleh: true, saldoRp: 500 });
    // Saldo pribadi tetap bisa.
    const pribadiJalan = await kumpulkan(kirimPesan(db, hakim, id, pribadi()));
    expect(pribadiJalan[pribadiJalan.length - 1]).toMatchObject({ jenis: "selesai" });
    expect(await verifikasiSatker(db)).toMatchObject({ seimbang: true });
    // Diisi lagi: terbuka kembali.
    await isiSaldoSatker(db, superAdmin.id, { jumlahRp: 50_000 });
    const lagi = await perkirakanPesan(db, hakim, "", satker(hakim));
    expect({ b: lagi.bolehJalan, a: lagi.alasan, d: lagi.dompet }).toEqual({ b: true, a: undefined, d: "satker" });
  });

  it("Super Admin tidak ditagih dari dompet mana pun (pilihan satker diabaikan)", async () => {
    const klien = new KlienTiruan();
    const id = await siapkan(superAdmin, klien, 0);
    const sebelum = await saldoSatker(db);
    const e = await kumpulkan(kirimPesan(db, superAdmin, id, satker(superAdmin)));
    expect(e[e.length - 1]).toMatchObject({ jenis: "selesai", biayaRp: 0 });
    expect(await saldoSatker(db)).toBe(sebelum);
  });

  it("ringkas memuat hak, saldo, batas dan pemakaian dompet satker menurut sudut pandang tiap pengguna", async () => {
    const a = (await ringkasAi(db, hakim)).satker;
    expect(a).toMatchObject({ boleh: true, batasBulananRp: 40_000 });
    expect(a.terpakaiBulanIniRp).toBeGreaterThan(0);
    expect((await ringkasAi(db, pp)).satker).toMatchObject({ boleh: false, sisaBatasRp: null });
    expect((await ringkasAi(db, hakim2)).satker.boleh).toBe(false);
  });

  it("rekonsiliasi harian tetap seimbang walau ada giliran yang dibebankan ke dompet satker", async () => {
    const h = await jalankanRekonsiliasi(db, { tanggal: tanggalLokal(), olehId: superAdmin.id });
    expect(h.status).toBe("seimbang");
    expect(h.jumlahSelisih).toBe(0);
  });
});
