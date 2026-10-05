/**
 * ============================================================================
 * JADWAL MEDIASI: SEDANG BERJALAN / SELESAI - BUTIR 35 (5 OKT 2026)
 * ============================================================================
 *
 * Bot (mediasiStatusService) dijalankan atas basis data TIRUAN; layar Jadwal
 * Mediasi digambar SUNGGUHAN dengan fetch tiruan. Tidak ada yang ditulis ke
 * SIPP - dan itu ikut dijaga.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AletaEcourtMediasi } from "@/components/portal/aleta-ecourt-mediasi";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Layanan = Record<string, (x?: unknown) => Promise<Record<string, unknown>>>;
const mod = require_(path.join(AKAR, "aleta_bot/services/mediasiStatusService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  kunciMediasi: (a: string, b: string) => string;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Basis data tiruan yang SUNGGUH menyimpan baris - cukup untuk aturan tanda. */
function bdTiruan() {
  const baris: Array<Record<string, unknown>> = [];
  const sql: string[] = [];
  let id = 0;
  const kueri = async (teks: string, p: unknown[] = []) => {
    const s = teks.replace(/\s+/g, " ").trim();
    sql.push(s);
    if (s.startsWith("CREATE TABLE")) return [];
    if (s.startsWith("SELECT id, keadaan")) {
      return baris.filter((b) => b.mediasi_id === p[0] && b.tanggal === p[1] && !b.batal);
    }
    if (s.startsWith("SELECT mediasi_id")) {
      return baris
        .filter((b) => !b.batal)
        .map((b) => ({ mediasiId: b.mediasi_id, perkaraId: "", tanggal: b.tanggal, keadaan: b.keadaan, oleh: b.oleh, tempat: "", sejak: "2026-10-05 09:30:00" }));
    }
    if (s.startsWith("UPDATE")) {
      for (const b of baris) {
        if (b.mediasi_id === p[3] && b.tanggal === p[4] && b.keadaan === p[5] && !b.batal) {
          b.batal = true;
          b.alasan = p[2];
        }
      }
      return { affectedRows: 1 };
    }
    if (s.startsWith("INSERT")) {
      baris.push({ id: ++id, mediasi_id: p[0], tanggal: p[2], keadaan: p[5], oleh: p[6], batal: false });
      return { insertId: id };
    }
    return [];
  };
  return { kueri, baris, sql };
}

describe("bot: status pertemuan mediasi", () => {
  it("kering bawaan - tidak menulis apa pun", async () => {
    const bd = bdTiruan();
    const L = mod.buatLayanan({ kueriBot: bd.kueri });
    const hasil = await L.setelStatus({ mediasiId: "9", tanggal: "2026-10-05", keadaan: "berjalan", oleh: "Rina" });
    expect(hasil).toMatchObject({ ok: true, kering: true });
    expect(bd.sql.some((s) => s.startsWith("INSERT"))).toBe(false);
  });

  it("berjalan lalu selesai: tanda berjalan ditutup, riwayatnya tetap; peta menyebut selesai", async () => {
    const bd = bdTiruan();
    const L = mod.buatLayanan({ kueriBot: bd.kueri });
    await L.setelStatus({ mediasiId: "9", tanggal: "2026-10-05", keadaan: "berjalan", oleh: "Rina", kering: false });
    await L.setelStatus({ mediasiId: "9", tanggal: "2026-10-05", keadaan: "selesai", oleh: "Rina", kering: false });
    expect(bd.baris).toHaveLength(2);
    expect(bd.baris[0]).toMatchObject({ keadaan: "berjalan", batal: true, alasan: "menjadi_selesai" });
    const peta = await L.petaStatus({ dari: "2026-10-05", sampai: "2026-10-05" });
    expect((peta.peta as Record<string, { keadaan: string }>)[mod.kunciMediasi("9", "2026-10-05")].keadaan).toBe("selesai");
    // SIPP tidak pernah disentuh.
    expect(bd.sql.some((s) => /perkara_mediasi|perkara_jadwal_mediasi/.test(s))).toBe(false);
  });

  it("yang sudah selesai tidak dapat ditandai berjalan; membatalkan tidak menghapus baris", async () => {
    const bd = bdTiruan();
    const L = mod.buatLayanan({ kueriBot: bd.kueri });
    await L.setelStatus({ mediasiId: "9", tanggal: "2026-10-05", keadaan: "selesai", oleh: "Rina", kering: false });
    const tolak = await L.setelStatus({ mediasiId: "9", tanggal: "2026-10-05", keadaan: "berjalan", oleh: "Rina", kering: false });
    expect(tolak).toMatchObject({ ok: false, alasan: "sudah_selesai" });
    await L.setelStatus({ mediasiId: "9", tanggal: "2026-10-05", keadaan: "selesai", batal: true, oleh: "Rina", kering: false });
    expect(bd.baris).toHaveLength(1);
    expect(bd.baris[0].batal).toBe(true);
  });
});

// ============================================================================
// LAYAR JADWAL MEDIASI
// ============================================================================

const MEDIASI = {
  mediasiId: "9",
  perkaraId: "77",
  nomorPerkara: "77/Pdt.G/2026/PA.Dgl",
  jenisPerkara: "Cerai Gugat",
  alurPerkaraId: 15,
  jenisPerkaraId: 347,
  tanggal: new Date().toISOString().slice(0, 10),
  jam: "09:00",
  sampaiJam: "",
  tempat: "Ruang Mediasi",
  dihadiri: "",
  ditunda: false,
  mediator: "Hakim Mediator, S.H.",
  statusMediator: "H",
  jenisMediasi: "",
  nomorSk: "",
  penetapanMediator: "",
  laporanMediator: "",
  selesai: false,
  hasil: "",
  hasilTeks: "",
  lamaHari: null,
  tenggatPerma: "",
  sisaHariTenggat: null,
  lewatTenggang: false,
  pihak: { penggugat: ["Andi"], tergugat: ["Wati"] },
};

function pasangFetch(keadaan: "berjalan" | "selesai" | null) {
  const kiriman: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string, init?: RequestInit) => {
      const url = String(alamat);
      if (init?.method === "POST") kiriman.push({ url, body: JSON.parse(String(init.body)) });
      let data: unknown = { baris: [] };
      if (url.includes("/api/aleta-ecourt/jadwal-mediasi")) data = { mediasi: [MEDIASI] };
      if (url.includes("/api/aleta-ecourt/mediasi-status") && init?.method !== "POST") {
        data = {
          available: true,
          ok: true,
          peta: keadaan
            ? { [`9|${MEDIASI.tanggal}`]: { keadaan, sejak: `${MEDIASI.tanggal} 09:31:00`, oleh: "Rina" } }
            : {},
        };
      }
      if (init?.method === "POST") data = { available: true, ok: true };
      return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
    })
  );
  return kiriman;
}

async function barisMediasi() {
  render(createElement(AletaEcourtMediasi));
  await waitFor(() => expect(screen.getAllByText(MEDIASI.nomorPerkara).length).toBeGreaterThan(0), { timeout: 20_000 });
  return screen.getAllByText(MEDIASI.nomorPerkara).find((el) => el.closest("tr"))!.closest("tr") as HTMLElement;
}

describe("layar: tombol, lencana, bingkai", () => {
  it("tanda berjalan dari basis data ALETA membingkai barisnya biru dan berlencana", async () => {
    pasangFetch("berjalan");
    const tr = await barisMediasi();
    await waitFor(() => expect(tr.className).toContain("border-l-sky-500"));
    expect(within(tr).getByText(/sedang berjalan/i)).toBeTruthy();
    expect(within(tr).getByRole("button", { name: /Batalkan berjalan/ })).toBeTruthy();
  });

  it("tanda selesai membingkai hijau dan berbunyi pertemuan selesai - bukan laporan mediator", async () => {
    pasangFetch("selesai");
    const tr = await barisMediasi();
    await waitFor(() => expect(tr.className).toContain("border-l-emerald-600"));
    expect(within(tr).getByText(/pertemuan selesai/i)).toBeTruthy();
    expect(within(tr).queryByRole("button", { name: /Tandai berjalan/ })).toBeNull();
  });

  it("Tandai berjalan mengirim tanda sungguhan (kering: false) ke rute status mediasi", async () => {
    const kiriman = pasangFetch(null);
    const tr = await barisMediasi();
    fireEvent.click(within(tr).getByRole("button", { name: /Tandai berjalan/ }));
    await waitFor(() => expect(kiriman.length).toBe(1));
    expect(kiriman[0].url).toContain("/api/aleta-ecourt/mediasi-status");
    expect(kiriman[0].body).toMatchObject({ mediasiId: "9", perkaraId: "77", keadaan: "berjalan", batal: false, kering: false });
  });

  it("nama mediator dan pihak dapat diklik untuk dipanggil (butir 34/36)", async () => {
    pasangFetch(null);
    const tr = await barisMediasi();
    expect(within(tr).getByRole("button", { name: "Hakim Mediator, S.H." }).getAttribute("data-nama-panggil")).toBe("mediator");
    expect(within(tr).getByRole("button", { name: "Andi" }).getAttribute("data-nama-panggil")).toBe("pihak1");
    expect(within(tr).getByRole("button", { name: "Wati" }).getAttribute("data-nama-panggil")).toBe("pihak2");
  });
});
