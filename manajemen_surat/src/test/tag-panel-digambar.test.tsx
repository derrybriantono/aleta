import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PanelTagPerkara } from "@/components/portal/aleta-ecourt-status-perkara";

/**
 * ============================================================================
 * PANEL TAG - DIGAMBAR, BUKAN DIBACA DARI SUMBERNYA
 * ============================================================================
 *
 * tag-perkara.test.ts memeriksa NILAI katalognya dan menyisir teks layarnya.
 * Keduanya berguna, tetapi tidak satu pun dapat membedakan panel yang menggambar
 * 88 chip dari panel yang menggambar nol chip: penyisir teks tetap hijau selama
 * kodenya tertulis, walau tidak satu elemen pun sampai ke layar.
 *
 * Berkas ini menekan chipnya dengan tangan dan membaca apa yang tergambar.
 *
 * ============================================================================
 * YANG PALING PENTING DI SINI: "…" BUKAN "0"
 * ============================================================================
 *
 * Menghitung 88 tag memakan 6,6 detik pada lingkup "Seluruhnya" - terukur di
 * salinan satker, 19 kueri atas tabel anak. Karena itu panel berdiri lebih
 * dahulu dengan katalognya saja, dan angkanya menyusul.
 *
 * Selama itu chipnya HARUS bertanda "…" dan HARUS tetap dapat ditekan. Kalau
 * angkanya digambar sebagai 0, chipnya dimatikan - dan panel yang berdiri
 * seketika tetap tidak dapat dipakai selama enam setengah detik pertama, yaitu
 * tepat cacat yang hendak dihapus.
 */

const KELOMPOK = [
  { kunci: "keadaan", label: "Keadaan perkara" },
  { kunci: "tunggakan", label: "Tunggakan dan umur perkara" },
];

const TAG = [
  {
    kunci: "belum-putus",
    label: "Belum putus",
    kelompok: "keadaan",
    nada: "awas",
    judul: "Belum ada baris putusan bertanggal pada perkara ini.",
  },
  {
    kunci: "sudah-putus",
    label: "Sudah putus",
    kelompok: "keadaan",
    nada: "aman",
    judul: "Sudah ada tanggal putusan pada perkara ini.",
  },
  {
    kunci: "bht-tanpa-ikrar",
    label: "Cerai talak BHT, ikrar belum",
    kelompok: "tunggakan",
    nada: "bahaya",
    judul: "Sudah berkekuatan hukum tetap tetapi ikrar talak belum dilaksanakan.",
  },
];

const DASAR = [
  { kunci: "daftar", label: "Didaftarkan" },
  { kunci: "putus", label: "Diputus" },
];

type Prop = Parameters<typeof PanelTagPerkara>[0];

function gambar(timpa: Partial<Prop> = {}) {
  const prop: Prop = {
    katalog: {
      // null = BELUM DIHITUNG. Inilah keadaan panel pada detik pertama.
      jumlah: null,
      lingkup: null,
      tag: TAG,
      kelompok: KELOMPOK,
      dasar: DASAR,
      batasId: 20000,
    },
    memuat: true,
    galat: "",
    dipilih: [],
    dasar: "daftar",
    periode: "total",
    dari: "",
    sampai: "",
    acuan: "",
    cari: "",
    onUbahDasar: vi.fn(),
    onUbahPeriode: vi.fn(),
    onUbahDari: vi.fn(),
    onUbahSampai: vi.fn(),
    onUbahAcuan: vi.fn(),
    onUbahCari: vi.fn(),
    onPilih: vi.fn(),
    onKosongkan: vi.fn(),
    onJalankan: vi.fn(),
    sedangMencari: false,
    ...timpa,
  } as Prop;
  return { ...render(<PanelTagPerkara {...prop} />), prop };
}

/** Katalog yang angkanya SUDAH dihitung. */
const sudahDihitung = {
  jumlah: { "belum-putus": 127, "sudah-putus": 9993, "bht-tanpa-ikrar": 0 },
  lingkup: { dari: "", sampai: "", perkara: 10120 },
  tag: TAG,
  kelompok: KELOMPOK,
  dasar: DASAR,
  batasId: 20000,
};

afterEach(cleanup);

describe("panel tag digambar", () => {
  it("chipnya tergambar beserta kelompoknya, bahkan sebelum angkanya ada", () => {
    gambar();
    expect(screen.getByText("Keadaan perkara")).toBeTruthy();
    expect(screen.getByText("Tunggakan dan umur perkara")).toBeTruthy();
    for (const x of TAG) {
      expect(screen.getByText(x.label, { exact: false }), x.kunci).toBeTruthy();
    }
  });

  it("selama angkanya belum ada, chipnya bertanda … dan TETAP dapat ditekan", () => {
    const { prop } = gambar();
    const chip = screen.getByRole("button", { name: /Belum putus/ });
    expect(chip.textContent).toContain("…");
    expect(chip.textContent).not.toContain("0");
    expect((chip as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(chip);
    expect(prop.onPilih).toHaveBeenCalledWith("belum-putus");
  });

  it("sesudah angkanya datang, angkanya tergambar dan yang nol dimatikan", () => {
    gambar({ katalog: sudahDihitung, memuat: false });
    expect(screen.getByRole("button", { name: /Belum putus/ }).textContent).toContain("127");
    expect(screen.getByRole("button", { name: /Sudah putus/ }).textContent).toContain("9.993");

    // Yang nol TETAP TAMPAK - membuangnya membuat daftarnya berubah bentuk tiap
    // rentang waktu diganti - hanya dimatikan.
    const nol = screen.getByRole("button", { name: /Cerai talak BHT/ }) as HTMLButtonElement;
    expect(nol).toBeTruthy();
    expect(nol.disabled).toBe(true);
  });

  it("tag yang menyala tetap dapat ditekan walau jumlahnya nol", () => {
    // Melepas tag yang menyala tidak boleh mustahil hanya karena lingkup
    // waktunya berganti dan jumlahnya menjadi nol.
    gambar({ katalog: sudahDihitung, memuat: false, dipilih: ["bht-tanpa-ikrar"] });
    const chip = screen.getByRole("button", { name: /Cerai talak BHT/ }) as HTMLButtonElement;
    expect(chip.disabled).toBe(false);
  });

  it("kotak saring menyaring nama DAN penjelasannya", () => {
    // "ikrar" hanya ada pada label satu tag; "putusan" hanya ada pada
    // PENJELASAN dua tag yang lain - dan itulah gunanya penjelasan ikut disaring.
    gambar({ katalog: sudahDihitung, memuat: false, cari: "ikrar" });
    expect(screen.queryByRole("button", { name: /Cerai talak BHT/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Belum putus/ })).toBeNull();
    expect(screen.getByText(/1 dari 3 tag cocok/)).toBeTruthy();

    cleanup();
    gambar({ katalog: sudahDihitung, memuat: false, cari: "putusan" });
    expect(screen.queryByRole("button", { name: /Belum putus/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sudah putus/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Cerai talak BHT/ })).toBeNull();
  });

  it("tag yang tersaring keluar dari pandangan tetap disebut masih berlaku", () => {
    gambar({ katalog: sudahDihitung, memuat: false, cari: "ikrar", dipilih: ["belum-putus"] });
    expect(screen.getByText(/tetap berlaku walau tidak tampil/)).toBeTruthy();
  });

  it("lingkupnya ditulis apa adanya, bukan dijanjikan", () => {
    gambar({ katalog: sudahDihitung, memuat: false });
    expect(screen.getByText(/seluruh register/)).toBeTruthy();
    expect(screen.getByText(/10\.120 perkara/)).toBeTruthy();
  });

  it("selagi menghitung, layar mengatakannya", () => {
    gambar({ memuat: true });
    expect(screen.getByText(/Menghitung tag/)).toBeTruthy();
  });

  it("kotak Tanggal acuan hanya muncul pada periode yang memerlukannya", () => {
    // "Seluruhnya" tidak punya acuan, dan "antara tanggal" memakai dua
    // tanggalnya sendiri - jadi kotak acuan hanya berarti di antara keduanya.
    gambar({ periode: "total" });
    expect(screen.queryByText("Tanggal acuan")).toBeNull();

    cleanup();
    gambar({ periode: "rentang" });
    expect(screen.queryByText("Tanggal acuan")).toBeNull();
    expect(screen.getByText("Dari")).toBeTruthy();
    expect(screen.getByText("Sampai")).toBeTruthy();

    cleanup();
    gambar({ periode: "triwulan" });
    expect(screen.getByText("Tanggal acuan")).toBeTruthy();
  });

  it("Tampilkan hasil menolak seluruhnya-tanpa-tag, menerima rentang sendirian", () => {
    gambar({ periode: "total", dipilih: [] });
    expect((screen.getByRole("button", { name: "Tampilkan hasil" }) as HTMLButtonElement).disabled).toBe(
      true
    );

    cleanup();
    // Rentang waktu BERDIRI SENDIRI - pengguna menyebutnya sebagai permintaan
    // tersendiri, dan jalurnya terukur cepat (9-148 ms).
    gambar({ periode: "triwulan", dipilih: [] });
    expect((screen.getByRole("button", { name: "Tampilkan hasil" }) as HTMLButtonElement).disabled).toBe(
      false
    );

    cleanup();
    gambar({ periode: "total", dipilih: ["belum-putus"] });
    expect((screen.getByRole("button", { name: "Tampilkan hasil" }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it("galat dari bot digambar, tidak ditelan", () => {
    // Sejak penghitungnya MELEMPAR alih-alih menelan galat, pesannya menyebut
    // tabel dan tag mana yang ikut hilang - dan pesan itu harus sampai ke mata.
    gambar({
      galat: "Tag perkara gagal dihitung pada tabel perkara_pelaksanaan_relaas",
      memuat: false,
    });
    expect(screen.getByText(/perkara_pelaksanaan_relaas/)).toBeTruthy();
  });

  it("tujuh dasar tanggal tergambar sebagai pilihan", () => {
    gambar({ katalog: { ...sudahDihitung, dasar: DASAR }, memuat: false });
    const pilih = screen.getByText("Tanggal yang dihitung").closest("label");
    expect(pilih).toBeTruthy();
    for (const d of DASAR) {
      expect(screen.getByRole("option", { name: d.label }), d.kunci).toBeTruthy();
    }
  });
});
