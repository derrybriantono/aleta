import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

/**
 * MASUK DENGAN AKUN SIPP - PERBAIKAN AUDIT U5 (9 Okt 2026), bagian layar.
 *
 * 3. Titipan password SIPP orang SEBELUMNYA (hidup sampai 12 jam di
 *    chrome.storage.session) tidak dihapus ketika orang lain masuk ALETA di
 *    Chrome yang sama tanpa jalur SIPP, ketika pilihan isi otomatis
 *    dimatikan, atau ketika sesi habis (keluar paksa 401). Halaman masuk SIPP
 *    & ABT lalu terisi akun orang lain. Merah sebelum perbaikan.
 */

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const authMock = vi.hoisted(() => ({ refetchSession: vi.fn(), signInEmail: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, refetch: authMock.refetchSession }),
    signIn: { email: authMock.signInEmail },
  },
}));
vi.mock("@/components/layout/theme-toggle", () => ({ ThemeToggle: () => <button type="button">Tema</button> }));
vi.mock("@/components/branding/aleta-logo", () => ({ AletaLogo: () => <div>ALETA</div> }));

function fetchTiruan(isi: unknown) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/sign-in/sipp")) {
      return new Response(JSON.stringify(isi), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/api/users/lookup")) {
      return new Response(JSON.stringify({ ok: true, data: { user: { id: "u2", email: "u2@uji.local" } } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
  });
}

function pasangEkstensi() {
  document.documentElement.dataset.aletaMasukSipp = "1";
  const pesan: any[] = [];
  const dengar = (e: MessageEvent) => {
    const d = e.data as any;
    if (!d || d.sumber !== "aleta-portal") return;
    pesan.push(d);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { sumber: "aleta-ekstensi", balasan: d.idPesan, jawaban: { ok: true } },
        origin: window.location.origin,
        source: window,
      })
    );
  };
  window.addEventListener("message", dengar);
  return { pesan, lepas: () => window.removeEventListener("message", dengar) };
}

describe("3. titipan SIPP orang sebelumnya dilupakan", () => {
  let ekstensi: ReturnType<typeof pasangEkstensi> | null = null;
  afterEach(() => {
    ekstensi?.lepas();
    ekstensi = null;
    delete document.documentElement.dataset.aletaMasukSipp;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    routerMock.replace.mockReset();
    authMock.signInEmail.mockReset();
    authMock.refetchSession.mockReset();
    window.localStorage.clear();
  });

  it.each([
    ["jalur lama (akun tanpa tautan SIPP)", { ok: true, jenis: "bukan-sipp", sebab: "tanpa-tautan" }],
    ["password ALETA pada akun bertautan", { ok: true, jenis: "masuk", lewat: "aleta", usernameSipp: "", catatan: "" }],
  ])("masuk lewat %s menghapus titipan lama di ekstensi, tanpa menitip yang baru", async (_nama, isi) => {
    vi.stubGlobal("fetch", fetchTiruan(isi));
    authMock.signInEmail.mockResolvedValue({ error: null });
    authMock.refetchSession.mockResolvedValue(undefined);
    ekstensi = pasangEkstensi();
    render(<LoginPage />);
    const kolom = await screen.findByTestId("login-identifier");
    await waitFor(() => expect(kolom).toBeEnabled());
    fireEvent.change(kolom, { target: { value: "orang.kedua" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "Sandi-Palsu-Kedua-1" } });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/portal"));
    // Titipan password SIPP milik orang SEBELUMNYA (masih hidup 12 jam di
    // chrome.storage.session) harus dilupakan; kalau tidak, halaman masuk SIPP
    // & ABT diisi otomatis dengan akun orang lain.
    expect(ekstensi.pesan.map((p) => p.jenis)).toEqual(["masuk-lupakan"]);
  });

  it("pilihan 'Buka SIPP & ABT otomatis' dimatikan menghapus titipan lama dan tidak menitip", async () => {
    vi.stubGlobal("fetch", fetchTiruan({ ok: true, jenis: "masuk", lewat: "sipp", usernameSipp: "pp.budi", catatan: "" }));
    authMock.refetchSession.mockResolvedValue(undefined);
    ekstensi = pasangEkstensi();
    render(<LoginPage />);
    const kolom = await screen.findByTestId("login-identifier");
    await waitFor(() => expect(kolom).toBeEnabled());
    fireEvent.change(kolom, { target: { value: "pp.budi" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "Sandi-Palsu-Kedua-1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Buka SIPP & ABT otomatis/ }));
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/portal"));
    expect(ekstensi.pesan.map((p) => p.jenis)).toEqual(["masuk-lupakan"]);
  });

  it("lewat SIPP dengan pilihan menyala: hanya menitip (titipan baru menggantikan yang lama)", async () => {
    vi.stubGlobal("fetch", fetchTiruan({ ok: true, jenis: "masuk", lewat: "sipp", usernameSipp: "pp.budi", catatan: "" }));
    authMock.refetchSession.mockResolvedValue(undefined);
    ekstensi = pasangEkstensi();
    render(<LoginPage />);
    const kolom = await screen.findByTestId("login-identifier");
    await waitFor(() => expect(kolom).toBeEnabled());
    fireEvent.change(kolom, { target: { value: "pp.budi" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "Sandi-Palsu-Kedua-1" } });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/portal"));
    expect(ekstensi.pesan.map((p) => p.jenis)).toEqual(["masuk-titip"]);
  });

  it("keluar paksa karena sesi habis (401) ikut melupakan titipan - setiap titik signOut di app-state", () => {
    // Penjaga teks: tiga titik keluar paksa di app-state.tsx tidak dapat
    // dipicu satu per satu tanpa menyalakan seluruh portal.
    const baris = readFileSync(path.join(process.cwd(), "src", "lib", "app-state.tsx"), "utf8").split(/\r?\n/);
    const titik = baris.map((b, i) => (b.trim() === "void authClient.signOut();" ? i : -1)).filter((i) => i >= 0);
    expect(titik.length).toBeGreaterThanOrEqual(3);
    for (const i of titik) {
      expect(baris.slice(Math.max(0, i - 3), i).join(" "), `baris ${i + 1}`).toContain("lupakanSandiDiEkstensi()");
    }
  });
});
