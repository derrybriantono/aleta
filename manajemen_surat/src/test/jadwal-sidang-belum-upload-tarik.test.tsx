/**
 * 7 Okt 2026: penanda "belum upload" di Jadwal Sidang dapat ditekan - ALETA
 * langsung menarik ulang e-Court HANYA untuk perkara itu (daftar dokumen
 * e-Litigasi + berkas baru ke arsip), lalu memperbarui penanda baris itu
 * tanpa memuat ulang tabel.
 *
 * Perilaku: layanan bot dijalankan dengan basis data + jembatan tiruan
 * (kunci ganda, jeda per perkara, sesi habis, penarikan lain berjalan),
 * pengendali portal dengan fetch tiruan (tanya berkala, bot mati, batas
 * waktu), hook-nya, dan lencananya dirender lalu ditekan.
 */
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { penandaVerifikasi, type DataVerifikasi, type VerifikasiPerkara } from "@/lib/penanda-verifikasi-ecourt";
import {
  BATAS_TUNGGU_MS,
  gantiPerkaraVerifikasi,
  tarikBelumUpload,
  type HasilTarik,
} from "@/lib/tarik-belum-upload";
import { SAKLAR_TAMPILAN, tampil } from "@/lib/tampilan-antrian-sidang";
import { LencanaVerifikasiMajelis } from "@/components/portal/aleta-ecourt-sidang";
import { ALAMAT_TARIK_BELUM_UPLOAD, useTarikBelumUpload } from "@/components/portal/use-tarik-belum-upload";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const baca = (rel: string) => readFileSync(path.join(AKAR, rel), "utf8");

type Tarikan = {
  status: string;
  pesan: string;
  dokumenBaru: Array<{ judul: string }>;
  berkasBaru: number;
  perkara: { keadaan: string } | null;
  nomorPerkara: string;
};
type Jawab = { ok: boolean; alasan?: string; pesan?: string; bergabung?: boolean; jeda?: boolean; sisaDetik?: number; dimulai?: boolean; tarikan?: Tarikan };
type Layanan = {
  tarikSekarang: (isi: Record<string, unknown>) => Promise<Jawab>;
  statusTarikan: (nomor: string) => { ok: boolean; ada: boolean; tarikan: Tarikan | null; sisaJedaDetik: number };
  tungguTarikan: (nomor: string) => Promise<void>;
  keadaanHari: (t?: string) => Promise<{ perkara: Record<string, { keadaan: string }> }>;
};
const harianMod = require_(path.join(AKAR, "aleta_bot/services/ecourtVerifikasiHarianService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  JEDA_MIN_TARIK_PERKARA_MS: number;
  BATAS_TARIK_PERKARA_MS: number;
};
const storeMod = require_(path.join(AKAR, "aleta_bot/services/ecourtStoreService.js")) as {
  dokumenMenungguMajelis: (d: Record<string, unknown>) => boolean;
};

const HARI = "2026-10-07";
const NOMOR = "609/Pdt.G/2026/PA.Dgl";

type Dok = Record<string, unknown> & { documentKey: string };

/** Dunia tiruan: SIPP (jadwal hari ini), arsip e-Court ALETA, jembatan, jam. */
function dunia(o: { jedaTarikMs?: number } = {}) {
  const perkara = [
    { perkaraId: 1, nomorPerkara: NOMOR, agenda: "Duplik", sidangLalu: "2026-09-30" },
    { perkaraId: 2, nomorPerkara: "615/Pdt.G/2026/PA.Dgl", agenda: "Replik", sidangLalu: "2026-09-30" },
  ];
  const dokumen: Dok[] = [
    // Jawaban lama, sudah diverifikasi, sebelum sidang lalu -> "belum upload".
    { documentKey: "k-jawaban", nomorPerkara: NOMOR, judulDokumen: "Jawaban Tergugat", peranPengunggah: "Tergugat", diunggahPada: "2026-09-25 10:00:00", statusVerifikasi: "valid", terakhirTerlihat: "2026-10-07 08:00:00" },
  ];
  const berkas: Array<{ documentKey: string; nomorPerkara: string }> = [{ documentKey: "k-jawaban", nomorPerkara: NOMOR }];
  let jam = new Date(2026, 9, 7, 13, 20, 0).getTime();
  const ditarik: string[] = [];
  let hasilJembatan: Record<string, unknown> = { kode: 0 };
  let lepas: (() => void) | null = null;
  let akun = true;
  let lainSibuk = false;
  let tambah = true;

  const kueriSipp = async (sql: string) => (/perkara_efiling_id/.test(sql) ? perkara : []);
  const kueriBot = async (sql: string, nilai: unknown[] = []) => {
    if (/FROM aleta_bot_ecourt_files/.test(sql)) {
      const peta = new Map<string, number>();
      for (const b of berkas) if (b.nomorPerkara === nilai[0]) peta.set(b.documentKey, (peta.get(b.documentKey) || 0) + 1);
      return [...peta].map(([documentKey, jumlah]) => ({ documentKey, jumlah }));
    }
    if (/FROM aleta_bot_ecourt_documents/.test(sql)) return dokumen.filter((d) => (nilai as string[]).includes(String(d.nomorPerkara)));
    return [];
  };
  const L = harianMod.buatLayanan({
    kueriSipp,
    kueriBot,
    menunggu: storeMod.dokumenMenungguMajelis,
    akunSiap: () => akun,
    bolehJalan: () => true,
    sibuk: () => ({ sibuk: lainSibuk, keterangan: lainSibuk ? "jadwal" : "" }),
    sekarang: () => new Date(jam),
    jedaTarikMs: o.jedaTarikMs,
    // Jembatan tiruan: menunggu dilepas uji, lalu "menemukan" dua dokumen baru.
    tarikPerkara: (nomor: string) => {
      ditarik.push(nomor);
      return new Promise((selesai) => {
        lepas = () => {
          if (hasilJembatan.kode === 0 && tambah) {
            dokumen.push(
              { documentKey: "k-duplik", nomorPerkara: NOMOR, judulDokumen: "Duplik Tergugat", peranPengunggah: "Tergugat", diunggahPada: "2026-10-07 12:55:00", statusVerifikasi: "belum", terakhirTerlihat: "2026-10-07 13:21:00" },
              { documentKey: "k-bukti", nomorPerkara: NOMOR, judulDokumen: "Bukti T-1", peranPengunggah: "Tergugat", diunggahPada: "2026-10-07 12:58:00", statusVerifikasi: "belum", terakhirTerlihat: "2026-10-07 13:21:00" }
            );
            berkas.push({ documentKey: "k-duplik", nomorPerkara: NOMOR }, { documentKey: "k-bukti", nomorPerkara: NOMOR });
          }
          jam += 90 * 1000;
          selesai(hasilJembatan);
        };
      });
    },
  });
  return {
    L,
    ditarik,
    lepas: () => lepas?.(),
    majukan: (ms: number) => (jam += ms),
    setJembatan: (h: Record<string, unknown>) => (hasilJembatan = h),
    setAkun: (x: boolean) => (akun = x),
    setSibuk: (x: boolean) => (lainSibuk = x),
    setTambah: (x: boolean) => (tambah = x),
  };
}

describe("bot: tarik sekarang satu perkara dari penanda belum upload", () => {
  it("menarik HANYA perkara itu; dokumen baru disebut namanya; berkas baru dihitung; keadaan baris dihitung ulang", async () => {
    const w = dunia();
    expect((await w.L.keadaanHari(HARI)).perkara[NOMOR].keadaan).toBe("belum-upload");

    const mulai = await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI, olehSiapa: "Penguji" });
    expect(mulai).toMatchObject({ ok: true, dimulai: true, tarikan: { status: "berjalan", pesan: "Memeriksa e-Court..." } });
    expect(w.ditarik).toEqual([NOMOR]);
    expect(w.L.statusTarikan(NOMOR).tarikan?.status).toBe("berjalan");

    w.lepas();
    await w.L.tungguTarikan(NOMOR);
    const s = w.L.statusTarikan(NOMOR);
    expect(s.tarikan).toMatchObject({
      status: "selesai",
      berkasBaru: 2,
      pesan: "2 dokumen baru: Duplik Tergugat, Bukti T-1",
      // Dokumen baru belum diverifikasi -> penandanya kini kuning.
      perkara: { keadaan: "belum", nomorPerkara: NOMOR },
    });
    expect(s.tarikan?.dokumenBaru.map((d) => d.judul)).toEqual(["Duplik Tergugat", "Bukti T-1"]);
    // Perkara lain di hari yang sama tidak disentuh.
    expect(w.ditarik).toEqual([NOMOR]);
  });

  it("tanpa dokumen baru: 'Masih belum diunggah pihak (diperiksa 13.21)', penandanya tetap jingga", async () => {
    const w = dunia();
    w.setTambah(false);
    await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
    w.lepas();
    await w.L.tungguTarikan(NOMOR);
    const t = w.L.statusTarikan(NOMOR).tarikan;
    expect(t).toMatchObject({
      status: "selesai",
      berkasBaru: 0,
      dokumenBaru: [],
      pesan: "Masih belum diunggah pihak (diperiksa 13.21)",
      perkara: { keadaan: "belum-upload" },
    });
  });

  it("kunci ganda: dua penekanan bersamaan (dua pengguna) = SATU tarikan; yang kedua bergabung", async () => {
    const w = dunia();
    const [a, b] = await Promise.all([
      w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI, olehSiapa: "A" }),
      w.L.tarikSekarang({ nomorPerkara: " 609/Pdt.G/2026/PA.Dgl ", tanggal: HARI, olehSiapa: "B" }),
    ]);
    expect(a).toMatchObject({ ok: true, dimulai: true });
    expect(b).toMatchObject({ ok: true, bergabung: true, tarikan: { status: "berjalan" } });
    // Penekanan ketiga selagi berjalan juga bergabung.
    expect(await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI })).toMatchObject({ bergabung: true });
    expect(w.ditarik).toHaveLength(1);
    w.lepas();
    await w.L.tungguTarikan(NOMOR);
  });

  it("jeda per perkara: dalam 60 dtk sesudah selesai hasil terakhir yang dijawab, tidak menarik lagi", async () => {
    const w = dunia();
    await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
    w.lepas();
    await w.L.tungguTarikan(NOMOR);

    w.majukan(30 * 1000);
    const lagi = await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
    expect(lagi).toMatchObject({ ok: true, jeda: true, sisaDetik: 30, tarikan: { status: "selesai" } });
    expect(w.ditarik).toHaveLength(1);

    w.majukan(31 * 1000);
    expect(await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI })).toMatchObject({ ok: true, dimulai: true });
    expect(w.ditarik).toHaveLength(2);
    w.lepas();
    await w.L.tungguTarikan(NOMOR);
  });

  it("jeda tidak dapat disetel di bawah 60 dtk", async () => {
    expect(harianMod.JEDA_MIN_TARIK_PERKARA_MS).toBe(60 * 1000);
    const w = dunia({ jedaTarikMs: 1000 });
    await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
    w.lepas();
    await w.L.tungguTarikan(NOMOR);
    w.majukan(5 * 1000);
    expect(await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI })).toMatchObject({ jeda: true });
  });

  it("sesi e-Court habis (kode 2): sebabnya jelas; tanpa akun bersesi tidak menarik sama sekali", async () => {
    const w = dunia();
    w.setJembatan({ kode: 2 });
    await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
    w.lepas();
    await w.L.tungguTarikan(NOMOR);
    const t = w.L.statusTarikan(NOMOR).tarikan;
    expect(t?.status).toBe("sesi-habis");
    expect(t?.pesan).toContain("Sesi e-Court habis");
    expect(t?.pesan).toContain("Integrasi e-Court");

    const w2 = dunia();
    w2.setAkun(false);
    const r = await w2.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
    expect(r).toMatchObject({ ok: false, alasan: "akun_tidak_siap" });
    expect(r.pesan).toContain("sesi e-Court habis");
    expect(w2.ditarik).toHaveLength(0);
    // Penolakan tidak menimbulkan jeda - begitu admin masuk ulang, langsung dapat ditekan.
    w2.setAkun(true);
    expect(await w2.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI })).toMatchObject({ ok: true, dimulai: true });
    w2.lepas();
    await w2.L.tungguTarikan(NOMOR);
  });

  it("penarikan lain sedang berjalan: ditolak dengan sebab, tidak diantrekan diam-diam", async () => {
    const w = dunia();
    w.setSibuk(true);
    const r = await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
    expect(r).toMatchObject({ ok: false, alasan: "penarikan_lain_berjalan" });
    expect(r.pesan).toContain("Penarikan e-Court lain sedang berjalan (jadwal)");
    expect(w.ditarik).toHaveLength(0);
  });

  it("jembatan menolak karena kalah balapan (dilewati): 'sibuk', tanpa jeda", async () => {
    const w = dunia();
    w.setJembatan({ dilewati: true, alasan: "putaran_sebelumnya_belum_selesai" });
    await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
    w.lepas();
    await w.L.tungguTarikan(NOMOR);
    expect(w.L.statusTarikan(NOMOR).tarikan?.status).toBe("sibuk");
    w.setJembatan({ kode: 0 });
    expect(await w.L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI })).toMatchObject({ dimulai: true });
    w.lepas();
    await w.L.tungguTarikan(NOMOR);
  });

  it("hanya perkara e-Litigasi yang bersidang pada tanggal itu - bot bukan penarik serba-guna", async () => {
    const w = dunia();
    const r = await w.L.tarikSekarang({ nomorPerkara: "1/Pdt.G/2020/PA.Dgl", tanggal: HARI });
    expect(r).toMatchObject({ ok: false, alasan: "bukan_elitigasi_hari_itu" });
    expect(await w.L.tarikSekarang({ nomorPerkara: "", tanggal: HARI })).toMatchObject({ ok: false, alasan: "nomor_perkara_kosong" });
    expect(w.ditarik).toHaveLength(0);
  });

  it("jembatan sungguhan: --perkara dengan unduh (tanpa --tanpa-unduh), batas waktu pendek", () => {
    const sumber = baca("aleta_bot/services/ecourtVerifikasiHarianService.js");
    const blok = sumber.slice(sumber.indexOf("const tarikPerkara ="), sumber.indexOf("const sibuk ="));
    expect(blok).toContain('sumber: "jadwal-belum-upload"');
    expect(blok).toContain("batasMs: BATAS_TARIK_PERKARA_MS");
    expect(blok).not.toContain("tanpaUnduh");
    expect(harianMod.BATAS_TARIK_PERKARA_MS).toBe(5 * 60 * 1000);
    const penjadwal = baca("aleta_bot/services/ecourtSchedulerService.js");
    expect(penjadwal).toContain("batasMs = null,");
    expect(penjadwal).toMatch(/setTimeout\(\(\) => \{\s+dipaksaBerhenti = true;\s+anak\.kill\("SIGKILL"\);\s+\}, batasPutaran\);/);
  });
});

// ============================================================================
// Portal: pengendali (POST lalu tanya berkala)
// ============================================================================

const ALAMAT = "/aleta/api/aleta-ecourt/sidang/verifikasi-ecourt/tarik";

function jawab(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: status < 400, data }), { status, headers: { "Content-Type": "application/json" } });
}

const PERKARA_BARU: VerifikasiPerkara = {
  nomorPerkara: NOMOR,
  keadaan: "belum",
  menunggu: 2,
  dokumen: 3,
  terakhirDiperiksa: "2026-10-07 13:21:30",
  diverifikasiOleh: [],
};

describe("portal: tarikBelumUpload", () => {
  it("POST nomor + tanggal, lalu GET berkala sampai selesai; keadaan baru perkara itu ikut kembali", async () => {
    const panggilan: Array<{ alamat: string; init?: RequestInit }> = [];
    const urutan = [
      jawab({ available: true, ok: true, dimulai: true, tarikan: { status: "berjalan", nomorPerkara: NOMOR } }),
      jawab({ available: true, ok: true, ada: true, tarikan: { status: "berjalan", nomorPerkara: NOMOR } }),
      jawab({
        available: true,
        ok: true,
        ada: true,
        tarikan: {
          status: "selesai",
          nomorPerkara: NOMOR,
          selesai: "2026-10-07 13:21:30",
          pesan: "2 dokumen baru: Duplik Tergugat, Bukti T-1",
          dokumenBaru: [{ judul: "Duplik Tergugat" }, { judul: "Bukti T-1" }],
          perkara: PERKARA_BARU,
        },
      }),
    ];
    const hasil = await tarikBelumUpload({
      nomorPerkara: NOMOR,
      tanggal: HARI,
      alamat: ALAMAT,
      ambil: async (alamat, init) => {
        panggilan.push({ alamat, init });
        return urutan.shift()!;
      },
      tunggu: async () => undefined,
    });
    expect(panggilan[0].init?.method).toBe("POST");
    expect(JSON.parse(String(panggilan[0].init?.body))).toEqual({ nomorPerkara: NOMOR, tanggal: HARI });
    expect(panggilan[1].alamat).toBe(`${ALAMAT}?nomorPerkara=${encodeURIComponent(NOMOR)}`);
    expect(panggilan).toHaveLength(3);
    expect(hasil).toMatchObject({ tahap: "selesai", pesan: "2 dokumen baru: Duplik Tergugat, Bukti T-1", perkara: PERKARA_BARU });
    expect(hasil.dokumenBaru).toEqual(["Duplik Tergugat", "Bukti T-1"]);
  });

  it("bot mati: sebabnya disebut, tidak melempar", async () => {
    const hasil = await tarikBelumUpload({
      nomorPerkara: NOMOR,
      tanggal: HARI,
      alamat: ALAMAT,
      ambil: async () => jawab({ available: false, ok: false, pesan: "ALETA Bot tidak menjawab dalam batas waktu." }),
    });
    expect(hasil.tahap).toBe("masalah");
    expect(hasil.pesan).toContain("ALETA Bot tidak tersambung (ALETA Bot tidak menjawab dalam batas waktu.)");

    const putus = await tarikBelumUpload({
      nomorPerkara: NOMOR,
      tanggal: HARI,
      alamat: ALAMAT,
      ambil: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(putus).toMatchObject({ tahap: "masalah" });
    expect(putus.pesan).toContain("ALETA Bot tidak tersambung");
  });

  it("sesi e-Court habis: pesan bot diteruskan apa adanya", async () => {
    const pesan = "Tidak ada akun e-Court yang sesinya siap - sesi e-Court habis atau belum masuk. Minta admin masuk ulang di menu Integrasi e-Court.";
    const awal = await tarikBelumUpload({
      nomorPerkara: NOMOR,
      tanggal: HARI,
      alamat: ALAMAT,
      ambil: async () => jawab({ available: true, ok: false, alasan: "akun_tidak_siap", pesan }),
    });
    expect(awal).toMatchObject({ tahap: "masalah", pesan });

    const urutan = [
      jawab({ available: true, ok: true, dimulai: true, tarikan: { status: "berjalan", nomorPerkara: NOMOR } }),
      jawab({ available: true, ok: true, ada: true, tarikan: { status: "sesi-habis", nomorPerkara: NOMOR, pesan: "" } }),
    ];
    const tengah = await tarikBelumUpload({
      nomorPerkara: NOMOR,
      tanggal: HARI,
      alamat: ALAMAT,
      ambil: async () => urutan.shift()!,
      tunggu: async () => undefined,
    });
    expect(tengah.tahap).toBe("masalah");
    expect(tengah.pesan).toContain("Sesi e-Court habis");
  });

  it("batas waktu: berhenti menunggu dengan pesan yang jelas", async () => {
    let jam = 0;
    let n = 0;
    const hasil = await tarikBelumUpload({
      nomorPerkara: NOMOR,
      tanggal: HARI,
      alamat: ALAMAT,
      ambil: async () => {
        n += 1;
        return jawab({ available: true, ok: true, dimulai: n === 1, tarikan: { status: "berjalan", nomorPerkara: NOMOR } });
      },
      tunggu: async () => {
        jam += 60 * 1000;
      },
      sekarang: () => jam,
    });
    expect(hasil.tahap).toBe("masalah");
    expect(hasil.pesan).toContain(`dalam ${BATAS_TUNGGU_MS / 60000} menit`);
    expect(n).toBeLessThan(10);
  });

  it("dalam jeda: hasil terakhir + kapan dapat diperiksa lagi; keadaan barisnya tetap ikut", async () => {
    const hasil = await tarikBelumUpload({
      nomorPerkara: NOMOR,
      tanggal: HARI,
      alamat: ALAMAT,
      ambil: async () =>
        jawab({
          available: true,
          ok: true,
          jeda: true,
          sisaDetik: 42,
          tarikan: { status: "selesai", nomorPerkara: NOMOR, selesai: "2026-10-07 13:20:05", pesan: "Masih belum diunggah pihak (diperiksa 13.20)", perkara: PERKARA_BARU },
        }),
    });
    expect(hasil.tahap).toBe("jeda");
    expect(hasil.pesan).toBe("Masih belum diunggah pihak (diperiksa 13.20). Dapat diperiksa lagi dalam 42 dtk.");
    expect(hasil.perkara).toEqual(PERKARA_BARU);
  });

  it("gantiPerkaraVerifikasi menimpa perkara itu saja", () => {
    const lain: VerifikasiPerkara = { ...PERKARA_BARU, nomorPerkara: "615/Pdt.G/2026/PA.Dgl", keadaan: "sudah" };
    const lama: DataVerifikasi = {
      terbaca: true,
      tanggal: HARI,
      perkara: { "609/Pdt.G/2026/PA.Dgl ": { ...PERKARA_BARU, nomorPerkara: "609/Pdt.G/2026/PA.Dgl ", keadaan: "belum-upload" }, [lain.nomorPerkara]: lain },
    };
    const baru = gantiPerkaraVerifikasi(lama, PERKARA_BARU);
    expect(Object.keys(baru.perkara).sort()).toEqual([NOMOR, lain.nomorPerkara].sort());
    expect(baru.perkara[NOMOR].keadaan).toBe("belum");
    expect(baru.perkara[lain.nomorPerkara]).toBe(lain);
  });
});

// ============================================================================
// Hook: kunci per tab + pembaruan baris tanpa muat ulang
// ============================================================================

describe("useTarikBelumUpload", () => {
  it("klik berulang = satu tarikan; hasilnya menimpa keadaan baris itu saja", async () => {
    let lepas: (h: HasilTarik) => void = () => {};
    const tarik = vi.fn(
      () =>
        new Promise<HasilTarik>((selesai) => {
          lepas = selesai;
        })
    );
    const awal: DataVerifikasi = {
      terbaca: true,
      tanggal: HARI,
      perkara: {
        [NOMOR]: { ...PERKARA_BARU, keadaan: "belum-upload", menunggu: 0 },
        "615/Pdt.G/2026/PA.Dgl": { ...PERKARA_BARU, nomorPerkara: "615/Pdt.G/2026/PA.Dgl", keadaan: "sudah" },
      },
    };
    const { result } = renderHook(() => {
      const [v, setV] = useState<DataVerifikasi>(awal);
      return { v, t: useTarikBelumUpload(setV, { tarik }) };
    });

    const baris = { nomorPerkara: NOMOR, tanggalSidang: `${HARI} 09:00:00` };
    let p1: Promise<unknown> = Promise.resolve();
    act(() => {
      p1 = result.current.t.tarik(baris);
      void result.current.t.tarik(baris);
      void result.current.t.tarik(baris);
    });
    expect(tarik).toHaveBeenCalledTimes(1);
    expect(tarik.mock.calls[0]).toEqual([
      expect.objectContaining({ nomorPerkara: NOMOR, tanggal: HARI, alamat: expect.stringContaining(ALAMAT_TARIK_BELUM_UPLOAD) }),
    ]);
    expect(result.current.t.keadaanUntuk(NOMOR)).toMatchObject({ tahap: "berjalan", pesan: "Memeriksa e-Court..." });

    await act(async () => {
      lepas({ tahap: "selesai", pesan: "2 dokumen baru: Duplik Tergugat, Bukti T-1", dokumenBaru: ["Duplik Tergugat", "Bukti T-1"], perkara: PERKARA_BARU });
      await p1;
    });
    expect(result.current.t.keadaanUntuk(NOMOR)).toMatchObject({ tahap: "selesai", pesan: "2 dokumen baru: Duplik Tergugat, Bukti T-1" });
    expect(result.current.v.perkara[NOMOR].keadaan).toBe("belum");
    expect(result.current.v.perkara["615/Pdt.G/2026/PA.Dgl"].keadaan).toBe("sudah");

    // Sesudah selesai, dapat ditekan lagi (jeda dijaga bot, bukan di sini).
    act(() => {
      void result.current.t.tarik(baris);
    });
    expect(tarik).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// Lencana: hanya "belum upload" yang dapat ditekan
// ============================================================================

afterEach(() => cleanup());

const BARIS = { nomorPerkara: NOMOR, tanggalSidang: HARI, lewatEcourt: true, agenda: "Duplik", urutanSidang: 4 };
function data(keadaan: VerifikasiPerkara["keadaan"]): DataVerifikasi {
  return {
    terbaca: true,
    tanggal: HARI,
    perkara: { [NOMOR]: { ...PERKARA_BARU, keadaan, menunggu: keadaan === "belum" ? 1 : 0, sidangLalu: "2026-09-30" } },
  };
}

describe("LencanaVerifikasiMajelis dapat ditekan", () => {
  it("belum upload + onTarik = tombol; ditekan memanggil tarik", () => {
    const onTarik = vi.fn();
    const { container } = render(
      createElement(LencanaVerifikasiMajelis, { penanda: penandaVerifikasi(BARIS, data("belum-upload"), HARI), onTarik })
    );
    const tombol = container.querySelector("button[data-tarik-belum-upload]") as HTMLButtonElement;
    expect(tombol).not.toBeNull();
    expect(tombol.textContent).toBe("Belum upload");
    expect(tombol.title).toContain("Tekan untuk memeriksa e-Court sekarang - hanya perkara ini.");
    fireEvent.click(tombol);
    expect(onTarik).toHaveBeenCalledTimes(1);
  });

  it("keadaan lain, atau saklar mati (tanpa onTarik): bukan tombol", () => {
    const onTarik = vi.fn();
    for (const k of ["sudah", "belum", "tidak-konek"] as const) {
      const { container, unmount } = render(createElement(LencanaVerifikasiMajelis, { penanda: penandaVerifikasi(BARIS, data(k), HARI), onTarik }));
      expect(container.querySelector("button"), k).toBeNull();
      unmount();
    }
    const { container } = render(createElement(LencanaVerifikasiMajelis, { penanda: penandaVerifikasi(BARIS, data("belum-upload"), HARI) }));
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector('[data-verifikasi-majelis="belum-upload"]')?.textContent).toBe("Belum upload");
  });

  it("sedang berjalan: tombol terkunci, kemajuan tampil; masalah tampil merah", () => {
    const { container, rerender } = render(
      createElement(LencanaVerifikasiMajelis, {
        penanda: penandaVerifikasi(BARIS, data("belum-upload"), HARI),
        onTarik: () => {},
        tarikan: { tahap: "berjalan", pesan: "Memeriksa e-Court...", dokumenBaru: [] },
      })
    );
    const tombol = container.querySelector("button") as HTMLButtonElement;
    expect(tombol.disabled).toBe(true);
    expect(tombol.textContent).toBe("Memeriksa...");
    expect(container.querySelector('[data-kemajuan-tarik="berjalan"]')?.textContent).toBe("Memeriksa e-Court...");

    rerender(
      createElement(LencanaVerifikasiMajelis, {
        penanda: penandaVerifikasi(BARIS, data("belum-upload"), HARI),
        onTarik: () => {},
        tarikan: { tahap: "masalah", pesan: "Sesi e-Court habis - minta admin masuk ulang di menu Integrasi e-Court, lalu tekan lagi.", dokumenBaru: [] },
      })
    );
    const pesan = container.querySelector('[data-kemajuan-tarik="masalah"]');
    expect(pesan?.textContent).toContain("Sesi e-Court habis");
    expect(pesan?.className).toContain("text-red-700");
    expect((container.querySelector("button") as HTMLButtonElement).disabled).toBe(false);
  });
});

// ============================================================================
// Saklar Tampilan, layar, dan rute
// ============================================================================

describe("saklar, layar, rute", () => {
  const LAYAR = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

  it("saklar tarik-belum-upload ada di Tampilan: tombol baris, bawaan menyala, dapat dimatikan", () => {
    const s = SAKLAR_TAMPILAN.find((x) => x.kunci === "tarik-belum-upload");
    expect(s).toBeDefined();
    expect(s?.kelompok).toBe("alat");
    expect(s?.wajib ?? false).toBe(false);
    expect(s?.bawaanMati ?? false).toBe(false);
    expect(tampil({}, "tarik-belum-upload")).toBe(true);
    expect(tampil({ "tarik-belum-upload": false }, "tarik-belum-upload")).toBe(false);
  });

  it("layar: penanda yang sama, onTarik hanya bila saklarnya menyala; hasil ke setVerifikasi (tanpa muat ulang)", () => {
    expect(LAYAR).toContain("const tarikBelumUpload = useTarikBelumUpload(setVerifikasi);");
    expect(LAYAR).toMatch(/tampil\(tampilan, "tarik-belum-upload"\)\s+\? \(\) => void tarikBelumUpload\.tarik\(baris\)\s+: undefined/);
    expect(LAYAR).toContain("tarikan={tarikBelumUpload.keadaanUntuk(baris.nomorPerkara)}");
  });

  it("rute portal: kewenangan panel (sama dengan penandanya), bungkus ok(), memanggil rute bot", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/verifikasi-ecourt/tarik/route.ts");
    expect(rute.match(/pastikanKapabilitas\(db, actorUserId, "panel"\)/g)?.length).toBe(2);
    expect(rute).toContain('panggilBotJadwalSidang("/belum-upload/tarik", {');
    expect(rute).toContain("panggilBotJadwalSidang(`/belum-upload/tarik?nomorPerkara=${encodeURIComponent(nomor)}`");
    expect(rute).not.toMatch(/NextResponse\.json/);
    const baca1 = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/verifikasi-ecourt/route.ts");
    expect(baca1).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
  });

  it("rute bot: bertoken, di berkas Jadwal Sidang", () => {
    const rute = baca("aleta_bot/routes/jadwalSidangRoutes.js");
    expect(rute).toContain('router.post("/belum-upload/tarik", wajibToken, async');
    expect(rute).toContain('router.get("/belum-upload/tarik", wajibToken, async');
  });
});
