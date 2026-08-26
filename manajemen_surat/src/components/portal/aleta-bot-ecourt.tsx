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
  };
  verifikasi: { keputusanTersimpan: number; belumDiteruskan: number };
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

  return (
    <div className="space-y-4">
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
          <Angka
            judul="Belum Diteruskan"
            nilai={status.verifikasi.belumDiteruskan}
            keterangan="Menunggu diteruskan ke e-Court."
            nada={status.verifikasi.belumDiteruskan > 0 ? "perhatian" : "netral"}
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
