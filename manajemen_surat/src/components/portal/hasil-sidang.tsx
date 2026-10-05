"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, Gavel, Info, PauseCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { adaHasilSidang, hasilSidangPutusan } from "@/lib/hasil-sidang";
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
} from "@/lib/bawaan-tunda";
import { bacaKontakPihak, kalimatKontak } from "@/lib/jadwal-sidang-kontak";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import { IsianMediator } from "@/components/portal/jadwal-sidang-1okt";
import { PapanRuangSidang } from "@/components/portal/jadwal-sidang-2okt";
import { KartuPanggil } from "@/components/portal/panggil-petugas";
import { sebabBerbauMediasi } from "@/lib/mediasi-sidang";
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
  dihadiriOleh?: number;
  /** Bahan sebutan para pihak dan bendera ikrar - bot 30 Sep 2026 ke atas. */
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  jenisPerkara?: string;
  ikrarTalak?: string;
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
};

type StatusPutusan = { id: number; nama: string; dipakai: number };

/**
 * Alasan penundaan yang lazim.
 *
 * Ditawarkan, bukan dipaksakan: daftar tertutup akan memaksa panitera sidang
 * memilih alasan yang bukan alasannya, dan alasan yang keliru pada berkas
 * perkara lebih buruk daripada alasan yang diketik panjang.
 */
const ALASAN_LAZIM = [
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

const AGENDA_LAZIM = [
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
      }>(balasan);
      if (!isi.ok || !isi.keadaan) {
        setGalatMuat(isi.alasan || "Jadwal sidang tidak ditemukan.");
        return;
      }
      setKeadaan(isi.keadaan);
      // Court Calendar dan email/persetujuan e-Court dibaca terpisah (null =
      // tak terbaca -> dua pekan / aturan tanpa email; tidak ditebak).
      const [kalender, kontak] = isi.riwayat
        ? await Promise.all([bacaKalender(isi.keadaan.perkaraId), bacaKontakPihak(isi.keadaan.perkaraId)])
        : [null, null];
      const riw: RiwayatTunda = isi.riwayat ? { ...isi.riwayat, kalender, kontak } : null;
      setRiwayat(riw);
      // Bawaan dari riwayat sidang perkaranya (butir 14, 30 Sep 2026) - hanya
      // mengisi kotak yang masih kosong; semuanya tetap dapat diganti.
      const usul = usulanTunda(isi.keadaan, riw);
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

      // Usulan tanggal dan jam sidang berikutnya - aturan BERSAMA dengan
      // CatatHasilRingkas (@/lib/bawaan-tunda): mengikuti Court Calendar bila
      // kedua pihak pernah hadir, selain itu dua pekan; jam menurut agendanya.
      // Keduanya USULAN: panitera sidang tetap dapat menggantinya, dan hari
      // liburnya tetap diperiksa peladen.
      const tgl = String(isi.keadaan.tanggalSidang || "").slice(0, 10);
      setTanggalBerikut(usul ? usul.tanggal : tambahHari(tgl, 14));
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
    async (kering: boolean) => {
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
          body: JSON.stringify(muatan),
        });
        const isi = await bukaBungkus<Hasil>(balasan);
        setHasil(isi);
        if (isi.ok && kering === false) {
          setSudahTertulis(true);
          void muat();
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
                    ? "Yang ditulis ini SIPP sungguhan beserta audit trail-nya, atas nama panitera sidang perkara ini."
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
                        <input
                          type="date"
                          value={tanggalBerikut}
                          onChange={(e) => {
                            setTanggalDisentuh(true);
                            setTanggalBerikut(e.target.value);
                          }}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        />
                        <span className="text-[0.7rem]" data-sumber-tanggal={tanggalDisentuh ? "manual" : sumberDasarTanggal.sumber}>
                          {tanggalDisentuh ? "Tanggal diganti manual." : `Tanggal ${sumberDasarTanggal.penjelasan}`}
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
                        <input
                          type="date"
                          value={tanggalPutus}
                          onChange={(e) => setTanggalPutus(e.target.value)}
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

                {usulan ? (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground" data-kontak-pihak="">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{kalimatKontak(usulan.dasar.kontak, sebutanKontak.dua, sebutanKontak.satu)}</span>
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={!lengkap || sibuk} onClick={() => void kirim(true)}>
                    <FileSearch className="mr-1.5 h-4 w-4" aria-hidden />
                    Lihat rencananya
                  </Button>
                  <Button
                    disabled={!rencanaKering || sibuk || sudahTertulis}
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

            {(hasil.rencana ?? []).length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  {hasil.rencana!.length} baris akan ditulis — termasuk barisnya di sys_audittrail.
                </p>
                {hasil.rencana!.map((l, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                    <p className="font-medium">
                      {l.aksi} · {l.tabel}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{l.keterangan}</p>
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
  const [status, setStatus] = useState<StatusPutusan[]>([]);

  const [alasanTunda, setAlasanTunda] = useState("");
  const [tanggalBerikut, setTanggalBerikut] = useState("");
  const [jamBerikut, setJamBerikut] = useState("09:00");
  const [agendaBerikut, setAgendaBerikut] = useState("");
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
  const [sudahTertulis, setSudahTertulis] = useState(false);

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
        }>(balasan);
        if (!isi.ok || !isi.keadaan) {
          setGalatMuat(isi.alasan || "Jadwal sidang tidak ditemukan.");
          return;
        }
        setKeadaan(isi.keadaan);
        const tgl = String(isi.keadaan.tanggalSidang || "").slice(0, 10);
        setTanggalBerikut(tambahHari(tgl, 14));

        // Court Calendar dan email/persetujuan e-Court dibaca terpisah (null =
        // tak terbaca -> dua pekan / aturan tanpa email; tidak ditebak).
        const [kalender, kontak] = isi.riwayat
          ? await Promise.all([bacaKalender(isi.keadaan.perkaraId), bacaKontakPihak(isi.keadaan.perkaraId)])
          : [null, null];
        const riw: RiwayatTunda = isi.riwayat ? { ...isi.riwayat, kalender, kontak } : null;
        setRiwayat(riw);

        // Aturan tanggal dan jam BERSAMA dengan layar Hasil Sidang penuh -
        // @/lib/bawaan-tunda, bukan salinan di sini.
        const usul = usulanTunda(isi.keadaan, riw);
        setUsulan(usul);
        if (usul) {
          // Bawaan dari riwayat sidang perkaranya (butir 14).
          setDihadiri(usul.kehadiran);
          setAlasanTunda(usul.alasan);
          setAgendaBerikut(usul.agenda);
          setJamBerikut(usul.jam);
          if (usul.tanggal) setTanggalBerikut(usul.tanggal);
        } else {
          // Bot lama tanpa riwayat: bawaan sebelumnya, apa adanya.
          const sudahAda = Number(isi.keadaan.dihadiriOleh);
          if (KEHADIRAN.some((k) => k.nilai === sudahAda)) setDihadiri(sudahAda);
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
  }, [jadwalId]);

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
    },
    [keadaan, riwayat, alasanDisentuh, agendaDisentuh, tanggalDisentuh, jamDisentuh]
  );

  // Jam dan tanggal ikut alasan + agenda yang SEDANG tampak: tundaan mediasi =
  // 3 minggu pukul 09:00 (mendahului Court Calendar dan aturan sore). Yang
  // sudah disetel tangan tidak ditimpa. Aturannya satu - @/lib/bawaan-tunda.
  useEffect(() => {
    if (!keadaan) return;
    const dasar = usulan?.dasar ?? dasarTanggalKosong(String(keadaan.tanggalSidang || "").slice(0, 10));
    const berikut = tanggalJamUntuk(dasar, alasanTunda, agendaBerikut, dihadiri);
    if (!tanggalDisentuh) setTanggalBerikut(berikut.tanggal);
    if (!jamDisentuh) setJamBerikut(berikut.jam);
  }, [keadaan, usulan, alasanTunda, agendaBerikut, dihadiri, tanggalDisentuh, jamDisentuh]);

  const pilihan = useMemo(() => pilihanTunda(keadaan ? sebutanDari(keadaan) : {}, ALASAN_LAZIM, AGENDA_LAZIM), [keadaan]);

  const kirim = useCallback(async () => {
    if (!keadaan || sibuk || sudahTertulis) return;
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
              kering: false,
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
              kering: false,
            };
      const balasan = await fetch(apiPath(alamat), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(muatan),
      });
      const isi = await bukaBungkus<Hasil>(balasan);
      setHasil(isi);
      if (isi.ok && isi.kering !== true) {
        setSudahTertulis(true);
        onSelesai();
      }
    } catch (e) {
      setHasil({ ok: false, alasan: e instanceof Error ? e.message : "Permintaan gagal." });
    } finally {
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
    onSelesai,
  ]);

  const lengkap =
    jalan === "tunda"
      ? Boolean(alasanTunda.trim() && tanggalBerikut && jamBerikut && agendaBerikut.trim())
      : Boolean(statusId && tanggalPutus);

  if (galatMuat) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{galatMuat}</span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onTutup}>
          Tutup
        </Button>
      </div>
    );
  }

  if (!keadaan) {
    return <p className="text-sm text-muted-foreground">Memuat keadaan sidang {nomorPerkara}…</p>;
  }

  if (sudahTertulis) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">
            {jalan === "tunda" ? "Penundaan" : "Hasil sidang putus"} {nomorPerkara} tercatat di SIPP.
          </p>
          {hasil?.atasNama ? (
            <p className="text-xs">
              Atas nama {hasil.atasNama.namaLengkap} ({hasil.atasNama.username})
              {hasil.sidangBerikutnya
                ? ` · sidang berikutnya ${hasil.sidangBerikutnya.tanggal} pukul ${hasil.sidangBerikutnya.jam}`
                : ""}
              {hasil.putusan ? ` · ${hasil.putusan.status}${hasil.putusan.verstek ? " (verstek)" : ""}` : ""}.
            </p>
          ) : null}
          {/* RINGKASAN YANG DITULIS - dari jawaban server sesudah menulis
              (baris yang SUNGGUH tertulis), bukan dari rencana. */}
          {(hasil?.selesai ?? []).length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-xs" aria-label="Yang ditulis ke SIPP">
              {(hasil?.selesai ?? []).map((l, n) => (
                <li key={`${l.tabel}-${n}`}>
                  <span className="font-mono">{l.tabel}</span> {l.aksi} - {l.keterangan}
                </li>
              ))}
            </ul>
          ) : null}
          {(hasil?.andaian ?? []).map((a) => (
            <p key={a} className="mt-1 flex items-start gap-1 text-xs text-amber-800 dark:text-amber-200">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{a}</span>
            </p>
          ))}
          {hasil?.antrian ? (
            <p className="mt-1 text-xs">
              {hasil.antrian.ok
                ? `Antrian sidang ditandai selesai (${hasil.antrian.baris ?? 0} baris).`
                : `Antrian tidak tergerakkan: ${hasil.antrian.alasan}.`}
            </p>
          ) : null}
        </div>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onTutup}>
          Tutup
        </Button>
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

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {jalan === "tunda" ? (
          <PauseCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
        ) : (
          <Gavel className="h-4 w-4 text-primary" aria-hidden="true" />
        )}
        <span className="text-sm font-semibold">
          {jalan === "tunda" ? "Tunda sidang" : "Catat putusan"} {nomorPerkara}
        </span>
        <Badge variant="muted">{keadaan.agenda || "tanpa agenda"}</Badge>
        {usulan ? <Badge variant="outline">sidang ke-{usulan.sidangKe}</Badge> : null}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onTutup}>
          Tutup
        </Button>
      </div>

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
            <input
              type="date"
              value={tanggalBerikut}
              onChange={(e) => {
                setTanggalDisentuh(true);
                setTanggalBerikut(e.target.value);
              }}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
            />
            {/* Dari mana tanggalnya - Court Calendar atau dua pekan. */}
            <span
              className="mt-0.5 block text-[10px] leading-tight text-muted-foreground"
              data-sumber-tanggal={tanggalDisentuh ? "manual" : sumberDasarTanggal.sumber}
            >
              {tanggalDisentuh ? "Tanggal diganti manual." : `Tanggal ${sumberDasarTanggal.penjelasan}`}
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
            <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
              {tundaKarenaMediasi(alasanTunda)
                ? "Tundaan mediasi: 09:00."
                : jamSidangBerikut(agendaBerikut, alasanTunda) === "15:00"
                  ? "Jawab-menjawab dan kesimpulan: 15:00."
                  : "Bawaan pukul 09:00."}
            </span>
          </label>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs">
            <span className="mb-0.5 block font-medium text-muted-foreground">Status putusan</span>
            <NativeSelect
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="h-8 text-sm"
            >
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
            <input
              type="date"
              value={tanggalPutus}
              onChange={(e) => setTanggalPutus(e.target.value)}
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

      {jalan === "putus" ? (
        <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Hanya hasil sidang di jadwal sidang yang dicatat. Putusan akhir, audit putusannya, dan tahapan
            perkara tidak ditulis dari tombol ini.
          </span>
        </p>
      ) : null}

      {hasil && !hasil.ok ? (
        <p className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{hasil.alasan || "Permintaan ditolak server."}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className={cn(jalan === "tunda" ? "bg-amber-600 hover:bg-amber-700" : undefined)}
          disabled={!lengkap || sibuk}
          onClick={() => void kirim()}
        >
          {sibuk ? "Menulis…" : jalan === "tunda" ? "Tunda sekarang" : "Catat putus"}
        </Button>
        {!lengkap ? (
          <span className="text-xs text-muted-foreground">
            {jalan === "tunda"
              ? "Alasan, agenda, tanggal, dan jam harus terisi."
              : "Status putusan dan tanggalnya harus terisi."}
          </span>
        ) : null}
      </div>
    </div>
  );
}
