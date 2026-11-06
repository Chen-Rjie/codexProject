$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Wxcloud = Join-Path $ProjectRoot ".tools\wxcloud\node_modules\.bin\wxcloud.cmd"

if (-not (Test-Path $Wxcloud)) {
    throw "WeChat CloudRun CLI is not installed under .tools/wxcloud."
}

Write-Host "WeChat CloudRun CLI login"
Write-Host "AppID: wx704450feaa66b07e"
Write-Host "Download a CLI private key from:"
Write-Host "https://cloud.weixin.qq.com/cloudrun/settings/other"
Write-Host ""

$PrivateKeyPath = Read-Host "Enter the downloaded CLI private key file path"
$PrivateKeyPath = $PrivateKeyPath.Trim('"', "'", " ")

if (-not (Test-Path -LiteralPath $PrivateKeyPath)) {
    throw "Private key file not found."
}

$PrivateKey = Get-Content -Raw -LiteralPath $PrivateKeyPath
$PrivateKey = $PrivateKey.Trim()
if ($PrivateKey.Length -lt 32) {
    throw "The selected file does not contain a complete CLI private key."
}

& $Wxcloud login --appId "wx704450feaa66b07e" --privateKey $PrivateKey
$PrivateKey = $null

Write-Host ""
Write-Host "Login process finished. You can close this window."
Read-Host "Press Enter to close"
