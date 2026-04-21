export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;

    // Debug endpoint — returns all received headers
    if (pathname === "/debug-headers") {
      const headers = {};
      for (const [k, v] of request.headers.entries()) {
        headers[k] = k.toLowerCase() === "x-proxy-secret" ? "[redacted]" : v;
      }
      return new Response(JSON.stringify(headers), {
        headers: {"Content-Type": "application/json"},
      });
    }

    // Debug endpoint — tests a real render POST from within Cloudflare
    if (pathname === "/debug-render") {
      const renderRes = await fetch("https://api.creatomate.com/v1/renders", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CREATOMATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_id: "568f5388-1252-4a99-9ea5-f369b4a32f9f",
          modifications: {plate_text: "DEBUG"},
        }),
      });
      const renderBody = await renderRes.text();
      return new Response(JSON.stringify({
        status: renderRes.status,
        body: renderBody.substring(0, 300),
      }), {headers: {"Content-Type": "application/json"}});
    }

    // Debug endpoint — tests Creatomate key stored in this worker
    if (pathname === "/debug-key") {
      const testRes = await fetch("https://api.creatomate.com/v1/templates", {
        headers: {"Authorization": `Bearer ${env.CREATOMATE_API_KEY}`},
      });
      const testBody = await testRes.text();
      return new Response(JSON.stringify({
        status: testRes.status,
        keyPrefix: env.CREATOMATE_API_KEY.substring(0, 8),
        creatomateResponse: testBody.substring(0, 200),
      }), {headers: {"Content-Type": "application/json"}});
    }

    // Validate proxy secret
    const proxySecret = request.headers.get("X-Proxy-Secret");
    if (!proxySecret || proxySecret !== env.PROXY_SECRET) {
      return new Response("Unauthorized", {status: 401});
    }

    // Map incoming path to Creatomate URL
    const url = new URL(request.url);
    const creatomateUrl = `https://api.creatomate.com/v1${url.pathname}`;

    const init = {
      method: request.method,
      headers: {
        "Authorization": `Bearer ${env.CREATOMATE_API_KEY}`,
        "Content-Type": "application/json",
      },
    };

    if (request.method !== "GET") {
      init.body = await request.text();
    }

    const response = await fetch(creatomateUrl, init);
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {"Content-Type": "application/json"},
    });
  },
};
