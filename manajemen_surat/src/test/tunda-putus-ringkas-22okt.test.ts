/**
 * 22 Okt 2026 - menu TUNDA dan PUTUS di Jadwal Sidang disederhanakan.
 *
 * Permintaan hakim: sekali klik keluar menunya, pilih, klik simpan; tanpa
 * keterangan siapa yang menginput, tanpa tabel yang berpengaruh, tanpa tombol
 * Tutup (tertutup otomatis).
 */
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CatatHasilRingkas } from "@/components/portal/hasil-sidang";
import { usulanTanggalAwam } from "@/lib/bawaan-tunda";

const RUANGAN = [{ id: 1, kode: "101", nama: "Ruang Sidang 1 Dalam Gedung", benderaKeliling: false, aktif: true }];

type Opsi = {
  jalan: "tunda" | "putus";
  /** Jawaban POST; fungsi = tertunda sampai dilepas. */
  jawabanSimpan?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
};

function pasangFetch(opsi: Opsi) {
  const kiriman: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string, init?: RequestInit) => {
      const url = String(alamat);
      const bungkus = (data: unknown) => new Response(JSON.stringify({ data }));
      if (url.includes("/api/aleta-ecourt/sidang-tunda") && init?.method === "POST") {
        kiriman.push(JSON.parse(String(init.body)));
        return bungkus(await (opsi.jawabanSimpan?.() ?? { ok: true, kering: false }));
      }
      if (url.includes("/api/aleta-ecourt/sidang-putus") && init?.method === "POST") {
        kiriman.push(JSON.parse(String(init.body)));
        return bungkus(await (opsi.jawabanSimpan?.() ?? { ok: true, kering: false }));
      }
      if (url.includes("/api/aleta-ecourt/sidang-tunda")) {
        return bungkus({
          available: true,
          ok: true,
          keadaan: {
            jadwalId: 20500,
            perkaraId: 9900,
            nomorPerkara: "609/Pdt.G/2026/PA.Dgl",
            tanggalSidang: "2026-10-05",
            jamSidang: "09:00:00",
            agenda: "Pembacaan Gugatan",
            ditunda: "T",
            ruanganId: 1,
            ruangan: "Ruang Sidang 1 Dalam Gedung",
            sidangKeliling: "T",
          },
          riwayat: null,
          ruangan: RUANGAN,
          atasNama: { ok: true, username: "sitti", namaLengkap: "Sitti Nurhidayah" },
        });
      }
      if (url.includes("/api/aleta-ecourt/sidang-putus")) {
        return bungkus({ ok: true, daftar: [{ id: 62, nama: "Dikabulkan", dipakai: 1 }] });
      }
      return bungkus({});
    })
  );
  return kiriman;
}

function gambar(jalan: "tunda" | "putus", onTutup = vi.fn(), onSelesai = vi.fn()) {
  render(
    createElement(
      "table",
      null,
      createElement(
        "tbody",
        null,
        createElement(
          "tr",
          null,
          createElement(
            "td",
            null,
            createElement(CatatHasilRingkas, {
              jadwalId: "20500",
              nomorPerkara: "609/Pdt.G/2026/PA.Dgl",
              jalan,
              onTutup,
              onSelesai,
            })
          )
        )
      )
    )
  );
  return { onTutup, onSelesai };
}

async function isiTunda() {
  await screen.findByLabelText("Alasan penundaan", {}, { timeout: 10000 });
  fireEvent.change(screen.getByLabelText("Alasan penundaan"), { target: { value: "__ketik__" } });
  fireEvent.change(screen.getByLabelText("Alasan penundaan"), { target: { value: "Pemanggilan Tergugat" } });
  const agenda = screen.getByLabelText("Agenda sidang berikutnya") as HTMLSelectElement;
  if (!agenda.value) {
    fireEvent.change(agenda, { target: { value: "__ketik__" } });
    fireEvent.change(screen.getByLabelText("Agenda sidang berikutnya"), { target: { value: "Jawaban" } });
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("menu tunda: langsung pilihan, satu klik simpan", () => {
  it("langsung memuat pilihan alasan, agenda, tanggal, jam dan satu tombol Simpan", async () => {
    pasangFetch({ jalan: "tunda" });
    gambar("tunda");
    await screen.findByLabelText("Alasan penundaan", {}, { timeout: 10000 });
    expect(screen.getByLabelText("Agenda sidang berikutnya")).toBeTruthy();
    expect(document.querySelector('input[type="date"]')).not.toBeNull();
    expect(document.querySelector('input[type="time"]')).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Simpan" })).toHaveLength(1);
  });

  it("tanpa tombol Tutup", async () => {
    pasangFetch({ jalan: "tunda" });
    gambar("tunda");
    await screen.findByLabelText("Alasan penundaan", {}, { timeout: 10000 });
    expect(screen.queryByRole("button", { name: /tutup/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/\bTutup\b/);
  });

  it("tanpa keterangan penginput maupun tabel - sebelum dan sesudah menyimpan", async () => {
    pasangFetch({
      jalan: "tunda",
      jawabanSimpan: () => ({
        ok: true,
        kering: false,
        atasNama: { username: "sitti", namaLengkap: "Sitti Nurhidayah" },
        sidangBerikutnya: { tanggal: "2026-10-19", jam: "09:00", agenda: "Jawaban" },
        selesai: [{ tabel: "perkara_jadwal_sidang", aksi: "UPDATE", keterangan: "jadwal 20500" }],
        antrian: { ok: true, kering: false, baris: 1 },
      }),
    });
    gambar("tunda");
    await isiTunda();
    const sebelum = document.body.textContent ?? "";
    for (const terlarang of [/atas nama/i, /akan tercatat/i, /Sitti Nurhidayah/, /sitti\b/, /tabel/i, /perkara_/, /ditulis ke SIPP/i]) {
      expect(sebelum).not.toMatch(terlarang);
    }
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await screen.findByText(/ditunda ke/);
    const sesudah = document.body.textContent ?? "";
    for (const terlarang of [/atas nama/i, /Sitti Nurhidayah/, /tabel/i, /perkara_/, /ditulis ke SIPP/i, /Jadwal sidang diperbarui/i, /baris\)/]) {
      expect(sesudah).not.toMatch(terlarang);
    }
  });

  it("satu klik simpan: muatan terkirim sekali, konfirmasi singkat, lalu tertutup sendiri", async () => {
    const kiriman = pasangFetch({ jalan: "tunda" });
    const { onTutup, onSelesai } = gambar("tunda");
    await isiTunda();
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await screen.findByText(/ditunda ke/);
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0]).toMatchObject({ kering: false, alasanTunda: "Pemanggilan Tergugat" });
    expect(onSelesai).toHaveBeenCalledTimes(1);
    // Belum tertutup seketika (konfirmasinya sempat terbaca), tetapi tertutup sendiri.
    expect(onTutup).not.toHaveBeenCalled();
    await waitFor(() => expect(onTutup).toHaveBeenCalledTimes(1), { timeout: 5000 });
  });

  it("klik ganda hanya menyimpan sekali", async () => {
    let lepas: (() => void) | undefined;
    const kiriman = pasangFetch({
      jalan: "tunda",
      jawabanSimpan: () =>
        new Promise((selesai) => {
          lepas = () => selesai({ ok: true, kering: false });
        }),
    });
    gambar("tunda");
    await isiTunda();
    const tombol = screen.getByRole("button", { name: "Simpan" });
    fireEvent.click(tombol);
    fireEvent.click(tombol);
    fireEvent.click(tombol);
    await waitFor(() => expect(kiriman).toHaveLength(1));
    lepas?.();
    await screen.findByText(/ditunda ke/);
    expect(kiriman).toHaveLength(1);
  });

  it("simpan gagal: menu tetap terbuka dengan pesan jelas dan dapat dicoba lagi", async () => {
    let berhasil = false;
    const kiriman = pasangFetch({
      jalan: "tunda",
      jawabanSimpan: () => (berhasil ? { ok: true, kering: false } : { ok: false, alasan: "SIPP sedang tidak dapat dihubungi." }),
    });
    const { onTutup, onSelesai } = gambar("tunda");
    await isiTunda();
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await screen.findByText("SIPP sedang tidak dapat dihubungi.");
    expect(onTutup).not.toHaveBeenCalled();
    expect(onSelesai).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Alasan penundaan")).toBeTruthy();
    // Isian utuh dan tombolnya bisa ditekan lagi.
    berhasil = true;
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    await screen.findByText(/ditunda ke/);
    expect(kiriman).toHaveLength(2);
  });

  it("yang jarang diubah terlipat di Pilihan lain, tidak dihapus", async () => {
    pasangFetch({ jalan: "tunda" });
    gambar("tunda");
    await screen.findByLabelText("Alasan penundaan", {}, { timeout: 10000 });
    const lipat = document.querySelector("details[data-pilihan-lain]") as HTMLDetailsElement;
    expect(lipat).not.toBeNull();
    expect(lipat.open).toBe(false);
    expect(lipat.textContent).toContain("Pilihan lain");
    expect(lipat.contains(screen.getByLabelText("Ruang sidang berikutnya"))).toBe(true);
    expect(lipat.contains(screen.getByLabelText("Sidang keliling"))).toBe(true);
    expect(lipat.textContent).toContain("Kehadiran pihak");
  });
});

describe("tertutup tanpa menyimpan: klik di luar atau Esc", () => {
  it("klik di luar menutup, klik di dalam tidak", async () => {
    pasangFetch({ jalan: "tunda" });
    const { onTutup } = gambar("tunda");
    await screen.findByLabelText("Alasan penundaan", {}, { timeout: 10000 });
    fireEvent.mouseDown(screen.getByLabelText("Alasan penundaan"));
    expect(onTutup).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.body);
    expect(onTutup).toHaveBeenCalledTimes(1);
  });

  it("Esc menutup", async () => {
    pasangFetch({ jalan: "putus" });
    const { onTutup } = gambar("putus");
    await screen.findByLabelText("Tanggal putusan", {}, { timeout: 10000 }).catch(() => undefined);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onTutup).toHaveBeenCalledTimes(1);
  });

  it("tombol tunda | putus pada baris tidak dihitung klik di luar", async () => {
    pasangFetch({ jalan: "tunda" });
    const { onTutup } = gambar("tunda");
    await screen.findByLabelText("Alasan penundaan", {}, { timeout: 10000 });
    const tombolBaris = document.createElement("span");
    tombolBaris.setAttribute("data-tombol-tunda-putus", "");
    const anak = document.createElement("button");
    tombolBaris.appendChild(anak);
    document.body.appendChild(tombolBaris);
    fireEvent.mouseDown(anak);
    expect(onTutup).not.toHaveBeenCalled();
    tombolBaris.remove();
  });

  it("selama menyimpan, klik di luar dan Esc diabaikan", async () => {
    let lepas: (() => void) | undefined;
    pasangFetch({
      jalan: "tunda",
      jawabanSimpan: () =>
        new Promise((selesai) => {
          lepas = () => selesai({ ok: true, kering: false });
        }),
    });
    const { onTutup } = gambar("tunda");
    await isiTunda();
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(lepas).toBeDefined());
    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onTutup).not.toHaveBeenCalled();
    lepas?.();
    await screen.findByText(/ditunda ke/);
  });
});

describe("menu putus", () => {
  it("status putusan sudah terpilih (Dikabulkan), satu klik Simpan, lalu konfirmasi dan tertutup sendiri", async () => {
    const kiriman = pasangFetch({
      jalan: "putus",
      jawabanSimpan: () => ({
        ok: true,
        kering: false,
        atasNama: { username: "sitti", namaLengkap: "Sitti Nurhidayah" },
        putusan: { tanggalPutus: "2026-10-05", status: "Dikabulkan", verstek: false, amar: "" },
        selesai: [{ tabel: "perkara_putusan", aksi: "INSERT", keterangan: "" }],
      }),
    });
    const { onTutup } = gambar("putus");
    await waitFor(() => expect((screen.getByRole("button", { name: "Simpan" }) as HTMLButtonElement).disabled).toBe(false), {
      timeout: 10000,
    });
    expect(screen.queryByRole("button", { name: /tutup/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await screen.findByText(/tercatat: Dikabulkan/);
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0]).toMatchObject({ statusPutusanId: 62, kering: false });
    expect(document.body.textContent).not.toMatch(/atas nama|Sitti Nurhidayah|tabel|perkara_/i);
    await waitFor(() => expect(onTutup).toHaveBeenCalledTimes(1), { timeout: 5000 });
  });
});

describe("keterangan tanggal berikutnya: kalimat awam", () => {
  it("memetakan tiap sumber ke satu kalimat pendek tanpa menyebut data e-Court", () => {
    expect(usulanTanggalAwam({ sumber: "court-calendar", penjelasan: "mengikuti Court Calendar: 2026-07-08 (sidang ke-3)." })).toBe("Usulan: sesuai Court Calendar.");
    expect(usulanTanggalAwam({ sumber: "mediasi", penjelasan: "tundaan mediasi: 3 minggu (21 hari) sesudah sidang ini." })).toBe("Usulan: 3 minggu sesudah sidang ini.");
    expect(usulanTanggalAwam({ sumber: "dua-pekan", penjelasan: "Court Calendar tidak terbaca, dua pekan sesudah sidang ini." })).toBe("Usulan: 2 minggu sesudah sidang ini.");
    expect(
      usulanTanggalAwam({ sumber: "tidak-hadir", penjelasan: "tergugat tidak setuju e-Court: 1 minggu (7 hari) sesudah sidang ini." })
    ).toBe("Usulan: 1 minggu sesudah sidang ini.");
    expect(
      usulanTanggalAwam({ sumber: "tidak-hadir", penjelasan: "penggugat dan tergugat tidak hadir, data e-Court belum dibaca: 2 minggu (14 hari) sesudah sidang ini." })
    ).toBe("Usulan: 2 minggu sesudah sidang ini.");
  });

  it("menyebut pergeseran karena hari libur", () => {
    expect(usulanTanggalAwam({ sumber: "dua-pekan", penjelasan: "", bergeserDari: "2026-10-19" })).toContain("hari libur");
  });

  it("menu tunda tidak menampilkan kata e-Court, dibaca, atau data", async () => {
    pasangFetch({ jalan: "tunda" });
    gambar("tunda");
    await screen.findByLabelText("Alasan penundaan", {}, { timeout: 10000 });
    const ket = document.querySelector("[data-sumber-tanggal]")?.textContent ?? "";
    expect(ket).toMatch(/^Usulan: /);
    expect(ket).not.toMatch(/e-Court|dibaca|data /i);
  });
});

describe("tampilan di baris Jadwal Sidang", () => {
  const SIDANG = fs.readFileSync(path.join(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");
  it("pasangan tombol tunda | putus ditandai agar tekanannya tidak dianggap klik di luar", () => {
    expect(SIDANG).toContain('className="inline-flex align-middle" data-tombol-tunda-putus=""');
  });
  it("pemanggilnya tidak lagi menyediakan tombol Tutup sendiri", () => {
    const i = SIDANG.indexOf("<CatatHasilRingkas");
    expect(SIDANG.slice(i, i + 400)).toContain("onTutup={() => setCatat(null)}");
  });
});
