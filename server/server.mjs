import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLOUD_IDENTITY_URL = "https://cloudidentity.googleapis.com/v1";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/cloud-identity.groups.readonly",
];
const LOGIN_TTL_SECONDS = 600;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[cupcake] Falta la variable ${name}`);
    process.exit(1);
  }
  return value;
}

function loadConfig() {
  const publicUrl = new URL(required("PUBLIC_URL"));
  const sessionSecret = required("SESSION_SECRET");
  if (Buffer.byteLength(sessionSecret) < 32) {
    console.error("[cupcake] SESSION_SECRET debe tener al menos 32 bytes");
    process.exit(1);
  }
  const secure = publicUrl.protocol === "https:";
  return {
    port: Number.parseInt(process.env.PORT ?? "8080", 10),
    publicUrl,
    redirectUri: new URL("/auth/callback", publicUrl).toString(),
    secure,
    sessionCookie: secure ? "__Host-cupcake_session" : "cupcake_session",
    loginCookie: secure ? "__Host-cupcake_login" : "cupcake_login",
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    sessionSecret,
    sessionTtl: Number.parseInt(process.env.SESSION_TTL_SECONDS ?? "3600", 10),
    allowedDomain: (process.env.ALLOWED_DOMAIN ?? "billin.eu").toLowerCase(),
    allowedGroup: (process.env.ALLOWED_GROUP ?? "backoffice@billin.eu").toLowerCase(),
    chartmuseumUrl: required("CHARTMUSEUM_BASE_URL").replace(/\/+$/, "").replace(/\/api$/i, ""),
    chartmuseumRepoPath: (process.env.CHARTMUSEUM_REPO_PATH ?? "").replace(/^\/+|\/+$/g, ""),
    chartmuseumAuth:
      process.env.CHARTMUSEUM_USER || process.env.CHARTMUSEUM_PASSWORD
        ? `Basic ${Buffer.from(`${process.env.CHARTMUSEUM_USER ?? ""}:${process.env.CHARTMUSEUM_PASSWORD ?? ""}`).toString("base64")}`
        : undefined,
    staticDir: resolve(process.env.STATIC_DIR ?? "dist"),
  };
}

const config = loadConfig();

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(createHmac("sha256", config.sessionSecret).update(body).digest("base64url"));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof payload.exp === "number" && payload.exp > now() ? payload : null;
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function parseCookies(header) {
  const out = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function cookie(name, value, maxAge) {
  const attrs = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (config.secure) attrs.push("Secure");
  return attrs.join("; ");
}

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  ...(config.secure ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, "Cache-Control": "no-store", ...headers });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { "Content-Type": "application/json; charset=utf-8" });
}

function redirect(res, location, cookies = []) {
  send(res, 302, "", { Location: location, "Set-Cookie": cookies });
}

function safeNext(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/";
}

function startLogin(res, next) {
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    hd: config.allowedDomain,
    access_type: "online",
  }).toString();
  const login = sign({ state, nonce, verifier, next: safeNext(next), exp: now() + LOGIN_TTL_SECONDS });
  redirect(res, url.toString(), [cookie(config.loginCookie, login, LOGIN_TTL_SECONDS)]);
}

function decodeIdToken(idToken) {
  const part = idToken?.split(".")[1];
  if (!part) throw new Error("id_token sin payload");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function isGroupMember(accessToken, email) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const lookup = new URL(`${CLOUD_IDENTITY_URL}/groups:lookup`);
  lookup.searchParams.set("groupKey.id", config.allowedGroup);
  const groupRes = await fetch(lookup, { headers });
  if (!groupRes.ok) return false;
  const { name } = await groupRes.json();
  if (typeof name !== "string" || !name.startsWith("groups/")) return false;

  const membership = new URL(`${CLOUD_IDENTITY_URL}/${name}/memberships:lookup`);
  membership.searchParams.set("memberKey.id", email);
  const memberRes = await fetch(membership, { headers });
  return memberRes.status === 200;
}

function denied(res, message) {
  send(
    res,
    403,
    `<!doctype html><html lang="es"><meta charset="utf-8"><title>Sin acceso</title><body><p>${message}</p><p><a href="/auth/logout">Cerrar sesión</a></p></body></html>`,
    { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": [cookie(config.loginCookie, "", 0)] },
  );
}

async function handleCallback(req, res, url) {
  const cookies = parseCookies(req.headers.cookie);
  const login = verify(cookies[config.loginCookie]);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!login || !state || !code || !safeEqual(state, login.state)) {
    return denied(res, "La sesión de login no es válida o ha caducado. Vuelve a entrar.");
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: login.verifier,
    }),
  });
  if (!tokenRes.ok) {
    console.warn(`[cupcake] intercambio de código rechazado (${tokenRes.status})`);
    return denied(res, "Google no aceptó el login.");
  }
  const tokens = await tokenRes.json();

  // El id_token llega directamente de Google por TLS (OIDC Core 3.1.3.7), no hace falta validar la firma.
  const claims = decodeIdToken(tokens.id_token);
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  const valid =
    GOOGLE_ISSUERS.has(claims.iss) &&
    claims.aud === config.clientId &&
    claims.exp > now() &&
    safeEqual(claims.nonce ?? "", login.nonce) &&
    claims.email_verified === true &&
    claims.hd === config.allowedDomain &&
    email.endsWith(`@${config.allowedDomain}`);
  if (!valid) {
    console.warn(`[cupcake] login rechazado: identidad fuera de ${config.allowedDomain}`);
    return denied(res, `Solo pueden entrar cuentas de ${config.allowedDomain}.`);
  }

  if (!(await isGroupMember(tokens.access_token, email))) {
    console.warn(`[cupcake] login rechazado: ${email} no pertenece a ${config.allowedGroup}`);
    return denied(res, `Tu cuenta no pertenece a ${config.allowedGroup}.`);
  }

  console.info(`[cupcake] login de ${email}`);
  const session = sign({ email, exp: now() + config.sessionTtl });
  redirect(res, login.next, [
    cookie(config.sessionCookie, session, config.sessionTtl),
    cookie(config.loginCookie, "", 0),
  ]);
}

const CHART_PATH = /^\/chartmuseum\/api\/charts(\/[^/?#]+(\/[^/?#]+)?)?$/;

async function proxyChartmuseum(req, res, url, session) {
  const method = req.method ?? "GET";
  if (!CHART_PATH.test(url.pathname) || !["GET", "HEAD", "DELETE"].includes(method)) {
    return sendJson(res, 404, { error: "not found" });
  }
  if (method === "DELETE" && req.headers.origin !== config.publicUrl.origin) {
    return sendJson(res, 403, { error: "origin not allowed" });
  }

  let path = url.pathname.replace(/^\/chartmuseum/, "");
  if (config.chartmuseumRepoPath) path = path.replace(/^\/api\//, `/api/${config.chartmuseumRepoPath}/`);
  const headers = { Accept: "application/json" };
  if (config.chartmuseumAuth) headers.Authorization = config.chartmuseumAuth;

  const upstream = await fetch(`${config.chartmuseumUrl}${path}`, { method, headers });
  if (method === "DELETE") {
    console.info(`[cupcake] ${session.email} DELETE ${path} -> ${upstream.status}`);
  }
  res.writeHead(upstream.status, {
    ...SECURITY_HEADERS,
    "Cache-Control": "no-store",
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
  });
  if (upstream.body && method !== "HEAD") {
    Readable.fromWeb(upstream.body).pipe(res);
  } else {
    res.end();
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

async function serveStatic(res, pathname) {
  const target = resolve(join(config.staticDir, decodeURIComponent(pathname)));
  const inside = target === config.staticDir || target.startsWith(config.staticDir + sep);
  let file = inside && extname(target) ? target : join(config.staticDir, "index.html");
  let body;
  try {
    body = await readFile(file);
  } catch {
    file = join(config.staticDir, "index.html");
    body = await readFile(file);
  }
  const immutable = file.includes(`${sep}assets${sep}`);
  send(res, 200, body, {
    "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-store",
  });
}

async function handle(req, res) {
  const url = new URL(req.url ?? "/", config.publicUrl);

  if (url.pathname === "/health") return send(res, 200, "ok", { "Content-Type": "text/plain" });
  if (url.pathname === "/auth/login") return startLogin(res, url.searchParams.get("next"));
  if (url.pathname === "/auth/callback") return handleCallback(req, res, url);
  if (url.pathname === "/auth/logout") {
    return redirect(res, "/auth/login", [cookie(config.sessionCookie, "", 0)]);
  }

  const session = verify(parseCookies(req.headers.cookie)[config.sessionCookie]);
  if (url.pathname === "/auth/me") {
    return session ? sendJson(res, 200, { email: session.email }) : sendJson(res, 401, { error: "unauthenticated" });
  }
  if (url.pathname.startsWith("/chartmuseum/")) {
    return session ? proxyChartmuseum(req, res, url, session) : sendJson(res, 401, { error: "unauthenticated" });
  }
  if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "method not allowed" });
  if (!session) return startLogin(res, url.pathname + url.search);
  return serveStatic(res, url.pathname);
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(`[cupcake] ${err instanceof Error ? err.message : String(err)}`);
    if (!res.headersSent) sendJson(res, 502, { error: "bad gateway" });
    else res.destroy();
  });
}).listen(config.port, () => {
  console.info(`[cupcake] escuchando en :${config.port}, acceso para ${config.allowedGroup}`);
});
