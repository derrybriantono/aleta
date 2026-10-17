/**
 * Layar tutorial hidup: halaman Panduan (tab Tutorial per fitur) dan tombol "?".
 * Yang diuji adalah akibat nyata bagi pembaca: hanya fitur yang menjadi hak
 * akunnya yang tampil, pencarian menyaring, Super Admin dapat "melihat sebagai".
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pengguna: Record<string, unknown> = { id: "u1", roleId: "hakim" };
let jalur = "/aleta-ecourt";

vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({ currentUser: pengguna, positions: [], moduleVisibility: [] }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => jalur }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...sisa}>
      {children}
    </a>
  ),
}));

import { TombolBantuanTutorial } from "@/components/portal/tutorial-bantuan";
import { TutorialHidup } from "@/components/portal/tutorial-hidup";

beforeEach(() => {
  pengguna = { id: "u1", roleId: "hakim" };
  jalur = "/aleta-ecourt";
});
afterEach(() => cleanup());

describe("TutorialHidup - halaman Panduan", () => {
  it("hakim melihat Unggah putusan tetapi tidak Kasir atau Cetak relaas", () => {
    render(<TutorialHidup />);
    expect(screen.queryByTestId("tutorial-unggah-putusan")).not.toBeNull();
    expect(screen.queryByTestId("tutorial-jadwal-sidang")).not.toBeNull();
    expect(screen.queryByTestId("tutorial-kasir")).toBeNull();
    expect(screen.queryByTestId("tutorial-relaas-massal")).toBeNull();
    // Bukan pengelola: tidak ada pilihan "lihat sebagai peran".
    expect(screen.queryByText("Lihat sebagai peran")).toBeNull();
  });

  it("pencarian menyaring fitur, dan pesan kosong tampil bila tak ada yang cocok", () => {
    render(<TutorialHidup />);
    const kotak = screen.getByPlaceholderText(/Contoh: kasir/);
    fireEvent.change(kotak, { target: { value: "mediasi" } });
    expect(screen.queryByTestId("tutorial-jadwal-mediasi")).not.toBeNull();
    expect(screen.queryByTestId("tutorial-unggah-putusan")).toBeNull();
    fireEvent.change(kotak, { target: { value: "zzzzxxyy" } });
    expect(screen.getByText(/Tidak ada fitur yang cocok/)).toBeTruthy();
  });

  it("menekan judul membuka langkah bernomor dan peringatan", () => {
    render(<TutorialHidup />);
    expect(screen.queryByText("Langkah-langkah")).toBeNull();
    fireEvent.click(screen.getByText("Jadwal Mediasi"));
    expect(screen.getByText("Langkah-langkah")).toBeTruthy();
    expect(screen.getByText("Perhatikan")).toBeTruthy();
  });

  it("kasir melihat Kasir tetapi tidak Unggah putusan", () => {
    pengguna = { id: "u2", roleId: "pegawai", additionalRoleIds: ["kasir"] };
    render(<TutorialHidup />);
    expect(screen.queryByTestId("tutorial-kasir")).not.toBeNull();
    expect(screen.queryByTestId("tutorial-unggah-putusan")).toBeNull();
  });

  it("Super Admin melihat semua dan dapat memilih 'lihat sebagai' peran lain", () => {
    pengguna = { id: "u3", roleId: "super-admin" };
    render(<TutorialHidup />);
    expect(screen.queryByTestId("tutorial-kasir")).not.toBeNull();
    expect(screen.queryByTestId("tutorial-e-audit")).not.toBeNull();
    const pilihan = screen.getByLabelText("Lihat sebagai peran") as HTMLSelectElement;
    fireEvent.change(pilihan, { target: { value: "jurusita" } });
    expect(screen.queryByTestId("tutorial-relaas-massal")).not.toBeNull();
    expect(screen.queryByTestId("tutorial-kasir")).toBeNull();
    expect(screen.queryByTestId("tutorial-e-audit")).toBeNull();
  });
});

describe("TombolBantuanTutorial - tombol ?", () => {
  it("membuka panel berisi fitur halaman yang sedang dibuka, hanya yang menjadi hak akun", async () => {
    render(<TombolBantuanTutorial />);
    expect(screen.queryByTestId("panel-bantuan-tutorial")).toBeNull();
    fireEvent.click(screen.getByTestId("tombol-bantuan-tutorial"));
    expect(screen.queryByTestId("panel-bantuan-tutorial")).not.toBeNull();
    await waitFor(() => expect(screen.queryByTestId("tutorial-jadwal-sidang")).not.toBeNull());
    expect(screen.queryByTestId("tutorial-kasir")).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("panel-bantuan-tutorial")).toBeNull();
  });

  it("halaman tanpa tutorial memberi pesan ramah dan tautan ke semua tutorial", async () => {
    jalur = "/halaman-tanpa-tutorial";
    render(<TombolBantuanTutorial />);
    fireEvent.click(screen.getByTestId("tombol-bantuan-tutorial"));
    await waitFor(() => expect(screen.getByText(/belum punya langkah khusus/)).toBeTruthy());
    expect(screen.getAllByText(/tutorial/i).length).toBeGreaterThan(0);
  });
});
