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
import { apiPath } from "@/lib/base-path";
import { formatDateTime } from "@/lib/format";

type Jadwal = {
  pengaturan: { aktif: boolean; jarakJam: number; jamMulai: number; jamSelesai: number; maksPerkara: number };
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
  const [jarakJam, setJarakJam] = useState("2");
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
        setAktif(p.aktif === true);
        setJarakJam(String(p.jarakJam));
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

  const sesiHabis = jadwal?.terakhirKode === 2;

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
                  {jadwal.pengaturan.aktif ? "Menyala" : "Dimatikan"}
                </Badge>
                {jadwal.sedangJalan ? <Badge variant="warning">Sedang menarik</Badge> : null}
                {sesiHabis ? <Badge variant="danger">Sesi habis</Badge> : null}
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

        {sesiHabis ? (
          <p className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100">
            Penjadwal berhenti karena sesi e-Court sudah habis. Ini bukan kerusakan — login sekali lewat kartu Login
            e-Court di atas, lalu penarikan berjalan lagi dengan sendirinya.
          </p>
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
              </>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="jadwal-jarak">
              Jarak antar putaran
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="jadwal-jarak"
                type="number"
                min={1}
                max={24}
                value={jarakJam}
                onChange={(event) => setJarakJam(event.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">jam</span>
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
                jarakJam: Number(jarakJam),
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
