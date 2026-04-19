const http = require("http");
const https = require("https");
const API_KEY = process.env.ANTHROPIC_API_KEY || "YOUR_API_KEY_HERE";
const PORT = process.env.PORT || 3000;

http.createServer(function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/identify") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  var body = "";
  req.on("data", function(chunk) { body += chunk; });
  req.on("end", function() {
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
  console.log("OurThings proxy running on port " + PORT);
});
