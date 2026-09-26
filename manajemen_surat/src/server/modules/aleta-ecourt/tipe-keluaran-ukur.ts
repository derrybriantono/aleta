import { teksDariHtml } from "@/lib/alasan-perkara-sipp";
import { DAFTAR_BOT, DAFTAR_TIPE, type EntriTipe, type HasilUkur, type KunciDaftar } from "@/lib/tipe-keluaran/kontrak";
import { tiruanReplaceKetSaksi } from "@/lib/tipe-keluaran/ragam-jawaban";
import { usulkanMedanPutusan, type EntriTipeMedan, type MedanPilihan } from "@/lib/usulan-medan-putusan";
import { type AletaDatabase } from "@/server/db/client";
import { gatewayUkurTipe, getGatewayAbtUsulan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaCalon,
  efektifDenganCalon,
  simpanHasilUkur,
  type CalonTipe,
} from "@/server/modules/aleta-ecourt/tipe-keluaran";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * UKUR DAN PRATINJAU TIPE KELUARAN (Tahap 3, K4 'ukur' dan 'pratinjau')
 * ============================================================================
 *
 * UKUR - gerbang daftar 'deteksi' (K13). Aturan deteksi hasil tebakan sudah
 * tiga kali salah di repo ini; tambahan pada tiga daftar deteksi baru dapat
 * disahkan sesudah membuktikan dirinya atas data SIPP sungguhan:
 *
 *   putusan.alasan.ciri           bot menjalankan ciriDariKalimat SUNGGUHAN
 *                                 tanpa/dengan calon atas posita cerai 2024+
 *                                 dan memulangkan 20 contoh berbenih. Pengesah
 *                                 menandai yang salah; baru sesudah itu hasil
 *                                 disimpan. Contoh dihitung ulang di peladen
 *                                 (berbenih, jadi sama) - jumlah contoh tidak
 *                                 pernah diambil dari peramban.
 *   putusan.sumber-hukum.sebutan  bot memulangkan 300 putusan terbaru; portal
 *                                 menjalankan usulkanMedanPutusan tanpa/dengan
 *                                 calon dan membandingkannya dengan isian
 *                                 manusia (sumber_hukum_id).
 *   putusan.padanan-jenis         nama lain itu harus ada di
 *                                 perkara.jenis_perkara_nama.
 *
 * PRATINJAU - daftar BAS yang dipakai penyusun keterangan saksi bot. Portal
 * memanggil /abt/usulan sumber 'saksi-sdg' dengan tipeKeluaran SEANDAINYA
 * calon disahkan, atas templat A1a dan dua posita contoh. Yang tampil adalah
 * keluaran PENYUSUN BOT SUNGGUHAN, bukan salinan portal - berdampingan untuk
 * 2-4 saksi, dengan jumlah jawaban identik dalam satu BAS dan antar perkara,
 * dan bunyinya di putusan sesudah tiruan replace_ket_saksi ABT.
 *
 * Pratinjau tidak mengubah apa pun (tidak ada riwayat, tidak ada audit).
 * Ukur menyimpan hasil_ukur lewat simpanHasilUkur - satu riwayat, satu audit.
 */

// ============================================================================
// UKUR SEBUTAN SUMBER HUKUM - MURNI, DAPAT DIUJI TANPA BOT
// ============================================================================

export type SampelSumberHukum = { perkaraId: string; pertimbangan: string; sumberHukumId: string };

export type HasilUkurSebutan = {
  jenis: "sebutan";
  sampel: number;
  samaSebelum: number;
  samaSesudah: number;
  /** Sampel yang MENDAPAT sumber hukum salah yang tadinya tidak diusulkan. */
  salahTambahan: number;
  /** Sampel yang mendapat sumber hukum benar yang tadinya tidak diusulkan. */
  benarTambahan: number;
  /** Sampel yang usulannya berubah sama sekali. */
  berubah: number;
  contohBerubah: Array<{ perkaraId: string; benar: string[]; sebelum: string[]; sesudah: string[] }>;
};

const MEDAN_SUMBER_HUKUM = { kunci: 'input[name="sumber_hukum[]"]', label: "Sumber Hukum", banyak: true } as const;

function idSumber(teks: string): string[] {
  return String(teks ?? "")
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .sort();
}

function usulSumber(dasar: string, medan: MedanPilihan, sebutan: EntriTipeMedan[]): string[] {
  const [u] = usulkanMedanPutusan(dasar, [medan], { tipe: { "putusan.sumber-hukum.sebutan": sebutan } });
  return [...new Set((u?.nilaiBanyak ?? []).map((x) => String(x.nilai)))].sort();
}

/**
 * Membandingkan usulan Sumber Hukum tanpa dan dengan calon atas sampel
 * putusan sungguhan. 'Sama persis' = himpunan usulan = himpunan isian manusia.
 */
export function ukurSebutanAtas(
  sampel: readonly SampelSumberHukum[],
  pilihan: ReadonlyArray<{ nilai: string; label: string }>,
  sebutanTanpa: EntriTipeMedan[],
  sebutanDengan: EntriTipeMedan[]
): HasilUkurSebutan {
  const medan: MedanPilihan = { ...MEDAN_SUMBER_HUKUM, pilihan: pilihan.map((p) => ({ nilai: p.nilai, label: p.label })) };
  const hasil: HasilUkurSebutan = {
    jenis: "sebutan",
    sampel: 0,
    samaSebelum: 0,
    samaSesudah: 0,
    salahTambahan: 0,
    benarTambahan: 0,
    berubah: 0,
    contohBerubah: [],
  };
  for (const s of sampel) {
    const benar = idSumber(s.sumberHukumId);
    if (!benar.length) continue;
    hasil.sampel += 1;
    const dasar = teksDariHtml(s.pertimbangan);
    const sebelum = usulSumber(dasar, medan, sebutanTanpa);
    const sesudah = usulSumber(dasar, medan, sebutanDengan);
    if (sebelum.join() === benar.join()) hasil.samaSebelum += 1;
    if (sesudah.join() === benar.join()) hasil.samaSesudah += 1;
    const baru = sesudah.filter((x) => !sebelum.includes(x));
    if (baru.some((x) => !benar.includes(x))) hasil.salahTambahan += 1;
    if (baru.some((x) => benar.includes(x))) hasil.benarTambahan += 1;
    if (sebelum.join() !== sesudah.join()) {
      hasil.berubah += 1;
      if (hasil.contohBerubah.length < 10) hasil.contohBerubah.push({ perkaraId: s.perkaraId, benar, sebelum, sesudah });
    }
  }
  return hasil;
}

// ============================================================================
// UKUR - SATU PINTU
// ============================================================================

function galatBot(error: string): never {
  throw new ApiError(502, `Bot tidak dapat mengukur: ${error}`);
}

function sebagaiMedan(daftar: EntriTipe[] | undefined): EntriTipeMedan[] {
  return (daftar ?? []).map((e) => ({ kunci: e.kunci, nilai: e.nilai, data: e.data, urutan: e.urutan, asal: e.asal }));
}

function sebagaiMuatan(e: EntriTipe) {
  return { kunci: e.kunci, nilai: e.nilai, data: e.data };
}

async function ukurCiri(db: AletaDatabase, actorUserId: string | null | undefined, calon: CalonTipe, tandaSalah: unknown) {
  const { tanpa } = await efektifDenganCalon(db, calon, [calon.daftar]);
  const jawaban = await gatewayUkurTipe({
    jenis: "ciri",
    calon: [sebagaiMuatan(calon.entri)],
    dasar: (tanpa.daftar[calon.daftar] ?? []).map(sebagaiMuatan),
    // Benih = butir + sidiknya: contoh sama pada tiap panggilan untuk butir
    // yang sama, dan berganti bila isinya berganti.
    benih: `${calon.id}|${calon.entri.sidik}`,
  });
  if (!jawaban.ok) galatBot(jawaban.error);
  const u = jawaban.data;
  const contoh = u.contoh ?? [];

  // Tahap periksa: contoh dikirim ke layar; belum ada yang disimpan.
  if (tandaSalah === undefined || tandaSalah === null) {
    return { ok: true as const, tahap: "periksa" as const, ukur: u };
  }
  if (!Array.isArray(tandaSalah)) throw new ApiError(400, "tandaSalah harus larik id contoh.");
  const ids = new Set(contoh.map((c) => c.id));
  const ditandai = [...new Set(tandaSalah.map((x) => String(x)))];
  const asing = ditandai.filter((x) => !ids.has(x));
  if (asing.length) {
    throw new ApiError(
      409,
      `Contoh yang ditandai tidak ada pada ukur terbaru (${asing.slice(0, 3).join(", ")}); datanya berubah. Ukur ulang lalu periksa lagi.`
    );
  }
  const hasil = {
    jenis: "ciri" as const,
    contoh: contoh.length,
    salah: ditandai.length,
    n: u.n ?? 0,
    tangkapanBaru: u.tangkapanBaru ?? 0,
    tangkapanCalon: u.tangkapanCalon ?? 0,
    kalimatCocok: u.kalimatCocok ?? 0,
    // Berapa dari contoh yang dinilai adalah tangkapan BARU (didahulukan bot).
    contohBaru: u.contohBaru ?? 0,
    benih: u.benih ?? "",
    ditandaiSalah: ditandai,
  };
  const simpan = await simpanHasilUkur(db, actorUserId, { id: calon.id, hasil });
  return { ...simpan, tahap: "tersimpan" as const, ukur: u };
}

async function ukurSebutan(db: AletaDatabase, actorUserId: string | null | undefined, calon: CalonTipe) {
  const { tanpa, dengan } = await efektifDenganCalon(db, calon, [calon.daftar]);
  const jawaban = await gatewayUkurTipe({ jenis: "sebutan" });
  if (!jawaban.ok) galatBot(jawaban.error);
  const sampel = jawaban.data.sampel ?? [];
  const pilihan = jawaban.data.pilihan ?? [];
  if (!pilihan.length) throw new ApiError(502, "Bot tidak memulangkan pilihan sumber hukum SIPP; ukur tidak dapat dinilai.");
  const nilai = ukurSebutanAtas(sampel, pilihan, sebagaiMedan(tanpa.daftar[calon.daftar]), sebagaiMedan(dengan[calon.daftar]));
  const { contohBerubah, ...angka } = nilai;
  const simpan = await simpanHasilUkur(db, actorUserId, { id: calon.id, hasil: angka satisfies HasilUkur });
  return { ...simpan, tahap: "tersimpan" as const, ukur: { ...angka, contohBerubah } };
}

async function ukurPadanan(db: AletaDatabase, actorUserId: string | null | undefined, calon: CalonTipe) {
  const jawaban = await gatewayUkurTipe({ jenis: "padanan", nama: calon.entri.nilai });
  if (!jawaban.ok) galatBot(jawaban.error);
  const hasil = {
    jenis: "padanan" as const,
    adaDiSipp: jawaban.data.adaDiSipp === true,
    jumlahPerkara: Number(jawaban.data.jumlahPerkara ?? 0),
    namaSipp: jawaban.data.namaSipp ?? [],
  };
  const simpan = await simpanHasilUkur(db, actorUserId, { id: calon.id, hasil });
  return { ...simpan, tahap: "tersimpan" as const, ukur: jawaban.data };
}

/** Tindakan 'ukur': {id, tandaSalah?} - tandaSalah hanya untuk ciri, tahap kedua. */
export async function jalankanUkur(db: AletaDatabase, actorUserId: string | null | undefined, badan: Record<string, unknown>) {
  await pastikanAdminIstimewa(db, actorUserId, "mengukur tipe keluaran");
  const calon = await bacaCalon(db, badan.id);
  if (calon.keadaan !== "usulan") {
    throw new ApiError(409, `Hanya usulan yang diukur; butir ini berkeadaan '${calon.keadaan}'.`);
  }
  const ukur = DAFTAR_TIPE[calon.daftar].ukur;
  switch (ukur) {
    case "ciri":
      return ukurCiri(db, actorUserId, calon, badan.tandaSalah);
    case "sebutan":
      return ukurSebutan(db, actorUserId, calon);
    case "padanan":
      return ukurPadanan(db, actorUserId, calon);
    default:
      throw new ApiError(400, `Daftar ${calon.daftar} bukan daftar deteksi; tidak ada yang diukur.`);
  }
}

// ============================================================================
// PRATINJAU DAFTAR BAS - PENYUSUN BOT SUNGGUHAN
// ============================================================================

/** Daftar BAS yang dipakai penyusun keterangan saksi bot - yang dapat dipratinjau. */
export const DAFTAR_PRATINJAU: readonly KunciDaftar[] = [
  "bas.saksi.pembuka",
  "bas.saksi.ragam-kata",
  "bas.saksi.jawaban-modus",
  "bas.saksi.bentuk",
  "bas.saksi.profil",
  "bersama.alasan.frasa",
];

/**
 * Jenis perkara dan alur yang dikirim pratinjau - BENTUK YANG SAMA dengan yang
 * dikirim ekstensi dari ABT: id jenis perkara SIPP (abt.js ID_JENIS_PERKARA_SIPP,
 * 'cerai gugat' = "347") dan alur_perkara_id dari nomornya (abt.js
 * idAlurPerkaraSipp: Pdt.G = "15", Pdt.P = "16", Pdt.G.S = "17").
 *
 * Bot menyaring bentuk ber-data.syarat dengan membandingkan
 * syarat.jenisPerkaraId dan syarat.alur apa adanya terhadap kedua nilai ini
 * (abtUsulanService.js syaratCocok). Dulu pratinjau mengirim NAMA ("Cerai
 * Gugat") tanpa alur: bentuk bersyarat {jenisPerkaraId:"347", alur:"15"} tidak
 * pernah tampak di pratinjau padahal berlaku di ABT, dan syarat berupa nama
 * tampak di pratinjau padahal tidak pernah berlaku di ABT.
 *
 * Templat A1a = saksi Penggugat cerai gugat, jadi keduanya tetap.
 */
export const JENIS_PERKARA_PRATINJAU = "347";
export function alurPratinjau(nomorPerkara: string): string {
  if (/Pdt\.G\.S\b/i.test(nomorPerkara)) return "17";
  if (/Pdt\.G\b/i.test(nomorPerkara)) return "15";
  if (/Pdt\.P\b/i.test(nomorPerkara)) return "16";
  return "";
}

/**
 * Kumpulan A1a ABT (saksi Penggugat cerai gugat) apa adanya, tanpa nama
 * pihak - sama dengan templat uji bas-pakai-contoh-ragam.
 */
const A1A: ReadonlyArray<readonly [string, string]> = [
  ["Apakah saudara kenal dengan #0046#?", "Saya kenal dengan #0046# karena saya adalah ...;"],
  ["Apakah saudara mengetahui maksud #0046# menghadap di persidangan ini?", "#0046# menghadap di persidangan ini untuk mengajukan cerai terhadap suaminya sebagai #0047#;"],
  ["Apakah saudara kenal dengan #0047#?", "Saya kenal dengan #0047# sebagai isteri/suami #0046#;"],
  ["Dimana #0046# dan #0047# tinggal bersama setelah menikah?", "Setelah menikah #0046# dan #0047# tinggal bersama di ...... pernah juga tinggal bersama di ....... dan terakhir tinggal bersama di ...... ;Setelah menikah #0046# dan #0047# tidak pernah tinggal bersama;"],
  ["Apakah #0046# dan #0047# sudah dikarunia anak?", "#0046# dan #0047# sudah dikaruniai ... orang anak, anak tersebut saat ini tinggal dengan #0046# / #0047#;#0046# dan #0047# belum dikaruniai anak;"],
  ["Kenapa #0046# mengajukan cerai terhadap #0047#?", "#0046# mengajukan cerai terhadap #0047# karena sudah tidak rukun dalam rumah tangganya;"],
  ["Apakah antara #0046# dan #0047# sering terjadi perselisihan dan pertengkaran, dan kapan mulainya?", "Antara #0046# dan #0047# sering terjadi perselisihan dan pertengkaran sejak .....;"],
  ["Apa yang biasa menjadi penyebab perselisihan dan pertengkaran antara #0046# dan #0047#?", "Yang biasa menjadi penyebab perselisihan dan pertengkaran antara #0046# dan #0047# adalah karena ........;"],
  ["Apakah saudara pernah melihat atau mendengar langsung #0046# dan #0047# bertengkar?", "Saya pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar, sebanyak .... kali, di ........;Saya tidak pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar, tapi setelah terjadi pertengkaran saya tahu karena .....;"],
  ["Apakah #0046# dan #0047# masih tinggal satu rumah sampai saat ini?", "#0046# dan #0047# sudah pisah tempat tinggal sejak ....., kira-kira sampai sekarang sudah sekitar ........ tahun/bulan;"],
  ["Apakah selama pisah antara #0046# dan #0047# masih ada komunikasi?", "Selama pisah antara #0046# dan #0047# sudah tidak ada komunikasi;"],
  ["Apakah #0047# masih memberikan nafkah kepada #0046#?", "#0047# sudah tidak pernah memberikan nafkah kepada #0046#;"],
  ["Pernahkah ada upaya untuk merukunkan #0046# dan #0047#?", "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan oleh ...., namun tidak berhasil;Sebelum-sebelumnya #0046# dan #0047# pernah dirukunkan oleh ...., namun kembali lagi cekcok (berselisih);Belum pernah ada upaya untuk merukunkan #0046# dan #0047# karena ....;"],
  ["Apakah masih ada yang ingin saudara sampaikan?", "Sudah cukup;"],
];

const isiSebutan = (t: string) => t.replace(/#0046#/g, "Penggugat").replace(/#0047#/g, "Tergugat");

export const TEMPLAT_A1A = A1A.map(([tanya, jawab], i) => ({
  no: String(i + 1),
  tanya: isiSebutan(tanya),
  jawab: isiSebutan(jawab),
  jawabMentah: jawab,
}));

/** Dua posita contoh, disusun tangan - tanpa nama, tanpa alamat. */
export const POSITA_CONTOH: ReadonlyArray<{ nomorPerkara: string; posita: string }> = [
  {
    nomorPerkara: "11/Pdt.G/2026/PA.Contoh",
    posita: [
      "Bahwa Penggugat dan Tergugat adalah suami isteri yang menikah pada tahun 2015;",
      "Bahwa sejak tahun 2023 rumah tangga Penggugat dan Tergugat mulai goyah karena sering terjadi perselisihan dan pertengkaran;",
      "Bahwa penyebab perselisihan dan pertengkaran tersebut karena Tergugat suka berjudi dan mabuk-mabukan;",
      "Bahwa Tergugat tidak memberikan nafkah wajib kepada Penggugat;",
      "Bahwa sejak bulan Maret 2025 Penggugat dan Tergugat telah pisah tempat tinggal;",
      "Bahwa pihak keluarga telah berusaha merukunkan Penggugat dan Tergugat namun tidak berhasil;",
    ].join("\n"),
  },
  {
    nomorPerkara: "12/Pdt.G/2026/PA.Contoh",
    posita: [
      "Bahwa Penggugat dan Tergugat telah menikah pada tahun 2018 dan telah dikaruniai dua orang anak;",
      "Bahwa sejak awal tahun 2024 antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran;",
      "Bahwa penyebabnya karena Tergugat cemburu berlebihan dan sering memukul Penggugat;",
      "Bahwa pada bulan Juni 2024 Tergugat pergi meninggalkan Penggugat dan sejak itu tidak pernah kembali;",
      "Bahwa selama pisah Penggugat dan Tergugat sudah tidak ada komunikasi;",
    ].join("\n"),
  },
];

type JawabanBot = { no: string; tanya: string; jawab: string };
type SaksiBot = { ke: number; pihak?: string; jawaban: JawabanBot[] };

export type PratinjauPerkara = {
  nomorPerkara: string;
  baris: Array<{
    no: string;
    tanya: string;
    /** Per saksi, urut ke: jawaban dengan calon, tanpa calon, dan bunyinya di putusan. */
    saksi: Array<{ ke: number; jawab: string; jawabTanpa: string; putusan: string; berubah: boolean }>;
  }>;
  /** Pertanyaan yang jawabannya kembar pada sekurang-kurangnya dua saksi. */
  identikDalamBas: number;
  /** Pasangan (saksi i, saksi j, pertanyaan) yang jawabannya kembar. */
  pasanganIdentik: number;
  pasanganTotal: number;
};

function jawabanSaksi(hasil: unknown): SaksiBot[] {
  const r = hasil && typeof hasil === "object" ? (hasil as { saksi?: unknown }) : {};
  return Array.isArray(r.saksi) ? (r.saksi as SaksiBot[]) : [];
}

/** Hitungan identik satu BAS, dari jawaban penyusun bot. */
export function hitungIdentikBas(saksi: SaksiBot[]) {
  const jumlahTanya = Math.max(0, ...saksi.map((s) => s.jawaban.length));
  let identikDalamBas = 0;
  let pasanganIdentik = 0;
  let pasanganTotal = 0;
  for (let k = 0; k < jumlahTanya; k += 1) {
    let adaKembar = false;
    for (let i = 0; i < saksi.length; i += 1) {
      for (let j = i + 1; j < saksi.length; j += 1) {
        const a = saksi[i].jawaban[k]?.jawab;
        const b = saksi[j].jawaban[k]?.jawab;
        if (a === undefined || b === undefined) continue;
        pasanganTotal += 1;
        if (a === b) {
          pasanganIdentik += 1;
          adaKembar = true;
        }
      }
    }
    if (adaKembar) identikDalamBas += 1;
  }
  return { identikDalamBas, pasanganIdentik, pasanganTotal };
}

/** Jawaban saksi yang sama (ke, pertanyaan) yang kembar antar dua perkara. */
export function hitungIdentikAntarPerkara(a: SaksiBot[], b: SaksiBot[]) {
  let identik = 0;
  let total = 0;
  for (const sa of a) {
    const sb = b.find((x) => x.ke === sa.ke);
    if (!sb) continue;
    sa.jawaban.forEach((j, k) => {
      const lain = sb.jawaban[k];
      if (!lain) return;
      total += 1;
      if (j.jawab === lain.jawab) identik += 1;
    });
  }
  return { identik, total };
}

function pilihDaftarBot(isi: Partial<Record<KunciDaftar, EntriTipe[]>>) {
  const hasil: Record<string, EntriTipe[]> = {};
  for (const d of DAFTAR_BOT) if (isi[d]) hasil[d] = isi[d] as EntriTipe[];
  return hasil;
}

/** Tindakan 'pratinjau': {id, jumlahSaksi? 2-4}. Tidak mengubah apa pun. */
export async function jalankanPratinjau(db: AletaDatabase, actorUserId: string | null | undefined, badan: Record<string, unknown>) {
  await pastikanAdminIstimewa(db, actorUserId, "mempratinjau tipe keluaran");
  const calon = await bacaCalon(db, badan.id);
  if (!DAFTAR_PRATINJAU.includes(calon.daftar)) {
    throw new ApiError(400, `Pratinjau hanya untuk daftar BAS yang dipakai penyusun saksi bot (${DAFTAR_PRATINJAU.join(", ")}).`);
  }
  const jumlahSaksi = badan.jumlahSaksi === undefined || badan.jumlahSaksi === null ? 2 : Number(badan.jumlahSaksi);
  if (!Number.isInteger(jumlahSaksi) || jumlahSaksi < 2 || jumlahSaksi > 4) {
    throw new ApiError(400, "Jumlah saksi pratinjau harus 2 sampai 4.");
  }
  const { tanpa, dengan, versiDengan } = await efektifDenganCalon(db, calon, DAFTAR_BOT);
  const tipeDengan = { versi: versiDengan, daftar: pilihDaftarBot(dengan) };
  const tipeTanpa = { versi: tanpa.versi, daftar: pilihDaftarBot(tanpa.daftar) };
  const saksi = Array.from({ length: jumlahSaksi }, (_x, i) => ({
    ke: i + 1,
    pihak: "P",
    modus: "sama",
    sumber: "",
    sumberNama: "",
    alasan: [] as string[],
  }));

  const susun = async (contoh: (typeof POSITA_CONTOH)[number], tipeKeluaran: { versi: string; daftar: Record<string, EntriTipe[]> }) => {
    const jawaban = await getGatewayAbtUsulan({
      nomorPerkara: contoh.nomorPerkara,
      sumber: "saksi-sdg",
      templat: TEMPLAT_A1A,
      alasan: [],
      posita: contoh.posita,
      pelaku: "Tergugat",
      lawan: "Penggugat",
      kodeKumpulan: "A1a",
      jenisPerkara: JENIS_PERKARA_PRATINJAU,
      alur: alurPratinjau(contoh.nomorPerkara),
      saksi,
      tipeKeluaran,
    });
    if (!jawaban.ok) throw new ApiError(502, `Bot tidak dapat menyusun pratinjau: ${jawaban.error}`);
    return jawaban.data;
  };

  const perkara: PratinjauPerkara[] = [];
  const saksiPerPerkara: SaksiBot[][] = [];
  let diterimaBot = true;
  const ditolak: Array<{ daftar: string; kunci: string; alasan: string }> = [];
  for (const contoh of POSITA_CONTOH) {
    const hDengan = await susun(contoh, tipeDengan);
    const hTanpa = await susun(contoh, tipeTanpa);
    if (hDengan.tipeKeluaranDiterima !== true) diterimaBot = false;
    for (const t of hDengan.tipeKeluaranDitolak ?? []) {
      if (!ditolak.some((x) => x.daftar === t.daftar && x.kunci === t.kunci && x.alasan === t.alasan)) ditolak.push(t);
    }
    const sDengan = jawabanSaksi(hDengan.saksiSdg);
    const sTanpa = jawabanSaksi(hTanpa.saksiSdg);
    saksiPerPerkara.push(sDengan);
    const identik = hitungIdentikBas(sDengan);
    perkara.push({
      nomorPerkara: contoh.nomorPerkara,
      baris: TEMPLAT_A1A.map((t, k) => ({
        no: t.no,
        tanya: t.tanya,
        saksi: sDengan.map((s) => {
          const jawab = s.jawaban[k]?.jawab ?? "";
          const jawabTanpa = sTanpa.find((x) => x.ke === s.ke)?.jawaban[k]?.jawab ?? "";
          return { ke: s.ke, jawab, jawabTanpa, putusan: tiruanReplaceKetSaksi(jawab), berubah: jawab !== jawabTanpa };
        }),
      })),
      ...identik,
    });
  }
  const antar = hitungIdentikAntarPerkara(saksiPerPerkara[0] ?? [], saksiPerPerkara[1] ?? []);
  const berubah = perkara.reduce((n, p) => n + p.baris.reduce((m, b) => m + b.saksi.filter((s) => s.berubah).length, 0), 0);
  // Calon yang ditolak penyaring bot tidak pernah sampai ke penyusun - itu
  // disebut, bukan ditampilkan seolah pratinjaunya berhasil.
  const calonDitolak = ditolak.filter((t) => t.daftar === calon.daftar && t.kunci === calon.entri.kunci);
  return {
    ok: true as const,
    daftar: calon.daftar,
    id: calon.id,
    jumlahSaksi,
    diterimaBot,
    ditolak,
    calonDitolak,
    berubah,
    identikAntarPerkara: antar.identik,
    pembandingAntarPerkara: antar.total,
    perkara,
  };
}

/** Pintu rute untuk dua tindakan Tahap 3. */
export async function jalankanUkurAtauPratinjau(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  badan: Record<string, unknown>
) {
  if (badan.tindakan === "ukur") return jalankanUkur(db, actorUserId, badan);
  if (badan.tindakan === "pratinjau") return jalankanPratinjau(db, actorUserId, badan);
  throw new ApiError(400, "Tindakan harus 'ukur' atau 'pratinjau'.");
}
