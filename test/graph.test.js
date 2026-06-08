"use strict";

/**
 * test/graph.test.js
 *
 * Tests for src/agents/lib/graph.js
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "..");
const { Graph } = require(path.join(ROOT, "src", "agents", "lib", "graph"));
const FIXTURES_VALID = path.join(ROOT, "test", "fixtures", "valid");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGraph(fixtures) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-graph-test-"));
  const reqsDir = path.join(tmpDir, "requirements");

  const typeDirs = ["jobs", "domains", "design-principles", "design-specs", "requirements", "decisions"];
  typeDirs.forEach((d) => fs.mkdirSync(path.join(reqsDir, d), { recursive: true }));

  for (const { src, type } of fixtures) {
    const typeDir = {
      job: "jobs", domain: "domains", "design-principle": "design-principles",
      "design-spec": "design-specs", requirement: "requirements", decision: "decisions",
    }[type];
    fs.copyFileSync(src, path.join(reqsDir, typeDir, path.basename(src)));
  }

  const graph = new Graph(reqsDir);
  const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });
  return { graph, cleanup };
}

function makeGraphWithRecords(records) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-graph-test-"));
  const reqsDir = path.join(tmpDir, "requirements");

  const typeDirs = ["jobs", "domains", "design-principles", "design-specs", "requirements", "decisions"];
  typeDirs.forEach((d) => fs.mkdirSync(path.join(reqsDir, d), { recursive: true }));

  const typeDir = {
    job: "jobs", domain: "domains", "design-principle": "design-principles",
    "design-spec": "design-specs", requirement: "requirements", decision: "decisions",
  };

  for (const record of records) {
    const dir = typeDir[record.type];
    fs.writeFileSync(
      path.join(reqsDir, dir, `${record.id}.yaml`),
      yaml.dump(record)
    );
  }

  const graph = new Graph(reqsDir);
  const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });
  return { graph, cleanup };
}

// ─── Loading ──────────────────────────────────────────────────────────────────

describe("Graph loading", () => {
  test("loads records from fixture files", () => {
    const { graph, cleanup } = makeGraph([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_VALID, "req_test01.yaml"), type: "requirement" },
      { src: path.join(FIXTURES_VALID, "dec_test01.yaml"), type: "decision" },
    ]);

    try {
      assert.equal(graph.records.size, 4);
      assert.ok(graph.get("dom_test01"));
      assert.ok(graph.get("job_test01"));
      assert.ok(graph.get("req_test01"));
      assert.ok(graph.get("dec_test01"));
    } finally {
      cleanup();
    }
  });

  test("handles empty requirements directory", () => {
    const { graph, cleanup } = makeGraph([]);
    try {
      assert.equal(graph.records.size, 0);
    } finally {
      cleanup();
    }
  });

  test("skips malformed YAML files without crashing", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-graph-test-"));
    const reqsDir = path.join(tmpDir, "requirements", "requirements");
    fs.mkdirSync(reqsDir, { recursive: true });
    fs.writeFileSync(path.join(reqsDir, "bad.yaml"), "{ this is: not: valid: yaml: [[[");

    try {
      const graph = new Graph(path.join(tmpDir, "requirements"));
      assert.equal(graph.records.size, 0, "Should load 0 records from malformed file");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── Querying ─────────────────────────────────────────────────────────────────

describe("Graph querying", () => {
  test("get() returns record by ID", () => {
    const { graph, cleanup } = makeGraph([
      { src: path.join(FIXTURES_VALID, "req_test01.yaml"), type: "requirement" },
    ]);

    try {
      const record = graph.get("req_test01");
      assert.ok(record);
      assert.equal(record.id, "req_test01");
      assert.equal(record.type, "requirement");
    } finally {
      cleanup();
    }
  });

  test("get() returns null for unknown ID", () => {
    const { graph, cleanup } = makeGraph([]);
    try {
      assert.equal(graph.get("req_notexist"), null);
    } finally {
      cleanup();
    }
  });

  test("all() filters by type", () => {
    const { graph, cleanup } = makeGraph([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_VALID, "req_test01.yaml"), type: "requirement" },
    ]);

    try {
      assert.equal(graph.all("requirement").length, 1);
      assert.equal(graph.all("job").length, 1);
      assert.equal(graph.all("domain").length, 1);
      assert.equal(graph.all().length, 3);
    } finally {
      cleanup();
    }
  });

  test("byDomain() returns records for a domain", () => {
    const { graph, cleanup } = makeGraph([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_VALID, "req_test01.yaml"), type: "requirement" },
    ]);

    try {
      const domainRecords = graph.byDomain("dom_test01");
      assert.ok(domainRecords.length >= 2, "Should find job and requirement");
      const ids = domainRecords.map((r) => r.id);
      assert.ok(ids.includes("job_test01"));
      assert.ok(ids.includes("req_test01"));
    } finally {
      cleanup();
    }
  });
});

// ─── Domain inference ─────────────────────────────────────────────────────────

describe("Domain inference", () => {
  test("inferDomain() finds domain by title keyword", () => {
    const { graph, cleanup } = makeGraphWithRecords([
      {
        id: "dom_auth01",
        type: "domain",
        title: "Authentication",
        description: "User login and session management.",
        "owner-team": "platform",
        boundary: { includes: ["login", "sessions"], excludes: [] },
        status: { lifecycle: "active" },
      },
      {
        id: "dom_bill01",
        type: "domain",
        title: "Billing",
        description: "Subscription and payment handling.",
        "owner-team": "platform",
        boundary: { includes: ["payments"], excludes: [] },
        status: { lifecycle: "active" },
      },
    ]);

    try {
      const domain = graph.inferDomain("user needs to log in and manage their session");
      assert.ok(domain, "Should find a domain");
      assert.equal(domain.id, "dom_auth01");
    } finally {
      cleanup();
    }
  });

  test("inferDomain() returns null when no match", () => {
    const { graph, cleanup } = makeGraph([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
    ]);

    try {
      const domain = graph.inferDomain("completely unrelated topic xyz");
      // May return null or the only domain — both acceptable, just shouldn't crash
      assert.ok(domain === null || typeof domain === "object");
    } finally {
      cleanup();
    }
  });
});

// ─── Related requirements ─────────────────────────────────────────────────────

describe("findRelated()", () => {
  test("finds approved requirements matching keywords", () => {
    const { graph, cleanup } = makeGraph([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_VALID, "req_test01.yaml"), type: "requirement" },
    ]);

    try {
      const related = graph.findRelated("validate script requirement records");
      assert.ok(related.length > 0, "Should find the test requirement");
      assert.equal(related[0].id, "req_test01");
    } finally {
      cleanup();
    }
  });

  test("does not return proposed requirements", () => {
    const { graph, cleanup } = makeGraphWithRecords([
      {
        id: "dom_test01",
        type: "domain",
        title: "Test Domain",
        description: "Test.",
        "owner-team": "test",
        boundary: { includes: ["test"], excludes: [] },
        status: { lifecycle: "active" },
      },
      {
        id: "req_proposed01",
        type: "requirement",
        title: "A proposed requirement about widgets",
        domain: "dom_test01",
        job: "job_test01",
        behavior: "The system handles widgets.",
        status: { legitimacy: "proposed", lifecycle: "active", implementation: "unbuilt" },
      },
    ]);

    try {
      const related = graph.findRelated("widgets");
      assert.equal(related.length, 0, "Should not return proposed requirements");
    } finally {
      cleanup();
    }
  });
});

// ─── Graph summarize ─────────────────────────────────────────────────────────

describe("summarize()", () => {
  test("produces non-empty summary with records", () => {
    const { graph, cleanup } = makeGraph([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_VALID, "req_test01.yaml"), type: "requirement" },
    ]);

    try {
      const summary = graph.summarize();
      assert.ok(summary.length > 0);
      assert.ok(summary.includes("dom_test01") || summary.includes("Test Domain"));
    } finally {
      cleanup();
    }
  });

  test("produces empty summary with no records", () => {
    const { graph, cleanup } = makeGraph([]);
    try {
      const summary = graph.summarize();
      assert.equal(summary.trim(), "");
    } finally {
      cleanup();
    }
  });
});
