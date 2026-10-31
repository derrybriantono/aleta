# RTF hasil render -> PDF lewat Microsoft Word, dan nomor halaman tempat teks tertentu (mis. "Bukti-bukti tersebut") berada.
# pakai: powershell -File rtf_ke_pdf_hal.ps1 <teks dicari> <rtf1> [<rtf2> ...]  -> "<rtf>.pdf" + baris "HAL <n> <rtf>"
param([string]$Cari, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Berkas)
foreach ($b in $Berkas) {
  for ($coba = 0; $coba -lt 3; $coba++) {
    $w = $null
    try {
      $w = New-Object -ComObject Word.Application
      $w.Visible = $false
      $w.DisplayAlerts = 0
      $p = (Resolve-Path $b).Path
      $d = $w.Documents.Open($p, $false, $true)
      $r = $d.Content
      $f = $r.Find
      $hal = 0
      if ($f.Execute($Cari)) { $hal = $r.Information(3) }
      $d.SaveAs([ref]($p + '.pdf'), [ref]17)
      $d.Close([ref]0)
      Write-Output "HAL $hal $p"
      $coba = 9
    } catch {
      Start-Sleep -Seconds 2
    } finally {
      if ($w) { $w.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null }
    }
  }
}
