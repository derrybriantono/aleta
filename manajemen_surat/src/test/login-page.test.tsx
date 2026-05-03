import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

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

describe("LoginPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerMock.replace.mockReset();
    routerMock.refresh.mockReset();
    authMock.refetchSession.mockReset();
    authMock.signInEmail.mockReset();
    authMock.session = null;
  });

  it("submits login once, refreshes session, and navigates without router.refresh race", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          user: {
            id: "user-superadmin",
            email: "superadmin@example.test",
          },
        },
      }),
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authMock.refetchSession).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith("/portal");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("shows a human-readable error when credentials are incomplete", async () => {
    render(<LoginPage />);

    const submit = await screen.findByTestId("login-submit");
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(await screen.findByText("Masukkan identitas akun dan password.")).toBeInTheDocument();
    expect(authMock.signInEmail).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
