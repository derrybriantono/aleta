"use client";

/**
 * Ruang dan masa simpan arsip berkas e-Court.
 *
 * ============================================================================
 * MASA SIMPAN ADALAH KEPUTUSAN PIMPINAN
 * ============================================================================
 *
 * Bawaannya NOL — tidak menghapus apa pun. Berapa lama pengadilan menyimpan
 * salinan berkas pihak di luar sistem resmi bukan keputusan yang pantas
 * diambil oleh kode maupun oleh pembuat aplikasi.
 *
 * Halaman ini menyediakan tempat menetapkannya, beserta angka yang dibutuhkan
 * untuk memutuskan: seberapa besar arsipnya sekarang, dan berapa yang akan
 * terhapus dengan ketetapan itu.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

type Arsip = {
  pengaturan: { minRuangGb: number; maksBerkasMb: number; simpanBulan: number };
  ruang: { ok: boolean; bebasGb: number | null; totalGb: number | null; alasan?: string };
  arsip: { jumlahBerkas: number; totalMb: number };
  kedaluwarsa: { aktif: boolean; jumlah: number; totalMb: number };
  ruangMenipis: boolean | null;
};

const ALASAN: Record<string, string> = {
  min_ruang_di_luar_1_sampai_500_gb: "Ambang ruang harus antara 1 dan 500 GB.",
  maks_berkas_di_luar_1_sampai_500_mb: "Batas ukuran berkas harus antara 1 dan 500 MB.",
  masa_simpan_di_luar_0_sampai_120_bulan: "Masa simpan harus antara 0 dan 120 bulan.",
  masa_simpan_belum_ditetapkan: "Masa simpan belum ditetapkan, jadi tidak ada yang dihapus.",
  bot_tidak_terjangkau: "ALETA Bot belum dapat dihubungi.",
};

function Angka({
  nilai,
  label,
  keterangan,
  nada = "netral",
}: {
  nilai: string;
  label: string;
  keterangan: string;
  nada?: "netral" | "perhatian" | "genting";
}) {
  const warna =
    nada === "genting"
      ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
      : nada === "perhatian"
        ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
        : "border-border bg-card";

  return (
    <div className={`rounded-lg border p-4 ${warna}`}>
      <p className="text-2xl font-semibold tabular-nums">{nilai}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
    </div>
  );
}

export function AletaEcourtArsip() {
  const [data, setData] = useState<Arsip | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);

  const [minRuangGb, setMinRuangGb] = useState("5");
  const [maksBerkasMb, setMaksBerkasMb] = useState("50");
  const [simpanBulan, setSimpanBulan] = useState("0");

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const respons = await fetch(apiPath("/api/aleta-ecourt/arsip"), { cache: "no-store" });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      if (!isi?.available || !isi?.arsip) {
        setPesan(isi?.message || "ALETA Bot belum dapat dihubungi.");
        setData(null);
      } else {
        setPesan("");
        setData(isi.arsip);
        setMinRuangGb(String(isi.arsip.pengaturan.minRuangGb));
        setMaksBerkasMb(String(isi.arsip.pengaturan.maksBerkasMb));
        setSimpanBulan(String(isi.arsip.pengaturan.simpanBulan));
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal membaca keadaan arsip.");
      setData(null);
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
        const respons = await fetch(apiPath("/api/aleta-ecourt/arsip"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const hasil = await respons.json();
        const isi = hasil?.data ?? hasil;

        if (isi?.ok) {
          if (typeof isi.terhapus === "number") {
            setCatatan(
              `${isi.terhapus} berkas dihapus${isi.gagal ? `, ${isi.gagal} gagal` : ""}. Catatan dokumennya tetap tersimpan.`
            );
          } else if (isi.aktif === false) {
            setCatatan(ALASAN.masa_simpan_belum_ditetapkan);
          } else {
            setCatatan(berhasil);
          }
          setKonfirmasiHapus(false);
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

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Ruang dan Masa Simpan
            {data?.ruangMenipis === true ? <Badge variant="danger">Ruang menipis</Badge> : null}
            {data?.kedaluwarsa.aktif === false ? <Badge variant="muted">Masa simpan belum ditetapkan</Badge> : null}
          </CardTitle>
          <CardDescription>
            Berkas perkara memuat nama, alamat, dan isi sengketa keluarga. Berapa lama salinannya disimpan di luar
            sistem resmi adalah ketetapan pimpinan.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled={sibuk} onClick={() => void muat()}>
          Muat Ulang
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {pesan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{pesan}</p> : null}
        {catatan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{catatan}</p> : null}

        {memuat ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Angka
                nilai={data.ruang.ok ? `${data.ruang.bebasGb} GB` : "?"}
                label="Sisa ruang disk"
                keterangan={data.ruang.ok ? `dari ${data.ruang.totalGb} GB` : "tidak terbaca"}
                nada={data.ruangMenipis === true ? "genting" : "netral"}
              />
              <Angka
                nilai={`${data.arsip.totalMb} MB`}
                label="Besar arsip"
                keterangan={`${data.arsip.jumlahBerkas} berkas tersimpan`}
              />
              <Angka
                nilai={data.kedaluwarsa.aktif ? `${data.kedaluwarsa.jumlah}` : "—"}
                label="Melewati masa simpan"
                keterangan={
                  data.kedaluwarsa.aktif
                    ? `${data.kedaluwarsa.totalMb} MB dapat dihapus`
                    : "masa simpan belum ditetapkan"
                }
                nada={data.kedaluwarsa.jumlah > 0 ? "perhatian" : "netral"}
              />
            </div>

            {data.ruangMenipis === true ? (
              <p className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100">
                Penarikan berkas berhenti sendiri karena sisa ruang di bawah ambang. Disk penuh di server pengadilan
                tidak hanya menghentikan ALETA — ia menghentikan MySQL, dan itu menghentikan SIPP.
              </p>
            ) : null}
          </>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="arsip-ruang">
              Berhenti menarik bila sisa ruang di bawah
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="arsip-ruang"
                type="number"
                min={1}
                max={500}
                value={minRuangGb}
                onChange={(event) => setMinRuangGb(event.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">GB</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="arsip-berkas">
              Lewati berkas lebih besar dari
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="arsip-berkas"
                type="number"
                min={1}
                max={500}
                value={maksBerkasMb}
                onChange={(event) => setMaksBerkasMb(event.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">MB</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="arsip-simpan">
              Masa simpan berkas
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="arsip-simpan"
                type="number"
                min={0}
                max={120}
                value={simpanBulan}
                onChange={(event) => setSimpanBulan(event.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">bulan</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Dihitung sejak perkaranya <span className="font-medium text-foreground">berkekuatan
              hukum tetap</span> — atau sejak diminutasi bila BHT belum terisi. 0 berarti tidak
              menghapus apa pun.
            </p>
          </div>
        </div>

        <div className="rounded bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Yang dihapus hanya berkasnya</p>
          <p className="mt-1">
            Catatan dokumennya tetap tersimpan: dokumen apa pernah ada, kapan diunggah, siapa yang memverifikasi,
            kapan diberitahukan. Arsip resmi juga tetap di e-Court dan di berkas fisik pengadilan.
          </p>
          <p className="mt-2">
            Hanya berkas yang <span className="font-medium text-foreground">sudah diverifikasi majelis</span> dan{" "}
            <span className="font-medium text-foreground">sudah diberitahukan ke pihak</span> yang dihapus. Yang belum
            masih dibutuhkan, dan menariknya ulang mungkin sudah terlambat.
          </p>
          <p className="mt-2">
            Masa simpan dihitung dari <span className="font-medium text-foreground">selesainya perkara</span>, bukan
            dari kapan berkasnya diunduh. Perkara yang masih berjalan bertahun-tahun tidak akan kehilangan berkas
            awalnya — justru berkas itulah yang dibaca majelis saat memutus.
          </p>
          <p className="mt-2">
            Keadaan akhir perkara dibaca dari SIPP. Bila SIPP sedang tidak terbaca,{" "}
            <span className="font-medium text-foreground">tidak ada yang dihapus</span> — penghapusan berkas perkara
            tidak dapat ditarik kembali.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={sibuk}
            onClick={() =>
              void kirim(
                {
                  minRuangGb: Number(minRuangGb),
                  maksBerkasMb: Number(maksBerkasMb),
                  simpanBulan: Number(simpanBulan),
                },
                "Pengaturan arsip tersimpan."
              )
            }
          >
            {sibuk ? "Menyimpan…" : "Simpan Pengaturan"}
          </Button>

          {data?.kedaluwarsa.aktif && data.kedaluwarsa.jumlah > 0 ? (
            konfirmasiHapus ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={sibuk}
                  onClick={() => void kirim({ aksi: "bersihkan", hapus: true }, "Selesai.")}
                >
                  Ya, hapus {data.kedaluwarsa.jumlah} berkas
                </Button>
                <Button variant="outline" size="sm" disabled={sibuk} onClick={() => setKonfirmasiHapus(false)}>
                  Batal
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" disabled={sibuk} onClick={() => setKonfirmasiHapus(true)}>
                Hapus Berkas Kedaluwarsa
              </Button>
            )
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
