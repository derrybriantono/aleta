// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { alamatEvidenRekap, perkaraDitangani, susunDokumenRekapEviden, susunPaketEvidenRekap, type MasukanEvidenRekap } from "@/lib/eviden-skp-rekap";
import { namaDariDisposition, susunPeriodeSkpJabatan } from "@/lib/eviden-skp-unduh";
import type { BarisRekap, RekapPetugas } from "@/lib/rekap-petugas";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { simpanAksesEkstensi } from "@/server/modules/aleta-ecourt/akses";

import { bacaPdfUji, bacaZip } from "./eviden-skp-baca";

/**
 * ============================================================================
 * EVIDEN SKP DARI REKAP PETUGAS (PP, Juru Sita, Mediator) - 27 Okt 2026
 * ============================================================================
 *
 * Susunan dokumen dari baris rekap (angka dihitung dari tanggal yang ada, tidak
 * dikarang), rute daftar/unduh dengan hak "panel" (sama dengan tombol hakim),
 * dan berkas PDF/Excel/Word/ZIP yang dihasilkan. Nama pihak sungguhan tidak
 * dipakai: semua nama di bawah rekaan.
 */

const kejadian = vi.hoisted(() => ({ rekap: vi.fn() }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return { ...modul, getGatewayRekapPetugas: kejadian.rekap };
});

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

function baris(p: Partial<BarisRekap> & { perkaraId: string; nomorPerkara: string }): BarisRekap {
  return {
    tanggalDaftar: "2026-01-10",
    tahun: 2026,
    jenisPerkara: "Cerai Gugat",
    kedudukan: ["Panitera Pengganti"],
    keadaan: "proses",
    tanggalPutusan: "",
    tanggalBht: "",
    statusPutusan: "",
    verstek: null,
    ecourt: null,
    banding: null,
    hariMediasi: 0,
    lamaHari: null,
    umurHari: null,
    ...p,
  };
}

// Triwulan II 2026 = 2026-04-01 s.d. 2026-06-30.
const BARIS: BarisRekap[] = [
  // Masuk sebelum periode, putus dalam periode, 100 hari (tepat waktu).
  baris({ perkaraId: "1", nomorPerkara: "1/Pdt.G/2026/PA.Uji", tanggalDaftar: "2026-02-01", tanggalPutusan: "2026-05-12", keadaan: "putus", statusPutusan: "Dikabulkan", lamaHari: 100 }),
  // Masuk dan putus dalam periode, 200 hari (lewat batas 150).
  baris({ perkaraId: "2", nomorPerkara: "2/Pdt.G/2026/PA.Uji", tanggalDaftar: "2026-04-05", tanggalPutusan: "2026-06-20", keadaan: "putus", statusPutusan: "Ditolak", lamaHari: 200 }),
  // Masih proses pada akhir periode.
  baris({ perkaraId: "3", nomorPerkara: "3/Pdt.G/2026/PA.Uji", tanggalDaftar: "2026-06-01" }),
  // Sudah putus sebelum periode: tidak ikut.
  baris({ perkaraId: "4", nomorPerkara: "4/Pdt.G/2026/PA.Uji", tanggalDaftar: "2026-01-02", tanggalPutusan: "2026-03-30", keadaan: "putus", lamaHari: 87 }),
  // Didaftarkan sesudah periode: tidak ikut.
  baris({ perkaraId: "5", nomorPerkara: "5/Pdt.G/2026/PA.Uji", tanggalDaftar: "2026-07-02" }),
];

function masukan(sebagian: Partial<MasukanEvidenRekap> = {}): MasukanEvidenRekap {
  return {
    peran: "panitera",
    orang: { id: "18", nama: "Panitera Pengganti Uji, S.H." },
    periode: susunPeriodeSkpJabatan("tw2", 2026),
    baris: BARIS,
    ambangHari: 150,
    ketua: { nama: "Ketua Uji", nip: "198001012005011001", jabatan: "Ketua", sumber: "uji" },
    dihitungPada: "2026-10-27T01:00:00.000Z",
    galat: [],
    ...sebagian,
  };
}

describe("susunan dokumen dari rekap", () => {
  it("perkara ditangani = masuk sebelum akhir periode dan belum selesai sebelum awal periode", () => {
    const hasil = perkaraDitangani(BARIS, "panitera", "2026-04-01", "2026-06-30");
    expect(hasil.map((x) => x.b.perkaraId)).toEqual(["1", "2", "3"]);
  });

  it("angka indikator dihitung dari baris, bukan dikarang", () => {
    const d = susunDokumenRekapEviden(masukan());
    const kuantitas = d.indikator.filter((i) => i.aspek === "Kuantitas").map((i) => i.realisasi);
    expect(kuantitas).toEqual(["3 Perkara", "2 Perkara"]);
    expect(d.indikator.find((i) => i.aspek === "Kualitas")).toMatchObject({ realisasi: "50%" });
    // rata-rata (100 + 200) / 2 hari
    expect(d.indikator.find((i) => i.aspek === "Waktu")?.realisasi).toBe("150 Hari");
    expect(d.tabel.baris).toHaveLength(3);
    expect(d.tabel.baris[2]).toMatchObject({ keadaan: "Dalam proses", selesai: "-", lama: "-" });
    expect(d.tabel.baris[0]).toMatchObject({ keadaan: "Putus - Dikabulkan", selesai: "12/05/2026", lama: "100" });
    expect(d.judulLengkap).toBe("Rekap Perkara Ditangani Panitera Pengganti Triwulan II Tahun 2026");
  });

  it("tanpa perkara selesai: waktu dan kualitas tertulis tanda hubung, bukan nol", () => {
    const d = susunDokumenRekapEviden(masukan({ baris: [BARIS[2]] }));
    expect(d.indikator.find((i) => i.aspek === "Waktu")?.realisasi).toBe("—");
    expect(d.indikator.find((i) => i.aspek === "Kualitas")?.realisasi).toBe("—");
  });

  it("Juru Sita memakai sebutan dan kolom putusan; Mediator memakai penetapan dan laporan mediasi", () => {
    const js = susunDokumenRekapEviden(masukan({ peran: "jurusita" }));
    expect(js.judulLengkap).toContain("Juru Sita");
    expect(js.tabel.kolom.map((k) => k.judul)).toContain("Tanggal Putusan");

    const mediasi = (penetapan: string, laporan: string, lama: number | null) => ({
      sandiHasil: "",
      golongan: "",
      penetapan,
      laporan,
      lamaHari: lama,
    });
    const md = susunDokumenRekapEviden(
      masukan({
        peran: "mediator",
        ambangHari: 30,
        baris: [
          baris({ perkaraId: "7", nomorPerkara: "7/Pdt.G/2026/PA.Uji", mediasi: mediasi("2026-04-10", "2026-04-30", 20) }),
          baris({ perkaraId: "8", nomorPerkara: "8/Pdt.G/2026/PA.Uji", mediasi: mediasi("2026-06-10", "", null) }),
        ],
      })
    );
    expect(md.tabel.kolom.map((k) => k.judul)).toEqual(expect.arrayContaining(["Penetapan Mediasi", "Laporan Mediasi"]));
    expect(md.indikator.filter((i) => i.aspek === "Kuantitas").map((i) => i.realisasi)).toEqual(["2 Perkara", "1 Perkara"]);
    expect(md.indikator.find((i) => i.aspek === "Kualitas")?.realisasi).toBe("100%");
    expect(md.tabel.baris[1]).toMatchObject({ keadaan: "Berjalan" });
  });

  it("paket memuat Ketua untuk tanda tangan kanan dan galat dicantumkan di catatan", () => {
    const paket = susunPaketEvidenRekap(masukan({ galat: ["daftar perkara dipotong pada 3000 baris"] }));
    expect(paket.ketua?.nama).toBe("Ketua Uji");
    expect(paket.dokumen).toHaveLength(1);
    expect(paket.dokumen[0].catatan.join("\n")).toContain("daftar perkara dipotong pada 3000 baris");
    expect(paket.orang.jabatan).toBe("Panitera Pengganti");
  });

  it("alamat daftar dan unduh membawa peran, id, periode, dokumen, format", () => {
    const a = new URL(
      alamatEvidenRekap({ aksi: "unduh", peran: "jurusita", id: 8, tahun: 2026, periode: "tw2", dokumen: "semua", format: "xlsx", tanggal: "2026-06-30" }),
      "http://x"
    );
    expect(a.pathname).toBe("/api/aleta-ecourt/rekap-petugas/eviden");
    expect(Object.fromEntries(a.searchParams)).toMatchObject({ aksi: "unduh", peran: "jurusita", id: "8", periode: "tw2", format: "xlsx" });
  });
});

function rekapBot(halaman: BarisRekap[], tambahan: Partial<RekapPetugas> & { adaLagi?: boolean } = {}): { ok: true; data: RekapPetugas } {
  const { adaLagi, ...sisa } = tambahan;
  return {
    ok: true,
    data: {
      ok: true,
      peran: "panitera",
      id: 18,
      dihitungPada: "2026-10-27T01:00:00.000Z",
      perkaraTerbaca: true,
      identitas: { id: 18, nama: "Panitera Pengganti Uji, S.H." },
      ambang: { lamaPerkaraHari: 150, mediasiHari: 30 },
      daftar: { baris: halaman, jumlah: halaman.length, lewati: 0, batas: 200, adaLagi: Boolean(adaLagi) },
      takTerbaca: [],
      ...sisa,
    } as unknown as RekapPetugas,
  };
}

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-hakim";
  kejadian.rekap.mockReset();
  kejadian.rekap.mockResolvedValue(rekapBot(BARIS));
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function panggil(kueri: string) {
  const { GET } = await import("@/app/api/aleta-ecourt/rekap-petugas/eviden/route");
  return GET(new NextRequest(`http://localhost/api/aleta-ecourt/rekap-petugas/eviden?${kueri}`));
}
const DASAR = "peran=panitera&id=18&tahun=2026&periode=tw2";

describe("rute eviden rekap: hak sama dengan tombol hakim (kemampuan panel)", () => {
  it("tanpa sesi 401; panel dimatikan 403 - rekap tidak diminta", async () => {
    aktor = null;
    expect((await panggil(`${DASAR}&aksi=daftar`)).status).toBe(401);
    aktor = "usr-hakim";
    await simpanAksesEkstensi(db!, { actorUserId: "usr-super", roleId: "hakim", kapabilitas: "panel", aktif: false });
    expect((await panggil(`${DASAR}&aksi=daftar`)).status).toBe(403);
    expect(kejadian.rekap).not.toHaveBeenCalled();
  });

  it("alamat salah ditolak 400 sebelum bot dipanggil", async () => {
    for (const kueri of [
      "peran=hakim&id=18&tahun=2026&periode=tw2",
      "peran=panitera&id=abc&tahun=2026&periode=tw2",
      "peran=panitera&id=18&tahun=26&periode=tw2",
      "peran=panitera&id=18&tahun=2026&periode=tw9",
      `${DASAR}&format=exe`,
      `${DASAR}&tanggal=2026-02-30`,
    ]) {
      expect((await panggil(kueri)).status, kueri).toBe(400);
    }
    expect(kejadian.rekap).not.toHaveBeenCalled();
  });
});

describe("rute eviden rekap: daftar dan berkas", () => {
  it("daftar memuat satu dokumen rekap beserta jumlah barisnya", async () => {
    const jawaban = await panggil(`${DASAR}&aksi=daftar`);
    expect(jawaban.status).toBe(200);
    const isi = (await jawaban.json()) as { data: { dokumen: Array<{ kunci: string; jumlahBaris: number; tersedia: boolean }>; orang: { nama: string } } };
    expect(isi.data.dokumen).toEqual([expect.objectContaining({ kunci: "rekap-perkara-ditangani", jumlahBaris: 3, tersedia: true })]);
    expect(isi.data.orang.nama).toBe("Panitera Pengganti Uji, S.H.");
    expect(kejadian.rekap).toHaveBeenCalledWith(expect.objectContaining({ peran: "panitera", id: 18 }));
  });

  it("PDF memuat kop satker, tabel, dan tanda tangan; Excel dan Word berisi; ZIP berisi dokumennya", async () => {
    const pdf = await panggil(`${DASAR}&aksi=unduh&dokumen=rekap-perkara-ditangani&format=pdf&tanggal=2026-06-30`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(namaDariDisposition(pdf.headers.get("content-disposition") ?? "")).toMatch(/^Eviden SKP 2026 - Triwulan II - Rekap Perkara Ditangani Panitera Pengganti - .*\.pdf$/);
    const teks = (await bacaPdfUji(Buffer.from(await pdf.arrayBuffer()))).map((h) => h.teks).join("\n");
    expect(teks).toContain("1/Pdt.G/2026/PA.Uji");
    expect(teks).toContain("3 Perkara");
    expect(teks).toContain("Mengetahui,");

    for (const [format, jenis] of [
      ["xlsx", "spreadsheetml"],
      ["docx", "wordprocessingml"],
    ] as const) {
      const j = await panggil(`${DASAR}&aksi=unduh&dokumen=semua&format=${format}`);
      // "semua" selalu ZIP, walau dokumennya satu.
      expect(j.headers.get("content-type")).toBe("application/zip");
      const arsip = bacaZip(Buffer.from(await j.arrayBuffer()));
      expect([...arsip.keys()].some((n) => n.endsWith(`.${format}`)), format).toBe(true);
      const satu = await panggil(`${DASAR}&aksi=unduh&dokumen=rekap-perkara-ditangani&format=${format}`);
      expect(satu.headers.get("content-type")).toContain(jenis);
    }
  });

  it("dokumen tak dikenal 404; bot mati 502; orang tak ada 404", async () => {
    expect((await panggil(`${DASAR}&aksi=unduh&dokumen=tidak-ada&format=pdf`)).status).toBe(404);
    kejadian.rekap.mockResolvedValue({ ok: false, error: "aleta_bot tidak dapat dihubungi" });
    expect((await panggil(`${DASAR}&aksi=daftar`)).status).toBe(502);
    kejadian.rekap.mockResolvedValue({ ok: false, error: "Tidak ada panitera pengganti dengan ID SIPP 18." });
    expect((await panggil(`${DASAR}&aksi=daftar`)).status).toBe(404);
  });

  it("daftar yang berhalaman dibaca sampai habis, dan unduhan tercatat di jejak audit", async () => {
    kejadian.rekap
      .mockResolvedValueOnce(rekapBot(BARIS.slice(0, 2), { adaLagi: true }))
      .mockResolvedValueOnce(rekapBot(BARIS.slice(2)));
    const jawaban = await panggil(`${DASAR}&aksi=unduh&dokumen=rekap-perkara-ditangani&format=pdf`);
    expect(jawaban.status).toBe(200);
    expect(kejadian.rekap).toHaveBeenCalledTimes(2);
    expect(kejadian.rekap.mock.calls[1][0]).toMatchObject({ lewati: 200 });
    const audit = await db!.queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action = ?", ["EVIDEN_SKP_REKAP_UNDUH"]);
    expect(audit).toHaveLength(1);
  });
});
