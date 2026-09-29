import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Layar Status Perkara memanggil usePortal untuk kop cetak dan hak akses.
vi.mock("@/lib/app-state", async (asli) => ({
  ...(await asli<typeof import("@/lib/app-state")>()),
  usePortal: () => ({
    institutionIdentity: { courtName: "Pengadilan Agama Contoh" },
    accessibleModules: [],
  }),
}));

import type { Status } from "@/components/portal/aleta-ecourt-status-perkara";

/**
 * ============================================================================
 * "MAJELIS DAN PETUGAS": MAJELIS PEMERIKSA, LALU MAJELIS IKRAR TALAK
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026: "perbaiki kolom majelis ikrar di
 * status perkara". Yang diperiksa di sini yang TERGAMBAR:
 *
 *   - majelis pemeriksa dan majelis ikrar talak dua blok terpisah - ketua
 *     ikrar tidak pernah tampil di blok pemeriksa;
 *   - tiap nama tetap tautan ke rekap perannya, lewat ID; yang tanpa ID teks;
 *   - catatan borang penetapan ikrar disebut bila dipakai;
 *   - muatan bot lama digambar seperti dulu, tanpa klaim "pemeriksa";
 *   - bagian "Ikrar talak" tidak lagi menulis tanda </br> SIPP mentah.
 *
 * Pembukti gigitan: ALETA_UJI_TAUTAN_PETUGAS dan ALETA_UJI_LAYAR_STATUS
 * menunjuk salinan komponen di luar repo (misalnya versi sebelum perbaikan)
 * yang diimpor sebagai gantinya.
 *
 * Nama orang dan nomor perkara di sini karangan.
 */

const { DaftarMajelisPetugas } = (
  process.env.ALETA_UJI_TAUTAN_PETUGAS
    ? await import(/* @vite-ignore */ process.env.ALETA_UJI_TAUTAN_PETUGAS)
    : await import("@/components/portal/tautan-petugas")
) as typeof import("@/components/portal/tautan-petugas");

const { AletaEcourtStatusPerkara } = (
  process.env.ALETA_UJI_LAYAR_STATUS
    ? await import(/* @vite-ignore */ process.env.ALETA_UJI_LAYAR_STATUS)
    : await import("@/components/portal/aleta-ecourt-status-perkara")
) as typeof import("@/components/portal/aleta-ecourt-status-perkara");

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
function tujuan(a: HTMLElement): [string | null, string | null] {
  const url = new URL(a.getAttribute("href") ?? "", "http://portal.contoh");
  return [url.searchParams.get("peran"), url.searchParams.get("id")];
}

// Bentuk yang dikirim bot untuk perkara_id 385 (petugasStatusPerkara).
const PEMERIKSA_385 = {
  majelis: [
    { id: 4, kode: "H4", nama: "Arasy Latif", jabatan: "Hakim Ketua", kedudukan: "Hakim Ketua", tahapanId: 10, keteranganTahapan: "" },
    { id: 1, kode: "H1", nama: "Amar Ma'ruf", jabatan: "Hakim Anggota 1", kedudukan: "Hakim Anggota 1", tahapanId: 10, keteranganTahapan: "" },
    { id: 6, kode: "H6", nama: "Ruhana Faried", jabatan: "Hakim Anggota 2", kedudukan: "Hakim Anggota 2", tahapanId: 10, keteranganTahapan: "" },
  ],
  panitera: [{ id: 4, kode: "P4", nama: "Imayanti, S.H.", tahapanId: 10, keteranganTahapan: "" }],
  jurusita: [{ id: 2, kode: "J2", nama: "Muh. Sam'an", tahapanId: 10, keteranganTahapan: "" }],
};
const IKRAR_385 = {
  majelis: [
    { id: 9, kode: "H9", nama: "Ulfah", jabatan: "Hakim Ketua", kedudukan: "Hakim Ketua", tahapanId: 18, keteranganTahapan: "", sumber: "penunjukan" },
    { id: 1, kode: "H1", nama: "Amar Ma'ruf", jabatan: "Hakim Anggota 1", kedudukan: "Hakim Anggota 1", tahapanId: 18, keteranganTahapan: "", sumber: "penunjukan" },
    { id: 6, kode: "H6", nama: "Ruhana Faried", jabatan: "Hakim Anggota 2", kedudukan: "Hakim Anggota 2", tahapanId: 18, keteranganTahapan: "", sumber: "penunjukan" },
  ],
  // Borang ikrar: id panitera NULL - nama tetap tampil, tanpa tautan.
  panitera: [{ id: null, kode: "", nama: "Imayanti, S.H.", tahapanId: 18, keteranganTahapan: "", sumber: "penetapanIkrar" }],
  jurusita: [{ id: 2, kode: "", nama: "Muh. Sam'an", tahapanId: 18, keteranganTahapan: "", sumber: "penetapanIkrar" }],
};

function blokIkrar(wadah: HTMLElement) {
  return wadah.querySelector<HTMLElement>('[data-blok="majelis-ikrar"]');
}

describe("DaftarMajelisPetugas: dua blok", () => {
  it("385: pemeriksa lalu ikrar talak; ketua ikrar tidak tampil sebagai ketua pemeriksa", () => {
    const { container } = render(
      <DaftarMajelisPetugas {...PEMERIKSA_385} ikrar={IKRAR_385} sumberMajelis="pemeriksa" />
    );
    expect(screen.getByText("Majelis pemeriksa")).toBeTruthy();
    expect(screen.getByText("Majelis ikrar talak")).toBeTruthy();

    const ikrar = blokIkrar(container);
    expect(ikrar).not.toBeNull();
    // Seluruh tautan, menurut urutan tergambar.
    expect(screen.getAllByRole("link").map(tujuan)).toEqual([
      ["hakim", "4"],
      ["hakim", "1"],
      ["hakim", "6"],
      ["panitera", "4"],
      ["jurusita", "2"],
      ["hakim", "9"],
      ["hakim", "1"],
      ["hakim", "6"],
      ["jurusita", "2"],
    ]);
    // Blok ikrar: tautan miliknya sendiri, dan panitera tanpa id tetap teks.
    expect(within(ikrar!).getAllByRole("link").map(tujuan)).toEqual([
      ["hakim", "9"],
      ["hakim", "1"],
      ["hakim", "6"],
      ["jurusita", "2"],
    ]);
    expect(within(ikrar!).getByText("Imayanti, S.H.").closest("a")).toBeNull();
    expect(ikrar!.textContent).toContain("Panitera sidang:");
    expect(ikrar!.textContent).toMatch(/blangko penetapan ikrar talak/);

    // Di luar blok ikrar: tidak ada Ulfah sama sekali.
    const salinan = container.cloneNode(true) as HTMLElement;
    salinan.querySelector('[data-blok="majelis-ikrar"]')?.remove();
    expect(salinan.textContent).not.toContain("Ulfah");
    expect(salinan.textContent).toMatch(/Arasy Latif[^·]*· Hakim Ketua/);
    expect(salinan.textContent).toContain("Panitera pengganti:");
  });

  it("tanpa ikrar: hanya blok pemeriksa", () => {
    const { container } = render(<DaftarMajelisPetugas {...PEMERIKSA_385} ikrar={null} sumberMajelis="pemeriksa" />);
    expect(screen.getByText("Majelis pemeriksa")).toBeTruthy();
    expect(screen.queryByText("Majelis ikrar talak")).toBeNull();
    expect(blokIkrar(container)).toBeNull();
  });

  it("ikrar seluruhnya dari penunjukan: catatan blangko tidak ditulis", () => {
    const { container } = render(
      <DaftarMajelisPetugas
        {...PEMERIKSA_385}
        ikrar={{ ...IKRAR_385, panitera: [], jurusita: [] }}
        sumberMajelis="pemeriksa"
      />
    );
    expect(blokIkrar(container)!.textContent).not.toMatch(/blangko/);
    // Panitera dan juru sita ikrar yang kosong bertanda —.
    expect(within(blokIkrar(container)!).getAllByText("—")).toHaveLength(2);
  });

  it("bot jatuh ke penunjukan aktif: disebut, dan tidak dinamai 'Majelis pemeriksa'", () => {
    render(<DaftarMajelisPetugas {...PEMERIKSA_385} sumberMajelis="aktif" ikrar={null} />);
    expect(screen.queryByText("Majelis pemeriksa")).toBeNull();
    expect(screen.getByText(/Majelis pemeriksa tidak terbaca/)).toBeTruthy();
  });

  it("penunjukan tidak terbaca: disebut tidak terbaca, bukan 'belum ditetapkan'", () => {
    render(<DaftarMajelisPetugas majelis={[]} panitera={[]} jurusita={[]} ikrar={null} sumberMajelis="tidakTerbaca" />);
    expect(screen.getByText("Majelis tidak terbaca dari SIPP.")).toBeTruthy();
    expect(screen.queryByText("Majelis belum ditetapkan.")).toBeNull();
  });

  it("muatan bot lama (tanpa sumberMajelis): tanpa judul, label lama", () => {
    const { container } = render(<DaftarMajelisPetugas {...PEMERIKSA_385} />);
    expect(screen.queryByText("Majelis pemeriksa")).toBeNull();
    expect(container.textContent).toContain("Panitera:");
    expect(container.textContent).toContain("Jurusita:");
  });

  it("penunjukan di luar pemeriksaan menyebut tahapannya", () => {
    const { container } = render(
      <DaftarMajelisPetugas
        majelis={[
          ...PEMERIKSA_385.majelis,
          { id: 29, kode: "H29", nama: "Akbar Ali", jabatan: "Hakim Ketua", keteranganTahapan: "verzet" },
        ]}
        panitera={[{ id: 19, kode: "", nama: "Dwi Sartono", keteranganTahapan: "banding" }]}
        jurusita={[]}
        ikrar={null}
        sumberMajelis="pemeriksa"
      />
    );
    // Teks pembaca layar tautan ("rekap dibuka di tab baru") berada di antaranya.
    expect(container.textContent).toMatch(/Akbar Ali[^·]*· Hakim Ketua \(verzet\)/);
    expect(container.textContent).toMatch(/Dwi Sartono[^,]*\(banding\)/);
    expect(container.textContent).not.toMatch(/Arasy Latif[^·]*· Hakim Ketua \(/);
  });
});

// ===========================================================================
// LAYAR STATUS PERKARA SUNGGUHAN
// ===========================================================================

const NOMOR = "385/Pdt.G/2016/PA.Dgl";

/** Muatan bot selengkap tipe Status menuntutnya - tanpa cast. */
function statusUji(): Status {
  return {
    identitas: {
      perkaraId: "385",
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Talak",
      jenisPerkaraLengkap: "Cerai Talak",
      tanggalDaftar: "2016-01-04",
    },
    umur: {
      hariBersih: 25,
      hariMediasi: 0,
      hariBerjalan: 24,
      bulanBerjalan: 0.8,
      sudahPutus: true,
      sebabSelesai: "putus",
      hariMinutasi: null,
    },
    ...PEMERIKSA_385,
    ikrar: IKRAR_385,
    sumberMajelis: "pemeriksa",
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
    // Teks borang ikrar SIPP apa adanya - pemisahnya </br>.
    ikrarTalak: {
      terbaca: true,
      alasan: "",
      ada: true,
      penetapanMajelis: "2016-03-07",
      majelis: "Hakim Ketua: Ulfah, S.Ag., M.H.</br>Hakim Anggota 1: Amar Ma'ruf, S.Ag.</br>Hakim Anggota 2: Ruhana Faried",
      penetapanPp: "2016-01-05",
      panitera: "Imayanti, S.H.",
      penetapanJs: "2016-01-05",
      jurusita: "Jurusita: Muh. Sam'an",
      tanggalIkrar: "2016-03-17",
      sudahDiucapkan: true,
      statusId: 1,
      status: "Terlaksana",
    },
    putusanLengkap: { terbaca: false, ada: false },
    arsipKeterangan: { terbaca: false, alasan: "", sudahDiarsipkan: false, baris: [] },
    putusanEcourt: null,
    konseptor: { terbaca: false, alasan: "", baris: [] },
    delegasiMasuk: { terbaca: false, alasan: "", baris: [] },
    delegasiKeluar: { terbaca: false, alasan: "", baris: [] },
    mediasi: { terbaca: true, alasan: "", baris: [] },
    tahapan: { terbaca: false, alasan: "", tahap: [] },
    upayaHukum: [],
    penilaianSk: { rinci: [], unsurBelumTersambung: [], dasar: "", catatan: "" },
  };
}

function jawabanJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

async function gambarLayar(status: Status) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      if (String(alamat).includes("/api/aleta-ecourt/status-perkara?nomor=")) {
        return jawabanJson({ ok: true, data: { available: true, status } });
      }
      // Pembacaan lain di layar itu tidak diuji di sini - dibiarkan menunggu.
      return new Promise<Response>(() => {});
    })
  );
  render(<AletaEcourtStatusPerkara nomorAwal={NOMOR} />);
  return waitFor(() => {
    const bagian = document.getElementById("bagian-majelis");
    if (!bagian) throw new Error("bagian majelis belum tergambar");
    return bagian;
  });
}

describe("layar Status Perkara: majelis pemeriksa dan majelis ikrar talak", () => {
  it("bagian Majelis dan petugas menggambar kedua blok dari muatan bot", async () => {
    const majelis = await gambarLayar(statusUji());
    expect(within(majelis).getByText("Majelis pemeriksa")).toBeTruthy();
    expect(within(majelis).getByText("Majelis ikrar talak")).toBeTruthy();
    const ikrar = blokIkrar(majelis);
    expect(ikrar).not.toBeNull();
    expect(within(ikrar!).getAllByRole("link").map(tujuan)[0]).toEqual(["hakim", "9"]);
    // Tautan pertama bagian itu ketua PEMERIKSA.
    expect(within(majelis).getAllByRole("link").map(tujuan)[0]).toEqual(["hakim", "4"]);
  });

  it("bagian Ikrar talak: teks blangko dipecah per baris, tanda </br> tidak tertulis", async () => {
    await gambarLayar(statusUji());
    const bagian = document.getElementById("bagian-ikrar");
    expect(bagian).not.toBeNull();
    expect(bagian!.textContent).not.toMatch(/<\/?br/i);
    // Tiap anggota majelis satu baris sendiri.
    expect(within(bagian!).getByText("Hakim Ketua: Ulfah, S.Ag., M.H.")).toBeTruthy();
    expect(within(bagian!).getByText("Hakim Anggota 1: Amar Ma'ruf, S.Ag.")).toBeTruthy();
    expect(within(bagian!).getByText("Hakim Anggota 2: Ruhana Faried")).toBeTruthy();
  });
});
