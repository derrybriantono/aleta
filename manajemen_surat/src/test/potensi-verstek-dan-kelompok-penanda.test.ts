// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { KELOMPOK_KEADAAN, URUTAN_NADA, potensiVerstek } from "@/lib/keadaan-sidang";

/**
 * ============================================================================
 * POTENSI VERSTEK DIBACA DARI SIDANG SEBELUMNYA, DAN KOTAK YANG BERKELOMPOK
 * ============================================================================
 *
 * Dari layar Jadwal Sidang: "potensi verstek" menyala pada sidang pertama
 * yang hanya dihadiri penggugat - padahal tergugat yang tidak datang pada
 * sidang pertama baru dipanggil sekali lagi; yang berpotensi verstek sidang
 * SESUDAHNYA. Ia pun hanya tulisan kecil di dalam baris, bukan kotak
 * keadaan yang dapat menyaring. Dan lima belas kotak keadaan berjajar
 * menurut urutan penambahannya, sehingga yang berkaitan berjauhan.
 */

const komponen = () =>
  readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");

describe("potensi verstek: sidang sesudah sidang yang hanya dihadiri penggugat", () => {
  const sebelumnyaPenggugatSaja = { hadirSebelumnya: 2, tergugatPernahHadir: false };

  it("sidang pertama yang hanya dihadiri penggugat BUKAN potensi verstek", () => {
    // Inilah kekeliruan lama. Tergugat yang tidak datang pada sidang pertama
    // dipanggil sekali lagi; verstek belum terbuka.
    expect(potensiVerstek({ dihadiriOleh: 2, panggilan: { hadirSebelumnya: null } })).toBe(false);
    expect(potensiVerstek({ dihadiriOleh: 2 })).toBe(false);
    expect(potensiVerstek({ dihadiriOleh: 2, panggilan: null })).toBe(false);
  });

  it("sidang berikutnya, kehadirannya belum dicatat - potensi verstek", () => {
    expect(potensiVerstek({ dihadiriOleh: null, panggilan: sebelumnyaPenggugatSaja })).toBe(true);
  });

  it("sidang berikutnya, kembali hanya penggugat - potensi verstek", () => {
    expect(potensiVerstek({ dihadiriOleh: 2, panggilan: sebelumnyaPenggugatSaja })).toBe(true);
  });

  it("tergugat datang pada sidang ini - jalannya tertutup", () => {
    expect(potensiVerstek({ dihadiriOleh: 1, panggilan: sebelumnyaPenggugatSaja })).toBe(false);
    expect(potensiVerstek({ dihadiriOleh: 3, panggilan: sebelumnyaPenggugatSaja })).toBe(false);
  });

  it("tidak ada yang datang - bukan verstek; verstek menuntut penggugat hadir", () => {
    expect(potensiVerstek({ dihadiriOleh: 4, panggilan: sebelumnyaPenggugatSaja })).toBe(false);
  });

  it("sidang sebelumnya dihadiri kedua pihak, tergugat saja, atau tidak ada - bukan", () => {
    expect(potensiVerstek({ dihadiriOleh: null, panggilan: { hadirSebelumnya: 1 } })).toBe(false);
    expect(potensiVerstek({ dihadiriOleh: null, panggilan: { hadirSebelumnya: 3 } })).toBe(false);
    expect(potensiVerstek({ dihadiriOleh: null, panggilan: { hadirSebelumnya: 4 } })).toBe(false);
  });

  it("tergugat yang PERNAH hadir lalu absen - contradictoir, bukan verstek", () => {
    expect(
      potensiVerstek({ dihadiriOleh: null, panggilan: { hadirSebelumnya: 2, tergugatPernahHadir: true } })
    ).toBe(false);
  });

  it("ladang tergugatPernahHadir yang belum dikirim bot lama tidak menutup jalannya", () => {
    // Bot sebelum 2.19.4 tidak mengirimnya; yang dibaca hanya sidang sebelumnya.
    expect(potensiVerstek({ dihadiriOleh: null, panggilan: { hadirSebelumnya: 2 } })).toBe(true);
  });
});

describe("potensi verstek menjadi kotak keadaan berwarna", () => {
  it("ada kotaknya, kuning, di kelompok jalannya sidang, memakai aturan yang sama", () => {
    const isi = komponen();
    const awal = isi.indexOf('kunci: "potensi-verstek"');
    expect(awal).toBeGreaterThan(-1);
    const potong = isi.slice(awal, awal + 700);
    expect(potong).toContain('label: "Potensi verstek"');
    expect(potong).toContain('nada: "awas"');
    expect(potong).toContain('kelompok: "sidang"');
    expect(potong).toContain("cocok: (x) => potensiVerstek(x)");
  });

  it("penanda baris memakai aturan yang sama, bukan kode kehadiran sidang ini", () => {
    const isi = komponen();
    expect(isi).toContain("{potensiVerstek(baris) ? (");
    expect(isi).not.toContain("potensiVerstek(baris.dihadiriOleh)");
  });

  it("kuning, bukan merah: ia gejala yang perlu disiapkan, bukan pekerjaan yang membatalkan sidang", () => {
    // Kalau merah, ia ikut masuk kotak gabungan "Perlu diperiksa" - dan verstek
    // bukan sesuatu yang harus diurus supaya sidangnya jadi.
    const isi = komponen();
    const awal = isi.indexOf("{potensiVerstek(baris) ? (");
    expect(isi.slice(awal, awal + 200)).toContain('variant="warning"');
  });
});

describe("kotak keadaan berkelompok menurut maksudnya", () => {
  /** (kunci, nada, kelompok) tiap kotak satuan, urut sesuai tulisannya. */
  function daftarKotak() {
    const isi = komponen();
    const awal = isi.indexOf("const KEADAAN_DASAR: KeadaanSidang[] = [");
    const akhir = isi.indexOf("const KEADAAN_MENUNTUT_TINDAKAN");
    expect(awal).toBeGreaterThan(-1);
    expect(akhir).toBeGreaterThan(awal);
    const potong = isi.slice(awal, akhir);
    const pola =
      /kunci: "([a-z-]+)",\s*label: "[^"]+",\s*nada: "([a-z]+)"(?: as const)?,\s*kelompok: "([a-z]+)"/g;
    const hasil: Array<{ kunci: string; nada: string; kelompok: string }> = [];
    for (const m of potong.matchAll(pola)) hasil.push({ kunci: m[1], nada: m[2], kelompok: m[3] });
    return hasil;
  }

  it("tiap kotak punya kelompok, dan kelompoknya dikenal", () => {
    const kotak = daftarKotak();
    // Lima belas kotak lama + Potensi verstek. Putusan e-Court tetap dimatikan
    // tetapi tetap tertulis, dan ikut terhitung.
    expect(kotak.length).toBe(16);
    const dikenal: string[] = KELOMPOK_KEADAAN.map((k) => k.kunci);
    for (const k of kotak) {
      expect(dikenal, `${k.kunci} berkelompok "${k.kelompok}"`).toContain(k.kelompok);
    }
  });

  it("yang sekelompok ditulis berdampingan, urut menurut KELOMPOK_KEADAAN", () => {
    const urutan = daftarKotak().map((k) => KELOMPOK_KEADAAN.findIndex((x) => x.kunci === k.kelompok));
    for (let i = 1; i < urutan.length; i += 1) {
      expect(urutan[i], `kotak ke-${i} melompat kelompok`).toBeGreaterThanOrEqual(urutan[i - 1]);
    }
    // Keempat kelompok terisi.
    expect(new Set(urutan).size).toBe(KELOMPOK_KEADAAN.length);
  });

  it("di dalam kelompok, yang menuntut tindakan lebih dulu", () => {
    const kotak = daftarKotak();
    for (let i = 1; i < kotak.length; i += 1) {
      if (kotak[i].kelompok !== kotak[i - 1].kelompok) continue;
      expect(
        URUTAN_NADA.indexOf(kotak[i].nada),
        `${kotak[i].kunci} sesudah ${kotak[i - 1].kunci}`
      ).toBeGreaterThanOrEqual(URUTAN_NADA.indexOf(kotak[i - 1].nada));
    }
  });

  it("yang berkaitan tidak lagi berjauhan", () => {
    const kunci = daftarKotak().map((k) => k.kunci);
    // "Tidak perlu dipanggil" dulu sembilan kotak jauhnya dari "Belum dipanggil".
    expect(Math.abs(kunci.indexOf("tidak-dipanggil") - kunci.indexOf("belum-dipanggil"))).toBeLessThanOrEqual(2);
    expect(Math.abs(kunci.indexOf("sudah-putus") - kunci.indexOf("belum-putus"))).toBe(1);
    expect(Math.abs(kunci.indexOf("sidang-pertama") - kunci.indexOf("potensi-verstek"))).toBeLessThanOrEqual(4);
  });

  it("deretannya digambar per kelompok berjudul, dan kelompok kosong tidak digambar", () => {
    const isi = komponen();
    expect(isi).toContain("function kelompokKeadaanTampak(");
    expect(isi).toContain(".filter((kelompok) => kelompok.anggota.length > 0)");
    expect(isi).toContain("{kelompokKeadaanTampak(jumlahKeadaan, keadaanTerpilih).map((kelompok, urutan) => (");
    expect(isi).toContain("{kelompok.label}");
    // Kotak gabungan tetap paling depan, di luar kelompok mana pun.
    expect(isi.indexOf("keadaan.kunci === KUNCI_PERLU_DIPERIKSA ? (")).toBeLessThan(
      isi.indexOf("{kelompokKeadaanTampak(")
    );
  });
});
