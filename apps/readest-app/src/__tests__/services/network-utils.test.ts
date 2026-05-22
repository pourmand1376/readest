import { describe, it, expect } from 'vitest';
import { isLocalAddress, isInsecureUrl } from '@/services/networkUtils';

describe('isLocalAddress', () => {
  const local = (host: string) => isLocalAddress(new URL(`http://${host}`));

  it.each([
    ['localhost'],
    ['127.0.0.1'],
    ['127.0.0.99'],
    ['[::1]'],
    ['10.0.0.1'],
    ['10.255.255.255'],
    ['172.16.0.1'],
    ['172.31.255.255'],
    ['192.168.0.1'],
    ['192.168.100.200'],
    ['169.254.1.1'],
    ['mynas.local'],
    ['server.lan'],
    ['host.internal'],
  ])('returns true for %s', (host) => {
    expect(local(host)).toBe(true);
  });

  it.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['172.15.0.1'], // just below class B range
    ['172.32.0.1'], // just above class B range
    ['192.169.0.1'], // not 192.168
    ['example.com'],
    ['readest.io'],
  ])('returns false for %s', (host) => {
    expect(local(host)).toBe(false);
  });
});

describe('isInsecureUrl', () => {
  it('returns false for HTTPS URLs', () => {
    expect(isInsecureUrl('https://example.com')).toBe(false);
  });

  it('returns false for HTTP on private networks', () => {
    expect(isInsecureUrl('http://192.168.1.100:8080')).toBe(false);
    expect(isInsecureUrl('http://10.0.0.5')).toBe(false);
    expect(isInsecureUrl('http://localhost:3000')).toBe(false);
  });

  it('returns true for HTTP on public addresses', () => {
    expect(isInsecureUrl('http://example.com')).toBe(true);
    expect(isInsecureUrl('http://8.8.8.8')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isInsecureUrl('not-a-url')).toBe(false);
    expect(isInsecureUrl('')).toBe(false);
  });
});
