/**
 * Returns true when a URL hostname refers to a loopback or private-network
 * address that is acceptable for plain HTTP (e.g. local development or a
 * self-hosted server on a home/office LAN).
 *
 * This mirrors the approach used by apps like Immich: HTTP is permitted for
 * private/local addresses while remote/public addresses must use HTTPS.
 *
 * Allowed ranges:
 *  - loopback:          127.x.x.x, ::1, localhost
 *  - link-local:        169.254.x.x, fe80::/10
 *  - private class A:   10.x.x.x
 *  - private class B:   172.16.x.x – 172.31.x.x
 *  - private class C:   192.168.x.x
 *  - mDNS / local DNS:  *.local, *.lan, *.internal
 */
export const isLocalAddress = (url: URL): boolean => {
  const h = url.hostname;

  // Named loopback / mDNS suffixes
  if (h === 'localhost') return true;
  if (h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.internal')) return true;

  // IPv6 loopback / link-local
  if (h === '::1' || h === '[::1]') return true;
  if (/^(\[)?fe[89ab][0-9a-f]:/i.test(h)) return true; // fe80::/10

  // IPv4 – parse octets once
  const parts = h.split('.');
  if (parts.length === 4) {
    const [o1, o2] = parts.map(Number);
    if (o1 === 127) return true; // 127.0.0.0/8 loopback
    if (o1 === 10) return true; // 10.0.0.0/8
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12
    if (o1 === 192 && o2 === 168) return true; // 192.168.0.0/16
    if (o1 === 169 && o2 === 254) return true; // 169.254.0.0/16 link-local
  }

  return false;
};

/**
 * Returns true when a URL string uses plain HTTP pointed at a public
 * (non-private) address — i.e. the connection is insecure and should
 * trigger a warning or be rejected.
 */
export const isInsecureUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' && !isLocalAddress(u);
  } catch {
    return false;
  }
};
