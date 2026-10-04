$projectPath = Split-Path -Parent $PSCommandPath
$vitePath = Join-Path $projectPath 'node_modules\vite\bin\vite.js'
$processes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($vitePath) -and $_.CommandLine.Contains('--host 127.0.0.1')
}
foreach ($serverProcess in $processes) {
    Stop-Process -Id $serverProcess.ProcessId
}
Write-Host 'Локальный сервер проекта остановлен.'
