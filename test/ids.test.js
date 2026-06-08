"use strict";

/**
 * test/ids.test.js
 *
 * Tests for src/agents/lib/ids.js
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { generateId, typeFromId } = require(path.join(ROOT, "src", "agents", "lib", "ids"));

describe("generateId()", () => {
  test("generates IDs with correct prefix per type", () => {
    assert.ok(generateId("job").startsWith("job_"));
    assert.ok(generateId("domain").startsWith("dom_"));
    assert.ok(generateId("design-principle").startsWith("dp_"));
    assert.ok(generateId("design-spec").startsWith("ds_"));
    assert.ok(generateId("requirement").startsWith("req_"));
    assert.ok(generateId("decision").startsWith("dec_"));
  });

  test("generates IDs that match the expected pattern", () => {
    const pattern = /^(job|dom|dp|ds|req|dec)_[a-z0-9]{6,12}$/;
    const types = ["job", "domain", "design-principle", "design-spec", "requirement", "decision"];
    for (const type of types) {
      const id = generateId(type);
      assert.ok(pattern.test(id), `ID ${id} does not match pattern for type ${type}`);
    }
  });

  test("generates unique IDs on successive calls", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId("requirement"));
    }
    assert.equal(ids.size, 100, "Expected 100 unique IDs");
  });

  test("throws on unknown type", () => {
    assert.throws(() => generateId("unknown-type"), /Unknown record type/);
  });
});

describe("typeFromId()", () => {
  test("returns correct type for each prefix", () => {
    assert.equal(typeFromId("job_abc123"), "job");
    assert.equal(typeFromId("dom_abc123"), "domain");
    assert.equal(typeFromId("dp_abc123"), "design-principle");
    assert.equal(typeFromId("ds_abc123"), "design-spec");
    assert.equal(typeFromId("req_abc123"), "requirement");
    assert.equal(typeFromId("dec_abc123"), "decision");
  });

  test("returns null for unknown prefix", () => {
    assert.equal(typeFromId("xyz_abc123"), null);
    assert.equal(typeFromId("unknown"), null);
  });
});
