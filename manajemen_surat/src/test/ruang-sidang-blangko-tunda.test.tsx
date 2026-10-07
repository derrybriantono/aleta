/**
 * Butir 25 (5 Okt 2026): blangko "Tunda sidang" dan "Catat putusan" Jadwal
 * Sidang menanyakan RUANG SIDANG (bawaan: yang tercatat) dan SIDANG KELILING
 * (bawaan kosong, tercentang hanya bila sidang itu memang keliling), dan
 * keduanya ditulis ke perkara_jadwal_sidang seperti blangko tunda SIPP
 * (jadwal_sidang_c.php: ruangan_id + ruangan + sidang_keliling 'Y'/'T').
 *
 * Perilaku: fungsi murni, layanan bot atas basis data tiruan (rencana SQL-nya
 * dijalankan penyusunnya sungguhan), dan blangko dirender dengan fetch tiruan.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bawaanRuangSidang, kelilingUntukRuangan, muatanRuangSidang } from "@/lib/ruang-sidang-blangko";
import type { Ruangan } from "@/lib/ruangan-sidang";
import { CatatHasilRingkas } from "@/components/portal/hasil-sidang";

// Daftar ruangan_sidang sipp_donggala (diukur 5 Okt 2026), sebagian.
const RUANGAN: Ruangan[] = [
  { id: 1, kode: "101", nama: "Ruang Sidang 1 Dalam Gedung", benderaKeliling: false, aktif: true },
  { id: 2, kode: "102", nama: "Ruang Sidang 2 Dalam Gedung", benderaKeliling: false, aktif: true },
  { id: 3, kode: "201", nama: "Sidang Keliling Sigi Biromaru", benderaKeliling: true, aktif: true },
  { id: 5, kode: "301", nama: "Terpadu Sigi Biromaru", benderaKeliling: false, aktif: true },
];

describe("bawaan ruang sidang blangko", () => {
  it("ruangan yang tercatat; keliling hanya bila sidang itu keliling", () => {
    expect(bawaanRuangSidang({ ruanganId: 1, ruangan: "Ruang Sidang 1 Dalam Gedung", sidangKeliling: "T" }, RUANGAN)).toEqual({
      ruanganId: "1",
      keliling: false,
    });
    expect(bawaanRuangSidang({ ruanganId: 3, ruangan: "Sidang Keliling Sigi Biromaru", sidangKeliling: "T" }, RUANGAN).keliling).toBe(true);
    expect(bawaanRuangSidang({ ruanganId: 1, ruangan: "Ruang Sidang 1", sidangKeliling: "Y" }, RUANGAN).keliling).toBe(true);
    // Terpadu BUKAN sidang keliling.
    expect(bawaanRuangSidang({ ruanganId: 5, ruangan: "Terpadu Sigi Biromaru", sidangKeliling: "T" }, RUANGAN).keliling).toBe(false);
    // Ruangan yang tidak ada di daftar aktif: tetap seperti tercatat ("").
    expect(bawaanRuangSidang({ ruanganId: 99, ruangan: "Ruang Lama", sidangKeliling: "T" }, RUANGAN).ruanganId).toBe("");
  });

  it("keliling mengikuti ruangan; muatan per jalan", () => {
    expect(kelilingUntukRuangan(RUANGAN, "3")).toBe(true);
    expect(kelilingUntukRuangan(RUANGAN, "2")).toBe(false);
    expect(muatanRuangSidang({ ruanganId: "3", keliling: true }, "tunda")).toEqual({ ruanganIdBerikut: 3, sidangKelilingBerikut: true });
    expect(muatanRuangSidang({ ruanganId: "", keliling: false }, "putus")).toEqual({ sidangKelilingSidang: false });
  });
});

// ============================================================================
// LAYANAN BOT - BASIS DATA TIRUAN
// ============================================================================

const AKAR_BOT = path.resolve(__dirname, "../../../aleta_bot");
const muat = createRequire(path.join(AKAR_BOT, "package.json"));

type Kueri = { sql: string; nilai: unknown[] };
let catatan: Kueri[] = [];

function jawab(sql: string, nilai: unknown[]): unknown[] {
  if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-05 10:24:00" }];
  if (/information_schema\.COLUMNS/.test(sql)) return [{ tabel: "ruangan_sidang", kolom: "id" }];
  if (/FROM ruangan_sidang WHERE id = \?/.test(sql)) {
    const r = RUANGAN.find((x) => x.id === Number(nilai[0]));
    return r ? [{ id: r.id, nama: r.nama, keliling: r.benderaKeliling ? "1" : "0" }] : [];
  }
  if (/FROM perkara_jadwal_sidang j\s+JOIN perkara p/.test(sql)) {
    return [
      {
        jadwalId: 20500,
        perkaraId: 9900,
        tanggalSidang: "2026-10-05",
        jamSidang: "09:00:00",
        sampaiJam: null,
        agenda: "Pembacaan Gugatan",
        urutan: 2,
        ditunda: "T",
        alasanDitunda: "0",
        ruanganId: 1,
        ruangan: "Ruang Sidang 1 Dalam Gedung",
        sidangKeliling: "T",
        sifatSidang: "Y",
        dihadiriOleh: null,
        verzet: "T",
        keberatan: "T",
        ikrarTalak: "T",
        nomorPerkara: "609/Pdt.G/2026/PA.Dgl",
        alurPerkaraId: 15,
        jenisPerkaraId: 347,
        jenisPerkara: "Cerai Gugat",
      },
    ];
  }
  if (/FROM perkara_panitera_pn/.test(sql)) return [{ username: "sitti", fullname: "Sitti Nurhidayah" }];
  if (/FROM perkara_hakim_pn/.test(sql)) return [{ username: "himawan", fullname: "Himawan" }];
  if (/FROM status_putusan/.test(sql)) return [{ id: 62, nama: "Dikabulkan" }];
  return [];
}

function pasangTiruan() {
  for (const kunci of Object.keys(muat.cache)) {
    if (kunci.startsWith(AKAR_BOT) && !kunci.includes("node_modules")) delete muat.cache[kunci];
  }
  const dbPalsu = {
    query(sql: string, nilai: unknown, cb?: (e: unknown, r: unknown) => void) {
      const selesai = typeof nilai === "function" ? (nilai as (e: unknown, r: unknown) => void) : cb;
      const daftar = Array.isArray(nilai) ? nilai : [];
      catatan.push({ sql: String(sql), nilai: daftar });
      selesai?.(null, jawab(String(sql), daftar));
    },
  };
  // 7 Okt 2026 (kasus 273): hasil sidang ditulis dalam SATU transaksi lewat
  // satu sambungan kolam - sambungan palsunya meneruskan ke kueri yang sama.
  (dbPalsu as Record<string, unknown>).getConnection = (cb: (e: unknown, s: unknown) => void) =>
    cb(null, { query: dbPalsu.query, release() {} });
  const antrianPalsu = { query: async () => [], sanitizeError: (g: unknown) => String(g) };
  const botDbPalsu = { query: async () => [], fromMysqlDate: () => null, toMysqlDate: () => null };
  for (const [relatif, isi] of [
    ["./db_config", dbPalsu],
    ["./services/botDbService", botDbPalsu],
    ["./services/externalDbService", antrianPalsu],
  ] as const) {
    const berkas = muat.resolve(relatif);
    muat.cache[berkas] = { id: berkas, filename: berkas, loaded: true, exports: isi } as unknown as NodeJS.Module;
  }
}

type Langkah = { tabel: string; aksi: string; sql: string; params: unknown[] };
type Rencana = { ok: boolean; alasan?: string; langkah: Langkah[] };
function layanan() {
  return muat("./services/sidangHasilService.js") as {
    susunRencanaTunda: (m: Record<string, unknown>) => Promise<Rencana>;
    susunRencanaPutus: (m: Record<string, unknown>) => Promise<Rencana>;
  };
}

describe("bot: ruang sidang + sidang keliling ditulis ke perkara_jadwal_sidang", () => {
  beforeEach(() => {
    catatan = [];
    pasangTiruan();
  });
  afterEach(() => {
    for (const kunci of Object.keys(muat.cache)) {
      if (kunci.startsWith(AKAR_BOT) && !kunci.includes("node_modules")) delete muat.cache[kunci];
    }
  });

  const tunda = {
    jadwalId: 20500,
    alasanTunda: "Pemanggilan Tergugat",
    tanggalBerikut: "2026-10-19",
    jamBerikut: "09:00",
    agendaBerikut: "Pembacaan Gugatan",
    dihadiriOleh: 2,
    operator: "usr",
    ip: "",
  };
  const sisip = (r: Rencana) => r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang" && l.aksi === "INSERT")!;

  it("tunda: sidang BERIKUTNYA memakai ruangan + sidang keliling yang dipilih, nama ruangan dari ruangan_sidang", async () => {
    const r = await layanan().susunRencanaTunda({ ...tunda, ruanganIdBerikut: 3, sidangKelilingBerikut: true });
    expect(r.ok).toBe(true);
    const p = sisip(r).params;
    expect(p[5]).toBe(3);
    expect(p[6]).toBe("Sidang Keliling Sigi Biromaru");
    expect(p[7]).toBe("Y");
  });

  it("tunda tanpa pilihan: disalin dari sidang ini, seperti semula", async () => {
    const r = await layanan().susunRencanaTunda(tunda);
    const p = sisip(r).params;
    expect([p[5], p[6], p[7]]).toEqual([1, "Ruang Sidang 1 Dalam Gedung", "T"]);
  });

  it("tunda: ruangan yang tidak dikenal ditolak", async () => {
    const r = await layanan().susunRencanaTunda({ ...tunda, ruanganIdBerikut: 99 });
    expect(r).toMatchObject({ ok: false, alasan: "ruangan_sidang_tidak_dikenal" });
  });

  const putus = { jadwalId: 20500, statusPutusanId: 62, tanggalPutus: "2026-10-05", verstek: "T", dihadiriOleh: 4, operator: "usr", ip: "" };

  it("putus: ruangan/keliling sidang INI ditulis bila berubah - kolom lain tetap", async () => {
    const r = await layanan().susunRencanaPutus({ ...putus, ruanganIdSidang: 3, sidangKelilingSidang: true });
    const ubah = r.langkah[0];
    expect(ubah.sql).toMatch(/ruangan_id = \?, ruangan = \?, sidang_keliling = \?/);
    expect(ubah.params).toEqual(expect.arrayContaining([3, "Sidang Keliling Sigi Biromaru", "Y"]));
  });

  it("putus: pilihan sama dengan yang tercatat = tidak ada kolom ruangan yang ditulis", async () => {
    const r = await layanan().susunRencanaPutus({ ...putus, ruanganIdSidang: 1, sidangKelilingSidang: false });
    expect(r.langkah[0].sql).not.toMatch(/ruangan_id/);
  });
});

// ============================================================================
// BLANGKO DIRENDER
// ============================================================================

describe("blangko Tunda sidang: ruang sidang + sidang keliling", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("bawaan ruangan tercatat & tidak keliling; memilih ruangan keliling mencentangnya; nilainya ikut terkirim", async () => {
    const kiriman: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string, init?: RequestInit) => {
        const url = String(alamat);
        if (url.includes("/api/aleta-ecourt/sidang-tunda") && (!init || init.method !== "POST")) {
          return new Response(
            JSON.stringify({
              data: {
                available: true,
                ok: true,
                keadaan: {
                  jadwalId: 20500,
                  perkaraId: 9900,
                  nomorPerkara: "609/Pdt.G/2026/PA.Dgl",
                  tanggalSidang: "2026-10-05",
                  jamSidang: "09:00:00",
                  agenda: "Pembacaan Gugatan",
                  ditunda: "T",
                  ruanganId: 1,
                  ruangan: "Ruang Sidang 1 Dalam Gedung",
                  sidangKeliling: "T",
                },
                riwayat: null,
                ruangan: RUANGAN,
              },
            })
          );
        }
        if (url.includes("/api/aleta-ecourt/sidang-tunda")) {
          kiriman.push(JSON.parse(String(init?.body)));
          return new Response(JSON.stringify({ data: { ok: true, kering: false } }));
        }
        return new Response(JSON.stringify({ data: {} }));
      })
    );
    render(
      createElement(CatatHasilRingkas, {
        jadwalId: "20500",
        nomorPerkara: "609/Pdt.G/2026/PA.Dgl",
        jalan: "tunda",
        onTutup: () => undefined,
        onSelesai: () => undefined,
      })
    );
    const ruang = (await screen.findByLabelText("Ruang sidang berikutnya", {}, { timeout: 10000 })) as HTMLSelectElement;
    const keliling = screen.getByLabelText("Sidang keliling") as HTMLInputElement;
    expect(ruang.value).toBe("1");
    expect(keliling.checked).toBe(false);

    fireEvent.change(ruang, { target: { value: "3" } });
    expect(keliling.checked).toBe(true);

    // Isian wajib lainnya.
    fireEvent.change(screen.getByLabelText("Alasan penundaan"), { target: { value: "__ketik__" } });
    fireEvent.change(screen.getByLabelText("Alasan penundaan"), { target: { value: "Pemanggilan Tergugat" } });
    const agenda = screen.getByLabelText("Agenda sidang berikutnya") as HTMLSelectElement;
    if (!agenda.value) {
      fireEvent.change(agenda, { target: { value: "__ketik__" } });
      fireEvent.change(screen.getByLabelText("Agenda sidang berikutnya"), { target: { value: "Pembacaan Gugatan" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Tunda sekarang" }));
    await waitFor(() => expect(kiriman).toHaveLength(1));
    expect(kiriman[0]).toMatchObject({ ruanganIdBerikut: 3, sidangKelilingBerikut: true });
  });
});
