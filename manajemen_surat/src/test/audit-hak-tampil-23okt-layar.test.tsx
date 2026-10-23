import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SelKeteranganPerkara, TombolUnduh, UnduhTertutupTautan } from "@/components/portal/aleta-ecourt-sidang";
import { BagianPutusOtomatis } from "@/components/portal/putus-otomatis-bagian";
import { TombolTundaOtomatis } from "@/components/portal/tunda-otomatis-panel";
import { bolehAksi, type PenggunaGolongan } from "@/lib/matriks-peran";

/**
 * AUDIT HAK 23 OKT 2026 - LAYAR (pasangan audit-hak-tampil-23okt.test.ts yang menguji penjaga servernya).
 *   1. Keterangan perkara di Jadwal Sidang: yang tidak memegang aksi sidang.keterangan tetap MEMBACA keterangan
 *      yang ada, tetapi tanpa kotak tulis dan tanpa tombol kosong; per peran dari matriks.
 *   2. Tautan rahasia Jadwal Sidang: tombol unduh berkas (BAS, relaas, putusan) tidak digambar - rutenya tidak
 *      ada di daftar izin tautan; di Jadwal Sidang biasa tetap ada.
 *   3. Tunda/putus otomatis: "Jangan tunda/putus otomatis" dan "Ikutkan lagi" hanya bila bolehBatal.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const akun = (roleId: string, positionId = "", additionalRoleIds: string[] = []): PenggunaGolongan => ({ id: roleId, roleId, positionId, additionalRoleIds });
const PERAN: Record<string, PenggunaGolongan> = {
  hakim: akun("hakim", "pos-hakim"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  js: akun("jurusita", "pos-jurusita"),
  penjaga: akun("pelaksana", "pos-staf-umum", ["penjaga_sidang"]),
  admin: akun("admin"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
};

const baris = { perkaraId: "77", nomorPerkara: "600/Pdt.G/2026/PA.Dgl" } as unknown as ComponentProps<typeof SelKeteranganPerkara>["baris"];
const adaIsi = { perkaraId: "77", terkini: { id: "k1", perkaraId: "77", urutan: 1, isi: "Pihak minta ditunda", namaPenulis: "PP", jabatan: "", ditulisAt: "2026-10-23T01:00:00Z" }, jumlahRevisi: 1 };

function stubRiwayat() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { riwayat: [adaIsi.terkini] } }), { status: 200 }))
  );
}

describe("1. keterangan perkara per peran", () => {
  it("matriks: majelis, PP, juru sita, petugas sidang, admin menulis; kasir, PTSP, kesekretariatan tidak", () => {
    for (const n of ["hakim", "pp", "js", "penjaga", "admin"]) expect(bolehAksi(PERAN[n], "sidang.keterangan"), n).toBe(true);
    for (const n of ["kasir", "ptsp", "sekretaris"]) expect(bolehAksi(PERAN[n], "sidang.keterangan"), n).toBe(false);
  });

  for (const [n, boleh] of Object.entries(PERAN).map(([n, p]) => [n, bolehAksi(p, "sidang.keterangan")] as const)) {
    it(`${n}: borang terbuka ${boleh ? "memuat kotak tulis" : "hanya dibaca"}`, async () => {
      stubRiwayat();
      render(createElement(SelKeteranganPerkara, { baris, keadaan: adaIsi, terbuka: true, onBuka: () => undefined, onSimpan: () => undefined, bolehTulis: boleh }));
      await screen.findByText("Pihak minta ditunda");
      expect(Boolean(document.querySelector("textarea")), n).toBe(boleh);
      expect(Boolean(screen.queryByText(/Hanya dibaca/)), n).toBe(!boleh);
    });
  }

  it("tanpa hak: keterangan berisi tetap dapat dibuka; tombol kosong tidak ditawarkan", () => {
    const { container, rerender } = render(
      createElement(SelKeteranganPerkara, { baris, keadaan: adaIsi, terbuka: false, onBuka: () => undefined, onSimpan: () => undefined, bolehTulis: false })
    );
    expect(screen.getByRole("button", { name: /Keterangan/ })).toBeTruthy();
    rerender(createElement(SelKeteranganPerkara, { baris, keadaan: undefined, terbuka: false, onBuka: () => undefined, onSimpan: () => undefined, bolehTulis: false }));
    expect(container.textContent).toBe("");
    rerender(createElement(SelKeteranganPerkara, { baris, keadaan: undefined, terbuka: false, onBuka: () => undefined, onSimpan: () => undefined, bolehTulis: true }));
    expect(screen.getByRole("button", { name: "Keterangan" })).toBeTruthy();
  });
});

describe("2. tautan rahasia Jadwal Sidang: tanpa tombol unduh berkas", () => {
  const tombol = () => createElement(TombolUnduh, { alamat: "/api/aleta-ecourt/berkas-sipp?jenis=bas&id=1", label: "BAS", namaCadangan: "bas.rtf" });
  it("mode tautan -> tidak digambar", () => {
    render(createElement(UnduhTertutupTautan.Provider, { value: true }, tombol()));
    expect(screen.queryByRole("button", { name: "BAS" })).toBeNull();
  });
  it("Jadwal Sidang biasa -> tetap ada", () => {
    render(createElement(UnduhTertutupTautan.Provider, { value: false }, tombol()));
    expect(screen.getByRole("button", { name: "BAS" })).toBeTruthy();
    cleanup();
    render(tombol());
    expect(screen.getByRole("button", { name: "BAS" })).toBeTruthy();
  });
});

const daftarTunda = (bolehBatal: boolean | undefined) => ({
  ok: true,
  data: {
    ada: true,
    tanggal: "2026-10-23",
    setelan: { nyala: true, kering: true, jam: "16:30", diubahOleh: "", diubahPada: "" },
    kalimatSetelan: "Mode kering.",
    jamPemicu: "16:30",
    kelilingAktif: false,
    tahap: "pratinjau",
    jalan: null,
    galat: "",
    hariLibur: false,
    bolehUbahSetelan: false,
    ...(bolehBatal === undefined ? {} : { bolehBatal }),
    butir: [
      {
        jadwalId: "11",
        nomorPerkara: "600/Pdt.G/2026/PA.Dgl",
        agenda: "Sidang",
        majelis: "",
        panitera: "",
        keliling: false,
        keputusan: { jenis: "tunda", aturan: "tanpa-court-calendar-14", nomorAturan: 2, tanggal: "2026-11-06", jam: "09:00", alasan: "Panggil Tergugat", agenda: "Sidang", kehadiran: 2, penjelasan: "Tunda 14 hari.", tanda: [] },
      },
      {
        jadwalId: "12",
        nomorPerkara: "601/Pdt.G/2026/PA.Dgl",
        agenda: "Sidang",
        majelis: "",
        panitera: "",
        keliling: false,
        keputusan: { jenis: "lewati", sebab: "dibatalkan-petugas", penjelasan: "Dibatalkan petugas.", tanda: [] },
      },
    ],
  },
});

const daftarPutus = (bolehBatal: boolean) => ({
  ok: true,
  data: {
    ada: true,
    tanggal: "2026-10-23",
    setelan: { nyala: true, kering: true, jam: "16:30", hasilAturan8: "tidak-dapat-diterima", unggahEdoc: false, diubahOleh: "", diubahPada: "" },
    kalimatSetelan: "Mode kering.",
    jamPemicu: "16:30",
    tahap: "pratinjau",
    galat: "",
    bolehUbahSetelan: false,
    bolehBatal,
    butir: [{ jadwalId: "21", nomorPerkara: "602/Pdt.G/2026/PA.Dgl", keputusan: { jenis: "putus", status: "gugur", penjelasan: "P tidak hadir dua kali." } }],
  },
});

describe("3. tunda & putus otomatis: tombol pengecualian mengikuti bolehBatal", () => {
  for (const bolehBatal of [true, false, undefined]) {
    it(`daftar tunda, bolehBatal=${String(bolehBatal)}`, async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) =>
          String(url).includes("putus-otomatis")
            ? new Response(JSON.stringify({ ok: true, data: { ada: false } }), { status: 200 })
            : new Response(JSON.stringify(daftarTunda(bolehBatal)), { status: 200 })
        )
      );
      render(createElement(TombolTundaOtomatis, { tanggal: "2026-10-23" }));
      fireEvent.click(screen.getByRole("button", { name: /Tunda otomatis/ }));
      await screen.findByText("600/Pdt.G/2026/PA.Dgl");
      // undefined = jawaban portal lama tanpa ruas: tetap seperti dulu (rute yang menjaga).
      const tampil = bolehBatal !== false;
      expect(screen.queryAllByRole("button", { name: "Jangan tunda otomatis" }).length).toBe(tampil ? 1 : 0);
      expect(screen.queryAllByRole("button", { name: "Ikutkan lagi" }).length).toBe(tampil ? 1 : 0);
    });
  }

  for (const bolehBatal of [true, false]) {
    it(`daftar putus, bolehBatal=${String(bolehBatal)}`, async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(daftarPutus(bolehBatal)), { status: 200 })));
      render(createElement(BagianPutusOtomatis, { tanggal: "2026-10-23" }));
      await waitFor(() => expect(screen.getByText("602/Pdt.G/2026/PA.Dgl")).toBeTruthy());
      expect(screen.queryAllByRole("button", { name: "Jangan putus otomatis" }).length).toBe(bolehBatal ? 1 : 0);
    });
  }
});
