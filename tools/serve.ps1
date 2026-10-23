<#
.SYNOPSIS
  Tiny static web server for the site (no Node or Python needed).
      pwsh tools/serve.ps1            # http://localhost:8080
      pwsh tools/serve.ps1 -Port 3000

  The site also works by double-clicking index.html; the server is only
  needed for tools that expect an http:// URL (like the VS Code launch config).
#>
param([int]$Port = 8080)

$root = Split-Path -Parent $PSScriptRoot
$types = @{
    ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
    ".css" = "text/css; charset=utf-8"; ".json" = "application/json"; ".svg" = "image/svg+xml"
    ".png" = "image/png"; ".jpg" = "image/jpeg"; ".ico" = "image/x-icon"
    ".cpp" = "text/plain; charset=utf-8"; ".h" = "text/plain; charset=utf-8"; ".md" = "text/plain; charset=utf-8"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $response = $context.Response
        try {
            $path = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
            if ($path -eq "") { $path = "index.html" }
            $file = [System.IO.Path]::GetFullPath((Join-Path $root $path))
            if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
                $bytes = [System.IO.File]::ReadAllBytes($file)
                $ext = [System.IO.Path]::GetExtension($file).ToLower()
                $response.ContentType = $types[$ext] ?? "application/octet-stream"
                $response.Headers.Add("Cache-Control", "no-store")
                $response.ContentLength64 = $bytes.Length
                if ($context.Request.HttpMethod -ne "HEAD") { $response.OutputStream.Write($bytes, 0, $bytes.Length) }
            } else {
                $response.StatusCode = 404
            }
        } catch {
            Write-Host "Error serving $($context.Request.Url): $_"
        } finally {
            $response.Close()
        }
    }
} finally {
    $listener.Stop()
}
