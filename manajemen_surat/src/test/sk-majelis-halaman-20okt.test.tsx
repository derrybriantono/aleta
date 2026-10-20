import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AletaEcourtSkMajelis } from "@/components/portal/aleta-ecourt-sk-majelis";
import { bandingkan, drafDari, majelisBaru, periksaDraf, susunPratinjau, badanSimpan, type MajelisSk } from "@/lib/sk-majelis-draf";

/**
 * ============================================================================
 * HALAMAN ADMIN SK MAJELIS (20 Okt 2026, agen B1)
 * ============================================================================
 *
 * Super Admin/Admin: nomor, tanggal, dan berlaku mulai SK terlihat dan dapat
 * diubah; majelis ditambah/diubah/dihapus (ketua dan anggota berurutan dari
 * hakim aktif, pendamping D, D1 ... diikat ke panitera aktif); peringatan
 * pegawai SK yang tidak aktif/bermutasi/berganti jabatan; pratinjau usulan;
 * simpan hanya sesudah konfirmasi; jejak perubahan. Data lama tetap terbaca.
 */

const ambilan = vi.fn();

const HAKIM = [
  { id: 32, kode: "A", nama: "Fahri Saifuddin" },
  { id: 33, kode: "B", nama: "Sudarmin" },
  { id: 26, kode: "C1", nama: "Himawan" },
  { id: 28, kode: "C2", nama: "Idris" },
  { id: 31, kode: "C3", nama: "Derry" },
];
const PANITERA = [
  { id: 26, kode: "D", nama: "Sri Susilowati" },
  { id: 18, kode: "D", nama: "Munifa" },
  { id: 20, kode: "D", nama: "Qadariyah" },
  { id: 29, kode: "", nama: "Sitti Nurhidayah" },
];

const majelis = (kode: string, hakimKode: string[], pp: Array<[string, number]>, hari = 3): MajelisSk => ({
  majelisKode: kode,
  hari,
  namaHari: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][hari],
  paniteraKode: pp.map(([k]) => k),
  panitera: pp.map(([k, id]) => ({ kode: k, id })),
  hakimKode,
  akun: [],
  skNomor: "254/KPA.W19-A5/SK.HK2.6/VIII/2026",
  skTanggal: "2026-08-27",
  skIkutBawaan: true,
  keterangan: "",
  bawaan: false,
});

function data(timpa: Record<string, unknown> = {}) {
  return {
    majelis: [majelis("A", ["A", "C1", "C3"], [["D", 26]], 3), majelis("B", ["B", "C2", "C3"], [["D1", 18]], 2)],
    akun: [],
    akunAlasan: "",
    namaHari: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
    skBerlaku: { nomor: "254/KPA.W19-A5/SK.HK2.6/VIII/2026", tanggal: "2026-08-27" },
    berlakuMulai: { tanggal: "2026-09-01", diisi: true },
    jejak: [{ id: "adt-1", aksi: "SIMPAN_SK_MAJELIS", majelisKode: "A", oleh: "Fahri", pada: "2026-10-19T03:00:00.000Z", sebelum: null, sesudah: null }],
    peringatan: [{ majelisKode: "B", kode: "D1", nama: "Munifa", alasan: "jabatannya sekarang bukan lagi panitera pengganti" }],
    pegawaiTerbaca: true,
    pegawaiAlasan: "",
    skTetap: [],
    hakim: HAKIM,
    panitera: PANITERA,
    ...timpa,
  };
}

const kiriman: Array<{ alamat: string; badan: Record<string, unknown> }> = [];

function pasang(isi: Record<string, unknown>) {
  kiriman.length = 0;
  ambilan.mockImplementation((alamat: string, opsi?: RequestInit) => {
    if (opsi?.method === "POST") {
      kiriman.push({ alamat: String(alamat), badan: JSON.parse(String(opsi.body)) });
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, data: {} }) } as unknown as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({ ok: true, data: isi }) } as unknown as Response);
  });
}

beforeEach(() => {
  ambilan.mockReset();
  vi.stubGlobal("fetch", ambilan);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const tungguMuat = async () => {
  await waitFor(() => expect(screen.getByLabelText("Nomor SK")).toBeTruthy());
};

describe("nomor, tanggal, dan berlaku mulai SK", () => {
  it("terlihat dan terisi; data lama tanpa medan baru tetap terbaca", async () => {
    pasang(data());
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    expect((screen.getByLabelText("Nomor SK") as HTMLInputElement).value).toBe("254/KPA.W19-A5/SK.HK2.6/VIII/2026");
    expect((screen.getByLabelText("Tanggal SK") as HTMLInputElement).value).toBe("2026-08-27");
    expect((screen.getByLabelText("Berlaku mulai") as HTMLInputElement).value).toBe("2026-09-01");
  });

  it("jawaban bentuk lama (tanpa berlakuMulai, jejak, peringatan) tidak merusak halaman", async () => {
    const lama = data();
    delete (lama as Record<string, unknown>).berlakuMulai;
    delete (lama as Record<string, unknown>).jejak;
    delete (lama as Record<string, unknown>).peringatan;
    pasang(lama);
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    expect((screen.getByLabelText("Berlaku mulai") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Belum ada perubahan SK yang tercatat.")).toBeTruthy();
    expect(screen.getByText("Majelis A")).toBeTruthy();
  });

  it("mengubah nomor dan berlaku mulai: baru tersimpan sesudah konfirmasi, lewat dua alamat yang ada", async () => {
    pasang(data());
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    fireEvent.change(screen.getByLabelText("Nomor SK"), { target: { value: "300/KPA.W19-A5/SK.HK2.6/XI/2026" } });
    fireEvent.change(screen.getByLabelText("Tanggal SK"), { target: { value: "2026-11-03" } });
    fireEvent.change(screen.getByLabelText("Berlaku mulai"), { target: { value: "2026-11-10" } });
    fireEvent.click(screen.getByText("Simpan perubahan"));
    const konfirmasi = screen.getByRole("group", { name: "Konfirmasi simpan SK" });
    expect(within(konfirmasi).getByText(/Nomor\/tanggal SK: 300\/KPA/)).toBeTruthy();
    expect(kiriman).toHaveLength(0);
    fireEvent.click(screen.getByText("Ya, simpan"));
    await waitFor(() => expect(kiriman.length).toBe(2));
    const nomor = kiriman.find((k) => k.alamat.includes("pengaturan-sipp-abt"))!;
    expect(nomor.badan).toEqual({ tindakan: "simpan-nomor-sk", nilai: { majelis: { nomor: "300/KPA.W19-A5/SK.HK2.6/XI/2026", tanggal: "2026-11-03" } } });
    const berlaku = kiriman.find((k) => k.badan.tindakan === "berlaku-mulai")!;
    expect(berlaku.badan.tanggal).toBe("2026-11-10");
  });
});

describe("peringatan", () => {
  it("pegawai SK yang bermutasi/berganti jabatan dari server tampil, juga hakim tidak aktif dari draf", async () => {
    const d = data();
    d.majelis = [majelis("A", ["A", "C1", "ZZ"], [["D", 26]], 3), majelis("B", ["B", "C2", "C3"], [["D1", 18]], 2)];
    pasang(d);
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    const kotak = document.querySelector("[data-sk-peringatan]")!;
    expect(kotak.textContent).toContain("Munifa");
    expect(kotak.textContent).toContain("jabatannya sekarang bukan lagi panitera pengganti");
    expect(kotak.textContent).toContain("hakim ZZ sudah tidak aktif di SIPP");
    expect(kotak.textContent).toContain("Ganti di majelisnya");
  });

  it("tanpa peringatan, kotak tidak ditampilkan", async () => {
    pasang(data({ peringatan: [] }));
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    expect(document.querySelector("[data-sk-peringatan]")).toBeNull();
  });
});

describe("menambah majelis", () => {
  it("ketua dan anggota dipilih berurutan dari hakim aktif, pendamping diikat ke panitera aktif, pratinjau menyebutnya, simpan dengan konfirmasi", async () => {
    pasang(data({ peringatan: [] }));
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();

    fireEvent.change(screen.getByLabelText("Kode majelis baru"), { target: { value: "c2" } });
    fireEvent.click(screen.getByText("Tambah majelis", { selector: "button" }));
    const kartu = () => document.querySelector('[data-majelis="C2"]') as HTMLElement;
    expect(kartu()).toBeTruthy();

    // Belum lengkap: tidak boleh disimpan.
    expect(document.querySelector("[data-sk-galat]")!.textContent).toContain("pilih ketua dan sedikitnya satu anggota");
    expect((screen.getByText("Simpan perubahan") as HTMLButtonElement).disabled).toBe(true);

    for (let i = 0; i < 3; i++) fireEvent.click(within(kartu()).getByText(i === 0 ? "Tambah ketua" : "Tambah anggota"));
    fireEvent.change(screen.getByLabelText("Ketua Majelis C2"), { target: { value: "C2" } });
    fireEvent.change(screen.getByLabelText("Anggota 1 Majelis C2"), { target: { value: "C1" } });
    fireEvent.change(screen.getByLabelText("Anggota 2 Majelis C2"), { target: { value: "C3" } });
    fireEvent.click(within(kartu()).getByText("Tambah pendamping"));
    fireEvent.change(screen.getByLabelText("Kode panitera 1 Majelis C2"), { target: { value: "d6" } });
    fireEvent.change(screen.getByLabelText("Orang untuk kode D6 Majelis C2"), { target: { value: "29" } });

    expect(document.querySelector("[data-sk-galat]")).toBeNull();
    const pratinjau = document.querySelector("[data-sk-pratinjau]")!.textContent!;
    expect(pratinjau).toContain("Majelis C2 (sidang hari Senin): ketua C2 (Idris); anggota C1 (Himawan), C3 (Derry)");
    expect(pratinjau).toContain("D6 = Sitti Nurhidayah");
    expect(pratinjau).toContain("Memperhatikan Surat Keputusan Ketua Nomor 254/KPA.W19-A5/SK.HK2.6/VIII/2026");

    fireEvent.click(screen.getByText("Simpan perubahan"));
    expect(screen.getByRole("group", { name: "Konfirmasi simpan SK" }).textContent).toContain("Majelis C2");
    expect(kiriman).toHaveLength(0);
    fireEvent.click(screen.getByText("Ya, simpan"));
    await waitFor(() => expect(kiriman).toHaveLength(1));
    expect(kiriman[0].alamat).toContain("/api/aleta-ecourt/sk-majelis");
    expect(kiriman[0].badan).toMatchObject({
      majelisKode: "C2",
      hari: 1,
      hakimKode: "C2,C1,C3",
      paniteraKode: "D6",
      paniteraId: "D6=29",
      akunId: "",
      skNomor: "",
      skTanggal: "",
    });
  });

  it("urutan hakim dapat digeser: ketua berpindah", async () => {
    pasang(data({ peringatan: [] }));
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    const kartuA = document.querySelector('[data-majelis="A"]') as HTMLElement;
    const turun = within(kartuA).getAllByLabelText("Turunkan urutan")[0];
    fireEvent.click(turun);
    expect((screen.getByLabelText("Ketua Majelis A") as HTMLSelectElement).value).toBe("C1");
    fireEvent.click(screen.getByText("Simpan perubahan"));
    fireEvent.click(screen.getByText("Ya, simpan"));
    await waitFor(() => expect(kiriman).toHaveLength(1));
    expect(kiriman[0].badan.hakimKode).toBe("C1,A,C3");
  });
});

describe("menghapus majelis", () => {
  it("dua langkah (tanya, lalu konfirmasi simpan), mengirim tindakan hapus", async () => {
    pasang(data({ peringatan: [] }));
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    const kartuB = document.querySelector('[data-majelis="B"]') as HTMLElement;
    fireEvent.click(within(kartuB).getByText("Hapus majelis"));
    fireEvent.click(within(kartuB).getByText("Ya, hapus"));
    expect(screen.getByText("Majelis B akan dihapus dari SK saat disimpan.")).toBeTruthy();
    expect(kiriman).toHaveLength(0);
    fireEvent.click(screen.getByText("Simpan perubahan"));
    expect(screen.getByRole("group", { name: "Konfirmasi simpan SK" }).textContent).toContain("Majelis B dihapus dari SK");
    fireEvent.click(screen.getByText("Ya, simpan"));
    await waitFor(() => expect(kiriman).toHaveLength(1));
    expect(kiriman[0].badan).toEqual({ tindakan: "hapus", majelisKode: "B" });
  });

  it("penghapusan dapat dibatalkan sebelum disimpan", async () => {
    pasang(data({ peringatan: [] }));
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    const kartuB = document.querySelector('[data-majelis="B"]') as HTMLElement;
    fireEvent.click(within(kartuB).getByText("Hapus majelis"));
    fireEvent.click(within(kartuB).getByText("Ya, hapus"));
    fireEvent.click(screen.getByText("Batalkan penghapusan"));
    expect(document.querySelector('[data-majelis="B"]')).toBeTruthy();
    expect(screen.getByText("Tidak ada perubahan.")).toBeTruthy();
  });
});

describe("jejak dan daftar pegawai tidak terbaca", () => {
  it("jejak perubahan menyebut siapa dan kapan", async () => {
    pasang(data({ peringatan: [] }));
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    const jejak = document.querySelector("[data-sk-jejak]")!.textContent!;
    expect(jejak).toContain("Fahri mengubah Majelis A");
  });

  it("bot mati: kode masih dapat diketik dan halaman tidak jatuh", async () => {
    pasang(data({ hakim: [], panitera: [], pegawaiTerbaca: false, pegawaiAlasan: "aleta_bot tidak dapat dihubungi", peringatan: [] }));
    render(<AletaEcourtSkMajelis />);
    await tungguMuat();
    expect(screen.getByText(/aleta_bot tidak dapat dihubungi/)).toBeTruthy();
    expect((screen.getByLabelText("Kode hakim 1 Majelis A") as HTMLInputElement).value).toBe("A");
  });
});

describe("logika murni draf", () => {
  const asli = [majelis("A", ["A", "C1", "C3"], [["D", 26]]), majelis("B", ["B", "C2", "C3"], [["D1", 18]])];

  it("tanpa perubahan: tidak ada yang dibandingkan", () => {
    expect(bandingkan(asli, drafDari(asli), HAKIM, PANITERA)).toEqual([]);
  });

  it("memeriksa: kode kembar, hakim kurang, hakim kembar; pendamping belum diikat hanya peringatan", () => {
    const d = [...drafDari(asli), majelisBaru("A")];
    const hasil = periksaDraf(d, HAKIM, PANITERA);
    expect(hasil.galat.join(" ")).toContain("kode majelis kembar");
    expect(hasil.galat.join(" ")).toContain("pilih ketua dan sedikitnya satu anggota");
    const dobel = drafDari([majelis("A", ["A", "A", "C3"], [["D", 0]])]);
    const h2 = periksaDraf(dobel, HAKIM, PANITERA);
    expect(h2.galat.join(" ")).toContain("tidak boleh dua kali");
    expect(h2.peringatan.join(" ")).toContain("panitera D belum diikat");
  });

  it("badan simpan memakai bentuk lama: pasangan kode=id dan akun berpasangan hanya untuk kode yang masih ada", () => {
    const m = drafDari([{ ...majelis("A", ["A", "C1", "C3"], [["D", 26], ["D4", 18]]), akun: [{ kode: "A", akunId: "usr-1" }, { kode: "C2", akunId: "usr-2" }] }])[0];
    expect(badanSimpan(m)).toMatchObject({ hakimKode: "A,C1,C3", paniteraKode: "D,D4", paniteraId: "D=26,D4=18", akunId: "A=usr-1" });
  });

  it("pratinjau tanpa majelis menyebut belum memakai SK", () => {
    expect(susunPratinjau([], HAKIM, PANITERA, { nomor: "", tanggal: "", berlaku: "" })[0]).toContain("belum memakai SK");
  });
});
