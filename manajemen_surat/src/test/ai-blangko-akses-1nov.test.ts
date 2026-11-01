// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PermintaanAi } from "@/lib/aleta-ai/penyusun";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { suntikKlienAi, type HasilAi, type KlienAi, type OpsiAlir } from "@/server/modules/aleta-ai/klien";
import { simpanKurs, tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { ulangiBatasLaju } from "@/server/modules/aleta-ai/mesin";
import { buatPercakapan } from "@/server/modules/aleta-ai/percakapan";
import { unggahProyek } from "@/server/modules/aleta-ai/proyek";
import { terapkanMutasi } from "@/server/modules/aleta-ai/saldo";
import { ApiError } from "@/server/shared/errors";
import { susunZip } from "@/server/shared/zip";

import { POST as kirimPesanRute } from "../app/api/aleta-ai/percakapan/[id]/pesan/route";
import { POST as perkiraanRute } from "../app/api/aleta-ai/perkiraan/route";
import { GET as ringkasRute } from "../app/api/aleta-ai/ringkas/route";

/**
 * ALETA Ai di panel Blangko Derry - AKSES (1 Nov 2026): fitur panel dipakai menurut hak peran DAN sisa saldo; peran yang
 * aplikasinya belum dibuka (Akses Menu) ditolak dengan kalimat biasa, tanpa label teknis, sebelum layanan AI disentuh.
 * Rute HTTP dijalankan sungguhan; hanya pembuktian sesi dan pemeriksaan Akses Menu yang ditiru.
 */

const ctx = vi.hoisted(() => ({ db: null as unknown, pelaku: null as unknown, tutup: false }));
const PESAN_TUTUP = "ALETA Ai tidak dibuka untuk peran Anda. Hubungi Super Admin - Akses Menu.";

vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => ctx.db }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "uji" }));
vi.mock("@/server/modules/organization/service", async (asli) => ({ ...(await asli<typeof import("@/server/modules/organization/service")>()), requireActorUser: async () => ({ id: "uji" }) }));
vi.mock("@/server/modules/akses/hak-peran", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/akses/hak-peran")>()),
  pastikanAplikasiAktor: async () => {
    if (ctx.tutup) {
      const { ApiError: Galat } = await import("@/server/shared/errors");
      throw new Galat(403, "ALETA Ai tidak dibuka untuk peran Anda. Hubungi Super Admin - Akses Menu.", { aplikasi: "aleta-ai", alasan: "matriks_peran" });
    }
  },
}));
vi.mock("@/server/modules/aleta-ai/akses", async (asli) => {
  const dasar = await asli<typeof import("@/server/modules/aleta-ai/akses")>();
  return {
    ...dasar,
    pelakuAi: async () => ctx.pelaku,
    pelakuAiBerhak: async () => {
      if (ctx.tutup) {
        const { ApiError: Galat } = await import("@/server/shared/errors");
        throw new Galat(403, "ALETA Ai tidak dibuka untuk peran Anda. Hubungi Super Admin - Akses Menu.", { aplikasi: "aleta-ai", alasan: "matriks_peran" });
      }
      return ctx.pelaku;
    },
  };
});

const hakim: PelakuAi = { id: "usr-akses", nama: "Hakim", peranId: "hakim", superAdmin: false };
const superAdmin: PelakuAi = { id: "usr-super", nama: "Super", peranId: "super-admin", superAdmin: true };

const MENU_MD = `# ALETA_05 — TRIGGER MENU LENGKAP
Modul rekaan untuk uji.

## KELOMPOK A — DRAFTING UTAMA
| Trigger | Output |
|---|---|
| Duduk Perkara | Ringkasan rekaan |
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

const permintaan = (badan: unknown) => new NextRequest("http://localhost/api/aleta-ai/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan) });
const BAHAN = { perkara: "Nomor perkara: 1/Pdt.G/2026/PA.Dgl", naskah: "Naskah rekaan." };

describe("akses fitur panel: peran yang aplikasinya belum dibuka ditolak dengan kalimat biasa", () => {
  let db: AletaDatabase;
  let klien: KlienTiruan;
  let idPercakapan: string;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
    ctx.db = db;
    ctx.pelaku = hakim;
    await simpanKurs(db, { tanggal: tanggalLokal(), kurs: 16000, sumber: "uji" });
    await unggahProyek(db, superAdmin.id, { bita: zipRekaan(), namaBerkas: "proyek-rekaan.zip" });
    await terapkanMutasi(db, { penggunaId: hakim.id, jenis: "isi", jumlahRp: 50_000, catatan: "uji" });
    idPercakapan = (await buatPercakapan(db, hakim.id)).id;
  }, 180000);
  afterAll(async () => {
    suntikKlienAi(undefined);
    await db?.close();
  });
  afterEach(() => {
    ctx.tutup = false;
    ulangiBatasLaju();
  });
  const baru = () => {
    klien = new KlienTiruan();
    suntikKlienAi(klien);
  };

  it("ringkas: aplikasi dibuka -> fitur panel ada; ditutup -> aplikasiDibuka=false, fitur kosong, kalimat jelas tanpa label teknis", async () => {
    baru();
    const buka = (await (await ringkasRute(new NextRequest("http://localhost/api/aleta-ai/ringkas"))).json()).data;
    expect(buka.aplikasiDibuka).toBe(true);
    expect(buka.fiturBlangko).toEqual(expect.arrayContaining(["A1", "A3", "B1", "D1", "D4"]));
    ctx.tutup = true;
    const tutup = (await (await ringkasRute(new NextRequest("http://localhost/api/aleta-ai/ringkas"))).json()).data;
    expect(tutup).toMatchObject({ aplikasiDibuka: false, fiturBlangko: [], alasanAplikasi: PESAN_TUTUP });
    expect(tutup.alasanAplikasi).not.toMatch(/matriks|aplikasi:|_/);
  });

  it("perkiraan dan pesan dari panel (fitur / menu proyek) ditolak 403 dengan kalimat itu, layanan AI tidak dipanggil, saldo tidak berubah", async () => {
    baru();
    ctx.tutup = true;
    for (const [rute, badan, ekstra] of [
      [perkiraanRute, { fitur: "D1", bahan: BAHAN }, undefined],
      [kirimPesanRute, { fitur: "D1", bahan: BAHAN }, { params: Promise.resolve({ id: idPercakapan }) }],
      [kirimPesanRute, { pemicu: "duduk-perkara", bahan: BAHAN }, { params: Promise.resolve({ id: idPercakapan }) }],
    ] as const) {
      const r = await (rute as (r: NextRequest, e?: unknown) => Promise<Response>)(permintaan(badan), ekstra);
      expect(r.status).toBe(403);
      const j = await r.json();
      expect(j.error.message).toBe(PESAN_TUTUP);
    }
    expect(klien.panggilan).toHaveLength(0);
  });

  it("aplikasi dibuka: pesan panel berjalan (SSE) dan memotong saldo menurut aturan; chat biasa tidak terpengaruh pemeriksaan panel", async () => {
    baru();
    const r = await kirimPesanRute(permintaan({ fitur: "D1", bahan: BAHAN }), { params: Promise.resolve({ id: idPercakapan }) });
    expect(r.status).toBe(200);
    const teks = await r.text();
    expect(teks).toContain('"jenis":"selesai"');
    expect(klien.panggilan).toHaveLength(1);
    // Chat biasa (tanpa fitur/bahan) memakai jalur lama: tidak menjalankan pemeriksaan Akses Menu tambahan.
    ctx.tutup = true;
    const biasa = await kirimPesanRute(permintaan({ teks: "halo" }), { params: Promise.resolve({ id: idPercakapan }) });
    expect(biasa.status).toBe(200);
  });

  it("ApiError 403 dari rute membawa status; pelaku tanpa saldo ditolak dengan kalimat saldo (hak dan saldo sama-sama dinilai)", async () => {
    baru();
    const miskin: PelakuAi = { ...hakim, id: "usr-miskin-akses" };
    ctx.pelaku = miskin;
    const id = (await buatPercakapan(db, miskin.id)).id;
    const r = await kirimPesanRute(permintaan({ fitur: "D1", bahan: BAHAN }), { params: Promise.resolve({ id }) });
    const teks = await r.text();
    expect(teks).toMatch(/Saldo ALETA Ai Anda .* tidak cukup/);
    expect(klien.panggilan).toHaveLength(0);
    ctx.pelaku = hakim;
    expect(new ApiError(403, "x").status).toBe(403);
  });
});
