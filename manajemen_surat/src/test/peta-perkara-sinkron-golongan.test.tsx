/**
 * "Jenis perkara" di atas halaman ikut memilih golongan bulatan peta.
 *
 * Petanya dilahirkan ulang tiap kali data halaman dibaca ulang, dan yang
 * dibacanya saat lahir adalah INGATAN golongan (localStorage). Karena itu yang
 * diperiksa di sini: memilih jenis perkara di menu halaman menulis pilihan
 * yang sepadan ke ingatan itu - "cerai" untuk Perceraian, "jenis" (tepat jenis
 * terpilih) untuk jenis tunggal - dan peta menerima jenis terpilih beserta
 * golongannya. Halaman SUNGGUHAN digambar; yang dipalsukan hanya jaringan dan
 * peta malasnya.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PetaPerkara } from "@/components/portal/peta-perkara";
import { KUNCI_INGAT_GOLONGAN } from "@/lib/peta-perkara-ukur";

type PropPeta = { jenisTerpilih?: string; golonganJenis?: string; saringan?: { kelompok?: string } };
const petaDiberi: PropPeta[] = vi.hoisted(() => []);

vi.mock("next/dynamic", () => ({
  default: () =>
    function PetaPalsu(props: PropPeta) {
      petaDiberi.push(props);
      return <div data-uji="peta-palsu" />;
    },
}));

const MENU = [
  { kunci: "perceraian", nama: "Perceraian (Gugat + Talak)", perkara: 5470, gabungan: true, golongan: "cerai" },
  { kunci: "Pengesahan Perkawinan/Istbat Nikah", nama: "Pengesahan Perkawinan/Istbat Nikah", perkara: 3956, gabungan: false, golongan: "itsbat" },
  { kunci: "Dispensasi Kawin", nama: "Dispensasi Kawin", perkara: 195, gabungan: false, golongan: "dispensasi" },
  { kunci: "Perwalian", nama: "Perwalian", perkara: 87, gabungan: false, golongan: "lainnya" },
];

const HASIL = {
  ok: true,
  kelompok: "perceraian",
  kelompokNama: "Perceraian (Gugat + Talak)",
  perceraian: true,
  penanda: { "Cerai Gugat": "merah", "Cerai Talak": "biru" },
  jenisMuncul: {},
  tingkat: "kabupaten",
  induk: "",
  rentang: { dari: "2026-01-01", sampai: "2026-12-31" },
  petaGeografis: false,
  alasanTanpaPeta: "uji",
  titik: [],
  titikSeluruhJenis: true,
  titikTanpaKode: 0,
  ringkas: { diputus: 0, beralamat: 0, larutNama: 0, persenBeralamat: 100, terpetakan: 0, lelaki: 0, perempuan: 0, persenPerempuan: 0 },
  wilayah: [],
  faktor: [],
};

/** Jawaban halaman mengikuti kelompok yang diminta, seperti bot sungguhan. */
function jawabHalaman(alamat: string) {
  const kelompok = new URL(alamat, "http://uji").searchParams.get("kelompok") || "perceraian";
  return kelompok === "perceraian"
    ? HASIL
    : { ...HASIL, kelompok, kelompokNama: kelompok, perceraian: false, penanda: {} };
}

beforeEach(() => {
  window.localStorage.clear();
  petaDiberi.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      const isi = String(alamat).includes("menu=1") ? { ok: true, menu: MENU } : jawabHalaman(String(alamat));
      return new Response(JSON.stringify({ ok: true, data: isi }), { status: 200 });
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Jenis perkara di halaman menyetel pilihan bulatan peta", () => {
  it("jenis TUNGGAL -> 'jenis' (tepat jenis itu, sama dengan tabel); Perceraian -> cerai", async () => {
    render(<PetaPerkara />);
    const pilih = (await screen.findByRole("option", { name: /Dispensasi Kawin/ })).closest("select") as HTMLSelectElement;
    // Memuat halaman TIDAK mengubah ingatan - pilihan terakhir petugas tetap.
    expect(window.localStorage.getItem(KUNCI_INGAT_GOLONGAN)).toBeNull();

    // Telaah 2.40.0: Perwalian dahulu menulis "lainnya", dan bulatannya
    // memuat seluruh golongan lainnya sementara tabelnya hanya Perwalian.
    // Itsbat pun sama: "Pengesahan Perkawinan/Istbat Nikah" (3.956) bukan
    // golongan itsbat (4.045, kedua ejaan).
    for (const [kunci, pilihan] of [
      ["Dispensasi Kawin", "jenis"],
      ["Pengesahan Perkawinan/Istbat Nikah", "jenis"],
      ["Perwalian", "jenis"],
      ["perceraian", "cerai"],
    ]) {
      fireEvent.change(pilih, { target: { value: kunci } });
      await waitFor(() => expect(window.localStorage.getItem(KUNCI_INGAT_GOLONGAN)).toBe(pilihan));
    }
  });

  it("peta menerima jenis terpilih dan golongannya dari halaman", async () => {
    render(<PetaPerkara />);
    const pilih = (await screen.findByRole("option", { name: /Perwalian/ })).closest("select") as HTMLSelectElement;
    fireEvent.change(pilih, { target: { value: "Perwalian" } });
    await waitFor(() => expect(petaDiberi.at(-1)?.saringan?.kelompok).toBe("Perwalian"));
    const terakhir = petaDiberi.at(-1)!;
    expect(terakhir.jenisTerpilih).toBe("Perwalian");
    expect(terakhir.golonganJenis).toBe("lainnya");
  });

  it("menu dari bot yang lebih tua (tanpa golongan): jenis tunggal tetap 'jenis'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        const isi = String(alamat).includes("menu=1")
          ? { ok: true, menu: MENU.map(({ golongan: _g, ...m }) => m) }
          : jawabHalaman(String(alamat));
        return new Response(JSON.stringify({ ok: true, data: isi }), { status: 200 });
      })
    );
    window.localStorage.setItem(KUNCI_INGAT_GOLONGAN, "itsbat");
    render(<PetaPerkara />);
    const pilih = (await screen.findByRole("option", { name: /Dispensasi Kawin/ })).closest("select") as HTMLSelectElement;
    fireEvent.change(pilih, { target: { value: "Dispensasi Kawin" } });
    await waitFor(() => expect(pilih.value).toBe("Dispensasi Kawin"));
    // Pilihan "jenis" tidak memerlukan golongan dari bot: bulatannya dihitung
    // dari rincian nama jenis tiap desa, yang dikirim bot tua pun.
    await waitFor(() => expect(window.localStorage.getItem(KUNCI_INGAT_GOLONGAN)).toBe("jenis"));
  });
});
