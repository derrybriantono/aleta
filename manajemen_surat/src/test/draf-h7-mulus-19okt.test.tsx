// @vitest-environment jsdom
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PanelDrafH7 } from "@/components/portal/draf-h7";
import {
  golongkanIsian,
  namaBlangkoAwam,
  nilaiKesiapanH7,
  pilihBlangkoH7,
  ringkasDrafH7,
  susunRingkasan,
  teksLaporanH7,
  teksLencanaH7,
  usulanDariKtp,
  type DrafH7,
  type RingkasDrafH7,
} from "@/lib/agen-h7-putusan";
import { TAHAP_H7, hariTanggal, susunTahapanH7 } from "@/lib/draf-h7-tahapan";
import {
  VARIABEL_BERHTML,
  VARIABEL_HANYA_SARAN,
  VARIABEL_PERIODE,
  VAR_BUKTI,
  VAR_ECOURT,
  VAR_KUASA,
  bersihkanNilaiUsulan,
  formatPeriode,
  htmlKeTeks,
} from "@/lib/isi-sipp-format";
import { tautanBlangkoDerry } from "@/lib/tautan-blangko-derry";
import { susunDrafSatu, type SumberAgenH7 } from "@/server/modules/aleta-ecourt/agen-h7-putusan";
import type { ButirIsian, Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import type { AletaDatabase } from "@/server/db/client";

/**
 * 19 Okt 2026 - Draf putusan (dulu "Draf H-7") dibuat mulus. Keluhan hakim: terlalu panjang, tulisan kecil,
 * makan tempat di Jadwal Sidang, tidak paham. Kini: SATU tombol ringkas di baris, pop-up besar berisi lima
 * tahap yang dapat diklik (ringkasan, isian otomatis, perlu diisi hakim, bahan perkara, buka blangko), bahasa
 * awam, tautan "Isi di Blangko" memakai kontrak #bd=, dan mesin isian SAMA dengan Isi dari SIPP di Blangko Derry.
 */

const AKAR = path.resolve(process.cwd(), "..");

const isian = (kode: string, nama: string, lain: Partial<ButirIsian> = {}): ButirIsian => ({
  kode, nama, namaAsli: nama, jenis: "teks", pemicu: "", wajib: true, langsung: true, bawaan: "", pilihan: [], saran: "",
  dipakaiOleh: [], khusus: "", pihak: "", keadaan: "", tingkat: "penting", opsi: [], tj: null, ...lain,
});

const BARIS = {
  perkaraId: "512", nomorPerkara: "512/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalSidang: "2026-10-19", agenda: "Panggil Tergugat",
  urutanSidang: 2, panggilan: { tergugatPernahHadir: false }, majelisNama: "Hakim A", paniteraNama: "PP B",
};
const NILAI = {
  "1214": { status: "terisi", teks: "P-1 Fotokopi KTP<br>P-2 Fotokopi Kutipan Akta Nikah" },
  "5125": { status: "terisi", teks: "Bahwa Penggugat dan Tergugat menikah pada 2015;<br>Bahwa sejak 2023 sering bertengkar;<br>Bahwa Tergugat pergi sejak Januari 2025;" },
  "0033": { status: "terisi", teks: "19 Oktober 2026" },
};
const ISIAN = golongkanIsian({
  susunan: {
    isian: [
      isian("0222", "Awal perselisihan"),
      isian("0246", "Pisah rumah sejak"),
      isian("0365", "Tanggal KTP Tergugat"),
      isian("0364", "Tanggal KTP Penggugat"),
      isian("1214", "Alat bukti surat Penggugat", { khusus: "bukti" }),
      isian("8503", "Alasan perceraian"),
      isian("8436", "Kesimpulan Penggugat"),
      isian("9944", "Lama pisah"),
    ],
  },
  nilai: NILAI,
  usulan: [
    { jalur: "saksi", usulan: { kode: "0222", nilai: "Maret 2024", tingkat: "pasti" } },
    { jalur: "sipp", usulan: { kode: "0246", nilai: "<b>Agustus 2025</b>", keyakinan: "pasti" } },
    { jalur: "ktp", usulan: { kode: "0365", nilai: "10/01/2019", keyakinan: "cukup", sumber: [{ asal: "ktp-pihak" }] } },
    { jalur: "itsbat", usulan: { kode: "9944", nilai: "1 tahun 2 bulan", keyakinan: "cukup", sumber: [{ asal: "posita" }] } },
    { jalur: "sipp", usulan: { kode: "8503", nilai: "F", keyakinan: "pasti" } },
  ],
  perkara: null,
});
const DRAF: DrafH7 = {
  perkaraId: "512", nomorPerkara: BARIS.nomorPerkara, jenisPerkara: BARIS.jenisPerkara, tanggalSidang: BARIS.tanggalSidang, agenda: BARIS.agenda,
  alasan: "verstek", majelis: "Hakim A", panitera: "PP B",
  blangko: pilihBlangkoH7(BARIS, "putusan"),
  isian: ISIAN,
  otomatis: { jumlah: 30, terisi: 30, kosong: [{ kode: "0365", nama: "Tanggal lahir Tergugat", sebab: "" }] },
  ringkasan: susunRingkasan({
    nilai: NILAI,
    riwayat: [{ urutan: 1, tanggalSidang: "2026-10-05", agenda: "Panggil Tergugat", dihadiriOleh: 2 }],
    saksi: [],
    dokumen: [],
    namaSaksi: { P: [], T: [] },
    sebutan: { P: "Penggugat", T: "Tergugat" },
  }),
  kesiapan: nilaiKesiapanH7(ISIAN, null, true),
  kendala: [],
  dibuatPada: "2026-10-12T22:00:00.000Z",
};
const TAUTAN = { sidangKe: 2, jumlahSaksiP: 0, jumlahSaksiT: 0, setelanAps: "", boleh: true };

/** Istilah teknis yang dulu bocor ke layar hakim - tidak boleh ada di pop-up. */
const TERLARANG = /sumber:|Isian bukti di ABT|Perlu manusia|golongan|\bH-7\b|#\d{4}#|\b(?:0222|0246|0365|0364|1214|8503|8436|9944|5125)\b|undefined|null/;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function bukaPopup(draf: DrafH7 = DRAF, tautan: Record<string, unknown> | undefined = TAUTAN) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { peta: { "512": { ...draf, laporan: teksLaporanH7(draf) } } } }), { status: 200 })));
  const hasil = render(<PanelDrafH7 perkaraId="512" ringkas={ringkasDrafH7(draf)} tautan={tautan} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button"));
  });
  const dialog = document.body.querySelector("[data-dialog-draf-h7]") as HTMLElement;
  return { ...hasil, dialog };
}

const klikTahap = async (dialog: HTMLElement, kode: string) => {
  await act(async () => {
    fireEvent.click(dialog.querySelector(`[data-tahap="${kode}"]`) as HTMLElement);
  });
};

describe("di baris Jadwal Sidang: satu tombol kecil, tanpa panel panjang", () => {
  it("lencana bahasa awam: 'Draf putusan · 3 dari 11 siap', 'siap', dan ringkasan lama tanpa hitungan", () => {
    const r = (lain: Partial<RingkasDrafH7>): RingkasDrafH7 => ({ tanggalSidang: "2026-10-19", blangko: "x", tingkat: "belum", persen: 27, perlu: [], jumlahPerlu: 8, dibuatPada: "", ...lain });
    expect(teksLencanaH7(r({ siap: 3, jumlah: 11 }))).toBe("Draf putusan · 3 dari 11 siap");
    expect(teksLencanaH7(r({ tingkat: "siap" }))).toBe("Draf putusan siap");
    expect(teksLencanaH7(r({}))).toBe("Draf putusan · 27% siap");
    expect(teksLencanaH7(r({ blangko: "" }))).toBe("Draf putusan · blangko belum ada");
    expect(teksLencanaH7(r({ siap: 3, jumlah: 11 }))).not.toMatch(/H-7|perlu diisi|manusia/);
    expect(ringkasDrafH7(DRAF)).toMatchObject({ siap: DRAF.kesiapan.terisi + DRAF.kesiapan.pasti, jumlah: DRAF.kesiapan.jumlah });
  });

  it("hanya SATU tombol ringkas dan tidak ada isi panjang di baris; klik membuka pop-up (dialog modal)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { peta: { "512": { ...DRAF, laporan: [] } } } }), { status: 200 })));
    const { container } = render(<PanelDrafH7 perkaraId="512" ringkas={ringkasDrafH7(DRAF)} tautan={TAUTAN} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const teksBaris = container.textContent || "";
    expect(teksBaris).toMatch(/^Draf putusan · \d+ dari \d+ siap$/);
    expect(teksBaris.length).toBeLessThan(45);
    expect(container.querySelector("[data-dialog-draf-h7]")).toBeNull();
    expect(document.body.querySelector("[role=dialog]")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    const dialog = document.body.querySelector("[role=dialog]") as HTMLElement;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Tetap satu tombol ringkas di baris (dialog dipasang di body, bukan di dalam baris).
    expect(container.textContent).toBe(teksBaris);
    // Layar penuh di HP, dialog besar di layar lebar; huruf normal (tanpa text-[11px]).
    const kelas = dialog.className;
    expect(kelas).toMatch(/h-full w-full/);
    expect(kelas).toMatch(/sm:max-w-3xl/);
    expect(dialog.innerHTML).not.toMatch(/text-\[(?:9|10|11|12)px\]/);
    // Esc menutup.
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(document.body.querySelector("[role=dialog]")).toBeNull();
  });

  it("tanpa draf (ringkas kosong): tidak ada tombol sama sekali", () => {
    const { container } = render(<PanelDrafH7 perkaraId="512" ringkas={null} />);
    expect(container.textContent).toBe("");
  });

  it("Jadwal Sidang memasang PanelDrafH7 dengan bahan tautan dan hak peran (jenis putusan)", () => {
    const sumber = readFileSync(path.join(AKAR, "manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");
    const pasang = sumber.slice(sumber.indexOf("<PanelDrafH7"), sumber.indexOf("<PanelDrafH7") + 600);
    expect(pasang).toMatch(/boleh: jenisBlangkoPeran\.includes\("putusan"\)/);
    expect(pasang).toMatch(/setelanAps/);
  });
});

describe("pop-up: lima tahap yang dapat diklik", () => {
  it("lima tab bertahap; klik tab menampilkan isinya saja; Sebelumnya/Berikutnya berjalan", async () => {
    const { dialog } = await bukaPopup();
    const tab = Array.from(dialog.querySelectorAll("[role=tab]")) as HTMLElement[];
    expect(tab.map((t) => t.getAttribute("data-tahap"))).toEqual(TAHAP_H7.map((t) => t.kode));
    expect(tab).toHaveLength(5);
    const isiAktif = () => Array.from(dialog.querySelectorAll("[data-isi-tahap]")).map((e) => e.getAttribute("data-isi-tahap"));
    expect(isiAktif()).toEqual(["ringkasan"]);
    for (const kode of ["otomatis", "perlu", "bahan", "selesai", "ringkasan"]) {
      await klikTahap(dialog, kode);
      expect(isiAktif()).toEqual([kode]);
      expect(dialog.querySelector(`[data-tahap="${kode}"]`)?.getAttribute("aria-selected")).toBe("true");
    }
    // Berikutnya x4 sampai 'selesai' lalu Sebelumnya.
    const berikut = () => dialog.querySelector("[data-tahap-berikutnya]") as HTMLElement;
    for (const kode of ["otomatis", "perlu", "bahan", "selesai"]) {
      await act(async () => {
        fireEvent.click(berikut());
      });
      expect(isiAktif()).toEqual([kode]);
    }
    expect(dialog.querySelector("[data-tahap-berikutnya]")).toBeNull();
    await act(async () => {
      fireEvent.click(dialog.querySelector("[data-tahap-sebelumnya]") as HTMLElement);
    });
    expect(isiAktif()).toEqual(["bahan"]);
  });

  it("tahap lengkap bertanda centang, yang perlu tindakan bertanda jingga (perlu)", async () => {
    const { dialog } = await bukaPopup();
    const status = (kode: string) => dialog.querySelector(`[data-tahap="${kode}"] [data-status-tahap]`)?.getAttribute("data-status-tahap");
    expect(status("ringkasan")).toBe("lengkap");
    expect(status("perlu")).toBe("perlu");
    expect(status("selesai")).toBe("perlu");
    // Ada centang (ikon) pada tahap lengkap.
    expect(dialog.querySelector('[data-tahap="ringkasan"] svg')).not.toBeNull();
    expect(dialog.querySelector('[data-tahap="perlu"] [data-status-tahap]')?.className).toMatch(/orange/);
    const t = susunTahapanH7(DRAF);
    expect(t.tahap.map((x) => x.kode)).toEqual(["ringkasan", "otomatis", "perlu", "bahan", "selesai"]);
  });

  it("1 Ringkasan: satu kalimat awam, nama blangko tanpa kode, 'N dari M isian siap'", async () => {
    const { dialog } = await bukaPopup();
    expect(dialog.querySelector("[data-kalimat-ringkasan]")?.textContent).toBe(
      "Perkara ini diperkirakan diputus Senin 19 Oktober 2026, kemungkinan verstek karena Tergugat belum pernah hadir."
    );
    const nama = dialog.querySelector("[data-nama-blangko]")?.textContent || "";
    expect(nama).not.toMatch(/\[|\]|\.rtf/);
    expect(nama).toBe(namaBlangkoAwam(DRAF.blangko.utama?.label));
    expect(dialog.querySelector("[data-angka-siap]")?.textContent).toBe(`${DRAF.kesiapan.terisi + DRAF.kesiapan.pasti} dari ${DRAF.kesiapan.jumlah}`);
    expect(hariTanggal("2026-10-19")).toBe("Senin 19 Oktober 2026");
    expect(namaBlangkoAwam("[01] [Kabul Verstek] Cerai (Format Lengkap)")).toBe("Kabul Verstek · Cerai (Format Lengkap)");
    expect(namaBlangkoAwam("[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah)")).toBe("Tolak · IN - Rukun Tidak Terpenuhi (Wali Tidak Sah)");
  });

  it("2 Isian otomatis: lencana pasti / cukup / ragu - periksa dan asal terbaca", async () => {
    const t = susunTahapanH7(DRAF);
    const per = (nama: string) => t.otomatis.find((o) => o.nama === nama)!;
    expect(per("Awal perselisihan")).toMatchObject({ keyakinan: "pasti", asal: "saksi", teksAsal: "dari keterangan saksi", nilai: "bulan Maret 2024" });
    expect(per("Pisah rumah sejak")).toMatchObject({ keyakinan: "pasti", asal: "sipp", teksAsal: "dari SIPP", nilai: "bulan Agustus 2025" });
    expect(per("Tanggal KTP Tergugat")).toMatchObject({ keyakinan: "cukup", asal: "berkas", teksAsal: "dari berkas e-Court" });
    expect(per("Lama pisah")).toMatchObject({ keyakinan: "cukup", asal: "gugatan", teksAsal: "dari gugatan - belum dikuatkan saksi" });
    expect(per("Lama pisah").periksa).toBe(true);
    const { dialog } = await bukaPopup();
    await klikTahap(dialog, "otomatis");
    const lencana = Array.from(dialog.querySelectorAll("[data-yakin]")).map((e) => e.textContent);
    expect(lencana).toEqual(expect.arrayContaining(["pasti", "cukup yakin"]));
    expect(dialog.textContent).toContain("dari keterangan saksi");
    expect(dialog.textContent).toContain("dari SIPP");
    expect(dialog.textContent).toContain("dari gugatan - belum dikuatkan saksi");
    expect(dialog.textContent).toContain("dari berkas e-Court");
    expect(dialog.textContent).toContain("sudah dicatat petugas");
    // Isian ragu: nama "ragu - periksa" untuk bacaan KTP ragu.
    const ragu = golongkanIsian({
      susunan: { isian: [isian("0364", "Tanggal KTP Penggugat")] },
      nilai: {},
      usulan: usulanDariKtp([{ cabang: 1, urutan: 1, tanggalKtp: "03/05/2021", yakin: "ragu" }]).map((usulan) => ({ jalur: "ktp", usulan })),
      perkara: null,
    });
    expect(ragu[0]).toMatchObject({ golongan: "usulan", keyakinan: "ragu", asal: "berkas" });
    expect(susunTahapanH7({ ...DRAF, isian: ragu, kesiapan: nilaiKesiapanH7(ragu, null, true) }).otomatis[0].teksYakin).toBe("ragu - periksa");
  });

  it("3 Perlu diisi hakim: alasan satu baris dan tombol 'Isi di Blangko' tiap butir (kontrak #bd=)", async () => {
    const { dialog } = await bukaPopup();
    await klikTahap(dialog, "perlu");
    const butir = Array.from(dialog.querySelectorAll("[data-perlu-isi]")) as HTMLElement[];
    expect(butir.length).toBeGreaterThanOrEqual(2);
    expect(dialog.textContent).toContain("Alasan perceraian");
    expect(dialog.textContent).toMatch(/Keputusan hakim/);
    expect(dialog.textContent).toMatch(/Belum ada datanya - ketik langsung di blangko/);
    expect(dialog.textContent).toContain("Data di SIPP yang dipakai naskah masih kosong: Tanggal lahir Tergugat");
    for (const b of butir) {
      const a = b.querySelector("a[data-isi-di-blangko]") as HTMLAnchorElement;
      expect(a, b.textContent || "").not.toBeNull();
      expect(a.textContent).toContain("Isi di Blangko");
      expect(a.getAttribute("target")).toBe("_blank");
      const href = a.getAttribute("href") || "";
      const m = /^(.*)\/abt\/#bd=(.+)$/.exec(href);
      expect(m, href).not.toBeNull();
      const muatan = JSON.parse(decodeURIComponent(m![2]));
      expect(muatan).toMatchObject({ v: 1, nomor: BARIS.nomorPerkara, perkaraId: 512, sidangKe: 2, tanggalSidang: "2026-10-19", jenis: "putusan", agenda: "Panggil Tergugat", verstek: true, draf: "h7", varian: "dikabulkan" });
      expect(typeof muatan.isian).toBe("string");
      expect(muatan.isian).not.toMatch(/^\d{4}$/);
    }
    // Pembentuknya SAMA dengan tombol Blangko di Jadwal Sidang (bukan dibuat ulang).
    const pertama = butir[0].querySelector("a[data-isi-di-blangko]")!.getAttribute("href");
    const nama = butir[0].querySelector("p")!.textContent!;
    expect(pertama).toBe(
      tautanBlangkoDerry(
        { nomor: BARIS.nomorPerkara, perkaraId: "512", sidangKe: 2, tanggalSidang: "2026-10-19", agenda: "Panggil Tergugat", tunda: "", keterangan: "", amar: "", verstek: true, jumlahSaksiP: 0, jumlahSaksiT: 0, draf: "h7", varian: "dikabulkan", isian: nama },
        "putusan",
        ""
      )
    );
  });

  it("tautan lama tanpa ruas tambahan tetap bentuk kontrak (ruas draf/varian/isian hanya bila diisi)", () => {
    const dasar = tautanBlangkoDerry({ nomor: "1/Pdt.G/2026/PA.Dgl", perkaraId: 1, sidangKe: 1, tanggalSidang: "2026-10-19" }, "bas", "");
    const muatan = JSON.parse(decodeURIComponent(dasar.split("#bd=")[1]));
    expect(Object.keys(muatan)).toEqual(["v", "nomor", "perkaraId", "sidangKe", "tanggalSidang", "jenis", "agenda", "tunda", "keterangan", "amar", "verstek", "jumlahSaksiP", "jumlahSaksiT"]);
  });

  it("hak per peran: tanpa hak membuka blangko putusan, tidak ada tombol blangko sama sekali", async () => {
    const { dialog } = await bukaPopup(DRAF, { ...TAUTAN, boleh: false });
    await klikTahap(dialog, "perlu");
    expect(dialog.querySelectorAll("a[data-isi-di-blangko]")).toHaveLength(0);
    expect(dialog.textContent).toContain("hanya dapat melihat");
    await klikTahap(dialog, "selesai");
    expect(dialog.querySelector("a[data-buka-draf]")).toBeNull();
    expect(dialog.querySelector("[data-ket-belum-simpan]")?.textContent).toContain("belum disimpan ke ABT maupun SIPP");
  });

  it("4 Bahan perkara: kartu terlipat dengan judul jelas + jumlah; posita terlipat per butir", async () => {
    const { dialog } = await bukaPopup();
    await klikTahap(dialog, "bahan");
    const kartu = Array.from(dialog.querySelectorAll("[data-kartu-bahan]")) as HTMLDetailsElement[];
    expect(kartu).toHaveLength(5);
    expect(kartu.every((k) => !k.open)).toBe(true);
    const judul = kartu.map((k) => k.querySelector("summary")!.textContent!);
    expect(judul[0]).toMatch(/^Duduk perkara \(gugatan\)3$/);
    expect(judul[1]).toMatch(/^Jawab-menjawab/);
    expect(judul[2]).toMatch(/^Bukti surat2$/);
    expect(judul[3]).toMatch(/^Keterangan saksi/);
    expect(judul[4]).toMatch(/^Kesimpulan para pihak/);
    expect(kartu[0].querySelectorAll("details")).toHaveLength(3);
    expect(dialog.textContent).toContain("Asal bahan: Gugatan/permohonan yang tercatat di SIPP");
  });

  it("5 Selesai: tombol utama 'Buka draf di Blangko ABT' memakai tautan #bd= putusan + keterangan belum disimpan", async () => {
    const { dialog } = await bukaPopup();
    await klikTahap(dialog, "selesai");
    const a = dialog.querySelector("a[data-buka-draf]") as HTMLAnchorElement;
    expect(a.textContent).toContain("Buka draf di Blangko ABT");
    const muatan = JSON.parse(decodeURIComponent(a.getAttribute("href")!.split("#bd=")[1]));
    expect(muatan).toMatchObject({ jenis: "putusan", draf: "h7", varian: "dikabulkan", nomor: BARIS.nomorPerkara });
    expect(muatan.isian).toBeUndefined();
    expect(dialog.querySelector("[data-ket-belum-simpan]")?.textContent).toBe("Draf belum disimpan ke ABT maupun SIPP sampai petugas menyimpannya sendiri di Blangko ABT.");
    expect(dialog.textContent).toContain("Alat saya > Checklist konseptor putusan > Buka blangko draf");
  });

  it("bahasa awam di SEMUA tahap: tanpa istilah teknis, kode variabel, atau 'H-7'", async () => {
    const { dialog } = await bukaPopup();
    const semua: string[] = [dialog.textContent || ""];
    for (const kode of ["otomatis", "perlu", "bahan", "selesai"]) {
      await klikTahap(dialog, kode);
      semua.push(dialog.textContent || "");
    }
    const teks = semua.join(" | ");
    expect(teks).not.toMatch(TERLARANG);
    expect(teks).toContain("Perlu diisi hakim");
  });

  it("varian ditolak tetap dapat dipilih: blangko tolak, tautan membawa varian dan amar", async () => {
    const tolakBlangko = pilihBlangkoH7(BARIS, "putusan", "ditolak");
    const isianTolak = golongkanIsian({ susunan: { isian: [isian("8902", "Pertimbangan tidak terbukti")] }, nilai: {}, usulan: [], perkara: null });
    const dengan: DrafH7 = {
      ...DRAF,
      varian: [{ status: "ditolak", blangko: tolakBlangko, isian: isianTolak, otomatis: null, kesiapan: nilaiKesiapanH7(isianTolak, null, true) }],
    };
    const { dialog } = await bukaPopup(dengan);
    const tolak = dialog.querySelector('[data-varian-h7="ditolak"]') as HTMLButtonElement;
    expect(tolak).not.toBeNull();
    expect(dialog.querySelector('[data-varian-h7="dikabulkan"]')?.getAttribute("aria-pressed")).toBe("true");
    await act(async () => {
      fireEvent.click(tolak);
    });
    await klikTahap(dialog, "selesai");
    const muatan = JSON.parse(decodeURIComponent(dialog.querySelector("a[data-buka-draf]")!.getAttribute("href")!.split("#bd=")[1]));
    expect(muatan).toMatchObject({ varian: "ditolak", amar: "Ditolak" });
    await klikTahap(dialog, "ringkasan");
    expect(dialog.querySelector("[data-nama-blangko]")?.textContent).toMatch(/^Tolak/);
  });

  it("draf lama (tanpa keyakinan/asal/jumlah) tetap terbaca: diturunkan dari golongan dan teks sumber", () => {
    const lama = { ...DRAF, isian: DRAF.isian.map((i) => ({ ...i, keyakinan: undefined, asal: undefined })), ringkasan: DRAF.ringkasan.map((b) => ({ ...b, jumlah: undefined, butir: undefined })) } as DrafH7;
    const t = susunTahapanH7(lama);
    expect(t.otomatis.length).toBeGreaterThan(0);
    expect(t.otomatis.every((o) => ["pasti", "cukup", "ragu"].includes(o.keyakinan))).toBe(true);
    expect(t.bahan).toHaveLength(5);
    expect(t.bahan[0].butir.length).toBeGreaterThan(0);
  });
});

describe("mesin sama dengan Isi dari SIPP (Blangko Derry): format periode dan buang HTML", () => {
  it("periode: 'bulan Januari 2023' / 'tahun 2023'; HTML dibuang kecuali variabel ber-HTML (8500)", () => {
    expect(formatPeriode("Januari 2023")).toBe("bulan Januari 2023");
    expect(formatPeriode("bulan Januari 2023")).toBe("bulan Januari 2023");
    expect(formatPeriode("Nopember 2022")).toBe("bulan November 2022");
    expect(formatPeriode("2023")).toBe("tahun 2023");
    expect(formatPeriode("tahun 2023")).toBe("tahun 2023");
    expect(formatPeriode("awal tahun 2023")).toBe("awal tahun 2023");
    expect(formatPeriode("28 Agustus 2025")).toBe("28 Agustus 2025");
    expect(bersihkanNilaiUsulan("0246", "<b>Agustus 2025</b>")).toBe("bulan Agustus 2025");
    expect(bersihkanNilaiUsulan("0222", "2023")).toBe("tahun 2023");
    expect(bersihkanNilaiUsulan("8500", "Majelis<br>Hakim")).toBe("Majelis<br>Hakim");
    expect(bersihkanNilaiUsulan("2021", "Bahwa<br>saksi&nbsp;melihat")).toBe("Bahwa\nsaksi melihat");
    expect(bersihkanNilaiUsulan("9944", "1 tahun 2 bulan")).toBe("1 tahun 2 bulan");
  });

  it("draf memakainya: 'Agustus 2025' dari SIPP menjadi 'bulan Agustus 2025' dan HTML hilang dari nilai usulan", () => {
    const i = ISIAN.find((x) => x.kode === "0246")!;
    expect(i.nilai).toBe("bulan Agustus 2025");
    // Isian yang sudah tercatat di ABT juga polos (tanpa <br> mentah di layar).
    expect(ISIAN.find((x) => x.kode === "1214")!.nilai).toBe("P-1 Fotokopi KTP\nP-2 Fotokopi Kutipan Akta Nikah");
    const html = golongkanIsian({
      susunan: { isian: [isian("2004", "Alamat kantor")] },
      nilai: {},
      usulan: [{ jalur: "gugatan", usulan: { kode: "2004", nilai: "Jl. Mawar<br>No. 5&nbsp;Palu", keyakinan: "cukup", sumber: [{ asal: "gugatan-ecourt" }] } }],
      perkara: null,
    });
    expect(html[0].nilai).toBe("Jl. Mawar\nNo. 5 Palu");
    expect(html[0]).toMatchObject({ asal: "berkas", keyakinan: "cukup" });
  });

  it("keputusan hakim (8503, 5227) tidak pernah 'pasti' dan masuk daftar perlu diisi hakim dengan usulannya", () => {
    expect(VARIABEL_HANYA_SARAN).toEqual(["8503", "5227"]);
    const hasil = golongkanIsian({
      susunan: { isian: [isian("5227", "Alasan cerai"), isian("8503", "Alasan perceraian")] },
      nilai: {},
      usulan: [
        { jalur: "sipp", usulan: { kode: "5227", nilai: "sering bertengkar", keyakinan: "pasti" } },
        { jalur: "sipp", usulan: { kode: "8503", nilai: "F", keyakinan: "pasti" } },
      ],
      perkara: null,
    });
    expect(hasil.map((x) => [x.golongan, x.hukum, x.keyakinan])).toEqual([
      ["usulan", true, "cukup"],
      ["usulan", true, "cukup"],
    ]);
    const t = susunTahapanH7({ ...DRAF, isian: hasil, kesiapan: nilaiKesiapanH7(hasil, null, true) });
    expect(t.perlu.map((p) => p.usulan)).toEqual(["sering bertengkar", "F"]);
    expect(t.otomatis).toHaveLength(0);
  });

  it("KESAMAAN dengan mesin ekstensi isi-sipp-bersama.js: daftar kode dan keluaran format identik", () => {
    const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/isi-sipp-bersama.js"), "utf8");
    const g = globalThis as Record<string, unknown>;
    delete g.AletaIsiSipp;
    new Function(sumber)();
    const mesin = g.AletaIsiSipp as {
      KODE_HTML: string[]; KODE_PERIODE: string[]; HANYA_SARAN: string[]; VAR_BUKTI: string[]; VAR_ECOURT: string[]; VAR_KUASA: string[];
      formatPeriode(x: string): string; htmlKeTeks(x: string): string; bersihkanNilai(k: string, x: string): string;
      sahBentuk(k: string, x: string, nama?: string): boolean; rapikanBentuk(k: string, x: string, nama?: string): string;
    };
    expect(mesin).toBeTruthy();
    expect([...VARIABEL_BERHTML]).toEqual([...mesin.KODE_HTML]);
    expect([...VARIABEL_PERIODE]).toEqual([...mesin.KODE_PERIODE]);
    expect([...VARIABEL_HANYA_SARAN]).toEqual([...mesin.HANYA_SARAN]);
    expect([...VAR_BUKTI]).toEqual([...mesin.VAR_BUKTI]);
    expect([...VAR_ECOURT]).toEqual([...mesin.VAR_ECOURT]);
    expect([...VAR_KUASA]).toEqual([...mesin.VAR_KUASA]);
    const korpus = [
      "Januari 2023", "bulan januari 2023", "bulan bulan Maret, tahun 2021", "Pebruari 2020", "2019", "tahun tahun 2018", "awal 2022", "akhir tahun 2021",
      "28 Agustus 2025", "sejak Januari 2023", "", "  Mei   2024 ", "Bahwa<br>kalimat&nbsp;dua &amp; tiga", "<p>satu</p><p>dua</p>", "<ul><li>a</li><li>b</li></ul>",
      "&#39;kutip&#39; &quot;ganda&quot; &lt;x&gt;", "teks biasa tanpa tag",
    ];
    for (const x of korpus) {
      expect(formatPeriode(x), `periode: ${x}`).toBe(mesin.formatPeriode(x));
      expect(htmlKeTeks(x), `html: ${x}`).toBe(mesin.htmlKeTeks(x));
      for (const kode of ["0222", "8500", "2021"]) expect(bersihkanNilaiUsulan(kode, x), `${kode}: ${x}`).toBe(
        (() => {
          const bersih = mesin.bersihkanNilai(kode, x).trim();
          const baku = mesin.KODE_PERIODE.includes(kode) ? mesin.formatPeriode(bersih) : bersih;
          // 19 Okt (isian 2): nilai yang bentuknya BUKAN isiannya (mis. "28 Agustus 2025" di awal perselisihan) tidak ditulis/diusulkan.
          if (!baku || mesin.KODE_HTML.includes(kode)) return baku;
          return mesin.sahBentuk(kode, baku) ? mesin.rapikanBentuk(kode, baku) : "";
        })()
      );
    }
  });
});

describe("agen: sumber e-Court yang sama dengan Isi dari SIPP dipanggil bila blangko memuat variabelnya", () => {
  const KATALOG = new Map<string, Definisi>([
    ["0222", { kode: "0222", nama: "Awal Konflik", jenis: "data_teks", sql: "", bawaan: "" }],
    ["8436", { kode: "8436", nama: "Kesimpulan Penggugat", jenis: "data_teks", sql: "", bawaan: "" }],
    ["0156", { kode: "0156", nama: "Tanggal surat kuasa", jenis: "data_teks", sql: "", bawaan: "" }],
    ["9470", { kode: "9470", nama: "Daftar bukti", jenis: "data_teks", sql: "", bawaan: "" }],
  ]);

  function sumber(catat: string[], penanda: string[]): SumberAgenH7 {
    const tak = async () => [];
    return {
      async jadwal() {
        return { ok: true, galat: "", sidang: [] };
      },
      async bacaBlangko() {
        return { ada: true, penanda, sebab: "" };
      },
      async katalog() {
        return KATALOG;
      },
      async nilaiPenanda() {
        return { ada: true, sebab: "", nilai: {} };
      },
      async usulan() {
        return { ok: true, galat: "", jalur: [{ jalur: "sipp", usulan: [{ kode: "0222", nilai: "Januari 2023", keyakinan: "pasti" }] }] };
      },
      riwayat: tak,
      saksi: tak,
      dokumen: tak,
      ktp: tak,
      async gugatan(nomor, sebutan, denganBukti) {
        catat.push(`gugatan ${nomor} ${sebutan.lawan}/${sebutan.pelaku} bukti=${denganBukti}`);
        return [{ kode: "8436", nilai: "Penggugat tetap pada gugatannya", keyakinan: "cukup", sumber: [{ asal: "gugatan-ecourt" }] }];
      },
      async kuasa(nomor) {
        catat.push(`kuasa ${nomor}`);
        return [{ kode: "0156", nilai: "02/01/2026", keyakinan: "cukup", sumber: [{ asal: "gugatan-ecourt" }] }];
      },
    };
  }

  it("variabel e-Court ada di blangko: gugatan dan kuasa dibaca; usulannya menjadi isian berasal 'dari berkas e-Court'", async () => {
    const catat: string[] = [];
    const d = (await susunDrafSatu({} as AletaDatabase, BARIS, sumber(catat, ["0222", "8436", "0156", "9470"]), new Date("2026-10-17T06:00:00+08:00")))!;
    expect(catat).toEqual(["gugatan 512/Pdt.G/2026/PA.Dgl Penggugat/Tergugat bukti=true", "kuasa 512/Pdt.G/2026/PA.Dgl"]);
    const kes = d.isian.find((i) => i.kode === "8436")!;
    expect(kes).toMatchObject({ golongan: "usulan", asal: "berkas", keyakinan: "cukup" });
    expect(d.isian.find((i) => i.kode === "0222")).toMatchObject({ golongan: "pasti", nilai: "bulan Januari 2023", asal: "sipp", keyakinan: "pasti" });
  });

  it("tanpa variabel e-Court di blangko, atau perkara tanpa e-Court: tidak ada bacaan berkas (hemat)", async () => {
    const catat: string[] = [];
    await susunDrafSatu({} as AletaDatabase, BARIS, sumber(catat, ["0222"]), new Date("2026-10-17T06:00:00+08:00"));
    expect(catat).toEqual([]);
    await susunDrafSatu({} as AletaDatabase, { ...BARIS, lewatEcourt: false }, sumber(catat, ["0222", "8436", "0156"]), new Date("2026-10-17T06:00:00+08:00"));
    expect(catat).toEqual([]);
  });

  it("bacaan berkas yang gagal dicatat jujur sebagai kendala, draf tetap tersusun", async () => {
    const s = sumber([], ["0222", "8436"]);
    s.gugatan = async () => {
      throw new Error("arsip tidak terbaca");
    };
    const d = (await susunDrafSatu({} as AletaDatabase, BARIS, s, new Date("2026-10-17T06:00:00+08:00")))!;
    expect(d.kendala.join(" ")).toMatch(/berkas e-Court \(arsip tidak terbaca\)/);
    expect(d.isian.length).toBeGreaterThan(0);
  });

  it("rute isi-gugatan, kuasa-gugatan, dan agen membaca lewat pembaca yang sama (isi-sipp-sumber)", () => {
    const baca = (b: string) => readFileSync(path.join(AKAR, "manajemen_surat/src", b), "utf8");
    expect(baca("app/api/aleta-ecourt/isi-gugatan/route.ts")).toContain("bacaGugatanEcourt");
    expect(baca("app/api/aleta-ecourt/kuasa-gugatan/route.ts")).toContain("bacaKuasaEcourt");
    const agen = baca("server/modules/aleta-ecourt/agen-h7-putusan.ts");
    expect(agen).toContain("bacaGugatanEcourt");
    expect(agen).toContain("bacaKuasaEcourt");
  });
});

describe("ekstensi: kartu checklist dan widget diringkas", () => {
  it("konseptor-langkah.js: lencana bahasa awam, satu kalimat (bukan daftar laporan), tanpa 'Draf H-7' di layar", () => {
    const js = readFileSync(path.join(AKAR, "ekstensi-sipp/konseptor-langkah.js"), "utf8");
    expect(js).toContain("Draf putusan · ${r.siap} dari ${r.jumlah} siap");
    expect(js).toContain("Draf putusan siap");
    expect(js).not.toMatch(/\.slice\(0, 5\)\.map\(\(x\) => `<li>/);
    expect(js).not.toContain("Draf H-7 siap");
  });

  it("checklist.js widget: judul 'Draf putusan', tautan 'Lihat tahapan' ke pop-up portal, tanpa kalimat 'Varian draf:'", () => {
    const js = readFileSync(path.join(AKAR, "ekstensi-sipp/checklist.js"), "utf8");
    expect(js).toContain('kotakWidget("drafH7", "Draf putusan"');
    expect(js).toContain("Lihat tahapan");
    expect(js).toContain("/aleta-ecourt?drafH7=");
    expect(js).not.toContain("Varian draf: Dikabulkan");
  });

  it("portal: ?drafH7=<perkara> membuka pop-up langsung dari widget", async () => {
    window.history.pushState({}, "", "/aleta-ecourt?drafH7=512");
    try {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { peta: { "512": { ...DRAF, laporan: [] } } } }), { status: 200 })));
      render(<PanelDrafH7 perkaraId="512" ringkas={ringkasDrafH7(DRAF)} tautan={TAUTAN} />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.body.querySelector("[data-dialog-draf-h7]")).not.toBeNull();
    } finally {
      window.history.pushState({}, "", "/");
    }
  });
});

describe("tangkapan rancangan (hanya bila PRATINJAU_H7_DIR diatur)", () => {
  it("menulis replika HTML pop-up tiap tahap untuk Playwright lokal", async () => {
    const dir = process.env.PRATINJAU_H7_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    const { dialog, container } = await bukaPopup();
    const halaman = (nama: string, badan: string) =>
      writeFileSync(
        path.join(dir, `${nama}.html`),
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com/3.4.1"></script>
<style>:root{--card:#fff}.bg-card{background:#fff}.bg-muted{background:#f1f5f9}.text-muted-foreground{color:#64748b}.border-border,.border{border-color:#e2e8f0}.bg-primary{background:#0f172a}.text-primary-foreground{color:#fff}.text-card-foreground{color:#0f172a}.hover\\:bg-muted:hover{background:#f1f5f9}body{font-family:system-ui,sans-serif}</style></head><body class="bg-slate-100">${badan}</body></html>`
      );
    const bungkus = (isi: string) => `<div class="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4">${isi}</div>`;
    const baris = `<div class="p-4 max-w-md"><div class="mb-2 flex flex-wrap gap-1"><span class="rounded bg-amber-700 px-1.5 py-0.5 text-xs font-medium text-amber-50">Hari Putusan</span></div>${container.innerHTML}</div>`;
    halaman("00-baris", baris);
    for (const kode of ["ringkasan", "otomatis", "perlu", "bahan", "selesai"]) {
      await klikTahap(dialog, kode);
      if (kode === "bahan") dialog.querySelectorAll("[data-kartu-bahan]").forEach((k, i) => i < 1 && k.setAttribute("open", ""));
      halaman(`tahap-${kode}`, baris + bungkus(dialog.outerHTML));
    }
  });
});
