import { pecahNaskahResmi } from "@/lib/naskah-putusan-resmi";
import { usulkanMedanPutusan, type MedanPilihan, type UsulanMedan } from "@/lib/usulan-medan-putusan";

/**
 * ============================================================================
 * RINGKASAN PILIHAN FORM PUTUSAN AKHIR - UNTUK DIPERIKSA SEBELUM DIJADWALKAN (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * "Formnya langsung dibenarkan semua pilihannya": sebelum jadwal dibuat, petugas
 * melihat pilihan formulir Putusan Akhir yang AKAN dipilih ALETA, dengan aturan
 * yang SAMA dengan Putusan Otomatis (usulkanMedanPutusan: status putusan dan
 * verstek dibaca dari AMAR naskah lebih dulu), dan boleh menetapkannya sendiri.
 *
 * BATAS JUJUR. Daftar pilihan yang sesungguhnya hanya ada di formulir SIPP yang
 * terbuka (SIPP menyaringnya menurut jenis perkara dan alur). Di sini status
 * putusan dicocokkan dengan status yang dipakai satker (dari data SIPP), jadi
 * hasilnya PERKIRAAN: saat dijalankan, ekstensi mencocokkan ulang dengan
 * pilihan yang tampil di formulir, dan praperiksa tetap menahan Simpan bila
 * naskah bertentangan dengan fakta SIPP. Pilihan yang ditetapkan petugas dipasang
 * lebih dulu di formulir; ALETA hanya menggantinya bila naskah menyebut
 * sebaliknya dengan tegas (kontrak K9: nilai yang sudah terpilih dihormati).
 *
 * Murni: tidak menyentuh basis data, SIPP, maupun jaringan.
 */

export type PerkiraanPilihan = {
  /** Teks pilihan, "" bila ALETA tidak menebak. */
  label: string;
  keyakinan: UsulanMedan["keyakinan"];
  /** Kalimat naskah yang menjadi dasarnya. */
  kutipan: string;
  alasan: string;
};

export type RingkasanForm = {
  ada: boolean;
  sebab: string;
  status: PerkiraanPilihan | null;
  verstek: PerkiraanPilihan | null;
};

const dariUsulan = (u: UsulanMedan | undefined): PerkiraanPilihan | null =>
  u
    ? {
        label: u.nilaiLabel || "",
        keyakinan: u.keyakinan,
        kutipan: String(u.kutipan ?? "").slice(0, 300),
        alasan: String(u.alasan ?? "").slice(0, 300),
      }
    : null;

export function susunRingkasanForm(teks: string, jenisPerkara: string, statusNama: string[]): RingkasanForm {
  const naskah = String(teks ?? "");
  if (!naskah.trim()) return { ada: false, sebab: "Isi berkas belum dapat dibaca sekarang; pilihan form ditentukan saat dijalankan.", status: null, verstek: null };
  const { bagian } = pecahNaskahResmi(naskah);
  if (!bagian.amar) {
    return { ada: false, sebab: "Amar tidak dapat dipotong dari naskah ini, jadi pilihan form tidak dapat diperkirakan.", status: null, verstek: null };
  }
  const dasar = [bagian.pertimbangan ?? "", bagian.dudukPerkara ?? ""].filter(Boolean).join("\n\n");
  const medan: MedanPilihan[] = [
    {
      kunci: 'select[name="status_putusan"]',
      label: "Status Putusan",
      pilihan: [...new Set(statusNama.map((x) => String(x).trim()).filter(Boolean))].map((nama) => ({ nilai: nama, label: nama })),
    },
    {
      kunci: 'select[name="verstek"]',
      label: "Putusan Verstek",
      pilihan: [
        { nilai: "Y", label: "Ya" },
        { nilai: "T", label: "Tidak" },
      ],
    },
  ];
  const usulan = usulkanMedanPutusan(dasar, medan, { jenisPerkara, amar: bagian.amar, pertimbangan: bagian.pertimbangan ?? "" });
  return {
    ada: true,
    sebab: "",
    status: dariUsulan(usulan.find((u) => u.kunci === medan[0].kunci)),
    verstek: dariUsulan(usulan.find((u) => u.kunci === medan[1].kunci)),
  };
}
