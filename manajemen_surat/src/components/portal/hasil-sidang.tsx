"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, Gavel, Info, PauseCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { adaHasilSidang, hasilSidangPutusan } from "@/lib/hasil-sidang";
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
};

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
const AGENDA_SORE = ["jawaban", "replik", "duplik", "kesimpulan", "jawab"];

function jamMenurutAgenda(agenda: string) {
  const teks = String(agenda || "").toLowerCase();
  return AGENDA_SORE.some((k) => teks.includes(k)) ? "15:00" : "09:00";
}

function tambahHari(iso: string, hari: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + hari);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hariIni() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Membuka bungkus { ok, data } - membacanya langsung selalu keliru dan tidak berbunyi. */
async function bukaBungkus<T>(balasan: Response): Promise<T> {
  return ((await balasan.json()) as { data?: T })?.data ?? ({} as T);
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
      const isi = await bukaBungkus<{ ok: boolean; alasan?: string; keadaan?: KeadaanSidang }>(balasan);
      if (!isi.ok || !isi.keadaan) {
        setGalatMuat(isi.alasan || "Jadwal sidang tidak ditemukan.");
        return;
      }
      setKeadaan(isi.keadaan);
      // Yang sudah tercatat pada barisnya dipakai kembali - tetapi hanya bila
      // angkanya salah satu dari yang berarti. Kolomnya kosong pada 1.373 dari
      // 20.171 baris, dan empat baris bernilai 10.
      const sudahAda = Number(isi.keadaan.dihadiriOleh);
      if (KEHADIRAN.some((k) => k.nilai === sudahAda)) setDihadiri(sudahAda);

      // Usulan tanggal dan jam sidang berikutnya - dua pekan sesudah sidang
      // ini, jam menurut agendanya. Keduanya USULAN: panitera sidang tetap
      // dapat menggantinya, dan hari liburnya tetap diperiksa peladen.
      const tgl = String(isi.keadaan.tanggalSidang || "").slice(0, 10);
      setTanggalBerikut(tambahHari(tgl, 14));
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
    setJamBerikut(jamMenurutAgenda(agendaBerikut));
  }, [agendaBerikut, jamDisetelTangan]);

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

      {sudahDitunda || sudahPutus ? (
        <Card className="border-emerald-600/40 bg-emerald-500/5">
          <CardContent className="flex items-start gap-2 py-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>
              Hasil sidang ini sudah tercatat di SIPP. Mencatatnya sekali lagi akan
              melahirkan baris jadwal berganda — jadi borangnya ditutup di sini, bukan
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
                Sidang tidak dapat ditunda dan diputus sekaligus — pilih salah satu, lalu borangnya muncul.
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
                        onChange={(e) => setAlasanTunda(e.target.value)}
                        placeholder="pilih yang lazim, atau ketik sendiri"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      />
                      <datalist id="alasan-lazim">
                        {ALASAN_LAZIM.map((a) => (
                          <option key={a} value={a} />
                        ))}
                      </datalist>
                    </label>

                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Agenda sidang berikutnya
                      <input
                        list="agenda-lazim"
                        value={agendaBerikut}
                        onChange={(e) => setAgendaBerikut(e.target.value)}
                        placeholder="pilih yang lazim, atau ketik sendiri"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      />
                      <datalist id="agenda-lazim">
                        {AGENDA_LAZIM.map((a) => (
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
                          onChange={(e) => setTanggalBerikut(e.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        />
                        <span className="text-[0.7rem]">Bawaannya dua pekan sesudah sidang ini.</span>
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
                          {jamMenurutAgenda(agendaBerikut) === "15:00"
                            ? "Jawab-menjawab dan kesimpulan disidangkan sore."
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
                  <NativeSelect value={String(dihadiri)} onChange={(e) => setDihadiri(Number(e.target.value))}>
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
                      : `Antrian sidang ditandai selesai (${hasil.antrian.baris ?? 0} baris). Nol baris bukan galat — tidak semua perkara mengambil nomor antrian.`
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
