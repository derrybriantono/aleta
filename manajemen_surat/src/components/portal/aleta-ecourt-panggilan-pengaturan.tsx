"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Tenggang waktu kepatutan panggilan, per jalur.
 *
 * ============================================================================
 * ANGKANYA DAPAT DIUBAH, CARA HITUNGNYA TIDAK
 * ============================================================================
 *
 * Hari kalender atau hari kerja melekat pada dasar hukum tiap jalur - SK KMA
 * 363/2022 memakai Hari kalender, Pasal 122 HIR memakai hari kerja. Membiarkan
 * itu diubah dari layar berarti membiarkan aturan diputarbalikkan dengan satu
 * klik.
 *
 * Yang dapat disesuaikan hanya angkanya, untuk berjaga bila aturannya berubah
 * sebelum aplikasi ini diperbarui.
 */

type Pengaturan = {
  hariElektronik: number;
  hariSuratTercatat: number;
  hariBiasa: number;
};

type Jalur = Record<
  "elektronik" | "surat_tercatat" | "biasa",
  { label: string; dasar: string; bawaan: number; hariKerja: boolean; perluDiterima: boolean }
>;

const URUTAN: Array<{ kunci: keyof Jalur; medan: keyof Pengaturan }> = [
  { kunci: "elektronik", medan: "hariElektronik" },
  { kunci: "surat_tercatat", medan: "hariSuratTercatat" },
  { kunci: "biasa", medan: "hariBiasa" },
];

export function AletaEcourtPanggilanPengaturan() {
  const [nilai, setNilai] = useState<Pengaturan | null>(null);
  const [jalur, setJalur] = useState<Jalur | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/panggilan"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca pengaturan panggilan."));

      const data = isi?.data ?? isi;
      if (!data?.available) {
        setGalat(String(data?.message || "ALETA Bot belum dapat dihubungi."));
        return;
      }
      setNilai(data.pengaturan as Pengaturan);
      setJalur((data.jalur ?? null) as Jalur | null);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca pengaturan.");
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

  const simpan = useCallback(async () => {
    if (!nilai) return;
    setSibuk(true);
    setGalat("");
    setPesan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/panggilan"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nilai),
      });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));

      const data = isi?.data ?? isi;
      if (!data?.ok) {
        setGalat(String(data?.message || data?.alasan || "Tidak tersimpan."));
        return;
      }
      setNilai(data.pengaturan as Pengaturan);
      setPesan("Tersimpan. Berlaku pada penilaian berikutnya.");
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }, [nilai]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenggang waktu kepatutan panggilan</CardTitle>
        <CardDescription>
          Menentukan berapa hari sebelum sidang sebuah panggilan masih disebut patut, per jalur
          panggilan. Dipakai layar Jadwal Sidang untuk menandai panggilan yang terlalu mepet.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
        ) : null}
        {pesan ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {pesan}
          </p>
        ) : null}

        {memuat || !nilai || !jalur ? (
          <p className="text-sm text-muted-foreground">Memuat pengaturan…</p>
        ) : (
          <>
            <div className="space-y-3">
              {URUTAN.map(({ kunci, medan }) => (
                <div key={kunci} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                  <div className="min-w-[16rem] flex-1">
                    <p className="text-sm font-medium">{jalur[kunci].label}</p>
                    <p className="text-xs text-muted-foreground">{jalur[kunci].dasar}</p>
                  </div>

                  <label className="flex items-center gap-2 text-xs">
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={nilai[medan]}
                      onChange={(peristiwa) =>
                        setNilai({ ...nilai, [medan]: Number(peristiwa.target.value) })
                      }
                      className="w-20"
                      aria-label={`Tenggang ${jalur[kunci].label}`}
                    />
                    <Badge variant="muted">
                      {jalur[kunci].hariKerja ? "hari kerja" : "hari kalender"}
                    </Badge>
                  </label>

                  {jalur[kunci].perluDiterima ? (
                    <Badge variant="warning" title="Selain tenggang waktu, suratnya harus terbukti diterima.">
                      wajib terbukti diterima
                    </Badge>
                  ) : null}
                </div>
              ))}

              <Button size="sm" disabled={sibuk} onClick={() => void simpan()}>
                {sibuk ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground">Perkara e-Court.</strong> Penggugat/Pemohon
                selalu dipanggil elektronik — tidak ada pilihan surat tercatat. Tergugat dipanggil
                elektronik bila menyetujui saluran elektronik; bila menolak atau belum menjawab,
                lewat surat tercatat.
              </p>
              <p>
                <strong className="text-foreground">Perkara biasa (non-e-Court).</strong> Seluruh
                pihak dipanggil jurusita seperti biasa, dengan tenggang hari kerja menurut Pasal 122
                HIR.
              </p>
              <p>
                <strong className="text-foreground">Surat tercatat menuntut dua hal.</strong> Selain
                dikirim tepat waktu, suratnya harus terbukti diterima di alamat tergugat berdasarkan
                lacak kiriman. Surat yang terkirim tepat waktu tetapi belum terbukti sampai ditandai
                kuning, bukan hijau.
              </p>
              <p>
                <strong className="text-foreground">Libur nasional tidak diperhitungkan.</strong>{" "}
                Hitungan hari kerja hanya mengecualikan Sabtu dan Minggu. Jalur e-Court memakai hari
                kalender, sehingga tidak terpengaruh.
              </p>
              <p>
                <strong className="text-foreground">Penilaian ini alat bantu.</strong> Sah tidaknya
                panggilan tetap ditetapkan majelis, bukan oleh angka di layar.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
