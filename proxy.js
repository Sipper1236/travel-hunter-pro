import {NextResponse} from 'next/server.js';

/** Per-response CSP nonce for rendered pages; API JSON responses are excluded. */
export function proxy(request) {
  const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
  const development=process.env.NODE_ENV==='development';
  const policy=[
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  const requestHeaders=new Headers(request.headers);
  requestHeaders.set('x-nonce',nonce);
  requestHeaders.set('Content-Security-Policy',policy);
  const response=NextResponse.next({request:{headers:requestHeaders}});
  response.headers.set('Content-Security-Policy',policy);
  return response;
}

export const config={matcher:['/((?!api|_next/static|_next/image|favicon.ico).*)']};
