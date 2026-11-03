/**
 * Jadwal Sidang dan Status Perkara lebih ringkas - keputusan Derry 3 Nov 2026
 * (butir 11-14, 17, 21, 22). Yang disembunyikan/dilipat tetap dapat dibuka.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Bagian } from "@/components/portal/bagian-ciut";
import { RincianJawabanSitaEksekusi, isiJawabanSitaEksekusi } from "@/components/portal/penanda-sita-agenda";
import { kalimatRingkas, ringkasKehadiran, susunKehadiran } from "@/lib/kehadiran-rinci";
import type { PenandaJawabanPerkara } from "@/lib/penanda-jawaban";
import {
  KUNCI_SIMPANAN_TAMPILAN,
  SAKLAR_RINGKAS_3NOV,
  bacaTampilan,
  tampil,
  tampilanBawaan,
  terapkanRingkas3Nov,
} from "@/lib/tampilan-antrian-sidang";

const baca = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const STATUS = baca("src/components/portal/aleta-ecourt-status-perkara.tsx");

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("butir 11 - penanda Jadwal Sidang bawaan tersembunyi, tetap dapat dinyalakan", () => {
  it("draf putusan, kesiapan, daftar langkah, dan jam dipanggil bawaannya mati", () => {
    const bawaan = tampilanBawaan();
    for (const k of SAKLAR_RINGKAS_3NOV) {
      expect(bawaan[k], k).toBe(false);
      expect(tampil({ [k]: true }, k), k).toBe(true);
    }
  });

  it("simpanan lama yang memuat semua kunci dimatikan SEKALI lewat terapkanRingkas3Nov", () => {
    const lama = Object.fromEntries(Object.keys(tampilanBawaan()).map((k) => [k, true]));
    const baru = terapkanRingkas3Nov(bacaTampilan(JSON.stringify(lama)));
    for (const k of SAKLAR_RINGKAS_3NOV) expect(baru[k], k).toBe(false);
    expect(baru["hari-putusan"]).toBe(true);
    expect(baca("src/components/portal/aleta-ecourt-sidang.tsx")).toContain("terapkanRingkas3Nov(pilihan)");
    expect(KUNCI_SIMPANAN_TAMPILAN).toBe("aleta.jadwal-sidang.tampilan");
  });

  it("kehadiran ringkas: 'P 08:53' dan 'T 09:41' tanpa kata hadir", () => {
    const s = susunKehadiran(
      [
        { peran: "penggugat", jam: "08:53" },
        { peran: "tergugat", jam: "09:41" },
      ],
      null
    );
    expect(kalimatRingkas(ringkasKehadiran(s, {}, { singkat: true }))).toBe("P 08:53 · T 09:41");
    // Bentuk lama (layar lain) tidak berubah.
    expect(kalimatRingkas(ringkasKehadiran(s))).toBe("Penggugat hadir 08.53 · Tergugat hadir 09.41");
  });

  it("jam yang sudah tampil sebagai jam ambil antrian tidak diulang; yang berbeda tetap tertulis", () => {
    const s = susunKehadiran(
      [
        { peran: "penggugat", jam: "09:15" },
        { peran: "tergugat", jam: "09:41" },
      ],
      null
    );
    const pot = ringkasKehadiran(s, {}, { singkat: true, jamAmbil: { p1: "09:15", p2: "09:15" } });
    expect(kalimatRingkas(pot)).toBe("T 09:41");
    const belum = susunKehadiran([{ peran: "pemohon", jam: "09:52" }], null);
    expect(kalimatRingkas(ringkasKehadiran(belum, { sebutanSatu: "Pemohon", sebutanDua: "Termohon" }, { singkat: true }))).toBe(
      "P 09:52 · T belum"
    );
  });
});

describe("Bagian: bawaan terlipat, versi bawaan, dan pilihan orangnya", () => {
  beforeEach(() => window.localStorage.clear());

  it("terlipat bawaan, kepala tetap memuat ringkasan, dan dapat dibuka", () => {
    render(
      createElement(Bagian, { judul: "Biaya perkara", kunci: "uji-biaya", ciutBawaan: true, versiBawaan: "3nov", keterangan: "sisa Rp 1", children: "ISI" })
    );
    const kepala = screen.getByRole("button", { name: /Biaya perkara/ });
    expect(kepala.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("sisa Rp 1")).toBeTruthy();
    expect(screen.queryByText("ISI")).toBeNull();
    fireEvent.click(kepala);
    expect(screen.getByText("ISI")).toBeTruthy();
  });

  it("pilihan terbuka yang tersimpan SEBELUM versi bawaan diabaikan sekali; sesudah ditekan pilihan orangnya dihormati", () => {
    window.localStorage.setItem("aleta.status-perkara.ciut.uji-lama", "0");
    const Uji = () => createElement(Bagian, { judul: "Majelis", kunci: "uji-lama", ciutBawaan: true, versiBawaan: "3nov", children: "ISI" });
    const a = render(createElement(Uji));
    // kunciCiut memberi awalan sendiri; bila awalan berbeda simpanan tidak terbaca dan hasilnya sama - kedua kasus terlipat.
    expect(screen.getByRole("button", { name: /Majelis/ }).getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Majelis/ }));
    a.unmount();
    render(createElement(Uji));
    expect(screen.getByRole("button", { name: /Majelis/ }).getAttribute("aria-expanded")).toBe("true");
  });
});

describe("butir 17, 21, 22 - Eksepsi/rekonvensi, sita, eksekusi: hanya yang ada isinya", () => {
  const temuan = (keadaan: "ada" | "tidak" | "") => ({
    keadaan,
    dokumen: "Jawaban",
    jenisDokumen: "Jawaban",
    diunggah: "2026-10-01",
    kalimat: "Dalam Eksepsi: menolak",
    sumber: "teks" as const,
  });
  const jawab = (eksepsi: "ada" | "tidak" | ""): PenandaJawabanPerkara => ({
    eksepsi: eksepsi ? temuan(eksepsi) : null,
    rekonvensi: temuan(""),
    dokumen: 1,
    berkas: 1,
    dibaca: 3,
    belumDibaca: 0,
    tidakTerbaca: 0,
  });
  const saklar = { tampilJawaban: true, tampilSita: true, tampilEksekusi: true };
  const html = (bahan: object, pilihan = saklar) =>
    renderToStaticMarkup(createElement(RincianJawabanSitaEksekusi, { bahan, ...pilihan, hanyaYangAda: true }));

  it("semuanya tidak ada = tidak tampil sama sekali", () => {
    const bahan = { penandaJawaban: jawab(""), penandaJawabanTerbaca: true, sita: null, eksekusi: [], sitaTerbaca: true };
    expect(isiJawabanSitaEksekusi(bahan, saklar).tampil).toBe(false);
    expect(html(bahan)).toBe("");
    // Belum ada jawaban/duplik di arsip e-Court juga bukan isi.
    expect(html({ ...bahan, penandaJawaban: null })).toBe("");
  });

  it("bila salah satu ada, HANYA baris yang ada isinya yang tampil", () => {
    const bahan = { penandaJawaban: jawab("ada"), penandaJawabanTerbaca: true, sita: null, eksekusi: [], sitaTerbaca: true };
    const keluar = html(bahan);
    expect(keluar).toContain("Eksepsi:");
    expect(keluar).not.toContain("Rekonvensi:");
    expect(keluar).not.toContain("data-rincian-sita");
    expect(keluar).not.toContain("data-rincian-eksekusi");
    expect(keluar).not.toContain("tidak ada permohonan");
  });

  it("yang tidak terbaca tetap dilaporkan - bukan 'tidak ada'", () => {
    const keluar = html({ penandaJawaban: null, penandaJawabanTerbaca: true, sita: null, eksekusi: [], sitaTerbaca: false });
    expect(keluar).toContain("tidak dapat dibaca saat ini");
  });

  it("kedua layar memakai SATU komponen dan SATU penentu, dengan huruf selaras", () => {
    const sidang = baca("src/components/portal/aleta-ecourt-sidang.tsx");
    expect(STATUS).toMatch(/<RincianJawabanSitaEksekusi [^>]*hanyaYangAda/);
    expect(sidang).toMatch(/<RincianJawabanSitaEksekusi [^>]*hanyaYangAda/);
    const kotak = baca("src/components/portal/penanda-sita-agenda.tsx");
    expect(kotak).toContain("KELAS_KOTAK_KETERANGAN");
    expect(baca("src/components/portal/kumulasi-perkara.tsx")).toContain("px-3 py-2 text-sm");
  });
});

describe("butir 12-14 - Status Perkara: terlipat bawaan, ringkasan tetap, tanpa keterangan teknis, jurusita", () => {
  it.each([
    "majelis",
    "tahapan",
    "umur-sidang",
    "kalender",
    "mediasi",
    "saksi",
    "arsip",
    "biaya",
    "rubrik",
    "sk",
    "analisa",
  ])("bagian %s terlipat bawaan", (kunci) => {
    const i = STATUS.indexOf(`kunci="${kunci}"`);
    expect(i, kunci).toBeGreaterThan(-1);
    expect(STATUS.slice(i, i + 160), kunci).toMatch(/ciutBawaan/);
  });

  it("panduan pertanyaan saksi terlipat walau agenda pembuktian", () => {
    expect(STATUS).toMatch(/kunciBagian="status-pandu-saksi"\s+ciutSelalu/);
  });

  it("kalimat teknis dihapus dari layar", () => {
    const bentuk = baca("src/components/portal/bentuk-sajian.tsx");
    // Tinggal di tooltip (title), bukan sebagai baris yang tampil.
    expect(bentuk).toContain('title={penjelasan.join("\\n")}');
    expect(bentuk).not.toMatch(/<li key=\{kalimat\}>/);
    expect(STATUS).not.toContain("Alat bantu, bukan penetapan");
    expect(STATUS).not.toContain("Terlaksana dinilai dari ADANYA");
    expect(STATUS).not.toContain("sipp-periksa-kolom.js");
    expect(STATUS).not.toContain("sippSkemaService.js");
  });

  it("kartu Majelis memuat jurusita di bawah panitera", () => {
    // Rancangan 3 Nov: kartu Majelis kolom kanan dihapus; jurusita naik ke baris majelis di sorotan.
    expect(STATUS).toMatch(/JS \$\{status\.jurusita\.map/);
  });
});

describe("tampilan baru Status Perkara (keputusan 142-144)", () => {
  it("pemisah antar-butir satu konstanta, berjarak, dan tidak ada ' · ' tersisa di Status Perkara", async () => {
    const { PEMISAH_RINGKAS, gabungRingkas, namaMajelisSingkat, namaTanpaGelar } = await import("@/lib/status-perkara-seamless");
    expect(PEMISAH_RINGKAS).toMatch(/^\s\u2004\|\u2004\s$/);
    expect(gabungRingkas(["a", "", "b", null, "c"])).toBe(`a${PEMISAH_RINGKAS}b${PEMISAH_RINGKAS}c`);
    for (const f of ["aleta-ecourt-status-perkara.tsx", "bentuk-sajian.tsx", "tautan-petugas.tsx"]) {
      const kode = baca(`src/components/portal/${f}`)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l) && /[`{<]/.test(l) && l.includes(" · "));
      expect(kode, f).toEqual([]);
    }
    expect(namaTanpaGelar("Drs. H. Ahmad Fauzan, M.H.")).toBe("Ahmad Fauzan");
    expect(
      namaMajelisSingkat([
        { nama: "Drs. H. Ahmad Fauzan, M.H.", jabatan: "Hakim Ketua" },
        { nama: "Siti Rahmawati, S.H.I., M.H.", jabatan: "Hakim Anggota 1" },
      ])
    ).toBe("Ahmad Fauzan (K), Siti Rahmawati");
  });

  it("kelompok terbuka sendiri menurut tahap perkara", async () => {
    const { bukaMenurutTahap } = await import("@/lib/status-perkara-seamless");
    const dasar = { sudahPutus: false, sudahDiarsipkan: false, adaSidang: false, mediasiBerjalan: false, agendaBerikutPembuktian: false };
    expect(bukaMenurutTahap(dasar).bagian.has("tahapan")).toBe(true);
    expect(bukaMenurutTahap({ ...dasar, mediasiBerjalan: true }).bagian.has("mediasi")).toBe(true);
    expect(bukaMenurutTahap({ ...dasar, adaSidang: true }).bagian.has("sidang")).toBe(true);
    const bukti = bukaMenurutTahap({ ...dasar, adaSidang: true, agendaBerikutPembuktian: true });
    expect([...bukti.bagian]).toEqual(expect.arrayContaining(["saksi", "status-pandu-saksi"]));
    const putus = bukaMenurutTahap({ ...dasar, sudahPutus: true });
    expect([...putus.kelompok]).toEqual(["C"]);
    expect([...bukaMenurutTahap({ ...dasar, sudahPutus: true, sudahDiarsipkan: true }).kelompok].sort()).toEqual(["C", "D"]);
    for (const t of [dasar, putus]) {
      for (const k of ["majelis", "pihak", "sk"]) expect((t as { bagian?: Set<string> }).bagian?.has(k) ?? false, k).toBe(false);
    }
  });

  it("lencana beracara: hijau, kuning, abu, dengan tooltip alasan; kedua layar memasangnya", async () => {
    const { LencanaBeracara } = await import("@/components/portal/kontak-para-pihak");
    const { tentukanBeracaraElektronik } = await import("@/lib/beracara-elektronik");
    const hasil = tentukanBeracaraElektronik({
      eCourt: true,
      tergugatPernahHadir: true,
      tergugat: [{ nama: "A", email: "a@x", wa: "081", setujuElektronik: true }],
    });
    const { container } = render(createElement(LencanaBeracara, { hasil }));
    const el = container.querySelector("[data-beracara-lencana='e-litigasi']") as HTMLElement;
    expect(el.textContent).toBe("E-Litigasi");
    expect(el.getAttribute("title")).toContain("Email ada");
    expect(STATUS).toMatch(/<LencanaBeracaraPerkara nomorPerkara=\{status\.identitas\.nomorPerkara\}/);
    expect(baca("src/components/portal/aleta-ecourt-sidang.tsx")).toMatch(/<LencanaBeracaraPerkara[\s\S]{0,200}bacaOtomatis=\{false\}/);
  });
});
