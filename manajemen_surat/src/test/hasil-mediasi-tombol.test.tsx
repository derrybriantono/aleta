import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GatewayJadwalMediasi } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * TOMBOL "BUAT HASIL MEDIASI (.rtf)" - HANYA MEDIATOR, DIGAMBAR DAN DIKLIK
 * ============================================================================
 *
 * Rute portal /api/aleta-ecourt/jadwal-mediasi dan /api/aleta-ecourt/
 * hasil-mediasi dijalankan SUNGGUHAN; yang dipalsukan hanya jembatan bot,
 * kewenangan, dan basis data. Nama orang di sini karangan.
 */

type Aktor = { id: string; name: string; roleId: string; isActive: boolean };
const keadaan: { mediasi: GatewayJadwalMediasi[]; aktor: Aktor; tulisan: unknown[][] } = {
  mediasi: [],
  aktor: { id: "usr_med", name: "Ahmad Contoh", roleId: "hakim", isActive: true },
  tulisan: [],
};

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    prepare: () => ({
      all: async () => [],
      run: async (...nilai: unknown[]) => {
        keadaan.tulisan.push(nilai);
        return {};
      },
    }),
  }),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => keadaan.aktor,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return {
    ...mod,
    getGatewayJadwalMediasi: async (p: { cari?: string }) => ({
      ok: true,
      data: {
        ok: true,
        dari: "2026-10-07",
        sampai: "2026-10-07",
        terbaca: true,
        alasan: "",
        mediasi: keadaan.mediasi.filter((x) => !p.cari || x.nomorPerkara.includes(p.cari)),
      },
    }),
    getGatewayIdentitasPihak: async () => ({
      ok: true,
      data: {
        ok: true,
        pihak: [
          { pihakKe: 1, nama: "Siti Contoh binti Rolla", kelamin: "Perempuan", umur: 30, agama: "Islam", pekerjaan: "Ibu Rumah Tangga", alamat: "Tibo" },
          { pihakKe: 2, nama: "Darwis Contoh bin Dahlan", kelamin: "Laki-laki", umur: 33, agama: "Islam", pekerjaan: "Petani", alamat: "Tibo" },
        ],
      },
    }),
    getGatewayPraperiksaFakta: async () => ({ ok: true, data: { anak: ["Aisyah Contoh"], majelis: [] } }),
  };
});

import { AletaEcourtMediasi } from "@/components/portal/aleta-ecourt-mediasi";

function mediasi(sebagian: Partial<GatewayJadwalMediasi> & { nomorPerkara: string }): GatewayJadwalMediasi {
  return {
    mediasiId: `m-${sebagian.nomorPerkara}`,
    perkaraId: `p-${sebagian.nomorPerkara}`,
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    jenisPerkaraId: 347,
    tanggal: "2026-10-07",
    jam: "09:00",
    sampaiJam: "",
    tempat: "Ruang mediasi",
    dihadiri: "",
    ditunda: false,
    mediator: "",
    statusMediator: "H",
    jenisMediasi: "",
    nomorSk: "",
    penetapanMediator: "2026-10-01",
    laporanMediator: "",
    selesai: false,
    hasil: "",
    hasilTeks: "",
    lamaHari: null,
    tenggatPerma: "",
    sisaHariTenggat: null,
    lewatTenggang: false,
    pihak: { penggugat: ["Siti Contoh binti Rolla"], tergugat: ["Darwis Contoh bin Dahlan"] },
    ...sebagian,
  };
}

const DATA = [
  mediasi({ nomorPerkara: "601/Pdt.G/2026/PA.Dgl", mediator: "Drs. H. Ahmad Contoh, M.H." }),
  mediasi({ nomorPerkara: "602/Pdt.G/2026/PA.Dgl", mediator: "Herlina Contoh, S.H., M.H." }),
];

async function jalankanRute(alamat: string, init?: RequestInit) {
  const url = new URL(alamat, "http://uji.local");
  if (url.pathname.includes("/api/aleta-ecourt/hasil-mediasi")) {
    const mod = await import("@/app/api/aleta-ecourt/hasil-mediasi/route");
    if (init?.method === "POST") {
      const permintaan = { nextUrl: url, json: async () => JSON.parse(String(init.body)) };
      return mod.POST(permintaan as unknown as Parameters<typeof mod.POST>[0]);
    }
    return mod.GET({ nextUrl: url } as unknown as Parameters<typeof mod.GET>[0]);
  }
  const mod = await import("@/app/api/aleta-ecourt/jadwal-mediasi/route");
  return mod.GET({ nextUrl: url } as unknown as Parameters<typeof mod.GET>[0]);
}

function pasangFetch() {
  keadaan.mediasi = DATA;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string, init?: RequestInit) => {
      const url = String(alamat);
      if (url.includes("/api/aleta-ecourt/jadwal-mediasi") || url.includes("/api/aleta-ecourt/hasil-mediasi")) {
        return jalankanRute(url, init);
      }
      return { ok: true, status: 200, json: async () => ({ data: { baris: [], peta: {} } }) } as unknown as Response;
    })
  );
}

async function gambar(pengguna: { nama: string; peran: string } | null) {
  pasangFetch();
  render(createElement(AletaEcourtMediasi, { pengguna: pengguna ? { ...pengguna, namaPengadilan: "Pengadilan Agama Donggala" } : null }));
  await waitFor(() => expect(screen.getByText(DATA[0].nomorPerkara)).toBeTruthy(), { timeout: 20_000 });
}

function tombolHasil(nomor: string) {
  return document.querySelector(`[data-tombol-hasil-mediasi="${nomor}"]`);
}

beforeEach(() => {
  window.localStorage.clear();
  keadaan.tulisan = [];
  keadaan.aktor = { id: "usr_med", name: "Ahmad Contoh", roleId: "hakim", isActive: true };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("siapa yang melihat tombol Buat hasil mediasi", () => {
  it("mediator perkara itu melihatnya HANYA pada perkaranya", async () => {
    await gambar({ nama: "Ahmad Contoh", peran: "hakim" });
    expect(tombolHasil("601/Pdt.G/2026/PA.Dgl")).toBeTruthy();
    expect(tombolHasil("602/Pdt.G/2026/PA.Dgl")).toBeNull();
  });

  it("hakim lain, panitera, dan admin biasa tidak melihatnya", async () => {
    for (const p of [
      { nama: "Budi Lain", peran: "hakim" },
      { nama: "Panitera Contoh", peran: "panitera" },
      { nama: "Admin Satker", peran: "admin" },
    ]) {
      await gambar(p);
      expect(document.querySelectorAll("[data-tombol-hasil-mediasi]").length, p.peran).toBe(0);
      cleanup();
    }
  });

  it("Super Admin melihatnya di setiap baris (untuk uji)", async () => {
    await gambar({ nama: "Pengembang", peran: "super-admin" });
    expect(document.querySelectorAll("[data-tombol-hasil-mediasi]").length).toBe(2);
  });

  it("tanpa data pengguna (layar lama) tidak ada tombol", async () => {
    await gambar(null);
    expect(document.querySelectorAll("[data-tombol-hasil-mediasi]").length).toBe(0);
  });

  it("saklar Tampilan menyembunyikan dan menampilkannya kembali, dan diingat peramban", async () => {
    await gambar({ nama: "Ahmad Contoh", peran: "hakim" });
    fireEvent.click(document.querySelector("[data-tampilan-mediasi]")!);
    const saklar = document.querySelector('[data-saklar-mediasi="tombol-hasil-mediasi"]') as HTMLInputElement;
    expect(saklar.checked).toBe(true);
    fireEvent.click(saklar);
    expect(tombolHasil("601/Pdt.G/2026/PA.Dgl")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("aleta.jadwal-mediasi.tampilan") || "{}")["tombol-hasil-mediasi"]).toBe(false);
    fireEvent.click(saklar);
    expect(tombolHasil("601/Pdt.G/2026/PA.Dgl")).toBeTruthy();
  });
});

describe("pop-up: mut'ah, Tergugat, Rp1.000.000", () => {
  it("klik mut'ah, klik Tergugat, isi 1.000.000 -> pratinjau pasal + terbilang; draf tersimpan", async () => {
    await gambar({ nama: "Ahmad Contoh", peran: "hakim" });
    fireEvent.click(tombolHasil("601/Pdt.G/2026/PA.Dgl")!);
    const dialog = await waitFor(() => {
      const d = document.querySelector("[data-hasil-mediasi]") as HTMLElement;
      expect(d).toBeTruthy();
      expect(d.querySelector('[data-hasil="berhasil-sebagian"]')).toBeTruthy();
      return d;
    }, { timeout: 20_000 });

    fireEvent.click(dialog.querySelector('[data-hasil="berhasil-sebagian"] input')!);
    fireEvent.click(within(dialog).getByRole("tab", { name: "2. Butir kesepakatan" }));
    const kartu = dialog.querySelector('[data-butir="mutah"]') as HTMLElement;
    fireEvent.click(within(kartu).getByRole("checkbox", { name: "Mut’ah" }));
    fireEvent.click(within(kartu).getByRole("radio", { name: "Tergugat" }));
    fireEvent.change(kartu.querySelector('[data-medan="nominal"]')!, { target: { value: "1000000" } });
    expect((kartu.querySelector('[data-medan="nominal"]') as HTMLInputElement).value).toBe("1.000.000");
    expect(within(kartu).getByText("satu juta rupiah")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("tab", { name: "4. Pratinjau & unduh" }));
    const pratinjau = dialog.querySelector("[data-pratinjau-pasal]") as HTMLElement;
    expect(pratinjau.textContent).toContain(
      "Pihak II (Tergugat) sepakat untuk memberikan mut’ah kepada Pihak I (Penggugat) berupa uang sejumlah Rp1.000.000,00 (satu juta rupiah)."
    );
    expect(dialog.querySelector("[data-nama-berkas]")?.textContent).toBe(
      "601_Pdt.G_2026_PA.Dgl - Laporan Mediasi Berhasil Sebagian.rtf"
    );

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: /Simpan draf/ }));
    });
    await waitFor(() => expect(within(dialog).getByText(/Draf tersimpan/)).toBeTruthy(), { timeout: 10_000 });
    const [penggunaId, kunci, json] = keadaan.tulisan.at(-1) as [string, string, string];
    expect(penggunaId).toBe("usr_med");
    expect(kunci).toBe("portal:hasil-mediasi:p-601/Pdt.G/2026/PA.Dgl");
    expect(JSON.parse(json).butir.mutah).toMatchObject({ aktif: true, pihak: "dua", nominal: 1_000_000 });
  }, 60_000);
});

describe("rute memeriksa mediatornya sendiri", () => {
  it("akun yang bukan mediator ditolak 403 walau mengetik alamatnya langsung", async () => {
    keadaan.mediasi = DATA;
    keadaan.aktor = { id: "usr_lain", name: "Budi Lain", roleId: "hakim", isActive: true };
    await expect(jalankanRute("/api/aleta-ecourt/hasil-mediasi?nomorPerkara=601%2FPdt.G%2F2026%2FPA.Dgl")).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      jalankanRute("/api/aleta-ecourt/hasil-mediasi", {
        method: "POST",
        body: JSON.stringify({ nomorPerkara: "601/Pdt.G/2026/PA.Dgl", draf: { hasil: "tidak-berhasil" } }),
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(keadaan.tulisan).toEqual([]);
  });

  it("mediatornya mendapat bahan SIPP: pihak, anak, pertemuan", async () => {
    keadaan.mediasi = DATA;
    const jawaban = await jalankanRute("/api/aleta-ecourt/hasil-mediasi?nomorPerkara=601%2FPdt.G%2F2026%2FPA.Dgl");
    const isi = (await jawaban.json())?.data;
    expect(isi.bahan.mediator).toBe("Drs. H. Ahmad Contoh, M.H.");
    expect(isi.bahan.anak).toEqual(["Aisyah Contoh"]);
    expect(isi.bahan.pihak.map((p: { nama: string }) => p.nama)).toEqual(["Siti Contoh binti Rolla", "Darwis Contoh bin Dahlan"]);
    expect(isi.bahan.pertemuan[0].tanggal).toBe("2026-10-07");
    expect(isi.draf).toBeNull();
  });
});
