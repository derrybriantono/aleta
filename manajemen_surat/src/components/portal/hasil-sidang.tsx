"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, Gavel, Info, PauseCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KabarDiantrekan, TanyaJamKerja, type PilihJamKerja } from "@/components/portal/pilihan-jam-kerja";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { sebutTanggalPanjang } from "@/lib/hari-libur";
import { adaHasilSidang, hasilSidangPutusan } from "@/lib/hasil-sidang";
import { kalimatLangkah, langkahUntukPetugas } from "@/lib/ringkasan-langkah-sipp";
import {
  dasarTanggalKosong,
  jamSidangBerikut,
  pilihanTunda,
  sebutanDariKeadaan,
  tambahHari,
  tanggalJamUntuk,
  tundaKarenaMediasi,
  usulanTundaSidang,
  type BawaanTunda,
  type KontakPihak,
  type MediasiRiwayat,
  type RencanaKalender,
  type SidangRiwayat,
  usulanTanggalAwam,
} from "@/lib/bawaan-tunda";
import { bacaKontakPihak, kalimatKontak } from "@/lib/jadwal-sidang-kontak";
import {
  kalimatAtasNama,
  kehadiranDariAntrian,
  keadaanRuangMenurutAntrian,
  keteranganAntrian,
  type AntrianSidangRingkas,
  type AtasNamaSipp,
} from "@/lib/antrian-hasil-sidang";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import {
  bawaanTundaIkrar,
  peringatanBatasIkrar,
  type JenisTundaIkrar,
} from "@/lib/ikrar-talak";
import {
  antrianDariRingkas,
  bahanKehadiranDariKeadaan,
  susunKehadiran,
  usulanDihadiriOleh,
  type KehadiranOrang,
} from "@/lib/kehadiran-rinci"; /* F3.2 */
import { UsulanKehadiranBlangko } from "@/components/portal/kehadiran-rinci-sidang"; /* F3.2 */
import { IsianMediator } from "@/components/portal/jadwal-sidang-1okt";
import { PapanRuangSidang } from "@/components/portal/jadwal-sidang-2okt";
import { KartuPanggil } from "@/components/portal/panggil-petugas";
import { PemilihTanggalSidang } from "@/components/ui/pemilih-tanggal-sidang";
import { sebabBerbauMediasi } from "@/lib/mediasi-sidang";
import type { Ruangan } from "@/lib/ruangan-sidang";
import {
  bawaanRuangSidang,
  kelilingUntukRuangan,
  muatanRuangSidang,
  ruanganMenurutId,
  type BawaanRuangSidang,
} from "@/lib/ruang-sidang-blangko";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * HASIL SIDANG - SATU LAYAR, DUA JALAN YANG SALING MENIADAKAN
 * ============================================================================
 *
 * Ditiru dari aplikasi antrian sidang satker, yang menawarkan satu baris:
 *
 *     HASIL SIDANG :  DITUNDA  |  DIPUTUS
 *
 * dan barulah borangnya muncul. Bukan dua borang yang berdiri bersamaan -
 * sidang tidak dapat ditunda DAN diputus sekaligus, dan dua borang terbuka
 * berdampingan adalah undangan mengisi keduanya.
 *
 * ============================================================================
 * YANG TIDAK DITANYAKAN, DAN SEBABNYA
 * ============================================================================
 *
 * AKUN SIPP. Tidak ditanyakan sama sekali. Aplikasi antrian membaca panitera
 * pengganti perkaranya dari perkara_panitera_pn, dan hakimnya dari
 * perkara_hakim_pn. Bertanya membuka pintu menulis atas nama orang lain, dan
 * audit trail SIPP hanya mencatat nama yang diberikan kepadanya.
 *
 * AMAR, PERTIMBANGAN, SUMBER HUKUM, CATATAN. Tidak ditanyakan pada jalur ini.
 * Aplikasi antrian mengisi amar dengan harfiah "BELUM DIINPUT" dan sumber
 * hukum tetap '8,11'. Panitera sidang mencatat FAKTA bahwa perkaranya diputus;
 * naskahnya ditulis hakim beberapa hari kemudian lewat SIPP. Borang yang
 * menuntut amar akan menahan pencatatan sampai naskahnya jadi - padahal papan
 * antrian, laporan harian, dan akta cerai membutuhkan faktanya hari ini.
 */

type KeadaanSidang = {
  jadwalId: number;
  perkaraId: number;
  nomorPerkara: string;
  tanggalSidang: string;
  jamSidang: string;
  agenda: string;
  ditunda: string;
  alasanDitunda?: string;
  urutan?: number;
  ruanganId?: number;
  /** Nama ruangan + sidang keliling 'Y'/'T' yang tercatat (butir 25). */
  ruangan?: string | null;
  sidangKeliling?: string | null;
  dihadiriOleh?: number;
  /** Bahan sebutan para pihak dan bendera ikrar - bot 30 Sep 2026 ke atas. */
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  jenisPerkara?: string;
  ikrarTalak?: string;
  /** Bahan tombol tunda/putus ikrar talak (18 Okt 2026) - bot 18 Okt ke atas. */
  keterangan?: string | null;
  tanggalPutusan?: string | null;
  tanggalBht?: string | null;
  tanggalPenetapanSidangIkrar?: string | null;
};

/**
 * Riwayat sidang + mediasi perkara dari bot (butir 14); null = bot lama / tak
 * terbaca. `kalender` = Court Calendar (rencana majelis), dibaca terpisah lewat
 * bacaKalender - undefined/null = tak terbaca.
 */
type RiwayatTunda = {
  sidang: SidangRiwayat[];
  mediasi: MediasiRiwayat;
  kalender?: RencanaKalender[] | null;
  /** Email + persetujuan e-Court (tanpa alamat), dibaca terpisah lewat bacaKontakPihak. */
  kontak?: KontakPihak | null;
} | null;

type LangkahRencana = { tabel: string; aksi: string; keterangan: string };

type Hasil = {
  ok: boolean;
  alasan?: string;
  /** Keputusan 104: di luar jam kerja bot menanyakan dulu, atau sudah mengantrekan. */
  perluPilihan?: boolean;
  diantrekan?: boolean;
  dikerjakanPada?: string;
  pesan?: string;
  /** Kode penolakan bot (7 Okt 2026); kalimatnya di `alasan`. */
  kode?: string;
  kering?: boolean;
  perkara?: { perkaraId: number; nomorPerkara: string };
  atasNama?: { username: string; namaLengkap: string; putusanAtasNama?: string };
  sidangBerikutnya?: { tanggal: string; jam: string; agenda: string };
  putusan?: { tanggalPutus: string; status: string; verstek: boolean; amar: string };
  andaian?: string[];
  antrian?: { ok: boolean; kering: boolean; baris?: number; alasan?: string } | null;
  rencana?: LangkahRencana[];
  /** Baris yang SUNGGUH tertulis - hanya pada jalan tulis (kering: false). */
  selesai?: LangkahRencana[];
  /** true: putus hanya menulis perkara_jadwal_sidang (butir 12). */
  hanyaJadwal?: boolean;
  /** Pengisian form ikrar talak SIPP yang menyertai putus ikrar (18 Okt 2026). */
  formIkrar?: { ok: boolean; alasan?: string; atasNama?: { username: string; namaLengkap: string }; tanggalIkrar?: string };
  /** e-Doc penetapan ikrar dari blangko Derry sesudah form ikrar terisi (18 Okt 2026). */
  edocIkrar?: { ok: boolean; kering?: boolean; nama?: string; pesan?: string; alasan?: string };
};

type StatusPutusan = { id: number; nama: string; dipakai: number };

/**
 * Alasan penundaan yang lazim.
 *
 * Ditawarkan, bukan dipaksakan: daftar tertutup akan memaksa panitera sidang
 * memilih alasan yang bukan alasannya, dan alasan yang keliru pada berkas
 * perkara lebih buruk daripada alasan yang diketik panjang.
 */
export const ALASAN_LAZIM = [
  "Para pihak tidak hadir",
  "Tergugat tidak hadir",
  "Penggugat tidak hadir",
  "Panggilan belum sampai kepada Tergugat",
  "Memberi kesempatan mediasi",
  "Memberi kesempatan mengajukan jawaban",
  "Pemeriksaan saksi belum selesai",
  "Memberi kesempatan melengkapi bukti",
  "Majelis hakim berhalangan",
];

export const AGENDA_LAZIM = [
  "Pembacaan Gugatan",
  "Jawaban",
  "Replik",
  "Duplik",
  "Pembuktian Penggugat",
  "Pembuktian Tergugat",
  "Kesimpulan",
  "Pembacaan Putusan",
];

/**
 * ============================================================================
 * KEHADIRAN PIHAK - ANGKANYA MILIK SIPP, BUKAN URUTAN DAFTAR INI
 * ============================================================================
 *
 * Dibaca langsung dari `antrian/php/menu.sidang.php` di peladen, bukan dikira:
 *
 *     1  SEMUA HADIR          2  PIHAK PERTAMA SAJA
 *     3  PIHAK KEDUA SAJA     4  PIHAK TIDAK HADIR
 *
 * Daftar yang bermula dari nol - yang wajar bagi penulis kode dan salah bagi
 * SIPP - akan menuliskan "semua hadir" ketika yang dipilih "tidak hadir", dan
 * salahnya tidak akan berbunyi apa pun: kolomnya menerima angka berapa saja.
 *
 * Bawaannya 4. Aplikasi antrian menaruhnya sebagai pilihan pertama, sehingga
 * baris yang belum pernah diisi terkirim sebagai 4 - dan pada sidang yang
 * ditunda, tidak hadirnya salah satu pihak memang sebab yang paling lazim.
 *
 * "Pihak pertama" dan "pihak kedua" hanya ditawarkan pada perkara GUGATAN.
 * Aplikasi antrian pun begitu (`if ($data['kode']=='G')`), dan sebabnya bukan
 * kerapian: permohonan tidak punya pihak kedua, jadi pilihan itu menawarkan
 * keadaan yang tidak dapat terjadi.
 */
const KEHADIRAN = [
  { nilai: 4, label: "Pihak tidak hadir", hanyaGugatan: false },
  { nilai: 2, label: "Pihak pertama saja (Penggugat/Pemohon)", hanyaGugatan: true },
  { nilai: 3, label: "Pihak kedua saja (Tergugat/Termohon)", hanyaGugatan: true },
  { nilai: 1, label: "Semua hadir", hanyaGugatan: false },
];

const KEHADIRAN_BAWAAN = 4;

/**
 * F3.2 (17 Okt 2026): usulan 1-4 dari kehadiran rinci ALETA, dipakai bila
 * aplikasi antrian tidak punya baris sidang ini (hari lampau, perkara yang
 * tidak didaftarkan ke mesin) tetapi petugas mencatat kehadirannya di ALETA.
 * Belum ada catatan = null, bukan "tidak hadir".
 */
function hadirDariRinci(
  kehadiran: KehadiranOrang[] | null | undefined,
  antrian: AntrianSidangRingkas | undefined,
  keadaan: KeadaanSidang
): number | null {
  if (!kehadiran?.length) return null;
  const usul = usulanDihadiriOleh(
    susunKehadiran(kehadiran, antrianDariRingkas(antrian ?? null)),
    bahanKehadiranDariKeadaan(keadaan)
  ).sandi;
  return usul !== null && KEHADIRAN.some((k) => k.nilai === usul) ? usul : null;
}

/** Gugatan dikenali dari nomor perkaranya - "Pdt.G" lawan "Pdt.P". */
function perkaraGugatan(nomorPerkara: string) {
  return /pdt\.\s*g/i.test(String(nomorPerkara || ""));
}

/**
 * Agenda yang disidangkan sore.
 *
 * Jawab-menjawab dan kesimpulan tidak menuntut kehadiran saksi, jadi ia dapat
 * ditaruh sesudah sidang-sidang yang menuntutnya - dan para pihak tidak perlu
 * menunggu sepanjang pagi untuk sepuluh menit pertukaran berkas.
 */
/**
 * Usulan agenda sidang berikutnya - satu langkah sesudah agenda hari ini.
 *
 * USULAN, bukan keputusan, persis seperti tanggal dua pekan yang sudah lebih
 * dahulu diusulkan borang ini. Perkara tidak selalu berjalan menurut urutan
 * baku: pembuktian dapat berulang, mediasi menyela, dan gugatan dapat diubah.
 * Karena itu yang dipulangkan hanya isian awal yang terlihat dan dapat
 * diganti - bukan nilai yang terkirim diam-diam.
 *
 * Agenda yang tidak dikenali memulangkan kosong. Menebak dari kalimat yang
 * tidak dikenali berarti menuliskan agenda karangan ke jadwal sidang orang.
 */
export function usulanAgendaBerikut(agendaSekarang: string) {
  const teks = String(agendaSekarang || "").trim().toLowerCase();
  const i = AGENDA_LAZIM.findIndex((a) => a.toLowerCase() === teks);
  if (i < 0 || i >= AGENDA_LAZIM.length - 1) return "";
  return AGENDA_LAZIM[i + 1];
}

// Aturan jam (jamSidangBerikut) dan tanggal (tanggalSidangBerikut, tambahHari)
// sidang berikutnya hidup di @/lib/bawaan-tunda - SATU tempat untuk HasilSidang
// dan CatatHasilRingkas. Tidak ada salinan di berkas ini (dijaga
// perbaikan-2okt-malam-jadwal-sidang.test.ts).

function hariIni() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Bahan sebutan para pihak dari keadaan sidang - nomor lebih dulu dari kata, lihat sebutan-pihak.ts. */
const sebutanDari = sebutanDariKeadaan;

/**
 * Usulan isian tunda dari riwayat sidang perkaranya (butir 14) - SATU pintu
 * untuk kedua layar: usulanTundaSidang di @/lib/bawaan-tunda. null bila
 * riwayatnya tidak terkirim (bot lama) - borangnya lalu memakai bawaan lama,
 * bukan menebak "sidang pertama" dari riwayat kosong.
 */
const usulanTunda = usulanTundaSidang;

/** Membuka bungkus { ok, data } - membacanya langsung selalu keliru dan tidak berbunyi. */
async function bukaBungkus<T>(balasan: Response): Promise<T> {
  return ((await balasan.json()) as { data?: T })?.data ?? ({} as T);
}

/**
 * Court Calendar perkara (rencana majelis) - dibaca terpisah dari keadaan
 * sidang supaya riwayat tetap hanya dua pembacaan SIPP. Gagal / bot lama /
 * tabel tak terjangkau = null: tanggal sidang berikutnya jatuh ke dua pekan.
 */
async function bacaKalender(perkaraId: number | string): Promise<RencanaKalender[] | null> {
  try {
    const balasan = await fetch(
      apiPath(`/api/aleta-ecourt/sidang/kalender?perkaraId=${encodeURIComponent(String(perkaraId))}`),
      { cache: "no-store" }
    );
    const isi = await bukaBungkus<{ available?: boolean; ok?: boolean; kalender?: unknown }>(balasan);
    if (isi.available === false || isi.ok === false || !Array.isArray(isi.kalender)) return null;
    return (isi.kalender as RencanaKalender[]).filter((r) => r && typeof r.tanggal === "string");
  } catch {
    return null;
  }
}

export function HasilSidang({ jadwalId }: { jadwalId: string }) {
  const [keadaan, setKeadaan] = useState<KeadaanSidang | null>(null);
  // Antrian sidang + atas nama siapa tombolnya menulis ke SIPP (7 Okt 2026).
  const [antrian, setAntrian] = useState<AntrianSidangRingkas>(null);
  /* F3.2: kehadiran rinci per orang sidang ini (null = tidak terbaca). */
  const [kehadiranRinci, setKehadiranRinci] = useState<KehadiranOrang[] | null>(null);
  const [atasNama, setAtasNama] = useState<AtasNamaSipp>(null);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusPutusan[]>([]);

  /** Satu pilihan, bukan dua borang terbuka bersamaan. */
  const [jalan, setJalan] = useState<"" | "tunda" | "putus">("");

  const [alasanTunda, setAlasanTunda] = useState("");
  const [tanggalBerikut, setTanggalBerikut] = useState("");
  const [jamBerikut, setJamBerikut] = useState("09:00");
  const [agendaBerikut, setAgendaBerikut] = useState("");
  const [dihadiri, setDihadiri] = useState(KEHADIRAN_BAWAAN);
  // Riwayat + Court Calendar disimpan supaya usulan dapat disusun ulang ketika
  // kehadirannya diganti; isian yang sudah disentuh tangan tidak ditimpa.
  const [riwayat, setRiwayat] = useState<RiwayatTunda>(null);
  const [usulan, setUsulan] = useState<BawaanTunda | null>(null);
  const [alasanDisentuh, setAlasanDisentuh] = useState(false);
  const [agendaDisentuh, setAgendaDisentuh] = useState(false);
  const [tanggalDisentuh, setTanggalDisentuh] = useState(false);

  /**
   * Tanggal putusan - bawaannya HARI INI, tetapi disetel sesudah layarnya
   * hidup, bukan saat nilai awalnya disusun.
   *
   * Next.js menggambar komponen ini sekali di peladen sebelum mengirimkannya.
   * Peladennya berjam UTC, peramban petugas berjam WITA - dan di antara pukul
   * 00:00 dan 08:00 WITA keduanya menyebut HARI YANG BERBEDA. Nilai awal yang
   * dihitung di peladen karena itu akan berselisih dengan yang dihitung
   * peramban: React memperingatkan, lalu memakai salah satunya - dan yang
   * dipakainya adalah tanggal peladen, yaitu kemarin.
   */
  const [tanggalPutus, setTanggalPutus] = useState("");
  useEffect(() => {
    setTanggalPutus((lama) => lama || hariIni());
  }, []);
  const [statusId, setStatusId] = useState("");
  const [verstek, setVerstek] = useState(false);

  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [sibuk, setSibuk] = useState(false);
  /** Pertanyaan jam kerja dari bot (keputusan 104) - null bila tidak ada. */
  const [tanyaJam, setTanyaJam] = useState<string | null>(null);
  const [sudahTertulis, setSudahTertulis] = useState(false);

  const muat = useCallback(async () => {
    setGalatMuat(null);
    try {
      const balasan = await fetch(apiPath(`/api/aleta-ecourt/sidang-tunda?jadwalId=${jadwalId}`), {
        cache: "no-store",
      });
      const isi = await bukaBungkus<{
        ok: boolean;
        alasan?: string;
        keadaan?: KeadaanSidang;
        riwayat?: RiwayatTunda;
        antrian?: AntrianSidangRingkas;
        atasNama?: AtasNamaSipp;
        kehadiranRinci?: KehadiranOrang[] | null;
      }>(balasan);
      if (!isi.ok || !isi.keadaan) {
        setGalatMuat(isi.alasan || "Jadwal sidang tidak ditemukan.");
        return;
      }
      setKeadaan(isi.keadaan);
      setAntrian(isi.antrian ?? null);
      setKehadiranRinci(isi.kehadiranRinci ?? null);
      setAtasNama(isi.atasNama ?? null);
      // Court Calendar dan email/persetujuan e-Court dibaca terpisah (null =
      // tak terbaca -> dua pekan / aturan tanpa email; tidak ditebak).
      const [kalender, kontak] = isi.riwayat
        ? await Promise.all([bacaKalender(isi.keadaan.perkaraId), bacaKontakPihak(isi.keadaan.perkaraId)])
        : [null, null];
      const riw: RiwayatTunda = isi.riwayat ? { ...isi.riwayat, kalender, kontak } : null;
      setRiwayat(riw);
      // Bawaan dari riwayat sidang perkaranya (butir 14, 30 Sep 2026) - hanya
      // mengisi kotak yang masih kosong; semuanya tetap dapat diganti.
      // Kehadiran mengikuti antrian sidang bila tercatat (7 Okt 2026).
      const hadirAntrian =
        kehadiranDariAntrian(isi.antrian) ?? hadirDariRinci(isi.kehadiranRinci, isi.antrian, isi.keadaan); /* F3.2 */
      const usul = usulanTunda(isi.keadaan, riw, hadirAntrian);
      setUsulan(usul);
      if (usul) {
        setDihadiri(usul.kehadiran);
        setAlasanTunda((lama) => lama || usul.alasan);
        setAgendaBerikut((lama) => lama || usul.agenda);
      }
      // Yang sudah tercatat pada barisnya dipakai kembali - tetapi hanya bila
      // angkanya salah satu dari yang berarti. Kolomnya kosong pada 1.373 dari
      // 20.171 baris, dan empat baris bernilai 10.
      const sudahAda = Number(isi.keadaan.dihadiriOleh);
      if (KEHADIRAN.some((k) => k.nilai === sudahAda)) setDihadiri(sudahAda);
      else if (!usul && hadirAntrian) setDihadiri(hadirAntrian);

      // Usulan tanggal dan jam sidang berikutnya - aturan BERSAMA dengan
      // CatatHasilRingkas (@/lib/bawaan-tunda): mengikuti Court Calendar bila
      // kedua pihak pernah hadir, selain itu dua pekan; jam menurut agendanya.
      // Keduanya USULAN: panitera sidang tetap dapat menggantinya, dan hari
      // liburnya tetap diperiksa peladen.
      const tgl = String(isi.keadaan.tanggalSidang || "").slice(0, 10);
      setTanggalBerikut(usul ? usul.tanggal : tambahHari(tgl, 14));
      // Tanggal putusan = tanggal SIDANG yang diputus (uji rilis 9 Okt 2026),
      // bukan hari layar dibuka: sidang kemarin yang baru dicatat hari ini
      // diputus kemarin. Hari ini hanya cadangan bila tanggal sidangnya kosong.
      if (/^\d{4}-\d{2}-\d{2}$/.test(tgl)) setTanggalPutus(tgl);
    } catch (e) {
      setGalatMuat(e instanceof Error ? e.message : "Jadwal sidang tidak dapat dibaca.");
    }
  }, [jadwalId]);

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    void (async () => {
      try {
        const balasan = await fetch(apiPath("/api/aleta-ecourt/sidang-putus"), { cache: "no-store" });
        const isi = await bukaBungkus<{ ok: boolean; daftar?: StatusPutusan[] }>(balasan);
        if (isi.ok && Array.isArray(isi.daftar)) {
          setStatus(isi.daftar);
          // Bawaan Dikabulkan - yang paling sering, terukur 8.935 dari 9.993
          // putusan satker. Bawaan yang jarang membuat orang menggantinya tiap
          // kali, dan yang sering diganti cepat menjadi yang tidak dibaca.
          const dikabulkan = isi.daftar.find((s) => /dikabulkan/i.test(s.nama));
          if (dikabulkan) setStatusId(String(dikabulkan.id));
        }
      } catch {
        // Daftar status yang gagal dimuat menyisakan pilihannya kosong -
        // borang tundanya tetap jalan.
      }
    })();
  }, []);

  /** Jam ikut agenda begitu agendanya diketik - tetapi tidak menimpa yang sudah disetel tangan. */
  const [jamDisetelTangan, setJamDisetelTangan] = useState(false);
  useEffect(() => {
    if (jamDisetelTangan) return;
    setJamBerikut(jamSidangBerikut(agendaBerikut, alasanTunda));
  }, [agendaBerikut, alasanTunda, jamDisetelTangan]);

  /**
   * Tanggal ikut alasan: ditunda karena MEDIASI = 3 minggu (mendahului Court
   * Calendar), selain itu menurut usulan. Yang sudah disetel tangan tidak ditimpa.
   */
  useEffect(() => {
    if (!keadaan || tanggalDisentuh) return;
    const dasar = usulan?.dasar ?? dasarTanggalKosong(String(keadaan.tanggalSidang || "").slice(0, 10));
    setTanggalBerikut(tanggalJamUntuk(dasar, alasanTunda, agendaBerikut, dihadiri).tanggal);
  }, [keadaan, usulan, alasanTunda, agendaBerikut, dihadiri, tanggalDisentuh]);

  /** Kehadiran diganti: alasan, agenda, dan tanggal yang belum disentuh tangan ikut disusun ulang. */
  const gantiKehadiran = useCallback(
    (nilai: number) => {
      setDihadiri(nilai);
      if (!keadaan || !riwayat) return;
      const usul = usulanTunda(keadaan, riwayat, nilai);
      setUsulan(usul);
      if (!usul) return;
      if (!alasanDisentuh) setAlasanTunda(usul.alasan);
      if (!agendaDisentuh) setAgendaBerikut(usul.agenda);
      if (!tanggalDisentuh) setTanggalBerikut(usul.tanggal);
    },
    [keadaan, riwayat, alasanDisentuh, agendaDisentuh, tanggalDisentuh]
  );

  const kirim = useCallback(
    async (kering: boolean, pilihJam?: PilihJamKerja) => {
      if (!keadaan || !jalan) return;
      setSibuk(true);
      try {
        const alamat = jalan === "tunda" ? "/api/aleta-ecourt/sidang-tunda" : "/api/aleta-ecourt/sidang-putus";
        const muatan =
          jalan === "tunda"
            ? {
                jadwalId: keadaan.jadwalId,
                perkaraId: keadaan.perkaraId,
                alasanTunda,
                tanggalBerikut,
                jamBerikut,
                jamSekarang: keadaan.jamSidang,
                agendaBerikut,
                dihadiriOleh: dihadiri,
                ruangId: keadaan.ruanganId,
                kering,
              }
            : {
                jalur: "sidang",
                jadwalId: keadaan.jadwalId,
                perkaraId: keadaan.perkaraId,
                statusPutusanId: Number(statusId),
                tanggalPutus,
                verstek: verstek ? "Y" : "T",
                jamSekarang: keadaan.jamSidang,
                dihadiriOleh: dihadiri,
                ruangId: keadaan.ruanganId,
                kering,
              };

        const balasan = await fetch(apiPath(alamat), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(kering ? muatan : { ...muatan, tanyaJamKerja: true, ...(pilihJam ? { jamKerja: pilihJam } : {}) }),
        });
        const isi = await bukaBungkus<Hasil>(balasan);
        if (isi.perluPilihan || isi.kode === "di_luar_jam_kerja") {
          setTanyaJam(isi.pesan || isi.alasan || "");
          return;
        }
        setTanyaJam(null);
        setHasil(isi);
        if (isi.ok && kering === false) {
          setSudahTertulis(true);
          if (!isi.diantrekan) void muat();
        }
      } catch (e) {
        setHasil({ ok: false, alasan: e instanceof Error ? e.message : "Permintaan gagal." });
      } finally {
        setSibuk(false);
      }
    },
    [keadaan, jalan, alasanTunda, tanggalBerikut, jamBerikut, agendaBerikut, dihadiri, statusId, tanggalPutus, verstek, muat]
  );

  const lengkap = useMemo(() => {
    if (jalan === "tunda") {
      return Boolean(alasanTunda.trim() && tanggalBerikut && jamBerikut && agendaBerikut.trim());
    }
    if (jalan === "putus") return Boolean(statusId && tanggalPutus);
    return false;
  }, [jalan, alasanTunda, tanggalBerikut, jamBerikut, agendaBerikut, statusId, tanggalPutus]);

  const rencanaKering = hasil?.ok === true && hasil.kering === true;

  /**
   * ==========================================================================
   * SUDAH DICATAT ATAU BELUM - DAN KENAPA `ditunda` SAJA TIDAK CUKUP
   * ==========================================================================
   *
   * Sidang yang sudah DIPUTUS berbendera `ditunda = 'T'`. Begitu pula sidang
   * yang belum disentuh sama sekali: 'T' adalah nilai bawaan kolomnya.
   * Menutup borang atas benderanya saja berarti menutupnya bagi hampir setiap
   * sidang yang justru datang ke sini untuk dicatat.
   *
   * `adaHasilSidang` sudah memisahkan keduanya, dan sudah diukur atas 20.063
   * baris jadwal satker - termasuk 6.207 baris yang alasan tundanya berisi
   * angka "0" belaka. Dipakai ulang di sini, bukan ditulis lagi: aturan yang
   * disalin akan berbeda diam-diam begitu salah satunya diperbaiki.
   */
  const sudahDitunda = String(keadaan?.ditunda || "").toUpperCase() === "Y";
  const sudahPutus = adaHasilSidang(
    String(keadaan?.ditunda || "").toUpperCase() === "Y",
    String(keadaan?.alasanDitunda || "")
  );

  if (galatMuat) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-5 text-sm text-destructive">{galatMuat}</CardContent>
      </Card>
    );
  }
  if (!keadaan) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Membaca jadwal sidang…</CardContent>
      </Card>
    );
  }

  // Sumber tanggal yang SEDANG berlaku (menurut alasan + agenda yang tampak) -
  // diturunkan, bukan disimpan: tidak ada keadaan kedua yang dapat basi.
  const sumberDasarTanggal = tanggalJamUntuk(
    usulan?.dasar ?? dasarTanggalKosong(String(keadaan.tanggalSidang || "").slice(0, 10)),
    alasanTunda,
    agendaBerikut,
    dihadiri
  );
  const sebutanKontak = sebutanPihakPerkara(sebutanDari(keadaan));

  return (
    <div className="flex flex-col gap-4">
      {/* ================================================================= */}
      {/* Keadaan sidangnya - yang pertama dibutuhkan bukan borang,         */}
      {/* melainkan jawaban.                                                */}
      {/* ================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{keadaan.nomorPerkara}</CardTitle>
            {sudahDitunda ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Sudah ditunda</Badge>
            ) : sudahPutus ? (
              <Badge className="bg-sky-600 text-white hover:bg-sky-600">
                {hasilSidangPutusan(false, String(keadaan.alasanDitunda || ""))}
              </Badge>
            ) : (
              <Badge variant="outline">Belum dicatat</Badge>
            )}
          </div>
          <CardDescription>
            Sidang {String(keadaan.tanggalSidang).slice(0, 10)} pukul {keadaan.jamSidang || "—"} · agenda{" "}
            {keadaan.agenda || "—"}
            {keadaan.urutan ? ` · sidang ke-${keadaan.urutan}` : ""}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ================================================================= */}
      {/* RUANG SIDANG - sedang disidangkan, skors, lompat ke perkara lain  */}
      {/* (perbaikan 2 Okt 2026, butir 10). Hanya pada hari sidangnya.      */}
      {/* ================================================================= */}
      <PapanRuangSidang
        perkaraId={String(keadaan.perkaraId)}
        nomorPerkara={keadaan.nomorPerkara}
        tanggalSidang={String(keadaan.tanggalSidang).slice(0, 10)}
        hasilSidangSelesai={sudahDitunda || sudahPutus || sudahTertulis}
      />

      {/* Butir 33/36 (5 Okt 2026): panggil petugas & pihak - pop-up yang sama dengan Jadwal Sidang. */}
      <KartuPanggil
        perkaraId={String(keadaan.perkaraId)}
        tanggal={String(keadaan.tanggalSidang).slice(0, 10)}
        nomorPerkara={keadaan.nomorPerkara}
        agenda={keadaan.agenda || ""}
      />

      {/* ================================================================= */}
      {/* MEDIATOR - menu yang SAMA dengan tombol mediator di Jadwal Sidang */}
      {/* (perbaikan 1 Okt 2026, J1). Satu komponen untuk kedua layar.      */}
      {/* ================================================================= */}
      <KartuMediator
        perkaraId={String(keadaan.perkaraId)}
        nomorPerkara={keadaan.nomorPerkara}
        tanggalSidang={String(keadaan.tanggalSidang).slice(0, 10)}
        sebab={sebabBerbauMediasi(keadaan.agenda, String(keadaan.alasanDitunda || ""))}
      />

      {sudahDitunda || sudahPutus ? (
        <Card className="border-emerald-600/40 bg-emerald-500/5">
          <CardContent className="flex items-start gap-2 py-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>
              Hasil sidang ini sudah tercatat di SIPP. Mencatatnya sekali lagi akan
              melahirkan baris jadwal berganda — jadi blangkonya ditutup di sini, bukan
              dibiarkan terbuka dan ditolak belakangan.
            </span>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ============================================================= */}
          {/* SATU PILIHAN - ditunda ATAU diputus, tidak pernah keduanya    */}
          {/* ============================================================= */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Hasil sidang</CardTitle>
              <CardDescription>
                Sidang tidak dapat ditunda dan diputus sekaligus — pilih salah satu, lalu blangkonya muncul.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                variant={jalan === "tunda" ? "default" : "outline"}
                onClick={() => {
                  setJalan("tunda");
                  setHasil(null);
                }}
              >
                <PauseCircle className="mr-1.5 h-4 w-4" aria-hidden />
                Ditunda
              </Button>
              <Button
                type="button"
                size="lg"
                variant={jalan === "putus" ? "default" : "outline"}
                onClick={() => {
                  setJalan("putus");
                  setHasil(null);
                }}
              >
                <Gavel className="mr-1.5 h-4 w-4" aria-hidden />
                Diputus
              </Button>
            </CardContent>
          </Card>

          {jalan ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {jalan === "tunda" ? "Tunda sidang" : "Putus perkara"}
                </CardTitle>
                <CardDescription>
                  {jalan === "tunda"
                    ? "Yang dicatat di sini langsung masuk ke SIPP, atas nama panitera sidang perkara ini."
                    : "Mencatat bahwa hari ini perkaranya diputus. Amar dan pertimbangan hukumnya ditulis hakim belakangan lewat SIPP — di sini tidak ditanyakan."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {jalan === "tunda" ? (
                  <>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Alasan penundaan
                      <input
                        list="alasan-lazim"
                        value={alasanTunda}
                        onChange={(e) => {
                          setAlasanDisentuh(true);
                          setAlasanTunda(e.target.value);
                        }}
                        placeholder="pilih yang lazim, atau ketik sendiri"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      />
                      <datalist id="alasan-lazim">
                        {pilihanTunda(sebutanDari(keadaan), ALASAN_LAZIM, AGENDA_LAZIM).alasan.map((a) => (
                          <option key={a} value={a} />
                        ))}
                      </datalist>
                    </label>

                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Agenda sidang berikutnya
                      <input
                        list="agenda-lazim"
                        value={agendaBerikut}
                        onChange={(e) => {
                          setAgendaDisentuh(true);
                          setAgendaBerikut(e.target.value);
                        }}
                        placeholder="pilih yang lazim, atau ketik sendiri"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      />
                      <datalist id="agenda-lazim">
                        {pilihanTunda(sebutanDari(keadaan), ALASAN_LAZIM, AGENDA_LAZIM).agenda.map((a) => (
                          <option key={a} value={a} />
                        ))}
                      </datalist>
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                        Tanggal sidang berikutnya
                        <PemilihTanggalSidang
                          value={tanggalBerikut}
                          onChange={(v) => {
                            setTanggalDisentuh(true);
                            setTanggalBerikut(v);
                          }}
                          sebutan="Tanggal sidang berikutnya"
                          usulan={usulan?.tanggal}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        />
                        <span className="text-[0.7rem]" data-sumber-tanggal={tanggalDisentuh ? "manual" : sumberDasarTanggal.sumber}>
                          {tanggalDisentuh ? "Tanggal diganti manual." : usulanTanggalAwam(sumberDasarTanggal)}
                        </span>
                      </label>
                      <label className="flex min-w-[7rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                        Jam
                        <input
                          type="time"
                          value={jamBerikut}
                          onChange={(e) => {
                            setJamDisetelTangan(true);
                            setJamBerikut(e.target.value);
                          }}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        />
                        <span className="text-[0.7rem]">
                          {tundaKarenaMediasi(alasanTunda)
                            ? "Tundaan mediasi: pukul 09:00."
                            : jamSidangBerikut(agendaBerikut, alasanTunda) === "15:00"
                              ? "Jawab-menjawab dan kesimpulan disidangkan sore (15:00)."
                              : "Bawaannya pukul 09:00."}
                        </span>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                        Tanggal putusan
                        <PemilihTanggalSidang
                          value={tanggalPutus}
                          onChange={setTanggalPutus}
                          sebutan="Tanggal putusan"
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        />
                      </label>
                      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                        Jenis putusan
                        <NativeSelect value={statusId} onChange={(e) => setStatusId(e.target.value)}>
                          {status.length === 0 ? <option value="">— memuat —</option> : null}
                          {status.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.nama}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                      <label className="flex items-center gap-2 self-end pb-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={verstek}
                          onChange={(e) => setVerstek(e.target.checked)}
                          className="h-4 w-4"
                        />
                        Verstek
                      </label>
                    </div>

                    <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        Amar putusan diisi <strong>&quot;BELUM DIINPUT&quot;</strong> dan sumber hukumnya tetap —
                        persis seperti aplikasi antrian sidang. Naskahnya ditulis hakim lewat SIPP, dan
                        pencatatan hari ini tidak perlu menunggunya.
                      </span>
                    </p>
                  </>
                )}

                <label className="flex min-w-[12rem] flex-col gap-1 text-xs text-muted-foreground">
                  Kehadiran pihak
                  <NativeSelect value={String(dihadiri)} onChange={(e) => gantiKehadiran(Number(e.target.value))}>
                    {/* Yang SUDAH tercatat pada barisnya tetap ditampilkan
                        walau perkaranya permohonan - menyembunyikannya membuat
                        kotaknya kosong, dan kotak kosong terbaca sebagai belum
                        dipilih padahal SIPP menyimpan angkanya. */}
                    {KEHADIRAN.filter(
                      (k) => !k.hanyaGugatan || perkaraGugatan(keadaan.nomorPerkara) || k.nilai === dihadiri
                    ).map((k) => (
                      <option key={k.nilai} value={String(k.nilai)}>
                        {k.label}
                      </option>
                    ))}
                  </NativeSelect>
                </label>

                {/* F3.2: siapa yang tercatat hadir + usulan Dihadiri oleh. */}
                <UsulanKehadiranBlangko
                  kehadiran={kehadiranRinci}
                  antrian={antrianDariRingkas(antrian)}
                  bahan={bahanKehadiranDariKeadaan(keadaan)}
                  dihadiri={dihadiri}
                  pilihanSah={KEHADIRAN.map((k) => k.nilai)}
                  onPakai={gantiKehadiran}
                />

                {usulan ? (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground" data-kontak-pihak="">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{kalimatKontak(usulan.dasar.kontak, sebutanKontak.dua, sebutanKontak.satu)}</span>
                  </p>
                ) : null}

                {keteranganAntrian(antrian) ? (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground" data-antrian-sidang="">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{keteranganAntrian(antrian)} Kehadiran, jam mulai, dan ruang mengikuti antrian sidang.</span>
                  </p>
                ) : null}
                {kalimatAtasNama(atasNama) ? (
                  <p
                    data-atas-nama=""
                    className={
                      kalimatAtasNama(atasNama)!.ok
                        ? "flex items-start gap-2 text-xs text-muted-foreground"
                        : "flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
                    }
                  >
                    {kalimatAtasNama(atasNama)!.ok ? (
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    <span>{kalimatAtasNama(atasNama)!.teks}</span>
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={!lengkap || sibuk} onClick={() => void kirim(true)}>
                    <FileSearch className="mr-1.5 h-4 w-4" aria-hidden />
                    Lihat rencananya
                  </Button>
                  <Button
                    disabled={!rencanaKering || sibuk || sudahTertulis || atasNama?.ok === false}
                    onClick={() => void kirim(false)}
                    title={rencanaKering ? undefined : "Lihat rencananya lebih dahulu"}
                  >
                    {jalan === "tunda" ? (
                      <PauseCircle className="mr-1.5 h-4 w-4" aria-hidden />
                    ) : (
                      <Gavel className="mr-1.5 h-4 w-4" aria-hidden />
                    )}
                    Tulis ke SIPP
                  </Button>
                </div>
                {tanyaJam !== null ? (
                  <TanyaJamKerja pesan={tanyaJam} sibuk={sibuk} bawaan="sekarang" onPilih={(p) => void kirim(false, p)} />
                ) : null}
                {hasil?.diantrekan ? <KabarDiantrekan pesan={hasil.pesan || ""} /> : null}
                {!rencanaKering ? (
                  <p className="text-xs text-muted-foreground">
                    Tombol tulis baru terbuka sesudah rencananya dibaca — bukan supaya lebih lambat, melainkan
                    supaya tidak ada yang tertulis tanpa pernah dilihat.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {hasil ? (
        <Card className={cn(hasil.ok ? "" : "border-destructive/40")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {hasil.ok
                ? hasil.kering
                  ? "Rencana — belum ada yang tertulis"
                  : "Sudah tertulis ke SIPP"
                : "Ditolak"}
            </CardTitle>
            {hasil.ok && hasil.atasNama ? (
              <CardDescription>
                Atas nama {hasil.atasNama.namaLengkap || hasil.atasNama.username}
                {hasil.atasNama.putusanAtasNama && hasil.atasNama.putusanAtasNama !== hasil.atasNama.username
                  ? ` · putusannya atas nama ${hasil.atasNama.putusanAtasNama}`
                  : ""}
                {hasil.sidangBerikutnya
                  ? ` · sidang berikutnya ${hasil.sidangBerikutnya.tanggal} pukul ${hasil.sidangBerikutnya.jam}`
                  : ""}
                {hasil.putusan ? ` · ${hasil.putusan.status}${hasil.putusan.verstek ? " (verstek)" : ""}` : ""}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!hasil.ok ? (
              <p className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{hasil.alasan}</span>
              </p>
            ) : null}

            {(hasil.andaian ?? []).map((a) => (
              <p
                key={a}
                className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
              >
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{a}</span>
              </p>
            ))}

            {hasil.antrian ? (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  {hasil.antrian.ok
                    ? hasil.antrian.kering
                      ? "Antrian sidang akan ditandai selesai."
                      : `Antrian sidang ditandai selesai (${hasil.antrian.baris ?? 0} baris). Nol baris bukan error — tidak semua perkara mengambil nomor antrian.`
                    : `Antrian tidak tergerakkan: ${hasil.antrian.alasan}. Catatannya tetap sah dan tetap tersimpan.`}
                </span>
              </p>
            ) : null}

            {langkahUntukPetugas(hasil.rencana).length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  {langkahUntukPetugas(hasil.rencana).length} catatan akan ditulis ke SIPP.
                </p>
                {langkahUntukPetugas(hasil.rencana).map((l, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                    <p className="font-medium">{kalimatLangkah(l)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}


/**
 * ============================================================================
 * CATAT HASIL SIDANG LANGSUNG DARI BARIS ANTRIAN
 * ============================================================================
 *
 * Panitera sidang mencatat hasil belasan sidang dalam satu pagi, dan sampai
 * sekarang tiap satunya menuntut membuka nomor perkaranya, menunggu layar
 * Hasil Sidang termuat, lalu kembali ke daftar untuk perkara berikutnya.
 * Yang dicatat sendiri hanya dua hal: ditunda dengan alasan apa, atau diputus
 * dengan status apa.
 *
 * ============================================================================
 * MESINNYA SATU, TEMPATNYA DUA
 * ============================================================================
 *
 * Alamat, bentuk muatan, dan seluruh nilai bawaannya SAMA dengan layar Hasil
 * Sidang - itu sebabnya komponen ini duduk di berkas yang sama alih-alih di
 * berkasnya sendiri. Dua jalan menulis ke SIPP yang disusun terpisah akan
 * menyimpang diam-diam: yang satu diperbaiki, yang lain tidak, dan yang
 * menyimpang adalah apa yang tertulis di berkas perkara orang.
 *
 * ============================================================================
 * LANGSUNG DIEKSEKUSI, LALU RINGKASANNYA DIPERLIHATKAN (30 Sep 2026)
 * ============================================================================
 *
 * Butir 13 perbaikan 30 September 2026: "tidak perlu ada tombol lihat
 * rencana pada tombol tunda dan putus di jadwal sidang, cukup langsung
 * eksekusi saja". Dua tekan (rencana, lalu tulis) diganti SATU tekan yang
 * menulis; yang tertulis diperlihatkan SESUDAHNYA dari jawaban server
 * (`selesai` - baris demi baris yang sungguh tertulis), bukan dari rencana
 * yang disusun sebelumnya. Layar Hasil Sidang penuh (/sidang-tunda/<id>)
 * tetap memiliki langkah "Lihat rencananya" bagi yang ingin membacanya dulu.
 *
 * Yang tetap dijaga:
 *   - tombolnya baru hidup bila isiannya lengkap;
 *   - satu tekan = satu kiriman (sibuk menahan tekan kedua), dan sesudah
 *     tertulis borangnya berganti ringkasan - tidak ada tombol tulis kedua;
 *   - putus hanya menulis perkara_jadwal_sidang (butir 12) - lihat
 *     susunRencanaPutus di bot.
 *
 * Bawaan tunda (butir 14) disimpulkan dari riwayat sidang perkaranya -
 * src/lib/bawaan-tunda.ts, aturannya diukur atas 1.737 penundaan satker.
 */

/**
 * Kartu mediator di layar Hasil Sidang (J1). Terlipat sebagai bawaan - tidak
 * tiap sidang berurusan dengan mediasi - kecuali agenda atau alasan tundanya
 * memang menyebut mediasi (aturan yang sama dengan tombol di Jadwal Sidang).
 */
function KartuMediator({
  perkaraId,
  nomorPerkara,
  tanggalSidang,
  sebab,
}: {
  perkaraId: string;
  nomorPerkara: string;
  tanggalSidang: string;
  sebab: string;
}) {
  const [terbuka, setTerbuka] = useState(Boolean(sebab));
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">Mediator</CardTitle>
          <Button type="button" size="sm" variant="outline" aria-expanded={terbuka} onClick={() => setTerbuka((x) => !x)}>
            {terbuka ? "Tutup" : "Pilih mediator"}
          </Button>
        </div>
        <CardDescription>
          {sebab ? `Sidang ini berurusan dengan mediasi - ${sebab}. ` : ""}
          Penetapan mediator ditulis ke SIPP persis seperti blangko Penetapan Mediasi - diperiksa dulu, lalu
          dikonfirmasi. Jadwal pertemuan berikutnya, laporan, dan hasil mediasi tetap diisi di SIPP.
        </CardDescription>
      </CardHeader>
      {terbuka ? (
        <CardContent>
          <IsianMediator perkaraId={perkaraId} nomorPerkara={nomorPerkara} tanggalSidang={tanggalSidang} />
        </CardContent>
      ) : null}
    </Card>
  );
}

/**
 * Pilih dari daftar, atau ketik sendiri. Nilai yang tidak ada di daftar
 * membuka kotak ketik dengan sendirinya - usulan yang dikarang aturan tetap
 * dapat diganti, dan kalimat petugas sendiri tetap dapat ditulis.
 */
function PilihAtauKetik({
  nilai,
  onUbah,
  pilihan,
  label,
  className,
}: {
  nilai: string;
  onUbah: (nilai: string) => void;
  pilihan: string[];
  label: string;
  className?: string;
}) {
  const [ketik, setKetik] = useState(false);
  const adaDiDaftar = pilihan.includes(nilai);
  const modeKetik = ketik || (nilai.trim() !== "" && !adaDiDaftar);
  if (modeKetik) {
    return (
      <span className="flex gap-1">
        <input
          value={nilai}
          onChange={(e) => onUbah(e.target.value)}
          aria-label={label}
          placeholder="Ketik sendiri"
          className={cn("h-8 w-full rounded-md border bg-background px-2 text-sm", className)}
        />
        <button
          type="button"
          className="shrink-0 rounded-md border px-1.5 text-[11px] text-muted-foreground hover:bg-muted"
          title="Kembali memilih dari daftar"
          onClick={() => {
            setKetik(false);
            if (!adaDiDaftar) onUbah("");
          }}
        >
          daftar
        </button>
      </span>
    );
  }
  return (
    <NativeSelect
      value={nilai}
      aria-label={label}
      onChange={(e) => {
        if (e.target.value === "__ketik__") {
          setKetik(true);
          return;
        }
        onUbah(e.target.value);
      }}
      className={cn("h-8 text-sm", className)}
    >
      <option value="">Pilih…</option>
      {pilihan.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
      <option value="__ketik__">Lainnya - ketik sendiri…</option>
    </NativeSelect>
  );
}

export function CatatHasilRingkas({
  jadwalId,
  nomorPerkara,
  jalan,
  onTutup,
  onSelesai,
}: {
  jadwalId: string;
  nomorPerkara: string;
  jalan: "tunda" | "putus";
  onTutup: () => void;
  onSelesai: () => void;
}) {
  const [keadaan, setKeadaan] = useState<KeadaanSidang | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatTunda>(null);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  /** Dinaikkan oleh "Coba lagi" supaya jadwal dibaca ulang tanpa menutup menu. */
  const [muatKe, setMuatKe] = useState(0);
  const [status, setStatus] = useState<StatusPutusan[]>([]);

  // Menu ini tidak punya tombol Tutup (22 Okt 2026): tertutup sendiri sesudah
  // tersimpan, dan bila ditekan di luarnya atau Esc tanpa menyimpan.
  const wadah = useRef<HTMLDivElement | null>(null);
  const tutupRef = useRef(onTutup);
  useEffect(() => {
    tutupRef.current = onTutup;
  }, [onTutup]);
  /** Penjaga SINKRON klik ganda: state `sibuk` baru berlaku sesudah digambar ulang. */
  const sedangKirim = useRef(false);

  const [alasanTundaIsi, setAlasanTunda] = useState("");
  const [tanggalBerikutIsi, setTanggalBerikut] = useState("");
  // 22 Okt 2026: tanggal usulan aturan, ditandai di kalender pemilih tanggal.
  const [tanggalUsulan, setTanggalUsulan] = useState("");
  const [jamBerikutIsi, setJamBerikut] = useState("09:00");
  const [agendaBerikutIsi, setAgendaBerikut] = useState("");
  const [dihadiri, setDihadiri] = useState(KEHADIRAN_BAWAAN);
  // Isian yang sudah disentuh tangan tidak ditimpa usulan lagi ketika
  // kehadirannya diganti.
  const [alasanDisentuh, setAlasanDisentuh] = useState(false);
  const [agendaDisentuh, setAgendaDisentuh] = useState(false);
  const [tanggalDisentuh, setTanggalDisentuh] = useState(false);
  const [jamDisentuh, setJamDisentuh] = useState(false);
  const [usulan, setUsulan] = useState<BawaanTunda | null>(null);

  // Langsung hari ini, TANPA efek - berbeda dari HasilSidang, dan sebabnya
  // ada pada tempatnya dipasang. Borang ini hanya lahir sesudah tombolnya
  // ditekan, jadi ia tidak pernah digambar peladen; selisih jam UTC/WITA yang
  // memaksa HasilSidang menunda penyetelannya tidak dapat terjadi di sini.
  const [tanggalPutus, setTanggalPutus] = useState(() => hariIni());
  const [statusId, setStatusId] = useState("");
  const [verstek, setVerstek] = useState(false);

  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [sibuk, setSibuk] = useState(false);
  /** Pertanyaan jam kerja dari bot (keputusan 104) - null bila tidak ada. */
  const [tanyaJam, setTanyaJam] = useState<string | null>(null);
  const [sudahTertulis, setSudahTertulis] = useState(false);

  // Butir 25 (5 Okt 2026): ruang sidang + sidang keliling - seperti blangko
  // tunda SIPP. Bawaan: yang tercatat; keliling hanya bila sidang itu keliling.
  const [daftarRuangan, setDaftarRuangan] = useState<Ruangan[]>([]);
  const [ruangPilih, setRuangPilih] = useState<BawaanRuangSidang>({ ruanganId: "", keliling: false });
  // Antrian sidang + atas nama siapa tombolnya menulis ke SIPP (7 Okt 2026).
  const [antrian, setAntrian] = useState<AntrianSidangRingkas>(null);
  /* F3.2: kehadiran rinci per orang sidang ini (null = tidak terbaca). */
  const [kehadiranRinci, setKehadiranRinci] = useState<KehadiranOrang[] | null>(null);
  const [atasNama, setAtasNama] = useState<AtasNamaSipp>(null);
  const [kelilingDisentuh, setKelilingDisentuh] = useState(false);
  // Sidang ikrar talak (18 Okt 2026): dua tombol tunda (hadir belum siap / tidak
  // hadir) dan konfirmasi "ikrar dilaksanakan" menggantikan blangko putus biasa.
  const [ikrarTunda, setIkrarTunda] = useState<JenisTundaIkrar | null>(null);
  const [ikrarDilaksanakan, setIkrarDilaksanakan] = useState(false);

  useEffect(() => {
    void (async () => {
      setGalatMuat(null);
      try {
        const balasan = await fetch(apiPath(`/api/aleta-ecourt/sidang-tunda?jadwalId=${jadwalId}`), {
          cache: "no-store",
        });
        const isi = await bukaBungkus<{
          ok: boolean;
          alasan?: string;
          keadaan?: KeadaanSidang;
          riwayat?: RiwayatTunda;
          ruangan?: Ruangan[];
          antrian?: AntrianSidangRingkas;
          atasNama?: AtasNamaSipp;
          kehadiranRinci?: KehadiranOrang[] | null;
        }>(balasan);
        if (!isi.ok || !isi.keadaan) {
          setGalatMuat(isi.alasan || "Jadwal sidang tidak ditemukan.");
          return;
        }
        setKeadaan(isi.keadaan);
        setAntrian(isi.antrian ?? null);
        setKehadiranRinci(isi.kehadiranRinci ?? null);
        setAtasNama(isi.atasNama ?? null);
        const daftar = Array.isArray(isi.ruangan) ? isi.ruangan : [];
        setDaftarRuangan(daftar);
        // Ruang bawaan mengikuti antrian sidang (ruang tempat perkaranya disidangkan).
        setRuangPilih(bawaanRuangSidang(keadaanRuangMenurutAntrian(isi.keadaan, isi.antrian), daftar));
        const tgl = String(isi.keadaan.tanggalSidang || "").slice(0, 10);
        setTanggalBerikut(tambahHari(tgl, 14));
        // Tanggal putusan = tanggal SIDANG yang diputus, bukan hari blangko
        // dibuka (uji rilis 9 Okt 2026) - lihat HasilSidang.
        if (/^\d{4}-\d{2}-\d{2}$/.test(tgl)) setTanggalPutus(tgl);

        // Court Calendar dan email/persetujuan e-Court dibaca terpisah (null =
        // tak terbaca -> dua pekan / aturan tanpa email; tidak ditebak).
        const [kalender, kontak] = isi.riwayat
          ? await Promise.all([bacaKalender(isi.keadaan.perkaraId), bacaKontakPihak(isi.keadaan.perkaraId)])
          : [null, null];
        const riw: RiwayatTunda = isi.riwayat ? { ...isi.riwayat, kalender, kontak } : null;
        setRiwayat(riw);

        // Aturan tanggal dan jam BERSAMA dengan layar Hasil Sidang penuh -
        // @/lib/bawaan-tunda, bukan salinan di sini. Kehadiran mengikuti
        // antrian sidang bila tercatat (7 Okt 2026, kasus 273).
        const hadirAntrian =
          kehadiranDariAntrian(isi.antrian) ?? hadirDariRinci(isi.kehadiranRinci, isi.antrian, isi.keadaan); /* F3.2 */
        const usul = usulanTunda(isi.keadaan, riw, hadirAntrian);
        setUsulan(usul);
        if (usul) {
          // Bawaan dari riwayat sidang perkaranya (butir 14).
          setDihadiri(usul.kehadiran);
          setAlasanTunda(usul.alasan);
          setAgendaBerikut(usul.agenda);
          setJamBerikut(usul.jam);
          if (usul.tanggal) setTanggalBerikut(usul.tanggal);
          setTanggalUsulan(usul.tanggal || "");
        } else {
          // Bot lama tanpa riwayat: bawaan sebelumnya, apa adanya.
          const sudahAda = Number(isi.keadaan.dihadiriOleh);
          if (KEHADIRAN.some((k) => k.nilai === sudahAda)) setDihadiri(sudahAda);
          else if (hadirAntrian) setDihadiri(hadirAntrian);
          const usulAgenda = usulanAgendaBerikut(isi.keadaan.agenda);
          if (usulAgenda) {
            setAgendaBerikut(usulAgenda);
            setJamBerikut(jamSidangBerikut(usulAgenda));
          }
        }
      } catch (e) {
        setGalatMuat(e instanceof Error ? e.message : "Jadwal sidang tidak dapat dibaca.");
      }
    })();
  }, [jadwalId, muatKe]);

  useEffect(() => {
    if (jalan !== "putus") return;
    void (async () => {
      try {
        const balasan = await fetch(apiPath("/api/aleta-ecourt/sidang-putus"), { cache: "no-store" });
        const isi = await bukaBungkus<{ ok: boolean; daftar?: StatusPutusan[] }>(balasan);
        if (isi.ok && Array.isArray(isi.daftar)) {
          setStatus(isi.daftar);
          const dikabulkan = isi.daftar.find((s) => /dikabulkan/i.test(s.nama));
          if (dikabulkan) setStatusId(String(dikabulkan.id));
        }
      } catch {
        // Daftar status yang gagal dimuat menyisakan pilihannya kosong.
      }
    })();
  }, [jalan]);

  /** Kehadiran diganti: alasan & agenda yang belum disentuh ikut disusun ulang. */
  const gantiKehadiran = useCallback(
    (nilai: number) => {
      setDihadiri(nilai);
      if (!keadaan || !riwayat) return;
      if (String(keadaan.ikrarTalak || "").toUpperCase() === "Y") return;
      const usul = usulanTunda(keadaan, riwayat, nilai);
      setUsulan(usul);
      if (!usul) return;
      if (!alasanDisentuh) setAlasanTunda(usul.alasan);
      if (!agendaDisentuh) {
        setAgendaBerikut(usul.agenda);
        if (!jamDisentuh) setJamBerikut(usul.jam);
      }
      // Tanggal ikut kehadiran: kedua pihak hadir -> Court Calendar.
      if (!tanggalDisentuh) setTanggalBerikut(usul.tanggal);
      setTanggalUsulan(usul.tanggal || "");
    },
    [keadaan, riwayat, alasanDisentuh, agendaDisentuh, tanggalDisentuh, jamDisentuh]
  );

  // Jam dan tanggal ikut alasan + agenda yang SEDANG tampak: tundaan mediasi =
  // 3 minggu pukul 09:00 (mendahului Court Calendar dan aturan sore). Yang
  // sudah disetel tangan tidak ditimpa. Aturannya satu - @/lib/bawaan-tunda.
  const sidangIkrar = String(keadaan?.ikrarTalak || "").toUpperCase() === "Y";
  const modeIkrarTunda = sidangIkrar && jalan === "tunda";
  const modeIkrarPutus = sidangIkrar && jalan === "putus";

  // Sidang ikrar talak: isian bawaan DITURUNKAN saat menggambar dari pilihan tombol
  // (hadir belum siap / tidak hadir) - bukan disalin lewat efek. Isian yang sudah
  // disentuh tangan petugas tidak ditimpa; semuanya dapat diubah sebelum disimpan.
  const jenisIkrar: JenisTundaIkrar = ikrarTunda ?? (dihadiri === 3 || dihadiri === 4 ? "tidak-hadir" : "belum-siap");
  const bawaanIkrar =
    modeIkrarTunda && keadaan
      ? bawaanTundaIkrar(jenisIkrar, {
          tanggalSidang: String(keadaan.tanggalSidang || "").slice(0, 10),
          tanggalBht: keadaan.tanggalBht,
          tanggalPenetapanSidangIkrar: keadaan.tanggalPenetapanSidangIkrar,
        })
      : null;
  const alasanTunda = bawaanIkrar && !alasanDisentuh ? bawaanIkrar.alasan : alasanTundaIsi;
  const agendaBerikut = bawaanIkrar && !agendaDisentuh ? bawaanIkrar.agenda : agendaBerikutIsi;
  const tanggalBerikut = bawaanIkrar && !tanggalDisentuh ? bawaanIkrar.tanggal : tanggalBerikutIsi;
  const jamBerikut = bawaanIkrar && !jamDisentuh ? bawaanIkrar.jam : jamBerikutIsi;
  const pilihJenisIkrar = (nilai: JenisTundaIkrar) => {
    setIkrarTunda(nilai);
    setAlasanDisentuh(false);
    setAgendaDisentuh(false);
    setTanggalDisentuh(false);
    setJamDisentuh(false);
  };

  const peringatanIkrar = modeIkrarTunda && keadaan ? peringatanBatasIkrar(tanggalBerikut, keadaan) : "";

  useEffect(() => {
    if (!keadaan || modeIkrarTunda) return;
    const dasar = usulan?.dasar ?? dasarTanggalKosong(String(keadaan.tanggalSidang || "").slice(0, 10));
    const berikut = tanggalJamUntuk(dasar, alasanTunda, agendaBerikut, dihadiri);
    if (!tanggalDisentuh) setTanggalBerikut(berikut.tanggal);
    if (!jamDisentuh) setJamBerikut(berikut.jam);
  }, [keadaan, usulan, alasanTunda, agendaBerikut, dihadiri, tanggalDisentuh, jamDisentuh, modeIkrarTunda]);


  const pilihan = useMemo(() => pilihanTunda(keadaan ? sebutanDari(keadaan) : {}, ALASAN_LAZIM, AGENDA_LAZIM), [keadaan]);

  const kirim = useCallback(async (pilihJam?: PilihJamKerja) => {
    if (!keadaan || sibuk || sudahTertulis) return;
    // Klik ganda dalam satu helaan napas: `sibuk` belum sempat digambar ulang.
    if (sedangKirim.current) return;
    sedangKirim.current = true;
    setSibuk(true);
    try {
      const alamat = jalan === "tunda" ? "/api/aleta-ecourt/sidang-tunda" : "/api/aleta-ecourt/sidang-putus";
      const muatan =
        jalan === "tunda"
          ? {
              jadwalId: keadaan.jadwalId,
              perkaraId: keadaan.perkaraId,
              alasanTunda,
              tanggalBerikut,
              jamBerikut,
              jamSekarang: keadaan.jamSidang,
              agendaBerikut,
              dihadiriOleh: dihadiri,
              ruangId: keadaan.ruanganId,
              ...muatanRuangSidang(ruangPilih, "tunda"),
              kering: false,
            }
          : {
              jalur: "sidang",
              jadwalId: keadaan.jadwalId,
              perkaraId: keadaan.perkaraId,
              ...(modeIkrarPutus
                ? { ikrarDilaksanakan: true, tanggalPutus: String(keadaan.tanggalSidang || "").slice(0, 10) }
                : { statusPutusanId: Number(statusId), tanggalPutus, verstek: verstek ? "Y" : "T" }),
              jamSekarang: keadaan.jamSidang,
              dihadiriOleh: dihadiri,
              ruangId: keadaan.ruanganId,
              ...muatanRuangSidang(ruangPilih, "putus"),
              kering: false,
            };
      const balasan = await fetch(apiPath(alamat), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...muatan, tanyaJamKerja: true, ...(pilihJam ? { jamKerja: pilihJam } : {}) }),
      });
      const isi = await bukaBungkus<Hasil>(balasan);
      if (isi.perluPilihan || isi.kode === "di_luar_jam_kerja") {
        setTanyaJam(isi.pesan || isi.alasan || "");
        return;
      }
      setTanyaJam(null);
      setHasil(isi);
      if (isi.ok && isi.kering !== true) {
        setSudahTertulis(true);
        // Diantrekan: blangko tetap terbuka supaya kabarnya terbaca.
        if (!isi.diantrekan) onSelesai();
      }
    } catch (e) {
      setHasil({ ok: false, alasan: e instanceof Error ? e.message : "Permintaan gagal." });
    } finally {
      sedangKirim.current = false;
      setSibuk(false);
    }
  }, [
    keadaan,
    sibuk,
    sudahTertulis,
    jalan,
    alasanTunda,
    tanggalBerikut,
    jamBerikut,
    agendaBerikut,
    dihadiri,
    statusId,
    tanggalPutus,
    verstek,
    ruangPilih,
    onSelesai,
    modeIkrarPutus,
  ]);

  const lengkap =
    jalan === "tunda"
      ? // Sidang ikrar yang melewati batas 6 bulan tidak boleh disimpan (bot juga menolak).
        Boolean(alasanTunda.trim() && tanggalBerikut && jamBerikut && agendaBerikut.trim()) && !peringatanIkrar
      : modeIkrarPutus
        ? ikrarDilaksanakan
        : Boolean(statusId && tanggalPutus);

  // TERTUTUP SENDIRI - tanpa tombol Tutup (permintaan hakim, 22 Okt 2026).
  // Ditekan di luar menu atau Esc menutupnya tanpa menyimpan; selama server
  // sedang menulis, keduanya diabaikan supaya tulisan yang berjalan tidak
  // kehilangan layarnya. Tombol tunda | putus pada baris tidak dihitung "di
  // luar": menekannya sendiri yang membuka atau mengganti menu.
  useEffect(() => {
    const luar = (e: MouseEvent) => {
      const sasaran = e.target;
      if (!(sasaran instanceof Element) || sasaran === document.documentElement) return;
      if (sedangKirim.current) return;
      const kotak = wadah.current?.closest("td") ?? wadah.current;
      if (kotak?.contains(sasaran)) return;
      if (sasaran.closest("[data-tombol-tunda-putus]")) return;
      tutupRef.current();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || sedangKirim.current) return;
      tutupRef.current();
    };
    document.addEventListener("mousedown", luar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", luar);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  // Catatan tambahan dari server yang layak dibaca sebelum menu hilang.
  const catatanSelesai: string[] = [];
  if (sudahTertulis) {
    if (hasil?.formIkrar && !hasil.formIkrar.ok) {
      catatanSelesai.push("Form ikrar talak di SIPP belum terisi - isi dari baris sidang ini.");
    }
    if (hasil?.edocIkrar && !hasil.edocIkrar.kering && !hasil.edocIkrar.ok) {
      const sebab = hasil.edocIkrar.pesan ?? hasil.edocIkrar.alasan;
      catatanSelesai.push(
        `e-Doc penetapan ikrar belum terunggah${sebab ? `: ${sebab}` : "."} Unggah lewat tombol Isi form ikrar di baris sidang ini.`
      );
    }
    if (hasil?.antrian && !hasil.antrian.ok) catatanSelesai.push("Antrian sidang belum ikut ditandai selesai.");
  }
  const catatanLain = sudahTertulis ? (hasil?.andaian ?? []) : [];
  const perluDibaca = catatanSelesai.length > 0 || catatanLain.length > 0 || Boolean(hasil?.diantrekan);

  useEffect(() => {
    if (!sudahTertulis) return;
    const pewaktu = setTimeout(() => tutupRef.current(), perluDibaca ? 12000 : 1800);
    return () => clearTimeout(pewaktu);
  }, [sudahTertulis, perluDibaca]);

  if (galatMuat) {
    return (
      <div
        ref={wadah}
        data-menu-tunda-putus=""
        role="alert"
        className="flex flex-wrap items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{galatMuat}</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setMuatKe((n) => n + 1)}>
          Coba lagi
        </Button>
      </div>
    );
  }

  if (!keadaan) {
    return <div ref={wadah} data-menu-tunda-putus="" className="min-h-[3rem]" aria-busy="true" />;
  }

  if (sudahTertulis) {
    const tglBerikut = hasil?.sidangBerikutnya?.tanggal ?? tanggalBerikut;
    const jamBerikutTulis = hasil?.sidangBerikutnya?.jam ?? jamBerikut;
    const namaStatus = hasil?.putusan?.status ?? status.find((s) => String(s.id) === statusId)?.nama ?? "";
    const kalimat = hasil?.diantrekan
      ? hasil.pesan || "Diantrekan - dikerjakan pada jam kerja berikutnya."
      : jalan === "tunda"
        ? `Sidang ${nomorPerkara} ditunda ke ${sebutTanggalPanjang(tglBerikut)} pukul ${jamBerikutTulis}.`
        : modeIkrarPutus
          ? `Ikrar talak ${nomorPerkara} tercatat dilaksanakan.`
          : `Putusan ${nomorPerkara} tercatat${namaStatus ? `: ${namaStatus}${hasil?.putusan?.verstek || verstek ? " (verstek)" : ""}` : ""}.`;
    return (
      <div
        ref={wadah}
        data-menu-tunda-putus=""
        role="status"
        className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold" data-konfirmasi-simpan="">
            {kalimat}
          </p>
          {catatanSelesai.map((c) => (
            <p key={c} className="mt-1 flex items-start gap-1 text-xs text-amber-800 dark:text-amber-200">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{c}</span>
            </p>
          ))}
          {catatanLain.length > 0 ? (
            <details className="mt-1 text-xs">
              <summary className="cursor-pointer">Catatan</summary>
              {catatanLain.map((a) => (
                <p key={a} className="mt-0.5">
                  {a}
                </p>
              ))}
            </details>
          ) : null}
        </div>
      </div>
    );
  }

  const sumberDasarTanggal = tanggalJamUntuk(
    usulan?.dasar ?? dasarTanggalKosong(String(keadaan.tanggalSidang || "").slice(0, 10)),
    alasanTunda,
    agendaBerikut,
    dihadiri
  );
  const sebutanKontak = sebutanPihakPerkara(sebutanDari(keadaan));
  const kalimatNama = kalimatAtasNama(atasNama);

  return (
    <div ref={wadah} data-menu-tunda-putus="" className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {jalan === "tunda" ? (
          <PauseCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
        ) : (
          <Gavel className="h-4 w-4 text-primary" aria-hidden="true" />
        )}
        <span className="text-sm font-semibold">
          {jalan === "tunda" ? (sidangIkrar ? "Tunda sidang ikrar talak" : "Tunda sidang") : modeIkrarPutus ? "Ikrar talak" : "Catat putusan"}{" "}
          {nomorPerkara}
        </span>
        <Badge variant="muted">{keadaan.agenda || "tanpa agenda"}</Badge>
        {usulan ? <Badge variant="outline">sidang ke-{usulan.sidangKe}</Badge> : null}
      </div>

      {modeIkrarTunda ? (
        <div className="space-y-1" data-tunda-ikrar="">
          <span className="block text-xs font-medium text-muted-foreground">Keadaan sidang ikrar</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["belum-siap", "Pemohon hadir, belum siap membayar akibat perceraian"],
                ["tidak-hadir", "Pemohon tidak hadir"],
              ] as const
            ).map(([nilai, label]) => (
              <button
                key={nilai}
                type="button"
                aria-pressed={jenisIkrar === nilai}
                onClick={() => pilihJenisIkrar(nilai)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                  jenisIkrar === nilai
                    ? "border-amber-600 bg-amber-600 text-white"
                    : "border-amber-400 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/15"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {peringatanIkrar ? (
            <p
              data-batas-ikrar=""
              className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{peringatanIkrar} Penundaan tidak dapat disimpan - pilih tanggal paling lambat pada batas itu.</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {jalan === "tunda" ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs">
            <span className="mb-0.5 block font-medium text-muted-foreground">Alasan penundaan</span>
            <PilihAtauKetik
              label="Alasan penundaan"
              nilai={alasanTunda}
              pilihan={pilihan.alasan}
              onUbah={(v) => {
                setAlasanDisentuh(true);
                setAlasanTunda(v);
              }}
            />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block font-medium text-muted-foreground">Agenda berikutnya</span>
            <PilihAtauKetik
              label="Agenda sidang berikutnya"
              nilai={agendaBerikut}
              pilihan={pilihan.agenda}
              onUbah={(v) => {
                setAgendaDisentuh(true);
                setAgendaBerikut(v);
                if (!jamDisentuh) setJamBerikut(jamSidangBerikut(v, alasanTunda));
              }}
            />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block font-medium text-muted-foreground">Tanggal berikutnya</span>
            <PemilihTanggalSidang
              value={tanggalBerikut}
              onChange={(v) => {
                setTanggalDisentuh(true);
                setTanggalBerikut(v);
              }}
              sebutan="Tanggal sidang berikutnya"
              usulan={tanggalUsulan}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
            />
            {/* Dari mana tanggalnya - Court Calendar atau dua pekan. */}
            <span
              className="mt-0.5 block text-[10px] leading-tight text-muted-foreground"
              data-sumber-tanggal={tanggalDisentuh ? "manual" : sumberDasarTanggal.sumber}
            >
              {tanggalDisentuh ? "Tanggal diganti manual." : usulanTanggalAwam(sumberDasarTanggal)}
            </span>
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block font-medium text-muted-foreground">Jam</span>
            <input
              type="time"
              value={jamBerikut}
              onChange={(e) => {
                setJamDisentuh(true);
                setJamBerikut(e.target.value);
              }}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
            />
          </label>
        </div>
      ) : modeIkrarPutus ? (
        <div className="space-y-1.5" data-putus-ikrar="">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={ikrarDilaksanakan}
              onChange={(e) => setIkrarDilaksanakan(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Ikrar talak sudah dilaksanakan pada sidang{" "}
              <strong>{String(keadaan.tanggalSidang || "").slice(0, 10)}</strong>
            </span>
          </label>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs">
            <span className="mb-0.5 block font-medium text-muted-foreground">Status putusan</span>
            <NativeSelect value={statusId} onChange={(e) => setStatusId(e.target.value)} className="h-8 text-sm">
              <option value="">Pilih status</option>
              {status.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nama}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block font-medium text-muted-foreground">Tanggal putusan</span>
            <PemilihTanggalSidang
              value={tanggalPutus}
              onChange={setTanggalPutus}
              sebutan="Tanggal putusan"
              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
            />
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              checked={verstek}
              onChange={(e) => setVerstek(e.target.checked)}
              className="mb-1.5 h-4 w-4"
            />
            <span className="mb-1">Putusan verstek</span>
          </label>
        </div>
      )}

      {/* PILIHAN LAIN - terlipat. Yang jarang diubah (ruang sidang, sidang
          keliling, kehadiran pihak, dan dasar usulan) tidak dihapus; ia hanya
          tidak lagi memenuhi menu. Tetap ada di halaman sehingga isian
          bawaannya ikut terkirim walau tidak dibuka. */}
      <details className="text-xs" data-pilihan-lain="">
        <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
          Pilihan lain
        </summary>
        <div className="mt-2 space-y-2.5">
          {/* Butir 25 (5 Okt 2026): ruang sidang + sidang keliling, seperti blangko
              tunda SIPP. Tunda = untuk sidang BERIKUTNYA; putus = sidang INI
              (ditulis hanya bila diubah). */}
          <div className={cn("flex flex-wrap items-end gap-3", modeIkrarPutus && "hidden")} data-ruang-sidang-blangko="">
            <label className="block min-w-[14rem] text-xs sm:max-w-md">
              <span className="mb-0.5 block font-medium text-muted-foreground">
                {jalan === "tunda" ? "Ruang sidang berikutnya" : "Ruang sidang"}
              </span>
              <NativeSelect
                aria-label={jalan === "tunda" ? "Ruang sidang berikutnya" : "Ruang sidang"}
                value={ruangPilih.ruanganId}
                onChange={(e) => {
                  const id = e.target.value;
                  const ikut = kelilingUntukRuangan(daftarRuangan, id);
                  setRuangPilih((lama) => ({
                    ruanganId: id,
                    keliling: !kelilingDisentuh && ikut !== null ? ikut : lama.keliling,
                  }));
                }}
                className="h-8 text-sm"
              >
                {ruangPilih.ruanganId === "" || !ruanganMenurutId(daftarRuangan, ruangPilih.ruanganId) ? (
                  <option value="">{keadaan.ruangan ? `${keadaan.ruangan} (tercatat)` : "Seperti tercatat di SIPP"}</option>
                ) : null}
                {daftarRuangan.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.nama}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input
                type="checkbox"
                aria-label="Sidang keliling"
                checked={ruangPilih.keliling}
                onChange={(e) => {
                  setKelilingDisentuh(true);
                  const keliling = e.target.checked;
                  setRuangPilih((lama) => ({ ...lama, keliling }));
                }}
                className="h-4 w-4"
              />
              <span>Sidang keliling</span>
            </label>
          </div>

          <label className="block text-xs sm:max-w-md">
            <span className="mb-0.5 block font-medium text-muted-foreground">Kehadiran pihak</span>
            <NativeSelect
              value={String(dihadiri)}
              onChange={(e) => gantiKehadiran(Number(e.target.value))}
              className="h-8 text-sm"
            >
              {KEHADIRAN.filter(
                (k) => !k.hanyaGugatan || perkaraGugatan(keadaan.nomorPerkara) || k.nilai === dihadiri
              ).map((k) => (
                <option key={k.nilai} value={String(k.nilai)}>
                  {k.label}
                </option>
              ))}
            </NativeSelect>
          </label>

          {/* F3.2: siapa yang tercatat hadir + usulan Dihadiri oleh. */}
          <UsulanKehadiranBlangko
            kehadiran={kehadiranRinci}
            antrian={antrianDariRingkas(antrian)}
            bahan={bahanKehadiranDariKeadaan(keadaan)}
            dihadiri={dihadiri}
            pilihanSah={KEHADIRAN.map((k) => k.nilai)}
            onPakai={gantiKehadiran}
          />

          {jalan === "tunda" ? (
            <p className="text-[11px] text-muted-foreground">
              {tundaKarenaMediasi(alasanTunda)
                ? "Tundaan mediasi: pukul 09:00."
                : jamSidangBerikut(agendaBerikut, alasanTunda) === "15:00"
                  ? "Jawab-menjawab dan kesimpulan: pukul 15:00."
                  : "Bawaan pukul 09:00."}
            </p>
          ) : null}
          {usulan && jalan === "tunda" ? (
            <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                Usulan dari riwayat sidang: {usulan.penjelasan}
                {usulan.kehadiranTercatat ? " Kehadiran diambil dari yang sudah tercatat di SIPP." : ""} Semua
                isian dapat diganti.
              </span>
            </p>
          ) : null}
          {usulan && jalan === "tunda" ? (
            <p className="flex items-start gap-1 text-[11px] text-muted-foreground" data-kontak-pihak="">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{kalimatKontak(usulan.dasar.kontak, sebutanKontak.dua, sebutanKontak.satu)}</span>
            </p>
          ) : null}
          {modeIkrarTunda && bawaanIkrar ? (
            <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                {bawaanIkrar.penjelasan} Semua isian dapat diubah sebelum disimpan.
                {jenisIkrar === "belum-siap"
                  ? " Catatan: pada cerai talak, pembayaran akibat perceraian (nafkah iddah, mut’ah, dan sejenisnya) dapat diperintahkan sebelum ikrar talak, kecuali istri tidak keberatan (Buku II 2026)."
                  : ""}
              </span>
            </p>
          ) : null}
          {keteranganAntrian(antrian) ? (
            <p className="flex items-start gap-1 text-[11px] text-muted-foreground" data-antrian-sidang="">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{keteranganAntrian(antrian)} Kehadiran, jam mulai, dan ruang mengikuti antrian sidang.</span>
            </p>
          ) : null}
        </div>
      </details>

      {/* Hanya bila MENGHALANGI menyimpan (panitera sidang belum tercatat di
          SIPP); keterangan "atas nama siapa" yang berjalan baik tidak lagi
          ditampilkan - audit tetap ditulis di belakang. */}
      {kalimatNama && !kalimatNama.ok ? (
        <p
          data-atas-nama=""
          role="alert"
          className="flex items-start gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{kalimatNama.teks}</span>
        </p>
      ) : null}

      {hasil && !hasil.ok ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{hasil.alasan || "Belum tersimpan. Silakan coba lagi."}</span>
        </p>
      ) : null}
      {tanyaJam !== null ? <TanyaJamKerja pesan={tanyaJam} sibuk={sibuk} bawaan="sekarang" onPilih={(p) => void kirim(p)} /> : null}
      {hasil?.diantrekan ? <KabarDiantrekan pesan={hasil.pesan || ""} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className={cn(jalan === "tunda" ? "bg-amber-600 hover:bg-amber-700" : undefined)}
          disabled={!lengkap || sibuk || atasNama?.ok === false}
          onClick={() => void kirim()}
        >
          {sibuk ? "Menyimpan…" : hasil && !hasil.ok ? "Coba lagi" : "Simpan"}
        </Button>
        {!lengkap ? (
          <span className="text-xs text-muted-foreground">
            {jalan === "tunda"
              ? peringatanIkrar
                ? "Tanggal melewati batas 6 bulan ikrar - ubah tanggal berikutnya."
                : "Alasan, agenda, tanggal, dan jam harus terisi."
              : modeIkrarPutus
                ? "Centang bahwa ikrar sudah dilaksanakan."
                : "Pilih status putusan dan tanggalnya."}
          </span>
        ) : null}
      </div>
    </div>
  );
}
