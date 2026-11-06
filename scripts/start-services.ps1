$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ToolsRoot = Join-Path $ProjectRoot '.tools'
$RuntimeRoot = Join-Path $ToolsRoot 'runtime'
$MysqlData = Join-Path $RuntimeRoot 'mysql-data'
$RedisData = Join-Path $RuntimeRoot 'redis-data'
$MysqlPort = 3306
$RedisPort = 6379

function Test-Port([int]$Port) {
    $Client = [System.Net.Sockets.TcpClient]::new()
    try {
        $Task = $Client.ConnectAsync('127.0.0.1', $Port)
        return $Task.Wait(600) -and $Client.Connected
    }
    catch {
        return $false
    }
    finally {
        $Client.Dispose()
    }
}

function Wait-Port([int]$Port, [string]$Name) {
    for ($Attempt = 0; $Attempt -lt 40; $Attempt++) {
        if (Test-Port $Port) {
            return
        }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not start within 20 seconds on port $Port."
}

function Find-MysqlHome {
    $MysqlRoot = Join-Path $ToolsRoot 'mysql'
    if (-not (Test-Path $MysqlRoot)) {
        return $null
    }

    return Get-ChildItem -LiteralPath $MysqlRoot -Directory |
        Where-Object { Test-Path (Join-Path $_.FullName 'bin\mysqld.exe') } |
        Select-Object -First 1 -ExpandProperty FullName
}

New-Item -ItemType Directory -Force -Path $RuntimeRoot, $MysqlData, $RedisData | Out-Null

if (-not (Test-Port $MysqlPort)) {
    $MysqlHome = Find-MysqlHome
    if (-not $MysqlHome) {
        throw "MySQL is not running and no portable MySQL was found under .tools/mysql."
    }

    $Mysqld = Join-Path $MysqlHome 'bin\mysqld.exe'
    $MysqlClient = Join-Path $MysqlHome 'bin\mysql.exe'
    $Initialized = @(Get-ChildItem -LiteralPath $MysqlData -Force -ErrorAction SilentlyContinue).Count

    if ($Initialized -eq 0) {
        Write-Host 'Initializing the project-local MySQL data directory...'
        & $Mysqld --initialize-insecure "--basedir=$MysqlHome" "--datadir=$MysqlData"
        if ($LASTEXITCODE -ne 0) {
            throw 'MySQL initialization failed.'
        }
    }

    Start-Process -FilePath $Mysqld -WindowStyle Hidden -ArgumentList @(
        "--basedir=$MysqlHome",
        "--datadir=$MysqlData",
        "--port=$MysqlPort",
        '--bind-address=127.0.0.1',
        '--mysqlx=0',
        '--console'
    ) | Out-Null

    Wait-Port $MysqlPort 'MySQL'
}

$MysqlHome = Find-MysqlHome
if ($MysqlHome) {
    $MysqlClient = Join-Path $MysqlHome 'bin\mysql.exe'
    $SetupSql = @'
CREATE DATABASE IF NOT EXISTS flowboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'flowboard'@'127.0.0.1' IDENTIFIED BY 'flowboard_dev';
GRANT ALL PRIVILEGES ON flowboard.* TO 'flowboard'@'127.0.0.1';
FLUSH PRIVILEGES;
'@
    & $MysqlClient --protocol=tcp --host=127.0.0.1 "--port=$MysqlPort" --user=root --skip-password --connect-timeout=5 -e $SetupSql
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'MySQL is running, but local database setup failed. Check the root credentials or DB_* variables.'
    }
}

if (-not (Test-Port $RedisPort)) {
    $RedisServer = Join-Path $ToolsRoot 'redis\redis-server.exe'
    if (-not (Test-Path $RedisServer)) {
        throw "Redis is not running and .tools/redis/redis-server.exe was not found."
    }

    Start-Process -FilePath $RedisServer -WindowStyle Hidden -WorkingDirectory $RedisData -ArgumentList @(
        '--bind',
        '127.0.0.1',
        '--port',
        "$RedisPort",
        '--appendonly',
        'no'
    ) | Out-Null

    Wait-Port $RedisPort 'Redis'
}

Write-Host 'MySQL: 127.0.0.1:3306 (database=flowboard)'
Write-Host 'Redis: 127.0.0.1:6379'

