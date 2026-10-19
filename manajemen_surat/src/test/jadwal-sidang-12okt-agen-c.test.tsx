/**
 * Jadwal Sidang, 12 Okt 2026 - agen C:
 *   butir 3  kartu ruang sidang berwarna di bawah deretan alat (saklar kartu-ruang)
 *   butir 6  nama mediator di Majelis & Petugas dan rincian (saklar mediator-majelis)
 *   butir 7  audit fitur yang belum punya saklar di panel Tampilan
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KartuRuangSidang } from "@/components/portal/kartu-ruang-sidang";
import { CONTOH_TAMPILAN } from "@/components/portal/contoh-tampilan";
import {
  bacaKartuRuangTerbuka,
  indeksWarnaPilihan,
  keteranganPerluDiperiksa,
  KUNCI_SIMPANAN_KARTU_RUANG,
  PALET_KARTU_RUANG,
  ringkasKartuRuang,
  susunKartuRuang,
  tetapkanWarnaRuang,
} from "@/lib/kartu-ruang-sidang";
import { mediatorBaris } from "@/lib/mediator-jadwal";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";

const layar = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* tidak ada simpanan */
  }
});

// ---------------------------------------------------------------------------
// Butir 3
// ---------------------------------------------------------------------------
describe("butir 3: warna dan kartu ruang", () => {
  const ruang = ["Ruang Sidang 1", "Ruang Sidang 2", "Ruang Sidang 3", "Terpadu Sindue", "Sidang Keliling Sigi"];

  it("warna pilihan pertama mengikuti nomor ruang dan stabil", () => {
    expect(indeksWarnaPilihan("Ruang Sidang 1")).toBe(0);
    expect(indeksWarnaPilihan("Ruang Sidang 2")).toBe(1);
    expect(indeksWarnaPilihan("  ruang   sidang 2 ")).toBe(1);
    // Tanpa angka: sidik jari nama, selalu sama.
    expect(indeksWarnaPilihan("Terpadu Sindue")).toBe(indeksWarnaPilihan("terpadu  sindue"));
    // Nomor melewati ukuran palet melingkar, tidak keluar batas.
    expect(indeksWarnaPilihan("Ruang 11")).toBe(0);
    expect(indeksWarnaPilihan("Ruang 0")).toBe(0);
  });

  it("tidak ada dua ruang sewarna pada satu jadwal selama paletnya cukup", () => {
    // Dua ruang bernomor sama ("Ruang Sidang 1" dan "... Dalam Gedung") sengaja menabrak.
    const nama = ["Ruang Sidang 1", "Ruang Sidang 1 Dalam Gedung", "Ruang Sidang Dalam Gedung 1", ...ruang.slice(1)];
    const peta = tetapkanWarnaRuang(nama);
    const dipakai = Object.values(peta);
    expect(new Set(dipakai).size).toBe(nama.length);
    for (const i of dipakai) expect(i).toBeGreaterThanOrEqual(0);
    // Deterministik: urutan sama, hasil sama.
    expect(tetapkanWarnaRuang(nama)).toEqual(peta);
  });

  it("lebih banyak ruang daripada palet tetap menghasilkan warna sah", () => {
    const banyak = Array.from({ length: PALET_KARTU_RUANG.length + 3 }, (_, i) => `Ruang ${i + 1}`);
    const peta = tetapkanWarnaRuang(banyak);
    for (const nama of banyak) {
      expect(peta[nama]).toBeGreaterThanOrEqual(0);
      expect(peta[nama]).toBeLessThan(PALET_KARTU_RUANG.length);
    }
  });

  it("setiap warna punya padanan gelap dan tidak ada yang merah (milik 'perlu diperiksa')", () => {
    for (const w of PALET_KARTU_RUANG) {
      expect(w.kartu, w.kunci).toContain("dark:");
      expect(w.cincin, w.kunci).toContain("dark:");
      expect(w.titik, w.kunci).toContain("dark:");
      expect(w.lencana, w.kunci).toContain("dark:");
      expect(w.kartu, w.kunci).not.toMatch(/\b(red|rose)-/);
    }
    expect(new Set(PALET_KARTU_RUANG.map((w) => w.kunci)).size).toBe(PALET_KARTU_RUANG.length);
  });

  it("susunKartuRuang: jumlah dari seluruh sidang, perlu dari predikat layar, urut nama alami", () => {
    const sidang = [
      { ruangan: "Ruang Sidang 10", mendesak: false },
      { ruangan: "Ruang Sidang 2", mendesak: true },
      { ruangan: " Ruang  Sidang 2 ", mendesak: false },
      { ruangan: "Ruang Sidang 2", mendesak: true },
      { ruangan: "", mendesak: true },
      { ruangan: null, mendesak: true },
    ];
    const kartu = susunKartuRuang(sidang, (b) => b.mendesak);
    expect(kartu.map((k) => k.nama)).toEqual(["Ruang Sidang 2", "Ruang Sidang 10"]);
    expect(kartu[0]).toMatchObject({ jumlah: 3, perlu: 2 });
    expect(kartu[1]).toMatchObject({ jumlah: 1, perlu: 0 });
    expect(kartu[0].warna).not.toBe(kartu[1].warna);
    // Ruang tak terbaca tidak punya kartu dan tidak ikut dihitung.
    expect(ringkasKartuRuang(kartu)).toEqual({ ruang: 2, perkara: 4, perlu: 2 });
    expect(susunKartuRuang([], () => true)).toEqual([]);
  });

  it("bawaannya diciutkan: hanya '1' yang berarti terbuka", () => {
    expect(bacaKartuRuangTerbuka(null)).toBe(false);
    expect(bacaKartuRuangTerbuka(undefined)).toBe(false);
    expect(bacaKartuRuangTerbuka("")).toBe(false);
    expect(bacaKartuRuangTerbuka("0")).toBe(false);
    expect(bacaKartuRuangTerbuka("true")).toBe(false);
    expect(bacaKartuRuangTerbuka("1")).toBe(true);
  });

  it("keterangan perlu diperiksa menyebut penanda merah dan jam batas yang dikirim layar", () => {
    const k = keteranganPerluDiperiksa(["Retur", "Belum dipanggil"], "15:00");
    expect(k).toContain("Retur, Belum dipanggil");
    expect(k).toContain("15:00");
    expect(k).toContain("Perlu diperiksa");
  });

  describe("komponen", () => {
    const kartu = susunKartuRuang(
      [
        { ruangan: "Ruang Sidang 1", m: true },
        { ruangan: "Ruang Sidang 1", m: false },
        { ruangan: "Ruang Sidang 2", m: false },
      ],
      (b) => b.m
    );

    beforeEach(() => {
      try {
        window.localStorage.clear();
      } catch {
        /* tidak ada simpanan */
      }
    });

    it("diciutkan secara bawaan: hanya ringkasan, tanpa kartu", () => {
      const { container } = render(
        <KartuRuangSidang kartu={kartu} ruangPilihan={null} onPilih={() => {}} keteranganPerlu="ket" />
      );
      const panel = container.querySelector("[data-kartu-ruang-sidang]");
      expect(panel?.getAttribute("data-terbuka")).toBe("tidak");
      expect(container.querySelectorAll("[data-kartu-ruang]").length).toBe(0);
      expect(screen.getByText(/2 ruang · 3 perkara/)).toBeTruthy();
      expect(screen.getByText("1 perlu diperiksa")).toBeTruthy();
    });

    it("dibentangkan: satu kartu per ruang, berwarna, dengan nama, jumlah, dan perlu diperiksa", () => {
      const { container } = render(
        <KartuRuangSidang kartu={kartu} ruangPilihan={null} onPilih={() => {}} keteranganPerlu="ket" />
      );
      fireEvent.click(screen.getByRole("button", { name: /Ruang sidang yang digunakan/ }));
      const semua = [...container.querySelectorAll("[data-kartu-ruang]")];
      expect(semua.map((e) => e.getAttribute("data-kartu-ruang"))).toEqual(["Ruang Sidang 1", "Ruang Sidang 2"]);
      expect(new Set(semua.map((e) => e.getAttribute("data-warna"))).size).toBe(2);
      expect(semua[0].className).toContain("rounded-3xl");
      expect(semua[0].textContent).toContain("2 perkara");
      expect(semua[0].textContent).toContain("1 perlu diperiksa");
      expect(semua[1].textContent).toContain("0 perlu diperiksa");
      // Pilihan diingat peramban ini.
      expect(window.localStorage.getItem(KUNCI_SIMPANAN_KARTU_RUANG)).toBe("1");
    });

    it("mengingat pilihan terbuka pada pemuatan berikutnya", () => {
      window.localStorage.setItem(KUNCI_SIMPANAN_KARTU_RUANG, "1");
      const { container } = render(
        <KartuRuangSidang kartu={kartu} ruangPilihan={null} onPilih={() => {}} keteranganPerlu="ket" />
      );
      expect(container.querySelectorAll("[data-kartu-ruang]").length).toBe(2);
    });

    it("menekan kartu menyaring ruang; menekan kartu yang sedang dipilih melepasnya", () => {
      window.localStorage.setItem(KUNCI_SIMPANAN_KARTU_RUANG, "1");
      const dipilih: Array<string | null> = [];
      const { container, rerender } = render(
        <KartuRuangSidang kartu={kartu} ruangPilihan={null} onPilih={(n) => dipilih.push(n)} keteranganPerlu="ket" />
      );
      fireEvent.click(container.querySelector('[data-kartu-ruang="Ruang Sidang 2"]')!);
      expect(dipilih).toEqual(["Ruang Sidang 2"]);
      rerender(
        <KartuRuangSidang kartu={kartu} ruangPilihan="Ruang Sidang 2" onPilih={(n) => dipilih.push(n)} keteranganPerlu="ket" />
      );
      const aktif = container.querySelector('[data-kartu-ruang="Ruang Sidang 2"]')!;
      expect(aktif.getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(aktif);
      expect(dipilih).toEqual(["Ruang Sidang 2", null]);
    });

    it("tanpa ruang tidak menggambar apa pun", () => {
      const { container } = render(
        <KartuRuangSidang kartu={[]} ruangPilihan={null} onPilih={() => {}} keteranganPerlu="ket" />
      );
      expect(container.innerHTML).toBe("");
    });
  });

  it("layar memakai predikat kotak 'Perlu diperiksa' yang sudah ada, bukan aturan kedua", () => {
    expect(layar).toContain("KEADAAN_PERLU_DIPERIKSA.some((keadaan) => keadaan.cocok(baris, antrian.peta, saat))");
    expect(layar).toContain('tampil(tampilan, "kartu-ruang")');
    // Menyaring ruang tidak mati bersama tombol ruang: kartu memakai saringan yang sama.
    expect(layar).toContain('tampil(tampilan, "saring-ruang") || tampil(tampilan, "kartu-ruang")');
    expect(layar).toContain('tampil(tampilan, "saring-ruang") && ruangAktif.length > 0');
    // Tombol ruang yang lama tidak dihapus dan kartu berdiri di luar baris alat yang bisa terciut.
    // 19 Okt 2026 (JADWAL-3 butir 3): kartu ruang menyatu dalam pita di atas tabel.
    expect(layar.indexOf("<PitaRuangSidang")).toBeGreaterThan(layar.indexOf('data-saring-ruang=""'));
  });

  it("saklar kartu-ruang menyala bawaan", () => {
    expect(tampil(tampilanBawaan(), "kartu-ruang")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Butir 6
// ---------------------------------------------------------------------------
describe("butir 6: mediator di Majelis & Petugas", () => {
  const sidang = "2026-10-12";
  const m = (ekstra: Record<string, unknown> = {}) => ({
    ditunjuk: "2026-09-01",
    dimulai: "2026-09-02",
    mediator: "Massadi, S.Ag., M.H.",
    ...ekstra,
  });

  it("menyebut nama apa adanya (koma gelar bukan pemisah) bila sudah ditunjuk", () => {
    expect(mediatorBaris({ tanggalSidang: sidang, mediasi: m() })).toBe("Massadi, S.Ag., M.H.");
    expect(mediatorBaris({ tanggalSidang: `${sidang}T00:00:00`, mediasi: m({ mediator: "  Jafar M.  Naser, SHI " }) })).toBe(
      "Jafar M. Naser, SHI"
    );
  });

  it("diam bila belum ditunjuk pada hari sidang itu (sidang pertama tidak menuduh majelis)", () => {
    expect(mediatorBaris({ tanggalSidang: "2026-08-20", mediasi: m() })).toBe("");
    // Yang lebih awal dari dua tanggal yang menentukan.
    expect(mediatorBaris({ tanggalSidang: "2026-09-01", mediasi: m({ ditunjuk: "", dimulai: "2026-09-01" }) })).toBe(
      "Massadi, S.Ag., M.H."
    );
    expect(mediatorBaris({ tanggalSidang: "2026-08-31", mediasi: m({ ditunjuk: "", dimulai: "2026-09-01" }) })).toBe("");
  });

  it("tanggal penunjukan kosong tidak menyembunyikan nama yang terbaca", () => {
    expect(mediatorBaris({ tanggalSidang: sidang, mediasi: m({ ditunjuk: "", dimulai: null }) })).toBe(
      "Massadi, S.Ag., M.H."
    );
  });

  it("diam tanpa mediasi, tanpa nama, atau bila kuerinya gagal", () => {
    expect(mediatorBaris({ tanggalSidang: sidang })).toBe("");
    expect(mediatorBaris({ tanggalSidang: sidang, mediasi: null })).toBe("");
    expect(mediatorBaris({ tanggalSidang: sidang, mediasi: m({ mediator: "   " }) })).toBe("");
    expect(mediatorBaris({ tanggalSidang: sidang, mediasi: m({ mediator: null }) })).toBe("");
    expect(mediatorBaris({ tanggalSidang: sidang, mediasi: m(), mediasiTerbaca: false })).toBe("");
  });

  it("layar: di bawah JS dan di atas ruang pada mode Ringkas, Lengkap, dan rincian; mengikuti saklarnya", () => {
    expect(layar).toContain('tampil(tampilan, "mediator-majelis") ? mediatorBaris(baris) : ""');
    // Mode Ringkas: JS lalu Mediator lalu Ruang.
    const iJsRingkas = layar.indexOf('<span className="font-medium text-foreground/70">JS</span>');
    const iMedRingkas = layar.indexOf('<span className="font-medium text-foreground/70">Mediator</span>');
    const iRuangRingkas = layar.indexOf('<span className="font-medium text-foreground/70">Ruang</span>');
    expect(iJsRingkas).toBeGreaterThan(0);
    expect(iMedRingkas).toBeGreaterThan(iJsRingkas);
    expect(iRuangRingkas).toBeGreaterThan(iMedRingkas);
    // Mode Lengkap: blok mediator berdiri antara baris PP/JS dan baris ruang.
    const iJsLengkap = layar.indexOf('<span className="text-muted-foreground"> · JS </span>');
    const iMedLengkap = layar.indexOf('<span className="text-muted-foreground">Mediator </span>');
    expect(iMedLengkap).toBeGreaterThan(iJsLengkap);
    expect(layar.indexOf("{baris.ruangan ? (", iMedLengkap)).toBeGreaterThan(iMedLengkap);
    // Rincian menerima nama yang sama (satu sumber) dan menggambarnya di bawah jurusita.
    expect(layar).toContain("mediator={mediatorIni}");
    expect(layar.indexOf('data-rincian-mediator=""')).toBeGreaterThan(layar.indexOf("Jurusita: "));
  });
});

// ---------------------------------------------------------------------------
// Butir 7
// ---------------------------------------------------------------------------
describe("butir 7: saklar hasil audit", () => {
  const BARU = [
    ["penanda-verzet", "penanda"],
    ["lencana-putusan-ecourt", "penanda"],
    ["pihak-turut-intervensi", "keterangan"],
    ["tombol-status-perkara", "alat"],
    ["tombol-ruang-sidang", "alat"],
    ["tombol-selesai-sidang", "alat"],
    ["tombol-cetak-relaas", "atas"],
  ] as const;

  it("tiap saklar baru: terdaftar di kelompoknya, menyala bawaan, bukan wajib, ada contoh, dan dipakai menggambar", () => {
    for (const [kunci, kelompok] of BARU) {
      const s = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci);
      expect(s, kunci).toBeTruthy();
      expect(s?.kelompok, kunci).toBe(kelompok);
      expect(s?.wajib ?? false, kunci).toBe(false);
      expect(s?.bawaanMati ?? false, kunci).toBe(false);
      expect(s!.keterangan.length, kunci).toBeGreaterThan(30);
      expect(tampil(tampilanBawaan(), kunci), kunci).toBe(true);
      expect(CONTOH_TAMPILAN[kunci], kunci).toBeTruthy();
      expect(layar, kunci).toContain(`tampil(tampilan, "${kunci}")`);
    }
  });

  it("saklar kartu-ruang dan mediator-majelis punya contoh", () => {
    expect(CONTOH_TAMPILAN["kartu-ruang"]).toBeTruthy();
    expect(CONTOH_TAMPILAN["mediator-majelis"]).toBeTruthy();
  });

  it("mematikan saklar tombol tidak menghilangkan hak peran: gerbang peran tetap di depan saklar", () => {
    expect(layar).toContain('bolehJalannya && tampil(tampilan, "tombol-ruang-sidang")');
    expect(layar).toContain('bolehJalannya && tampil(tampilan, "tombol-selesai-sidang")');
    expect(layar).toContain('bolehCetakRelaas && tampil(tampilan, "tombol-cetak-relaas")');
  });
});
