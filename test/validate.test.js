"use strict";

/**
 * test/validate.test.js
 *
 * Tests for src/validate.js
 *
 * Uses Node's built-in test runner (node:test) — no extra dependencies.
 * Run with: node --test test/
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const VALIDATE = path.join(ROOT, "src", "validate.js");
const FIXTURES_VALID = path.join(ROOT, "test", "fixtures", "valid");
const FIXTURES_INVALID = path.join(ROOT, "test", "fixtures", "invalid");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Runs validate.js against a temporary requirements directory.
 * Returns { exitCode, stdout, stderr }
 */
function runValidate(requirementsDir) {
  const result = spawnSync(
    process.execPath,
    [VALIDATE],
    {
      env: { ...process.env, INTENT_ROOT: path.dirname(requirementsDir) },
      encoding: "utf8",
    }
  );
  return {
    exitCode: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

/**
 * Creates a temporary requirements directory with specific fixtures.
 * Returns the temp dir path and a cleanup function.
 */
function makeTempReqs(fixtureFiles) {
  const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "harness-test-"));
  const reqsDir = path.join(tmpDir, "requirements");
  const schemasDir = path.join(tmpDir, "schemas");

  // Create type directories
  const typeDirs = ["jobs", "domains", "design-principles", "design-specs", "requirements", "decisions"];
  typeDirs.forEach((d) => fs.mkdirSync(path.join(reqsDir, d), { recursive: true }));

  // Copy schemas from src/schemas
  fs.cpSync(path.join(ROOT, "src", "schemas"), schemasDir, { recursive: true });

  // Copy requested fixture files into correct type directories
  for (const { src, type } of fixtureFiles) {
    const typeDir = {
      job: "jobs",
      domain: "domains",
      "design-principle": "design-principles",
      "design-spec": "design-specs",
      requirement: "requirements",
      decision: "decisions",
    }[type];
    const dest = path.join(reqsDir, typeDir, path.basename(src));
    fs.copyFileSync(src, dest);
  }

  const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });
  return { tmpDir, reqsDir, cleanup };
}

// ─── Gate 1: Schema validation ────────────────────────────────────────────────

describe("Gate 1: Schema validation", () => {
  test("valid records pass schema validation", () => {
    const { tmpDir, cleanup } = makeTempReqs([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_VALID, "req_test01.yaml"), type: "requirement" },
      { src: path.join(FIXTURES_VALID, "dec_test01.yaml"), type: "decision" },
    ]);

    try {
      const { exitCode, stdout } = runValidate(path.join(tmpDir, "requirements"));
      assert.equal(exitCode, 0, `Expected exit 0, got ${exitCode}.\nOutput: ${stdout}`);
      assert.ok(stdout.includes("✓ All records valid"), "Expected schema validation to pass");
    } finally {
      cleanup();
    }
  });

  test("requirement missing behavior field fails schema validation", () => {
    const { tmpDir, cleanup } = makeTempReqs([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_INVALID, "req_missing_behavior.yaml"), type: "requirement" },
    ]);

    try {
      const { exitCode, stdout } = runValidate(path.join(tmpDir, "requirements"));
      assert.equal(exitCode, 1, "Expected exit 1 for schema violation");
      assert.ok(
        stdout.includes("req_bad01") || stdout.includes("behavior"),
        "Expected error mentioning the bad record or missing field"
      );
    } finally {
      cleanup();
    }
  });

  test("requirement with invalid legitimacy value fails schema validation", () => {
    const { tmpDir, cleanup } = makeTempReqs([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_INVALID, "req_bad_status.yaml"), type: "requirement" },
    ]);

    try {
      const { exitCode, stdout } = runValidate(path.join(tmpDir, "requirements"));
      assert.equal(exitCode, 1, "Expected exit 1 for invalid status value");
    } finally {
      cleanup();
    }
  });

  test("requirement with non-standard ID format fails schema validation", () => {
    const { tmpDir, cleanup } = makeTempReqs([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_INVALID, "req_bad_id.yaml"), type: "requirement" },
    ]);

    try {
      const { exitCode, stdout } = runValidate(path.join(tmpDir, "requirements"));
      assert.equal(exitCode, 1, "Expected exit 1 for non-standard ID");
    } finally {
      cleanup();
    }
  });
});

// ─── Gate 2: Graph integrity ──────────────────────────────────────────────────

describe("Gate 2: Graph integrity", () => {
  test("valid graph with resolved references passes", () => {
    const { tmpDir, cleanup } = makeTempReqs([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_VALID, "req_test01.yaml"), type: "requirement" },
    ]);

    try {
      const { exitCode, stdout } = runValidate(path.join(tmpDir, "requirements"));
      assert.equal(exitCode, 0);
      assert.ok(stdout.includes("✓ All references resolve"));
    } finally {
      cleanup();
    }
  });

  test("requirement referencing non-existent job fails graph integrity", () => {
    const { tmpDir, cleanup } = makeTempReqs([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_INVALID, "req_dangling_ref.yaml"), type: "requirement" },
    ]);

    try {
      const { exitCode, stdout } = runValidate(path.join(tmpDir, "requirements"));
      assert.equal(exitCode, 1, "Expected exit 1 for dangling reference");
      assert.ok(
        stdout.includes("job_doesnotexist") || stdout.includes("unknown ID"),
        "Expected error about unresolved reference"
      );
    } finally {
      cleanup();
    }
  });

  test("empty requirements directory passes both gates", () => {
    const { tmpDir, cleanup } = makeTempReqs([]);

    try {
      const { exitCode, stdout } = runValidate(path.join(tmpDir, "requirements"));
      assert.equal(exitCode, 0, "Empty requirements should pass");
      assert.ok(stdout.includes("Records loaded:  0"));
    } finally {
      cleanup();
    }
  });
});

// ─── Gate 3: Enforcement ─────────────────────────────────────────────────────

describe("Gate 3: Enforcement", () => {
  test("no conflicts between approved+active requirements passes", () => {
    const { tmpDir, cleanup } = makeTempReqs([
      { src: path.join(FIXTURES_VALID, "dom_test01.yaml"), type: "domain" },
      { src: path.join(FIXTURES_VALID, "job_test01.yaml"), type: "job" },
      { src: path.join(FIXTURES_VALID, "req_test01.yaml"), type: "requirement" },
    ]);

    try {
      const { exitCode, stdout } = runValidate(path.join(tmpDir, "requirements"));
      assert.equal(exitCode, 0);
      assert.ok(stdout.includes("✓ No enforcement violations"));
    } finally {
      cleanup();
    }
  });

  test("two approved+active reqs with conflicts_with each other fails", (t) => {
    const os = require("os");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-conflict-test-"));
    const reqsDir = path.join(tmpDir, "requirements");
    const schemasDir = path.join(tmpDir, "schemas");

    const typeDirs = ["jobs", "domains", "requirements", "decisions", "design-principles", "design-specs"];
    typeDirs.forEach((d) => fs.mkdirSync(path.join(reqsDir, d), { recursive: true }));
    fs.cpSync(path.join(ROOT, "src", "schemas"), schemasDir, { recursive: true });

    // Write two conflicting approved requirements
    const yaml = require("js-yaml");

    const reqA = {
      id: "req_aaaa01",
      type: "requirement",
      title: "Requirement A",
      domain: "dom_test01",
      job: "job_test01",
      behavior: "The system does A.",
      relationships: { conflicts_with: ["req_bbbb01"] },
      status: { legitimacy: "approved", lifecycle: "active", implementation: "unbuilt" },
      meta: { created: "2026-01-01", updated: "2026-01-01" },
    };

    const reqB = {
      id: "req_bbbb01",
      type: "requirement",
      title: "Requirement B",
      domain: "dom_test01",
      job: "job_test01",
      behavior: "The system does not do A.",
      relationships: { conflicts_with: ["req_aaaa01"] },
      status: { legitimacy: "approved", lifecycle: "active", implementation: "unbuilt" },
      meta: { created: "2026-01-01", updated: "2026-01-01" },
    };

    fs.copyFileSync(path.join(FIXTURES_VALID, "dom_test01.yaml"), path.join(reqsDir, "domains", "dom_test01.yaml"));
    fs.copyFileSync(path.join(FIXTURES_VALID, "job_test01.yaml"), path.join(reqsDir, "jobs", "job_test01.yaml"));
    fs.writeFileSync(path.join(reqsDir, "requirements", "req_aaaa01.yaml"), yaml.dump(reqA));
    fs.writeFileSync(path.join(reqsDir, "requirements", "req_bbbb01.yaml"), yaml.dump(reqB));

    try {
      const result = spawnSync(
        process.execPath,
        [VALIDATE],
        {
          env: { ...process.env, INTENT_ROOT: tmpDir },
          encoding: "utf8",
        }
      );
      assert.equal(result.status, 1, "Expected exit 1 for conflicting approved requirements");
      assert.ok(
        (result.stdout || "").includes("conflicts_with"),
        "Expected error mentioning conflicts_with"
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
