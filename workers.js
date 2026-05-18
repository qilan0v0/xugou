export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetHost = 'qilan3.serv00.net';
    const targetBase = 'https://' + targetHost;

    // ---------- WebSocket proxy /ws ----------
    if (
      url.pathname === '/ws' &&
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
    ) {
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();

      const targetHeaders = new Headers();
      targetHeaders.set('Upgrade', 'websocket');

      const cookie = request.headers.get('Cookie');
      if (cookie) targetHeaders.set('Cookie', cookie);

      const clientOrigin = request.headers.get('Origin');
      if (clientOrigin) targetHeaders.set('Origin', clientOrigin);

      let targetResponse;
      try {
        targetResponse = await fetch(targetBase + '/ws', { headers: targetHeaders });
      } catch (err) {
        return new Response('Target connection failed: ' + err.message, { status: 502 });
      }

      const targetSocket = targetResponse.webSocket;
      if (!targetSocket) {
        return new Response('Target did not upgrade to WebSocket', { status: 502 });
      }
      targetSocket.accept();

      let closed = false;
      const closeBoth = (code = 1000, reason = '') => {
        if (closed) return;
        closed = true;
        try { server.close(code, reason); } catch (_) {}
        try { targetSocket.close(code, reason); } catch (_) {}
      };

      server.addEventListener('message', event => {
        try { targetSocket.send(event.data); } catch (_) { closeBoth(1011, 'Send error'); }
      });
      targetSocket.addEventListener('message', event => {
        try { server.send(event.data); } catch (_) { closeBoth(1011, 'Send error'); }
      });

      server.addEventListener('close', () => closeBoth(1000, 'Client closed'));
      targetSocket.addEventListener('close', () => closeBoth(1000, 'Server closed'));
      server.addEventListener('error', () => closeBoth(1011, 'Client error'));
      targetSocket.addEventListener('error', () => closeBoth(1011, 'Server error'));

      return new Response(null, { status: 101, webSocket: client });
    }

    // ---------- HTTP proxy ----------
    const newUrl = new URL(request.url);
    newUrl.hostname = targetHost;
    newUrl.protocol = 'https:';

    const modifiedRequest = new Request(newUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });
    modifiedRequest.headers.set('Host', targetHost);

    let response = await fetch(modifiedRequest);

    // Passthrough response body (SSE streaming works without buffering)
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
    newHeaders.set('Access-Control-Allow-Credentials', 'true');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: newHeaders, status: 204 });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
