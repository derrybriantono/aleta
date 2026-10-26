/**
 * ============================================================================
 * TUNDA MEDIASI - LAYAR JADWAL MEDIASI (jsdom) - 26 OKT 2026
 * ============================================================================
 *
 * Layar Jadwal Mediasi digambar SUNGGUHAN dengan fetch tiruan: tombol Tunda
 * (siapa yang melihatnya), formulir, pratinjau, Simpan ke SIPP, dan baris
 * daftar yang berubah seketika. Penulisan ke SIPP dikerjakan bot - diuji di
 * tunda-mediasi-26okt.test.ts; di sini yang dijaga: tidak ada yang terkirim
 * sebagai tulisan sebelum Simpan ke SIPP ditekan.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pengguna = vi.hoisted(() => ({ nilai: undefined as unknown }));
vi.mock("@/lib/app-state", async (asli) => ({
  ...((await asli()) as Record<string, unknown>),
  usePenggunaAktifOpsional: () => pengguna.nilai,
}));

import { AletaEcourtMediasi } from "@/components/portal/aleta-ecourt-mediasi";
import { tanggalUsulanTundaMediasi } from "@/lib/tunda-mediasi";

const HARI_INI = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TANGGAL = iso(HARI_INI);

function baris(sebagian: Record<string, unknown> = {}) {
  return {
    mediasiId: "9",
    perkaraId: "77",
    nomorPerkara: "77/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    jenisPerkaraId: 347,
    tanggal: TANGGAL,
    jam: "09:00",
    sampaiJam: "10:00",
    tempat: "Ruang Mediasi",
    dihadiri: "",
    ditunda: false,
    mediator: "Hakim Mediator, S.H.",
    statusMediator: "H",
    jenisMediasi: "",
    nomorSk: "",
    penetapanMediator: "",
    laporanMediator: "",
    selesai: false,
    hasil: "",
    hasilTeks: "",
    lamaHari: null,
    tenggatPerma: "",
    sisaHariTenggat: null,
    lewatTenggang: false,
    pihak: { penggugat: ["Andi"], tergugat: ["Wati"] },
    ...sebagian,
  };
}

const AKTIF = baris();
const SUDAH_DITUNDA = baris({ mediasiId: "10", perkaraId: "78", nomorPerkara: "78/Pdt.G/2026/PA.Dgl", ditunda: true });
const SELESAI = baris({ mediasiId: "11", perkaraId: "79", nomorPerkara: "79/Pdt.G/2026/PA.Dgl", selesai: true, laporanMediator: TANGGAL });

type Kiriman = { url: string; body: Record<string, unknown> };

function pasangFetch(
  daftar: unknown[],
  opsi: { keadaan?: Record<string, unknown>; jawabanSimpan?: Record<string, unknown>; jawabanBerurutan?: Array<Record<string, unknown>> } = {}
) {
  const kiriman: Kiriman[] = [];
  const keadaanDasar = {
    available: true,
    ok: true,
    boleh: true,
    bolehAnda: true,
    perluKehadiran: false,
    jumlahPertemuan: 1,
    penetapanMediator: TANGGAL,
    tenggat: iso(new Date(HARI_INI.getTime() + 30 * 86_400_000)),
    hariIni: TANGGAL,
    pertemuan: { id: 1, urutan: 1, tanggal: TANGGAL, jam: "09:00", sampaiJam: "10:00", tempat: "Ruang Mediasi", dihadiriOleh: "1", kehadiran: "Semua pihak" },
    akun: {
      panitera: { username: "andini", namaLengkap: "Andini, S.H." },
      mediator: { username: "fahri", namaLengkap: "Fahri, S.H.I." },
      hakim: null,
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string, init?: RequestInit) => {
      const url = String(alamat);
      let data: unknown = { baris: [], peta: {} };
      if (url.includes("/api/aleta-ecourt/jadwal-mediasi")) data = { mediasi: daftar };
      else if (url.includes("/api/aleta-ecourt/tunda-mediasi")) {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as Record<string, unknown>;
          kiriman.push({ url, body });
          data =
            body.kering === false
              ? (opsi.jawabanBerurutan?.shift() ?? opsi.jawabanSimpan ?? {
                  available: true,
                  ok: true,
                  kering: false,
                  baru: { urutan: 2, tanggal: body.tanggalBaru, tempat: body.tempat, jam: body.jam || "", sampaiJam: body.sampaiJam || "" },
                  kehadiran: { nilai: "", label: "", diisiSekarang: false },
                })
              : {
                  available: true,
                  ok: true,
                  kering: true,
                  atasNama: { username: "andini", namaLengkap: "Andini, S.H.", sebagai: "panitera" },
                  rencana: [
                    { tabel: "perkara_jadwal_mediasi", aksi: "UPDATE", keterangan: "pertemuan mediasi ditandai ditunda (ditunda = Y)" },
                    { tabel: "sys_audittrail", aksi: "INSERT", keterangan: "catatan audit perubahan jadwal mediasi" },
                    { tabel: "perkara_jadwal_mediasi", aksi: "INSERT", keterangan: "pertemuan mediasi berikutnya" },
                    { tabel: "sys_audittrail", aksi: "INSERT", keterangan: "catatan audit penambahan jadwal mediasi" },
                  ],
                  peringatan: [],
                };
        } else data = { ...keadaanDasar, ...(opsi.keadaan ?? {}) };
      }
      return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
    })
  );
  return kiriman;
}

async function tampil(daftar: unknown[]) {
  render(createElement(AletaEcourtMediasi));
  await waitFor(() => expect(screen.getAllByText(/\/Pdt\.G\/2026\/PA\.Dgl/).length).toBeGreaterThan(0), { timeout: 20_000 });
  void daftar;
}

const tombolTunda = (nomor: string) => document.querySelector(`[data-tombol-tunda-mediasi="${nomor}"]`) as HTMLButtonElement | null;

beforeEach(() => {
  window.localStorage.clear();
  pengguna.nilai = undefined;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("tombol Tunda di Jadwal Mediasi", () => {
  it("tampil pada pertemuan yang belum ditunda dan mediasinya belum selesai - tidak pada yang sudah ditunda atau selesai", async () => {
    pasangFetch([AKTIF, SUDAH_DITUNDA, SELESAI]);
    await tampil([AKTIF, SUDAH_DITUNDA, SELESAI]);
    expect(tombolTunda(AKTIF.nomorPerkara)).toBeTruthy();
    expect(tombolTunda(SUDAH_DITUNDA.nomorPerkara)).toBeNull();
    expect(tombolTunda(SELESAI.nomorPerkara)).toBeNull();
  });

  it("peran tanpa hak menunda mediasi (kasir) tidak melihat tombolnya; mediator melihatnya", async () => {
    pengguna.nilai = { id: "u1", roleId: "pelaksana", positionId: "pos-staf-umum", additionalRoleIds: ["kasir"] };
    pasangFetch([AKTIF]);
    await tampil([AKTIF]);
    expect(tombolTunda(AKTIF.nomorPerkara)).toBeNull();
    cleanup();

    pengguna.nilai = { id: "u2", roleId: "pelaksana", positionId: "pos-staf-umum", additionalRoleIds: ["mediator"] };
    pasangFetch([AKTIF]);
    await tampil([AKTIF]);
    expect(tombolTunda(AKTIF.nomorPerkara)).toBeTruthy();
  });

  it("saklar Tampilan 'Tombol Tunda mediasi' menyembunyikannya; hak tidak berubah", async () => {
    window.localStorage.setItem("aleta.jadwal-mediasi.tampilan", JSON.stringify({ "tombol-tunda-mediasi": false }));
    pasangFetch([AKTIF]);
    await tampil([AKTIF]);
    await waitFor(() => expect(tombolTunda(AKTIF.nomorPerkara)).toBeNull());
  });
});

describe("formulir Tunda mediasi: pratinjau dulu, tulis hanya saat Simpan ke SIPP", () => {
  it("alur lengkap: alasan -> pratinjau (kering) -> Simpan ke SIPP (kering false) -> baris langsung berubah", async () => {
    const kiriman = pasangFetch([AKTIF]);
    await tampil([AKTIF]);

    // Perluas rentang supaya pertemuan berikutnya (dua pekan lagi) ikut tampil.
    const akhir = iso(new Date(HARI_INI.getTime() + 40 * 86_400_000));
    fireEvent.change(screen.getByLabelText("Sampai tanggal"), { target: { value: akhir } });
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan" }));
    await waitFor(() => expect(tombolTunda(AKTIF.nomorPerkara)).toBeTruthy());

    fireEvent.click(tombolTunda(AKTIF.nomorPerkara)!);
    const dialog = await screen.findByRole("dialog", { name: /Tunda mediasi 77\/Pdt\.G\/2026\/PA\.Dgl/ });
    // keadaan terbaca: pertemuan yang ditunda disebut
    await within(dialog).findByText("Pertemuan yang ditunda");

    // Belum lengkap (alasan kosong): Pratinjau dan Simpan mati.
    const pratinjau = dialog.querySelector("[data-tombol-pratinjau-tunda]") as HTMLButtonElement;
    const simpan = dialog.querySelector("[data-tombol-simpan-tunda]") as HTMLButtonElement;
    expect(pratinjau.disabled).toBe(true);
    expect(simpan.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Alasan penundaan"), { target: { value: "kedua-pihak-tidak-hadir" } });
    // Tanggal usulan terisi (dua pekan), tempat bawaan = tempat pertemuan ini.
    const usulan = tanggalUsulanTundaMediasi(TANGGAL, TANGGAL);
    expect((within(dialog).getByLabelText("Tanggal mediasi berikutnya") as HTMLInputElement).value || (dialog.querySelector('input[type="date"]') as HTMLInputElement).value).toBe(usulan);
    expect((within(dialog).getByLabelText("Tempat pelaksanaan mediasi") as HTMLTextAreaElement).value).toBe("Ruang Mediasi");
    fireEvent.change(within(dialog).getByLabelText("Tempat pelaksanaan mediasi"), { target: { value: "Kantor KUA Labuan" } });
    fireEvent.change(within(dialog).getByLabelText("Jam mulai"), { target: { value: "09:30" } });

    // Simpan masih mati sampai ada pratinjau.
    expect((dialog.querySelector("[data-tombol-simpan-tunda]") as HTMLButtonElement).disabled).toBe(true);
    expect(kiriman).toHaveLength(0);

    fireEvent.click(dialog.querySelector("[data-tombol-pratinjau-tunda]") as HTMLButtonElement);
    await waitFor(() => expect(dialog.querySelector("[data-pratinjau-tunda-mediasi]")).toBeTruthy());
    expect(within(dialog).getByText(/Akan ditulis ke SIPP atas nama Andini, S\.H\./)).toBeTruthy();
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].body).toMatchObject({
      mediasiId: "9",
      tanggal: TANGGAL,
      tanggalBaru: usulan,
      tempat: "Kantor KUA Labuan",
      jam: "09:30",
      alasan: "Kedua pihak tidak hadir",
      atasNama: "panitera",
      kering: true,
    });

    fireEvent.click(dialog.querySelector("[data-tombol-simpan-tunda]") as HTMLButtonElement);
    await waitFor(() => expect(dialog.querySelector("[data-tunda-mediasi-berhasil]")).toBeTruthy());
    expect(kiriman).toHaveLength(2);
    expect(kiriman[1].body).toMatchObject({ kering: false, tanyaJamKerja: true, tanggalBaru: usulan, tempat: "Kantor KUA Labuan" });

    // Baris daftar berubah seketika: pertemuan lama bertanda ditunda, pertemuan berikutnya muncul.
    fireEvent.click(within(dialog).getByRole("button", { name: "Selesai" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const semuaBaris = screen.getAllByText(AKTIF.nomorPerkara).filter((el) => el.closest("tr")).map((el) => el.closest("tr")!);
    expect(semuaBaris).toHaveLength(2);
    expect(within(semuaBaris[0]).getByText(/^ditunda$/i)).toBeTruthy();
    expect(within(semuaBaris[1]).queryByText(/^ditunda$/i)).toBeNull();
    expect(within(semuaBaris[1]).getByText("Kantor KUA Labuan")).toBeTruthy();
    // pertemuan lama tidak punya tombol Tunda lagi; yang baru punya.
    expect(document.querySelectorAll("[data-tombol-tunda-mediasi]").length).toBe(1);
  });

  it("mengubah isian setelah pratinjau membatalkan pratinjau - yang disimpan harus yang terlihat", async () => {
    const kiriman = pasangFetch([AKTIF]);
    await tampil([AKTIF]);
    fireEvent.click(tombolTunda(AKTIF.nomorPerkara)!);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Pertemuan yang ditunda");
    fireEvent.change(within(dialog).getByLabelText("Alasan penundaan"), { target: { value: "mediator-berhalangan" } });
    fireEvent.click(dialog.querySelector("[data-tombol-pratinjau-tunda]") as HTMLButtonElement);
    await waitFor(() => expect(dialog.querySelector("[data-pratinjau-tunda-mediasi]")).toBeTruthy());
    fireEvent.change(within(dialog).getByLabelText("Tempat pelaksanaan mediasi"), { target: { value: "Ruang lain" } });
    expect(dialog.querySelector("[data-pratinjau-tunda-mediasi]")).toBeNull();
    expect((dialog.querySelector("[data-tombol-simpan-tunda]") as HTMLButtonElement).disabled).toBe(true);
    expect(kiriman.every((k) => k.body.kering === true)).toBe(true);
  });

  it("kehadiran belum diisi di SIPP: formulir meminta kehadiran dulu dan mengirimkannya", async () => {
    const kiriman = pasangFetch([AKTIF], { keadaan: { perluKehadiran: true, usulanKehadiran: "2", pertemuan: { id: 1, urutan: 1, tanggal: TANGGAL, jam: "09:00", sampaiJam: "", tempat: "Ruang Mediasi", dihadiriOleh: "", kehadiran: "" } } });
    await tampil([AKTIF]);
    fireEvent.click(tombolTunda(AKTIF.nomorPerkara)!);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Pertemuan yang ditunda");
    const pilih = within(dialog).getByLabelText("Kehadiran pihak") as HTMLSelectElement;
    expect(pilih.value).toBe("2"); // usulan dari catatan kehadiran ALETA
    fireEvent.change(pilih, { target: { value: "" } });
    fireEvent.change(within(dialog).getByLabelText("Alasan penundaan"), { target: { value: "pihak-berhalangan" } });
    // Kehadiran kosong -> belum lengkap
    expect((dialog.querySelector("[data-tombol-pratinjau-tunda]") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(pilih, { target: { value: "3" } });
    fireEvent.click(dialog.querySelector("[data-tombol-pratinjau-tunda]") as HTMLButtonElement);
    await waitFor(() => expect(kiriman).toHaveLength(1));
    expect(kiriman[0].body).toMatchObject({ kehadiran: "3", kering: true });
  });

  it("tanggal berikutnya melewati tenggang 30 hari: peringatan tampil, penulisan tidak dilarang", async () => {
    pasangFetch([AKTIF], { keadaan: { tenggat: TANGGAL } });
    await tampil([AKTIF]);
    fireEvent.click(tombolTunda(AKTIF.nomorPerkara)!);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Pertemuan yang ditunda");
    expect(dialog.querySelector("[data-peringatan-tenggang]")?.textContent).toMatch(/melewati batas tenggang mediasi 30 hari/);
    fireEvent.change(within(dialog).getByLabelText("Alasan penundaan"), { target: { value: "lanjutan" } });
    expect((dialog.querySelector("[data-tombol-pratinjau-tunda]") as HTMLButtonElement).disabled).toBe(false);
  });

  it("pertemuan yang tidak boleh ditunda: sebab disebut, tidak ada formulir maupun tombol tulis", async () => {
    const kiriman = pasangFetch([AKTIF], { keadaan: { boleh: false, sebabTolak: "Hanya pertemuan mediasi TERAKHIR yang dapat ditunda (aturan SIPP)." } });
    await tampil([AKTIF]);
    fireEvent.click(tombolTunda(AKTIF.nomorPerkara)!);
    const dialog = await screen.findByRole("dialog");
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/Hanya pertemuan mediasi TERAKHIR/);
    expect(dialog.querySelector("[data-tombol-simpan-tunda]")).toBeNull();
    expect(dialog.querySelector("[data-tombol-pratinjau-tunda]")).toBeNull();
    expect(kiriman).toHaveLength(0);
  });

  it("bukan pemilik perkara (bolehAnda false): alasan disebut, tidak ada tombol tulis", async () => {
    pasangFetch([AKTIF], { keadaan: { bolehAnda: false, sebabAnda: "Menunda mediasi hanya untuk mediator, majelis, atau panitera pengganti perkara ini." } });
    await tampil([AKTIF]);
    fireEvent.click(tombolTunda(AKTIF.nomorPerkara)!);
    const dialog = await screen.findByRole("dialog");
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/hanya untuk mediator, majelis/);
    expect(dialog.querySelector("[data-tombol-simpan-tunda]")).toBeNull();
  });

  it("di luar jam kerja: pertanyaan Antrekan / Tulis sekarang; diantrekan = baris daftar TIDAK berubah", async () => {
    const kiriman = pasangFetch([AKTIF], {
      jawabanSimpan: { ok: true, kering: false, diantrekan: true, pesan: "Diantrekan - dikerjakan pada jam kerja berikutnya." },
    });
    await tampil([AKTIF]);
    fireEvent.click(tombolTunda(AKTIF.nomorPerkara)!);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Pertemuan yang ditunda");
    fireEvent.change(within(dialog).getByLabelText("Alasan penundaan"), { target: { value: "lanjutan" } });
    fireEvent.click(dialog.querySelector("[data-tombol-pratinjau-tunda]") as HTMLButtonElement);
    await waitFor(() => expect(dialog.querySelector("[data-pratinjau-tunda-mediasi]")).toBeTruthy());
    fireEvent.click(dialog.querySelector("[data-tombol-simpan-tunda]") as HTMLButtonElement);
    await waitFor(() => expect(kiriman.length).toBe(2));
    await within(dialog).findByText(/Diantrekan/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Selesai" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // tidak ada pertemuan baru, pertemuan lama belum bertanda ditunda
    const tr = screen.getAllByText(AKTIF.nomorPerkara).filter((el) => el.closest("tr")).map((el) => el.closest("tr")!);
    expect(tr).toHaveLength(1);
    expect(within(tr[0]).queryByText(/^ditunda$/i)).toBeNull();
  });

  it("pertanyaan di luar jam kerja (perluPilihan): pilihan 'Tulis sekarang' mengirim ulang dengan jamKerja, lalu baris berubah", async () => {
    const kiriman = pasangFetch([AKTIF], {
      jawabanBerurutan: [{ ok: false, perluPilihan: true, kode: "di_luar_jam_kerja", pesan: "Sekarang di luar jam kerja. Bawaannya ditulis sekarang (hari ini)." }],
    });
    await tampil([AKTIF]);
    fireEvent.click(tombolTunda(AKTIF.nomorPerkara)!);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Pertemuan yang ditunda");
    fireEvent.change(within(dialog).getByLabelText("Alasan penundaan"), { target: { value: "lanjutan" } });
    fireEvent.click(dialog.querySelector("[data-tombol-pratinjau-tunda]") as HTMLButtonElement);
    await waitFor(() => expect(dialog.querySelector("[data-pratinjau-tunda-mediasi]")).toBeTruthy());
    fireEvent.click(dialog.querySelector("[data-tombol-simpan-tunda]") as HTMLButtonElement);
    await within(dialog).findByText(/Sekarang di luar jam kerja/);
    // belum ada yang tertulis: baris daftar masih utuh
    expect(kiriman.filter((k) => k.body.kering === false)).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Tulis sekarang" }));
    await waitFor(() => expect(dialog.querySelector("[data-tunda-mediasi-berhasil]")).toBeTruthy());
    const tulis = kiriman.filter((k) => k.body.kering === false);
    expect(tulis).toHaveLength(2);
    expect(tulis[1].body).toMatchObject({ jamKerja: "sekarang", tanyaJamKerja: true });
  });
});
