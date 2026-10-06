/**
 * Jadwal Sidang, perbaikan 6 Okt 2026:
 *   butir 2  kolom Majelis & Petugas dibatasi lebarnya (kepala DAN sel)
 *   butir 5  tombol ruang sidang di ujung kanan deretan alat - menyaring tabel ke satu ruang
 * (butir 1 - penanda verifikasi hanya sidang e-Litigasi + "belum upload" - di
 * verifikasi-majelis-elitigasi.test.tsx)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { daftarRuangAktif, ruangPilihanBerlaku, saringKeRuang } from "@/lib/ruang-sidang-saring";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { agendaLaporanMediasi, penandaHasilMediasi, penandaMediator, penandaPernahMediasi } from "@/lib/penanda-mediasi";
import { CONTOH_TAMPILAN, DuaKeadaan, InfoContohSaklar } from "@/components/portal/contoh-tampilan";
import { PenandaMediasiAgenda } from "@/components/portal/aleta-ecourt-sidang";

const layar = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");

describe("butir 5: tombol ruang sidang", () => {
  const sidang = [
    { nomorPerkara: "1", ruangan: "Ruang Sidang 2" },
    { nomorPerkara: "2", ruangan: "Ruang Sidang 1 Dalam Gedung" },
    { nomorPerkara: "3", ruangan: " Ruang  Sidang 2 " },
    { nomorPerkara: "4", ruangan: "" },
    { nomorPerkara: "5", ruangan: null },
    { nomorPerkara: "6", ruangan: "Ruang Sidang 10" },
  ];

  it("satu tombol per ruang yang dipakai, berjumlah, urut alami; tanpa ruang = tidak ada tombol", () => {
    expect(daftarRuangAktif(sidang)).toEqual([
      { nama: "Ruang Sidang 1 Dalam Gedung", jumlah: 1 },
      { nama: "Ruang Sidang 2", jumlah: 2 },
      { nama: "Ruang Sidang 10", jumlah: 1 },
    ]);
    expect(daftarRuangAktif([{ ruangan: "" }, { ruangan: null }])).toEqual([]);
  });

  it("menyaring ke satu ruang; tanpa pilihan apa adanya; pilihan yang ruangnya hilang gugur", () => {
    expect(saringKeRuang(sidang, "Ruang Sidang 2").map((x) => x.nomorPerkara)).toEqual(["1", "3"]);
    expect(saringKeRuang(sidang, null)).toBe(sidang);
    const daftar = daftarRuangAktif(sidang);
    expect(ruangPilihanBerlaku("Ruang Sidang 2", daftar)).toBe("Ruang Sidang 2");
    expect(ruangPilihanBerlaku("Ruang Sidang 3", daftar)).toBeNull();
  });

  it("tersambung ke tabel, di ujung kanan deretan alat, dan punya saklar tampilan (menyala bawaan)", () => {
    expect(layar).toContain("const sidangTampil = saringKeRuang(milikSaya.baris, ruangSaring);");
    expect(layar).toContain('tampil(tampilan, "saring-ruang") ? ruangPilihanBerlaku(ruangDipilih, ruangAktif) : null');
    // Jumlahnya dari SELURUH sidang, bukan yang tersaring.
    expect(layar).toContain("const ruangAktif = useMemo(() => daftarRuangAktif(sidang), [sidang]);");
    // Sesudah tombol Daftarkan ke antrian, rata kanan.
    const iDaftar = layar.indexOf('{sinkronSibuk ? "Memeriksa…" : "Daftarkan ke antrian"}');
    const iRuang = layar.indexOf('data-saring-ruang=""');
    expect(iDaftar).toBeGreaterThan(-1);
    expect(iRuang).toBeGreaterThan(iDaftar);
    expect(layar.slice(iRuang - 120, iRuang)).toContain("ml-auto");
    expect(SAKLAR_TAMPILAN.find((x) => x.kunci === "saring-ruang")).toBeTruthy();
    expect(tampil(tampilanBawaan(), "saring-ruang")).toBe(true);
    expect(tampil({ ...tampilanBawaan(), "saring-ruang": false }, "saring-ruang")).toBe(false);
  });
});

describe("butir 2: kolom Majelis & Petugas tidak lagi melebar", () => {
  it("batas lebar dipasang pada kepala DAN sel kolomnya", () => {
    expect(layar).toContain('export const LEBAR_KOLOM_MAJELIS = "w-[17rem] max-w-[17rem]";');
    expect(layar).toContain('<KepalaUrut className={cn("px-2 kolom-lengkap", LEBAR_KOLOM_MAJELIS)} kunci="majelis"');
    // Sel majelis: yang memuat lencana kode majelis.
    const iSel = layar.indexOf('<td className={cn("px-2 py-2 align-top text-sm kolom-lengkap", LEBAR_KOLOM_MAJELIS)}>');
    expect(iSel).toBeGreaterThan(-1);
    expect(layar.slice(iSel, iSel + 2500)).toContain("KELAS_LENCANA_KODE_MAJELIS");
  });
});

// ============================================================================
// Butir 6-11 (6 Okt 2026, lanjutan)
// ============================================================================

const HARI = "2026-10-06";
const mediasi = (s: Partial<{ ditunjuk: string; dimulai: string; hasil: string; keputusan: string; mediator: string }> = {}) => ({
  ditunjuk: "2026-09-22",
  dimulai: "2026-09-22",
  hasil: "",
  keputusan: "",
  mediator: "Drs. Mediator",
  ...s,
});

describe("butir 7: penanda mediator hanya bila kedua pihak hadir pertama kali", () => {
  const dasar = { nomorPerkara: "553/Pdt.G/2026/PA.Dgl", tanggalSidang: HARI, agenda: "Panggil Tergugat", mediasi: null, mediasiTerbaca: true, hadirLengkapTerbaca: true };

  it("SIPP mencatat keduanya hadir PERTAMA kali pada sidang ini", () => {
    expect(penandaMediator({ ...dasar, hadirLengkapPertama: HARI }, null, HARI)?.kunci).toBe("mediator");
    // Sudah pernah hadir lengkap sebelumnya: bukan pertama kali.
    expect(penandaMediator({ ...dasar, hadirLengkapPertama: "2026-09-22" }, null, HARI)).toBeNull();
  });

  it("hari ini: pihak kesatu DAN kedua sudah ambil antrian, SIPP belum pernah mencatat keduanya hadir", () => {
    expect(penandaMediator({ ...dasar, hadirLengkapPertama: "" }, { pihak1: "08:10", pihak2: "08:25" }, HARI)?.keterangan).toContain("08:25");
    expect(penandaMediator({ ...dasar, hadirLengkapPertama: "" }, { pihak1: "08:10", pihak2: "" }, HARI)).toBeNull();
    // Antrian hanya berarti untuk hari ini.
    expect(penandaMediator({ ...dasar, tanggalSidang: "2026-10-05", hadirLengkapPertama: "" }, { pihak1: "08:10", pihak2: "08:25" }, HARI)).toBeNull();
  });

  it("bukan gugatan, mediator sudah ditunjuk sebelumnya, atau data gagal terbaca = tanpa penanda", () => {
    expect(penandaMediator({ ...dasar, nomorPerkara: "225/Pdt.P/2026/PA.Dgl", hadirLengkapPertama: HARI }, null, HARI)).toBeNull();
    expect(penandaMediator({ ...dasar, nomorPerkara: "12/Pdt.G.S/2026/PA.Dgl", hadirLengkapPertama: HARI }, null, HARI)).toBeNull();
    expect(penandaMediator({ ...dasar, hadirLengkapPertama: HARI, mediasi: mediasi({ ditunjuk: "2026-09-22" }) }, null, HARI)).toBeNull();
    expect(penandaMediator({ ...dasar, hadirLengkapPertama: HARI, hadirLengkapTerbaca: false }, null, HARI)).toBeNull();
  });

  it("tombol Mediator di layar memakai aturan itu, bukan lagi tiap agenda yang menyebut mediasi", () => {
    expect(layar).toContain("const penanda = penandaMediator(baris, antrianUntuk(antrian.peta, baris), hariIni());");
    expect(layar).not.toContain("sidangBerbauMediasi(baris.agenda, baris.alasanDitunda) ? (");
  });
});

describe("butir 8-9: Mediasi dan hasil mediasi di kolom Agenda", () => {
  const baris = (s: Record<string, unknown>) => ({ nomorPerkara: "500/Pdt.G/2026/PA.Dgl", tanggalSidang: HARI, agenda: "Laporan hasil mediasi", mediasiTerbaca: true, ...s });

  it("agenda laporan/hasil mediasi dikenali, proses mediasi tidak", () => {
    for (const a of ["Laporan hasil mediasi", "Mendengarkan hasil mediasi", "laporan mediasi", "Sidang Kedua Pembacaan Laporan Hasil Mediasi"]) expect(agendaLaporanMediasi(a), a).toBe(true);
    for (const a of ["proses mediasi", "Mediasi", "Pembuktian"]) expect(agendaLaporanMediasi(a), a).toBe(false);
  });

  it("lima hasil SIPP berwarna menurut artinya, hanya pada agenda laporan", () => {
    const h = (kode: string) => penandaHasilMediasi(baris({ mediasi: mediasi({ hasil: kode }) }));
    expect(h("Y1")).toMatchObject({ label: "mediasi berhasil dengan perdamaian" });
    expect(h("Y1")!.kelas).toContain("emerald");
    expect(h("S")).toMatchObject({ label: "mediasi berhasil sebagian" });
    expect(h("Y2")).toMatchObject({ label: "mediasi berhasil dengan pencabutan" });
    expect(h("T")!.kelas).toContain("rose");
    expect(h("D")).toMatchObject({ label: "mediasi tidak dapat dilaksanakan" });
    expect(h("")).toMatchObject({ label: "hasil mediasi belum dicatat" });
    expect(penandaHasilMediasi(baris({ agenda: "proses mediasi", mediasi: mediasi({ hasil: "T" }) }))).toBeNull();
    expect(penandaHasilMediasi(baris({ mediasi: null }))).toBeNull();
  });

  it("Mediasi hanya bila pernah bermediasi pada/sebelum hari sidang itu", () => {
    expect(penandaPernahMediasi(baris({ agenda: "Pembuktian", mediasi: mediasi() }))?.label).toBe("Mediasi");
    expect(penandaPernahMediasi(baris({ agenda: "Pembuktian", mediasi: null }))).toBeNull();
    expect(penandaPernahMediasi(baris({ mediasi: mediasi({ ditunjuk: "2026-10-20", dimulai: "2026-10-20" }) }))).toBeNull();
    expect(penandaPernahMediasi(baris({ mediasiTerbaca: false, mediasi: mediasi() }))).toBeNull();
  });

  it("dirender di sel Agenda; tanpa penanda tidak ada sisa", () => {
    const html = renderToStaticMarkup(
      createElement(PenandaMediasiAgenda, {
        penanda: [penandaPernahMediasi(baris({ mediasi: mediasi({ hasil: "T" }) })), penandaHasilMediasi(baris({ mediasi: mediasi({ hasil: "T" }) }))],
      })
    );
    expect(html).toContain('data-penanda-mediasi="mediasi"');
    expect(html).toContain('data-penanda-mediasi="hasil-mediasi-t"');
    expect(html).toContain("mediasi tidak berhasil");
    expect(renderToStaticMarkup(createElement(PenandaMediasiAgenda, { penanda: [null, null] }))).toBe("");
    expect(layar).toContain('tampil(tampilan, "penanda-mediasi") ? penandaPernahMediasi(baris) : null');
    expect(layar).toContain('tampil(tampilan, "hasil-mediasi") ? penandaHasilMediasi(baris) : null');
  });
});

describe("butir 10: saklar untuk fitur yang baru", () => {
  it("tiap fitur baru punya saklar, menyala bawaan, dan dipakai di layar", () => {
    for (const kunci of ["verifikasi-majelis", "penanda-mediasi", "hasil-mediasi", "pembebanan-ikrar", "court-calendar", "saring-ruang"]) {
      expect(SAKLAR_TAMPILAN.find((x) => x.kunci === kunci), kunci).toBeTruthy();
      expect(tampil(tampilanBawaan(), kunci), kunci).toBe(true);
      expect(layar, kunci).toContain(`tampil(tampilan, "${kunci}")`);
    }
  });
});

describe("butir 11: ikon i dan contoh tampil/disembunyikan", () => {
  it("SETIAP saklar punya contoh tampilan", () => {
    const tanpa = SAKLAR_TAMPILAN.filter((x) => !CONTOH_TAMPILAN[x.kunci]).map((x) => x.kunci);
    expect(tanpa).toEqual([]);
  });

  it("sembulan ikon i memuat kedua keadaan, dan yang berlaku ditandai", () => {
    const html = renderToStaticMarkup(createElement(InfoContohSaklar, { kunci: "potensi-verstek", label: "Potensi verstek", keterangan: "k", menyala: false }));
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("potensi verstek");
    expect(html).toContain("Disembunyikan (sekarang)");
    expect(html).not.toContain("Tampil (sekarang)");
    const nyala = renderToStaticMarkup(createElement(DuaKeadaan, { kunci: "potensi-verstek", keterangan: "k", menyala: true }));
    expect(nyala).toContain("Tampil (sekarang)");
  });

  it("panel: ikon i di tiap saklar, dan saklar Tampilkan contoh di atas daftar memampangkan semuanya", () => {
    expect(layar).toContain("<InfoContohSaklar");
    expect(layar).toContain('data-saklar-contoh=""');
    expect(layar).toContain("{contohSaklar ? (");
    expect(layar.indexOf('data-saklar-contoh=""')).toBeLessThan(layar.indexOf("{kelompokTampilan().map((kelompok) => ("));
  });
});

describe("butir 6: kode majelis tidak diulang di sel Antrian / Jam", () => {
  it("blok kode majelis antrian dibuang dari sel itu", () => {
    expect(layar).not.toContain('title="Kode majelis di aplikasi antrian"');
  });
});
