// @vitest-environment jsdom
/**
 * ALETA ABT di HP (5 Nov 2026) - layar: halaman /aleta-abt dalam tiga keadaan dan kartu admin.
 * Keputusan 6 Nov: tanpa ekstensi, layar ALETA ABT terbuka bagi Super Admin bila saklarnya menyala; peran lain tetap menunggu sampai stabil.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AletaAbtPintu } from "@/components/portal/aleta-abt-pintu";
import { BagianAletaAbtHp } from "@/components/portal/aleta-abt-hp-admin";
import { PengaturanSippAbt } from "@/components/portal/pengaturan-sipp-abt";

const jawab = (data: unknown, ok = true) =>
  new Response(JSON.stringify(ok ? { ok: true, data } : { ok: false, error: { message: "Ditolak." } }), { status: ok ? 200 : 403 });

beforeEach(() => {
  delete document.documentElement.dataset.aletaEkstensi;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.aletaEkstensi;
});

const stubHak = (terbuka: boolean) => vi.stubGlobal("fetch", vi.fn(async () => jawab({ terbuka, sumber: "bawaan" })));

describe("halaman ALETA ABT", () => {
  it("ekstensi aktif: tombol membuka panel Blangko ABT di alamat beranda ABT", async () => {
    document.documentElement.dataset.aletaEkstensi = "1.205.76";
    stubHak(false);
    render(<AletaAbtPintu />);
    const tautan = (await screen.findByRole("link", { name: "Buka panel Blangko ABT" })) as HTMLAnchorElement;
    expect(tautan.getAttribute("href")).toMatch(/\/aps_badilag\/abt\/main\/beranda#aleta-derry=1$/);
    expect(tautan.target).toBe("_blank");
    expect(screen.queryByText(/sedang dibangun/i)).toBeNull();
  });

  const stubSiapa = (data: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => (String(alamat).includes("/ekstensi/siapa") ? jawab(data) : jawab({ terbuka: false, sumber: "bawaan" })))
    );

  it("datang dari ubin APS (?dari=aps), ekstensi aktif, akun berhak: periksa hak lalu membuka panel", async () => {
    window.history.replaceState(null, "", "/aleta-abt?dari=aps");
    document.documentElement.dataset.aletaEkstensi = "1.205.76";
    stubSiapa({ roleId: "hakim", golonganMenu: ["hakim"] });
    render(<AletaAbtPintu />);
    await screen.findByText("Membuka panel Blangko ABT...");
    const dipanggil = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(dipanggil.some((u) => u.includes("/api/aleta-ecourt/ekstensi/siapa"))).toBe(true);
    window.history.replaceState(null, "", "/");
  });

  it("?dari=aps tetapi akun tidak berhak membuka Blangko Derry: tidak membuka otomatis", async () => {
    window.history.replaceState(null, "", "/aleta-abt?dari=aps");
    document.documentElement.dataset.aletaEkstensi = "1.205.76";
    stubSiapa({ roleId: "kasir", golonganMenu: ["kasir"] });
    render(<AletaAbtPintu />);
    await screen.findByRole("link", { name: "Buka panel Blangko ABT" });
    await waitFor(() => expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Membuka panel Blangko ABT...")).toBeNull();
    window.history.replaceState(null, "", "/");
  });

  it("tanpa ?dari=aps tidak ada pembukaan otomatis dan tidak ada permintaan hak Blangko Derry", async () => {
    document.documentElement.dataset.aletaEkstensi = "1.205.76";
    stubSiapa({ roleId: "super-admin" });
    render(<AletaAbtPintu />);
    await screen.findByRole("link", { name: "Buka panel Blangko ABT" });
    await new Promise((r) => setTimeout(r, 50));
    const dipanggil = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(dipanggil.some((u) => u.includes("/ekstensi/siapa"))).toBe(false);
    expect(screen.queryByText("Membuka panel Blangko ABT...")).toBeNull();
  });

  const LAYAR = <p>layar ALETA ABT</p>;

  it("tanpa ekstensi, hak menyala, Super Admin: layar ALETA ABT terbuka, tanpa tulisan sedang dibangun", async () => {
    stubHak(true);
    render(<AletaAbtPintu superAdmin>{LAYAR}</AletaAbtPintu>);
    await screen.findByText("layar ALETA ABT");
    expect(screen.queryByText(/sedang dibangun/i)).toBeNull();
    expect(screen.queryByRole("link", { name: "Buka panel Blangko ABT" })).toBeNull();
  });

  it("tanpa ekstensi, hak menyala, peran lain: izin tercatat, layar tetap tertutup sampai stabil", async () => {
    stubHak(true);
    render(<AletaAbtPintu>{LAYAR}</AletaAbtPintu>);
    await screen.findByText("ALETA ABT masih dipakai Super Admin");
    expect(screen.queryByText("layar ALETA ABT")).toBeNull();
    expect(screen.queryByText(/sedang dibangun/i)).toBeNull();
  });

  it("tanpa ekstensi, hak mati, Super Admin: mengikuti saklar, layar tidak tampil", async () => {
    stubHak(false);
    render(<AletaAbtPintu superAdmin>{LAYAR}</AletaAbtPintu>);
    await screen.findByText("ALETA ABT dibuka dari PC dengan ekstensi aktif");
    expect(screen.queryByText("layar ALETA ABT")).toBeNull();
  });

  it("ekstensi aktif, Super Admin: layar dan tombol panel tetap ada walau saklar HP mati", async () => {
    document.documentElement.dataset.aletaEkstensi = "1.205.76";
    stubHak(false);
    render(<AletaAbtPintu superAdmin>{LAYAR}</AletaAbtPintu>);
    await screen.findByText("layar ALETA ABT");
    expect(screen.getByRole("link", { name: "Buka panel Blangko ABT" })).toBeTruthy();
  });

  it("ekstensi aktif, peran lain: hanya tombol panel, layar ALETA ABT tidak tampil", async () => {
    document.documentElement.dataset.aletaEkstensi = "1.205.76";
    stubHak(true);
    render(<AletaAbtPintu>{LAYAR}</AletaAbtPintu>);
    await screen.findByRole("link", { name: "Buka panel Blangko ABT" });
    expect(screen.queryByText("layar ALETA ABT")).toBeNull();
  });

  it("tanpa ekstensi, hak mati: dibuka dari PC dengan ekstensi aktif, ada petunjuk mengaktifkan", async () => {
    stubHak(false);
    render(<AletaAbtPintu />);
    await screen.findByText("ALETA ABT dibuka dari PC dengan ekstensi aktif");
    expect(screen.getByText(/Pasang atau aktifkan ekstensi ALETA/)).toBeTruthy();
    expect(screen.queryByText(/sedang dibangun/i)).toBeNull();
    expect(screen.queryByRole("link", { name: "Buka panel Blangko ABT" })).toBeNull();
  });

  it("server menolak: pesan galat, bukan tampilan yang mengesankan bisa dipakai", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jawab(null, false)));
    render(<AletaAbtPintu />);
    await screen.findByRole("alert");
    expect(screen.queryByText(/sedang dibangun/i)).toBeNull();
  });

  it("server tidak menjawab bagi Super Admin: pesan tampil dan layar tidak hilang", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jawab(null, false)));
    render(<AletaAbtPintu superAdmin>{LAYAR}</AletaAbtPintu>);
    await screen.findByRole("alert");
    expect(screen.getByText("layar ALETA ABT")).toBeTruthy();
  });
});

describe("kartu admin ALETA ABT di HP", () => {
  const layar = (sumberHakim: "bawaan" | "peran" = "bawaan") => ({
    peran: [
      { id: "super-admin", nama: "Super Admin", menyala: true, sumber: "bawaan" },
      { id: "hakim", nama: "Hakim", menyala: sumberHakim === "peran", sumber: sumberHakim },
    ],
    pengguna: [],
    diubahOleh: "",
    diubahPada: "",
  });

  it("daftar peran dengan saklar; menyalakan peran mengirim ubah-peran", async () => {
    const dikirim: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_alamat: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          dikirim.push(JSON.parse(String(init.body)));
          return jawab(layar("peran"));
        }
        return jawab(layar());
      })
    );
    render(<BagianAletaAbtHp />);
    const saklar = await screen.findByRole("switch", { name: "ALETA ABT di HP untuk peran Hakim" });
    expect(saklar.getAttribute("aria-checked")).toBe("false");
    await act(async () => {
      fireEvent.click(saklar);
    });
    await waitFor(() => expect(dikirim).toEqual([{ tindakan: "ubah-peran", id: "hakim", nilai: true }]));
  });

  it("pencarian pengguna menawarkan Ikuti peran / Aktif / Mati", async () => {
    const dikirim: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          dikirim.push(JSON.parse(String(init.body)));
          return jawab(layar());
        }
        const kata = new URL(String(alamat), "http://localhost").searchParams.get("cari");
        const pengguna = kata === "uji" ? [{ id: "u1", nama: "Hakim Uji", peran: "hakim", pilihan: "ikuti", terbuka: false }] : [];
        return jawab({ ...layar(), pengguna });
      })
    );
    render(<BagianAletaAbtHp />);
    await screen.findByRole("switch", { name: "ALETA ABT di HP untuk peran Hakim" });
    fireEvent.change(screen.getByLabelText("Cari pengguna"), { target: { value: "uji" } });
    const grup = await screen.findByRole("group", { name: "Pilihan untuk Hakim Uji" }, { timeout: 3000 });
    expect(grup.textContent).toContain("Ikuti peran");
    expect(grup.textContent).toContain("Aktif");
    expect(grup.textContent).toContain("Mati");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Aktif" }));
    });
    await waitFor(() => expect(dikirim).toEqual([{ tindakan: "ubah-pengguna", id: "u1", nilai: "aktif" }]));
  });

  it("tab hanya tampil untuk Super Admin di halaman Pengaturan SIPP & ABT", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jawab({ daftar: [], jumlahBerkas: 0, hak: {}, riwayat: [] })));
    const sa = render(<PengaturanSippAbt roleId="super-admin" />);
    expect(screen.getByRole("tab", { name: "ALETA ABT di HP" })).toBeTruthy();
    sa.unmount();
    render(<PengaturanSippAbt roleId="admin" />);
    expect(screen.queryByRole("tab", { name: "ALETA ABT di HP" })).toBeNull();
  });
});
