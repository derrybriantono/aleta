// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ChipSaring,
  KepalaUrut,
  PanelCariLanjut,
  type Urutan,
  useUrutan,
} from "@/components/portal/tabel-kendali";

/**
 * Tampilan kendali tabel: kepala yang dapat diurutkan, kotak saringan, dan
 * panel pencarian lanjutan.
 *
 * ============================================================================
 * DIRENDER SUNGGUHAN, BUKAN DIPERIKSA TULISANNYA
 * ============================================================================
 *
 * Yang diuji di sini perilaku saat ditekan - putaran naik, turun, lalu kembali
 * ke urutan asal - dan itu tidak dapat dibuktikan dengan membaca kode. Uji yang
 * hanya memeriksa bahwa fungsinya ada akan tetap hijau walau tombolnya tidak
 * pernah tersambung ke apa pun.
 */

function KepalaPercobaan() {
  const { urutan, tekan } = useUrutan(null);
  return (
    <table>
      <thead>
        <tr>
          <KepalaUrut kunci="jam" urutan={urutan} onTekan={tekan}>
            Jam
          </KepalaUrut>
          <KepalaUrut kunci="ruang" urutan={urutan} onTekan={tekan}>
            Ruang
          </KepalaUrut>
        </tr>
      </thead>
    </table>
  );
}

describe("kepala kolom yang dapat diurutkan", () => {
  it("berputar naik, turun, lalu kembali ke urutan asal", () => {
    render(<KepalaPercobaan />);
    const jam = screen.getByRole("button", { name: /jam/i });
    const kolom = jam.closest("th") as HTMLElement;

    // Putaran ketiga penting: tanpa jalan kembali, satu tekanan yang tidak
    // disengaja mengunci tabelnya sampai halamannya dimuat ulang.
    expect(kolom).toHaveAttribute("aria-sort", "none");
    fireEvent.click(jam);
    expect(kolom).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(jam);
    expect(kolom).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(jam);
    expect(kolom).toHaveAttribute("aria-sort", "none");
  });

  it("berpindah kolom selalu mulai dari menaik", () => {
    render(<KepalaPercobaan />);
    const jam = screen.getByRole("button", { name: /jam/i });
    const ruang = screen.getByRole("button", { name: /ruang/i });

    fireEvent.click(jam);
    fireEvent.click(jam); // menurun
    fireEvent.click(ruang);

    expect(jam.closest("th")).toHaveAttribute("aria-sort", "none");
    expect(ruang.closest("th")).toHaveAttribute("aria-sort", "ascending");
  });

  it("menyatakan arah urutannya kepada pembaca layar", () => {
    const urutan: Urutan = { kunci: "jam", arah: "turun" };
    render(
      <table>
        <thead>
          <tr>
            <KepalaUrut kunci="jam" urutan={urutan} onTekan={() => {}}>
              Jam
            </KepalaUrut>
          </tr>
        </thead>
      </table>
    );
    expect(screen.getByRole("columnheader")).toHaveAttribute("aria-sort", "descending");
  });
});

describe("kotak saringan", () => {
  it("menyebut jumlah dan labelnya", () => {
    render(
      <ChipSaring label="Retur" jumlah={3} nada="bahaya" aktif={false} onTekan={() => {}} />
    );
    expect(screen.getByRole("button")).toHaveTextContent("3");
    expect(screen.getByRole("button")).toHaveTextContent("Retur");
  });

  it("menyatakan keadaan tertekan saat aktif", () => {
    render(<ChipSaring label="Ditunda" jumlah={2} aktif onTekan={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("yang jumlahnya nol tetap digambar, tetapi tidak dapat ditekan", () => {
    // Menyembunyikannya membuat deretan saringan berubah-ubah tiap ganti
    // tanggal, dan yang mencari "retur" pada hari tanpa retur akan mengira
    // fiturnya hilang - bukan mengira angkanya nol.
    const tekan = vi.fn();
    render(<ChipSaring label="Retur" jumlah={0} aktif={false} onTekan={tekan} />);
    const tombol = screen.getByRole("button");
    expect(tombol).toBeDisabled();
    fireEvent.click(tombol);
    expect(tekan).not.toHaveBeenCalled();
  });

  it("yang jumlahnya nol TETAP dapat ditekan bila sedang aktif", () => {
    // Kalau tidak, saringan yang menyisakan nol baris mengunci dirinya sendiri
    // dan tidak dapat dimatikan lagi.
    const tekan = vi.fn();
    render(<ChipSaring label="Retur" jumlah={0} aktif onTekan={tekan} />);
    fireEvent.click(screen.getByRole("button"));
    expect(tekan).toHaveBeenCalledTimes(1);
  });
});

function PanelPercobaan() {
  const [isian, setIsian] = useState<Record<string, string>>({});
  const jumlahAktif = Object.values(isian).filter((x) => x.trim() !== "").length;
  return (
    <PanelCariLanjut
      medan={[
        { kunci: "nomor", label: "Nomor perkara" },
        { kunci: "sisaHari", label: "Sisa hari", jenis: "angka" },
        { kunci: "hasil", label: "Hasil", jenis: "pilih", pilihan: ["Berhasil", "Tidak berhasil"] },
      ]}
      isian={isian}
      onUbah={(kunci, nilai) => setIsian((x) => ({ ...x, [kunci]: nilai }))}
      onBersihkan={() => setIsian({})}
      jumlahAktif={jumlahAktif}
    />
  );
}

describe("panel pencarian lanjutan", () => {
  it("menggambar isian teks, rentang angka, dan daftar pilihan", () => {
    render(<PanelPercobaan />);
    expect(screen.getByText("Nomor perkara")).toBeInTheDocument();
    // Rentang angka menjadi DUA kotak - dari dan sampai.
    expect(screen.getByPlaceholderText("dari")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("sampai")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("daftar pilihan selalu punya pilihan Semua", () => {
    render(<PanelPercobaan />);
    // Tanpa "Semua", medan pilih yang terlanjur diisi tidak dapat dikosongkan.
    expect(screen.getByRole("option", { name: "Semua" })).toBeInTheDocument();
  });

  it("menghitung berapa medan yang sedang terisi", () => {
    render(<PanelPercobaan />);
    const kosongkan = screen.getByRole("button", { name: /kosongkan/i });
    expect(kosongkan).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nomor perkara"), { target: { value: "521" } });
    expect(screen.getByRole("button", { name: /kosongkan \(1\)/i })).toBeEnabled();
  });

  it("mengosongkan seluruh medan sekaligus", () => {
    render(<PanelPercobaan />);
    const nomor = screen.getByLabelText("Nomor perkara") as HTMLInputElement;
    fireEvent.change(nomor, { target: { value: "521" } });
    expect(nomor.value).toBe("521");

    fireEvent.click(screen.getByRole("button", { name: /kosongkan/i }));
    expect((screen.getByLabelText("Nomor perkara") as HTMLInputElement).value).toBe("");
  });
});
