"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { ringkasSebelumnya, sidangKe, susunRangkaian, tanggalIndonesia } from "@/lib/rangkaian-sidang";

/**
 * Sidang hari ini - siapa hadir, apa agendanya, apa hasilnya.
 *
 * ============================================================================
 * SATU-SATUNYA YANG TIDAK DAPAT DIBACA DARI MANA PUN
 * ============================================================================
 *
 * Agenda, tanggal, ruangan, dan penundaan sudah tercatat SIPP dan ditampilkan
 * apa adanya di sini - tidak ditanyakan lagi.
 *
 * Yang ditanyakan hanya KEHADIRAN, karena SIPP mencatatnya sebagai angka
 * ("dihadiri oleh 2") tanpa menyebut siapa: Penggugat sendiri, kuasanya, atau
 * keduanya. Blangko BAS menanyakannya dengan kalimat, dan kalimat itu tidak
 * dapat disimpulkan dari angka.
 */

type Kehadiran = {
  kehadiranPenggugat: string;
  kehadiranTergugat: string;
  agenda: string;
  hasil: string;
  catatan: string;
  diubahAt: string;
};

const KOSONG: Kehadiran = {
  kehadiranPenggugat: "",
  kehadiranTergugat: "",
  agenda: "",
  hasil: "",
  catatan: "",
  diubahAt: "",
};

export function KehadiranSidang({
  perkaraId,
  nomorPerkara,
  riwayatSidang,
}: {
  perkaraId: string;
  nomorPerkara: string;
  riwayatSidang: unknown;
}) {
  const rangkaian = susunRangkaian(riwayatSidang);
  const [nomorSidang, setNomorSidang] = useState(rangkaian[rangkaian.length - 1]?.sidangKe ?? 1);
  const [isi, setIsi] = useState<Kehadiran>(KOSONG);
  const [bunyi, setBunyi] = useState<string[]>([]);
  const [kotor, setKotor] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState("");

  const sidang = sidangKe(rangkaian, nomorSidang);

  const kunci = `${perkaraId}|${nomorSidang}`;
  const [dimuat, setDimuat] = useState("");

  useEffect(() => {
    if (!perkaraId || !nomorSidang) return;
    let batal = false;
    const kendali = new AbortController();

    fetch(apiPath(`/api/aleta-ecourt/bas/kehadiran?perkaraId=${encodeURIComponent(perkaraId)}&sidangKe=${nomorSidang}`), {
      cache: "no-store",
      signal: kendali.signal,
    })
      .then((jawaban) => jawaban.json())
      .then((hasil) => {
        if (batal) return;
        const data = hasil?.data ?? {};
        setIsi({ ...KOSONG, ...(data.kehadiran ?? {}) });
        setBunyi(Array.isArray(data.bunyi) ? data.bunyi : []);
        setKotor(false);
        setPesan("");
        setDimuat(kunci);
      })
      .catch(() => {
        if (batal) return;
        setPesan("Catatan kehadiran tidak dapat dimuat.");
        setDimuat(kunci);
      });

    return () => {
      batal = true;
      kendali.abort();
    };
  }, [kunci, perkaraId, nomorSidang]);

  const simpan = useCallback(async () => {
    setMenyimpan(true);
    setPesan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/bas/kehadiran"), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ perkaraId, nomorPerkara, sidangKe: nomorSidang, ...isi }),
      });
      const hasil = (await jawaban.json())?.data;
      if (!hasil?.ok) {
        setPesan("Belum tersimpan. Coba lagi.");
        return;
      }
      setIsi({ ...KOSONG, ...(hasil.kehadiran ?? {}) });
      setKotor(false);
    } catch {
      setPesan("Tidak dapat menghubungi ALETA. Catatan Anda masih ada di layar — coba simpan lagi.");
    } finally {
      setMenyimpan(false);
    }
  }, [perkaraId, nomorPerkara, nomorSidang, isi]);

  const ubah = (kunciMedan: keyof Kehadiran, nilai: string) => {
    setIsi((lama) => ({ ...lama, [kunciMedan]: nilai }));
    setKotor(true);
  };

  const memuat = dimuat !== kunci;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Sidang hari ini</CardTitle>
            <CardDescription>
              Agenda dan tanggalnya dari SIPP. Yang ditanyakan hanya kehadiran — SIPP mencatat jumlahnya, bukan
              siapanya.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <NativeSelect
              className="h-9 w-auto"
              value={String(nomorSidang)}
              onChange={(event) => setNomorSidang(Number(event.target.value) || 1)}
              aria-label="Sidang ke berapa"
            >
              {(rangkaian.length > 0 ? rangkaian.map((item) => item.sidangKe) : [1]).map((n) => (
                <option key={n} value={n}>
                  Sidang ke-{n}
                </option>
              ))}
            </NativeSelect>
            <Button size="sm" onClick={() => void simpan()} disabled={menyimpan || !kotor}>
              {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </Button>
          </div>
        </div>

        {kotor ? <p className="text-xs text-amber-600 dark:text-amber-400">Ada perubahan yang belum disimpan.</p> : null}
        {pesan ? <p className="text-xs text-amber-600 dark:text-amber-400">{pesan}</p> : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {sidang ? (
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <p>
              {sidang.hari}, {tanggalIndonesia(sidang.tanggal)}
              {sidang.jam ? ` pukul ${sidang.jam}` : ""}
              {sidang.ruangan ? ` di ${sidang.ruangan}` : ""}
            </p>
            {sidang.agenda ? <p className="text-muted-foreground">Agenda: {sidang.agenda}</p> : null}
            {sidang.ditunda ? (
              <p className="text-muted-foreground">
                Ditunda untuk {sidang.alasanDitunda || "—"}
                {sidang.tanggalDitunda ? `, sampai ${tanggalIndonesia(sidang.tanggalDitunda)}` : ""}.
              </p>
            ) : null}
            {ringkasSebelumnya(sidang) ? <p className="text-muted-foreground">{ringkasSebelumnya(sidang)}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Sidang ke-{nomorSidang} belum tercatat di SIPP. Hari dan tanggalnya akan tetap bertanda pada naskah.
          </p>
        )}

        {memuat ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat catatan…
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Kehadiran Penggugat/Pemohon</span>
                <Input
                  value={isi.kehadiranPenggugat}
                  onChange={(event) => ubah("kehadiranPenggugat", event.target.value)}
                  list="bunyi-kehadiran"
                  placeholder="misalnya hadir secara pribadi"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Kehadiran Tergugat/Termohon</span>
                <Input
                  value={isi.kehadiranTergugat}
                  onChange={(event) => ubah("kehadiranTergugat", event.target.value)}
                  list="bunyi-kehadiran"
                  placeholder="misalnya tidak hadir tanpa alasan yang sah"
                />
              </label>
            </div>

            {/* Daftar bunyi yang lazim - dapat dipilih, tetapi kotaknya tetap
                bebas diketik. Daftar tertutup memaksa panitera memilih yang
                paling mendekati lalu menuliskan yang tidak terjadi. */}
            <datalist id="bunyi-kehadiran">
              {bunyi.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">
                Hasil sidang {sidang?.agenda ? "(bila berbeda dari catatan SIPP)" : ""}
              </span>
              <Textarea
                className="min-h-[64px]"
                value={isi.hasil}
                onChange={(event) => ubah("hasil", event.target.value)}
                placeholder="Apa yang diputuskan atau disepakati pada sidang ini"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Catatan panitera</span>
              <Textarea
                className="min-h-[56px]"
                value={isi.catatan}
                onChange={(event) => ubah("catatan", event.target.value)}
                placeholder="Hal lain yang perlu dicatat pada sidang ini"
              />
            </label>

            {isi.diubahAt ? (
              <p className="text-xs text-muted-foreground">
                Tersimpan {new Date(isi.diubahAt).toLocaleString("id-ID")}.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
