"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BatangKemajuan, GalatAlur, TandaAlur, kirimAlur, panggilAlur, type StatusTanda } from "@/components/portal/aleta-abt-umum";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SYARAT_CETAK, SYARAT_HARI_TANPA_MERAH } from "@/lib/aleta-abt-berdampingan";
import type { KesiapanKeluarga } from "@/lib/aleta-abt-pindah";
import type { KeadaanPindah } from "@/server/modules/aleta-abt-pindah/service";

/**
 * Kesiapan pindah ke ALETA ABT per jenis perkara (Tahap 8). Selama sebuah jenis belum dinyalakan, cetak blangko jenis itu tetap lewat ABT
 * seperti biasa. Layar ini hanya menampilkan angka dan syarat; tidak ada isi naskah dan tidak ada data pihak. Hanya Super Admin; rute
 * /api/aleta-abt/pindah menjaga ulang di server. Bahasa sehari-hari: tanpa kata teknis.
 */

const persenTeks = (x: number | null) => (x === null ? "belum terukur" : `${x.toFixed(x >= 99.95 || x < 0.05 ? 0 : 1).replace(".", ",")}%`);
const tanggalPendek = (iso: string) => iso.slice(0, 10).split("-").reverse().join("-");

/** Isi berkas sebagai teks; `File.text()` tidak ada di semua peramban lama, jadi dibaca lewat FileReader bila perlu. */
function bacaTeks(berkas: File): Promise<string> {
  if (typeof berkas.text === "function") return berkas.text();
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onload = () => selesai(String(pembaca.result ?? ""));
    pembaca.onerror = () => gagal(new Error("Berkas tidak dapat dibaca."));
    pembaca.readAsText(berkas);
  });
}

type Keadaan = { status: StatusTanda; teks: string };

export function keadaanKeluarga(k: Pick<KesiapanKeluarga, "aktif" | "siap" | "ukur" | "syarat">): Keadaan {
  if (k.aktif) return { status: "hijau", teks: "Menyala" };
  if (k.siap) return { status: "hijau", teks: "Siap dinyalakan" };
  if (!k.ukur || k.ukur.naskah === 0) return { status: "abu", teks: "Belum terukur" };
  return { status: "kuning", teks: "Belum siap" };
}

export function KesiapanAletaAbt() {
  const [j, setJ] = useState<KeadaanPindah | null>(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState("");
  const pilihBerkas = useRef<HTMLInputElement | null>(null);

  const muat = useCallback(async () => {
    setGalat("");
    try {
      setJ(await panggilAlur<KeadaanPindah>("pindah"));
    } catch (e) {
      setGalat((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const ubah = async (k: KesiapanKeluarga, aktif: boolean) => {
    if (aktif && !window.confirm(`Nyalakan ALETA ABT untuk ${k.nama}? Cetak blangko jenis ini tidak lagi bergantung pada ABT.`)) return;
    setSibuk(k.kunci);
    setGalat("");
    setInfo("");
    try {
      await kirimAlur("pindah", { tindakan: "saklar", keluarga: k.kunci, aktif });
      setInfo(`${k.nama}: ${aktif ? "ALETA ABT dinyalakan." : "kembali memakai ABT."}`);
      await muat();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
    }
  };

  const muatBerkas = async (berkas: File | undefined) => {
    if (!berkas) return;
    setSibuk("laporan");
    setGalat("");
    setInfo("");
    try {
      if (berkas.size > 2_000_000) throw new Error("Berkas terlalu besar untuk hasil pengukuran.");
      let isi: unknown;
      try {
        isi = JSON.parse(await bacaTeks(berkas));
      } catch {
        throw new Error("Berkas ini tidak dapat dibaca sebagai hasil pengukuran.");
      }
      const h = await kirimAlur<{ keluarga: number; terukur: number }>("pindah", { tindakan: "laporan", laporan: isi });
      setInfo(`Hasil pengukuran dimuat: ${h.terukur} dari ${h.keluarga} jenis perkara sudah terukur.`);
      await muat();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
      if (pilihBerkas.current) pilihBerkas.current.value = "";
    }
  };

  if (!j) return galat ? <GalatAlur pesan={galat} /> : <p className="text-sm text-muted-foreground">Membaca kesiapan...</p>;

  return (
    <div className="space-y-5">
      <GalatAlur pesan={galat} />
      {info ? (
        <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          {info}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pindah ke ALETA ABT, jenis demi jenis</CardTitle>
          <CardDescription>
            Semua jenis perkara masih mencetak lewat ABT seperti biasa. Satu jenis baru boleh dipindah bila naskahnya terbukti sama dengan ABT dan cetak berdampingannya sudah cukup dan bersih. Tiap jenis
            punya tombol sendiri; tombolnya menolak bila syaratnya belum terpenuhi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <TandaAlur status={j.menyala ? "hijau" : "abu"}>{j.menyala} menyala</TandaAlur>
            <TandaAlur status={j.siap ? "hijau" : "abu"}>{j.siap} siap dinyalakan</TandaAlur>
            <TandaAlur status="abu">
              {j.terukur} dari {j.keluarga.length} sudah terukur
            </TandaAlur>
          </div>
          {j.dimatikanServer ? <GalatAlur pesan="Pindah ke ALETA ABT dimatikan lewat pengaturan server, jadi semua jenis tetap memakai ABT dan belum dapat dinyalakan." /> : null}
          <p className="text-xs text-muted-foreground">
            Panel Blangko ABT by Derry Briantono belum membuka ALETA ABT dari layar ini. Selama sebuah jenis belum menyala, panel tetap bekerja seperti biasa.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hasil pengukuran</CardTitle>
          <CardDescription>
            {j.laporan.ada
              ? `Dibuat ${tanggalPendek(j.laporan.dibuat)}${j.laporan.dimuatOleh ? `, dimuat oleh ${j.laporan.dimuatOleh}` : ""}. ${j.laporan.keterangan}`
              : "Belum ada hasil pengukuran. Jalankan pengukuran pada salinan uji di komputer pengembang, lalu muat berkas hasilnya di sini."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <input ref={pilihBerkas} type="file" accept="application/json,.json" className="hidden" aria-label="Berkas hasil pengukuran" onChange={(e) => void muatBerkas(e.target.files?.[0])} />
          <Button className="w-full sm:w-auto" variant="outline" disabled={sibuk !== ""} onClick={() => pilihBerkas.current?.click()}>
            Muat hasil pengukuran
          </Button>
          <p className="text-xs text-muted-foreground">Yang dimuat hanya angka per jenis perkara. Tidak ada isi naskah dan tidak ada data pihak.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {j.keluarga.map((k) => {
          const ke = keadaanKeluarga(k);
          const u = k.ukur;
          return (
            <Card key={k.kunci}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{k.nama}</CardTitle>
                  <TandaAlur status={ke.status}>{ke.teks}</TandaAlur>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>Naskah sama dengan ABT</span>
                    <span className="text-muted-foreground">{persenTeks(k.persenNaskah)}</span>
                  </div>
                  <BatangKemajuan nilai={k.persenNaskah ?? 0} maks={100} label={`Naskah ${k.nama} sama dengan ABT`} />
                  <p className="text-xs text-muted-foreground">
                    {u && u.naskah > 0 ? `${u.naskah} naskah dari ${u.perkara} perkara diperiksa. Isian: ${persenTeks(k.persenIsian)}.` : u?.sebabBelum ? u.sebabBelum : "Belum ada hasil pengukuran."}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>Cetak berdampingan</span>
                    <span className="text-muted-foreground">
                      {k.cetak} dari {SYARAT_CETAK} cetak
                    </span>
                  </div>
                  <BatangKemajuan nilai={k.cetak} maks={SYARAT_CETAK} label={`Cetak berdampingan ${k.nama}`} />
                  <p className="text-xs text-muted-foreground">
                    {k.hijau} sama, {k.kuning} beda dijelaskan, {k.merah} beda merah. Tanpa beda merah selama {k.hariTanpaMerah} hari; syaratnya {SYARAT_HARI_TANPA_MERAH} hari.
                  </p>
                </div>
                <ul className="space-y-1 text-xs">
                  {k.syarat.map((s) => (
                    <li key={s.kunci} className="flex gap-2">
                      <span aria-hidden="true">{s.lulus ? "✓" : "•"}</span>
                      <span className={s.lulus ? "text-muted-foreground" : ""}>
                        <span className="sr-only">{s.lulus ? "Terpenuhi: " : "Belum terpenuhi: "}</span>
                        {s.keterangan}
                      </span>
                    </li>
                  ))}
                </ul>
                {k.aktif ? (
                  <Button className="w-full sm:w-auto" variant="outline" disabled={sibuk !== ""} onClick={() => void ubah(k, false)}>
                    Matikan, kembali ke ABT
                  </Button>
                ) : (
                  <Button className="w-full sm:w-auto" disabled={sibuk !== "" || !k.siap || j.dimatikanServer} onClick={() => void ubah(k, true)}>
                    Nyalakan ALETA ABT
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
