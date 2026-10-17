import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SkpHalaman } from "@/components/portal/skp-halaman";

/**
 * ============================================================================
 * HALAMAN /skp - TAB MENGIKUTI HAK, LABEL SUMBER ANGKA, ISIAN, PEMETAAN, TARGET
 * ============================================================================
 *
 * Rute /api/skp/* (agen server) ditirukan menurut bentuk jawaban sebenarnya.
 * Yang diperiksa: tab yang tampil per hak, angka "dari SIPP" lawan "isian",
 * "—" untuk yang tidak terbaca (bukan nol), layar tetap tampil saat SIPP tidak
 * terjangkau, alur isian -> ajukan, dan Pemetaan/Target yang hanya dapat
 * diubah oleh yang berhak.
 */

const PERIODE = {
  kunci: "b09",
  tahun: 2026,
  label: "September",
  labelPanjang: "Bulan September Tahun 2026",
  mulai: "2026-09-01",
  selesai: "2026-09-30",
  bulan: 1,
};

const INDIKATOR_SIPP = {
  kunci: "i-sipp",
  aspek: "Kuantitas",
  teks: "Jumlah penetapan majelis hakim",
  satuan: "Perkara",
  target: 100,
  targetTeks: "100%",
  realisasi: 50,
  realisasiTeks: "50%",
  pembilang: 5,
  penyebut: 10,
  sumber: "sipp",
  dasar: "5 dari 10 penetapan",
  catatan: ["sipp"],
  statusTarget: "usulan",
};

const INDIKATOR_ISIAN = {
  kunci: "i-isian",
  aspek: "Kualitas",
  teks: "Laporan bulanan tersusun",
  satuan: "Laporan",
  target: null,
  targetTeks: "Belum ada target",
  realisasi: null,
  realisasiTeks: "—",
  pembilang: null,
  penyebut: null,
  sumber: "isian",
  dasar: "Belum ada isian manual yang diajukan.",
  catatan: ["isian"],
  statusTarget: "usulan",
};

function jawabanLembar(ubah: Record<string, unknown> = {}) {
  const pegawai = {
    userId: "u1",
    nama: "Budi Santoso",
    nip: "198001012005011001",
    pangkatGolongan: "Penata (III/c)",
    jabatanUtama: "panmud-hukum",
    jabatanTambahan: [],
    atasanNama: "Dr. Atasan",
  };
  return {
    jenis: "panmud-hukum",
    periode: PERIODE,
    pegawai,
    hak: { alasan: "sendiri", bolehUbahIsian: true, bolehUbahTarget: false, bolehTinjau: false },
    lembar: {
      jenis: "panmud-hukum",
      periode: PERIODE,
      pegawai,
      pejabatPenilai: { nama: "Dr. Ketua Contoh", nip: null, jabatan: "Ketua" },
      rhk: [
        { kunci: "rhk-1", teks: "Arsip perkara tertib", tambahan: false, indikator: [INDIKATOR_SIPP, INDIKATOR_ISIAN] },
      ],
      perilakuKerja: [],
      blokTambahan: [],
      catatan: [],
      galat: [],
      dihitungPada: "2026-10-17T08:00:00.000Z",
    },
    sippTerjangkau: true,
    dariPenetapan: false,
    penetapan: null,
    akun: [],
    catatanOperator: [],
    isian: [],
    ...ubah,
  };
}

function baris(ubah: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    nama: "Budi Santoso",
    nip: "198001012005011001",
    jabatanUtama: "panmud-hukum",
    labelJabatanUtama: "Panitera Muda Hukum",
    jabatanTambahan: [],
    jenisTersedia: ["panmud-hukum"],
    atasanNama: "Dr. Atasan",
    aktif: true,
    alasanHak: "sendiri",
    bolehUbahIsian: true,
    ...ubah,
  };
}

type Keadaan = {
  peran: string;
  bolehLihatSemua: boolean;
  bolehUbahTarget: boolean;
  bawahan: Array<Record<string, unknown>>;
  lembar: unknown;
  targetBolehUbah: boolean;
  saya: Record<string, unknown>;
};

function jawabanJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

function pasangFetch(k: Partial<Keadaan> = {}) {
  const keadaan: Keadaan = {
    peran: "lainnya",
    bolehLihatSemua: false,
    bolehUbahTarget: false,
    bawahan: [],
    lembar: jawabanLembar(),
    targetBolehUbah: false,
    saya: {},
    ...k,
  };
  const panggilan: Array<{ metode: string; jalur: string; kueri: Record<string, string>; badan: unknown }> = [];
  const ambil = vi.fn(async (alamat: string, init?: RequestInit) => {
    const url = new URL(String(alamat), "http://portal.contoh");
    const metode = init?.method ?? "GET";
    const badan = init?.body ? JSON.parse(String(init.body)) : null;
    panggilan.push({ metode, jalur: url.pathname, kueri: Object.fromEntries(url.searchParams), badan });
    const aktor = { userId: "u1", peran: keadaan.peran, bolehUbahTarget: keadaan.bolehUbahTarget, bolehLihatSemua: keadaan.bolehLihatSemua };
    if (url.pathname.endsWith("/api/skp/pegawai")) {
      const lingkup = url.searchParams.get("lingkup");
      if (lingkup === "saya") return jawabanJson({ ok: true, data: { lingkup, aktor, pegawai: [baris(keadaan.saya)] } });
      if (lingkup === "bawahan") return jawabanJson({ ok: true, data: { lingkup, aktor, pegawai: keadaan.bawahan } });
      return jawabanJson({ ok: true, data: { lingkup, aktor, pegawai: [baris(), baris({ userId: "u2", nama: "Citra Dewi", alasanHak: "ketua" })] } });
    }
    if (url.pathname.endsWith("/api/skp/lembar")) return jawabanJson({ ok: true, data: keadaan.lembar });
    if (url.pathname.endsWith("/api/skp/isian") && metode === "PUT") {
      return jawabanJson({ ok: true, data: { isian: { id: "isi-1", status: "draf", bukti: [] } } });
    }
    if (url.pathname.endsWith("/api/skp/isian") && metode === "POST") return jawabanJson({ ok: true, data: { isian: { id: "isi-1", status: "diajukan" } } });
    if (url.pathname.endsWith("/api/skp/target")) {
      return jawabanJson({ ok: true, data: { tahun: 2026, bolehUbah: keadaan.targetBolehUbah, target: [], jabatanDikenal: [] } });
    }
    if (url.pathname.endsWith("/api/skp/pemetaan")) {
      return jawabanJson({
        ok: true,
        data: {
          bolehUbah: keadaan.bolehUbahTarget,
          pemetaan: [],
          pegawai: [
            { userId: "u9", nama: "Eka Putra", nip: null, jabatanUtama: "kasir", jabatanTambahan: [], saranUtama: "kasir", saranTambahan: [], akunProfil: ["kasir1"], jumlahTautan: 0 },
          ],
        },
      });
    }
    return jawabanJson({ ok: false, error: { message: "Tidak dikenal." } }, 404);
  });
  vi.stubGlobal("fetch", ambil);
  return { ambil, panggilan };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const namaTab = () => screen.getAllByRole("tab").map((t) => t.textContent);

describe("tab mengikuti hak", () => {
  it("pegawai biasa tanpa bawahan: hanya SKP Saya", async () => {
    pasangFetch();
    render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    expect(namaTab()).toEqual(["SKP Saya"]);
  });

  it("atasan langsung: SKP Saya, Bawahan, Penetapan - tanpa Seluruh pegawai, Pemetaan, Target", async () => {
    pasangFetch({ bawahan: [baris({ userId: "u3", nama: "Bawahan Satu", alasanHak: "atasan-langsung", bolehUbahIsian: false })] });
    render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    await waitFor(() => expect(namaTab()).toEqual(["SKP Saya", "Bawahan", "Penetapan"]));
  });

  it.each(["panitera", "ketua", "wakil-ketua", "admin", "super-admin"])("%s: semua tab", async (peran) => {
    pasangFetch({ peran, bolehLihatSemua: true, bolehUbahTarget: peran !== "wakil-ketua" });
    render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    expect(namaTab()).toEqual(["SKP Saya", "Seluruh pegawai", "Penetapan", "Pemetaan akun & jabatan", "Target & RHK"]);
  });

  it("rute pegawai gagal: kalimat awam dan tombol Coba lagi", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jawabanJson({ ok: false, error: { message: "Layanan SKP belum dapat dibuka." } }, 500)));
    render(<SkpHalaman />);
    const peringatan = await screen.findByRole("alert");
    expect(peringatan.textContent).toContain("Layanan SKP belum dapat dibuka.");
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });
});

describe("SKP Saya: sumber angka", () => {
  it("menandai 'dari SIPP' dan 'isian', 'usulan' pada target, dan '—' (bukan nol) bila tidak terbaca", async () => {
    pasangFetch();
    render(<SkpHalaman />);
    const barisSipp = (await screen.findByText("Jumlah penetapan majelis hakim")).closest("li")!;
    expect(within(barisSipp).getByText("dari SIPP")).toBeTruthy();
    expect(within(barisSipp).getByText("Usulan")).toBeTruthy();
    expect(within(barisSipp).getByText("50%")).toBeTruthy();
    expect(within(barisSipp).getByText("5 dari 10")).toBeTruthy();
    const barisIsian = screen.getByText("Laporan bulanan tersusun").closest("li")!;
    expect(within(barisIsian).getByText("isian")).toBeTruthy();
    expect(within(barisIsian).getByLabelText("Realisasi Laporan bulanan tersusun").textContent).toBe("—");
    // Yang sudah terbaca dari SIPP tidak ditawari isian manual.
    expect(within(barisSipp).queryByRole("button", { name: /Isi manual/ })).toBeNull();
    expect(within(barisIsian).getByRole("button", { name: /Isi manual/ })).toBeTruthy();
  });

  it("meminta lembar jabatan pegawai itu untuk bulan terakhir yang selesai", async () => {
    const { panggilan } = pasangFetch();
    render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    const lembar = panggilan.find((p) => p.jalur.endsWith("/api/skp/lembar"))!;
    expect(lembar.kueri).toMatchObject({ jenis: "panmud-hukum", pegawai: "u1" });
    expect(lembar.kueri.periode).toMatch(/^b\d\d$/);
  });

  it("SIPP tidak terjangkau: layar tetap tampil dengan pesan awam, isian tetap dapat dibuka", async () => {
    pasangFetch({ lembar: jawabanLembar({ sippTerjangkau: false }) });
    render(<SkpHalaman />);
    await screen.findByText(/Data SIPP belum dapat dibaca saat ini/);
    expect(screen.getByText("Laporan bulanan tersusun")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Isi manual Laporan bulanan tersusun/ })).toBeTruthy();
  });

  it("dari penetapan terkunci: disebut terang-terangan", async () => {
    pasangFetch({
      lembar: jawabanLembar({
        dariPenetapan: true,
        penetapan: { id: "p1", status: "terkunci", dihitungPada: "2026-10-01T01:00:00Z", dikunciPada: "2026-10-02T01:00:00Z", pejabatPenilaiNama: "Dr. Ketua" },
      }),
    });
    render(<SkpHalaman />);
    await screen.findByText(/diambil dari penetapan yang sudah dikunci/);
  });

  it("pimpinan: unduhan diarahkan ke menu Unduh eviden SKP di Rekap Hakim", async () => {
    pasangFetch({ saya: { jabatanUtama: "ketua", jenisTersedia: ["hakim", "pimpinan"] }, lembar: jawabanLembar({ jenis: "pimpinan" }) });
    render(<SkpHalaman />);
    await screen.findByText(/diunduh lengkap bersama eviden hakimnya/);
    expect(screen.queryByRole("link", { name: /Unduh Lembar SKP/ })).toBeNull();
  });

  it("jabatan perkara: tombol PDF, Excel, Word untuk Lembar SKP dan ZIP semua dokumen", async () => {
    pasangFetch();
    render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    for (const [label, format] of [
      ["PDF", "pdf"],
      ["Excel", "xlsx"],
      ["Word", "docx"],
    ] as const) {
      const lembar = screen.getByRole("link", { name: `Unduh Lembar SKP sebagai ${label}` });
      const u = new URL(lembar.getAttribute("href")!, "http://portal.contoh");
      expect(u.pathname.endsWith("/api/skp/unduh")).toBe(true);
      expect(Object.fromEntries(u.searchParams)).toMatchObject({ jenis: "panmud-hukum", pegawai: "u1", dokumen: "lembar-skp", format });
      const zip = screen.getByRole("link", { name: `Unduh Semua dokumen dan bukti dukung (ZIP) sebagai ${label}` });
      expect(new URL(zip.getAttribute("href")!, "http://portal.contoh").searchParams.get("dokumen")).toBe("semua");
    }
  });
});

describe("isian manual", () => {
  it("mengisi nilai dan bukti lalu mengajukan: simpan draf, kemudian ajukan dengan id isian", async () => {
    const { panggilan } = pasangFetch();
    render(<SkpHalaman />);
    fireEvent.click(await screen.findByRole("button", { name: /Isi manual Laporan bulanan tersusun/ }));
    fireEvent.change(screen.getByLabelText("Nilai isian Laporan bulanan tersusun"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah bukti" }));
    fireEvent.change(screen.getByLabelText("Judul bukti 1"), { target: { value: "Laporan September" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajukan ke atasan" }));
    await screen.findByText("Isian diajukan ke atasan dan sudah ikut dihitung.");

    const put = panggilan.find((p) => p.metode === "PUT")!;
    expect(put.badan).toMatchObject({
      pegawai: "u1",
      tahun: expect.any(Number),
      kunciRhk: "rhk-1",
      kunciIndikator: "i-isian",
      nilai: 12,
      bukti: [{ judul: "Laporan September", rujukan: null, tanggal: null }],
    });
    const post = panggilan.find((p) => p.metode === "POST")!;
    expect(post.badan).toEqual({ aksi: "ajukan", id: "isi-1" });
  });

  it("pegawai yang bukan pemiliknya (atasan/Ketua) tidak diberi tombol isi", async () => {
    pasangFetch({ lembar: jawabanLembar({ hak: { alasan: "ketua", bolehUbahIsian: false, bolehUbahTarget: false, bolehTinjau: false } }) });
    render(<SkpHalaman />);
    await screen.findByText("Laporan bulanan tersusun");
    expect(screen.queryByRole("button", { name: /Isi manual/ })).toBeNull();
  });

  it("atasan melihat isian yang diajukan dan dapat menyetujui atau mengembalikan", async () => {
    const isian = {
      id: "isi-9",
      userId: "u1",
      periode: "b09",
      tahun: 2026,
      kunciRhk: "rhk-1",
      kunciIndikator: "i-isian",
      nilai: 12,
      nilaiTeks: "12 laporan",
      catatan: "",
      bukti: [{ judul: "Laporan September", rujukan: null, tanggal: null }],
      status: "diajukan",
    };
    const { panggilan } = pasangFetch({
      lembar: jawabanLembar({ hak: { alasan: "atasan-langsung", bolehUbahIsian: false, bolehUbahTarget: false, bolehTinjau: true }, isian: [isian] }),
    });
    render(<SkpHalaman />);
    const panel = await screen.findByLabelText("Isian menunggu tinjauan");
    expect(within(panel).getByText("12 laporan")).toBeTruthy();
    // Mengembalikan tanpa alasan ditolak di layar.
    fireEvent.click(within(panel).getByRole("button", { name: /Kembalikan/ }));
    await screen.findByText("Tulis alasan pengembalian lebih dahulu.");
    expect(panggilan.some((p) => p.metode === "POST")).toBe(false);
    fireEvent.click(within(panel).getByRole("button", { name: /Setujui/ }));
    await screen.findByText("Isian disetujui.");
    expect(panggilan.find((p) => p.metode === "POST")!.badan).toMatchObject({ aksi: "setujui", id: "isi-9" });
  });
});

describe("Pemetaan dan Target", () => {
  it("Pemetaan: yang berhak mengubah melihat tombol konfirmasi; Wakil Ketua hanya melihat", async () => {
    pasangFetch({ peran: "panitera", bolehLihatSemua: true, bolehUbahTarget: true });
    const { unmount } = render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    fireEvent.click(screen.getByRole("tab", { name: "Pemetaan akun & jabatan" }));
    expect(await screen.findByText("Eka Putra")).toBeTruthy();
    expect(screen.getByText("Jabatan belum dikonfirmasi")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tambah tautan akun Eka Putra" })).toBeTruthy();
    unmount();

    pasangFetch({ peran: "wakil-ketua", bolehLihatSemua: true, bolehUbahTarget: false });
    render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    fireEvent.click(screen.getByRole("tab", { name: "Pemetaan akun & jabatan" }));
    await screen.findByText("Eka Putra");
    expect(screen.queryByRole("button", { name: /Tambah tautan akun/ })).toBeNull();
  });

  it("Pemetaan: konfirmasi mengirim akun, jabatan utama, tugas PP, dan tanggal berlaku", async () => {
    const { panggilan } = pasangFetch({ peran: "panitera", bolehLihatSemua: true, bolehUbahTarget: true });
    render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    fireEvent.click(screen.getByRole("tab", { name: "Pemetaan akun & jabatan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tambah tautan akun Eka Putra" }));
    fireEvent.click(screen.getByLabelText(/Juga bertugas sebagai Panitera Pengganti/));
    fireEvent.click(screen.getByRole("button", { name: "Simpan dan konfirmasi" }));
    await screen.findByText(/Tautan Eka Putra disimpan/);
    const put = panggilan.find((p) => p.metode === "PUT" && p.jalur.endsWith("/api/skp/pemetaan"))!;
    expect(put.badan).toMatchObject({ usernameSipp: "kasir1", userId: "u9", jabatanUtama: "kasir", jabatanTambahan: ["pp"] });
    expect((put.badan as { berlakuDari: string }).berlakuDari).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("Target: berlabel 'usulan'; hanya yang berhak melihat kolom ubah", async () => {
    pasangFetch({ peran: "panitera", bolehLihatSemua: true, bolehUbahTarget: true, targetBolehUbah: true });
    const { unmount } = render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    fireEvent.click(screen.getByRole("tab", { name: "Target & RHK" }));
    await screen.findByText(/sampai ditandai sudah disahkan/);
    expect(screen.getAllByText("Usulan").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0);
    unmount();

    pasangFetch({ peran: "wakil-ketua", bolehLihatSemua: true, bolehUbahTarget: false, targetBolehUbah: false });
    render(<SkpHalaman />);
    await screen.findByText("Jumlah penetapan majelis hakim");
    fireEvent.click(screen.getByRole("tab", { name: "Target & RHK" }));
    await screen.findByText(/Target hanya dapat diubah oleh Panitera, Ketua, atau administrator/);
    expect(screen.queryAllByRole("spinbutton")).toEqual([]);
  });
});
