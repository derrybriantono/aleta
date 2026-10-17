"use client";

import { useMemo, useState } from "react";

import {
  KotakPesan,
  Label,
  Memuat,
  ambilSkp,
  hariIniWita,
  pesanGalat,
  useAmbilSkp,
  type JawabanTargetSkp,
} from "@/components/portal/skp-umum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { rhkJabatanSkp } from "@/lib/skp-jabatan-katalog";
import { JABATAN_SKP, LABEL_JABATAN_SKP, type JabatanSkp, type StatusTargetSkp } from "@/lib/skp-jabatan-tipe";

/**
 * Target dan Rencana Hasil Kerja per jabatan. Bunyi dan target bawaan adalah
 * USULAN ALETA (berlabel "usulan") sampai disahkan - dicocokkan dengan SKP
 * resmi di e-Kinerja. Mengubah hanya Panitera, Ketua, Super Admin, dan Admin.
 */

type Sunting = { targetNilai: string; targetTeks: string; disahkan: boolean };

const kunciBaris = (rhk: string, indikator: string) => `${rhk}|${indikator}`;

export function TargetSkp() {
  const tahunIni = Number(hariIniWita().slice(0, 4));
  const [tahun, setTahun] = useState(tahunIni);
  const [jabatan, setJabatan] = useState<JabatanSkp>("panitera");
  const [kabar, setKabar] = useState("");
  const [galatSimpan, setGalatSimpan] = useState("");
  const [sunting, setSunting] = useState<Record<string, Sunting>>({});
  const [sibuk, setSibuk] = useState(false);
  const [ulang, setUlang] = useState(0);
  const { data, galat: galatMuat, memuat } = useAmbilSkp<JawabanTargetSkp>(
    `/api/skp/target?tahun=${tahun}&jabatan=${jabatan}`,
    `${tahun}|${jabatan}`,
    ulang
  );
  const galat = galatSimpan || galatMuat;

  const katalog = useMemo(() => rhkJabatanSkp(jabatan), [jabatan]);
  const tersimpan = useMemo(() => {
    const peta = new Map<string, JawabanTargetSkp["target"][number]>();
    for (const t of data?.target ?? []) peta.set(kunciBaris(t.kunciRhk, t.kunciIndikator), t);
    return peta;
  }, [data]);
  const bolehUbah = data?.bolehUbah === true;
  const jumlahUbah = Object.keys(sunting).length;

  const nilaiSaatIni = (rhk: string, ind: string, bawaanNilai: number | null, bawaanTeks: string): Sunting => {
    const k = kunciBaris(rhk, ind);
    if (sunting[k]) return sunting[k];
    const t = tersimpan.get(k);
    const nilai = t ? t.targetNilai : bawaanNilai;
    return {
      targetNilai: nilai === null || nilai === undefined ? "" : String(nilai),
      targetTeks: t ? t.targetTeks : bawaanTeks,
      disahkan: t?.status === "disahkan",
    };
  };

  const ubah = (rhk: string, ind: string, awal: Sunting, bagian: Partial<Sunting>) =>
    setSunting((s) => ({ ...s, [kunciBaris(rhk, ind)]: { ...(s[kunciBaris(rhk, ind)] ?? awal), ...bagian } }));

  const simpan = async () => {
    setSibuk(true);
    setGalatSimpan("");
    setKabar("");
    try {
      const butir = Object.entries(sunting).map(([k, v]) => {
        const [kunciRhk, kunciIndikator] = k.split("|");
        const angka = v.targetNilai.trim() === "" ? null : Number(v.targetNilai);
        if (angka !== null && !Number.isFinite(angka)) throw new Error("Nilai target harus berupa angka.");
        return {
          jabatan,
          tahun,
          kunciRhk,
          kunciIndikator,
          targetNilai: angka,
          targetTeks: v.targetTeks.trim(),
          status: (v.disahkan ? "disahkan" : "usulan") as StatusTargetSkp,
        };
      });
      await ambilSkp("/api/skp/target", { metode: "PUT", badan: { butir } });
      setKabar(`${butir.length} target disimpan.`);
      setSunting({});
      setUlang((n) => n + 1);
    } catch (e) {
      setGalatSimpan(pesanGalat(e));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <KotakPesan jenis="info">
        Bunyi Rencana Hasil Kerja, indikator, dan target di bawah ini adalah <strong>usulan</strong> sampai ditandai sudah disahkan. Setelah
        SKP resmi dari e-Kinerja BKN tersedia, samakan angkanya di sini lalu centang &quot;Sudah disahkan&quot;.{" "}
        {bolehUbah ? "" : "Target hanya dapat diubah oleh Panitera, Ketua, atau administrator."}
      </KotakPesan>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <Label>
            Jabatan
            <NativeSelect aria-label="Jabatan target" value={jabatan} onChange={(e) => {
                setJabatan(e.target.value as JabatanSkp);
                setSunting({});
                setGalatSimpan("");
              }} className="h-10 min-w-[15rem]">
              {JABATAN_SKP.map((j) => (
                <option key={j} value={j}>
                  {LABEL_JABATAN_SKP[j]}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <Label>
            Tahun
            <NativeSelect aria-label="Tahun target" value={String(tahun)} onChange={(e) => {
                setTahun(Number(e.target.value));
                setSunting({});
                setGalatSimpan("");
              }} className="h-10 min-w-[6.5rem]">
              {[tahunIni + 1, tahunIni, tahunIni - 1].map((t) => (
                <option key={t} value={String(t)}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </Label>
          {bolehUbah ? (
            <Button type="button" disabled={sibuk || jumlahUbah === 0} onClick={() => void simpan()}>
              {jumlahUbah > 0 ? `Simpan ${jumlahUbah} perubahan` : "Simpan perubahan"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {kabar ? <KotakPesan jenis="ok">{kabar}</KotakPesan> : null}
      {galat ? <KotakPesan jenis="galat">{galat}</KotakPesan> : null}
      {memuat && !data ? <Memuat teks="Memuat target…" /> : null}

      {data
        ? katalog.map((rhk) => (
            <Card key={rhk.kunci} data-target-rhk={rhk.kunci} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardDescription className="uppercase tracking-[0.14em]">Rencana Hasil Kerja</CardDescription>
                <CardTitle className="text-base leading-snug">{rhk.teks}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                  {rhk.indikator.map((ind) => {
                    const awal = nilaiSaatIni(rhk.kunci, ind.kunci, ind.targetNilai, ind.targetTeks);
                    const simpanan = tersimpan.get(kunciBaris(rhk.kunci, ind.kunci));
                    const disahkanTersimpan = simpanan?.status === "disahkan";
                    return (
                      <li key={ind.kunci} className="grid gap-2 px-3 py-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)]" data-target-indikator={ind.kunci}>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            <Badge variant="outline">{ind.aspek}</Badge>
                            <span>{ind.teks}</span>
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            Satuan: {ind.satuan}
                            {disahkanTersimpan ? <Badge variant="success">disahkan</Badge> : <Badge variant="muted">usulan</Badge>}
                          </p>
                        </div>
                        {bolehUbah ? (
                          <div className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-end">
                            <Label>
                              Angka target
                              <Input
                                type="number"
                                step="any"
                                min={0}
                                value={awal.targetNilai}
                                onChange={(e) => ubah(rhk.kunci, ind.kunci, awal, { targetNilai: e.target.value })}
                                aria-label={`Angka target ${ind.teks}`}
                                className="h-10"
                              />
                            </Label>
                            <Label>
                              Bunyi target
                              <Input
                                value={awal.targetTeks}
                                onChange={(e) => ubah(rhk.kunci, ind.kunci, awal, { targetTeks: e.target.value })}
                                aria-label={`Bunyi target ${ind.teks}`}
                                className="h-10"
                                maxLength={120}
                              />
                            </Label>
                            <label className="flex items-center gap-2 pb-2 text-xs">
                              <input
                                type="checkbox"
                                checked={awal.disahkan}
                                onChange={(e) => ubah(rhk.kunci, ind.kunci, awal, { disahkan: e.target.checked })}
                                aria-label={`Sudah disahkan ${ind.teks}`}
                                className="h-4 w-4 rounded border-input"
                              />
                              Sudah disahkan
                            </label>
                          </div>
                        ) : (
                          <p className="text-sm">
                            Target: <span className="font-semibold tabular-nums">{awal.targetTeks || "Belum ada target"}</span>
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))
        : null}
    </div>
  );
}
