import { blangkoRelaasPerPihak, keadaanUntukGolongan } from "@/lib/pohon-blangko";
import {
  AWALAN_KUNCI_BAS_DB,
  pilihKunciRelaas,
  uraiKunciRelaas,
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
  /** Q3 16 Okt: perkara terdaftar lewat e-Court / putusannya verstek (bot relaasMassalService); kosong = tidak diketahui (perilaku lama). */
  lewatEcourt?: unknown;
  verstekPutusan?: unknown;
};

/** Q3 16 Okt: opsi pemilihan blangko e-Court dari dokumen. */
export function opsiEcourtDokumen(dokumen: Pick<DokumenPetakan, "lewatEcourt" | "verstekPutusan">) {
  return { lewatEcourt: dokumen.lewatEcourt === true, verstek: dokumen.verstekPutusan === true };
}

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
  // 14 Okt: pengumuman itsbat - pihakDipanggil "pertama" = satu Pemohon (1P).
  if (keadaan === "pengumuman-itsbat") {
    return { awalan: "pengumuman", keadaan: String(dokumen.pihakDipanggil ?? "") === "pertama" ? "1p" : "2p", khusus: "", umum: "" };
  }
  let awalan: PermintaanRelaas["awalan"];
  let k: KeadaanKunci;
  if (keadaan === "sidang-pertama") [awalan, k] = ["panggilan", "pertama"];
  else if (keadaan === "sidang-ditunda") [awalan, k] = ["panggilan", "lanjutan"];
  else if (keadaan === "ikrar-talak") [awalan, k] = ["panggilan", "ikrar"];
  else if (keadaan === "pemberitahuan-putusan") [awalan, k] = ["pbt", ""];
  else return null;

  // Q3 16 Okt: kunci berkata "ecourt"/"verstek" hanya untuk dokumen e-Court / putusan verstek.
  const ec = { ecourt: dokumen.lewatEcourt === true, verstek: dokumen.verstekPutusan === true };
  const pihak = String(dokumen.pihakDipanggil ?? "");
  if (pihak !== "pertama" && pihak !== "kedua") return { awalan, keadaan: k, khusus: "", umum: "", ...ec };
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
  return { awalan, keadaan: k, khusus, umum, ...ec };
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
  // 9 Okt 2026: kedua peta DIGABUNG - awalan kuncinya yang menentukan
  // (pilihKunciRelaas), sama dengan jurusitaPilihBlangko di ekstensi. Dulu
  // hanya satu peta yang dicari, sehingga kunci PBT yang ditulis di tab Relaas
  // (atau sebaliknya) dipakai ekstensi tetapi diabaikan portal. Relaas menang
  // bila kuncinya sama persis di kedua tab - urutan ekstensi juga.
  const peta = { ...petaPbt, ...petaRelaas };
  const kunciDaftar = Object.keys(peta).filter((x) => !x.startsWith(AWALAN_KUNCI_BAS_DB) && String(peta[x] || "").trim());
  const kunci = pilihKunciRelaas(kunciDaftar, minta);
  if (!kunci) return null;
  return { berkas: String(peta[kunci]).trim(), kunci };
}

/**
 * ============================================================================
 * SATU DOKUMEN "KEDUANYA" DIPECAH MENJADI DUA DOKUMEN PER PIHAK (6 Okt, butir 10)
 * ============================================================================
 *
 * Bot melaporkan sidang pertama (dan sidang ditunda yang tidak dihadiri siapa
 * pun, sandi 4) sebagai SATU dokumen berpihak "keduanya", lalu dokumen itu
 * dicetak dengan blangko gabungan 3.b. Pengguna: relaas harus sesuai pihaknya
 * - Penggugat/Pemohon blangko P, Tergugat/Termohon blangko T - dan gabungan
 * HANYA bila memang hanya itu blangkonya. Maka dokumen "keduanya" dipecah
 * menjadi dokumen pihak pertama (pihakKe 1) dan pihak kedua (pihakKe 2),
 * masing-masing dengan kunci sendiri.
 *
 * Pemberitahuan putusan biasanya sudah per pihak dari bot (pihakKe 1/2); yang
 * datang "keduanya" ikut dipecah dengan aturan yang sama.
 *
 * TIDAK dipecah: ikrar talak (blangkonya hanya gabungan), dan dokumen yang blangko kedua
 * pihaknya ternyata SAMA (admin memetakan kedua kunci per pihak ke satu berkas
 * gabungan) - dua cetakan berkas yang sama hanya menggandakan.
 */
type DokumenPecah = DokumenPetakan & {
  kunci: string;
  perkaraId: unknown;
  d?: unknown;
  pihakKe?: number | null;
};

function berkasSisi(
  dokumen: DokumenPetakan,
  sisi: "pertama" | "kedua",
  petaRelaas: Record<string, string>,
  petaPbt: Record<string, string>
): string {
  const keadaan = keadaanUntukGolongan(dokumen.golongan);
  if (!keadaan) return "";
  const dariPeta = blangkoMenurutPemetaan({ ...dokumen, pihakDipanggil: sisi }, petaRelaas, petaPbt);
  const bawaan = blangkoRelaasPerPihak(keadaan, sisi, opsiEcourtDokumen(dokumen));
  // Q3 16 Okt: bawaan set e-Court menang atas kunci admin yang bukan kunci e-Court (admin menimpa dengan kunci "ecourt").
  if (dariPeta && !(bawaan?.ecourt && !uraiKunciRelaas(dariPeta.kunci).ecourt)) return dariPeta.berkas;
  return bawaan?.berkas ?? "";
}

export function pecahDokumenPerPihak<T extends DokumenPecah>(
  dokumen: T,
  petaRelaas: Record<string, string>,
  petaPbt: Record<string, string>
): T[] {
  const keadaan = keadaanUntukGolongan(dokumen.golongan);
  if (String(dokumen.pihakDipanggil ?? "") !== "keduanya") return [dokumen];
  if (keadaan !== "sidang-pertama" && keadaan !== "sidang-ditunda" && keadaan !== "pemberitahuan-putusan") return [dokumen];
  const p = berkasSisi(dokumen, "pertama", petaRelaas, petaPbt);
  const t = berkasSisi(dokumen, "kedua", petaRelaas, petaPbt);
  if (!p || !t || p === t) return [dokumen];
  const dasar = `${String(dokumen.golongan)}:${String(dokumen.perkaraId)}:${String(dokumen.d ?? 0)}`;
  return (["pertama", "kedua"] as const).map((sisi, i) => ({
    ...dokumen,
    pihakDipanggil: sisi,
    pihakKe: i + 1,
    kunci: `${dasar}:${i + 1}`,
  }));
}

/**
 * Dokumen yang pihaknya TIDAK diketahui SIPP lalu dipilihkan "Kedua pihak" oleh
 * juru sita (9 Okt 2026). Dokumen itu tidak ikut pecahDokumenPerPihak - ia
 * baru "keduanya" sesudah dipilih - sehingga dulu dicetak dengan blangko
 * gabungan 3.b, sedangkan tab Juru Sita ekstensi mencetak dokumen yang sama
 * per pihak. Kini dipecah dengan aturan yang SAMA: dua dokumen (blangko P dan
 * blangko T) - atau [] bila tidak dipecah (bukan pilihan "keduanya", keadaan
 * yang hanya punya gabungan, atau kedua pihak berblangko sama), dan yang
 * berlaku tetap penilaian dokumen aslinya.
 */
export function pecahPilihanKeduanya<T extends DokumenPecah>(
  dokumen: T,
  pilihan: unknown,
  petaRelaas: Record<string, string>,
  petaPbt: Record<string, string>
): T[] {
  if (String(dokumen.pihakDipanggil ?? "") !== "tidak-diketahui" || pilihan !== "keduanya") return [];
  const pecah = pecahDokumenPerPihak({ ...dokumen, pihakDipanggil: "keduanya" }, petaRelaas, petaPbt);
  return pecah.length === 2 ? pecah : [];
}
