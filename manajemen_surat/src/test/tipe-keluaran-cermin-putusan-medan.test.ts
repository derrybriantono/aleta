// @vitest-environment node

import { describe, expect, it } from "vitest";

import { CERMIN_PUTUSAN_MEDAN } from "@/lib/tipe-keluaran/bawaan/bawaan-putusan-medan";
import { cerminSebagaiEntri, gabungEfektif, sidik, type BarisGabung } from "@/lib/tipe-keluaran/gabung";
import { DAFTAR_TIPE, type EntriCermin, type KunciDaftar } from "@/lib/tipe-keluaran/kontrak";
import { validasiEntri } from "@/lib/tipe-keluaran/validasi";
import {
  BAWAAN_MENURUT_PERKARA,
  SEBUTAN_LAIN,
  usulkanMedanPutusan,
  type MedanPilihan,
  type TipeUsulanMedan,
} from "@/lib/usulan-medan-putusan";

/**
 * ============================================================================
 * CERMIN putusan.sumber-hukum.sebutan DAN putusan.bawaan-medan = SUMBERNYA
 * ============================================================================
 *
 * Kontrak K10: cermin bawaan disalin PERSIS dari konstanta yang dipakai kode,
 * dan ujinya MENGIMPOR sumber aslinya - bukan membaca teksnya. Lalu bagian yang
 * paling penting bagi pengguna: dengan cermin itu sebagai daftar efektif
 * (tabel kosong atau tak terbaca), usulkanMedanPutusan menghasilkan keluaran
 * yang SAMA PERSIS dengan tanpa daftar sama sekali.
 */

const SEBUTAN = "putusan.sumber-hukum.sebutan" as const;
const BAWAAN = "putusan.bawaan-medan" as const;

const SUMBER: MedanPilihan = {
  kunci: 'input[name="sumber_hukum[]"]',
  label: "Sumber Hukum",
  banyak: true,
  pilihan: [
    { nilai: "10", label: "Fiqh Islam" },
    { nilai: "9", label: "Kompilasi Hukum Ekonomi Syariah" },
    { nilai: "8", label: "Kompilasi Hukum Islam" },
    { nilai: "13", label: "Qanun Aceh" },
    { nilai: "11", label: "UU/PP" },
    { nilai: "16", label: "Yurisprudensi" },
  ],
};
const KEADAAN: MedanPilihan = {
  kunci: 'select[name="keadaan_istri"]',
  label: "Keadaan Istri",
  pilihan: [
    { nilai: "", label: "Pilih Keadaan Istri" },
    { nilai: "1", label: "Suci" },
    { nilai: "2", label: "Haid" },
    { nilai: "3", label: "Hamil" },
    { nilai: "4", label: "Tidak diketahui" },
  ],
};

/** Naskah uji: kalimat Mengingat yang lazim, dan kalimat tanpa sumber hukum. */
const NASKAH = [
  "Mengingat Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, Kompilasi Hukum Islam, serta peraturan perundang-undangan lain dan hukum syar'i yang berkaitan dengan perkara ini;",
  "Menimbang, bahwa sesuai Putusan Mahkamah Agung Nomor xxx K/AG/2019 rumah tangga yang telah pecah tidak dapat dipertahankan; Pasal 116 huruf (f) KHI;",
  "Menimbang, bahwa rumah tangga Penggugat dan Tergugat tidak harmonis lagi;",
  "Menimbang, bahwa Penggugat saat ini sedang hamil;",
  "Menimbang, bahwa menurut kitab fiqh dan fikih munakahat perkawinan dapat diputus;",
];
const JENIS = ["Cerai Gugat", "Cerai Talak", "Dispensasi Kawin", ""];

function efektif(daftar: KunciDaftar, baris: BarisGabung[] = [], asal: "bawaan" | "cermin" = "bawaan") {
  const cermin = CERMIN_PUTUSAN_MEDAN[daftar as keyof typeof CERMIN_PUTUSAN_MEDAN] as EntriCermin[];
  return asal === "cermin" ? cerminSebagaiEntri(daftar, cermin, "cermin") : gabungEfektif(daftar, cermin, baris).entri;
}

function tambahan(daftar: KunciDaftar, kunci: string, nilai: string, data: Record<string, unknown> = {}): BarisGabung {
  return {
    id: `uji-${kunci}-${nilai}`,
    asal: "tambahan",
    sidik: sidik(daftar, kunci, nilai, data),
    aktif: true,
    keadaan: "disahkan",
    kunci,
    nilai,
    data,
    urutan: 100,
    dibuatAt: "2026-09-26T00:00:00.000Z",
  };
}

function semuaUsulan(tipe?: TipeUsulanMedan) {
  const hasil: unknown[] = [];
  for (const naskah of NASKAH) {
    for (const jenisPerkara of JENIS) {
      hasil.push(usulkanMedanPutusan(naskah, [SUMBER, KEADAAN], tipe ? { jenisPerkara, tipe } : { jenisPerkara }));
    }
  }
  return hasil;
}

describe("cermin = konstanta sumbernya (diimpor, bukan dibaca teksnya)", () => {
  it("putusan.sumber-hukum.sebutan = SEBUTAN_LAIN, urutan kemunculan", () => {
    const dariSumber = Object.entries(SEBUTAN_LAIN)
      .flatMap(([kunci, daftar]) => daftar.map((nilai) => ({ kunci, nilai })))
      .map((x, urutan) => ({ ...x, urutan }));
    expect(CERMIN_PUTUSAN_MEDAN[SEBUTAN]).toEqual(dariSumber);
    expect(dariSumber).toHaveLength(15);
  });

  it("putusan.bawaan-medan = BAWAAN_MENURUT_PERKARA", () => {
    const dariSumber = BAWAAN_MENURUT_PERKARA.map((x, urutan) => ({
      kunci: x.medan,
      nilai: x.nilai,
      data: { jenisPerkara: x.jenisPerkara },
      urutan,
    }));
    expect(CERMIN_PUTUSAN_MEDAN[BAWAAN]).toEqual(dariSumber);
  });

  it("hanya memuat daftar yang registrinya menunjuk CERMIN_PUTUSAN_MEDAN - dan semuanya", () => {
    const milik = (Object.keys(DAFTAR_TIPE) as KunciDaftar[]).filter((k) => DAFTAR_TIPE[k].pemilikCermin === "CERMIN_PUTUSAN_MEDAN");
    expect(Object.keys(CERMIN_PUTUSAN_MEDAN).sort()).toEqual(milik.sort());
  });

  it("tiap entri cermin lolos validasi daftarnya", () => {
    for (const daftar of [SEBUTAN, BAWAAN] as const) {
      for (const e of CERMIN_PUTUSAN_MEDAN[daftar] as EntriCermin[]) {
        const v = validasiEntri(daftar, { kunci: e.kunci, nilai: e.nilai, data: e.data ?? {} });
        expect(v.ok ? [] : v.alasan, `${daftar} ${e.kunci}=${e.nilai}`).toEqual([]);
      }
    }
  });
});

describe("tabel kosong atau tak terbaca: keluaran SAMA PERSIS dengan konstanta", () => {
  const tanpaTipe = semuaUsulan();

  it("daftar efektif = cermin (asal 'bawaan')", () => {
    expect(semuaUsulan({ [SEBUTAN]: efektif(SEBUTAN), [BAWAAN]: efektif(BAWAAN) })).toEqual(tanpaTipe);
  });

  it("basis data tak terbaca (asal 'cermin')", () => {
    expect(semuaUsulan({ [SEBUTAN]: efektif(SEBUTAN, [], "cermin"), [BAWAAN]: efektif(BAWAAN, [], "cermin") })).toEqual(
      tanpaTipe
    );
  });

  it("daftar yang tidak dikirim (null) memakai konstanta", () => {
    expect(semuaUsulan({ [SEBUTAN]: null, [BAWAAN]: null })).toEqual(tanpaTipe);
  });
});

describe("tambahan satker yang disahkan hanya mengubah yang relevan", () => {
  it("sebutan baru: 'putusan ma ri' menandai Yurisprudensi hanya pada naskah yang menyebutnya", () => {
    const tipe = { [SEBUTAN]: efektif(SEBUTAN, [tambahan(SEBUTAN, "yurisprudensi", "putusan ma ri")]) };
    const naskah = "Menimbang, bahwa sesuai Putusan MA RI Nomor xxx rumah tangga yang pecah tidak dapat dipertahankan;";
    const tanpa = usulkanMedanPutusan(naskah, [SUMBER], {})[0];
    const dengan = usulkanMedanPutusan(naskah, [SUMBER], { tipe })[0];
    expect((tanpa.nilaiBanyak ?? []).map((x) => x.label)).not.toContain("Yurisprudensi");
    expect((dengan.nilaiBanyak ?? []).map((x) => x.label)).toContain("Yurisprudensi");
    // Naskah lain tidak berubah.
    for (const lain of NASKAH) {
      expect(usulkanMedanPutusan(lain, [SUMBER], { tipe })).toEqual(usulkanMedanPutusan(lain, [SUMBER], {}));
    }
  });

  it("bawaan keadaan istri cerai gugat 'Tidak diketahui': hanya cerai gugat yang berubah, bersumber 'bawaan-satker'", () => {
    const tipe = {
      [BAWAAN]: efektif(BAWAAN, [tambahan(BAWAAN, "Keadaan Istri", "Tidak diketahui", { jenisPerkara: "gugat" })]),
    };
    const naskah = "Menimbang, bahwa rumah tangga Penggugat dan Tergugat tidak harmonis lagi;";
    const gugat = usulkanMedanPutusan(naskah, [KEADAAN], { jenisPerkara: "Cerai Gugat", tipe })[0];
    expect(gugat.nilaiLabel).toBe("Tidak diketahui");
    expect(gugat.sumberUsulan).toBe("bawaan-satker");
    expect(gugat.keyakinan).toBe("cukup");
    const talak = usulkanMedanPutusan(naskah, [KEADAAN], { jenisPerkara: "Cerai Talak", tipe })[0];
    expect(talak).toEqual(usulkanMedanPutusan(naskah, [KEADAAN], { jenisPerkara: "Cerai Talak" })[0]);
    // Frasa tegas tetap mengalahkan bawaan satker.
    const hamil = usulkanMedanPutusan("Menimbang, bahwa Penggugat saat ini sedang hamil;", [KEADAAN], { jenisPerkara: "Cerai Gugat", tipe })[0];
    expect(hamil.nilaiLabel).toBe("Hamil");
  });

  it("bawaan yang DIMATIKAN hilang dari daftar efektif, dan keluarannya ikut berubah", () => {
    const talakCermin = (CERMIN_PUTUSAN_MEDAN[BAWAAN] as EntriCermin[])[1];
    const mati: BarisGabung = {
      ...tambahan(BAWAAN, talakCermin.kunci, talakCermin.nilai, talakCermin.data),
      id: "uji-mati",
      asal: "bawaan",
      aktif: false,
    };
    const daftar = efektif(BAWAAN, [mati]);
    expect(daftar.map((x) => x.nilai)).toEqual(["Suci"]);
    const naskah = "Menimbang, bahwa rumah tangga Pemohon dan Termohon tidak harmonis lagi;";
    const u = usulkanMedanPutusan(naskah, [KEADAAN], { jenisPerkara: "Cerai Talak", tipe: { [BAWAAN]: daftar } })[0];
    expect(u.nilaiLabel).not.toBe("Tidak diketahui");
    expect(u.keyakinan).not.toBe("pasti");
  });
});
