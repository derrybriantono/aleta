import { readFileSync } from "node:fs";
import path from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  JadwalkanTundaSidang,
  jamTulisBawaan,
  sebabBelumBolehJadwal,
  sekarangWita,
  susunBadanTundaTerjadwal,
  type IsianTundaTerjadwal,
} from "@/components/portal/jadwalkan-tunda-sidang";

/**
 * Jadwalkan tundaan di layar Hasil Sidang (27 Okt 2026): isian form tunda yang sama dapat DITULIS SEKARANG
 * (tombol lama) atau DIJADWALKAN pada jam hari sidang itu; butir terjadwal sidang itu tampil dengan Batal.
 * Server dan jam ditiru; muatan harus persis kontrak POST sidang-terjadwal jenis tunda.
 */

// 27 Okt 2026 11.00 WITA = 03.00 UTC.
const SEKARANG = Date.parse("2026-10-27T03:00:00Z");

const isian: IsianTundaTerjadwal = {
  jadwalId: 9001,
  perkaraId: 30684,
  nomorPerkara: "684/Pdt.G/2026/PA.Dgl",
  tanggalSidang: "2026-10-27",
  alasanTunda: "Menunggu hasil mediasi",
  tanggalBerikut: "2026-11-10",
  jamBerikut: "09:00",
  agendaBerikut: "Pembuktian",
  dihadiriOleh: 2,
  ruangId: 3,
};

type Panggilan = { url: string; metode: string; badan: unknown };
let panggilan: Panggilan[] = [];
let butirServer: Array<Record<string, unknown>> = [];
let tolak: { sebab: string; tolak?: Array<{ sebab: string }> } | null = null;
let pelaksanaNyala = true;

function jawab(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => ({ ok, data }) } as unknown as Response;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SEKARANG);
  panggilan = [];
  butirServer = [];
  tolak = null;
  pelaksanaNyala = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const metode = String(init?.method || "GET").toUpperCase();
      const badan = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      panggilan.push({ url: String(url), metode, badan });
      if (metode === "POST") {
        if (tolak) return jawab({ ok: false, sebab: tolak.sebab, tolak: tolak.tolak || [] }, false);
        butirServer = [{ id: "t1", jenis: "tunda", status: "menunggu", waktuWita: `${badan.mulai}`, bolehBatal: true }];
        return jawab({ ok: true, butir: [{ id: "t1", nomorPerkara: isian.nomorPerkara, waktuWita: badan.mulai }] });
      }
      if (metode === "PATCH") {
        butirServer = butirServer.map((b) => (b.id === badan.id ? { ...b, status: "dibatalkan", bolehBatal: false } : b));
        return jawab({ ok: true, butir: { id: badan.id } });
      }
      return jawab({ ok: true, butir: butirServer, pelaksanaNyala });
    })
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("pembantu murni", () => {
  it("jam WITA, jam bawaan 15 menit lagi dibulatkan 5 menit, dan sebab belum boleh", () => {
    expect(sekarangWita(SEKARANG)).toEqual({ tanggal: "2026-10-27", jam: "11:00" });
    expect(jamTulisBawaan(SEKARANG)).toBe("11:15");
    expect(jamTulisBawaan(Date.parse("2026-10-27T03:07:00Z"))).toBe("11:25");
    expect(jamTulisBawaan(Date.parse("2026-10-27T15:50:00Z"))).toBe(""); // 23.50 WITA: tidak ada jam tersisa
    expect(sebabBelumBolehJadwal("2026-10-27", "11:15", SEKARANG)).toBe("");
    expect(sebabBelumBolehJadwal("2026-10-27", "10:59", SEKARANG)).toMatch(/sudah lewat/);
    expect(sebabBelumBolehJadwal("2026-10-27", "", SEKARANG)).toMatch(/Pilih jam/);
    expect(sebabBelumBolehJadwal("2026-10-28", "11:15", SEKARANG)).toMatch(/hari sidangnya sendiri/);
    expect(sebabBelumBolehJadwal("2026-10-26", "11:15", SEKARANG)).toMatch(/sudah lewat harinya/);
  });

  it("badan POST persis kontrak: mulai di hari sidang, satu butir dengan isian form yang sama", () => {
    expect(susunBadanTundaTerjadwal(isian, "11:20")).toEqual({
      jenis: "tunda",
      mulai: "2026-10-27 11:20",
      butir: [
        {
          jadwalId: 9001,
          perkaraId: 30684,
          nomorPerkara: "684/Pdt.G/2026/PA.Dgl",
          tanggalSidang: "2026-10-27",
          alasanTunda: "Menunggu hasil mediasi",
          tanggalBerikut: "2026-11-10",
          jamBerikut: "09:00",
          agendaBerikut: "Pembuktian",
          dihadiriOleh: 2,
          ruangId: 3,
        },
      ],
    });
  });
});

describe("kartu Jadwalkan penundaan", () => {
  it("form lengkap pada hari sidang: Jadwalkan mengirim muatan kontrak lalu menampilkan butir dengan Batal", async () => {
    render(<JadwalkanTundaSidang isian={isian} lengkap sudahTertulis={false} />);
    const tombol = screen.getByRole("button", { name: /Jadwalkan/ }) as HTMLButtonElement;
    expect((screen.getByLabelText("Jam penulisan") as HTMLInputElement).value).toBe("11:15");
    expect(tombol.disabled).toBe(false);
    fireEvent.click(tombol);
    await waitFor(() => expect(screen.getByText(/Penundaan dijadwalkan pukul 11:15 WITA/)).toBeTruthy());
    const post = panggilan.find((p) => p.metode === "POST")!;
    expect(post.url).toContain("/api/aleta-ecourt/sidang-terjadwal");
    expect(post.badan).toEqual(susunBadanTundaTerjadwal(isian, "11:15"));
    // Daftar kecil butir sidang itu dibaca per jadwalId, jenis tunda.
    const get = panggilan.filter((p) => p.metode === "GET").pop()!;
    expect(get.url).toMatch(/jenis=tunda&jadwalId=9001/);
    await waitFor(() => expect(screen.getByRole("button", { name: /Batal/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Batal/ }));
    await waitFor(() => expect(screen.getByText(/Jadwal penundaan dibatalkan/)).toBeTruthy());
    expect(panggilan.find((p) => p.metode === "PATCH")!.badan).toEqual({ aksi: "batal", id: "t1" });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Batal/ })).toBeNull());
  });

  it("form belum lengkap, sudah tertulis, atau bukan hari sidang: tombol mati dengan sebab", async () => {
    const { rerender } = render(<JadwalkanTundaSidang isian={isian} lengkap={false} sudahTertulis={false} />);
    await act(async () => {});
    expect((screen.getByRole("button", { name: /Jadwalkan/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<JadwalkanTundaSidang isian={isian} lengkap sudahTertulis />);
    expect((screen.getByRole("button", { name: /Jadwalkan/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<JadwalkanTundaSidang isian={{ ...isian, tanggalSidang: "2026-10-30" }} lengkap sudahTertulis={false} />);
    await act(async () => {});
    expect((screen.getByRole("button", { name: /Jadwalkan/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/hanya dapat dijadwalkan pada hari sidangnya sendiri/)).toBeTruthy();
  });

  it("jam yang sudah lewat tidak dapat dijadwalkan", async () => {
    render(<JadwalkanTundaSidang isian={isian} lengkap sudahTertulis={false} />);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("Jam penulisan"), { target: { value: "09:00" } });
    expect((screen.getByRole("button", { name: /Jadwalkan/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Jam yang dipilih sudah lewat/)).toBeTruthy();
  });

  it("server menolak: sebab dan tolakan tampil, tidak ada butir; pelaksana mati disebut bila ada yang menunggu", async () => {
    tolak = { sebab: "Ada yang tidak sah.", tolak: [{ sebab: "Perkara sudah diputus." }] };
    render(<JadwalkanTundaSidang isian={isian} lengkap sudahTertulis={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Jadwalkan/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Ada yang tidak sah\. Perkara sudah diputus\./));
    expect(screen.queryByRole("list")).toBeNull();

    cleanup();
    butirServer = [{ id: "t9", jenis: "tunda", status: "menunggu", waktuWita: "2026-10-27 11:30", bolehBatal: true }];
    pelaksanaNyala = false;
    render(<JadwalkanTundaSidang isian={isian} lengkap sudahTertulis={false} />);
    await waitFor(() => expect(screen.getByText(/Pengerjaan terjadwal di server sedang dimatikan/)).toBeTruthy());
  });
});

describe("terpasang di layar Hasil Sidang", () => {
  it("hasil-sidang.tsx memasang kartu hanya pada jalan Ditunda, dengan isian form yang sama dan tanpa label teknis", () => {
    const sumber = readFileSync(path.resolve(process.cwd(), "src/components/portal/hasil-sidang.tsx"), "utf8");
    expect(sumber).toContain('import { JadwalkanTundaSidang } from "@/components/portal/jadwalkan-tunda-sidang"');
    expect(sumber).toMatch(/\{jalan === "tunda" \? \(\s*<JadwalkanTundaSidang/);
    const kartu = readFileSync(path.resolve(process.cwd(), "src/components/portal/jadwalkan-tunda-sidang.tsx"), "utf8");
    expect(kartu).not.toContain("bg-popover");
    const teks = [...kartu.matchAll(/>\s*([A-Za-z][^<>{}\n]{6,})\s*</g)].map((m) => m[1]);
    for (const t of teks) expect(t, t).not.toMatch(/\bAPI\b|butir_id|kering/);
  });
});
