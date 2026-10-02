import { keadaanUntukGolongan } from "@/lib/pohon-blangko";
import {
  AWALAN_KUNCI_BAS_DB,
  pilihKunciRelaas,
  type KeadaanKunci,
  type PermintaanRelaas,
  type PihakKunci,
} from "@/lib/pemetaan-blangko";

/**
 * ============================================================================
 * PEMETAAN BLANGKO ADMIN UNTUK TOMBOL CETAK RELAAS DI PORTAL (2 Okt sore, butir 1)
 * ============================================================================
 *
 * Tab Juru Sita ekstensi sudah memakai Pemetaan blangko admin, tetapi tombol
 * "Cetak relaas" di Jadwal Sidang masih memakai BLANGKO_RELAAS bawaan - dua
 * tempat yang mencetak dokumen yang sama dapat memilih berkas yang BERBEDA.
 * Di sini nama berkas dari pemetaan admin (petaPemetaanBerlaku = admin di atas
 * bawaan) dipilih dengan pemilih kunci yang SAMA dengan ekstensi
 * (pilihKunciRelaas): kunci paling khusus menang - keadaan + pihak khusus
 * (pemohon/termohon) di atas pihak umum (penggugat/tergugat), di atas kunci
 * tanpa pihak.
 *
 * Yang tidak diubah: dokumen yang blangko bawaannya tidak ada atau tidak dapat
 * dicetak tetap dinilai seperti sebelumnya (sebabnya tidak ditimpa), dan
 * keadaan delegasi/amplop tetap dari bawaan.
 */

type DokumenPetakan = {
  golongan: unknown;
  pihakDipanggil: unknown;
  alurPerkaraId?: unknown;
  sebutanPihak?: { pertama?: unknown; kedua?: unknown } | null;
};

function sebutanKhusus(teks: unknown): PihakKunci {
  const t = String(teks ?? "").toLowerCase();
  if (/termohon/.test(t)) return "termohon";
  if (/pemohon/.test(t)) return "pemohon";
  if (/tergugat/.test(t)) return "tergugat";
  if (/penggugat/.test(t)) return "penggugat";
  return "";
}

/** Permintaan kunci untuk satu dokumen; null = keadaan yang tidak dipetakan admin. */
export function permintaanUntukDokumen(dokumen: DokumenPetakan): PermintaanRelaas | null {
  const keadaan = keadaanUntukGolongan(dokumen.golongan);
  let awalan: PermintaanRelaas["awalan"];
  let k: KeadaanKunci;
  if (keadaan === "sidang-pertama") [awalan, k] = ["panggilan", "pertama"];
  else if (keadaan === "sidang-ditunda") [awalan, k] = ["panggilan", "lanjutan"];
  else if (keadaan === "ikrar-talak") [awalan, k] = ["panggilan", "ikrar"];
  else if (keadaan === "pemberitahuan-putusan") [awalan, k] = ["pbt", ""];
  else return null;

  const pihak = String(dokumen.pihakDipanggil ?? "");
  if (pihak !== "pertama" && pihak !== "kedua") return { awalan, keadaan: k, khusus: "", umum: "" };
  const umum: PihakKunci = pihak === "pertama" ? "penggugat" : "tergugat";
  const dariSebutan = sebutanKhusus(dokumen.sebutanPihak ? dokumen.sebutanPihak[pihak] : "");
  const alurPermohonan = Number(dokumen.alurPerkaraId) === 16;
  const khusus: PihakKunci =
    dariSebutan === "pemohon" || dariSebutan === "termohon"
      ? dariSebutan
      : alurPermohonan
        ? pihak === "pertama"
          ? "pemohon"
          : "termohon"
        : umum;
  return { awalan, keadaan: k, khusus, umum };
}

/**
 * Nama berkas dari pemetaan admin untuk dokumen ini, atau null bila tidak ada
 * kunci yang cocok (maka blangko bawaan dipakai apa adanya).
 */
export function blangkoMenurutPemetaan(
  dokumen: DokumenPetakan,
  petaRelaas: Record<string, string>,
  petaPbt: Record<string, string>
): { berkas: string; kunci: string } | null {
  const minta = permintaanUntukDokumen(dokumen);
  if (!minta) return null;
  const peta = minta.awalan === "pbt" ? petaPbt : petaRelaas;
  const kunciDaftar = Object.keys(peta).filter((x) => !x.startsWith(AWALAN_KUNCI_BAS_DB) && String(peta[x] || "").trim());
  const kunci = pilihKunciRelaas(kunciDaftar, minta);
  if (!kunci) return null;
  return { berkas: String(peta[kunci]).trim(), kunci };
}
