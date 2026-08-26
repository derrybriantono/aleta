import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import { APP_VERSION } from "@/lib/patch-notes";

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  refetchSession: vi.fn(),
  signInEmail: vi.fn(),
  session: null as { user?: { id: string } } | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: authMock.session,
      refetch: authMock.refetchSession,
    }),
    signIn: {
      email: authMock.signInEmail,
    },
  },
}));

vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}));

vi.mock("@/components/branding/aleta-logo", () => ({
  AletaLogo: () => <div>ALETA</div>,
}));

type LookupUser = {
  id: string;
  email: string;
};

function createFetchMock(lookupUser?: LookupUser) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/public/institution")) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            courtName: "Pengadilan Agama Donggala",
            courtShortName: "PA Donggala",
            logoUrl: "",
          },
        }),
      };
    }

    if (url.includes("/api/users/lookup") && lookupUser) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            user: lookupUser,
          },
        }),
      };
    }

    return {
      ok: false,
      json: async () => ({
        ok: false,
        error: { message: "Endpoint test tidak dimock." },
      }),
    };
  });
}

describe("LoginPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    routerMock.replace.mockReset();
    routerMock.refresh.mockReset();
    authMock.refetchSession.mockReset();
    authMock.signInEmail.mockReset();
    authMock.session = null;
    window.localStorage.clear();
  });

  it("submits login once, refreshes session, and navigates without router.refresh race", async () => {
    const fetchMock = createFetchMock({
      id: "user-superadmin",
      email: "superadmin@example.test",
    });
    vi.stubGlobal("fetch", fetchMock);
    authMock.signInEmail.mockResolvedValue({ error: null });
    authMock.refetchSession.mockResolvedValue(undefined);

    render(<LoginPage />);

    const identifier = await screen.findByTestId("login-identifier");
    await waitFor(() => expect(identifier).toBeEnabled());

    fireEvent.change(identifier, { target: { value: "superadmin" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "super123" } });
    fireEvent.click(screen.getByTestId("login-submit"));
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(authMock.signInEmail).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/users/lookup?identifier=superadmin"),
      expect.objectContaining({ credentials: "include", cache: "no-store" })
    );
    expect(authMock.refetchSession).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith("/portal");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("shows the public institution name on the login branding", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<LoginPage />);

    expect(await screen.findByText("Pengadilan Agama Donggala")).toBeInTheDocument();
    expect(await screen.findByText("SSO (Single Sign On)")).toBeInTheDocument();
    expect(await screen.findByText("Portal Aplikasi Pengadilan Agama Donggala")).toBeInTheDocument();
    expect(screen.getByText(`Patch Notes v${APP_VERSION}`)).toBeInTheDocument();
  });

  it("shows the copyright link below the login button", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<LoginPage />);

    const copyright = await screen.findByRole("link", { name: /Copyright © 2025 Derry Briantono/ });
    expect(copyright).toHaveAttribute(
      "href",
      "https://www.instagram.com/derrybriantono?igsh=M2VtOGljMGJkOXBt"
    );
  });

  it("shows a human-readable error when credentials are incomplete", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<LoginPage />);

    const submit = await screen.findByTestId("login-submit");
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(await screen.findByText("Masukkan identitas akun dan password.")).toBeInTheDocument();
    expect(authMock.signInEmail).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("remembers only the account identifier when the checkbox is enabled", async () => {
    const fetchMock = createFetchMock({
      id: "user-admin",
      email: "admin@example.test",
    });
    vi.stubGlobal("fetch", fetchMock);
    authMock.signInEmail.mockResolvedValue({ error: null });
    authMock.refetchSession.mockResolvedValue(undefined);

    const { unmount } = render(<LoginPage />);

    const identifier = await screen.findByTestId("login-identifier");
    await waitFor(() => expect(identifier).toBeEnabled());

    fireEvent.change(identifier, { target: { value: "admin" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "admin123" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Simpan login akun/ }));
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/portal"));
    expect(window.localStorage.getItem("aleta:remembered-login-identifier")).toBe("admin");
    expect(window.localStorage.getItem("aleta:remembered-login-password")).toBeNull();

    unmount();
    routerMock.replace.mockReset();
    authMock.signInEmail.mockReset();

    render(<LoginPage />);

    const rememberedIdentifier = await screen.findByTestId("login-identifier");
    await waitFor(() => expect(rememberedIdentifier).toHaveValue("admin"));
    expect(screen.getByRole("checkbox", { name: /Simpan login akun/ })).toBeChecked();
    expect(screen.getByTestId("login-password")).toHaveValue("");
  });
});
