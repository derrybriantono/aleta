"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Pemetaan blangko - kartu admin Integrasi e-Court (butir 17, kontrak K3).
 *
 * Tiga daftar: blangko PUTUSAN per jenis perkara, blangko RELAAS panggilan per
 * keadaan/pihak, dan blangko PEMBERITAHUAN PUTUSAN per pihak. Ekstensi (panel
 * ABT, tab Juru Sita) membaca server lebih dulu, lalu cadangan lokal peramban.
 *
 * Semua pegawai dapat MEMBACA; hanya Super Admin dan Admin yang MENGUBAH.
 * Relaas dan PBT berbenih bawaan dari BLANGKO_RELAAS (sama dengan bawaan
 * tertanam ekstensi); putusan hanya yang diatur di sini, dengan saran dari
 * bawaan ekstensi. Mengosongkan nama berkas = kembali ke bawaan / dihapus.
 */

type Jenis = "putusan" | "relaas" | "pbt";

type Butir = {
  kunci: string;
  sebutan: string;
  namaBerkas: string;
  catatan: string;
  diubahPada: string | null;
  diubahOleh: string;
  sumber: "admin" | "bawaan";
};

type Jawaban = {
  jenis: Jenis;
  butir: Butir[];
  diubahPada: string | null;
  label: string;
  kunciBaku: { kunci: string; sebutan: string }[];
  saran: { kunci: string; namaBerkas: string; catatan: string }[];
  bolehMengubah: boolean;
};

const ALAMAT = "/api/aleta-ecourt/pemetaan-blangko";
const TAB: { jenis: Jenis; label: string }[] = [
  { jenis: "putusan", label: "Putusan" },
  { jenis: "relaas", label: "Relaas panggilan" },
  { jenis: "pbt", label: "Pemberitahuan putusan" },
];

function waktuSingkat(iso: string | null) {
  if (!iso) return "";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function AletaEcourtPemetaanBlangko() {
  const [jenis, setJenis] = useState<Jenis>("putusan");
  const [data, setData] = useState<Jawaban | null>(null);
  const [draf, setDraf] = useState<Record<string, { namaBerkas: string; catatan: string }>>({});
  const [kunciBaru, setKunciBaru] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");

  const muat = useCallback(async (j: Jenis) => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath(`${ALAMAT}?jenis=${j}`), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca pemetaan blangko."));
      const d = (isi?.data ?? null) as Jawaban | null;
      setData(d);
      setDraf({});
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal membaca pemetaan blangko.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void muat(jenis), 0);
    return () => window.clearTimeout(timer);
  }, [muat, jenis]);

  /** Baris layar: butir server + kunci baku yang belum ada + saran putusan. */
  const baris = useMemo(() => {
    if (!data) return [] as (Butir & { saran?: string })[];
    const peta = new Map<string, Butir & { saran?: string }>();
    for (const b of data.butir) peta.set(b.kunci.toLowerCase(), { ...b });
    for (const k of data.kunciBaku) {
      if (!peta.has(k.kunci.toLowerCase())) {
        peta.set(k.kunci.toLowerCase(), {
          kunci: k.kunci,
          sebutan: k.sebutan,
          namaBerkas: "",
          catatan: "",
          diubahPada: null,
          diubahOleh: "",
          sumber: "bawaan",
        });
      }
    }
    for (const s of data.saran) {
      const b = peta.get(s.kunci.toLowerCase());
      if (b && !b.namaBerkas) b.saran = s.namaBerkas;
    }
    for (const k of Object.keys(draf)) {
      if (!peta.has(k.toLowerCase())) {
        peta.set(k.toLowerCase(), { kunci: k, sebutan: k, namaBerkas: "", catatan: "", diubahPada: null, diubahOleh: "", sumber: "bawaan" });
      }
    }
    return [...peta.values()];
  }, [data, draf]);

  const boleh = Boolean(data?.bolehMengubah);
  const adaPerubahan = Object.keys(draf).length > 0;

  const simpan = useCallback(async () => {
    setSibuk(true);
    setGalat("");
    setKabar("");
    try {
      const butir = Object.entries(draf).map(([kunci, v]) => ({ kunci, namaBerkas: v.namaBerkas, catatan: v.catatan }));
      const jawaban = await fetch(apiPath(ALAMAT), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jenis, butir }),
      });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan pemetaan blangko."));
      setData(isi?.data ?? null);
      setDraf({});
      setKabar(`${butir.length} butir disimpan.`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan pemetaan blangko.");
    } finally {
      setSibuk(false);
    }
  }, [draf, jenis]);

  const ubah = (kunci: string, bidang: "namaBerkas" | "catatan", nilai: string, asal: Butir) =>
    setDraf((lama) => ({
      ...lama,
      [kunci]: {
        namaBerkas: lama[kunci]?.namaBerkas ?? (asal.sumber === "admin" ? asal.namaBerkas : ""),
        catatan: lama[kunci]?.catatan ?? asal.catatan,
        [bidang]: nilai,
      },
    }));

  return (
    <Card id="pemetaan-blangko" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Pemetaan blangko
          <Badge variant="muted">putusan · relaas · pemberitahuan putusan</Badge>
        </CardTitle>
        <CardDescription>
          Nama berkas blangko ABT yang dipakai ekstensi untuk tiap jenis perkara (putusan), tiap panggilan sidang
          (relaas), dan tiap pemberitahuan putusan per pihak. Berlaku untuk semua peramban; peramban tanpa sambungan
          ke server memakai cadangan lokalnya. Mengosongkan nama berkas mengembalikan barisnya ke bawaan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Jenis pemetaan">
          {TAB.map((t) => (
            <Button
              key={t.jenis}
              size="sm"
              role="tab"
              aria-selected={jenis === t.jenis}
              variant={jenis === t.jenis ? "default" : "outline"}
              onClick={() => setJenis(t.jenis)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {memuat ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {galat ? <p className="text-sm text-rose-600 dark:text-rose-400">{galat}</p> : null}
        {kabar ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{kabar}</p> : null}
        {!boleh && data ? (
          <p className="text-xs text-muted-foreground">Hanya Super Admin dan Admin yang dapat mengubah pemetaan ini.</p>
        ) : null}

        {data ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-1">{jenis === "putusan" ? "Jenis perkara" : "Keadaan / pihak"}</th>
                  <th className="px-2 py-1">Nama berkas blangko ABT</th>
                  <th className="px-2 py-1">Catatan</th>
                  <th className="px-2 py-1">Asal</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => {
                  const d = draf[b.kunci];
                  const nama = d ? d.namaBerkas : b.namaBerkas;
                  return (
                    <tr key={b.kunci} className="border-t border-border align-top">
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{b.sebutan}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{b.kunci}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={nama}
                          disabled={!boleh || sibuk}
                          placeholder={b.saran ? `saran: ${b.saran}` : "nama berkas .rtf di ABT"}
                          aria-label={`Nama berkas blangko ${b.sebutan}`}
                          onChange={(e) => ubah(b.kunci, "namaBerkas", e.target.value, b)}
                        />
                        {b.saran && boleh && !nama ? (
                          <button
                            type="button"
                            className="mt-0.5 text-[11px] text-primary underline"
                            onClick={() => ubah(b.kunci, "namaBerkas", b.saran!, b)}
                          >
                            Pakai saran bawaan ekstensi
                          </button>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={d ? d.catatan : b.catatan}
                          disabled={!boleh || sibuk}
                          aria-label={`Catatan ${b.sebutan}`}
                          onChange={(e) => ubah(b.kunci, "catatan", e.target.value, b)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {b.sumber === "admin" ? (
                          <span title={`${b.diubahOleh} · ${waktuSingkat(b.diubahPada)}`}>
                            <Badge variant="success">diatur</Badge>
                          </span>
                        ) : b.namaBerkas ? (
                          <Badge variant="muted">bawaan</Badge>
                        ) : (
                          <Badge variant="outline">belum</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {boleh ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              value={kunciBaru}
              placeholder={jenis === "putusan" ? "Jenis perkara lain" : "Kunci lain (mis. panggilan-kuasa)"}
              aria-label="Tambah baris pemetaan"
              onChange={(e) => setKunciBaru(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!kunciBaru.trim()}
              onClick={() => {
                const k = kunciBaru.trim();
                setDraf((lama) => ({ ...lama, [k]: lama[k] ?? { namaBerkas: "", catatan: "" } }));
                setKunciBaru("");
              }}
            >
              Tambah baris
            </Button>
            <Button size="sm" disabled={!adaPerubahan || sibuk} onClick={() => void simpan()}>
              {sibuk ? "Menyimpan..." : "Simpan pemetaan"}
            </Button>
            {adaPerubahan ? (
              <Button size="sm" variant="ghost" disabled={sibuk} onClick={() => setDraf({})}>
                Batalkan perubahan
              </Button>
            ) : null}
          </div>
        ) : null}
        {data?.diubahPada ? (
          <p className="text-xs text-muted-foreground">Terakhir diubah {waktuSingkat(data.diubahPada)}.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
