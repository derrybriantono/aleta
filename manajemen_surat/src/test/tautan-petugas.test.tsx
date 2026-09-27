import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DaftarMajelisPetugas, NamaMediatorTertaut, TautanPetugas } from "@/components/portal/tautan-petugas";
import { withBasePath } from "@/lib/base-path";
import { alamatRekapPetugas, alamatStatusPerkara, bacaIdSipp, teksBagian } from "@/lib/rekap-petugas";

// Layar Status Perkara memanggil usePortal untuk kop cetak dan hak akses.
vi.mock("@/lib/app-state", async (asli) => ({
  ...(await asli<typeof import("@/lib/app-state")>()),
  usePortal: () => ({
    institutionIdentity: { courtName: "Pengadilan Agama Contoh" },
    accessibleModules: [],
  }),
}));

import { AletaEcourtStatusPerkara, type Status } from "@/components/portal/aleta-ecourt-status-perkara";

/**
 * ============================================================================
 * NAMA PETUGAS DI STATUS PERKARA MEMBUKA REKAPNYA - LEWAT ID, DI TAB BARU
 * ============================================================================
 *
 * Butir 6 dan 9 permintaan pengguna 27 September 2026. Yang diperiksa adalah
 * yang TERGAMBAR: href tiap tautan (peran dan ID SIPP-nya), target _blank,
 * rel noopener - bukan teks sumber.
 *
 * Bagian terakhir menggambar layar Status Perkara SUNGGUHAN atas muatan bot
 * tiruan, supaya yang teruji bukan hanya komponennya melainkan juga bahwa
 * layar itu memakainya dan meneruskan ID dari muatannya.
 *
 * Nama orang dan nomor perkara di sini karangan.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  try {
    window.localStorage.clear();
  } catch {
    // tidak apa-apa
  }
});

/** peran dan id dari href sebuah tautan - dibaca lewat URL, bukan teks. */
function tujuan(a: HTMLElement) {
  const url = new URL(a.getAttribute("href") ?? "", "http://portal.contoh");
  return { jalur: url.pathname, peran: url.searchParams.get("peran"), id: url.searchParams.get("id") };
}

const jalurRekap = new URL(withBasePath("/aleta-ecourt/rekap-petugas"), "http://portal.contoh").pathname;

describe("alamat dan angka", () => {
  it("alamat rekap membawa peran dan id, tidak pernah nama", () => {
    expect(alamatRekapPetugas("hakim", 26)).toBe("/aleta-ecourt/rekap-petugas?peran=hakim&id=26");
    expect(alamatRekapPetugas("mediator", "25")).toBe("/aleta-ecourt/rekap-petugas?peran=mediator&id=25");
  });

  it("id yang tidak sah tidak menghasilkan alamat", () => {
    for (const buruk of [null, undefined, 0, -3, "", "abc", "12abc", "1.5", 1.5, "99999999999"]) {
      expect(alamatRekapPetugas("hakim", buruk), String(buruk)).toBe("");
      expect(bacaIdSipp(buruk), String(buruk)).toBeNull();
    }
  });

  it("alamat Status Perkara memakai ?perkara= yang dibaca layar e-Court", () => {
    expect(alamatStatusPerkara("12/Pdt.G/2026/PA.Ctt")).toBe("/aleta-ecourt?perkara=12%2FPdt.G%2F2026%2FPA.Ctt");
    expect(alamatStatusPerkara("  ")).toBe("");
  });

  it("persentase menyebut pembilang dan penyebutnya; penyebut nol ditulis —", () => {
    expect(teksBagian({ pembilang: 12, penyebut: 40, persen: 30 })).toBe("12 dari 40 · 30%");
    expect(teksBagian({ pembilang: 1, penyebut: 3, persen: 33.3 })).toBe("1 dari 3 · 33,3%");
    expect(teksBagian({ pembilang: 0, penyebut: 0, persen: null })).toBe("—");
    expect(teksBagian(null)).toBe("—");
    expect(teksBagian({ pembilang: 1250, penyebut: 2000, persen: 62.5 })).toBe("1.250 dari 2.000 · 62,5%");
  });
});

describe("TautanPetugas", () => {
  it("membuka rekap di tab baru, lewat id", () => {
    render(<TautanPetugas peran="hakim" id={26} nama="Hakim Satu, S.H." />);
    const a = screen.getByRole("link", { name: /Hakim Satu, S\.H\./ });
    expect(tujuan(a)).toEqual({ jalur: jalurRekap, peran: "hakim", id: "26" });
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")?.split(/\s+/)).toContain("noopener");
    // Pembaca layar diberi tahu tab barunya.
    expect(a.textContent).toMatch(/tab baru/);
  });

  it("tanpa id yang sah, namanya teks biasa - tidak ditebakkan ke siapa pun", () => {
    const { container } = render(
      <>
        <TautanPetugas peran="hakim" id={null} nama="Tanpa Id" />
        <TautanPetugas peran="panitera" id={undefined} nama="Bot Lama" />
        <TautanPetugas peran="jurusita" id={0} nama="Id Nol" />
      </>
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(screen.getByText("Tanpa Id")).toBeTruthy();
    expect(screen.getByText("Id Nol")).toBeTruthy();
  });

  it("tidak meninggalkan garis bawah di kertas", () => {
    render(<TautanPetugas peran="hakim" id={26} nama="Hakim Satu" />);
    const kelas = screen.getByRole("link").className;
    expect(kelas).toContain("print:no-underline");
    expect(kelas).toContain("focus-visible:ring-2");
  });
});

describe("DaftarMajelisPetugas", () => {
  it("tiap hakim, panitera, dan juru sita tertaut ke rekap perannya sendiri", () => {
    render(
      <DaftarMajelisPetugas
        majelis={[
          { id: 26, kode: "C1", nama: "Hakim Satu", jabatan: "Hakim Ketua" },
          { id: 31, kode: "C3", nama: "Hakim Dua", jabatan: "Hakim Anggota" },
        ]}
        panitera={[{ id: 28, kode: "", nama: "Panitera Satu" }]}
        jurusita={[{ id: 28, kode: "", nama: "Jurusita Satu" }]}
      />
    );
    const tautan = screen.getAllByRole("link").map(tujuan);
    // id 28 muncul dua kali - panitera dan juru sita - dan tetap dua orang,
    // sebab perannya ikut di alamat.
    expect(tautan.map((t) => [t.peran, t.id])).toEqual([
      ["hakim", "26"],
      ["hakim", "31"],
      ["panitera", "28"],
      ["jurusita", "28"],
    ]);
    // Jabatan dan kode tetap tertulis seperti sebelumnya.
    expect(screen.getByText(/Hakim Ketua/)).toBeTruthy();
    expect(screen.getByText("C3")).toBeTruthy();
  });

  it("dua hakim bernama SAMA tetap dua tujuan; ejaan berbeda dengan id sama satu tujuan", () => {
    render(
      <DaftarMajelisPetugas
        majelis={[
          { id: 3, kode: "", nama: "Mazidah", jabatan: "Hakim Ketua" },
          { id: 21, kode: "", nama: "Mazidah", jabatan: "Hakim Anggota" },
        ]}
        panitera={[
          { id: 18, kode: "", nama: "Munifa" },
          { id: 18, kode: "", nama: "Munifa, S.H." },
        ]}
        jurusita={[]}
      />
    );
    const tautan = screen.getAllByRole("link").map(tujuan);
    expect(tautan[0].id).toBe("3");
    expect(tautan[1].id).toBe("21");
    expect(tautan[2]).toEqual(tautan[3]);
  });

  it("yang kosong tetap bertanda —, dan majelis kosong disebut", () => {
    render(<DaftarMajelisPetugas majelis={[]} panitera={[]} jurusita={[]} />);
    expect(screen.getByText("Majelis belum ditetapkan.")).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});

describe("NamaMediatorTertaut", () => {
  it("dua mediator pada satu mediasi: dua tautan, id dan sebutan masing-masing", () => {
    const { container } = render(
      <NamaMediatorTertaut mediator="Mediator Satu, S.H.<br/>Mediator Dua" statusMediator="H,N" mediatorIds={[25, 27]} />
    );
    const tautan = screen.getAllByRole("link");
    expect(tautan.map(tujuan).map((t) => [t.peran, t.id])).toEqual([
      ["mediator", "25"],
      ["mediator", "27"],
    ]);
    expect(tautan.every((a) => a.getAttribute("target") === "_blank")).toBe(true);
    // Sebutan dari lib/sebutan-mediator: H = Mediator Hakim, selainnya Non Hakim.
    expect(container.textContent).toContain("(Mediator Hakim)");
    expect(container.textContent).toContain("(Mediator Non Hakim)");
    // Pemisah <br/> SIPP tidak lagi tertulis mentah.
    expect(container.textContent).not.toContain("<br");
  });

  it("id yang tak terbaca tetap di tempatnya - pasangan tidak bergeser ke orang lain", () => {
    render(<NamaMediatorTertaut mediator="A<br/>B" statusMediator="H,H" mediatorIds={[null, 17]} />);
    const tautan = screen.getAllByRole("link");
    expect(tautan).toHaveLength(1);
    expect(tautan[0].textContent).toMatch(/^B/);
    expect(tujuan(tautan[0]).id).toBe("17");
  });

  it("bot lama tanpa mediatorIds: nama tampil, tidak ada tautan", () => {
    const { container } = render(<NamaMediatorTertaut mediator="Mediator Satu" statusMediator="H" />);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).toContain("Mediator Satu");
  });

  it("tanpa nama: kalimat lama tetap dipakai", () => {
    render(<NamaMediatorTertaut mediator="" statusMediator="" mediatorIds={[]} />);
    expect(screen.getByText("Mediator belum tercatat")).toBeTruthy();
  });
});

// ===========================================================================
// LAYAR STATUS PERKARA SUNGGUHAN
// ===========================================================================

const NOMOR = "77/Pdt.G/2026/PA.Ctt";

function barisMediasi(ubah: Partial<Status["mediasi"]["baris"][number]>): Status["mediasi"]["baris"][number] {
  return {
    mediator: "",
    hasil: "Tidak Berhasil",
    tanggalMulai: "2026-07-10",
    tanggalSelesai: "2026-07-20",
    lamaHari: 10,
    lewatTenggang: false,
    jumlahPertemuan: 2,
    jenisPenetapan: "",
    tanggalPenetapan: "2026-07-10",
    tanggalLaporan: "2026-07-20",
    tanggalKesepakatan: "",
    isiKesepakatan: "",
    nomorSk: "",
    statusMediator: "",
    kodeHasil: "T",
    berhasil: false,
    lamaDariView: false,
    catatan: "",
    tanggalKeputusan: "2026-07-20",
    ...ubah,
  };
}

/** Muatan bot selengkap tipe Status menuntutnya - tanpa cast. */
function statusUji(): Status {
  return {
    identitas: {
      perkaraId: "9001",
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Gugat",
      jenisPerkaraLengkap: "Cerai Gugat",
      tanggalDaftar: "2026-07-01",
    },
    umur: {
      hariBersih: 40,
      hariMediasi: 10,
      hariBerjalan: 49,
      bulanBerjalan: 1.3,
      sudahPutus: false,
      sebabSelesai: "",
      hariMinutasi: null,
    },
    majelis: [
      { id: 26, kode: "C1", nama: "Hakim Satu, S.H.", jabatan: "Hakim Ketua" },
      { id: 31, kode: "C3", nama: "Hakim Dua, S.H.", jabatan: "Hakim Anggota" },
      // Bot versi lama: tanpa id.
      { kode: "C9", nama: "Hakim Tanpa Id", jabatan: "Hakim Anggota" },
    ],
    panitera: [{ id: 28, kode: "", nama: "Panitera Satu, S.H." }],
    jurusita: [{ id: 30, kode: "", nama: "Jurusita Satu" }],
    saksi: { ada: false, jumlahSaksi: 0, jumlahKeterangan: 0 },
    pihak: [],
    identitasPihak: null,
    jadwal: [],
    penundaan: [],
    putusan: null,
    biaya: { panjar: 0, terpakai: 0, sisa: 0, rincian: [] },
    dokumenEcourt: [],
    petitum: { ada: false },
    relaas: [],
    dokumenSipp: [],
    lewatEcourt: false,
    penilaian: { skor: 0, keadaan: "baik", totalBobot: 0, rinci: [], catatan: "" },
    penanda: {
      ghaib: null,
      sumberGhaib: [],
      instansi: [],
      perluIzinAtasan: false,
      mafqud: null,
      tundaanPanjang: [],
      ambangMafqud: { hari: 0, kali: 0 },
    },
    penetapanKembali: { terbaca: false, adaPenggantian: false, baris: [] },
    durasiMediasi: { terbaca: false, hari: 0, alasan: "" },
    nilaiRelaas: { terbaca: false, alasan: "", sumber: "" },
    saksiRinci: { terbaca: true, alasan: "", baris: [] },
    ikrarTalak: { terbaca: false, alasan: "", ada: false },
    putusanLengkap: { terbaca: false, ada: false },
    arsipKeterangan: { terbaca: false, alasan: "", sudahDiarsipkan: false, baris: [] },
    putusanEcourt: null,
    konseptor: { terbaca: false, alasan: "", baris: [] },
    delegasiMasuk: { terbaca: false, alasan: "", baris: [] },
    delegasiKeluar: { terbaca: false, alasan: "", baris: [] },
    mediasi: {
      terbaca: true,
      alasan: "",
      baris: [
        barisMediasi({ mediator: "Mediator Satu, S.H.<br/>Mediator Dua", statusMediator: "H,N", mediatorIds: [25, 27] }),
        // Bot versi lama: tanpa mediatorIds.
        barisMediasi({ mediator: "Mediator Lama", statusMediator: "H" }),
      ],
    },
    tahapan: { terbaca: false, alasan: "", tahap: [] },
    upayaHukum: [],
    penilaianSk: { rinci: [], unsurBelumTersambung: [], dasar: "", catatan: "" },
  };
}

function jawabanJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

describe("layar Status Perkara memakai tautan itu dan meneruskan ID dari muatannya", () => {
  it("majelis, panitera, juru sita, dan mediator tertaut lewat id; tanpa id tetap teks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        if (String(alamat).includes("/api/aleta-ecourt/status-perkara?nomor=")) {
          return jawabanJson({ ok: true, data: { available: true, status: statusUji() } });
        }
        // Pembacaan lain di layar itu (analisa, tag, tautan SIPP) tidak diuji
        // di sini - dibiarkan menunggu, tidak dijawab palsu.
        return new Promise<Response>(() => {});
      })
    );

    render(<AletaEcourtStatusPerkara nomorAwal={NOMOR} />);

    const majelis = await waitFor(() => {
      const bagian = document.getElementById("bagian-majelis");
      if (!bagian) throw new Error("bagian majelis belum tergambar");
      return bagian;
    });
    const tautanMajelis = within(majelis).getAllByRole("link");
    expect(tautanMajelis.map(tujuan).map((t) => [t.peran, t.id])).toEqual([
      ["hakim", "26"],
      ["hakim", "31"],
      ["panitera", "28"],
      ["jurusita", "30"],
    ]);
    for (const a of tautanMajelis) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")?.split(/\s+/)).toContain("noopener");
    }
    // Hakim tanpa id tetap tertulis, tetapi bukan tautan.
    expect(within(majelis).getByText("Hakim Tanpa Id").closest("a")).toBeNull();

    const mediasi = document.getElementById("bagian-mediasi");
    expect(mediasi).not.toBeNull();
    const tautanMediator = within(mediasi!).getAllByRole("link");
    expect(tautanMediator.map(tujuan).map((t) => [t.peran, t.id])).toEqual([
      ["mediator", "25"],
      ["mediator", "27"],
    ]);
    expect(mediasi!.textContent).not.toContain("<br");
    expect(within(mediasi!).getByText("Mediator Lama").closest("a")).toBeNull();
  });
});
