// Wraps model-generated HTML/SVG (untrusted) into a full document for the sandboxed
// iframe's srcDoc in ArtifactPreview.tsx, which also sets sandbox="" — that empty
// sandbox attribute is what actually blocks scripts, forms, top navigation, and
// treats the frame as opaque-origin; this document's CSP and meta tags are a second
// layer on top of that, not the primary boundary. `source` is interpolated into the
// body as-is (no HTML escaping) because the sandboxed iframe is the trust boundary,
// not string escaping.
//
// CSP here blocks everything by default and only allows: inline data: images, inline
// <style>, and data: fonts — enough to render typical HTML/SVG artifacts without
// letting them fetch anything over the network. form-action/base-uri/navigate-to
// 'none' block form submission and any navigation attempt even though sandbox="" is
// already meant to prevent it.
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
