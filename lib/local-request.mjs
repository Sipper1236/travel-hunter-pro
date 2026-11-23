export function localRequest(request) {
  const host = request.headers.get('host') || '';
  const origin = request.headers.get('origin');
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || !origin) return false;
  try { return new URL(origin).origin === `http://${host}` || new URL(origin).origin === `https://${host}`; }
  catch { return false; }
}
