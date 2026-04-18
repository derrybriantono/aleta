import { redirect } from "next/navigation";

export default function SuratKeluarAliasPage() {
  redirect("/surat?type=keluar");
}
