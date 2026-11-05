"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { GalatAlur, TandaAlur, kirimAlur, panggilAlur } from "@/components/portal/aleta-abt-umum";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NAMA_TINGKAT, golonganBerhak, labelGolongan, type Matriks, type TingkatHak } from "@/lib/aleta-abt-hak-folder";

/**
 * Matriks hak per folder blangko (Tahap 6). Untuk disetujui pemilik; BELUM BERLAKU sebelum disetujui. Hak meniru ABT (tahapan proses, jenis
 * dan alur perkara, penunjukan) ditambah peran ALETA. Folder yang ragu ditandai. Di HP tiap folder menjadi kartu (tanpa geser mendatar).
 * Hanya Super Admin; rute /api/aleta-abt/hak-folder menjaga ulang di server.
 */

type Persetujuan = { disetujui: boolean; sidik: string; oleh: string; pada: string };
type Jawaban = { matriks: Matriks; persetujuan: Persetujuan; berlaku: boolean };

const SINGKAT: Record<TingkatHak, string> = { bebas: "Boleh", ditunjuk: "Bila ditunjuk", validasi: "Validasi", tidak: "-" };
const WARNA: Record<TingkatHak, string> = {
  bebas: "text-emerald-700 dark:text-emerald-300 font-semibold",
  ditunjuk: "text-amber-700 dark:text-amber-300 font-semibold",
  validasi: "text-muted-foreground",
  tidak: "text-muted-foreground/60",
};

export function HakFolderAbt() {
  const [j, setJ] = useState<Jawaban | null>(null);
  const [galat, setGalat] = useState("");
  const [hanyaRagu, setHanyaRagu] = useState(false);
  const [sudahPeriksa, setSudahPeriksa] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    setGalat("");
    try {
      setJ(await panggilAlur<Jawaban>("hak-folder"));
    } catch (e) {
      setGalat((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const kolom = useMemo(() => (j ? golonganBerhak(j.matriks) : []), [j]);
  const baris = useMemo(() => (j ? j.matriks.baris.filter((b) => !hanyaRagu || b.ragu.length > 0) : []), [j, hanyaRagu]);

  const setuju = async (nilai: boolean) => {
    if (!j) return;
    setSibuk(true);
    setGalat("");
    try {
      await kirimAlur("hak-folder", { tindakan: "setuju", setuju: nilai, sidik: j.matriks.sidik });
      setSudahPeriksa(false);
      await muat();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  if (!j) return galat ? <GalatAlur pesan={galat} /> : <p className="text-sm text-muted-foreground">Membaca hak folder...</p>;
  const m = j.matriks;

  return (
    <div className="space-y-5">
      <GalatAlur pesan={galat} />
      <Card>
        <CardHeader>
          <CardTitle>Hak folder blangko</CardTitle>
          <CardDescription>
            Meniru ABT: tahapan perkara, jenis dan alur perkara, serta penunjukan di perkara, ditambah peran ALETA. Blangko ABT by Derry Briantono yang dipakai petugas tidak berubah.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <TandaAlur status="abu">{m.jumlahFolder} folder</TandaAlur>
            <TandaAlur status={m.jumlahRagu ? "kuning" : "hijau"}>{m.jumlahRagu} folder ragu</TandaAlur>
            <TandaAlur status={j.berlaku ? "hijau" : "kuning"}>{j.berlaku ? "disetujui, berlaku" : j.persetujuan.disetujui ? "persetujuan lama gugur: isi berubah" : "belum disetujui, belum berlaku"}</TandaAlur>
          </div>
          {j.persetujuan.disetujui ? (
            <p className="text-xs text-muted-foreground">
              Disetujui oleh {j.persetujuan.oleh || "pemilik"} pada {j.persetujuan.pada.slice(0, 10)}.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Saklar tambahan yang membolehkan Panitera Pengganti memakai blangko putusan tidak ikut dihitung di tabel ini. Super Admin melewati pemeriksaan tahapan seperti di ABT, tetapi melihat peringatan bila blangko di luar tahapan. Peran ALETA tanpa padanan di ABT:{" "}
            {m.tanpaPadananAbt.length ? m.tanpaPadananAbt.map(labelGolongan).join(", ") : "tidak ada"}; mereka tidak diberi hak sampai pemilik memutuskan lain.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hanyaRagu} onChange={(e) => setHanyaRagu(e.target.checked)} />
            Tampilkan hanya folder yang ragu
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Folder <span className="text-sm font-normal text-muted-foreground">({baris.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2">Folder</th>
                  {kolom.map((g) => (
                    <th key={g} className="px-2 py-2 text-center">
                      {labelGolongan(g)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr key={b.folder} className={`border-b border-border align-top ${b.ragu.length ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}>
                    <th scope="row" className="px-2 py-2 text-left font-medium">
                      <span className="break-words">{b.folder}</span> {b.arsip ? <TandaAlur status="abu">arsip</TandaAlur> : null} {b.ragu.length ? <TandaAlur status="kuning">ragu</TandaAlur> : null}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {b.tahapan}; {b.jenis}; {b.penunjukan}
                      </span>
                      {b.ragu.length ? (
                        <ul className="mt-1 list-disc pl-4 text-xs font-normal text-amber-800 dark:text-amber-200">
                          {b.ragu.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      ) : null}
                    </th>
                    {kolom.map((g) => (
                      <td key={g} className={`px-2 py-2 text-center text-xs ${WARNA[b.hak[g]]}`}>
                        {SINGKAT[b.hak[g]]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {baris.map((b) => (
              <article key={b.folder} className={`rounded-xl border p-3 ${b.ragu.length ? "border-amber-300 dark:border-amber-800" : "border-border"}`}>
                <h3 className="break-words text-sm font-semibold">
                  {b.folder} {b.arsip ? <TandaAlur status="abu">arsip</TandaAlur> : null} {b.ragu.length ? <TandaAlur status="kuning">ragu</TandaAlur> : null}
                </h3>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {b.tahapan}; {b.jenis}; {b.penunjukan}
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {kolom
                    .filter((g) => b.hak[g] !== "tidak")
                    .map((g) => (
                      <li key={g}>
                        <span className="font-medium">{labelGolongan(g)}</span>: <span className={WARNA[b.hak[g]]}>{NAMA_TINGKAT[b.hak[g]]}</span>
                      </li>
                    ))}
                  {kolom.every((g) => b.hak[g] === "tidak") ? <li className="text-muted-foreground">Tidak ada peran yang diberi.</li> : null}
                </ul>
                {b.ragu.length ? (
                  <ul className="mt-2 list-disc pl-4 text-xs text-amber-800 dark:text-amber-200">
                    {b.ragu.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Persetujuan pemilik</CardTitle>
          <CardDescription>
            Matriks hanya berlaku sesudah disetujui, dan gugur sendiri bila isinya berubah (sidik {m.sidik}). Menyetujui tidak mengubah apa pun pada Blangko ABT by Derry Briantono.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={sudahPeriksa} onChange={(e) => setSudahPeriksa(e.target.checked)} className="mt-1" />
            <span>Saya sudah memeriksa tabel di atas, termasuk {m.jumlahRagu} folder yang ragu.</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" disabled={!sudahPeriksa || sibuk || j.berlaku} onClick={() => void setuju(true)}>
              Setujui matriks ini
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" disabled={sibuk || !j.persetujuan.disetujui} onClick={() => void setuju(false)}>
              Cabut persetujuan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
