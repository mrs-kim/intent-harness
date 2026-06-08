"use strict";

/**
 * test/flip-legitimacy.test.js
 *
 * Tests for src/flip-legitimacy.js
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const yaml = require("js-yaml");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const FLIP = path.join(ROOT, "src", "flip-legitimacy.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReqFile(dir, record) {
  const filePath = path.join(dir, `${record.id}.yaml`);
  fs.writeFileSync(filePath, yaml.dump(record));
  return filePath;
}

function runFlip(harnesRoot, changedFiles = "", actor = "test-user") {
  return spawnSync(process.execPath, [FLIP], {
    env: {
      ...process.env,
      INTENT_ROOT: harnesRoot,
      CHANGED_FILES: changedFiles,
      GITHUB_ACTOR: actor,
    },
    encoding: "utf8",
  });
}

function readRecord(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("flip-legitimacy", () => {
  test("flips proposed requirement to approved", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-flip-test-"));
    const reqDir = path.join(tmpDir, "requirements", "requirements");
    fs.mkdirSync(reqDir, { recursive: true });

    const record = {
      id: "req_flip01",
      type: "requirement",
      title: "Test requirement",
      domain: "dom_test01",
      job: "job_test01",
      behavior: "Does something.",
      status: { legitimacy: "proposed", lifecycle: "active", implementation: "unbuilt" },
      meta: { created: "2026-01-01", updated: "2026-01-01" },
    };

    const filePath = makeReqFile(reqDir, record);

    try {
      const result = runFlip(tmpDir, "requirements/requirements/req_flip01.yaml", "alice");
      assert.equal(result.status, 0, `Expected exit 0.\nOutput: ${result.stdout}`);

      const updated = readRecord(filePath);
      assert.equal(updated.status.legitimacy, "approved");
      assert.equal(updated.meta["approved-by"], "alice");
      assert.ok(updated.meta["approved-date"], "Should have approved-date");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("does not touch already-approved records", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-flip-test-"));
    const reqDir = path.join(tmpDir, "requirements", "requirements");
    fs.mkdirSync(reqDir, { recursive: true });

    const record = {
      id: "req_flip02",
      type: "requirement",
      title: "Already approved requirement",
      domain: "dom_test01",
      job: "job_test01",
      behavior: "Does something.",
      status: { legitimacy: "approved", lifecycle: "active", implementation: "unbuilt" },
      meta: {
        created: "2026-01-01",
        updated: "2026-01-01",
        "approved-by": "original-approver",
        "approved-date": "2026-01-01",
      },
    };

    const filePath = makeReqFile(reqDir, record);

    try {
      runFlip(tmpDir, "requirements/requirements/req_flip02.yaml", "bob");
      const updated = readRecord(filePath);
      assert.equal(updated.meta["approved-by"], "original-approver", "Should not overwrite original approver");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("does not touch records not in CHANGED_FILES", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-flip-test-"));
    const reqDir = path.join(tmpDir, "requirements", "requirements");
    fs.mkdirSync(reqDir, { recursive: true });

    const recordA = {
      id: "req_flip03",
      type: "requirement",
      title: "Changed requirement",
      domain: "dom_test01",
      job: "job_test01",
      behavior: "Does something.",
      status: { legitimacy: "proposed", lifecycle: "active", implementation: "unbuilt" },
      meta: { created: "2026-01-01", updated: "2026-01-01" },
    };

    const recordB = {
      id: "req_flip04",
      type: "requirement",
      title: "Unchanged requirement",
      domain: "dom_test01",
      job: "job_test01",
      behavior: "Does something else.",
      status: { legitimacy: "proposed", lifecycle: "active", implementation: "unbuilt" },
      meta: { created: "2026-01-01", updated: "2026-01-01" },
    };

    const fileA = makeReqFile(reqDir, recordA);
    const fileB = makeReqFile(reqDir, recordB);

    try {
      // Only pass req_flip03 as changed
      runFlip(tmpDir, "requirements/requirements/req_flip03.yaml", "charlie");

      const updatedA = readRecord(fileA);
      const updatedB = readRecord(fileB);

      assert.equal(updatedA.status.legitimacy, "approved", "Changed file should be flipped");
      assert.equal(updatedB.status.legitimacy, "proposed", "Unchanged file should not be flipped");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("skips domain records (no legitimacy field)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-flip-test-"));
    const domDir = path.join(tmpDir, "requirements", "domains");
    fs.mkdirSync(domDir, { recursive: true });

    const domain = {
      id: "dom_flip01",
      type: "domain",
      title: "Test Domain",
      description: "A domain.",
      "owner-team": "test",
      boundary: { includes: ["test"], excludes: [] },
      status: { lifecycle: "active" },
      meta: { created: "2026-01-01", updated: "2026-01-01" },
    };

    const filePath = path.join(domDir, "dom_flip01.yaml");
    fs.writeFileSync(filePath, yaml.dump(domain));

    try {
      // Should not crash on domain records
      const result = runFlip(tmpDir, "requirements/domains/dom_flip01.yaml", "dave");
      assert.equal(result.status, 0, "Should exit 0 even with domain record");

      const updated = readRecord(filePath);
      assert.ok(!updated.status.legitimacy, "Domain should still have no legitimacy field");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
