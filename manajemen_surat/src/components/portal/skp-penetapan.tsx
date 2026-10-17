"use client";

import { useMemo, useState } from "react";
import { Lock } from "lucide-react";

import { PemilihPeriodeSkp } from "@/components/portal/skp-lembar";
import {
  KotakPesan,
  Label,
  Memuat,
  ambilSkp,
  useAmbilSkp,
  bulanSelesaiTerakhir,
  hariIniWita,
  labelPeriode,
  namaJabatan,
  namaJenisSkp,
  pesanGalat,
  type JawabanPegawaiSkp,
  type JawabanPenetapanSkp,
} from "@/components/portal/skp-umum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import type { JenisSkp, KunciPeriodeSkpJabatan } from "@/lib/skp-jabatan-tipe";
import { tanggalPanjang } from "@/lib/tanggal-indonesia";

/**
 * Penetapan SKP: tangkapan realisasi yang dikunci. Draf boleh dihitung ulang;
 * yang sudah DIKUNCI tidak berubah lagi walau data SIPP berubah kemudian.
 * Hanya atasan langsung, Ketua, Panitera, dan administrator yang menetapkan -
 * tidak pernah pegawainya sendiri.
 */
export function PenetapanSkp({ lingkup }: { lingkup: "bawahan" | "semua" }) {
  const bawaan = useMemo(() => bulanSelesaiTerakhir(hariIniWita()), []);
  const [pilih, setPilih] = useState("");
  const [jenisPilih, setJenisPilih] = useState<JenisSkp | "">("");
  const [tahun, setTahun] = useState(bawaan.tahun);
  const [periode, setPeriode] = useState<KunciPeriodeSkpJabatan>(bawaan.periode);
  const [galatTetap, setGalatTetap] = useState("");
  const [kabar, setKabar] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [konfirmasiKunci, setKonfirmasiKunci] = useState(false);
  const [ulang, setUlang] = useState(0);

  const daftar = useAmbilSkp<JawabanPegawaiSkp>(`/api/skp/pegawai?lingkup=${lingkup}`, lingkup);
  const pegawai = daftar.data?.pegawai ?? [];
  const terpilih = pegawai.find((p) => p.userId === pilih) ?? null;
  // SKP Pimpinan memerlukan eviden hakim dan ditetapkan dari menu Rekap Hakim.
  const jenisPilihan: JenisSkp[] = (terpilih?.jenisTersedia ?? []).filter((j) => j !== "hakim" && j !== "pimpinan");
  const jenis: JenisSkp | "" = jenisPilih && jenisPilihan.includes(jenisPilih) ? jenisPilih : (jenisPilihan[0] ?? "");

  let alamat: string | null = null;
  if (pilih && jenis) {
    const kueri = new URLSearchParams({ jenis, pegawai: pilih, tahun: String(tahun), periode });
    alamat = `/api/skp/penetapan?${kueri.toString()}`;
  }
  const { data, galat: galatMuat, memuat } = useAmbilSkp<JawabanPenetapanSkp>(alamat, `${pilih}|${jenis}`, ulang);
  const galat = galatTetap || daftar.galat || galatMuat;

  const tetapkan = async (kunci: boolean) => {
    if (!pilih || !jenis) return;
    setSibuk(true);
    setGalatTetap("");
    setKabar("");
    try {
      await ambilSkp("/api/skp/penetapan", { metode: "POST", badan: { jenis, pegawai: pilih, tahun, periode, kunci } });
      setKabar(kunci ? "Penetapan dikunci. Angkanya tidak berubah lagi." : "Hitungan disimpan sebagai draf penetapan.");
      setKonfirmasiKunci(false);
      setUlang((n) => n + 1);
    } catch (e) {
      setGalatTetap(pesanGalat(e));
    } finally {
      setSibuk(false);
    }
  };

  const terkunci = data?.penetapan?.status === "terkunci";

  if (daftar.memuat && !daftar.data) return <Memuat teks="Memuat daftar pegawai…" />;

  return (
    <div className="flex flex-col gap-4">
      <KotakPesan jenis="info">
        Penetapan menyimpan angka SKP satu pegawai untuk satu periode. Selama masih draf, angkanya boleh dihitung ulang dari SIPP;
        setelah <strong>dikunci</strong>, angkanya tetap walau data SIPP berubah kemudian.
      </KotakPesan>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <Label className="min-w-[15rem]">
            Pegawai
            <NativeSelect aria-label="Pegawai yang ditetapkan" value={pilih} onChange={(e) => {
                setPilih(e.target.value);
                setKonfirmasiKunci(false);
                setGalatTetap("");
                setKabar("");
              }} className="h-10">
              <option value="">Pilih pegawai</option>
              {pegawai.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.nama} - {namaJabatan(p.jabatanUtama)}
                </option>
              ))}
            </NativeSelect>
          </Label>
          {jenisPilihan.length > 1 ? (
            <Label>
              Jenis SKP
              <NativeSelect aria-label="Jenis SKP yang ditetapkan" value={jenis} onChange={(e) => {
                  setJenisPilih(e.target.value as JenisSkp);
                  setKonfirmasiKunci(false);
                }} className="h-10 min-w-[12rem]">
                {jenisPilihan.map((j) => (
                  <option key={j} value={j}>
                    {namaJenisSkp(j)}
                  </option>
                ))}
              </NativeSelect>
            </Label>
          ) : null}
          <PemilihPeriodeSkp
            tahun={tahun}
            periode={periode}
            onUbah={(t, p) => {
              setTahun(t);
              setPeriode(p);
            }}
          />
        </CardContent>
      </Card>

      {pilih && terpilih && jenisPilihan.length === 0 ? (
        <KotakPesan jenis="info">
          Pegawai ini tidak memiliki SKP jabatan perkara yang dapat ditetapkan dari layar ini. SKP Pimpinan ditetapkan dari tombol &quot;Unduh eviden SKP&quot; di
          halaman Rekap Hakim.
        </KotakPesan>
      ) : null}
      {kabar ? <KotakPesan jenis="ok">{kabar}</KotakPesan> : null}
      {galat ? <KotakPesan jenis="galat">{galat}</KotakPesan> : null}
      {memuat ? <Memuat teks="Memuat penetapan…" /> : null}

      {data && jenis ? (
        <Card aria-label="Penetapan SKP">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-[0.14em]">
              {namaJenisSkp(jenis)} · {labelPeriode(periode, tahun)}
            </CardDescription>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {terpilih?.nama}
              {terkunci ? (
                <Badge variant="success">
                  <Lock className="mr-1 h-3 w-3" aria-hidden />
                  terkunci
                </Badge>
              ) : data.penetapan ? (
                <Badge variant="warning">draf</Badge>
              ) : (
                <Badge variant="muted">belum ditetapkan</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.penetapan ? (
              <p className="text-sm text-muted-foreground">
                Dihitung {tanggalPanjang(data.penetapan.dihitungPada.slice(0, 10), data.penetapan.dihitungPada)}
                {data.penetapan.dikunciPada ? `, dikunci ${tanggalPanjang(data.penetapan.dikunciPada.slice(0, 10), data.penetapan.dikunciPada)}` : ""}
                {data.penetapan.pejabatPenilaiNama ? ` · pejabat penilai ${data.penetapan.pejabatPenilaiNama}` : ""}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada penetapan untuk periode ini.</p>
            )}

            {data.lembar ? (
              <ul className="flex flex-col gap-3" aria-label="Tangkapan penetapan">
                {[...data.lembar.rhk, ...data.lembar.blokTambahan].map((r) => (
                  <li key={r.kunci} className="rounded-lg border border-border">
                    <p className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-medium">{r.teks}</p>
                    <ul className="divide-y divide-border">
                      {r.indikator.map((i) => (
                        <li key={i.kunci} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                          <span className="min-w-0 flex-1">{i.teks}</span>
                          <span className="text-xs text-muted-foreground">Target {i.targetTeks || "—"}</span>
                          <span className="font-semibold tabular-nums">{i.realisasi === null ? "—" : i.realisasiTeks || String(i.realisasi)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : null}

            {terkunci ? (
              <KotakPesan jenis="info">Penetapan ini sudah dikunci dan tidak dapat diubah lagi.</KotakPesan>
            ) : data.bolehTinjau ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={sibuk} onClick={() => void tetapkan(false)}>
                    {data.penetapan ? "Hitung ulang dan simpan draf" : "Hitung dan simpan sebagai draf"}
                  </Button>
                  {!konfirmasiKunci ? (
                    <Button type="button" disabled={sibuk} onClick={() => setKonfirmasiKunci(true)}>
                      <Lock className="h-4 w-4" aria-hidden />
                      Kunci penetapan
                    </Button>
                  ) : null}
                </div>
                {konfirmasiKunci ? (
                  <KotakPesan jenis="peringatan">
                    <p>
                      Setelah dikunci, angka periode ini tidak dapat diubah lagi. Penetapan akan dihitung ulang dari SIPP saat ini lalu dikunci.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" size="sm" disabled={sibuk} onClick={() => void tetapkan(true)}>
                        Ya, kunci sekarang
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={() => setKonfirmasiKunci(false)}>
                        Batal
                      </Button>
                    </div>
                  </KotakPesan>
                ) : null}
              </div>
            ) : (
              <KotakPesan jenis="info">
                Penetapan hanya dapat dibuat oleh atasan langsung, Ketua, Panitera, atau administrator - bukan oleh pegawai yang bersangkutan.
              </KotakPesan>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
