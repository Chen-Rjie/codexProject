param(
    [string]$EnvId = "flowboard-prod-d4gwhtcgf4f33533c",
    [string]$ServiceName = "flowboard-api",
    [int]$ContainerPort = 4000
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WxcloudEntry = Join-Path $ProjectRoot ".tools\wxcloud\node_modules\@wxcloud\cli\bin\run"
$Backend = Join-Path $ProjectRoot "backend"

if (-not (Test-Path $WxcloudEntry)) {
    throw "WeChat CloudRun CLI is not installed under .tools/wxcloud."
}

$Node = (Get-Command node -ErrorAction Stop).Source

$DbPasswordSecure = Read-Host "Enter the MySQL password for flowboard@%" -AsSecureString
$DbPassword = [System.Net.NetworkCredential]::new("", $DbPasswordSecure).Password

$RedisUrl = Read-Host "Enter the full Upstash rediss:// URL"

$WeChatSecretSecure = Read-Host "Enter the mini program AppSecret" -AsSecureString
$WeChatSecret = [System.Net.NetworkCredential]::new("", $WeChatSecretSecure).Password

$EnvParams = [ordered]@{
    DB_HOST = "10.0.0.14"
    DB_PORT = "3306"
    DB_NAME = "flowboard"
    DB_USERNAME = "flowboard"
    DB_PASSWORD = $DbPassword
    DB_POOL_MAX_SIZE = "5"
    REDIS_URL = $RedisUrl
    WECHAT_APP_ID = "wx704450feaa66b07e"
    WECHAT_APP_SECRET = $WeChatSecret
    CORS_ALLOWED_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173"
    SESSION_COOKIE_SECURE = "true"
    REGISTRATION_ENABLED = "true"
} | ConvertTo-Json -Compress

Push-Location $ProjectRoot
try {
    & $Node $WxcloudEntry run:deploy $Backend `
        "--envId=$EnvId" `
        "--serviceName=$ServiceName" `
        "--containerPort=$ContainerPort" `
        "--dockerfile=Dockerfile" `
        "--envParamsJson=$EnvParams" `
        "--remark=Deploy qingxue study API" `
        --noConfirm
}
finally {
    $DbPassword = $null
    $RedisUrl = $null
    $WeChatSecret = $null
    $EnvParams = $null
    Pop-Location
}
