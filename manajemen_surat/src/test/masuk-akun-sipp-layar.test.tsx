import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

/**
 * Layar masuk dengan akun SIPP (7 Okt 2026): jalur SIPP lebih dahulu, jalur
 * lama hanya bila bukan akun SIPP; password dititipkan ke ekstensi HANYA bila
 * password SIPP-lah yang cocok dan petugas tidak mematikan pilihannya.
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

const SANDI = "Sandi-Palsu-Layar-9";

function fetchTiruan(jalurSipp: { status: number; isi: unknown }) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/sign-in/sipp")) {
      return new Response(JSON.stringify(jalurSipp.isi), { status: jalurSipp.status, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/api/users/lookup")) {
      return new Response(JSON.stringify({ ok: true, data: { user: { id: "u1", email: "u1@uji.local" } } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
  });
}

/** Ekstensi tiruan: tanda di <html> dan jembatan yang menjawab titipan. */
function pasangEkstensi() {
  document.documentElement.dataset.aletaMasukSipp = "1";
  const titipan: any[] = [];
  const dengar = (e: MessageEvent) => {
    const d = e.data as any;
    if (!d || d.sumber !== "aleta-portal") return;
    titipan.push(d);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { sumber: "aleta-ekstensi", balasan: d.idPesan, jawaban: { ok: true } },
        origin: window.location.origin,
        source: window,
      })
    );
  };
  window.addEventListener("message", dengar);
  return { titipan, lepas: () => window.removeEventListener("message", dengar) };
}

async function isiDanKirim(identitas: string) {
  render(<LoginPage />);
  const kolom = await screen.findByTestId("login-identifier");
  await waitFor(() => expect(kolom).toBeEnabled());
  fireEvent.change(kolom, { target: { value: identitas } });
  fireEvent.change(screen.getByTestId("login-password"), { target: { value: SANDI } });
}

describe("layar masuk dengan akun SIPP", () => {
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

  it("lewat SIPP: jalur lama tidak dipanggil, password dititipkan ke ekstensi, lalu ke portal", async () => {
    vi.stubGlobal("fetch", fetchTiruan({ status: 200, isi: { ok: true, jenis: "masuk", lewat: "sipp", usernameSipp: "pp.budi", catatan: "" } }));
    authMock.refetchSession.mockResolvedValue(undefined);
    ekstensi = pasangEkstensi();
    await isiDanKirim("pp.budi");
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/portal"));
    expect(authMock.signInEmail).not.toHaveBeenCalled();
    expect(ekstensi.titipan).toHaveLength(1);
    expect(ekstensi.titipan[0]).toMatchObject({ jenis: "masuk-titip", muatan: { username: "pp.budi", sandi: SANDI } });
    // Portal sendiri tidak menyimpan password di peramban.
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(SANDI);
  });

  it("pilihan isi otomatis dimatikan: masuk tetap, tidak ada titipan", async () => {
    vi.stubGlobal("fetch", fetchTiruan({ status: 200, isi: { ok: true, jenis: "masuk", lewat: "sipp", usernameSipp: "pp.budi", catatan: "" } }));
    authMock.refetchSession.mockResolvedValue(undefined);
    ekstensi = pasangEkstensi();
    await isiDanKirim("pp.budi");
    fireEvent.click(screen.getByRole("checkbox", { name: /Buka SIPP & ABT otomatis/ }));
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/portal"));
    // Tidak ada titipan; yang lama dilupakan (audit U5, 9 Okt 2026).
    expect(ekstensi.titipan.map((p) => p.jenis)).toEqual(["masuk-lupakan"]);
    expect(window.localStorage.getItem("aleta:isi-otomatis-sipp")).toBe("0");
  });

  it("lewat password ALETA: masuk, tetapi TIDAK ada titipan (bukan password SIPP)", async () => {
    vi.stubGlobal("fetch", fetchTiruan({ status: 200, isi: { ok: true, jenis: "masuk", lewat: "aleta", usernameSipp: "", catatan: "" } }));
    authMock.refetchSession.mockResolvedValue(undefined);
    ekstensi = pasangEkstensi();
    await isiDanKirim("pp.budi");
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/portal"));
    // Tidak ada titipan; yang lama dilupakan (audit U5, 9 Okt 2026).
    expect(ekstensi.titipan.map((p) => p.jenis)).toEqual(["masuk-lupakan"]);
  });

  it("bukan akun SIPP (Super Admin): jalur lama lookup + password ALETA berjalan seperti dulu", async () => {
    vi.stubGlobal("fetch", fetchTiruan({ status: 200, isi: { ok: true, jenis: "bukan-sipp", sebab: "tanpa-tautan" } }));
    authMock.signInEmail.mockResolvedValue({ error: null });
    authMock.refetchSession.mockResolvedValue(undefined);
    ekstensi = pasangEkstensi();
    await isiDanKirim("superadmin");
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(authMock.signInEmail).toHaveBeenCalledWith({ email: "u1@uji.local", password: SANDI, rememberMe: false }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/portal"));
    // Tidak ada titipan; yang lama dilupakan (audit U5, 9 Okt 2026).
    expect(ekstensi.titipan.map((p) => p.jenis)).toEqual(["masuk-lupakan"]);
  });

  it("akun SIPP diblokir: pesan server tampil, tidak masuk, jalur lama tidak dicoba", async () => {
    vi.stubGlobal(
      "fetch",
      fetchTiruan({ status: 403, isi: { message: "Akun SIPP Anda sedang diblokir, sehingga akses ALETA ikut tertutup.", code: "SIPP_NONAKTIF" } })
    );
    await isiDanKirim("pp.budi");
    fireEvent.click(screen.getByTestId("login-submit"));
    expect(await screen.findByText(/Akun SIPP Anda sedang diblokir/)).toBeInTheDocument();
    expect(authMock.signInEmail).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
