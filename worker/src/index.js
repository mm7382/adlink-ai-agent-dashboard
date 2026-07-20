const DEFAULT_DATA_KEY = "dashboard-projects";
const USERS_KEY = "dashboard-users";
const AUDIT_PREFIX = "audit:";
const SESSION_DAYS = 7;
const HASH_ITERATIONS = 100000;

const DEFAULT_USERS = [
  { name: "Michael Chuang", email: "michael.chuang@adlinktech.com", role: "admin", scopes: ["*"], aliases: ["Michael"], initialPassword: "00000000" },
  { name: "John Chien", email: "john.chien@adlinktech.com", role: "viewer", scopes: ["*"] },
  { name: "Diya Tseng", email: "diya.tseng@adlinktech.com", role: "editor", scopes: ["dqac"] },
  { name: "Fencer Kao", email: "fencer.kao@adlinktech.com", role: "editor", scopes: ["sec"], aliases: ["Fencer"] },
  { name: "Ray Hsu", email: "ray.hsu@adlinktech.com", role: "editor", scopes: ["pec-me"] },
  { name: "Mars Chen", email: "mars.chen@adlinktech.com", role: "editor", scopes: ["dqac"] },
  { name: "Tyler Pei", email: "tyler.pei@adlinktech.com", role: "editor", scopes: ["pec-me"], aliases: ["Tyler"] },
  { name: "Frankie Chuang", email: "frankie.chuang@adlinktech.com", role: "editor", scopes: ["pec-emc-rf"], aliases: ["Frankie"] },
  { name: "Vincent Chu", email: "vincent.chu@adlinktech.com", role: "editor", scopes: ["dqac"], aliases: ["Vincent chu", "Vincent"] },
  { name: "Miles Shih", email: "miles.shih@adlinktech.com", role: "editor", scopes: ["bec"], aliases: ["Miles"] },
  { name: "Andy PK Yang", email: "andypk.yang@adlinktech.com", role: "editor", scopes: ["pec-se"], aliases: ["Andy Yang"] },
  { name: "Eric YH1 Lin", email: "ericyh1.lin@adlinktech.com", role: "editor", scopes: ["pec-thermal"], aliases: ["Eric Lin", "Eric"] }
];

const encoder = new TextEncoder();

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
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Dashboard-Token",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store"
  };
}

function routePath(pathname) {
  return pathname.startsWith("/api/") ? pathname.slice(4) : pathname;
}

function parseProjectPayload(value) {
  if (Array.isArray(value)) return { savedAt: new Date().toISOString(), revision: 0, projects: value };
  if (value && Array.isArray(value.projects)) {
    return {
      savedAt: value.savedAt || new Date().toISOString(),
      revision: Number.isFinite(Number(value.revision)) ? Number(value.revision) : 0,
      projects: value.projects
    };
  }
  return null;
}

function safeUser(user) {
  if (!user) return null;
  return {
    name: user.name,
    email: user.email || "",
    role: user.role,
    scopes: Array.isArray(user.scopes) ? user.scopes : [],
    active: Boolean(user.passwordHash),
    disabled: Boolean(user.disabled),
    aliases: Array.isArray(user.aliases) ? user.aliases : []
  };
}

function userCanManage(user) {
  return user && !user.disabled && (user.role === "admin" || user.role === "editor");
}

function isAdmin(user) {
  return user && !user.disabled && user.role === "admin";
}

function hasProjectAccess(user, projectId) {
  if (!userCanManage(user)) return false;
  const scopes = Array.isArray(user.scopes) ? user.scopes : [];
  return user.role === "admin" || scopes.includes("*") || scopes.includes(projectId);
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlJson(value) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function hex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64Url(new Uint8Array(signature));
}

async function hashPassword(password, salt, env) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${password}${env.AUTH_PEPPER || ""}`),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: HASH_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  return hex(new Uint8Array(bits));
}

function timingSafeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}

async function setUserPassword(user, password, env) {
  const salt = randomHex(16);
  return {
    ...user,
    salt,
    passwordHash: await hashPassword(password, salt, env),
    activatedAt: new Date().toISOString()
  };
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function loadUsers(env) {
  let state = await env.ADLINK_DASHBOARD_KV.get(USERS_KEY, "json");
  if (!state || typeof state !== "object" || typeof state.users !== "object") {
    state = { savedAt: null, users: {} };
  }

  let changed = false;
  const allowedNames = new Set(DEFAULT_USERS.map(user => user.name));
  for (const definition of DEFAULT_USERS) {
    const current = state.users[definition.name] || {};
    const nextRole = definition.role;
    const nextScopes = definition.scopes;
    const nextAliases = definition.aliases || [];
    const nextEmail = definition.email || "";
    const merged = {
      ...current,
      name: definition.name,
      email: nextEmail,
      role: nextRole,
      scopes: nextScopes,
      aliases: nextAliases,
      disabled: Boolean(current.disabled)
    };
    if (!merged.passwordHash && definition.initialPassword) {
      state.users[definition.name] = await setUserPassword(merged, definition.initialPassword, env);
      changed = true;
    } else {
      state.users[definition.name] = merged;
      if (!current.name ||
        current.email !== nextEmail ||
        current.role !== nextRole ||
        JSON.stringify(current.scopes || []) !== JSON.stringify(nextScopes) ||
        JSON.stringify(current.aliases || []) !== JSON.stringify(nextAliases)) {
        changed = true;
      }
    }
  }

  for (const [name, user] of Object.entries(state.users)) {
    if (!allowedNames.has(name) && !user.disabled) {
      state.users[name] = { ...user, disabled: true };
      changed = true;
    }
  }

  if (changed) {
    await saveUsers(env, state);
  }
  return state;
}

async function saveUsers(env, state) {
  await env.ADLINK_DASHBOARD_KV.put(USERS_KEY, JSON.stringify({
    savedAt: new Date().toISOString(),
    users: state.users || {}
  }));
}

function findUserByName(state, name) {
  const wanted = normalizeName(name);
  return Object.values(state.users || {}).find(user => {
    if (normalizeName(user.name) === wanted) return true;
    if (normalizeName(user.email) === wanted) return true;
    return (user.aliases || []).some(alias => normalizeName(alias) === wanted);
  }) || null;
}

function userCanLogin(user) {
  return user && !user.disabled && ["admin", "editor", "viewer"].includes(user.role);
}

async function verifyPassword(user, password, env) {
  if (!user || !user.passwordHash || !user.salt) return false;
  const candidate = await hashPassword(password, user.salt, env);
  return timingSafeEqual(candidate, user.passwordHash);
}

async function issueSession(user, env) {
  const payload = {
    sub: user.name,
    role: user.role,
    scopes: user.scopes || [],
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  };
  const encoded = base64UrlJson(payload);
  const signature = await hmac(env.SESSION_SECRET || env.DASHBOARD_WRITE_TOKEN || "dev-session-secret", encoded);
  return `${encoded}.${signature}`;
}

function decodeBase64UrlJson(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return JSON.parse(atob(padded));
}

async function authenticate(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const [encoded, signature] = match[1].split(".");
  if (!encoded || !signature) return null;
  const expected = await hmac(env.SESSION_SECRET || env.DASHBOARD_WRITE_TOKEN || "dev-session-secret", encoded);
  if (!timingSafeEqual(signature, expected)) return null;
  let payload;
  try {
    payload = decodeBase64UrlJson(encoded);
  } catch (error) {
    return null;
  }
  if (!payload.sub || Date.now() > Number(payload.exp || 0)) return null;
  const state = await loadUsers(env);
  const user = findUserByName(state, payload.sub);
  if (!user || user.disabled) return null;
  return user;
}

function legacyAdminAccess(request, env) {
  const expected = env.DASHBOARD_WRITE_TOKEN;
  return Boolean(expected && request.headers.get("X-Dashboard-Token") === expected);
}

async function loadProjectState(env) {
  const dataKey = env.DATA_KEY || DEFAULT_DATA_KEY;
  const stored = await env.ADLINK_DASHBOARD_KV.get(dataKey, "json");
  const parsed = parseProjectPayload(stored) || { savedAt: null, revision: 0, projects: [] };
  return {
    savedAt: parsed.savedAt || null,
    revision: Number.isFinite(Number(parsed.revision)) ? Number(parsed.revision) : 0,
    projects: parsed.projects
  };
}

async function saveProjectState(env, state) {
  const dataKey = env.DATA_KEY || DEFAULT_DATA_KEY;
  await env.ADLINK_DASHBOARD_KV.put(dataKey, JSON.stringify(state));
}

function projectMap(projects) {
  return new Map((projects || []).filter(project => project && project.id).map(project => [project.id, project]));
}

function changedProjects(beforeProjects, afterProjects) {
  const before = projectMap(beforeProjects);
  const after = projectMap(afterProjects);
  const ids = new Set([...before.keys(), ...after.keys()]);
  return [...ids].filter(id => JSON.stringify(before.get(id) || null) !== JSON.stringify(after.get(id) || null));
}

async function writeAuditRecords(env, actor, current, next, ids, request) {
  const before = projectMap(current.projects);
  const after = projectMap(next.projects);
  const now = new Date().toISOString();
  await Promise.all(ids.map(id => {
    const key = `${AUDIT_PREFIX}${now}:${crypto.randomUUID()}:${id}`;
    return env.ADLINK_DASHBOARD_KV.put(key, JSON.stringify({
      changedAt: now,
      actor: actor?.name || "legacy-admin-token",
      role: actor?.role || "admin",
      projectId: id,
      department: after.get(id)?.department || before.get(id)?.department || id,
      userAgent: request.headers.get("User-Agent") || "",
      beforeRevision: current.revision,
      afterRevision: next.revision,
      before: before.get(id) || null,
      after: after.get(id) || null
    }));
  }));
}

async function handleLogin(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.password) {
    return jsonResponse({ ok: false, error: "name_and_password_required" }, { status: 400 }, request, env);
  }
  const state = await loadUsers(env);
  const user = findUserByName(state, body.name);
  if (!userCanLogin(user)) {
    return jsonResponse({ ok: false, error: "no_management_access" }, { status: 403 }, request, env);
  }
  if (!user.passwordHash) {
    return jsonResponse({ ok: false, error: "activation_required" }, { status: 403 }, request, env);
  }
  if (!await verifyPassword(user, body.password, env)) {
    return jsonResponse({ ok: false, error: "invalid_credentials" }, { status: 401 }, request, env);
  }
  return jsonResponse({ ok: true, token: await issueSession(user, env), user: safeUser(user) }, {}, request, env);
}

async function handleActivate(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.password || !body.inviteCode) {
    return jsonResponse({ ok: false, error: "name_password_invite_required" }, { status: 400 }, request, env);
  }
  if (!env.DASHBOARD_INVITE_CODE || body.inviteCode !== env.DASHBOARD_INVITE_CODE) {
    return jsonResponse({ ok: false, error: "invalid_invite_code" }, { status: 403 }, request, env);
  }
  const state = await loadUsers(env);
  const user = findUserByName(state, body.name);
  if (!userCanLogin(user)) {
    return jsonResponse({ ok: false, error: "no_management_access" }, { status: 403 }, request, env);
  }
  state.users[user.name] = await setUserPassword(user, body.password, env);
  await saveUsers(env, state);
  return jsonResponse({ ok: true, token: await issueSession(state.users[user.name], env), user: safeUser(state.users[user.name]) }, {}, request, env);
}

async function handleMe(request, env) {
  const user = await authenticate(request, env);
  if (!user) return jsonResponse({ ok: false, error: "not_authenticated" }, { status: 401 }, request, env);
  return jsonResponse({ ok: true, user: safeUser(user) }, {}, request, env);
}

async function handleUsers(request, env) {
  const actor = await authenticate(request, env);
  if (!isAdmin(actor)) return jsonResponse({ ok: false, error: "admin_required" }, { status: 403 }, request, env);
  const state = await loadUsers(env);
  return jsonResponse({
    ok: true,
    users: Object.values(state.users).map(safeUser).sort((a, b) => a.name.localeCompare(b.name))
  }, {}, request, env);
}

async function handleResetUser(request, env) {
  const actor = await authenticate(request, env);
  if (!isAdmin(actor)) return jsonResponse({ ok: false, error: "admin_required" }, { status: 403 }, request, env);
  const body = await request.json().catch(() => null);
  const state = await loadUsers(env);
  const user = findUserByName(state, body?.name);
  if (!user || user.name === actor.name) {
    return jsonResponse({ ok: false, error: "invalid_user" }, { status: 400 }, request, env);
  }
  delete user.passwordHash;
  delete user.salt;
  delete user.activatedAt;
  state.users[user.name] = user;
  await saveUsers(env, state);
  return jsonResponse({ ok: true, user: safeUser(user) }, {}, request, env);
}

async function handleAudit(request, env) {
  const actor = await authenticate(request, env);
  if (!isAdmin(actor)) return jsonResponse({ ok: false, error: "admin_required" }, { status: 403 }, request, env);
  const list = await env.ADLINK_DASHBOARD_KV.list({ prefix: AUDIT_PREFIX, limit: 100 });
  const records = await Promise.all(list.keys.map(item => env.ADLINK_DASHBOARD_KV.get(item.name, "json")));
  return jsonResponse({
    ok: true,
    records: records
      .filter(Boolean)
      .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)))
      .slice(0, 100)
  }, {}, request, env);
}

async function handleGetProjects(request, env) {
  const actor = await authenticate(request, env);
  if (!userCanLogin(actor)) {
    return jsonResponse({ ok: false, error: "not_authenticated" }, { status: 401 }, request, env);
  }
  return jsonResponse(await loadProjectState(env), {}, request, env);
}

async function handleSaveProjects(request, env) {
  const actor = await authenticate(request, env);
  const legacyAdmin = !actor && legacyAdminAccess(request, env);
  if (!userCanManage(actor) && !legacyAdmin) {
    return jsonResponse({ ok: false, error: "not_authenticated" }, { status: 401 }, request, env);
  }

  const parsed = await request.json().catch(() => null);
  const payload = parseProjectPayload(parsed);
  if (!payload) {
    return jsonResponse({ ok: false, error: "projects_must_be_array" }, { status: 400 }, request, env);
  }

  const current = await loadProjectState(env);
  if (Number.isFinite(Number(parsed?.revision)) && Number(parsed.revision) !== current.revision) {
    return jsonResponse({
      ok: false,
      error: "revision_conflict",
      currentRevision: current.revision,
      savedAt: current.savedAt
    }, { status: 409 }, request, env);
  }

  const changedIds = changedProjects(current.projects, payload.projects);
  const denied = legacyAdmin ? [] : changedIds.filter(id => !hasProjectAccess(actor, id));
  if (denied.length) {
    return jsonResponse({ ok: false, error: "project_scope_denied", denied }, { status: 403 }, request, env);
  }

  const next = {
    savedAt: new Date().toISOString(),
    revision: current.revision + 1,
    projects: payload.projects
  };
  await saveProjectState(env, next);
  await writeAuditRecords(env, actor, current, next, changedIds, request);
  return jsonResponse({ ok: true, savedAt: next.savedAt, revision: next.revision }, {}, request, env);
}

export default {
  async fetch(request, env) {
    const path = routePath(new URL(request.url).pathname);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (path === "/" || path === "") {
        return jsonResponse({
          ok: true,
          service: "ADLINK Dashboard API",
          endpoints: ["/api/projects", "/api/auth/login", "/api/auth/activate", "/api/auth/me", "/api/audit"]
        }, {}, request, env);
      }
      if (path === "/projects" && request.method === "GET") return handleGetProjects(request, env);
      if (path === "/projects" && request.method === "POST") return handleSaveProjects(request, env);
      if (path === "/auth/login" && request.method === "POST") return handleLogin(request, env);
      if (path === "/auth/activate" && request.method === "POST") return handleActivate(request, env);
      if (path === "/auth/me" && request.method === "GET") return handleMe(request, env);
      if (path === "/users" && request.method === "GET") return handleUsers(request, env);
      if (path === "/users/reset" && request.method === "POST") return handleResetUser(request, env);
      if (path === "/audit" && request.method === "GET") return handleAudit(request, env);
      return textResponse("Not found", { status: 404 }, request, env);
    } catch (error) {
      return jsonResponse({ ok: false, error: "server_error", message: error.message }, { status: 500 }, request, env);
    }
  }
};
