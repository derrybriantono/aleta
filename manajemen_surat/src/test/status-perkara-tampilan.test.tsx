import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextRequest } from "next/server";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HasilPencarianPerkara,
  type BarisHasil,
  type TampilanHasil,
  type Urutan,
} from "@/components/portal/status-perkara-hasil";
import { ID_LEMBAR_CETAK_HASIL } from "@/components/portal/status-perkara-cetak";

// Layar Status Perkara memanggil usePortal untuk nama pengadilan (kop lembar
// cetak) dan hak akses. Yang lain dari app-state dibiarkan asli.
vi.mock("@/lib/app-state", async (asli) => ({
  ...(await asli<typeof import("@/lib/app-state")>()),
  usePortal: () => ({
    institutionIdentity: { courtName: "Pengadilan Agama Contoh" },
    accessibleModules: [],
  }),
}));

// Rute portal status-perkara dijalankan SUNGGUHAN oleh beberapa uji di bawah
// (jawaban bot lama, galat habis waktu): HANYA kewenangan dan basis data
// portal yang dipalsukan - penerus jawaban bot, pengubah galat, dan layarnya
// asli.
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ name: "Penguji" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));

import { AletaEcourtStatusPerkara } from "@/components/portal/aleta-ecourt-status-perkara";

/**
 * ============================================================================
 * TAMPILAN HASIL STATUS PERKARA - DIGAMBAR, DIKLIK, DIBACA
 * ============================================================================
 *
 * Permintaan pengguna 25 September 2026, butir 7, 8, 9: hasil pencarian dapat
 * dilihat sebagai Detail, Daftar, Kotak, dan Kelompok; kepala tabel Detail
 * dapat diklik untuk mengurutkan; tabelnya menggulung di dalam kotaknya; hasil
 * dapat dicetak; panel Tag dan Saringan mengecil sendiri sesudah hasilnya
 * datang.
 *
 * Tidak satu pun uji di sini menyisir teks sumber. Yang diperiksa adalah apa
 * yang TERGAMBAR: urutan baris yang sungguh berubah, aria-sort yang sungguh
 * terpasang, lembar cetak yang sungguh berisi baris dalam urutan layar, dan
 * panel yang sungguh berganti menjadi bilah ringkas.
 *
 * Nama orang dan nomor perkara di sini karangan.
 */

// Data sengaja dipilih supaya urutan yang SALAH CARA menghasilkan urutan yang
// berbeda dari yang benar:
//   - tanggal putus 31-12-2025, 20-02-2026, 10-03-2026: diurutkan sebagai teks
//     tampilan ("31-12-2025" / "Rab, 31-12-2025") hasilnya lain dari tanggal;
//   - umur 19, 64, 212, 1.268: sebagai teks "1268" jatuh sebelum "19";
//   - nomor 999/2025 dan 1000/2025: sebagai teks 1000 jatuh sebelum 999;
//   - dua "Cerai Gugat": urutannya harus stabil.
const BARIS: BarisHasil[] = [
  {
    perkaraId: "11",
    nomorPerkara: "12/Pdt.G/2026/PA.Ctt",
    jenisPerkara: "Cerai Gugat",
    tanggalDaftar: "2026-01-05",
    sudahPutus: true,
    tanggalPutusan: "2026-03-10",
    statusPutusan: "Dikabulkan",
    pihak1: "Siti Aminah binti Karim",
    sebutanPihak1: "Penggugat",
    pihak2: "Ahmad bin Yusuf",
    sebutanPihak2: "Tergugat",
    kuasa: "",
    tahapan: "Minutasi",
    proses: "Minutasi",
    hakimKetua: "Hakim Pertama, S.H.I.",
    paniteraPengganti: "Panitera Satu",
    jurusita: "Jurusita Satu",
    jumlahSidang: 10,
    sidangTerakhir: "2026-03-10",
    sidangBerikut: "",
    umurHari: 64,
    ecourt: true,
    nomorAktaCerai: "0101/AC/2026/PA.Ctt",
    tanggalAktaCerai: "2026-03-30",
    cocok: [{ medan: "Pihak", nilai: "Siti Aminah binti Karim" }],
  },
  {
    perkaraId: "22",
    nomorPerkara: "1000/Pdt.G/2025/PA.Ctt",
    jenisPerkara: "Cerai Talak",
    tanggalDaftar: "2025-12-31",
    sudahPutus: false,
    tanggalPutusan: "",
    pihak1: "Rahmat bin Sulaiman",
    sebutanPihak1: "Pemohon",
    pihak2: "Nurhayati binti Abdullah",
    sebutanPihak2: "Termohon",
    kuasa: "Advokat Contoh, S.H.",
    tahapan: "Persidangan",
    proses: "Sidang Pertama",
    jumlahSidang: 2,
    sidangTerakhir: "2026-01-20",
    sidangBerikut: "2026-10-06",
    umurHari: 1268,
    ecourt: false,
  },
  {
    perkaraId: "33",
    nomorPerkara: "999/Pdt.G/2025/PA.Ctt",
    jenisPerkara: "Isbat Nikah",
    tanggalDaftar: "2025-06-02",
    sudahPutus: true,
    tanggalPutusan: "2025-12-31",
    statusPutusan: "Ditolak",
    pihak1: "Hasanah",
    sebutanPihak1: "Pemohon",
    tahapan: "Minutasi",
    jumlahSidang: 9,
    umurHari: 212,
    ecourt: null,
  },
  {
    perkaraId: "44",
    nomorPerkara: "5/Pdt.P/2026/PA.Ctt",
    jenisPerkara: "Asal Usul Anak",
    tanggalDaftar: "2026-02-01",
    sudahPutus: true,
    tanggalPutusan: "2026-02-20",
    statusPutusan: "Dikabulkan",
    tahapan: "Putusan",
    jumlahSidang: 1,
    umurHari: 19,
    ecourt: true,
  },
  {
    perkaraId: "55",
    nomorPerkara: "7/Pdt.G/2026/PA.Ctt",
    jenisPerkara: "Cerai Gugat",
    tanggalDaftar: "2026-02-10",
    sudahPutus: false,
    tanggalPutusan: "",
    tahapan: "Persidangan",
    umurHari: null,
    ecourt: false,
  },
];

const N = (i: number) => BARIS[i].nomorPerkara;

type PropHasil = Parameters<typeof HasilPencarianPerkara>[0];

/**
 * Pembungkus yang memegang tampilan dan urutan seperti layar sungguhan -
 * keduanya dipegang induk, jadi mengujinya tanpa induk tidak menguji apa pun.
 */
function Rakitan(timpa: Partial<PropHasil> & { awal?: TampilanHasil }) {
  const [tampilan, setTampilan] = useState<TampilanHasil>(timpa.awal ?? "kotak");
  const [urut, setUrut] = useState<Urutan>(null);
  return (
    <HasilPencarianPerkara
      hasil={BARIS}
      tampilan={tampilan}
      onUbahTampilan={setTampilan}
      urut={urut}
      onUbahUrut={setUrut}
      onBuka={vi.fn()}
      adaLagi={false}
      memuatLagi={false}
      onMuatLagi={vi.fn()}
      onMuatSemua={vi.fn()}
      paguMuat={500}
      kriteria={["Kata cari: “cerai”.", "Saringan: tahun pendaftaran 2026."]}
      namaPengadilan="Pengadilan Agama Contoh"
      {...timpa}
    />
  );
}

/** Nomor perkara tiap baris tabel Detail, dari atas ke bawah. */
function urutanTabel(): string[] {
  const wadah = screen.getByTestId("wadah-tabel-hasil");
  return within(wadah)
    .getAllByRole("row")
    .slice(1)
    .map((baris) => String(baris.getAttribute("data-nomor")));
}

function kepala(label: string): HTMLElement {
  const tombol = screen.getByRole("button", { name: new RegExp(`^${label}$`) });
  const th = tombol.closest("th");
  if (!th) throw new Error(`kepala ${label} tidak di dalam th`);
  return th;
}

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // Uji yang memblokir penyimpanan memulihkannya sendiri.
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ===========================================================================
// EMPAT TAMPILAN
// ===========================================================================

describe("butir 7 - empat tampilan hasil", () => {
  it("bawaan LAYAR SUNGGUHAN adalah Kotak bila peramban belum pernah memilih", async () => {
    // Digambar lewat layar utuh, bukan lewat pembungkus uji: pembungkus
    // memegang bawaannya sendiri, dan uji yang memeriksa bawaan pembungkus
    // tetap hijau walau bawaan produknya diubah ke Detail - terbukti lewat
    // gigitan 17 sebelum uji ini ditulis ulang.
    pasangFetch(() => jawabanHasil(BARIS.slice(0, 3)));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await screen.findByText(/3 perkara cocok/);
    // Bawaan tetap Kotak - kebiasaan orang tidak diubah diam-diam.
    expect(screen.getByRole("button", { name: "Kotak" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Kotak hasil")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keempat tampilan dapat dipilih", () => {
    render(<Rakitan awal="kotak" />);
    expect(screen.getByRole("button", { name: "Kotak" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Kotak hasil")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByLabelText("Kotak hasil")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Daftar" }));
    const daftar = screen.getByRole("list", { name: "Daftar hasil" });
    expect(within(daftar).getAllByRole("listitem")).toHaveLength(BARIS.length);
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Kelompok" }));
    // Menurut tahapan: Minutasi 2, Persidangan 2, Putusan 1.
    const minutasi = screen.getByRole("button", { name: /Minutasi\s*2 perkara/ });
    expect(minutasi.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /Putusan\s*1 perkara/ })).toBeTruthy();
  });

  it("kelompok dapat dilipat, dan pengelompokannya dapat diganti", () => {
    render(<Rakitan awal="kelompok" />);
    const minutasi = screen.getByRole("button", { name: /Minutasi\s*2 perkara/ });
    const bagian = minutasi.closest("section") as HTMLElement;
    expect(within(bagian).getByText(N(0))).toBeTruthy();

    fireEvent.click(minutasi);
    expect(minutasi.getAttribute("aria-expanded")).toBe("false");
    expect(within(bagian).queryByText(N(0))).toBeNull();

    fireEvent.change(screen.getByLabelText("Kelompokkan menurut"), { target: { value: "jenis" } });
    expect(screen.getByRole("button", { name: /Cerai Gugat\s*2 perkara/ })).toBeTruthy();
  });

  it("Daftar dan Kotak membuka perkaranya saat diklik; Detail juga, lewat barisnya", () => {
    const onBuka = vi.fn();
    render(<Rakitan awal="daftar" onBuka={onBuka} />);
    fireEvent.click(screen.getByText(N(2)));
    expect(onBuka).toHaveBeenLastCalledWith(N(2));

    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    const baris = screen.getByTestId("wadah-tabel-hasil").querySelector(`tr[data-nomor="${N(3)}"]`);
    fireEvent.click(within(baris as HTMLElement).getByText("Asal Usul Anak"));
    expect(onBuka).toHaveBeenLastCalledWith(N(3));
  });

  it("tidak ada tanggal ISO yang sampai ke layar, di tampilan mana pun", () => {
    render(<Rakitan awal="detail" />);
    for (const tampilan of ["Detail", "Daftar", "Kotak", "Kelompok"]) {
      fireEvent.click(screen.getByRole("button", { name: tampilan }));
      expect(document.body.textContent, tampilan).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    // Nama hari ikut tertulis - bentuk butir 1.
    expect(screen.getAllByText("Sel, 10-03-2026").length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// DETAIL: URUTAN, aria-sort, WADAH
// ===========================================================================

describe("butir 7 - kepala tabel Detail mengurutkan", () => {
  it("tanggal diurutkan sebagai TANGGAL; yang kosong selalu di bawah; klik ketiga kembali ke asal", () => {
    render(<Rakitan awal="detail" />);
    const asal = BARIS.map((x) => x.nomorPerkara);
    expect(urutanTabel()).toEqual(asal);
    expect(kepala("Diputus").getAttribute("aria-sort")).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: /^Diputus$/ }));
    expect(kepala("Diputus").getAttribute("aria-sort")).toBe("ascending");
    // 31-12-2025, 20-02-2026, 10-03-2026, lalu dua yang belum putus.
    expect(urutanTabel()).toEqual([N(2), N(3), N(0), N(1), N(4)]);

    fireEvent.click(screen.getByRole("button", { name: /^Diputus$/ }));
    expect(kepala("Diputus").getAttribute("aria-sort")).toBe("descending");
    // Yang belum putus TETAP di bawah - tidak menutupi yang sudah.
    expect(urutanTabel()).toEqual([N(0), N(3), N(2), N(1), N(4)]);

    fireEvent.click(screen.getByRole("button", { name: /^Diputus$/ }));
    expect(kepala("Diputus").getAttribute("aria-sort")).toBe("none");
    expect(urutanTabel()).toEqual(asal);
  });

  it("angka diurutkan sebagai ANGKA", () => {
    render(<Rakitan awal="detail" />);
    fireEvent.click(screen.getByRole("button", { name: /^Umur \(hari\)$/ }));
    // 19, 64, 212, 1.268, lalu yang tidak berumur.
    expect(urutanTabel()).toEqual([N(3), N(0), N(2), N(1), N(4)]);
    expect(kepala("Umur \\(hari\\)").getAttribute("aria-sort")).toBe("ascending");
    // Hanya satu kolom yang berstatus urut pada satu waktu.
    expect(kepala("Diputus").getAttribute("aria-sort")).toBe("none");
  });

  it("teks diurutkan menurut abjad Indonesia, dan yang seri tetap pada urutan asalnya", () => {
    render(<Rakitan awal="detail" />);
    fireEvent.click(screen.getByRole("button", { name: /^Jenis perkara$/ }));
    expect(urutanTabel()).toEqual([N(3), N(0), N(4), N(1), N(2)]);
  });

  it("nomor perkara diurutkan menurut tahun lalu nomor urutnya sebagai angka", () => {
    render(<Rakitan awal="detail" />);
    fireEvent.click(screen.getByRole("button", { name: /^Nomor perkara$/ }));
    expect(urutanTabel()).toEqual([N(2), N(1), N(3), N(4), N(0)]);
  });

  it("urutan berlaku juga pada tampilan lain, lewat pemilih Urutkan", () => {
    render(<Rakitan awal="daftar" />);
    fireEvent.change(screen.getByLabelText("Urutkan menurut"), { target: { value: "umur" } });
    const daftar = screen.getByRole("list", { name: "Daftar hasil" });
    const teks = within(daftar)
      .getAllByRole("listitem")
      .map((x) => x.textContent ?? "");
    expect(teks[0]).toContain(N(3));
    expect(teks[3]).toContain(N(1));
    fireEvent.click(screen.getByRole("button", { name: /Menaik/ }));
    expect(
      within(screen.getByRole("list", { name: "Daftar hasil" })).getAllByRole("listitem")[0].textContent
    ).toContain(N(1));
  });

  it("wadah tabel menggulung sendiri - tidak mendorong halaman - dan kepalanya menempel", () => {
    render(<Rakitan awal="detail" />);
    const wadah = screen.getByTestId("wadah-tabel-hasil");
    const kelas = wadah.className.split(/\s+/);
    expect(kelas).toContain("overflow-auto");
    expect(kelas).toContain("max-w-full");
    // Batas tinggi menurut tinggi layar PERANGKAT, dengan cadangan vh.
    expect(kelas).toContain("supports-[height:100dvh]:max-h-[70dvh]");
    expect(kelas).toContain("max-h-[70vh]");
    // Tanpa ini lebar tabel merambat ke grid induknya dan halaman ikut
    // bergulir mendatar pada 375 px.
    expect(kelas).toContain("[contain:inline-size]");

    const th = within(wadah).getAllByRole("columnheader");
    expect(th[0].className).toMatch(/\bsticky\b/);
    expect(th[0].className).toMatch(/\btop-0\b/);
    expect(th[0].className).toMatch(/\bleft-0\b/);
    expect(th[5].className).toMatch(/\btop-0\b/);
    const selPertama = within(wadah).getAllByRole("row")[1].querySelector("td");
    expect(selPertama?.className).toMatch(/\bsticky\b/);
    expect(selPertama?.className).toMatch(/\bleft-0\b/);
  });

  it("pengurutan atas hasil yang belum utuh berkata jujur, dan menawarkan memuat semua", () => {
    const onMuatLagi = vi.fn();
    const onMuatSemua = vi.fn();
    render(<Rakitan awal="detail" adaLagi onMuatLagi={onMuatLagi} onMuatSemua={onMuatSemua} />);
    expect(screen.queryByText(/diurutkan dari/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Diputus$/ }));
    expect(
      screen.getByText(/Diurutkan dari 5 perkara yang termuat — muat semua untuk urutan lengkap/)
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Muat lebih banyak" }));
    fireEvent.click(screen.getByRole("button", { name: "Muat semua (sampai 500)" }));
    expect(onMuatLagi).toHaveBeenCalledTimes(1);
    expect(onMuatSemua).toHaveBeenCalledTimes(1);
  });

  it("kolom yang belum dikirim bot versi lama disebutkan, bukan didiamkan", () => {
    const lama = BARIS.map((x) => ({
      perkaraId: x.perkaraId,
      nomorPerkara: x.nomorPerkara,
      jenisPerkara: x.jenisPerkara,
      tanggalDaftar: x.tanggalDaftar,
      sudahPutus: x.sudahPutus,
      tanggalPutusan: x.tanggalPutusan,
    }));
    render(<Rakitan awal="detail" hasil={lama} />);
    expect(screen.getByText(/kolom belum dikirim ALETA Bot versi ini/)).toBeTruthy();
    expect(screen.getByText(/bukan karena SIPP-nya kosong/)).toBeTruthy();
    // Tetap tergambar utuh.
    expect(urutanTabel()).toHaveLength(5);
  });
});

/**
 * Baris sebagaimana dikirim bot ketika sebagian kuerinya GAGAL: lengkapiRuas()
 * membiarkan ruasnya pada nilai awal "tidak ada" ("", 0) dan menyebut nama
 * bagiannya di ruasTakTerbaca; lampirkanCocok() melewatkan keterangannya.
 * Kunci di bawah adalah nama yang sungguh dicatat catatTakTerbaca() di
 * sippStatusPerkaraService.js.
 */
function gagalDibaca(b: BarisHasil): BarisHasil {
  return {
    ...b,
    kuasa: "",
    jumlahSidang: 0,
    sidangTerakhir: "",
    sidangBerikut: "",
    cocok: (b.cocok ?? []).filter((x) => x.medan !== "Kuasa"),
  };
}
const KUNCI_GAGAL = ["kuasa", "sidang", "cocok:Kuasa"];

/** Teks sel tabel Detail pada baris bernomor itu, di kolom berjudul itu. */
function selDetail(nomor: string, judul: string): string {
  const wadah = screen.getByTestId("wadah-tabel-hasil");
  const judulKolom = within(wadah)
    .getAllByRole("columnheader")
    .map((th) => th.textContent ?? "");
  const ke = judulKolom.indexOf(judul);
  if (ke < 0) throw new Error(`kolom ${judul} tidak ada: ${judulKolom.join(" | ")}`);
  const tr = wadah.querySelector(`tr[data-nomor="${nomor}"]`);
  return tr?.querySelectorAll("td")[ke]?.textContent ?? "(baris tidak ada)";
}

describe("butir 7 - keterangan yang gagal dibaca bot disebutkan", () => {
  it("sebutannya terbaca orang, dan selnya 'tak terbaca' - bukan nilai pengisi bot - di layar dan lembar cetak", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.print = vi.fn();
    pasangFetch(() => jawabanHasil(BARIS.slice(0, 3).map(gagalDibaca), { ruasTakTerbaca: KUNCI_GAGAL }));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await screen.findByText(/3 perkara cocok/);

    // Bukan "Keterangan kuasa, sidang, cocok:Kuasa" - nama dalam bot tidak
    // dibaca siapa pun.
    const peringatan = screen.getByRole("status").textContent ?? "";
    expect(peringatan).toContain(
      "Keterangan kuasa hukum, jadwal sidang, keterangan “cocok karena” (kuasa) gagal dibaca dari SIPP untuk 3 dari 3 perkara yang termuat"
    );
    expect(peringatan).not.toContain("cocok:");
    expect(peringatan).not.toContain("Keterangan kuasa,");

    // Kotak (bawaan) dan Daftar pun menyebut keterangan cocok yang gagal
    // dicari - perkara yang ketemu lewat nama kuasa tidak tampil tanpa alasan.
    const kotak = screen.getByLabelText("Kotak hasil");
    expect(within(kotak).getAllByText("Keterangan cocok tak terbaca: kuasa")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Daftar" }));
    const daftar = screen.getByRole("list", { name: "Daftar hasil" });
    expect(within(daftar).getAllByText("Keterangan cocok tak terbaca: kuasa")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    // Bot mengisi jumlahSidang 0 untuk kueri sidang yang gagal. "0" di sini
    // adalah angka karangan.
    expect(selDetail(N(0), "Jumlah sidang")).toBe("tak terbaca");
    expect(selDetail(N(0), "Kuasa hukum")).toBe("tak terbaca");
    expect(selDetail(N(1), "Sidang berikut")).toBe("tak terbaca");
    // Keterangan cocok yang TERBACA tetap tampil; yang gagal disebut.
    expect(selDetail(N(0), "Cocok karena")).toBe("Pihak: Siti Aminah binti Karimtak terbaca: kuasa");
    // Kolom yang tidak gagal tetap bernilai.
    expect(selDetail(N(0), "Hakim ketua")).toBe("Hakim Pertama, S.H.I.");

    fireEvent.click(screen.getByRole("button", { name: /Cetak$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Semua kolom" }));
    fireEvent.click(screen.getByRole("button", { name: "Cetak sekarang" }));
    const lembar = document.getElementById(ID_LEMBAR_CETAK_HASIL);
    expect(lembar?.textContent).toContain(
      "Keterangan kuasa hukum, jadwal sidang, keterangan “cocok karena” (kuasa) gagal dibaca dari SIPP untuk 3 perkara"
    );
    const kepalaCetak = [...(lembar?.querySelectorAll("thead th") ?? [])].map((x) => x.textContent);
    const barisCetak = [...(lembar?.querySelectorAll("tbody tr") ?? [])].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent)
    );
    expect(barisCetak[0][kepalaCetak.indexOf("Jumlah sidang")]).toBe("tak terbaca");
    expect(barisCetak[0][kepalaCetak.indexOf("Kuasa hukum")]).toBe("tak terbaca");
    expect(barisCetak[0][kepalaCetak.indexOf("Cocok karena")]).toBe(
      "Pihak: Siti Aminah binti Karim; tak terbaca: kuasa"
    );
  });

  it("pihak dan tahapan yang gagal dibaca tertulis 'tak terbaca' di tabel Detail, bukan '—'", () => {
    // Kolom pihak dan tahapan punya penggambar sel sendiri (sebutan di atas
    // nama, proses di bawah tahapan). Penanda gagalnya harus sampai ke sana
    // juga - bukan hanya ke kolom teks biasa. Terbukti lewat gigitan 25: uji
    // di atas tetap hijau walau penanda di penggambar sel dimatikan.
    const baris = BARIS.map((b, i) =>
      i === 0 ? { ...b, pihak1: "", pihak2: "", tahapan: "", proses: "", takTerbaca: ["pihak", "perkara"] } : b
    );
    render(<Rakitan awal="detail" hasil={baris} />);
    for (const judul of ["Pihak pertama", "Pihak kedua", "Tahapan / proses"]) {
      expect(selDetail(N(0), judul), judul).toBe("tak terbaca");
    }
    // Penjelasannya ikut, bagi yang mengarahkan tetikus ke selnya.
    const tr = screen.getByTestId("wadah-tabel-hasil").querySelector(`tr[data-nomor="${N(0)}"]`) as HTMLElement;
    expect(within(tr).getAllByTitle(/Gagal dibaca dari SIPP/)).toHaveLength(3);
    // Baris lain tidak tersentuh.
    expect(selDetail(N(1), "Pihak pertama")).toBe("PemohonRahmat bin Sulaiman");
    expect(selDetail(N(1), "Tahapan / proses")).toBe("PersidanganSidang Pertama");
  });

  it("halaman yang gagal hanya menandai barisnya sendiri, bukan halaman yang terbaca utuh", async () => {
    pasangFetch((url) => {
      const lewati = new URL(url, "http://x").searchParams.get("lewati");
      return lewati
        ? jawabanHasil(BARIS.slice(3).map(gagalDibaca), { adaLagi: false, ruasTakTerbaca: KUNCI_GAGAL })
        : jawabanHasil(BARIS.slice(0, 3), { adaLagi: true });
    });
    render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    // Halaman pertama dengan adaLagi: kepalanya menyebut yang TERMUAT, bukan
    // "3 perkara cocok" (telaah 26 September 2026).
    await screen.findByText(/3 perkara pertama termuat — masih ada yang cocok/);
    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Muat lebih banyak" }));
    await screen.findByText(/5 perkara cocok/);
    expect(screen.getByRole("status").textContent).toContain("untuk 2 dari 5 perkara yang termuat");

    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    // Halaman pertama terbaca utuh - kuasanya tetap tampil.
    expect(selDetail(N(1), "Kuasa hukum")).toBe("Advokat Contoh, S.H.");
    expect(selDetail(N(0), "Jumlah sidang")).toBe("10");
    // Halaman kedua yang gagal.
    expect(selDetail(N(3), "Kuasa hukum")).toBe("tak terbaca");
    expect(selDetail(N(4), "Jumlah sidang")).toBe("tak terbaca");
  });

  it("yang gagal dibaca diurutkan sebagai KOSONG - di bawah - bukan sebagai nilai pengisinya", () => {
    // Dua baris kueri sidangnya gagal: jumlahSidang-nya 0 pengisi bot.
    const baris = BARIS.map((b, i) =>
      i === 1 || i === 3 ? { ...gagalDibaca(b), takTerbaca: ["sidang"] } : { ...b, jumlahSidang: b.jumlahSidang ?? 4 }
    );
    render(<Rakitan awal="detail" hasil={baris} />);
    fireEvent.click(screen.getByRole("button", { name: /^Jumlah sidang$/ }));
    // Menaik: 4 (baris 4), 9, 10, lalu yang tak terbaca di bawah - bukan
    // "0" di puncak.
    expect(urutanTabel()).toEqual([N(4), N(2), N(0), N(1), N(3)]);
    fireEvent.click(screen.getByRole("button", { name: /^Jumlah sidang$/ }));
    expect(urutanTabel()).toEqual([N(0), N(2), N(4), N(1), N(3)]);
  });

  it("perkara yang tahapannya gagal dibaca dikelompokkan tersendiri, bukan sebagai 'tidak tercatat di SIPP'", () => {
    const baris = BARIS.map((b, i) => (i === 0 ? { ...b, tahapan: "", proses: "", takTerbaca: ["perkara"] } : b));
    render(<Rakitan awal="kelompok" hasil={baris} />);
    expect(screen.getByRole("button", { name: /Tahapan gagal dibaca dari SIPP\s*1 perkara/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /tidak tercatat di SIPP/ })).toBeNull();
    // Minutasi tinggal satu - baris yang gagal tidak dihitung ke sana.
    expect(screen.getByRole("button", { name: /Minutasi\s*1 perkara/ })).toBeTruthy();
  });

  it("tanpa ruasTakTerbaca tidak ada peringatan", () => {
    render(<Rakitan awal="detail" />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("butir 8 - pencarian kata bebas yang diperdalam dikatakan", () => {
  it("lapis dalam dari bot disebut di atas hasil dan di lembar cetak; lapis cepat tidak", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.print = vi.fn();
    pasangFetch((url) => {
      const kata = new URL(url, "http://x").searchParams.get("cari");
      return jawabanHasil(BARIS.slice(0, 3), { lapis: kata === "pembuktian" ? "dalam" : "cepat" });
    });
    render(<AletaEcourtStatusPerkara />);
    const kotak = screen.getByPlaceholderText(/419, nama pihak/);
    fireEvent.change(kotak, { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await screen.findByText(/3 perkara cocok/);
    // Keterangan kotak cari juga menyebut "diperdalam" - yang dicari di sini
    // kalimat tentang HASIL ini.
    expect(screen.queryByText(/Kata cari tidak cocok pada nomor perkara/)).toBeNull();

    fireEvent.change(kotak, { target: { value: "pembuktian" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    expect(await screen.findByText(/Kata cari tidak cocok pada nomor perkara.*pencarian diperdalam/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Cetak$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cetak sekarang" }));
    const lembar = document.getElementById(ID_LEMBAR_CETAK_HASIL)?.textContent ?? "";
    expect(lembar).toContain("Kata cari: “pembuktian”.");
    expect(lembar).toMatch(/Kata cari tidak cocok pada nomor perkara.*pencarian diperdalam/);
  });

  it("kotak cari diterangkan: medan baru disebut, dan cara bacanya dapat dibuka", () => {
    render(<AletaEcourtStatusPerkara />);
    const kotak = screen.getByPlaceholderText(/419, nama pihak/);
    const idKeterangan = kotak.getAttribute("aria-describedby") ?? "";
    const keterangan = document.getElementById(idKeterangan)?.textContent ?? "";
    for (const medan of ["kuasa hukum", "NIK/telepon", "akta cerai", "banding/kasasi/PK", "verstek", "agenda sidang"]) {
      expect(keterangan, medan).toContain(medan);
    }
    // Lapis dalam hanya berjalan bila lapis cepat kosong - itu dikatakan,
    // bukan dijanjikan seolah alamat dan pertimbangan selalu disisir.
    expect(keterangan).toMatch(/bila tidak ada yang cocok,\s+diperdalam ke alamat/);
    const rinci = screen.getByText("Cara kata bebas dibaca").closest("details") as HTMLDetailsElement;
    expect(rinci.open).toBe(false);
    fireEvent.click(screen.getByText("Cara kata bebas dibaca"));
    expect(rinci.open).toBe(true);
    expect(rinci.textContent).toContain("“41” tidak memunculkan 410 sampai 419");
  });
});

// ===========================================================================
// SARINGAN DI LAYAR
// ===========================================================================

describe("butir 8 - saringan atas hasil yang termuat", () => {
  it("menjangkau kolom yang tidak punya kotak saringan sendiri, dan menyebut sisanya", () => {
    render(<Rakitan awal="detail" />);
    fireEvent.change(screen.getByLabelText("Saring hasil yang termuat"), { target: { value: "advokat" } });
    expect(urutanTabel()).toEqual([N(1)]);
    expect(screen.getByText(/Menampilkan 1 dari 5 perkara yang termuat/)).toBeTruthy();
  });
});

// ===========================================================================
// CETAK
// ===========================================================================

describe("butir 8 - cetak hasil", () => {
  it("lembar cetak berisi kriteria, kolom pilihan, dan baris dalam URUTAN serta SARINGAN layar", () => {
    vi.useFakeTimers();
    const cetak = vi.fn();
    window.print = cetak;

    render(<Rakitan awal="detail" />);
    fireEvent.click(screen.getByRole("button", { name: /^Diputus$/ }));
    fireEvent.change(screen.getByLabelText("Saring hasil yang termuat"), { target: { value: "cerai" } });

    fireEvent.click(screen.getByRole("button", { name: /Cetak$/ }));
    const pilih = screen.getByRole("group", { name: "Kolom yang dicetak" });
    // Hakim ketua dikeluarkan, jumlah sidang dimasukkan.
    fireEvent.click(within(pilih).getByLabelText("Hakim ketua"));
    fireEvent.click(within(pilih).getByLabelText("Jumlah sidang"));
    fireEvent.click(within(pilih).getByRole("button", { name: "Cetak sekarang" }));

    const lembar = document.getElementById(ID_LEMBAR_CETAK_HASIL);
    expect(lembar, "lembar cetak tidak tergambar").toBeTruthy();
    const teks = lembar?.textContent ?? "";
    expect(teks).toContain("Pengadilan Agama Contoh");
    expect(teks).toContain("Kata cari: “cerai”.");
    expect(teks).toContain("Saringan: tahun pendaftaran 2026.");
    expect(teks).toContain("Disaring di layar dengan kata “cerai”: 3 dari 5 perkara yang termuat.");
    expect(teks).toContain("Diurutkan menurut diputus, menaik.");
    expect(teks).toMatch(/3 perkara · dicetak \w+, \d{1,2} \w+ \d{4} pukul \d{2}:\d{2} WITA/);

    const kepalaCetak = [...(lembar?.querySelectorAll("thead th") ?? [])].map((x) => x.textContent);
    expect(kepalaCetak).toContain("Jumlah sidang");
    expect(kepalaCetak).not.toContain("Hakim ketua");
    expect(kepalaCetak[0]).toBe("No");

    // Urutan layar: diputus menaik, yang belum putus di bawah - dan hanya
    // yang lolos saringan "cerai".
    const nomorCetak = [...(lembar?.querySelectorAll("tbody tr") ?? [])].map(
      (tr) => tr.querySelectorAll("td")[1]?.textContent
    );
    expect(nomorCetak).toEqual([N(0), N(1), N(4)]);
    // Tanggal di lembar cetak pun bukan ISO. Diperiksa PER SEL: textContent
    // seluruh lembar menyambung sel tanpa pemisah, sehingga "10" (jumlah
    // sidang) + "10-03-2026" terbaca "1010-03-2026" dan menyala palsu.
    const selCetak = [...(lembar?.querySelectorAll("td, th, p") ?? [])].map((x) => x.textContent ?? "");
    expect(selCetak.filter((x) => /\d{4}-\d{2}-\d{2}/.test(x))).toEqual([]);
    expect(selCetak).toContain("10-03-2026");

    // Lebar lembar dikunci ke lebar kertas: tidak terpotong di kanan.
    const gaya = lembar?.querySelector("style")?.textContent ?? "";
    expect(gaya).toContain("size: A4 landscape");
    expect(gaya).toContain("table-layout: fixed");

    // Lebar kolom dalam PERSEN berbobot, jumlahnya 100: sebanyak apa pun
    // kolom yang dipilih, tabel tidak melebihi kertas - dan kolom tanggal
    // tidak dibagi sama sempit dengan kolom angka. Terukur di peramban pada
    // 22 kolom: dibagi rata, tanggal "10-03-2026" pecah dua baris.
    const lebarKolom = [...(lembar?.querySelectorAll("colgroup col") ?? [])].map((c) =>
      parseFloat((c as HTMLElement).style.width)
    );
    expect(lebarKolom).toHaveLength(kepalaCetak.length);
    expect(lebarKolom.every((x) => Number.isFinite(x) && x > 0)).toBe(true);
    expect(lebarKolom.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1);
    const lebarMenurut = (judul: string) => lebarKolom[kepalaCetak.indexOf(judul)];
    expect(lebarMenurut("Diputus")).toBeGreaterThan(lebarMenurut("Jumlah sidang"));
    expect(lebarMenurut("Nomor perkara")).toBeGreaterThan(lebarMenurut("Diputus"));

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(cetak).toHaveBeenCalledTimes(1);
    expect(document.getElementById(ID_LEMBAR_CETAK_HASIL)).toBeNull();
  });
});

// ===========================================================================
// LAYAR UTUH: PANEL MENGECIL, MUAT LEBIH BANYAK, PENYIMPANAN DIBLOKIR
// ===========================================================================

const KATALOG = {
  available: true,
  tag: [
    {
      kunci: "belum-putus",
      label: "Belum putus",
      kelompok: "keadaan",
      nada: "awas",
      judul: "Belum ada baris putusan bertanggal pada perkara ini.",
    },
    {
      kunci: "ghaib",
      label: "Ghaib",
      kelompok: "keadaan",
      nada: "bahaya",
      judul: "Salah satu pihak dipanggil sebagai ghaib.",
    },
  ],
  kelompok: [{ kunci: "keadaan", label: "Keadaan perkara" }],
  dasar: [
    { kunci: "daftar", label: "Didaftarkan" },
    { kunci: "putus", label: "Diputus" },
  ],
  batasId: 20000,
};

type Jawaban = Record<string, unknown>;

/**
 * Pemalsu fetch. Pencarian dapat DITAHAN - dijawab nanti dengan tangan -
 * supaya uji dapat menyentuh panel selagi jawabannya belum datang.
 */
function pasangFetch(jawabCari: (url: string) => Jawaban | Promise<Jawaban>) {
  const panggilan: string[] = [];
  const palsu = vi.fn(async (masukan: RequestInfo | URL) => {
    const url = String(masukan);
    panggilan.push(url);
    let isi: Jawaban;
    if (url.includes("/status-perkara/tag?katalogSaja=1")) isi = KATALOG;
    else if (url.includes("/status-perkara/tag?")) {
      isi = { ...KATALOG, jumlah: { "belum-putus": 3, ghaib: 2 }, lingkup: { dari: "", sampai: "", perkara: 10 } };
    } else isi = await jawabCari(url);
    return { ok: true, json: async () => ({ data: isi }) } as Response;
  });
  vi.stubGlobal("fetch", palsu);
  return panggilan;
}

const cariDari = (panggilan: string[]) =>
  panggilan.filter((x) => x.includes("/status-perkara?") && !x.includes("/tag"));

/**
 * Pemalsu fetch yang melewatkan permintaan layar ke RUTE PORTAL SUNGGUHAN
 * (GET /api/aleta-ecourt/status-perkara); permintaan rute itu ke bot dijawab
 * `jawabBot`. Yang diuji rantai layar -> rute -> jawaban bot, bukan jawaban
 * yang disuapkan langsung ke layar dalam bentuk yang mungkin tidak pernah
 * dikirim rute. Mengembalikan alamat-alamat yang sampai ke bot.
 */
/**
 * Batas tunggu uji yang melewati rute sungguhan: pemuatan pertama modul rute
 * (next/server dan klien jembatan) dapat memakan beberapa detik saat banyak
 * berkas uji berjalan bersamaan - terukur di rangkaian gabungan, bukan cacat.
 */
const RUTE_MS = 20_000;

function pasangFetchLewatRute(jawabBot: (url: URL) => { status?: number; isi: unknown }) {
  const keBot: string[] = [];
  const palsu = vi.fn(async (masukan: RequestInfo | URL) => {
    const url = new URL(String(masukan), "http://localhost");
    if (url.pathname.endsWith("/internal/aleta-bot/sipp/status-perkara/cari")) {
      keBot.push(url.toString());
      const { status = 200, isi } = jawabBot(url);
      return new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.endsWith("/api/aleta-ecourt/status-perkara")) {
      const { GET } = await import("@/app/api/aleta-ecourt/status-perkara/route");
      return GET(new NextRequest(url.toString()));
    }
    if (url.pathname.includes("/status-perkara/tag")) {
      return new Response(JSON.stringify({ data: KATALOG }), { status: 200 });
    }
    throw new Error(`fetch tak terduga dalam uji: ${url.toString()}`);
  });
  vi.stubGlobal("fetch", palsu);
  return keBot;
}

function jawabanHasil(baris: BarisHasil[], tambahan: Jawaban = {}): Jawaban {
  return { available: true, perkara: baris, jumlahTag: null, tagDipotong: [], ...tambahan };
}

describe("butir 9 - panel Tag mengecil sesudah hasilnya datang", () => {
  it("pilih tag -> hasil datang -> panel menjadi bilah ringkas berchip; Buka lagi memulihkannya", async () => {
    pasangFetch(() => jawabanHasil(BARIS.slice(0, 3)));
    const pengguna = userEvent.setup();
    render(<AletaEcourtStatusPerkara />);

    await pengguna.click(screen.getByRole("button", { name: "Tag & rentang waktu" }));
    // Klik SUNGGUHAN - pointerdown lalu click - bukan fireEvent: tekanan chip
    // yang memulai pencarian tidak boleh terhitung sebagai "masih memilih".
    const chip = await screen.findByRole("button", { name: /Belum putus/ });
    await pengguna.click(chip);

    // Jawaban datang selagi penunjuk tetikus MASIH di atas chip yang baru
    // ditekan: panel belum dikecilkan - chip tidak lenyap dari bawah
    // penunjuk (telaah 26 September 2026).
    await screen.findByText(/3 perkara cocok/);
    expect(chip.isConnected).toBe(true);
    expect(screen.queryByRole("region", { name: /dikecilkan/ })).toBeNull();

    // Penunjuk keluar dari panel: barulah panelnya mengecil.
    await pengguna.unhover(chip);
    const bilah = await screen.findByRole("region", { name: "Tag & rentang waktu (dikecilkan)" });
    expect(within(bilah).getByText("Belum putus")).toBeTruthy();
    expect(within(bilah).getByRole("button", { name: "Lepas tag Belum putus" })).toBeTruthy();
    expect(within(bilah).getByText(/seluruh register, menurut tanggal didaftarkan/)).toBeTruthy();
    expect(screen.queryByPlaceholderText("mis. BHT, ikrar, panjar")).toBeNull();
    // Di bawah lebar sm isinya turun ke baris sendiri selebar bilah. Terukur
    // pada 375 px: terjepit di antara judul dan tombol, chipnya pecah per kata
    // dan bilah "ringkas" setinggi 192 px; sesudahnya 91-118 px, chip utuh.
    const isiRingkas = bilah.querySelector('[data-bagian="isi-ringkas"]') as HTMLElement;
    const kelasIsi = isiRingkas.className.split(/\s+/);
    expect(kelasIsi).toEqual(expect.arrayContaining(["order-last", "w-full", "sm:order-none", "sm:w-auto", "sm:flex-1"]));
    expect(within(isiRingkas).getByText("Belum putus")).toBeTruthy();
    // Hasilnya tampak di bawahnya.
    expect(screen.getByText(/3 perkara cocok/)).toBeTruthy();

    fireEvent.click(within(bilah).getByRole("button", { name: "Buka lagi" }));
    expect(screen.getByPlaceholderText("mis. BHT, ikrar, panjar")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /dikecilkan/ })).toBeNull();
  });

  it("TIDAK mengecil bila penggunanya masih mengetik di panel selagi menunggu jawaban", async () => {
    let jawab: (x: Jawaban) => void = () => {};
    pasangFetch(
      () =>
        new Promise<Jawaban>((selesai) => {
          jawab = selesai;
        })
    );
    render(<AletaEcourtStatusPerkara />);
    fireEvent.click(screen.getByRole("button", { name: "Tag & rentang waktu" }));
    fireEvent.click(await screen.findByRole("button", { name: /Belum putus/ }));

    // Selagi pencarian berjalan, penggunanya mengetik di kotak saring tag.
    const kotak = screen.getByPlaceholderText("mis. BHT, ikrar, panjar");
    fireEvent.keyDown(kotak, { key: "g" });
    fireEvent.change(kotak, { target: { value: "g" } });

    await act(async () => {
      jawab(jawabanHasil(BARIS.slice(0, 3)));
    });
    await screen.findByText(/3 perkara cocok/);
    expect(screen.getByPlaceholderText("mis. BHT, ikrar, panjar")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /dikecilkan/ })).toBeNull();
  });

  it("melepas chip terakhir dari bilah ringkas membuang hasil lama, tidak membiarkannya", async () => {
    pasangFetch(() => jawabanHasil(BARIS.slice(0, 3)));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.click(screen.getByRole("button", { name: "Tag & rentang waktu" }));
    fireEvent.click(await screen.findByRole("button", { name: /Belum putus/ }));
    const bilah = await screen.findByRole("region", { name: "Tag & rentang waktu (dikecilkan)" });

    fireEvent.click(within(bilah).getByRole("button", { name: "Lepas tag Belum putus" }));
    expect(screen.queryByText(/3 perkara cocok/)).toBeNull();
    expect(screen.getByText("Isi sekurangnya satu kotak pencarian atau satu saringan.")).toBeTruthy();
  });

  it("tanggal acuan panel tag ikut dikirim ke pencarian, bukan diganti hari ini", async () => {
    const panggilan = pasangFetch(() => jawabanHasil(BARIS.slice(0, 2)));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.click(screen.getByRole("button", { name: "Tag & rentang waktu" }));
    await screen.findByRole("button", { name: /Belum putus/ });
    fireEvent.change(screen.getByText("Rentang waktu").querySelector("select") as HTMLSelectElement, {
      target: { value: "triwulan" },
    });
    fireEvent.change(screen.getByTitle(/Kosong berarti hari ini/), { target: { value: "2026-05-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan hasil" }));

    await waitFor(() => expect(cariDari(panggilan)).toHaveLength(1));
    const kueri = new URL(cariDari(panggilan)[0], "http://x").searchParams;
    expect(kueri.get("periode")).toBe("triwulan");
    expect(kueri.get("acuan")).toBe("2026-05-15");
  });
});

describe("butir 9 - panel Saringan lain mengecil sesudah Cari", () => {
  it("saringan diisi, Enter ditekan, hasil datang -> bilah ringkas menyebut saringannya", async () => {
    const panggilan = pasangFetch(() => jawabanHasil(BARIS.slice(0, 2)));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.click(screen.getByRole("button", { name: "Saringan lain" }));
    const nama = screen.getByPlaceholderText("nama penggugat, tergugat, pemohon…");
    nama.focus();
    fireEvent.change(nama, { target: { value: "Rahmat" } });
    fireEvent.keyDown(nama, { key: "Enter" });

    const bilah = await screen.findByRole("region", { name: "Saringan lain (dikecilkan)" });
    expect(within(bilah).getByText("1 saringan aktif")).toBeTruthy();
    expect(within(bilah).getByText("Nama pihak: “Rahmat”")).toBeTruthy();
    expect(screen.queryByPlaceholderText("nama penggugat, tergugat, pemohon…")).toBeNull();
    // Fokus yang berada di kotak nama tidak jatuh ke body - ia pindah ke
    // "Buka lagi". Ditunggu, bukan diperiksa seketika: fokusnya dipindahkan
    // oleh efek sesudah bilahnya tergambar, dan findByRole dapat selesai
    // pada gambar yang sama sebelum efek itu berjalan.
    const bukaLagi = within(bilah).getByRole("button", { name: "Buka lagi" });
    await waitFor(() => expect(document.activeElement).toBe(bukaLagi));
    expect(new URL(cariDari(panggilan)[0], "http://x").searchParams.get("namaPihak")).toBe("Rahmat");
  });

  it("rentang tanggal pendaftaran yang baru dikirim sebagai sejak/sampai", async () => {
    const panggilan = pasangFetch(() => jawabanHasil(BARIS.slice(0, 2)));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.click(screen.getByRole("button", { name: "Saringan lain" }));
    fireEvent.change(screen.getByText("Didaftarkan sejak").querySelector("input") as HTMLInputElement, {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByText("Didaftarkan sampai").querySelector("input") as HTMLInputElement, {
      target: { value: "2026-03-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await waitFor(() => expect(cariDari(panggilan)).toHaveLength(1));
    const kueri = new URL(cariDari(panggilan)[0], "http://x").searchParams;
    expect(kueri.get("sejak")).toBe("2026-01-01");
    expect(kueri.get("sampai")).toBe("2026-03-31");
    const bilah = await screen.findByRole("region", { name: "Saringan lain (dikecilkan)" });
    expect(within(bilah).getByText("Didaftarkan sejak: 01-01-2026")).toBeTruthy();
  });
});

describe("butir 7 - muat lebih banyak dari pencarian yang sama", () => {
  it("halaman berikutnya meminta lewati=jumlah termuat dan ditempel di bawah", async () => {
    const panggilan = pasangFetch((url) => {
      const lewati = new URL(url, "http://x").searchParams.get("lewati");
      return lewati
        ? jawabanHasil(BARIS.slice(3), { adaLagi: false })
        : jawabanHasil(BARIS.slice(0, 3), { adaLagi: true });
    });
    render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await screen.findByText(/3 perkara pertama termuat — masih ada yang cocok/);
    expect(screen.queryByText(/3 perkara cocok/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Muat lebih banyak" }));
    await screen.findByText(/5 perkara cocok/);
    const kedua = new URL(cariDari(panggilan)[1], "http://x").searchParams;
    expect(kedua.get("lewati")).toBe("3");
    expect(kedua.get("batas")).toBe("100");
    // Pertanyaan yang SAMA diteruskan.
    expect(kedua.get("cari")).toBe("cerai");
    expect(screen.queryByRole("button", { name: "Muat lebih banyak" })).toBeNull();
  });

  it("Muat semua meminta sisa pagu, dan pada pagu 500 tidak ada yang menyuruh menekan tombol yang hilang", async () => {
    const buat = (mulai: number, n: number): BarisHasil[] =>
      Array.from({ length: n }, (_, i) => ({
        ...BARIS[0],
        perkaraId: String(5000 + mulai + i),
        nomorPerkara: `${mulai + i + 1}/Pdt.G/2026/PA.Ctt`,
      }));
    const panggilan = pasangFetch((url) => {
      const p = new URL(url, "http://x").searchParams;
      return jawabanHasil(buat(Number(p.get("lewati") || 0), Number(p.get("batas") || 0)), {
        adaLagi: true,
        jumlahTag: 650,
      });
    });
    render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await screen.findByText(/100 perkara pertama termuat — masih ada yang cocok/);
    expect(screen.getByText(/Muat lebih banyak di bawah daftar \(sampai 500\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Muat semua (sampai 500)" }));
    await screen.findByText(/500 perkara pertama termuat — masih ada yang cocok/);
    const kedua = new URL(cariDari(panggilan)[1], "http://x").searchParams;
    expect(kedua.get("lewati")).toBe("100");
    expect(kedua.get("batas")).toBe("400");

    // Pagu tercapai: tombolnya hilang, dan tidak ada kalimat yang masih
    // menyuruh menekannya.
    expect(screen.queryByRole("button", { name: "Muat lebih banyak" })).toBeNull();
    expect(screen.queryByText(/Muat lebih banyak di bawah daftar/)).toBeNull();
    expect(screen.getByText(/Pagu 500 perkara sudah termuat/)).toBeTruthy();
    expect(screen.getByText(/Pagu 500 perkara tercapai/)).toBeTruthy();
  });

  it("bot lama yang tidak mengenal lewati - LEWAT RUTE SUNGGUHAN - tidak terbaca 'tidak ada lagi', dan tidak menggandakan daftar", async () => {
    // Jawaban bot SEBELUM butir 7: larik perkara saja, tanpa adaLagi/lewati.
    // Dulu uji ini menyuapkan bentuk itu LANGSUNG ke layar - bentuk yang tidak
    // pernah dikirim rute, sebab rute mengubah adaLagi yang tidak ada menjadi
    // false, dan tombol Muat lebih banyak tidak pernah muncul (telaah 26
    // September 2026). Kini rantainya utuh: layar -> rute -> bot lama.
    const seratus = Array.from({ length: 100 }, (_, i) => ({
      ...BARIS[0],
      perkaraId: String(1000 + i),
      nomorPerkara: `${i + 1}/Pdt.G/2026/PA.Ctt`,
    }));
    const keBot = pasangFetchLewatRute(() => ({ isi: { ok: true, perkara: seratus } }));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    // Halaman penuh tanpa keterangan dari bot: MUNGKIN bersambung - dan itu
    // yang dikatakan, bukan "100 perkara cocok".
    await screen.findByText(/100 perkara pertama termuat — masih ada yang cocok/, {}, { timeout: RUTE_MS });
    expect(keBot).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Muat lebih banyak" }));
    await screen.findByText(/belum dapat memuat halaman berikutnya/, {}, { timeout: RUTE_MS });
    expect(keBot).toHaveLength(2);
    expect(new URL(keBot[1]).searchParams.get("lewati")).toBe("100");
    // Tidak ada yang digandakan, dan sesudahnya tidak lagi dijanjikan sisanya.
    expect(screen.getByText(/100 perkara cocok/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Muat lebih banyak" })).toBeNull();
  });

  it("cetak dari layar utuh membawa kriteria pencarian yang menghasilkan daftarnya", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.print = vi.fn();
    pasangFetch(() => jawabanHasil(BARIS.slice(0, 3)));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Saringan lain" }));
    fireEvent.change(screen.getByPlaceholderText("2025"), { target: { value: "2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await screen.findByText(/3 perkara cocok/);

    // Isian yang disunting SESUDAH pencarian tidak boleh masuk ke lembar.
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "lain" } });

    fireEvent.click(screen.getByRole("button", { name: /Cetak$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cetak sekarang" }));
    const lembar = document.getElementById(ID_LEMBAR_CETAK_HASIL);
    expect(lembar?.textContent).toContain("Pengadilan Agama Contoh");
    expect(lembar?.textContent).toContain("Kata cari: “cerai”.");
    expect(lembar?.textContent).toContain("Saringan: tahun pendaftaran 2026.");
    expect(lembar?.textContent).not.toContain("“lain”");
  });
});

describe("butir 7 - pilihan tampilan diingat, tetapi tidak wajib", () => {
  it("pilihan Detail diingat peramban untuk pencarian berikutnya", async () => {
    pasangFetch(() => jawabanHasil(BARIS.slice(0, 3)));
    const { unmount } = render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await screen.findByText(/3 perkara cocok/);
    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    unmount();

    render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await screen.findByText(/3 perkara cocok/);
    expect(screen.getByRole("button", { name: "Detail" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("penyimpanan situs yang melempar tidak menjatuhkan layar", async () => {
    const asli = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Penyimpanan situs diblokir", "SecurityError");
      },
    });
    try {
      pasangFetch(() => jawabanHasil(BARIS.slice(0, 3)));
      render(<AletaEcourtStatusPerkara />);
      fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: "cerai" } });
      fireEvent.click(screen.getByRole("button", { name: "Cari" }));
      await screen.findByText(/3 perkara cocok/);
      // Bawaan Kotak, lalu tetap dapat diganti walau tidak dapat diingat.
      expect(screen.getByLabelText("Kotak hasil")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Detail" }));
      expect(screen.getByRole("table")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /Cetak$/ }));
      expect(screen.getByRole("group", { name: "Kolom yang dicetak" })).toBeTruthy();
    } finally {
      if (asli) Object.defineProperty(window, "localStorage", asli);
      else Reflect.deleteProperty(window, "localStorage");
    }
  });
});

// ===========================================================================
// TELAAH 26 SEPTEMBER 2026 - CACAT YANG TERBUKTI, DIBETULKAN
// ===========================================================================
//
// Tiap uji di bawah menggambar layar sungguhan dan menjalankan tepat skenario
// yang membuktikan cacatnya di telaah; hijau di sini berarti cacatnya TIDAK
// ada lagi.

/** Pencarian yang jawabannya ditahan sampai uji melepasnya. */
function pasangFetchDitahan() {
  let jawab: (x: Jawaban) => void = () => {};
  pasangFetch(
    () =>
      new Promise<Jawaban>((selesai) => {
        jawab = selesai;
      })
  );
  return (x: Jawaban) => jawab(x);
}

describe("telaah 26 Sep - panel Tag tidak mengecil di bawah penunjuk yang masih menelusuri", () => {
  it("roda tetikus di panel + menunjuk chip lain selagi menunggu: panel TETAP terbuka, chip yang ditunjuk tetap ada", async () => {
    const lepas = pasangFetchDitahan();
    const pengguna = userEvent.setup();
    render(<AletaEcourtStatusPerkara />);
    await pengguna.click(screen.getByRole("button", { name: "Tag & rentang waktu" }));
    await pengguna.click(await screen.findByRole("button", { name: /^Belum putus/ }));

    // Menimbang tag kedua: menggulir panel dan menunjuk chip "Ghaib".
    const chipLain = screen.getByRole("button", { name: /^Ghaib/ });
    fireEvent.wheel(chipLain, { deltaY: 120 });
    await pengguna.hover(chipLain);

    await act(async () => {
      lepas(jawabanHasil(BARIS.slice(0, 3)));
    });
    await screen.findByText(/3 perkara cocok/);
    expect(chipLain.isConnected).toBe(true);
    expect(screen.queryByRole("region", { name: /dikecilkan/ })).toBeNull();

    // Roda tetikus berarti masih menelusuri: keluar dari panel pun tidak
    // mengecilkannya untuk pencarian ini.
    await pengguna.unhover(chipLain);
    expect(screen.queryByRole("region", { name: /dikecilkan/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Ghaib/ })).toBe(chipLain);
  });

  it("hanya menunjuk, tanpa roda: pengecilan DITUNDA sampai penunjuk keluar dari panel", async () => {
    const lepas = pasangFetchDitahan();
    const pengguna = userEvent.setup();
    render(<AletaEcourtStatusPerkara />);
    await pengguna.click(screen.getByRole("button", { name: "Tag & rentang waktu" }));
    await pengguna.click(await screen.findByRole("button", { name: /^Belum putus/ }));
    const chipLain = screen.getByRole("button", { name: /^Ghaib/ });
    await pengguna.hover(chipLain);

    await act(async () => {
      lepas(jawabanHasil(BARIS.slice(0, 3)));
    });
    await screen.findByText(/3 perkara cocok/);
    expect(chipLain.isConnected).toBe(true);
    expect(screen.queryByRole("region", { name: /dikecilkan/ })).toBeNull();

    await pengguna.unhover(chipLain);
    const bilah = await screen.findByRole("region", { name: "Tag & rentang waktu (dikecilkan)" });
    expect(within(bilah).getByText("Belum putus")).toBeTruthy();
    expect(chipLain.isConnected).toBe(false);
  });

  it("sentuhan jari tidak menunda: penunjuk sentuh tidak 'berada di atas' panel", async () => {
    const lepas = pasangFetchDitahan();
    render(<AletaEcourtStatusPerkara />);
    fireEvent.click(screen.getByRole("button", { name: "Tag & rentang waktu" }));
    const chip = await screen.findByRole("button", { name: /^Belum putus/ });
    // jsdom tidak punya PointerEvent: jenis penunjuknya dipasang pada
    // peristiwa aslinya, yang dibaca React untuk onPointerEnter.
    const masuk = new MouseEvent("pointerover", { bubbles: true });
    Object.defineProperty(masuk, "pointerType", { value: "touch" });
    act(() => {
      chip.dispatchEvent(masuk);
    });
    fireEvent.click(chip);
    await act(async () => {
      lepas(jawabanHasil(BARIS.slice(0, 3)));
    });
    expect(await screen.findByRole("region", { name: "Tag & rentang waktu (dikecilkan)" })).toBeTruthy();
  });
});

describe("telaah 26 Sep - bilah ringkas menyebut yang DICARI, dan menandai isian yang belum", () => {
  it("Saringan: isian diganti tanpa Cari -> bilah tetap menyebut yang menghasilkan daftar; yang baru ditandai belum dicari", async () => {
    const panggilan = pasangFetch(() => jawabanHasil(BARIS.slice(0, 3)));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.click(screen.getByRole("button", { name: "Saringan lain" }));
    const kotakNama = () => screen.getByPlaceholderText("nama penggugat, tergugat, pemohon…");
    fireEvent.change(kotakNama(), { target: { value: "Rahmat" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    const bilah = await screen.findByRole("region", { name: "Saringan lain (dikecilkan)" });
    expect(within(bilah).getByText("Nama pihak: “Rahmat”")).toBeTruthy();
    expect(bilah.querySelector('[data-bagian="belum-dicari"]')).toBeNull();

    fireEvent.click(within(bilah).getByRole("button", { name: "Buka lagi" }));
    fireEvent.change(kotakNama(), { target: { value: "Budi" } });
    fireEvent.click(screen.getByRole("button", { name: /^Sembunyikan saringan/ }));
    const bilah2 = await screen.findByRole("region", { name: "Saringan lain (dikecilkan)" });

    // Satu-satunya pencarian: "Rahmat" - dan daftarnya masih tampil.
    expect(cariDari(panggilan)).toHaveLength(1);
    expect(screen.getByText(/3 perkara cocok/)).toBeTruthy();
    // Chip bilah: yang MENGHASILKAN daftar itu.
    expect(within(bilah2).getByText("1 saringan aktif")).toBeTruthy();
    expect(within(bilah2).getByText("Nama pihak: “Rahmat”")).toBeTruthy();
    expect(within(bilah2).queryByText("Nama pihak: “Budi”")).toBeNull();
    // Isian yang baru disebut SEBAGAI belum dicari.
    expect(bilah2.querySelector('[data-bagian="belum-dicari"]')?.textContent).toBe(
      "Isian di panel sudah diubah dan belum dicari (Nama pihak: “Budi”) — tekan Cari untuk memakainya."
    );

    // Dicari: bilahnya kini "Budi", tandanya hilang.
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await waitFor(() => expect(cariDari(panggilan)).toHaveLength(2));
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Saringan lain (dikecilkan)" })).getByText("Nama pihak: “Budi”")
      ).toBeTruthy()
    );
    const bilah3 = screen.getByRole("region", { name: "Saringan lain (dikecilkan)" });
    expect(within(bilah3).queryByText("Nama pihak: “Rahmat”")).toBeNull();
    expect(bilah3.querySelector('[data-bagian="belum-dicari"]')).toBeNull();
  });

  it("Tag: periode diganti tanpa dicari -> bilah tetap 'seluruh register'; periode baru ditandai belum dicari", async () => {
    const panggilan = pasangFetch(() => jawabanHasil(BARIS.slice(0, 3)));
    render(<AletaEcourtStatusPerkara />);
    fireEvent.click(screen.getByRole("button", { name: "Tag & rentang waktu" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Belum putus/ }));
    const bilah = await screen.findByRole("region", { name: "Tag & rentang waktu (dikecilkan)" });
    expect(within(bilah).getByText(/seluruh register/)).toBeTruthy();
    expect(bilah.querySelector('[data-bagian="belum-dicari"]')).toBeNull();

    fireEvent.click(within(bilah).getByRole("button", { name: "Buka lagi" }));
    fireEvent.change(screen.getByText("Rentang waktu").querySelector("select") as HTMLSelectElement, {
      target: { value: "tahun" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Sembunyikan tag/ }));
    const bilah2 = await screen.findByRole("region", { name: "Tag & rentang waktu (dikecilkan)" });

    const periode = cariDari(panggilan).map((x) => new URL(x, "http://x").searchParams.get("periode"));
    expect(periode).toEqual(["total"]);
    // Kalimat rentang bilah: yang dicari.
    const isi = bilah2.querySelector('[data-bagian="isi-ringkas"]') as HTMLElement;
    const belum = bilah2.querySelector('[data-bagian="belum-dicari"]') as HTMLElement;
    expect(belum).toBeTruthy();
    expect(isi.textContent?.replace(belum.textContent ?? "", "")).toMatch(/seluruh register, menurut tanggal didaftarkan/);
    expect(isi.textContent?.replace(belum.textContent ?? "", "")).not.toMatch(/tahun ini/i);
    // Periode yang baru: disebut sebagai belum dicari.
    expect(belum.textContent).toMatch(/^Pilihan di panel sudah diubah dan belum dicari \(Belum putus, tahun ini/);
    expect(belum.textContent).toMatch(/tekan Cari untuk memakainya\.$/);
  });
});

describe("telaah 26 Sep - yang termuat tidak disebut 'cocok'", () => {
  it("adaLagi: kepala hasil menyebut yang TERMUAT, dan tampilan Kelompok mengatakan jumlahnya hanya yang termuat", () => {
    render(<Rakitan adaLagi />);
    expect(screen.getByText("5 perkara pertama termuat — masih ada yang cocok; pilih salah satu:")).toBeTruthy();
    expect(screen.queryByText(/perkara cocok — pilih salah satu/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Kelompok" }));
    expect(
      screen.getByText(
        "Dikelompokkan dari 5 perkara yang termuat — masih ada yang cocok tetapi belum dimuat, jadi jumlah tiap kelompok hanya menghitung yang termuat."
      )
    ).toBeTruthy();
  });

  it("tanpa adaLagi: kepala 'N perkara cocok', Kelompok tanpa catatan", () => {
    render(<Rakitan />);
    expect(screen.getByText("5 perkara cocok — pilih salah satu:")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Kelompok" }));
    expect(screen.queryByText(/Dikelompokkan dari/)).toBeNull();
  });

  it("pada pagu 500 peringatan urutan tidak menyuruh 'muat semua' - tombolnya memang tidak ada", () => {
    const limaRatus: BarisHasil[] = Array.from({ length: 500 }, (_, i) => ({
      ...BARIS[0],
      perkaraId: String(9000 + i),
      nomorPerkara: `${i + 1}/Pdt.G/2026/PA.Ctt`,
      umurHari: i,
    }));
    render(<Rakitan hasil={limaRatus} adaLagi awal="daftar" />);
    fireEvent.change(screen.getByLabelText("Urutkan menurut"), { target: { value: "umur" } });
    expect(
      screen.getByText(
        "Diurutkan dari 500 perkara yang termuat; sisanya melewati pagu 500 — persempit pencarian untuk urutan yang utuh."
      )
    ).toBeTruthy();
    expect(screen.queryByText(/muat semua untuk urutan lengkap/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Muat semua/ })).toBeNull();
    expect(screen.getByText(/Pagu 500 perkara tercapai/)).toBeTruthy();
  });
});

describe("telaah 26 Sep - error habis waktu dikatakan dalam bahasa orangnya (layar -> rute sungguhan -> bot)", () => {
  async function cari(kata: string) {
    render(<AletaEcourtStatusPerkara />);
    fireEvent.change(screen.getByPlaceholderText(/419, nama pihak/), { target: { value: kata } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
  }

  it("bot lama meneruskan 'Query inactivity timeout': layar menulis kalimat Indonesia yang menyebut jalan keluarnya", async () => {
    const peringatan = vi.spyOn(console, "warn").mockImplementation(() => {});
    pasangFetchLewatRute(() => ({ status: 500, isi: { ok: false, error: "Query inactivity timeout" } }));
    await cari("Sudarmin");
    const pesan = await screen.findByText(/^Pencarian dihentikan karena terlalu lama membaca SIPP/, {}, { timeout: RUTE_MS });
    expect(pesan.textContent).toContain("persempit dengan Saringan lain atau rentang waktu");
    expect(document.body.textContent).not.toMatch(/inactivity|timeout/i);
    // Pesan mentahnya tidak hilang: tercatat di log rute.
    expect(peringatan.mock.calls.some((x) => String(x[0]).includes("Query inactivity timeout"))).toBe(true);
  });

  it("bot baru sudah menerjemahkannya: kalimatnya diteruskan apa adanya", async () => {
    const kalimat =
      "Pencarian dihentikan karena melewati batas 15 detik untuk membaca SIPP. Coba lagi, atau persempit dengan Saringan lain atau rentang waktu.";
    pasangFetchLewatRute(() => ({ status: 500, isi: { ok: false, error: kalimat } }));
    await cari("Sudarmin");
    expect(await screen.findByText(kalimat, {}, { timeout: RUTE_MS })).toBeTruthy();
  });

  it("error yang BUKAN habis waktu tidak disamarkan menjadi habis waktu", async () => {
    pasangFetchLewatRute(() => ({ status: 500, isi: { ok: false, error: "Table 'sipp.perkara_pk' doesn't exist" } }));
    await cari("Sudarmin");
    expect(await screen.findByText("Table 'sipp.perkara_pk' doesn't exist", {}, { timeout: RUTE_MS })).toBeTruthy();
    expect(screen.queryByText(/Pencarian dihentikan/)).toBeNull();
  });
});
