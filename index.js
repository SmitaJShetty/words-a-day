import wordsHandler from "./functions/api/words.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route traffic from either the root '/' or '/api/words' directly to your logic
    if (
      url.pathname === "/" ||
      url.pathname === "/api/words" ||
      url.pathname === "/functions/api/words"
    ) {
      // Mirror the Cloudflare Pages context structure your words.js expects
      const context = {
        request: request,
        env: env,
        ctx: ctx,
        next: () => new Response("Not found", { status: 404 }),
        params: {},
      };

      // Execute your POST logic
      if (request.method === "POST") {
        return wordsHandler.onRequestPost(context);
      }

      return new Response("Method Not Allowed. Send a POST request.", {
        status: 405,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
