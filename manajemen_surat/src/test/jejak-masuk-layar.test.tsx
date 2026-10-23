import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Layar jejak masuk & perangkat (23 Okt 2026), dirender sungguhan di jsdom:
 *   1. layar masuk: penolakan batas perangkat -> pilih perangkat -> lanjut;
 *   2. halaman Akun: "Perangkat yang sedang masuk";
 *   3. halaman admin Riwayat Masuk: ditolak bagi hakim, tab tampil bagi admin.
 */

const portal = vi.hoisted(() => ({ nilai: {} as Record<string, unknown> }));
vi.mock("@/lib/app-state", () => ({ usePortal: () => portal.nilai }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const jawab = (status: number, isi: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => isi }) as unknown as Response;

const INFO = {
  tiket: "tiket-rekaan-abcdefghijklmnop",
  pesan: "Akun ini sudah masuk di 2 perangkat (batas 2).",
  perangkat: [
    { perangkatId: "p-1", nama: "Chrome 130 · Windows 10/11", terakhirAktif: "2026-10-23T01:00:00.000Z", ip: "192.168.10.21" },
    { perangkatId: "p-2", nama: "Samsung Internet 26 · Android 14 (SM-A546E)", terakhirAktif: "2026-10-23T02:00:00.000Z", ip: "192.168.9.8" },
  ],
};

describe("layar masuk: batas perangkat penuh", () => {
  it("bacaBatasPerangkat membaca galat better-fetch (badan disebar) dan jawaban jalur SIPP", async () => {
    const { bacaBatasPerangkat, masukLewatSipp } = await import("@/lib/masuk-sipp-klien");
    expect(bacaBatasPerangkat({ status: 403, statusText: "Forbidden", code: "BATAS_PERANGKAT", message: INFO.pesan, tiket: INFO.tiket, perangkat: INFO.perangkat })).toEqual(INFO);
    expect(bacaBatasPerangkat({ code: "FORBIDDEN", message: "x" })).toBeNull();
    const hasil = await masukLewatSipp("hakim", "rekaan", true, (async () =>
      jawab(403, { code: "BATAS_PERANGKAT", message: INFO.pesan, tiket: INFO.tiket, perangkat: INFO.perangkat })) as unknown as typeof fetch);
    expect(hasil).toMatchObject({ jenis: "tolak", status: 403, batas: INFO });
  });

  it("menampilkan perangkat aktif; 'Keluarkan & lanjutkan' memakai tiket lalu melanjutkan masuk", async () => {
    const { PilihPerangkatMasuk } = await import("@/components/portal/pilih-perangkat-masuk");
    const ambil = vi.fn(async () => jawab(200, { ok: true, data: { dicabut: 1, lanjutkanMasuk: true } }));
    const onLanjut = vi.fn();
    render(createElement(PilihPerangkatMasuk, { info: INFO, onLanjut, onBatal: () => {}, ambil: ambil as unknown as typeof fetch }));
    expect(screen.getByText(INFO.pesan)).toBeTruthy();
    expect(screen.getByText(/Samsung Internet 26/)).toBeTruthy();
    expect(screen.getByText(/192\.168\.9\.8/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Keluarkan & lanjutkan/ })[1]);
    await waitFor(() => expect(onLanjut).toHaveBeenCalledTimes(1));
    const [, init] = ambil.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(ambil.mock.calls[0][0 as never])).toContain("/api/portal/perangkat/tiket");
    expect(JSON.parse(String(init.body))).toEqual({ tiket: INFO.tiket, perangkatId: "p-2" });
  });

  it("tiket kedaluwarsa: pesan tampil, masuk tidak dilanjutkan", async () => {
    const { PilihPerangkatMasuk } = await import("@/components/portal/pilih-perangkat-masuk");
    const ambil = vi.fn(async () => jawab(400, { ok: false, error: { message: "Waktu memilih perangkat (5 menit) sudah habis. Silakan masuk lagi." } }));
    const onLanjut = vi.fn();
    render(createElement(PilihPerangkatMasuk, { info: INFO, onLanjut, onBatal: () => {}, ambil: ambil as unknown as typeof fetch }));
    fireEvent.click(screen.getAllByRole("button", { name: /Keluarkan & lanjutkan/ })[0]);
    await waitFor(() => expect(screen.getByText(/5 menit\) sudah habis/)).toBeTruthy());
    expect(onLanjut).not.toHaveBeenCalled();
  });
});

describe("halaman Akun: Perangkat yang sedang masuk", () => {
  it("menandai perangkat ini, tombol keluarkan hanya untuk perangkat lain, dan mengirim perangkatId", async () => {
    const data = {
      sesiAktif: [
        { perangkatId: "p-ini", nama: "Chrome 130 · Windows 10/11", terakhirAktif: "2026-10-23T03:00:00.000Z", ip: "192.168.10.30", jumlahSesi: 1, jalur: "email", ini: true },
        { perangkatId: "p-lain", nama: "Safari 17.5 · iOS 17.5", terakhirAktif: "2026-10-22T03:00:00.000Z", ip: "192.168.9.40", jumlahSesi: 1, jalur: "sipp", ini: false },
      ],
      perangkat: [],
      riwayat: [{ id: "j1", waktu: "2026-10-23T03:00:00.000Z", peristiwa: "MASUK_GAGAL", alasan: "sandi salah", jalur: "email", ip: "192.168.10.30", peramban: "Chrome 130", os: "Windows 10/11" }],
    };
    const panggilan: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      panggilan.push({ url, init });
      return jawab(200, init?.method === "POST" ? { ok: true, data: { dicabut: 1 } } : { ok: true, data });
    }));
    const { PerangkatSaya } = await import("@/components/portal/perangkat-saya");
    render(createElement(PerangkatSaya));
    await waitFor(() => expect(screen.getByText("Perangkat ini")).toBeTruthy());
    expect(screen.getByText(/Safari 17\.5/)).toBeTruthy();
    const tombol = screen.getAllByRole("button", { name: /^Keluarkan$/ });
    expect(tombol).toHaveLength(1);
    fireEvent.click(tombol[0]);
    await waitFor(() => expect(panggilan.some((p) => p.init?.method === "POST")).toBe(true));
    const post = panggilan.find((p) => p.init?.method === "POST")!;
    expect(post.url).toContain("/api/portal/perangkat/cabut");
    expect(JSON.parse(String(post.init?.body))).toEqual({ perangkatId: "p-lain" });
    expect(screen.getByText("Gagal masuk")).toBeTruthy();
  });
});

describe("halaman admin Riwayat Masuk & Perangkat", () => {
  const akun = (roleId: string) => ({ id: `usr-${roleId}`, name: roleId, username: roleId, roleId, positionId: "", additionalRoleIds: [], isActive: true });

  it("hakim: akses ditolak, tidak ada permintaan ke rute admin", async () => {
    const f = vi.fn(async () => jawab(200, { ok: true, data: {} }));
    vi.stubGlobal("fetch", f);
    portal.nilai = { currentUser: akun("hakim"), users: [], roles: [] };
    const { default: Halaman } = await import("@/app/(portal)/admin/riwayat-masuk/page");
    render(createElement(Halaman));
    expect(screen.queryByRole("tab", { name: "Riwayat masuk" })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("admin: tab tampil, riwayat termuat dengan label peristiwa; rincian terbuka saat baris ditekan", async () => {
    const baris = {
      id: "j1", waktu: "2026-10-23T01:00:00.000Z", peristiwa: "MASUK_DITOLAK_BATAS_PERANGKAT", alasan: "batas 2 perangkat sudah penuh", jalur: "sipp-sesi",
      user_id: "usr-hakim", username: "hakim", nama: "Hakim Rekaan", peran: "hakim", identitas_samar: "", sesi_ref: "", perangkat_id: "p-9", ip: "192.168.9.77",
      rantai_xff: "1.2.3.4, 192.168.9.77", agen: "UA", jenis_perangkat: "komputer", os: "Windows 10/11", peramban: "Chrome 130", model: "", ingat: "", nama_komputer: "", mac: "", mac_sumber: "", pelaku_id: "", pelaku_nama: "", rincian: "{}",
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("tab=peringatan")) return jawab(200, { ok: true, data: { peringatan: [{ jenis: "luar-kantor", tingkat: "tinggi", judul: "Hakim Rekaan masuk dari luar jaringan kantor", rincian: "Alamat 36.80.1.2.", waktu: "2026-10-23T01:00:00.000Z" }] } });
      return jawab(200, { ok: true, data: { total: 1, halaman: 1, perHalaman: 50, baris: [baris] } });
    }));
    portal.nilai = { currentUser: akun("admin"), users: [{ id: "usr-hakim", name: "Hakim Rekaan", username: "hakim" }], roles: [{ id: "hakim", name: "Hakim" }] };
    const { default: Halaman } = await import("@/app/(portal)/admin/riwayat-masuk/page");
    const { container } = render(createElement(Halaman));
    for (const t of ["Riwayat masuk", "Sesi aktif", "Perangkat", "Batas perangkat"]) expect(screen.getByRole("tab", { name: t })).toBeTruthy();
    await waitFor(() => expect(container.querySelector('[data-baris-riwayat="j1"]')).toBeTruthy());
    const row = container.querySelector('[data-baris-riwayat="j1"]')!;
    expect(row.textContent).toContain("Ditolak: batas perangkat");
    expect(row.textContent).toContain("Sesi SIPP (ekstensi)");
    expect(row.textContent).toContain("192.168.9.77");
    expect(screen.getByText("Hakim Rekaan masuk dari luar jaringan kantor")).toBeTruthy();
    fireEvent.click(container.querySelector('[data-baris-riwayat="j1"]')!);
    expect(screen.getByText("1.2.3.4, 192.168.9.77")).toBeTruthy();
  });
});
