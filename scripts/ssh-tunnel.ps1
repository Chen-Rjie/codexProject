param(
    [Parameter(Mandatory = $true)]
    [string]$SshHost,

    [string]$SshUser = "root",
    [int]$LocalPort = 4000,
    [string]$RemoteHost = "127.0.0.1",
    [int]$RemotePort = 4000
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw "OpenSSH client is required. Install it from Windows Optional Features."
}

Write-Host "Forwarding localhost:$LocalPort to ${RemoteHost}:${RemotePort} through ${SshUser}@${SshHost}"
Write-Host "Keep this window open. Press Ctrl+C to stop the tunnel."

& ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 `
    -L "${LocalPort}:${RemoteHost}:${RemotePort}" "${SshUser}@${SshHost}"

