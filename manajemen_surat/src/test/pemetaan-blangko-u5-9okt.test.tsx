/**
 * ============================================================================
 * PEMETAAN BLANGKO - AUDIT U5, 9 OKTOBER 2026
 * ============================================================================
 *
 * Empat cacat yang terbukti merah sebelum perbaikannya:
 *
 *   1. jurusita.js jurusitaSebutan menebak sebutan dari kata (/Pdt.P/ atau
 *      "cerai talak") - Izin Poligami (jenis 341, bernomor /Pdt.G/) tercetak
 *      "Penggugat/Tergugat" dan memakai kunci panggilan-tergugat. Kini memakai
 *      alur/jenis_perkara_id dari rincian bot (aturan #0046#/#0047#, kembaran
 *      lib/sebutan-pihak.ts), cadangan kata termasuk /poligami/.
 *   2. Dialog Cetak relaas: dokumen "tidak-diketahui" yang dipilihkan "Kedua
 *      pihak" dicetak dengan blangko gabungan 3.b - tab Juru Sita ekstensi
 *      mencetak dokumen yang sama per pihak. Kini dipecah (P dan T).
 *   3. blangkoMenurutPemetaan hanya mencari di satu peta: kunci PBT di tab
 *      Relaas (atau sebaliknya) dipakai ekstensi, diabaikan portal.
 *   4. Layar admin: mengubah Catatan pada baris bawaan menghapus nama berkas
 *      (Simpan = perintah hapus, catatan hilang).
 *
 * Uji dua arah: Pemohon DAN Penggugat, sisi 1 DAN sisi 2 - cacat sebutan yang
 * tertukar selalu benar pada satu arah (lihat memori pelaku-lawan-terbalik).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nilaiCetakDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak";
import { blangkoMenurutPemetaan, pecahPilihanKeduanya } from "@/app/api/aleta-ecourt/relaas-massal/cetak/pemetaan-cetak";
import { AletaEcourtPemetaanBlangko } from "@/components/portal/aleta-ecourt-pemetaan-blangko";
import { KUNCI_BAKU, bawaanPemetaan, kapanDipakai } from "@/lib/pemetaan-blangko";
import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import type { DokumenRelaasCetakGateway, RelaasCetakGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

// ============================================================================
// PALSU untuk dialog Cetak relaas (rute cetak dijalankan sungguhan)
// ============================================================================
const keadaan = vi.hoisted(() => ({
  gateway: null as null | (() => Promise<unknown>),
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA" },
    currentUser: { id: "u1", name: "Andi Rahman, S.H.", roleId: "jurusita" } as Record<string, unknown> | null,
    positions: [] as unknown[],
  },
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Penguji" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/lib/app-state", () => ({ usePortal: () => keadaan.portal }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) => createElement("a", { href, ...sisa }, children as never),
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return {
    ...mod,
    getGatewayRelaasCetak: async () => (keadaan.gateway ? keadaan.gateway() : { ok: false, error: "tanpa jembatan" }),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.aletaRelaas;
  delete document.documentElement.dataset.aletaEkstensi;
});

const berkasUntuk = (k: string, pihak: string) => BLANGKO_RELAAS.find((x) => x.keadaan === k && x.pihak === pihak)!.berkas;
const GABUNGAN = berkasUntuk("sidang-pertama", "keduanya");
const DITUNDA_P = berkasUntuk("sidang-ditunda", "pertama");
const DITUNDA_T = berkasUntuk("sidang-ditunda", "kedua");

// ============================================================================
// 1. jurusita.js - sebutan dari NOMOR
// ============================================================================
const SUMBER_JURUSITA = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/jurusita.js"), "utf8");

function muatJurusita() {
  const ctx: Record<string, unknown> = { console, globalThis: {} };
  vm.createContext(ctx);
  vm.runInContext(
    `${SUMBER_JURUSITA}\n;globalThis.__u = { jurusitaSebutan, jurusitaSusunDokumen, jurusitaPilihBlangko, jurusitaPermintaan };`,
    ctx
  );
  return (ctx.globalThis as { __u: Record<string, (...a: unknown[]) => any> }).__u;
}

describe("1. jurusitaSebutan: aturan #0046#/#0047# lewat alur/jenis_perkara_id", () => {
  const KASUS = [
    // [nomor, jenis nama, alur, jenis id]
    ["12/Pdt.G/2026/PA.Dgl", "Izin Poligami", 15, 341],
    ["13/Pdt.G/2026/PA.Dgl", "Cerai Talak", 15, 346],
    ["14/Pdt.G/2026/PA.Dgl", "Cerai Gugat", 15, 347],
    ["15/Pdt.P/2026/PA.Dgl", "Pengesahan Perkawinan/Istbat Nikah", 16, 360],
    // Itsbat beralur GUGATAN (79 perkara satker) - Penggugat, meski namanya "permohonan".
    ["16/Pdt.G/2026/PA.Dgl", "Pengesahan Perkawinan/Istbat Nikah", 15, 360],
  ] as const;

  it("dengan id: sama dengan sebutanPihakPerkara di kelima kasus (dua arah)", () => {
    const u = muatJurusita();
    for (const [nomor, nama, alur, jenis] of KASUS) {
      const lib = sebutanPihakPerkara({ nomorPerkara: nomor, jenisPerkaraNama: nama, alurPerkaraId: alur, jenisPerkaraId: jenis });
      const ext = u.jurusitaSebutan(nomor, nama, alur, jenis);
      expect([ext.pertama, ext.kedua], `${nomor} ${nama}`).toEqual([lib.satu, lib.dua]);
      expect(ext.k1).toBe(lib.satu.toLowerCase());
      expect(ext.k2).toBe(lib.dua.toLowerCase());
    }
  });

  it("tanpa id (bot lama): cadangan kata mengenali poligami; Cerai Gugat tetap Penggugat", () => {
    const u = muatJurusita();
    expect(u.jurusitaSebutan("12/Pdt.G/2026/PA.Dgl", "Izin Poligami").pertama).toBe("Pemohon");
    expect(u.jurusitaSebutan("13/Pdt.G/2026/PA.Dgl", "Cerai Talak").kedua).toBe("Termohon");
    expect(u.jurusitaSebutan("15/Pdt.P/2026/PA.Dgl", "Dispensasi Kawin").pertama).toBe("Pemohon");
    expect(u.jurusitaSebutan("14/Pdt.G/2026/PA.Dgl", "Cerai Gugat").pertama).toBe("Penggugat");
    expect(u.jurusitaSebutan("14/Pdt.G/2026/PA.Dgl", "Cerai Gugat").kedua).toBe("Tergugat");
  });

  it("tab Juru Sita per perkara: Izin Poligami -> kunci termohon/pemohon; Cerai Gugat -> tergugat/penggugat", () => {
    const u = muatJurusita();
    const peta = {
      relaas: {
        sumber: "server",
        peta: {
          "panggilan-tergugat": "T-TERGUGAT.rtf",
          "panggilan-termohon": "T-TERMOHON.rtf",
          "panggilan-penggugat": "P-PENGGUGAT.rtf",
          "panggilan-pemohon": "P-PEMOHON.rtf",
        },
      },
      pbt: { sumber: "server", peta: {} },
    };
    const susun = (jenis: string, jenisId: number, sisi: 1 | 2) =>
      u.jurusitaSusunDokumen(
        {
          perkaraId: "9",
          nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
          rincian: { jenisPerkara: jenis, alurPerkaraId: 15, jenisPerkaraId: jenisId, putusan: { sudahPutus: false } },
          sidang: { urutanSidang: 3, tanggalSidang: "2026-10-20", agenda: "Pembuktian" },
          jurusita: "JS",
        },
        { panggilan: [sisi], pbt: [] },
        peta
      ).dokumen[0];
    expect(susun("Izin Poligami", 341, 2)).toMatchObject({ label: "Panggilan Termohon", berkas: "T-TERMOHON.rtf" });
    expect(susun("Izin Poligami", 341, 1)).toMatchObject({ label: "Panggilan Pemohon", berkas: "P-PEMOHON.rtf" });
    expect(susun("Cerai Gugat", 347, 2)).toMatchObject({ label: "Panggilan Tergugat", berkas: "T-TERGUGAT.rtf" });
    expect(susun("Cerai Gugat", 347, 1)).toMatchObject({ label: "Panggilan Penggugat", berkas: "P-PENGGUGAT.rtf" });
  });
});

// ============================================================================
// 2. "Kedua pihak" yang dipilih juru sita -> per pihak
// ============================================================================
function dokumen(ubah: Partial<DokumenRelaasCetakGateway>): DokumenRelaasCetakGateway {
  const dasar: DokumenRelaasCetakGateway = {
    kunci: "",
    perkaraId: 103,
    nomorPerkara: "103/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    jenisPerkaraId: 347,
    golongan: "sidang-ditunda",
    sebabMasuk: "ditunda",
    d: 2,
    sidangId: 5000,
    tanggalSidangTujuan: "2026-10-01",
    sidangAsalId: 7103,
    dihadiriOleh: 10,
    pihakDipanggil: "tidak-diketahui",
    pihakKe: null,
    jurusita: { nama: "ANDI RAHMAN, S.H., M.H.", nip: "198001012005011001", dariPenunjukan: true },
    sudahAdaRelaas: false,
    ...ubah,
  };
  dasar.kunci = ubah.kunci ?? `${dasar.golongan}:${dasar.perkaraId}:${dasar.d ?? 0}:${dasar.pihakKe ?? 0}`;
  return dasar;
}

describe("2. pihak 'Kedua pihak' dipilih juru sita: dicetak per pihak, bukan gabungan 3.b", () => {
  it("pecahPilihanKeduanya: dua dokumen, blangko P untuk sisi 1 dan blangko T untuk sisi 2", () => {
    const dok = dokumen({});
    const pecah = pecahPilihanKeduanya(dok, "keduanya", {}, {});
    expect(pecah).toHaveLength(2);
    expect(pecah.map((x) => [x.pihakDipanggil, x.pihakKe])).toEqual([
      ["pertama", 1],
      ["kedua", 2],
    ]);
    expect(new Set(pecah.map((x) => x.kunci)).size).toBe(2);
    const berkas = pecah.map((x) => nilaiCetakDokumen(x, null, { relaas: {}, pbt: {} }).blangko?.berkas);
    expect(berkas).toEqual([DITUNDA_P, DITUNDA_T]);
    expect(berkas).not.toContain(GABUNGAN);
  });

  it("tidak dipecah: pilihan satu pihak, dokumen yang pihaknya sudah tercatat, ikrar talak", () => {
    expect(pecahPilihanKeduanya(dokumen({}), "pertama", {}, {})).toEqual([]);
    expect(pecahPilihanKeduanya(dokumen({ pihakDipanggil: "kedua" }), "keduanya", {}, {})).toEqual([]);
    expect(pecahPilihanKeduanya(dokumen({ golongan: "ikrar-talak", d: 4 }), "keduanya", {}, {})).toEqual([]);
  });

  it("dialog: blangko P + T tampil, dan relaas-mulai membawa DUA dokumen per pihak", async () => {
    const data: RelaasCetakGateway = {
      ok: true,
      tanggal: "2026-09-25",
      dokumen: [dokumen({})],
      tidakPerlu: [],
      tertunda: [],
      ringkas: { dokumen: 1, perGolongan: { "sidang-ditunda": 1 }, perJurusita: {}, tidakPerlu: 0, tertunda: 0, sudahAdaRelaas: 0 },
      catatan: [],
    } as unknown as RelaasCetakGateway;
    keadaan.gateway = async () => ({ ok: true, data });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        const url = String(alamat);
        if (url.includes("/api/aleta-ecourt/relaas-massal/cetak")) {
          const mod = await import("@/app/api/aleta-ecourt/relaas-massal/cetak/route");
          return mod.GET({ nextUrl: new URL(url, "http://uji.local") } as never);
        }
        return new Response(JSON.stringify({ ok: true, data: { available: true, sidang: [] } }), { status: 200 });
      })
    );
    document.documentElement.dataset.aletaRelaas = "1";
    document.documentElement.dataset.aletaEkstensi = "1.999.0";
    const terkirim: Array<{ jenis?: string; muatan?: Record<string, unknown> }> = [];
    vi.spyOn(window, "postMessage").mockImplementation(((pesan: unknown) => {
      const p = pesan as { sumber?: string; jenis?: string; idPesan?: string; muatan?: Record<string, unknown> };
      terkirim.push(p);
      if (!p || p.sumber !== "aleta-portal") return;
      const jawaban = p.jenis === "relaas-mulai" ? { ok: false, sebab: "uji selesai" } : { ok: true, pekerjaan: null };
      setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { sumber: "aleta-ekstensi", balasan: p.idPesan, jawaban },
            origin: window.location.origin,
            source: window,
          })
        );
      }, 0);
    }) as typeof window.postMessage);

    const { DialogCetakRelaas } = await import("@/components/portal/aleta-ecourt-cetak-relaas");
    render(createElement(DialogCetakRelaas, { tanggalAwal: "2026-09-25", onTutup: vi.fn() }));
    // Rute cetak diimpor dan disusun saat pertama dipanggil - bisa belasan detik di mesin dingin.
    await waitFor(() => expect(screen.getByText("103/Pdt.G/2026/PA.Dgl")).toBeTruthy(), { timeout: 30000 });
    await userEvent.selectOptions(screen.getByLabelText("Pihak yang dipanggil untuk 103/Pdt.G/2026/PA.Dgl"), "keduanya");
    const kotak = () => screen.getByRole("checkbox", { name: /^Cetak 103\/Pdt\.G\/2026\/PA\.Dgl/ }) as HTMLInputElement;
    await waitFor(() => expect(kotak().disabled).toBe(false));
    const baris = kotak().parentElement!;
    expect(within(baris).getByText(`${DITUNDA_P} + ${DITUNDA_T}`)).toBeTruthy();
    expect(within(baris).queryByText(GABUNGAN)).toBeNull();

    await userEvent.click(kotak());
    await userEvent.click(screen.getByRole("button", { name: /^Cetak 2 dokumen$/ }));
    await waitFor(() => expect(terkirim.some((t) => t.jenis === "relaas-mulai")).toBe(true));
    const muatan = terkirim.find((t) => t.jenis === "relaas-mulai")!.muatan as { pekerjaan: { dokumen: Array<Record<string, unknown>> } };
    const dikirim = muatan.pekerjaan.dokumen;
    expect(dikirim.map((d) => d.berkas)).toEqual([DITUNDA_P, DITUNDA_T]);
    expect(new Set(dikirim.map((d) => d.kunci)).size).toBe(2);
    expect(dikirim.map((d) => String(d.nama))).toEqual([
      "103-Pdt.G-2026-PA.Dgl - panggilan sidang ke-2 pihak 1",
      "103-Pdt.G-2026-PA.Dgl - panggilan sidang ke-2 pihak 2",
    ]);
  });
});

// ============================================================================
// 3. Kunci di tab yang "salah" - portal = ekstensi
// ============================================================================
describe("3. kunci PBT di tab Relaas (dan sebaliknya) dipakai portal seperti ekstensi", () => {
  const SEBUT = { pertama: "Penggugat", kedua: "Tergugat", k1: "penggugat", k2: "tergugat" };

  it("pemberitahuan-putusan-penggugat di tab Relaas", () => {
    const kunci = "pemberitahuan-putusan-penggugat";
    expect(kapanDipakai("relaas", kunci).dipakai).toMatch(/Pemberitahuan isi putusan kepada Penggugat/);
    const portal = blangkoMenurutPemetaan(
      { golongan: "pemberitahuan-putusan", pihakDipanggil: "pertama", alurPerkaraId: 15, sebutanPihak: { pertama: "Penggugat", kedua: "Tergugat" } },
      { [kunci]: "PBT-KHUSUS.rtf" },
      {}
    );
    const u = muatJurusita();
    const ext = u.jurusitaPilihBlangko(
      { relaas: { sumber: "server", peta: { [kunci]: "PBT-KHUSUS.rtf" } }, pbt: { sumber: "server", peta: {} } },
      "pbt",
      u.jurusitaPermintaan("pemberitahuan-putusan", 1, SEBUT)
    );
    expect(ext?.berkas, "ekstensi").toBe("PBT-KHUSUS.rtf");
    expect(portal?.berkas, "portal").toBe("PBT-KHUSUS.rtf");
  });

  it("panggilan-tergugat di tab Pemberitahuan putusan; sisi lain tidak ikut terpengaruh", () => {
    const doc = (pihak: string) => ({
      golongan: "sidang-ditunda",
      pihakDipanggil: pihak,
      alurPerkaraId: 15,
      sebutanPihak: { pertama: "Penggugat", kedua: "Tergugat" },
    });
    expect(blangkoMenurutPemetaan(doc("kedua"), {}, { "panggilan-tergugat": "T-DARI-TAB-PBT.rtf" })?.berkas).toBe("T-DARI-TAB-PBT.rtf");
    expect(blangkoMenurutPemetaan(doc("pertama"), {}, { "panggilan-tergugat": "T-DARI-TAB-PBT.rtf" })).toBeNull();
    // Kunci PBT tidak pernah menjadi blangko panggilan, dan sebaliknya.
    expect(blangkoMenurutPemetaan(doc("kedua"), { "pbt-tergugat": "PBT-T.rtf" }, {})).toBeNull();
  });
});

// ============================================================================
// 4. Layar admin - catatan baris bawaan
// ============================================================================
describe("4. layar Pemetaan blangko: mengubah Catatan baris bawaan", () => {
  let dikirim: Array<{ jenis: string; butir: Array<{ kunci: string; namaBerkas: string; catatan: string }> }> = [];
  const jawabanRelaas = () => {
    const butir = bawaanPemetaan("relaas").map((b) => ({ ...b, diubahPada: null, diubahOleh: "", sumber: "bawaan" }));
    return {
      jenis: "relaas",
      butir,
      diubahPada: null,
      label: "Relaas panggilan",
      kunciBaku: KUNCI_BAKU.relaas,
      saran: [],
      bolehMengubah: true,
      kapan: Object.fromEntries(butir.map((b) => [b.kunci, kapanDipakai("relaas", b.kunci)])),
    };
  };
  beforeEach(() => {
    dikirim = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if ((init?.method || "GET") === "PUT") dikirim.push(JSON.parse(String(init?.body || "{}")));
        return new Response(JSON.stringify({ ok: true, data: jawabanRelaas() }), { status: 200 });
      })
    );
  });

  it("nama berkas bawaan tetap tampak dan ikut terkirim bersama catatannya", async () => {
    render(<AletaEcourtPemetaanBlangko />);
    fireEvent.click(await screen.findByRole("tab", { name: "Relaas panggilan" }));
    const kunci = "panggilan-tergugat";
    const baris = await waitFor(() => {
      const b = document.querySelector(`tr[data-kunci="${kunci}"]`) as HTMLElement | null;
      expect(b).toBeTruthy();
      return b!;
    });
    const [inputNama, inputCatatan] = Array.from(baris.querySelectorAll("input")) as HTMLInputElement[];
    const namaBawaan = inputNama.value;
    expect(namaBawaan).toBe(DITUNDA_T);
    fireEvent.change(inputCatatan, { target: { value: "dipakai juru sita pos" } });
    expect((baris.querySelectorAll("input")[0] as HTMLInputElement).value).toBe(namaBawaan);
    fireEvent.click(screen.getByRole("button", { name: "Simpan pemetaan" }));
    await waitFor(() => expect(dikirim).toHaveLength(1));
    expect(dikirim[0]).toEqual({ jenis: "relaas", butir: [{ kunci, namaBerkas: namaBawaan, catatan: "dipakai juru sita pos" }] });
  });

  it("mengubah NAMA baris bawaan tetap seperti dulu (yang diketik yang terkirim)", async () => {
    render(<AletaEcourtPemetaanBlangko />);
    fireEvent.click(await screen.findByRole("tab", { name: "Relaas panggilan" }));
    const baris = await waitFor(() => {
      const b = document.querySelector('tr[data-kunci="panggilan-penggugat"]') as HTMLElement | null;
      expect(b).toBeTruthy();
      return b!;
    });
    fireEvent.change(baris.querySelectorAll("input")[0] as HTMLInputElement, { target: { value: "[JS] P khusus.rtf" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan pemetaan" }));
    await waitFor(() => expect(dikirim).toHaveLength(1));
    expect(dikirim[0].butir).toEqual([{ kunci: "panggilan-penggugat", namaBerkas: "[JS] P khusus.rtf", catatan: expect.any(String) }]);
  });
});
