param(
    [string]$EnvId = "flowboard-prod-d4gwhtcgf4f33533c",
    [string]$ServiceName = "flowboard-api",
    [int]$ContainerPort = 4000
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WxcloudEntry = Join-Path $ProjectRoot ".tools\wxcloud\node_modules\@wxcloud\cli\bin\run"

if (-not (Test-Path $WxcloudEntry)) {
    throw "WeChat CloudRun CLI is not installed under .tools/wxcloud."
}

$Node = (Get-Command node -ErrorAction Stop).Source

$DbPasswordSecure = Read-Host "Enter the MySQL password for flowboard@%" -AsSecureString
$DbPassword = [System.Net.NetworkCredential]::new("", $DbPasswordSecure).Password

$RedisUrl = Read-Host "Enter the full Upstash rediss:// URL"

$WeChatSecretSecure = Read-Host "Enter the mini program AppSecret" -AsSecureString
$WeChatSecret = [System.Net.NetworkCredential]::new("", $WeChatSecretSecure).Password

$CorsOrigins = if ($env:CORS_ALLOWED_ORIGINS) {
    $env:CORS_ALLOWED_ORIGINS
} else {
    "http://127.0.0.1:5173,http://localhost:5173"
}

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
    CORS_ALLOWED_ORIGINS = $CorsOrigins
    SESSION_COOKIE_SECURE = "true"
    REGISTRATION_ENABLED = "true"
} | ConvertTo-Json -Compress

Push-Location $ProjectRoot
try {
    & $Node $WxcloudEntry run:deploy $ProjectRoot `
        "--envId=$EnvId" `
        "--serviceName=$ServiceName" `
        "--containerPort=$ContainerPort" `
        "--targetDir=." `
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
