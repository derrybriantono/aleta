# RTF -> PDF lewat Word (laptop). pakai: rtf_pdf.ps1 <rtf1> [<rtf2> ...]  -> <rtf>.pdf di samping
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Berkas)
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($b in $Berkas) {
    $p = (Resolve-Path $b).Path
    $d = $w.Documents.Open($p, $false, $true)
    $pdf = [System.IO.Path]::ChangeExtension($p, '.pdf')
    $d.SaveAs2($pdf, 17)
    $d.Close([ref]0)
    Write-Output "PDF $pdf"
  }
} finally {
  $w.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
