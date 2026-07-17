const DEFAULT_DATA_KEY = "dashboard-projects";

function jsonResponse(data, init = {}, request, env) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env),
      ...(init.headers || {})
    }
  });
}

function textResponse(text, init = {}, request, env) {
  return new Response(text, {
    ...init,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders(request, env),
      ...(init.headers || {})
    }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Dashboard-Token",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store"
  };
}

function isProjectsPath(pathname) {
  return pathname === "/projects" || pathname === "/api/projects";
}

function hasWriteAccess(request, env) {
  const expected = env.DASHBOARD_WRITE_TOKEN;
  if (!expected) return false;
  return request.headers.get("X-Dashboard-Token") === expected;
}

function parseProjectPayload(value) {
  if (Array.isArray(value)) return { savedAt: new Date().toISOString(), projects: value };
  if (value && Array.isArray(value.projects)) return value;
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const dataKey = env.DATA_KEY || DEFAULT_DATA_KEY;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (!isProjectsPath(url.pathname)) {
      return jsonResponse({
        ok: true,
        service: "ADLINK Dashboard API",
        endpoints: ["/api/projects"]
      }, {}, request, env);
    }

    if (request.method === "GET") {
      const payload = await env.ADLINK_DASHBOARD_KV.get(dataKey, "json");
      if (!payload) {
        return jsonResponse({ savedAt: null, projects: [] }, {}, request, env);
      }
      return jsonResponse(payload, {}, request, env);
    }

    if (request.method !== "POST") {
      return textResponse("Method not allowed", { status: 405 }, request, env);
    }

    if (!hasWriteAccess(request, env)) {
      return jsonResponse({ ok: false, error: "invalid_dashboard_write_token" }, { status: 401 }, request, env);
    }

    let parsed;
    try {
      parsed = await request.json();
    } catch (error) {
      return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 }, request, env);
    }

    const payload = parseProjectPayload(parsed);
    if (!payload) {
      return jsonResponse({ ok: false, error: "projects_must_be_array" }, { status: 400 }, request, env);
    }

    const savedPayload = {
      savedAt: new Date().toISOString(),
      projects: payload.projects
    };
    await env.ADLINK_DASHBOARD_KV.put(dataKey, JSON.stringify(savedPayload));
    return jsonResponse({ ok: true, savedAt: savedPayload.savedAt }, {}, request, env);
  }
};
