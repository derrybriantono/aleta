/**
 * Pop-up Penetapan kembali, DIGAMBAR (jsdom): tombol diam bagi yang tidak
 * berwenang; pratinjau mengirim kering:true dengan jenis yang dicentang saja;
 * tombol tulis padam sampai pratinjau lolos dan menuntut dua tekanan.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const KEADAAN = {
  ok: true,
  available: true,
  perkara: [
    {
      perkaraId: 9988,
      nomorPerkara: "470/Pdt.G/2026/PA.Dgl",
      sudahPutus: false,
      pmh: { tanggal: "2026-07-30", majelis: [{ hakimId: 32, nama: "Fahri Saifuddin", jabatan: "Hakim Ketua" }, { hakimId: 26, nama: "Himawan", jabatan: "Hakim Anggota" }, { hakimId: 31, nama: "Derry", jabatan: "Hakim Anggota" }] },
      ppp: { tanggal: "2026-07-30", id: 26, teks: "Panitera Pengganti: Sri Susilowati, S.H." },
      pjs: { tanggal: "2026-07-30", id: 28, teks: "Jurusita: Tanty" },
      phs: { tanggal: "2026-07-30", tanggalSidang: "2026-08-18", jam: "09:00", ruanganId: 1, ruangan: "Ruang Sidang 1" },
    },
  ],
  temuan: [],
  referensi: {
    hakim: [{ id: 33, nama: "Sudarmin" }, { id: 32, nama: "Fahri" }, { id: 26, nama: "Himawan" }, { id: 31, nama: "Derry" }],
    panitera: [{ id: 21, nama: "Andini Puspita Sari, S.Sy." }, { id: 26, nama: "Sri Susilowati, S.H." }],
    jurusita: [{ id: 28, nama: "Tanty" }, { id: 30, nama: "Mustini" }],
    ruangan: [{ id: 1, nama: "Ruang Sidang 1" }],
  },
  akun: { ok: true, username: "derry briantono", milik: ["derry briantono"] },
  calon: {
    pmh: [{ username: "fahri", namaLengkap: "Fahri Saifuddin", sebutan: "Ketua Pengadilan", siap: true, sebab: "", otomatis: true }],
    panitera: [{ username: "Sri Susilowati", namaLengkap: "Sri Susilowati, S.H.", sebutan: "Panitera", siap: true, sebab: "", otomatis: true }],
    catatan: [],
  },
};

function pasangFetch(boleh: boolean) {
  const kiriman: Array<Record<string, unknown>> = [];
  const ambilan = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("cek=1")) return new Response(JSON.stringify({ ok: true, data: { boleh } }), { status: 200 });
    if (init?.method === "POST") {
      const badan = JSON.parse(String(init.body)) as Record<string, unknown>;
      kiriman.push(badan);
      return new Response(JSON.stringify({ ok: true, data: { ok: true, kering: badan.kering, jumlahLangkah: 4, ringkas: "Panitera Pengganti: Andini", rencana: [] } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: KEADAAN }), { status: 200 });
  });
  vi.stubGlobal("fetch", ambilan);
  return { ambilan, kiriman };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Penetapan kembali - layar", () => {
  it("tidak digambar bagi yang tidak berwenang", async () => {
    pasangFetch(false);
    const { TombolPenetapanKembali } = await import("@/components/portal/penetapan-kembali");
    render(<TombolPenetapanKembali sidang={[{ perkaraId: "9988", nomorPerkara: "470/Pdt.G/2026/PA.Dgl" }]} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByText("Penetapan kembali")).toBeNull();
  });

  it("pratinjau kering dengan jenis yang dicentang saja; tulis menuntut dua tekanan dan kering:false", async () => {
    const { kiriman } = pasangFetch(true);
    const { TombolPenetapanKembali } = await import("@/components/portal/penetapan-kembali");
    render(<TombolPenetapanKembali sidang={[{ perkaraId: "9988", nomorPerkara: "470/Pdt.G/2026/PA.Dgl" }]} />);
    fireEvent.click(await screen.findByText("Penetapan kembali"));
    fireEvent.click(await screen.findByLabelText("Pilih 470/Pdt.G/2026/PA.Dgl"));
    fireEvent.click(await screen.findByLabelText("PPP 470/Pdt.G/2026/PA.Dgl"));
    fireEvent.change(screen.getByLabelText("Panitera pengganti 470/Pdt.G/2026/PA.Dgl"), { target: { value: "21" } });
    fireEvent.change(screen.getByLabelText("Alasan untuk semua"), { target: { value: "cuti-tahunan" } });

    const tulis = screen.getByText(/Tulis ke SIPP \(0\)/).closest("button")!;
    expect(tulis.disabled).toBe(true);

    fireEvent.click(screen.getByText(/Pratinjau \(1 penetapan\)/));
    await waitFor(() => expect(kiriman).toHaveLength(1));
    expect(kiriman[0]).toMatchObject({ jenis: "ppp", perkaraId: 9988, petugasId: 21, alasan: "Cuti Tahunan", kering: true, akunSipp: "derry briantono" });
    expect(kiriman[0]).not.toHaveProperty("hakimId");

    const tombol = await screen.findByText(/Tulis ke SIPP \(1\)/);
    fireEvent.click(tombol);
    expect(kiriman).toHaveLength(1);
    fireEvent.click(await screen.findByText(/Yakin\? Tekan lagi/));
    await waitFor(() => expect(kiriman).toHaveLength(2));
    expect(kiriman[1]).toMatchObject({ jenis: "ppp", kering: false });
  });
});
