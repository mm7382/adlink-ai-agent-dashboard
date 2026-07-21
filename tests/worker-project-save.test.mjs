import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/src/index.js";

class MemoryKV {
  constructor() {
    this.values = new Map();
  }

  async get(key, type) {
    if (!this.values.has(key)) return null;
    const value = this.values.get(key);
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.values.set(key, String(value));
  }

  async list({ prefix = "" } = {}) {
    return {
      keys: [...this.values.keys()]
        .filter(key => key.startsWith(prefix))
        .sort()
        .map(name => ({ name }))
    };
  }
}

const editorScopes = new Map([
  ["Andy PK Yang", "pec-se"],
  ["Miles Shih", "bec"],
  ["Frankie Chuang", "pec-emc-rf"],
  ["Ray Hsu", "pec-me"],
  ["Tyler Pei", "pec-me"],
  ["Eric YH1 Lin", "pec-thermal"],
  ["Diya Tseng", "dqac"],
  ["Vincent Chu", "dqac"],
  ["Mars Chen", "dqac"],
  ["Fencer Kao", "sec"]
]);

const projectIds = [...new Set(editorScopes.values())];

function makeEnv() {
  const kv = new MemoryKV();
  kv.values.set("dashboard-projects", JSON.stringify({
    savedAt: "2026-07-21T00:00:00.000Z",
    revision: 7,
    projects: projectIds.map(id => ({ id, department: id.toUpperCase(), title: `${id} title`, summary: "baseline" }))
  }));
  return {
    ADLINK_DASHBOARD_KV: kv,
    DATA_KEY: "dashboard-projects",
    DASHBOARD_INVITE_CODE: "test-invite",
    AUTH_PEPPER: "test-pepper",
    SESSION_SECRET: "test-session-secret",
    ALLOWED_ORIGINS: "https://example.test"
  };
}

async function api(env, path, { method = "GET", token = "", body } = {}) {
  const headers = { Origin: "https://example.test" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const request = new Request(`https://example.test/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const response = await worker.fetch(request, env);
  const payload = await response.json();
  return { status: response.status, payload };
}

async function activateAndLogin(env, name) {
  const password = `Test-${name}-Password!`;
  const activation = await api(env, "/auth/activate", {
    method: "POST",
    body: { name, password, inviteCode: "test-invite" }
  });
  assert.equal(activation.status, 200, `${name} should activate`);
  const login = await api(env, "/auth/login", {
    method: "POST",
    body: { name, password }
  });
  assert.equal(login.status, 200, `${name} should log in`);
  return login.payload.token;
}

test("every editor can save only their assigned project", async () => {
  const env = makeEnv();

  for (const [name, projectId] of editorScopes) {
    const token = await activateAndLogin(env, name);
    const before = await api(env, "/projects", { token });
    const baseProject = before.payload.projects.find(project => project.id === projectId);
    const project = { ...baseProject, summary: `saved by ${name}` };
    const saved = await api(env, "/projects", {
      method: "POST",
      token,
      body: { revision: before.payload.revision, project, baseProject }
    });
    assert.equal(saved.status, 200, `${name} should save ${projectId}: ${JSON.stringify(saved.payload)}`);

    const otherId = projectIds.find(id => id !== projectId);
    const current = await api(env, "/projects", { token });
    const otherBase = current.payload.projects.find(item => item.id === otherId);
    const denied = await api(env, "/projects", {
      method: "POST",
      token,
      body: { project: { ...otherBase, summary: `blocked ${name}` }, baseProject: otherBase }
    });
    assert.equal(denied.status, 403, `${name} must not save ${otherId}`);
    assert.equal(denied.payload.error, "project_scope_denied");
  }
});

test("an unrelated department update does not block an editor save", async () => {
  const env = makeEnv();
  const frankieToken = await activateAndLogin(env, "Frankie Chuang");
  const michaelToken = await activateAndLogin(env, "Michael Chuang");
  const initial = await api(env, "/projects", { token: frankieToken });
  const frankieBase = initial.payload.projects.find(project => project.id === "pec-emc-rf");

  const adminState = await api(env, "/projects", { token: michaelToken });
  const pecSe = adminState.payload.projects.find(project => project.id === "pec-se");
  const adminSave = await api(env, "/projects", {
    method: "POST",
    token: michaelToken,
    body: { project: { ...pecSe, summary: "admin changed another department" }, baseProject: pecSe }
  });
  assert.equal(adminSave.status, 200);

  const frankieSave = await api(env, "/projects", {
    method: "POST",
    token: frankieToken,
    body: {
      revision: initial.payload.revision,
      project: { ...frankieBase, summary: "Frankie update" },
      baseProject: frankieBase
    }
  });
  assert.equal(frankieSave.status, 200, JSON.stringify(frankieSave.payload));
});

test("a same-project concurrent update is rejected", async () => {
  const env = makeEnv();
  const frankieToken = await activateAndLogin(env, "Frankie Chuang");
  const michaelToken = await activateAndLogin(env, "Michael Chuang");
  const initial = await api(env, "/projects", { token: frankieToken });
  const baseProject = initial.payload.projects.find(project => project.id === "pec-emc-rf");

  const adminSave = await api(env, "/projects", {
    method: "POST",
    token: michaelToken,
    body: { project: { ...baseProject, summary: "admin changed same project" }, baseProject }
  });
  assert.equal(adminSave.status, 200);

  const conflict = await api(env, "/projects", {
    method: "POST",
    token: frankieToken,
    body: { project: { ...baseProject, summary: "stale Frankie update" }, baseProject }
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.payload.error, "project_revision_conflict");
});
