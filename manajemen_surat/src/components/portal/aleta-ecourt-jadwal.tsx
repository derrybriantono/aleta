"use client";

/**
 * Penjadwal penarikan berkas e-Court.
 *
 * ============================================================================
 * KENDALANYA CAPTCHA, BUKAN TEKNIS
 * ============================================================================
 *
 * Penarikan berkala hanya berjalan selama sesi e-Court masih hidup. Ketika
 * habis, penjadwal berhenti dan meminta petugas login - tidak mencoba terus.
 * Mencoba berulang dengan sesi mati ke sistem Mahkamah Agung persis perilaku
 * yang membuat akun ditandai, dan tidak akan pernah berhasil.
 *
 * Kartu ini menampilkan keadaan itu apa adanya, supaya petugas tahu bedanya
 * antara "penjadwal rusak" dan "sesinya perlu diperbarui".
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KeteranganStatusEcourt, LencanaStatusEcourt, useStatusEcourt } from "@/components/portal/ecourt-status-lencana";
import { apiPath } from "@/lib/base-path";
import { formatDateTime } from "@/lib/format";

type Jadwal = {
  pengaturan: {
    aktif: boolean;
    jarakJam: number;
    jamMulai: number;
    jamSelesai: number;
    maksPerkara: number;
    /** Butir 11 (13 Okt 2026): saklar yang dipilih orang; akun utama sah = selalu menyala. */
    aktifTersimpan?: boolean;
    selaluAktif?: boolean;
    akunUtama?: { slot: string; label: string; sah: boolean; pesan: string } | null;
    /** 13 Okt 10.05: selang acak putaran berkala (menit) dan tarikan pagi. */
    selangMinMenit?: number;
    selangMaksMenit?: number;
    pagiAktif?: boolean;
    jamPagi?: number;
    menitPagi?: number;
  };
  pagi?: { aktif: boolean; jam: string; berikutnya: string | null; susulan: boolean } | null;
  /** Butir 12: putaran berkala berikutnya (ISO). */
  berikutnya?: string | null;
  berjalan: boolean;
  sedangJalan: boolean;
  dalamJamKerja: boolean;
  terakhirMulai: string | null;
  terakhirSelesai: string | null;
  terakhirKode: number | null;
  terakhirCatatan: string;
  jumlahPutaran: number;
};

const ALASAN: Record<string, string> = {
  jarak_jam_di_luar_1_sampai_24: "Jarak antar putaran harus antara 1 dan 24 jam.",
  selang_min_di_luar_15_sampai_240: "Selang paling cepat harus antara 15 dan 240 menit.",
  selang_maks_di_luar_15_sampai_240: "Selang paling lama harus antara 15 dan 240 menit.",
  selang_min_lebih_dari_maks: "Selang paling cepat tidak boleh lebih dari selang paling lama.",
  jam_pagi_di_luar_0_sampai_23: "Jam tarikan pagi harus antara 0 dan 23.",
  menit_pagi_di_luar_0_sampai_59: "Menit tarikan pagi harus antara 0 dan 59.",
  jam_pagi_harus_sebelum_jam_selesai: "Tarikan pagi harus sebelum jam selesai kerja.",
  jam_mulai_di_luar_0_sampai_23: "Jam mulai harus antara 0 dan 23.",
  jam_selesai_di_luar_1_sampai_24: "Jam selesai harus antara 1 dan 24.",
  jam_selesai_harus_setelah_jam_mulai: "Jam selesai harus setelah jam mulai.",
  maks_perkara_di_luar_1_sampai_200: "Perkara per putaran harus antara 1 dan 200.",
  putaran_sebelumnya_belum_selesai: "Putaran sebelumnya masih berjalan.",
  bot_tidak_terjangkau: "ALETA Bot belum dapat dihubungi.",
};

export function AletaEcourtJadwal() {
  const [jadwal, setJadwal] = useState<Jadwal | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");

  const [aktif, setAktif] = useState(false);
  // 13 Okt 2026: jarak jam tetap diganti selang acak (menit) + tarikan pagi.
  const [selangMin, setSelangMin] = useState("30");
  const [selangMaks, setSelangMaks] = useState("60");
  const [pagiAktif, setPagiAktif] = useState(true);
  const [jamPagi, setJamPagi] = useState("08:00");
  const [jamMulai, setJamMulai] = useState("7");
  const [jamSelesai, setJamSelesai] = useState("17");
  const [maksPerkara, setMaksPerkara] = useState("25");

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const respons = await fetch(apiPath("/api/aleta-ecourt/jadwal"), { cache: "no-store" });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      if (!isi?.available || !isi?.jadwal) {
        setPesan(isi?.message || "ALETA Bot belum dapat dihubungi.");
        setJadwal(null);
      } else {
        setPesan("");
        setJadwal(isi.jadwal);
        const p = isi.jadwal.pengaturan;
        // Yang disunting adalah saklar TERSIMPAN; menyala-tidaknya dibaca dari
        // pengaturan.aktif (akun utama sah = selalu menyala).
        setAktif((p.aktifTersimpan ?? p.aktif) === true);
        setSelangMin(String(p.selangMinMenit ?? 30));
        setSelangMaks(String(p.selangMaksMenit ?? 60));
        setPagiAktif(p.pagiAktif !== false);
        setJamPagi(`${String(p.jamPagi ?? 8).padStart(2, "0")}:${String(p.menitPagi ?? 0).padStart(2, "0")}`);
        setJamMulai(String(p.jamMulai));
        setJamSelesai(String(p.jamSelesai));
        setMaksPerkara(String(p.maksPerkara));
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal membaca penjadwal.");
      setJadwal(null);
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

  const kirim = useCallback(
    async (payload: Record<string, unknown>, berhasil: string) => {
      setSibuk(true);
      setCatatan("");
      try {
        const respons = await fetch(apiPath("/api/aleta-ecourt/jadwal"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const hasil = await respons.json();
        const isi = hasil?.data ?? hasil;

        if (isi?.ok) {
          setCatatan(isi.dilewati ? ALASAN[isi.alasan] ?? "Dilewati." : isi.catatan || berhasil);
          await muat();
        } else {
          setCatatan(ALASAN[isi?.alasan] ?? `Gagal (${isi?.alasan ?? "tidak diketahui"}).`);
        }
      } catch (error) {
        setCatatan(error instanceof Error ? error.message : "Gagal menyimpan.");
      } finally {
        setSibuk(false);
      }
    },
    [muat]
  );

  // Keadaan sesi dari status akun satu sumber (30 Okt 2026). Dulu dari kode
  // putaran terakhir (2) yang tinggal di memori sampai putaran berikutnya -
  // tetap "Sesi habis" walau petugas sudah masuk lagi.
  const { data: statusEcourt } = useStatusEcourt();
  const statusUtama = statusEcourt?.ringkas ?? null;

  // Penarikan berjalan di dalam bot, bukan di dalam permintaan ini. Selama ia
  // berjalan, keadaannya disegarkan sendiri - tanpa ini layar tetap menulis
  // "Sedang menarik" sampai ada yang menekan Muat Ulang.
  useEffect(() => {
    if (!jadwal?.sedangJalan) return;
    const timer = window.setInterval(() => void muat(), 5000);
    return () => window.clearInterval(timer);
  }, [jadwal?.sedangJalan, muat]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Penarikan Berkala
            {memuat ? null : jadwal ? (
              <>
                <Badge variant={jadwal.pengaturan.aktif ? "default" : "muted"}>
                  {jadwal.pengaturan.selaluAktif
                    ? "Selalu menyala (akun utama)"
                    : jadwal.pengaturan.aktif
                      ? "Menyala"
                      : "Dimatikan"}
                </Badge>
                {jadwal.sedangJalan ? <Badge variant="warning">Sedang menarik</Badge> : null}
                <LencanaStatusEcourt t={statusUtama} awalan="e-Court" />
              </>
            ) : null}
          </CardTitle>
          <CardDescription>
            Menarik dokumen baru dari e-Court sendiri, selama sesinya masih berlaku.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={sibuk} onClick={() => void muat()}>
            Muat Ulang
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={sibuk || jadwal?.sedangJalan}
            onClick={() =>
              // Pesannya "dimulai", bukan "selesai": permintaannya memang
              // hanya memulai. Menulis "selesai" saat penarikan baru berjalan
              // membuat orang mengira tidak ada dokumen yang ditemukan.
              void kirim(
                { aksi: "jalankan" },
                "Satu putaran penarikan dimulai. Kemajuannya terlihat di atas."
              )
            }
          >
            {sibuk ? "Menjalankan…" : "Jalankan Sekarang"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {pesan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{pesan}</p> : null}
        {catatan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{catatan}</p> : null}

        {statusUtama && statusUtama.keadaan !== "aktif" && statusUtama.keadaan !== "memeriksa" ? (
          <KeteranganStatusEcourt
            t={statusUtama}
            onTindakan={() => document.getElementById("masuk-ecourt")?.scrollIntoView({ behavior: "smooth" })}
          />
        ) : null}

        {jadwal ? (
          <div className="rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            {jadwal.terakhirSelesai ? (
              <>
                Putaran terakhir {formatDateTime(jadwal.terakhirSelesai)} — {jadwal.terakhirCatatan} · total{" "}
                {jadwal.jumlahPutaran} putaran sejak bot menyala
              </>
            ) : (
              <>Belum ada putaran sejak bot menyala.</>
            )}
            {jadwal.pengaturan.aktif ? (
              <>
                {" · "}
                {jadwal.dalamJamKerja ? "sekarang di dalam jam kerja" : "sekarang di luar jam kerja"}
                {jadwal.berikutnya ? <> · putaran berikutnya {formatDateTime(jadwal.berikutnya)}</> : null}
                {jadwal.pagi?.aktif && jadwal.pagi.berikutnya ? (
                  <>
                    {" · "}
                    {jadwal.pagi.susulan
                      ? "tarikan pagi hari ini disusulkan segera"
                      : `tarikan pagi berikutnya ${formatDateTime(jadwal.pagi.berikutnya)}`}
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="jadwal-selang-min">
              Selang acak antar putaran
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="jadwal-selang-min"
                type="number"
                min={15}
                max={240}
                value={selangMin}
                onChange={(event) => setSelangMin(event.target.value)}
                className="w-20"
                aria-label="Selang paling cepat (menit)"
              />
              <span className="text-sm text-muted-foreground">-</span>
              <Input
                id="jadwal-selang-maks"
                type="number"
                min={15}
                max={240}
                value={selangMaks}
                onChange={(event) => setSelangMaks(event.target.value)}
                className="w-20"
                aria-label="Selang paling lama (menit)"
              />
              <span className="text-sm text-muted-foreground">menit</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="jadwal-mulai">
              Jam mulai
            </label>
            <Input
              id="jadwal-mulai"
              type="number"
              min={0}
              max={23}
              value={jamMulai}
              onChange={(event) => setJamMulai(event.target.value)}
              className="w-20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="jadwal-selesai">
              Jam selesai
            </label>
            <Input
              id="jadwal-selesai"
              type="number"
              min={1}
              max={24}
              value={jamSelesai}
              onChange={(event) => setJamSelesai(event.target.value)}
              className="w-20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="jadwal-maks">
              Perkara per putaran
            </label>
            <Input
              id="jadwal-maks"
              type="number"
              min={1}
              max={200}
              value={maksPerkara}
              onChange={(event) => setMaksPerkara(event.target.value)}
              className="w-20"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={aktif} onChange={(event) => setAktif(event.target.checked)} />
          Nyalakan penarikan berkala
        </label>

        <div className="flex flex-wrap items-center gap-3 rounded border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={pagiAktif}
              onChange={(event) => {
                // Mematikan tarikan pagi harus disengaja.
                if (
                  !event.target.checked &&
                  !window.confirm(
                    "Matikan tarikan pagi? Perkara yang bersidang hari ini tidak lagi ditarik serentak tiap pagi (berlaku setelah Simpan Penjadwal)."
                  )
                ) {
                  return;
                }
                setPagiAktif(event.target.checked);
              }}
            />
            Tarikan pagi
          </label>
          <Input
            id="jadwal-pagi"
            type="time"
            value={jamPagi}
            onChange={(event) => setJamPagi(event.target.value)}
            className="w-28"
            aria-label="Jam tarikan pagi (WITA)"
            disabled={!pagiAktif}
          />
          <span className="text-xs text-muted-foreground">
            WITA, Senin-Jumat - membuka semua perkara e-Court yang bersidang hari itu dengan akun utama. Bila bot baru
            menyala sesudah jam itu, tarikan pagi hari itu disusulkan sekali.
          </span>
        </div>
        {jadwal?.pengaturan.selaluAktif ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
            Akun utama {jadwal.pengaturan.akunUtama?.label || jadwal.pengaturan.akunUtama?.slot || ""} sah, jadi
            penarikan berkala SELALU menyala walau saklar di atas tidak dicentang. Untuk menghentikannya, lepas
            tanda akun utama di kartu Akun e-Court (harus disengaja).
          </p>
        ) : jadwal?.pengaturan.akunUtama && !jadwal.pengaturan.akunUtama.sah ? (
          <p className="rounded border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100">
            {jadwal.pengaturan.akunUtama.pesan} Penarikan berkala hanya mengikuti saklar di atas.
          </p>
        ) : null}

        <p className="rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
          Akhir pekan selalu dilewati. Pihak dan kuasa hukum mengunggah pada hari kerja, dan menarik di akhir pekan
          hanya membebani server pengadilan tanpa menemukan apa pun.
        </p>

        <Button
          size="sm"
          disabled={sibuk}
          onClick={() =>
            void kirim(
              {
                aktif,
                selangMinMenit: Number(selangMin),
                selangMaksMenit: Number(selangMaks),
                pagiAktif,
                jamPagi: Number(jamPagi.split(":")[0]),
                menitPagi: Number(jamPagi.split(":")[1] ?? 0),
                jamMulai: Number(jamMulai),
                jamSelesai: Number(jamSelesai),
                maksPerkara: Number(maksPerkara),
              },
              "Pengaturan penjadwal tersimpan."
            )
          }
        >
          {sibuk ? "Menyimpan…" : "Simpan Penjadwal"}
        </Button>
      </CardContent>
    </Card>
  );
}
