import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.VT_API_KEY = 'test-api-key';
process.env.GOOGLE_WEBRISK_API_KEY = 'test-webrisk-key';

let app;
beforeEach(async () => {
  vi.resetModules();
  ({ app } = await import('../server.js'));
});
afterEach(() => vi.unstubAllGlobals());

describe('GET /api/health', () => {
  it('returns a health response without requiring an external provider', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/urls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('proxies a URL submission to VirusTotal', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: { type: 'analysis', id: 'analysis-123' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', upstream);

    const response = await request(app)
      .post('/api/urls')
      .type('form')
      .send({ url: 'https://example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { type: 'analysis', id: 'analysis-123' } });
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0][0]).toBe('https://www.virustotal.com/api/v3/urls');
    expect(upstream.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        'x-apikey': 'test-api-key',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'url=https%3A%2F%2Fexample.com',
    });
  });

  it('returns a client error without calling VirusTotal when url is missing', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await request(app)
      .post('/api/urls')
      .type('form')
      .send({ url: '' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { message: 'Missing url field.' } });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('maps an upstream VirusTotal failure to the documented error response', async () => {
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: { message: 'quota exceeded' } }),
        { status: 429, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({}),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ));
    vi.stubGlobal('fetch', upstream);

    const response = await request(app)
      .post('/api/urls')
      .type('form')
      .send({ url: 'https://example.com' });

    expect(response.status).toBe(202);
    expect(response.body.data.id).toMatch(/^webrisk_[A-Za-z0-9]+$/);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls[1][0].toString()).toContain('webrisk.googleapis.com');
  });
});

describe('GET /api/expand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the followed public URL', async () => {
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/final' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', upstream);

    const response = await request(app)
      .get('/api/expand')
      .query({ url: 'https://example.com/short' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ resolved: 'https://example.com/final' });
    expect(upstream).toHaveBeenCalledWith(
      'https://example.com/short',
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' }),
    );
  });

  it.each([
    'http://127.0.0.1',
    'http://10.0.0.1',
    'http://192.168.1.1',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'http://100.64.0.1',
    'http://169.254.169.254',
    'http://192.0.2.1',
    'http://localhost.',
  ])('rejects private or loopback target %s before fetching', async (url) => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await request(app).get('/api/expand').query({ url });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Private/internal addresses are not allowed.' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rejects non-HTTP schemes before fetching', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await request(app)
      .get('/api/expand')
      .query({ url: 'file:///etc/passwd' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Only http/https URLs are supported.' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each([
    'http://127.0.0.1:3001/internal',
    'http://[::ffff:10.0.0.1]',
    'http://169.254.169.254/latest/meta-data',
    '//192.168.1.1/admin',
    'http://[fc00::1]',
    'http://100.64.0.1',
    'http://localhost.',
    'file:///etc/passwd',
    'http://[invalid',
  ])('blocks redirect %s before requesting it', async (location) => {
    const upstream = vi.fn().mockResolvedValue(new Response(null, {
      status: 302, headers: { location },
    }));
    vi.stubGlobal('fetch', upstream);
    const response = await request(app).get('/api/expand')
      .query({ url: 'https://example.com/redirect' });
    expect(response.body).toEqual({ resolved: 'https://example.com/redirect' });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it.each([301, 302, 303, 307, 308])('follows HTTP %s redirects', async (status) => {
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status, headers: { location: 'https://example.org/end' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const response = await request(app).get('/api/expand').query({ url: 'https://example.com/start' });
    expect(response.body).toEqual({ resolved: 'https://example.org/end' });
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls.every(([, options]) => options.redirect === 'manual')).toBe(true);
  });

  it.each([false, true])('bounds redirect chains (excess=%s)', async (excess) => {
    let calls = 0;
    const upstream = vi.fn().mockImplementation(async () => {
      calls++;
      return calls <= 5 || excess
        ? new Response(null, { status: 302, headers: { location: `/hop-${calls}` } })
        : new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', upstream);
    const response = await request(app).get('/api/expand').query({ url: 'https://example.com/start' });
    expect(upstream).toHaveBeenCalledTimes(6);
    expect(response.body).toEqual({ resolved: excess ? 'https://example.com/start' : 'https://example.com/hop-5' });
  });

  it('checks later hops before making an internal request', async () => {
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/next' } }))
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: 'http://10.0.0.1' } }));
    vi.stubGlobal('fetch', upstream);
    const response = await request(app).get('/api/expand').query({ url: 'https://example.com/start' });
    expect(response.body).toEqual({ resolved: 'https://example.com/start' });
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls[1][0]).toBe('https://example.com/next');
  });

  it('bounds redirect loops', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(null, {
      status: 302, headers: { location: '/start' },
    }));
    vi.stubGlobal('fetch', upstream);
    const response = await request(app).get('/api/expand').query({ url: 'https://example.com/start' });
    expect(response.body).toEqual({ resolved: 'https://example.com/start' });
    expect(upstream).toHaveBeenCalledTimes(6);
  });

  it('stops at a redirect without a Location header', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
    vi.stubGlobal('fetch', upstream);
    const response = await request(app).get('/api/expand').query({ url: 'https://example.com/start' });
    expect(response.body).toEqual({ resolved: 'https://example.com/start' });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it('falls back to the input URL on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')));
    const response = await request(app).get('/api/expand').query({ url: 'https://example.com/start' });
    expect(response.body).toEqual({ resolved: 'https://example.com/start' });
  });
});
