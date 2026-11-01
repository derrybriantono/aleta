# Render SEMUA halaman PDF ke PNG lewat Windows.Data.Pdf. pakai: pdf_semua_png.ps1 <pdf> <awalan png> [lebar]  -> <awalan>-h1.png, -h2.png, ...
param([string]$Pdf, [string]$Awalan, [int]$Lebar = 900)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asAct = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
function Tunggu($op, $t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }
$f = Tunggu ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Pdf).Path)) ([Windows.Storage.StorageFile])
$doc = Tunggu ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($f)) ([Windows.Data.Pdf.PdfDocument])
for ($i = 0; $i -lt $doc.PageCount; $i++) {
  $page = $doc.GetPage($i)
  $mem = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  $opt = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $opt.DestinationWidth = $Lebar
  $asAct.Invoke($null, @($page.RenderToStreamAsync($mem, $opt))).Wait()
  $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($mem.GetInputStreamAt(0))
  $png = "$Awalan-h$($i + 1).png"
  $out = [System.IO.File]::Create($png)
  $net.CopyTo($out)
  $out.Close()
}
Write-Output "$($doc.PageCount) halaman -> $Awalan"
