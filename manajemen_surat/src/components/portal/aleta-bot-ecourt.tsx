"use client";

/**
 * Tab pengelolaan e-Court di halaman ALETA Bot.
 *
 * Menjawab pertanyaan yang selama ini hanya bisa dijawab dengan membuka
 * terminal di server: jembatannya terakhir jalan kapan, ada berapa dokumen
 * tersimpan, berapa yang menunggu majelis, berapa nomor yang belum menjawab
 * konfirmasi, dan apakah catatan ALETA masih cocok dengan e-Court.
 *
 * Satu-satunya kendali yang mengubah keadaan di sini adalah saklar
 * menyalakan/mematikan pemberitahuan. Menjalankan jembatan tetap lewat
 * terminal, karena login e-Court menuntut captcha yang harus diisi manusia -
 * dan itu memang sengaja tidak diotomatiskan.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AletaBotEcourtLogin } from "@/components/portal/aleta-bot-ecourt-login";
import { AletaBotEcourtPengaturan } from "@/components/portal/aleta-bot-ecourt-pengaturan";
import { apiPath } from "@/lib/base-path";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Aturan = {
  key: string;
  label: string;
  patterns: string[];
  notify: boolean;
  audience: string;
  tenggatBerlaku: boolean;
  ringkasan: string;
  tindakan: string;
};

type Selisih = {
  documentKey: string;
  nomorPerkara: string;
  judulDokumen: string;
  jenis: string;
  kegentingan: string;
  penjelasan: string;
  statusEcourt: string;
  statusAleta: string | null;
  namaHakim: string;
};

type Dokumen = {
  documentKey: string;
  nomorPerkara: string;
  judulDokumen: string;
  peranPengunggah: string;
  statusVerifikasi: string;
  diunggahPada: string | null;
  batasUnggahTeks: string;
  sudahDiberitahukan: boolean;
  alasanTidakDiberitahukan: string;
};

type Putaran = {
  id: string;
  dimulaiPada: string | null;
  selesaiPada: string | null;
  status: string;
  perkaraDiperiksa: number;
  dokumenTerlihat: number;
  dokumenBaru: number;
  berkasTerunduh: number;
  jumlahGalat: number;
  galatTerakhir: string;
  catatan: string;
  lamaDetik: number | null;
};

type BerkasBermasalah = {
  documentKey: string;
  nomorPerkara: string;
  judulDokumen: string;
  gagal: number;
  sebab: string;
  terakhir: string;
};

type PendaftaranBermasalah = {
  nomorPerkara: string;
  nomorEcourt: string;
  keadaan: string;
  golongan: string;
  tanggalPendaftaran: string;
  tanggalTidakTerbaca: boolean;
  sudahDibayar: boolean;
  pernahDitarik: boolean;
};

type Cakupan = {
  ok: boolean;
  alasan?: string;
  diperiksaPada?: string;
  totalSipp?: number;
  pernahDitarik?: number;
  belumPernahDitarik?: number;
  berkasLengkap?: number;
  persenDitarik?: number;
  pendaftaran?: {
    terdaftar: number;
    menunggu: number;
    ditolak: number;
    tidakDapatDilanjutkan: number;
    lain: number;
    tanpaKeadaan: number;
  };
  jumlahBermasalah?: number;
  tanggalRusak?: number;
  bermasalah?: PendaftaranBermasalah[];
  belumDibayar?: number;
  jumlahNomorBerselisih?: number;
  nomorBerselisih?: { nomorPerkara: string; nomorEcourt: string }[];
  pendaftaranGanda?: number;
  hanyaYangJadiPerkara?: boolean;
};

type Status = {
  diperiksaPada: string;
  aktif: boolean;
  sinkronisasiTerakhir: {
    dimulaiPada: string | null;
    selesaiPada: string | null;
    status: string;
    perkaraDiperiksa: number;
    dokumenTerlihat: number;
    dokumenBaru: number;
    berkasTerunduh: number;
    jumlahGalat: number;
    galatTerakhir: string;
  } | null;
  dokumen: {
    total: number;
    belumVerifikasi: number;
    sudahValid: number;
    belumDiberitahukan: number;
    sudahDiberitahukan: number;
    /**
     * Dokumen yang berulang gagal diambil. Sudah lama dipulangkan
     * ecourtStatusService dan belum pernah muncul di layar mana pun - lihat
     * kartu "Berkas Yang Berulang Gagal Diambil" di bawah.
     *
     * Boleh tidak ada: bot versi lama belum mengirimkannya.
     */
    bermasalah?: number;
    daftarBermasalah?: BerkasBermasalah[];
  };
  /** Urutan putaran jembatan. Boleh tidak ada pada bot versi lama. */
  putaran?: Putaran[];
  /** Jumlah dan besar arsip. null berarti tidak terbaca, bukan nol. */
  arsip?: {
    berkas: number;
    perkara: number;
    dokumen: number;
    aktif: number;
    dihapusRetensi: number;
    byteAktif: number;
    byteSemua: number;
  } | null;
  panggilan?: {
    panggilan: { total: number; perkara: number; terkirim: number };
    persetujuan: { setuju: number; belum: number; tolak: number; lain: number; total: number };
  } | null;
  /** Penyebut dari pertanyaan "apakah sinkronisasinya lengkap". */
  cakupan?: Cakupan | null;
  verifikasi: {
    keputusanTersimpan: number;
    belumDiteruskan: number;
    /**
     * Keputusan tertua yang masih menunggu diteruskan ke e-Court, beserta
     * umurnya. null berarti antreannya kosong.
     *
     * Boleh tidak ada: bot versi lama belum mengirimkannya.
     */
    tertua?: {
      nomorPerkara: string;
      judulDokumen: string;
      namaHakim: string;
      keputusan: string;
      diputuskanPada: string;
      umurHari: number | null;
    } | null;
  };
  nomor: { terverifikasi: number; menunggu: number; ditolak: number };
  rekonsiliasi: {
    ringkasan: {
      bertentangan: number;
      penerusanGagal: number;
      diverifikasiDiLuar: number;
      belumDiteruskan: number;
    };
    selisih: Selisih[];
  } | null;
  aturan: Aturan[];
};

/**
 * Byte dijadikan satuan yang terbaca manusia.
 *
 * Basis 1024 dengan nama KB/MB/GB, sama seperti yang ditampilkan Windows
 * Explorer di tempat petugas memeriksa foldernya - supaya angka di layar ini
 * dapat dibandingkan langsung dengan yang dilihatnya di disk.
 */
function besarByte(nilai: number) {
  if (!Number.isFinite(nilai) || nilai <= 0) return "0 B";
  const satuan = ["B", "KB", "MB", "GB", "TB"];
  let sisa = nilai;
  let i = 0;
  while (sisa >= 1024 && i < satuan.length - 1) {
    sisa /= 1024;
    i += 1;
  }
  return `${i === 0 ? sisa : sisa.toFixed(sisa >= 100 ? 0 : 1)} ${satuan[i]}`;
}

/** Lama satu putaran dalam kata, bukan dalam detik mentah. */
function lamaPutaran(detik: number | null) {
  if (detik === null) return "belum selesai";
  if (detik < 60) return `${detik} dtk`;
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} mnt ${detik % 60} dtk`;
  return `${Math.floor(menit / 60)} jam ${menit % 60} mnt`;
}

const NADA_PUTARAN: Record<string, "default" | "warning" | "danger" | "muted"> = {
  berhasil: "default",
  selesai: "default",
  sebagian: "warning",
  berjalan: "muted",
  gagal: "danger",
};

/**
 * Nama golongan keadaan pendaftaran e-Court.
 *
 * Keempat teks pertama diukur pada sipp_donggala 25 Sep 2026. "lain" ada sebab
 * SIPP lain memakai teks lain - terukur pada basis `sipp` (PA Bungku):
 * "Verifikasi Pendaftaran Perkara", yang tidak ada di Donggala sama sekali.
 */
const LABEL_GOLONGAN: Record<string, string> = {
  terdaftar: "Perkara Terdaftar",
  menunggu: "Menunggu Pendaftaran",
  ditolak: "Pendaftaran Ditolak",
  tidakDapatDilanjutkan: "Tidak Dapat Dilanjutkan",
  lain: "Keadaan Lain",
  tanpaKeadaan: "Tanpa Keadaan",
};

function Angka({
  judul,
  nilai,
  keterangan,
  nada = "netral",
}: {
  judul: string;
  nilai: number | string;
  keterangan: string;
  nada?: "netral" | "perhatian" | "genting";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        nada === "genting" && "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40",
        nada === "perhatian" && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
        nada === "netral" && "border-border bg-card"
      )}
    >
      <p className="text-2xl font-semibold tabular-nums">{nilai}</p>
      <p className="mt-1 text-sm font-medium">{judul}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
    </div>
  );
}

export function AletaBotEcourtPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [dokumen, setDokumen] = useState<Dokumen[]>([]);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [catatan, setCatatan] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const respons = await fetch(apiPath("/api/aleta-bot/ecourt"), { cache: "no-store" });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      if (!isi?.available) {
        setPesan(isi?.message || "ALETA Bot belum dapat dihubungi.");
        setStatus(null);
        setDokumen([]);
      } else {
        setPesan("");
        setStatus(isi.status);
        setDokumen(Array.isArray(isi.dokumen) ? isi.dokumen : []);
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal memuat data.");
      setStatus(null);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const ubahSaklar = useCallback(
    async (aktif: boolean) => {
      setMenyimpan(true);
      setCatatan("");
      try {
        const respons = await fetch(apiPath("/api/aleta-bot/ecourt"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aktif }),
        });
        const hasil = await respons.json();
        const isi = hasil?.data ?? hasil;
        if (isi?.ok) {
          setCatatan(
            aktif
              ? "Pemberitahuan e-Court dinyalakan."
              : "Pemberitahuan e-Court dimatikan. Dokumen yang menunggu tidak dibuang dan akan dikirim begitu dinyalakan lagi."
          );
          await muat();
        } else {
          setCatatan(isi?.message || "Perubahan gagal disimpan.");
        }
      } catch (error) {
        setCatatan(error instanceof Error ? error.message : "Perubahan gagal disimpan.");
      } finally {
        setMenyimpan(false);
      }
    },
    [muat]
  );

  if (memuat) {
    return <p className="p-6 text-sm text-muted-foreground">Memuat keadaan e-Court…</p>;
  }

  if (pesan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>e-Court belum dapat dibaca</CardTitle>
          <CardDescription>{pesan}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Halaman kosong di sini bukan berarti tidak ada pekerjaan menunggu — hanya berarti bot belum terjangkau.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void muat()}>
            Coba lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const rekon = status.rekonsiliasi?.ringkasan;
  const genting = (rekon?.bertentangan ?? 0) + (rekon?.penerusanGagal ?? 0);
  // Boleh null (SIPP tidak terbaca) dan boleh tidak ada sama sekali (bot versi
  // lama). Keduanya bukan nol, dan layar mengatakan bedanya.
  const cakupan = status.cakupan ?? null;

  return (
    <div className="space-y-4">
      <AletaBotEcourtLogin />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Jembatan e-Court
              <Badge variant={status.aktif ? "default" : "muted"}>
                {status.aktif ? "Pemberitahuan aktif" : "Pemberitahuan dimatikan"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Dokumen e-Litigasi ditarik lewat alat baris perintah di server, lalu diberitahukan ke pihak lawan setelah
              diverifikasi majelis.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void muat()} disabled={menyimpan}>
              Muat Ulang
            </Button>
            <Button
              variant={status.aktif ? "destructive" : "default"}
              size="sm"
              disabled={menyimpan}
              onClick={() => void ubahSaklar(!status.aktif)}
            >
              {menyimpan ? "Menyimpan…" : status.aktif ? "Matikan Pemberitahuan" : "Nyalakan Pemberitahuan"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {catatan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{catatan}</p> : null}

          <div className="rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            {status.sinkronisasiTerakhir ? (
              <>
                Sinkronisasi terakhir {formatDateTime(status.sinkronisasiTerakhir.dimulaiPada ?? "")} · status{" "}
                {status.sinkronisasiTerakhir.status} · {status.sinkronisasiTerakhir.perkaraDiperiksa} perkara,{" "}
                {status.sinkronisasiTerakhir.dokumenBaru} dokumen baru,{" "}
                {status.sinkronisasiTerakhir.berkasTerunduh} berkas terunduh
                {status.sinkronisasiTerakhir.jumlahGalat > 0
                  ? ` · ${status.sinkronisasiTerakhir.jumlahGalat} galat`
                  : ""}
              </>
            ) : (
              <>
                Jembatan belum pernah dijalankan. Di server:{" "}
                <code className="rounded bg-background px-1">node tools/ecourt-bridge/run.js</code>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Angka judul="Dokumen Tersimpan" nilai={status.dokumen.total} keterangan="Seluruh yang pernah terbaca." />
            <Angka
              judul="Menunggu Majelis"
              nilai={status.dokumen.belumVerifikasi}
              keterangan="Belum diverifikasi hakim."
              nada={status.dokumen.belumVerifikasi > 0 ? "perhatian" : "netral"}
            />
            <Angka
              judul="Siap Diberitahukan"
              nilai={status.dokumen.belumDiberitahukan}
              keterangan="Sudah valid, pesan belum dikirim."
            />
            <Angka
              judul="Sudah Diberitahukan"
              nilai={status.dokumen.sudahDiberitahukan}
              keterangan="Pesan sudah diantrekan ke pihak."
            />
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          CAKUPAN - PENYEBUT YANG SELAMA INI TIDAK ADA
          ====================================================================

          Kartu di atas menyebut berapa dokumen TERSIMPAN, dan jumlah itu tidak
          pernah dapat menjawab berapa yang HILANG. "Dokumen Tersimpan 1.204"
          terbaca meyakinkan baik ketika seluruh perkara sudah ditarik maupun
          ketika dua ribu perkara belum pernah dibuka sekali pun.

          Terukur 25 Sep 2026 pada basis data setempat: 2.527 perkara e-Court di
          SIPP, 0 yang pernah ditarik. Angka itu benar, dan justru karena itu ia
          harus terbaca di layar - bukan hanya lewat terminal. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Cakupan Penarikan
            {cakupan?.ok && (cakupan.belumPernahDitarik ?? 0) > 0 ? (
              <Badge variant="warning">{cakupan.belumPernahDitarik} perkara belum pernah ditarik</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Berapa dari seluruh perkara e-Court di SIPP yang pernah ditarik ALETA. Tanpa penyebutnya, jumlah dokumen
            tersimpan tidak dapat membedakan arsip yang lengkap dari arsip yang hampir kosong.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {cakupan?.ok ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Angka
                  judul="Perkara e-Court di SIPP"
                  nilai={cakupan.totalSipp ?? 0}
                  keterangan="Seluruhnya, tanpa batas tahun."
                />
                <Angka
                  judul="Pernah Ditarik"
                  nilai={`${cakupan.pernahDitarik ?? 0} (${cakupan.persenDitarik ?? 0}%)`}
                  keterangan="ALETA punya sedikitnya satu dokumennya."
                  nada={(cakupan.persenDitarik ?? 0) < 50 ? "perhatian" : "netral"}
                />
                <Angka
                  judul="Belum Pernah Ditarik"
                  nilai={cakupan.belumPernahDitarik ?? 0}
                  keterangan="ALETA belum tahu apa pun tentangnya."
                  nada={(cakupan.belumPernahDitarik ?? 0) > 0 ? "perhatian" : "netral"}
                />
                <Angka
                  judul="Berkasnya Utuh"
                  nilai={cakupan.berkasLengkap ?? 0}
                  keterangan="Tiap dokumennya punya berkas."
                />
              </div>

              {/* Nomor perkara versi SIPP dan versi e-Court yang berbeda.
                  Terukur 2 dari 2.529 baris - dan keduanya BERTUKAR: perkara
                  bernomor SIPP 61/Pdt.G/2020 tercatat 63/Pdt.G/2020 di e-Court
                  dan sebaliknya. Menarik dokumen dengan nomor yang salah satu
                  di antaranya berarti dokumen perkara 61 mendarat di perkara 63. */}
              {(cakupan.jumlahNomorBerselisih ?? 0) > 0 ? (
                <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm dark:border-rose-800 dark:bg-rose-950/40">
                  <p className="font-medium">
                    {cakupan.jumlahNomorBerselisih} perkara bernomor berbeda antara SIPP dan e-Court
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Menarik dokumen memakai nomor yang salah membuat berkas satu perkara mendarat di perkara lain.
                    Nomor resmi adalah yang tercatat di SIPP.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {(cakupan.nomorBerselisih ?? []).map((item) => (
                      <li key={`${item.nomorPerkara}-${item.nomorEcourt}`} className="font-mono text-xs">
                        SIPP {item.nomorPerkara} ↔ e-Court {item.nomorEcourt}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                {(cakupan.pendaftaranGanda ?? 0) > 0
                  ? `${cakupan.pendaftaranGanda} perkara punya lebih dari satu pendaftaran e-Court; yang dipakai adalah yang terbaru. `
                  : ""}
                Dihitung dari SIPP setempat tanpa satu permintaan pun ke server Mahkamah Agung.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Cakupan belum dapat dihitung: {cakupan?.alasan || "SIPP belum terbaca"}. Ini bukan berarti nol — hanya
              berarti penyebutnya belum terambil.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ====================================================================
          KEADAAN PENDAFTARAN - DIBACA SEJAK LAMA, DIBUANG SEJAK LAMA
          ====================================================================

          listEcourtCases sudah memulangkan statusPendaftaran, sudahDibayar dan
          nomorPerkaraEfiling, dan sampai 25 Sep 2026 tidak ada satu pemakai pun
          di seluruh aleta_bot maupun manajemen_surat/src. Perkara yang
          pendaftarannya ditolak atau tidak dapat dilanjutkan karena itu tidak
          pernah terlihat siapa pun.

          Terukur pada sipp_donggala: perkara 52/Pdt.P/2021 berkeadaan
          "Pendaftaran Ditolak" tetapi tahapan terakhirnya Putusan/Minutasi - ia
          sudah disidangkan dan diputus. Itulah sebabnya kartu ini ada. */}
      {cakupan?.ok ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Keadaan Pendaftaran e-Court
              {(cakupan.jumlahBermasalah ?? 0) > 0 ? (
                <Badge variant="danger">{cakupan.jumlahBermasalah} perlu diperiksa</Badge>
              ) : (
                <Badge variant="success">semuanya terdaftar</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Perkara yang pendaftarannya ditolak atau belum selesai tidak seharusnya berjalan sebagai perkara.
              Keadaan ini sudah lama tersimpan di SIPP dan belum pernah tampil di layar mana pun.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Angka
                judul={LABEL_GOLONGAN.terdaftar}
                nilai={cakupan.pendaftaran?.terdaftar ?? 0}
                keterangan="Pendaftarannya selesai."
              />
              <Angka
                judul={LABEL_GOLONGAN.menunggu}
                nilai={cakupan.pendaftaran?.menunggu ?? 0}
                keterangan="Pendaftarannya belum selesai."
                nada={(cakupan.pendaftaran?.menunggu ?? 0) > 0 ? "perhatian" : "netral"}
              />
              <Angka
                judul={LABEL_GOLONGAN.ditolak}
                nilai={cakupan.pendaftaran?.ditolak ?? 0}
                keterangan="Tidak seharusnya disidangkan."
                nada={(cakupan.pendaftaran?.ditolak ?? 0) > 0 ? "genting" : "netral"}
              />
              <Angka
                judul={LABEL_GOLONGAN.tidakDapatDilanjutkan}
                nilai={cakupan.pendaftaran?.tidakDapatDilanjutkan ?? 0}
                keterangan="Pendaftarannya batal."
                nada={(cakupan.pendaftaran?.tidakDapatDilanjutkan ?? 0) > 0 ? "genting" : "netral"}
              />
            </div>

            {/* Keadaan yang tidak dikenal TIDAK dibulatkan ke "terdaftar".
                Terukur pada basis `sipp` (PA Bungku) ada teks kelima,
                "Verifikasi Pendaftaran Perkara", yang tidak ada di Donggala -
                menganggapnya beres adalah persis cara satu perkara batal lolos. */}
            {(cakupan.pendaftaran?.lain ?? 0) + (cakupan.pendaftaran?.tanpaKeadaan ?? 0) > 0 ? (
              <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                {cakupan.pendaftaran?.lain ?? 0} perkara berkeadaan yang belum dikenal ALETA dan{" "}
                {cakupan.pendaftaran?.tanpaKeadaan ?? 0} tanpa keadaan sama sekali. Keduanya sengaja tidak dihitung
                sebagai terdaftar.
              </p>
            ) : null}

            {(cakupan.bermasalah ?? []).length > 0 ? (
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Perkara</th>
                      <th className="px-3 py-2 font-medium">Keadaan Pendaftaran</th>
                      <th className="px-3 py-2 font-medium">Didaftarkan</th>
                      <th className="px-3 py-2 font-medium">Berkas di ALETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cakupan.bermasalah ?? []).map((item) => (
                      <tr key={`${item.nomorPerkara}-${item.golongan}`} className="border-t border-border/60">
                        <td className="px-3 py-2 font-mono text-xs">{item.nomorPerkara || "-"}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              item.golongan === "ditolak" || item.golongan === "tidakDapatDilanjutkan"
                                ? "danger"
                                : "warning"
                            }
                          >
                            {item.keadaan || LABEL_GOLONGAN[item.golongan] || item.golongan}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {item.tanggalPendaftaran || (item.tanggalTidakTerbaca ? "tidak terbaca" : "-")}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {item.pernahDitarik ? "sudah pernah ditarik" : "belum pernah ditarik"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {/* Batas jangkauan angka di atas, dikatakan dan bukan disembunyikan.
                Daftar acuannya mengikat perkara_efiling ke perkara, sehingga
                pendaftaran yang belum pernah menjadi perkara tidak pernah ikut.
                Terukur: dari 12 pendaftaran bermasalah di perkara_efiling hanya
                4 yang tertaut ke perkara - kedelapan sisanya memang tidak pernah
                menjadi perkara, jadi tidak ada yang dapat disidangkan. */}
            <p className="text-xs text-muted-foreground">
              Yang terhitung di sini hanya pendaftaran yang sudah menjadi perkara. Pendaftaran yang batal sebelum
              menjadi perkara tidak ikut — ia tidak dapat disidangkan, jadi bukan pekerjaan di sini.
              {(cakupan.tanggalRusak ?? 0) > 0
                ? ` Tanggal pendaftaran dari jembatan SIPP sedang tidak terbaca untuk ${cakupan.tanggalRusak} perkara, jadi kolom tanggalnya dikosongkan alih-alih menampilkan tanggal yang salah.`
                : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* ====================================================================
          RIWAYAT PUTARAN - EMPAT KOLOM YANG SUDAH LAMA TERSIMPAN
          ====================================================================

          Kartu di atas menyebut keempat angka putaran TERAKHIR. Yang tidak
          pernah terlihat adalah urutannya: satu putaran gagal tidak dapat
          dibedakan dari sepuluh putaran gagal berturut-turut, padahal yang kedua
          berarti jembatannya memang rusak dan bukan sedang bernasib buruk. */}
      {(status.putaran ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Putaran Jembatan</CardTitle>
            <CardDescription>
              Sepuluh putaran terakhir. Satu kegagalan adalah nasib; kegagalan berturut-turut adalah kerusakan.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Dimulai</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Lama</th>
                  <th className="px-3 py-2 text-right font-medium">Perkara</th>
                  <th className="px-3 py-2 text-right font-medium">Dokumen Baru</th>
                  <th className="px-3 py-2 text-right font-medium">Berkas Terunduh</th>
                  <th className="px-3 py-2 text-right font-medium">Error</th>
                  <th className="px-3 py-2 font-medium">Error Terakhir</th>
                </tr>
              </thead>
              <tbody>
                {(status.putaran ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-border/60">
                    <td className="px-3 py-2 text-xs">
                      {item.dimulaiPada ? formatDateTime(item.dimulaiPada) : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={NADA_PUTARAN[item.status] ?? "muted"}>{item.status || "-"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{lamaPutaran(item.lamaDetik)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.perkaraDiperiksa}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.dokumenBaru}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.berkasTerunduh}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        item.jumlahGalat > 0 && "font-semibold text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {item.jumlahGalat}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{item.galatTerakhir || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {status.arsip || status.panggilan ? (
        <Card>
          <CardHeader>
            <CardTitle>Arsip, Panggilan Elektronik, dan Persetujuan Pihak</CardTitle>
            <CardDescription>
              Ketiganya sudah lama ditulis ke basis data bot dan belum pernah terbaca satu layar pun. Persetujuan
              pihak menentukan boleh-tidaknya dokumen dikirim elektronik, jadi yang belum menjawab adalah pekerjaan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {status.arsip ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Angka judul="Berkas Arsip" nilai={status.arsip.aktif} keterangan="Masih ada di disk." />
                <Angka
                  judul="Besar Arsip"
                  nilai={besarByte(status.arsip.byteAktif)}
                  keterangan="Hanya berkas yang masih ada."
                />
                <Angka judul="Perkara Berberkas" nilai={status.arsip.perkara} keterangan="Punya sedikitnya satu berkas." />
                <Angka
                  judul="Dihapus Retensi"
                  nilai={status.arsip.dihapusRetensi}
                  keterangan="Tercatat pernah ada, kini tidak."
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Jumlah arsip belum terbaca — bukan berarti nol.</p>
            )}

            {status.panggilan ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Angka
                  judul="Panggilan Elektronik"
                  nilai={status.panggilan.panggilan.total}
                  keterangan={`${status.panggilan.panggilan.terkirim} sudah terkirim.`}
                />
                <Angka
                  judul="Pihak Setuju Elektronik"
                  nilai={status.panggilan.persetujuan.setuju}
                  keterangan="Boleh dipanggil elektronik."
                />
                <Angka
                  judul="Pihak Belum Menjawab"
                  nilai={status.panggilan.persetujuan.belum}
                  keterangan="Masih harus dipanggil biasa."
                  nada={status.panggilan.persetujuan.belum > 0 ? "perhatian" : "netral"}
                />
                <Angka
                  judul="Pihak Menolak"
                  nilai={status.panggilan.persetujuan.tolak}
                  keterangan="Tidak boleh elektronik."
                  nada={status.panggilan.persetujuan.tolak > 0 ? "perhatian" : "netral"}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Panggilan elektronik belum terbaca — bukan berarti nol.
              </p>
            )}

            {/* Nilai persetujuan yang tidak dikenal tidak dibulatkan ke "belum".
                Kolomnya varchar(16) tanpa enum, jadi nilai baru mungkin muncul. */}
            {(status.panggilan?.persetujuan.lain ?? 0) > 0 ? (
              <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                {status.panggilan?.persetujuan.lain} pihak berpersetujuan yang belum dikenal ALETA. Tidak dihitung
                sebagai setuju maupun belum.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Dokumen yang berulang gagal diambil sudah lama dipulangkan layanannya
          dan belum pernah tampil. Yang diistirahatkan diam-diam sama saja dengan
          yang hilang diam-diam. */}
      {(status.dokumen.daftarBermasalah ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Berkas Yang Berulang Gagal Diambil
              <Badge variant="danger">{status.dokumen.bermasalah ?? 0}</Badge>
            </CardTitle>
            <CardDescription>
              Diistirahatkan supaya tidak memakan jatah tiap putaran. Berkasnya tidak akan datang sendiri.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Perkara</th>
                  <th className="px-3 py-2 font-medium">Dokumen</th>
                  <th className="px-3 py-2 text-right font-medium">Gagal</th>
                  <th className="px-3 py-2 font-medium">Sebab</th>
                </tr>
              </thead>
              <tbody>
                {(status.dokumen.daftarBermasalah ?? []).map((item) => (
                  <tr key={item.documentKey} className="border-t border-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{item.nomorPerkara}</td>
                    <td className="px-3 py-2">{item.judulDokumen}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.gagal}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{item.sebab || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Keputusan Hakim</CardTitle>
          <CardDescription>
            Keputusan tersimpan di ALETA lebih dulu. Status di e-Court belum berubah sampai petugas menjalankan{" "}
            <code className="rounded bg-muted px-1">node tools/ecourt-bridge/kirim-verifikasi.js</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Angka
            judul="Keputusan Tersimpan"
            nilai={status.verifikasi.keputusanTersimpan}
            keterangan="Diputuskan hakim lewat WhatsApp atau portal."
          />
          {/* Umur antreannya ikut disebut, bukan jumlahnya saja. Tiga keputusan
              yang masuk pagi ini adalah pekerjaan hari ini; tiga keputusan yang
              menunggu tiga minggu adalah keputusan hukum yang mengendap - dan
              angkanya sama saja bila umurnya tidak disebutkan. */}
          <Angka
            judul="Belum Diteruskan"
            nilai={status.verifikasi.belumDiteruskan}
            keterangan={
              status.verifikasi.tertua && status.verifikasi.tertua.umurHari !== null
                ? `Menunggu diteruskan ke e-Court. Tertua ${status.verifikasi.tertua.umurHari} hari — ${status.verifikasi.tertua.nomorPerkara}.`
                : "Menunggu diteruskan ke e-Court."
            }
            nada={
              status.verifikasi.tertua && (status.verifikasi.tertua.umurHari ?? 0) >= 7
                ? "genting"
                : status.verifikasi.belumDiteruskan > 0
                  ? "perhatian"
                  : "netral"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konfirmasi Nomor Pihak</CardTitle>
          <CardDescription>
            Berkas tidak dikirim ke nomor yang belum dipastikan pemiliknya. Satu digit salah di SIPP berarti dokumen
            perkara terkirim ke orang asing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Angka judul="Terverifikasi" nilai={status.nomor.terverifikasi} keterangan="Pemilik sudah membenarkan." />
          <Angka
            judul="Belum Menjawab"
            nilai={status.nomor.menunggu}
            keterangan="Berkas ditahan sampai dijawab."
            nada={status.nomor.menunggu > 0 ? "perhatian" : "netral"}
          />
          <Angka
            judul="Salah Alamat"
            nilai={status.nomor.ditolak}
            keterangan="Data SIPP perlu diperbaiki."
            nada={status.nomor.ditolak > 0 ? "genting" : "netral"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Kecocokan dengan e-Court
            {genting > 0 ? <Badge variant="danger">{genting} perlu diperiksa</Badge> : null}
          </CardTitle>
          <CardDescription>
            ALETA hanya melaporkan selisih, tidak pernah memperbaikinya sendiri. Status resmi selalu yang tercatat di
            e-Court.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rekon ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Angka
                judul="Bertentangan"
                nilai={rekon.bertentangan}
                keterangan="Keputusan ALETA beda dengan e-Court."
                nada={rekon.bertentangan > 0 ? "genting" : "netral"}
              />
              <Angka
                judul="Penerusan Gagal"
                nilai={rekon.penerusanGagal}
                keterangan="Tercatat diteruskan, e-Court belum berubah."
                nada={rekon.penerusanGagal > 0 ? "genting" : "netral"}
              />
              <Angka
                judul="Diverifikasi di Luar"
                nilai={rekon.diverifikasiDiLuar}
                keterangan="Langsung di e-Court, bukan lewat ALETA."
              />
              <Angka
                judul="Belum Diteruskan"
                nilai={rekon.belumDiteruskan}
                keterangan="Hakim sudah memutuskan di ALETA."
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Pemeriksaan kecocokan belum dapat dijalankan.</p>
          )}

          {status.rekonsiliasi && status.rekonsiliasi.selisih.length > 0 ? (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Perkara</th>
                    <th className="px-3 py-2 font-medium">Dokumen</th>
                    <th className="px-3 py-2 font-medium">Selisih</th>
                    <th className="px-3 py-2 font-medium">ALETA</th>
                    <th className="px-3 py-2 font-medium">e-Court</th>
                  </tr>
                </thead>
                <tbody>
                  {status.rekonsiliasi.selisih.map((item) => (
                    <tr key={item.documentKey} className="border-t border-border/60">
                      <td className="px-3 py-2 font-mono text-xs">{item.nomorPerkara}</td>
                      <td className="px-3 py-2">{item.judulDokumen}</td>
                      <td className="px-3 py-2">
                        <Badge variant={item.kegentingan === "tinggi" ? "danger" : "muted"}>
                          {item.jenis.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{item.statusAleta ?? "-"}</td>
                      <td className="px-3 py-2">{item.statusEcourt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AletaBotEcourtPengaturan />

      {dokumen.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Dokumen Terbaru</CardTitle>
            <CardDescription>Urutan mengikuti kapan terakhir terbaca jembatan.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Perkara</th>
                  <th className="px-3 py-2 font-medium">Dokumen</th>
                  <th className="px-3 py-2 font-medium">Dari</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Batas Waktu</th>
                  <th className="px-3 py-2 font-medium">Pesan</th>
                </tr>
              </thead>
              <tbody>
                {dokumen.map((item) => (
                  <tr key={item.documentKey} className="border-t border-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{item.nomorPerkara}</td>
                    <td className="px-3 py-2">{item.judulDokumen}</td>
                    <td className="px-3 py-2">{item.peranPengunggah || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={item.statusVerifikasi === "valid" ? "default" : "muted"}>
                        {item.statusVerifikasi}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{item.batasUnggahTeks || "-"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {item.sudahDiberitahukan
                        ? "terkirim"
                        : item.alasanTidakDiberitahukan || "menunggu"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Diperiksa {formatDateTime(status.diperiksaPada)}. Menarik dokumen baru dan meneruskan keputusan tetap dijalankan
        dari terminal server, karena login e-Court menuntut captcha.
      </p>
    </div>
  );
}
