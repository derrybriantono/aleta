"use client";

import { useEffect, useState } from "react";
import { CircleCheck, History, Loader2, PenLine, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";

/**
 * Isian Kelas B - fakta perkara yang hanya diketahui yang menyidangkan.
 *
 * ============================================================================
 * BUKAN 144 KOTAK KOSONG
 * ============================================================================
 *
 * Kelas B adalah variabel yang tidak ada sumbernya di mana pun: mas kawin,
 * status wali nikah, alasan poligami. Menampilkannya sebagai daftar panjang
 * berurutan nomor akan membuat panitera menghadapi "#0650#", "#1046#",
 * "#1152#" tanpa tahu mana yang berlaku untuk perkaranya.
 *
 * Yang ditampilkan di sini hanya yang DIBUTUHKAN blangko yang sedang dibuka,
 * dikelompokkan menurut maknanya. Kelompok yang tidak berlaku tidak muncul
 * sama sekali.
 *
 * ============================================================================
 * TIDAK ADA NILAI BAWAAN, TIDAK ADA USULAN MESIN
 * ============================================================================
 *
 * Isian ini masuk ke naskah yang ditandatangani. Menebaknya - termasuk dengan
 * menyalin dari perkara lain yang mirip - berarti mengarang fakta perkara.
 * Kotak yang kosong memang harus kosong sampai ada yang mengetiknya.
 */

type Butir = {
  noVar: string;
  nama: string;
  kelompok: string;
  nilai: string;
  diisiOleh: string;
  diisiAt: string;
  jumlahPakai: number;
};

type Kelompok = {
  kode: string;
  nama: string;
  urutan: number;
  butir: Butir[];
  jumlahTerisi: number;
};

type Ringkas = { jumlah: number; terisi: number; kosong: number; kalimat: string };

type Riwayat = { nilaiLama: string; nilaiBaru: string; oleh: string; pada: string };

export function IsianKelasB({
  perkaraId,
  penanda,
  semua,
  olehNama,
}: {
  perkaraId: string;
  /**
   * Penanda blangko yang sedang dibuka. Yang bukan Kelas B disaring di server.
   * Kosongkan dan setel `semua` bila blangkonya belum dipilih.
   */
  penanda?: string[];
  /** Menampilkan seluruh Kelas B yang dipakai pustaka - untuk layar perkara. */
  semua?: boolean;
  olehNama?: string;
}) {
  const [kelompok, setKelompok] = useState<Kelompok[]>([]);
  const [ringkas, setRingkas] = useState<Ringkas | null>(null);
  const [draf, setDraf] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState("");
  const [riwayat, setRiwayat] = useState<Record<string, Riwayat[]>>({});
  const [putaran, setPutaran] = useState(0);

  const kunciPenanda = (penanda ?? []).join(",");

  // Pemuatan ditaruh DI DALAM efek dan hasilnya dibuang bila komponen sudah
  // ditutup: panitera yang berpindah panel sebelum jawabannya tiba tidak boleh
  // meninggalkan pemuatan yang menyetel keadaan komponen yang sudah tidak ada.
  useEffect(() => {
    let batal = false;
    void (async () => {
      if (!perkaraId || (!kunciPenanda && !semua)) {
        if (!batal) setMemuat(false);
        return;
      }
      if (!batal) setMemuat(true);
      try {
        const ruas = semua ? "semua=1" : `penanda=${encodeURIComponent(kunciPenanda)}`;
        const jawaban = await fetch(
          apiPath(`/api/aleta-ecourt/isian?perkaraId=${encodeURIComponent(perkaraId)}&${ruas}`),
          { cache: "no-store" }
        );
        const isi = (await jawaban.json()) as { ada: boolean; kelompok?: Kelompok[]; ringkas?: Ringkas; sebab?: string };
        if (batal) return;
        if (!isi.ada) {
          setPesan(isi.sebab ?? "Isian tidak terbaca.");
          setKelompok([]);
          return;
        }
        setKelompok(isi.kelompok ?? []);
        setRingkas(isi.ringkas ?? null);
        // Draf disetel dari nilai yang TERSIMPAN, bukan dikosongkan: panitera
        // yang membuka ulang halaman harus melihat yang sudah ia ketik, bukan
        // kotak kosong yang membuatnya mengetik ulang.
        const awal: Record<string, string> = {};
        for (const k of isi.kelompok ?? []) for (const b of k.butir) awal[b.noVar] = b.nilai;
        setDraf(awal);
      } catch {
        if (!batal) setPesan("Isian tidak terbaca.");
      } finally {
        if (!batal) setMemuat(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, [perkaraId, kunciPenanda, semua, putaran]);

  const muat = () => setPutaran((n) => n + 1);

  const simpan = async () => {
    setMenyimpan(true);
    setPesan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/isian"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkaraId, nilai: draf, olehNama }),
      });
      const hasil = (await jawaban.json()) as {
        ok: boolean;
        jumlahDisimpan: number;
        ditolak: Array<{ noVar: string; sebab: string }>;
        sebab: string;
      };
      if (!hasil.ok) {
        setPesan(hasil.sebab || "Penyimpanan gagal.");
        return;
      }
      const ditolak = hasil.ditolak ?? [];
      setPesan(
        ditolak.length > 0
          ? `${hasil.jumlahDisimpan} isian tersimpan; ${ditolak.length} ditolak: ${ditolak
              .map((d) => `#${d.noVar}# (${d.sebab})`)
              .join(", ")}`
          : hasil.jumlahDisimpan === 0
            ? "Tidak ada yang berubah."
            : `${hasil.jumlahDisimpan} isian tersimpan.`
      );
      muat();
    } catch {
      setPesan("Penyimpanan tidak terjawab.");
    } finally {
      setMenyimpan(false);
    }
  };

  const bukaRiwayat = async (noVar: string) => {
    if (riwayat[noVar]) {
      setRiwayat((s) => {
        const salin = { ...s };
        delete salin[noVar];
        return salin;
      });
      return;
    }
    const jawaban = await fetch(
      apiPath(
        `/api/aleta-ecourt/isian?perkaraId=${encodeURIComponent(perkaraId)}&noVar=${encodeURIComponent(noVar)}&riwayat=1`
      ),
      { cache: "no-store" }
    );
    const isi = (await jawaban.json()) as { riwayat?: Riwayat[] };
    setRiwayat((s) => ({ ...s, [noVar]: isi.riwayat ?? [] }));
  };

  if (memuat) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuat isian...
      </div>
    );
  }

  if (kelompok.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Isian perkara</CardTitle>
          <CardDescription>
            {pesan || "Blangko ini tidak menuntut satu pun isian tangan - seluruh penandanya punya sumbernya sendiri."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLine className="size-4" /> Isian perkara
          </CardTitle>
          <CardDescription>
            Keterangan yang hanya diketahui hakim atau panitera yang menyidangkan. Sekali diisi, ia terpakai di
            seluruh dokumen perkara ini &mdash; BAS maupun putusan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ringkas ? (
            <div className="flex items-center gap-2">
              <Badge variant={ringkas.kosong === 0 ? "default" : "outline"}>
                {ringkas.terisi} / {ringkas.jumlah}
              </Badge>
              <span className="text-sm text-muted-foreground">{ringkas.kalimat}</span>
            </div>
          ) : null}
          {pesan ? (
            <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
              <span>{pesan}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {kelompok.map((k) => (
        <Card key={k.kode}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-baseline justify-between gap-2 text-base">
              <span>{k.nama}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {k.jumlahTerisi} dari {k.butir.length} terisi
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {k.butir.map((b) => (
              <div key={b.noVar} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <label className="text-sm font-medium" htmlFor={`isian-${b.noVar}`}>
                    {b.nama || `#${b.noVar}#`}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{b.noVar}#</span>
                    {b.diisiOleh ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => void bukaRiwayat(b.noVar)}
                      >
                        <History className="size-3" /> riwayat
                      </Button>
                    ) : null}
                  </div>
                </div>
                <Textarea
                  id={`isian-${b.noVar}`}
                  value={draf[b.noVar] ?? ""}
                  onChange={(e) => setDraf((s) => ({ ...s, [b.noVar]: e.target.value }))}
                  rows={2}
                  className="text-sm"
                  placeholder="Belum diisi"
                />
                {b.diisiOleh ? (
                  <p className="text-xs text-muted-foreground">
                    terakhir diisi {b.diisiOleh}
                    {b.diisiAt ? ` pada ${b.diisiAt.slice(0, 10)}` : ""}
                  </p>
                ) : null}
                {riwayat[b.noVar] ? (
                  <div className="space-y-1 rounded-md border border-border/50 bg-muted/20 p-2">
                    {riwayat[b.noVar].length === 0 ? (
                      <p className="text-xs text-muted-foreground">Belum pernah disunting.</p>
                    ) : (
                      riwayat[b.noVar].map((r, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {r.pada.slice(0, 16).replace("T", " ")} &middot; {r.oleh} &middot;{" "}
                          {r.nilaiLama ? `"${r.nilaiLama}" ` : ""}&rarr; {r.nilaiBaru ? `"${r.nilaiBaru}"` : "(dikosongkan)"}
                        </p>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-2">
        <Button onClick={simpan} disabled={menyimpan}>
          {menyimpan ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan isian
        </Button>
        <span className="text-xs text-muted-foreground">
          Tiap perubahan tercatat beserta siapa yang mengubahnya.
        </span>
      </div>
    </div>
  );
}
