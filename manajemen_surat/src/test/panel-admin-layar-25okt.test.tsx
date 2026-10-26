import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntegritasPanel } from "@/components/portal/integritas-panel";
import { LihatSebagaiPanel } from "@/components/portal/lihat-sebagai-panel";
import { VerifikasiPanel } from "@/components/portal/verifikasi-panel";
import { VerifikasiSaya } from "@/components/portal/verifikasi-saya";

/**
 * Layar rantai E (E4, E5, E6) di jsdom dengan fetch palsu: perilaku nyata
 * tombol dan isian, bukan hanya render. Server palsu mencatat badan kiriman.
 */

type Panggilan = { url: string; metode: string; badan: Record<string, unknown> };
let panggilan: Panggilan[] = [];
let rute: (url: string, metode: string, badan: Record<string, unknown>) => { ok: boolean; data?: unknown; pesan?: string; status?: number };

beforeEach(() => {
  panggilan = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const badan = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      const metode = String(init?.method ?? "GET");
      panggilan.push({ url: String(url), metode, badan });
      const h = rute(String(url), metode, badan);
      return { ok: h.ok, status: h.status ?? (h.ok ? 200 : 400), json: async () => (h.ok ? { ok: true, data: h.data } : { ok: false, error: { message: h.pesan } }) } as Response;
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const menu = (appId: string, nama: string, tampil: boolean, penjelasan: string) => ({ appId, nama, tampil, sebab: tampil ? "golongan-berhak" : "akses-menu-tutup", penjelasan, golonganBerhak: [] });

describe("LihatSebagaiPanel (E4)", () => {
  it("tombol mulai menunggu target dan alasan 10 huruf; sesudah mulai tampil pita, jumlah menu, dan saringan tersembunyi", async () => {
    const hasil = {
      sesi: { jenis: "akun", userId: "u-1", roleId: "hakim", nama: "Hakim Rekaan", alasan: "menu jadwal hilang", mulai: "2026-10-26T01:00:00.000Z", berakhir: "2026-10-26T01:30:00.000Z" },
      sisaMenit: 30,
      golongan: ["Hakim"],
      menu: [menu("aleta-ecourt", "ALETA e-Court", true, "Matriks hak memberi akses."), menu("kasir", "Kasir", false, "Ditutup oleh Super Admin di Akses Menu.")],
    };
    rute = (url, metode) => {
      if (metode === "GET") return { ok: true, data: { akun: [{ id: "u-1", nama: "Hakim Rekaan", roleId: "hakim" }], peran: [{ id: "hakim", nama: "Hakim" }], berjalan: null } };
      if (metode === "POST") return { ok: true, data: { berjalan: hasil } };
      if (metode === "DELETE") return { ok: true, data: { diakhiri: true } };
      void url;
      return { ok: false };
    };
    render(<LihatSebagaiPanel />);
    await waitFor(() => expect(screen.getByRole("option", { name: /Hakim Rekaan/ })).toBeTruthy());
    const mulai = screen.getByRole("button", { name: /Mulai melihat/ }) as HTMLButtonElement;
    expect(mulai.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Akun"), { target: { value: "u-1" } });
    fireEvent.change(screen.getByLabelText(/Alasan/), { target: { value: "pendek" } });
    expect(mulai.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Alasan/), { target: { value: "menu jadwal hilang" } });
    expect(mulai.disabled).toBe(false);
    fireEvent.click(mulai);

    await waitFor(() => expect(document.querySelector("[data-pita-lihat-sebagai]")).toBeTruthy());
    expect(panggilan.find((p) => p.metode === "POST")?.badan).toEqual({ userId: "u-1", alasan: "menu jadwal hilang" });
    expect(screen.getByText(/1 dari 2 aplikasi tampil/)).toBeTruthy();
    expect(document.querySelectorAll("[data-menu]")).toHaveLength(2);
    fireEvent.click(screen.getByLabelText(/hanya yang tersembunyi/));
    expect(document.querySelectorAll("[data-menu]")).toHaveLength(1);
    expect(document.querySelector("[data-menu='kasir']")?.getAttribute("data-tampil")).toBe("tidak");

    fireEvent.click(screen.getByRole("button", { name: "Akhiri" }));
    await waitFor(() => expect(document.querySelector("[data-pita-lihat-sebagai]")).toBeNull());
  });
});

describe("VerifikasiPanel (E5)", () => {
  const data = {
    pengaturan: { otpWhatsapp: false, authenticator: false, aturanPeran: {}, subnetKantor: ["192.168.10.0/24"], masaTepercayaHari: 30, diubahOleh: "", diubahPada: "" },
    peran: [
      { id: "hakim", nama: "Hakim", bawaan: "luar-kantor", terdaftar: 2 },
      { id: "admin", nama: "Admin", bawaan: "wajib", terdaftar: 0 },
    ],
    masaTepercayaMaks: 90,
  };

  it("mati bawaan; menyalakan authenticator + mengubah aturan peran dikirim apa adanya ke server", async () => {
    rute = (_u, metode, badan) => {
      if (metode === "GET") return { ok: true, data };
      return { ok: true, data: { ...data, pengaturan: { ...data.pengaturan, ...badan } } };
    };
    render(<VerifikasiPanel bolehAtur />);
    await waitFor(() => expect(screen.getByLabelText("Aturan Hakim")).toBeTruthy());
    expect(screen.getByText("Mati")).toBeTruthy();
    expect((screen.getByLabelText(/Authenticator \(TOTP\)/) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText(/Authenticator \(TOTP\)/));
    fireEvent.change(screen.getByLabelText("Aturan Hakim"), { target: { value: "wajib" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(screen.getByText(/MENYALA; perangkat Anda ini langsung dipercaya/)).toBeTruthy());
    const kirim = panggilan.find((p) => p.metode === "POST")!.badan;
    expect(kirim).toMatchObject({ otpWhatsapp: false, authenticator: true, subnetKantor: ["192.168.10.0/24"], masaTepercayaHari: 30 });
    expect((kirim.aturanPeran as Record<string, string>).hakim).toBe("wajib");
  });

  it("Admin (bukan pengatur) hanya melihat bantuan; kode cadangan ditampilkan dan reset menyebut nama", async () => {
    rute = (u, _m, badan) => {
      if (u.includes("bantuan")) return badan.aksi === "reset" ? { ok: true, data: { direset: true, untuk: "Pak Staf" } } : { ok: true, data: { kode: ["AAAAA-BBBBB", "CCCCC-DDDDD"], untuk: "Pak Staf" } };
      return { ok: false };
    };
    render(<VerifikasiPanel bolehAtur={false} />);
    expect(screen.queryByLabelText(/OTP WhatsApp/)).toBeNull();
    expect(panggilan.filter((p) => p.url.includes("/api/admin/verifikasi") && !p.url.includes("bantuan"))).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("ID akun"), { target: { value: " u-staf " } });
    fireEvent.click(screen.getByRole("button", { name: "Buat kode cadangan" }));
    await waitFor(() => expect(document.querySelector("[data-kode-cadangan]")).toBeTruthy());
    expect(document.querySelectorAll("[data-kode-cadangan] li")).toHaveLength(2);
    expect(panggilan.at(-1)?.badan).toEqual({ userId: "u-staf", aksi: "kode-cadangan" });
    fireEvent.click(screen.getByRole("button", { name: "Reset authenticator" }));
    await waitFor(() => expect(screen.getByText(/Authenticator Pak Staf dihapus/)).toBeTruthy());
    expect(document.querySelector("[data-kode-cadangan]")).toBeNull();
  });
});

describe("VerifikasiSaya (E5)", () => {
  it("memasang authenticator: QR tampil, kode dikonfirmasi, status disegarkan; passkey dijelaskan belum tersedia di http", async () => {
    let aktif = false;
    rute = (u, metode, badan) => {
      if (u.endsWith("/api/portal/verifikasi") && metode === "GET") {
        return {
          ok: true,
          data: { authenticatorAktif: aktif, authenticatorMenunggu: false, kodeCadanganSisa: 0, perangkatTepercaya: [], nomorWhatsapp: "0812*****001", saklar: { otpWhatsapp: false, authenticator: false }, aturan: "opsional", passkey: false },
        };
      }
      if (badan.aksi === "mulai") return { ok: true, data: { rahasia: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/x", qr: "data:image/png;base64,AAAA" } };
      if (badan.aksi === "konfirmasi") {
        aktif = badan.kode === "123456";
        return aktif ? { ok: true, data: { aktif: true } } : { ok: false, pesan: "Kode salah." };
      }
      return { ok: false };
    };
    render(<VerifikasiSaya />);
    await waitFor(() => expect(screen.getByText(/Kode belum ditagih; Super Admin belum menyalakannya/)).toBeTruthy());
    expect(screen.getByText(/Passkey belum tersedia/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Pasang authenticator/ }));
    await waitFor(() => expect(screen.getByAltText("Kode QR authenticator")).toBeTruthy());
    expect(screen.getByText(/JBSWY3DPEHPK3PXP/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Kode dari authenticator"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Aktifkan" }));
    await waitFor(() => expect(screen.getByText("Kode salah.")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Kode dari authenticator"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Aktifkan" }));
    await waitFor(() => expect(screen.getByText("Authenticator aktif")).toBeTruthy());
    expect(screen.queryByAltText("Kode QR authenticator")).toBeNull();
  });
});

describe("IntegritasPanel (E6)", () => {
  const temuan = (id: string, jenis: string, label: string, status = "baru") => ({
    id,
    folderId: "f1",
    folderNama: "Website PA",
    jalur: `uploads/${id}.php`,
    jenis,
    label,
    aturan: "x",
    baris: 3,
    sha256: "a".repeat(64),
    ukuran: 10,
    pertamaAt: "2026-10-26T01:00:00.000Z",
    terakhirAt: "2026-10-26T01:00:00.000Z",
    status,
    tanganiOleh: status === "baru" ? "" : "SA",
    tanganiAt: "",
  });
  const dasar = (boleh: boolean) => ({
    ringkas: { aktif: true, folder: 1, halaman: 0, temuanBaru: 2, perJenis: [], pindaiTerakhir: "2026-10-26T01:00:00.000Z", galatTerakhir: "" },
    temuan: [temuan("a", "webshell", "Pola webshell"), temuan("b", "php-baru", "Berkas PHP baru"), temuan("c", "php-baru", "Berkas PHP baru", "ditangani")],
    memindai: false,
    pengaturan: { aktif: true, folder: [{ id: "f1", nama: "Website PA", jalur: boleh ? "/mnt/website-pa" : "(disembunyikan)", jenis: "website", unggahan: ["uploads"] }], halamanPublik: [], selangMenit: 360, peringatanWa: true, lewati: [], diubahOleh: "", diubahPada: "" },
    boleh,
  });

  it("Admin hanya melihat temuan baru: tanpa pengaturan dan tanpa tombol tindakan", async () => {
    rute = () => ({ ok: true, data: dasar(false) });
    render(<IntegritasPanel />);
    await waitFor(() => expect(document.querySelectorAll("[data-temuan]")).toHaveLength(2));
    expect(screen.queryByLabelText("Jalur folder")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sudah ditangani" })).toBeNull();
    expect(screen.getByText("2 temuan baru")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/yang sudah ditangani/));
    expect(document.querySelectorAll("[data-temuan]")).toHaveLength(3);
  });

  it("Super Admin: menandai ditangani, diketahui aman menuntut alasan 5 huruf, simpan mengirim folder dan selang, pindai sekarang", async () => {
    rute = (u, metode) => {
      if (u.endsWith("/api/admin/integritas") && metode === "GET") return { ok: true, data: dasar(true) };
      if (u.endsWith("/api/admin/integritas") && metode === "POST") return { ok: true, data: dasar(true) };
      return { ok: true, data: {} };
    };
    render(<IntegritasPanel />);
    await waitFor(() => expect(document.querySelectorAll("[data-temuan]")).toHaveLength(2));
    expect((screen.getByLabelText("Jalur folder") as HTMLInputElement).value).toBe("/mnt/website-pa");

    fireEvent.click(screen.getAllByRole("button", { name: "Sudah ditangani" })[0]);
    await waitFor(() => expect(panggilan.some((p) => p.url.endsWith("/temuan") && p.badan.aksi === "ditangani" && p.badan.id === "a")).toBe(true));

    const aman = screen.getAllByRole("button", { name: "Diketahui aman" })[0] as HTMLButtonElement;
    expect(aman.disabled).toBe(true);
    fireEvent.change(screen.getAllByLabelText("Alasan diketahui aman")[0], { target: { value: "pembaruan resmi CMS" } });
    expect(aman.disabled).toBe(false);

    fireEvent.change(screen.getByLabelText(/Selang pindai/), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: /^Simpan$/ }));
    await waitFor(() => expect(panggilan.some((p) => p.url.endsWith("/api/admin/integritas") && p.metode === "POST")).toBe(true));
    const simpan = panggilan.find((p) => p.url.endsWith("/api/admin/integritas") && p.metode === "POST")!.badan;
    expect(simpan).toMatchObject({ aktif: true, selangMenit: 120, peringatanWa: true });
    expect((simpan.folder as Array<{ jalur: string; unggahan: string[] }>)[0]).toMatchObject({ jalur: "/mnt/website-pa", unggahan: ["uploads"] });

    fireEvent.click(screen.getByRole("button", { name: /Pindai penuh/ }));
    await waitFor(() => expect(panggilan.some((p) => p.url.endsWith("/pindai") && p.badan.jenis === "penuh")).toBe(true));
  });
});
