/**
 * ============================================================================
 * PANDUAN PEMERIKSAAN SAKSI - TAMPILAN (18 Okt 2026, permintaan hakim)
 * ============================================================================
 *
 * Yang dijaga, dan DIJALANKAN (komponen sungguhan, mesin katalog sungguhan):
 *   - panduan muncul menurut jenis perkara; jenis tanpa katalog menyebut "Belum ada panduan";
 *   - keadaan awal dari sidang (kehadiran, kumulasi) dikirim ke pemuat;
 *   - pokok wajib ditandai, peringatan bila belum lengkap pada minimal 2 saksi;
 *   - centang disimpan di peramban per perkara per sidang, dan tetap berjalan bila penyimpanan gagal;
 *   - mode layar sidang: satu pertanyaan, berikut/sebelumnya, huruf menurut lebar layar;
 *   - dispensasi kawin: bagian keterangan anak, calon, dan orang tua;
 *   - hak peran: hakim, panitera, PP, admin, dan super admin berhak; kasir tidak;
 *   - lebar 390 / 1366 / 1920: kelas layar dan ukuran huruf mode layar sidang;
 *   - tanpa contoh jawaban, tanpa kode #nnnn#, tanpa tempat isian di teks tampil.
 *
 * Nomor perkara dan nama saksi di sini karangan.
 */
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanduanPemeriksaanSaksi, PanduanPemeriksaanSaksiIsi, type PemuatPanduan } from "@/components/portal/panduan-pemeriksaan-saksi";
import { bolehAksi } from "@/lib/matriks-peran";
import { kunciSimpanCentang } from "@/lib/pandu-saksi";
import { susunPanduan } from "@/server/shared/pandu-saksi";
import type { UserPersona } from "@/lib/types";

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return {
    id: `usr-${roleId}-${positionId}-${additionalRoleIds.join("+")}`,
    username: roleId,
    password: "",
    name: `Uji ${roleId}`,
    email: `${roleId}@uji.lokal`,
    roleId,
    positionId,
    additionalRoleIds,
    isActive: true,
  } as unknown as UserPersona;
}

const AKUN = {
  superadmin: akun("super-admin", "pos-pranata-komputer"),
  admin: akun("admin", "pos-pranata-komputer"),
  hakim: akun("hakim", "pos-hakim"),
  panitera: akun("panitera", "pos-panitera"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  js: akun("jurusita", "pos-jurusita"),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
};

const dipanggil: URLSearchParams[] = [];
const pemuatSungguhan: PemuatPanduan = async (kueri) => {
  dipanggil.push(kueri);
  return susunPanduan({
    jenisPerkaraId: kueri.get("jenisPerkaraId"),
    alurPerkaraId: kueri.get("alurPerkaraId"),
    jenisPerkara: kueri.get("jenisPerkara"),
    keadaan: JSON.parse(kueri.get("keadaan") || "{}"),
    butirSensitif: kueri.get("sensitif") === "1",
  });
};

const PERKARA_CERAI = { nomorPerkara: "901/Pdt.G/2026/PA.Uji", jenisPerkaraId: 347, alurPerkaraId: 15, jenisPerkara: "Cerai Gugat" };
const PERKARA_DK = { nomorPerkara: "902/Pdt.P/2026/PA.Uji", jenisPerkaraId: 362, alurPerkaraId: 16, jenisPerkara: "Dispensasi Kawin" };

function pasangLebar(lebar: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: lebar });
  window.dispatchEvent(new Event("resize"));
}

function gambar(props: Partial<Parameters<typeof PanduanPemeriksaanSaksiIsi>[0]> = {}) {
  return render(
    createElement(PanduanPemeriksaanSaksiIsi, {
      perkara: PERKARA_CERAI,
      sidangId: "7001",
      tanggalSidang: "2026-10-20",
      kunciBagian: "uji-pandu",
      muat: pemuatSungguhan,
      namaSaksi: { P: ["Fulanah Rekaan", "Fulan Rekaan"], T: [] },
      ...props,
    })
  );
}

beforeEach(() => {
  dipanggil.length = 0;
  window.localStorage.clear();
  pasangLebar(1366);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("panduan pemeriksaan saksi - isi", () => {
  it("menampilkan pertanyaan menurut jenis perkara, pokok wajib, dan nama saksi dari SIPP", async () => {
    gambar();
    const akar = await waitFor(() => {
      const el = document.querySelector("[data-pandu-saksi]");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(within(akar).getAllByText(/Perselisihan dan pertengkaran terus-menerus/).length).toBeGreaterThan(0);
    expect(akar.querySelectorAll('[data-pokok="wajib"]').length).toBeGreaterThanOrEqual(3);
    expect(akar.textContent).toContain("Fulanah Rekaan");
    expect(akar.textContent).toContain("Fulan Rekaan");
    expect(akar.textContent).toContain("Dasar hukum");
    expect(akar.textContent).toContain("Saksi Penggugat");
  });

  it("jenis tanpa katalog: Belum ada panduan pertanyaan untuk jenis perkara ini", async () => {
    gambar({ perkara: { nomorPerkara: "903/Pdt.P/2026/PA.Uji", jenisPerkaraId: 999, alurPerkaraId: 16, jenisPerkara: "Jenis Aneh" } });
    await waitFor(() => expect(document.querySelector("[data-pandu-status='belum-ada']")).not.toBeNull());
    expect(document.body.textContent).toContain("Belum ada panduan pertanyaan untuk jenis perkara ini");
    expect(document.querySelector("[data-pandu-saksi]")).toBeNull();
  });

  it("keadaan dari sidang (verstek, kumulasi) dikirim ke pemuat dan tampak pada isian", async () => {
    gambar({ keadaanAwal: { kehadiran: "verstek", kumulasi: ["hak-asuh"] } });
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    const kirim = JSON.parse(dipanggil[0].get("keadaan") || "{}");
    expect(kirim.kehadiran).toBe("verstek");
    expect(kirim.kumulasi).toEqual(["hak-asuh"]);
    expect(dipanggil[0].get("jenisPerkaraId")).toBe("347");
    expect(document.body.textContent).toContain("terbaca dari sidang");
    // verstek tanpa saksi tergugat terdaftar: bagian saksi Tergugat tidak ditawarkan
    expect(screen.queryByRole("tab", { name: /Saksi Tergugat/ })).toBeNull();
  });

  it("mengubah keadaan memuat ulang panduan dengan keadaan baru", async () => {
    gambar({ namaSaksi: { P: [], T: ["Saksi Rekaan T"] } });
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    fireEvent.click(document.querySelector("[data-pandu-keadaan] summary") as HTMLElement);
    const pilih = screen.getByLabelText("Kehadiran Tergugat/Termohon") as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(pilih, { target: { value: "verstek" } });
    });
    await waitFor(() => expect(dipanggil.length).toBeGreaterThanOrEqual(2));
    expect(JSON.parse(dipanggil[dipanggil.length - 1].get("keadaan") || "{}").kehadiran).toBe("verstek");
  });

  it("tidak menampilkan contoh jawaban, kode, atau tempat isian", async () => {
    gambar({ perkara: { nomorPerkara: "904/Pdt.G/2026/PA.Uji", jenisPerkaraId: 348, alurPerkaraId: 15, jenisPerkara: "Harta Bersama" } });
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    const teks = document.body.textContent || "";
    expect(teks).not.toMatch(/#\d{4}#/);
    expect(teks).not.toMatch(/[{}]/);
    expect(teks).not.toContain("...");
    expect(teks).not.toMatch(/jawaban yang diharapkan|contoh jawaban/i);
    expect(teks).not.toMatch(/\b(peladen|borang|galat|template)\b/i);
    expect(document.querySelector("textarea")).toBeNull();
  });
});

describe("panduan pemeriksaan saksi - peringatan pokok wajib dan centang", () => {
  it("peringatan muncul sampai pokok wajib lengkap pada 2 saksi", async () => {
    gambar();
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    expect(document.querySelector("[data-pandu-peringatan='ada']")).not.toBeNull();

    // Centang semua butir pokok wajib untuk Saksi 1 dan Saksi 2.
    const kotak = Array.from(document.querySelectorAll<HTMLInputElement>('[data-pokok="wajib"] input[type="checkbox"]'));
    expect(kotak.length).toBeGreaterThan(10);
    for (const k of kotak) if (!k.checked) fireEvent.click(k);
    await waitFor(() => expect(document.querySelector("[data-pandu-peringatan='tidak-ada']")).not.toBeNull());
    expect(document.querySelector("[data-pandu-peringatan='ada']")).toBeNull();
  });

  it("centang tersimpan per perkara per sidang di peramban dan pulih saat dibuka lagi", async () => {
    const { unmount } = gambar();
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    const kotak = document.querySelector<HTMLInputElement>('[data-butir] input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(kotak);
    expect(kotak.checked).toBe(true);
    const kunci = kunciSimpanCentang(PERKARA_CERAI.nomorPerkara, "7001");
    const tersimpan = JSON.parse(window.localStorage.getItem(kunci) || "{}");
    expect(Object.keys(tersimpan.centang)).toHaveLength(1);
    unmount();

    gambar();
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    await waitFor(() => expect(document.querySelector<HTMLInputElement>('[data-butir] input[type="checkbox"]')!.checked).toBe(true));
    // sidang lain pada perkara yang sama tidak membawa centang itu
    cleanup();
    gambar({ sidangId: "7002" });
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    expect(document.querySelector<HTMLInputElement>('[data-butir] input[type="checkbox"]')!.checked).toBe(false);
  });

  it("penyimpanan peramban yang gagal tidak merusak panduan", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("diblokir");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("diblokir");
    });
    gambar();
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    const kotak = document.querySelector<HTMLInputElement>('[data-butir] input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(kotak);
    expect(kotak.checked).toBe(true);
  });

  it("tidak ada yang ditulis ke server: hanya satu jenis panggilan baca ke pemuat", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    gambar();
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    const kotak = document.querySelector<HTMLInputElement>('[data-butir] input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(kotak);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("panduan pemeriksaan saksi - mode layar sidang dan cetak", () => {
  it("layar sidang menampilkan satu pertanyaan dan berpindah dengan tombol dan panah", async () => {
    gambar();
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Layar sidang/ }));
    const dialog = await screen.findByRole("dialog");
    const posisi = () => dialog.querySelector("[data-pandu-posisi]")!.textContent || "";
    const tanya = () => dialog.querySelector("[data-pandu-pertanyaan]")!.textContent || "";
    expect(posisi()).toMatch(/^Pertanyaan 1 dari \d+/);
    const pertama = tanya();
    expect(pertama.length).toBeGreaterThan(10);
    expect(within(dialog).getByRole("button", { name: /Sebelumnya/ })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: /Berikutnya/ }));
    expect(posisi()).toMatch(/^Pertanyaan 2 dari/);
    expect(tanya()).not.toBe(pertama);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(posisi()).toMatch(/^Pertanyaan 1 dari/);
    // menandai di layar sidang tersimpan dan terbaca di daftar
    fireEvent.click(within(dialog).getByRole("button", { name: /Saksi 1/ }));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.querySelectorAll<HTMLInputElement>('[data-butir] input[type="checkbox"]:checked').length).toBe(1);
  });

  it("huruf layar sidang mengikuti lebar: HP 390, laptop 1366, TV 1920", async () => {
    const hasil: Record<string, string> = {};
    for (const [lebar, kelas] of [
      [390, "ponsel"],
      [1366, "laptop"],
      [1920, "tv"],
    ] as const) {
      pasangLebar(lebar);
      const { unmount } = gambar();
      await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
      expect(document.querySelector("[data-pandu-saksi]")!.getAttribute("data-kelas-layar")).toBe(kelas);
      fireEvent.click(screen.getByRole("button", { name: /Layar sidang/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog.getAttribute("data-kelas-layar")).toBe(kelas);
      hasil[kelas] = dialog.querySelector("[data-pandu-pertanyaan]")!.className;
      // tidak ada lebar tetap yang memaksa gulir ke samping
      expect(dialog.className).not.toMatch(/w-\[\d+px\]|min-w-\[\d+px\]/);
      unmount();
    }
    expect(hasil.ponsel).toContain("text-2xl");
    expect(hasil.laptop).toContain("text-5xl");
    expect(hasil.tv).toContain("text-7xl");
  });

  it("susunan daftar tidak memakai lebar tetap pada 390, 1366, dan 1920", async () => {
    for (const lebar of [390, 1366, 1920]) {
      pasangLebar(lebar);
      const { unmount } = gambar();
      await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
      const akar = document.querySelector("[data-pandu-saksi]") as HTMLElement;
      expect(akar.className).toContain("min-w-0");
      expect(akar.outerHTML).not.toMatch(/(?:min-)?w-\[\d{3,}px\]/);
      // baris pertanyaan: satu kolom di HP, dua kolom mulai tablet/laptop
      expect(akar.querySelector("[data-butir]")!.className).toContain("md:grid-cols-");
      unmount();
    }
  });

  it("lembar cetak memuat pertanyaan tanpa kata teknis dan memanggil cetak", async () => {
    const cetak = vi.spyOn(window, "print").mockImplementation(() => undefined);
    gambar();
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Cetak lembar panduan/ }));
    const lembar = await waitFor(() => {
      const el = document.getElementById("aleta-cetak-pandu-saksi");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    const salinan = lembar.cloneNode(true) as HTMLElement;
    salinan.querySelectorAll("style").forEach((x) => x.remove());
    const tulisan = salinan.textContent || "";
    expect(tulisan).toContain("PANDUAN PEMERIKSAAN SAKSI");
    expect(tulisan).toContain("901/Pdt.G/2026/PA.Uji");
    expect(tulisan).not.toMatch(/#\d{4}#|[{}]|\.\.\.|aleta|pp-/i);
    expect(lembar.innerHTML).toContain("A4 portrait");
    await waitFor(() => expect(cetak).toHaveBeenCalled());
    await waitFor(() => expect(document.getElementById("aleta-cetak-pandu-saksi")).toBeNull());
  });
});

describe("panduan pemeriksaan saksi - dispensasi kawin dan saksi tergugat", () => {
  it("dispensasi kawin: bagian keterangan anak, calon, dan orang tua; butir peka ditahan", async () => {
    gambar({ perkara: PERKARA_DK, namaSaksi: { P: [], T: [] } });
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: /Keterangan anak, calon, dan orang tua/ }));
    expect(document.querySelector("[data-pandu-saksi]")!.getAttribute("data-bagian")).toBe("keterangan");
    expect(screen.getByRole("tab", { name: "Anak yang dimohonkan dispensasi" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Orang tua atau wali anak/ })).toBeInTheDocument();
    const pertanyaan = Array.from(document.querySelectorAll("[data-butir]")).map((x) => x.textContent || "").join(" | ");
    expect(pertanyaan.length).toBeGreaterThan(200);
    expect(pertanyaan).not.toMatch(/hamil|hubungan badan/i);
    // butir peka muncul hanya sesudah petugas memintanya dan memilih latar belakangnya
    const peka = screen.getByLabelText(/Tampilkan pertanyaan tentang keadaan yang mendorong pernikahan/i);
    expect(peka).not.toBeChecked();
  });

  it("harta bersama: saksi Tergugat punya tab sendiri dengan petunjuk bantahan", async () => {
    gambar({ perkara: { nomorPerkara: "905/Pdt.G/2026/PA.Uji", jenisPerkaraId: 348, alurPerkaraId: 15, jenisPerkara: "Harta Bersama" }, namaSaksi: { P: ["Saksi Rekaan P"], T: ["Saksi Rekaan T"] } });
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: /Saksi Tergugat/ }));
    expect(document.body.textContent).toContain("Saksi Rekaan T");
    expect(document.body.textContent).toMatch(/menyesuaikan bantahan Tergugat/);
  });
});

describe("panduan pemeriksaan saksi - hak per peran dan penempatan", () => {
  it("matriks: hakim, panitera, PP, admin, super admin berhak; kasir, juru sita, PTSP tidak", () => {
    for (const nama of ["hakim", "panitera", "pp", "admin", "superadmin"] as const) {
      expect(bolehAksi(AKUN[nama], "pandu.saksi"), nama).toBe(true);
    }
    for (const nama of ["kasir", "js", "ptsp"] as const) {
      expect(bolehAksi(AKUN[nama], "pandu.saksi"), nama).toBe(false);
    }
  });

  it("komponen tidak digambar bagi peran tak berhak", async () => {
    const { container } = render(
      createElement(PanduanPemeriksaanSaksi, { perkara: PERKARA_CERAI, kunciBagian: "uji-pandu", muat: pemuatSungguhan, pengguna: AKUN.kasir })
    );
    expect(container.querySelector("[data-pandu-saksi-bagian]")).toBeNull();
    expect(dipanggil).toHaveLength(0);
  });

  it("komponen digambar bagi hakim; menonjol dan terbuka pada agenda pembuktian", async () => {
    render(
      createElement(PanduanPemeriksaanSaksi, {
        perkara: PERKARA_CERAI,
        sidangId: "7001",
        kunciBagian: "uji-pandu",
        muat: pemuatSungguhan,
        pengguna: AKUN.hakim,
        menonjol: true,
        namaSaksi: { P: [], T: [] },
      })
    );
    const pembungkus = document.querySelector("[data-pandu-saksi-bagian]") as HTMLElement;
    expect(pembungkus.getAttribute("data-menonjol")).toBe("ya");
    expect(pembungkus.className).toContain("ring-2");
    expect(screen.getByRole("button", { name: /Panduan pertanyaan saksi/ })).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
  });

  it("agenda lain: bagian terlipat dan tidak memuat panduan sampai dibuka", async () => {
    render(
      createElement(PanduanPemeriksaanSaksi, {
        perkara: PERKARA_CERAI,
        sidangId: "7001",
        kunciBagian: "uji-pandu",
        muat: pemuatSungguhan,
        pengguna: AKUN.pp,
        menonjol: false,
        namaSaksi: { P: [], T: [] },
      })
    );
    const tombol = screen.getByRole("button", { name: /Panduan pertanyaan saksi/ });
    expect(tombol).toHaveAttribute("aria-expanded", "false");
    expect(dipanggil).toHaveLength(0);
    fireEvent.click(tombol);
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
    expect(dipanggil.length).toBeGreaterThan(0);
  });

  it("tanpa pengguna (layar lepas) panduan tetap tampil; rute yang menegakkan hak", async () => {
    render(createElement(PanduanPemeriksaanSaksi, { perkara: PERKARA_CERAI, kunciBagian: "uji-pandu", muat: pemuatSungguhan, menonjol: true }));
    await waitFor(() => expect(document.querySelector("[data-pandu-saksi]")).not.toBeNull());
  });
});
