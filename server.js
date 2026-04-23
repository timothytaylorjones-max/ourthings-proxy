const http = require("http");
const https = require("https");

const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const PORT = process.env.PORT || 3000;
const MAX_BODY = 12 * 1024 * 1024; // 12 MB — large enough for base64 images
const UPSTREAM_TIMEOUT = 30000;    // 30 s

http.createServer(function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Railway health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url !== "/identify" || req.method !== "POST") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  var body = "";
  var size = 0;
  var tooLarge = false;

  req.on("data", function(chunk) {
    size += chunk.length;
    if (size > MAX_BODY) {
      tooLarge = true;
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Request too large" }));
      req.destroy();
      return;
    }
    body += chunk;
  });

  req.on("end", function() {
    if (tooLarge) return;

    if (!body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Empty body" }));
      return;
    }

    var parsed;
    try { parsed = JSON.parse(body); } catch(e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    if (!parsed.messages || !parsed.max_tokens) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing required fields: messages, max_tokens" }));
      return;
    }

    // Always use the latest model regardless of what the client sends
    parsed.model = "claude-sonnet-4-6";

    var outBody = JSON.stringify(parsed);
    var options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(outBody)
      }
    };

    var timedOut = false;
    var timer;

    var apiReq = https.request(options, function(apiRes) {
      clearTimeout(timer);
      var data = "";
      apiRes.on("data", function(chunk) { data += chunk; });
      apiRes.on("end", function() {
        res.writeHead(apiRes.statusCode, { "Content-Type": "application/json" });
        res.end(data);
      });
    });

    timer = setTimeout(function() {
      timedOut = true;
      apiReq.destroy();
      res.writeHead(504, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Upstream timeout" }));
    }, UPSTREAM_TIMEOUT);

    apiReq.on("error", function(err) {
      clearTimeout(timer);
      if (timedOut) return;
      console.error("[error]", new Date().toISOString(), err.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    });

    apiReq.write(outBody);
    apiReq.end();
  });
}).listen(PORT, function() {
  console.log("Proxy running on port " + PORT);
});
