import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROFIL_BAWAAN_V45, bolehMengubahProfilProject, bersihkanProfilProject } from "@/lib/profil-project-ai";
import type { BahanPrompt } from "@/lib/prompt-putusan";

vi.mock("@/lib/app-state", () => ({
  usePenggunaAktifOpsional: () => ({ id: "usr_uji_1", roleId: "hakim" }),
}));
vi.mock("@/lib/matriks-peran", () => ({ bolehAksiLayar: () => true }));

import { AletaPromptPutusan } from "@/components/portal/aleta-prompt-putusan";

/** Bahan karangan - bukan perkara asli. */
const bahan: BahanPrompt = {
  ok: true,
  identitas: { perkaraId: "1", nomorPerkara: "123/Pdt.G/2026/PA.Contoh", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-09-02", gugatan: true },
  pihak: {
    penggugat: [{ nama: "Aminah binti Salim", alamat: "Donggala" }],
    tergugat: [{ nama: "Hamid bin Yusuf", alamat: "Donggala" }],
  },
  kuasa: [],
  sidang: [{ tanggal: "2026-10-07", tanggalTerbaca: "7 Oktober 2026", agenda: "Sidang Pertama", alasanDitunda: "", kehadiran: "kedua pihak hadir" }],
  mediasi: {
    ada: false, mediator: "", tanggalMulai: "", tanggalMulaiTerbaca: "", tanggalLaporan: "", tanggalLaporanTerbaca: "",
    tanggalKesepakatan: "", tanggalKesepakatanTerbaca: "", kodeHasil: "", hasilTerbaca: "", isiKesepakatan: "", biaya: [],
  },
  saksi: [],
  berkas: [],
  putusan: { tanggalPutusan: "", verstek: false, adaAmar: false },
};

function pasangFetch(profil: unknown = PROFIL_BAWAAN_V45) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const isi = String(url).includes("profil-project-ai") ? { data: { profil } } : { data: { available: true, ...bahan } };
      return { ok: true, json: async () => isi } as unknown as Response;
    })
  );
}

async function bukaPenyusun() {
  render(<AletaPromptPutusan nomorPerkara="123/Pdt.G/2026/PA.Contoh" />);
  fireEvent.click(screen.getByRole("button", { name: /Ambil bahan dari SIPP/ }));
  return screen.findByLabelText(/Apakah Anda menggunakan Project ALETA AI PA CLAUDE ULTRA\?/);
}

function hasil(): string {
  return (document.querySelector("textarea[readonly]") as HTMLTextAreaElement).value;
}

describe("penyusun perintah AI di Status Perkara", () => {
  beforeEach(() => {
    window.localStorage.clear();
    pasangFetch();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("tanpa centang: perintah memuat bagian peran dan batasan", async () => {
    const centang = (await bukaPenyusun()) as HTMLInputElement;
    expect(centang.checked).toBe(false);
    expect(hasil()).toMatch(/^PERAN\nAnda adalah/);
    expect(hasil()).toContain("BATASAN");
  });

  it("dengan centang: tidak ada peran, ada pembuka singkat dan pemicu sesuai tujuan", async () => {
    const centang = (await bukaPenyusun()) as HTMLInputElement;
    fireEvent.click(centang);
    expect(hasil()).not.toMatch(/Kamu adalah|Anda adalah|\bperan\b|\brole\b/i);
    expect(hasil().startsWith("Gunakan instruksi Project yang sedang aktif. Fokus pada data perkara berikut.")).toBe(true);
    expect(hasil()).toContain("YANG DIMINTA: PL");

    const [pilihTujuan, pilihCakupan] = screen.getAllByRole("combobox");
    fireEvent.change(pilihTujuan, { target: { value: "amar" } });
    expect(hasil()).toContain("YANG DIMINTA: AM");
    fireEvent.change(pilihCakupan, { target: { value: "ringkas" } });
    expect(hasil()).toContain("YANG DIMINTA: AM ringkas");
  });

  it("versi profil tampil kecil di bawah centang", async () => {
    await bukaPenyusun();
    expect(await screen.findByText(/Profil Project: PA Edition V\.4\.5 \(Claude-Native Core\) · 18 Okt 2026/)).toBeTruthy();
  });

  it("memakai profil yang diisi Super Admin, termasuk versinya di layar", async () => {
    pasangFetch(
      bersihkanProfilProject({ versi: "V.5 uji", tanggal: "2027-02-03", pembuka: "Pembuka profil uji.", formatKeluaran: "Format profil uji" })
    );
    const centang = (await bukaPenyusun()) as HTMLInputElement;
    expect(await screen.findByText(/Profil Project: V\.5 uji · 3 Feb 2027/)).toBeTruthy();
    fireEvent.click(centang);
    await waitFor(() => expect(hasil().startsWith("Pembuka profil uji.")).toBe(true));
    expect(hasil()).toContain("Format keluaran: Format profil uji");
  });

  it("pilihan centang diingat per pengguna", async () => {
    const centang = (await bukaPenyusun()) as HTMLInputElement;
    fireEvent.click(centang);
    expect(window.localStorage.getItem("aleta.prompt-ai.pakai-project.usr_uji_1")).toBe("1");
    cleanup();
    const lagi = (await bukaPenyusun()) as HTMLInputElement;
    await waitFor(() => expect(lagi.checked).toBe(true));
  });

  it("tujuan putusan: nama asli, NIK tertutup, catatan hapus data tampil di bawah tombol salin", async () => {
    await bukaPenyusun();
    fireEvent.click(screen.getByText(/Produk para pihak/));
    const kotak = screen.getByText("Gugatan").closest("label")!.querySelector("textarea")!;
    fireEvent.change(kotak, { target: { value: "Penggugat Aminah binti Salim NIK 7203123456789012." } });
    expect(hasil()).not.toMatch(/\d{16}/);
    expect(hasil()).toContain("Aminah binti Salim");
    expect(hasil()).toContain("[placeholder: NIK]");
    expect(hasil()).toContain("anggap data pribadi tersebut telah dihapus");
    expect(screen.getByText("AI hanya bisa diminta; untuk menghapus data, hapus percakapan di aplikasi AI setelah selesai.")).toBeTruthy();
  });

  it("tujuan lain: inisial, tanpa catatan hapus data", async () => {
    await bukaPenyusun();
    const [pilihTujuan] = screen.getAllByRole("combobox");
    fireEvent.change(pilihTujuan, { target: { value: "ringkasan" } });
    fireEvent.click(screen.getByText(/Produk para pihak/));
    const kotak = screen.getByText("Gugatan").closest("label")!.querySelector("textarea")!;
    fireEvent.change(kotak, { target: { value: "Penggugat Aminah binti Salim NIK 7203123456789012." } });
    expect(hasil()).not.toContain("Aminah");
    expect(hasil()).toContain("A. binti S.");
    expect(screen.queryByText(/AI hanya bisa diminta/)).toBeNull();
  });

  it("saklar: format putusan tertentu bawaan MATI, putusan blangko bawaan NYALA, diingat per pengguna", async () => {
    await bukaPenyusun();
    const format = screen.getByLabelText(/Ikuti format putusan tertentu/) as HTMLInputElement;
    const blangko = screen.getByLabelText(/Sertakan putusan yang masih berbentuk blangko/) as HTMLInputElement;
    expect(format.checked).toBe(false);
    expect(blangko.checked).toBe(true);
    expect(screen.getByText(/Belum ada draf blangko untuk perkara ini/)).toBeTruthy();

    fireEvent.click(format);
    fireEvent.click(blangko);
    expect(JSON.parse(window.localStorage.getItem("aleta.prompt-ai.saklar.usr_uji_1") || "{}")).toEqual({ ikutiFormat: true, sertakanBlangko: false });
    expect(screen.getByText(/Draf blangko tidak disertakan/)).toBeTruthy();

    cleanup();
    await bukaPenyusun();
    expect((screen.getByLabelText(/Ikuti format putusan tertentu/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Sertakan putusan yang masih berbentuk blangko/) as HTMLInputElement).checked).toBe(false);
  });

  it("contoh format yang ditempel disamarkan dan dibungkus; format dapat disimpan sebagai format saya", async () => {
    await bukaPenyusun();
    fireEvent.click(screen.getByLabelText(/Ikuti format putusan tertentu/));
    const kotak = screen.getByText("Atau tempel contoh putusan").closest("label")!.querySelector("textarea")!;
    fireEvent.change(kotak, { target: { value: "MENGADILI\nSiti Rahmawati binti Ahmad NIK 7271098765432101" } });
    expect(hasil()).toContain("#CONTOH_FORMAT");
    expect(hasil()).not.toMatch(/Rahmawati|7271098765432101/);
    fireEvent.change(screen.getByPlaceholderText(/Nama format/), { target: { value: "Cerai gugat kabul" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    const tersimpan = JSON.parse(window.localStorage.getItem("aleta.prompt-ai.format-saya.usr_uji_1") || "[]");
    expect(tersimpan).toHaveLength(1);
    expect(tersimpan[0].nama).toBe("Cerai gugat kabul");
    expect(tersimpan[0].teks).not.toMatch(/Rahmawati|7271098765432101/);
  });
});

describe("hak mengubah profil", () => {
  it("hanya Super Admin", () => {
    expect(bolehMengubahProfilProject({ roleId: "super-admin" })).toBe(true);
    expect(bolehMengubahProfilProject({ roleId: "admin" })).toBe(false);
    expect(bolehMengubahProfilProject({ roleId: "hakim" })).toBe(false);
    expect(bolehMengubahProfilProject(null)).toBe(false);
  });
});
