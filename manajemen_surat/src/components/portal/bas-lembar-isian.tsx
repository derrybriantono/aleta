"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CornerDownLeft, History, Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";

/**
 * Lembar tanya-jawab yang benar-benar dapat diisi.
 *
 * ============================================================================
 * JAWABAN CONTOH ADALAH BANTUAN MENGETIK, BUKAN JAWABAN
 * ============================================================================
 *
 * ABT menyertakan jawaban contoh pada tiap pertanyaan - "Saya kenal dengan ...
 * karena saya adalah ...;". Contoh itu ditampilkan sebagai bayangan di kotak
 * isian dan hanya masuk bila panitera menekan "Pakai contoh".
 *
 * Ia TIDAK pernah masuk dengan sendirinya. Jawaban contoh yang diam-diam
 * menjadi jawaban tersimpan berarti BAS memuat keterangan yang tidak pernah
 * dikatakan siapa pun - dan bunyinya begitu wajar sehingga tidak ada yang
 * memeriksanya lagi.
 *
 * ============================================================================
 * MENYIMPAN SEBAGIAN ITU WAJAR
 * ============================================================================
 *
 * Sidang berjalan sementara lembarnya diisi. Tombol simpan tidak menuntut
 * lembar lengkap, dan lembar yang dibuka kembali memperlihatkan apa yang sudah
 * diketik - bukan lembar kosong yang membuat panitera mengira pekerjaannya
 * hilang.
 */

type Baris = {
  urutan: number;
  pertanyaan: string;
  jawabanBawaan: string;
  jawaban: string;
  penandaTersisa: string[];
};

type Saksi = {
  nama: string;
  umur: string;
  agama: string;
  pendidikan: string;
  pekerjaan: string;
  alamat: string;
};

type RekamanAbt = {
  saksiKe: number;
  tanyaJawab: Array<{ urutan: number; pertanyaan: string; jawaban: string }>;
} | null;

type Lembar = {
  ok: boolean;
  kode: string;
  jumlahPertanyaan: number;
  jumlahTerjawab: number;
  baris: Baris[];
  terisi: Array<{ noVar: string; nama: string; nilai: string; asal: string }>;
  kosong: Array<{ noVar: string; nama: string; sebab: string }>;
  halangan: string[];
  tersimpan?: { saksi: Saksi; tanggalSidang: string; keadaan: string; catatan: string; diubahAt: string } | null;
  rekamanAbt?: RekamanAbt;
};

const SAKSI_KOSONG: Saksi = { nama: "", umur: "", agama: "", pendidikan: "", pekerjaan: "", alamat: "" };

const MEDAN_SAKSI: Array<{ kunci: keyof Saksi; label: string; petunjuk: string }> = [
  { kunci: "nama", label: "Nama saksi", petunjuk: "Nama lengkap sebagaimana disebut di persidangan" },
  { kunci: "umur", label: "Umur", petunjuk: "Tahun" },
  { kunci: "agama", label: "Agama", petunjuk: "Menentukan lafal sumpah" },
  { kunci: "pendidikan", label: "Pendidikan", petunjuk: "" },
  { kunci: "pekerjaan", label: "Pekerjaan", petunjuk: "" },
  { kunci: "alamat", label: "Alamat", petunjuk: "Tempat tinggal" },
];

export function LembarIsian({
  perkaraId,
  nomorPerkara,
  kode,
  namaKumpulan,
  onTersimpan,
}: {
  perkaraId: string;
  nomorPerkara: string;
  kode: string;
  namaKumpulan: string;
  onTersimpan?: () => void;
}) {
  const [saksiKe, setSaksiKe] = useState(1);
  const [menyimpan, setMenyimpan] = useState(false);
  const [saksi, setSaksi] = useState<Saksi>(SAKSI_KOSONG);
  const [jawaban, setJawaban] = useState<Record<number, string>>({});
  const [tanggalSidang, setTanggalSidang] = useState("");
  const [catatan, setCatatan] = useState("");
  const [kotor, setKotor] = useState(false);
  const [pesan, setPesan] = useState("");
  const [waktuSimpan, setWaktuSimpan] = useState("");

  /**
   * Lembar yang termuat, BESERTA kunci yang memuatnya.
   *
   * Kuncinya disimpan bersama isinya, bukan sebagai penanda "sedang memuat"
   * tersendiri. Panitera yang menekan saksi ke-1 lalu cepat berpindah ke ke-2
   * dengan begitu tidak mungkin melihat isi saksi ke-1 mendarat di layar saksi
   * ke-2 hanya karena jawabannya datang belakangan - isi yang kuncinya tidak
   * cocok memang bukan isi layar ini.
   */
  const kunci = `${perkaraId}|${kode}|${saksiKe}`;
  const [dimuat, setDimuat] = useState<{ kunci: string; lembar: Lembar | null } | null>(null);
  const memuat = dimuat?.kunci !== kunci;
  const lembar = dimuat?.kunci === kunci ? dimuat.lembar : null;

  useEffect(() => {
    if (!perkaraId || !kode) return;
    let batal = false;
    const kendali = new AbortController();
    const alamat = `/api/aleta-ecourt/bas/tanya-jawab?perkaraId=${encodeURIComponent(perkaraId)}&kode=${encodeURIComponent(kode)}&saksiKe=${saksiKe}`;

    fetch(apiPath(alamat), { cache: "no-store", signal: kendali.signal })
      .then((jawabanRute) => jawabanRute.json())
      .then((isi) => {
        if (batal) return;
        const data = (isi?.data ?? {}) as Lembar;
        setSaksi(data.tersimpan?.saksi ?? SAKSI_KOSONG);
        setTanggalSidang(data.tersimpan?.tanggalSidang ?? "");
        setCatatan(data.tersimpan?.catatan ?? "");
        setWaktuSimpan(data.tersimpan?.diubahAt ?? "");
        const awal: Record<number, string> = {};
        for (const baris of data.baris ?? []) awal[baris.urutan] = baris.jawaban ?? "";
        setJawaban(awal);
        setKotor(false);
        setPesan("");
        setDimuat({ kunci, lembar: data });
      })
      .catch(() => {
        if (batal) return;
        setPesan("Lembar tidak dapat dimuat.");
        setDimuat({ kunci, lembar: null });
      });

    return () => {
      batal = true;
      kendali.abort();
    };
  }, [kunci, perkaraId, kode, saksiKe]);

  const simpan = useCallback(
    async (keadaan: "draf" | "selesai") => {
      if (!lembar?.ok) return;
      setMenyimpan(true);
      setPesan("");
      try {
        const jawabanRute = await fetch(apiPath("/api/aleta-ecourt/bas/lembar"), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            perkaraId,
            nomorPerkara,
            kode,
            namaKumpulan,
            saksiKe,
            saksi,
            tanggalSidang,
            catatan,
            keadaan,
            baris: (lembar.baris ?? []).map((baris) => ({
              urutan: baris.urutan,
              pertanyaan: baris.pertanyaan,
              jawaban: jawaban[baris.urutan] ?? "",
            })),
          }),
        });
        const hasil = (await jawabanRute.json())?.data;
        if (!hasil?.ok) {
          setPesan("Lembar belum tersimpan. Coba lagi.");
          return;
        }
        setWaktuSimpan(hasil.lembar?.diubahAt ?? new Date().toISOString());
        setKotor(false);
        onTersimpan?.();
      } catch {
        setPesan("Tidak dapat menghubungi ALETA. Jawaban Anda masih ada di layar — coba simpan lagi.");
      } finally {
        setMenyimpan(false);
      }
    },
    [lembar, perkaraId, nomorPerkara, kode, namaKumpulan, saksiKe, saksi, tanggalSidang, catatan, jawaban, onTersimpan]
  );

  const jumlahTerjawab = useMemo(
    () => Object.values(jawaban).filter((nilai) => String(nilai).trim()).length,
    [jawaban]
  );

  const ubahSaksi = (kunci: keyof Saksi, nilai: string) => {
    setSaksi((lama) => ({ ...lama, [kunci]: nilai }));
    setKotor(true);
  };

  const ubahJawaban = (urutan: number, nilai: string) => {
    setJawaban((lama) => ({ ...lama, [urutan]: nilai }));
    setKotor(true);
  };

  if (memuat) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan lembar…
        </CardContent>
      </Card>
    );
  }

  if (!lembar) return null;

  if (!lembar.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lembar belum dapat dibuka</CardTitle>
          <CardDescription>{lembar.halangan?.join(" ") || "Kumpulan pertanyaan tidak terbaca."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{namaKumpulan || lembar.kode}</CardTitle>
            <CardDescription>
              {jumlahTerjawab} dari {lembar.jumlahPertanyaan} pertanyaan terjawab
              {waktuSimpan ? ` · tersimpan ${new Date(waktuSimpan).toLocaleString("id-ID")}` : " · belum pernah disimpan"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <NativeSelect
              className="h-9 w-auto"
              value={String(saksiKe)}
              onChange={(event) => setSaksiKe(Number(event.target.value) || 1)}
              aria-label="Saksi ke berapa"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  Saksi ke-{n}
                </option>
              ))}
            </NativeSelect>
            <Button size="sm" onClick={() => void simpan("draf")} disabled={menyimpan || !kotor}>
              {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </Button>
          </div>
        </div>

        {kotor ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">Ada perubahan yang belum disimpan.</p>
        ) : null}
        {pesan ? <p className="text-xs text-amber-600 dark:text-amber-400">{pesan}</p> : null}
        {saksiKe > 2 ? (
          <p className="text-xs text-muted-foreground">
            Blangko BAS hanya menyediakan tempat untuk dua saksi. Lembar ini tetap tersimpan dan terbaca, tetapi
            belum ada tempatnya pada naskah yang diunduh.
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3 rounded-md bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Jati diri saksi ke-{saksiKe}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MEDAN_SAKSI.map((medan) => (
              <label key={medan.kunci} className="space-y-1">
                <span className="text-xs text-muted-foreground">{medan.label}</span>
                <Input
                  value={saksi[medan.kunci]}
                  onChange={(event) => ubahSaksi(medan.kunci, event.target.value)}
                  placeholder={medan.petunjuk}
                />
              </label>
            ))}
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Tanggal sidang</span>
              <Input
                value={tanggalSidang}
                onChange={(event) => {
                  setTanggalSidang(event.target.value);
                  setKotor(true);
                }}
                placeholder="Misalnya 5 September 2026"
              />
            </label>
          </div>
        </div>

        {lembar.terisi.length > 0 ? (
          <div className="space-y-1 rounded-md bg-muted/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Terisi sendiri dari SIPP</p>
            {lembar.terisi.map((item) => (
              <p key={item.noVar} className="text-sm">
                <span className="text-muted-foreground">{item.nama}: </span>
                <span className="font-medium">{item.nilai}</span>
              </p>
            ))}
          </div>
        ) : null}

        {(lembar.rekamanAbt?.tanyaJawab?.length ?? 0) > 0 ? (
          <div className="space-y-2 rounded-md border border-border/60 p-3">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              Sudah terekam di ABT — saksi ke-{lembar.rekamanAbt?.saksiKe}
            </p>
            <p className="text-xs text-muted-foreground">
              Keterangan ini sudah tercatat pada pemeriksaan sebelumnya. Ia TIDAK dituangkan sendiri ke kotak
              jawaban — urutan pertanyaan di ABT belum tentu sama dengan di sini, dan jawaban yang mendarat di bawah
              pertanyaan yang keliru terbaca masuk akal justru saat ia paling salah. Bandingkan, lalu ambil yang
              cocok.
            </p>
            <div className="max-h-72 space-y-2 overflow-auto">
              {(lembar.rekamanAbt?.tanyaJawab ?? []).map((baris) => (
                <div key={baris.urutan} className="space-y-1 border-b border-border/40 pb-2 last:border-0">
                  <p className="text-sm font-medium">{baris.pertanyaan}</p>
                  <p className="text-sm text-muted-foreground">{baris.jawaban}</p>
                  <NativeSelect
                    className="h-8 text-xs"
                    value=""
                    onChange={(event) => {
                      const urutan = Number(event.target.value);
                      if (urutan) ubahJawaban(urutan, baris.jawaban);
                      event.currentTarget.value = "";
                    }}
                    aria-label={`Salin jawaban ini ke pertanyaan`}
                  >
                    <option value="">Salin jawaban ini ke pertanyaan…</option>
                    {lembar.baris.map((tujuan) => (
                      <option key={tujuan.urutan} value={tujuan.urutan}>
                        {tujuan.urutan}. {tujuan.pertanyaan.slice(0, 70)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <ol className="space-y-5">
          {lembar.baris.map((baris) => (
            <li key={baris.urutan} className="space-y-2">
              <p className="text-sm font-medium">
                {baris.urutan}. {baris.pertanyaan}
              </p>
              <Textarea
                className="min-h-[76px]"
                value={jawaban[baris.urutan] ?? ""}
                onChange={(event) => ubahJawaban(baris.urutan, event.target.value)}
                placeholder={baris.jawabanBawaan || "Jawaban saksi"}
                aria-label={`Jawaban pertanyaan ${baris.urutan}`}
              />
              <div className="flex flex-wrap items-center gap-2">
                {baris.jawabanBawaan ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => ubahJawaban(baris.urutan, baris.jawabanBawaan)}
                    disabled={jawaban[baris.urutan] === baris.jawabanBawaan}
                  >
                    <CornerDownLeft className="h-4 w-4" />
                    Pakai contoh
                  </Button>
                ) : null}
                {baris.penandaTersisa.length > 0 ? (
                  <Badge variant="muted">Ada bagian yang harus Anda isi sendiri</Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Catatan panitera</span>
          <Textarea
            className="min-h-[64px]"
            value={catatan}
            onChange={(event) => {
              setCatatan(event.target.value);
              setKotor(true);
            }}
            placeholder="Hal lain yang perlu dicatat pada lembar ini"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void simpan("draf")} disabled={menyimpan || !kotor}>
            {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </Button>
          <Button variant="outline" onClick={() => void simpan("selesai")} disabled={menyimpan}>
            <Check className="h-4 w-4" />
            Tandai selesai
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
