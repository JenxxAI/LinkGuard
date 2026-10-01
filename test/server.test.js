import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.VT_API_KEY = 'test-api-key';

const { app } = await import('../server.js');

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'quota exceeded' } }),
      { status: 429, headers: { 'content-type': 'application/json' } },
    )));

    const response = await request(app)
      .post('/api/urls')
      .type('form')
      .send({ url: 'https://example.com' });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: { message: expect.stringContaining('Scan limit reached') },
    });
  });
});

describe('GET /api/expand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the followed public URL', async () => {
    const upstream = vi.fn()
      .mockResolvedValueOnce({
        status: 302,
        headers: new Headers({ location: '/final' }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
      });
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
    expect(upstream).toHaveBeenLastCalledWith(
      'https://example.com/final',
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' }),
    );
  });

  it.each([
    'http://127.0.0.1',
    'http://10.0.0.1',
    'http://[::1]',
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

  it('does not return a private final redirect target', async () => {
    const upstream = vi.fn().mockResolvedValue({
      status: 302,
      headers: new Headers({ location: 'http://127.0.0.1:3001/internal' }),
    });
    vi.stubGlobal('fetch', upstream);

    const response = await request(app)
      .get('/api/expand')
      .query({ url: 'https://example.com/redirect' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ resolved: 'https://example.com/redirect' });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it('stops after five redirects', async () => {
    const upstream = vi.fn((currentUrl) => {
      const match = currentUrl.match(/\/hop(\d+)$/);
      const nextHop = match ? Number(match[1]) + 1 : 1;
      return {
        status: 302,
        headers: new Headers({ location: `/hop${nextHop}` }),
      };
    });
    vi.stubGlobal('fetch', upstream);

    const response = await request(app)
      .get('/api/expand')
      .query({ url: 'https://example.com/start' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ resolved: 'https://example.com/hop5' });
    expect(upstream).toHaveBeenCalledTimes(6);
  });
});
