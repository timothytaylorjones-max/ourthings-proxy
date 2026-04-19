const http = require("http");
const https = require("https");
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const PORT = process.env.PORT || 3000;

http.createServer(function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  var body = "";
  req.on("data", function(chunk) { body += chunk; });
  req.on("end", function() {
    if (!body) { res.writeHead(400); res.end("No body"); return; }
    try { JSON.parse(body); } catch(e) { res.writeHead(400); res.end("Bad JSON"); return; }
    var options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    var apiReq = https.request(options, function(apiRes) {
      var data = "";
      apiRes.on("data", function(chunk) { data += chunk; });
      apiRes.on("end", function() {
        res.writeHead(apiRes.statusCode, {"Content-Type": "application/json"});
        res.end(data);
      });
    });
    apiReq.on("error", function(err) {
      res.writeHead(500);
      res.end(JSON.stringify({error: err.message}));
    });
    apiReq.write(body);
    apiReq.end();
  });
}).listen(PORT, function() {
  console.log("Proxy running on port " + PORT);
});
