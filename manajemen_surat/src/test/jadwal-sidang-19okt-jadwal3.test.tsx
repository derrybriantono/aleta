/**
 * JADWAL-3 (19 Okt 2026): pencarian pintar, tombol Tampilan di sudut kanan,
 * saksi terlipat, tanpa tulisan memuat, dialog mediator tanpa keterangan teknis.
 * Nomor perkara dan nama di sini karangan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { PetunjukCariPintar } from "@/components/portal/petunjuk-cari-pintar";
import { SaksiLipat } from "@/components/portal/saksi-lipat";
import {
  KATA_KUNCI_MEDIASI,
  KATA_KUNCI_SIDANG,
  MEDAN_MEDIASI,
  MEDAN_SIDANG,
  cocokCariPintar,
  uraiCariPintar,
  uraianKosong,
} from "@/lib/cari-pintar-jadwal";
import { alihSaksiLipat, bacaSaksiLipat, kunciBarisSaksi, kunciSimpananSaksiLipat, saksiTerbuka } from "@/lib/saksi-lipat";
import { SAKLAR_TAMPILAN, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";

const SRC = path.join(process.cwd(), "src");
const baca = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const LAYAR_SIDANG = baca("components/portal/aleta-ecourt-sidang.tsx");
const LAYAR_MEDIASI = baca("components/portal/aleta-ecourt-mediasi.tsx");

const urai = (t: string) => uraiCariPintar(t, KATA_KUNCI_SIDANG, MEDAN_SIDANG);

describe("butir 1: pencarian pintar - mengurai ketikan", () => {
  it("mengenali kata kunci keadaan, frasa terpanjang dahulu", () => {
    expect(urai("ghaib").kunci).toEqual(["ghaib"]);
    expect(urai("Gaib, verstek").kunci).toEqual(["ghaib", "verstek"]);
    expect(urai("potensi verstek").kunci).toEqual(["potensi-verstek"]);
    expect(urai("belum ditunda").kunci).toEqual(["belum-tunda"]);
    expect(urai("ditunda").kunci).toEqual(["ditunda"]);
    expect(urai("tidak hadir").kunci).toEqual(["tidak-hadir"]);
    expect(urai("hadir").kunci).toEqual(["hadir"]);
    expect(urai("belum ada konseptor").kunci).toEqual(["belum-konseptor"]);
    expect(urai("deteksi konseptor").kunci).toEqual(["konseptor-sementara"]);
    expect(urai("konseptor").kunci).toEqual(["konseptor"]);
    expect(urai("e-Litigasi sidang pertama belum BAS belum minutasi hari putusan ikrar talak").kunci).toEqual([
      "e-litigasi",
      "sidang-pertama",
      "belum-bas",
      "belum-minutasi",
      "hari-putusan",
      "ikrar-talak",
    ]);
    expect(urai("menunggu").kunci).toEqual(["menunggu"]);
    expect(urai("sedang disidang").kunci).toEqual(["sedang"]);
    expect(urai("selesai").kunci).toEqual(["selesai"]);
  });

  it("kata kunci tidak dikenali di dalam kata lain; sisa ketikan tetap utuh", () => {
    const h = urai("Ghaibah binti Ahmad");
    expect(h.kunci).toEqual([]);
    expect(h.sisa).toBe("Ghaibah binti Ahmad");
    expect(urai("521/Pdt.G/2026 ghaib").sisa).toBe("521/Pdt.G/2026");
  });

  it("medan nama: hakim/pp/js/mediator/saksi/kuasa/konseptor, nilai sampai medan berikutnya", () => {
    const h = urai("hakim: Ahmad Fauzi pp: Rina saksi:wiwi");
    expect(h.medan).toEqual({ hakim: ["ahmad fauzi"], pp: ["rina"], saksi: ["wiwi"] });
    expect(h.sisa).toBe("");
    expect(urai("ghaib mediator: Budi").medan).toEqual({ mediator: ["budi"] });
    expect(urai("ghaib mediator: Budi").kunci).toEqual(["ghaib"]);
    // "konseptor:" adalah medan, bukan kata kunci
    const k = urai("konseptor: Siti");
    expect(k.kunci).toEqual([]);
    expect(k.medan).toEqual({ konseptor: ["siti"] });
    expect(uraianKosong(urai("   "))).toBe(true);
  });

  it("mediasi punya kata kunci sendiri", () => {
    const m = uraiCariPintar("lewat tenggang mediator: budi tidak berhasil", KATA_KUNCI_MEDIASI, MEDAN_MEDIASI);
    expect(m.medan).toEqual({ mediator: ["budi tidak berhasil"] });
    const m2 = uraiCariPintar("tidak berhasil lewat tenggang", KATA_KUNCI_MEDIASI, MEDAN_MEDIASI);
    expect(m2.kunci).toEqual(["lewat-tenggang", "tidak-berhasil"]);
    expect(uraiCariPintar("berhasil", KATA_KUNCI_MEDIASI, MEDAN_MEDIASI).kunci).toEqual(["berhasil"]);
  });
});

describe("butir 1: pencarian pintar - menyaring", () => {
  type B = { nomor: string; ghaib: boolean; hakim: string; teks: string };
  const daftar: B[] = [
    { nomor: "1/Pdt.G/2026/PA.Dgl", ghaib: true, hakim: "Ahmad Fauzi", teks: "1/Pdt.G/2026/PA.Dgl Cerai Gugat Siti" },
    { nomor: "2/Pdt.G/2026/PA.Dgl", ghaib: false, hakim: "Ahmad Fauzi", teks: "2/Pdt.G/2026/PA.Dgl Cerai Talak Budi" },
    { nomor: "3/Pdt.G/2026/PA.Dgl", ghaib: true, hakim: "Rahmat", teks: "3/Pdt.G/2026/PA.Dgl Harta Bersama Siti" },
  ];
  const opsi = {
    predikat: { ghaib: (b: B) => b.ghaib },
    nilaiMedan: { hakim: (b: B) => b.hakim },
    teksBebas: (b: B) => b.teks,
  };
  const saring = (t: string) => daftar.filter((b) => cocokCariPintar(b, urai(t), opsi)).map((b) => b.nomor[0]);

  it("kata kunci, medan, dan kata bebas digabung dengan 'dan'", () => {
    expect(saring("ghaib")).toEqual(["1", "3"]);
    expect(saring("ghaib hakim: ahmad")).toEqual(["1"]);
    expect(saring("siti")).toEqual(["1", "3"]);
    expect(saring("cerai siti")).toEqual(["1"]);
    expect(saring("ghaib harta")).toEqual(["3"]);
  });

  it("kata kunci yang predikatnya tidak disediakan tidak mengosongkan daftar", () => {
    expect(saring("verstek")).toEqual(["1", "2", "3"]);
  });
});

describe("butir 1: kedua layar memakai pencarian pintar; Enter ke SIPP tetap", () => {
  it("Jadwal Sidang: urai + saring + petunjuk; Enter mengirim sisa saja", () => {
    expect(LAYAR_SIDANG).toContain("uraiCariPintar(cariCepat, KATA_KUNCI_SIDANG, MEDAN_SIDANG)");
    expect(LAYAR_SIDANG).toContain("cocokCariPintar(b, uraiCari, opsiCari)");
    expect(LAYAR_SIDANG).toContain("<PetunjukCariPintar");
    expect(LAYAR_SIDANG).toContain('if (peristiwa.key === "Enter") kirimCariKeSipp();');
    expect(LAYAR_SIDANG).toContain("const kirim = uraiCariPintar(cariCepat, KATA_KUNCI_SIDANG, MEDAN_SIDANG).sisa;");
    // predikat keadaan memakai aturan kotak keadaan yang sama
    for (const k of ["potensi-verstek", "e-litigasi", "sidang-pertama", "belum-bas", "belum-tunda", "belum-minutasi", "hari-putusan", "ikrar-talak"]) {
      expect(LAYAR_SIDANG, k).toContain(`keadaan("${k}")`);
    }
    // pencarian lanjutan juga mengenal saksi dan mediator
    expect(LAYAR_SIDANG).toContain('{ kunci: "saksi", label: "Nama saksi"');
    expect(LAYAR_SIDANG).toContain('{ kunci: "mediator", label: "Mediator"');
  });

  it("Jadwal Mediasi: saringan pintar + petunjuk; kotak Cari SIPP menerima Enter", () => {
    expect(LAYAR_MEDIASI).toContain("uraiCariPintar(cariCepat, KATA_KUNCI_MEDIASI, MEDAN_MEDIASI)");
    expect(LAYAR_MEDIASI).toContain("cocokCariPintar(baris, uraiCari, opsi)");
    expect(LAYAR_MEDIASI).toContain("<PetunjukCariPintar");
    expect(LAYAR_MEDIASI).toContain('if (e.key === "Enter") void muatRentang(dari, sampai, cari);');
  });

  it("petunjuk tampil saat fokus, menyebut kata kunci yang berlaku, dan menekan kata kunci menambahkannya", () => {
    const pilih = vi.fn();
    const { container, rerender } = render(
      createElement(PetunjukCariPintar, {
        terbuka: false,
        kataKunci: KATA_KUNCI_SIDANG,
        medan: MEDAN_SIDANG,
        contohMedan: ["hakim: nama"],
        urai: urai("ghaib hakim: ahmad"),
        onPilih: pilih,
        enterKeSipp: true,
      })
    );
    expect(container.querySelector("[data-petunjuk-cari-pintar]")).toBeNull();
    rerender(
      createElement(PetunjukCariPintar, {
        terbuka: true,
        kataKunci: KATA_KUNCI_SIDANG,
        medan: MEDAN_SIDANG,
        contohMedan: ["hakim: nama"],
        urai: urai("ghaib hakim: ahmad"),
        onPilih: pilih,
        enterKeSipp: true,
      })
    );
    const kotak = container.querySelector("[data-petunjuk-cari-pintar]")!;
    expect(kotak.querySelector("[data-cari-berlaku]")?.textContent).toContain("ghaib");
    expect(kotak.querySelector("[data-cari-berlaku]")?.textContent).toContain("hakim: ahmad");
    expect(kotak.textContent).toContain("Enter mencari ke SIPP");
    const tombol = Array.from(kotak.querySelectorAll("button")).find((b) => b.textContent === "belum BAS")!;
    fireEvent.click(tombol);
    expect(pilih).toHaveBeenCalledWith("belum ada bas");
  });
});

describe("butir 2: tombol Tampilan paling kanan", () => {
  it("Jadwal Sidang: sesudah Ciutkan, tepat sebelum kelompok tombol ditutup", () => {
    const tampilan = LAYAR_SIDANG.indexOf("data-tombol-tampilan-sidang");
    const ciutkan = LAYAR_SIDANG.indexOf('{kendaliCiut ? "Kendali" : "Ciutkan"}');
    const ringkas = LAYAR_SIDANG.indexOf("onClick={() => pilihModeRingkas(true)}");
    expect(ciutkan).toBeGreaterThan(ringkas);
    expect(tampilan).toBeGreaterThan(ciutkan);
    const sesudah = LAYAR_SIDANG.slice(tampilan, LAYAR_SIDANG.indexOf("</CardHeader>", tampilan));
    // tidak ada tombol lain sesudahnya di kepala
    expect(sesudah.match(/<button/g)?.length ?? 0).toBe(0);
  });

  it("Jadwal Mediasi: satu baris kepala, Tampilan sesudah Pengaturan panggil", () => {
    const kepala = LAYAR_MEDIASI.slice(LAYAR_MEDIASI.indexOf("<CardHeader>"), LAYAR_MEDIASI.indexOf("</CardHeader>"));
    const judul = kepala.indexOf("Jadwal mediasi</CardTitle>");
    const panggil = kepala.indexOf("<PengaturanPanggil />");
    const tampilan = kepala.indexOf("data-tampilan-mediasi");
    expect(judul).toBeGreaterThan(-1);
    expect(panggil).toBeGreaterThan(judul);
    expect(tampilan).toBeGreaterThan(panggil);
    expect(kepala).toContain('<CardTitle className="mr-auto">');
  });
});

describe("butir 4: nama saksi terlipat", () => {
  it("saklar baru terdaftar, menyala bawaan (= terlipat), di kelompok keterangan, dipakai layar", () => {
    const s = SAKLAR_TAMPILAN.find((x) => x.kunci === "saksi-lipat");
    expect(s?.kelompok).toBe("keterangan");
    expect(s?.bawaanMati ?? false).toBe(false);
    expect(tampilanBawaan()["saksi-lipat"]).toBe(true);
    expect(LAYAR_SIDANG).toContain('useSaksiLipat(currentUser?.id, !tampil(tampilan, "saksi-lipat"))');
    expect(LAYAR_SIDANG.match(/<SaksiLipat\b/g)?.length).toBe(2);
  });

  it("pilihan per baris: hanya yang berbeda dari bawaan disimpan, per akun", () => {
    const k = kunciBarisSaksi("901", "P");
    expect(saksiTerbuka({}, k, false)).toBe(false);
    const buka = alihSaksiLipat({}, k, false);
    expect(buka).toEqual({ "901|P": true });
    expect(saksiTerbuka(buka, k, false)).toBe(true);
    expect(alihSaksiLipat(buka, k, false)).toEqual({});
    expect(kunciSimpananSaksiLipat(7)).not.toBe(kunciSimpananSaksiLipat(8));
    expect(bacaSaksiLipat('{"901|P":true,"x":true,"902|T":"ya"}')).toEqual({ "901|P": true });
    expect(bacaSaksiLipat("rusak")).toEqual({});
  });

  it("terlipat menampilkan jumlah saja; ditekan = nama terbentang", () => {
    const alih = vi.fn();
    const { container, rerender } = render(
      createElement(SaksiLipat, { label: "Saksi P", jumlah: 2, terbuka: false, onAlih: alih, namaRingkas: "Moh A, Wiwi B" }, "Moh A, Wiwi B")
    );
    expect(container.textContent).toBe("Saksi P (2) ");
    expect(container.querySelector("[data-saksi-lipat]")?.getAttribute("data-saksi-lipat")).toBe("terlipat");
    fireEvent.click(container.querySelector("button")!);
    expect(alih).toHaveBeenCalledTimes(1);
    rerender(createElement(SaksiLipat, { label: "Saksi P", jumlah: 2, terbuka: true, onAlih: alih, namaRingkas: "Moh A, Wiwi B" }, "Moh A, Wiwi B"));
    expect(container.textContent).toContain("Saksi P (2):");
    expect(container.textContent).toContain("Moh A, Wiwi B");
  });
});

describe("butir 5: tanpa tulisan memuat di Jadwal Sidang dan Jadwal Mediasi", () => {
  const BERKAS = [
    "components/portal/aleta-ecourt-sidang.tsx",
    "components/portal/aleta-ecourt-mediasi.tsx",
    "components/portal/jadwal-sidang-1okt.tsx",
    "components/portal/jadwal-sidang-2okt.tsx",
    "components/portal/panggil-petugas.tsx",
    "components/portal/panggil-saksi.tsx",
    "components/portal/checklist-konseptor.tsx",
    "components/portal/draf-h7.tsx",
    "components/portal/court-calendar-sidang.tsx",
    "components/portal/hasil-mediasi-dialog.tsx",
    "components/portal/kasir-jurnal.tsx",
    "components/portal/kasir-otomatis.tsx",
    "components/portal/panduan-pemeriksaan-saksi.tsx",
    "components/portal/ecourt-aksi-perkara.tsx",
  ];
  it("tidak ada 'Memuat…', 'memuat…', atau 'Membaca …' yang digambar", () => {
    for (const rel of BERKAS) {
      const isi = baca(rel)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
        .join("\n");
      expect(isi, rel).not.toMatch(/"Memuat…"|"memuat…"|>\s*Memuat [^<{]*…|>\s*Membaca [^<{]*…|"Membaca [^"]*…"|Memuat kalender…|Menghitung…/);
    }
  });

  it("penyegaran latar tidak mengubah tombol Tampilkan; muatan pertama tetap memesan ruang", () => {
    expect(LAYAR_SIDANG).not.toMatch(/<Button size="sm" disabled=\{memuat\} onClick=\{\(\) => void muat\(\)\}>/);
    expect(LAYAR_SIDANG).toContain('<tr aria-busy="true" data-tabel-menunggu="">');
    expect(LAYAR_SIDANG).toContain("{pertamaMuat && memuat ? (");
    expect(LAYAR_MEDIASI).not.toContain("disabled={memuat}");
  });
});

describe("butir 6: dialog pilih mediator tanpa keterangan teknis", () => {
  const SATU_OKT = baca("components/portal/jadwal-sidang-1okt.tsx");
  it("judul singkat, tanpa 'Muncul karena', tanpa jam antrian di title", () => {
    expect(SATU_OKT).toContain("Penetapan mediator · {baris.nomorPerkara}");
    expect(SATU_OKT).not.toContain("Muncul karena");
    expect(SATU_OKT).not.toContain("sidang ini berurusan dengan mediasi (");
    expect(SATU_OKT).toContain('title="Pilih mediator untuk perkara ini"');
    expect(SATU_OKT).not.toContain("mengikuti tanggal penetapan, seperti SIPP");
  });
  it("catatan kaki satu kalimat awam", () => {
    expect(LAYAR_SIDANG).toContain('catatan="Jadwal pertemuan, laporan mediator, dan hasil mediasi masih ditulis di SIPP."');
    expect(LAYAR_SIDANG).not.toContain("belum ada jalur yang menuliskannya");
  });
});
