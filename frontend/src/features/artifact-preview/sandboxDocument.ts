export function sandboxDocument(source: string, theme: 'light' | 'dark' = 'light') {
  const colors = theme === 'dark'
    ? 'background:#0d0d11;color:#f7f0f4'
    : 'background:#fff;color:#17171b'
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'; navigate-to 'none'">
  <meta name="referrer" content="no-referrer">
  <base target="_blank">
  <style>html,body{min-height:100%;margin:0;${colors};font-family:system-ui,sans-serif}body{box-sizing:border-box;padding:18px}*,*::before,*::after{box-sizing:border-box}svg{max-width:100%;height:auto}</style>
</head>
<body>${source}</body>
</html>`
}
