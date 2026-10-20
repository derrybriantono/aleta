"use client";

import { useMemo, useState } from "react";
import { Link2, Pencil, Plus, Search } from "lucide-react";

import {
  KotakPesan,
  Label,
  Memuat,
  ambilSkp,
  hariIniWita,
  namaJabatan,
  pesanGalat,
  useAmbilSkp,
  type JawabanPemetaanSkp,
} from "@/components/portal/skp-umum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { JABATAN_SKP, LABEL_JABATAN_SKP, type JabatanSkp, type PemetaanAkunPegawaiSkp } from "@/lib/skp-jabatan-tipe";
import { tanggalPanjang } from "@/lib/tanggal-indonesia";

/**
 * Pemetaan akun SIPP dan jabatan pegawai. Menyimpan = mengonfirmasi: jabatan
 * utama yang ditulis di sini yang dipakai SKP (usulan dari jabatan ALETA
 * hanya bahan awal). Satu akun bersama (Kasir, Meja) dapat ditautkan ke
 * beberapa pegawai selama tanggal berlakunya tidak bertumpang.
 */

type PegawaiPemetaan = JawabanPemetaanSkp["pegawai"][number];

type Isian = {
  id: string | null;
  usernameSipp: string;
  jabatanUtama: JabatanSkp | "";
  tugasPp: boolean;
  berlakuDari: string;
  berlakuSampai: string;
};

function isianDariTautan(t: PemetaanAkunPegawaiSkp): Isian {
  return {
    id: t.id,
    usernameSipp: t.usernameSipp,
    jabatanUtama: t.jabatanUtama ?? "",
    tugasPp: t.jabatanTambahan.includes("pp"),
    berlakuDari: t.berlakuDari,
    berlakuSampai: t.berlakuSampai ?? "",
  };
}

function FormTautan({
  pegawai,
  awal,
  onSelesai,
  onBatal,
}: {
  pegawai: PegawaiPemetaan;
  awal: Isian;
  onSelesai: (pesan: string) => void;
  onBatal: () => void;
}) {
  const [isi, setIsi] = useState<Isian>(awal);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const idDaftar = `akun-${pegawai.userId}`;

  const simpan = async () => {
    setSibuk(true);
    setGalat("");
    try {
      if (!isi.usernameSipp.trim()) throw new Error("Isi nama akun SIPP yang ditautkan.");
      if (!isi.jabatanUtama) throw new Error("Pilih jabatan utama.");
      if (!isi.berlakuDari) throw new Error("Isi tanggal mulai berlaku.");
      if (isi.berlakuSampai && isi.berlakuSampai < isi.berlakuDari) throw new Error("Tanggal berakhir tidak boleh sebelum tanggal mulai.");
      await ambilSkp("/api/skp/pemetaan", {
        metode: "PUT",
        badan: {
          ...(isi.id ? { id: isi.id } : {}),
          usernameSipp: isi.usernameSipp.trim(),
          userId: pegawai.userId,
          jabatanUtama: isi.jabatanUtama,
          jabatanTambahan: isi.tugasPp && isi.jabatanUtama !== "pp" ? ["pp"] : [],
          berlakuDari: isi.berlakuDari,
          ...(isi.berlakuSampai ? { berlakuSampai: isi.berlakuSampai } : {}),
        },
      });
      onSelesai(`Tautan ${pegawai.nama} disimpan dan jabatannya dikonfirmasi.`);
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3" data-form-tautan={pegawai.userId}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Label>
          Akun SIPP
          <Input
            list={idDaftar}
            value={isi.usernameSipp}
            onChange={(e) => setIsi({ ...isi, usernameSipp: e.target.value })}
            aria-label={`Akun SIPP ${pegawai.nama}`}
            className="h-10"
            placeholder="Nama akun di SIPP"
          />
          <datalist id={idDaftar}>
            {pegawai.akunProfil.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <span className="font-normal">
            Mediator yang tidak punya akun SIPP: tulis <span className="font-mono">mediator:</span> diikuti nomor mediatornya di SIPP.
          </span>
        </Label>
        <Label>
          Jabatan utama
          <NativeSelect
            aria-label={`Jabatan utama ${pegawai.nama}`}
            value={isi.jabatanUtama}
            onChange={(e) => setIsi({ ...isi, jabatanUtama: e.target.value as JabatanSkp | "" })}
            className="h-10"
          >
            <option value="">Pilih jabatan</option>
            {JABATAN_SKP.map((j) => (
              <option key={j} value={j}>
                {LABEL_JABATAN_SKP[j]}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Label>
          Berlaku mulai
          <Input
            type="date"
            value={isi.berlakuDari}
            onChange={(e) => setIsi({ ...isi, berlakuDari: e.target.value })}
            aria-label={`Berlaku mulai ${pegawai.nama}`}
            className="h-10"
          />
        </Label>
        <Label>
          Berlaku sampai (kosong = masih berlaku)
          <Input
            type="date"
            value={isi.berlakuSampai}
            onChange={(e) => setIsi({ ...isi, berlakuSampai: e.target.value })}
            aria-label={`Berlaku sampai ${pegawai.nama}`}
            className="h-10"
          />
        </Label>
      </div>
      {isi.jabatanUtama && isi.jabatanUtama !== "pp" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isi.tugasPp}
            onChange={(e) => setIsi({ ...isi, tugasPp: e.target.checked })}
            className="h-4 w-4 rounded border-input"
          />
          Juga bertugas sebagai Panitera Pengganti (tugas PP ikut dihitung sebagai tugas tambahan)
        </label>
      ) : null}
      {galat ? <KotakPesan jenis="galat">{galat}</KotakPesan> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={sibuk} onClick={() => void simpan()}>
          Simpan dan konfirmasi
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={onBatal}>
          Batal
        </Button>
      </div>
    </div>
  );
}

export function PemetaanSkp() {
  const [kabar, setKabar] = useState("");
  const [cari, setCari] = useState("");
  const [formUntuk, setFormUntuk] = useState<{ userId: string; isi: Isian } | null>(null);
  const [ulang, setUlang] = useState(0);
  const { data, galat, memuat } = useAmbilSkp<JawabanPemetaanSkp>("/api/skp/pemetaan", "pemetaan", ulang);

  const akunBersama = useMemo(() => {
    const peta = new Map<string, Set<string>>();
    for (const t of data?.pemetaan ?? []) {
      peta.set(t.usernameSipp, (peta.get(t.usernameSipp) ?? new Set()).add(t.userId));
    }
    return peta;
  }, [data]);

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return (data?.pegawai ?? []).filter((p) => !kata || p.nama.toLowerCase().includes(kata) || (p.nip ?? "").includes(kata));
  }, [data, cari]);

  if (memuat && !data) return <Memuat teks="Memuat pemetaan akun dan jabatan…" />;
  if (galat && !data) {
    return (
      <div className="flex flex-col gap-2">
        <KotakPesan jenis="galat">{galat}</KotakPesan>
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => setUlang((n) => n + 1)}>
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const mulaiForm = (p: PegawaiPemetaan, isi?: Isian) =>
    setFormUntuk({
      userId: p.userId,
      isi: isi ?? {
        id: null,
        usernameSipp: p.akunProfil[0] ?? "",
        jabatanUtama: p.jabatanUtama ?? p.saranUtama ?? "",
        tugasPp: (p.jabatanTambahan.length > 0 ? p.jabatanTambahan : p.saranTambahan).includes("pp"),
        berlakuDari: hariIniWita(),
        berlakuSampai: "",
      },
    });

  return (
    <div className="flex flex-col gap-4">
      <KotakPesan jenis="info">
        Di sini Panitera atau administrator memastikan jabatan utama tiap pegawai dan akun SIPP yang dipakainya. Angka SKP dibaca
        dari akun yang tertaut pada tanggal kejadiannya, sehingga akun bersama (Kasir, Meja) dapat berpindah tangan tanpa
        mencampur angka. {data.bolehUbah ? "" : "Anda dapat melihat, tetapi tidak mengubah, pemetaan ini."}
      </KotakPesan>
      {kabar ? <KotakPesan jenis="ok">{kabar}</KotakPesan> : null}
      {galat ? <KotakPesan jenis="galat">{galat}</KotakPesan> : null}

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <Label className="max-w-md">
            Cari nama atau NIP
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pegawai di pemetaan" className="h-10 pl-9" placeholder="Ketik nama atau NIP" />
            </span>
          </Label>

          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border" aria-label="Pemetaan pegawai">
            {tampil.map((p) => {
              const tautan = data.pemetaan.filter((t) => t.userId === p.userId).sort((a, b) => b.berlakuDari.localeCompare(a.berlakuDari));
              const dikonfirmasi = tautan.some((t) => t.dikonfirmasiPada);
              return (
                <li key={p.userId} className="px-3 py-3" data-pemetaan={p.userId}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{p.nama}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.nip ? `NIP ${p.nip} · ` : ""}
                        Jabatan SKP: {namaJabatan(p.jabatanUtama)}
                        {p.jabatanTambahan.length > 0 ? ` (+ ${p.jabatanTambahan.map((j) => namaJabatan(j)).join(", ")})` : ""}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5">
                        {dikonfirmasi ? (
                          <Badge variant="success">jabatan dikonfirmasi</Badge>
                        ) : (
                          <Badge variant="warning">jabatan belum dikonfirmasi</Badge>
                        )}
                        {!dikonfirmasi && p.saranUtama ? (
                          <span className="text-xs text-muted-foreground">Usulan: {namaJabatan(p.saranUtama)}</span>
                        ) : null}
                        {p.akunProfil.length > 0 ? (
                          <span className="text-xs text-muted-foreground">Akun di profil: {p.akunProfil.join(", ")}</span>
                        ) : null}
                      </p>
                    </div>
                    {data.bolehUbah && formUntuk?.userId !== p.userId ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => mulaiForm(p)} aria-label={`Tambah tautan akun ${p.nama}`}>
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        {tautan.length === 0 ? "Konfirmasi" : "Tautan baru"}
                      </Button>
                    ) : null}
                  </div>

                  {tautan.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {tautan.map((t) => {
                        const bersama = (akunBersama.get(t.usernameSipp)?.size ?? 0) > 1;
                        return (
                          <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs">
                            <Link2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            <span className="font-medium">{t.usernameSipp}</span>
                            {bersama ? <Badge variant="info">akun bersama</Badge> : null}
                            <span className="text-muted-foreground">
                              {namaJabatan(t.jabatanUtama)}
                              {t.jabatanTambahan.includes("pp") ? " + tugas PP" : ""} · {tanggalPanjang(t.berlakuDari, t.berlakuDari)}
                              {" s.d. "}
                              {t.berlakuSampai ? tanggalPanjang(t.berlakuSampai, t.berlakuSampai) : "masih berlaku"}
                            </span>
                            {data.bolehUbah ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="ml-auto h-7 px-2"
                                aria-label={`Ubah tautan ${t.usernameSipp} ${p.nama}`}
                                onClick={() => mulaiForm(p, isianDariTautan(t))}
                              >
                                <Pencil className="h-3 w-3" aria-hidden />
                                Ubah
                              </Button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Belum ada akun SIPP yang ditautkan.</p>
                  )}

                  {formUntuk?.userId === p.userId ? (
                    <FormTautan
                      pegawai={p}
                      awal={formUntuk.isi}
                      onBatal={() => setFormUntuk(null)}
                      onSelesai={(pesan) => {
                        setFormUntuk(null);
                        setKabar(pesan);
                        setUlang((n) => n + 1);
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
            {tampil.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">Tidak ada pegawai yang cocok.</li> : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
