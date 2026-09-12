"use client";

/**
 * ============================================================================
 * RIWAYAT PERBUATAN ALETA - LINTAS PERKARA
 * ============================================================================
 *
 * Tab Riwayat pada panel ekstensi menjawab "apa yang pernah dikerjakan ALETA
 * pada perkara INI". Pertanyaan yang lain justru yang ditanyakan pimpinan dan
 * yang dibutuhkan e-Audit: "apa saja yang dikerjakan ALETA hari ini", "siapa
 * operatornya", "ada berapa yang gagal, dan kenapa".
 *
 * Jawabannya sudah tersimpan seluruhnya sejak 1.106.0 - yang belum ada hanya
 * layar yang membacanya lintas perkara.
 *
 * ============================================================================
 * DISARING DI LAYAR, BUKAN DI SERVER
 * ============================================================================
 *
 * Yang diambil satu halaman terakhir (bawaannya 100 baris), lalu disaring di
 * peramban. Alasannya sederhana: penyaringan yang dikirim ke server menuntut
 * satu perjalanan untuk tiap huruf yang diketik, dan pada daftar sepanjang ini
 * hasilnya sama persis sementara layarnya terasa tersendat. Yang mencari lebih
 * jauh ke belakang menaikkan batasnya - dan itu satu perjalanan, bukan seratus.
 *
 * Ekspornya mengikuti apa yang SEDANG terlihat, bukan seluruh yang terambil:
 * yang menekan Unduh sedang menyaring sesuatu, dan berkas yang isinya berbeda
 * dari layarnya adalah berkas yang salah.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Download, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

type Jejak = {
  id: number;
  waktu: string;
  aksi: string;
  jenis: string;
  perkaraId: number;
  nomorPerkara: string;
  tanggalPenetapan: string;
  akunSipp: string;
  namaPejabat: string;
  operator: string;
  berhasil: boolean;
  kering: boolean;
  alasan: string;
  jumlahLangkah: number;
  tabel: string[];
};

const NAMA_JENIS: Record<string, string> = {
  pmh: "Penetapan Majelis Hakim",
  ppp: "Penunjukan Panitera Pengganti",
  pjs: "Penunjukan Juru Sita",
  phs: "Penetapan Hari Sidang",
  dataUmum: "Isian Data Umum",
};

/**
 * Satu ruas CSV.
 *
 * Nomor perkara memuat garis miring dan koma tidak pernah muncul di dalamnya -
 * tetapi keterangan gagal bisa memuat keduanya, dan satu koma yang tidak
 * dikutip menggeser seluruh kolom di kanannya tanpa ada yang menyadarinya
 * sampai berkasnya dibaca orang lain.
 */
function ruasCsv(nilai: string | number | boolean): string {
  const teks = String(nilai ?? "");
  return /[",\n;]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
}

function waktuTerbaca(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID");
}

export function AletaEcourtRiwayat() {
  const [baris, setBaris] = useState<Jejak[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [hanyaGagal, setHanyaGagal] = useState(false);
  const [batas, setBatas] = useState(100);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const respons = await fetch(
        apiPath(`/api/aleta-bot/penunjukan/riwayat?batas=${batas}`),
        { credentials: "include", cache: "no-store" }
      );
      if (!respons.ok) {
        throw new Error(
          respons.status === 403
            ? "Peran Anda tidak diberi akses riwayat penetapan."
            : `ALETA menjawab ${respons.status}.`
        );
      }
      const isi = (await respons.json()) as { baris?: Jejak[] };
      setBaris(Array.isArray(isi.baris) ? isi.baris : []);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Riwayat tidak dapat dibaca.");
      setBaris([]);
    } finally {
      setMemuat(false);
    }
  }, [batas]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const tersaring = useMemo(() => {
    const kunci = cari.trim().toLowerCase();
    return baris.filter((x) => {
      if (hanyaGagal && x.berhasil) return false;
      if (!kunci) return true;
      return `${x.nomorPerkara} ${x.jenis} ${x.namaPejabat} ${x.akunSipp} ${x.operator} ${x.alasan}`
        .toLowerCase()
        .includes(kunci);
    });
  }, [baris, cari, hanyaGagal]);

  const unduh = useCallback(() => {
    const kepala = [
      "waktu",
      "aksi",
      "jenis",
      "nomor_perkara",
      "tanggal_penetapan",
      "nama_pejabat",
      "akun_sipp",
      "operator",
      "berhasil",
      "alasan",
      "jumlah_langkah",
      "tabel",
    ];
    const isi = tersaring.map((x) =>
      [
        waktuTerbaca(x.waktu),
        x.aksi,
        x.jenis,
        x.nomorPerkara,
        x.tanggalPenetapan,
        x.namaPejabat,
        x.akunSipp,
        x.operator,
        x.berhasil ? "ya" : "tidak",
        x.alasan,
        x.jumlahLangkah,
        x.tabel.join(" | "),
      ]
        .map(ruasCsv)
        .join(",")
    );

    // BOM di depan: tanpa itu Excel di Windows membaca berkas UTF-8 sebagai
    // ANSI, dan tiap nama bergelar berubah menjadi aksara yang tidak terbaca.
    const teks = `﻿${[kepala.join(","), ...isi].join("\r\n")}`;
    const berkas = new Blob([teks], { type: "text/csv;charset=utf-8" });
    const alamat = URL.createObjectURL(berkas);
    const tautan = document.createElement("a");
    tautan.href = alamat;
    tautan.download = `riwayat-aleta-${new Date().toISOString().slice(0, 10)}.csv`;
    tautan.click();
    URL.revokeObjectURL(alamat);
  }, [tersaring]);

  const gagal = tersaring.filter((x) => !x.berhasil).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Riwayat ALETA
          <Badge variant="muted">{tersaring.length} baris</Badge>
          {gagal > 0 ? <Badge variant="danger">{gagal} tidak jadi</Badge> : null}
        </CardTitle>
        <CardDescription>
          Apa saja yang dituliskan ALETA ke SIPP, beserta yang DITOLAK dan sebabnya. Tercatat di
          basis data ALETA sendiri — basis data SIPP tidak memuat satu kata pun tentang ALETA.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={cari}
            onChange={(peristiwa) => setCari(peristiwa.target.value)}
            placeholder="Cari nomor perkara, pejabat, operator, sebab…"
            aria-label="Cari riwayat ALETA"
            className="max-w-sm"
          />
          <Button
            type="button"
            variant={hanyaGagal ? "default" : "outline"}
            size="sm"
            onClick={() => setHanyaGagal((x) => !x)}
          >
            Hanya yang tidak jadi
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void muat()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={unduh}
            disabled={tersaring.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Unduh CSV
          </Button>
          {batas < 500 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setBatas(500)}>
              Ambil lebih banyak
            </Button>
          ) : null}
        </div>

        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}

        {memuat ? (
          <div className="min-h-[12rem] animate-pulse rounded-lg border border-border bg-muted/30" />
        ) : tersaring.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {baris.length === 0
              ? "ALETA belum pernah menuliskan penetapan."
              : "Tidak ada baris yang cocok dengan saringan ini."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Waktu</th>
                  <th className="py-2 pr-3 font-medium">Perkara</th>
                  <th className="py-2 pr-3 font-medium">Perbuatan</th>
                  <th className="py-2 pr-3 font-medium">Atas nama</th>
                  <th className="py-2 pr-3 font-medium">Operator</th>
                  <th className="py-2 font-medium">Hasil</th>
                </tr>
              </thead>
              <tbody>
                {tersaring.map((x) => (
                  <tr key={x.id} className="border-b border-border/60 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-muted-foreground">
                      {waktuTerbaca(x.waktu)}
                    </td>
                    <td className="py-2 pr-3 font-medium tabular-nums">{x.nomorPerkara || "—"}</td>
                    <td className="py-2 pr-3">
                      {x.aksi === "hapus" ? "Dibatalkan" : "Ditulis"} —{" "}
                      {NAMA_JENIS[x.jenis] || x.jenis}
                      {x.jumlahLangkah > 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          {x.jumlahLangkah} langkah · {x.tabel.join(", ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      {x.namaPejabat || x.akunSipp || "—"}
                      {x.namaPejabat && x.akunSipp ? (
                        <span className="block text-xs text-muted-foreground">{x.akunSipp}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{x.operator || "—"}</td>
                    <td className="py-2">
                      {x.berhasil ? (
                        <Badge variant="muted">berhasil</Badge>
                      ) : (
                        <span className="text-destructive">
                          tidak jadi — {x.alasan || "sebabnya tidak tercatat"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
